# Kalend — calendario per Android (v54 "Mondo")

Kalend è un'app Android fatta di **una sola pagina web** (`www/index.html`) caricata
in una WebView, più un widget nativo. Questa cartella contiene il sorgente della
pagina, i pacchetti delle 20 lingue, gli strumenti di costruzione e collaudo, e
l'APK originale usato per riconfezionare la versione nuova.

```
Kalend/
├─ src/
│  ├─ index.html          ← il sorgente storico dell'app (v53 + ritocchi v54), si modifica qui
│  ├─ modules/            ← i moduli nuovi della v54, un file per tema, commentati in italiano
│  │   10-lang-packs.js     parser multilingue e auto-tag per ogni alfabeto
│  │   20-tags-culture.js   famiglie, parole chiave e tag culturali nella lingua in uso
│  │   30-calendars.js/css  calendario secondario (islamico, ebraico, lunare…) + festività offline
│  │   40-widget.js         fasce libere e riepilogo del giorno nel widget
│  │   50-ux.js/css         azioni rapide, menu, suggerimenti al momento giusto, localizzazione tardiva
│  │   60-net.js            chiave API Open-Meteo per l'uso commerciale
│  └─ i18n/
│      SCHEMA.md           ← come è fatto un pacchetto lingua
│      it.json … uk.json   ← 20 pacchetti: traduzioni, lessico del parser, auto-tag, cultura
│      extra/*.json        ← stringhe dei moduli v54, già tradotte in tutte le lingue
├─ www/index.html          ← PAGINA COSTRUITA (non modificare a mano: è generata)
├─ tools/
│   build.js               assembla www/index.html e ricalcola gli hash della Content-Security-Policy
│   pack-apk.py            crea dist/Kalend-unsigned.apk (allineato, versionCode) dall'APK originale
│   sign-apk.py            firma v2 con chiave di prova, senza SDK Android
│   harness.js             apre l'app in Chromium headless: errori JS, testi, screenshot
│   i18n-audit.js          copertura delle traduzioni e testi rimasti in italiano
│   i18n-merge.py          unisce file parziali in un pacchetto lingua
│   nl-test.js             prova il parser in linguaggio naturale in una lingua
├─ android/Kalend-v53-original.apk   ← APK originale (parte nativa: widget, promemoria)
├─ dist/Kalend-unsigned.apk          ← APK nuovo, DA FIRMARE
└─ docs/                   note, copertura traduzioni, screenshot
                           PIANO-INTERVENTI.md = piano unico per sicurezza e pubblicazione
```

## Come si costruisce

```bash
node Kalend/tools/build.js          # → Kalend/www/index.html
python3 Kalend/tools/pack-apk.py    # → Kalend/dist/Kalend-unsigned.apk
```

Il build inserisce nella pagina i dizionari (`window.KX_I18N`), i pacchetti lingua
(`window.KX_PACKS`) e i moduli di `src/modules/` (in ordine di nome), poi ricalcola
gli hash SHA-256 di ogni `<script>` nella CSP: senza questo passo la WebView
bloccherebbe gli script. **Ogni modifica a `src/` richiede un nuovo build.**

## Come si firma e si installa l'APK

L'APK in `dist/` non è firmato. Con gli strumenti dell'SDK Android (cartella
`build-tools`) e il proprio keystore:

```bash
zipalign -p 4 Kalend/dist/Kalend-unsigned.apk Kalend/dist/Kalend-aligned.apk
apksigner sign --ks mia-chiave.jks --out Kalend/dist/Kalend.apk Kalend/dist/Kalend-aligned.apk
adb install -r Kalend/dist/Kalend.apk
```

Per aggiornare un'app già installata (o pubblicata sul Play Store) la chiave deve
essere la stessa delle versioni precedenti. `pack-apk.py --version 54` porta il
`versionCode` del manifest a 54 (e il `versionName` a 54.0) senza ricostruire la
parte nativa; l'allineamento a 4 byte è già fatto, `zipalign` non è più necessario.

### APK di prova senza SDK (chiave temporanea)

```bash
python3 Kalend/tools/pack-apk.py --version 54      # allinea le voci e alza il versionCode
python3 Kalend/tools/sign-apk.py                   # → dist/Kalend-test-signed.apk (firma v2)
```

`sign-apk.py` firma con una chiave auto-generata (`android/test-key.pem`, esclusa da git):
va bene per provare sul telefono, **non** per pubblicare né per aggiornare un'app già
installata con un'altra firma (Android chiede di disinstallarla: fai prima un backup
dall'app). Per la versione definitiva usa `apksigner` con il tuo keystore.

## Come si collauda

```bash
node Kalend/tools/harness.js errors --lang ja          # errori JS all'avvio in giapponese
node Kalend/tools/harness.js shot foto.png --lang ar --tap
node Kalend/tools/nl-test.js de "Zahnarzt am Dienstag um 15 Uhr mit Anna"
node Kalend/tools/i18n-audit.js Kalend/docs/i18n        # copertura di tutte le lingue
node Kalend/tools/i18n-audit.js Kalend/docs/i18n --lang en   # testi rimasti in italiano
```

## Come si aggiunge o si corregge una traduzione

Le chiavi sono i testi italiani del sorgente. Si modifica `src/i18n/<lingua>.json`
(sezione `strings`) oppure, per le stringhe dei moduli v54, `src/i18n/extra/v54-moduli.json`,
poi si ricostruisce. Lo schema completo (lessico del parser, auto-tag, pacchetto
culturale) è in `src/i18n/SCHEMA.md`.

## Avvertenze per la commercializzazione

* **Meteo**: Open-Meteo è gratuito solo per uso non commerciale. Nelle impostazioni
  (Funzionalità) c'è il campo per la chiave del piano commerciale; con la chiave le
  richieste passano dai server `customer-api.open-meteo.com`.
* **Geocodifica**: la ricerca singola usa OpenStreetMap Nominatim, che ha una
  politica d'uso restrittiva per le app commerciali con molto traffico.
* **Festività**: Nager.Date è gratuito (licenza MIT); per i paesi non coperti ci sono
  regole offline nell'app.
