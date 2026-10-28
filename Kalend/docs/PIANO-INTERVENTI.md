# Kalend — Piano unico degli interventi (sicurezza, Play Store, qualità)

Data: 28 ottobre 2026 · Base: versione v54 «Mondo» (pagina) + parte nativa v53.
Questo documento **sostituisce come riferimento operativo** i due report precedenti,
che restano come approfondimento:
[`REPORT-PLAY-STORE.md`](REPORT-PLAY-STORE.md) (requisiti Play, servizi di terzi,
marchi e brevetti) e [`SECURITY-ANALYSIS.md`](SECURITY-ANALYSIS.md) (minacce e
superfici d'attacco). Nessuna modifica al codice è stata ancora applicata.

---

## 0. Come leggere il piano

Gli interventi sono divisi in **cinque fasi**, in ordine di esecuzione:

| Fase | Quando | Contenuto | Chi |
|---|---|---|---|
| **D** | Prima di tutto | Decisioni e materiali che solo tu puoi fornire | Tu |
| **1** | **Subito** | Modifiche alla pagina web (`src/`), utili comunque, reversibili | Io, ora |
| **2** | **Subito dopo aver avuto il sorgente nativo** | Correzioni di sicurezza e porting tecnico della parte Android | Io, con il progetto Android |
| **3** | **Poco prima della pubblicazione**, una volta deciso di pubblicare | Formato AAB, firma definitiva, schede e moduli del Play Console, verifiche finali | Tu + io |
| **4** | Dopo la pubblicazione | Manutenzione, crescita, analisi costose | Tu + io |

**Criterio di divisione.** Va in Fase 1 o 2 tutto ciò che migliora l'app *anche se
non venisse mai pubblicata* (sicurezza, servizi gratuiti, prestazioni) e tutto ciò
che richiede tempo di collaudo. Va in Fase 3 tutto ciò che è **irreversibile** (nome
del pacchetto, chiave di firma), che **scade o cambia nel tempo** (livello API
richiesto, termini dei servizi) o che ha senso **solo per il negozio** (AAB,
schede, moduli).

**Legenda.**
Gravità: 🔴 blocca la pubblicazione o permette furto di dati · 🟠 importante ·
🟡 consigliato.
Impegno: **S** = meno di mezza giornata · **M** = 1–2 giorni · **L** = 3 giorni o più.
Dove: **pagina** = `src/index.html` e `src/modules/` · **nativo** = progetto Android
(Java) · **build** = strumenti in `tools/` · **console** = Google Play Console.

---

## 1. Quadro d'insieme

| ID | Intervento | Gravità | Fase | Dove | Impegno | Dipende da |
|---|---|---|---|---|---|---|
| D1 | Recuperare il progetto Android nativo | 🔴 | D | — | — | — |
| D2 | Modello di vendita: a pagamento o gratuita + Pro | 🟠 | D | — | — | — |
| D3 | Fornitore meteo | 🔴 | D | — | — | — |
| D4 | Fonte delle festività | 🟠 | D | — | — | — |
| D5 | Nome e identificativo definitivi dell'app | 🟠 | D | — | — | — |
| D6 | Tipo di account sviluppatore Google Play | 🟠 | D | — | — | — |
| D7 | Dati nel backup cloud di Android: sì o no | 🟡 | D | — | — | — |
| 1.1 | Sincronizzazione QR con codice di verifica e conferma | ✅ fatto v55 | 1 | pagina | M | — |
| 1.2 | Backup esportato cifrato con password | ✅ fatto v55 | 1 | pagina | M | — |
| 1.3 | Ripristino: lista bianca delle impostazioni | ✅ fatto v55 | 1 | pagina | S | — |
| 1.4 | Rimuovere il vecchio gestore di import | ✅ fatto v55 | 1 | pagina | S | — |
| 1.5 | Provenienza visibile degli eventi da calendari collegati | ✅ già presente (verificato v55) | 1 | pagina | S | — |
| 1.6 | Meteo con MET Norway (Open-Meteo opzionale) | ✅ fatto v55 | 1 | pagina | M | D3 |
| 1.7 | Festività offline per tutti i paesi dei 20 mercati | ✅ fatto v55 | 1 | pagina | L | D4 |
| 1.8 | Geocodifica senza Nominatim (parte pagina) | ✅ fatto v55 | 1 | pagina | S | 2.6 |
| 1.9 | Restringere la CSP agli host necessari | ✅ fatto v55 | 1 | pagina + build | S | D3, D4, 1.8 |
| 1.10 | Informative in-app prima dei permessi | ✅ fatto v55 | 1 | pagina | M | — |
| 1.11 | Privacy policy in 20 lingue (bozza) | ✅ bozza v55 (da far rileggere) | 1 | documenti | M | D3, D4, D7 |
| 1.12 | Icona neutra per il calendario Minguo | 🟡 | 1 | pagina | S | — |
| 1.13 | Dizionari caricati solo per la lingua in uso | 🟡 | 1 | pagina + build | M | — |
| 1.14 | Opzione «testo grande» | 🟡 | 1 | pagina | M | — |
| 1.15 | Test automatici di sicurezza nel collaudo | ✅ fatto v55 | 1 | build | M | — |
| 2.1 | Progetto Android nel repository, build riproducibile | ✅ ricostruito (da collaudare in Android Studio) | 2 | nativo | M | D1 |
| 2.2 | Ponte nativo: inventario dei metodi esposti (rettifica: `loadUrl`/`finish` NON sono esposti) | ✅ verificato | 2 | nativo | S | 2.1 |
| 2.3 | Codifica di ogni valore passato alla pagina, Intent verificati | ✅ | 2 | nativo | M | 2.1 |
| 2.4 | Impostazioni WebView e filtro dei link esterni | ✅ | 2 | nativo | S | 2.1 |
| 2.5 | Download sicuri: redirect, host privati, dimensione | ✅ | 2 | nativo | S | 2.1 |
| 2.6 | Geocoder di Android nel ponte nativo | ✅ | 2 | nativo | S | 2.1 |
| 2.7 | Dettatura: preferire il riconoscimento sul telefono | 🟡 | 2 | nativo + pagina | S | 2.1 |
| 2.8 | Porting a target API 36 (Android 16) | 🟠 codice fatto, collaudo su dispositivi da fare | 2 | nativo + pagina | L | 2.1 |
| 2.9 | Acquisti in-app con Play Billing (solo se Pro) | 🟠 | 2 | nativo + pagina | L | D2, 2.1 |
| 2.10 | Test minimi della parte nativa | 🟡 | 2 | nativo | M | 2.1 |
| 3.1 | Verifica del livello API richiesto al momento | 🔴 | 3 | nativo | S | 2.8 |
| 3.2 | Formato Android App Bundle (.aab) | 🔴 | 3 | nativo + build | S | 2.1 |
| 3.3 | Chiave di caricamento e Play App Signing | 🔴 | 3 | console | S | D6 |
| 3.4 | Build di rilascio verificata | 🔴 | 3 | nativo | S | 3.2 |
| 3.5 | Riconferma dei termini dei servizi di terzi | 🟠 | 3 | documenti | S | 1.6, 1.7, 1.8 |
| 3.6 | Privacy policy pubblicata e moduli del Play Console | 🔴 | 3 | console + documenti | M | 1.11 |
| 3.7 | Scheda del negozio in 20 lingue | 🔴 | 3 | console | M | D5 |
| 3.8 | Profilo pagamenti, prezzi e paesi | 🔴 | 3 | console | S | D2 |
| 3.9 | Test chiuso obbligatorio (account personali) | 🔴 | 3 | console | 14+ giorni | D6, 3.2 |
| 3.10 | Marchio: deposito | 🟡 | 3 | — | — | D5 |
| 3.11 | Rilascio graduale e canale di contatto | 🟡 | 3 | console | S | — |
| 4.1 | Aggiornamento annuale del livello API | 🔴 | 4 | nativo | M | — |
| 4.2 | Cifratura degli archivi e blocco con biometria | 🟡 | 4 | nativo + pagina | L | 2.1 |
| 4.3 | Archivio fuori da `localStorage` | 🟡 | 4 | pagina + nativo | L | 2.1 |
| 4.4 | Play Integrity contro APK ripubblicati | 🟡 | 4 | nativo | M | — |
| 4.5 | Analisi di libertà d'uso brevettuale (USA) | 🟡 | 4 | studio legale | — | ricavi |
| 4.6 | Monitoraggio: errori, recensioni, consumi | 🟡 | 4 | console | continuo | — |

### Percorso critico

```
D1 progetto Android ──► 2.1 ──► 2.2–2.8 sicurezza + API 36 ──► 3.2 AAB ──► 3.9 test chiuso (≥14 giorni) ──► produzione
D3/D4/D7 decisioni ──► 1.6/1.7 ──► 1.11 privacy policy ──► 3.6 moduli Play Console ─────────┘
D6 account ──────────────────────────────────────────────► 3.3 firma + 3.9 test chiuso ────────┘
```

Senza **D1** nessuna versione può andare sul Play Store: oggi è l'unico blocco
che non dipende da me. Tutta la Fase 1 può partire anche senza.

---

## 2. Fase D — Decisioni e materiali (da te)

### D1 · Recuperare il progetto Android nativo 🔴
- **Cosa serve**: la cartella del progetto Android Studio da cui è nato l'APK v53
  (file Java, `build.gradle`, risorse del widget, layout). Nel repository c'è solo l'APK.
- **Perché**: senza sorgente non si può produrre l'AAB, alzare il livello API, né
  correggere le falle del ponte nativo (Fase 2).
- **Se il sorgente è perso**: si può ricostruire per decompilazione dell'APK
  (risultato leggibile ma non identico, da ricollaudare tutto). Impegno L.

### D2 · Modello di vendita 🟠
- **Opzione A — app a pagamento**: nessun codice in più. Non vendibile in alcuni
  paesi (in quelli si può solo pubblicare gratis). Niente prova gratuita.
- **Opzione B — gratuita + «Pro» con acquisto in-app**: serve Play Billing (2.9),
  disponibile in più paesi, permette la prova. Più lavoro.
- **Consiglio**: B se punti a tutto il mondo e a molti download; A se vuoi partire
  presto con poco lavoro.

### D3 · Fornitore meteo 🔴
- **MET Norway (consigliato)**: gratuito anche per uso commerciale, senza chiave,
  attribuzione «Data from MET Norway». Previsioni fino a ~10 giorni.
- **Open-Meteo commerciale**: circa 350 $/anno. Attenzione: la chiave andrebbe
  inserita nell'app ed è estraibile da chiunque scarichi l'APK, con rischio di abuso
  della tua quota. Andrebbe comunque monitorata.
- Il campo «Chiave API Open-Meteo» già presente resta come opzione avanzata.

### D4 · Fonte delle festività 🟠
- **Solo offline (consigliato)**: regole nell'app per tutti i paesi dei 20 mercati,
  nessuna chiamata di rete, nessun vincolo.
- **Nager.Date**: termini commerciali dell'API pubblica non chiari (possibile
  sponsorizzazione). Da tenere solo come aggiornamento facoltativo, o eliminare.

### D5 · Nome e identificativo definitivi 🟠
- Ricerca di anteriorità del marchio «Kalend» (EUIPO/TMview, USPTO, WIPO, negozi
  di app). Se il nome cambia, va deciso **prima** della scheda negozio e della
  privacy policy.
- L'identificativo del pacchetto (`app.kalend`) **non si può più cambiare dopo il
  primo caricamento**: confermalo ora.

### D6 · Account sviluppatore Google Play 🟠
- **Personale**: per gli account personali recenti Google impone un **test chiuso
  con almeno 12 tester per 14 giorni consecutivi** prima della produzione (3.9).
  Il numero di tester è da riconfermare sul Play Console al momento.
- **Organizzazione**: richiede numero D-U-N-S e verifica dell'azienda, ma non il
  test chiuso obbligatorio.
- Decidere presto: la verifica dell'identità richiede giorni.

### D7 · Dati nel backup cloud di Android 🟡
- **Sì (oggi)**: l'utente ritrova gli eventi cambiando telefono. I dati vanno nel
  backup Google, cifrato col blocco schermo, ma fuori dal controllo dell'app.
- **No**: più privato, ma l'utente deve fare i backup a mano.
- In entrambi i casi va scritto nella privacy policy e nella sezione Data safety.

---

## 3. Fase 1 — Subito, nella pagina web

Si possono iniziare **oggi**, senza sorgente nativo e senza impegno a pubblicare.
Ogni intervento passa da `node tools/build.js`, dal collaudo nelle 20 lingue e da
un APK di prova firmato con la chiave temporanea.

Partono senza attendere nulla: **1.1, 1.2, 1.3, 1.4, 1.5, 1.10, 1.12, 1.13, 1.14, 1.15**.
Attendono una decisione: 1.6 (D3), 1.7 (D4), 1.9 (D3, D4), 1.11 (D3, D4, D7).

### 1.1 · Sincronizzazione QR con codice di verifica e conferma 🔴
- **Problema**: chi inquadra un QR finto nella stessa Wi-Fi invia tutto il proprio
  calendario a uno sconosciuto, senza alcuna domanda. Al contrario, il tablet
  accetta dati da chiunque risponda.
- **Cosa fare**: codice di 6 cifre ricavato dalle impronte di cifratura dei due
  dispositivi, mostrato su entrambi gli schermi; domanda «Inviare il calendario a
  questo dispositivo?» prima del primo invio; QR valido 2 minuti; dispositivi già
  abbinati ricordati; non salvare più il QR (`LS_LAST`); non inviare coordinate di casa.
- **Dove**: script della sincronizzazione QR in `src/index.html`. **Impegno**: M.
- **Fatto quando**: un QR non confermato non riceve nessun dato; il collaudo con un
  secondo browser simula l'attacco e fallisce.

### 1.2 · Backup esportato cifrato con password 🔴
- **Problema**: il file di backup è in chiaro e contiene tutto il calendario, le
  coordinate di casa e la chiave API. Va in chat, e-mail, cloud.
- **Cosa fare**: alla richiesta di esportazione, proporre una password (cifratura
  AES-256-GCM, chiave derivata con PBKDF2 a 600.000 iterazioni, tutto nel telefono).
  Senza password: esportare senza dati di posizione né chiavi, con avviso.
  L'import riconosce i due formati; i backup vecchi restano leggibili.
- **Dove**: pagina. **Impegno**: M.
- **Fatto quando**: il file cifrato non contiene testo leggibile; password errata
  dà un messaggio chiaro; il ripristino ricostruisce lo stato identico.

### 1.3 · Ripristino: lista bianca delle impostazioni 🟠
- **Problema**: un backup preparato ad arte può cambiare in silenzio posizione di
  casa, paese, lingua, chiave API, festività.
- **Cosa fare**: accettare solo le impostazioni note, ognuna con tipo e intervallo
  ammessi; mostrare nel riepilogo prima del ripristino se il file cambia località o chiave.
- **Dove**: `writeBackup` in `src/index.html`. **Impegno**: S.
- **Fatto quando**: un backup con chiavi sconosciute o valori fuori intervallo le scarta.

### 1.4 · Rimuovere il vecchio gestore di import 🟠
- **Problema**: il gestore storico scrive il file senza alcun filtro. Oggi è
  scavalcato da quello nuovo, ma tornerebbe attivo se quello nuovo non partisse.
- **Cosa fare**: eliminarlo; tenere solo la versione verificata.
- **Dove**: pagina. **Impegno**: S.
- **Fatto quando**: esiste un solo ascoltatore sul selettore di file.

### 1.5 · Provenienza visibile degli eventi da calendari collegati 🟡
- **Problema**: un calendario collegato compromesso può inserire appuntamenti falsi
  (es. «chiama la banca al numero…») indistinguibili dai propri.
- **Cosa fare**: etichetta col nome del calendario d'origine nel dettaglio evento;
  niente auto-tag e niente promemoria automatici per gli eventi esterni finché
  l'utente non li attiva per quel calendario.
- **Dove**: pagina. **Impegno**: S.

### 1.6 · Meteo con MET Norway 🔴 (dopo D3)
- **Problema**: Open-Meteo gratuito vieta l'uso commerciale.
- **Cosa fare**: modulo nuovo che legge le previsioni da `api.met.no`, converte i
  simboli meteo in quelli dell'app, aggiunge l'attribuzione. Open-Meteo resta solo
  con chiave inserita dall'utente. Storico meteo (date passate): verificare se
  serve, perché MET Norway non lo offre.
- **Dove**: `src/modules/`. **Impegno**: M.
- **Fatto quando**: l'app senza chiave non contatta più Open-Meteo; meteo, cielo e
  icone funzionano in tutte le viste.

### 1.7 · Festività offline per tutti i paesi dei 20 mercati 🟠 (dopo D4)
- **Cosa fare**: completare le regole offline (fisse, mobili, lunari, islamiche,
  ebraiche) per ogni paese dove si parla una delle 20 lingue; Nager.Date eliminato o
  facoltativo.
- **Dove**: `src/modules/30-calendars.js`. **Impegno**: L.
- **Fatto quando**: per ogni paese l'elenco coincide con una fonte ufficiale per
  2026 e 2027.

### 1.8 · Geocodifica senza Nominatim — parte pagina 🟠
- **Problema**: il server pubblico Nominatim ammette 1 richiesta al secondo per
  l'intera app, somma di tutti gli utenti.
- **Cosa fare**: usare il Geocoder di Android tramite il ponte (2.6); nel browser
  ripiego su Photon. Ricordare i luoghi già cercati sul telefono.
- **Dove**: pagina. **Impegno**: S. Si completa con 2.6.

### 1.9 · Restringere la CSP agli host necessari 🟠 (dopo D3, D4, 1.8)
- **Problema**: oggi la pagina può collegarsi a qualunque host https: se mai
  entrasse uno script ostile, l'invio dei dati sarebbe immediato.
- **Cosa fare**: nella build per Android elencare solo gli host usati (meteo,
  geocodifica, eventuali festività). I calendari collegati passano già dal nativo.
  La build per il browser mantiene `https:`.
- **Dove**: `tools/build.js` con opzione `--android`. **Impegno**: S.

### 1.10 · Informative in-app prima dei permessi 🟠
- **Cosa fare**: schermata breve, tradotta, **prima** della richiesta di sistema per
  posizione, microfono, calendario del telefono e notifiche: cosa serve, a cosa,
  cosa esce dal telefono. Richiesto dalle regole di Google Play per i dati sensibili.
- **Dove**: pagina. **Impegno**: M.

### 1.11 · Privacy policy in 20 lingue — bozza 🔴 (dopo D3, D4, D7)
- **Contenuto**: nessun account, nessuna pubblicità, nessun tracciamento; dati sul
  telefono; cosa riceve ogni servizio (posizione arrotondata a ~1 km, testo dei luoghi
  per la geocodifica, codice paese, link iCal dell'utente, audio della dettatura se
  il riconoscimento sul telefono non c'è); backup cloud (D7); come cancellare tutto;
  contatto. Coerente con GDPR, LGPD, APPI, PIPA, PDPA, DPDP, KVKK.
- **Dove**: `docs/privacy/` (pubblicazione in 3.6). **Impegno**: M.

### 1.12 · Icona neutra per il calendario Minguo 🟡
- Sostituire la bandiera 🇹🇼 nell'elenco dei calendari secondari con un simbolo neutro.
  **Impegno**: S.

### 1.13 · Dizionari caricati solo per la lingua in uso 🟡
- **Problema**: la pagina pesa 4,3 MB, di cui ~1,8 MB di traduzioni sempre caricate.
- **Cosa fare**: un file per lingua in `assets/www/i18n/`, caricato all'avvio; gli
  hash della CSP restano validi perché i file sono dati, non script.
- **Dove**: build + pagina. **Impegno**: M.
- **Fatto quando**: pagina sotto 2,7 MB; cambio lingua senza riavvio.

### 1.14 · Opzione «testo grande» 🟡
- Testi del mese oggi a 7–8 px: sotto le linee guida di accessibilità. Opzione che
  li ingrandisce senza rompere la griglia. **Impegno**: M.

### 1.15 · Test automatici di sicurezza 🟠
- Aggiungere al collaudo: file di import ostili (prototipo, caratteri invisibili,
  dimensioni), backup con impostazioni manipolate, sincronizzazione da un peer non
  confermato, campi con HTML/JS in tutte le viste.
- **Dove**: `tools/`. **Impegno**: M.
- **Fatto quando**: un comando unico esegue tutto e fallisce se una protezione si rompe.

---

## 4. Fase 2 — Subito dopo aver avuto il sorgente nativo

Sono **correzioni di sicurezza e lavoro tecnico** che servono comunque, anche prima
di decidere la data di pubblicazione. Il porting all'API 36 sta qui, e non in Fase 3,
perché cambia il comportamento dell'app e richiede settimane di collaudo.

### 2.1 · Progetto Android nel repository ✅ (ricostruito)
- Cartella `android-src/` con build Gradle; stessa funzionalità della v53; la pagina
  costruita da `tools/build.js` copiata negli asset dal task `copyWeb`.
- **Stato**: il sorgente originale non c'era, il progetto è stato **ricostruito per
  decompilazione** dell'APK v53 e riscritto in Java commentato (vedi
  `android-src/README-NATIVO.md`). Compila contro le classi del framework API 36
  (`tools/native-check.sh`); l'APK/AAB va prodotto in Android Studio e **ricollaudato
  su un telefono reale** (widget, promemoria, dettatura, calendario, condivisione).

### 2.2 · Ponte nativo: inventario dei metodi esposti ✅ (rettifica)
- La lettura dell'elenco dei metodi della classe `MainActivity$Bridge` nel dex mostra
  che `loadUrl` e `finish` **non** sono esposti alla pagina: le stringhe trovate in
  precedenza erano chiamate interne. Il bridge espone i metodi usati dalla pagina più
  `exactAlarms`, `vaultHas`, `version`. Nessun intervento necessario.

### 2.3 · Valori passati alla pagina sempre codificati, Intent verificati ✅
- **Problema**: il nativo costruisce comandi JavaScript con date, modalità, testi e
  risposte di rete. L'Activity principale e i ricevitori del widget sono raggiungibili
  da altre app. Se un valore non è codificato, un'app malevola ottiene tutto il calendario.
- **Cosa fare**: ogni valore passato con `JSONObject.quote`; date validate
  (`AAAA-MM-GG`), modalità da elenco chiuso; extra accettati solo dai propri
  PendingIntent (codice segreto generato all'installazione); azioni del widget
  protette dal controllo del mittente.
- **Fatto quando**: un'app di prova che invia Intent costruiti non esegue nulla.
- **Stato**: in `MainActivity.handleIntent` date, id evento e nomi lista passano
  solo se rispettano l'espressione regolare, ogni testo è codificato con
  `JSONObject.quote`, gli avvisi richiedono il token `alert_tok`.

### 2.4 · Impostazioni WebView e link esterni ✅
- Debug della WebView attivo **solo** nelle build di debug; `setAllowFileAccess(false)`,
  `setAllowContentAccess(false)`, Safe Browsing attivo; navigazione bloccata fuori da
  `appassets.androidplatform.net` e `kalend://`; `openUrl` accetta solo `https://`
  (mai `intent:`, `javascript:`, `file:`).
- **Stato**: fatto in `MainActivity` (debug WebView solo con `BuildConfig.DEBUG`;
  `openExternal` accetta https/http/mailto/tel/geo).

### 2.5 · Download sicuri ✅
- Massimo 3 redirect, solo `https`, stesso filtro della pagina sugli indirizzi
  privati e locali (anche dopo la risoluzione del nome), interruzione oltre 15 MB
  durante lo scaricamento, tempi massimi di connessione e lettura.
- **Fatto quando**: un link che rimanda a `192.168.x.x` o a un file enorme viene rifiutato.
- **Stato**: `Net.fetchPublic` (solo https, controllo degli indirizzi privati dopo la
  risoluzione DNS, 5 redirect, 8 MB, tempi massimi, User-Agent con contatto).

### 2.6 · Geocoder di Android nel ponte ✅
- Nuovo metodo `geocode(id, testo, lingua)` che usa il servizio di sistema
  (`Geo.java`); completa 1.8. La pagina lo usa già come terzo strato.

### 2.7 · Dettatura sul telefono 🟡
- L'app già usa il riconoscimento sul dispositivo quando c'è. Dove manca, il
  servizio di sistema può inviare l'audio a Google: mostrarlo nell'informativa
  (1.10) e scriverlo in Data safety.

### 2.8 · Porting a target API 36 (Android 16) 🟠 (codice fatto, collaudo da fare)
- Requisito Google Play dal 31 agosto 2026 per app nuove e aggiornamenti.
- **Stato**: `targetSdk 36`, margini di sistema applicati alla WebView, gesto
  «indietro» con `OnBackInvokedCallback` (la pagina risponde con `kalendBack()`),
  `enableOnBackInvokedCallback` nel manifest. Resta il collaudo sui dispositivi.
- Punti da collaudare per un'app WebView:
  - **schermo intero obbligatorio** («edge-to-edge»): la pagina deve rispettare
    barre di stato e di navigazione (margini sicuri);
  - **gesto «indietro» predittivo**: il vecchio aggancio al tasto indietro non viene
    più chiamato, va rifatto con il nuovo sistema per non chiudere l'app per errore;
  - **schermi grandi**: su tablet i blocchi di orientamento e dimensione vengono
    ignorati, va verificato il layout;
  - notifiche, allarmi esatti, riavvio del telefono, widget.
- **Impegno**: L, con collaudo su almeno un telefono e un tablet reali.

### 2.9 · Acquisti in-app con Play Billing 🟠 (solo se D2 = B)
- Libreria Google Play Billing nel nativo, verifica dell'acquisto, sblocco delle
  funzioni Pro nella pagina, ripristino degli acquisti.

### 2.10 · Test minimi della parte nativa 🟡
- Ponte, Intent, promemoria, widget: test automatici di base per evitare regressioni.

---

## 5. Fase 3 — Poco prima della pubblicazione

Da fare **una volta deciso di pubblicare**, idealmente nelle ultime 3–4 settimane.
Ordine consigliato: 3.1 → 3.2 → 3.3 → 3.4 → 3.9 (che dura almeno 14 giorni) e, in
parallelo, 3.5–3.8 e 3.10.

### 3.1 · Verifica del livello API richiesto 🔴
- Il requisito sale ogni anno, di solito a fine agosto. Se la pubblicazione slitta
  oltre agosto 2027 servirà probabilmente l'API 37: ricontrollare la pagina ufficiale.

### 3.2 · Formato Android App Bundle (.aab) 🔴
- Per le app nuove Google Play accetta solo AAB. Gli APK di prova restano per il
  collaudo e per la distribuzione fuori negozio. Si fa qui perché senza firma
  definitiva l'AAB non serve.

### 3.3 · Chiave di caricamento e Play App Signing 🔴 · irreversibile
- Creare la chiave di caricamento (keystore), conservarla in due posti sicuri e
  separati; attivare Play App Signing (Google custodisce la chiave dell'app e
  firma con gli schemi moderni, rotazione inclusa).
- La chiave di prova di questo repository **non va mai usata**.

### 3.4 · Build di rilascio verificata 🔴
- `debuggable` falso; debug WebView spento; strumenti di collaudo esclusi;
  `versionCode` crescente (regola: un numero in più a ogni caricamento);
  `versionName` leggibile (es. «1.0»); applicazione di D5 (nome e identificativo).
- **Fatto quando**: l'AAB installato da un canale di test passa il collaudo completo.

### 3.5 · Riconferma dei termini dei servizi di terzi 🟠
- Le pagine ufficiali di MET Norway, Open-Meteo, OpenStreetMap, Nager.Date e
  Google non erano raggiungibili dalla sessione di analisi: rileggerle e salvarne
  copia con data nel repository.

### 3.6 · Privacy policy pubblicata e moduli del Play Console 🔴
- Pubblicare la bozza 1.11 su un indirizzo pubblico (GitHub Pages di questo repository).
- Compilare: **Data safety**, **dichiarazione `USE_EXACT_ALARM`** (calendario con
  notifiche degli eventi), permessi sensibili (posizione, microfono, calendario),
  **questionario sui contenuti**, **pubblico di destinazione** (adulti, non «famiglie»),
  dichiarazione pubblicità (nessuna).

### 3.7 · Scheda del negozio in 20 lingue 🔴
- Titolo, descrizione breve e lunga, screenshot di telefono e tablet per lingua,
  icona 512 px, grafica 1024×500. I testi dell'app sono già tradotti: le descrizioni
  vanno scritte e fatte rileggere da madrelingua almeno per i mercati principali.

### 3.8 · Profilo pagamenti, prezzi e paesi 🔴
- Profilo pagamenti Google; prezzi per paese (o prodotti in-app se D2 = B);
  scelta dei paesi; verifica dei paesi in cui le app a pagamento non sono vendibili.

### 3.9 · Test chiuso obbligatorio 🔴 · almeno 14 giorni
- Per gli account personali recenti: almeno 12 tester attivi per 14 giorni
  consecutivi prima di poter chiedere la produzione. Va avviato appena l'AAB è
  stabile: è il passaggio più lungo della Fase 3.

### 3.10 · Marchio 🟡
- Se D5 conferma il nome e il budget lo consente, deposito del marchio (UE con
  EUIPO, estensione internazionale con WIPO) prima del lancio pubblico.

### 3.11 · Rilascio graduale e canale di contatto 🟡
- Pubblicazione progressiva (es. 10% → 50% → 100%); indirizzo e-mail di supporto e
  per le segnalazioni di sicurezza indicato nella scheda e nella privacy policy.

---

## 6. Fase 4 — Dopo la pubblicazione

| ID | Intervento | Quando |
|---|---|---|
| 4.1 | Aggiornare il target API al nuovo requisito | Ogni anno, entro fine agosto |
| 4.2 | Cifratura di eventi, catene, attività e copie automatiche con chiave hardware; blocco dell'app con impronta o PIN | Con la prima versione Pro o su richiesta degli utenti |
| 4.3 | Spostare gli archivi da `localStorage` (limite 5–10 MB) a IndexedDB o archivio nativo | Quando un utente supera qualche migliaio di eventi |
| 4.4 | Play Integrity contro copie ripubblicate o modificate | Se compaiono copie piratate |
| 4.5 | Analisi brevettuale di libertà d'uso per gli USA | Se i ricavi diventano rilevanti |
| 4.6 | Monitoraggio di errori, ANR, recensioni per lingua, consumo dei servizi | Continuo |

---

## 7. Correzioni rispetto ai report precedenti

Unendo i due report e ricontrollando il codice sono emerse cinque differenze.
Vale quanto scritto qui.

| Punto | Prima | Corretto |
|---|---|---|
| Origine della pagina | Report Play: caricata da `file:///android_asset` | È servita da `https://appassets.androidplatform.net` (più sicuro). Restano da verificare i flag di 2.4. |
| Screenshot e app recenti | Report sicurezza: protezione assente | Esiste già l'opzione «Privacy» nelle impostazioni (Dati), **spenta di default**. Da valutare se proporla al primo avvio. |
| Notifiche sul blocco schermo | Report sicurezza: titolo visibile | Esiste già una prova «la leggi solo dopo lo sblocco»: il nativo gestisce la privacy delle notifiche. Da riconfermare nel sorgente. |
| Sincronizzazione QR | Report Play: 🟢 | 🔴: manca l'autenticazione del dispositivo remoto (1.1). |
| Dettatura | Report Play: «nessun invio ad altri server» | Sul dispositivo quando disponibile; altrimenti il servizio di sistema può inviare l'audio a Google (2.7). |

---

## 8. Cosa è già a posto e non va toccato

- Nessuna backdoor, telemetria, pubblicità, libreria o font esterno.
- Pulizia profonda di ogni dato in ingresso con limiti di dimensione e numero.
- Copia di sicurezza automatica prima di import, ripristini, eliminazioni di massa,
  sincronizzazione; pulsante «Annulla».
- CSP con hash per ogni script, niente `eval`, niente traffico in chiaro.
- Link segreti dei calendari cifrati con chiave hardware ed esclusi da backup e sincronizzazione.
- Coordinate arrotondate a ~1 km verso il meteo.
- Licenze di font, musiche e dati compatibili con la vendita.
- 20 lingue complete, parser e auto-tag multilingue, calendari secondari, widget.

---

## 9. Proposta di avvio

1. **Oggi, senza attendere nulla**: blocco sicurezza della pagina, cioè 1.1, 1.2,
   1.3, 1.4, 1.5 e 1.15, in un'unica versione v55 con APK di prova.
2. **Appena prendi le decisioni D3, D4, D7**: 1.6, 1.7, 1.9, 1.11.
3. **In parallelo, dal tuo lato**: recuperare il progetto Android (D1), scegliere il
   tipo di account (D6) e avviare la ricerca sul marchio (D5).
4. **Con il progetto Android**: tutta la Fase 2, poi la Fase 3 quando fissi la data.
