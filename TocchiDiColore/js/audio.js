/* ==========================================================================
 *  audio.js — SUONI GENERATI DAL CODICE (Web Audio API)
 *  --------------------------------------------------------------------------
 *  Nessun file audio: tutti i suoni sono creati con oscillatori e rumore.
 *  I suoni hanno una POSIZIONE nel mondo: se Biscotto abbaia alla tua
 *  destra lo senti a destra, se è lontano lo senti piano e se è dietro
 *  un muro lo senti "ovattato". In un gioco su una bambina che non vede,
 *  ascoltare è fondamentale: meglio giocare con le cuffie!
 *
 *  Nota: i browser permettono di avviare l'audio solo dopo un gesto
 *  dell'utente (un clic o un tocco): per questo Audio.avvia() viene
 *  chiamato quando si preme "Inizia".
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const A = {
    ctx: null,
    principale: null,   // volume generale
    rumore: null,       // buffer di rumore bianco riutilizzabile
    muto: false,
    fontane: [],
    timerUccelli: 3,
    ascoltatore: { x: 0, y: 0, angolo: 0 },
  };

  /* ----------------------------- avvio ---------------------------------- */
  A.avvia = function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ContestoAudio = window.AudioContext || window.webkitAudioContext;
    if (!ContestoAudio) return;
    try {
      this.ctx = new ContestoAudio();
      this.principale = this.ctx.createGain();
      this.principale.gain.value = CFG.audio.volume;
      this.principale.connect(this.ctx.destination);

      // 2 secondi di rumore bianco: la "materia prima" per passi, acqua, vento
      const lunghezza = this.ctx.sampleRate * 2;
      this.rumore = this.ctx.createBuffer(1, lunghezza, this.ctx.sampleRate);
      const dati = this.rumore.getChannelData(0);
      for (let i = 0; i < lunghezza; i++) dati[i] = Math.random() * 2 - 1;

      this._ambiente();
      for (const o of G.Mondo.oggetti) if (o.suono === 'acqua') this._fontana(o);
    } catch (errore) {
      console.warn('Audio non disponibile:', errore);
      this.ctx = null;
    }
  };

  A.alternaMuto = function () {
    this.muto = !this.muto;
    if (this.ctx) this.principale.gain.setTargetAtTime(this.muto ? 0 : CFG.audio.volume, this.ctx.currentTime, 0.05);
    return this.muto;
  };

  /* ------------------------ strumenti di base --------------------------- */

  /** Sorgente di rumore (eventualmente in loop). */
  A._sorgenteRumore = function (inLoop) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.rumore;
    s.loop = !!inLoop;
    if (inLoop) s.loopStart = 0;
    return s;
  };

  /** Filtro (tipo: 'lowpass', 'highpass', 'bandpass'). */
  A._filtro = function (tipo, frequenza, q) {
    const f = this.ctx.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frequenza;
    f.Q.value = q || 1;
    return f;
  };

  /** Inviluppo: il volume sale in "attacco" secondi e poi si spegne entro "durata". */
  A._inviluppo = function (t0, picco, attacco, durata) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(picco, t0 + attacco);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durata);
    return g;
  };

  /** Pan (sinistra/destra), se il browser lo supporta. */
  A._pan = function (valore) {
    if (!this.ctx.createStereoPanner) return null;
    const p = this.ctx.createStereoPanner();
    p.pan.value = U.limita(valore, -1, 1);
    return p;
  };

  /**
   * Calcola come si sente un suono che viene da (x, y):
   * volume (più basso se lontano), pan (destra/sinistra) e se è ovattato.
   */
  A._spaziale = function (x, y) {
    const L = this.ascoltatore;
    const dx = x - L.x, dy = y - L.y;
    const d = Math.hypot(dx, dy);
    const relativo = U.differenzaAngolo(L.angolo, Math.atan2(dy, dx)); // > 0 = a destra
    return {
      volume: 1 / (1 + 0.1 * d * d),
      pan: d < 0.3 ? 0 : Math.sin(relativo) * 0.85,
      ovattato: !G.Mondo.lineaDiVista(L.x, L.y, x, y, 1.0),
    };
  };

  /**
   * Crea la "catena di uscita" per un suono posizionato: volume → (filtro) → pan → altoparlanti.
   * Restituisce il nodo a cui collegare il suono.
   */
  A._uscita = function (x, y, volumeBase) {
    const s = this._spaziale(x, y);
    const g = this.ctx.createGain();
    g.gain.value = s.volume * volumeBase;
    let ultimo = g;
    if (s.ovattato) {
      const f = this._filtro('lowpass', 650, 0.7);
      ultimo.connect(f);
      ultimo = f;
    }
    const p = this._pan(s.pan);
    if (p) { ultimo.connect(p); ultimo = p; }
    ultimo.connect(this.principale);
    return g;
  };

  /** Una nota semplice. */
  A._nota = function (uscita, t0, frequenza, durata, volume, forma) {
    const o = this.ctx.createOscillator();
    o.type = forma || 'sine';
    o.frequency.value = frequenza;
    const inv = this._inviluppo(t0, volume, 0.01, durata);
    o.connect(inv);
    inv.connect(uscita);
    o.start(t0);
    o.stop(t0 + durata + 0.05);
  };

  /* --------------------------- suoni continui --------------------------- */

  /** Brusio di fondo della città con un leggero vento che va e viene. */
  A._ambiente = function () {
    const s = this._sorgenteRumore(true);
    const f = this._filtro('lowpass', 380, 0.5);
    const g = this.ctx.createGain();
    g.gain.value = 0.045;
    const lfo = this.ctx.createOscillator();     // oscillatore lentissimo per il vento
    lfo.frequency.value = 0.08;
    const profondita = this.ctx.createGain();
    profondita.gain.value = 0.025;
    lfo.connect(profondita);
    profondita.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.principale);
    s.start(); lfo.start();
  };

  /** Scroscio continuo di una fontana: il volume segue la distanza. */
  A._fontana = function (oggetto) {
    const s = this._sorgenteRumore(true);
    const f = this._filtro('bandpass', 1000, 0.8);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    s.connect(f); f.connect(g);
    let ultimo = g;
    const p = this._pan(0);
    if (p) { g.connect(p); ultimo = p; }
    ultimo.connect(this.principale);
    s.start(this.ctx.currentTime + Math.random());
    this.fontane.push({ oggetto, guadagno: g, pan: p, filtro: f });
  };

  /* ---------------------------- suoni brevi ----------------------------- */

  /** "Toc" del bastone sul selciato. */
  A.bastone = function () {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(650, t + 0.05);
    const inv = this._inviluppo(t, 0.22, 0.003, 0.09);
    o.connect(inv); inv.connect(this.principale);
    o.start(t); o.stop(t + 0.12);
    const r = this._sorgenteRumore(false);
    const f = this._filtro('bandpass', 3200, 2);
    const inv2 = this._inviluppo(t, 0.25, 0.002, 0.06);
    r.connect(f); f.connect(inv2); inv2.connect(this.principale);
    r.start(t, Math.random()); r.stop(t + 0.1);
  };

  /** Passo morbido (lato 0/1 = piede sinistro/destro). */
  A.passo = function (lato) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = this._sorgenteRumore(false);
    const f = this._filtro('lowpass', 480 + Math.random() * 250, 0.8);
    const inv = this._inviluppo(t, 0.085, 0.005, 0.1);
    const p = this._pan(lato ? 0.15 : -0.15);
    r.connect(f); f.connect(inv);
    if (p) { inv.connect(p); p.connect(this.principale); } else inv.connect(this.principale);
    r.start(t, Math.random()); r.stop(t + 0.14);
  };

  /** "Bau bau!" posizionato nel mondo. */
  A.abbaio = function (x, y) {
    if (!this.ctx) return;
    const uscita = this._uscita(x, y, 1.1);
    const t = this.ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      const t0 = t + k * 0.19;
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(560 + Math.random() * 40, t0);
      o.frequency.exponentialRampToValueAtTime(300, t0 + 0.11);
      const f = this._filtro('bandpass', 1100, 1.2);
      const inv = this._inviluppo(t0, 0.5, 0.006, 0.15);
      o.connect(f); f.connect(inv); inv.connect(uscita);
      o.start(t0); o.stop(t0 + 0.18);
      const r = this._sorgenteRumore(false);
      const f2 = this._filtro('bandpass', 1600, 1);
      const inv2 = this._inviluppo(t0, 0.18, 0.004, 0.08);
      r.connect(f2); f2.connect(inv2); inv2.connect(uscita);
      r.start(t0, Math.random()); r.stop(t0 + 0.1);
    }
  };

  /** Tintinnio dei ricordi da raccogliere. */
  A.scintilla = function (x, y) {
    if (!this.ctx) return;
    const uscita = this._uscita(x, y, 0.35);
    const t = this.ctx.currentTime;
    [1568, 2093, 2637].forEach((fr, k) => this._nota(uscita, t + k * 0.07, fr, 0.22, 0.2));
  };

  /** Arpeggio quando si raccoglie un ricordo. */
  A.raccolta = function () {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, k) => this._nota(this.principale, t + k * 0.09, fr, 0.4, 0.16, 'triangle'));
  };

  /** Melodia finale. */
  A.vittoria = function () {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const melodia = [[523.25, 0], [659.25, 0.18], [783.99, 0.36], [1046.5, 0.54], [783.99, 0.8], [1046.5, 0.98], [1318.5, 1.2]];
    for (const [fr, dt] of melodia) {
      this._nota(this.principale, t + dt, fr, 0.5, 0.14, 'triangle');
      this._nota(this.principale, t + dt, fr / 2, 0.5, 0.06, 'sine');
    }
  };

  /** Cinguettio di un uccellino. */
  A.uccellino = function (x, y) {
    if (!this.ctx) return;
    const uscita = this._uscita(x, y, 0.3);
    const t = this.ctx.currentTime;
    const volte = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1200;
    for (let k = 0; k < volte; k++) {
      const t0 = t + k * 0.13;
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t0);
      o.frequency.exponentialRampToValueAtTime(base * 1.45, t0 + 0.06);
      const inv = this._inviluppo(t0, 0.12, 0.005, 0.08);
      o.connect(inv); inv.connect(uscita);
      o.start(t0); o.stop(t0 + 0.1);
    }
  };

  /* ---------------------- aggiornamento continuo ------------------------ */
  A.aggiorna = function (dt, giocatore) {
    if (!this.ctx) return;
    const L = this.ascoltatore;
    L.x = giocatore.x; L.y = giocatore.y; L.angolo = giocatore.angolo;
    const t = this.ctx.currentTime;

    for (const f of this.fontane) {
      const s = this._spaziale(f.oggetto.x, f.oggetto.y);
      f.guadagno.gain.setTargetAtTime(0.3 * s.volume, t, 0.1);
      if (f.pan) f.pan.pan.setTargetAtTime(s.pan, t, 0.1);
      f.filtro.frequency.setTargetAtTime(s.ovattato ? 450 : 1000, t, 0.2);
    }

    // uccellini nel parco (si sentono anche un po' prima di entrarci)
    const z = G.Ambientazione.zonaUccellini;
    if (z && giocatore.x > z.x1 - 4) {
      this.timerUccelli -= dt;
      if (this.timerUccelli <= 0) {
        this.timerUccelli = 2 + Math.random() * 4;
        this.uccellino(z.x1 + Math.random() * (z.x2 - z.x1), z.y1 + Math.random() * (z.y2 - z.y1));
      }
    }
  };

  G.Audio = A;
})();
