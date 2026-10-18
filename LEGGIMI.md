# Navigatore personale (Android)

App per Android 8 o successivi. È un navigatore per auto che lascia **imporre sulla mappa strade, tratti, punti e aree da evitare o da cui passare**. Usa soltanto servizi gratuiti, senza carta di credito.

Non è Google Maps. In particolare:
- non conosce il traffico in tempo reale;
- non conosce chiusure né limiti di velocità;
- non calcola percorsi senza internet.

Tutto questo è dichiarato anche dentro l'app.

---

## 1. Fattibilità: cosa si può fare e come

| Funzione | Stato | Note |
|---|---|---|
| Mappa OSM con giorno/notte, ruotabile | ✅ Supportata | MapLibre + OpenFreeMap (senza chiave) |
| Partenza/arrivo da posizione, indirizzo o tocco | ✅ Supportata | |
| Tappe intermedie (aggiungi, togli, riordina) | ✅ Supportata | |
| Percorso in auto: km, durata, ETA, istruzioni | ✅ Supportata | ETA **senza traffico**, dichiarato |
| Percorsi alternativi | ⚠️ Limitata | Solo senza punti intermedi e sotto i 100 km (limite openrouteservice) |
| Evita pedaggi, autostrade, traghetti | ✅ Supportata | |
| Confronto "prima/dopo" (Δ km, Δ minuti) | ✅ Supportata | Costa 1 richiesta in più |
| **Evita una strada / un tratto** (tocco, inizio-fine, pezzo di percorso) | ⚠️ **Approssimata** | Il servizio gratuito non esclude singoli archi stradali: escludo una **fascia** (±5…30 m) attorno al tratto, mostrata in ambra. Le strade vicine che la fascia toccherebbe vengono elencate prima di confermare. Gli incroci alle estremità restano liberi (rientro di 15 m). |
| Evita aree (poligono, rettangolo, cerchio con raggio) | ✅ Supportata | Limiti del servizio: area ≤ 200 km², lato ≤ 20 km, percorso con aree ≤ 150 km |
| Più esclusioni insieme | ✅ Supportata | Le aree sovrapposte vengono unite |
| Scelta della strada quando il tocco è vicino a più strade | ✅ Supportata | Lista delle strade candidate, servono zoom ≥ 14 |
| **Passa da un punto** | ✅ Supportata | Aggancio alla strada; viene mostrato il punto realmente usato |
| **Passa da un tratto** con senso di marcia | ✅ Supportata | Punti con direzione obbligata; verifica copertura ≥ 90 % nel senso giusto |
| **Passa dentro / attraversa un'area** | ⚠️ **Euristica** | Non uso il centro dell'area. Cerco strade dentro l'area (dalla mappa o con l'aggancio del servizio), provo pochi candidati entro un tetto di richieste e verifico il risultato. Può fallire anche quando una soluzione esiste. |
| Obbligatorio / Preferito; ordine dei vincoli | ✅ Supportata | Un vincolo obbligatorio impossibile ferma il calcolo con la spiegazione |
| Diagnosi dei conflitti | ✅ Supportata | Controlli preventivi, poi prove "togliendo un vincolo alla volta" per dire quale blocca |
| Verifica del percorso dopo ogni calcolo | ✅ Supportata | Aree escluse, punti (25 m), tratti (20 m, 90 %), aree, ordine, coerenza istruzioni |
| Esclusione esatta di un arco stradale | ❌ Non disponibile gratis | Possibile con un server proprio (vedi §3) |
| Guida vocale in italiano, svolte, distanze | ✅ Supportata | Sintesi vocale del telefono |
| Uscita dal percorso e ricalcolo | ✅ Supportata | Tollerante al rumore GPS; ricalcolo con attesa e limiti; esclusioni sempre mantenute; tappe già raggiunte tolte |
| Guida a schermo spento | ✅ Supportata | Servizio in primo piano con notifica fissa (meccanismo ufficiale Android) |
| Traffico, autovelox, limiti, chiusure | ❌ Non disponibile | Non inventati né simulati |
| Calcolo percorsi offline | ❌ Non disponibile | Senza rete resta visibile il percorso già scaricato |
| Preferiti, percorsi salvati, cronologia, annulla/ripristina | ✅ Supportata | Solo sul telefono |

## 2. Servizi scelti e loro limiti

| Servizio | A cosa serve | Costo | Limiti |
|---|---|---|---|
| **OpenFreeMap** | Mappa (tasselli vettoriali OSM) | Gratis, senza chiave | Nessuna quota dichiarata; uso corretto, attribuzione obbligatoria |
| **openrouteservice** (HeiGIT) | Percorsi, aggancio alle strade, ricerca indirizzi (Pelias) | Gratis con chiave personale, **nessuna carta** | Piano "Standard" quando l'ho verificato: percorsi 2000/giorno e 40/minuto; aggancio 2000/giorno; ricerca 1000/giorno e 100/minuto |
| **Nominatim** (OSM) | Ricerca di riserva, se manca la chiave | Gratis | Massimo 1 richiesta al secondo; **niente suggerimenti mentre scrivi** (lo vietano le loro regole); non adatto a uso intenso |

- I limiti di openrouteservice possono cambiare. Il valore che conta è quello scritto nel **tuo pannello** su openrouteservice.org.
- L'app conta le richieste. Se il server comunica quante richieste restano, mostra anche quel numero (Impostazioni → Uso dei limiti).
- A limite raggiunto l'app si ferma e lo dice. Non passa mai a servizi a pagamento.
- Ogni calcolo usa al massimo 8 richieste. Il numero si può regolare.
- Perché openrouteservice:
  - è l'unico servizio pubblico gratuito, senza carta, che accetta **aree da evitare** e **direzione obbligata nei punti**;
  - è open source, quindi lo stesso codice si può installare su un proprio server senza cambiare l'app.
- I componenti mappa, ricerca, percorso e guida sono separati: per cambiare fornitore si modifica solo `App.kt` (oggetto `Servizi`) e si aggiunge una classe che implementa `MotorePercorsi` / `Geocodifica`.
- Non uso server "demo" pubblici, né scarico in massa dai server di OpenStreetMap.

## 3. Server proprio (facoltativo)

Serve solo se vuoi più precisione o nessun limite giornaliero.

- **openrouteservice in Docker**:
  - il software è gratuito;
  - in Impostazioni → Server metti il tuo indirizzo e l'app funziona uguale;
  - per l'Italia servono circa 8–16 GB di RAM;
  - un server in affitto costa circa 20–40 €/mese, oppure si usa un PC di casa sempre acceso;
  - i dati OSM dell'Italia si scaricano da Geofabrik, gratis.
- **Valhalla**, anche lui gratuito:
  - ha `exclude_locations`, che esclude **esattamente** un arco stradale invece della fascia approssimata;
  - richiede di scrivere una nuova classe motore nel nucleo (lavoro non fatto).

Il software è gratis in entrambi i casi: si paga solo la macchina che lo fa girare.

## 4. Chiave e installazione

1. **Chiave**:
   - registrati gratis su https://openrouteservice.org (Sign up);
   - copia la chiave dal pannello "Tokens";
   - nell'app vai su Menu → Impostazioni e chiave → incolla → **Salva** → **Prova**.
   - La chiave resta solo nella memoria dell'app. Non è nei sorgenti né nel repository.
2. **Installazione**:
   - scarica `Navigatore.apk` dal link;
   - Android chiederà di consentire l'installazione da quella fonte.
3. Al primo avvio concedi la **posizione**. All'avvio della guida concedi anche le **notifiche**: servono per la guida a schermo spento.
4. Se la guida si interrompe a schermo spento, apri Impostazioni → "Apri le impostazioni della batteria" ed escludi l'app dal risparmio energetico.

### Compilare da soli

- Serve JDK 17 o successivo e Android SDK 36. Poi: `./gradlew :app:assembleRelease`.
- Le prove della logica si lanciano con `./gradlew -p nucleo test`.
- La compilazione ufficiale avviene su GitHub Actions (`.github/workflows/compila.yml`).
- La firma si fa in locale con una chiave **mai pubblicata**.

## 5. Privacy

Ecco quali dati escono dal telefono:
- **OpenFreeMap** riceve la zona di mappa che guardi e il tuo indirizzo IP. Non riceve la posizione GPS.
- **openrouteservice** riceve, a ogni calcolo:
  - le coordinate di partenza, tappe e arrivo;
  - i punti ausiliari dei vincoli e le aree da evitare;
  - la tua chiave.
- Durante la guida, la posizione parte **solo se esci dal percorso**, per il ricalcolo.
- **Ricerca** (Pelias o Nominatim): riceve il testo cercato e una posizione approssimata, che serve a ordinare i risultati.

Tutto il resto (preferiti, cronologia, percorsi, impostazioni) resta sul telefono. L'app non ha pubblicità, tracciamento o account.

## 6. Attribuzioni e licenze

- Dati © contributori di OpenStreetMap (ODbL)
- OpenFreeMap / OpenMapTiles
- openrouteservice © HeiGIT, ricerca Pelias
- Nominatim
- MapLibre Native (BSD-2)
- JTS (EPL 2.0 / EDL 1.0)
- Kotlin, AndroidX, Compose (Apache 2.0)

## 7. Struttura del codice

```
nucleo/   logica pura in Kotlin (provata con test automatici)
  geo/            calcoli su linee e aree (distanze, fasce, poligoni)
  modello/        viaggio, vincoli, percorso, annulla/ripristina
  ors/            openrouteservice e Nominatim
  servizi/        interfacce dei fornitori, HTTP, conteggio limiti
  strade/         strade lette dalla mappa (tocco, tratti, incroci)
  pianificazione/ calcolo con vincoli, conflitti, tentativi
  validazione/    verifica del percorso dopo ogni calcolo
  navigazione/    posizione sul percorso, annunci, ricalcolo
app/      app Android
  mappa/          disegno su MapLibre
  guida/          GPS e servizio di guida (voce, schermo spento)
  dati/           salvataggio locale
  ui/             schermate (Compose) e modello dell'interfaccia
```

## 8. Resoconto delle prove (18/10/2026)

**A. Prove simulate della logica: 18 su 18 superate** (`nucleo/src/test`).
- Usano una città finta a griglia e un server openrouteservice **finto**, che legge e scrive lo stesso formato JSON di quello vero.
- Scenari richiesti e risultato:
  - Evitare un tratto del percorso → nuovo percorso più lungo che non attraversa la fascia ✅
  - Più aree escluse insieme → unite e tutte rispettate ✅
  - Punto + tratto obbligati → passaggio dal punto e copertura del tratto al 96 % nel senso giusto ✅
  - Attraversare un'area il cui centro è irraggiungibile (lago) → riuscito con strade candidate, 1 percorso + 1 aggancio ✅
  - Vincoli incompatibili (muro di esclusione, tratto a senso unico contromano) → calcolo fermato, vincolo colpevole indicato ✅
  - Deviazione durante la guida → viaggio residuo che mantiene tutte le esclusioni e toglie le tappe raggiunte ✅
  - Quota esaurita (risposte 429 e 403) → messaggio chiaro e blocco locale delle richieste successive ✅
  - Rete assente → errore "nessuna connessione"; GPS debole e assente riconosciuti ✅
  - Alternative e coerenza istruzioni-geometria ✅
- **Non** ho potuto provare il vero openrouteservice: il mio ambiente non lo raggiunge e non ho una chiave. La prima prova reale la farai tu con il tasto «Prova».

**B. Prova sull'emulatore Android 14 (GitHub Actions): superata.** Ha controllato che:
- l'app si apre e la mappa OpenFreeMap si carica;
- i menu Evita e Passa da si aprono;
- un poligono disegnato con tre tocchi diventa un vincolo rosso;
- l'elenco dei vincoli e le impostazioni si aprono;
- la guida parte (servizio in primo piano, voce, schermata grande) su un percorso finto e si chiude con «Termina».

Le fotografie dello schermo sono in `prove/`. Dalle foto ho corretto:
- le etichette spezzate a metà parola;
- il pulsante «Conferma» nascosto;
- i pulsanti fuori dal riquadro.

L'emulatore usa la versione di prova (debug). L'APK pubblicato è la versione definitiva (release), compilata dagli stessi sorgenti e firmata a parte.

**C. Prova su strada: NON eseguita.** Restano da provare su un telefono vero:
- la precisione del GPS;
- la voce a schermo spento;
- il ricalcolo in deviazione;
- il comportamento del risparmio batteria del tuo telefono.

## 9. Limitazioni residue

- Le strade da evitare sono escluse con una fascia approssimata, non per arco esatto.
- "Passa dentro / attraversa un'area" è euristico: tetto di richieste, nessuna garanzia di trovare la soluzione.
- Per scegliere le strade col dito serve zoom ≥ 14 (le strade minori arrivano solo da lì).
- Niente traffico, limiti di velocità, chiusure; niente calcolo offline.
- Le alternative ci sono solo senza punti intermedi e sotto i 100 km.
- I limiti di quota mostrati sono quelli predefiniti del piano gratuito: il conteggio è locale e si azzera a mezzanotte, ora del telefono.
- L'APK pesa circa 47 MB: contiene la mappa per telefoni a 32 e 64 bit e per l'emulatore.

## 10. Aggiornamenti

- Firma con `strumenti/navigatore.keystore` (alias `navigatore`, password `navigatore-ric`). La chiave è solo in questa cartella e **non va pubblicata**.
- Ogni aggiornamento deve avere la stessa chiave e un `versionCode` più alto in `app/build.gradle.kts`.
