/* ==========================================================================
 *  giocatore.js — LIA
 *  --------------------------------------------------------------------------
 *  Movimento (con gradini e collisioni), passi, colpo di bastone,
 *  vestito (con la borsa, senza borsa, da streghetta) e posa da mostrare
 *  in terza persona.
 * ========================================================================== */
import { CONFIG } from '../config.js';
import { Sagoma } from '../motore/sagoma.js';
import { vistaDa } from './attori.js';
import { Audio } from './audio.js';
import { FORME } from '../motore/particelle.js';

const DURATA_TOCCO = 0.4;

export class Giocatore {
  constructor(gioco) {
    this.gioco = gioco;
    this.x = 0; this.y = 0; this.quota = 0;
    this.angolo = 0;
    this.inclinazione = 0;
    this.faseP = 0;
    this.inMovimento = false;
    this.corre = false;
    this.tempoTocco = 0;
    this.ricarica = 0;
    this.controllo = true;     // false durante le scene della storia
    this.puoToccare = false;   // diventa true quando trova il bastone
    this.magica = false;       // true quando il bastone è diventato bacchetta
    this.costume = 'lia_borsa';
    this.posaSpeciale = null;
    this.tempoPosa = 0;
    this.colpi = 0;
    this.sagoma = new Sagoma(this.costume, { ombra: 0.26, luce: 1 });
    this.mondo = null;
    this.urtoRecente = 0;
  }

  aggiungiA(gruppo) { this.sagoma.aggiungiA(gruppo); }

  vestiti(costume) {
    this.costume = costume;
    this.sagoma.cambiaAtlante(costume);
  }

  posiziona(x, y, angolo) {
    this.x = x; this.y = y;
    if (angolo !== undefined) this.angolo = angolo;
    this.quota = this.mondo ? this.mondo.quota(x, y) : 0;
  }

  posa(nome, durata) {
    this.posaSpeciale = nome;
    this.tempoPosa = durata === undefined ? 1 : durata;
  }

  /** Fa camminare Lia da sola fino a (x, y): serve nelle scene della storia. */
  vaiA(x, y, velocita) {
    return new Promise((ok) => { this.autopilota = { x, y, vel: velocita || 1.4, ok }; });
  }

  aggiorna(dt, mov, sguardo) {
    const C = CONFIG.giocatore;
    const mondo = this.mondo;
    if (this.tempoPosa !== Infinity) {
      this.tempoPosa -= dt;
      if (this.tempoPosa <= 0) this.posaSpeciale = null;
    }
    this.tempoTocco = Math.max(0, this.tempoTocco - dt);
    this.ricarica = Math.max(0, this.ricarica - dt);
    this.urtoRecente = Math.max(0, this.urtoRecente - dt);

    if (this.controllo) {
      this.angolo += mov.rotazione * C.velocitaRotazione * dt + sguardo.dx;
      this.inclinazione = Math.max(-CONFIG.camera.inclinazioneMassima, Math.min(CONFIG.camera.inclinazioneMassima, this.inclinazione - sguardo.dy));
    }

    // --- camminata automatica (durante le scene della storia) -------------
    if (this.autopilota) {
      const a = this.autopilota;
      const ddx = a.x - this.x, ddy = a.y - this.y, d = Math.hypot(ddx, ddy);
      const passo = a.vel * dt;
      const px0 = this.x, py0 = this.y;
      if (d > 0.01) this.angolo = Math.atan2(ddy, ddx);
      if (d <= passo) { this.x = a.x; this.y = a.y; this.autopilota = null; a.ok(); }
      else { this.x += (ddx / d) * passo; this.y += (ddy / d) * passo; }
      const fatto = Math.hypot(this.x - px0, this.y - py0);
      this.inMovimento = fatto > 0.0005;
      const prima = Math.floor(this.faseP);
      this.faseP += fatto * 1.7;
      if (Math.floor(this.faseP) !== prima) Audio.passo(this._superficie(), Math.floor(this.faseP) % 2);
      this.quota += (mondo.quota(this.x, this.y) - this.quota) * Math.min(1, dt * 14);
      return;
    }

    // --- movimento -------------------------------------------------------
    let avanti = this.controllo ? mov.avanti : 0, laterale = this.controllo ? mov.laterale : 0;
    const forza = Math.hypot(avanti, laterale);
    if (forza > 1) { avanti /= forza; laterale /= forza; }
    this.corre = mov.corsa && forza > 0.2;
    const v = this.corre ? C.velocitaCorsa : C.velocita;
    const fx = Math.cos(this.angolo), fy = Math.sin(this.angolo);
    const dx = (fx * avanti - fy * laterale) * v * dt;
    const dy = (fy * avanti + fx * laterale) * v * dt;
    const px = this.x, py = this.y;
    if (dx || dy) this._muovi(dx, dy);
    const percorso = Math.hypot(this.x - px, this.y - py);
    this.inMovimento = percorso > 0.0005;
    // la quota segue il terreno con dolcezza (salire sul marciapiede)
    const q = mondo.quota(this.x, this.y);
    this.quota += (q - this.quota) * Math.min(1, dt * 14);

    // --- passi ----------------------------------------------------------
    const prima = Math.floor(this.faseP);
    this.faseP += percorso * 1.7;
    if (Math.floor(this.faseP) !== prima) {
      Audio.passo(this._superficie(), Math.floor(this.faseP) % 2);
      if (this.puoToccare) mondo.creaOnda(this.x, this.y, CONFIG.onde.passo);
    }
  }

  /** Collisioni "separate per asse": così si scivola lungo i muri. */
  _muovi(dx, dy) {
    const r = CONFIG.giocatore.raggio;
    let urtato = false;
    if (!this._collide(this.x + dx, this.y, r)) this.x += dx; else urtato = true;
    if (!this._collide(this.x, this.y + dy, r)) this.y += dy; else urtato = true;
    if (urtato && this.urtoRecente <= 0 && Math.hypot(dx, dy) > 0.02) {
      this.urtoRecente = 0.6;
      this.gioco.regista.emetti('urto');
    }
  }

  _collide(x, y, r) {
    const m = this.mondo, q = this.quota;
    if (!m.libero(x - r, y - r, q) || !m.libero(x + r, y - r, q) || !m.libero(x - r, y + r, q) || !m.libero(x + r, y + r, q)) return true;
    for (const o of m.solidi) {
      const d = Math.hypot(x - o.x, y - o.y);
      if (d < r + o.raggio && d < Math.hypot(this.x - o.x, this.y - o.y)) return true;
    }
    for (const a of this.gioco.attoriSolidi()) {
      const d = Math.hypot(x - a.x, y - a.y);
      if (d < r + a.raggio && d < Math.hypot(this.x - a.x, this.y - a.y)) return true;
    }
    return false;
  }

  _superficie() {
    const m = this.mondo;
    const cx = Math.floor(this.x), cy = Math.floor(this.y);
    if (!m.dentro(cx, cy)) return 'pietra';
    const p = m.pavimento[m.indice(cx, cy)];
    const t = p && p.texture;
    if (t === 'erba') return 'erba';
    if (t === 'parquet') return 'legno';
    return 'pietra';
  }

  /** "Toc toc": colpo di bastone. Crea un'onda di percezione e scintille. */
  tocca() {
    if (!this.puoToccare || this.ricarica > 0 || !this.controllo) return false;
    this.ricarica = CONFIG.ricaricaBastone;
    this.tempoTocco = DURATA_TOCCO;
    this.colpi++;
    const px = this.x + Math.cos(this.angolo) * 0.45, py = this.y + Math.sin(this.angolo) * 0.45;
    const libero = this.mondo.libero(px, py);
    const ox = libero ? px : this.x, oy = libero ? py : this.y;
    this.mondo.creaOnda(ox, oy, CONFIG.onde.bastone);
    Audio.toc(this.magica);
    const g = this.gioco;
    g.particelle.emetti(ox, this.quota + 0.08, oy, this.magica ? 26 : 10, {
      forma: this.magica ? [FORME.stella, FORME.scintilla, FORME.punto] : [FORME.punto, FORME.scintilla],
      colori: this.magica ? ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'] : ['#fff6d8', '#ffe39a'],
      velocita: 1.6, su: 1.3, gravita: 1.6, vita: 1.1, dim: this.magica ? 0.22 : 0.16,
    });
    g.regista.emetti('tocco', { x: ox, y: oy });
    return true;
  }

  /** Fase dell'animazione del colpo: 0 → 1 → 0 */
  faseTocco() {
    return this.tempoTocco > 0 ? Math.sin((1 - this.tempoTocco / DURATA_TOCCO) * Math.PI) : 0;
  }

  /** Disegno in terza persona. */
  disegna(camX, camY, visibile) {
    this.sagoma.visibile = visibile;
    if (!visibile) return;
    const v = vistaDa(this.angolo, this.x, this.y, camX, camY);
    let posa = this.posaSpeciale || (this.tempoTocco > 0.05 ? 'tocca' : this.inMovimento ? 'cammina' : 'fermo');
    let n = 0;
    if (posa === 'cammina') n = Math.floor(this.faseP * 2) % 4;
    else if (posa === 'tocca') n = this.tempoTocco > DURATA_TOCCO / 2 ? 0 : 1;
    else if (posa === 'fermo') n = Math.floor(this.gioco.tempo * 0.7) % 2;
    this.sagoma.posa(v.vista, posa, n, v.specchio);
    this.sagoma.posiziona(this.x, this.y, this.quota);
  }
}
