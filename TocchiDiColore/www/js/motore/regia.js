/* ==========================================================================
 *  regia.js — LA TELECAMERA "DA REGISTA"
 *  --------------------------------------------------------------------------
 *  Nei cartoni animati la telecamera non sta mai ferma di lato come in un
 *  vecchio videogioco: segue il personaggio di tre quarti, si alza, si
 *  abbassa, "stacca" su un'altra inquadratura quando la scena cambia.
 *
 *  Ogni scena ha un elenco di INQUADRATURE. Ognuna vale per un tratto del
 *  percorso di Lia (da s = "da" a s = "a") e ha una o più CHIAVI:
 *
 *    { da: 0, a: 12, tipo: 'segui', taglio: true,
 *      chiavi: [
 *        { s: 0,  pos: [-3, 1.1, 3.4], guarda: [3, 0.8, -0.5], fov: 40 },
 *        { s: 12, pos: [ 1, 1.6, 5.0], guarda: [1, 0.9,  0  ] },
 *      ] }
 *
 *  tipo 'segui'  pos e guarda sono SPOSTAMENTI rispetto a Lia: la camera
 *                la accompagna (carrellata).
 *  tipo 'fisso'  pos è un punto fisso del mondo; guarda è uno spostamento
 *                rispetto a Lia: la camera sta ferma e "gira la testa".
 *  tipo 'binario' pos e guarda sono punti fissi del mondo, interpolati
 *                tra le chiavi secondo s: la camera scorre su un binario.
 *  Tra una chiave e l'altra i valori si mescolano dolcemente: così, mentre
 *  Lia cammina, l'inquadratura cambia direzione e crea lo SPAZIO.
 *  taglio: true  = entrando nel tratto si "stacca" di colpo (montaggio).
 *  limitiX: [min, max] = la camera non va oltre (le pareti di una stanza).
 * ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const morbido = (t) => t * t * (3 - 2 * t);

export class Regia {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.campoVisivo, 16 / 9, 0.1, 700);
    this.pos = new THREE.Vector3(0, 1.5, 6);
    this.guarda = new THREE.Vector3(0, 1, 0);
    this.fov = CONFIG.camera.campoVisivo;
    this.inquadrature = [];
    this.attuale = -1;
    this.saltaAlProssimo = true;  // al primo fotogramma niente scivolata
    this.sostituta = null;        // inquadratura imposta dalla storia (inquadra)
    this.scossa = 0;
    this.tempo = 0;
    this.guida = 0;               // anticipo smussato nella direzione di marcia
    this.aspetto = 16 / 9;
    this._p = new THREE.Vector3();
    this._g = new THREE.Vector3();
  }

  /** Nuova scena: nuove inquadrature e stacco netto. */
  imposta(inquadrature) {
    this.inquadrature = inquadrature || [];
    this.attuale = -1;
    this.sostituta = null;
    this.taglia();
  }

  /** Il prossimo fotogramma salta subito all'inquadratura giusta. */
  taglia() { this.saltaAlProssimo = true; }

  ridimensiona(L, A) {
    this.aspetto = L / A;
    this.camera.aspect = this.aspetto;
    this.camera.updateProjectionMatrix();
  }

  /** Scuote la telecamera (un urto, uno spavento). */
  scuoti(forza) { this.scossa = Math.max(this.scossa, forza); }

  /** Un piccolo "respiro" dell'inquadratura (stringe e torna), per i colpi di bacchetta. */
  pulsa(forza) {
    this.pulsazione = Math.max(this.pulsazione || 0, forza);
    // e un'inclinazione leggera, come una camera che "sobbalza" di meraviglia
    this.rollioColpo = (Math.random() < 0.5 ? -1 : 1) * forza * 0.035;
  }

  /**
   * Un MOMENTO DI SCOPERTA: per qualche secondo la camera si allarga, si alza
   * e gira lo sguardo verso il punto [x, y, z], poi torna da Lia.
   */
  momento(punto, durata) {
    this.mom = { p: new THREE.Vector3(...punto), t: 0, d: durata || 2.8 };
  }

  /** Nel mondo immaginato l'inquadratura ondeggia appena, come in sogno (0 = ferma). */
  sogno(forza) { this.forzaSogno = forza; }

  /**
   * La storia prende la regia: pos e guarda sono punti del mondo.
   * durata = secondi della carrellata (0 = stacco netto).
   */
  inquadra(pos, guarda, durata, fov) {
    this.sostituta = {
      pos: new THREE.Vector3(...pos), guarda: new THREE.Vector3(...guarda), fov: fov || this.fov,
      daPos: this.pos.clone(), daGuarda: this.guarda.clone(), daFov: this.fov, t: 0, durata: durata || 0,
    };
    if (!durata) this.saltaAlProssimo = true;
  }

  /** Restituisce la regia alle inquadrature della scena (con una carrellata morbida). */
  libera(stacco) {
    this.sostituta = null;
    if (stacco) this.taglia();
  }

  /** Quale inquadratura vale per la posizione s? (l'ultima che la contiene) */
  _trova(s) {
    let scelta = -1;
    for (let k = 0; k < this.inquadrature.length; k++) {
      const q = this.inquadrature[k];
      if (s >= q.da && s <= q.a) scelta = k;
    }
    if (scelta < 0 && this.inquadrature.length) {
      // fuori da tutti i tratti: la più vicina
      let dMin = Infinity;
      this.inquadrature.forEach((q, k) => {
        const d = Math.min(Math.abs(s - q.da), Math.abs(s - q.a));
        if (d < dMin) { dMin = d; scelta = k; }
      });
    }
    return scelta;
  }

  /** Calcola dove vorrebbe stare la camera per l'inquadratura q con Lia in s. */
  _bersaglio(q, lia, guida) {
    const chiavi = q.chiavi;
    let a = chiavi[0], b = chiavi[0], t = 0;
    if (chiavi.length > 1) {
      if (lia.s <= chiavi[0].s) { a = b = chiavi[0]; }
      else if (lia.s >= chiavi[chiavi.length - 1].s) { a = b = chiavi[chiavi.length - 1]; }
      else {
        for (let k = 0; k < chiavi.length - 1; k++) {
          if (lia.s >= chiavi[k].s && lia.s <= chiavi[k + 1].s) {
            a = chiavi[k]; b = chiavi[k + 1];
            t = morbido((lia.s - a.s) / ((b.s - a.s) || 1));
            break;
          }
        }
      }
    }
    const mix = (u, v) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t];
    const pos = mix(a.pos, b.pos), gu = mix(a.guarda, b.guarda);
    const fa = a.fov || q.fov || CONFIG.camera.campoVisivo, fb = b.fov || q.fov || CONFIG.camera.campoVisivo;
    const fov = fa + (fb - fa) * t;
    // la quota di Lia conta solo in parte (sul ponte la camera sale un poco)
    const ly = lia.y * (q.seguiAltezza === undefined ? 0.7 : q.seguiAltezza);
    const gx = lia.tangente.x * guida, gz = lia.tangente.z * guida;
    if (q.tipo === 'binario') {
      this._p.set(pos[0], pos[1], pos[2]);
      this._g.set(gu[0], gu[1], gu[2]);
    } else if (q.tipo === 'fisso') {
      this._p.set(pos[0], pos[1], pos[2]);
      this._g.set(lia.x + gu[0] + gx * 0.5, ly + gu[1], lia.z + gu[2] + gz * 0.5);
    } else {
      this._p.set(lia.x + pos[0] + gx, ly + pos[1], lia.z + pos[2] + gz);
      this._g.set(lia.x + gu[0] + gx, ly + gu[1], lia.z + gu[2] + gz);
    }
    // limiti: negli interni la camera non deve uscire dalla stanza
    if (q.limitiX) {
      const dx = Math.min(q.limitiX[1], Math.max(q.limitiX[0], this._p.x)) - this._p.x;
      this._p.x += dx;
      this._g.x += dx * 0.6;
    }
    return fov;
  }

  aggiorna(dt, lia) {
    this.tempo += dt;
    let fov;
    if (this.sostituta) {
      const S = this.sostituta;
      S.t = S.durata > 0 ? Math.min(1, S.t + dt / S.durata) : 1;
      const e = morbido(S.t);
      this.pos.lerpVectors(S.daPos, S.pos, e);
      this.guarda.lerpVectors(S.daGuarda, S.guarda, e);
      this.fov = S.daFov + (S.fov - S.daFov) * e;
      this.saltaAlProssimo = false;
    } else if (lia && lia.scena && this.inquadrature.length) {
      const k = this._trova(lia.s);
      const q = this.inquadrature[k];
      if (k !== this.attuale) {
        if (q.taglio && this.attuale >= 0) this.saltaAlProssimo = true;
        this.attuale = k;
      }
      // l'anticipo segue la direzione di marcia, con calma (niente sobbalzi)
      const anticipo = q.anticipo === undefined ? CONFIG.camera.anticipo : q.anticipo;
      const voluto = lia.verso * anticipo * Math.min(1, Math.abs(lia.vel) / 0.6 + 0.35);
      this.guida += (voluto - this.guida) * Math.min(1, dt * 0.9);
      fov = this._bersaglio(q, lia, this.guida);
      if (this.saltaAlProssimo) {
        this.pos.copy(this._p);
        this.guarda.copy(this._g);
        this.fov = fov;
        this.saltaAlProssimo = false;
      } else {
        const m = 1 - Math.exp(-dt * (q.morbidezza || CONFIG.camera.morbidezza));
        this.pos.lerp(this._p, m);
        this.guarda.lerp(this._g, Math.min(1, m * 1.4));
        this.fov += (fov - this.fov) * m;
      }
    }

    // un respiro leggerissimo, come una camera a mano
    const c = this.camera;
    c.position.copy(this.pos);
    c.position.x += Math.sin(this.tempo * 0.37) * 0.025;
    c.position.y += Math.sin(this.tempo * 0.53 + 1) * 0.02;
    if (this.scossa > 0) {
      this.scossa = Math.max(0, this.scossa - dt * 1.8);
      const f = this.scossa * this.scossa * 0.09;
      c.position.x += (Math.random() - 0.5) * f;
      c.position.y += (Math.random() - 0.5) * f;
    }
    // il momento di scoperta: la camera si allarga e guarda la meraviglia
    const bersaglio = this._t || (this._t = new THREE.Vector3());
    bersaglio.copy(this.guarda);
    if (this.mom) {
      const M = this.mom;
      M.t += dt;
      const k = Math.min(1, M.t / M.d);
      const e = Math.sin(Math.PI * k);
      const e2 = e * e * (3 - 2 * e);
      const via = this._v || (this._v = new THREE.Vector3());
      via.subVectors(c.position, this.guarda).normalize();
      c.position.addScaledVector(via, 1.1 * e2);
      c.position.y += 0.45 * e2;
      bersaglio.lerp(M.p, 0.5 * e2);
      if (k >= 1) this.mom = null;
    }
    c.lookAt(bersaglio);
    // inclinazione: un sobbalzo ai colpi magici + un ondeggiare lento da sogno
    this.rollioColpo = (this.rollioColpo || 0) * Math.exp(-dt * 3);
    const roll = this.rollioColpo + Math.sin(this.tempo * 0.31) * 0.012 * (this.forzaSogno || 0);
    if (Math.abs(roll) > 0.0005) c.rotateZ(roll);
    let fovVero = this.fov;
    if (this.pulsazione > 0) {
      // stringe in fretta e torna piano (curva "a campana" sul tempo che resta)
      this.pulsazione = Math.max(0, this.pulsazione - dt * 1.6);
      const k = this.pulsazione;
      fovVero -= Math.sin(k * Math.PI) * 1.6 * Math.min(1, k * 3);
    }
    if (Math.abs(c.fov - fovVero) > 0.01) { c.fov = fovVero; c.updateProjectionMatrix(); }
    c.updateMatrixWorld();
  }
}
