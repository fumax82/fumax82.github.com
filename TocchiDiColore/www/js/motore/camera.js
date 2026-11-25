/* ==========================================================================
 *  camera.js — TELECAMERA: PRIMA PERSONA, TERZA PERSONA E SCENE
 *  --------------------------------------------------------------------------
 *  PRIMA PERSONA: la telecamera è negli occhi di Lia (si vede la mano con
 *  il bastone o la bacchetta, disegnata dall'interfaccia).
 *  TERZA PERSONA: la telecamera sta dietro e sopra Lia, la segue con un
 *  leggero ritardo e si avvicina se dietro c'è un muro.
 *  SCENE: durante i momenti della storia il "regista" può prendere il
 *  controllo e inquadrare ciò che vuole (inquadra / libera).
 *
 *  Angoli: "angolo" è la direzione in cui si guarda sulla mappa
 *  (0 = est, π/2 = sud...). Three.js guarda di base verso -Z, da qui la
 *  conversione rotazioneY = -angolo - π/2.
 * ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const morbido = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const diffAngolo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Telecamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(CONFIG.grafica.campoVisivo, 16 / 9, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.modo = 'terza';
    this.avanzamento = 1;        // 0 = prima persona, 1 = terza
    this.transizione = 1;
    this.angoloLiscio = 0;
    this.scossa = 0;
    this.distanza = 0;
    this.cinematica = null;      // { pos, guarda, durata, t } quando il regista inquadra
    this._pos = new THREE.Vector3();
    this._guarda = new THREE.Vector3();
  }

  get oggetto() {
    return this.camera;
  }

  cambiaModo() {
    this.modo = this.modo === 'prima' ? 'terza' : 'prima';
  }

  /** Il regista inquadra un punto: pos = [x, y(altezza), z], guarda = [x, y, z]. */
  inquadra(pos, guarda, durata) {
    this.cinematica = {
      da: this.camera.position.clone(),
      daGuarda: this._guardaAttuale(),
      pos: new THREE.Vector3(...pos),
      guarda: new THREE.Vector3(...guarda),
      durata: durata || 1.2,
      t: 0,
    };
  }

  /** Torna a seguire Lia. */
  libera() {
    this.cinematica = null;
  }

  scuoti(forza) {
    this.scossa = Math.max(this.scossa, forza);
  }

  _guardaAttuale() {
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    return this.camera.position.clone().add(d.multiplyScalar(4));
  }

  ridimensiona(larghezza, altezza) {
    this.camera.aspect = larghezza / altezza;
    // in verticale allarghiamo il campo visivo per vedere abbastanza ai lati
    this.camera.fov = this.camera.aspect < 1 ? CONFIG.grafica.campoVisivo * 1.35 : CONFIG.grafica.campoVisivo;
    this.camera.updateProjectionMatrix();
  }

  /**
   * g: la giocatrice { x, y, quota, angolo, inclinazione, faseP, inMovimento }
   */
  aggiorna(dt, g, mondo) {
    const K = CONFIG.camera, T = K.terza;
    this.scossa = Math.max(0, this.scossa - dt * 2.5);

    // --- inquadratura del regista ---------------------------------------
    if (this.cinematica) {
      const c = this.cinematica;
      c.t = Math.min(1, c.t + dt / c.durata);
      const e = morbido(c.t);
      this._pos.lerpVectors(c.da, c.pos, e);
      this._guarda.lerpVectors(c.daGuarda, c.guarda, e);
      this.camera.position.copy(this._pos);
      this.camera.lookAt(this._guarda);
      this._applicaScossa();
      this.transizione = 1;
      return;
    }

    // --- passaggio tra prima e terza persona ----------------------------
    const meta = this.modo === 'terza' ? 1 : 0;
    const passo = dt / K.durataTransizione;
    this.avanzamento = meta > this.avanzamento ? Math.min(meta, this.avanzamento + passo) : Math.max(meta, this.avanzamento - passo);
    const e = morbido(this.avanzamento);
    this.transizione = e;

    this.angoloLiscio += diffAngolo(this.angoloLiscio, g.angolo) * (1 - Math.exp(-T.morbidezza * dt));
    const angolo = g.angolo + diffAngolo(g.angolo, this.angoloLiscio) * e;

    const oscilla = g.inMovimento ? Math.sin(g.faseP * Math.PI) * K.oscillazionePasso : 0;
    const quota = g.quota || 0;
    const zOcchi = quota + K.altezzaOcchi + oscilla;
    const z = zOcchi + (T.altezza - K.altezzaOcchi) * e;

    // distanza dietro a Lia, accorciata se c'è un muro (la telecamera non entra nei muri)
    let distanza = e * T.distanza;
    const bx = -Math.cos(angolo), by = -Math.sin(angolo);
    let libera = 0;
    for (let s = 0.05; s <= distanza + 0.001; s += 0.05) {
      if (mondo.bloccaCamera(g.x + bx * s, g.y + by * s, z)) break;
      libera = s;
    }
    if (libera < distanza) distanza = Math.max(0, libera - 0.15);
    this.distanza = distanza;

    this.camera.position.set(g.x + bx * distanza, z, g.y + by * distanza);
    const inclinazione = g.inclinazione + T.inclinazione * e;
    this.camera.rotation.set(inclinazione, -angolo - Math.PI / 2, 0, 'YXZ');
    this._applicaScossa();
  }

  _applicaScossa() {
    if (this.scossa <= 0) return;
    const s = this.scossa * 0.06;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.rotation.z = (Math.random() - 0.5) * s * 0.5;
  }
}
