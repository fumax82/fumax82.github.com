/* ==========================================================================
 *  lia.js — LA PROTAGONISTA
 *  --------------------------------------------------------------------------
 *  Lia si muove come nei giochi a piattaforme: avanti e indietro lungo il
 *  PERCORSO della scena (vedi percorso.js). Il giocatore decide solo
 *  "destra" o "sinistra" (sul percorso: avanti o indietro); è la regia
 *  delle telecamere a mostrarla da angolazioni sempre diverse.
 *
 *  Sa fare:
 *    - camminare (e correre, se si tiene premuto a lungo o con Shift)
 *    - "toc toc": batte il bastone (o la bacchetta) → un'onda colora il mondo
 *    - sbattere contro le cose che non "vede" (nel mondo bianco)
 *    - posare: ascoltare, chinarsi, sorprendersi, salutare
 *    - andare da sola in un punto (vaiA), durante le scene della storia
 * ========================================================================== */
import { CONFIG } from '../config.js';
import { Sagoma } from '../motore/sagoma.js';
import { vistaDa, scegliFotogramma, conta } from './attori.js';
import { Audio } from './audio.js';
import { FORME } from '../motore/particelle.js';

const DURATA_TOCCO = 0.42;

export class Lia {
  constructor(gioco) {
    this.gioco = gioco;
    this.id = 'lia';
    this.nome = 'Lia';
    this.costume = 'lia_borsa';
    this.sagoma = new Sagoma(this.costume, { ombra: 0.3 });
    this.scena = null;
    this.s = 0;                 // posizione sul percorso (metri)
    this.verso = 1;             // +1 avanti sul percorso, -1 indietro
    this.vel = 0;               // velocità con segno lungo il percorso
    this.x = 0; this.y = 0; this.z = 0;
    this.tangente = { x: 1, z: 0 };
    this.passo = 0;             // fase della camminata (cicli)
    this.tAnim = 0;
    this.tempoPremuto = 0;      // da quanto si tiene premuto: dopo un po' si corre
    this.controllo = true;
    this.puoToccare = false;
    this.magica = false;
    this.ricarica = 0;
    this.tempoTocco = 0;
    this.colpi = 0;
    this.posaSpeciale = null;
    this.tempoPosa = 0;
    this.meta = null;           // pilota automatico: { s, vel, ok }
    this.urtato = 0;
    this.limiti = null;         // [sMin, sMax] se la storia vuole trattenerla
    this.nascosta = false;
    this.corre = false;
    this.inMovimento = false;
  }

  aggiungiA(gruppo) { this.sagoma.aggiungiA(gruppo); }

  /** Cambia vestito: 'lia_borsa', 'lia' o 'lia_strega'. */
  vestiti(costume) {
    this.costume = costume;
    this.sagoma.cambiaAtlante(costume);
  }

  /** Posa speciale ('ascolta', 'china', 'sorpresa', 'urto', 'saluta', 'fronte'...). */
  posa(nome, durata) {
    this.posaSpeciale = nome;
    this.tempoPosa = durata === undefined ? 1 : durata;
    this.tPosa = 0;
  }

  /** Mette Lia in una nuova scena, al punto s, rivolta in avanti (+1) o indietro (-1). */
  entra(scena, s, verso) {
    this.scena = scena;
    this.s = s;
    this.verso = verso || 1;
    this.vel = 0;
    this.meta = null;
    this.limiti = null;
    this._calcolaPosizione();
  }

  _calcolaPosizione() {
    const P = this.scena.percorso;
    const p = P.punto(this.s);
    this.x = p.x; this.y = p.y; this.z = p.z;
    this.tangente = P.tangente(this.s);
  }

  /** Il pilota automatico: va fino al punto s del percorso. */
  vaiA(s, velocita) {
    if (this.meta) this.meta.ok();
    return new Promise((ok) => { this.meta = { s, vel: velocita || CONFIG.giocatore.velocita, ok }; });
  }

  /**
   * A ogni fotogramma. "dir" = -1, 0, +1 (sinistra/destra sullo schermo
   * già convertite in indietro/avanti sul percorso); corsa = Shift.
   */
  aggiorna(dt, dir, corsa) {
    const C = CONFIG.giocatore;
    const P = this.scena.percorso;
    this.tAnim += dt;
    this.ricarica = Math.max(0, this.ricarica - dt);
    this.tempoTocco = Math.max(0, this.tempoTocco - dt);
    this.urtato = Math.max(0, this.urtato - dt);
    if (this.tPosa !== undefined) this.tPosa += dt;
    if (this.tempoPosa !== Infinity && this.posaSpeciale) {
      this.tempoPosa -= dt;
      if (this.tempoPosa <= 0) this.posaSpeciale = null;
    }

    // --- quanto veloce vuole andare ---------------------------------------
    let voluta = 0;
    if (this.meta) {
      const d = this.meta.s - this.s;
      if (Math.abs(d) < 0.03) {
        this.s = this.meta.s; this.vel = 0;
        const ok = this.meta.ok; this.meta = null; ok();
      } else {
        voluta = Math.sign(d) * Math.min(this.meta.vel, Math.abs(d) * 4 + 0.3);
        this.verso = Math.sign(d);
      }
      this.corre = Math.abs(voluta) > C.velocita * 1.3;
    } else if (dir && this.controllo && this.urtato <= 0 && this.tempoTocco <= 0.1) {
      this.tempoPremuto += dt;
      this.corre = corsa || this.tempoPremuto > C.tempoPerCorrere;
      voluta = dir * (this.corre ? C.velocitaCorsa : C.velocita);
      this.verso = dir;
    } else {
      this.tempoPremuto = 0;
      this.corre = false;
    }
    // accelera e frena con dolcezza (niente scatti)
    const acc = voluta === 0 ? C.frenata : C.accelerazione;
    this.vel += Math.sign(voluta - this.vel) * Math.min(Math.abs(voluta - this.vel), acc * dt);

    // --- muoviamoci, rispettando i limiti e gli ostacoli -------------------
    let nuova = this.s + this.vel * dt;
    const min = Math.max(0.15, this.limiti ? this.limiti[0] : 0);
    const max = Math.min(P.lunghezza - 0.15, this.limiti ? this.limiti[1] : Infinity);
    if (nuova < min || nuova > max) {
      nuova = Math.max(min, Math.min(max, nuova));
      if (Math.abs(this.vel) > 0.3 && !this.meta) this.gioco.regista.emetti('bordo', this.vel > 0 ? 1 : -1);
      this.vel = 0;
    }
    const ostacolo = this.meta ? null : this.scena.ostacoloTra(this.s, nuova);
    if (ostacolo) {
      nuova = ostacolo.s - Math.sign(this.vel) * 0.42;
      this.vel = -Math.sign(this.vel) * 0.6;   // un piccolo rimbalzo all'indietro
      this.urtato = 0.7;
      this.posa('urto', 0.8);
      this.gioco.regista.emetti('urto', ostacolo);
    }
    const fatta = Math.abs(nuova - this.s);
    this.s = nuova;
    this._calcolaPosizione();
    this.inMovimento = fatta > 0.0005;

    // --- passi (e un'onda leggera a ogni passo, quando può "sentire") ------
    const lungPasso = this.corre ? 1.5 : 0.95;     // metri per un ciclo completo
    const prima = Math.floor(this.passo * 2);
    this.passo += fatta / lungPasso;
    if (Math.floor(this.passo * 2) !== prima) {
      Audio.passo(this.scena.superficie(this.s), Math.floor(this.passo * 2) % 2);
      if (this.puoToccare) this.gioco.onda(this.x, this.z, 'passo');
    }
  }

  /** "Toc toc": colpo di bastone davanti ai piedi (forza = anche durante le scene). */
  tocca(forza) {
    if (!forza && (!this.puoToccare || this.ricarica > 0 || !this.controllo)) return false;
    this.ricarica = CONFIG.ricaricaBastone;
    this.tempoTocco = DURATA_TOCCO;
    this.colpi++;
    const ox = this.x + this.tangente.x * this.verso * 0.5, oz = this.z + this.tangente.z * this.verso * 0.5;
    this.gioco.onda(ox, oz, 'bastone');
    Audio.toc(this.magica);
    this.gioco.particelle.emetti(ox, this.y + 0.06, oz, this.magica ? 26 : 10, {
      forma: this.magica ? [FORME.stella, FORME.scintilla, FORME.punto] : [FORME.punto, FORME.scintilla],
      colori: this.magica ? ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'] : ['#fff6d8', '#ffe39a'],
      velocita: 1.6, su: 1.3, gravita: 1.6, vita: 1.1, dim: this.magica ? 0.2 : 0.14,
    });
    this.gioco.regista.emetti('tocco', { x: ox, z: oz });
    return true;
  }

  /** Il punto della mano (per il guinzaglio), un po' davanti a lei sullo schermo. */
  mano(camera) {
    const e = camera.matrixWorld.elements;     // colonna 0 = destra della camera
    const verso = (this.tangente.x * this.verso * e[0] + this.tangente.z * this.verso * e[2]) >= 0 ? 1 : -1;
    return [this.x + e[0] * 0.14 * verso, this.y + 0.5, this.z + e[2] * 0.14 * verso + 0.02];
  }

  /** Sceglie il disegno giusto e lo mette al suo posto. */
  disegna(camera) {
    this.sagoma.visibile = !this.nascosta;
    if (this.nascosta) return;
    const at = this.sagoma.atlante;
    const dir = { x: this.tangente.x * this.verso, z: this.tangente.z * this.verso };
    const v = vistaDa(dir, camera);
    let nome;
    if (this.tempoTocco > 0) {
      const k = 1 - this.tempoTocco / DURATA_TOCCO;              // 0 → 1
      const n = Math.max(1, conta(at, 'lato_tocca'));
      nome = 'lato_tocca_' + Math.min(n - 1, Math.floor(k * n));
      v.vista = 'lato';
    } else if (this.posaSpeciale) {
      const p = this.posaSpeciale;
      const vista = p === 'saluta' || p === 'fronte' ? 'fronte' : (p === 'sorpresa' && v.vista === 'fronte') ? 'fronte' : 'lato';
      const s = scegliFotogramma(at, vista, p === 'fronte' ? 'fermo' : p, this.tPosa || 0, p === 'ascolta' ? 1.2 : 2.5);
      nome = s.nome;
      v.vista = s.vista;
    } else if (this.inMovimento) {
      const posa = this.corre ? 'corre' : 'cammina';
      const n = conta(at, v.vista + '_' + posa) || conta(at, v.vista + '_cammina');
      if (n) nome = v.vista + '_' + (conta(at, v.vista + '_' + posa) ? posa : 'cammina') + '_' + (Math.floor(this.passo * n) % n);
      else { v.vista = 'lato'; nome = scegliFotogramma(at, 'lato', posa, this.passo * conta(at, 'lato_' + posa), 1).nome; }
    } else {
      // da fermo: respira e ogni tanto sbatte le palpebre
      const s = scegliFotogramma(at, v.vista, 'fermo', this.tAnim, 2.4);
      nome = s.nome;
      v.vista = s.vista;
    }
    // i disegni di lato guardano a destra: se va verso sinistra li specchiamo
    let specchio = false;
    if (v.vista === 'lato') specchio = this._specchioLaterale(dir, camera);
    this.sagoma.mostra(nome, specchio);
    this.sagoma.quotaTerreno(this.y);
    this.sagoma.posiziona(this.x, this.y, this.z);
  }

  /** Per le viste di fronte/di spalle senza disegno: da che parte guarda di lato? */
  _specchioLaterale(dir, camera) {
    const e = camera.matrixWorld.elements;   // prima colonna = destra della camera
    return dir.x * e[0] + dir.z * e[2] < 0;
  }
}
