# Tocchi di Colore

Un piccolo gioco di esplorazione **in prima e terza persona** con grafica **pseudo-3D**,
che funziona nel browser di computer, telefoni e tablet.

Lia è una bambina che non vede. Un ladro le ha strappato la borsa e il suo cane
Biscotto si è lanciato all'inseguimento. Per trovarlo Lia usa l'udito, il tatto e
l'immaginazione: **ogni colpo di bastone manda un'onda** che "dipinge" ad acquerello
ciò che Lia percepisce. Il resto del mondo è un foglio di carta con qualche tratto
a matita, e i colori sbiadiscono piano piano se non li si "ascolta" di nuovo.

Il tema è ispirato al cortometraggio animato *Out of Sight* (2010). Personaggi,
luoghi, grafica e suoni del gioco sono originali.

---

## Come si gioca

Apri `index.html` in un browser (Chrome, Edge, Firefox, Safari). Non servono
installazioni: grafica e suoni sono generati dal codice.

| Azione | PC | Telefono / tablet |
|---|---|---|
| Muoversi | `W` `A` `S` `D` o frecce | joystick: appoggia il dito sulla metà sinistra |
| Guardarsi intorno | mouse (clicca sul gioco per agganciarlo) | trascina il dito sulla metà destra |
| Battere il bastone | `Spazio` o clic | tocco breve sulla metà destra, o pulsante **Tocca** |
| Correre | `Shift` | spingi il joystick fino in fondo |
| Prima / terza persona | `V` | pulsante con l'occhio in alto a destra |
| Mappa mentale | `M` | pulsante con la mappa |

**Obiettivo:** segui l'abbaiare di Biscotto (ogni abbaio colora i dintorni) fino a
ritrovarlo. Lungo la strada puoi raccogliere **5 ricordi** (pane, fiore, campanella,
conchiglia, carillon): ognuno rende il mondo più colorato. I ricordi tintinnano:
usa le cuffie e segui il suono!

### Provarlo sul telefono

- Se il repository è pubblicato con **GitHub Pages**, apri l'indirizzo del sito
  seguito da `/TocchiDiColore/`.
- Dal menu del browser scegli **"Aggiungi a schermata Home"**: il gioco si aprirà a
  schermo intero come un'app (grazie al file `manifest.webmanifest`).

### Provarlo sul computer senza internet

Basta fare doppio clic su `index.html`. In alternativa, dalla cartella del gioco:

```
python3 -m http.server 8000
```

e poi apri `http://localhost:8000` nel browser.

---

## Com'è fatto il codice

Ogni file ha un compito preciso ed è commentato in italiano.

```
TocchiDiColore/
├── index.html           la pagina: canvas del gioco, menu, pulsanti
├── css/stile.css        aspetto dell'interfaccia (stile carta e matita)
├── manifest.webmanifest + icone   per "installare" il gioco sul telefono
└── js/
    ├── config.js        ⚙️  PARAMETRI: velocità, qualità grafica, onde, memoria
    ├── ambientazione.js 🗺️  IL MONDO: mappa, colori, oggetti, percorso del cane, testi
    ├── utilita.js       funzioni di matematica, colore e disegno
    ├── texture.js       disegna le texture di muri, pavimenti e cielo
    ├── sprite.js        disegna Lia, Biscotto e gli oggetti
    ├── mondo.js         la griglia, la percezione, le onde, gli oggetti animati
    ├── giocatore.js     movimento di Lia, collisioni, passi, bastone
    ├── cane.js          Biscotto: tappe, corsa, abbaio
    ├── camera.js        prima e terza persona con transizione morbida
    ├── renderer.js      il motore grafico pseudo-3D (raycasting)
    ├── input.js         tastiera, mouse, touch e joystick
    ├── audio.js         suoni generati con la Web Audio API (anche "spaziali")
    ├── interfaccia.js   menu, messaggi, icone, mappa mentale
    └── main.js          avvio e ciclo principale (circa 60 volte al secondo)
```

### Come funziona la grafica pseudo-3D

Il mondo è una **griglia 2D** (la mappa in `ambientazione.js`). Per ogni colonna di
pixel dello schermo il renderer lancia un **raggio** e trova i muri che incontra:
più un muro è lontano, più viene disegnato piccolo. Questa tecnica si chiama
*raycasting*. In più il motore gestisce:

- **muri di altezze diverse** (case alte, siepi e staccionate basse da cui si vede oltre);
- **pavimento e cielo** con texture (il cielo è un panorama che ruota con lo sguardo);
- **sprite** (personaggi e oggetti) con **ombre** morbide, nascosti correttamente dietro ai muri;
- l'**effetto acquerello**: ogni pixel parte dal colore della carta e si colora in base
  a quanto Lia percepisce quella zona, con bordi irregolari come macchie di colore.

L'immagine viene calcolata in piccolo (circa 390 × 220 pixel) e poi ingrandita in modo
morbido: così è leggera anche per i telefoni e mantiene un aspetto "dipinto". Se il
dispositivo fatica, la qualità si abbassa da sola.

---

## Piccole modifiche da provare

**Cambiare la velocità di Lia** — in `js/config.js`:
```js
velocita: 1.7,        // prova 2.5
```

**Vedere di più anche senza percepire** — in `js/config.js` alza `schizzoIntensita`
(0 = solo carta bianca, 1 = schizzi molto evidenti).

**Grafica a pixel netti, stile retrò** — in `js/config.js` metti `levigatura: false`.

**Cambiare i colori di una casa** — in `js/ambientazione.js`, sezione `muri`:
```js
A: { nome: 'Casa rosa', ... colori: { base: '#f2b9b3', accento: '#8cc0ad', ... } },
```

**Modificare la mappa** — in `js/ambientazione.js`, ogni carattere della `mappa` è una
casella (la legenda è scritta sopra la mappa). Tutte le righe devono avere la stessa
lunghezza. Se il cane deve passare dove hai messo un muro, aggiorna anche il suo
`percorso`.

**Aggiungere un oggetto** — in `js/ambientazione.js`, nella lista `oggetti`:
```js
{ tipo: 'albero', x: 5.5, y: 12.2 },
{ tipo: 'pesce', movimento: { cx: 12.5, cy: 6, raggio: 1.5, velocita: 0.6, fase: 0, z: 0.6, ampiezzaZ: 0.1 } },
```
I tipi disponibili sono in `tipiOggetto` (albero, alberoSogno, cespuglio, lampione,
panchina, fontana, fioriera, girasole, fungo, gatto, borsa, pesce, farfalla e i ricordi).

**Cambiare i testi** — sono tutti in fondo ad `ambientazione.js` (sezione `testi` e `inneschi`).

---

## E per farne un'app "vera"?

Il gioco è già un'app web installabile. Se un giorno vorrai pubblicarlo negli store:

- **Android / iPhone:** strumenti come *Capacitor* "impacchettano" una pagina web in
  un'app nativa senza riscrivere il gioco.
- **Windows / Mac / Linux:** strumenti come *Electron* o *Tauri* fanno lo stesso per il computer.
