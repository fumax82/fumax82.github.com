/* ==========================================================================
 *  audio.js — SUONI E STRUMENTI (tutto generato dal codice, nessun file audio)
 *  --------------------------------------------------------------------------
 *  Lia "vede" con le orecchie: ogni suono ha una posizione nel mondo.
 *  Se Gogo abbaia a destra lo senti a destra, se è lontano lo senti
 *  piano e più "immerso" nell'eco, se è dietro di te è un po' più ovattato.
 *  Meglio con le cuffie!
 *
 *  Come funziona, in breve:
 *   1. IL LABORATORIO (un Web Worker, cioè un aiutante che lavora in
 *      un'altra stanza senza rallentare il gioco) calcola una volta sola,
 *      all'avvio, i "campioni": una nota di pianoforte, di arpa, di
 *      carillon..., il colpo del bastone su ogni materiale, l'abbaio di
 *      Gogo, il fruscio della pioggia... Sono numeri messi in fila
 *      (onde sonore) che poi diventano AudioBuffer pronti da suonare.
 *   2. IL MIXER: tutti i suoni passano per pochi "bus" (canali) con il
 *      volume, un riverbero (l'eco di una stanza grande) e un limitatore
 *      che impedisce al suono di "graffiare".
 *   3. GLI STRUMENTI: suonare una nota = far partire il campione più
 *      vicino un po' più veloce o più lento (più acuto o più grave).
 *   4. GLI EFFETTI e GLI AMBIENTI (pioggia, vento, acqua...).
 *
 *  Schema del mixer:
 *     effetti ─→ bus effetti ─┐
 *     musica  ─→ bus musica ──┼→ compressore → limitatore → generale → altoparlanti
 *     (un po' di tutto) → riverbero ┘
 * ========================================================================== */
import { CONFIG } from '../config.js';

/* ==========================================================================
 *  1. IL LABORATORIO DEI SUONI
 *  --------------------------------------------------------------------------
 *  Questa funzione viene copiata così com'è dentro il Web Worker: per questo
 *  non usa niente che stia fuori da lei. Riceve un nome (per esempio
 *  'str:piano:60' = la nota 60 del pianoforte) e restituisce i campioni.
 * ========================================================================== */
function laboratorio(invia) {
  'use strict';
  const PI2 = Math.PI * 2;

  /* --- numeri "a caso" ma ripetibili (sempre gli stessi a ogni avvio) --- */
  let seme = 20100101;
  const casuale = () => {
    seme = (seme + 0x6D2B79F5) | 0;
    let t = Math.imul(seme ^ (seme >>> 15), 1 | seme);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tra = (a, b) => a + (b - a) * casuale();
  const bianco = () => casuale() * 2 - 1;
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const campana = (f, centro, ottave) => { const x = Math.log2(f / centro) / ottave; return Math.exp(-x * x); };

  /* --- piccoli attrezzi sui campioni --- */
  const nuovo = (sec, sr) => new Float32Array(Math.max(1, Math.floor(sec * sr)));
  function attacco(x, ms, sr) {        // apertura morbida (niente "clic")
    const n = Math.min(x.length, Math.max(1, Math.floor(ms * sr / 1000)));
    for (let i = 0; i < n; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / n);
  }
  function coda(x, sec, sr) {          // chiusura morbida
    const L = x.length, n = Math.min(L, Math.floor(sec * sr));
    for (let i = 0; i < n; i++) x[L - n + i] *= 0.5 + 0.5 * Math.cos(Math.PI * i / n);
  }
  function picco(x) { let m = 0; for (let i = 0; i < x.length; i++) { const a = x[i] < 0 ? -x[i] : x[i]; if (a > m) m = a; } return m; }
  function normPicco(canali, p) {
    let m = 0; for (const c of canali) m = Math.max(m, picco(c));
    if (m > 0) for (const c of canali) for (let i = 0; i < c.length; i++) c[i] *= p / m;
    return canali;
  }
  function normRms(canali, r) {
    let s = 0, n = 0; for (const c of canali) { for (let i = 0; i < c.length; i++) s += c[i] * c[i]; n += c.length; }
    const k = s > 0 ? r / Math.sqrt(s / n) : 1;
    for (const c of canali) for (let i = 0; i < c.length; i++) c[i] *= k;
    return canali;
  }
  function togliMedia(x) { let m = 0; for (let i = 0; i < x.length; i++) m += x[i]; m /= x.length; for (let i = 0; i < x.length; i++) x[i] -= m; }
  function aggiungi(dest, src, da, k) {   // mescola src dentro dest dalla posizione da (in campioni)
    for (let i = 0; i < src.length && da + i < dest.length; i++) if (da + i >= 0) dest[da + i] += src[i] * k;
  }
  function aggiungiCiclico(dest, src, da, k) {   // come sopra ma "fa il giro" (per i suoni in loop)
    const L = dest.length;
    for (let i = 0; i < src.length; i++) dest[(da + i) % L] += src[i] * k;
  }

  /* --- filtri biquad (le ricette classiche di R. Bristow-Johnson) --- */
  function biquad(tipo, f, q, sr, db) {
    const w = PI2 * Math.min(f, sr * 0.49) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
    const A = Math.pow(10, (db || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    if (tipo === 'passabasso') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (tipo === 'passaalto') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (tipo === 'passabanda') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; } // 'picco'
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filtra(x, c, giri) {   // giri = 2 per i suoni in loop: il filtro "si scalda" sul primo giro
    const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let g = (giri || 1) - 1; g >= 0; g--) {
      for (let i = 0; i < x.length; i++) {
        const x0 = x[i];
        const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x0; y2 = y1; y1 = y0;
        if (g === 0) x[i] = y0;
      }
    }
    return x;
  }

  /*
   * Filtro "a variabile di stato": si può muovere mentre suona senza
   * scoppiettare. Serve per le vocali (formanti) di cani, gatti e balene.
   */
  function svf() {
    return { ic1: 0, ic2: 0, a1: 0, a2: 0, a3: 0, k: 1, conta: 0 };
  }
  function svfBanda(s, x, fc, q, sr) {
    if ((s.conta++ & 15) === 0) {
      const g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr);
      s.k = 1 / q; s.a1 = 1 / (1 + g * (g + s.k)); s.a2 = g * s.a1; s.a3 = g * s.a2;
    }
    const v3 = x - s.ic2, v1 = s.a1 * s.ic1 + s.a2 * v3, v2 = s.ic2 + s.a2 * s.ic1 + s.a3 * v3;
    s.ic1 = 2 * v1 - s.ic1; s.ic2 = 2 * v2 - s.ic2;
    s.basso = v2;
    return v1 * s.k;          // banda passante con guadagno 1 al centro
  }

  /** Una curva fatta di punti [tempo, valore] (spezzata). */
  function curva(punti) {
    let j = 0;
    return (t) => {
      if (t <= punti[0][0]) return punti[0][1];
      while (j < punti.length - 2 && t > punti[j + 1][0]) j++;
      while (j > 0 && t < punti[j][0]) j--;
      const [t0, v0] = punti[j], [t1, v1] = punti[Math.min(j + 1, punti.length - 1)];
      if (t >= t1) return v1;
      return v0 + (v1 - v0) * (t - t0) / (t1 - t0);
    };
  }

  /*
   * Un "parziale": una sinusoide che si spegne piano piano (e^-t/tau).
   * Invece di calcolare sin() a ogni campione facciamo ruotare un
   * "fasore" (una lancetta): bastano 4 moltiplicazioni. Velocissimo.
   */
  function parziale(out, f, a, tau, sr, da) {
    const w = PI2 * f / sr, dec = Math.exp(-1 / (tau * sr));
    const cr = Math.cos(w) * dec, ci = Math.sin(w) * dec;
    let re = a, im = 0;
    const soglia = Math.abs(a) * 3e-5;
    for (let i = da || 0; i < out.length; i++) {
      out[i] += im;
      const t = re * cr - im * ci; im = re * ci + im * cr; re = t;
      if ((i & 511) === 0 && (re < 0 ? -re : re) + (im < 0 ? -im : im) < soglia) break;
    }
  }

  /* --- FFT (per costruire suoni "a spettro": archi, cori, rumori in loop) --- */
  function fft(re, im, inversa) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inversa ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), meta = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < meta; k++) {
          const a = i + k, b = a + meta;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  /*
   * PADsynth (idea di Paul Nasca): disegniamo lo SPETTRO del suono (ogni
   * armonica è una piccola "collina" larga qualche cent, come tanti
   * violini leggermente diversi che suonano insieme), diamo fasi a caso e
   * con la FFT inversa otteniamo un'onda che si ripete perfettamente:
   * un loop senza cuciture, caldo e "vivo". N = lunghezza (potenza di 2).
   */
  function spettroInOnda(ampiezze, N, canali) {
    const uscite = [];
    for (let c = 0; c < canali; c++) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 1; i < N / 2; i++) {
        const a = ampiezze[i];
        if (a > 0) { const f = casuale() * PI2; re[i] = a * Math.cos(f); im[i] = a * Math.sin(f); }
      }
      fft(re, im, true);
      const o = new Float32Array(N);
      for (let i = 0; i < N; i++) o[i] = re[i];
      uscite.push(o);
    }
    return uscite;
  }
  /** componenti: [frequenza, ampiezza, larghezza in Hz] */
  function padsynth(sr, N, componenti, canali) {
    const amp = new Float64Array(N / 2);
    for (const [f, a, bw] of componenti) {
      if (f >= sr * 0.46 || a <= 0) continue;
      if (!bw) { amp[Math.round(f * N / sr)] += a; continue; }
      const c = f * N / sr, w = Math.max(0.6, bw * N / sr * 0.5);
      const da = Math.max(1, Math.floor(c - 3 * w)), a2 = Math.min(N / 2 - 1, Math.ceil(c + 3 * w));
      const k = a / Math.sqrt(w);
      for (let i = da; i <= a2; i++) { const x = (i - c) / w; amp[i] += k * Math.exp(-x * x); }
    }
    return spettroInOnda(amp, N, canali);
  }
  /** Rumore in loop con lo spettro voluto: forma(f) = ampiezza alla frequenza f. */
  function rumoreColorato(sr, N, forma, canali) {
    const amp = new Float64Array(N / 2);
    for (let i = 1; i < N / 2; i++) amp[i] = forma(i * sr / N);
    return spettroInOnda(amp, N, canali);
  }
  /** Le armoniche di una nota per PADsynth. forma(n, fn) = ampiezza dell'armonica n. */
  function armoniche(f0, sr, fmax, cent, forma, scala) {
    const comp = [];
    for (let n = 1; n * f0 < Math.min(fmax, sr * 0.45); n++) {
      const fn = n * f0;
      comp.push([fn, forma(n, fn), (Math.pow(2, cent / 1200) - 1) * f0 * Math.pow(n, scala || 1)]);
    }
    return comp;
  }

  /*
   * Corda pizzicata (algoritmo di Karplus-Strong): una "fila" di numeri
   * lunga quanto un periodo della nota gira in tondo; a ogni giro viene
   * un po' smussata e un po' attenuata, proprio come una corda vera che
   * vibra e perde energia. Il risultato: arpa, pizzicato, contrabbasso.
   */
  function corda(f, sr, dur, o) {
    const n = Math.floor(dur * sr), out = new Float32Array(n);
    const S = o.S;                          // quanto smussa a ogni giro (0..0.5)
    const P = sr / f;
    let D = Math.floor(P - S - 0.1); if (D < 2) D = 2;
    const delta = P - S - D, C = (1 - delta) / (1 + delta);   // passa-tutto per accordare finemente
    // il filtro del giro smorza anche la fondamentale: lo compensiamo, così la nota dura davvero t60
    const w0 = 2 * Math.PI * f / sr, perdita = Math.sqrt((1 - S) * (1 - S) + S * S + 2 * S * (1 - S) * Math.cos(w0));
    const rho = Math.min(0.99999, Math.pow(10, -3 / (f * o.t60)) / perdita);
    const buf = new Float64Array(D);
    const pos = o.posizione;
    for (let k = 0; k < D; k++) {
      const x = k / D, tri = x < pos ? x / pos : (1 - x) / (1 - pos);
      buf[k] = tri * (1 - o.rumore) + bianco() * o.rumore;
    }
    for (let p = 0; p < 2; p++) {           // il dito è morbido: smussiamo l'eccitazione
      let y = buf[D - 1];
      for (let k = 0; k < D; k++) { y += (1 - o.morbido) * (buf[k] - y); buf[k] = y; }
    }
    let m = 0; for (let k = 0; k < D; k++) m += buf[k]; m /= D; for (let k = 0; k < D; k++) buf[k] -= m;
    let idx = 0, prec = 0, apx = 0, apy = 0;
    for (let i = 0; i < n; i++) {
      const x = buf[idx];
      const lp = (1 - S) * x + S * prec; prec = x;
      const ap = C * lp + apx - C * apy; apx = lp; apy = ap;
      buf[idx] = ap * rho;
      out[i] = x;
      if (++idx >= D) idx = 0;
    }
    return out;
  }

  /** Un piccolo soffio di rumore filtrato (per colpi, fruscii, gocce...). */
  function soffio(sr, dur, tau, tipo, f, q, att) {
    const x = nuovo(dur, sr), na = Math.max(1, Math.floor((att || 0.0005) * sr));
    for (let i = 0; i < x.length; i++) x[i] = bianco() * Math.exp(-i / (tau * sr)) * (i < na ? i / na : 1);
    if (tipo) filtra(x, biquad(tipo, f, q || 0.8, sr));
    return x;
  }

  /*
   * SINTESI MODALE: un oggetto colpito vibra in pochi "modi" (note
   * proprie), ciascuno con la sua altezza e il suo tempo di spegnimento.
   * Legno: pochi modi gravi e smorzati. Vetro: modi acuti e lunghi.
   * Metallo: tanti modi "stonati" fra loro che risuonano a lungo.
   * Il colpo (un clic morbido) e un po' di rumore passano dentro questi
   * risuonatori (filtri passa-banda accordati sui modi).
   * modi: [frequenza, tau (s), ampiezza]
   */
  function modale(sr, dur, modi, o) {
    const out = nuovo(dur, sr);
    const largo = (o.colpo || 0.3) / 1000;               // durata del colpo: più lungo = più morbido
    const varia = o.varia === undefined ? 0.02 : o.varia;
    for (const [f0, tau, a] of modi) {
      const f = f0 * (1 + bianco() * varia);
      if (f > sr * 0.45) continue;
      const morb = 1 / (1 + Math.pow(f * largo * 1.6, 2));
      parziale(out, f, a * morb * (1 + bianco() * 0.15), tau * (1 + bianco() * 0.1), sr, 0);
    }
    attacco(out, Math.max(0.15, largo * 1000 * 0.7), sr);
    const p = picco(out) || 1;
    if (o.rumore) {   // il "grano" del contatto, passato dentro i risuonatori più importanti
      const [a, tau] = o.rumore;
      const ecc = soffio(sr, Math.min(dur, tau * 8), tau, 'passaalto', 400, 0.7, largo);
      const somma = new Float32Array(ecc.length);
      for (const [f, t2, am] of modi.slice(0, 4)) {
        if (f > sr * 0.45) continue;
        const r = Float32Array.from(ecc);
        filtra(r, biquad('passabanda', f, Math.min(30, Math.max(1.2, Math.PI * f * Math.min(t2, 0.02))), sr));
        aggiungi(somma, r, 0, am);
      }
      aggiungi(somma, ecc, 0, 0.35);
      const ps = picco(somma) || 1;
      aggiungi(out, somma, 0, a * p / ps);
    }
    coda(out, Math.min(0.08, dur * 0.3), sr);
    return out;
  }

  /*
   * VOCE: una sorgente con le sue armoniche (come le corde vocali) che
   * passa per tre o quattro "formanti" (le risonanze della bocca: sono
   * loro che fanno la differenza fra "u", "a", "i"). Muovendo altezza e
   * formanti nel tempo nascono "wuf", "miao" e il canto della balena.
   */
  function voce(sr, dur, o) {
    const n = Math.floor(dur * sr), out = new Float32Array(n);
    const f0 = curva(o.f0), amp = curva(o.amp);
    const F = o.formanti.map((fm) => ({ f: curva(fm.f), q: fm.q, g: fm.g, s: svf() }));
    const fmax = o.fmax || 5000, pend = o.pendenza || 1;
    const pesi = new Float64Array(80);
    for (let k = 1; k < 80; k++) pesi[k] = Math.pow(k, -pend);
    let fase = 0, faseSub = 0, jit = 0, jitV = 0, faseAm = 0;
    const vib = o.vibrato || [0, 0];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if ((i & 63) === 0) { jitV += (bianco() - jitV) * 0.25; jit += (jitV - jit) * 0.3; }
      const f = f0(t) * (1 + jit * (o.jitter || 0)) * (1 + vib[1] * Math.sin(PI2 * vib[0] * t));
      fase += PI2 * f / sr; if (fase > PI2) fase -= PI2;
      faseSub += Math.PI * f / sr; if (faseSub > PI2) faseSub -= PI2;
      const K = Math.min(79, Math.floor(fmax / f));
      const c2 = 2 * Math.cos(fase);
      let sp = 0, sc = Math.sin(fase), s = 0;
      for (let k = 1; k <= K; k++) { s += sc * pesi[k]; const nx = c2 * sc - sp; sp = sc; sc = nx; }
      let src = s * 0.35;
      if (o.sub) src += Math.sin(faseSub) * o.sub * 0.5;
      if (o.ruvido) {   // voce "ruvida": un tremolo irregolare (il ringhio)
        faseAm += PI2 * o.ruvido[0] * (1 + jit * 0.6) / sr;
        src *= 1 - o.ruvido[1] * (0.5 + 0.5 * Math.sin(faseAm));
      }
      src += bianco() * (o.rumore || 0);
      let y = 0;
      for (const fm of F) y += fm.g * svfBanda(fm.s, src, fm.f(t), fm.q, sr);
      out[i] = y * amp(t);
    }
    return out;
  }

  /* ========================================================================
   *  GLI STRUMENTI (una nota alla volta: 'str:nome:midi')
   *  Ogni funzione restituisce { canali: [Float32Array...], sr, loop }
   * ====================================================================== */
  const STR = {};

  /*
   * PIANOFORTE: somma di parziali (sintesi additiva). Come in un piano vero:
   *  - le parziali alte sono un po' "crescenti" (inarmonicità delle corde)
   *  - ogni nota ha due corde quasi uguali che battono piano fra loro
   *  - le parziali acute si spengono prima (il suono diventa più tondo)
   *  - c'è un primo calo veloce e poi una coda lunga
   *  - all'inizio il colpetto di feltro del martelletto
   */
  STR.piano = (midi) => {
    const sr = 24000, f0 = hz(midi);
    const tau0 = 6 * Math.pow(65 / f0, 0.55);
    const dur = Math.min(4.2, Math.max(1.3, tau0 + 0.4));
    const out = nuovo(dur, sr);
    const B = 1e-4 * Math.pow(2, (midi - 36) / 14);
    const beta = 1 / 8.3;                                      // dove il martelletto colpisce la corda
    for (let n = 1; n <= 44; n++) {
      const fn = n * f0 * Math.sqrt(1 + B * n * n);
      if (fn > Math.min(sr * 0.45, 9500)) break;
      let a = Math.abs(Math.sin(Math.PI * n * beta)) * Math.pow(n, -0.85) / (1 + Math.pow(fn / 3000, 2));
      if (n === 1 && midi < 50) a *= 0.55 + (midi - 36) * 0.03;
      const tn = tau0 / (1 + 0.8 * Math.pow(fn / 1000, 1.1));
      parziale(out, fn, a * 0.62, tn * 0.3, sr);                        // "suono pronto"
      parziale(out, fn * (1 + tra(0.25, 0.7) * 0.001), a * 0.38, tn, sr);  // "suono che resta"
    }
    const p = picco(out);
    const colpo = soffio(sr, 0.02, 0.003, 'passabanda', Math.min(f0 * 2.5, 2500), 0.7, 0.0008);
    aggiungi(out, colpo, 0, p * 0.25 / (picco(colpo) || 1));
    if (midi < 60) parziale(out, 95, p * 0.06, 0.03, sr);                // il "tonfo" della tavola armonica
    attacco(out, 1.5, sr); coda(out, Math.min(0.45, dur * 0.25), sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /* CELESTA: lamine colpite da martelletti di feltro: quasi una sinusoide, dolcissima. */
  STR.celesta = (midi) => {
    const sr = 24000, f0 = hz(midi), tau = 1.6 * Math.pow(523 / f0, 0.45);
    const dur = Math.min(2.6, tau * 1.5 + 0.3), out = nuovo(dur, sr);
    for (const [r, a, k] of [[1, 1, 1], [1.0015, 0.25, 0.9], [2.0, 0.07, 0.35], [3.93, 0.22, 0.12], [6.9, 0.08, 0.05], [10.6, 0.035, 0.03]]) {
      if (f0 * r < sr * 0.45) parziale(out, f0 * r, a, tau * k, sr);
    }
    const p = picco(out), c = soffio(sr, 0.01, 0.0015, 'passabanda', 4500, 1, 0.0003);
    aggiungi(out, c, 0, p * 0.05 / (picco(c) || 1));
    attacco(out, 0.8, sr); coda(out, 0.25, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /*
   * CARILLON: i denti d'acciaio di un pettine pizzicati da un rullo.
   * Un dente vibra come una piccola trave: le sue note proprie stanno a
   * 1 : 6,27 : 17,55 — è quel 6,27 che dà lo scintillio metallico.
   */
  STR.carillon = (midi) => {
    const sr = 32000, f0 = hz(midi), tau = 2.4 * Math.pow(523 / f0, 0.5);
    const dur = Math.min(3, tau * 1.4 + 0.3), out = nuovo(dur, sr);
    for (const [r, a, k] of [[1, 1, 1], [1.0008, 0.18, 1.1], [2.0, 0.05, 0.4], [6.267, 0.4, 0.2], [17.55, 0.12, 0.06]]) {
      if (f0 * r < sr * 0.45) parziale(out, f0 * r, a, tau * k, sr);
    }
    const p = picco(out), c = soffio(sr, 0.006, 0.0006, 'passaalto', 5000, 0.8, 0.0001);
    aggiungi(out, c, 0, p * 0.12 / (picco(c) || 1));
    attacco(out, 0.3, sr); coda(out, 0.3, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /*
   * CAMPANELLA (sintesi FM): un'onda che "dondola" la frequenza di un'altra.
   * Con il rapporto 1 : 3,5 nascono parziali non armoniche: suono di
   * campanellino magico. L'indice (la profondità) cala nel tempo: il suono
   * parte brillante e diventa puro.
   */
  STR.campanella = (midi) => {
    const sr = 32000, f0 = hz(midi), dur = 2.4, n = Math.floor(dur * sr), out = new Float32Array(n);
    const tauA = 1.8 * Math.pow(880 / f0, 0.4);
    const kmax = (sr * 0.42 - f0) / (3.5 * f0);
    const coppie = [[1, 3.5, Math.min(2.2, Math.max(0.3, kmax - 1)), 0.7], [1.0021, 3.507, Math.min(1.4, Math.max(0.2, kmax - 1.3)), 0.3]];
    for (const [rc, rm, I0, g] of coppie) {
      const wc = PI2 * f0 * rc / sr, wm = PI2 * f0 * rm / sr;
      const decA = Math.exp(-1 / (tauA * sr)), decI = Math.exp(-1 / (tauA * 0.22 * sr));
      let a = g, I = I0;
      for (let i = 0; i < n; i++) {
        out[i] += a * Math.sin(wc * i + I * Math.sin(wm * i));
        a *= decA; I *= decI;
      }
    }
    attacco(out, 0.5, sr); coda(out, 0.4, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /* ARPA: corda pizzicata col dito (morbida) + un po' di "cassa" calda. */
  STR.arpa = (midi) => {
    const sr = 32000, f = hz(midi);
    const t60 = Math.min(9, Math.max(1.2, 9 * Math.pow(100 / f, 0.6)));
    const dur = Math.min(3.0, Math.max(1.8, t60 * 0.6));
    const S = f < 200 ? 0.5 : Math.max(0.12, 0.5 - (Math.log2(f / 200)) * 0.13);
    const out = corda(f, sr, dur, { S, t60, posizione: 0.32, rumore: 0.2, morbido: 0.62 });
    filtra(out, biquad('picco', 190, 1.0, sr, 3));
    filtra(out, biquad('passabasso', 6500, 0.7, sr));
    const p = picco(out), c = soffio(sr, 0.01, 0.0015, 'passabasso', 2500, 0.7, 0.0004);
    aggiungi(out, c, 0, p * 0.06 / (picco(c) || 1));
    attacco(out, 0.6, sr); coda(out, 0.35, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /* PIZZICATO degli archi: corda breve + la cassa di legno del violino. */
  STR.pizzicato = (midi) => {
    const sr = 22050, f = hz(midi);
    const out = corda(f, sr, 0.9, { S: 0.45, t60: Math.max(0.5, 1.4 * Math.pow(200 / f, 0.3)), posizione: 0.2, rumore: 0.35, morbido: 0.45 });
    filtra(out, biquad('picco', 290, 1.5, sr, 6)); filtra(out, biquad('picco', 520, 2, sr, 3));
    filtra(out, biquad('picco', 1150, 2, sr, 2)); filtra(out, biquad('passabasso', 3500, 0.7, sr));
    attacco(out, 0.8, sr); coda(out, 0.2, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /* CONTRABBASSO pizzicato: profondo, rotondo, col pollice. */
  STR.contrabbasso = (midi) => {
    const sr = 22050, f = hz(midi);
    const out = corda(f, sr, 2.2, { S: 0.5, t60: 2.6, posizione: 0.18, rumore: 0.2, morbido: 0.7 });
    filtra(out, biquad('picco', 100, 1, sr, 3)); filtra(out, biquad('passabasso', 1300, 0.7, sr));
    attacco(out, 1.5, sr); coda(out, 0.3, sr);
    return { canali: normPicco([out], 0.8), sr };
  };

  /* --- Strumenti che "tengono" la nota: loop perfetti fatti con PADsynth --- */
  const sostenuto = (canali, sr) => ({ canali: normRms(canali, 0.22), sr: sr || 22050, loop: true });

  /* ARCHI: una sezione d'archi morbida (tanti violini un po' diversi = colline larghe). */
  STR.archi = (midi) => {
    const sr = 22050, f0 = hz(midi);
    return sostenuto(padsynth(sr, 65536, armoniche(f0, sr, 8000, 22, (n, fn) =>
      Math.pow(n, -0.9) / (1 + Math.pow(fn / 3000, 2.5)) * (0.6 + 1.2 * campana(fn, 480, 0.7) + 0.8 * campana(fn, 2600, 0.5)), 1.1), 2));
  };
  /* VIOLONCELLI e contrabbassi con l'arco: più scuri. */
  STR.violoncelli = (midi) => {
    const sr = 16000, f0 = hz(midi);
    return sostenuto(padsynth(sr, 32768, armoniche(f0, sr, 5000, 16, (n, fn) =>
      Math.pow(n, -0.85) / (1 + Math.pow(fn / 1800, 2.5)) * (0.6 + 1.0 * campana(fn, 250, 0.8) + 0.5 * campana(fn, 1200, 0.5))), 1), sr);
  };
  /* CORO: "aaah" di voci chiare (le formanti della vocale A). */
  STR.coro = (midi) => {
    const sr = 16000, f0 = hz(midi);
    const forma = (n, fn) => Math.pow(n, -0.6) * (0.03 + campana(fn, 850, 0.25) + 0.6 * campana(fn, 1250, 0.2) + 0.25 * campana(fn, 2850, 0.15) + 0.08 * campana(fn, 3600, 0.12));
    return sostenuto(padsynth(sr, 32768, armoniche(f0, sr, 6000, 38, forma, 1), 2), sr);
  };
  /*
   * Gli strumenti SOLISTI (flauto, clarinetto, violino): ogni armonica sta
   * esattamente su una "riga" dello spettro, così il suono è fermo e pulito
   * (il vibrato lo aggiunge chi suona). Il fiato e l'arco invece sono rumore.
   * La fondamentale viene "agganciata" alla riga più vicina: restituiamo
   * l'altezza vera (midiReale) e chi suona corregge.
   */
  function solista(midi, sr, N, forma, fmax, rumori) {
    const riga = Math.max(1, Math.round(hz(midi) * N / sr)), f0 = riga * sr / N;
    const comp = [];
    for (let n = 1; n * f0 < Math.min(fmax, sr * 0.45); n++) comp.push([n * f0, forma(n, n * f0), 0]);
    for (const r of rumori(f0)) comp.push(r);
    const ris = sostenuto(padsynth(sr, N, comp, 1), sr);
    ris.midiReale = 69 + 12 * Math.log2(f0 / 440);
    return ris;
  }
  /* FLAUTO: quasi una sinusoide pura + il fiato (rumore attorno alle armoniche). */
  STR.flauto = (midi) => {
    const A = [1, 0.22, 0.09, 0.04, 0.025, 0.012, 0.006];
    return solista(midi, 22050, 32768, (n) => A[n - 1] || 0, 9000, (f0) => {
      const r = A.map((a, k) => [f0 * (k + 1), Math.sqrt(a) * 0.05, f0 * (k + 1) * 0.08]);   // il fiato che "soffia" attorno alla nota
      return r.concat([[3200, 0.012, 3000], [6500, 0.006, 3000]]);
    });
  };
  /* CLARINETTO: armoniche dispari forti (suono "legnoso" e simpatico). */
  STR.clarinetto = (midi) => solista(midi, 22050, 32768,
    (n, fn) => (n % 2 ? Math.pow(n, -0.8) : 0.12 * Math.pow(n, -1.2)) / (1 + Math.pow(fn / 2200, 3)), 7000,
    (f0) => [[f0 * 3, 0.02, f0 * 0.3], [2500, 0.008, 2500]]);
  /* VIOLINO solista (quello della rana): la cassa del violino dà il colore. */
  STR.violino = (midi) => solista(midi, 22050, 32768, (n, fn) => Math.pow(n, -0.7) / (1 + Math.pow(fn / 5000, 3)) *
    (0.35 + campana(fn, 290, 0.35) + 0.7 * campana(fn, 470, 0.35) + 0.3 * campana(fn, 1000, 0.4) + 1.3 * campana(fn, 2800, 0.5)), 9000,
    () => [[2500, 0.012, 3000]]);

  /* ========================================================================
   *  GLI EFFETTI ('fx:nome:variante') — ognuno in più varianti, così due
   *  colpi di bastone di fila non sono mai identici.
   * ====================================================================== */
  const FX = {};
  const fx = (canali, sr) => ({ canali: normPicco(canali, 0.8), sr });

  /* Il bastone sui materiali (modi: [frequenza, tau, ampiezza]) */
  const MAT = {
    pietra:   { dur: 0.18, colpo: 0.4, rumore: [0.3, 0.004], modi: [[2200, .012, 1], [950, .04, .8], [3150, .007, .6], [1500, .012, .4], [4400, .005, .4], [6200, .003, .25]] },
    mattoni:  { dur: 0.18, colpo: 0.6, rumore: [0.5, 0.006], modi: [[1150, .016, 1], [700, .022, .8], [1750, .011, .7], [880, .03, .45], [2600, .007, .45], [3700, .005, .3]] },
    legno:    { dur: 0.36, colpo: 0.4, rumore: [0.25, 0.004], modi: [[430, .07, 1], [210, .09, .7], [690, .045, .6], [1120, .03, .45], [1750, .018, .3], [2600, .01, .2]] },
    intonaco: { dur: 0.2, colpo: 0.9, rumore: [0.5, 0.008], modi: [[330, .03, 1], [160, .035, .7], [620, .018, .5], [1050, .012, .3]] },
    vetro:    { dur: 1.1, colpo: 0.15, rumore: [0.25, 0.002], modi: [[2350, .45, 1], [3580, .32, .6], [5200, .22, .4], [1300, .05, .3], [6900, .16, .25], [9100, .1, .12]] },
    metallo:  { sr: 24000, dur: 2.0, colpo: 0.2, rumore: [0.2, 0.003], modi: [[1371, 1.1, 1], [523, 1.5, .8], [2210, .8, .6], [526.5, 1.4, .5], [1380, .9, .4], [3020, .6, .4], [4120, .4, .25], [5300, .25, .15], [880, .7, .3]] },
    ceramica: { dur: 0.5, colpo: 0.15, rumore: [0.3, 0.002], modi: [[3100, .14, 1], [4650, .09, .6], [1900, .05, .4], [6300, .06, .35], [8200, .04, .2]] },
  };

  /** Una bollicina: un fischio breve che sale (la bolla d'aria che vibra). */
  function bolla(sr, f0, dur, salita) {
    const out = nuovo(dur, sr), tau = dur / 3.5;
    let fase = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      fase += PI2 * f0 * (1 + salita * t / dur) / sr;
      out[i] = Math.sin(fase) * Math.exp(-t / tau);
    }
    attacco(out, 1, sr); coda(out, dur * 0.2, sr);
    return out;
  }
  /** Tanti granelli di rumore sparsi nel tempo (foglie, erba, pagine). */
  function granelli(out, sr, quanti, da, a, fmin, fmax, durMax, forza) {
    for (let k = 0; k < quanti; k++) {
      const t = tra(da, a), g = soffio(sr, durMax, tra(durMax * 0.15, durMax * 0.4), 'passabanda', tra(fmin, fmax), tra(0.8, 2), 0.0015);
      aggiungi(out, g, Math.floor(t * sr), tra(0.3, 1) * forza * Math.exp(-(t - da) * 5));
    }
  }

  FX.mat = (nome) => {
    const sr = 32000;
    if (nome === 'foglie') {
      const out = nuovo(0.42, sr);
      granelli(out, sr, 12 + Math.floor(casuale() * 6), 0, 0.24, 2200, 6500, 0.03, 1);
      aggiungi(out, soffio(sr, 0.2, 0.05, 'passabanda', 1300, 0.7, 0.004), 0, 0.35);
      attacco(out, 0.5, sr); coda(out, 0.1, sr);
      return fx([out], sr);
    }
    if (nome === 'libri') {
      const out = modale(sr, 0.45, [[140, .045, 1], [260, .03, .6], [480, .02, .3]], { colpo: 1.5, rumore: [0.6, 0.012] });
      const f = nuovo(0.45, sr);
      granelli(f, sr, 5, 0.05, 0.28, 2800, 5500, 0.04, 0.6);
      aggiungi(out, f, 0, 0.18 * picco(out) / (picco(f) || 1));
      coda(out, 0.1, sr);
      return fx([out], sr);
    }
    if (nome === 'acqua') {
      const out = nuovo(0.4, sr);
      aggiungi(out, bolla(sr, tra(650, 900), tra(0.05, 0.07), tra(0.6, 0.9)), 0, 1);
      aggiungi(out, bolla(sr, tra(1000, 1400), tra(0.035, 0.05), tra(0.5, 0.8)), Math.floor(tra(0.09, 0.13) * sr), 0.45);
      aggiungi(out, bolla(sr, tra(800, 1200), tra(0.03, 0.045), 0.6), Math.floor(tra(0.19, 0.25) * sr), 0.25);
      aggiungi(out, soffio(sr, 0.03, 0.004, 'passaalto', 3000, 0.7, 0.0005), 0, 0.25);
      return fx([out], sr);
    }
    const m = MAT[nome] || MAT.pietra, sr2 = m.sr || sr;
    return fx([modale(sr2, m.dur, m.modi, m)], sr2);
  };

  /* Passi di Lia: tacco + punta, diversi per superficie */
  FX.passo = (sup) => {
    const sr = 24000;
    if (sup === 'erba') {
      const out = modale(sr, 0.28, [[90, .03, 1], [180, .02, .4]], { colpo: 3, varia: 0.08 });
      const sw = nuovo(0.28, sr);
      granelli(sw, sr, 12, 0.01, 0.16, 1500, 5000, 0.02, 1);
      aggiungi(sw, soffio(sr, 0.2, 0.045, 'passabanda', 2400, 0.6, 0.01), 0, 0.5);
      aggiungi(out, sw, 0, 1.4 * picco(out) / (picco(sw) || 1));
      coda(out, 0.06, sr);
      return fx([out], sr);
    }
    const legno = sup === 'legno';
    const modi = legno ? [[240, .05, 1], [110, .06, .8], [480, .03, .6], [900, .02, .35], [1600, .01, .2]]
      : [[1400, .008, 1], [2300, .006, .7], [700, .012, .5], [120, .02, .6], [3400, .004, .4]];
    const op = { colpo: legno ? 0.8 : 0.5, rumore: [0.6, 0.005], varia: 0.06 };
    const dur = legno ? 0.34 : 0.22, out = nuovo(dur, sr);
    aggiungi(out, modale(sr, dur, modi, op), 0, 1);
    const ritardo = Math.floor(tra(0.05, 0.075) * sr);
    aggiungi(out, modale(sr, dur - 0.08, modi.map(([f, t, a]) => [f * 1.12, t * 0.8, a]), op), ritardo, tra(0.35, 0.5));
    if (!legno) aggiungi(out, soffio(sr, 0.04, 0.01, 'passaalto', 3000, 0.7, 0.003), ritardo, 0.12);
    coda(out, 0.05, sr);
    return fx([out], sr);
  };

  /* "Wuf!" di Gogo: voce con le formanti che si aprono (w → a → f) */
  FX.abbaio = (v) => {
    const sr = 24000, k = [1, 1.06, 0.94, 1.12][v | 0];
    const out = voce(sr, 0.26, {
      f0: [[0, 300 * k], [0.025, 480 * k], [0.07, 450 * k], [0.14, 300 * k], [0.22, 230 * k]],
      amp: [[0, 0], [0.008, 1], [0.06, 0.9], [0.13, 0.45], [0.2, 0.08], [0.26, 0]],
      formanti: [
        { f: [[0, 450], [0.03, 850], [0.1, 750], [0.18, 500]], q: 4, g: 1 },
        { f: [[0, 1000], [0.03, 1500], [0.12, 1300], [0.2, 1000]], q: 6, g: 0.7 },
        { f: [[0, 2600]], q: 8, g: 0.3 }],
      rumore: 0.25, jitter: 0.04, fmax: 6000, pendenza: 0.9,
    });
    aggiungi(out, soffio(sr, 0.08, 0.025, 'passabanda', 1800, 0.8, 0.01), Math.floor(0.12 * sr), 0.06);
    attacco(out, 2, sr); coda(out, 0.03, sr);
    return fx([out], sr);
  };

  /* Ringhio: basso, ruvido, con un tremolo irregolare */
  FX.ringhio = () => {
    const sr = 22050;
    const out = voce(sr, 1.3, {
      f0: [[0, 92], [0.5, 104], [0.9, 96], [1.3, 88]],
      amp: [[0, 0], [0.25, 0.8], [0.5, 1], [0.6, 0.7], [0.75, 0.95], [1.1, 0.6], [1.3, 0]],
      formanti: [{ f: [[0, 420], [0.6, 480], [1.3, 400]], q: 3, g: 1 }, { f: [[0, 1050]], q: 4, g: 0.5 }, { f: [[0, 2300]], q: 6, g: 0.25 }],
      rumore: 0.35, jitter: 0.08, ruvido: [27, 0.6], sub: 0.5, fmax: 4000,
    });
    return fx([out], sr);
  };

  /* "Mi-a-o" del gattino: le formanti vanno da "i" ad "a" a "o" */
  FX.miagolio = (v) => {
    const sr = 32000, k = [1, 1.08, 0.93][v | 0];
    const out = voce(sr, 0.75, {
      f0: [[0, 620 * k], [0.12, 880 * k], [0.35, 800 * k], [0.6, 560 * k], [0.75, 500 * k]],
      amp: [[0, 0], [0.04, 0.7], [0.15, 1], [0.45, 0.8], [0.68, 0.3], [0.75, 0]],
      formanti: [
        { f: [[0, 400], [0.15, 1100], [0.4, 1000], [0.65, 650]], q: 5, g: 1 },
        { f: [[0, 2600], [0.15, 1800], [0.4, 1500], [0.65, 1100]], q: 7, g: 0.6 },
        { f: [[0, 3800]], q: 8, g: 0.25 }],
      rumore: 0.08, jitter: 0.02, vibrato: [6, 0.012], fmax: 9000, pendenza: 1,
    });
    return fx([out], sr);
  };

  /*
   * Lia chiama "Go-go!": voce di bambina (450-560 Hz) sulla vocale "o"
   * (formanti 450 / 800 / 2800 Hz). Fra le due sillabe la "g" chiude un
   * attimo la bocca (le formanti scendono). lungo = "Gogooo!"
   */
  FX.chiama = (v, lungo) => {
    const sr = 32000, k = [1, 1.04, 0.97][v | 0], L = lungo === 'lungo';
    const sale = (v | 0) !== 1;                      // variante 1: "Go-goo" che scende
    const fine = L ? 1.05 : 0.62, s2 = 0.3;
    const f0 = sale
      ? [[0, 430], [0.05, 455], [0.2, 450], [0.26, 500], [0.32, 560], [fine - 0.15, 550], [fine, 515]]
      : [[0, 500], [0.05, 525], [0.2, 520], [0.26, 540], [0.32, 560], [fine - 0.15, 455], [fine, 430]];
    const out = voce(sr, fine, {
      f0: f0.map(([t, f]) => [t, f * k]),
      amp: [[0, 0], [0.03, 0.25], [0.07, 0.9], [0.18, 0.8], [0.22, 0.15], [0.27, 0.12], [s2 + 0.02, 0.95], [fine - 0.2, 0.75], [fine, 0]],
      formanti: [
        { f: [[0, 260], [0.06, 460], [0.2, 440], [0.25, 260], [s2, 470], [fine, 430]], q: 5, g: 1 },
        { f: [[0, 750], [0.06, 880], [0.2, 860], [0.25, 750], [s2, 900], [fine, 840]], q: 6, g: 0.9 },
        { f: [[0, 2800]], q: 8, g: 0.3 }, { f: [[0, 3600]], q: 10, g: 0.08 }],
      rumore: 0.03, jitter: 0.015, vibrato: [5.5, L ? 0.018 : 0.012], fmax: 6000, pendenza: 1.0,
    });
    for (const t of [0, 0.255]) aggiungi(out, soffio(sr, 0.02, 0.005, 'passabasso', 1500, 0.7, 0.002), Math.floor(t * sr), 0.04);
    attacco(out, 6, sr); coda(out, 0.06, sr);
    return fx([out], sr);
  };

  /* Il campanello della porta del negozio: due campanelle che dondolano sulla molla */
  FX.campanello = () => {
    const sr = 32000, out = nuovo(2.4, sr);
    const R = [[0.5, .25, 1.8], [1, 1, 1.4], [1.19, .45, 1], [1.5, .3, .8], [2, .5, .6], [2.51, .2, .4], [2.66, .15, .35], [3.01, .12, .3]];
    const campane = [1318.5, 1760];
    for (const [t, c, a] of [[0, 0, 1], [0.09, 1, 0.75], [0.19, 0, 0.6], [0.3, 1, 0.45], [0.44, 0, 0.3], [0.6, 1, 0.18]]) {
      const da = Math.floor(t * sr);
      for (const [r, am, tau] of R) {
        const f = campane[c] * r * (1 + bianco() * 0.001);
        if (f < sr * 0.45) parziale(out, f, a * am * tra(0.8, 1.2), tau, sr, da);
      }
      aggiungi(out, soffio(sr, 0.004, 0.0007, 'passaalto', 4000, 0.7, 0.0002), da, a * 0.4);
    }
    attacco(out, 0.4, sr); coda(out, 0.3, sr);
    return fx([out], sr);
  };

  /* Clacson simpatico ("pe-pè"): due note quadre leggermente stonate, filtrate */
  FX.clacson = () => {
    const sr = 22050, out = nuovo(0.62, sr);
    const suona = (t0, dur, toni) => {
      const da = Math.floor(t0 * sr), n = Math.floor(dur * sr);
      const fasi = toni.map(() => 0);
      for (let i = 0; i < n && da + i < out.length; i++) {
        const t = i / sr, curv = 1 + 0.04 * Math.exp(-t / 0.02);
        const env = Math.min(1, t / 0.012) * Math.min(1, (dur - t) / 0.035);
        let s = 0;
        toni.forEach((f, j) => {
          fasi[j] += PI2 * f * curv / sr;
          for (let h = 1; h * f < 4000; h += 2) s += Math.sin(h * fasi[j]) / h;
        });
        out[da + i] += s * env;
      }
    };
    suona(0, 0.15, [370, 371.5, 466, 464.5]);
    suona(0.22, 0.2, [415, 416.6, 523, 521]);
    filtra(out, biquad('passabasso', 1800, 0.9, sr)); filtra(out, biquad('picco', 1100, 1.5, sr, 4));
    return fx([out], sr);
  };

  /* Il canto della balena: lungo, profondo, con le vocali che si aprono */
  FX.balena = (v) => {
    const sr = 22050, dur = 3.4;
    const contorni = [
      [[0, 150], [0.6, 170], [1.4, 260], [2.2, 230], [3.4, 165]],
      [[0, 220], [0.8, 180], [1.6, 140], [2.6, 200], [3.4, 240]],
      [[0, 130], [0.9, 210], [1.5, 195], [2.4, 280], [3.4, 180]]];
    const out = voce(sr, dur, {
      f0: contorni[v | 0], amp: [[0, 0], [0.6, 0.8], [1.5, 1], [2.6, 0.8], [3.4, 0]],
      formanti: [{ f: [[0, 320], [1.4, 600], [2.8, 380]], q: 3, g: 1 }, { f: [[0, 800], [1.4, 1150], [2.8, 900]], q: 4, g: 0.5 }, { f: [[0, 2200]], q: 5, g: 0.15 }],
      rumore: 0.05, jitter: 0.01, vibrato: [3.5, 0.015], sub: 0.4, fmax: 3500, pendenza: 1.1,
    });
    return fx([out], sr);
  };

  /* Il lampione che sbadiglia: "aaaah-mm" con il fiato */
  FX.sbadiglio = () => {
    const sr = 24000;
    const out = voce(sr, 1.5, {
      f0: [[0, 240], [0.45, 340], [1.0, 250], [1.5, 170]], amp: [[0, 0], [0.2, 0.8], [0.6, 1], [1.1, 0.6], [1.5, 0]],
      formanti: [{ f: [[0, 700], [0.5, 850], [1.0, 500], [1.3, 300]], q: 4, g: 1 }, { f: [[0, 1200], [0.5, 1300], [1.0, 850], [1.3, 700]], q: 5, g: 0.6 }, { f: [[0, 2700]], q: 6, g: 0.25 }],
      rumore: 0.3, jitter: 0.02, vibrato: [4, 0.01], fmax: 4500,
    });
    return fx([out], sr);
  };

  /* Il tubare dei piccioni: "hu — rrruuu — hu" */
  FX.piccione = (v) => {
    const sr = 22050, k = v ? 0.9 : 1;
    const out = voce(sr, 1.0, {
      f0: [[0, 330 * k], [0.15, 300 * k], [0.28, 350 * k], [0.45, 420 * k], [0.7, 330 * k], [0.83, 320 * k], [1, 280 * k]],
      amp: [[0, 0], [0.03, 0.6], [0.14, 0.5], [0.18, 0], [0.24, 0], [0.28, 0.8], [0.5, 1], [0.7, 0.7], [0.76, 0], [0.8, 0], [0.83, 0.5], [0.98, 0]],
      formanti: [{ f: [[0, 500]], q: 2, g: 1 }, { f: [[0, 900]], q: 3, g: 0.3 }],
      rumore: 0.1, ruvido: [35, 0.5], fmax: 2000, pendenza: 1.4,
    });
    return fx([out], sr);
  };

  /* Cinguettio: fischi brevi che salgono e scendono, ogni tanto un trillo */
  FX.uccellino = (v) => {
    const sr = 32000, out = nuovo(0.9, sr), base = [2900, 3400, 3900, 4400][v | 0];
    let t = 0.01;
    const quanti = 2 + ((v | 0) % 3) + Math.floor(casuale() * 2);
    for (let c = 0; c < quanti && t < 0.75; c++) {
      const d = tra(0.035, 0.085), fa = base * tra(0.8, 1.1), fb = base * tra(1.1, 1.5), su = casuale() < 0.6, trillo = casuale() < 0.3;
      const n = Math.floor(d * sr), da = Math.floor(t * sr);
      let fase = 0;
      for (let i = 0; i < n && da + i < out.length; i++) {
        const x = i / n;
        let f = su ? fa * Math.pow(fb / fa, x) : fb * Math.pow(fa / fb, x);
        if (trillo) f *= 1 + 0.12 * Math.sin(PI2 * 38 * i / sr);
        fase += PI2 * f / sr;
        const e = Math.sin(Math.PI * x);
        out[da + i] += (Math.sin(fase) + 0.08 * Math.sin(2 * fase)) * e * e;
      }
      t += d + tra(0.025, 0.07);
    }
    coda(out, 0.1, sr);
    return fx([out], sr);
  };

  /* Battito d'ali: colpi d'aria che si allontanano */
  FX.ali = () => {
    const sr = 24000, out = nuovo(1.0, sr);
    let t = 0;
    for (let k = 0; k < 7; k++) {
      const a = Math.exp(-k * 0.17), da = Math.floor(t * sr);
      aggiungi(out, soffio(sr, 0.09, 0.03, 'passabanda', tra(500, 900), 0.9, 0.006), da, a);
      aggiungi(out, soffio(sr, 0.04, 0.01, 'passaalto', 3000, 0.7, 0.003), da, a * 0.15);
      aggiungi(out, modale(sr, 0.1, [[130, .03, 1]], { colpo: 4 }), da, a * 0.5);
      t += 0.11 - k * 0.006;
    }
    coda(out, 0.1, sr);
    return fx([out], sr);
  };

  /* Pagine che svolazzano */
  FX.pagine = () => {
    const sr = 32000, out = nuovo(0.6, sr);
    aggiungi(out, soffio(sr, 0.08, 0.02, 'passabanda', 600, 0.8, 0.004), 0, 0.5);
    let t = 0.02;
    for (let k = 0; k < 6 + Math.floor(casuale() * 4); k++) {
      aggiungi(out, soffio(sr, 0.05, tra(0.008, 0.02), 'passabanda', tra(1800, 4500), 0.9, 0.002), Math.floor(t * sr), tra(0.5, 1) * Math.exp(-t * 3));
      t += tra(0.03, 0.06);
    }
    coda(out, 0.08, sr);
    return fx([out], sr);
  };

  /* SPLASH: l'onda d'acqua + tante goccioline + qualche "blub" */
  FX.splash = () => {
    const sr = 32000, dur = 1.0, out = nuovo(dur, sr), s = svf();
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, fc = 700 + 2300 * Math.exp(-t / 0.15);
      out[i] = svfBanda(s, bianco(), fc, 0.7, sr) * Math.min(1, t / 0.012) * Math.exp(-t / 0.18);
    }
    for (let k = 0; k < 25; k++) {
      const t = 0.08 + Math.pow(casuale(), 1.6) * 0.72;
      aggiungi(out, bolla(sr, tra(1500, 4000), tra(0.01, 0.025), 0.6), Math.floor(t * sr), tra(0.1, 0.35));
    }
    for (let k = 0; k < 3; k++) aggiungi(out, bolla(sr, tra(300, 600), tra(0.06, 0.1), 1.5), Math.floor(tra(0.15, 0.4) * sr), 0.5);
    coda(out, 0.1, sr);
    return fx([out], sr);
  };

  /* Lo scippo: "fruuush" (rumore con un filtro che corre verso l'acuto) */
  FX.scippo = () => {
    const sr = 24000, dur = 0.4, out = nuovo(dur, sr), s = svf();
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, x = Math.min(1, t / 0.32), fc = 500 * Math.pow(7, x), e = Math.sin(Math.PI * x);
      out[i] = svfBanda(s, bianco(), fc, 1.5, sr) * e * e * (1 - 0.3 * Math.sin(PI2 * 22 * t));
    }
    return fx([out], sr);
  };

  /* Lia sbatte contro qualcosa: "bonk" tondo e morbido, da cartone */
  FX.botta = () => {
    const sr = 22050, out = nuovo(0.45, sr);
    let f1 = 0, f2 = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, g = 1 - 0.15 * (1 - Math.exp(-t / 0.05));
      f1 += PI2 * 200 * g / sr; f2 += PI2 * 470 * g / sr;
      out[i] = Math.sin(f1) * Math.exp(-t / 0.1) + 0.5 * Math.sin(f2) * Math.exp(-t / 0.06);
    }
    aggiungi(out, soffio(sr, 0.08, 0.02, 'passabasso', 300, 0.7, 0.001), 0, 0.4);
    attacco(out, 1.5, sr); coda(out, 0.05, sr);
    return fx([out], sr);
  };

  /* Il clic dei pulsanti: un "toc" di legnetto, piccolo e gentile */
  FX.clic = () => {
    const sr = 32000;
    return fx([modale(sr, 0.12, [[1050, .025, 1], [2350, .008, .4], [3900, .004, .2]], { colpo: 0.4, rumore: [0.1, 0.002], varia: 0 })], sr);
  };

  /* Soffi d'aria magici (filtro che sale): breve e lungo */
  function soffioMagico(sr, dur, f0, f1, picco_) {
    const out = nuovo(dur, sr), s = svf();
    for (let i = 0; i < out.length; i++) {
      const t = i / sr, x = t / dur, fc = f0 * Math.pow(f1 / f0, x);
      const e = x < picco_ ? Math.sin(Math.PI / 2 * x / picco_) : Math.cos(Math.PI / 2 * (x - picco_) / (1 - picco_));
      out[i] = svfBanda(s, bianco(), fc, 0.8, sr) * e * e * (1 - 0.25 * Math.sin(PI2 * 6 * t));
    }
    return out;
  }
  FX.soffio = () => fx([soffioMagico(32000, 1.0, 1500, 9000, 0.3)], 32000);
  FX.soffiolungo = () => fx([soffioMagico(32000, 1.8, 400, 8000, 0.7)], 32000);
  /* Il fiato all'inizio di una nota di flauto */
  FX.chiff = () => fx([soffio(22050, 0.08, 0.02, 'passabanda', 1800, 0.7, 0.004)], 22050);

  /* Gocce di pioggia, bolle d'acqua, scoppiettii del fuoco: piccoli granelli */
  FX.goccia = (v) => {
    const sr = 32000;
    if ((v | 0) % 2) return fx([bolla(sr, tra(1500, 3500), tra(0.015, 0.03), 0.8)], sr);
    return fx([modale(sr, 0.05, [[tra(2500, 6000), tra(0.002, 0.006), 1]], { colpo: 0.1, rumore: [0.6, 0.001] })], sr);
  };
  FX.bolla = () => fx([bolla(32000, tra(350, 1600), tra(0.03, 0.09), tra(0.4, 1.3))], 32000);
  FX.scoppio = () => {
    const sr = 32000, out = modale(sr, 0.06, [[tra(1200, 3500), tra(0.002, 0.005), 1], [tra(400, 900), 0.008, 0.6]], { colpo: 0.3, rumore: [0.5, 0.0015] });
    if (casuale() < 0.4) aggiungi(out, Float32Array.from(out), Math.floor(tra(0.006, 0.015) * sr), 0.5);
    return fx([out], sr);
  };

  /* ========================================================================
   *  I "LETTI" DEGLI AMBIENTI: rumori in loop perfetto (senza cuciture)
   * ====================================================================== */
  const LETTI = {};
  const letto = (canali, sr) => {    // volume medio uguale per tutti, ma senza picchi oltre 0,9
    normRms(canali, 0.2);
    let p = 0; for (const c of canali) p = Math.max(p, picco(c));
    if (p > 0.9) for (const c of canali) for (let i = 0; i < c.length; i++) c[i] *= 0.9 / p;
    return { canali, sr, loop: true };
  };
  const panSparso = (canali, src, da, a) => {    // un granello messo a caso fra destra e sinistra
    const p = casuale();
    aggiungiCiclico(canali[0], src, da, a * Math.cos(p * Math.PI / 2));
    aggiungiCiclico(canali[1], src, da, a * Math.sin(p * Math.PI / 2));
  };

  LETTI.acqua = () => {
    const sr = 22050, N = 65536;
    const c = normRms(rumoreColorato(sr, N, (f) => f < 80 ? 0 : Math.pow(f / 500, 0.3) / (1 + Math.pow(f / 900, 2)), 2), 0.1);
    for (let k = 0; k < 90; k++) panSparso(c, bolla(sr, tra(350, 1800), tra(0.02, 0.08), tra(0.3, 1.2)), Math.floor(casuale() * N), Math.pow(casuale(), 2) * 0.5);
    return letto(c, sr);
  };
  LETTI.vento = () => {
    const sr = 22050;
    return letto(rumoreColorato(sr, 65536, (f) => f < 40 ? 0 : Math.pow(f / 100, -0.5) / (1 + Math.pow(f / 1100, 2)), 2), sr);
  };
  LETTI.pioggia = () => {
    const sr = 32000, N = 131072;
    const c = normRms(rumoreColorato(sr, N, (f) => f < 150 ? 0 : Math.pow(f / 3000, 0.25) / (1 + Math.pow(f / 9000, 2)) + 0.4 / (1 + Math.pow(f / 300, 2)), 2), 0.08);
    for (let k = 0; k < 700; k++) {
      const g = casuale() < 0.5 ? modale(sr, 0.03, [[tra(2500, 7000), tra(0.0015, 0.005), 1]], { colpo: 0.1, rumore: [0.7, 0.001] })
        : bolla(sr, tra(1500, 3800), tra(0.01, 0.025), 0.8);
      panSparso(c, g, Math.floor(casuale() * N), Math.pow(casuale(), 3) * 0.6);
    }
    return letto(c, sr);
  };
  LETTI.fuoco = () => {
    const sr = 22050, N = 65536;
    const c = normRms(rumoreColorato(sr, N, (f) => f < 30 ? 0 : Math.min(1, f / 80) / (1 + Math.pow(f / 350, 2)), 2), 0.12);
    for (let k = 0; k < 260; k++) {
      const g = modale(sr, 0.03, [[tra(1200, 4000), tra(0.002, 0.005), 1]], { colpo: 0.3, rumore: [0.5, 0.001] });
      panSparso(c, g, Math.floor(casuale() * N), Math.pow(casuale(), 4) * 0.5);
    }
    return letto(c, sr);
  };
  LETTI.motore = () => {
    const sr = 22050, N = 32768, M = Math.round(27 * N / sr), out = new Float32Array(N);
    const scoppio = new Float32Array(Math.floor(0.06 * sr));
    parziale(scoppio, 105, 1, 0.012, sr); parziale(scoppio, 210, 0.5, 0.006, sr);
    const sbuffo = soffio(sr, 0.05, 0.01, 'passabasso', 600, 0.7, 0.001);
    const ritmo = [1, 0.82, 0.93, 0.76];
    for (let k = 0; k < M; k++) {
      const da = Math.floor(k * N / M), a = ritmo[k % 4] * (1 + bianco() * 0.08);
      aggiungiCiclico(out, scoppio, da, a);
      aggiungiCiclico(out, sbuffo, da, a * 0.6);
    }
    filtra(out, biquad('passabasso', 900, 0.7, sr), 2);
    togliMedia(out);
    return letto([out], sr);
  };
  LETTI.citta = () => {
    const sr = 22050;
    return letto(rumoreColorato(sr, 65536, (f) => f < 25 ? 0 : Math.pow(f / 100, -0.3) / (1 + Math.pow(f / 320, 2)) + 0.04 * campana(f, 900, 1.2), 2), sr);
  };

  /* ------------------------------------------------------------------------
   *  Lo "sportello" del laboratorio: riceve un nome, restituisce i campioni
   * ---------------------------------------------------------------------- */
  return function (msg) {
    const { id, nome } = msg;
    try {
      let h = 2166136261;
      for (let i = 0; i < nome.length; i++) h = Math.imul(h ^ nome.charCodeAt(i), 16777619);
      seme = h | 0;
      const p = nome.split(':');
      const ris = p[0] === 'str' ? STR[p[1]](+p[2]) : p[0] === 'fx' ? FX[p[1]](p[2], p[3]) : LETTI[p[1]]();
      invia({ id, nome, canali: ris.canali, sr: ris.sr, loop: !!ris.loop, midiReale: ris.midiReale }, ris.canali.map((c) => c.buffer));
    } catch (e) {
      invia({ id, nome, errore: String((e && e.stack) || e) });
    }
  };
}

/* ==========================================================================
 *  2. L'OGGETTO AUDIO E IL MIXER
 * ========================================================================== */
const differenza = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const hzMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const caso = (a, b) => a + (b - a) * Math.random();
/** Ferma le automazioni future di un parametro TENENDO il valore attuale (niente salti = niente clic). */
const tieni = (p, t) => { if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t); else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); } };

/* Livelli di base (il cursore del menu li moltiplica): la musica sta SOTTO gli effetti */
const LIV_MUSICA = 0.85;
const LIV_EFFETTI = 1.35;
/*
 * Il compressore di Chrome alza da solo il volume dei suoni deboli
 * ("make-up gain", qui circa +4,3 dB): lo ricompensiamo subito dopo, così
 * il compressore lavora solo sui picchi. Valore misurato con i test.
 */
const TRIM_COMPRESSORE = 0.61;

export const Audio = {
  ctx: null,
  ascoltatore: { x: 0, y: 0, angolo: 0 },
  mondo: null,          // se il gioco ci mette un oggetto con lineaDiVista(), i suoni dietro i muri si ovattano
  continui: [],
  muto: false,
  tonica: 0,            // la "chiave" della musica (0 = Do, 5 = Fa, 7 = Sol): i suoni magici si accordano
  buffer: {},           // i suoni pronti (AudioBuffer), per nome
  banche: {},           // gli strumenti pronti: nome → [{ midi, buffer }]
  _voci: {},            // le note che stanno suonando (per non superare la polifonia)
  _ultime: {},          // l'ultima variante usata di ogni effetto (per non ripetere)
  _clienti: [],         // chi vuole essere chiamato a ogni "battito" (la musica)
};

/* ------------------------------------------------------------------------ */
/*  Avvio (va chiamato dopo un tocco dell'utente)                           */
/* ------------------------------------------------------------------------ */
Audio.avvia = function () {
  if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try {
    this.ctx = new C();
    this._mixer(this.ctx);
    this._apriLaboratorio();
    this._precarica();
    this.impostaVolumi(CONFIG.audio.musica, CONFIG.audio.effetti);
    // di riserva: se per un po' nessuno chiama aggiorna(), il battito parte da solo
    this._timer = setInterval(() => { if (this.ctx && performance.now() - (this._ultimoBattito || 0) > 150) this._battito(); }, 100);
  } catch (e) {
    console.warn('Audio non disponibile', e);
    this.ctx = null;
  }
};

Audio._mixer = function (ctx) {
  const guadagno = (v, dove) => { const g = ctx.createGain(); g.gain.value = v; if (dove) g.connect(dove); return g; };
  this.generale = guadagno(1, ctx.destination);
  // limitatore "morbido": sotto 0,6 non tocca niente, sopra arrotonda e non supera mai -1 dB
  this.limitatore = ctx.createWaveShaper();
  const n = 2048, curva = new Float32Array(n), soglia = 0.6, tetto = 0.88;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    curva[i] = Math.sign(x) * (a < soglia ? a : soglia + (tetto - soglia) * Math.tanh((a - soglia) / (tetto - soglia)));
  }
  this.limitatore.curve = curva;
  this.limitatore.connect(this.generale);
  this.trim = guadagno(TRIM_COMPRESSORE, this.limitatore);
  // compressore gentile: tiene insieme il mix e doma i colpi più forti
  const comp = (this.compressore = ctx.createDynamicsCompressor());
  comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 2.5;
  comp.attack.value = 0.006; comp.release.value = 0.25;
  comp.connect(this.trim);
  this.premaster = guadagno(1, comp);
  this.duck = guadagno(1, this.premaster);       // la musica si fa un po' da parte per i suoni importanti
  this.busMusica = guadagno(LIV_MUSICA, this.duck);
  this.busEffetti = guadagno(LIV_EFFETTI, this.premaster);
  // riverbero: una sala grande e morbida (vedi _impulso)
  this.riverbero = ctx.createConvolver();
  this.riverbero.buffer = this._impulso(2.2);
  this.riverbero.connect(guadagno(0.8, this.premaster));
  this.mandataRiverbero = guadagno(1, this.riverbero);
  this.duckRiv = guadagno(1, this.mandataRiverbero);
  this.mandataMusica = guadagno(LIV_MUSICA, this.duckRiv);
  this.mandataEffetti = guadagno(LIV_EFFETTI, this.mandataRiverbero);
  // eco lontana (per la balena): un ritardo che si ripete scurendosi
  const eco = ctx.createDelay(1.0); eco.delayTime.value = 0.37;
  const ecoFiltro = ctx.createBiquadFilter(); ecoFiltro.type = 'lowpass'; ecoFiltro.frequency.value = 2400;
  eco.connect(ecoFiltro); ecoFiltro.connect(guadagno(0.33, eco));
  const ecoUscita = guadagno(0.5, this.premaster); ecoUscita.connect(this.mandataRiverbero);
  ecoFiltro.connect(ecoUscita);
  this.mandataEco = guadagno(1, eco);
};

/*
 * La "risposta" della sala per il riverbero: qualche rimbalzo vicino sulle
 * pareti (riflessioni precoci) e poi una coda di rumore che si spegne in
 * circa 2 secondi diventando sempre più scura (gli acuti muoiono prima).
 */
Audio._impulso = function (secondi) {
  const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * secondi), pre = Math.floor(0.02 * sr);
  const b = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    const tappe = c ? [[0.009, 0.5], [0.017, 0.35], [0.026, 0.3], [0.039, 0.22], [0.052, 0.16], [0.067, 0.1]]
      : [[0.007, 0.55], [0.014, 0.4], [0.023, 0.3], [0.034, 0.25], [0.047, 0.18], [0.061, 0.12]];
    for (const [t, a] of tappe) { const i = pre + Math.floor(t * sr); d[i] += a * (Math.random() < 0.5 ? -1 : 1); d[i + 1] += a * 0.4 * (Math.random() - 0.5); }
    let lp = 0, prec = 0, hp = 0, k = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      if ((i & 63) === 0) k = Math.exp(-2 * Math.PI * (1600 + 8500 * Math.exp(-t / 0.7)) / sr);
      lp = lp * k + (1 - k) * (Math.random() * 2 - 1);
      hp = 0.995 * hp + lp - prec; prec = lp;           // toglie i bassissimi (niente rimbombo)
      d[i] += hp * Math.pow(10, -3 * t / secondi) * Math.min(1, t / 0.035) * 0.5;
    }
    for (let i = 0; i < 2000; i++) d[n - 1 - i] *= i / 2000;
  }
  // normalizziamo l'energia: così la "mandata" ha un effetto prevedibile
  let e = 0;
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) e += d[i] * d[i]; }
  const k = 1 / Math.sqrt(e / 2);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= k; }
  return b;
};

Audio.impostaVolumi = function (musica, effetti) {
  CONFIG.audio.musica = musica;
  CONFIG.audio.effetti = effetti;
  if (!this.ctx) return;
  const t = this.ctx.currentTime;
  this.busMusica.gain.setTargetAtTime(musica * LIV_MUSICA, t, 0.1);
  this.mandataMusica.gain.setTargetAtTime(musica * LIV_MUSICA, t, 0.1);
  this.busEffetti.gain.setTargetAtTime(effetti * LIV_EFFETTI, t, 0.1);
  this.mandataEffetti.gain.setTargetAtTime(effetti * LIV_EFFETTI, t, 0.1);
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

/** La musica si fa da parte (db negativi) per qualche secondo. */
Audio._abbassaMusica = function (db, secondi) {
  if (!this.ctx) return;
  const t = this.ctx.currentTime, k = Math.pow(10, db / 20);
  for (const g of [this.duck.gain, this.duckRiv.gain]) {
    tieni(g, t);
    g.setTargetAtTime(k, t, 0.15);
    g.setTargetAtTime(1, t + secondi, 0.6);
  }
};

/* ==========================================================================
 *  3. IL LABORATORIO AL LAVORO: la fila dei suoni da preparare
 * ========================================================================== */
Audio._apriLaboratorio = function () {
  this._attesa = new Map();   // nome → funzioni da chiamare quando il suono è pronto
  this._coda = [];            // nomi in fila
  this._inVolo = new Set();   // nomi che il laboratorio sta preparando
  const ricevi = (m) => this._ricevi(m);
  try {
    const codice = 'const gestisci = (' + laboratorio.toString() + ')((m, t) => postMessage(m, t));\nonmessage = (e) => gestisci(e.data);';
    const url = URL.createObjectURL(new Blob([codice], { type: 'text/javascript' }));
    this._lab = new Worker(url);
    this._lab.onmessage = (e) => ricevi(e.data);
    this._lab.onerror = (e) => {     // se il Worker non funziona, il lavoro si fa "in casa"
      console.warn('Laboratorio audio: lavoro sul thread principale', e && e.message);
      this._lab = null;
      this._gestisci = laboratorio(ricevi);
      for (const nome of this._inVolo) this._coda.unshift(nome);
      this._inVolo.clear();
      this._avanti();
    };
  } catch (e) {
    this._lab = null;
  }
  if (!this._lab) this._gestisci = laboratorio(ricevi);
};

/** Chiede un suono al laboratorio (urgente = passa avanti nella fila). */
Audio._richiedi = function (nome, urgente, fatto) {
  if (!this.ctx) return;
  if (this.buffer[nome]) { if (fatto) fatto(this.buffer[nome]); return; }
  if (fatto) { if (!this._attesa.has(nome)) this._attesa.set(nome, []); this._attesa.get(nome).push(fatto); }
  if (this._inVolo.has(nome)) return;
  const i = this._coda.indexOf(nome);
  if (i >= 0) { if (urgente) { this._coda.splice(i, 1); this._coda.unshift(nome); } }
  else if (urgente) this._coda.unshift(nome); else this._coda.push(nome);
  this._avanti();
};

Audio._avanti = function () {
  while (this._inVolo.size < 2 && this._coda.length) {
    const nome = this._coda.shift();
    this._inVolo.add(nome);
    if (this._lab) this._lab.postMessage({ nome });
    else setTimeout(() => this._gestisci({ nome }), 0);
  }
};

Audio._ricevi = function (m) {
  this._inVolo.delete(m.nome);
  if (m.errore) console.warn('Suono non riuscito:', m.nome, m.errore);
  else if (this.ctx) {
    const b = this.ctx.createBuffer(m.canali.length, m.canali[0].length, m.sr);
    m.canali.forEach((c, i) => { if (b.copyToChannel) b.copyToChannel(c, i); else b.getChannelData(i).set(c); });
    this.buffer[m.nome] = b;
    const p = m.nome.split(':');
    if (p[0] === 'str') {
      const banca = this.banche[p[1]] || (this.banche[p[1]] = []);
      banca.push({ midi: m.midiReale || +p[2], buffer: b });
      banca.sort((a, c) => a.midi - c.midi);
    }
    const f = this._attesa.get(m.nome);
    if (f) { this._attesa.delete(m.nome); f.forEach((fn) => { try { fn(b); } catch (e) { console.warn(e); } }); }
  }
  this._avanti();
};

/** Tutti i suoni, in ordine di importanza (i primi servono subito). */
Audio._precarica = function () {
  const r = (n) => this._richiedi(n);
  r('fx:clic');
  for (const m in LIV_MATERIALI) for (let v = 0; v < LIV_MATERIALI[m][2]; v++) r(`fx:mat:${m}:${v}`);
  for (const s of ['pietra', 'erba', 'legno']) for (let v = 0; v < 6; v++) r(`fx:passo:${s}:${v}`);
  for (let v = 0; v < 4; v++) r('fx:abbaio:' + v);
  for (let v = 0; v < 3; v++) { r('fx:chiama:' + v); r('fx:miagolio:' + v); }
  r('fx:chiama:0:lungo'); r('fx:chiama:2:lungo');
  this.preparaStrumenti(['carillon', 'celesta', 'campanella', 'arpa']);
  ['soffio', 'soffiolungo', 'botta', 'scippo', 'ringhio', 'campanello', 'clacson', 'ali', 'pagine', 'splash', 'sbadiglio', 'chiff'].forEach((n) => r('fx:' + n));
  for (let v = 0; v < 3; v++) r('fx:balena:' + v);
  for (let v = 0; v < 4; v++) r('fx:uccellino:' + v);
  for (let v = 0; v < 2; v++) r('fx:piccione:' + v);
  for (let v = 0; v < 8; v++) { r('fx:goccia:' + v); r('fx:bolla:' + v); }
  for (let v = 0; v < 6; v++) r('fx:scoppio:' + v);
  this.preparaStrumenti(['piano', 'pizzicato', 'contrabbasso', 'flauto', 'archi', 'violoncelli', 'coro', 'clarinetto', 'violino']);
  for (const l of ['citta', 'vento', 'acqua', 'fuoco', 'pioggia', 'motore']) r('letto:' + l);
};

/* ==========================================================================
 *  4. GLI STRUMENTI
 *  note: le note (numeri MIDI, 60 = Do centrale) di cui prepariamo un
 *  campione; le altre si ottengono accelerando o rallentando il più vicino.
 * ========================================================================== */
export const STRUMENTI = {
  piano:        { note: [36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96], volume: 0.55, rilascio: 0.35, poli: 20, filtroVel: true },
  celesta:      { note: [60, 66, 72, 78, 84, 90, 96], volume: 0.4, rilascio: 0.6, poli: 14 },
  carillon:     { note: [72, 78, 84, 90, 96], volume: 0.38, rilascio: 1.0, poli: 12 },
  campanella:   { note: [72, 78, 84, 90, 96], volume: 0.3, rilascio: 1.2, poli: 12 },
  arpa:         { note: [43, 49, 55, 61, 67, 73, 79, 85, 91], volume: 0.55, rilascio: 0.8, poli: 18 },
  pizzicato:    { note: [43, 49, 55, 61, 67, 73, 79], volume: 0.5, rilascio: 0.12, poli: 12 },
  contrabbasso: { note: [28, 34, 40, 46], volume: 0.5, rilascio: 0.2, poli: 4 },
  archi:        { note: [48, 55, 62, 69, 76, 83], sostenuto: true, attacco: 0.35, rilascio: 0.9, volume: 0.3, poli: 14 },
  violoncelli:  { note: [36, 42, 48, 54], sostenuto: true, attacco: 0.3, rilascio: 0.8, volume: 0.38, poli: 6 },
  coro:         { note: [57, 63, 69, 75, 81], sostenuto: true, attacco: 0.45, rilascio: 1.0, volume: 0.28, poli: 14 },
  flauto:       { note: [60, 66, 72, 78, 84, 90], sostenuto: true, attacco: 0.06, rilascio: 0.15, volume: 0.34, poli: 4, vibrato: [5.0, 14, 0.25], chiff: 0.22 },
  clarinetto:   { note: [50, 56, 62, 68, 74, 80, 86], sostenuto: true, attacco: 0.035, rilascio: 0.09, volume: 0.32, poli: 4, vibrato: [5.2, 6, 0.3] },
  violino:      { note: [62, 67, 72, 77, 82, 87], sostenuto: true, attacco: 0.07, rilascio: 0.14, volume: 0.3, poli: 4, vibrato: [5.8, 20, 0.15] },
};

/** Mette in fila (urgente) i campioni degli strumenti indicati. */
Audio.preparaStrumenti = function (nomi, urgente) {
  for (const n of [].concat(nomi)) {
    const S = STRUMENTI[n];
    if (!S) continue;
    const note = urgente ? [...S.note].reverse() : S.note;   // con unshift l'ordine si rovescia
    for (const m of note) this._richiedi(`str:${n}:${m}`, urgente);
  }
};
/** true se tutti i campioni dello strumento sono pronti. */
Audio.strumentoPronto = function (nome) {
  const S = STRUMENTI[nome], b = this.banche[nome];
  return !!(S && b && b.length >= S.note.length);
};

/**
 * Suona una nota. nome = strumento, midi = altezza (anche con decimali),
 * t0 = quando (secondi del contesto audio), durata (s), vel = forza 0..1,
 * uscita = nodo dove mandarla (bus effetti se manca).
 */
Audio.strumento = function (nome, midi, t0, durata, vel, uscita) {
  const ctx = this.ctx, S = STRUMENTI[nome], banca = this.banche[nome];
  if (!ctx || !S || !banca || !banca.length) return null;
  let c = banca[0];
  for (let i = 1; i < banca.length; i++) if (Math.abs(banca[i].midi - midi) < Math.abs(c.midi - midi)) c = banca[i];
  const ora = ctx.currentTime;
  if (t0 < ora) t0 = ora;
  const src = ctx.createBufferSource();
  src.buffer = c.buffer;
  const rate = Math.pow(2, (midi - c.midi) / 12);
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  let testa = src;
  if (S.filtroVel) {          // pianoforte: più forte = più brillante
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 0.4;
    f.frequency.value = Math.min(16000, hzMidi(midi) * (1.5 + 24 * vel * vel) + 300);
    src.connect(f); testa = f;
  }
  testa.connect(g);
  g.connect(uscita || this.busEffetti);
  const alti = midi > 84 ? Math.pow(2, -(midi - 84) / 24) : 1;     // le note molto acute un po' più piano
  const v = Math.max(0.0001, vel * S.volume * alti);
  const fine = t0 + Math.max(0.05, durata);
  let stop;
  if (!S.sostenuto) {
    g.gain.setValueAtTime(v, t0);
    g.gain.setTargetAtTime(0, fine, S.rilascio / 4);
    stop = Math.min(fine + S.rilascio * 1.6, t0 + c.buffer.duration / rate);
    src.start(t0);
  } else {
    src.loop = true;
    const a = Math.min(S.attacco, Math.max(0.02, durata * 0.5));
    g.gain.value = 0;             // importante: il loop parte a metà onda, il volume deve partire da zero
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + a);
    g.gain.setTargetAtTime(0, fine, S.rilascio / 4);
    stop = fine + S.rilascio * 1.6;
    src.start(t0, Math.random() * c.buffer.duration * 0.9);
    if (S.vibrato && src.detune) {      // vibrato che arriva dopo un attimo, come un musicista vero
      const [fr, cent, ritardo] = S.vibrato;
      const lfo = ctx.createOscillator(), vg = ctx.createGain();
      lfo.frequency.value = fr * caso(0.94, 1.06);
      vg.gain.setValueAtTime(0, t0);
      vg.gain.linearRampToValueAtTime(0, t0 + ritardo);
      vg.gain.linearRampToValueAtTime(cent, t0 + ritardo + 0.4);
      lfo.connect(vg); vg.connect(src.detune);
      lfo.start(t0); lfo.stop(stop + 0.05);
    }
    const chiff = S.chiff && this.buffer['fx:chiff'];
    if (chiff) {                        // il soffio all'inizio della nota di flauto
      const s2 = ctx.createBufferSource(), g2 = ctx.createGain();
      s2.buffer = chiff; s2.playbackRate.value = Math.min(2, Math.max(0.6, hzMidi(midi) / 700));
      g2.gain.value = v * S.chiff;
      s2.connect(g2); g2.connect(uscita || this.busEffetti); s2.start(t0);
    }
  }
  src.stop(stop + 0.05);
  // polifonia: se ci sono troppe note, la più vecchia si spegne in fretta
  let voci = this._voci[nome];
  if (!voci) voci = this._voci[nome] = [];
  for (let i = voci.length - 1; i >= 0; i--) if (voci[i].stop < ora) voci.splice(i, 1);
  if (voci.length >= S.poli) {
    const vecchia = voci.shift();
    try {
      tieni(vecchia.g.gain, t0);
      vecchia.g.gain.setTargetAtTime(0, t0, 0.025);
      vecchia.src.stop(t0 + 0.2);
    } catch (e) { /* già finita */ }
  }
  voci.push({ g, src, stop });
  return { g, src, fine: stop };
};

/* ==========================================================================
 *  5. I SUONI NELLO SPAZIO
 *  Volume secondo la distanza, destra/sinistra secondo la direzione, più
 *  scuro se è dietro di Lia o lontano, ovattato dietro un muro, e un po'
 *  più di eco quando è lontano. x undefined = suono "addosso" a Lia.
 * ========================================================================== */
Audio._spazio = function (x, y) {
  if (x === undefined || x === null) return { vol: 1, pan: 0, taglio: 20000, umido: 1 };
  const L = this.ascoltatore;
  const dx = x - L.x, dy = y - L.y, d = Math.hypot(dx, dy);
  const rel = differenza(L.angolo, Math.atan2(dy, dx));
  const vicino = Math.min(1, d / 1.2);
  const pan = Math.sin(rel) * 0.85 * vicino;
  const dietro = Math.max(0, -Math.cos(rel)) * vicino;
  let taglio = (18000 * (1 - 0.7 * dietro)) / (1 + d / 16);
  if (this.mondo && this.mondo.lineaDiVista && !this.mondo.lineaDiVista(L.x, L.y, x, y, 2.0)) taglio = Math.min(taglio, 700);
  return { vol: 1 / (1 + 0.06 * d * d), pan, taglio, umido: Math.min(2.2, 1 + d * 0.07) };
};

/**
 * Crea l'uscita di un suono: restituisce il nodo dove collegarlo.
 * opz: { pan (per i suoni senza posizione), eco (mandata all'eco) }
 */
Audio._uscita = function (x, y, volume, riverbero, opz) {
  const ctx = this.ctx, sp = this._spazio(x, y);
  const g = ctx.createGain();
  g.gain.value = volume * sp.vol;
  let u = g;
  if (sp.taglio < 15000) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = sp.taglio; f.Q.value = 0.6;
    u.connect(f); u = f;
  }
  const pan = opz && opz.pan !== undefined ? opz.pan : sp.pan;
  if (ctx.createStereoPanner && Math.abs(pan) > 0.01) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    u.connect(p); u = p;
  }
  u.connect(this.busEffetti);
  if (riverbero) {
    const r = ctx.createGain();
    r.gain.value = riverbero * sp.umido;
    u.connect(r); r.connect(this.mandataEffetti);
  }
  if (opz && opz.eco) {
    const e = ctx.createGain();
    e.gain.value = opz.eco * CONFIG.audio.effetti;
    u.connect(e); e.connect(this.mandataEco);
  }
  return g;
};

/** Suona un campione già pronto (se non è ancora pronto lo chiede e tace). */
Audio._fx = function (nome, uscita, t, rate, gain) {
  const b = this.buffer[nome];
  if (!b) { this._richiedi(nome, true); return null; }
  const s = this.ctx.createBufferSource();
  s.buffer = b;
  if (rate) s.playbackRate.value = rate;
  let dove = uscita;
  if (gain !== undefined && gain !== 1) { const g = this.ctx.createGain(); g.gain.value = gain; g.connect(uscita); dove = g; }
  s.connect(dove);
  s.start(Math.max(t, this.ctx.currentTime));
  return s;
};

/** Una variante a caso (mai la stessa due volte di fila). */
Audio._varia = function (base, quante) {
  let v = Math.floor(Math.random() * quante);
  if (quante > 1 && v === this._ultime[base]) v = (v + 1 + Math.floor(Math.random() * (quante - 1))) % quante;
  this._ultime[base] = v;
  return v;
};
Audio._ora = function () { return this.ctx.currentTime; };

/** La scala pentatonica della chiave attuale (5 note per ottava), da un'ottava base. */
Audio._pentatonica = function (base, quante) {
  const P = [0, 2, 4, 7, 9], t = ((this.tonica % 12) + 12) % 12, out = [];
  let ottava = 0;
  while (out.length < quante) {
    for (const p of P) { const m = base + ottava * 12 + p + t; if (m >= base) out.push(m); if (out.length >= quante) break; }
    ottava++;
  }
  return out;
};

/* ==========================================================================
 *  6. GLI EFFETTI SONORI (le funzioni che il gioco chiama)
 * ========================================================================== */

/** "Toc toc": il bastone che bussa sul selciato (due colpi). */
Audio.toc = function (magico) {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.8, 0.35), t = this._ora();
  this._fx(`fx:mat:pietra:${this._varia('pietra', 4)}`, out, t, caso(0.97, 1.03));
  this._fx(`fx:mat:pietra:${this._varia('pietra', 4)}`, out, t + 0.16, caso(0.95, 1.0), 0.8);
  if (magico) this.magia(0.35);
};

/*
 * IL BASTONE CHE TOCCA I MATERIALI (sintesi modale, vedi il laboratorio)
 *   pietra   "toc" secco e chiaro   mattoni  colpo più ruvido
 *   legno    "tok" cavo             intonaco "tup" morbido
 *   vetro    "tin" cristallino      metallo  "dong" che risuona a lungo
 *   foglie   fruscio                ceramica "tink"
 *   libri    tonfo di carta         acqua    "plip" di bollicine
 * [volume, riverbero, quante varianti]
 */
const LIV_MATERIALI = {
  pietra: [1.1, 0.35, 4], mattoni: [1.2, 0.35, 4], legno: [0.85, 0.4, 4], intonaco: [0.95, 0.3, 4], vetro: [0.5, 0.55, 3],
  metallo: [0.5, 0.55, 3], foglie: [0.6, 0.3, 4], ceramica: [0.6, 0.45, 4], libri: [0.9, 0.3, 4], acqua: [0.8, 0.45, 4],
};
Audio.tocco = function (materiale, x, y) {
  if (!this.ctx) return;
  const m = LIV_MATERIALI[materiale] ? materiale : 'pietra';
  const [vol, riv, quante] = LIV_MATERIALI[m];
  this._fx(`fx:mat:${m}:${this._varia(m, quante)}`, this._uscita(x, y, vol, riv), this._ora(), caso(0.96, 1.04));
};

/** Passo: tacco e punta, diversi per superficie ('pietra', 'erba', 'legno'). */
Audio.passo = function (superficie, lato) {
  if (!this.ctx) return;
  const s = superficie === 'erba' || superficie === 'legno' ? superficie : 'pietra';
  const vol = { pietra: 0.3, erba: 0.3, legno: 0.34 }[s] * caso(0.85, 1.05);
  const out = this._uscita(undefined, undefined, vol, 0.15, { pan: lato ? 0.14 : -0.14 });
  this._fx(`fx:passo:${s}:${this._varia('passo' + s, 6)}`, out, this._ora(), caso(0.95, 1.05));
};

/** "Wuf wuf!" di Gogo. */
Audio.abbaio = function (x, y, volte) {
  if (!this.ctx) return;
  const out = this._uscita(x, y, 0.85, 0.3);
  let t = this._ora();
  for (let k = 0; k < (volte || 2); k++) {
    this._fx(`fx:abbaio:${this._varia('abbaio', 4)}`, out, t, caso(0.96, 1.04), k ? caso(0.75, 0.9) : 1);
    t += caso(0.19, 0.26);
  }
};

/** Ringhio basso (Gogo contro il ladro). */
Audio.ringhio = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:ringhio', this._uscita(x, y, 0.7, 0.2), this._ora(), caso(0.95, 1.05));
};

/** Miao. */
Audio.miagolio = function (x, y) {
  if (!this.ctx) return;
  this._fx(`fx:miagolio:${this._varia('miao', 3)}`, this._uscita(x, y, 0.55, 0.3), this._ora(), caso(0.96, 1.05));
};

/** Lia chiama il suo cane: "Go-go!" (lungo = "Gogooo!"). */
Audio.chiama = function (x, y, lungo) {
  if (!this.ctx) return;
  const nome = lungo ? `fx:chiama:${this._varia('chiamaL', 2) ? 2 : 0}:lungo` : `fx:chiama:${this._varia('chiama', 3)}`;
  this._fx(nome, this._uscita(x, y, 0.6, 0.35), this._ora(), caso(0.97, 1.03));
};

/** Campanello della porta di un negozio. */
Audio.campanello = function () {
  if (!this.ctx) return;
  this._fx('fx:campanello', this._uscita(undefined, undefined, 0.45, 0.5), this._ora(), caso(0.98, 1.02));
};

/** Clacson simpatico ("pe-pè"). */
Audio.clacson = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:clacson', this._uscita(x, y, 0.5, 0.25), this._ora(), caso(0.98, 1.03));
};

/** Fruscio di pagine (libri volanti). */
Audio.pagine = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:pagine', this._uscita(x, y, 0.5, 0.3), this._ora(), caso(0.9, 1.1));
};

/** Canto della balena: lungo, profondo, con eco lontana. */
Audio.balena = function () {
  if (!this.ctx) return;
  const out = this._uscita(undefined, undefined, 0.6, 1.1, { eco: 0.45 });
  this._fx(`fx:balena:${this._varia('balena', 3)}`, out, this._ora(), caso(0.95, 1.03));
  this._abbassaMusica(-2.5, 3);
};

/** Scintillio magico: campanelline nella scala della musica + un soffio che sale. */
Audio.magia = function (volume) {
  if (!this.ctx) return;
  const v = volume || 0.5, t = this._ora();
  const sx = this._uscita(undefined, undefined, v, 0.8, { pan: -0.45 });
  const dx = this._uscita(undefined, undefined, v, 0.8, { pan: 0.45 });
  const note = this._pentatonica(84, 8);
  let k0 = Math.floor(Math.random() * 3);
  for (let k = 0; k < 6; k++) {
    const m = note[Math.min(note.length - 1, k0)];
    k0 += 1 + (Math.random() < 0.3 ? 1 : 0);
    const t0 = t + k * 0.07 + Math.random() * 0.03;
    this.strumento('campanella', m, t0, 1.0, caso(0.5, 0.8), k % 2 ? dx : sx);
    if (k < 3) this.strumento('celesta', m - 12, t0, 0.8, 0.35, k % 2 ? sx : dx);
  }
  this._fx('fx:soffio', this._uscita(undefined, undefined, v * 0.3, 0.6), t, caso(0.9, 1.1));
};

/*
 * Le note della bacchetta: ogni colpo suona la nota successiva di una
 * melodia pentatonica di carillon (do re mi sol la). Bussando nasce una
 * piccola canzone, sempre accordata con la musica che sta suonando.
 */
const MELODIA_BACCHETTA = [76, 79, 81, 79, 76, 74, 72, 74, 76, 79, 84, 81, 79, 76, 74, 76,
  81, 84, 86, 84, 81, 79, 76, 74, 72, 74, 76, 79, 76, 74, 72, 67];
Audio.nota = function (indice, volume) {
  if (!this.ctx) return;
  const L = MELODIA_BACCHETTA.length, i = (((indice | 0) % L) + L) % L;
  const m = MELODIA_BACCHETTA[i] + ((((this.tonica % 12) + 18) % 12) - 6);
  const t = this._ora(), vel = Math.min(1, (volume || 0.35) * 2.2);
  const out = this._uscita(undefined, undefined, 1, 0.8, { pan: caso(-0.25, 0.25) });
  this.strumento('carillon', m, t, 1.6, vel, out);
  this.strumento('celesta', m + 12, t + 0.004, 0.9, vel * 0.25, out);
};

/** Un tintinnio leggero quando l'onda scopre posti nuovi (più forte = più posti). */
Audio.scoperta = function (forza) {
  if (!this.ctx) return;
  const f = Math.max(0, Math.min(1, forza === undefined ? 0.5 : forza));
  const out = this._uscita(undefined, undefined, 0.55, 0.9, { pan: caso(-0.4, 0.4) });
  const note = this._pentatonica(84, 7), quante = 2 + Math.round(f * 3), t = this._ora();
  let k0 = Math.floor(Math.random() * 3);
  for (let k = 0; k < quante; k++) {
    this.strumento('celesta', note[Math.min(note.length - 1, k0)], t + k * 0.075 + Math.random() * 0.03, 0.9, 0.25 + f * 0.35, out);
    k0 += 1;
  }
};

/** Glissando d'arpa (pentatonico) che sale: note = quante, durata in secondi. */
Audio._glissando = function (t, base, quante, durata, out, velDa, velA) {
  const note = this._pentatonica(base, quante);
  let tt = t;
  for (let k = 0; k < quante; k++) {
    const x = k / Math.max(1, quante - 1);
    this.strumento('arpa', note[k], tt, 1.8, velDa + (velA - velDa) * x, out);
    tt += (durata / quante) * (1.5 - x);          // accelera mentre sale
  }
  return tt;
};

/** Una meraviglia scoperta: glissando d'arpa e arpeggio di celesta. */
Audio.meraviglia = function () {
  if (!this.ctx) return;
  const t = this._ora(), out = this._uscita(undefined, undefined, 0.75, 0.9);
  const fine = this._glissando(t, 60, 12, 0.65, out, 0.35, 0.65);
  const top = this._pentatonica(84, 5);
  top.slice(0, 4).forEach((m, k) => this.strumento('celesta', m, fine + k * 0.09, 1.2, 0.55, out));
  this.strumento('campanella', top[4], fine + 0.4, 1.5, 0.5, out);
  this._abbassaMusica(-3, 2);
};

/** La grande trasformazione in streghetta: glissando, campanelle, soffio e un accordo che si apre. */
Audio.trasformazione = function () {
  if (!this.ctx) return;
  const t = this._ora(), out = this._uscita(undefined, undefined, 0.7, 0.9);
  const cima = this._glissando(t, 55, 18, 1.2, out, 0.35, 0.8);
  const top = this._pentatonica(84, 6);
  top.forEach((m, k) => this.strumento('campanella', m, cima + k * 0.06, 1.6, 0.5, k % 2 ? this._uscita(undefined, undefined, 0.7, 0.9, { pan: 0.4 }) : out));
  this._fx('fx:soffiolungo', this._uscita(undefined, undefined, 0.45, 0.7), t);
  const T = (((this.tonica % 12) + 12) % 12);
  [48, 55, 60, 64, 67, 72].forEach((m) => this.strumento('archi', m + T, cima - 0.1, 2.4, 0.55, out));
  this.strumento('arpa', 36 + T + 12, cima, 2.5, 0.7, out);
  this._abbassaMusica(-7, 3.2);
};

/** Raccolta di un ricordo: un motivo di carillon con l'arpa e un accordo d'archi. */
Audio.ricordo = function () {
  if (!this.ctx) return;
  const t = this._ora(), out = this._uscita(undefined, undefined, 0.75, 0.8);
  const p = this._pentatonica(72, 9);
  [p[0], p[2], p[4], p[5], p[7]].forEach((m, k) => {
    const t0 = t + k * 0.13 + (k === 4 ? 0.07 : 0);
    this.strumento('carillon', m, t0, k === 4 ? 2 : 1, 0.65, out);
    this.strumento('arpa', m - 12, t0 + 0.01, 1.2, 0.4, out);
  });
  const T = (((this.tonica % 12) + 12) % 12);
  [55, 60, 64, 67].forEach((m) => this.strumento('archi', m + T, t + 0.05, 1.9, 0.4, out));
  this._abbassaMusica(-4, 2.4);
};

/** Lo scippo: un "fruuush" rapido. */
Audio.scippo = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:scippo', this._uscita(x, y, 0.7, 0.2), this._ora(), caso(0.95, 1.05));
};

/** Lia sbatte contro qualcosa: "bonk". */
Audio.botta = function () {
  if (!this.ctx) return;
  this._fx('fx:botta', this._uscita(undefined, undefined, 0.7, 0.25), this._ora(), caso(0.95, 1.05));
};

/** Cinguettio. */
Audio.uccellino = function (x, y) {
  if (!this.ctx) return;
  this._fx(`fx:uccellino:${this._varia('uccellino', 4)}`, this._uscita(x, y, 0.35, 0.35), this._ora(), caso(0.93, 1.08));
};

/** Tubare dei piccioni. */
Audio.piccione = function (x, y) {
  if (!this.ctx) return;
  this._fx(`fx:piccione:${this._varia('piccione', 2)}`, this._uscita(x, y, 0.4, 0.3), this._ora(), caso(0.95, 1.05));
};

/** Battito d'ali (piccioni che volano via). */
Audio.ali = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:ali', this._uscita(x, y, 0.5, 0.3), this._ora(), caso(0.92, 1.08));
};

/** Piccolo "toc" gentile dei pulsanti. */
Audio.clic = function () {
  if (!this.ctx) return;
  this._fx('fx:clic', this._uscita(undefined, undefined, 0.35, 0.15), this._ora(), caso(0.98, 1.03));
};

/** Un'auto (o un'auto-pesce) che passa in una pozzanghera: SPLASH! */
Audio.splash = function (x, y) {
  if (!this.ctx) return;
  this._fx('fx:splash', this._uscita(x, y, 0.65, 0.4), this._ora(), caso(0.9, 1.1));
};

/** Il lampione che sbadiglia e si accende (con un "pling" di luce). */
Audio.sbadiglio = function (x, y) {
  if (!this.ctx) return;
  const t = this._ora(), out = this._uscita(x, y, 0.5, 0.5);
  this._fx('fx:sbadiglio', out, t, caso(0.96, 1.04));
  const T = (((this.tonica % 12) + 12) % 12), luce = this._uscita(x, y, 0.7, 0.8);
  this.strumento('campanella', 84 + T, t + 1.25, 1.4, 0.55, luce);
  this.strumento('celesta', 91 + T, t + 1.31, 1.0, 0.35, luce);
  this.strumento('celesta', 96 + T, t + 1.38, 1.0, 0.3, luce);
};

/**
 * Il violino della rana: un piccolo valzer in Sol (note MIDI, durate in
 * battiti). Restituisce quanto dura, in secondi.
 */
const VALZER_RANA = [[74, 1], [79, 1], [83, 1], [86, 2, 83], [83, 1], [84, 1], [81, 1], [78, 1], [79, 2, 71], [74, 1],
  [76, 1], [79, 1], [84, 1], [83, 1.5], [81, 0.5], [79, 1], [81, 1], [84, 1], [78, 1], [79, 2, 71], [0, 1]];
Audio.violino = function (x, y) {
  const battito = 60 / 184;
  const durata = VALZER_RANA.reduce((s, n) => s + n[1], 0) * battito;
  if (!this.ctx) return durata;
  const out = this._uscita(x, y, 0.9, 0.5);
  let t = this._ora() + 0.03;
  VALZER_RANA.forEach(([m, d, sotto], k) => {
    if (m) {
      const accento = k % 3 === 0 ? 0.85 : 0.7;
      this.strumento('violino', m, t + caso(0, 0.012), d * battito * 0.92, accento * caso(0.92, 1.05), out);
      if (sotto) this.strumento('violino', sotto, t + 0.02, d * battito * 0.9, accento * 0.45, out);
    }
    t += d * battito;
  });
  return durata;
};

/** I fiori che cantano: un piccolo coro di "aaah" a tre voci (due frasi alternate). */
const CORO_FIORI = [
  [[[64, 67, 72], 0.9], [[65, 69, 72], 0.9], [[67, 71, 74], 0.9], [[64, 67, 72], 1.4]],
  [[[64, 69, 72], 0.9], [[65, 69, 74], 0.9], [[64, 67, 72], 0.9], [[62, 67, 71], 0.5], [[64, 67, 72], 1.2]],
];
Audio.coro = function (x, y) {
  if (!this.ctx) return;
  this._fraseCoro = ((this._fraseCoro || 0) + 1) % CORO_FIORI.length;
  const out = this._uscita(x, y, 0.85, 0.8), T = ((((this.tonica % 12) + 18) % 12) - 6);
  let t = this._ora() + 0.02;
  for (const [accordo, d] of CORO_FIORI[this._fraseCoro]) {
    accordo.forEach((m, k) => this.strumento('coro', m + T, t + k * 0.015, d + 0.25, k === 2 ? 0.7 : 0.55, out));
    t += d;
  }
  this.strumento('carillon', 84 + T, t - 0.6, 1.5, 0.35, out);
};

/* ==========================================================================
 *  7. GLI AMBIENTI: suoni continui con una posizione
 *  Ogni ambiente = un "letto" in loop (preparato dal laboratorio) + piccoli
 *  eventi sparsi a caso (bolle, gocce, scoppiettii, raffiche...) così non
 *  si sente mai che il loop si ripete.
 *  k = taratura del volume (il volume che passa il gioco viene moltiplicato)
 * ========================================================================== */
const AMBIENTI = {
  acqua:   { k: 1.2, grani: 'bolla', quanti: 8, al: 6, forza: 0.6 },
  motore:  { k: 1.4, motore: true },
  fuoco:   { k: 1.0, grani: 'scoppio', quanti: 6, al: 3, forza: 0.55 },
  vento:   { k: 1.3, raffiche: true },
  pioggia: { k: 1.0, grani: 'goccia', quanti: 8, al: 25, forza: 0.8 },
  citta:   { k: 1.0, eventi: true },
};

/**
 * tipo: 'acqua' | 'motore' | 'fuoco' | 'vento' | 'pioggia' | 'citta'
 * Restituisce un oggetto { x, y, volume, ferma() }: il gioco può spostarlo
 * cambiando x e y, o cambiarne il volume.
 */
Audio.continuo = function (tipo, x, y, volume) {
  const h = { x, y, volume: volume === undefined ? 0.3 : volume, tipo: AMBIENTI[tipo] ? tipo : 'citta', posizionato: x !== undefined, attivo: true };
  h.ferma = () => this._fermaContinuo(h);
  if (!this.ctx) return h;
  const ctx = this.ctx, t = ctx.currentTime;
  h._in = ctx.createGain();
  h._g = ctx.createGain(); h._g.gain.value = 0;
  h._f = ctx.createBiquadFilter(); h._f.type = 'lowpass'; h._f.frequency.value = 18000; h._f.Q.value = 0.6;
  h._in.connect(h._g); h._g.connect(h._f);
  let u = h._f;
  if (ctx.createStereoPanner) { h._pan = ctx.createStereoPanner(); u.connect(h._pan); u = h._pan; }
  u.connect(this.busEffetti);
  h._riv = ctx.createGain(); h._riv.gain.value = 0.25; u.connect(h._riv); h._riv.connect(this.mandataEffetti);
  h._sorgenti = [];
  h._vol = -1; h._panV = 0; h._taglio = 18000; h._primo = true; h._rpm = 1; h._dop = 1;
  h._prossimo = t + 0.2; h._raffica = t; h._evento = t + caso(2, 5);
  // i granelli senza posizione si spargono fra 4 punti a destra e sinistra
  if (!h.posizionato && ctx.createStereoPanner) {
    h._sparsi = [-0.8, -0.3, 0.3, 0.8].map((p) => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(h._in); return n; });
  }
  this._richiedi('letto:' + h.tipo, true, (b) => { if (h.attivo) this._apriLetto(h, b); });
  this.continui.push(h);
  this._aggiornaContinuo(h, t);
  return h;
};

/** Fa partire il "letto" in loop di un ambiente. */
Audio._apriLetto = function (h, b) {
  const ctx = this.ctx, t = ctx.currentTime;
  // il letto entra in dissolvenza (il loop parte da un punto a caso: niente scalini)
  const entra = ctx.createGain();
  entra.gain.value = 0; entra.gain.setValueAtTime(0, t); entra.gain.linearRampToValueAtTime(1, t + 0.4);
  entra.connect(h._in);
  const sorgente = (rate, dove) => {
    const s = ctx.createBufferSource();
    s.buffer = b; s.loop = true; s.playbackRate.value = rate;
    s.connect(dove); s.start(t, Math.random() * b.duration);
    h._sorgenti.push(s);
    return s;
  };
  if (h.tipo === 'vento') {
    // due strati: un soffio basso e uno più chiaro, ciascuno con le sue raffiche
    h._fa = ctx.createBiquadFilter(); h._fa.type = 'lowpass'; h._fa.frequency.value = 450;
    h._ga = ctx.createGain(); h._ga.gain.value = 0.8;
    h._fb = ctx.createBiquadFilter(); h._fb.type = 'bandpass'; h._fb.frequency.value = 1100; h._fb.Q.value = 0.8;
    h._gb = ctx.createGain(); h._gb.gain.value = 0.3;
    h._fa.connect(h._ga); h._ga.connect(entra); h._fb.connect(h._gb); h._gb.connect(entra);
    sorgente(1, h._fa); sorgente(0.93, h._fb);
  } else if (h.tipo === 'motore') {
    h._motore = sorgente(1, entra);
  } else {
    sorgente(1, entra);
  }
};

Audio._fermaContinuo = function (h) {
  if (!h.attivo) return;
  h.attivo = false;
  this.continui = this.continui.filter((c) => c !== h);
  if (!this.ctx || !h._g) return;
  const t = this.ctx.currentTime;
  tieni(h._g.gain, t);
  h._g.gain.setTargetAtTime(0, t, 0.25);
  for (const s of h._sorgenti) { try { s.stop(t + 1.6); } catch (e) { /* già fermo */ } }
};

/** Ferma tutti i suoni continui (cambio di luogo). */
Audio.fermaContinui = function () {
  for (const c of [...this.continui]) c.ferma();
};

/** Aggiorna volume, direzione e "colore" di un ambiente e programma i suoi granelli. */
Audio._aggiornaContinuo = function (h, t) {
  const A = AMBIENTI[h.tipo];
  const sp = h.posizionato ? this._spazio(h.x, h.y) : { vol: 1, pan: 0, taglio: 18000, umido: 1 };
  const vol = Math.max(0, +h.volume || 0) * A.k * sp.vol;
  if (Math.abs(vol - h._vol) > 1e-4) { h._g.gain.setTargetAtTime(vol, t, h._primo ? 0.5 : 0.12); h._vol = vol; }
  h._primo = false;
  if (h._pan && Math.abs(sp.pan - h._panV) > 0.01) { h._pan.pan.setTargetAtTime(sp.pan, t, 0.12); h._panV = sp.pan; }
  const taglio = Math.min(18000, sp.taglio);
  if (Math.abs(taglio - h._taglio) > 40) { h._f.frequency.setTargetAtTime(taglio, t, 0.2); h._taglio = taglio; h._riv.gain.setTargetAtTime(0.25 * sp.umido, t, 0.2); }
  const avanti = t + 0.2;
  if (h._prossimo < t - 0.1) h._prossimo = t;
  if (A.grani) {
    // granelli (bolle, gocce, scoppiettii): la pioggia più forte = più gocce
    const ritmo = h.tipo === 'pioggia' ? 10 + 70 * Math.min(1, h.volume / 0.3) : A.al;
    while (h._prossimo < avanti) {
      const dove = h._sparsi ? h._sparsi[Math.floor(Math.random() * 4)] : h._in;
      const a = Math.pow(Math.random(), 2) * A.forza;
      this._fx(`fx:${A.grani}:${Math.floor(Math.random() * A.quanti)}`, dove, h._prossimo, caso(0.75, 1.35), a);
      h._prossimo += (-Math.log(1 - Math.random() * 0.98) / ritmo);
    }
  }
  if (A.raffiche && h._ga && h._raffica < avanti) {
    // il vento cambia piano piano: nuove "mete" per i filtri e i volumi
    const forte = Math.random();
    h._fa.frequency.setTargetAtTime(250 + 500 * forte, h._raffica, caso(0.4, 0.9));
    h._ga.gain.setTargetAtTime(0.5 + 0.7 * forte, h._raffica, caso(0.4, 0.9));
    h._fb.frequency.setTargetAtTime(700 + 1200 * forte * Math.random(), h._raffica, caso(0.5, 1.0));
    h._gb.gain.setTargetAtTime(0.1 + 0.5 * forte * forte, h._raffica, caso(0.5, 1.0));
    h._raffica += caso(0.5, 1.4);
  }
  if (A.motore && h._motore) {
    // il motore "respira" un po' e, se si muove, cambia nota (effetto Doppler)
    if (h.posizionato) {
      const d = Math.hypot(h.x - this.ascoltatore.x, h.y - this.ascoltatore.y);
      if (h._d !== undefined && t - h._td > 0.05) {
        const vr = (d - h._d) / (t - h._td);
        h._dop = Math.max(0.92, Math.min(1.08, 343 / (343 + vr * 3)));
        h._d = d; h._td = t;
      } else if (h._d === undefined) { h._d = d; h._td = t; }
    }
    if (h._raffica < avanti) { h._rpm = caso(0.95, 1.06); h._raffica += caso(0.3, 0.8); }
    const r = h._rpm * h._dop;
    if (Math.abs(r - (h._r || 0)) > 0.002) { h._motore.playbackRate.setTargetAtTime(r, t, 0.25); h._r = r; }
  }
  if (A.eventi && h._evento < avanti) {
    // la città immaginata, lontana: un campanello di bici, un uccellino, un piccione...
    const scelta = Math.random(), te = h._evento, dove = h._sparsi ? h._sparsi[Math.floor(Math.random() * 4)] : h._in;
    if (scelta < 0.3) { const m = 88 + Math.floor(Math.random() * 3); this.strumento('campanella', m, te, 0.3, 0.5, dove); this.strumento('campanella', m, te + 0.13, 0.5, 0.4, dove); }
    else if (scelta < 0.6) this._fx(`fx:uccellino:${Math.floor(Math.random() * 4)}`, dove, te, caso(0.9, 1.1), 0.5);
    else if (scelta < 0.85) this._fx(`fx:piccione:${Math.floor(Math.random() * 2)}`, dove, te, caso(0.9, 1.05), 0.6);
    else this._fx('fx:campanello', dove, te, 0.8, 0.25);
    h._evento += caso(4, 10);
  }
};

/** Aggiorna posizione dell'ascoltatore (Lia) e fa battere il "cuore" dell'audio. */
Audio.aggiorna = function (x, y, angolo) {
  const L = this.ascoltatore;
  L.x = x; L.y = y; L.angolo = angolo;
  if (!this.ctx) return;
  this._ultimoBattito = 0;   // la posizione è cambiata: aggiorna subito
  this._battito();
};

/**
 * Il "battito": aggiorna gli ambienti e lascia programmare la musica.
 * Lo chiamano aggiorna() e Musica.aggiorna() a ogni fotogramma (al
 * massimo una volta ogni 12 ms) e, di riserva, un timer.
 */
Audio._battito = function () {
  if (!this.ctx) return;
  const adesso = performance.now();
  if (adesso - (this._ultimoBattito || 0) < 12) return;
  this._ultimoBattito = adesso;
  if (this.ctx.state !== 'running') return;
  const t = this.ctx.currentTime;
  for (const h of this.continui) this._aggiornaContinuo(h, t);
  for (const f of this._clienti) f(t);
};
