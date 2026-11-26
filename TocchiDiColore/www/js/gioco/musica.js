/* ==========================================================================
 *  musica.js — LA COLONNA SONORA (composta e suonata dal codice)
 *  --------------------------------------------------------------------------
 *  Come in un piccolo film d'animazione: pianoforte, carillon, celesta,
 *  arpa, archi morbidi, flauto, clarinetto e pizzicato (gli strumenti
 *  sono in audio.js).
 *
 *  Ogni TEMA è uno spartito:
 *    - accordi: un accordo per battuta ('Dm7 G7' = due accordi nella battuta)
 *    - parti: chi suona che cosa. Una parte può avere
 *        melodia: 'E5:1.5 D5:0.5 C5 G4 | ...'  (nota:durata in battiti,
 *                  '-' = pausa, la durata resta uguale finché non cambia)
 *        accomp:  uno "stile" di accompagnamento che usa gli accordi
 *                  ('tenuto', 'controtempo', 'valzer', 'arpeggio', 'alberti'...)
 *        basso:   la linea del basso ('radice', 'unoTre', 'valzer')
 *        giri:    in quali giri suona (il tema si ripete 2 volte con
 *                  piccole differenze di orchestrazione: [0], [1] o [0, 1])
 *  Un "sequencer" programma le note poco prima che debbano suonare, usando
 *  l'orologio preciso dell'audio: così la musica resta a tempo anche se il
 *  gioco rallenta un attimo.
 *
 *  Le melodie sono originali, scritte per questo gioco.
 * ========================================================================== */
import { Audio } from './audio.js';

/* ------------------------------------------------------------------------ */
/*  Note e accordi                                                          */
/* ------------------------------------------------------------------------ */
const SEMITONI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const classe = (s) => SEMITONI[s[0]] + (s[1] === '#' ? 1 : s[1] === 'b' ? -1 : 0);

/** 'C#5' → numero MIDI (60 = Do centrale) */
function midiDi(nota) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(nota);
  return m ? (parseInt(m[2], 10) + 1) * 12 + classe(m[1]) : null;
}

/** 'E5:1.5 D5:0.5 C5 | -:2 ...' → [{ b (battito d'inizio), midi, dur }] */
function leggiMelodia(testo) {
  const note = [];
  let b = 0, dur = 1;
  for (const pezzo of testo.split(/\s+/)) {
    if (!pezzo || pezzo === '|') continue;
    const [n, d] = pezzo.split(':');
    if (d) dur = parseFloat(d);
    if (n !== '-') note.push({ b, midi: midiDi(n), dur });
    b += dur;
  }
  note.totale = b;
  return note;
}

/* gli intervalli (in semitoni dalla radice) dei tipi di accordo */
const QUALITA = {
  '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
  9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14], add9: [0, 4, 7, 14], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
  sus2: [0, 2, 7], sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], dim: [0, 3, 6], m7b5: [0, 3, 6, 10],
};
/** 'Dm7', 'G/B', 'Fmaj7' → { radice, intervalli, basso } */
function leggiAccordo(nome) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(nome);
  if (!m || !QUALITA[m[2]]) { console.warn('Accordo sconosciuto:', nome); return { radice: 0, intervalli: [0, 4, 7], basso: 0 }; }
  const radice = classe(m[1]);
  return { radice, intervalli: QUALITA[m[2]], basso: m[3] ? classe(m[3]) : radice };
}

/** La nota con classe pc più vicina a "centro" (per il basso). */
const vicina = (pc, centro) => { let m = centro - (((centro - pc) % 12) + 12) % 12; if (centro - m > 6) m += 12; return m; };

/**
 * Dispone un accordo attorno a "centro" (MIDI) scegliendo il rivolto che
 * si muove meno rispetto all'accordo precedente (le voci "scivolano").
 */
function disponi(acc, centro, prec, quante) {
  let intervalli = acc.intervalli.slice();
  // con poche voci togliamo prima la quinta, poi la radice (restano le note "colorate")
  while (intervalli.length > quante && intervalli.includes(7)) intervalli.splice(intervalli.indexOf(7), 1);
  while (intervalli.length > quante) intervalli.shift();
  const pcs = [...new Set(intervalli.map((i) => (acc.radice + i) % 12))];
  let migliore = null, punti = Infinity;
  for (let r = 0; r < pcs.length; r++) {
    const v = [];
    let n = centro - 7 + ((((pcs[r] - (centro - 7)) % 12) + 12) % 12);
    v.push(n);
    for (let k = 1; k < pcs.length; k++) {
      const pc = pcs[(r + k) % pcs.length];
      n += ((((pc - n) % 12) + 12) % 12) || 12;
      v.push(n);
    }
    const media = v.reduce((s, x) => s + x, 0) / v.length;
    let p = Math.abs(media - centro) * 1.5;
    if (prec && prec.length === v.length) p = v.reduce((s, x, i) => s + Math.abs(x - prec[i]), 0) + Math.abs(media - centro) * 0.5;
    if (p < punti) { punti = p; migliore = v; }
  }
  return migliore;
}

/* ------------------------------------------------------------------------ */
/*  Gli stili di accompagnamento                                            */
/*  Ognuno riceve un pezzo di battuta (inizio, durata in battiti) e          */
/*  restituisce le note: [battito, midi, durata, forza]                      */
/* ------------------------------------------------------------------------ */
const STILI = {
  /** accordo tenuto (archi, coro) */
  tenuto: (v, acc, inizio, d) => v.map((m) => [inizio, m, d + 0.15, 1]),
  /** accordo sui battiti deboli (2 e 4), corto: il "passo" allegro */
  controtempo: (v, acc, inizio, d) => {
    const out = [];
    for (let b = Math.ceil(inizio); b < inizio + d; b++) if (b % 2 === 1) v.forEach((m, k) => out.push([b + k * 0.012, m, 0.45, 1]));
    return out;
  },
  /** um-pa-pa: l'accordo sul secondo e terzo battito */
  valzer: (v, acc, inizio, d) => {
    const out = [];
    for (let b = Math.ceil(inizio); b < inizio + d; b++) if (b % 3 !== 0) v.forEach((m) => out.push([b, m, 0.5, b % 3 === 1 ? 1 : 0.85]));
    return out;
  },
  /** accordo "spezzato" a crome che sale e scende */
  arpeggio: (v, acc, inizio, d) => {
    const scala = [...v, v[0] + 12], giro = [0, 1, 2, 3, 2, 1].map((i) => Math.min(i, scala.length - 1)), out = [];
    for (let k = 0; k < d * 2; k++) out.push([inizio + k / 2, scala[giro[k % giro.length]], 1.4, k === 0 ? 1.1 : 0.85]);
    return out;
  },
  /** scintille a semicrome su due ottave (celesta) */
  arpeggio16: (v, acc, inizio, d) => {
    const scala = [...v, ...v.map((m) => m + 12)], out = [];
    for (let k = 0; k < d * 4; k++) {
      const i = k % (scala.length * 2 - 2), j = i < scala.length ? i : scala.length * 2 - 2 - i;
      out.push([inizio + k / 4, scala[j], 0.7, k % 4 === 0 ? 1 : 0.75]);
    }
    return out;
  },
  /** basso albertino (basso - alto - medio - alto), come nelle sonatine: radice + terza + settima (o quinta) */
  alberti: (v, acc, inizio, d) => {
    const r = vicina(acc.radice, v[0] - 4), I = acc.intervalli;
    const terza = I.find((i) => i === 3 || i === 4) ?? I.find((i) => i === 2 || i === 5) ?? 4;
    const alta = I.find((i) => i === 10 || i === 11) ?? 7;
    const fig = [r, r + alta, r + terza + (terza < 5 ? 12 : 0) > r + alta ? r + terza : r + terza + 12, r + alta], out = [];
    for (let k = 0; k < d * 2; k++) out.push([inizio + k / 2, fig[k % 4], 0.9, k === 0 ? 1.1 : 0.8]);
    return out;
  },
  /** onde del pianoforte (radice grave, quinta, ottava, decima...): il volo */
  onde: (v, acc, inizio, d) => {
    const r = vicina(acc.basso, 45), terza = acc.intervalli.includes(3) ? 3 : acc.intervalli.includes(5) && !acc.intervalli.includes(4) ? 5 : 4;
    const rr = vicina(acc.radice, r + 5);
    const fig = [r, rr + 7, rr + 12, rr + 12 + terza, rr + 19, rr + 12 + terza, rr + 12, rr + 7], out = [];
    for (let k = 0; k < d * 2; k++) out.push([inizio + k / 2, fig[k % 8], 1.8, k === 0 ? 1.15 : 0.8]);
    return out;
  },
  /** accordo arpeggiato veloce (arpa) */
  rullato: (v, acc, inizio, d) => v.map((m, k) => [inizio + k * 0.09, m, d + 0.5, 0.8 + k * 0.05]),
};

const BASSI = {
  radice: (acc, inizio, d, centro) => [[inizio, vicina(acc.basso, centro), d + 0.1, 1]],
  /** radice sul primo battito, quinta sul terzo (e un passaggio verso la battuta dopo) */
  unoTre: (acc, inizio, d, centro, dopo, battuta, tonica) => {
    const r = vicina(acc.basso, centro), out = [[inizio, r, 0.95, 1]];
    if (d >= 3) out.push([inizio + 2, vicina((acc.radice + 7) % 12, r + 4), 0.95, 0.85]);
    if (dopo && d >= 4 && dopo.basso !== acc.basso) {
      // una nota di passaggio che porta, per grado, alla prossima nota del basso
      const arrivo = vicina(dopo.basso, centro), verso = arrivo > r ? -1 : 1;
      const inScala = (m) => [0, 2, 4, 5, 7, 9, 11].includes((((m - tonica) % 12) + 12) % 12);
      const passo = inScala(arrivo + 2 * verso) ? 2 : 1;
      out.push([inizio + 3.5, arrivo + passo * verso, 0.45, 0.7]);
    }
    return out;
  },
  valzer: (acc, inizio, d, centro, dopo, battuta) => {
    const r = vicina(battuta % 2 ? (acc.radice + 7) % 12 : acc.basso, centro);
    return [[inizio, r, 1.0, 1]];
  },
};

/* ------------------------------------------------------------------------ */
/*  I TEMI                                                                  */
/* ------------------------------------------------------------------------ */
// La passeggiata con Gogo: allegra, a passettini, in Do maggiore
const PASSEGGIATA_ACCORDI = ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7 G7', 'C', 'F', 'G', 'Em', 'Am', 'Dm7', 'G', 'C/E F', 'G7'];
const PASSEGGIATA_MELODIA = `
  E5:1.5 D5:0.5 C5:1 G4:1 | A4:1 C5:1 E5:1.5 D5:0.5 | C5:1.5 A4:0.5 F5:1 E5:0.5 D5:0.5 | D5:3 -:1 |
  E5:1.5 D5:0.5 C5:1 G5:1 | A5:1 G5:0.5 E5:0.5 C5:1 E5:1 | F5:1 E5:0.5 D5:0.5 B4:1 D5:1 | C5:3 -:1 |
  A5:1.5 G5:0.5 F5:1 A5:1 | G5:1.5 F5:0.5 E5:1 D5:1 | E5:1 G5:1 B5:1.5 A5:0.5 | A5:2 C6:1 A5:1 |
  F5:1.5 E5:0.5 D5:1 F5:1 | E5:1 D5:1 C5:1 B4:1 | C5:1 E5:1 A5:1 G5:1 | G5:2 F5:0.5 E5:0.5 D5:1 |`;
const PASSEGGIATA_CONTRO = `
  -:4 | -:4 | -:4 | -:2 G5:0.5 A5:0.5 B5:0.5 D6:0.5 |
  -:4 | -:4 | -:4 | -:2 E6:0.5 D6:0.5 C6:0.5 G5:0.5 |
  C6:2 A5:2 | B5:2 D6:2 | B5:2 G5:2 | C6:2 E6:2 |
  A5:2 F5:2 | B5:2 G5:2 | G5:2 C6:2 | B5:1 D6:1 G6:2 |`;

const TEMI = {
  passeggiata: {
    bpm: 100, battiti: 4, tonica: 0, giri: 2, volume: 0.98,
    accordi: PASSEGGIATA_ACCORDI,
    parti: [
      { s: 'flauto', melodia: PASSEGGIATA_MELODIA, vel: 0.8, pan: 0.12, riv: 0.3, legato: 0.92 },
      { s: 'celesta', melodia: PASSEGGIATA_CONTRO, vel: 0.5, pan: -0.35, riv: 0.45, giri: [1] },
      { s: 'piano', accomp: 'controtempo', centro: 62, quante: 3, vel: 0.42, pan: -0.15, riv: 0.25 },
      { s: 'arpa', accomp: 'arpeggio', centro: 58, quante: 3, vel: 0.26, pan: 0.3, riv: 0.4, giri: [0] },
      { s: 'archi', accomp: 'tenuto', centro: 62, quante: 3, vel: 0.2, pan: 0, riv: 0.5, giri: [1] },
      { s: 'contrabbasso', basso: 'unoTre', centro: 40, vel: 0.8, pan: 0, riv: 0.12 },
    ],
  },

  // Il mondo diventato bianco: poche note sospese, misteriose e tenere (La minore)
  bianco: {
    bpm: 66, battiti: 4, tonica: 0, giri: 2, volume: 1.23,
    accordi: ['Am9', 'Fmaj7', 'C', 'G/B', 'Am', 'Fmaj7', 'Dm9', 'Em7'],
    parti: [
      { s: 'carillon', melodia: '-:1 E5:1 A5:1 B5:1 | C6:2 A5:1 E5:1 | G5:3 -:1 | -:1 D5:1 G5:1 A5:1 | B5:2 C6:1 B5:1 | A5:3 -:1 | -:1 F5:1 E5:1 D5:1 | E5:3 -:1',
        vel: 0.6, pan: 0.2, riv: 0.7, giri: [0], durata: 2 },
      { s: 'piano', melodia: '-:1 E5:1 A5:1 B5:1 | C6:2 A5:1 E5:1 | G5:3 -:1 | -:1 D5:1 G5:1 A5:1 | B5:2 C6:1 B5:1 | A5:3 -:1 | -:1 F5:1 E5:1 D5:1 | E5:3 -:1',
        trasponi: -12, vel: 0.45, pan: -0.1, riv: 0.55, giri: [1], durata: 1.6 },
      { s: 'carillon', melodia: '-:4 | E6:4 | -:4 | D6:4 | -:4 | C6:4 | -:4 | B5:4', vel: 0.4, pan: 0.4, riv: 0.8, giri: [1] },
      { s: 'archi', accomp: 'tenuto', centro: 57, quante: 4, vel: 0.22, pan: 0, riv: 0.6 },
      { s: 'violoncelli', basso: 'radice', centro: 45, vel: 0.35, pan: -0.1, riv: 0.4 },
      { s: 'arpa', accomp: 'rullato', centro: 60, quante: 4, vel: 0.25, pan: 0.3, riv: 0.6, giri: [1] },
      { s: 'coro', accomp: 'tenuto', centro: 69, quante: 3, vel: 0.13, pan: 0, riv: 0.8, giri: [1] },
    ],
  },

  // La magia della bacchetta: scintille e meraviglia (Fa lidio)
  magia: {
    bpm: 92, battiti: 4, tonica: 5, giri: 2, volume: 1.02,
    accordi: ['Fmaj7', 'G/F', 'Em7', 'Am7', 'Dm9', 'G6', 'Fmaj7', 'Gsus4 G'],
    parti: [
      { s: 'flauto', melodia: 'A5:2 C6:1 E6:1 | D6:3 B5:1 | G5:2 B5:1 D6:1 | C6:3 -:1 | F5:1 A5:1 E6:2 | D6:1.5 C6:0.5 B5:1 G5:1 | A5:1 C6:1 E6:1 G6:1 | C6:2 B5:1 D6:1',
        vel: 0.75, pan: 0.1, riv: 0.45, legato: 0.95 },
      { s: 'campanella', melodia: 'A6:2 C7:1 E7:1 | D7:3 B6:1 | G6:2 B6:1 D7:1 | C7:3 -:1 | F6:1 A6:1 E7:2 | D7:1.5 C7:0.5 B6:1 G6:1 | A6:1 C7:1 E7:1 G7:1 | C7:2 B6:1 D7:1',
        vel: 0.22, pan: -0.3, riv: 0.7, giri: [1], durata: 1.2 },
      { s: 'celesta', accomp: 'arpeggio16', centro: 79, quante: 4, vel: 0.28, pan: -0.25, riv: 0.6 },
      { s: 'arpa', accomp: 'arpeggio', centro: 60, quante: 4, vel: 0.3, pan: 0.3, riv: 0.5 },
      { s: 'archi', accomp: 'tenuto', centro: 64, quante: 4, vel: 0.2, pan: 0, riv: 0.6 },
      { s: 'violoncelli', basso: 'radice', centro: 41, vel: 0.35, pan: -0.1, riv: 0.4 },
    ],
  },

  // La città immaginata sull'acqua: un valzer buffo e allegro (Fa maggiore)
  citta: {
    bpm: 108, battiti: 3, tonica: 5, giri: 2, volume: 1.25, viennese: true,
    accordi: ['F', 'F', 'Gm7', 'C7', 'C7', 'C7', 'F', 'F', 'F7', 'Bb', 'Bb', 'G7', 'F/C', 'C7', 'F', 'C7'],
    parti: [
      { s: 'clarinetto', melodia: `C5:1 F5:1 A5:1 | C6:2 A5:1 | Bb5:1 A5:1 G5:1 | E5:2 G5:1 | Bb5:1 A5:1 G5:1 | E5:1 F5:1 G5:1 | A5:2 F5:1 | C5:2 -:1 |
          C5:1 F5:1 A5:1 | D6:2 C6:1 | D6:1 Bb5:1 F5:1 | G5:1 B5:1 D6:1 | C6:2 A5:1 | G5:2 E5:1 | F5:2 -:1 | C5:1 D5:1 E5:1`,
        vel: 0.8, pan: 0.15, riv: 0.3, legato: 0.72 },
      { s: 'flauto', melodia: `C5:1 F5:1 A5:1 | C6:2 A5:1 | Bb5:1 A5:1 G5:1 | E5:2 G5:1 | Bb5:1 A5:1 G5:1 | E5:1 F5:1 G5:1 | A5:2 F5:1 | C5:2 -:1 |
          C5:1 F5:1 A5:1 | D6:2 C6:1 | D6:1 Bb5:1 F5:1 | G5:1 B5:1 D6:1 | C6:2 A5:1 | G5:2 E5:1 | F5:2 -:1 | C5:1 D5:1 E5:1`,
        trasponi: 12, vel: 0.35, pan: -0.1, riv: 0.4, legato: 0.7, giri: [1] },
      { s: 'celesta', melodia: `-:3 | -:1 A6:0.5 G6:0.5 F6:1 | -:3 | -:1 G6:0.5 E6:0.5 C6:1 | -:3 | -:3 | -:1 C7:0.5 A6:0.5 F6:1 | -:1 F6:1 -:1 |
          -:3 | -:1 D7:0.5 Bb6:0.5 F6:1 | -:3 | -:1 B6:0.5 G6:0.5 F6:1 | -:1 A6:0.5 F6:0.5 C6:1 | -:1 Bb6:0.5 G6:0.5 E6:1 | -:1 F6:0.5 A6:0.5 C7:1 | -:3`,
        vel: 0.42, pan: -0.35, riv: 0.5, giri: [1] },
      { s: 'pizzicato', accomp: 'valzer', centro: 62, quante: 3, vel: 0.45, pan: -0.2, riv: 0.25 },
      { s: 'contrabbasso', basso: 'valzer', centro: 41, vel: 0.85, pan: 0, riv: 0.12 },
      { s: 'archi', accomp: 'tenuto', centro: 60, quante: 3, vel: 0.14, pan: 0.1, riv: 0.5, giri: [1] },
    ],
  },

  // Il volo sulla balena: archi ampi che cantano, pianoforte a onde, coro lontano (Sol maggiore)
  volo: {
    bpm: 76, battiti: 4, tonica: 7, giri: 2, volume: 1.18,
    accordi: ['G', 'D/F#', 'Em', 'C', 'Am7', 'D', 'G', 'D', 'C', 'D', 'Bm7', 'Em', 'Am7', 'D', 'G/B C', 'D'],
    parti: [
      { s: 'archi', melodia: `D5:1 G5:1 A5:1 B5:1 | A5:3 F#5:1 | G5:2 B5:1 E6:1 | D6:3 C6:0.5 B5:0.5 |
          C6:2 A5:1 E5:1 | F#5:2 A5:1 D6:1 | B5:3 A5:1 | A5:4 |
          G5:1 A5:1 C6:1 E6:1 | D6:2 A5:1 D6:1 | D6:2 B5:1 F#5:1 | G5:3 E5:1 |
          E5:1 A5:1 C6:1 E6:1 | D6:2 C6:1 A5:1 | B5:2 C6:2 | A5:3 D5:1`,
        vel: 0.75, pan: 0.05, riv: 0.5, legato: 1.0 },
      { s: 'flauto', melodia: `-:4 | F#6:2 E6:2 | E6:2 G6:2 | F#6:2 E6:2 | E6:4 | D6:2 F#6:2 | G6:2 F#6:2 | E6:2 D6:2 |
          E6:4 | F#6:2 D6:2 | F#6:2 D6:2 | B5:2 G5:2 | C6:2 E6:2 | F#6:2 E6:2 | D6:2 E6:2 | F#6:4`,
        vel: 0.42, pan: -0.25, riv: 0.6, legato: 1.0, giri: [1] },
      { s: 'piano', accomp: 'onde', centro: 60, vel: 0.36, pan: -0.15, riv: 0.4 },
      { s: 'violoncelli', basso: 'radice', centro: 40, vel: 0.45, pan: 0, riv: 0.4 },
      { s: 'coro', accomp: 'tenuto', centro: 66, quante: 3, vel: 0.16, pan: 0.2, riv: 0.8 },
      { s: 'arpa', accomp: 'rullato', centro: 67, quante: 4, vel: 0.3, pan: 0.35, riv: 0.6, ogni: 4 },
    ],
  },

  // Dentro il forno e la libreria: caldo, tranquillo, affettuoso (Do maggiore, accordi "jazz")
  interno: {
    bpm: 84, battiti: 4, tonica: 0, giri: 2, volume: 1.11,
    accordi: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'Am7', 'Dm7 G7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7 Am7', 'Dm7', 'G7sus4 G7'],
    parti: [
      { s: 'carillon', melodia: `E5:1 G5:1 B5:1.5 A5:0.5 | G5:2 E5:1 C5:1 | D5:1 F5:1 A5:1.5 G5:0.5 | F5:2 D5:1 B4:1 |
          E5:1 G5:1 D6:1.5 B5:0.5 | C6:2 A5:1 E5:1 | F5:1 A5:1 G5:1 F5:1 | E5:3 -:1 |
          A5:1 C6:1 E6:1.5 D6:0.5 | B5:2 G5:1 E5:1 | C6:2 A5:1 F5:1 | E5:1 G5:1 B5:2 |
          A5:1.5 G5:0.5 F5:1 E5:1 | G5:2 E5:1 C5:1 | D5:1 F5:1 A5:1 C6:1 | C6:2 B5:1 G5:1`,
        vel: 0.62, pan: 0.15, riv: 0.45, giri: [0], durata: 1.4 },
      { s: 'piano', melodia: `E5:1 G5:1 B5:1.5 A5:0.5 | G5:2 E5:1 C5:1 | D5:1 F5:1 A5:1.5 G5:0.5 | F5:2 D5:1 B4:1 |
          E5:1 G5:1 D6:1.5 B5:0.5 | C6:2 A5:1 E5:1 | F5:1 A5:1 G5:1 F5:1 | E5:3 -:1 |
          A5:1 C6:1 E6:1.5 D6:0.5 | B5:2 G5:1 E5:1 | C6:2 A5:1 F5:1 | E5:1 G5:1 B5:2 |
          A5:1.5 G5:0.5 F5:1 E5:1 | G5:2 E5:1 C5:1 | D5:1 F5:1 A5:1 C6:1 | C6:2 B5:1 G5:1`,
        vel: 0.5, pan: 0.1, riv: 0.35, giri: [1], durata: 1.2 },
      { s: 'flauto', melodia: `G4:2 B4:2 | C5:2 E5:2 | F5:2 C5:2 | B4:2 D5:2 | B4:2 D5:2 | E5:2 C5:2 | A4:2 B4:2 | C5:4 |
          C5:2 E5:2 | D5:2 B4:2 | A4:2 F4:2 | G4:2 B4:2 | A4:2 C5:2 | B4:2 C5:2 | D5:2 F5:2 | F5:2 D5:2`,
        vel: 0.4, pan: -0.25, riv: 0.45, legato: 1.0, giri: [1] },
      { s: 'piano', accomp: 'alberti', centro: 57, quante: 3, vel: 0.3, pan: -0.15, riv: 0.3, giri: [0] },
      { s: 'arpa', accomp: 'arpeggio', centro: 57, quante: 4, vel: 0.26, pan: -0.3, riv: 0.4, giri: [1] },
      { s: 'archi', accomp: 'tenuto', centro: 60, quante: 4, vel: 0.14, pan: 0, riv: 0.5, giri: [1] },
      { s: 'contrabbasso', basso: 'unoTre', centro: 40, vel: 0.6, pan: 0, riv: 0.12 },
    ],
  },

  // Il finale (Gogo ritrovato): il tema della passeggiata, lento, caldo e commosso
  finale: {
    bpm: 80, battiti: 4, tonica: 0, giri: 2, volume: 1.3,
    accordi: PASSEGGIATA_ACCORDI,
    parti: [
      { s: 'piano', melodia: PASSEGGIATA_MELODIA, vel: 0.55, pan: 0.05, riv: 0.4, giri: [0], durata: 1.3 },
      { s: 'archi', melodia: PASSEGGIATA_MELODIA, trasponi: -12, vel: 0.55, pan: 0.05, riv: 0.5, legato: 1.0, giri: [1] },
      { s: 'flauto', melodia: PASSEGGIATA_CONTRO, vel: 0.45, pan: -0.25, riv: 0.55, legato: 1.0, giri: [1] },
      { s: 'arpa', accomp: 'arpeggio', centro: 60, quante: 3, vel: 0.3, pan: 0.3, riv: 0.45, giri: [0] },
      { s: 'piano', accomp: 'arpeggio', centro: 57, quante: 3, vel: 0.28, pan: -0.2, riv: 0.4, giri: [1] },
      { s: 'archi', accomp: 'tenuto', centro: 60, quante: 3, vel: 0.18, pan: 0, riv: 0.5, giri: [0] },
      { s: 'violoncelli', basso: 'radice', centro: 40, vel: 0.45, pan: -0.05, riv: 0.4 },
    ],
  },
};

/* ------------------------------------------------------------------------ */
/*  Dallo spartito all'elenco delle note                                    */
/* ------------------------------------------------------------------------ */
function costruisci(T) {
  const B = T.battiti, battute = T.accordi.length, giro = battute * B;
  // gli accordi di ogni battuta, con inizio e durata
  const pezzi = [];
  T.accordi.forEach((testo, i) => {
    const nomi = testo.split(/\s+/), d = B / nomi.length;
    nomi.forEach((n, k) => pezzi.push({ acc: leggiAccordo(n), inizio: i * B + k * d, d, battuta: i }));
  });
  const eventi = [], strumenti = new Set();
  T.parti.forEach((P, p) => {
    strumenti.add(P.s);
    const giri = P.giri || Array.from({ length: T.giri }, (_, i) => i);
    let note = [];
    if (P.melodia) {
      const mel = leggiMelodia(P.melodia);
      if (Math.abs(mel.totale - giro) > 1e-6) console.warn(`Tema: la melodia di ${P.s} dura ${mel.totale} battiti invece di ${giro}`);
      note = mel.map((n) => {
        // la frase "respira": un po' più forte a metà di ogni frase di 4 battute
        const arco = 0.9 + 0.16 * Math.sin(Math.PI * (((n.b / B) % 4) / 4));
        return [n.b, n.midi + (P.trasponi || 0), (P.durata || n.dur * (P.legato || 0.95)), arco];
      });
    } else {
      let prec = null;
      pezzi.forEach((z, i) => {
        if (P.ogni && (z.battuta % P.ogni !== 0 || z.inizio !== z.battuta * B)) return;
        const dopo = pezzi[i + 1] ? pezzi[i + 1].acc : pezzi[0].acc;
        if (P.basso) {
          note.push(...BASSI[P.basso](z.acc, z.inizio, z.d, P.centro || 40, dopo, z.battuta, T.tonica));
        } else {
          const v = disponi(z.acc, P.centro || 60, prec, P.quante || 3);
          prec = v;
          const d = P.ogni ? P.ogni * B : z.d;
          note.push(...STILI[P.accomp](v, z.acc, z.inizio, d).map((n) => {
            if (n[0] === Math.floor(n[0]) && n[0] % B === 0) n[3] *= 1.08;   // accento sul primo battito
            return n;
          }));
        }
      });
    }
    for (const g of giri) {
      for (const [b, midi, dur, forza] of note) {
        let bb = b + g * giro;
        if (T.viennese && Math.abs((b % B) - 1) < 1e-6) bb -= 0.05;     // valzer viennese: il "pa" arriva un filo prima
        eventi.push({ b: bb, p, s: P.s, midi, dur, vel: P.vel * forza });
      }
    }
  });
  eventi.sort((a, c) => a.b - c.b);
  return { eventi, lunghezza: giro * T.giri, strumenti: [...strumenti] };
}

/* ------------------------------------------------------------------------ */
/*  Il sequencer                                                            */
/* ------------------------------------------------------------------------ */
export const Musica = {
  nome: null,
  voci: [],       // temi in riproduzione (durante una dissolvenza ce ne sono due)
};

const AVANTI = 0.5;       // quanti secondi prima programmiamo le note

/** Fa partire un tema (con dissolvenza dal precedente). null = silenzio. */
Musica.suona = function (nome) {
  const ctx = Audio.ctx;
  if (!ctx || nome === this.nome) return;
  this.nome = nome;
  const t = ctx.currentTime;
  for (const v of this.voci) {
    if (v.fine !== Infinity) continue;
    for (const g of [v.dry.gain, v.wet.gain]) {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else g.cancelScheduledValues(t);
      g.setTargetAtTime(0, t, 0.8);
    }
    v.fine = t + 3.2;        // dopo, nessuna nota nuova
    v.togli = t + 7;         // e dopo ancora, quando anche gli echi sono spenti, si stacca
  }
  const T = TEMI[nome];
  if (!T) return;
  if (!T._fatto) T._fatto = costruisci(T);
  const F = T._fatto;
  Audio.tonica = T.tonica;
  Audio.preparaStrumenti(F.strumenti, true);
  // i nodi del tema: un'uscita "asciutta" e una verso il riverbero, una coppia per ogni parte
  const dry = ctx.createGain(), wet = ctx.createGain();
  dry.gain.value = 0; wet.gain.value = 0;
  dry.connect(Audio.busMusica); wet.connect(Audio.mandataMusica);
  const parti = T.parti.map((P) => {
    const g = ctx.createGain();
    let u = g;
    if (ctx.createStereoPanner) { const pan = ctx.createStereoPanner(); pan.pan.value = Math.max(-0.8, Math.min(0.8, (P.pan || 0) * 1.7)); g.connect(pan); u = pan; }
    u.connect(dry);
    const r = ctx.createGain(); r.gain.value = P.riv === undefined ? 0.35 : P.riv;
    u.connect(r); r.connect(wet);
    return { nodo: g, umano: P.melodia ? 0.006 : 0.009 };
  });
  this.voci.push({
    nome, T, eventi: F.eventi, lunghezza: F.lunghezza, strumenti: F.strumenti, spb: 60 / T.bpm,
    dry, wet, parti, t0: null, giro: 0, idx: 0, fine: Infinity, togli: Infinity,
    scadenza: t + 8,          // se qualche strumento tarda, dopo 8 s si parte lo stesso
  });
};

/** Da chiamare a ogni fotogramma (fa battere anche il cuore di audio.js). */
Musica.aggiorna = function () {
  Audio._battito();
};

/** Programma le note dei prossimi decimi di secondo (lo chiama Audio._battito). */
Musica._programma = function (ora) {
  for (const v of this.voci) {
    if (v.t0 === null) {
      if (v.fine !== Infinity) continue;
      if (!v.strumenti.every((s) => Audio.strumentoPronto(s)) && ora < v.scadenza) continue;
      // si parte: dissolvenza in entrata di circa 2 secondi
      v.t0 = ora + 0.3;
      const vol = v.T.volume || 1;
      for (const g of [v.dry.gain, v.wet.gain]) { g.setValueAtTime(0, ora); g.setTargetAtTime(vol, ora + 0.1, 0.5); }
    }
    if (!v.eventi.length) continue;
    for (let guardia = 0; guardia < 500; guardia++) {
      const e = v.eventi[v.idx];
      const t = v.t0 + (v.giro * v.lunghezza + e.b) * v.spb;
      if (t > ora + AVANTI || t >= v.fine) break;
      if (t >= ora - 0.03) {          // dopo un "inciampo" del gioco le note perse si saltano (niente grappoli)
        const P = v.parti[e.p];
        const sposta = (Math.random() - 0.5) * 2 * P.umano;
        const vel = Math.min(1, e.vel * (0.94 + Math.random() * 0.12));
        Audio.strumento(e.s, e.midi, Math.max(ora, t + sposta), e.dur * v.spb, vel, P.nodo);
      }
      if (++v.idx >= v.eventi.length) { v.idx = 0; v.giro++; }
    }
  }
  // togli i temi finiti
  if (this.voci.some((v) => ora > v.togli)) {
    this.voci = this.voci.filter((v) => {
      if (ora <= v.togli) return true;
      v.dry.disconnect(); v.wet.disconnect();
      return false;
    });
  }
};

Audio._clienti.push((t) => Musica._programma(t));

/* per i test e per chi vuole curiosare */
Musica._temi = TEMI;
Musica._costruisci = costruisci;
