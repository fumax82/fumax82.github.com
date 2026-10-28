#!/usr/bin/env python3
"""
ATLANTE OFFLINE DELLE CITTÀ — genera www/data/cities.json

Legge il file cities.pbf del pacchetto npm «all-the-cities» (MIT), che è una
conversione dei dati GeoNames (licenza CC BY 4.0: attribuzione nei crediti
dell'app), e scrive un elenco compatto delle città con almeno MIN_POP abitanti.

Uso:  python3 Kalend/tools/build-atlas.py <cartella-con-cities.pbf> [MIN_POP]
      (la cartella si ottiene con:  npm pack all-the-cities  e  tar -xzf …)

Il file è letto SENZA eseguire codice del pacchetto: qui c'è un piccolo
decodificatore del formato protobuf, scritto apposta.

Formato di uscita (JSON): {"v":1,"source":"GeoNames","license":"CC BY 4.0",
  "minPop":15000,"rows":[[nome, paese(ISO2), lat, lon, abitanti], …]}
"""
import json, os, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'www', 'data', 'cities.json')

def read_varint(b, i):
    r = 0; s = 0
    while True:
        c = b[i]; i += 1
        r |= (c & 0x7f) << s
        if c < 0x80: return r, i
        s += 7

def zigzag(n):  # svarint → intero con segno
    return (n >> 1) ^ -(n & 1)

def decode(pbf):
    cities = []; i = 0; lat = 0; lon = 0; n = len(pbf)
    while i < n:
        ln, i = read_varint(pbf, i)
        end = i + ln
        c = {'name': '', 'cc': '', 'pop': 0}
        while i < end:
            key, i = read_varint(pbf, i)
            field, wt = key >> 3, key & 7
            if wt == 0:
                v, i = read_varint(pbf, i)
                if field == 9: c['pop'] = v
                elif field == 10: lon += zigzag(v)
                elif field == 11: lat += zigzag(v)
            elif wt == 2:
                l2, i = read_varint(pbf, i)
                s = pbf[i:i + l2]; i += l2
                if field == 2: c['name'] = s.decode('utf-8', 'replace')
                elif field == 3: c['cc'] = s.decode('utf-8', 'replace')
            else:
                raise ValueError('wire type inatteso %d' % wt)
        c['lat'] = lat / 1e5; c['lon'] = lon / 1e5
        cities.append(c)
    return cities

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    src = os.path.join(sys.argv[1], 'cities.pbf')
    min_pop = int(sys.argv[2]) if len(sys.argv) > 2 else 15000
    data = open(src, 'rb').read()
    cities = decode(data)
    rows = [[c['name'], c['cc'], round(c['lat'], 3), round(c['lon'], 3), c['pop']]
            for c in cities if c['pop'] >= min_pop and c['name'] and c['cc']]
    rows.sort(key=lambda r: (-r[4], r[0]))
    out = {'v': 1, 'source': 'GeoNames (geonames.org), via all-the-cities', 'license': 'CC BY 4.0',
           'minPop': min_pop, 'count': len(rows), 'rows': rows}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    print('città lette: %d · scritte (≥ %d abitanti): %d · %s (%.2f MB)' % (
        len(cities), min_pop, len(rows), OUT, os.path.getsize(OUT) / 1e6))

if __name__ == '__main__':
    main()
