/* ==========================================================================
 *  scene_piazza.js — I FONDALI DELLA PIAZZETTA DEL FORNO E DEL FORNO
 *  --------------------------------------------------------------------------
 *  Due scene "multiplane" dipinte ad acquerello dal codice, nello stile dei
 *  fondali del corto "Out of Sight":
 *
 *    'piazza' — la piazzetta di mattoni rosa: la staccionata col buco, la
 *               panetteria con la vetrina, il cancello del giardino, la casa
 *               gialla, la casa verde acqua e il vicolo del gattino
 *    'forno'  — dentro la panetteria: scaffali di pane, bancone, forno acceso
 *
 *  Ogni scena è un elenco di STRATI (vedi js/motore/strati.js): fogli dipinti
 *  appesi nello spazio. Qui si dipinge in METRI: ogni "dipinto" sa quanti
 *  pixel fanno un metro (k) e ogni scena usa due funzioncine X() e Y() che
 *  trasformano le coordinate del mondo in pixel della tela.
 *
 *  Uso:   const { strati } = await dipingiScena('piazza');
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa, percorso,
  Forme, trama, tinta, linea, velatura, foglia, fiorellini, respira,
} from './pennello.js';

/* ----------------------------- TAVOLOZZA -------------------------------- */
const INK = STILE.inchiostro;
const CARTA = '#fffaf0';
const OMBRA = '#5d4b7c';                                   // ombre lilla, mai nere
const VIRATE = ['#f3c46a', '#e8747c', '#86a9d6', '#9cc58a']; // tinte vicine per variare il pigmento
const MATTONI = ['#f6ab8c', '#f8b99c', '#f39e80', '#fac3a8', '#f4a585', '#f09576', '#f9cbb2'];
const PAVE = ['#f7c39e', '#f5b690', '#f9cda9', '#f3ad86', '#f8c7a2', '#f6bc96'];
const TEGOLE = ['#d9744a', '#e0855a', '#cf6a42', '#e89a6a', '#d47e55'];
const SASSI = ['#e6d1a6', '#dcc497', '#eedcb5', '#d6bc8e', '#e2c9a0'];
const EDERA = ['#3f7d57', '#4f9468', '#6fb07a', '#8fc488'];
const VERDI = ['#4a8a4c', '#6fae5e', '#a6d384'];
const LEGNO = '#b98252';
const CROSTA = '#e3a35a', MOLLICA = '#f7dcae';            // i colori del pane
const R = Forme.rettangolo, E = Forme.ellisse, P = Forme.poligono, C = Forme.cerchio;

/* ==================== 1. TELE MISURATE IN METRI ========================= */

/** Un dipinto largo L e alto A metri, con k pixel per metro e il suo "caso". */
function dipinto(L, A, k, seme) {
  const tela = nuovaTela(Math.round(L * k), Math.round(A * k));
  return { tela, c: tela.getContext('2d'), L, A, k, l: tela.width, a: tela.height, r: casuale(seme) };
}

/**
 * Taglia un dipinto in pezzi da al massimo 2048 pixel (il limite delle
 * texture) e restituisce gli strati con la loro posizione nel mondo.
 * base: { nome, normale, x, y, z, ...altro } — l'angolo minimo del dipinto intero.
 */
function affetta(D, base) {
  const nx = Math.ceil(D.l / 2048), ny = Math.ceil(D.a / 2048), out = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const ox = Math.round(i * D.l / nx), oy = Math.round(j * D.a / ny);
      const w = Math.round((i + 1) * D.l / nx) - ox, h = Math.round((j + 1) * D.a / ny) - oy;
      let tela = D.tela;
      if (nx * ny > 1) { tela = nuovaTela(w, h); tela.getContext('2d').drawImage(D.tela, ox, oy, w, h, 0, 0, w, h); }
      const a0 = ox / D.l, a1 = (ox + w) / D.l, b0 = oy / D.a, b1 = (oy + h) / D.a; // frazioni del dipinto
      const s = { ...base, tela, larghezza: (a1 - a0) * D.L };
      if (nx * ny > 1) s.nome = base.nome + '_' + (out.length + 1);
      if (base.normale === 'su' || base.normale === 'giu') s.profondita = (b1 - b0) * D.A; else s.altezza = (b1 - b0) * D.A;
      switch (base.normale) {
        case 'x+': s.z = base.z + (1 - a1) * D.L; s.y = base.y + (1 - b1) * D.A; break; // a sinistra la z più grande
        case 'x-': s.z = base.z + a0 * D.L; s.y = base.y + (1 - b1) * D.A; break;
        case 'su': s.x = base.x + a0 * D.L; s.z = base.z + b0 * D.A; break;        // in alto la z più piccola
        case 'giu': s.x = base.x + a0 * D.L; s.z = base.z + (1 - b1) * D.A; break;  // in alto la z più grande
        default: s.x = base.x + a0 * D.L; s.y = base.y + (1 - b1) * D.A;            // 'z+'
      }
      out.push(s);
    }
  }
  return out;
}

/* =========================== 2. IL CASO ================================= */
const scegli = (r, el) => el[Math.floor(r() * el.length)];
const misto = (r, el) => mescola(scegli(r, el), scegli(r, el), r() * 0.5); // pigmento mai uguale
const nuovoSeme = (r) => Math.floor(r() * 1e6) + 1;
/** Aggiunge le tappe di colore a una sfumatura: sfuma(g, [0, 'red'], [1, 'blue']). */
function sfuma(g, ...tappe) { for (const [t, col] of tappe) g.addColorStop(t, col); return g; }

/* ======================== 3. FORME "A MANO" ============================= */

/** Spezzata a mano libera: i punti tremano un poco, come una penna vera. */
function mano(r, punti, chiuso, t = 0.6, p = new Path2D()) {
  const j = (v) => v + (r() - 0.5) * 2 * t, pts = chiuso ? punti.concat([punti[0]]) : punti;
  p.moveTo(j(pts[0][0]), j(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 28));
    for (let s = 1; s <= n; s++) {
      const m = (s - 0.5) / n, f = s / n;
      p.quadraticCurveTo(j(x0 + (x1 - x0) * m), j(y0 + (y1 - y0) * m), j(x0 + (x1 - x0) * f), j(y0 + (y1 - y0) * f));
    }
  }
  if (chiuso) p.closePath();
  return p;
}
/** Rettangolo a mano: quattro tratti che sbordano un pochino agli angoli. */
function rettMano(r, x, y, l, a, t = 0.5, p = new Path2D()) {
  const e = () => tra(r, -0.3, 2);
  mano(r, [[x - e(), y], [x + l + e(), y]], false, t, p);
  mano(r, [[x + l, y - e()], [x + l, y + a + e()]], false, t, p);
  mano(r, [[x + l + e(), y + a], [x - e(), y + a]], false, t, p);
  return mano(r, [[x, y + a + e()], [x, y - e()]], false, t, p);
}
/** Punti attorno a un'ellisse un po' storta (macchie, chiome, cespugli). */
function blob(r, cx, cy, rx, ry, n, irr) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, q = 1 + tra(r, -irr, irr);
    pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]);
  }
  return pts;
}
/** Contorno "a nuvoletta" per schizzare chiome e cespugli. */
function nuvola(r, cx, cy, rx, ry, n) {
  const pts = blob(r, cx, cy, rx, ry, n, 0.12), p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    p.quadraticCurveTo(cx + (mx - cx) * 1.3, cy + (my - cy) * 1.3, b[0], b[1]);
  }
  return p;
}
/** Mattone o piastrella: rettangolo con gli angoli smussati e un po' storti. */
function puntiMattone(r, x, y, l, a, t = 0.25) {
  const q = Math.min(l, a) * t, j = () => tra(r, -0.8, 0.8);
  return [[x + q, y + j()], [x + l - q, y + j()], [x + l + j(), y + q], [x + l + j(), y + a - q],
    [x + l - q, y + a + j()], [x + q, y + a + j()], [x + j(), y + a - q], [x + j(), y + q]];
}
/** Sasso "a cuscino": un'ellisse squadrata un po' storta. */
function puntiSasso(r, cx, cy, rx, ry) {
  const pts = [], pot = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.6);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 + tra(r, -0.12, 0.12), q = 1 + tra(r, -0.08, 0.06);
    pts.push([cx + rx * q * pot(Math.cos(t)), cy + ry * q * pot(Math.sin(t))]);
  }
  return pts;
}
/** Rettangolo con la cima ad arco (ry = altezza dell'arco, di solito metà larghezza). */
function arco(x, y, l, a, ry = l / 2) {
  const p = new Path2D();
  p.moveTo(x, y + a); p.lineTo(x, y + ry);
  p.ellipse(x + l / 2, y + ry, l / 2, ry, 0, Math.PI, 0);
  p.lineTo(x + l, y + a); p.closePath();
  return p;
}

/* ====================== 4. PENNELLI AD ACQUERELLO ======================= */

/** Macchia: stesura + bordo più scuro dove il colore si asciuga. */
function macchia(c, forma, colore, alfa = 0.94, bordo = 0.35, lb = 2.5) {
  const p = percorso(forma);
  c.save(); c.globalAlpha = alfa; c.fillStyle = colore; c.fill(p);
  if (bordo) { c.clip(p); c.globalAlpha = bordo; c.strokeStyle = scurisci(colore, 0.3); c.lineWidth = lb * 2; c.stroke(p); }
  c.restore();
}
/** Linea a inchiostro seppia. */
function ink(c, forma, sp = 1.3, alfa = 0.85) { linea(c, forma, { spessore: sp, alfa }); }
/** Volume: chiaro in alto a sinistra, ombra lilla in basso a destra. */
function volume(c, forma, x, y, l, a, f = 1) {
  c.save(); c.clip(percorso(forma));
  c.fillStyle = sfuma(c.createLinearGradient(x, y, x + l * 0.4, y + a),
    [0, 'rgba(255,252,240,' + 0.45 * f + ')'], [0.5, 'rgba(255,252,240,0)'], [1, conAlfa(OMBRA, 0.28 * f)]);
  c.fillRect(x, y, l, a); c.restore();
}
/** Volume di una cosa tonda (sassi, pagnotte): lucido in alto, ombra sul bordo basso. */
function volumeTondo(c, forma, cx, cy, rx, ry) {
  c.save(); c.clip(percorso(forma)); c.translate(cx, cy); c.scale(1, ry / rx);
  c.fillStyle = sfuma(c.createRadialGradient(-rx * 0.3, -rx * 0.35, 0, -rx * 0.1, -rx * 0.1, rx * 1.25),
    [0, 'rgba(255,252,240,0.55)'], [0.45, 'rgba(255,252,240,0)'], [0.75, conAlfa(OMBRA, 0.08)], [1, conAlfa(OMBRA, 0.4)]);
  c.fillRect(-rx * 1.5, -rx * 1.5, rx * 3, rx * 3); c.restore();
}
/** Ombra lilla che sfuma verso il basso (sotto cornici, davanzali, mensole). */
function ombraSotto(c, x, y, l, h, alfa) {
  c.save(); c.fillStyle = sfuma(c.createLinearGradient(0, y, 0, y + h), [0, conAlfa(OMBRA, alfa)], [1, conAlfa(OMBRA, 0)]);
  c.fillRect(x, y, l, h); c.restore();
}
/** Bagliore di luce che si SOMMA ai colori (lampade, fuoco, vetrina). sy schiaccia in verticale. */
function bagliore(c, x, y, rr, colore, alfa, sy = 1) {
  c.save(); c.globalCompositeOperation = 'lighter'; c.translate(x, y); c.scale(1, sy);
  c.fillStyle = sfuma(c.createRadialGradient(0, 0, 0, 0, 0, rr), [0, conAlfa(colore, alfa)], [1, conAlfa(colore, 0)]);
  c.fillRect(-rr, -rr, rr * 2, rr * 2); c.restore();
}
/** Velo morbido sopra quello che c'è già (solo dove è dipinto): luce, foschia, ombra. */
function velo(c, x, y, rr, colore, alfa, sy = 1) {
  c.save(); c.globalCompositeOperation = 'source-atop'; c.translate(x, y); c.scale(1, sy);
  c.fillStyle = sfuma(c.createRadialGradient(0, 0, 0, 0, 0, rr), [0, conAlfa(colore, alfa)], [1, conAlfa(colore, 0)]);
  c.fillRect(-rr, -rr, rr * 2, rr * 2); c.restore();
}

/**
 * LAVAGGIO: la stesura di fondo (intonaco, muschio, acqua...). Pennellate
 * orizzontali, macchie di pigmento, "fioriture" con il bordino e colature.
 * forma (facoltativa) limita il colore; o: { variazione, macchie, fioriture, colature, luce, seme }
 */
function lavaggio(D, forma, x, y, l, a, colore, o = {}) {
  const c = D.c, k = D.k, r = casuale(o.seme || nuovoSeme(D.r)), v = o.variazione ?? 0.22, area = (l * a) / (k * k);
  c.save(); c.beginPath(); c.rect(x, y, l, a); c.clip();
  if (forma) c.clip(percorso(forma));
  c.fillStyle = colore; c.fillRect(x, y, l, a);
  for (let i = 0; i < 2 + a / (0.7 * k); i++) {          // a) pennellate orizzontali
    const yy = y + r() * a, h = tra(r, 0.3, 1.1) * k, tono = r() < 0.5 ? schiarisci(colore, 0.35) : scurisci(colore, 0.12);
    c.fillStyle = sfuma(c.createLinearGradient(0, yy - h / 2, 0, yy + h / 2), [0, conAlfa(tono, 0)], [0.5, conAlfa(tono, v * 0.7)], [1, conAlfa(tono, 0)]);
    c.fillRect(x, yy - h / 2, l, h);
  }
  const n = o.macchie ?? Math.min(160, Math.round(area * 0.45) + 3);
  for (let i = 0; i < n; i++) {                           // b) macchie di pigmento
    const cx = x + r() * l, cy = y + r() * a, rr = tra(r, 0.35, 1.3) * k, q = r();
    const tono = q < 0.45 ? schiarisci(colore, 0.4) : q < 0.8 ? scurisci(colore, 0.2) : mescola(colore, scegli(r, VIRATE), 0.35);
    c.fillStyle = sfuma(c.createRadialGradient(cx, cy, 0, cx, cy, rr), [0, conAlfa(tono, v * tra(r, 0.5, 1.1))], [1, conAlfa(tono, 0)]);
    c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  const nf = o.fioriture ?? Math.min(40, Math.round(area * 0.12));
  c.lineWidth = Math.max(1.2, k * 0.016);
  for (let i = 0; i < nf; i++) {                          // c) fioriture: aloni chiari col bordino scuro
    const cx = x + r() * l, cy = y + r() * a, rr = tra(r, 0.12, 0.45) * k;
    const f = P(blob(r, cx, cy, rr, rr * tra(r, 0.5, 1), 9, 0.3), true);
    c.globalAlpha = 0.13; c.fillStyle = schiarisci(colore, 0.5); c.fill(f);
    c.globalAlpha = 0.2; c.strokeStyle = scurisci(colore, 0.3); c.stroke(f);
  }
  c.globalAlpha = 1;
  const nc = o.colature ?? Math.round(l / (0.6 * k));
  for (let i = 0; i < nc; i++) {                          // d) colature: il colore scivola giù
    const cx = x + r() * l, w = tra(r, 0.06, 0.22) * k, y0 = y + r() * a * 0.8, h = tra(r, 0.6, 2.2) * k;
    const tono = r() < 0.6 ? scurisci(colore, 0.18) : schiarisci(colore, 0.4);
    c.fillStyle = sfuma(c.createLinearGradient(0, y0, 0, y0 + h), [0, conAlfa(tono, 0)], [0.3, conAlfa(tono, v * 0.6)], [1, conAlfa(tono, 0)]);
    c.beginPath(); c.ellipse(cx, y0 + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
  }
  if (o.luce !== false) velatura(c, x, y, l, a, ['rgba(255,250,232,0.3)', 'rgba(255,250,232,0)', 'rgba(255,250,232,0)']);
  c.restore();
}

/* La grana della carta: le trame di pennello.js trasformate in puntini
   trasparenti, così si posano SOLO dove c'è già colore. */
let GRANE = null;
function grane() {
  if (GRANE) return GRANE;
  GRANE = [['grana', 0.93, 3, [92, 62, 56]], ['macchie', 0.86, 2.2, [120, 80, 110]]].map(([tipo, soglia, forza, rgb]) => {
    const d = trama(tipo).getContext('2d').getImageData(0, 0, 256, 256).data, t = nuovaTela(256, 256), x = t.getContext('2d'), img = x.createImageData(256, 256);
    for (let p = 0; p < d.length; p += 4) {
      img.data[p] = rgb[0]; img.data[p + 1] = rgb[1]; img.data[p + 2] = rgb[2];
      img.data[p + 3] = Math.max(0, Math.min(255, (soglia - d[p] / 255) * forza * 255));
    }
    x.putImageData(img, 0, 0); return t;
  });
  return GRANE;
}
function carta(D, forza = 1) {
  const c = D.c, [g, m] = grane();
  c.save(); c.globalCompositeOperation = 'source-atop';
  c.globalAlpha = 0.15 * forza; c.fillStyle = c.createPattern(g, 'repeat'); c.fillRect(0, 0, D.l, D.a);
  c.globalAlpha = 0.08 * forza; c.fillStyle = c.createPattern(m, 'repeat'); c.fillRect(0, 0, D.l, D.a);
  c.restore();
}

/**
 * Il dipinto si schiarisce verso i bordi e svanisce nella carta.
 * lati: { sinistra | destra | alto | basso: metri  oppure  [metri, bianco, vuoto] }
 *   bianco: quanto si schiarisce sul bordo (0..1); vuoto: frazione che diventa trasparente
 */
function sfumaCarta(D, lati) {
  const c = D.c, W = D.l, H = D.a, r = casuale(77);
  const banda = (lato, w) => ({
    sinistra: [c.createLinearGradient(0, 0, w, 0), [0, 0, w, H]], destra: [c.createLinearGradient(W, 0, W - w, 0), [W - w, 0, w, H]],
    alto: [c.createLinearGradient(0, 0, 0, w), [0, 0, W, w]], basso: [c.createLinearGradient(0, H, 0, H - w), [0, H - w, W, w]],
  })[lato];
  c.save();
  for (const [lato, val] of Object.entries(lati)) {
    const [m, bianco, vuoto] = Array.isArray(val) ? val : [val, 0.75, 0.45], w = m * D.k;
    c.globalCompositeOperation = 'source-atop';
    let [g, rr] = banda(lato, w);
    c.fillStyle = sfuma(g, [0, conAlfa(CARTA, bianco)], [1, conAlfa(CARTA, 0)]); c.fillRect(...rr);
    if (!vuoto) continue;
    c.globalCompositeOperation = 'destination-out';
    [g, rr] = banda(lato, w * vuoto);
    c.fillStyle = sfuma(g, [0, 'rgba(0,0,0,1)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']); c.fillRect(...rr);
    for (let i = 0; i < 26; i++) {                          // bordo irregolare, come la carta bagnata
      const t = r(), rad = w * vuoto * tra(r, 0.3, 0.7);
      const [px, py] = { sinistra: [0, t * H], destra: [W, t * H], alto: [t * W, 0], basso: [t * W, H] }[lato];
      c.fillStyle = sfuma(c.createRadialGradient(px, py, 0, px, py, rad), [0, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']);
      c.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
  }
  c.restore();
}
/** Fa un buco trasparente nella tela con la forma data (vetrine, bocca del forno...). */
function buca(c, forma) {
  c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(percorso(forma)); c.restore();
}
/** Ultimo passaggio di ogni dipinto: grana della carta e bordi che svaniscono. */
function finitura(D, lati, forza) { carta(D, forza); if (lati) sfumaCarta(D, lati); }

/* ================= 5. MURATURE: MATTONI, SASSI, TETTI =================== */

/**
 * POSA di mattoni (o piastrelle) in file, dal basso verso l'alto, nel riquadro
 * x0..x1, y0..y1 (pixel). o: { alto, lungo (pixel), giunto, colori, malta,
 * sfalsa (0..1), sfasa, varia, tondi, luce, inch, sp }
 */
function posa(D, x0, y0, x1, y1, o) {
  const c = D.c, r = D.r, h = o.alto, g = o.giunto ?? Math.max(2, h * 0.13), sfalsa = o.sfalsa ?? 0.5;
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  if (o.malta) lavaggio(D, null, x0, y0, x1 - x0, y1 - y0, o.malta, { variazione: 0.15, luce: false, colature: 0, fioriture: 0 });
  for (let j = 0, y = y1 - h; y > y0 - h; j++, y -= h) {
    let x = x0 - (j % 2) * sfalsa * o.lungo - r() * (o.sfasa ?? 0) * o.lungo;
    while (x < x1) {
      const l = o.lungo * (1 + tra(r, -1, 1) * (o.varia ?? 0.12));
      const bx = x + g / 2, by = y + g / 2, bl = l - g, bh = h - g + tra(r, -1, 0.5);
      const f = P(puntiMattone(r, bx, by, bl, bh, o.tondi ?? 0.25), true);
      macchia(c, f, misto(r, o.colori), 0.95, 0.3, Math.max(1.5, h * 0.07));
      if (o.luce !== 0) volume(c, f, bx, by, bl, bh, o.luce ?? 0.6);
      if (o.inch !== 0) ink(c, f, o.sp ?? 1.1, o.inch ?? 0.6);
      x += l;
    }
  }
  c.restore();
}
/** SASSI tondi e grossi nella malta scura (zoccolo della casa gialla). */
function sassi(D, x0, y0, x1, y1, righe) {
  const c = D.c, r = D.r, h = (y1 - y0) / righe;
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  lavaggio(D, null, x0, y0, x1 - x0, y1 - y0, '#8f6e4e', { variazione: 0.25, luce: false, colature: 0, fioriture: 0 });
  for (let j = 0; j < righe; j++) {
    for (let x = x0 - r() * h; x < x1;) {
      const l = h * tra(r, 1.3, 2.1), cx = x + l / 2, cy = y0 + (j + 0.5) * h + tra(r, -h * 0.06, h * 0.06);
      const f = P(puntiSasso(r, cx, cy, l / 2 - 3, h / 2 - 3), true);
      macchia(c, f, misto(r, SASSI), 0.97, 0.3, 3); volumeTondo(c, f, cx, cy, l / 2, h / 2); ink(c, f, 1.3, 0.8);
      x += l + tra(r, 0, 4);
    }
  }
  c.restore();
}
/** Fascia di zoccolo in basso a un muro d'intonaco (alta h metri). */
function zoccolo(D, x0, x1, h, colore) {
  const y = D.a - h * D.k;
  lavaggio(D, null, x0, y, x1 - x0, h * D.k, colore, { variazione: 0.2, colature: 0, fioriture: 3, luce: false });
  ink(D.c, mano(D.r, [[x0, y], [x1, y]], false, 0.5), 1.3);
  ombraSotto(D.c, x0, y, x1 - x0, 0.08 * D.k, 0.25);
}
/** TETTO visto di fronte: file di coppi che si sovrappongono, gronda e ombra sul muro. */
function tetto(D, x0, x1, yb, yt, o = {}) {
  const c = D.c, r = D.r, k = D.k, sp = (o.sporge ?? 0.25) * k, ri = (o.rientro ?? 0.5) * k;
  const forma = P([[x0 - sp, yb], [x1 + sp, yb], [x1 + sp - ri, yt], [x0 - sp + ri, yt]]);
  const th = 0.22 * k, tw = 0.26 * k;
  c.save(); c.clip(forma);
  c.fillStyle = '#8f4a35'; c.fillRect(x0 - sp, yt, x1 - x0 + 2 * sp, yb - yt);
  const file = []; for (let y = yb - th * 0.2; y > yt - th; y -= th * 0.8) file.push(y);
  file.forEach((y, j) => {                                 // dal basso in alto: le file alte coprono le basse
    for (let x = x0 - sp - (j % 2) * tw / 2 - r() * 3; x < x1 + sp; x += tw) {
      const t = new Path2D(), rr = tw / 2 - 1;
      t.moveTo(x + 1, y - th); t.lineTo(x + tw - 1, y - th); t.lineTo(x + tw - 1, y - rr); t.arc(x + tw / 2, y - rr, rr, 0, Math.PI); t.closePath();
      c.save(); c.translate(0, 3); tinta(c, t, OMBRA, 0.25); c.restore();
      macchia(c, t, misto(r, TEGOLE), 0.97, 0.3, 2);
      c.fillStyle = 'rgba(255,238,210,0.3)'; c.fillRect(x + 3, y - th, tw * 0.28, th * 0.8);
      const b = new Path2D(); b.arc(x + tw / 2, y - rr, rr, 0.1, Math.PI - 0.1); ink(c, b, 1, 0.7);
    }
  });
  velatura(c, x0 - sp, yt, x1 - x0 + 2 * sp, yb - yt, ['rgba(255,246,230,0.4)', 'rgba(255,246,230,0)']);
  c.restore();
  ink(c, mano(r, [[x0 - sp + ri, yt], [x1 + sp - ri, yt], [x1 + sp, yb]], false, 0.5), 1.3);
  ink(c, mano(r, [[x0 - sp, yb], [x0 - sp + ri, yt]], false, 0.5), 1.3);
  const g = R(x0 - sp, yb - 0.05 * k, x1 - x0 + 2 * sp, 0.12 * k, 2);   // gronda
  macchia(c, g, '#f3e6d4', 0.97, 0.25, 2); ink(c, rettMano(r, x0 - sp, yb - 0.05 * k, x1 - x0 + 2 * sp, 0.12 * k, 0.4), 1.2);
  ombraSotto(c, x0 - sp, yb + 0.07 * k, x1 - x0 + 2 * sp, 0.3 * k, 0.32);
}
/** Comignolo con cappello e vasetto di terracotta. */
function camino(D, x, yb, l, h, colore) {
  const c = D.c, r = D.r, k = D.k, y = yb - h, f = R(x, y, l, h, 2);
  macchia(c, f, colore, 0.97, 0.35, 3); volume(c, f, x, y, l, h, 0.8);
  const p = new Path2D();
  for (let yy = y + 0.2 * k; yy < yb; yy += 0.2 * k) mano(r, [[x + 2, yy], [x + l - 2, yy]], false, 0.4, p);
  ink(c, p, 0.8, 0.35); ink(c, rettMano(r, x, y, l, h, 0.5), 1.3);
  const vaso = R(x + l * 0.3, y - 0.26 * k, l * 0.4, 0.2 * k, 2);
  macchia(c, vaso, '#d9774f'); ink(c, vaso, 1.1);
  const cap = R(x - 0.06 * k, y - 0.08 * k, l + 0.12 * k, 0.1 * k, 2);
  macchia(c, cap, '#efe0cc', 0.97, 0.3, 2); ink(c, cap, 1.2); ombraSotto(c, x, y + 0.02 * k, l, 0.15 * k, 0.3);
}
/** Cornicione: modanatura chiara con i dentelli e l'ombra sotto. */
function cornicione(D, x0, x1, y, h, colore) {
  const c = D.c, r = D.r, k = D.k;
  macchia(c, R(x0, y, x1 - x0, h), colore, 0.97, 0.2, 2);
  c.fillStyle = conAlfa(scurisci(colore, 0.15), 0.6); c.fillRect(x0, y + h * 0.45, x1 - x0, h * 0.35);
  const p = mano(r, [[x0, y], [x1, y]], false, 0.4);
  mano(r, [[x0, y + h * 0.45], [x1, y + h * 0.45]], false, 0.4, p); mano(r, [[x0, y + h], [x1, y + h]], false, 0.4, p);
  for (let x = x0 + 4; x < x1 - 0.1 * k; x += 0.16 * k) {
    tinta(c, R(x, y + h * 0.48, 0.08 * k, h * 0.3), schiarisci(colore, 0.3)); rettMano(r, x, y + h * 0.48, 0.08 * k, h * 0.3, 0.3, p);
  }
  ink(c, p, 1.1, 0.8); ombraSotto(c, x0, y + h, x1 - x0, 0.22 * k, 0.32);
}
/** Pietre d'angolo (cantonale) lungo lo spigolo x, verso destra (dir 1) o sinistra (-1). */
function cantonale(D, x, y0, y1, dir, colore) {
  const c = D.c, r = D.r, k = D.k;
  for (let y = y1, j = 0; y > y0 + 4; j++, y -= 0.34 * k) {
    const w = (j % 2 ? 0.24 : 0.36) * k, bx = dir > 0 ? x : x - w, f = P(puntiMattone(r, bx, y - 0.32 * k, w, 0.3 * k, 0.15), true);
    macchia(c, f, mescola(colore, CARTA, r() * 0.25), 0.9, 0.25, 2); ink(c, f, 0.9, 0.4);
  }
}
/** Pluviale: il tubo della grondaia, con i collari. */
function pluviale(D, x, y0, y1) {
  const c = D.c, r = D.r, k = D.k, w = 0.1 * k, f = R(x - w / 2, y0, w, y1 - y0, 2);
  tinta(c, R(x - w / 2 + 0.05 * k, y0, w, y1 - y0), OMBRA, 0.15);
  macchia(c, f, '#e6eaee', 0.97, 0.3, 2);
  velatura(c, x - w / 2, y0, w, y1 - y0, ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(110,130,170,0.3)'], 1, 'orizzontale');
  const p = mano(r, [[x - w / 2, y0], [x - w / 2, y1]], false, 0.4); mano(r, [[x + w / 2, y0], [x + w / 2, y1]], false, 0.4, p);
  for (let yy = y0 + 0.6 * k; yy < y1 - 0.3 * k; yy += 1.4 * k) {
    tinta(c, R(x - w / 2 - 2, yy, w + 4, 0.05 * k), '#ffffff', 0.9); rettMano(r, x - w / 2 - 2, yy, w + 4, 0.05 * k, 0.3, p);
  }
  ink(c, p, 1.1);
}

/* ===================== 6. FINESTRE, PORTE, LANTERNE ===================== */

/**
 * FINESTRA (cx centro, yb bordo basso, l e a in pixel).
 * o: { telaio, vetro, colonne, righe, arco, persiane, cornice, tenda, fiori, davanzale }
 */
function finestra(D, cx, yb, l, a, o = {}) {
  const c = D.c, r = D.r, k = D.k, x = cx - l / 2, y = yb - a, sp = Math.max(3, 0.06 * k), m = 0.09 * k;
  const forma = o.arco ? arco(x, y, l, a) : R(x, y, l, a, 2), telaio = o.telaio ?? '#f6f1e6', vc = o.vetro ?? '#c4dfe9';
  if (o.cornice) {
    const cf = o.arco ? arco(x - m, y - m, l + 2 * m, a + 2 * m) : R(x - m, y - m, l + 2 * m, a + 2 * m, 3);
    macchia(c, cf, o.cornice, 0.95, 0.3, 2); ink(c, cf, 1.2, 0.75);
  }
  if (o.persiane) {
    for (const s of [-1, 1]) {
      const px = s < 0 ? x - l / 2 - 3 : x + l + 3, pf = R(px, y + (o.arco ? l * 0.25 : 0), l / 2, a - (o.arco ? l * 0.25 : 0), 2);
      macchia(c, pf, o.persiane, 0.96, 0.35, 2); volume(c, pf, px, y, l / 2, a, 0.5);
      const q = new Path2D(); ink(c, pf, 1.2, 0.8);
      for (let yy = y + (o.arco ? l * 0.25 : 0) + 0.1 * k; yy < yb - 4; yy += 0.09 * k) mano(r, [[px + 3, yy], [px + l / 2 - 3, yy]], false, 0.3, q);
      ink(c, q, 0.9, 0.55);
    }
  }
  tinta(c, o.arco ? arco(x + 4, y + 4, l, a) : R(x + 4, y + 4, l, a), OMBRA, 0.2);
  c.save(); c.clip(forma);                                // il vetro, con i riflessi del cielo
  c.fillStyle = sfuma(c.createLinearGradient(x, y, x + l * 0.6, yb), [0, schiarisci(vc, 0.5)], [0.55, vc], [1, scurisci(vc, 0.15)]);
  c.fillRect(x, y, l, a);
  if (o.tenda) {
    c.fillStyle = 'rgba(255,253,246,0.8)';
    c.fill(P([[x, y], [x + l, y], [x + l, y + a * 0.25], [x + l * 0.7, y + a * 0.18], [x + l / 2, y + a * 0.3], [x + l * 0.3, y + a * 0.18], [x, y + a * 0.25]], true));
  }
  c.fillStyle = 'rgba(255,255,255,0.42)';
  for (const [f, w] of [[0.15, 0.22], [0.5, 0.08]]) c.fill(P([[x + l * f, yb], [x + l * (f + w), yb], [x + l * (f + w + 0.45), y], [x + l * (f + 0.45), y]]));
  c.restore();
  const g = new Path2D(), cols = o.colonne ?? 2, rows = o.righe ?? 3, y0 = o.arco ? y + l / 2 : y;
  for (let i = 1; i < cols; i++) { g.moveTo(x + (l * i) / cols, y); g.lineTo(x + (l * i) / cols, yb); }
  for (let j = 1; j < rows; j++) { const yy = y0 + ((yb - y0) * j) / rows; g.moveTo(x, yy); g.lineTo(x + l, yy); }
  if (o.arco) { g.moveTo(x, y0); g.lineTo(x + l, y0); }
  c.save(); c.clip(forma); c.strokeStyle = telaio; c.lineWidth = sp * 0.7; c.stroke(g); c.restore();
  ink(c, g, 0.8, 0.45);
  c.save(); c.strokeStyle = telaio; c.lineWidth = sp * 1.6; c.stroke(forma); c.restore();
  ink(c, forma, 1.3, 0.85);
  if (o.davanzale !== false) {
    const d = R(x - 0.08 * k, yb, l + 0.16 * k, 0.08 * k, 1);
    macchia(c, d, '#f4ece0'); ink(c, d, 1.1); ombraSotto(c, x - 0.08 * k, yb + 0.08 * k, l + 0.16 * k, 0.14 * k, 0.3);
  }
  if (o.fiori) fioriera(D, cx, yb, l * 1.02, o.fiori);
}
/** Cassetta di fiori sotto la finestra. */
function fioriera(D, cx, yb, l, colori) {
  const c = D.c, r = D.r, k = D.k, h = 0.2 * k, x = cx - l / 2, y = yb - h + 0.04 * k;
  for (let i = 0; i < l / 3; i++) foglia(c, x + r() * l, y + 3, -Math.PI / 2 + tra(r, -1.4, 1.4), tra(r, 0.08, 0.15) * k, 0.04 * k, scegli(r, VERDI), r() < 0.3 ? 0.5 : 0);
  fiorellini(c, x, y - 0.17 * k, l, 0.15 * k, colori, Math.round(l / (0.08 * k)), nuovoSeme(r), 0.024 * k);
  const f = R(x, y, l, h, 2); macchia(c, f, '#d9875f'); volume(c, f, x, y, l, h, 0.6); ink(c, rettMano(r, x, y, l, h, 0.4), 1.2);
}
/**
 * PORTA (cx centro, yb base, l e a in pixel).
 * o: { legno, arco, cornice, vetri: [colonne, righe], vetro, gradino }
 */
function porta(D, cx, yb, l, a, o = {}) {
  const c = D.c, r = D.r, k = D.k, x = cx - l / 2, y = yb - a, legno = o.legno ?? '#b39070', m = 0.12 * k;
  const forma = o.arco ? arco(x, y, l, a) : R(x, y, l, a, 2);
  if (o.cornice) {
    const cf = o.arco ? arco(x - m, y - m, l + 2 * m, a + m) : R(x - m, y - m, l + 2 * m, a + m, 2);
    macchia(c, cf, o.cornice, 0.96, 0.35, 2.5); volume(c, cf, x - m, y - m, l + 2 * m, a + m, 0.5); ink(c, cf, 1.4);
  }
  macchia(c, forma, scurisci(legno, 0.4), 1, 0);
  const yl = o.arco ? y + l / 2 + 0.05 * k : y + 0.04 * k, al = yb - yl;
  const anta = R(x + 0.04 * k, yl, l - 0.08 * k, al, 2);
  macchia(c, anta, legno, 0.97, 0.35, 2.5); volume(c, anta, x, yl, l, al, 0.6);
  const v = new Path2D();                                  // venature del legno
  for (let i = 0; i < 6; i++) { const vx = x + tra(r, 0.1, 0.9) * l; mano(r, [[vx, yl + tra(r, 0, al * 0.5)], [vx + tra(r, -3, 3), yl + tra(r, al * 0.5, al)]], false, 1.2, v); }
  ink(c, v, 0.7, 0.22);
  if (o.arco) {                                            // lunetta a raggiera
    const lf = new Path2D(), cy = y + l / 2, rr = l / 2 - 0.07 * k;
    lf.moveTo(cx - rr, cy); lf.arc(cx, cy, rr, Math.PI, 0); lf.closePath();
    c.save(); c.clip(lf);
    c.fillStyle = sfuma(c.createLinearGradient(cx - rr, cy - rr, cx + rr, cy), [0, '#e8f3e6'], [0.6, '#b9dcc4'], [1, '#9fcbb0']); c.fillRect(cx - rr, cy - rr, rr * 2, rr);
    c.restore();
    const rg = new Path2D();
    for (const ang of [Math.PI * 1.2, Math.PI * 1.5, Math.PI * 1.8]) { rg.moveTo(cx, cy); rg.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
    c.save(); c.strokeStyle = schiarisci(legno, 0.35); c.lineWidth = 0.05 * k; c.stroke(rg); c.lineWidth = 0.07 * k; c.stroke(lf); c.restore();
    ink(c, rg, 0.9, 0.6); ink(c, lf, 1.2);
  }
  if (o.vetri) {
    const [nc, nr] = o.vetri, gx = x + 0.17 * k, gl = l - 0.34 * k, gy = yl + 0.14 * k, ga = al * 0.44;
    const vf = R(gx, gy, gl, ga, 2);
    c.save(); c.clip(vf); c.fillStyle = sfuma(c.createLinearGradient(gx, gy, gx + gl, gy + ga), [0, '#e3eff6'], [1, o.vetro ?? '#a9c8e0']); c.fillRect(gx, gy, gl, ga);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fill(P([[gx + gl * 0.1, gy + ga], [gx + gl * 0.35, gy + ga], [gx + gl * 0.9, gy], [gx + gl * 0.65, gy]])); c.restore();
    const q = new Path2D();
    for (let i = 1; i < nc; i++) { q.moveTo(gx + (gl * i) / nc, gy); q.lineTo(gx + (gl * i) / nc, gy + ga); }
    for (let j = 1; j < nr; j++) { q.moveTo(gx, gy + (ga * j) / nr); q.lineTo(gx + gl, gy + (ga * j) / nr); }
    c.save(); c.strokeStyle = legno; c.lineWidth = 0.04 * k; c.stroke(q); c.restore(); ink(c, q, 0.8, 0.5); ink(c, vf, 1.2);
  }
  const py = yl + al * (o.vetri ? 0.66 : 0.12), ph = al * (o.vetri ? 0.26 : 0.36);    // pannelli
  for (const yy of o.vetri ? [py] : [py, py + al * 0.44]) {
    const pf = R(x + 0.17 * k, yy, l - 0.34 * k, ph, 2);
    tinta(c, pf, scurisci(legno, 0.12), 0.5); ink(c, pf, 1, 0.7); ombraSotto(c, x + 0.17 * k, yy, l - 0.34 * k, 0.05 * k, 0.3);
  }
  const mx = x + l - 0.17 * k, my = yl + al * 0.55;
  tinta(c, C(mx, my, 0.035 * k), '#d8b25a'); ink(c, C(mx, my, 0.035 * k), 1, 0.8);
  ink(c, anta, 1.3); ink(c, forma, 1.4);
  if (o.gradino !== false) { const g = R(x - 0.12 * k, yb - 0.09 * k, l + 0.24 * k, 0.12 * k, 2); macchia(c, g, '#ece3d6'); ink(c, g, 1.2); }
}
/** Lanterna di ferro con il vetro acceso (yb = base, l = larghezza). */
function lanterna(c, r, cx, yb, l, ferro = '#4f6470') {
  const h = l * 1.15, top = yb - h;
  bagliore(c, cx, yb - h * 0.5, l * 1.4, '#ffd98a', 0.35);
  const vetro = P([[cx - l * 0.36, yb - l * 0.08], [cx + l * 0.36, yb - l * 0.08], [cx + l * 0.5, top + l * 0.35], [cx - l * 0.5, top + l * 0.35]]);
  c.save(); c.clip(vetro);
  c.fillStyle = sfuma(c.createRadialGradient(cx, yb - h * 0.45, 0, cx, yb - h * 0.45, l * 0.6), [0, '#fffbe8'], [0.6, '#ffe7a6'], [1, '#f6c56e']);
  c.fillRect(cx - l, top, l * 2, h); c.restore();
  ink(c, vetro, 1.3);
  const tet = P([[cx - l * 0.62, top + l * 0.37], [cx + l * 0.62, top + l * 0.37], [cx + l * 0.12, top], [cx - l * 0.12, top]]);
  macchia(c, tet, ferro, 1, 0.3, 2); ink(c, tet, 1.2);
  const base = R(cx - l * 0.4, yb - l * 0.1, l * 0.8, l * 0.12, 2); macchia(c, base, ferro, 1, 0); ink(c, base, 1);
  tinta(c, C(cx, top - l * 0.07, l * 0.09), ferro); ink(c, C(cx, top - l * 0.07, l * 0.09), 1);
  const s = new Path2D(); s.moveTo(cx, yb - l * 0.08); s.lineTo(cx, top + l * 0.37);
  c.save(); c.strokeStyle = ferro; c.lineWidth = Math.max(1.5, l * 0.04); c.stroke(s); c.restore();
}

/* ============================= 7. PIANTE ================================ */

/** Foglia d'edera tonda a tre lobi. */
function fogliaEdera(c, r, x, y, d, ang, col, contorno) {
  const p = new Path2D();
  for (const da of [-1.05, 0, 1.05]) {
    const lx = x + Math.cos(ang + da) * d * 0.3, ly = y + Math.sin(ang + da) * d * 0.3, rr = d * (da ? 0.3 : 0.36);
    p.moveTo(lx + rr, ly); p.arc(lx, ly, rr, 0, Math.PI * 2);
  }
  macchia(c, p, col, 0.92, 0.45, d * 0.1);
  tinta(c, C(x + Math.cos(ang) * d * 0.2, y + Math.sin(ang) * d * 0.2, d * 0.17), schiarisci(col, 0.4), 0.45);
  if (contorno) ink(c, p, 0.8, 0.4);
}
/** Un tralcio d'edera che scende (ang ≈ π/2) o sale (ang ≈ -π/2) da (x, y). */
function edera(c, r, x, y, lung, o = {}) {
  const d = o.dim ?? 10, passo = d * 0.85, base = o.ang ?? Math.PI / 2, pts = [[x, y]];
  let a = base, px = x, py = y;
  for (let s = 0; s < lung; s += passo) {
    a += tra(r, -0.4, 0.4); a = base + Math.max(-0.55, Math.min(0.55, a - base));
    px += Math.cos(a) * passo; py += Math.sin(a) * passo; pts.push([px, py]);
  }
  linea(c, Forme.curva(pts), { colore: '#6d7f4c', spessore: Math.max(1, d * 0.12), alfa: 0.85 });
  for (let i = 1; i < pts.length; i++) {
    const [qx, qy] = pts[i - 1], [fx, fy] = pts[i], dir = Math.atan2(fy - qy, fx - qx), fine = 1 - 0.4 * i / pts.length;
    for (let n = 0; n < (r() < 0.35 ? 2 : 1); n++) {
      const la = dir + (i % 2 ? 1 : -1) * (n ? -1 : 1) * tra(r, 0.8, 1.7), dd = d * tra(r, 0.75, 1.1) * fine;
      fogliaEdera(c, r, fx + Math.cos(la) * dd * 0.5, fy + Math.sin(la) * dd * 0.5, dd, la, scegli(r, o.colori ?? EDERA), r() < 0.45);
    }
  }
}
/** Chioma o cespuglio: massa d'acquerello + tante foglioline (scure in basso, chiare in alto). */
function chioma(c, r, cx, cy, rx, ry, colori, o = {}) {
  const base = P(blob(r, cx, cy, rx, ry, 12, 0.14), true);
  macchia(c, base, colori[1], o.alfa ?? 0.92, 0.35, 3);
  const d = o.dim ?? Math.max(3, Math.min(rx, ry) * 0.17), n = o.quante ?? Math.round((rx * ry) / (d * d) * 0.9);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, q = Math.sqrt(r()) * 0.98, x = cx + Math.cos(a) * rx * q, y = cy + Math.sin(a) * ry * q;
    const h = (y - cy) / ry + ((x - cx) / rx) * 0.3, col = h > 0.35 ? colori[0] : h > -0.35 ? colori[1] : colori[2];
    c.globalAlpha = 0.78; c.fillStyle = mescola(col, scegli(r, colori), r() * 0.3);
    c.beginPath(); c.ellipse(x, y, d * tra(r, 0.7, 1.1), d * tra(r, 0.4, 0.6), r() * 3.14, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  if (o.ink !== 0) ink(c, nuvola(r, cx, cy, rx * 0.95, ry * 0.92, 10), 1.1, o.ink ?? 0.4);
}
/** Ciuffi d'erba lungo una linea (yb) tra x0 e x1. */
function ciuffi(c, r, x0, x1, yb, quanti, alti) {
  for (let i = 0; i < quanti; i++) {
    const x = tra(r, x0, x1), p = new Path2D();
    for (let f = 0; f < 4; f++) { const dx = tra(r, -0.5, 0.5) * alti; p.moveTo(x + f * 2, yb); p.quadraticCurveTo(x + f * 2 + dx * 0.2, yb - alti * 0.6, x + f * 2 + dx, yb - alti * tra(r, 0.6, 1)); }
    linea(c, p, { colore: scegli(r, ['#5f9a4a', '#7fbb5f', '#a6d27c']), spessore: 2, alfa: 0.85 }); ink(c, p, 0.7, 0.35);
  }
}

/* ============================== 8. IL PANE ============================== */

/** Pagnotta "a tre gobbe" (pan carré): corpo chiaro e cupole dorate. */
function pagnotta3(c, r, cx, yb, l) {
  const h = l * 0.4, rr = l / 6, cy = yb - h, x0 = cx - l / 2, p = new Path2D();
  p.moveTo(x0 + 2, yb); p.lineTo(x0, cy);
  for (let i = 0; i < 3; i++) p.arc(x0 + rr * (1 + 2 * i), cy, rr * 1.04, Math.PI, 0);
  p.lineTo(x0 + l - 2, yb); p.closePath();
  macchia(c, p, MOLLICA, 0.97, 0.3, 2);
  c.save(); c.clip(p);
  c.fillStyle = sfuma(c.createLinearGradient(0, cy - rr, 0, cy + h * 0.45), [0, '#d98f45'], [0.45, CROSTA], [1, 'rgba(240,200,140,0)']);
  c.fillRect(x0, cy - rr * 1.2, l, rr * 1.2 + h * 0.45); c.restore();
  for (let i = 0; i < 3; i++) tinta(c, E(x0 + rr * (1 + 2 * i) - rr * 0.3, cy - rr * 0.5, rr * 0.35, rr * 0.18, -0.3), '#fff6e0', 0.45);
  const s = new Path2D(); for (const f of [1 / 3, 2 / 3]) { s.moveTo(x0 + l * f, cy - 1); s.lineTo(x0 + l * f + tra(r, -1, 1), cy + h * 0.22); }
  ink(c, s, 1, 0.6); ink(c, p, 1.3);
}
/** Pagnotta tonda con i tagli bianchi a croce. */
function paneTondo(c, r, cx, yb, l) {
  const h = l * 0.55, p = new Path2D();
  p.ellipse(cx, yb - l * 0.08, l / 2, h, 0, Math.PI, 0);
  p.quadraticCurveTo(cx + l / 2, yb, cx + l * 0.38, yb); p.lineTo(cx - l * 0.38, yb); p.quadraticCurveTo(cx - l / 2, yb, cx - l / 2, yb - l * 0.08);
  macchia(c, p, '#ebb46a', 0.97, 0.4, 2.5); volumeTondo(c, p, cx, yb - h * 0.45, l / 2, h * 0.6);
  const t = new Path2D(), y = yb - h * 0.62;
  t.moveTo(cx - l * 0.24, y + l * 0.02); t.quadraticCurveTo(cx, y - l * 0.1, cx + l * 0.22, y + l * 0.04);
  t.moveTo(cx - l * 0.04, y - l * 0.14); t.quadraticCurveTo(cx + l * 0.04, y + l * 0.04, cx, y + l * 0.16);
  c.save(); c.lineCap = 'round'; c.strokeStyle = '#fbf0d8'; c.lineWidth = l * 0.07; c.stroke(t); c.restore();
  ink(c, t, 0.8, 0.5); ink(c, p, 1.3);
}
/** Ciambella (bagel): ritta (piatta = false) o appoggiata. */
function ciambella(c, cx, cy, rr, piatta, col = '#e19a52') {
  const sy = piatta ? 0.5 : 0.92, p = new Path2D();
  p.ellipse(cx, cy, rr, rr * sy, 0, 0, Math.PI * 2);
  p.moveTo(cx + rr * 0.34, cy); p.ellipse(cx, cy - (piatta ? rr * 0.06 : 0), rr * 0.34, rr * 0.34 * sy, 0, 0, Math.PI * 2, true);
  macchia(c, p, col, 0.97, 0.4, 2); volumeTondo(c, p, cx, cy, rr, rr * sy); ink(c, p, 1.1);
}
/** Baguette lunga con i tagli obliqui (x, y = punta sinistra; ang = inclinazione). */
function baguette(c, x, y, lung, ang, w = lung * 0.17) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const p = R(0, -w / 2, lung, w, w / 2);
  macchia(c, p, '#e8b26a', 0.97, 0.4, 2); volume(c, p, 0, -w / 2, lung, w, 0.7);
  const t = new Path2D();
  for (let i = 0; i < 5; i++) t.addPath(E(lung * (0.16 + i * 0.17), 0, lung * 0.08, w * 0.13, -0.45));
  tinta(c, t, '#fbf1da', 0.95); ink(c, t, 0.7, 0.45); ink(c, p, 1.2);
  c.restore();
}
/** Cesto di vimini con il bordo a corda e due manici. */
function cesto(c, r, cx, yb, l, h) {
  const p = P([[cx - l / 2, yb - h], [cx + l / 2, yb - h], [cx + l * 0.4, yb], [cx - l * 0.4, yb]], false);
  macchia(c, p, '#e5c47a', 0.97, 0.35, 2); volume(c, p, cx - l / 2, yb - h, l, h, 0.5);
  c.save(); c.clip(p); const t = new Path2D();
  for (let y = yb - h + 6; y < yb; y += h / 6) for (let x = cx - l / 2; x < cx + l / 2; x += l / 9) { t.moveTo(x, y); t.lineTo(x + l / 18, y + h / 7); }
  ink(c, t, 0.8, 0.4); c.restore();
  for (const s of [-1, 1]) ink(c, E(cx + s * l * 0.5, yb - h * 0.7, l * 0.06, h * 0.12), 1.1, 0.8);
  for (let x = cx - l / 2; x < cx + l / 2; x += l / 14) { const f = E(x + l / 28, yb - h, l / 22, h * 0.07, -0.6); tinta(c, f, '#f3dc9a'); ink(c, f, 0.8, 0.6); }
  ink(c, p, 1.2);
}
/** Cornetto: cinque spicchi lungo una mezzaluna. */
function cornetto(c, cx, cy, s) {
  for (const [i, f] of [[-2, 0.55], [2, 0.55], [-1, 0.8], [1, 0.8], [0, 1]]) {
    const a = i * 0.42 - Math.PI / 2, x = cx + Math.cos(a) * s * 0.42, y = cy + Math.sin(a) * s * 0.2 + s * 0.2;
    const p = E(x, y, s * 0.17 * f + s * 0.05, s * 0.2 * f + s * 0.04, a + Math.PI / 2);
    macchia(c, p, mescola('#e09a4e', '#f2c37a', f - 0.5), 0.97, 0.4, 1.5); ink(c, p, 0.9, 0.8);
  }
}
/** Dolcetti della vetrina del bancone: 0 bignè, 1 crostatina, 2 ciambella glassata, 3 tortina. */
function dolcetto(c, r, tipo, cx, yb, s) {
  if (tipo === 0) {
    const p = E(cx, yb - s * 0.3, s * 0.45, s * 0.32); macchia(c, p, '#eab06a'); volumeTondo(c, p, cx, yb - s * 0.3, s * 0.45, s * 0.32); ink(c, p, 1);
    const q = E(cx, yb - s * 0.5, s * 0.3, s * 0.14); tinta(c, q, '#fffaf0'); ink(c, q, 0.8, 0.6);
  } else if (tipo === 1) {
    const p = R(cx - s * 0.5, yb - s * 0.32, s, s * 0.32, s * 0.1); macchia(c, p, '#e8b070'); ink(c, p, 1);
    for (let i = 0; i < 4; i++) { const b = C(cx - s * 0.3 + i * s * 0.2, yb - s * 0.36, s * 0.1); tinta(c, b, scegli(r, ['#e0485a', '#c8344d', '#f07a6a'])); ink(c, b, 0.7, 0.6); }
  } else if (tipo === 2) {
    ciambella(c, cx, yb - s * 0.4, s * 0.42, false, '#e9a85e');
    tinta(c, P([[cx - s * 0.38, yb - s * 0.5], [cx + s * 0.38, yb - s * 0.5], [cx, yb - s * 0.82]], true), '#f6a8c2', 0.9);
  } else {
    const p = P([[cx - s * 0.38, yb - s * 0.4], [cx + s * 0.38, yb - s * 0.4], [cx + s * 0.28, yb], [cx - s * 0.28, yb]]); macchia(c, p, '#f4e8d8'); ink(c, p, 0.9);
    const q = E(cx, yb - s * 0.48, s * 0.42, s * 0.22); macchia(c, q, scegli(r, ['#f7b6c8', '#fde6a8', '#c7e5c0'])); ink(c, q, 0.9);
    tinta(c, C(cx, yb - s * 0.7, s * 0.08), '#e0485a');
  }
}

/* ======================= 9. SCENA 'PIAZZA' ============================== */

/** 1. La STACCIONATA d'ocra col buco, vista dalla piazza (piano x = -0.4, guarda verso +x). */
function staccionata(seme) {
  const A = 2.0, D = dipinto(4.5, A, 112, seme), { c, r, k } = D, Y = (y) => (A - y) * k;
  const U = (z) => (2.5 - z) * k;                          // a sinistra la z più vicina allo spettatore
  c.fillStyle = '#5a4030'; c.fillRect(0, Y(1.82), D.l, D.a); // il buio tra le assi
  for (let u = -0.04; u < 4.5;) {                          // le assi verticali
    const w = tra(r, 0.15, 0.2), x = u * k + 1, l = w * k - 2, top = Y(tra(r, 1.86, 1.99)), col = misto(r, ['#e2ad5a', '#d99c4c', '#e8b866', '#dba453', '#e6b25e']);
    const f = P([[x, D.a + 2], [x, top + l * 0.35], [x + l * 0.5, top], [x + l, top + l * 0.35], [x + l, D.a + 2]], false);
    macchia(c, f, col, 0.98, 0.35, 2.5);
    c.save(); c.clip(f);
    c.fillStyle = sfuma(c.createLinearGradient(x, 0, x + l, 0), [0, 'rgba(255,245,210,0.35)'], [0.5, 'rgba(255,245,210,0)'], [1, conAlfa(OMBRA, 0.2)]); c.fillRect(x, top, l, D.a);
    const v = new Path2D();
    for (let i = 0; i < 4; i++) { const vx = x + tra(r, 0.15, 0.85) * l; mano(r, [[vx, top + tra(r, 5, 40)], [vx + tra(r, -2, 2), tra(r, Y(1), D.a)]], false, 1.1, v); }
    linea(c, v, { colore: scurisci(col, 0.3), spessore: 1, alfa: 0.4 });
    if (r() < 0.4) { const n = E(x + l * tra(r, 0.3, 0.7), Y(tra(r, 0.5, 1.6)), l * 0.14, l * 0.22); tinta(c, n, scurisci(col, 0.35), 0.6); ink(c, n, 0.8, 0.5); }
    c.restore();
    ink(c, f, 1.2, 0.85); u += w;
  }
  for (const [y0, y1] of [[0.28, 0.42], [1.42, 1.56]]) {   // le traverse (da questo lato si vedono)
    const f = R(-4, Y(y1), D.l + 8, (y1 - y0) * k, 2);
    ombraSotto(c, 0, Y(y0), D.l, 0.1 * k, 0.35); macchia(c, f, '#c98f45', 0.97, 0.35, 2); volume(c, f, 0, Y(y1), D.l, (y1 - y0) * k, 0.5);
    ink(c, rettMano(r, -4, Y(y1), D.l + 8, (y1 - y0) * k, 0.6), 1.3);
    for (let x = 0.1 * k; x < D.l; x += tra(r, 0.4, 0.8) * k) tinta(c, C(x, Y((y0 + y1) / 2), 2), '#5a4a40', 0.8);
  }
  const pts = [[U(0.4), D.a + 2]];                         // il BUCO: legno rotto, luce dorata dall'altra parte
  for (let i = 0; i <= 16; i++) {
    const f = i / 16, dente = i % 2 ? tra(r, 4, 12) : tra(r, -5, 0);
    pts.push([U(0.4) + 0.8 * k * f + tra(r, -2, 2), Y(0.82 * Math.pow(Math.sin(Math.PI * (0.04 + f * 0.92)), 0.55)) + dente]);
  }
  pts.push([U(-0.4), D.a + 2]);
  const buco = P(pts);
  bagliore(c, U(0), Y(0.35), 0.9 * k, '#ffd77a', 0.35, 0.9);
  c.save(); c.clip(buco);
  c.fillStyle = sfuma(c.createRadialGradient(U(0), Y(0.2), 0, U(0), Y(0.2), 0.6 * k), [0, '#fffbe8'], [0.5, '#ffe9a8'], [1, '#f4c264']);
  c.fillRect(U(0.5), Y(1), k, k); c.restore();
  linea(c, buco, { colore: '#f7dc9a', spessore: 4, alfa: 0.7 }); ink(c, buco, 1.5);
  const sch = new Path2D(); for (let i = 2; i < pts.length - 2; i += 2) mano(r, [pts[i], [pts[i][0] + tra(r, -4, 4), pts[i][1] - tra(r, 6, 14)]], false, 0.3, sch);
  ink(c, sch, 0.9, 0.6);
  ciuffi(c, r, 0, D.l, D.a + 2, 26, 0.2 * k);
  for (const u of [0.5, 1.6, 3.4, 4.1]) edera(c, r, u * k, -4, tra(r, 0.4, 1.0) * k, { dim: 0.13 * k });
  finitura(D, { sinistra: [0.3, 0.35, 0.5], alto: [0.3, 0.3, 0] });
  return affetta(D, { nome: 'staccionata', normale: 'x+', x: -0.4, y: 0, z: -2 });
}

/** 2. Il PAVIMENTO di mattoni rosa-arancio della piazza (x -3..34, z -2..6). */
function pavimentoPiazza(seme) {
  const D = dipinto(37, 8, 72, seme), { c, r, k } = D, X = (x) => (x + 3) * k, Z = (z) => (z + 2) * k;
  posa(D, 0, 0, D.l, D.a, { alto: 0.2 * k, lungo: 0.42 * k, colori: PAVE, malta: '#fbe6d2', inch: 0.3, luce: 0.2, tondi: 0.14, sp: 1, sfasa: 0.2, varia: 0.22 });
  velatura(c, 0, 0, D.l, Z(-0.9), [conAlfa(OMBRA, 0.38), conAlfa(OMBRA, 0.12), conAlfa(OMBRA, 0)]);  // ombra ai piedi delle case
  bagliore(c, X(12.5), Z(-1.3), 3.6 * k, '#ffd98a', 0.25, 0.35);    // la luce calda della vetrina
  bagliore(c, X(0.2), Z(0), 1.2 * k, '#ffe08a', 0.3, 0.6);           // la luce dorata dal buco nella staccionata
  for (let i = 0; i < 300; i++) {                                    // muschio verso il vicolo e ai piedi dei muri
    const vic = i < 200, x = vic ? tra(r, 26.6, 29.4) : tra(r, -3, 34), z = vic ? -2 + Math.pow(r(), 3) * 1.2 : tra(r, -2, -1.75);
    c.globalAlpha = tra(r, 0.3, 0.6); c.fillStyle = misto(r, ['#8fa676', '#7d9866', '#b5c49a', '#a3b585']);
    c.beginPath(); c.ellipse(X(x), Z(z), tra(r, 2, 6), tra(r, 1.5, 3), r() * 3, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 40; i++) {                                     // foglie cadute
    const x = scegli(r, [tra(r, 16.5, 20.5), tra(r, 26.5, 29.5), tra(r, -0.5, 2)]), z = tra(r, -1.9, 0.6);
    foglia(c, X(x), Z(z), r() * 6.3, tra(r, 0.08, 0.14) * k, 0.04 * k, scegli(r, ['#d9a05a', '#c8844e', '#9fbf6a', '#e2b86a']), 0.5);
  }
  for (const [x, z, rx, ry] of [[3, 4.2, 0.35, 0.12], [21.1, 3.85, 1.25, 0.3]]) velo(c, X(x), Z(z), rx * k, OMBRA, 0.35, ry / rx);
  ciuffi(c, r, X(-0.6), X(-0.3), Z(2.4), 6, 0.15 * k); ciuffi(c, r, X(-0.5), X(-0.3), Z(-1.6), 5, 0.15 * k);
  finitura(D, { basso: [2.4, 0.8, 0.4], sinistra: [1.4, 0.7, 0.45], destra: [1.8, 0.7, 0.45] });
  return affetta(D, { nome: 'pavimento', normale: 'su', x: -3, y: 0, z: -2 });
}

/** 3. La fila di FACCIATE (piano z = -2): casa rosa, panetteria, cancello, casa gialla, casa verde acqua. */
function facciate(seme) {
  const A = 9.2, D = dipinto(37, A, 96, seme), { c, r, k } = D, X = (x) => (x + 3) * k, Y = (y) => (A - y) * k, M = (m) => m * k;
  // --- la casa rosa (-3..5)
  lavaggio(D, null, X(-3), Y(6.8), M(8), M(6.8), '#f3b6a8', { variazione: 0.26 });
  zoccolo(D, X(-3), X(5), 0.45, '#d99a94');
  cornicione(D, X(-3), X(5), Y(3.4), M(0.16), '#f8dcd2');
  const verdi = { persiane: '#86b496', telaio: '#f6f1e6', vetro: '#bcd9e6' };
  finestra(D, X(-1.7), Y(1.0), M(0.95), M(1.4), { ...verdi, tenda: true });
  finestra(D, X(1.5), Y(1.0), M(1.05), M(1.45), { ...verdi, fiori: ['#e84a5f', '#ff8fa3', '#fff3f0'] });
  porta(D, X(3.95), Y(0), M(1.0), M(2.15), { legno: '#7fae94', vetri: [2, 2], cornice: '#f8d9cf' });
  for (const x of [-1.6, 1.4, 3.9]) finestra(D, X(x), Y(4.05), M(0.95), M(1.45), { ...verdi, tenda: x > 0, fiori: x === 1.4 ? ['#f25c54', '#ffd166', '#fff'] : null });
  // --- la PANETTERIA (5..17): mattoni rosa-arancio, cornicione, porta ad arco, vetrina
  posa(D, X(5), Y(7.05), X(17), Y(0), { alto: M(0.21), lungo: M(0.48), colori: MATTONI, malta: '#fbe3d4', inch: 0.5, luce: 0.35, sfasa: 0.3, varia: 0.22, tondi: 0.16 });
  for (let i = 0; i < 14; i++) velo(c, X(tra(r, 5, 17)), Y(tra(r, 0.5, 7)), M(tra(r, 0.8, 2)), scegli(r, [CARTA, CARTA, '#f6a98a']), 0.3);
  cornicione(D, X(5), X(17), Y(3.4), M(0.2), '#f8e6d4');
  const arcate = { arco: true, telaio: '#fbf3e6', vetro: '#c9e0ea', cornice: '#f8e6d4', tenda: true, fiori: ['#e84a5f', '#ff8fa3', '#fff3f0'] };
  for (const x of [7.5, 11.0, 14.5]) finestra(D, X(x), Y(4.1), M(1.1), M(1.75), arcate);
  porta(D, X(7.5), Y(0.06), M(1.1), M(2.3), { arco: true, legno: '#b8977a', vetri: [2, 3], cornice: '#f2b39b', vetro: '#a9c8e6' });
  ink(c, mano(r, [[X(8.62), Y(2.2)], [X(8.82), Y(2.2)], [X(8.82), Y(2.35)]], false, 0.3), 2, 0.9);   // braccio della lanterna
  lanterna(c, r, X(8.82), Y(2.05), M(0.22));
  const vx0 = X(9.38), vy0 = Y(2.72), vf = R(vx0, vy0, M(6.24), M(2.24), M(0.5));                    // cornice della vetrina
  tinta(c, R(vx0 + 5, vy0 + 6, M(6.24), M(2.24), M(0.5)), OMBRA, 0.25);
  macchia(c, vf, '#f4b79c', 0.98, 0.4, 3); volume(c, vf, vx0, vy0, M(6.24), M(2.24), 0.5); ink(c, vf, 1.5);
  const davanzale = R(X(9.25), Y(0.6), M(6.5), M(0.12), 2);
  macchia(c, davanzale, '#f8dccb'); ink(c, davanzale, 1.2); ombraSotto(c, X(9.25), Y(0.48), M(6.5), M(0.2), 0.3);
  // --- il CANCELLO del giardino (17..19.5): pilastri, muretto, sbarre (tra le sbarre è vuoto)
  for (const x of [17, 19.18]) {
    posa(D, X(x), Y(2.6), X(x + 0.32), Y(0), { alto: M(0.2), lungo: M(0.32), colori: MATTONI, malta: '#f8d3c0', inch: 0.5, sfalsa: 0.4 });
    const cap = R(X(x - 0.05), Y(2.75), M(0.42), M(0.16), 2); macchia(c, cap, '#f3e3d0'); ink(c, cap, 1.2);
    tinta(c, C(X(x + 0.16), Y(2.86), M(0.1)), '#f3e3d0'); ink(c, C(X(x + 0.16), Y(2.86), M(0.1)), 1.1);
    ink(c, rettMano(r, X(x), Y(2.6), M(0.32), M(2.6), 0.5), 1.2);
  }
  posa(D, X(17.32), Y(0.56), X(19.18), Y(0), { alto: M(0.14), lungo: M(0.3), colori: ['#d98a62', '#cf7c55', '#e39a70', '#c9744f'], malta: '#efc7ad', inch: 0.6 });
  const cop = R(X(17.3), Y(0.66), M(1.9), M(0.12), 2); macchia(c, cop, '#ead9c6'); ink(c, cop, 1.2);
  const sbarre = new Path2D(), ferro = '#8fa3ba';
  for (let x = 17.46; x < 19.1; x += 0.155) {
    sbarre.moveTo(X(x), Y(0.66)); sbarre.lineTo(X(x), Y(2.28));
    sbarre.moveTo(X(x) - M(0.04), Y(2.26)); sbarre.lineTo(X(x), Y(2.4)); sbarre.lineTo(X(x) + M(0.04), Y(2.26)); sbarre.closePath();
    if (x < 19) { sbarre.moveTo(X(x), Y(1.95)); sbarre.arc(X(x + 0.0775), Y(1.95), M(0.0775), Math.PI, 0); }
  }
  for (const y of [0.8, 1.95, 2.05]) { sbarre.moveTo(X(17.32), Y(y)); sbarre.lineTo(X(19.18), Y(y)); }
  c.save(); c.lineCap = 'round'; c.strokeStyle = ferro; c.lineWidth = M(0.035); c.stroke(sbarre);
  c.strokeStyle = 'rgba(230,240,250,0.6)'; c.lineWidth = M(0.01); c.translate(-M(0.008), 0); c.stroke(sbarre); c.restore();
  ink(c, sbarre, 0.8, 0.5);
  edera(c, r, X(17.16), Y(0.2), M(2.2), { dim: M(0.11), ang: -Math.PI / 2 });
  // --- la casa GIALLA (19.5..26.8): zoccolo di sassi tondi e finestra blu a tanti vetri
  lavaggio(D, null, X(19.5), Y(6.3), M(7.3), M(6.3), '#f8dc8c', { variazione: 0.24 });
  sassi(D, X(19.5), Y(0.95), X(26.8), Y(0), 2);
  ink(c, mano(r, [[X(19.5), Y(0.95)], [X(26.8), Y(0.95)]], false, 0.5), 1.4);
  const blu = { telaio: '#78acd6', vetro: '#d3e9f4' };
  finestra(D, X(21.9), Y(1.08), M(2.6), M(1.8), { ...blu, colonne: 4, righe: 3, davanzale: false });
  porta(D, X(25.0), Y(0), M(1.05), M(2.25), { legno: '#86b2da', vetri: [2, 2], cornice: '#fbecc0', vetro: '#d3e9f4' });
  for (const x of [21.2, 24.9]) finestra(D, X(x), Y(4.0), M(1.05), M(1.5), { ...blu, persiane: '#86b4dc', telaio: '#f6f1e6', fiori: x < 22 ? ['#ffffff', '#f6c6d4', '#fff1a8'] : null });
  cantonale(D, X(26.8), Y(6.3), Y(0.95), -1, '#fbe6a6');
  pluviale(D, X(19.7), Y(6.2), Y(0.95));
  // --- la casa VERDE ACQUA (29.2..34)
  lavaggio(D, null, X(29.2), Y(6.6), M(4.8), M(6.6), '#a6d8d0', { variazione: 0.24 });
  zoccolo(D, X(29.2), X(34), 0.45, '#86bcb6');
  cantonale(D, X(29.2), Y(6.6), Y(0.45), 1, '#bfe3dc');
  const gialle = { persiane: '#f2cf7a', telaio: '#fbf6ec', vetro: '#c9e3ee' };
  finestra(D, X(30.7), Y(1.0), M(0.95), M(1.45), { ...gialle, tenda: true });
  porta(D, X(32.8), Y(0), M(1.0), M(2.2), { legno: '#d07c62', vetri: [2, 2], cornice: '#eef3ea' });
  for (const x of [30.7, 32.8]) finestra(D, X(x), Y(4.0), M(0.95), M(1.45), { ...gialle, fiori: ['#e84a5f', '#ff8fa3', '#fff3f0'] });
  // --- cornicioni, tetti e comignoli (la linea dei tetti è irregolare)
  cornicione(D, X(5), X(17), Y(7.45), M(0.4), '#f8e6d4');
  cornicione(D, X(19.5), X(26.8), Y(6.5), M(0.22), '#fbecc0');
  camino(D, X(-1.4), Y(7.3), M(0.5), M(1.2), '#e9a99e'); camino(D, X(3.5), Y(7.2), M(0.42), M(0.9), '#e9a99e');
  camino(D, X(6.1), Y(8.0), M(0.45), M(0.85), '#ef9c80'); camino(D, X(15.2), Y(8.0), M(0.55), M(1.05), '#ef9c80');
  camino(D, X(25.4), Y(6.9), M(0.45), M(0.9), '#f2d48a'); camino(D, X(33.1), Y(7.2), M(0.45), M(0.95), '#8cc6be');
  tetto(D, X(-3), X(5), Y(6.8), Y(7.7));
  tetto(D, X(5), X(17), Y(7.45), Y(8.35));
  tetto(D, X(19.5), X(26.8), Y(6.5), Y(7.25));
  tetto(D, X(29.2), X(34), Y(6.6), Y(7.45));
  // --- i vuoti: la vetrina (si vede l'interno, dipinto su un altro strato) e l'imbocco del vicolo
  buca(c, R(X(9.5), Y(2.6), M(6), M(2.0), M(0.4))); c.clearRect(X(26.8), 0, M(2.4), D.a);
  ink(c, R(X(9.5), Y(2.6), M(6), M(2.0), M(0.4)), 1.4);
  // --- luce, ombre e carta
  c.save(); c.globalCompositeOperation = 'source-atop';
  velatura(c, 0, Y(0.6), D.l, M(0.6), [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.3)]);               // contatto col selciato
  velatura(c, 0, 0, D.l, Y(4), ['rgba(255,251,240,0.4)', 'rgba(255,251,240,0)']);             // luce dall'alto
  for (const x of [26.8, 29.2]) velatura(c, X(x) - M(0.5), 0, M(1), D.a, x < 27 ? [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.22)] : [conAlfa(OMBRA, 0.22), conAlfa(OMBRA, 0)], 1, 'orizzontale');
  c.restore();
  finitura(D, { sinistra: [1.6, 0.8, 0.5], destra: [2.0, 0.8, 0.5], alto: [1.4, 0.6, 0] });
  return affetta(D, { nome: 'facciate', normale: 'z+', x: -3, y: 0, z: -2 });
}

/** 3b. L'interno della vetrina, appena dietro il vetro (z = -2.35): pane sugli scaffali verdini. */
function vetrinaInterno(seme) {
  const D = dipinto(6.6, 2.5, 128, seme), { c, r, k } = D, X = (x) => (x - 9.2) * k, Y = (y) => (2.85 - y) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#f5e2b8', { variazione: 0.18, colature: 0 });
  velatura(c, 0, 0, D.l, D.a, ['rgba(255,244,214,0.5)', 'rgba(240,200,140,0)', 'rgba(214,160,110,0.35)']);
  c.save(); c.globalAlpha = 0.28;                                   // il negozio in fondo, velato dal vetro
  for (const y of [1.0, 1.5, 2.0]) { tinta(c, R(X(9.4), Y(y), M(1.4), M(0.04)), '#c9a27a'); for (let i = 0; i < 3; i++) pagnotta3(c, r, X(9.7 + i * 0.42), Y(y), M(0.34)); }
  for (const x of [12.6, 14.9]) { linea(c, mano(r, [[X(x), 0], [X(x), Y(2.5)]], false), { colore: '#8a6a50', spessore: 1 }); tinta(c, E(X(x), Y(2.48), M(0.18), M(0.1)), '#ef8e6e'); }
  chioma(c, r, X(15.15), Y(1.75), M(0.22), M(0.18), ['#f08a8a', '#f6a8a8', '#fbd0c8'], { ink: 0 }); tinta(c, R(X(15.07), Y(1.6), M(0.16), M(0.2), 4), '#cfe0e6');
  c.restore();
  const verde = '#cfe2b2', sx0 = X(11.0), sx1 = X(15.45);           // lo scaffale verdino
  for (const x of [11.0, 15.38]) { const f = R(X(x), Y(2.1), M(0.07), M(1.5)); macchia(c, f, verde); ink(c, f, 1.1); }
  for (const y of [2.0, 1.36, 0.74]) {
    const f = R(sx0 - 4, Y(y), sx1 - sx0 + 8, M(0.06), 2); ombraSotto(c, sx0, Y(y) + M(0.06), sx1 - sx0, M(0.12), 0.25);
    macchia(c, f, verde, 0.98, 0.3, 2); ink(c, f, 1.2);
  }
  for (let i = 0; i < 3; i++) pagnotta3(c, r, X(11.85 + i * 1.33), Y(2.0), M(0.74));
  for (let g = 0; g < 3; g++) {                                     // ciambelle a gruppetti su carta bianca
    const gx = 11.65 + g * 1.33; tinta(c, R(X(gx - 0.45), Y(1.38), M(0.95), M(0.03)), '#fffdf6');
    ciambella(c, X(gx - 0.27), Y(1.47), M(0.14), true); ciambella(c, X(gx + 0.25), Y(1.47), M(0.14), true); ciambella(c, X(gx - 0.02), Y(1.55), M(0.15), false); ciambella(c, X(gx + 0.3), Y(1.6), M(0.13), false);
  }
  for (let i = 0; i < 3; i++) { tinta(c, R(X(11.45 + i * 1.33), Y(0.76), M(1.05), M(0.03)), '#fffdf6'); paneTondo(c, r, X(11.95 + i * 1.33), Y(0.77), M(0.56)); }
  for (const [x, a] of [[9.85, -1.25], [10.0, -1.45], [10.15, -1.7]]) baguette(c, X(x), Y(0.95), M(1.0), a);
  cesto(c, r, X(10.25), Y(0.6), M(0.85), M(0.42));
  for (const x of [9.9, 11.1]) linea(c, mano(r, [[X(x), 0], [X(x + 0.06), Y(2.52)]], false, 0.3), { colore: '#7d6a5a', spessore: 1.5 });   // l'insegna appesa
  const ins = E(X(10.55), Y(2.33), M(0.72), M(0.2));
  c.save(); c.translate(3, 4); tinta(c, ins, OMBRA, 0.2); c.restore();
  macchia(c, ins, '#f4ead8', 0.98, 0.3, 2); c.save(); c.lineWidth = M(0.035); c.strokeStyle = '#a48a74'; c.stroke(ins); c.restore(); ink(c, ins, 1.3);
  c.save(); c.font = 'bold ' + Math.round(M(0.2)) + 'px Georgia, "DejaVu Serif", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#a07a5a'; c.fillText('PANE', X(10.55), Y(2.3)); c.lineWidth = 0.9; c.strokeStyle = INK; c.strokeText('PANE', X(10.55), Y(2.3)); c.restore();
  const spiga = new Path2D(); spiga.moveTo(X(10.3), Y(2.47)); spiga.lineTo(X(10.8), Y(2.47)); ink(c, spiga, 1, 0.7);
  for (let i = 0; i < 4; i++) tinta(c, E(X(10.6 + i * 0.05), Y(2.47), M(0.025), M(0.012), 0.5), '#c99a5a');
  bagliore(c, X(12.5), Y(1.9), M(3), '#ffe2a0', 0.12, 0.5);         // la luce calda del negozio
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,0.16)';  // riflessi sul vetro
  for (const [x, w] of [[9.35, 0.35], [9.9, 0.1], [14.2, 0.4], [14.75, 0.1]]) c.fill(P([[X(x), D.a], [X(x + w), D.a], [X(x + w + 1.2), 0], [X(x + 1.2), 0]]));
  c.restore();
  finitura(D, null, 0.7);
  return affetta(D, { nome: 'vetrina_interno', normale: 'z+', x: 9.2, y: 0.35, z: -2.35, luce: 0.35, ordine: -1 });
}

/** 3c. Il GIARDINO dietro il cancello (z = -4): siepi, alberi, fiori. */
function giardino(seme) {
  const D = dipinto(8, 6, 64, seme), { c, r, k } = D, X = (x) => (x - 14.5) * k, Y = (y) => (6 - y) * k, M = (m) => m * k;
  const siepe = [[0, D.a]]; for (let x = 0; x <= 8; x += 0.4) siepe.push([M(x), Y(2.3 + Math.sin(x * 2.1) * 0.25 + r() * 0.2)]); siepe.push([D.l, D.a]);
  lavaggio(D, P(siepe, true), 0, 0, D.l, D.a, '#93c27e', { variazione: 0.3, colature: 0 });
  const tronco = P([[X(18.15), Y(0)], [X(18.45), Y(0)], [X(18.4), Y(3.2)], [X(18.2), Y(3.2)]]);
  macchia(c, tronco, '#9a7a5e'); ink(c, tronco, 1.2);
  chioma(c, r, X(18.3), Y(4.35), M(1.55), M(1.35), ['#5d9a58', '#7fb86a', '#b5da8e'], { dim: M(0.16) });
  for (const [x, y, rr] of [[15.7, 2.9, 1.0], [21.2, 3.0, 1.05]]) chioma(c, r, X(x), Y(y), M(rr), M(rr * 0.85), ['#4f8f55', '#72ad62', '#a7d384'], { dim: M(0.14) });
  for (let x = 14.3; x < 22.7; x += 0.9) chioma(c, r, X(x + tra(r, -0.2, 0.2)), Y(0.75), M(tra(r, 0.5, 0.7)), M(0.55), VERDI, { dim: M(0.11), ink: 0.3 });
  fiorellini(c, 0, Y(1.3), D.l, M(0.9), ['#ffffff', '#f6c6d4', '#fff1a8', '#f49ab0'], 40, nuovoSeme(r), M(0.04));
  const sentiero = P([[X(17.9), D.a], [X(18.7), D.a], [X(18.55), Y(0.6)], [X(18.1), Y(0.6)]]); macchia(c, sentiero, '#ecdcbc', 0.9, 0.2);
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(244,250,236,0.25)'; c.fillRect(0, 0, D.l, D.a); c.restore();
  finitura(D, { alto: [1.6, 0.7, 0.4], sinistra: [1.2, 0.5, 0.4], destra: [1.2, 0.5, 0.4] });
  return affetta(D, { nome: 'giardino', normale: 'z+', x: 14.5, y: 0, z: -4, tremola: 0.35, ordine: -1 });
}

/** 4a. I MURI DEL VICOLO: intonaco rosa, edera, cordolo di mattoni, pluviale, finestrella. */
function muroVicolo(seme, destro) {
  const L = 15, A = 4.5, D = dipinto(L, A, 80, seme), { c, r, k } = D, Y = (y) => (A - y) * k, M = (m) => m * k;
  const U = (z) => (destro ? z + 17 : -2 - z) * k;           // muro sinistro: a sinistra l'imbocco; destro: a sinistra il fondo
  lavaggio(D, null, 0, 0, D.l, D.a, destro ? '#e9a3a6' : '#f0a69c', { variazione: 0.32, fioriture: 50 });
  velatura(c, 0, 0, D.l, D.a, destro ? ['rgba(255,250,235,0.5)', 'rgba(255,250,235,0)', conAlfa(OMBRA, 0.15)] : [conAlfa(OMBRA, 0.1), 'rgba(255,250,235,0)', 'rgba(255,250,235,0.5)'], 1, 'orizzontale');
  if (destro) velatura(c, 0, Y(2), D.l, M(2), [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.18)]);
  for (let i = 0; i < 14; i++) velo(c, r() * D.l, Y(tra(r, 1, 4.5)), M(tra(r, 0.6, 1.6)), i % 3 ? '#d97a78' : CARTA, 0.22, tra(r, 0.6, 1.2));
  const cima = R(-4, Y(4.5), D.l + 8, M(0.16)); macchia(c, cima, '#f6c7bb', 0.95, 0.25); ink(c, mano(r, [[0, Y(4.34)], [D.l, Y(4.34)]], false), 1.2); ombraSotto(c, 0, Y(4.34), D.l, M(0.2), 0.25);
  posa(D, 0, Y(0.3), D.l, D.a, { alto: M(0.3), lungo: M(0.44), colori: ['#8a5a4a', '#9b6a55', '#7d5243', '#a37462'], malta: '#5e4036', tondi: 0.2, luce: 0.6, inch: 0.7, sfalsa: 0 });
  ombraSotto(c, 0, Y(0.3) - M(0.04), D.l, -M(0.15), 0.2);
  pluviale(D, U(destro ? -13 : -8.5), Y(4.4), Y(0.3));
  finestra(D, U(destro ? -8 : -12), Y(2.3), M(0.7), M(0.85), { persiane: destro ? '#8fb7a0' : '#9ab0d0', telaio: '#f4efe6', vetro: '#c7dbe4', colonne: 2, righe: 2, fiori: destro ? ['#e84a5f', '#ffffff'] : null });
  if (!destro) {                                              // il bidone di latta del gattino
    const bx = U(-4), f = R(bx - M(0.28), Y(0.85), M(0.56), M(0.85), 3);
    macchia(c, f, '#c8ced6', 0.98, 0.35, 2); volume(c, f, bx - M(0.28), Y(0.85), M(0.56), M(0.85), 0.8);
    const q = new Path2D(); for (const t of [0.25, 0.5, 0.75]) { q.moveTo(bx - M(0.28) + M(0.56) * t, Y(0.78)); q.lineTo(bx - M(0.28) + M(0.56) * t, Y(0.05)); }
    ink(c, q, 1, 0.5); ink(c, f, 1.3);
    const cop = R(bx - M(0.32), Y(0.92), M(0.64), M(0.1), 3); macchia(c, cop, '#d9dee4'); ink(c, cop, 1.2);
    ink(c, E(bx, Y(0.97), M(0.08), M(0.04)), 1.2);
  }
  const gruppi = destro ? [-3.5, -6.0, -10.5, -14.5] : [-3.0, -5.6, -9.6, -13.6, -15.8];
  for (const z of gruppi) {
    for (let v = 0; v < 5; v++) edera(c, r, U(z) + M(tra(r, -0.45, 0.45)), Y(4.38), M(tra(r, 1.6, 3.9)), { dim: M(0.2) });
    for (let v = 0; v < 2; v++) edera(c, r, U(z) + M(tra(r, -0.6, 0.6)), Y(0.32), M(tra(r, 0.6, 1.8)), { dim: M(0.18), ang: -Math.PI / 2 });
  }
  finitura(D, destro ? { alto: [0.9, 0.7, 0.5], sinistra: [3.5, 0.65, 0] } : { alto: [0.9, 0.7, 0.5], destra: [3.5, 0.65, 0] });
  return affetta(D, destro ? { nome: 'vicolo_muro_destro', normale: 'x-', x: 29.2, y: 0, z: -17 } : { nome: 'vicolo_muro_sinistro', normale: 'x+', x: 26.8, y: 0, z: -17 });
}

/** 4b. Il PAVIMENTO DEL VICOLO: lastre muschiose con foglie cadute (in alto il fondo, z = -17). */
function pavimentoVicolo(seme) {
  const D = dipinto(2.4, 15, 80, seme), { c, r, k } = D, Z = (z) => (z + 17) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#b2bd9a', { variazione: 0.3, colature: 0, luce: false, fioriture: 25 });
  const lastre = new Path2D();
  for (let z = -17; z < -2; z += tra(r, 0.45, 0.65)) {
    lastre.addPath(mano(r, [[0, Z(z)], [D.l, Z(z)]], false, 1.2));
    for (let x = tra(r, 0.3, 0.9); x < 2.4; x += tra(r, 0.6, 1.0)) mano(r, [[M(x), Z(z)], [M(x + tra(r, -0.05, 0.05)), Z(z + 0.5)]], false, 1, lastre);
  }
  ink(c, lastre, 1, 0.3);
  for (let i = 0; i < 2300; i++) {                                  // muschio e foglioline
    const x = r() * D.l, y = r() * D.a, bordo = Math.min(x, D.l - x) / D.l;
    c.globalAlpha = tra(r, 0.35, 0.8) * (bordo < 0.15 ? 1 : 0.75);
    c.fillStyle = misto(r, ['#8fa676', '#7d9866', '#b5c49a', '#9db07f', '#c2c79a']);
    c.beginPath(); c.ellipse(x, y, tra(r, 2, 6), tra(r, 1.2, 3), r() * 3, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 70; i++) foglia(c, r() * D.l, r() * D.a, r() * 6.3, tra(r, 0.07, 0.12) * k, 0.035 * k, scegli(r, ['#d39a5a', '#c8844e', '#e2b86a', '#6fb07a']), 0.45);
  for (const s of [0, 1]) velatura(c, s ? D.l - M(0.45) : 0, 0, M(0.45), D.a, s ? [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.32)] : [conAlfa(OMBRA, 0.32), conAlfa(OMBRA, 0)], 1, 'orizzontale');
  velatura(c, 0, Z(-6), D.l, Z(-2) - Z(-6), ['rgba(246,180,140,0)', 'rgba(246,180,140,0.45)']);   // si mescola col selciato della piazza
  velatura(c, 0, 0, D.l, M(5), ['rgba(255,252,240,0.75)', 'rgba(255,252,240,0)']);                // la luce in fondo al vicolo
  finitura(D, null);
  return affetta(D, { nome: 'vicolo_pavimento', normale: 'su', x: 26.8, y: 0, z: -17 });
}

/** 4c. Il FONDO DEL VICOLO: uno spiraglio luminoso sul canale, una barchetta, case pastello. */
function fondoVicolo(seme) {
  const D = dipinto(2.4, 4.5, 96, seme), { c, r, k } = D, X = (x) => (x - 26.8) * k, Y = (y) => (4.5 - y) * k, M = (m) => m * k;
  velatura(c, 0, 0, D.l, Y(0.9), ['#fffdf6', '#f6f7ef', '#e2f0f3']);
  const case_ = [[26.7, 0.55, 2.7, '#f6c6c0'], [27.25, 0.7, 2.35, '#fbe3a6'], [27.95, 0.6, 2.95, '#cfe3f0'], [28.55, 0.75, 2.5, '#d9cdea']];
  for (const [x, l, h, col] of case_) {
    const f = R(X(x), Y(h), M(l), M(h - 0.9)); macchia(c, f, col, 0.85, 0.2, 2);
    const t = P([[X(x - 0.04), Y(h)], [X(x + l + 0.04), Y(h)], [X(x + l - 0.1), Y(h + 0.25)], [X(x + 0.1), Y(h + 0.25)]]); macchia(c, t, '#e8a88a', 0.8, 0.2);
    for (let y = 1.25; y < h - 0.3; y += 0.5) for (let wx = x + 0.12; wx < x + l - 0.15; wx += 0.22) tinta(c, R(X(wx), Y(y + 0.25), M(0.1), M(0.2), 2), '#9fb8cf', 0.6);
    ink(c, f, 1, 0.35); ink(c, t, 1, 0.3);
  }
  const acqua = R(0, Y(0.95), D.l, M(0.75));
  c.fillStyle = sfuma(c.createLinearGradient(0, Y(0.95), 0, Y(0.2)), [0, '#cdebf3'], [1, '#98cfe4']); c.fill(acqua);
  for (const [x, l, , col] of case_) { c.globalAlpha = 0.25; c.fillStyle = col; c.fillRect(X(x), Y(0.95), M(l), M(0.45)); }
  c.globalAlpha = 1;
  const onde = new Path2D(); for (let i = 0; i < 26; i++) { const x = r() * D.l, y = tra(r, Y(0.92), Y(0.25)); onde.moveTo(x, y); onde.quadraticCurveTo(x + 6, y - 2, x + tra(r, 10, 22), y); }
  linea(c, onde, { colore: '#ffffff', spessore: 1.6, alfa: 0.8 });
  const scafo = P([[X(27.55), Y(0.62)], [X(28.55), Y(0.62)], [X(28.4), Y(0.46)], [X(27.7), Y(0.46)]], true);   // la barchetta
  macchia(c, scafo, '#fbf6ec'); tinta(c, R(X(27.6), Y(0.56), M(0.9), M(0.05)), '#e2745a'); ink(c, scafo, 1.2);
  const palo = R(X(27.25), Y(1.1), M(0.06), M(0.9)); macchia(c, palo, '#b37a58'); ink(c, palo, 1);
  const banchina = R(-2, Y(0.22), D.l + 4, M(0.24)); macchia(c, banchina, '#ece2cf', 0.98, 0.25);
  const b = mano(r, [[0, Y(0.22)], [D.l, Y(0.22)]], false); for (let x = 0.3; x < 2.4; x += 0.45) mano(r, [[X(26.8 + x), Y(0.22)], [X(26.8 + x), D.a]], false, 0.5, b);
  ink(c, b, 1.1, 0.7);
  velo(c, D.l / 2, Y(2), M(2.2), CARTA, 0.45, 1.3);
  finitura(D, { alto: [1.6, 0.9, 0.55] }, 0.6);
  return affetta(D, { nome: 'vicolo_fondo', normale: 'z+', x: 26.8, y: 0, z: -17, luce: 0.6 });
}

/** 5a. Fronde in primo piano che entrano da un angolo in alto (specchio = da destra). */
function fronde(seme, x, specchio) {
  const D = dipinto(3.2, 2.2, 100, seme), { c, r, k } = D;
  if (specchio) { c.translate(D.l, 0); c.scale(-1, 1); }
  for (let b = 0; b < 4; b++) {
    const pts = [[tra(r, 0.3, 1.5) * k, -6]]; let a = tra(r, 0.8, 1.4);
    for (let s = 0; s < 13; s++) { a += tra(r, -0.12, 0.2); const [px, py] = pts[pts.length - 1]; pts.push([px + Math.cos(a) * 0.12 * k, py + Math.sin(a) * 0.12 * k]); }
    linea(c, Forme.curva(pts), { colore: '#5b4a35', spessore: 3, alfa: 0.9 });
    pts.forEach(([px, py], i) => {
      if (i < 1) return;
      const [qx, qy] = pts[i - 1], dir = Math.atan2(py - qy, px - qx);
      for (const s of [-1, 1]) foglia(c, px, py, dir + s * tra(r, 0.6, 1.2), tra(r, 0.18, 0.28) * k, 0.07 * k, scegli(r, ['#2f6b4a', '#3f7d57', '#5d9a63', '#7fb57a']), 0.65);
    });
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  finitura(D, { sinistra: [0.3, 0, 1], destra: [0.3, 0, 1], basso: [0.3, 0, 1] }, 0.6);
  return affetta(D, { nome: specchio ? 'fronde_destra' : 'fronde_sinistra', normale: 'z+', x, y: 2.7, z: 4.8, tremola: 0.6, ordine: 2 });
}

/** 5b. Il lampione di ferro (x ≈ 3, z = 4.2). */
function lampione(seme) {
  const D = dipinto(0.9, 4.4, 112, seme), { c, r, k } = D, cx = D.l / 2, Y = (y) => (4.4 - y) * k, M = (m) => m * k, ferro = '#4f6470';
  const base = P([[cx - M(0.16), Y(0)], [cx + M(0.16), Y(0)], [cx + M(0.1), Y(0.4)], [cx + M(0.06), Y(0.5)], [cx - M(0.06), Y(0.5)], [cx - M(0.1), Y(0.4)]], true);
  macchia(c, base, ferro, 1, 0.3); volume(c, base, cx - M(0.16), Y(0.5), M(0.32), M(0.5), 0.8); ink(c, base, 1.2);
  const palo = R(cx - M(0.04), Y(3.6), M(0.08), M(3.12)); macchia(c, palo, ferro, 1, 0.3); volume(c, palo, cx - M(0.04), Y(3.6), M(0.08), M(3.1), 0.9); ink(c, palo, 1.2);
  for (const y of [1.3, 3.45]) { const a = R(cx - M(0.07), Y(y), M(0.14), M(0.07), 3); macchia(c, a, ferro, 1, 0); ink(c, a, 1); }
  const ricciolo = new Path2D(); ricciolo.moveTo(cx, Y(3.3)); ricciolo.quadraticCurveTo(cx + M(0.22), Y(3.4), cx + M(0.16), Y(3.55));
  ricciolo.moveTo(cx, Y(3.3)); ricciolo.quadraticCurveTo(cx - M(0.22), Y(3.4), cx - M(0.16), Y(3.55));
  c.save(); c.strokeStyle = ferro; c.lineWidth = M(0.025); c.stroke(ricciolo); c.restore();
  lanterna(c, r, cx, Y(3.6), M(0.42), ferro);
  finitura(D, null, 0.5);
  return affetta(D, { nome: 'lampione', normale: 'z+', x: 2.55, y: 0, z: 4.2, ordine: 2 });
}

/** 5c. I vasi di fiori (x ≈ 21, z = 3.8): lavanda, gerani, un alberello. */
function vasi(seme) {
  const D = dipinto(2.4, 1.6, 112, seme), { c, r, k } = D, X = (x) => (x - 19.9) * k, Y = (y) => (1.6 - y) * k, M = (m) => m * k;
  const vaso = (cx, l, h, col) => {
    const f = P([[X(cx - l / 2), Y(h)], [X(cx + l / 2), Y(h)], [X(cx + l * 0.38), Y(0)], [X(cx - l * 0.38), Y(0)]]);
    macchia(c, f, col, 0.98, 0.35, 3); volume(c, f, X(cx - l / 2), Y(h), M(l), M(h), 0.8); ink(c, f, 1.3);
    const o = R(X(cx - l / 2 - 0.03), Y(h + 0.07), M(l + 0.06), M(0.09), 2); macchia(c, o, schiarisci(col, 0.15)); ink(c, o, 1.2);
  };
  for (let i = 0; i < 20; i++) {                                   // lavanda
    const x = X(20.45 + tra(r, -0.2, 0.2)), h = tra(r, 0.45, 0.95), p = Forme.curva([[x, Y(0.5)], [x + tra(r, -6, 6), Y(0.5 + h * 0.6)], [x + tra(r, -10, 10), Y(0.5 + h)]]);
    linea(c, p, { colore: '#6f9a6a', spessore: 1.6 });
    for (let j = 0; j < 6; j++) tinta(c, E(x + tra(r, -10, 10) * (h * 0.9), Y(0.5 + h - j * 0.045), M(0.025), M(0.035)), scegli(r, ['#9b8ac4', '#b6a2dc', '#8573b5']), 0.9);
  }
  vaso(20.45, 0.55, 0.48, '#d9875f');
  for (let i = 0; i < 16; i++) fogliaEdera(c, r, X(21.15 + tra(r, -0.3, 0.3)), Y(tra(r, 0.42, 0.75)), M(0.14), r() * 6.3, scegli(r, VERDI), r() < 0.4);
  fiorellini(c, X(20.85), Y(0.95), M(0.6), M(0.25), ['#e84a5f', '#f25c54', '#ff8fa3'], 9, nuovoSeme(r), M(0.03));
  vaso(21.15, 0.5, 0.4, '#e9c46a');
  const tr = Forme.curva([[X(21.8), Y(0.5)], [X(21.75), Y(0.8)], [X(21.86), Y(1.05)]]); linea(c, tr, { colore: '#8a6a4a', spessore: 4 }); ink(c, tr, 1, 0.6);
  for (const [x, y, rr] of [[21.7, 1.05, 0.2], [21.95, 1.18, 0.17], [21.8, 1.34, 0.15]]) chioma(c, r, X(x), Y(y), M(rr), M(rr * 0.6), ['#2f6b4a', '#4f8f55', '#7fb86a'], { dim: M(0.04) });
  vaso(21.8, 0.45, 0.52, '#9fb4c8');
  finitura(D, null, 0.6);
  return affetta(D, { nome: 'vasi', normale: 'z+', x: 19.9, y: 0, z: 3.8, tremola: 0.25, ordine: 2 });
}

/* ======================== 10. SCENA 'FORNO' ============================= */

/** Boiserie: pannelli di legno in basso al muro (fino ad h metri), tra x0 e x1 (pixel). */
function boiserie(D, x0, x1, h) {
  const c = D.c, r = D.r, k = D.k, y = D.a - h * k;
  lavaggio(D, null, x0, y, x1 - x0, h * k, '#c99a66', { variazione: 0.2, fioriture: 4, colature: 0 });
  for (let x = x0 + 0.12 * k; x < x1 - 0.5 * k; x += 0.9 * k) {
    const f = R(x, y + 0.16 * k, Math.min(0.78 * k, x1 - x - 0.12 * k), h * k - 0.3 * k, 2);
    tinta(c, f, '#b98252', 0.35); ink(c, f, 1, 0.6); ombraSotto(c, x, y + 0.16 * k, 0.78 * k, 0.05 * k, 0.3);
  }
  const b = R(x0, y - 0.04 * k, x1 - x0, 0.09 * k); macchia(c, b, '#a8714a'); ink(c, mano(r, [[x0, y - 0.04 * k], [x1, y - 0.04 * k]], false), 1.2);
  ombraSotto(c, x0, y + 0.05 * k, x1 - x0, 0.1 * k, 0.3);
}
/** Mensola di legno con l'ombra sotto (y = piano d'appoggio, in pixel). */
function mensola(D, x0, x1, y, legno = '#a8714a') {
  const f = R(x0, y, x1 - x0, 0.06 * D.k, 2);
  ombraSotto(D.c, x0, y + 0.06 * D.k, x1 - x0, 0.16 * D.k, 0.3); macchia(D.c, f, legno); ink(D.c, rettMano(D.r, x0, y, x1 - x0, 0.06 * D.k, 0.4), 1.2);
}
/** Lampada appesa al soffitto che fa luce (lx centro, yt soffitto, yb cappello, pixel). */
function lampadaAppesa(D, lx, yt, yb, colore = '#e07f55') {
  const c = D.c, k = D.k;
  bagliore(c, lx, yb + 0.15 * k, 1.1 * k, '#ffd98a', 0.32);
  linea(c, mano(D.r, [[lx, yt], [lx, yb]], false, 0.3), { colore: '#5a4a40', spessore: 1.5 });
  const p = new Path2D(); p.moveTo(lx - 0.24 * k, yb + 0.2 * k); p.quadraticCurveTo(lx - 0.2 * k, yb - 0.02 * k, lx, yb); p.quadraticCurveTo(lx + 0.2 * k, yb - 0.02 * k, lx + 0.24 * k, yb + 0.2 * k); p.closePath();
  macchia(c, p, colore, 0.98, 0.35, 2); volume(c, p, lx - 0.24 * k, yb, 0.48 * k, 0.2 * k, 0.7); ink(c, p, 1.3);
  tinta(c, E(lx, yb + 0.21 * k, 0.07 * k, 0.04 * k), '#fff6d0'); bagliore(c, lx, yb + 0.22 * k, 0.25 * k, '#fff2b0', 0.6);
}

/** 1. Il PAVIMENTO di cotto del forno (x -1.5..10.5, z -3..3.5). */
function pavimentoForno(seme) {
  const D = dipinto(12, 6.5, 96, seme), { c, r, k } = D, X = (x) => (x + 1.5) * k, Z = (z) => (z + 3) * k, M = (m) => m * k;
  posa(D, 0, 0, D.l, D.a, { alto: M(0.36), lungo: M(0.36), sfalsa: 0, varia: 0.02, colori: ['#e9a07a', '#e3916c', '#eeb08a', '#dd8b66', '#f0b892', '#e69a76'], malta: '#ecd3b8', tondi: 0.06, inch: 0.4, luce: 0.25 });
  velatura(c, 0, 0, D.l, M(0.9), [conAlfa(OMBRA, 0.35), conAlfa(OMBRA, 0)]);
  for (const s of [0, 1]) velatura(c, s ? D.l - M(0.8) : 0, 0, M(0.8), D.a, s ? [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.3)] : [conAlfa(OMBRA, 0.3), conAlfa(OMBRA, 0)], 1, 'orizzontale');
  bagliore(c, X(8.75), Z(-2.7), M(2.6), '#ffb060', 0.35, 0.8);                      // il fuoco del forno
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.2;               // la luce della vetrina sul pavimento
  c.fillStyle = sfuma(c.createLinearGradient(X(-1.5), 0, X(1.8), 0), [0, '#fff4d8'], [1, 'rgba(255,244,216,0)']);
  c.fill(P([[X(-1.5), Z(-2.75)], [X(-1.5), Z(-0.35)], [X(1.8), Z(0.6)], [X(1.8), Z(-1.8)]], true)); c.restore();
  velo(c, X(4.5), Z(-1.3), M(2.4), OMBRA, 0.35, 0.18);                               // ombra del bancone
  for (const lx of [1.9, 5.2]) bagliore(c, X(lx), Z(-2.4), M(1.2), '#ffe2a0', 0.15, 0.6);
  const tappeto = R(X(-1.45), Z(0.45), M(0.75), M(1.0), 4); macchia(c, tappeto, '#a7533f', 0.95, 0.35);   // zerbino davanti alla porta
  c.save(); c.clip(tappeto); for (let z = 0.5; z < 1.45; z += 0.12) tinta(c, R(X(-1.45), Z(z), M(0.75), M(0.04)), '#d9a05a', 0.5); c.restore(); ink(c, tappeto, 1.2);
  for (let i = 0; i < 60; i++) tinta(c, C(X(tra(r, 9.4, 10.4)), Z(tra(r, -1.1, 0.5)), tra(r, 1, 3)), '#fffaf0', 0.6);  // farina
  finitura(D, { basso: [2.2, 0.7, 0.35] });
  return affetta(D, { nome: 'pavimento', normale: 'su', x: -1.5, y: 0, z: -3 });
}

/** 2. La PARETE DI FONDO: scaffali pieni di pane, lampade, lavagna e il grande forno di mattoni. */
function pareteFondo(seme) {
  const A = 3.4, D = dipinto(12, A, 128, seme), { c, r, k } = D, X = (x) => (x + 1.5) * k, Y = (y) => (A - y) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#f7e5c4', { variazione: 0.2 });
  boiserie(D, X(-1.5), X(7.45), 0.85); boiserie(D, X(10.05), D.l, 0.85);
  ombraSotto(c, 0, 0, D.l, M(0.5), 0.28);
  // la lavagna dei prezzi
  const lav = R(X(-1.25), Y(2.3), M(1.1), M(1.05), 3); macchia(c, lav, '#9a6a44'); ink(c, lav, 1.3);
  const nero = R(X(-1.18), Y(2.23), M(0.96), M(0.91), 2); macchia(c, nero, '#4d5a52', 1, 0.3); ink(c, nero, 1);
  for (let i = 0; i < 8; i++) tinta(c, E(X(tra(r, -1.1, -0.3)), Y(tra(r, 1.4, 2.2)), M(0.15), M(0.06)), '#ffffff', 0.06);
  c.save(); c.fillStyle = 'rgba(250,250,240,0.88)'; c.font = 'italic ' + Math.round(M(0.1)) + 'px Georgia, "DejaVu Serif", serif';
  ['Pane  2,50', 'Baguette  1,20', 'Cornetti  1,00', 'Ciambelle  0,90'].forEach((t, i) => c.fillText(t, X(-1.1), Y(2.02 - i * 0.2)));
  c.restore();
  // lo scaffale di legno con il pane
  const s0 = X(0.2), s1 = X(6.9);
  lavaggio(D, null, s0, Y(2.78), s1 - s0, Y(0.85) - Y(2.78), '#ecd2a6', { variazione: 0.15, colature: 0, fioriture: 4 });
  for (const x of [0.2, 3.52, 6.82]) { const f = R(X(x), Y(2.82), M(0.08), M(2.82)); macchia(c, f, LEGNO); volume(c, f, X(x), Y(2.82), M(0.08), M(2.8), 0.6); ink(c, f, 1.2); }
  const crown = R(s0 - M(0.08), Y(2.9), s1 - s0 + M(0.16), M(0.12), 2); macchia(c, crown, '#a8714a'); ink(c, crown, 1.2);
  for (let i = 0; i < 7; i++) paneTondo(c, r, X(0.65 + i * 0.93), Y(2.3), M(0.5));
  for (let i = 0; i < 3; i++) pagnotta3(c, r, X(0.85 + i * 0.9), Y(1.75), M(0.62));
  for (let i = 0; i < 9; i++) cornetto(c, X(3.95 + (i % 5) * 0.55 + (i > 4 ? 0.27 : 0)), Y(1.86 + (i > 4 ? 0.09 : 0)), M(0.42));
  for (let i = 0; i < 5; i++) baguette(c, X(0.35 + (i % 2) * 0.15), Y(1.3 + i * 0.075), M(1.35), 0);
  for (let i = 0; i < 5; i++) baguette(c, X(1.85 + (i % 2) * 0.12), Y(1.3 + i * 0.075), M(1.4), 0);
  for (let i = 0; i < 10; i++) ciambella(c, X(3.85 + (i % 6) * 0.48 + (i > 5 ? 0.24 : 0)), Y(1.36 + (i > 5 ? 0.17 : 0)), M(0.15), false);
  for (const y of [2.3, 1.75, 1.2]) mensola(D, s0, s1, Y(y));
  for (const [x, l] of [[0.75, 0.75], [1.75, 0.8]]) {                   // cesti di baguette a terra
    for (let i = 0; i < 4; i++) baguette(c, X(x - 0.25 + i * 0.12), Y(0.25), M(0.95), -Math.PI / 2 + tra(r, -0.15, 0.15));
    cesto(c, r, X(x + 0.05), Y(0), M(l), M(0.42));
  }
  for (const x of [1.9, 5.2]) lampadaAppesa(D, X(x), 0, Y(2.85));
  // il FORNO di mattoni con la volta e la bocca ad arco
  const fx0 = X(7.5), fx1 = X(10.05), fcx = (fx0 + fx1) / 2;
  const canna = R(X(8.5), 0, M(0.55), Y(2.6)); macchia(c, canna, '#e9a588'); volume(c, canna, X(8.5), 0, M(0.55), Y(2.6), 0.7); ink(c, canna, 1.3);
  const forno = new Path2D(); forno.moveTo(fx0, D.a + 2); forno.lineTo(fx0, Y(2.05)); forno.ellipse(fcx, Y(2.05), (fx1 - fx0) / 2, M(0.7), 0, Math.PI, 0); forno.lineTo(fx1, D.a + 2); forno.closePath();
  c.save(); c.clip(forno);
  posa(D, fx0, Y(2.8), fx1, D.a, { alto: M(0.15), lungo: M(0.34), colori: MATTONI, malta: '#f6cdb6', inch: 0.5, luce: 0.5 });
  c.restore();
  const bocca = arco(X(8.1), Y(1.5), M(1.3), M(0.95), M(0.5));
  bagliore(c, fcx, Y(1.0), M(1.4), '#ff9a40', 0.4, 0.9);
  velo(c, fcx, Y(1.65), M(0.6), '#4a3030', 0.35, 0.8);                // fuliggine sopra la bocca
  c.save(); c.lineWidth = M(0.2); c.strokeStyle = '#f3d2b4'; c.stroke(bocca); c.restore();
  const conci = new Path2D();                                        // i conci dell'arco
  for (let a = Math.PI * 1.05; a < Math.PI * 1.98; a += 0.2) { conci.moveTo(fcx + Math.cos(a) * M(0.65), Y(1.0) + Math.sin(a) * M(0.5)); conci.lineTo(fcx + Math.cos(a) * M(0.82), Y(1.0) + Math.sin(a) * M(0.64)); }
  ink(c, conci, 1, 0.6);
  buca(c, bocca);                                                     // dentro la bocca si vede lo strato del fuoco
  ink(c, bocca, 1.6); ink(c, forno, 1.4);
  const piano = R(X(7.95), Y(0.58), M(1.6), M(0.1), 2); macchia(c, piano, '#efdcc4'); ink(c, piano, 1.2); ombraSotto(c, X(7.95), Y(0.48), M(1.6), M(0.12), 0.35);
  const nicchia = R(X(8.15), Y(0.42), M(1.2), M(0.34), 3); macchia(c, nicchia, '#4a3634', 1, 0); ink(c, nicchia, 1.2);
  for (let i = 0; i < 9; i++) {                                     // la legna impilata
    const lx = X(8.27 + (i % 5) * 0.24 + (i > 4 ? 0.12 : 0)), ly = Y(0.18 + (i > 4 ? 0.14 : 0)), t = C(lx, ly, M(0.07));
    macchia(c, t, '#d9a874'); ink(c, C(lx, ly, M(0.03)), 0.7, 0.5); ink(c, t, 1);
  }
  const pala = new Path2D(); pala.moveTo(X(7.18), Y(2.2)); pala.lineTo(X(7.3), Y(0.42));    // la pala del fornaio
  c.save(); c.strokeStyle = '#d9b07a'; c.lineWidth = M(0.05); c.lineCap = 'round'; c.stroke(pala); c.restore(); ink(c, pala, 0.9, 0.7);
  const paletta = R(X(7.12), Y(0.45), M(0.36), M(0.45), M(0.12)); macchia(c, paletta, '#e3bd88'); ink(c, paletta, 1.2);
  finitura(D, { alto: [0.5, 0.25, 0] });
  return affetta(D, { nome: 'parete_fondo', normale: 'z+', x: -1.5, y: 0, z: -3 });
}

/** 2b. Il FUOCO nella bocca del forno (dietro la parete, z = -3.3), che fa luce. */
function fuoco(seme) {
  const D = dipinto(1.8, 1.3, 128, seme), { c, r, k } = D, X = (x) => (x - 7.85) * k, Y = (y) => (1.7 - y) * k, M = (m) => m * k;
  c.fillStyle = sfuma(c.createRadialGradient(X(8.75), Y(0.6), 0, X(8.75), Y(0.8), M(0.9)), [0, '#ffcf70'], [0.35, '#e27a3c'], [0.7, '#8a3b2c'], [1, '#4a2428']);
  c.fillRect(0, 0, D.l, D.a);
  for (let i = 0; i < 5; i++) { const t = R(X(8.25 + i * 0.2), Y(0.68), M(0.32), M(0.08), M(0.04)); macchia(c, t, '#6a4030'); ink(c, t, 0.9, 0.7); }
  for (const [x0, x1, h, col, n] of [[8.12, 9.38, 0.66, '#ff8a3a', 4], [8.3, 9.2, 0.48, '#ffbf4a', 3], [8.48, 9.02, 0.28, '#fff0b0', 2]]) {
    const f = new Path2D(), yb = Y(0.64), w = (X(x1) - X(x0)) / n;      // una corona di fiamme
    f.moveTo(X(x0), yb);
    for (let i = 0; i < n; i++) {
      const xa = X(x0) + i * w, hh = M(h) * tra(r, 0.7, 1), xm = xa + w * tra(r, 0.3, 0.8);
      f.bezierCurveTo(xa - w * 0.1, yb - hh * 0.5, xm - w * 0.35, yb - hh * 0.7, xm, yb - hh); f.bezierCurveTo(xm + w * 0.1, yb - hh * 0.6, xa + w * 1.1, yb - hh * 0.4, xa + w, yb - M(h) * tra(r, 0.15, 0.35));
    }
    f.lineTo(X(x1), yb); f.closePath();
    macchia(c, f, col, 0.92, 0.3, 2); ink(c, f, 0.9, 0.35);
  }
  for (let i = 0; i < 26; i++) tinta(c, C(X(tra(r, 8.1, 9.4)), Y(tra(r, 0.55, 0.7)), tra(r, 1.5, 3.5)), scegli(r, ['#ffde7a', '#ff9a3c', '#ffefb0']), 0.9);
  bagliore(c, X(8.75), Y(0.85), M(0.8), '#ffcf70', 0.4);
  carta(D, 0.5);
  return affetta(D, { nome: 'fuoco', normale: 'z+', x: 7.85, y: 0.4, z: -3.3, luce: 1, ordine: -1 });
}

/** 3. Il BANCONE di legno con la vetrinetta dei dolci (z = -1.1). */
function bancone(seme) {
  const A = 1.05, D = dipinto(4, A, 128, seme), { c, r, k } = D, X = (x) => (x - 2.5) * k, Y = (y) => (A - y) * k, M = (m) => m * k;
  lavaggio(D, null, 0, Y(0.95), D.l, M(0.95), '#bf8a58', { variazione: 0.22, colature: 0 });
  for (let x = 2.62; x < 6.4; x += 1.27) { const f = R(X(x), Y(0.3), M(1.16), M(0.2), 2); tinta(c, f, '#a8714a', 0.35); ink(c, f, 1, 0.6); }
  tinta(c, R(0, Y(0.08), D.l, M(0.08)), '#7d5236', 0.8);
  const gx = X(2.62), gy = Y(0.9), gl = M(3.76), ga = M(0.54), vetro = R(gx, gy, gl, ga, 2);
  c.save(); c.clip(vetro);
  c.fillStyle = sfuma(c.createLinearGradient(0, gy, 0, gy + ga), [0, '#fbf3df'], [1, '#f1dcb6']); c.fillRect(gx, gy, gl, ga);
  c.restore();
  for (const y of [0.4, 0.64]) { tinta(c, R(gx, Y(y), gl, M(0.025)), '#ffffff', 0.85); ink(c, mano(r, [[gx, Y(y)], [gx + gl, Y(y)]], false), 0.8, 0.5); }
  for (let i = 0; i < 12; i++) {
    const tipo = Math.floor(i / 3) % 4, x = X(2.82 + i * 0.31);
    if (tipo === 0) cornetto(c, x, Y(0.5), M(0.24)); else dolcetto(c, r, tipo === 1 ? 1 : 0, x, Y(0.4), M(0.22));
    dolcetto(c, r, i % 2 ? 2 : 3, X(2.82 + i * 0.31), Y(0.64), M(0.2));
    if (i % 3 === 1) { const t = R(x - M(0.08), Y(0.47), M(0.16), M(0.07), 1); tinta(c, t, '#ffffff'); ink(c, t, 0.7, 0.6); }
  }
  c.save(); c.clip(vetro); c.fillStyle = 'rgba(255,255,255,0.35)';
  for (const [x, w] of [[2.7, 0.25], [3.3, 0.08], [4.9, 0.3]]) c.fill(P([[X(x), gy + ga], [X(x + w), gy + ga], [X(x + w + 0.5), gy], [X(x + 0.5), gy]]));
  c.restore(); ink(c, vetro, 1.3);
  for (const x of [2.5, 4.47, 6.42]) { const f = R(X(x), Y(0.92), M(0.08), M(0.62)); macchia(c, f, '#a8714a'); ink(c, f, 1.1); }
  const top = R(-2, Y(1.05), D.l + 4, M(0.13), 2); macchia(c, top, '#c9925e'); volume(c, top, 0, Y(1.05), D.l, M(0.13), 0.7); ink(c, top, 1.3);
  finitura(D, null);
  return affetta(D, { nome: 'bancone', normale: 'z+', x: 2.5, y: 0, z: -1.1 });
}

/** 3b. Il PIANO del bancone visto dall'alto (y = 1.05): vassoio di panini e campanello. */
function pianoBancone(seme) {
  const D = dipinto(4, 0.65, 128, seme), { c, r, k } = D, X = (x) => (x - 2.5) * k, Z = (z) => (z + 1.75) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#c9925e', { variazione: 0.2, colature: 0, fioriture: 3 });
  const v = new Path2D(); for (let z = -1.7; z < -1.1; z += 0.13) mano(r, [[0, Z(z)], [D.l, Z(z)]], false, 0.8, v); ink(c, v, 0.8, 0.35);
  const vas = R(X(2.8), Z(-1.62), M(0.9), M(0.4), 6); macchia(c, vas, '#e8d9bc'); ink(c, vas, 1.2);
  for (let i = 0; i < 6; i++) {                                     // panini visti dall'alto
    const px = X(2.97 + (i % 3) * 0.28), pz = Z(-1.52 + Math.floor(i / 3) * 0.2), p = C(px, pz, M(0.09));
    macchia(c, p, '#e9a85e', 0.97, 0.4); volumeTondo(c, p, px, pz, M(0.09), M(0.09)); ink(c, p, 1);
  }
  const camp = C(X(6.05), Z(-1.35), M(0.07)); macchia(c, camp, '#e0bb5a'); volumeTondo(c, camp, X(6.05), Z(-1.35), M(0.07), M(0.07)); ink(c, camp, 1.1);
  const torta = C(X(4.9), Z(-1.45), M(0.22)); macchia(c, torta, '#f6e6e8', 0.95); tinta(c, C(X(4.9), Z(-1.45), M(0.15)), '#f2a8b8', 0.8); ink(c, torta, 1.1);
  velatura(c, 0, D.a - M(0.05), D.l, M(0.05), ['rgba(255,240,215,0)', 'rgba(255,240,215,0.6)']);
  finitura(D, null);
  return affetta(D, { nome: 'bancone_piano', normale: 'su', x: 2.5, y: 1.05, z: -1.75 });
}

/** 4. La PARETE SINISTRA (x = -1.5, guarda verso +x): la vetrina vista da dentro e la porta col campanello. */
function pareteSinistra(seme) {
  const A = 3.4, D = dipinto(6.5, A, 112, seme), { c, r, k } = D, U = (z) => (3.5 - z) * k, Y = (y) => (A - y) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#f5e0bd', { variazione: 0.2 });
  boiserie(D, 0, D.l, 0.85); ombraSotto(c, 0, 0, D.l, M(0.5), 0.28);
  const wx = U(-0.35), wl = M(2.4), wy = Y(2.6), wa = M(2.0);         // la vetrina: un buco luminoso
  bagliore(c, wx + wl / 2, wy + wa / 2, M(2.2), '#fff2cc', 0.35, 0.8);
  const telaio = R(wx - M(0.12), wy - M(0.12), wl + M(0.24), wa + M(0.24), M(0.42)); macchia(c, telaio, '#f8efe0'); ink(c, telaio, 1.3);
  const buco = R(wx, wy, wl, wa, M(0.32));
  buca(c, buco);
  const m = new Path2D(); for (const f of [1 / 3, 2 / 3]) { m.moveTo(wx + wl * f, wy); m.lineTo(wx + wl * f, wy + wa); } m.moveTo(wx, wy + wa * 0.3); m.lineTo(wx + wl, wy + wa * 0.3);
  c.save(); c.clip(buco); c.strokeStyle = '#f8efe0'; c.lineWidth = M(0.06); c.stroke(m); c.restore(); ink(c, m, 0.9, 0.55); ink(c, buco, 1.3);
  const sill = R(wx - M(0.18), wy + wa, wl + M(0.36), M(0.1), 2); macchia(c, sill, '#f3e6d0'); ink(c, sill, 1.2); ombraSotto(c, wx - M(0.18), wy + wa + M(0.1), wl + M(0.36), M(0.15), 0.3);
  porta(D, U(0.95), Y(0), M(1.1), M(2.3), { legno: '#b8977a', vetri: [2, 3], vetro: '#fff6dc', cornice: '#f3e6d0', gradino: false });
  const cx = U(0.95), cy = Y(2.55);                                    // il campanello sopra la porta
  ink(c, mano(r, [[cx - M(0.25), Y(2.46)], [cx - M(0.25), cy], [cx, cy], [cx, cy + M(0.06)]], false, 0.4), 1.8);
  const camp = new Path2D(); camp.moveTo(cx - M(0.07), cy + M(0.18));
  camp.quadraticCurveTo(cx - M(0.07), cy + M(0.05), cx, cy + M(0.05)); camp.quadraticCurveTo(cx + M(0.07), cy + M(0.05), cx + M(0.07), cy + M(0.18)); camp.closePath();
  macchia(c, camp, '#e2bd5c'); volume(c, camp, cx - M(0.07), cy, M(0.14), M(0.18), 0.8); ink(c, camp, 1.2); tinta(c, C(cx, cy + M(0.2), M(0.025)), '#a8823a');
  const quadro = R(U(2.6), Y(2.4), M(0.6), M(0.45), 2); macchia(c, quadro, '#d8e8d0'); chioma(c, r, U(2.3), Y(2.05), M(0.12), M(0.1), VERDI, { ink: 0 }); ink(c, quadro, 1.2);
  c.save(); c.lineWidth = M(0.04); c.strokeStyle = '#a8714a'; c.stroke(quadro); c.restore();
  finitura(D, { sinistra: [1.2, 0.6, 0] });
  return affetta(D, { nome: 'parete_sinistra', normale: 'x+', x: -1.5, y: 0, z: -3 });
}

/** 4b. Fuori dalla vetrina: la strada luminosa, quasi sovraesposta (x = -1.9). */
function fuori(seme) {
  const D = dipinto(3.8, 3.4, 80, seme), { c, r, k } = D, U = (z) => (0.2 - z) * k, Y = (y) => (3.4 - y) * k, M = (m) => m * k;
  velatura(c, 0, 0, D.l, D.a, ['#fffdf4', '#f7f3e6']);
  const casa = R(U(-0.2), Y(3.2), M(1.8), M(2.6)); macchia(c, casa, '#f9e2a8', 0.8, 0.2);
  const casa2 = R(U(-2.2), Y(2.9), M(1.7), M(2.3)); macchia(c, casa2, '#f6c8c0', 0.8, 0.2);
  for (const [z, y] of [[-0.6, 2.2], [-1.3, 2.2], [-0.6, 1.3], [-1.3, 1.3], [-2.6, 2.0], [-3.2, 2.0]]) tinta(c, R(U(z), Y(y + 0.45), M(0.35), M(0.45), 2), '#b6d0e2', 0.7);
  chioma(c, r, U(-2.0), Y(2.0), M(0.5), M(0.55), ['#86bd76', '#a6d38a', '#cfe8b0'], { ink: 0.25 });
  posa(D, 0, Y(0.6), D.l, D.a, { alto: M(0.12), lungo: M(0.4), colori: PAVE, malta: '#fbe3cf', inch: 0.25, luce: 0.3 });
  c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,253,244,0.45)'; c.fillRect(0, 0, D.l, D.a); c.restore();
  finitura(D, null, 0.4);
  return affetta(D, { nome: 'fuori', normale: 'x+', x: -1.9, y: 0, z: -3.6, luce: 0.5, ordine: -1 });
}

/** 5. La PARETE DESTRA (x = 10.5, guarda verso -x): mensole, sacchi di farina, calendario. */
function pareteDestra(seme) {
  const A = 3.4, D = dipinto(6.5, A, 112, seme), { c, r, k } = D, U = (z) => (z + 3) * k, Y = (y) => (A - y) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#f3dcb8', { variazione: 0.2 });
  velatura(c, 0, 0, M(2), D.a, ['rgba(255,170,90,0.25)', 'rgba(255,170,90,0)'], 1, 'orizzontale');   // riflesso del forno
  boiserie(D, 0, D.l, 0.85); ombraSotto(c, 0, 0, D.l, M(0.5), 0.28);
  for (const y of [1.15, 1.65, 2.15]) {                                 // mensole con barattoli e sacchetti
    for (let z = -2.75; z < -1.3; z += tra(r, 0.22, 0.32)) {
      const x = U(z), q = r();
      if (q < 0.4) {                                                // barattolo di vetro con il tappo
        const b = R(x, Y(y + 0.3), M(0.18), M(0.3), 4); macchia(c, b, '#e9f0ec', 0.8);
        tinta(c, R(x + 2, Y(y + 0.18), M(0.18) - 4, M(0.16)), scegli(r, ['#f3d9a0', '#e8c48a', '#f6e8c8']), 0.8); ink(c, b, 1.1); tinta(c, R(x - 1, Y(y + 0.33), M(0.2), M(0.05)), '#d9774f');
      }
      else if (q < 0.7) { const s = R(x, Y(y + 0.26), M(0.2), M(0.26), 5); macchia(c, s, '#efe2c4'); ink(c, s, 1.1); }
      else paneTondo(c, r, x + M(0.12), Y(y), M(0.26));
    }
    mensola(D, U(-2.9), U(-1.2), Y(y));
  }
  for (const [z, s] of [[-0.85, 0.62], [-0.25, 0.7], [0.4, 0.6]]) {    // sacchi di farina a terra
    const x = U(z), h = M(s), b = Y(0), t = b - h, p = new Path2D();
    p.moveTo(x - M(0.28), b); p.bezierCurveTo(x - M(0.37), b - h * 0.5, x - M(0.3), t + h * 0.12, x - M(0.24), t);
    p.lineTo(x + M(0.24), t); p.bezierCurveTo(x + M(0.3), t + h * 0.12, x + M(0.37), b - h * 0.5, x + M(0.28), b); p.closePath();
    macchia(c, p, '#efe4c8', 0.98, 0.35, 3); volume(c, p, x - M(0.3), t, M(0.6), h, 0.7);
    c.save(); c.clip(p); tinta(c, R(x - M(0.4), b - h * 0.55, M(0.8), M(0.05)), '#7fa0c8', 0.7); c.restore();
    c.save(); c.font = 'bold ' + Math.round(M(0.07)) + 'px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#8a6a50'; c.fillText('FARINA', x, b - h * 0.3); c.restore();
    const bordo = R(x - M(0.26), t - M(0.02), M(0.52), M(0.1), 3), farina = E(x, t - M(0.02), M(0.22), M(0.045));
    macchia(c, bordo, '#e2d3b0'); ink(c, bordo, 1.1); tinta(c, farina, '#fffdf8'); ink(c, farina, 0.9, 0.6);
    ink(c, p, 1.3);
  }
  const cal = R(U(-0.45), Y(2.45), M(0.5), M(0.7), 2); macchia(c, cal, '#fffaf0'); ink(c, cal, 1.2);   // calendario
  const fig = R(U(-0.41), Y(2.4), M(0.42), M(0.25)); lavaggio(D, fig, U(-0.41), Y(2.4), M(0.42), M(0.25), '#f3d78a', { colature: 0 }); tinta(c, R(U(-0.41), Y(2.25), M(0.42), M(0.1)), '#a6d38a', 0.8); ink(c, fig, 0.9);
  const g = new Path2D(); for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) g.addPath(R(U(-0.4) + i * M(0.08), Y(2.1) + j * M(0.075), M(0.07), M(0.06)));
  ink(c, g, 0.6, 0.4); tinta(c, C(U(-0.2), Y(2.47), 3), '#6b4b37');
  const or = C(U(1.8), Y(2.55), M(0.2)); macchia(c, or, '#fffaf0'); c.save(); c.lineWidth = M(0.04); c.strokeStyle = '#a8714a'; c.stroke(or); c.restore(); ink(c, or, 1.2);   // orologio
  ink(c, mano(r, [[U(1.8), Y(2.55)], [U(1.8), Y(2.68)]], false, 0.2, mano(r, [[U(1.8), Y(2.55)], [U(1.89), Y(2.52)]], false, 0.2)), 1.6);
  const scopa = new Path2D(); scopa.moveTo(U(2.85), Y(1.75)); scopa.lineTo(U(2.75), Y(0.35));
  c.save(); c.strokeStyle = '#c99a5a'; c.lineWidth = M(0.04); c.stroke(scopa); c.restore();
  const sag = P([[U(2.62), Y(0)], [U(2.92), Y(0)], [U(2.82), Y(0.38)], [U(2.69), Y(0.38)]]); macchia(c, sag, '#e8c86a'); ink(c, sag, 1.1);
  for (const z of [1.2, 2.3]) for (let i = 0; i < 4; i++) foglia(c, U(z) + M(0.15) * Math.cos(i), Y(2.1) - i * 4, -Math.PI / 2 + tra(r, -0.4, 0.4), M(0.22), M(0.03), '#e3c26a', 0.6);   // mazzetti di spighe
  finitura(D, { destra: [1.2, 0.6, 0] });
  return affetta(D, { nome: 'parete_destra', normale: 'x-', x: 10.5, y: 0, z: -3 });
}

/** 6. Il SOFFITTO di assi con le travi (y = 3.4, guarda in basso; in alto nell'immagine la z più vicina). */
function soffitto(seme) {
  const D = dipinto(12, 6.5, 64, seme), { c, r, k } = D, X = (x) => (x + 1.5) * k, Z = (z) => (3.5 - z) * k, M = (m) => m * k;
  lavaggio(D, null, 0, 0, D.l, D.a, '#e3b27c', { variazione: 0.22, luce: false, colature: 0 });
  const assi = new Path2D(); for (let x = 0.25; x < 12; x += 0.25) mano(r, [[M(x), 0], [M(x), D.a]], false, 0.7, assi); ink(c, assi, 0.9, 0.45);
  for (const z of [-2.3, -0.9, 0.5, 1.9, 3.2]) {
    ombraSotto(c, 0, Z(z) + M(0.12), D.l, M(0.25), 0.35);
    const t = R(-2, Z(z) - M(0.12), D.l + 4, M(0.24));
    lavaggio(D, t, 0, Z(z) - M(0.12), D.l, M(0.24), '#9a6440', { variazione: 0.2, colature: 0, fioriture: 2, luce: false });
    velatura(c, 0, Z(z) - M(0.12), D.l, M(0.24), ['rgba(255,235,200,0.3)', 'rgba(255,235,200,0)', conAlfa(OMBRA, 0.25)]);
    ink(c, mano(r, [[0, Z(z) - M(0.12)], [D.l, Z(z) - M(0.12)]], false), 1.3); ink(c, mano(r, [[0, Z(z) + M(0.12)], [D.l, Z(z) + M(0.12)]], false), 1.3);
  }
  bagliore(c, X(8.75), Z(-2.8), M(2.5), '#ffb060', 0.25, 0.8);
  for (const x of [1.9, 5.2]) bagliore(c, X(x), Z(-2.85), M(1.2), '#ffe2a0', 0.25, 0.8);
  velatura(c, 0, D.a - M(0.6), D.l, M(0.6), [conAlfa(OMBRA, 0), conAlfa(OMBRA, 0.3)]);
  finitura(D, { alto: [1.5, 0.6, 0] });
  return affetta(D, { nome: 'soffitto', normale: 'giu', x: -1.5, y: 3.4, z: -3 });
}

/* ========================= 11. DIPINGI LA SCENA ========================== */

/** Le due scene: ogni voce è una funzione che dipinge uno o più strati. */
const SCENE = {
  piazza: [
    () => staccionata(101), () => pavimentoPiazza(102), () => facciate(103), () => vetrinaInterno(104),
    () => giardino(105), () => muroVicolo(106, false), () => muroVicolo(107, true), () => pavimentoVicolo(108),
    () => fondoVicolo(109), () => fronde(110, -2.6, false), () => fronde(111, 30.8, true), () => lampione(112), () => vasi(113),
  ],
  forno: [
    () => pavimentoForno(201), () => pareteFondo(202), () => fuoco(203), () => bancone(204), () => pianoBancone(205),
    () => pareteSinistra(206), () => fuori(207), () => pareteDestra(208), () => soffitto(209),
  ],
};

/**
 * Dipinge tutti gli strati di una scena ('piazza' | 'forno').
 * Restituisce { strati: [ { nome, tela, normale, x, y, z, larghezza, altezza|profondita, ... } ] }
 */
export async function dipingiScena(nome) {
  const lavori = SCENE[nome];
  if (!lavori) throw new Error('Scena sconosciuta: ' + nome);
  const strati = [];
  for (const dipingi of lavori) {
    strati.push(...dipingi());
    await respira();                                        // lascia respirare la pagina tra uno strato e l'altro
  }
  return { strati };
}
