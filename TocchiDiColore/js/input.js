/* ==========================================================================
 *  input.js — COMANDI: TASTIERA, MOUSE E TOUCH
 *  --------------------------------------------------------------------------
 *  PC:
 *    W A S D / frecce   muoversi (A/D di lato, frecce sinistra/destra ruotano)
 *    Q / E              ruotare
 *    Mouse              guardarsi intorno (clicca sul gioco per "agganciarlo")
 *    Spazio o clic      battere il bastone
 *    Shift              correre
 *    V                  prima / terza persona
 *    M                  mappa mentale
 *
 *  TELEFONO / TABLET:
 *    metà sinistra      joystick che compare dove appoggi il dito
 *    metà destra        trascina per guardarti intorno, tocco breve = bastone
 *
 *  Gli altri moduli non leggono direttamente i tasti: chiedono a Input
 *  "quanto si vuole andare avanti?" (leggiMovimento) oppure si mettono in
 *  ascolto di un evento con Input.su('tocco', funzione).
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const CFG = G.Config;

  const RAGGIO_JOYSTICK = 55; // pixel

  const I = {
    tasti: {},
    ascoltatori: {},
    sguardoDX: 0,
    sguardoDY: 0,
    joystick: { id: null, x0: 0, y0: 0, x: 0, y: 0 },
    dito: { id: null, ultimoX: 0, ultimoY: 0, inizioX: 0, inizioY: 0, inizioT: 0 },
    trascinamento: false,  // mouse premuto senza aggancio del puntatore
    agganciato: false,     // il puntatore del mouse è "agganciato" al gioco
    ultimoTouch: 0,
    tela: null,
    eTouch: false,
  };

  /* ------------------------- piccolo sistema di eventi ------------------ */
  I.su = function (nome, funzione) {
    (this.ascoltatori[nome] = this.ascoltatori[nome] || []).push(funzione);
  };
  I.emetti = function (nome) {
    for (const funzione of this.ascoltatori[nome] || []) funzione();
  };

  /* ----------------------------- preparazione --------------------------- */
  I.inizializza = function (tela) {
    this.tela = tela;
    this.eTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.elJoystick = document.getElementById('joystickBase');
    this.elPomello = document.getElementById('joystickPomello');

    // --- Tastiera ------------------------------------------------------
    window.addEventListener('keydown', (e) => {
      this.tasti[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Space') this.emetti('tocco');
      if (e.code === 'KeyV' || e.code === 'KeyC') this.emetti('vista');
      if (e.code === 'KeyM') this.emetti('mappa');
    });
    window.addEventListener('keyup', (e) => { this.tasti[e.code] = false; });
    window.addEventListener('blur', () => { this.tasti = {}; });

    // --- Mouse ---------------------------------------------------------
    tela.addEventListener('mousedown', (e) => {
      if (Date.now() - this.ultimoTouch < 800 || e.button !== 0) return; // ignora i "falsi clic" dopo un tocco
      if (this.agganciato) this.emetti('tocco');
      else { this.trascinamento = true; this.mossoTrascinando = 0; }
    });
    window.addEventListener('mouseup', () => {
      if (this.trascinamento && this.mossoTrascinando < 6) {
        this.emetti('tocco');
        this.richiediAggancio();
      }
      this.trascinamento = false;
    });
    window.addEventListener('mousemove', (e) => {
      const s = CFG.giocatore.sensibilitaMouse;
      if (this.agganciato) {
        this.sguardoDX += e.movementX * s;
        this.sguardoDY += e.movementY * s;
      } else if (this.trascinamento) {
        this.mossoTrascinando += Math.abs(e.movementX) + Math.abs(e.movementY);
        this.sguardoDX += e.movementX * s * 1.5;
        this.sguardoDY += e.movementY * s * 1.5;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.agganciato = document.pointerLockElement === tela;
      this.emetti('aggancio');
    });

    // --- Touch (con i "pointer events", che funzionano su tutti i browser moderni)
    tela.addEventListener('pointerdown', (e) => this._ditoGiu(e));
    tela.addEventListener('pointermove', (e) => this._ditoMuove(e));
    tela.addEventListener('pointerup', (e) => this._ditoSu(e));
    tela.addEventListener('pointercancel', (e) => this._ditoSu(e));
  };

  /** Chiede al browser di "agganciare" il mouse (solo su PC). */
  I.richiediAggancio = function () {
    if (this.eTouch || !this.tela.requestPointerLock) return;
    try {
      const r = this.tela.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (err) { /* alcuni browser non lo permettono: si usa il trascinamento */ }
  };

  I._ditoGiu = function (e) {
    if (e.pointerType !== 'touch') return;
    e.preventDefault();
    this.ultimoTouch = Date.now();
    if (e.clientX < window.innerWidth * 0.42 && this.joystick.id === null) {
      // joystick: compare dove si appoggia il dito
      const j = this.joystick;
      j.id = e.pointerId; j.x0 = e.clientX; j.y0 = e.clientY; j.x = 0; j.y = 0;
      if (this.elJoystick) {
        this.elJoystick.style.left = e.clientX + 'px';
        this.elJoystick.style.top = e.clientY + 'px';
        this.elJoystick.classList.add('attivo');
        this.elPomello.style.transform = 'translate(-50%, -50%)';
      }
    } else if (this.dito.id === null) {
      const d = this.dito;
      d.id = e.pointerId; d.ultimoX = d.inizioX = e.clientX; d.ultimoY = d.inizioY = e.clientY;
      d.inizioT = performance.now();
    }
  };

  I._ditoMuove = function (e) {
    if (e.pointerType !== 'touch') return;
    this.ultimoTouch = Date.now();
    const j = this.joystick, d = this.dito;
    if (e.pointerId === j.id) {
      let dx = e.clientX - j.x0, dy = e.clientY - j.y0;
      const l = Math.hypot(dx, dy);
      if (l > RAGGIO_JOYSTICK) { dx *= RAGGIO_JOYSTICK / l; dy *= RAGGIO_JOYSTICK / l; }
      j.x = dx / RAGGIO_JOYSTICK;
      j.y = dy / RAGGIO_JOYSTICK;
      if (this.elPomello) this.elPomello.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    } else if (e.pointerId === d.id) {
      const s = CFG.giocatore.sensibilitaTouch;
      this.sguardoDX += (e.clientX - d.ultimoX) * s;
      this.sguardoDY += (e.clientY - d.ultimoY) * s;
      d.ultimoX = e.clientX;
      d.ultimoY = e.clientY;
    }
  };

  I._ditoSu = function (e) {
    if (e.pointerType !== 'touch') return;
    this.ultimoTouch = Date.now();
    const j = this.joystick, d = this.dito;
    if (e.pointerId === j.id) {
      j.id = null; j.x = 0; j.y = 0;
      if (this.elJoystick) this.elJoystick.classList.remove('attivo');
    } else if (e.pointerId === d.id) {
      // un tocco breve e quasi fermo = colpo di bastone
      const breve = performance.now() - d.inizioT < 250;
      const fermo = Math.hypot(e.clientX - d.inizioX, e.clientY - d.inizioY) < 14;
      if (breve && fermo) this.emetti('tocco');
      d.id = null;
    }
  };

  /* ------------------------ lettura dei comandi ------------------------- */

  /** Restituisce { avanti, laterale, rotazione, corsa } (valori tra -1 e 1). */
  I.leggiMovimento = function () {
    const t = this.tasti;
    let avanti = 0, laterale = 0, rotazione = 0;
    if (t.KeyW || t.ArrowUp) avanti += 1;
    if (t.KeyS || t.ArrowDown) avanti -= 1;
    if (t.KeyD) laterale += 1;
    if (t.KeyA) laterale -= 1;
    if (t.ArrowRight || t.KeyE) rotazione += 1;
    if (t.ArrowLeft || t.KeyQ) rotazione -= 1;
    let corsa = !!(t.ShiftLeft || t.ShiftRight);

    const j = this.joystick;
    if (j.id !== null) {
      const intensita = Math.hypot(j.x, j.y);
      if (intensita > 0.12) {                 // piccola "zona morta" al centro
        avanti += -j.y;
        laterale += j.x * 0.8;
      }
      if (intensita > 0.93) corsa = true;     // joystick spinto al massimo = corsa
    }
    return { avanti, laterale, rotazione, corsa };
  };

  /** Restituisce lo spostamento dello sguardo accumulato e lo azzera. */
  I.consumaSguardo = function () {
    const r = { dx: this.sguardoDX, dy: this.sguardoDY };
    this.sguardoDX = 0;
    this.sguardoDY = 0;
    return r;
  };

  G.Input = I;
})();
