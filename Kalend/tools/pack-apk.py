#!/usr/bin/env python3
"""
pack-apk.py — crea un nuovo APK sostituendo la pagina dell'app.

L'APK originale (android/Kalend-v53-original.apk) contiene la parte
nativa (classes.dex, risorse del widget, manifest). Questo script lo
copia voce per voce, sostituisce assets/www/index.html con la versione
appena costruita (www/index.html) e scarta le vecchie firme (META-INF).
Il risultato è un APK NON FIRMATO: per installarlo o pubblicarlo va
allineato e firmato con gli strumenti dell'SDK Android, ad esempio:

    zipalign -p 4 dist/Kalend-unsigned.apk dist/Kalend-aligned.apk
    apksigner sign --ks mia-chiave.jks --out dist/Kalend.apk dist/Kalend-aligned.apk

Uso:  python3 Kalend/tools/pack-apk.py [--out dist/Kalend-unsigned.apk]
"""
import os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'android', 'Kalend-v53-original.apk')
PAGE = os.path.join(ROOT, 'www', 'index.html')
out = os.path.join(ROOT, 'dist', 'Kalend-unsigned.apk')
if '--out' in sys.argv:
    out = sys.argv[sys.argv.index('--out') + 1]

if not os.path.exists(PAGE):
    sys.exit('manca www/index.html: esegui prima  node Kalend/tools/build.js')
os.makedirs(os.path.dirname(out), exist_ok=True)

with zipfile.ZipFile(BASE) as src, zipfile.ZipFile(out, 'w') as dst:
    for info in src.infolist():
        name = info.filename
        if name.startswith('META-INF/'):
            continue                      # vecchie firme: via
        if name == 'assets/www/index.html':
            data = open(PAGE, 'rb').read()
        else:
            data = src.read(name)
        # resources.arsc deve restare NON compresso (requisito Android)
        method = zipfile.ZIP_STORED if name == 'resources.arsc' else info.compress_type
        ni = zipfile.ZipInfo(name, date_time=info.date_time)
        ni.compress_type = method
        ni.external_attr = info.external_attr
        dst.writestr(ni, data)
print('APK non firmato scritto in', os.path.relpath(out))
print('ora: zipalign -p 4 … poi apksigner sign --ks <keystore> …')
