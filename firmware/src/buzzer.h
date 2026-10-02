// EnergyLab - buzzer (mélodies non bloquantes)
#pragma once

#include <Arduino.h>

namespace buzzer {

enum Kind { SHORT = 0, LONG = 1, ALARM = 2, SUCCESS = 3, BOOT = 4 };

void begin();
void play(int kind);  // appel sûr depuis n'importe quelle tâche
void loop();          // à appeler souvent depuis loop()

}  // namespace buzzer
