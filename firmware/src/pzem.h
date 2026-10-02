// EnergyLab - pilote Modbus-RTU pour PZEM-004T v3.0 (100 A / 10 A)
// Plusieurs modules partagent le même bus série, chacun avec sa propre adresse (1..247).
// Indépendant du matériel (interface ByteStream) pour pouvoir être testé sur PC.
#pragma once

#include <stddef.h>
#include <stdint.h>

namespace pzem {

static const uint8_t ADDR_GENERAL = 0xF8;  // adresse "générale" : un seul module sur le bus !
static const uint8_t ADDR_MIN = 0x01;
static const uint8_t ADDR_MAX = 0xF7;

static const uint8_t FC_READ_HOLDING = 0x03;
static const uint8_t FC_READ_INPUT = 0x04;
static const uint8_t FC_WRITE_SINGLE = 0x06;
static const uint8_t FC_RESET_ENERGY = 0x42;

static const uint16_t REG_ALARM_THRESHOLD = 0x0001;  // registre de maintien : seuil d'alarme (W)
static const uint16_t REG_ADDRESS = 0x0002;          // registre de maintien : adresse Modbus

enum Error : int { OK = 0, ERR_TIMEOUT = 1, ERR_CRC = 2, ERR_EXCEPTION = 3, ERR_FRAME = 4 };

struct Values {
  float voltage = 0;    // V
  float current = 0;    // A
  float power = 0;      // W
  float energyWh = 0;   // Wh (compteur interne non volatil)
  float frequency = 0;  // Hz
  float pf = 0;         // facteur de puissance
  bool alarm = false;   // seuil d'alarme interne dépassé
};

uint16_t crc16(const uint8_t* data, size_t len);
bool checkCrc(const uint8_t* buf, size_t len);
void appendCrc(uint8_t* buf, size_t lenWithoutCrc);

size_t buildReadInput(uint8_t addr, uint8_t* out);  // 8 octets
size_t buildReadHolding(uint8_t addr, uint16_t reg, uint16_t count, uint8_t* out);
size_t buildWriteSingle(uint8_t addr, uint16_t reg, uint16_t value, uint8_t* out);
size_t buildResetEnergy(uint8_t addr, uint8_t* out);  // 4 octets

// Décode la réponse (25 octets) à une lecture des 10 registres d'entrée
bool parseReadInput(const uint8_t* buf, size_t len, Values& v);

// Transport série abstrait
class ByteStream {
 public:
  virtual ~ByteStream() {}
  virtual size_t write(const uint8_t* data, size_t len) = 0;
  virtual int available() = 0;
  virtual int read() = 0;
  virtual void flushTx() = 0;
  virtual uint32_t millis() = 0;
  virtual void delayMs(uint32_t ms) = 0;
};

class Bus {
 public:
  explicit Bus(ByteStream* s) : s_(s) {}
  void setTimeout(uint32_t ms) { timeoutMs_ = ms; }

  bool readValues(uint8_t addr, Values& v);
  bool resetEnergy(uint8_t addr);
  bool setAlarmThreshold(uint8_t addr, uint16_t watts);
  bool readAlarmThreshold(uint8_t addr, uint16_t& watts);
  bool readAddress(uint8_t addr, uint8_t& out);
  // Change l'adresse du module joignable à 'current' (ADDR_GENERAL si un seul module branché)
  bool setAddress(uint8_t current, uint8_t newAddr);

  int lastError() const { return lastError_; }
  uint8_t lastException() const { return lastException_; }
  uint32_t txCount() const { return tx_; }
  uint32_t errCount() const { return errors_; }

 private:
  bool transact(const uint8_t* req, size_t reqLen, uint8_t* resp, size_t expectLen, uint8_t altAddr = 0);
  ByteStream* s_;
  uint32_t timeoutMs_ = 250;
  int lastError_ = OK;
  uint8_t lastException_ = 0;
  uint32_t tx_ = 0;
  uint32_t errors_ = 0;
};

const char* errorText(int err);

}  // namespace pzem
