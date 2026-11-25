/* ==========================================================================
 *  musica.js — LA COLONNA SONORA (composta e suonata dal codice)
 *  --------------------------------------------------------------------------
 *  Ogni TEMA è uno spartito semplice:
 *    - melodia: elenco di [nota, durata in battiti]  ('-' = pausa)
 *    - accordi: un accordo per battuta, suonati con uno "stile"
 *      ('valzer' = um-pa-pa, 'polka' = um-pa, 'arpeggio', 'tenuto')
 *  Gli strumenti sono sintetizzati: flauto, carillon, celesta,
 *  pizzicato, archi, fisarmonica, basso.
 *  Un "sequencer" programma le note poco prima che debbano suonare,
 *  così la musica resta precisa anche se il gioco rallenta un attimo.
 *
 *  Le melodie sono originali, scritte per questo gioco.
 * ========================================================================== */
import { Audio } from './audio.js';

/* ------------------------------------------------------------------------ */
/*  Note e accordi                                                          */
/* ------------------------------------------------------------------------ */
const SEMITONI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#5' → frequenza in Hz */
function frequenza(nota) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(nota);
  if (!m) return 0;
  let s = SEMITONI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (parseInt(m[3], 10) + 1) * 12 + s;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 'Am', 'G7', 'Fmaj7', 'Bb' → frequenze delle note dell'accordo (attorno all'ottava 4) */
function accordo(nome) {
  const m = /^([A-G])([#b]?)(maj7|m7|m|7)?$/.exec(nome);
  if (!m) return [];
  const radice = SEMITONI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const tipo = m[3] || '';
  const intervalli = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10] }[tipo];
  const base = 60 + radice; // ottava 4
  return intervalli.map((i) => 440 * Math.pow(2, (base + i - 69) / 12));
}

/* ------------------------------------------------------------------------ */
/*  I TEMI                                                                  */
/* ------------------------------------------------------------------------ */
const TEMI = {
  // La passeggiata con Biscotto: valzer leggero in Do maggiore
  passeggiata: {
    bpm: 108, battuta: 3, melodiaStrumento: 'flauto', accordiStrumento: 'pizzicato', stile: 'valzer', tappeto: 'archi',
    melodia: [
      ['E5', 2], ['G5', 1], ['A5', 2], ['G5', 1], ['E5', 1], ['D5', 1], ['C5', 1], ['D5', 3],
      ['E5', 2], ['G5', 1], ['C6', 2], ['B5', 1], ['A5', 1], ['G5', 1], ['E5', 1], ['G5', 3],
      ['F5', 2], ['A5', 1], ['G5', 2], ['E5', 1], ['D5', 1], ['E5', 1], ['F5', 1], ['E5', 2], ['C5', 1],
      ['D5', 2], ['E5', 1], ['F5', 1], ['E5', 1], ['D5', 1], ['C5', 3], ['-', 3],
    ],
    accordi: ['C', 'F', 'C', 'G', 'C', 'Am', 'F', 'G', 'Dm', 'C', 'G', 'C', 'G', 'F', 'C', 'C'],
  },
  // Il mondo diventato bianco: poche note sospese di carillon
  bianco: {
    bpm: 66, battuta: 4, melodiaStrumento: 'carillon', accordiStrumento: 'archi', stile: 'tenuto', tappeto: null,
    melodia: [
      ['A5', 2], ['E5', 2], ['-', 2], ['C6', 2], ['B5', 3], ['-', 1], ['G5', 2], ['E5', 2],
      ['A5', 2], ['-', 2], ['D6', 2], ['C6', 1], ['B5', 1], ['A5', 4], ['-', 4],
    ],
    accordi: ['Am', 'Am', 'F', 'G', 'Am', 'F', 'Em', 'Am'],
  },
  // La magia della bacchetta: arpeggi di celesta
  magia: {
    bpm: 92, battuta: 4, melodiaStrumento: 'celesta', accordiStrumento: 'celesta', stile: 'arpeggio', tappeto: 'archi',
    melodia: [
      ['A5', 3], ['B5', 1], ['C6', 2], ['E6', 2], ['D6', 4], ['B5', 4],
      ['C6', 3], ['D6', 1], ['E6', 2], ['G6', 2], ['F#6', 4], ['E6', 4],
    ],
    accordi: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'D', 'C'],
  },
  // La città che galleggia: polka con la fisarmonica
  citta: {
    bpm: 118, battuta: 2, melodiaStrumento: 'fisarmonica', accordiStrumento: 'pizzicato', stile: 'polka', tappeto: null,
    melodia: [
      ['F5', 0.5], ['A5', 0.5], ['C6', 0.5], ['A5', 0.5], ['Bb5', 0.5], ['G5', 0.5], ['E5', 1],
      ['F5', 0.5], ['A5', 0.5], ['C6', 0.5], ['F6', 0.5], ['E6', 1], ['C6', 1],
      ['D6', 0.5], ['Bb5', 0.5], ['G5', 0.5], ['Bb5', 0.5], ['A5', 0.5], ['F5', 0.5], ['C5', 1],
      ['G5', 0.5], ['A5', 0.5], ['Bb5', 0.5], ['G5', 0.5], ['F5', 2],
      ['A5', 0.5], ['C6', 0.5], ['D6', 0.5], ['C6', 0.5], ['Bb5', 1], ['G5', 1],
      ['A5', 0.5], ['Bb5', 0.5], ['C6', 0.5], ['A5', 0.5], ['G5', 2],
      ['F5', 0.5], ['G5', 0.5], ['A5', 0.5], ['Bb5', 0.5], ['C6', 0.5], ['D6', 0.5], ['C6', 1],
      ['Bb5', 0.5], ['G5', 0.5], ['E5', 0.5], ['G5', 0.5], ['F5', 2],
    ],
    accordi: ['F', 'C', 'F', 'C', 'Bb', 'F', 'C', 'F', 'F', 'Bb', 'F', 'C', 'F', 'C', 'C', 'F'],
  },
  // Il volo sulla balena: archi ampi e flauto
  volo: {
    bpm: 76, battuta: 4, melodiaStrumento: 'flauto', accordiStrumento: 'celesta', stile: 'arpeggio', tappeto: 'archi',
    melodia: [
      ['F#5', 2], ['A5', 2], ['E5', 4], ['D5', 2], ['F#5', 2], ['B5', 4],
      ['A5', 3], ['G5', 1], ['F#5', 2], ['E5', 2], ['D5', 2], ['E5', 2], ['F#5', 4],
      ['A5', 2], ['D6', 2], ['C#6', 4], ['B5', 2], ['A5', 2], ['G5', 4],
      ['F#5', 2], ['G5', 2], ['A5', 2], ['B5', 2], ['A5', 8],
    ],
    accordi: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'D', 'D', 'A', 'G', 'Em', 'D', 'G', 'A', 'D'],
  },
  // Dentro il forno e la libreria: tranquillo e affettuoso
  interno: {
    bpm: 92, battuta: 4, melodiaStrumento: 'carillon', accordiStrumento: 'pizzicato', stile: 'arpeggio', tappeto: 'archi',
    melodia: [
      ['B4', 1], ['D5', 1], ['G5', 1], ['F#5', 1], ['E5', 2], ['D5', 2],
      ['C5', 1], ['E5', 1], ['A5', 1], ['G5', 1], ['F#5', 4],
      ['G5', 1], ['B5', 1], ['D6', 1], ['B5', 1], ['C6', 2], ['A5', 2],
      ['G5', 1], ['F#5', 1], ['E5', 1], ['F#5', 1], ['G5', 4],
    ],
    accordi: ['G', 'C', 'Am', 'D', 'G', 'C', 'D', 'G'],
  },
  // Il finale: il tema della passeggiata, più lento, sul carillon
  finale: {
    bpm: 88, battuta: 3, melodiaStrumento: 'carillon', accordiStrumento: 'celesta', stile: 'valzer', tappeto: 'archi',
    melodia: null, // usa la melodia della passeggiata
    accordi: null,
  },
};
TEMI.finale.melodia = TEMI.passeggiata.melodia;
TEMI.finale.accordi = TEMI.passeggiata.accordi;

/* ------------------------------------------------------------------------ */
/*  Strumenti sintetizzati                                                  */
/* ------------------------------------------------------------------------ */
function suonaNota(ctx, uscita, strumento, f, t0, durata, volume) {
  const v = volume || 1;
  const g = ctx.createGain();
  g.connect(uscita);
  const osc = (tipo, fr, gain) => {
    const o = ctx.createOscillator();
    o.type = tipo; o.frequency.value = fr;
    const og = ctx.createGain(); og.gain.value = gain;
    o.connect(og); og.connect(g);
    o.start(t0); o.stop(t0 + durata + 1.6);
    return o;
  };
  const inviluppo = (attacco, picco, rilascio, sostegno) => {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(picco * v, t0 + attacco);
    if (sostegno) g.gain.setValueAtTime(picco * v * sostegno, t0 + Math.max(attacco, durata - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durata + rilascio);
  };
  switch (strumento) {
    case 'flauto': {
      const o = osc('sine', f, 1); osc('triangle', f * 2, 0.08);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
      const pl = ctx.createGain(); pl.gain.value = f * 0.006;
      lfo.connect(pl); pl.connect(o.frequency); lfo.start(t0 + 0.15); lfo.stop(t0 + durata + 0.5);
      inviluppo(0.07, 0.16, 0.25, 0.85);
      break;
    }
    case 'carillon':
      osc('sine', f, 1); osc('sine', f * 2, 0.3); osc('sine', f * 4.2, 0.12);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18 * v, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
      break;
    case 'celesta':
      osc('sine', f, 1); osc('triangle', f * 2, 0.25);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.12 * v, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      break;
    case 'pizzicato': {
      const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1400;
      g.disconnect(); g.connect(filtro); filtro.connect(uscita);
      osc('triangle', f, 1);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.2 * v, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      break;
    }
    case 'basso':
      osc('triangle', f, 1); osc('sine', f, 0.6);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.26 * v, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      break;
    case 'archi': {
      const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 1300;
      g.disconnect(); g.connect(filtro); filtro.connect(uscita);
      osc('sawtooth', f * 0.997, 0.5); osc('sawtooth', f * 1.004, 0.5);
      inviluppo(0.6, 0.05, 0.9, 1);
      break;
    }
    case 'fisarmonica': {
      const filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2400;
      g.disconnect(); g.connect(filtro); filtro.connect(uscita);
      osc('sawtooth', f * 0.996, 0.45); osc('square', f * 1.003, 0.3);
      inviluppo(0.03, 0.1, 0.12, 0.9);
      break;
    }
    default:
      osc('sine', f, 1);
      inviluppo(0.01, 0.15, 0.3, 0.8);
  }
}

/* ------------------------------------------------------------------------ */
/*  Il sequencer                                                            */
/* ------------------------------------------------------------------------ */
export const Musica = {
  tema: null,
  nome: null,
  voci: [],       // temi in riproduzione (durante una dissolvenza ce ne sono due)
};

/** Fa partire un tema (con dissolvenza dal precedente). null = silenzio. */
Musica.suona = function (nome) {
  const ctx = Audio.ctx;
  if (!ctx || nome === this.nome) return;
  this.nome = nome;
  const t = ctx.currentTime;
  for (const v of this.voci) {
    v.gain.gain.setTargetAtTime(0, t, 0.8);
    v.fine = t + 3;
  }
  if (!nome || !TEMI[nome]) return;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(1, t, 0.8);
  gain.connect(Audio.busMusica);
  const riv = ctx.createGain(); riv.gain.value = 0.5;
  gain.connect(riv); riv.connect(Audio.mandataRiverbero);
  const tema = TEMI[nome];
  this.voci.push({
    tema, gain, fine: Infinity,
    battito: 60 / tema.bpm,
    prossimaMelodia: t + 0.1, indiceMelodia: 0,
    prossimaBattuta: t + 0.1, indiceBattuta: 0,
  });
};

/** Da chiamare spesso: programma le note dei prossimi 0,3 secondi. */
Musica.aggiorna = function () {
  const ctx = Audio.ctx;
  if (!ctx) return;
  const ora = ctx.currentTime, avanti = ora + 0.3;
  for (const v of this.voci) {
    const T = v.tema, b = v.battito;
    // melodia
    while (v.prossimaMelodia < avanti && v.prossimaMelodia < v.fine) {
      const [nota, durata] = T.melodia[v.indiceMelodia];
      if (nota !== '-') suonaNota(ctx, v.gain, T.melodiaStrumento, frequenza(nota), v.prossimaMelodia, durata * b * 0.95, 1);
      v.prossimaMelodia += durata * b;
      v.indiceMelodia = (v.indiceMelodia + 1) % T.melodia.length;
    }
    // accompagnamento: una battuta alla volta
    while (v.prossimaBattuta < avanti && v.prossimaBattuta < v.fine) {
      const note = accordo(T.accordi[v.indiceBattuta]);
      const t0 = v.prossimaBattuta, n = T.battuta;
      if (note.length) {
        const basso = note[0] / 2;
        if (T.stile === 'valzer') {
          suonaNota(ctx, v.gain, 'basso', basso, t0, b, 1);
          for (let k = 1; k < n; k++) note.slice(1, 3).forEach((f) => suonaNota(ctx, v.gain, T.accordiStrumento, f, t0 + k * b, b * 0.6, 0.55));
        } else if (T.stile === 'polka') {
          for (let k = 0; k < n; k++) {
            suonaNota(ctx, v.gain, 'basso', k % 2 ? note[2] / 2 : basso, t0 + k * b, b * 0.5, 1);
            note.slice(1).forEach((f) => suonaNota(ctx, v.gain, T.accordiStrumento, f, t0 + k * b + b / 2, b * 0.3, 0.45));
          }
        } else if (T.stile === 'arpeggio') {
          suonaNota(ctx, v.gain, 'basso', basso, t0, b * n, 0.8);
          const passi = n * 2;
          for (let k = 0; k < passi; k++) suonaNota(ctx, v.gain, T.accordiStrumento, note[k % note.length] * (k >= note.length ? 2 : 1), t0 + (k * b) / 2, b * 0.5, 0.5);
        } else {
          note.forEach((f) => suonaNota(ctx, v.gain, T.accordiStrumento, f / 2, t0, b * n, 0.8));
        }
        if (T.tappeto) note.forEach((f) => suonaNota(ctx, v.gain, T.tappeto, f, t0, b * n, 0.7));
      }
      v.prossimaBattuta += n * b;
      v.indiceBattuta = (v.indiceBattuta + 1) % T.accordi.length;
    }
  }
  // togli le voci finite
  this.voci = this.voci.filter((v) => {
    if (ora > v.fine) { v.gain.disconnect(); return false; }
    return true;
  });
};
