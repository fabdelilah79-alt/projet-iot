"""EnergyLab - fabrique le fichier unique à flasher (release/energylab-esp32-full.bin).

À lancer après une compilation PlatformIO :
    pio run -e esp32dev            (ou esp32dev-offline)
    python tools/make_release.py   (depuis le dossier firmware)

Le fichier produit se flashe à l'adresse 0x0, par exemple avec l'outil en ligne
https://espressif.github.io/esptool-js/ (Chrome ou Edge, câble USB de données).
"""
import glob
import hashlib
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FW = os.path.dirname(HERE)
ROOT = os.path.dirname(FW)
OUT = os.path.join(ROOT, "release")


def find_build():
    for env in ("esp32dev", "esp32dev-offline"):
        d = os.path.join(FW, ".pio", "build", env)
        if os.path.isfile(os.path.join(d, "firmware.bin")):
            return d
    sys.exit("Aucune compilation trouvée : lancez d'abord « pio run -e esp32dev ».")


def core_dir():
    return os.environ.get("PLATFORMIO_CORE_DIR") or os.path.join(os.path.expanduser("~"), ".platformio")


def find_one(pattern, what):
    hits = glob.glob(pattern, recursive=True)
    if not hits:
        sys.exit("Introuvable : " + what + " (" + pattern + ")")
    return hits[0]


def main():
    build = find_build()
    pk = os.path.join(core_dir(), "packages")
    boot_app0 = find_one(os.path.join(pk, "framework-arduinoespressif32", "tools", "partitions", "boot_app0.bin"), "boot_app0.bin")
    esptool = find_one(os.path.join(pk, "tool-esptoolpy", "esptool.py"), "esptool.py")
    parts = [
        ("0x1000", os.path.join(build, "bootloader.bin")),
        ("0x8000", os.path.join(build, "partitions.bin")),
        ("0xe000", boot_app0),
        ("0x10000", os.path.join(build, "firmware.bin")),
    ]
    os.makedirs(OUT, exist_ok=True)
    full = os.path.join(OUT, "energylab-esp32-full.bin")
    cmd = [sys.executable, esptool, "--chip", "esp32", "merge_bin", "-o", full,
           "--flash_mode", "dio", "--flash_freq", "40m", "--flash_size", "4MB"]
    for off, path in parts:
        cmd += [off, path]
    subprocess.check_call(cmd)
    # fichiers séparés (pour esptool en ligne de commande ou l'outil Flash Download Tools)
    sep = os.path.join(OUT, "fichiers-separes")
    os.makedirs(sep, exist_ok=True)
    names = ["bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"]
    for (off, path), name in zip(parts, names):
        shutil.copyfile(path, os.path.join(sep, name))
    with open(os.path.join(sep, "ADRESSES.txt"), "w", encoding="utf-8") as f:
        f.write("Adresses de flashage (ESP32, flash 4 Mo, mode DIO 40 MHz)\n")
        for (off, _), name in zip(parts, names):
            f.write(f"{off:>8}  {name}\n")
    # démonstration hors-ligne : l'application seule, ouvrable avec Chrome/Edge sans kit (mode démonstration)
    sys.path.insert(0, HERE)
    import embed_web  # noqa: E402
    demo = os.path.join(OUT, "demo")
    shutil.rmtree(demo, ignore_errors=True)
    for path, data in embed_web.collect().items():
        dst = os.path.join(demo, *path.strip("/").split("/"))
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "wb") as f:
            f.write(data)
    print("Démonstration hors-ligne :", os.path.join(demo, "index.html"))
    h = hashlib.sha256(open(full, "rb").read()).hexdigest()
    with open(os.path.join(OUT, "SHA256SUMS.txt"), "w", encoding="utf-8") as f:
        f.write(h + "  energylab-esp32-full.bin\n")
    print("Fichier unique :", full, "(%d octets)" % os.path.getsize(full))
    print("SHA-256 :", h)


if __name__ == "__main__":
    main()
