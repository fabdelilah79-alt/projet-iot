// EnergyLab - écran OLED (voir display.h)
#include "display.h"

#include <U8g2lib.h>
#include <Wire.h>
#include <qrcode.h>  // composant qrcode de l'ESP-IDF

#include "pins.h"

namespace display {

static U8G2* s_oled = nullptr;
static int s_screen = 0;
static uint32_t s_screenSince = 0;
static char s_msg[96] = "";
static uint32_t s_msgUntil = 0;
static char s_alert[96] = "";
static uint32_t s_alertUntil = 0;
static portMUX_TYPE s_mux = portMUX_INITIALIZER_UNLOCKED;

// QR code mis en cache
static uint8_t s_qr[41 * 41];
static int s_qrSize = 0;
static String s_qrText;
static uint8_t* s_qrTarget = nullptr;
static int* s_qrSizeTarget = nullptr;

static const int NSCREENS = 5;

static void qrCapture(esp_qrcode_handle_t q) {
  int n = esp_qrcode_get_size(q);
  if (n > 41) n = 0;
  *s_qrSizeTarget = n;
  for (int y = 0; y < n; y++)
    for (int x = 0; x < n; x++) s_qrTarget[y * 41 + x] = esp_qrcode_get_module(q, x, y) ? 1 : 0;
}

static void makeQr(const String& text) {
  if (text == s_qrText) return;
  s_qrText = text;
  s_qrSize = 0;
  s_qrTarget = s_qr;
  s_qrSizeTarget = &s_qrSize;
  esp_qrcode_config_t cfg = ESP_QRCODE_CONFIG_DEFAULT();
  cfg.display_func = qrCapture;
  cfg.max_qrcode_version = 6;
  cfg.qrcode_ecc_level = ESP_QRCODE_ECC_LOW;
  esp_qrcode_generate(&cfg, text.c_str());
}

static void drawQr(int x0, int y0, int maxPx) {
  if (s_qrSize <= 0) return;
  int scale = maxPx / (s_qrSize + 2);
  if (scale < 1) scale = 1;
  int dim = (s_qrSize + 2) * scale;
  s_oled->setDrawColor(1);
  s_oled->drawBox(x0, y0, dim, dim);  // marge blanche (zone calme)
  s_oled->setDrawColor(0);
  for (int y = 0; y < s_qrSize; y++)
    for (int x = 0; x < s_qrSize; x++)
      if (s_qr[y * 41 + x]) s_oled->drawBox(x0 + (x + 1) * scale, y0 + (y + 1) * scale, scale, scale);
  s_oled->setDrawColor(1);
}

void begin(uint8_t type) {
  if (type == 2) return;
  Wire.begin(PIN_SDA, PIN_SCL);
  uint8_t addr = 0;
  for (uint8_t a : {0x3C, 0x3D}) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      addr = a;
      break;
    }
  }
  if (!addr) return;
  if (type == 1) s_oled = new U8G2_SH1106_128X64_NONAME_F_HW_I2C(U8G2_R0, U8X8_PIN_NONE, PIN_SCL, PIN_SDA);
  else s_oled = new U8G2_SSD1306_128X64_NONAME_F_HW_I2C(U8G2_R0, U8X8_PIN_NONE, PIN_SCL, PIN_SDA);
  s_oled->setI2CAddress(addr * 2);
  s_oled->setBusClock(400000);
  s_oled->begin();
  s_oled->enableUTF8Print();
  s_oled->setContrast(200);
}

bool present() { return s_oled != nullptr; }

void boot(const char* line) {
  if (!s_oled) return;
  s_oled->clearBuffer();
  s_oled->setFont(u8g2_font_helvB12_tf);
  s_oled->drawUTF8(14, 22, "EnergyLab");
  s_oled->setFont(u8g2_font_6x12_tf);
  s_oled->drawUTF8(4, 40, "Kit pédagogique IoT");
  s_oled->drawUTF8(4, 58, line);
  s_oled->sendBuffer();
}

void nextScreen() {
  s_screen = (s_screen + 1) % NSCREENS;
  s_screenSince = millis();
}

void message(const char* msg, uint32_t ms) {
  portENTER_CRITICAL(&s_mux);
  strncpy(s_msg, msg, sizeof s_msg - 1);
  s_msg[sizeof s_msg - 1] = 0;
  s_msgUntil = millis() + ms;
  portEXIT_CRITICAL(&s_mux);
}

void alert(const char* msg) {
  portENTER_CRITICAL(&s_mux);
  strncpy(s_alert, msg, sizeof s_alert - 1);
  s_alert[sizeof s_alert - 1] = 0;
  s_alertUntil = millis() + 8000;
  portEXIT_CRITICAL(&s_mux);
}

// Affiche un texte sur plusieurs lignes (coupure aux espaces)
static void wrap(const char* text, int x, int y, int lineH, int maxLines, int maxChars) {
  String t(text);
  int line = 0;
  while (t.length() && line < maxLines) {
    // compter les caractères UTF-8
    int bytes = 0, chars = 0, lastSpace = -1;
    while (bytes < (int)t.length() && chars < maxChars) {
      unsigned char c = t[bytes];
      int len = c < 0x80 ? 1 : (c < 0xE0 ? 2 : (c < 0xF0 ? 3 : 4));
      if (c == ' ') lastSpace = bytes;
      bytes += len;
      chars++;
    }
    int cut = bytes;
    if (bytes < (int)t.length() && lastSpace > 0) cut = lastSpace;
    s_oled->drawUTF8(x, y + line * lineH, t.substring(0, cut).c_str());
    t = t.substring(cut);
    t.trim();
    line++;
  }
}

static void header(const char* title) {
  s_oled->setFont(u8g2_font_6x12_tf);
  s_oled->drawBox(0, 0, 128, 12);
  s_oled->setDrawColor(0);
  s_oled->drawUTF8(2, 10, title);
  s_oled->setDrawColor(1);
}

void update(const Snapshot& s) {
  if (!s_oled) return;
  uint32_t now = millis();
  if (now - s_screenSince > 5000) nextScreen();
  char msg[96], al[96];
  bool showMsg, showAlert;
  portENTER_CRITICAL(&s_mux);
  showAlert = (int32_t)(s_alertUntil - now) > 0;
  showMsg = (int32_t)(s_msgUntil - now) > 0;
  memcpy(msg, s_msg, sizeof msg);
  memcpy(al, s_alert, sizeof al);
  portEXIT_CRITICAL(&s_mux);

  s_oled->clearBuffer();
  char b[64];
  if (showAlert) {
    s_oled->setFont(u8g2_font_6x12_tf);
    s_oled->drawFrame(0, 0, 128, 64);
    s_oled->drawBox(0, 0, 128, 14);
    s_oled->setDrawColor(0);
    s_oled->drawUTF8(30, 11, "! ALERTE !");
    s_oled->setDrawColor(1);
    wrap(al, 4, 27, 12, 3, 20);
    s_oled->sendBuffer();
    return;
  }
  if (showMsg) {
    header("Message du programme");
    s_oled->setFont(u8g2_font_6x12_tf);
    wrap(msg, 2, 26, 12, 4, 21);
    s_oled->sendBuffer();
    return;
  }
  switch (s_screen) {
    case 0: {  // connexion
      header(s.kitName);
      s_oled->setFont(u8g2_font_6x12_tf);
      if (s.apActive && !s.staConnected) {
        snprintf(b, sizeof b, "Wi-Fi: %s", s.apSsid);
        s_oled->drawUTF8(0, 24, b);
        snprintf(b, sizeof b, "Mot de passe: %s", s.apPass[0] ? s.apPass : "(aucun)");
        s_oled->drawUTF8(0, 36, b);
        snprintf(b, sizeof b, "http://%s", s.apIp);
        s_oled->drawUTF8(0, 50, b);
        s_oled->drawUTF8(0, 62, "ou http://energie.lab");
      } else if (s.staConnected) {
        snprintf(b, sizeof b, "Réseau: %s", s.staSsid);
        s_oled->drawUTF8(0, 24, b);
        snprintf(b, sizeof b, "http://%s", s.ip);
        s_oled->drawUTF8(0, 38, b);
        snprintf(b, sizeof b, "http://%s.local", s.host);
        s_oled->drawUTF8(0, 52, b);
        if (s.apActive) {
          snprintf(b, sizeof b, "+ Wi-Fi %s", s.apSsid);
          s_oled->drawUTF8(0, 63, b);
        }
      } else {
        s_oled->drawUTF8(0, 30, "Connexion au réseau...");
        snprintf(b, sizeof b, "%s", s.staSsid);
        s_oled->drawUTF8(0, 44, b);
      }
      break;
    }
    case 1: {  // QR code
      String txt;
      const char* l1;
      const char* l2;
      if (s.apActive && !s.staConnected) {
        txt = String("WIFI:T:") + (s.apPass[0] ? "WPA" : "nopass") + ";S:" + s.apSsid + ";P:" + s.apPass + ";;";
        l1 = "Scannez pour";
        l2 = "rejoindre le Wi-Fi";
      } else {
        txt = String("http://") + s.ip + "/";
        l1 = "Scannez pour";
        l2 = "ouvrir l'appli";
      }
      makeQr(txt);
      drawQr(0, 0, 64);
      s_oled->setFont(u8g2_font_6x12_tf);
      s_oled->drawUTF8(66, 22, l1);
      wrap(l2, 66, 34, 11, 2, 10);
      break;
    }
    case 2: {  // prises
      header("Prises      P (W)");
      s_oled->setFont(u8g2_font_6x12_tf);
      for (int k = 0; k < 4; k++) {
        char name[9];
        strncpy(name, s.names[k], 8);
        name[8] = 0;
        const char* st = s.latched[k] ? "VER" : (s.on[k] ? "ON " : "OFF");
        if (!s.online[k]) snprintf(b, sizeof b, "%d %-8s %s   --", k + 1, name, st);
        else snprintf(b, sizeof b, "%d %-8s %s%6.0f", k + 1, name, st, s.p[k]);
        s_oled->drawUTF8(0, 23 + k * 10, b);
      }
      snprintf(b, sizeof b, "Total: %.0f W", s.total);
      s_oled->drawUTF8(0, 63, b);
      break;
    }
    case 3: {  // énergie
      header("Aujourd'hui");
      s_oled->setFont(u8g2_font_helvB12_tf);
      snprintf(b, sizeof b, "%.0f W", s.total);
      s_oled->drawUTF8(0, 30, b);
      s_oled->setFont(u8g2_font_6x12_tf);
      snprintf(b, sizeof b, "Énergie: %.3f kWh", s.eToday / 1000.0f);
      s_oled->drawUTF8(0, 46, b);
      snprintf(b, sizeof b, "Coût: %.2f %s", s.costToday, s.currency);
      s_oled->drawUTF8(0, 60, b);
      break;
    }
    default: {  // ambiance
      header("Ambiance & programme");
      s_oled->setFont(u8g2_font_6x12_tf);
      if (isnan(s.temp)) snprintf(b, sizeof b, "T: --  H: --");
      else snprintf(b, sizeof b, "T: %.1f°C  H: %.0f%%", s.temp, s.hum);
      s_oled->drawUTF8(0, 24, b);
      if (isnan(s.lum)) snprintf(b, sizeof b, "Lum: --  Prés.: %s", s.pres ? "oui" : "non");
      else snprintf(b, sizeof b, "Lum: %.0f%%  Prés.: %s", s.lum, s.pres ? "oui" : "non");
      s_oled->drawUTF8(0, 36, b);
      if (s.timeValid) snprintf(b, sizeof b, "Heure: %02d:%02d", s.hh, s.mm);
      else snprintf(b, sizeof b, "Heure: non réglée");
      s_oled->drawUTF8(0, 48, b);
      static const char* st[] = {"aucun", "en cours", "terminé", "erreur", "arrêté"};
      int ps = s.progStatus >= 0 && s.progStatus <= 4 ? s.progStatus : 0;
      snprintf(b, sizeof b, "Prog: %.10s %s", s.prog[0] ? s.prog : "-", st[ps]);
      s_oled->drawUTF8(0, 60, b);
      break;
    }
  }
  s_oled->sendBuffer();
}

}  // namespace display
