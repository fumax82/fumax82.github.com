/* ==========================================================================
 *  particelle.js — EFFETTI SPECIALI: SCINTILLE, PETALI, NOTE, PROFUMI...
 *  --------------------------------------------------------------------------
 *  Un "sistema di particelle" è un insieme di tanti piccoli disegni che
 *  nascono, si muovono e svaniscono: scintille della bacchetta, petali,
 *  note musicali, briciole di pane, bolle, fumo della pipa...
 *  Tutte le particelle stanno in un unico oggetto 3D (veloce anche sui
 *  telefoni). L'atlante "particelle" (dipinto in cielo.js) contiene 16
 *  forme bianche che qui vengono colorate.
 *
 *  Forme: 0 punto, 1 stella, 2 scintilla, 3 petalo, 4 foglia, 5 nota,
 *  6 briciole, 7 cuore, 8 bolla, 9 fumo, 10 goccia, 11 piuma, 12 pagina,
 *  13 fiorellino, 14 nuvoletta, 15 anello
 * ========================================================================== */
import * as THREE from 'three';
import { Galleria } from '../arte/galleria.js';

export const FORME = {
  punto: 0, stella: 1, scintilla: 2, petalo: 3, foglia: 4, nota: 5, briciole: 6, cuore: 7,
  bolla: 8, fumo: 9, goccia: 10, piuma: 11, pagina: 12, fiore: 13, nuvoletta: 14, anello: 15,
};

const MAX = 1400;

const VERT = /* glsl */ `
  attribute float aDim;
  attribute float aAlfa;
  attribute float aForma;
  attribute float aRot;
  attribute vec3 aColore;
  uniform float uScala;
  varying float vAlfa;
  varying float vForma;
  varying float vRot;
  varying vec3 vColore;
  void main() {
    vAlfa = aAlfa; vForma = aForma; vRot = aRot; vColore = aColore;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aDim * uScala / max(0.2, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uAtlante;
  varying float vAlfa;
  varying float vForma;
  varying float vRot;
  varying vec3 vColore;
  void main() {
    // ruota il disegno della particella
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
    float col = mod(vForma, 4.0), riga = floor(vForma / 4.0);
    vec2 uv = vec2((col + p.x) / 4.0, 1.0 - (riga + p.y) / 4.0);
    vec4 t = texture2D(uAtlante, uv);
    float a = t.a * vAlfa;
    if (a < 0.01) discard;
    gl_FragColor = vec4(t.rgb * vColore, a);
  }
`;

export class Particelle {
  /**
   * opz: { additivo: true } = particelle "di luce": si sommano all'immagine
   * e brillano (scintille, stelle, lucciole); senza, sono dipinte (petali, note).
   */
  constructor(opz) {
    const o = opz || {};
    this.posizioni = new Float32Array(MAX * 3);
    this.dim = new Float32Array(MAX);
    this.alfa = new Float32Array(MAX);
    this.forma = new Float32Array(MAX);
    this.rot = new Float32Array(MAX);
    this.colori = new Float32Array(MAX * 3);
    // stato di ogni particella
    this.vel = new Float32Array(MAX * 3);
    this.vita = new Float32Array(MAX);
    this.vitaMax = new Float32Array(MAX);
    this.dimBase = new Float32Array(MAX);
    this.gravita = new Float32Array(MAX);
    this.vortice = new Float32Array(MAX);
    this.rotVel = new Float32Array(MAX);
    this.prossima = 0;
    this.emettitori = [];

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posizioni, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDim', new THREE.BufferAttribute(this.dim, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlfa', new THREE.BufferAttribute(this.alfa, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aForma', new THREE.BufferAttribute(this.forma, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColore', new THREE.BufferAttribute(this.colori, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometria = geo;
    const atlante = Galleria.atlante('particelle');
    this.materiale = new THREE.ShaderMaterial({
      uniforms: { uAtlante: { value: atlante.texture }, uScala: { value: 300 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: o.additivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.punti = new THREE.Points(geo, this.materiale);
    this.punti.frustumCulled = false;
    this.punti.renderOrder = o.additivo ? 11 : 10;
  }

  /** Adatta la grandezza delle particelle all'altezza dello schermo. */
  ridimensiona(altezzaPixel) {
    this.materiale.uniforms.uScala.value = altezzaPixel * 0.9;
  }

  /**
   * Fa nascere "quante" particelle nel punto (x, h, y).
   * opz: { forma, colori: ['#hex',...], velocita, su (spinta verso l'alto),
   *        gravita, vita, dim, sparpaglia (raggio di partenza), vortice, rotazione }
   */
  emetti(x, h, y, quante, opz) {
    const o = opz || {};
    const forme = Array.isArray(o.forma) ? o.forma : [o.forma === undefined ? FORME.punto : o.forma];
    const colori = (o.colori || ['#ffffff']).map((c) => new THREE.Color(c));
    for (let k = 0; k < quante; k++) {
      const i = this.prossima;
      this.prossima = (this.prossima + 1) % MAX;
      const sp = o.sparpaglia || 0;
      this.posizioni[i * 3] = x + (Math.random() - 0.5) * 2 * sp;
      this.posizioni[i * 3 + 1] = h + (Math.random() - 0.5) * sp;
      this.posizioni[i * 3 + 2] = y + (Math.random() - 0.5) * 2 * sp;
      const v = o.velocita === undefined ? 1 : o.velocita;
      const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
      this.vel[i * 3] = Math.cos(a) * Math.cos(b) * v * (0.4 + Math.random() * 0.6);
      this.vel[i * 3 + 1] = Math.sin(b) * v * 0.5 + (o.su || 0) * (0.6 + Math.random() * 0.8);
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * v * (0.4 + Math.random() * 0.6);
      if (o.direzione) {
        this.vel[i * 3] += o.direzione[0];
        this.vel[i * 3 + 1] += o.direzione[1];
        this.vel[i * 3 + 2] += o.direzione[2];
      }
      this.vitaMax[i] = (o.vita || 1.5) * (0.7 + Math.random() * 0.6);
      this.vita[i] = this.vitaMax[i];
      this.dimBase[i] = (o.dim || 0.25) * (0.7 + Math.random() * 0.6);
      this.gravita[i] = o.gravita || 0;
      this.vortice[i] = o.vortice || 0;
      this.forma[i] = forme[Math.floor(Math.random() * forme.length)];
      this.rot[i] = Math.random() * Math.PI * 2;
      this.rotVel[i] = (o.rotazione === undefined ? 1 : o.rotazione) * (Math.random() - 0.5) * 3;
      const c = colori[Math.floor(Math.random() * colori.length)];
      this.colori[i * 3] = c.r; this.colori[i * 3 + 1] = c.g; this.colori[i * 3 + 2] = c.b;
    }
  }

  /**
   * Emettitore continuo (fumo di una pipa, profumo, polline...).
   * Restituisce un oggetto con .attivo e .posizione modificabili.
   */
  aggiungiEmettitore(x, h, y, ritmo, opz) {
    const e = { attivo: true, posizione: [x, h, y], ritmo, opz, accumulo: 0 };
    this.emettitori.push(e);
    return e;
  }

  rimuoviEmettitori() {
    this.emettitori.length = 0;
  }

  aggiorna(dt, tempo) {
    for (const e of this.emettitori) {
      if (!e.attivo) continue;
      e.accumulo += e.ritmo * dt;
      const n = Math.floor(e.accumulo);
      if (n > 0) {
        e.accumulo -= n;
        this.emetti(e.posizione[0], e.posizione[1], e.posizione[2], n, e.opz);
      }
    }
    for (let i = 0; i < MAX; i++) {
      if (this.vita[i] <= 0) { this.alfa[i] = 0; continue; }
      this.vita[i] -= dt;
      const t = 1 - this.vita[i] / this.vitaMax[i];      // 0 nascita → 1 fine
      this.vel[i * 3 + 1] -= this.gravita[i] * dt;
      if (this.vortice[i]) {                                // movimento a spirale (profumi)
        this.vel[i * 3] += Math.sin(tempo * 2 + i) * this.vortice[i] * dt;
        this.vel[i * 3 + 2] += Math.cos(tempo * 2 + i * 1.3) * this.vortice[i] * dt;
      }
      this.posizioni[i * 3] += this.vel[i * 3] * dt;
      this.posizioni[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.posizioni[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.rot[i] += this.rotVel[i] * dt;
      // compare in fretta e svanisce dolcemente
      this.alfa[i] = Math.min(1, t * 6) * (1 - t * t);
      this.dim[i] = this.dimBase[i] * (0.6 + 0.4 * Math.min(1, t * 4));
    }
    const a = this.geometria.attributes;
    a.position.needsUpdate = true;
    a.aDim.needsUpdate = true;
    a.aAlfa.needsUpdate = true;
    a.aRot.needsUpdate = true;
    a.aForma.needsUpdate = true;
    a.aColore.needsUpdate = true;
  }
}
