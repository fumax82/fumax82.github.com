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
 *  Stile:
 *    - linee sottili color seppia, un po' più spesse sul lato in ombra
 *      (in basso a sinistra), come un inchiostratore a mano;
 *    - campiture piatte pastello con un secondo tono d'ombra morbido;
 *    - alla fine una grana di carta leggerissima, solo dentro le figure.
 *
 *  Animazione: ogni posa è una funzione della "fase" t (da 0 a 1). Un ciclo
 *  di 8 fotogrammi usa t = 0, 1/8, 2/8 ... così i passaggi sono continui.
 *  Principi usati: contatto / abbassamento / passaggio / sollevamento,
 *  braccia opposte alle gambe, testa che oscilla di 2-4 px, capelli e orlo
 *  del vestito che "arrivano dopo" (azione sovrapposta), piedi ben piantati.
 *
 *  Coordinate: ogni personaggio si disegna con l'origine (0, 0) a terra, al
 *  centro dei piedi; la y cresce verso il basso (sopra il suolo y < 0).
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, scurisci, percorso, Forme, tinta, linea, ombreggia, trama,
  acquerello, velatura, pennellata, granula, foglia, fogliame, fiorellini, creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  COLORI, SPESSORI E UN PO' DI MATEMATICA                                 */
/* ------------------------------------------------------------------------ */
const INK = STILE.inchiostro;              // inchiostro seppia
const INK2 = STILE.inchiostroChiaro;       // linee secondarie (pieghe)
const LW = 2.4;                            // spessore medio del contorno (varia da ~1.9 a ~3.2 px)
const OMBRA = 'rgba(90, 64, 122, 0.17)';   // secondo tono: velatura lilla
const OMBRA_FREDDA = 'rgba(96, 124, 178, 0.17)'; // sulle cose bianche (cappello, scarpe)
const OMBRA_TESA = 'rgba(170, 100, 90, 0.13)';   // l'ombra calda della tesa sul viso
const GRADI = 180 / Math.PI;
const TAU = Math.PI * 2;

const C = {
  pelle: '#fdecd6', pelleOmbra: '#f1d8c3',
  capelli: '#f1b56c', bianco: '#fdfcf7',
  azzurro: '#7cc9c8', salmone: '#f4a89c', salmoneScuro: '#dc8676',
  viola: '#7f7197', violaScuro: '#6c5f84', oro: '#ecc85c', legno: '#8d5c3b', stella: '#f9ee9f',
  pupilla: '#3a2926', bocca: '#ec8a72', boccaDentro: '#a44c47', lingua: '#ef8f8a',
  cane: '#f6e6b8', caneScuro: '#e8d3a0', orecchie: '#c88a55', macchia: '#cf9561',
  naso: '#4a3430', collare: '#86c0e2', muso: '#fbf2d8',
  gatto: '#f6eacf', gattoScuro: '#e9dab9', rosa: '#f2aaa6',
  giacca: '#9c6b45', giaccaScura: '#86593a', berretto: '#8a5c3c', pantaloni: '#aba4d9',
  pantaloniScuri: '#968ec8', scarpeLadro: '#4c3428', pelleLadro: '#f3d9bf', capelliLadro: '#7a5238',
};

/*  Gli spessori sono in pixel "veri": quando un personaggio è disegnato
 *  ingrandito (cane, gatto, ladro) la scala corrente SC li compensa.      */
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
 * Contorno "a mano": un tratto doppio steso PRIMA del colore e spostato di
 * un soffio verso il basso a sinistra. Il colore poi copre la metà interna:
 * resta una linea più sottile in alto a destra (luce) e più grassa in basso
 * a sinistra (ombra), come la china di un animatore.
 */
function contorno(ctx, pp, w) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = px(w * 2);
  ctx.translate(px(-0.6), px(0.65));
  for (const p of pp) ctx.stroke(p);
  ctx.restore();
}

/**
 * Secondo tono "cel": scurisce la falce del pezzo che resta scoperta quando
 * la sua sagoma viene spostata verso la luce (in alto a destra).
 */
function ombraCel(ctx, p, k, tono) {
  const fuori = new Path2D();
  fuori.rect(-5000, -5000, 10000, 10000);
  fuori.addPath(p, new DOMMatrix([1, 0, 0, 1, px(6.5 * k), px(-5 * k)]));
  ctx.save();
  ctx.clip(fuori, 'evenodd');          // pari/dispari = "fuori dalla sagoma spostata"
  ombreggia(ctx, p, p, tono || OMBRA);
  ctx.restore();
}

/**
 * Il "mattone" dei personaggi: una o più forme fuse in un'unica sagoma,
 * con contorno, tinta piatta e (se ombra > 0) il secondo tono.
 */
function pezzo(ctx, forme, colore, ombra = 1, w = LW, tono = OMBRA) {
  const pp = (Array.isArray(forme) ? forme : [forme]).map(percorso);
  contorno(ctx, pp, w);
  for (const p of pp) tinta(ctx, p, colore);
  if (ombra) ombraCel(ctx, pp[0], ombra, tono);
  return pp[0];
}

/** "Tubo" col contorno: braccia, gambe, zampe, code, cinghie, bastoni. */
function tubo(ctx, punti, larg, colore, w = LW, dritto = false) {
  const p = punti instanceof Path2D ? punti : dritto ? spezzata(punti) : Forme.curva(punti);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = larg + px(2 * w);
  ctx.translate(px(-0.55), px(0.6));
  ctx.stroke(p);
  ctx.translate(px(0.55), px(-0.6));
  ctx.strokeStyle = colore;
  ctx.lineWidth = larg;
  ctx.stroke(p);
  ctx.restore();
}

/** Tratto di dettaglio (pieghe, ciocche, bocche). */
function tratto(ctx, punti, w = 1.8, colore = INK, alfa = 1) {
  linea(ctx, Forme.curva(punti), { spessore: px(w), colore, alfa });
}

/**
 * Occhio come nel cartone: tondo bianco, linea sottile, puntino scuro.
 * g = [gx, gy] dove guarda (-1..1). stato: 'aperti', 'chiusi' (sbatte),
 * 'felici' (ad arco), 'socchiusi' (ascolta), 'strizzati' (> <).
 * dir = 1 o -1: verso della punta per gli occhi strizzati.
 */
function occhio(ctx, x, y, rx, ry, g, stato = 'aperti', dir = 1) {
  if (stato === 'chiusi') return tratto(ctx, [[x - rx * 0.95, y + 1], [x, y + ry * 0.42], [x + rx * 0.95, y + 1]], 2.1);
  if (stato === 'felici') return tratto(ctx, [[x - rx * 0.9, y + ry * 0.35], [x, y - ry * 0.5], [x + rx * 0.9, y + ry * 0.35]], 2.1);
  if (stato === 'strizzati') {
    return tratto(ctx, [[x - dir * rx * 0.8, y - ry * 0.6], [x + dir * rx * 0.65, y], [x - dir * rx * 0.8, y + ry * 0.6]], 2.1);
  }
  const p = Forme.ellisse(x, y, rx, ry);
  tinta(ctx, p, C.bianco);
  const r = Math.max(1.5, rx * 0.26);
  let gy = g[1];
  if (stato === 'socchiusi') gy = Math.max(gy, 0.45);
  tinta(ctx, Forme.cerchio(x + g[0] * (rx - r - 1.5), y + gy * (ry - r - 1.5), r), C.pupilla);
  if (stato === 'socchiusi') {              // palpebra calata a metà
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.rettangolo(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 0.95 + 2), C.pelle);
    ctx.restore();
    tratto(ctx, [[x - rx, y - ry * 0.02], [x, y - ry * 0.12], [x + rx, y - ry * 0.02]], 2.0);
  }
  linea(ctx, p, { spessore: px(1.75) });
}

/** Manina tonda; se aperta spuntano quattro ditini e il pollice (verso "dita"). */
function mano(ctx, x, y, r, dir, aperta, colore, dita) {
  if (aperta) {
    const d = dita === undefined ? dir : dita;
    for (let k = 0; k < 4; k++) {
      const a = d + (k - 1.5) * 0.3;
      tubo(ctx, [[x, y], [x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7]], r * 0.6, colore, 1.6);
    }
    const ap = d - 1.3;
    tubo(ctx, [[x, y], [x + Math.cos(ap) * r * 1.3, y + Math.sin(ap) * r * 1.3]], r * 0.64, colore, 1.6);
  }
  pezzo(ctx, Forme.ellisse(x, y, r, r * 0.9, dir), colore, 0, 1.9);
  if (!aperta) {
    const a = dir + 0.9;
    tratto(ctx, [[x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65], [x + Math.cos(dir) * r * 0.75, y + Math.sin(dir) * r * 0.75]], 1.2, INK2);
  }
}

/** Stella morbida a cinque punte (la bacchetta magica). */
function stellaMorbida(ctx, x, y, r, rot) {
  const punti = [];
  for (let k = 0; k < 10; k++) {
    const a = rot + (k * Math.PI) / 5, rr = k % 2 ? r * 0.56 : r;
    punti.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  pezzo(ctx, Forme.poligono(punti, true), C.stella, 0.5, 2.0);
}

/** Scintilla a quattro punte (magia, colpetti). */
function scintilla(ctx, x, y, r) {
  const q = r * 0.24;
  const p = Forme.poligono([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]]);
  tinta(ctx, p, '#fff6b0');
  linea(ctx, p, { spessore: px(1.3), colore: '#cf9a45' });
}

/** Bastone di legno tenuto in mano. Restituisce la punta. */
function bastone(ctx, x, y, ang, lung, lontano) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const fine = [x + c * lung, y + s * lung];
  const mezzo = [x + c * lung * 0.5 - s * 1.6, y + s * lung * 0.5 + c * 1.6];
  tubo(ctx, [[x - c * 14, y - s * 14], mezzo, fine], 4.4, lontano ? scurisci(C.legno, 0.1) : C.legno, 1.8);
  tratto(ctx, [[x + c * lung * 0.62 - s * 2, y + s * lung * 0.62 + c * 2], [x + c * lung * 0.62 - s * 6, y + s * lung * 0.62 + c * 6]], 1.6);
  return fine;
}

/** Bacchetta magica con la stella. Restituisce il centro della stella. */
function bacchetta(ctx, x, y, ang, lung) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const fine = [x + c * lung, y + s * lung];
  tubo(ctx, [[x - c * 8, y - s * 8], fine], 4.2, C.legno, 1.8);
  const st = [fine[0] + c * 9, fine[1] + s * 9];
  stellaMorbida(ctx, st[0], st[1], 14, ang);
  return st;
}

/** La borsetta tonda rosa (patta e bottoncino). */
function borsetta(ctx, x, y, r) {
  pezzo(ctx, Forme.ellisse(x, y, r * 1.12, r), C.salmone, 0.9);
  tratto(ctx, [[x - r * 0.98, y - r * 0.3], [x, y + r * 0.3], [x + r * 0.98, y - r * 0.3]], 1.7);
  pezzo(ctx, Forme.cerchio(x, y + r * 0.22, r * 0.16), C.salmoneScuro, 0, 1.4);
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
/*  Misure (pixel della cella, Lia alta ~306 px col cappellino):
 *    suole 0 · caviglie -16 · orlo del vestito ~-62 · bacino -78
 *    spalle ~-166 · mento ~-178 · occhi ~-218 · tesa ~-228 · cupola -306
 *  La testa col cappello è circa il 40% dell'altezza, come nel film.
 *  Il busto si disegna in un sistema che ha l'origine nel bacino e ruota
 *  (inclinazione); la testa in un sistema con l'origine sul colletto.      */

const ABITI = {
  borsa: { vestito: C.azzurro, strega: false, borsa: true, oggetto: null },
  semplice: { vestito: C.azzurro, strega: false, borsa: false, oggetto: 'bastone' },
  strega: { vestito: C.viola, strega: true, borsa: false, oggetto: 'bacchetta' },
};
const ANCA = -78;                     // altezza del bacino
const COSCIA = 35;                    // coscia = stinco
const OMERO = 27, AVAMBRACCIO = 26;
const GEO_LIA = { cav: 16, tal: 12, pun: 34 };
const SPALLE_LATO = [[-3, -88], [4, -88]];       // [lontana, vicina]
const ANCHE_LATO = [[-3, -2], [3, -2]];
const SPALLE_FRONTE = [[-20, -87], [20, -87]];   // [sinistra dello schermo, destra]
const ANCHE_FRONTE = [[-9, -2], [9, -2]];
const COLLO = [2, -100];                         // dove poggia la testa (coordinate del busto)
const LUNG_BASTONE = 124, LUNG_BACCHETTA = 46;

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
    x: 0, bob: 0, incl: 0.03, testa: 0, testaDx: 0, testaDy: 0, cappello: 0,
    piedi: [{ x: -8, y: -16, rot: 0 }, { x: 6, y: -16, rot: 0 }],
    braccia: [braccioA(SPALLE_LATO[0], 0.05, 0.2), braccioA(SPALLE_LATO[1], 0.1, 0.32)],
    capelli: [0, 0], orlo: [0, 0, 0, 0], borsa: [0, 0], orloMondo: null, accucciata: false,
    occhi: 'aperti', sguardo: [0.6, -0.55], bocca: 'chiusa', oggetto: null, effetto: null,
  };
  // l'oggetto (bastone o bacchetta) di solito sta nella mano vicina
  if (og === 'bastone') { P.braccia[1] = braccioA(SPALLE_LATO[1], 0.38, 0.82); P.oggetto = { tipo: og, mano: 1, ang: 1.12 }; }
  if (og === 'bacchetta') { P.braccia[1] = braccioA(SPALLE_LATO[1], 0.22, 1.3); P.oggetto = { tipo: og, mano: 1, rel: -2.15 }; }

  if (posa === 'fermo') {
    const b = 0.5 - 0.5 * ondaC(t);              // respiro: 0 → 1 → 0
    P.bob = -1.3 * b;
    P.testaDy = -0.6 * b;
    P.testa = -0.015 * b;
    P.capelli = [0, 1.0 * b];
    P.braccia[0] = braccioA(SPALLE_LATO[0], 0.05 + 0.03 * b, 0.2 + 0.04 * b);
    if (!og) P.braccia[1] = braccioA(SPALLE_LATO[1], 0.1 + 0.03 * b, 0.32 + 0.04 * b);
    if (Math.abs(t - 0.5) < 0.01) P.occhi = 'chiusi';   // un battito di ciglia
    P.sguardo = [0.6, -0.5 - 0.2 * b];
  }

  if (posa === 'cammina') {
    const A0 = 21, S = 0.56;
    P.piedi = [passo(t + 0.5, A0, S, 10, -0.22, 0.45, GEO_LIA), passo(t, A0, S, 10, -0.22, 0.45, GEO_LIA)];
    const giu = ondaC(2 * (t - 0.07));           // +1 = baricentro in basso (subito dopo il contatto)
    P.bob = 1.7 * giu;
    P.incl = 0.05 + 0.012 * giu;
    P.testa = 0.025 * onda(2 * (t - 0.18));
    P.testaDy = 0.8 * ondaC(2 * (t - 0.16));
    const f = -0.42 * ondaC(t - 0.06);           // braccio vicino: indietro quando il piede vicino è avanti
    P.braccia[0] = braccioA(SPALLE_LATO[0], -f, -f + 0.2 + 0.3 * Math.max(0, -f / 0.42));
    if (og === 'bastone') {                       // il bastone tasta la strada davanti
      P.braccia[1] = braccioA(SPALLE_LATO[1], 0.4 + 0.03 * giu, 0.84 + 0.05 * onda(2 * t));
      P.oggetto.ang = 1.1 + 0.05 * onda(2 * t - 0.1);
    } else P.braccia[1] = braccioA(SPALLE_LATO[1], f, f + 0.2 + 0.3 * Math.max(0, f / 0.42));
    P.capelli = [-1 + 1.3 * onda(2 * (t - 0.22)), 2 * ondaC(2 * (t - 0.25))];
    P.orlo = [2 * onda(t - 0.12), 1.2 * ondaC(2 * (t - 0.2)), -1.5 + 2.8 * onda(t - 0.2), 1.8 * ondaC(2 * (t - 0.25))];
    P.borsa = [-2 + 2.5 * onda(t - 0.2), 2.6 * ondaC(2 * (t - 0.24))];
  }

  if (posa === 'corre') {
    const A0 = 29, S = 0.36;
    P.x = -10;
    P.piedi = [passo(t + 0.5, A0, S, 24, -0.15, 0.62, GEO_LIA), passo(t, A0, S, 24, -0.15, 0.62, GEO_LIA)];
    for (const p of P.piedi) p.x += P.x + 4;
    const giu = ondaC(2 * (t - 0.17));
    P.bob = 3.6 * giu - 1.5;
    P.incl = 0.19 + 0.025 * giu;
    P.testa = -0.13 + 0.03 * onda(2 * (t - 0.2));
    P.testaDy = 1.3 * ondaC(2 * (t - 0.26));
    const f = -0.85 * ondaC(t - 0.04);
    P.braccia[0] = braccioA(SPALLE_LATO[0], -f, -f + 1.55);
    P.braccia[1] = braccioA(SPALLE_LATO[1], f, f + 1.55);
    if (og) P.oggetto = { tipo: og, mano: 1, rel: og === 'bastone' ? 0.35 : -2.15 };
    P.capelli = [-9 + 2 * onda(2 * (t - 0.3)), -5 + 2.5 * ondaC(2 * (t - 0.3))];
    P.orlo = [-6 + 2 * onda(2 * (t - 0.15)), -2, -11 + 3 * onda(2 * (t - 0.25)), -6 + 2.5 * ondaC(2 * (t - 0.3))];
    P.borsa = [-10 + 2 * onda(2 * (t - 0.3)), -8 + 3 * ondaC(2 * (t - 0.3))];
    P.cappello = -0.07;
    P.bocca = 'o';
    P.sguardo = [0.85, -0.35];
  }

  if (posa === 'tocca') {
    const k = Math.round(t * 4) % 4;             // 0 alza, 1 colpo, 2 rimbalzo (3 = riposo)
    P.incl = 0.07;
    P.testa = 0.05;
    P.piedi = [{ x: -10, y: -16, rot: 0 }, { x: 10, y: -16, rot: 0 }];
    if (og === 'bastone') {
      P.braccia[1] = { m: [[38, -138], [34, -116], [36, -126]][k], mondo: true };
      P.oggetto.ang = [1.0, 1.13, 1.07][k];
      P.effetto = k === 1 ? 'tac' : null;
      P.bocca = k === 1 ? 'o' : 'chiusa';
      P.sguardo = [0.7, -0.7];
      P.capelli = [[0, -1.5], [-1, 2], [0, 0.5]][k];
    } else if (og === 'bacchetta') {
      P.incl = [0.0, 0.26, 0.18][k];
      P.braccia[1] = { m: [[34, -206], [56, -114], [54, -126]][k], mondo: true };
      P.oggetto = { tipo: og, mano: 1, ang: [-1.75, 1.2, 0.8][k] };
      P.effetto = ['scia', 'magia', 'magiaPiccola'][k];
      P.bocca = k === 1 ? 'sorriso' : 'chiusa';
      P.sguardo = [0.8, k ? 0.5 : -0.9];
      P.capelli = [[0, -2], [-2, 2.5], [-1, 1]][k];
      P.braccia[0] = braccioA(SPALLE_LATO[0], [-0.3, 0.2, 0.1][k], [-0.1, 0.5, 0.35][k]);
    } else {                                      // borsa: le mani avanti "tastano" l'aria
      P.braccia = [
        { m: [[32, -146], [46, -158], [44, -148]][k], mondo: true, aperta: true, dita: [-0.4, -0.15, -0.3][k] },
        { m: [[38, -136], [56, -150], [54, -140]][k], mondo: true, aperta: true, dita: [-0.2, 0.0, 0.15][k] },
      ];
      P.incl = [0.05, 0.09, 0.08][k];
      P.sguardo = [0.4, -0.9];
      P.bocca = 'o';
      P.testa = -0.06;
      P.piedi[1] = { x: 14, y: -16, rot: 0 };
    }
  }

  if (posa === 'ascolta') {
    const k = Math.round(t * 2) % 2, W = 76;      // W = dove sta la parete (a destra)
    P.x = -6;
    P.incl = 0.2 + 0.02 * k;
    P.testa = 0.08 + 0.02 * k;
    P.testaDx = 4;
    P.piedi = [{ x: -30, y: -16, rot: 0 }, piedeInPunta(14, 0.3, GEO_LIA)];
    P.braccia = [
      { m: [W - 7, -212], mondo: true, aperta: true, dita: -1.5 },
      { m: [W - 7, -168 + k], mondo: true, aperta: true, dita: -1.45 },
    ];
    if (og) P.oggetto = { tipo: og, mano: 0, ang: og === 'bastone' ? 1.5 : 1.35 };
    P.occhi = k ? 'socchiusi' : 'aperti';
    P.sguardo = k ? [-0.4, 0.4] : [-0.3, -0.9];
    P.bocca = k ? 'chiusa' : 'o';
    P.cappello = A.strega ? -0.3 : -0.18;
    P.capelli = [-1.5, 1];
    P.orlo = [-2, 0, 2, 0];
  }

  if (posa === 'china') {                         // accovacciata per toccare qualcosa in basso
    const k = Math.round(t * 2) % 2;
    P.x = -16;
    P.bob = 42;
    P.incl = 0.3;
    P.testa = 0.1 + 0.04 * k;
    P.piedi = [{ x: -26, y: -16, rot: 0 }, piedeInPunta(30, 0.3, GEO_LIA)];
    P.braccia[1] = { m: k ? [86, -34] : [80, -46], mondo: true, aperta: true, dita: k ? 0.35 : 0.6 };
    P.braccia[0] = { m: [22, -56], mondo: false, aperta: false };
    if (og) P.oggetto = { tipo: og, mano: 0, ang: og === 'bastone' ? 2.6 : -1.15 };
    P.accucciata = true;
    P.sguardo = [0.75, 0.6];
    P.bocca = k ? 'sorriso' : 'chiusa';
    P.capelli = [1, 1.5];
  }

  if (posa === 'sorpresa') {
    P.x = -4;
    P.incl = -0.07;
    P.bob = -2;
    P.testa = -0.08;
    P.piedi = [{ x: -22, y: -16, rot: 0 }, { x: 14, y: -16, rot: 0 }];
    P.braccia = [
      { m: [-36, -206], mondo: true, aperta: true, dita: -2.2 },
      { m: [42, -200], mondo: true, aperta: true, dita: -0.9 },
    ];
    if (og) P.oggetto = { tipo: og, mano: 1, ang: og === 'bastone' ? -1.2 : -1.35 };
    P.sguardo = [0.15, -0.15];
    P.bocca = 'aperta';
    P.capelli = [0, -3.5];
    P.cappello = -0.05;
    P.orlo = [0, -2, 0, -2];
  }

  if (posa === 'urto') {                          // ha appena sbattuto: passo indietro, mano sulla fronte
    P.x = -8;
    P.incl = -0.15;
    P.bob = -1;
    P.testa = -0.12;
    P.piedi = [{ x: -36, y: -16, rot: 0 }, piedeSulTallone(-6, -0.3, GEO_LIA)];
    P.braccia = [
      { m: [-52, -150], mondo: true, aperta: true, dita: -2.6 },
      { m: [12, -214], mondo: true, aperta: true, dita: -2.0 },
    ];
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
    x: 0, bob: 0, incl: 0, testa: 0, testaDx: 0, testaDy: 0, cappello: 0,
    piedi: [{ x: -13, y: -16, s: 1, alza: 0 }, { x: 13, y: -16, s: 1, alza: 0 }],
    braccia: [{ m: [-29, -44] }, { m: [29, -44] }],
    capelli: [0, 0], orlo: 0, borsa: [0, 0],
    occhi: 'aperti', sguardo: [0.3, -0.55], bocca: 'chiusa', oggetto: null,
  };
  const sgn = io ? 1 : -1;
  if (og === 'bastone') { P.braccia[io] = { m: [sgn * 33, -46] }; P.oggetto = { tipo: og, mano: io, ang: io ? 1.16 : 1.98 }; }
  if (og === 'bacchetta') { P.braccia[io] = { m: [sgn * 35, -60] }; P.oggetto = { tipo: og, mano: io, ang: io ? -1.05 : -2.1 }; }

  if (posa === 'fermo') {
    const b = t > 0.25 ? 1 : 0;
    P.bob = -1.4 * b;
    P.testaDy = -0.7 * b;
    P.capelli = [0, 1.1 * b];
    P.braccia[1 - io].m = [(io ? -1 : 1) * (29 + b), -44 - b];
    P.sguardo = [0.3, -0.55 - 0.2 * b];
  }
  if (posa === 'sorpresa') {
    P.bob = -2;
    P.piedi = [{ x: -17, y: -16, s: 1, alza: 0 }, { x: 17, y: -16, s: 1, alza: 0 }];
    P.braccia = [{ m: [-48, -128], aperta: true, dita: -2.2 }, { m: [48, -128], aperta: true, dita: -0.95 }];
    if (og) P.oggetto.ang = io ? -1.1 : -2.05;
    P.bocca = 'aperta';
    P.sguardo = [0, -0.1];
    P.capelli = [0, -3];
  }
  if (posa === 'saluta') {
    const k = Math.round(t * 2) % 2;
    const lib = 1 - io;                          // saluta con la mano libera
    P.braccia[lib] = { m: [(lib ? 1 : -1) * (40 + 8 * k), -132 + 6 * k], aperta: true, dita: lib ? -1.25 + 0.45 * k : -1.9 - 0.45 * k };
    P.bocca = 'sorriso';
    P.occhi = k ? 'felici' : 'aperti';
    P.sguardo = [0.2, -0.4];
    P.testa = k ? 0.05 : -0.03;
  }
  if (posa === 'cammina') {
    const u = TAU * t, d0 = Math.cos(u), d1 = -d0;   // +1 = piede avanti
    const dir = retro ? -1 : 1;                      // di spalle "avanti" è più in alto
    const l0 = retro ? 0 : Math.max(0, -Math.sin(u)), l1 = retro ? 0 : Math.max(0, Math.sin(u));
    P.piedi = [
      { x: -12, y: -16 + dir * 3 * d0 - 9 * l0, s: 1 + dir * 0.05 * d0, alza: Math.max(0, -d0) * 0.8 },
      { x: 12, y: -16 + dir * 3 * d1 - 9 * l1, s: 1 + dir * 0.05 * d1, alza: Math.max(0, -d1) * 0.8 },
    ];
    P.bob = retro ? 1.5 * Math.abs(d0) : 1.6 * Math.cos(2 * u);
    P.x = retro ? -1.5 * d0 : -1.8 * Math.sin(u);
    P.incl = retro ? -0.012 * d0 : -0.015 * Math.sin(u);
    P.testa = retro ? 0.02 * d0 : -0.025 * Math.sin(u - 0.5);
    P.testaDy = 0.7 * Math.cos(2 * u - 0.8);
    if (io !== 0 || !og) P.braccia[0].m = [-29 + 2 * d1, -44 + 3 * dir * d1];
    if (io !== 1 || !og) P.braccia[1].m = [29 - 2 * d0, -44 + 3 * dir * d0];
    P.capelli = [1.2 * Math.sin(u - 0.9), 1.6 * Math.cos(2 * u - 1.1)];
    P.orlo = 2 * Math.sin(u - 0.6);
    P.borsa = [1.5 * Math.sin(u - 0.8), 1.8 * Math.cos(2 * u - 1)];
  }
  return P;
}

/* ---------------- pezzi del vestito ---------------- */

/** Vestitino ad A di lato (azzurro, o viola per la streghetta), con orlo mobile. */
function vestitoLato(ctx, A, P, ginocchio, orloMondo) {
  let av = [40 + P.orlo[0], 15 + P.orlo[1]], di = [-54 + P.orlo[2], 13 + P.orlo[3]];
  let ctrl = [22, -40];
  if (orloMondo) { av = orloMondo[0]; di = orloMondo[1]; }
  if (ginocchio) ctrl = [ginocchio[0] + 2, ginocchio[1] - 22];
  const p = new Path2D();
  p.moveTo(-9, -101);
  p.quadraticCurveTo(-18, -100, -18, -86);
  p.quadraticCurveTo(-23, -42, di[0], di[1]);
  p.bezierCurveTo(di[0] + 20, di[1] + 7, av[0] - 24, av[1] + 7, av[0], av[1]);
  p.quadraticCurveTo(ctrl[0], ctrl[1], 15, -86);
  p.quadraticCurveTo(15, -100, 8, -101);
  p.closePath();
  pezzo(ctx, p, A.vestito, 1.3);
  // pieghe morbide che seguono l'orlo
  const m1 = lerp2(di, av, 0.3), m2 = lerp2(di, av, 0.68);
  tratto(ctx, [[-6, -64], [-10, -24], [m1[0], m1[1] + 3]], 1.5, INK2);
  tratto(ctx, [[7, -54], [9, -16], [m2[0], m2[1] + 4]], 1.5, INK2);
}

/** Le mutandine bianche a balze che spuntano sotto il vestito da strega. */
function mutandineLato(ctx) {
  pezzo(ctx, Forme.poligono([[-30, -8], [24, -8], [30, 21], [19, 18], [9, 23], [-3, 19], [-15, 24], [-27, 19], [-36, 22]], true), C.bianco, 0.6, 2.1, OMBRA_FREDDA);
}
function mutandineFronte(ctx) {
  pezzo(ctx, Forme.poligono([[-40, -8], [40, -8], [44, 21], [30, 18], [16, 23], [0, 19], [-16, 23], [-30, 18], [-44, 21]], true), C.bianco, 0.6, 2.1, OMBRA_FREDDA);
}

/** Colletto bianco "alla Peter Pan". */
function collettoLato(ctx) {
  pezzo(ctx, [Forme.ellisse(5, -98, 12, 5.6, 0.3), Forme.ellisse(-7, -99.5, 8, 4.2, -0.15)], C.bianco, 0.5, 2.1, OMBRA_FREDDA);
}
function collettoFronte(ctx, retro) {
  if (retro) { pezzo(ctx, Forme.ellisse(0, -99, 17, 5.2), C.bianco, 0.5, 2.1, OMBRA_FREDDA); return; }
  pezzo(ctx, [Forme.ellisse(-9, -97.5, 11.5, 6.2, 0.32), Forme.ellisse(9, -97.5, 11.5, 6.2, -0.32)], C.bianco, 0.5, 2.1, OMBRA_FREDDA);
  tratto(ctx, [[0, -102], [0, -94]], 1.4, INK2);
  pezzo(ctx, Forme.cerchio(0, -86, 2.4), C.bianco, 0, 1.4);
}

/** Mantellina viola con il colletto tondo e il bottone d'oro. */
function mantellinaLato(ctx) {
  const p = new Path2D();
  p.moveTo(-8, -103);
  p.quadraticCurveTo(-31, -100, -33, -66);
  p.quadraticCurveTo(-20, -57, -6, -64);
  p.quadraticCurveTo(9, -56, 25, -66);
  p.quadraticCurveTo(25, -96, 8, -103);
  p.closePath();
  pezzo(ctx, p, C.violaScuro, 1.2);
  tratto(ctx, [[-14, -84], [-18, -66]], 1.4, INK2);
  pezzo(ctx, Forme.ellisse(5, -97, 14, 7.5, 0.22), C.violaScuro, 0.5);
  pezzo(ctx, Forme.cerchio(16, -92, 3.4), C.oro, 0, 1.5);
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
  pezzo(ctx, p, C.violaScuro, 1.2);
  if (retro) { pezzo(ctx, Forme.ellisse(0, -99, 20, 8), C.violaScuro, 0.5); return; }
  tratto(ctx, [[-22, -84], [-26, -68]], 1.4, INK2);
  tratto(ctx, [[22, -84], [26, -68]], 1.4, INK2);
  pezzo(ctx, [Forme.ellisse(-10, -97, 13, 7.5, 0.32), Forme.ellisse(10, -97, 13, 7.5, -0.32)], C.violaScuro, 0.5);
  pezzo(ctx, Forme.cerchio(0, -93, 3.6), C.oro, 0, 1.5);
}

/** Manica a sbuffo sulla spalla, orientata come il braccio. */
function manica(ctx, spalla, g, colore, lontano) {
  const a = Math.atan2(g[1] - spalla[1], g[0] - spalla[0]);
  const c = [spalla[0] + Math.cos(a) * 6, spalla[1] + Math.sin(a) * 6];
  pezzo(ctx, Forme.ellisse(c[0], c[1], 12, 10, a), lontano ? scurisci(colore, 0.08) : colore, 0.8);
  const e = [c[0] + Math.cos(a) * 9, c[1] + Math.sin(a) * 9], n = [-Math.sin(a), Math.cos(a)];
  tratto(ctx, [[e[0] + n[0] * 7, e[1] + n[1] * 7], [e[0] + Math.cos(a) * 2, e[1] + Math.sin(a) * 2], [e[0] - n[0] * 7, e[1] - n[1] * 7]], 1.3, INK2);
}

/**
 * Un braccio di Lia (manica, mano, eventuale bastone/bacchetta).
 * b = { m: mano, g: gomito (facoltativo), aperta, dita }.
 * Restituisce la punta dell'oggetto, se c'è.
 */
function braccioLia(ctx, A, spalla, b, o) {
  const m = b.m;
  const g = b.g || ginocchio(spalla, m, (OMERO + AVAMBRACCIO) / 2, o.lato === undefined ? -1 : o.lato);
  const pelle = o.lontano ? C.pelleOmbra : C.pelle;
  if (o.soloAvambraccio) tubo(ctx, [lerp2(g, m, 0.05), m], 7, pelle);
  else {
    tubo(ctx, arco(spalla, g, m), 7, pelle);
    if (!A.strega) manica(ctx, spalla, g, A.vestito, o.lontano);
  }
  const dir = Math.atan2(m[1] - g[1], m[0] - g[0]);
  let punta = null;
  if (o.oggetto) {
    const og = o.oggetto;
    const ang = og.ang !== undefined ? og.ang - (o.incl || 0) : dir + og.rel;
    punta = og.tipo === 'bastone' ? bastone(ctx, m[0], m[1], ang, LUNG_BASTONE, o.lontano) : bacchetta(ctx, m[0], m[1], ang, LUNG_BACCHETTA);
  }
  mano(ctx, m[0], m[1], 6.2, dir, b.aperta, pelle, b.dita === undefined ? undefined : b.dita - (o.incl || 0));
  return punta;
}

/** Tracolla e borsetta tonda, che dondola un po' in ritardo (di lato). */
function borsaLato(ctx, P) {
  const c = [12 + P.borsa[0], -26 + P.borsa[1]];
  tubo(ctx, [[2, -99], [8, -64], [c[0] - 1, c[1] - 12]], 2.6, C.salmoneScuro, 1.7);
  borsetta(ctx, c[0], c[1], 14);
}
function borsaFronte(ctx, P, retro) {
  const s = retro ? -1 : 1;
  const c = [s * 31 + P.borsa[0], -24 + P.borsa[1]];
  tubo(ctx, [[-s * 16, -99], [s * 4, -70], [c[0] - s * 4, c[1] - 12]], 2.6, C.salmoneScuro, 1.7);
  borsetta(ctx, c[0], c[1], 13.5);
}

/* ---------------- scarpe ---------------- */

/** Scarpa tonda (o stivaletto viola) di lato: il disegno ha l'origine nella caviglia. */
function scarpaLato(ctx, A, pd, lontano) {
  ctx.save();
  ctx.translate(pd.x, pd.y);
  ctx.rotate(pd.rot);
  const base = A.strega ? C.viola : C.bianco;
  const col = lontano ? scurisci(base, 0.07) : base;
  const p = new Path2D();
  p.moveTo(-12, 12);
  p.bezierCurveTo(-15, 2, -10, -5, -3, -5);        // tallone
  p.lineTo(5, -4.5);                               // bocca della scarpa
  p.bezierCurveTo(13, -4, 16, -10, 26, -9);        // collo del piede
  p.bezierCurveTo(40, -8, 43, 10, 34, 16);         // punta tonda
  p.lineTo(-7, 16);
  p.quadraticCurveTo(-12, 16, -12, 12);
  p.closePath();
  pezzo(ctx, p, col, 0.8, LW, A.strega ? OMBRA : OMBRA_FREDDA);
  tratto(ctx, [[-9, 12.5], [32, 12.5]], 1.1, INK2);
  if (A.strega) {                                  // risvolto arricciato a punte
    pezzo(ctx, Forme.poligono([[-11, -1], [-19, -15], [-8, -9], [-1, -21], [5, -9], [16, -15], [10, 0]], true), col, 0.5, 2.0);
  } else {                                         // cinturino col bottoncino
    tratto(ctx, [[1, -5], [7, 0], [12, 3]], 1.8);
    pezzo(ctx, Forme.cerchio(12.5, 3.5, 2.1), col, 0, 1.3);
  }
  ctx.restore();
}

/** Scarpa vista di fronte o da dietro; alza 0..1 = tallone sollevato. */
function scarpaFronte(ctx, A, pd, retro) {
  ctx.save();
  ctx.translate(pd.x, pd.y);
  ctx.scale(pd.s || 1, pd.s || 1);
  const al = pd.alza || 0;
  const col = A.strega ? C.viola : C.bianco;
  const tono = A.strega ? OMBRA : OMBRA_FREDDA;
  pezzo(ctx, Forme.ellisse(0, 7 - al * 2, 14, 10 - al * 3), col, 0.8, LW, tono);
  if (A.strega) pezzo(ctx, Forme.poligono([[-10, 0], [-17, -11], [-6, -6], [0, -15], [6, -6], [17, -11], [10, 0]], true), col, 0.5, 2.0);
  else if (!retro) {
    tratto(ctx, [[-9, 0], [0, 2.5], [9, 0]], 1.7);
    pezzo(ctx, Forme.cerchio(8, 0.5, 1.9), col, 0, 1.2);
  } else tratto(ctx, [[-8, 11 - al * 2], [0, 13 - al * 3], [8, 11 - al * 2]], 1.3, INK2);
  ctx.restore();
}

/* ---------------- testa ---------------- */

/** Ruota il cappello attorno al centro della testa (pose in cui scivola). */
function sistemaCappello(ctx, P) {
  ctx.translate(-2, -50);
  ctx.rotate(P.cappello);
  ctx.translate(2, 50);
}

/** Testa di profilo: viso tondo col nasino, occhio, caschetto, cappello. */
function testaLato(ctx, A, P) {
  const [hx, hy] = P.capelli;
  const forme = [Forme.cerchio(-2, -50, 46), Forme.ellisse(18, -27, 34, 26), Forme.ellisse(53, -33, 5, 4.6)];
  pezzo(ctx, forme, C.pelle, 0);
  // caschetto dietro (dal sopra dell'orecchio fino al taglio dritto)
  const dietro = new Path2D();
  dietro.moveTo(12, -64);
  dietro.quadraticCurveTo(-2, -52, -5, -40);
  dietro.quadraticCurveTo(-10, -22, -5 + hx * 0.6, -5 + hy);
  dietro.lineTo(-60 + hx, -7 + hy);
  dietro.quadraticCurveTo(-56, -38, -50, -70);
  dietro.quadraticCurveTo(-20, -82, 12, -64);
  dietro.closePath();
  pezzo(ctx, dietro, C.capelli, 1);
  for (let k = 0; k < 6; k++) {                    // le punte tagliate dritte
    const x = lerp(-54, -10, k / 5) + hx * 0.9;
    tratto(ctx, [[x, -6 + hy], [x + 0.6, -14 + hy]], 1.4, INK2);
  }
  tratto(ctx, [[-30, -60], [-33, -30], [-34 + hx * 0.5, -16 + hy]], 1.4, INK2);
  // orecchio
  pezzo(ctx, Forme.ellisse(-8, -33, 7, 9), C.pelle, 0, 2.0);
  tratto(ctx, [[-6, -38], [-11, -33], [-6, -28]], 1.3, INK2);
  // ciocca davanti all'orecchio
  const ciocca = new Path2D();
  ciocca.moveTo(1, -60);
  ciocca.lineTo(22, -60);
  ciocca.quadraticCurveTo(25, -32, 21 + hx * 0.4, -3 + hy * 0.7);
  ciocca.lineTo(1 + hx * 0.4, -3 + hy * 0.7);
  ciocca.quadraticCurveTo(0, -32, 1, -60);
  ciocca.closePath();
  pezzo(ctx, ciocca, C.capelli, 0.7);
  for (const x of [6, 11, 16]) tratto(ctx, [[x + hx * 0.4, -4 + hy * 0.7], [x + hx * 0.4, -11 + hy * 0.7]], 1.3, INK2);
  // ombra calda della tesa sul viso e sui capelli
  ctx.save();
  ctx.clip(unione([...forme, dietro, ciocca]));
  sistemaCappello(ctx, P);
  tinta(ctx, (p) => { p.moveTo(-90, -140); p.lineTo(90, -140); p.lineTo(90, -50); p.lineTo(66, -51); p.quadraticCurveTo(-2, -34, -70, -43); p.lineTo(-90, -43); p.closePath(); }, OMBRA_TESA);
  ctx.restore();
  // occhio e bocca
  occhio(ctx, 36, -40, 8.8, 10.4, P.sguardo, P.occhi, 1);
  boccaLato(ctx, P.bocca);
  // cappello
  ctx.save();
  sistemaCappello(ctx, P);
  if (A.strega) cappelloStregaLato(ctx); else clocheLato(ctx);
  ctx.restore();
}

function boccaLato(ctx, tipo) {
  if (tipo === 'chiusa') tratto(ctx, [[42, -14.5], [45.5, -16], [49, -15]], 1.8);
  else if (tipo === 'sorriso') tratto(ctx, [[39, -19], [44, -14], [49.5, -18]], 1.9);
  else if (tipo === 'o') {
    const p = Forme.ellisse(47, -16, 3.4, 4.2);
    tinta(ctx, p, C.bocca);
    linea(ctx, p, { spessore: px(1.7) });
  } else {
    const p = new Path2D();
    p.moveTo(38, -23);
    p.quadraticCurveTo(46, -26, 53, -22);
    p.quadraticCurveTo(53, -8, 45, -7);
    p.quadraticCurveTo(38, -9, 38, -23);
    p.closePath();
    tinta(ctx, p, C.boccaDentro);
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.ellisse(47, -7, 7, 4.5), C.lingua);
    ctx.restore();
    linea(ctx, p, { spessore: px(1.8) });
  }
}

/** Testa di fronte (o la nuca, se retro). */
function testaFronte(ctx, A, P, retro) {
  const [hx, hy] = P.capelli;
  if (retro) {
    const p = new Path2D();
    p.moveTo(-48, -84);
    p.quadraticCurveTo(-64, -72, -62, -40);
    p.lineTo(-61 + hx, -3 + hy);
    p.lineTo(61 + hx, -3 + hy);
    p.lineTo(62, -40);
    p.quadraticCurveTo(64, -72, 48, -84);
    p.closePath();
    pezzo(ctx, p, C.capelli, 1);
    for (let k = 0; k < 9; k++) {
      const x = lerp(-54, 54, k / 8) + hx;
      tratto(ctx, [[x, -4 + hy], [x, -13 + hy]], 1.4, INK2);
    }
    tratto(ctx, [[-22, -60], [-24, -30], [-26 + hx, -16 + hy]], 1.4, INK2);
    tratto(ctx, [[22, -60], [24, -30], [26 + hx, -16 + hy]], 1.4, INK2);
  } else {
    // caschetto dietro la testa
    const dietro = new Path2D();
    dietro.moveTo(-50, -82);
    dietro.quadraticCurveTo(-63, -72, -62, -40);
    dietro.lineTo(-61 + hx, -3 + hy);
    dietro.lineTo(61 + hx, -3 + hy);
    dietro.lineTo(62, -40);
    dietro.quadraticCurveTo(63, -72, 50, -82);
    dietro.closePath();
    pezzo(ctx, dietro, C.capelli, 1);
    // viso tondo
    const viso = Forme.ellisse(0, -37, 47, 37);
    pezzo(ctx, viso, C.pelle, 0);
    // frangetta dritta e ciocche ai lati
    const frangia = Forme.poligono([[-40, -70], [40, -70], [40, -52], [-40, -52]]);
    const ciocche = [-1, 1].map((s) => {
      const p = new Path2D();
      p.moveTo(s * 32, -66);
      p.lineTo(s * 62, -68);
      p.quadraticCurveTo(s * 65, -36, s * 62 + hx, -3 + hy);
      p.lineTo(s * 39 + hx, -3 + hy);
      p.quadraticCurveTo(s * 35, -32, s * 32, -66);
      p.closePath();
      return p;
    });
    pezzo(ctx, frangia, C.capelli, 0);
    for (let k = 0; k < 9; k++) {
      const x = lerp(-34, 34, k / 8);
      tratto(ctx, [[x, -52], [x, -57]], 1.2, INK2);
    }
    ciocche.forEach((p, i) => {
      const s = i ? 1 : -1;
      pezzo(ctx, p, C.capelli, i ? 0 : 0.7);
      for (const d of [0.25, 0.5, 0.75]) {
        const x = lerp(s * 39, s * 62, d) + hx;
        tratto(ctx, [[x, -4 + hy], [x, -12 + hy]], 1.3, INK2);
      }
    });
    // ombra calda della tesa
    ctx.save();
    ctx.clip(unione([viso, dietro, frangia, ...ciocche]));
    sistemaCappello(ctx, P);
    tinta(ctx, (p) => { p.moveTo(-90, -140); p.lineTo(90, -140); p.lineTo(90, -45); p.quadraticCurveTo(0, -40, -90, -45); p.closePath(); }, OMBRA_TESA);
    ctx.restore();
    // occhi, nasino, bocca
    occhio(ctx, -19.5, -40, 9.6, 10.8, P.sguardo, P.occhi, 1);
    occhio(ctx, 19.5, -40, 9.6, 10.8, P.sguardo, P.occhi, -1);
    tratto(ctx, [[-3.6, -25.5], [0, -29.3], [3.6, -25.5]], 1.7);
    boccaFronte(ctx, P.bocca);
  }
  ctx.save();
  sistemaCappello(ctx, P);
  if (A.strega) cappelloStregaFronte(ctx, retro); else clocheFronte(ctx);
  ctx.restore();
}

function boccaFronte(ctx, tipo) {
  const y = -14;
  if (tipo === 'chiusa') tratto(ctx, [[-4.2, y + 0.8], [0, y - 0.9], [4.2, y + 0.8]], 1.8);
  else if (tipo === 'sorriso') tratto(ctx, [[-9, y - 3], [0, y + 3.5], [9, y - 3]], 1.9);
  else if (tipo === 'o') {
    const p = Forme.ellisse(0, y, 4.2, 5);
    tinta(ctx, p, C.bocca);
    linea(ctx, p, { spessore: px(1.7) });
  } else {
    const p = Forme.ellisse(0, y + 1, 8, 9);
    tinta(ctx, p, C.boccaDentro);
    ctx.save();
    ctx.clip(p);
    tinta(ctx, Forme.ellisse(0, y + 8, 6, 4), C.lingua);
    ctx.restore();
    linea(ctx, p, { spessore: px(1.8) });
  }
}

/* ---------------- cappelli ---------------- */

/** Cappellino a campana di lato: cupola, fascia salmone, tesa che scende. */
function clocheLato(ctx) {
  const cupola = new Path2D();
  cupola.moveTo(-50, -63);
  cupola.bezierCurveTo(-57, -110, -30, -127, -2, -127);
  cupola.bezierCurveTo(27, -127, 57, -110, 50, -67);
  cupola.quadraticCurveTo(0, -57, -50, -63);
  cupola.closePath();
  pezzo(ctx, cupola, C.bianco, 1.4, LW, OMBRA_FREDDA);
  ctx.save();
  ctx.clip(cupola);
  const fascia = new Path2D();
  fascia.moveTo(-80, -59);
  fascia.quadraticCurveTo(0, -50, 80, -66);
  fascia.lineTo(80, -86);
  fascia.quadraticCurveTo(0, -71, -80, -79);
  fascia.closePath();
  tinta(ctx, fascia, C.salmone);
  ombraCel(ctx, fascia, 1.2);
  linea(ctx, (p) => { p.moveTo(-80, -79); p.quadraticCurveTo(0, -71, 80, -86); }, { spessore: px(1.9) });
  ctx.restore();
  const tesa = new Path2D();
  tesa.moveTo(-50, -64);
  tesa.lineTo(-69, -49);
  tesa.quadraticCurveTo(-2, -41, 67, -57);
  tesa.lineTo(50, -68);
  tesa.quadraticCurveTo(0, -58, -50, -64);
  tesa.closePath();
  pezzo(ctx, tesa, C.bianco, 0.7, LW, OMBRA_FREDDA);
}

/** Cappellino a campana di fronte (o da dietro). */
function clocheFronte(ctx) {
  const cupola = new Path2D();
  cupola.moveTo(-56, -66);
  cupola.bezierCurveTo(-62, -112, -30, -129, 0, -129);
  cupola.bezierCurveTo(30, -129, 62, -112, 56, -66);
  cupola.quadraticCurveTo(0, -60, -56, -66);
  cupola.closePath();
  pezzo(ctx, cupola, C.bianco, 1.4, LW, OMBRA_FREDDA);
  ctx.save();
  ctx.clip(cupola);
  const fascia = new Path2D();
  fascia.moveTo(-80, -63);
  fascia.quadraticCurveTo(0, -56, 80, -63);
  fascia.lineTo(80, -84);
  fascia.quadraticCurveTo(0, -77, -80, -84);
  fascia.closePath();
  tinta(ctx, fascia, C.salmone);
  ombraCel(ctx, fascia, 1.2);
  linea(ctx, (p) => { p.moveTo(-80, -84); p.quadraticCurveTo(0, -77, 80, -84); }, { spessore: px(1.9) });
  ctx.restore();
  const tesa = new Path2D();
  tesa.moveTo(-56, -68);
  tesa.lineTo(-73, -51);
  tesa.quadraticCurveTo(0, -47, 73, -51);
  tesa.lineTo(56, -68);
  tesa.quadraticCurveTo(0, -61, -56, -68);
  tesa.closePath();
  pezzo(ctx, tesa, C.bianco, 0.7, LW, OMBRA_FREDDA);
}

/** Cappello da strega di lato: tesa larghissima, cono con la punta piegata indietro. */
function cappelloStregaLato(ctx) {
  pezzo(ctx, Forme.ellisse(4, -61, 98, 9.5, -0.03), C.viola, 0.6);
  const cono = new Path2D();
  cono.moveTo(-38, -62);
  cono.quadraticCurveTo(-27, -94, -29, -112);
  cono.quadraticCurveTo(-33, -130, -60, -146);   // punta piegata all'indietro
  cono.quadraticCurveTo(-30, -142, -13, -125);
  cono.quadraticCurveTo(14, -100, 41, -64);
  cono.quadraticCurveTo(0, -56, -38, -62);
  cono.closePath();
  pezzo(ctx, cono, C.viola, 1.2);
  tratto(ctx, [[-29, -112], [-20, -117], [-12, -124]], 1.5, INK2);
  tratto(ctx, [[-18, -78], [8, -86], [28, -80]], 1.3, INK2);
}

/** Cappello da strega di fronte (o da dietro, con la punta piegata dall'altra parte). */
function cappelloStregaFronte(ctx, retro) {
  const s = retro ? -1 : 1;
  pezzo(ctx, Forme.ellisse(0, -61, 92, retro ? 16 : 11), C.viola, 0.6);
  const cono = new Path2D();
  cono.moveTo(-38, -63);
  cono.quadraticCurveTo(-30 * s, -100, -10 * s, -124);
  cono.quadraticCurveTo(4 * s, -144, 36 * s, -150);   // la punta si piega di lato
  cono.quadraticCurveTo(16 * s, -136, 20 * s, -122);
  cono.quadraticCurveTo(30 * s, -96, 38, -63);
  cono.quadraticCurveTo(0, -56, -38, -63);
  cono.closePath();
  pezzo(ctx, cono, C.viola, 1.2);
  tratto(ctx, [[-12 * s, -122], [4 * s, -126], [20 * s, -122]], 1.5, INK2);
}

/* ---------------- Lia intera ---------------- */

/** Effetti di contorno: colpetto del bastone, scintille, botta in testa. */
function effetto(ctx, tipo, punta, H) {
  if (tipo === 'tac' && punta) {
    for (const a of [-2.7, -1.57, -0.45]) {
      tratto(ctx, [[punta[0] + Math.cos(a) * 8, punta[1] + Math.sin(a) * 8], [punta[0] + Math.cos(a) * 17, punta[1] + Math.sin(a) * 17]], 2.0);
    }
  }
  if (tipo === 'scia' && punta) {
    tratto(ctx, [[punta[0] - 26, punta[1] + 30], [punta[0] - 14, punta[1] + 12], [punta[0] - 4, punta[1] + 4]], 1.6, INK2, 0.8);
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
    const q = H.transformPoint(new DOMPoint(66, -74));
    for (const a of [-0.9, -0.2, 0.5]) tratto(ctx, [[q.x + Math.cos(a) * 6, q.y + Math.sin(a) * 6], [q.x + Math.cos(a) * 16, q.y + Math.sin(a) * 16]], 2.0);
    scintilla(ctx, q.x - 6, q.y - 16, 5);
  }
}

/** Lia di lato (guarda a destra). Restituisce la posizione della mano vicina. */
function liaLato(ctx, A, P, manoVicina) {
  const T = new DOMMatrix().translate(P.x, ANCA + P.bob).rotate(P.incl * GRADI);
  const inv = T.inverse();
  const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
  const inBusto = (q) => { const r = inv.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
  const B = P.braccia.map((b) => (b.mondo ? Object.assign({}, b, { m: inBusto(b.m), g: b.g ? inBusto(b.g) : null }) : b));
  if (manoVicina) B[1] = { m: inBusto(manoVicina) };
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
    tubo(ctx, arco(anca, g, cav), 8.4, i === 0 ? C.pelleOmbra : C.pelle);
    scarpaLato(ctx, A, pd, i === 0);
  }
  // 3) il busto: mutandine, vestito, borsetta, braccio vicino, colletto o mantellina
  nelBusto(() => {
    if (A.strega && !P.accucciata) mutandineLato(ctx);
    vestitoLato(ctx, A, P, P.accucciata ? inBusto(ginocchia[1]) : null, P.orloMondo && P.orloMondo.map(inBusto));
    if (A.borsa) borsaLato(ctx, P);
    if (!alzato) segna(braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1)));
    if (A.strega) {
      mantellinaLato(ctx);
      if (!alzato) braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1, { soloAvambraccio: true }));
    } else collettoLato(ctx);
  });
  // 4) la testa
  const H = T.translate(COLLO[0] + P.testaDx, COLLO[1] + P.testaDy).rotate(P.testa * GRADI);
  ctx.save();
  ctx.transform(H.a, H.b, H.c, H.d, H.e, H.f);
  testaLato(ctx, A, P);
  ctx.restore();
  // 5) il braccio alzato passa davanti al viso
  if (alzato) nelBusto(() => segna(braccioLia(ctx, A, SPALLE_LATO[1], B[1], opz(1))));
  // 6) effetti
  if (P.effetto) effetto(ctx, P.effetto, punta, H);
  return inMondo(B[1].m);
}

/** Lia di fronte (retro = vista da dietro). */
function liaFronte(ctx, A, P, retro) {
  const T = new DOMMatrix().translate(P.x, ANCA + P.bob).rotate(P.incl * GRADI);
  const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
  const nelBusto = (fn) => { ctx.save(); ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f); fn(); ctx.restore(); };
  const alzato = (i) => P.braccia[i].m[1] < -96;
  const braccio = (i, extra) => braccioLia(ctx, A, SPALLE_FRONTE[i], P.braccia[i],
    Object.assign({ lato: i ? 1 : -1, oggetto: P.oggetto && P.oggetto.mano === i ? P.oggetto : null, incl: P.incl }, extra));
  // gambe e scarpe
  for (const i of [0, 1]) {
    const anca = inMondo(ANCHE_FRONTE[i]), pd = P.piedi[i], cav = [pd.x, pd.y];
    const g = ginocchio(anca, cav, COSCIA, i ? 1 : -1);
    tubo(ctx, arco(anca, lerp2(g, lerp2(anca, cav, 0.5), 0.6), cav), 8.4, C.pelle);
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
  const H = T.translate(P.testaDx, COLLO[1] + P.testaDy).rotate(P.testa * GRADI);
  ctx.save();
  ctx.transform(H.a, H.b, H.c, H.d, H.e, H.f);
  testaFronte(ctx, A, P, retro);
  ctx.restore();
  nelBusto(() => { for (const i of [0, 1]) if (alzato(i)) braccio(i); });
}

/** Vestitino ad A visto di fronte (o da dietro). */
function vestitoFronte(ctx, A, P) {
  const s = P.orlo;
  const p = new Path2D();
  p.moveTo(-10, -101);
  p.quadraticCurveTo(-21, -100, -22, -87);
  p.quadraticCurveTo(-28, -40, -50 + s, 14);
  p.bezierCurveTo(-30 + s, 22, 30 + s, 22, 50 + s, 14);
  p.quadraticCurveTo(28, -40, 22, -87);
  p.quadraticCurveTo(21, -100, 10, -101);
  p.closePath();
  pezzo(ctx, p, A.vestito, 1.3);
  tratto(ctx, [[-10, -60], [-16, -20], [-24 + s, 16]], 1.5, INK2);
  tratto(ctx, [[10, -60], [15, -20], [22 + s, 17]], 1.5, INK2);
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
/*  PEZZI DA QUATTROZAMPE (cane e gatto)                                    */
/* ------------------------------------------------------------------------ */

/** Zampa: tubo dall'anca alla caviglia, poi il piedino tondo con le dita. */
function zampa(ctx, anca, piede, larg, colore, posteriore, rp = 9) {
  const [ax, ay] = anca, [fx, fy] = piede;
  const cav = [fx + 1, fy - rp * 0.6];
  const mezzo = [(ax + cav[0]) / 2 + (posteriore ? -rp * 0.7 : rp * 0.3), (ay + cav[1]) / 2];
  tubo(ctx, [[ax, ay], mezzo, cav], larg, colore);
  pezzo(ctx, Forme.ellisse(fx + rp * 0.4, fy - rp * 0.6, rp, rp * 0.6), colore, 0, 2.1);
  for (const d of [0.55, 0.95]) tratto(ctx, [[fx + rp * d, fy - rp * 0.55], [fx + rp * d, fy - 1]], 1.3);
}

/** Un piede in un ciclo di passi a quattro zampe: [dx, altezza]. */
function zampaCiclo(u, A, S, alza) {
  const w = giro(u);
  if (w < S) return [A - (2 * A * w) / S, 0];
  const v = (w - S) / (1 - S);
  return [-A + 2 * A * morbido(v), -alza * Math.sin(Math.PI * v)];
}

/**
 * Coda piumata (Biscotto): una "piuma" lungo una linea curva, con i
 * ciuffi del pelo sul lato esterno. ang = direzione iniziale, curva = quanto gira.
 */
function codaPiumosa(ctx, x, y, ang, lung, curva, colore) {
  const N = 12, sopra = [], sotto = [];
  let cx = x, cy = y, a = ang;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = 2.5 + 10 * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.7);
    const nx = -Math.sin(a), ny = Math.cos(a), ciuffo = i % 2 ? 1.7 : 1;
    sopra.push([cx + nx * w * 0.6, cy + ny * w * 0.6]);
    sotto.push([cx - nx * w * ciuffo, cy - ny * w * ciuffo]);
    cx += (Math.cos(a) * lung) / N;
    cy += (Math.sin(a) * lung) / N;
    a += curva / N;
  }
  pezzo(ctx, Forme.poligono(sopra.concat(sotto.slice().reverse()), true), colore, 0.8);
  for (let i = 3; i < N - 1; i += 2) {
    const [x1, y1] = sotto[i], [x0, y0] = sopra[i];
    tratto(ctx, [[x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45], [x1 + (x0 - x1) * 0.12, y1 + (y0 - y1) * 0.12]], 1.3, INK2);
  }
}

/** Orecchio lungo e morbido di Biscotto (attaccato in alto, pende in basso). */
function orecchioCane(ctx, x, y, ang, lato = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const pp = [[-6, -4], [8, -6], [13, 10], [12, 30], [5, 45], [-5, 46], [-11, 34], [-12, 12]];
  pezzo(ctx, Forme.poligono(pp.map(([a, b]) => [a * lato, b]), true), C.orecchie, 0.9);
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  BISCOTTO, IL CAGNOLINO                                                   */
/* ------------------------------------------------------------------------ */
const SCALA_CANE = 1.3;
// anche delle quattro zampe nel sistema del corpo (p = posteriore, a = anteriore,
// l = lontana, v = vicina) e piedi a riposo
const ANCHE_CANE = { pl: [-38, 8], al: [30, 8], pv: [-30, 10], av: [38, 10] };
const PIEDI_CANE = { pl: [-50, 0], al: [22, 0], pv: [-40, 0], av: [34, 0] };

/** Lo scheletro del cane di lato per una posa e una fase t (0..1). */
function posaCaneLato(posa, t) {
  const P = {
    corpo: [-10, -53], rot: 0, lungo: 1, testa: [66, -50], rotTesta: 0,
    coda: -2.45, curva: 1.5, lungCoda: 72, orecchio: 0.12, bocca: 0, ringhia: false,
    borsa: false, oscBorsa: 0, sguardo: [0.55, -0.5], occhi: 'aperti', piedi: { ...PIEDI_CANE },
  };
  const passi = (off, A, S, alza, dx = 0) => {
    for (const k in off) {
      const [x, y] = zampaCiclo(t + off[k], A, S, alza);
      P.piedi[k] = [(PIEDI_CANE[k][0] + 10) * P.lungo + P.corpo[0] + x + dx, y];
    }
  };
  if (posa === 'fermo') {                         // scodinzola
    P.coda = -2.35 + 0.38 * onda(t);
    P.curva = 1.5 + 0.3 * onda(t - 0.12);
    P.corpo[1] += 0.7 * ondaC(t);
    P.testa[1] += 0.5 * ondaC(t - 0.1);
    P.orecchio = 0.12 + 0.05 * onda(t - 0.2);
    if (Math.abs(t - 0.5) < 0.01) P.occhi = 'chiusi';
  }
  if (posa === 'cammina') {                       // passo laterale a quattro tempi
    passi({ pl: 0, al: 0.25, pv: 0.5, av: 0.75 }, 12, 0.62, 8);
    P.corpo[1] += 1.3 * ondaC(2 * t);
    P.rot = 0.015 * onda(2 * t);
    P.testa[1] += 1.4 * ondaC(2 * (t - 0.12));
    P.rotTesta = 0.04 * onda(2 * (t - 0.12));
    P.orecchio = 0.14 + 0.1 * onda(2 * (t - 0.22));
    P.coda = -2.45 + 0.3 * onda(t);
    P.curva = 1.5 + 0.2 * onda(t - 0.15);
  }
  if (posa === 'borsa' || posa === 'borsa_fermo') {   // con la borsetta in bocca
    P.borsa = true;
    P.sguardo = [0.35, -0.8];
    P.testa = [68, -54];
    P.rotTesta = -0.08;
    if (posa === 'borsa') {                       // trotto: zampe in diagonale
      passi({ pl: 0, av: 0, al: 0.5, pv: 0.5 }, 14, 0.5, 11);
      P.corpo[1] += -1.8 + 2 * ondaC(2 * (t - 0.08));
      P.testa[1] += 1.5 * ondaC(2 * (t - 0.18));
      P.orecchio = 0.2 + 0.14 * onda(2 * (t - 0.25));
      P.coda = -2.3 + 0.32 * onda(t);
      P.oscBorsa = 0.22 * onda(2 * (t - 0.2));
    } else {
      P.coda = -2.3 + 0.35 * (t < 0.25 ? 1 : -1);
      P.oscBorsa = t < 0.25 ? 0.06 : -0.06;
      P.orecchio = t < 0.25 ? 0.14 : 0.2;
    }
  }
  if (posa === 'corre') {                         // galoppo
    P.lungo = 1 + 0.065 * ondaC(t - 0.4);
    P.rot = -0.08 * ondaC(t - 0.15);
    P.corpo = [-14, -54 - 4 * ondaC(2 * (t - 0.4))];
    passi({ pl: 0, pv: 0.1, al: 0.45, av: 0.55 }, 32, 0.34, 20);
    P.testa = [70, -44];
    P.rotTesta = 0.1 + 0.04 * onda(t - 0.2);
    P.orecchio = 1.15 + 0.3 * onda(t - 0.3);
    P.coda = -2.85 + 0.12 * onda(t);
    P.curva = 0.45;
    P.lungCoda = 62;
    P.bocca = 0.3;
    P.sguardo = [0.85, -0.1];
  }
  if (posa === 'abbaia') {
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-12, -55], rotTesta: k ? -0.3 : -0.2, bocca: k ? 1 : 0.6, coda: k ? -2.1 : -2.45, orecchio: k ? 0.45 : 0.3, sguardo: [0.75, -0.15] });
    P.piedi = { pl: [-56, 0], pv: [-46, 0], al: [26, 0], av: [40, 0] };
  }
  if (posa === 'ringhia') {
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-16 - k * 1.5, -47 + k * 0.6], rot: 0.12, rotTesta: 0.12 - k * 0.02, bocca: 0.22 + k * 0.05, ringhia: true, orecchio: 0.75, coda: -2.6, curva: 0.2, lungCoda: 58, sguardo: [0.9, 0.2], testa: [66, -46] });
    P.piedi = { pl: [-66, 0], pv: [-54, 0], al: [24, 0], av: [38, 0] };
  }
  if (posa === 'annusa') {                        // naso a terra
    const k = Math.round(t * 2) % 2;
    Object.assign(P, { corpo: [-16, -50], rot: 0.12, testa: [74 + k * 3, -3 - k * 1.5], rotTesta: 0.52 + k * 0.05, orecchio: 0.35, coda: -2.1 + (k ? 0.3 : -0.1), curva: 1.7, sguardo: [0.6, 0.85] });
    P.piedi = { pl: [-60, 0], pv: [-50, 0], al: [20, 0], av: [32, 0] };
  }
  return P;
}

/** Biscotto di lato (guarda a destra). */
function caneLato(ctx, P) {
  const T = new DOMMatrix().translate(P.corpo[0], P.corpo[1]).rotate(P.rot * GRADI);
  const L = P.lungo;
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x * L, y)); return [q.x, q.y]; };
  // la coda dietro al corpo
  const [cx, cy] = nelMondo(-44, -10);
  codaPiumosa(ctx, cx, cy, P.coda + P.rot, P.lungCoda, P.curva, C.cane);
  // zampe (prima le lontane, un po' più scure)
  for (const k of ['pl', 'al', 'pv', 'av']) {
    zampa(ctx, nelMondo(...ANCHE_CANE[k]), P.piedi[k], k[0] === 'p' ? 12 : 11, k[1] === 'l' ? C.caneScuro : C.cane, k[0] === 'p');
  }
  // corpo + petto + collo in un'unica sagoma
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const corpo = Forme.ellisse(0, 0, 50 * L, 23);
  const base = [36 * L, -8], tb = [P.testa[0] * L, P.testa[1]];
  const dx = tb[0] - base[0], dy = tb[1] - base[1], d = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
  const collo = Forme.ellisse(base[0] + dx * 0.5, base[1] + dy * 0.5, d / 2 + 6, 14.5, an);
  pezzo(ctx, [corpo, Forme.ellisse(36 * L, -4, 21, 21), collo], C.cane);
  ctx.save();
  ctx.clip(corpo);                                 // macchia marrone sul dorso
  pezzo(ctx, Forme.ellisse(-6 * L, -20, 21, 10, -0.05), C.macchia, 0, 2.0);
  ctx.restore();
  tratto(ctx, [[-20 * L, 16], [-30 * L, -6], [-44 * L, -2]], 1.5, INK2);   // coscia
  for (const k of [0, 1, 2]) tratto(ctx, [[28 * L + k * 7, 13 + k * 2], [31 * L + k * 7, 19 + k * 2]], 1.3, INK2);
  const cc = [base[0] + dx * 0.66, base[1] + dy * 0.66], n = [-dy / d, dx / d];
  tubo(ctx, [[cc[0] + n[0] * 14, cc[1] + n[1] * 14], [cc[0] + dx / d * 3, cc[1] + dy / d * 3], [cc[0] - n[0] * 14, cc[1] - n[1] * 14]], 5.5, C.collare, 2.0);
  ctx.restore();
  // testa
  const [tx, ty] = nelMondo(P.testa[0], P.testa[1]);
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(P.rot + P.rotTesta);
  testaCaneLato(ctx, P);
  ctx.restore();
}

/** Testa di profilo: cranio tondo, muso lungo, nasone, occhio grande, orecchio. */
function testaCaneLato(ctx, P) {
  const apri = P.bocca, cer = [8, 13];              // cerniera della mandibola
  const ruotaM = (x, y) => {
    const a = apri * 0.5, ddx = x - cer[0], ddy = y - cer[1];
    return [cer[0] + ddx * Math.cos(a) - ddy * Math.sin(a), cer[1] + ddx * Math.sin(a) + ddy * Math.cos(a)];
  };
  if (apri > 0) {                                   // bocca aperta: interno, lingua, mandibola
    pezzo(ctx, Forme.poligono([[6, 9], [52, 11], ruotaM(48, 21), ruotaM(12, 22)]), C.boccaDentro, 0, 2.0);
    ctx.save();
    ctx.translate(...cer);
    ctx.rotate(apri * 0.5);
    ctx.translate(-cer[0], -cer[1]);
    if (!P.ringhia) tinta(ctx, Forme.ellisse(34, 16, 10, 4), C.lingua);
    pezzo(ctx, Forme.ellisse(28, 21, 21, 6), C.cane, 0);
    ctx.restore();
  }
  pezzo(ctx, [Forme.ellisse(0, 0, 24, 23), Forme.ellisse(29, 7, 27, 12.5, -0.06)], C.cane, 0.7);
  pezzo(ctx, Forme.ellisse(55, 2, 7.5, 6.5), C.naso, 0, 2.0);
  tinta(ctx, Forme.ellisse(53, -0.5, 2.6, 1.6), '#ffffff', 0.7);
  if (!apri) tratto(ctx, [[18, 15], [32, 17.5], [46, 15]]);
  if (P.ringhia) {                                  // denti digrignati e muso arricciato
    pezzo(ctx, Forme.poligono([[18, 15], [49, 14], [48, 21], [19, 23]]), C.bianco, 0, 1.8);
    const zz = [];
    for (let k = 0; k <= 8; k++) zz.push([19 + k * 3.7, k % 2 ? 22 : 15]);
    linea(ctx, spezzata(zz), { spessore: px(1.3) });
    tratto(ctx, [[22, -3], [26, -7], [30, -3]]);
    tratto(ctx, [[31, -2], [35, -6], [39, -2]]);
  }
  for (const k of [0, 1, 2]) tratto(ctx, [[-13 + k * 6, -21], [-16 + k * 6, -28]], 1.6);   // ciuffetto
  orecchioCane(ctx, -8, -15, P.orecchio);
  occhio(ctx, 7, -13, 11.5, 11.5, P.sguardo, P.occhi);
  if (P.ringhia) {                                  // sopracciglio arrabbiato
    ctx.save();
    ctx.clip(Forme.cerchio(7, -13, 12.5));
    tinta(ctx, Forme.poligono([[-8, -30], [22, -18], [22, -40], [-8, -40]]), C.cane);
    ctx.restore();
    tratto(ctx, [[-6, -28], [7, -24], [21, -17]], 2.6);
  }
  if (P.borsa) {                                    // la borsetta tenuta in bocca (dondola)
    ctx.save();
    ctx.translate(36, 18);
    ctx.rotate(P.oscBorsa);
    ctx.translate(-36, -18);
    tubo(ctx, [[32, 20], [14, 66], [46, 62], [46, 22]], 2.6, C.salmoneScuro, 1.7);
    borsetta(ctx, 40, 31, 14);
    ctx.restore();
  }
}

/** Biscotto di fronte (seduto). */
function caneFronte(ctx, posa, t, extra) {
  const seduto = true;
  const E = Object.assign({
    coda: 0.55 * ondaC(t), bocca: posa === 'abbaia', sguardo: [0.45, -0.5], occhi: 'aperti',
    rotTesta: posa === 'abbaia' ? -0.06 : 0, testa: [0, posa === 'abbaia' ? -118 : -114], codaLato: 1,
  }, extra);
  const lc = E.codaLato;                             // da che parte sta la coda
  codaPiumosa(ctx, 26 * lc, -10, lc > 0 ? -0.3 : Math.PI + 0.3, 56, (-1.2 + E.coda) * lc, C.cane);
  for (const s of [-1, 1]) {                         // zampe posteriori ai lati
    pezzo(ctx, Forme.ellisse(s * 27, -24, 17, 22), C.caneScuro);
    pezzo(ctx, Forme.ellisse(s * 34, -5.5, 10, 5.5), C.caneScuro, 0, 2.0);
  }
  pezzo(ctx, Forme.ellisse(0, seduto ? -56 : -50, 26, 32), C.cane);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 8, -36], [k * 9, -30]], 1.3, INK2);
  for (const s of [-1, 1]) zampa(ctx, [s * 12, -50], [s * 13 - 4, 0], 11, C.cane, false);
  tubo(ctx, [[-19, -86], [0, -78], [19, -86]], 6, C.collare, 2.0);
  ctx.save();
  ctx.translate(...E.testa);
  ctx.rotate(E.rotTesta);
  testaCaneFronte(ctx, E);
  ctx.restore();
}

function testaCaneFronte(ctx, E) {
  pezzo(ctx, Forme.ellisse(0, 0, 27, 25), C.cane, 0.7);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 6, -23], [k * 7.5, -30]], 1.6);
  pezzo(ctx, Forme.ellisse(0, 14, 17, 12.5), C.muso, 0, 2.0);
  if (E.bocca) {
    pezzo(ctx, Forme.ellisse(0, 21, 9, 8), C.boccaDentro, 0, 2.0);
    tinta(ctx, Forme.ellisse(0, 25.5, 5.5, 3.2), C.lingua);
  } else tratto(ctx, [[-6, 17], [0, 20.5], [6, 17]]);
  pezzo(ctx, Forme.ellisse(0, 7, 8, 5.5), C.naso, 0, 2.0);
  tinta(ctx, Forme.ellisse(-2, 5.5, 2.4, 1.4), '#ffffff', 0.7);
  for (const s of [-1, 1]) orecchioCane(ctx, s * 21, -14, s * -0.12, s);
  occhio(ctx, -12, -9, 10, 10, E.sguardo, E.occhi);
  occhio(ctx, 12, -9, 10, 10, E.sguardo, E.occhi);
}

/** Biscotto visto da dietro mentre cammina via. */
function caneRetro(ctx, t) {
  const u = TAU * t, bob = -1.5 * Math.abs(Math.sin(u)), sx = 1.5 * Math.sin(u);
  ctx.save();
  ctx.translate(sx * 0.5, -106 + bob);               // la testa, dietro al corpo
  pezzo(ctx, Forme.ellisse(0, 0, 26, 24), C.cane, 0.7);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 6, -22], [k * 7.5, -29]], 1.6);
  for (const s of [-1, 1]) orecchioCane(ctx, s * 19, -12, s * (-0.1 - 0.12 * Math.sin(u + s)), s);
  ctx.restore();
  tubo(ctx, [[-17 + sx, -86 + bob], [sx, -82 + bob], [17 + sx, -86 + bob]], 6, C.collare, 2.0);
  for (const s of [-1, 1]) {                         // zampe davanti, nascoste in parte
    const su = Math.max(0, s * Math.sin(u + 1.6)) * 6;
    pezzo(ctx, Forme.ellisse(s * 10, -5.5 - su, 8, 5.5), C.caneScuro, 0, 2.0);
  }
  const corpo = Forme.ellisse(sx, -56 + bob, 30, 27);
  pezzo(ctx, corpo, C.cane);
  ctx.save();
  ctx.clip(corpo);
  pezzo(ctx, Forme.ellisse(-3 + sx, -76 + bob, 16, 9), C.macchia, 0, 2.0);
  ctx.restore();
  for (const s of [-1, 1]) {                         // cosce e piedi posteriori
    const alza = Math.max(0, s * Math.sin(u));
    pezzo(ctx, Forme.ellisse(s * 17 + sx, -36 + bob - alza * 4, 16, 21), C.cane);
    pezzo(ctx, Forme.ellisse(s * 18, -6 - alza * 9, 9.5, 6 - alza * 1.5), C.cane, 0, 2.0);
    if (alza > 0.3) tinta(ctx, Forme.ellisse(s * 18, -6 - alza * 9, 5, 3), C.rosa);
  }
  const ang = -Math.PI / 2 + 0.55 * Math.sin(u - 0.7);
  codaPiumosa(ctx, sx, -64 + bob, ang, 60, (ang + Math.PI / 2) * 1.2, C.cane);
}

function disegnaCane(ctx, vista, posa, fase) {
  return inScala(ctx, SCALA_CANE, () => {
    if (vista === 'lato') caneLato(ctx, posaCaneLato(posa, fase));
    else if (vista === 'fronte') caneFronte(ctx, posa, fase, posa === 'seduto' ? { occhi: fase > 0.25 ? 'chiusi' : 'aperti' } : {});
    else caneRetro(ctx, fase);
  });
}

/* ------------------------------------------------------------------------ */
/*  IL GATTINO                                                              */
/* ------------------------------------------------------------------------ */
const SCALA_GATTO = 1.25;
const ANCHE_GATTO = { pl: [-19, 5], al: [11, 5], pv: [-13, 6], av: [17, 6] };
const PIEDI_GATTO = { pl: [-24, 0], al: [8, 0], pv: [-18, 0], av: [15, 0] };

/** Testa del micio: tonda, orecchie a punta, occhioni, sorriso a "ω". */
function testaGatto(ctx, g, occhi, bocca, fronte) {
  const orecchie = fronte
    ? [[[-20, -6], [-16, -29], [-4, -16]], [[4, -16], [16, -29], [20, -6]]]
    : [[[-17, -7], [-13, -29], [-1, -15]], [[5, -15], [16, -28], [18, -5]]];
  pezzo(ctx, [Forme.ellisse(0, 0, fronte ? 22 : 20, 18), ...orecchie.map((o) => Forme.poligono(o))], C.gatto, 0.6);
  for (const o of orecchie) {
    const m = o.reduce((a, b) => [a[0] + b[0] / 3, a[1] + b[1] / 3], [0, 0]);
    tinta(ctx, Forme.poligono(o.map(([x, y]) => [m[0] + (x - m[0]) * 0.5, m[1] + (y - m[1]) * 0.5 + 1])), C.rosa);
  }
  const ox = fronte ? [-9, 9] : [-3, 11], nx = fronte ? 0 : 15;
  occhio(ctx, ox[0], -1, 7.5, 8, g, occhi);
  occhio(ctx, ox[1], -1, fronte ? 7.5 : 7, 8, g, occhi);
  tinta(ctx, Forme.poligono([[nx - 2.5, 6], [nx + 2.5, 6], [nx, 8.5]]), C.rosa);
  if (bocca) pezzo(ctx, Forme.ellisse(nx, 12, 3.6, 4.2), C.boccaDentro, 0, 1.6);
  else {
    tratto(ctx, [[nx - 5, 10], [nx - 2.5, 13], [nx, 9.5]], 1.5);
    tratto(ctx, [[nx, 9.5], [nx + 2.5, 13], [nx + 5, 10]], 1.5);
  }
  for (const s of fronte ? [-1, 1] : [1]) {           // baffi
    tratto(ctx, [[nx + s * 9, 6], [nx + s * 22, 3]], 1.1);
    tratto(ctx, [[nx + s * 9, 9], [nx + s * 22, 10]], 1.1);
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
  if (posa === 'corre') {
    P.lungo = 1 + 0.08 * ondaC(t - 0.4);
    P.rot = -0.08 * ondaC(t - 0.15);
    P.corpo = [-6, -31 - 3 * ondaC(2 * (t - 0.4))];
    passi({ pl: 0, pv: 0.08, al: 0.45, av: 0.53 }, 19, 0.34, 11);
    P.coda = [-12 + 2 * onda(t), 14 + 3 * ondaC(t)];
    P.testa = [35, -19];
  }
  if (posa === 'strofina') {                        // si struscia: schiena inarcata, occhi felici
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
  // coda lunga a "S" alzata
  const base = nelMondo(-22, -4), [sx, sy] = P.coda;
  tubo(ctx, [base, [base[0] - 16 + sx * 0.3, base[1] - 16 + sy * 0.3], [base[0] - 18 + sx, base[1] - 40 + sy], [base[0] - 6 + sx * 1.3, base[1] - 50 + sy * 1.2]], 5.2, C.gatto);
  for (const k of ['pl', 'al', 'pv', 'av']) {
    zampa(ctx, nelMondo(...ANCHE_GATTO[k]), P.piedi[k], 6.5, k[1] === 'l' ? C.gattoScuro : C.gatto, k[0] === 'p', 5.5);
  }
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  pezzo(ctx, [Forme.ellisse(0, 0, 24 * L, 13), Forme.ellisse(18 * L, -6, 11, 11)], C.gatto);
  tratto(ctx, [[-10 * L, 10], [-16 * L, -2], [-24 * L, 0]], 1.4, INK2);
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
  tubo(ctx, [[10, -8], [36, -4], [34 - k * 4, -26 - k * 3]], 5.2, C.gatto);   // coda arricciata
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 12, -12, 11, 12), C.gattoScuro);
  pezzo(ctx, Forme.ellisse(0, -30, 18, 24), C.gatto);
  for (const j of [-1, 0, 1]) tratto(ctx, [[j * 5, -42], [j * 6, -37]], 1.2, INK2);
  for (const s of [-1, 1]) zampa(ctx, [s * 6, -30], [s * 7 - 2, 0], 6.5, C.gatto, false, 5.5);
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
 *  lilla, giubbotto di pelle marrone, berretto piatto calato sugli occhi. */
const SCALA_LADRO = 1.1;
const GEO_LADRO = { cav: 13, tal: 10, pun: 28 };

function posaLadroLato(posa, t) {
  const P = { x: 0, bob: 0, incl: 0.1, testa: 0, testaDy: 0, piedi: [{ x: -10, y: -13, rot: 0 }, { x: 10, y: -13, rot: 0 }], braccia: 'tasche', faccia: 'furbo', fase: t, scuoti: 0 };
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
  if (posa === 'scippo') {
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
    pezzo(ctx, Forme.ellisse(9, 5.5, 19, 7.5), i ? C.scarpeLadro : scurisci(C.scarpeLadro, 0.15), 0, 2.2);
    ctx.restore();
  });
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const g = new Path2D();
  g.moveTo(-8, -300); g.quadraticCurveTo(-31, -298, -35, -268); g.lineTo(-37, -190);
  g.quadraticCurveTo(-37, -168, -20, -166); g.lineTo(22, -166); g.quadraticCurveTo(35, -168, 33, -190);
  g.lineTo(35, -262); g.quadraticCurveTo(31, -296, 10, -300); g.closePath();
  giacca(ctx, g);
  tinta(ctx, Forme.poligono([[4, -302], [16, -300], [10, -288]]), C.bianco);     // colletto della camicia
  tubo(ctx, [[4, -296], [6, -306]], 11, C.pelleLadro);
  ctx.save();
  ctx.translate(0, P.testaDy);
  ctx.translate(6, -306); ctx.rotate(P.testa); ctx.translate(-6, 306);
  testaLadroLato(ctx, P.faccia);
  ctx.restore();
  if (P.braccia === 'borsa' || P.braccia === 'strappa') {   // stringe la borsetta al petto
    const sv = 6 * f;
    tubo(ctx, [[20, -240], [-16, -226 + sv], [-50, -238 - sv]], 2.6, C.salmoneScuro, 1.7);
    borsetta(ctx, 30, -246, 15);
  }
  if (P.braccia === 'afferra') {                     // la borsetta appena afferrata
    tubo(ctx, [[66, -224], [70, -206], [76, -196]], 2.6, C.salmoneScuro, 1.7);
    borsetta(ctx, 80, -184, 15);
  }
  braccioLadro(ctx, [2, -284], vicino, ['allunga', 'panico'].includes(P.braccia), C.giacca, P.braccia !== 'tasche');
  if (P.braccia === 'tasche') tratto(ctx, [[6, -212], [20, -194]]);
  ctx.restore();
}

/** Giubbotto: pelle marrone, ombra, elastico in vita. */
function giacca(ctx, forma) {
  const p = pezzo(ctx, forma, C.giacca);
  ctx.save();
  ctx.clip(p);
  tinta(ctx, Forme.rettangolo(-60, -182, 120, 18, 2), C.giaccaScura);
  linea(ctx, (q) => { q.moveTo(-60, -182); q.lineTo(60, -182); }, { spessore: px(1.6) });
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
  pezzo(ctx, Forme.poligono([[-13, -342], [0, -342], [-4, -322], [-11, -316]], true), C.capelliLadro, 0, 2.0);
  pezzo(ctx, Forme.ellisse(-4, -321, 4.5, 6), C.pelleLadro, 0, 2.0);              // orecchio
  if (faccia === 'paura' || faccia === 'avido') {
    occhio(ctx, 15, -326, 6, 6, [faccia === 'paura' ? -0.6 : 0.8, 0.2]);
    if (faccia === 'paura') {
      pezzo(ctx, Forme.ellisse(22, -301, 5, 6), C.boccaDentro, 0, 2.0);
      tinta(ctx, Forme.ellisse(-14, -310, 3, 4.5), '#bfe3f2');
      tinta(ctx, Forme.ellisse(-20, -298, 2.4, 3.6), '#bfe3f2');
    } else tratto(ctx, [[14, -306], [22, -300], [30, -305]], 2.1);
  } else {
    pezzo(ctx, Forme.ellisse(16, -325, 4.5, 3.6), C.bianco, 0, 1.6);             // occhio socchiuso
    tinta(ctx, Forme.cerchio(19, -324.5, 1.9), C.pupilla);
    tratto(ctx, [[10, -328], [16, -329], [22, -327]], 2.3);
    tratto(ctx, faccia === 'ghigno' ? [[13, -305], [22, -302], [29, -307]] : [[14, -304], [21, -303], [26, -307]], 2.1);
  }
  berretto(ctx, faccia === 'paura' ? -8 : 0, true);
}

/** Berretto piatto (di lato con la visiera in avanti, oppure di fronte). */
function berretto(ctx, alza, lato) {
  const y = -341 + alza;
  if (lato) {
    pezzo(ctx, Forme.poligono([[12, y + 1], [40, y + 2], [42, y + 8], [14, y + 8]], true), C.giaccaScura, 0, 2.0);
    const p = new Path2D();
    p.moveTo(-21, y + 3); p.quadraticCurveTo(-24, y - 15, 4, y - 15); p.quadraticCurveTo(32, y - 13, 36, y + 2);
    p.quadraticCurveTo(8, y + 6, -21, y + 3); p.closePath();
    pezzo(ctx, p, C.berretto);
  } else {
    pezzo(ctx, Forme.ellisse(0, y - 3, 28, 12), C.berretto);
    pezzo(ctx, Forme.poligono([[-21, y + 2], [21, y + 2], [17, y + 12], [-17, y + 12]], true), C.giaccaScura, 0, 2.0);
  }
  tratto(ctx, [[lato ? -4 : -12, y - 12], [lato ? 4 : 0, y - 8], [12, y - 12]], 1.4, INK2);
}

/** Il ladro di fronte: fermo con le mani in tasca, oppure spaventato. */
function ladroFronte(ctx, spaventato) {
  for (const s of [-1, 1]) {
    const anca = [s * 13, -176], cav = [s * (spaventato ? 22 : 14), -13];
    tubo(ctx, [anca, spaventato ? [s * 22, -96] : [s * 14, -96], cav], 25, C.pantaloni, LW, true);
    pezzo(ctx, Forme.ellisse(s * (spaventato ? 26 : 17), -7.5, 17, 7.5), C.scarpeLadro, 0, 2.2);
  }
  const g = new Path2D();
  g.moveTo(-22, -298); g.quadraticCurveTo(-44, -296, -46, -268); g.lineTo(-42, -186);
  g.quadraticCurveTo(-40, -167, -30, -166); g.lineTo(30, -166); g.quadraticCurveTo(40, -167, 42, -186);
  g.lineTo(46, -268); g.quadraticCurveTo(44, -296, 22, -298); g.closePath();
  giacca(ctx, g);
  tratto(ctx, [[2, -290], [3, -168]], 1.5, INK2);                                  // cerniera
  tinta(ctx, Forme.poligono([[-12, -300], [12, -300], [0, -282]]), C.bianco);
  tratto(ctx, [[-12, -300], [0, -282], [12, -300]]);
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) {
    if (spaventato) braccioLadro(ctx, [s * 38, -284], [[s * 64, -300], [s * 58, -338]], true, C.giacca);
    else { tubo(ctx, [[s * 38, -284], [s * 48, -236], [s * 28, -200]], 21, C.giacca, LW, true); tratto(ctx, [[s * 18, -212], [s * 34, -196]]); }
  }
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro, 0.6);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 19, -320, 4, 6), C.pelleLadro, 0, 2.0);
  if (spaventato) {
    occhio(ctx, -8, -326, 6.5, 6.5, [0, 0]);
    occhio(ctx, 8, -326, 6.5, 6.5, [0, 0]);
    pezzo(ctx, Forme.ellisse(0, -304, 6, 7.5), C.boccaDentro, 0, 2.0);
  } else {
    for (const s of [-1, 1]) {
      pezzo(ctx, Forme.ellisse(s * 8, -326, 4.5, 3.4), C.bianco, 0, 1.6);
      tinta(ctx, Forme.cerchio(s * 8 + 2.5, -325.5, 1.8), C.pupilla);
      tratto(ctx, [[s * 8 - 5, -328.5], [s * 8 + 5, -329]], 2.3);
    }
    tratto(ctx, [[-6, -304], [2, -303], [8, -307]], 2.1);
  }
  tratto(ctx, [[0, -322], [2, -313], [-2, -311]]);                                // nasone
  berretto(ctx, spaventato ? -10 : 0, false);
}

/** Il ladro visto di spalle mentre scappa con la borsetta. */
function ladroRetro(ctx, k) {
  for (const s of [-1, 1]) {
    const su = (k === 0) === (s < 0);
    const cav = su ? [s * 12, -60] : [s * 14, -13];
    tubo(ctx, [[s * 13, -182], su ? [s * 16, -112] : [s * 14, -96], cav], 25, C.pantaloni, LW, true);
    pezzo(ctx, Forme.ellisse(cav[0], cav[1] + 6, 16, su ? 9 : 7.5), su ? '#3a271e' : C.scarpeLadro, 0, 2.2);
  }
  giacca(ctx, Forme.rettangolo(-44, -300, 88, 136, 26));
  tubo(ctx, [[-30, -230], [-58, -246], [-74, -262]], 2.6, C.salmoneScuro, 1.7);    // la cinghia della borsetta
  for (const s of [-1, 1]) {
    const su = (k === 0) === (s > 0);
    braccioLadro(ctx, [s * 38, -282], su ? [[s * 60, -250], [s * 50, -296]] : [[s * 58, -250], [s * 50, -216]], false, C.giacca);
  }
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 18, -322, 4, 6), C.pelleLadro, 0, 2.0);
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro, 0.6);
  pezzo(ctx, Forme.poligono([[-19, -342], [19, -342], [18, -318], [0, -312], [-18, -318]], true), C.capelliLadro);
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
function disegnaAbbraccio(ctx, t) {
  const k = Math.round(t * 4) % 4, felice = k >= 2, A = ABITI.strega;
  const resp = 0.5 - 0.5 * ondaC(t);
  const X = 38;                                     // dove sta Lia, in ginocchio
  ctx.translate(-12, 0);
  // la bacchetta posata a terra
  bacchetta(ctx, X + 40, -6, -0.08, 46);
  // gli stivaletti spuntano dietro la gonna
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(X + s * 52, -16);
    ctx.rotate(s * 0.25);
    pezzo(ctx, Forme.ellisse(0, 6, 13, 9), C.viola, 0.6);
    ctx.restore();
  }
  // busto e gonna allargata a terra in un'unica sagoma
  const T = new DOMMatrix().translate(X, -48 - resp).rotate(-0.1 * GRADI);
  const inMondo = (q) => { const r = T.transformPoint(new DOMPoint(q[0], q[1])); return [r.x, r.y]; };
  const [n0, s0, s1, n1] = [[-10, -101], [-22, -87], [22, -87], [10, -101]].map(inMondo);
  const v = new Path2D();
  v.moveTo(...n0);
  v.quadraticCurveTo(s0[0] - 2, n0[1], ...s0);
  v.bezierCurveTo(s0[0] - 8, s0[1] + 50, X - 70, -40, X - 66, -3);
  v.bezierCurveTo(X - 30, 4, X + 30, 4, X + 66, -3);
  v.bezierCurveTo(X + 70, -40, s1[0] + 8, s1[1] + 50, ...s1);
  v.quadraticCurveTo(s1[0] + 2, n1[1], ...n1);
  v.closePath();
  pezzo(ctx, v, A.vestito, 1.3);
  tratto(ctx, [[X - 4, -6], [X - 2, -26], [X + 14, -34], [X + 30, -26], [X + 34, -6]], 1.5, INK2);   // le ginocchia
  tratto(ctx, [[X - 30, -74], [X - 42, -40], [X - 50, -8]], 1.5, INK2);
  tratto(ctx, [[X + 46, -40], [X + 54, -8]], 1.5, INK2);
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  mantellinaFronte(ctx, false);
  ctx.restore();
  // la testa inclinata verso Biscotto
  const H = T.translate(0, COLLO[1] - 0.6 * resp).rotate((felice ? -0.17 : -0.12) * GRADI);
  ctx.save();
  ctx.transform(H.a, H.b, H.c, H.d, H.e, H.f);
  testaFronte(ctx, A, { capelli: [0, resp], sguardo: [-0.6, 0.35], occhi: felice ? 'felici' : 'aperti', bocca: felice ? 'sorriso' : 'chiusa', cappello: -0.04 }, false);
  ctx.restore();
  // Biscotto seduto che guarda Lia
  ctx.save();
  ctx.translate(-48, 0);
  inScala(ctx, SCALA_CANE * 0.96, () => caneFronte(ctx, 'seduto', t, {
    testa: [16, -110], rotTesta: 0.34, sguardo: [0.6, -0.75], coda: 0.6 * onda(t), codaLato: -1, occhi: felice ? 'felici' : 'aperti',
  }));
  ctx.restore();
  // il braccio che stringe il collo e la manina sulla testa di Biscotto
  const spD = inMondo([20, -86]), spS = inMondo([-20, -86]);
  const manoD = [-22, -96], manoS = [-34, -184];
  tubo(ctx, arco(spD, [X + 4, -88], manoD), 7, C.pelle);
  mano(ctx, ...manoD, 6.4, Math.PI, false, C.pelle);
  tubo(ctx, arco(spS, [X - 40, -150], manoS), 7, C.pelle);
  mano(ctx, ...manoS, 6.4, Math.PI * 1.1, true, C.pelle, Math.PI * 0.95);
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

/*  Grana di carta SOLO dentro le figure: la trama "grana" del pennello
 *  diventa una velatura scura con trasparenza variabile, stesa in modalità
 *  "source-atop" (cade solo dove c'è già colore).                          */
let granaFigure = null;
function trattaGrana() {
  if (granaFigure) return granaFigure;
  const sorgente = trama('grana');
  const l = sorgente.width, a = sorgente.height;
  const dati = sorgente.getContext('2d').getImageData(0, 0, l, a).data;
  const tela = nuovaTela(l, a), c = tela.getContext('2d');
  const img = c.createImageData(l, a);
  for (let i = 0; i < l * a; i++) {
    const v = dati[i * 4] / 255;                     // 1 = carta liscia, più basso = granello
    img.data[i * 4] = 92; img.data[i * 4 + 1] = 70; img.data[i * 4 + 2] = 80;
    img.data[i * 4 + 3] = Math.max(0, Math.min(255, (1 - v) * 255 * 1.7));
  }
  c.putImageData(img, 0, 0);
  granaFigure = tela;
  return tela;
}
function granulaFigure(tela, intensita) {
  const c = tela.getContext('2d');
  c.save();
  c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = intensita;
  c.fillStyle = c.createPattern(trattaGrana(), 'repeat');
  c.fillRect(0, 0, tela.width, tela.height);
  c.restore();
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
  granulaFigure(tela, 0.2);
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
  const yP = 650, sc = 0.92, scCane = 0.92 * (307 / 320);
  ombraTerra(ctx, 560, yP, 56, 9); ombraTerra(ctx, 780, yP, 84, 10);
  const presa = inScena(ctx, 560, yP, sc, (c) => disegnaLia(c, 'borsa', 'lato', 'cammina', 0.125, [44, -124]));
  const pc = posaCaneLato('cammina', 0.375);
  const collare = [780 + (pc.corpo[0] + 50) * SCALA_CANE * scCane, yP + (pc.corpo[1] - 34) * SCALA_CANE * scCane];
  linea(ctx, (p) => { p.moveTo(...presa); p.quadraticCurveTo((presa[0] + collare[0]) / 2, Math.max(presa[1], collare[1]) + 8, ...collare); }, { colore: '#c4574a', spessore: 2.4 });
  inScena(ctx, 780, yP, scCane, (c) => disegnaCane(c, 'lato', 'cammina', 0.375));
  inScena(ctx, 560, yP, sc, (c) => mano(c, 44, -124, 6.2, 0, false, C.pelle));   // la manina stringe il guinzaglio
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
  inScena(ctx, 712, 636, 1.6, (c) => { tubo(c, [[-6, -6], [-40, 4], [-30, 14], [10, 10]], 2.6, C.salmoneScuro, 1.7); borsetta(c, 0, 0, 12); });
  // Biscotto abbaia, il ladro scappa spaventato
  ombraTerra(ctx, 470, 642, 90, 12); ombraTerra(ctx, 990, 600, 70, 11);
  inScena(ctx, 470, 642, 0.97, (c) => disegnaCane(c, 'lato', 'abbaia', 0.5));
  for (const a of [-0.5, -0.15, 0.2]) tratto(ctx, [[600 + Math.cos(a) * 14, 500 + Math.sin(a) * 14], [600 + Math.cos(a) * 34, 500 + Math.sin(a) * 34]], 2.4);
  inScena(ctx, 990, 600, 1.05, (c) => disegnaLadro(c, 'lato', 'fuga', 0));
  for (let k = 0; k < 4; k++) pennellata(ctx, [[880 - k * 6, 330 + k * 46], [800 - k * 10, 330 + k * 46]], '#a07e64', 2.2, 0.55);
  for (let k = 0; k < 3; k++) acquerello(ctx, Forme.ellisse(915 - k * 26, 598 - k * 6, 16 - k * 3, 9 - k * 2), '#efe3c8', { area: [860, 570, 80, 40], seme: 60 + k, opacita: 0.7, bordo: 0.2 });
  granula(ctx, 0, 0, 1280, 720, 0.12);
  return tela;
}
