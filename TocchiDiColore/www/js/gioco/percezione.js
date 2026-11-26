/* ==========================================================================
 *  percezione.js — IL MONDO BIANCO CHE SI COLORA
 *  --------------------------------------------------------------------------
 *  Lia non vede: "sente". Il mondo intorno a lei è un foglio bianco con
 *  qualche tratto di matita, e si colora soltanto dove arriva un suono
 *  (il "toc toc" del bastone, un abbaio, un campanello) o un profumo.
 *
 *  Teniamo una piccola mappa della scena vista DALL'ALTO, divisa in caselle
 *  (2 per metro). Per ogni casella sappiamo quanto è percepita (0..1).
 *  Le ONDE sono anelli che si allargano e colorano le caselle che toccano.
 *  Poi, piano piano, i colori sbiadiscono fino al "ricordo" (un po' di
 *  colore resta nei posti già scoperti).
 *  La mappa diventa una texture (uRiv) letta dagli shader in materiali.js:
 *    canale R = quanto si vede, canale G = quanto è "fresco" (appena scoperto:
 *    brilla e scintilla per un paio di secondi).
 * ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const CELLE_PER_METRO = 2;

export class Percezione {
  /** area: { x, z, larghezza, profondita } — il rettangolo coperto (in metri) */
  constructor(area) {
    this.x0 = area.x;
    this.z0 = area.z;
    this.larghezzaMetri = area.larghezza;
    this.profonditaMetri = area.profondita;
    this.colonne = Math.max(2, Math.ceil(area.larghezza * CELLE_PER_METRO));
    this.righe = Math.max(2, Math.ceil(area.profondita * CELLE_PER_METRO));
    const n = this.colonne * this.righe;
    this.rivelazione = new Float32Array(n);  // quanto si vede adesso
    this.obiettivo = new Float32Array(n);    // verso quale valore sta andando
    this.visitato = new Uint8Array(n);       // già scoperto almeno una volta?
    this.ultimoTocco = new Float32Array(n);  // quando è stato percepito l'ultima volta
    this.fresco = new Float32Array(n);       // 1 = appena scoperto (brilla), poi si spegne
    this.nuove = 0;                          // caselle scoperte per la prima volta in questo fotogramma
    this.livelloRicordo = CONFIG.percezione.livelloRicordo;
    this.rivelaTutto = 0;                    // 1 = tutto a colori
    this.tempo = 0;
    this.onde = [];

    this.dati = new Uint8Array(n * 4);
    this.texture = new THREE.DataTexture(this.dati, this.colonne, this.righe, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    for (let i = 0; i < n; i++) this.dati[i * 4 + 3] = 255;
    this.texture.needsUpdate = true;
  }

  /** Imposta gli "uniform" degli shader perché leggano questa mappa. */
  collega(uniformi) {
    uniformi.uRiv.value = this.texture;
    uniformi.uRivMin.value.set(this.x0, this.z0);
    uniformi.uRivDim.value.set(this.colonne / CELLE_PER_METRO, this.righe / CELLE_PER_METRO);
  }

  /** Il punto (x, z) è fuori dalla mappa di più di "margine" metri? */
  fuori(x, z, margine) {
    const m = margine || 0;
    return x < this.x0 - m || z < this.z0 - m || x > this.x0 + this.larghezzaMetri + m || z > this.z0 + this.profonditaMetri + m;
  }

  _cella(x, z) {
    const cx = Math.floor((x - this.x0) * CELLE_PER_METRO), cz = Math.floor((z - this.z0) * CELLE_PER_METRO);
    if (cx < 0 || cz < 0 || cx >= this.colonne || cz >= this.righe) return -1;
    return cz * this.colonne + cx;
  }

  /** Quanto è percepito il punto (x, z), da 0 a 1. */
  valore(x, z) {
    const i = this._cella(x, z);
    return Math.max(i < 0 ? 0 : this.rivelazione[i], this.rivelaTutto);
  }

  _rivela(i, livello) {
    if (this.obiettivo[i] < livello) this.obiettivo[i] = livello;
    if (!this.visitato[i]) this.nuove++;
    this.visitato[i] = 1;
    this.ultimoTocco[i] = this.tempo;
  }

  /** Colora subito un cerchio di raggio r intorno a (x, z). */
  rivelaCerchio(x, z, r, livello) {
    const c0 = Math.max(0, Math.floor((x - r - this.x0) * CELLE_PER_METRO));
    const c1 = Math.min(this.colonne - 1, Math.floor((x + r - this.x0) * CELLE_PER_METRO));
    const r0 = Math.max(0, Math.floor((z - r - this.z0) * CELLE_PER_METRO));
    const r1 = Math.min(this.righe - 1, Math.floor((z + r - this.z0) * CELLE_PER_METRO));
    for (let rz = r0; rz <= r1; rz++) {
      for (let cx = c0; cx <= c1; cx++) {
        const px = this.x0 + (cx + 0.5) / CELLE_PER_METRO, pz = this.z0 + (rz + 0.5) / CELLE_PER_METRO;
        if (Math.hypot(px - x, pz - z) <= r) this._rivela(rz * this.colonne + cx, livello);
      }
    }
  }

  /** Tutto colorato (livello 1) o tutto bianco (0), subito. */
  coloraTutto(livello) {
    for (let i = 0; i < this.obiettivo.length; i++) {
      this.obiettivo[i] = this.rivelazione[i] = livello;
      this.visitato[i] = livello > 0 ? 1 : 0;
      this.ultimoTocco[i] = this.tempo;
    }
  }

  /**
   * Una nuova onda in (x, z).
   * opz: { velocita, raggio, forza, colore, livello, tipo, magica }
   *   tipo: 'bastone' | 'abbaio' | 'profumo' | 'suono' | 'magia' | 'passo'
   *   (serve per scegliere le particelle che accompagnano l'onda)
   * Le caselle vengono ordinate per distanza: man mano che l'anello si
   * allarga, le coloriamo una dopo l'altra.
   */
  creaOnda(x, z, opz) {
    const onda = {
      x, z, r: 0, raggio: opz.raggio, velocita: opz.velocita, forza: opz.forza,
      colore: new THREE.Color(opz.colore), livello: opz.livello || 0, celle: [], prossima: 0,
      tipo: opz.tipo || 'suono', magica: !!opz.magica, y: opz.y || 0, accumulo: 0,
    };
    if (onda.livello > 0) {
      const R = onda.raggio;
      const c0 = Math.max(0, Math.floor((x - R - this.x0) * CELLE_PER_METRO));
      const c1 = Math.min(this.colonne - 1, Math.floor((x + R - this.x0) * CELLE_PER_METRO));
      const r0 = Math.max(0, Math.floor((z - R - this.z0) * CELLE_PER_METRO));
      const r1 = Math.min(this.righe - 1, Math.floor((z + R - this.z0) * CELLE_PER_METRO));
      for (let rz = r0; rz <= r1; rz++) {
        for (let cx = c0; cx <= c1; cx++) {
          const px = this.x0 + (cx + 0.5) / CELLE_PER_METRO, pz = this.z0 + (rz + 0.5) / CELLE_PER_METRO;
          const d = Math.hypot(px - x, pz - z);
          if (d <= R) onda.celle.push({ i: rz * this.colonne + cx, d });
        }
      }
      onda.celle.sort((a, b) => a.d - b.d);
    }
    this.onde.push(onda);
    if (this.onde.length > 8) this.onde.shift();
    return onda;
  }

  /** A ogni fotogramma: allarga le onde, colora, sbiadisce. "tatto" = {x, z} di Lia. */
  aggiorna(dt, tatto) {
    const P = CONFIG.percezione;
    this.tempo += dt;
    for (const o of this.onde) {
      o.r += o.velocita * dt;
      while (o.prossima < o.celle.length && o.celle[o.prossima].d <= o.r) {
        this._rivela(o.celle[o.prossima].i, o.livello);
        o.prossima++;
      }
    }
    this.onde = this.onde.filter((o) => o.r < o.raggio + 1);
    // Lia sente sempre ciò che ha intorno (tatto, passi)
    if (tatto) this.rivelaCerchio(tatto.x, tatto.z, P.raggioTatto, 0.95);

    const su = P.velocitaComparsa * dt, giu = P.velocitaScomparsa * dt;
    const calo = dt / 20;
    const spegni = dt / 2.4;   // quanto dura il "brillio" di una zona appena scoperta
    for (let i = 0; i < this.rivelazione.length; i++) {
      const minimo = this.visitato[i] ? this.livelloRicordo : 0;
      if (this.tempo - this.ultimoTocco[i] > P.durataRicordo && this.obiettivo[i] > minimo) {
        this.obiettivo[i] = Math.max(minimo, this.obiettivo[i] - calo);
      }
      if (this.obiettivo[i] < minimo) this.obiettivo[i] = minimo;
      const diff = this.obiettivo[i] - this.rivelazione[i];
      this.rivelazione[i] += diff > 0 ? Math.min(diff, su) : Math.max(diff, -giu);
      // una zona che si sta colorando adesso "brilla" (vedi lo shader in materiali.js)
      if (diff > 0.04) this.fresco[i] = 1;
      else if (this.fresco[i] > 0) this.fresco[i] = Math.max(0, this.fresco[i] - spegni);
      this.dati[i * 4] = Math.round(Math.max(this.rivelazione[i], this.rivelaTutto) * 255);
      this.dati[i * 4 + 1] = Math.round(this.fresco[i] * 255);
    }
    this.texture.needsUpdate = true;
  }

  /** Copia le onde negli uniform degli shader; restituisce quante sono. */
  scriviOnde(uOnde, uColori) {
    let n = 0;
    for (const o of this.onde) {
      if (n >= uOnde.length) break;
      const t = o.r / o.raggio;
      uOnde[n].set(o.x, o.z, o.r, Math.max(0, o.forza * (1 - t * t)));
      uColori[n].copy(o.colore);
      n++;
    }
    return n;
  }
}
