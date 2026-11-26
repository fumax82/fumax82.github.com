/* ==========================================================================
 *  sorprese.js — OGNI TOCCO, UNA SORPRESA (per i più piccoli)
 *  --------------------------------------------------------------------------
 *  Il gioco è pensato per una bimba di 2 anni: non si legge niente e non
 *  si sbaglia mai. Ogni volta che il ditino tocca lo schermo, nel punto
 *  toccato succede qualcosa di bello, sempre diverso:
 *      fiori che sbocciano, farfalle, bolle di sapone, note musicali,
 *      una pioggia di stelle, uccellini che volano via, un palloncino...
 *  e si sente una nota del carillon: tocco dopo tocco nasce una melodia.
 *
 *  Se il tocco cade su un PERSONAGGIO, il personaggio fa festa: salta,
 *  fa il suo verso (Gogo abbaia, il gattino miagola...) e lancia cuori.
 *
 *  Per non riempire lo schermo quando si tocca tanto e in fretta, le
 *  sorprese "grandi" (quelle che volano) sono limitate.
 * ========================================================================== */
import { FORME } from '../motore/particelle.js';
import { Audio } from './audio.js';

// l'ordine delle sorprese (si ricomincia da capo quando finisce)
const GIRO = ['fiori', 'farfalle', 'bolle', 'note', 'stelle', 'uccelli', 'cuori', 'palloncino', 'arcobaleno'];

export class Sorprese {
  constructor(gioco) {
    this.g = gioco;
    this.indice = 0;
    this.nota = 0;
    this.attesa = 0;          // un attimo di pausa tra una sorpresa e l'altra
  }

  aggiorna(dt) {
    this.attesa = Math.max(0, this.attesa - dt);
  }

  /** Una sorpresa nel punto (x, y, z) del mondo. */
  nelPunto(x, y, z) {
    const g = this.g;
    if (this.attesa > 0 || !g.corrente) return;
    this.attesa = 0.16;
    // la melodia del carillon: una nota per tocco
    Audio.nota(this.nota++, 0.3);
    const tipo = GIRO[this.indice++ % GIRO.length];
    const volanti = g.meraviglie ? g.meraviglie.volanti.length : 0;
    const troppi = volanti > 14;
    // sempre: uno sbuffo di scintille colorate
    g.luci.emetti(x, y, z, 12, {
      forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8', '#a8d8ff'],
      velocita: 1.3, su: 0.7, gravita: 0.4, vita: 1.1, dim: 0.14, sparpaglia: 0.15,
    });
    const P = g.particelle;
    switch (tipo) {
      case 'fiori':
        P.emetti(x, y + 0.05, z, 26, {
          forma: [FORME.fiore, FORME.petalo, FORME.foglia], colori: ['#f7a8c8', '#ffd1e8', '#fff3a8', '#e9786b', '#c9b6ea', '#8fc27f'],
          velocita: 1.0, su: 1.3, gravita: 0.5, vita: 2.6, dim: 0.17, sparpaglia: 0.3, vortice: 0.6, rotazione: 0.5,
        });
        break;
      case 'farfalle':
        if (troppi || !g.meraviglie) return this._ripiego(x, y, z);
        for (let k = 0; k < 3; k++) g.meraviglie._vola('farfalla', x, y, z, k);
        break;
      case 'bolle':
        P.emetti(x, y, z, 18, {
          forma: [FORME.bolla], colori: ['#dff3ff', '#ffffff', '#f7d6ef', '#e6f7d9'],
          velocita: 0.5, su: 0.8, gravita: -0.08, vita: 3.0, dim: 0.2, sparpaglia: 0.4, vortice: 0.7,
        });
        break;
      case 'note':
        P.emetti(x, y, z, 12, {
          forma: [FORME.nota], colori: ['#7fb6d8', '#e9875a', '#9fa8e8', '#f2a541', '#e57fa6'],
          velocita: 0.6, su: 1.1, gravita: 0, vita: 2.2, dim: 0.22, sparpaglia: 0.3, rotazione: 0.5,
        });
        Audio.nota(this.nota++, 0.22);
        break;
      case 'stelle':
        g.luci.emetti(x, y + 1.2, z, 34, {
          forma: [FORME.stella, FORME.scintilla, FORME.punto], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#c9b6ea'],
          velocita: 0.7, su: -0.2, gravita: 0.6, vita: 2.0, dim: 0.2, sparpaglia: 0.9,
        });
        break;
      case 'uccelli':
        if (troppi || !g.meraviglie) return this._ripiego(x, y, z);
        for (let k = 0; k < 3; k++) g.meraviglie._vola('uccellino', x, y, z, k);
        Audio.uccellino(x, z);
        break;
      case 'cuori':
        P.emetti(x, y, z, 16, {
          forma: [FORME.cuore], colori: ['#f7a8c8', '#ff8fa8', '#ffd1e8', '#e9786b'],
          velocita: 0.8, su: 1.2, gravita: 0.1, vita: 2.0, dim: 0.2, sparpaglia: 0.25,
        });
        break;
      case 'palloncino':
        if (troppi || !g.meraviglie) return this._ripiego(x, y, z);
        g.meraviglie._vola('palloncino', x, y, z, 0);
        break;
      case 'arcobaleno':
        // nastri colorati che salgono girando
        ['#f7a8c8', '#ffd36b', '#a8d8ff', '#b6e3a8'].forEach((c, k) => g.effetti.spirale(x, y - 0.2, z, c, {
          raggio: 0.35 + k * 0.08, altezza: 1.6, giri: 1.6, fase: k * 1.6, durata: 1.6, larghezza: 0.08,
        }));
        break;
    }
  }

  /** Quando ci sono già troppe creature in volo: una sorpresa più leggera. */
  _ripiego(x, y, z) {
    this.g.particelle.emetti(x, y, z, 14, {
      forma: [FORME.petalo, FORME.cuore], colori: ['#f7a8c8', '#fff3a8', '#c9b6ea'],
      velocita: 0.9, su: 1.0, gravita: 0.3, vita: 2.0, dim: 0.16, sparpaglia: 0.3, vortice: 0.6,
    });
  }

  /**
   * Un PERSONAGGIO toccato fa festa: salta, fa il suo verso, lancia cuori.
   * (Non si ferma niente: è solo un momento di gioia.)
   */
  festa(attore) {
    const g = this.g;
    if (!attore || attore.festaFino > g.tempo) return;
    attore.festaFino = g.tempo + 0.7;
    const sag = attore.sagoma;
    const alto = sag ? sag.altezza : 1;
    if (sag && sag.salta) sag.salta(Math.min(0.45, 0.15 + alto * 0.25), 0.7, 2);
    const x = attore.x, y = attore.y + alto * 0.8, z = attore.z;
    const id = (attore.id || '') + ' ' + ((attore.def && attore.def.arte) || '');
    // il verso giusto per ognuno
    if (attore === g.lia) { Audio.scoperta(0.6); attore.posa('saluta', 1.2); }
    else if (/gogo/.test(id)) { if (attore.faVerso) attore.faVerso(); else Audio.abbaio(x, z); }
    else if (/gatt/.test(id)) { if (attore.faVerso) attore.faVerso(); else Audio.miagolio(x, z); }
    else if (/uccell|piccion|pesce_volante/.test(id)) Audio.uccellino(x, z);
    else if (/balena/.test(id)) Audio.balena();
    else if (/rana/.test(id)) Audio.violino(x, z);
    else if (/lampione/.test(id)) Audio.sbadiglio(x, z);
    else if (/fiori/.test(id)) Audio.coro(x, z);
    else if (/auto|bus/.test(id)) Audio.clacson(x, z);
    else Audio.scoperta(0.45);
    g.particelle.emetti(x, y, z, 12, {
      forma: [FORME.cuore, FORME.nota, FORME.stella], colori: ['#f7a8c8', '#ffd36b', '#a8d8ff', '#ffffff'],
      velocita: 0.9, su: 1.1, gravita: 0.15, vita: 1.8, dim: 0.17, sparpaglia: 0.2,
    });
    g.luci.emetti(x, y, z, 14, {
      forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffffff'],
      velocita: 1.4, su: 0.6, gravita: 0.3, vita: 1.0, dim: 0.13, sparpaglia: 0.2,
    });
  }
}
