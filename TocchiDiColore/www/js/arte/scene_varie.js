/* ==========================================================================
 *  scene_varie.js — TRE FONDALI DIPINTI: LIBRERIA, TERRAZZA, PIAZZETTA
 *  --------------------------------------------------------------------------
 *  Ogni scena è un piccolo teatrino "multiplane": pavimento, pareti, quinte
 *  e sfondi lontani sono dipinti ad acquerello su tele (canvas 2D) e appesi
 *  nello spazio con le regole di js/motore/strati.js.
 *
 *    dipingiScena('libreria')   dentro la libreria della Tigre
 *    dipingiScena('terrazza')   la terrazza sui tetti dove arriva la balena
 *    dipingiScena('piazzetta')  la piazzetta del finale (torna il cane)
 *
 *  Restituisce { strati: [ { nome, tela, normale, x, y, z, larghezza,
 *                            altezza | profondita, ordine?, tremola?, luce? } ] }
 *
 *  COME SI DIPINGE: ogni tela ha la sua risoluzione s (pixel per metro).
 *  I pennelli lavorano in pixel; per i muri si usano due piccole funzioni
 *    X(x) = (x - xMin) * s      Y(y) = (yMax - y) * s   (in alto c'è il cielo)
 *  e per i pavimenti Z(z) = (z - zMin) * s (in alto c'è il lato lontano).
 *  Tutto è deterministico: ogni tela ha il suo seme casuale.
 * ========================================================================== */
import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa,
  percorso, Forme, trama, foglia, sfumaBordi, respira,
} from './pennello.js';

const TAU = Math.PI * 2;
const SEPPIA = STILE.inchiostro;   // le linee sottili color seppia
const OMBRA = '#5d4b7c';           // le ombre sono viola, mai nere
const scegli = (r, elenco) => elenco[Math.floor(r() * elenco.length)];

/* ======================= 1. TELE E TAGLI ================================ */

/** Una tela per un rettangolo del mondo largo l e alto a metri (s = pixel per metro). */
function quadro(l, a, s, seme) {
  const tela = nuovaTela(Math.round(l * s), Math.round(a * s));
  return { tela, c: tela.getContext('2d'), W: tela.width, H: tela.height, s, r: casuale(seme) };
}

/**
 * Taglia una tela più grande di 2048 px in pezzi e calcola dove sta ogni
 * pezzo nel mondo, seguendo le convenzioni di strati.js.
 */
function affetta(tela, d) {
  const W = tela.width, H = tela.height, nx = Math.ceil(W / 2048), ny = Math.ceil(H / 2048);
  const orizzontale = d.normale === 'su' || d.normale === 'giu'; const L = d.larghezza, A = orizzontale ? d.profondita : d.altezza; const pezzi = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x0 = Math.round(W * i / nx), x1 = Math.round(W * (i + 1) / nx); const y0 = Math.round(H * j / ny), y1 = Math.round(H * (j + 1) / ny);
      let t = tela;
      if (nx * ny > 1) {
        t = nuovaTela(x1 - x0, y1 - y0); t.getContext('2d').drawImage(tela, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
      }
      const u0 = x0 / W, u1 = x1 / W, v0 = y0 / H, v1 = y1 / H; // u da sinistra, v dall'alto
      const p = Object.assign({}, d, { tela: t, larghezza: L * (u1 - u0) }); if (nx * ny > 1) p.nome = d.nome + '_' + (j * nx + i + 1);
      const alto = A * (v1 - v0);
      if (d.normale === 'su') { p.x = d.x + L * u0; p.z = d.z + A * v0; p.profondita = alto; }
      else if (d.normale === 'giu') { p.x = d.x + L * u0; p.z = d.z + A * (1 - v1); p.profondita = alto; }
      else {
        p.y = d.y + A * (1 - v1); p.altezza = alto;
        if (d.normale === 'x+') p.z = d.z + L * (1 - u1);   // a sinistra dell'immagine c'è la z più grande
        else if (d.normale === 'x-') p.z = d.z + L * u0;
        else if (d.normale === 'z-') p.x = d.x + L * (1 - u1);
        else p.x = d.x + L * u0;                             // 'z+'
      }
      pezzi.push(p);
    }
  }
  return pezzi;
}

/* ======================= 2. PENNELLI COMUNI ============================= */

/** Macchia rotonda sfumata (pigmento, luce, bagliore). */
function alone(c, x, y, rr, col, alfa) {
  const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, conAlfa(col, alfa)); g.addColorStop(1, conAlfa(col, 0)); c.fillStyle = g;
  c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
}

/** Pennellata morbida e allungata (striscia di colore più chiaro o più scuro). */
function striscia(c, x, y, lu, h, ang, col, alfa) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(lu / h, 1); alone(c, 0, 0, h, col, alfa); c.restore();
}

/** Sfumatura lineare su un rettangolo: tappe = [[0, colore], [1, colore], ...]. */
function sfuma(c, x, y, l, a, tappe, orizzontale) {
  const g = orizzontale ? c.createLinearGradient(x, 0, x + l, 0) : c.createLinearGradient(0, y, 0, y + a);
  for (const [t, col] of tappe) g.addColorStop(t, col);
  c.fillStyle = g; c.fillRect(x, y, l, a);
}

/** Punti attorno a un'ellisse un po' storta (macchie, chiome). */
function blob(r, cx, cy, rx, ry, n, irr) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + tra(r, -irr, irr); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Punti di un mattone o di una piastrella: angoli smussati, lati appena storti. */
function puntiMattone(r, x, y, l, a, t) {
  const q = Math.min(l, a) * t, j = () => tra(r, -0.8, 0.8);
  return [[x + q, y + j()], [x + l - q, y + j()], [x + l + j(), y + q], [x + l + j(), y + a - q],
    [x + l - q, y + a + j()], [x + q, y + a + j()], [x + j(), y + a - q], [x + j(), y + q]];
}

/** Punti di un sasso "a cuscino": una superellisse un po' storta. */
function puntiSasso(r, cx, cy, rx, ry) {
  const pts = [], pot = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.65);
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * TAU + tra(r, -0.1, 0.1), k = 1 + tra(r, -0.08, 0.05);
    pts.push([cx + rx * k * pot(Math.cos(t)), cy + ry * k * pot(Math.sin(t))]);
  }
  return pts;
}

/** Spezzata tremolante "a mano libera", come una penna vera (t = tremolio in px). */
function mano(r, punti, chiuso, t) {
  const p = new Path2D(), j = (v) => v + (r() - 0.5) * 2 * (t === undefined ? 0.7 : t); const pts = chiuso ? punti.concat([punti[0]]) : punti;
  p.moveTo(j(pts[0][0]), j(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 30));
    for (let k = 1; k <= n; k++) {
      const m = (k - 0.5) / n, f = k / n;
      p.quadraticCurveTo(j(x0 + (x1 - x0) * m), j(y0 + (y1 - y0) * m), j(x0 + (x1 - x0) * f), j(y0 + (y1 - y0) * f));
    }
  }
  if (chiuso) p.closePath();
  return p;
}

/** Rettangolo a mano: quattro tratti che sbordano appena agli angoli. */
function rettMano(r, x, y, l, a, t) {
  const p = new Path2D(), e = () => tra(r, -0.5, 2);
  for (const tratto of [[[x - e(), y], [x + l + e(), y]], [[x + l, y - e()], [x + l, y + a + e()]],
    [[x + l + e(), y + a], [x - e(), y + a]], [[x, y + a + e()], [x, y - e()]]]) p.addPath(mano(r, tratto, false, t));
  return p;
}

/** Linea a inchiostro seppia (o di un altro colore). */
function inchiostro(c, forma, spessore, alfa, colore) {
  c.save(); c.globalAlpha = alfa === undefined ? 0.85 : alfa; c.strokeStyle = colore || SEPPIA; c.lineWidth = spessore || 1.4;
  c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(percorso(forma)); c.restore();
}

/**
 * VELATURA AD ACQUERELLO dentro una forma: la stesura di base, macchie di
 * pigmento (più chiare, più scure o di una tinta vicina), le "fioriture"
 * e il bordo bagnato più scuro, dove l'acqua si asciuga.
 *   box = [x, y, l, a]: la zona occupata dalla forma
 *   o:   { alfa, var, n, rMax, scuro, tinta, luce, ombra, bordo, lb, fioriture,
 *          strisce (quante pennellate lunghe), angolo (la loro inclinazione) }
 */
function lava(c, forma, colore, box, r, o) {
  o = o || {}; const p = percorso(forma), [x, y, l, a] = box; c.save(); c.clip(p); c.globalAlpha = o.alfa === undefined ? 0.96 : o.alfa;
  c.fillStyle = colore; c.fillRect(x, y, l, a); c.globalAlpha = 1; const v = o.var === undefined ? 0.22 : o.var;
  const n = o.n === undefined ? Math.min(40, 2 + Math.round((l * a) / 9000)) : o.n; const rMax = Math.min(o.rMax || 240, Math.max(l, a) * 0.7);
  for (let i = 0; i < n; i++) {
    const q = r();
    const tono = q < 0.45 ? schiarisci(colore, 0.45) : q < 0.8 ? (o.scuro || scurisci(colore, 0.22)) : mescola(colore, o.tinta || '#f0a878', 0.5);
    alone(c, x + r() * l, y + r() * a, rMax * tra(r, 0.3, 1), tono, v * tra(r, 0.6, 1.3));
  }
  for (let i = 0; i < (o.strisce || 0); i++) {
    const h = rMax * tra(r, 0.12, 0.3), chiara = r() < 0.65;
    striscia(c, x + r() * l, y + r() * a, h * tra(r, 4, 9), h, (o.angolo || 0) + tra(r, -0.15, 0.15),
      chiara ? schiarisci(colore, 0.6) : (o.scuro || scurisci(colore, 0.2)), v * (chiara ? 1.3 : 0.8));
  }
  for (let i = 0; i < (o.fioriture || 0); i++) {
    const rr = rMax * tra(r, 0.08, 0.25); const f = Forme.poligono(blob(r, x + r() * l, y + r() * a, rr, rr * tra(r, 0.5, 1), 9, 0.3), true);
    c.globalAlpha = 0.16; c.fillStyle = schiarisci(colore, 0.6); c.fill(f);
    c.globalAlpha = 0.22; c.lineWidth = 1.6; c.strokeStyle = scurisci(colore, 0.3); c.stroke(f);
  }
  c.globalAlpha = 1; if (o.luce) sfuma(c, x, y, l, a, [[0, 'rgba(255,250,232,0.42)'], [0.55, 'rgba(255,250,232,0)']]);
  if (o.ombra) sfuma(c, x, y, l, a, [[0.4, conAlfa(OMBRA, 0)], [1, conAlfa(OMBRA, o.ombra)]]);
  const b = o.bordo === undefined ? 0.35 : o.bordo;
  if (b > 0) {
    const lb = o.lb || 3; c.strokeStyle = scurisci(colore, 0.32); c.globalAlpha = b * 0.45; c.lineWidth = lb * 2.6; c.stroke(p);
    c.globalAlpha = b; c.lineWidth = lb; c.stroke(p);
  }
  c.restore();
}

/** Velatura veloce per forme piccole (senza ritaglio): tinta, luce in alto a sinistra, bordo. */
function macchia(c, forma, colore, box, bordo) {
  const p = percorso(forma), [x, y, l, a] = box; c.fillStyle = colore; c.fill(p);
  const g = c.createRadialGradient(x + l * 0.3, y + a * 0.25, 0, x + l * 0.3, y + a * 0.25, Math.max(l, a) * 0.95);
  g.addColorStop(0, 'rgba(255,250,235,0.38)'); g.addColorStop(0.5, 'rgba(255,250,235,0)'); g.addColorStop(1, conAlfa(OMBRA, 0.2)); c.fillStyle = g;
  c.fill(p); c.save(); c.globalAlpha = bordo === undefined ? 0.4 : bordo; c.strokeStyle = scurisci(colore, 0.3); c.lineWidth = 1.6; c.stroke(p);
  c.restore();
}

/**
 * Disegno MORBIDO (ombre portate, aloni): si dipinge su una tela piccola e
 * la si ingrandisce, così i bordi diventano sfumati.
 *   o: { f: riduzione (8), modo: 'source-atop' = solo dove c'è già colore, alfa }
 */
function morbido(Q, disegna, o) {
  o = o || {}; const f = o.f || 8, t = nuovaTela(Q.W / f, Q.H / f), k = t.getContext('2d'); k.scale(t.width / Q.W, t.height / Q.H); disegna(k);
  Q.c.save(); Q.c.globalCompositeOperation = o.modo || 'source-atop'; Q.c.globalAlpha = o.alfa === undefined ? 1 : o.alfa;
  Q.c.drawImage(t, 0, 0, Q.W, Q.H); Q.c.restore();
}

/** Velo d'aria: schiarisce (o colora) solo ciò che è già dipinto. */
function velo(Q, colore, alfa) {
  Q.c.save(); Q.c.globalCompositeOperation = 'source-atop'; Q.c.globalAlpha = alfa; Q.c.fillStyle = colore; Q.c.fillRect(0, 0, Q.W, Q.H);
  Q.c.restore();
}

/** La grana della carta, SOLO dove c'è colore (le parti trasparenti restano tali). */
function carta(Q, forza) {
  const { W, H } = Q, t = nuovaTela(W, H), k = t.getContext('2d'); k.fillStyle = k.createPattern(trama('grana'), 'repeat'); k.fillRect(0, 0, W, H);
  const m = k.createPattern(trama('macchie'), 'repeat'); m.setTransform(new DOMMatrix().rotate(23).scale(2.3));
  k.globalCompositeOperation = 'multiply'; k.globalAlpha = 0.35; k.fillStyle = m; k.fillRect(0, 0, W, H);
  k.globalCompositeOperation = 'destination-in'; k.globalAlpha = 1; k.drawImage(Q.tela, 0, 0); Q.c.save(); Q.c.globalCompositeOperation = 'multiply';
  Q.c.globalAlpha = forza === undefined ? 0.3 : forza; Q.c.drawImage(t, 0, 0); Q.c.restore();
}

/* ======================= 3. PICCOLI SOGGETTI ============================ */
const VERDI = ['#4f8a55', '#68a362', '#8bbf76', '#a8d08b'];
const ARANCI = ['#f08a4b', '#f4a259', '#e9663f', '#f7b46a', '#ee7a45'];
const COTTO = ['#e39a70', '#e8a57d', '#dc8d64', '#eeb390', '#e0946a', '#f0bb98'];

/** Ciuffo d'erba: fili curvi che partono da (x, y). */
function ciuffo(c, r, x, y, h, n, colori) {
  for (let i = 0; i < n; i++) {
    const a = tra(r, -0.9, 0.9), hh = h * tra(r, 0.45, 1), w = h * 0.05 * tra(r, 0.7, 1.4);
    const tx = x + Math.sin(a) * hh, ty = y - Math.cos(a) * hh;
    const mx = x + Math.sin(a) * hh * 0.25, my = y - hh * 0.6, bx = x + tra(r, -0.3, 0.3) * h * 0.3; const p = new Path2D();
    p.moveTo(bx - w, y); p.quadraticCurveTo(mx - w * 0.4, my, tx, ty); p.quadraticCurveTo(mx + w * 0.4, my, bx + w, y); p.closePath();
    c.globalAlpha = 0.92; c.fillStyle = scegli(r, colori); c.fill(p); if (r() < 0.45) inchiostro(c, p, 0.9, 0.4);
  }
  c.globalAlpha = 1;
}

/** Fiorellino a petali tondi con il cuore giallo. */
function fiore(c, r, x, y, d, col) {
  c.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + r(); c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, d * 0.72, 0, TAU); c.fill();
  }
  c.fillStyle = '#f5cf5a'; c.beginPath(); c.arc(x, y, d * 0.45, 0, TAU); c.fill();
}

/** Grappolo di fiorellini (i fiori arancioni ricadenti del film). */
function grappolo(c, r, x, y, rr, colori) {
  const n = 5 + Math.floor(r() * 6);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r()) * rr; c.globalAlpha = 0.93; c.fillStyle = scegli(r, colori);
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, rr * tra(r, 0.28, 0.42), 0, TAU); c.fill();
  }
  c.globalAlpha = 0.5; c.fillStyle = '#b8442e';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + tra(r, -rr, rr) * 0.6, y + tra(r, -rr, rr) * 0.5, rr * 0.09, 0, TAU); c.fill(); }
  c.globalAlpha = 1;
}

/** Vaso di terracotta: base al centro (cx, yb), largo l e alto a (pixel). */
function vaso(c, r, cx, yb, l, a, colore) {
  const col = colore || scegli(r, ['#d9825c', '#e08d66', '#cf7955']);
  const corpo = Forme.poligono([[cx - l / 2, yb - a * 0.82], [cx + l / 2, yb - a * 0.82], [cx + l * 0.36, yb], [cx - l * 0.36, yb]]);
  macchia(c, corpo, col, [cx - l / 2, yb - a, l, a]);
  macchia(c, Forme.rettangolo(cx - l * 0.56, yb - a, l * 1.12, a * 0.2, a * 0.04), schiarisci(col, 0.12), [cx - l * 0.56, yb - a, l * 1.12, a * 0.2]);
  inchiostro(c, mano(r, [[cx - l / 2, yb - a * 0.8], [cx - l * 0.36, yb], [cx + l * 0.36, yb], [cx + l / 2, yb - a * 0.8]], false, 0.5), 1.2, 0.8);
  inchiostro(c, rettMano(r, cx - l * 0.56, yb - a, l * 1.12, a * 0.2, 0.4), 1.1, 0.75);
}

/** Pianta in vaso: 'geranio', 'lavanda', 'foglie', 'margherite'. (cx, yb) = dove esce dalla terra. */
function pianta(c, r, cx, yb, rr, tipo) {
  if (tipo === 'lavanda') {
    for (let i = 0; i < 14; i++) {
      const a = tra(r, -0.6, 0.6), h = rr * tra(r, 1, 1.7), x1 = cx + Math.sin(a) * h, y1 = yb - Math.cos(a) * h;
      inchiostro(c, Forme.curva([[cx + a * rr * 0.2, yb], [x1, y1]]), Math.max(1, rr * 0.035), 0.9, '#6f9a68');
      c.fillStyle = scegli(r, ['#9a86d1', '#b39ee0', '#8573c4']);
      for (let k = 0; k < 6; k++) { const t = 0.62 + k * 0.07; c.beginPath(); c.ellipse(cx + Math.sin(a) * h * t, yb - Math.cos(a) * h * t, rr * 0.07, rr * 0.1, a, 0, TAU); c.fill(); }
    }
    return;
  }
  const n = tipo === 'foglie' ? 13 : 16;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + tra(r, -1.35, 1.35), col = scegli(r, VERDI);
    if (tipo === 'foglie') foglia(c, cx, yb, a, rr * tra(r, 0.8, 1.35), rr * 0.24, col, 0.6);
    else {
      const d = rr * tra(r, 0.2, 0.85), x = cx + Math.cos(a) * d, y = yb + Math.sin(a) * d * 0.75, f = Forme.ellisse(x, y, rr * 0.26, rr * 0.2, a);
      c.fillStyle = col; c.fill(f); if (r() < 0.5) inchiostro(c, f, 1, 0.5);
    }
  }
  if (tipo === 'tonde') return;
  if (tipo === 'geranio') {
    for (let i = 0; i < 4; i++) grappolo(c, r, cx + tra(r, -0.6, 0.6) * rr, yb - rr * tra(r, 0.6, 1.0), rr * 0.26, ['#e4473f', '#f0605a', '#d63a3a', '#f48a80']);
  } else if (tipo === 'margherite') {
    for (let i = 0; i < 6; i++) fiore(c, r, cx + tra(r, -0.7, 0.7) * rr, yb - rr * tra(r, 0.4, 1), rr * 0.09, scegli(r, ['#fffaf0', '#f6e9f3', '#fff3d0']));
  }
}

/**
 * Rami ricadenti con foglie e grappoli arancioni: nascono tra x0 e x1 alla
 * quota y e scendono ondeggiando. Restituisce la "ricetta" da disegnare.
 */
function rami(r, x0, x1, y, lMin, lMax, n, s) {
  const R = { steli: [], foglie: [], fiori: [] };
  for (let i = 0; i < n; i++) {
    const x = tra(r, x0, x1), y0 = y + tra(r, -0.04, 0.12) * s, lung = tra(r, lMin, lMax) * s;
    const fase = r() * TAU, onda = tra(r, 0.03, 0.1) * s, deriva = tra(r, -0.25, 0.25), pts = [];
    for (let d = 0; d <= lung; d += 0.05 * s) {
      const px = x + Math.sin(fase + d / (0.3 * s)) * onda + d * deriva, py = y0 + d; pts.push([px, py]);
      if (r() < 0.8) R.foglie.push([px, py, Math.PI / 2 + (r() < 0.5 ? -1 : 1) * tra(r, 0.5, 1.3), tra(r, 0.06, 0.11) * s, scegli(r, VERDI)]);
      if (r() < 0.2) R.fiori.push([px + tra(r, -0.04, 0.04) * s, py, tra(r, 0.035, 0.06) * s]);
    }
    const fine = pts[pts.length - 1]; R.fiori.push([fine[0], fine[1], 0.055 * s]); R.steli.push(pts);
  }
  return R;
}

/** Disegna i rami; con "ombra" disegna solo la sagoma (per l'ombra portata sul muro). */
function disegnaRami(c, r, R, ombra) {
  if (ombra) {
    c.fillStyle = ombra;
    for (const [x, y, a, l] of R.foglie) { c.beginPath(); c.ellipse(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2, l / 2, l / 5, a, 0, TAU); c.fill(); }
    for (const [x, y, rr] of R.fiori) { c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill(); }
    return;
  }
  for (const pts of R.steli) inchiostro(c, Forme.curva(pts), 1.5, 0.8, '#6c8a4c');
  for (const [x, y, a, l, col] of R.foglie) foglia(c, x, y, a, l, l * 0.3, col, r() < 0.4 ? 0.6 : 0);
  for (const [x, y, rr] of R.fiori) grappolo(c, r, x, y, rr, ARANCI);
}

/** Alberello tondo (chioma a nuvola) con la base del tronco in (cx, yb). */
function chioma(c, r, cx, yb, rr, col) {
  inchiostro(c, Forme.curva([[cx, yb], [cx + tra(r, -2, 2), yb - rr]]), Math.max(2, rr * 0.16), 0.9, '#8a6a52');
  const f = Forme.poligono(blob(r, cx, yb - rr * 1.35, rr, rr * 0.85, 11, 0.16), true);
  lava(c, f, col, [cx - rr * 1.2, yb - rr * 2.4, rr * 2.4, rr * 2.2], r, { n: 4, var: 0.3, luce: true, bordo: 0.4, lb: 2 }); c.save(); c.clip(f);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = conAlfa(i < 2 ? schiarisci(col, 0.35) : scurisci(col, 0.25), 0.45);
    c.beginPath(); c.ellipse(cx + tra(r, -0.6, 0.6) * rr, yb - rr * (i < 2 ? 1.75 : 0.9), rr * 0.4, rr * 0.25, 0, 0, TAU); c.fill();
  }
  c.restore(); inchiostro(c, f, 1.2, 0.6);
}

/* ============================ 4. LIBRERIA ================================ */
const LIBRI = ['#d9574f', '#ef9246', '#f2cb5e', '#79b672', '#5b9fd3', '#9478c9', '#e486a8',
  '#45a99f', '#f3e8d2', '#b9483f', '#6a86cf', '#e9ad78', '#3f7f74', '#c99a4f'];
const LEGNO = '#b8794a', LEGNO_CHIARO = '#d6a06a', FONDO_SCAFFALE = '#7a4c43';
const ALTO = 3.6;   // altezza della stanza

/** Un libro in piedi: (x, y) è l'angolo in alto a sinistra. */
function libro(c, r, x, y, l, a) {
  const col = mescola(scegli(r, LIBRI), '#fff3df', r() * 0.3); c.fillStyle = col; c.fillRect(x, y, l, a);
  c.fillStyle = 'rgba(255,248,230,0.3)'; c.fillRect(x + l * 0.12, y, l * 0.22, a);
  c.fillStyle = 'rgba(70,45,90,0.2)'; c.fillRect(x + l * 0.7, y, l * 0.3, a); const q = r(), b = Math.max(1, a * 0.035);
  if (q < 0.5) {                     // fregi dorati o scuri sulla costa
    c.fillStyle = q < 0.28 ? 'rgba(250,226,150,0.8)' : conAlfa(scurisci(col, 0.4), 0.55);
    c.fillRect(x, y + a * 0.1, l, b); c.fillRect(x, y + a * 0.84, l, b);
  } else if (q < 0.72) {             // etichetta chiara
    c.fillStyle = 'rgba(252,246,228,0.85)'; c.fillRect(x + l * 0.2, y + a * 0.28, l * 0.6, a * 0.15);
  }
  c.strokeStyle = conAlfa(SEPPIA, 0.5); c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, l - 1, a - 1);
}

/** Un soprammobile sul ripiano: vasetto con un rametto o una piantina. */
function ninnolo(c, r, x, yb, l) {
  if (r() < 0.5) {
    const h = l * 0.85, col = scegli(r, ['#7fb3c9', '#e9c46a', '#e88f7a', '#a6c99a']);
    const f = Forme.poligono([[x + l * 0.32, yb - h], [x + l * 0.68, yb - h], [x + l * 0.62, yb - h * 0.72], [x + l * 0.92, yb - h * 0.35],
      [x + l * 0.78, yb], [x + l * 0.22, yb], [x + l * 0.08, yb - h * 0.35], [x + l * 0.38, yb - h * 0.72]], true);
    for (let i = 0; i < 5; i++) foglia(c, x + l / 2, yb - h, -Math.PI / 2 + tra(r, -0.9, 0.9), h * 0.6, h * 0.13, scegli(r, VERDI), 0.5);
    macchia(c, f, col, [x, yb - h, l, h]); inchiostro(c, f, 1, 0.7);
  } else {
    pianta(c, r, x + l / 2, yb - l * 0.45, l * 0.5, 'foglie'); vaso(c, r, x + l / 2, yb, l * 0.6, l * 0.5);
  }
}

/** Una fila di libri su un ripiano, tra x0 e x1, appoggiati a yb, alti al massimo hMax. */
function filaDiLibri(c, r, x0, x1, yb, hMax, s) {
  let x = x0 + r() * 0.02 * s, pendente = false;
  while (x < x1 - 0.03 * s) {
    const q = r();
    if (q < 0.05) { x += tra(r, 0.05, 0.14) * s; pendente = true; continue; }   // un buco: il libro dopo si inclina
    if (q < 0.11 && x1 - x > 0.3 * s) {                                         // pila di libri coricati
      const l = tra(r, 0.17, 0.26) * s; let y = yb;
      for (let i = 0, n = 2 + Math.floor(r() * 4); i < n && y > yb - hMax * 0.8; i++) {
        const a = tra(r, 0.03, 0.055) * s, d = tra(r, 0, 0.02) * s; libro(c, r, x + d, y - a, l - 0.02 * s, a); y -= a;
      }
      x += l + 0.01 * s; continue;
    }
    if (q < 0.122 && x1 - x > 0.2 * s) { ninnolo(c, r, x, yb, 0.16 * s); x += 0.18 * s; continue; }
    const l = tra(r, 0.025, 0.07) * s, a = hMax * tra(r, 0.62, 0.95); if (x + l > x1) break;
    if (pendente) {
      c.save(); c.translate(x, yb); c.rotate(-tra(r, 0.12, 0.3)); libro(c, r, 0, -a, l, a); c.restore(); pendente = false;
    } else libro(c, r, x, yb - a, l, a);
    x += l + (r() < 0.25 ? 1 : 0);
  }
}

/** Mobile libreria tra x0 e x1 (pixel), dal pavimento yPav alla cima yCima. o: { ripiani, colonne } */
function scaffale(Q, x0, x1, yPav, yCima, o) {
  o = o || {}; const { c, r, s } = Q, L = x1 - x0; const zoccolo = 0.16 * s, cornice = 0.15 * s, mont = 0.065 * s, spess = 0.045 * s;
  lava(c, Forme.rettangolo(x0, yCima, L, yPav - yCima), FONDO_SCAFFALE, [x0, yCima, L, yPav - yCima], r, { var: 0.3, bordo: 0, tinta: '#5b3d52' });
  const nCol = o.colonne || Math.max(1, Math.round(L / (1.1 * s))), nRip = o.ripiani || 8;
  const yIn = yCima + cornice, hRip = (yPav - zoccolo - yIn) / nRip, passo = (L - mont) / nCol;
  for (let i = 0; i < nCol; i++) {
    for (let j = 0; j < nRip; j++) {
      filaDiLibri(c, r, x0 + mont + i * passo, x0 + (i + 1) * passo, yPav - zoccolo - j * hRip, hRip - spess - 0.03 * s, s);
    }
  }
  const legno = (x, y, l, a, col) => {
    lava(c, Forme.rettangolo(x, y, l, a), col, [x, y, l, a], r, { n: 3, var: 0.25, bordo: 0.3, lb: 1.5 });
    inchiostro(c, rettMano(r, x, y, l, a, 0.4), 1.2, 0.7);
  };
  for (let j = 1; j <= nRip; j++) {                       // ripiani, con l'ombra sotto
    const y = yPav - zoccolo - j * hRip;
    c.save(); sfuma(c, x0, y + spess, L, 0.1 * s, [[0, conAlfa(OMBRA, 0.5)], [1, conAlfa(OMBRA, 0)]]); c.restore();
    legno(x0, y, L, spess, LEGNO_CHIARO);
  }
  for (let i = 0; i <= nCol; i++) {                       // montanti, con l'ombra a destra
    const x = x0 + i * passo;
    if (i < nCol) sfuma(c, x + mont, yIn, 0.07 * s, yPav - zoccolo - yIn, [[0, conAlfa(OMBRA, 0.35)], [1, conAlfa(OMBRA, 0)]], true);
    legno(x, yIn, mont, yPav - zoccolo - yIn, LEGNO);
  }
  legno(x0, yPav - zoccolo, L, zoccolo, '#9a6340'); legno(x0, yCima, L, cornice, LEGNO);
  inchiostro(c, mano(r, [[x0, yCima + cornice * 0.35], [x1, yCima + cornice * 0.35]], false, 0.5), 1, 0.5);
}

/** La grande finestra ad arco: x0..x1, davanzale a yDav, cima dell'arco a yTop (pixel). */
function finestraArco(Q, x0, x1, yDav, yTop) {
  const { c, r, s } = Q, l = x1 - x0, rr = l / 2, cx = x0 + rr, yImp = yTop + rr;
  const arco = (d) => { const p = new Path2D(); p.moveTo(x0 + d, yDav); p.lineTo(x0 + d, yImp); p.arc(cx, yImp, rr - d, Math.PI, 0); p.lineTo(x1 - d, yDav); p.closePath(); return p; };
  const fuori = arco(-0.12 * s), vetro = arco(0.07 * s);
  lava(c, fuori, LEGNO, [x0 - 0.12 * s, yTop - 0.12 * s, l + 0.24 * s, yDav - yTop + 0.12 * s], r, { var: 0.25, bordo: 0.4 });
  c.save(); c.clip(vetro); sfuma(c, x0, yTop, l, yDav - yTop, [[0, '#cfe6f3'], [0.5, '#eef6f0'], [1, '#fff2d2']]);
  for (let i = 0; i < 7; i++) {                           // fuori: tetti e alberi appena accennati
    const col = scegli(r, ['#f3c9b5', '#cfe3b5', '#f6dca0', '#d6dcf0']), hx = x0 + r() * l, hy = yDav - tra(r, 0.05, 0.6) * s;
    c.fillStyle = conAlfa(col, 0.45); c.fillRect(hx - 0.15 * s, hy, 0.3 * s, yDav - hy);
    c.fillStyle = conAlfa('#e7a184', 0.35); c.beginPath(); c.moveTo(hx - 0.18 * s, hy); c.lineTo(hx, hy - 0.12 * s); c.lineTo(hx + 0.18 * s, hy); c.fill();
  }
  alone(c, x0 + l * 0.3, yDav - 0.9 * s, 0.7 * s, '#bfe0a8', 0.35);
  c.fillStyle = 'rgba(255,255,255,0.45)';                 // riflessi in diagonale
  for (const [a, b] of [[0.15, 0.12], [0.45, 0.06], [0.62, 0.14]]) {
    c.beginPath(); c.moveTo(x0 + l * a, yDav); c.lineTo(x0 + l * (a + b), yDav); c.lineTo(x0 + l * (a + b + 0.7), yTop); c.lineTo(x0 + l * (a + 0.7), yTop); c.fill();
  }
  c.restore();
  const sb = 0.04 * s, telaio = new Path2D();             // telaio di legno: prima il contorno seppia, poi il legno
  for (const f of [1 / 3, 2 / 3]) { telaio.moveTo(x0 + l * f, yDav); telaio.lineTo(x0 + l * f, yImp); }
  for (let k = 0; k < 3; k++) { const y = yImp + (yDav - yImp) * k / 3; telaio.moveTo(x0, y); telaio.lineTo(x1, y); }
  for (const a of [0.25, 0.5, 0.75]) { telaio.moveTo(cx, yImp); telaio.lineTo(cx - Math.cos(a * Math.PI) * rr, yImp - Math.sin(a * Math.PI) * rr); }
  telaio.moveTo(cx + rr * 0.42, yImp); telaio.arc(cx, yImp, rr * 0.42, 0, Math.PI, true); c.save(); c.clip(vetro); c.lineCap = 'butt';
  c.strokeStyle = conAlfa(SEPPIA, 0.8); c.lineWidth = sb + 3; c.stroke(telaio); c.strokeStyle = '#c99260'; c.lineWidth = sb; c.stroke(telaio);
  c.strokeStyle = 'rgba(255,240,210,0.45)'; c.lineWidth = sb * 0.25; c.stroke(telaio); c.restore(); inchiostro(c, vetro, 2, 0.8);
  inchiostro(c, fuori, 1.6, 0.8); const dav = Forme.rettangolo(x0 - 0.18 * s, yDav, l + 0.36 * s, 0.07 * s, 3);
  macchia(c, dav, LEGNO_CHIARO, [x0 - 0.18 * s, yDav, l + 0.36 * s, 0.07 * s]); inchiostro(c, dav, 1.4, 0.8);
  vaso(c, r, x0 + l * 0.22, yDav, 0.16 * s, 0.14 * s);    // un cactus e due libri sul davanzale
  const cactus = Forme.rettangolo(x0 + l * 0.22 - 0.045 * s, yDav - 0.32 * s, 0.09 * s, 0.2 * s, 0.045 * s);
  macchia(c, cactus, '#7fae74', [x0 + l * 0.2, yDav - 0.32 * s, 0.1 * s, 0.2 * s]); inchiostro(c, cactus, 1.2, 0.7);
  fiore(c, r, x0 + l * 0.22, yDav - 0.33 * s, 0.018 * s, '#f28aa8'); libro(c, r, x0 + l * 0.68, yDav - 0.05 * s, 0.3 * s, 0.05 * s);
  libro(c, r, x0 + l * 0.7, yDav - 0.09 * s, 0.26 * s, 0.04 * s);
}

/** Tenda raccolta di lato: appesa a yTop, legata a metà, cade fino a yBot (verso = 1 a sinistra, -1 a destra). */
function tenda(Q, x, yTop, yBot, verso) {
  const { c, r, s } = Q, w = 0.42 * s, yNodo = yTop + (yBot - yTop) * 0.55;
  const p = Forme.poligono([[x - verso * 0.06 * s, yTop], [x + verso * w, yTop], [x + verso * w * 0.75, yTop + (yNodo - yTop) * 0.5],
    [x + verso * w * 0.3, yNodo], [x + verso * w * 0.55, yBot - 0.15 * s], [x + verso * w * 0.7, yBot], [x - verso * 0.06 * s, yBot]], false);
  const box = [Math.min(x, x + verso * w) - 0.1 * s, yTop, w + 0.2 * s, yBot - yTop];
  lava(c, p, '#d46f63', box, r, { n: 5, var: 0.3, luce: true, bordo: 0.45, tinta: '#e9926e' }); c.save(); c.clip(p);
  for (let k = 1; k < 5; k++) {                           // pieghe: strisce chiare e scure
    const fx = x + verso * w * k / 5.5; c.fillStyle = 'rgba(255,235,220,0.22)'; c.fillRect(fx, yTop, 0.03 * s, yBot - yTop);
    inchiostro(c, mano(r, [[fx + 0.05 * s * verso, yTop + 0.05 * s], [x + verso * w * 0.3 * k / 5, yNodo], [fx + verso * 0.03 * s, yBot]], false, 0.8), 1, 0.4);
  }
  c.restore(); inchiostro(c, p, 1.5, 0.85); const nodo = Forme.ellisse(x + verso * w * 0.3, yNodo, 0.07 * s, 0.035 * s, 0.3 * verso);
  macchia(c, nodo, '#e8c25a', [x + verso * w * 0.3 - 0.07 * s, yNodo - 0.04 * s, 0.14 * s, 0.08 * s]); inchiostro(c, nodo, 1.2, 0.85);
}

/** Lampada da lettura a stelo: base in (cx, yPav), paralume alla quota yP (pixel). */
function lampadaStelo(Q, cx, yPav, yP) {
  const { c, r, s } = Q; inchiostro(c, Forme.curva([[cx, yPav - 0.03 * s], [cx, yP + 0.2 * s]]), 0.03 * s, 1, '#a67c3e');
  inchiostro(c, Forme.curva([[cx - 0.006 * s, yPav - 0.05 * s], [cx - 0.006 * s, yP + 0.2 * s]]), 0.008 * s, 0.7, '#f3d98f');
  const base = Forme.ellisse(cx, yPav - 0.025 * s, 0.17 * s, 0.035 * s);
  macchia(c, base, '#b98a46', [cx - 0.17 * s, yPav - 0.06 * s, 0.34 * s, 0.07 * s]); inchiostro(c, base, 1.3, 0.8);
  c.save(); c.globalCompositeOperation = 'lighter'; alone(c, cx, yP + 0.3 * s, 0.95 * s, '#ffc86a', 0.28); c.restore();
  const pl = Forme.poligono([[cx - 0.13 * s, yP], [cx + 0.13 * s, yP], [cx + 0.23 * s, yP + 0.3 * s], [cx - 0.23 * s, yP + 0.3 * s]]);
  lava(c, pl, '#eea65e', [cx - 0.23 * s, yP, 0.46 * s, 0.3 * s], r, { n: 3, luce: true, bordo: 0.4, lb: 2 }); inchiostro(c, pl, 1.5, 0.85);
  c.save(); c.globalCompositeOperation = 'lighter'; alone(c, cx, yP + 0.32 * s, 0.25 * s, '#fff0b0', 0.6); c.restore();
}

/** Scala a pioli appoggiata alla libreria (con la sua ombra morbida). */
function scalaPioli(Q, x0, x1, yPav, yTop) {
  const { c, r, s } = Q, st = 0.06 * s;
  const disegna = (k, col) => {
    k.fillStyle = col; k.fillRect(x0, yTop, st, yPav - yTop); k.fillRect(x1 - st, yTop, st, yPav - yTop);
    for (let y = yPav - 0.3 * s; y > yTop + 0.1 * s; y -= 0.3 * s) k.fillRect(x0, y, x1 - x0, 0.045 * s);
  };
  morbido(Q, (k) => { k.translate(0.12 * s, 0.03 * s); disegna(k, conAlfa('#2c1830', 0.7)); }, { f: 5 });
  c.save(); disegna(c, '#dba66c'); c.restore(); c.fillStyle = 'rgba(255,245,220,0.5)';
  c.fillRect(x0 + st * 0.2, yTop, st * 0.25, yPav - yTop); c.fillRect(x1 - st * 0.8, yTop, st * 0.25, yPav - yTop);
  inchiostro(c, rettMano(r, x0, yTop, st, yPav - yTop, 0.5), 1.7, 0.9); inchiostro(c, rettMano(r, x1 - st, yTop, st, yPav - yTop, 0.5), 1.7, 0.9);
  for (let y = yPav - 0.3 * s; y > yTop + 0.1 * s; y -= 0.3 * s) inchiostro(c, rettMano(r, x0 + st, y, x1 - x0 - 2 * st, 0.045 * s, 0.4), 1.3, 0.85);
  for (const x of [x0 + st / 2, x1 - st / 2]) {            // ganci in alto e rotelle in basso
    inchiostro(c, Forme.curva([[x, yTop + 0.02 * s], [x + 0.02 * s, yTop - 0.06 * s], [x + 0.05 * s, yTop - 0.03 * s]]), 0.018 * s, 1, '#c9a24f');
    const ruota = Forme.cerchio(x, yPav - 0.035 * s, 0.035 * s);
    macchia(c, ruota, '#6d5a52', [x - 0.04 * s, yPav - 0.07 * s, 0.08 * s, 0.08 * s]); inchiostro(c, ruota, 1, 0.8);
  }
}

/** Pila di libri sul pavimento (centrata in cx). */
function pilaLibri(c, r, cx, yPav, s, n) {
  let y = yPav;
  for (let i = 0; i < n; i++) {
    const l = tra(r, 0.32, 0.45) * s, a = tra(r, 0.05, 0.085) * s; libro(c, r, cx - l / 2 + tra(r, -0.03, 0.03) * s, y - a, l, a); y -= a;
  }
}

/** Ombre negli angoli della stanza e sotto il soffitto (lati: 'sinistra', 'destra', 'alto', 'basso'). */
function angoli(Q, lati, forza) {
  const { W, H, s } = Q;
  morbido(Q, (k) => {
    const o = conAlfa(OMBRA, forza || 0.45), z = conAlfa(OMBRA, 0); if (lati.includes('sinistra')) sfuma(k, 0, 0, 0.5 * s, H, [[0, o], [1, z]], true);
    if (lati.includes('destra')) sfuma(k, W - 0.5 * s, 0, 0.5 * s, H, [[0, z], [1, o]], true);
    if (lati.includes('alto')) sfuma(k, 0, 0, W, 0.45 * s, [[0, o], [1, z]]);
    if (lati.includes('basso')) sfuma(k, 0, H - 0.12 * s, W, 0.12 * s, [[0, z], [1, o]]);
  }, { f: 4 });
}

/** Parete di fondo: librerie, la finestra ad arco, la scala, la lampada da lettura. */
function pareteFondoLibreria() {
  const s = 220, Q = quadro(12, ALTO, s, 121), { c, r, W, H } = Q; const X = (x) => (x + 1.5) * s, Y = (y) => (ALTO - y) * s;
  lava(c, Forme.rettangolo(0, 0, W, H), '#efdcb8', [0, 0, W, H], r, { var: 0.25, luce: true, fioriture: 6, bordo: 0 });
  scaffale(Q, X(-1.5), X(3.3), Y(0), 0); scaffale(Q, X(5.7), X(10.5), Y(0), 0);
  scaffale(Q, X(3.36), X(5.64), Y(0), Y(0.72), { ripiani: 1, colonne: 2 }); finestraArco(Q, X(3.5), X(5.5), Y(0.82), Y(3.3));
  inchiostro(c, Forme.curva([[X(3.15), Y(3.42)], [X(5.85), Y(3.42)]]), 0.03 * s, 1, '#b48a4a');   // bastone delle tende
  tenda(Q, X(3.3), Y(3.42), Y(0.86), 1); tenda(Q, X(5.7), Y(3.42), Y(0.86), -1); c.save(); c.globalCompositeOperation = 'screen';
  alone(c, X(4.5), Y(1.9), 2.3 * s, '#fff1cf', 0.45); c.restore();
  inchiostro(c, Forme.curva([[X(5.72), Y(3.27)], [X(10.48), Y(3.27)]]), 0.025 * s, 1, '#c99d4a');   // corrimano d'ottone
  inchiostro(c, Forme.curva([[X(5.72), Y(3.275)], [X(10.48), Y(3.275)]]), 0.007 * s, 0.8, '#f6e2a2'); scalaPioli(Q, X(7.55), X(8.1), Y(0), Y(3.24));
  lampadaStelo(Q, X(2.95), Y(0), Y(1.75)); pilaLibri(c, r, X(6.45), Y(0), s, 6); angoli(Q, ['sinistra', 'destra', 'alto', 'basso'], 0.5); carta(Q);
  return Q;
}

/** Porta a vetri dell'ingresso con il campanello (pixel; yTop = cima dell'anta). */
function portaIngresso(Q, x0, x1, yPav, yTop) {
  const { c, r, s } = Q, l = x1 - x0, a = yPav - yTop, t = 0.09 * s, verde = '#5f9b8b';
  lava(c, Forme.rettangolo(x0 - t, yTop - t, l + 2 * t, a + t), LEGNO, [x0 - t, yTop - t, l + 2 * t, a + t], r, { var: 0.2, bordo: 0.4 });
  inchiostro(c, rettMano(r, x0 - t, yTop - t, l + 2 * t, a + t, 0.5), 1.5, 0.8);
  lava(c, Forme.rettangolo(x0, yTop, l, a), verde, [x0, yTop, l, a], r, { luce: true, var: 0.28, bordo: 0.4 });
  const gx = x0 + 0.1 * s, gy = yTop + 0.1 * s, gl = l - 0.2 * s, ga = a * 0.55; c.save(); c.beginPath(); c.rect(gx, gy, gl, ga); c.clip();
  sfuma(c, gx, gy, gl, ga, [[0, '#fffbe8'], [1, '#e2f0e6']]);
  alone(c, gx + gl * 0.3, gy + ga * 0.75, 0.35 * s, '#f2b9a6', 0.5);   // la via là fuori, appena accennata
  alone(c, gx + gl * 0.8, gy + ga * 0.6, 0.3 * s, '#b9d99c', 0.45); c.fillStyle = 'rgba(255,255,255,0.5)';
  c.beginPath(); c.moveTo(gx, gy + ga * 0.7); c.lineTo(gx + gl * 0.6, gy); c.lineTo(gx + gl * 0.8, gy); c.lineTo(gx, gy + ga * 0.95); c.fill();
  c.restore();
  c.fillStyle = verde;                                    // traversine dei vetri
  c.fillRect(gx + gl / 2 - 0.018 * s, gy, 0.036 * s, ga); for (const f of [1 / 3, 2 / 3]) c.fillRect(gx, gy + ga * f - 0.018 * s, gl, 0.036 * s);
  inchiostro(c, rettMano(r, gx, gy, gl, ga, 0.4), 1.3, 0.8);
  for (const k of [0, 1]) {                               // due specchiature in basso
    const px = gx + k * (gl / 2 + 0.03 * s), py = gy + ga + 0.12 * s, pl = gl / 2 - 0.03 * s, pa = yPav - py - 0.12 * s;
    macchia(c, Forme.rettangolo(px, py, pl, pa, 2), schiarisci(verde, 0.15), [px, py, pl, pa], 0.5);
    inchiostro(c, rettMano(r, px, py, pl, pa, 0.4), 1.2, 0.7);
  }
  const pomo = Forme.cerchio(x1 - 0.09 * s, yPav - 1.0 * s, 0.035 * s);
  macchia(c, pomo, '#e2b64f', [x1 - 0.13 * s, yPav - 1.04 * s, 0.08 * s, 0.08 * s]); inchiostro(c, pomo, 1.2, 0.8);
  inchiostro(c, rettMano(r, x0, yTop, l, a, 0.5), 1.6, 0.85);
  // il campanello su una molla a ricciolo, in alto a destra
  const bx = x1 - 0.22 * s, by = yTop + 0.2 * s;
  inchiostro(c, Forme.curva([[x1 - 0.02 * s, yTop + 0.02 * s], [x1 - 0.12 * s, yTop + 0.01 * s], [bx - 0.04 * s, yTop + 0.08 * s], [bx + 0.04 * s, yTop + 0.1 * s], [bx, by - 0.06 * s]]), 0.014 * s, 1, '#8c6a38');
  const camp = new Path2D(); camp.moveTo(bx - 0.075 * s, by + 0.08 * s); camp.quadraticCurveTo(bx - 0.06 * s, by - 0.06 * s, bx, by - 0.065 * s);
  camp.quadraticCurveTo(bx + 0.06 * s, by - 0.06 * s, bx + 0.075 * s, by + 0.08 * s); camp.closePath();
  macchia(c, camp, '#e6b84a', [bx - 0.08 * s, by - 0.07 * s, 0.16 * s, 0.16 * s], 0.5); inchiostro(c, camp, 1.4, 0.9);
  c.fillStyle = '#9a7434'; c.beginPath(); c.arc(bx, by + 0.095 * s, 0.018 * s, 0, TAU); c.fill();
  c.save(); c.globalCompositeOperation = 'screen'; alone(c, gx + gl / 2, gy + ga / 2, 0.9 * s, '#fff4d8', 0.5); c.restore();
}

/** Mappamondo a treppiede appoggiato sul pavimento. */
function mappamondo(Q, cx, yPav, R) {
  const { c, r, s } = Q, cy = yPav - 0.5 * s - R;
  for (const dx of [-0.24, 0, 0.24]) inchiostro(c, Forme.curva([[cx, yPav - 0.5 * s], [cx + dx * s, yPav]]), 0.03 * s, 1, '#8f5d3c');
  inchiostro(c, Forme.curva([[cx, yPav - 0.5 * s], [cx, cy + R]]), 0.03 * s, 1, '#8f5d3c'); const sfera = Forme.cerchio(cx, cy, R);
  lava(c, sfera, '#8fc4dd', [cx - R, cy - R, 2 * R, 2 * R], r, { n: 4, var: 0.25, bordo: 0.4 }); c.save(); c.clip(sfera);
  for (let i = 0; i < 4; i++) {
    const t = Forme.poligono(blob(r, cx + tra(r, -0.7, 0.7) * R, cy + tra(r, -0.6, 0.6) * R, R * tra(r, 0.2, 0.42), R * tra(r, 0.15, 0.35), 9, 0.4), true);
    macchia(c, t, scegli(r, ['#a9cf8a', '#e5c47e', '#c6dc93']), [cx - R, cy - R, 2 * R, 2 * R], 0.5); inchiostro(c, t, 1, 0.55);
  }
  const g = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, 0, cx, cy, R * 1.1);
  g.addColorStop(0, 'rgba(255,252,240,0.5)'); g.addColorStop(0.5, 'rgba(255,252,240,0)'); g.addColorStop(1, conAlfa(OMBRA, 0.4));
  c.fillStyle = g; c.fillRect(cx - R, cy - R, 2 * R, 2 * R); c.restore(); inchiostro(c, sfera, 1.6, 0.85);
  c.save(); c.strokeStyle = '#c99d4a'; c.lineWidth = 0.02 * s;
  c.beginPath(); c.ellipse(cx, cy, R * 1.13, R * 1.13, 0, Math.PI * 0.6, Math.PI * 2.4); c.stroke(); c.restore();
}

/** Grande pianta verde in un vaso di terracotta. */
function piantaGrande(Q, cx, yPav, h) {
  const { c, r, s } = Q;
  for (let i = 0; i < 34; i++) {
    const a = -Math.PI / 2 + tra(r, -1.15, 1.15), d = h * tra(r, 0.3, 0.9);
    const bx = cx + Math.cos(a) * d * 0.4, by = yPav - 0.4 * s + Math.sin(a) * d;
    inchiostro(c, Forme.curva([[cx, yPav - 0.38 * s], [bx, by]]), 0.012 * s, 0.7, '#5b7d48');
    foglia(c, bx, by, a + tra(r, -0.6, 0.6), 0.24 * s * tra(r, 0.8, 1.2), 0.08 * s, scegli(r, VERDI), 0.65);
  }
  vaso(c, r, cx, yPav, 0.42 * s, 0.42 * s, '#d98a5f');
}

/** Poltroncina di velluto rosso vista di fronte (base al centro cx). */
function poltrona(Q, cx, yPav) {
  const { c, r, s } = Q, rosso = '#cf5f55';
  const pezzo = (x, y, l, a, rag, col) => {
    const f = Forme.rettangolo(x, y, l, a, rag); lava(c, f, col, [x, y, l, a], r, { n: 3, luce: true, bordo: 0.4, lb: 2 });
    inchiostro(c, f, 1.5, 0.85);
  };
  for (const dx of [-0.42, 0.36]) pezzo(cx + dx * s, yPav - 0.1 * s, 0.06 * s, 0.1 * s, 2, '#6d4632');
  pezzo(cx - 0.42 * s, yPav - 1.05 * s, 0.84 * s, 0.7 * s, 0.2 * s, rosso);          // schienale
  pezzo(cx - 0.4 * s, yPav - 0.5 * s, 0.8 * s, 0.22 * s, 0.06 * s, schiarisci(rosso, 0.12)); // cuscino
  pezzo(cx - 0.5 * s, yPav - 0.62 * s, 0.17 * s, 0.53 * s, 0.07 * s, rosso);          // braccioli
  pezzo(cx + 0.33 * s, yPav - 0.62 * s, 0.17 * s, 0.53 * s, 0.07 * s, rosso);
  pezzo(cx - 0.34 * s, yPav - 0.3 * s, 0.68 * s, 0.2 * s, 0.03 * s, scurisci(rosso, 0.1));
}

/** Parete di sinistra (guarda verso destra): librerie, pianta, porta a vetri col campanello, mappamondo. */
function pareteSinistraLibreria() {
  const s = 220, Q = quadro(6.5, ALTO, s, 141), { c, r, W, H } = Q;
  const U = (z) => (3.5 - z) * s, Y = (y) => (ALTO - y) * s;      // a sinistra dell'immagine c'è z = 3.5
  lava(c, Forme.rettangolo(0, 0, W, H), '#ecd6b0', [0, 0, W, H], r, { var: 0.25, luce: true, fioriture: 4, bordo: 0 });
  scaffale(Q, U(3.5), U(1.95), Y(0), 0); scaffale(Q, U(0.05), U(-3), Y(0), 0); portaIngresso(Q, U(1.35), U(0.3), Y(0), Y(2.22));
  piantaGrande(Q, U(1.62), Y(0), 1.0 * s); mappamondo(Q, U(-0.45), Y(0), 0.25 * s); angoli(Q, ['destra', 'alto', 'basso'], 0.5); carta(Q);
  return Q;
}

/** Parete di destra (guarda verso sinistra): librerie, poltrona, applique, quadro con la mappa. */
function pareteDestraLibreria() {
  const s = 220, Q = quadro(6.5, ALTO, s, 151), { c, r, W, H } = Q;
  const U = (z) => (z + 3) * s, Y = (y) => (ALTO - y) * s;        // a sinistra dell'immagine c'è z = -3
  lava(c, Forme.rettangolo(0, 0, W, H), '#ecd6b0', [0, 0, W, H], r, { var: 0.25, luce: true, fioriture: 4, bordo: 0 });
  scaffale(Q, U(-3), U(1.3), Y(0), 0);
  // quadro con una vecchia carta geografica
  const qx = U(1.72), qy = Y(2.8), ql = 1.16 * s, qa = 0.78 * s, mx = qx + 0.07 * s, my = qy + 0.07 * s, ml = ql - 0.14 * s, ma = qa - 0.14 * s;
  lava(c, Forme.rettangolo(qx, qy, ql, qa), LEGNO, [qx, qy, ql, qa], r, { n: 2, bordo: 0.4 });
  lava(c, Forme.rettangolo(mx, my, ml, ma), '#a9cfe0', [mx, my, ml, ma], r, { n: 6, var: 0.3, bordo: 0.3, tinta: '#cfe4dc' });
  c.save(); c.beginPath(); c.rect(mx, my, ml, ma); c.clip();
  for (const [u, v, rx, ry] of [[0.25, 0.4, 0.22, 0.17], [0.62, 0.3, 0.2, 0.12], [0.75, 0.72, 0.16, 0.13], [0.35, 0.8, 0.1, 0.07]]) {
    const t = Forme.poligono(blob(r, mx + u * ml, my + v * ma, rx * s, ry * s, 12, 0.35), true);
    macchia(c, t, scegli(r, ['#d9e2a4', '#ecd59a', '#c8dc9c']), [mx, my, ml, ma], 0.4); inchiostro(c, t, 1, 0.6);
  }
  c.setLineDash([5, 5]); inchiostro(c, Forme.curva([[mx + 0.3 * ml, my + 0.45 * ma], [mx + 0.5 * ml, my + 0.65 * ma], [mx + 0.72 * ml, my + 0.68 * ma]]), 1.4, 0.7, '#b8483f'); c.setLineDash([]);
  c.restore();
  const rosa = [];                                          // rosa dei venti
  for (let i = 0; i < 8; i++) { const rr = (i % 2 ? 0.025 : 0.08) * s, a = (i / 8) * TAU; rosa.push([mx + ml * 0.88 + Math.cos(a) * rr, my + ma * 0.22 + Math.sin(a) * rr]); }
  macchia(c, Forme.poligono(rosa), '#f3e6c4', [mx + ml * 0.8, my, 0.2 * s, 0.2 * s]); inchiostro(c, Forme.poligono(rosa), 1, 0.8);
  inchiostro(c, rettMano(r, mx, my, ml, ma, 0.4), 1.1, 0.7); inchiostro(c, rettMano(r, qx, qy, ql, qa, 0.5), 1.5, 0.85);
  // applique con la sua luce calda
  const ax = U(2.3), ay = Y(1.58);
  c.save(); c.globalCompositeOperation = 'lighter'; alone(c, ax, ay + 0.1 * s, 0.8 * s, '#ffc86a', 0.25); c.restore();
  inchiostro(c, Forme.curva([[ax, ay + 0.2 * s], [ax + 0.05 * s, ay + 0.05 * s], [ax, ay - 0.1 * s]]), 0.018 * s, 1, '#b48a4a');
  const pia = Forme.ellisse(ax, ay + 0.2 * s, 0.04 * s, 0.03 * s);
  macchia(c, pia, '#c99d4a', [ax - 0.04 * s, ay + 0.17 * s, 0.08 * s, 0.06 * s]); inchiostro(c, pia, 1, 0.8);
  const par = Forme.poligono([[ax - 0.08 * s, ay - 0.1 * s], [ax + 0.08 * s, ay - 0.1 * s], [ax + 0.13 * s, ay + 0.1 * s], [ax - 0.13 * s, ay + 0.1 * s]]);
  lava(c, par, '#f0b062', [ax - 0.13 * s, ay - 0.1 * s, 0.26 * s, 0.2 * s], r, { n: 2, luce: true, lb: 2 }); inchiostro(c, par, 1.4, 0.85);
  morbido(Q, (k) => { k.fillStyle = conAlfa(OMBRA, 0.5); k.beginPath(); k.ellipse(U(2.38), Y(0.5), 0.55 * s, 0.55 * s, 0, 0, TAU); k.fill(); }, { f: 8 });
  poltrona(Q, U(2.3), Y(0)); piantaGrande(Q, U(3.15), Y(0), 0.9 * s); angoli(Q, ['sinistra', 'alto', 'basso'], 0.5); carta(Q);
  return Q;
}

/** Soffitto con le travi di legno (l'immagine guarda in basso: in alto c'è z = 3.5). */
function soffittoLibreria() {
  const s = 100, Q = quadro(12, 6.5, s, 131), { c, r, W, H } = Q; const X = (x) => (x + 1.5) * s, Z = (z) => (3.5 - z) * s;
  lava(c, Forme.rettangolo(0, 0, W, H), '#efe1c4', [0, 0, W, H], r, { var: 0.25, fioriture: 5, bordo: 0 });
  for (let z = -2.55; z < 3.5; z += 1.1) {
    const y = Z(z) - 0.11 * s; sfuma(c, 0, y - 0.15 * s, W, 0.15 * s, [[0, conAlfa(OMBRA, 0)], [1, conAlfa(OMBRA, 0.3)]]);
    sfuma(c, 0, y + 0.22 * s, W, 0.15 * s, [[0, conAlfa(OMBRA, 0.3)], [1, conAlfa(OMBRA, 0)]]);
    lava(c, Forme.rettangolo(0, y, W, 0.22 * s), '#9d6643', [0, y, W, 0.22 * s], r, { var: 0.3, n: 12, bordo: 0.4, lb: 2 });
    c.fillStyle = 'rgba(255,230,190,0.2)'; c.fillRect(0, y + 0.06 * s, W, 0.05 * s); inchiostro(c, mano(r, [[0, y], [W, y]], false, 0.6), 1.2, 0.7);
    inchiostro(c, mano(r, [[0, y + 0.22 * s], [W, y + 0.22 * s]], false, 0.6), 1.2, 0.7);
  }
  for (const x of [2.25, 6.75]) {                                  // rosoni delle lampade
    const f = Forme.cerchio(X(x), Z(-0.8), 0.08 * s);
    macchia(c, f, '#c99d4a', [X(x) - 0.08 * s, Z(-0.8) - 0.08 * s, 0.16 * s, 0.16 * s]); inchiostro(c, f, 1.2, 0.8);
    c.save(); c.globalCompositeOperation = 'lighter'; alone(c, X(x), Z(-0.8), 1.3 * s, '#ffcf80', 0.2); c.restore();
  }
  angoli(Q, ['sinistra', 'destra', 'basso'], 0.4); carta(Q);
  return Q;
}

/** Pavimento di parquet con il tappeto tondo, la luce della finestra e lo zerbino. */
function pavimentoLibreria() {
  const s = 170, Q = quadro(12, 6.5, s, 111), { c, r, W, H } = Q; const X = (x) => (x + 1.5) * s, Z = (z) => (z + 3) * s;
  const PARQUET = ['#d8a56f', '#cf9a63', '#e0b27e', '#c98f5a', '#dcaa72', '#d39f69'], la = 0.15 * s;
  for (let i = 0; i * la < W; i++) {                               // assi lungo la profondità
    const x = i * la;
    for (let y = -r() * 1.2 * s; y < H;) {
      const lu = tra(r, 0.7, 1.5) * s, col = mescola(scegli(r, PARQUET), scegli(r, PARQUET), r()); c.fillStyle = col; c.fillRect(x, y, la, lu);
      sfuma(c, x, y, la, lu, [[0, 'rgba(255,245,225,0.22)'], [0.5, 'rgba(255,245,225,0)'], [1, 'rgba(110,60,50,0.12)']], true);
      c.strokeStyle = conAlfa(scurisci(col, 0.35), 0.22); c.lineWidth = 1; c.beginPath();
      for (let k = 0; k < 3; k++) { const gx = x + la * tra(r, 0.15, 0.85); c.moveTo(gx, y + 4); c.bezierCurveTo(gx + tra(r, -3, 3), y + lu * 0.3, gx + tra(r, -3, 3), y + lu * 0.7, gx + tra(r, -2, 2), y + lu - 4); }
      c.stroke(); inchiostro(c, mano(r, [[x, y], [x + la, y]], false, 0.4), 1, 0.4); y += lu;
    }
    inchiostro(c, mano(r, [[x, 0], [x, H]], false, 0.5), 1, 0.35);
  }
  for (let i = 0; i < 40; i++) alone(c, r() * W, r() * H, tra(r, 0.4, 1.4) * s, r() < 0.5 ? '#fff1d6' : '#a8673e', 0.12);
  tappeto(Q, X(4.5), Z(0.25), 1.45 * s);
  const zx = X(-1.5), zy = Z(0.25);                                // zerbino davanti alla porta
  lava(c, Forme.rettangolo(zx + 0.05 * s, zy, 0.6 * s, 1.0 * s, 4), '#c9a46a', [zx, zy, 0.7 * s, 1.0 * s], r, { n: 4, var: 0.3 });
  inchiostro(c, rettMano(r, zx + 0.05 * s, zy, 0.6 * s, 1.0 * s, 0.5), 1.3, 0.7);
  inchiostro(c, rettMano(r, zx + 0.11 * s, zy + 0.06 * s, 0.48 * s, 0.88 * s, 0.5), 1, 0.5, '#8a5a3c');
  morbido(Q, (k) => {                                              // luce: dalla finestra e dalla porta
    k.fillStyle = 'rgba(255,240,205,0.55)';
    k.beginPath(); k.moveTo(X(3.5), 0); k.lineTo(X(5.5), 0); k.lineTo(X(6.4), Z(-0.6)); k.lineTo(X(2.7), Z(-0.6)); k.fill();
    k.beginPath(); k.moveTo(X(-1.5), Z(0.3)); k.lineTo(X(-1.5), Z(1.3)); k.lineTo(X(0.2), Z(1.7)); k.lineTo(X(0.2), Z(0.1)); k.fill();
  }, { f: 10, modo: 'screen' });
  morbido(Q, (k) => {                                              // ombre di contatto lungo i muri
    k.fillStyle = conAlfa(OMBRA, 0.55); k.fillRect(0, 0, W, 0.1 * s); k.fillRect(0, 0, 0.1 * s, H); k.fillRect(W - 0.1 * s, 0, 0.1 * s, H);
    k.beginPath(); k.ellipse(X(6.45), Z(-2.85), 0.3 * s, 0.1 * s, 0, 0, TAU); k.fill();
  }, { f: 12, alfa: 0.8 });
  carta(Q);
  return Q;
}

/** Il tappeto tondo con il medaglione e le frange. */
function tappeto(Q, cx, cy, R) {
  const { c, r } = Q; c.strokeStyle = conAlfa('#f3e3c4', 0.9); c.lineWidth = 2; c.beginPath();
  for (let a = 0; a < TAU; a += 0.035) { c.moveTo(cx + Math.cos(a) * R * 0.99, cy + Math.sin(a) * R * 0.99); c.lineTo(cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 1.05); }
  c.stroke(); const anelli = [[1, '#c4524a'], [0.9, '#f1dfbd'], [0.8, '#e38a52'], [0.73, '#d65f52']];
  for (const [k, col] of anelli) {
    const f = Forme.poligono(blob(r, cx, cy, R * k, R * k, 48, 0.006), true);
    lava(c, f, col, [cx - R, cy - R, 2 * R, 2 * R], r, { n: 6, var: 0.25, bordo: 0.3 }); inchiostro(c, f, 1.4, 0.6);
  }
  for (let i = 0; i < 40; i++) {                                    // motivo sulla fascia chiara
    const a = (i / 40) * TAU, x = cx + Math.cos(a) * R * 0.85, y = cy + Math.sin(a) * R * 0.85; c.fillStyle = i % 2 ? '#4f9f95' : '#d65f52';
    c.beginPath(); c.ellipse(x, y, R * 0.025, R * 0.04, a, 0, TAU); c.fill();
  }
  for (let i = 0; i < 8; i++) {                                     // petali del medaglione
    const a = (i / 8) * TAU, x = cx + Math.cos(a) * R * 0.42, y = cy + Math.sin(a) * R * 0.42; const f = Forme.ellisse(x, y, R * 0.2, R * 0.09, a);
    macchia(c, f, i % 2 ? '#f0c45e' : '#f4d9a0', [x - R * 0.2, y - R * 0.2, R * 0.4, R * 0.4]); inchiostro(c, f, 1.1, 0.6);
  }
  const stella = [];
  for (let i = 0; i < 16; i++) { const rr = R * (i % 2 ? 0.1 : 0.22), a = (i / 16) * TAU; stella.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const f = Forme.poligono(stella, false); macchia(c, f, '#4f9f95', [cx - R * 0.22, cy - R * 0.22, R * 0.44, R * 0.44]); inchiostro(c, f, 1.2, 0.7);
  c.fillStyle = '#f6e7c2'; c.beginPath(); c.arc(cx, cy, R * 0.06, 0, TAU); c.fill();
}

/** Lampada appesa (strato verticale a parte): filo, cupola di vetro verde, luce. */
function lampadaAppesa(seme) {
  const s = 200, Q = quadro(0.6, 1.05, s, seme), { c, r, W } = Q, cx = W / 2, yT = 0.5 * s, yB = 0.72 * s, rr = 0.22 * s;
  inchiostro(c, Forme.curva([[cx, 0], [cx, yT]]), 2, 0.9);
  c.save(); c.globalCompositeOperation = 'lighter'; alone(c, cx, yB + 0.02 * s, 0.3 * s, '#ffd27a', 0.55); c.restore(); const cup = new Path2D();
  cup.moveTo(cx - rr, yB); cup.bezierCurveTo(cx - rr * 0.95, yT + 0.02 * s, cx - 0.05 * s, yT, cx, yT);
  cup.bezierCurveTo(cx + 0.05 * s, yT, cx + rr * 0.95, yT + 0.02 * s, cx + rr, yB); cup.closePath();
  lava(c, cup, '#4f9a82', [cx - rr, yT, 2 * rr, yB - yT], r, { n: 3, luce: true, bordo: 0.45, lb: 2 });
  c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(cx - rr * 0.45, yT + 0.1 * s, 0.025 * s, 0.07 * s, 0.5, 0, TAU); c.fill();
  inchiostro(c, cup, 1.6, 0.9); const lamp = Forme.ellisse(cx, yB + 0.01 * s, rr * 0.4, 0.035 * s);
  c.fillStyle = '#fff4c8'; c.fill(lamp); inchiostro(c, lamp, 1.1, 0.6);
  c.fillStyle = '#c99d4a'; c.fillRect(cx - 0.025 * s, yT - 0.03 * s, 0.05 * s, 0.04 * s); carta(Q, 0.25);
  return Q;
}

/* ============================ 5. TERRAZZA ================================ */
const MATTONI = ['#e9967a', '#eea585', '#dd8466', '#f2b093', '#e48e73', '#d97c60'];
const PASTELLI = ['#f3b6b0', '#f6d48f', '#bcdcc4', '#b7d0ea', '#d8c3e6', '#f7c9a0', '#f0e3b4', '#c9e0a8', '#f5bfd2', '#a9cbd6'];
const TETTI = ['#e0875c', '#d8704f', '#e99a6a', '#c96a4e', '#8f9fbf', '#d9805e'];
// i vasi ai piedi del muretto: [x, larghezza, altezza, pianta]
const VASI_TERRAZZA = [[2.35, 0.36, 0.32, 'geranio'], [3.0, 0.24, 0.2, 'margherite'], [8.6, 0.28, 0.24, 'lavanda'],
  [12.7, 0.3, 0.28, 'lavanda'], [14.85, 0.42, 0.36, 'foglie'], [15.5, 0.26, 0.22, 'geranio']];

/** Ciuffetti di muschio verde-oliva. */
function muschio(c, r, x, y, rr) {
  for (let i = 0; i < 9; i++) {
    c.globalAlpha = tra(r, 0.45, 0.8); c.fillStyle = scegli(r, ['#93a85c', '#7d9a52', '#b5c47a', '#6f8c4a']);
    c.beginPath(); c.ellipse(x + tra(r, -1, 1) * rr, y + tra(r, -0.5, 0.5) * rr, rr * tra(r, 0.2, 0.5), rr * tra(r, 0.15, 0.35), r() * 3, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}

/** Pavimento di cotto con muschio e le ombre dei vasi. */
function pavimentoTerrazza() {
  const s = 150, Q = quadro(18, 5.2, s, 211), { c, r, W, H } = Q; const X = (x) => (x + 2) * s, Z = (z) => (z + 2.2) * s;
  lava(c, Forme.rettangolo(0, 0, W, H), '#ead2b8', [0, 0, W, H], r, { var: 0.2, bordo: 0, n: 30 }); const lato = 0.4 * s, fuga = 0.03 * s;
  for (let y = 0; y < H; y += lato) {
    for (let x = 0; x < W; x += lato) {
      const f = Forme.poligono(puntiMattone(r, x + fuga / 2, y + fuga / 2, lato - fuga, lato - fuga, 0.05));
      macchia(c, f, mescola(scegli(r, COTTO), scegli(r, COTTO), r() * 0.6), [x, y, lato, lato], 0.35); if (r() < 0.3) inchiostro(c, f, 0.9, 0.3);
    }
  }
  for (let i = 0; i < 50; i++) alone(c, r() * W, r() * H, tra(r, 0.3, 1.2) * s, r() < 0.55 ? '#fff0dc' : '#b9674a', 0.14);
  for (let i = 0; i < 60; i++) {                                     // muschio: lungo il muretto e qua e là
    const vicino = i < 34, x = r() * W, y = vicino ? tra(r, 0, 0.25) * s : Math.round(r() * H / lato) * lato;
    muschio(c, r, x, y, tra(r, 0.05, 0.12) * s);
  }
  for (let i = 0; i < 18; i++) { const x = X(tra(r, 1.5, 15.8)), y = Z(tra(r, -2.1, -1.4)); c.fillStyle = conAlfa('#f07a8a', 0.8); c.beginPath(); c.ellipse(x, y, 3, 2, r() * 3, 0, TAU); c.fill(); }
  morbido(Q, (k) => {                                                // ombre: muretto, casotto, vasi
    k.fillStyle = conAlfa(OMBRA, 0.45); k.fillRect(0, 0, W, 0.12 * s); k.fillStyle = conAlfa(OMBRA, 0.5); k.fillRect(0, 0, X(1.5), 0.3 * s);
    for (const [x, l] of VASI_TERRAZZA) { k.beginPath(); k.ellipse(X(x + 0.06), Z(-2.08), l * 0.75 * s, 0.1 * s, 0, 0, TAU); k.fill(); }
    k.beginPath(); k.ellipse(X(4.12), Z(-1.55), 0.2 * s, 0.07 * s, 0, 0, TAU); k.ellipse(X(10.88), Z(-1.55), 0.2 * s, 0.07 * s, 0, 0, TAU); k.fill();
  }, { f: 8, alfa: 0.8 });
  sfuma(c, 0, 0, W, H, [[0, 'rgba(255,248,230,0)'], [1, 'rgba(255,248,230,0.25)']]); carta(Q);
  sfumaBordi(Q.tela, 0.9 * s, ['sinistra', 'destra', 'basso']);
  return Q;
}

/** Il muretto di mattoni con la ringhiera di ferro leggera (tra le sbarre resta trasparente). */
function ringhiera() {
  const s = 200, Q = quadro(14.5, 1.1, s, 221), { c, r, W, H } = Q; const X = (x) => (x - 1.5) * s, Y = (y) => (1.1 - y) * s;
  const yM = Y(0.55), yC = Y(0.645), hm = 0.55 / 6 * s, lm = 0.25 * s, g = 0.014 * s;
  lava(c, Forme.rettangolo(0, yM, W, H - yM), '#efdcc6', [0, yM, W, H - yM], r, { var: 0.15, bordo: 0 });
  for (let j = 0; j < 6; j++) {                                      // mattoni a correre
    const y = H - (j + 1) * hm;
    for (let x = -(j % 2) * lm / 2; x < W; x += lm) {
      const f = Forme.poligono(puntiMattone(r, x + g / 2, y + g / 2, lm - g, hm - g, 0.2));
      macchia(c, f, mescola(scegli(r, MATTONI), scegli(r, MATTONI), r() * 0.5), [x, y, lm, hm], 0.35); if (r() < 0.5) inchiostro(c, f, 0.9, 0.35);
    }
  }
  c.save(); c.globalCompositeOperation = 'source-atop';              // umido e muschio alla base
  for (let i = 0; i < 40; i++) alone(c, r() * W, H - r() * 0.1 * s, tra(r, 0.08, 0.25) * s, r() < 0.6 ? '#8d9f68' : '#fff6e8', 0.35);
  c.restore();
  sfuma(c, 0, yM, W, 0.07 * s, [[0, conAlfa(OMBRA, 0.45)], [1, conAlfa(OMBRA, 0)]]);
  for (let x = 0; x < W;) {                                          // copertina di pietra
    const l = tra(r, 0.5, 0.8) * s;
    lava(c, Forme.rettangolo(x + 1, yC, l - 2, yM - yC + 2, 2), scegli(r, ['#efe4cc', '#e8dcc0', '#f3ead6']), [x, yC, l, yM - yC], r, { n: 2, var: 0.2, bordo: 0.3, lb: 2 });
    inchiostro(c, rettMano(r, x + 1, yC, l - 2, yM - yC + 2, 0.4), 1.1, 0.7); x += l;
  }
  const ferro = '#4f5b7a', yT = Y(1.1), yR = Y(1.055), yB = Y(0.69); c.fillStyle = ferro;
  for (let x = X(1.6), k = 0; x < W - 0.03 * s; x += 0.115 * s, k++) {
    const palo = k % 18 === 0, l = palo ? 0.04 * s : 0.018 * s; c.fillStyle = ferro; c.fillRect(x - l / 2, yR, l, yC - yR);
    c.fillStyle = 'rgba(220,228,245,0.45)'; c.fillRect(x - l / 2, yR, l * 0.3, yC - yR);
    if (k % 2 === 0) { c.strokeStyle = ferro; c.lineWidth = 0.009 * s; c.beginPath(); c.arc(x + 0.0575 * s, Y(0.86), 0.03 * s, 0, TAU); c.stroke(); }
  }
  for (const [y, a] of [[yT, yR - yT + 2], [yB, 0.02 * s]]) {
    const f = Forme.rettangolo(0, y, W, a, a / 2); c.fillStyle = ferro; c.fill(f);
    c.fillStyle = 'rgba(220,228,245,0.5)'; c.fillRect(0, y + 1, W, a * 0.3); inchiostro(c, mano(r, [[0, y], [W, y]], false, 0.4), 1, 0.6);
  }
  const edera = rami(r, X(8.0), X(9.5), yM, 0.15, 0.45, 9, s);        // edera che ricade dal muretto
  edera.fiori.length = 0; disegnaRami(c, r, edera);
  for (const [x, l, a, tipo] of VASI_TERRAZZA) {
    pianta(c, r, X(x), Y(a * 0.85), l * 0.95 * s, tipo); vaso(c, r, X(x), H, l * s, a * s);
  }
  carta(Q); sfumaBordi(Q.tela, 0.7 * s, ['destra']);
  return Q;
}

/** Comignolo: blocco di muratura (x0..x1, yB..yT) con il vaso di coccio o il cappello di tegole. */
function comignolo(Q, x0, x1, yB, yT, vasoCoccio) {
  const { c, r, s } = Q, l = x1 - x0;
  lava(c, Forme.rettangolo(x0, yT, l, yB - yT), '#efd8b4', [x0, yT, l, yB - yT], r, { n: 3, luce: true, bordo: 0.4, lb: 2 });
  c.fillStyle = conAlfa(OMBRA, 0.18); c.fillRect(x0 + l * 0.65, yT, l * 0.35, yB - yT);
  inchiostro(c, rettMano(r, x0, yT, l, yB - yT, 0.5), 1.4, 0.85);
  const cap = Forme.rettangolo(x0 - 0.03 * s, yT - 0.05 * s, l + 0.06 * s, 0.06 * s, 2);
  macchia(c, cap, '#e9dcc2', [x0 - 0.03 * s, yT - 0.05 * s, l + 0.06 * s, 0.06 * s]); inchiostro(c, cap, 1.2, 0.8);
  if (vasoCoccio) {
    const v = Forme.poligono([[x0 + l * 0.2, yT - 0.05 * s], [x0 + l * 0.8, yT - 0.05 * s], [x0 + l * 0.72, yT - 0.24 * s], [x0 + l * 0.28, yT - 0.24 * s]]);
    macchia(c, v, '#d77a55', [x0, yT - 0.25 * s, l, 0.2 * s]); inchiostro(c, v, 1.3, 0.85);
    const o = Forme.rettangolo(x0 + l * 0.22, yT - 0.27 * s, l * 0.56, 0.04 * s, 2);
    macchia(c, o, '#e48d66', [x0, yT - 0.28 * s, l, 0.05 * s]); inchiostro(c, o, 1.1, 0.8);
  } else {
    const t = Forme.poligono([[x0 - 0.06 * s, yT - 0.05 * s], [x0 + l / 2, yT - 0.2 * s], [x1 + 0.06 * s, yT - 0.05 * s]]);
    macchia(c, t, '#d8704f', [x0 - 0.06 * s, yT - 0.2 * s, l + 0.12 * s, 0.15 * s]); inchiostro(c, t, 1.3, 0.85);
  }
}

/**
 * Gronda di coppi vista di fronte: il bordo in basso (yG) ha i "musi" dei
 * coppi, poi il tetto sale di h e in alto il profilo è irregolare.
 */
function gronda(Q, x0, x1, yG, h, colore) {
  const { c, r, s } = Q, coppo = 0.15 * s; sfuma(c, x0, yG, x1 - x0, 0.32 * s, [[0, conAlfa(OMBRA, 0.38)], [1, conAlfa(OMBRA, 0)]]);
  const p = new Path2D(); p.moveTo(x0, yG - 0.02 * s);
  for (let x = x0; x < x1 - 1; x += coppo) p.quadraticCurveTo(x + coppo / 2, yG + 0.06 * s, Math.min(x1, x + coppo), yG - 0.02 * s);
  const fase = r() * 9, cima = (x) => yG - h + Math.sin(x / (1.3 * s) + fase) * 0.04 * s + Math.sin(x / (0.37 * s)) * 0.015 * s;
  for (let x = x1; x >= x0; x -= 0.1 * s) p.lineTo(x, cima(x));
  p.lineTo(x0, cima(x0)); p.closePath();
  lava(c, p, colore, [x0, yG - h - 0.1 * s, x1 - x0, h + 0.2 * s], r, { var: 0.3, tinta: '#c9584a', bordo: 0.3 }); c.save(); c.clip(p);
  for (let x = x0; x < x1; x += coppo) {                                // canali dei coppi: luce e ombra
    c.fillStyle = 'rgba(255,238,215,0.22)'; c.fillRect(x + coppo * 0.15, yG - h - 0.1 * s, coppo * 0.3, h + 0.2 * s);
    c.fillStyle = conAlfa(OMBRA, 0.14); c.fillRect(x + coppo * 0.65, yG - h - 0.1 * s, coppo * 0.3, h + 0.2 * s);
  }
  c.strokeStyle = conAlfa(scurisci(colore, 0.35), 0.5); c.lineWidth = 1.2;
  for (let k = 1, y = yG - 0.05 * s; y > yG - h; k++, y -= 0.11 * s / (1 + k * 0.3)) {   // file di coppi in prospettiva
    c.beginPath();
    for (let x = x0 + (k % 2) * coppo / 2 - coppo; x < x1; x += coppo) { c.moveTo(x, y); c.quadraticCurveTo(x + coppo / 2, y + 0.035 * s / (1 + k * 0.3), x + coppo, y); }
    c.stroke();
  }
  c.restore(); inchiostro(c, p, 1.5, 0.85);
}

/** Il casotto della scala sul tetto: porta di legno, finestrella, comignoli, vasi. */
function casotto() {
  const s = 200, A = 3.3, Q = quadro(3.5, A, s, 231), { c, r, W, H } = Q; const X = (x) => (x + 2) * s, Y = (y) => (A - y) * s;
  comignolo(Q, X(0.55), X(0.95), Y(2.4), Y(3.0), true); comignolo(Q, X(-1.55), X(-1.25), Y(2.4), Y(2.82), false);
  const mx = X(-1.85), my = Y(2.36), ml = X(1.4) - mx, ma = H - my;
  lava(c, Forme.rettangolo(mx, my, ml, ma), '#f1d8a8', [mx, my, ml, ma], r, { var: 0.3, luce: true, fioriture: 4, tinta: '#f2b98f', bordo: 0.3 });
  sfuma(c, mx, H - 0.5 * s, ml, 0.5 * s, [[0, 'rgba(150,140,100,0)'], [1, 'rgba(150,140,100,0.3)']]);  // umido in basso
  for (let i = 0; i < 6; i++) {                                         // mattoni scoperti dove l'intonaco è caduto
    const f = Forme.poligono(puntiMattone(r, X(0.75) + (i % 2) * 0.12 * s, Y(0.95) + Math.floor(i / 2) * 0.075 * s, 0.22 * s, 0.065 * s, 0.2));
    macchia(c, f, scegli(r, MATTONI), [X(0.7), Y(1), 0.4 * s, 0.3 * s], 0.4); inchiostro(c, f, 0.9, 0.5);
  }
  inchiostro(c, mano(r, [[X(-1.7), Y(1.6)], [X(-1.6), Y(1.45)], [X(-1.65), Y(1.3)], [X(-1.55), Y(1.15)]], false, 0.6), 1, 0.6);
  // la porta: assi verticali verde-acqua, stipite di pietra, gradino
  const px = X(-1.3), py = Y(2.05), pl = 0.95 * s, pa = Y(0.1) - py;
  lava(c, Forme.rettangolo(px - 0.08 * s, py - 0.08 * s, pl + 0.16 * s, pa + 0.08 * s), '#e9dcc0', [px - 0.08 * s, py - 0.08 * s, pl + 0.16 * s, pa], r, { n: 3, bordo: 0.4 });
  inchiostro(c, rettMano(r, px - 0.08 * s, py - 0.08 * s, pl + 0.16 * s, pa + 0.08 * s, 0.5), 1.3, 0.8);
  for (let i = 0; i < 4; i++) {
    const ax = px + i * pl / 4;
    lava(c, Forme.rettangolo(ax, py, pl / 4, pa), mescola('#6a9a98', scegli(r, ['#7fb0a6', '#5d8c8f', '#89b8ad']), r() * 0.6), [ax, py, pl / 4, pa], r, { n: 4, var: 0.3, luce: true, bordo: 0.3, lb: 2 });
    inchiostro(c, mano(r, [[ax, py], [ax, py + pa]], false, 0.5), 1.2, 0.8);
  }
  for (const y of [py + 0.25 * s, py + pa - 0.35 * s]) { c.fillStyle = '#4d4950'; c.fillRect(px, y, 0.3 * s, 0.035 * s); }
  c.strokeStyle = '#5a4e48'; c.lineWidth = 0.012 * s; c.beginPath(); c.arc(px + pl - 0.12 * s, py + pa * 0.52, 0.035 * s, 0, TAU); c.stroke();
  inchiostro(c, rettMano(r, px, py, pl, pa, 0.5), 1.6, 0.9); const gr = Forme.rettangolo(px - 0.14 * s, Y(0.1), pl + 0.28 * s, 0.1 * s, 2);
  macchia(c, gr, '#ddd2bd', [px - 0.14 * s, Y(0.1), pl + 0.28 * s, 0.1 * s]); inchiostro(c, gr, 1.2, 0.8);
  // finestrella con un vasetto di fiori
  const fx = X(0.3), fy = Y(1.85), fl = 0.6 * s, fa = 0.55 * s;
  lava(c, Forme.rettangolo(fx, fy, fl, fa), '#86b6d4', [fx, fy, fl, fa], r, { n: 2, bordo: 0.4 });
  c.save(); c.beginPath(); c.rect(fx + 0.06 * s, fy + 0.06 * s, fl - 0.12 * s, fa - 0.12 * s); c.clip();
  sfuma(c, fx, fy, fl, fa, [[0, '#d8ecf2'], [1, '#a9c9d8']]);
  c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(fx, fy + fa * 0.8); c.lineTo(fx + fl * 0.6, fy); c.lineTo(fx + fl * 0.75, fy); c.lineTo(fx, fy + fa); c.fill();
  c.restore(); c.fillStyle = '#86b6d4'; c.fillRect(fx + fl / 2 - 0.015 * s, fy, 0.03 * s, fa); c.fillRect(fx, fy + fa / 2 - 0.015 * s, fl, 0.03 * s);
  inchiostro(c, rettMano(r, fx, fy, fl, fa, 0.4), 1.4, 0.85); const dav = Forme.rettangolo(fx - 0.06 * s, fy + fa, fl + 0.12 * s, 0.05 * s, 2);
  macchia(c, dav, '#ece2cc', [fx - 0.06 * s, fy + fa, fl + 0.12 * s, 0.05 * s]); inchiostro(c, dav, 1.1, 0.8);
  pianta(c, r, fx + fl * 0.5, fy + fa - 0.1 * s, 0.17 * s, 'geranio'); vaso(c, r, fx + fl * 0.5, fy + fa, 0.18 * s, 0.13 * s);
  // lanterna accanto alla porta
  const lx = X(-0.1), ly = Y(1.85);
  inchiostro(c, Forme.curva([[lx + 0.1 * s, ly - 0.02 * s], [lx + 0.04 * s, ly - 0.06 * s], [lx, ly - 0.02 * s]]), 0.012 * s, 1, '#4d4950');
  const lan = Forme.poligono([[lx - 0.05 * s, ly], [lx + 0.05 * s, ly], [lx + 0.04 * s, ly + 0.14 * s], [lx - 0.04 * s, ly + 0.14 * s]]);
  macchia(c, lan, '#fbeec2', [lx - 0.05 * s, ly, 0.1 * s, 0.14 * s]); inchiostro(c, lan, 1.3, 0.9);
  gronda(Q, X(-2), X(1.5), Y(2.3), 0.3 * s, '#df8059');
  morbido(Q, (k) => { k.fillStyle = conAlfa(OMBRA, 0.4); k.fillRect(px - 0.1 * s, py - 0.1 * s, 0.06 * s, pa + 0.1 * s); }, { f: 6 });
  pianta(c, r, X(-1.6), Y(0.3), 0.28 * s, 'geranio');                   // vasi e annaffiatoio
  vaso(c, r, X(-1.6), H, 0.32 * s, 0.3 * s); const an = Forme.rettangolo(X(0.2), Y(0.24), 0.22 * s, 0.24 * s, 0.04 * s);
  inchiostro(c, Forme.curva([[X(0.42), Y(0.15)], [X(0.55), Y(0.3)], [X(0.6), Y(0.33)]]), 0.025 * s, 1, '#6b9bb8');
  macchia(c, an, '#7eaecb', [X(0.2), Y(0.24), 0.22 * s, 0.24 * s]); inchiostro(c, an, 1.3, 0.85);
  const ed = rami(r, X(1.1), X(1.35), Y(2.25), 0.6, 1.8, 4, s); ed.fiori.length = 0; disegnaRami(c, r, ed); carta(Q);
  sfumaBordi(Q.tela, 0.3 * s, ['sinistra']);
  return Q;
}

/** I panni stesi, appesi a una corda che si incurva (strato che tremola). */
function bucato() {
  const s = 200, Q = quadro(7, 1, s, 241), { c, r } = Q; const X = (x) => (x - 4) * s, Y = (y) => (2.6 - y) * s;
  const filo = (x) => { const t = (x - 4.12) / 6.76; return 2.47 - 0.68 * t * (1 - t); }; const pts = [];
  for (let x = 4.12; x <= 10.89; x += 0.1) pts.push([X(x), Y(filo(x))]);
  inchiostro(c, Forme.curva(pts), 2.2, 0.95, '#6e6058');
  // [x0, x1, lunghezza, forma, colore, motivo]
  const PANNI = [[4.6, 5.45, 0.52, 'maglia', '#8fbbe0', 'righe'], [5.75, 6.5, 0.7, 'vestito', '#f2a7b8', 'pois'],
    [6.8, 7.05, 0.26, 'calzino', '#f5cf5a', ''], [7.12, 7.37, 0.24, 'calzino', '#e9715b', ''],
    [7.65, 8.45, 0.6, 'asciugamano', '#a9d7b5', 'bande'], [8.75, 9.3, 0.36, 'pantaloncini', '#f7f2e6', ''],
    [9.55, 10.15, 0.5, 'fazzoletto', '#f4a259', 'pois'], [10.35, 10.6, 0.22, 'calzino', '#b7a2dc', '']];
  const SAGOME = {
    maglia: [[0, 0], [0.3, 0], [0.38, 0.08], [0.62, 0.08], [0.7, 0], [1, 0], [1, 0.32], [0.84, 0.36], [0.84, 1], [0.16, 1], [0.16, 0.36], [0, 0.32]],
    vestito: [[0.28, 0], [0.36, 0], [0.4, 0.1], [0.6, 0.1], [0.64, 0], [0.72, 0], [0.74, 0.22], [0.66, 0.38], [0.98, 0.94], [0.75, 1], [0.5, 0.96], [0.25, 1], [0.02, 0.94], [0.34, 0.38], [0.26, 0.22]],
    asciugamano: [[0, 0], [1, 0], [0.98, 1], [0.02, 0.98]],
    calzino: [[0.1, 0], [0.7, 0], [0.68, 0.66], [1, 0.82], [0.92, 1], [0.38, 1], [0.12, 0.8]],
    pantaloncini: [[0, 0], [1, 0], [1, 1], [0.56, 1], [0.5, 0.5], [0.44, 1], [0, 1]],
    fazzoletto: [[0, 0], [1, 0], [0.55, 1]],
  };
  for (const [x0, x1, lung, forma, col, motivo] of PANNI) {
    const punti = SAGOME[forma].map(([u, v]) => { const x = x0 + u * (x1 - x0); return [X(x), Y(filo(x)) + v * lung * s]; });
    const f = Forme.poligono(punti, false); const box = [X(x0), Y(filo(x0)) - 4, (x1 - x0) * s, lung * s + 0.2 * s];
    lava(c, f, col, box, r, { n: 3, var: 0.25, luce: true, bordo: 0.4, lb: 2 }); c.save(); c.clip(f);
    if (motivo === 'righe') for (let v = 0.12; v < 1; v += 0.16) { c.fillStyle = conAlfa('#f8f6ee', 0.85); c.fillRect(box[0], box[1] + v * lung * s, box[2], 0.05 * lung * s); }
    if (motivo === 'pois') for (let i = 0; i < 18; i++) { c.fillStyle = 'rgba(255,252,240,0.85)'; c.beginPath(); c.arc(box[0] + r() * box[2], box[1] + r() * box[3], 0.018 * s, 0, TAU); c.fill(); }
    if (motivo === 'bande') for (const v of [0.12, 0.2, 0.8, 0.88]) { c.fillStyle = conAlfa('#5f9f8a', 0.6); c.fillRect(box[0], box[1] + v * lung * s, box[2], 0.04 * lung * s); }
    sfuma(c, box[0], box[1], box[2], box[3], [[0.5, conAlfa(OMBRA, 0)], [1, conAlfa(OMBRA, 0.25)]], true); c.restore();
    for (let k = 0; k < 2; k++) {                                       // pieghe
      const u = tra(r, 0.3, 0.7), x = x0 + u * (x1 - x0);
      inchiostro(c, mano(r, [[X(x), Y(filo(x)) + lung * s * 0.25], [X(x) + tra(r, -4, 4), Y(filo(x)) + lung * s * tra(r, 0.55, 0.85)]], false, 0.8), 1, 0.4);
    }
    inchiostro(c, f, 1.5, 0.85);
    for (const u of forma === 'calzino' ? [0.4] : [0.1, 0.9]) {          // mollette di legno
      const x = X(x0 + u * (x1 - x0)), y = Y(filo(x0 + u * (x1 - x0)));
      const m = Forme.rettangolo(x - 0.012 * s, y - 0.05 * s, 0.024 * s, 0.09 * s, 2);
      macchia(c, m, '#dcb27a', [x - 0.012 * s, y - 0.05 * s, 0.024 * s, 0.09 * s], 0.5); inchiostro(c, m, 1, 0.8);
    }
  }
  carta(Q, 0.25);
  return Q;
}

/** Un palo del bucato, piantato in un vaso pieno di sassi. */
function paloBucato(seme) {
  const s = 200, Q = quadro(0.3, 2.65, s, seme), { c, r, W, H } = Q, cx = W / 2;
  const palo = Forme.rettangolo(cx - 0.025 * s, 0.1 * s, 0.05 * s, H - 0.3 * s, 2);
  lava(c, palo, '#a77b55', [cx - 0.03 * s, 0, 0.06 * s, H], r, { n: 4, luce: true, bordo: 0.4, lb: 2 });
  c.fillStyle = 'rgba(255,235,200,0.35)'; c.fillRect(cx - 0.018 * s, 0.1 * s, 0.012 * s, H - 0.3 * s); inchiostro(c, palo, 1.4, 0.85);
  const tr = Forme.rettangolo(cx - 0.11 * s, 0.1 * s, 0.22 * s, 0.035 * s, 2);
  macchia(c, tr, '#9a6e4a', [cx - 0.11 * s, 0.1 * s, 0.22 * s, 0.035 * s]); inchiostro(c, tr, 1.2, 0.85);
  vaso(c, r, cx, H, 0.28 * s, 0.24 * s, '#cf7955');
  for (let i = 0; i < 5; i++) { const f = Forme.ellisse(cx + tra(r, -0.09, 0.09) * s, H - 0.24 * s, 0.03 * s, 0.018 * s); macchia(c, f, '#d9d2c4', [cx - 0.12 * s, H - 0.27 * s, 0.24 * s, 0.06 * s], 0.5); }
  carta(Q, 0.25);
  return Q;
}

/** Una casa del panorama vicino: facciata da yG in giù, tetto sopra (tipo 0 capanna, 1 falda, 2 terrazzo). */
function casaVicina(c, r, x0, x1, yG, yFondo, s, tipo) {
  const l = x1 - x0, col = scegli(r, PASTELLI), tet = scegli(r, TETTI), cx = (x0 + x1) / 2; let tetto = null, yTetto = yG;
  if (tipo === 0) { yTetto = yG - l * 0.36; tetto = Forme.poligono([[x0 - 0.08 * s, yG + 2], [cx, yTetto], [x1 + 0.08 * s, yG + 2]]); }
  if (tipo === 1) { yTetto = yG - tra(r, 0.4, 0.8) * s; tetto = Forme.poligono([[x0 - 0.08 * s, yG + 2], [x0 + 0.12 * s, yTetto], [x1 - 0.12 * s, yTetto], [x1 + 0.08 * s, yG + 2]]); }
  if (tipo !== 2 && r() < 0.75) comignoloPiccolo(c, r, x0 + l * tra(r, 0.2, 0.8), (yG + yTetto) / 2 + 0.05 * s, s);
  if (r() < 0.3) {                                                       // antenna della televisione
    const ax = x0 + l * tra(r, 0.2, 0.8), ay = Math.min(yG, yTetto + 0.1 * s); c.strokeStyle = conAlfa('#6d6a78', 0.8); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax, ay - 0.6 * s);
    for (let k = 0; k < 3; k++) { c.moveTo(ax - 0.12 * s, ay - 0.45 * s - k * 0.06 * s); c.lineTo(ax + 0.12 * s, ay - 0.45 * s - k * 0.06 * s); }
    c.stroke();
  }
  const facc = Forme.rettangolo(x0, yG, l, yFondo - yG);
  lava(c, facc, col, [x0, yG, l, yFondo - yG], r, { n: 3, var: 0.25, luce: true, bordo: 0.3, lb: 2 });
  sfuma(c, x0, yG, l, 0.2 * s, [[0, conAlfa(OMBRA, 0.3)], [1, conAlfa(OMBRA, 0)]]);
  const fl = 0.2 * s, fa = 0.3 * s, n = Math.max(1, Math.floor(l / (0.55 * s))), vetro = mescola(col, '#55688f', 0.45);
  for (let y = yG + 0.35 * s; y < yFondo; y += 0.8 * s) {
    for (let i = 0; i < n; i++) {
      const fx = x0 + (i + 0.5) * l / n - fl / 2; c.fillStyle = vetro; c.fillRect(fx, y, fl, fa);
      if ((i + Math.round(y)) % 3 === 0) { c.fillStyle = '#7fa889'; c.fillRect(fx - fl * 0.45, y, fl * 0.4, fa); c.fillRect(fx + fl * 1.05, y, fl * 0.4, fa); }
      c.strokeStyle = conAlfa(SEPPIA, 0.6); c.lineWidth = 1; c.strokeRect(fx, y, fl, fa);
    }
  }
  inchiostro(c, rettMano(r, x0, yG, l, yFondo - yG, 0.5), 1.2, 0.7);
  if (tetto) {
    lava(c, tetto, tet, [x0 - 0.1 * s, yTetto, l + 0.2 * s, yG - yTetto + 4], r, { n: 3, var: 0.3, bordo: 0.4, lb: 2 });
    c.save(); c.clip(tetto); c.strokeStyle = conAlfa(scurisci(tet, 0.35), 0.45); c.lineWidth = 1; c.beginPath();
    for (let y = yG - 0.08 * s; y > yTetto; y -= 0.09 * s) { c.moveTo(x0 - 0.1 * s, y); c.lineTo(x1 + 0.1 * s, y); }
    for (let x = x0; x < x1; x += 0.12 * s) { c.moveTo(x, yG); c.lineTo(x + (x - cx) * 0.1, yTetto); }
    c.stroke(); c.restore(); inchiostro(c, tetto, 1.3, 0.8);
  } else {                                                               // terrazzino: parapetto e vasi
    const par = Forme.rettangolo(x0 - 0.04 * s, yG - 0.12 * s, l + 0.08 * s, 0.14 * s, 2);
    macchia(c, par, schiarisci(col, 0.3), [x0, yG - 0.12 * s, l, 0.14 * s]); inchiostro(c, par, 1.2, 0.8);
    for (let i = 0; i < 3; i++) { const vx = x0 + l * tra(r, 0.15, 0.85); c.fillStyle = scegli(r, VERDI); c.beginPath(); c.arc(vx, yG - 0.18 * s, 0.09 * s, 0, TAU); c.fill(); }
  }
}

/** Comignolo piccolo per il panorama. */
function comignoloPiccolo(c, r, x, yB, s) {
  const l = tra(r, 0.15, 0.25) * s, h = tra(r, 0.35, 0.6) * s; const f = Forme.rettangolo(x - l / 2, yB - h, l, h);
  macchia(c, f, scegli(r, ['#efd8b4', '#e7b59a', '#f0e0c6']), [x - l / 2, yB - h, l, h]); inchiostro(c, f, 1.1, 0.75);
  const cap = Forme.rettangolo(x - l * 0.65, yB - h - 0.05 * s, l * 1.3, 0.06 * s, 1);
  macchia(c, cap, '#d8704f', [x - l * 0.65, yB - h - 0.05 * s, l * 1.3, 0.06 * s]); inchiostro(c, cap, 1, 0.75);
}

/** Tetti vicini oltre la ringhiera (z = -9): tre file di case, alberi, un campanile; più chiari per l'aria. */
function tettiVicini() {
  const s = 90, A = 6, Q = quadro(40, A, s, 251), { c, r, W, H } = Q; const X = (x) => (x + 12) * s, Y = (y) => (3 - y) * s;
  for (let x = -12.5, campanile = false; x < 28;) {                       // fila dietro
    const w = tra(r, 1.6, 3.0);
    if (x > 16 && x < 18.5 && !campanile) {                               // il campanile
      const cl = 1.1 * s, cx = X(x); lava(c, Forme.rettangolo(cx, Y(2.4), cl, H), '#efe0c0', [cx, Y(2.4), cl, H], r, { n: 4, luce: true });
      c.fillStyle = '#7d6f8f'; c.beginPath(); c.arc(cx + cl / 2, Y(2.0), 0.18 * s, Math.PI, 0); c.fillRect(cx + cl / 2 - 0.18 * s, Y(2.0), 0.36 * s, 0.35 * s); c.fill();
      inchiostro(c, rettMano(r, cx, Y(2.4), cl, H, 0.5), 1.3, 0.8);
      const pu = Forme.poligono([[cx - 0.08 * s, Y(2.4)], [cx + cl / 2, Y(2.98)], [cx + cl + 0.08 * s, Y(2.4)]]);
      macchia(c, pu, '#c96a4e', [cx, Y(3), cl, 0.6 * s]); inchiostro(c, pu, 1.3, 0.8); x += 1.4; campanile = true; continue;
    }
    casaVicina(c, r, X(x), X(x + w), Y(tra(r, 1.0, 2.0)), H, s, Math.floor(r() * 3));
    if (r() < 0.3) chioma(c, r, X(x + w), Y(tra(r, 0.6, 1.3)), tra(r, 0.4, 0.7) * s, scegli(r, ['#7fb46a', '#6aa463', '#94c27c']));
    x += w * tra(r, 0.85, 1.05);
  }
  velo(Q, '#eef3f7', 0.2);
  for (const [lo, hi, haze] of [[0.4, 1.4, 0.12], [-0.5, 0.6, 0]]) {      // fila di mezzo e fila davanti
    for (let x = -12.5 + r() * 1.5; x < 28;) {
      const w = tra(r, 1.4, 2.8); casaVicina(c, r, X(x), X(x + w), Y(tra(r, lo, hi)), H, s, r() < 0.55 ? 1 : Math.floor(r() * 3));
      if (r() < 0.3) chioma(c, r, X(x + w + 0.1), Y(tra(r, lo - 0.6, lo)), tra(r, 0.45, 0.75) * s, scegli(r, ['#6aa463', '#7fb46a', '#8cbf6e']));
      x += w * tra(r, 0.9, 1.08);
    }
    if (haze) velo(Q, '#eef3f7', haze);
  }
  velo(Q, '#f2f5f7', 0.08); c.save(); c.globalCompositeOperation = 'source-atop';
  sfuma(c, 0, 0, W, H, [[0.45, 'rgba(246,248,250,0)'], [1, 'rgba(246,248,250,0.35)']]); c.restore(); carta(Q, 0.3);
  sfumaBordi(Q.tela, 1.5 * s, ['sinistra', 'destra']);
  return Q;
}

/** Mucchio lontano di casette colorate (z = -40): più chiaro e azzurrino, sfuma nel bianco in basso. */
function mucchioLontano() {
  const s = 20, Q = quadro(96, 22, s, 261), { c, r, W, H } = Q; const X = (x) => (x + 40) * s, Y = (y) => (8 - y) * s;
  const cima = (x) => -1.4 + 8.6 * Math.exp(-(((x - 11) / 12) ** 2)) + 4.6 * Math.exp(-(((x + 19) / 8) ** 2)) + 5.4 * Math.exp(-(((x - 37) / 8) ** 2)) + 0.4 * Math.sin(x * 0.9);
  const fondo = new Path2D(); fondo.moveTo(0, H); for (let x = -40; x <= 56; x += 0.5) fondo.lineTo(X(x), Y(cima(x) - 0.4));
  fondo.lineTo(W, H); fondo.closePath(); lava(c, fondo, '#e7c3b6', [0, 0, W, H], r, { n: 20, var: 0.25, bordo: 0 });
  for (let yb = 8; yb > -8;) {                                           // file di case dall'alto (lontane) al basso
    const scala = 0.8 + 0.5 * (8 - yb) / 16;
    for (let x = -40 + r() * 0.8; x < 56;) {
      const w = tra(r, 0.75, 1.35) * scala, h = w * tra(r, 0.75, 1.3);
      if (yb + h * 0.3 < cima(x + w / 2)) {
        if (r() < 0.09) alberello(c, r, X(x + w / 2), Y(yb), w * 0.6 * s);
        else casetta(c, r, X(x), Y(yb), w * s, h * s);
      }
      x += w * tra(r, 0.7, 0.95);
    }
    yb -= tra(r, 0.5, 0.7) * scala;
  }
  velo(Q, '#d6e4f4', 0.22); c.save(); c.globalCompositeOperation = 'source-atop';
  sfuma(c, 0, Y(2), W, Y(-9) - Y(2), [[0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.97)']]);
  c.fillStyle = '#ffffff'; c.fillRect(0, Y(-9), W, H); c.restore(); carta(Q, 0.2); sfumaBordi(Q.tela, 4 * s, ['basso']);
  sfumaBordi(Q.tela, 8 * s, ['sinistra', 'destra']);
  return Q;
}

/** Casetta minuscola del mucchio: (x, yb) angolo in basso a sinistra, in pixel. */
function casetta(c, r, x, yb, l, a) {
  const col = scegli(r, PASTELLI), tet = scegli(r, TETTI), q = r(); c.fillStyle = col; c.fillRect(x, yb - a, l, a);
  c.fillStyle = 'rgba(255,255,245,0.25)'; c.fillRect(x, yb - a, l * 0.35, a);
  c.fillStyle = conAlfa(OMBRA, 0.15); c.fillRect(x + l * 0.75, yb - a, l * 0.25, a); const vetro = mescola(col, '#4f5f86', 0.5); c.fillStyle = vetro;
  const n = l > 22 ? 3 : 2;
  for (let fy = yb - a + a * 0.18; fy < yb - a * 0.25; fy += a * 0.34) for (let i = 0; i < n; i++) if (r() < 0.8) c.fillRect(x + l * (i + 0.5) / n - l * 0.07, fy, l * 0.14, a * 0.16);
  c.strokeStyle = conAlfa(SEPPIA, 0.55); c.lineWidth = 0.8; c.strokeRect(x, yb - a, l, a); c.beginPath();
  if (q < 0.55) { c.moveTo(x - 1.5, yb - a); c.lineTo(x + l / 2, yb - a - l * 0.45); c.lineTo(x + l + 1.5, yb - a); }
  else if (q < 0.85) { c.moveTo(x - 1.5, yb - a); c.lineTo(x + l * 0.1, yb - a - l * 0.25); c.lineTo(x + l * 0.9, yb - a - l * 0.25); c.lineTo(x + l + 1.5, yb - a); }
  else { c.rect(x - 1, yb - a - l * 0.08, l + 2, l * 0.08); }
  c.closePath(); c.fillStyle = tet; c.fill(); c.stroke();
}

/** Alberello tondo minuscolo del mucchio. */
function alberello(c, r, cx, yb, rr) {
  c.fillStyle = scegli(r, ['#8cc07a', '#79b46c', '#a5cf88']);
  c.beginPath(); c.arc(cx, yb - rr, rr, 0, TAU); c.arc(cx - rr * 0.6, yb - rr * 0.6, rr * 0.7, 0, TAU); c.arc(cx + rr * 0.6, yb - rr * 0.6, rr * 0.7, 0, TAU); c.fill();
  c.strokeStyle = conAlfa(SEPPIA, 0.45); c.lineWidth = 0.8; c.stroke();
}

/* ============================ 6. PIAZZETTA =============================== */
const SASSI = ['#e6d3a6', '#dcc596', '#eddcb6', '#d5bd8e', '#e9d5a0'];

/** Un sasso tondeggiante del basamento, con luce in alto e ombra in basso. */
function sasso(c, r, cx, cy, rx, ry) {
  const f = Forme.poligono(puntiSasso(r, cx, cy, rx, ry), true);
  c.fillStyle = 'rgba(60,40,40,0.3)'; c.beginPath(); c.ellipse(cx + rx * 0.08, cy + ry * 0.14, rx, ry, 0, 0, TAU); c.fill();
  lava(c, f, scegli(r, SASSI), [cx - rx, cy - ry, 2 * rx, 2 * ry], r, { n: 3, var: 0.25, bordo: 0.4, lb: 2.5 });
  c.save(); c.clip(f); c.translate(cx, cy); c.scale(1, ry / rx);
  const g = c.createRadialGradient(-rx * 0.3, -rx * 0.4, 0, -rx * 0.1, -rx * 0.1, rx * 1.25);
  g.addColorStop(0, 'rgba(255,252,240,0.55)'); g.addColorStop(0.45, 'rgba(255,252,240,0)'); g.addColorStop(0.75, conAlfa(OMBRA, 0.06)); g.addColorStop(1, conAlfa(OMBRA, 0.38));
  c.fillStyle = g; c.fillRect(-rx * 1.5, -rx * 1.5, rx * 3, rx * 3); c.restore();
  const faccia = Forme.poligono(blob(r, cx - rx * 0.15, cy - ry * 0.3, rx * 0.55, ry * 0.4, 8, 0.25), true);   // faccia alta, più chiara
  c.fillStyle = 'rgba(255,250,232,0.3)'; c.fill(faccia);
  if (r() < 0.75) inchiostro(c, mano(r, [[cx - rx * 0.6, cy + ry * 0.2], [cx - rx * 0.1, cy + ry * 0.05], [cx + rx * 0.5, cy - ry * 0.25]], false, 0.6), 1.1, 0.35);
  inchiostro(c, f, 1.6, 0.8);
}

/**
 * Basamento di grandi sassi tondi nella malta bruna (tra x0 e x1, da yTop al
 * pavimento yPav). I sassi si sistemano "a incastro": si provano tante
 * posizioni, dai sassi grandi ai piccoli, e si tengono quelle libere.
 */
function basamentoSassi(Q, x0, x1, yTop, yPav) {
  const { c, r, s } = Q, bordo = [[x0, yPav]]; for (let x = x0; x <= x1; x += 0.2 * s) bordo.push([x, yTop + tra(r, -0.03, 0.03) * s]);
  bordo.push([x1, yTop], [x1, yPav]);
  lava(c, Forme.poligono(bordo), '#9a7c52', [x0, yTop - 0.1 * s, x1 - x0, yPav - yTop + 0.1 * s], r,
    { var: 0.35, n: 30, rMax: 0.6 * s, scuro: '#6f5a3e', tinta: '#8d7a4c', bordo: 0 });
  const sassi = [], prove = 2000;
  for (let t = 0; t < prove; t++) {
    const g = 1 - t / prove, rx = s * tra(r, 0.19, 0.22 + 0.32 * g), ry = Math.min(0.3 * s, rx * tra(r, 0.6, 0.85));
    const cx = tra(r, x0 - 0.2 * s, x1 + 0.2 * s), cy = tra(r, yTop + ry * 0.8, yPav - ry * 0.35);
    if (sassi.every((q) => ((cx - q[0]) / (rx + q[2])) ** 2 + ((cy - q[1]) / (ry + q[3])) ** 2 > 0.8)) sassi.push([cx, cy, rx, ry]);
  }
  sassi.sort((a, b) => a[1] - b[1]); c.save(); c.beginPath(); c.rect(x0, yTop - 0.3 * s, x1 - x0, yPav - yTop + 0.3 * s); c.clip();
  for (const [cx, cy, rx, ry] of sassi) sasso(c, r, cx, cy, rx * 0.95, ry * 0.92);
  c.restore();
  inchiostro(c, mano(r, bordo.slice(1, -2), false, 0.6), 1.3, 0.5);
}

/** Zoccolo basso di piastrelle blu (tra x0 e x1, da yTop al pavimento yPav). */
function zoccoloPiastrelle(Q, x0, x1, yTop, yPav) {
  const { c, r, s } = Q, g = 0.025 * s, cop = 0.06 * s, lt = 0.36 * s;
  lava(c, Forme.rettangolo(x0, yTop, x1 - x0, yPav - yTop), '#c9d6dc', [x0, yTop, x1 - x0, yPav - yTop], r, { n: 6, bordo: 0 });
  for (let x = x0; x < x1; x += 0.6 * s) {
    const f = Forme.rettangolo(x + 1, yTop, 0.6 * s - 2, cop, 2); macchia(c, f, '#9fb8c6', [x, yTop, 0.6 * s, cop], 0.5); inchiostro(c, f, 1.1, 0.7);
  }
  sfuma(c, x0, yTop + cop, x1 - x0, 0.06 * s, [[0, conAlfa(OMBRA, 0.35)], [1, conAlfa(OMBRA, 0)]]);
  for (let x = x0 + g; x < x1; x += lt) {
    const f = Forme.rettangolo(x, yTop + cop + g, lt - g, yPav - yTop - cop - g * 1.5, 0.05 * s);
    macchia(c, f, mescola(scegli(r, ['#8eabbb', '#7d9cae', '#9ab6c4', '#86a3b8']), '#a8c0e0', r() * 0.3), [x, yTop + cop, lt, yPav - yTop - cop], 0.5);
    inchiostro(c, f, 1.3, 0.7);
  }
}

/** Finestra a tanti vetri (cornice azzurra o bianca): x0..x1, yT..yB, colonne × righe. */
function finestraVetri(Q, x0, yT, x1, yB, col, rig, cornice, vetroScuro) {
  const { c, r, s } = Q, l = x1 - x0, a = yB - yT, t = 0.1 * s, m = 0.045 * s;
  lava(c, Forme.rettangolo(x0, yT, l, a), cornice, [x0, yT, l, a], r, { n: 4, var: 0.25, bordo: 0.45 });
  const vx = x0 + t, vy = yT + t, vl = l - 2 * t, va = a - 2 * t; c.save(); c.beginPath(); c.rect(vx, vy, vl, va); c.clip();
  if (vetroScuro) sfuma(c, vx, vy, vl, va, [[0, '#4f6f80'], [0.6, '#6f909e'], [1, '#8fb0b8']]);
  else sfuma(c, vx, vy, vl, va, [[0, '#cfe4e6'], [0.5, '#e8f3ef'], [1, '#f4f8f0']]);
  alone(c, vx + vl * 0.7, vy + va * 0.3, vl * 0.5, vetroScuro ? '#a9c6cf' : '#ffffff', 0.4);
  c.fillStyle = 'rgba(255,255,255,0.5)';                                 // il riflesso in diagonale
  c.beginPath(); c.moveTo(vx + vl * 0.05, vy + va); c.lineTo(vx + vl * 0.3, vy + va); c.lineTo(vx + vl * 0.85, vy); c.lineTo(vx + vl * 0.6, vy); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.3)';
  c.beginPath(); c.moveTo(vx + vl * 0.35, vy + va); c.lineTo(vx + vl * 0.42, vy + va); c.lineTo(vx + vl * 0.97, vy); c.lineTo(vx + vl * 0.9, vy); c.fill();
  sfuma(c, vx, vy, vl, 0.12 * s, [[0, conAlfa(OMBRA, 0.3)], [1, conAlfa(OMBRA, 0)]]); c.restore(); c.fillStyle = cornice;
  for (let i = 1; i < col; i++) c.fillRect(vx + vl * i / col - m / 2, vy, m, va);
  for (let j = 1; j < rig; j++) c.fillRect(vx, vy + va * j / rig - m / 2, vl, m);
  const scuro = scurisci(cornice, 0.3);
  for (let i = 0; i < col; i++) for (let j = 0; j < rig; j++) {
    const px = vx + vl * i / col + (i ? m / 2 : 0), py = vy + va * j / rig + (j ? m / 2 : 0);
    inchiostro(c, rettMano(r, px, py, vl / col - (i ? m / 2 : 0) - (i < col - 1 ? m / 2 : 0), va / rig - (j ? m / 2 : 0) - (j < rig - 1 ? m / 2 : 0), 0.4), 1.1, 0.75, scuro);
  }
  inchiostro(c, rettMano(r, x0, yT, l, a, 0.5), 1.6, 0.85);
}

/** Davanzale di pietra con la colatura sotto. */
function davanzale(Q, x0, x1, y) {
  const { c, r, s } = Q, f = Forme.rettangolo(x0 - 0.08 * s, y, x1 - x0 + 0.16 * s, 0.07 * s, 2);
  sfuma(c, x0, y + 0.07 * s, x1 - x0, 0.5 * s, [[0, conAlfa(OMBRA, 0.25)], [1, conAlfa(OMBRA, 0)]]);
  macchia(c, f, '#f1ead8', [x0 - 0.08 * s, y, x1 - x0 + 0.16 * s, 0.07 * s]); inchiostro(c, f, 1.3, 0.8);
}

/** Pluviale bianco con le fascette e il gomito in basso. */
function pluviale(Q, cx, yT, yB) {
  const { c, r, s } = Q, l = 0.17 * s;
  morbido(Q, (k) => { k.fillStyle = conAlfa('#5a6fa0', 0.45); k.fillRect(cx - l / 2 + 0.06 * s, yT, l, yB - yT); }, { f: 6 });
  const tubo = Forme.rettangolo(cx - l / 2, yT, l, yB - yT); c.fillStyle = '#f4f3ee'; c.fill(tubo);
  sfuma(c, cx - l / 2, yT, l, yB - yT, [[0, 'rgba(255,255,255,0.6)'], [0.35, 'rgba(255,255,255,0)'], [0.7, 'rgba(150,165,195,0.3)'], [1, 'rgba(120,135,175,0.55)']], true);
  inchiostro(c, mano(r, [[cx - l / 2, yT], [cx - l / 2, yB]], false, 0.6), 1.4, 0.8);
  inchiostro(c, mano(r, [[cx + l / 2, yT], [cx + l / 2, yB]], false, 0.6), 1.4, 0.8);
  for (let y = yT + 0.5 * s; y < yB - 0.3 * s; y += 1.3 * s) {
    const f = Forme.rettangolo(cx - l * 0.65, y, l * 1.3, 0.07 * s, 3);
    macchia(c, f, '#eceae4', [cx - l * 0.65, y, l * 1.3, 0.07 * s], 0.5); inchiostro(c, f, 1.2, 0.8);
  }
  const gom = new Path2D();                                              // il gomito che sporge in basso
  gom.moveTo(cx - l / 2, yB); gom.quadraticCurveTo(cx - l / 2, yB + 0.2 * s, cx + l * 0.1, yB + 0.26 * s);
  gom.lineTo(cx + l * 0.9, yB + 0.3 * s); gom.lineTo(cx + l * 0.75, yB + 0.12 * s); gom.quadraticCurveTo(cx + l / 2, yB + 0.1 * s, cx + l / 2, yB); gom.closePath();
  macchia(c, gom, '#efeee9', [cx - l / 2, yB, l * 1.4, 0.3 * s], 0.5); inchiostro(c, gom, 1.4, 0.85);
  const bocca = Forme.ellisse(cx + l * 0.82, yB + 0.21 * s, 0.035 * s, 0.09 * s, 0.4);
  c.fillStyle = '#7f8aa6'; c.fill(bocca); inchiostro(c, bocca, 1.1, 0.8);
}

/** Muro di fondo della piazzetta: casa gialla con il basamento di sassi e casa azzurra. */
function muroPiazzetta() {
  const s = 200, A = 7, Q = quadro(19, A, s, 311), { c, r, W, H } = Q; const X = (x) => (x + 3) * s, Y = (y) => (A - y) * s;
  // --- le due facciate ---
  lava(c, Forme.rettangolo(0, Y(6.3), X(9), H - Y(6.3)), '#f7e3a1', [0, Y(6.3), X(9), H - Y(6.3)], r,
    { var: 0.3, n: 45, rMax: 1.4 * s, luce: true, fioriture: 10, scuro: '#efc46a', tinta: '#fbf1c4', bordo: 0, strisce: 26, angolo: -0.6 });
  lava(c, Forme.rettangolo(X(9), Y(5.8), W - X(9), H - Y(5.8)), '#b2cdea', [X(9), Y(5.8), W - X(9), H - Y(5.8)], r,
    { var: 0.4, n: 40, rMax: 1.2 * s, scuro: '#7f9fd2', tinta: '#d3e2f3', fioriture: 10, bordo: 0, strisce: 18, angolo: -0.3 });
  morbido(Q, (k) => {                                                    // macchie blu più scure (come nel film)
    for (const [x, y, rx, ry] of [[9.8, 5.3, 1.3, 0.5], [15.4, 4.7, 0.9, 1.2], [12.2, 5.4, 0.8, 0.3], [15.0, 1.2, 0.8, 0.5]]) {
      k.fillStyle = conAlfa('#7393cc', 0.22); k.fill(Forme.poligono(blob(r, X(x), Y(y), rx * s, ry * s, 12, 0.35), true));
    }
  }, { f: 7 });
  for (let i = 0; i < 26; i++) {                                         // colature verticali
    const x = r() * W, y = Y(tra(r, 1.5, 5.6)), h = tra(r, 0.4, 1.4) * s, w = tra(r, 0.05, 0.14) * s;
    const g = c.createLinearGradient(0, y, 0, y + h), tono = x < X(9) ? '#d9b86a' : '#7f9fc8';
    g.addColorStop(0, conAlfa(tono, 0)); g.addColorStop(0.3, conAlfa(tono, 0.22)); g.addColorStop(1, conAlfa(tono, 0));
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y + h / 2, w / 2, h / 2, 0, 0, TAU); c.fill();
  }
  // --- tetti e comignoli ---
  comignolo(Q, X(6.5), X(7.0), Y(6.4), Y(6.7), true); comignolo(Q, X(14.4), X(14.8), Y(5.9), Y(6.35), false);
  gronda(Q, 0, X(9.05), Y(6.25), 0.42 * s, '#de8459'); gronda(Q, X(9.05), W, Y(5.75), 0.36 * s, '#d9764f');
  // --- casa gialla ---
  basamentoSassi(Q, 0, X(9), Y(1.1), H); finestraVetri(Q, X(0.6), Y(2.85), X(2.6), Y(1.1), 4, 3, '#8fc0da');
  for (const x of [0.9, 5.4]) {
    finestraVetri(Q, X(x), Y(5.3), X(x + 1.4), Y(3.75), 3, 4, '#8fc0da'); davanzale(Q, X(x), X(x + 1.4), Y(3.75));
  }
  for (let i = 0; i < 4; i++) pianta(c, r, X(1.15 + i * 0.3), Y(3.97), 0.24 * s, 'geranio');   // fioriera di gerani sul davanzale
  const fio = Forme.rettangolo(X(0.95), Y(3.98), 1.3 * s, 0.22 * s, 3);
  lava(c, fio, '#d77d5c', [X(0.95), Y(3.98), 1.3 * s, 0.22 * s], r, { n: 3, luce: true, bordo: 0.4 }); inchiostro(c, fio, 1.4, 0.85);
  const lx = X(4.2), ly = Y(2.75);                                       // lanterna su un braccio di ferro
  inchiostro(c, Forme.curva([[lx - 0.25 * s, ly - 0.05 * s], [lx - 0.1 * s, ly - 0.12 * s], [lx, ly - 0.08 * s]]), 0.02 * s, 1, '#4d4950');
  inchiostro(c, Forme.curva([[lx - 0.25 * s, ly + 0.08 * s], [lx - 0.12 * s, ly - 0.06 * s]]), 0.012 * s, 1, '#4d4950');
  const lan = Forme.poligono([[lx - 0.09 * s, ly], [lx + 0.09 * s, ly], [lx + 0.07 * s, ly + 0.26 * s], [lx - 0.07 * s, ly + 0.26 * s]]);
  macchia(c, lan, '#fbeec2', [lx - 0.09 * s, ly, 0.18 * s, 0.26 * s]); inchiostro(c, lan, 1.5, 0.9);
  const cap = Forme.poligono([[lx - 0.12 * s, ly + 0.01 * s], [lx, ly - 0.09 * s], [lx + 0.12 * s, ly + 0.01 * s]]);
  macchia(c, cap, '#55607a', [lx - 0.12 * s, ly - 0.09 * s, 0.24 * s, 0.1 * s]); inchiostro(c, cap, 1.3, 0.9);
  for (const [x, y] of [[7.4, 2.2], [-1.6, 4.9]]) {                       // intonaco caduto: mattoni scoperti
    const f = Forme.poligono(blob(r, X(x), Y(y), 0.42 * s, 0.22 * s, 14, 0.3), true);
    macchia(c, f, '#f0d6a2', [X(x) - 0.5 * s, Y(y) - 0.3 * s, s, 0.6 * s], 0.2);
    for (let k = 0; k < 6; k++) {
      const b = Forme.poligono(puntiMattone(r, X(x) - 0.3 * s + (k % 3) * 0.2 * s + (k > 2 ? 0.1 * s : 0), Y(y) - 0.1 * s + (k > 2 ? 0.09 * s : 0), 0.18 * s, 0.075 * s, 0.2));
      macchia(c, b, scegli(r, MATTONI), [X(x) - 0.3 * s, Y(y) - 0.1 * s, 0.6 * s, 0.2 * s], 0.4); inchiostro(c, b, 1, 0.55);
    }
    inchiostro(c, f, 1, 0.3);
  }
  // --- casa azzurra ---
  zoccoloPiastrelle(Q, X(9), W, Y(0.42), H);
  morbido(Q, (k) => { sfuma(k, X(9), 0, 0.45 * s, H, [[0, conAlfa(OMBRA, 0.45)], [1, conAlfa(OMBRA, 0)]], true); }, { f: 6 });
  inchiostro(c, mano(r, [[X(9), Y(6.25)], [X(9), H]], false, 0.7), 1.8, 0.85);
  finestraVetri(Q, X(12.75), Y(4.15), X(14.65), Y(2.55), 2, 2, '#f3f0e8', true);
  c.save(); c.globalAlpha = 0.6; c.fillStyle = '#fbf8ef';                 // tendina di pizzo
  c.fillRect(X(12.83), Y(4.07), X(13.62) - X(12.83), 0.5 * s); c.restore(); davanzale(Q, X(12.75), X(14.65), Y(2.55));
  const sx = X(12.55), sy = Y(2.48), sl = X(14.85) - sx;                  // la fioriera con le piante verdi
  const ver = rami(r, sx + 0.1 * s, sx + sl - 0.1 * s, sy + 0.15 * s, 0.2, 0.9, 7, s); ver.fiori.length = 0;
  morbido(Q, (k) => disegnaRami(k, r, ver, conAlfa('#5a6fa0', 0.45)), { f: 5 }); disegnaRami(c, r, ver);
  for (let i = 0; i < 14; i++) pianta(c, r, sx + sl * (0.08 + i * 0.065), sy + 0.02 * s, tra(r, 0.28, 0.4) * s, i % 3 === 0 ? 'foglie' : 'tonde');
  const box = Forme.rettangolo(sx, sy, sl, 0.3 * s, 3); lava(c, box, '#d6907c', [sx, sy, sl, 0.3 * s], r, { n: 4, luce: true, bordo: 0.4 });
  inchiostro(c, box, 1.5, 0.85); sfuma(c, sx, sy + 0.3 * s, sl, 0.45 * s, [[0, conAlfa('#4f6290', 0.35)], [1, conAlfa('#4f6290', 0)]]);
  // finestrella in alto con le persiane aperte
  for (const px of [X(12.55), X(14.35)]) {
    const f = Forme.rettangolo(px, Y(5.45), 0.45 * s, 0.95 * s, 2); lava(c, f, '#6f9db0', [px, Y(5.45), 0.45 * s, 0.95 * s], r, { n: 2, bordo: 0.4 });
    c.strokeStyle = conAlfa('#3f6375', 0.6); c.lineWidth = 1.2; c.beginPath();
    for (let y = Y(5.45) + 0.08 * s; y < Y(4.5) - 0.04 * s; y += 0.07 * s) { c.moveTo(px + 0.05 * s, y); c.lineTo(px + 0.4 * s, y); }
    c.stroke(); inchiostro(c, f, 1.4, 0.85);
  }
  finestraVetri(Q, X(13.0), Y(5.45), X(14.35), Y(4.5), 2, 2, '#f3f0e8', true); davanzale(Q, X(13.0), X(14.35), Y(4.5));
  // il pluviale bianco e i fiori arancioni che ricadono dall'alto
  pluviale(Q, X(10.25), Y(5.72), Y(0.62)); const cas = rami(r, X(9.55), X(11.6), Y(5.75), 0.6, 2.4, 16, s);
  morbido(Q, (k) => { k.translate(0.16 * s, 0.1 * s); disegnaRami(k, r, cas, conAlfa('#4f6290', 0.55)); }, { f: 6 }); disegnaRami(c, r, cas);
  const sal = rami(r, X(10.1), X(10.45), Y(0.55), 0.3, 1.1, 3, s);       // rametti che salgono dal basso lungo il tubo
  for (const pts of sal.steli) for (const p of pts) p[1] = 2 * Y(0.55) - p[1];
  for (const f of sal.foglie) { f[1] = 2 * Y(0.55) - f[1]; f[2] = -f[2]; }
  sal.fiori.length = 0; disegnaRami(c, r, sal);
  for (const x of [9.6, 11.8, 15.3, 3.3, -1.2, 7.8]) ciuffo(c, r, X(x), H, tra(r, 0.15, 0.3) * s, 9, VERDI);   // erbette ai piedi del muro
  fiore(c, r, X(15.25), H - 0.25 * s, 0.03 * s, '#f28aa8'); fiore(c, r, X(15.4), H - 0.18 * s, 0.025 * s, '#f6a3c0'); carta(Q, 0.26);
  sfumaBordi(Q.tela, 0.9 * s, ['sinistra', 'destra']);
  return Q;
}

/** Selciato di mattoni rosa-arancio con la griglia di scolo lungo il muro. */
function selciatoPiazzetta() {
  const s = 150, Q = quadro(19, 5.6, s, 321), { c, r, W, H } = Q; const Z = (z) => (z + 1.6) * s;
  const PAV = ['#f6bb99', '#f3ad89', '#f8c6a8', '#f0a582', '#f5b592', '#f9cdb2'];
  lava(c, Forme.rettangolo(0, Z(-1.13), W, H - Z(-1.13)), '#e3956a', [0, Z(-1.13), W, H], r, { var: 0.2, bordo: 0, n: 30 });
  const lm = 0.46 * s, hm = 0.23 * s, g = 0.022 * s;
  for (let j = 0, y = Z(-1.13); y < H; j++, y += hm) {
    for (let x = -(j % 2) * lm / 2 - (j % 3) * 0.07 * s; x < W; x += lm) {
      const f = Forme.poligono(puntiMattone(r, x + g / 2, y + g / 2, lm - g, hm - g, 0.15));
      macchia(c, f, mescola(scegli(r, PAV), scegli(r, PAV), r() * 0.6), [x, y, lm, hm], 0.4);
      c.fillStyle = 'rgba(255,250,240,0.3)'; c.fillRect(x + g, y + g / 2 + 1, lm - 2 * g, hm * 0.12);
      if (r() < 0.6) inchiostro(c, f, 1, 0.45, '#c9764e');
    }
  }
  for (let i = 0; i < 40; i++) alone(c, r() * W, Z(-1.2) + r() * (H - Z(-1.2)), tra(r, 0.4, 1.3) * s, r() < 0.55 ? '#fff3e6' : '#d77c55', 0.13);
  // il canale di scolo: bordi di pietra e griglia di ferro con le fessure
  for (const [y0, y1] of [[0, Z(-1.57)], [Z(-1.21), Z(-1.13)]]) {
    for (let x = 0; x < W; x += 0.7 * s) {
      const f = Forme.rettangolo(x + 1, y0, 0.7 * s - 2, y1 - y0, 2);
      macchia(c, f, scegli(r, ['#ddd3c2', '#d4cab9', '#e3dacb']), [x, y0, 0.7 * s, y1 - y0], 0.4); inchiostro(c, f, 1, 0.6);
    }
  }
  const gy = Z(-1.57), ga = Z(-1.21) - gy;
  lava(c, Forme.rettangolo(0, gy, W, ga), '#8a6a56', [0, gy, W, ga], r, { n: 20, var: 0.35, tinta: '#b8784e', bordo: 0.3 });
  for (let x = 0; x < W; x += 0.62 * s) {
    for (let k = 0; k < 4; k++) for (const v of [0.25, 0.5, 0.75]) {
      const f = Forme.rettangolo(x + 0.05 * s + k * 0.14 * s, gy + ga * v - 0.02 * s, 0.11 * s, 0.04 * s, 0.02 * s);
      c.fillStyle = 'rgba(52,40,52,0.85)'; c.fill(f);
      c.fillStyle = 'rgba(190,120,80,0.45)'; c.fillRect(x + 0.06 * s + k * 0.14 * s, gy + ga * v + 0.01 * s, 0.09 * s, 0.008 * s);
    }
    inchiostro(c, mano(r, [[x, gy], [x, gy + ga]], false, 0.4), 1.2, 0.7);
  }
  inchiostro(c, rettMano(r, 0, gy, W, ga, 0.5), 1.3, 0.8);
  morbido(Q, (k) => {                                                    // ombra al piede del muro, più fresca sotto la casa azzurra
    sfuma(k, 0, 0, W, 0.7 * s, [[0, conAlfa(OMBRA, 0.45)], [1, conAlfa(OMBRA, 0)]]);
  }, { f: 8 });
  sfuma(c, 0, 0, W, H, [[0, 'rgba(255,248,232,0)'], [1, 'rgba(255,248,232,0.3)']]); carta(Q);
  sfumaBordi(Q.tela, 0.9 * s, ['sinistra', 'destra', 'basso']);
  return Q;
}

/** Primo piano, in basso: ciuffi d'erba e fiorellini lungo tutto il bordo (x -3..16, y 0..0.8). */
function primoPianoErba() {
  const s = 200, A = 0.8, Q = quadro(19, A, s, 331), { c, r, H } = Q; const X = (x) => (x + 3) * s;
  const SCURI = ['#3f7a4a', '#4f8a55', '#5e9a5a', '#78b06a'];
  for (const [x, h] of [[-2.2, 0.5], [-0.6, 0.35], [1.5, 0.62], [3.5, 0.3], [5.3, 0.55], [7.9, 0.42], [10.4, 0.66], [12.2, 0.36], [14.3, 0.58], [15.6, 0.45]]) {
    ciuffo(c, r, X(x), H, h * s, 30, SCURI);
    for (let i = 0; i < 4; i++) {
      const fx = X(x) + tra(r, -0.25, 0.25) * s, fy = H - Math.min(0.75, h * tra(r, 0.6, 1.1)) * s;
      inchiostro(c, Forme.curva([[fx + tra(r, -6, 6), H], [fx, fy]]), 2, 0.8, '#4f8a55');
      fiore(c, r, fx, fy, 0.028 * s, scegli(r, ['#fffaf0', '#f6a3c0', '#f5cf5a', '#c9b3ef']));
    }
  }
  carta(Q, 0.22);
  return Q;
}

/** Primo piano, in alto a destra: fiori arancioni che pendono dall'angolo (x 13..16, y 1.2..2.6). */
function primoPianoFiori() {
  const s = 240, Q = quadro(3, 1.4, s, 341), { c, r, W } = Q; const ap = rami(r, 0.15 * W, W, 0, 0.45, 1.25, 16, s); disegnaRami(c, r, ap);
  carta(Q, 0.22);
  return Q;
}

/* ============================ 7. LE SCENE ================================ */
const SCENE = {
  async libreria(metti) {
    await metti(pavimentoLibreria(), { nome: 'pavimento', normale: 'su', x: -1.5, y: 0, z: -3, larghezza: 12, profondita: 6.5 });
    await metti(pareteFondoLibreria(), { nome: 'parete_fondo', normale: 'z+', x: -1.5, y: 0, z: -3, larghezza: 12, altezza: ALTO });
    await metti(pareteSinistraLibreria(), { nome: 'parete_sinistra', normale: 'x+', x: -1.5, y: 0, z: -3, larghezza: 6.5, altezza: ALTO });
    await metti(pareteDestraLibreria(), { nome: 'parete_destra', normale: 'x-', x: 10.5, y: 0, z: -3, larghezza: 6.5, altezza: ALTO });
    await metti(soffittoLibreria(), { nome: 'soffitto', normale: 'giu', x: -1.5, y: ALTO, z: -3, larghezza: 12, profondita: 6.5 });
    await metti(lampadaAppesa(161), { nome: 'lampada_1', normale: 'z+', x: 1.95, y: 2.55, z: -0.8, larghezza: 0.6, altezza: 1.05, luce: 0.8, ordine: 1 });
    await metti(lampadaAppesa(162), { nome: 'lampada_2', normale: 'z+', x: 6.45, y: 2.55, z: -0.8, larghezza: 0.6, altezza: 1.05, luce: 0.8, ordine: 1 });
  },
  async terrazza(metti) {
    await metti(mucchioLontano(), { nome: 'mucchio_lontano', normale: 'z+', x: -40, y: -14, z: -40, larghezza: 96, altezza: 22, ordine: -3 });
    await metti(tettiVicini(), { nome: 'tetti_vicini', normale: 'z+', x: -12, y: -3, z: -9, larghezza: 40, altezza: 6, ordine: -2 });
    await metti(pavimentoTerrazza(), { nome: 'pavimento', normale: 'su', x: -2, y: 0, z: -2.2, larghezza: 18, profondita: 5.2 });
    await metti(casotto(), { nome: 'casotto', normale: 'z+', x: -2, y: 0, z: -2.2, larghezza: 3.5, altezza: 3.3 });
    await metti(ringhiera(), { nome: 'ringhiera', normale: 'z+', x: 1.5, y: 0, z: -2.2, larghezza: 14.5, altezza: 1.1 });
    await metti(paloBucato(271), { nome: 'palo_bucato_1', normale: 'z+', x: 3.97, y: 0, z: -1.6, larghezza: 0.3, altezza: 2.65 });
    await metti(paloBucato(272), { nome: 'palo_bucato_2', normale: 'z+', x: 10.73, y: 0, z: -1.6, larghezza: 0.3, altezza: 2.65 });
    await metti(bucato(), { nome: 'bucato', normale: 'z+', x: 4, y: 1.6, z: -1.6, larghezza: 7, altezza: 1, tremola: 0.6, ordine: 1 });
  },
  async piazzetta(metti) {
    await metti(muroPiazzetta(), { nome: 'muro', normale: 'z+', x: -3, y: 0, z: -1.6, larghezza: 19, altezza: 7 });
    await metti(selciatoPiazzetta(), { nome: 'selciato', normale: 'su', x: -3, y: 0, z: -1.6, larghezza: 19, profondita: 5.6 });
    await metti(primoPianoErba(), { nome: 'primo_piano_erba', normale: 'z+', x: -3, y: 0, z: 3.5, larghezza: 19, altezza: 0.8, ordine: 2 });
    await metti(primoPianoFiori(), { nome: 'primo_piano_fiori', normale: 'z+', x: 13, y: 1.2, z: 3.5, larghezza: 3, altezza: 1.4, ordine: 2, tremola: 0.3 });
  },
};

/**
 * Dipinge tutti gli strati di una scena: 'libreria', 'terrazza' o 'piazzetta'.
 * Tra uno strato e l'altro lascia respirare la pagina.
 */
export async function dipingiScena(nome) {
  const scena = SCENE[nome];
  if (!scena) throw new Error('scene_varie: scena sconosciuta "' + nome + '"');
  const strati = [];
  await scena(async (Q, d) => { strati.push(...affetta(Q.tela, d)); await respira(); });
  return { strati };
}
