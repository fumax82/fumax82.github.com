# Kalend — Proposta per le prime modifiche strutturali

Data: 28 ottobre 2026 · Stato: **proposta, nessuna modifica applicata**.
Riguarda gli interventi 1.6, 1.7, 1.8, 1.9, 1.11 del [piano](PIANO-INTERVENTI.md),
più un criterio generale che vale per tutto il progetto: **il modello «senza
responsabilità»**.

Avvertenza: non sono un avvocato. Le indicazioni legali qui sotto sono il modo in
cui si **riduce al minimo** l'esposizione, con ciò che si sa dei termini pubblici
dei servizi e delle regole di Google Play; i testi finali (termini d'uso, privacy)
vanno fatti rileggere da un professionista prima della pubblicazione. Una garanzia
assoluta di «nessuno può chiedermi nulla» non esiste in nessun ordinamento; esiste
però un'architettura che lascia pochissimi appigli, ed è quella proposta qui.

---

## 1. Il principio: l'app è un **cliente**, mai un **intermediario**

Tutte le scelte seguono quattro regole. Se un'idea futura ne viola una, è sbagliata.

| Regola | Che cosa significa in pratica | Perché ti protegge |
|---|---|---|
| **R1 — Nessun server tuo** | Niente account, niente cloud Kalend, niente telemetria, niente proxy che inoltra richieste ai fornitori. I dati stanno sul telefono. | Non sei «titolare del trattamento» di nulla (GDPR e leggi simili), non puoi subire una violazione di dati, non hai obblighi da piattaforma, non hai costi che crescono con gli utenti. |
| **R2 — Nessuna chiave tua nell'app** | Nessuna chiave API incorporata nell'APK (è estraibile da chiunque, e il traffico abusivo lo pagheresti tu). I servizi usati «di serie» sono solo quelli **senza chiave e con licenza che ammette l'uso commerciale**. | Non sei cliente di nessun fornitore a pagamento: nessuna fattura, nessun contratto, nessun abuso addebitabile a te. |
| **R3 — Chiave personale = contratto tra utente e fornitore** | Chi vuole un servizio migliore crea **da solo** un account presso il fornitore, accetta **i loro** termini, paga **loro**, e incolla la chiave in Kalend. Kalend la custodisce cifrata nel telefono e la usa solo per le richieste di quell'utente. | Tu non vendi, non rivendi, non incassi, non consigli un fornitore specifico: sei fuori dal rapporto contrattuale. |
| **R4 — Tutto è «indicativo», nulla è «garantito»** | Meteo, festività, conversioni di calendario, cielo: dati informativi, con la fonte sempre visibile. Nei termini d'uso: fornito «così com'è», non per decisioni che riguardano sicurezza o salute. | Un utente non può sostenere di aver subito un danno affidandosi a un dato che l'app dichiara indicativo. |

Due conseguenze pratiche di R1–R3 che vanno dette subito perché toccano l'app di oggi:

* la chiave Open‑Meteo aggiunta nella v54 è salvata nelle impostazioni e **finisce nel
  backup esportato**: va spostata nella cassaforte cifrata (dove stanno già i link
  iCal) ed esclusa da backup e sincronizzazione;
* i 16 giorni di previsione e la geocodifica di oggi passano da Open‑Meteo gratuito,
  che **vieta l'uso commerciale**: con la vendita dell'app vanno sostituiti (sezione 2).

---

## 2. Meteo: la soluzione proposta

### 2.1 Come l'app usa il meteo oggi (misurato nel codice)

| Uso | Richiesta attuale | Serve davvero |
|---|---|---|
| Cielo vivo e scheda «adesso» per casa | Condizioni attuali + 7 giorni | Sì, è la funzione «wow» |
| Meteo del giorno e degli eventi con luogo | Orario (stato, temperatura, probabilità e quantità di pioggia, nuvole, vento) + alba/tramonto, per **una data** | Sì; alba/tramonto l'app sa già calcolarli da sola |
| Icona meteo nel mese | 16 giorni di massime/minime/stato | 16 giorni sono oltre l'affidabilità reale: 10 bastano |
| Storico (giorni passati) | Nessuno (l'archivio non è usato) | No |
| Cache | Solo in memoria: a ogni riavvio si richiede tutto | Va resa persistente |
| Unità | °F solo per inglese‑USA con paese USA | Va fatta per paese (anche Bahamas, Belize, Liberia, Palau, Isole Marshall, Micronesia, Cayman) e con scelta manuale |

### 2.2 Il meteo nel mondo: non esiste un fornitore «perfetto» ovunque

* **Modelli globali** (ECMWF, GFS): coprono tutta la Terra a ~9–25 km. Sono quelli
  che qualunque servizio mondiale usa fuori dal proprio paese. Qualità buona
  ovunque, eccellente in Europa/Nord America, più incerta ai tropici e in montagna.
* **Modelli nazionali** (Nordici, DWD tedesco, Météo‑France, JMA giapponese, NWS
  americano…): più precisi, ma ognuno con termini diversi; integrarli uno a uno è un
  lavoro senza fine e ogni fornitore è un termine di servizio in più da rispettare.
* **Conclusione**: un **unico servizio globale senza chiave** come base, buono per
  tutti; e **la porta aperta** a chi vuole di più con la propria chiave (R3), scelto
  tra i servizi che nascono proprio per essere usati così.

### 2.3 Confronto dei candidati

| Servizio | Copertura | Chiave | Uso commerciale | Costo per l'utente | Orizzonte | Note legali |
|---|---|---|---|---|---|---|
| **MET Norway** (Istituto meteorologico norvegese, `api.met.no`) | Mondiale (ECMWF ~9 km; Nordici 1 km) | **No** | **Sì**, dati con licenza NLOD 2.0 / CC BY 4.0 | 0 | ~10 giorni (orario per 2–3 giorni, poi ogni 6 h) | Obblighi: identificarsi nell'`User-Agent` con nome app e contatto; rispettare la cache (`Expires`, `If-Modified-Since`); max 20 richieste/s; coordinate a 4 decimali; attribuzione «Data from MET Norway». Ente pubblico: in caso di abuso **blocca**, non fa causa. |
| Open‑Meteo | Mondiale, multi‑modello | No (gratis) / sì (commerciale) | **Solo con abbonamento** (≈29 €/mese) | 0 solo per uso personale non commerciale | 16 giorni, storico, aria | Oggi in uso. Resta come opzione «chiave personale». |
| OpenWeatherMap | Mondiale | Sì, **gratuita** con registrazione | Sì con la propria chiave | 0 (piano base: 60 chiamate/min) | 5 giorni a passi di 3 ore (gratuito); 8 giorni con One Call 3.0 (richiede carta, 1000/giorno gratis) | Dati CC BY‑SA 4.0: attribuzione «Weather data by OpenWeather». |
| Pirate Weather | Mondiale (modelli NOAA/ECMWF) | Sì, **gratuita** (10.000 chiamate/mese) | Sì con la propria chiave | 0 | 7 giorni orari | Nato per le app con chiave personale (formato ex Dark Sky). |
| Servizi nazionali (NWS, DWD…) | Un paese ciascuno | No | Sì (dati pubblici) | 0 | varia | Troppi termini diversi: esclusi dalla base. |
| Nessun meteo | — | — | — | 0 | — | Cielo, sole e luna calcolati nel telefono: l'app resta bella anche offline. |

### 2.4 Scelta: tre livelli, uno «di serie» e due «con la tua chiave»

```
┌───────────────────────────────────────────────────────────────────┐
│  Impostazioni › Meteo › Fonte                                     │
│                                                                   │
│  ● Base — MET Norway (incluso)            Data from MET Norway    │
│     Nessuna registrazione. 10 giorni. Tutto il mondo.             │
│                                                                   │
│  ○ La tua chiave — Open‑Meteo (abbonamento del fornitore)         │
│     16 giorni, multi‑modello, aria. Chiave: [••••••••] [Prova]   │
│                                                                   │
│  ○ La tua chiave — OpenWeatherMap (piano gratuito del fornitore)  │
│     5 giorni ogni 3 ore. Chiave: [••••••••] [Prova]               │
│                                                                   │
│  ○ Nessun meteo — solo cielo, sole e luna calcolati nel telefono  │
│                                                                   │
│  ℹ I dati meteo sono indicativi. I servizi «la tua chiave» sono   │
│    forniti da terzi secondo i loro termini e costi: Kalend non ne │
│    è parte e non vede mai la tua chiave fuori da questo telefono. │
└───────────────────────────────────────────────────────────────────┘
```

* **Base = MET Norway.** Unico servizio mondiale, gratuito anche per uso commerciale,
  senza chiave, di un ente pubblico con termini chiari e stabili da anni. È quello che
  usano le app meteo open‑source più diffuse come fonte predefinita.
* **Chiave personale = Open‑Meteo e OpenWeatherMap** (Pirate Weather aggiungibile
  dopo). Uno è il «premium» vero (16 giorni, storico), l'altro è gratuito con
  registrazione: così chi vuole di più non è obbligato a pagare. Per R3 l'app
  **non consiglia** un fornitore: li presenta in ordine alfabetico con la stessa
  grafica, con un link alla loro pagina di registrazione e la frase di cui sopra,
  da accettare esplicitamente quando si inserisce la chiave.
* **Nessun meteo.** Scelta di privacy (nessuna coordinata esce dal telefono) e di
  resilienza: l'app non dipende da nessuno.
* **Cambio di fonte in qualsiasi momento**, senza perdere nulla: tutte le fonti
  vengono tradotte nello stesso modello interno (8 stati del cielo, temperatura,
  probabilità e quantità di pioggia, nuvole, vento), che è già quello che usano le
  viste e il cielo vivo.

Che cosa **non** si fa, per R2: nessuna chiave incorporata «per tutti»; nessun
abbonamento Open‑Meteo a tuo nome; nessun server tuo che inoltra le richieste.

### 2.5 Dettagli che rendono la soluzione «intelligente» e non una toppa

1. **Architettura a fornitori intercambiabili.** Un modulo nuovo
   (`src/modules/70-weather.js`) con un registro di fornitori: ciascuno dichiara nome,
   se serve una chiave, pagina di registrazione, attribuzione obbligatoria, e tre
   funzioni (`adesso`, `giornaliero(giorni)`, `orario(data)`) che restituiscono il
   modello interno. Aggiungere un fornitore domani = un file di 100 righe.
2. **Cache persistente e «storico visto».** Le previsioni scaricate si salvano in
   IndexedDB per luogo e giorno, con la scadenza indicata dal fornitore. I giorni
   passati mostrano **l'ultima previsione vista**: l'utente ritrova il meteo della
   settimana scorsa senza che l'app chieda archivi a nessuno. Riduce le richieste
   di circa dieci volte e rispetta le regole di cache di MET Norway.
3. **Richieste parsimoniose.** Una richiesta per luogo copre tutti gli eventi di quel
   luogo per 10 giorni (oggi ne parte una per evento e per data). Richieste in
   coda, mai più di una alla volta per fornitore, coordinate arrotondate (~1 km,
   come già oggi) e troncate a 4 decimali.
4. **Unità per paese.** °F e miglia orarie nei paesi che le usano, con scelta
   manuale nelle impostazioni; ore in formato 12/24 già gestito.
5. **Attribuzione visibile.** Riga «Data from MET Norway» (o quella del fornitore
   scelto) nella scheda meteo e nei crediti: è l'unico obbligo della licenza CC BY.
6. **Degradazione elegante.** Senza rete o se il fornitore è irraggiungibile: ultima
   previsione in cache, poi cielo astronomico. Mai un errore in faccia all'utente.
7. **Identificazione corretta.** MET Norway chiede un `User-Agent` con nome, versione
   e contatto (es. `Kalend/55 https://github.com/fumax82/… kalend@…`). Nell'app Android
   le richieste passano dal nativo, che oggi invia `Kalend/1.0` senza contatto: la
   riga va aggiornata nel sorgente nativo (Fase 2). Nel frattempo MET funziona, ma
   è l'unico punto di non piena conformità e va chiuso prima della pubblicazione.
   Serve un indirizzo e‑mail dedicato al progetto (anche solo per questo).

### 2.6 Chiave personale: regole di custodia

* La chiave va nella **cassaforte cifrata** (chiave hardware del telefono), come i link
  iCal: mai nel backup, mai nella sincronizzazione, mai nei log, mai in chiaro a video.
* Pulsante **«Prova»** che fa una richiesta e mostra «funziona» o l'errore del fornitore.
* Se il fornitore rifiuta la chiave (scaduta, quota finita), l'app **torna da sola
  alla base** e lo dice una volta: nessun blocco, nessun costo nascosto.
* Nessuna statistica d'uso della chiave: ciò che l'utente consuma è tra lui e il fornitore.

---

## 3. Geocodifica (da «luogo scritto» a coordinate): quattro strati

Oggi: Open‑Meteo geocoding (non commerciale) con ripiego Nominatim (1 richiesta al
secondo **per tutta l'app**: inutilizzabile con molti utenti). Proposta a strati, dal
più economico al più costoso; ci si ferma al primo che risponde:

| Strato | Che cos'è | Rete | Legale |
|---|---|---|---|
| **0 — Memoria** | Luoghi già risolti sul telefono (500 voci) e luoghi degli eventi passati | No | — |
| **1 — Atlante offline** | Elenco compresso delle ~30.000 città del mondo sopra i 15.000 abitanti (GeoNames, licenza CC BY 4.0, ~1 MB, caricato alla prima ricerca) con nomi in più alfabeti | No | Attribuzione «GeoNames» nei crediti |
| **2 — Geocoder di Android** | Servizio del sistema (su telefoni con servizi Google usa Google, senza chiave e senza termini aggiuntivi per l'app) | Sì, via sistema | Nessun contratto tuo; assente sui telefoni senza servizi Google |
| **3 — Photon (komoot)** | Ricerca su dati OpenStreetMap, senza chiave, «uso corretto» senza garanzie | Sì | Attribuzione «© OpenStreetMap contributors» (ODbL). Volume minimo grazie agli strati 0–2 |
| **3bis — Chiave personale** | Se l'utente ha scelto Open‑Meteo o OpenWeatherMap per il meteo, la loro geocodifica è inclusa nella sua chiave | Sì | Stesse regole della sezione 2.6 |
| **4 — Manuale** | «Usa la mia posizione» (GPS) o coordinate scritte a mano | No | — |

Effetto: la grande maggioranza delle ricerche (città) non esce mai dal telefono;
gli indirizzi precisi passano dal sistema o da Photon con poche richieste. Nominatim
viene eliminato. Lo strato 2 richiede un metodo nel ponte nativo (Fase 2); gli altri
si fanno subito nella pagina (`src/modules/80-geo.js`).

---

## 4. Festività: tutto nel telefono

* Regole **offline** per ogni paese dei 20 mercati (feste fisse, mobili, lunari,
  islamiche, ebraiche), scritte da fonti ufficiali: le date delle festività sono
  **fatti**, non protetti da diritto d'autore. Dove si riprende dal progetto
  Nager.Date (licenza MIT) si conserva la nota di licenza nei crediti. Nessuna chiamata
  di rete: la dipendenza da Nager.Date sparisce.
* **Modificabili dall'utente** (aggiungi, togli, rinomina) e con la dicitura
  «indicative: verificare con le fonti ufficiali»: feste regionali e date religiose
  (islamiche, in particolare) variano per paese e per avvistamento della luna.
* Aggiornamento: con ogni versione dell'app; chi vuole può importare un calendario
  iCal di festività del proprio paese (funzione già esistente).

---

## 5. Lo scudo legale sul resto del progetto (sintesi operativa)

| Fronte | Esposizione | Come si riduce al minimo |
|---|---|---|
| **Fornitori gratuiti** (MET Norway, Photon, GeoNames, OSM) | Possono **bloccare** chi viola i termini; non hanno interesse né base per chiedere denaro se i termini sono rispettati | Rispetto puntuale: identificazione, cache, limiti, attribuzione. Copia datata dei termini nel repository (intervento 3.5). Nessuna dipendenza critica: tutto degrada con grazia. |
| **Fornitori a chiave personale** | Nessuna: il contratto è tra utente e fornitore | R3; nessun link di affiliazione; nessun logo; dicitura di estraneità accettata dall'utente. |
| **Google Play** | Il Contratto di distribuzione: Google incassa, gestisce IVA/tasse nella maggior parte dei paesi e i rimborsi. Attenzione: vendendo nell'UE sei un **«trader»** secondo il Digital Services Act e il Play Console mostra ai clienti europei **nome, indirizzo, e‑mail e telefono** del venditore | Non eliminabile: è il prezzo di vendere. Si attenua con una sede/recapito dedicati e, se i volumi lo giustificano, con una società a responsabilità limitata (da valutare col commercialista). |
| **Utenti finali** | Diritti dei consumatori (UE: garanzia di conformità 2 anni sui contenuti digitali, rimborsi), reclami per dati «sbagliati» | Termini d'uso chiari (sezione 6); R4; app che funziona offline e non perde dati (copie automatiche già presenti); nessun dato dell'utente in mano tua, quindi nessuna richiesta di accesso/cancellazione da gestire. |
| **Privacy** (GDPR, LGPD, APPI, PIPA, PDPA, DPDP, KVKK…) | Per R1 non tratti dati personali; i fornitori ricevono dal telefono dell'utente solo coordinate arrotondate e testi di luoghi | Informativa onesta e corta in 20 lingue; informative in‑app prima dei permessi (1.10); opzione «nessun meteo». |
| **Proprietà intellettuale** | Marchi di terzi, font, musiche, dati | Solo nomi testuali in uso descrittivo; font OFL con avvisi; melodie di pubblico dominio sintetizzate; dati con attribuzione. Ricerca sul marchio «Kalend» prima del lancio (D5). |
| **Contenuti religiosi e culturali** | Reclami su date o nomi (es. feste islamiche, ebraiche, cinesi; Minguo) | Tutto disattivabile e modificabile; dicitura «indicativo»; icona neutra per Minguo (1.12); nessuna classifica o giudizio. |
| **Sicurezza** | Un furto di dati causato da una falla dell'app è l'unico scenario in cui un utente avrebbe un appiglio concreto | Interventi 1.1–1.5 e Fase 2 del piano: chiudere le falle note prima della pubblicazione è anche la miglior difesa legale. |

Che cosa **non** fare mai, perché crea responsabilità: servizi cloud propri, account,
chiavi condivise, rivendita di abbonamenti, pubblicità (profilazione), analisi d'uso,
«Kalend Pro» ospitato da te.

---

## 6. Testi legali da preparare (in 20 lingue)

1. **Termini d'uso (EULA)** breve e leggibile: licenza d'uso personale; fornito «così
   com'è»; dati meteo/festività/calendari **indicativi**, non per decisioni di
   sicurezza o salute; i servizi a chiave personale sono di terzi e a carico
   dell'utente; responsabilità limitata al prezzo pagato **nei limiti ammessi dalla
   legge del consumatore**; legge applicabile e foro; contatto.
2. **Informativa privacy** (1.11): nessun dato raccolto da te; elenco esatto di ciò che
   esce dal telefono e verso chi; backup cloud Android; come cancellare tutto.
3. **Crediti e licenze** (pagina già esistente, da completare): MET Norway (CC BY 4.0),
   GeoNames (CC BY 4.0), OpenStreetMap (ODbL), Nager.Date (MIT), font (OFL), e le
   attribuzioni dei fornitori a chiave quando scelti.
4. **Dicitura di estraneità** mostrata all'inserimento di una chiave (sezione 2.4).

Dove compaiono: pagina «Informazioni legali» nelle impostazioni; link nella scheda
del Play Store; una sola schermata di presa visione al primo avvio dopo
l'aggiornamento (senza bloccare l'uso: Google Play ha già fatto accettare i suoi
termini all'acquisto).

---

## 7. Ordine di lavoro proposto e impegno

| Passo | Contenuto | Dove | Impegno | Dipende da |
|---|---|---|---|---|
| 1 | Modulo meteo a fornitori: MET Norway base, Open‑Meteo e OpenWeatherMap con chiave, «nessun meteo»; cache persistente e storico visto; unità per paese; attribuzioni; chiave nella cassaforte (migrazione di quella esistente) | pagina | M (2 giorni) | — |
| 2 | Geocodifica a strati: memoria, atlante offline GeoNames, Photon, chiave personale, manuale; rimozione di Nominatim e di Open‑Meteo gratuito | pagina + 1 file dati | M | — |
| 3 | Festività offline complete per i 20 mercati, modificabili, con dicitura | pagina | L (3–4 giorni) | — |
| 4 | Testi legali in 20 lingue + pagina «Informazioni legali» + informative prima dei permessi | pagina + docs | M | tua rilettura |
| 5 | CSP ristretta a `api.met.no`, Photon e ai due fornitori a chiave (build Android) | build | S | 1, 2 |
| 6 | Sicurezza della pagina (1.1–1.5, 1.15 del piano) | pagina | M | — |
| — | `User-Agent` con contatto e metodo `geocode` nel ponte nativo | nativo | S | progetto Android |

Da te servono solo: **un indirizzo e‑mail dedicato** al progetto (per l'identificazione
verso MET Norway e per i contatti legali) e la conferma dell'ordine. Il resto parte subito.
