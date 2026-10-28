# Kalend v54 — Report di idoneità per Google Play (vendita mondiale)

> **Nota (28/10/2026)**: il riferimento operativo è ora [`PIANO-INTERVENTI.md`](PIANO-INTERVENTI.md), che unisce questo report all'altro e corregge alcuni punti (sezione 7).

Data: 28 ottobre 2026 · Stato: **analisi, nessuna modifica applicata**.
Legenda: 🔴 blocca la pubblicazione · 🟠 da sistemare prima della vendita · 🟡 consigliato · 🟢 a posto.

## A. Requisiti Google Play

| # | Punto | Stato | Dettaglio |
|---|---|---|---|
| A1 | Target API level | 🔴 | L'APK ha `targetSdkVersion 34` (`compileSdk 36`). Dal 31 agosto 2026 le app nuove e gli aggiornamenti devono avere target **API 36 (Android 16)**; proroga richiedibile fino al 1° novembre 2026. Va ricostruita la parte nativa con Android Studio portando il target a 36 e verificando i cambi di comportamento (WebView, notifiche, allarmi esatti). |
| A2 | Formato di caricamento | 🔴 | Per le app nuove Play accetta solo **Android App Bundle (.aab)**, non APK (dal 2021). L'APK riconfezionato qui serve per le prove; per il negozio serve il progetto Android (sorgente Java/Kotlin del widget e dei promemoria), che **non è nel repository**. |
| A3 | Firma | 🔴 | Serve la chiave di rilascio del developer (Play App Signing consigliato). La chiave di prova generata qui non è utilizzabile. |
| A4 | Data safety + privacy policy | 🔴 | Obbligatori per tutte le app. Da dichiarare: posizione approssimata (~1 km) inviata a Open-Meteo per il meteo; nomi di città inviati a geocodifica (Open-Meteo/Nominatim); codice paese a Nager.Date; link iCal privati dell'utente scaricati da Google/Outlook/iCloud; eventi, attività e impostazioni salvati sul dispositivo e inclusi nel backup cloud Android (`allowBackup=true`, esclusa solo la cassaforte dei link); microfono per la dettatura (riconoscimento sul telefono, nessun invio ad altri server); lettura del calendario del telefono. Nessuna pubblicità, nessun tracker, nessun account: dichiarazione favorevole. Serve un URL pubblico con la privacy policy (per esempio su GitHub Pages, che è già questo repository). |
| A5 | Informativa in-app ("prominent disclosure") | 🟡 | La richiesta di posizione ha già una spiegazione nelle impostazioni; conviene mostrarla **prima** del prompt di sistema la prima volta, con la parola «posizione» e lo scopo (alba/tramonto, cielo, meteo). Stesso schema per microfono e calendario del telefono. |
| A6 | Permesso `USE_EXACT_ALARM` | 🟢 / 🟡 | Ammesso solo per sveglie e **calendari con notifiche degli eventi**: Kalend rientra. Nel Play Console andrà compilata la dichiarazione d'uso; tenere anche `SCHEDULE_EXACT_ALARM` come già fatto. |
| A7 | Altri permessi | 🟢 | `ACCESS_FINE/COARSE_LOCATION` (solo in primo piano, nessuna posizione in background), `READ_CALENDAR`, `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `INTERNET`, `VIBRATE`: tutti giustificati da funzioni visibili. Nessuna libreria nativa (.so): il requisito «16 KB page size» non si applica. |
| A8 | App a pagamento | 🟡 | Serve un profilo pagamenti Google (merchant) nel paese del developer; Google trattiene il 15% fino a 1 M$/anno; l'IVA nei paesi UE e in molti altri è gestita da Google. Le app a pagamento non sono vendibili in tutti i paesi (elenco «paesi supportati per i venditori/acquirenti»): alcuni mercati (per esempio parte dell'Africa e dell'Asia) consentono solo app gratuite. Alternativa: app gratuita + acquisto in-app «Pro» (Play Billing obbligatorio). |
| A9 | Scheda negozio | 🟡 | Screenshot per telefono (e tablet, perché l'app li supporta), icona 512 px, grafica 1024×500, descrizione in 20 lingue (i testi dell'app sono già tradotti), questionario classificazione contenuti, pubblico di destinazione (adulti; non «famiglie»). |
| A10 | Nome «Kalend» | 🟠 | Nessun conflitto evidente trovato nelle ricerche, ma non esiste una verifica di marchio: prima del lancio fare una ricerca su EUIPO/TMview, USPTO e WIPO e nei negozi (Play, App Store) per nomi identici in classe 9/42. Il nome è anche una parola comune in alcune lingue slave (bassa distintività: difficile da registrare, ma anche difficile che altri la blocchino). |

## B. Servizi di terzi: compatibilità con la vendita

| Servizio | Uso in Kalend | Termini (verificati su fonti pubbliche) | Esito | Alternativa senza vincoli |
|---|---|---|---|---|
| **Open-Meteo** (meteo + geocodifica) | Meteo reale per giornate/eventi, cielo vivo, ricerca città | API gratuita **solo per uso non commerciale**, max 10 000 chiamate/giorno; dati CC BY 4.0 con attribuzione (già presente). Uso commerciale: piano a pagamento (circa 29 $/mese per 1 M chiamate; 99 $/mese il piano superiore). | 🔴 Con la vendita dell'app serve il piano commerciale (il campo chiave API è già in Impostazioni) **oppure** cambiare fornitore. | **MET Norway (api.met.no)**: dati NLOD/CC BY 4.0, gratuiti anche per uso commerciale, senza chiave; richiede User-Agent identificativo (l'app già lo invia: `Kalend/1.0`) e attribuzione «Data from MET Norway». Copertura mondiale, previsioni fino a 9-10 giorni, nessuna geocodifica. |
| **Nominatim** (OpenStreetMap) | Ripiego per la ricerca di un indirizzo singolo | Policy del server pubblico: massimo 1 richiesta/secondo **per app, sommando tutti gli utenti**; vietate richieste periodiche; obbligo di User-Agent e attribuzione; l'app deve poter essere spenta su richiesta OSMF. Con migliaia di utenti il limite per app si supera. | 🟠 Non adatto a un'app venduta su scala mondiale. | **Geocoder di Android** (`android.location.Geocoder`): integrato nel sistema, gratuito, nessuna chiave né termini aggiuntivi; richiede una piccola aggiunta al ponte nativo. In seconda battuta **Photon (komoot)** o un'istanza Nominatim propria. |
| **Nager.Date** (festività) | Festività per ~115 paesi, con ripiego offline | Codice MIT; per l'API pubblica l'unica fonte trovata sui termini commerciali è di terze parti e parla di «sponsorizzazione richiesta per uso commerciale». Non verificabile direttamente da qui (host non raggiungibile in questa sessione). | 🟠 Da chiarire col maintainer o eliminare la dipendenza. | **Regole offline già nell'app** (ora ~70 paesi + feste calcolate): estenderle a tutti i paesi dei 20 mercati e togliere la chiamata di rete; oppure **OpenHolidays API** (open data, Europa) e **self-hosting di Nager.Date** (MIT, licenza offline per gli sponsor). |
| Google Calendar / Outlook / iCloud (link iCal privato) | Lettura dei calendari dell'utente | Sono dati dell'utente, scaricati dal suo link segreto; nessun'API con chiave. I nomi sono marchi: l'uso è «nominativo» (compatibilità), già scritto nei crediti. | 🟢 | — |
| Calendario del telefono | Lettura eventi | API Android standard. | 🟢 | — |
| Font Plus Jakarta Sans, IBM Plex Mono | Incorporati | SIL Open Font License 1.1: uso commerciale libero, nome «Plex» riservato (già rispettato nei crediti). | 🟢 | — |
| Musiche generate (Tanti auguri, Jingle Bells, Auld Lang Syne, marcia funebre di Chopin, brani propri) | Sintetizzate dall'app | Melodie di pubblico dominio (Happy Birthday: USA 2016, UE dal 1° gennaio 2017; Pierpont † 1893, Burns/tradizionale, Chopin † 1849). Nessun campione di terzi. | 🟢 | — |
| QR, grafica, icone | Propri | Nessuna libreria esterna; emoji di sistema. | 🟢 | — |
| Astronomia (formule Meeus/NOAA) | Calcolo locale | Formule pubbliche. | 🟢 | — |

Costo zero garantito solo con: MET Norway (meteo) + Geocoder Android (indirizzi) + festività offline/OpenHolidays. Alternativa minima: tenere Open-Meteo con abbonamento commerciale (~350 $/anno).

## C. Brevetti, marchi e vincoli per paese

* **Brevetti**: le funzioni (calendario, parsing di frasi, widget, cielo animato, musica generativa) sono tecniche generiche o con brevetti storici ormai scaduti (per esempio i «data detectors» Apple, brevetto '647 scaduto nel 2016). Nessun brevetto specifico individuato; una garanzia formale richiede un'analisi di libertà d'uso (FTO) di uno studio brevettuale, consigliata solo se i ricavi diventano rilevanti e per il mercato USA.
* **Marchi**: «Kalend» da verificare (A10). «Google Calendar», «Outlook», «iCloud», «Open-Meteo», «OpenStreetMap» usati solo come indicazione di compatibilità/attribuzione: lecito.
* **Licenze open data**: CC BY 4.0 (meteo), ODbL (OSM): attribuzione presente nei crediti. Con MET Norway: aggiungere «Data from MET Norway».
* **Crittografia**: AES-256-GCM via Android Keystore per i link segreti; uso di crittografia standard di piattaforma: esente dai controlli export USA (categoria mass market) e senza obblighi di notifica in Italia/UE. Google Play non chiede dichiarazioni export.
* **Privacy per paese**: GDPR (UE/UK), LGPD (Brasile), APPI (Giappone), PIPA (Corea), PDPA (Thailandia), DPDP (India), PIPL (Cina: Play non disponibile), KVKK (Turchia), legge 13/2025 (Vietnam): tutte soddisfatte da una privacy policy chiara, dalla minimizzazione già presente (nessun account, nessun tracciamento, dati sul dispositivo) e dalla possibilità di cancellare i dati (backup/azzeramento già presenti). Nessun trasferimento verso server propri.
* **Sensibilità culturali**: nell'elenco dei calendari secondari (aggiunto nella v54) compare la bandiera 🇹🇼 accanto a «Minguo»: da sostituire con un'icona neutra per evitare problemi con utenti e recensori cinesi. La festività «Kashmir Day» è presente solo nelle regole del Pakistan (mostrate solo a chi sceglie quel paese): accettabile. Le festività religiose sono attivabili/disattivabili dall'utente.

## D. Sicurezza

| Area | Esito | Note |
|---|---|---|
| Iniezione di codice da dati utente/importati | 🟢 verificato | Test automatico con titolo, descrizione, luogo, tag, partecipanti e colore contenenti `<img onerror>` in 12 viste: nessuna esecuzione, nessun elemento iniettato. La CSP ammette solo gli script firmati con hash e vieta gli handler inline. |
| Import JSON/ICS | 🟢 | Pulizia dei campi (`cleanEvents`, `sanitizeEventsObj`), anteprima e annulla, limite 20 MB, avviso su serie troppo lunghe. Link iCal accettati solo `https://` o `webcal://`. |
| Export/backup | 🟡 | Il backup completo è un JSON **in chiaro** con tutti i dati personali: va bene (è l'utente a condividerlo), ma conviene avvisare e offrire un backup cifrato con password (AES-GCM con PBKDF2, tutto lato pagina). |
| Segreti | 🟢 | Link iCal privati cifrati con chiave nel Keystore (esclusi dal backup cloud). Opzione «Privacy» che blocca screenshot e anteprima nelle app recenti. |
| Rete | 🟡 | `connect-src https:` ammette qualunque host HTTPS: coerente con i link iCal scelti dall'utente, ma si può restringere a un elenco di host + webcal. Nessun traffico in chiaro. |
| WebView / ponte nativo | 🟡 | `addJavascriptInterface` esposto alla pagina locale; `shouldOverrideUrlLoading` filtra la navigazione; pagina caricata da `file:///android_asset`. Da verificare nel sorgente nativo che `setAllowFileAccessFromFileURLs` e `setAllowUniversalAccessFromFileURLs` siano disattivati e che `openUrl` accetti solo `http(s)/mailto/geo`. |
| Sincronizzazione QR telefono↔tablet | 🟢 | Solo codici QR locali, nessun server intermedio; esclusa la cassaforte dei link. |
| Dati a riposo | 🟡 | Eventi in `localStorage` del WebView, non cifrati (protetti dal sandbox Android e inclusi nel backup cloud cifrato di Google). Accettabile per un'app calendario; da dichiarare nella privacy policy. |
| Dipendenze | 🟢 | Nessuna libreria JavaScript di terzi, nessun CDN: nessuna supply chain esterna. |

## E. Altre criticità

1. **Parte nativa assente dal repository**: senza il progetto Android non si può né alzare il target API né produrre l'AAB né correggere il widget. Va recuperato e versionato.
2. **Dimensione della pagina** (4,3 MB, di cui ~1,8 MB di dizionari per 20 lingue sempre caricati): avvio più lento sui telefoni economici. Soluzione: caricare solo la lingua in uso (file separati in `assets/www/i18n/`), riducendo la pagina a ~2,6 MB.
3. **Quota di `localStorage`** (tipicamente 5-10 MB per origine): con migliaia di eventi e backup automatici si può riempire; l'app lo segnala, ma sarebbe più solido passare a IndexedDB o a un archivio nativo.
4. **Geocodifica/meteo senza rete**: l'app funziona offline, ma la ricerca città e il meteo dipendono dai servizi sopra: con MET Norway e Geocoder Android resta tutto gratuito.
5. **Test automatici**: esistono solo quelli creati nella v54 per la pagina; la parte nativa non ha test.
6. **Accessibilità**: nomi per gli screen reader ora tradotti; contrasto e dimensioni dei testi piccoli del mese (7-8 px) sotto le linee guida: valutare un'opzione «testo grande».
7. **Versione**: `versionCode` va incrementato a ogni caricamento (lo script `pack-apk.py --version` lo fa, ma per Play serve l'AAB).

## F. Interventi proposti (in attesa di via libera)

| Priorità | Intervento | Dove | Effetto |
|---|---|---|---|
| 1 | Sostituire Open-Meteo con **MET Norway** (meteo) mantenendo Open-Meteo come opzione con chiave | pagina (modulo nuovo) | nessun costo, nessun vincolo commerciale |
| 2 | Geocodifica via **Geocoder Android** (ponte nativo) con Photon come ripiego; togliere Nominatim | nativo + pagina | nessun limite per app |
| 3 | Festività **offline complete** per tutti i paesi dei 20 mercati; Nager.Date solo come aggiornamento opzionale o rimosso | pagina | nessuna dipendenza |
| 4 | **Privacy policy** in 20 lingue pubblicata su GitHub Pages + informative in-app prima dei permessi | repository + pagina | requisito Play |
| 5 | Backup cifrato con password (opzionale) e restrizione della CSP agli host necessari | pagina | sicurezza |
| 6 | Icona neutra per «Minguo», testo grande opzionale | pagina | mercati asiatici, accessibilità |
| 7 | Dizionari per lingua caricati su richiesta | build + pagina | avvio più rapido |
| 8 | Progetto Android: target API 36, AAB, Play App Signing, dichiarazione allarmi esatti | nativo (serve il sorgente) | requisito Play |

Fonti consultate: pagine ufficiali Android/Google Play sul target API (developer.android.com, support.google.com), termini Open-Meteo (open-meteo.com/en/terms, pricing), policy Nominatim (operations.osmfoundation.org/policies/nominatim), termini MET Norway (api.met.no/doc/TermsOfService), Nager.Date (github.com/nager/Nager.Date e listing di terze parti), documentazione Android sugli allarmi esatti, sentenze e articoli sul pubblico dominio di «Happy Birthday». I siti open-meteo.com, osmfoundation.org, met.no, nager.at e support.google.com non erano raggiungibili direttamente da questa sessione (rete limitata): le sintesi provengono dai risultati di ricerca e vanno riconfermate sulle pagine originali prima del lancio.
