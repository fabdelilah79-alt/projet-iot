// EnergyLab - buzzer (voir buzzer.h)
#include "buzzer.h"

#include "pins.h"

namespace buzzer {

struct Note {
  uint16_t freq;
  uint16_t ms;
};

static const Note M_SHORT[] = {{2000, 90}};
static const Note M_LONG[] = {{2000, 450}};
static const Note M_ALARM[] = {{2600, 150}, {0, 70}, {1800, 150}, {0, 70}, {2600, 150}, {0, 70}, {1800, 200}};
static const Note M_SUCCESS[] = {{1047, 100}, {1319, 100}, {1568, 180}};
static const Note M_BOOT[] = {{1568, 70}, {0, 40}, {2093, 90}};

struct Melody {
  const Note* notes;
  uint8_t n;
};
static const Melody MELODIES[] = {{M_SHORT, 1}, {M_LONG, 1}, {M_ALARM, 7}, {M_SUCCESS, 3}, {M_BOOT, 3}};

static volatile int s_request = -1;
static const Note* s_cur = nullptr;
static uint8_t s_n = 0, s_i = 0;
static uint32_t s_until = 0;
static const int CH = 4;

static void tone(uint16_t f) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWriteTone(PIN_BUZZER, f);
#else
  ledcWriteTone(CH, f);
#endif
}

void begin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttach(PIN_BUZZER, 2000, 8);
#else
  ledcSetup(CH, 2000, 8);
  ledcAttachPin(PIN_BUZZER, CH);
#endif
  tone(0);
}

void play(int kind) {
  if (kind >= 0 && kind < (int)(sizeof MELODIES / sizeof MELODIES[0])) s_request = kind;
}

void loop() {
  int req = s_request;
  if (req >= 0) {
    s_request = -1;
    s_cur = MELODIES[req].notes;
    s_n = MELODIES[req].n;
    s_i = 0;
    tone(s_cur[0].freq);
    s_until = millis() + s_cur[0].ms;
    return;
  }
  if (!s_cur) return;
  if ((int32_t)(millis() - s_until) >= 0) {
    s_i++;
    if (s_i >= s_n) {
      tone(0);
      s_cur = nullptr;
      return;
    }
    tone(s_cur[s_i].freq);
    s_until = millis() + s_cur[s_i].ms;
  }
}

}  // namespace buzzer
