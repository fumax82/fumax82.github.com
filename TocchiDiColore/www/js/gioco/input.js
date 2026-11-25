/* ==========================================================================
 *  input.js — COMANDI: TOUCH (ANDROID), TASTIERA E MOUSE
 *  --------------------------------------------------------------------------
 *  TELEFONO:
 *    frecce ◀ ▶ in basso a sinistra   camminare (tenendo premuto a lungo si corre)
 *    pulsante Toc!                     batte il bastone ("toc toc")
 *    tocco breve sullo schermo         anche questo batte il bastone
 *    pulsante azione                   Parla / Entra / Tocca... (compare quando serve)
 *    tasto Indietro di Android         pausa
 *  PC (per provare il gioco):
 *    A/D o frecce ← → camminare, Shift correre, Spazio o clic bastone,
 *    E (o freccia ↑) azione, Esc pausa
 *
 *  Gli altri moduli chiedono "da che parte si vuole andare?" (direzione:
 *  -1 sinistra, 0 fermi, +1 destra) oppure ascoltano eventi:
 *  Input.su('tocco', funzione).
 * ========================================================================== */

export const Input = {
  tasti: {},
  ascoltatori: {},
  sinistraPremuta: 0,   // quante dita premono la freccia sinistra
  destraPremuta: 0,
  dito: { id: null, x: 0, y: 0, t: 0 },
  ultimoTouch: 0,
  eTouch: false,
};

Input.su = function (nome, funzione) {
  (this.ascoltatori[nome] = this.ascoltatori[nome] || []).push(funzione);
};

Input.emetti = function (nome, dato) {
  for (const f of this.ascoltatori[nome] || []) f(dato);
};

Input.inizializza = function (tela) {
  this.tela = tela;
  this.eTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // --- Tastiera -----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    this.tasti[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') this.emetti('tocco');
    if (e.code === 'KeyE' || e.code === 'ArrowUp' || e.code === 'KeyW') this.emetti('azione');
    if (e.code === 'Escape' || e.code === 'KeyP') this.emetti('pausa');
  });
  window.addEventListener('keyup', (e) => { this.tasti[e.code] = false; });
  window.addEventListener('blur', () => { this.tasti = {}; this.sinistraPremuta = this.destraPremuta = 0; this.emetti('perdiFuoco'); });

  // --- Frecce sullo schermo ----------------------------------------------
  const freccia = (id, lato) => {
    const b = document.getElementById(id);
    if (!b) return;
    const dita = new Set();
    const aggiorna = () => {
      this[lato] = dita.size;
      b.classList.toggle('premuto', dita.size > 0);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      dita.add(e.pointerId);
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* niente */ }
      aggiorna();
    });
    const via = (e) => { dita.delete(e.pointerId); aggiorna(); };
    b.addEventListener('pointerup', via);
    b.addEventListener('pointercancel', via);
    b.addEventListener('lostpointercapture', via);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  freccia('btnSinistra', 'sinistraPremuta');
  freccia('btnDestra', 'destraPremuta');

  // --- Tocco breve (o clic) sulla scena = "toc toc" ------------------------
  tela.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const d = this.dito;
    d.id = e.pointerId; d.x = e.clientX; d.y = e.clientY; d.t = performance.now();
  });
  tela.addEventListener('pointerup', (e) => {
    const d = this.dito;
    if (e.pointerId !== d.id) return;
    const breve = performance.now() - d.t < 320;
    const fermo = Math.hypot(e.clientX - d.x, e.clientY - d.y) < 16;
    if (breve && fermo) this.emetti('tocco');
    d.id = null;
  });

  // --- Tasto "Indietro" di Android (tramite Capacitor, se presente) -------
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.registerPlugin) {
    try {
      const App = cap.registerPlugin('App');
      App.addListener('backButton', () => this.emetti('pausa'));
      App.addListener('pause', () => this.emetti('perdiFuoco'));
    } catch (err) { console.warn('Plugin App non disponibile', err); }
  }
};

/** Da che parte si vuole andare SULLO SCHERMO: -1 sinistra, 0 fermi, +1 destra. */
Input.direzione = function () {
  const t = this.tasti;
  let d = 0;
  if (t.KeyA || t.ArrowLeft || this.sinistraPremuta) d -= 1;
  if (t.KeyD || t.ArrowRight || this.destraPremuta) d += 1;
  return d;
};

/** Shift premuto (corsa, solo da tastiera: al telefono si corre tenendo premuto). */
Input.corsa = function () {
  return !!(this.tasti.ShiftLeft || this.tasti.ShiftRight);
};

/** Azzera tutto (per esempio quando si apre un dialogo). */
Input.azzera = function () {
  this.tasti = {};
};
