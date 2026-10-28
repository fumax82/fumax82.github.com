#!/usr/bin/env python3
"""
pack-apk.py — crea un nuovo APK sostituendo la pagina dell'app.

L'APK originale (android/Kalend-v53-original.apk) contiene la parte
nativa (classes.dex, risorse del widget, manifest). Questo script lo
copia voce per voce, sostituisce assets/www/index.html con la versione
appena costruita (www/index.html), scarta le vecchie firme (META-INF)
e ALLINEA a 4 byte le voci non compresse (requisito di Android 11+ per
resources.arsc: equivale a «zipalign -p 4»).

Con --version N aggiorna versionCode (e versionName «N.0») nel manifest
binario, così lo store accetta l'aggiornamento.

Il risultato è un APK NON FIRMATO: per installarlo va firmato, con la
propria chiave (apksigner) o, per una prova, con tools/sign-apk.py.

Uso:  python3 Kalend/tools/pack-apk.py [--version 54] [--out dist/Kalend-unsigned.apk]
"""
import os, struct, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'android', 'Kalend-v53-original.apk')
PAGE = os.path.join(ROOT, 'www', 'index.html')
out = os.path.join(ROOT, 'dist', 'Kalend-unsigned.apk')
version = None
args = sys.argv[1:]
if '--out' in args:
    out = args[args.index('--out') + 1]
if '--version' in args:
    version = int(args[args.index('--version') + 1])

if not os.path.exists(PAGE):
    sys.exit('manca www/index.html: esegui prima  node Kalend/tools/build.js')
os.makedirs(os.path.dirname(out), exist_ok=True)


def patch_manifest(data, new_version):
    """Cambia versionCode (intero) e versionName (stessa lunghezza, es. 53.0 → 54.0)
    nel manifest binario Android (AXML), senza spostare nulla."""
    data = bytearray(data)
    off = 8
    csz = struct.unpack('<I', data[off + 4:off + 8])[0]
    sc, _, flags, sso, _ = struct.unpack('<IIIII', data[off + 8:off + 28])
    utf8 = flags & (1 << 8)
    offs = struct.unpack('<%dI' % sc, data[off + 28:off + 28 + 4 * sc])
    strings, spans = [], []
    for o in offs:
        p = off + sso + o
        if utf8:
            n = data[p]; p += 1
            if n & 0x80: p += 1
            n2 = data[p]; p += 1
            if n2 & 0x80: n2 = ((n2 & 0x7f) << 8) | data[p]; p += 1
            strings.append(bytes(data[p:p + n2]).decode('utf-8', 'replace')); spans.append((p, n2, 'utf8'))
        else:
            n = struct.unpack('<H', data[p:p + 2])[0]; p += 2
            strings.append(bytes(data[p:p + 2 * n]).decode('utf-16-le', 'replace')); spans.append((p, n, 'utf16'))
    p = off + csz
    while p < len(data):
        t = struct.unpack('<H', data[p:p + 2])[0]; sz = struct.unpack('<I', data[p + 4:p + 8])[0]
        if t == 0x0102:
            _, _, astart, asize, acnt = struct.unpack('<IIHHH', data[p + 16:p + 30]); ap = p + 16 + astart
            for _i in range(acnt):
                nm, raw = struct.unpack('<II', data[ap + 4:ap + 12])
                name = strings[nm] if nm < len(strings) else ''
                if name == 'versionCode':
                    struct.pack_into('<I', data, ap + 16, new_version)
                elif name == 'versionName' and raw != 0xffffffff:
                    sp, n, kind = spans[raw]
                    old = strings[raw]; new = '%d.0' % new_version
                    if len(new) == len(old):
                        enc = new.encode('utf-8') if kind == 'utf8' else new.encode('utf-16-le')
                        data[sp:sp + len(enc)] = enc
                ap += asize
        p += sz
    return bytes(data)


with zipfile.ZipFile(BASE) as src, zipfile.ZipFile(out, 'w') as dst:
    for info in src.infolist():
        name = info.filename
        if name.startswith('META-INF/'):
            continue                      # vecchie firme: via
        if name == 'assets/www/index.html':
            data = open(PAGE, 'rb').read()
        else:
            data = src.read(name)
        if name == 'AndroidManifest.xml' and version:
            data = patch_manifest(data, version)
        # resources.arsc deve restare NON compresso e allineato a 4 byte
        method = zipfile.ZIP_STORED if name == 'resources.arsc' else info.compress_type
        ni = zipfile.ZipInfo(name, date_time=info.date_time)
        ni.compress_type = method
        ni.external_attr = info.external_attr
        if method == zipfile.ZIP_STORED:
            # offset dei dati = posizione attuale + 30 + nome + extra → si riempie l'extra
            pos = dst.fp.tell()
            name_len = len(name.encode('utf-8'))
            pad = (-(pos + 30 + name_len)) % 4
            if pad:
                # un record "extra" vuoto riempie esattamente pad byte (minimo 4)
                while pad < 4:
                    pad += 4
                ni.extra = struct.pack('<HH', 0xd935, pad - 4) + b'\x00' * (pad - 4)
        dst.writestr(ni, data)
    # v55: file dati della pagina (atlante delle città…) e dizionari per
    # lingua → assets/www/data/ e assets/www/i18n/
    for sub in ('data', 'i18n'):
        d = os.path.join(ROOT, 'www', sub)
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            fp = os.path.join(d, fn)
            if not os.path.isfile(fp):
                continue
            ni = zipfile.ZipInfo('assets/www/%s/%s' % (sub, fn), date_time=(2026, 1, 1, 0, 0, 0))
            ni.compress_type = zipfile.ZIP_DEFLATED
            dst.writestr(ni, open(fp, 'rb').read())
print('APK non firmato scritto in', os.path.relpath(out), ('(versionCode %d)' % version) if version else '')
print('ora: apksigner sign --ks <keystore> …  oppure  python3 Kalend/tools/sign-apk.py (chiave di prova)')
