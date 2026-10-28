#!/usr/bin/env python3
"""
i18n-merge.py — unisce un file JSON parziale nel pacchetto di una lingua.

Serve per costruire src/i18n/<lingua>.json a pezzi (le traduzioni sono
centinaia): ogni pezzo può contenere una o più sezioni ("strings",
"lexicon", "autotag", "culture", "name"); le voci nuove si aggiungono,
quelle esistenti vengono sovrascritte. Il file di destinazione viene
creato se manca e riscritto con indentazione leggibile.

Uso:  python3 Kalend/tools/i18n-merge.py <lingua> <parziale.json> [...]
      python3 Kalend/tools/i18n-merge.py <lingua> --check   (solo verifica)
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if len(sys.argv) < 3:
    sys.exit(__doc__)
lang = sys.argv[1]
dest = os.path.join(ROOT, 'src', 'i18n', lang + '.json')
pack = {"lang": lang, "name": "", "strings": {}, "lexicon": {}, "autotag": {}, "culture": {}}
if os.path.exists(dest):
    with open(dest, encoding='utf-8') as f:
        pack.update(json.load(f))

if sys.argv[2] != '--check':
    for part in sys.argv[2:]:
        with open(part, encoding='utf-8') as f:
            data = json.load(f)
        for key, val in data.items():
            if key in ('strings', 'lexicon', 'autotag', 'culture') and isinstance(val, dict):
                pack.setdefault(key, {}).update(val)
            elif key in ('name', 'lang'):
                pack[key] = val
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(pack, f, ensure_ascii=False, indent=1)

# verifica rispetto alle chiavi mancanti note
missing_file = os.path.join(ROOT, 'docs', 'i18n', 'missing-%s.json' % lang)
if os.path.exists(missing_file):
    with open(missing_file, encoding='utf-8') as f:
        need = json.load(f)
    todo = [k for k in need if k not in pack['strings']]
    print('%s: %d stringhe presenti, %d ancora mancanti' % (lang, len(pack['strings']), len(todo)))
    for k in todo[:15]:
        print('   manca:', k[:80])
bad = [k for k, v in pack['strings'].items() if not isinstance(v, str) or not v.strip()]
if bad:
    print('ATTENZIONE valori vuoti:', bad[:10])
for sec in ('lexicon', 'autotag', 'culture'):
    print('  %s: %d voci' % (sec, len(pack.get(sec) or {})))
