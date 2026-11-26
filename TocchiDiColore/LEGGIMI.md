# Tocchi di Colore

Un **cartone animato da giocare** per **Android**, ad acquerello, ispirato al cortometraggio animato *«Out of Sight»* (敲敲, 2010) di Ya-Ting Yu, Ya-Hsuan Yeh e
Ling Chung (National Taiwan University of Arts).

Lia è una bambina che non vede. Mentre passeggia con il suo cane Gogo, un ladro le strappa la
borsa: Gogo lo insegue e sparisce in un buco della staccionata. Senza di lui il mondo diventa
**bianco**. Lia trova un bastoncino: ogni volta che bussa per terra (*toc toc*) il mondo si
**dipinge** intorno a lei. Il bastoncino diventa una bacchetta magica, Lia una piccola streghetta,
e oltre la staccionata comincia la città immaginata: il forno, il gattino del vicolo, la strada
diventata canale con le auto che galleggiano, gli abitanti-animali sul ponte, la libreria della
Tigre e la **balena del cielo**.

Tutti i disegni, la musica e i suoni sono **generati dal codice**: non ci sono immagini o file
audio esterni. Il motore grafico è [Three.js](https://threejs.org) (licenza MIT, nella cartella `www/lib`).

**Per i più piccoli (2 anni):** non c'è niente da leggere e niente da sbagliare. Niente dialoghi,
niente pulsanti da cercare, niente fermate: Lia cammina da sola e la storia scorre come un cartone
animato, mentre la telecamera la riprende come in un film. La bimba **tocca lo schermo**: nel punto
toccato nascono fiori, farfalle, bolle, note, stelle, uccellini o un palloncino, e una nota del
carillon (tocco dopo tocco nasce una melodia); dopo il bastoncino, il mondo bianco si colora proprio
da lì. Toccando un personaggio, quello fa festa (salta, fa il suo verso, lancia cuori). Se nessuno
tocca per qualche secondo, Lia batte il bastone da sola. Il codice è in `gioco/sorprese.js`.

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
| Cominciare | il grande pulsante **▶** | clic |
| Sorprese, colori, bastone / bacchetta | **tocca lo schermo dove vuoi** | clic (o `Spazio` davanti ai piedi) |
| Far fare festa a un personaggio | toccalo | clic |
| Pausa (per i grandi) | pulsante ‖ piccolo, o tasto Indietro di Android | `Esc` |

Lia cammina da sola. La partita si salva all'inizio di ogni capitolo (pulsante **Continua** nel
menu). Alla fine, il grande pulsante **↺** ricomincia la storia.

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
│       │   ├── storia.js    📖 LA STORIA, capitolo per capitolo (senza parole: scorre da sola)
│       │   └── scene/       🎬 le scene: percorso di Lia, INQUADRATURE, attori, porte
│       │       (via, piazza, forno, canale, libreria, terrazza, piazzetta)
│       ├── arte/            🎨 i "pittori": disegnano tutto con il codice
│       │   ├── pennello.js    pennelli comuni (acquerello, inchiostro seppia, foglie)
│       │   ├── scene_*.js     i fondali dipinti di ogni scena, a piani separati
│       │   ├── personaggi.js  Lia, Gogo, il gattino, il ladro
│       │   ├── comparse.js    fornaia, passanti, abitanti-animali
│       │   ├── fiabe.js       rana, lampione vivo, pesci volanti, pecore-nuvola...
│       │   ├── pioggia.js     auto-pesce, autobus-pesce, balena con le pinne, ombrelli
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
│       │   ├── effetti.js     onomatopee, archi sonori, nastri di profumo, simboli manga
│       │   └── volo.js        il volo sulla balena sopra la città
│       └── gioco/           🎮 le regole
│           ├── percorso.js    la strada (anche curva, in salita) su cui cammina Lia
│           ├── lia.js         Lia: camminare, correre, toc toc, urti, pose
│           ├── percezione.js  il mondo bianco che si colora con le onde
│           ├── magia.js       lo spettacolo della rivelazione, i colori dei materiali
│           ├── meraviglie.js  le meraviglie nascoste e i personaggi che si svegliano
│           ├── sorprese.js    a ogni tocco una sorpresa; i personaggi toccati fanno festa
│           ├── meteo.js       la pioggia, la strada-fiume, la balena e la sua ombra
│           ├── attori.js      Gogo, abitanti, auto, piccioni
│           ├── audio.js       strumenti, effetti sonori e ambienti (generati) e suono "3D"
│           ├── musica.js      colonna sonora (composta dal codice)
│           ├── input.js       touch, tastiera, tasto Indietro
│           ├── interfaccia.js menu, pausa, opzioni, segno del dito, finale
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

### La magia della rivelazione
Quando la bacchetta bussa (o Gogo abbaia, o arriva un profumo) il mondo si scopre in tre tempi:
prima i **contorni a matita**, poi il **colore che si spande come acquerello bagnato** con un bordo
di pigmento e una velatura d'oro (rosa per i profumi, arancio per l'abbaio, azzurro per i suoni);
le zone appena scoperte **brillano di stelline** per un paio di secondi. Sul fronte dell'onda nascono
stelle e fiorellini (bacchetta), note (suoni), petali (profumi); il colpo increspa lo schermo e suona
una nota di carillon: bussando nasce una melodia. Il codice è in `gioco/magia.js` (spettacolo e
particelle) e in `motore/materiali.js` (la funzione `rivelazione` dello shader).

**Tocca lo schermo, e il mondo si rivela da lì**: non c'è più il pulsante «Toc!». Il dito sullo
schermo diventa il bastone: il gioco lancia un raggio dalla telecamera attraverso il punto toccato
(`_toccoSchermo` in `main.js`, `colpisci` in `motore/scena.js`), trova il muro o il pavimento dipinto
che c'è sotto (scartando le parti trasparenti del disegno) e Lia batte proprio lì
(`toccaPunto` in `gioco/lia.js`). Con il bastoncino arriva solo vicino a sé (2,4 m); con la
bacchetta magica una cometa di stelline vola fino al punto, anche lontano, e la camera la segue con
lo sguardo. Le distanze sono in `config.js`, sotto `bacchetta`. Toccando una persona vicina, Lia ci
parla.

**Il bastone che tocca il mondo**: Lia cammina rasente ai muri (come nel film) e il bastone batte
sul materiale toccato (con la tastiera, `Spazio`, alterna il pavimento e la parete). Ogni materiale ha il suo suono e il suo colore: il vetro
tintinna e si colora d'azzurro, il legno fa "tok" ed è caldo come il miele, il metallo risuona
"dong", le foglie frusciano... La prima volta che tocca un materiale, Lia dice che cosa immagina.
I materiali di ogni tratto sono scritti in `materiali` nei file di `dati/scene/`, la distanza dal
muro in `vicinoAlMuro`.

**Personaggi delle fiabe** (`arte/fiabe.js`): il lampione che si sveglia, la chiocciola postina,
la rana violinista, il topolino sulla barchetta di carta, i pesci volanti, le pecore-nuvola,
l'orsetto in mongolfiera, il gufo bibliotecario e i fiori che cantano.

**Suoni e profumi dipinti** (`motore/effetti.js`): ogni suono ha la sua scritta da fumetto
("BAU!", "TOK!", "TIN!", "SPLASH!") e gli archi sonori; i profumi sono nastri colorati che
volteggiano fino al naso di Lia; chi corre lascia una scia di vento.

**La pioggia immaginata** (`gioco/meteo.js`, disegni in `arte/pioggia.js`): nel capitolo 1 comincia a
piovere; Lia sente le auto nelle pozzanghere e immagina la strada come un fiume con le auto-pesce,
gli animali che aspettano l'autobus-pesce sotto gli ombrelli e una balena con tante pinne che nuota
nel cielo stendendo la sua ombra sulla via.

**Stile manga/anime**: contorno d'inchiostro e luce di bordo su tutti i personaggi; il mondo non
ancora scoperto è un disegno a matita su carta bianca (il retino manga si riaccende con `uRetino` in
`motore/materiali.js`); linee di concentrazione nei
momenti forti e linee di velocità quando Lia corre; simboli sopra la testa ("!", gocce, note,
stelline); ombre lilla e ombre delle nuvole che passano; il sole con il bagliore a raggi.

**Musica e suoni** (`gioco/audio.js`, `gioco/musica.js`): all'avvio il gioco "registra" da solo
i suoi strumenti (pianoforte, celesta, carillon, arpa, archi, flauto, clarinetto, violino, coro) e
le sette musiche sono brani veri con melodia, accordi e basso, che sfumano l'uno nell'altro. Il
bastone sui materiali usa la "sintesi modale" (il vetro tintinna a lungo, il legno fa un tok
breve e caldo, il metallo risuona); Gogo abbaia, il gattino miagola e Lia chiama «Go-go!» con voci
sintetiche; c'è un riverbero comune che mette tutto nello stesso spazio.

**L'ultima mano di acquerello** (`arte/finitura.js`): tutti i fondali e gli oggetti di scena,
appena dipinti dal codice, ricevono una "finitura" come gli acquerelli veri del film: il pigmento
si accumula sui bordi delle macchie, il colore si spande appena, le velature sono irregolari e la
grana della carta trattiene il colore. Si regola con `finitura` in `config.js` (0 = spenta).

**Anteprima del nuovo motore 3D ad acquerello** (`www/nuovo/`, pulsante «Anteprima: mondo 3D»
nel menu): una prova di come potrebbe diventare il gioco con un mondo 3D vero invece dei fondali
piatti. Le case, la strada, gli alberi, Lia e Gogo sono fatti di forme 3D create dal codice e
dipinti in tempo reale come un acquerello (velature, linee a inchiostro, bordi bagnati, grana della
carta). Il mondo comincia a matita su carta bianca e si colora da dove si tocca. La telecamera può
girare intorno, salire, scendere. Per ora c'è una sola via; il gioco vero usa ancora il motore a
fondali dipinti.

**Disegni fatti a mano** (`arte/dipinti_a_mano.js`): qualunque fondale, personaggio o oggetto può
essere sostituito da un'immagine dipinta a mano, per arrivare alla qualità di un cartone vero.
1. Apri il gioco nel browser del computer, entra in una scena e nella console (F12) scrivi
   `esportaDisegni()` (fondali della scena) oppure `esportaDisegni('atlanti')` (personaggi e
   oggetti): scarichi i PNG con misure e disposizione giuste, da usare come traccia.
2. Ridipingili (stesse misure, trasparenza dove non c'è niente) e mettili in `www/img/dipinti/`.
3. Scrivi i nomi in `www/img/dipinti/elenco.json`, per esempio
   `{ "strati": { "via/facciate_1": "via_facciate_1.png" }, "atlanti": { "gogo": "gogo.png" } }`.
Usa solo disegni tuoi o di cui hai il permesso: i fotogrammi del film appartengono ai loro autori.

**Meraviglie nascoste ✦**: in ogni scena (`meraviglie` nei file di `dati/scene/`) ci sono cose che
prendono vita quando un'onda le raggiunge — farfalle, uccellini in volo, palloncini, pagine che
volano, bolle nel canale — e il contatore in alto sale. Il codice è in `gioco/meraviglie.js`.

### Piccole modifiche da provare
- **Lia più lenta o più veloce quando cammina da sola**: in `www/js/config.js`, sotto `bimbi`,
  cambia `passo` (metri al secondo); `toccoDaSola` sono i secondi dopo cui bussa da sola.
- **Cambiare l'ordine delle sorprese**: in `www/js/gioco/sorprese.js` modifica la lista `GIRO`.
- **Lia più veloce**: in `www/js/config.js` cambia `velocita: 0.95` (metri al secondo).
- **Cambiare un'inquadratura**: in `www/js/dati/scene/via.js`, sotto `inquadrature`, cambia i
  numeri di `pos` (dove sta la telecamera rispetto a Lia: destra, alto, verso di noi) e `guarda`
  (dove guarda). Con `taglio: true` il passaggio è uno stacco netto, senza è una carrellata.
- **Mondo più o meno visibile senza bastone**: in `config.js` cambia `schizzo` (0 = tutto bianco).
- **Grafica più nitida o più leggera**: in `config.js`, sotto `preimpostazioni`, `pixelRatio` è la
  risoluzione con cui si disegna il mondo, `uscita` quella dell'immagine finale, `campioni`
  l'antialiasing. In automatico il gioco scende di livello se il telefono fatica e risale se è fluido.
- **Bacchetta che arriva più lontano**: in `config.js`, sotto `bacchetta`, cambia `portataMagica`.
- **Nuova meraviglia**: in un file di `dati/scene/`, sotto `meraviglie`, aggiungi una riga come
  `{ id: 'gatto', x: 20, y: 1, z: -1.5, effetto: 'farfalle', testo: 'Un gatto sul davanzale!' }`
  (effetti: farfalle, uccelli, fiori, note, stelle, palloncino, pagine, bolle).
- **Magia più o meno forte**: in `gioco/magia.js` cambia `densita` (quante particelle) nella
  tabella `SPETTACOLO`.

Dopo ogni modifica: per il computer basta ricaricare la pagina; per Android rifai
`npx cap sync android` (o lascia che GitHub ricostruisca l'APK).

### Pubblicare sul Play Store (in futuro)
Serve un APK/AAB **firmato**: in Android Studio *Build → Generate Signed Bundle / APK*, poi si carica
sulla [Google Play Console](https://play.google.com/console).
