# Kalend — calendario per Android (v55 "Mondo")

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
│  │   11-nl-smart.js/css   dettatura intelligente: lingua della frase riconosciuta, comandi, luoghi comuni, giorno senza mese, note, priorità, campi a voce, chip 🌐 e anteprima nella scheda vocale
│  │   20-tags-culture.js   famiglie, parole chiave e tag culturali nella lingua in uso
│  │   30-calendars.js/css  calendario secondario (islamico, ebraico, lunare…) + feste calcolate
│  │   31-holidays.js/css   festività offline per tutti i paesi dei 20 mercati, giorni sostitutivi, personalizzabili
│  │   40-widget.js         fasce libere e riepilogo del giorno nel widget
│  │   45-daycal.js/css     personalizzazioni per calendario nella vista del giorno
│  │   46-shell.js          pila dei menu (ogni foglio sopra il precedente), colore della barra di navigazione
│  │   47-landscape.css     telefono in orizzontale: mese intero dall'alto
│  │   48-wow.js/css        mese con più profondità, giornate espanse più alte e animate (si spegne con «riduci movimento»)
│  │   49-views.js/css      settimana, giorno e anno più utili: dettagli nelle barre, azioni rapide, pallini
│  │   50-ux.js/css         azioni rapide, menu, suggerimenti al momento giusto, localizzazione tardiva
│  │   55-textsize.js/css   opzione «testo grande»
│  │   70-weather.js/css    meteo a fornitori: MET Norway (base), Open-Meteo e OpenWeatherMap con chiave personale
│  │   80-geo.js            luoghi → coordinate a strati: memoria, atlante offline, Geocoder Android, chiave, Photon
│  │   90-legal.js/css      pagina Informazioni legali, avviso di aggiornamento, informative prima dei permessi
│  │   95-security.js/css   backup cifrati con password, lista bianca delle impostazioni al ripristino
│  ├─ legal/               ← testi legali: it.json … th.json (termini, privacy, informative) + seller.json (dati venditore)
│  └─ i18n/
│      SCHEMA.md           ← come è fatto un pacchetto lingua
│      it.json … uk.json   ← 20 pacchetti: traduzioni, lessico del parser, auto-tag, cultura
│      extra/*.json        ← stringhe dei moduli v54, già tradotte in tutte le lingue
├─ www/index.html          ← PAGINA COSTRUITA (non modificare a mano: è generata)
├─ www/data/cities.json    ← atlante offline (~24.000 città, GeoNames CC BY 4.0), da tools/build-atlas.py
├─ legal/                  ← pagine web di privacy e termini in 20 lingue (da tools/build-legal.js), per Google Play
├─ tools/
│   build.js               assembla www/index.html e ricalcola gli hash della Content-Security-Policy
│   pack-apk.py            crea dist/Kalend-unsigned.apk (allineato, versionCode) dall'APK originale
│   sign-apk.py            firma v2 con chiave di prova, senza SDK Android
│   harness.js             apre l'app in Chromium headless: errori JS, testi, screenshot
│   i18n-audit.js          copertura delle traduzioni e testi rimasti in italiano
│   i18n-merge.py          unisce file parziali in un pacchetto lingua
│   nl-test.js             prova il parser in linguaggio naturale in una lingua
│   wx-test.js             collaudo del meteo con risposte simulate dei tre fornitori
│   geo-test.js            collaudo della geocodifica a strati
│   hol-test.js            collaudo delle festività (date note del 2026)
│   legal-test.js          collaudo di testi legali, informative e CSP
│   sec-test.js            collaudo di sicurezza: backup cifrati, impostazioni, sincronizzazione QR, XSS
│   build-legal.js         genera legal/*.html dai testi di src/legal/
│   build-atlas.py         genera www/data/cities.json dal pacchetto npm all-the-cities (GeoNames)
├─ android/Kalend-v53-original.apk   ← APK originale (parte nativa: widget, promemoria)
├─ dist/Kalend-unsigned.apk          ← APK nuovo, DA FIRMARE
└─ docs/                   note, copertura traduzioni, screenshot
                           PIANO-INTERVENTI.md = piano unico per sicurezza e pubblicazione
```

## Come si costruisce

```bash
node Kalend/tools/build.js          # → Kalend/www/index.html (CSP ristretta, per l'app Android)
node Kalend/tools/build.js --web    # variante per il browser (connect-src https:)
node Kalend/tools/build-legal.js    # → Kalend/legal/*.html (privacy e termini, 20 lingue)
python3 Kalend/tools/pack-apk.py    # → Kalend/dist/Kalend-unsigned.apk
```

**Prima della pubblicazione** compilare `src/legal/seller.json` (nome, indirizzo,
e‑mail, legge applicabile): i segnaposto vengono sostituiti nei testi legali
dell'app e nelle pagine web al momento del build.

Il build inserisce nella pagina i dizionari di italiano e inglese (`window.KX_I18N`),
i pacchetti lingua (`window.KX_PACKS`) e i moduli di `src/modules/` (in ordine di
nome), poi ricalcola gli hash SHA-256 di ogni `<script>` nella CSP: senza questo
passo la WebView bloccherebbe gli script. **Ogni modifica a `src/` richiede un nuovo build.**

Dalla v55 le altre lingue stanno in `www/i18n/<lingua>.json` (traduzioni, lessico
del parser, auto-tag, cultura, testi legali): un caricatore in testa alla pagina
legge quella in uso all'avvio. La cartella `www/i18n/` va distribuita insieme alla
pagina (l'APK e il progetto Android la copiano da soli). `node tools/build.js --out
<file>` costruisce una pagina di prova altrove, con la sua cartella `i18n/`.

Collaudi disponibili (Playwright): `wx-test.js`, `geo-test.js`, `hol-test.js`,
`legal-test.js`, `sec-test.js`, `daycal-test.js`, `nl-suite.js <lingua|all>`
(parser con frasi e risultati attesi per lingua in `tools/nl-suite/`; `nl-limits.js`
rigenera `docs/PARSER-LIMITI.md` dai limiti noti).

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

* **Meteo** (v55): di serie **MET Norway**, gratuito anche per uso commerciale, senza
  chiave (licenza CC BY 4.0, attribuzione nei crediti). Chi vuole di più inserisce in
  Impostazioni → Funzionalità la **propria** chiave Open-Meteo o OpenWeatherMap: il
  contratto è tra utente e fornitore, la chiave resta cifrata nel telefono.
  L'app non contatta mai Open-Meteo gratuito. Da fare nel nativo: `User-Agent`
  con contatto (richiesto da MET Norway).
* **Luoghi** (v55): a strati — memoria del telefono, atlante offline di ~24.000 città
  (GeoNames, CC BY 4.0), Geocoder di Android (quando il ponte nativo lo offrirà),
  chiave personale dell'utente, infine Photon (komoot, dati OpenStreetMap ODbL) per gli
  indirizzi. Nominatim e Open-Meteo gratuito non vengono più interrogati.
* **Festività** (v55): tutte nel telefono, nessuna chiamata di rete. Regole per ~100
  paesi (quelle del sorgente storico + `31-holidays.js`), giorni sostitutivi, feste
  lunari/islamiche/ebraiche calcolate, Diwali/Holi/Matariki da tabella 2025–2032.
  Dichiarate «indicative»; l'utente può nasconderle o aggiungerne in Impostazioni →
  Lingua e paese. Dove si è attinto a Nager.Date (MIT) la nota resta nei crediti.
