#!/usr/bin/env python3
"""
package_apk.py - Crea l'APK (non ancora firmato) mettendo insieme:
  - AndroidManifest.xml binario (prodotto da axml.py)
  - classes.dex (codice Java compilato)
  - resources.arsc + res/ (icona, già compilati)
  - assets/ (l'interfaccia web: HTML, CSS, JS, OCR)

I file "resources.arsc" e quelli già compressi (.gz, .wasm) vengono salvati
senza compressione e allineati a 4 byte, come richiesto da Android.

Uso: python3 package_apk.py out.apk manifest.bin classes.dex res_dir assets_dir
"""
import os
import sys
import zipfile

STORE_EXT = (".arsc", ".gz", ".png", ".jpg", ".wasm")


def add(zf, path, arcname):
    with open(path, "rb") as f:
        data = f.read()
    info = zipfile.ZipInfo(arcname, date_time=(2026, 1, 1, 0, 0, 0))
    info.external_attr = 0o644 << 16
    if arcname.endswith(STORE_EXT):
        info.compress_type = zipfile.ZIP_STORED
        # Allineamento a 4 byte: header locale = 30 byte + nome + extra
        offset = zf.fp.tell() + 30 + len(arcname.encode())
        pad = (4 - offset % 4) % 4
        info.extra = b"\x00" * pad
    else:
        info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, data)


def main(out, manifest, dex, res_dir, assets_dir):
    with zipfile.ZipFile(out, "w") as zf:
        add(zf, manifest, "AndroidManifest.xml")
        add(zf, dex, "classes.dex")
        add(zf, os.path.join(res_dir, "resources.arsc"), "resources.arsc")
        for base, _, files in os.walk(os.path.join(res_dir, "res")):
            for name in sorted(files):
                p = os.path.join(base, name)
                add(zf, p, os.path.relpath(p, res_dir).replace(os.sep, "/"))
        for base, _, files in sorted(os.walk(assets_dir)):
            for name in sorted(files):
                p = os.path.join(base, name)
                rel = os.path.relpath(p, assets_dir).replace(os.sep, "/")
                add(zf, p, "assets/" + rel)
    print("APK non firmato:", out, os.path.getsize(out), "byte")


if __name__ == "__main__":
    main(*sys.argv[1:6])
