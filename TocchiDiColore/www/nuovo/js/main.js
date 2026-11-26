/* ==========================================================================
 *  main.js — L'AVVIO E IL "CUORE CHE BATTE" (il ciclo dei fotogrammi)
 *  --------------------------------------------------------------------------
 *  Prototipo del NUOVO MOTORE di "Tocchi di Colore": un mondo 3D vero,
 *  dipinto ad acquerello in tempo reale.
 *
 *  Qui si mettono insieme i pezzi:
 *    acquerello3d.js  il pittore (materiali e rifinitura)
 *    mondo.js         la via con le case
 *    personaggi3d.js  Lia e Gogo
 *    camera.js        il regista
 *    magia.js         che cosa succede quando il bambino tocca
 *  e poi, 60 volte al secondo: muovi tutto → dipingi → ricomincia.
 *
 *  Opzioni nell'indirizzo (per le prove):
 *    ?q=minima|bassa|media|alta   qualità di partenza
 *    &fisso=1                     non cambiare qualità da solo
 *    &debug=1                     mostra i fotogrammi al secondo
 * ========================================================================== */
import * as THREE from 'three';
import { clamp, lerp, caso, morbido } from './utili.js';
import { U, creaTexture, creaCielo, Acquerello, Rivelazione, RivelazioneCielo } from './acquerello3d.js';
import { creaMondo, ZF } from './mondo.js';
import { Lia, Gogo } from './personaggi3d.js';
import { Regista } from './camera.js';
import { Magia } from './magia.js';
import { Audio } from '../../js/gioco/audio.js';
import { Musica } from '../../js/gioco/musica.js';

const parametri = new URLSearchParams(location.search);
const tela = document.getElementById('tela');
const misure = document.getElementById('misure');

/* ------------------------------------------------------------------------ */
/*  1. IL DISEGNATORE (WebGL 2)                                              */
/* ------------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
renderer.autoClear = false;
renderer.info.autoReset = false;      // contiamo i disegni di tutto il fotogramma
renderer.setClearColor(0xfbf6ea, 1);
creaTexture();
const acquerello = new Acquerello(renderer);

/* ------------------------------------------------------------------------ */
/*  2. LA SCENA                                                              */
/* ------------------------------------------------------------------------ */
const scena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, U.uFar.value);
camera.userData.rettangolo = { left: 0, top: 0, width: 1, height: 1 };
const cupola = creaCielo();
scena.add(cupola);
const rivelazione = new Rivelazione();
const cielo = new RivelazioneCielo();
const mondo = creaMondo(scena);
const lia = new Lia(scena);
const gogo = new Gogo(scena);
const regista = new Regista(camera);
regista.ostacoli = mondo.curiosita.filter((c) => c.z < 8).map((c) => ({ x: c.x, z: c.z, r: 0.55 }));
const magia = new Magia(scena, { camera, mondo, rivelazione, cielo, lia, gogo, regista });
acquerello.punti = magia.scintille.mat;

// I "toc" del bastone di Lia: ogni colpetto colora un pezzetto di mondo
let quantiToc = 0;
lia.suToc = (p) => {
  quantiToc++;
  if (p.z < ZF + 0.1) return;
  rivelazione.onda(p.x, p.z, 1.15 + Math.random() * 0.4, 3.5, caso(0, 1));
  if (quantiToc % 2 === 0) Audio.tocco('pietra', p.x, p.z);     // "toc... toc...": un colpo sì e uno no
  magia.scintille.emetti({ p: p.clone().setY(p.y + 0.03), colore: [1, 0.95, 0.75], forma: 3, vita: 0.5, dim: 0.22, grav: 0, attr: 0, rotV: 0, alfa: 0.8 });
};
lia.suPasso = (lato) => Audio.passo('pietra', lato);
lia.suBussa = (p) => {
  setTimeout(() => {
    rivelazione.onda(p.x, p.z + 0.2, 3.2, 4, caso(0, 1));
    Audio.tocco('intonaco', p.x, p.z);
    magia.scintille.sbuffo(p, 8, 1.2, { normale: new THREE.Vector3(0, 0, 1) });
    Audio.nota(magia.nota++, 0.25);
  }, 450);
};
// l'abbaio di Gogo è un suono... e i suoni colorano il mondo!
gogo.suAbbaio = (p, colora) => {
  Audio.abbaio(p.x, p.z, 2);
  lia.guarda(p.clone().setY(0.4), 1.5);
  if (colora) {
    rivelazione.onda(p.x, p.z, 4.2, 5, 0.07);
    magia.scintille.sbuffo(p.clone().setY(p.y + 0.5), 6, 1.2, { colore: [1.0, 0.72, 0.5] });
  }
  magia.uccelli.spaventa(p, 4);
};

/* ------------------------------------------------------------------------ */
/*  3. LA QUALITÀ (si adatta da sola se il telefono fa fatica)               */
/* ------------------------------------------------------------------------ */
const LIVELLI = [
  { nome: 'minima', dpr: 0.75, scala: 0.8, msaa: 0, dettaglio: 0 },
  { nome: 'bassa', dpr: 1.0, scala: 0.8, msaa: 0, dettaglio: 0 },
  { nome: 'media', dpr: 1.5, scala: 0.75, msaa: 0, dettaglio: 1 },
  { nome: 'alta', dpr: 2.0, scala: 0.8, msaa: 4, dettaglio: 1 },
];
const telefono = matchMedia('(pointer: coarse)').matches;
let livello = Math.max(0, LIVELLI.findIndex((l) => l.nome === parametri.get('q')));
if (!parametri.get('q')) livello = telefono ? 2 : 3;
const adattivo = !parametri.get('fisso');
let livelloMassimo = 3, salito = false;

function ridimensiona() {
  const L = LIVELLI[livello];
  const w = window.innerWidth, h = window.innerHeight;
  const dpr = Math.min(L.dpr, window.devicePixelRatio || 1);
  acquerello.imposta(w, h, dpr, L.scala, L.msaa);
  acquerello.matFinale.uniforms.uDettaglio.value = L.dettaglio;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const r = tela.getBoundingClientRect();
  camera.userData.rettangolo = { left: r.left, top: r.top, width: r.width || w, height: r.height || h };
}
window.addEventListener('resize', ridimensiona);
ridimensiona();

// misura dei tempi: media degli ultimi fotogrammi
const tempi = [];
let ultimoCambio = 0;
function controllaQualita(dtVero, t) {
  tempi.push(dtVero);
  if (tempi.length > 90) tempi.shift();
  if (!adattivo || t - ultimoCambio < 4 || tempi.length < 90) return;
  const media = tempi.reduce((a, b) => a + b, 0) / tempi.length;
  if (media > 1 / 38 && livello > 0) {            // troppo lento: scendi di un gradino
    livello--; ultimoCambio = t; tempi.length = 0; ridimensiona();
    if (salito) livelloMassimo = livello;           // era salito e poi ha rallentato: non ci riprova più
  } else if (media < 1 / 57 && livello < livelloMassimo && t - ultimoCambio > 8) {   // va benissimo: prova a salire
    livello++; ultimoCambio = t; tempi.length = 0; ridimensiona(); salito = true;
  }
}

/* ------------------------------------------------------------------------ */
/*  4. IL TOCCO (dita e mouse)                                               */
/* ------------------------------------------------------------------------ */
let audioPronto = false;
const dita = new Map();
let tempo = 0;
function avviaAudio() {
  if (audioPronto) return;
  audioPronto = true;
  try { Audio.avvia(); Musica.suona('passeggiata'); } catch (e) { console.warn('audio', e); }
}
tela.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  avviaAudio();
  dita.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, mosso: false });
  magia.tocco(e.clientX, e.clientY);
});
tela.addEventListener('pointermove', (e) => {
  const d = dita.get(e.pointerId);
  if (!d) return;
  d.x = e.clientX; d.y = e.clientY;
  if (Math.hypot(d.x - d.x0, d.y - d.y0) > 25) d.mosso = true;
  if (d.mosso) magia.trascina(d.x, d.y, tempo);
});
const fine = (e) => dita.delete(e.pointerId);
tela.addEventListener('pointerup', fine);
tela.addEventListener('pointercancel', fine);
tela.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (Audio.ctx) Audio.sospendi(document.hidden); });

/* ------------------------------------------------------------------------ */
/*  5. IL CICLO DEI FOTOGRAMMI                                               */
/* ------------------------------------------------------------------------ */
const _f = new THREE.Vector3();
let prima = performance.now();
let inizio = 0;
let fotogrammi = 0, tempoMisura = 0, fps = 0;

/** Muove tutto il mondo di dt secondi (senza disegnare). */
function avanza(dt) {
  tempo += dt;
  U.uTempo.value = tempo;
  lia.aggiorna(dt, tempo, mondo);
  gogo.aggiorna(dt, tempo, mondo, lia);
  magia.aggiorna(dt, tempo);
  rivelazione.aggiorna(dt);
  cielo.aggiorna(dt);
  mondo.aggiorna(dt, tempo);
  regista.aggiorna(dt, tempo, lia, gogo);
  // il cielo si colora piano piano quando tanta città è dipinta
  const voluto = morbido(0.18, 0.6, rivelazione.frazione());
  U.uCielo.value = lerp(U.uCielo.value, voluto, 1 - Math.exp(-dt * 0.5));
  cupola.position.copy(camera.position);
}

function disegna() {
  renderer.info.reset();
  const u = acquerello.matFinale.uniforms;
  u.uFuoco.value = regista.fuoco;
  u.uApertura.value = regista.aperturaAttuale !== undefined ? regista.aperturaAttuale : 0.4;
  u.uBianco.value = 1 - morbido(0.2, 1.8, tempo);       // all'inizio: la carta bianca che si "accende"
  acquerello.disegna(scena, camera);
}

function ciclo(adesso) {
  requestAnimationFrame(ciclo);
  const dtVero = Math.min(0.5, (adesso - prima) / 1000);
  prima = adesso;
  if (window.Nuovo.pausa) return;
  const dt = Math.min(dtVero, window.Nuovo.dtMassimo);
  avanza(dt);
  // l'orecchio sta dove sta Lia e guarda dove guarda la telecamera
  camera.getWorldDirection(_f);
  Audio.aggiorna(lia.pos.x, lia.pos.z, Math.atan2(_f.z, _f.x));
  Musica.aggiorna();
  disegna();
  controllaQualita(dtVero, tempo);
  fotogrammi++; tempoMisura += dtVero;
  if (tempoMisura > 1) { fps = fotogrammi / tempoMisura; fotogrammi = 0; tempoMisura = 0; if (misure.style.display === 'block') misure.textContent = `${fps.toFixed(0)} fps · ${LIVELLI[livello].nome} · ${acquerello.dimensioni.sw}×${acquerello.dimensioni.sh} · ${renderer.info.render.calls} disegni`; }
}

/* ------------------------------------------------------------------------ */
/*  6. PER LE PROVE AUTOMATICHE (e per curiosare dalla console)              */
/* ------------------------------------------------------------------------ */
window.Nuovo = {
  pausa: false,
  dtMassimo: 0.1,
  pronto: true,
  /** Simula un tocco in (x, y) pixel dello schermo. */
  tocca: (x, y) => { magia.tocco(x, y); },
  /** Fa passare il tempo (in piccoli passi) senza aspettare. */
  avanti: (secondi, passo = 1 / 30) => { for (let t = 0; t < secondi; t += passo) avanza(passo); disegna(); },
  inquadratura: (nome) => { regista.forzata = nome || null; if (nome) regista.inquadratura = nome; },
  primoPiano: (chi) => regista.primoPiano(chi, null, 4),
  rivelaTutto: () => { rivelazione.rivelaTutto(); cielo.rivelaTutto(); U.uCielo.value = 1; },
  qualita: (nome) => { livello = Math.max(0, LIVELLI.findIndex((l) => l.nome === nome)); ridimensiona(); },
  stato: () => ({ fps, livello: LIVELLI[livello].nome, frazione: rivelazione.frazione(), inquadratura: regista.forzata || regista.inquadratura, lia: lia.pos.toArray(), gogo: gogo.stato, disegni: renderer.info.render.calls, triangoli: renderer.info.render.triangles, vertici: mondo.vertici, dimensioni: acquerello.dimensioni }),
  schermo: (p) => { const v = new THREE.Vector3(...p).project(camera); const r = camera.userData.rettangolo; return [(v.x + 1) / 2 * r.width + r.left, (1 - v.y) / 2 * r.height + r.top]; },
  lia, gogo, regista, camera, mondo, rivelazione, magia, U, acquerello, scena, renderer,
};
if (parametri.get('debug')) misure.style.display = 'block';
requestAnimationFrame((t) => { prima = t; inizio = t; ciclo(t); });
