/* ==========================================================================
 *  personaggi.js — I PERSONAGGI DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui si dipingono (solo con il codice!) tutti i personaggi, ispirati al
 *  cortometraggio "Out of Sight":
 *
 *    - LIA       la bambina col cappellino a campana (tre "vestiti")
 *    - BISCOTTO  il suo cagnolino color crema dalle orecchie lunghe
 *    - GATTINO   il micetto del vicolo
 *    - LADRO     il signore con la giacca di pelle che ruba la borsetta
 *
 *  Il gioco è un cartone animato a scorrimento laterale: i personaggi sono
 *  GRANDI sullo schermo e quasi sempre visti DI LATO (rivolti a destra; il
 *  motore li specchia per andare a sinistra). Per questo le pose di lato e
 *  la fluidità dei cicli (camminata, corsa) sono la parte più curata.
 *
 *  Stile "cel" pulito, come nel film:
 *    - una linea bruno scuro sottile e regolare (circa 2 px), appena più
 *      piena sul lato in ombra, come la china di un animatore;
 *    - campiture piatte e luminose con UN solo tono d'ombra per colore;
 *    - niente grana dentro i personaggi (la carta sta nei fondali).
 *
 *  Animazione: ogni posa è una funzione della "fase" t (da 0 a 1). Un ciclo
 *  di 8 fotogrammi usa t = 0, 1/8, 2/8 ... così i passaggi sono continui.
 *  Principi usati: contatto / abbassamento / passaggio / sollevamento,
 *  braccia opposte alle gambe, testa che oscilla di 2-4 px, leggero
 *  "schiacciamento" quando il piede tocca terra, capelli, orlo del vestito e
 *  borsetta che "arrivano dopo" (azione sovrapposta), piedi ben piantati.
 *
 *  Coordinate: ogni personaggio si disegna con l'origine (0, 0) a terra, al
 *  centro dei piedi; la y cresce verso il basso (sopra il suolo y < 0).
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, scurisci, percorso, Forme, tinta, linea, ombreggia,
  acquerello, velatura, pennellata, granula, foglia, fogliame, fiorellini, creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  COLORI, SPESSORI E UN PO' DI MATEMATICA                                 */
/* ------------------------------------------------------------------------ */
const INK = '#5a3f30';                     // la linea dei personaggi
const INK2 = '#a3846c';                    // linee di dettaglio (pieghe, ciocche)
const LW = 1.9;                            // spessore della linea ≈ altezza / 160
const GRADI = 180 / Math.PI;
const TAU = Math.PI * 2;

const C = {
  pelle: '#fbf1e4', pelleLontana: '#f0e0cd',
  capelli: '#eebd80', bianco: '#fffdf8',
  azzurro: '#66c1c6', salmone: '#f4aa9f', salmoneScuro: '#d98a7e',
  viola: '#6d5d87', vestitoStrega: '#74658f', oro: '#efc95a', legno: '#8a5a3a', stella: '#f6e08a',
  pupilla: '#2e211c', bocca: '#ee8a70', boccaDentro: '#a4493f', lingua: '#ef9188',
  cane: '#f6e7bd', orecchie: '#d79b5c', naso: '#33251f', collare: '#7fb6d8', muso: '#fbf0d4',
  gatto: '#f7ecd5', rosa: '#f2aaa6',
  giacca: '#9c6b45', giaccaScura: '#86593a', berretto: '#8a5c3c', pantaloni: '#aba4d9',
  pantaloniScuri: '#968ec8', scarpeLadro: '#4c3428', pelleLadro: '#f5dcc4', capelliLadro: '#7a5238',
};

/** Il secondo tono (ombra "cel") di ogni colore: piatto, un po' più scuro. */
const TONI = {
  [C.pelle]: '#efdcc8', [C.pelleLontana]: '#e6d2bd', [C.capelli]: '#dba166', [C.bianco]: '#e3e6ef',
  [C.azzurro]: '#4fa6b0', [C.salmone]: '#e08f84', [C.viola]: '#57496f', [C.vestitoStrega]: '#5c4e77',
  [C.cane]: '#e9d29d', [C.orecchie]: '#bd7f45', [C.gatto]: '#e8d9ba', [C.legno]: '#6f4529',
  [C.giacca]: '#83573a', [C.pantaloni]: '#948dc6', [C.pantaloniScuri]: '#827abb', [C.berretto]: '#74492c',
  [C.pelleLadro]: '#e8c8aa', [C.stella]: '#ecc86a',
};
const tono = (colore) => TONI[colore] || scurisci(colore, 0.14);

/*  Gli spessori sono in pixel "veri": quando un personaggio è disegnato
 *  ingrandito (gatto, ladro) la scala corrente SC li compensa.            */
let SC = 1;
const px = (v) => v / SC;

/** Disegna con una scala in più, tenendo costanti gli spessori delle linee. */
function inScala(ctx, s, disegna) {
  const prima = SC;
  ctx.save();
  ctx.scale(s, s);
  SC = prima * s;
  try { return disegna(); } finally { SC = prima; ctx.restore(); }
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const morbido = (t) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
const giro = (t) => ((t % 1) + 1) % 1;
const onda = (t) => Math.sin(TAU * t);     // un'onda completa mentre t va da 0 a 1
const ondaC = (t) => Math.cos(TAU * t);
const piu = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ruota = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
/** Vettore lungo "l" con angolo "a" misurato dalla verticale (0 = giù, positivo = in avanti). */
const verso = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];

/* ------------------------------------------------------------------------ */
/*  PENNELLI DEI PERSONAGGI                                                 */
/* ------------------------------------------------------------------------ */

/** Unisce più forme in un solo Path2D (utile per ritagliare). */
function unione(forme) {
  const p = new Path2D();
  for (const f of forme) p.addPath(percorso(f));
  return p;
}

/** Linea spezzata (segmenti dritti) come Path2D. */
function spezzata(punti) {
  const p = new Path2D();
  punti.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
}

/** Curva morbida che parte da a, PASSA per g (gomito/ginocchio) e arriva a c. */
function arco(a, g, c) {
  const p = new Path2D();
  p.moveTo(a[0], a[1]);
  p.quadraticCurveTo(2 * g[0] - (a[0] + c[0]) / 2, 2 * g[1] - (a[1] + c[1]) / 2, c[0], c[1]);
  return p;
}

/**
 * Contorno: un tratto doppio steso PRIMA del colore e spostato di un soffio
 * verso il basso a sinistra. Il colore poi copre la metà interna: resta una
 * linea regolare, appena più sottile in alto a destra e più piena in basso
 * a sinistra, come la china di un animatore.
 */
function contorno(ctx, pp, w) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = px(w * 2);
  ctx.translate(px(-0.3), px(0.35));
  for (const p of pp) ctx.stroke(p);
  ctx.restore();
}

/**
 * Tono d'ombra "cel": colora la falce del pezzo che resta scoperta quando
 * la sua sagoma viene spostata verso la luce (che arriva da destra, in alto).
 */
function ombraCel(ctx, p, k, colore) {
  const fuori = new Path2D();
  fuori.rect(-5000, -5000, 10000, 10000);
  fuori.addPath(p, new DOMMatrix([1, 0, 0, 1, px(7 * k), px(-4 * k)]));
  ctx.save();
  ctx.clip(fuori, 'evenodd');          // pari/dispari = "fuori dalla sagoma spostata"
  ombreggia(ctx, p, p, colore);
  ctx.restore();
}

/**
 * Il "mattone" dei personaggi: una o più forme fuse in un'unica sagoma,
 * con contorno, tinta piatta e (se ombra > 0) il secondo tono.
 */
function pezzo(ctx, forme, colore, ombra = 1, w = LW) {
  const pp = (Array.isArray(forme) ? forme : [forme]).map(percorso);
  contorno(ctx, pp, w);
  for (const p of pp) tinta(ctx, p, colore);
  if (ombra) ombraCel(ctx, pp[0], ombra, tono(colore));
  return pp[0];
}

/** "Tubo" col contorno: braccia, gambe, code sottili, cinghie, bastoni. */
function tubo(ctx, punti, larg, colore, w = LW, dritto = false) {
  const p = punti instanceof Path2D ? punti : dritto ? spezzata(punti) : Forme.curva(punti);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = larg + px(2 * w);
  ctx.translate(px(-0.3), px(0.35));
  ctx.stroke(p);
  ctx.translate(px(0.3), px(-0.35));
  ctx.strokeStyle = colore;
  ctx.lineWidth = larg;
  ctx.stroke(p);
  ctx.restore();
}

/**
 * Arto affusolato (zampe del cane): da "a" passando per la giuntura "g"
 * fino a "c", largo w0 in alto, w1 alla giuntura, w2 in fondo.
 */
function arto(ctx, a, g, c, w0, w1, w2, colore, ombra = 0.7) {
  const nor = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1; return [-dy / d, dx / d]; };
  const n0 = nor(a, g), n1 = nor(a, c), n2 = nor(g, c);
  const bordo = (s) => [[a[0] + s * n0[0] * w0 / 2, a[1] + s * n0[1] * w0 / 2], [g[0] + s * n1[0] * w1 / 2, g[1] + s * n1[1] * w1 / 2], [c[0] + s * n2[0] * w2 / 2, c[1] + s * n2[1] * w2 / 2]];
  const [l0, l1, l2] = bordo(1), [r0, r1, r2] = bordo(-1);
  const dir = [c[0] - g[0], c[1] - g[1]], dl = Math.hypot(...dir) || 1;
  const p = new Path2D();
  p.moveTo(...l0);
  p.quadraticCurveTo(2 * l1[0] - (l0[0] + l2[0]) / 2, 2 * l1[1] - (l0[1] + l2[1]) / 2, ...l2);
  p.quadraticCurveTo(c[0] + (dir[0] / dl) * w2 * 0.7, c[1] + (dir[1] / dl) * w2 * 0.7, ...r2);
  p.quadraticCurveTo(2 * r1[0] - (r0[0] + r2[0]) / 2, 2 * r1[1] - (r0[1] + r2[1]) / 2, ...r0);
  p.closePath();
  pezzo(ctx, p, colore, ombra);
}

/** Tratto di dettaglio (pieghe, ciocche, bocche). */
function tratto(ctx, punti, w = 1.7, colore = INK, alfa = 1) {
  linea(ctx, Forme.curva(punti), { spessore: px(w), colore, alfa });
}

function occhio(ctx, x, y, rx, ry, g, stato = 'aperti', dir = 1) {
  if (stato === 'chiusi') return tratto(ctx, [[x - rx * 0.95, y + ry * 0.1], [x, y + ry * 0.4], [x + rx * 0.95, y + ry * 0.1]], 1.9);
  if (stato === 'felici') return tratto(ctx, [[x - rx * 0.95, y + ry * 0.3], [x, y - ry * 0.35], [x + rx * 0.95, y + ry * 0.3]], 1.9);
  if (stato === 'strizzati') {
    return tratto(ctx, [[x - dir * rx * 0.85, y - ry * 0.5], [x + dir * rx * 0.7, y], [x - dir * rx * 0.85, y + ry * 0.5]], 1.9);
  }
  const p = Forme.ellisse(x, y, rx, ry);
  tinta(ctx, p, C.bianco);
  const r = Math.max(1.4, rx * 0.3);
  let gy = g[1];
  if (stato === 'socchiusi') gy = Math.max(gy, 0.5);
  tinta(ctx, Forme.ellisse(x + g[0] * (rx - r - 1.4), y + gy * (ry - r * 1.15 - 1.6), r, r * 1.15), C.pupilla);
  if (stato === 'socchiusi') {              // palpebra calata a metà
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.rettangolo(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 1.0 + 2), C.pelle);
    ctx.restore();
    tratto(ctx, [[x - rx, y + ry * 0.02], [x, y - ry * 0.08], [x + rx, y + ry * 0.02]], 1.8);
  }
  linea(ctx, p, { spessore: px(1.4) });
}

/**
 * Testa di profilo: testone tondo con la guancia piena davanti, occhio
 * ovale alto, nasino appena accennato, bocca piccola in basso; dietro
 * l'orecchio il caschetto tagliato dritto con le punte, davanti
 * all'orecchio una ciocca sottile.
 */

/** Manina a "muffola"; se aperta spuntano quattro ditini tondi e il pollice. */
function mano(ctx, x, y, r, dir, aperta, colore, dita) {
  if (aperta) {
    const d = dita === undefined ? dir : dita;
    for (let k = 0; k < 4; k++) {
      const a = d + (k - 1.5) * 0.3;
      tubo(ctx, [[x, y], [x + Math.cos(a) * r * 1.65, y + Math.sin(a) * r * 1.65]], r * 0.62, colore, 1.5);
    }
    const ap = d - 1.3;
    tubo(ctx, [[x, y], [x + Math.cos(ap) * r * 1.25, y + Math.sin(ap) * r * 1.25]], r * 0.66, colore, 1.5);
  }
  pezzo(ctx, Forme.ellisse(x, y, r * 1.05, r * 0.9, dir), colore, 0, 1.7);
  if (!aperta) {                            // il pollice della muffola
    const a = dir - 1.2;
    pezzo(ctx, Forme.ellisse(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, r * 0.42, r * 0.36, a), colore, 0, 1.4);
  }
}

/** Stella morbida a cinque punte (la bacchetta magica). */
function stellaMorbida(ctx, x, y, r, rot) {
  const punti = [];
  for (let k = 0; k < 10; k++) {
    const a = rot + (k * Math.PI) / 5, rr = k % 2 ? r * 0.58 : r;
    punti.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  pezzo(ctx, Forme.poligono(punti, true), C.stella, 0.5, 1.8);
}

/** Scintilla a quattro punte (magia, colpetti). */
function scintilla(ctx, x, y, r) {
  const q = r * 0.24;
  const p = Forme.poligono([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]]);
  tinta(ctx, p, '#fff6b0');
  linea(ctx, p, { spessore: px(1.2), colore: '#cf9a45' });
}

/** Bastone di legno tenuto in mano. Restituisce la punta. */
function bastone(ctx, x, y, ang, lung) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const fine = [x + c * lung, y + s * lung];
  const mezzo = [x + c * lung * 0.5 - s * 1.5, y + s * lung * 0.5 + c * 1.5];
  tubo(ctx, [[x - c * 13, y - s * 13], mezzo, fine], 4.2, C.legno, 1.6);
  tratto(ctx, [[x + c * lung * 0.62 - s * 2, y + s * lung * 0.62 + c * 2], [x + c * lung * 0.62 - s * 6, y + s * lung * 0.62 + c * 6]], 1.4);
  return fine;
}

/** Bacchetta magica con la stella. Restituisce il centro della stella. */
function bacchetta(ctx, x, y, ang, lung) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const fine = [x + c * lung, y + s * lung];
  tubo(ctx, [[x - c * 8, y - s * 8], fine], 4, C.legno, 1.6);
  const st = [fine[0] + c * 9, fine[1] + s * 9];
  stellaMorbida(ctx, st[0], st[1], 14, ang);
  return st;
}

/** La borsetta tonda rosa (patta e bottoncino). */
function borsetta(ctx, x, y, r) {
  pezzo(ctx, Forme.ellisse(x, y, r * 1.12, r), C.salmone, 0.9);
  tratto(ctx, [[x - r * 0.98, y - r * 0.3], [x, y + r * 0.3], [x + r * 0.98, y - r * 0.3]], 1.5);
  pezzo(ctx, Forme.cerchio(x, y + r * 0.22, r * 0.16), C.salmoneScuro, 0, 1.3);
}

/** Dove si piega un arto lungo 2·lung tra a e c (ginocchio o gomito). */
function ginocchio(a, c, lung, lato) {
  const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
  const h = Math.sqrt(Math.max(0, lung * lung - (d / 2) * (d / 2)));
  let nx = -dy / d, ny = dx / d;
  if (nx * lato < 0) { nx = -nx; ny = -ny; }
  return [(a[0] + c[0]) / 2 + nx * h, (a[1] + c[1]) / 2 + ny * h];
}

/**
 * Caviglia di un piede durante un ciclo di passi (camminata o corsa).
 *   u: fase del piede (0 = il tallone tocca terra davanti)
 *   A: mezzo passo, S: parte del ciclo in appoggio, alza: altezza del passo
 *   rT / rP: rotazione del piede al contatto (punta su) e allo stacco (tallone su)
 *   geo: { cav: altezza caviglia, tal: tallone, pun: punta } della scarpa
 * Nell'appoggio il piede scorre all'indietro a velocità costante: col motore
 * che sposta il personaggio di 2·A/S per ciclo, il piede resta "piantato".
 */
function passo(u, A, S, alza, rT, rP, geo) {
  const appoggio = (v) => {
    const xa = A - 2 * A * v;
    let rot = 0;
    if (v < 0.2) rot = rT * (1 - morbido(v / 0.2));
    else if (v > 0.68) rot = rP * morbido((v - 0.68) / 0.32);
    let c = [xa, -geo.cav];
    if (rot < 0) c = piu([xa - geo.tal, 0], ruota([geo.tal, -geo.cav], rot));        // perno sul tallone
    else if (rot > 0) c = piu([xa + geo.pun, 0], ruota([-geo.pun, -geo.cav], rot));  // perno sulla punta
    return { x: c[0], y: c[1], rot };
  };
  const w = giro(u);
  if (w < S) return appoggio(w / S);
  const v = (w - S) / (1 - S), a = appoggio(1), b = appoggio(0), e = morbido(v);
  return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, v) - alza * Math.pow(Math.sin(Math.PI * v), 0.9), rot: lerp(a.rot, b.rot, e) };
}

/** Piede appoggiato sulla punta (tallone sollevato di "rot"). */
function piedeInPunta(xPunta, rot, geo) {
  const c = piu([xPunta, 0], ruota([-geo.pun, -geo.cav], rot));
  return { x: c[0], y: c[1], rot };
}
/** Piede appoggiato sul tallone (punta sollevata: rot negativo). */
function piedeSulTallone(xTallone, rot, geo) {
  const c = piu([xTallone, 0], ruota([geo.tal, -geo.cav], rot));
  return { x: c[0], y: c[1], rot };
}

/* ------------------------------------------------------------------------ */
/*  LIA                                                                      */
/* ------------------------------------------------------------------------ */
/*  Misure (pixel della cella; Lia è alta ~306 px col cappellino):
 *    suole 0 · caviglie -15 · orlo ~-52 · bacino -64 · spalle ~-150
 *    mento ~-164 · occhi ~-202 · tesa ~-216 · cupola -306
 *  Testa + cappello = circa il 46% dell'altezza, gambe corte, scarpe
 *  grosse: le proporzioni "a tre teste" della bambina del film.
 *  Il busto si disegna in un sistema con l'origine nel bacino, che ruota
 *  (inclinazione) e si schiaccia un poco ai contatti; la testa in un
 *  sistema con l'origine sul colletto.                                     */

const ABITI = {
  borsa: { vestito: C.azzurro, strega: false, borsa: true, oggetto: null },
  semplice: { vestito: C.azzurro, strega: false, borsa: false, oggetto: 'bastone' },
  strega: { vestito: C.vestitoStrega, strega: true, borsa: false, oggetto: 'bacchetta' },
};
const ANCA = -64;                     // altezza del bacino
const COSCIA = 26;                    // coscia = stinco
const OMERO = 27, AVAMBRACCIO = 27;
const GEO_LIA = { cav: 15, tal: 11, pun: 30 };
const SPALLE_LATO = [[-3, -86], [4, -86]];       // [lontana, vicina]
const ANCHE_LATO = [[-3, -2], [3, -2]];
const SPALLE_FRONTE = [[-21, -85], [21, -85]];   // [sinistra dello schermo, destra]
const ANCHE_FRONTE = [[-9, -2], [9, -2]];
const COLLO = [2, -100];                         // dove poggia la testa (coordinate del busto)
const LUNG_BASTONE = 112, LUNG_BACCHETTA = 44;

// Il corpo di Lia è un po' rimpicciolito e la testa no: testa + cappello ≈ 52% dell'altezza.
const SCALA_CORPO = 0.92;

/** Disegna la testa nel suo sistema H (che annulla la riduzione del corpo). */
// prima di: braccioA

/** Braccio dato da due angoli (dalla verticale): spalla→gomito e gomito→mano. */
function braccioA(spalla, a1, a2, extra) {
  const g = piu(spalla, verso(a1, OMERO));
  return Object.assign({ g, m: piu(g, verso(a2, AVAMBRACCIO)) }, extra);
}

/* ---------------- pose di lato ---------------- */

/**
 * Lo "scheletro" di Lia di lato per una posa e una fase t (0..1).
 * Indici 0 = lato lontano, 1 = lato vicino a chi guarda.
 */
function posaLato(A, posa, t) {
  const og = A.oggetto;
  const P = {
    x: 0, bob: 0, incl: 0.03, sq: 0, testa: 0, testaDx: 0, testaDy: 0, cappello: 0, frontale: false,
    piedi: [{ x: -7, y: -15, rot: 0 }, { x: 6, y: -15, rot: 0 }],
    braccia: [braccioA(SPALLE_LATO[0], 0.06, 0.24), braccioA(SPALLE_LATO[1], 0.1, 0.34)],
    capelli: [0, 0], orlo: [0, 0, 0, 0], borsa: [0, 0], orloMondo: null, accucciata: false, manoTesta: null,
    occhi: 'aperti', sguardo: [0.55, -0.6], bocca: 'chiusa', oggetto: null, effetto: null,
  };
  // l'oggetto (bastone o bacchetta) di solito sta nella mano vicina
  if (og === 'bastone') { P.braccia[1] = braccioA(SPALLE_LATO[1], 0.3, 0.75); P.oggetto = { tipo: og, mano: 1, ang: 1.2 }; }
  if (og === 'bacchetta') { P.braccia[1] = braccioA(SPALLE_LATO[1], 0.2, 1.35); P.oggetto = { tipo: og, mano: 1, rel: -1.2 }; }

  if (posa === 'fermo') {
    const b = 0.5 - 0.5 * ondaC(t);              // respiro: 0 → 1 → 0
    P.bob = -1.4 * b;
    P.testaDy = -0.7 * b;
    P.testa = -0.015 * b;
    P.capelli = [0, 1.1 * b];
    P.braccia[0] = braccioA(SPALLE_LATO[0], 0.06 + 0.03 * b, 0.24 + 0.04 * b);
    if (!og) P.braccia[1] = braccioA(SPALLE_LATO[1], 0.1 + 0.03 * b, 0.34 + 0.04 * b);
    if (Math.abs(t - 0.5) < 0.01) P.occhi = 'chiusi';   // un battito di ciglia
    P.sguardo = [0.55, -0.55 - 0.2 * b];
  }

  if (posa === 'cammina') {
    const A0 = 22, S = 0.56;
    P.piedi = [passo(t + 0.5, A0, S, 12, -0.25, 0.5, GEO_LIA), passo(t, A0, S, 12, -0.25, 0.5, GEO_LIA)];
    const giu = ondaC(2 * (t - 0.07));           // +1 = baricentro in basso (subito dopo il contatto)
    P.bob = 2.2 * giu;
    P.sq = 0.03 * Math.max(0, giu);
    P.incl = 0.05 + 0.012 * giu;
    P.testa = 0.025 * onda(2 * (t - 0.18));
    P.testaDy = 0.9 * ondaC(2 * (t - 0.16));
    const f = -0.4 * ondaC(t - 0.06);            // braccio vicino: indietro quando il piede vicino è avanti
    P.braccia[0] = braccioA(SPALLE_LATO[0], -f, -f + 0.2 + 0.3 * Math.max(0, -f / 0.4));
    if (og === 'bastone') {                       // il bastone tasta la strada davanti
      P.braccia[1] = braccioA(SPALLE_LATO[1], 0.32 + 0.03 * giu, 0.78 + 0.05 * onda(2 * t));
      P.oggetto.ang = 1.16 + 0.05 * onda(2 * t - 0.1);
    } else P.braccia[1] = braccioA(SPALLE_LATO[1], f, f + 0.2 + 0.3 * Math.max(0, f / 0.4));
    P.capelli = [-1 + 1.4 * onda(2 * (t - 0.22)), 2.2 * ondaC(2 * (t - 0.25))];
    P.orlo = [2.2 * onda(t - 0.12), 1.3 * ondaC(2 * (t - 0.2)), -1.5 + 3 * onda(t - 0.2), 2 * ondaC(2 * (t - 0.25))];
    P.borsa = [-2 + 2.6 * onda(t - 0.2), 2.8 * ondaC(2 * (t - 0.24))];
  }

  if (posa === 'corre') {
    const A0 = 30, S = 0.36;
    P.x = -10;
    P.piedi = [passo(t + 0.5, A0, S, 26, -0.15, 0.62, GEO_LIA), passo(t, A0, S, 26, -0.15, 0.62, GEO_LIA)];
    for (const p of P.piedi) p.x += P.x + 4;
    const giu = ondaC(2 * (t - 0.17));
    P.bob = 3.6 * giu - 1.5;
    P.sq = 0.05 * Math.max(0, giu) - 0.03 * Math.max(0, -giu);
    P.incl = 0.19 + 0.025 * giu;
    P.testa = -0.13 + 0.03 * onda(2 * (t - 0.2));
    P.testaDy = 1.4 * ondaC(2 * (t - 0.26));
    const f = -0.85 * ondaC(t - 0.04);
    P.braccia[0] = braccioA(SPALLE_LATO[0], -f, -f + 1.55);
    P.braccia[1] = braccioA(SPALLE_LATO[1], f, f + 1.55);
    if (og) P.oggetto = og === 'bastone' ? { tipo: og, mano: 1, ang: 2.6 } : { tipo: og, mano: 1, rel: -1.2 };   // il bastone resta dietro
    P.capelli = [-9 + 2 * onda(2 * (t - 0.3)), -5 + 2.5 * ondaC(2 * (t - 0.3))];
    P.orlo = [-6 + 2 * onda(2 * (t - 0.15)), -2, -11 + 3 * onda(2 * (t - 0.25)), -6 + 2.5 * ondaC(2 * (t - 0.3))];
    P.borsa = [-10 + 2 * onda(2 * (t - 0.3)), -8 + 3 * ondaC(2 * (t - 0.3))];
    P.cappello = -0.07;
    P.bocca = 'o';
    P.sguardo = [0.8, -0.4];
  }

  if (posa === 'tocca') {
    const k = Math.round(t * 4) % 4;             // 0 alza, 1 colpo, 2 rimbalzo (3 = riposo)
    P.incl = 0.07;
    P.testa = 0.05;
    P.piedi = [{ x: -10, y: -15, rot: 0 }, { x: 9, y: -15, rot: 0 }];
    if (og === 'bastone') {
      P.braccia[1] = { m: [[36, -122], [30, -98], [33, -108]][k], mondo: true };
      P.oggetto.ang = [0.92, 1.065, 1.0][k];
      P.effetto = k === 1 ? 'tac' : null;
      P.bocca = k === 1 ? 'o' : 'chiusa';
      P.sguardo = [0.7, -0.75];
      P.capelli = [[0, -1.5], [-1, 2], [0, 0.5]][k];
    } else if (og === 'bacchetta') {
      P.incl = [0.0, 0.26, 0.18][k];
      P.x = [0, -20, -15][k];                     // un passo indietro: la tesa larga resta nella cella
      P.testa = [0.05, -0.12, -0.08][k];          // la testa resta più dritta del busto
      P.braccia[1] = { m: [[26, -188], [30, -102], [31, -114]][k], mondo: true };
      P.oggetto = { tipo: og, mano: 1, ang: [-1.75, 1.2, 0.8][k] };
      P.effetto = ['scia', 'magia', 'magiaPiccola'][k];
      P.bocca = k === 1 ? 'sorriso' : 'chiusa';
      P.sguardo = [0.8, k ? 0.5 : -0.9];
      P.capelli = [[0, -2], [-2, 2.5], [-1, 1]][k];
      P.braccia[0] = braccioA(SPALLE_LATO[0], [-0.3, 0.2, 0.1][k], [-0.1, 0.5, 0.35][k]);
    } else {                                      // borsa: le mani avanti "tastano" l'aria
      P.braccia = [
        { m: [[30, -130], [44, -142], [42, -134]][k], mondo: true, aperta: true, dita: [-0.4, -0.15, -0.3][k] },
        { m: [[36, -120], [52, -132], [50, -124]][k], mondo: true, aperta: true, dita: [-0.2, 0.0, 0.15][k] },
      ];
      P.incl = [0.05, 0.09, 0.08][k];
      P.sguardo = [0.4, -0.9];
      P.bocca = 'o';
      P.testa = -0.06;
      P.piedi[1] = { x: 13, y: -15, rot: 0 };
    }
  }

  if (posa === 'ascolta') {                       // appoggiata alla parete: mani e orecchio contro il muro
    const k = Math.round(t * 2) % 2;
    P.x = -14;
    P.incl = 0.08 + 0.02 * k;
    P.frontale = true;                            // gira la testa verso di noi, l'orecchio sul muro
    P.testa = 0.24 + 0.03 * k;
    P.piedi = [{ x: -28, y: -15, rot: 0 }, piedeInPunta(18, 0.28, GEO_LIA)];
    P.braccia = [
      { m: [48, -172], mondo: true, aperta: true, dita: -1.5 },
      { m: [54, -146 + k], mondo: true, aperta: true, dita: -1.45 },
    ];
    if (og) P.oggetto = { tipo: og, mano: 0, ang: og === 'bastone' ? 1.5 : 1.35 };
    P.occhi = k ? 'socchiusi' : 'aperti';
    P.sguardo = k ? [0.3, 0.5] : [0.55, -0.85];
    P.bocca = k ? 'chiusa' : 'o';
    P.cappello = 0.06;
    P.capelli = [1.5, 1];
    P.orlo = [-2, 0, 2, 0];
  }

  if (posa === 'china') {                         // accovacciata per toccare qualcosa in basso
    const k = Math.round(t * 2) % 2;
    P.x = A.strega ? -20 : -14;
    P.bob = 38;
    P.incl = 0.25;
    P.testa = -0.12 + 0.04 * k;
    P.piedi = [{ x: -24, y: -15, rot: 0 }, piedeInPunta(24, 0.35, GEO_LIA)];
    P.braccia[1] = { m: k ? [58, -64] : [54, -72], mondo: true, aperta: true, dita: k ? 0.3 : 0.55 };
    P.braccia[0] = { m: [22, -48], mondo: false, aperta: false };
    if (og) P.oggetto = { tipo: og, mano: 0, ang: og === 'bastone' ? 2.75 : -1.1 };
    P.accucciata = true;
    P.sguardo = [0.6, 0.7];
    P.bocca = k ? 'sorriso' : 'chiusa';
    P.capelli = [1, 1.5];
  }

  if (posa === 'sorpresa') {
    P.x = -4;
    P.incl = -0.07;
    P.bob = -2;
    P.sq = -0.03;
    P.testa = -0.08;
    P.piedi = [{ x: -20, y: -15, rot: 0 }, { x: 13, y: -15, rot: 0 }];
    P.braccia = [
      { m: [-28, -178], mondo: true, aperta: true, dita: -2.2 },
      { m: [36, -176], mondo: true, aperta: true, dita: -0.9 },
    ];
    if (og) P.oggetto = { tipo: og, mano: 1, ang: og === 'bastone' ? -1.2 : -1.35 };
    P.sguardo = [0.1, -0.1];
    P.bocca = 'aperta';
    P.capelli = [0, -3.5];
    P.cappello = -0.05;
    P.orlo = [0, -2, 0, -2];
  }

  if (posa === 'urto') {                          // ha appena sbattuto: passo indietro, mano sulla fronte
    P.x = -6;
    P.incl = -0.06;
    P.bob = 1;
    P.sq = 0.03;
    P.testa = 0.24;
    P.piedi = [{ x: -34, y: -15, rot: 0 }, piedeSulTallone(-4, -0.3, GEO_LIA)];
    P.braccia = [
      { m: [-50, -128], mondo: true, aperta: true, dita: -2.6 },
      { m: [0, 0], aperta: true, dita: -2.2 },
    ];
    P.manoTesta = [56, -72];                      // la manina va sulla fronte, sotto la tesa
    if (og) P.oggetto = { tipo: og, mano: 0, ang: og === 'bastone' ? 2.2 : -2.3 };
    P.occhi = 'strizzati';
    P.bocca = 'o';
    P.cappello = -0.16;
    P.capelli = [3, -2];
    P.orlo = [-3, -1, 4, -2];
    P.effetto = 'botta';
  }
  return P;
}

/* ---------------- pose di fronte e di spalle ---------------- */

function posaFronte(A, posa, t, retro) {
  const og = A.oggetto;
  const io = retro ? 1 : 0;                      // mano che regge l'oggetto (la destra di Lia)
  const P = {
    x: 0, bob: 0, incl: 0, sq: 0, testa: 0, testaDx: 0, testaDy: 0, cappello: 0,
    piedi: [{ x: -13, y: -15, s: 1, alza: 0 }, { x: 13, y: -15, s: 1, alza: 0 }],
    braccia: [{ m: [-30, -32] }, { m: [30, -32] }],
    capelli: [0, 0], orlo: 0, borsa: [0, 0],
    occhi: 'aperti', sguardo: [0.3, -0.6], bocca: 'chiusa', oggetto: null,
  };
  const sgn = io ? 1 : -1;
  if (og === 'bastone') { P.braccia[io] = { m: [sgn * 33, -36] }; P.oggetto = { tipo: og, mano: io, ang: io ? 1.22 : 1.92 }; }
  if (og === 'bacchetta') { P.braccia[io] = { m: [sgn * 37, -52] }; P.oggetto = { tipo: og, mano: io, ang: io ? -1.05 : -2.1 }; }

  if (posa === 'fermo') {
    const b = t > 0.25 ? 1 : 0;
    P.bob = -1.4 * b;
    P.testaDy = -0.7 * b;
    P.capelli = [0, 1.2 * b];
    P.braccia[1 - io].m = [(io ? -1 : 1) * (30 + b), -32 - b];
    P.sguardo = [0.3, -0.6 - 0.2 * b];
  }
  if (posa === 'sorpresa') {
    P.bob = -2;
    P.sq = -0.03;
    P.piedi = [{ x: -17, y: -15, s: 1, alza: 0 }, { x: 17, y: -15, s: 1, alza: 0 }];
    P.braccia = [{ m: [-46, -118], aperta: true, dita: -2.2 }, { m: [46, -118], aperta: true, dita: -0.95 }];
    if (og) P.oggetto.ang = io ? -1.1 : -2.05;
    P.bocca = 'aperta';
    P.sguardo = [0, -0.1];
    P.capelli = [0, -3];
  }
  if (posa === 'saluta') {
    const k = Math.round(t * 2) % 2;
    const lib = 1 - io;                          // saluta con la mano libera
    P.braccia[lib] = { m: [(lib ? 1 : -1) * (40 + 8 * k), -122 + 6 * k], aperta: true, dita: lib ? -1.25 + 0.45 * k : -1.9 - 0.45 * k };
    P.bocca = 'sorriso';
    P.occhi = k ? 'felici' : 'aperti';
    P.sguardo = [0.2, -0.45];
    P.testa = k ? 0.05 : -0.03;
  }
  if (posa === 'cammina') {
    const u = TAU * t, d0 = Math.cos(u), d1 = -d0;   // +1 = piede avanti
    const dir = retro ? -1 : 1;                      // di spalle "avanti" è più in alto
    const l0 = retro ? 0 : Math.max(0, -Math.sin(u)), l1 = retro ? 0 : Math.max(0, Math.sin(u));
    P.piedi = [
      { x: -12, y: -15 + dir * 3 * d0 - 9 * l0, s: 1 + dir * 0.05 * d0, alza: Math.max(0, -d0) * 0.8 },
      { x: 12, y: -15 + dir * 3 * d1 - 9 * l1, s: 1 + dir * 0.05 * d1, alza: Math.max(0, -d1) * 0.8 },
    ];
    P.bob = retro ? 1.6 * Math.abs(d0) : 1.7 * Math.cos(2 * u);
    P.sq = 0.025 * Math.max(0, retro ? Math.abs(d0) : Math.cos(2 * u));
    P.x = retro ? -1.5 * d0 : -1.8 * Math.sin(u);
    P.incl = retro ? -0.012 * d0 : -0.015 * Math.sin(u);
    P.testa = retro ? 0.02 * d0 : -0.025 * Math.sin(u - 0.5);
    P.testaDy = 0.8 * Math.cos(2 * u - 0.8);
    if (io !== 0 || !og) P.braccia[0].m = [-30 + 2 * d1, -32 + 3 * dir * d1];
    if (io !== 1 || !og) P.braccia[1].m = [30 - 2 * d0, -32 + 3 * dir * d0];
    P.capelli = [1.3 * Math.sin(u - 0.9), 1.8 * Math.cos(2 * u - 1.1)];
    P.orlo = 2.2 * Math.sin(u - 0.6);
    P.borsa = [1.6 * Math.sin(u - 0.8), 2 * Math.cos(2 * u - 1)];
  }
  return P;
}

/* ---------------- pezzi del vestito ---------------- */

function vestitoLato(ctx, A, P, ginocchioB, orloMondo) {
  let av = [38 + P.orlo[0], 12 + P.orlo[1]], di = [-50 + P.orlo[2], 10 + P.orlo[3]];
  let ctrl = [21, -40], ctrlDietro = [-24, -42];
  if (orloMondo) { av = orloMondo[0]; di = orloMondo[1]; }
  if (ginocchioB) { ctrl = [ginocchioB[0] + 4, ginocchioB[1] - 16]; ctrlDietro = [-40, -14]; }   // accovacciata: la gonna si gonfia
  const p = new Path2D();
  p.moveTo(-9, -101);
  p.quadraticCurveTo(-18, -100, -18, -87);
  p.quadraticCurveTo(ctrlDietro[0], ctrlDietro[1], di[0], di[1]);
  p.bezierCurveTo(di[0] + 20, di[1] + 6, av[0] - 22, av[1] + 6, av[0], av[1]);
  p.quadraticCurveTo(ctrl[0], ctrl[1], 15, -87);
  p.quadraticCurveTo(15, -100, 8, -101);
  p.closePath();
  pezzo(ctx, p, A.vestito, 1.7);
  // pieghe morbide che seguono l'orlo
  const m1 = lerp2(di, av, 0.3), m2 = lerp2(di, av, 0.68);
  tratto(ctx, [[-6, -60], [-10, -24], [m1[0], m1[1] + 3]], 1.3, INK2);
  tratto(ctx, [[7, -50], [9, -16], [m2[0], m2[1] + 3]], 1.3, INK2);
}

/** Zampa del cane: anca → giuntura → caviglia, affusolata, col piedino. */

/** Vestitino ad A visto di fronte (o da dietro): l'orlo è il doppio delle spalle. */
function vestitoFronte(ctx, A, P) {
  const s = P.orlo;
  const p = new Path2D();
  p.moveTo(-10, -101);
  p.quadraticCurveTo(-21, -100, -22, -87);
  p.quadraticCurveTo(-29, -40, -50 + s, 11);
  p.bezierCurveTo(-30 + s, 18, 30 + s, 18, 50 + s, 11);
  p.quadraticCurveTo(29, -40, 22, -87);
  p.quadraticCurveTo(21, -100, 10, -101);
  p.closePath();
  pezzo(ctx, p, A.vestito, 1.7);
  tratto(ctx, [[-10, -58], [-16, -20], [-24 + s, 13]], 1.3, INK2);
  tratto(ctx, [[10, -58], [15, -20], [22 + s, 14]], 1.3, INK2);
}

/** Le mutandine bianche a balze che spuntano sotto il vestito da strega. */
function mutandineLato(ctx) {
  pezzo(ctx, Forme.poligono([[-30, -8], [24, -8], [29, 18], [19, 15], [9, 20], [-3, 16], [-15, 21], [-27, 16], [-35, 19]], true), C.bianco, 0.6, 1.8);
}
function mutandineFronte(ctx) {
  pezzo(ctx, Forme.poligono([[-40, -8], [40, -8], [43, 18], [30, 15], [16, 20], [0, 16], [-16, 20], [-30, 15], [-43, 18]], true), C.bianco, 0.6, 1.8);
}

/** Colletto bianco tondo "alla Peter Pan". */
function collettoLato(ctx) {
  pezzo(ctx, [Forme.ellisse(5, -98, 11.5, 5.4, 0.3), Forme.ellisse(-7, -99.5, 7.5, 4, -0.15)], C.bianco, 0.5, 1.8);
}
function collettoFronte(ctx, retro) {
  if (retro) { pezzo(ctx, Forme.ellisse(0, -99, 16, 5), C.bianco, 0.5, 1.8); return; }
  pezzo(ctx, [Forme.ellisse(-8.5, -97.5, 11, 6, 0.32), Forme.ellisse(8.5, -97.5, 11, 6, -0.32)], C.bianco, 0.5, 1.8);
  tratto(ctx, [[0, -102], [0, -94]], 1.2, INK2);
}

/** Mantellina viola corta e tonda, col colletto e il bottone d'oro. */
function mantellinaLato(ctx) {
  const p = new Path2D();
  p.moveTo(-8, -103);
  p.quadraticCurveTo(-31, -100, -33, -66);
  p.quadraticCurveTo(-20, -57, -6, -64);
  p.quadraticCurveTo(9, -56, 25, -66);
  p.quadraticCurveTo(25, -96, 8, -103);
  p.closePath();
  pezzo(ctx, p, C.viola, 1.3);
  tratto(ctx, [[-14, -84], [-18, -66]], 1.2, INK2);
  pezzo(ctx, Forme.ellisse(5, -97, 13.5, 7.5, 0.22), C.viola, 0.5);
  pezzo(ctx, Forme.cerchio(16, -92, 3.3), C.oro, 0, 1.4);
}
function mantellinaFronte(ctx, retro) {
  const p = new Path2D();
  p.moveTo(-12, -103);
  p.quadraticCurveTo(-35, -101, -39, -69);
  p.quadraticCurveTo(-27, -60, -14, -66);
  p.quadraticCurveTo(0, -59, 14, -66);
  p.quadraticCurveTo(27, -60, 39, -69);
  p.quadraticCurveTo(35, -101, 12, -103);
  p.closePath();
  pezzo(ctx, p, C.viola, 1.3);
  if (retro) { pezzo(ctx, Forme.ellisse(0, -99, 20, 8), C.viola, 0.5); return; }
  tratto(ctx, [[-22, -84], [-26, -68]], 1.2, INK2);
  tratto(ctx, [[22, -84], [26, -68]], 1.2, INK2);
  pezzo(ctx, [Forme.ellisse(-10, -97, 13, 7.5, 0.32), Forme.ellisse(10, -97, 13, 7.5, -0.32)], C.viola, 0.5);
  pezzo(ctx, Forme.cerchio(0, -93, 3.5), C.oro, 0, 1.4);
}

/** Manica corta a sbuffo sulla spalla, orientata come il braccio. */
function manica(ctx, spalla, g, colore) {
  const a = Math.atan2(g[1] - spalla[1], g[0] - spalla[0]);
  const c = [spalla[0] + Math.cos(a) * 6, spalla[1] + Math.sin(a) * 6];
  pezzo(ctx, Forme.ellisse(c[0], c[1], 11.5, 9.5, a), colore, 0.8);
  const e = [c[0] + Math.cos(a) * 8.5, c[1] + Math.sin(a) * 8.5], n = [-Math.sin(a), Math.cos(a)];
  tratto(ctx, [[e[0] + n[0] * 6.5, e[1] + n[1] * 6.5], [e[0] + Math.cos(a) * 2, e[1] + Math.sin(a) * 2], [e[0] - n[0] * 6.5, e[1] - n[1] * 6.5]], 1.2, INK2);
}

/**
 * Un braccio di Lia (manica, mano, eventuale bastone/bacchetta).
 * b = { m: mano, g: gomito (facoltativo), aperta, dita }.
 * Restituisce la punta dell'oggetto, se c'è.
 */
function braccioLia(ctx, A, spalla, b, o) {
  const m = b.m;
  const g = b.g || ginocchio(spalla, m, (OMERO + AVAMBRACCIO) / 2, o.lato === undefined ? -1 : o.lato);
  const pelle = o.lontano ? C.pelleLontana : C.pelle;
  if (o.soloAvambraccio) tubo(ctx, [lerp2(g, m, 0.05), m], 6.6, pelle);
  else {
    tubo(ctx, arco(spalla, g, m), 6.6, pelle);
    if (!A.strega) manica(ctx, spalla, g, A.vestito);
  }
  const dir = Math.atan2(m[1] - g[1], m[0] - g[0]);
  let punta = null;
  if (o.oggetto) {
    const og = o.oggetto;
    const ang = og.ang !== undefined ? og.ang - (o.incl || 0) : dir + og.rel;
    punta = og.tipo === 'bastone' ? bastone(ctx, m[0], m[1], ang, LUNG_BASTONE) : bacchetta(ctx, m[0], m[1], ang, LUNG_BACCHETTA);
  }
  mano(ctx, m[0], m[1], 6.4, dir, b.aperta, pelle, b.dita === undefined ? undefined : b.dita - (o.incl || 0));
  return punta;
}

/** Tracolla e borsetta tonda, che dondola un po' in ritardo (di lato). */
function borsaLato(ctx, P) {
  const c = [12 + P.borsa[0], -22 + P.borsa[1]];
  tubo(ctx, [[2, -99], [8, -62], [c[0] - 1, c[1] - 11]], 2.4, C.salmoneScuro, 1.5);
  borsetta(ctx, c[0], c[1], 13);
}
function borsaFronte(ctx, P, retro) {
  const s = retro ? -1 : 1;
  const c = [s * 31 + P.borsa[0], -20 + P.borsa[1]];
  tubo(ctx, [[-s * 16, -99], [s * 4, -68], [c[0] - s * 4, c[1] - 11]], 2.4, C.salmoneScuro, 1.5);
  borsetta(ctx, c[0], c[1], 12.5);
}

/* ---------------- scarpe ---------------- */

/** Scarpa tonda e grossa (o stivaletto viola) di lato: origine nella caviglia. */
function scarpaLato(ctx, A, pd, lontano) {
  ctx.save();
  ctx.translate(pd.x, pd.y);
  ctx.rotate(pd.rot);
  const base = A.strega ? C.viola : C.bianco;
  const col = lontano ? scurisci(base, 0.06) : base;
  const p = new Path2D();
  p.moveTo(-11, 11);
  p.bezierCurveTo(-14, 0, -10, -8, -2, -8);        // tallone
  p.lineTo(5, -7);                                 // bocca della scarpa
  p.bezierCurveTo(12, -7, 15, -12, 23, -12);       // collo del piede
  p.bezierCurveTo(35, -12, 39, 7, 31, 15);         // punta tonda
  p.lineTo(-6, 15);
  p.quadraticCurveTo(-11, 15, -11, 11);
  p.closePath();
  pezzo(ctx, p, col, 0.8);
  tratto(ctx, [[-9, 10.5], [33, 10.5]], 1.1, INK2);  // la suola
  if (A.strega) {                                  // risvolto arricciato a punte
    pezzo(ctx, Forme.poligono([[-11, -3], [-19, -17], [-8, -11], [-1, -23], [5, -11], [16, -17], [10, -2]], true), col, 0.5, 1.8);
  } else {                                         // cinturino col bottoncino
    tratto(ctx, [[0, -7.5], [6, -2.5], [10, 0.5]], 1.6);
    pezzo(ctx, Forme.cerchio(10.5, 1, 2), col, 0, 1.2);
  }
  ctx.restore();
}

function scarpaFronte(ctx, A, pd, retro) {
  ctx.save();
  ctx.translate(pd.x, pd.y);
  ctx.scale(pd.s || 1, pd.s || 1);
  const al = pd.alza || 0;
  const col = A.strega ? C.viola : C.bianco;
  pezzo(ctx, Forme.ellisse(0, 4 - al * 2, 17, 12 - al * 3), col, 0.8);
  tratto(ctx, [[-14, 11 - al * 3], [14, 11 - al * 3]], 1.1, INK2);
  if (A.strega) pezzo(ctx, Forme.poligono([[-11, -3], [-19, -14], [-7, -9], [0, -18], [7, -9], [19, -14], [11, -3]], true), col, 0.5, 1.8);
  else if (!retro) {
    tratto(ctx, [[-10, -4], [0, -1.5], [10, -4]], 1.5);
    pezzo(ctx, Forme.cerchio(9, -3, 1.9), col, 0, 1.1);
  }
  ctx.restore();
}

/* ======================= BISCOTTO ======================= */

/** Piedino tondo con le dita (di lato). */

/* ---------------- testa ---------------- */

function sottoLaTesa(ctx, P) {
  const m = new DOMMatrix().translate(0, -62).rotate(P.cappello * GRADI).translate(0, 62);
  const r = new Path2D();
  r.rect(-300, -86, 600, 400);
  const p = new Path2D();
  p.addPath(r, m);
  ctx.clip(p);
}

/**
 * Occhio come nel cartone: ovale bianco alto, linea sottile, puntino scuro
 * spostato verso dove guarda. g = [gx, gy] (-1..1). stato: 'aperti',
 * 'chiusi' (sbatte), 'felici' (ad arco), 'socchiusi' (ascolta), 'strizzati'.
 * dir = 1 o -1: verso della punta per gli occhi strizzati.
 */

function conTesta(ctx, H, disegna) {
  const prima = SC;
  ctx.save();
  ctx.transform(H.a, H.b, H.c, H.d, H.e, H.f);
  SC = prima / SCALA_CORPO;
  try { disegna(); } finally { SC = prima; ctx.restore(); }
}

/** Ruota il cappello attorno al centro della testa (pose in cui scivola). */

function visoFronte() {
  const p = new Path2D();
  p.moveTo(-56, -114);
  p.bezierCurveTo(-72, -86, -76, -40, -62, -20);   // tempia → guancia piena
  p.bezierCurveTo(-50, -2, -24, 4, 0, 4);          // mento largo e morbido
  p.bezierCurveTo(24, 4, 50, -2, 62, -20);
  p.bezierCurveTo(76, -40, 72, -86, 56, -114);
  p.closePath();
  return p;
}

/** Testa di fronte (o la nuca, se retro). */

function corpoCane(L) {
  const b = new Path2D();
  b.moveTo(30 * L, -26);                                          // garrese
  b.bezierCurveTo(6 * L, -31, -30 * L, -30, -50 * L, -24);        // dorso dritto e continuo
  b.bezierCurveTo(-65 * L, -20, -69 * L, 8, -56 * L, 21);         // groppa tonda
  b.bezierCurveTo(-48 * L, 28, -32 * L, 26, -24 * L, 18);         // sotto la coscia
  b.bezierCurveTo(-12 * L, 12, 4 * L, 14, 14 * L, 22);            // la pancia rientra
  b.bezierCurveTo(24 * L, 35, 46 * L, 36, 55 * L, 17);            // petto profondo
  b.bezierCurveTo(60 * L, 2, 58 * L, -12, 50 * L, -18);           // petto davanti
  b.closePath();
  return b;
}

/** Il collo: dalla schiena e dal petto sale fino alla nuca e alla gola. */

function colloCane(L, tb) {
  const c = new Path2D();
  c.moveTo(20 * L, -24);
  c.quadraticCurveTo(tb[0] - 30, tb[1] + 16, tb[0] - 20, tb[1] + 2);   // nuca
  c.lineTo(tb[0] + 8, tb[1] + 22);                                    // gola sotto la mascella
  c.quadraticCurveTo(tb[0] + 4, tb[1] + 46, 56 * L, -6);              // gola → petto
  c.closePath();
  return c;
}

/** Biscotto di lato (guarda a destra). */

function sistemaCappello(ctx, P) {
  ctx.translate(0, -62);
  ctx.rotate(P.cappello);
  ctx.translate(0, 62);
}

/** Col cappello da strega nasconde la parte di testa che starebbe sopra la tesa. */

function testaLato(ctx, A, P) {
  const [hx, hy] = P.capelli;
  ctx.save();
  if (A.strega) sottoLaTesa(ctx, P);
  // caschetto dietro (sta dietro alla testa)
  const dietro = new Path2D();
  dietro.moveTo(8, -96);
  dietro.quadraticCurveTo(4, -66, -6, -58);       // sopra l'orecchio i capelli arrivano alla ciocca
  dietro.quadraticCurveTo(-20, -52, -18, -40);    // dietro l'orecchio
  dietro.quadraticCurveTo(-14, -30, 4, -30);       // sotto l'orecchio torna fino alla ciocca
  dietro.quadraticCurveTo(6, -18, 4 + hx * 0.5, -8 + hy);
  dietro.lineTo(-6 + hx * 0.7, -3 + hy);
  dietro.lineTo(-14 + hx * 0.8, -8 + hy);
  dietro.lineTo(-24 + hx, -2 + hy);
  dietro.lineTo(-32 + hx, -7 + hy);
  dietro.lineTo(-44 + hx, -1 + hy);
  dietro.lineTo(-54 + hx, -6 + hy);
  dietro.lineTo(-66 + hx, 1 + hy);
  dietro.lineTo(-86 + hx, 5 + hy);               // la punta che scatta all'indietro
  dietro.lineTo(-76 + hx, -10 + hy);
  dietro.quadraticCurveTo(-76, -50, -66, -96);   // la nuca, gonfia
  dietro.quadraticCurveTo(-30, -112, 8, -96);
  dietro.closePath();
  // la testa: cranio tondo + guancia piena + nasino
  pezzo(ctx, [Forme.cerchio(-6, -62, 56), Forme.ellisse(24, -36, 45, 38), Forme.ellisse(69, -44, 4.6, 4.3)], C.pelle, 0);
  pezzo(ctx, dietro, C.capelli, 1.4);
  tratto(ctx, [[-42, -84], [-48, -44], [-52 + hx * 0.6, -18 + hy]], 1.1, INK2);
  // l'orecchio
  pezzo(ctx, Forme.ellisse(-8, -46, 7.5, 10.5), C.pelle, 0, 1.6);
  tratto(ctx, [[-5, -51], [-10, -46], [-5, -41]], 1.2, INK2);
  // la ciocca davanti all'orecchio
  const ciocca = new Path2D();
  ciocca.moveTo(2, -90);
  ciocca.lineTo(17, -90);
  ciocca.quadraticCurveTo(20, -52, 17 + hx * 0.4, -12 + hy * 0.7);
  ciocca.lineTo(22 + hx * 0.4, -4 + hy * 0.7);
  ciocca.lineTo(12 + hx * 0.4, -8 + hy * 0.7);
  ciocca.lineTo(7 + hx * 0.4, -3 + hy * 0.7);
  ciocca.lineTo(2 + hx * 0.4, -8 + hy * 0.7);
  ciocca.quadraticCurveTo(-1, -52, 2, -90);
  ciocca.closePath();
  pezzo(ctx, ciocca, C.capelli, 0.8);
  // occhio ovale alto, a metà del viso
  occhio(ctx, 47, -54, 9, 16, P.sguardo, P.occhi, 1);
  boccaLato(ctx, P.bocca);
  ctx.restore();
  ctx.save();
  sistemaCappello(ctx, P);
  if (A.strega) cappelloStregaLato(ctx); else clocheLato(ctx);
  ctx.restore();
}

/** La bocca di profilo: piccola, in basso sul viso. */

/** Vestitino ad A di lato (azzurro, o viola per la streghetta), con l'orlo mobile. */

/** Col cappello da strega nasconde la parte di testa che starebbe sopra la tesa. */

function boccaLato(ctx, tipo) {
  if (tipo === 'chiusa') tratto(ctx, [[59, -21], [62.5, -22.5], [65, -21.5]], 1.6);
  else if (tipo === 'sorriso') tratto(ctx, [[56, -25], [61, -19.5], [66, -24]], 1.7);
  else if (tipo === 'o') {
    const p = Forme.ellisse(64, -22, 3.4, 4.2);
    tinta(ctx, p, C.bocca);
    linea(ctx, p, { spessore: px(1.5) });
  } else {
    const p = new Path2D();
    p.moveTo(56, -29);
    p.quadraticCurveTo(63, -31, 69, -27);
    p.quadraticCurveTo(69, -14, 62, -13);
    p.quadraticCurveTo(56, -15, 56, -29);
    p.closePath();
    tinta(ctx, p, C.boccaDentro);
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.ellisse(63, -13, 6.5, 4.2), C.lingua);
    ctx.restore();
    linea(ctx, p, { spessore: px(1.6) });
  }
}

/**
 * Il caschetto visto di fronte (dietro al viso) o da dietro: scende fino
 * alla mandibola e si apre a campana oltre il viso, con le punte tagliate dritte.
 */

/** Testa di fronte (o la nuca, se retro). */

function caschettoFronte(hx, hy, retro) {
  const p = new Path2D();
  const alto = retro ? -108 : -96;
  p.moveTo(-62, alto);
  p.quadraticCurveTo(-78, -62, -80 + hx, -18 + hy);
  p.lineTo(-92 + hx, -1 + hy);                   // punta che scatta in fuori
  p.lineTo(-80 + hx, -7 + hy);
  p.lineTo(-76 + hx, 3 + hy);
  p.lineTo(-66 + hx, -5 + hy);
  p.lineTo(-61 + hx, 3 + hy);
  p.lineTo(-51 + hx, -4 + hy);
  p.lineTo(-46 + hx, 2 + hy);
  if (retro) {
    for (const x of [-32, -16, 0, 16, 32]) { p.lineTo(x - 7 + hx, -4 + hy); p.lineTo(x + hx, 2 + hy); }
  }
  p.lineTo(46 + hx, 2 + hy);
  p.lineTo(51 + hx, -4 + hy);
  p.lineTo(61 + hx, 3 + hy);
  p.lineTo(66 + hx, -5 + hy);
  p.lineTo(76 + hx, 3 + hy);
  p.lineTo(80 + hx, -7 + hy);
  p.lineTo(92 + hx, -1 + hy);
  p.lineTo(80 + hx, -18 + hy);
  p.quadraticCurveTo(78, -62, 62, alto);
  p.quadraticCurveTo(0, alto - 26, -62, alto);
  p.closePath();
  return p;
}

/** Il viso "mochi" visto di fronte: largo e morbido, più ampio sulle guance. */

function testaFronte(ctx, A, P, retro) {
  const [hx, hy] = P.capelli;
  ctx.save();
  if (A.strega) sottoLaTesa(ctx, P);
  pezzo(ctx, caschettoFronte(hx, hy, retro), C.capelli, 1.4);
  if (retro) {
    for (const s of [-1, 1]) tratto(ctx, [[s * 26, -90], [s * 32, -50], [s * 36 + hx, -18 + hy]], 1.1, INK2);
  } else {
    for (const s of [-1, 1]) tratto(ctx, [[s * 74, -54], [s * 82 + hx * 0.6, -16 + hy]], 1.1, INK2);
    pezzo(ctx, visoFronte(), C.pelle, 0);
    // frangetta dritta: solo una striscia sotto la tesa
    if (!A.strega) {
      const fr = Forme.poligono([[-48, -104], [48, -104], [48, -74], [-48, -74]]);
      pezzo(ctx, fr, C.capelli, 0, 1.6);
      for (const x of [-30, -15, 0, 15, 30]) tratto(ctx, [[x, -74], [x, -79]], 1.1, INK2);
    }
    // occhi ovali alti, a metà del viso; nessun naso di fronte
    occhio(ctx, -24, -54, 12, 16.5, P.sguardo, P.occhi, 1);
    occhio(ctx, 24, -54, 12, 16.5, P.sguardo, P.occhi, -1);
    boccaFronte(ctx, P.bocca);
  }
  ctx.restore();
  ctx.save();
  sistemaCappello(ctx, P);
  if (A.strega) cappelloStregaFronte(ctx, retro); else clocheFronte(ctx);
  ctx.restore();
}

/** La bocca di fronte: piccola e bassa (a circa 3/4 del viso). */

/** Cappellino a campana di lato: cupola alta, fascia larga, tesa che scende. */

function boccaFronte(ctx, tipo) {
  const y = -22;
  if (tipo === 'chiusa') tratto(ctx, [[-4.5, y + 0.8], [0, y - 0.9], [4.5, y + 0.8]], 1.6);
  else if (tipo === 'sorriso') tratto(ctx, [[-9, y - 3], [0, y + 3.5], [9, y - 3]], 1.7);
  else if (tipo === 'o') {
    const p = Forme.ellisse(0, y, 4, 4.8);
    tinta(ctx, p, C.bocca);
    linea(ctx, p, { spessore: px(1.5) });
  } else {
    const p = Forme.ellisse(0, y + 1, 7.5, 8.5);
    tinta(ctx, p, C.boccaDentro);
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.ellisse(0, y + 8, 6, 4), C.lingua);
    ctx.restore();
    linea(ctx, p, { spessore: px(1.6) });
  }
}

/** Cappellino a campana di lato: cupola alta, fascia larga, tesa che scende davanti e dietro. */

/* ---------------- cappelli ---------------- */

function clocheLato(ctx) {
  const cupola = new Path2D();
  cupola.moveTo(-64, -90);
  cupola.bezierCurveTo(-72, -140, -38, -160, -4, -160);
  cupola.bezierCurveTo(32, -160, 66, -140, 58, -94);
  cupola.quadraticCurveTo(0, -80, -64, -90);
  cupola.closePath();
  pezzo(ctx, cupola, C.bianco, 1.5);
  ctx.save();
  ctx.clip(cupola);
  const fascia = new Path2D();
  fascia.moveTo(-90, -84);
  fascia.quadraticCurveTo(0, -72, 90, -94);
  fascia.lineTo(90, -122);
  fascia.quadraticCurveTo(0, -100, -90, -112);
  fascia.closePath();
  tinta(ctx, fascia, C.salmone);
  ombraCel(ctx, fascia, 1.5, tono(C.salmone));
  linea(ctx, (q) => { q.moveTo(-90, -112); q.quadraticCurveTo(0, -100, 90, -122); }, { spessore: px(1.6), colore: INK });
  ctx.restore();
  const tesa = new Path2D();
  tesa.moveTo(-64, -90);
  tesa.lineTo(-86, -60);
  tesa.quadraticCurveTo(0, -92, 88, -68);
  tesa.lineTo(58, -94);
  tesa.quadraticCurveTo(0, -80, -64, -90);
  tesa.closePath();
  pezzo(ctx, tesa, C.bianco, 0.8);
}

/** Cappellino a campana di fronte: la tesa scende ai lati intorno al viso. */

/** Cappello da strega di lato: tesa larghissima, cono con la punta piegata indietro. */

function clocheFronte(ctx) {
  const cupola = new Path2D();
  cupola.moveTo(-66, -92);
  cupola.bezierCurveTo(-74, -140, -40, -160, 0, -160);
  cupola.bezierCurveTo(40, -160, 74, -140, 66, -92);
  cupola.quadraticCurveTo(0, -106, -66, -92);
  cupola.closePath();
  pezzo(ctx, cupola, C.bianco, 1.5);
  ctx.save();
  ctx.clip(cupola);
  const fascia = new Path2D();
  fascia.moveTo(-90, -88);
  fascia.quadraticCurveTo(0, -110, 90, -88);
  fascia.lineTo(90, -112);
  fascia.quadraticCurveTo(0, -134, -90, -112);
  fascia.closePath();
  tinta(ctx, fascia, C.salmone);
  ombraCel(ctx, fascia, 1.5, tono(C.salmone));
  linea(ctx, (q) => { q.moveTo(-90, -112); q.quadraticCurveTo(0, -134, 90, -112); }, { spessore: px(1.6), colore: INK });
  ctx.restore();
  const tesa = new Path2D();
  tesa.moveTo(-66, -92);
  tesa.lineTo(-82, -58);
  tesa.quadraticCurveTo(0, -102, 82, -58);
  tesa.lineTo(66, -92);
  tesa.quadraticCurveTo(0, -106, -66, -92);
  tesa.closePath();
  pezzo(ctx, tesa, C.bianco, 0.8);
}

/** Cappello da strega di lato: tesa larghissima, cono con la punta piegata indietro. */

function cappelloStregaLato(ctx) {
  pezzo(ctx, Forme.ellisse(6, -84, 94, 10, -0.02), C.viola, 0.7);
  const cono = new Path2D();
  cono.moveTo(-46, -86);
  cono.quadraticCurveTo(-33, -124, -36, -146);
  cono.quadraticCurveTo(-40, -166, -74, -180);   // punta morbida piegata all'indietro
  cono.quadraticCurveTo(-36, -180, -16, -158);
  cono.quadraticCurveTo(16, -128, 50, -88);
  cono.quadraticCurveTo(0, -78, -46, -86);
  cono.closePath();
  pezzo(ctx, cono, C.viola, 1.4);
  tratto(ctx, [[-36, -146], [-26, -152], [-17, -159]], 1.3, INK2);
}

/** Cappello da strega di fronte (o da dietro, con la punta piegata dall'altra parte). */

/** Cappello da strega di fronte (o da dietro, con la punta piegata dall'altra parte). */

function cappelloStregaFronte(ctx, retro) {
  pezzo(ctx, Forme.ellisse(0, -84, 104, retro ? 18 : 13), C.viola, 0.7);
  ctx.save();
  if (retro) ctx.scale(-1, 1);
  const cono = new Path2D();
  cono.moveTo(-46, -88);
  cono.quadraticCurveTo(-36, -128, -12, -152);
  cono.quadraticCurveTo(4, -174, 42, -182);       // la punta si piega di lato
  cono.quadraticCurveTo(20, -166, 24, -150);
  cono.quadraticCurveTo(36, -120, 46, -88);
  cono.quadraticCurveTo(0, -80, -46, -88);
  cono.closePath();
  pezzo(ctx, cono, C.viola, retro ? 0 : 1.4);
  tratto(ctx, [[-14, -150], [4, -155], [24, -150]], 1.3, INK2);
  ctx.restore();
}

/** Effetti di contorno: colpetto del bastone, scintille, botta in testa. */

/** Scarpa vista di fronte o da dietro; alza 0..1 = tallone sollevato. */

/* ---------------- Lia intera ---------------- */

function effetto(ctx, tipo, punta, H) {
  if (tipo === 'tac' && punta) {
    for (const a of [-2.7, -1.57, -0.45]) {
      tratto(ctx, [[punta[0] + Math.cos(a) * 8, punta[1] + Math.sin(a) * 8], [punta[0] + Math.cos(a) * 17, punta[1] + Math.sin(a) * 17]], 1.8);
    }
  }
  if (tipo === 'scia' && punta) {
    tratto(ctx, [[punta[0] - 26, punta[1] + 30], [punta[0] - 14, punta[1] + 12], [punta[0] - 4, punta[1] + 4]], 1.4, INK2, 0.8);
  }
  if (tipo === 'magia' && punta) {
    scintilla(ctx, punta[0] + 16, punta[1] + 20, 8);
    scintilla(ctx, punta[0] - 6, punta[1] + 32, 6);
    scintilla(ctx, punta[0] + 26, punta[1] - 6, 5);
    scintilla(ctx, punta[0] + 4, punta[1] + 52, 7);
    for (const [dx, dy] of [[-14, 10], [12, 40], [30, 18]]) tinta(ctx, Forme.cerchio(punta[0] + dx, punta[1] + dy, 2), '#f3d36b');
  }
  if (tipo === 'magiaPiccola' && punta) {
    scintilla(ctx, punta[0] + 14, punta[1] + 6, 5);
    scintilla(ctx, punta[0] - 8, punta[1] + 18, 4);
  }
  if (tipo === 'botta') {
    const q = H.transformPoint(new DOMPoint(92, -88));
    for (const a of [-0.9, -0.2, 0.5]) tratto(ctx, [[q.x + Math.cos(a) * 6, q.y + Math.sin(a) * 6], [q.x + Math.cos(a) * 16, q.y + Math.sin(a) * 16]], 1.8);
    scintilla(ctx, q.x - 4, q.y - 16, 5);
  }
}

/** Lia di lato (guarda a destra). Restituisce la posizione della mano vicina. */

function liaLato(ctx, A, P, manoVicina) {
  return inScala(ctx, SCALA_CORPO, () => {
    const T = new DOMMatrix().translate(P.x, ANCA + P.bob).rotate(P.incl * GRADI).scale(1 + P.sq * 0.6, 1 - P.sq);
    const inv = T.inverse();
    const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
    const inBusto = (q) => { const r = inv.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
    const H = T.translate(COLLO[0] + P.testaDx, COLLO[1] + P.testaDy).rotate(P.testa * GRADI).scale(1 / SCALA_CORPO);
    const B = P.braccia.map((b) => (b.mondo ? Object.assign({}, b, { m: inBusto(b.m), g: b.g ? inBusto(b.g) : null }) : b));
    if (P.manoTesta) { const q = H.transformPoint(new DOMPoint(...P.manoTesta)); B[1] = Object.assign({}, B[1], { m: inBusto([q.x, q.y]), g: null }); }
    if (manoVicina) B[1] = { m: inBusto([manoVicina[0] / SCALA_CORPO, manoVicina[1] / SCALA_CORPO]) };
    const nelBusto = (fn) => { ctx.save(); ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f); const r = fn(); ctx.restore(); return r; };
    const opz = (i, extra) => Object.assign({ lontano: i === 0, oggetto: P.oggetto && P.oggetto.mano === i ? P.oggetto : null, incl: P.incl }, extra);
    const alzato = B[1].m[1] < -96;
    let punta = null;
    const segna = (p) => { if (p) punta = inMondo(p); };

    // 1) il braccio lontano, dietro a tutto
    nelBusto(() => segna(braccioLia(ctx, A, SPALLE_LATO[0], B[0], opz(0))));
    // 2) gambe e scarpe (prima la lontana)
    const ginocchia = [];
    for (const i of [0, 1]) {
      const anca = inMondo(ANCHE_LATO[i]), pd = P.piedi[i], cav = [pd.x, pd.y];
      const g = ginocchio(anca, cav, COSCIA, 1);
      ginocchia.push(g);
      tubo(ctx, arco(anca, g, cav), 8, i === 0 ? C.pelleLontana : C.pelle);
      scarpaLato(ctx, A, pd, i === 0);
    }
    // 3) il busto: mutandine, vestito, borsetta, braccio vicino, colletto o mantellina
    const orloAcc = P.accucciata ? [piu(ginocchia[1], [14, 8]), [P.x - 26, -4]] : P.orloMondo;
    nelBusto(() => {
      if (A.strega && !P.accucciata) mutandineLato(ctx);
      vestitoLato(ctx, A, P, P.accucciata ? inBusto(ginocchia[1]) : null, orloAcc && orloAcc.map(inBusto));
      if (A.borsa) borsaLato(ctx, P);
      if (!alzato) segna(braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1)));
      if (A.strega) {
        mantellinaLato(ctx);
        if (!alzato) braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1, { soloAvambraccio: true }));
      } else collettoLato(ctx);
    });
    // 4) la testa (di profilo, oppure girata verso di noi)
    conTesta(ctx, H, () => { if (P.frontale) testaFronte(ctx, A, P, false); else testaLato(ctx, A, P); });
    // 5) il braccio alzato passa davanti al viso
    if (alzato) nelBusto(() => segna(braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1))));
    // 6) effetti
    if (P.effetto) effetto(ctx, P.effetto, punta, H);
    const m = inMondo(B[1].m);
    return [m[0] * SCALA_CORPO, m[1] * SCALA_CORPO];
  });
}

/** Lia di fronte (retro = vista da dietro). */

function liaFronte(ctx, A, P, retro) {
  inScala(ctx, SCALA_CORPO, () => {
    const T = new DOMMatrix().translate(P.x, ANCA + P.bob).rotate(P.incl * GRADI).scale(1 + P.sq * 0.6, 1 - P.sq);
    const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
    const nelBusto = (fn) => { ctx.save(); ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f); fn(); ctx.restore(); };
    const alzato = (i) => P.braccia[i].m[1] < -96;
    const braccio = (i, extra) => braccioLia(ctx, A, SPALLE_FRONTE[i], P.braccia[i],
      Object.assign({ lato: i ? 1 : -1, oggetto: P.oggetto && P.oggetto.mano === i ? P.oggetto : null, incl: P.incl }, extra));
    // gambe e scarpe
    for (const i of [0, 1]) {
      const anca = inMondo(ANCHE_FRONTE[i]), pd = P.piedi[i], cav = [pd.x, pd.y];
      const g = ginocchio(anca, cav, COSCIA, i ? 1 : -1);
      tubo(ctx, arco(anca, lerp2(g, lerp2(anca, cav, 0.5), 0.6), cav), 8, C.pelle);
      scarpaFronte(ctx, A, pd, retro);
    }
    nelBusto(() => {
      if (A.strega) mutandineFronte(ctx);
      if (A.borsa && retro) borsaFronte(ctx, P, retro);
      vestitoFronte(ctx, A, P);
      for (const i of [0, 1]) if (!alzato(i)) braccio(i);
      if (A.strega) {
        mantellinaFronte(ctx, retro);
        for (const i of [0, 1]) if (!alzato(i)) braccio(i, { soloAvambraccio: true });
      } else collettoFronte(ctx, retro);
      if (A.borsa && !retro) borsaFronte(ctx, P, retro);
    });
    const H = T.translate(P.testaDx, COLLO[1] + P.testaDy).rotate(P.testa * GRADI).scale(1 / SCALA_CORPO);
    conTesta(ctx, H, () => testaFronte(ctx, A, P, retro));
    nelBusto(() => { for (const i of [0, 1]) if (alzato(i)) braccio(i); });
  });
}

/**
 * Disegna Lia.
 *   abito: 'borsa' | 'semplice' | 'strega'
 *   vista: 'lato' | 'fronte' | 'retro'
 *   posa:  'fermo', 'cammina', 'corre', 'tocca', 'ascolta', 'china', ...
 *   fase:  0..1 lungo il ciclo della posa
 *   manoVicina (facoltativa): dove mettere la mano vicina (illustrazioni)
 * Restituisce la posizione della mano vicina (utile per il guinzaglio).
 */
function disegnaLia(ctx, abito, vista, posa, fase, manoVicina) {
  const A = ABITI[abito];
  if (vista === 'lato') return liaLato(ctx, A, posaLato(A, posa, fase), manoVicina);
  liaFronte(ctx, A, posaFronte(A, posa, fase, vista === 'retro'), vista === 'retro');
  return null;
}

/* ------------------------------------------------------------------------ */
/*  BISCOTTO, IL CAGNOLINO                                                   */
/* ------------------------------------------------------------------------ */
/*  Un cagnolino elegante dal pelo crema: muso lungo e gentile, nasone
 *  scuro, occhio ovale "dentro" la testa, orecchie grandi color caramello,
 *  una macchia caramello sul dorso e la coda a pennacchio piumato.
 *  Misure in pixel della cella (alto ~170 px fino alla testa).            */

/** Un piede in un ciclo di passi a quattro zampe: [dx, altezza]. */
function zampaCiclo(u, A, S, alza) {
  const w = giro(u);
  if (w < S) return [A - (2 * A * w) / S, 0];
  const v = (w - S) / (1 - S);
  return [-A + 2 * A * morbido(v), -alza * Math.sin(Math.PI * v)];
}

function zampetta(ctx, x, y, r, colore) {
  pezzo(ctx, Forme.ellisse(x + r * 0.45, y - r * 0.6, r, r * 0.62), colore, 0, 1.7);
  for (const d of [0.6, 1.0]) tratto(ctx, [[x + r * d, y - r * 0.55], [x + r * d, y - 1.5]], 1.1);
}

/** Zampa del cane: anca → giuntura → caviglia, affusolata, col piedino. */

/** Zampa anteriore: dritta e snella, col piedino tondo. */
function zampaCane(ctx, anca, piede, posteriore, colore) {
  const cav = [piede[0] + 2, piede[1] - 7];
  if (posteriore) {                                  // posteriore: grassella avanti, garretto indietro
    const garretto = [cav[0] - 9, cav[1] - 17];
    const g = ginocchio(anca, garretto, 21, 1);
    arto(ctx, anca, g, garretto, 25, 13, 10.5, colore);
    arto(ctx, garretto, lerp2(garretto, cav, 0.5), cav, 10.5, 10, 10, colore, 0.4);
  } else arto(ctx, anca, lerp2(anca, cav, 0.5), cav, 17, 12, 10.5, colore);
  zampetta(ctx, piede[0], piede[1], 11, colore);
}

/**
 * Coda a pennacchio: uno stelo sottile sopra e, sotto, sei ciuffi lunghi e
 * appuntiti che seguono la curva (ognuno con la sua ciocca disegnata).
 * ang = direzione iniziale, curva = quanto gira in tutto.
 */

// anche delle quattro zampe nel sistema del corpo (p = posteriore, a = anteriore,
// l = lontana, v = vicina) e piedi a riposo nel mondo (col corpo in x = -8)

/**
 * Coda a pennacchio: lo stelo sottile sopra, sotto le frange lunghe e
 * appuntite che seguono la curva (e qualche ciocca disegnata dentro).
 * ang = direzione iniziale, curva = quanto gira in tutto.
 */

function codaPiumosa(ctx, x, y, ang, lung, curva, colore) {
  const N = 6, S = [];
  let cx = x, cy = y, a = ang;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    S.push({ x: cx, y: cy, nx: -Math.sin(a), ny: Math.cos(a), dx: Math.cos(a), dy: Math.sin(a), w: 5 + 19 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.08)), 0.7), t });
    cx += (Math.cos(a) * lung) / N;
    cy += (Math.sin(a) * lung) / N;
    a += curva / N;
  }
  const su = (s, k) => [s.x + s.nx * k, s.y + s.ny * k];
  const giu = (s, k, avanti) => [s.x - s.nx * k + s.dx * avanti, s.y - s.ny * k + s.dy * avanti];
  const p = new Path2D();
  p.moveTo(...su(S[0], 4));
  for (let i = 1; i <= N; i++) {
    const r = su(S[i - 1], 4 + 4 * Math.sin(Math.PI * S[i - 1].t)), q = su(S[i], 4 + 4 * Math.sin(Math.PI * S[i].t));
    p.quadraticCurveTo(r[0], r[1], (q[0] + r[0]) / 2, (q[1] + r[1]) / 2);
  }
  const fine = S[N];
  p.quadraticCurveTo(...su(fine, 3), fine.x + fine.dx * 14, fine.y + fine.dy * 14);   // la punta
  const ciuffi = [];
  for (let i = N; i >= 1; i--) {                     // i ciuffi, dalla punta verso la base
    const ciuffo = giu(S[i], S[i].w * 1.25, 12);
    const rientro = giu(S[i - 1], S[i - 1].w * 0.62, 2);
    p.quadraticCurveTo(...giu(S[i], S[i].w * 0.9, 2), ...ciuffo);
    p.quadraticCurveTo(...giu(S[i - 1], S[i - 1].w * 0.95, 6), ...rientro);
    ciuffi.push([giu(S[i - 1], S[i - 1].w * 0.4, 2), giu(S[i], S[i].w * 0.85, 9)]);
  }
  p.lineTo(...giu(S[0], 4, 0));
  p.closePath();
  pezzo(ctx, p, colore, 0.6);
  for (const [a0, a1] of ciuffi) tratto(ctx, [a0, a1], 1.1, INK2);
}

/** Orecchio a foglia lunga, attaccato in alto dietro al cranio: pende oltre la mascella. */

/** Orecchio lungo e morbido (attaccato in alto, pende in basso). */

function orecchioCane(ctx, x, y, ang, lato = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const pp = [[-7, -7], [9, -8], [16, 8], [15, 34], [8, 56], [-1, 64], [-10, 54], [-14, 28], [-13, 6]];
  pezzo(ctx, Forme.poligono(pp.map(([a, b]) => [a * lato, b]), true), C.orecchie, 1.1);
  tratto(ctx, [[1 * lato, 2], [3 * lato, 28], [0, 50]], 1.1, INK2);
  ctx.restore();
}

// anche delle quattro zampe nel sistema del corpo (p = posteriore, a = anteriore,
// l = lontana, v = vicina) e piedi a riposo nel mondo (col corpo in x = -8)

// anche delle quattro zampe nel sistema del corpo (p = posteriore, a = anteriore,
// l = lontana, v = vicina) e piedi a riposo nel mondo (col corpo in x = -10)

const ANCHE_CANE = { pl: [-40, 8], al: [34, 12], pv: [-34, 10], av: [40, 14] };
const PIEDI_CANE = { pl: [-56, 0], al: [24, 0], pv: [-46, 0], av: [34, 0] };

/** Lo scheletro del cane di lato per una posa e una fase t (0..1). */

/** Lo scheletro del cane di lato per una posa e una fase t (0..1). */

/** Lo scheletro del cane di lato per una posa e una fase t (0..1). */

function posaCaneLato(posa, t) {
  const P = {
    corpo: [-8, -66], rot: 0, lungo: 1, testa: [80, -60], rotTesta: 0,
    coda: -2.35, curva: 0.55, lungCoda: 78, orecchio: 0.08, bocca: 0, ringhia: false,
    borsa: false, oscBorsa: 0, sguardo: [0.45, -0.6], occhi: 'aperti', piedi: { ...PIEDI_CANE },
  };
  const passi = (off, A, S, alza) => {
    for (const k in off) {
      const [x, y] = zampaCiclo(t + off[k], A, S, alza);
      P.piedi[k] = [(PIEDI_CANE[k][0] + 8) * P.lungo + P.corpo[0] + x, y];
    }
  };
  if (posa === 'fermo') {                         // scodinzola
    P.coda = -2.3 + 0.32 * onda(t);
    P.curva = 0.55 + 0.3 * onda(t - 0.12);
    P.corpo[1] += 0.7 * ondaC(t);
    P.testa[1] += 0.6 * ondaC(t - 0.1);
    P.orecchio = 0.08 + 0.05 * onda(t - 0.2);
    if (Math.abs(t - 0.5) < 0.01) P.occhi = 'chiusi';
  }
  if (posa === 'cammina') {                       // passo laterale a quattro tempi
    passi({ pl: 0, al: 0.25, pv: 0.5, av: 0.75 }, 13, 0.62, 10);
    P.corpo[1] += 1.5 * ondaC(2 * t);
    P.rot = 0.015 * onda(2 * t);
    P.testa[1] += 1.6 * ondaC(2 * (t - 0.12));
    P.rotTesta = 0.04 * onda(2 * (t - 0.12));
    P.orecchio = 0.1 + 0.12 * onda(2 * (t - 0.22));
    P.coda = -2.35 + 0.3 * onda(t);
    P.curva = 0.55 + 0.3 * onda(t - 0.15);
  }
  if (posa === 'borsa' || posa === 'borsa_fermo') {   // con la borsetta in bocca, testa alta
    P.borsa = true;
    P.sguardo = [0.3, -0.85];
    P.testa = [82, -66];
    P.rotTesta = -0.14;
    if (posa === 'borsa') {                       // trotto: zampe in diagonale
      passi({ pl: 0, av: 0, al: 0.5, pv: 0.5 }, 15, 0.5, 13);
      P.corpo[1] += -2 + 2.2 * ondaC(2 * (t - 0.08));
      P.testa[1] += 1.8 * ondaC(2 * (t - 0.18));
      P.orecchio = 0.2 + 0.16 * onda(2 * (t - 0.25));
      P.coda = -2.3 + 0.3 * onda(t);
      P.oscBorsa = 0.22 * onda(2 * (t - 0.2));
    } else {
      P.coda = -2.3 + 0.32 * (t < 0.25 ? 1 : -1);
      P.oscBorsa = t < 0.25 ? 0.06 : -0.06;
      P.orecchio = t < 0.25 ? 0.1 : 0.2;
    }
  }
  if (posa === 'corre') {                         // galoppo: orecchie e coda all'indietro
    P.lungo = 1 + 0.08 * ondaC(t - 0.4);
    P.rot = -0.09 * ondaC(t - 0.15);
    P.corpo = [-14, -64 - 5 * ondaC(2 * (t - 0.4))];
    passi({ pl: 0, pv: 0.1, al: 0.45, av: 0.55 }, 30, 0.34, 18);
    P.testa = [84, -48];
    P.rotTesta = 0.12 + 0.04 * onda(t - 0.2);
    P.orecchio = 1.25 + 0.3 * onda(t - 0.3);
    P.coda = -2.85 + 0.1 * onda(t);
    P.curva = -0.1;
    P.lungCoda = 74;
    P.bocca = 0.3;
    P.sguardo = [0.85, -0.1];
  }
  if (posa === 'abbaia') {
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-10, -68], testa: [80, -64], rotTesta: k ? -0.3 : -0.2, bocca: k ? 1 : 0.6, coda: k ? -2.05 : -2.35, orecchio: k ? 0.42 : 0.28, sguardo: [0.75, -0.2] });
    P.piedi = { pl: [-60, 0], pv: [-50, 0], al: [26, 0], av: [38, 0] };
  }
  if (posa === 'ringhia') {
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-14 - k * 1.5, -59 + k * 0.6], rot: 0.12, testa: [78, -44], rotTesta: 0.14 - k * 0.02, bocca: 0.22 + k * 0.05, ringhia: true, orecchio: 0.75, coda: -2.85, curva: -0.2, lungCoda: 70, sguardo: [0.9, 0.2] });
    P.piedi = { pl: [-68, 0], pv: [-58, 0], al: [22, 0], av: [36, 0] };
  }
  if (posa === 'annusa') {                        // naso a terra, coda su
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-16, -62], rot: 0.12, testa: [84 + k * 3, 6 - k * 1.5], rotTesta: 0.5 + k * 0.05, orecchio: 0.3, coda: -2.0 + (k ? 0.25 : -0.1), curva: 0.6, sguardo: [0.6, 0.85] });
    P.piedi = { pl: [-62, 0], pv: [-52, 0], al: [18, 0], av: [30, 0] };
  }
  return P;
}

/** Dove sta il collare (per il guinzaglio delle illustrazioni). */

/** Dove sta il collare (per il guinzaglio delle illustrazioni). */

/** Dove sta il collare (per il guinzaglio delle illustrazioni). */

function collareCane(P) {
  const T = new DOMMatrix().translate(P.corpo[0], P.corpo[1]).rotate(P.rot * GRADI);
  const L = P.lungo, base = [40 * L, -16], tb = [P.testa[0] * L, P.testa[1]];
  const q = T.transformPoint(new DOMPoint(lerp(base[0], tb[0], 0.6), lerp(base[1], tb[1], 0.6)));
  return [q.x, q.y];
}

/** Il corpo a "fagiolo": dorso continuo, groppa tonda, pancia che rientra, petto profondo. */

/** Biscotto di lato (guarda a destra). */

/** Biscotto di lato (guarda a destra). */

function caneLato(ctx, P) {
  const T = new DOMMatrix().translate(P.corpo[0], P.corpo[1]).rotate(P.rot * GRADI);
  const L = P.lungo;
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x * L, y)); return [q.x, q.y]; };
  // coda a pennacchio dietro al corpo
  const [cx, cy] = nelMondo(-54, -18);
  codaPiumosa(ctx, cx, cy, P.coda + P.rot, P.lungCoda, P.curva, C.cane);
  // zampe (prima le lontane, un po' più scure)
  for (const k of ['pl', 'al', 'pv', 'av']) {
    const col = k[1] === 'l' ? tono(C.cane) : C.cane;
    zampaCane(ctx, nelMondo(...ANCHE_CANE[k]), P.piedi[k], k[0] === 'p', col);
  }
  // corpo + collo in un'unica sagoma
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const tb = [P.testa[0] * L, P.testa[1]];
  const corpo = corpoCane(L);
  pezzo(ctx, [corpo, colloCane(L, tb)], C.cane, 1);
  ctx.save();
  ctx.clip(corpo);                                 // la macchia caramello sul dorso e sui fianchi
  pezzo(ctx, Forme.ellisse(-24 * L, -21, 21, 10, -0.06), C.orecchie, 0.5, 1.6);
  ctx.restore();
  tratto(ctx, [[-20 * L, 18], [-32 * L, -2], [-48 * L, 2]], 1.3, INK2);   // la coscia
  for (let k = 0; k < 4; k++) tratto(ctx, [[46 * L + k * 2.5, 6 + k * 6], [52 * L + k * 2.5, 12 + k * 6]], 1.1, INK2);  // pelo del petto
  const base = [40 * L, -16], dx = tb[0] - base[0], dy = tb[1] - base[1], d = Math.hypot(dx, dy);
  const cc = [base[0] + dx * 0.6, base[1] + dy * 0.6], n = [-dy / d, dx / d];
  tubo(ctx, [[cc[0] + n[0] * 17, cc[1] + n[1] * 17], [cc[0] + (dx / d) * 3, cc[1] + (dy / d) * 3], [cc[0] - n[0] * 17, cc[1] - n[1] * 17]], 5.5, C.collare, 1.7);
  ctx.restore();
  // testa
  const [tx, ty] = nelMondo(P.testa[0], P.testa[1]);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(P.rot + P.rotTesta);
  testaCaneLato(ctx, P);
  ctx.restore();
}

/**
 * Testa di profilo: cranio a cupola, muso lungo che si assottiglia con uno
 * "stop" appena accennato, nasino scuro ovale in punta, occhio ovale dentro
 * la testa vicino alla fronte, sopracciglio, orecchio lungo a foglia.
 */

/** Testa di profilo: cranio tondo, muso lungo e gentile, nasone, occhio ovale, orecchio. */

/** Biscotto di fronte, seduto. */

function testaCaneLato(ctx, P) {
  const apri = P.bocca, cer = [12, 13];            // cerniera della mandibola
  const ruotaM = (x, y) => {
    const a = apri * 0.5, ddx = x - cer[0], ddy = y - cer[1];
    return [cer[0] + ddx * Math.cos(a) - ddy * Math.sin(a), cer[1] + ddx * Math.sin(a) + ddy * Math.cos(a)];
  };
  if (apri > 0) {                                   // bocca aperta: interno, lingua, mandibola
    pezzo(ctx, Forme.poligono([[10, 9], [58, 6], ruotaM(52, 18), ruotaM(16, 22)]), C.boccaDentro, 0, 1.7);
    ctx.save();
    ctx.translate(...cer);
    ctx.rotate(apri * 0.5);
    ctx.translate(-cer[0], -cer[1]);
    if (!P.ringhia) tinta(ctx, Forme.ellisse(36, 15, 11, 4), C.lingua);
    pezzo(ctx, Forme.ellisse(32, 18, 22, 5.5, -0.04), C.cane, 0);
    ctx.restore();
  }
  const muso = new Path2D();
  muso.moveTo(6, -17);
  muso.quadraticCurveTo(17, -13, 27, -13);          // lo "stop" appena accennato
  muso.quadraticCurveTo(48, -12, 59, -7);           // il dorso del muso, lungo
  muso.quadraticCurveTo(71, -1, 64, 10);            // la punta tonda
  muso.quadraticCurveTo(44, 18, 22, 19);            // la mandibola
  muso.lineTo(4, 14);
  muso.closePath();
  pezzo(ctx, [Forme.ellisse(0, 0, 27, 25), muso], C.cane, 0.6);
  pezzo(ctx, Forme.ellisse(64, -2, 7, 5.5, 0.15), C.naso, 0, 1.5);
  tinta(ctx, Forme.ellisse(62.5, -4, 2.3, 1.3), '#ffffff', 0.7);
  if (!apri) tratto(ctx, [[62, 10], [46, 14.5], [31, 16], [25, 12.5]], 1.5);
  if (P.ringhia) {                                  // denti digrignati e muso arricciato
    pezzo(ctx, Forme.poligono([[22, 12], [54, 9], [54, 15], [23, 19]]), C.bianco, 0, 1.6);
    const zz = [];
    for (let k = 0; k <= 8; k++) zz.push([23 + k * 3.8, k % 2 ? 18 : 11]);
    linea(ctx, spezzata(zz), { spessore: px(1.2) });
    tratto(ctx, [[28, -8], [32, -12], [36, -8]], 1.4);
    tratto(ctx, [[37, -7], [41, -11], [45, -7]], 1.4);
  }
  for (const k of [0, 1, 2]) tratto(ctx, [[-10 + k * 5, -24], [-12 + k * 5, -31]], 1.4);   // ciuffetto
  orecchioCane(ctx, -11, -14, P.orecchio);
  occhio(ctx, 9, -5, 7.5, 10, P.sguardo, P.occhi);
  tratto(ctx, P.ringhia ? [[0, -14], [9, -12], [18, -7]] : [[1, -18], [9, -20.5], [16, -17]], P.ringhia ? 2.3 : 1.3, P.ringhia ? INK : INK2);   // sopracciglio
  if (P.borsa) {                                    // la borsetta tenuta in bocca (dondola)
    ctx.save();
    ctx.translate(42, 16);
    ctx.rotate(P.oscBorsa);
    ctx.translate(-42, -16);
    tubo(ctx, [[38, 18], [20, 64], [52, 60], [52, 20]], 2.4, C.salmoneScuro, 1.5);
    borsetta(ctx, 46, 29, 15);
    ctx.restore();
  }
}

/** Testa di fronte: cranio tondo, muso che viene verso di noi, nasino, occhi con le sopracciglia. */

function caneFronte(ctx, posa, t, extra) {
  const E = Object.assign({
    coda: 0.5 * ondaC(t), bocca: posa === 'abbaia', sguardo: [0.4, -0.6], occhi: 'aperti',
    rotTesta: posa === 'abbaia' ? -0.06 : 0, testa: [0, posa === 'abbaia' ? -136 : -132], codaLato: 1,
  }, extra);
  const lc = E.codaLato;                             // da che parte sta la coda
  codaPiumosa(ctx, 30 * lc, -12, lc > 0 ? -0.3 : Math.PI + 0.3, 82, (-0.9 + E.coda) * lc, C.cane);
  for (const s of [-1, 1]) {                         // cosce posteriori ai lati
    pezzo(ctx, Forme.ellisse(s * 30, -28, 21, 26), tono(C.cane), 0.6);
    pezzo(ctx, Forme.ellisse(s * 40, -6.5, 13, 6.5), tono(C.cane), 0, 1.7);
    for (const dd of [-4, 4]) tratto(ctx, [[s * 40 + dd, -9], [s * 40 + dd, -2]], 1.1);
  }
  pezzo(ctx, Forme.ellisse(0, -64, 30, 40), C.cane, 1);
  for (let k = 0; k < 5; k++) tratto(ctx, [[(k - 2) * 7, -52 + Math.abs(k - 2) * 3], [(k - 2) * 8, -44 + Math.abs(k - 2) * 3]], 1.1, INK2);
  for (const s of [-1, 1]) {                         // zampe davanti affusolate
    arto(ctx, [s * 12, -62], [s * 13, -36], [s * 14, -10], 18, 13.5, 12, C.cane, 0.5);
    pezzo(ctx, Forme.ellisse(s * 14, -6.5, 11.5, 7), C.cane, 0, 1.7);
    for (const dd of [-3.5, 3.5]) tratto(ctx, [[s * 14 + dd, -9], [s * 14 + dd, -2]], 1.1);
  }
  tubo(ctx, [[-24, -100], [0, -91], [24, -100]], 6, C.collare, 1.7);
  ctx.save();
  ctx.translate(...E.testa);
  ctx.rotate(E.rotTesta);
  testaCaneFronte(ctx, E);
  ctx.restore();
}

/** Biscotto visto da dietro mentre cammina via. */

function testaCaneFronte(ctx, E) {
  pezzo(ctx, Forme.ellisse(0, 0, 28, 26), C.cane, 0.7);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 5, -24], [k * 6.5, -31]], 1.4);
  for (const s of [-1, 1]) orecchioCane(ctx, s * 22, -14, s * -0.08, s);
  pezzo(ctx, Forme.ellisse(0, 15, 14.5, 15), C.muso, 0, 1.7);
  if (E.bocca) {
    pezzo(ctx, Forme.ellisse(0, 22, 8, 8), C.boccaDentro, 0, 1.7);
    tinta(ctx, Forme.ellisse(0, 26.5, 5, 3), C.lingua);
  } else tratto(ctx, [[-6, 20], [0, 23], [6, 20]], 1.5);
  pezzo(ctx, Forme.ellisse(0, 9, 7, 5), C.naso, 0, 1.5);
  tinta(ctx, Forme.ellisse(-1.6, 7.6, 2, 1.2), '#ffffff', 0.7);
  for (const s of [-1, 1]) {
    occhio(ctx, s * 11.5, -6, 7.5, 10, E.sguardo, E.occhi);
    tratto(ctx, [[s * 5, -19], [s * 11.5, -21], [s * 18, -18]], 1.3, INK2);
  }
}

function caneRetro(ctx, t) {
  const u = TAU * t, bob = -1.6 * Math.abs(Math.sin(u)), sx = 1.6 * Math.sin(u);
  ctx.save();
  ctx.translate(sx * 0.5, -124 + bob);               // la testa, dietro al corpo
  for (const s of [-1, 1]) orecchioCane(ctx, s * 21, -10, s * (-0.12 - 0.1 * Math.sin(u + s)), s);
  pezzo(ctx, Forme.ellisse(0, 0, 27, 25), C.cane, 0.7);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 5, -23], [k * 6.5, -30]], 1.4);
  ctx.restore();
  tubo(ctx, [[-20 + sx, -100 + bob], [sx, -95 + bob], [20 + sx, -100 + bob]], 6, C.collare, 1.7);
  for (const s of [-1, 1]) {                         // zampe davanti, nascoste in parte
    const su = Math.max(0, s * Math.sin(u + 1.6)) * 6;
    pezzo(ctx, Forme.ellisse(s * 11, -6.5 - su, 9.5, 6), tono(C.cane), 0, 1.7);
  }
  const corpo = Forme.ellisse(sx, -60 + bob, 32, 32);
  pezzo(ctx, corpo, C.cane);
  ctx.save();
  ctx.clip(corpo);
  pezzo(ctx, Forme.ellisse(-3 + sx, -86 + bob, 20, 11), C.orecchie, 0.5, 1.6);
  ctx.restore();
  for (const s of [-1, 1]) {                         // cosce e piedi posteriori
    const alza = Math.max(0, s * Math.sin(u));
    pezzo(ctx, Forme.ellisse(s * 19 + sx, -36 + bob - alza * 4, 17, 24), C.cane);
    pezzo(ctx, Forme.ellisse(s * 20, -7 - alza * 9, 11, 7 - alza * 1.5), C.cane, 0, 1.7);
    if (alza > 0.3) tinta(ctx, Forme.ellisse(s * 20, -7 - alza * 9, 5.5, 3.2), C.rosa);
  }
  const ang = -Math.PI / 2 + 0.8 + 0.3 * Math.sin(u - 0.7);   // la coda ondeggia di lato
  codaPiumosa(ctx, sx + 10, -70 + bob, ang, 60, 0.9, C.cane);
}

function disegnaCane(ctx, vista, posa, fase) {
  if (vista === 'lato') caneLato(ctx, posaCaneLato(posa, fase));
  else if (vista === 'fronte') caneFronte(ctx, posa, fase, posa === 'seduto' ? { occhi: fase > 0.25 ? 'chiusi' : 'aperti' } : {});
  else caneRetro(ctx, fase);
}

/* ------------------------------------------------------------------------ */
/*  IL GATTINO                                                              */
/* ------------------------------------------------------------------------ */
/*  Micetto snello color crema: testa tonda, orecchie grandi a punta,
 *  occhi tondi col puntino, coda lunga e sottile che si arriccia in su.   */
const SCALA_GATTO = 1.25;
const ANCHE_GATTO = { pl: [-19, 5], al: [12, 5], pv: [-13, 6], av: [18, 6] };
const PIEDI_GATTO = { pl: [-24, 0], al: [9, 0], pv: [-18, 0], av: [16, 0] };

/** Testa del micio: tonda, orecchie grandi a punta, occhioni, sorriso a "ω". */
function testaGatto(ctx, g, occhi, bocca, fronte) {
  const orecchie = fronte
    ? [[[-21, -6], [-18, -33], [-4, -16]], [[4, -16], [18, -33], [21, -6]]]
    : [[[-18, -7], [-14, -33], [-1, -15]], [[5, -15], [17, -32], [19, -5]]];
  pezzo(ctx, [Forme.ellisse(0, 0, fronte ? 22 : 20, 18), ...orecchie.map((o) => Forme.poligono(o))], C.gatto, 0.6);
  for (const o of orecchie) {
    const m = o.reduce((a, b) => [a[0] + b[0] / 3, a[1] + b[1] / 3], [0, 0]);
    tinta(ctx, Forme.poligono(o.map(([x, y]) => [m[0] + (x - m[0]) * 0.5, m[1] + (y - m[1]) * 0.5 + 1])), C.rosa);
  }
  const ox = fronte ? [-9, 9] : [-3, 11], nx = fronte ? 0 : 15;
  occhio(ctx, ox[0], -1, 7, 8, g, occhi);
  occhio(ctx, ox[1], -1, fronte ? 7 : 6.5, 8, g, occhi);
  tinta(ctx, Forme.poligono([[nx - 2.5, 6], [nx + 2.5, 6], [nx, 8.5]]), C.rosa);
  if (bocca) pezzo(ctx, Forme.ellisse(nx, 12, 3.6, 4.2), C.boccaDentro, 0, 1.4);
  else {
    tratto(ctx, [[nx - 5, 10], [nx - 2.5, 13], [nx, 9.5]], 1.3);
    tratto(ctx, [[nx, 9.5], [nx + 2.5, 13], [nx + 5, 10]], 1.3);
  }
  for (const s of fronte ? [-1, 1] : [1]) {           // baffi
    tratto(ctx, [[nx + s * 9, 6], [nx + s * 22, 3]], 1.0);
    tratto(ctx, [[nx + s * 9, 9], [nx + s * 22, 10]], 1.0);
  }
}

function posaGatto(posa, t) {
  const P = { corpo: [-6, -30], rot: 0, lungo: 1, piedi: { ...PIEDI_GATTO }, coda: [0, 0], occhi: 'aperti', testaRot: 0, testa: [33, -21], sguardo: [0.6, -0.1] };
  const passi = (off, A, S, alza) => {
    for (const k in off) {
      const [x, y] = zampaCiclo(t + off[k], A, S, alza);
      P.piedi[k] = [(PIEDI_GATTO[k][0] + 6) * P.lungo + P.corpo[0] + x, y];
    }
  };
  if (posa === 'fermo') {
    P.coda = [0, t > 0.25 ? 4 : 0];
    P.occhi = t > 0.25 ? 'chiusi' : 'aperti';
    P.corpo[1] += t > 0.25 ? -0.6 : 0;
  }
  if (posa === 'cammina') {
    passi({ pl: 0, al: 0.25, pv: 0.5, av: 0.75 }, 7, 0.62, 5);
    P.corpo[1] += 0.8 * ondaC(2 * t);
    P.testa[1] += 0.9 * ondaC(2 * (t - 0.12));
    P.coda = [2.5 * onda(t - 0.2), 2 * ondaC(2 * (t - 0.25))];
  }
  if (posa === 'corre') {                         // corsa allungata ed elegante
    P.lungo = 1.04 + 0.1 * ondaC(t - 0.4);
    P.rot = -0.08 * ondaC(t - 0.15);
    P.corpo = [-6, -31 - 3 * ondaC(2 * (t - 0.4))];
    passi({ pl: 0, pv: 0.08, al: 0.45, av: 0.53 }, 20, 0.34, 11);
    P.coda = [-14 + 2 * onda(t), 16 + 3 * ondaC(t)];
    P.testa = [36, -20];
  }
  if (posa === 'strofina') {                      // si struscia: schiena inarcata, occhi felici
    const k = Math.round(t * 2) % 2;
    P.corpo = [-6 + k * 4, -31];
    P.rot = -0.06;
    P.testa = [35 + k * 2, -22];
    P.testaRot = 0.35 + k * 0.12;
    P.occhi = 'felici';
    P.coda = [3 - k * 5, -4];
  }
  return P;
}

function gattoLato(ctx, P) {
  const T = new DOMMatrix().translate(P.corpo[0], P.corpo[1]).rotate(P.rot * GRADI);
  const L = P.lungo;
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x * L, y)); return [q.x, q.y]; };
  // coda lunga e sottile che si arriccia in su
  const base = nelMondo(-22, -4), [sx, sy] = P.coda;
  tubo(ctx, [base, [base[0] - 16 + sx * 0.3, base[1] - 14 + sy * 0.3], [base[0] - 20 + sx, base[1] - 40 + sy], [base[0] - 8 + sx * 1.3, base[1] - 52 + sy * 1.2], [base[0] + 2 + sx * 1.4, base[1] - 48 + sy * 1.2]], 4.4, C.gatto);
  for (const k of ['pl', 'al', 'pv', 'av']) {
    const anca = nelMondo(...ANCHE_GATTO[k]), f = P.piedi[k], cav = [f[0] + 1, f[1] - 3.5];
    const col = k[1] === 'l' ? tono(C.gatto) : C.gatto;
    const g = ginocchio(anca, cav, k[0] === 'p' ? 16 : 14, k[0] === 'p' ? 1 : -1);
    arto(ctx, anca, g, cav, k[0] === 'p' ? 11 : 8.5, 6.5, 5.5, col, 0.5);
    pezzo(ctx, Forme.ellisse(f[0] + 2.5, f[1] - 3.2, 5.5, 3.3), col, 0, 1.4);
  }
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  pezzo(ctx, [Forme.ellisse(0, 0, 24 * L, 12), Forme.ellisse(18 * L, -5, 10, 10.5)], C.gatto);
  tratto(ctx, [[-10 * L, 9], [-16 * L, -2], [-24 * L, 0]], 1.1, INK2);
  ctx.restore();
  const [tx, ty] = nelMondo(P.testa[0], P.testa[1]);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(P.rot * 0.6 + P.testaRot);
  testaGatto(ctx, P.sguardo, P.occhi, false, false);
  ctx.restore();
}

function gattoFronte(ctx, posa, t) {
  const miagola = posa === 'miagola', k = Math.round(t * 2) % 2;
  tubo(ctx, [[10, -8], [36, -4], [38 - k * 4, -26 - k * 3], [30 - k * 3, -34 - k * 2]], 4.4, C.gatto);   // coda arricciata
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 12, -12, 10.5, 12), tono(C.gatto), 0.5);
  pezzo(ctx, Forme.ellisse(0, -30, 16.5, 24), C.gatto);
  for (const j of [-1, 0, 1]) tratto(ctx, [[j * 5, -42], [j * 6, -37]], 1.0, INK2);
  for (const s of [-1, 1]) {
    arto(ctx, [s * 6, -34], [s * 6.5, -18], [s * 7, -4], 8.5, 6.5, 5.5, C.gatto, 0.4);
    pezzo(ctx, Forme.ellisse(s * 7, -3.3, 5.5, 3.3), C.gatto, 0, 1.4);
  }
  ctx.save();
  ctx.translate(0, -64);
  ctx.rotate(miagola ? -0.08 : k ? 0.06 : 0);
  testaGatto(ctx, [0.2, -0.3], miagola ? 'felici' : k ? 'chiusi' : 'aperti', miagola, true);
  ctx.restore();
}

function disegnaGatto(ctx, vista, posa, fase) {
  return inScala(ctx, SCALA_GATTO, () => {
    if (vista === 'lato') gattoLato(ctx, posaGatto(posa, fase));
    else gattoFronte(ctx, posa, fase);
  });
}

/* ------------------------------------------------------------------------ */
/*  IL LADRO                                                                */
/* ------------------------------------------------------------------------ */
/*  Adulto alto ~356 unità (×1.1 nella cella): scarpe scure, pantaloni
 *  lilla, giubbotto di pelle marrone, berretto piatto calato sugli occhi,
 *  mani in tasca e spalle curve.                                          */
const SCALA_LADRO = 1.1;
const GEO_LADRO = { cav: 13, tal: 10, pun: 28 };

function posaLadroLato(posa, t) {
  const P = { x: 0, bob: 0, incl: 0.1, testa: 0, testaDy: 0, piedi: [{ x: -10, y: -13, rot: 0 }, { x: 10, y: -13, rot: 0 }], braccia: 'tasche', faccia: 'furbo', scuoti: 0 };
  if (posa === 'cammina') {                         // mani in tasca, un po' curvo
    P.piedi = [passo(t + 0.5, 30, 0.6, 16, -0.14, 0.42, GEO_LADRO), passo(t, 30, 0.6, 16, -0.14, 0.42, GEO_LADRO)];
    const giu = ondaC(2 * (t - 0.07));
    P.bob = 3 * giu;
    P.incl = 0.11 + 0.012 * giu;
    P.testa = 0.04 * onda(2 * (t - 0.15));
    P.testaDy = 1.5 * ondaC(2 * (t - 0.17));
    P.scuoti = onda(t - 0.05);
  }
  if (posa === 'corre' || posa === 'fuga') {
    P.piedi = [passo(t + 0.5, 50, 0.36, 44, -0.1, 0.7, GEO_LADRO), passo(t, 50, 0.36, 44, -0.1, 0.7, GEO_LADRO)];
    for (const p of P.piedi) p.x -= 6;
    const giu = ondaC(2 * (t - 0.17));
    Object.assign(P, { x: -8, bob: 5 * giu - 3, incl: 0.24 + 0.02 * giu, braccia: posa === 'corre' ? 'borsa' : 'panico', faccia: posa === 'corre' ? 'ghigno' : 'paura' });
    P.testaDy = 1.5 * ondaC(2 * (t - 0.25));
    P.scuoti = onda(t - 0.04);
  }
  if (posa === 'scippo') {                          // allunga la mano, afferra, strappa e scappa
    const k = Math.round(t * 3) % 3;
    Object.assign(P, [
      { x: -18, piedi: [{ x: -54, y: -13, rot: 0 }, { x: 38, y: -13, rot: 0 }], incl: 0.3, bob: 12, braccia: 'allunga', faccia: 'avido' },
      { x: -20, piedi: [{ x: -54, y: -13, rot: 0 }, { x: 36, y: -13, rot: 0 }], incl: 0.32, bob: 14, braccia: 'afferra', faccia: 'avido' },
      { x: -26, piedi: [piedeInPunta(-40, 0.5, GEO_LADRO), { x: 20, y: -13, rot: 0 }], incl: 0.12, bob: 4, braccia: 'strappa', faccia: 'ghigno' },
    ][k]);
  }
  return P;
}

/** Il ladro di lato (guarda a destra). */
function ladroLato(ctx, P) {
  const T = new DOMMatrix().translate(P.x, -172 + P.bob).rotate(P.incl * GRADI).translate(0, 172);
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
  const f = P.scuoti;
  const lontano = {
    tasche: null, borsa: [[-36 - 18 * f, -252], [-30 - 30 * f, -224 - 8 * f]], allunga: [[-34, -258], [-54, -244]],
    afferra: [[-34, -258], [-54, -244]], strappa: [[-40, -256], [-58, -228]], panico: [[-30, -318], [-46, -348]],
  }[P.braccia];
  const vicino = {
    tasche: [[-8 + f * 2, -236], [14, -200]], borsa: [[-4, -242], [22, -252]], allunga: [[30, -262], [64, -236]],
    afferra: [[30, -258], [62, -228]], strappa: [[12, -250], [36, -254]], panico: [[34, -262], [62, -290]],
  }[P.braccia];
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  if (lontano) braccioLadro(ctx, [-6, -284], lontano, P.braccia === 'panico' || P.braccia === 'strappa', C.giaccaScura);
  ctx.restore();
  P.piedi.forEach((pd, i) => {                       // gambe: anca → ginocchio → caviglia
    const anca = nelMondo(i ? 6 : -6, -178), cav = [pd.x, pd.y];
    tubo(ctx, [anca, ginocchio(anca, cav, 86, 1), cav], 24, i ? C.pantaloni : C.pantaloniScuri, LW, true);
    ctx.save();
    ctx.translate(pd.x, pd.y);
    ctx.rotate(pd.rot);
    pezzo(ctx, Forme.ellisse(9, 5.5, 19, 7.5), i ? C.scarpeLadro : scurisci(C.scarpeLadro, 0.15), 0);
    ctx.restore();
  });
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const g = new Path2D();
  g.moveTo(-8, -300); g.quadraticCurveTo(-31, -298, -35, -268); g.lineTo(-37, -190);
  g.quadraticCurveTo(-37, -168, -20, -166); g.lineTo(22, -166); g.quadraticCurveTo(35, -168, 33, -190);
  g.lineTo(35, -262); g.quadraticCurveTo(31, -296, 10, -300); g.closePath();
  giacca(ctx, g);
  pezzo(ctx, Forme.poligono([[-6, -304], [16, -302], [8, -284], [-10, -292]], true), C.giaccaScura, 0);   // il collo del giubbotto
  tinta(ctx, Forme.poligono([[4, -302], [16, -300], [10, -290]]), C.bianco);
  tubo(ctx, [[4, -296], [6, -306]], 11, C.pelleLadro);
  ctx.save();
  ctx.translate(0, P.testaDy);
  ctx.translate(6, -306); ctx.rotate(P.testa); ctx.translate(-6, 306);
  testaLadroLato(ctx, P.faccia);
  ctx.restore();
  if (P.braccia === 'borsa' || P.braccia === 'strappa') {   // stringe la borsetta al petto
    const sv = 6 * f;
    tubo(ctx, [[20, -240], [-16, -226 + sv], [-50, -238 - sv]], 2.4, C.salmoneScuro, 1.5);
    borsetta(ctx, 30, -246, 15);
  }
  if (P.braccia === 'afferra') {                     // la borsetta appena afferrata
    tubo(ctx, [[66, -224], [70, -206], [76, -196]], 2.4, C.salmoneScuro, 1.5);
    borsetta(ctx, 80, -184, 15);
  }
  braccioLadro(ctx, [2, -284], vicino, ['allunga', 'panico'].includes(P.braccia), C.giacca, P.braccia !== 'tasche');
  if (P.braccia === 'tasche') tratto(ctx, [[6, -212], [20, -194]], 1.6);
  ctx.restore();
}

/** Giubbotto: pelle marrone, ombra, elastico in vita. */
function giacca(ctx, forma) {
  const p = pezzo(ctx, forma, C.giacca, 1.3);
  ctx.save();
  ctx.clip(p);
  tinta(ctx, Forme.rettangolo(-60, -182, 120, 18, 2), C.giaccaScura);
  linea(ctx, (q) => { q.moveTo(-60, -182); q.lineTo(60, -182); }, { spessore: px(1.4), colore: INK });
  ctx.restore();
}

/** Braccio del ladro: spalla → gomito → mano (pugno o mano aperta). */
function braccioLadro(ctx, spalla, [gomito, m], aperta, colore, conMano = true) {
  tubo(ctx, [spalla, gomito, m], 21, colore, LW, true);
  const dir = Math.atan2(m[1] - gomito[1], m[0] - gomito[0]);
  if (conMano) mano(ctx, m[0] + Math.cos(dir) * 10, m[1] + Math.sin(dir) * 10, 8, dir, aperta, C.pelleLadro);
}

/** Testa di profilo: naso lungo, berretto piatto calato, espressione. */
function testaLadroLato(ctx, faccia) {
  pezzo(ctx, [Forme.ellisse(5, -324, 17, 23), Forme.poligono([[17, -333], [37, -316], [19, -310]])], C.pelleLadro, 0.6);
  pezzo(ctx, Forme.poligono([[-13, -342], [0, -342], [-4, -322], [-11, -316]], true), C.capelliLadro, 0);
  pezzo(ctx, Forme.ellisse(-4, -321, 4.5, 6), C.pelleLadro, 0, 1.6);              // orecchio
  if (faccia === 'paura' || faccia === 'avido') {
    occhio(ctx, 15, -326, 5.5, 6.5, [faccia === 'paura' ? -0.6 : 0.8, 0.2]);
    if (faccia === 'paura') {
      pezzo(ctx, Forme.ellisse(22, -301, 5, 6), C.boccaDentro, 0, 1.6);
      tinta(ctx, Forme.ellisse(-14, -310, 3, 4.5), '#bfe3f2');
      tinta(ctx, Forme.ellisse(-20, -298, 2.4, 3.6), '#bfe3f2');
    } else tratto(ctx, [[14, -306], [22, -300], [30, -305]], 1.8);
  } else {
    pezzo(ctx, Forme.ellisse(16, -325, 4.5, 3.6), C.bianco, 0, 1.4);             // occhio socchiuso
    tinta(ctx, Forme.cerchio(19, -324.5, 1.8), C.pupilla);
    tratto(ctx, [[10, -328], [16, -329], [22, -327]], 2.0);
    tratto(ctx, faccia === 'ghigno' ? [[13, -305], [22, -302], [29, -307]] : [[14, -304], [21, -303], [26, -307]], 1.8);
  }
  berretto(ctx, faccia === 'paura' ? -8 : 0, true);
}

/** Berretto piatto (di lato con la visiera in avanti, oppure di fronte). */
function berretto(ctx, alza, lato) {
  const y = -341 + alza;
  if (lato) {
    pezzo(ctx, Forme.poligono([[12, y + 1], [40, y + 2], [42, y + 8], [14, y + 8]], true), C.giaccaScura, 0);
    const p = new Path2D();
    p.moveTo(-21, y + 3); p.quadraticCurveTo(-24, y - 15, 4, y - 15); p.quadraticCurveTo(32, y - 13, 36, y + 2);
    p.quadraticCurveTo(8, y + 6, -21, y + 3); p.closePath();
    pezzo(ctx, p, C.berretto, 0.8);
  } else {
    pezzo(ctx, Forme.ellisse(0, y - 3, 28, 12), C.berretto, 0.8);
    pezzo(ctx, Forme.poligono([[-21, y + 2], [21, y + 2], [17, y + 12], [-17, y + 12]], true), C.giaccaScura, 0);
  }
  tratto(ctx, [[lato ? -4 : -12, y - 12], [lato ? 4 : 0, y - 8], [12, y - 12]], 1.2, INK2);
}

/** Il ladro di fronte: fermo con le mani in tasca, oppure spaventato. */
function ladroFronte(ctx, spaventato) {
  for (const s of [-1, 1]) {
    const anca = [s * 13, -176], cav = [s * (spaventato ? 22 : 14), -13];
    tubo(ctx, [anca, spaventato ? [s * 22, -96] : [s * 14, -96], cav], 25, s < 0 ? C.pantaloniScuri : C.pantaloni, LW, true);
    pezzo(ctx, Forme.ellisse(s * (spaventato ? 26 : 17), -7.5, 17, 7.5), C.scarpeLadro, 0);
  }
  const g = new Path2D();
  g.moveTo(-22, -298); g.quadraticCurveTo(-44, -296, -46, -268); g.lineTo(-42, -186);
  g.quadraticCurveTo(-40, -167, -30, -166); g.lineTo(30, -166); g.quadraticCurveTo(40, -167, 42, -186);
  g.lineTo(46, -268); g.quadraticCurveTo(44, -296, 22, -298); g.closePath();
  giacca(ctx, g);
  tratto(ctx, [[2, -290], [3, -168]], 1.3, INK2);                                  // cerniera
  for (const s of [-1, 1]) pezzo(ctx, Forme.poligono([[s * 2, -302], [s * 24, -300], [s * 20, -280], [s * 4, -284]], true), C.giaccaScura, 0);   // collo
  tinta(ctx, Forme.poligono([[-10, -300], [10, -300], [0, -284]]), C.bianco);
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) {
    if (spaventato) braccioLadro(ctx, [s * 38, -284], [[s * 64, -300], [s * 58, -338]], true, C.giacca);
    else { tubo(ctx, [[s * 38, -284], [s * 48, -236], [s * 28, -200]], 21, C.giacca, LW, true); tratto(ctx, [[s * 18, -212], [s * 34, -196]], 1.6); }
  }
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro, 0.6);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 19, -320, 4, 6), C.pelleLadro, 0, 1.6);
  if (spaventato) {
    occhio(ctx, -8, -326, 6, 7, [0, 0]);
    occhio(ctx, 8, -326, 6, 7, [0, 0]);
    pezzo(ctx, Forme.ellisse(0, -304, 6, 7.5), C.boccaDentro, 0, 1.6);
  } else {
    for (const s of [-1, 1]) {
      pezzo(ctx, Forme.ellisse(s * 8, -326, 4.5, 3.4), C.bianco, 0, 1.4);
      tinta(ctx, Forme.cerchio(s * 8 + 2.5, -325.5, 1.7), C.pupilla);
      tratto(ctx, [[s * 8 - 5, -328.5], [s * 8 + 5, -329]], 2.0);
    }
    tratto(ctx, [[-6, -304], [2, -303], [8, -307]], 1.8);
  }
  tratto(ctx, [[0, -322], [2, -313], [-2, -311]], 1.6);                           // nasone
  berretto(ctx, spaventato ? -10 : 0, false);
}

/** Il ladro visto di spalle mentre scappa con la borsetta. */
function ladroRetro(ctx, k) {
  for (const s of [-1, 1]) {
    const su = (k === 0) === (s < 0);
    const cav = su ? [s * 12, -60] : [s * 14, -13];
    tubo(ctx, [[s * 13, -182], su ? [s * 16, -112] : [s * 14, -96], cav], 25, su ? C.pantaloniScuri : C.pantaloni, LW, true);
    pezzo(ctx, Forme.ellisse(cav[0], cav[1] + 6, 16, su ? 9 : 7.5), su ? '#3a271e' : C.scarpeLadro, 0);
  }
  giacca(ctx, Forme.rettangolo(-44, -300, 88, 136, 26));
  tubo(ctx, [[-30, -230], [-58, -246], [-74, -262]], 2.4, C.salmoneScuro, 1.5);    // la cinghia della borsetta
  for (const s of [-1, 1]) {
    const su = (k === 0) === (s > 0);
    braccioLadro(ctx, [s * 38, -282], su ? [[s * 60, -250], [s * 50, -296]] : [[s * 58, -250], [s * 50, -216]], false, C.giacca);
  }
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 18, -322, 4, 6), C.pelleLadro, 0, 1.6);
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro, 0.6);
  pezzo(ctx, Forme.poligono([[-19, -342], [19, -342], [18, -318], [0, -312], [-18, -318]], true), C.capelliLadro, 0.6);
  berretto(ctx, 0, false);
}

function disegnaLadro(ctx, vista, posa, fase) {
  return inScala(ctx, SCALA_LADRO, () => {
    if (vista === 'fronte') ladroFronte(ctx, posa === 'spaventato');
    else if (vista === 'retro') ladroRetro(ctx, Math.round(fase * 2) % 2);
    else ladroLato(ctx, posaLadroLato(posa, fase));
  });
}

/* ------------------------------------------------------------------------ */
/*  L'ABBRACCIO (Lia streghetta in ginocchio stringe Biscotto)              */
/* ------------------------------------------------------------------------ */
/**
 * L'abbraccio: Lia streghetta in ginocchio stringe Biscotto seduto.
 * La testa del cane sta sotto il mento di Lia, un braccio gli cinge il
 * collo e l'altra manina gli accarezza la testa (come nel film).
 */
function disegnaAbbraccio(ctx, t) {
  const k = Math.round(t * 4) % 4, felice = k >= 2, A = ABITI.strega;
  const resp = 0.5 - 0.5 * ondaC(t);
  const X = 34;                                     // dove sta Lia, in ginocchio
  ctx.translate(6, 0);
  // la bacchetta posata a terra
  bacchetta(ctx, X + 34, -6, -0.08, 44);
  // gli stivaletti spuntano dietro la gonna
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(X + s * 50, -14);
    ctx.rotate(s * 0.3);
    pezzo(ctx, Forme.ellisse(0, 4, 15, 10), C.viola, 0.6);
    ctx.restore();
  }
  // busto e gonna allargata a terra in un'unica sagoma
  const T = new DOMMatrix().translate(X, -46 - resp).rotate(-0.08 * GRADI);
  const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
  const [n0, s0, s1, n1] = [[-10, -101], [-22, -87], [22, -87], [10, -101]].map(inMondo);
  const v = new Path2D();
  v.moveTo(...n0);
  v.quadraticCurveTo(s0[0] - 2, n0[1], ...s0);
  v.bezierCurveTo(s0[0] - 8, s0[1] + 44, X - 66, -36, X - 62, -3);
  v.bezierCurveTo(X - 28, 4, X + 28, 4, X + 62, -3);
  v.bezierCurveTo(X + 66, -36, s1[0] + 8, s1[1] + 44, ...s1);
  v.quadraticCurveTo(s1[0] + 2, n1[1], ...n1);
  v.closePath();
  pezzo(ctx, v, A.vestito, 1.7);
  tratto(ctx, [[X + 42, -36], [X + 50, -8]], 1.3, INK2);
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  mantellinaFronte(ctx, false);
  ctx.restore();
  // la testa inclinata verso Biscotto
  const H = T.translate(2, COLLO[1] - 0.6 * resp).rotate((felice ? -0.2 : -0.15) * GRADI);
  ctx.save();
  ctx.transform(H.a, H.b, H.c, H.d, H.e, H.f);
  testaFronte(ctx, A, { capelli: [0, resp], sguardo: [-0.7, 0.45], occhi: felice ? 'felici' : 'aperti', bocca: felice ? 'sorriso' : 'chiusa', cappello: -0.04 }, false);
  ctx.restore();
  // Biscotto seduto che alza il muso verso Lia
  ctx.save();
  ctx.translate(-36, 0);
  inScala(ctx, 0.9, () => caneFronte(ctx, 'seduto', t, {
    testa: [20, -124], rotTesta: 0.3, sguardo: [0.6, -0.8], coda: 0.6 * onda(t), codaLato: -1, occhi: felice ? 'felici' : 'aperti',
  }));
  ctx.restore();
  // il braccio che stringe il collo e la manina sulla testa di Biscotto
  const spD = inMondo([21, -85]), spS = inMondo([-21, -85]);
  const manoD = [-6, -98], manoS = [-24, -142];
  tubo(ctx, arco(spD, [X + 6, -92], manoD), 6.6, C.pelle);
  mano(ctx, ...manoD, 6.4, Math.PI, false, C.pelle);
  tubo(ctx, arco(spS, [-8, -148], manoS), 6.6, C.pelle);
  mano(ctx, ...manoS, 6.4, Math.PI * 0.8, true, C.pelle, Math.PI * 0.75);
}

/* ------------------------------------------------------------------------ */
/*  ATLANTI                                                                 */
/* ------------------------------------------------------------------------ */
const serie = (prefisso, n) => Array.from({ length: n }, (_, k) => prefisso + '_' + k);

const NOMI_LIA = [
  ...serie('lato_fermo', 4), ...serie('lato_cammina', 8), ...serie('lato_corre', 8), ...serie('lato_tocca', 4),
  'lato_ascolta_0', 'lato_ascolta_1', 'lato_china_0', 'lato_china_1', 'lato_sorpresa', 'lato_urto',
  'fronte_fermo_0', 'fronte_fermo_1', 'fronte_sorpresa', 'fronte_saluta_0', 'fronte_saluta_1', ...serie('fronte_cammina', 4),
  'retro_fermo_0', ...serie('retro_cammina', 4),
];
/*  Le celle di Lia sono 44 ma una tela 2048×2048 ne contiene 40: quattro
 *  fotogrammi riusano un disegno identico (scelta naturale per l'animazione):
 *    - il respiro è "avanti e indietro": il 3 è uguale all'1;
 *    - l'ultimo colpetto ("ritorno") è la posa di riposo;
 *    - di spalle il "passaggio" (piedi uniti) vale anche da posa ferma.   */
const ALIAS_LIA = {
  lato_fermo_3: 'lato_fermo_1', lato_tocca_3: 'lato_fermo_0',
  retro_cammina_3: 'retro_cammina_1', retro_fermo_0: 'retro_cammina_1',
};
const NOMI_CANE = [
  ...serie('lato_fermo', 4), ...serie('lato_cammina', 8), ...serie('lato_corre', 6),
  'lato_abbaia_0', 'lato_abbaia_1', 'lato_ringhia_0', 'lato_ringhia_1', 'lato_annusa_0', 'lato_annusa_1',
  ...serie('lato_borsa', 6), 'lato_borsa_fermo_0', 'lato_borsa_fermo_1',
  'fronte_seduto_0', 'fronte_seduto_1', 'fronte_abbaia', ...serie('retro_cammina', 4),
];
const NOMI_GATTO = [
  'lato_fermo_0', 'lato_fermo_1', ...serie('lato_cammina', 8), ...serie('lato_corre', 6),
  'lato_strofina_0', 'lato_strofina_1', 'fronte_seduto_0', 'fronte_seduto_1', 'fronte_miagola',
];
const NOMI_LADRO = [
  'fronte_fermo_0', ...serie('lato_cammina', 8), ...serie('lato_corre', 6), ...serie('lato_scippo', 3),
  'retro_corre_0', 'retro_corre_1',
];

/** "lato_cammina_2" → ['lato', 'cammina', 2];  "lato_borsa_fermo_1" → ['lato', 'borsa_fermo', 1] */
function leggiNome(nome) {
  const parti = nome.split('_');
  const k = /^\d+$/.test(parti[parti.length - 1]) ? Number(parti.pop()) : 0;
  return [parti[0], parti.slice(1).join('_') || 'fermo', k];
}

/**
 * Costruisce un atlante: ogni cella ha l'origine a terra, al centro in basso.
 * disegna(ctx, vista, posa, fase) riceve la fase 0..1 del ciclo della posa.
 * alias: { nomeFotogramma: nomeDelDisegnoDaRiusare }.
 */
function atlante(nomi, l, a, altezzaMondo, disegna, alias = {}) {
  const quanti = {};
  for (const n of nomi) { const [v, p] = leggiNome(n); quanti[v + '_' + p] = (quanti[v + '_' + p] || 0) + 1; }
  const unici = nomi.filter((n) => !alias[n]);
  const { tela, fotogrammi } = creaAtlante(unici, { l, a }, (ctx, nome, cl, ca) => {
    ctx.translate(cl / 2, ca - 1.5);
    const [v, p, k] = leggiNome(nome);
    SC = 1;
    disegna(ctx, v, p, k / quanti[v + '_' + p]);
  });
  const tutti = {};
  for (const n of nomi) tutti[n] = Object.assign({}, fotogrammi[alias[n] || n]);
  return { tela, fotogrammi: tutti, cella: { l, a }, altezzaMondo };
}

/** Dipinge tutti i personaggi e li restituisce come atlanti per il motore. */
export async function creaPersonaggi() {
  const r = {};
  for (const [nome, abito] of [['lia_borsa', 'borsa'], ['lia', 'semplice'], ['lia_strega', 'strega']]) {
    r[nome] = atlante(NOMI_LIA, 256, 384, 1.25, (ctx, v, p, f) => disegnaLia(ctx, abito, v, p, f), ALIAS_LIA);
    await respira();
  }
  r.biscotto = atlante(NOMI_CANE, 320, 224, 0.7, disegnaCane);
  await respira();
  r.gattino = atlante(NOMI_GATTO, 192, 160, 0.42, disegnaGatto);
  r.ladro = atlante(NOMI_LADRO, 224, 448, 2.0, disegnaLadro);
  await respira();
  r.abbraccio = atlante(serie('base', 4), 384, 384, 1.25, (ctx, v, p, f) => disegnaAbbraccio(ctx, f));
  return r;
}

/* ------------------------------------------------------------------------ */
/*  ILLUSTRAZIONI (titolo e titoli di coda)                                 */
/* ------------------------------------------------------------------------ */
/*  Fondali ad acquerello (velature, macchie, fogliame) con sopra i
 *  personaggi nello stesso stile "cel" dei giochi.                         */

/** Disegna un personaggio in (x, y) ingrandito di "scala" (y = dove poggia). */
function inScena(ctx, x, y, scala, disegna) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scala, scala);
  SC = 1;
  const r = disegna(ctx);
  ctx.restore();
  return r ? [x + r[0] * scala, y + r[1] * scala] : null;
}

/** Ombra morbida lilla sotto un personaggio (nel gioco la fa il motore). */
function ombraTerra(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(110, 90, 140, 0.32)'); g.addColorStop(1, 'rgba(110, 90, 140, 0)');
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Una finestra con cornice chiara, vetri azzurri, davanzale e a volte persiane. */
function finestra(ctx, x, y, l, a, seme, persiane) {
  const rng = casuale(seme);
  if (persiane) for (const s of [-1, 1]) {
    const fx = s < 0 ? x - l * 0.45 : x + l;
    acquerello(ctx, Forme.rettangolo(fx, y, l * 0.45, a, 2), persiane, { area: [fx, y, l * 0.45, a], seme: seme + s, bordo: 0.3, variazione: 0.15 });
    for (let k = 1; k < 6; k++) linea(ctx, (p) => { p.moveTo(fx + 3, y + (k * a) / 6); p.lineTo(fx + l * 0.45 - 3, y + (k * a) / 6); }, { spessore: 1, alfa: 0.35 });
  }
  const vetro = Forme.rettangolo(x, y, l, a, 3);
  acquerello(ctx, vetro, '#86aac0', { area: [x, y, l, a], seme, bordo: 0.4, variazione: 0.35, granulosita: 0.2, luce: 'alto' });
  tinta(ctx, Forme.poligono([[x + l * 0.15, y + a], [x + l * 0.75, y], [x + l * 0.95, y], [x + l * 0.35, y + a]]), '#ffffff', 0.22 + rng() * 0.1);
  linea(ctx, vetro, { colore: '#fbf8ef', spessore: 4 });
  linea(ctx, (p) => { p.moveTo(x + l / 2, y); p.lineTo(x + l / 2, y + a); p.moveTo(x, y + a * 0.4); p.lineTo(x + l, y + a * 0.4); }, { colore: '#fbf8ef', spessore: 2.5 });
  linea(ctx, Forme.rettangolo(x - 2, y - 2, l + 4, a + 4, 3), { spessore: 1.3, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(x - 6, y + a, l + 12, 6, 1), '#efe6d6', { area: [x - 6, y + a, l + 12, 6], seme: seme + 9, bordo: 0.2, variazione: 0 });
  linea(ctx, Forme.rettangolo(x - 6, y + a, l + 12, 6, 1), { spessore: 1.2, alfa: 0.7 });
}

/** Una facciata ad acquerello con cornicione, finestre, porta e fioriere. */
function facciata(ctx, x, y, l, a, colore, seme, suolo) {
  const rng = casuale(seme * 131);
  const muro = Forme.rettangolo(x, y, l, suolo - y + 2, 0);
  acquerello(ctx, muro, colore, { area: [x, y, l, suolo - y], seme, luce: 'alto', larghezzaBordo: 7 });
  linea(ctx, muro, { spessore: 1.6, alfa: 0.7 });
  const corn = Forme.rettangolo(x - 5, y - 8, l + 10, 14, 2);
  acquerello(ctx, corn, scurisci(colore, 0.18), { area: [x - 5, y - 8, l + 10, 14], seme: seme + 3, bordo: 0.3, variazione: 0.1 });
  linea(ctx, corn, { spessore: 1.4, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(x, suolo - 34, l, 34, 0), scurisci(colore, 0.12), { area: [x, suolo - 34, l, 34], seme: seme + 4, bordo: 0.2, opacita: 0.5 });
  const colonne = Math.max(2, Math.round(l / 95)), piani = Math.max(1, Math.floor((suolo - y - 190) / 120));
  const persiane = rng() < 0.5 ? ['#8fb7a2', '#9db4d4', '#e6b27a'][Math.floor(rng() * 3)] : null;
  const porta = Math.floor(rng() * colonne);
  for (let p = 0; p <= piani; p++) {
    for (let c = 0; c < colonne; c++) {
      const fx = x + ((c + 0.5) * l) / colonne - 24, fy = y + 30 + p * 120;
      if (p === piani) {                               // piano terra: porta o vetrina
        if (c !== porta) continue;
        const pp = Forme.rettangolo(fx - 8, suolo - 150, 64, 150, 14);
        acquerello(ctx, pp, ['#8a5b3e', '#5f86a0', '#7c9a6c'][seme % 3], { area: [fx - 8, suolo - 150, 64, 150], seme: seme + 11, bordo: 0.4 });
        linea(ctx, pp, { spessore: 1.6, alfa: 0.8 });
        linea(ctx, Forme.rettangolo(fx + 2, suolo - 138, 44, 56, 5), { spessore: 1.2, alfa: 0.5 });
        tinta(ctx, Forme.cerchio(fx + 46, suolo - 72, 3), '#e8c45a');
        continue;
      }
      finestra(ctx, fx, fy, 48, 72, seme * 10 + p * 3 + c, persiane);
      if (p === piani - 1 && (c + seme) % 2 === 0) {   // fioriera con gerani
        fogliame(ctx, fx + 24, fy + 84, 26, { seme: seme + c, quante: 26, schiaccia: 0.5, dimFoglia: 9, inchiostro: 0.3 });
        fiorellini(ctx, fx + 2, fy + 72, 44, 12, ['#e86f6a', '#f29bb0', '#ffffff'], 6, seme + c, 3);
        acquerello(ctx, Forme.rettangolo(fx - 4, fy + 82, 56, 14, 2), '#c98a63', { area: [fx - 4, fy + 82, 56, 14], seme: seme + 7, bordo: 0.3 });
        linea(ctx, Forme.rettangolo(fx - 4, fy + 82, 56, 14, 2), { spessore: 1.2, alfa: 0.7 });
      }
    }
  }
}

/** Il marciapiede con le piastrelle e il percorso tattile giallo. */
function marciapiede(ctx, y0, y1) {
  acquerello(ctx, Forme.rettangolo(0, y0, 1280, y1 - y0, 0), '#e6e0d4', { area: [0, y0, 1280, y1 - y0], seme: 41, variazione: 0.18, bordo: 0, luce: 'basso' });
  for (let x = -400; x < 1700; x += 110) linea(ctx, (p) => { p.moveTo(640 + (x - 640) * 0.8, y0); p.lineTo(640 + (x - 640) * 1.25, y1); }, { spessore: 1, colore: STILE.inchiostroChiaro, alfa: 0.45 });
  for (const y of [y0 + 24, y0 + 100, y0 + 140]) linea(ctx, (p) => { p.moveTo(0, y); p.lineTo(1280, y); }, { spessore: 1, colore: STILE.inchiostroChiaro, alfa: 0.45 });
  const t0 = y0 + 54, ta = 32;                            // percorso tattile: piastre gialle a righe
  acquerello(ctx, Forme.rettangolo(0, t0, 1280, ta, 0), '#f6d65e', { area: [0, t0, 1280, ta], seme: 43, variazione: 0.2, bordo: 0.25, granulosita: 0.3 });
  for (let x = 0; x < 1280; x += 40) {
    linea(ctx, (p) => { p.moveTo(x, t0); p.lineTo(x - 3, t0 + ta); }, { spessore: 1.2, colore: '#b98f2e', alfa: 0.6 });
    for (let k = 0; k < 4; k++) {
      const bar = Forme.rettangolo(x + 8 + k * 7.5, t0 + 5, 4, ta - 10, 2);
      tinta(ctx, bar, '#fde99c'); linea(ctx, bar, { spessore: 0.9, colore: '#b98f2e', alfa: 0.7 });
    }
  }
  linea(ctx, (p) => { p.moveTo(0, t0); p.lineTo(1280, t0); p.moveTo(0, t0 + ta); p.lineTo(1280, t0 + ta); }, { spessore: 1.3, alfa: 0.6 });
}

/** Nuvolette bianche ad acquerello. */
function nuvole(ctx, rng) {
  for (let k = 0; k < 5; k++) {
    const nx = 120 + k * 260 + tra(rng, -40, 40), ny = tra(rng, 40, 110);
    for (let j = 0; j < 4; j++) acquerello(ctx, Forme.ellisse(nx + j * 34 - 50, ny + (j % 2) * 8, 46, 26), '#ffffff', { area: [nx - 110, ny - 40, 220, 90], seme: k * 9 + j, opacita: 0.6, bordo: 0.12, granulosita: 0.1, variazione: 0.1 });
  }
}

/** Edera che pende da un cornicione: tralci ondulati, foglioline e qualche fiore rosso. */
function edera(ctx, x, y, lung, seme) {
  const rng = casuale(seme);
  for (let t = 0; t < 4; t++) {
    const x0 = x + t * 15 - 22, L = lung * tra(rng, 0.5, 1), punti = [];
    for (let k = 0; k <= 10; k++) punti.push([x0 + Math.sin(k * 0.9 + t) * 7, y + (k * L) / 10]);
    pennellata(ctx, punti, '#5d7f45', 2, 0.8);
    punti.forEach(([fx, fy], k) => k && foglia(ctx, fx, fy, (k % 2 ? 0.5 : 2.6) + rng() * 0.5, 14, 6, ['#4f8a52', '#6faa5e', '#8fc070'][k % 3], 0.5));
    if (rng() < 0.6) fiorellini(ctx, x0 - 8, y + L * 0.3, 16, L * 0.6, ['#e8665d', '#f08a7a'], 3, seme + t, 3);
  }
}
/** Illustrazione del titolo: una via pastello e Lia a passeggio con Biscotto. */
export async function creaIllustrazioneTitolo() {
  const tela = nuovaTela(1280, 720), ctx = tela.getContext('2d');
  const rng = casuale(1910);
  ctx.fillStyle = STILE.carta; ctx.fillRect(0, 0, 1280, 720);
  velatura(ctx, 0, 0, 1280, 460, ['#b9dcec', '#dcecec', '#fbf2da']);
  nuvole(ctx, rng);
  const sole = ctx.createRadialGradient(140, 0, 0, 140, 0, 900);   // luce calda del sole
  sole.addColorStop(0, 'rgba(255, 238, 190, 0.45)'); sole.addColorStop(1, 'rgba(255, 238, 190, 0)');
  const suolo = 500;
  const colori = ['#f2b8a0', '#f5d993', '#bcd9c0', '#cbc2e2', '#f3c3c6', '#a8d0de', '#f4cd9a'];
  let x = -30;
  for (let k = 0; x < 1290; k++) {
    const l = Math.round(tra(rng, 220, 290)), alto = Math.round(tra(rng, 340, 470));
    facciata(ctx, x, suolo - alto, l, alto, colori[k % colori.length], k + 3, suolo);
    if (k % 3 === 1) edera(ctx, x + l * 0.8, suolo - alto + 6, 260, k);
    x += l;
    if (k % 2) await respira();
  }
  ctx.fillStyle = sole; ctx.fillRect(0, 0, 1280, 720);
  marciapiede(ctx, suolo, 670);
  acquerello(ctx, Forme.rettangolo(0, 670, 1280, 12, 0), '#d6d2cc', { area: [0, 670, 1280, 12], seme: 51, bordo: 0.3 });
  linea(ctx, (p) => { p.moveTo(0, 670); p.lineTo(1280, 670); p.moveTo(0, 682); p.lineTo(1280, 682); }, { spessore: 1.4, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(0, 682, 1280, 40, 0), '#aaa3ba', { area: [0, 682, 1280, 40], seme: 52, variazione: 0.25, bordo: 0 });
  for (let x2 = 40; x2 < 1280; x2 += 200) tinta(ctx, Forme.rettangolo(x2, 706, 110, 6, 3), '#f6f2ea', 0.85);
  // Lia con la borsetta porta a spasso Biscotto al guinzaglio
  const yP = 650, sc = 0.95, scCane = sc * (307 / 320);
  const xL = 560, xC = 790;
  ombraTerra(ctx, xL, yP, 58, 9); ombraTerra(ctx, xC, yP, 96, 11);
  const presa = inScena(ctx, xL, yP, sc, (c) => disegnaLia(c, 'borsa', 'lato', 'cammina', 0.125, [48, -112]));
  const pc = posaCaneLato('cammina', 0.375), cl = collareCane(pc);
  const collare = [xC + cl[0] * scCane, yP + cl[1] * scCane];
  linea(ctx, (p) => { p.moveTo(...presa); p.quadraticCurveTo((presa[0] + collare[0]) / 2, Math.max(presa[1], collare[1]) + 10, ...collare); }, { colore: '#c4574a', spessore: 2.2 });
  inScena(ctx, xC, yP, scCane, (c) => disegnaCane(c, 'lato', 'cammina', 0.375));
  inScena(ctx, xL, yP, sc, (c) => mano(c, 48, -112, 6.4, 0, false, C.pelle));   // la manina stringe il guinzaglio
  granula(ctx, 0, 0, 1280, 720, 0.12);
  return tela;
}

/** Illustrazione finale: al parco Biscotto abbaia al ladro che scappa. */
export async function creaIllustrazioneFinale() {
  const tela = nuovaTela(1280, 720), ctx = tela.getContext('2d');
  const rng = casuale(77);
  ctx.fillStyle = STILE.carta; ctx.fillRect(0, 0, 1280, 720);
  velatura(ctx, 0, 0, 1280, 440, ['#b6d8ea', '#e0eeea', '#faf0d6']);
  nuvole(ctx, rng);
  const lontani = ['#6f9a86', '#8db59a', '#b4d2b0'];
  for (let k = 0; k < 14; k++) fogliame(ctx, k * 100 + tra(rng, -20, 20), 390 + tra(rng, -14, 10), tra(rng, 50, 80), { seme: 200 + k, colori: lontani, quante: 40, inchiostro: 0.15, schiaccia: 0.7 });
  await respira();
  const prato = Forme.rettangolo(0, 405, 1280, 320, 0);
  acquerello(ctx, prato, '#b4d48e', { area: [0, 405, 1280, 315], seme: 5, luce: 'alto', variazione: 0.3, bordo: 0 });
  const sentiero = new Path2D();
  sentiero.moveTo(1280, 470); sentiero.quadraticCurveTo(900, 480, 760, 560); sentiero.quadraticCurveTo(620, 650, 520, 720);
  sentiero.lineTo(820, 720); sentiero.quadraticCurveTo(900, 620, 1020, 540); sentiero.quadraticCurveTo(1120, 490, 1280, 486); sentiero.closePath();
  acquerello(ctx, sentiero, '#eadcbc', { area: [500, 460, 780, 260], seme: 6, bordo: 0.35 });
  for (let k = 0; k < 260; k++) {                       // fili d'erba
    const gx = rng() * 1280, gy = 420 + rng() * 300, h = 5 + rng() * 9;
    pennellata(ctx, [[gx, gy], [gx + tra(rng, -3, 3), gy - h]], rng() < 0.5 ? '#7fae61' : '#9cc777', 1.6, 0.7);
  }
  fiorellini(ctx, 0, 450, 1280, 260, ['#ffffff', '#f6b6c4', '#f7e08a'], 60, 9, 3);
  ombraTerra(ctx, 250, 590, 230, 30);                   // il grande albero
  for (const [a, b] of [[[236, 340], [120, 220]], [[262, 330], [380, 200]], [[250, 300], [258, 130]]]) {
    pennellata(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14], b], '#6e513d', 22, 0.95);
    pennellata(ctx, [a, [(a[0] + b[0]) / 2 - 3, (a[1] + b[1]) / 2 - 16], b], '#9a7a5e', 9, 0.6);
  }
  const tronco = Forme.poligono([[180, 604], [214, 570], [224, 430], [214, 300], [278, 300], [270, 430], [282, 566], [326, 606], [252, 596]], true);
  acquerello(ctx, tronco, '#8c6a50', { area: [180, 290, 150, 320], seme: 13, luce: 'sinistra', bordo: 0.5 });
  linea(ctx, tronco, { spessore: 2, alfa: 0.75 });
  for (const xx of [236, 254]) pennellata(ctx, [[xx, 560], [xx + 4, 470], [xx - 2, 380]], '#6e513d', 2, 0.5);
  const chioma = [[90, 300, 80], [440, 290, 85], [250, 260, 120], [130, 210, 105], [380, 200, 110], [250, 150, 130], [170, 90, 95], [340, 80, 95], [260, 30, 90]];
  for (const [k, [cx, cy, r]] of chioma.entries()) {
    fogliame(ctx, cx, cy, r, { seme: 300 + k, quante: Math.round(r * 1.5), inchiostro: 0.45, colori: k < 3 ? ['#3f7346', '#5d9650', '#86bb6b'] : ['#4c8450', '#6ea65b', '#a2cf7f'] });
    if (k % 3 === 2) await respira();
  }
  // la borsetta caduta sull'erba
  ombraTerra(ctx, 712, 652, 40, 8);
  inScena(ctx, 712, 636, 1.6, (c) => { tubo(c, [[-6, -6], [-40, 4], [-30, 14], [10, 10]], 2.4, C.salmoneScuro, 1.5); borsetta(c, 0, 0, 12); });
  // Biscotto abbaia, il ladro scappa spaventato
  ombraTerra(ctx, 470, 642, 100, 13); ombraTerra(ctx, 990, 600, 70, 11);
  inScena(ctx, 470, 642, 0.96, (c) => disegnaCane(c, 'lato', 'abbaia', 0.5));
  for (const a of [-0.5, -0.15, 0.2]) tratto(ctx, [[600 + Math.cos(a) * 14, 500 + Math.sin(a) * 14], [600 + Math.cos(a) * 34, 500 + Math.sin(a) * 34]], 2.2);
  inScena(ctx, 990, 600, 1.05, (c) => disegnaLadro(c, 'lato', 'fuga', 0));
  for (let k = 0; k < 4; k++) pennellata(ctx, [[880 - k * 6, 330 + k * 46], [800 - k * 10, 330 + k * 46]], '#a07e64', 2.2, 0.55);
  for (let k = 0; k < 3; k++) acquerello(ctx, Forme.ellisse(915 - k * 26, 598 - k * 6, 16 - k * 3, 9 - k * 2), '#efe3c8', { area: [860, 570, 80, 40], seme: 60 + k, opacita: 0.7, bordo: 0.2 });
  granula(ctx, 0, 0, 1280, 720, 0.12);
  return tela;
}
