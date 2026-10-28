# Kalend — parte nativa Android (`android-src/`)

Questa cartella è il progetto Android Studio dell'app. È stato **ricostruito**
dall'APK v53 (il sorgente nativo originale non era nel repository): ogni classe
è stata riscritta in Java leggibile e commentato in italiano, mantenendo lo
stesso comportamento, e portata a **target API 36** come richiede Google Play.

La pagina dell'app (`Kalend/www/index.html`, generata da `node tools/build.js`)
non sta qui: al momento del build viene copiata automaticamente negli asset
(`app/build/www-assets/www/`) dal task Gradle `copyWeb`.

## Come si costruisce

1. Installa **Android Studio** (con SDK 36) e apri la cartella `Kalend/android-src`.
2. Nella cartella `Kalend/` esegui `node tools/build.js` (produce `www/index.html`).
3. Per provare sul telefono: *Run ▶* oppure `./gradlew assembleDebug`
   → `app/build/outputs/apk/debug/app-debug.apk`.
4. Per Google Play serve l'**AAB firmato**: imposta le variabili d'ambiente
   ```
   KALEND_KEYSTORE=/percorso/kalend-release.jks
   KALEND_KEYSTORE_PASS=…   KALEND_KEY_ALIAS=kalend   KALEND_KEY_PASS=…
   KALEND_CONTACT=https://tuo-sito.example/kalend      (o un'email: finisce nello User-Agent)
   ```
   poi `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
   La chiave si crea una volta sola con `keytool -genkeypair -v -keystore kalend-release.jks -alias kalend -keyalg RSA -keysize 4096 -validity 10000`
   e va conservata al sicuro: **non** nel repository (il `.gitignore` la esclude).

Senza l'SDK (ad esempio nell'ambiente di sviluppo di questo repository):
- `bash Kalend/tools/native-check.sh` verifica che il Java compili;
- `bash Kalend/tools/build-apk.sh` costruisce un **APK di prova completo**
  (`dist/Kalend-native-test-signed.apk`) usando d8 e aapt2 scaricati dalle fonti
  ufficiali e la firma di prova: serve per installare e collaudare, **non** per il
  negozio (lì serve l'AAB firmato con la tua chiave, da Android Studio).

## Le classi (package `app.kalend`)

| File | Ruolo |
|---|---|
| `MainActivity.java` | La WebView a schermo intero che mostra la pagina, il **ponte JavaScript** `KalendNative` (classe interna `Bridge`), la gestione di Intent, permessi, dettatura, file. |
| `Net.java` | Scaricamento sicuro (`fetchPublic`): solo https, niente indirizzi privati, massimo 5 redirezioni e 8 MB, User-Agent con contatto. |
| `Vault.java` | Cassaforte dei link ai calendari esterni (cifrati nell'Android Keystore). |
| `DeviceCalendar.java` | Lettura dei calendari del telefono e inserimento tramite l'app calendario di sistema. |
| `Geo.java` | **Nuovo v55**: ricerca luoghi con il Geocoder del telefono (metodo `geocode` del ponte). |
| `Reminders.java` | Promemoria: sveglie esatte, notifiche con versione pubblica per la schermata di blocco, posticipa/fatto. |
| `KalendWidget.java` | Widget principale (cielo dipinto, lista eventi, liste, statistiche, musica). |
| `KalendNextWidget.java` | Widget piccolo "prossimo evento". |
| `WidgetService.java` | Fabbrica delle righe della lista del widget (`Factory`, `Row`). |
| `WidgetLists.java` | Liste/cose da fare nel widget e coda delle modifiche da riconsegnare alla pagina. |
| `WidgetStats.java` | Vista statistiche del widget. |
| `WidgetAudio.java` | Riproduzione delle clip audio dal widget. |
| `SkyPainter.java` | Disegno dello sfondo: sole, luna, fasi, colori per ora del giorno, meteo. |
| `WidgetFilterActivity.java` | Finestra per filtrare il widget. |
| `WidgetPreviewActivity.java` | Anteprima e impostazioni del widget. |

## Il ponte JavaScript in due righe

La pagina chiama `KalendNative.metodo(id, …)`; la risposta arriva in modo
asincrono con `window.__knCb(id, ok, dato)`. Ogni metodo controlla `trusted()`:
risponde solo se la pagina caricata è quella dell'app
(`https://appassets.androidplatform.net/www/index.html`, servita dagli asset).
Gli Intent dei widget e delle notifiche portano solo valori verificati con
espressioni regolari; gli avvisi richiedono il token segreto `alert_tok`.

## Cosa è cambiato rispetto alla v53 (vedi `docs/PIANO-INTERVENTI.md`, fase 2)

- target API 36, schermo intero gestito (insets), gesto «indietro» con `OnBackInvokedCallback`;
- `geocode(id, testo, lingua)` nel ponte: i luoghi passano dal telefono, non da un servizio scelto dall'app;
- User-Agent con contatto (richiesto dalle condizioni di MET Norway), configurabile con `KALEND_CONTACT`;
- nessuna libreria esterna (zero dipendenze da dichiarare nelle licenze);
- firma di rilascio fuori dal repository.

## Punti ricostruiti con un margine di dubbio

Il sorgente decompilato è leggibile ma non perfetto: nei punti in cui il flusso
era ambiguo la scelta è segnalata nel codice con un commento che inizia con
`NOTA RICOSTRUZIONE:` (cercalo con *Find in files*). Sono dettagli di gestione
degli errori e di layout del widget, non di sicurezza. Da ricollaudare su un
telefono reale, nell'ordine:

1. widget principale: cielo, lista eventi, modalità (mese/agenda/liste/statistiche), filtri, musica;
2. widget «prossimo evento»;
3. promemoria: notifica, posticipa, fatto, riavvio del telefono, cambio ora;
4. dettatura dal vivo e con la finestra di sistema;
5. calendario del telefono (permesso, elenco, eventi, nuovo evento);
6. esportazione/condivisione file, apertura link, ricerca luoghi (Geocoder);
7. gesto «indietro» e margini di sistema su Android 15/16, layout su tablet.
