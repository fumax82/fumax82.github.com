# Famiglia 2.2 — finanze di famiglia, offline

App Android per analizzare entrate e uscite importando gli estratti Excel di Intesa Sanpaolo.
Tutto resta sul telefono: nessun permesso Internet, database locale, backup cifrato.

**APK pronto da installare:** [`dist/Famiglia-2.2.apk`](dist/Famiglia-2.2.apk)
Si installa sopra la 2.0 o la 2.1 senza disinstallare: i dati restano.

---

## Novità della versione 2.2: collegare lo scontrino al pagamento

Dopo la lettura, l'app propone i movimenti con **lo stesso importo** nei giorni dello scontrino.
La banca può registrare il pagamento fino a 5 giorni dopo, o il giorno prima.
Sono ammessi al massimo 5 centesimi di differenza, solo per gli arrotondamenti dei contanti.
Senza data sullo scontrino, cerca lo stesso importo negli ultimi 30 giorni.

- **Scelta proposta**: se lo scontrino dice "pagamento contante", l'app propone *Pagato in contanti*. Il pagamento viene creato e collegato al prelievo bancomat con contanti sufficienti. Altrimenti propone il movimento con lo stesso importo.
- **Correggi data o totale** e le proposte si aggiornano subito.
- **Per ora nessun collegamento**: lo scontrino resta tra quelli "da collegare". Quando importi il periodo giusto, l'app ti avvisa in Home, dopo l'importazione e in *Scontrini*. Lo colleghi con un tocco.
- Il nome del negozio letto sullo scontrino diventa il nome dell'esercizio del movimento collegato.


---

## Novità della versione 2.1

| Funzione | Cosa fa |
|---|---|
| **Copia sui movimenti simili** | Appena salvi un movimento, l'app mostra gli altri movimenti dello **stesso esercizio**, della **stessa insegna** in altri punti vendita e dello **stesso tipo di servizio** (es. Anthropic → OpenAI, Gemini). Per ognuno vedi i campi "valore attuale → nuovo valore", ciascuno con la sua spunta: togli quelli che non sono in comune. Un tocco su un campo in alto lo accende o spegne per tutti. |
| **Modifica di un esercizio già compilato** | Se cambi i dati di un movimento, l'app chiede se aggiornare anche gli altri. Quelli che avevano lo stesso valore vecchio sono già spuntati; quelli in cui avevi scelto a mano un valore diverso no. |
| **Memoria esercizi** | I movimenti **nuovi** di un esercizio che hai già compilato ricevono in automatico tutti i suoi dati: categoria, conto, necessità, natura, detrazione, nome. Quelli già presenti li decidi tu nella finestra di copia. Si disattiva da *Impostazioni*. |
| **Nuovi campi per i report** | *Esercizio* (nome leggibile), *Necessità* (essenziale / utile / superflua), *Natura* (fissa / variabile / una tantum), *Detrazione 730*, *Etichette / progetto*, *Da farsi rimborsare da*, *Rifarei questa spesa?* |
| **Dettagli rapidi** | In *Da fare*: un tocco assegna necessità o natura a tutte le spese di un esercizio. |
| **Report "Abitudini"** | In *Analisi*: spese per necessità e per natura, spese che non rifaresti, costo di ogni progetto, detrazioni 730 dell'anno, rimborsi attesi, esercizi dove spendi di più. Ci sono nuovi filtri in *Movimenti* e nuovi avvisi (superflue, rimborsi in ritardo, promemoria 730). |
| **Scontrini letti meglio** | L'app ritaglia il foglio dalla foto e lo porta alla dimensione giusta. Lo converte in bianco e nero, eliminando le filigrane stampate sul retro della carta. Riconosce la colonna IVA, le offerte, le righe "2x2,90" e le insegne anche lette con errori, o dal sito stampato (www.cadoro.it). Se i conti non tornano riprova da sola, e accetta le foto in qualsiasi ordine. Provato su scontrini veri NaturaSì e Cadoro: tutti i prodotti, i prezzi e i totali sono corretti. |

**Aggiornare dalla 2.0**: installa direttamente la 2.1 sopra la 2.0, perché la firma è la stessa. I dati restano e il database si aggiorna da solo.

---

## Novità della versione 2.0

| Funzione | Dove si trova | Cosa fa |
|---|---|---|
| **Da completare** | tab *Da fare* | Elenca entrate e uscite a cui manca **famiglia di spesa**, **categoria** o **carta/conto**. Completi voce per voce oppure accetti la proposta dell'app. |
| **Proposte automatiche** | *Da fare* | L'app propone la categoria. Usa le tue regole, le scelte che hai già fatto per la stessa controparte e un dizionario di servizi noti. Per esempio Anthropic/Claude, OpenAI/ChatGPT e Gemini vanno in **Tecnologia › AI**, Esselunga va in Supermercato, Eni va in Carburante. |
| **"Ricordare questa scelta?"** | dopo ogni classificazione | Ti chiede se vuoi che le volte successive i movimenti simili vengano classificati **in automatico**. Se dici sì, crea una regola. |
| **Spese ripetitive** | *Da fare › Spese ripetitive* | Riconosce i pagamenti ripetuti verso lo stesso soggetto o conto (mensili, settimanali, annuali…) e propone di creare una regola. |
| **Regole** | *Altro › Regole* | Esempio: "se la descrizione contiene `anthropic\|openai\|gemini` → AI". Puoi limitare una regola alle uscite, a un importo o a una carta. Le regole non toccano mai i movimenti che hai classificato a mano. |
| **Categorie della banca** | *Da fare › Categorie banca* | Associ una volta sola ogni categoria di Intesa a una famiglia di spesa. |
| **Analisi dei buchi** | tab *Importa* | Linea del tempo **visuale** dei periodi coperti dai file importati. Se un file contiene un periodo, quel periodo non è un buco. I buchi tra un'importazione e l'altra hanno una priorità (vedi sotto). Il tasto **"Non è un buco"** viene ricordato. |
| **Scontrini con OCR** | *Home › Scontrino*, *Altro › Scontrini* | Fai una o più foto in sequenza e confermi. L'app legge prodotti, prezzi, totale e data **sul telefono**, senza Internet. Correggi se serve e colleghi lo scontrino al pagamento. |
| **Analisi della spesa** | *Analisi › Spesa e prodotti* | Grafici per reparto, prodotti più comprati, prezzi in aumento e confronto tra negozi, con filtri per periodo, negozio e reparto. |
| **Pagamenti in contanti** | *Home › Contanti* | Li inserisci a mano e l'app propone il **prelievo bancomat** da cui vengono i soldi. Puoi **forzare la chiusura**, per esempio con soldi ricevuti in regalo. |
| **Altri collegamenti** | *Altro › Contanti e collegamenti* | **Giroconti** tra conti tuoi, che non contano né come spesa né come entrata. **Rimborsi** collegati alla spesa originale. |
| **Avvisi "sto buttando soldi?"** | *Analisi › Avvisi* e Home | Categorie in forte crescita e budget superati. Abbonamenti doppi (es. 3 servizi AI) o rincarati. Costi bancari annui. Piccole spese frequenti, delivery, addebiti doppi, contanti senza traccia, risparmio basso. Dove possibile c'è una stima del **risparmio annuo**. |

### Priorità dei buchi di importazione

| Giorni senza file | Priorità | Significato |
|---|---|---|
| 1–3 | bassa (minima se solo weekend) | Può essere normale, ma l'app lo segnala comunque. |
| 4–6 | media | Conviene controllare. |
| 7–13 | alta | Molto probabilmente hai saltato un file. |
| 14 o più | critica | Manca quasi certamente un file. |

### Come vengono contati i contanti

Un prelievo non è una spesa: sposta soldi dal conto al portafoglio.
La spesa vera è il pagamento in contanti che registri.
La parte di un prelievo non ancora spiegata da pagamenti appare come **"Contanti non tracciati"**.
Così i totali non contano due volte gli stessi soldi e non li perdono.

---

## ⚠️ Installazione dalla 1.0: leggere prima di disinstallare

La 2.0 è firmata con una **chiave diversa** dalla 1.0, perché la chiave originale non era disponibile.
Android quindi non la installa sopra la vecchia app. Per non perdere i dati:

1. Nella **1.0**: *Spazio › Backup cifrato*. Salva il file `.fmb` e ricorda la password.
2. Disinstalla la 1.0.
3. Installa `Famiglia-2.2.apk`. Android chiederà di consentire l'installazione da questa fonte.
4. Nella **2.0**: *Altro › Impostazioni e backup › Ripristina* e scegli il file `.fmb`.
   Il database viene aggiornato automaticamente al nuovo formato.

Da ora in poi gli aggiornamenti useranno la chiave in `keystore/`.
Quella chiave **non è nel repository** perché il repository è pubblico: conservala tu.

---

## Provare l'app sul computer (anteprima)

Apri `www/index.html` con un piccolo server locale:

```bash
cd famiglia/www
python3 -m http.server 8000
# poi apri http://localhost:8000 nel browser
```

Vedrai un'**anteprima con dati inventati**: puoi provare tutte le schermate, l'OCR degli scontrini (con foto dalla galleria o webcam) e le regole.
L'importazione Excel e il backup funzionano solo nell'app Android.

---

## Struttura del progetto (per leggere e modificare il codice)

```
famiglia/
├── www/                        ← INTERFACCIA (HTML/CSS/JavaScript), finisce in assets/ dell'APK
│   ├── index.html              pagina unica, carica tutti gli script in ordine
│   ├── css/style.css           colori e aspetto (variabili in alto)
│   ├── js/logic/               CALCOLI PURI, senza grafica (testati)
│   │   ├── util.js             date, importi, piccole utilità
│   │   ├── classify.js         famiglie/categorie, dizionario (AI…), regole, cose da completare, ricorrenze
│   │   ├── fields.js           ELENCO DEI CAMPI, copia sui movimenti simili, memoria esercizi
│   │   ├── gaps.js             analisi dei buchi tra importazioni
│   │   ├── finance.js          totali, categorie, mesi, contanti non tracciati
│   │   ├── links.js            collegamenti: contanti↔prelievi, giroconti, rimborsi
│   │   ├── insights.js         avvisi su sprechi e abitudini
│   │   └── receipts.js         lettura del testo degli scontrini, insegne, reparti, analisi prodotti
│   ├── js/ocr.js               foto → ritaglio e pulizia → testo (Tesseract, offline), più tentativi
│   ├── js/app.js               stato, comunicazione con Android, componenti comuni
│   ├── js/screens/*.js         una schermata per file (home, todo, imports, receipts, cash…)
│   ├── js/demo.js              database finto per l'anteprima sul PC
│   └── vendor/tesseract/       motore OCR + modello italiano (non modificare)
├── android/
│   ├── AndroidManifest.xml     nome app, versione, permessi (solo fotocamera)
│   ├── java/it/famiglia/offline/
│   │   ├── MainActivity.java   finestra, sblocco con PIN/impronta, file, fotocamera
│   │   ├── Bridge.java         elenco dei comandi che JavaScript può chiamare
│   │   ├── Store.java          database SQLite (tabelle, aggiornamento 1→2)
│   │   ├── Xlsx.java           lettura Excel Intesa (periodo, righe)
│   │   ├── Core.java           regole di base (date, importi, prelievi, abbinamenti)
│   │   ├── Tx.java             un movimento
│   │   └── Backup.java         backup cifrato AES-256 (compatibile con la 1.0)
│   └── res-compiled/           icona e risorse già compilate
├── tests/                      test automatici (logica, copia campi, scontrini veri in tests/fixtures/)
└── tools/
    ├── build_apk.sh            crea l'APK firmato con un comando
    ├── axml.py                 converte il manifest nel formato binario Android
    ├── package_apk.py          impacchetta l'APK
    └── Sign.java               firma l'APK
```

### Modifiche frequenti

- **Aggiungere un servizio al dizionario**: apri `www/js/logic/classify.js` e cerca `DICTIONARY`.
  Aggiungi la parola nella lista giusta, per esempio `'claude'` nella riga AI.
- **Cambiare le soglie dei buchi**: in `www/js/logic/gaps.js` modifica la funzione `priority`.
- **Nuovo avviso**: in `www/js/logic/insights.js` aggiungi un blocco `add({...})` dentro `compute`.
- **Nuovo reparto prodotti**: in `www/js/logic/receipts.js` modifica `DEPARTMENTS`.
- **Nuova insegna di negozio**: in `www/js/logic/receipts.js` aggiungi una riga in `SHOPS`.
- **Nuovo campo manuale** (es. "Canale: online/negozio"): aggiungilo in `FIELDS` dentro `www/js/logic/fields.js`.
  Dettaglio, finestra di copia, memoria e filtri lo useranno da soli; per l'esportazione CSV aggiungilo anche in `Store.csv()`.
- **Colori**: le variabili sono in cima a `www/css/style.css`.

---

## Ricompilare l'APK

Servono Java 17 o superiore, Python 3 e, facoltativamente, Node.js per i test.
Android Studio non serve.

```bash
cd famiglia
bash tools/build_apk.sh
# risultato: dist/Famiglia-<versione>.apk
```

La prima volta lo script scarica gli strumenti Android in `.build-tools/`.
Prima di una nuova versione aumenta `versionCode` e `versionName` in `android/AndroidManifest.xml`.
Per firmare, lo script usa `keystore/famiglia-release.p12` e `keystore/password.txt`.
Se mancano ne crea di nuovi, ma in quel caso l'app non si aggiornerà sopra quella già installata.

Per eseguire solo i test della logica:

```bash
node --test tests/*.test.js
```
