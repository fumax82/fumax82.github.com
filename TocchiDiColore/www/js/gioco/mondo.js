/* ==========================================================================
 *  mondo.js — UN LUOGO DEL GIOCO: GRIGLIA, COLLISIONI E PERCEZIONE
 *  --------------------------------------------------------------------------
 *  Ogni luogo (la via, la città immaginata, il forno...) è una griglia di
 *  caselle letta dalla sua mappa di caratteri. Per ogni casella sappiamo:
 *    - se c'è un MURO (e quanto è alto)
 *    - che PAVIMENTO c'è (e a che quota: il marciapiede è rialzato,
 *      il canale è più basso, il ponte è più alto)
 *    - quanto Lia la PERCEPISCE (0 = bianco, 1 = a colori)
 *
 *  La percezione cresce con le ONDE (bastone, abbai, profumi...) e col tatto,
 *  poi lentamente sbiadisce fino al livello del "ricordo".
 *  La griglia della percezione viene copiata in una piccola texture (uRiv)
 *  che gli shader usano per colorare il mondo.
 * ========================================================================== */
import * as THREE from 'three';
import { MURI, PAVIMENTI } from '../dati/tipi.js';
import { Galleria } from '../arte/galleria.js';
import { CONFIG } from '../config.js';

export class Mondo {
  constructor(luogo) {
    this.luogo = luogo;
    const righe = luogo.mappa;
    this.altezza = righe.length;
    this.larghezza = Math.max(...righe.map((r) => r.length));
    const n = this.larghezza * this.altezza;
    const legendaMuri = { ...MURI, ...(luogo.legendaMuri || {}) };
    const legendaPav = { ...PAVIMENTI, ...(luogo.legendaPavimenti || {}) };
    const pavimentoBase = legendaPav[luogo.pavimentoSottoMuri || '.'] || PAVIMENTI['.'];

    this.muro = new Array(n).fill(null);        // nome della texture del muro
    this.altezzaMuro = new Float32Array(n);     // 0 = nessun muro
    this.pavimento = new Array(n).fill(null);   // definizione del pavimento
    this.quotaCella = new Float32Array(n);
    this.calpestabile = new Uint8Array(n);

    for (let y = 0; y < this.altezza; y++) {
      for (let x = 0; x < this.larghezza; x++) {
        const car = righe[y][x] === undefined ? ' ' : righe[y][x];
        const i = y * this.larghezza + x;
        if (legendaMuri[car]) {
          this.muro[i] = legendaMuri[car];
          this.altezzaMuro[i] = Galleria.muro(legendaMuri[car]).altezza;
          this.pavimento[i] = pavimentoBase;
          this.quotaCella[i] = 0;
        } else if (legendaPav[car]) {
          const p = legendaPav[car];
          this.pavimento[i] = p;
          this.quotaCella[i] = p.quota || 0;
          this.calpestabile[i] = p.calpestabile === false ? 0 : 1;
        } else {
          throw new Error('Carattere "' + car + '" sconosciuto nella mappa di ' + luogo.id + ' (riga ' + y + ', colonna ' + x + ')');
        }
      }
    }

    // Percezione
    this.rivelazione = new Float32Array(n);
    this.obiettivo = new Float32Array(n);
    this.visitato = new Uint8Array(n);
    this.ultimoTocco = new Float32Array(n);
    this.livelloRicordo = CONFIG.percezione.livelloRicordo;
    this.rivelaTutto = 0;      // se 1 tutto è visibile (prologo, finale)
    this.tempo = 0;
    this.onde = [];
    this.solidi = [];          // oggetti con ingombro (alberi, lampioni...)

    // Texture della percezione: R = percezione, G = vicinanza ai muri
    this.datiRiv = new Uint8Array(n * 4);
    this.textureRiv = new THREE.DataTexture(this.datiRiv, this.larghezza, this.altezza, THREE.RGBAFormat);
    this.textureRiv.magFilter = THREE.LinearFilter;
    this.textureRiv.minFilter = THREE.LinearFilter;
    this.textureRiv.wrapS = this.textureRiv.wrapT = THREE.ClampToEdgeWrapping;
    this._calcolaOmbreMuri();
    this.textureRiv.needsUpdate = true;
  }

  /* ---------------------------------------------------------------------- */
  /*  Domande sul mondo                                                     */
  /* ---------------------------------------------------------------------- */
  indice(cx, cy) {
    return cy * this.larghezza + cx;
  }

  dentro(cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.larghezza && cy < this.altezza;
  }

  /** Altezza del terreno nel punto (x, y). */
  quota(x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.dentro(cx, cy)) return 0;
    return this.quotaCella[this.indice(cx, cy)];
  }

  /** Si può camminare nel punto (x, y) partendo da una quota "daQuota"? */
  libero(x, y, daQuota) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.dentro(cx, cy)) return false;
    const i = this.indice(cx, cy);
    if (this.altezzaMuro[i] > 0 || !this.calpestabile[i]) return false;
    if (daQuota !== undefined && Math.abs(this.quotaCella[i] - daQuota) > CONFIG.giocatore.gradinoMassimo) return false;
    return true;
  }

  /** La telecamera può stare in (x, y) a quell'altezza? */
  bloccaCamera(x, y, z) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.dentro(cx, cy)) return true;
    const i = this.indice(cx, cy);
    if (this.luogo.soffitto && z > this.luogo.soffitto.altezza - 0.15) return true;
    return this.altezzaMuro[i] > z - 0.12;
  }

  /** Linea libera tra due punti? I muri più bassi di "altezzaMinima" non bloccano. */
  lineaDiVista(x0, y0, x1, y1, altezzaMinima, cellaObiettivo) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const passi = Math.ceil(d * 4);
    for (let k = 1; k < passi; k++) {
      const t = k / passi;
      const cx = Math.floor(x0 + (x1 - x0) * t), cy = Math.floor(y0 + (y1 - y0) * t);
      if (!this.dentro(cx, cy)) return false;
      const i = this.indice(cx, cy);
      if (i === cellaObiettivo) return true;
      if (this.altezzaMuro[i] >= altezzaMinima) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------------- */
  /*  Percezione                                                            */
  /* ---------------------------------------------------------------------- */
  rivela(i, livello) {
    if (this.obiettivo[i] < livello) this.obiettivo[i] = livello;
    this.visitato[i] = 1;
    this.ultimoTocco[i] = this.tempo;
  }

  rivelaCerchio(x, y, raggio, livello) {
    const x0 = Math.max(0, Math.floor(x - raggio)), x1 = Math.min(this.larghezza - 1, Math.floor(x + raggio));
    const y0 = Math.max(0, Math.floor(y - raggio)), y1 = Math.min(this.altezza - 1, Math.floor(y + raggio));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= raggio) this.rivela(this.indice(cx, cy), livello);
      }
    }
  }

  /** Rende tutto il luogo visibile di colpo (o lo riporta al bianco). */
  coloraTutto(livello) {
    for (let i = 0; i < this.obiettivo.length; i++) {
      this.obiettivo[i] = livello;
      this.rivelazione[i] = livello;
      this.visitato[i] = livello > 0 ? 1 : 0;
      this.ultimoTocco[i] = this.tempo;
    }
  }

  /**
   * Crea un'onda di percezione in (x, y).
   * opz: { velocita, raggio, forza, colore, livello, attraversaMuri }
   * Calcoliamo subito quali caselle potrà raggiungere (non nascoste dai muri
   * alti) e le riveliamo man mano che l'anello si allarga.
   */
  creaOnda(x, y, opz) {
    const onda = {
      x, y, r: 0,
      raggio: opz.raggio, velocita: opz.velocita, forza: opz.forza,
      colore: new THREE.Color(opz.colore), livello: opz.livello || 0,
      celle: [], prossima: 0,
    };
    if (onda.livello > 0) {
      const R = onda.raggio;
      const x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(this.larghezza - 1, Math.floor(x + R));
      const y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(this.altezza - 1, Math.floor(y + R));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
          if (d > R + 0.5) continue;
          const i = this.indice(cx, cy);
          if (opz.attraversaMuri || this.lineaDiVista(x, y, cx + 0.5, cy + 0.5, 2.0, i)) {
            onda.celle.push({ i, d: Math.max(0, d - 0.6) });
          }
        }
      }
      onda.celle.sort((a, b) => a.d - b.d);
    }
    this.onde.push(onda);
    if (this.onde.length > 8) this.onde.shift();
    return onda;
  }

  /** Aggiornamento a ogni fotogramma. */
  aggiorna(dt, giocatore) {
    const P = CONFIG.percezione;
    this.tempo += dt;

    for (const o of this.onde) {
      o.r += o.velocita * dt;
      while (o.prossima < o.celle.length && o.celle[o.prossima].d <= o.r) {
        this.rivela(o.celle[o.prossima].i, o.livello);
        o.prossima++;
      }
    }
    this.onde = this.onde.filter((o) => o.r < o.raggio + 1);

    if (giocatore) this.rivelaCerchio(giocatore.x, giocatore.y, P.raggioTatto, 0.95);

    const su = P.velocitaComparsa * dt, giu = P.velocitaScomparsa * dt;
    const calo = dt / 20;
    for (let i = 0; i < this.rivelazione.length; i++) {
      const minimo = this.visitato[i] ? this.livelloRicordo : 0;
      // dopo un po' che non la "tocchiamo", una casella sbiadisce fino al ricordo
      if (this.tempo - this.ultimoTocco[i] > P.durataRicordo && this.obiettivo[i] > minimo) {
        this.obiettivo[i] = Math.max(minimo, this.obiettivo[i] - calo);
      }
      if (this.obiettivo[i] < minimo) this.obiettivo[i] = minimo;
      const diff = this.obiettivo[i] - this.rivelazione[i];
      this.rivelazione[i] += diff > 0 ? Math.min(diff, su) : Math.max(diff, -giu);
      this.datiRiv[i * 4] = Math.round(Math.max(this.rivelazione[i], this.rivelaTutto) * 255);
    }
    this.textureRiv.needsUpdate = true;
  }

  /** Copia le onde attive negli "uniform" degli shader. Restituisce quante sono. */
  scriviOnde(uniformOnde, uniformColori) {
    let n = 0;
    for (const o of this.onde) {
      if (n >= uniformOnde.length) break;
      const t = o.r / o.raggio;
      uniformOnde[n].set(o.x, o.y, o.r, Math.max(0, o.forza * (1 - t * t)));
      uniformColori[n].copy(o.colore);
      n++;
    }
    return n;
  }

  /** Calcola (una volta) quanto ogni casella è vicina a un muro alto: ombra morbida. */
  _calcolaOmbreMuri() {
    for (let y = 0; y < this.altezza; y++) {
      for (let x = 0; x < this.larghezza; x++) {
        let vicino = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (this.dentro(nx, ny) && this.altezzaMuro[this.indice(nx, ny)] > 1.0) vicino += 0.5;
        }
        this.datiRiv[this.indice(x, y) * 4 + 1] = Math.min(1, vicino) * 255;
        this.datiRiv[this.indice(x, y) * 4 + 3] = 255;
      }
    }
  }
}
