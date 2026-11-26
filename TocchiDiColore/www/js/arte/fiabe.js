/* ==========================================================================
 *  fiabe.js — GLI ABITANTI DELLE FIABE (il paese immaginato da Lia)
 *  --------------------------------------------------------------------------
 *  Nel cortometraggio Lia, che non vede, immagina la città attraverso
 *  suoni, profumi e i colpetti del bastone: e la città diventa una fiaba.
 *  Qui dipingiamo (solo con il codice!) altri abitanti di quel mondo:
 *
 *    rana             — una ranocchia musicista di strada col violino
 *    pesce_volante    — un pesce tondo che nuota nell'aria con pinne-ali
 *    pecora_nuvola    — una pecora fatta di nuvola che bruca l'erba
 *    topo_barca       — un topolino capitano su una barchetta di carta
 *    lampione_vivo    — un vecchio lampione con la faccia sul vetro
 *    chiocciola       — una lumachina postina col berretto e la borsa
 *    fiori_cantanti   — un vaso con tre fiori che cantano in coro
 *    gufo             — un gufo bibliotecario con gli occhiali e il golfino
 *    orso_mongolfiera — un orsetto che saluta da una mongolfiera a righe
 *
 *  Lo stile è quello "anime" delle comparse (gli attrezzi sono in comparse.js):
 *    - linea bruno scuro: la sagoma esterna è spessa il doppio delle linee
 *      interne, i tratti aperti si assottigliano in punta;
 *    - campiture piatte con UN solo tono d'ombra per colore (bordo netto,
 *      più freddo, la luce arriva da in alto a sinistra);
 *    - riflessi a zig-zag su pelo e cappelli, luccichii sulle cose lucide;
 *    - niente grana dentro i personaggi;
 *    - occhi ovali bianchi con un puntino scuro (e due riflessi), bocche piccole.
 *
 *  Coordinate: ogni fotogramma si disegna con l'origine (0, 0) a terra, al
 *  centro della cella; la y cresce verso il basso (sopra il suolo y < 0).
 *  Solo il pesce volante ha l'origine al CENTRO della cella (vola!).
 *  Le viste "lato" guardano a DESTRA: il motore le specchia da solo.
 * ========================================================================== */

import {
  casuale, tra, scurisci, conAlfa, percorso, Forme, tinta, linea, creaAtlante, respira,
} from './pennello.js';
import {
  MANGA, tonoOmbra, tonoLuce, pennino, ombraPortata, riflesso, luccichio, strisciaLuce, rossore, sagomaManga, aParte,
  senzaSagoma,
} from './comparse.js';

/* ------------------------------------------------------------------------ */
/*  COLORI COMUNI E UN PO' DI MATEMATICA                                    */
/* ------------------------------------------------------------------------ */
const INK = MANGA.dentro;         // la linea interna dei personaggi (la sagoma è più scura e spessa)
const INK2 = '#a3846c';           // linee di dettaglio (pieghe, piume, squame)
const BIANCO = '#fffdf8';
const PUPILLA = '#2e211c';
const BOCCA_DENTRO = '#a4493f';
const LINGUA = '#ef9188';
const ROSA_GUANCE = '#f29a9a';
const TAU = Math.PI * 2;

/** Spessore della linea dell'atlante che stiamo dipingendo (cambia per ognuno). */
let LW = 1.9;
/** Vero per i personaggi più affettuosi: sulle guance anche i trattini dei manga. */
let TRATTINI = false;

/** Il secondo tono (ombra "cel") di ogni colore. Se manca, lo calcoliamo. */
const TONI = {};
const tono = (colore) => TONI[colore] || scurisci(colore, 0.13);

const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const piu = (a, b) => [a[0] + b[0], a[1] + b[1]];
/** Vettore lungo "l" nella direzione "ang" (radianti, 0 = destra, positivo = in basso). */
const polare = (ang, l) => [Math.cos(ang) * l, Math.sin(ang) * l];
const ruota = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/* ------------------------------------------------------------------------ */
/*  PENNELLI                                                                */
/* ------------------------------------------------------------------------ */

/** Unisce più forme in un solo Path2D. */
function unione(forme) {
  if (!Array.isArray(forme)) return percorso(forme);
  const p = new Path2D();
  for (const f of forme) p.addPath(percorso(f));
  return p;
}

/** Linea spezzata (segmenti dritti). */
function spezzata(punti) {
  const p = new Path2D();
  punti.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
}

/** Esegue "disegna" con il foglio ruotato di "ang" attorno a (cx, cy). */
function ruotato(ctx, cx, cy, ang, disegna) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.translate(-cx, -cy);
  disegna();
  ctx.restore();
}

/**
 * Il "mattone" dei personaggi: una o più forme fuse in un'unica sagoma.
 *  1) un tratto doppio di inchiostro (il colore poi ne copre la metà interna:
 *     resta una linea tutta attorno, anche se le forme si sovrappongono); una
 *     seconda passata spostata in basso a destra la ingrossa dal lato in ombra;
 *  2) la tinta piatta;
 *  3) l'ombra "cel": coloriamo tutto col tono d'ombra (più scuro e più freddo)
 *     e poi ridipingiamo il colore pieno con la sagoma spostata verso la luce
 *     (in alto a sinistra): resta in ombra solo una falce netta in basso a destra.
 * ombra = quanto è larga la falce (0 = niente ombra), w = spessore linea.
 */
function pezzo(ctx, forme, colore, ombra = 1, w = LW) {
  const p = unione(forme);
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 1.7;
  ctx.stroke(p);
  ctx.translate(w * 0.3, w * 0.36);
  ctx.lineWidth = w * 2;
  ctx.stroke(p);
  ctx.restore();
  tinta(ctx, p, colore);
  if (ombra) {
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = tonoOmbra(colore);
    ctx.fill(p);
    ctx.translate(-6.5 * ombra, -4.5 * ombra);
    ctx.fillStyle = colore;
    ctx.fill(p);
    ctx.restore();
  }
  return p;
}

/**
 * L'ombra cel di "forma" (come in pezzo) ma dipinta solo sopra "dentro", nel
 * colore di "dentro": per pance, nastri e toppe che seguono la forma grande.
 */
function ombraDentro(ctx, forma, dentro, colore, ombra = 1) {
  const p = percorso(forma);
  const fuori = new Path2D();
  fuori.rect(-4000, -4000, 8000, 8000);
  fuori.addPath(p, new DOMMatrix([1, 0, 0, 1, -6.5 * ombra, -4.5 * ombra]));
  ctx.save();
  ctx.clip(p);
  ctx.clip(percorso(dentro));
  ctx.fillStyle = tonoOmbra(colore);
  ctx.fill(fuori, 'evenodd');
  ctx.restore();
}

/**
 * "Tubo" col contorno: braccia, steli, cinghie, bastoni, corde. Se è abbastanza
 * largo prende anche l'ombra cel: una fascia netta sul lato in basso a destra.
 */
function tubo(ctx, punti, larg, colore, w = LW, dritto = false) {
  const p = dritto ? spezzata(punti) : Forme.curva(punti);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = larg + 1.7 * w;
  ctx.stroke(p);
  ctx.translate(w * 0.3, w * 0.36);
  ctx.lineWidth = larg + 2 * w;
  ctx.stroke(p);
  ctx.translate(-w * 0.3, -w * 0.36);
  if (larg >= 6) {
    ctx.strokeStyle = tonoOmbra(colore);
    ctx.lineWidth = larg;
    ctx.stroke(p);
    ctx.translate(-larg * 0.15, -larg * 0.15);
    ctx.lineWidth = larg * 0.7;
  } else {
    ctx.lineWidth = larg;
  }
  ctx.strokeStyle = colore;
  ctx.stroke(p);
  ctx.restore();
}

/** Tratto di dettaglio (pieghe, bocche, sopracciglia): col pennino, si assottiglia in punta. */
function tratto(ctx, punti, w = LW * 0.85, colore = INK, alfa = 1) {
  pennino(ctx, punti, w * 1.25, colore, alfa);
}

/** Un'ellisse "petalo" che parte da "radice" e va lunga "lung" nella direzione "ang". */
function lobo(radice, ang, lung, larg) {
  const [cx, cy] = piu(radice, polare(ang, lung / 2));
  return Forme.ellisse(cx, cy, lung / 2, larg / 2, ang);
}

/**
 * Occhio: ovale bianco con il puntino scuro (g = sguardo, da -1 a 1).
 * stato: 'aperti' | 'chiusi' (dorme ‿) | 'felici' (∩) | 'strizzati' (> o <, dir = ±1)
 */
function occhio(ctx, x, y, rx, ry, g = [0, 0], stato = 'aperti', dir = 1) {
  const w = LW * 1.1;
  if (stato === 'chiusi') return tratto(ctx, [[x - rx, y], [x, y + ry * 0.5], [x + rx, y]], w, MANGA.fuori);
  if (stato === 'felici') return tratto(ctx, [[x - rx, y + ry * 0.3], [x, y - ry * 0.4], [x + rx, y + ry * 0.3]], w, MANGA.fuori);
  if (stato === 'strizzati') {
    pennino(ctx, [[x - dir * rx, y - ry * 0.5], [x + dir * rx * 0.7, y]], w * 1.2, MANGA.fuori, 1, 0.3);
    return pennino(ctx, [[x + dir * rx * 0.7, y], [x - dir * rx, y + ry * 0.5]], w * 1.2, MANGA.fuori, 1, 0.3);
  }
  const p = Forme.ellisse(x, y, rx, ry);
  tinta(ctx, p, BIANCO);
  ctx.save();                                     // l'ombra della palpebra sul bianco dell'occhio
  ctx.clip(p);
  tinta(ctx, Forme.ellisse(x + rx * 0.1, y - ry * 1.02, rx * 1.25, ry * 0.5), tonoOmbra(BIANCO));
  ctx.restore();
  const r = Math.max(1.4, rx * 0.32);
  const px = x + g[0] * (rx - r - 1.2), py = y + g[1] * (ry - r * 1.15 - 1.2);
  tinta(ctx, Forme.ellisse(px, py, r, r * 1.15), PUPILLA);
  // due riflessi: uno grande in alto a sinistra, uno piccolo in basso a destra
  tinta(ctx, Forme.cerchio(px - r * 0.36, py - r * 0.42, Math.max(0.7, r * 0.42)), '#ffffff');
  tinta(ctx, Forme.cerchio(px + r * 0.42, py + r * 0.5, Math.max(0.4, r * 0.2)), '#ffffff', 0.95);
  linea(ctx, p, { spessore: LW * 0.6, colore: INK });
  // la palpebra di sopra, più spessa e affusolata
  const palpebra = [-Math.PI + 0.3, -2.25, -Math.PI / 2, -0.9, -0.3].map((a) => [x + Math.cos(a) * rx * 1.02, y + Math.sin(a) * ry * 1.04]);
  pennino(ctx, palpebra, Math.min(LW * 1.6, rx * 0.5), MANGA.fuori, 1, 0.15);
}

/** Bocca aperta a "D" (labbro di sopra quasi dritto, sotto tondo) con la lingua. */
function boccaAperta(ctx, x, y, l, h) {
  const p = new Path2D();
  p.moveTo(x - l / 2, y);
  p.quadraticCurveTo(x, y + h * 0.15, x + l / 2, y);
  p.quadraticCurveTo(x + l * 0.45, y + h, x, y + h);
  p.quadraticCurveTo(x - l * 0.45, y + h, x - l / 2, y);
  p.closePath();
  tinta(ctx, p, BOCCA_DENTRO);
  ctx.save();
  ctx.clip(p);
  tinta(ctx, Forme.ellisse(x, y + h, l * 0.3, h * 0.45), LINGUA);
  ctx.restore();
  linea(ctx, p, { spessore: LW * 0.7, colore: INK });
  pennino(ctx, [[x - l / 2, y], [x, y + h * 0.15], [x + l / 2, y]], LW * 1.3, MANGA.fuori, 1, 0.3);   // labbro di sopra
}

/** Bocca a "o" (canto, sbadiglio, stupore). */
function boccaTonda(ctx, x, y, rx, ry) {
  const p = Forme.ellisse(x, y, rx, ry);
  tinta(ctx, p, BOCCA_DENTRO);
  ctx.save();
  ctx.clip(p);
  tinta(ctx, Forme.ellisse(x, y + ry, rx * 0.75, ry * 0.5), LINGUA);
  ctx.restore();
  linea(ctx, p, { spessore: LW * 0.8, colore: INK });
}

/** Sorrisetto a filo. */
function sorriso(ctx, x, y, l, curva = 0.3) {
  tratto(ctx, [[x - l / 2, y], [x, y + l * curva], [x + l / 2, y]]);
}

/** Rossore sfumato sulla guancia (con i trattini dei manga per i personaggi affettuosi). */
function guancia(ctx, x, y, r, alfa = 0.45) {
  rossore(ctx, x, y, r, ROSA_GUANCE, alfa, TRATTINI);
}

/** Disegna ingrandito di "s" lasciando uguale lo spessore delle linee. */
function inScala(ctx, s, disegna) {
  const prima = LW;
  ctx.save();
  ctx.scale(s, s);
  LW = prima / s;
  disegna();
  LW = prima;
  ctx.restore();
}

/** Manina tonda con tre ditini (rane, topolini, orsetti). ang = verso dove puntano le dita. */
function manina(ctx, x, y, r, ang, colore) {
  const forme = [Forme.cerchio(x, y, r)];
  for (const d of [-0.62, 0, 0.62]) {
    const [dx, dy] = polare(ang + d, r * 1.02);
    forme.push(Forme.cerchio(x + dx, y + dy, r * 0.44));
  }
  pezzo(ctx, forme, colore, 0, LW * 0.85);
}

/** Una nota musicale (♪, o ♫ se doppia), per chi suona e canta (fuori dalla sagoma spessa). */
function nota(ctx, x, y, s, doppia, colore = INK) {
  aParte(ctx, () => notaQui(ctx, x, y, s, doppia, colore));
}

function notaQui(ctx, x, y, s, doppia, colore) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  const testa = (dx, dy) => tinta(ctx, Forme.ellisse(dx, dy, s * 0.52, s * 0.38, -0.4), colore);
  const gambo = (dx, dy) => linea(ctx, spezzata([[dx + s * 0.46, dy - s * 0.1], [dx + s * 0.46, dy - s * 1.6]]), { spessore: s * 0.16, colore });
  testa(0, 0);
  gambo(0, 0);
  if (doppia) {
    testa(s * 1.3, -s * 0.3);
    gambo(s * 1.3, -s * 0.3);
    linea(ctx, spezzata([[s * 0.46, -s * 1.55], [s * 1.76, -s * 1.85]]), { spessore: s * 0.34, colore });
  } else {
    tratto(ctx, [[s * 0.46, -s * 1.6], [s * 1.15, -s * 1.15], [s * 0.95, -s * 0.55]], s * 0.16, colore);
  }
  ctx.restore();
}

/** Ciuffo d'erba (fili appuntiti) con la base in (x, y). */
function erbetta(ctx, x, y, fili, alt, seme, colore = '#8cc46c') {
  const rng = casuale(seme);
  for (let k = 0; k < fili; k++) {
    const bx = x + (k - (fili - 1) / 2) * 5 + tra(rng, -1.5, 1.5);
    const h = alt * tra(rng, 0.6, 1);
    const pende = (k - (fili - 1) / 2) * 3 + tra(rng, -2, 2);
    pezzo(ctx, Forme.poligono([[bx - 2.6, y], [bx + 2.6, y], [bx + pende, y - h]]), k % 2 ? tono(colore) : colore, 0, LW * 0.7);
  }
}

/* ------------------------------------------------------------------------ */
/*  1. LA RANA VIOLINISTA                                                    */
/* ------------------------------------------------------------------------ */
/*  Ranocchia verde dalla pancia crema, papillon rosso e cappellino di
 *  paglia sulle ventitré. Suona il violino appoggiato sotto il mento: la
 *  mano sinistra (a destra dello schermo) tiene il manico, la destra
 *  muove l'archetto avanti e indietro. Misure: piedi 0, pancia -50,
 *  mento ~-108, occhi -165, cappellino ~-195.                             */

const RANA = {
  pelle: '#9fcf7f', pancia: '#f7f0cc', papillon: '#e2685e', paglia: '#f1d48a', legno: '#d4884a',
  scuro: '#5d3a2a', arco: '#8a5a3a', crine: '#fff6e2',
};
Object.assign(TONI, {
  [RANA.pelle]: '#86b968', [RANA.pancia]: '#ebe0b4', [RANA.paglia]: '#dbb867', [RANA.legno]: '#b96f37',
});

/** Il violino visto dall'alto: x lungo l'asse, verso il riccio. */
function violino(ctx, x, y, ang) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  inScala(ctx, 1.15, () => violinoPiccolo(ctx));
  ctx.restore();
}

function violinoPiccolo(ctx) {
  const cassa = pezzo(ctx, [Forme.ellisse(-9, 0, 13, 13.5), Forme.ellisse(10, 0, 10, 11), Forme.ellisse(1, 0, 8, 8.5)], RANA.legno, 0.5);
  riflesso(ctx, cassa, -9, 0, 10.5, 11, -2.9, -1.5, 0.3, tonoLuce(RANA.legno, 0.55), 3);           // legno verniciato, lucido
  luccichio(ctx, 9, -5.5, 2.2, 0.9);
  for (const s of [-1, 1]) tratto(ctx, [[-6, s * 6], [-1, s * 4.8], [4, s * 6.2]], LW * 0.6, RANA.scuro);  // le "effe"
  pezzo(ctx, Forme.poligono([[-21, -2.6], [-9, -3.6], [-9, 3.6], [-21, 2.6]]), RANA.scuro, 0, LW * 0.5);  // cordiera
  pezzo(ctx, Forme.rettangolo(-1, -3, 40, 6, 2.5), RANA.scuro, 0, LW * 0.5);                             // manico
  for (const px of [35, 39.5]) tubo(ctx, [[px, -7], [px, 7]], 2.4, RANA.scuro, LW * 0.5, true);             // bischeri
  pezzo(ctx, Forme.ellisse(43, 0, 6.5, 5), RANA.legno, 0, LW * 0.6);                                        // riccio
  tratto(ctx, [[45, -1.5], [42, -1.5], [42.5, 1.8], [45.5, 0.8]], LW * 0.5);
  for (const s of [-1, 1]) linea(ctx, spezzata([[-19, s * 1.2], [38, s * 1]]), { spessore: 0.7, colore: RANA.crine });
  pezzo(ctx, Forme.rettangolo(-7.5, -5, 2.6, 10, 1), '#f6e2b8', 0, LW * 0.45);                             // ponticello
}

/** L'archetto, tenuto in "mano", lungo "lung" nella direzione "ang". */
function archetto(ctx, mano, ang, lung) {
  const d = polare(ang, 1), n = [-d[1], d[0]];
  const a = piu(mano, polare(ang, -7)), b = piu(mano, polare(ang, lung));
  linea(ctx, spezzata([[a[0] + n[0] * 4, a[1] + n[1] * 4], [b[0] + n[0] * 1.5, b[1] + n[1] * 1.5]]), { spessore: 1.6, colore: RANA.crine });
  tubo(ctx, [a, b], 2.6, RANA.arco, LW * 0.6, true);
  pezzo(ctx, Forme.ellisse(a[0] + d[0] * 4 + n[0] * 2.5, a[1] + d[1] * 4 + n[1] * 2.5, 5, 3, ang), RANA.scuro, 0, LW * 0.5);
}

function braccioRana(ctx, spalla, gomito, mano, angDita) {
  tubo(ctx, [spalla, gomito, mano], 10, RANA.pelle);
  manina(ctx, mano[0], mano[1], 6.5, angDita, RANA.pelle);
}

function papillon(ctx, x, y, colore) {
  pezzo(ctx, Forme.poligono([[x, y], [x - 13, y - 7], [x - 13, y + 7]], true), colore, 0.4, LW * 0.85);
  pezzo(ctx, Forme.poligono([[x, y], [x + 13, y - 7], [x + 13, y + 7]], true), colore, 0.4, LW * 0.85);
  pezzo(ctx, Forme.ellisse(x, y, 4, 4.5), colore, 0, LW * 0.85);
}

/** Cappellino di paglia (paglietta) col nastro rosso. */
function paglietta(ctx, x, y, ang, larg) {
  ruotato(ctx, x, y, ang, () => {
    ombraPortata(ctx, Forme.ellisse(x + 2, y + larg * 0.2, larg * 0.95, larg * 0.24));          // la tesa fa ombra sulla testa
    const tesa = pezzo(ctx, Forme.ellisse(x, y, larg, larg * 0.24), RANA.paglia, 0.4);
    riflesso(ctx, tesa, x - 1, y, larg * 0.86, larg * 0.18, -3.0, -2.1, 0.4, tonoLuce(RANA.paglia, 0.55), 2);
    const cupola = pezzo(ctx, Forme.rettangolo(x - larg * 0.6, y - larg * 0.68, larg * 1.2, larg * 0.68, larg * 0.16), RANA.paglia, 0.5);
    strisciaLuce(ctx, cupola, x - larg * 0.48, y - larg * 0.62, larg * 0.16, larg * 0.3, 0, tonoLuce(RANA.paglia, 0.6), 1);
    const nastro = Forme.rettangolo(x - larg * 0.6, y - larg * 0.3, larg * 1.2, larg * 0.24, 1);
    pezzo(ctx, nastro, RANA.papillon, 0, LW * 0.7);
    ombraDentro(ctx, cupola, nastro, RANA.papillon, 0.5);
  });
}

function testaRana(ctx, T) {
  ruotato(ctx, 0, -108, T.inclina, () => {
    ombraPortata(ctx, Forme.ellisse(6, -104, 34, 9));                                           // ombra sotto il mento
    const testa = pezzo(ctx, Forme.ellisse(0, -139, 50, 33), RANA.pelle, 1);
    riflesso(ctx, testa, -3, -136, 44, 28, -2.8, -1.0, 0.2, tonoLuce(RANA.pelle, 0.45), 6);
    for (const s of [-1, 1]) {
      const bolla = pezzo(ctx, Forme.cerchio(s * 26, -164, 17), RANA.pelle, 0.5);
      riflesso(ctx, bolla, s * 26, -164, 14.5, 14.5, -2.7, -1.5, 0.22, tonoLuce(RANA.pelle, 0.5), 3);
      occhio(ctx, s * 26, -165, 10, 11.5, T.sguardo, T.occhi);
    }
    paglietta(ctx, -16, -183, -0.22, 19);
    for (const s of [-1, 1]) tinta(ctx, Forme.cerchio(s * 5, -149, 1.5), INK);   // narici
    guancia(ctx, -34, -128, 7.5, 0.75);
    guancia(ctx, 34, -128, 7.5, 0.75);
    if (T.bocca === 'aperta') boccaAperta(ctx, 0, -128, 30, 13);
    else tratto(ctx, [[-29, -131], [-15, -121.5], [0, -120], [15, -121.5], [29, -131]]);   // il sorrisone da rana
  });
}

function disegnaRana(ctx, nome) {
  const [, azione, n] = nome.split('_');
  const k = Number(n), suona = azione === 'suona', fase = k / 4;
  const oscilla = suona ? 0.04 * Math.sin(TAU * fase) : 0;
  const giu = suona ? 1.5 * Math.abs(Math.sin(TAU * fase)) : 0;
  for (const s of [-1, 1]) {                                     // piedoni palmati, fermi a terra
    const forme = [Forme.ellisse(s * 25, -8, 14, 7)];
    for (const d of [-1, 0, 1]) forme.push(Forme.cerchio(s * 25 + d * 10 + s * 4, -5, 5));
    pezzo(ctx, forme, RANA.pelle, 0.4);
  }
  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(oscilla);                                           // il corpo dondola a tempo
  ctx.translate(0, 14 + giu);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 30, -30, 17, 21, s * 0.35), RANA.pelle, 0.6);  // cosce
  const corpo = pezzo(ctx, [Forme.ellisse(0, -50, 41, 37), Forme.ellisse(0, -86, 31, 28)], RANA.pelle, 1.2);
  ctx.save();
  ctx.clip(corpo);
  pezzo(ctx, Forme.ellisse(0, -52, 26, 31), RANA.pancia, 0.5, LW * 0.75);
  ctx.restore();

  if (suona) {
    // il violino sotto il mento; l'archetto lo attraversa e va avanti e indietro
    const B = [30, -100], av = -0.6, ab = 0.3, db = polare(ab, 1);
    const u = 57.5 - 17.5 * Math.cos(TAU * fase);              // quanto archetto è già passato
    const C = piu(B, polare(av, -4));
    const H = [C[0] - db[0] * u, C[1] - db[1] * u];
    violino(ctx, B[0], B[1], av);
    testaRana(ctx, { inclina: 0.1, sguardo: [0.4, 0.4], occhi: k === 1 || k === 2 ? 'felici' : 'aperti', bocca: 'sorriso' });
    papillon(ctx, -6, -106, RANA.papillon);
    const N = piu(B, polare(av, 41));
    braccioRana(ctx, [27, -92], [52, -70], piu(N, [2, 4]), -2.3);
    senzaSagoma(ctx, (c) => archetto(c, H, ab, 100));
    braccioRana(ctx, [-27, -92], lerp2([-44, -80], [-62, -96], (u - 40) / 35), H, ab + 1.2);
    const NOTE = [[[64, -150], [82, -192]], [[70, -164], [76, -210]], [[74, -178], [66, -222]], [[68, -192], [84, -166]]];
    nota(ctx, NOTE[k][0][0], NOTE[k][0][1], 9, false);
    nota(ctx, NOTE[k][1][0] - 6, NOTE[k][1][1], 8, true);
  } else {
    // a riposo: il violino penzola nella mano sinistra, l'archetto nella destra
    const parla = azione === 'parla';
    violino(ctx, 50, -40, -Math.PI / 2 + 0.12);
    senzaSagoma(ctx, (c) => archetto(c, [-50, -66], -Math.PI / 2 - 0.25, 92));
    testaRana(ctx, { inclina: parla ? (k ? 0.03 : -0.04) : 0, sguardo: [0, 0.15], occhi: 'aperti', bocca: parla && k === 0 ? 'aperta' : 'sorriso' });
    papillon(ctx, 0, -106, RANA.papillon);
    braccioRana(ctx, [27, -92], [46, -84], [54, -70], -2.6);
    braccioRana(ctx, [-27, -92], [-48, -84], [-50, -66], -0.6);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  2. IL PESCE VOLANTE                                                     */
/* ------------------------------------------------------------------------ */
/*  Un pesce tondo color pesca che nuota nell'aria: le pinne lilla sono
 *  grandi come ali e battono su e giù, la coda frulla, escono bollicine.
 *  Di lato, guarda a destra; l'origine è al centro della cella.          */

const PESCE = { corpo: '#f6a98e', pancia: '#fcdcc6', pinne: '#c8b4e6' };
Object.assign(TONI, { [PESCE.corpo]: '#e48d73', [PESCE.pancia]: '#f3c7ad', [PESCE.pinne]: '#ab97d2' });

/** Una pinna a ventaglio: tanti lobi che partono dalla stessa radice. */
function pinna(ctx, radice, angoli, lunghezze, larg, ang, colore) {
  const forme = angoli.map((a, i) => lobo(radice, a + ang, lunghezze[i], larg));
  pezzo(ctx, forme, colore, 0.4, LW * 0.85);
  angoli.forEach((a, i) => tratto(ctx, [piu(radice, polare(a + ang, 6)), piu(radice, polare(a + ang, lunghezze[i] * 0.78))], LW * 0.55, INK2));
}

function disegnaPesce(ctx, nome) {
  const k = Number(nome.slice(1)), w = (TAU * k) / 4;
  const ali = 0.5 * Math.cos(w);                   // + = pinne in su
  const coda = 0.3 * Math.sin(w);
  ctx.translate(4, 4 - 2.5 * Math.sin(w));
  pinna(ctx, [-8, -16], [-2.0, -2.4, -2.8], [44, 48, 38], 20, ali * 0.85 + 0.12, tono(PESCE.pinne));   // ala lontana
  pinna(ctx, [-45, 2], [Math.PI - 0.48, Math.PI + 0.48], [36, 36], 21, coda, PESCE.pinne);               // coda
  pinna(ctx, [-8, -36], [-2.25, -1.85], [22, 18], 11, 0.08 * Math.sin(w), PESCE.pinne);                   // pinna sul dorso
  pinna(ctx, [-4, 36], [2.2, 1.85], [17, 13], 9, -0.08 * Math.sin(w), PESCE.pinne);                       // pinnetta sotto
  const corpo = pezzo(ctx, Forme.ellisse(0, 0, 50, 40), PESCE.corpo, 1.2);
  const pancia = Forme.ellisse(6, 31, 44, 17);
  ctx.save();
  ctx.clip(corpo);
  pezzo(ctx, pancia, PESCE.pancia, 0, LW * 0.7);
  ctx.restore();
  ombraDentro(ctx, corpo, pancia, PESCE.pancia, 1.2);
  // squame lucide: la fascia di luce in alto e un luccichio
  riflesso(ctx, corpo, -2, 2, 43, 34, -2.8, -1.3, 0.2, tonoLuce(PESCE.corpo, 0.55), 5);
  luccichio(ctx, -27, -21, 3.4, 0.9);
  for (const [x, y] of [[-24, -16], [-36, -2], [-24, 12], [-12, -2]]) {     // qualche squama
    tratto(ctx, [[x + 3, y - 5], [x - 1.5, y], [x + 3, y + 5]], LW * 0.6, INK2);
  }
  tratto(ctx, [[11, -25], [5, -6], [11, 14]], LW * 0.7, INK2);                 // la branchia
  occhio(ctx, 26, -9, 10, 12.5, [0.55, -0.1]);
  guancia(ctx, 31, 9, 6.5);
  tratto(ctx, [[41, 9], [45.5, 12], [49, 8.5]], LW * 0.8);                     // sorrisino
  pinna(ctx, [0, -6], [-2.0, -2.42, -2.84], [52, 57, 45], 22, ali, PESCE.pinne);   // ala vicina
  aParte(ctx, () => {                                                         // bollicine (leggere, senza sagoma)
    for (const [x, y, r] of [[60, -4 - 7 * k, 4.2], [70, -14 - 5 * ((k + 2) % 4), 2.8]]) {
      linea(ctx, Forme.cerchio(x, y, r), { spessore: LW * 0.6, colore: INK2 });
      tinta(ctx, Forme.cerchio(x - r * 0.35, y - r * 0.35, r * 0.3), '#ffffff', 0.9);
    }
  });
}

/* ------------------------------------------------------------------------ */
/*  3. LA PECORA NUVOLA                                                     */
/* ------------------------------------------------------------------------ */
/*  Il corpo è una nuvola soffice (tanti riccioli tondi attorno a un ovale),
 *  musetto e zampine lilla scuro. Di lato, guarda a destra: da ferma bruca
 *  l'erba e mastica, poi cammina a passetti (zampe a coppie diagonali).   */

const PECORA = { lana: '#fffdf6', muso: '#6f5f8c', zoccolo: '#4b3f62', orecchio: '#d9a0b8', chiaro: '#c9b9de' };
Object.assign(TONI, { [PECORA.lana]: '#e2e1f0', [PECORA.muso]: '#5e4f79' });

/** Una nuvola: un ovale con n riccioli tondi sul bordo (quelli di sotto più piccoli). */
function nuvola(cx, cy, rx, ry, n, seme, rMin, rMax) {
  const rng = casuale(seme);
  const forme = [Forme.ellisse(cx, cy, rx, ry)];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + tra(rng, -0.12, 0.12);
    const r = tra(rng, rMin, rMax) * (Math.sin(a) > 0.5 ? 0.72 : 1);
    forme.push(Forme.cerchio(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r));
  }
  return forme;
}

function zampaPecora(ctx, anca, piede, colore) {
  const alza = -piede[1];
  const ginocchio = [lerp(anca[0], piede[0], 0.5) + alza * 0.6, lerp(anca[1], piede[1], 0.55)];
  tubo(ctx, [anca, ginocchio, [piede[0], piede[1] - 5]], 8, colore);
  pezzo(ctx, Forme.rettangolo(piede[0] - 5.5, piede[1] - 7.5, 11, 7.5, 3), PECORA.zoccolo, 0, LW * 0.8);
}

/** Il musetto lilla: (x, y) centro della testa, ang = quanto è abbassato. */
function testaPecora(ctx, x, y, ang, occhi, filoDErba) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  pezzo(ctx, Forme.ellisse(-2, -12, 11, 5, -0.9), tono(PECORA.muso), 0, LW * 0.85);           // orecchio lontano
  if (filoDErba) {
    senzaSagoma(ctx, (c) => {
      pezzo(c, Forme.poligono([[20, 14], [24, 12], [44, 24]]), '#8cc46c', 0, LW * 0.7);
      pezzo(c, Forme.poligono([[19, 15], [23, 15], [36, 34]]), '#76ad58', 0, LW * 0.7);
    });
  }
  const muso = pezzo(ctx, [Forme.ellisse(0, 0, 21, 17), Forme.ellisse(15, 5, 14, 12.5, 0.3)], PECORA.muso, 0.6);
  riflesso(ctx, muso, 3, 2, 19, 15, -2.6, -0.9, 0.24, tonoLuce(PECORA.muso, 0.35), 4);
  ombraPortata(ctx, Forme.ellisse(-1, -7, 12, 5));                                               // il ciuffo fa ombra sulla fronte
  pezzo(ctx, nuvola(-4, -15, 10, 4, 5, 31, 6, 8), PECORA.lana, 0.4, LW * 0.85);                // ciuffo di nuvola
  pezzo(ctx, Forme.ellisse(-15, -2, 13, 6, 0.55), PECORA.muso, 0, LW * 0.85);                   // orecchio vicino
  tinta(ctx, Forme.ellisse(-15, -1.5, 8, 2.8, 0.55), PECORA.orecchio);
  occhio(ctx, 6, -3, 5.5, 7, [0.55, 0.1], occhi);
  guancia(ctx, 13, 8, 4.5);
  tinta(ctx, Forme.ellisse(26, 3, 1.6, 1.2, 0.3), PECORA.chiaro);                               // narice
  tratto(ctx, [[18, 13], [23, 15.5], [27, 13]], LW * 0.75, PECORA.chiaro);                      // bocca
  ctx.restore();
}

function disegnaPecora(ctx, nome) {
  const [, azione, n] = nome.split('_');
  const k = Number(n), cammina = azione === 'cammina', th = (TAU * k) / 4;
  const bob = cammina ? 1.5 * Math.cos(2 * th) : 0;
  if (!cammina) senzaSagoma(ctx, (c) => erbetta(c, 104, 0, k ? 4 : 5, k ? 10 : 17, 3));   // fili d'erba sottili
  // zampe: [anca x, fase] — lontane prima (più scure), poi le vicine
  const ZAMPE = [[-60, 0], [26, 0.5], [-44, 0.5], [42, 0]];
  ZAMPE.forEach(([ax, fase], i) => {
    const a = th + fase * TAU;
    const dx = cammina ? 10 * Math.cos(a) : 0, su = cammina ? 8 * Math.max(0, -Math.sin(a)) : 0;
    zampaPecora(ctx, [ax, -60 + bob], [ax + dx, -su], i < 2 ? tono(PECORA.muso) : PECORA.muso);
  });
  ctx.save();
  ctx.translate(0, bob);
  pezzo(ctx, nuvola(-100, -100, 6, 5, 5, 5, 6, 8), PECORA.lana, 0.4);       // codina
  if (!cammina) tubo(ctx, [[60, -86], [80, -66], k ? [90, -54] : [92, -40]], 21, PECORA.muso);   // collo che si allunga
  pezzo(ctx, nuvola(-16, -94, 76, 34, 12, 7, 18, 26), PECORA.lana, 2.2);   // il corpo-nuvola
  for (const [x, y, s] of [[-50, -104, 1], [-6, -116, 1], [24, -88, 1], [-30, -80, 0.8]]) {   // riccioli
    tratto(ctx, [[x - 7 * s, y + 3 * s], [x - 2 * s, y - 4 * s], [x + 5 * s, y - 3 * s], [x + 4 * s, y + 2 * s]], LW * 0.6, '#c4c2dc');
  }
  if (cammina) testaPecora(ctx, 90, -110, 0.3 + 0.03 * Math.sin(th), 'aperti', false);
  else if (k === 0) testaPecora(ctx, 95, -32, 1.05, 'aperti', false);
  else testaPecora(ctx, 93, -50, 0.65, 'felici', true);
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  4. IL TOPOLINO SULLA BARCHETTA DI CARTA                                 */
/* ------------------------------------------------------------------------ */
/*  Barchetta piegata da un foglio di quaderno (righe azzurre, margine
 *  rosa), con una bandierina in cima. Il topolino grigio, berretto da
 *  marinaio col pompon rosso e maglietta a righe, si tiene al bordo e
 *  saluta (f1-f2). La barca dondola sull'acqua; la schiuma resta ferma.  */

const TOPO = {
  pelo: '#bcb5c6', dentro: '#f4b6bb', naso: '#ec8f9a', carta: '#fdfbf3', riga: '#a9c8e8', margine: '#f2a6a6',
  blu: '#4f63a0', rosso: '#e0645c', schiuma: '#ffffff', acqua: '#a9d3ec', ondaScura: '#7fb2d6',
};
Object.assign(TONI, { [TOPO.pelo]: '#a39bb0', [TOPO.carta]: '#e5e7ef' });

/** Le righe del quaderno dentro una forma di carta. */
function righeQuaderno(ctx, forma, ys, xMargine) {
  ctx.save();
  ctx.clip(forma);
  for (const y of ys) linea(ctx, spezzata([[-200, y], [200, y]]), { spessore: 1.1, colore: TOPO.riga, alfa: 0.8 });
  if (xMargine !== undefined) linea(ctx, spezzata([[xMargine, -300], [xMargine + 4, 50]]), { spessore: 1.1, colore: TOPO.margine, alfa: 0.9 });
  ctx.restore();
}

/**
 * L'acqua della strada-fiume: una striscia azzurra dal bordo ondulato che
 * passa DAVANTI al fondo della barca (così la barca "galleggia"), con la
 * schiuma bianca dove lo scafo taglia l'acqua. w = fase delle onde.
 */
function acqua(ctx, w) {
  const L = 126, alto = (x) => {
    const e = 1 - Math.pow(x / L, 4);
    return -10 * e + 1.8 * Math.sin(x / 11 + w) * (1 - (x / L) * (x / L));
  };
  const bordo = [];
  for (let x = -L; x <= L; x += 4) bordo.push([x, alto(x)]);
  const p = spezzata([[-L, LW + 1], ...bordo, [L, LW + 1]]);   // fino al bordo della cella
  tinta(ctx, p, TOPO.acqua, 0.95);
  ctx.save();                                                   // l'ombra della barca sull'acqua
  ctx.clip(p);
  tinta(ctx, Forme.ellisse(10, -2, 80, 5), tonoOmbra(TOPO.acqua), 0.9);
  ctx.restore();
  linea(ctx, spezzata(bordo), { spessore: LW, colore: TOPO.ondaScura });
  for (const [x, y, l] of [[-50, -4, 16], [30, -3.5, 20], [-10, -6, 10]]) {          // riflessi
    tratto(ctx, [[x - l / 2, y], [x + l / 2, y]], LW * 0.7, '#e6f3fb');
  }
  for (const [x, verso, s] of [[-84, -1, 1], [86, 1, 1.15]]) {                       // schiuma
    const y = alto(x) + 1;
    const forme = [Forme.ellisse(x, y, 15 * s, 3.6 * s)];
    for (const [dx, dy, r] of [[-9, -2.5, 4], [-1, -4.5, 5], [7, -3, 4], [verso * 16, -1, 2.6]]) forme.push(Forme.cerchio(x + dx * s, y + dy * s, r * s));
    const sp = unione(forme);
    linea(ctx, sp, { spessore: LW * 2, colore: TOPO.ondaScura });
    tinta(ctx, sp, TOPO.schiuma);
  }
}

function topolino(ctx, k) {
  const saluta = k === 1 || k === 2;
  // la codina che si arriccia dietro
  tubo(ctx, [[18, -80], [2, -88], [-2, -106], [8, -114], [12, -104]], 3, tono(TOPO.pelo), LW * 0.8);
  // la zampina lontana: saluta alta sopra la testa (il braccio passa dietro)
  if (saluta) {
    const mano = k === 1 ? [54, -170] : [70, -164];
    tubo(ctx, [[34, -100], [44, -140], mano], 7, tono(TOPO.pelo));
    manina(ctx, mano[0], mano[1], 6, k === 1 ? -1.75 : -1.2, TOPO.pelo);
  }
  // maglietta alla marinara (bianca a righe blu)
  const busto = pezzo(ctx, Forme.ellisse(36, -84, 19, 23), TOPO.carta, 0.6);
  const righe = new Path2D();
  for (const y of [-90, -80, -70]) righe.addPath(Forme.rettangolo(10, y, 60, 4.5));
  ctx.save();
  ctx.clip(busto);
  tinta(ctx, righe, TOPO.blu, 0.85);
  ctx.restore();
  ombraDentro(ctx, busto, righe, TOPO.blu, 0.6);
  pezzo(ctx, Forme.poligono([[22, -104], [44, -104], [36, -92]], true), TOPO.rosso, 0, LW * 0.8);   // fazzoletto
  // la testa (di profilo, il muso a punta verso destra)
  ombraPortata(ctx, Forme.ellisse(46, -104, 19, 6));                                                 // ombra sotto il muso
  pezzo(ctx, Forme.cerchio(30, -147, 12), tono(TOPO.pelo), 0, LW * 0.85);                          // orecchio lontano
  const testa = pezzo(ctx, [Forme.ellisse(40, -124, 21, 18.5), Forme.ellisse(58, -118, 16, 10.5, 0.25)], TOPO.pelo, 0.8);
  riflesso(ctx, testa, 41, -123, 18, 16, -2.6, -0.8, 0.24, tonoLuce(TOPO.pelo, 0.5), 5);
  pezzo(ctx, Forme.cerchio(20, -140, 14), TOPO.pelo, 0.4, LW * 0.9);                               // orecchio vicino
  tinta(ctx, Forme.cerchio(19, -139.5, 8.5), TOPO.dentro);
  // berretto da marinaio col pompon (fa ombra sulla testa)
  ruotato(ctx, 42, -142, 0.12, () => {
    ombraPortata(ctx, Forme.ellisse(44, -139, 17, 5));
    pezzo(ctx, Forme.rettangolo(28, -146, 28, 7, 2), TOPO.blu, 0.3, LW * 0.85);
    const cima = pezzo(ctx, Forme.ellisse(42, -147, 18, 5.5), TOPO.carta, 0.4, LW * 0.85);
    riflesso(ctx, cima, 41, -147, 15, 4, -3.0, -2.0, 0.4, '#ffffff', 2);
    pezzo(ctx, Forme.cerchio(42, -154, 4.2), TOPO.rosso, 0.3, LW * 0.8);
    tinta(ctx, Forme.cerchio(40.6, -155.4, 1.2), '#ffffff', 0.9);
  });
  occhio(ctx, 50, -127, 5.5, 7, [0.5, -0.1], saluta ? 'felici' : 'aperti');
  guancia(ctx, 53, -114, 5);
  pezzo(ctx, Forme.cerchio(73, -114.5, 4), TOPO.naso, 0, LW * 0.8);
  aParte(ctx, () => {                                                                     // baffi sottili
    for (const [dx, dy] of [[17, -7], [19, 0], [17, 7]]) tratto(ctx, [[66, -113], [66 + dx, -113 + dy]], LW * 0.5, INK2);
  });
  if (saluta) boccaAperta(ctx, 62, -108, 8, 5);
  else tratto(ctx, [[59, -107.5], [63, -105.5], [67, -108]], LW * 0.75);
}

function disegnaTopoBarca(ctx, nome) {
  const k = Number(nome.slice(1)), w = (TAU * k) / 4;
  ctx.save();
  ctx.translate(0, -1.5 + 1.5 * Math.cos(w));                // la barca va su e giù...
  ruotato(ctx, 0, -30, 0.035 * Math.sin(w), () => {          // ...e dondola
    // la vela triangolare della barchetta, con la bandierina in cima
    senzaSagoma(ctx, (c) => tubo(c, [[-4, -170], [-4, -198]], 2.2, '#c99a62', LW * 0.6, true));   // l'asta
    const sv = 3 * Math.sin(w + 1);
    pezzo(ctx, Forme.poligono([[-4, -198], [-30, -192 + sv], [-4, -184]], true), TOPO.rosso, 0, LW * 0.8);
    const vela = pezzo(ctx, Forme.poligono([[-58, -68], [52, -68], [-4, -172]]), TOPO.carta, 1.4);
    righeQuaderno(ctx, vela, [-140, -120, -100, -80]);
    tratto(ctx, [[-4, -170], [-2, -70]], LW * 0.6, INK2);                 // la piega in mezzo
    topolino(ctx, k);
    // lo scafo: un trapezio di carta con il bordo ripiegato
    const scafo = pezzo(ctx, Forme.poligono([[-112, -70], [112, -70], [80, -4], [-80, -4]]), TOPO.carta, 1.6);
    righeQuaderno(ctx, scafo, [-40, -26], -62);
    tratto(ctx, [[-101, -50], [101, -50]], LW * 0.7, INK2);
    tratto(ctx, [[-112, -70], [-92, -50]], LW * 0.6, INK2);
    tratto(ctx, [[112, -70], [92, -50]], LW * 0.6, INK2);
    // le zampine aggrappate al bordo
    if (k === 0 || k === 3) manina(ctx, 46, -71, 5, -1.2, tono(TOPO.pelo));
    tubo(ctx, [[44, -96], [56, -86], [60, -74]], 7, TOPO.pelo);
    manina(ctx, 60, -71, 5.5, -1.3, TOPO.pelo);
  });
  ctx.restore();
  aParte(ctx, () => acqua(ctx, w));   // l'acqua passa davanti al fondo della barca (senza sagoma)
}

/* ------------------------------------------------------------------------ */
/*  5. IL LAMPIONE VIVO                                                     */
/* ------------------------------------------------------------------------ */
/*  Un vecchio lampione verde, sottile, con la lanterna in cima: sul vetro
 *  c'è una faccia. Di giorno dorme (vetro grigio-azzurro), poi sbadiglia
 *  e la luce si scalda, infine si sveglia e brilla di giallo caldo.       */

const LAMP = {
  verde: '#79a589', verdeScuro: '#5e8a72', buio: '#a9b8cf', tiepido: '#efe0a6', luce: '#ffd977', centro: '#fff8da',
};
Object.assign(TONI, { [LAMP.verde]: '#62907a', [LAMP.verdeScuro]: '#4c7660', [LAMP.buio]: '#93a3bd' });

/** La lettera Z disegnata a mano (per chi dorme). */
function zeta(ctx, x, y, s) {
  aParte(ctx, () => linea(ctx, spezzata([[x, y], [x + s, y], [x, y + s], [x + s, y + s]]), { spessore: LW * 0.9, colore: INK }));
}

function disegnaLampione(ctx, nome) {
  const acceso = !['dorme', 'sbadiglia'].includes(nome);
  const parla = nome.startsWith('parla');
  const yL = -420;                                          // centro della lanterna
  if (nome !== 'dorme') {                                   // l'alone di luce (dietro a tutto, senza sagoma)
    aParte(ctx, () => {
      const g = ctx.createRadialGradient(0, yL, 8, 0, yL, 80);
      g.addColorStop(0, conAlfa('#ffe7a0', acceso ? 0.6 : 0.22));
      g.addColorStop(0.55, conAlfa('#ffe7a0', acceso ? 0.22 : 0.08));
      g.addColorStop(1, conAlfa('#ffe7a0', 0));
      ctx.fillStyle = g;
      ctx.fillRect(-80, yL - 90, 160, 180);
    }, true);
  }
  // il piedistallo a gradini
  pezzo(ctx, Forme.rettangolo(-32, -14, 64, 14, 4), LAMP.verdeScuro, 0.8);
  pezzo(ctx, Forme.rettangolo(-24, -30, 48, 17, 4), LAMP.verde, 0.8);
  pezzo(ctx, Forme.poligono([[-18, -29], [18, -29], [8, -70], [-8, -70]], true), LAMP.verde, 0.7);
  // il palo, sottile, con gli anelli
  tubo(ctx, [[0, -62], [0, -366]], 9, LAMP.verde, LW, true);
  for (const y of [-118, -248, -320]) pezzo(ctx, Forme.ellisse(0, y, 9, 4.5), LAMP.verdeScuro, 0, LW * 0.85);
  // i riccioli di ferro sotto la lanterna
  for (const s of [-1, 1]) tubo(ctx, [[0, -328], [s * 16, -334], [s * 28, -350], [s * 24, -364], [s * 15, -358]], 4, LAMP.verde, LW * 0.85);
  pezzo(ctx, Forme.poligono([[-15, -365], [15, -365], [31, -381], [-31, -381]]), LAMP.verdeScuro, 0.5);
  // il vetro (la luce dentro fa parte del disegno)
  const vetro = Forme.poligono([[-30, -380], [30, -380], [42, -460], [-42, -460]]);
  let riempi = LAMP.buio;
  if (nome === 'sbadiglia') {
    riempi = ctx.createLinearGradient(0, -380, 0, -460);
    riempi.addColorStop(0, LAMP.tiepido);
    riempi.addColorStop(1, '#c6cbd2');
  } else if (acceso) {
    riempi = ctx.createRadialGradient(0, -412, 4, 0, -412, 52);
    riempi.addColorStop(0, LAMP.centro);
    riempi.addColorStop(0.55, '#ffeaa6');
    riempi.addColorStop(1, LAMP.luce);
  }
  const lastra = pezzo(ctx, vetro, riempi, nome === 'dorme' ? 0.8 : 0);
  // i lampi di luce sul vetro (due strisce in diagonale, a sinistra)
  const lampo = nome === 'dorme' ? 0.8 : 0.6;
  strisciaLuce(ctx, lastra, -38, -456, 7, 66, 9, '#ffffff', lampo);
  strisciaLuce(ctx, lastra, -26, -456, 2.4, 50, 7, '#ffffff', lampo * 0.9);
  for (const s of [-1, 1]) tubo(ctx, [[s * 30, -380], [s * 42, -460]], 4.5, LAMP.verdeScuro, LW * 0.8, true);   // montanti
  // la faccia sul vetro
  const fy = -426;
  if (nome === 'dorme') {
    for (const s of [-1, 1]) occhio(ctx, s * 14, fy, 9, 10, [0, 0], 'chiusi');
    boccaTonda(ctx, 0, -400, 4, 3.4);
  } else if (nome === 'sbadiglia') {
    for (const s of [-1, 1]) occhio(ctx, s * 14, fy, 8, 9, [0, 0], 'strizzati', -s);
    boccaTonda(ctx, 0, -402, 10, 13);
  } else {
    for (const s of [-1, 1]) occhio(ctx, s * 14, fy, 9, 11.5, [0, 0.25], nome === 'sorride' ? 'felici' : 'aperti');
    if (nome === 'sorride') boccaAperta(ctx, 0, -405, 24, 12);
    else if (nome === 'parla_0') boccaAperta(ctx, 0, -404, 16, 11);
    else sorriso(ctx, 0, -401, 14, 0.3);
    if (parla || nome === 'sveglio') for (const s of [-1, 1]) tratto(ctx, [[s * 7, -444], [s * 14, -447], [s * 21, -445]], LW * 0.8);
  }
  guancia(ctx, -25, -407, 6);
  guancia(ctx, 25, -407, 6);
  // il tettuccio a piramide col pomello
  pezzo(ctx, Forme.rettangolo(-47, -468, 94, 10, 3), LAMP.verdeScuro, 0, LW * 0.9);
  pezzo(ctx, Forme.poligono([[-52, -466], [52, -466], [13, -494], [-13, -494]]), LAMP.verde, 1);
  pezzo(ctx, Forme.cerchio(0, -499, 6), LAMP.verdeScuro, 0.3, LW * 0.9);
  tinta(ctx, Forme.cerchio(-2, -501, 1.6), '#ffffff', 0.85);
  tubo(ctx, [[0, -504], [0, -507]], 2.5, LAMP.verdeScuro, LW * 0.7, true);
  if (nome === 'dorme') {
    zeta(ctx, 44, -476, 7);
    zeta(ctx, 55, -492, 8.5);
    zeta(ctx, 66, -507, 9.5);
  }
}

/* ------------------------------------------------------------------------ */
/*  6. LA CHIOCCIOLA POSTINA                                                */
/* ------------------------------------------------------------------------ */
/*  Lumachina color crema col guscio rosa-salmone (il colore della posta)
 *  con la spirale crema, un berrettino blu da postino e la borsa delle
 *  lettere. Di lato (verso destra) striscia allungandosi e accorciandosi;
 *  di fronte saluta e parla. Gli occhi stanno in cima alle antenne.       */

const LUMACA = {
  pelle: '#f2dfb6', guscio: '#f4a28c', spirale: '#fdf0d9', berretto: '#5d8fd2', visiera: '#3e659f',
  stemma: '#f3cf62', borsa: '#c28d58', busta: '#fffdf6', francobollo: '#e0645c',
};
Object.assign(TONI, { [LUMACA.pelle]: '#e3ca97', [LUMACA.guscio]: '#de8a74', [LUMACA.berretto]: '#4a78b9', [LUMACA.borsa]: '#a6713f' });

function guscio(ctx, x, y, r) {
  const g = pezzo(ctx, Forme.ellisse(x, y, r, r * 0.96), LUMACA.guscio, 1.6);
  const punti = [];
  for (let i = 0; i <= 44; i++) {                       // la spirale, da fuori verso il centro
    const t = i / 44, a = -2.2 + t * TAU * 2.05, rr = r * (0.8 - 0.7 * t);
    punti.push([x + 3 + Math.cos(a) * rr, y + 2 + Math.sin(a) * rr]);
  }
  tubo(ctx, punti, r * 0.14, LUMACA.spirale, LW * 0.75);
  // il guscio è lucido: una fascia di luce in alto a sinistra e un luccichio
  riflesso(ctx, g, x, y, r * 0.9, r * 0.86, -2.85, -1.75, 0.16, tonoLuce(LUMACA.guscio, 0.62), 4);
  luccichio(ctx, x - r * 0.52, y - r * 0.5, r * 0.085, 0.95);
}

/** Un'antenna con l'occhio in cima. */
function antenna(ctx, base, punta, colore, r, sguardo, stato) {
  tubo(ctx, [base, lerp2(base, punta, 0.5), punta], 5.5, colore, LW * 0.9);
  tinta(ctx, Forme.cerchio(punta[0], punta[1], r + LW * 0.6), INK);
  occhio(ctx, punta[0], punta[1], r, r, sguardo, stato);
}

/** La borsa da postino con una lettera che spunta. */
function borsaPosta(ctx, x, y, l, a) {
  ruotato(ctx, x + l / 2, y, 0.12, () => {
    pezzo(ctx, Forme.poligono([[x + 3, y - 2], [x + 15, y - 14], [x + 19, y - 4]]), LUMACA.busta, 0, LW * 0.75);
    tinta(ctx, Forme.rettangolo(x + 12, y - 11, 4, 4), LUMACA.francobollo);
    pezzo(ctx, Forme.rettangolo(x, y, l, a, 4), LUMACA.borsa, 0.6, LW * 0.9);
    pezzo(ctx, Forme.rettangolo(x - 1, y - 1, l + 2, a * 0.45, 3), tono(LUMACA.borsa), 0, LW * 0.8);
    pezzo(ctx, Forme.cerchio(x + l / 2, y + a * 0.42, 2.2), LUMACA.stemma, 0, LW * 0.6);
  });
}

/** Il berrettino da postino (di lato la visiera guarda a destra). */
function berrettoPosta(ctx, x, y, ang, fronte) {
  ruotato(ctx, x, y, ang, () => {
    ombraPortata(ctx, Forme.ellisse(x + 3, y + 3.5, 16, 4.5));                     // ombra sulla fronte
    const b = pezzo(ctx, Forme.poligono([[x - 13, y], [x + 13, y], [x + 15, y - 13], [x - 14, y - 13]]), LUMACA.berretto, 0.4, LW * 0.9);
    tinta(ctx, Forme.rettangolo(x - 13, y - 5, 26, 3), '#8db4e6');
    strisciaLuce(ctx, b, x - 11, y - 12, 3, 6, -0.5, tonoLuce(LUMACA.berretto, 0.5), 1);
    pezzo(ctx, Forme.cerchio(fronte ? x : x + 7, y - 7, 2.6), LUMACA.stemma, 0, LW * 0.6);
    if (fronte) pezzo(ctx, Forme.ellisse(x, y + 1, 15, 3.5), LUMACA.visiera, 0, LW * 0.8);
    else pezzo(ctx, Forme.ellisse(x + 17, y + 0.5, 9, 2.6, 0.1), LUMACA.visiera, 0, LW * 0.8);
  });
}

function lumacaLato(ctx, k) {
  const e = Math.sin((TAU * k) / 4);                         // +1 allungata, -1 raccolta
  const hx = 62 + 8 * e, cx = -90 - 3 * e, gx = -16 + 3 * e, gy = -60 - 1.5 * e, alto = 1 - 0.12 * e;
  const ondeggia = 2 * Math.cos((TAU * k) / 4);
  antenna(ctx, [hx - 6, -84], [hx - 14 + ondeggia, -114], tono(LUMACA.pelle), 7.5, [0.6, 0], 'aperti');
  const piede = Forme.poligono([[cx, -1], [cx + 26, -13 * alto], [gx, -26 * alto], [hx - 12, -28], [hx + 22, -12], [hx + 22, -1]], true);
  const corpo = pezzo(ctx, [piede, Forme.ellisse(hx - 4, -42, 15, 28, 0.25), Forme.cerchio(hx + 3, -68, 22)], LUMACA.pelle, 0.8);
  riflesso(ctx, corpo, hx + 3, -68, 19, 19, -2.6, -1.1, 0.22, tonoLuce(LUMACA.pelle, 0.55), 4);
  for (let i = 0; i < 4; i++) {                              // le onde del piede che striscia
    const x = cx + 30 + i * 30 + 6 * e;
    tratto(ctx, [[x - 7, -4], [x, -7], [x + 7, -4]], LW * 0.55, INK2);
  }
  guscio(ctx, gx, gy, 48);
  tubo(ctx, [[22, -36], [hx - 22, -52]], 2.4, tono(LUMACA.borsa), LW * 0.7);
  borsaPosta(ctx, 8, -36, 26, 20);
  guancia(ctx, hx + 10, -60, 5);
  sorriso(ctx, hx + 15, -54, 7, 0.35);
  berrettoPosta(ctx, hx - 6, -86, -0.32, false);
  antenna(ctx, [hx + 6, -84], [hx + 12 - ondeggia * 0.5, -120], LUMACA.pelle, 8.5, [0.6, 0], 'aperti');
}

function lumacaFronte(ctx, aperta) {
  ctx.translate(-6, 0);                       // il piede della lumaca al centro della cella
  guscio(ctx, -30, -70, 48);
  antenna(ctx, [-2, -96], [-16, -126], LUMACA.pelle, 8.5, [0, 0.2], 'aperti');
  antenna(ctx, [18, -96], [32, -126], LUMACA.pelle, 8.5, [0, 0.2], 'aperti');
  const corpo = pezzo(ctx, [Forme.ellisse(8, -10, 46, 10), Forme.ellisse(8, -42, 21, 32), Forme.cerchio(8, -76, 26)], LUMACA.pelle, 0.8);
  riflesso(ctx, corpo, 7, -76, 22, 22, -2.7, -0.9, 0.2, tonoLuce(LUMACA.pelle, 0.55), 5);
  tubo(ctx, [[-8, -52], [8, -44], [28, -34]], 2.4, tono(LUMACA.borsa), LW * 0.7);
  borsaPosta(ctx, 22, -36, 26, 20);
  berrettoPosta(ctx, 8, -98, 0, true);
  guancia(ctx, -6, -72, 5.5);
  guancia(ctx, 22, -72, 5.5);
  if (aperta) boccaAperta(ctx, 8, -70, 12, 8);
  else sorriso(ctx, 8, -68, 10, 0.32);
}

function disegnaChiocciola(ctx, nome) {
  const [vista, azione, n] = nome.split('_');
  if (vista === 'lato') lumacaLato(ctx, Number(n));
  else lumacaFronte(ctx, azione === 'parla' && n === '0');
}

/* ------------------------------------------------------------------------ */
/*  7. I FIORI CANTANTI                                                     */
/* ------------------------------------------------------------------------ */
/*  Un vaso di coccio con tre fiori dal visetto tondo: rosa, giallo e lilla.
 *  Cantano in coro: le teste dondolano e le bocche si aprono a turno.     */

const FIORI = { vaso: '#d98a5f', bordo: '#e49a6e', terra: '#7a5236', stelo: '#7fb865', foglia: '#8ec870', viso: '#fdf1d2' };
Object.assign(TONI, { [FIORI.vaso]: '#c27149', [FIORI.bordo]: '#cf825a', [FIORI.stelo]: '#679f50', [FIORI.foglia]: '#74ad58' });

const TRE_FIORI = [
  { colore: '#f4a3b8', ombra: '#df8aa1', base: [-14, -64], testa: [-44, -146], r: 17, petali: 6, forma: 'tondo', occhi: 'felici', fase: 0 },
  { colore: '#f6d265', ombra: '#e2b947', base: [2, -64], testa: [4, -176], r: 17, petali: 11, forma: 'lungo', occhi: 'aperti', fase: 0.5 },
  { colore: '#c4a8e4', ombra: '#a88dcd', base: [16, -64], testa: [46, -138], r: 16, petali: 5, forma: 'cuore', occhi: 'felici', fase: 0.25 },
];
// quanto è aperta la bocca di ogni fiore (rosa, giallo, lilla) nei 4 fotogrammi
const CORO = [[1, 0, 0.6], [0, 1, 0], [0.6, 0, 1], [0, 1, 0]];

function fogliolina(ctx, x, y, ang, lung) {
  const d = polare(ang, lung), n = polare(ang + Math.PI / 2, lung * 0.32);
  const p = new Path2D();
  p.moveTo(x, y);
  p.quadraticCurveTo(x + d[0] * 0.5 + n[0], y + d[1] * 0.5 + n[1], x + d[0], y + d[1]);
  p.quadraticCurveTo(x + d[0] * 0.5 - n[0], y + d[1] * 0.5 - n[1], x, y);
  pezzo(ctx, p, FIORI.foglia, 0.3, LW * 0.85);
  tratto(ctx, [[x, y], [x + d[0] * 0.7, y + d[1] * 0.7]], LW * 0.5, '#5f9447');
}

function testaFiore(ctx, x, y, F, apertura, ang) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const r = F.r, forme = [];
  for (let i = 0; i < F.petali; i++) {
    const a = (i / F.petali) * TAU - Math.PI / 2;
    if (F.forma === 'tondo') forme.push(Forme.ellisse(...polare(a, r * 0.98), r * 0.62, r * 0.52, a));
    else if (F.forma === 'lungo') forme.push(Forme.ellisse(...polare(a, r * 1.05), r * 0.66, r * 0.25, a));
    else forme.push(Forme.ellisse(...polare(a, r * 0.92), r * 0.66, r * 0.6, a));
  }
  const corolla = pezzo(ctx, forme, F.colore, 0.8, LW);
  riflesso(ctx, corolla, 0, 0, r * 1.25, r * 1.25, -2.7, -1.2, 0.16, tonoLuce(F.colore, 0.5), 5);
  pezzo(ctx, Forme.cerchio(0, 0, r * 0.7), FIORI.viso, 0.4, LW * 0.9);
  const canta = apertura > 0;
  for (const s of [-1, 1]) occhio(ctx, s * r * 0.27, -r * 0.14, r * 0.13, r * 0.16, [0, 0], canta ? F.occhi : 'aperti');
  guancia(ctx, -r * 0.42, r * 0.16, r * 0.14);
  guancia(ctx, r * 0.42, r * 0.16, r * 0.14);
  if (canta) boccaTonda(ctx, 0, r * 0.27, r * 0.12 + r * 0.05 * apertura, r * 0.1 + r * 0.12 * apertura);
  else sorriso(ctx, 0, r * 0.2, r * 0.3, 0.3);
  ctx.restore();
}

function disegnaFiori(ctx, nome) {
  const k = Number(nome.slice(1));
  const teste = TRE_FIORI.map((F) => {
    const ang = 0.09 * Math.sin(TAU * (k / 4 + F.fase));
    return { F, ang, pos: piu(F.base, ruota([F.testa[0] - F.base[0], F.testa[1] - F.base[1]], ang)) };
  });
  // gli steli con le foglioline
  teste.forEach(({ F, pos }, i) => {
    const m = lerp2(F.base, pos, 0.5), curva = [m[0] - (pos[0] - F.base[0]) * 0.25, m[1]];
    tubo(ctx, [F.base, curva, pos], 4.5, FIORI.stelo, LW * 0.85);
    const f = lerp2(F.base, curva, 0.6);
    fogliolina(ctx, f[0], f[1], i === 0 ? -2.6 : i === 1 ? -0.5 : -0.4, 22);
    if (i === 1) fogliolina(ctx, f[0] - 1, f[1] - 18, -2.7, 18);
  });
  // il vaso di coccio
  const vaso = pezzo(ctx, Forme.poligono([[-40, -56], [40, -56], [30, 0], [-30, 0]]), FIORI.vaso, 1.4);
  const orlo = pezzo(ctx, Forme.rettangolo(-47, -70, 94, 16, 5), FIORI.bordo, 0.8);
  strisciaLuce(ctx, orlo, -42, -67, 14, 3, 0, tonoLuce(FIORI.bordo, 0.5), 1);
  tinta(ctx, Forme.ellisse(0, -66, 38, 2.6), FIORI.terra);
  const fascia = new Path2D();                                                // una fascia dipinta
  fascia.addPath(Forme.rettangolo(-50, -38, 100, 6));
  for (const x of [-20, 0, 20]) fascia.addPath(Forme.cerchio(x, -22, 2.6));
  ctx.save();
  ctx.clip(vaso);
  tinta(ctx, fascia, '#e9a77f');
  ctx.restore();
  ombraDentro(ctx, vaso, fascia, '#e9a77f', 1.4);
  strisciaLuce(ctx, vaso, -33, -52, 5, 44, 4, tonoLuce(FIORI.vaso, 0.45), 0.95);   // coccio smaltato, lucido
  teste.forEach(({ F, ang, pos }, i) => testaFiore(ctx, pos[0], pos[1], F, CORO[k][i], ang * 1.6));
  // le note del coro
  const NOTE = [[[-82, -190], [76, -176]], [[-58, -196], [72, -190]], [[-80, -174], [64, -184]], [[-64, -190], [78, -196]]];
  nota(ctx, NOTE[k][0][0], NOTE[k][0][1], 8, k % 2 === 1);
  nota(ctx, NOTE[k][1][0], NOTE[k][1][1], 8, k % 2 === 0);
}

/* ------------------------------------------------------------------------ */
/*  8. IL GUFO BIBLIOTECARIO                                                */
/* ------------------------------------------------------------------------ */
/*  Gufo color nocciola con il disco del viso a cuore, occhiali tondi e un
 *  golfino verde acqua coi bottoni. Tiene stretto un libro; quando parla
 *  alza un'ala come per spiegare.                                         */

const GUFO = {
  piume: '#b8916b', viso: '#f6e6c6', petto: '#f3e2c0', golf: '#7fb3ad', bottone: '#fdf3dc',
  becco: '#f1b85a', zampe: '#eeb158', libro: '#d9776c', pagine: '#fbf3df', occhiali: '#7a5338',
};
Object.assign(TONI, {
  [GUFO.piume]: '#9d7654', [GUFO.viso]: '#ead5b0', [GUFO.petto]: '#e6d1aa', [GUFO.golf]: '#68a09a',
  [GUFO.libro]: '#c15f57', [GUFO.zampe]: '#d6963f',
});

/** La "mano" del gufo: tre piume che spuntano dalla manica. */
function manoPiume(ctx, polso, ang) {
  pezzo(ctx, [-0.45, 0, 0.45].map((d) => lobo(polso, ang + d, 17, 8)), GUFO.piume, 0, LW * 0.85);
}

function libro(ctx, x, y, ang) {
  ruotato(ctx, x, y, ang, () => {
    pezzo(ctx, Forme.rettangolo(x - 27, y - 22, 56, 44, 3), GUFO.pagine, 0, LW * 0.85);
    const copertina = pezzo(ctx, Forme.rettangolo(x - 30, y - 22, 56, 44, 4), GUFO.libro, 0.8);
    strisciaLuce(ctx, copertina, x - 18, y + 20, 4, -40, 12, tonoLuce(GUFO.libro, 0.5), 0.9);   // copertina lucida
    pezzo(ctx, Forme.rettangolo(x - 30, y - 22, 9, 44, 3), tono(GUFO.libro), 0, LW * 0.8);        // il dorso
    pezzo(ctx, Forme.rettangolo(x - 14, y - 14, 30, 12, 2), GUFO.pagine, 0, LW * 0.7);            // l'etichetta
    tratto(ctx, [[x - 9, y - 8], [x + 11, y - 8]], LW * 0.6, INK2);
    const luna = new Path2D();                                                                     // una lunetta
    luna.arc(x + 1, y + 9, 6, -2.2, 2.2, false);
    luna.quadraticCurveTo(x - 3, y + 9, x + 1 + 6 * Math.cos(-2.2), y + 9 + 6 * Math.sin(-2.2));
    tinta(ctx, luna, '#f6dc8a');
  });
}

function disegnaGufo(ctx, nome) {
  const [, azione, n] = nome.split('_');
  const k = Number(n), parla = azione === 'parla', aperta = parla && k === 0, chiusi = azione === 'fermo' && k === 1;
  for (const s of [-1, 1]) pezzo(ctx, [-1, 0, 1].map((d) => Forme.ellisse(s * 20 + d * 6.5, -5, 4.2, 5.5)), GUFO.zampe, 0, LW * 0.85);
  const corpo = pezzo(ctx, Forme.ellisse(0, -86, 58, 76), GUFO.piume, 1.4);
  // il golfino aperto sul petto color crema
  ctx.save();
  ctx.clip(corpo);
  pezzo(ctx, Forme.ellisse(0, -116, 26, 36), GUFO.petto, 0, LW * 0.8);
  for (const [x, y] of [[-8, -120], [8, -120], [0, -108], [-8, -96], [8, -96]]) tratto(ctx, [[x - 3.5, y - 2], [x, y + 1.5], [x + 3.5, y - 2]], LW * 0.55, INK2);
  for (const s of [-1, 1]) {
    pezzo(ctx, Forme.poligono([[s * 80, -156], [s * 12, -156], [s * 3, -96], [s * 3, -30], [s * 80, -30]]), GUFO.golf, 1.2);
    pezzo(ctx, Forme.rettangolo(s > 0 ? 3 : -80, -40, 77, 12), tono(GUFO.golf), 0, LW * 0.8);   // il bordo a costine
  }
  ctx.restore();
  linea(ctx, corpo, { spessore: LW, colore: INK });
  for (const y of [-88, -70, -52]) {
    pezzo(ctx, Forme.cerchio(8, y, 3), GUFO.bottone, 0.25, LW * 0.7);
    tinta(ctx, Forme.cerchio(6.9, y - 1.1, 1), '#ffffff');
  }
  // il libro e le ali con le maniche
  const maniche = (spalla, gomito, polso) => tubo(ctx, [spalla, gomito, polso], 17, GUFO.golf);
  libro(ctx, parla ? 10 : 0, -82, parla ? 0.12 : -0.05);
  maniche([48, -126], [62, -94], [36, -82]);
  manoPiume(ctx, [34, -82], Math.PI);
  if (parla) {
    maniche([-48, -126], [-72, -104], [-68, -136]);
    manoPiume(ctx, [-68, -138], -Math.PI / 2 + (k ? 0.15 : -0.1));
  } else {
    maniche([-48, -126], [-62, -94], [-36, -82]);
    manoPiume(ctx, [-34, -82], 0);
  }
  // la testa: ciuffi, disco del viso a cuore, occhi, occhiali, becco
  for (const s of [-1, 1]) {                                        // i ciuffi di piume
    pezzo(ctx, [[0.25, 34], [0.6, 30], [0.95, 22]].map(([d, l]) => lobo([s * 34, -200], -Math.PI / 2 + s * d, l, 12)), GUFO.piume, 0.4);
  }
  ombraPortata(ctx, Forme.ellisse(6, -126, 46, 11));                       // ombra della testa sul petto
  const testa = pezzo(ctx, Forme.ellisse(0, -172, 58, 48), GUFO.piume, 1.2);
  riflesso(ctx, testa, -3, -170, 52, 42, -2.8, -0.9, 0.15, tonoLuce(GUFO.piume, 0.42), 7);
  pezzo(ctx, [Forme.cerchio(-21, -174, 25), Forme.cerchio(21, -174, 25), Forme.poligono([[-34, -164], [34, -164], [0, -138]], true)], GUFO.viso, 0.5, LW * 0.85);
  for (const s of [-1, 1]) {
    occhio(ctx, s * 21, -176, 11, 13, [0, 0.15], chiusi ? 'chiusi' : 'aperti');
    linea(ctx, Forme.cerchio(s * 21, -176, 17), { spessore: 2.4, colore: GUFO.occhiali });
    tratto(ctx, [[s * 9, -182], [s * 14, -189]], 1.6, '#ffffff', 0.9);                       // riflessi sul vetro
    tratto(ctx, [[s * 10, -175], [s * 17, -185]], 0.9, '#ffffff', 0.8);
    tratto(ctx, [[s * 8, -200], [s * 22, -204], [s * 36, -199]], LW * 0.75, INK2);            // sopracciglio
    guancia(ctx, s * 30, -156, 6);
  }
  tratto(ctx, [[-4, -177], [0, -180], [4, -177]], 2.4, GUFO.occhiali);                        // il ponte degli occhiali
  if (aperta) {
    pezzo(ctx, Forme.poligono([[-6, -153], [6, -153], [0, -142]], true), BOCCA_DENTRO, 0, LW * 0.8);
    pezzo(ctx, Forme.poligono([[-7, -164], [7, -164], [0, -153]], true), GUFO.becco, 0, LW * 0.85);
    pezzo(ctx, Forme.poligono([[-5, -151], [5, -151], [0, -144]], true), GUFO.becco, 0, LW * 0.8);
  } else {
    pezzo(ctx, Forme.poligono([[-7, -164], [7, -164], [0, -149]], true), GUFO.becco, 0, LW * 0.85);
  }
}

/* ------------------------------------------------------------------------ */
/*  9. L'ORSETTO IN MONGOLFIERA                                             */
/* ------------------------------------------------------------------------ */
/*  Una mongolfiera a spicchi rosa, crema e verde acqua; sotto, nel cesto
 *  di vimini, un orsetto con la sciarpa rossa che saluta con la zampa.    */

const MONGO = {
  rosa: '#f4aab4', crema: '#fbf1dc', acqua: '#86c8c0', vimini: '#cf9f62', bordo: '#a8743f', sacco: '#e8d3a8',
  orso: '#a9784f', muso: '#f1dcbc', naso: '#3e2a22', sciarpa: '#e3685c',
};
Object.assign(TONI, { [MONGO.vimini]: '#b5844b', [MONGO.orso]: '#8f6240', [MONGO.sciarpa]: '#c9544b', [MONGO.sacco]: '#d4bb8b' });

const PALLONE = { cy: -342, r: 150, bocca: -190, mezzaBocca: 36 };

/** La sagoma del pallone: una mezza sfera sopra e una "goccia" che si stringe. */
function involucro() {
  const { cy, r, bocca, mezzaBocca } = PALLONE;
  const p = new Path2D();
  p.moveTo(-mezzaBocca, bocca);
  p.bezierCurveTo(-80, bocca - 42, -r, cy + 70, -r, cy);
  p.arc(0, cy, r, Math.PI, TAU);
  p.bezierCurveTo(r, cy + 70, 80, bocca - 42, mezzaBocca, bocca);
  p.closePath();
  return p;
}

/** Mezza larghezza del pallone all'altezza y (serve per far curvare gli spicchi). */
function mezzaLarghezza(y) {
  const { cy, r, bocca, mezzaBocca } = PALLONE;
  if (y <= cy) return Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
  // sotto l'equatore seguo la curva di Bézier del fianco destro
  const P = [[r, cy], [r, cy + 70], [80, bocca - 42], [mezzaBocca, bocca]];
  let migliore = mezzaBocca, distanza = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, u = 1 - t;
    const x = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
    const yy = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
    if (Math.abs(yy - y) < distanza) { distanza = Math.abs(yy - y); migliore = x; }
  }
  return migliore;
}

/** Gli spicchi colorati e le cuciture (dentro la sagoma già ritagliata). */
function spicchi(ctx, ys, larghezze) {
  const K = 9, COLORI = [MONGO.rosa, MONGO.crema, MONGO.acqua, MONGO.crema];
  const confine = (j) => Math.sin(Math.PI * (j / K - 0.5));      // da -1 (sinistra) a 1 (destra)
  for (let j = 0; j < K; j++) {
    const p = new Path2D();
    ys.forEach((y, i) => (i ? p.lineTo(larghezze[i] * confine(j), y) : p.moveTo(larghezze[i] * confine(j), y)));
    for (let i = ys.length - 1; i >= 0; i--) p.lineTo(larghezze[i] * confine(j + 1) + 0.5, ys[i]);
    p.closePath();
    tinta(ctx, p, COLORI[Math.abs(j - 4) % 4]);
  }
  for (let j = 1; j < K; j++) {
    linea(ctx, spezzata(ys.map((y, i) => [larghezze[i] * confine(j), y])), { spessore: LW * 0.6, colore: INK2 });
  }
}

function mongolfiera(ctx) {
  const { cy, r, bocca } = PALLONE;
  const sagoma = involucro();
  const ys = [];
  for (let y = cy - r; y < bocca; y += 6) ys.push(y);
  ys.push(bocca);
  const larghezze = ys.map(mezzaLarghezza);
  ctx.save();                                                    // il contorno
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineWidth = LW * 1.7;
  ctx.stroke(sagoma);
  ctx.translate(LW * 0.3, LW * 0.36);
  ctx.lineWidth = LW * 2;
  ctx.stroke(sagoma);
  ctx.restore();
  // prima tutto in ombra (spicchi + velo lilla-blu), poi gli spicchi in luce
  // dentro la sagoma spostata verso l'alto a sinistra: resta in ombra una falce netta
  ctx.save();
  ctx.clip(sagoma);
  spicchi(ctx, ys, larghezze);
  tinta(ctx, sagoma, 'rgb(64, 46, 128)', 0.2);
  const luce = new Path2D();
  luce.addPath(sagoma, new DOMMatrix([1, 0, 0, 1, -15, -9]));
  ctx.clip(luce);
  spicchi(ctx, ys, larghezze);
  ctx.restore();
  // il pallone è lucido: una fascia di luce a bordo netto e un luccichio
  riflesso(ctx, sagoma, -4, cy + 4, r * 0.86, r * 0.84, -2.75, -1.95, 0.14, 'rgba(255, 255, 255, 0.6)', 4);
  luccichio(ctx, -78, cy - 66, 9, 0.85);
  // la gonnellina in fondo al pallone
  pezzo(ctx, Forme.poligono([[-36, bocca], [36, bocca], [28, bocca + 18], [-28, bocca + 18]]), MONGO.acqua, 0.5);
}

function orsetto(ctx, k) {
  pezzo(ctx, Forme.ellisse(0, -64, 25, 20), MONGO.orso, 0.8);
  ombraPortata(ctx, Forme.ellisse(4, -78, 21, 7));                     // ombra sotto il muso
  for (const s of [-1, 1]) {
    pezzo(ctx, Forme.cerchio(s * 18, -123, 9), MONGO.orso, s > 0 ? 0.3 : 0, LW * 0.9);
    tinta(ctx, Forme.cerchio(s * 18, -122, 4.5), MONGO.muso);
  }
  const testa = pezzo(ctx, Forme.cerchio(0, -102, 25), MONGO.orso, 0.9);
  riflesso(ctx, testa, -1, -101, 21, 21, -2.75, -0.85, 0.22, tonoLuce(MONGO.orso, 0.4), 6);
  pezzo(ctx, Forme.ellisse(0, -93, 11.5, 8.5), MONGO.muso, 0, LW * 0.8);
  pezzo(ctx, Forme.ellisse(0, -97, 4.5, 3.2), MONGO.naso, 0, LW * 0.6);
  tratto(ctx, [[-4.5, -90.5], [0, -88], [4.5, -90.5]], LW * 0.75);
  for (const s of [-1, 1]) {
    occhio(ctx, s * 10, -108, 4.5, 5.5, [0, 0.1], k ? 'felici' : 'aperti');
    guancia(ctx, s * 15, -96, 4.5);
  }
  // la sciarpa rossa: due code che svolazzano nel vento, con la frangia
  const sv = k ? 3 : -3;
  for (const [dy, l] of [[0, 1], [7, 0.8]]) {
    const fine = [-16 - 40 * l, -84 + dy + sv];
    tubo(ctx, [[-12, -77 + dy * 0.4], [-26, -86 + dy - sv], [-38 * l - 4, -80 + dy + sv * 0.5], fine], 7, MONGO.sciarpa, LW * 0.85);
    for (const d of [-2.5, 0, 2.5]) tratto(ctx, [[fine[0] - 3, fine[1] + d], [fine[0] - 8, fine[1] + d * 1.6]], LW * 0.7, MONGO.sciarpa);
  }
  tubo(ctx, [[-20, -78], [0, -74], [20, -78]], 8, MONGO.sciarpa, LW * 0.9);
}

function disegnaOrsoMongolfiera(ctx, nome) {
  const k = Number(nome.slice(1));
  mongolfiera(ctx);
  // le corde di dietro, l'orsetto, poi le corde davanti
  for (const s of [-1, 1]) linea(ctx, spezzata([[s * 12, -172], [s * 15, -66]]), { spessore: LW * 0.8, colore: INK });
  orsetto(ctx, k);
  for (const s of [-1, 1]) linea(ctx, spezzata([[s * 28, -172], [s * 46, -66]]), { spessore: LW * 0.8, colore: INK });
  // i sacchetti di zavorra
  for (const s of [-1, 1]) {
    linea(ctx, spezzata([[s * 48, -64], [s * 56, -48]]), { spessore: LW * 0.7, colore: INK });
    pezzo(ctx, Forme.ellisse(s * 57, -38, 8, 10), MONGO.sacco, 0.4, LW * 0.85);
    tratto(ctx, [[s * 53, -46], [s * 61, -46]], LW * 0.7);
  }
  // il cesto di vimini
  pezzo(ctx, Forme.poligono([[-46, -60], [46, -60], [40, 0], [-40, 0]]), MONGO.vimini, 1.4);
  for (const y of [-44, -29, -14]) tratto(ctx, [[-44, y], [44, y]], LW * 0.6, '#9a6c3a');
  for (let i = 0; i < 4; i++) {
    for (let x = -38 + (i % 2) * 7; x < 38; x += 14) {
      const y0 = -60 + i * 15.5;
      tratto(ctx, [[x, y0 + 3], [x, y0 + 12]], LW * 0.55, '#9a6c3a');
    }
  }
  const orlo = pezzo(ctx, Forme.rettangolo(-51, -70, 102, 12, 5), MONGO.bordo, 0.5);
  strisciaLuce(ctx, orlo, -47, -68, 30, 2.6, 0, tonoLuce(MONGO.bordo, 0.45), 1);
  // le zampe: una sul bordo, l'altra saluta
  manina(ctx, -22, -70, 7, -1.4, MONGO.orso);
  const mano = k ? [50, -128] : [42, -134];
  tubo(ctx, [[16, -78], [34, -92], mano], 12, MONGO.orso);
  manina(ctx, mano[0], mano[1], 8, k ? -1.15 : -1.7, MONGO.orso);
  tinta(ctx, Forme.ellisse(mano[0], mano[1] + 1, 4, 3.4), MONGO.muso);
}

/* ======================================================================== */
/*  ATLANTI                                                                 */
/* ======================================================================== */

const serie = (prefisso, n) => Array.from({ length: n }, (_, k) => prefisso + k);

/** Gli abitanti più affettuosi: rossore coi trattini sulle guance. */
const AFFETTUOSI = ['rana', 'chiocciola', 'fiori_cantanti', 'gufo'];

/**
 * Costruisce un atlante. Ogni cella ha l'origine a terra, al centro in basso
 * (oppure al centro della cella, se "centro" è vero). "spessore" è la linea
 * interna; sagomaManga ripassa la sagoma esterna, spessa il doppio.
 */
function atlante(chi, nomi, l, a, altezzaMondo, spessore, disegna, centro = false) {
  const { tela, fotogrammi } = creaAtlante(nomi, { l, a }, (ctx, nome) => {
    LW = spessore;
    TRATTINI = AFFETTUOSI.includes(chi);
    sagomaManga(ctx, l, a, (c) => {
      c.translate(l / 2, centro ? a / 2 : a - spessore);
      disegna(c, nome);
    }, { fuori: spessore * 0.82, dentro: spessore, apertura: 2.7 });
  });
  return { tela, fotogrammi, cella: { l, a }, altezzaMondo };
}

/**
 * Dipinge tutti gli abitanti delle fiabe. Restituisce
 * { rana, pesce_volante, pecora_nuvola, topo_barca, lampione_vivo,
 *   chiocciola, fiori_cantanti, gufo, orso_mongolfiera }.
 */
export async function creaFiabe() {
  const elenco = [
    ['rana', [...serie('fronte_suona_', 4), 'fronte_fermo_0', 'fronte_parla_0', 'fronte_parla_1'], 192, 256, 0.95, 1.9, disegnaRana],
    ['pesce_volante', serie('f', 4), 192, 128, 0.5, 1.8, disegnaPesce, true],
    ['pecora_nuvola', ['lato_fermo_0', 'lato_fermo_1', ...serie('lato_cammina_', 4)], 256, 192, 1.1, 1.8, disegnaPecora],
    ['topo_barca', serie('f', 4), 256, 224, 1.0, 1.8, disegnaTopoBarca],
    ['lampione_vivo', ['dorme', 'sbadiglia', 'sveglio', 'sorride', 'parla_0', 'parla_1'], 160, 512, 3.0, 1.8, disegnaLampione],
    ['chiocciola', [...serie('lato_cammina_', 4), 'fronte_fermo_0', 'fronte_parla_0', 'fronte_parla_1'], 224, 160, 0.55, 1.8, disegnaChiocciola],
    ['fiori_cantanti', serie('f', 4), 192, 224, 0.85, 1.8, disegnaFiori],
    ['gufo', ['fronte_fermo_0', 'fronte_fermo_1', 'fronte_parla_0', 'fronte_parla_1'], 192, 256, 0.95, 1.9, disegnaGufo],
    ['orso_mongolfiera', ['f0', 'f1'], 384, 512, 6.0, 1.7, disegnaOrsoMongolfiera],
  ];
  const risultato = {};
  for (const [nome, nomi, l, a, h, spessore, disegna, centro] of elenco) {
    risultato[nome] = atlante(nome, nomi, l, a, h, spessore, disegna, centro);
    await respira();   // lascia respirare la pagina tra un atlante e l'altro
  }
  return risultato;
}
