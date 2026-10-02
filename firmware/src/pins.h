// EnergyLab - affectation des broches (ESP32 DevKit V1, ESP32-WROOM-32)
// Voir docs/02-cablage.md pour le schéma complet.
#pragma once

// Bus série des 4 PZEM-004T v3.0 (adresses Modbus 1, 2, 3, 4)
#define PIN_PZEM_RX 16  // RX2 de l'ESP32  <- TX des PZEM
#define PIN_PZEM_TX 17  // TX2 de l'ESP32  -> RX des PZEM

// Module 4 relais (IN1..IN4)
#define PIN_RELAY1 26
#define PIN_RELAY2 25
#define PIN_RELAY3 33
#define PIN_RELAY4 32

// Écran OLED I2C (SSD1306 0,96" ou SH1106 1,3")
#define PIN_SDA 21
#define PIN_SCL 22

// Capteurs d'ambiance
#define PIN_DHT 27   // DHT22 / AM2302 (température, humidité)
#define PIN_LDR 34   // photorésistance (pont diviseur), entrée analogique ADC1
#define PIN_PIR 35   // détecteur de présence HC-SR501 (sortie 3,3 V)

// Interface
#define PIN_BUZZER 13  // buzzer piézo
#define PIN_BUTTON 0   // bouton BOOT de la carte
#define PIN_LED 2      // LED bleue de la carte

#define NUM_OUTLETS 4
