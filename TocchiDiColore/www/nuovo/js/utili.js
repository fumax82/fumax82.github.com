/* ==========================================================================
 *  utili.js — PICCOLI ATTREZZI MATEMATICI
 *  --------------------------------------------------------------------------
 *  Qui ci sono le "cassette degli attrezzi" che usano tutti gli altri file:
 *    - numeri casuali RIPETIBILI (la stessa via a ogni avvio)
 *    - il "rumore" (numeri casuali ma morbidi, come le nuvole)
 *    - le MOLLE: il segreto dei movimenti morbidi (telecamera, capelli,
 *      orecchie, coda...). Una molla insegue un valore senza mai scattare.
 * ========================================================================== */
import * as THREE from 'three';

// I colori di questo motore sono scritti già "come si vedono" (sRGB):
// diciamo a Three.js di non convertirli (così #ffcc88 resta #ffcc88).
THREE.ColorManagement.enabled = false;

export const PI2 = Math.PI * 2;
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
/** passaggio morbido da 0 a 1 quando x va da a a b (come smoothstep negli shader) */
export const morbido = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** differenza fra due angoli, sempre fra -PI e +PI (per girarsi dalla parte giusta) */
export const diffAngolo = (a, b) => { let d = (b - a) % PI2; if (d > Math.PI) d -= PI2; if (d < -Math.PI) d += PI2; return d; };

/* ------------------------------------------------------------------------ */
/*  Numeri casuali ripetibili (algoritmo "mulberry32")                      */
/* ------------------------------------------------------------------------ */
export function generatore(seme) {
  let s = (seme >>> 0) || 1;
  const f = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.tra = (a, b) => a + (b - a) * f();               // numero fra a e b
  f.intero = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.scegli = (lista) => lista[Math.floor(f() * lista.length) % lista.length];
  return f;
}
/** casuale "usa e getta" (diverso a ogni avvio): per gli effetti magici */
export const caso = (a = 0, b = 1) => a + (b - a) * Math.random();
export const scegli = (lista) => lista[Math.floor(Math.random() * lista.length) % lista.length];

/* ------------------------------------------------------------------------ */
/*  Rumore 3D "a valori" (morbido): serve a deformare un po' le forme       */
/* ------------------------------------------------------------------------ */
function hash3(i, j, k) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const liscia = (t) => t * t * (3 - 2 * t);
export function rumore3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = liscia(x - i), fy = liscia(y - j), fz = liscia(z - k);
  const a = lerp(hash3(i, j, k), hash3(i + 1, j, k), fx), b = lerp(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), fx);
  const c = lerp(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), fx), d = lerp(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), fx);
  return lerp(lerp(a, b, fy), lerp(c, d, fy), fz);
}
export const rumore2 = (x, y) => rumore3(x, y, 0.5);

/* ------------------------------------------------------------------------ */
/*  LE MOLLE                                                                 */
/* ------------------------------------------------------------------------ */
/**
 * Molla "critica": arriva al bersaglio nel modo più morbido possibile,
 * senza mai rimbalzare. omega = rapidità (2 = lenta, 8 = svelta).
 * (È la stessa formula del famoso "SmoothDamp" dei videogiochi.)
 */
export class Molla {
  constructor(valore = 0) { this.x = valore; this.v = 0; }
  segui(bersaglio, dt, omega) {
    const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const diff = this.x - bersaglio, tmp = (this.v + omega * diff) * dt;
    this.v = (this.v - omega * tmp) * e;
    this.x = bersaglio + (diff + tmp) * e;
    return this.x;
  }
}

/** La stessa molla critica, ma per un punto nello spazio (x, y, z). */
export class Molla3 {
  constructor(v) { this.x = new Molla(v ? v.x : 0); this.y = new Molla(v ? v.y : 0); this.z = new Molla(v ? v.z : 0); this.valore = new THREE.Vector3().copy(v || new THREE.Vector3()); }
  segui(b, dt, omega) {
    this.valore.set(this.x.segui(b.x, dt, omega), this.y.segui(b.y, dt, omega), this.z.segui(b.z, dt, omega));
    return this.valore;
  }
  salta(v) { this.x.x = v.x; this.y.x = v.y; this.z.x = v.z; this.x.v = this.y.v = this.z.v = 0; this.valore.copy(v); }
}

/**
 * Molla "elastica": rimbalza un po' prima di fermarsi. Perfetta per
 * capelli, orecchie, coda: quando il corpo si muove, loro arrivano
 * "in ritardo" e oscillano (il "movimento secondario" dei cartoni).
 *   rigidezza = quanto tira (alta = svelta), smorzamento = quanto frena
 */
export class Elastico {
  constructor(rigidezza = 80, smorzamento = 8, valore = 0) { this.k = rigidezza; this.d = smorzamento; this.x = valore; this.v = 0; }
  aggiorna(bersaglio, dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;     // piccoli passi: niente "esplosioni"
    for (let i = 0; i < n; i++) {
      const a = this.k * (bersaglio - this.x) - this.d * this.v;
      this.v += a * h; this.x += this.v * h;
    }
    return this.x;
  }
  spinta(velocita) { this.v += velocita; }
}
