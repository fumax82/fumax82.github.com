/* ==========================================================================
 *  input.js — COMANDI: TOUCH (ANDROID), TASTIERA E MOUSE
 *  --------------------------------------------------------------------------
 *  TELEFONO:
 *    metà sinistra   joystick che compare dove appoggi il dito
 *    metà destra     trascina per guardarti intorno, tocco breve = "toc toc"
 *    pulsanti        Toc!, azione (Parla/Entra/Prendi), vista, pausa
 *    tasto Indietro  pausa (Android)
 *  PC (per provare il gioco):
 *    WASD/frecce muoversi, mouse guardare, Spazio/clic bastone,
 *    E azione, V vista, Shift corsa, Esc pausa
 *
 *  Gli altri moduli chiedono "quanto si vuole andare avanti?"
 *  (leggiMovimento) oppure ascoltano eventi: Input.su('tocco', funzione).
 * ========================================================================== */
import { CONFIG } from '../config.js';

const RAGGIO_JOYSTICK = 60;

export const Input = {
  tasti: {},
  ascoltatori: {},
  sguardoDX: 0,
  sguardoDY: 0,
  joystick: { id: null, x0: 0, y0: 0, x: 0, y: 0 },
  dito: { id: null, ultimoX: 0, ultimoY: 0, inizioX: 0, inizioY: 0, inizioT: 0 },
  trascina: false,
  mossoTrascinando: 0,
  agganciato: false,
  ultimoTouch: 0,
  eTouch: false,
  attivo: true,
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
  this.elJoystick = document.getElementById('joystickBase');
  this.elPomello = document.getElementById('joystickPomello');

  // --- Tastiera -----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    this.tasti[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') this.emetti('tocco');
    if (e.code === 'KeyE') this.emetti('azione');
    if (e.code === 'KeyV' || e.code === 'KeyC') this.emetti('vista');
    if (e.code === 'Escape' || e.code === 'KeyP') this.emetti('pausa');
  });
  window.addEventListener('keyup', (e) => { this.tasti[e.code] = false; });
  window.addEventListener('blur', () => { this.tasti = {}; this.emetti('perdiFuoco'); });

  // --- Mouse (PC) ---------------------------------------------------------
  tela.addEventListener('mousedown', (e) => {
    if (Date.now() - this.ultimoTouch < 800 || e.button !== 0) return;
    if (this.agganciato) this.emetti('tocco');
    else { this.trascina = true; this.mossoTrascinando = 0; }
  });
  window.addEventListener('mouseup', () => {
    if (this.trascina && this.mossoTrascinando < 6) { this.emetti('tocco'); this.richiediAggancio(); }
    this.trascina = false;
  });
  window.addEventListener('mousemove', (e) => {
    const s = CONFIG.giocatore.sensibilitaMouse;
    if (this.agganciato) { this.sguardoDX += e.movementX * s; this.sguardoDY += e.movementY * s; }
    else if (this.trascina) {
      this.mossoTrascinando += Math.abs(e.movementX) + Math.abs(e.movementY);
      this.sguardoDX += e.movementX * s * 1.6;
      this.sguardoDY += e.movementY * s * 1.6;
    }
  });
  document.addEventListener('pointerlockchange', () => {
    this.agganciato = document.pointerLockElement === tela;
  });

  // --- Touch -------------------------------------------------------------
  tela.addEventListener('pointerdown', (e) => this._giu(e));
  tela.addEventListener('pointermove', (e) => this._muovi(e));
  tela.addEventListener('pointerup', (e) => this._su(e));
  tela.addEventListener('pointercancel', (e) => this._su(e));

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

Input.richiediAggancio = function () {
  if (this.eTouch || !this.tela.requestPointerLock) return;
  try {
    const r = this.tela.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch (err) { /* non supportato: si usa il trascinamento */ }
};

Input.rilasciaAggancio = function () {
  if (document.exitPointerLock && this.agganciato) document.exitPointerLock();
};

Input._giu = function (e) {
  if (e.pointerType !== 'touch') return;
  e.preventDefault();
  this.ultimoTouch = Date.now();
  if (e.clientX < window.innerWidth * 0.42 && this.joystick.id === null) {
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

Input._muovi = function (e) {
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
    const s = CONFIG.giocatore.sensibilitaTouch;
    this.sguardoDX += (e.clientX - d.ultimoX) * s;
    this.sguardoDY += (e.clientY - d.ultimoY) * s;
    d.ultimoX = e.clientX;
    d.ultimoY = e.clientY;
  }
};

Input._su = function (e) {
  if (e.pointerType !== 'touch') return;
  this.ultimoTouch = Date.now();
  const j = this.joystick, d = this.dito;
  if (e.pointerId === j.id) {
    j.id = null; j.x = 0; j.y = 0;
    if (this.elJoystick) this.elJoystick.classList.remove('attivo');
  } else if (e.pointerId === d.id) {
    const breve = performance.now() - d.inizioT < 260;
    const fermo = Math.hypot(e.clientX - d.inizioX, e.clientY - d.inizioY) < 14;
    if (breve && fermo) this.emetti('tocco');
    d.id = null;
  }
};

/** { avanti, laterale, rotazione, corsa } con valori tra -1 e 1. */
Input.leggiMovimento = function () {
  const t = this.tasti;
  let avanti = 0, laterale = 0, rotazione = 0;
  if (t.KeyW || t.ArrowUp) avanti += 1;
  if (t.KeyS || t.ArrowDown) avanti -= 1;
  if (t.KeyD) laterale += 1;
  if (t.KeyA) laterale -= 1;
  if (t.ArrowRight) rotazione += 1;
  if (t.ArrowLeft) rotazione -= 1;
  let corsa = !!(t.ShiftLeft || t.ShiftRight);
  const j = this.joystick;
  if (j.id !== null) {
    const forza = Math.hypot(j.x, j.y);
    if (forza > 0.12) { avanti += -j.y; laterale += j.x * 0.85; }
    if (forza > 0.94) corsa = true;
  }
  return { avanti, laterale, rotazione, corsa };
};

Input.consumaSguardo = function () {
  const r = { dx: this.sguardoDX, dy: this.sguardoDY };
  this.sguardoDX = 0;
  this.sguardoDY = 0;
  return r;
};

/** Azzera tutto (per esempio quando si apre un dialogo). */
Input.azzera = function () {
  this.consumaSguardo();
  this.joystick.x = this.joystick.y = 0;
};
