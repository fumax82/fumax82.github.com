/* ==========================================================================
 *  scene_via.js — LA VIA DEI COLORI (prologo e capitolo 1)
 *  --------------------------------------------------------------------------
 *  Dipinge gli strati della prima scena: la via soleggiata dove Lia cammina
 *  verso destra, dalla casa gialla fino all'angolo in ombra con lo steccato.
 *  Stile: i fondali ad acquerello del corto "Out of Sight" (2010).
 *
 *  Gli strati (convenzioni in motore/strati.js):
 *    facciate_N            fila di case vicina   'z+'  z = -1.8        x -10..54
 *    steccato              assi ocra col buco     'x-'  x = 46.6        z -1.8..1.2
 *    marciapiede_N         lastre di pietra       'su'  y = 0.08        z -1.8..1.0
 *    cordolo_N             faccia del cordolo     'z+'  z = 1.0         y 0..0.08
 *    strada_N              asfalto viola-grigio   'su'  y = 0           z 1.0..7.5
 *    cordolo_fronte, marciapiede_fronte_N, facciate_fronte_N  (lato opposto)
 *    albero_1, albero_2    alberi del viale       'z+'  z = 0.9
 *
 *  COME SI DIPINGE: ogni tela è un "foglio" che usa le coordinate del MONDO
 *  (metri, y verso l'alto): una finestra a x = 7.3 si disegna proprio a 7.3.
 *  Le strisce più larghe di 2048 pixel sono tagliate in più fogli; ogni casa
 *  ha il suo seme, quindi ogni foglio ridipinge identico ciò che attraversa
 *  il taglio (niente cuciture).
 * ========================================================================== */
import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa,
  percorso, Forme, trama, respira,
} from './pennello.js';

/* ============================ 1. MISURE E COLORI ============================ */
const INK = STILE.inchiostro;              // linee seppia
const OMBRA = '#5d4b7c';                   // le ombre sono viola, mai nere
const CARTA = STILE.carta;
const VIRATE = ['#f3c46a', '#e8747c', '#86a9d6', '#9cc58a']; // tinte vicine per variare il pigmento
const X0 = -10, X1 = 54;                   // la via va oltre il percorso di Lia (0..46)
const STECCATO_X = 46.6;                   // oltre lo steccato: il mondo sconosciuto (carta bianca)
// pixel per unità: strati vicini più fitti, lontani più radi
const RIS = { facciate: 84, marciapiede: 80, cordolo: 64, cordoloFronte: 32, strada: 56, lontano: 48, albero: 100, steccato: 112 };

const om = (a) => conAlfa(OMBRA, a);                         // ombra viola con opacità a
const lu = (a) => 'rgba(255,249,232,' + a + ')';             // luce calda con opacità a
const scegli = (r, v) => v[Math.floor(r() * v.length)];
const nuovoSeme = (r) => Math.floor(r() * 1e6) + 1;

// fioriere: cassetta, fiori, foglie [scuro, medio, chiaro]
const FOGLIE = ['#3f7d4c', '#5f9e58', '#9ccd7a'];
const FIORI = {
  rossi: { cassetta: '#c8744e', fiori: ['#e84a5f', '#ff8fa3', '#f05a4f'], foglie: FOGLIE },
  rosa: { cassetta: '#b9805e', fiori: ['#f48fb1', '#fff3f0', '#e05d7a'], foglie: FOGLIE },
  arancio: { cassetta: '#8a9c6c', fiori: ['#f2703a', '#ff9f3c', '#ffd166'], foglie: FOGLIE },
  verde: { cassetta: '#c98a62', fiori: ['#f7b2c4', '#ffffff'], foglie: ['#3a7550', '#58975a', '#8cc472'], pochi: true },
};
// verdi delle chiome: scuri (dentro), medi, chiari (al sole)
const VERDI = {
  scuri: ['#2c6248', '#3c7a52', '#5a965c'],
  medi: ['#468855', '#67a65d', '#97c874'],
  chiari: ['#64a85d', '#93c86f', '#d3e9a0'],
};
// porte con gradino: [centro x, larghezza] (il marciapiede dipinge il piano del gradino)
const GRADINI = [[-5.3, 1.25], [2.95, 0.95], [7.3, 1.35], [19.3, 1.1], [25.5, 1.2]];

/* ========================== 2. IL FOGLIO DA DIPINGERE ========================== */

/**
 * Un foglio: una tela che copre il rettangolo (u0..u0+l, v0..v0+a) del mondo.
 *   versoGiu = false → muri: v è l'altezza y (cresce verso l'alto)
 *   versoGiu = true  → pavimenti: v è la z (l'alto dell'immagine è la z più piccola)
 * Sv (facoltativo) permette una risoluzione verticale diversa (cordoli sottili).
 */
function foglio(u0, v0, l, a, S, versoGiu, Sv) {
  Sv = Sv || S;
  const tela = nuovaTela(Math.round(l * S), Math.round(a * Sv)), c = tela.getContext('2d');
  if (versoGiu) c.setTransform(S, 0, 0, Sv, -u0 * S, -v0 * Sv);
  else c.setTransform(S, 0, 0, -Sv, -u0 * S, (v0 + a) * Sv);
  return { tela, c, S, px: 1 / S, u0, v0, u1: u0 + l, v1: v0 + a, giu: !!versoGiu };
}
/** Il foglio vede la fascia da a a b? (per saltare ciò che cade fuori) */
const vede = (f, a, b) => b > f.u0 - 0.6 && a < f.u1 + 0.6;

/** Divide [u0, u1] in pezzi larghi al massimo 2048 pixel: [[inizio, larghezza], ...] */
function pezzi(u0, u1, S) {
  const n = Math.ceil(((u1 - u0) * S) / 2048), l = Math.ceil(((u1 - u0) * S) / n) / S;
  return Array.from({ length: n }, (_, k) => [u0 + k * l, Math.min(l, u1 - (u0 + k * l))]);
}

/* Grana della carta con trasparenza: puntini scuri dove il pigmento si deposita. */
let GRANA = null, MACCHIE = null;
function trameAlfa() {
  if (GRANA) return;
  const converti = (sorgente, soglia, forza) => {
    const t = nuovaTela(256, 256), c = t.getContext('2d');
    c.drawImage(sorgente, 0, 0); const d = c.getImageData(0, 0, 256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = d.data[i] / 255;
      d.data[i] = 74; d.data[i + 1] = 52; d.data[i + 2] = 84;
      d.data[i + 3] = Math.max(0, Math.min(255, (soglia - v) * forza * 255));
    }
    c.putImageData(d, 0, 0); return t;
  };
  GRANA = converti(trama('grana'), 0.9, 1.6);
  MACCHIE = converti(trama('macchie'), 0.8, 1.0);
}
/** Granulosità finale su tutto il foglio (solo dove c'è già colore). */
function granula(f, forza) {
  trameAlfa();
  const c = f.c, k = forza === undefined ? 1 : forza, m = c.createPattern(MACCHIE, 'repeat');
  m.setTransform(new DOMMatrix().scale(4));                       // macchie larghe e morbide
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.3 * k;
  for (const motivo of [c.createPattern(GRANA, 'repeat'), m]) { c.fillStyle = motivo; c.fillRect(0, 0, f.tela.width, f.tela.height); }
  c.restore();
}

/* ============================ 3. PENNELLI DI BASE ============================ */

/** Spezzata "a mano": i punti tremano di t pixel, come una penna vera. */
function mano(f, r, punti, chiuso, t, p) {
  p = p || new Path2D();
  const j = (v) => v + (r() - 0.5) * 2 * (t === undefined ? 0.6 : t) * f.px;
  const pts = chiuso ? punti.concat([punti[0]]) : punti;
  p.moveTo(j(pts[0][0]), j(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.round((Math.hypot(x1 - x0, y1 - y0) * f.S) / 34));
    for (let s = 1; s <= n; s++) {
      const m = (s - 0.5) / n, q = s / n;
      p.quadraticCurveTo(j(x0 + (x1 - x0) * m), j(y0 + (y1 - y0) * m), j(x0 + (x1 - x0) * q), j(y0 + (y1 - y0) * q));
    }
  }
  if (chiuso) p.closePath();
  return p;
}
const rett = (x, y, l, a) => { const p = new Path2D(); p.rect(x, y, l, a); return p; };
// ellissi "in metri" (Forme.ellisse di pennello.js ha un raggio minimo pensato per i pixel)
const ell = (x, y, rx, ry, rot) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); return p; };
const cerchio = (x, y, r) => ell(x, y, r, r);
const rettMano = (f, r, x, y, l, a, t) => mano(f, r, [[x, y], [x + l, y], [x + l, y + a], [x, y + a]], true, t);

/** Arco a tutto sesto: rettangolo con il semicerchio in alto (altezza totale a). */
function arcata(x, y, l, a) {
  const p = new Path2D(), R = l / 2;
  p.moveTo(x, y); p.lineTo(x + l, y); p.lineTo(x + l, y + a - R);
  p.arc(x + R, y + a - R, R, 0, Math.PI, false);
  p.closePath();
  return p;
}
/** Macchia irregolare (un'ellisse un po' storta). */
function blob(r, cx, cy, rx, ry, n, irr, spigoloso) {
  const pts = [];
  for (let i = 0; i < (n || 10); i++) {
    const a = (i / (n || 10)) * Math.PI * 2, k = 1 + tra(r, -(irr || 0.2), irr || 0.2);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return Forme.poligono(pts, !spigoloso);
}

/** Linea a inchiostro seppia (spessore in pixel). */
function ink(f, forma, w, alfa, col) {
  const c = f.c;
  c.save(); c.globalAlpha = alfa === undefined ? 0.8 : alfa; c.strokeStyle = col || INK;
  c.lineWidth = (w || 1.2) * f.px; c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke(percorso(forma)); c.restore();
}
/** Riempimento piatto. */
function piatto(f, forma, col, alfa) {
  const c = f.c;
  c.save(); c.globalAlpha = alfa === undefined ? 1 : alfa; c.fillStyle = col; c.fill(percorso(forma)); c.restore();
}
/** Sfumatura lungo v: col0 a v = y, col1 a v = y + a (ombre al piede, sotto i cornicioni...). */
function sfumaV(f, x, y, l, a, col0, col1) {
  const g = f.c.createLinearGradient(0, y, 0, y + a);
  g.addColorStop(0, col0); g.addColorStop(1, col1); f.c.fillStyle = g; f.c.fillRect(x, y, l, a);
}
/** Sfumatura lungo u (da sinistra a destra). */
function sfumaU(f, x, y, l, a, col0, col1) {
  const g = f.c.createLinearGradient(x, 0, x + l, 0);
  g.addColorStop(0, col0); g.addColorStop(1, col1); f.c.fillStyle = g; f.c.fillRect(x, y, l, a);
}

/**
 * VELATURA AD ACQUERELLO dentro una forma. area = [x, y, l, a] in metri.
 * o: { seme, alfa, variazione, raggio (macchie, in metri), macchie, segni
 *      (pennellate visibili), fioriture (aloni chiari dal bordo scuro), luce, bordo }
 */
function lava(f, forma, col, area, o) {
  o = o || {};
  const c = f.c, p = percorso(forma), r = casuale(o.seme || 1);
  const [x, y, l, a] = area;
  c.save(); c.clip(p);
  c.globalAlpha = o.alfa === undefined ? 1 : o.alfa; c.fillStyle = col; c.fillRect(x, y, l, a);  // 1) la stesura di base
  // 2) macchie: il pigmento non è mai uniforme (più chiaro, più scuro, virato)
  const v = o.variazione === undefined ? 0.3 : o.variazione, R = o.raggio || 1.5;
  const n = o.macchie === undefined ? Math.min(16, 2 + Math.round((l * a) / (R * R))) : o.macchie;
  c.globalAlpha = 1;
  for (let k = 0; k < n; k++) {
    const cx = x + r() * l, cy = y + r() * a, rr = R * tra(r, 0.4, 1.1), q = r();
    const tono = q < 0.45 ? schiarisci(col, 0.4) : q < 0.8 ? scurisci(col, 0.22) : mescola(col, scegli(r, VIRATE), 0.5);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, conAlfa(tono, v)); g.addColorStop(1, conAlfa(tono, 0)); c.fillStyle = g; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  // 3) pennellate: segni allungati appena visibili
  for (let k = 0; k < (o.segni || 0); k++) {
    const cx = x + r() * l, cy = y + r() * a, rx = R * tra(r, 0.3, 0.9);
    c.globalAlpha = tra(r, 0.06, 0.13); c.fillStyle = r() < 0.6 ? scurisci(col, 0.25) : schiarisci(col, 0.5);
    c.fill(ell(cx, cy, rx, rx * tra(r, 0.12, 0.3), tra(r, -0.5, 0.5)));
  }
  // fioriture: l'acqua respinge il pigmento e lascia un alone chiaro col bordo scuro
  for (let k = 0; k < (o.fioriture || 0); k++) {
    const cx = x + r() * l, cy = y + r() * a, rr = R * tra(r, 0.25, 0.6), fo = blob(r, cx, cy, rr, rr * tra(r, 0.5, 1), 9, 0.35);
    c.globalAlpha = 0.16; c.fillStyle = schiarisci(col, 0.55); c.fill(fo);
    c.globalAlpha = 0.22; c.strokeStyle = scurisci(col, 0.3); c.lineWidth = 1.4 * f.px; c.stroke(fo);
  }
  // 4) la luce del sole viene dall'alto
  c.globalAlpha = 1;
  if (o.luce !== false && !f.giu) sfumaV(f, x, y, l, a, lu(0), lu(0.3));
  // 5) bordo bagnato: il colore si accumula dove l'acqua si asciuga
  const b = o.bordo === undefined ? 0.5 : o.bordo;
  if (b > 0) {
    c.strokeStyle = scurisci(col, 0.32);
    c.globalAlpha = b * 0.35; c.lineWidth = 5 * f.px; c.stroke(p);
    c.globalAlpha = b * 0.7; c.lineWidth = 1.5 * f.px; c.stroke(p);
  }
  c.restore();
}

/** Scritta dipinta (insegne): in metri, centrata in (x, y). */
function scritta(f, testo, x, y, dim, col, stile) {
  const c = f.c;
  c.save(); c.translate(x, y); c.scale(f.px, f.giu ? f.px : -f.px);    // torna ai pixel, con il testo dritto
  c.font = (stile || 'italic bold') + ' ' + Math.round(dim * f.S) + 'px Georgia, "DejaVu Serif", serif';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(testo, 0, 0);
  c.globalAlpha = 0.7; c.lineWidth = 0.8; c.strokeStyle = INK; c.strokeText(testo, 0, 0); c.restore();
}

/* ================================ 4. VERDE ================================ */

/** Una foglia appuntita (misure in metri, inchiostro facoltativo). */
function foglia(f, x, y, ang, lung, larg, col, inkA) {
  const c = f.c, co = Math.cos(ang), si = Math.sin(ang), p = new Path2D();
  const mx = x + co * lung * 0.45, my = y + si * lung * 0.45, nx = -si * larg, ny = co * larg;
  p.moveTo(x, y);
  p.quadraticCurveTo(mx + nx, my + ny, x + co * lung, y + si * lung);
  p.quadraticCurveTo(mx - nx, my - ny, x, y);
  c.globalAlpha = 0.9; c.fillStyle = col; c.fill(p);
  if (inkA) { c.globalAlpha = inkA; c.strokeStyle = INK; c.lineWidth = 0.9 * f.px; c.stroke(p); }
  c.globalAlpha = 1;
}
/** Foglia d'edera a tre lobi. */
function fogliaEdera(f, x, y, d, ang, col, inkA) {
  const p = new Path2D(), pt = (k, a) => [x + Math.cos(ang + a) * d * k, y + Math.sin(ang + a) * d * k];
  const T = pt(1, 0), L = pt(0.72, 1.2), R = pt(0.72, -1.2);
  p.moveTo(x, y);
  p.quadraticCurveTo(...pt(0.45, 2.2), ...L);
  p.quadraticCurveTo(...pt(0.8, 0.55), ...T);
  p.quadraticCurveTo(...pt(0.8, -0.55), ...R);
  p.quadraticCurveTo(...pt(0.45, -2.2), x, y);
  piatto(f, p, col, 0.92);
  if (inkA) ink(f, p, 0.9, inkA);
}
/**
 * Un ciuffo di fogliame: una macchia morbida + tante foglie.
 * In basso le foglie sono più scure, in alto (e a sinistra, verso il sole) più chiare.
 * o: { colori: [scuro, medio, chiaro], quante, dim, seme, ink, alfa, edera }
 */
function cespo(f, cx, cy, rx, ry, o) {
  const r = casuale(o.seme), [sc, me, ch] = o.colori, massa = blob(r, cx, cy, rx * 0.92, ry * 0.92, 11, 0.2);
  lava(f, massa, me, [cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6],
    { seme: o.seme + 1, variazione: 0.35, bordo: 0.4, raggio: Math.max(rx, ry), luce: false, alfa: o.alfa || 0.9, macchie: 3 });
  f.c.save(); f.c.clip(massa);                                  // volume: sotto in ombra, sopra al sole
  sfumaV(f, cx - rx, cy - ry, rx * 2, ry * 2, conAlfa(sc, 0.75), conAlfa(ch, 0.35));
  f.c.restore();
  const n = o.quante || Math.round(rx * ry * 300);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.05;
    const x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
    const t = (y - (cy - ry)) / (2 * ry) + ((cx - x) / rx) * 0.12;      // 0 in basso, 1 in alto
    const col = t > 0.62 ? mescola(me, ch, tra(r, 0.3, 1)) : t > 0.3 ? mescola(sc, me, tra(r, 0.4, 1)) : mescola(sc, me, r() * 0.4);
    const ang = d > 0.4 ? a + tra(r, -0.7, 0.7) : r() * Math.PI * 2;
    const dim = o.dim * tra(r, 0.75, 1.25);
    if (o.edera) fogliaEdera(f, x, y, dim, ang, col, r() < 0.35 ? o.ink : 0);
    else foglia(f, x, y, ang, dim, dim * tra(r, 0.28, 0.4), col, r() < 0.3 ? o.ink : 0);
  }
}
/** Fiorellini a cinque petali sparsi in un rettangolo. */
function fiori(f, x, y, l, a, colori, n, seme, d) {
  const r = casuale(seme), c = f.c;
  for (let k = 0; k < n; k++) {
    const fx = x + r() * l, fy = y + r() * a;
    c.globalAlpha = 0.92; c.fillStyle = scegli(r, colori); c.beginPath();
    for (let p = 0; p < 5; p++) {
      const an = (p / 5) * Math.PI * 2 + r();
      c.moveTo(fx + Math.cos(an) * d * 0.6 + d * 0.5, fy + Math.sin(an) * d * 0.6);
      c.arc(fx + Math.cos(an) * d * 0.6, fy + Math.sin(an) * d * 0.6, d * 0.5, 0, Math.PI * 2);
    }
    c.fill();
    c.fillStyle = '#f6d66b'; c.beginPath(); c.arc(fx, fy, d * 0.28, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}
/** Un tralcio che pende: stelo, foglie alterne e (se servono) grappoli di fiori. */
function tralcio(f, x, y, lung, o) {
  const r = casuale(o.seme), d = o.dim, n = Math.max(3, Math.round(lung / (d * 0.9))), pts = [];
  let px = x;
  for (let i = 0; i <= n; i++) { px += tra(r, -0.3, 0.3) * d; pts.push([px, y - (lung * i) / n]); }
  ink(f, Forme.curva(pts), 1.1, 0.65, '#4f7040');
  for (let i = 1; i <= n; i++) {
    const [lx, ly] = pts[i], lato = i % 2 ? 1 : -1, col = mescola(o.foglie[0], o.foglie[2], r());
    if (o.edera) fogliaEdera(f, lx, ly, d * tra(r, 0.8, 1.2), -Math.PI / 2 + lato * tra(r, 0.4, 1.0), col, r() < 0.4 ? 0.6 : 0);
    else foglia(f, lx, ly, -Math.PI / 2 + lato * tra(r, 0.5, 1.1), d * tra(r, 0.8, 1.25), d * 0.38, col, r() < 0.4 ? 0.55 : 0);
    if (o.fiori && r() < (o.quantiFiori || 0.4)) fiori(f, lx - d * 0.6, ly - d * 0.5, d * 1.2, d, o.fiori, 3, nuovoSeme(r), d * 0.32);
  }
}
/** Un tratto di ramo che si assottiglia (contorno a inchiostro). */
function ramo(f, pts, w0, w1, col) {
  const c = f.c, curva = Forme.curva(pts);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = INK; c.globalAlpha = 0.85; c.lineWidth = (w0 + w1) / 2 + 2.2 * f.px; c.stroke(curva);
  for (let i = 1; i < pts.length; i++) {
    const p = new Path2D(); p.moveTo(...pts[i - 1]); p.lineTo(...pts[i]);
    const w = w0 + ((w1 - w0) * i) / pts.length;
    c.globalAlpha = 1; c.strokeStyle = col || '#8c7d6e'; c.lineWidth = w; c.stroke(p);
    c.strokeStyle = lu(0.35); c.lineWidth = w * 0.35;
    c.save(); c.translate(-w * 0.2, 0); c.stroke(p); c.restore();
  }
  c.restore();
}
/** Chioma d'albero: ciuffi scuri dietro, poi i rami (funzione "rami"), poi ciuffi chiari davanti. */
function chioma(f, cx, cy, rx, ry, seme, rami, scala) {
  const r = casuale(seme), k0 = scala || 1;
  for (let k = 0; k < 10; k++) {                       // massa interna, scura e fresca
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.72;
    cespo(f, cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, rx * tra(r, 0.34, 0.46), ry * tra(r, 0.36, 0.5),
      { colori: VERDI.scuri, dim: 0.2 * k0, seme: nuovoSeme(r), ink: 0.4 });
  }
  if (rami) rami();
  for (let k = 0; k < 16; k++) {                       // ciuffi davanti: chiari dove batte il sole (in alto a sinistra)
    const a = (k / 16) * Math.PI * 2 + tra(r, -0.3, 0.3), d = k % 4 === 0 ? tra(r, 0.1, 0.4) : k % 5 === 1 ? tra(r, 0.9, 1.05) : tra(r, 0.55, 0.8);
    const x = cx + Math.cos(a) * d * rx, y = cy + Math.sin(a) * d * ry;
    const sole = Math.sin(a) > 0.15 || Math.cos(a) < -0.5;
    cespo(f, x, y, rx * tra(r, 0.25, 0.34), ry * tra(r, 0.28, 0.38),
      { colori: sole ? VERDI.chiari : VERDI.medi, dim: 0.2 * k0, seme: nuovoSeme(r), ink: 0.55 });
  }
}

/* ============================ 5. PARTI DI CASA ============================ */

/** Il muro di una casa (velatura con pennellate) e, se richiesto, lo zoccolo. */
function parete(f, x0, x1, alto, col, seme, o) {
  o = o || {};
  const r = casuale(seme), forma = o.forma || rettMano(f, r, x0, 0, x1 - x0, alto, 0.5);
  lava(f, forma, col, [x0, 0, x1 - x0, alto + (o.extra || 0)], { seme, raggio: 2, variazione: 0.4,
    segni: Math.round(((x1 - x0) * alto) / 2), fioriture: Math.round(((x1 - x0) * alto) / 7), bordo: 0.6 });
  sfumaU(f, x0, 0, 0.5, alto, om(0.1), om(0)); sfumaU(f, x1 - 0.6, 0, 0.6, alto, om(0), om(0.12));  // bordi più carichi
  if (o.zoccolo) {
    const z = rett(x0, 0, x1 - x0, o.zoccolo);
    lava(f, z, o.coloreZoccolo || scurisci(col, 0.15), [x0, 0, x1 - x0, o.zoccolo], { seme: seme + 1, macchie: 3, raggio: 1, luce: false });
    ink(f, mano(f, r, [[x0, o.zoccolo], [x1, o.zoccolo]]), 1.1, 0.7);
  }
  return forma;
}
/** Fine di ogni casa: ombra morbida al piede e contorno a inchiostro. */
function finisci(f, x0, x1, forma) {
  sfumaV(f, x0, 0, x1 - x0, 0.8, om(0.34), om(0));
  ink(f, forma, 1.4, 0.85);
}
/** Fascia marcapiano (o cornicione) con l'ombra sotto; dentelli facoltativi. */
function fascia(f, x0, x1, y, h, col, dentelli) {
  sfumaV(f, x0, y - 0.32, x1 - x0, 0.32, om(0), om(0.3));
  const fo = rett(x0 - 0.08, y, x1 - x0 + 0.16, h);
  lava(f, fo, col, [x0 - 0.1, y, x1 - x0 + 0.2, h], { seme: Math.round(y * 99 + x0 * 7), macchie: 3, raggio: 1, bordo: 0.4 });
  piatto(f, rett(x0 - 0.08, y, x1 - x0 + 0.16, h * 0.28), om(0.22));
  if (dentelli) {
    const p = new Path2D();
    for (let x = x0 + 0.08; x < x1 - 0.1; x += 0.3) p.rect(x, y - 0.13, 0.15, 0.13);
    piatto(f, p, col); piatto(f, p, om(0.12)); ink(f, p, 0.8, 0.6);
  }
  ink(f, fo, 1.1, 0.75);
}
/** Ombra sotto la gronda + tetto di coppi visto di fronte (colonne di tegole curve). */
function tettoCoppi(f, x0, x1, y, h, col, seme, travi) {
  if (!vede(f, x0, x1)) return;
  const r = casuale(seme), xa = x0 - 0.2, xb = x1 + 0.2, c = f.c;
  sfumaV(f, x0, y - 0.7, x1 - x0, 0.7, om(0), om(0.4));
  if (travi) {
    const p = new Path2D();
    for (let x = xa + 0.2; x < xb - 0.1; x += 0.42) p.rect(x, y - 0.22, 0.09, 0.22);
    piatto(f, p, '#8e5f42'); ink(f, p, 0.9, 0.6);
  }
  const forma = mano(f, r, [[xa, y], [xb, y], [xb - 0.06, y + h], [xa + 0.06, y + h]], true, 0.5);
  lava(f, forma, col, [xa, y, xb - xa, h], { seme, raggio: 1.2, variazione: 0.3, bordo: 0.5 });
  c.save(); c.clip(forma);
  const w = 0.24, solchi = new Path2D(), giri = new Path2D(), bocche = new Path2D();
  for (let x = xa; x < xb; x += w) {
    c.fillStyle = conAlfa(scurisci(col, 0.45), 0.35); c.fillRect(x, y, 0.06, h);   // canale in ombra
    c.fillStyle = lu(0.25); c.fillRect(x + 0.08, y, 0.05, h);                     // dorso al sole
    mano(f, r, [[x, y], [x, y + h]], false, 0.4, solchi);
    for (let yy = y + tra(r, 0.12, 0.32); yy < y + h - 0.05; yy += tra(r, 0.3, 0.38)) {
      giri.moveTo(x + 0.06, yy); giri.quadraticCurveTo(x + w / 2 + 0.03, yy - 0.06, x + w, yy);
    }
    bocche.moveTo(x + w - 0.02, y + 0.02); bocche.arc(x + w / 2 + 0.02, y + 0.02, w / 2 - 0.04, 0, Math.PI, false);
  }
  piatto(f, bocche, scurisci(col, 0.5), 0.55);
  c.restore();
  ink(f, solchi, 0.8, 0.4); ink(f, giri, 0.8, 0.35);
  const gronda = rett(xa, y - 0.06, xb - xa, 0.12);
  piatto(f, gronda, '#7d5039'); ink(f, gronda, 1, 0.75);
  ink(f, forma, 1.3, 0.8);
}
/** Tetto di ardesia: file di lastrine sfalsate grigio-azzurre. */
function tettoArdesia(f, x0, x1, y, h, col, seme) {
  if (!vede(f, x0, x1)) return;
  const r = casuale(seme), xa = x0 - 0.15, xb = x1 + 0.15, c = f.c;
  sfumaV(f, x0, y - 0.6, x1 - x0, 0.6, om(0), om(0.36));
  const forma = mano(f, r, [[xa, y], [xb, y], [xb - 0.05, y + h], [xa + 0.05, y + h]], true, 0.5);
  lava(f, forma, col, [xa, y, xb - xa, h], { seme, raggio: 1.2, variazione: 0.3, bordo: 0.5 });
  c.save(); c.clip(forma);
  const righe = new Path2D(), giunti = new Path2D();
  for (let yy = y + 0.17, j = 0; yy < y + h; yy += 0.17, j++) {
    mano(f, r, [[xa, yy], [xb, yy]], false, 0.5, righe);
    for (let x = xa + (j % 2) * 0.16; x < xb; x += 0.32) {
      giunti.moveTo(x, yy - 0.17); giunti.lineTo(x, yy);
      if (r() < 0.25) piatto(f, rett(x, yy - 0.17, 0.32, 0.17), r() < 0.5 ? lu(0.25) : om(0.15));
    }
  }
  c.restore();
  ink(f, righe, 0.8, 0.45); ink(f, giunti, 0.7, 0.35);
  const gronda = rett(xa, y - 0.05, xb - xa, 0.1);
  piatto(f, gronda, schiarisci(col, 0.5)); ink(f, gronda, 1, 0.7);
  ink(f, forma, 1.3, 0.8);
}
/** Comignolo con cappello e due vasetti. */
function camino(f, x, y, l, a, col, seme) {
  const r = casuale(seme), corpo = rettMano(f, r, x, y, l, a, 0.4);
  lava(f, corpo, col, [x, y, l, a], { seme, macchie: 2, raggio: 0.5 });
  piatto(f, rett(x + l * 0.62, y, l * 0.38, a), om(0.2));
  const vasi = new Path2D();
  vasi.rect(x + l * 0.18, y + a + 0.08, 0.1, 0.2); vasi.rect(x + l * 0.6, y + a + 0.08, 0.1, 0.16);
  piatto(f, vasi, '#c9714c'); ink(f, vasi, 0.9, 0.7);
  const cap = rett(x - 0.07, y + a, l + 0.14, 0.09);
  piatto(f, cap, '#e2d9c8'); ink(f, cap, 1, 0.75);
  ink(f, corpo, 1.2, 0.8);
}
/** Pluviale: tubo con collari e la "scarpa" in fondo. */
function pluviale(f, x, y0, y1, col) {
  col = col || '#d9d4c8';
  const w = 0.1;
  piatto(f, rett(x + w / 2, y0, 0.07, y1 - y0), om(0.2));               // ombra sul muro
  const tubo = rett(x - w / 2, y0 + 0.16, w, y1 - y0 - 0.16);
  piatto(f, tubo, col);
  piatto(f, rett(x - w / 2 + 0.015, y0 + 0.16, 0.025, y1 - y0 - 0.16), lu(0.6));
  piatto(f, rett(x + w / 2 - 0.03, y0 + 0.16, 0.03, y1 - y0 - 0.16), om(0.18));
  const collari = new Path2D();
  for (let y = y0 + 0.9; y < y1 - 0.3; y += 1.5) collari.rect(x - w / 2 - 0.015, y, w + 0.03, 0.05);
  piatto(f, collari, schiarisci(col, 0.3)); ink(f, collari, 0.8, 0.6);
  const scarpa = Forme.poligono([[x - w / 2, y0 + 0.3], [x + w / 2, y0 + 0.3], [x + w / 2 + 0.13, y0 + 0.08], [x - w / 2 + 0.07, y0 + 0.08]]);
  piatto(f, scarpa, col); ink(f, scarpa, 1, 0.75);
  ink(f, tubo, 1.1, 0.75);
}
/** Persiana con le stecche orizzontali. */
function persiana(f, x, y, l, a, col, seme) {
  const fo = rett(x, y, l, a), scure = new Path2D(), chiare = new Path2D();
  lava(f, fo, col, [x, y, l, a], { seme, macchie: 2, raggio: 0.6, bordo: 0.4 });
  for (let yy = y + 0.1; yy < y + a - 0.08; yy += 0.075) {
    scure.moveTo(x + 0.05, yy); scure.lineTo(x + l - 0.05, yy);
    chiare.moveTo(x + 0.05, yy - 0.018); chiare.lineTo(x + l - 0.05, yy - 0.018);
  }
  ink(f, chiare, 1, 0.35, schiarisci(col, 0.5));
  ink(f, scure, 1, 0.45, scurisci(col, 0.5));
  ink(f, rett(x + 0.045, y + 0.045, l - 0.09, a - 0.09), 0.8, 0.45);
  ink(f, fo, 1.2, 0.8);
}
/**
 * FINESTRA. (cx, y) = centro in basso; l × a = luce del telaio.
 * o: { cornice, vetro, arco, persiane (colore), chiuse, contorno (pietra),
 *      fioriera (FIORI.x), tende, grata, pietra, seme }
 */
function finestra(f, cx, y, l, a, o) {
  o = o || {};
  if (!vede(f, cx - l * 1.3, cx + l * 1.3)) return;
  const seme = o.seme || Math.round(cx * 131 + y * 17 + 5), r = casuale(seme), x = cx - l / 2, c = f.c;
  const forma = (d) => (o.arco ? arcata(x + d, y + d, l - 2 * d, a - 2 * d) : rett(x + d, y + d, l - 2 * d, a - 2 * d));
  const cornice = o.cornice || '#fbf6ec', vetro = o.vetro || '#7397b6', hp = o.arco ? a - l / 2 : a;
  if (o.persiane && !o.chiuse) {
    persiana(f, x - l * 0.5 - 0.03, y, l * 0.5, hp, o.persiane, seme + 1);
    persiana(f, x + l + 0.03, y, l * 0.5, hp, o.persiane, seme + 2);
  }
  if (o.contorno) {
    sfumaV(f, x - 0.1, y - 0.1, l + 0.3, a + 0.2, om(0.12), om(0.12));
    lava(f, forma(-0.11), o.contorno, [x - 0.12, y - 0.12, l + 0.24, a + 0.24], { seme: seme + 3, macchie: 2, raggio: 0.6, bordo: 0.4 });
    ink(f, forma(-0.11), 1, 0.7);
  }
  lava(f, forma(0), cornice, [x, y, l, a], { seme: seme + 4, macchie: 2, raggio: 0.5, bordo: 0.35 });
  // il vetro: scuro in alto (riflette la gronda), chiaro in basso, riflessi in diagonale
  const fv = forma(0.07);
  c.save(); c.clip(fv);
  const g = c.createLinearGradient(0, y, 0, y + a);
  g.addColorStop(0, schiarisci(vetro, 0.2)); g.addColorStop(0.55, vetro); g.addColorStop(1, scurisci(vetro, 0.35));
  c.fillStyle = g; c.fillRect(x, y, l, a);
  if (o.tende) { c.globalAlpha = 0.6; c.fillStyle = o.tende; c.fill(blob(r, x + 0.08, y + a * 0.5, l * 0.22, a * 0.55, 9, 0.12)); }
  c.globalAlpha = 0.22; c.fillStyle = '#ffffff';
  for (const k of [0.15, 0.55]) {
    const d = l * k;
    c.fill(Forme.poligono([[x + d, y], [x + d + l * 0.22, y], [x + d + l * 0.22 + a * 0.5, y + a], [x + d + a * 0.5, y + a]]));
  }
  c.globalAlpha = 1;
  sfumaV(f, x, y + a - 0.3, l, 0.3, om(0), om(0.45));
  sfumaU(f, x, y, 0.16, a, om(0.35), om(0));
  c.restore();
  if (!o.chiuse) {
    const bar = new Path2D();
    if (l > 0.6) bar.rect(cx - 0.025, y + 0.07, 0.05, a - 0.14);
    if (a > 1.1) bar.rect(x + 0.07, y + hp * 0.66, l - 0.14, 0.05);
    piatto(f, bar, cornice); ink(f, bar, 0.8, 0.55);
  }
  if (o.grata) {
    const p = new Path2D();
    for (let k = 1; k < 5; k++) { p.moveTo(x + (l * k) / 5, y + 0.07); p.lineTo(x + (l * k) / 5, y + a - 0.07); }
    ink(f, p, 1.6, 0.8, '#4a3f48');
  }
  ink(f, forma(0), 1.3, 0.8); ink(f, fv, 0.9, 0.55);
  if (o.chiuse) {
    persiana(f, x + 0.06, y + 0.06, l / 2 - 0.06, hp - 0.12, o.persiane || '#7aa37c', seme + 5);
    persiana(f, cx, y + 0.06, l / 2 - 0.06, hp - 0.12, o.persiane || '#7aa37c', seme + 6);
  }
  // davanzale con la sua ombra
  sfumaV(f, x - 0.04, y - 0.36, l + 0.16, 0.28, om(0), om(0.32));
  const dz = rett(x - 0.09, y - 0.09, l + 0.18, 0.1);
  piatto(f, dz, o.pietra || '#efe7d8'); piatto(f, rett(x - 0.09, y - 0.09, l + 0.18, 0.035), om(0.2));
  ink(f, dz, 1.1, 0.75);
  if (o.fioriera) fioriera(f, cx, y - 0.09, l + 0.08, o.fioriera, seme + 7);
}
/** Cassetta di fiori sotto la finestra, con foglie che ricadono. */
function fioriera(f, cx, y, l, tipo, seme) {
  const r = casuale(seme), x = cx - l / 2, h = 0.22;
  cespo(f, cx, y + 0.1, l * 0.5, 0.2, { colori: tipo.foglie, quante: Math.round(l * 45), dim: 0.11, seme, ink: 0.5 });
  sfumaV(f, x + 0.05, y - h - 0.3, l, 0.3, om(0), om(0.3));
  const box = rett(x, y - h, l, h);
  lava(f, box, tipo.cassetta, [x, y - h, l, h], { seme: seme + 1, macchie: 2, raggio: 0.5 });
  ink(f, box, 1.2, 0.8);
  for (let k = 0; k < 3; k++) {
    tralcio(f, x + 0.08 + r() * (l - 0.16), y - 0.04, tra(r, 0.25, 0.55),
      { seme: seme + 10 + k, foglie: tipo.foglie, fiori: tipo.pochi ? null : tipo.fiori, dim: 0.08 });
  }
  fiori(f, x + 0.03, y + 0.02, l - 0.06, 0.25, tipo.fiori, Math.round(l * (tipo.pochi ? 3 : 10)), seme + 3, 0.045);
}
/**
 * PORTA (appoggiata sul marciapiede). cx centro, l × a luce.
 * o: { legno, ante, gradini, lunetta, vetri, arco, cornice, seme }
 */
function porta(f, cx, l, a, o) {
  o = o || {};
  if (!vede(f, cx - l, cx + l)) return;
  const seme = o.seme || Math.round(cx * 77), r = casuale(seme), x = cx - l / 2, legno = o.legno || '#b0673f';
  const ng = o.gradini || 0, y0 = 0.08 + ng * 0.15;
  for (let i = 0; i < ng; i++) {                       // gradini di pietra (la faccia; il piano è sul marciapiede)
    const g = rett(x - 0.3 + i * 0.1, i * 0.15 + (i ? 0.08 : 0), l + 0.6 - i * 0.2, i ? 0.15 : 0.23);
    lava(f, g, '#e9e2d2', [x - 0.3, 0, l + 0.6, 0.5], { seme: seme + i, macchie: 1, raggio: 0.4, luce: false });
    sfumaV(f, x - 0.3, 0, l + 0.6, 0.12, om(0.25), om(0)); ink(f, g, 1.1, 0.8);
  }
  const R = l / 2, forma = (d, dy) => (o.arco ? arcata(x + d, y0 + (dy || 0), l - 2 * d, a - d) : rett(x + d, y0 + (dy || 0), l - 2 * d, a - d));
  lava(f, forma(-0.13), o.cornice || '#efe4cc', [x - 0.14, y0, l + 0.28, a + 0.15], { seme: seme + 3, macchie: 2, raggio: 0.6, bordo: 0.4 });
  ink(f, forma(-0.13), 1.2, 0.8);
  piatto(f, forma(0), scurisci(legno, 0.55));
  const n = o.ante || 2, la = l / n, ha = o.arco ? a - R : o.lunetta ? a - 0.42 : a, venature = new Path2D();
  for (let i = 0; i < n; i++) {
    const ax = x + i * la, fa = rett(ax + 0.015, y0, la - 0.03, ha - 0.02);
    lava(f, fa, legno, [ax, y0, la, ha], { seme: seme + 10 + i, macchie: 3, raggio: 0.7, segni: 4, bordo: 0.45 });
    for (let k = 0; k < 5; k++) { const vx = ax + tra(r, 0.05, la - 0.05); mano(f, r, [[vx, y0 + 0.05], [vx + tra(r, -0.02, 0.02), y0 + ha - 0.08]], false, 0.8, venature); }
    const basso = rett(ax + 0.09, y0 + 0.14, la - 0.21, ha * 0.36);
    piatto(f, basso, om(0.18)); ink(f, basso, 0.9, 0.65);
    const alto = rett(ax + 0.09, y0 + ha * 0.52, la - 0.21, ha * 0.4);
    if (o.vetri) {
      piatto(f, alto, '#8fb0c8'); sfumaV(f, ax + 0.09, y0 + ha * 0.52, la - 0.21, ha * 0.4, lu(0.4), om(0.3));
      piatto(f, Forme.poligono([[ax + 0.12, y0 + ha * 0.55], [ax + 0.2, y0 + ha * 0.55], [ax + la - 0.14, y0 + ha * 0.88], [ax + la - 0.22, y0 + ha * 0.88]]), lu(0.4));
    } else piatto(f, alto, om(0.15));
    ink(f, alto, 0.9, 0.65);
    piatto(f, cerchio(i === 0 && n === 2 ? ax + la - 0.08 : ax + 0.08, y0 + ha * 0.47, 0.035), '#e2b95c');
    ink(f, fa, 1.1, 0.8);
  }
  ink(f, venature, 0.6, 0.25);
  if (o.arco || o.lunetta) {                            // lunetta a vetri sopra le ante
    const yl = y0 + ha, lun = o.arco ? arcata(x + 0.05, yl, l - 0.1, a - ha - 0.05) : rett(x + 0.05, yl + 0.04, l - 0.1, a - ha - 0.09);
    piatto(f, lun, '#86a7c0'); piatto(f, lun, lu(0.25));
    const raggi = new Path2D();
    for (let k = 1; k < 5; k++) { const an = (k / 5) * Math.PI; raggi.moveTo(cx, yl + 0.02); raggi.lineTo(cx + Math.cos(an) * R, yl + 0.02 + Math.sin(an) * (a - ha)); }
    f.c.save(); f.c.clip(lun); ink(f, raggi, 1.4, 0.7, '#f4eee2'); f.c.restore();
    ink(f, lun, 1, 0.75);
  }
  sfumaV(f, x, y0 + a - 0.35, l, 0.35, om(0), om(0.35));    // ombra dell'architrave
  sfumaU(f, x, y0, 0.18, a, om(0.3), om(0));
}
/** Muro di mattoni dentro una forma: file sfalsate, malta chiara, luce dall'alto. */
function mattoni(f, forma, x, y, l, a, o) {
  const r = casuale(o.seme), c = f.c, h = o.alto || 0.085, w = o.lungo || 0.25;
  c.save(); c.clip(percorso(forma));
  c.fillStyle = o.malta; c.fillRect(x, y, l, a);
  const gruppi = o.colori.map(() => new Path2D()), giunti = new Path2D();
  for (let j = 0, yy = y; yy < y + a; j++, yy += h) {
    for (let xx = x - (j % 2) * (w / 2) - tra(r, 0, 0.03); xx < x + l; xx += w) {
      gruppi[Math.floor(r() * gruppi.length)].rect(xx + 0.012, yy + 0.011, w - 0.024, h - 0.022);
    }
    giunti.moveTo(x, yy); giunti.lineTo(x + l, yy);
  }
  gruppi.forEach((g, i) => {
    c.globalAlpha = 0.93; c.fillStyle = o.colori[i]; c.fill(g);
    c.globalAlpha = 0.4; c.strokeStyle = scurisci(o.colori[i], 0.4); c.lineWidth = 0.8 * f.px; c.stroke(g);
  });
  c.globalAlpha = 1;
  for (let k = 0; k < Math.round(l * a / 3) + 2; k++) {     // macchie di luce e d'ombra
    const cx = x + r() * l, cy = y + r() * a, rr = tra(r, 0.6, 1.6), g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
    const col = r() < 0.5 ? lu(0.22) : om(0.16);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  sfumaV(f, x, y, l, a, om(0.1), lu(0.2));
  c.restore();
  ink(f, giunti, 0.6, 0.15);
}
/** Lanterna da muro in ferro con il vetro chiaro. */
function lanterna(f, x, y) {
  const braccio = Forme.curva([[x, y], [x + 0.1, y + 0.12], [x + 0.22, y + 0.08]]);
  ink(f, braccio, 2.2, 0.9, '#3f3640');
  const corpo = Forme.poligono([[x + 0.13, y - 0.3], [x + 0.31, y - 0.3], [x + 0.35, y + 0.02], [x + 0.09, y + 0.02]]);
  piatto(f, corpo, '#f6e7b8'); piatto(f, rett(x + 0.07, y + 0.02, 0.3, 0.06), '#3f3640');
  ink(f, corpo, 1.4, 0.9, '#3f3640');
}
/** Ringhiera di ferro (balconi): montanti, corrimano e riccioli. */
function ringhiera(f, xa, xb, y, h) {
  const p = new Path2D(), ricci = new Path2D();
  p.moveTo(xa, y + h); p.lineTo(xb, y + h); p.moveTo(xa, y + 0.06); p.lineTo(xb, y + 0.06);
  for (let x = xa; x <= xb + 0.01; x += 0.12) { p.moveTo(x, y); p.lineTo(x, y + h); }
  for (let x = xa + 0.12; x < xb - 0.05; x += 0.24) { ricci.moveTo(x + 0.06 + 0.05, y + h * 0.55); ricci.arc(x + 0.06, y + h * 0.55, 0.05, 0, Math.PI * 2); }
  ink(f, p, 1.8, 0.85, '#45394a'); ink(f, ricci, 1.3, 0.75, '#45394a');
}
/** Vaso di terracotta con una pianta tonda (davanti alle porte, sui balconi). */
function vasoTondo(f, cx, y, l, seme, fioriti) {
  const vaso = Forme.poligono([[cx - l * 0.4, y], [cx + l * 0.4, y], [cx + l * 0.5, y + l * 0.7], [cx - l * 0.5, y + l * 0.7]]);
  cespo(f, cx, y + l * 1.25, l * 0.75, l * 0.65, { colori: FOGLIE, dim: l * 0.28, seme, ink: 0.5, quante: 50 });
  if (fioriti) fiori(f, cx - l * 0.6, y + l * 1.1, l * 1.2, l * 0.7, fioriti, 7, seme + 2, l * 0.1);
  lava(f, vaso, '#c9744f', [cx - l, y, 2 * l, l], { seme: seme + 1, macchie: 2, raggio: 0.4 });
  piatto(f, rett(cx - l * 0.52, y + l * 0.58, l * 1.04, l * 0.14), '#d98a62');
  ink(f, vaso, 1.1, 0.8);
}

/* ====================== 6. LE CASE DELLA FILA VICINA ====================== */
// Ogni casa: { da, a, cima (punto più alto), dipingi(f) }. Piano terra 0.08..3.2,
// primo piano 3.2..6.2, secondo 6.2..9.2 (circa).

function casaGialla(f) {
  const x0 = -10, x1 = 0, alto = 9.4, s = 101, sc = '#a3693f';
  const forma = parete(f, x0, x1, alto, '#f6d27c', s, { zoccolo: 0.62, coloreZoccolo: '#e5cfa0' });
  fascia(f, x0, x1, 3.2, 0.2, '#f6ead0');
  for (const cx of [-8.4, -2.1]) finestra(f, cx, 1.0, 1.1, 1.5, { persiane: sc, tende: '#fff6e8' });
  porta(f, -5.3, 1.25, 2.35, { legno: '#9a5a36', gradini: 1, lunetta: true });
  for (const cx of [-8.4, -5.3, -2.1]) {
    finestra(f, cx, 4.0, 1.0, 1.6, { persiane: sc, fioriera: cx === -5.3 ? FIORI.rossi : null });
    finestra(f, cx, 6.9, 0.95, 1.35, { persiane: sc, chiuse: cx === -8.4 });
  }
  pluviale(f, -0.3, 0.08, alto);
  tettoCoppi(f, x0, x1, alto, 1.0, '#d9754b', s + 5, true);
  camino(f, -3.6, alto + 0.6, 0.55, 1.05, '#ebc47c', s + 6);
  camino(f, -8.9, alto + 0.5, 0.45, 0.8, '#ebc47c', s + 7);
  finisci(f, x0, x1, forma);
}

function casaMattoni(f) {
  const x0 = 0, x1 = 4, alto = 8.3, s = 201, r = casuale(s);
  const forma = rettMano(f, r, x0, 0, x1 - x0, alto, 0.5);
  mattoni(f, forma, x0, 0, x1 - x0, alto, { seme: s, malta: '#e3c6ad', colori: ['#b5604a', '#a9553f', '#c06d55', '#9e4e3c', '#b86a52', '#c97a5e'] });
  const opz = { cornice: '#5d7a66', vetro: '#6c8ca6', pietra: '#e6dccb' };
  const piattabanda = (cx, y, l) => {                         // mattoni in piedi sopra la finestra
    const p = rett(cx - l / 2 - 0.12, y, l + 0.24, 0.24), giunti = new Path2D();
    for (let x = cx - l / 2 - 0.12; x < cx + l / 2 + 0.12; x += 0.09) { giunti.moveTo(x, y); giunti.lineTo(x, y + 0.24); }
    piatto(f, p, '#a24f3c'); ink(f, giunti, 0.7, 0.45); ink(f, p, 1, 0.7);
  };
  finestra(f, 1.05, 1.0, 0.85, 1.5, opz); piattabanda(1.05, 2.55, 0.85);
  porta(f, 2.95, 0.95, 2.15, { legno: '#4f6e5e', gradini: 1, cornice: '#d9cdb8' });
  for (const cx of [1.05, 2.95]) {
    finestra(f, cx, 4.0, 0.85, 1.6, { ...opz, fioriera: cx < 2 ? FIORI.rosa : null }); piattabanda(cx, 5.65, 0.85);
    finestra(f, cx, 6.6, 0.85, 1.3, opz); piattabanda(cx, 7.95, 0.85);
  }
  fascia(f, x0, x1, alto - 0.22, 0.22, '#dccfb9');
  camino(f, 3.0, alto, 0.5, 1.0, '#ad5c46', s + 6);
  finisci(f, x0, x1, forma);
}

function casaArancio(f) {
  const x0 = 4, x1 = 10, alto = 8.7, s = 301, crema = '#f1e2c2';
  const forma = parete(f, x0, x1, alto, '#f2884f', s, { zoccolo: 0.5, coloreZoccolo: '#e3d2b6' });
  // cantonali: blocchi di pietra chiara sullo spigolo destro (come nel film)
  const blocchi = new Path2D();
  for (let y = 0.5, k = 0; y < alto - 0.3; y += 0.36, k++) blocchi.rect(x1 - (k % 2 ? 0.28 : 0.42), y + 0.02, k % 2 ? 0.28 : 0.42, 0.32);
  piatto(f, blocchi, crema); piatto(f, blocchi, lu(0.2)); ink(f, blocchi, 1, 0.7);
  fascia(f, x0, x1, 3.05, 0.42, crema, true);
  finestra(f, 5.2, 0.95, 0.95, 1.5, { fioriera: FIORI.verde, tende: '#fff3e0' });
  porta(f, 7.3, 1.35, 2.4, { legno: '#b8673c', gradini: 1, vetri: true, cornice: crema });
  finestra(f, 9.05, 1.0, 0.8, 1.4, { fioriera: FIORI.verde });
  for (const cx of [5.2, 7.3, 9.05]) {
    finestra(f, cx, 4.15, 0.95, 1.6, { fioriera: cx === 7.3 ? FIORI.verde : FIORI.rossi, contorno: crema });
    finestra(f, cx, 6.75, 0.9, 1.3, { contorno: crema });
  }
  tettoCoppi(f, x0, x1, alto, 0.9, '#c96b45', s + 9, true);
  finisci(f, x0, x1, forma);
}

function muroGiardino(f) {
  const x0 = 10, x1 = 12.5, s = 401, r = casuale(s);
  // l'albero del giardino, dietro il muro
  chioma(f, 11.3, 4.75, 1.85, 1.45, s + 1, () => {
    ramo(f, [[11.35, 2.2], [11.4, 3.0], [11.25, 3.8]], 0.17, 0.09);
    ramo(f, [[11.38, 3.1], [11.0, 3.7], [10.4, 4.2]], 0.07, 0.03);
    ramo(f, [[11.38, 3.3], [11.8, 3.9], [12.3, 4.4]], 0.07, 0.03);
  });
  const muro = rettMano(f, r, x0, 0, x1 - x0, 2.4, 0.5);
  lava(f, muro, '#f8f4ea', [x0, 0, x1 - x0, 2.4], { seme: s + 2, raggio: 1, variazione: 0.22, bordo: 0.45 });
  piatto(f, rett(x1 - 0.38, 0, 0.38, 2.4), '#c4d3df', 0.55);           // il fianco in ombra azzurrina
  sfumaV(f, x0, 2.0, x1 - x0, 0.4, om(0), om(0.25));
  const coping = rett(x0 - 0.06, 2.4, x1 - x0 + 0.12, 0.1);
  piatto(f, coping, '#ebe6da'); ink(f, coping, 1, 0.75);
  // edera che scende dal muro: prima le ombre azzurre, poi le foglie
  const trali = [[10.15, 1.0], [10.45, 1.45], [10.75, 0.8], [11.0, 1.7], [11.3, 1.1], [11.6, 1.55], [11.9, 0.7], [12.15, 1.3], [12.4, 0.9]];
  const ombra = ['#a9bcd0', '#b2c4d6', '#bccbdb'];
  f.c.save(); f.c.translate(0.12, -0.15);                       // prima le ombre azzurre sul muro bianco
  for (const [x, lung] of trali) tralcio(f, x, 2.5, lung, { seme: Math.round(s + x * 10), foglie: ombra, dim: 0.2 });
  cespo(f, 11.25, 2.55, 1.35, 0.3, { colori: ombra, dim: 0.2, seme: s + 3, quante: 140 });
  f.c.restore();
  cespo(f, 11.25, 2.65, 1.4, 0.38, { colori: VERDI.medi, dim: 0.2, seme: s + 3, ink: 0.55, quante: 170 });
  for (const [x, lung] of trali) tralcio(f, x, 2.5, lung, { seme: Math.round(s + x * 10), foglie: VERDI.medi, dim: 0.2 });
  finisci(f, x0, x1, muro);
}

/** Vetrina del caffè: interno caldo con mensole, tazze, lampada e tavolini. */
function vetrina(f, x, y, l, a, seme) {
  const r = casuale(seme), c = f.c, vetro = rett(x, y, l, a);
  c.save(); c.clip(vetro);
  sfumaV(f, x, y, l, a, '#e7b98c', '#f8dfae');
  const mensole = new Path2D(), tazze = ['#e0605a', '#5ea3d6', '#f3d06a', '#7fbf7a', '#f6efe0'];
  for (const yy of [y + a * 0.62, y + a * 0.8]) {
    mensole.rect(x, yy, l, 0.03);
    for (let xx = x + 0.08; xx < x + l - 0.1; xx += tra(r, 0.1, 0.18)) piatto(f, rett(xx, yy + 0.03, 0.07, 0.08), scegli(r, tazze));
  }
  piatto(f, mensole, '#8a5a3c');
  const lampada = cerchio(x + l * 0.5, y + a * 0.5, 0.45), g = c.createRadialGradient(x + l * 0.5, y + a * 0.5, 0, x + l * 0.5, y + a * 0.5, 0.45);
  g.addColorStop(0, 'rgba(255,240,190,0.8)'); g.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = g; c.fill(lampada);
  for (const t of [0.3, 0.75]) {                             // tavolino tondo con due sedie
    const tx = x + l * t, ty = y + 0.42, p = new Path2D();
    p.moveTo(tx, ty); p.lineTo(tx, y + 0.02); p.moveTo(tx - 0.1, y + 0.02); p.lineTo(tx + 0.1, y + 0.02);
    for (const s of [-1, 1]) { p.moveTo(tx + s * 0.28, y); p.lineTo(tx + s * 0.28, ty + 0.2); p.lineTo(tx + s * 0.2, y + 0.3); p.lineTo(tx + s * 0.2, y); }
    ink(f, p, 1.6, 0.55, '#6b4636');
    piatto(f, ell(tx, ty, 0.2, 0.035), '#fbf3e4'); ink(f, ell(tx, ty, 0.2, 0.035), 1, 0.6);
  }
  c.globalAlpha = 0.25; c.fillStyle = '#ffffff';
  c.fill(Forme.poligono([[x + l * 0.1, y], [x + l * 0.3, y], [x + l * 0.3 + a * 0.6, y + a], [x + l * 0.1 + a * 0.6, y + a]]));
  c.globalAlpha = 1;
  sfumaV(f, x, y + a - 0.4, l, 0.4, om(0), om(0.35));
  c.restore();
  ink(f, vetro, 1.3, 0.85);
}
/** Tenda da sole a strisce con la balza smerlata e la scritta. */
function tenda(f, xa, xb, yTop, seme) {
  const yb = yTop - 0.55, hv = 0.34, n = 14, w = (xb - xa) / n, c = f.c;
  sfumaV(f, xa + 0.1, yb - hv - 1.0, xb - xa - 0.2, 1.0, om(0), om(0.4));
  const falda = Forme.poligono([[xa + 0.15, yTop], [xb - 0.15, yTop], [xb, yb], [xa, yb]]);
  lava(f, falda, '#e8676c', [xa, yb, xb - xa, yTop - yb], { seme, raggio: 1, bordo: 0.4 });
  const righe = new Path2D(), r = casuale(seme);
  const sopra = (t) => xa + 0.15 + (xb - xa - 0.3) * t, sotto = (t) => xa + (xb - xa) * t;
  for (let k = 0; k < n; k += 2) {
    const q = [[sopra(k / n), yTop], [sopra((k + 1) / n), yTop], [sotto((k + 1) / n), yb], [sotto(k / n), yb]];
    piatto(f, Forme.poligono(q), '#fbe4dc', 0.9);
    mano(f, r, [q[0], q[3]], false, 0.4, righe); mano(f, r, [q[1], q[2]], false, 0.4, righe);
  }
  ink(f, righe, 0.8, 0.45);
  c.save(); c.clip(falda); sfumaV(f, xa, yb, xb - xa, yTop - yb, om(0.15), lu(0.25)); c.restore();
  const balza = new Path2D();
  balza.moveTo(xa, yb); balza.lineTo(xb, yb); balza.lineTo(xb, yb - hv + w / 2);
  for (let k = n - 1; k >= 0; k--) balza.arc(xa + (k + 0.5) * w, yb - hv + w / 2, w / 2, 0, Math.PI, true);
  balza.closePath();
  lava(f, balza, '#df5a61', [xa, yb - hv, xb - xa, hv], { seme: seme + 1, raggio: 1, bordo: 0.45 });
  ink(f, balza, 1.3, 0.85); ink(f, falda, 1.3, 0.85);
  scritta(f, 'Caffè dei Colori', (xa + xb) / 2, yb - hv * 0.42, 0.24, '#fff4dc');
}

function caffe(f) {
  const x0 = 12.5, x1 = 18, alto = 6.6, s = 501, verde = '#4f8a62', r = casuale(s);
  const forma = parete(f, x0, x1, alto, '#f4dc98', s);
  for (const cx of [13.9, 16.6]) finestra(f, cx, 4.05, 0.95, 1.55, { persiane: '#5f9a76', fioriera: cx > 15 ? FIORI.rossi : null });
  // il fronte del negozio in legno verde
  const fronte = rett(x0, 0, x1 - x0, 3.2);
  lava(f, fronte, verde, [x0, 0, x1 - x0, 3.2], { seme: s + 1, raggio: 1.2, segni: 6 });
  piatto(f, rett(x0, 2.25, x1 - x0, 0.95), '#3f7754');
  vetrina(f, 12.82, 0.62, 1.95, 1.58, s + 2);
  vetrina(f, 16.15, 0.62, 1.55, 1.58, s + 3);
  // porta a vetri
  const pv = rett(14.98, 0.08, 0.95, 2.15);
  piatto(f, pv, '#3a6f50'); vetrina(f, 15.1, 0.7, 0.71, 1.4, s + 4);
  piatto(f, cerchio(15.8, 1.2, 0.035), '#e2b95c'); ink(f, pv, 1.2, 0.85);
  const pannelli = new Path2D();
  pannelli.rect(12.82, 0.16, 1.95, 0.36); pannelli.rect(16.15, 0.16, 1.55, 0.36);
  piatto(f, pannelli, om(0.2)); ink(f, pannelli, 1, 0.7);
  ink(f, fronte, 1.3, 0.85);
  tenda(f, 12.55, 17.95, 3.15, s + 5);
  // lavagnetta e due vasi
  const lav = Forme.poligono([[14.25, 0.08], [14.7, 0.08], [14.64, 0.82], [14.31, 0.82]]);
  piatto(f, lav, '#4a5250'); ink(f, lav, 2, 0.9, '#8a5a3c');
  const gesso = new Path2D();
  for (let k = 0; k < 4; k++) mano(f, r, [[14.36, 0.65 - k * 0.12], [14.36 + tra(r, 0.12, 0.24), 0.65 - k * 0.12]], false, 1.2, gesso);
  ink(f, gesso, 1.3, 0.8, '#f4f1e6');
  vasoTondo(f, 12.95, 0.08, 0.42, s + 7);
  vasoTondo(f, 17.6, 0.08, 0.42, s + 8);
  tettoArdesia(f, x0, x1, alto, 0.85, '#6f8e86', s + 6);
  camino(f, 16.9, alto + 0.45, 0.45, 0.8, '#e9cf8c', s + 9);
  finisci(f, x0, x1, forma);
}

function casaCrema(f) {
  const x0 = 18, x1 = 23, alto = 7.3, frontone = 2.1, s = 601, cx = 20.5, verde = '#7aa37c';
  const sagoma = Forme.poligono([[x0, 0], [x1, 0], [x1, alto], [cx, alto + frontone], [x0, alto]]);
  const forma = parete(f, x0, x1, alto, '#f4e5c2', s, { forma: sagoma, extra: frontone, zoccolo: 0.55, coloreZoccolo: '#e2d2ae' });
  fascia(f, x0, x1, 3.2, 0.18, '#fbf3df');
  porta(f, 19.3, 1.1, 2.3, { legno: '#6f8fa8', gradini: 1, lunetta: true });
  finestra(f, 21.7, 0.95, 1.05, 1.5, { grata: true, tende: '#fff6e8' });
  lanterna(f, 18.4, 2.35);
  finestra(f, 19.75, 3.6, 0.9, 2.1, { persiane: verde });
  finestra(f, 21.6, 3.6, 0.9, 2.1, { persiane: verde });
  // balcone: lastra, mensole, vasi di gerani, ringhiera
  sfumaV(f, 18.9, 2.85, 3.6, 0.45, om(0), om(0.35));
  const mensole = new Path2D();
  for (const mx of [19.1, 20.65, 22.2]) mensole.moveTo(mx, 3.3), mensole.lineTo(mx + 0.18, 3.3), mensole.lineTo(mx + 0.12, 3.05), mensole.lineTo(mx + 0.06, 3.05), mensole.closePath();
  piatto(f, mensole, '#e3d8c2'); ink(f, mensole, 1, 0.75);
  const lastra = rett(18.85, 3.3, 3.7, 0.16);
  piatto(f, lastra, '#ece2cd'); piatto(f, rett(18.85, 3.3, 3.7, 0.05), om(0.2)); ink(f, lastra, 1.1, 0.8);
  vasoTondo(f, 19.15, 3.46, 0.32, s + 3, ['#e84a5f', '#ff8fa3']);
  vasoTondo(f, 22.25, 3.46, 0.32, s + 4, ['#e84a5f', '#fff3f0']);
  ringhiera(f, 18.9, 22.5, 3.46, 0.92);
  // sotto il frontone: due finestrelle e un occhio tondo
  for (const wx of [19.4, 21.6]) finestra(f, wx, 6.2, 0.7, 0.85, { persiane: verde, chiuse: wx > 21 });
  const occhio = cerchio(cx, 8.15, 0.34);
  piatto(f, cerchio(cx, 8.15, 0.44), '#fbf3df'); ink(f, cerchio(cx, 8.15, 0.44), 1, 0.7);
  piatto(f, occhio, '#7397b6'); piatto(f, occhio, lu(0.25)); ink(f, occhio, 1.2, 0.8);
  // tegole lungo i due lati del frontone
  const falde = new Path2D();
  falde.moveTo(x0 - 0.25, alto - 0.12); falde.lineTo(cx, alto + frontone + 0.12); falde.lineTo(x1 + 0.25, alto - 0.12);
  sfumaV(f, x0, alto - 0.5, x1 - x0, 0.5, om(0), om(0.25));
  f.c.save(); f.c.lineJoin = 'miter'; f.c.strokeStyle = '#d4734b'; f.c.lineWidth = 0.22; f.c.stroke(falde);
  f.c.strokeStyle = om(0.25); f.c.lineWidth = 0.06; f.c.translate(0, -0.09); f.c.stroke(falde); f.c.restore();
  ink(f, falde, 1.4, 0.85);
  camino(f, 22.05, 7.95, 0.45, 1.1, '#efe0bd', s + 6);
  finisci(f, x0, x1, forma);
}

function casaSalvia(f) {
  const x0 = 23, x1 = 28, alto = 8.1, s = 701, chiaro = '#e7eed8';
  const forma = parete(f, x0, x1, alto, '#a9c59c', s, { zoccolo: 0.55, coloreZoccolo: '#92ad89' });
  fascia(f, x0, x1, 3.25, 0.2, chiaro);
  porta(f, 25.5, 1.2, 2.55, { arco: true, legno: '#5d7a86', gradini: 2, cornice: chiaro });
  for (const cx of [23.95, 27.05]) finestra(f, cx, 0.75, 0.95, 2.05, { arco: true, contorno: chiaro, tende: '#fff6e8' });
  for (const cx of [23.95, 25.5, 27.05]) {
    finestra(f, cx, 3.8, 0.9, 2.3, { arco: true, contorno: chiaro });
    ringhiera(f, cx - 0.5, cx + 0.5, 3.72, 0.5);
    finestra(f, cx, 6.45, 0.75, 0.9, { contorno: chiaro, fioriera: cx === 25.5 ? FIORI.rosa : null });
  }
  fascia(f, x0, x1, 7.72, 0.3, chiaro, true);
  pluviale(f, 27.82, 0.08, alto);
  tettoCoppi(f, x0, x1, alto, 0.75, '#cf6d48', s + 9, false);
  finisci(f, x0, x1, forma);
}

function casaRosa(f) {
  const x0 = 28, x1 = 33, alto = 8.9, s = 801, sc = '#5e9a72';
  const forma = parete(f, x0, x1, alto, '#f3b4a8', s, { zoccolo: 0.55, coloreZoccolo: '#e2a196' });
  fascia(f, x0, x1, 3.2, 0.18, '#fbe6dc');
  porta(f, 29.3, 1.05, 2.25, { legno: '#5d8a6a', vetri: true, ante: 1 });
  vasoTondo(f, 30.15, 0.08, 0.4, s + 2, ['#f6d66b', '#ffffff']);
  finestra(f, 31.6, 0.95, 1.1, 1.45, { persiane: sc, fioriera: FIORI.rosa });
  lanterna(f, 28.55, 2.35);
  for (const cx of [29.3, 31.6]) {
    finestra(f, cx, 4.0, 1.0, 1.55, { persiane: sc, fioriera: cx < 30 ? FIORI.rossi : null, tende: '#fff6e8' });
    finestra(f, cx, 6.75, 0.95, 1.3, { persiane: sc, chiuse: cx > 30 });
  }
  const targa = rett(30.35, 2.0, 0.24, 0.17);                 // numero civico
  piatto(f, targa, '#3d6fa8'); ink(f, targa, 1, 0.8); scritta(f, '12', 30.47, 2.085, 0.11, '#ffffff', 'bold');
  pluviale(f, 32.85, 0.08, alto, '#d7cfc6');
  tettoCoppi(f, x0, x1, alto, 0.95, '#d26a45', s + 9, true);
  camino(f, 28.7, alto + 0.55, 0.5, 0.95, '#f0c4b6', s + 6);
  finisci(f, x0, x1, forma);
}

function casaAzzurra(f) {
  const x0 = 33, x1 = 38, alto = 8.4, s = 901, r = casuale(s);
  const forma = parete(f, x0, x1, alto, '#a8c8e6', s);
  // zoccolo di piastrelle blu (come nel film)
  const pias = new Path2D();
  for (let x = x0; x < x1; x += 0.3) for (const y of [0.04, 0.29]) pias.rect(x + 0.01, y, 0.28, 0.24);
  piatto(f, rett(x0, 0, x1 - x0, 0.55), '#e6eef3');
  f.c.save(); f.c.clip(pias); lava(f, rett(x0, 0, x1 - x0, 0.55), '#6f9cc4', [x0, 0, x1 - x0, 0.55], { seme: s + 1, raggio: 0.5, macchie: 14, variazione: 0.45, luce: false }); f.c.restore();
  piatto(f, pias, lu(0.15)); ink(f, pias, 0.9, 0.6);
  finestra(f, 36.6, 1.5, 1.15, 1.3, { fioriera: FIORI.verde, cornice: '#f8f7f2' });
  // manifesto un po' sbiadito
  const man = rettMano(f, r, 34.9, 1.45, 0.62, 0.82, 0.6);
  piatto(f, man, '#f7efd4'); piatto(f, ell(35.21, 1.95, 0.18, 0.24), '#f0b6c3', 0.8);
  piatto(f, rett(34.98, 1.53, 0.46, 0.09), '#f3c46a', 0.8); ink(f, man, 1.1, 0.75);
  for (const cx of [34.75, 36.7]) {
    finestra(f, cx, 4.05, 1.0, 1.55, { tende: '#fff6e8' });
    finestra(f, cx, 6.6, 0.95, 1.25, {});
  }
  // grondaia bianca, pluviale e il rampicante di fiori arancio che scende
  const gr = rett(x0 - 0.1, alto - 0.18, x1 - x0 + 0.2, 0.14);
  piatto(f, gr, '#f3f4f1'); ink(f, gr, 1, 0.75);
  pluviale(f, 33.5, 0.08, alto - 0.1, '#f3f4f1');
  const lunghi = [4.6, 5.6, 3.2, 4.4, 2.4, 3.0, 1.8];
  f.c.save(); f.c.translate(0.12, -0.16);
  lunghi.forEach((lung, k) => tralcio(f, 33.25 + k * 0.27, alto - 0.3 - k * 0.12, lung, { seme: s + 20 + k, foglie: ['#7f9fc4', '#8aa9cc', '#94b1d1'], dim: 0.15 }));
  f.c.restore();
  lunghi.forEach((lung, k) => tralcio(f, 33.25 + k * 0.27, alto - 0.3 - k * 0.12, lung, { seme: s + 20 + k, foglie: FOGLIE, fiori: ['#f2703a', '#f7894a', '#e85a3a'], dim: 0.15, quantiFiori: 0.6 }));
  cespo(f, 33.9, alto - 0.35, 0.9, 0.3, { colori: VERDI.medi, dim: 0.15, seme: s + 7, ink: 0.5, quante: 70 });
  fiori(f, 33.2, alto - 0.6, 1.5, 0.5, ['#f2703a', '#ff9f3c'], 14, s + 8, 0.05);
  tettoArdesia(f, x0, x1, alto, 0.8, '#6d7f95', s + 9);
  finisci(f, x0, x1, forma);
}

/** I tre vasi dell'angolo: foglie larghe, lavanda, bonsai (in ombra, colori freddi). */
function vasiSera(f) {
  const c = f.c;
  // ombre morbide sul muro, verso sinistra
  c.save(); c.filter = 'blur(' + (0.08 * f.S).toFixed(1) + 'px)';
  for (const [x, l, a] of [[41.1, 0.7, 1.2], [42.2, 0.6, 0.9], [43.3, 0.8, 1.2]]) piatto(f, blob(casuale(x * 10), x - 0.2, a * 0.55, l * 0.6, a * 0.55, 9, 0.2), om(0.35));
  c.restore();
  // 1) foglie larghe e scure
  for (let k = 0; k < 11; k++) {
    const r = casuale(4100 + k), an = Math.PI / 2 + tra(r, -1.1, 1.1);
    foglia(f, 41.25 + tra(r, -0.08, 0.08), 0.5, an, tra(r, 0.38, 0.62), tra(r, 0.11, 0.16), mescola('#2b5a4c', '#5f8f72', r()), 0.75);
  }
  const v1 = Forme.poligono([[40.98, 0.08], [41.52, 0.08], [41.6, 0.55], [40.9, 0.55]]);
  lava(f, v1, '#6d625c', [40.8, 0, 0.9, 0.6], { seme: 4111, macchie: 2, raggio: 0.4, luce: false });
  piatto(f, rett(40.88, 0.47, 0.74, 0.09), '#7e726a'); ink(f, v1, 1.2, 0.85);
  // 2) lavanda: steli grigio-verdi e spighe viola
  const steli = new Path2D();
  for (let k = 0; k < 14; k++) {
    const r = casuale(4200 + k), bx = 42.35 + tra(r, -0.15, 0.15), tx = bx + tra(r, -0.28, 0.28), ty = 0.45 + tra(r, 0.35, 0.6);
    steli.moveTo(bx, 0.42); steli.quadraticCurveTo(bx, ty - 0.2, tx, ty);
    for (let j = 0; j < 6; j++) piatto(f, ell(tx + tra(r, -0.012, 0.012), ty - 0.02 + j * 0.035, 0.022, 0.03), mescola('#7e6cc0', '#b0a0e0', r()), 0.9);
    foglia(f, bx, 0.45, Math.PI / 2 + tra(r, -0.9, 0.9), tra(r, 0.2, 0.3), 0.025, '#7f9a84', 0.4);
  }
  ink(f, steli, 1.1, 0.7, '#5f7a62');
  const v2 = rett(42.12, 0.08, 0.48, 0.38);
  lava(f, v2, '#8a7464', [42, 0, 0.7, 0.5], { seme: 4211, macchie: 2, raggio: 0.4, luce: false });
  const assi = new Path2D(); assi.moveTo(42.12, 0.2); assi.lineTo(42.6, 0.2); assi.moveTo(42.12, 0.33); assi.lineTo(42.6, 0.33);
  ink(f, assi, 0.8, 0.5); ink(f, v2, 1.2, 0.85);
  // 3) bonsai: tronco contorto e "cuscini" di foglie piatti
  ramo(f, [[43.5, 0.45], [43.42, 0.65], [43.58, 0.85], [43.46, 1.05], [43.55, 1.25]], 0.07, 0.03, '#7b6250');
  ramo(f, [[43.5, 0.8], [43.3, 0.88], [43.12, 0.86]], 0.035, 0.015, '#7b6250');
  ramo(f, [[43.56, 0.98], [43.75, 1.05], [43.9, 1.02]], 0.03, 0.015, '#7b6250');
  for (const [x, y, rx] of [[43.1, 0.9, 0.2], [43.9, 1.06, 0.2], [43.55, 1.3, 0.24], [43.35, 1.12, 0.16], [43.72, 0.84, 0.13]]) {
    cespo(f, x, y, rx, rx * 0.42, { colori: ['#24504a', '#3c7462', '#77ac8c'], dim: 0.055, quante: 45, seme: Math.round(x * 100 + y * 10), ink: 0.5 });
  }
  const v3 = Forme.poligono([[43.3, 0.08], [43.72, 0.08], [43.8, 0.44], [43.22, 0.44]]);
  lava(f, v3, '#d9a94e', [43.2, 0, 0.62, 0.5], { seme: 4311, macchie: 2, raggio: 0.4, luce: false });
  piatto(f, Forme.poligono([[43.6, 0.08], [43.72, 0.08], [43.8, 0.44], [43.66, 0.44]]), 'rgba(255,214,170,0.6)'); // luce rosa sul fianco
  piatto(f, rett(43.18, 0.4, 0.66, 0.07), '#e3b862'); ink(f, v3, 1.2, 0.85);
}

function angoloSera(f) {
  const x0 = 38, x1 = 54, alto = 9.1, s = 1001, r = casuale(s), c = f.c;
  const forma = parete(f, x0, x1, alto, '#7491a3', s, { zoccolo: 0.45, coloreZoccolo: '#627d90' });
  sfumaV(f, x0, 0, x1 - x0, alto, om(0.3), 'rgba(205,222,236,0.22)');  // più scuro in basso, riflesso del cielo in alto
  for (const [x, y, rx, ry] of [[40.5, 7.5, 2.6, 1.6], [44.5, 5.2, 2.2, 1.4], [39.2, 1.0, 1.6, 1.0]]) {
    piatto(f, blob(r, x, y, rx, ry, 10, 0.3), '#4f6878', 0.16);       // grandi macchie d'ombra
  }
  // toppa di intonaco caduto: mattoni scoperti
  const toppa = blob(r, 39.35, 3.0, 0.9, 1.6, 22, 0.22, true);
  mattoni(f, toppa, 38.3, 1.2, 2.2, 3.7, { seme: s + 2, malta: '#a8a6b0', colori: ['#8e6a63', '#9b766d', '#7d5d5a', '#a88275'] });
  c.save(); c.translate(0.035, -0.035); ink(f, toppa, 3, 0.45, '#c9d4de'); c.restore();
  ink(f, toppa, 1.2, 0.8);
  // finestre con le persiane chiuse
  const opz = { chiuse: true, persiane: '#6b8b8e', cornice: '#a8b8c6', pietra: '#b4c0ca', vetro: '#4f6a80' };
  finestra(f, 42.4, 2.55, 1.05, 1.55, opz);
  for (const cx of [39.7, 42.4, 45.1]) finestra(f, cx, 5.6, 0.95, 1.4, { ...opz, persiane: '#5f7d84' });
  const crepe = new Path2D();
  mano(f, r, [[40.6, 6.2], [40.75, 5.7], [40.7, 5.3], [40.9, 4.9]], false, 1, crepe);
  mano(f, r, [[43.8, 2.3], [44.0, 1.95], [43.95, 1.6]], false, 1, crepe);
  ink(f, crepe, 0.9, 0.5);
  sfumaV(f, 42.0, 1.4, 0.8, 1.0, om(0), om(0.12));            // colatura sotto il davanzale
  // la luce rosata che arriva da oltre lo steccato
  const lucePath = Forme.poligono([[43.95, 0.05], [43.95, 1.85], [44.35, 2.15], [44.35, 3.35], [44.95, 3.62], [46.9, 3.95], [46.9, 0.05]]);
  c.save(); c.filter = 'blur(' + (0.06 * f.S).toFixed(1) + 'px)';
  const g = c.createRadialGradient(46.3, 1.2, 0.2, 46.3, 1.2, 3.2);
  g.addColorStop(0, '#fde3cb'); g.addColorStop(0.5, '#f6bfaa'); g.addColorStop(1, '#e8a9a8');
  c.globalAlpha = 0.93; c.fillStyle = g; c.fill(lucePath); c.restore();
  vasiSera(f);
  // edera che scende nell'angolo vicino allo steccato
  const edera = ['#2f5f48', '#4e8758', '#7fb36c'], steli = new Path2D();
  for (let k = 0; k < 4; k++) mano(f, r, [[46.55, 1.9], [46.35 - k * 0.12, 2.5 + k * 0.15], [46.3 - k * 0.2, 3.0 + k * 0.15]], false, 1.5, steli);
  ink(f, steli, 1.4, 0.7, '#5a6a40');
  for (const [x, y, rx, ry] of [[46.4, 2.05, 0.32, 0.3], [46.25, 2.6, 0.28, 0.25], [46.0, 3.2, 0.22, 0.2], [45.75, 3.65, 0.16, 0.15], [46.5, 1.5, 0.15, 0.3]]) {
    cespo(f, x, y, rx, ry, { colori: edera, dim: 0.13, seme: Math.round(s + x * 10 + y * 100), ink: 0.55, edera: true });
  }
  for (let k = 0; k < 4; k++) tralcio(f, 46.1 + k * 0.12, 2.3 - k * 0.1, 0.6 + k * 0.3, { seme: s + 30 + k, foglie: edera, dim: 0.12, edera: true });
  tettoArdesia(f, x0, x1, alto, 0.7, '#5c6e82', s + 9);
  finisci(f, x0, x1, forma);
  // oltre lo steccato non c'è (ancora) niente: il colore si dissolve nella carta
  if (f.u1 < STECCATO_X) return;
  const orlo = [[X1 + 5, -2]];                                       // un orlo ondulato, come un acquerello che finisce
  for (let y = -1; y <= 11; y += 0.25) orlo.push([STECCATO_X + 0.35 + Math.sin(y * 2.1) * 0.08 + tra(r, -0.06, 0.06), y]);
  orlo.push([STECCATO_X + 0.4, 13], [X1 + 5, 13]);
  c.save(); c.globalCompositeOperation = 'destination-out';
  c.filter = 'blur(' + (0.05 * f.S).toFixed(1) + 'px)';
  piatto(f, Forme.poligono(orlo, false), '#000');
  c.restore();
}

// (il muro del giardino è dipinto per primo: la sua chioma sta DIETRO le case vicine)
const CASE = [
  [9.3, 13.2, 6.8, muroGiardino], [-10, 0, 11.4, casaGialla], [0, 4, 9.8, casaMattoni], [4, 10, 9.8, casaArancio],
  [12.5, 18, 8.4, caffe], [18, 23, 9.6, casaCrema],
  [23, 28, 9.0, casaSalvia], [28, 33, 10.6, casaRosa], [33, 38, 9.4, casaAzzurra], [38, 54, 10.0, angoloSera],
];

/* ======================= 7. LA FILA DI FRONTE (lontana) ======================= */
// È dipinta con la coordinata s = 54 - x (normale 'z-': a sinistra nell'immagine c'è x = 54).
const FRONTE = [
  [5.4, 8.6, '#b4cfe6', 'coppi'], [4.6, 7.4, '#f3e7c8', 'ardesia'], [6.2, 9.2, '#f2bdb3', 'coppi'],
  [5.0, 8.0, '#bcd5b0', 'cornice'], [5.6, 8.8, '#f6dba0', 'coppi'], [4.8, 7.6, '#c9c4e4', 'ardesia'],
  [6.0, 8.4, '#f1e3c2', 'coppi'], [5.2, 8.2, '#a9cbe0', 'cornice'], [5.8, 8.8, '#f4c4b2', 'coppi'],
  [5.0, 7.8, '#c4dbb4', 'ardesia'], [5.6, 8.9, '#f2e5c4', 'coppi'], [5.2, 8.0, '#b7d0e8', 'cornice'],
  [5.0, 8.4, '#f3c9b8', 'coppi'],
];
function casaLontana(f, x0, x1, alto, col, tetto, seme) {
  const r = casuale(seme), forma = parete(f, x0, x1, alto, col, seme, { zoccolo: 0.5 });
  const n = Math.max(2, Math.floor((x1 - x0) / 1.7)), passo = (x1 - x0) / n, ip = Math.floor(r() * n);
  const persiane = r() < 0.65 ? scegli(r, ['#7aa37c', '#a3693f', '#6f93a8', '#c9785a']) : null;
  fascia(f, x0, x1, 3.2, 0.16, schiarisci(col, 0.5));
  for (let i = 0; i < n; i++) {
    const cx = x0 + passo * (i + 0.5);
    if (i === ip) porta(f, cx, 1.1, 2.25, { legno: scegli(r, ['#8a5a3c', '#5d7a86', '#6f8f6a']), lunetta: r() < 0.5, seme: seme + i });
    else finestra(f, cx, 1.0, 0.95, 1.45, { persiane, seme: seme + 10 + i });
    for (let p = 1; 3.2 * p + 2.3 < alto; p++) {
      finestra(f, cx, 3.2 * p + 0.85, 0.95, 1.45, { persiane, chiuse: r() < 0.15, fioriera: r() < 0.25 ? scegli(r, [FIORI.rossi, FIORI.rosa, FIORI.verde]) : null, seme: seme + 20 + i * 5 + p });
    }
  }
  if (tetto === 'coppi') tettoCoppi(f, x0, x1, alto, 0.9, '#d9805a', seme + 3, r() < 0.5);
  else if (tetto === 'ardesia') tettoArdesia(f, x0, x1, alto, 0.8, '#7f90a4', seme + 3);
  else fascia(f, x0, x1, alto - 0.3, 0.3, schiarisci(col, 0.55), true);
  if (r() < 0.6) camino(f, x0 + tra(r, 0.5, x1 - x0 - 1), alto + 0.4, 0.45, 0.8, schiarisci(col, 0.2), seme + 4);
  finisci(f, x0, x1, forma);
}
function dipingiFronte(f) {
  const r = casuale(909);
  let s = -0.8;
  for (const [l, alto, col, tetto] of FRONTE) {
    const seme = nuovoSeme(r);
    if (vede(f, s, s + l)) casaLontana(f, s, s + l, alto, col, tetto, seme);
    s += l;
  }
  // prospettiva aerea: un velo chiaro e azzurrino
  const c = f.c;
  c.save(); c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(226,236,246,0.22)'; c.fillRect(f.u0 - 1, -1, f.u1 - f.u0 + 2, 14);
  c.restore();
}

/* ============================ 8. A TERRA ============================ */

/** Lastre di pietra in file lungo x. file = [[z0, z1], ...] */
function lastre(f, file, colori, seme, tremolio) {
  file.forEach(([z0, z1], j) => {
    const r = casuale(seme + j * 31);
    let x = X0 - tra(r, 0, 0.8);
    while (x < X1 + 0.5) {
      const w = tra(r, 0.75, 1.3), col = scegli(r, colori), s = nuovoSeme(r);
      if (vede(f, x, x + w)) {
        const fo = rettMano(f, casuale(s), x + 0.008, z0 + 0.008, w - 0.016, z1 - z0 - 0.016, tremolio);
        lava(f, fo, col, [x, z0, w, z1 - z0], { seme: s, macchie: 2, raggio: 0.7, variazione: 0.3, bordo: 0.45, luce: false });
        ink(f, fo, 1, 0.5);
      }
      x += w;
    }
  });
}
/** Il marciapiede vicino (u = x, v = z). */
function dipingiMarciapiede(f) {
  const c = f.c, r = casuale(77);
  piatto(f, rett(f.u0, -1.8, f.u1 - f.u0, 2.8), '#c3cbd0');
  lastre(f, [[-1.8, -1.05], [-1.05, -0.3], [-0.3, 0.45]], ['#cfd6da', '#d6dbdc', '#c8d0d6', '#d9d8d2', '#cbd3d3', '#d3d6dd'], 300, 0.5);
  // la striscia tattile gialla con le barre in rilievo
  const tess = new Path2D(), barre = new Path2D(), ombre = new Path2D();
  for (let x = X0; x < X1; x += 0.4) {
    if (!vede(f, x, x + 0.4)) continue;
    tess.rect(x + 0.01, 0.46, 0.38, 0.38);
    for (let k = 0; k < 4; k++) {
      const z = 0.5 + k * 0.088;
      barre.addPath(Forme.rettangolo(x + 0.045, z, 0.31, 0.045, 0.02));
      ombre.addPath(Forme.rettangolo(x + 0.055, z + 0.014, 0.31, 0.045, 0.02));
    }
  }
  piatto(f, tess, '#f0d676');
  c.save(); c.clip(tess); lava(f, rett(f.u0, 0.45, f.u1 - f.u0, 0.4), '#efd270', [f.u0, 0.45, f.u1 - f.u0, 0.4], { seme: 5, raggio: 1, variazione: 0.35, luce: false, bordo: 0 }); c.restore();
  piatto(f, ombre, '#a9a46e', 0.55); piatto(f, barre, '#f8e8a6'); ink(f, barre, 0.8, 0.45); ink(f, tess, 1, 0.55);
  // il cordolo: pietre lunghe più chiare
  lastre(f, [[0.85, 1.0]], ['#e2e3dc', '#dcdfda', '#e7e6de'], 700, 0.4);
  ink(f, mano(f, r, [[f.u0, 0.995], [f.u1, 0.995]]), 1.2, 0.7);
  // ombra delle facciate e gradini delle porte
  sfumaV(f, f.u0, -1.8, f.u1 - f.u0, 0.55, om(0.3), om(0));
  for (const [cx, l] of GRADINI) {
    if (!vede(f, cx - l, cx + l)) continue;
    const g = rett(cx - l / 2 - 0.3, -1.8, l + 0.6, 0.28);
    sfumaV(f, cx - l / 2 - 0.25, -1.52, l + 0.6, 0.12, om(0.3), om(0));
    lava(f, g, '#ebe5d6', [cx - l / 2 - 0.3, -1.8, l + 0.6, 0.28], { seme: Math.round(cx * 10), macchie: 1, raggio: 0.4, luce: false });
    ink(f, g, 1.1, 0.8);
  }
  // griglia di scolo davanti alla casa azzurra
  if (vede(f, 33, 38)) {
    const gr = rett(33, -1.79, 5, 0.17), fessure = new Path2D();
    piatto(f, gr, '#7d6a60');
    for (let x = 33.06; x < 38; x += 0.09) fessure.rect(x, -1.76, 0.05, 0.11);
    piatto(f, fessure, '#4a3a38'); ink(f, gr, 1, 0.8);
  }
  // tombino, foglie cadute e le aiuole degli alberi
  if (vede(f, 19, 20)) {
    const t = cerchio(19.5, -0.65, 0.3), righe = new Path2D();
    piatto(f, t, '#9d9aa3'); for (let k = -2; k <= 2; k++) { righe.moveTo(19.3, -0.65 + k * 0.08); righe.lineTo(19.7, -0.65 + k * 0.08); }
    c.save(); c.clip(t); ink(f, righe, 1, 0.5); c.restore(); ink(f, t, 1.2, 0.8);
  }
  for (const xt of [7, 27]) {
    if (!vede(f, xt - 2, xt + 3)) continue;
    const rr = casuale(xt * 7);
    c.save(); c.filter = 'blur(' + (0.06 * f.S).toFixed(1) + 'px)';
    for (let k = 0; k < 9; k++) piatto(f, blob(rr, xt + tra(rr, -0.6, 1.8), tra(rr, -0.9, 0.7), tra(rr, 0.15, 0.45), tra(rr, 0.08, 0.2), 8, 0.3), om(0.16));
    c.restore();
    const aiuola = ell(xt, 0.9, 0.34, 0.1);
    piatto(f, aiuola, '#8a6e58'); ink(f, aiuola, 1.1, 0.75);
    for (let k = 0; k < 6; k++) foglia(f, xt + tra(rr, -1.5, 2.5), tra(rr, -1.5, 0.4), rr() * 6.3, 0.08, 0.035, scegli(rr, ['#9bc36f', '#d9b85a', '#c9884a']), 0.5);
  }
  // all'angolo della sera: luce più fredda e una pozza di luce rosata
  if (vede(f, 37, 47)) {
    sfumaU(f, 37.5, -1.8, 1.5, 2.8, om(0), om(0.14)); piatto(f, rett(39, -1.8, 9, 2.8), om(0.14));
    c.save(); c.filter = 'blur(' + (0.1 * f.S).toFixed(1) + 'px)';
    piatto(f, ell(45.9, -1.0, 1.1, 0.75), '#fbd2bc', 0.5); c.restore();
  }
  // oltre lo steccato: carta bianca, appena abbozzata
  if (vede(f, STECCATO_X, X1)) {
    sfumaU(f, STECCATO_X, -1.8, 1.2, 2.8, conAlfa(CARTA, 0), conAlfa(CARTA, 0.86));
    piatto(f, rett(STECCATO_X + 1.2, -1.8, X1, 2.8), CARTA, 0.86);
    const schizzo = new Path2D();
    for (const z of [-1.05, -0.3, 0.45, 0.85]) mano(f, r, [[STECCATO_X + 0.4, z], [X1 + 0.5, z]], false, 1.5, schizzo);
    for (let x = STECCATO_X + 0.6; x < X1; x += tra(r, 0.8, 1.2)) mano(f, r, [[x, -1.8], [x + tra(r, -0.05, 0.05), 0.45]], false, 1.5, schizzo);
    ink(f, schizzo, 1, 0.28);
  }
}
/** La strada: asfalto viola-grigio, cunetta, griglie, tombini e la linea tratteggiata. */
function dipingiStrada(f) {
  const c = f.c, r = casuale(55), L = f.u1 - f.u0;
  piatto(f, rett(f.u0, 1, L, 6.5), '#a39bb4');
  for (let k = 0; k < 90; k++) {                                   // macchie larghe di pigmento
    const x = X0 + r() * (X1 - X0), z = 1 + r() * 6.5, rr = tra(r, 1.2, 3.5), col = scegli(r, ['#b9b2c8', '#8f93ad', '#b19caa', '#8c84a2', '#c4bdd0']), al = tra(r, 0.25, 0.45);
    if (!vede(f, x - rr, x + rr)) continue;
    const g = c.createRadialGradient(x, z, 0, x, z, rr);
    g.addColorStop(0, conAlfa(col, al)); g.addColorStop(1, conAlfa(col, 0));
    c.fillStyle = g; c.fillRect(x - rr, z - rr, rr * 2, rr * 2);
  }
  for (let k = 0; k < 40; k++) {                                   // strisciate lungo la via (le ruote)
    const x = X0 + r() * (X1 - X0), z = scegli(r, [2.3, 2.6, 5.6, 6.0]) + tra(r, -0.2, 0.2);
    const e = ell(x, z, tra(r, 1.5, 4), tra(r, 0.05, 0.14)), col = scegli(r, ['#7f7896', '#c0b9cc']), al = tra(r, 0.1, 0.2);
    if (vede(f, x - 4, x + 4)) piatto(f, e, col, al);
  }
  // cunetta di pietra lungo il cordolo
  lastre(f, [[1.0, 1.3]], ['#bdbccb', '#c4c2cf', '#b7b6c6'], 900, 0.4);
  sfumaV(f, f.u0, 1.0, L, 0.1, om(0.3), om(0));
  lastre(f, [[7.22, 7.5]], ['#c4c2cf', '#bdbccb'], 950, 0.4);
  ink(f, mano(f, r, [[f.u0, 1.3], [f.u1, 1.3]]), 1, 0.5); ink(f, mano(f, r, [[f.u0, 7.22], [f.u1, 7.22]]), 1, 0.5);
  // griglie di scolo
  for (const x of [-6, 3.6, 13.1, 22.4, 31.6, 41.1, 50.2]) {
    if (!vede(f, x, x + 0.7)) continue;
    const gr = rett(x, 1.04, 0.66, 0.24), fes = new Path2D();
    piatto(f, gr, '#5f566c');
    for (let k = 0; k < 6; k++) fes.rect(x + 0.06 + k * 0.1, 1.08, 0.05, 0.16);
    piatto(f, fes, '#3c3446'); ink(f, gr, 1.1, 0.8);
  }
  // linea di mezzeria tratteggiata
  for (let x = X0 + 0.5; x < X1; x += 6) {
    if (!vede(f, x, x + 3)) continue;
    const d = rettMano(f, casuale(Math.round(x * 3 + 40)), x, 4.12, 3.0, 0.16, 1.2);
    lava(f, d, '#f6f2e8', [x, 4.1, 3, 0.2], { seme: Math.round(x * 5 + 100), macchie: 2, raggio: 0.6, variazione: 0.2, bordo: 0.3, luce: false, alfa: 0.92 });
  }
  for (const [x, z] of [[17.2, 2.7], [39.5, 5.9], [-3, 6.0]]) {          // tombini rotondi
    if (!vede(f, x - 0.4, x + 0.4)) continue;
    const t = cerchio(x, z, 0.32), anello = cerchio(x, z, 0.24);
    piatto(f, t, '#8a8299'); ink(f, t, 1.2, 0.75); ink(f, anello, 0.9, 0.5);
  }
  const crepe = new Path2D();
  for (let k = 0; k < 30; k++) { const x = X0 + r() * (X1 - X0), z = tra(r, 1.5, 7); mano(f, r, [[x, z], [x + tra(r, 0.2, 0.6), z + tra(r, -0.15, 0.15)], [x + tra(r, 0.5, 1), z + tra(r, -0.2, 0.2)]], false, 1, crepe); }
  ink(f, crepe, 0.8, 0.3);
}
/** Faccia verticale del cordolo (pietra chiara a blocchi). Funziona sia vicino sia di fronte. */
function dipingiCordolo(f, seme, oltreCarta) {
  const r = casuale(seme), giunti = new Path2D();
  lava(f, rett(f.u0, 0, f.u1 - f.u0, 0.08), '#dcdcd4', [f.u0, 0, f.u1 - f.u0, 0.08], { seme, raggio: 1.5, variazione: 0.35, luce: false, bordo: 0 });
  sfumaV(f, f.u0, 0, f.u1 - f.u0, 0.08, om(0.3), lu(0.2));
  for (let x = X0 - 2; x < X1 + 12; x += tra(r, 1.0, 2.2)) { giunti.moveTo(x, 0); giunti.lineTo(x, 0.08); }
  ink(f, giunti, 1, 0.6);
  ink(f, mano(f, r, [[f.u0, 0.078], [f.u1, 0.078]]), 1.2, 0.7);
  if (oltreCarta && vede(f, STECCATO_X, X1)) {
    sfumaU(f, STECCATO_X, 0, 0.7, 0.08, conAlfa(CARTA, 0), conAlfa(CARTA, 0.9));
    piatto(f, rett(STECCATO_X + 0.7, 0, X1, 0.08), CARTA, 0.9);
  }
}
/** Il marciapiede di fronte (z da 7.5 a 9.3), più semplice. */
function dipingiMarciapiedeFronte(f) {
  piatto(f, rett(f.u0, 7.5, f.u1 - f.u0, 1.8), '#cbd2d6');
  lastre(f, [[7.5, 7.66]], ['#e2e3dc', '#dcdfda'], 1300, 0.4);
  lastre(f, [[7.66, 8.5], [8.5, 9.3]], ['#d3d9dc', '#dadede', '#ccd3d8', '#dcdbd5'], 1200, 0.5);
  sfumaV(f, f.u0, 8.75, f.u1 - f.u0, 0.55, om(0), om(0.25));
}

/* ======================= 9. STECCATO E ALBERI ======================= */

/** Lo steccato ocra con il buco in basso (u = z da -1.8 a 1.2, v = y). */
function dipingiSteccato(f) {
  const r = casuale(4601), c = f.c, assi = [];
  for (let u = -1.8; u < 1.2 - 0.02;) { const w = Math.min(tra(r, 0.16, 0.21), 1.2 - u); assi.push([u, w]); u += w; }
  piatto(f, rett(-1.8, 0, 3, 1.9), '#4a3324');                         // il buio tra le assi
  const legni = ['#e6b95a', '#d79d3f', '#e2ad4c', '#cf9536', '#e8c068'], venature = new Path2D(), chiodi = new Path2D();
  for (const [u, w] of assi) {
    const cima = tra(r, 1.9, 2.04), punta = cima + tra(r, 0, 0.08);
    const asse = mano(f, r, [[u + 0.006, 0], [u + w - 0.006, 0], [u + w - 0.006, cima - tra(r, 0, 0.05)], [u + w * tra(r, 0.35, 0.65), punta], [u + 0.006, cima - tra(r, 0, 0.05)]], true, 0.6);
    lava(f, asse, scegli(r, legni), [u, 0, w, 2.1], { seme: nuovoSeme(r), raggio: 0.6, variazione: 0.35, segni: 3, bordo: 0.6 });
    for (let k = 0; k < 4; k++) { const vx = u + tra(r, 0.03, w - 0.03); mano(f, r, [[vx, tra(r, 0.05, 0.6)], [vx + tra(r, -0.02, 0.02), tra(r, 0.9, 1.9)]], false, 1, venature); }
    if (r() < 0.4) piatto(f, ell(u + w / 2, tra(r, 0.6, 1.6), 0.025, 0.05), '#8a5a2c', 0.7);
    for (const y of [0.35, 1.62]) chiodi.addPath(cerchio(u + w / 2, y, 0.012));
    ink(f, asse, 1.2, 0.8);
  }
  ink(f, venature, 0.7, 0.3); piatto(f, chiodi, '#4a3a38');
  sfumaV(f, -1.8, 0, 3, 0.45, om(0.4), om(0));                          // ombra a terra
  sfumaU(f, -1.8, 0, 0.6, 2.1, om(0.4), om(0));                         // ombra dell'angolo col muro
  c.save(); c.globalCompositeOperation = 'source-atop';                  // luce calda della sera
  sfumaV(f, -1.8, 0, 3, 2.1, 'rgba(255,190,140,0)', 'rgba(255,214,150,0.25)'); c.restore();
  // il buco: scuro, con le assi spezzate intorno
  const bordo = [[-0.37, 0], [-0.35, 0.22]];
  for (let k = 0; k <= 12; k++) {                                       // denti delle assi spezzate
    const t = k / 12, h = 0.33 + Math.sin(t * Math.PI) * 0.2;
    bordo.push([-0.33 + t * 0.66, h + (k % 2 ? tra(r, 0.03, 0.08) : -tra(r, 0.02, 0.07))]);
  }
  bordo.push([0.35, 0.18], [0.36, 0]);
  const buco = Forme.poligono(bordo);
  c.save(); c.translate(0.02, 0.035); piatto(f, buco, '#f5dfa8'); c.restore(); // schegge chiare di legno vivo
  c.save(); c.translate(-0.02, 0.02); piatto(f, buco, '#f0d090', 0.8); c.restore();
  piatto(f, buco, '#2a1f2c');
  c.save(); c.clip(buco); sfumaV(f, -0.4, 0, 0.8, 0.6, 'rgba(80,60,80,0.6)', 'rgba(20,14,24,0)'); c.restore();
  ink(f, buco, 1.5, 0.9);
  // edera sopra lo steccato, più folta verso il muro
  const verdi = ['#2f5f48', '#4e8758', '#86b86f'];
  for (const [u, rx, ry] of [[-1.6, 0.42, 0.3], [-1.15, 0.38, 0.24], [-0.72, 0.3, 0.18], [-0.2, 0.22, 0.12], [0.45, 0.25, 0.13], [0.95, 0.2, 0.1]]) {
    cespo(f, u, 2.0, rx, ry, { colori: verdi, dim: 0.11, seme: Math.round(u * 100 + 900), ink: 0.55, edera: true, quante: Math.round(rx * 220) });
  }
  for (const [u, l] of [[-1.7, 0.9], [-1.45, 0.6], [-1.0, 0.5], [-0.55, 0.3], [0.55, 0.35]]) tralcio(f, u, 1.95, l, { seme: Math.round(u * 100 + 950), foglie: verdi, dim: 0.1, edera: true });
}

/** Un albero del viale: tronco snello, chioma folta (x mondo, y mondo). */
function dipingiAlbero(f, xt, seme) {
  const r = casuale(seme), lean = tra(r, -0.12, 0.12);
  chioma(f, xt + 0.05, 3.75, 1.95, 1.55, seme + 1, () => {
    ramo(f, [[xt, 0.08], [xt + 0.04, 0.8], [xt - 0.02, 1.6], [xt + 0.03 + lean * 0.5, 2.4], [xt + lean, 3.0]], 0.2, 0.1);
    ramo(f, [[xt + 0.02, 2.0], [xt - 0.4, 2.6], [xt - 1.1, 3.3], [xt - 1.4, 3.6]], 0.09, 0.03);
    ramo(f, [[xt + 0.03, 2.25], [xt + 0.5, 2.85], [xt + 1.15, 3.5], [xt + 1.45, 3.7]], 0.085, 0.03);
    ramo(f, [[xt + lean, 2.9], [xt - 0.1, 3.6], [xt - 0.35, 4.5]], 0.075, 0.025);
    ramo(f, [[xt + lean, 3.0], [xt + 0.3, 3.7], [xt + 0.5, 4.7]], 0.065, 0.025);
  });
  ramo(f, [[xt, 0.08], [xt + 0.04, 0.8], [xt - 0.02, 1.6], [xt + 0.03, 2.25]], 0.2, 0.13);   // il fusto resta davanti
}

/* ============================ 10. LA SCENA ============================ */

/**
 * Dipinge una striscia lunga tagliandola in pezzi da al massimo 2048 pixel.
 *   d: { nome, da, a, S, v0, alto, giu, Sv, dipingi(f), grana, strato(u, l) → campi dello strato }
 */
async function striscia(strati, d) {
  const tutti = pezzi(d.da, d.a, d.S);
  for (const [k, [u, l]] of tutti.entries()) {
    const alto = typeof d.alto === 'function' ? d.alto(u, l) : d.alto;
    const f = foglio(u, d.v0, l, alto, d.S, d.giu, d.Sv);
    d.dipingi(f);
    if (d.grana) granula(f, d.grana);
    const nome = tutti.length > 1 ? d.nome + '_' + (k + 1) : d.nome;
    strati.push({ nome, tela: f.tela, larghezza: l, ...d.strato(u, l, alto) });
    await respira();
  }
}

/** Dipinge la scena richiesta e restituisce i suoi strati. */
export async function dipingiScena(nome) {
  if (nome !== 'via') return { strati: [] };
  const strati = [];
  const vicine = (u, l) => CASE.filter(([a, b]) => b > u - 0.6 && a < u + l + 0.6);
  // 1) la fila di case vicina (ogni pezzo è alto quanto la casa più alta che contiene)
  await striscia(strati, {
    nome: 'facciate', da: X0, a: X1, S: RIS.facciate, v0: 0, grana: 1,
    alto: (u, l) => Math.ceil(Math.max(...vicine(u, l).map((q) => q[2])) * 4) / 4,
    dipingi: (f) => vicine(f.u0, f.u1 - f.u0).forEach((q) => q[3](f)),
    strato: (u, l, alto) => ({ normale: 'z+', x: u, y: 0, z: -1.8, altezza: alto, ordine: 2 }),
  });
  // 2) lo steccato (u = z)
  await striscia(strati, {
    nome: 'steccato', da: -1.8, a: 1.2, S: RIS.steccato, v0: 0, alto: 2.45, grana: 1, dipingi: dipingiSteccato,
    strato: () => ({ normale: 'x-', x: STECCATO_X, y: 0, z: -1.8, altezza: 2.45, ordine: 3 }),
  });
  // 3) marciapiede e cordolo
  await striscia(strati, {
    nome: 'marciapiede', da: X0, a: X1, S: RIS.marciapiede, v0: -1.8, alto: 2.8, giu: true, grana: 0.9, dipingi: dipingiMarciapiede,
    strato: (u) => ({ normale: 'su', x: u, y: 0.08, z: -1.8, profondita: 2.8, ordine: 1 }),
  });
  await striscia(strati, {
    nome: 'cordolo', da: X0, a: X1, S: RIS.cordolo, Sv: 200, v0: 0, alto: 0.08, dipingi: (f) => dipingiCordolo(f, 61, true),
    strato: (u) => ({ normale: 'z+', x: u, y: 0, z: 1.0, altezza: 0.08, ordine: 1 }),
  });
  // 4) la strada
  await striscia(strati, {
    nome: 'strada', da: X0, a: X1, S: RIS.strada, v0: 1.0, alto: 6.5, giu: true, grana: 1.2, dipingi: dipingiStrada,
    strato: (u) => ({ normale: 'su', x: u, y: 0, z: 1.0, profondita: 6.5, ordine: 0 }),
  });
  // 5) il lato di fronte. Le facce 'z-' si dipingono con s = 54 - x (a sinistra c'è x = 54)
  await striscia(strati, {
    nome: 'cordolo_fronte', da: 0, a: X1 - X0, S: RIS.cordoloFronte, Sv: 120, v0: 0, alto: 0.08, dipingi: (f) => dipingiCordolo(f, 62, false),
    strato: (s, l) => ({ normale: 'z-', x: X1 - s - l, y: 0, z: 7.5, altezza: 0.08, ordine: 1 }),
  });
  await striscia(strati, {
    nome: 'marciapiede_fronte', da: X0, a: X1, S: RIS.lontano, v0: 7.5, alto: 1.8, giu: true, grana: 0.8, dipingi: dipingiMarciapiedeFronte,
    strato: (u) => ({ normale: 'su', x: u, y: 0.08, z: 7.5, profondita: 1.8, ordine: 1 }),
  });
  await striscia(strati, {
    nome: 'facciate_fronte', da: 0, a: X1 - X0, S: RIS.lontano, v0: 0, alto: 10, grana: 0.8, dipingi: dipingiFronte,
    strato: (s, l) => ({ normale: 'z-', x: X1 - s - l, y: 0, z: 9.3, altezza: 10, ordine: 2 }),
  });
  // 6) i due alberi del viale (ognuno è il suo strato, trasparente intorno)
  for (const [k, xt] of [7, 27].entries()) {
    await striscia(strati, {
      nome: 'albero_' + (k + 1), da: xt - 2.5, a: xt + 2.5, S: RIS.albero, v0: 0, alto: 5.8, grana: 0.7,
      dipingi: (f) => dipingiAlbero(f, xt, 7001 + k),
      strato: (u) => ({ normale: 'z+', x: u, y: 0, z: 0.9, altezza: 5.8, ordine: 4, tremola: 0.5 }),
    });
  }
  return { strati };
}
