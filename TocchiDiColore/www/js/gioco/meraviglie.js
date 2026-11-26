/* ==========================================================================
 *  meraviglie.js — LE MERAVIGLIE NASCOSTE
 *  --------------------------------------------------------------------------
 *  In ogni scena ci sono piccole cose speciali che il mondo bianco
 *  nasconde: i gerani alle finestre, i piccioni, un palloncino, le pagine
 *  di un libro... Quando un'onda (bastone, abbaio, profumo) le raggiunge
 *  per la prima volta, "prendono vita" con un effetto tutto loro e si
 *  sente un arpeggio (niente scritte: il gioco è per i più piccoli).
 *
 *  Ogni meraviglia è scritta nella scena (js/dati/scene/*.js):
 *    { id, x, y, z, effetto, testo }   (il testo è solo un promemoria per chi legge il codice)
 *  effetto: 'farfalle' | 'uccelli' | 'fiori' | 'note' | 'stelle' |
 *           'palloncino' | 'pagine' | 'bolle'
 *  Le meraviglie-personaggio hanno anche "attore" (l'id nella scena):
 *    'sveglia' (il lampione si sveglia e sbadiglia), 'suona' (la rana
 *    suona il violino), 'canta' (i fiori cantano), 'appare' (compare di colpo)
 * ========================================================================== */
import { Sagoma } from '../motore/sagoma.js';
import { FORME } from '../motore/particelle.js';
import { Audio } from './audio.js';

export class Meraviglie {
  constructor(gioco, scena) {
    this.gioco = gioco;
    this.scena = scena;
    this.lista = (scena.def.meraviglie || []).map((m) => ({ ...m, chiave: scena.id + ':' + m.id }));
    this.volanti = [];          // farfalle, uccellini e palloncini in volo
    this.attesa = 0;
  }

  aggiorna(dt) {
    const g = this.gioco;
    const P = this.scena.percezione;
    this.attesa = Math.max(0, this.attesa - dt);
    // si scoprono solo nel mondo bianco o immaginato (non quando tutto è già a colori)
    if (P.rivelaTutto < 0.5 && this.attesa <= 0 && g.lia.controllo) {
      for (const m of this.lista) {
        if (g.meraviglieTrovate.has(m.chiave)) continue;
        if (P.valore(m.x, m.z) > 0.8) { this._trova(m); this.attesa = 1.2; break; }
      }
    }
    // chi vola
    for (const v of this.volanti) v.aggiorna(dt);
    this.volanti = this.volanti.filter((v) => {
      if (v.fine <= 0) { v.s.rimuovi(); return false; }
      return true;
    });
  }

  _trova(m) {
    const g = this.gioco;
    g.meraviglieTrovate.add(m.chiave);
    Audio.meraviglia();
    g.onda(m.x, m.z, 'magia', { raggio: 3.5, velocita: 5, forza: 0.7, livello: 1 });
    const y = m.y !== undefined ? m.y : this.scena.quota(m.x, m.z) + 0.5;
    // un momento di scoperta: la camera si allarga e guarda la meraviglia, luce e spirali
    g.regia.momento([m.x, y, m.z], 3.0);
    g.concentra([m.x, y, m.z], 1.6, '#fffaf0', 0.65);
    g.effetti.colonnaLuce(m.x, y - 0.5, m.z, '#fff3b8', 6);
    g.effetti.spirale(m.x, y - 0.4, m.z, '#ffd36b', { raggio: 0.6, altezza: 2, durata: 2 });
    g.effetti.spirale(m.x, y - 0.4, m.z, '#f7b6d8', { raggio: 0.8, altezza: 2.2, fase: 3, durata: 2.2 });
    // un lampo di stelline nel punto della meraviglia
    g.luci.emetti(m.x, y, m.z, 24, {
      forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'],
      velocita: 1.2, su: 0.8, gravita: 0.4, vita: 1.6, dim: 0.16, sparpaglia: 0.3,
    });
    const effetti = {
      farfalle: () => { for (let k = 0; k < 4; k++) this._vola('farfalla', m.x, y, m.z, k); },
      uccelli: () => { for (let k = 0; k < 5; k++) this._vola('uccellino', m.x, y, m.z, k); },
      palloncino: () => this._vola('palloncino', m.x, y, m.z, 0),
      fiori: () => g.particelle.emetti(m.x, y, m.z, 40, {
        forma: [FORME.fiore, FORME.petalo], colori: ['#f7a8c8', '#ffd1e8', '#fff3a8', '#e9786b', '#c9b6ea'],
        velocita: 1.0, su: 1.0, gravita: 0.35, vita: 3.0, dim: 0.16, sparpaglia: 0.6, vortice: 0.5,
      }),
      note: () => g.particelle.emetti(m.x, y, m.z, 18, {
        forma: [FORME.nota], colori: ['#7fb6d8', '#e9875a', '#9fa8e8', '#f2a541'],
        velocita: 0.5, su: 1.0, gravita: 0, vita: 2.6, dim: 0.2, sparpaglia: 0.4, rotazione: 0.4,
      }),
      stelle: () => g.luci.emetti(m.x, y + 1.5, m.z, 40, {
        forma: [FORME.stella, FORME.scintilla, FORME.punto], colori: ['#fff0a0', '#ffd36b', '#ffffff'],
        velocita: 0.6, su: -0.1, gravita: 0.5, vita: 2.6, dim: 0.18, sparpaglia: 1.2,
      }),
      pagine: () => g.particelle.emetti(m.x, y, m.z, 16, {
        forma: [FORME.pagina, FORME.piuma], colori: ['#fffaf0', '#f3ead6'],
        velocita: 0.8, su: 0.6, gravita: 0.05, vita: 3.5, dim: 0.22, sparpaglia: 0.5, vortice: 1.0,
      }),
      bolle: () => g.particelle.emetti(m.x, y, m.z, 26, {
        forma: [FORME.bolla], colori: ['#dff3ff', '#ffffff', '#f7d6ef'],
        velocita: 0.4, su: 0.7, gravita: -0.05, vita: 3.2, dim: 0.16, sparpaglia: 0.8, vortice: 0.6,
      }),
    };
    // le meraviglie che sono PERSONAGGI: si svegliano, suonano, compaiono
    const a = m.attore ? this.scena.attore(m.attore) : null;
    if (a) {
      effetti.sveglia = async () => {
        a.visibile = true;
        const vecchio = m.nascondi ? this.scena.oggetto(m.nascondi) : null;   // il lampione "normale"
        if (vecchio) vecchio.visibile = false;
        Audio.sbadiglio(a.x, a.z);
        if (a.sveglia) await a.sveglia();
        g.luci.emetti(a.x, a.y + 2.6, a.z, 30, { forma: [FORME.stella, FORME.punto], colori: ['#fff3b0', '#ffe28a', '#ffffff'], velocita: 0.8, su: 0.3, gravita: 0.1, vita: 2.4, dim: 0.14, sparpaglia: 0.3 });
        // da ora in poi illumina la via intorno a sé
        this._ripeti(3.5, () => g.onda(a.x, a.z, 'suono', { colore: '#ffe9a8', raggio: 4, forza: 0.35 }));
      };
      effetti.suona = () => {
        a.visibile = true;
        a.posa('suona', Infinity);
        const durata = Audio.violino(a.x, a.z) || 4;
        const note = g.emettitore(a.x, a.y + 0.9, a.z, 4, { forma: FORME.nota, colori: ['#7fb6d8', '#e9875a', '#9fa8e8', '#f2a541'], velocita: 0.4, su: 0.8, vita: 2.4, dim: 0.2, rotazione: 0.4 });
        // ogni tanto riprende a suonare (finché Lia è nella scena)
        this._ripeti(durata + 5, () => Audio.violino(a.x, a.z));
        a.emettitoreNote = note;
      };
      effetti.canta = () => {
        a.visibile = true;
        Audio.coro(a.x, a.z);
        this._ripeti(8, () => Audio.coro(a.x, a.z));
        g.emettitore(a.x, a.y + 0.8, a.z, 2.5, { forma: FORME.nota, colori: ['#f7a8c8', '#fff3a8', '#c9b6ea'], velocita: 0.3, su: 0.7, vita: 2.2, dim: 0.18 });
      };
      effetti.appare = () => {
        a.visibile = true;
        g.luci.emetti(a.x, a.y + 0.5, a.z, 30, { forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffffff', '#f7b6d8'], velocita: 1.2, su: 0.8, gravita: 0.3, vita: 1.6, dim: 0.16, sparpaglia: 0.5 });
      };
    }
    (effetti[m.effetto] || effetti.stelle)();
  }

  /** Ripete "funzione" ogni tot secondi, finché Lia resta in questa scena. */
  _ripeti(secondi, funzione) {
    const g = this.gioco;
    const r = g.ogni(secondi, () => {
      if (g.corrente !== this.scena) { r.ferma(); return; }
      funzione();
    });
    r.conto = secondi;   // la prima volta dopo "secondi", non subito
    return r;
  }

  /** Una creatura (o un palloncino) che si alza in volo dal punto della meraviglia. */
  _vola(arte, x, y, z, k) {
    const g = this.gioco;
    const s = new Sagoma(arte, { ancora: 0.5, scala: arte === 'farfalla' ? 1.6 : arte === 'uccellino' ? 1.4 : 0.9, luce: 1 });
    s.aggiungiA(this.scena.gruppo);
    const fase = k * 1.7 + Math.random();
    const direzione = k % 2 ? 1 : -1;
    let t = 0;
    const v = {
      s, fine: arte === 'farfalla' ? 14 : 9,
      aggiorna: (dt) => {
        t += dt;
        v.fine -= dt;
        let px, py, pz;
        if (arte === 'farfalla') {
          // svolazza intorno, poi sale e se ne va
          const via = Math.max(0, t - 10);
          px = x + Math.sin(t * 0.9 + fase) * 1.4 + direzione * via * 1.5;
          py = y + 0.4 + Math.sin(t * 2.3 + fase) * 0.35 + t * 0.05 + via * via * 0.3;
          pz = z + 0.4 + Math.cos(t * 0.7 + fase) * 0.8;
          s.mostra(Math.floor(t * 10 + k) % 2 ? 'f1' : 'f0', Math.cos(t * 0.9 + fase) * direzione < 0);
        } else if (arte === 'uccellino') {
          px = x + direzione * (t * (2 + k * 0.4));
          py = y + t * (1.4 + k * 0.2) + Math.sin(t * 6 + fase) * 0.1;
          pz = z + 0.3 + k * 0.2;
          s.mostra('f' + (Math.floor(t * 12 + k) % 4), direzione < 0);
        } else {
          // il palloncino sale ondeggiando
          px = x + Math.sin(t * 0.8) * 0.4;
          py = y + t * 0.9;
          pz = z + 0.2;
        }
        s.posiziona(px, py, pz);
        s.opacita = Math.min(1, v.fine / 1.5, t * 3);
      },
    };
    this.volanti.push(v);
    return v;
  }

  smonta() {
    for (const v of this.volanti) v.s.rimuovi();
    this.volanti = [];
  }
}
