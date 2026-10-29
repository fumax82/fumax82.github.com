# Kalend v55 — cosa è cambiato e perché

## 1. Meteo per tutto il mondo, senza vincoli commerciali
Fino alla v54 il meteo arrivava da Open‑Meteo, gratuito solo per uso non
commerciale. Ora (`src/modules/70-weather.js`):

* **Di serie: MET Norway.** Istituto meteorologico norvegese, copertura mondiale
  (modello europeo ECMWF), nessuna chiave, uso commerciale ammesso (NLOD 2.0 /
  CC BY 4.0). Circa 10 giorni. Attribuzione «Data from MET Norway» nei crediti.
* **Con la tua chiave: Open‑Meteo o OpenWeatherMap.** Chi vuole 16 giorni e più
  modelli, o preferisce OpenWeatherMap (piano gratuito con registrazione), crea
  da solo l'account presso il fornitore e incolla la chiave in Impostazioni →
  Funzionalità → Fonte del meteo. Prima di attivarla accetta la dicitura: servizio
  di terzi, a loro termini e costi, Kalend non ne è parte. La chiave sta **cifrata
  nel telefono** (AES‑256‑GCM, chiave non estraibile) e non entra mai in backup,
  esportazioni o sincronizzazione.
* **Nessun meteo.** Cielo, sole e luna calcolati nel telefono: niente esce dal telefono.
* **Cambio di fonte senza perdere nulla**: ogni fornitore viene tradotto nello
  stesso modello interno (codici WMO, temperatura, pioggia, nuvole, vento), quindi
  icone, cielo vivo e particelle restano identici.
* **Cache persistente e storico visto**: una richiesta per luogo copre ~10 giorni
  e si salva in IndexedDB; i giorni passati (fino a 60) mostrano l'ultima
  previsione vista. Richieste in coda, una alla volta, coordinate a ~1 km.
* **Chiave rifiutata o quota finita** → per quella sessione si torna alla base e lo
  si dice una volta. **Senza rete** → ultima previsione in cache, poi solo cielo.
* **Unità per paese**: °F negli USA, Bahamas, Belize, Cayman, Liberia, Palau,
  Micronesia, Isole Marshall; scelta manuale °C/°F nelle impostazioni.
* La chiave Open‑Meteo eventualmente inserita nella v54 viene spostata
  automaticamente nella cassaforte e tolta dalle impostazioni.

Collaudo: `node Kalend/tools/wx-test.js` (risposte simulate dei tre fornitori:
forma dei dati, cache, chiave rifiutata, cassaforte, unità, crediti, migrazione).
**Limite**: la rete di sviluppo non raggiunge i server veri; al primo avvio sul
telefono verificare che MET Norway risponda (la scheda meteo mostra la fonte).

## 2. Luoghi: la maggior parte delle ricerche non esce dal telefono
Un luogo scritto diventa coordinate passando per strati, dal più economico
(`src/modules/80-geo.js`):

1. **coordinate scritte** («45.46, 9.19»);
2. **memoria**: i luoghi già risolti restano nel telefono (400 voci);
3. **atlante offline**: ~24.000 città del mondo con almeno 15.000 abitanti
   (`www/data/cities.json`, da GeoNames CC BY 4.0, generato da
   `tools/build-atlas.py`): «Milan», «Paris, Francia», «Springfield, US» (la più
   popolosa), accenti e maiuscole ignorati; l'autocompletamento propone le città
   per prefisso, ordinate per abitanti, senza rete. I nomi sono in inglese: un
   nome locale («Milano», «東京») passa una volta dalla rete e poi resta in memoria;
4. **Geocoder di Android** tramite il ponte nativo (metodo `geocode`, da aggiungere
   nella Fase 2);
5. **chiave personale** dell'utente, se ha scelto Open‑Meteo o OpenWeatherMap per
   il meteo (la loro geocodifica è inclusa);
6. **Photon** (komoot, dati OpenStreetMap, ODbL) per gli indirizzi: senza chiave,
   «uso corretto», poche richieste grazie agli strati precedenti.

Nominatim e Open‑Meteo gratuito non vengono più interrogati. Crediti aggiornati.
Collaudo: `node Kalend/tools/geo-test.js`.

## 3. Festività: tutte nel telefono, indicative, personalizzabili
Nager.Date non viene più interrogato (`src/modules/31-holidays.js`):

* regole per i paesi che mancavano: Filippine, Nigeria, Kenya, Ghana, Venezuela,
  Ecuador, Guatemala, Cuba, Bolivia, Rep. Dominicana, Honduras, Paraguay, El Salvador,
  Nicaragua, Costa Rica, Panama, Uruguay, Porto Rico, Monaco, Senegal, Costa d'Avorio,
  Tunisia, Algeria, Liechtenstein, Angola, Mozambico, Suriname, Bielorussia,
  Kazakistan, Iraq, Giordania, Libano, Kuwait, Qatar, Bahrein, Oman, Siria, Libia,
  Sudan, Yemen, Palestina, Macao; versioni migliorate per USA, Regno Unito, Irlanda,
  Giappone, Australia, Nuova Zelanda, Canada, Sudafrica, Hong Kong, India;
* **giorni sostitutivi**: USA (sabato→venerdì, domenica→lunedì), Regno Unito,
  Australia, Canada, Nuova Zelanda (fine settimana→primo feriale libero), Giappone
  振替休日, Sudafrica e Hong Kong (domenica→lunedì). La festa resta nel suo giorno e
  si aggiunge il sostitutivo;
* feste lunari, islamiche ed ebraiche calcolate (ora funzionano davvero: nella v54
  l'aggancio non raggiungeva il codice del sorgente storico); Diwali, Holi, Dussehra,
  Matariki da tabella ufficiale 2025–2032;
* scheda **Festività del paese** (Impostazioni → Lingua e paese): elenco dell'anno,
  tocca per nascondere o mostrare, aggiungi una festa propria, ripristina;
  dicitura «indicative: controlla le fonti ufficiali».

Collaudo: `node Kalend/tools/hol-test.js` (date note del 2026 per 20 paesi).

## 4. Testi legali, informative sui permessi, CSP
* **Termini d'uso e Informativa sulla privacy in 20 lingue** (`src/legal/*.json`):
  licenza, dati solo sul dispositivo, servizi di terzi a loro termini, natura
  indicativa delle informazioni, responsabilità nei limiti di legge, diritti dei
  consumatori, legge applicabile; privacy con l'elenco esatto di ciò che esce dal
  telefono e verso chi. I dati del venditore stanno in `src/legal/seller.json` e
  vengono inseriti al build. **Da far rileggere a un professionista.**
* Pagina **Informazioni legali** (Impostazioni → Aiuto): Termini, Privacy, Crediti
  (con le attribuzioni della fonte meteo e dei luoghi in uso).
* **Avviso una tantum** dopo l'aggiornamento dei testi, non bloccante.
* **Informative prima dei permessi** (posizione, microfono, calendario del telefono,
  notifiche): schermata breve nella lingua dell'app con cosa serve, a cosa e cosa
  esce dal telefono; «Non ora» non interroga il sistema. Valgono anche per la
  richiesta di posizione all'avvio e aspettano la chiusura del sipario di benvenuto.
* **Pagine web** `legal/privacy-<lingua>.html` e `terms-<lingua>.html`
  (`tools/build-legal.js`), da pubblicare per l'indirizzo richiesto da Google Play.
* **CSP ristretta**: la pagina può contattare solo gli host dei servizi (MET Norway,
  Open‑Meteo con chiave, OpenWeatherMap, Photon); `--web` per la versione browser.

Collaudo: `node Kalend/tools/legal-test.js`.

## 5. Sicurezza della pagina
* **Sincronizzazione QR autenticata**: certificato stabile per dispositivo, **codice di
  verifica a 6 cifre** uguale sui due schermi, conferma esplicita prima del primo invio
  (cellulare) e della prima ricezione (tablet), dispositivi accettati ricordati, QR
  valido 2 minuti, il cellulare ignora stati in arrivo, le coordinate di casa non
  viaggiano, il testo del QR non viene più salvato.
* **Backup cifrato con password** (AES‑256‑GCM, PBKDF2‑SHA256 600.000 iterazioni):
  all'esportazione si sceglie la password; senza password il file esce in chiaro ma
  senza posizione di casa, località predefinita e chiavi. L'import riconosce i due
  formati; i backup vecchi restano leggibili.
* **Lista bianca delle impostazioni** al ripristino: solo chiavi note con tipo e
  intervallo verificati; chiavi ignote, chiave API e festività scartate.
* **Vecchio gestore dell'import** (senza verifiche) rimosso dal sorgente.
* Gli eventi dei calendari collegati erano già marcati «🔒 evento di un calendario
  collegato» e non generano promemoria; invariato.

Collaudo: `node Kalend/tools/sec-test.js`.

## 6. Parte nativa ricostruita (Fase 2 del piano)
Il sorgente Android originale non era nel repository: è stato **ricostruito
dall'APK v53** e riscritto in Java pulito e commentato in `android-src/`
(guida: `android-src/README-NATIVO.md`). Rispetto alla v53:
* **target API 36** (obbligatorio su Google Play dal 31 agosto 2026): schermo
  intero gestito con i margini di sistema, gesto «indietro» con il nuovo
  `OnBackInvokedCallback`, nessuna libreria esterna;
* `User-Agent` con nome, versione e contatto (`Kalend/55.0 (Android; +contatto)`):
  MET Norway lo richiede per identificare l'app; il contatto si imposta con la
  variabile `KALEND_CONTACT` al momento del build;
* nuovo metodo `geocode(id, testo, lingua)` nel ponte, con il Geocoder del
  telefono, che risponde via `__knCb` con `[{name, display, lat, lon, …}]`: la
  pagina lo usa già come terzo strato della ricerca luoghi;
* ponte, Intent e download sicuri conservati (controllo `trusted()`, valori
  codificati con `JSONObject.quote`, token segreto per gli avvisi, solo https,
  indirizzi privati rifiutati, 8 MB massimo);
* firma di rilascio e AAB: fuori dal repository, con variabili d'ambiente.
L'APK/AAB definitivo va prodotto in Android Studio (qui non c'è l'SDK Android):
nel repository si verificano la compilazione del Java (`tools/native-check.sh`) e
i **56 test automatici** della parte nativa (`tools/native-test.sh`, gli stessi che
Android Studio esegue con *Run 'Tests in app'*): ponte, Intent, rete, liste del
widget, posticipi, manifest e impostazioni della WebView.
Rinforzi emersi dai test: i pulsanti del widget accettano solo azioni con il token
segreto dell'app (prima un'altra app poteva spuntare le voci delle liste); anche
`speech`, `vibrate` ed `exactAlarms` controllano la pagina fidata; la vibrazione è
limitata a 1 secondo; il controllo della pagina fidata è più stretto (nessuna
porta né credenziale nell'indirizzo).

## 7. Pagina più leggera, testo grande, dettatura trasparente
* **Dizionari per lingua** (1.13): la pagina incorpora solo italiano e inglese;
  le altre 19 lingue stanno in `www/i18n/<lingua>.json` (traduzioni, lessico del
  parser, auto-tag, cultura e testi legali) e la lingua in uso viene letta
  all'avvio da un caricatore in testa alla pagina. La pagina passa da 4,7 a
  2,7 MB. Se il file manca, l'interfaccia resta in inglese senza errori.
  L'APK e il progetto Android copiano la cartella `i18n/` negli asset.
* **Testo grande** (1.14): in Impostazioni › Aspetto, tre livelli (normale,
  grande, molto grande) per schede, giornata, liste, finestre e impostazioni;
  la griglia del mese resta com'è. Salvato in `kx_textsize_v1`, applicato
  prima del primo disegno (nessuno scatto all'avvio).
* **Dettatura** (2.7): quando il telefono non ha il riconoscimento locale, la
  finestra di dettatura lo dice («☁️ Riconoscimento tramite il servizio vocale
  del telefono») e, una volta sola, un avviso in 20 lingue spiega che l'audio
  può passare dal fornitore del servizio di sistema (testo in `src/legal/*.json`,
  chiave `disclose.speechCloud`). Da dichiarare anche in Data safety.
* **Parser in 20 lingue** (sezione 9 qui sotto): cifre di ogni alfabeto, date
  in ogni formato, motore rivisto in tre passaggi e banco di prova di 542 frasi.

## 8. Calendari nella giornata (personalizzazioni per calendario)
Aprendo una giornata, gli eventi dei vari calendari (i miei, quelli collegati
via iCal, quelli del telefono, le attività To Do) ora si distinguono e si
personalizzano senza toccare il calendario d'origine (modulo `45-daycal.js`):
* **barra dei calendari** in testa al dettaglio del giorno: un chip per ogni
  calendario presente, con colore, nome e numero di eventi. Un tocco lo
  nasconde o mostra nella giornata; una pressione lunga (o ⋯) apre la scheda;
* **scheda per calendario**: nome mostrato, colore (vale anche nella griglia),
  icona davanti al titolo, quali dettagli mostrare (luogo, descrizione, tag),
  barre compatte, **promemoria per gli eventi di quel calendario** (che di suo
  non ne hanno), nascondi nella giornata, azzera;
* **contrassegno di provenienza** sulle barre: 🔗 collegato, 📱 telefono, ☑ To Do.
Le preferenze stanno in `kx_calprefs_v1`, entrano nel backup completo
(sezione `calPrefs`, verificata al ripristino) e si applicano in memoria agli
eventi collegati (colore e promemoria) senza modificare i calendari esterni.
Collaudo: `node Kalend/tools/daycal-test.js` (12 controlli, tutti ok).

## 9. Compilazione automatica in 20 lingue: banco di prova e motore rivisto
Il parser in linguaggio naturale compila data, ora, luogo, persone, tag,
promemoria e ricorrenza partendo da una frase. Per garantirne la qualità in
tutte le lingue, senza conflitti fra lingue, ora esiste un **banco di prova**:
`tools/nl-suite/<lingua>.json` con 542 frasi naturali (18-37 per lingua, scritte
come le scriverebbe un madrelingua) e il risultato atteso di ciascuna, comprese
**prove di conflitto** (titoli che contengono parole-chiave di altre lingue:
«Comic Con», «Romeo i Julia», «In Time», «Da Vinci»…).
Risultato: **518 frasi su 542** superate (italiano 20/20); le 24 restanti sono
limiti noti, documentati con causa in `docs/PARSER-LIMITI.md` (generato da
`tools/nl-limits.js`). Tutto avviene sul dispositivo, senza servizi esterni.
Cosa è cambiato nel motore (`src/modules/10-lang-packs.js`):
* cifre di ogni alfabeto (٠-٩, ०-९, ০-৯, ๐-๙, １２) → 0-9; date ISO, «5.3.2026»,
  «05-03-2026», «2026年3月5日», «2027년 3월 5일», ordine giorno/mese della lingua;
* numeri a parole prima dei suffissi («八時半», «세 시»), «1時間前» non è un orario,
  «今晚10点» tiene il giorno; unità attaccate («3日後», «2주마다», «10 นาทีก่อน»);
* intervalli con sola «fino a» («9点到10点»), «15時〜16時», due orari di seguito;
  mezz'ora alla tedesca/polacca/russa («halb neun», «wpół do dziewiątej» = 8:30),
  «ocho y media», «ثمانية ونص», frazione prima dell'ora in hindi/bengalese («साढ़े 7»);
* ordinali del mese in ogni ordine («毎月第1月曜日», «हर महीने के पहले सोमवार»,
  «วันจันทร์แรกของเดือน»), ricorrenze quindicinali (`biweekly`), «2 settimane ごとに»;
* persone: parenti dopo «e», più nomi prima di «के साथ»/«ile», «和小雨、志强»,
  «e» fra nomi solo dopo «con» (così «Romeo i Julia» resta un titolo);
* luoghi con civico (giapponese, cinese, thai, turco «Bağdat Caddesi 10»), tipo di
  via originale conservato («calle Mayor 5», «ul. Długiej 5»), duali arabi/ebraici
  («أسبوعين» = 2 settimane), «fino a» solo davanti a date, «ogni» corto solo
  davanti a giorni/unità («по проекту» resta nel titolo);
* titoli: le parole scritte dall'utente non vengono mai tolte («In Time», «Da
  Vinci»), i #tag espliciti escludono i tag proposti, compleanni e anniversari
  in ogni lingua diventano eventi annuali di giornata intera (`birthday`);
* lessici di 19 lingue rivisti dagli agenti (forme declinate, suffissi turchi,
  posposizioni, varianti colloquiali) con nuove chiavi documentate in
  `src/i18n/SCHEMA.md`.

## 10. Interfaccia: barre di sistema, menu, orizzontale, viste, «wow»

**Barre del telefono e menu che si aprono sotto** (modulo `46-shell.js`, parte nativa
`MainActivity`): la pagina non si estende più sotto la barra di navigazione né sotto
la tastiera. La parte nativa riserva due strisce (in alto per stato e notch, in basso
per i tasti di sistema o la tastiera) e le colora come l'app; i menu non restano
quindi mai coperti. Un «gestore della pila» osserva i fogli e i pannelli che si
aprono e assegna a ciascuno un livello superiore a quello precedente: il secondo
menu aperto da un primo si apre sempre sopra, anche i messaggi a comparsa.

**Telefono in orizzontale** (`47-landscape.css`): il mese entra tutto nello schermo,
dall'alto: sei righe di settimane che si dividono l'altezza, celle più fitte, intestazione
compatta. Nessuna funzione sparisce (tocco, doppio tocco, pressione lunga, agenda
laterale, menu); la giornata espansa prende metà schermo, la finestra del giorno
diventa larga.

**Viste più utili** (`49-views.js/css`): nella settimana le barre mostrano, se c'è spazio,
orario completo, luogo, persone e tag, con il contrassegno di provenienza dei
calendari collegati; le intestazioni dei giorni hanno i pallini dei colori e il numero
degli eventi. Nel giorno, in fondo al pannello, una riga di azioni rapide (Libero,
Liste, Detta con la data già pronta, Riepilogo, Nuovo) e le ore libere della giornata.
Nell'anno, pallini colorati per gli eventi, festività in rosso, weekend evidenziati,
totale eventi per mese. Stringhe in `src/i18n/extra/v55-viste.json` (19 lingue).

**Mese e giornate espanse «wow»** (`48-wow.js/css`): chip degli eventi con luce e bordo
chiaro, numero in grassetto nei giorni con eventi, celle con un filo di rilievo. La
giornata espansa in verticale è più alta (circa un terzo dello schermo, massimo
330 px) così la scena ha spazio; all'apertura cielo, paesaggio e barre compaiono a
strati, una barra dopo l'altra. Prestazioni: solo trasformazioni e opacità, nessuna
animazione continua in più; tutto si spegne con «riduci movimento» del sistema o
con il cielo «statico» nelle impostazioni (classe `kx-fx-off`). Test: `tools/shell-test.js`.

## 11. Dettatura intelligente in 20 lingue (v56)

Due moduli nuovi, nessuna modifica al motore storico: `10-lang-packs.js` (le regole
per lingua) e `11-nl-smart.js` (lo strato «intelligente» che sta davanti a tutto).
La frase viene letta nella lingua in cui è stata detta o scritta e il parser compila
titolo, data, orari precisi, luogo, persone, tag, promemoria, priorità e descrizione.

**La lingua la capisce da sola.** Si può dettare in inglese con l'app in italiano, o
in tedesco con l'app in inglese: la frase viene riconosciuta dall'alfabeto e dalle
parole spia di ogni lingua (indice compatto generato dal build, `KX_DETECT`), poi il
dizionario di quella lingua viene caricato dal suo file solo quando serve. In caso di
dubbio resta la lingua dell'app. Nella scheda di dettatura ci sono i chip 🌐 per
scegliere la lingua del riconoscitore vocale (ricordate le ultime usate), l'anteprima
«capito finora» mentre si parla, e gli esempi del pacchetto della lingua; nelle
Impostazioni › Lingua c'è «Lingua della dettatura» (di serie: come l'app).

**Orari precisi, in ogni lingua.** «halb neun» (8:30), «setengah 8» (7:30),
«в половине девятого», «Viertel nach sechs», «quarter past six», «ten to nine»,
«à 8 heures et demie», «um 10 Uhr 30», «abends um 8», «por la tarde a las 4», «malam
jam 8», «ce soir à 8»; le 1–6 dette senza altro sono pomeriggio anche in cinese,
coreano e giapponese («三点半», «세 시», «3時»); le parole serali della frase
(«stasera», «Abendessen», «dinner») portano alla sera un orario del mattino detto
senza «di mattina».

**Comandi, luoghi, giorni, note, priorità** (nuove chiavi del lessico, documentate
in `src/i18n/SCHEMA.md`): «ricordami di…», «aggiungi in agenda…», «remind me to…»,
«〜を追加して» spariscono dal titolo (e «ricordami» mette l'avviso all'ora
dell'evento); «in palestra», «at the gym», «im Büro», «al bar Centrale», «at Luigi's
restaurant», «su Zoom», «in videochiamata» diventano il luogo; «il 15», «on the 5th»,
«am 15.», «dia 5» sono il prossimo giorno del mese; «… nota portare i documenti»
senza i due punti è la descrizione; «quando puoi», «no rush» abbassano la priorità,
«priorità alta», «high priority» la alzano; «un giorno prima», «la veille», «am
Vortag» sono un preavviso di 24 ore.

**Dettatura «a campi» in tutte le lingue.** L'aiuto della scheda vocale promette
«Titolo …, giorno …, inizio …, fine …, preavviso …, tag …, partecipanti …,
descrizione …»: prima funzionava solo in italiano; ora le parole dei campi di ogni
lingua (chiave `fields`) vengono tradotte, e ci sono anche «luogo …» e «priorità …».

**Limiti noti chiusi.** Dei 24 limiti documentati nella v55 ne restano aperti
pochissimi (`docs/PARSER-LIMITI.md`, rigenerato): congiunzione attaccata in arabo ed
ebraico («سارة وأحمد»), città con prefisso/suffisso in ebraico e bengalese
(«בירושלים», «ঢাকায়», tramite la chiave `cities`), indirizzi thai, «3天后», «15時〜16時»,
«Comic Con» non più una compagnia, «Mamma Mia» non più una persona, «Pociąg do
Gdańska» intero nel titolo, «dzień wcześniej».

**Collaudo.** Il banco di prova `tools/nl-suite/` è passato da 542 a oltre 800 frasi
in 20 lingue (anche il vietnamita), con casi «dettatura» per ogni lingua: comando
iniziale, luoghi comuni, giorno senza mese, note, priorità, campi, ricorrenze.

## Cosa NON è cambiato
Cielo vivo, parser di base, tag, calendari, widget: come nella v54, salvo quanto sopra.
