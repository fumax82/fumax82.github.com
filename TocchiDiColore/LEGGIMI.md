# Tocchi di Colore

Un **cartone animato da giocare** per **Android**, ad acquerello, ispirato al cortometraggio animato *«Out of Sight»* (敲敲, 2010) di Ya-Ting Yu, Ya-Hsuan Yeh e
Ling Chung (National Taiwan University of Arts).

Lia è una bambina che non vede. Mentre passeggia con il suo cane Biscotto, un ladro le strappa la
borsa: Biscotto lo insegue e sparisce in un buco della staccionata. Senza di lui il mondo diventa
**bianco**. Lia trova un bastoncino: ogni volta che bussa per terra (*toc toc*) il mondo si
**dipinge** intorno a lei. Il bastoncino diventa una bacchetta magica, Lia una piccola streghetta,
e oltre la staccionata comincia la città immaginata: il forno, il gattino del vicolo, la strada
diventata canale con le auto che galleggiano, gli abitanti-animali sul ponte, la libreria della
Tigre e la **balena del cielo**.

Tutti i disegni, la musica e i suoni sono **generati dal codice**: non ci sono immagini o file
audio esterni. Il motore grafico è [Three.js](https://threejs.org) (licenza MIT, nella cartella `www/lib`).

**Come si gioca:** Lia cammina avanti e indietro come in un gioco a piattaforme (frecce ◀ ▶), ma
la telecamera la riprende come in un film: di tre quarti, dal basso, di spalle nel vicolo, dal
canale mentre attraversa il ponte, con stacchi di montaggio e carrellate che cambiano direzione
mentre cammina.

---

## Come avere il gioco sul telefono Android

### 1. Scaricare l'APK già pronto (consigliato)
Il repository contiene un "workflow" di GitHub Actions (`.github/workflows/android-apk.yml`) che,
a ogni modifica del gioco, **costruisce automaticamente l'app** e la pubblica nella Release «apk»:
1. Dal telefono apri il link
   `https://github.com/fumax82/fumax82.github.com/releases/download/apk/TocchiDiColore.apk`
2. Apri il file scaricato: Android chiederà di permettere l'installazione da "origini sconosciute".

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
| Camminare | frecce **◀ ▶** in basso a sinistra | `A D` / frecce `← →` |
| Correre | tieni premuta la freccia per un po' | `Shift` |
| Toc toc (bastone) | pulsante **Toc!** o tocco breve sullo schermo | `Spazio` o clic |
| Parlare, entrare, toccare | pulsante che compare (es. **Parla**) | `E` o freccia `↑` |
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
│       │   └── scene/       🎬 le scene: percorso di Lia, INQUADRATURE, attori, porte
│       │       (via, piazza, forno, canale, libreria, terrazza, piazzetta)
│       ├── arte/            🎨 i "pittori": disegnano tutto con il codice
│       │   ├── pennello.js    pennelli comuni (acquerello, inchiostro seppia, foglie)
│       │   ├── scene_*.js     i fondali dipinti di ogni scena, a piani separati
│       │   ├── personaggi.js  Lia, Biscotto, il gattino, il ladro
│       │   ├── comparse.js    fornaia, passanti, abitanti-animali
│       │   ├── texture.js     facciate e pavimenti usati dai pittori delle scene
│       │   ├── oggetti.js     alberi, lampioni, pane, auto...
│       │   ├── cielo.js       nuvole, balena, panorami, particelle
│       │   └── galleria.js    raccoglie i disegni e li passa alla scheda grafica
│       ├── motore/          🖥️ la grafica
│       │   ├── strati.js      i piani dipinti appesi nello spazio (tecnica "multiplane")
│       │   ├── scena.js       monta una scena: piani, cielo, panorami, attori
│       │   ├── regia.js       🎥 la telecamera "da regista": inquadrature e stacchi
│       │   ├── materiali.js   shader: mondo bianco che si colora, onde, acqua, sfocatura
│       │   ├── sagoma.js      personaggi come "sagome di carta"
│       │   ├── acquerello.js  filtro acquerello a tutto schermo
│       │   ├── particelle.js  scintille, petali, note, profumi, fumo...
│       │   └── volo.js        il volo sulla balena sopra la città
│       └── gioco/           🎮 le regole
│           ├── percorso.js    la strada (anche curva, in salita) su cui cammina Lia
│           ├── lia.js         Lia: camminare, correre, toc toc, urti, pose
│           ├── percezione.js  il mondo bianco che si colora con le onde
│           ├── attori.js      Biscotto, abitanti, auto, piccioni
│           ├── audio.js       effetti sonori (generati) e suono "3D"
│           ├── musica.js      colonna sonora (composta dal codice)
│           ├── input.js       touch, tastiera, tasto Indietro
│           ├── interfaccia.js dialoghi, obiettivi, menu
│           └── regista.js     attese ed eventi della storia
├── android/                 progetto Android Studio (creato con Capacitor)
├── capacitor.config.json    nome e identificativo dell'app
└── package.json             strumenti per costruire l'app
```

### Un cartone animato "a piani" (multiplane)
- Ogni scena è fatta di **piani dipinti** ad acquerello (facciate, marciapiede, strada, alberi,
  staccionata...) appesi nello spazio a profondità diverse, come le quinte di un teatro o i vetri
  della *multiplane camera* dei vecchi cartoni. Quando la telecamera si muove, i piani vicini
  scorrono più in fretta di quelli lontani: nasce la profondità.
- Lia si muove su un **percorso** (una linea nello spazio): può girare in un vicolo, salire su un
  ponte o una scala. Il giocatore sceglie solo destra o sinistra.
- La **regia** (`motore/regia.js`) sceglie l'inquadratura secondo il punto in cui si trova Lia:
  carrellate laterali, inquadrature di tre quarti, dal basso, di spalle, campi larghi, stacchi.
  Le inquadrature sono scritte in ogni file di `dati/scene/`, sotto `inquadrature`.
- Uno **shader** decide il colore di ogni punto: dove Lia non percepisce c'è carta bianca con
  tratti a matita (ricavati dai contorni del dipinto); dove percepisce, colori pieni. Le **onde**
  (bastone, abbai, profumi) allargano la zona colorata. I piani fuori fuoco sono un po' sfocati.
- Alla fine un **filtro acquerello** ridipinge l'immagine: grana della carta, bordi di pigmento più
  scuri, colori che sbavano, bagliori e il leggero "tremolio" dei disegni animati a mano.

### Piccole modifiche da provare
- **Cambiare un dialogo**: apri `www/js/dati/storia.js` e modifica le frasi tra apici.
- **Lia più veloce**: in `www/js/config.js` cambia `velocita: 0.95` (metri al secondo).
- **Cambiare un'inquadratura**: in `www/js/dati/scene/via.js`, sotto `inquadrature`, cambia i
  numeri di `pos` (dove sta la telecamera rispetto a Lia: destra, alto, verso di noi) e `guarda`
  (dove guarda). Con `taglio: true` il passaggio è uno stacco netto, senza è una carrellata.
- **Mondo più o meno visibile senza bastone**: in `config.js` cambia `schizzo` (0 = tutto bianco).
- **Nuovo dialogo con un abitante**: aggiungi frasi in `chiacchiere` del personaggio nella sua scena.

Dopo ogni modifica: per il computer basta ricaricare la pagina; per Android rifai
`npx cap sync android` (o lascia che GitHub ricostruisca l'APK).

### Pubblicare sul Play Store (in futuro)
Serve un APK/AAB **firmato**: in Android Studio *Build → Generate Signed Bundle / APK*, poi si carica
sulla [Google Play Console](https://play.google.com/console).
