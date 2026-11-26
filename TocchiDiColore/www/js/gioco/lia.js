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
 *      (dove il giocatore tocca lo schermo: vedi toccaPunto)
 *    - sbattere contro le cose che non "vede" (nel mondo bianco)
 *    - posare: ascoltare, chinarsi, sorprendersi, salutare
 *    - andare da sola in un punto (vaiA), durante le scene della storia
 * ========================================================================== */
import { CONFIG } from '../config.js';
import { Sagoma } from '../motore/sagoma.js';
import { vistaDa, scegliFotogramma, conta } from './attori.js';
import { Audio } from './audio.js';

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
    this.comete = [];           // le magie lanciate con la bacchetta, in volo
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
    // i simboli manga sopra la testa, a seconda dell'emozione
    const simbolo = { sorpresa: '!', urto: 'goccia', ascolta: 'puntini', saluta: 'stelline', china: 'cuore' }[nome];
    if (simbolo && this.gioco.effetti) this.gioco.effetti.simbolo(simbolo, this, nome === 'ascolta' ? 2.5 : 1.6);
  }

  /** Mette Lia in una nuova scena, al punto s, rivolta in avanti (+1) o indietro (-1). */
  entra(scena, s, verso) {
    this.scena = scena;
    this.s = s;
    this.verso = verso || 1;
    this.vel = 0;
    this.comete = [];
    this.meta = null;
    this.limiti = null;
    this._calcolaPosizione();
  }

  _calcolaPosizione() {
    const P = this.scena.percorso;
    const p = P.puntoLaterale(this.s);   // vicino al muro, dove serve
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
    this._aggiornaComete(dt);
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
    const ostacolo = this.scena.ostacoloTra(this.s, nuova);
    if (ostacolo && this.meta) {
      // camminando da sola non si fa male: la cosa "spunta" davanti a lei,
      // con un sobbalzo di sorpresa, e Lia prosegue
      this.posa('sorpresa', 0.8);
      this.gioco.regista.emetti('urto', ostacolo);
    } else if (ostacolo) {
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
    const lungPasso = this.corre ? 0.85 : 0.42;    // metri per un ciclo completo (passi corti da bambina)
    const prima = Math.floor(this.passo * 2);
    this.passo += fatta / lungPasso;
    if (Math.floor(this.passo * 2) !== prima) {
      Audio.passo(this.scena.superficie(this.s), Math.floor(this.passo * 2) % 2);
      if (this.puoToccare) this.gioco.onda(this.x, this.z, 'passo');
      // la streghetta lascia dietro di sé fiorellini che sbocciano e svaniscono
      if (this.magica) {
        this.gioco.particelle.emetti(this.x, this.y + 0.03, this.z + 0.05, 2, {
          forma: 13, colori: ['#f7a8c8', '#fff3a8', '#c9b6ea', '#a8d8ff'], velocita: 0.08, su: 0.12, gravita: 0, vita: 1.6, dim: 0.09, rotazione: 0.3,
        });
      }
    }
  }

  /** "Toc toc": colpo di bastone davanti ai piedi (forza = anche durante le scene). */
  tocca(forza) {
    if (!forza && (!this.puoToccare || this.ricarica > 0 || !this.controllo)) return false;
    this._preparaColpo();
    // Che cosa tocca il bastone? Se c'è un muro a portata, un colpo sul muro e
    // uno per terra, alternati (come chi cammina con il bastone lungo una parete)
    const S = this.scena;
    const mat = S.materiale(this.s);
    const muroVicino = mat.muro && (mat.vicino || S.percorso.scostamento(this.s) > 0.35);
    const sulMuro = !!muroVicino && this.colpi % 2 === 0;
    if (sulMuro) {
      const n = S.percorso.normale(this.s);
      this._colpo(this.x + n.x * 0.6 + this.tangente.x * this.verso * 0.15, this.y + 0.55,
        this.z + n.z * 0.6 + this.tangente.z * this.verso * 0.15, mat.muro, true);
    } else {
      this._colpo(this.x + this.tangente.x * this.verso * 0.5, this.y + 0.06,
        this.z + this.tangente.z * this.verso * 0.5, mat.terra, false);
    }
    return true;
  }

  /**
   * IL DITO SULLO SCHERMO: Lia batte il bastone (o lancia la magia della
   * bacchetta) proprio nel punto toccato, e il mondo si rivela da lì.
   *   punto  { x, y, z } nel mondo (calcolato da main.js con un raggio)
   *   info   { muro, materiale, acqua } che cosa c'è in quel punto
   * Con il BASTONCINO arriva solo vicino a sé (CONFIG.bacchetta.portata);
   * con la BACCHETTA MAGICA una cometa di luce vola fino al punto lontano.
   */
  toccaPunto(punto, info) {
    if (!this.puoToccare || this.ricarica > 0 || !this.controllo) return false;
    info = info || {};
    const B = CONFIG.bacchetta;
    const S = this.scena;
    let { x, y, z } = punto;
    let muro = !!info.muro;
    // --- quanto lontano arriva? -------------------------------------------
    const portata = this.magica ? B.portataMagica : B.portata;
    let dx = x - this.x, dz = z - this.z;
    let d = Math.hypot(dx, dz);
    if (d > portata) {
      // troppo lontano: il colpo arriva fin dove può, nella stessa direzione
      const k = portata / d;
      x = this.x + dx * k; z = this.z + dz * k;
      dx *= k; dz *= k; d = portata;
      if (!this.magica) { muro = false; y = S.quota(x, z) + 0.06; }
    }
    // il bastoncino non arriva in alto sui muri
    if (!this.magica) y = Math.min(y, this.y + 1.1);
    // --- si gira verso il punto toccato -------------------------------------
    const lungo = dx * this.tangente.x + dz * this.tangente.z;
    if (Math.abs(lungo) > 0.2 && Math.abs(this.vel) < 0.3) this.verso = Math.sign(lungo);
    // --- di che cosa è fatto? -------------------------------------------------
    const mat = S.materiale(S.percorso.piuVicino(x, z).s);
    const materiale = info.materiale || (muro ? (mat.muro || 'intonaco') : mat.terra);
    this._preparaColpo();
    if (this.magica && d > B.distanzaCometa) {
      // la cometa: parte dalla punta della bacchetta e vola ad arco fino al punto
      const punta = this.punta();
      const durata = Math.min(0.75, 0.2 + d * 0.035);
      this.comete.push({ da: punta, a: [x, y, z], t: 0, durata, alto: 0.35 + d * 0.06, materiale, muro, scia: 0 });
      Audio.magia(0.35);
      // la camera "segue con lo sguardo" la magia che vola lontano
      if (d > 4 && this.gioco.regia.occhiata) this.gioco.regia.occhiata([x, y, z], durata + 1.0, Math.min(0.35, 0.12 + d * 0.012));
    } else {
      this._colpo(x, y, z, materiale, muro);
    }
    return true;
  }

  /** Dov'è la punta del bastone/bacchetta (un po' davanti e in alto). */
  punta() {
    return [this.x + this.tangente.x * this.verso * 0.32, this.y + 0.62, this.z + this.tangente.z * this.verso * 0.32 + 0.03];
  }

  _preparaColpo() {
    this.ricarica = CONFIG.ricaricaBastone;
    this.tempoTocco = DURATA_TOCCO;
    this.colpi++;
  }

  /** Il colpo vero e proprio nel punto (x, y, z): suono, scritta, onda, magia. */
  _colpo(ox, oy, oz, materiale, muro) {
    this.colpoMuro = !!muro;
    Audio.tocco(materiale, ox, oz);
    // il suono si vede: una scritta da fumetto del colore del materiale
    const TESTI = { pietra: 'TOC', mattoni: 'TUC', legno: 'TOK!', intonaco: 'TUP', vetro: 'TIN!', metallo: 'DONG!',
      foglie: 'FRUSH', ceramica: 'TINK', libri: 'FLAP', acqua: 'PLIP' };
    const colori = { pietra: '#f6c95a', mattoni: '#f08a6a', legno: '#d9984f', intonaco: '#f4b98a', vetro: '#7fc6f0',
      metallo: '#9fb4e0', foglie: '#7fbf6a', ceramica: '#8fb4ea', libri: '#d9b98a', acqua: '#7fc6f0' };
    this.gioco.effetti.onomatopea(TESTI[materiale] || 'TOC', ox, oy + 0.6, oz, colori[materiale] || '#f6c95a', 0.85);
    if (this.magica) this.gioco.effetti.spirale(ox, oy, oz, colori[materiale] || '#ffd36b', { raggio: 0.35, altezza: 1.3, giri: 2, larghezza: 0.07, durata: 1.4 });
    // l'onda (e lo spettacolo di particelle) prendono il colore del materiale: vedi gioco/magia.js
    this.gioco.onda(ox, oz, 'bastone', { materiale, y: oy });
    this.gioco.magia.colpo(materiale, ox, oy, oz);
    this.gioco.regista.emetti('tocco', { x: ox, z: oz, materiale, muro: this.colpoMuro });
  }

  /** Le comete di luce in volo (bacchetta magica): si muovono e, arrivate, colpiscono. */
  _aggiornaComete(dt) {
    for (const c of this.comete) {
      c.t += dt / c.durata;
      const k = Math.min(1, c.t);
      const e = 1 - (1 - k) * (1 - k);             // parte veloce e rallenta un poco
      const px = c.da[0] + (c.a[0] - c.da[0]) * e;
      const py = c.da[1] + (c.a[1] - c.da[1]) * e + Math.sin(Math.PI * k) * c.alto;
      const pz = c.da[2] + (c.a[2] - c.da[2]) * e;
      // la scia: stelline e scintille che restano a mezz'aria e si spengono
      c.scia -= dt;
      if (c.scia <= 0 && this.gioco.luci) {
        c.scia = 0.016;
        this.gioco.luci.emetti(px, py, pz, 3, { forma: [1, 2], colori: ['#fff6c8', '#ffd36b', '#f7a8c8', '#a8d8ff'], velocita: 0.25, su: 0.05, gravita: -0.1, vita: 0.7, dim: 0.13 });
      }
      if (c.t >= 1) {
        c.finita = true;
        this._colpo(c.a[0], c.a[1], c.a[2], c.materiale, c.muro);
        if (this.gioco.luci) this.gioco.luci.emetti(c.a[0], c.a[1], c.a[2], 22, { forma: [1, 2], colori: ['#fff6c8', '#ffd36b', '#ffffff'], velocita: 1.6, su: 0.6, gravita: 0.6, vita: 0.9, dim: 0.14 });
      }
    }
    if (this.comete.length) this.comete = this.comete.filter((c) => !c.finita);
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
