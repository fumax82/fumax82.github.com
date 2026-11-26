/* ==========================================================================
 *  mappa_volo.js — LA CITTÀ VISTA DALLA BALENA
 *  --------------------------------------------------------------------------
 *  Nel cortometraggio, dal dorso della balena si vede la città dall'alto:
 *  tante casette colorate fitte fitte, e in mezzo il fiume che è diventato
 *  una strada tortuosa piena di macchinine.
 *
 *  Qui la dipingiamo come una grande MAPPA ad acquerello, stesa per terra
 *  (in due fogli, perché ogni foglio può essere al massimo 2048 pixel).
 *  La balena vola dal fondo (z = +150) verso z = -150: in alto nel foglio
 *  c'è ciò che è più lontano, così le facciate delle case (dipinte sotto
 *  ai tetti) sono proprio quelle che la telecamera vede.
 *
 *  Coordinate: x da -60 a +60 metri, z da -150 a +150 metri.
 * ========================================================================== */
import { nuovaTela, casuale, tra, scurisci, schiarisci, STILE, granula, sfumaBordi, respira } from './pennello.js';

export const AREA = { x0: -60, x1: 60, z0: -150, z1: 150 };
const PX = 12.8;   // pixel per metro

/** Il fiume-strada: x in funzione di z (una curva morbida). */
export function fiumeX(z) {
  return Math.sin(z * 0.023) * 17 + Math.sin(z * 0.061 + 1.3) * 5;
}
export const MEZZA_LARGHEZZA_FIUME = 6.5;   // metri
const MARCIAPIEDE = 3.2;                    // metri di riva rosa ai lati

// la piazzetta gialla dove corre Gogo (vicino alla fine del volo)
export const PIAZZETTA = { x: fiumeX(-118) + 22, z: -118, r: 9 };

const FACCIATE = ['#f2b9b3', '#f5dc8f', '#b9d9e6', '#c4e5cc', '#f6c89f', '#d9c7ef', '#fbe7c6', '#f7c6d8', '#cfe3b5', '#f4c0a0'];
const TETTI = ['#d9785e', '#c2654f', '#e08b6a', '#7f8fbf', '#9a7fb8', '#6f9f86', '#e0a05a', '#b86f6f', '#d26f5a'];
const AUTO = ['#f5d04e', '#e36b5e', '#4f6fa8', '#f2a541', '#7fc2a8', '#f7f2e6'];

/** Da metri a pixel del foglio intero (alto 300 m). */
const mx = (x) => (x - AREA.x0) * PX;
const mz = (z) => (z - AREA.z0) * PX;

/* ------------------------------------------------------------------------ */
/*  Pezzi di città                                                          */
/* ------------------------------------------------------------------------ */

/** Una casetta vista dall'alto e un po' di sbieco: tetto sopra, facciata sotto. */
function casetta(c, x, z, l, p, h, rng) {
  const X = mx(x), Z = mz(z), L = l * PX, P = p * PX, H = h * PX * 0.42;
  const facciata = FACCIATE[Math.floor(rng() * FACCIATE.length)];
  const tetto = TETTI[Math.floor(rng() * TETTI.length)];
  c.lineWidth = 1.6;
  c.strokeStyle = STILE.inchiostro;
  c.lineJoin = 'round';
  // ombra morbida verso destra-giù
  c.fillStyle = 'rgba(90, 70, 110, 0.16)';
  c.fillRect(X + 4, Z + 4, L, P + H);
  // facciata (la parte rivolta verso di noi)
  c.fillStyle = facciata;
  c.fillRect(X, Z + P, L, H);
  c.fillStyle = scurisci(facciata, 0.12);
  c.fillRect(X, Z + P + H * 0.82, L, H * 0.18);
  // finestrelle e porta
  const nf = Math.max(1, Math.floor(l / 1.8));
  for (let k = 0; k < nf; k++) {
    const fx = X + (k + 0.5) * (L / nf) - 3;
    c.fillStyle = rng() < 0.8 ? '#8fb9d8' : '#ffffff';
    c.fillRect(fx, Z + P + H * 0.22, 6, Math.max(4, H * 0.3));
  }
  if (rng() < 0.6) { c.fillStyle = scurisci(facciata, 0.35); c.fillRect(X + L * 0.5 - 3, Z + P + H * 0.55, 7, H * 0.45); }
  c.strokeRect(X, Z + P, L, H);
  // tetto: due falde con il colmo, tegole accennate
  c.fillStyle = tetto;
  c.fillRect(X - 1.5, Z, L + 3, P);
  c.fillStyle = schiarisci(tetto, 0.18);
  c.fillRect(X - 1.5, Z, L + 3, P * 0.5);
  c.strokeStyle = conAlfaInk(0.45);
  c.lineWidth = 1;
  for (let k = 4; k < P - 2; k += 5) { c.beginPath(); c.moveTo(X, Z + k); c.lineTo(X + L, Z + k); c.stroke(); }
  c.strokeStyle = STILE.inchiostro;
  c.lineWidth = 1.6;
  c.strokeRect(X - 1.5, Z, L + 3, P);
  c.beginPath(); c.moveTo(X - 1.5, Z + P * 0.5); c.lineTo(X + L + 1.5, Z + P * 0.5); c.stroke();
  // comignolo
  if (rng() < 0.35) {
    c.fillStyle = scurisci(tetto, 0.25);
    c.fillRect(X + L * 0.7, Z + P * 0.15, 5, 7);
    c.strokeRect(X + L * 0.7, Z + P * 0.15, 5, 7);
  }
}

const conAlfaInk = (a) => 'rgba(107, 75, 55, ' + a + ')';

/** Un albero tondo visto dall'alto. */
function albero(c, x, z, r, rng) {
  const X = mx(x), Z = mz(z), R = r * PX;
  const verdi = ['#8fc27f', '#7ab06f', '#a9d38f', '#9ccc8f'];
  const v = verdi[Math.floor(rng() * verdi.length)];
  c.fillStyle = 'rgba(80, 90, 70, 0.18)';
  c.beginPath(); c.ellipse(X + 4, Z + 5, R, R * 0.9, 0, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    c.fillStyle = k % 2 ? v : scurisci(v, 0.08);
    c.beginPath(); c.arc(X + Math.cos(a) * R * 0.35, Z + Math.sin(a) * R * 0.35, R * 0.68, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = schiarisci(v, 0.25);
  c.beginPath(); c.arc(X - R * 0.25, Z - R * 0.3, R * 0.35, 0, Math.PI * 2); c.fill();
  c.strokeStyle = conAlfaInk(0.7);
  c.lineWidth = 1.4;
  c.beginPath(); c.arc(X, Z, R * 0.98, 0, Math.PI * 2); c.stroke();
}

/** Una macchinina vista dall'alto. */
function macchinina(c, x, z, colore) {
  const X = mx(x), Z = mz(z);
  c.fillStyle = colore;
  c.strokeStyle = STILE.inchiostro;
  c.lineWidth = 1.4;
  c.beginPath(); c.roundRect(X - 7, Z - 12, 14, 24, 5); c.fill(); c.stroke();
  c.fillStyle = '#d8ecf6';
  c.fillRect(X - 5, Z - 7, 10, 5);
  c.fillRect(X - 5, Z + 3, 10, 4);
}

/** Tela piccola con una macchinina dall'alto (per quelle che si muovono). */
export function telaMacchinina(colore) {
  const t = nuovaTela(32, 48), c = t.getContext('2d');
  c.translate(16 - mx(0), 24 - mz(0));
  macchinina(c, 0, 0, colore);
  return t;
}

/** Tela del puntino giallo che corre: Gogo visto dall'alto. */
export function telaGogo() {
  const t = nuovaTela(48, 48), c = t.getContext('2d');
  c.fillStyle = 'rgba(255, 240, 160, 0.55)';
  c.beginPath(); c.arc(24, 24, 22, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f6e7bd'; c.strokeStyle = STILE.inchiostro; c.lineWidth = 2;
  c.beginPath(); c.ellipse(24, 26, 7, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#d79b5c';
  c.beginPath(); c.ellipse(19, 17, 3, 5, -0.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(29, 17, 3, 5, 0.4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#f7b6c8';
  c.beginPath(); c.arc(24, 12, 4, 0, Math.PI * 2); c.fill(); c.stroke();   // la borsa rosa in bocca
  return t;
}

/* ------------------------------------------------------------------------ */
/*  La mappa intera                                                         */
/* ------------------------------------------------------------------------ */

/** Dipinge la città su un foglio grande, poi lo taglia in due. */
export async function dipingiMappa() {
  const rng = casuale(4321);
  const L = Math.round((AREA.x1 - AREA.x0) * PX), A = Math.round((AREA.z1 - AREA.z0) * PX);
  const foglio = nuovaTela(L, A), c = foglio.getContext('2d');

  // 1. il fondo: terra chiara e vialetti
  c.fillStyle = '#efe4c9';
  c.fillRect(0, 0, L, A);
  granula(c, 0, 0, L, A, 0.25);

  // 2. il fiume con le rive rosa
  const traccia = (mezza, colore) => {
    c.fillStyle = colore;
    c.beginPath();
    for (let z = AREA.z0; z <= AREA.z1; z += 2) c.lineTo(mx(fiumeX(z) - mezza), mz(z));
    for (let z = AREA.z1; z >= AREA.z0; z -= 2) c.lineTo(mx(fiumeX(z) + mezza), mz(z));
    c.closePath();
    c.fill();
  };
  traccia(MEZZA_LARGHEZZA_FIUME + MARCIAPIEDE, '#f0b9a0');
  traccia(MEZZA_LARGHEZZA_FIUME, '#a9d4ec');
  traccia(MEZZA_LARGHEZZA_FIUME * 0.55, '#bfe0f2');
  // riflessi e onde
  c.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  c.lineWidth = 2;
  for (let k = 0; k < 140; k++) {
    const z = tra(rng, AREA.z0, AREA.z1), x = fiumeX(z) + tra(rng, -4.5, 4.5);
    c.beginPath(); c.moveTo(mx(x) - 8, mz(z)); c.quadraticCurveTo(mx(x), mz(z) - 4, mx(x) + 8, mz(z)); c.stroke();
  }
  // contorni delle rive
  c.strokeStyle = STILE.inchiostro;
  c.lineWidth = 1.8;
  for (const lato of [-1, 1]) {
    for (const d of [MEZZA_LARGHEZZA_FIUME, MEZZA_LARGHEZZA_FIUME + MARCIAPIEDE]) {
      c.beginPath();
      for (let z = AREA.z0; z <= AREA.z1; z += 2) c.lineTo(mx(fiumeX(z) + lato * d), mz(z));
      c.stroke();
    }
  }
  // macchinine ferme (le altre si muovono, vedi motore/volo.js)
  for (let k = 0; k < 26; k++) {
    const z = tra(rng, AREA.z0 + 5, AREA.z1 - 5);
    macchinina(c, fiumeX(z) + (k % 2 ? 2.6 : -2.6), z, AUTO[k % AUTO.length]);
  }

  // 3. la piazzetta gialla
  c.fillStyle = '#f6dc7c';
  c.beginPath(); c.arc(mx(PIAZZETTA.x), mz(PIAZZETTA.z), PIAZZETTA.r * PX, 0, Math.PI * 2); c.fill();
  c.strokeStyle = STILE.inchiostro; c.lineWidth = 2; c.stroke();
  c.fillStyle = 'rgba(255, 255, 255, 0.35)';
  c.beginPath(); c.arc(mx(PIAZZETTA.x) - 20, mz(PIAZZETTA.z) - 20, PIAZZETTA.r * PX * 0.5, 0, Math.PI * 2); c.fill();
  await respira();

  // 4. le case, a isolati, lontano dal fiume e dalla piazzetta
  const libero = (x, z, l, p) => {
    for (const zz of [z, z + p]) {
      for (const xx of [x, x + l]) {
        if (Math.abs(xx - fiumeX(zz)) < MEZZA_LARGHEZZA_FIUME + MARCIAPIEDE + 1) return false;
        if (Math.hypot(xx - PIAZZETTA.x, zz - PIAZZETTA.z) < PIAZZETTA.r + 1) return false;
      }
    }
    return true;
  };
  // procediamo dall'alto (lontano) verso il basso: le case vicine coprono quelle lontane
  const case_ = [];
  // case fitte fitte, come nel film: le file si sovrappongono un poco
  for (let z = AREA.z0 + 1; z < AREA.z1 - 6; z += tra(rng, 4.6, 5.8)) {
    if (rng() < 0.08) { z += 2.5; continue; }   // ogni tanto una strada trasversale
    for (let x = AREA.x0 + 1; x < AREA.x1 - 4; ) {
      const l = tra(rng, 3.0, 6.0), p = tra(rng, 2.8, 4.2), h = tra(rng, 3, 7.5);
      if (libero(x, z, l, p + h * 0.42) && rng() < 0.96) case_.push([x, z + tra(rng, -0.7, 0.7), l, p, h]);
      x += l + tra(rng, 0.05, 0.7);
      if (rng() < 0.06) x += tra(rng, 2.5, 4.5);   // un vicolo
    }
  }
  case_.sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (const [x, z, l, p, h] of case_) {
    casetta(c, x, z, l, p, h, rng);
    if (++n % 200 === 0) await respira();
  }
  // alberi qua e là (anche lungo le rive)
  for (let k = 0; k < 160; k++) {
    const z = tra(rng, AREA.z0, AREA.z1);
    const lungoRiva = k % 3 === 0;
    const x = lungoRiva ? fiumeX(z) + (rng() < 0.5 ? -1 : 1) * (MEZZA_LARGHEZZA_FIUME + MARCIAPIEDE + 1.2) : tra(rng, AREA.x0, AREA.x1);
    albero(c, x, z, tra(rng, 1.4, 2.6), rng);
  }
  // alberi intorno alla piazzetta
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    albero(c, PIAZZETTA.x + Math.cos(a) * (PIAZZETTA.r + 1.5), PIAZZETTA.z + Math.sin(a) * (PIAZZETTA.r + 1.5), 1.8, rng);
  }
  granula(c, 0, 0, L, A, 0.12);
  // i bordi svaniscono nella carta (come nei disegni del film)
  sfumaBordi(foglio, 140, ['sinistra', 'destra', 'alto']);
  await respira();

  // 5. tagliamo il foglio in due (massimo 2048 pixel per lato)
  const meta = Math.ceil(A / 2);
  const fogli = [];
  for (let k = 0; k < 2; k++) {
    const t = nuovaTela(L, k === 0 ? meta : A - meta);
    t.getContext('2d').drawImage(foglio, 0, -k * meta);
    fogli.push({ tela: t, z: AREA.z0 + (k * meta) / PX, profondita: t.height / PX });
  }
  return { fogli, larghezza: L / PX, x: AREA.x0 };
}
