/* ==========================================================================
 *  utilita.js — FUNZIONI DI SUPPORTO
 *  --------------------------------------------------------------------------
 *  Piccole funzioni matematiche, di colore e di disegno usate da tutti
 *  gli altri file. Non contengono logica di gioco.
 * ========================================================================== */
(function () {
  'use strict';

  const Gioco = (window.Gioco = window.Gioco || {});
  const DUE_PI = Math.PI * 2;

  const U = {};

  /* ----------------------------- MATEMATICA ----------------------------- */

  /** Restringe un valore tra un minimo e un massimo. */
  U.limita = function (valore, minimo, massimo) {
    return valore < minimo ? minimo : valore > massimo ? massimo : valore;
  };

  /** Interpolazione lineare: t=0 restituisce a, t=1 restituisce b. */
  U.interpola = function (a, b, t) {
    return a + (b - a) * t;
  };

  /** Curva "morbida" (smoothstep): parte e arriva lentamente. */
  U.morbido = function (t) {
    t = U.limita(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  /** Distanza tra due punti. */
  U.distanza = function (x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  };

  /** Differenza tra due angoli (b - a) riportata tra -π e +π. */
  U.differenzaAngolo = function (a, b) {
    let d = (b - a) % DUE_PI;
    if (d > Math.PI) d -= DUE_PI;
    if (d < -Math.PI) d += DUE_PI;
    return d;
  };

  /** Interpola tra due angoli seguendo la strada più breve. */
  U.interpolaAngolo = function (a, b, t) {
    return a + U.differenzaAngolo(a, b) * t;
  };

  /**
   * Generatore di numeri casuali "con seme": con lo stesso seme produce
   * sempre la stessa sequenza. Serve per avere texture sempre uguali.
   * Restituisce una funzione che dà numeri tra 0 e 1.
   */
  U.creaCasuale = function (seme) {
    let s = seme >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /**
   * Crea una griglia quadrata di "rumore" morbido (valori tra 0 e 1) che si
   * ripete senza cuciture. La usiamo per i bordi irregolari ad acquerello.
   *   dimensione: lato della griglia in celle (es. 64)
   *   celle:      quante "macchie" grandi per lato
   *   ottave:     quanti livelli di dettaglio sovrapporre
   */
  U.creaRumore = function (dimensione, celle, ottave, seme) {
    const casuale = U.creaCasuale(seme);
    const risultato = new Float32Array(dimensione * dimensione);
    let ampiezza = 1;
    let c = celle;
    for (let o = 0; o < ottave; o++) {
      const griglia = new Float32Array(c * c);
      for (let k = 0; k < griglia.length; k++) griglia[k] = casuale();
      for (let y = 0; y < dimensione; y++) {
        for (let x = 0; x < dimensione; x++) {
          const gx = (x / dimensione) * c;
          const gy = (y / dimensione) * c;
          const x0 = Math.floor(gx), y0 = Math.floor(gy);
          const x1 = (x0 + 1) % c, y1 = (y0 + 1) % c;
          const fx = U.morbido(gx - x0), fy = U.morbido(gy - y0);
          const a = griglia[y0 * c + x0], b = griglia[y0 * c + x1];
          const d = griglia[y1 * c + x0], e = griglia[y1 * c + x1];
          const sopra = a + (b - a) * fx;
          const sotto = d + (e - d) * fx;
          risultato[y * dimensione + x] += (sopra + (sotto - sopra) * fy) * ampiezza;
        }
      }
      ampiezza *= 0.5;
      c *= 2;
    }
    // Normalizza i valori tra 0 e 1
    let min = Infinity, max = -Infinity;
    for (const v of risultato) { if (v < min) min = v; if (v > max) max = v; }
    for (let k = 0; k < risultato.length; k++) risultato[k] = (risultato[k] - min) / (max - min);
    return risultato;
  };

  /**
   * Stabilisce da che lato vediamo un personaggio (fronte, retro o fianco).
   *   angoloSoggetto: dove guarda il personaggio
   *   dx, dy:         vettore dalla telecamera al personaggio
   * Restituisce { vista: 'fronte' | 'retro' | 'lato', specchio: true/false }.
   * Le immagini "di lato" sono disegnate rivolte a destra: se il personaggio
   * guarda a sinistra (dal nostro punto di vista) le specchiamo.
   */
  U.vistaDaAngolo = function (angoloSoggetto, dx, dy) {
    const angoloVista = Math.atan2(dy, dx);
    const d = U.differenzaAngolo(angoloVista, angoloSoggetto);
    const ad = Math.abs(d);
    if (ad < Math.PI / 4) return { vista: 'retro', specchio: false };
    if (ad > (3 * Math.PI) / 4) return { vista: 'fronte', specchio: false };
    return { vista: 'lato', specchio: d < 0 };
  };

  /* ------------------------------- COLORI ------------------------------- */

  /** '#rrggbb' → { r, g, b } */
  U.esadecimaleARgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };

  /** { r, g, b } → '#rrggbb' */
  U.rgbAEsadecimale = function (r, g, b) {
    const h = (v) => U.limita(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  };

  /** Mescola due colori esadecimali (t=0 → primo colore, t=1 → secondo). */
  U.mescola = function (hexA, hexB, t) {
    const a = U.esadecimaleARgb(hexA), b = U.esadecimaleARgb(hexB);
    return U.rgbAEsadecimale(
      a.r + (b.r - a.r) * t,
      a.g + (b.g - a.g) * t,
      a.b + (b.b - a.b) * t
    );
  };

  /**
   * "Impacchetta" un colore in un unico numero a 32 bit, il formato usato
   * dal buffer di pixel del renderer (ordine dei byte: rosso, verde, blu, alfa).
   */
  U.impacchetta = function (r, g, b) {
    return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
  };

  /* ------------------------------- DISEGNO ------------------------------- *
   * Scorciatoie per disegnare forme semplici su un canvas 2D. Le usano le
   * texture e gli sprite, che vengono disegnati "a mano" dal codice.
   * ----------------------------------------------------------------------- */
  const D = {};

  D.rett = function (c, x, y, l, a, colore) {
    c.fillStyle = colore;
    c.fillRect(x, y, l, a);
  };

  D.ellisse = function (c, x, y, rx, ry, colore, rotazione) {
    c.fillStyle = colore;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotazione || 0, 0, DUE_PI);
    c.fill();
  };

  D.linea = function (c, x1, y1, x2, y2, colore, spessore) {
    c.strokeStyle = colore;
    c.lineWidth = spessore || 1;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };

  /** Poligono pieno: punti = [[x,y], [x,y], ...] */
  D.poligono = function (c, punti, colore) {
    c.fillStyle = colore;
    c.beginPath();
    c.moveTo(punti[0][0], punti[0][1]);
    for (let k = 1; k < punti.length; k++) c.lineTo(punti[k][0], punti[k][1]);
    c.closePath();
    c.fill();
  };

  /** Arco (porzione di cerchio) disegnato come linea. */
  D.arco = function (c, x, y, r, inizio, fine, colore, spessore) {
    c.strokeStyle = colore;
    c.lineWidth = spessore || 1;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(x, y, r, inizio, fine);
    c.stroke();
  };

  /** Contorno a "inchiostro" (sul livello inchiostro delle texture). */
  D.contorno = function (c, x, y, l, a, opacita) {
    c.globalAlpha = opacita === undefined ? 0.8 : opacita;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, l - 1, a - 1);
    c.globalAlpha = 1;
  };

  /** Riga a "inchiostro". */
  D.tratto = function (c, x1, y1, x2, y2, opacita) {
    c.globalAlpha = opacita === undefined ? 0.8 : opacita;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.globalAlpha = 1;
  };

  U.D = D;
  Gioco.Utilita = U;
})();
