/* ==========================================================================
 *  audio.js — EFFETTI SONORI (generati dal codice con la Web Audio API)
 *  --------------------------------------------------------------------------
 *  Lia "vede" con le orecchie: ogni suono ha una posizione nel mondo.
 *  Se Biscotto abbaia a destra lo senti a destra, se è lontano lo senti
 *  piano, se c'è un muro in mezzo lo senti ovattato. Meglio con le cuffie!
 *
 *  Il titolo originale del cortometraggio è "敲敲" (toc toc): il suono del
 *  bastone è il protagonista.
 *
 *  Struttura:  suoni → bus effetti ─┐
 *              musica → bus musica ─┼→ volume generale → altoparlanti
 *              (un po' di tutto)  → riverbero ┘
 * ========================================================================== */
import { CONFIG } from '../config.js';

const differenza = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export const Audio = {
  ctx: null,
  ascoltatore: { x: 0, y: 0, angolo: 0 },
  mondo: null,
  continui: [],
  muto: false,
};

/* ------------------------------------------------------------------------ */
/*  Avvio (va chiamato dopo un tocco dell'utente)                           */
/* ------------------------------------------------------------------------ */
Audio.avvia = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try {
    const ctx = (this.ctx = new C());
    this.generale = ctx.createGain();
    this.generale.connect(ctx.destination);
    // compressore leggero: evita che i suoni forti "graffino"
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3;
    comp.connect(this.generale);
    this.busEffetti = ctx.createGain();
    this.busMusica = ctx.createGain();
    this.busEffetti.connect(comp);
    this.busMusica.connect(comp);
    // riverbero: una "stanza" artificiale fatta di rumore che si spegne
    this.riverbero = ctx.createConvolver();
    this.riverbero.buffer = this._impulso(2.4);
    this.mandataRiverbero = ctx.createGain();
    this.mandataRiverbero.gain.value = 0.28;
    this.mandataRiverbero.connect(this.riverbero);
    this.riverbero.connect(comp);
    // rumore bianco riutilizzabile
    const n = ctx.sampleRate * 2;
    this.rumore = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.rumore.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.impostaVolumi(CONFIG.audio.musica, CONFIG.audio.effetti);
  } catch (e) {
    console.warn('Audio non disponibile', e);
    this.ctx = null;
  }
};

Audio._impulso = function (secondi) {
  const ctx = this.ctx, n = Math.floor(ctx.sampleRate * secondi);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  return b;
};

Audio.impostaVolumi = function (musica, effetti) {
  CONFIG.audio.musica = musica;
  CONFIG.audio.effetti = effetti;
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this.busMusica.gain.setTargetAtTime(musica, t, 0.1);
  this.busEffetti.gain.setTargetAtTime(effetti, t, 0.1);
};

Audio.alternaMuto = function () {
  this.muto = !this.muto;
  if (this.ctx) this.generale.gain.setTargetAtTime(this.muto ? 0 : 1, this.ctx.currentTime, 0.05);
  return this.muto;
};

Audio.sospendi = function (si) {
  if (!this.ctx) return;
  if (si) this.ctx.suspend(); else this.ctx.resume();
};

/* ------------------------------------------------------------------------ */
/*  Mattoncini                                                              */
/* ------------------------------------------------------------------------ */
Audio._ora = function () { return this.ctx.currentTime; };

Audio._inv = function (t0, picco, attacco, durata) {
  const g = this.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(picco, t0 + attacco);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durata);
  return g;
};

Audio._filtro = function (tipo, f, q) {
  const n = this.ctx.createBiquadFilter();
  n.type = tipo; n.frequency.value = f; n.Q.value = q || 1;
  return n;
};

Audio._osc = function (tipo, f) {
  const o = this.ctx.createOscillator();
  o.type = tipo; o.frequency.value = f;
  return o;
};

Audio._noise = function () {
  const s = this.ctx.createBufferSource();
  s.buffer = this.rumore;
  return s;
};

/**
 * Uscita "posizionata": volume secondo la distanza, destra/sinistra secondo
 * la direzione, filtro ovattato se c'è un muro in mezzo.
 * Se x è undefined il suono è "addosso" a Lia (niente posizione).
 */
Audio._uscita = function (x, y, volume, riverbero) {
  const ctx = this.ctx;
  const g = ctx.createGain();
  let pan = 0, vol = volume, ovattato = false;
  if (x !== undefined) {
    const L = this.ascoltatore;
    const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy);
    pan = d < 0.4 ? 0 : Math.sin(differenza(L.angolo, Math.atan2(dy, dx))) * 0.85;
    vol = volume / (1 + 0.06 * d * d);
    ovattato = this.mondo ? !this.mondo.lineaDiVista(L.x, L.y, x, y, 2.0) : false;
  }
  g.gain.value = vol;
  let ultimo = g;
  if (ovattato) { const f = this._filtro('lowpass', 700, 0.7); ultimo.connect(f); ultimo = f; }
  if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; ultimo.connect(p); ultimo = p; }
  ultimo.connect(this.busEffetti);
  if (riverbero) {
    const r = ctx.createGain();
    r.gain.value = riverbero;
    ultimo.connect(r);
    r.connect(this.mandataRiverbero);
  }
  return g;
};

/* ------------------------------------------------------------------------ */
/*  Effetti brevi                                                           */
/* ------------------------------------------------------------------------ */

/** "Toc toc": il bastone che bussa sul selciato (legno su pietra). */
Audio.toc = function (magico) {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.9, 0.35);
  const t = this._ora();
  for (let k = 0; k < 2; k++) {
    const t0 = t + k * 0.16;
    const o = this._osc('sine', 1300 - k * 150);
    o.frequency.exponentialRampToValueAtTime(420, t0 + 0.05);
    const e = this._inv(t0, 0.35, 0.002, 0.11);
    o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + 0.14);
    const r = this._noise();
    const f = this._filtro('bandpass', 2600, 3);
    const e2 = this._inv(t0, 0.3, 0.001, 0.05);
    r.connect(f); f.connect(e2); e2.connect(out); r.start(t0, Math.random()); r.stop(t0 + 0.07);
  }
  if (magico) this.magia(0.35);
};

/*
 * IL BASTONE CHE TOCCA I MATERIALI
 * Ogni materiale ha il suo suono: Lia "vede" il mondo ascoltandolo.
 *   pietra   clic secco          mattoni  colpo più sordo
 *   legno    "tok" cavo          intonaco "tuc" morbido
 *   vetro    "tin" cristallino   metallo  "dong" che risuona a lungo
 *   foglie   fruscio             ceramica "tink"
 *   libri    tonfo di carta      acqua    "plip"
 */
Audio.tocco = function (materiale, x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.9, 0.4);
  const t = this._ora();
  // piccoli attrezzi: un tono che scende, un rumore filtrato, una serie di parziali
  const tono = (tipo, f0, f1, picco, durata, ritardo) => {
    const t0 = t + (ritardo || 0);
    const o = this._osc(tipo, f0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + Math.min(0.08, durata * 0.6));
    const e = this._inv(t0, picco, 0.002, durata);
    o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + durata + 0.05);
  };
  const soffio = (filtro, f, q, picco, durata, ritardo) => {
    const t0 = t + (ritardo || 0);
    const r = this._noise();
    const fl = this._filtro(filtro, f, q);
    const e = this._inv(t0, picco, 0.002, durata);
    r.connect(fl); fl.connect(e); e.connect(out); r.start(t0, Math.random()); r.stop(t0 + durata + 0.05);
  };
  const campana = (parziali, durata) => parziali.forEach(([f, a], k) => tono('sine', f, 0, a, durata * (1 - k * 0.18)));
  switch (materiale) {
    case 'legno':
      tono('triangle', 420, 170, 0.4, 0.16); soffio('bandpass', 700, 4, 0.25, 0.06); tono('sine', 240, 0, 0.12, 0.22);
      break;
    case 'mattoni':
      tono('sine', 900, 300, 0.3, 0.09); soffio('bandpass', 1500, 1.5, 0.28, 0.06);
      break;
    case 'intonaco':
      tono('sine', 210, 140, 0.3, 0.1); soffio('lowpass', 700, 0.7, 0.3, 0.08);
      break;
    case 'vetro':
      soffio('highpass', 5000, 0.7, 0.12, 0.02);
      campana([[2637, 0.16], [3951, 0.08], [5274, 0.05]], 0.9);
      break;
    case 'metallo':
      soffio('bandpass', 3000, 2, 0.15, 0.03);
      campana([[523, 0.14], [1371, 0.1], [2210, 0.06], [3020, 0.04]], 1.6);
      break;
    case 'foglie':
      for (let k = 0; k < 4; k++) soffio('highpass', 2600 + Math.random() * 1500, 0.8, 0.12, 0.07, k * 0.05);
      break;
    case 'ceramica':
      soffio('bandpass', 4000, 2, 0.12, 0.02);
      campana([[1760, 0.16], [2489, 0.07]], 0.45);
      break;
    case 'libri':
      tono('sine', 150, 90, 0.3, 0.12); soffio('lowpass', 420, 0.7, 0.3, 0.1); soffio('highpass', 3200, 0.7, 0.08, 0.15, 0.05);
      break;
    case 'acqua':
      tono('sine', 480, 1300, 0.25, 0.12);
      tono('sine', 700, 1600, 0.1, 0.08, 0.12);
      tono('sine', 600, 1500, 0.08, 0.07, 0.22);
      break;
    default: // pietra
      tono('sine', 1300, 420, 0.35, 0.11); soffio('bandpass', 2600, 3, 0.3, 0.05);
  }
};

/** Passo: suono diverso per superficie ('pietra', 'erba', 'legno', 'mattoni'). */
Audio.passo = function (superficie, lato) {
  if (!this.ctx) return;
  const t = this._ora();
  const out = this._uscita(undefined, undefined, 0.45);
  const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
  const r = this._noise();
  let f;
  if (superficie === 'erba') f = this._filtro('lowpass', 900 + Math.random() * 300, 0.6);
  else if (superficie === 'legno') f = this._filtro('bandpass', 320 + Math.random() * 60, 1.5);
  else f = this._filtro('bandpass', 1500 + Math.random() * 600, 0.9);
  const e = this._inv(t, superficie === 'erba' ? 0.12 : 0.17, 0.004, superficie === 'erba' ? 0.16 : 0.08);
  r.connect(f); f.connect(e);
  if (p) { p.pan.value = lato ? 0.18 : -0.18; e.connect(p); p.connect(out); } else e.connect(out);
  r.start(t, Math.random()); r.stop(t + 0.2);
};

/** "Bau bau!" */
Audio.abbaio = function (x, y, volte) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 1.0, 0.3);
  const t = this._ora();
  for (let k = 0; k < (volte || 2); k++) {
    const t0 = t + k * 0.21;
    const o = this._osc('sawtooth', 600 + Math.random() * 60);
    o.frequency.exponentialRampToValueAtTime(320, t0 + 0.12);
    const f = this._filtro('bandpass', 1150, 1.3);
    const e = this._inv(t0, 0.55, 0.006, 0.16);
    o.connect(f); f.connect(e); e.connect(out); o.start(t0); o.stop(t0 + 0.2);
    const r = this._noise(); const f2 = this._filtro('bandpass', 1700, 1); const e2 = this._inv(t0, 0.15, 0.004, 0.09);
    r.connect(f2); f2.connect(e2); e2.connect(out); r.start(t0, Math.random()); r.stop(t0 + 0.12);
  }
};

/** Ringhio basso (Biscotto contro il ladro). */
Audio.ringhio = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.8);
  const t = this._ora();
  const o = this._osc('sawtooth', 95);
  const tremolo = this._osc('sine', 28);
  const prof = this.ctx.createGain(); prof.gain.value = 0.25;
  const g = this.ctx.createGain(); g.gain.value = 0.3;
  tremolo.connect(prof); prof.connect(g.gain);
  const f = this._filtro('lowpass', 600, 2);
  const e = this._inv(t, 0.6, 0.08, 1.1);
  o.connect(g); g.connect(f); f.connect(e); e.connect(out);
  o.start(t); tremolo.start(t); o.stop(t + 1.2); tremolo.stop(t + 1.2);
};

/** Miao. */
Audio.miagolio = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.7, 0.25);
  const t = this._ora();
  const o = this._osc('sawtooth', 620);
  o.frequency.linearRampToValueAtTime(980, t + 0.18);
  o.frequency.linearRampToValueAtTime(640, t + 0.55);
  const f = this._filtro('bandpass', 1400, 2.5);
  f.frequency.linearRampToValueAtTime(2200, t + 0.2);
  f.frequency.linearRampToValueAtTime(1000, t + 0.55);
  const e = this._inv(t, 0.4, 0.05, 0.6);
  o.connect(f); f.connect(e); e.connect(out); o.start(t); o.stop(t + 0.65);
};

/** Campanello della porta di un negozio. */
Audio.campanello = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.5, 0.6);
  const t = this._ora();
  [1568, 2093].forEach((fr, k) => {
    const o = this._osc('sine', fr);
    const e = this._inv(t + k * 0.12, 0.25, 0.003, 1.4);
    o.connect(e); e.connect(out); o.start(t + k * 0.12); o.stop(t + 1.6);
  });
};

/** Clacson simpatico ("pe-pè"). */
Audio.clacson = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.6);
  const t = this._ora();
  [0, 0.2].forEach((dt, k) => {
    const o = this._osc('square', k ? 466 : 415);
    const f = this._filtro('lowpass', 1600);
    const e = this._inv(t + dt, 0.25, 0.01, 0.17);
    o.connect(f); f.connect(e); e.connect(out); o.start(t + dt); o.stop(t + dt + 0.2);
  });
};

/** Fruscio di pagine (libri volanti). */
Audio.pagine = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.5);
  const t = this._ora();
  for (let k = 0; k < 4; k++) {
    const r = this._noise(); const f = this._filtro('highpass', 2500 + Math.random() * 2000, 0.7);
    const e = this._inv(t + k * 0.07, 0.2, 0.005, 0.06);
    r.connect(f); f.connect(e); e.connect(out); r.start(t + k * 0.07, Math.random()); r.stop(t + k * 0.07 + 0.08);
  }
};

/** Canto della balena: lungo, profondo, con eco. */
Audio.balena = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.55, 1.2);
  const t = this._ora();
  const o = this._osc('sine', 180);
  o.frequency.linearRampToValueAtTime(320, t + 1.2);
  o.frequency.linearRampToValueAtTime(210, t + 2.6);
  const vib = this._osc('sine', 4.5); const pv = this.ctx.createGain(); pv.gain.value = 6;
  vib.connect(pv); pv.connect(o.frequency);
  const o2 = this._osc('triangle', 360); o2.frequency.linearRampToValueAtTime(640, t + 1.2); o2.frequency.linearRampToValueAtTime(420, t + 2.6);
  const g2 = this.ctx.createGain(); g2.gain.value = 0.25;
  const e = this._inv(t, 0.5, 0.6, 3.0);
  o.connect(e); o2.connect(g2); g2.connect(e); e.connect(out);
  [o, o2, vib].forEach((n) => { n.start(t); n.stop(t + 3.1); });
};

/** Scintillio magico (arpeggio cristallino). */
Audio.magia = function (volume) {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, volume || 0.5, 0.8);
  const t = this._ora();
  [1318.5, 1568, 1975.5, 2637].forEach((fr, k) => {
    const o = this._osc('sine', fr);
    const e = this._inv(t + k * 0.06, 0.18, 0.004, 0.5);
    o.connect(e); e.connect(out); o.start(t + k * 0.06); o.stop(t + k * 0.06 + 0.55);
  });
};

/*
 * Le note della bacchetta: ogni colpo suona la nota successiva di una
 * scala pentatonica (do re mi sol la), come un carillon. Bussando nasce
 * una piccola melodia.
 */
const SCALA_CARILLON = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 880, 783.99, 659.25, 587.33];

/** Una nota di campanello (indice nella scala del carillon). */
Audio.nota = function (indice, volume) {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, volume || 0.35, 0.9);
  const t = this._ora();
  const fr = SCALA_CARILLON[((indice % SCALA_CARILLON.length) + SCALA_CARILLON.length) % SCALA_CARILLON.length];
  // fondamentale + armonico alto: suono di campanella di vetro
  [[fr, 0.22, 1.4], [fr * 2.01, 0.07, 0.7], [fr * 3.02, 0.03, 0.35]].forEach(([f, picco, dur]) => {
    const o = this._osc('sine', f);
    const e = this._inv(t, picco, 0.004, dur);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + dur + 0.05);
  });
};

/** Un tintinnio leggero quando l'onda scopre posti nuovi (più forte = più posti). */
Audio.scoperta = function (forza) {
  if (!this.ctx) return;
  const f = Math.min(1, forza || 0.5);
  const out = this._uscita(undefined, undefined, 0.12 + f * 0.18, 1.0);
  const t = this._ora();
  const note = [1568, 1760, 2093, 2349.3, 2637];
  const quante = 2 + Math.round(f * 3);
  for (let k = 0; k < quante; k++) {
    const fr = note[(k * 2 + Math.floor(Math.random() * 2)) % note.length];
    const t0 = t + k * 0.07 + Math.random() * 0.03;
    const o = this._osc('sine', fr);
    const e = this._inv(t0, 0.12, 0.003, 0.6);
    o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + 0.65);
  }
};

/** Una meraviglia scoperta: arpeggio che sale e un "glissando" di arpa. */
Audio.meraviglia = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.5, 1.0);
  const t = this._ora();
  [523.25, 659.25, 783.99, 987.77, 1046.5, 1318.5, 1567.98, 2093].forEach((fr, k) => {
    const o = this._osc(k % 2 ? 'triangle' : 'sine', fr);
    const e = this._inv(t + k * 0.055, 0.15, 0.004, 1.0);
    o.connect(e); e.connect(out); o.start(t + k * 0.055); o.stop(t + k * 0.055 + 1.05);
  });
};

/**
 * Il violino della rana: un piccolo valzer (note in Hz, durate in battiti).
 * Un'onda "a dente di sega" filtrata, con il vibrato, somiglia a un violino.
 */
Audio.violino = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.35, 0.8);
  const t = this._ora();
  const melodia = [[659, 1], [784, 1], [880, 1], [784, 2], [659, 1], [587, 1], [659, 1], [523, 3],
    [587, 1], [659, 1], [698, 1], [659, 2], [587, 1], [523, 1], [494, 1], [523, 3]];
  const battito = 0.24;
  let tt = t;
  for (const [f, d] of melodia) {
    const dur = d * battito;
    const o = this._osc('sawtooth', f);
    const vib = this._osc('sine', 5.5);
    const vg = this.ctx.createGain(); vg.gain.value = f * 0.008;
    vib.connect(vg); vg.connect(o.frequency);
    const fl = this._filtro('lowpass', 1900, 0.8);
    const e = this.ctx.createGain();
    e.gain.setValueAtTime(0.0001, tt);
    e.gain.linearRampToValueAtTime(0.09, tt + 0.05);
    e.gain.setValueAtTime(0.08, tt + dur * 0.75);
    e.gain.linearRampToValueAtTime(0.0001, tt + dur);
    o.connect(fl); fl.connect(e); e.connect(out);
    o.start(tt); vib.start(tt); o.stop(tt + dur + 0.02); vib.stop(tt + dur + 0.02);
    tt += dur;
  }
  return tt - t;
};

/** I fiori che cantano: un coro di "aaah" a tre voci. */
Audio.coro = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.3, 1.0);
  const t = this._ora();
  const accordi = [[523, 659, 784], [587, 698, 880], [523, 659, 784]];
  accordi.forEach((accordo, k) => accordo.forEach((f) => {
    const t0 = t + k * 0.9;
    const o = this._osc('triangle', f);
    const vib = this._osc('sine', 5); const vg = this.ctx.createGain(); vg.gain.value = f * 0.006;
    vib.connect(vg); vg.connect(o.frequency);
    const e = this._inv(t0, 0.05, 0.15, 0.95);
    o.connect(e); e.connect(out); o.start(t0); vib.start(t0); o.stop(t0 + 1.1); vib.stop(t0 + 1.1);
  }));
};

/** Un'auto (o un'auto-pesce) che passa in una pozzanghera: SPLASH! */
Audio.splash = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.7, 0.5);
  const t = this._ora();
  const r = this._noise();
  const f = this._filtro('bandpass', 1400, 0.6);
  f.frequency.exponentialRampToValueAtTime(600, t + 0.5);
  const e = this._inv(t, 0.4, 0.02, 0.55);
  r.connect(f); f.connect(e); e.connect(out); r.start(t, Math.random()); r.stop(t + 0.6);
  // e qualche "blub" di bolla, perché è un'auto-pesce
  for (let k = 0; k < 3; k++) {
    const t0 = t + 0.15 + k * 0.09;
    const o = this._osc('sine', 300 + Math.random() * 200);
    o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 400, t0 + 0.07);
    const e2 = this._inv(t0, 0.1, 0.004, 0.08);
    o.connect(e2); e2.connect(out); o.start(t0); o.stop(t0 + 0.1);
  }
};

/** Il lampione che sbadiglia e si accende. */
Audio.sbadiglio = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.4, 0.6);
  const t = this._ora();
  const o = this._osc('triangle', 220);
  o.frequency.linearRampToValueAtTime(330, t + 0.5);
  o.frequency.linearRampToValueAtTime(160, t + 1.2);
  const e = this._inv(t, 0.12, 0.2, 1.2);
  o.connect(e); e.connect(out); o.start(t); o.stop(t + 1.3);
  this.magia(0.3);
};

/** La grande trasformazione in streghetta. */
Audio.trasformazione = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.6, 1.0);
  const t = this._ora();
  const scala = [523.25, 587.3, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568, 1760, 2093];
  scala.forEach((fr, k) => {
    const o = this._osc(k % 2 ? 'triangle' : 'sine', fr);
    const e = this._inv(t + k * 0.07, 0.16, 0.005, 0.9);
    o.connect(e); e.connect(out); o.start(t + k * 0.07); o.stop(t + k * 0.07 + 1);
  });
  const r = this._noise(); const f = this._filtro('highpass', 4000, 0.5);
  f.frequency.linearRampToValueAtTime(9000, t + 1.4);
  const e = this._inv(t, 0.12, 0.6, 1.6);
  r.connect(f); f.connect(e); e.connect(out); r.start(t); r.stop(t + 1.7);
};

/** Raccolta di un ricordo. */
Audio.ricordo = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.5, 0.7);
  const t = this._ora();
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((fr, k) => {
    const o = this._osc('triangle', fr);
    const e = this._inv(t + k * 0.09, 0.2, 0.006, 0.7);
    o.connect(e); e.connect(out); o.start(t + k * 0.09); o.stop(t + k * 0.09 + 0.75);
  });
};

/** Lo scippo: un "fruuush" rapido. */
Audio.scippo = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.8);
  const t = this._ora();
  const r = this._noise(); const f = this._filtro('bandpass', 800, 0.8);
  f.frequency.exponentialRampToValueAtTime(3500, t + 0.25);
  const e = this._inv(t, 0.6, 0.02, 0.3);
  r.connect(f); f.connect(e); e.connect(out); r.start(t); r.stop(t + 0.35);
};

/** Lia sbatte contro qualcosa: "bonk". */
Audio.botta = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.8, 0.3);
  const t = this._ora();
  const o = this._osc('sine', 220); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  const e = this._inv(t, 0.7, 0.003, 0.3);
  o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.35);
  const o2 = this._osc('triangle', 520); o2.frequency.exponentialRampToValueAtTime(360, t + 0.4);
  const e2 = this._inv(t + 0.05, 0.12, 0.01, 0.45);
  o2.connect(e2); e2.connect(out); o2.start(t + 0.05); o2.stop(t + 0.5);
};

/** Cinguettio. */
Audio.uccellino = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.35, 0.3);
  const t = this._ora();
  const base = 2600 + Math.random() * 1400;
  for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) {
    const t0 = t + k * 0.12;
    const o = this._osc('sine', base);
    o.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.06);
    const e = this._inv(t0, 0.14, 0.005, 0.08);
    o.connect(e); e.connect(out); o.start(t0); o.stop(t0 + 0.1);
  }
};

/** Tubare dei piccioni. */
Audio.piccione = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.4);
  const t = this._ora();
  const o = this._osc('sine', 380);
  const tr = this._osc('sine', 18); const pt = this.ctx.createGain(); pt.gain.value = 40;
  tr.connect(pt); pt.connect(o.frequency);
  o.frequency.linearRampToValueAtTime(330, t + 0.6);
  const e = this._inv(t, 0.2, 0.08, 0.7);
  o.connect(e); e.connect(out); o.start(t); tr.start(t); o.stop(t + 0.75); tr.stop(t + 0.75);
};

/** Battito d'ali (piccioni che volano via). */
Audio.ali = function (x, y) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.5);
  const t = this._ora();
  for (let k = 0; k < 6; k++) {
    const r = this._noise(); const f = this._filtro('bandpass', 700, 0.8);
    const e = this._inv(t + k * 0.08, 0.25, 0.01, 0.07);
    r.connect(f); f.connect(e); e.connect(out); r.start(t + k * 0.08, Math.random()); r.stop(t + k * 0.08 + 0.09);
  }
};

/** Piccolo "clic" dei pulsanti. */
Audio.clic = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.3);
  const t = this._ora();
  const o = this._osc('sine', 880);
  const e = this._inv(t, 0.2, 0.002, 0.06);
  o.connect(e); e.connect(out); o.start(t); o.stop(t + 0.08);
};

/* ------------------------------------------------------------------------ */
/*  Suoni continui con una posizione (acqua, motori, forno, vento...)       */
/* ------------------------------------------------------------------------ */

/**
 * tipo: 'acqua' | 'motore' | 'fuoco' | 'vento' | 'citta'
 * Restituisce un oggetto { x, y, volume, ferma() } che si può spostare.
 */
Audio.continuo = function (tipo, x, y, volume) {
  if (!this.ctx) return { x, y, volume, ferma() {} };
  const ctx = this.ctx;
  const sorgente = this._noise();
  sorgente.loop = true;
  let filtro, extra = [];
  const g = ctx.createGain(); g.gain.value = 0;
  if (tipo === 'acqua') {
    filtro = this._filtro('bandpass', 900, 0.6);
    const lfo = this._osc('sine', 0.3); const p = ctx.createGain(); p.gain.value = 300;
    lfo.connect(p); p.connect(filtro.frequency); lfo.start(); extra.push(lfo);
  } else if (tipo === 'motore') {
    filtro = this._filtro('lowpass', 220, 4);
    const o = this._osc('sawtooth', 48); const go = ctx.createGain(); go.gain.value = 0.35;
    const fo = this._filtro('lowpass', 300, 1);
    o.connect(fo); fo.connect(go); go.connect(g); o.start(); extra.push(o);
  } else if (tipo === 'fuoco') {
    filtro = this._filtro('highpass', 2000, 0.5);
    // scoppiettii: piccoli impulsi casuali
    const scoppi = () => {
      if (!h.attivo) return;
      const t = ctx.currentTime;
      const r = this._noise(); const f = this._filtro('bandpass', 1500 + Math.random() * 2500, 2);
      const e = this._inv(t, 0.4 * Math.random(), 0.001, 0.03);
      r.connect(f); f.connect(e); e.connect(g); r.start(t, Math.random()); r.stop(t + 0.05);
      setTimeout(scoppi, 60 + Math.random() * 260);
    };
    setTimeout(scoppi, 100);
  } else if (tipo === 'pioggia') {
    // fruscio largo + tante piccole gocce che picchiettano
    filtro = this._filtro('bandpass', 3200, 0.35);
    const gocce = () => {
      if (!h.attivo) return;
      const t = ctx.currentTime;
      const o = this._osc('sine', 1800 + Math.random() * 2600);
      o.frequency.exponentialRampToValueAtTime(700 + Math.random() * 500, t + 0.03);
      const e = this._inv(t, 0.05 + Math.random() * 0.12, 0.001, 0.035);
      o.connect(e); e.connect(g); o.start(t); o.stop(t + 0.05);
      setTimeout(gocce, 25 + Math.random() * 90);
    };
    setTimeout(gocce, 80);
  } else if (tipo === 'vento') {
    filtro = this._filtro('lowpass', 500, 0.8);
    const lfo = this._osc('sine', 0.15); const p = ctx.createGain(); p.gain.value = 350;
    lfo.connect(p); p.connect(filtro.frequency); lfo.start(); extra.push(lfo);
  } else {
    filtro = this._filtro('lowpass', 380, 0.5);
  }
  sorgente.connect(filtro); filtro.connect(g);
  let pan = null;
  let ultimo = g;
  if (ctx.createStereoPanner) { pan = ctx.createStereoPanner(); g.connect(pan); ultimo = pan; }
  const ovatta = this._filtro('lowpass', 20000, 0.7);
  ultimo.connect(ovatta);
  ovatta.connect(this.busEffetti);
  sorgente.start(0, Math.random());
  const h = {
    x, y, volume: volume || 0.3, attivo: true, posizionato: x !== undefined,
    ferma: () => {
      h.attivo = false;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => { try { sorgente.stop(); extra.forEach((n) => n.stop()); } catch (e) { /* già fermo */ } }, 800);
      this.continui = this.continui.filter((c) => c !== h);
    },
    _g: g, _pan: pan, _ovatta: ovatta,
  };
  this.continui.push(h);
  return h;
};

/** Ferma tutti i suoni continui (cambio di luogo). */
Audio.fermaContinui = function () {
  for (const c of [...this.continui]) c.ferma();
};

/** Aggiorna posizione dell'ascoltatore e volumi dei suoni continui. */
Audio.aggiorna = function (x, y, angolo) {
  if (!this.ctx) return;
  const L = this.ascoltatore;
  L.x = x; L.y = y; L.angolo = angolo;
  const t = this.ctx.currentTime;
  for (const c of this.continui) {
    let vol = c.volume, pan = 0, ovattato = false;
    if (c.posizionato) {
      const dx = c.x - x, dy = c.y - y, d = Math.hypot(dx, dy);
      vol = c.volume / (1 + 0.05 * d * d);
      pan = d < 0.4 ? 0 : Math.sin(differenza(angolo, Math.atan2(dy, dx))) * 0.8;
      ovattato = this.mondo ? !this.mondo.lineaDiVista(x, y, c.x, c.y, 2.0) : false;
    }
    c._g.gain.setTargetAtTime(vol, t, 0.15);
    if (c._pan) c._pan.pan.setTargetAtTime(pan, t, 0.15);
    c._ovatta.frequency.setTargetAtTime(ovattato ? 600 : 18000, t, 0.2);
  }
};
