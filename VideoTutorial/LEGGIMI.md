# Video Tutorial: app Android (Fase 1)

L'app prepara, per ogni video, una cartella da cui Claude scrive il tutorial.
Claude legge solo `tutorial_input.md` e le foto in `foto/`.

## Cosa fa questa versione

1. **Home.** Scegli una volta la cartella condivisa "Formazione" e apri un video (mp4, mov, mkv…).
2. **Riconoscimento.** L'app calcola l'impronta del video. Se l'ha già elaborato, riapre la sua cartella.
3. **Scheda.** Per un video nuovo chiede titolo (obbligatorio), macchina, reparto, scopo e autore. Macchina, reparto e autore restano quelli dell'ultima volta.
4. **Lettore.** Mostra il tempo al decimo di secondo, Play/Pausa e i pulsanti −1 / +1 per andare indietro o avanti di un fotogramma.
   - **Striscia di anteprime** sotto il video, con miniature di tutto il filmato ed effetto "lente". Il punto attuale è al centro (linea bianca). Vicino al punto attuale le miniature sono larghe, così vedi i fotogrammi precedenti e successivi. Oltre una soglia, ai lati, la striscia si comprime e mostra il resto del video in poco spazio. I segnalibri sono tacche colorate. Tocca la striscia per saltare a quel punto. Le miniature si creano in sottofondo e restano in memoria: riaprendo lo stesso video compaiono subito.
   - **Tasti segnalibro** "◀ P02" e "P03 ▶": portano il video al segnalibro precedente o successivo, da dove puoi riprendere a riprodurre e aggiungerne altri. Il tasto è spento ("—") se in quella direzione non ci sono segnalibri.
5. **Barra di scorrimento.** Dito a destra: il video va avanti. Dito a sinistra: torna indietro. Più ti allontani dal punto in cui hai appoggiato il dito, più va veloce, fino a 50x. Quando lasci il dito la barra torna al centro.
6. **Cattura.** Ci sono quattro pulsanti colorati: Operazione, Sicurezza, Errore da evitare e Dettaglio. Ognuno salva il fotogramma del video originale:
   - in `foto/` una copia ridotta a 1024 px (1280 px per Dettaglio);
   - in `_archivio/foto_originali/` la copia a piena risoluzione.
   La cattura è istantanea: la finestra del commento si apre subito, mentre la foto viene estratta e salvata in sottofondo. In alto compare "salvo N…" finché il salvataggio non è finito.
7. **Numerazione.** I passi sono sempre in ordine di tempo nel video. Se catturi un punto precedente, le foto si rinumerano da sole.
8. **Commento.** Dopo ogni foto si apre una finestra con Salva, Salta ed Elimina foto. Puoi dettare il commento con il microfono della tastiera.
9. **Audio.** L'audio completo viene copiato in sottofondo, senza perdita di qualità, in `_archivio/audio_completo.m4a`. In questa fase funziona con l'audio AAC, cioè quasi tutti i video fatti col telefono.
10. **Termina.** Il pulsante salva le note finali. `Stato: COMPLETO` compare solo quando hai premuto Termina e l'audio ha finito. Una nuova cattura riporta lo stato a IN CORSO.
11. **Tasto indietro** del telefono: torna alla Home.

## Struttura della cartella prodotta

```
Formazione/
└── 2026-10-26_Montaggio_pompa_P200/
    ├── tutorial_input.md        ← l'unico testo che Claude legge
    ├── foto/                    ← P01_00h01m23s4.jpg, P02_..._dettaglio.jpg
    └── _archivio/               ← Claude lo ignora
        ├── indice.json          ← tutti i dati del progetto (usati dall'app)
        ├── audio_completo.m4a
        └── foto_originali/
```

## Dove cambiare le cose più comuni

| Cosa | File | Dove |
|---|---|---|
| Velocità massima della barra (50x), zona morta (5%) | `schermate/BarraScorrimento.kt` | `object CurvaVelocita` |
| Striscia di anteprime: altezza, larghezza delle miniature vicine, quota compressa ai lati | `schermate/StrisciaAnteprime.kt` | `object ImpostazioniStriscia` |
| Numero e dimensione delle miniature (max 400, alte 90 px, almeno 1 s di distanza) | `media/GeneratoreMiniature.kt` | costanti in alto |
| Velocità oltre la quale il video scorre "a salti" (4x) | `schermate/ProgettoViewModel.kt` | `VELOCITA_MAX_RIPRODUZIONE` |
| Soglia di avviso delle foto (25) | `schermate/ProgettoViewModel.kt` | `SOGLIA_FOTO` |
| Misura delle foto (1024 / 1280 px), nomi, colori dei pulsanti | `modello/TipoPasso.kt` | elenco dei tipi |
| Qualità JPG (85% ridotte, 95% originali) | `archivio/CartellaFormazione.kt` | `QUALITA_FOTO_...` |
| Formato dei nomi di cartelle e foto, formato dei tempi | `archivio/NomiFile.kt` | funzioni `nomeCartella`, `nomeFoto`, `tempoFoto` |
| Contenuto di `tutorial_input.md` | `testo/GeneratoreTutorialInput.kt` | funzione `genera` |
| Testi delle schermate | `schermate/Schermata*.kt` | testi tra virgolette |

Tutti i file Kotlin sono in `app/src/main/java/it/formazione/videotutorial/`.

## Struttura del codice

```
MainActivity.kt                 avvio dell'app e scelta della schermata
modello/                        i dati
  TipoPasso.kt                  i 4 tipi di foto
  Passo.kt                      una foto con tempo, tipo e commento
  SchedaVideo.kt                titolo, macchina, reparto, scopo, autore
  ProgettoVideo.kt              tutto il progetto + stato dell'audio
archivio/                       file e cartelle
  NomiFile.kt                   nomi puliti e tempi leggibili
  ImprontaVideo.kt              riconoscimento del video
  CartellaFormazione.kt         lettura e scrittura nella cartella condivisa
  Preferenze.kt                 valori ricordati
media/                          video e audio
  EstrattoreFotogrammi.kt       fotogramma dal video originale
  EstrattoreAudio.kt            copia dell'audio senza ricodifica
  GeneratoreMiniature.kt        miniature per la striscia di anteprime
  LavoroEstrazioneAudio.kt      lavoro in sottofondo per l'audio
testo/
  GeneratoreTutorialInput.kt    crea tutorial_input.md
schermate/                      interfaccia
  SchermataHome.kt, SchermataScheda.kt, SchermataPlayer.kt
  BarraScorrimento.kt           barra a ritorno automatico
  StrisciaAnteprime.kt          striscia di miniature con effetto "lente"
  ProgettoViewModel.kt          dati e operazioni (il "cervello")
```

## Come compilare

**Senza installare nulla (consigliato).** L'APK viene compilato da GitHub Actions a ogni modifica della cartella `VideoTutorial/`. Lo trovi nella pagina **Releases** del repository, con il nome `VideoTutorial.apk`. Per ricompilarlo a mano apri la scheda **Actions**, scegli **Compila APK VideoTutorial** e premi **Run workflow**.

**Sul computer.** Apri la cartella `VideoTutorial` con Android Studio e premi *Build > Build APK(s)*. In alternativa, da terminale:

```
./gradlew assembleRelease
```

L'APK si trova in `app/build/outputs/apk/release/app-release.apk`.

**Firma.** Android installa solo APK firmati. Nel repository non c'è nessuna chiave: sarebbe visibile a tutti.
- **Senza configurare nulla** l'APK viene firmato con una chiave di debug, che cambia a ogni compilazione su GitHub. Per installare una versione nuova devi prima disinstallare la precedente. I dati nella cartella "Formazione" restano; l'app dimentica solo la cartella scelta e gli ultimi valori della scheda.
- **Con una chiave fissa** ogni versione si installa sopra la precedente. Basta farlo una volta:
  1. Crea la chiave sul computer (serve Java): `keytool -genkeypair -keystore firma.jks -alias videotutorial -keyalg RSA -keysize 2048 -validity 10000`. Scegli una password e conservala insieme al file.
  2. Converti il file in testo: `base64 -w0 firma.jks` (su Mac: `base64 -i firma.jks`).
  3. Su GitHub apri il repository, poi *Settings > Secrets and variables > Actions > New repository secret*, e crea tre secrets:
     - `FIRMA_BASE64`: il testo ottenuto al punto 2;
     - `FIRMA_PASSWORD`: la password;
     - `FIRMA_ALIAS`: `videotutorial`.

  Da quel momento GitHub Actions firma sempre con la stessa chiave. Non mettere mai il file `firma.jks` nel repository.

Aumenta `versionCode` in `app/build.gradle.kts` a ogni nuova versione.

## Come provare l'app sul telefono

1. Scarica `VideoTutorial.apk` dal telefono, dalla pagina Releases.
2. Apri il file. La prima volta Android chiede di consentire l'installazione da questa fonte (browser o app File): consentila.
3. Apri **Video Tutorial**, premi **Scegli la cartella** e crea o seleziona la cartella "Formazione".
   - Consiglio: usa una cartella del telefono sincronizzata con il cloud (app di OneDrive, Google Drive tramite un'app di sincronizzazione, ecc.). Non tutte le app cloud compaiono nella finestra di scelta delle cartelle.
4. Premi **Apri un video** e compila la scheda.
5. Scorri il video con la barra, cattura qualche foto, scrivi i commenti, poi premi **Termina**.
6. Controlla la cartella creata con l'app File: dentro trovi `tutorial_input.md`, `foto/` e `_archivio/`.
7. Riapri lo stesso video: l'app deve riconoscerlo e riaprire la stessa cartella.

## Fasi successive

- **Fase 2:** trascrizione del parlato con i tempi (righe PARLATO nella cronologia e `trascrizione.srt`), commento a voce tenendo premuto il pulsante, conversione dell'audio non AAC.
- **Fase 3:** elenco dei passi con miniature, correzione di ±0,1 s, ritaglio del dettaglio, avviso per le foto doppie, fotogrammi di contesto e impostazioni.
