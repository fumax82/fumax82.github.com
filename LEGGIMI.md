# Galleria con YubiKey

Una galleria foto e video per Android che sostituisce quella del telefono.
Ha uno **spazio protetto** (la "cassaforte") che si apre **all'istante** quando
appoggi o inserisci la tua YubiKey, con lo stesso effetto "switch" di Note Sicure.
Quando togli la chiavetta, la cassaforte si richiude subito.

Tutto è gratuito e open source: nessun servizio a pagamento, nessun cloud,
nessuna pubblicità. Le foto protette restano solo sul telefono.

> ⚠️ L'app è stata compilata ma **non è ancora stata provata su un telefono vero**.
> Prima di proteggere foto importanti, fai una prova con qualche foto di poco conto.

---

## 1. Installazione

1. Copia `Galleria.apk` sul telefono e aprilo.
2. Android chiede di consentire l'installazione "da origini sconosciute": consentila per il file manager che stai usando.
3. Al primo avvio concedi il permesso di leggere foto e video.
4. **Per usarla come galleria predefinita:** apri una foto da un'altra app (per esempio dal file manager). Quando Android chiede con quale app aprirla, scegli **Galleria** e poi **Sempre**.

Requisiti: Android 8.0 o successivo, una YubiKey con FIDO2 (va bene la *Security Key C NFC*).

## 2. Primo uso della chiavetta

1. La prima volta basta **appoggiare o inserire la YubiKey** con l'app aperta: compare la domanda *«Chiavetta di sicurezza rilevata»*, a cui rispondi **Configura**. Questa domanda compare solo finché nessuna chiavetta è registrata. In ogni momento puoi anche **tenere premuto il titolo «Galleria»** in alto: è il **gesto segreto**, e dopo la configurazione è l'unico accesso alle impostazioni delle chiavette.
2. Si apre la schermata **Chiavi**. Premi **Aggiungi chiavetta** e appoggia la YubiKey dietro al telefono, oppure inseriscila nella porta USB-C.
3. **Scrivi su carta il codice di recupero** che compare. Serve se perdi la chiavetta. Senza la chiavetta e senza il codice, le foto protette non si possono più aprire.
4. Puoi registrare una seconda YubiKey di riserva.

## 3. I due spazi

| | Galleria normale | Cassaforte |
|---|---|---|
| Colori | carta chiara, lavanda e rosa cipria | carbone caldo e champagne |
| Si vede | sempre | solo con la chiavetta |
| Contiene | le foto del telefono | le foto che hai protetto (cifrate) |
| Pulsante **+** e pillola **Blocca** | non ci sono | ci sono |

- **Aprire la cassaforte:** appoggia la chiavetta (NFC) o inseriscila (USB-C). Lo schermo cambia subito.
- **Chiuderla:** togli la chiavetta, premi **Blocca**, oppure esci dall'app.
- Gli screenshot sono sempre bloccati e l'app non mostra anteprime nell'elenco delle app recenti.

### Proteggere le foto
- Nella galleria normale **seleziona le foto** (tieni premuta una foto) e poi **appoggia la chiavetta**: dopo lo sblocco ti chiede se vuoi proteggerle.
- In alternativa, dentro la cassaforte usa **+ → Proteggi foto della galleria**.
- Le foto vengono prima **copiate e cifrate**. Solo se la copia riesce, Android ti chiede il permesso di **eliminarle dalla galleria** normale.
- **+ → Scatta una foto protetta**: la foto va direttamente nella cassaforte, senza passare dalla galleria.

### Far uscire le foto
Nel visore, dal menu ⋮, scegli **Rimetti nella galleria**: la foto viene decifrata, torna visibile a tutti e sparisce dalla cassaforte.

## 4. Modalità di visualizzazione

Il pulsante con i quadratini in alto cambia la vista:

- **Griglia:** quadrati divisi per giorno. *Pizzica* per avere più o meno colonne.
- **Mosaico:** foto intere, nella loro forma, affiancate.
- **Rivista:** una foto grande e due piccole, a ritmo alternato.
- **Diario:** una foto grande per riga, giorno per giorno.
- **Elenco:** nome, data, peso e risoluzione.

In basso ci sono le schede **Foto, Momenti, Album, Preferiti, Video**.

### Momenti (album virtuali)
L'app raggruppa da sola le foto scattate vicine nel tempo. Le foto non vengono spostate né copiate.
- Due foto stanno nello stesso momento se tra l'una e l'altra passano **meno di 12 ore** e sono della **stessa giornata**.
- Le foto del giorno dopo scattate **prima delle 6 di mattina** restano nella serata precedente.
- La scheda **Momenti** mostra un album per ogni momento, con il giorno e l'orario. Puoi sceglierne la copertina tenendo premuto l'album.
- Nella griglia (ordinata per data), ogni momento è chiuso in una **cornice luminosa colorata** con lo sfondo velato dello stesso colore. Due momenti vicini hanno sempre colori diversi, così vedi subito come sono distribuite le foto nel tempo. In modalità selezione, il pulsante **Seleziona** sul titolo seleziona tutto il momento. In cima c'è la **foto in evidenza**, che si muove lentamente.
Dal menu ☰ trovi **Ordina** (data, nome, grandezza), **Cerca** (per nome, album, mese o anno), il **Cestino** e la **Presentazione**.

## 5. Guardare le foto

- Tocca una foto per aprirla. Doppio tocco o pizzico per lo **zoom**, scorri a destra o a sinistra per **cambiare foto**, **trascina in giù** per chiudere.
- La barra in basso del visore ha: **Condividi, Modifica, ♥ Preferito, Elimina, Info, ⋮**.
- **Info** mostra fotocamera, obiettivo, esposizione, ISO, dimensioni e posizione GPS (con **Apri nella mappa**).
- Il menu **⋮** contiene: copertina dell'album, foto in evidenza, presentazione da qui, **Imposta come** (sfondo o foto di un contatto), Apri con, Rinomina, Copia o sposta in un album.
- I video si riproducono direttamente nel visore.

## 6. Modificare le foto

**Modifica** apre l'editor, che ha quattro schede:

- **Filtri:** 18 filtri con intensità regolabile, tra cui i toni pastello Cipria, Salvia, Nebbia e Avorio.
- **Regola:** luminosità, contrasto, saturazione, calore, tinta, sbiadito (effetto pellicola), grana, vignettatura e **passe-partout**, un bordo color carta come una stampa incorniciata.
- **Ritaglia:** ritaglio libero o con proporzioni fisse, rotazione, specchio, raddrizzamento.
- **Disegna:** disegno a mano libera con colori e spessori.

Tieni premuta la foto per **confrontarla con l'originale**.
Quando salvi puoi scegliere **Salva una copia** oppure **Sostituisci l'originale**. Nella cassaforte, anche la foto modificata resta cifrata.

## 6b. Strumenti

Dal menu ☰ scegli **Strumenti**:
- **Doppioni:** trova le foto e i video presenti più volte (stesso peso e stesse dimensioni) e li mette uno accanto all'altro, così puoi eliminare le copie.
- **File più grandi:** mostra i 100 elementi che occupano più spazio.
- **Screenshot:** raccoglie tutte le schermate catturate.
- **Vai a una data:** salta al giorno che scegli dal calendario.
- **Riepilogo:** quante foto e video hai, lo spazio occupato, quante foto per anno, gli album più grandi.

## 7. Condividere

- Seleziona una o più foto e premi **Condividi**, oppure usa Condividi dal visore.
- Per le foto **protette** l'app chiede conferma, perché chi le riceve le vedrà. Vengono decifrate solo per il tempo dell'invio, in una cartella temporanea che si svuota quando chiudi la cassaforte.

## 8. Copertine

- **Copertina di un album:** nella scheda Album tieni premuto un album e scegli **Scegli la copertina**. In alternativa, dal visore, apri ⋮ e scegli **Usa come copertina dell'album**.
- **Foto in evidenza** (la foto grande in cima): menu ☰, **Scegli la foto in evidenza**, oppure ⋮ e **Metti in evidenza**.
- Puoi sempre tornare alla scelta **automatica**.
- La cassaforte ha copertine sue, salvate nell'indice cifrato.

## 9. Presentazione

Menu ☰, **Presentazione** (oppure Presentazione dell'album). Gli effetti disponibili sono **Ken Burns** (zoom lento), **Dissolvenza** e **Scorrimento**. Puoi anche scegliere quanti secondi dura ogni foto. Tocca lo schermo per vedere i comandi.

## 10. Cestino

Le foto eliminate dalla galleria normale vanno nel **cestino di Android** (da Android 11), dove restano 30 giorni. Dal menu ☰, **Cestino**, puoi **ripristinarle** o eliminarle **per sempre**.
Nella cassaforte **non c'è cestino**: eliminare una foto protetta la cancella subito, dopo una conferma.

## 11. Cose da sapere

- **Note Sicure e Galleria sullo stesso telefono:** con la chiavetta **USB-C**, Android permette una sola app predefinita ("Usa sempre"). Per questo, quando colleghi la chiavetta, Android può chiederti quale app aprire. Rispondi **Solo questa volta**. Se invece l'app è già aperta, la chiavetta viene riconosciuta direttamente. Con l'**NFC** (chiavetta appoggiata) non c'è nessun conflitto.
- **Permesso facoltativo "Gestione contenuti multimediali"** (Android 12+): Impostazioni → App → Galleria → *Gestione contenuti multimediali*. Se lo concedi, Android smette di chiedere conferma ogni volta che sposti nel cestino o modifichi una foto.
- Quando **un'altra app** chiede di scegliere una foto (per esempio WhatsApp → Galleria), si apre solo la galleria normale. La cassaforte non si apre **mai** in quel caso.
- Se la chiavetta ha un **PIN FIDO2**, l'app te lo chiede.

## 12. Sicurezza (in breve)

- Ogni foto e video protetto è cifrato con **AES-256-GCM**, a blocchi da 1 MB. Anche le miniature e l'indice (nomi, album, date) sono cifrati.
- La chiave principale è "chiusa" da ogni YubiKey registrata, tramite FIDO2 *hmac-secret*. Senza la chiavetta fisica non si apre.
- Il codice di recupero è una seconda serratura. Tienilo al sicuro, su carta.
- Quando togli la chiavetta, la chiave viene cancellata dalla memoria e le miniature protette vengono buttate.
- Limite onesto: chi ha il telefono sbloccato può vedere che l'app esiste, ma non che contiene una cassaforte né cosa c'è dentro.

## 13. Com'è fatto il codice

Tutto in `app/src/main/java/com/ric/galleriasicura/`, commentato in italiano:

| Cartella / file | Cosa fa |
|---|---|
| `security/` | cifratura (`CryptoUtils`), cassaforte delle chiavi (`Vault`), dialogo con la YubiKey (`YubiKeyFido`) |
| `data/ArchivioPubblico.kt` | legge e modifica le foto del telefono (MediaStore, cestino, album) |
| `data/Cassaforte.kt` | salva e legge le foto cifrate |
| `data/Preferenze.kt` | preferiti, copertine, vista scelta |
| `ui/MainActivity.kt` | schermata principale e **switch istantaneo** |
| `ui/RilevatoreChiave.kt` | si accorge in un attimo di quando la chiavetta arriva o va via |
| `ui/Operazioni.kt` | tutte le azioni: condividi, elimina, proteggi, sposta… |
| `ui/Impaginazione.kt` | le 5 modalità di vista |
| `ui/Visore.kt`, `VistaZoom.kt` | visore a schermo intero con zoom |
| `ui/EditorFoto.kt`, `Ritocco.kt` | editor e filtri |
| `ui/Presentazione.kt` | presentazione |
| `ui/Tema.kt`, `Icona.kt` | colori dei due spazi e icone disegnate |

Per cambiare i **colori**, modifica `ui/Tema.kt`. Per i **testi**, cercali direttamente nei file: sono scritti in italiano nel codice.

## 14. Ricompilare

- **Con Android Studio** (gratuito): apri la cartella `galleria_yubikey` e premi *Run*.
- **Con GitHub** (gratuito): carica la cartella in un repository. L'azione `.github/workflows/compila-apk.yml` produce l'APK tra gli *Artifacts*.
- **Senza Android Studio** (come è stato fatto qui): `LIB=/opt/lib KOTLINC=/opt/kotlinc bash strumenti/compila_senza_android_studio.sh`. Lo script spiega in cima quali strumenti servono.

Per gli aggiornamenti usa sempre la stessa firma (`strumenti/galleria.keystore`), altrimenti Android rifiuta l'installazione sopra la versione vecchia.
