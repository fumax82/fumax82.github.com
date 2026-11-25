/* ==========================================================================
 *  scene_canale.js — LA STRADA DIVENTATA CANALE (scena 'canale')
 *  --------------------------------------------------------------------------
 *  Nel mondo immaginato dalla bambina una via del paese è diventata un
 *  canale, come a Venezia. Lia cammina verso destra lungo z = 0:
 *    x  0..12  via di mattoni rosa-arancio (quota 0)
 *    x 12..22  PONTE ad arco: quota y(x) = 1.8 · sin(π·(x−12)/10)
 *    x 22..37  via oltre il ponte, davanti alla LIBRERIA (x 27..32)
 *    x 37..41  SCALINATA: da quota 0 a quota 3, poi l'uscita in alto
 *  Il canale scorre lungo z (dal fondo verso di noi) tra x = 12.5 e 21.5,
 *  con l'acqua a quota −1.4.
 *
 *  Ogni strato è un foglio dipinto ad acquerello: velature pastello, grana
 *  della carta, bordi più scuri dove il colore si asciuga e sottili linee
 *  di inchiostro seppia. Le convenzioni dei piani sono quelle di strati.js.
 *  Tutto è deterministico: ogni disegno nasce da un "seme".
 * ========================================================================== */
import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa, percorso,
  Forme, trama, foglia, sfumaBordi, respira,
} from './pennello.js';

/* ===================== 1. MISURE E COLORI DELLA SCENA ==================== */
const ACQUA = -1.4;              // quota dell'acqua del canale
const PARAPETTO = 0.55;          // altezza del parapetto sopra il piano del ponte
/** Paline a strisce nell'acqua: [x, z, quota della cima, colore delle strisce]. */
const PALINE = [[12.85, 3.6, 2.2, '#5b7fc2'], [13.2, 3.6, 2.45, '#5b7fc2'], [20.6, 4.3, 2.4, '#d0626a'], [20.95, 4.3, 2.1, '#d0626a']];

/** Quota del piano del ponte (dove cammina Lia) in funzione di x. */
const quotaPonte = (x) => (x <= 12 || x >= 22) ? 0 : 1.8 * Math.sin(Math.PI * (x - 12) / 10);
/** Punto dell'arco (mezza ellisse sopra l'acqua) per l'angolo t: t = π a sinistra, 0 a destra. */
const puntoArco = (t) => [17 + 4.5 * Math.cos(t), -1.1 + 2.25 * Math.sin(t)];

const INK = STILE.inchiostro;              // seppia
const INK_ACQUA = '#5b8db3';               // le linee dell'acqua sono azzurre
const OMBRA = '#6a5688';                   // ombre viola, mai nere
const CARTA = '#fbf7ee';
const PIETRA = '#f4ead6';                  // pietra d'Istria color crema
const VIRATE = ['#f3c46a', '#e8747c', '#86a9d6', '#9cc58a'];
const MATTONI = ['#ef9c76', '#f2ab84', '#e8916d', '#f5b690', '#ec9f80', '#f6c09c'];
const TEGOLE = ['#df7c4e', '#e88e5c', '#d77349', '#ec9c6c', '#e4875a'];
const FIORI = ['#e84a5f', '#f27a8a', '#ffffff', '#f7a8c4', '#d94f70', '#f6d66b'];
const VERDI = ['#4f8a52', '#6faa5e', '#9fcd7c'];
const PASTELLI = ['#f3aeb2', '#a3d6d0', '#f5e5c0', '#f6d88a', '#9cc8ea', '#cdbde6', '#f6c4a0', '#bfe0c4', '#f4b98f', '#f9d3d6'];
const PERSIANE = ['#6fae9c', '#7fa7d6', '#6b9a6e', '#a77fb8', '#5f9f8a', null];
const LIBRI = ['#e0605a', '#f09a4a', '#f3d06a', '#7fbf7a', '#5ea3d6', '#9a80d0', '#e889b0', '#4fb3a9', '#f6efe0', '#c9584e', '#6c8fd8', '#f2b880'];
const scegli = (r, v) => v[Math.floor(r() * v.length)];

/* ================= 2. FOGLI, VELATURE E INCHIOSTRO ======================= */

/**
 * Un FOGLIO è una tela con il suo "righello", che converte i metri in pixel.
 *   u = coordinata orizzontale del disegno (x, oppure z per i muri 'x+'/'x-')
 *   v = coordinata verticale del disegno (y, oppure z per i pavimenti)
 *   opz.specchio:  la u cresce verso SINISTRA (muri 'x+': a sinistra c'è il vicino)
 *   opz.pavimento: la v cresce verso il BASSO (pavimenti: in alto c'è il lontano)
 */
function foglio(u0, u1, v0, v1, ppu, seme, opz = {}) {
  const l = Math.round((u1 - u0) * ppu), a = Math.round((v1 - v0) * ppu);
  const tela = nuovaTela(l, a), k = l / (u1 - u0), kv = a / (v1 - v0);
  return {
    tela, c: tela.getContext('2d'), l, a, rng: casuale(seme),
    X: opz.specchio ? (u) => (u1 - u) * k : (u) => (u - u0) * k,
    U: opz.specchio ? (px) => u1 - px / k : (px) => u0 + px / k,   // il contrario di X
    Y: opz.pavimento ? (v) => (v - v0) * kv : (v) => (v1 - v) * kv,
    m: (d) => d * k,                                                // una misura in metri → pixel
  };
}

/** Descrizione di uno strato per il motore (vedi strati.js). */
function strato(nome, F, normale, x, y, z, larghezza, alto, extra) {
  const d = { nome, tela: F.tela, normale, x, y, z, larghezza };
  d[normale === 'su' || normale === 'giu' ? 'profondita' : 'altezza'] = alto;
  return Object.assign(d, extra || {});
}

/** Spezzata "a mano": i punti tremano un poco, come una penna vera. */
function mano(r, punti, chiuso, t = 0.6, p = new Path2D()) {
  const j = (v) => v + (r() - 0.5) * 2 * t, pts = chiuso ? punti.concat([punti[0]]) : punti;
  p.moveTo(j(pts[0][0]), j(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26));
    for (let s = 1; s <= n; s++) {
      const q = (s - 0.5) / n, f = s / n;
      p.quadraticCurveTo(j(x0 + (x1 - x0) * q), j(y0 + (y1 - y0) * q), j(x0 + (x1 - x0) * f), j(y0 + (y1 - y0) * f));
    }
  }
  if (chiuso) p.closePath();
  return p;
}
const rett = (x, y, l, a) => [[x, y], [x + l, y], [x + l, y + a], [x, y + a]];
/** Rettangolo con la cima ad arco (finestre, porte, portici). */
function puntiArco(x, y, l, a) {
  const rr = l / 2, pts = [[x, y + a], [x, y + rr]];
  for (let g = 195; g < 360; g += 15) pts.push([x + rr + Math.cos(g * Math.PI / 180) * rr, y + rr + Math.sin(g * Math.PI / 180) * rr]);
  pts.push([x + l, y + rr], [x + l, y + a]);
  return pts;
}
/** Punti attorno a un'ellisse un po' storta (pozzanghere, chiome, spruzzi). */
function blob(r, cx, cy, rx, ry, n, irr) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + tra(r, -irr, irr);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

/** Linea a inchiostro (Path2D o funzione). */
function inchiostro(c, forma, spessore = 1.3, alfa = 0.85, colore = INK) {
  c.save();
  c.globalAlpha = alfa; c.strokeStyle = colore; c.lineWidth = spessore;
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.stroke(percorso(forma));
  c.restore();
}
/** Contorno a mano di un elenco di punti. */
const contorno = (c, r, punti, spessore, alfa, t) => inchiostro(c, mano(r, punti, true, t ?? 0.5), spessore, alfa);

/** Macchie morbide di pigmento: più chiare, più scure o di una tinta vicina. */
function chiazze(c, box, r, colore, n, v) {
  const [x, y, l, a] = box, misura = Math.min(Math.max(l, a), 1.6 * Math.min(l, a));
  for (let k = 0; k < n; k++) {
    const cx = x + r() * l, cy = y + r() * a, rr = Math.max(6, tra(r, 0.25, 0.7) * misura), q = r();
    const tono = q < 0.5 ? schiarisci(colore, 0.45) : q < 0.85 ? scurisci(colore, 0.16) : mescola(colore, scegli(r, VIRATE), 0.4);
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, conAlfa(tono, v * tra(r, 0.6, 1.2))); g.addColorStop(1, conAlfa(tono, 0));
    c.fillStyle = g; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
}

/**
 * LAVA: una velatura d'acquerello dentro una forma (versione veloce).
 *   box: [x, y, l, a] rettangolo che contiene la forma (px)
 *   o: { variazione, macchie, luce (false = niente), bordo (0 = niente), lb (larghezza bordo), alfa }
 */
function lava(c, forma, colore, box, r, o = {}) {
  const p = percorso(forma), [x, y, l, a] = box;
  c.save(); c.clip(p);
  c.globalAlpha = o.alfa ?? 1; c.fillStyle = colore; c.fillRect(x, y, l, a);
  c.globalAlpha = 1;
  chiazze(c, box, r, colore, o.macchie ?? Math.min(9, 2 + Math.round(l * a / 25000)), o.variazione ?? 0.2);
  if (o.luce !== false) {                                   // luce calda dall'alto, velo viola in basso
    const g = c.createLinearGradient(0, y, 0, y + a);
    g.addColorStop(0, 'rgba(255,252,242,0.32)'); g.addColorStop(0.5, 'rgba(255,252,242,0)'); g.addColorStop(1, conAlfa(OMBRA, 0.1));
    c.fillStyle = g; c.fillRect(x, y, l, a);
  }
  if (o.bordo !== 0) {                                      // bordo bagnato: il colore si accumula
    const lb = o.lb || 3;
    c.strokeStyle = scurisci(colore, 0.32);
    c.globalAlpha = (o.bordo ?? 0.32) * 0.45; c.lineWidth = lb * 2.4; c.stroke(p);
    c.globalAlpha = o.bordo ?? 0.32; c.lineWidth = lb * 0.7; c.stroke(p);
  }
  c.restore();
}
/** Riempimento piatto (senza effetti). */
function tinta(c, forma, colore, alfa = 1) {
  c.save(); c.globalAlpha = alfa; c.fillStyle = colore; c.fill(percorso(forma)); c.restore();
}
/** Ombra viola che sfuma verso il basso (sotto gronde, davanzali, cornici). */
function ombraSotto(c, x, y, l, h, alfa) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, conAlfa(OMBRA, alfa)); g.addColorStop(1, conAlfa(OMBRA, 0));
  c.save(); c.fillStyle = g; c.fillRect(x, y, l, h); c.restore();
}
/** Velo sfumato SOLO sopra ciò che è già dipinto (foschia, lontananza, ombra). */
function velo(F, x0, y0, x1, y1, tappe, modo) {
  const c = F.c, g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [t, col] of tappe) g.addColorStop(t, col);
  c.save(); c.globalCompositeOperation = modo || 'source-atop'; c.fillStyle = g; c.fillRect(0, 0, F.l, F.a); c.restore();
}

let telaGrana = null;   // tela di lavoro condivisa (per non crearne una per foglio)
/** Grana della carta SOLO dove c'è colore: le zone vuote restano trasparenti. */
function grana(F, forza = 0.3) {
  if (!telaGrana) telaGrana = nuovaTela(2048, 2048);
  const g = telaGrana.getContext('2d'), { l, a } = F, dx = Math.floor(F.rng() * 256), dy = Math.floor(F.rng() * 256);
  g.save();
  g.clearRect(0, 0, l, a);
  g.translate(-dx, -dy);
  g.fillStyle = g.createPattern(trama('grana'), 'repeat'); g.fillRect(dx, dy, l, a);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5;
  g.fillStyle = g.createPattern(trama('macchie'), 'repeat'); g.fillRect(dx, dy, l, a);
  g.restore();
  g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(F.tela, 0, 0); g.restore();
  const c = F.c;
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = forza;
  c.drawImage(telaGrana, 0, 0, l, a, 0, 0, l, a); c.restore();
}

/**
 * Bordo che svanisce nella carta come un acquerello vero: non una riga dritta
 * ma un orlo irregolare di macchie morbide. lato: 'sinistra' | 'destra' | 'alto' | 'basso'.
 */
function svanisci(F, lato, largo) {
  const c = F.c, r = casuale(F.l * 7 + F.a * 13 + lato.length), orizz = lato === 'sinistra' || lato === 'destra';
  const lungo = orizz ? F.a : F.l, bordo = (t) => lato === 'sinistra' || lato === 'alto' ? t : (orizz ? F.l : F.a) - t;
  c.save(); c.globalCompositeOperation = 'destination-out';
  sfumaBordi(F.tela, largo * 0.45, [lato]);
  for (let s = -largo; s < lungo + largo; s += largo * tra(r, 0.25, 0.5)) {
    const rr = largo * tra(r, 0.45, 0.95), d = bordo(largo * tra(r, -0.1, 0.35));
    const [cx, cy] = orizz ? [d, s] : [s, d];
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  c.restore();
}

/** Rumore morbido che dipende solo dalla posizione nel mondo (due fogli vicini combaciano). */
const onda = (z, s) => 0.55 * Math.sin(1.3 * z + s) + 0.3 * Math.sin(3.7 * z + s * 2.1) + 0.15 * Math.sin(8.9 * z + s * 3.3);

/* ========================= 3. MATTONI E TEGOLE =========================== */

/**
 * MATTONI a file dentro una forma (muri, ponte, strade viste dall'alto).
 *   box: [x, y, l, a] zona da riempire (px)
 *   o.h, o.l: altezza della fila e lunghezza del mattone (px)
 *   o.cima(x): bordo alto della prima fila (px); una curva per il ponte
 *   o.colori, o.malta, o.inch (alfa delle linee), o.file (quante file), o.alfaMin
 */
function mattoni(c, r, forma, box, o) {
  const [bx, by, bl, ba] = box, cima = o.cima || (() => by), g = o.giunto ?? Math.max(0.7, o.h * 0.08);
  const righe = new Path2D(), giunti = new Path2D(), n = o.file || Math.ceil(ba / o.h) + 1;
  c.save(); c.clip(percorso(forma));
  c.fillStyle = o.malta; c.fillRect(bx, by, bl, ba);
  for (let k = 0; k < n; k++) {
    const y0 = (x) => cima(x) + k * o.h, y1 = (x) => cima(x) + (k + 1) * o.h;
    if (y0(bx) > by + ba + o.h && y0(bx + bl) > by + ba + o.h && y0(bx + bl / 2) > by + ba + o.h) continue;
    for (let x = bx - r() * o.l * 0.6 - (k % 2) * o.l * 0.5; x < bx + bl;) {
      const xb = x + o.l * tra(r, 0.75, 1.2);
      c.globalAlpha = tra(r, o.alfaMin ?? 0.65, 1);
      c.fillStyle = scegli(r, o.colori);
      c.beginPath();
      c.moveTo(x + g, y0(x) + g); c.lineTo(xb - g, y0(xb) + g); c.lineTo(xb - g, y1(xb) - g); c.lineTo(x + g, y1(x) - g);
      c.fill();
      if (r() < 0.8) { const jx = tra(r, -0.6, 0.6); giunti.moveTo(xb + jx, y0(xb) + tra(r, 0, 1)); giunti.lineTo(xb - jx, y1(xb) - tra(r, 0, 1)); }
      x = xb;
    }
    const pts = [];                                         // la riga di malta, tracciata a mano
    for (let x = bx - 12; x <= bx + bl + 24; x += 24) pts.push([x, y1(x)]);
    mano(r, pts, false, 0.45, righe);
  }
  c.globalAlpha = 1;
  inchiostro(c, righe, o.spessore || 0.9, o.inch ?? 0.45);
  inchiostro(c, giunti, (o.spessore || 0.9) * 0.9, (o.inch ?? 0.45) * 0.8);
  c.restore();
}

/** Coppi di un tetto visto di fronte: file di tegole dal fondo tondo (dal basso in alto). */
function coppi(c, r, x0, x1, top, bot, th) {
  const tw = th * 1.1, bordi = new Path2D(), file = [];
  for (let y = bot - th * 0.5, k = 0; y > top - th; y -= th, k++) file.push([y, k]);
  for (const [y, k] of file) {
    for (let x = x0 - (k % 2) * tw / 2 - r() * 2; x < x1 + tw; x += tw) {
      const p = new Path2D(), rr = tw / 2 - 0.6;
      p.moveTo(x + 0.6, y - th); p.lineTo(x + tw - 0.6, y - th); p.lineTo(x + tw - 0.6, y);
      p.arc(x + tw / 2, y, rr, 0, Math.PI); p.closePath();
      c.globalAlpha = tra(r, 0.85, 1); c.fillStyle = scegli(r, TEGOLE); c.fill(p);
      c.globalAlpha = 0.22; c.fillStyle = '#fff3e0'; c.fillRect(x + tw * 0.18, y - th, tw * 0.16, th);
      bordi.moveTo(x + 0.6, y); bordi.arc(x + tw / 2, y, rr, Math.PI, 0, true);
    }
  }
  c.globalAlpha = 1;
  inchiostro(c, bordi, 0.75, 0.5);
}

/** Tetto "a falda" (la gronda è parallela alla strada): una fascia di coppi sopra il muro. */
function tettoFalda(c, r, xl, xr, ye, h, sporto, facciata) {
  const x0 = xl - sporto, x1 = xr + sporto, top = ye - h, rientro = h * 0.28;
  const pts = [[x0, ye], [x0 + rientro, top], [x1 - rientro, top], [x1, ye]], forma = Forme.poligono(pts);
  c.save(); c.clip(facciata); ombraSotto(c, xl, ye, xr - xl, h * 0.4, 0.32); c.restore();
  c.save(); c.clip(forma);
  c.fillStyle = '#b8603f'; c.fillRect(x0, top, x1 - x0, h);
  coppi(c, r, x0, x1, top, ye, Math.max(4, h / 4.6));
  c.restore();
  tinta(c, Forme.rettangolo(x0 - 1, ye - 2.5, x1 - x0 + 2, 4, 1), '#c77b55');   // la grondaia
  contorno(c, r, pts, 1.3, 0.85, 0.5);
}

/** Tetto "a capanna" (timpano verso la strada): due falde sottili con le tegole e i dentelli. */
function tettoCapanna(c, r, xl, xr, ye, yp, sporto, dentelli, facciata) {
  const xm = (xl + xr) / 2, pend = (yp - ye) / (xm - xl), sp = Math.max(5, (xr - xl) * 0.06);
  const A = [xl - sporto, ye - pend * sporto], B = [xr + sporto, ye - pend * sporto], P = [xm, yp];
  const yLinea = (x) => x < xm ? ye + (x - xl) * pend : ye + (xr - x) * pend;   // falda sopra la facciata
  c.save(); c.clip(facciata);                                // ombra della falda e dentelli sulla facciata
  tinta(c, Forme.poligono([A, P, B, [B[0], B[1] + sp * 1.6], [xm, yp + sp * 1.6], [A[0], A[1] + sp * 1.6]]), OMBRA, 0.18);
  if (dentelli) {
    const d = new Path2D(), w = sp * 0.55;
    for (let x = xl + w; x < xr - w; x += w * 2) {
      const q = [[x, yLinea(x)], [x + w, yLinea(x + w)], [x + w, yLinea(x + w) + sp * 0.9], [x, yLinea(x) + sp * 0.9]];
      tinta(c, Forme.poligono(q), scegli(r, MATTONI), 0.95);
      mano(r, q, true, 0.3, d);
    }
    inchiostro(c, d, 0.8, 0.6);
  }
  c.restore();
  const fascia = [A, P, B, [B[0], B[1] - sp], [xm, yp - sp], [A[0], A[1] - sp]];
  lava(c, Forme.poligono(fascia), '#e5875a', [A[0], yp - sp, B[0] - A[0], A[1] - yp + sp], r, { macchie: 3, luce: false, lb: 2 });
  const tacche = new Path2D();                               // le teste delle tegole lungo le falde
  for (let x = A[0] + sp * 0.8; x < B[0] - sp * 0.5; x += sp * 0.8) {
    const y = x < xm ? A[1] + (x - A[0]) * pend : B[1] + (B[0] - x) * pend;
    if (Math.abs(x - xm) < sp * 0.6) continue;
    tacche.moveTo(x, y); tacche.lineTo(x + tra(r, -0.5, 0.5), y - sp);
    c.save(); c.globalAlpha = 0.5; c.fillStyle = scegli(r, TEGOLE); c.fillRect(x + 1, y - sp + 1, sp * 0.7, sp - 2); c.restore();
  }
  inchiostro(c, tacche, 0.8, 0.55);
  contorno(c, r, fascia, 1.3, 0.85, 0.5);
}

/** Cornicione piatto con una fila di mattoncini (come la casa gialla del film). */
function cornicione(c, r, xl, xr, ye, h) {
  const sp = h * 0.25, cap = [xl - sp, ye - h * 0.32, xr - xl + sp * 2, h * 0.32];
  const fila = new Path2D();
  for (let x = xl + 2; x < xr - 2; x += h * 0.42) {
    const q = rett(x, ye, h * 0.3, h * 0.55);
    tinta(c, Forme.poligono(q), scegli(r, MATTONI), 0.95); mano(r, q, true, 0.3, fila);
  }
  ombraSotto(c, xl, ye + h * 0.55, xr - xl, h * 0.5, 0.25);
  inchiostro(c, fila, 0.8, 0.65);
  lava(c, Forme.rettangolo(...cap, 2), PIETRA, cap, r, { macchie: 1, luce: false, lb: 1.5 });
  contorno(c, r, rett(...cap), 1.2, 0.85, 0.4);
}

/** Comignolo: dritto con il cappello, oppure "a fumaiolo" alla veneziana (a imbuto). */
function comignolo(c, r, x, yb, s, veneziano) {
  const w = s * 0.34, h = s * 0.9, fusto = rett(x - w / 2, yb - h, w, h);
  lava(c, Forme.poligono(fusto), '#e8a07c', [x - w, yb - h, w * 2, h], r, { macchie: 1, lb: 1.2 });
  contorno(c, r, fusto, 1, 0.8, 0.3);
  const testa = veneziano
    ? [[x - w * 0.45, yb - h], [x + w * 0.45, yb - h], [x + w * 1.05, yb - h - s * 0.55], [x - w * 1.05, yb - h - s * 0.55]]
    : rett(x - w * 0.75, yb - h - s * 0.14, w * 1.5, s * 0.14);
  lava(c, Forme.poligono(testa), veneziano ? '#f1d9c0' : PIETRA, [x - w * 1.2, yb - h - s * 0.6, w * 2.4, s * 0.6], r, { macchie: 1, lb: 1 });
  contorno(c, r, testa, 1, 0.8, 0.3);
}

/* ======================= 4. FINESTRE, PORTE, PIANTE ====================== */

/** Un fiorellino a cinque petali. */
function fiore(c, x, y, d, colore) {
  c.save(); c.fillStyle = colore; c.globalAlpha = 0.92;
  for (let p = 0; p < 5; p++) { const a = p * 1.2566; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, d * 0.75, 0, 6.29); c.fill(); }
  c.fillStyle = '#f6d66b'; c.beginPath(); c.arc(x, y, d * 0.45, 0, 6.29); c.fill(); c.restore();
}

/** Ciuffo di foglie (e fiori) attorno a un punto: cespugli, gerani, fioriere. */
function ciuffo(c, r, cx, cy, rx, ry, o = {}) {
  const colori = o.verdi || VERDI, n = o.foglie || Math.max(8, Math.round(rx * ry / 9));
  tinta(c, Forme.poligono(blob(r, cx, cy, rx * 0.85, ry * 0.8, 9, 0.2), true), colori[1], 0.55);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()), x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const sotto = (y - cy) / ry, col = colori[sotto > 0.3 ? 0 : sotto > -0.3 ? 1 : 2];
    foglia(c, x, y, r() * 6.28, tra(r, 0.35, 0.6) * Math.min(rx, ry) + 2, tra(r, 0.12, 0.2) * Math.min(rx, ry) + 1, col, r() < 0.3 ? 0.5 : 0);
  }
  for (let k = 0; k < (o.fiori || 0); k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.85;
    fiore(c, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d - ry * 0.15, o.dimFiore || Math.max(1.5, rx * 0.09), scegli(r, o.colori || FIORI));
  }
}

/** Edera che pende: un rametto ondeggiante con le foglie ai lati. */
function edera(c, r, x, y, lung, dim) {
  const pts = [], fase = r() * 6, amp = tra(r, 2, 6);
  for (let s = 0; s <= lung; s += 4) pts.push([x + Math.sin(s / 22 + fase) * amp * (s / lung), y + s]);
  inchiostro(c, Forme.curva(pts), 0.9, 0.5, '#5d7a4a');
  for (let i = 1; i < pts.length; i += 2) {
    const [px, py] = pts[i], lato = (i % 4 < 2) ? 1 : -1, sc = 1 - (i / pts.length) * 0.4;
    foglia(c, px, py, Math.PI / 2 + lato * tra(r, 0.6, 1.3), dim * sc * tra(r, 0.8, 1.2), dim * 0.42 * sc, scegli(r, VERDI), r() < 0.35 ? 0.55 : 0);
  }
}

/** Vaso di terracotta (cx, yb = centro della base; l, a in px). */
function vaso(c, r, cx, yb, l, a, colore = '#d9825b') {
  const pts = [[cx - l * 0.38, yb], [cx + l * 0.38, yb], [cx + l * 0.5, yb - a * 0.8], [cx - l * 0.5, yb - a * 0.8]];
  lava(c, Forme.poligono(pts), colore, [cx - l / 2, yb - a, l, a], r, { macchie: 1, lb: 1 });
  const orlo = rett(cx - l * 0.55, yb - a, l * 1.1, a * 0.22);
  lava(c, Forme.poligono(orlo), schiarisci(colore, 0.1), [cx - l * 0.6, yb - a, l * 1.2, a * 0.25], r, { macchie: 0, lb: 1, luce: false });
  contorno(c, r, pts, 1, 0.8, 0.3); contorno(c, r, orlo, 1, 0.8, 0.3);
}

/** Fioriera sotto la finestra: foglie e fiori che traboccano. */
function fioriera(c, r, x, y, l, h, colore) {
  for (let k = 0; k < Math.round(l / 5); k++) {
    foglia(c, x + r() * l, y + h * 0.3, -Math.PI / 2 + tra(r, -1.5, 1.5), tra(r, 0.8, 1.4) * h, h * 0.38, scegli(r, VERDI), r() < 0.3 ? 0.5 : 0);
  }
  for (let k = 0; k < Math.round(l / 7); k++) fiore(c, x + tra(r, 0.05, 0.95) * l, y - tra(r, 0, 0.8) * h, h * 0.2, scegli(r, FIORI));
  const box = rett(x, y, l, h);
  lava(c, Forme.poligono(box), colore || '#d9825b', [x, y, l, h], r, { macchie: 1, lb: 1.2 });
  contorno(c, r, box, 1, 0.85, 0.3);
  for (let k = 0; k < 3; k++) if (r() < 0.6) edera(c, r, x + r() * l, y + h * 0.6, tra(r, h, h * 2.6), h * 0.45);
}

/**
 * FINESTRA (x, y = angolo in alto a sinistra in px; l, a = misure in px).
 * o: { arco, persiane (colore), fiori, tenda, telaio, vetro }
 */
function finestra(c, r, x, y, l, a, o = {}) {
  const t = Math.max(1.5, l * 0.09), arco = o.arco && a > l * 1.1;
  const sagoma = (xx, yy, ll, aa) => arco ? puntiArco(xx, yy, ll, aa) : rett(xx, yy, ll, aa);
  if (o.persiane) {                                          // persiane aperte ai lati
    for (const sx of [x - l * 0.47, x + l]) {
      const ps = rett(sx, y + (arco ? l * 0.35 : 0), l * 0.47, a - (arco ? l * 0.35 : 0));
      lava(c, Forme.poligono(ps), o.persiane, [sx, y, l * 0.5, a], r, { macchie: 1, lb: 1.2, bordo: 0.25 });
      const st = new Path2D();
      for (let yy = ps[0][1] + a * 0.06; yy < y + a * 0.96; yy += Math.max(2.6, a / 15)) { st.moveTo(sx + 2, yy); st.lineTo(sx + l * 0.47 - 2, yy); }
      inchiostro(c, st, 0.7, 0.35, scurisci(o.persiane, 0.45));
      contorno(c, r, ps, 1, 0.8, 0.3);
    }
  }
  const est = sagoma(x, y, l, a), int = sagoma(x + t, y + t, l - 2 * t, a - 2 * t);
  tinta(c, Forme.poligono(est), o.telaio || '#fdf9ef');
  c.save(); c.clip(Forme.poligono(int));
  const g = c.createLinearGradient(0, y, 0, y + a);
  g.addColorStop(0, '#dcf0f7'); g.addColorStop(1, o.vetro || '#9fcbe4');
  c.fillStyle = g; c.fillRect(x, y, l, a);
  if (o.tenda) {                                             // tendina leggera dentro la stanza
    c.globalAlpha = 0.55; c.fillStyle = o.tenda;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + l * 0.42, y); c.quadraticCurveTo(x + l * 0.25, y + a * 0.5, x + l * 0.12, y + a); c.lineTo(x, y + a); c.fill();
    c.beginPath(); c.moveTo(x + l, y); c.lineTo(x + l * 0.58, y); c.quadraticCurveTo(x + l * 0.75, y + a * 0.5, x + l * 0.88, y + a); c.lineTo(x + l, y + a); c.fill();
  }
  c.globalAlpha = 0.28; c.fillStyle = OMBRA; c.fillRect(x, y, l, a * 0.13);
  c.globalAlpha = 0.55; c.fillStyle = '#ffffff';             // riflessi in diagonale
  c.beginPath(); c.moveTo(x + l * 0.12, y + a); c.lineTo(x + l * 0.6, y + a * 0.22); c.lineTo(x + l * 0.74, y + a * 0.22); c.lineTo(x + l * 0.26, y + a); c.fill();
  c.globalAlpha = 0.4;
  c.beginPath(); c.moveTo(x + l * 0.36, y + a); c.lineTo(x + l * 0.84, y + a * 0.22); c.lineTo(x + l * 0.88, y + a * 0.22); c.lineTo(x + l * 0.42, y + a); c.fill();
  c.restore();
  const tr = new Path2D(), yt = y + (arco ? l * 0.5 : a * 0.4);
  tr.moveTo(x + l / 2, y + (arco ? t : t)); tr.lineTo(x + l / 2, y + a - t); tr.moveTo(x + t, yt); tr.lineTo(x + l - t, yt);
  inchiostro(c, tr, Math.max(1.4, t * 0.7), 1, o.telaio || '#fdf9ef');
  inchiostro(c, tr, 0.7, 0.55);
  contorno(c, r, est, 1.2, 0.85, 0.35); contorno(c, r, int, 0.8, 0.55, 0.3);
  const dav = rett(x - l * 0.08, y + a, l * 1.16, Math.max(2.5, a * 0.06));   // davanzale
  ombraSotto(c, dav[0][0], dav[2][1], l * 1.16, a * 0.12, 0.3);
  tinta(c, Forme.poligono(dav), PIETRA); contorno(c, r, dav, 1, 0.8, 0.3);
  if (o.fiori) fioriera(c, r, x - l * 0.02, dav[2][1], l * 1.04, Math.max(4, a * 0.13), o.coloreFioriera);
}

/** PORTA (x, y = angolo in alto a sinistra; l, a in px). o: { colore, arco, finestrella } */
function porta(c, r, x, y, l, a, o = {}) {
  const col = o.colore || '#9a86c6', cr = Math.max(2.5, l * 0.09);
  const sagoma = (xx, yy, ll, aa) => o.arco ? puntiArco(xx, yy, ll, aa) : rett(xx, yy, ll, aa);
  const cornice = sagoma(x - cr, y - cr, l + 2 * cr, a + cr);
  lava(c, Forme.poligono(cornice), PIETRA, [x - cr, y - cr, l + 2 * cr, a + cr], r, { macchie: 1, lb: 1.5, luce: false });
  const anta = sagoma(x, y, l, a);
  lava(c, Forme.poligono(anta), col, [x, y, l, a], r, { macchie: 2, lb: 2, bordo: 0.4 });
  c.save(); c.clip(Forme.poligono(anta)); ombraSotto(c, x, y, l, a * 0.18, 0.35); c.restore();
  const pannelli = new Path2D();
  for (const [px, py] of [[0.14, 0.58], [0.56, 0.58]]) mano(r, rett(x + l * px, y + a * py, l * 0.3, a * 0.3), true, 0.3, pannelli);
  tinta(c, pannelli, scurisci(col, 0.1), 0.35);
  inchiostro(c, pannelli, 0.8, 0.5);
  if (o.finestrella !== false) {                             // vetrino in alto (come la porta viola del film)
    const fv = rett(x + l * 0.22, y + (o.arco ? l * 0.45 : a * 0.12), l * 0.56, a * 0.2);
    const g = c.createLinearGradient(0, fv[0][1], 0, fv[2][1]);
    g.addColorStop(0, '#e6f4fa'); g.addColorStop(1, '#b6dcef');
    tinta(c, Forme.poligono(fv), g); contorno(c, r, fv, 1, 0.8, 0.3);
  }
  tinta(c, Forme.cerchio(x + l * 0.82, y + a * 0.55, Math.max(1.5, l * 0.04)), '#d9b45a');
  contorno(c, r, anta, 1.2, 0.85, 0.4); contorno(c, r, cornice, 1.1, 0.75, 0.4);
  const gr = rett(x - cr * 1.6, y + a, l + cr * 3.2, Math.max(2.5, a * 0.045));      // gradino
  tinta(c, Forme.poligono(gr), '#ece0c8'); contorno(c, r, gr, 1, 0.75, 0.3);
}

/** Sottoportico: un arco buio che attraversa la casa e porta alla fondamenta del canale. */
function sottoportico(c, r, x, y, l, a) {
  const cr = l * 0.08, cornice = puntiArco(x - cr, y - cr, l + 2 * cr, a + cr), vano = puntiArco(x, y, l, a);
  lava(c, Forme.poligono(cornice), PIETRA, [x - cr, y - cr, l + 2 * cr, a + cr], r, { macchie: 1, lb: 2 });
  c.save(); c.clip(Forme.poligono(vano));
  const g = c.createLinearGradient(0, y, 0, y + a);
  g.addColorStop(0, '#5a4767'); g.addColorStop(1, '#8b7590');
  c.fillStyle = g; c.fillRect(x, y, l, a);
  const fondo = puntiArco(x + l * 0.3, y + a * 0.32, l * 0.4, a * 0.68);   // la luce in fondo al passaggio
  const gl = c.createLinearGradient(0, y + a * 0.32, 0, y + a);
  gl.addColorStop(0, '#fbf3e2'); gl.addColorStop(0.6, '#f6d7b8'); gl.addColorStop(1, '#eeae8c');
  tinta(c, Forme.poligono(fondo), gl, 0.9);
  tinta(c, Forme.poligono(rett(x + l * 0.3, y + a * 0.86, l * 0.4, a * 0.14)), '#a9d4e8', 0.6);
  contorno(c, r, fondo, 0.8, 0.4, 0.4);
  c.restore();
  const conci = new Path2D(), rr = l / 2 + cr / 2;           // conci di pietra attorno all'arco
  for (let g2 = 200; g2 < 360; g2 += 20) {
    const ang = g2 * Math.PI / 180, cx = x + l / 2, cy = y + l / 2;
    conci.moveTo(cx + Math.cos(ang) * (l / 2), cy + Math.sin(ang) * (l / 2)); conci.lineTo(cx + Math.cos(ang) * (rr + cr / 2), cy + Math.sin(ang) * (rr + cr / 2));
  }
  inchiostro(c, conci, 0.9, 0.55);
  contorno(c, r, vano, 1.3, 0.9, 0.4); contorno(c, r, cornice, 1.1, 0.7, 0.4);
}

/** Mattoni scoperti dove l'intonaco è caduto (un dettaglio tipico del film). */
function mattonciniScoperti(c, r, cx, cy, s, coloreMuro) {
  const bw = s * 0.26, bh = s * 0.1, segni = new Path2D();
  const file = [[0, 0, 2], [-0.5, 1, 2], [0.2, 2, 1]];
  for (const [dx, riga, n] of file) {
    if (r() < 0.25) continue;
    for (let i = 0; i < n; i++) {
      const q = rett(cx + (dx + i) * bw * 1.05, cy + riga * bh * 1.1, bw, bh);
      tinta(c, Forme.poligono(q), mescola(coloreMuro, '#e8916d', 0.3), 0.6);
      mano(r, q, true, 0.4, segni);
    }
  }
  inchiostro(c, segni, 0.9, 0.65);
}

/** Lanterna a muro con la mensola. */
function lanterna(c, r, x, y, s) {
  const br = new Path2D(); br.moveTo(x - s * 0.18, y + s * 0.05); br.quadraticCurveTo(x - s * 0.05, y - s * 0.12, x + s * 0.02, y + s * 0.02);
  inchiostro(c, br, Math.max(1.2, s * 0.03), 0.9, '#4d4a55');
  const corpo = [[x - s * 0.08, y + s * 0.04], [x + s * 0.12, y + s * 0.04], [x + s * 0.09, y + s * 0.3], [x - s * 0.05, y + s * 0.3]];
  tinta(c, Forme.poligono(corpo), '#fbe9b0'); tinta(c, Forme.poligono(rett(x - s * 0.1, y, s * 0.24, s * 0.05)), '#4d4a55');
  contorno(c, r, corpo, 1, 0.85, 0.3);
}

/** Pluviale: il tubo della grondaia con i collari. */
function pluviale(c, r, x, y0, y1, s) {
  const w = Math.max(2.5, s * 0.07), tubo = rett(x - w / 2, y0, w, y1 - y0);
  tinta(c, Forme.poligono(tubo), '#c98d6a', 0.9);
  const col = new Path2D();
  for (let y = y0 + s * 0.6; y < y1; y += s * 1.4) { col.moveTo(x - w * 0.8, y); col.lineTo(x + w * 0.8, y); }
  inchiostro(c, col, 1.1, 0.7); contorno(c, r, tubo, 0.9, 0.7, 0.3);
}

/** Balconcino con la ringhiera di ferro e due vasi. */
function balcone(c, r, x, y, l, s) {
  const base = rett(x, y, l, s * 0.12);
  ombraSotto(c, x, y + s * 0.12, l, s * 0.3, 0.3);
  tinta(c, Forme.poligono(base), PIETRA); contorno(c, r, base, 1, 0.85, 0.3);
  const ferro = new Path2D(), h = s * 0.85;
  ferro.moveTo(x + 2, y - h); ferro.lineTo(x + l - 2, y - h);
  for (let xx = x + 3; xx < x + l - 1; xx += s * 0.12) { ferro.moveTo(xx, y - h); ferro.lineTo(xx, y); }
  inchiostro(c, ferro, Math.max(1, s * 0.022), 0.85, '#4d4a55');
  for (const f of [0.18, 0.8]) { vaso(c, r, x + l * f, y, s * 0.24, s * 0.2); ciuffo(c, r, x + l * f, y - s * 0.3, s * 0.18, s * 0.16, { fiori: 4, foglie: 10 }); }
}

/** Panni stesi su una corda tra due finestre. */
function bucato(c, r, x0, x1, y, s) {
  const corda = new Path2D(), mid = (x0 + x1) / 2;
  corda.moveTo(x0, y); corda.quadraticCurveTo(mid, y + s * 0.25, x1, y);
  inchiostro(c, corda, 0.8, 0.6);
  for (let x = x0 + s * 0.3; x < x1 - s * 0.4; x += s * tra(r, 0.45, 0.7)) {
    const t = (x - x0) / (x1 - x0), yy = y + s * 0.25 * 4 * t * (1 - t) * 0.5, w = s * tra(r, 0.25, 0.4), h = s * tra(r, 0.35, 0.6);
    const panno = [[x, yy], [x + w, yy + 1], [x + w * 1.05, yy + h], [x - w * 0.05, yy + h * 0.95]];
    lava(c, Forme.poligono(panno), scegli(r, ['#ffffff', '#f6a5b0', '#9cc8ea', '#f6d88a', '#bfe0c4']), [x - 2, yy, w + 4, h + 2], r, { macchie: 0, lb: 1 });
    contorno(c, r, panno, 0.8, 0.7, 0.3);
  }
}

/* ============================== 5. LE CASE ============================== */

/**
 * Una CASA vista di fronte, dipinta sul foglio F. h = {
 *   da, a: estremi orizzontali (metri, coordinata u del foglio)
 *   base, gronda: quota del piano terra e della gronda (metri)
 *   colore, tetto: 'falda' | 'capanna' | 'cornice', colmo (altezza del timpano)
 *   piani, finestre (per piano), arco, persiane, fiori (probabilità 0..1),
 *   porta: { f (0..1 da sinistra), colore, arco } | null, sottoportico, negozio,
 *   mattoni (quante macchie di mattoni scoperti), lampada, cespuglio, balcone,
 *   bucato, pluviale, edera, comignolo ('dritto' | 'veneziano'), seme }
 */
function casa(F, h) {
  const c = F.c, r = casuale(h.seme), m = F.m, s = m(1);
  const xl = Math.min(F.X(h.da), F.X(h.a)), xr = Math.max(F.X(h.da), F.X(h.a)), L = xr - xl;
  const base = h.base || 0, yb = F.Y(base), ye = F.Y(h.gronda);
  const capanna = h.tetto === 'capanna', yp = capanna ? F.Y(h.gronda + h.colmo) : ye;
  const pts = [[xl, yb], [xl, ye]];
  if (capanna) pts.push([(xl + xr) / 2, yp]);
  pts.push([xr, ye], [xr, yb]);
  const facciata = Forme.poligono(pts), box = [xl, yp, L, yb - yp];
  lava(c, facciata, h.colore, box, r, { variazione: 0.22, lb: m(0.05) });
  c.save(); c.clip(facciata);
  const g = c.createLinearGradient(xl, 0, xr, 0);            // volume: luce a sinistra, ombra a destra
  g.addColorStop(0, 'rgba(255,250,240,0.2)'); g.addColorStop(0.65, 'rgba(255,250,240,0)'); g.addColorStop(1, conAlfa(OMBRA, 0.16));
  c.fillStyle = g; c.fillRect(...box);
  const yz = F.Y(base + 0.42);                               // zoccolo un po' più scuro
  lava(c, Forme.rettangolo(xl, yz, L, yb - yz, 0), mescola(h.colore, '#b99a8c', 0.3), [xl, yz, L, yb - yz], r, { macchie: 2, luce: false, lb: 1.5 });
  for (let k = 0; k < (h.mattoni || 0); k++) mattonciniScoperti(c, r, xl + tra(r, 0.1, 0.75) * L, tra(r, ye + (yb - ye) * 0.08, yb - s * 1.1), s, h.colore);
  c.restore();
  inchiostro(c, mano(r, [[xl, yz], [xr, yz]], false, 0.5), 1, 0.6);

  // --- finestre dei piani alti ---
  const piani = h.piani || 3, hp = (h.gronda - base - 0.45) / piani;
  const n = h.finestre || Math.max(1, Math.floor(L / m(1.6))), passo = L / n;
  const lw = Math.min(m(h.lf || 0.9), passo * 0.56), aw = m(Math.min(1.45, hp * 0.5));
  const tende = ['#ffffff', '#f7c6cf', '#fbe7b5', '#ffffff'];
  for (let p = 1; p < piani; p++) {
    const ys = F.Y(base + p * hp + hp * 0.3);
    for (let i = 0; i < n; i++) {
      const cx = xl + passo * (i + 0.5);
      if (h.balcone && p === 1 && i === Math.floor((n - 1) / 2)) balcone(c, r, cx - lw * 0.85, ys + 2, lw * 1.7, s);
      finestra(c, r, cx - lw / 2, ys - aw, lw, aw, {
        arco: h.arco, persiane: passo > lw * 1.95 ? h.persiane : null, fiori: !(h.balcone && p === 1) && r() < (h.fiori ?? 0.5),
        tenda: r() < 0.45 ? scegli(r, tende) : null, coloreFioriera: h.fioriera,
      });
    }
    if (h.bucato && p === 1 && n >= 2) bucato(c, r, xl + passo * 0.5 + lw * 0.6, xl + passo * 1.5 - lw * 0.6, ys - aw * 0.75, s);
  }
  if (capanna && h.colmo > 1.3) {                            // occhio rotondo nel timpano
    const cy = F.Y(h.gronda + h.colmo * 0.34), rr = m(0.26), cx = (xl + xr) / 2;
    tinta(c, Forme.cerchio(cx, cy, rr * 1.25), PIETRA);
    const gv = c.createLinearGradient(0, cy - rr, 0, cy + rr); gv.addColorStop(0, '#dcf0f7'); gv.addColorStop(1, '#9fcbe4');
    tinta(c, Forme.cerchio(cx, cy, rr), gv);
    inchiostro(c, Forme.cerchio(cx, cy, rr * 1.25), 1.1, 0.8); inchiostro(c, Forme.cerchio(cx, cy, rr), 0.8, 0.6);
  }

  // --- piano terra ---
  if (h.sottoportico) sottoportico(c, r, xl + L * 0.12, yb - m(2.7), L * 0.76, m(2.7));
  else if (!h.negozio) {
    const pl = Math.min(m(1.1), L * 0.42), pa = m(Math.min(2.3, hp * 0.82)), pcx = xl + L * (h.porta?.f ?? 0.5);
    for (let i = 0; i < n; i++) {
      const cx = xl + passo * (i + 0.5);
      if (Math.abs(cx - pcx) < lw / 2 + pl / 2 + m(0.35) || hp < 2.4) continue;
      finestra(c, r, cx - lw / 2, F.Y(base + 1.0) - aw * 0.9, lw, aw * 0.9, { arco: h.arco, fiori: r() < 0.5, tenda: r() < 0.5 ? '#ffffff' : null });
    }
    if (h.porta !== null) {
      porta(c, r, pcx - pl / 2, yb - pa, pl, pa, { colore: h.porta?.colore || scegli(r, ['#9a86c6', '#6fa6d6', '#6fae8c', '#e7b95e', '#c77d6e']), arco: h.porta?.arco ?? h.arco });
      if (h.lampada) lanterna(c, r, pcx + pl / 2 + m(0.35), yb - pa - m(0.05), s);
      if (h.cespuglio) {
        vaso(c, r, pcx - pl / 2 - m(0.45), yb, m(0.42), m(0.38));
        ciuffo(c, r, pcx - pl / 2 - m(0.45), yb - m(0.75), m(0.38), m(0.42), { fiori: 6 });
      }
    }
  }
  if (h.pluviale) pluviale(c, r, xr - m(0.12), ye + m(0.1), yb, s);
  if (h.cespuglio2) ciuffo(c, r, xl + L * 0.5, F.Y(base + hp + hp * 0.3) + m(0.45), m(0.75), m(0.5), { foglie: 50, verdi: ['#3f7a4a', '#5f9a55', '#8cc06c'] });

  // --- tetto ---
  if (capanna) tettoCapanna(c, r, xl, xr, ye, yp, m(0.22), h.dentelli, facciata);
  else if (h.tetto === 'cornice') cornicione(c, r, xl, xr, ye, m(0.5));
  else tettoFalda(c, r, xl, xr, ye, m(h.falda || 1.0), m(0.2), facciata);
  if (h.comignolo) comignolo(c, r, xl + L * (h.tetto === 'falda' ? 0.75 : 0.25), capanna ? yLineaTimpano(xl, xr, ye, yp, xl + L * 0.25) : ye - m(h.tetto === 'falda' ? 0.7 : 0.15), s, h.comignolo === 'veneziano');
  contorno(c, r, pts, 1.5, 0.9, 0.6);
  if (h.edera) for (let k = 0; k < 4; k++) edera(c, r, xl + m(0.15) + k * m(0.16), ye + m(0.1), m(tra(r, 1.2, 3.2)), m(0.13));
}
/** Quota (px) della falda di un timpano in un punto x. */
function yLineaTimpano(xl, xr, ye, yp, x) {
  const xm = (xl + xr) / 2;
  return x < xm ? ye + (yp - ye) * (x - xl) / (xm - xl) : ye + (yp - ye) * (xr - x) / (xr - xm);
}

/** Una fila di case lungo il canale, inventata con un seme (u = z del mondo). */
function caseCanale(seme, z0, z1) {
  const r = casuale(seme), lista = [];
  let precedente = null;
  for (let z = z1; z > z0 + 0.01;) {
    let da = z - tra(r, 2.6, 5.0);
    if (da < z0 + 1.8) da = z0;
    let colore = scegli(r, PASTELLI);
    if (colore === precedente) colore = scegli(r, PASTELLI);
    precedente = colore;
    const q = r(), tetto = q < 0.55 ? 'falda' : q < 0.8 ? 'cornice' : 'capanna', w = z - da;
    lista.push({
      da, a: z, gronda: tra(r, 6.4, 9.4), colore, tetto, colmo: tra(r, 1.2, 1.8), piani: 3,
      finestre: Math.max(1, Math.floor(w / 1.5)), arco: r() < 0.55, persiane: scegli(r, PERSIANE), fiori: 0.5,
      porta: { f: tra(r, 0.3, 0.7), arco: r() < 0.5 }, mattoni: Math.floor(r() * 3), balcone: r() < 0.3,
      bucato: r() < 0.18, pluviale: r() < 0.3, edera: r() < 0.2, comignolo: r() < 0.55 ? (r() < 0.6 ? 'veneziano' : 'dritto') : null,
      falda: tra(r, 0.8, 1.2), seme: Math.floor(r() * 1e6),
    });
    z = da;
  }
  return lista;
}

/* ===================== 6. LE FACCIATE SULLA VIA (z = −2.5) =================== */

const CASE_SINISTRA = [
  { da: -4, a: -0.6, gronda: 8.4, colore: '#f5e4bf', tetto: 'falda', piani: 3, finestre: 2, persiane: '#79b8b0', porta: { f: 0.3, colore: '#79a8d8' }, fiori: 0.8, lampada: true, comignolo: 'dritto', seme: 11 },
  { da: -0.6, a: 3.6, gronda: 9.3, colmo: 1.9, colore: '#f3aeb2', tetto: 'capanna', dentelli: true, piani: 3, finestre: 2, porta: { f: 0.66, colore: '#9b86c8' }, mattoni: 4, lampada: true, fiori: 0.6, pluviale: true, seme: 12 },
  { da: 3.6, a: 7.2, gronda: 8.8, colmo: 2.4, colore: '#a6d7d1', tetto: 'capanna', piani: 3, finestre: 1, lf: 1.0, porta: { f: 0.5, arco: true, colore: '#f0cf78' }, cespuglio: true, cespuglio2: true, fiori: 0.3, seme: 13 },
  { da: 7.2, a: 10.1, gronda: 8.0, colore: '#f7c6a0', tetto: 'falda', piani: 3, finestre: 2, persiane: '#6fa77c', porta: { f: 0.35, colore: '#6fae8c' }, mattoni: 2, fiori: 0.9, bucato: true, comignolo: 'veneziano', seme: 14 },
  { da: 10.1, a: 12.5, gronda: 9.0, colore: '#cfc0e6', tetto: 'cornice', piani: 3, finestre: 1, sottoportico: true, fiori: 0.7, edera: true, seme: 15 },
];
const CASE_DESTRA = [
  { da: 21.5, a: 24.4, gronda: 10.4, colore: '#f6da8a', tetto: 'cornice', piani: 4, finestre: 1, sottoportico: true, fiori: 0.6, mattoni: 2, seme: 21 },
  { da: 24.4, a: 27.0, gronda: 8.6, colore: '#97c5ea', tetto: 'falda', piani: 3, finestre: 1, porta: { f: 0.5, colore: '#f3c76f' }, mattoni: 3, fiori: 0.7, lampada: true, seme: 22 },
  { da: 27.0, a: 32.0, gronda: 9.0, colore: '#f6dfc9', tetto: 'falda', piani: 3, finestre: 3, persiane: '#5f9f8a', negozio: true, fiori: 0.8, comignolo: 'dritto', seme: 23 },
  { da: 32.0, a: 34.6, gronda: 9.4, colmo: 1.7, colore: '#f2a9b0', tetto: 'capanna', dentelli: true, piani: 3, finestre: 1, porta: { f: 0.72, colore: '#8fb8de' }, fiori: 0.8, mattoni: 2, seme: 24 },
  { da: 34.6, a: 37.6, gronda: 8.4, colore: '#bfe0c6', tetto: 'falda', piani: 3, finestre: 2, persiane: '#a77fb8', porta: { f: 0.3, colore: '#e7a07a' }, fiori: 0.6, pluviale: true, seme: 25 },
  { da: 37.6, a: 40.6, base: 1.5, gronda: 8.6, colmo: 1.8, colore: '#f8e0a0', tetto: 'capanna', piani: 3, finestre: 2, porta: { f: 0.7, colore: '#7fa7d6' }, fiori: 0.7, seme: 26 },
  { da: 40.6, a: 44, base: 3.0, gronda: 9.9, colore: '#f5c0aa', tetto: 'falda', piani: 3, finestre: 2, persiane: '#6fae9c', porta: { f: 0.42, colore: '#9a86c6' }, fiori: 0.8, lampada: true, comignolo: 'veneziano', seme: 27 },
];

/** Vetrina della libreria: scaffali pieni di libri colorati. */
function vetrina(c, r, x, y, l, a) {
  const vano = rett(x, y, l, a);
  c.save(); c.clip(Forme.poligono(vano));
  const g = c.createLinearGradient(0, y, 0, y + a); g.addColorStop(0, '#7a6656'); g.addColorStop(1, '#9a826c');
  c.fillStyle = g; c.fillRect(x, y, l, a);
  const segni = new Path2D();
  for (let k = 0; k < 3; k++) {                              // tre ripiani
    const ys = y + a * (0.33 + k * 0.32);
    for (let bx = x + 2; bx < x + l - 3;) {
      const bw = l * tra(r, 0.03, 0.055), bh = a * tra(r, 0.16, 0.26), inclina = r() < 0.12 ? tra(r, -0.25, 0.25) : 0;
      const col = scegli(r, LIBRI);
      if (k === 2 && r() < 0.2) {                            // un libro in mostra, con la copertina
        const cw = l * 0.17, ch = a * 0.24, cop = rett(bx, ys - ch, cw, ch);
        tinta(c, Forme.poligono(cop), col); mano(r, cop, true, 0.3, segni);
        tinta(c, Forme.ellisse(bx + cw * 0.5, ys - ch * 0.5, cw * 0.28, ch * 0.16), schiarisci(col, 0.6));
        bx += cw + 2; continue;
      }
      c.save(); c.translate(bx + bw / 2, ys); c.rotate(inclina);
      const libro = rett(-bw / 2, -bh, bw, bh);
      tinta(c, Forme.poligono(libro), col);
      c.fillStyle = schiarisci(col, 0.5); c.fillRect(-bw / 2 + 1, -bh * 0.8, bw - 2, bh * 0.08);
      inchiostro(c, mano(r, libro, true, 0.25), 0.7, 0.6);
      c.restore();
      bx += bw + (inclina ? bw * 0.6 : 0.4);
    }
    const asse = rett(x, ys, l, a * 0.035);
    tinta(c, Forme.poligono(asse), '#c99868'); mano(r, asse, true, 0.3, segni);
  }
  inchiostro(c, segni, 0.7, 0.6);
  c.globalAlpha = 0.25; c.fillStyle = '#ffffff';             // il vetro con i riflessi
  c.beginPath(); c.moveTo(x + l * 0.05, y + a); c.lineTo(x + l * 0.5, y); c.lineTo(x + l * 0.68, y); c.lineTo(x + l * 0.23, y + a); c.fill();
  c.globalAlpha = 0.18; c.fillStyle = '#cfe8f4'; c.fillRect(x, y, l, a);
  c.restore();
  contorno(c, r, vano, 1.3, 0.9, 0.4);
}

/** La LIBRERIA (x 27..32): vetrine verde scuro, insegna "LIBRI", porta a vetri. */
function libreria(F) {
  const c = F.c, r = casuale(77), X = F.X, Y = F.Y, m = F.m;
  const VERDE = '#3f6e5a';
  const corpo = rett(X(27), Y(3.4), X(32) - X(27), Y(0) - Y(3.4));
  lava(c, Forme.poligono(corpo), VERDE, [X(27), Y(3.4), X(32) - X(27), m(3.4)], r, { variazione: 0.18, lb: 2 });
  const cornice = rett(X(26.9), Y(3.5), X(32.1) - X(26.9), m(0.16));
  lava(c, Forme.poligono(cornice), '#2f5848', [X(26.9), Y(3.5), m(5.2), m(0.16)], r, { macchie: 1, lb: 1 });
  contorno(c, r, cornice, 1.2, 0.85, 0.4);
  ombraSotto(c, X(27), Y(3.34), X(32) - X(27), m(0.25), 0.3);
  const insegna = rett(X(27.6), Y(3.26), X(31.4) - X(27.6), m(0.52));       // l'insegna
  lava(c, Forme.poligono(insegna), '#2d5545', [X(27.6), Y(3.26), m(3.8), m(0.52)], r, { macchie: 1, lb: 1.2, luce: false });
  inchiostro(c, mano(r, rett(X(27.68), Y(3.2), X(31.32) - X(27.68), m(0.4)), true, 0.3), 1, 0.7, '#e9cf86');
  c.save();
  c.font = 'bold ' + Math.round(m(0.36)) + 'px Georgia, "Times New Roman", serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if ('letterSpacing' in c) c.letterSpacing = Math.round(m(0.12)) + 'px';
  c.fillStyle = '#f6e3a6'; c.fillText('LIBRI', X(29.5), Y(3.0));
  c.lineWidth = 0.9; c.strokeStyle = INK; c.globalAlpha = 0.8; c.strokeText('LIBRI', X(29.5), Y(3.0));
  c.restore();
  for (const [a, b] of [[27.32, 28.82], [30.18, 31.68]]) {                  // le due vetrine
    vetrina(c, r, X(a), Y(2.55), X(b) - X(a), Y(0.62) - Y(2.55));
    for (const yy of [0.12, 0.33]) {                                         // pannelli sotto la vetrina
      const pn = rett(X(a + 0.08), Y(yy + 0.2), X(b - 0.08) - X(a + 0.08), m(0.17));
      tinta(c, Forme.poligono(pn), '#4f826b', 0.8); contorno(c, r, pn, 0.9, 0.6, 0.3);
    }
  }
  const pl = X(30.02) - X(28.98), py = Y(2.42), pa = Y(0.06) - py;           // porta a vetri
  const anta = rett(X(28.98), py, pl, pa);
  lava(c, Forme.poligono(anta), '#35624f', [X(28.98), py, pl, pa], r, { macchie: 1, lb: 1.5 });
  const vetri = new Path2D();
  for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
    const v = rett(X(29.08) + i * pl * 0.42, py + pa * (0.06 + j * 0.2), pl * 0.38, pa * 0.17);
    const g = c.createLinearGradient(0, v[0][1], 0, v[2][1]); g.addColorStop(0, '#fff2cc'); g.addColorStop(1, '#f3cf8f');
    tinta(c, Forme.poligono(v), g); mano(r, v, true, 0.25, vetri);
  }
  inchiostro(c, vetri, 0.8, 0.6);
  tinta(c, Forme.cerchio(X(29.9), Y(1.1), m(0.035)), '#e2bd5a');
  contorno(c, r, anta, 1.2, 0.9, 0.3);
  const soglia = rett(X(28.85), Y(0.06), X(30.15) - X(28.85), m(0.06));
  tinta(c, Forme.poligono(soglia), PIETRA); contorno(c, r, soglia, 0.9, 0.7, 0.3);
  const pil = new Path2D();                                                  // lesene di legno
  for (const xx of [27.06, 28.9, 30.1, 31.94]) mano(r, [[X(xx), Y(3.3)], [X(xx), Y(0.02)]], false, 0.4, pil);
  inchiostro(c, pil, m(0.05), 0.35, '#5f9079'); inchiostro(c, pil, 0.8, 0.6);
  contorno(c, r, corpo, 1.4, 0.9, 0.5);
  vaso(c, r, X(28.62), Y(0), m(0.4), m(0.34), '#e0a070');                    // un vasetto vicino alla porta
  ciuffo(c, r, X(28.62), Y(0.6), m(0.3), m(0.3), { fiori: 6, colori: ['#f6d66b', '#ffffff', '#f27a8a'] });
}

/** Panchina di legno contro il muro, con una pila di libri sopra. */
function panchina(F, x0, x1) {
  const c = F.c, r = casuale(91), X = F.X, Y = F.Y, m = F.m, legno = '#6fa58a';
  const gambe = new Path2D();
  for (const xx of [x0 + 0.12, x1 - 0.12]) { gambe.moveTo(X(xx), Y(0.44)); gambe.lineTo(X(xx), Y(0)); }
  inchiostro(c, gambe, m(0.06), 1, scurisci(legno, 0.2)); inchiostro(c, gambe, 0.8, 0.6);
  for (const [y, h] of [[0.98, 0.12], [0.8, 0.12], [0.52, 0.1]]) {
    const asse = rett(X(x0), Y(y), X(x1) - X(x0), m(h));
    lava(c, Forme.poligono(asse), legno, [X(x0), Y(y), X(x1) - X(x0), m(h)], r, { macchie: 1, lb: 1 });
    contorno(c, r, asse, 1, 0.85, 0.3);
  }
  ombraSotto(c, X(x0), Y(0.42), X(x1) - X(x0), m(0.3), 0.3);
  for (let k = 0, y = 0.52; k < 3; k++) {                    // pila di libri
    const h = tra(r, 0.06, 0.09), w = tra(r, 0.32, 0.42), lb = rett(X(x0 + 0.35 + tra(r, -0.03, 0.03)), Y(y + h), m(w), m(h));
    tinta(c, Forme.poligono(lb), scegli(r, LIBRI)); contorno(c, r, lb, 0.8, 0.7, 0.3); y += h;
  }
}

/** Muro di sostegno in pietra (sotto le case che salgono dietro la scala). */
function muroSostegno(F, punti) {
  const c = F.c, r = casuale(55), m = F.m, pts = punti.map(([x, y]) => [F.X(x), F.Y(y)]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  mattoni(c, r, Forme.poligono(pts), box, { h: m(0.3), l: m(0.55), colori: ['#efdcc8', '#e7d0bd', '#f3e3d0', '#e9d5c5', '#dccbbd'], malta: '#d9c3b0', inch: 0.55 });
  c.save(); c.clip(Forme.poligono(pts)); chiazze(c, box, r, '#b8a89a', 5, 0.18); c.restore();
  contorno(c, r, pts, 1.4, 0.9, 0.5);
  return pts;
}

/** Facciata sinistra: x −4..12.5. */
function facciataSinistra() {
  const F = foglio(-4, 12.5, 0, 12, 80, 101);
  for (const h of CASE_SINISTRA) casa(F, h);
  grana(F, 0.3);
  svanisci(F, 'sinistra', F.m(1.4));
  return F;
}

/** Facciata destra: x 21.5..44, con la libreria e le case che salgono dietro la scala. */
function facciataDestra() {
  const F = foglio(21.5, 44, 0, 12, 80, 102), m = F.m, r = casuale(103);
  for (const h of CASE_DESTRA) casa(F, h);
  libreria(F);
  panchina(F, 32.2, 33.5);
  const muro = muroSostegno(F, [[37.6, 0], [37.6, 1.5], [40.6, 1.5], [40.6, 3.0], [44, 3.0], [44, 0]]);
  for (let k = 0; k < 9; k++) edera(F.c, r, F.X(41.0 + k * 0.33), F.Y(3.0), m(tra(r, 0.6, 2.4)), m(0.14));
  for (const x of [38.2, 39.6]) { vaso(F.c, r, F.X(x), F.Y(1.5), m(0.42), m(0.38)); ciuffo(F.c, r, F.X(x), F.Y(2.12), m(0.34), m(0.32), { fiori: 7 }); }
  inchiostro(F.c, mano(r, [muro[1], muro[2]], false, 0.4), 1.4, 0.9);
  grana(F, 0.3);
  svanisci(F, 'destra', m(1.0));
  return F;
}

/* ======================== 7. LA STRADA E LE FONDAMENTA ==================== */

/** Bordo di pietra d'Istria lungo il canale, visto dall'alto (u = x, v = z). */
function bordoPietra(F, r, x0, x1, z0, z1) {
  const c = F.c, X0 = Math.min(F.X(x0), F.X(x1)), X1 = Math.max(F.X(x0), F.X(x1)), Y0 = F.Y(z0), Y1 = F.Y(z1);
  lava(c, Forme.rettangolo(X0, Y0, X1 - X0, Y1 - Y0, 0), PIETRA, [X0, Y0, X1 - X0, Y1 - Y0], r, { macchie: 4, luce: false, lb: 1.2 });
  const giunti = new Path2D();
  for (let z = z0 + tra(r, 0.3, 0.9); z < z1; z += tra(r, 0.7, 1.2)) { giunti.moveTo(X0, F.Y(z)); giunti.lineTo(X1, F.Y(z) + tra(r, -1, 1)); }
  inchiostro(c, giunti, 0.9, 0.6);
  inchiostro(c, mano(r, [[X0, Y0], [X0, Y1]], false, 0.5), 1.1, 0.8);
  inchiostro(c, mano(r, [[X1, Y0], [X1, Y1]], false, 0.5), 1.1, 0.8);
}

/** Pozzanghera che riflette il cielo. */
function pozzanghera(c, r, cx, cy, rx, ry) {
  const f = Forme.poligono(blob(r, cx, cy, rx, ry, 11, 0.22), true);
  c.save(); c.clip(f);
  const g = c.createLinearGradient(0, cy - ry, 0, cy + ry);
  g.addColorStop(0, '#f3c7c9'); g.addColorStop(0.45, '#cde9f4'); g.addColorStop(1, '#a9d5ec');   // riflesso: una casa rosa e il cielo
  c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(cx - rx * 1.3, cy - ry * 1.3, rx * 2.6, ry * 2.6);
  c.globalAlpha = 0.75; c.fillStyle = '#ffffff';
  c.fillRect(cx - rx * 0.55, cy + ry * 0.05, rx * 0.8, Math.max(1.5, ry * 0.07)); c.fillRect(cx - rx * 0.15, cy + ry * 0.35, rx * 0.45, Math.max(1.2, ry * 0.05));
  c.restore();
  inchiostro(c, f, 3, 0.25, '#ffffff'); inchiostro(c, f, 0.9, 0.45, INK_ACQUA);
}

/** La via di mattoni vista dall'alto (u = x, v = z; in alto il lontano, z = −2.5). */
function strada(F, x0, x1, canale, extra) {
  const c = F.c, r = F.rng, m = F.m, tutto = Forme.rettangolo(0, 0, F.l, F.a, 0);
  mattoni(c, r, tutto, [0, 0, F.l, F.a], { h: m(0.16), l: m(0.34), colori: MATTONI, malta: '#f4c3a4', inch: 0.4, spessore: 0.9, alfaMin: 0.8 });
  chiazze(c, [0, 0, F.l, F.a], r, '#ee9f78', 14, 0.26);
  for (let k = 0; k < 5; k++) {                              // velature di luce calda (il mondo sognato è luminoso)
    const cx = r() * F.l, cy = tra(r, 0.35, 1) * F.a, rx = m(tra(r, 1.5, 3)), ry = rx * 0.45;
    c.save(); c.translate(cx, cy); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, 'rgba(255,246,226,0.32)'); g.addColorStop(1, 'rgba(255,246,226,0)');
    c.fillStyle = g; c.fillRect(-rx, -rx, rx * 2, rx * 2); c.restore();
  }
  ombraSotto(c, 0, 0, F.l, m(1.1), 0.34);                    // ombra ai piedi delle case
  for (let k = 0; k < 2; k++) pozzanghera(c, r, tra(r, 0.15, 0.85) * F.l, F.Y(tra(r, 0, 3.5)), m(tra(r, 0.5, 0.8)), m(tra(r, 0.3, 0.45)));
  for (let k = 0; k < 40; k++) fiore(c, r() * F.l, r() * F.a, m(0.025), scegli(r, ['#f7a8c4', '#ffffff', '#f6d66b']));
  bordoPietra(F, r, canale, canale + (canale > x0 ? -0.3 : 0.3), -2.5, 5);
  if (extra) extra(F, r);
  grana(F, 0.28);
}

/** Fondamenta lungo il canale (u = x, v = z da −40 a −2.5). */
function fondamenta(F, xCase, xCanale) {
  const c = F.c, r = F.rng, m = F.m;
  mattoni(c, r, Forme.rettangolo(0, 0, F.l, F.a, 0), [0, 0, F.l, F.a], { h: m(0.4), l: m(0.62), colori: ['#f2b08e', '#f4bb9a', '#eea585', '#f6c6a6'], malta: '#f6d6bf', inch: 0.35 });
  chiazze(c, [0, 0, F.l, F.a], r, '#f0a680', 10, 0.2);
  const xs = F.X(xCase), w = m(0.5), g = c.createLinearGradient(xs, 0, xs + (xCase < xCanale ? w : -w), 0);
  g.addColorStop(0, conAlfa(OMBRA, 0.3)); g.addColorStop(1, conAlfa(OMBRA, 0));
  c.fillStyle = g; c.fillRect(Math.min(xs, xs + (xCase < xCanale ? w : -w)), 0, w, F.a);
  bordoPietra(F, r, xCanale, xCanale + (xCanale > xCase ? -0.28 : 0.28), -40, -2.5);
  velo(F, 0, F.Y(-40), 0, F.Y(-12), [[0, conAlfa(CARTA, 0.6)], [1, conAlfa(CARTA, 0)]]);
  grana(F, 0.25);
}

/* =========================== 8. ACQUA E ARGINI ============================ */

const TONI_ACQUA = [[8, '#86bfe0'], [0, '#93cae6'], [-10, '#acd8ec'], [-22, '#cce7f0'], [-40, '#eaf5f4']];
/** Colore dell'acqua alla profondità z (più chiaro in lontananza). */
function coloreAcqua(z) {
  for (let i = 1; i < TONI_ACQUA.length; i++) {
    const [za, ca] = TONI_ACQUA[i - 1], [zb, cb] = TONI_ACQUA[i];
    if (z >= zb) return mescola(ca, cb, Math.min(1, Math.max(0, (za - z) / (za - zb))));
  }
  return TONI_ACQUA[TONI_ACQUA.length - 1][1];
}

/** Elementi dell'acqua (scie, onde, spruzzi) inventati una volta sola in coordinate del mondo. */
function segniAcqua() {
  const r = casuale(606), scie = [], onde = [], spuma = [];
  for (let k = 0; k < 62; k++) {
    const z = k < 34 ? tra(r, -12, 8) : tra(r, -40, -12);
    scie.push({ x: tra(r, 12.9, 21.1), z, l: tra(r, 1.0, 3.2), w: tra(r, 0.035, 0.08), s: tra(r, -0.2, 0.2) });
  }
  for (let k = 0; k < 190; k++) {
    const z = k < 120 ? tra(r, -12, 8) : tra(r, -40, -12);
    onde.push({ x: tra(r, 12.7, 21.3), z, w: tra(r, 0.1, 0.3) });
  }
  const punti = [[12.6, null], [21.4, null], ...PALINE.map(([x, z]) => [x, z])];
  for (const [x, zz] of punti) {
    const n = zz === null ? 40 : 4;
    for (let k = 0; k < n; k++) spuma.push({ x: x + tra(r, -0.12, 0.12), z: zz === null ? tra(r, -14, 7.5) : zz + tra(r, -0.05, 0.2), w: tra(r, 0.08, 0.22) });
  }
  return { scie, onde, spuma };
}

/** L'ACQUA del canale vista dall'alto (u = x 12.5..21.5, v = z). */
function acquaCanale(F, z0, z1, segni, filaSx, filaDx) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m;
  const g = c.createLinearGradient(0, 0, 0, F.a);            // 1) la stesura: azzurra vicino, bianca lontano
  for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, coloreAcqua(z0 + (z1 - z0) * i / 8));
  c.fillStyle = g; c.fillRect(0, 0, F.l, F.a);
  chiazze(c, [0, 0, F.l, F.a], r, '#9fd0ea', 8, 0.2);
  const gx = c.createLinearGradient(0, 0, F.l, 0);           // 2) più scuro vicino alle sponde
  gx.addColorStop(0, 'rgba(70,110,170,0.25)'); gx.addColorStop(0.16, 'rgba(70,110,170,0)');
  gx.addColorStop(0.86, 'rgba(70,110,170,0)'); gx.addColorStop(1, 'rgba(70,110,170,0.14)');
  c.fillStyle = gx; c.fillRect(0, 0, F.l, F.a);
  for (const [fila, xa, xb] of [[filaSx, 12.5, 14.6], [filaDx, 21.5, 19.4]]) {   // 3) riflessi delle case
    for (const h of fila) {
      if (h.a < z0 || h.da > z1) continue;
      const gr = c.createLinearGradient(X(xa), 0, X(xb), 0);
      gr.addColorStop(0, conAlfa(h.colore, 0.5)); gr.addColorStop(1, conAlfa(h.colore, 0));
      c.fillStyle = gr; c.fillRect(Math.min(X(xa), X(xb)), Y(h.da) + 2, Math.abs(X(xb) - X(xa)), Y(h.a) - Y(h.da) - 4);
    }
  }
  if (z1 > -1) {                                             // 4) ombra e riflesso del ponte
    const go = c.createLinearGradient(0, Y(-1.2), 0, Y(1.1));
    go.addColorStop(0, 'rgba(80,90,150,0)'); go.addColorStop(0.3, 'rgba(80,90,150,0.38)'); go.addColorStop(0.7, 'rgba(80,90,150,0.38)'); go.addColorStop(1, 'rgba(80,90,150,0)');
    c.fillStyle = go; c.fillRect(0, Y(-1.2), F.l, Y(1.1) - Y(-1.2));
    // riflesso del ponte: pennellate orizzontali spezzate, calde vicino al ponte e sempre più rade
    for (let z = 0.74; z < 2.6; z += 0.05) {
      for (let x = 12.5 + r() * 0.4; x < 21.5;) {
        const lung = tra(r, 0.25, 1.1), xm = Math.min(21.5, x + lung / 2), alto = quotaPonte(xm) + PARAPETTO - ACQUA;
        const f = 1 - (z - 0.7) / (0.45 * alto + 0.1), t = Math.acos(Math.max(-1, Math.min(1, (xm - 17) / 4.5)));
        const sottoArco = z - 0.7 < 0.45 * (puntoArco(t)[1] - ACQUA) - 0.05;     // lì si specchia l'apertura dell'arco
        if (f > 0 && r() < 0.75) {
          c.globalAlpha = (sottoArco ? 0.12 : 0.42) * f;
          c.fillStyle = sottoArco ? '#fbf4e6' : scegli(r, MATTONI);
          c.fillRect(X(x), Y(z), m(Math.min(lung, 21.5 - x)), m(tra(r, 0.03, 0.06)));
        }
        x += lung + tra(r, 0.05, 0.3);
      }
    }
    c.globalAlpha = 1;
    for (const [px, zz] of PALINE) {                         // riflessi delle paline
      for (let j = 0; j < 6; j++) tinta(c, Forme.rettangolo(X(px) - m(0.06) + Math.sin(j) * 2, Y(zz + 0.12 + j * 0.22), m(0.12), m(0.16), 2), j % 2 ? '#ffffff' : '#4f74b8', 0.35);
    }
  }
  const dentro = (z, mar) => z > z0 - mar && z < z1 + mar;
  const scie = new Path2D(), onde = new Path2D();
  c.fillStyle = 'rgba(255,255,255,0.78)';
  for (const s of segni.scie) {                              // 5) scie bianche lunghe (come nel film)
    if (!dentro(s.z, s.l)) continue;
    const p = [[X(s.x), Y(s.z - s.l / 2)], [X(s.x + s.w), Y(s.z - s.l / 2 + s.l * 0.08)], [X(s.x + s.w * 0.6 + s.s), Y(s.z + s.l / 2)], [X(s.x - s.w * 0.4 + s.s), Y(s.z + s.l / 2 - s.l * 0.08)]];
    c.fill(Forme.poligono(p)); mano(r, p, true, 0.4, scie);
  }
  inchiostro(c, scie, 0.8, 0.45, INK_ACQUA);
  for (const o of segni.onde) {                              // 6) piccole onde a mezzaluna
    if (!dentro(o.z, 0.5)) continue;
    const x = X(o.x), y = Y(o.z), w = m(o.w);
    onde.moveTo(x - w, y); onde.quadraticCurveTo(x, y + w * 0.5, x + w, y);
  }
  inchiostro(c, onde, 2.2, 0.7, '#ffffff'); inchiostro(c, onde, 0.7, 0.4, INK_ACQUA);
  for (const s of segni.spuma) {                             // 7) spuma bianca ai piedi dei muri
    if (!dentro(s.z, 0.3)) continue;
    tinta(c, Forme.poligono(blob(r, X(s.x), Y(s.z), m(s.w), m(s.w * 0.45), 7, 0.3), true), '#ffffff', 0.85);
  }
  velo(F, 0, Y(-8), 0, Y(-40), [[0, conAlfa('#f3f8f6', 0)], [1, conAlfa('#f3f8f6', 0.85)]]);   // 8) la lontananza
  grana(F, 0.22);
}

/** Argine del canale: mattoni, bordo di pietra, macchie d'acqua e muschio (u = z, v = y). */
function argine(F, z0, z1, seme) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m, yc = Y(-0.13);
  const muro = Forme.rettangolo(0, yc, F.l, F.a - yc, 0);
  mattoni(c, r, muro, [0, yc, F.l, F.a - yc], { h: m(0.11), l: m(0.27), colori: MATTONI.map((k) => mescola(k, '#c98a7a', 0.25)), malta: '#e9c3aa', inch: 0.35, cima: () => yc });
  chiazze(c, [0, 0, F.l, F.a], r, '#d99a80', 6, 0.18);
  const verde = [[0, F.a]];                                  // muschio: il bordo alto ondeggia con z
  for (let px = 0; px <= F.l + 6; px += 6) verde.push([px, Y(-1.0 + 0.12 * onda(F.U(px), seme))]);
  verde.push([F.l, F.a]);
  tinta(c, Forme.poligono(verde, false), '#7f9b80', 0.45);
  const gb = c.createLinearGradient(0, Y(-1.15), 0, F.a); gb.addColorStop(0, 'rgba(70,100,95,0)'); gb.addColorStop(1, 'rgba(70,100,95,0.5)');
  c.fillStyle = gb; c.fillRect(0, Y(-1.15), F.l, F.a - Y(-1.15));
  const rs = casuale(seme * 7 + 1);                          // colature scure dal bordo (dipendono solo da z)
  for (let z = -40; z < 8; z += tra(rs, 0.3, 1.1)) {
    const lung = tra(rs, 0.2, 0.7), w = tra(rs, 0.03, 0.08);
    if (z < z0 - 1 || z > z1 + 1) continue;
    const gc = c.createLinearGradient(0, Y(-0.13), 0, Y(-0.13 - lung)); gc.addColorStop(0, 'rgba(90,80,90,0.22)'); gc.addColorStop(1, 'rgba(90,80,90,0)');
    c.fillStyle = gc; c.fillRect(Math.min(X(z), X(z + w)), Y(-0.13), Math.abs(m(w)), m(lung));
  }
  lava(c, Forme.rettangolo(0, 0, F.l, yc, 0), PIETRA, [0, 0, F.l, yc], r, { macchie: 3, luce: false, lb: 1 });   // bordo di pietra
  const giunti = new Path2D(), rg = casuale(seme * 3 + 5);
  for (let z = -40; z < 8; z += tra(rg, 0.7, 1.2)) { giunti.moveTo(X(z), 0); giunti.lineTo(X(z), yc); }
  inchiostro(c, giunti, 0.8, 0.6);
  inchiostro(c, mano(r, [[0, yc], [F.l, yc]], false, 0.4), 1, 0.8);
  inchiostro(c, mano(r, [[0, 1], [F.l, 1]], false, 0.4), 1, 0.7);
  const rf = casuale(seme * 11 + 3);                         // anelli di ferro per le barche
  for (let z = 6 - tra(rf, 0, 3); z > -40; z -= tra(rf, 5, 8)) {
    if (z < z0 || z > z1 || Math.abs(z) < 1.2) continue;
    inchiostro(c, Forme.cerchio(X(z), Y(-0.48), m(0.07)), Math.max(1.2, m(0.025)), 0.85, '#4d4a55');
    tinta(c, Forme.rettangolo(X(z) - m(0.04), Y(-0.38), m(0.08), m(0.06), 1), '#4d4a55', 0.8);
  }
  if (z1 > -1) {                                             // in ombra sotto il ponte
    const go = c.createLinearGradient(X(-1.2), 0, X(1.2), 0);
    go.addColorStop(0, 'rgba(90,80,130,0)'); go.addColorStop(0.25, 'rgba(90,80,130,0.35)'); go.addColorStop(0.75, 'rgba(90,80,130,0.35)'); go.addColorStop(1, 'rgba(90,80,130,0)');
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = go; c.fillRect(Math.min(X(-1.2), X(1.2)), 0, Math.abs(X(1.2) - X(-1.2)), F.a); c.restore();
  }
  velo(F, X(-8), 0, X(-40), 0, [[0, conAlfa(CARTA, 0)], [1, conAlfa(CARTA, 0.6)]]);
  grana(F, 0.25);
}

/** Fila di case lungo il canale (u = z): più chiara man mano che si allontana. */
function filaCanale(F, lista) {
  for (const h of lista) casa(F, h);
  velo(F, F.X(-6), 0, F.X(-40), 0, [[0, conAlfa(CARTA, 0)], [1, conAlfa(CARTA, 0.55)]]);
  grana(F, 0.25);
}

/* ============================== 9. IL PONTE =============================== */

/**
 * Faccia del PONTE (u = x 11.5..22.5, v = y −1.4..2.6). Un solo arco elegante
 * di mattoni rosa-arancio: l'apertura sopra l'acqua resta TRASPARENTE.
 * retro = true → il parapetto di dietro, più scuro e senza fiori.
 */
function ponte(F, retro) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m, U = F.U;
  const cima = (x) => quotaPonte(x) + PARAPETTO;
  const arco = [];                                           // intradosso in px (da sinistra a destra)
  for (let i = 0; i <= 240; i++) { const [x, y] = puntoArco(Math.PI * (1 - i / 240)); arco.push([X(x), Y(y)]); }
  const sil = [[X(11.5), Y(ACQUA)], [X(12.5), Y(ACQUA)], ...arco, [X(21.5), Y(ACQUA)], [X(22.5), Y(ACQUA)]];
  for (let x = 22.5; x >= 11.5 - 1e-6; x -= 0.05) sil.push([X(x), Y(cima(x) + 0.02)]);
  const forma = Forme.poligono(sil), tutto = [0, 0, F.l, F.a];

  // 1) mattoni a file curve, parallele al parapetto (come il ponte del film)
  mattoni(c, r, forma, tutto, { h: m(0.11), l: m(0.27), colori: MATTONI, malta: '#f6cfb0', inch: 0.42, file: 40, cima: (px) => Y(cima(U(px))) });
  c.save(); c.clip(forma);
  chiazze(c, tutto, r, '#ef9f7a', 10, 0.2);
  // 2) conci dell'arco, disposti a raggiera lungo l'intradosso
  const conci = new Path2D(), giro = [];
  let lung = 0;
  for (let i = 1; i < arco.length; i++) lung += Math.hypot(arco[i][0] - arco[i - 1][0], arco[i][1] - arco[i - 1][1]);
  const passo = lung / Math.round(lung / m(0.15));
  for (let s = 0, i = 1, fatto = 0, n = 0; i < arco.length; i++) {
    const seg = Math.hypot(arco[i][0] - arco[i - 1][0], arco[i][1] - arco[i - 1][1]);
    while (fatto + seg >= s && s <= lung + 0.1) {
      const f = (s - fatto) / seg, t = Math.PI * (1 - (i - 1 + f) / 240);
      const px = arco[i - 1][0] + (arco[i][0] - arco[i - 1][0]) * f, py = arco[i - 1][1] + (arco[i][1] - arco[i - 1][1]) * f;
      const nx = Math.cos(t) / 4.5, ny = Math.sin(t) / 2.25, nl = Math.hypot(nx, ny);
      giro.push([px, py, nx / nl, -ny / nl, n++]); s += passo;
    }
    fatto += seg;
  }
  for (let k = 0; k + 1 < giro.length; k++) {
    const [ax, ay, anx, any, i] = giro[k], [bx, by, bnx, bny] = giro[k + 1];
    const chiave = Math.abs(i - (giro.length - 1) / 2) < 0.6, l1 = m(chiave ? 0.46 : i % 2 ? 0.34 : 0.26);
    const q = [[ax, ay], [bx, by], [bx + bnx * l1, by + bny * l1], [ax + anx * l1, ay + any * l1]];
    tinta(c, Forme.poligono(q), chiave ? PIETRA : mescola(scegli(r, MATTONI), '#d9775a', 0.25), chiave ? 1 : 0.95);
    mano(r, q, true, 0.4, conci);
  }
  inchiostro(c, conci, 0.9, 0.6);
  inchiostro(c, mano(r, arco, false, 0.3), m(0.1), 1, PIETRA);  // filo di pietra chiara sull'arco
  // 3) macchie d'acqua e muschio in basso
  const gm = c.createLinearGradient(0, Y(-0.7), 0, Y(ACQUA));
  gm.addColorStop(0, 'rgba(110,140,115,0)'); gm.addColorStop(0.6, 'rgba(110,140,115,0.4)'); gm.addColorStop(1, 'rgba(70,95,95,0.6)');
  c.fillStyle = gm; c.fillRect(0, Y(-0.7), F.l, Y(ACQUA) - Y(-0.7));
  c.restore();
  // 4) cornice di pietra all'altezza del piano e copertina del parapetto
  for (const [d0, d1, ombra] of [[-0.1, 0.0, 0.3], [PARAPETTO - 0.09, PARAPETTO + 0.02, 0.22]]) {
    const giu = [], su = [];
    for (let x = 11.5; x <= 22.501; x += 0.1) { giu.push([X(x), Y(quotaPonte(x) + d0)]); su.push([X(x), Y(quotaPonte(x) + d1)]); }
    const fascia = Forme.poligono(giu.concat(su.slice().reverse()));
    c.save(); c.clip(forma);
    c.save(); c.translate(0, m(0.1)); tinta(c, fascia, OMBRA, ombra * 0.7); c.restore();
    lava(c, fascia, PIETRA, tutto, r, { macchie: 4, luce: false, lb: 1.5 });
    const giunti = new Path2D();
    for (let x = 11.5 + tra(r, 0.3, 0.8); x < 22.5; x += tra(r, 0.6, 1.0)) { giunti.moveTo(X(x), Y(quotaPonte(x) + d0)); giunti.lineTo(X(x) + tra(r, -1, 1), Y(quotaPonte(x) + d1)); }
    inchiostro(c, giunti, 0.9, 0.55);
    c.restore();
    inchiostro(c, mano(r, giu, false, 0.4), 1.1, 0.8); inchiostro(c, mano(r, su, false, 0.4), 1.2, 0.85);
  }
  // 5) pilastrini alle due estremità, con la boccia di pietra
  for (const x0 of [11.5, 22.12]) {
    const p = rett(X(x0), Y(0.98), m(0.38), m(0.98));
    lava(c, Forme.poligono(p), '#f1c4a6', [X(x0), Y(0.98), m(0.38), m(0.98)], r, { macchie: 2, lb: 1.5 });
    const capp = rett(X(x0 - 0.03), Y(1.06), m(0.44), m(0.1));
    tinta(c, Forme.poligono(capp), PIETRA); contorno(c, r, capp, 1, 0.85, 0.3);
    const boccia = Forme.cerchio(X(x0 + 0.19), Y(1.17), m(0.1));
    lava(c, boccia, PIETRA, [X(x0), Y(1.3), m(0.4), m(0.3)], r, { macchie: 1, lb: 1.2 });
    inchiostro(c, boccia, 1, 0.85); contorno(c, r, p, 1.2, 0.9, 0.4);
  }
  // 6) inchiostro del contorno (non sul bordo dell'acqua)
  inchiostro(c, mano(r, arco, false, 0.4), 1.3, 0.9);
  const ext = [];
  for (const [ax, ay, nx, ny] of giro) ext.push([ax + nx * m(0.34), ay + ny * m(0.34)]);
  inchiostro(c, mano(r, ext, false, 0.5), 0.9, 0.5);
  inchiostro(c, mano(r, sil.slice(arco.length + 4), false, 0.5), 1.4, 0.9);
  if (retro) {
    // il parapetto di dietro è in ombra; sopra l'arco si intravede la volta, ancora più scura
    velo(F, 0, 0, 0, F.a, [[0, conAlfa('#6b6aa6', 0.18)], [1, conAlfa('#6b6aa6', 0.28)]]);
    c.save(); c.globalCompositeOperation = 'source-atop';
    inchiostro(c, Forme.curva(arco), m(1.0), 0.35, '#4f4a7a'); inchiostro(c, Forme.curva(arco), m(0.45), 0.3, '#4f4a7a');
    c.restore();
  } else {
    // vasi di gerani sulla copertina ed edera che scende dal parapetto
    for (const x of [13.35, 20.65]) {
      const yb = Y(cima(x) + 0.02);
      vaso(c, r, X(x), yb, m(0.3), m(0.26));
      ciuffo(c, r, X(x), yb - m(0.36), m(0.24), m(0.2), { fiori: 6, foglie: 22 });
    }
    for (let k = 0; k < 6; k++) { const x = 19.6 + k * 0.17; edera(c, r, X(x), Y(cima(x) - 0.08), m(tra(r, 0.4, 1.3)), m(0.12)); }
  }
  grana(F, 0.28);
}

/* ============================ 10. LA SCALINATA ============================ */

/** Fianco della scala (u = x 36.5..41.5, v = y 0..3.6), con ringhiera e vasi. */
function scala(F) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m;
  const prof = [[X(37.2), Y(0)]];
  for (let k = 0; k < 10; k++) { const x = 37.2 + 0.4 * k, y = 0.3 * (k + 1); prof.push([X(x), Y(y)], [X(Math.min(41.5, x + 0.4)), Y(y)]); }
  prof.push([X(41.5), Y(3.0)], [X(41.5), Y(0)]);
  const fianco = Forme.poligono(prof);
  mattoni(c, r, fianco, [X(37.2), Y(3.0), X(41.5) - X(37.2), m(3.0)], { h: m(0.3), l: m(0.6), colori: ['#f3e2cf', '#efd9c4', '#f6e8d6', '#ecd4c0'], malta: '#e2cbb6', inch: 0.45, cima: () => Y(3.0) });
  c.save(); c.clip(fianco);
  chiazze(c, [X(37.2), Y(3), m(4.3), m(3)], r, '#e8c9b0', 6, 0.22);
  const gm = c.createLinearGradient(0, Y(0.5), 0, Y(0)); gm.addColorStop(0, 'rgba(120,140,110,0)'); gm.addColorStop(1, 'rgba(120,140,110,0.35)');
  c.fillStyle = gm; c.fillRect(0, Y(0.5), F.l, m(0.5));
  c.restore();
  // le lastre dei gradini, che sporgono un poco, con l'ombra sotto
  for (let k = 0; k < 10; k++) {
    const x = 37.2 + 0.4 * k, y = 0.3 * (k + 1), w = k === 9 ? 0.7 : 0.43, lastra = rett(X(x - 0.03), Y(y), m(w), m(0.07));
    ombraSotto(c, X(x), Y(y - 0.07), m(w), m(0.1), 0.3);
    lava(c, Forme.poligono(lastra), '#f7ecdc', [X(x - 0.05), Y(y), m(w + 0.1), m(0.07)], r, { macchie: 0, lb: 1, luce: false });
    contorno(c, r, lastra, 1, 0.85, 0.3);
  }
  // porticina della cantina sotto la scala
  porta(c, r, X(39.45), Y(1.3), m(0.85), m(1.3), { colore: '#7fae8f', arco: true });
  contorno(c, r, prof, 1.4, 0.9, 0.5);
  // pilastrino di partenza
  const pil = rett(X(36.75), Y(0.95), m(0.34), m(0.95));
  lava(c, Forme.poligono(pil), '#f3e2cf', [X(36.75), Y(0.95), m(0.34), m(0.95)], r, { macchie: 1, lb: 1.5 });
  const capp = rett(X(36.72), Y(1.02), m(0.4), m(0.08));
  tinta(c, Forme.poligono(capp), PIETRA); contorno(c, r, pil, 1.2, 0.9, 0.4); contorno(c, r, capp, 1, 0.85, 0.3);
  tinta(c, Forme.cerchio(X(36.92), Y(1.12), m(0.09)), PIETRA); inchiostro(c, Forme.cerchio(X(36.92), Y(1.12), m(0.09)), 1, 0.85);
  // ringhiera di ferro: corrimano parallelo alla scala, sbarrette, ricciolo alla partenza
  const yRail = (x) => x < 41 ? 0.75 * (x - 37) + 0.52 : 3.52, yBas = (x) => x < 40.95 ? 0.75 * (x - 37) + 0.24 : 3.12;
  const ferro = new Path2D(), corr = [], bas = [];
  for (let x = 37.08; x <= 41.42; x += 0.1) { corr.push([X(x), Y(yRail(x))]); bas.push([X(x), Y(yBas(x))]); }
  mano(r, corr, false, 0.3, ferro); mano(r, bas, false, 0.3, ferro);
  for (let x = 37.2; x < 41.4; x += 0.13) { ferro.moveTo(X(x), Y(yBas(x))); ferro.lineTo(X(x), Y(yRail(x))); }
  for (const x of [37.08, 38.6, 40.2, 41.42]) { ferro.moveTo(X(x), Y(x < 41 ? 0.75 * (x - 37) + 0.15 : 3.0)); ferro.lineTo(X(x), Y(yRail(x) + 0.03)); }
  const cx = X(37.2), cy = Y(0.42);                          // il ricciolo
  ferro.moveTo(X(37.08), Y(yRail(37.08)));
  for (let t = 0; t < 9; t += 0.3) { const rr = m(0.12) * (1 - t / 11); ferro.lineTo(cx + Math.cos(t + 3.4) * rr, cy + Math.sin(t + 3.4) * rr); }
  inchiostro(c, ferro, Math.max(1.4, m(0.022)), 0.95, '#4b4e5c');
  inchiostro(c, mano(r, corr, false, 0.3), Math.max(2.2, m(0.04)), 0.95, '#4b4e5c');
  // vasi di gerani su alcuni gradini ed edera dal pianerottolo
  for (const k of [1, 4, 7]) {
    const x = 37.2 + 0.4 * k + 0.2, y = 0.3 * (k + 1);
    vaso(c, r, X(x), Y(y), m(0.24), m(0.22));
    ciuffo(c, r, X(x), Y(y + 0.32), m(0.2), m(0.17), { fiori: 6, foglie: 16 });
  }
  for (let k = 0; k < 5; k++) edera(c, r, X(41.08 + k * 0.08), Y(3.0), m(tra(r, 0.5, 1.6)), m(0.12));
  grana(F, 0.28);
}

/* ======================= 11. IL FONDO DEL CANALE (z = −40) ================= */

/** Una casetta lontana, semplice e pallida (x, base, larghezza, altezza in metri). */
function casetta(F, r, x, yb, w, h, pallore) {
  const c = F.c, X = F.X, Y = F.Y, m = F.m, col = schiarisci(scegli(r, PASTELLI), pallore);
  const pts = [[X(x), Y(yb)], [X(x), Y(yb + h)], [X(x + w), Y(yb + h)], [X(x + w), Y(yb)]];
  lava(c, Forme.poligono(pts), col, [X(x), Y(yb + h), m(w), m(h)], r, { macchie: 2, lb: 1.2 });
  const timpano = r() < 0.35, tetto = timpano
    ? [[X(x - 0.06), Y(yb + h)], [X(x + w / 2), Y(yb + h + w * 0.4)], [X(x + w + 0.06), Y(yb + h)]]
    : [[X(x - 0.08), Y(yb + h)], [X(x + 0.1), Y(yb + h + 0.4)], [X(x + w - 0.1), Y(yb + h + 0.4)], [X(x + w + 0.08), Y(yb + h)]];
  tinta(c, Forme.poligono(tetto), schiarisci('#e28a60', pallore));
  const fin = new Path2D(), dim = Math.min(0.24, w * 0.14);
  for (let yy = yb + 0.9; yy < yb + h - 0.5; yy += 1.1) for (let xx = x + 0.28; xx < x + w - 0.3; xx += 0.55) fin.rect(X(xx), Y(yy + dim * 1.6), m(dim), m(dim * 1.6));
  tinta(c, fin, schiarisci('#7fa6d0', pallore * 0.6), 0.7); inchiostro(c, fin, 0.6, 0.25);
  contorno(c, r, pts, 0.8, 0.4, 0.4); contorno(c, r, tetto, 0.7, 0.35, 0.4);
}

/** Veduta lontana e luminosa che svanisce nel bianco della carta (u = x 8..26, v = y). */
function lontano(F) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m;
  const pallido = (col) => schiarisci(col, 0.4);
  // il campanile, dietro a tutto
  const cam = rett(X(19.2), Y(10.2), m(1.1), Y(0.4) - Y(10.2));
  lava(c, Forme.poligono(cam), pallido('#eaa98a'), [X(19.1), Y(10.2), m(1.3), m(10)], r, { lb: 1.5 });
  const cella = rett(X(19.12), Y(9.6), m(1.26), m(1.3));
  tinta(c, Forme.poligono(cella), pallido('#f3e2cf'));
  for (const xx of [19.32, 19.75]) tinta(c, Forme.poligono(puntiArco(X(xx), Y(9.4), m(0.3), m(0.85))), '#a89abb', 0.55);
  const cuspide = [[X(19.12), Y(9.6)], [X(19.75), Y(12.0)], [X(20.38), Y(9.6)]];
  lava(c, Forme.poligono(cuspide), pallido('#9fc9b8'), [X(19.1), Y(12), m(1.3), m(2.4)], r, { macchie: 1, lb: 1.2 });
  for (const p of [cam, cella, cuspide]) contorno(c, r, p, 0.8, 0.4, 0.4);
  // due file di case: le più lontane (più chiare e più piccole) e quelle oltre la curva del canale
  for (let x = 8; x < 26;) { const w = tra(r, 0.9, 1.6); casetta(F, r, x, 0.7, w, tra(r, 1.6, 3.4), 0.55); x += w; }
  for (const [a, b, y0, hmin, hmax] of [[8, 13.4, -0.2, 3.2, 6.0], [13.4, 20.6, -0.55, 2.2, 3.6], [20.6, 26, -0.2, 3.0, 5.6]]) {
    for (let x = a; x < b - 0.3;) {
      const w = Math.min(tra(r, 1.1, 2.0), b - x);
      casetta(F, r, x, y0, w, tra(r, hmin, hmax), 0.38);
      if (r() < 0.25) ciuffo(c, r, X(x + w), Y(y0 + 1.6), m(0.6), m(0.7), { foglie: 14, verdi: ['#9cc796', '#b2d8a3', '#cbe6b8'] });
      x += w;
    }
  }
  // l'acqua che continua, gli argini e un ponticello ad arco
  const ga = c.createLinearGradient(0, Y(-0.55), 0, Y(ACQUA)); ga.addColorStop(0, '#e6f3f5'); ga.addColorStop(1, '#d0e8f1');
  tinta(c, Forme.poligono(rett(X(12.5), Y(-0.55), X(21.5) - X(12.5), Y(ACQUA) - Y(-0.55))), ga);
  for (let k = 0; k < 8; k++) { const x = tra(r, 13, 20), y = tra(r, -1.35, -0.7); inchiostro(c, mano(r, [[X(x), Y(y)], [X(x + tra(r, 0.6, 1.6)), Y(y)]], false, 0.3), 1.4, 0.7, '#ffffff'); }
  for (const [a, b] of [[8, 12.5], [21.5, 26]]) {
    const arg = rett(X(a), Y(-0.2), X(b) - X(a), Y(ACQUA) - Y(-0.2));
    lava(c, Forme.poligono(arg), pallido('#e9a98c'), [X(a), Y(-0.2), m(b - a), m(1.2)], r, { macchie: 1, lb: 1 });
    contorno(c, r, arg, 0.8, 0.4, 0.4);
  }
  const sopra = [], sotto = [];
  for (let x = 12.2; x <= 21.81; x += 0.12) {
    const t = (x - 12.2) / 9.6;
    sopra.push([X(x), Y(-0.15 + 1.15 * Math.sin(Math.PI * t) + 0.32)]);
    const ta = (x - 17) / 3.9;
    sotto.push([X(x), Y(Math.abs(ta) < 1 ? -0.95 + 1.45 * Math.sqrt(1 - ta * ta) : ACQUA)]);
  }
  const giro = sopra.concat(sotto.slice().reverse());
  lava(c, Forme.poligono(giro), pallido('#ec9f7c'), [X(12.2), Y(1.4), m(9.6), m(2.8)], r, { macchie: 2, lb: 1.2 });
  inchiostro(c, mano(r, sopra.map(([x, y]) => [x, y + m(0.12)]), false, 0.3), m(0.1), 0.7, PIETRA);
  contorno(c, r, giro, 0.9, 0.5, 0.4);
  // foschia luminosa: più si sale, più tutto si scioglie nella carta
  velo(F, 0, F.a, 0, 0, [[0, conAlfa(CARTA, 0.12)], [0.3, conAlfa(CARTA, 0.38)], [1, conAlfa(CARTA, 0.85)]]);
  grana(F, 0.2);
  sfumaBordi(F.tela, F.a * 0.45, ['alto']);
  svanisci(F, 'sinistra', m(1.2)); svanisci(F, 'destra', m(1.2));
}

/* ============================ 12. IN PRIMO PIANO =========================== */

/** Lampione di ghisa con la lanterna e un cestino di fiori. */
function lampione(F, cx) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m, ferro = '#5f858c';
  const pezzi = [
    [[X(cx - 0.15), Y(0)], [X(cx + 0.15), Y(0)], [X(cx + 0.1), Y(0.32)], [X(cx - 0.1), Y(0.32)]],   // basamento
    [[X(cx - 0.045), Y(0.32)], [X(cx + 0.045), Y(0.32)], [X(cx + 0.028), Y(3.6)], [X(cx - 0.028), Y(3.6)]], // fusto
    rett(X(cx - 0.08), Y(1.25), m(0.16), m(0.1)),                                  // anello
    rett(X(cx - 0.13), Y(3.68), m(0.26), m(0.08)),                                 // mensola
  ];
  for (const p of pezzi) { lava(c, Forme.poligono(p), ferro, [X(cx - 0.3), Y(4.6), m(0.6), m(4.6)], r, { macchie: 1, lb: 1.2 }); contorno(c, r, p, 1.1, 0.9, 0.3); }
  const luce = c.createRadialGradient(X(cx), Y(3.95), 0, X(cx), Y(3.95), m(0.6));
  luce.addColorStop(0, 'rgba(255,240,190,0.5)'); luce.addColorStop(1, 'rgba(255,240,190,0)');
  c.fillStyle = luce; c.fillRect(X(cx - 0.6), Y(4.55), m(1.2), m(1.2));
  const vetro = [[X(cx - 0.17), Y(4.25)], [X(cx + 0.17), Y(4.25)], [X(cx + 0.12), Y(3.75)], [X(cx - 0.12), Y(3.75)]];
  tinta(c, Forme.poligono(vetro), '#fdf0c4'); contorno(c, r, vetro, 1.1, 0.9, 0.3);
  inchiostro(c, mano(r, [[X(cx), Y(4.25)], [X(cx), Y(3.75)]], false, 0.3), 1, 0.6);
  const capp = [[X(cx - 0.24), Y(4.25)], [X(cx + 0.24), Y(4.25)], [X(cx + 0.04), Y(4.48)], [X(cx - 0.04), Y(4.48)]];
  lava(c, Forme.poligono(capp), ferro, [X(cx - 0.3), Y(4.5), m(0.6), m(0.3)], r, { macchie: 0, lb: 1 }); contorno(c, r, capp, 1.1, 0.9, 0.3);
  tinta(c, Forme.cerchio(X(cx), Y(4.53), m(0.05)), ferro); inchiostro(c, Forme.cerchio(X(cx), Y(4.53), m(0.05)), 1, 0.9);
  ombraSotto(c, X(cx - 0.12), Y(2.55), m(0.24), m(0.2), 0.2);
  const cesto = [[X(cx - 0.3), Y(2.75)], [X(cx + 0.3), Y(2.75)], [X(cx + 0.18), Y(2.5)], [X(cx - 0.18), Y(2.5)]];
  ciuffo(c, r, X(cx), Y(2.85), m(0.34), m(0.18), { fiori: 9, foglie: 26 });
  lava(c, Forme.poligono(cesto), '#c99868', [X(cx - 0.3), Y(2.75), m(0.6), m(0.25)], r, { macchie: 0, lb: 1 }); contorno(c, r, cesto, 1, 0.85, 0.3);
  for (let k = 0; k < 4; k++) edera(c, r, X(cx - 0.25 + k * 0.16), Y(2.55), m(tra(r, 0.3, 0.7)), m(0.09));
  grana(F, 0.25);
}

/** Paline a strisce nell'acqua, per legare le barche (pali: righe di PALINE). */
function paline(F, pali) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m;
  for (const [x, , alto, colore] of pali) {
    const w = 0.1, fusto = rett(X(x - w), Y(alto), m(2 * w), Y(ACQUA) - Y(alto));
    lava(c, Forme.poligono(fusto), '#fbf6ec', [X(x - w), Y(alto), m(2 * w), m(alto - ACQUA)], r, { macchie: 1, lb: 1 });
    c.save(); c.clip(Forme.poligono(fusto));                 // strisce a spirale
    c.fillStyle = colore;
    for (let y = ACQUA; y < alto; y += 0.36) {
      c.beginPath(); c.moveTo(X(x - w), Y(y)); c.lineTo(X(x + w), Y(y + 0.12)); c.lineTo(X(x + w), Y(y + 0.3)); c.lineTo(X(x - w), Y(y + 0.18)); c.fill();
    }
    const gv = c.createLinearGradient(X(x - w), 0, X(x + w), 0); gv.addColorStop(0, 'rgba(255,255,255,0.25)'); gv.addColorStop(1, conAlfa(OMBRA, 0.3));
    c.fillStyle = gv; c.fillRect(X(x - w), Y(alto), m(2 * w), m(alto - ACQUA));
    const gm = c.createLinearGradient(0, Y(-0.9), 0, Y(ACQUA)); gm.addColorStop(0, 'rgba(90,120,100,0)'); gm.addColorStop(1, 'rgba(90,120,100,0.6)');
    c.fillStyle = gm; c.fillRect(X(x - w), Y(-0.9), m(2 * w), m(0.5));
    c.restore();
    const testa = [[X(x - w * 1.1), Y(alto)], [X(x + w * 1.1), Y(alto)], [X(x + w * 0.5), Y(alto + 0.16)], [X(x - w * 0.5), Y(alto + 0.16)]];
    tinta(c, Forme.poligono(testa), '#e9c46a'); contorno(c, r, testa, 1, 0.85, 0.3);
    contorno(c, r, fusto, 1.2, 0.85, 0.4);
    tinta(c, Forme.poligono(blob(r, X(x), Y(ACQUA) - 2, m(0.2), m(0.05), 8, 0.3), true), '#ffffff', 0.9);
  }
  grana(F, 0.22);
}

/** Vasi di fiori sul selciato. lista: [cx, larghezza, altezza, colore del vaso, tipo] */
function vasi(F, lista) {
  const c = F.c, r = F.rng, X = F.X, Y = F.Y, m = F.m;
  for (const [cx, l, a, col, tipo] of lista) {
    vaso(c, r, X(cx), Y(0), m(l), m(a), col);
    if (tipo === 'alberello') {
      inchiostro(c, mano(r, [[X(cx), Y(a)], [X(cx), Y(a + 0.35)]], false, 0.3), m(0.04), 0.9, '#8a6a4a');
      ciuffo(c, r, X(cx), Y(a + 0.55), m(l * 0.7), m(0.32), { fiori: 7, colori: ['#f6d66b', '#f2b24a'], dimFiore: m(0.035) });
    } else ciuffo(c, r, X(cx), Y(a + 0.18), m(l * 0.62), m(0.24), { fiori: 9, foglie: 34 });
  }
  grana(F, 0.22);
}

/** Fronde che pendono dall'alto (come da un pergolato fuori dal quadro). */
function fronde(F) {
  const c = F.c, r = F.rng, m = F.m;
  for (let k = 0; k < 4; k++) ciuffo(c, r, tra(r, 0.1, 0.9) * F.l, m(0.12), m(tra(r, 0.4, 0.7)), m(0.3), { foglie: 30, verdi: ['#3f7a4a', '#5f9a55', '#8cc06c'] });
  for (let k = 0; k < 16; k++) edera(c, r, tra(r, 0.05, 0.95) * F.l, m(0.15), m(tra(r, 0.4, 1.7)), m(0.13));
  for (let k = 0; k < 8; k++) fiore(c, r() * F.l, m(tra(r, 0.1, 0.6)), m(0.05), scegli(r, ['#ffffff', '#f7a8c4', '#c9a8e8']));
  grana(F, 0.2);
  sfumaBordi(F.tela, m(0.2), ['alto']);
}

/* ============================== 13. LA SCENA =============================== */

/**
 * Dipinge la scena richiesta. Per nome === 'canale' restituisce { strati: [...] }
 * (ogni strato: { nome, tela, normale, x, y, z, larghezza, altezza | profondita, ... }).
 */
export async function dipingiScena(nome) {
  if (nome !== 'canale') return { strati: [] };
  const strati = [], aggiungi = async (s) => { strati.push(s); await respira(); };
  const filaSx = caseCanale(301, -40, -3), filaDx = caseCanale(302, -40, -3);
  const segni = segniAcqua();

  // --- il fondo: veduta lontana, case lungo il canale, fondamenta ---
  let F = foglio(8, 26, ACQUA, 14, 48, 401); lontano(F);
  await aggiungi(strato('canale_lontano', F, 'z+', 8, ACQUA, -40, 18, 14 - ACQUA, { ordine: -3 }));
  F = foglio(-40, -3, 0, 11, 52, 402, { specchio: true }); filaCanale(F, filaSx);
  await aggiungi(strato('canale_case_sinistra', F, 'x+', 10, 0, -40, 37, 11, { ordine: -2 }));
  F = foglio(-40, -3, 0, 11, 52, 403); filaCanale(F, filaDx);
  await aggiungi(strato('canale_case_destra', F, 'x-', 24, 0, -40, 37, 11, { ordine: -2 }));
  F = foglio(10, 12.5, -40, -2.5, 48, 404, { pavimento: true }); fondamenta(F, 10, 12.5);
  await aggiungi(strato('fondamenta_sinistra', F, 'su', 10, 0, -40, 2.5, 37.5, { ordine: -1 }));
  F = foglio(21.5, 24, -40, -2.5, 48, 405, { pavimento: true }); fondamenta(F, 24, 21.5);
  await aggiungi(strato('fondamenta_destra', F, 'su', 21.5, 0, -40, 2.5, 37.5, { ordine: -1 }));

  // --- l'acqua (vicina e lontana) e gli argini ---
  F = foglio(12.5, 21.5, -40, -12, 32, 406, { pavimento: true }); acquaCanale(F, -40, -12, segni, filaSx, filaDx);
  await aggiungi(strato('acqua_lontana', F, 'su', 12.5, ACQUA, -40, 9, 28, { acqua: true, ordine: -4 }));
  F = foglio(12.5, 21.5, -12, 8, 64, 407, { pavimento: true }); acquaCanale(F, -12, 8, segni, filaSx, filaDx);
  await aggiungi(strato('acqua_vicina', F, 'su', 12.5, ACQUA, -12, 9, 20, { acqua: true, ordine: -4 }));
  for (const [z0, z1, ppu] of [[-40, -12, 32], [-12, 8, 64]]) {
    F = foglio(z0, z1, ACQUA, 0, ppu, 410 + z0, { specchio: true }); argine(F, z0, z1, 1.7);
    await aggiungi(strato('argine_sinistro' + (z0 < -12 ? '_lontano' : ''), F, 'x+', 12.5, ACQUA, z0, z1 - z0, -ACQUA, { ordine: -1 }));
    F = foglio(z0, z1, ACQUA, 0, ppu, 420 + z0); argine(F, z0, z1, 4.3);
    await aggiungi(strato('argine_destro' + (z0 < -12 ? '_lontano' : ''), F, 'x-', 21.5, ACQUA, z0, z1 - z0, -ACQUA, { ordine: -1 }));
  }

  // --- la via: selciato e facciate ---
  F = foglio(-4, 12.5, -2.5, 5, 80, 430, { pavimento: true }); strada(F, -4, 12.5, 12.5);
  svanisci(F, 'sinistra', F.m(1.3)); svanisci(F, 'basso', F.m(0.6));
  await aggiungi(strato('strada_sinistra', F, 'su', -4, 0, -2.5, 16.5, 7.5, { ordine: 0 }));
  F = foglio(21.5, 44, -2.5, 5, 80, 431, { pavimento: true });
  strada(F, 21.5, 44, 21.5, (G) => {
    const gs = G.c.createLinearGradient(0, G.Y(0.7), 0, G.Y(1.5));                  // ombra della scala
    gs.addColorStop(0, conAlfa(OMBRA, 0.3)); gs.addColorStop(1, conAlfa(OMBRA, 0));
    G.c.fillStyle = gs; G.c.fillRect(G.X(37.2), G.Y(0.7), G.X(41.5) - G.X(37.2), G.m(0.8));
  });
  svanisci(F, 'destra', F.m(1.0)); svanisci(F, 'basso', F.m(0.6));
  await aggiungi(strato('strada_destra', F, 'su', 21.5, 0, -2.5, 22.5, 7.5, { ordine: 0 }));
  F = facciataSinistra();
  await aggiungi(strato('facciate_sinistra', F, 'z+', -4, 0, -2.5, 16.5, 12, { ordine: 0 }));
  F = facciataDestra();
  await aggiungi(strato('facciate_destra', F, 'z+', 21.5, 0, -2.5, 22.5, 12, { ordine: 0 }));

  // --- il ponte (dietro e davanti) e la scalinata ---
  F = foglio(11.5, 22.5, ACQUA, 2.6, 96, 440); ponte(F, true);
  await aggiungi(strato('ponte_retro', F, 'z+', 11.5, ACQUA, -0.7, 11, 2.6 - ACQUA, { ordine: 1 }));
  F = foglio(11.5, 22.5, ACQUA, 2.6, 128, 441); ponte(F, false);
  await aggiungi(strato('ponte_fronte', F, 'z+', 11.5, ACQUA, 0.7, 11, 2.6 - ACQUA, { ordine: 2 }));
  F = foglio(36.5, 41.5, 0, 3.6, 112, 442); scala(F);
  await aggiungi(strato('scalinata', F, 'z+', 36.5, 0, 0.7, 5, 3.6, { ordine: 2 }));

  // --- primo piano, radi: lampione, paline, vasi, fronde che pendono ---
  F = foglio(3.1, 4.3, 0, 4.7, 96, 450); lampione(F, 3.7);
  await aggiungi(strato('pp_lampione', F, 'z+', 3.1, 0, 4.2, 1.2, 4.7, { ordine: 4 }));
  F = foglio(5.6, 8.4, 2.3, 4.4, 96, 451); fronde(F);
  await aggiungi(strato('pp_fronde_1', F, 'z+', 5.6, 2.3, 4.6, 2.8, 2.1, { ordine: 5, tremola: 0.6 }));
  F = foglio(9.0, 10.8, 0, 1.8, 96, 452); vasi(F, [[9.45, 0.5, 0.45, '#d9825b'], [10.25, 0.6, 0.55, '#7fa7d6', 'alberello']]);
  await aggiungi(strato('pp_vasi_ponte', F, 'z+', 9.0, 0, 3.9, 1.8, 1.8, { ordine: 4, tremola: 0.2 }));
  F = foglio(12.6, 13.45, ACQUA, 2.7, 96, 453); paline(F, PALINE.slice(0, 2));
  await aggiungi(strato('pp_paline_sinistra', F, 'z+', 12.6, ACQUA, 3.6, 0.85, 2.7 - ACQUA, { ordine: 3 }));
  F = foglio(20.35, 21.2, ACQUA, 2.7, 96, 454); paline(F, PALINE.slice(2));
  await aggiungi(strato('pp_paline_destra', F, 'z+', 20.35, ACQUA, 4.3, 0.85, 2.7 - ACQUA, { ordine: 3 }));
  F = foglio(31.2, 34.2, 2.5, 4.4, 96, 455); fronde(F);
  await aggiungi(strato('pp_fronde_2', F, 'z+', 31.2, 2.5, 4.8, 3, 1.9, { ordine: 5, tremola: 0.6 }));
  F = foglio(35.2, 36.8, 0, 1.3, 96, 456); vasi(F, [[35.6, 0.55, 0.5, '#d9825b'], [36.35, 0.42, 0.36, '#e0a070']]);
  await aggiungi(strato('pp_vasi_scala', F, 'z+', 35.2, 0, 4.0, 1.6, 1.3, { ordine: 4, tremola: 0.2 }));
  return { strati };
}
