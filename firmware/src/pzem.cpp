// EnergyLab - pilote Modbus-RTU pour PZEM-004T v3.0
// Référence : manuel PZEM-004T V3.0 (Peacefair) - registres d'entrée 0x0000..0x0009
#include "pzem.h"

namespace pzem {

uint16_t crc16(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; i++) {
    crc ^= data[i];
    for (int b = 0; b < 8; b++) {
      if (crc & 0x0001) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc;
}

bool checkCrc(const uint8_t* buf, size_t len) {
  if (len < 3) return false;
  uint16_t c = crc16(buf, len - 2);
  return buf[len - 2] == (uint8_t)(c & 0xFF) && buf[len - 1] == (uint8_t)(c >> 8);
}

void appendCrc(uint8_t* buf, size_t n) {
  uint16_t c = crc16(buf, n);
  buf[n] = (uint8_t)(c & 0xFF);  // octet de poids faible en premier
  buf[n + 1] = (uint8_t)(c >> 8);
}

static size_t build8(uint8_t addr, uint8_t fc, uint16_t a, uint16_t b, uint8_t* out) {
  out[0] = addr;
  out[1] = fc;
  out[2] = (uint8_t)(a >> 8);
  out[3] = (uint8_t)(a & 0xFF);
  out[4] = (uint8_t)(b >> 8);
  out[5] = (uint8_t)(b & 0xFF);
  appendCrc(out, 6);
  return 8;
}

size_t buildReadInput(uint8_t addr, uint8_t* out) { return build8(addr, FC_READ_INPUT, 0x0000, 0x000A, out); }

size_t buildReadHolding(uint8_t addr, uint16_t reg, uint16_t count, uint8_t* out) {
  return build8(addr, FC_READ_HOLDING, reg, count, out);
}

size_t buildWriteSingle(uint8_t addr, uint16_t reg, uint16_t value, uint8_t* out) {
  return build8(addr, FC_WRITE_SINGLE, reg, value, out);
}

size_t buildResetEnergy(uint8_t addr, uint8_t* out) {
  out[0] = addr;
  out[1] = FC_RESET_ENERGY;
  appendCrc(out, 2);
  return 4;
}

static uint16_t reg16(const uint8_t* d, int r) { return (uint16_t)((d[2 * r] << 8) | d[2 * r + 1]); }

bool parseReadInput(const uint8_t* buf, size_t len, Values& v) {
  if (len != 25 || buf[1] != FC_READ_INPUT || buf[2] != 20 || !checkCrc(buf, len)) return false;
  const uint8_t* d = buf + 3;
  v.voltage = reg16(d, 0) * 0.1f;
  v.current = (float)(((uint32_t)reg16(d, 2) << 16) | reg16(d, 1)) * 0.001f;
  v.power = (float)(((uint32_t)reg16(d, 4) << 16) | reg16(d, 3)) * 0.1f;
  v.energyWh = (float)(((uint32_t)reg16(d, 6) << 16) | reg16(d, 5));
  v.frequency = reg16(d, 7) * 0.1f;
  v.pf = reg16(d, 8) * 0.01f;
  v.alarm = reg16(d, 9) == 0xFFFF;
  return true;
}

bool Bus::transact(const uint8_t* req, size_t reqLen, uint8_t* resp, size_t expectLen, uint8_t altAddr) {
  tx_++;
  // Vider les octets parasites puis respecter le silence Modbus (3,5 caractères ≈ 4 ms)
  while (s_->available() > 0) s_->read();
  s_->delayMs(5);
  s_->write(req, reqLen);
  s_->flushTx();
  uint32_t t0 = s_->millis();
  size_t got = 0;
  lastException_ = 0;
  while ((uint32_t)(s_->millis() - t0) < timeoutMs_) {
    while (s_->available() > 0 && got < expectLen) {
      resp[got++] = (uint8_t)s_->read();
      // Réponse d'exception : adresse, code|0x80, code d'erreur, CRC (5 octets)
      if (got == 5 && (resp[1] & 0x80) && checkCrc(resp, 5)) {
        lastException_ = resp[2];
        lastError_ = ERR_EXCEPTION;
        errors_++;
        return false;
      }
    }
    if (got >= expectLen) break;
    s_->delayMs(2);
  }
  if (got < expectLen) {
    lastError_ = got == 0 ? ERR_TIMEOUT : ERR_FRAME;
    errors_++;
    return false;
  }
  if (!checkCrc(resp, expectLen)) {
    lastError_ = ERR_CRC;
    errors_++;
    return false;
  }
  bool addrOk = (req[0] == ADDR_GENERAL) || (resp[0] == req[0]) || (altAddr != 0 && resp[0] == altAddr);
  if (!addrOk || resp[1] != req[1]) {
    lastError_ = ERR_FRAME;
    errors_++;
    return false;
  }
  lastError_ = OK;
  return true;
}

bool Bus::readValues(uint8_t addr, Values& v) {
  uint8_t req[8], resp[25];
  buildReadInput(addr, req);
  if (!transact(req, 8, resp, 25)) return false;
  if (!parseReadInput(resp, 25, v)) {
    lastError_ = ERR_FRAME;
    errors_++;
    return false;
  }
  return true;
}

bool Bus::resetEnergy(uint8_t addr) {
  uint8_t req[4], resp[4];
  buildResetEnergy(addr, req);
  return transact(req, 4, resp, 4);
}

bool Bus::setAlarmThreshold(uint8_t addr, uint16_t watts) {
  uint8_t req[8], resp[8];
  buildWriteSingle(addr, REG_ALARM_THRESHOLD, watts, req);
  if (!transact(req, 8, resp, 8)) return false;
  for (int i = 2; i < 6; i++) {
    if (resp[i] != req[i]) { lastError_ = ERR_FRAME; errors_++; return false; }
  }
  return true;
}

bool Bus::readAlarmThreshold(uint8_t addr, uint16_t& watts) {
  uint8_t req[8], resp[7];
  buildReadHolding(addr, REG_ALARM_THRESHOLD, 1, req);
  if (!transact(req, 8, resp, 7)) return false;
  if (resp[2] != 2) { lastError_ = ERR_FRAME; errors_++; return false; }
  watts = (uint16_t)((resp[3] << 8) | resp[4]);
  return true;
}

bool Bus::readAddress(uint8_t addr, uint8_t& out) {
  uint8_t req[8], resp[7];
  buildReadHolding(addr, REG_ADDRESS, 1, req);
  if (!transact(req, 8, resp, 7)) return false;
  if (resp[2] != 2) { lastError_ = ERR_FRAME; errors_++; return false; }
  out = resp[4];
  return true;
}

bool Bus::setAddress(uint8_t current, uint8_t newAddr) {
  if (newAddr < ADDR_MIN || newAddr > ADDR_MAX) { lastError_ = ERR_FRAME; return false; }
  uint8_t req[8], resp[8];
  buildWriteSingle(current, REG_ADDRESS, newAddr, req);
  // selon les versions, la réponse peut venir de l'ancienne ou de la nouvelle adresse
  if (!transact(req, 8, resp, 8, newAddr)) return false;
  for (int i = 2; i < 6; i++) {
    if (resp[i] != req[i]) { lastError_ = ERR_FRAME; errors_++; return false; }
  }
  return true;
}

const char* errorText(int err) {
  switch (err) {
    case OK: return "ok";
    case ERR_TIMEOUT: return "pas de réponse";
    case ERR_CRC: return "erreur CRC";
    case ERR_EXCEPTION: return "exception Modbus";
    default: return "trame invalide";
  }
}

}  // namespace pzem
