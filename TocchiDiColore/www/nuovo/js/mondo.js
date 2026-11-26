/* ==========================================================================
 *  mondo.js — LA VIA (modellata dal codice, pezzo per pezzo)
 *  --------------------------------------------------------------------------
 *  Una strada lunga circa 50 metri:
 *    - a NORD (z negativo) le case colorate, una attaccata all'altra:
 *      finestre vere (incassate nel muro) con cornici, persiane, davanzali,
 *      fioriere, balconi, porte, un forno e un fioraio, grondaie, tetti di
 *      tegole, comignoli, mattoni scoperti e rampicanti;
 *    - il MARCIAPIEDE di pietra con la striscia gialla tattile (Lia la segue
 *      col bastone), il cordolo, la strada con le strisce pedonali;
 *    - a SUD (z positivo) un altro marciapiede, un muretto con la ringhiera,
 *      un giardino con siepi e alberi, la panchina;
 *    - lontano: tetti della città, il campanile, le colline, le nuvole.
 *
 *  Misure: 1 unità = 1 metro. x corre lungo la strada, y è l'altezza,
 *  z va dalle case (negativo) verso il giardino (positivo).
 *
 *  Tutto finisce in POCHE geometrie grandi (vedi geometria.js): il telefono
 *  le disegna in pochissimi "draw call".
 *  Il mondo prepara anche i "SENSORI" (scatole e sfere invisibili) che
 *  servono a capire che cosa ha toccato il bambino e di che materiale è
 *  (per il suono giusto: legno, vetro, pietra...).
 * ========================================================================== */
import * as THREE from 'three';
import { Costruttore, TIPI, matrice, prisma } from './geometria.js';
import { materialePigmento, materialeOmbra } from './acquerello3d.js';
import { generatore, clamp, lerp, rumore3 } from './utili.js';

export const ZF = -3.2;          // la linea delle facciate
const S = 0.28;                   // spessore del "guscio" della facciata (profondità delle finestre)
export const MARCIAPIEDE = 0.14;  // altezza del marciapiede

/* ------------------------------------------------------------------------ */
/*  LA TAVOLOZZA (colori pastello, come nel film)                            */
/* ------------------------------------------------------------------------ */
export const C = {
  rosa: [0.97, 0.76, 0.74], rosaChiaro: [0.99, 0.85, 0.81], azzurro: [0.67, 0.81, 0.91], celeste: [0.77, 0.89, 0.93],
  giallo: [0.99, 0.88, 0.58], burro: [0.99, 0.93, 0.71], menta: [0.68, 0.88, 0.78], salvia: [0.76, 0.85, 0.70],
  pesca: [0.99, 0.80, 0.64], lilla: [0.83, 0.78, 0.92], crema: [0.97, 0.93, 0.83],
  terracotta: [0.88, 0.56, 0.43], mattone: [0.86, 0.52, 0.40], tegola: [0.87, 0.51, 0.39], tegola2: [0.80, 0.46, 0.37],
  cornice: [0.99, 0.975, 0.93], davanzale: [0.93, 0.91, 0.87],
  persiane: [[0.42, 0.66, 0.52], [0.55, 0.72, 0.58], [0.37, 0.61, 0.65], [0.48, 0.60, 0.78]],
  vetro: [0.62, 0.76, 0.86], telaio: [0.97, 0.96, 0.92],
  pietra: [0.81, 0.81, 0.80], pietraBlu: [0.72, 0.78, 0.84], pietraCalda: [0.87, 0.84, 0.78],
  marciapiede: [0.85, 0.84, 0.82], tattile: [0.99, 0.82, 0.32], strada: [0.77, 0.75, 0.79], strisce: [0.98, 0.97, 0.94], cordolo: [0.91, 0.90, 0.87],
  ferro: [0.30, 0.38, 0.38], metallo: [0.86, 0.87, 0.88], grondaia: [0.93, 0.93, 0.92], lampione: [0.44, 0.58, 0.55],
  legno: [0.68, 0.49, 0.36], legnoChiaro: [0.84, 0.67, 0.50],
  porte: [[0.40, 0.63, 0.63], [0.60, 0.43, 0.35], [0.41, 0.57, 0.45], [0.51, 0.59, 0.80], [0.84, 0.50, 0.44]],
  foglie: [[0.58, 0.78, 0.45], [0.47, 0.71, 0.47], [0.67, 0.81, 0.47], [0.44, 0.65, 0.52], [0.53, 0.74, 0.40]],
  fiori: [[0.96, 0.42, 0.46], [0.99, 0.66, 0.78], [1.0, 0.98, 0.94], [0.99, 0.83, 0.37], [0.79, 0.63, 0.93], [0.99, 0.58, 0.40]],
  erba: [0.71, 0.84, 0.53], prato: [0.78, 0.86, 0.60], terra: [0.74, 0.60, 0.48], tronco: [0.60, 0.50, 0.42],
  pane: [0.92, 0.68, 0.40], paneScuro: [0.80, 0.52, 0.30], tenda: [0.98, 0.72, 0.74],
  colline: [[0.72, 0.84, 0.66], [0.66, 0.80, 0.70], [0.78, 0.86, 0.68], [0.62, 0.76, 0.74]],
};
const mescola = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const per = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/* ------------------------------------------------------------------------ */
/*  I SENSORI (per capire cosa tocca il bambino)                             */
/* ------------------------------------------------------------------------ */
class Sensori {
  constructor() { this.lista = []; }
  scatola(x0, y0, z0, x1, y1, z1, mat, cosa, extra) {
    this.lista.push({ tipo: 'scatola', min: new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)), mat, cosa, extra });
  }
  sfera(x, y, z, r, mat, cosa, extra) { this.lista.push({ tipo: 'sfera', c: new THREE.Vector3(x, y, z), r, mat, cosa, extra }); }
  /** Il raggio (dal dito, dentro lo schermo) cosa colpisce per primo? */
  colpisci(raggio, distMax = 180) {
    let meglio = null, tMin = distMax;
    const o = raggio.origin, d = raggio.direction;
    for (const s of this.lista) {
      if (s.tipo === 'scatola') {
        let t0 = -Infinity, t1 = Infinity, asse = 0, segno = 1;
        for (let a = 0; a < 3; a++) {
          const oa = a === 0 ? o.x : a === 1 ? o.y : o.z, da = a === 0 ? d.x : a === 1 ? d.y : d.z;
          const mn = a === 0 ? s.min.x : a === 1 ? s.min.y : s.min.z, mx = a === 0 ? s.max.x : a === 1 ? s.max.y : s.max.z;
          if (Math.abs(da) < 1e-9) { if (oa < mn || oa > mx) { t0 = Infinity; break; } continue; }
          let ta = (mn - oa) / da, tb = (mx - oa) / da, sg = -1;
          if (ta > tb) { const k = ta; ta = tb; tb = k; sg = 1; }
          if (ta > t0) { t0 = ta; asse = a; segno = sg; }
          if (tb < t1) t1 = tb;
        }
        if (t0 <= t1 && t0 > 0.05 && t0 < tMin) {
          tMin = t0;
          const n = new THREE.Vector3(); n.setComponent(asse, segno);
          meglio = { s, t: t0, normale: n };
        }
      } else {
        const oc = new THREE.Vector3().subVectors(o, s.c), b = oc.dot(d), c = oc.lengthSq() - s.r * s.r, h = b * b - c;
        if (h < 0) continue;
        const t = -b - Math.sqrt(h);
        if (t > 0.05 && t < tMin) { tMin = t; meglio = { s, t, normale: null }; }
      }
    }
    if (!meglio) return null;
    const punto = new THREE.Vector3().copy(d).multiplyScalar(meglio.t).add(o);
    const normale = meglio.normale || new THREE.Vector3().subVectors(punto, meglio.s.c).normalize();
    return { punto, normale, mat: meglio.s.mat, cosa: meglio.s.cosa, extra: meglio.s.extra, distanza: meglio.t };
  }
}

/* ------------------------------------------------------------------------ */
/*  Pezzi ricorrenti                                                         */
/* ------------------------------------------------------------------------ */
/** Ruota un punto (lx, lz) attorno all'asse verticale di un angolo a. */
const ruota = (lx, lz, a) => [lx * Math.cos(a) + lz * Math.sin(a), -lx * Math.sin(a) + lz * Math.cos(a)];

/** Un muro (da x0 a x1, da y0 a y1) con dei BUCHI rettangolari (finestre, porte). */
function muroConBuchi(B, x0, x1, y0, y1, zDietro, zDavanti, buchi, colore, tipo = 0) {
  const X = [...new Set([x0, x1, ...buchi.flatMap((b) => [clamp(b.x0, x0, x1), clamp(b.x1, x0, x1)])])].sort((a, b) => a - b);
  const Y = [...new Set([y0, y1, ...buchi.flatMap((b) => [clamp(b.y0, y0, y1), clamp(b.y1, y0, y1)])])].sort((a, b) => a - b);
  const pieno = (cx, cy) => !buchi.some((b) => cx > b.x0 && cx < b.x1 && cy > b.y0 && cy < b.y1);
  const righe = [];
  for (let j = 0; j < Y.length - 1; j++) {
    const cy = (Y[j] + Y[j + 1]) / 2;
    let i = 0;
    while (i < X.length - 1) {
      if (!pieno((X[i] + X[i + 1]) / 2, cy)) { i++; continue; }
      let k = i;
      while (k < X.length - 1 && pieno((X[k] + X[k + 1]) / 2, cy)) k++;
      righe.push({ x0: X[i], x1: X[k], y0: Y[j], y1: Y[j + 1] });
      i = k;
    }
  }
  // unisce in verticale i pezzi uguali (meno scatole = meno lavoro)
  const fusi = [];
  for (const r of righe) {
    const sopra = fusi.find((f) => f.x0 === r.x0 && f.x1 === r.x1 && Math.abs(f.y1 - r.y0) < 1e-6);
    if (sopra) sopra.y1 = r.y1; else fusi.push({ ...r });
  }
  const d = zDavanti - zDietro;
  for (const f of fusi) B.scatola((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, zDietro + d / 2, f.x1 - f.x0, f.y1 - f.y0, d, colore, { tipo });
}

/** Una persiana (con le stecche): cardine in (hx, y0, hz), larga w, alta h, aperta di "angolo". */
function persiana(B, hx, y0, hz, w, h, colore, angolo, lato) {
  // lato = -1: la persiana si apre verso sinistra (pannello a x negativi del cardine)
  const pezzo = (lx, ly, lz, sw, sh, sd, rotX = 0) => {
    const [rx, rz] = ruota(lx * lato, lz, angolo * lato);
    B.scatola(hx + rx, y0 + ly, hz + rz, sw, sh, sd, colore, { rot: [rotX, angolo * lato, 0] });
  };
  const t = 0.05;
  pezzo(-t / 2, h / 2, 0, t, h, 0.045);              // montante sul cardine
  pezzo(-w + t / 2, h / 2, 0, t, h, 0.045);          // montante esterno
  pezzo(-w / 2, t / 2, 0, w, t, 0.045);              // traverso basso
  pezzo(-w / 2, h - t / 2, 0, w, t, 0.045);          // traverso alto
  pezzo(-w / 2, h * 0.5, 0, w - 2 * t, 0.04, 0.04);  // traverso centrale
  const n = Math.max(4, Math.round((h - 0.2) / 0.13));
  for (let k = 0; k < n; k++) {                      // le stecche inclinate
    const y = t + 0.06 + k * (h - 2 * t - 0.08) / (n - 1);
    if (Math.abs(y - h * 0.5) < 0.05) continue;
    pezzo(-w / 2, y, 0.0, w - 2 * t, 0.075, 0.012, 0.55);
  }
}

/** Fiori e foglie che spuntano da una fioriera (o da un vaso). */
function ciuffoFiorito(B, x, y, z, larghezza, rnd, opz = {}) {
  const nF = Math.max(2, Math.round(larghezza / 0.16));
  for (let k = 0; k < nF; k++) {
    const fx = x + (k / (nF - 1) - 0.5) * larghezza * 0.9 + rnd.tra(-0.04, 0.04);
    B.batuffolo(fx, y + rnd.tra(0.02, 0.08), z + rnd.tra(-0.05, 0.05), rnd.tra(0.09, 0.14), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 0, bozzi: 0.2 });
  }
  const colFiore = opz.colore || rnd.scegli(C.fiori);
  const nFiori = Math.round(larghezza / 0.1);
  for (let k = 0; k < nFiori; k++) {
    const fx = x + rnd.tra(-0.5, 0.5) * larghezza * 0.9;
    const c = rnd() < 0.75 ? colFiore : rnd.scegli(C.fiori);
    B.sfera(fx, y + rnd.tra(0.08, 0.2), z + rnd.tra(-0.03, 0.1), rnd.tra(0.035, 0.05), c, { tipo: TIPI.foglie, seg: 5, segV: 4 });
  }
  if (opz.ricadenti) {                               // rametti che ricadono davanti
    for (let k = 0; k < Math.min(2, opz.ricadenti); k++) {
      const fx = x + rnd.tra(-0.45, 0.45) * larghezza;
      let yy = y - 0.05;
      const lung = rnd.intero(3, 6);
      for (let s = 0; s < lung; s++) {
        B.batuffolo(fx + Math.sin(s * 1.3 + k) * 0.03, yy, z + 0.13, 0.055 - s * 0.004, rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 0, bozzi: 0.25 });
        yy -= 0.08;
      }
    }
  }
}

/* ------------------------------------------------------------------------ */
/*  LE CASE                                                                  */
/* ------------------------------------------------------------------------ */
const CASE = [
  { x0: -32, x1: -26, piani: 3, colore: C.giallo, persiane: 0, porta: 0 },
  { x0: -26, x1: -21, piani: 2, colore: C.celeste, persiane: 3, negozio: 'fiori', porta: 4 },
  { x0: -21, x1: -15.4, piani: 3, colore: C.rosa, persiane: 0, mattoni: true, edera: true, balconi: [1], porta: 1 },
  { x0: -15.4, x1: -10.4, piani: 2, colore: C.menta, persiane: 1, tetto: 'piatto', porta: 3 },
  // ...qui c'è un vicoletto...
  { x0: -9.2, x1: -3.6, piani: 3, colore: C.pesca, persiane: 2, balconi: [1, 2], porta: 0 },
  { x0: -3.6, x1: 1.6, piani: 2, colore: C.azzurro, persiane: 0, negozio: 'forno', porta: 1 },
  { x0: 1.6, x1: 7.2, piani: 3, colore: C.burro, persiane: 0, edera: true, porta: 2 },
  { x0: 7.2, x1: 12.2, piani: 2, colore: C.terracotta, persiane: 1, tuttaMattoni: true, porta: 1 },
  { x0: 12.2, x1: 17.8, piani: 3, colore: C.lilla, persiane: 1, balconi: [2], porta: 3 },
  { x0: 17.8, x1: 23, piani: 2, colore: C.rosaChiaro, persiane: 2, negozio: 'forno', porta: 0, mattoni: true },
  { x0: 23, x1: 29, piani: 3, colore: C.menta, persiane: 3, balconi: [1], porta: 4 },
  { x0: 29, x1: 35, piani: 2, colore: C.giallo, persiane: 0, porta: 1 },
];

function casa(B, Z, o, sensori, mondo, seme) {
  const rnd = generatore(seme);
  const W = o.x1 - o.x0, cx = (o.x0 + o.x1) / 2, P = 7.5;
  const hPT = 3.5, hP = 2.9, H = hPT + (o.piani - 1) * hP;
  const muro = o.colore;
  const colMuro = (x, y) => (y < 1.1 ? mescola(per(muro, 0.94), [0.9, 0.86, 0.82], 0.15 * (1 - y / 1.1)) : muro);
  const persianaCol = C.persiane[o.persiane % 4];
  const tipoMuro = o.tuttaMattoni ? TIPI.mattoni : 0;

  // --- il corpo della casa (dietro al guscio della facciata) ---
  B.scatola(cx, H / 2, ZF - S - (P - S) / 2, W, H, P - S, colMuro, { tipo: tipoMuro });

  // --- i buchi: porta, vetrina, finestre ---
  const buchi = [], finestre = [];
  const larghPorta = 1.15, altPorta = 2.45;
  let xPorta;
  if (o.negozio) {
    xPorta = o.x0 + 0.95;
    buchi.push({ x0: xPorta - larghPorta / 2, x1: xPorta + larghPorta / 2, y0: 0, y1: altPorta, cosa: 'porta' });
    const v0 = xPorta + larghPorta / 2 + 0.45, v1 = o.x1 - 0.5;
    buchi.push({ x0: v0, x1: v1, y0: 0.6, y1: 2.6, cosa: 'vetrina' });
  } else {
    xPorta = o.porta % 2 ? o.x0 + W * 0.3 : o.x1 - W * 0.3;
    buchi.push({ x0: xPorta - larghPorta / 2, x1: xPorta + larghPorta / 2, y0: 0, y1: altPorta, cosa: 'porta' });
    const xf = xPorta < cx ? o.x1 - W * 0.27 : o.x0 + W * 0.27;
    finestre.push({ x: xf, y0: 1.05, w: 1.0, h: 1.55, piano: 0 });
  }
  const nF = W > 5.5 ? 3 : 2;
  for (let p = 1; p < o.piani; p++) {
    const y0 = hPT + (p - 1) * hP + 0.75;
    for (let k = 0; k < nF; k++) {
      const x = o.x0 + W * (k + 0.5) / nF;
      const balcone = o.balconi && o.balconi.includes(p) && k === Math.floor(nF / 2);
      finestre.push({ x, y0: balcone ? y0 - 0.6 : y0, w: balcone ? 1.0 : 0.95, h: balcone ? 2.25 : 1.6, piano: p, balcone });
    }
  }
  for (const f of finestre) buchi.push({ x0: f.x - f.w / 2, x1: f.x + f.w / 2, y0: f.y0, y1: f.y0 + f.h, cosa: 'finestra' });

  // --- il guscio della facciata con i buchi veri ---
  muroConBuchi(B, o.x0, o.x1, 0, H, ZF - S, ZF, buchi, colMuro, tipoMuro);

  // --- zoccolo di pietre (a nord nel film: pietre azzurrine) ---
  const zoccoloCol = o.tuttaMattoni ? C.pietraCalda : (rnd() < 0.5 ? C.pietraBlu : C.pietraCalda);
  const tratti = [];
  let xs = o.x0;
  for (const b of buchi.filter((b) => b.y0 < 0.6).sort((a, b) => a.x0 - b.x0)) { if (b.x0 > xs) tratti.push([xs, b.x0]); xs = b.x1; }
  if (xs < o.x1) tratti.push([xs, o.x1]);
  for (const [a, b] of tratti) if (b - a > 0.05) B.scatola((a + b) / 2, 0.32, ZF + 0.03, b - a, 0.64, 0.06, zoccoloCol, { tipo: TIPI.pietre });

  // --- cornici marcapiano e cornicione ---
  for (let p = 1; p < o.piani; p++) B.scatola(cx, hPT + (p - 1) * hP + 0.05, ZF + 0.04, W, 0.13, 0.08, per(muro, 1.03), {});
  B.scatola(cx, H - 0.12, ZF + 0.1, W + 0.02, 0.24, 0.2, C.cornice, {});
  B.scatola(cx, H + 0.03, ZF + 0.2, W + 0.04, 0.1, 0.4, C.cornice, {});

  // --- le finestre ---
  for (const f of finestre) {
    const t = 0.085, zv = ZF - S + 0.05;
    const y1 = f.y0 + f.h;
    // cornice bianca
    B.scatola(f.x, y1 + t / 2, ZF + 0.03, f.w + 2 * t, t, 0.06, C.cornice);
    B.scatola(f.x - f.w / 2 - t / 2, f.y0 + f.h / 2, ZF + 0.03, t, f.h, 0.06, C.cornice);
    B.scatola(f.x + f.w / 2 + t / 2, f.y0 + f.h / 2, ZF + 0.03, t, f.h, 0.06, C.cornice);
    if (!f.balcone) B.scatola(f.x, f.y0 - 0.045, ZF + 0.07, f.w + 0.26, 0.09, 0.2, C.davanzale);
    // vetro e telaio a croce
    B.scatola(f.x, f.y0 + f.h / 2, zv, f.w, f.h, 0.02, C.vetro, { tipo: TIPI.vetro });
    B.scatola(f.x, f.y0 + f.h / 2, zv + 0.03, 0.05, f.h, 0.04, C.telaio);
    B.scatola(f.x, f.y0 + f.h * 0.66, zv + 0.03, f.w, 0.05, 0.04, C.telaio);
    B.scatola(f.x, f.y0 + 0.03, zv + 0.03, f.w, 0.06, 0.05, C.telaio);
    B.scatola(f.x, y1 - 0.03, zv + 0.03, f.w, 0.06, 0.05, C.telaio);
    B.scatola(f.x - f.w / 2 + 0.03, f.y0 + f.h / 2, zv + 0.03, 0.06, f.h, 0.05, C.telaio);
    B.scatola(f.x + f.w / 2 - 0.03, f.y0 + f.h / 2, zv + 0.03, 0.06, f.h, 0.05, C.telaio);
    // una tendina di pizzo in qualche finestra
    if (rnd() < 0.35) B.scatola(f.x - f.w * 0.22, f.y0 + f.h * 0.62, zv + 0.012, f.w * 0.42, f.h * 0.7, 0.01, rnd() < 0.5 ? C.tenda : [0.99, 0.97, 0.94]);
    // persiane: aperte contro il muro o socchiuse
    const ap = rnd() < 0.7 ? Math.PI * 0.97 : rnd.tra(1.9, 2.4);
    persiana(B, f.x - f.w / 2 - t, f.y0, ZF + 0.04, f.w / 2, f.h, persianaCol, ap, -1);
    persiana(B, f.x + f.w / 2 + t, f.y0, ZF + 0.04, f.w / 2, f.h, persianaCol, rnd() < 0.8 ? ap : Math.PI * 0.97, 1);
    // fioriera
    if (!f.balcone && (f.piano > 0 || rnd() < 0.5) && rnd() < 0.75) {
      const colF = rnd() < 0.5 ? C.terracotta : per(persianaCol, 1.1);
      B.scatola(f.x, f.y0 + 0.08, ZF + 0.2, f.w * 0.95, 0.2, 0.22, colF, { r: 0.02 });
      ciuffoFiorito(B, f.x, f.y0 + 0.2, ZF + 0.2, f.w * 0.9, rnd, { ricadenti: rnd() < 0.6 ? 3 : 0 });
      sensori.scatola(f.x - f.w / 2, f.y0 - 0.05, ZF, f.x + f.w / 2, f.y0 + 0.4, ZF + 0.45, 'foglie', 'fioriera');
      mondo.posatoi.push(new THREE.Vector3(f.x + rnd.tra(-0.3, 0.3), f.y0 + 0.2, ZF + 0.22));
    }
    // balcone
    if (f.balcone) {
      const bw = f.w + 1.0, bd = 0.8, yb = f.y0;
      B.scatola(f.x, yb - 0.07, ZF + bd / 2, bw, 0.14, bd, C.cornice, { r: 0.03 });
      for (const s of [-1, 1]) B.scatola(f.x + s * (bw / 2 - 0.25), yb - 0.25, ZF + 0.2, 0.12, 0.25, 0.35, C.cornice, { r: 0.03 });
      const yr = yb + 0.92;
      B.scatola(f.x, yr, ZF + bd - 0.04, bw, 0.045, 0.05, C.ferro);
      for (const s of [-1, 1]) B.scatola(f.x + s * (bw / 2 - 0.02), yr, ZF + bd / 2, 0.045, 0.045, bd, C.ferro);
      B.scatola(f.x, yb + 0.1, ZF + bd - 0.04, bw, 0.03, 0.03, C.ferro);
      for (let xb = -bw / 2 + 0.06; xb <= bw / 2 - 0.05; xb += 0.11) B.cilindro(f.x + xb, yb, ZF + bd - 0.04, 0.011, 0.011, 0.92, C.ferro, { seg: 5 });
      for (const s of [-1, 1]) for (let zb = 0.12; zb < bd - 0.05; zb += 0.12) B.cilindro(f.x + s * (bw / 2 - 0.02), yb, ZF + zb, 0.011, 0.011, 0.92, C.ferro, { seg: 5 });
      // vasi sul balcone
      for (const s of [-1, 1]) {
        const vx = f.x + s * (bw / 2 - 0.25);
        B.tornio(vx, yb, ZF + 0.45, [[0, 0], [0.11, 0], [0.15, 0.24], [0.16, 0.26], [0.12, 0.26], [0, 0.22]], C.terracotta, { seg: 10 });
        const m = B.segna();
        for (let k = 0; k < 4; k++) B.batuffolo(vx + rnd.tra(-0.1, 0.1), yb + 0.38 + rnd.tra(0, 0.12), ZF + 0.45 + rnd.tra(-0.08, 0.08), rnd.tra(0.1, 0.15), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 0, bozzi: 0.25 });
        B.ammorbidisci(m, new THREE.Vector3(vx, yb + 0.4, ZF + 0.45), new THREE.Vector3(0.2, 0.2, 0.2));
        for (let k = 0; k < 5; k++) B.sfera(vx + rnd.tra(-0.15, 0.15), yb + 0.42 + rnd.tra(0, 0.15), ZF + 0.5 + rnd.tra(0, 0.1), 0.04, rnd.scegli(C.fiori), { tipo: TIPI.foglie, seg: 6, segV: 4 });
      }
      sensori.scatola(f.x - bw / 2, yb - 0.15, ZF, f.x + bw / 2, yb + 0.95, ZF + bd, 'metallo', 'balcone');
      mondo.posatoi.push(new THREE.Vector3(f.x + rnd.tra(-0.4, 0.4), yr + 0.03, ZF + bd - 0.04));
    }
    sensori.scatola(f.x - f.w / 2 - 0.1, f.y0, ZF - S, f.x + f.w / 2 + 0.1, f.y0 + f.h + 0.1, ZF + 0.12, 'vetro', 'finestra', { x: f.x, y: f.y0 + f.h / 2 });
  }

  // --- la porta ---
  {
    const colP = C.porte[o.porta % C.porte.length], zp = ZF - S + 0.06, t = 0.1;
    B.scatola(xPorta, altPorta + t / 2, ZF + 0.03, larghPorta + 2 * t, t, 0.07, C.cornice);
    B.scatola(xPorta - larghPorta / 2 - t / 2, altPorta / 2, ZF + 0.03, t, altPorta, 0.07, C.cornice);
    B.scatola(xPorta + larghPorta / 2 + t / 2, altPorta / 2, ZF + 0.03, t, altPorta, 0.07, C.cornice);
    B.scatola(xPorta, MARCIAPIEDE + 0.06, ZF + 0.18, larghPorta + 0.3, 0.12, 0.4, C.pietraCalda, { r: 0.02 });
    const hAnta = altPorta - 0.55;
    for (const s of [-1, 1]) {
      const ax = xPorta + s * larghPorta / 4;
      B.scatola(ax, MARCIAPIEDE + hAnta / 2, zp, larghPorta / 2 - 0.02, hAnta, 0.06, colP);
      B.scatola(ax, MARCIAPIEDE + hAnta * 0.28, zp + 0.04, larghPorta / 2 - 0.2, hAnta * 0.32, 0.03, per(colP, 1.08), { r: 0.01 });
      B.scatola(ax, MARCIAPIEDE + hAnta * 0.72, zp + 0.04, larghPorta / 2 - 0.2, hAnta * 0.38, 0.03, per(colP, 1.08), { r: 0.01 });
    }
    B.sfera(xPorta + 0.12, MARCIAPIEDE + 1.0, zp + 0.08, 0.035, [0.95, 0.80, 0.45]);
    // sopraluce a ventaglio
    const yS = MARCIAPIEDE + hAnta + 0.04;
    B.scatola(xPorta, yS + 0.02, zp, larghPorta, 0.05, 0.06, C.telaio);
    B.scatola(xPorta, (yS + altPorta) / 2, zp - 0.02, larghPorta, altPorta - yS, 0.02, C.vetro, { tipo: TIPI.vetro });
    for (let k = -2; k <= 2; k++) B.scatola(xPorta + k * 0.04, yS + 0.18, zp + 0.01, 0.025, 0.32, 0.025, C.telaio, { rot: [0, 0, k * 0.35] });
    sensori.scatola(xPorta - larghPorta / 2 - 0.1, 0, ZF - S, xPorta + larghPorta / 2 + 0.1, altPorta + 0.1, ZF + 0.12, 'legno', 'porta', { x: xPorta });
    mondo.porte.push(new THREE.Vector3(xPorta, 0, ZF));
  }

  // --- il negozio: vetrina, tenda a righe, insegna ---
  if (o.negozio) {
    const v = buchi.find((b) => b.cosa === 'vetrina'), vx = (v.x0 + v.x1) / 2, vw = v.x1 - v.x0, zv = ZF - S + 0.02;
    B.scatola(vx, (v.y0 + v.y1) / 2, zv, vw, v.y1 - v.y0, 0.02, [0.99, 0.92, 0.78]);          // il fondo caldo del negozio
    B.scatola(vx, v.y0 + 0.02, ZF - 0.12, vw, 0.06, 0.3, C.legnoChiaro);                         // banco della vetrina
    B.scatola(vx, v.y0 + 0.85, zv + 0.12, vw - 0.1, 0.04, 0.22, C.legnoChiaro);                   // mensola
    for (const s of [-1, 1]) B.scatola(vx + s * (vw / 2 + 0.06), (v.y0 + v.y1) / 2, ZF + 0.03, 0.12, v.y1 - v.y0 + 0.12, 0.08, C.legno);
    B.scatola(vx, v.y1 + 0.06, ZF + 0.03, vw + 0.24, 0.12, 0.08, C.legno);
    B.scatola(vx, v.y0 - 0.06, ZF + 0.06, vw + 0.24, 0.12, 0.14, C.legno);
    if (o.negozio === 'forno') {                    // pane, baguette, cornetti
      for (let k = 0; k < Math.floor(vw / 0.32); k++) {
        const px = v.x0 + 0.22 + k * 0.32;
        B.sfera(px, v.y0 + 0.13, ZF - 0.13, 0.11, k % 2 ? C.pane : C.paneScuro, { scala: [1, 0.6, 0.85] });
        if (k % 2 === 0) B.aggiungi(new THREE.CapsuleGeometry(0.035, 0.42, 4, 8), matrice(px + 0.05, v.y0 + 0.87 + 0.2, zv + 0.12, [0, 0, 0.25]), C.pane, 0);
        else B.aggiungi(new THREE.TorusGeometry(0.06, 0.03, 6, 10, Math.PI * 1.3), matrice(px, v.y0 + 0.92, zv + 0.14, [Math.PI / 2, 0, 0.6]), C.paneScuro, 0);
      }
      // l'insegna: una pagnotta di legno appesa
      const ix = o.x0 + 0.25;
      B.scatola(ix, 3.0, ZF + 0.35, 0.05, 0.05, 0.7, C.ferro);
      B.cilindro(ix, 2.45, ZF + 0.6, 0.32, 0.32, 0.06, C.cornice, { rot: [0, 0, Math.PI / 2], seg: 16 });
      B.sfera(ix, 2.45, ZF + 0.6, 0.18, C.pane, { scala: [0.6, 0.8, 1.2] });
    } else {                                        // fioraio: secchi di fiori sul marciapiede
      for (let k = 0; k < 4; k++) {
        const bx = v.x0 + 0.3 + k * (vw - 0.6) / 3;
        B.cilindro(bx, MARCIAPIEDE, ZF + 0.45, 0.16, 0.13, 0.36, k % 2 ? C.metallo : C.persiane[3], { seg: 10 });
        ciuffoFiorito(B, bx, MARCIAPIEDE + 0.4, ZF + 0.45, 0.3, rnd, { colore: C.fiori[(k + o.persiane) % C.fiori.length] });
        sensori.scatola(bx - 0.2, 0, ZF + 0.25, bx + 0.2, 0.75, ZF + 0.65, 'ceramica', 'vaso');
      }
      for (let k = 0; k < Math.floor(vw / 0.3); k++) B.sfera(v.x0 + 0.2 + k * 0.3, v.y0 + 0.95, zv + 0.12, 0.09, rnd.scegli(C.fiori), { tipo: TIPI.foglie, seg: 8, segV: 6 });
    }
    // la tenda a righe
    const yT = v.y1 + 0.35, sporge = 1.1, cad = 0.55, n = Math.max(6, Math.round((vw + 0.6) / 0.28));
    const lung = Math.hypot(sporge, cad), ang = Math.atan2(cad, sporge);
    for (let k = 0; k < n; k++) {
      const x = v.x0 - 0.3 + (k + 0.5) * (vw + 0.6) / n;
      const col = k % 2 ? [0.99, 0.97, 0.93] : (o.negozio === 'forno' ? C.tenda : C.menta);
      B.scatola(x, yT - cad / 2, ZF + sporge / 2, (vw + 0.6) / n + 0.005, 0.03, lung, col, { rot: [ang, 0, 0] });
      B.cilindro(x, yT - cad - 0.02, ZF + sporge, 0.13, 0.13, 0.02, col, { rot: [Math.PI / 2, 0, 0], seg: 10, scala: [1, 1, 1.4] });
    }
    sensori.scatola(v.x0, v.y0, ZF - S, v.x1, v.y1, ZF + 0.12, 'vetro', 'vetrina', { x: vx });
    sensori.scatola(v.x0 - 0.3, yT - cad - 0.15, ZF, v.x1 + 0.3, yT + 0.05, ZF + sporge, 'legno', 'tenda');
  }

  // --- mattoni scoperti (dove l'intonaco è caduto) ---
  if (o.mattoni) {
    const mx = o.x0 + W * rnd.tra(0.15, 0.3), my = rnd.tra(1.3, H - 2.5);
    const libero = !buchi.some((b) => mx + 0.7 > b.x0 - 0.3 && mx - 0.7 < b.x1 + 0.3 && my + 0.5 > b.y0 && my - 0.5 < b.y1);
    if (libero) {
      for (let k = 0; k < 4; k++) B.scatola(mx + rnd.tra(-0.3, 0.3), my + rnd.tra(-0.25, 0.25), ZF + 0.008, rnd.tra(0.5, 0.9), rnd.tra(0.25, 0.4), 0.02, C.mattone, { tipo: TIPI.mattoni });
      sensori.scatola(mx - 0.7, my - 0.5, ZF - 0.05, mx + 0.7, my + 0.5, ZF + 0.06, 'mattoni', 'mattoni');
    }
  }

  // --- il tetto ---
  if (o.tetto === 'piatto') {
    B.scatola(cx, H + 0.35, ZF - P / 2 + 0.1, W, 0.5, P - 0.2, colMuro);
    B.scatola(cx, H + 0.62, ZF - P / 2 + 0.1, W + 0.06, 0.06, P - 0.1, C.cornice);
    for (let k = 0; k < 3; k++) {                 // vasi sulla terrazza
      const vx = o.x0 + 0.8 + k * (W - 1.6) / 2;
      B.tornio(vx, H + 0.6, ZF - 0.6, [[0, 0], [0.18, 0], [0.24, 0.4], [0, 0.38]], C.terracotta, { seg: 10 });
      const m = B.segna();
      B.batuffolo(vx, H + 1.25, ZF - 0.6, 0.38, rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13 });
      B.ammorbidisci(m, new THREE.Vector3(vx, H + 1.25, ZF - 0.6), new THREE.Vector3(0.4, 0.4, 0.4));
    }
    mondo.posatoi.push(new THREE.Vector3(cx, H + 0.66, ZF - 0.2));
  } else {
    const hr = Math.min(2.6, P * 0.32), zc = ZF - P / 2, sp = 0.5;
    const z0 = ZF + sp, y0 = H + 0.05;
    const lung = Math.hypot(z0 - zc, hr), ang = Math.atan2(hr, z0 - zc);
    // il frontone (pieno, colore del muro): si vede di lato quando la casa accanto è più bassa
    B.aggiungi(prisma(W, hr, P), matrice(cx, H, zc), colMuro, tipoMuro);
    const righe = 7;
    for (let k = 0; k < righe; k++) {             // file di tegole, una sopra l'altra
      const t0 = k / righe, l = lung / righe * 1.18;
      const zz = lerp(z0, zc, t0 + 0.5 / righe), yy = lerp(y0, H + hr, t0 + 0.5 / righe);
      B.scatola(cx, yy + 0.06, zz, W + 0.5, 0.08, l, k % 2 ? C.tegola : C.tegola2, { rot: [ang, 0, 0], r: 0.025 });
    }
    B.scatola(cx, H + hr * 0.5, zc - (P / 2) * 0.5, W + 0.5, 0.1, lung, C.tegola2, { rot: [-ang, 0, 0] });   // falda dietro
    B.cilindro(o.x0 - 0.25, H + hr + 0.08, zc, 0.11, 0.11, W + 0.5, C.tegola2, { rot: [0, 0, -Math.PI / 2], seg: 8 });
    // comignolo
    const cxm = o.x0 + W * rnd.tra(0.2, 0.8);
    B.scatola(cxm, H + hr, zc - 1.0, 0.5, 2.2, 0.5, colMuro, { r: 0.03 });
    B.scatola(cxm, H + hr + 1.15, zc - 1.0, 0.66, 0.1, 0.66, C.cornice, { r: 0.02 });
    B.scatola(cxm, H + hr + 1.32, zc - 1.0, 0.36, 0.25, 0.36, C.terracotta, { r: 0.02 });
    mondo.comignoli.push(new THREE.Vector3(cxm, H + hr + 1.5, zc - 1.0));
    // grondaia orizzontale e pluviale
    B.cilindro(o.x0, y0 - 0.02, ZF + sp - 0.05, 0.07, 0.07, W, C.grondaia, { rot: [0, 0, -Math.PI / 2], seg: 8 });
    const xp = (o.porta % 2 ? o.x1 - 0.18 : o.x0 + 0.18);
    B.cilindro(xp, 0.28, ZF + 0.09, 0.045, 0.045, H - 0.3, C.grondaia, { seg: 8 });
    B.cilindro(xp, H - 0.1, ZF + 0.09, 0.045, 0.045, 0.4, C.grondaia, { seg: 8, rot: [0.9, 0, 0] });
    B.cilindro(xp, 0.15, ZF + 0.3, 0.05, 0.05, 0.3, C.grondaia, { seg: 8, rot: [-0.9, 0, 0] });
    for (let y = 1; y < H; y += 1.6) B.scatola(xp, y, ZF + 0.05, 0.13, 0.04, 0.1, C.grondaia);
    sensori.scatola(xp - 0.1, 0, ZF, xp + 0.1, H, ZF + 0.18, 'metallo', 'grondaia');
    sensori.scatola(o.x0 - 0.25, H, zc, o.x1 + 0.25, H + hr, ZF + sp, 'ceramica', 'tetto');
    for (let k = 0; k < 2; k++) mondo.posatoi.push(new THREE.Vector3(o.x0 + rnd.tra(0.5, W - 0.5), H + hr + 0.2, zc));
  }

  // --- rampicante (edera) che sale dal marciapiede ---
  if (o.edera) {
    const ex = xPorta + (xPorta < cx ? larghPorta / 2 + 0.55 : -larghPorta / 2 - 0.55);
    const m = B.segna();
    let x = ex, y = 0.2;
    B.tornio(ex, MARCIAPIEDE, ZF + 0.3, [[0, 0], [0.16, 0], [0.2, 0.3], [0.21, 0.32], [0.17, 0.32], [0, 0.28]], C.terracotta, { seg: 10 });
    for (let k = 0; k < 26 && y < H - 0.6; k++) {
      x += Math.sin(k * 0.9 + seme) * 0.12; y += 0.18;
      const lato = Math.sin(k * 2.3) * 0.22;
      B.batuffolo(x + lato, y, ZF + 0.09, rnd.tra(0.09, 0.15), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13, scala: [1, 1, 0.55] });
      if (k % 3 === 0) B.batuffolo(x - lato * 1.4, y + 0.05, ZF + 0.08, rnd.tra(0.07, 0.11), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13, scala: [1, 1, 0.5] });
      if (k % 5 === 2) B.sfera(x + lato * 0.5, y + 0.08, ZF + 0.16, 0.04, C.fiori[1], { tipo: TIPI.foglie, seg: 6, segV: 4 });
    }
    sensori.scatola(ex - 0.5, 0, ZF - 0.05, ex + 0.5, y, ZF + 0.25, 'foglie', 'edera');
  }

  // i sensori: tutta la facciata è "intonaco" (o mattoni)
  sensori.scatola(o.x0, 0, ZF - P, o.x1, H, ZF, o.tuttaMattoni ? 'mattoni' : 'intonaco', 'muro');
  return H;
}

/* ------------------------------------------------------------------------ */
/*  LAMPIONE, ALBERO, VASI, PANCHINA                                         */
/* ------------------------------------------------------------------------ */
function lampione(B, x, z, y0, sensori, mondo) {
  const c = C.lampione;
  B.tornio(x, y0, z, [[0, 0], [0.17, 0], [0.17, 0.08], [0.12, 0.14], [0.09, 0.4], [0.06, 0.5], [0, 0.5]], c, { seg: 12 });
  B.cilindro(x, y0 + 0.45, z, 0.045, 0.06, 3.0, c, { seg: 10 });
  B.tornio(x, y0 + 1.3, z, [[0, 0], [0.075, 0], [0.085, 0.05], [0.075, 0.1], [0, 0.1]], c, { seg: 10 });
  B.tornio(x, y0 + 3.4, z, [[0, 0], [0.09, 0], [0.13, 0.06], [0.06, 0.12], [0, 0.12]], c, { seg: 10 });
  // la lanterna
  const yl = y0 + 3.5;
  B.tornio(x, yl, z, [[0, 0], [0.09, 0.0], [0.16, 0.08], [0.2, 0.42], [0, 0.42]], [0.99, 0.92, 0.70], { seg: 6, tipo: TIPI.luce });
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B.cilindro(x + Math.cos(a) * 0.18, yl + 0.05, z + Math.sin(a) * 0.18, 0.012, 0.012, 0.4, c, { seg: 4, rot: [0, 0, 0] }); }
  B.tornio(x, yl + 0.4, z, [[0, 0], [0.27, 0], [0.24, 0.05], [0.12, 0.2], [0.03, 0.3], [0.05, 0.36], [0, 0.4]], c, { seg: 12 });
  sensori.scatola(x - 0.18, 0, z - 0.18, x + 0.18, yl + 0.8, z + 0.18, 'metallo', 'lampione', { luce: new THREE.Vector3(x, yl + 0.22, z) });
  mondo.lampioni.push(new THREE.Vector3(x, yl + 0.22, z));
  mondo.posatoi.push(new THREE.Vector3(x, yl + 0.82, z));
  mondo.curiosita.push(new THREE.Vector3(x, 0, z));
  mondo.ombre.push([x, y0, z, 0.5, 0.5]);
}

function albero(B, x, z, y0, rnd, sensori, mondo, opz = {}) {
  const alt = opz.altezza || rnd.tra(3.2, 4.2), rc = opz.chioma || rnd.tra(1.5, 2.0);
  // tronco un po' storto, in tre pezzi
  let px = x, pz = z, py = y0;
  for (let k = 0; k < 3; k++) {
    const h = alt / 3, dx = rnd.tra(-0.12, 0.12), dz = rnd.tra(-0.08, 0.08);
    B.cilindro(px, py, pz, 0.13 - k * 0.03, 0.16 - k * 0.03, h + 0.05, C.tronco, { seg: 8, rot: [dz * 1.5, 0, -dx * 1.5] });
    px += dx; pz += dz; py += h;
  }
  for (let k = 0; k < 2; k++) {                      // due rami
    const a = rnd.tra(0, Math.PI * 2);
    B.cilindro(px, py - 0.6, pz, 0.04, 0.07, 1.0, C.tronco, { seg: 6, rot: [Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8] });
  }
  // la chioma: tanti batuffoli che si illuminano come una sola nuvola verde
  const cy = py + rc * 0.55, m = B.segna();
  const colBase = opz.colori || C.foglie;
  const n = opz.batuffoli || 11;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 * 2.3, rr = rc * (0.35 + 0.5 * rnd());
    const bx = px + Math.cos(a) * rr * 0.8, bz = pz + Math.sin(a) * rr * 0.6, by = cy + rnd.tra(-0.5, 0.7) * rc * 0.6;
    B.batuffolo(bx, by, bz, rnd.tra(0.55, 0.85) * rc * 0.62, rnd.scegli(colBase), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13 });
  }
  B.batuffolo(px, cy + rc * 0.35, pz, rc * 0.62, rnd.scegli(colBase), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13 });
  B.ammorbidisci(m, new THREE.Vector3(px, cy, pz), new THREE.Vector3(rc, rc * 0.8, rc), 0.8);
  if (opz.fiori) for (let k = 0; k < 40; k++) {     // un albero fiorito (ciliegio)
    const a = rnd.tra(0, Math.PI * 2), e = rnd.tra(-0.3, 1.0);
    B.sfera(px + Math.cos(a) * rc * 1.0 * Math.cos(e), cy + Math.sin(e) * rc * 0.85, pz + Math.sin(a) * rc * 0.85 * Math.cos(e), rnd.tra(0.07, 0.11), opz.fiori, { tipo: TIPI.foglie, seg: 6, segV: 4 });
  }
  sensori.sfera(px, cy, pz, rc * 1.05, 'foglie', 'albero', { centro: new THREE.Vector3(px, cy, pz), raggio: rc });
  sensori.scatola(x - 0.2, 0, z - 0.2, x + 0.2, py, z + 0.2, 'legno', 'tronco');
  mondo.alberi.push({ centro: new THREE.Vector3(px, cy, pz), raggio: rc });
  mondo.posatoi.push(new THREE.Vector3(px + rc * 0.3, cy + rc * 0.75, pz));
  mondo.ombre.push([x + 0.6, y0, z, rc * 1.25, rc * 0.95]);
  mondo.curiosita.push(new THREE.Vector3(x, 0, z));
}

/** Vasi da marciapiede: diverse piante (come nel film: il pino, la lavanda, il cespuglio). */
function vaso(B, x, z, y0, rnd, tipo, sensori, mondo) {
  const r = rnd.tra(0.18, 0.26), h = rnd.tra(0.28, 0.42);
  const colV = rnd() < 0.7 ? C.terracotta : rnd.scegli([C.persiane[2], [0.96, 0.92, 0.85]]);
  B.tornio(x, y0, z, [[0, 0], [r * 0.75, 0], [r, h * 0.85], [r * 1.12, h * 0.88], [r * 1.12, h], [r * 0.95, h], [0, h * 0.95]], colV, { seg: 12 });
  const yt = y0 + h;
  const m = B.segna();
  if (tipo === 'pino') {                           // il "bonsai" del film: tronco e cuscini di aghi
    B.cilindro(x, yt - 0.05, z, 0.025, 0.04, 0.7, C.tronco, { seg: 6, rot: [0, 0, 0.15] });
    const pads = [[0.05, 0.75, 0.0, 0.22], [-0.15, 0.5, 0.05, 0.18], [0.2, 0.45, -0.04, 0.17], [0.0, 0.95, 0.0, 0.15]];
    for (const [dx, dy, dz, rr] of pads) B.batuffolo(x + dx, yt + dy, z + dz, rr, C.foglie[3], { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13, scala: [1.3, 0.55, 1.1] });
  } else if (tipo === 'lavanda') {
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, rr = 0.03 + (k % 3) * 0.05;
      B.cilindro(x + Math.cos(a) * rr, yt, z + Math.sin(a) * rr, 0.006, 0.01, 0.45, C.foglie[2], { seg: 4, rot: [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2] });
      B.aggiungi(new THREE.CapsuleGeometry(0.02, 0.13, 3, 8), matrice(x + Math.cos(a) * rr * 1.6, yt + 0.5, z + Math.sin(a) * rr * 1.6), C.fiori[4], TIPI.foglie);
    }
  } else if (tipo === 'limone') {
    B.cilindro(x, yt - 0.05, z, 0.025, 0.035, 0.45, C.tronco, { seg: 6 });
    B.batuffolo(x, yt + 0.7, z, 0.32, C.foglie[1], { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13 });
    for (let k = 0; k < 6; k++) { const a = k * 1.1; B.sfera(x + Math.cos(a) * 0.28, yt + 0.6 + Math.sin(k * 2.1) * 0.15, z + Math.sin(a) * 0.28, 0.05, [0.99, 0.88, 0.35], { tipo: TIPI.foglie, seg: 8, segV: 6 }); }
  } else {                                         // cespuglio fiorito
    for (let k = 0; k < 4; k++) B.batuffolo(x + rnd.tra(-0.12, 0.12), yt + 0.18 + rnd.tra(0, 0.15), z + rnd.tra(-0.1, 0.1), rnd.tra(0.16, 0.22), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 1, bozzi: 0.13 });
    const cf = rnd.scegli(C.fiori);
    for (let k = 0; k < 10; k++) { const a = rnd.tra(0, Math.PI * 2), e = rnd.tra(0, 1.2); B.sfera(x + Math.cos(a) * 0.26 * Math.cos(e), yt + 0.25 + Math.sin(e) * 0.22, z + Math.sin(a) * 0.24 * Math.cos(e), 0.045, cf, { tipo: TIPI.foglie, seg: 6, segV: 4 }); }
  }
  B.ammorbidisci(m, new THREE.Vector3(x, yt + 0.4, z), new THREE.Vector3(0.35, 0.4, 0.35), 0.5);
  sensori.scatola(x - r - 0.05, 0, z - r - 0.05, x + r + 0.05, yt, z + r + 0.05, 'ceramica', 'vaso');
  sensori.sfera(x, yt + 0.45, z, 0.35, 'foglie', 'pianta');
  mondo.curiosita.push(new THREE.Vector3(x, 0, z));
  mondo.ombre.push([x, y0, z, r * 1.8, r * 1.6]);
}

function panchina(B, x, z, y0, sensori, mondo) {
  for (let k = 0; k < 3; k++) B.scatola(x, y0 + 0.45, z - 0.2 + k * 0.13, 1.8, 0.04, 0.1, C.legno, { r: 0.015 });
  for (let k = 0; k < 2; k++) B.scatola(x, y0 + 0.65 + k * 0.15, z + 0.2, 1.8, 0.1, 0.035, C.legno, { r: 0.015, rot: [-0.2, 0, 0] });
  for (const s of [-1, 1]) {
    B.scatola(x + s * 0.75, y0 + 0.22, z - 0.18, 0.05, 0.44, 0.05, C.ferro);
    B.scatola(x + s * 0.75, y0 + 0.45, z + 0.19, 0.05, 0.9, 0.05, C.ferro, { rot: [-0.12, 0, 0] });
    B.scatola(x + s * 0.75, y0 + 0.43, z, 0.05, 0.04, 0.45, C.ferro);
  }
  sensori.scatola(x - 0.9, 0, z - 0.25, x + 0.9, y0 + 0.9, z + 0.25, 'legno', 'panchina');
  mondo.curiosita.push(new THREE.Vector3(x, 0, z - 0.6));
  mondo.ombre.push([x, y0, z, 1.0, 0.35]);
}

/* ------------------------------------------------------------------------ */
/*  IL MONDO INTERO                                                          */
/* ------------------------------------------------------------------------ */
export function creaMondo(scena) {
  const B = new Costruttore();      // le cose vicine
  const L = new Costruttore();      // le cose lontane (città, colline)
  const N = new Costruttore();      // le nuvole
  const sensori = new Sensori();
  const rnd = generatore(2010);
  const mondo = { sensori, lampioni: [], posatoi: [], curiosita: [], ombre: [], alberi: [], porte: [], comignoli: [] };
  // per curiosità (e per ottimizzare): quanti triangoli costa ogni parte del mondo
  mondo.conteggi = {};
  let ultimo = 0;
  const conta = (nome) => { const t = B.ind.length / 3; mondo.conteggi[nome] = (mondo.conteggi[nome] || 0) + Math.round(t - ultimo); ultimo = t; };

  /* --- STRADA, CORDOLI, MARCIAPIEDI --- */
  B.scatola(0, -0.05, 3.2, 130, 0.1, 6.4, C.strada, { tipo: TIPI.terra, sx: 40, sz: 3 });
  // strisce pedonali, tombini, griglie: "dipinti" sulla strada (quasi piatti: niente linee a puntini da lontano)
  for (let k = 0; k < 7; k++) B.scatola(2 + k * 0.62, 0.0, 3.2, 0.36, 0.006, 5.2, C.strisce, { tipo: TIPI.terra });
  for (const x of [-20, 9, 24]) B.cilindro(x, -0.002, 2.2, 0.34, 0.34, 0.005, [0.62, 0.62, 0.66], { seg: 16 });
  for (let x = -40; x < 40; x += 8) B.scatola(x + 3, 0.0, 0.25, 0.7, 0.005, 0.25, [0.5, 0.5, 0.55], { tipo: TIPI.terra });
  // marciapiede nord (lastre di pietra) con la striscia gialla tattile
  B.scatola(0, MARCIAPIEDE / 2, (ZF - 0.2) / 2 - 0.0, 130, MARCIAPIEDE, -ZF - 0.2 + 0.0, C.marciapiede, { tipo: TIPI.lastre });
  B.scatola(0, MARCIAPIEDE + 0.004, -1.0, 130, 0.01, 0.42, C.tattile, { tipo: TIPI.terra });
  B.scatola(0, MARCIAPIEDE / 2 + 0.006, -0.1, 130, MARCIAPIEDE + 0.012, 0.2, C.cordolo, { tipo: TIPI.terra, sx: 40 });
  // marciapiede sud
  B.scatola(0, MARCIAPIEDE / 2, 7.6, 130, MARCIAPIEDE, 2.0, C.marciapiede, { tipo: TIPI.lastre });
  B.scatola(0, MARCIAPIEDE / 2 + 0.006, 6.5, 130, MARCIAPIEDE + 0.012, 0.2, C.cordolo, { tipo: TIPI.terra, sx: 40 });
  sensori.scatola(-80, -1, 0, 80, 0, 6.4, 'pietra', 'strada');
  sensori.scatola(-80, -1, ZF, 80, MARCIAPIEDE, 0, 'pietra', 'marciapiede');
  sensori.scatola(-80, -1, 6.4, 80, MARCIAPIEDE, 8.6, 'pietra', 'marciapiede');

  conta('strada');
  /* --- LE CASE --- */
  CASE.forEach((o, i) => casa(B, ZF, o, sensori, mondo, 100 + i * 17));
  conta('case');
  // il vicoletto fra le case: un muro in fondo, scalini, un vaso
  B.scatola(-9.8, 1.6, ZF - 4.5, 1.25, 3.2, 0.3, C.crema);
  B.scatola(-9.8, 3.25, ZF - 4.5, 1.35, 0.12, 0.42, C.cornice);
  B.scatola(-9.8, 0.08, ZF - 2.2, 1.2, 0.16, 4.6, C.pietraCalda, { tipo: TIPI.lastre });
  B.scatola(-9.8, 2.8, ZF - 1.2, 1.2, 0.05, 0.05, C.ferro);         // un filo per i panni
  for (let k = 0; k < 3; k++) B.scatola(-10.1 + k * 0.3, 2.55, ZF - 1.2, 0.22, 0.45, 0.01, C.fiori[k + 1], { rot: [0, 0, (k - 1) * 0.08] });
  sensori.scatola(-10.4, 0, ZF - 4.6, -9.2, 3.3, ZF - 4.3, 'intonaco', 'muro');

  conta('vicolo');
  /* --- MARCIAPIEDE NORD: lampioni, vasi, panchina --- */
  for (const x of [-14, 0.2, 14.5]) lampione(B, x, -0.6, MARCIAPIEDE, sensori, mondo);
  const tipiVaso = ['pino', 'cespuglio', 'lavanda', 'limone'];
  const vasiNord = [-29, -23.6, -17.6, -12.2, -6.4, -1.5, 4.0, 9.7, 15.2, 20.4, 26];
  vasiNord.forEach((x, i) => vaso(B, x + rnd.tra(-0.3, 0.3), ZF + 0.42, MARCIAPIEDE, rnd, tipiVaso[i % 4], sensori, mondo));
  for (const x of [-8.4, 18.6]) vaso(B, x, ZF + 0.45, MARCIAPIEDE, rnd, 'cespuglio', sensori, mondo);
  // una cassetta delle lettere rossa
  B.scatola(5.2, 1.3, ZF + 0.12, 0.34, 0.44, 0.2, [0.92, 0.44, 0.42], { r: 0.05 });
  B.scatola(5.2, 1.45, ZF + 0.23, 0.22, 0.03, 0.02, [0.4, 0.3, 0.3]);
  sensori.scatola(5.0, 1.05, ZF, 5.4, 1.55, ZF + 0.25, 'metallo', 'cassetta');

  conta('lampioni e vasi');
  /* --- LATO SUD: muretto, ringhiera, giardino, alberi, panchina --- */
  const zM = 8.75;
  B.scatola(0, 0.4, zM, 130, 0.8, 0.3, C.pietraCalda, { tipo: TIPI.pietre });
  B.scatola(0, 0.83, zM, 130, 0.07, 0.38, C.cornice, { r: 0.02 });
  // ringhiera: solo i pilastrini e il corrimano (le sbarrette sottili, da lontano, diventerebbero "rumore")
  B.scatola(0, 1.5, zM, 130, 0.04, 0.04, C.ferro);
  B.scatola(0, 1.0, zM, 130, 0.025, 0.025, C.ferro);
  for (let x = -60; x < 60; x += 1.2) B.scatola(x, 1.18, zM, 0.05, 0.66, 0.05, C.ferro);
  for (let x = -59.4; x < 60; x += 1.2) B.aggiungi(new THREE.TorusGeometry(0.2, 0.012, 3, 12), matrice(x, 1.25, zM), C.ferro, 0);
  sensori.scatola(-80, 0, zM - 0.2, 80, 1.6, zM + 0.2, 'metallo', 'ringhiera');
  B.scatola(0, 0.2, 13.5, 130, 0.4, 9.4, C.erba, { tipo: TIPI.terra, sx: 30, sz: 4 });
  sensori.scatola(-80, -1, zM + 0.2, 80, 0.4, 18.2, 'foglie', 'prato');
  // siepe dietro il muretto
  const ms = B.segna();
  for (let x = -40; x < 40; x += 0.75) B.batuffolo(x + rnd.tra(-0.2, 0.2), 0.95, zM + 0.75, rnd.tra(0.5, 0.65), rnd.scegli(C.foglie), { tipo: TIPI.foglie, dettaglio: 0, bozzi: 0.15, scala: [1.2, 0.95, 0.9] });
  B.ammorbidisci(ms, new THREE.Vector3(0, 0.6, zM + 0.75), new THREE.Vector3(1e3, 0.7, 0.6), 0.6);
  conta('muretto e siepe');
  const alberiSud = [[-21, 11.5], [-12.5, 12.2], [-4, 11.6], [6.5, 12.4], [15.5, 11.4], [25, 12.2], [-31, 12]];
  alberiSud.forEach(([x, z], i) => albero(B, x, z, 0.4, rnd, sensori, mondo, i === 3 ? { fiori: [0.99, 0.78, 0.84], colori: [[0.98, 0.80, 0.86], [0.96, 0.72, 0.80], [0.99, 0.86, 0.90]] } : {}));
  for (const x of [-7.2, 7.6]) lampione(B, x, 7.3, MARCIAPIEDE, sensori, mondo);
  panchina(B, 1.5, 8.1, MARCIAPIEDE, sensori, mondo);
  panchina(B, -17, 8.1, MARCIAPIEDE, sensori, mondo);
  vaso(B, -2.0, 8.2, MARCIAPIEDE, rnd, 'cespuglio', sensori, mondo);
  vaso(B, 11.0, 8.2, MARCIAPIEDE, rnd, 'pino', sensori, mondo);
  // aiuole di fiori nel giardino
  for (let k = 0; k < 30; k++) {
    const x = rnd.tra(-30, 30), z = rnd.tra(10.2, 15);
    B.sfera(x, 0.45, z, 0.06, rnd.scegli(C.fiori), { tipo: TIPI.foglie, seg: 6, segV: 4 });
  }

  conta('giardino e alberi');
  /* --- IN LONTANANZA: tetti, campanile, colline (si colorano col cielo) --- */
  const colLontani = [C.rosa, C.giallo, C.crema, C.pesca, C.celeste, C.menta, C.rosaChiaro];
  for (let k = 0; k < 26; k++) {                    // tetti dietro le case
    const x = -60 + k * 4.8 + rnd.tra(-1, 1), z = rnd.tra(-17, -24), w = rnd.tra(3.5, 6), h = rnd.tra(9, 15), d = rnd.tra(5, 8);
    L.scatola(x, h / 2, z, w, h, d, rnd.scegli(colLontani), { tipo: TIPI.lontano });
    L.aggiungi(prisma(w + 0.3, 2.0, d + 0.4), matrice(x, h, z), C.tegola, TIPI.lontano);
    if (rnd() < 0.5) for (let f = 0; f < 3; f++) L.scatola(x - w / 2 + 0.8 + f * (w - 1.6) / 2, h - 2, z + d / 2 + 0.02, 0.6, 1.0, 0.05, [0.55, 0.62, 0.7], { tipo: TIPI.lontano });
  }
  // il campanile
  L.scatola(4, 11, -27, 3.2, 22, 3.2, C.crema, { tipo: TIPI.lontano });
  L.scatola(4, 22.2, -27, 3.6, 0.4, 3.6, C.cornice, { tipo: TIPI.lontano });
  L.scatola(4, 23.6, -27, 2.8, 2.6, 2.8, C.pesca, { tipo: TIPI.lontano });
  for (const s of [-1, 1]) L.scatola(4 + s * 0.6, 23.4, -25.58, 0.6, 1.4, 0.05, [0.5, 0.45, 0.45], { tipo: TIPI.lontano });
  L.aggiungi(new THREE.ConeGeometry(2.4, 4, 4), matrice(4, 27, -27, [0, Math.PI / 4, 0]), C.tegola, TIPI.lontano);
  // colline dietro e davanti
  const collina = (x, z, rx, ry, rz, c) => L.sfera(x, -ry * 0.25, z, 1, c, { tipo: TIPI.lontano, scala: [rx, ry, rz], seg: 24, segV: 12 });
  for (let k = 0; k < 7; k++) collina(-150 + k * 50 + rnd.tra(-10, 10), -150 - rnd.tra(0, 40), rnd.tra(45, 70), rnd.tra(35, 50), 30, rnd.scegli(C.colline));
  for (let k = 0; k < 8; k++) collina(-170 + k * 48 + rnd.tra(-10, 10), 110 + rnd.tra(0, 50), rnd.tra(40, 65), rnd.tra(14, 26), 30, rnd.scegli(C.colline));
  // un paesino sulla collina davanti e i cipressi
  for (let k = 0; k < 14; k++) {
    const x = rnd.tra(-40, 10), z = rnd.tra(95, 110), h = rnd.tra(3, 5), w = rnd.tra(2.5, 4);
    L.scatola(x, 10 + h / 2, z, w, h, 3, rnd.scegli(colLontani), { tipo: TIPI.lontano });
    L.aggiungi(prisma(w + 0.3, 1.4, 3.3), matrice(x, 10 + h, z), C.tegola, TIPI.lontano);
  }
  for (let k = 0; k < 22; k++) {
    const x = rnd.tra(-70, 70), z = rnd.tra(30, 70);
    // cipressi: fiammelle verdi
    L.tornio(x, 0, z, [[0, 0], [0.55, 0.3], [0.7, 1.6], [0.55, 3.4], [0.22, 4.8], [0, 5.3]], per(C.foglie[3], 1.08), { seg: 8, tipo: TIPI.lontano });
  }
  // il prato lontano
  L.scatola(0, -0.05, 120, 600, 0.1, 205, C.prato, { tipo: TIPI.lontano, sx: 20, sz: 10 });
  L.scatola(0, -0.08, -120, 600, 0.1, 210, C.prato, { tipo: TIPI.lontano });

  /* --- LE NUVOLE: grappoli di batuffoli con la pancia piatta --- */
  mondo.nuvole = [];
  const nuvole = [[-60, 30, -80], [-10, 36, -100], [40, 27, -75], [90, 33, -95], [-80, 22, 70], [-25, 26, 85], [30, 21, 70], [80, 28, 90]];
  for (const [x, y, z] of nuvole) {
    const m = N.segna(), s = rnd.tra(7, 11);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      N.batuffolo(x + Math.cos(a) * s * rnd.tra(0.4, 1.0), y + rnd.tra(0, 0.6) * s * 0.4, z + Math.sin(a) * s * 0.4, s * rnd.tra(0.35, 0.6), [0.995, 0.99, 0.98], { tipo: TIPI.nuvola, dettaglio: 1, bozzi: 0.15, scala: [1, 0.7, 1] });
    }
    N.batuffolo(x, y + s * 0.3, z, s * 0.65, [1, 1, 1], { tipo: TIPI.nuvola, dettaglio: 2, bozzi: 0.12, scala: [1.2, 0.75, 1] });
    N.ammorbidisci(m, new THREE.Vector3(x, y - s * 0.3, z), new THREE.Vector3(s * 1.4, s * 0.8, s * 1.0), 0.85);
  }

  /* --- tutto insieme: deformazione "fatta a mano" e materiali --- */
  // le case pendono un pochino e i bordi non sono mai perfettamente dritti
  const deforma = (p) => {
    const k = Math.max(0, p.y) / 10;
    p.x += Math.sin(p.y * 0.23 + p.x * 0.41) * 0.09 * k + (rumore3(p.x * 0.7, p.y * 0.7, p.z * 0.7) - 0.5) * 0.025 * Math.min(1, p.y * 2);
    p.z += Math.sin(p.x * 0.53 + p.y * 0.17) * 0.05 * k;
  };
  const mat = materialePigmento();
  const vicino = new THREE.Mesh(B.costruisci(deforma), mat);
  const lontano = new THREE.Mesh(L.costruisci(), mat);
  const cielo = new THREE.Mesh(N.costruisci(), mat);
  for (const m of [vicino, lontano, cielo]) { m.frustumCulled = false; scena.add(m); }
  mondo.meshNuvole = cielo;
  mondo.vertici = vicino.geometry.attributes.position.count + lontano.geometry.attributes.position.count + cielo.geometry.attributes.position.count;

  /* --- le ombre a macchia (tutte in un solo disegno) --- */
  const geoOmbra = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const ombre = new THREE.InstancedMesh(geoOmbra, materialeOmbra(0.75), mondo.ombre.length);
  const mm = new THREE.Matrix4();
  mondo.ombre.forEach(([x, y, z, rx, rz], i) => { mm.compose(new THREE.Vector3(x, y + 0.012, z), new THREE.Quaternion(), new THREE.Vector3(rx, 1, rz)); ombre.setMatrixAt(i, mm); });
  ombre.frustumCulled = false;
  ombre.renderOrder = 1;
  scena.add(ombre);

  /** Altezza del suolo in (x, z): serve ai personaggi per camminare. */
  mondo.altezza = (x, z) => {
    if (z > ZF && z < 0) return MARCIAPIEDE;
    if (z >= 6.4 && z < 8.6) return MARCIAPIEDE;
    if (z >= 8.9) return 0.4;
    return 0;
  };
  mondo.aggiorna = (dt, t) => { cielo.position.x = Math.sin(t * 0.004) * 30; };
  return mondo;
}
