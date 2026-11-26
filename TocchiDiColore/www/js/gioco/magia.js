/* ==========================================================================
 *  magia.js — LO SPETTACOLO DELLA RIVELAZIONE
 *  --------------------------------------------------------------------------
 *  Quando la bacchetta bussa, quando Gogo abbaia o arriva un profumo,
 *  il mondo si colora (vedi percezione.js e lo shader in materiali.js).
 *  Questo modulo rende quel momento uno spettacolo:
 *    - sul fronte di ogni onda nascono particelle a tema: stelle e
 *      fiorellini per la bacchetta, note per i suoni, petali per i profumi
 *    - il colpo di bacchetta increspa lo schermo, fa "respirare"
 *      l'inquadratura e suona una nota di carillon (bussando nasce una melodia)
 *    - quando l'onda scopre posti nuovi si sente un tintinnio
 *    - intorno a Lia streghetta volano lucciole e la bacchetta lascia una scia
 * ========================================================================== */
import * as THREE from 'three';
import { UNIFORMI } from '../motore/materiali.js';
import { FORME } from '../motore/particelle.js';
import { Audio } from './audio.js';

/*
 * Le particelle che accompagnano ogni tipo di onda.
 *   densita: quante particelle per metro di fronte (per secondo di vita)
 *   luce:    true = particelle di luce (brillano), false = dipinte
 *   inAria:  frazione di particelle che nascono a mezz'aria (sui muri)
 */
const SPETTACOLO = {
  bastone: {
    densita: 0.5, inAria: 0.35, luce: true,
    forma: [FORME.scintilla, FORME.punto, FORME.stella], colori: ['#fff3c0', '#ffe08a', '#ffffff'],
    opz: { velocita: 0.25, su: 0.5, gravita: 0.2, vita: 1.3, dim: 0.11 },
  },
  bastoneMagico: {
    densita: 0.8, inAria: 0.45, luce: true,
    forma: [FORME.stella, FORME.scintilla, FORME.punto, FORME.stella], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8', '#c9b6ea'],
    opz: { velocita: 0.35, su: 0.7, gravita: 0.15, vita: 1.7, dim: 0.15 },
    // e fiorellini dipinti che sbocciano per terra
    extra: { quota: 0.03, forma: [FORME.fiore, FORME.petalo], colori: ['#f7a8c8', '#ffd1e8', '#fff3a8', '#c9b6ea', '#a8d8ff'], opz: { velocita: 0.15, su: 0.35, gravita: 0.25, vita: 2.2, dim: 0.14 }, parte: 0.35 },
  },
  abbaio: {
    densita: 0.35, inAria: 0.8, luce: false,
    forma: [FORME.nota], colori: ['#e9875a', '#d9785e', '#f0a070'],
    opz: { velocita: 0.2, su: 0.8, gravita: 0, vita: 2.0, dim: 0.26, rotazione: 0.4 },
  },
  profumo: {
    densita: 0.6, inAria: 0.7, luce: false,
    forma: [FORME.petalo, FORME.fiore, FORME.petalo], colori: ['#f7a8c8', '#ffd1e8', '#fbe0ef', '#f2d49a'],
    opz: { velocita: 0.25, su: 0.25, gravita: 0.05, vita: 3.0, dim: 0.21, vortice: 0.9 },
  },
  suono: {
    densita: 0.35, inAria: 0.8, luce: false,
    forma: [FORME.nota], colori: ['#7fb6d8', '#a8d8ff', '#9fa8e8'],
    opz: { velocita: 0.2, su: 0.7, gravita: 0, vita: 2.0, dim: 0.25, rotazione: 0.4 },
  },
  urto: {
    densita: 0.9, inAria: 0.9, luce: false,
    forma: [FORME.foglia], colori: ['#8fc27f', '#6faa5e', '#b4dea1'],
    opz: { velocita: 0.5, su: 0.4, gravita: 0.6, vita: 1.8, dim: 0.16 },
  },
  magia: {
    densita: 0.35, inAria: 0.6, luce: true,
    forma: [FORME.stella, FORME.scintilla, FORME.anello], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'],
    opz: { velocita: 0.4, su: 0.9, gravita: 0.1, vita: 2.0, dim: 0.22 },
  },
};

/*
 * OGNI MATERIALE SI IMMAGINA A MODO SUO
 * Quando il bastone tocca qualcosa, Lia lo "vede" attraverso il suono:
 * il vetro tintinna e si colora di azzurro cristallino, il legno è caldo
 * come il miele, le foglie frusciano e fanno volare foglioline...
 *   colore: il colore dell'onda e della velatura
 *   forma/colori: le particelle sul fronte e nello schizzo del colpo
 *   dipinte: true = particelle dipinte (foglie, pagine), false = di luce
 */
export const MATERIALI = {
  pietra:   { colore: '#ffd36b', forma: [FORME.scintilla, FORME.punto, FORME.stella], colori: ['#fff3c0', '#ffe08a', '#ffffff'] },
  mattoni:  { colore: '#f4a37e', forma: [FORME.scintilla, FORME.punto, FORME.stella], colori: ['#ffd2b8', '#f7a07a', '#fff0d8'] },
  legno:    { colore: '#e9b872', forma: [FORME.foglia, FORME.punto], colori: ['#e9b872', '#c98d4a', '#f6d79a'], dipinte: true },
  intonaco: { colore: '#ffd9b0', forma: [FORME.petalo, FORME.fiore], colori: ['#ffe2b8', '#f7c6d8', '#fff6e8'], dipinte: true },
  vetro:    { colore: '#a9dcff', forma: [FORME.scintilla, FORME.stella, FORME.anello], colori: ['#dff3ff', '#bfe6ff', '#ffffff'] },
  metallo:  { colore: '#c4d2f2', forma: [FORME.anello, FORME.scintilla, FORME.nota], colori: ['#e0e8ff', '#c9d6f0', '#ffffff'] },
  foglie:   { colore: '#9fd08a', forma: [FORME.foglia], colori: ['#8fc27f', '#b4dea1', '#6faa5e'], dipinte: true },
  ceramica: { colore: '#9fc4f0', forma: [FORME.fiore, FORME.scintilla], colori: ['#a8c8f0', '#f7b6d8', '#ffffff'] },
  libri:    { colore: '#f1dcae', forma: [FORME.pagina, FORME.piuma], colori: ['#fffaf0', '#f3ead6'], dipinte: true },
  acqua:    { colore: '#9fd4ff', forma: [FORME.bolla, FORME.goccia], colori: ['#dff3ff', '#ffffff', '#bfe6ff'], dipinte: true },
};

export class Magia {
  constructor(gioco) {
    this.gioco = gioco;
    this.coloreVoluto = new THREE.Color('#ffd77a');
    this.ondaSchermo = null;          // l'increspatura in corso
    this.attesaTintinnio = 0;
    this.accumuloLucciole = 0;
    this.accumuloScia = 0;
    this._v = new THREE.Vector3();
  }

  /** Una nuova onda: luce del colore giusto, e per la bacchetta increspatura e nota. */
  nuovaOnda(onda, tipo) {
    // il colpo di bastone prende il colore del materiale toccato
    const m = onda.materiale && MATERIALI[onda.materiale];
    if (m) onda.colore.set(m.colore);
    this.coloreVoluto.copy(onda.colore);
    const g = this.gioco;
    if (tipo === 'bastone' || tipo === 'magia') {
      // dove cade il colpo sullo schermo?
      const q = g.corrente ? g.corrente.quota(onda.x, onda.z) : 0;
      this._v.set(onda.x, q + 0.05, onda.z).project(g.regia.camera);
      const forza = tipo === 'magia' ? 1.6 : (g.lia.magica ? 1.0 : 0.6);
      this.ondaSchermo = { x: (this._v.x + 1) / 2, y: (this._v.y + 1) / 2, t: 0, forza, durata: tipo === 'magia' ? 1.4 : 0.9 };
      g.acquerello.uniformi.uColoreOnda.value.copy(onda.colore);
      g.regia.pulsa(tipo === 'magia' ? 0.9 : 0.55);
      if (tipo === 'bastone' && g.lia.magica) Audio.nota(g.lia.colpi, 0.32);
      // la grande magia: colonna di luce e spirali che salgono
      if (tipo === 'magia') {
        const q = g.corrente ? g.corrente.quota(onda.x, onda.z) : 0;
        g.effetti.colonnaLuce(onda.x, q, onda.z, '#fff0a0', 9);
        ['#ffd36b', '#f7b6d8', '#a8d8ff'].forEach((c, k) => g.effetti.spirale(onda.x, q, onda.z, c, { raggio: 1.0 + k * 0.25, altezza: 3.2, giri: 2.5, fase: k * 2.1, durata: 2.2, larghezza: 0.1 }));
      }
    }
  }

  /** Lo "schizzo" del colpo: particelle del materiale proprio dove il bastone tocca. */
  colpo(materiale, x, y, z) {
    const g = this.gioco;
    const m = MATERIALI[materiale] || MATERIALI.pietra;
    const magica = g.lia.magica;
    (m.dipinte ? g.particelle : g.luci).emetti(x, y, z, magica ? 16 : 9, {
      forma: m.forma, colori: m.colori, velocita: 1.3, su: 1.0, gravita: m.dipinte ? 0.9 : 1.4,
      vita: 1.2, dim: m.dipinte ? 0.15 : 0.12, rotazione: 1,
    });
    if (magica) {
      g.luci.emetti(x, y, z, 12, {
        forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff', m.colore],
        velocita: 1.6, su: 1.2, gravita: 1.2, vita: 1.2, dim: 0.16,
      });
    }
  }

  /** A ogni fotogramma. */
  aggiorna(dt) {
    const g = this.gioco;
    const S = g.corrente;
    if (!S) return;
    const P = S.percezione;
    const magica = g.lia.magica;

    // 1. la luce del fronte prende il colore dell'ultima onda; più forte se Lia è streghetta
    UNIFORMI.uColoreMagia.value.lerp(this.coloreVoluto, Math.min(1, dt * 3));
    const voluta = magica ? 1 : 0.6;
    UNIFORMI.uMagia.value += (voluta - UNIFORMI.uMagia.value) * Math.min(1, dt * 2);

    // 2. particelle sul fronte di ogni onda
    if (P.rivelaTutto < 0.5) {
      for (const o of P.onde) {
        let nome = o.tipo;
        if (nome === 'bastone' && magica) nome = 'bastoneMagico';
        let sp = SPETTACOLO[nome];
        // il fronte del bastone porta con sé le particelle del materiale toccato
        const m = o.materiale && MATERIALI[o.materiale];
        if (sp && m && o.tipo === 'bastone') {
          sp = { ...sp, luce: !m.dipinte, forma: magica ? m.forma.concat([FORME.stella]) : m.forma, colori: m.colori };
        }
        if (!sp || o.r > o.raggio) continue;
        o.accumulo += 2 * Math.PI * Math.max(o.r, 0.5) * dt * sp.densita * Math.max(0.3, 1 - o.r / o.raggio);
        let n = Math.min(10, Math.floor(o.accumulo));
        o.accumulo -= n;
        while (n-- > 0) this._particellaSulFronte(o, sp, S);
      }
    }

    // 3. tintinnio quando si scoprono posti nuovi
    this.attesaTintinnio = Math.max(0, this.attesaTintinnio - dt);
    if (P.nuove > 12 && this.attesaTintinnio <= 0 && P.rivelaTutto < 0.5) {
      Audio.scoperta(Math.min(1, P.nuove / 80));
      this.attesaTintinnio = 0.9;
    }
    P.nuove = 0;

    // 4. increspatura dello schermo
    const u = g.acquerello.uniformi.uOndaSchermo.value;
    if (this.ondaSchermo) {
      const os = this.ondaSchermo;
      os.t += dt / os.durata;
      if (os.t >= 1) { this.ondaSchermo = null; u.w = 0; }
      else u.set(os.x, os.y, os.t, os.forza);
    } else u.w = 0;

    // 5. lucciole intorno a Lia streghetta e scia della bacchetta
    const L = g.lia;
    if (magica && !L.nascosta && g.fase === 'gioco') {
      this.accumuloLucciole += dt * 2.2;
      while (this.accumuloLucciole >= 1) {
        this.accumuloLucciole -= 1;
        const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2.2;
        g.luci.emetti(L.x + Math.cos(a) * r, L.y + 0.3 + Math.random() * 1.8, L.z + Math.sin(a) * r * 0.6, 1, {
          forma: FORME.punto, colori: ['#fff3b0', '#ffe28a', '#fffbe8'], velocita: 0.12, su: 0.08, gravita: -0.02,
          vita: 3.5, dim: 0.07, vortice: 0.3,
        });
      }
      if (L.inMovimento) {
        this.accumuloScia += dt * 9;
        while (this.accumuloScia >= 1) {
          this.accumuloScia -= 1;
          const m = L.mano(g.regia.camera);
          g.luci.emetti(m[0], m[1] + 0.25, m[2], 1, {
            forma: [FORME.scintilla, FORME.punto], colori: ['#fff0a0', '#ffd36b', '#ffffff'], velocita: 0.12, su: 0.1, gravita: 0.25,
            vita: 0.9, dim: 0.06, sparpaglia: 0.05,
          });
        }
      }
    }
  }

  /** Una particella in un punto a caso del fronte dell'onda o. */
  _particellaSulFronte(o, sp, S) {
    const g = this.gioco;
    const a = Math.random() * Math.PI * 2;
    const x = o.x + Math.cos(a) * o.r, z = o.z + Math.sin(a) * o.r;
    const q = S.quota(x, z);
    const inAria = Math.random() < sp.inAria;
    const y = q + (inAria ? 0.3 + Math.random() * 2.6 : 0.04 + Math.random() * 0.15);
    const sistema = sp.luce ? g.luci : g.particelle;
    sistema.emetti(x, y, z, 1, { forma: sp.forma, colori: sp.colori, ...sp.opz });
    if (sp.extra && Math.random() < sp.extra.parte) {
      g.particelle.emetti(x, q + sp.extra.quota, z, 1, { forma: sp.extra.forma, colori: sp.extra.colori, ...sp.extra.opz });
    }
  }
}
