# Tocchi di Colore

Un'avventura per **Android** in **prima e terza persona** con grafica **pseudo-3D ad acquerello**,
ispirata al cortometraggio animato *«Out of Sight»* (敲敲, 2010) di Ya-Ting Yu, Ya-Hsuan Yeh e
Ling Chung (National Taiwan University of Arts).

Lia è una bambina che non vede. Mentre passeggia con il suo cane Biscotto, un ladro le strappa la
borsa: Biscotto lo insegue e sparisce in un buco della staccionata. Senza di lui il mondo diventa
**bianco**. Lia trova un bastoncino: ogni volta che bussa per terra (*toc toc*) il mondo si
**dipinge** intorno a lei. Il bastoncino diventa una bacchetta magica, Lia una piccola streghetta,
e oltre la staccionata comincia la città immaginata: il forno, il gattino del vicolo, la strada
diventata canale con le auto che galleggiano, gli abitanti-animali sul ponte, la libreria della
Tigre e la **balena del cielo**.

Tutti i disegni, la musica e i suoni sono **generati dal codice**: non ci sono immagini o file
audio esterni. Il motore 3D è [Three.js](https://threejs.org) (licenza MIT, nella cartella `www/lib`).

---

## Come avere il gioco sul telefono Android

### 1. Scaricare l'APK già pronto (consigliato)
Il repository contiene un "workflow" di GitHub Actions (`.github/workflows/android-apk.yml`) che,
a ogni modifica del gioco, **costruisce automaticamente l'app**:
1. Su GitHub apri la scheda **Actions** del repository e scegli l'ultima esecuzione di **«APK Android»**.
2. In fondo alla pagina, nella sezione **Artifacts**, scarica **TocchiDiColore-apk** (è uno zip).
3. Estrai `app-debug.apk` e copialo sul telefono.
4. Aprilo dal telefono: Android chiederà di permettere l'installazione da "origini sconosciute".

> È una versione "di debug": va benissimo per giocare e provare, ma per pubblicarla sul Play
> Store servirà una versione firmata (vedi più sotto).

### 2. Provarlo subito dal browser del telefono
Se il repository è pubblicato con **GitHub Pages**, apri l'indirizzo del sito seguito da
`/TocchiDiColore/www/`. Dal menu del browser puoi scegliere **«Aggiungi a schermata Home»**.

### 3. Costruire l'APK sul proprio computer
Servono [Node.js](https://nodejs.org) 22 e [Android Studio](https://developer.android.com/studio).
```
cd TocchiDiColore
npm install
npx cap sync android      # copia il gioco (cartella www) dentro il progetto Android
npx cap open android      # apre Android Studio: premi ▶ per installarlo sul telefono
```

### Provarlo sul computer
```
cd TocchiDiColore/www
python3 -m http.server 8000
```
poi apri `http://localhost:8000` (serve un piccolo server perché il gioco usa i moduli JavaScript).

---

## Comandi

| | Telefono / tablet | Computer |
|---|---|---|
| Muoversi | joystick: dito sulla metà **sinistra** | `W A S D` / frecce |
| Guardarsi intorno | trascina sulla metà **destra** | mouse (clic per agganciarlo) |
| Toc toc (bastone) | pulsante **Toc!** o tocco breve a destra | `Spazio` o clic |
| Parlare, entrare, toccare | pulsante che compare (es. **Parla**) | `E` |
| Correre | joystick spinto fino in fondo | `Shift` |
| Prima / terza persona | pulsante in alto a destra | `V` |
| Pausa | pulsante ‖ o tasto Indietro di Android | `Esc` |

La partita si salva da sola all'inizio di ogni capitolo (pulsante **Continua** nel menu).

---

## Com'è fatto

```
TocchiDiColore/
├── www/                     IL GIOCO (pagina web)
│   ├── index.html           schermate e pulsanti
│   ├── css/stile.css        aspetto dell'interfaccia (carta e acquerello)
│   ├── lib/                 Three.js
│   └── js/
│       ├── main.js          il cuore: avvio, ciclo di gioco, comandi per la storia
│       ├── config.js        ⚙️ parametri regolabili (velocità, qualità, volumi...)
│       ├── dati/
│       │   ├── storia.js    📖 LA STORIA, capitolo per capitolo (dialoghi compresi)
│       │   ├── tipi.js      legenda delle mappe e tipi di oggetti
│       │   └── luoghi/      🗺️ le mappe: via, città oltre la staccionata, interni
│       ├── arte/            🎨 i "pittori": disegnano tutto all'avvio
│       │   ├── pennello.js  pennelli comuni (acquerello, inchiostro seppia, foglie)
│       │   ├── personaggi.js  Lia, Biscotto, il gattino, il ladro
│       │   ├── comparse.js    fornaia, passanti, abitanti-animali
│       │   ├── texture.js     muri, pavimenti, interni
│       │   ├── oggetti.js     alberi, lampioni, pane, auto...
│       │   ├── cielo.js       nuvole, balena, panorami, particelle
│       │   └── galleria.js    raccoglie i disegni e li passa alla scheda grafica
│       ├── motore/          🖥️ la grafica 3D
│       │   ├── materiali.js   shader: mondo bianco che si colora, onde, foschia
│       │   ├── costruttore.js dalla mappa al mondo 3D
│       │   ├── sagoma.js      personaggi come "sagome di carta" (pseudo 3D)
│       │   ├── acquerello.js  filtro acquerello a tutto schermo
│       │   ├── particelle.js  scintille, petali, note, profumi, fumo...
│       │   ├── camera.js      prima/terza persona e inquadrature
│       │   └── volo.js        il volo sulla balena sopra la città
│       └── gioco/           🎮 le regole
│           ├── mondo.js       griglia, collisioni, percezione
│           ├── giocatore.js   Lia
│           ├── attori.js      Biscotto, abitanti, auto, piccioni
│           ├── audio.js       effetti sonori (generati) e suono "3D"
│           ├── musica.js      colonna sonora (composta dal codice)
│           ├── input.js       touch, tastiera, mouse, tasto Indietro
│           ├── interfaccia.js dialoghi, obiettivi, menu
│           └── regista.js     attese ed eventi della storia
├── android/                 progetto Android Studio (creato con Capacitor)
├── capacitor.config.json    nome e identificativo dell'app
└── package.json             strumenti per costruire l'app
```

### L'effetto "pseudo 3D ad acquerello"
- Il mondo è una **griglia** (le mappe in `dati/luoghi`): ogni lettera è un muro, ogni simbolo un
  pavimento. Il costruttore ne fa un mondo 3D con marciapiedi, canale e ponte a quote diverse.
- **Personaggi e oggetti** sono disegni piatti che si girano sempre verso la telecamera, come in un
  teatrino di carta: per questo hanno lo stesso stile del cartone animato (contorni seppia, colori
  pastello). Ogni personaggio ha i disegni di fronte, di spalle e di lato.
- Uno **shader** decide il colore di ogni punto: dove Lia non percepisce c'è carta bianca con pochi
  tratti a matita; dove percepisce, colori pieni. Le **onde** (bastone, abbai, profumi) allargano la
  zona colorata.
- Alla fine un **filtro acquerello** ridipinge l'immagine: grana della carta, bordi di pigmento più
  scuri, colori che sbavano, bagliori e il leggero "tremolio" dei disegni animati a mano.

### Piccole modifiche da provare
- **Cambiare un dialogo**: apri `www/js/dati/storia.js` e modifica le frasi tra apici.
- **Lia più veloce**: in `www/js/config.js` cambia `velocita: 1.7`.
- **Mondo più o meno visibile senza bastone**: in `config.js` cambia `schizzo` (0 = tutto bianco).
- **Spostare un albero**: nei file di `www/js/dati/luoghi/`, ogni oggetto ha coordinate `x` (verso
  est) e `y` (verso sud) in caselle.
- **Nuovo dialogo con un abitante**: aggiungi frasi in `chiacchiere` del personaggio nel suo luogo.

Dopo ogni modifica: per il computer basta ricaricare la pagina; per Android rifai
`npx cap sync android` (o lascia che GitHub ricostruisca l'APK).

### Pubblicare sul Play Store (in futuro)
Serve un APK/AAB **firmato**: in Android Studio *Build → Generate Signed Bundle / APK*, poi si carica
sulla [Google Play Console](https://play.google.com/console).
