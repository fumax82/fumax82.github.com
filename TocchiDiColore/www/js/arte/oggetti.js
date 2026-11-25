/* ==========================================================================
 *  oggetti.js — GLI OGGETTI DI SCENA ("prop")
 *  --------------------------------------------------------------------------
 *  Alberi, vasi, lampioni, pane, automobili... tutti dipinti dal codice come
 *  figurine di carta ritagliate (cartelli sempre rivolti verso la camera).
 *
 *  Due modi di dipingere, come nel cortometraggio "Out of Sight":
 *    - OGGETTI piccoli (auto, borsa, bacchetta, pane, bidone...):
 *      tinte pastello piatte + contorno a inchiostro seppia + ombra "cel"
 *    - VEGETAZIONE (alberi, edera, piante): acquerello con qualche tocco
 *      di inchiostro.
 *
 *  Ogni oggetto è un ATLANTE (vedi creaAtlante in pennello.js):
 *  la base dell'oggetto tocca il bordo inferiore della cella, al centro.
 * ========================================================================== */

import {
  STILE, casuale, tra, mescola, schiarisci, scurisci, percorso, Forme,
  tinta, linea, acquerello, pennellata, foglia, fogliame, fiorellini, granula,
  creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  SCORCIATOIE                                                             */
/* ------------------------------------------------------------------------ */
const INK = STILE.inchiostro;
const E = Forme.ellisse, C = Forme.cerchio, R = Forme.rettangolo, P = Forme.poligono, CURVA = Forme.curva;
const LILLA = '#6c5584';         // il colore verso cui vanno le ombre "cel"

/** Un unico percorso fatto da più forme (si riempie come "unione"). */
function unione(...forme) {
  const p = new Path2D();
  for (const f of forme) p.addPath(percorso(f));
  return p;
}

/** Copia di un percorso spostata di (dx, dy). */
function sposta(forma, dx, dy) {
  const q = new Path2D();
  q.addPath(percorso(forma), new DOMMatrix([1, 0, 0, 1, dx, dy]));
  return q;
}

/**
 * Poligono con gli angoli arrotondati. Ogni punto è [x, y] oppure
 * [x, y, raggio] per scegliere l'arrotondamento di quell'angolo.
 */
function tondo(punti, raggio) {
  const p = new Path2D();
  const n = punti.length;
  const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const inizio = medio(punti[n - 1], punti[0]);
  p.moveTo(inizio[0], inizio[1]);
  for (let k = 0; k < n; k++) {
    const a = punti[k], m = medio(a, punti[(k + 1) % n]);
    p.arcTo(a[0], a[1], m[0], m[1], a[2] === undefined ? raggio : a[2]);
  }
  p.closePath();
  return p;
}

/** Anello (cerchio con il buco): il buco gira al contrario, così resta vuoto. */
function anello(x, y, rFuori, rDentro) {
  const p = new Path2D();
  p.arc(x, y, rFuori, 0, Math.PI * 2);
  p.moveTo(x + rDentro, y);
  p.arc(x, y, rDentro, 0, Math.PI * 2, true);
  return p;
}

/** Specchia dei punti attorno alla verticale x = asse. */
function specchia(punti, asse) {
  return punti.map((q) => [2 * asse - q[0], q[1], q[2]]);
}

/**
 * IL MATTONE DEGLI OGGETTI: tinta piatta + ombra "cel" + contorno seppia.
 *   opz.ombra:    [dx, dy] larghezza della fascia d'ombra (in basso a destra)
 *   opz.luce:     larghezza del bordino chiaro in alto a sinistra (0 = niente)
 *   opz.tono:     colore dell'ombra (se non indicato: il colore verso il lilla)
 *   opz.spessore: spessore del contorno (0 = senza contorno)
 *   opz.sotto:    true per forme fatte di più pezzi sovrapposti (nuvole,
 *                 pane...): il contorno viene disegnato sotto, così resta
 *                 visibile solo il bordo esterno.
 */
function pezzo(ctx, forma, colore, opz) {
  const o = opz || {};
  const p = percorso(forma);
  const [dx, dy] = o.ombra || [5, 5];
  const s = o.spessore === undefined ? 2.5 : o.spessore;
  if (o.sotto && s > 0) linea(ctx, p, { spessore: s * 2, colore: o.coloreLinea });
  ctx.save();
  ctx.fillStyle = o.tono || mescola(colore, LILLA, 0.24);
  ctx.fill(p);
  ctx.clip(p);
  const lume = o.luce || 0;
  ctx.fillStyle = lume ? schiarisci(colore, 0.38) : colore;
  ctx.fill(sposta(p, -dx, -dy));
  if (lume) {
    ctx.clip(sposta(p, -dx, -dy));
    ctx.fillStyle = colore;
    ctx.fill(sposta(p, lume, lume));
  }
  ctx.restore();
  if (!o.sotto && s > 0) linea(ctx, p, { spessore: s, colore: o.coloreLinea });
}

/** Un tubo (sbarra di ferro, telaio, cinghia): linea colorata bordata di seppia. */
function tubo(ctx, forma, colore, spessore, riflesso) {
  const p = Array.isArray(forma) ? CURVA(forma) : percorso(forma);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = spessore + 4;
  ctx.stroke(p);
  ctx.strokeStyle = colore;
  ctx.lineWidth = spessore;
  ctx.stroke(p);
  if (riflesso !== false && spessore >= 5) {
    ctx.strokeStyle = 'rgba(255,253,240,0.45)';
    ctx.lineWidth = spessore * 0.25;
    ctx.translate(-spessore * 0.2, -spessore * 0.2);
    ctx.stroke(p);
  }
  ctx.restore();
}

/** Linea di dettaglio a inchiostro (pieghe, venature, giunture). */
function tratto(ctx, punti, spessore, alfa, colore) {
  linea(ctx, CURVA(punti), { spessore: spessore || 1.8, alfa: alfa === undefined ? 0.8 : alfa, colore });
}

/** Riflesso bianco obliquo dentro una forma (vetri, metallo). */
function riflessi(ctx, forma, x, y, l, a, alfa) {
  ctx.save();
  ctx.clip(percorso(forma));
  ctx.strokeStyle = 'rgba(255,255,255,' + (alfa || 0.85) + ')';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, l * 0.09);
  ctx.beginPath(); ctx.moveTo(x + l * 0.2, y + a + 6); ctx.lineTo(x + l * 0.62, y - 6); ctx.stroke();
  ctx.lineWidth *= 0.5;
  ctx.beginPath(); ctx.moveTo(x + l * 0.45, y + a + 6); ctx.lineTo(x + l * 0.87, y - 6); ctx.stroke();
  ctx.restore();
}

/** Un finestrino di vetro: azzurro pallido, riflessi obliqui, contorno. */
function finestrino(ctx, forma, x, y, l, a, colore) {
  const p = percorso(forma);
  const g = ctx.createLinearGradient(0, y, 0, y + a);
  g.addColorStop(0, '#f6f9fc');
  g.addColorStop(1, colore || '#c9dbee');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.restore();
  riflessi(ctx, p, x, y, l, a);
  linea(ctx, p, { spessore: 2.2 });
}

/** Ruota vista di lato: gomma scura, cerchione chiaro, bullone. */
function ruota(ctx, x, y, r, cerchione) {
  pezzo(ctx, C(x, y, r), '#5d5160', { ombra: [r * 0.12, r * 0.12], luce: 2 });
  pezzo(ctx, C(x, y, r * 0.48), cerchione || '#cfc9d3', { ombra: [r * 0.08, r * 0.08], spessore: 2 });
  tinta(ctx, C(x, y, r * 0.14), '#8c8492');
  linea(ctx, C(x, y, r * 0.14), { spessore: 1.5 });
}

/** Gomma vista di fronte o da dietro (un rettangolo arrotondato scuro). */
function gomma(ctx, x, y, l, a) {
  pezzo(ctx, R(x, y, l, a, Math.min(l, a) * 0.35), '#5d5160', { ombra: [l * 0.2, 0] });
}

/** Nuvoletta di fumo (cerchietti chiari). */
function fumo(ctx, x, y, s) {
  const p = unione(C(x, y, 6 * s), C(x + 6 * s, y - 14 * s, 8 * s), C(x - 2 * s, y - 32 * s, 10 * s));
  ctx.save();
  ctx.globalAlpha = 0.85;
  pezzo(ctx, p, '#f4f1f6', { ombra: [2 * s, 2 * s], sotto: true, spessore: 1.4 });
  ctx.restore();
}

/**
 * Nuvola panna (quella sul tetto dell'auto blu): tanti cerchi uniti,
 * schiacciati verso il basso (schiaccia < 1 = nuvola più bassa e larga).
 */
function nuvola(ctx, cerchi, schiaccia) {
  const k = schiaccia || 1;
  const fondo = Math.max(...cerchi.map(([, y, r]) => y + r));
  const p = unione(...cerchi.map(([x, y, r]) => E(x, fondo - (fondo - y) * k, r, r * k)));
  linea(ctx, p, { spessore: 5, colore: STILE.inchiostroChiaro });
  ctx.save();
  ctx.fillStyle = '#f0d898';
  ctx.fill(p);
  ctx.clip(p);
  ctx.fillStyle = '#f9ebc2';
  ctx.fill(sposta(p, 0, -10));
  ctx.fillStyle = '#fefaf0';
  ctx.fill(sposta(p, -4, -24));
  ctx.restore();
}

/** Schizzi d'acqua attorno al punto in cui una ruota tocca l'acqua. */
function schizzi(ctx, x, y, larg, seme) {
  const rng = casuale(seme);
  const punti = [[x - larg / 2, y]];
  const n = 7;
  for (let k = 1; k < n; k++) {
    const u = x - larg / 2 + (larg * k) / n;
    const h = (k % 2 ? 14 : 3) + rng() * 22 * Math.sin((k / n) * Math.PI);
    punti.push([u, y - h]);
  }
  punti.push([x + larg / 2, y]);
  punti.push([x + larg * 0.3, y + 6], [x - larg * 0.3, y + 6]);
  const p = P(punti, true);
  const ACQUA = '#6f9cc0';   // le linee dell'acqua sono azzurre, non seppia
  pezzo(ctx, p, '#f2f9fd', { ombra: [0, 4], tono: '#b9d9ee', spessore: 1.8, coloreLinea: ACQUA });
  for (let k = 0; k < 4; k++) {
    const gx = x + (k % 2 ? 1 : -1) * larg * tra(rng, 0.4, 0.6), gy = y - tra(rng, 18, 34);
    pezzo(ctx, E(gx, gy, tra(rng, 2.5, 4), tra(rng, 3.5, 5.5)), '#f2f9fd', { ombra: [0, 1.5], tono: '#b9d9ee', spessore: 1.3, coloreLinea: ACQUA });
  }
}

/** Una pozza d'acqua chiara sotto l'auto che galleggia. */
function acquaSotto(ctx, x, y, rx) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(150,196,226,0.55)');
  g.addColorStop(1, 'rgba(150,196,226,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.12);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  VEGETAZIONE                                                             */
/* ------------------------------------------------------------------------ */

/** Tante chiome di fogliame (gruppi = [[x, y, raggio], ...]). */
function chioma(ctx, gruppi, colori, seme, piega, opz) {
  const o = opz || {};
  gruppi.forEach(([x, y, r], k) => {
    fogliame(ctx, x + (piega ? piega(y) : 0), y, r, {
      colori, seme: seme + k * 7, inchiostro: o.inchiostro === undefined ? 0.4 : o.inchiostro,
      schiaccia: o.schiaccia, dimFoglia: o.dimFoglia ? o.dimFoglia * r : undefined,
      quante: o.densita ? Math.round(r * o.densita) : undefined,
    });
  });
}

/** Un ramo: tratto d'inchiostro con dentro il colore della corteccia. */
function ramo(ctx, punti, spessore, colore) {
  tubo(ctx, punti, colore || '#8a7864', spessore, false);
}

/** Grappolo di fiorellini arancioni (come quelli appesi nel corto). */
function grappolo(ctx, x, y, dim, rng) {
  const toni = ['#f08a4b', '#f4a45e', '#e66a3c', '#f7b971'];
  for (let k = 0; k < 7; k++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * dim;
    const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.8;
    tinta(ctx, C(fx, fy, dim * 0.38), toni[k % toni.length], 0.95);
    linea(ctx, C(fx, fy, dim * 0.38), { spessore: 0.9, alfa: 0.5 });
    tinta(ctx, C(fx - dim * 0.08, fy - dim * 0.08, dim * 0.12), '#fbe3b0');
  }
}

/**
 * Vaso a tronco di cono ad acquerello con il bordo.
 * (cx, yBase) centro della base; lSopra/lSotto larghezze; alt altezza.
 */
function vaso(ctx, cx, yBase, lSopra, lSotto, alt, colore, seme) {
  const y0 = yBase - alt;
  const corpo = tondo([[cx - lSopra / 2 + 4, y0 + 8], [cx + lSopra / 2 - 4, y0 + 8], [cx + lSotto / 2, yBase - 1.5], [cx - lSotto / 2, yBase - 1.5]], 4);
  const area = [cx - lSopra / 2, y0, lSopra, alt];
  acquerello(ctx, corpo, colore, { area, seme, luce: 'sinistra', bordo: 0.35, variazione: 0.25 });
  linea(ctx, corpo, { spessore: 2.2 });
  const orlo = R(cx - lSopra / 2, y0, lSopra, Math.max(10, alt * 0.16), 4);
  acquerello(ctx, orlo, schiarisci(colore, 0.15), { area, seme: seme + 1, luce: 'sinistra', bordo: 0.3 });
  linea(ctx, orlo, { spessore: 2.2 });
}

/** Cassetta di legno (fioriere, vasi quadrati) con le assi. */
function cassetta(ctx, x, y, l, a, colore, seme) {
  const corpo = R(x, y, l, a - 1.5, 4);
  acquerello(ctx, corpo, colore, { area: [x, y, l, a], seme, luce: 'sinistra', bordo: 0.35 });
  const assi = Math.max(2, Math.round(a / 20));
  for (let k = 1; k < assi; k++) tratto(ctx, [[x + 3, y + (a * k) / assi], [x + l - 3, y + (a * k) / assi]], 1.4, 0.55);
  linea(ctx, corpo, { spessore: 2.2 });
  const bordo = R(x - 4, y - 4, l + 8, 10, 3);
  acquerello(ctx, bordo, schiarisci(colore, 0.2), { area: [x - 4, y - 4, l + 8, 10], seme: seme + 3, bordo: 0.2 });
  linea(ctx, bordo, { spessore: 2 });
}

/* ------------------------------------------------------------------------ */
/*  ALBERI E PIANTE                                                         */
/* ------------------------------------------------------------------------ */
const VERDI_SCURI = ['#2f6655', '#4b8a5c', '#7fb466'];
const VERDI_CHIARI = ['#4f9160', '#7dbb5e', '#cfe48e'];

function disegnaAlbero(ctx, nome, l, a) {
  // nel secondo fotogramma la chioma si piega un poco (più in alto, più si piega)
  const s = nome === 'f1' ? 1 : 0;
  const piega = (y) => s * 9 * Math.pow(Math.max(0, 1 - y / a), 1.7);
  const q = (x, y) => [x + piega(y), y];
  const CORT = '#8d7d69';
  // chioma dietro: toni scuri e freschi (in ombra)
  chioma(ctx, [[112, 196, 78], [262, 166, 84], [178, 112, 80], [318, 248, 52], [74, 262, 50], [204, 252, 64]], VERDI_SCURI, 10, piega, { densita: 2.3 });
  // il tronco snello che si divide in tre rami
  const tronco = P([q(180, a), q(180, a), q(184, 460), q(187, 390), q(189, 330), q(187, 300), q(203, 300), q(200, 330), q(200, 390), q(202, 460), q(207, a), q(207, a)], true);
  acquerello(ctx, tronco, CORT, { area: [170, 290, 50, a - 290], seme: 4, luce: 'sinistra', bordo: 0.4 });
  linea(ctx, tronco, { spessore: 2.4 });
  tratto(ctx, [q(191, 500), q(192, 440), q(194, 380)], 1.3, 0.5);
  const rami = [
    [[[189, 312], [168, 268], [140, 228]], 9], [[[140, 228], [112, 196], [84, 184]], 5], [[[140, 228], [134, 180], [122, 142]], 4],
    [[[196, 306], [198, 250], [190, 196]], 8], [[[190, 196], [180, 150], [176, 96]], 5], [[[190, 196], [214, 150], [236, 120]], 4],
    [[[200, 310], [234, 262], [270, 228]], 8], [[[270, 228], [298, 206], [322, 204]], 4], [[[270, 228], [276, 190], [284, 150]], 4],
  ];
  for (const [pts, sp] of rami) ramo(ctx, pts.map(([x, y]) => q(x, y)), sp, CORT);
  // chioma davanti: toni chiari, al sole, a ciuffi separati (si vedono i rami tra le foglie)
  chioma(ctx, [[92, 236, 52], [150, 150, 56], [236, 134, 60], [184, 70, 50], [298, 206, 50], [222, 222, 48], [52, 196, 40], [120, 290, 34], [262, 282, 36], [330, 160, 36], [112, 92, 38]], VERDI_CHIARI, 50, piega);
  // velature di luce calda in alto a sinistra
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createRadialGradient(130 + piega(90), 90, 10, 130, 110, 170);
  g.addColorStop(0, 'rgba(255,248,200,0.35)');
  g.addColorStop(1, 'rgba(255,248,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, l, 330);
  ctx.restore();
}

function disegnaAlberello(ctx, nome, l, a) {
  const cx = l / 2;
  ramo(ctx, [[cx, a - 70], [cx + 3, 190], [cx - 4, 140], [cx, 110]], 7, '#8d7d69');
  ramo(ctx, [[cx - 2, 170], [cx - 26, 140]], 4, '#8d7d69');
  chioma(ctx, [[cx - 30, 120, 48], [cx + 30, 112, 48], [cx, 80, 54]], VERDI_SCURI, 70);
  chioma(ctx, [[cx - 34, 136, 36], [cx + 36, 128, 36], [cx - 12, 70, 40], [cx + 16, 104, 44]], VERDI_CHIARI, 90);
  // la fioriera quadrata di legno chiaro
  tinta(ctx, E(cx, a - 76, 46, 6), '#5d4a3e');
  cassetta(ctx, cx - 48, a - 76, 96, 76, '#d9b27c', 5);
}

function disegnaBonsai(ctx, nome, l, a) {
  const tronco = '#7d6450';
  ramo(ctx, [[64, 112], [54, 92], [70, 72], [60, 52], [66, 34]], 8, tronco);
  ramo(ctx, [[56, 90], [36, 80]], 4, tronco);
  ramo(ctx, [[68, 74], [92, 62]], 4, tronco);
  const verdi = ['#244f4e', '#3f7a6a', '#7aae8e'];
  chioma(ctx, [[36, 78, 24], [92, 60, 24], [62, 30, 26], [96, 96, 16]], verdi, 7, null, { schiaccia: 0.5, inchiostro: 0.5 });
  vaso(ctx, 64, a, 76, 52, 46, '#e9c46a', 3);
}

function disegnaLavanda(ctx, nome, l, a) {
  const rng = casuale(19);
  // foglie strette grigio-verdi
  for (let k = 0; k < 30; k++) {
    const ang = -Math.PI / 2 + tra(rng, -1.3, 1.3);
    foglia(ctx, 64 + tra(rng, -28, 28), 88, ang, tra(rng, 20, 36), 5, mescola('#6f9270', '#aac6a0', rng()), rng() < 0.4 ? 0.5 : 0);
  }
  // spighe di lavanda
  for (let k = 0; k < 9; k++) {
    const x0 = 64 + tra(rng, -22, 22), cima = tra(rng, 10, 34);
    const x1 = x0 + (x0 - 64) * 0.6 + tra(rng, -4, 4);
    tratto(ctx, [[x0, 86], [x1, cima + 26]], 1.4, 0.8, '#6f8a5a');
    for (let j = 0; j < 7; j++) {
      const t = j / 6, yy = cima + 26 - t * 30, xx = x1 + (x0 - x1) * 0 + tra(rng, -1.5, 1.5);
      tinta(ctx, E(xx - 2.5, yy, 3, 4), mescola('#8f7cc8', '#c3b4ea', rng()), 0.9);
      tinta(ctx, E(xx + 2.5, yy - 2, 3, 4), mescola('#7d69b8', '#b7a6e0', rng()), 0.9);
    }
    linea(ctx, E(x1, cima + 12, 4, 15), { spessore: 1, alfa: 0.35 });
  }
  cassetta(ctx, 22, a - 44, 84, 44, '#b88a60', 11);
}

function disegnaVasoFoglie(ctx, nome, l, a) {
  const rng = casuale(31);
  const toni = ['#24504a', '#2f6a5a', '#3f7f66', '#5c9a76'];
  for (let k = 0; k < 18; k++) {
    const ang = -Math.PI / 2 + tra(rng, -1.3, 1.3) * (1 - k / 30);
    const lung = tra(rng, 48, 74) * (1 - k / 50);
    foglia(ctx, 64 + tra(rng, -14, 14), 104, ang, lung, tra(rng, 14, 19), toni[Math.floor(k / 5)], 0.6);
  }
  vaso(ctx, 64, a, 84, 62, 58, '#8f8478', 8);
}

function disegnaCassettaFiori(ctx, nome, l, a) {
  const rng = casuale(23);
  chioma(ctx, [[40, 46, 34], [96, 38, 40], [152, 46, 34]], VERDI_SCURI, 40, null, { schiaccia: 0.7, inchiostro: 0.45 });
  chioma(ctx, [[66, 40, 26], [128, 36, 28]], VERDI_CHIARI, 44, null, { schiaccia: 0.7, inchiostro: 0.45 });
  fiorellini(ctx, 22, 14, 148, 34, ['#f39a7a', '#f6c35f', '#ef7f8f', '#fff4ee', '#f08a4b'], 16, 7, 5);
  cassetta(ctx, 14, a - 38, l - 28, 38, '#d98c6f', 13);
  // foglie che ricadono sul bordo della cassetta
  for (let k = 0; k < 9; k++) {
    const x = tra(rng, 22, l - 22);
    foglia(ctx, x, a - 44, Math.PI / 2 + tra(rng, -0.7, 0.7), tra(rng, 14, 22), 5, mescola('#4f8f5f', '#8cc070', rng()), rng() < 0.5 ? 0.5 : 0);
  }
}

function disegnaEdera(ctx, nome, l, a) {
  const s = nome === 'f1' ? 1 : 0;
  const piega = (y) => s * 14 * Math.pow(y / a, 1.4);
  const rng = casuale(41);
  const verdi = ['#3d7a5a', '#5a9a60', '#86bd6c', '#b2d688'];
  // [x di partenza, lunghezza, fase dell'onda, ha i fiori]
  const fili = [[36, 210, 0.5, 1], [72, 340, 2.0, 1], [112, 250, 1.2, 0], [150, 372, 4.0, 1], [186, 290, 3.1, 0], [218, 220, 0.2, 1], [96, 170, 5.0, 0]];
  const percorsi = fili.map(([x0, lung, fase]) => {
    const punti = [];
    for (let y = 0; y <= lung; y += 14) punti.push([x0 + Math.sin(y / 52 + fase) * 10 + piega(y), y]);
    return punti;
  });
  // 1) velature di verde sotto i rametti (l'acquerello)
  percorsi.forEach((punti) => pennellata(ctx, punti.slice(0, -2), '#79ad6a', 14, 0.22));
  // 2) rametti, foglie appuntite e grappoli di fiori
  fili.forEach(([x0, lung, fase, fiori], f) => {
    const punti = percorsi[f];
    linea(ctx, CURVA(punti), { colore: '#7a6f4a', spessore: 1.8, alfa: 0.9 });
    punti.forEach(([x, y], k) => {
      const t = y / lung;
      for (const lato of [-1, 1]) {
        if (rng() < 0.25) continue;
        const colore = mescola(verdi[Math.floor(rng() * 4)], verdi[1], 0.2);
        foglia(ctx, x, y, Math.PI / 2 + lato * tra(rng, 0.5, 1.3), (24 - 10 * t) * tra(rng, 0.8, 1.1), (8 - 3 * t), colore, rng() < 0.4 ? 0.55 : 0);
      }
      if (fiori && k % 4 === 2 && t < 0.8) grappolo(ctx, x + tra(rng, -8, 8), y + 8, 12 - 4 * t, rng);
    });
  });
  // 3) la massa di foglie in alto, dove l'edera è attaccata
  chioma(ctx, [[66, 6, 54], [146, 2, 60], [204, 8, 44]], verdi.slice(0, 3), 60, null, { schiaccia: 0.5, dimFoglia: 0.3 });
  for (const x of [40, 120, 176, 222]) grappolo(ctx, x + tra(rng, -6, 6), tra(rng, 14, 30), 13, rng);
}

function disegnaTroncoCavo(ctx, nome, l, a) {
  const corpo = tondo([[14, a - 1.5, 6], [44, a - 22], [58, a - 56], [62, 120], [58, 76, 6], [198, 76, 6], [194, 130], [200, a - 56], [214, a - 22], [244, a - 1.5, 6]], 22);
  acquerello(ctx, corpo, '#9b8169', { area: [10, 60, 236, a - 60], seme: 9, luce: 'sinistra', bordo: 0.5, variazione: 0.3 });
  // venature della corteccia
  [[76, 90, 70, 180, 52, 236], [104, 96, 98, 150], [180, 92, 186, 170, 204, 236], [150, 96, 156, 140]].forEach((v) => {
    const pts = []; for (let k = 0; k < v.length; k += 2) pts.push([v[k], v[k + 1]]);
    tratto(ctx, pts, 1.6, 0.6);
  });
  linea(ctx, corpo, { spessore: 2.6 });
  // il taglio in alto con gli anelli
  const cima = E(128, 76, 70, 17);
  pezzo(ctx, cima, '#e3c797', { ombra: [0, 4], spessore: 2.4 });
  for (const r of [0.7, 0.45, 0.2]) linea(ctx, E(126, 77, 70 * r, 17 * r), { spessore: 1.3, alfa: 0.5 });
  tratto(ctx, [[128, 64], [134, 76], [130, 88]], 1.4, 0.6);
  // il buco scuro
  const buco = new Path2D();
  buco.moveTo(90, a - 12);
  buco.bezierCurveTo(88, 170, 112, 146, 128, 146);
  buco.bezierCurveTo(146, 146, 168, 170, 166, a - 12);
  buco.quadraticCurveTo(128, a - 4, 90, a - 12);
  ctx.save();
  ctx.lineWidth = 7; ctx.strokeStyle = '#c9a680'; ctx.stroke(buco);
  const g = ctx.createRadialGradient(130, a - 40, 4, 128, a - 60, 80);
  g.addColorStop(0, '#1e1622'); g.addColorStop(1, '#4b3842');
  ctx.fillStyle = g; ctx.fill(buco);
  ctx.restore();
  linea(ctx, buco, { spessore: 2.4 });
  // muschio e ciuffi d'erba
  chioma(ctx, [[84, 80, 22], [178, 78, 18]], ['#5d8a4a', '#86b35e', '#b8d77e'], 33, null, { schiaccia: 0.45, inchiostro: 0.3 });
  const rng = casuale(77);
  for (const bx of [30, 64, 196, 230]) {
    for (let k = 0; k < 6; k++) foglia(ctx, bx + tra(rng, -10, 10), a - 2, -Math.PI / 2 + tra(rng, -0.7, 0.7), tra(rng, 14, 22), 3, mescola('#5d9e5f', '#9ccc7a', rng()), 0.4);
  }
  // due funghetti
  for (const [fx, fs] of [[214, 1], [228, 0.7]]) {
    pezzo(ctx, R(fx - 4 * fs, a - 18 * fs, 8 * fs, 17 * fs, 3), '#f6ecd6', { ombra: [2, 0], spessore: 1.8 });
    const capp = new Path2D(); capp.ellipse(fx, a - 18 * fs, 13 * fs, 11 * fs, 0, Math.PI, 0); capp.closePath();
    pezzo(ctx, capp, '#e9785f', { ombra: [3, 2], spessore: 1.8 });
    tinta(ctx, C(fx - 4 * fs, a - 24 * fs, 2.2 * fs), '#fff6ea');
    tinta(ctx, C(fx + 5 * fs, a - 21 * fs, 1.8 * fs), '#fff6ea');
  }
}

/* ------------------------------------------------------------------------ */
/*  ARREDO URBANO                                                           */
/* ------------------------------------------------------------------------ */
const FERRO_VERDE = '#3f6457';

function disegnaLampione(ctx, nome, l, a) {
  const cx = l / 2;
  // alone di luce calda attorno alla lanterna
  const g = ctx.createRadialGradient(cx, 94, 6, cx, 94, 64);
  g.addColorStop(0, 'rgba(255,226,150,0.55)');
  g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 30, l, 130);
  // piede e colonna
  pezzo(ctx, P([[cx - 7, 362], [cx - 5, 136], [cx + 5, 136], [cx + 7, 362]]), FERRO_VERDE, { ombra: [4, 0], luce: 2 });
  pezzo(ctx, tondo([[cx - 20, 424], [cx - 16, 368], [cx + 16, 368], [cx + 20, 424]], 6), FERRO_VERDE, { ombra: [7, 0], luce: 3 });
  pezzo(ctx, tondo([[cx - 28, a - 1.5], [cx - 26, 430], [cx - 20, 420], [cx + 20, 420], [cx + 26, 430], [cx + 28, a - 1.5]], 6), FERRO_VERDE, { ombra: [8, 0], luce: 3 });
  for (const [y, lg] of [[360, 22], [300, 16], [220, 14], [150, 16]]) pezzo(ctx, R(cx - lg / 2, y, lg, 7, 3), FERRO_VERDE, { ombra: [3, 0], luce: 2, spessore: 2 });
  // riccioli sotto la lanterna
  tubo(ctx, [[cx - 4, 150], [cx - 18, 146], [cx - 22, 134], [cx - 14, 128]], FERRO_VERDE, 3);
  tubo(ctx, [[cx + 4, 150], [cx + 18, 146], [cx + 22, 134], [cx + 14, 128]], FERRO_VERDE, 3);
  // lanterna: vetro luminoso, telaio, cappello
  pezzo(ctx, R(cx - 16, 122, 32, 12, 3), FERRO_VERDE, { ombra: [4, 0], spessore: 2.2 });
  const vetro = P([[cx - 25, 62], [cx + 25, 62], [cx + 17, 124], [cx - 17, 124]]);
  const gv = ctx.createLinearGradient(0, 62, 0, 124);
  gv.addColorStop(0, '#fff8dc'); gv.addColorStop(1, '#ffd77e');
  tinta(ctx, vetro, '#ffe9a8');
  ctx.save(); ctx.fillStyle = gv; ctx.fill(vetro); ctx.restore();
  tinta(ctx, E(cx, 96, 8, 13), '#fffdf2', 0.9);
  tratto(ctx, [[cx, 62], [cx, 124]], 3.5, 1, FERRO_VERDE);
  linea(ctx, vetro, { spessore: 2.4 });
  tratto(ctx, [[cx, 62], [cx, 124]], 1.2, 0.8);
  const tetto = tondo([[cx - 34, 66, 4], [cx - 18, 44], [cx, 34, 4], [cx + 18, 44], [cx + 34, 66, 4]], 8);
  pezzo(ctx, tetto, FERRO_VERDE, { ombra: [8, 3], luce: 3 });
  pezzo(ctx, C(cx, 26, 7), FERRO_VERDE, { ombra: [2, 2], spessore: 2 });
  tubo(ctx, [[cx, 19], [cx, 10]], FERRO_VERDE, 3);
}

function disegnaBidone(ctx, nome, l, a) {
  const M = '#c3ccd5';
  const corpo = tondo([[24, 46], [104, 46], [101, a - 1.5], [27, a - 1.5]], 5);
  pezzo(ctx, corpo, M, { ombra: [16, 0], luce: 4 });
  // scanalature verticali
  for (const x of [40, 56, 72, 88]) {
    pezzo(ctx, R(x - 4, 68, 8, 64, 4), mescola(M, '#8f9cab', 0.35), { ombra: [3, 0], spessore: 1.4 });
    tratto(ctx, [[x - 6, 70], [x - 6, 130]], 1.6, 0.7, '#f4f7fa');
  }
  pezzo(ctx, R(21, 56, 86, 8, 4), M, { ombra: [10, 0], luce: 2, spessore: 2 });
  pezzo(ctx, R(23, 138, 82, 8, 4), M, { ombra: [10, 0], luce: 2, spessore: 2 });
  // maniglie laterali
  tubo(ctx, [[22, 62], [12, 66], [14, 78], [24, 80]], '#9aa6b2', 3);
  tubo(ctx, [[106, 62], [116, 66], [114, 78], [104, 80]], '#9aa6b2', 3);
  // coperchio
  const cupola = new Path2D();
  cupola.moveTo(18, 38); cupola.quadraticCurveTo(64, 4, 110, 38); cupola.closePath();
  pezzo(ctx, cupola, M, { ombra: [14, 2], luce: 3 });
  pezzo(ctx, R(13, 34, 102, 13, 5), schiarisci(M, 0.1), { ombra: [14, 2], luce: 2 });
  tubo(ctx, [[52, 22], [56, 10], [72, 10], [76, 22]], '#9aa6b2', 4);
  // un riflesso lungo il corpo
  tratto(ctx, [[34, 70], [34, 132]], 3, 0.8, '#ffffff');
}

function disegnaPanchina(ctx, nome, l, a) {
  const LEGNO = '#d49a5e', FERRO = '#4f5e5e';
  // montanti dietro lo schienale
  for (const x of [44, l - 44]) pezzo(ctx, R(x - 5, 8, 10, 88, 4), FERRO, { ombra: [3, 0] });
  // schienale: tre assi
  for (const y of [10, 32, 54]) pezzo(ctx, R(20, y, l - 40, 16, 5), LEGNO, { ombra: [0, 5], luce: 2 });
  // seduta (vista un po' dall'alto, più chiara) e asse davanti
  pezzo(ctx, R(14, 74, l - 28, 16, 4), schiarisci(LEGNO, 0.2), { ombra: [0, 4] });
  tratto(ctx, [[18, 82], [l - 18, 82]], 1.4, 0.6);
  pezzo(ctx, R(12, 90, l - 24, 13, 5), LEGNO, { ombra: [0, 5], luce: 2 });
  // fianchi di ferro: bracciolo a ricciolo e gamba
  for (const lato of [1, -1]) {
    const x = lato === 1 ? 28 : l - 28;
    tubo(ctx, [[x, a - 2], [x + lato * 2, 110], [x, 96], [x - lato * 2, 70], [x + lato * 6, 58], [x + lato * 16, 60], [x + lato * 14, 70]], FERRO, 6);
    pezzo(ctx, R(x - 9, a - 7, 18, 6, 3), FERRO, { ombra: [3, 0], spessore: 2 });
  }
  // venature del legno
  tratto(ctx, [[60, 20], [110, 22]], 1.2, 0.4);
  tratto(ctx, [[150, 42], [200, 40]], 1.2, 0.4);
  tratto(ctx, [[90, 95], [150, 94]], 1.2, 0.4);
}

function disegnaBicicletta(ctx, nome, l, a) {
  const TELAIO = '#6fb7c3', r = 44;
  const ruotaBici = (x) => {
    const y = a - r - 2;
    ctx.save(); ctx.strokeStyle = '#b2aab6'; ctx.lineWidth = 1.2;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * (r - 6), y + Math.sin(ang) * (r - 6)); ctx.stroke();
    }
    ctx.restore();
    tubo(ctx, anello(x, y, r - 3.5, r - 3.5), '#574b58', 6, false);
    linea(ctx, C(x, y, r - 8), { spessore: 1.4, colore: '#a59ca8' });
    pezzo(ctx, C(x, y, 5), '#d9d2dc', { ombra: [1, 1], spessore: 1.6 });
    // parafango color panna
    const pf = new Path2D(); pf.arc(x, y, r + 4, Math.PI * 1.05, Math.PI * 1.85);
    tubo(ctx, pf, '#f4ead0', 4, false);
  };
  const yR = a - r - 2;
  const dietro = 60, davanti = 196, mov = [118, yR + 4], sella = [104, 50], sterzo = [178, 56];
  ruotaBici(dietro);
  ruotaBici(davanti);
  // telaio "da passeggio" (senza canna alta)
  tubo(ctx, [[dietro, yR], mov], TELAIO, 6);
  tubo(ctx, [[dietro, yR], [sella[0] - 2, sella[1] + 14]], TELAIO, 5);
  tubo(ctx, [mov, [sella[0] + 2, sella[1] + 8]], TELAIO, 6);
  tubo(ctx, [mov, [146, 104], [168, 82], sterzo], TELAIO, 7);
  tubo(ctx, [sterzo, [davanti, yR]], TELAIO, 5);
  // manubrio e sella
  tubo(ctx, [sterzo, [174, 36], [160, 32], [150, 36]], '#8a8590', 4);
  pezzo(ctx, R(144, 31, 14, 9, 4), '#8a5a3c', { ombra: [2, 2], spessore: 2 });
  pezzo(ctx, tondo([[88, sella[1] - 2], [122, sella[1] - 6], [120, sella[1] + 6], [92, sella[1] + 6]], 6), '#8a5a3c', { ombra: [3, 3] });
  // pedivella e corona
  pezzo(ctx, C(mov[0], mov[1], 10), '#c9c2cc', { ombra: [2, 2], spessore: 2 });
  tubo(ctx, [mov, [128, mov[1] + 16]], '#8a8590', 3);
  pezzo(ctx, R(122, mov[1] + 14, 16, 6, 2), '#5d5160', { ombra: [2, 1], spessore: 1.6 });
  // cestino di vimini davanti con fiori
  fiorellini(ctx, 196, 24, 34, 12, ['#f39a7a', '#f6c35f', '#ef7f8f'], 5, 3, 3.5);
  const cesto = tondo([[188, 34], [240, 34], [234, 68], [194, 68]], 5);
  pezzo(ctx, cesto, '#e3c27a', { ombra: [6, 3] });
  for (let x = 196; x < 236; x += 8) tratto(ctx, [[x, 36], [x - 1, 66]], 1, 0.45);
  for (let y = 44; y < 66; y += 8) tratto(ctx, [[190, y], [236, y]], 1, 0.45);
  linea(ctx, cesto, { spessore: 2.2 });
}

function disegnaCancello(ctx, nome, l, a) {
  const FERRO = '#8ea4bd', yB = a - 76;
  // l'arco in alto: y della sbarra superiore al variare di x
  const x0 = 22, x1 = l - 22;
  const arco = (x) => { const t = (x - x0) / (x1 - x0); return 124 - 288 * t * (1 - t); };
  // sbarre verticali
  for (let x = 50; x <= l - 50; x += 26) tubo(ctx, [[x, yB], [x, arco(x) - 6]], FERRO, 6);
  // traverse orizzontali e arco doppio
  const archetto = (dy) => { const pts = []; for (let x = x0; x <= x1; x += 17) pts.push([x, arco(x) + dy]); return pts; };
  tubo(ctx, archetto(0), FERRO, 7);
  tubo(ctx, archetto(26), FERRO, 5);
  for (let x = 50; x <= l - 50; x += 52) tubo(ctx, anello(x + 13, arco(x + 13) + 13, 7, 7), FERRO, 3, false);
  tubo(ctx, [[x0, yB - 28], [x1, yB - 28]], FERRO, 6);
  tubo(ctx, [[x0, 210], [x1, 210]], FERRO, 5);
  // due riccioli al centro dell'arco
  tubo(ctx, [[l / 2, 46], [l / 2 - 12, 30], [l / 2 - 26, 34], [l / 2 - 22, 46]], FERRO, 4);
  tubo(ctx, [[l / 2, 46], [l / 2 + 12, 30], [l / 2 + 26, 34], [l / 2 + 22, 46]], FERRO, 4);
  // pilastrini laterali con la palla in cima
  for (const x of [x0, x1]) {
    pezzo(ctx, R(x - 9, 112, 18, yB - 110, 4), FERRO, { ombra: [5, 0], luce: 2 });
    pezzo(ctx, C(x, 104, 10), FERRO, { ombra: [3, 3], luce: 2 });
  }
  // basamento di mattoni ad acquerello
  const muro = R(2, yB, l - 4, 76 - 1.5, 3);
  acquerello(ctx, muro, '#f0c7a8', { area: [0, yB, l, 76], seme: 12, bordo: 0.25 });
  const rng = casuale(55);
  for (let riga = 0; riga < 3; riga++) {
    const y = yB + 14 + riga * 20, sfasa = riga % 2 ? 0 : 28;
    for (let x = 4 - sfasa; x < l - 4; x += 56) {
      const xa = Math.max(5, x + 2), xb = Math.min(l - 5, x + 54);
      if (xb - xa < 12) continue;
      const m = R(xa, y + 2, xb - xa, 16, 5);
      tinta(ctx, m, mescola('#e58e6c', '#d4785e', rng()), 0.9);
      linea(ctx, m, { spessore: 1.4, colore: '#a0634a', alfa: 0.8 });
    }
  }
  const coprimuro = R(2, yB - 2, l - 4, 14, 4);
  pezzo(ctx, coprimuro, '#f2d2b6', { ombra: [0, 4], spessore: 2.2 });
  granula(ctx, 0, yB - 2, l, 78, 0.25);
  linea(ctx, muro, { spessore: 2.2 });
}

/* ------------------------------------------------------------------------ */
/*  PANETTERIA                                                              */
/* ------------------------------------------------------------------------ */
const CROSTA = '#e7b46c', MOLLICA = '#fbefd2';

/** Un filone allungato (baguette) da (x1,y1) a (x2,y2) con i tagli bianchi. */
function filone(ctx, x1, y1, x2, y2, larg) {
  const lung = Math.hypot(x2 - x1, y2 - y1);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
  const corpo = tondo([[0, 0, larg * 0.3], [lung * 0.08, -larg / 2, larg * 0.5], [lung * 0.92, -larg / 2, larg * 0.5], [lung, 0, larg * 0.3], [lung * 0.92, larg / 2, larg * 0.5], [lung * 0.08, larg / 2, larg * 0.5]], larg * 0.4);
  pezzo(ctx, corpo, CROSTA, { ombra: [0, -larg * 0.22], luce: 0, spessore: 2.2 });
  const n = Math.max(3, Math.round(lung / (larg * 1.25)));
  for (let k = 0; k < n; k++) {
    const u = lung * (0.12 + (0.76 * (k + 0.5)) / n);
    const taglio = E(u, larg * 0.02, larg * 0.62, larg * 0.13, -0.45);
    tinta(ctx, taglio, MOLLICA);
    linea(ctx, CURVA([[u - larg * 0.5, larg * 0.32], [u + larg * 0.1, larg * 0.08], [u + larg * 0.55, -larg * 0.25]]), { spessore: 1.4, alfa: 0.7 });
  }
  ctx.restore();
}

function disegnaCestoBaguette(ctx, nome, l, a) {
  filone(ctx, 66, 150, 38, 18, 26);
  filone(ctx, 98, 150, 120, 30, 26);
  filone(ctx, 80, 150, 82, 6, 28);
  // anelli laterali
  tubo(ctx, anello(26, 142, 8, 8), '#d2ae64', 3, false);
  tubo(ctx, anello(134, 142, 8, 8), '#d2ae64', 3, false);
  // il cesto intrecciato
  const corpo = tondo([[28, 124, 4], [132, 124, 4], [124, a - 1.5, 10], [36, a - 1.5, 10]], 6);
  pezzo(ctx, corpo, '#e8c983', { ombra: [12, 0], luce: 3 });
  ctx.save();
  ctx.clip(corpo);
  for (let riga = 0; riga < 5; riga++) {
    const y = 132 + riga * 12;
    for (let c = 0; c < 8; c++) {
      const x = 28 + c * 14;
      if ((riga + c) % 2) for (let k = 3; k < 12; k += 4) tratto(ctx, [[x + 2, y + k], [x + 12, y + k]], 1, 0.5);
      else for (let k = 3; k < 14; k += 4) tratto(ctx, [[x + k, y + 1], [x + k, y + 11]], 1, 0.5);
    }
  }
  ctx.restore();
  linea(ctx, corpo, { spessore: 2.4 });
  // bordo di corda attorcigliata
  tubo(ctx, [[24, 125], [136, 125]], '#efd9a0', 10, false);
  for (let x = 26; x < 136; x += 7) tratto(ctx, [[x, 130], [x + 5, 120]], 1.2, 0.7);
}

/** Pagnotta "a tre gobbe" (pan carré). */
function disegnaPagnotta(ctx, nome, l, a) {
  const forma = unione(R(16, 48, 96, a - 49.5, 8), C(36, 44, 22), C(64, 38, 25), C(92, 44, 22));
  pezzo(ctx, forma, CROSTA, { ombra: [8, 6], luce: 3, sotto: true });
  ctx.save();
  ctx.clip(forma);
  tinta(ctx, R(0, 66, l, a), '#f4d7a0');
  tinta(ctx, R(0, 66, l, 5), '#ffffff', 0.25);
  ctx.restore();
  tratto(ctx, [[18, 66], [110, 66]], 1.4, 0.55);
  tratto(ctx, [[52, 36], [50, 50], [52, 60]], 1.6, 0.75);
  tratto(ctx, [[77, 36], [79, 50], [77, 60]], 1.6, 0.75);
  tinta(ctx, E(58, 26, 10, 4, -0.3), '#ffffff', 0.4);
}

function disegnaPaneTondo(ctx, nome, l, a) {
  const forma = new Path2D();
  forma.moveTo(14, a - 4);
  forma.bezierCurveTo(4, 30, 124, 30, 114, a - 4);
  forma.quadraticCurveTo(64, a + 1, 14, a - 4);
  pezzo(ctx, forma, '#e5ad62', { ombra: [10, 6], luce: 3 });
  for (const [x, y, r] of [[44, 54, 0.5], [64, 46, 0.35], [84, 54, -0.5]]) {
    tinta(ctx, E(x, y, 14, 5, r + 0.2), MOLLICA);
    linea(ctx, CURVA([[x - 12, y + 4], [x, y - 2], [x + 12, y - 4]]), { spessore: 1.4, alfa: 0.7 });
  }
  tinta(ctx, E(46, 40, 12, 4, -0.4), '#ffffff', 0.35);
}

function disegnaCiambella(ctx, nome, l, a) {
  const corpo = unione(E(48, 58, 43, 26), E(48, 68, 43, 26));
  pezzo(ctx, corpo, '#e39c52', { ombra: [8, 8], luce: 3, sotto: true });
  // il buco (lasciato trasparente) con il suo bordino interno
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill(E(48, 56, 14, 7.5));
  ctx.restore();
  ctx.save(); ctx.clip(E(48, 56, 14, 7.5)); tinta(ctx, E(48, 60, 16, 7.5), '#c77a3c'); ctx.restore();
  linea(ctx, E(48, 56, 14, 7.5), { spessore: 2.2 });
  tratto(ctx, [[10, 62], [30, 74], [66, 74], [86, 62]], 1.3, 0.4);
  tinta(ctx, E(32, 44, 10, 3.5, -0.3), '#ffffff', 0.35);
  const rng = casuale(3);
  for (let k = 0; k < 9; k++) tinta(ctx, E(tra(rng, 20, 76), tra(rng, 40, 66), 2.2, 1.2, rng() * 3), '#fff4dc');
}

function disegnaBaguette(ctx, nome, l, a) {
  filone(ctx, 8, a - 22, l - 8, a - 22, 40);
}

/** Cornetto (croissant). */
function cornetto(ctx, x, y, s) {
  const p = unione(E(x - s * 0.55, y + s * 0.08, s * 0.34, s * 0.26, 0.5), E(x + s * 0.55, y + s * 0.08, s * 0.34, s * 0.26, -0.5), E(x, y - s * 0.05, s * 0.44, s * 0.36));
  pezzo(ctx, p, '#e9a85a', { ombra: [s * 0.1, s * 0.1], sotto: true, spessore: 1.8 });
  tratto(ctx, [[x - s * 0.25, y - s * 0.3], [x - s * 0.3, y + s * 0.25]], 1.3, 0.6);
  tratto(ctx, [[x + s * 0.25, y - s * 0.3], [x + s * 0.3, y + s * 0.25]], 1.3, 0.6);
}

/** Panino tondo. */
function panino(ctx, x, y, r, colore) {
  const p = new Path2D();
  p.ellipse(x, y, r, r * 0.8, 0, Math.PI, 0);
  p.quadraticCurveTo(x, y + r * 0.2, x - r, y);
  pezzo(ctx, p, colore, { ombra: [r * 0.25, r * 0.15], luce: 2, spessore: 1.8 });
}

/** Tortina rosa con la ciliegina. */
function tortina(ctx, x, y, s) {
  pezzo(ctx, P([[x - s, y], [x + s, y], [x + s * 0.8, y - s * 0.9], [x - s * 0.8, y - s * 0.9]]), '#f3b7c0', { ombra: [s * 0.3, 0], spessore: 1.8 });
  pezzo(ctx, unione(E(x, y - s * 0.95, s * 0.9, s * 0.35), C(x - s * 0.45, y - s * 1.1, s * 0.32), C(x + s * 0.4, y - s * 1.12, s * 0.3)), '#fdf3ea', { ombra: [s * 0.2, s * 0.1], sotto: true, spessore: 1.6 });
  pezzo(ctx, C(x, y - s * 1.45, s * 0.25), '#e05d6a', { ombra: [1, 1], spessore: 1.4 });
}

function disegnaBancone(ctx, nome, l, a) {
  const LEGNO = '#c48a5a';
  // vetrina: cornice, fondo, ripiani con le paste
  const vetrina = tondo([[40, 140], [40, 52, 6], [70, 28, 30], [472, 28, 30], [472, 140]], 8);
  tinta(ctx, vetrina, '#fbf2df');
  ctx.save(); ctx.clip(vetrina); tinta(ctx, R(0, 28, l, 60), '#f6e6c6'); ctx.restore();
  pezzo(ctx, R(50, 88, 412, 7, 3), '#ead9b8', { ombra: [0, 3], spessore: 1.8 });
  for (let k = 0; k < 4; k++) cornetto(ctx, 90 + k * 46, 132, 30);
  panino(ctx, 290, 134, 20, '#e2a85e');
  panino(ctx, 334, 134, 20, '#d4934c');
  panino(ctx, 378, 134, 20, '#e2a85e');
  panino(ctx, 422, 134, 18, '#c98545');
  for (let k = 0; k < 4; k++) tortina(ctx, 92 + k * 52, 86, 16);
  for (let k = 0; k < 3; k++) {
    const x = 316 + k * 48;
    pezzo(ctx, unione(E(x, 78, 20, 9), E(x, 82, 20, 9)), '#e39c52', { ombra: [3, 3], sotto: true, spessore: 1.6 });
    tinta(ctx, E(x, 77, 6, 2.6), '#c77a3c');
  }
  // vetro: velo azzurrino e riflessi
  ctx.save();
  ctx.clip(vetrina);
  tinta(ctx, vetrina, '#cfe3f0', 0.22);
  ctx.restore();
  riflessi(ctx, vetrina, 60, 28, 160, 112, 0.6);
  riflessi(ctx, vetrina, 300, 28, 160, 112, 0.45);
  linea(ctx, vetrina, { spessore: 2.6 });
  tratto(ctx, [[48, 50], [464, 50]], 1.3, 0.35);
  // piano del bancone
  pezzo(ctx, R(8, 138, l - 16, 18, 6), '#efe2c6', { ombra: [0, 5], luce: 2 });
  // frontale di legno con tre pannelli
  const fronte = R(18, 156, l - 36, a - 157.5, 4);
  pezzo(ctx, fronte, LEGNO, { ombra: [0, 0], spessore: 2.6 });
  granula(ctx, 18, 156, l - 36, a - 156, 0.3);
  for (let k = 0; k < 3; k++) {
    const x = 38 + k * 148;
    pezzo(ctx, R(x, 172, 128, a - 190, 6), schiarisci(LEGNO, 0.12), { ombra: [-5, -5], tono: scurisci(LEGNO, 0.2), spessore: 1.8 });
    tratto(ctx, [[x + 20, 190], [x + 60, 188]], 1.2, 0.35);
    tratto(ctx, [[x + 50, 220], [x + 106, 222]], 1.2, 0.35);
  }
  linea(ctx, fronte, { spessore: 2.6 });
}

function disegnaFuoco(ctx, nome, l, a) {
  const k = Number(nome.slice(1));
  const fase = (k * Math.PI) / 2;
  const cx = l / 2, yB = a - 34;
  // bagliore caldo
  const g = ctx.createRadialGradient(cx, yB, 10, cx, yB - 20, 130);
  g.addColorStop(0, 'rgba(255,190,90,' + (0.6 + 0.08 * Math.sin(fase)) + ')');
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, l, a);
  // ceppo dietro
  const ceppo = (xa, ya, xb, yb, sp) => {
    const ang = Math.atan2(yb - ya, xb - xa), nx = -Math.sin(ang) * sp / 2, ny = Math.cos(ang) * sp / 2;
    pezzo(ctx, tondo([[xa + nx, ya + ny], [xb + nx, yb + ny], [xb - nx, yb - ny], [xa - nx, ya - ny]], sp * 0.3), '#7d5039', { ombra: [0, 5], luce: 2 });
    pezzo(ctx, E(xb, yb, sp * 0.28, sp / 2, ang), '#e7b07a', { ombra: [1, 1], spessore: 2 });
    tratto(ctx, [[xa + (xb - xa) * 0.3, ya + (yb - ya) * 0.3], [xa + (xb - xa) * 0.6, ya + (yb - ya) * 0.6 + 2]], 2.4, 0.9, '#ff9a4a');
  };
  ceppo(36, a - 30, 214, a - 52, 24);
  // le fiamme: quattro strati, dal rosso-arancio al giallo chiarissimo
  const lingue = [[-74, 56, 0], [-40, 96, 1.3], [0, 128, 2.1], [38, 102, 3.4], [76, 62, 4.6], [-18, 80, 5.2], [20, 86, 0.7]];
  const strati = [['#f2703a', 1], ['#ff9f3c', 0.8], ['#ffd25a', 0.58], ['#fff6cc', 0.34]];
  strati.forEach(([colore, sc], i) => {
    const p = new Path2D();
    p.addPath(E(cx, yB, 92 * sc + 6, 24 * sc + 4));
    for (const [ox, h, f] of lingue) {
      const alt = h * sc * (0.84 + 0.18 * Math.sin(fase + f));
      const larg = 24 * sc + 6;
      const x = cx + ox * (0.6 + 0.4 * sc), punta = x + 10 * Math.sin(fase * 1.0 + f * 2);
      p.moveTo(x - larg, yB);
      p.bezierCurveTo(x - larg, yB - alt * 0.5, punta - larg * 0.3, yB - alt * 0.7, punta, yB - alt);
      p.bezierCurveTo(punta + larg * 0.4, yB - alt * 0.6, x + larg, yB - alt * 0.45, x + larg, yB);
      p.closePath();
    }
    if (i === 0) linea(ctx, p, { spessore: 4, colore: '#b8502a' });
    tinta(ctx, p, colore);
  });
  // ceppo davanti e braci
  ceppo(222, a - 18, 46, a - 34, 26);
  const rng = casuale(5 + k);
  for (let j = 0; j < 12; j++) {
    const x = tra(rng, 50, 210), y = a - tra(rng, 4, 12);
    pezzo(ctx, C(x, y, tra(rng, 4, 8)), rng() < 0.5 ? '#ff7a3c' : '#ffb347', { ombra: [1, 1], spessore: 1.4 });
  }
  // scintille che salgono
  for (let j = 0; j < 6; j++) {
    const y = (a - 60 - ((j * 37 + k * 18) % 120));
    const x = cx + Math.sin(j * 2.3 + k) * 60;
    tinta(ctx, C(x, y, 2.4), '#ffe9a0', 0.9);
  }
}

/* ------------------------------------------------------------------------ */
/*  CASA E LIBRI                                                            */
/* ------------------------------------------------------------------------ */
function disegnaLampadaAppesa(ctx, nome, l, a) {
  const cx = l / 2;
  pezzo(ctx, R(cx - 14, 0, 28, 8, 3), '#7d6a5c', { ombra: [3, 0], spessore: 2 });
  tratto(ctx, [[cx, 6], [cx, 96]], 2.2, 1, '#5d4a3e');
  // alone di luce sotto
  const g = ctx.createRadialGradient(cx, 150, 4, cx, 160, 70);
  g.addColorStop(0, 'rgba(255,228,150,0.7)');
  g.addColorStop(1, 'rgba(255,228,150,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 100, l, a - 100);
  pezzo(ctx, R(cx - 8, 92, 16, 14, 3), '#b48a5c', { ombra: [4, 0], spessore: 2 });
  pezzo(ctx, C(cx, 152, 13), '#fff3c4', { ombra: [0, 0], spessore: 1.8 });
  const paralume = new Path2D();
  paralume.moveTo(cx - 48, 150);
  paralume.bezierCurveTo(cx - 46, 112, cx - 24, 102, cx, 102);
  paralume.bezierCurveTo(cx + 24, 102, cx + 46, 112, cx + 48, 150);
  paralume.quadraticCurveTo(cx, 160, cx - 48, 150);
  pezzo(ctx, paralume, '#e99a7c', { ombra: [12, 4], luce: 3 });
  // il bordo interno illuminato
  tinta(ctx, E(cx, 150, 44, 5), '#fff0bf');
  linea(ctx, E(cx, 150, 44, 5), { spessore: 1.6, alfa: 0.8 });
  tinta(ctx, E(cx - 18, 118, 8, 4, -0.5), '#ffffff', 0.45);
}

const COPERTINE = ['#8fb8d8', '#e8a3a0', '#a9cf9f', '#f2d27a', '#b9a3d8', '#f0b78a'];

/** Un libro chiuso visto di taglio: costa colorata oppure il blocco delle pagine. */
function libro(ctx, x, y, l, a, colore, conPagine) {
  pezzo(ctx, R(x, y, l, a, 5), colore, { ombra: [0, 4], luce: 2 });
  if (conPagine) {
    pezzo(ctx, R(x + 8, y + 4, l - 12, a - 8, 2), '#fbf4e4', { ombra: [0, 2], spessore: 1.6 });
    for (let k = 1; k < 3; k++) tratto(ctx, [[x + 12, y + 4 + ((a - 8) * k) / 3], [x + l - 8, y + 4 + ((a - 8) * k) / 3]], 1, 0.4);
  } else {
    tinta(ctx, R(x + 14, y + 3, 6, a - 6), schiarisci(colore, 0.5));
    tinta(ctx, R(x + l - 22, y + 3, 6, a - 6), schiarisci(colore, 0.5));
    tratto(ctx, [[x + l * 0.35, y + a / 2], [x + l * 0.6, y + a / 2]], 2, 0.6);
  }
}

function disegnaPilaLibri(ctx, nome, l, a) {
  const libri = [[128, 26, 0], [114, 22, 8], [122, 24, -6], [104, 20, 5], [112, 22, -3]];
  let y = a - 1.5;
  libri.forEach(([lg, al, dx], k) => {
    y -= al;
    if (k === libri.length - 1) {
      ctx.save(); ctx.translate(l / 2, y + al / 2); ctx.rotate(-0.07); ctx.translate(-l / 2, -(y + al / 2));
      libro(ctx, (l - lg) / 2 + dx, y - 3, lg, al, COPERTINE[k], k % 2 === 1);
      ctx.restore();
    } else libro(ctx, (l - lg) / 2 + dx, y, lg, al, COPERTINE[k], k % 2 === 1);
  });
}

function disegnaLibroVolante(ctx, nome, l, a) {
  const k = Number(nome.slice(1));
  const theta = [0.75, 0.2, -0.45, 0.2][k];
  const cx = l / 2, alto = 44, basso = 82, W = 80;
  // ogni metà del libro è un'ala: bordo interno sulla costa, bordo esterno ruotato
  const ala = (lato, larg, rid) => {
    const ox = cx + lato * larg * Math.cos(theta), oy = -larg * Math.sin(theta) * 0.55;
    return P([[cx, alto + rid], [ox, alto + oy + rid * 0.6], [ox, basso + oy - rid * 0.6], [cx, basso - rid]]);
  };
  for (const lato of [-1, 1]) {
    pezzo(ctx, ala(lato, W + 4, -4), '#5fa0a8', { ombra: [0, 4], spessore: 2.4 });
    pezzo(ctx, ala(lato, W - 4, 3), '#fbf4e4', { ombra: [0, 4], spessore: 1.8 });
    // righe di testo sulle pagine
    for (let r = 0; r < 4; r++) {
      const t = 0.22 + r * 0.17;
      const y0 = alto + 9 + t * (basso - alto - 18);
      const ox = lato * (W - 20) * Math.cos(theta), oy = -(W - 20) * Math.sin(theta) * 0.55;
      tratto(ctx, [[cx + lato * 10, y0], [cx + ox, y0 + oy]], 1.4, 0.35);
    }
    // il bordo delle pagine sotto (spessore del libro)
    const ox = lato * (W - 2) * Math.cos(theta), oy = -(W - 2) * Math.sin(theta) * 0.55;
    tratto(ctx, [[cx + ox, alto + oy + 6], [cx + ox, basso + oy - 4]], 1.2, 0.5);
  }
  pezzo(ctx, R(cx - 4, alto - 4, 8, basso - alto + 8, 4), '#4f8a92', { ombra: [2, 0], spessore: 2 });
}

function disegnaPoltrona(ctx, nome, l, a) {
  const STOFFA = '#d98d86', GAMBE = '#8a5a3c';
  for (const x of [46, l - 46]) pezzo(ctx, P([[x - 8, a - 34], [x + 8, a - 34], [x + 4, a - 1.5], [x - 4, a - 1.5]]), GAMBE, { ombra: [4, 0], spessore: 2 });
  const schienale = tondo([[60, 160], [54, 60, 40], [80, 24, 40], [176, 24, 40], [202, 60, 40], [196, 160]], 30);
  pezzo(ctx, schienale, STOFFA, { ombra: [14, 6], luce: 4 });
  for (const x of [92, 128, 164]) tratto(ctx, [[x, 44], [x, 140]], 1.4, 0.35);
  pezzo(ctx, tondo([[30, 178], [226, 178], [232, a - 32], [24, a - 32]], 12), STOFFA, { ombra: [14, 8], luce: 3 });
  pezzo(ctx, tondo([[70, 148], [186, 148], [194, 186], [62, 186]], 14), schiarisci(STOFFA, 0.18), { ombra: [8, 6], luce: 3 });
  // braccioli imbottiti con il ricciolo
  const braccio = [[22, a - 34], [20, 120, 18], [36, 98, 18], [74, 98, 18], [88, 120, 18], [88, a - 34]];
  pezzo(ctx, tondo(braccio, 12), STOFFA, { ombra: [10, 6], luce: 4 });
  pezzo(ctx, tondo(specchia(braccio, l / 2), 12), STOFFA, { ombra: [10, 6], luce: 4 });
  tratto(ctx, [[46, 132], [40, 118], [52, 110], [62, 122], [54, 130]], 1.6, 0.6);
  tratto(ctx, [[l - 46, 132], [l - 40, 118], [l - 52, 110], [l - 62, 122], [l - 54, 130]], 1.6, 0.6);
  // un cuscino a righe
  const cuscino = tondo([[92, 118], [138, 108], [146, 150], [98, 156]], 12);
  pezzo(ctx, cuscino, '#f6e8c8', { ombra: [6, 5], luce: 2 });
  ctx.save(); ctx.clip(cuscino);
  for (let x = 96; x < 150; x += 12) tratto(ctx, [[x, 100], [x + 6, 160]], 3, 0.5, '#9cc0d8');
  ctx.restore();
  linea(ctx, cuscino, { spessore: 2.2 });
}

/* ------------------------------------------------------------------------ */
/*  OGGETTI DELLA BAMBINA                                                   */
/* ------------------------------------------------------------------------ */
function disegnaBastone(ctx, nome, l, a) {
  const p = P([[29, a - 1.5], [27, 120], [28, 12], [32, 6], [36, 12], [36, 120], [36, a - 1.5]], false);
  pezzo(ctx, p, '#9b6b47', { ombra: [3, 0], luce: 1.5, spessore: 2.2 });
  tubo(ctx, [[34, 92], [44, 80]], '#9b6b47', 3, false);
  tratto(ctx, [[31, 150], [31, 166]], 1.2, 0.6);
  tratto(ctx, [[33, 40], [33, 54]], 1.2, 0.6);
}

/** Stella cicciotta a cinque punte con gli angoli arrotondati. */
function stella(cx, cy, rFuori, rDentro, rot) {
  const punti = [];
  for (let k = 0; k < 10; k++) {
    const ang = rot - Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? rDentro : rFuori;
    punti.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, k % 2 ? 4 : rFuori * 0.2]);
  }
  return tondo(punti, 5);
}

/** Scintilla a quattro punte. */
function scintilla(ctx, x, y, r) {
  const punti = [];
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4, d = k % 2 ? r * 0.28 : r;
    punti.push([x + Math.cos(ang) * d, y + Math.sin(ang) * d]);
  }
  pezzo(ctx, P(punti), '#fffbe0', { ombra: [0, 0], spessore: 1.3, coloreLinea: '#d8b84a' });
}

function disegnaBacchetta(ctx, nome, l, a) {
  const cx = l / 2;
  if (nome === 'f1') {
    const g = ctx.createRadialGradient(cx, 52, 8, cx, 52, 48);
    g.addColorStop(0, 'rgba(255,246,190,0.8)');
    g.addColorStop(1, 'rgba(255,246,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, l, 110);
  }
  pezzo(ctx, P([[cx - 5, a - 1.5], [cx - 4, 74], [cx + 4, 74], [cx + 5, a - 1.5]]), '#7d5236', { ombra: [3, 0], luce: 1.5, spessore: 2.2 });
  pezzo(ctx, stella(cx, 50, 38, 19, -0.18), '#f8eda0', { ombra: [6, 6], luce: 3 });
  tinta(ctx, E(cx - 10, 40, 6, 3, -0.6), '#ffffff', 0.6);
  if (nome === 'f1') {
    for (const [x, y, r] of [[14, 22, 9], [80, 18, 7], [82, 76, 8], [12, 84, 6], [70, 106, 5], [32, 10, 5]]) scintilla(ctx, x, y, r);
    for (const [x, y] of [[24, 46], [76, 44], [56, 92], [40, 108]]) tinta(ctx, C(x, y, 2), '#fff3a8');
  }
}

function disegnaBorsa(ctx, nome, l, a) {
  const ROSA = '#f2a495';
  tubo(ctx, [[68, 72], [54, 34], [66, 10], [94, 10], [106, 34], [92, 72]], '#e58b80', 6);
  // arricciatura in cima
  const gala = P([[58, 74], [60, 58], [68, 64], [74, 52], [80, 60], [86, 52], [92, 64], [100, 58], [102, 74]], true);
  pezzo(ctx, gala, ROSA, { ombra: [4, 3], luce: 2 });
  const corpo = P([[80, 66], [106, 70], [134, 96], [140, 128], [126, 152], [80, 158], [34, 152], [20, 128], [26, 96], [54, 70]], true);
  pezzo(ctx, corpo, ROSA, { ombra: [14, 10], luce: 4 });
  // pieghe che partono dal laccio
  tratto(ctx, [[66, 82], [52, 104], [48, 126]], 1.6, 0.6);
  tratto(ctx, [[94, 82], [108, 102], [112, 122]], 1.6, 0.6);
  tratto(ctx, [[80, 84], [80, 104]], 1.4, 0.45);
  tubo(ctx, [[56, 76], [80, 82], [104, 76]], '#e58b80', 4);
  pezzo(ctx, C(80, 82, 5), '#e58b80', { ombra: [1, 1], spessore: 1.8 });
  tinta(ctx, E(46, 106, 9, 16, 0.3), '#ffffff', 0.3);
}

function disegnaChiave(ctx, nome, l, a) {
  const OTTONE = '#ddb35a';
  ctx.save();
  ctx.translate(l / 2, a / 2);
  ctx.rotate(-0.3);
  ctx.scale(0.92, 0.92);
  ctx.translate(-43, -55.5);   // il centro della chiave va al centro della cella
  const gambo = R(34, 44, 50, 8, 3);
  pezzo(ctx, gambo, OTTONE, { ombra: [0, 3], luce: 1.5, spessore: 2 });
  pezzo(ctx, P([[68, 50], [84, 50], [84, 66], [79, 66], [79, 60], [74, 60], [74, 66], [68, 66]]), OTTONE, { ombra: [0, 3], spessore: 2 });
  pezzo(ctx, R(33, 41, 6, 14, 2), OTTONE, { ombra: [2, 0], spessore: 1.8 });
  pezzo(ctx, R(41, 42, 5, 12, 2), OTTONE, { ombra: [2, 0], spessore: 1.8 });
  // l'impugnatura a quadrifoglio con il buco
  const testa = unione(C(20, 48, 13), C(20, 34, 7), C(20, 62, 7), C(6, 48, 7));
  pezzo(ctx, testa, OTTONE, { ombra: [3, 3], luce: 2, sotto: true, spessore: 2 });
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(C(20, 48, 5.5)); ctx.restore();
  linea(ctx, C(20, 48, 5.5), { spessore: 2 });
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  VEICOLI                                                                 */
/* ------------------------------------------------------------------------ */
const BLU = '#6f7cba', BLU_CHIARO = '#aab8ea', PIPA = '#7b4f35';

/** La pipa che fuma (esce dal paraurti dell'auto immaginaria). */
function pipa(ctx, x, y, verso) {
  tubo(ctx, [[x, y], [x + verso * 22, y + 4], [x + verso * 32, y + 4]], PIPA, 7);
  const bx = x + verso * 40;
  pezzo(ctx, tondo([[bx - 12, y - 22], [bx + 12, y - 22], [bx + 10, y + 10], [bx - 9, y + 10]], 6), PIPA, { ombra: [4, 0], luce: 2 });
  tinta(ctx, E(bx, y - 21, 10, 3.5), '#4a3028');
  fumo(ctx, bx + verso * 2, y - 34, 1);
}

function disegnaAutoBlu(ctx, nome, l, a) {
  const terra = a - 8;
  acquaSotto(ctx, l / 2, terra, 250);
  const nuvolaLato = [[100, 166, 30], [140, 138, 44], [200, 116, 52], [270, 108, 56], [340, 120, 50], [398, 146, 40], [430, 174, 26], [170, 166, 40], [250, 164, 44], [330, 166, 40], [400, 178, 28], [70, 180, 24]];
  const nuvolaFronte = [[256, 100, 58], [190, 116, 50], [322, 116, 50], [136, 150, 38], [376, 150, 38], [200, 160, 44], [312, 160, 44], [256, 156, 50], [104, 176, 26], [408, 176, 26]];
  const pieghe = (x, verso) => { for (const y of [236, 276, 316, 352]) tratto(ctx, [[x, y], [x + verso * 9, y + 9], [x, y + 18]], 1.8, 0.75); };
  if (nome === 'lato') {
    ruota(ctx, 118, terra - 44, 40);
    ruota(ctx, 322, terra - 44, 40);
    const corpo = tondo([[44, 384, 16], [28, 300, 40], [38, 222, 40], [74, 194, 40], [266, 190, 30], [372, 296, 30], [408, 312, 22], [416, 356, 20], [402, 384, 12]], 30);
    pezzo(ctx, corpo, BLU, { ombra: [12, 10], luce: 4, spessore: 2.8 });
    finestrino(ctx, tondo([[62, 222], [146, 222], [146, 300], [58, 302]], 12), 58, 222, 88, 80);
    finestrino(ctx, tondo([[162, 222], [252, 222], [252, 300], [162, 300]], 12), 162, 222, 90, 78);
    finestrino(ctx, tondo([[268, 222], [280, 222, 4], [350, 298, 8], [268, 300]], 10), 268, 222, 82, 78);
    tratto(ctx, [[156, 306], [156, 376]], 1.6, 0.5);
    tratto(ctx, [[260, 306], [260, 376]], 1.6, 0.5);
    pezzo(ctx, R(226, 314, 22, 6, 3), BLU_CHIARO, { ombra: [2, 1], spessore: 1.5 });
    pezzo(ctx, C(390, 322, 15), BLU_CHIARO, { ombra: [3, 3], luce: 2 });
    pieghe(36, 1);
    pezzo(ctx, tondo([[384, 346], [436, 348], [450, 370], [436, 392], [380, 392]], 16), BLU_CHIARO, { ombra: [6, 5], luce: 2 });
    pipa(ctx, 444, 372, 1);
    nuvola(ctx, nuvolaLato, 0.82);
    schizzi(ctx, 118, terra, 120, 3);
    schizzi(ctx, 322, terra, 120, 4);
  } else {
    const fronte = nome === 'fronte';
    gomma(ctx, 112, terra - 84, 50, 80);
    gomma(ctx, l - 162, terra - 84, 50, 80);
    const corpo = tondo([[108, 388, 14], [96, 300, 40], [118, 226, 40], [160, 192, 40], [352, 192, 40], [394, 226, 40], [416, 300, 40], [404, 388, 14]], 30);
    pezzo(ctx, corpo, BLU, { ombra: [16, 10], luce: 4, spessore: 2.8 });
    if (fronte) {
      finestrino(ctx, tondo([[162, 220], [350, 220], [376, 294], [136, 294]], 14), 136, 220, 240, 74);
      for (const x of [146, l - 146]) pezzo(ctx, C(x, 322, 18), BLU_CHIARO, { ombra: [3, 3], luce: 2 });
      pezzo(ctx, R(232, 318, 48, 10, 5), mescola(BLU, LILLA, 0.3), { ombra: [0, 2], spessore: 1.6 });
    } else {
      finestrino(ctx, tondo([[156, 218], [356, 218], [372, 296], [140, 296]], 14), 140, 218, 232, 78);
      for (const x of [116, l - 148]) pezzo(ctx, R(x, 308, 32, 34, 10), '#f4a9b4', { ombra: [4, 4], luce: 2 });
      pezzo(ctx, R(224, 318, 64, 24, 5), '#fbf3dd', { ombra: [3, 3], spessore: 1.8 });
      pieghe(108, 1);
      pieghe(l - 108, -1);
    }
    pezzo(ctx, tondo([[118, 352], [394, 352], [406, 374], [394, 396], [118, 396], [106, 374]], 16), BLU_CHIARO, { ombra: [0, 6], luce: 2 });
    if (fronte) pipa(ctx, 290, 376, 1);
    nuvola(ctx, nuvolaFronte, 0.82);
    schizzi(ctx, 137, terra, 96, 5);
    schizzi(ctx, l - 137, terra, 96, 6);
  }
}

/** Auto giocattolo tondeggiante (rossa o gialla). */
function autoGiocattolo(colore) {
  const scuro = mescola(colore, LILLA, 0.45);
  return function (ctx, nome, l, a) {
    const yR = a - 33;
    if (nome === 'lato') {
      const corpo = tondo([[40, 228, 16], [28, 178, 26], [50, 140, 26], [96, 128, 16], [122, 72, 22], [154, 56, 24], [236, 56, 24], [272, 72, 22], [298, 128, 16], [344, 140, 26], [360, 180, 26], [350, 228, 16]], 26);
      pezzo(ctx, corpo, colore, { ombra: [10, 10], luce: 4, spessore: 2.6 });
      // passaruota scuri
      ctx.save(); ctx.clip(corpo);
      for (const x of [106, 280]) tinta(ctx, C(x, yR, 38), scuro);
      ctx.restore();
      finestrino(ctx, tondo([[126, 84], [190, 74], [190, 128], [110, 128]], 14), 110, 74, 80, 54);
      finestrino(ctx, tondo([[204, 74], [258, 82], [282, 128], [204, 128]], 14), 204, 74, 78, 54);
      tratto(ctx, [[197, 136], [197, 196]], 1.6, 0.55);
      pezzo(ctx, R(170, 146, 18, 6, 3), schiarisci(colore, 0.4), { ombra: [2, 1], spessore: 1.4 });
      pezzo(ctx, C(348, 160, 11), '#fff1b8', { ombra: [2, 2], luce: 2 });
      pezzo(ctx, R(26, 152, 10, 22, 4), '#f4a9b4', { ombra: [2, 2], spessore: 1.8 });
      pezzo(ctx, R(326, 196, 38, 14, 6), '#f6efe0', { ombra: [3, 3], spessore: 2 });
      pezzo(ctx, R(20, 196, 32, 14, 6), '#f6efe0', { ombra: [3, 3], spessore: 2 });
      ruota(ctx, 106, yR, 30, '#f6efe0');
      ruota(ctx, 280, yR, 30, '#f6efe0');
    } else {
      const fronte = nome === 'fronte';
      gomma(ctx, 70, a - 62, 38, 60);
      gomma(ctx, l - 108, a - 62, 38, 60);
      const corpo = tondo([[74, 230, 18], [62, 160, 30], [96, 130, 22], [120, 66, 30], [264, 66, 30], [288, 130, 22], [322, 160, 30], [310, 230, 18]], 26);
      pezzo(ctx, corpo, colore, { ombra: [14, 10], luce: 4, spessore: 2.6 });
      finestrino(ctx, tondo([[132, 80], [252, 80], [270, 134], [114, 134]], 14), 114, 80, 156, 54);
      if (fronte) {
        for (const x of [110, l - 110]) {
          pezzo(ctx, C(x, 170, 22), '#f6efe0', { ombra: [3, 3], spessore: 2.2 });
          pezzo(ctx, C(x, 170, 14), '#fff1b8', { ombra: [3, 3], luce: 2, spessore: 1.8 });
        }
        tratto(ctx, [[166, 184], [192, 194], [218, 184]], 2.4, 0.9);
      } else {
        for (const x of [94, l - 120]) pezzo(ctx, R(x, 156, 26, 22, 8), '#f4a9b4', { ombra: [3, 3], luce: 2 });
        pezzo(ctx, R(164, 168, 56, 22, 5), '#fbf3dd', { ombra: [3, 3], spessore: 1.8 });
      }
      pezzo(ctx, R(70, 204, 244, 20, 9), '#f6efe0', { ombra: [0, 5], luce: 2 });
    }
  };
}

function disegnaAutobus(ctx, nome, l, a) {
  const MENTA = '#93cfc1', PANNA = '#f8edcf', FASCIA = '#ef907e';
  const yR = a - 46;
  const bicolore = (corpo, yTaglio) => {
    pezzo(ctx, corpo, MENTA, { ombra: [14, 10], luce: 4, spessore: 0 });
    ctx.save(); ctx.clip(corpo);
    pezzo(ctx, R(-10, yTaglio, l + 20, a), PANNA, { ombra: [14, 10], luce: 0, spessore: 0 });
    pezzo(ctx, R(-10, yTaglio - 12, l + 20, 12), FASCIA, { ombra: [0, 3], spessore: 2 });
    ctx.restore();
    linea(ctx, corpo, { spessore: 2.8 });
  };
  if (nome === 'lato') {
    const corpo = tondo([[34, 336], [24, 92], [62, 54], [700, 54], [740, 88], [748, 336]], 36);
    bicolore(corpo, 248);
    ctx.save(); ctx.clip(corpo);
    for (const x of [180, 590]) { tinta(ctx, C(x, yR, 54), mescola(PANNA, LILLA, 0.55)); linea(ctx, C(x, yR, 54), { spessore: 2.4 }); }
    ctx.restore();
    for (let k = 0; k < 8; k++) {
      const x = 60 + k * 66;
      finestrino(ctx, R(x, 96, 56, 86, 10), x, 96, 56, 86);
    }
    // porta a due ante e parabrezza
    pezzo(ctx, R(612, 92, 74, 226, 8), MENTA, { ombra: [4, 0], spessore: 2.2 });
    finestrino(ctx, R(618, 100, 29, 150, 6), 618, 100, 29, 150);
    finestrino(ctx, R(651, 100, 29, 150, 6), 651, 100, 29, 150);
    finestrino(ctx, tondo([[698, 96], [728, 96], [740, 200], [698, 200]], 10), 698, 96, 42, 104);
    pezzo(ctx, R(560, 64, 120, 20, 6), '#5b6270', { ombra: [0, 3], spessore: 2 });
    for (let k = 0; k < 4; k++) tinta(ctx, R(574 + k * 24, 71, 16, 5, 2), '#ffe08a');
    pezzo(ctx, C(738, 280, 12), '#fff1b8', { ombra: [2, 2], luce: 2 });
    pezzo(ctx, R(18, 290, 22, 30, 6), '#f4a9b4', { ombra: [3, 3], spessore: 2 });
    ruota(ctx, 180, yR, 42);
    ruota(ctx, 590, yR, 42);
  } else {
    const fronte = nome === 'fronte';
    gomma(ctx, 222, a - 92, 54, 90);
    gomma(ctx, l - 276, a - 92, 54, 90);
    const corpo = tondo([[216, 338], [206, 84], [240, 50], [528, 50], [562, 84], [552, 338]], 34);
    bicolore(corpo, 248);
    if (fronte) {
      finestrino(ctx, tondo([[236, 104], [532, 104], [540, 222], [228, 222]], 14), 228, 104, 312, 118);
      tratto(ctx, [[384, 104], [384, 222]], 2.4, 1);
      pezzo(ctx, R(300, 62, 168, 28, 6), '#5b6270', { ombra: [0, 3], spessore: 2 });
      for (let k = 0; k < 5; k++) tinta(ctx, R(318 + k * 28, 72, 20, 7, 2), '#ffe08a');
      for (const x of [252, l - 252]) pezzo(ctx, C(x, 276, 16), '#fff1b8', { ombra: [3, 3], luce: 2 });
      pezzo(ctx, R(336, 268, 96, 26, 6), '#f6efe0', { ombra: [3, 3], spessore: 1.8 });
    } else {
      finestrino(ctx, R(252, 92, 264, 104, 14), 252, 92, 264, 104);
      for (const x of [234, l - 262]) pezzo(ctx, R(x, 262, 28, 36, 8), '#f4a9b4', { ombra: [3, 3], luce: 2 });
      for (let k = 0; k < 5; k++) tratto(ctx, [[324, 264 + k * 8], [444, 264 + k * 8]], 2, 0.6);
    }
    pezzo(ctx, R(206, 314, 356, 26, 10), '#e9ded0', { ombra: [0, 6], luce: 2 });
  }
}

/* ------------------------------------------------------------------------ */
/*  IL CATALOGO                                                             */
/* ------------------------------------------------------------------------ */
const F2 = ['f0', 'f1'], F4 = ['f0', 'f1', 'f2', 'f3'], BASE = ['base'], AUTO = ['lato', 'fronte', 'retro'];

// [nome, larghezza cella, altezza cella, altezza nel mondo, fotogrammi, funzione]
const CATALOGO = [
  ['albero', 384, 512, 3.4, F2, disegnaAlbero],
  ['alberello', 192, 320, 1.6, BASE, disegnaAlberello],
  ['vaso_bonsai', 128, 160, 0.7, BASE, disegnaBonsai],
  ['vaso_lavanda', 128, 128, 0.55, BASE, disegnaLavanda],
  ['vaso_foglie', 128, 160, 0.65, BASE, disegnaVasoFoglie],
  ['cassetta_fiori', 192, 96, 0.4, BASE, disegnaCassettaFiori],
  ['edera_pendente', 256, 384, 1.6, F2, disegnaEdera],
  ['tronco_cavo', 256, 256, 0.9, BASE, disegnaTroncoCavo],
  null, // respiro
  ['lampione', 128, 448, 2.7, BASE, disegnaLampione],
  ['bidone', 128, 160, 0.75, BASE, disegnaBidone],
  ['panchina', 256, 128, 0.6, BASE, disegnaPanchina],
  ['bicicletta', 256, 160, 0.75, BASE, disegnaBicicletta],
  ['cancello', 384, 384, 1.5, BASE, disegnaCancello],
  null,
  ['cesto_baguette', 160, 192, 0.7, BASE, disegnaCestoBaguette],
  ['pagnotta', 128, 96, 0.25, BASE, disegnaPagnotta],
  ['pane_tondo', 128, 96, 0.22, BASE, disegnaPaneTondo],
  ['ciambella', 96, 96, 0.15, BASE, disegnaCiambella],
  ['baguette', 192, 64, 0.18, BASE, disegnaBaguette],
  ['bancone', 512, 256, 1.0, BASE, disegnaBancone],
  ['forno_fuoco', 256, 192, 0.8, F4, disegnaFuoco],
  null,
  ['lampada_appesa', 128, 192, 0.6, BASE, disegnaLampadaAppesa],
  ['pila_libri', 160, 160, 0.5, BASE, disegnaPilaLibri],
  ['libro_volante', 192, 128, 0.3, F4, disegnaLibroVolante],
  ['poltrona', 256, 256, 0.9, BASE, disegnaPoltrona],
  ['bastone', 64, 256, 0.6, BASE, disegnaBastone],
  ['bacchetta', 96, 256, 0.6, F2, disegnaBacchetta],
  ['borsa', 160, 160, 0.3, BASE, disegnaBorsa],
  ['chiave', 96, 96, 0.12, BASE, disegnaChiave],
  null,
  ['auto_blu', 512, 448, 2.0, AUTO, disegnaAutoBlu],
  ['auto_rossa', 384, 256, 1.15, AUTO, autoGiocattolo('#e9786b')],
  ['auto_gialla', 384, 256, 1.15, AUTO, autoGiocattolo('#f4cf5f')],
  ['autobus', 768, 384, 2.2, AUTO, disegnaAutobus],
];

/**
 * Dipinge tutti gli oggetti di scena.
 * Restituisce { nome: { tela, fotogrammi, cella: {l, a}, altezzaMondo } }
 */
export async function creaOggetti() {
  const oggetti = {};
  for (const voce of CATALOGO) {
    if (!voce) { await respira(); continue; }   // una pausa tra un gruppo e l'altro
    const [nome, l, a, altezzaMondo, fotogrammi, disegna] = voce;
    const atlante = creaAtlante(fotogrammi, { l, a }, disegna);
    oggetti[nome] = { tela: atlante.tela, fotogrammi: atlante.fotogrammi, cella: { l, a }, altezzaMondo };
  }
  return oggetti;
}
