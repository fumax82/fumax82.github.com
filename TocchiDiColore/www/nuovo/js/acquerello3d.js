/* ==========================================================================
 *  acquerello3d.js — IL PITTORE AD ACQUERELLO
 *  --------------------------------------------------------------------------
 *  Questo file trasforma un mondo 3D "vero" in un dipinto ad acquerello.
 *  Lo fa in due tempi, come un pittore:
 *
 *  1. LE VELATURE (i "materiali", uno shader per ogni oggetto):
 *     - la luce non è sfumata come in un videogioco, ma divisa in 2–3
 *       "toni di pigmento" (luce, mezzo, ombra) con passaggi morbidi;
 *     - l'ombra è una velatura fredda (azzurro-viola), come fanno i pittori;
 *     - il colore non è mai uniforme: un "rumore" attaccato al mondo crea
 *       macchie, zone più cariche e più leggere (pennellate);
 *     - la MAPPA DELLE SCOPERTE dice cosa è già stato dipinto: il resto è
 *       carta bianca (con lo schizzo a matita, aggiunto al punto 2).
 *     Ogni oggetto scrive DUE immagini: il colore e i "dati" (da che parte
 *     guarda la superficie e quanto è lontana) che servono al punto 2.
 *
 *  2. LA RIFINITURA (un filtro su tutto lo schermo):
 *     - le LINEE A INCHIOSTRO marrone dove la profondità o la direzione
 *       delle superfici cambiano di colpo (contorni e spigoli), un po'
 *       tremolanti come fatte a mano; dove il mondo è ancora bianco sono
 *       tratti di MATITA grigia;
 *     - i BORDI BAGNATI: dove un colore finisce, il pigmento si accumula;
 *     - le SBAVATURE: il colore "scivola" un poco (campionato con rumore);
 *     - la GRANA della carta e la GRANULAZIONE del pigmento nelle ombre;
 *     - un BAGLIORE morbido attorno alle luci magiche;
 *     - la SFOCATURA delle cose lontane (profondità di campo);
 *     - i bordi dello schermo che sfumano nella carta.
 * ========================================================================== */
import * as THREE from 'three';
import { generatore, clamp, lerp } from './utili.js';

/* ------------------------------------------------------------------------ */
/*  I colori del pittore                                                     */
/* ------------------------------------------------------------------------ */
export const COLORI = {
  carta: [0.985, 0.968, 0.93],        // la carta da acquerello (bianco caldo)
  inchiostro: [0.40, 0.27, 0.21],     // le linee: marrone caldo
  matita: [0.50, 0.49, 0.50],         // lo schizzo: grafite
  nebbia: [0.92, 0.93, 0.93],         // la foschia delle cose lontane
};

/* ------------------------------------------------------------------------ */
/*  I "cassetti" condivisi da tutti i materiali (uniform)                     */
/*  Cambiando un valore qui, cambia per tutti gli oggetti insieme.           */
/* ------------------------------------------------------------------------ */
export const U = {
  uTempo: { value: 0 },
  uSole: { value: new THREE.Vector3(-0.42, 0.72, 0.56).normalize() },
  uCarta: { value: new THREE.Vector3(...COLORI.carta) },
  uNebbia: { value: new THREE.Vector3(...COLORI.nebbia) },
  tRumore: { value: null },
  tCarta: { value: null },
  tRivela: { value: null },          // mappa delle scoperte (vista dall'alto)
  uArea: { value: new THREE.Vector4(-32, -14, 1 / 64, 1 / 32) },
  tCielo: { value: null },           // scoperte del cielo (mappa a "mappamondo")
  uCielo: { value: 0 },              // quanto cielo è dipinto in tutto (0..1)
  uCentro: { value: new THREE.Vector3(0, 2, 0) },
  uFar: { value: 400 },
  uVento: { value: 1 },
  uScalaPunti: { value: 500 },
  uPassoLuce: { value: 0 },
};

/* ------------------------------------------------------------------------ */
/*  TEXTURE FATTE DAL CODICE: rumore e carta                                 */
/* ------------------------------------------------------------------------ */
const liscia = (t) => t * t * (3 - 2 * t);
/** Rumore "che si ripete senza cuciture" (tileable) su un quadrato N×N, con P celle per lato. */
function rumoreTile(N, P, rnd) {
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const cella = N / P;
  return (x, y) => {
    const fx = x / cella, fy = y / cella, i = Math.floor(fx), j = Math.floor(fy);
    const tx = liscia(fx - i), ty = liscia(fy - j);
    const i0 = ((i % P) + P) % P, j0 = ((j % P) + P) % P, i1 = (i0 + 1) % P, j1 = (j0 + 1) % P;
    return lerp(lerp(g[j0 * P + i0], g[j0 * P + i1], tx), lerp(g[j1 * P + i0], g[j1 * P + i1], tx), ty);
  };
}
function fbmTile(N, periodi, rnd) {
  const ott = periodi.map((P) => rumoreTile(N, P, rnd));
  return (x, y) => { let s = 0, a = 1, t = 0; for (const f of ott) { s += f(x, y) * a; t += a; a *= 0.55; } return s / t; };
}
const contrasto = (v, k) => clamp((v - 0.5) * k + 0.5, 0, 1);

export function creaTexture() {
  const rnd = generatore(4242);
  // --- RUMORE 256×256: 4 canali a frequenze diverse (macchie del pigmento) ---
  const N = 256, dati = new Uint8Array(N * N * 4);
  const f = [fbmTile(N, [4, 8, 16, 32], rnd), fbmTile(N, [8, 16, 32, 64], rnd), fbmTile(N, [16, 32, 64, 128], rnd), fbmTile(N, [4, 16, 64], rnd)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    for (let c = 0; c < 4; c++) dati[i + c] = Math.round(contrasto(f[c](x, y), 2.2) * 255);
  }
  const rumore = new THREE.DataTexture(dati, N, N, THREE.RGBAFormat);
  rumore.wrapS = rumore.wrapT = THREE.RepeatWrapping;
  rumore.magFilter = THREE.LinearFilter; rumore.minFilter = THREE.LinearMipmapLinearFilter; rumore.generateMipmaps = true;
  rumore.needsUpdate = true;

  // --- CARTA 512×512: R = rilievo, G = granulazione, B = fibre ---
  const M = 512, carta = new Uint8Array(M * M * 4);
  const rilievo = fbmTile(M, [16, 32, 64], rnd), fine = fbmTile(M, [128, 256], rnd), grana = fbmTile(M, [64, 256], rnd);
  const fibre = new Float32Array(M * M);
  for (let k = 0; k < 700; k++) {           // fibre: piccoli filamenti curvi
    let x = rnd() * M, y = rnd() * M, a = rnd() * Math.PI * 2;
    const lung = 8 + rnd() * 40, forza = 0.3 + rnd() * 0.7;
    for (let s = 0; s < lung; s++) {
      a += (rnd() - 0.5) * 0.3; x += Math.cos(a); y += Math.sin(a);
      const xi = ((Math.round(x) % M) + M) % M, yi = ((Math.round(y) % M) + M) % M;
      fibre[yi * M + xi] = Math.min(1, fibre[yi * M + xi] + forza);
    }
  }
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const i = (y * M + x) * 4;
    const h = rilievo(x, y) * 0.55 + fine(x, y) * 0.45;
    carta[i] = Math.round(contrasto(h, 2.6) * 255);
    carta[i + 1] = Math.round(contrasto(grana(x, y) * 0.6 + h * 0.4, 3.2) * 255);
    carta[i + 2] = Math.round(fibre[y * M + x] * 255);
    carta[i + 3] = 255;
  }
  const tCarta = new THREE.DataTexture(carta, M, M, THREE.RGBAFormat);
  tCarta.wrapS = tCarta.wrapT = THREE.RepeatWrapping;
  tCarta.magFilter = THREE.LinearFilter; tCarta.minFilter = THREE.LinearFilter;
  tCarta.needsUpdate = true;
  U.tRumore.value = rumore; U.tCarta.value = tCarta;
}

/* ------------------------------------------------------------------------ */
/*  LA MAPPA DELLE SCOPERTE                                                  */
/*  Un'immagine piccola vista dall'alto (1 pixel = 25 cm di strada).         */
/*  Canali: R = quanto è dipinto (0..1, cresce dietro l'onda)                 */
/*          G = quanto è ancora bagnato (la cresta luminosa, poi asciuga)     */
/*          B = la tinta della cresta (ogni tocco ha il suo colore)           */
/* ------------------------------------------------------------------------ */
export class Rivelazione {
  constructor(xmin = -32, zmin = -14, larghezza = 64, profondita = 32, nx = 256, nz = 128) {
    Object.assign(this, { xmin, zmin, larghezza, profondita, nx, nz });
    this.dati = new Uint8Array(nx * nz * 4);
    this.tex = new THREE.DataTexture(this.dati, nx, nz, THREE.RGBAFormat);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    U.tRivela.value = this.tex;
    U.uArea.value.set(xmin, zmin, 1 / larghezza, 1 / profondita);
    this.onde = [];
    this.bagnato = false;
    this.cambiato = false;
    this.RAMPA = 6;          // metri: dietro la cresta il colore "sale" anche sui muri alti
    this.dipinti = 0;        // quanti pixel sono dipinti (per sapere quanto manca)
  }
  /** Una nuova onda di colore che parte da (x, z). */
  onda(x, z, raggio, velocita = 6, tinta = Math.random()) {
    const forma = Array.from({ length: 24 }, () => Math.random());   // l'onda non è un cerchio perfetto
    const o = { x, z, r: 0, R: raggio, v: velocita, tinta, forma, fine: false };
    this.onde.push(o);
    return o;
  }
  valore(x, z) {
    const i = Math.floor((x - this.xmin) / this.larghezza * this.nx), j = Math.floor((z - this.zmin) / this.profondita * this.nz);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return 0;
    return this.dati[(j * this.nx + i) * 4] / 255;
  }
  frazione() { return this.dipinti / (this.nx * this.nz); }
  rivelaTutto() {
    for (let i = 0; i < this.dati.length; i += 4) { this.dati[i] = 255; this.dati[i + 1] = 0; }
    this.dipinti = this.nx * this.nz; this.tex.needsUpdate = true;
  }
  aggiorna(dt) {
    for (const o of this.onde) {
      const prima = o.r;
      // l'onda rallenta alla fine, come l'acqua che si allarga sulla carta
      const limite = o.R + Math.min(this.RAMPA * 0.6, o.R);
      o.r = Math.min(limite, o.r + o.v * dt * (1.15 - 0.75 * Math.min(1, o.r / o.R)));
      if (o.r !== prima) this._dipingi(o);
      if (o.r >= limite - 1e-3) o.fine = true;
    }
    this.onde = this.onde.filter((o) => !o.fine);
    if (this.bagnato) {                       // la carta asciuga piano piano
      const k = Math.exp(-dt * 0.9);
      let ancora = false;
      for (let i = 1; i < this.dati.length; i += 4) if (this.dati[i]) { this.dati[i] = Math.floor(this.dati[i] * k); ancora = true; }
      this.bagnato = ancora; this.cambiato = true;
    }
    if (this.cambiato) { this.tex.needsUpdate = true; this.cambiato = false; }
  }
  _dipingi(o) {
    const { nx, nz, dati } = this, sx = this.larghezza / nx, sz = this.profondita / nz;
    const ext = Math.min(o.r, o.R) + 1.5;
    const i0 = Math.max(0, Math.floor((o.x - ext - this.xmin) / sx)), i1 = Math.min(nx - 1, Math.ceil((o.x + ext - this.xmin) / sx));
    const j0 = Math.max(0, Math.floor((o.z - ext - this.zmin) / sz)), j1 = Math.min(nz - 1, Math.ceil((o.z + ext - this.zmin) / sz));
    const R = this.RAMPA, F = o.forma, nF = F.length, tinta = Math.round(o.tinta * 255);
    for (let j = j0; j <= j1; j++) {
      const z = this.zmin + (j + 0.5) * sz, dz = z - o.z;
      for (let i = i0; i <= i1; i++) {
        const x = this.xmin + (i + 0.5) * sx, dx = x - o.x;
        let d = Math.sqrt(dx * dx + dz * dz);
        // bordo irregolare: il raggio cambia con la direzione (macchia d'acqua)
        const a = (Math.atan2(dz, dx) / (Math.PI * 2) + 0.5) * nF, k = Math.floor(a), t = a - k;
        const irr = lerp(F[k % nF], F[(k + 1) % nF], t * t * (3 - 2 * t));
        d *= 1 + (irr - 0.5) * 0.35;
        if (d > o.R) continue;                       // oltre il raggio massimo non si dipinge
        const dentro = o.r - d;
        if (dentro <= 0) continue;
        // le onde piccole (i colpetti del bastone) colorano solo in basso
        const v = Math.min(255, Math.round(Math.min(1, dentro / R) * 255 * Math.pow(Math.min(1, o.R / 7), 1.2)));
        const p = (j * nx + i) * 4;
        if (v > dati[p]) { if (dati[p] < 128 && v >= 128) this.dipinti++; dati[p] = v; }
        if (dentro < 1.6 && o.r <= o.R + 0.5) {     // la cresta bagnata
          const w = Math.round(255 * (1 - dentro / 1.6) * 0.9 + 25);
          if (w > dati[p + 1]) { dati[p + 1] = w; dati[p + 2] = tinta; }
          this.bagnato = true;
        }
      }
    }
    this.cambiato = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  Le scoperte del CIELO: una mappa a "mappamondo" (direzioni)              */
/* ------------------------------------------------------------------------ */
export class RivelazioneCielo {
  constructor(nx = 128, ny = 64) {
    this.nx = nx; this.ny = ny;
    this.dati = new Uint8Array(nx * ny * 4);
    this.tex = new THREE.DataTexture(this.dati, nx, ny, THREE.RGBAFormat);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = THREE.RepeatWrapping;
    this.tex.needsUpdate = true;
    U.tCielo.value = this.tex;
    this.macchie = [];
    this.bagnato = false;
    this.dir = [];            // la direzione di ogni pixel (calcolata una volta)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const az = ((i + 0.5) / nx - 0.5) * Math.PI * 2, el = ((j + 0.5) / ny) * Math.PI - Math.PI / 2;
      this.dir.push(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
    }
  }
  /** Una macchia di cielo dipinto nella direzione d (vettore), grande "angolo" radianti. */
  macchia(d, angolo = 0.6, tinta = Math.random()) {
    const v = new THREE.Vector3().copy(d).normalize();
    this.macchie.push({ d: v, r: 0, R: angolo, tinta, forma: Array.from({ length: 16 }, () => Math.random()) });
  }
  aggiorna(dt) {
    let cambiato = false;
    for (const m of this.macchie) {
      m.r = Math.min(m.R + 0.3, m.r + dt * 0.9 * (1.1 - 0.7 * Math.min(1, m.r / m.R)));
      const { nx, ny, dati, dir } = this;
      const T = Math.round(m.tinta * 255);
      for (let p = 0, q = 0; p < nx * ny; p++, q += 3) {
        const c = dir[q] * m.d.x + dir[q + 1] * m.d.y + dir[q + 2] * m.d.z;
        if (c < 0.2) continue;
        let ang = Math.acos(Math.min(1, c));
        const a = Math.atan2(dir[q + 1] - m.d.y, dir[q] - m.d.x + dir[q + 2] - m.d.z);
        const s = ((a / (Math.PI * 2) + 0.5) * 16) | 0;
        ang *= 1 + (m.forma[s % 16] - 0.5) * 0.4;
        const dentro = Math.min(m.r, m.R) - ang;
        if (dentro <= 0) continue;
        const v = Math.min(255, Math.round(Math.min(1, dentro / 0.25) * 255));
        if (v > dati[p * 4]) dati[p * 4] = v;
        if (dentro < 0.12 && m.r < m.R) { const w = Math.round(255 * (1 - dentro / 0.12)); if (w > dati[p * 4 + 1]) { dati[p * 4 + 1] = w; dati[p * 4 + 2] = T; } this.bagnato = true; }
        cambiato = true;
      }
    }
    this.macchie = this.macchie.filter((m) => m.r < m.R + 0.3);
    if (this.bagnato) {
      const k = Math.exp(-dt * 0.8); let ancora = false;
      for (let i = 1; i < this.dati.length; i += 4) if (this.dati[i]) { this.dati[i] = Math.floor(this.dati[i] * k); ancora = true; }
      this.bagnato = ancora; cambiato = true;
    }
    if (cambiato) this.tex.needsUpdate = true;
  }
  rivelaTutto() { for (let i = 0; i < this.dati.length; i += 4) this.dati[i] = 255; this.tex.needsUpdate = true; }
}

/* ------------------------------------------------------------------------ */
/*  PEZZI DI SHADER IN COMUNE                                                */
/* ------------------------------------------------------------------------ */
const GLSL_COMUNE = /* glsl */ `
  // la profondità (0..1) divisa in due "byte" (per non perdere precisione)
  vec2 impacchettaProf(float d) {
    float v = floor(clamp(d, 0.0, 1.0) * 65535.0);
    float hi = floor(v / 256.0);
    return vec2(hi / 255.0, (v - hi * 256.0) / 255.0);
  }
  // una tinta dell'arcobaleno (h da 0 a 1), in versione pastello
  vec3 tinta(float h) {
    vec3 c = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return mix(vec3(1.0), c, 0.55);
  }
  // quanto il cielo (o una cosa lontana) è dipinto, guardando in direzione d
  float cieloDipinto(vec3 d, sampler2D mappa, out vec4 m) {
    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    m = texture(mappa, uv);
    return m.r;
  }
`;

/* ------------------------------------------------------------------------ */
/*  1. IL MATERIALE "PIGMENTO" (per tutto il mondo e i personaggi)           */
/* ------------------------------------------------------------------------ */
const VERT_PIGMENTO = /* glsl */ `
  in vec2 aInfo;
  uniform float uTempo;
  uniform float uVento;
  out vec3 vPos;
  out vec3 vNor;
  out vec3 vCol;
  out vec2 vInfo;
  out float vProf;
  out vec3 vNorV;
  void main() {
    vec3 col = vec3(1.0);
    #ifdef USE_COLOR
      col = color;
    #endif
    #ifdef USE_INSTANCING_COLOR
      col *= instanceColor;
    #endif
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = m * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vec3 wn = normalize(mat3(m) * normal);
    // le FOGLIE ondeggiano nel vento (più in alto = più movimento)
    if (abs(aInfo.x - 2.0) < 0.5) {
      float k = uVento * (0.012 + 0.006 * max(wp.y, 0.0));
      float f = uTempo * 1.6 + wp.x * 0.35 + wp.z * 0.21;
      wp.x += sin(f) * k;
      wp.z += sin(f * 1.3 + 1.7) * k * 0.6;
      wp.y += sin(f * 2.1) * k * 0.25;
    }
    vPos = wp.xyz;
    vNor = wn;
    vCol = col;
    vInfo = aInfo;
    vec4 vp = viewMatrix * wp;
    vProf = -vp.z;
    vNorV = mat3(viewMatrix) * wn;
    gl_Position = projectionMatrix * vp;
  }
`;

const FRAG_PIGMENTO = /* glsl */ `
  precision highp float;
  uniform sampler2D tRumore;
  uniform sampler2D tRivela;
  uniform sampler2D tCielo;
  uniform vec4 uArea;
  uniform vec3 uSole;
  uniform vec3 uCarta;
  uniform vec3 uNebbia;
  uniform vec3 uCentro;
  uniform float uCielo;
  uniform float uFar;
  in vec3 vPos;
  in vec3 vNor;
  in vec3 vCol;
  in vec2 vInfo;
  in float vProf;
  in vec3 vNorV;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  ${GLSL_COMUNE}

  void main() {
    int tipo = int(vInfo.x + 0.5);
    vec3 n = normalize(vNor);
    vec3 nv = normalize(vNorV);
    #ifdef DOPPIO
      if (!gl_FrontFacing) { n = -n; nv = -nv; }
    #endif

    // --- 1. le macchie del pigmento, "attaccate" al mondo ---
    vec3 an = abs(n);
    vec2 uvM = an.y > max(an.x, an.z) ? vPos.xz : (an.x > an.z ? vPos.zy : vPos.xy);
    vec4 r1 = texture(tRumore, uvM * 0.071 + vInfo.y * 0.37);
    vec4 r2 = texture(tRumore, uvM * 0.29 + 0.5);
    float w = r1.r * 0.6 + r2.g * 0.4;      // macchia larga
    float wf = r2.b;                        // macchia fine

    // --- 2. la luce, divisa in toni di pigmento ---
    float luce = dot(n, uSole) * 0.5 + 0.5;           // luce "avvolgente" (mai nero)
    luce = luce * 0.82 + n.y * 0.12 + 0.06;           // un po' di luce dal cielo
    #ifndef PERSONAGGIO
      if (tipo != 3 && tipo != 9) luce *= mix(0.8, 1.0, smoothstep(0.0, 1.2, vPos.y));   // piede dei muri
    #endif
    #ifdef PERSONAGGIO
      // i personaggi: ombre più piccole e calde (la pelle non deve sembrare livida)
      float s1 = smoothstep(0.30, 0.40, luce + (w - 0.5) * 0.15);
      float s2 = smoothstep(0.70, 0.80, luce + (w - 0.5) * 0.12);
    #else
      float s1 = smoothstep(0.40, 0.50, luce + (w - 0.5) * 0.25);   // ombra → mezzo tono
      float s2 = smoothstep(0.76, 0.85, luce + (w - 0.5) * 0.20);   // mezzo tono → luce
    #endif

    // --- 3. i colori del pigmento ---
    vec3 base = vCol * (0.94 + w * 0.12);
    base += (r1.gba - 0.5) * 0.05;                                 // la tinta "respira"
    if (tipo >= 7 && tipo <= 9) {
      // MATTONI (7), PIETRE squadrate (8), LASTRE del marciapiede (9):
      // il disegno delle fughe è dipinto qui, con un tratto un po' storto
      vec2 dim = tipo == 7 ? vec2(0.25, 0.085) : (tipo == 8 ? vec2(0.44, 0.30) : vec2(1.05, 0.74));
      vec2 bb = uvM / dim;
      if (tipo != 9) bb.x += mod(floor(bb.y), 2.0) * 0.5;
      else bb.x += mod(floor(bb.y), 2.0) * 0.37;
      vec2 id = floor(bb), f = fract(bb);
      float h = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
      base *= 0.9 + h * 0.17;
      float dist = min(min(f.x, 1.0 - f.x) * dim.x, min(f.y, 1.0 - f.y) * dim.y);
      float spess = tipo == 9 ? 0.016 : 0.009;
      float malta = 1.0 - smoothstep(spess * 0.6, spess * 1.5, dist + (r2.r - 0.5) * spess);
      base = mix(base, base * vec3(0.62, 0.54, 0.52), malta * 0.75);
    }
    #ifdef PERSONAGGIO
      vec3 ombra = base * mix(vec3(0.86, 0.78, 0.84), vec3(0.90, 0.80, 0.80), wf);   // velatura calda
    #else
      vec3 ombra = base * mix(vec3(0.70, 0.70, 0.88), vec3(0.82, 0.73, 0.82), wf);  // velatura fredda
    #endif
    vec3 chiaro = mix(base, vec3(1.0, 0.985, 0.94), 0.2);         // più acqua, meno pigmento
    vec3 col = mix(ombra, base, s1);
    col = mix(col, chiaro, s2);
    if (tipo == 1) {        // VETRO: il cielo riflesso e una striscia di luce
      // due strisce di luce diagonali (il "luccichio" dei vetri nei cartoni)
      float diag = fract((vPos.x * 0.6 + vPos.y * 0.75) * 0.9 + w * 0.12);
      float rifl = smoothstep(0.02, 0.05, diag) * (1.0 - smoothstep(0.13, 0.16, diag)) + smoothstep(0.22, 0.24, diag) * (1.0 - smoothstep(0.26, 0.28, diag));
      vec3 cielo = mix(vec3(0.52, 0.66, 0.80), vec3(0.80, 0.89, 0.95), smoothstep(-0.2, 0.9, w + nv.y * 0.3));
      col = mix(cielo * (0.82 + 0.18 * s1), vec3(0.97, 0.98, 1.0), rifl * 0.65);
    }
    if (tipo == 6) col = mix(vCol, vec3(1.0, 0.98, 0.88), 0.35);   // vetro dei lampioni

    // --- 4. la MAPPA DELLE SCOPERTE: dipinto o ancora carta? ---
    float riv = 1.0;
    float fronte = 0.0;
    vec3 tintaFronte = vec3(1.0);
    #ifndef SEMPRE
      if (tipo == 4 || tipo == 5) {
        vec4 mc;
        float c = max(uCielo, cieloDipinto(normalize(vPos - uCentro), tCielo, mc));
        riv = smoothstep(w * 0.45, w * 0.45 + 0.12, c);
        fronte = mc.g * riv;
        tintaFronte = tinta(mc.b);
      } else {
        vec4 m = texture(tRivela, (vPos.xz - uArea.xy) * uArea.zw);
        // il colore sale sui muri un po' dopo la cresta (più in alto = più tardi)
        float soglia = 0.035 + max(vPos.y, 0.0) * 0.042 + (w - 0.5) * 0.16 + (wf - 0.5) * 0.06;
        float dentro = m.r - soglia;
        riv = smoothstep(0.0, 0.04, dentro);
        fronte = m.g * smoothstep(-0.01, 0.02, dentro) * (1.0 - smoothstep(0.03, 0.22, dentro));
        tintaFronte = tinta(m.b);
        // il bordo della pennellata asciuga più scuro (come l'acquerello vero)
        float orlo = smoothstep(0.0, 0.012, dentro) * (1.0 - smoothstep(0.015, 0.06, dentro));
        col *= 1.0 - 0.16 * orlo;
        // appena steso, il colore bagnato è più intenso
        col = mix(col, col * col * 1.1, m.g * 0.3);
      }
    #endif

    // --- 5. la foschia: le cose lontane si fanno chiare e azzurrine ---
    float dist = length(vPos - cameraPosition);
    float neb = smoothstep(16.0, 150.0, dist) * 0.78;
    if (tipo == 5) neb = max(neb, 0.3);
    if (tipo == 4) neb *= 0.25;                     // le nuvole restano ben visibili
    col = mix(col, uNebbia, neb);

    col = mix(uCarta, col, riv);
    // la cresta bagnata: un orlo colorato (ogni tocco ha la sua tinta) che luccica
    col = mix(col, tintaFronte * 1.08, fronte * 0.38) + fronte * vec3(0.16, 0.14, 0.1);

    #ifdef PERSONAGGIO
      oColore = vec4(col, 1.0);
    #else
      oColore = vec4(col, riv * 0.8);
    #endif
    oDati = vec4(nv.xy * 0.5 + 0.5, impacchettaProf(vProf / uFar));
  }
`;

/** Crea un materiale "pigmento". opz: { sempre (sempre colorato), doppio (due facce), personaggio } */
export function materialePigmento(opz = {}) {
  const defines = {};
  if (opz.sempre || opz.personaggio) defines.SEMPRE = '';
  if (opz.doppio) defines.DOPPIO = '';
  if (opz.personaggio) defines.PERSONAGGIO = '';
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines,
    uniforms: {
      uTempo: U.uTempo, uVento: U.uVento, tRumore: U.tRumore, tRivela: U.tRivela, tCielo: U.tCielo, uArea: U.uArea,
      uSole: U.uSole, uCarta: U.uCarta, uNebbia: U.uNebbia, uCentro: U.uCentro, uCielo: U.uCielo, uFar: U.uFar,
    },
    vertexShader: VERT_PIGMENTO,
    fragmentShader: FRAG_PIGMENTO,
    vertexColors: true,
    side: opz.doppio ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.defaultAttributeValues = { color: [1, 1, 1], aInfo: [0, 0.5] };
  return m;
}

/* ------------------------------------------------------------------------ */
/*  2. IL CIELO (una grande cupola attorno alla telecamera)                  */
/* ------------------------------------------------------------------------ */
const VERT_CIELO = /* glsl */ `
  out vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAG_CIELO = /* glsl */ `
  precision highp float;
  uniform sampler2D tRumore;
  uniform sampler2D tCielo;
  uniform vec3 uCarta;
  uniform vec3 uSole;
  uniform float uCielo;
  uniform float uTempo;
  in vec3 vDir;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  ${GLSL_COMUNE}
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec2 uvc = d.xz / (abs(d.y) + 0.3);
    vec4 r = texture(tRumore, uvc * 0.16 + vec2(uTempo * 0.002, 0.0));
    vec4 r2 = texture(tRumore, uvc * 0.55 + 0.31);
    float t = smoothstep(-0.05, 0.6, h + (r.r - 0.5) * 0.22);
    vec3 basso = vec3(0.99, 0.92, 0.84);     // vicino all'orizzonte: crema rosato
    vec3 mezzo = vec3(0.78, 0.88, 0.95);
    vec3 alto = vec3(0.56, 0.74, 0.90);      // in alto: azzurro pieno
    vec3 col = mix(basso, mezzo, smoothstep(0.0, 0.35, t));
    col = mix(col, alto, smoothstep(0.35, 1.0, t));
    // velature: zone più chiare e più cariche, come un cielo bagnato
    col = mix(col, vec3(0.97, 0.965, 0.95), smoothstep(0.55, 0.85, r.g) * 0.45 * smoothstep(0.02, 0.3, h));
    col *= 0.96 + r2.b * 0.08;
    // un alone caldo dalla parte del sole
    float s = max(0.0, dot(d, normalize(vec3(uSole.x, 0.15, uSole.z))));
    col = mix(col, vec3(1.0, 0.93, 0.82), pow(s, 6.0) * 0.35);
    vec4 m;
    float c = max(uCielo, cieloDipinto(d, tCielo, m));
    float riv = smoothstep(r2.b * 0.4, r2.b * 0.4 + 0.12, c);
    col = mix(uCarta, col, riv);
    col += m.g * riv * mix(tinta(m.b), vec3(1.0), 0.4) * 0.35;
    oColore = vec4(col, riv * 0.8);
    oDati = vec4(0.5, 0.5, 1.0, 1.0);       // lontanissimo
  }
`;
export function creaCielo() {
  const m = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tRumore: U.tRumore, tCielo: U.tCielo, uCarta: U.uCarta, uSole: U.uSole, uCielo: U.uCielo, uTempo: U.uTempo },
    vertexShader: VERT_CIELO, fragmentShader: FRAG_CIELO,
    side: THREE.BackSide, depthWrite: false,
  });
  const cupola = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), m);
  cupola.renderOrder = -10;
  cupola.frustumCulled = false;
  return cupola;
}

/* ------------------------------------------------------------------------ */
/*  3. SCINTILLE, STELLINE, CUORI (punti disegnati dallo shader)             */
/* ------------------------------------------------------------------------ */
const VERT_PUNTI = /* glsl */ `
  in vec4 aColore;      // colore + opacità
  in vec3 aExtra;       // x = grandezza (metri), y = forma, z = rotazione
  uniform float uScalaPunti;
  uniform float uPassoLuce;
  out vec4 vColore;
  out vec2 vForma;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float s = aExtra.x * uScalaPunti / max(0.15, -mv.z);
    if (uPassoLuce > 0.5) s *= 3.2;
    gl_PointSize = clamp(s, 0.0, 200.0);
    vColore = aColore;
    vForma = aExtra.yz;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG_PUNTI = /* glsl */ `
  precision highp float;
  uniform float uPassoLuce;
  in vec4 vColore;
  in vec2 vForma;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    p.y = -p.y;
    float r = length(p);
    if (uPassoLuce > 0.5) {                 // nel passo "luce": solo un alone tondo
      float g = exp(-r * r * 3.5) * vColore.a;
      oColore = vec4(vColore.rgb * g, g);
      oDati = vec4(0.0);
      return;
    }
    float cs = cos(vForma.y), sn = sin(vForma.y);
    vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
    int forma = int(vForma.x + 0.5);
    float d;                                // d < 0 dentro la forma, > 0 fuori
    if (forma == 1) {                       // stellina a 5 punte (punte tonde)
      float a = atan(q.y, q.x);
      float bordo = 0.42 + 0.5 * pow(abs(cos(2.5 * (a - 1.5708))), 2.2);
      d = (length(q) - bordo) / 0.9;
    } else if (forma == 2) {                // cuoricino
      vec2 h = q * 1.25; h.y += 0.25;
      float f = pow(h.x * h.x + h.y * h.y - 1.0, 3.0) - h.x * h.x * h.y * h.y * h.y;
      d = f * 1.3;
    } else if (forma == 3) {                // anello
      d = (abs(r - 0.7) - 0.16) / 0.9;
    } else if (forma == 4) {                // petalo / foglietta
      d = length(q * vec2(2.1, 1.0)) - 0.9;
    } else {                                // puntino morbido
      d = r - 0.75;
    }
    float dentro = 1.0 - smoothstep(-0.04, 0.04, d);
    if (dentro < 0.01) discard;
    vec3 col = vColore.rgb;
    col = mix(col, vec3(1.0, 0.99, 0.95), smoothstep(-0.05, -0.6, d) * 0.55);         // cuore chiaro
    col = mix(col, col * vec3(0.62, 0.52, 0.48), smoothstep(-0.16, -0.02, d) * 0.85); // contorno a inchiostro
    oColore = vec4(col, dentro * vColore.a);
    oDati = vec4(0.0);
  }
`;
export function materialePunti() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uScalaPunti: U.uScalaPunti, uPassoLuce: U.uPassoLuce },
    vertexShader: VERT_PUNTI, fragmentShader: FRAG_PUNTI,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}

/* ------------------------------------------------------------------------ */
/*  4. LE BOLLE DI SAPONE (iridescenti, trasparenti)                         */
/* ------------------------------------------------------------------------ */
const VERT_BOLLA = /* glsl */ `
  out vec3 vN;
  out vec3 vV;
  out float vFase;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = m * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vN = normalize(mat3(m) * normal);
    vV = cameraPosition - wp.xyz;
    vFase = m[3].x * 0.3 + m[3].z * 0.2;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAG_BOLLA = /* glsl */ `
  precision highp float;
  uniform float uTempo;
  in vec3 vN;
  in vec3 vV;
  in float vFase;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  ${GLSL_COMUNE}
  void main() {
    vec3 n = normalize(vN), v = normalize(vV);
    float f = 1.0 - abs(dot(n, v));
    vec3 iri = tinta(f * 1.4 + n.y * 0.35 + uTempo * 0.12 + vFase);
    vec3 col = mix(vec3(1.0), iri, 0.6);
    float a = 0.04 + pow(f, 2.5) * 0.45;
    vec3 L = normalize(vec3(-0.4, 0.85, 0.5));
    float sp = pow(max(dot(reflect(-v, n), L), 0.0), 36.0);
    col = mix(col, vec3(1.0), sp);
    a = max(a, sp * 0.95);
    float orlo = smoothstep(0.86, 0.96, f);
    col = mix(col, vec3(0.42, 0.50, 0.66), orlo * 0.75);
    a = max(a, orlo * 0.8);
    oColore = vec4(col, a);
    oDati = vec4(0.0);
  }
`;
export function materialeBolle() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uTempo: U.uTempo },
    vertexShader: VERT_BOLLA, fragmentShader: FRAG_BOLLA,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}

/* ------------------------------------------------------------------------ */
/*  5. LE OMBRE "A MACCHIA" sotto personaggi, alberi, lampioni               */
/*  (una velatura lilla morbida: moltiplica il colore che c'è sotto)         */
/* ------------------------------------------------------------------------ */
const VERT_OMBRA = /* glsl */ `
  out vec2 vUv;
  out vec3 vPos;
  out float vForza;
  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = m * instanceMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vUv = uv * 2.0 - 1.0;
    vPos = wp.xyz;
    vForza = 1.0;
    #ifdef USE_INSTANCING_COLOR
      vForza = instanceColor.r;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const FRAG_OMBRA = /* glsl */ `
  precision highp float;
  uniform sampler2D tRumore;
  uniform sampler2D tRivela;
  uniform vec4 uArea;
  uniform float uForza;
  in vec2 vUv;
  in vec3 vPos;
  in float vForza;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  void main() {
    float n = texture(tRumore, vPos.xz * 0.6).g;
    float r = length(vUv) + (n - 0.5) * 0.25;
    float a = (1.0 - smoothstep(0.45, 1.0, r)) * uForza * vForza;
    float riv = texture(tRivela, (vPos.xz - uArea.xy) * uArea.zw).r;
    #ifdef SEMPRE
      riv = max(riv, 0.35);
    #endif
    a *= smoothstep(0.02, 0.2, riv);
    vec3 tintaOmbra = vec3(0.70, 0.68, 0.86);
    oColore = vec4(mix(vec3(1.0), tintaOmbra, a), 1.0);
    oDati = vec4(1.0);
  }
`;
export function materialeOmbra(forza = 0.8, sempre = false) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    defines: sempre ? { SEMPRE: '' } : {},
    uniforms: { tRumore: U.tRumore, tRivela: U.tRivela, uArea: U.uArea, uForza: { value: forza } },
    vertexShader: VERT_OMBRA, fragmentShader: FRAG_OMBRA,
    transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    blending: THREE.CustomBlending,
    blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}

/* ------------------------------------------------------------------------ */
/*  6. I NASTRI colorati (scie che girano nell'aria)                         */
/* ------------------------------------------------------------------------ */
const VERT_NASTRO = /* glsl */ `
  in vec4 aColore;
  out vec4 vColore;
  out vec2 vUv;
  void main() {
    vColore = aColore;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG_NASTRO = /* glsl */ `
  precision highp float;
  uniform sampler2D tRumore;
  in vec4 vColore;
  in vec2 vUv;
  layout(location = 0) out vec4 oColore;
  layout(location = 1) out vec4 oDati;
  void main() {
    float bordo = abs(vUv.y - 0.5) * 2.0;
    float n = texture(tRumore, vUv * vec2(3.0, 0.5)).r;
    vec3 col = vColore.rgb * (0.92 + n * 0.16);
    col = mix(col, col * vec3(0.6, 0.5, 0.5), smoothstep(0.7, 0.95, bordo));   // orlo a inchiostro
    float a = vColore.a * (1.0 - smoothstep(0.96, 1.0, bordo));
    oColore = vec4(col, a);
    oDati = vec4(0.0);
  }
`;
export function materialeNastro() {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { tRumore: U.tRumore },
    vertexShader: VERT_NASTRO, fragmentShader: FRAG_NASTRO,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  });
}

/* ------------------------------------------------------------------------ */
/*  LA RIFINITURA A TUTTO SCHERMO                                            */
/* ------------------------------------------------------------------------ */
const VERT_QUAD = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
// sfocatura "a 4 punti" (Kawase): poche letture, risultato morbido
const FRAG_SFOCA = /* glsl */ `
  uniform sampler2D tSorgente;
  uniform vec2 uPasso;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(tSorgente, vUv + vec2(-uPasso.x, -uPasso.y));
    s += texture2D(tSorgente, vUv + vec2(uPasso.x, -uPasso.y));
    s += texture2D(tSorgente, vUv + vec2(-uPasso.x, uPasso.y));
    s += texture2D(tSorgente, vUv + vec2(uPasso.x, uPasso.y));
    gl_FragColor = s * 0.25;
  }
`;

const FRAG_FINALE = /* glsl */ `
  uniform sampler2D tColore;     // il colore della scena
  uniform sampler2D tDati;       // normali + profondità
  uniform sampler2D tSfocato;    // la scena sfocata (piccola)
  uniform sampler2D tMezzo;      // la scena appena sfocata (per i bordi bagnati)
  uniform sampler2D tLuce;       // i bagliori (piccoli e sfocati)
  uniform sampler2D tRumore;
  uniform sampler2D tCarta;
  uniform vec2 uRis;             // pixel dell'immagine della scena
  uniform vec2 uSchermo;         // pixel dello schermo
  uniform float uTempo;
  uniform float uFuoco;          // metri: a che distanza è "a fuoco"
  uniform float uApertura;       // 0 = tutto nitido, 1 = sfondo molto sfocato
  uniform float uFar;
  uniform float uSpessore;       // spessore delle linee (in pixel della scena)
  uniform float uDettaglio;      // 1 = qualità piena, 0 = versione leggera
  uniform float uBianco;         // dissolvenza verso la carta
  uniform float uScalaCarta;     // grandezza della grana (1 = un pixel di carta per pixel di schermo)
  uniform vec3 uCarta;
  uniform vec3 uInchiostro;
  uniform vec3 uMatita;
  varying vec2 vUv;

  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  // legge profondità (0..1) e normale da un punto dell'immagine "dati"
  float leggi(vec2 uv, out vec3 n) {
    vec4 d = texture2D(tDati, uv);
    vec2 nn = d.rg * 2.0 - 1.0;
    n = vec3(nn, sqrt(max(0.0, 1.0 - dot(nn, nn))));
    return max((d.b * 65280.0 + d.a * 255.0) / 65535.0, 1e-5);
  }
  // quanto è "bordo" questo punto: salti di profondità e spigoli
  float bordo(vec2 uv, vec2 o, out float zc) {
    vec3 nc, nl, nr, nd, nu;
    zc = leggi(uv, nc);
    float zl = leggi(uv - vec2(o.x, 0.0), nl), zr = leggi(uv + vec2(o.x, 0.0), nr);
    float zd = leggi(uv - vec2(0.0, o.y), nd), zu = leggi(uv + vec2(0.0, o.y), nu);
    // la "curvatura" di 1/profondità è zero sulle superfici piane: niente linee finte sul pavimento
    float ic = 1.0 / zc;
    float lap = abs(1.0 / zl + 1.0 / zr - 2.0 * ic) + abs(1.0 / zd + 1.0 / zu - 2.0 * ic);
    float eZ = smoothstep(0.06, 0.22, lap / ic);
    float dn = max(max(1.0 - dot(nc, nl), 1.0 - dot(nc, nr)), max(1.0 - dot(nc, nd), 1.0 - dot(nc, nu)));
    float eN = smoothstep(0.12, 0.38, dn);
    return max(eZ, eN);
  }

  void main() {
    vec2 uv = vUv;
    vec2 px = 1.0 / uRis;
    float asp = uSchermo.x / uSchermo.y;
    // il disegno "respira" 6 volte al secondo, come i cartoni fatti a mano
    float scatto = floor(uTempo * 6.0);
    vec2 salto = fract(vec2(sin(scatto * 12.9898), sin(scatto * 78.233)) * 43758.5453);
    vec4 nz = texture2D(tRumore, uv * vec2(asp, 1.0) * 0.5 + salto * 0.07);
    vec4 nz2 = texture2D(tRumore, uv * vec2(asp, 1.0) * 3.1 - salto * 0.05);

    // 1. SBAVATURE: il colore preso un po' "storto" (come carta bagnata)
    vec2 sposta = (nz.rg - 0.5) * px * 2.6;
    vec4 c = texture2D(tColore, uv + sposta);
    vec3 sf = texture2D(tSfocato, uv + sposta * 2.0).rgb;
    float riv = clamp(c.a / 0.8, 0.0, 1.0);

    // 2. LINEE: contorni e spigoli, un po' tremolanti
    vec2 uvL = uv + (nz.ba - 0.5) * px * 2.4;
    float sp = uSpessore * mix(0.75, 1.3, nz2.r);
    float zc;
    float linea = bordo(uvL, px * sp, zc);
    float metri = zc * uFar;
    linea *= mix(1.0, 0.45, smoothstep(12.0, 70.0, metri));        // lontano: linee più leggere
    linea *= 0.65 + 0.5 * nz2.g;                                    // pressione della penna
    float matita = 0.0;
    if (uDettaglio > 0.5) {
      // lo schizzo a matita ha un secondo tratto, un po' spostato (ripassato)
      float z2;
      matita = bordo(uv + (nz2.ba - 0.5) * px * 6.0, px * sp * 0.8, z2) * smoothstep(0.35, 0.7, nz.b);
    }

    // 3. PROFONDITÀ DI CAMPO: lontano dal fuoco → sfocato
    float coc = clamp(abs(metri - uFuoco) / (uFuoco * 0.9 + 1.5), 0.0, 1.0);
    coc = smoothstep(0.1, 1.0, coc) * uApertura;
    vec3 col = mix(c.rgb, sf, coc * 0.85);
    linea *= 1.0 - coc * 0.65;

    // 4. BORDI BAGNATI: il pigmento si accumula dove la macchia finisce
    vec3 sm = texture2D(tMezzo, uv + sposta).rgb;
    float acc = clamp((lum(sm) - lum(c.rgb)) * 4.0, 0.0, 1.0) + clamp(length(sm - c.rgb) * 1.5 - 0.06, 0.0, 0.4);
    col = col - (col - col * col) * min(acc, 1.0) * 0.9;

    // 5. LE LINEE: inchiostro dove è dipinto, matita dove è ancora carta
    vec3 tratto = mix(uMatita, uInchiostro, riv);
    float forza = mix(0.55, 0.86, riv);
    float carboncino = max(linea, matita * 0.55 * (1.0 - riv));
    col = mix(col, tratto, clamp(carboncino * forza, 0.0, 1.0));

    // 6. LA CARTA: grana, granulazione nelle zone cariche di pigmento, fibre
    vec2 uvCarta = gl_FragCoord.xy / (512.0 * uScalaCarta);
    vec4 carta = texture2D(tCarta, uvCarta);
    float pig = clamp(1.0 - lum(col) / lum(uCarta), 0.0, 1.0);
    col *= 1.0 + (carta.g - 0.55) * pig * 0.4;           // granulazione
    col *= 0.965 + carta.r * 0.055;                       // rilievo della carta
    col *= 1.0 - carta.b * 0.035;                         // fibre

    // 7. BAGLIORI magici (sfumano il colore verso la tinta della luce)
    vec4 g = texture2D(tLuce, uv);
    float ga = clamp(g.a, 0.0, 1.0);
    vec3 gc = g.rgb / max(g.a, 1e-3);
    col = col * mix(vec3(1.0), gc, ga * 0.55) + gc * ga * 0.3;

    // 8. I BORDI DELLO SCHERMO svaniscono nella carta (bordo irregolare, come un foglio dipinto)
    vec2 q = abs(uv - 0.5) * 2.0;
    q.x = q.x * 1.0;
    float rv = pow(pow(q.x, 5.0) + pow(q.y * 1.02, 5.0), 0.2) + (nz.r - 0.5) * 0.16 + (nz2.b - 0.5) * 0.05;
    col = mix(col, uCarta, smoothstep(0.9, 1.06, rv));

    col = mix(col, uCarta, uBianco);
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

export class Acquerello {
  constructor(renderer) {
    this.renderer = renderer;
    const base = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, stencilBuffer: false };
    this.campioni = 0;
    this.rtScena = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: true, count: 2, samples: 0 });
    this.rtMezzo = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: false });
    this.rtA = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: false });
    this.rtLuceA = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: false });
    this.rtLuceB = new THREE.WebGLRenderTarget(4, 4, { ...base, depthBuffer: false });
    this.camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scenaQuad = new THREE.Scene();
    this.scenaQuad.add(this.quad);
    this.matSfoca = new THREE.ShaderMaterial({
      uniforms: { tSorgente: { value: null }, uPasso: { value: new THREE.Vector2() } },
      vertexShader: VERT_QUAD, fragmentShader: FRAG_SFOCA, depthTest: false, depthWrite: false,
    });
    this.matFinale = new THREE.ShaderMaterial({
      uniforms: {
        tColore: { value: null }, tDati: { value: null }, tSfocato: { value: null }, tMezzo: { value: null }, tLuce: { value: null },
        tRumore: U.tRumore, tCarta: U.tCarta,
        uRis: { value: new THREE.Vector2(1, 1) }, uSchermo: { value: new THREE.Vector2(1, 1) },
        uTempo: U.uTempo, uFuoco: { value: 5 }, uApertura: { value: 0.6 }, uFar: U.uFar,
        uSpessore: { value: 1.0 }, uDettaglio: { value: 1 }, uBianco: { value: 0 }, uScalaCarta: { value: 1 },
        uCarta: U.uCarta, uInchiostro: { value: new THREE.Vector3(...COLORI.inchiostro) }, uMatita: { value: new THREE.Vector3(...COLORI.matita) },
      },
      vertexShader: VERT_QUAD, fragmentShader: FRAG_FINALE, depthTest: false, depthWrite: false,
    });
    this.punti = null;      // il materiale delle scintille (cambia modo nel passo "luce")
  }

  /** Dimensioni: w,h in pixel CSS, dpr = densità dello schermo, scala = risoluzione della scena (0.5..1). */
  imposta(w, h, dpr, scala, campioni) {
    const r = this.renderer;
    r.setPixelRatio(dpr);
    r.setSize(w, h, false);
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    const sw = Math.max(2, Math.round(W * scala)), sh = Math.max(2, Math.round(H * scala));
    if (campioni !== this.campioni) {
      this.rtScena.dispose();
      this.rtScena = new THREE.WebGLRenderTarget(sw, sh, {
        type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        generateMipmaps: false, stencilBuffer: false, depthBuffer: true, count: 2, samples: campioni,
      });
      this.campioni = campioni;
    }
    this.rtScena.setSize(sw, sh);
    this.rtMezzo.setSize(Math.ceil(sw / 2), Math.ceil(sh / 2));
    this.rtA.setSize(Math.ceil(sw / 4), Math.ceil(sh / 4));
    this.rtB.setSize(Math.ceil(sw / 4), Math.ceil(sh / 4));
    this.rtLuceA.setSize(Math.ceil(W / 4), Math.ceil(H / 4));
    this.rtLuceB.setSize(Math.ceil(W / 4), Math.ceil(H / 4));
    const u = this.matFinale.uniforms;
    u.uRis.value.set(sw, sh);
    u.uSchermo.value.set(W, H);
    // linee più spesse se lo schermo è grande rispetto all'immagine della scena
    u.uSpessore.value = clamp(0.8 * Math.max(1, sh / 520), 0.8, 1.6);
    u.uScalaCarta.value = Math.max(1, dpr * 0.75);
    this.dimensioni = { W, H, sw, sh };
  }

  _passo(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scenaQuad, this.camQuad);
  }
  _sfoca(sorgente, target, passo) {
    this.matSfoca.uniforms.tSorgente.value = sorgente.texture || sorgente;
    this.matSfoca.uniforms.uPasso.value.set(passo / sorgente.width, passo / sorgente.height);
    this._passo(this.matSfoca, target);
  }

  disegna(scena, camera) {
    const r = this.renderer, D = this.dimensioni;
    const fattore = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    // 1. la scena: colore + dati (in un colpo solo, "multiple render targets")
    U.uScalaPunti.value = D.sh * fattore;
    U.uPassoLuce.value = 0;
    camera.layers.set(0);
    r.setRenderTarget(this.rtScena);
    r.setClearColor(0xfbf6ea, 0);
    r.clear();
    r.render(scena, camera);
    // 2. la scena sfocata (per bordi bagnati e profondità di campo)
    const tex0 = this.rtScena.textures[0];
    this.matSfoca.uniforms.tSorgente.value = tex0;
    this.matSfoca.uniforms.uPasso.value.set(1 / D.sw, 1 / D.sh);
    this._passo(this.matSfoca, this.rtMezzo);
    this._sfoca(this.rtMezzo, this.rtA, 1.0);
    this._sfoca(this.rtA, this.rtB, 1.5);
    // 3. il passo "luce": solo i bagliori, piccoli, poi sfocati
    r.setRenderTarget(this.rtLuceA);
    r.setClearColor(0x000000, 0);
    r.clear();
    if (this.punti) {
      U.uScalaPunti.value = this.rtLuceA.height * fattore;
      U.uPassoLuce.value = 1;
      const m = this.punti;
      m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneFactor;
      m.depthTest = false;
      camera.layers.set(1);
      r.render(scena, camera);
      camera.layers.set(0);
      m.blendSrc = THREE.SrcAlphaFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
      m.depthTest = true;
      U.uPassoLuce.value = 0;
    }
    this._sfoca(this.rtLuceA, this.rtLuceB, 1.5);
    this._sfoca(this.rtLuceB, this.rtLuceA, 2.5);
    // 4. la rifinitura sullo schermo
    const u = this.matFinale.uniforms;
    u.tColore.value = tex0;
    u.tDati.value = this.rtScena.textures[1];
    u.tSfocato.value = this.rtB.texture;
    u.tMezzo.value = this.rtMezzo.texture;
    u.tLuce.value = this.rtLuceA.texture;
    this._passo(this.matFinale, null);
  }
}
