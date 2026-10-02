"""EnergyLab - intègre l'application web (dossier ../web) dans le firmware.

Exécuté automatiquement par PlatformIO avant chaque compilation (extra_scripts = pre:...),
ou à la main :  python tools/embed_web.py

Étapes :
  1. assemble les fichiers JavaScript de web/src (ordre alphabétique) dans app.js ;
  2. assemble Blockly (cœur + blocs + traduction française) dans blockly.js ;
  3. compresse chaque fichier (gzip) et génère src/web_assets.cpp / .h.
Les fichiers générés ne sont réécrits que si leur contenu change.
"""
import gzip
import hashlib
import io
import os
import sys

try:
    Import("env")  # noqa: F821  (fourni par PlatformIO/SCons)
    PROJECT_DIR = env["PROJECT_DIR"]  # noqa: F821
except Exception:  # exécution directe
    PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WEB = os.path.normpath(os.path.join(PROJECT_DIR, "..", "web"))
OUT_DIR = os.path.join(PROJECT_DIR, "src")

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".gif": "image/gif",
    ".cur": "image/x-icon",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".txt": "text/plain; charset=utf-8",
}


def read(path):
    with open(path, "rb") as f:
        return f.read()


def bundle_app():
    src = os.path.join(WEB, "src")
    parts = []
    for name in sorted(os.listdir(src)):
        if name.endswith(".js"):
            parts.append(b"/* ---- " + name.encode() + b" ---- */\n" + read(os.path.join(src, name)) + b"\n")
    return b"".join(parts)


def bundle_blockly():
    lib = os.path.join(WEB, "lib", "blockly")
    parts = [read(os.path.join(lib, n)) for n in ("blockly_compressed.js", "blocks_compressed.js", "fr.js")]
    return b"\n;\n".join(parts)


def collect():
    files = {}
    files["/index.html"] = read(os.path.join(WEB, "index.html"))
    files["/app.css"] = read(os.path.join(WEB, "css", "app.css"))
    files["/app.js"] = bundle_app()
    files["/blockly.js"] = bundle_blockly()
    for sub, prefix in (("lib/blockly/media", "/media/"), ("img", "/img/")):
        d = os.path.join(WEB, *sub.split("/"))
        if os.path.isdir(d):
            for name in sorted(os.listdir(d)):
                p = os.path.join(d, name)
                if os.path.isfile(p):
                    files[prefix + name] = read(p)
    for extra in ("favicon.svg", "manifest.webmanifest"):
        p = os.path.join(WEB, extra)
        if os.path.isfile(p):
            files["/" + extra] = read(p)
    return files


def gz(data):
    buf = io.BytesIO()
    with gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=9, mtime=0) as f:
        f.write(data)
    return buf.getvalue()


def write_if_changed(path, text):
    old = None
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            old = f.read()
    if old != text:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return True
    return False


def main():
    if not os.path.isdir(WEB):
        print("embed_web: dossier web introuvable : " + WEB)
        sys.exit(1)
    files = collect()
    hdr = [
        "// Fichier généré par tools/embed_web.py - ne pas modifier",
        "#pragma once",
        "#include <stddef.h>",
        "#include <stdint.h>",
        "struct WebAsset {",
        "  const char* path;",
        "  const char* mime;",
        "  const uint8_t* data;",
        "  size_t len;",
        "  const char* etag;",
        "};",
        "extern const WebAsset WEB_ASSETS[];",
        "extern const size_t WEB_ASSET_COUNT;",
        "",
    ]
    cpp = ['// Fichier généré par tools/embed_web.py - ne pas modifier', '#include "web_assets.h"', ""]
    table = []
    total_raw = total_gz = 0
    for i, (path, data) in enumerate(sorted(files.items())):
        z = gz(data)
        total_raw += len(data)
        total_gz += len(z)
        etag = '"' + hashlib.sha1(data).hexdigest()[:12] + '"'
        ext = os.path.splitext(path)[1]
        mime = MIME.get(ext, "application/octet-stream")
        name = "A%d" % i
        lines = []
        for j in range(0, len(z), 24):
            lines.append(",".join("0x%02x" % b for b in z[j:j + 24]))
        cpp.append("static const uint8_t %s[] = {\n%s\n};" % (name, ",\n".join(lines)))
        table.append('  {"%s", "%s", %s, sizeof(%s), %s},' % (path, mime, name, name, '"\\"' + etag[1:-1] + '\\""'))
    cpp.append("const WebAsset WEB_ASSETS[] = {")
    cpp.extend(table)
    cpp.append("};")
    cpp.append("const size_t WEB_ASSET_COUNT = sizeof(WEB_ASSETS) / sizeof(WEB_ASSETS[0]);")
    cpp.append("")
    ch = write_if_changed(os.path.join(OUT_DIR, "web_assets.h"), "\n".join(hdr))
    cc = write_if_changed(os.path.join(OUT_DIR, "web_assets.cpp"), "\n".join(cpp))
    print("embed_web: %d fichiers, %d Ko -> %d Ko compressés%s" % (
        len(files), total_raw // 1024, total_gz // 1024, " (mis à jour)" if (ch or cc) else ""))


main()
