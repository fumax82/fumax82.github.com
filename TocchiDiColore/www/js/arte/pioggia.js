/* ==========================================================================
 *  pioggia.js — LA PIOGGIA IMMAGINATA DA LIA
 *  --------------------------------------------------------------------------
 *  Nel cortometraggio, quando comincia a piovere, Lia ascolta: il fruscio
 *  delle auto nelle pozzanghere diventa, nella sua fantasia, un banco di
 *  PESCI-AUTOMOBILE che nuotano lungo la strada trasformata in fiume; gli
 *  animali delle fiabe aspettano alla FERMATA sotto gli ombrelli; e nel cielo
 *  passa una BALENA ENORME che rema nell'aria con tantissime pinne.
 *
 *  Qui dipingiamo (solo con il codice!) questi atlanti:
 *
 *    auto_pesce_gialla / _rossa / _azzurra — automobiline-pesce (lato_0..3)
 *    autobus_pesce  — un lungo autobus verde che è anche un pesce (lato_0..3)
 *    balena_pinne   — la balena del cielo con 9 pinne che remano (f0..f5)
 *    fermata        — la fermata dell'autobus con pensilina e cartello (base)
 *    ombrello       — ombrelli aperti di sei colori (rosso, giallo, ...)
 *    pozzanghera    — gli schizzi d'acqua quando un'auto passa (f0..f3)
 *
 *  Lo stile è lo stesso di fiabe.js:
 *    - una linea bruno scuro sottile e regolare (circa 2 px);
 *    - campiture piatte con UN solo tono d'ombra per colore;
 *    - niente grana dentro le figure;
 *    - occhi ovali bianchi con un puntino scuro.
 *  L'acqua ha la linea azzurra invece che bruna (come in fiabe.js).
 *
 *  Coordinate: ogni fotogramma si disegna con l'origine (0, 0) a terra, al
 *  centro della cella; la y cresce verso il basso (sopra il suolo y < 0).
 *  Solo la balena ha l'origine al CENTRO della cella (vola!).
 *  Le viste "lato" guardano a DESTRA: il motore le specchia da solo.
 * ========================================================================== */

import {
  casuale, tra, mescola, schiarisci, scurisci, percorso, Forme, tinta, linea,
  nuovaTela, creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  COLORI COMUNI E UN PO' DI MATEMATICA                                    */
/* ------------------------------------------------------------------------ */
const INK = '#5c3f2e';            // la linea delle figure
const INK2 = '#a3846c';           // linee di dettaglio (squame, raggi delle pinne)
const BIANCO = '#fffdf8';
const PUPILLA = '#2e211c';
const ROSA_GUANCE = '#f29a9a';
const CREMA = '#f6efe0';          // paraurti, ghiere dei fari
const TAU = Math.PI * 2;

/** I colori dell'acqua del fiume-strada. */
const ACQUA = {
  fondo: '#a9d3ec', scura: '#97c6e4', linea: '#6fa6cc', riflesso: '#e6f3fb',
  schiuma: '#ffffff', ombraSchiuma: '#d4ebf8', spruzzo: '#eef8fd',
};

/** Spessore della linea dell'atlante che stiamo dipingendo (cambia per ognuno). */
let LW = 1.8;

/** Il secondo tono (ombra "cel") di un colore. */
const TONI = {};
const tono = (colore) => TONI[colore] || scurisci(colore, 0.13);

const lerp = (a, b, t) => a + (b - a) * t;
const piu = (a, b) => [a[0] + b[0], a[1] + b[1]];
/** Vettore lungo "l" nella direzione "ang" (radianti, 0 = destra, positivo = in basso). */
const polare = (ang, l) => [Math.cos(ang) * l, Math.sin(ang) * l];

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

/**
 * Curva morbida che passa ESATTAMENTE per tutti i punti (spline di
 * Catmull-Rom trasformata in curve di Bézier). Ottima per corpi di pesce.
 */
function liscia(punti, chiusa = true) {
  const p = new Path2D();
  const n = punti.length;
  const P = (i) => (chiusa ? punti[(i + n) % n] : punti[Math.max(0, Math.min(n - 1, i))]);
  p.moveTo(punti[0][0], punti[0][1]);
  for (let i = 0; i < (chiusa ? n : n - 1); i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
    p.bezierCurveTo(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6,
      c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1]);
  }
  if (chiusa) p.closePath();
  return p;
}

/** Poligono con gli angoli arrotondati di raggio r (finestrini, cartelli). */
function tondo(punti, r) {
  const p = new Path2D();
  const n = punti.length;
  const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const inizio = medio(punti[n - 1], punti[0]);
  p.moveTo(inizio[0], inizio[1]);
  for (let k = 0; k < n; k++) {
    const m = medio(punti[k], punti[(k + 1) % n]);
    p.arcTo(punti[k][0], punti[k][1], m[0], m[1], r);
  }
  p.closePath();
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
 * Il "mattone" delle figure (identico a fiabe.js): una o più forme fuse in
 * un'unica sagoma.
 *  1) un tratto doppio di inchiostro (il colore poi ne copre la metà interna);
 *  2) la tinta piatta;
 *  3) l'ombra "cel": tutto col tono scuro, poi ridipingiamo il colore pieno
 *     con la sagoma spostata verso la luce (in alto a destra): resta scura
 *     solo una falce in basso a sinistra.
 * ombra = larghezza della falce (0 = niente), w = spessore della linea.
 */
function pezzo(ctx, forme, colore, ombra = 1, w = LW, coloreOmbra, coloreLinea = INK) {
  const p = unione(forme);
  if (w > 0) {
    ctx.save();
    ctx.strokeStyle = coloreLinea;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = w * 2;
    ctx.translate(-0.3, 0.35);
    ctx.stroke(p);
    ctx.restore();
  }
  tinta(ctx, p, colore);
  if (ombra) {
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = coloreOmbra || tono(colore);
    ctx.fill(p);
    ctx.translate(7 * ombra, -4 * ombra);
    ctx.fillStyle = colore;
    ctx.fill(p);
    ctx.restore();
  }
  return p;
}

/** "Tubo" col contorno: pali, manici, paraurti, gambe della panchina. */
function tubo(ctx, punti, larg, colore, w = LW, dritto = false) {
  const p = dritto ? spezzata(punti) : Forme.curva(punti);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = larg + 2 * w;
  ctx.stroke(p);
  ctx.strokeStyle = colore;
  ctx.lineWidth = larg;
  ctx.stroke(p);
  ctx.restore();
}

/** Tratto di dettaglio (bocche, squame, porte). */
function tratto(ctx, punti, w = LW * 0.85, colore = INK, alfa = 1) {
  linea(ctx, Forme.curva(punti), { spessore: w, colore, alfa });
}

/** Un'ellisse "petalo" che parte da "radice" e va lunga "lung" nella direzione "ang". */
function lobo(radice, ang, lung, larg) {
  const [cx, cy] = piu(radice, polare(ang, lung / 2));
  return Forme.ellisse(cx, cy, lung / 2, larg / 2, ang);
}

/** Occhio: ovale bianco con il puntino scuro (g = sguardo, da -1 a 1). */
function occhio(ctx, x, y, rx, ry, g = [0, 0]) {
  const p = Forme.ellisse(x, y, rx, ry);
  tinta(ctx, p, BIANCO);
  const r = Math.max(1.4, rx * 0.32);
  tinta(ctx, Forme.ellisse(x + g[0] * (rx - r - 1.2), y + g[1] * (ry - r * 1.15 - 1.2), r, r * 1.15), PUPILLA);
  linea(ctx, p, { spessore: LW * 0.75, colore: INK });
}

function guancia(ctx, x, y, r, alfa = 0.5) {
  tinta(ctx, Forme.ellisse(x, y, r, r * 0.6), ROSA_GUANCE, alfa);
}

/**
 * Il FARO-OCCHIO delle auto-pesce: la ghiera color crema del faro, dentro
 * un occhio bianco con la pupilla e una palpebra del colore della
 * carrozzeria (palpebra = quanto copre, 0..1). Guarda avanti, a destra.
 * La palpebra è una falce sottile che segue la curva dell'occhio: così lo
 * sguardo resta sereno (una palpebra dritta lo farebbe sembrare annoiato).
 */
function faroOcchio(ctx, x, y, r, colorePalpebra, palpebra = 0.24) {
  pezzo(ctx, Forme.cerchio(x, y, r), CREMA, 0.3, LW);
  const ox = x + r * 0.04, oy = y + r * 0.02;
  const rx = r * 0.68, ry = r * 0.76;
  const occ = Forme.ellisse(ox, oy, rx, ry);
  tinta(ctx, occ, BIANCO);
  const pr = Math.max(1.6, rx * 0.4);
  tinta(ctx, Forme.ellisse(ox + rx * 0.36, oy + ry * 0.2, pr, pr * 1.15), PUPILLA);
  tinta(ctx, Forme.cerchio(ox + rx * 0.22, oy + ry * 0.04, pr * 0.34), '#ffffff');
  // la palpebra = l'occhio meno lo stesso ovale spostato in giù
  const giu = 2 * ry * palpebra;
  const pal = new Path2D();
  pal.rect(ox - rx - 4, oy - ry - 4, 2 * rx + 8, 2 * ry + 8);
  pal.addPath(Forme.ellisse(ox, oy + giu, rx * 1.04, ry));
  ctx.save();
  ctx.clip(occ);
  ctx.fillStyle = colorePalpebra;
  ctx.fill(pal, 'evenodd');
  linea(ctx, Forme.ellisse(ox, oy + giu, rx * 1.04, ry), { spessore: LW * 0.9, colore: INK });
  ctx.restore();
  linea(ctx, occ, { spessore: LW * 0.8, colore: INK });
  tratto(ctx, [[ox + rx * 0.86, oy - ry * 0.5 + giu * 0.6], [ox + rx * 1.25, oy - ry * 0.72 + giu * 0.4]], LW * 0.8);   // una ciglia
}

/** Disegna ingrandito (o rimpicciolito) di "s" lasciando uguale lo spessore delle linee. */
function inScala(ctx, s, disegna) {
  const prima = LW;
  ctx.save();
  ctx.scale(s, s);
  LW = prima / s;
  disegna();
  LW = prima;
  ctx.restore();
}

/** Una pinna a ventaglio: tanti lobi che partono dalla stessa radice. */
function pinna(ctx, radice, angoli, lunghezze, larg, ang, colore, ombra = 0.4) {
  const forme = angoli.map((a, i) => lobo(radice, a + ang, lunghezze[i], larg));
  pezzo(ctx, forme, colore, ombra, LW * 0.9);
  angoli.forEach((a, i) => tratto(ctx, [piu(radice, polare(a + ang, 5)), piu(radice, polare(a + ang, lunghezze[i] * 0.8))], LW * 0.55, tono(colore)));
}

/** Una bollicina d'aria: cerchio azzurro con il lampo bianco. */
function bollicina(ctx, x, y, r) {
  tinta(ctx, Forme.cerchio(x, y, r), '#f2f9fd', 0.7);
  linea(ctx, Forme.cerchio(x, y, r), { spessore: LW * 0.6, colore: ACQUA.linea });
  tinta(ctx, Forme.cerchio(x - r * 0.35, y - r * 0.35, r * 0.3), '#ffffff', 0.95);
}

/** Goccia di pioggia: tonda in basso e a punta in alto (ang = inclinazione). */
function goccia(x, y, r, ang = 0) {
  const p = new Path2D();
  const m = new DOMMatrix().translate(x, y).rotate((ang * 180) / Math.PI);
  const q = new Path2D();
  q.moveTo(0, -r * 2.3);
  q.bezierCurveTo(r * 0.5, -r * 1.2, r * 1.05, -r * 0.5, r, r * 0.1);
  q.bezierCurveTo(r * 0.95, r * 0.75, r * 0.5, r, 0, r);
  q.bezierCurveTo(-r * 0.5, r, -r * 0.95, r * 0.75, -r, r * 0.1);
  q.bezierCurveTo(-r * 1.05, -r * 0.5, -r * 0.5, -r * 1.2, 0, -r * 2.3);
  q.closePath();
  p.addPath(q, m);
  return p;
}

/** Disegna una goccia d'acqua chiara col contorno azzurro e il lampo bianco. */
function gocciaAcqua(ctx, x, y, r, ang = 0) {
  pezzo(ctx, goccia(x, y, r, ang), ACQUA.spruzzo, 0.15, LW * 0.75, ACQUA.ombraSchiuma, ACQUA.linea);
  tinta(ctx, Forme.ellisse(x - r * 0.35, y - r * 0.1, r * 0.22, r * 0.38), '#ffffff');
}

/* ------------------------------------------------------------------------ */
/*  L'ACQUA DEL FIUME-STRADA (in fondo alle celle delle auto-pesce)         */
/* ------------------------------------------------------------------------ */

/**
 * Una striscia d'acqua dal bordo ondulato che passa DAVANTI alla parte bassa
 * della figura (così sembra che nuoti). Ai lati si assottiglia fino a sparire.
 * L = mezza larghezza, H = altezza al centro, w = fase delle onde.
 * Restituisce la funzione "alto(x)" (la quota della superficie).
 */
function fiume(ctx, L, H, w) {
  const alto = (x) => {
    const u = x / L;
    return -H * (1 - Math.pow(Math.abs(u), 5)) + 2.2 * Math.sin(x / 15 + w) * (1 - u * u);
  };
  const bordo = [];
  for (let x = -L; x <= L + 0.1; x += 4) bordo.push([x, alto(x)]);
  const p = spezzata([[-L, LW + 2], ...bordo, [L, LW + 2]]);
  tinta(ctx, p, ACQUA.fondo, 0.97);
  // il tono "cel" dell'acqua: una fascia appena più scura verso il fondo
  ctx.save();
  ctx.clip(p);
  const fascia = bordo.map(([x, y]) => [x, y + H * 0.5 + 3 * Math.sin(x / 26 - w)]);
  tinta(ctx, spezzata([[-L, LW + 2], ...fascia, [L, LW + 2]]), ACQUA.scura);
  ctx.restore();
  linea(ctx, spezzata(bordo), { spessore: LW, colore: ACQUA.linea });
  // riflessi: trattini chiari che scorrono
  const rng = casuale(5);
  for (let i = 0; i < 7; i++) {
    const x = -L * 0.8 + (i / 6) * L * 1.6 + tra(rng, -10, 10) - 6 * Math.sin(w);
    const y = alto(x) + tra(rng, 8, H * 0.4);
    const l = tra(rng, 8, 20);
    tratto(ctx, [[x - l / 2, y], [x + l / 2, y]], LW * 0.8, ACQUA.riflesso);
  }
  return alto;
}

/** Schiuma bianca a riccioli sul pelo dell'acqua (s = grandezza). */
function schiuma(ctx, x, y, s, seme) {
  const rng = casuale(seme);
  const forme = [Forme.ellisse(x, y, 17 * s, 4 * s)];
  for (let i = 0; i < 4; i++) {
    forme.push(Forme.cerchio(x + (i - 1.5) * 8.5 * s + tra(rng, -2, 2) * s, y - tra(rng, 1.5, 4.5) * s, tra(rng, 3.6, 5.6) * s));
  }
  pezzo(ctx, forme, ACQUA.schiuma, 0.35, LW * 0.9, ACQUA.ombraSchiuma, ACQUA.linea);
}

/** Un getto d'acqua a punta (base larga, punta tonda), piegato di "piega". */
function getto(base, ang, lung, larg, piega = 0) {
  const d = polare(ang, 1), n = [-d[1], d[0]];
  const punta = piu(base, polare(ang + piega, lung));
  const mezzo = piu(base, polare(ang + piega * 0.4, lung * 0.55));
  const p = new Path2D();
  p.moveTo(base[0] + n[0] * larg / 2, base[1] + n[1] * larg / 2);
  p.quadraticCurveTo(mezzo[0] + n[0] * larg * 0.32, mezzo[1] + n[1] * larg * 0.32, punta[0], punta[1]);
  p.quadraticCurveTo(mezzo[0] - n[0] * larg * 0.32, mezzo[1] - n[1] * larg * 0.32, base[0] - n[0] * larg / 2, base[1] - n[1] * larg / 2);
  p.closePath();
  p.addPath(Forme.cerchio(punta[0], punta[1], larg * 0.16));
  return p;
}

/**
 * Lo spruzzo dove una pinna o il muso taglia l'acqua: un ventaglio di getti
 * bianchi che si apre verso "verso" (+1 avanti, -1 indietro) e goccioline.
 */
function spruzzo(ctx, x, y, alt, verso, seme) {
  const rng = casuale(seme);
  const forme = [];
  [0.15, 0.55, 0.95].forEach((a, i) => {
    forme.push(getto([x + verso * i * 4, y + 2], -Math.PI / 2 + verso * a, alt * [1, 0.8, 0.55][i], alt * 0.3, verso * 0.15));
  });
  pezzo(ctx, forme, ACQUA.spruzzo, 0.35, LW * 0.85, ACQUA.ombraSchiuma, ACQUA.linea);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + verso * tra(rng, 0.2, 1.1);
    const [gx, gy] = piu([x, y], polare(a, alt * tra(rng, 1.15, 1.45)));
    gocciaAcqua(ctx, gx, gy, alt * tra(rng, 0.06, 0.09), verso * 0.5);
  }
}

/* ------------------------------------------------------------------------ */
/*  1. LE AUTOMOBILINE-PESCE                                                */
/* ------------------------------------------------------------------------ */
/*  Un'auto giocattolo tondeggiante che è anche un pesce: il faro è un occhio
 *  con la palpebra, il paraurti sorride, dietro la carrozzeria si stringe
 *  in una coda di pesce; al posto delle ruote ci sono pinne che remano
 *  (il coprimozzo resta, come un bottone), sul tetto c'è la pinna dorsale.
 *  Misure (cella 384x256): acqua fino a -44, tetto -198, pinna -242.       */

const AUTO_PESCE = {
  auto_pesce_gialla: { corpo: '#f4cf5f', pinne: '#fbe4a2' },
  auto_pesce_rossa: { corpo: '#e9786b', pinne: '#f8b9ab' },
  auto_pesce_azzurra: { corpo: '#7fb6d8', pinne: '#c3e2f2' },
};
Object.assign(TONI, {
  '#f4cf5f': '#e2b544', '#e9786b': '#d4645b', '#7fb6d8': '#679fc6',
  '#fbe4a2': '#efcd7e', '#f8b9ab': '#eb9d8f', '#c3e2f2': '#a5cde6',
});

/** Il vetro di un finestrino: azzurro pallido, due riflessi obliqui, contorno. */
function vetro(ctx, forma, x, y, l, a, dentro) {
  const p = percorso(forma);
  tinta(ctx, p, '#d9ebf6');
  ctx.save();
  ctx.clip(p);
  if (dentro) dentro();                         // passeggeri, autista...
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, l * 0.1);
  ctx.beginPath(); ctx.moveTo(x + l * 0.15, y + a + 4); ctx.lineTo(x + l * 0.6, y - 4); ctx.stroke();
  ctx.lineWidth *= 0.5;
  ctx.beginPath(); ctx.moveTo(x + l * 0.42, y + a + 4); ctx.lineTo(x + l * 0.87, y - 4); ctx.stroke();
  ctx.restore();
  linea(ctx, p, { spessore: LW, colore: INK });
}

/** Le squame: archetti a "<" (la punta verso la coda). */
function squame(ctx, posti, s, colore) {
  for (const [x, y] of posti) tratto(ctx, [[x + 3 * s, y - 5 * s], [x - 1.5 * s, y], [x + 3 * s, y + 5 * s]], LW * 0.7, colore);
}

/** Una ruota diventata pinna: passaruota scuro, pinna a ventaglio e coprimozzo. */
function ruotaPinna(ctx, x, y, r, ang, colori) {
  pinna(ctx, [x, y], [-0.42, 0, 0.42], [r * 1.55, r * 1.85, r * 1.45], r * 0.72, ang, colori.pinne);
  pezzo(ctx, Forme.cerchio(x, y, r * 0.34), CREMA, 0.25, LW * 0.9);
  tinta(ctx, Forme.cerchio(x, y, r * 0.1), INK2);
}

function disegnaAutoPesce(colori) {
  return function (ctx, nome) {
    const k = Number(nome.split('_')[1]), w = (TAU * k) / 4;
    const C = colori.corpo, scuro = mescola(C, '#6c5584', 0.32);
    ctx.save();
    ctx.translate(-6, 2.5 * Math.sin(w));                      // galleggia su e giù...
    inScala(ctx, 0.82, () => ruotato(ctx, 0, -100, 0.02 * Math.sin(w + 0.8), () => {    // ...e beccheggia appena
      // la coda (dietro a tutto): frulla su e giù
      pinna(ctx, [-150, -99], [Math.PI - 0.62, Math.PI, Math.PI + 0.62], [54, 30, 54], 30, 0.26 * Math.sin(w), colori.pinne);
      // la pinna dorsale sul tetto, un po' piegata all'indietro
      ruotato(ctx, -20, -192, 0.06 * Math.sin(w - 1), () => {
        const dorsale = pezzo(ctx, liscia([[14, -190], [-2, -220], [-34, -242], [-56, -240], [-52, -214], [-44, -188]]), colori.pinne, 0.5, LW);
        ctx.save();
        ctx.clip(dorsale);
        for (const [a, b] of [[[-6, -192], [-24, -232]], [[-22, -192], [-42, -238]], [[-38, -192], [-52, -226]]]) tratto(ctx, [a, b], LW * 0.6, tono(colori.pinne));
        ctx.restore();
      });
      // la carrozzeria-pesce
      const corpo = pezzo(ctx, liscia([
        [168, -84], [162, -112], [138, -128], [94, -134], [70, -170], [34, -194], [-30, -198],
        [-78, -186], [-108, -154], [-134, -124], [-158, -106], [-160, -92], [-136, -76],
        [-104, -50], [-60, -34], [30, -30], [120, -34], [158, -52],
      ]), C, 1.4, LW * 1.2);
      ctx.save();
      ctx.clip(corpo);
      for (const x of [-64, 88]) tinta(ctx, Forme.cerchio(x, -62, 30), scuro);     // passaruota
      ctx.restore();
      vetro(ctx, tondo([[-88, -146], [-64, -178], [-12, -188], [-12, -146]], 10), -88, -188, 76, 42);
      vetro(ctx, tondo([[0, -188], [34, -186], [62, -146], [0, -146]], 10), 0, -188, 62, 42);
      tratto(ctx, [[-6, -140], [-4, -96], [-8, -62]], LW * 0.75, tono(C));            // la portiera
      pezzo(ctx, Forme.rettangolo(-36, -128, 18, 5.5, 2.75), schiarisci(C, 0.45), 0, LW * 0.75);
      tratto(ctx, [[104, -126], [96, -100], [104, -72]], LW * 0.8, tono(C));          // la branchia
      squame(ctx, [[-120, -112], [-104, -96], [-120, -84], [-90, -112], [-84, -80], [-104, -126]], 1, tono(C));
      guancia(ctx, 124, -80, 7);
      faroOcchio(ctx, 138, -102, 15, C);
      // il paraurti che sorride
      tubo(ctx, [[112, -40], [146, -44], [168, -62]], 9, CREMA);
      tratto(ctx, [[146, -72], [154, -66], [163, -71]], LW * 0.85);
      // le ruote-pinna remano a turno
      ruotaPinna(ctx, -64, -62, 31, 2.7 + 0.42 * Math.sin(w + Math.PI), colori);
      ruotaPinna(ctx, 88, -62, 31, 2.7 + 0.42 * Math.sin(w), colori);
    }));
    ctx.restore();
    // il fiume davanti: schiuma, spruzzi e bollicine
    const alto = fiume(ctx, 192, 40, w);
    schiuma(ctx, 134, alto(134) + 2, 0.9 + 0.12 * Math.sin(w), 3 + k);
    schiuma(ctx, -132, alto(-132) + 2, 0.8 + 0.15 * Math.cos(w), 7 + k);
    spruzzo(ctx, 144, alto(144) + 2, 28 + 7 * Math.sin(w), 1, 11 + k);
    spruzzo(ctx, -64, alto(-64) + 2, 14 + 10 * Math.max(0, Math.sin(w + Math.PI)), -1, 21 + k);
    spruzzo(ctx, 62, alto(62) + 2, 14 + 10 * Math.max(0, Math.sin(w)), -1, 31 + k);
    for (const [x, y, r] of [[-170, -62 - 9 * k, 4.5], [-180, -98 - 6 * ((k + 2) % 4), 3], [-158, -126 - 5 * ((k + 1) % 4), 2.4]]) bollicina(ctx, x, y, r);
  };
}

/* ------------------------------------------------------------------------ */
/*  2. L'AUTOBUS-PESCE                                                      */
/* ------------------------------------------------------------------------ */
/*  Un lungo autobus verde pastello che è anche un grosso pesce buono: il
 *  muso tondo da balena, il sorriso sotto il parabrezza, l'occhio-faro, la
 *  pancia color panna con i solchi, le pinne al posto delle ruote, la coda.
 *  Dai finestrini si vedono le sagome dei passeggeri: tutti animali!      */

const BUS = { verde: '#9fd3b3', panna: '#f8edcf', pinne: '#cdeccf', insegna: '#5b6270', luce: '#ffe08a', sagome: '#8fa2c4' };
Object.assign(TONI, { [BUS.verde]: '#84bf9d', [BUS.panna]: '#ead9b5', [BUS.pinne]: '#acd8b4' });

/** La sagoma di un passeggero animale (testa + spalle) vista dal finestrino. */
function passeggero(ctx, x, y, tipo, colore) {
  const forme = [Forme.ellisse(x, y + 22, 18, 12), Forme.cerchio(x, y, 12)];
  if (tipo === 'coniglio') forme.push(Forme.ellisse(x - 5, y - 19, 4, 12, -0.15), Forme.ellisse(x + 6, y - 20, 4, 12, 0.2));
  if (tipo === 'gatto') forme.push(Forme.poligono([[x - 12, y - 3], [x - 10, y - 19], [x - 2, y - 11]]), Forme.poligono([[x + 12, y - 3], [x + 10, y - 19], [x + 2, y - 11]]));
  if (tipo === 'orso') forme.push(Forme.cerchio(x - 9, y - 9, 5), Forme.cerchio(x + 9, y - 9, 5));
  if (tipo === 'topo') forme.push(Forme.cerchio(x - 11, y - 9, 7.5), Forme.cerchio(x + 11, y - 9, 7.5));
  if (tipo === 'uccello') forme.push(Forme.poligono([[x + 10, y - 3], [x + 20, y + 1], [x + 10, y + 5]]), Forme.ellisse(x - 2, y - 14, 3, 6, -0.4));
  if (tipo === 'cilindro') forme.push(Forme.rettangolo(x - 8, y - 28, 16, 18, 2), Forme.rettangolo(x - 14, y - 12, 28, 4, 2));
  if (tipo === 'berretto') forme.push(Forme.ellisse(x, y - 9, 13, 6), Forme.rettangolo(x, y - 8, 20, 4, 2));
  tinta(ctx, unione(forme), colore, 0.75);
}

function disegnaAutobusPesce(ctx, nome) {
  const k = Number(nome.split('_')[1]), w = (TAU * k) / 4;
  ctx.save();
  ctx.translate(-8, 3 * Math.sin(w));
  inScala(ctx, 0.92, () => ruotato(ctx, 0, -180, 0.012 * Math.sin(w + 0.8), () => {
    // la coda e la pinna dorsale (dietro alla carrozzeria)
    pinna(ctx, [-300, -178], [Math.PI - 0.6, Math.PI, Math.PI + 0.6], [70, 40, 70], 40, 0.22 * Math.sin(w), BUS.pinne);
    ruotato(ctx, -80, -316, 0.05 * Math.sin(w - 1), () => {
      const dorsale = pezzo(ctx, liscia([[-40, -314], [-60, -346], [-104, -368], [-130, -364], [-124, -338], [-116, -312]]), BUS.pinne, 0.6);
      ctx.save();
      ctx.clip(dorsale);
      for (const [a, b] of [[[-56, -316], [-82, -358]], [[-78, -316], [-106, -364]], [[-100, -316], [-124, -350]]]) tratto(ctx, [a, b], LW * 0.6, tono(BUS.pinne));
      ctx.restore();
    });
    // la carrozzeria: verde sopra, pancia panna sotto
    const corpo = liscia([
      [356, -150], [350, -236], [328, -290], [286, -316], [150, -322], [-100, -322], [-212, -314],
      [-258, -290], [-282, -244], [-300, -200], [-310, -180], [-300, -160], [-278, -130],
      [-244, -88], [-190, -60], [0, -52], [200, -54], [300, -64], [340, -92], [354, -122],
    ]);
    pezzo(ctx, corpo, BUS.verde, 1.6, LW * 1.2);
    ctx.save();
    ctx.clip(corpo);
    const pancia = liscia([[380, -146], [330, -130], [240, -126], [0, -130], [-200, -138], [-300, -168], [-340, -176], [-340, 40], [380, 40]]);
    pezzo(ctx, pancia, BUS.panna, 1.6, LW);
    for (const [dy, x0] of [[22, 300], [40, 318]]) {                               // i solchi della pancia
      tratto(ctx, [[x0, -130 + dy], [200, -126 + dy], [0, -128 + dy], [-160, -132 + dy], [-230, -140 + dy]], LW * 0.65, tono(BUS.panna));
    }
    for (const x of [-170, 196]) tinta(ctx, Forme.cerchio(x, -92, 40), mescola(BUS.panna, '#6c5584', 0.3));   // passaruota
    ctx.restore();
    // i finestrini con i passeggeri
    const TIPI = ['coniglio', 'orso', 'cilindro', 'gatto', 'uccello', 'topo'];
    TIPI.forEach((tipo, i) => {
      const x = -236 + i * 76;
      vetro(ctx, Forme.rettangolo(x, -296, 62, 80, 12), x, -296, 62, 80, () => passeggero(ctx, x + 31 + (i % 2 ? 4 : -3), -236 + (i % 3) * 5, tipo, BUS.sagome));
    });
    // la porta a due ante e il parabrezza con l'autista
    pezzo(ctx, Forme.rettangolo(218, -300, 56, 186, 8), BUS.verde, 0.4, LW);
    vetro(ctx, Forme.rettangolo(223, -294, 22, 120, 6), 223, -294, 22, 120);
    vetro(ctx, Forme.rettangolo(248, -294, 22, 120, 6), 248, -294, 22, 120);
    vetro(ctx, tondo([[286, -298], [318, -294], [340, -228], [286, -224]], 12), 286, -298, 54, 74, () => passeggero(ctx, 304, -244, 'berretto', BUS.sagome));
    // l'insegna sul tetto con le lucine
    pezzo(ctx, Forme.rettangolo(120, -342, 120, 22, 6), BUS.insegna, 0.4, LW);
    for (let i = 0; i < 4; i++) tinta(ctx, Forme.rettangolo(134 + i * 25, -335, 17, 7, 3), BUS.luce);
    // la faccia: occhio-faro, guancia, sorriso
    squame(ctx, [[-272, -196], [-256, -180], [-272, -168], [-240, -196], [-238, -164]], 1.3, tono(BUS.verde));
    guancia(ctx, 300, -150, 9);
    faroOcchio(ctx, 322, -180, 19, BUS.verde);
    tratto(ctx, [[357, -150], [342, -132], [314, -122], [288, -128], [274, -144]], LW * 1.05);   // il sorrisone
    tratto(ctx, [[281, -150], [272, -145], [275, -136]], LW * 0.85);
    // le ruote-pinna
    ruotaPinna(ctx, -170, -92, 40, 2.7 + 0.4 * Math.sin(w + Math.PI), { pinne: BUS.pinne });
    ruotaPinna(ctx, 196, -92, 40, 2.7 + 0.4 * Math.sin(w), { pinne: BUS.pinne });
  }));
  ctx.restore();
  const alto = fiume(ctx, 384, 60, w);
  schiuma(ctx, 322, alto(322) + 2, 1.25 + 0.15 * Math.sin(w), 41 + k);
  schiuma(ctx, -290, alto(-290) + 2, 1.05 + 0.15 * Math.cos(w), 45 + k);
  spruzzo(ctx, 334, alto(334) + 2, 38 + 9 * Math.sin(w), 1, 51 + k);
  spruzzo(ctx, -170, alto(-170) + 2, 18 + 14 * Math.max(0, Math.sin(w + Math.PI)), -1, 61 + k);
  spruzzo(ctx, 166, alto(166) + 2, 18 + 14 * Math.max(0, Math.sin(w)), -1, 71 + k);
  for (const [x, y, r] of [[-340, -90 - 12 * k, 6], [-356, -150 - 8 * ((k + 2) % 4), 4], [-330, -196 - 7 * ((k + 1) % 4), 3]]) bollicina(ctx, x, y, r);
}

/* ------------------------------------------------------------------------ */
/*  3. LA BALENA DEL CIELO                                                  */
/* ------------------------------------------------------------------------ */
/*  Una balena lunghissima, azzurro polvere sopra e bianca sotto (l'ombra è
 *  lilla), con i solchi sulla pancia come nel film, un occhietto che
 *  sorride e NOVE pinne lunghe come remi: battono una dopo l'altra, così
 *  un'onda corre lungo il fianco dalla testa alla coda. Anche il corpo
 *  ondeggia appena. Origine al centro della cella (1024x512).             */

const BALENA = {
  dorso: '#9cc4ea', pancia: '#f9f7f1', lilla: '#e0d7ee', pinna: '#a9cdef', lontana: '#86afdc', solchi: '#c8b6c6', nuvola: '#fffaf0',
};
Object.assign(TONI, { [BALENA.dorso]: '#84afdc', [BALENA.pinna]: '#8fb8e3', [BALENA.lontana]: '#7299c8', [BALENA.nuvola]: '#e9e1f0' });

/** La sagoma della balena per la fase w: contorno, bordo alto e basso. */
function formaBalena(w) {
  const X0 = -400, X1 = 446, H = 118;
  const spina = (x) => {
    const s = (x - X0) / (X1 - X0);
    return -42 + 8 * Math.sin((TAU * (x - X1)) / 820 + w) * (1 - 0.7 * s);
  };
  // spessore (0..1) lungo il corpo: sottile alla coda, massimo verso la testa,
  // poi il muso tondo (un quarto di ellisse, campionato per angolo)
  const campioni = [];
  for (let s = 0; s < 0.6; s += 0.025) campioni.push([X0 + s * (X1 - X0), 0.1 + 0.9 * Math.pow(Math.sin((Math.PI / 2) * (s / 0.6)), 1.35)]);
  for (let i = 0; i <= 14; i++) {
    const th = (i / 14) * (Math.PI / 2);
    campioni.push([X0 + (0.6 + 0.4 * Math.sin(th)) * (X1 - X0), Math.cos(th)]);
  }
  const su = campioni.map(([x, e]) => [x, spina(x) - H * 0.86 * e]);
  const giu = campioni.map(([x, e]) => [x, spina(x) + H * 1.08 * e]);
  const contorno = [...su, ...giu.slice(0, -1).reverse()];
  /** Un punto "dentro" il corpo: alla x di un campione, a frazione f dall'alto. */
  const punto = (i, f) => [su[i][0], lerp(su[i][1], giu[i][1], f)];
  return { contorno, su, giu, punto, spina, n: campioni.length };
}

/** Una pinna lunga a remo (stretta alla radice, tonda in fondo). */
function pinnaRemo(ctx, radice, ang, L, W, colore) {
  const locale = [[-W * 0.12, 0], [0, -W * 0.22], [L * 0.35, -W * 0.44], [L * 0.76, -W * 0.5], [L * 0.97, -W * 0.3],
    [L, 0], [L * 0.97, W * 0.3], [L * 0.76, W * 0.5], [L * 0.35, W * 0.44], [0, W * 0.22]];
  const c = Math.cos(ang), s = Math.sin(ang);
  const punti = locale.map(([x, y]) => [radice[0] + x * c - y * s, radice[1] + x * s + y * c]);
  pezzo(ctx, liscia(punti), colore, 0.6, LW);
  tratto(ctx, [piu(radice, polare(ang, W * 0.3)), piu(radice, polare(ang + 0.02, L * 0.8))], LW * 0.6, tono(colore));
}

/** Nuvoletta soffice (tanti cerchi uniti), color panna con l'ombra lilla. */
function nuvoletta(ctx, x, y, s, seme) {
  const rng = casuale(seme);
  const forme = [Forme.ellisse(x, y, 30 * s, 11 * s)];
  for (let i = 0; i < 5; i++) forme.push(Forme.cerchio(x + (i - 2) * 13 * s, y - tra(rng, 4, 10) * s * (i % 4 ? 1.4 : 0.8), tra(rng, 9, 14) * s));
  pezzo(ctx, forme, BALENA.nuvola, 0.7, LW * 0.8, null, INK2);
}

function disegnaBalena(ctx, nome) {
  const k = Number(nome.slice(1)), w = (TAU * k) / 6;
  const B = formaBalena(w);
  // nove pinne vicine e nove lontane (queste sono più scure e sfasate)
  const PINNE = 9;
  const pinne = [];
  for (let i = 0; i < PINNE; i++) {
    const idx = Math.round(lerp(B.n * 0.77, B.n * 0.2, i / (PINNE - 1)));
    const fase = w * 1 - i * 0.8;
    pinne.push({
      radice: B.punto(idx, 0.5),
      ang: 1.78 + 0.42 * Math.sin(fase),
      L: (190 - i * 7.5) * (0.92 + 0.08 * Math.cos(fase)),
      W: 46 - i * 1.4,
    });
  }
  for (const p of pinne) pinnaRemo(ctx, piu(p.radice, [14, -8]), p.ang - 0.25, p.L * 0.92, p.W * 0.9, BALENA.lontana);
  // la coda: due lobi che oscillano con l'onda del corpo
  const coda = [-396, B.spina(-396)];
  pinna(ctx, coda, [Math.PI - 0.42, Math.PI + 0.42], [96, 96], 42, 0.1 * Math.sin(w + 1.5), BALENA.dorso, 0.6);
  // il corpo: bianco con l'ombra lilla, poi la fascia azzurra del dorso
  const corpo = pezzo(ctx, liscia(B.contorno), BALENA.pancia, 2.6, LW * 1.25, BALENA.lilla);
  ctx.save();
  ctx.clip(corpo);
  const confine = B.su.map((q, i) => B.punto(i, 0.33));
  pezzo(ctx, liscia([[-520, -300], ...confine, [560, confine[confine.length - 1][1]], [560, -300]]), BALENA.dorso, 1, LW);
  // i solchi lunghi della pancia
  for (const f of [0.6, 0.7, 0.8, 0.9]) {
    const da = Math.round(B.n * (0.24 + (f - 0.6) * 0.5)), a = B.n - 3;
    const punti = [];
    for (let i = da; i < a; i++) punti.push(B.punto(i, f));
    tratto(ctx, punti, LW * 0.7, BALENA.solchi);
  }
  ctx.restore();
  // la faccia: bocca lunga che sorride, occhietto, guancia
  const bocca = [];
  for (let i = B.n - 2; i >= B.n - 11; i--) bocca.push(B.punto(i, 0.5 - (B.n - 2 - i) * 0.008));
  const fine = bocca[bocca.length - 1];
  bocca.push(piu(fine, [-12, -8]));
  tratto(ctx, bocca, LW);
  const oc = B.punto(B.n - 10, 0.36);
  occhio(ctx, oc[0] + 18, oc[1] - 2, 8, 9.5, [0.5, 0.1]);
  tratto(ctx, [[oc[0] + 8, oc[1] + 11], [oc[0] + 18, oc[1] + 14], [oc[0] + 28, oc[1] + 11]], LW * 0.75);   // l'occhio che sorride
  guancia(ctx, oc[0] + 10, oc[1] + 26, 11, 0.45);
  // le pinne vicine: dalla coda verso la testa (quelle davanti coprono le altre)
  for (let i = PINNE - 1; i >= 0; i--) pinnaRemo(ctx, pinne[i].radice, pinne[i].ang, pinne[i].L, pinne[i].W, BALENA.pinna);
  // qualche nuvoletta che resta indietro
  nuvoletta(ctx, -150 - 10 * k, 214, 0.9, 3);
  nuvoletta(ctx, 330 - 10 * k, 196, 0.7, 4);
}

/* ------------------------------------------------------------------------ */
/*  4. LA FERMATA DELL'AUTOBUS                                              */
/* ------------------------------------------------------------------------ */
/*  Una pensilina pastello col tetto ricurvo e la frangia a festoni, il
 *  vetro con un manifesto (un pesce, naturalmente), la panchina di legno;
 *  a destra il palo col cartello tondo "FERMATA" scritto a mano e l'orario. */

const FERMATA = {
  tetto: '#f2a495', frangia: '#fbd9c9', palo: '#8fa6bd', vetro: '#dcedf6', legno: '#dca36c',
  ferro: '#7d8aa3', cartello: '#7fb6d8', fondo: '#fbf3dd', marciapiede: '#ddd3c6', orario: '#fffdf6',
};
Object.assign(TONI, { [FERMATA.tetto]: '#e08a7c', [FERMATA.palo]: '#7891aa', [FERMATA.legno]: '#c58a55', [FERMATA.marciapiede]: '#c8bcae' });

/** Le lettere scritte a mano: tratti dentro una casella 0..1 (y verso il basso). */
const LETTERE = {
  F: [[[0, 1], [0, 0], [0.56, 0]], [[0, 0.48], [0.44, 0.48]]],
  E: [[[0.56, 0], [0, 0], [0, 1], [0.56, 1]], [[0, 0.48], [0.46, 0.48]]],
  R: [[[0, 1], [0, 0], [0.32, 0], [0.52, 0.08], [0.56, 0.24], [0.5, 0.4], [0.3, 0.48], [0, 0.48]], [[0.28, 0.48], [0.58, 1]]],
  M: [[[0, 1], [0.04, 0], [0.34, 0.62], [0.64, 0], [0.68, 1]]],
  A: [[[0, 1], [0.3, 0], [0.6, 1]], [[0.12, 0.64], [0.48, 0.64]]],
  T: [[[0, 0], [0.62, 0]], [[0.31, 0], [0.31, 1]]],
};

/** Scrive una parola in stampatello "a mano", centrata in (x, y), alta h. */
function scriviAMano(ctx, parola, x, y, h, colore = INK) {
  const rng = casuale(17);
  const passo = h * 0.84;
  const larghezza = parola.length * passo - h * 0.24;
  let cx = x - larghezza / 2;
  for (const lettera of parola) {
    ctx.save();
    ctx.translate(cx, y - h / 2 + tra(rng, -0.6, 0.6));
    ctx.rotate(tra(rng, -0.05, 0.05));
    for (const t of LETTERE[lettera]) linea(ctx, spezzata(t.map(([u, v]) => [u * h, v * h])), { spessore: h * 0.17, colore });
    ctx.restore();
    cx += passo;
  }
}

/** Un autobusino stilizzato (l'icona del cartello). */
function iconaBus(ctx, x, y, s) {
  pezzo(ctx, Forme.rettangolo(x - 13 * s, y - 7 * s, 26 * s, 12 * s, 3.5 * s), BUS.verde, 0, LW * 0.7);
  for (const dx of [-9, -2, 5]) tinta(ctx, Forme.rettangolo(x + dx * s, y - 4.5 * s, 5 * s, 4 * s, 1), '#ffffff');
  for (const dx of [-7, 7]) pezzo(ctx, Forme.cerchio(x + dx * s, y + 5 * s, 2.6 * s), '#5d5160', 0, LW * 0.5);
}

function disegnaFermata(ctx) {
  // il marciapiede
  pezzo(ctx, Forme.rettangolo(-180, -14, 360, 14, 5), FERMATA.marciapiede, 0.5);
  // il vetro di fondo con il manifesto del pesce
  const vetroFondo = Forme.rettangolo(-150, -246, 196, 222, 4);
  tinta(ctx, vetroFondo, FERMATA.vetro);
  pezzo(ctx, Forme.rettangolo(-132, -224, 52, 70, 3), '#fff6e4', 0.3, LW * 0.8);
  pezzo(ctx, [Forme.ellisse(-104, -192, 14, 10), Forme.poligono([[-118, -192], [-126, -201], [-126, -183]])], AUTO_PESCE.auto_pesce_rossa.corpo, 0, LW * 0.7);
  occhio(ctx, -97, -194, 2.6, 3);
  tratto(ctx, [[-122, -168], [-90, -168]], LW * 0.6, INK2);
  tratto(ctx, [[-122, -162], [-98, -162]], LW * 0.6, INK2);
  ctx.save();
  ctx.clip(percorso(vetroFondo));
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineCap = 'round';
  for (const [x0, l] of [[-40, 14], [-16, 7]]) {
    ctx.lineWidth = l;
    ctx.beginPath(); ctx.moveTo(x0 - 60, -20); ctx.lineTo(x0 + 40, -250); ctx.stroke();
  }
  ctx.restore();
  linea(ctx, vetroFondo, { spessore: LW, colore: INK });
  // la panchina di legno
  for (const x of [-124, 20]) tubo(ctx, [[x, -14], [x, -90]], 6, FERMATA.ferro, LW, true);
  pezzo(ctx, Forme.rettangolo(-140, -136, 176, 13, 4), FERMATA.legno, 0.4);
  pezzo(ctx, Forme.rettangolo(-140, -118, 176, 13, 4), FERMATA.legno, 0.4);
  pezzo(ctx, Forme.rettangolo(-146, -92, 188, 14, 5), FERMATA.legno, 0.5);
  // i pali della pensilina
  for (const x of [-154, 50]) tubo(ctx, [[x, -14], [x, -258]], 9, FERMATA.palo, LW, true);
  // il tetto ricurvo con la frangia a festoni e due gocce che cadono
  const tetto = new Path2D();
  tetto.moveTo(-184, -244);
  tetto.quadraticCurveTo(-52, -326, 80, -244);
  tetto.lineTo(74, -232);
  tetto.quadraticCurveTo(-52, -304, -178, -232);
  tetto.closePath();
  const festoni = [];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9, x = lerp(-178, 74, t);
    const y = lerp(-232, -232, t) - 2 * t * (1 - t) * 72 + 1;
    festoni.push(Forme.ellisse(x, y, 15, 9));
  }
  pezzo(ctx, festoni, FERMATA.frangia, 0.4, LW * 0.9);
  pezzo(ctx, tetto, FERMATA.tetto, 0.7, LW * 1.15);
  gocciaAcqua(ctx, -120, -206, 4.5);
  gocciaAcqua(ctx, 30, -196, 4);
  // il palo con l'orario e il cartello tondo
  tubo(ctx, [[124, -12], [124, -300]], 8, FERMATA.palo, LW, true);
  pezzo(ctx, Forme.ellisse(124, -12, 16, 5), FERMATA.palo, 0.3);
  pezzo(ctx, Forme.rettangolo(100, -214, 48, 64, 4), FERMATA.orario, 0.4);
  pezzo(ctx, Forme.rettangolo(100, -214, 48, 13, 4), FERMATA.tetto, 0, LW * 0.8);
  for (let i = 0; i < 5; i++) tratto(ctx, [[107, -190 + i * 8], [107 + (i % 2 ? 26 : 34), -190 + i * 8]], LW * 0.6, INK2);
  pezzo(ctx, Forme.cerchio(124, -306, 44), FERMATA.cartello, 0.5, LW * 1.15);
  pezzo(ctx, Forme.cerchio(124, -306, 35), FERMATA.fondo, 0, LW * 0.9);
  iconaBus(ctx, 124, -318, 1);
  scriviAMano(ctx, 'FERMATA', 124, -294, 9.5);
}

/* ------------------------------------------------------------------------ */
/*  5. GLI OMBRELLI                                                         */
/* ------------------------------------------------------------------------ */
/*  Ombrelli aperti visti da sotto in su: la cupola a spicchi con i festoni,
 *  il puntale, l'asta e il manico ricurvo (la mano la mette il personaggio).
 *  Il fondo del manico tocca il bordo della cella, al centro. Sulla cupola
 *  scivolano gocce di pioggia, altre pendono dalle punte delle stecche.   */

const OMBRELLI = {
  rosso: '#e9786b', giallo: '#f4cf5f', azzurro: '#7fb6d8', verde: '#9fcf7f', rosa: '#f2a6b8', lilla: '#b9a3dc',
};
Object.assign(TONI, { '#9fcf7f': '#86b968', '#f2a6b8': '#e08ca0', '#b9a3dc': '#a08ac6' });
const INCLINA = { rosso: -0.09, giallo: 0.08, azzurro: -0.06, verde: 0.09, rosa: -0.08, lilla: 0.06 };

function disegnaOmbrello(ctx, nome) {
  const C = OMBRELLI[nome], chiaro = schiarisci(C, 0.32);
  const rng = casuale(nome.length * 7 + nome.charCodeAt(0));
  ctx.rotate(INCLINA[nome]);
  // il manico ricurvo e l'asta
  tubo(ctx, [[7, -112], [7, -16], [6, -9], [0, -5.5], [-6, -9], [-7, -15]], 6, '#c4844f', LW);
  tubo(ctx, [[7, -112], [7, -40]], 3.5, '#9a8f98', LW, true);
  ctx.translate(7, 0);
  // la cupola: arco in alto, festoni sotto tra una stecca e l'altra
  const Y = -106, R = 74, CIMA = -176, N = 6;
  const punte = Array.from({ length: N + 1 }, (_, i) => [-R + (2 * R * i) / N, Y + (i === 0 || i === N ? 0 : 4 * Math.sin((Math.PI * i) / N))]);
  const cupola = new Path2D();
  cupola.moveTo(-R, Y);
  cupola.bezierCurveTo(-R + 4, Y - 46, -R * 0.55, CIMA, 0, CIMA);
  cupola.bezierCurveTo(R * 0.55, CIMA, R - 4, Y - 46, R, Y);
  for (let i = N - 1; i >= 0; i--) {
    const [xa, ya] = punte[i + 1], [xb, yb] = punte[i];
    cupola.quadraticCurveTo((xa + xb) / 2, (ya + yb) / 2 - 12, xb, yb);
  }
  cupola.closePath();
  pezzo(ctx, cupola, C, 1.3, LW * 1.15);
  // gli spicchi alterni più chiari e le stecche
  const stecca = (i) => [[0, CIMA], [punte[i][0] * 0.88, lerp(CIMA, Y, 0.45)], punte[i]];
  ctx.save();
  ctx.clip(cupola);
  for (let i = 1; i < N; i += 2) {
    const a = stecca(i), b = stecca(i + 1);
    const sp = new Path2D();
    sp.moveTo(0, CIMA);
    sp.quadraticCurveTo(a[1][0], a[1][1], a[2][0], a[2][1] + 14);
    sp.lineTo(b[2][0], b[2][1] + 14);
    sp.quadraticCurveTo(b[1][0], b[1][1], 0, CIMA);
    tinta(ctx, sp, chiaro, 0.75);
  }
  ctx.restore();
  for (let i = 1; i < N; i++) {
    const s = stecca(i);
    const p = new Path2D();
    p.moveTo(s[0][0], s[0][1]);
    p.quadraticCurveTo(s[1][0], s[1][1], s[2][0], s[2][1]);
    linea(ctx, p, { spessore: LW * 0.75, colore: tono(C) });
  }
  // il puntale in cima e i pomelli sulle punte delle stecche
  tubo(ctx, [[0, CIMA], [0, CIMA - 10]], 3, '#9a8f98', LW * 0.8, true);
  pezzo(ctx, Forme.cerchio(0, CIMA - 12, 3.2), '#9a8f98', 0, LW * 0.8);
  for (const [x, y] of punte) pezzo(ctx, Forme.cerchio(x, y + 1, 2.8), tono(C), 0, LW * 0.7);
  // le gocce che scivolano sulla cupola e quelle che pendono
  for (let i = 0; i < 3; i++) {
    const t = tra(rng, -0.75, 0.75);
    const x = t * R * 0.82, y = lerp(CIMA + 22, Y - 10, Math.abs(t) * 0.8 + tra(rng, 0, 0.15));
    gocciaAcqua(ctx, x, y, 3.8, Math.atan(t * 1.3) * 0.9);
  }
  const pende = 1 + Math.floor(rng() * (N - 1));
  gocciaAcqua(ctx, punte[pende][0], punte[pende][1] + 10, 3.6);
  gocciaAcqua(ctx, punte[(pende + 3) % (N - 1) + 1][0] - 2, punte[0][1] + 28, 3);
}

/* ------------------------------------------------------------------------ */
/*  6. GLI SCHIZZI DELLA POZZANGHERA                                        */
/* ------------------------------------------------------------------------ */
/*  Quando un'auto passa nella pozzanghera l'acqua si alza a corona:
 *  f0 sale, f1 è al massimo, f2 ricade, f3 restano solo i cerchi.
 *  L'acqua è trasparente: la dipingiamo piena su un foglio a parte e poi la
 *  incolliamo un po' trasparente (così le forme sovrapposte non si vedono). */

function disegnaSchizzi(ctx, k) {
  const base = [0, -18];
  const GETTI = [
    { lung: [30, 44, 54, 58, 54, 44, 30], apre: 0.26, piega: 0, larg: 15 },
    { lung: [62, 90, 110, 120, 110, 90, 62], apre: 0.3, piega: 0, larg: 17 },
    { lung: [56, 66, 62, 46, 62, 66, 56], apre: 0.42, piega: 0.5, larg: 13 },
  ];
  if (k < 3) {
    const G = GETTI[k];
    const forme = [Forme.ellisse(0, base[1] - 4, 46 + k * 6, 14 + (k === 1 ? 6 : 0))];
    G.lung.forEach((l, i) => {
      const lato = i - 3;
      forme.push(getto([base[0] + lato * 8, base[1] - 4], -Math.PI / 2 + lato * G.apre, l, G.larg, Math.sign(lato) * G.piega));
    });
    pezzo(ctx, forme, '#cdeaf8', 0.8, LW, '#a9d6ef', ACQUA.linea);
    // i lampi bianchi dentro i getti
    G.lung.forEach((l, i) => {
      const lato = i - 3;
      if (lato === 0 || Math.abs(lato) === 3) return;
      const a = -Math.PI / 2 + lato * G.apre + Math.sign(lato) * G.piega * 0.3;
      const da = piu([base[0] + lato * 8, base[1] - 4], polare(a, l * 0.25));
      const fino = piu([base[0] + lato * 8, base[1] - 4], polare(a, l * 0.6));
      tratto(ctx, [[da[0] - 2, da[1]], [fino[0] - 2, fino[1]]], LW * 1.3, '#ffffff');
    });
    // le goccioline volanti
    const rng = casuale(90 + k);
    for (let i = 0; i < 9; i++) {
      const lato = tra(rng, -1, 1);
      const a = -Math.PI / 2 + lato * (G.apre * 3.4), r = [60, 128, 84][k] * tra(rng, 0.7, 1.15);
      let [x, y] = piu(base, polare(a, r));
      if (k === 2) { x *= 1.35; y += 34; }
      const g = k === 2 ? goccia(x, y, tra(rng, 3, 4.5), 0) : Forme.cerchio(x, y, tra(rng, 2.8, 4.6));
      pezzo(ctx, g, '#e4f4fc', 0, LW * 0.8, null, ACQUA.linea);
      if (k === 2) tratto(ctx, [[x, y - 14], [x, y - 22]], LW * 0.6, ACQUA.linea, 0.6);   // la scia di chi cade
    }
  } else {
    // f3: rimangono i cerchi che si allargano e qualche goccia che rimbalza
    for (const [rx, ry, al] of [[100, 15, 0.9], [72, 11, 0.95], [42, 7, 1]]) {
      linea(ctx, Forme.ellisse(0, base[1], rx, ry), { spessore: LW * 1.2, colore: '#ffffff', alfa: al });
      linea(ctx, Forme.ellisse(0, base[1] + 1.5, rx, ry), { spessore: LW * 0.7, colore: ACQUA.linea, alfa: 0.7 });
    }
    pezzo(ctx, [Forme.ellisse(0, base[1] - 3, 12, 6), Forme.cerchio(0, base[1] - 14, 5)], '#cdeaf8', 0.5, LW, '#a9d6ef', ACQUA.linea);
    for (const [x, y, r] of [[-52, -44, 3.4], [46, -38, 3], [12, -58, 2.6], [-20, -34, 2.2]]) pezzo(ctx, Forme.cerchio(x, y, r), '#e4f4fc', 0, LW * 0.8, null, ACQUA.linea);
  }
}

function disegnaPozzanghera(ctx, nome, l, a) {
  const k = Number(nome.slice(1));
  // la pozza sotto (sempre uguale)
  const pozza = Forme.ellisse(0, -18, 116, 15);
  tinta(ctx, pozza, ACQUA.fondo, 0.55);
  linea(ctx, pozza, { spessore: LW * 0.8, colore: ACQUA.linea, alfa: 0.6 });
  tratto(ctx, [[-70, -22], [-40, -24]], LW, ACQUA.riflesso);
  // gli schizzi, dipinti a parte e incollati trasparenti
  const foglio = nuovaTela(l, a);
  const c = foglio.getContext('2d');
  c.translate(l / 2, a - LW);
  disegnaSchizzi(c, k);
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.drawImage(foglio, -l / 2, -(a - LW));
  ctx.restore();
}

/* ======================================================================== */
/*  ATLANTI                                                                 */
/* ======================================================================== */

const serie = (prefisso, n) => Array.from({ length: n }, (_, k) => prefisso + k);

/**
 * Costruisce un atlante. Ogni cella ha l'origine a terra, al centro in basso
 * (oppure al centro della cella, se "centro" è vero). "spessore" è la linea.
 */
function atlante(nomi, l, a, altezzaMondo, spessore, disegna, centro = false) {
  const { tela, fotogrammi } = creaAtlante(nomi, { l, a }, (ctx, nome) => {
    LW = spessore;
    ctx.translate(l / 2, centro ? a / 2 : a - spessore);
    disegna(ctx, nome, l, a);
  });
  return { tela, fotogrammi, cella: { l, a }, altezzaMondo };
}

/**
 * Dipinge tutta la scena della pioggia. Restituisce
 * { auto_pesce_gialla, auto_pesce_rossa, auto_pesce_azzurra, autobus_pesce,
 *   balena_pinne, fermata, ombrello, pozzanghera }.
 */
export async function creaPioggia() {
  const LATO = serie('lato_', 4);
  const elenco = [
    ['auto_pesce_gialla', LATO, 384, 256, 1.4, 1.8, disegnaAutoPesce(AUTO_PESCE.auto_pesce_gialla)],
    ['auto_pesce_rossa', LATO, 384, 256, 1.4, 1.8, disegnaAutoPesce(AUTO_PESCE.auto_pesce_rossa)],
    ['auto_pesce_azzurra', LATO, 384, 256, 1.4, 1.8, disegnaAutoPesce(AUTO_PESCE.auto_pesce_azzurra)],
    ['autobus_pesce', LATO, 768, 384, 2.6, 2.0, disegnaAutobusPesce],
    ['balena_pinne', serie('f', 6), 1024, 512, 16, 2.0, disegnaBalena, true],
    ['fermata', ['base'], 384, 384, 3.0, 1.9, disegnaFermata],
    ['ombrello', Object.keys(OMBRELLI), 192, 192, 1.1, 1.7, disegnaOmbrello],
    ['pozzanghera', serie('f', 4), 256, 192, 0.9, 1.7, disegnaPozzanghera],
  ];
  const risultato = {};
  for (const [nome, nomi, l, a, h, spessore, disegna, centro] of elenco) {
    risultato[nome] = atlante(nomi, l, a, h, spessore, disegna, centro);
    await respira();   // lascia respirare la pagina tra un atlante e l'altro
  }
  return risultato;
}
