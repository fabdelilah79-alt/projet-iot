# Tests natifs des modules du firmware indépendants du matériel
CXX ?= g++
SRC = ../../firmware/src
JSON ?= $(abspath ../../.deps/ArduinoJson/src)
CXXFLAGS ?= -std=c++17 -O1 -g -Wall -Wextra -Wno-unused-parameter -Wno-maybe-uninitialized -fsanitize=address,undefined -I$(JSON)
CORE = $(SRC)/vm.cpp $(SRC)/pzem.cpp $(SRC)/ai.cpp
KIT = $(SRC)/kitcore.cpp $(SRC)/relays.cpp $(SRC)/config.cpp

all: run

test_main: test_main.cpp $(CORE) $(wildcard $(SRC)/*.h)
	$(CXX) $(CXXFLAGS) -o $@ test_main.cpp $(CORE)

test_kit: test_kit.cpp $(CORE) $(KIT) $(wildcard $(SRC)/*.h)
	$(CXX) $(CXXFLAGS) -o $@ test_kit.cpp $(CORE) $(KIT)

vmrun: vmrun.cpp $(CORE)
	$(CXX) $(CXXFLAGS) -o $@ vmrun.cpp $(SRC)/vm.cpp

run: test_main test_kit
	./test_main
	./test_kit

clean:
	rm -f test_main test_kit vmrun

.PHONY: all run clean
