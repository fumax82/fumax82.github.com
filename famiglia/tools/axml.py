#!/usr/bin/env python3
"""
axml.py - Converte un AndroidManifest.xml testuale nel formato binario
("AXML") che Android legge dentro l'APK.

Perché esiste questo file?
  Normalmente questo lavoro lo fa lo strumento "aapt2" dell'Android SDK.
  Per poter ricompilare l'app anche senza installare l'SDK completo,
  questo piccolo script (solo libreria standard di Python) fa la stessa
  conversione per i casi semplici che ci servono: tag, attributi stringa,
  numeri, booleani e riferimenti "@android:style/..." scritti in esadecimale.

Uso:
    python3 axml.py AndroidManifest.xml  output/AndroidManifest.xml

Formato (riassunto):
    [header file] [string pool] [resource map] [start namespace]
    [start element ... end element]* [end namespace]
Ogni attributo "android:xxx" deve avere il suo ID risorsa nella resource map:
la tabella ANDROID_ATTR qui sotto contiene quelli che usiamo.
"""
import struct
import sys
import xml.etree.ElementTree as ET

ANDROID_NS = "http://schemas.android.com/apk/res/android"

# ID ufficiali degli attributi android: (da android.R$attr nell'android.jar).
# Se aggiungi un attributo nuovo al manifest, aggiungilo anche qui.
ANDROID_ATTR = {
    "theme": 0x01010000,
    "label": 0x01010001,
    "icon": 0x01010002,
    "name": 0x01010003,
    "exported": 0x01010010,
    "configChanges": 0x0101001F,
    "minSdkVersion": 0x0101020C,
    "versionCode": 0x0101021B,
    "versionName": 0x0101021C,
    "windowSoftInputMode": 0x0101022B,
    "targetSdkVersion": 0x01010270,
    "allowBackup": 0x01010280,
    "required": 0x0101028E,
    "hardwareAccelerated": 0x010102D3,
    "largeHeap": 0x0101035A,
    "supportsRtl": 0x010103AF,
    "usesCleartextTraffic": 0x010104EC,
}

# Attributi che Android si aspetta come numeri interi anche se scritti come testo
INT_ATTRS = {"versionCode", "minSdkVersion", "targetSdkVersion", "windowSoftInputMode", "configChanges"}

# Tipi di valore (Res_value::dataType)
TYPE_REFERENCE = 0x01
TYPE_STRING = 0x03
TYPE_INT_DEC = 0x10
TYPE_INT_HEX = 0x11
TYPE_BOOLEAN = 0x12


class StringPool:
    """Raccoglie tutte le stringhe del documento. Le prime posizioni sono
    riservate ai nomi degli attributi android (devono coincidere con la
    resource map)."""

    def __init__(self):
        self.strings = []
        self.index = {}

    def add(self, s):
        if s not in self.index:
            self.index[s] = len(self.strings)
            self.strings.append(s)
        return self.index[s]

    def pack(self):
        offsets, data = [], b""
        for s in self.strings:
            offsets.append(len(data))
            enc = s.encode("utf-16-le")
            data += struct.pack("<H", len(s)) + enc + b"\x00\x00"
        while len(data) % 4:
            data += b"\x00"
        header_size = 28
        strings_start = header_size + 4 * len(self.strings)
        body = b"".join(struct.pack("<I", o) for o in offsets) + data
        size = header_size + len(body)
        # chunk type 0x0001 = RES_STRING_POOL_TYPE, flags 0 = UTF-16
        return struct.pack("<HHIIIIII", 0x0001, header_size, size,
                           len(self.strings), 0, 0, strings_start, 0) + body


def convert(xml_text):
    root = ET.fromstring(xml_text)
    pool = StringPool()

    # 1) Nomi attributi android per primi, in ordine di ID (resource map)
    used = set()
    for el in root.iter():
        for key in el.attrib:
            if key.startswith("{%s}" % ANDROID_NS):
                local = key.split("}")[1]
                if local not in ANDROID_ATTR:
                    raise SystemExit("Attributo android:%s non nella tabella ANDROID_ATTR" % local)
                used.add(local)
    ordered = sorted(used, key=lambda n: ANDROID_ATTR[n])
    for n in ordered:
        pool.add(n)
    res_map = [ANDROID_ATTR[n] for n in ordered]
    pool.add("android")
    pool.add(ANDROID_NS)

    chunks = []
    android_uri = pool.index[ANDROID_NS]

    def attr_bytes(el):
        items = []
        for key, value in el.attrib.items():
            if key.startswith("{"):
                ns, local = key[1:].split("}")
                ns_idx = pool.add(ns)
                res_id = ANDROID_ATTR.get(local, 0x7FFFFFFF)
            else:
                ns_idx, local, res_id = 0xFFFFFFFF, key, 0x7FFFFFFF
            name_idx = pool.add(local)
            raw = 0xFFFFFFFF
            if value in ("true", "false"):
                dtype, data = TYPE_BOOLEAN, 0xFFFFFFFF if value == "true" else 0
            elif value.startswith("@0x") or value.startswith("@android:0x"):
                dtype, data = TYPE_REFERENCE, int(value.split("0x")[1], 16)
            elif local in INT_ATTRS and value.startswith("0x"):
                dtype, data = TYPE_INT_HEX, int(value, 16)
            elif local in INT_ATTRS:
                dtype, data = TYPE_INT_DEC, int(value)
            else:
                raw = pool.add(value)
                dtype, data = TYPE_STRING, raw
            items.append((res_id, struct.pack("<IIIHBBI", ns_idx, name_idx, raw, 8, 0, dtype, data)))
        # Android preferisce gli attributi ordinati per ID risorsa
        items.sort(key=lambda x: x[0])
        return [b for _, b in items]

    def walk(el, line=[1]):
        tag = el.tag
        name_idx = pool.add(tag)
        attrs = attr_bytes(el)
        body = struct.pack("<IIHHHHHH", 0xFFFFFFFF, name_idx, 20, 20, len(attrs), 0, 0, 0) + b"".join(attrs)
        chunks.append(struct.pack("<HHIII", 0x0102, 16, 16 + len(body), line[0], 0xFFFFFFFF) + body)
        line[0] += 1
        for child in el:
            walk(child)
        chunks.append(struct.pack("<HHIIIII", 0x0103, 16, 24, line[0], 0xFFFFFFFF, 0xFFFFFFFF, name_idx))
        line[0] += 1

    walk(root)
    android_prefix = pool.index["android"]
    start_ns = struct.pack("<HHIIIII", 0x0100, 16, 24, 1, 0xFFFFFFFF, android_prefix, android_uri)
    end_ns = struct.pack("<HHIIIII", 0x0101, 16, 24, 1, 0xFFFFFFFF, android_prefix, android_uri)

    pool_bytes = pool.pack()
    resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(res_map)) + b"".join(struct.pack("<I", r) for r in res_map)
    body = pool_bytes + resmap + start_ns + b"".join(chunks) + end_ns
    return struct.pack("<HHI", 0x0003, 8, 8 + len(body)) + body


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        out = convert(f.read())
    with open(dst, "wb") as f:
        f.write(out)
    print("Manifest binario scritto:", dst, len(out), "byte")
