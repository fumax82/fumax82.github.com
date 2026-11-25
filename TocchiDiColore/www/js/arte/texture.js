/* ==========================================================================
 *  texture.js — MURI E PAVIMENTI DIPINTI AD ACQUERELLO
 *  --------------------------------------------------------------------------
 *  Il codice dipinge le "carte da parati" del mondo 3D: facciate, negozi,
 *  staccionate, siepi, pareti interne e pavimenti.
 *
 *  Ogni texture ha DUE tele della stessa misura:
 *    - colore:     il dipinto completo (acquerello + linee a inchiostro)
 *    - inchiostro: SOLO le linee seppia su fondo trasparente (il "disegno a
 *                  matita" dove la bambina non ha ancora sentito il mondo)
 *
 *  Misure: 256 pixel = 1 unità del mondo.
 *    MURI:      256 × (256 × altezza). Ogni muro è UNA cella che si ripete
 *               in orizzontale senza cuciture.
 *    PAVIMENTI: 256 × 256, ripetibili in tutte e due le direzioni.
 *
 *  Il trucco contro le cuciture: ciò che sborda da un lato della tela viene
 *  ridisegnato anche dal lato opposto (funzione "ripeti").
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa, percorso,
  Forme, trama, tinta, linea, acquerello, velatura, fogliame, fiorellini, respira,
} from './pennello.js';
const U = 256;                                              // pixel per 1 unità del mondo
const OMBRA = '#5d4b7c';                                    // ombre viola, mai nere
const VIRATE = ['#f3c46a', '#e8747c', '#86a9d6', '#9cc58a']; // tinte vicine per variare il pigmento
const LIBRI = ['#e0605a', '#f09a4a', '#f3d06a', '#7fbf7a', '#5ea3d6', '#9a80d0',
  '#e889b0', '#4fb3a9', '#f6efe0', '#c9584e', '#6c8fd8', '#f2b880'];

/* ===================== 1. IL QUADRO E LA RIPETIZIONE ===================== */

/** Prepara un "quadro": tela del colore (carta) + tela dell'inchiostro (trasparente). */
function nuovoQuadro(l, a, seme, avvolgiY) {
  const colore = nuovaTela(l, a), inchiostro = nuovaTela(l, a);
  const Q = { colore, inchiostro, c: colore.getContext('2d'), k: inchiostro.getContext('2d'), l, a, seme, rng: casuale(seme), avvolgiY };
  Q.c.fillStyle = STILE.carta; Q.c.fillRect(0, 0, l, a);
  return Q;
}
const seme = (Q) => Math.floor(Q.rng() * 1e6) + 1;                 // un nuovo seme dal caso del quadro
const scegli = (r, elenco) => elenco[Math.floor(r() * elenco.length)]; // un elemento a caso
/** Aggiunge le tappe di colore a una sfumatura: sfuma(g, [0, 'red'], [1, 'blue']). */
function sfuma(g, ...tappe) { for (const [t, col] of tappe) g.addColorStop(t, col); return g; }
/** Le "copie" di ciò che sborda dalla scatola [x0,y0,x1,y1]: a destra → anche a sinistra (e nei pavimenti sopra/sotto). */
function copie(Q, x0, y0, x1, y1) {
  const dx = [0], dy = [0], out = [];
  if (x0 < 0) dx.push(Q.l); if (x1 > Q.l) dx.push(-Q.l);
  if (Q.avvolgiY) { if (y0 < 0) dy.push(Q.a); if (y1 > Q.a) dy.push(-Q.a); }
  for (const a of dx) for (const b of dy) out.push([a, b]);
  return out;
}
/** Disegna spostando entrambe le tele di (dx, dy). */
function sposta(Q, dx, dy, disegna) {
  Q.c.save(); Q.k.save(); Q.c.translate(dx, dy); Q.k.translate(dx, dy);
  disegna(); Q.c.restore(); Q.k.restore();
}
/** Esegue "disegna" una volta per ogni copia necessaria. */
function ripeti(Q, x0, y0, x1, y1, disegna) {
  for (const [dx, dy] of copie(Q, x0, y0, x1, y1)) sposta(Q, dx, dy, disegna);
}
/** Limita il disegno (su entrambe le tele) dentro una forma; "rilascia" toglie il limite. */
function ritaglia(Q, forma) {
  const p = percorso(forma);
  Q.c.save(); Q.k.save(); Q.c.clip(p); Q.k.clip(p);
}
function rilascia(Q) { Q.c.restore(); Q.k.restore(); }

/* ======================== 2. INCHIOSTRO A MANO ========================== */

/** Spezzata "a mano": i punti tremano un poco, come una penna vera. */
function mano(r, punti, chiuso, t, p) {
  p = p || new Path2D(); t = t === undefined ? 0.6 : t;
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
function rettMano(r, x, y, l, a, t, p) {
  p = p || new Path2D();
  const e = () => tra(r, -0.3, 2);
  mano(r, [[x - e(), y], [x + l + e(), y]], false, t, p);
  mano(r, [[x + l, y - e()], [x + l, y + a + e()]], false, t, p);
  mano(r, [[x + l + e(), y + a], [x - e(), y + a]], false, t, p);
  return mano(r, [[x, y + a + e()], [x, y - e()]], false, t, p);
}
/** Riga lunga quanto la tela (orizzontale o verticale); il tremolio "periodico" finisce come comincia. */
function riga(Q, pos, amp, p, verticale) {
  p = p || new Path2D();
  const r = Q.rng, L = verticale ? Q.a : Q.l, k = 2 * Math.PI / L;
  const f1 = 1 + Math.floor(r() * 2), f2 = 3 + Math.floor(r() * 4), a1 = r() * 7, a2 = r() * 7;
  amp = amp === undefined ? 0.7 : amp;
  for (let s = -8; s <= L + 8; s += 4) {
    const d = pos + amp * (0.6 * Math.sin(k * f1 * s + a1) + 0.4 * Math.sin(k * f2 * s + a2));
    const [x, y] = verticale ? [d, s] : [s, d];
    if (s === -8) p.moveTo(x, y); else p.lineTo(x, y);
  }
  return p;
}
/** Linea seppia su ENTRAMBE le tele. */
function inchiostra(Q, forma, spessore, alfa) {
  const p = percorso(forma), o = { spessore: spessore || 1.4, alfa: alfa === undefined ? 0.9 : alfa };
  linea(Q.c, p, o); linea(Q.k, p, o);
}
/** Cancella l'inchiostro già tracciato sotto una forma opaca (lo schizzo non mostra ciò che è coperto). */
function copri(Q, forma) { Q.k.save(); Q.k.globalCompositeOperation = 'destination-out'; Q.k.fill(percorso(forma)); Q.k.restore(); }
/** Linea seppia solo sulla tela dell'inchiostro (contorni di fogliame e fiamme). */
const schizzo = (Q, forma, spessore, alfa) => linea(Q.k, forma, { spessore: spessore || 1, alfa: alfa === undefined ? 0.75 : alfa });
/** Scritta su un'insegna: riempita di colore e ripassata a inchiostro. */
function scritta(Q, testo, x, y, dim, colore, stile) {
  for (const ctx of [Q.c, Q.k]) {
    ctx.save();
    ctx.font = (stile || 'bold') + ' ' + dim + 'px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (ctx === Q.c) { ctx.fillStyle = colore; ctx.fillText(testo, x, y); }
    ctx.lineWidth = 0.9; ctx.strokeStyle = STILE.inchiostro; ctx.strokeText(testo, x, y);
    ctx.restore();
  }
}

/* ========================= 3. FORME E ACQUERELLO ========================= */

/** Punti attorno a un'ellisse un po' storta (macchie, cespugli). */
function blob(r, cx, cy, rx, ry, n, irr) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = 1 + tra(r, -irr, irr);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}
/** Contorno "a nuvoletta" (per schizzare chiome e cespugli). */
function nuvola(r, cx, cy, rx, ry, n) {
  const pts = blob(r, cx, cy, rx, ry, n, 0.12), p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    p.quadraticCurveTo(cx + (mx - cx) * 1.3, cy + (my - cy) * 1.3, b[0], b[1]);
  }
  return p;
}
/** Punti di un mattone / piastrella: rettangolo con gli angoli smussati. */
function puntiMattone(r, x, y, l, a, t) {
  const q = Math.min(l, a) * (t === undefined ? 0.25 : t), j = () => tra(r, -0.8, 0.8);
  return [[x + q, y + j()], [x + l - q, y + j()], [x + l + j(), y + q], [x + l + j(), y + a - q],
    [x + l - q, y + a + j()], [x + q, y + a + j()], [x + j(), y + a - q], [x + j(), y + q]];
}
/** Punti di un sasso "a cuscino": un'ellisse squadrata (superellisse) un po' storta. */
function puntiSasso(r, cx, cy, rx, ry) {
  const pts = [], pot = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.6);
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2 + tra(r, -0.12, 0.12), k = 1 + tra(r, -0.08, 0.06);
    pts.push([cx + rx * k * pot(Math.cos(t)), cy + ry * k * pot(Math.sin(t))]);
  }
  return pts;
}
const puntiRett = (x, y, l, a) => [[x, y], [x + l, y], [x + l, y + a], [x, y + a]];
/** Rettangolo con la cima ad arco (finestre, porte, forno). */
function puntiArco(x, y, l, a) {
  const r = l / 2, pts = [[x, y + a], [x, y + r]];
  for (let g = 195; g < 360; g += 15) pts.push([x + r + Math.cos(g * Math.PI / 180) * r, y + r + Math.sin(g * Math.PI / 180) * r]);
  pts.push([x + l, y + r], [x + l, y + a]);
  return pts;
}
/** Macchia d'acquerello "economica": stesura + bordo più scuro dove il colore si asciuga. */
function macchia(ctx, forma, colore, alfa, bordo, lb) {
  const p = percorso(forma);
  ctx.save(); ctx.globalAlpha = alfa === undefined ? 0.94 : alfa; ctx.fillStyle = colore;
  ctx.fill(p);
  if (bordo !== 0) {
    ctx.clip(p); ctx.globalAlpha = bordo === undefined ? 0.35 : bordo; ctx.strokeStyle = scurisci(colore, 0.3);
    ctx.lineWidth = (lb || 2.5) * 2; ctx.stroke(p);
  }
  ctx.restore();
}
/** Volume: chiaro in alto a sinistra, ombra viola in basso a destra. */
function volume(ctx, forma, x, y, l, a, forza) {
  const f = forza === undefined ? 1 : forza;
  ctx.save(); ctx.clip(percorso(forma));
  ctx.fillStyle = sfuma(ctx.createLinearGradient(x, y, x + l * 0.4, y + a),
    [0, 'rgba(255,252,240,' + 0.45 * f + ')'], [0.5, 'rgba(255,252,240,0)'], [1, conAlfa(OMBRA, 0.28 * f)]);
  ctx.fillRect(x, y, l, a); ctx.restore();
}
/** Volume di un sasso: lucido in alto a sinistra, ombra sul bordo in basso. */
function volumeTondo(ctx, forma, cx, cy, rx, ry) {
  ctx.save(); ctx.clip(percorso(forma)); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  ctx.fillStyle = sfuma(ctx.createRadialGradient(-rx * 0.3, -rx * 0.35, 0, -rx * 0.1, -rx * 0.1, rx * 1.25),
    [0, 'rgba(255,252,240,0.55)'], [0.45, 'rgba(255,252,240,0)'], [0.75, conAlfa(OMBRA, 0.08)], [1, conAlfa(OMBRA, 0.4)]);
  ctx.fillRect(-rx * 1.5, -rx * 1.5, rx * 3, rx * 3); ctx.restore();
}
/** Ombra viola che sfuma verso il basso (sotto cornici, davanzali, tende). */
function ombraSotto(c, x, y, l, h, alfa) {
  c.save();
  c.fillStyle = sfuma(c.createLinearGradient(0, y, 0, y + h), [0, conAlfa(OMBRA, alfa)], [1, conAlfa(OMBRA, 0)]);
  c.fillRect(x, y, l, h); c.restore();
}
/** Bagliore caldo di una lampada o del fuoco (si somma alla luce, senza cuciture). */
function bagliore(Q, x, y, raggio, colore, alfa) {
  const c = Q.c;
  for (const [dx, dy] of copie(Q, x - raggio, y - raggio, x + raggio, y + raggio)) {
    c.save(); c.globalCompositeOperation = 'lighter';
    c.fillStyle = sfuma(c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, raggio), [0, conAlfa(colore, alfa)], [1, conAlfa(colore, 0)]);
    c.fillRect(x + dx - raggio, y + dy - raggio, raggio * 2, raggio * 2); c.restore();
  }
}
/** LAVAGGIO: la stesura di fondo (intonaco, asfalto, acqua, erba...). Ciò che sborda viene ripetuto. */
function lavaggio(Q, x, y, l, a, colore, o = {}) {
  const c = Q.c, r = casuale(o.seme || Q.seme * 31 + Math.round(y) * 7 + 1), v = o.variazione === undefined ? 0.22 : o.variazione;
  c.save(); c.beginPath(); c.rect(x, y, l, a); c.clip();
  c.fillStyle = colore; c.fillRect(x, y, l, a);
  // a) pennellate orizzontali larghe come tutta la tela
  for (let i = 0; i < 2 + a / 70; i++) {
    const yy = y + r() * a, h = tra(r, 30, 110), tono = r() < 0.5 ? schiarisci(colore, 0.35) : scurisci(colore, 0.12);
    for (const [, dy] of copie(Q, 0, yy - h / 2, 1, yy + h / 2)) {
      c.fillStyle = sfuma(c.createLinearGradient(0, yy + dy - h / 2, 0, yy + dy + h / 2), [0, conAlfa(tono, 0)], [0.5, conAlfa(tono, v * 0.7)], [1, conAlfa(tono, 0)]);
      c.fillRect(x, yy + dy - h / 2, l, h);
    }
  }
  // b) macchie rotonde di pigmento: più chiare, più scure o di una tinta vicina
  const n = o.macchie === undefined ? Math.round((l * a) / 5000) + 3 : o.macchie;
  for (let i = 0; i < n; i++) {
    const cx = x + r() * l, cy = y + r() * a, rr = tra(r, 20, 80), q = r();
    const tono = q < 0.45 ? schiarisci(colore, 0.4) : q < 0.75 ? scurisci(colore, 0.2) : mescola(colore, scegli(r, VIRATE), 0.35);
    const alfa = v * tra(r, 0.6, 1.3);
    for (const [dx, dy] of copie(Q, cx - rr, cy - rr, cx + rr, cy + rr)) {
      c.fillStyle = sfuma(c.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, rr), [0, conAlfa(tono, alfa)], [1, conAlfa(tono, 0)]);
      c.fillRect(cx + dx - rr, cy + dy - rr, rr * 2, rr * 2);
    }
  }
  // c) fioriture: aloni chiari con il bordino più scuro (l'acqua che torna indietro)
  const nf = o.fioriture === undefined ? Math.round((l * a) / 16000) : o.fioriture;
  for (let i = 0; i < nf; i++) {
    const cx = x + r() * l, cy = y + r() * a, rr = tra(r, 12, 40);
    const forma = Forme.poligono(blob(r, cx, cy, rr, rr * tra(r, 0.5, 1), 9, 0.3), true);
    for (const [dx, dy] of copie(Q, cx - rr, cy - rr, cx + rr, cy + rr)) {
      c.save(); c.translate(dx, dy);
      c.globalAlpha = 0.14; c.fillStyle = schiarisci(colore, 0.5); c.fill(forma);
      c.globalAlpha = 0.2; c.lineWidth = 1.8; c.strokeStyle = scurisci(colore, 0.3); c.stroke(forma);
      c.restore();
    }
  }
  // d) colature verticali (solo sui muri): il colore scivola giù
  for (let i = 0; !Q.avvolgiY && i < (o.colature === undefined ? Math.round(l / 50) : o.colature); i++) {
    const cx = x + r() * l, w = tra(r, 6, 22), y0 = y + r() * a * 0.8, h = tra(r, 60, 220);
    const tono = r() < 0.6 ? scurisci(colore, 0.18) : schiarisci(colore, 0.4);
    for (const [dx] of copie(Q, cx - w, 0, cx + w, 1)) {
      c.fillStyle = sfuma(c.createLinearGradient(0, y0, 0, y0 + h), [0, conAlfa(tono, 0)], [0.3, conAlfa(tono, v * 0.6)], [1, conAlfa(tono, 0)]);
      c.beginPath(); c.ellipse(cx + dx, y0 + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); c.fill();
    }
  }
  // e) luce calda dall'alto
  if (o.luce !== false) velatura(c, x, y, l, a, ['rgba(255,250,232,0.3)', 'rgba(255,250,232,0)', 'rgba(255,250,232,0)']);
  c.restore();
}
/** Lavaggio "piatto" per fasce e bordi: poca variazione, niente luce né fioriture. */
const fascetta = (Q, y, h, colore, v) => lavaggio(Q, 0, y, Q.l, h, colore, { variazione: v || 0.12, luce: false, fioriture: 0, macchie: 4, colature: 0 });
/** La grana della carta su tutto il dipinto (le trame si ripetono ogni 256 px). */
function carta(Q) {
  const c = Q.c;
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.3;
  c.fillStyle = c.createPattern(trama('grana'), 'repeat'); c.fillRect(0, 0, Q.l, Q.a); c.globalAlpha = 0.1;
  c.fillStyle = c.createPattern(trama('macchie'), 'repeat'); c.fillRect(0, 0, Q.l, Q.a); c.restore();
}
/** Acquerello di pennello.js con i valori più usati qui. */
function aq(Q, forma, colore, x, y, l, a, extra) {
  acquerello(Q.c, forma, colore, Object.assign({ area: [x - 4, y - 4, l + 8, a + 8], seme: seme(Q),
    variazione: 0.14, bordo: 0.32, larghezzaBordo: 3, granulosita: 0.1 }, extra));
}
/** Acquerello + contorno a mano di un rettangolo (davanzali, gradini, insegne...). */
function blocco(Q, x, y, l, a, colore, extra, spessore) {
  aq(Q, Forme.rettangolo(x, y, l, a, 2), colore, x, y, l, a, extra);
  inchiostra(Q, rettMano(Q.rng, x, y, l, a, 0.4), spessore || 1.4);
}

/* ===================== 4. ARCHITETTURA: FACCIATE ======================== */

/** Cornicione in cima al muro: modanatura chiara e fila di dentelli. */
function cornicione(Q, h, coloreMuro, colore) {
  const c = Q.c, r = Q.rng, chiaro = colore || schiarisci(coloreMuro, 0.62), y1 = h * 0.42, y2 = h * 0.8;
  fascetta(Q, 0, h, chiaro);
  c.save(); c.globalAlpha = 0.8; c.fillStyle = scurisci(coloreMuro, 0.12); c.fillRect(0, y1, Q.l, y2 - y1); c.restore();
  ombraSotto(c, 0, y1, Q.l, 7, 0.4);
  const p = riga(Q, y1, 0.5);
  riga(Q, y2, 0.5, p); riga(Q, h, 0.6, p); riga(Q, h * 0.16, 0.4, p);
  for (let x = 4; x < Q.l; x += 16) {
    tinta(c, Forme.rettangolo(x, y1 + 2, 9, y2 - y1 - 3), chiaro, 0.95);
    rettMano(r, x, y1 + 2, 9, y2 - y1 - 3, 0.3, p);
  }
  inchiostra(Q, p, 1.2, 0.85); ombraSotto(c, 0, h, Q.l, 16, 0.3);
}
/** Fascia marcapiano tra i due piani: blocchi di pietra chiara. */
function fascia(Q, y, h, colore) {
  const r = Q.rng, p = riga(Q, y, 0.6);
  fascetta(Q, y, h, colore); riga(Q, y + h, 0.6, p);
  for (let x = 16; x < Q.l; x += 32) {
    tinta(Q.c, Forme.rettangolo(x + 2, y + 2, 28, h - 4), r() < 0.5 ? '#ffffff' : scurisci(colore, 0.15), 0.18);
    mano(r, [[x + tra(r, -1, 1), y + 1], [x + tra(r, -1, 1), y + h - 1]], false, 0.3, p);
  }
  ombraSotto(Q.c, 0, y + h, Q.l, 12, 0.3); inchiostra(Q, p, 1.2, 0.85);
}
/** Zoccolo in fondo al muro, con la terra che schizza in basso. */
function zoccolo(Q, h, colore) {
  const c = Q.c, r = Q.rng, y = Q.a - h;
  lavaggio(Q, 0, y, Q.l, h, colore, { variazione: 0.22, luce: false, fioriture: 1, colature: 0 });
  c.save(); c.globalAlpha = 0.85; c.fillStyle = schiarisci(colore, 0.4); c.fillRect(0, y, Q.l, 7); c.restore();
  ombraSotto(c, 0, y + 7, Q.l, 7, 0.3);
  velatura(c, 0, Q.a - 24, Q.l, 24, ['rgba(110,80,90,0)', 'rgba(110,80,90,0.22)']);
  const p = riga(Q, y, 0.6);
  riga(Q, y + 7, 0.5, p);
  for (const x of [64, 192]) mano(r, [[x + tra(r, -3, 3), y + 8], [x + tra(r, -3, 3), Q.a + 2]], false, 0.5, p);
  inchiostra(Q, p, 1.3, 0.85);
}
/** Gronda di tegole (coppi) in cima alla casa rosa. */
function gronda(Q, h, colore) {
  const c = Q.c, r = Q.rng, n = 12, lt = Q.l / n, rr = lt / 2 - 1, a = h * 0.5, yg = h * 0.86;
  fascetta(Q, 0, h, scurisci(colore, 0.3), 0.2);
  for (let fila = 0; fila < 2; fila++) {
    const y = fila ? h * 0.36 : -4, off = fila ? lt / 2 : 0;
    for (let i = 0; i < n; i++) {
      const x = off + i * lt, p = new Path2D(), col = mescola(colore, scegli(r, ['#ee9a6c', '#c45f3f', '#e27d55']), r() * 0.6);
      p.moveTo(x + 1, y); p.lineTo(x + lt - 1, y); p.lineTo(x + lt - 1, y + a - rr);
      p.arc(x + lt / 2, y + a - rr, rr, 0, Math.PI); p.closePath();
      ripeti(Q, x, y, x + lt, y + a, () => { macchia(c, p, col, 1, 0.3, 2); volume(c, p, x, y, lt, a, 0.8); inchiostra(Q, p, 1, 0.8); });
    }
  }
  fascetta(Q, yg, h - yg, '#e9e4dc', 0.1);                  // il canale della grondaia
  inchiostra(Q, riga(Q, h, 0.5, riga(Q, yg, 0.5)), 1.3); ombraSotto(c, 0, h, Q.l, 22, 0.35);
}
/** Facciata standard: intonaco, cornicione (o gronda), marcapiano, zoccolo. */
function facciata(Q, colore, o = {}) {
  lavaggio(Q, 0, 0, Q.l, Q.a, colore, { variazione: o.variazione || 0.3 });
  if (o.gronda) gronda(Q, 62, o.gronda); else cornicione(Q, 42, colore, o.cornice);
  if (o.fascia) fascia(Q, o.fascia, 22, schiarisci(colore, 0.55));
  if (o.zoccolo !== false) zoccolo(Q, 54, o.coloreZoccolo || mescola(scurisci(colore, 0.15), '#b0a8aa', 0.4));
}

/* ================== 5. FINESTRE, PORTE E ALTRI DETTAGLI ================== */

/** VETRO: azzurro sfumato con due riflessi diagonali. "interno" disegna ciò che si vede dentro. */
function vetro(Q, forma, x, y, l, a, colore, interno) {
  const c = Q.c;
  ritaglia(Q, forma);
  c.fillStyle = sfuma(c.createLinearGradient(x, y, x + l * 0.3, y + a), [0, mescola(colore, '#5f6f9a', 0.35)], [0.55, colore], [1, schiarisci(colore, 0.5)]);
  c.fillRect(x - 2, y - 2, l + 4, a + 4);
  if (interno) interno(Q, x, y, l, a);
  c.globalAlpha = interno ? 0.22 : 0.5; c.strokeStyle = '#ffffff';
  for (const [f, w] of [[0.3, 0.2], [0.62, 0.07]]) {
    c.lineWidth = Math.max(2, l * w);
    c.beginPath(); c.moveTo(x + l * f + a * 0.3, y - 4); c.lineTo(x + l * f - a * 0.3, y + a + 4); c.stroke();
  }
  rilascia(Q);
}
/** Persiana di legno a stecche orizzontali. */
function persiana(Q, x, y, l, a, colore) {
  const r = Q.rng, st = new Path2D();
  copri(Q, Forme.rettangolo(x, y, l, a));
  aq(Q, Forme.rettangolo(x, y, l, a, 1), colore, x, y, l, a, { variazione: 0.2, bordo: 0.4, granulosita: 0.15, luce: 'alto' });
  for (let yy = y + 11; yy < y + a - 6; yy += 7) mano(r, [[x + 4, yy], [x + l - 4, yy]], false, 0.25, st);
  linea(Q.c, st, { colore: scurisci(colore, 0.35), spessore: 2.4, alfa: 0.3 }); inchiostra(Q, st, 0.7, 0.6);
  inchiostra(Q, rettMano(r, x + 4, y + 4, l - 8, a - 8, 0.3, rettMano(r, x, y, l, a, 0.4)), 1.3);
}
/** Davanzale di pietra con la sua ombra. */
function davanzale(Q, x, y, l, h, colore) {
  ombraSotto(Q.c, x + 3, y + h, l - 2, 12, 0.32);
  blocco(Q, x, y, l, h, colore, { bordo: 0.3, larghezzaBordo: 2 });
}
/**
 * FINESTRA: telaio, vetri, traversine, davanzale.
 * o: { telaio, vetro, arco, colonne, righe, persiane (colore), chiusa (persiane chiuse),
 *      fioriera (colori dei fiori), cassetta, spessore, davanzale, chiave, interno }
 */
function finestra(Q, cx, y, l, a, o = {}) {
  const c = Q.c, r = Q.rng, x = cx - l / 2, s = o.spessore || 8, telaio = o.telaio || '#fbf6ec', P = o.arco ? puntiArco : puntiRett;
  if (o.persiane) { persiana(Q, x - l / 2 - 3, y, l / 2, a, o.persiane); persiana(Q, x + l + 3, y, l / 2, a, o.persiane); }
  const pt = P(x, y, l, a), pv = P(x + s, y + s, l - 2 * s, a - 2 * s);
  const vx = x + s, vy = y + s, vl = l - 2 * s, va = a - 2 * s, gv = Forme.poligono(pv);
  tinta(c, Forme.poligono(pt.map(([px, py]) => [px + 5, py + 6])), OMBRA, 0.22); copri(Q, Forme.poligono(pt));
  aq(Q, Forme.poligono(pt), telaio, x, y, l, a, { variazione: 0.1, bordo: 0.28, granulosita: 0.08 });
  if (o.chiusa) {
    persiana(Q, vx, vy, vl / 2, va, o.chiusa); persiana(Q, vx + vl / 2, vy, vl / 2, va, o.chiusa);
  } else {
    vetro(Q, gv, vx, vy, vl, va, o.vetro || '#9fc6e4', o.interno);
    ritaglia(Q, gv);                                          // traversine
    const b = Math.max(3, s * 0.5), col = o.colonne || 2, rig = o.righe || 2, ra = o.arco ? vl / 2 : 0, p = new Path2D();
    const barra = (bx, by, bl, ba) => { tinta(c, Forme.rettangolo(bx, by, bl, ba), telaio); rettMano(r, bx, by, bl, ba, 0.3, p); };
    for (let i = 1; i < col; i++) barra(vx + (vl * i) / col - b / 2, vy - 2, b, va + 4);
    for (let j = o.arco ? 0 : 1; j < rig; j++) barra(vx - 2, vy + ra + ((va - ra) * j) / rig - b / 2, vl + 4, b);
    for (const f of o.arco ? [0.25, 0.75] : []) {             // raggi nella lunetta
      const ex = cx + Math.cos(Math.PI * (1 + f)) * ra * 1.2, ey = vy + ra + Math.sin(Math.PI * (1 + f)) * ra * 1.2;
      c.save(); c.strokeStyle = telaio; c.lineWidth = b; c.beginPath(); c.moveTo(cx, vy + ra); c.lineTo(ex, ey); c.stroke(); c.restore();
      mano(r, [[cx, vy + ra], [ex, ey]], false, 0.3, p);
    }
    inchiostra(Q, p, 1, 0.8); rilascia(Q);
  }
  inchiostra(Q, mano(r, pt, true, o.arco ? 0.3 : 0.55), 1.7);
  inchiostra(Q, mano(r, pv, true, o.arco ? 0.25 : 0.35), 1.1, 0.8);
  if (o.arco && o.chiave) {                                   // la chiave di volta in cima all'arco
    const ch = [[cx - 8, y - 6], [cx + 8, y - 6], [cx + 5, y + 10], [cx - 5, y + 10]];
    aq(Q, Forme.poligono(ch), o.chiave, cx - 8, y - 6, 16, 16, { bordo: 0.3, larghezzaBordo: 2 });
    inchiostra(Q, mano(r, ch, true, 0.3), 1.3);
  }
  if (o.davanzale !== false) davanzale(Q, x - 9, y + a, l + 18, 9, o.coloreDavanzale || '#f3ede2');
  if (o.fioriera) fioriera(Q, cx, y + a + 9, l + 6, o.fioriera, o.cassetta);
}
/** Pannello di legno incassato (porte, boiserie): smusso chiaro e scuro. */
function pannello(Q, x, y, l, a, legno) {
  const c = Q.c;
  macchia(c, Forme.rettangolo(x, y, l, a, 1), scurisci(legno, 0.08), 0.55, 0.25, 2); c.save();
  c.lineWidth = 2.5; c.strokeStyle = conAlfa(schiarisci(legno, 0.6), 0.6);
  c.beginPath(); c.moveTo(x + 3, y + a - 3); c.lineTo(x + 3, y + 3); c.lineTo(x + l - 3, y + 3); c.stroke();
  c.strokeStyle = conAlfa(OMBRA, 0.35);
  c.beginPath(); c.moveTo(x + l - 3, y + 3); c.lineTo(x + l - 3, y + a - 3); c.lineTo(x + 3, y + a - 3); c.stroke();
  c.restore(); inchiostra(Q, rettMano(Q.rng, x, y, l, a, 0.4), 1.1, 0.85);
}
/** Venature del legno: righe sottili e mosse (verticali od orizzontali). */
function venature(Q, x, y, l, a, legno, quante, orizzontali) {
  const r = Q.rng, v = new Path2D();
  for (let k = 0; k < quante; k++) {
    if (orizzontali) {
      const vy = y + tra(r, 3, a - 3);
      mano(r, [[x + 2, vy], [x + l * 0.5, vy + tra(r, -2, 2)], [x + l - 2, vy + tra(r, -2, 2)]], false, 0.8, v);
    } else {
      const vx = x + tra(r, 3, l - 3);
      mano(r, [[vx, y + 3], [vx + tra(r, -3, 3), y + a * 0.5], [vx + tra(r, -3, 3), y + a - 3]], false, 0.8, v);
    }
  }
  linea(Q.c, v, { colore: scurisci(legno, 0.35), spessore: 0.9, alfa: 0.35 });
}
/** Un'anta di porta: legno, vetri in alto (facoltativi), pannelli, maniglia. */
function anta(Q, x, y, l, a, legno, o, i, n) {
  const c = Q.c, r = Q.rng, m = 9, hv = o.vetri ? a * (o.quotaVetri || 0.5) : 0;
  aq(Q, Forme.rettangolo(x, y, l, a), legno, x, y, l, a, { variazione: 0.2, bordo: 0.4, granulosita: 0.15 });
  venature(Q, x, y, l, a, legno, 4);
  if (o.vetri) {
    const [col, rig] = o.vetri, vx = x + m, vy = y + m, vl = l - 2 * m, va = hv - m, p = rettMano(r, vx, vy, vl, va, 0.4);
    vetro(Q, Forme.rettangolo(vx, vy, vl, va), vx, vy, vl, va, o.vetro || '#a9cfe6', o.interno);
    c.save(); c.fillStyle = legno;
    for (let k = 1; k < col; k++) {
      const bx = vx + (vl * k) / col;
      c.fillRect(bx - 2, vy, 4, va);
      for (const d of [-2, 2]) mano(r, [[bx + d, vy], [bx + d, vy + va]], false, 0.3, p);
    }
    for (let k = 1; k < rig; k++) {
      const by = vy + (va * k) / rig;
      c.fillRect(vx, by - 2, vl, 4);
      for (const d of [-2, 2]) mano(r, [[vx, by + d], [vx + vl, by + d]], false, 0.3, p);
    }
    c.restore(); inchiostra(Q, p, 1.1);
  }
  const np = o.vetri ? 1 : 2, py = y + hv + m, pa = a - hv - 2 * m;
  for (let k = 0; k < np; k++) pannello(Q, x + m, py + (k * pa) / np + (k ? 5 : 0), l - 2 * m, pa / np - (np > 1 ? 5 : 0), legno);
  const mx = n === 2 ? (i === 0 ? x + l - 7 : x + 7) : x + l - 11, pomello = Forme.cerchio(mx, y + a * 0.55, 3.2);
  tinta(c, pomello, '#e8be5a'); inchiostra(Q, pomello, 1); inchiostra(Q, rettMano(r, x, y, l, a, 0.4), 1.3);
}
/** Gradino di pietra davanti alla porta (fino a terra). */
function gradino(Q, cx, y, l) {
  const r = Q.rng, x = cx - l / 2;
  copri(Q, Forme.rettangolo(x, y, l, Q.a - y + 4));
  aq(Q, Forme.rettangolo(x, y, l, Q.a - y + 4, 2), '#e2dacd', x, y, l, Q.a - y, { variazione: 0.16, luce: 'alto' });
  tinta(Q.c, Forme.rettangolo(x, y, l, 5), '#ffffff', 0.35);
  inchiostra(Q, mano(r, [[x, Q.a + 2], [x, y], [x + l, y], [x + l, Q.a + 2]], false, 0.5), 1.5);
  inchiostra(Q, mano(r, [[x + 3, y + 5], [x + l - 3, y + 5]], false, 0.4), 0.9, 0.5);
}
/**
 * PORTA. (cx, yBase) = centro in basso; l × a = misure del vano.
 * o: { legno, doppia, vetri: [colonne, righe], quotaVetri, arco, lunetta (raggiera nell'arco),
 *      sopraluce (altezza del vetro sopra le ante), cornice (colore o null), gradino, interno, vetro }
 */
function porta(Q, cx, yBase, l, a, o = {}) {
  const c = Q.c, r = Q.rng, x = cx - l / 2, y = yBase - a, legno = o.legno || '#b8703e', cf = o.cornice === null ? 0 : 10;
  const P = (dx, dy, dl, da) => (o.arco ? puntiArco : puntiRett)(x + dx, y + dy, l + dl, a + da);
  const pc = P(-cf, -cf, 2 * cf, cf), pp = P(0, 0, 0, 0);
  tinta(c, Forme.poligono(pc.map(([px, py]) => [px + 5, py + 4])), OMBRA, 0.22); copri(Q, Forme.poligono(pc));
  if (cf) {
    aq(Q, Forme.poligono(pc), o.cornice || '#f6f0e4', x - cf, y - cf, l + 2 * cf, a + cf, { bordo: 0.3 });
    inchiostra(Q, mano(r, pc, true, 0.4), 1.6);
  }
  ritaglia(Q, Forme.poligono(pp));
  let ya = y;
  const hs = o.arco ? (o.lunetta ? l / 2 : 0) : o.sopraluce || 0;
  if (hs) {                                                   // vetro sopra le ante
    vetro(Q, Forme.rettangolo(x - 2, y - 2, l + 4, hs + 2), x, y, l, hs, o.vetro || '#a9cfe6');
    const p = new Path2D();
    if (o.arco) {
      for (const f of [0.2, 0.4, 0.6, 0.8]) mano(r, [[cx, y + hs], [cx + Math.cos(Math.PI * (1 + f)) * l * 0.6, y + hs + Math.sin(Math.PI * (1 + f)) * l * 0.6]], false, 0.3, p);
      p.moveTo(cx + 12, y + hs); p.arc(cx, y + hs, 12, 0, Math.PI, true);
    } else for (let k = 1; k < 3; k++) mano(r, [[x + (l * k) / 3, y], [x + (l * k) / 3, y + hs]], false, 0.3, p);
    c.save(); c.strokeStyle = legno; c.lineWidth = 4; c.stroke(p); c.restore();
    inchiostra(Q, p, 1, 0.8); tinta(c, Forme.rettangolo(x, y + hs, l, 7), legno);
    inchiostra(Q, rettMano(r, x, y + hs, l, 7, 0.3), 1.1); ya = y + hs + 7;
  }
  const n = o.doppia ? 2 : 1;
  for (let i = 0; i < n; i++) anta(Q, x + (i * l) / n, ya, l / n, yBase - ya, legno, o, i, n);
  rilascia(Q); inchiostra(Q, mano(r, pp, true, 0.4), 1.8);
  if (o.gradino !== false) gradino(Q, cx, yBase, l + 2 * cf + 24);
}
/** Pluviale (tubo della grondaia) con collari e gomito in basso. */
function pluviale(Q, x, y0, y1) {
  const c = Q.c, r = Q.rng, w = 14, x0 = x - w / 2, x1 = x + w / 2;
  tinta(c, Forme.rettangolo(x0 + 6, y0, w, y1 - y0 - 10), OMBRA, 0.16);
  aq(Q, Forme.rettangolo(x0, y0, w, y1 - y0 - 34, 2), '#eef1f3', x0, y0, w, y1 - y0, { variazione: 0.08, bordo: 0.25, larghezzaBordo: 2 });
  velatura(c, x0, y0, w, y1 - y0 - 34, ['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)', 'rgba(110,130,170,0.3)'], 1, 'orizzontale');
  const p = mano(r, [[x1, y0], [x1, y1 - 34]], false, 0.4, mano(r, [[x0, y0], [x0, y1 - 34]], false, 0.4));
  for (let yy = y0 + 70; yy < y1 - 70; yy += 150) {
    tinta(c, Forme.rettangolo(x0 - 2, yy, w + 4, 7, 1), '#ffffff', 0.9);
    rettMano(r, x0 - 2, yy, w + 4, 7, 0.3, p);
  }
  // gomito: il tubo piega in avanti verso la strada
  const g = Forme.poligono([[x0, y1 - 36], [x1, y1 - 36], [x1 + 12, y1 - 14], [x1 + 12, y1 - 4], [x0 + 4, y1 - 4], [x0, y1 - 16]], true);
  aq(Q, g, '#e6eaee', x0, y1 - 36, w + 12, 32, { variazione: 0.08, bordo: 0.3, larghezzaBordo: 2 });
  inchiostra(Q, g, 1.3);
  tinta(c, Forme.ellisse(x1 + 6, y1 - 9, 6, 5), '#8a93a8', 0.6); inchiostra(Q, p, 1.3);
}

/* ============== 6. MURATURE E PAVIMENTAZIONI (mattoni, sassi) ============ */

/**
 * POSA di mattoni o piastrelle in file tra y0 e y1 (vale per muri e pavimenti).
 * o: { righe, colonne, sfalsa (0..1: spostamento delle file dispari), sfasa (px a caso),
 *      giunto, colori, malta, tondi (quanto sono smussati), inch (alfa inchiostro),
 *      luce (forza del volume), dettaglio(r, x, y, l, a) → funzione extra per pezzo }
 */
function posa(Q, y0, y1, o) {
  const c = Q.c, r = Q.rng, g = o.giunto === undefined ? 3 : o.giunto, lt = Q.l / o.colonne, at = (y1 - y0) / o.righe;
  ritaglia(Q, Forme.rettangolo(0, y0, Q.l, y1 - y0));
  if (o.malta) lavaggio(Q, 0, y0, Q.l, y1 - y0, o.malta, { variazione: 0.15, luce: false, colature: 0 });
  for (let j = 0; j < o.righe; j++) {
    const off = (j % 2) * (o.sfalsa || 0) * lt + (o.sfasa ? tra(r, -o.sfasa, o.sfasa) : 0);
    for (let i = 0; i < o.colonne; i++) {
      const x = off + i * lt + g / 2, y = y0 + j * at + g / 2, l = lt - g + tra(r, -1.5, 0.5), a = at - g + tra(r, -1, 0.5);
      const col = mescola(scegli(r, o.colori), scegli(r, o.colori), r() * 0.5);
      const forma = Forme.poligono(puntiMattone(r, x, y, l, a, o.tondi), true), extra = o.dettaglio ? o.dettaglio(r, x, y, l, a) : null;
      ripeti(Q, x, y, x + l, y + a, () => {
        macchia(c, forma, col, 0.95, 0.32, 2.2);
        if (o.luce !== 0) volume(c, forma, x, y, l, a, o.luce === undefined ? 0.6 : o.luce);
        if (extra) extra(col);
        if (o.inch !== 0) inchiostra(Q, forma, 1.1, o.inch === undefined ? 0.75 : o.inch);
      });
    }
  }
  rilascia(Q);
}
/** Mattoni di un muro: calcola quante file servono per l'altezza voluta (o.alto). */
function mattoni(Q, y0, y1, o) {
  posa(Q, y0, y1, Object.assign({ righe: Math.max(1, Math.round((y1 - y0) / o.alto)), sfalsa: 0.5 }, o));
}
/** SASSI a cuscino nella malta: in ogni fila le larghezze sono casuali ma sommate fanno la tela. */
function pietre(Q, y0, y1, o) {
  const c = Q.c, r = Q.rng, h = (y1 - y0) / o.righe, gap = o.gap || 4;
  ritaglia(Q, Forme.rettangolo(0, y0, Q.l, y1 - y0));
  lavaggio(Q, 0, y0, Q.l, y1 - y0, o.malta, { variazione: 0.28, luce: false, fioriture: 0, colature: 0 });
  for (let j = 0; j < o.righe; j++) {
    const larg = [];
    let somma = 0, x = r() * Q.l;
    while (somma < Q.l - h * 0.5) { const w = tra(r, h * (o.min || 1), h * (o.max || 1.9)); larg.push(w); somma += w; }
    for (const w0 of larg) {
      const w = (w0 * Q.l) / somma, cx = x + w / 2, cy = y0 + h * (j + 0.5) + tra(r, -h * 0.05, h * 0.05);
      const rx = w / 2 - gap - tra(r, 0, 2), ry = h / 2 - gap - tra(r, 0, 3), forma = Forme.poligono(puntiSasso(r, cx, cy, rx, ry), true);
      const col = mescola(mescola(scegli(r, o.colori), scegli(r, o.colori), r() * 0.5), scegli(r, ['#c9c2b8', '#e8b8a0', '#fff4dc']), r() * 0.3);
      const sx = cx + tra(r, -rx, rx) * 0.4, sy = cy + tra(r, -ry, ry) * 0.3, sl = tra(r, 0.2, 0.45) * rx;
      const scheggia = r() < 0.4 ? Forme.curva([[sx - sl, sy], [sx, sy + 3], [sx + sl, sy + 1]]) : null;
      ripeti(Q, cx - rx - 3, cy - ry - 3, cx + rx + 3, cy + ry + 3, () => {
        macchia(c, forma, col, 0.97, 0.35, 3); volumeTondo(c, forma, cx, cy, rx, ry);
        if (scheggia) inchiostra(Q, scheggia, 0.8, 0.45);
        inchiostra(Q, forma, 1.3, o.inch === undefined ? 0.8 : o.inch);
      });
      x += w;
    }
  }
  rilascia(Q);
}
/** Assi verticali di legno (staccionata), con nodi e chiodi. */
function assi(Q, n, colori, buio) {
  const c = Q.c, r = Q.rng, lp = Q.l / n;
  tinta(c, Forme.rettangolo(0, 0, Q.l, Q.a), buio);
  for (let i = 0; i < n; i++) {
    const x = lp * (i + 0.35) + 1.8, l = lp - 3.6 + tra(r, -1, 0.5), col = scegli(r, colori), vs = seme(Q);
    const nodo = r() < 0.6 ? [x + tra(r, 8, l - 8), tra(r, 40, Q.a - 40)] : null;
    const chiodi = [62, Q.a - 70].map((yy) => [x + l / 2 + tra(r, -2, 2), yy + tra(r, -3, 3)]);
    const bordo = mano(r, [[x + l, -4], [x + l, Q.a + 4]], false, 0.5, mano(r, [[x, Q.a + 4], [x, -4]], false, 0.5));
    ripeti(Q, x, 0, x + l, Q.a, () => {
      acquerello(c, Forme.rettangolo(x, -2, l, Q.a + 4), col, { area: [x, 0, l, Q.a], seme: vs, variazione: 0.25, bordo: 0.45, larghezzaBordo: 4, granulosita: 0.2, luce: 'alto' });
      venature({ c, rng: casuale(vs) }, x, 0, l, Q.a, col, 5);
      if (nodo) { macchia(c, Forme.ellisse(nodo[0], nodo[1], 3, 6), scurisci(col, 0.3), 0.7, 0); inchiostra(Q, Forme.ellisse(nodo[0], nodo[1], 4, 7), 0.8, 0.6); }
      for (const [cx, cy] of chiodi) tinta(c, Forme.cerchio(cx, cy, 1.8), '#5a4a50', 0.8);
      inchiostra(Q, bordo, 1.4);
    });
  }
}

/* =========================== 7. PIANTE E FIORI =========================== */

/** Foglia d'edera: tre lobi tondi (come un trifoglio). */
function fogliaEdera(Q, x, y, d, ang, colore) {
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const a = ang + (i / 3) * Math.PI * 2;
    for (const [da, k] of [[-0.5, 0.85], [0, 1.08], [0.5, 0.85], [Math.PI / 3, 0.42]]) pts.push([x + Math.cos(a + da) * d * k, y + Math.sin(a + da) * d * k]);
  }
  const forma = Forme.poligono(pts, true);
  macchia(Q.c, forma, colore, 0.92, 0.3, 1.5); inchiostra(Q, forma, 0.8, 0.55);
}
/** Foglia lunga e appuntita (rampicanti fioriti, foglie cadute). */
function fogliaLunga(Q, x, y, d, ang, colore) {
  const p = new Path2D(), lung = d * 2.2, larg = d * 0.55, cs = Math.cos(ang), sn = Math.sin(ang);
  const mx = x + cs * lung * 0.45, my = y + sn * lung * 0.45;
  p.moveTo(x, y);
  p.quadraticCurveTo(mx - sn * larg, my + cs * larg, x + cs * lung, y + sn * lung);
  p.quadraticCurveTo(mx + sn * larg, my - cs * larg, x, y); macchia(Q.c, p, colore, 0.9, 0.3, 1.2);
  inchiostra(Q, p, 0.7, 0.5);
}
/** Mazzetto di fiorellini a quattro petali. */
function mazzetto(Q, x, y, colori, s) {
  const r = casuale(s);
  for (let k = 0; k < 6; k++) {
    const fx = x + tra(r, -7, 7), fy = y + tra(r, -6, 6), col = scegli(r, colori), d = tra(r, 2, 3.2);
    for (let p = 0; p < 4; p++) macchia(Q.c, Forme.cerchio(fx + Math.cos(p * 1.57 + k) * d, fy + Math.sin(p * 1.57 + k) * d, d * 0.8), col, 0.95, 0.25, 1);
    tinta(Q.c, Forme.cerchio(fx, fy, d * 0.45), '#fbe38a');
    if (k % 2) schizzo(Q, Forme.cerchio(fx, fy, d * 1.4), 0.7, 0.6);
  }
}
/**
 * EDERA (o rampicante): uno stelo che scende ondeggiando con foglie ai lati.
 * o: { colori, dim, ang (direzione), lunghe (foglie appuntite), fiori (colori), densita }
 */
function edera(Q, x, y, lung, o = {}) {
  const r = Q.rng, colori = o.colori || ['#4d8a5a', '#6eaa68', '#98c97f'], dim = o.dim || 1;
  const punti = [[x, y]], base = o.ang === undefined ? Math.PI / 2 : o.ang, foglie = [], fiori = [];
  for (let s = 0, ang = base; s < lung; s += 7) {
    ang = base + Math.max(-0.6, Math.min(0.6, ang + tra(r, -0.3, 0.3) - base));
    x += Math.cos(ang) * 7; y += Math.sin(ang) * 7; punti.push([x, y]);
  }
  punti.forEach(([px, py], i) => {
    if (i === 0 || r() > (o.densita || 0.85)) return;
    const lato = i % 2 ? 1 : -1, a = o.lunghe ? Math.PI / 2 + lato * tra(r, 0.4, 1.1) : r() * 7;
    foglie.push([px + lato * tra(r, 1, 6) * dim, py + tra(r, -3, 3), tra(r, 4.5, 8) * dim, a, scegli(r, colori)]);
    if (!o.lunghe && r() < 0.45) foglie.push([px - lato * tra(r, 2, 7) * dim, py + tra(r, -4, 2), tra(r, 3.5, 6) * dim, r() * 7, scegli(r, colori)]);
    if (o.fiori && r() < 0.28) fiori.push([px + tra(r, -8, 8), py + tra(r, -5, 5), seme(Q)]);
  });
  const xs = punti.map((p) => p[0]), ys = punti.map((p) => p[1]), stelo = Forme.curva(punti);
  ripeti(Q, Math.min(...xs) - 20, Math.min(...ys) - 20, Math.max(...xs) + 20, Math.max(...ys) + 20, () => {
    linea(Q.c, stelo, { colore: '#7a6a45', spessore: 1.6 * dim, alfa: 0.8 }); inchiostra(Q, stelo, 0.8, 0.5);
    for (const [fx, fy, d, a, col] of foglie) (o.lunghe ? fogliaLunga : fogliaEdera)(Q, fx, fy, d, a, col);
    for (const [fx, fy, s] of fiori) mazzetto(Q, fx, fy, o.fiori, s);
  });
}
/** Cassetta di fiori sotto una finestra, con piante che ricadono. */
function fioriera(Q, cx, y, l, fiori, legno) {
  const c = Q.c, r = Q.rng, x = cx - l / 2, h = 18;
  for (let i = 0; i < 4; i++) {
    const fx = x + l * (0.14 + i * 0.24), rr = l * 0.17;
    fogliame(c, fx, y - 5, rr, { colori: ['#3f7d4a', '#62a35a', '#9ccf72'], seme: seme(Q), quante: 30, inchiostro: 0.45, schiaccia: 0.8, dimFoglia: 7.5 });
    schizzo(Q, nuvola(r, fx, y - 6, rr * 0.9, rr * 0.7, 7), 0.9, 0.7);
  }
  fiorellini(c, x + 2, y - 22, l - 4, 20, fiori, Math.round(l / 5), seme(Q), 3);
  ombraSotto(c, x + 3, y + h, l, 10, 0.3);
  blocco(Q, x, y, l, h, legno || '#c4714c', { variazione: 0.18, bordo: 0.4, luce: 'alto' });
  for (let i = 0; i < 6; i++) edera(Q, x + 4 + (i * (l - 8)) / 5 + tra(r, -4, 4), y + h - 4, tra(r, 16, 48), { dim: 0.85, densita: 1, fiori: r() < 0.4 ? fiori : null });
}
/** Vaso di terracotta (trapezio con il bordo). */
function vaso(Q, cx, yBase, l, h, colore) {
  const pts = [[cx - l / 2, yBase - h], [cx + l / 2, yBase - h], [cx + l * 0.36, yBase], [cx - l * 0.36, yBase]];
  aq(Q, Forme.poligono(pts), colore, cx - l / 2, yBase - h, l, h, { variazione: 0.2, bordo: 0.4, luce: 'sinistra' });
  inchiostra(Q, mano(Q.rng, pts, true, 0.4), 1.3);
  blocco(Q, cx - l / 2 - 2, yBase - h, l + 4, 5, schiarisci(colore, 0.2), { variazione: 0.05 }, 1);
}
/** Pianta in vaso: cespuglio tondo e fiori. */
function piantaInVaso(Q, cx, yBase, dim, fiori) {
  const yc = yBase - dim * 1.45;
  fogliame(Q.c, cx, yc, dim, { colori: ['#3f7d4a', '#5f9e57', '#97cc73'], seme: seme(Q), quante: Math.round(dim * 2.2), inchiostro: 0.45, schiaccia: 0.95 });
  schizzo(Q, nuvola(Q.rng, cx, yc, dim * 0.95, dim * 0.9, 9), 1, 0.7);
  if (fiori) fiorellini(Q.c, cx - dim * 0.7, yBase - dim * 2.2, dim * 1.4, dim * 1.2, fiori, Math.round(dim / 3), seme(Q), 2.6);
  vaso(Q, cx, yBase, dim * 1.1, dim * 0.95, '#d27a4f');
}
/** Ciuffi d'erba lungo il bordo in basso (si ripetono senza cuciture). */
function ciuffi(Q, y, quanti, alti) {
  const r = Q.rng;
  for (let i = 0; i < quanti; i++) {
    const x = r() * Q.l, fili = [];
    for (let k = 0; k < 5; k++) {
      const fx = x + tra(r, -6, 6), h = tra(r, 0.5, 1) * alti, piega = tra(r, -6, 6);
      fili.push([Forme.curva([[fx, y + 2], [fx + piega * 0.3, y - h * 0.5], [fx + piega, y - h]]), scegli(r, ['#5f9a4a', '#7fb55a', '#a6cf78'])]);
    }
    ripeti(Q, x - 14, y - alti, x + 14, y, () => {
      for (const [p, col] of fili) { linea(Q.c, p, { colore: col, spessore: 2.2, alfa: 0.9 }); inchiostra(Q, p, 0.6, 0.45); }
    });
  }
}

/* ================== 8. NEGOZI: pane, libri, tende, lampade ================ */

/** Filone di baguette con i tagli chiari. */
function baguette(Q, x, y, lung, ang) {
  const corpo = Forme.rettangolo(-lung / 2, -7, lung, 14, 7), tagli = new Path2D();
  sposta(Q, x, y, () => {
    Q.c.rotate(ang); Q.k.rotate(ang); macchia(Q.c, corpo, '#e9b35f', 1, 0.35, 2.2);
    volume(Q.c, corpo, -lung / 2, -7, lung, 14, 0.8);
    for (let k = -1.5; k <= 1.5; k++) {
      const t = Forme.ellisse((k * lung) / 4.6, 0, lung * 0.08, 2.2, -0.5);
      tinta(Q.c, t, '#fbeccb', 0.95); tagli.addPath(t);
    }
    inchiostra(Q, tagli, 0.7, 0.6); inchiostra(Q, corpo, 1.1);
  });
}
/** Pagnotta in cassetta con tre gobbe. */
function pagnotta(Q, cx, yBase, l) {
  const x = cx - l / 2, h = l * 0.42, g = l / 6, p = new Path2D(), s = new Path2D();
  p.moveTo(x + 2, yBase); p.lineTo(x, yBase - h);
  for (let k = 0; k < 3; k++) p.arc(x + g * (2 * k + 1), yBase - h, g, Math.PI, 0);
  p.lineTo(x + l - 2, yBase); p.closePath(); macchia(Q.c, p, '#f0c97f', 1, 0.3, 2);
  ritaglia(Q, p);
  velatura(Q.c, x, yBase - h - g, l, h * 0.6 + g, ['#d58f45', 'rgba(213,143,69,0)'], 0.75); rilascia(Q);
  for (const k of [1, 2]) { s.moveTo(x + g * 2 * k, yBase - h - 1); s.lineTo(x + g * 2 * k + 1, yBase - h + 5); }
  inchiostra(Q, s, 0.8, 0.6); inchiostra(Q, p, 1.1);
}
/** Pane tondo con il taglio inciso. */
function panetto(Q, cx, yBase, l) {
  const forma = Forme.ellisse(cx, yBase - l * 0.28, l / 2, l * 0.3);
  const t = Forme.curva([[cx - l * 0.25, yBase - l * 0.38], [cx, yBase - l * 0.44], [cx + l * 0.25, yBase - l * 0.36]]);
  macchia(Q.c, forma, '#eab46a', 1, 0.35, 2);
  volume(Q.c, forma, cx - l / 2, yBase - l * 0.58, l, l * 0.6, 0.9);
  linea(Q.c, t, { colore: '#fbecc8', spessore: 3 }); inchiostra(Q, t, 0.7, 0.5); inchiostra(Q, forma, 1.1);
}
/** Ciambella (bagel). */
function ciambella(Q, cx, cy, rr) {
  const c = Q.c;
  c.save(); c.lineWidth = rr * 0.75; c.strokeStyle = '#dd9a52';
  c.beginPath(); c.ellipse(cx, cy, rr * 0.7, rr * 0.45, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  volume(c, Forme.ellisse(cx, cy, rr * 1.05, rr * 0.75), cx - rr, cy - rr, rr * 2, rr * 1.5, 0.8);
  inchiostra(Q, Forme.ellisse(cx, cy, rr * 1.06, rr * 0.8), 1);
  inchiostra(Q, Forme.ellisse(cx, cy, rr * 0.33, rr * 0.13), 0.8);
}
/** Cesto di vimini (le baguette dentro vanno disegnate prima). */
function cesto(Q, cx, yBase, l, h) {
  const x = cx - l / 2, yt = yBase - h, pts = [[x, yt], [x + l, yt], [x + l * 0.9, yBase], [x + l * 0.1, yBase]];
  const vimini = new Path2D(), corda = new Path2D(), orlo = Forme.rettangolo(x - 3, yt - 4, l + 6, 8, 4);
  aq(Q, Forme.poligono(pts), '#e9c46e', x, yt, l, h, { variazione: 0.2, bordo: 0.35, luce: 'alto' });
  for (let k = -h; k < l; k += 7) { vimini.moveTo(x + k, yBase); vimini.lineTo(x + k + h, yt); vimini.moveTo(x + k + h, yBase); vimini.lineTo(x + k, yt); }
  ritaglia(Q, Forme.poligono(pts)); inchiostra(Q, vimini, 0.6, 0.35); rilascia(Q);
  macchia(Q.c, orlo, '#f2d488', 1, 0.3);
  for (let k = x; k < x + l; k += 6) { corda.moveTo(k, yt + 4); corda.quadraticCurveTo(k + 3, yt - 6, k + 6, yt + 4); }
  inchiostra(Q, corda, 0.7, 0.6); inchiostra(Q, mano(Q.rng, pts, true, 0.4), 1.2); inchiostra(Q, orlo, 1.1);
}
/** Fila di libri su uno scaffale, da x0 a x1, appoggiati a yBase (ogni tanto uno è inclinato). */
function filaDiLibri(Q, x0, x1, yBase, hMax, r) {
  const c = Q.c;
  for (let x = x0; x < x1 - 6;) {
    const w = Math.min(tra(r, 6, 13), x1 - x), h = hMax * tra(r, 0.68, 0.98), col = scegli(r, LIBRI), storto = r() < 0.08 && x1 - x > 24;
    const f = Forme.rettangolo(x, yBase - h, w, h, 1), det = new Path2D(), oro = r() < 0.5 ? '#f6e7b0' : scurisci(col, 0.35);
    for (const yy of [yBase - h * 0.85, yBase - h * 0.15]) { det.moveTo(x + 1, yy); det.lineTo(x + w - 1, yy); }
    sposta(Q, x, yBase, () => {
      if (storto) { c.rotate(-0.28); Q.k.rotate(-0.28); }
      c.translate(-x, -yBase); Q.k.translate(-x, -yBase); macchia(c, f, col, 0.97, 0.3, 1.5);
      tinta(c, Forme.rettangolo(x + w * 0.2, yBase - h + 2, w * 0.18, h - 4), '#ffffff', 0.25);
      linea(c, det, { colore: oro, spessore: 1.2, alfa: 0.8 }); inchiostra(Q, f, 0.9, 0.75);
    });
    x += storto ? w + 12 : w + tra(r, 0, 1.2);
  }
}
/** Mensola di legno lunga quanto tutta la tela (con l'ombra sotto). */
function mensola(Q, y, legno) {
  fascetta(Q, y, 10, legno, 0.15);
  tinta(Q.c, Forme.rettangolo(0, y, Q.l, 3), schiarisci(legno, 0.4), 0.7);
  ombraSotto(Q.c, 0, y + 10, Q.l, 14, 0.35); inchiostra(Q, riga(Q, y + 10, 0.4, riga(Q, y, 0.4)), 1.2);
}
/** Lampada appesa al soffitto con il suo alone caldo. */
function lampada(Q, cx, y0, lung, colore) {
  const y = y0 + lung, cappello = Forme.poligono([[cx - 6, y], [cx + 6, y], [cx + 24, y + 24], [cx - 24, y + 24]], true), luce = Forme.ellisse(cx, y + 24, 11, 4);
  inchiostra(Q, mano(Q.rng, [[cx, y0], [cx, y]], false, 0.3), 1.2);
  bagliore(Q, cx, y + 26, 90, '#ffcf70', 0.38);
  aq(Q, cappello, colore, cx - 24, y, 48, 24, { variazione: 0.15, bordo: 0.4, luce: 'alto' });
  tinta(Q.c, luce, '#fff3c4'); inchiostra(Q, cappello, 1.3); inchiostra(Q, luce, 0.9);
}
/** Tenda da sole a strisce con balza smerlata e scritta. */
function tendaDaSole(Q, y, h, testo) {
  const c = Q.c, r = Q.rng, x = 10, l = Q.l - 20, hb = 30, yb = y + h - hb, pf = [[x + 12, y], [x + l - 12, y], [x + l, yb], [x, yb]];
  ombraSotto(c, x + 8, y + h, l - 16, 34, 0.38);
  aq(Q, Forme.poligono(pf), '#e0544b', x, y, l, h, { variazione: 0.18, bordo: 0.35, luce: 'alto' });
  ritaglia(Q, Forme.poligono(pf));
  const st = new Path2D();
  for (let k = 0; k < 10; k += 2) {                           // strisce chiare che si allargano in basso
    const s = [[x + 12 + (l - 24) * k / 10, y], [x + 12 + (l - 24) * (k + 1) / 10, y], [x + l * (k + 1) / 10, yb], [x + l * k / 10, yb]];
    tinta(c, Forme.poligono(s), '#fbf0e2', 0.88);
    mano(r, [s[0], s[3]], false, 0.4, st); mano(r, [s[1], s[2]], false, 0.4, st);
  }
  inchiostra(Q, st, 0.8, 0.5);
  velatura(c, x, y, l, h, ['rgba(255,250,230,0.25)', conAlfa(OMBRA, 0.12)]); rilascia(Q);
  const n = 10, w = l / n, p = new Path2D();                  // balza con gli smerli
  p.moveTo(x, yb); p.lineTo(x + l, yb); p.lineTo(x + l, yb + hb - 8);
  for (let k = n - 1; k >= 0; k--) p.arc(x + (k + 0.5) * w, yb + hb - 8, w / 2, 0, Math.PI);
  p.closePath();
  aq(Q, p, '#d84a44', x, yb, l, hb, { variazione: 0.12, bordo: 0.4 }); inchiostra(Q, p, 1.4);
  inchiostra(Q, mano(r, pf, true, 0.5), 1.5);
  scritta(Q, testo, Q.l / 2, yb + 11, 19, '#fff4dc', 'italic bold');
}
/** Interno del caffè visto dalla vetrina: luce calda, mensole, bancone, tavolino. */
function internoCaffe(Q, x, y, l, a) {
  const c = Q.c, r = casuale(77), tx = x + l * 0.25, ty = y + a * 0.75, tavolo = Forme.ellisse(tx, ty, 26, 6);
  velatura(c, x, y, l, a, ['#f4d7a6', '#eab27c'], 0.92);
  for (const yy of [y + a * 0.3, y + a * 0.52]) {
    tinta(c, Forme.rettangolo(x, yy, l, 4), '#a8714a', 0.7);
    for (let xx = x + 6; xx < x + l - 12; xx += tra(r, 11, 18)) {
      const h = tra(r, 9, 16);
      macchia(c, Forme.rettangolo(xx, yy - h, tra(r, 6, 9), h, 2), scegli(r, ['#e57a5a', '#7fb3c8', '#f0c75e', '#9cc98a', '#fff4e0']), 0.75, 0.3, 1);
    }
  }
  macchia(c, Forme.rettangolo(x + l * 0.55, y + a * 0.68, l * 0.5, a * 0.4), '#9b6240', 0.8, 0.3);
  inchiostra(Q, rettMano(r, x + l * 0.55, y + a * 0.68, l * 0.5, a * 0.4, 0.4), 1, 0.6);
  for (const sx of [tx - 24, tx + 24]) inchiostra(Q, Forme.curva([[sx, ty - 30], [sx, ty + 30], [sx + (sx < tx ? 8 : -8), ty + 50]]), 2, 0.55);
  macchia(c, tavolo, '#fdf3e0', 0.95, 0.3); inchiostra(Q, tavolo, 1, 0.7);
  inchiostra(Q, mano(r, [[tx, ty + 6], [tx, ty + 60]], false, 0.4), 2, 0.6);
  for (const lx of [x + l * 0.28, x + l * 0.74]) {
    const cap = Forme.ellisse(lx, y + 32, 10, 7);
    bagliore(Q, lx, y + 40, 60, '#ffd27a', 0.45);
    inchiostra(Q, mano(r, [[lx, y], [lx, y + 26]], false, 0.3), 1, 0.6); macchia(c, cap, '#f6c75c', 0.95, 0.3);
    inchiostra(Q, cap, 1, 0.7);
  }
}
/** Interno del forno visto dalla vetrina: insegna PANE, cesto di baguette, scaffali. */
function internoForno(Q, x, y, l, a) {
  const c = Q.c, r = Q.rng, sx = x + l * 0.42, sl = l * 0.56, bx = x + l * 0.2, ix = x + l * 0.24, iy = y + 34;
  velatura(c, x, y, l, a, ['#fbeac2', '#f3d49b'], 0.95);
  bagliore(Q, x + l * 0.6, y + a * 0.3, l * 0.6, '#fff0b8', 0.35);
  for (const yy of [0.36, 0.62, 0.92]) {                      // scaffale verde chiaro
    macchia(c, Forme.rettangolo(sx, y + a * yy, sl, 6), '#cfe2ad', 0.95, 0.3, 1.5);
    inchiostra(Q, rettMano(r, sx, y + a * yy, sl, 6, 0.3), 1, 0.8);
  }
  for (const xx of [sx + 4, sx + sl - 8]) {
    tinta(c, Forme.rettangolo(xx, y + a * 0.36, 4, a * 0.6), '#cfe2ad');
    inchiostra(Q, rettMano(r, xx, y + a * 0.36, 4, a * 0.6, 0.3), 0.9, 0.7);
  }
  for (let k = 0; k < 3; k++) pagnotta(Q, sx + sl * (0.18 + k * 0.32), y + a * 0.36, 36);
  for (let k = 0; k < 3; k++) ciambella(Q, sx + sl * (0.2 + k * 0.3), y + a * 0.62 - 8, 12);
  panetto(Q, sx + sl * 0.27, y + a * 0.92, 50); panetto(Q, sx + sl * 0.74, y + a * 0.92, 44);
  baguette(Q, bx - 12, y + a * 0.66, 100, -1.35);             // cesto con le baguette
  baguette(Q, bx + 2, y + a * 0.63, 108, -1.62); baguette(Q, bx + 16, y + a * 0.7, 90, -1.1);
  cesto(Q, bx + 2, y + a - 2, 64, 54);
  for (const d of [-22, 22]) inchiostra(Q, mano(r, [[ix + d, y], [ix + d, iy - 12]], false, 0.3), 1.1); // catenelle
  const ins = Forme.ellisse(ix, iy, 36, 15);
  aq(Q, ins, '#f4e7d0', ix - 36, iy - 15, 72, 30, { bordo: 0.45 }); inchiostra(Q, ins, 1.6);
  inchiostra(Q, Forme.ellisse(ix, iy, 31, 11), 0.8, 0.6); scritta(Q, 'PANE', ix, iy + 1, 15, '#a86d3c');
}
/** Interno della libreria: scaffali pieni di libri colorati. */
function internoLibri(Q, x, y, l, a) {
  const c = Q.c, r = casuale(321), h = a / 4;
  velatura(c, x, y, l, a, ['#f1d9ad', '#dfb987'], 0.95);
  bagliore(Q, x + l / 2, y + 20, l * 0.6, '#ffe2a0', 0.25);
  for (let k = 0; k < 4; k++) {
    const yb = y + (k + 1) * h - 4;
    filaDiLibri(Q, x + 4, x + l - 4, yb, h - 12, r);
    macchia(c, Forme.rettangolo(x, yb, l, 5), '#8a5a3a', 0.9, 0.2);
    inchiostra(Q, mano(Q.rng, [[x, yb], [x + l, yb]], false, 0.3), 1, 0.7);
  }
}
/** Vista della strada assolata da una finestra (morbida, quasi sfocata). */
function stradaFuori(Q, x, y, l, a) {
  const c = Q.c, r = casuale(55);
  velatura(c, x, y, l, a, ['#bfe0f4', '#eef7fb'], 1); c.save(); c.filter = 'blur(1.2px)';
  for (let xx = x - 10; xx < x + l;) {                        // le case di fronte
    const w = tra(r, 40, 70), top = y + a * tra(r, 0.12, 0.4);
    c.fillStyle = scegli(r, ['#f3a774', '#f6dc8e', '#f2b3b0', '#b9d4ec', '#c8dfb0']); c.fillRect(xx, top, w, a);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    for (let fy = top + 12; fy < y + a * 0.75; fy += 30) for (let fx = xx + 8; fx < xx + w - 10; fx += 18) c.fillRect(fx, fy, 8, 14);
    xx += w + 2;
  }
  c.fillStyle = '#8fc370';
  c.beginPath(); c.ellipse(x + l * 0.75, y + a * 0.55, l * 0.22, a * 0.16, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e5e1da'; c.fillRect(x, y + a * 0.82, l, a * 0.2); c.restore();
  velatura(c, x, y, l, a, ['rgba(255,252,235,0.35)', 'rgba(255,252,235,0.15)'], 1);
}
/** Parete interna: intonaco, trave in alto, boiserie (o piastrelle) in basso. */
function pareteInterna(Q, colore, hBasso, legno, piastrelle) {
  const c = Q.c, yb = Q.a - hBasso;
  lavaggio(Q, 0, 0, Q.l, Q.a, colore, { variazione: 0.2 });
  fascetta(Q, 0, 30, legno, 0.2);                             // trave in alto
  venature(Q, 0, 0, Q.l, 30, legno, 4, true); ombraSotto(c, 0, 30, Q.l, 16, 0.35);
  inchiostra(Q, riga(Q, 30, 0.5), 1.4);
  if (piastrelle) posa(Q, yb, Q.a - 18, { righe: Math.round((hBasso - 18) / 32), colonne: 8, giunto: 2.5, colori: piastrelle, malta: '#f3ece0', tondi: 0.12, inch: 0.55, luce: 0.4 });
  else {
    lavaggio(Q, 0, yb, Q.l, hBasso, legno, { variazione: 0.2, luce: false, colature: 0 });
    for (const px of [10, 138]) pannello(Q, px, yb + 18, 108, hBasso - 50, legno);
  }
  tinta(c, Forme.rettangolo(0, yb - 4, Q.l, 8), schiarisci(legno, 0.25)); ombraSotto(c, 0, yb + 4, Q.l, 8, 0.3);
  fascetta(Q, Q.a - 18, 18, scurisci(legno, 0.15), 0.15);     // battiscopa
  inchiostra(Q, riga(Q, Q.a - 18, 0.5, riga(Q, yb + 4, 0.5, riga(Q, yb - 4, 0.5))), 1.3);
}
/** Parte comune della libreria: piano di sopra, insegna e telaio verde scuro del negozio. */
function vetrinaLibreria(Q, conPorta) {
  const c = Q.c, ins = Forme.rettangolo(18, 412, 220, 58, 3);
  facciata(Q, '#f2dcb0', { zoccolo: false });
  finestra(Q, 128, 110, 88, 176, { persiane: '#5f9a78', righe: 3 });
  lavaggio(Q, 0, 400, Q.l, Q.a - 400, '#3f7a5c', { variazione: 0.22, luce: false });
  ombraSotto(c, 0, 400, Q.l, 10, 0.3); aq(Q, ins, '#2f5e48', 18, 412, 220, 58, { bordo: 0.4 });
  inchiostra(Q, ins, 1.6);
  inchiostra(Q, rettMano(Q.rng, 24, 418, 208, 46, 0.4), 1, 0.8);
  linea(c, Forme.rettangolo(24, 418, 208, 46, 2), { colore: '#e8c15e', spessore: 1.5, alfa: 0.8 });
  if (conPorta) {
    for (const [x, d] of [[80, 1], [176, -1]]) inchiostra(Q, Forme.curva([[x - 30 * d, 442], [x - 12 * d, 430], [x, 442], [x + 12 * d, 454], [x + 30 * d, 442]]), 1.2);
    scritta(Q, '✦', 128, 441, 20, '#f2cf6b');
  } else scritta(Q, 'LIBRI', 128, 442, 34, '#f2cf6b');
  for (const x of [8, 226]) blocco(Q, x, 480, 22, Q.a - 492, '#4a8a68', { luce: 'sinistra', bordo: 0.4 }); // lesene
  fascetta(Q, Q.a - 12, 12, '#4e5a52', 0.1); inchiostra(Q, riga(Q, Q.a - 12, 0.4), 1.2);
}

/* =============== 9. LE RICETTE DEI MURI: [altezza, pittura] =============== */

const P1 = 118, P0 = 498, FASCIA = 392;                       // piano di sopra, piano terra, marcapiano
const FIORI_A = ['#e84a5f', '#ff8fa3', '#fff3f0'], FIORI_B = ['#f25c54', '#ffd166', '#ffffff'];
const ARANCIO = '#f0864c', GIALLO = '#f7d77c', SASSI = ['#e6d1a6', '#dcc497', '#eedcb5', '#d6bc8e'];
const MATTONE_ROSA = ['#f4a385', '#f6b597', '#ef9878', '#f8c0a3', '#f2aa8a', '#f7c9b0', '#ec8f70'];
const FORNO = { alto: 32, colonne: 4, giunto: 6, colori: MATTONE_ROSA, malta: '#f9d6c2', tondi: 0.2, inch: 0.55, luce: 0.6, sfasa: 8 };
const LEGNO_FORNO = ['#f7e6c6', 150, '#b98252', ['#f3d9b6', '#f6e3c8', '#eed0aa']];
const EDERA = ['#4f9468', '#6fb07a', '#9fd08f'];
/** Staccionata di assi ocra con l'edera in cima. */
function staccionata(Q) {
  assi(Q, 6, ['#dca552', '#e5b562', '#d39a48', '#e9bd6c'], '#5b3f2e');
  velatura(Q.c, 0, Q.a - 50, Q.l, 50, ['rgba(93,75,124,0)', 'rgba(93,75,124,0.25)']);
  for (let k = 0; k < 9; k++) edera(Q, k * 30 + tra(Q.rng, 0, 20), -6, tra(Q.rng, 20, 90), { dim: 1.05 });
}

const MURI = {
  casa_arancio: [3.2, (Q) => {
    facciata(Q, ARANCIO, { fascia: FASCIA }); finestra(Q, 128, P1 - 6, 106, 196, { fioriera: FIORI_A });
    finestra(Q, 128, P0 - 12, 106, 186, { fioriera: FIORI_B });
  }],
  casa_arancio_porta: [3.2, (Q) => {
    facciata(Q, ARANCIO, { fascia: FASCIA }); finestra(Q, 128, P1 - 6, 106, 196, { fioriera: FIORI_A });
    porta(Q, 128, Q.a - 20, 116, 290, { doppia: true, vetri: [1, 3], sopraluce: 34, legno: '#b4622f' });
  }],
  casa_gialla: [3.2, (Q) => {
    facciata(Q, GIALLO, { fascia: FASCIA });
    finestra(Q, 128, P1 - 6, 90, 192, { persiane: '#a8693e', righe: 3 });
    finestra(Q, 128, P0 - 6, 90, 186, { persiane: '#a8693e', righe: 3 });
  }],
  casa_gialla_porta: [3.2, (Q) => {
    facciata(Q, GIALLO, { fascia: FASCIA });
    finestra(Q, 128, P1 - 6, 90, 192, { persiane: '#a8693e', righe: 3 });
    porta(Q, 128, Q.a - 20, 110, 292, { arco: true, doppia: true, legno: '#9d5f37' });
  }],
  casa_rosa: [3.2, (Q) => {
    facciata(Q, '#f4a9aa', { gronda: '#dc7650', fascia: FASCIA });
    for (const [mx, my] of [[34, 200], [214, 270], [40, 560], [222, 640], [200, 120]]) {   // mattoncini decorativi
      macchia(Q.c, Forme.rettangolo(mx - 11, my - 5, 22, 10, 2), '#e98582', 0.6, 0.3);
      inchiostra(Q, rettMano(Q.rng, mx - 11, my - 5, 22, 10, 0.4), 1.1, 0.8);
    }
    finestra(Q, 128, P1 + 8, 100, 186, { fioriera: ['#ffffff', '#f7d046', '#e2504c'], cassetta: '#6f9a6a' });
    finestra(Q, 128, P0 - 6, 100, 186, { righe: 3 });
  }],
  casa_azzurra: [3.2, (Q) => {
    lavaggio(Q, 0, 0, Q.l, Q.a, '#a9c7e8', { variazione: 0.32, fioriture: 14 }); cornicione(Q, 40, '#a9c7e8');
    posa(Q, Q.a - 46, Q.a, { righe: 1, colonne: 8, giunto: 4, colori: ['#8fb2cf', '#9dbcd6', '#86a8c6'], malta: '#6f8eaa', tondi: 0.16, luce: 0.6 });
    pluviale(Q, 32, 40, Q.a - 46);
    for (let k = 0; k < 4; k++) edera(Q, 40 + k * 22, 36, 300 - k * 50, { lunghe: true, colori: ['#4f8c55', '#77ad64', '#a2cd7f'], fiori: ['#f07b3f', '#f59a55', '#e8603c'], dim: 1.1 });
    finestra(Q, 160, P1 + 26, 96, 180, { fioriera: ['#ffffff', '#f6a5b5', '#fce38a'], cassetta: '#e9e4da' });
    finestra(Q, 160, P0 - 6, 96, 186, {});
  }],
  casa_verde: [3.2, (Q) => {
    facciata(Q, '#a9c99d', { fascia: FASCIA, cornice: '#eef0e2' });
    finestra(Q, 128, P1 - 10, 96, 254, { arco: true, righe: 3, chiave: '#eef0e2' });
    finestra(Q, 128, P0 - 50, 96, 250, { arco: true, righe: 3, chiave: '#eef0e2' });
  }],
  casa_crema: [3.2, (Q) => {
    const c = Q.c, r = Q.rng, yb = P1 + 240, x = 43, hr = 56, fer = new Path2D();
    facciata(Q, '#f5e5c4', { fascia: FASCIA, coloreZoccolo: '#cfc0aa' });
    finestra(Q, 128, P1 - 10, 92, 250, { righe: 4, davanzale: false, vetro: '#a5c9e6' });   // portafinestra
    for (const fx of [x + 22, x + 148]) piantaInVaso(Q, fx, yb, 21, ['#e2504c', '#ff8fa3', '#ffffff']);
    // ringhiera di ferro con i riccioli
    for (const yy of [yb - hr, yb - 8]) mano(r, [[x, yy], [x + 170, yy]], false, 0.3, fer);
    for (let bx = x + 4; bx < x + 170; bx += 10) mano(r, [[bx, yb - hr], [bx, yb - 8]], false, 0.3, fer);
    for (let k = 0, ry = yb - hr / 2 - 4; k < 4; k++) {
      const rx = x + 22 + k * 42;
      fer.moveTo(rx - 10, ry + 8); fer.bezierCurveTo(rx - 14, ry - 10, rx + 6, ry - 12, rx + 4, ry - 2); fer.bezierCurveTo(rx + 2, ry + 4, rx - 4, ry + 2, rx - 3, ry - 2);
      fer.moveTo(rx + 10, ry + 8); fer.bezierCurveTo(rx + 14, ry + 16, rx - 2, ry + 18, rx + 1, ry + 10);
    }
    linea(c, fer, { colore: '#4b4560', spessore: 1.8 }); linea(Q.k, fer, { spessore: 1.2 });
    tinta(c, Forme.rettangolo(x, yb - hr - 2, 170, 4, 2), '#4b4560');
    ombraSotto(c, x, yb + 12, 170, 26, 0.35);                 // lastra del balcone e mensole
    for (const mx of [x + 18, x + 152]) {
      const m = Forme.poligono([[mx - 7, yb + 12], [mx + 7, yb + 12], [mx + 3, yb + 34], [mx - 3, yb + 34]]);
      aq(Q, m, '#ece4d5', mx - 7, yb + 12, 14, 22, { bordo: 0.3, larghezzaBordo: 2 }); inchiostra(Q, m, 1.2);
    }
    blocco(Q, x - 6, yb, 182, 12, '#efe7d8', { luce: 'alto' });
    finestra(Q, 128, P0 - 6, 90, 186, { persiane: '#7fa28d', righe: 3 });
  }],
  mattoni: [3.2, (Q) => {
    const cx = 128, y = 300, l = 72, x = cx - l / 2, arco = new Path2D();
    mattoni(Q, 0, Q.a, { alto: 15, colonne: 8, giunto: 3, colori: ['#a65a43', '#b8664b', '#9a4f3d', '#c07657', '#8f5547'], malta: '#d8b9a3', tondi: 0.15, inch: 0.55, luce: 0.5 });
    cornicione(Q, 34, '#b8664b', '#e6d8c6'); zoccolo(Q, 40, '#a89a96');
    for (let k = 0; k < 9; k++) {                             // architrave di mattoni in piedi
      const f = Forme.rettangolo(x - 8 + k * ((l + 16) / 9) + 0.8, y - 24, (l + 16) / 9 - 1.6, 22, 2);
      macchia(Q.c, f, scegli(Q.rng, ['#b4614a', '#c47156', '#a65a43']), 1, 0.3, 1.5); arco.addPath(f);
    }
    inchiostra(Q, arco, 1, 0.75);
    finestra(Q, cx, y, l, 112, { telaio: '#5f8770', vetro: '#7fa9c9', righe: 2, spessore: 7, coloreDavanzale: '#e6dccb' });
  }],
  caffe: [3.2, (Q) => {
    const x = 22, y = 532, l = 212, a = 222, r = Q.rng;
    facciata(Q, '#93c49a', { zoccolo: false, cornice: '#f1efe0' });
    finestra(Q, 128, 110, 94, 180, { fioriera: FIORI_B, cassetta: '#e9dcc0' });
    tendaDaSole(Q, 400, 112, 'Caffè dei Colori'); zoccolo(Q, 54, '#6f8f74');
    tinta(Q.c, Forme.rettangolo(x + 5, y + 6, l, a), OMBRA, 0.22);   // vetrina con l'interno caldo
    copri(Q, Forme.rettangolo(x - 6, y - 6, l + 12, a + 12));
    aq(Q, Forme.rettangolo(x - 6, y - 6, l + 12, a + 12, 2), '#f6f0e0', x - 6, y - 6, l + 12, a + 12, { bordo: 0.3 });
    vetro(Q, Forme.rettangolo(x, y, l, a), x, y, l, a, '#a9cfe6', internoCaffe);
    tinta(Q.c, Forme.rettangolo(127, y, 5, a), '#f6f0e0');
    inchiostra(Q, rettMano(r, 127, y, 5, a, 0.3, rettMano(r, x - 6, y - 6, l + 12, a + 12, 0.5, rettMano(r, x, y, l, a, 0.5))), 1.5);
    piantaInVaso(Q, 204, Q.a - 4, 30, ['#ffffff', '#f7d046', '#ff8fa3']);
  }],
  forno_porta: [3.2, (Q) => {
    mattoni(Q, 0, Q.a, FORNO); cornicione(Q, 30, '#f4a385', '#f8e6d4');
    porta(Q, 128, Q.a - 14, 112, 330, { arco: true, lunetta: true, vetri: [2, 3], quotaVetri: 0.55, legno: '#b88a5c', cornice: '#ea9d82', vetro: '#b7dbe9' });
  }],
  forno_vetrina: [3.2, (Q) => {
    const x = 20, y = 420, l = 216, a = 290, bordo = Forme.rettangolo(x - 10, y - 10, l + 20, a + 20, 36), v = Forme.rettangolo(x, y, l, a, 28);
    mattoni(Q, 0, Q.a, FORNO); cornicione(Q, 30, '#f4a385', '#f8e6d4');
    tinta(Q.c, Forme.rettangolo(x - 4, y - 2, l + 20, a + 20, 36), OMBRA, 0.2);
    copri(Q, bordo);
    aq(Q, bordo, '#f6c2a8', x - 10, y - 10, l + 20, a + 20, { bordo: 0.45, larghezzaBordo: 4 });
    inchiostra(Q, bordo, 1.6); vetro(Q, v, x, y, l, a, '#cfe3ea', internoForno); inchiostra(Q, v, 1.5);
    davanzale(Q, x - 6, y + a + 10, l + 12, 10, '#f8dccb');
  }],
  forno_mattoni: [3.2, (Q) => { mattoni(Q, 0, Q.a, FORNO); cornicione(Q, 30, '#f4a385', '#f8e6d4'); }],
  libreria: [3.2, (Q) => {
    const x = 40, y = 500, l = 176, a = 230;
    vetrinaLibreria(Q);
    vetro(Q, Forme.rettangolo(x, y, l, a), x, y, l, a, '#b4d3e6', internoLibri);
    inchiostra(Q, rettMano(Q.rng, x, y, l, a, 0.5), 1.6);
    pannello(Q, x, y + a + 10, l, Q.a - y - a - 22, '#3f7a5c');
  }],
  libreria_porta: [3.2, (Q) => {
    vetrinaLibreria(Q, true);
    porta(Q, 128, Q.a - 12, 104, 300, { vetri: [1, 1], quotaVetri: 0.68, legno: '#3f7a5c', cornice: null, sopraluce: 30, interno: internoLibri, vetro: '#b4d3e6' });
  }],
  muro_sera: [3.2, (Q) => {
    const c = Q.c, r = Q.rng;
    lavaggio(Q, 0, 0, Q.l, Q.a, '#93a9bf', { variazione: 0.3, fioriture: 10 });
    bagliore(Q, 200, 560, 260, '#ffb8a0', 0.3);               // luce rosata di un lampione
    cornicione(Q, 38, '#8a9fb4', '#c9d3de'); zoccolo(Q, 60, '#6f8197');
    // intonaco caduto: si vedono i mattoni
    const buco = Forme.poligono(blob(r, 84, 450, 70, 110, 18, 0.3).map(([x, y]) => [x + tra(r, -6, 6), y + tra(r, -6, 6)]));
    ritaglia(Q, buco);
    copri(Q, buco);
    mattoni(Q, 340, 600, { alto: 15, colonne: 9, colori: ['#a8786a', '#b88878', '#97695d', '#c09484'], malta: '#c9b7b4', tondi: 0.15, inch: 0.5, luce: 0.4 });
    rilascia(Q);
    linea(c, buco, { colore: '#e8eef4', spessore: 3, alfa: 0.6 }); inchiostra(Q, buco, 1.5);
    finestra(Q, 160, P1 + 4, 96, 190, { chiusa: '#79a7a2', telaio: '#e2e8ec' });
    velatura(c, 0, 0, Q.l, Q.a, ['rgba(80,90,150,0.16)', 'rgba(80,90,150,0)', 'rgba(255,190,160,0.08)']);
  }],
  staccionata: [1.4, (Q) => { staccionata(Q); ciuffi(Q, Q.a, 14, 26); }],
  staccionata_buco: [1.4, (Q) => {
    const c = Q.c, r = Q.rng, l = Q.l * 0.45, h = Q.a * 0.3, x0 = 128 - l / 2, pts = [[x0, Q.a + 2]], sch = new Path2D();
    staccionata(Q);
    for (let k = 0; k <= 16; k++) {                           // il buco: bordo frastagliato di legno rotto
      const f = k / 16, dente = k % 2 ? tra(r, 4, 13) : tra(r, -5, 0);
      pts.push([x0 + l * f + tra(r, -2, 2), Q.a - h * Math.pow(Math.sin(Math.PI * (0.04 + f * 0.92)), 0.55) + dente]);
    }
    pts.push([x0 + l, Q.a + 2]);
    const buco = Forme.poligono(pts);
    copri(Q, buco);
    ritaglia(Q, buco);
    velatura(c, x0, Q.a - h - 10, l, h + 12, ['#2a1f2e', '#3a2c38', '#4f5a46'], 1); rilascia(Q);
    linea(c, buco, { colore: '#f2d08a', spessore: 3, alfa: 0.7 }); inchiostra(Q, buco, 1.6);
    for (let k = 1; k < pts.length - 2; k += 2) mano(r, [pts[k], [pts[k][0] + tra(r, -4, 4), pts[k][1] - tra(r, 6, 14)]], false, 0.3, sch);
    inchiostra(Q, sch, 0.9, 0.7); ciuffi(Q, Q.a, 10, 26);
  }],
  muro_vicolo: [2.4, (Q) => {
    lavaggio(Q, 0, 0, Q.l, Q.a, '#eea39d', { variazione: 0.32, fioriture: 12 });
    fascetta(Q, 0, 16, '#d98c88', 0.2); inchiostra(Q, riga(Q, 16, 0.6), 1.2);
    ombraSotto(Q.c, 0, 16, Q.l, 10, 0.25);
    posa(Q, Q.a - 46, Q.a, { righe: 1, colonne: 6, giunto: 5, colori: ['#8a5a4a', '#9b6a55', '#7d5243', '#a37462'], malta: '#5e4036', tondi: 0.18, luce: 0.6 });
    for (const [x, lung, dim, ang] of [[70, 460, 1.35, 0], [92, 380, 1.3, 0.25], [170, 500, 1.35, 0], [186, 330, 1.25, -0.3]]) edera(Q, x, 10, lung, { dim, ang: Math.PI / 2 + ang, colori: EDERA });
  }],
  muretto: [0.6, (Q) => pietre(Q, 0, Q.a, { righe: 2, gap: 3, malta: '#8d6b4b', colori: SASSI })],
  muretto_mattoni: [0.6, (Q) => {
    mattoni(Q, 26, Q.a, { alto: 16, colonne: 8, colori: ['#e8865c', '#f09a6e', '#dc7a52', '#f2a97f'], malta: '#f3c9ae', tondi: 0.2, inch: 0.6 });
    posa(Q, 0, 28, { righe: 1, colonne: 4, giunto: 3, colori: ['#efe6d6', '#e6dccb', '#f4ecdf'], malta: '#cfc3b0', tondi: 0.15, luce: 0.7 });
    ombraSotto(Q.c, 0, 28, Q.l, 10, 0.35);
  }],
  casa_gialla_finestra: [3.2, (Q) => {
    const base = Q.a - Math.round(0.9 * U), blu = { telaio: '#78acd6', vetro: '#d3e9f4' };
    lavaggio(Q, 0, 0, Q.l, Q.a, '#f8de8c', { variazione: 0.22 }); cornicione(Q, 42, '#f8de8c');
    pietre(Q, base, Q.a, { righe: 3, gap: 3, malta: '#8f6e4e', colori: SASSI });
    ombraSotto(Q.c, 0, base, Q.l, 4, 0.2); inchiostra(Q, riga(Q, base, 0.6), 1.3);
    finestra(Q, 128, 140, 100, 150, { ...blu, spessore: 7, coloreDavanzale: '#e9f1f6' });
    finestra(Q, 128, base - 222, 168, 214, { ...blu, spessore: 8, colonne: 4, righe: 3, davanzale: false });
  }],
  siepe: [1.3, (Q) => {
    const r = Q.rng, toni = [['#4a8a4c', '#74ad5e', '#a9d684'], ['#3c7442', '#5f9d55', '#8cc06c'], ['#2f6239', '#4a8549', '#6fa25d']];
    lavaggio(Q, 0, 0, Q.l, Q.a, '#3f7748', { variazione: 0.3, luce: false });
    for (let f = 0; f < 5; f++) {
      for (let i = 0; i < 6; i++) {
        const cx = (i + r() * 0.8) * (Q.l / 6), cy = Q.a * (0.08 + f * 0.21) + tra(r, -12, 12), rr = tra(r, 30, 44), s = seme(Q), colori = toni[Math.min(2, Math.floor(f / 2))];
        ripeti(Q, cx - rr, cy - rr, cx + rr, cy + rr, () => {
          fogliame(Q.c, cx, cy, rr, { colori, seme: s, quante: 55, inchiostro: 0.4, schiaccia: 0.85, dimFoglia: 9 });
          schizzo(Q, nuvola(casuale(s), cx, cy, rr * 0.85, rr * 0.72, 8), 1, 0.6);
        });
      }
    }
    for (let k = 0; k < 10; k++) {
      const fx = r() * Q.l, fy = tra(r, 20, Q.a - 30), s = seme(Q);
      ripeti(Q, fx - 12, fy - 12, fx + 12, fy + 12, () => mazzetto(Q, fx, fy, ['#ffffff', '#f6c6d4', '#fff1a8'], s));
    }
    velatura(Q.c, 0, Q.a - 60, Q.l, 60, ['rgba(40,60,60,0)', 'rgba(40,60,60,0.28)']);
  }],
  forno_interno: [2.6, (Q) => {
    const r = Q.rng;
    pareteInterna(Q, ...LEGNO_FORNO); lampada(Q, 128, 30, 60, '#d9774f');
    for (const y of [250, 370]) for (const bx of [36, 220]) {  // mensole a staffa
      const m = Forme.poligono([[bx - 4, y + 10], [bx + 4, y + 10], [bx + 4, y + 30], [bx - 4, y + 12]], true);
      tinta(Q.c, m, '#8a5a3a'); inchiostra(Q, m, 1);
    }
    for (let k = 0; k < 4; k++) pagnotta(Q, 40 + k * 58, 250, 46);
    for (let k = 0; k < 3; k++) baguette(Q, 72, 362 - k * 11, 104, tra(r, -0.05, 0.05));
    for (let k = 0; k < 4; k++) ciambella(Q, 148 + k * 26, 358, 12);
    for (let k = 0; k < 4; k++) panetto(Q, 42 + k * 57, 480, 48 + tra(r, -5, 4));
    for (const y of [250, 370, 480]) mensola(Q, y, '#a8714a');
  }],
  forno_forno: [2.6, (Q) => {
    const c = Q.c, r = Q.rng, x = 22, l = 212, top = 150, bx = 78, by = 340, bl = 100, ba = 118;
    pareteInterna(Q, ...LEGNO_FORNO);
    // il grande forno di mattoni
    tinta(c, Forme.poligono(puntiArco(x + 6, top + 4, l, Q.a - top)), OMBRA, 0.25);
    ritaglia(Q, Forme.poligono(puntiArco(x, top, l, Q.a - top)));
    copri(Q, Forme.rettangolo(0, 0, Q.l, Q.a));
    mattoni(Q, top, Q.a, { ...FORNO, alto: 26, colonne: 5, giunto: 5, malta: '#f6cdb4', sfasa: 6 });
    velatura(c, x, top, l, 160, ['rgba(80,60,70,0.25)', 'rgba(80,60,70,0)']); rilascia(Q);
    inchiostra(Q, mano(r, puntiArco(x, top, l, Q.a - top), false, 0.35), 1.8);
    // la bocca del forno con il fuoco
    const bocca = Forme.poligono(puntiArco(bx, by, bl, ba));
    bagliore(Q, 128, by + 80, 150, '#ff9a4a', 0.35); copri(Q, bocca); ritaglia(Q, bocca);
    velatura(c, bx, by, bl, ba, ['#3a2228', '#5a2f2c', '#a4452f'], 1);
    bagliore(Q, 128, by + ba, 70, '#ffb347', 0.9);
    for (const [fx, fh, fw] of [[110, 52, 14], [130, 66, 17], [150, 46, 13], [120, 34, 10]]) {
      const yf = by + ba, fiamma = Forme.poligono([[fx - fw, yf], [fx - fw * 0.6, yf - fh * 0.5], [fx + tra(r, -4, 4), yf - fh], [fx + fw * 0.6, yf - fh * 0.45], [fx + fw, yf]], true);
      macchia(c, fiamma, '#ff9a3c', 0.9, 0.3);
      macchia(c, Forme.ellisse(fx, yf - fh * 0.25, fw * 0.5, fh * 0.25), '#ffe07a', 0.85, 0);
      schizzo(Q, fiamma, 0.9, 0.6);
    }
    rilascia(Q);
    const ar = new Path2D(), cy = by + bl / 2;                // archetto di mattoni attorno alla bocca
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (1 + k / 8);
      ar.moveTo(128 + Math.cos(a) * 50, cy + Math.sin(a) * 50); ar.lineTo(128 + Math.cos(a) * 66, cy + Math.sin(a) * 66);
    }
    ar.moveTo(194, cy); ar.arc(128, cy, 66, 0, Math.PI, true); inchiostra(Q, ar, 1.2, 0.8);
    inchiostra(Q, mano(r, puntiArco(bx, by, bl, ba), true, 0.3), 1.8);
    blocco(Q, bx - 22, by + ba, bl + 44, 16, '#efe3d0', { luce: 'alto' }, 1.5);   // mensola di pietra
    bagliore(Q, 128, by + ba + 4, 60, '#ffb36a', 0.3); ombraSotto(c, bx - 20, by + ba + 16, bl + 40, 14, 0.35);
  }],
  forno_finestra: [2.6, (Q) => {
    const x = 63, y = 330, l = 130, t = new Path2D();
    pareteInterna(Q, ...LEGNO_FORNO); bagliore(Q, 128, 290, 170, '#fff2c8', 0.22);
    finestra(Q, 128, 130, 150, 290, { telaio: '#c08a55', righe: 3, interno: stradaFuori, vetro: '#d6ecf7', spessore: 10, coloreDavanzale: '#f2e6d2' });
    piantaInVaso(Q, 92, 418, 14, ['#e2504c', '#ff8fa3']);
    t.moveTo(x, y); t.lineTo(x + l, y); t.lineTo(x + l, y + 56);   // tendina a mezza altezza con il pizzo
    for (let k = 9; k >= 0; k--) t.arc(x + (k + 0.5) * (l / 10), y + 56, l / 20, 0, Math.PI);
    t.closePath(); macchia(Q.c, t, '#fffaf0', 0.8, 0.2);
    for (let k = 1; k < 8; k++) inchiostra(Q, mano(Q.rng, [[x + (k * l) / 8, y + 4], [x + (k * l) / 8 + tra(Q.rng, -2, 2), y + 52]], false, 0.6), 0.6, 0.35);
    inchiostra(Q, t, 1.1, 0.8);
    inchiostra(Q, mano(Q.rng, [[x - 6, y], [x + l + 6, y]], false, 0.3), 2);
  }],
  libreria_scaffali: [3.0, (Q) => {
    const c = Q.c, r = Q.rng, sc = [[110, 146], [100, Q.a - 22], [150, 146], [160, Q.a - 22]];
    lavaggio(Q, 0, 0, Q.l, Q.a, '#6f4a35', { variazione: 0.25 }); fascetta(Q, 0, 40, '#9a6a45', 0.2);
    inchiostra(Q, riga(Q, 40, 0.5, riga(Q, 12, 0.5)), 1.4);
    let sopra = 52;
    for (const y of [168, 298, 428, 558, 688]) {
      ombraSotto(c, 0, sopra, Q.l, 30, 0.45); filaDiLibri(Q, 16, 240, y, y - sopra - 16, r);
      mensola(Q, y, '#8a5a3a'); sopra = y + 10;
    }
    fascetta(Q, Q.a - 70, 70, '#7d5139', 0.2);
    for (const px of [24, 136]) pannello(Q, px, Q.a - 60, 96, 46, '#8a5a3a');
    for (const dx of [0, Q.l]) {                              // montanti a cavallo della cucitura
      lavaggio(Q, dx - 12, 0, 24, Q.a, '#9a6a45', { variazione: 0.2, luce: false, fioriture: 0, macchie: 3, colature: 0 });
      velatura(c, dx - 12, 0, 24, Q.a, ['rgba(255,240,210,0.25)', 'rgba(255,240,210,0)', conAlfa(OMBRA, 0.3)], 1, 'orizzontale');
      inchiostra(Q, mano(r, [[dx - 12, 0], [dx - 12, Q.a]], false, 0.5, mano(r, [[dx + 12, 0], [dx + 12, Q.a]], false, 0.5)), 1.4);
    }
    tinta(c, Forme.rettangolo(0, 150, Q.l, 4), '#e0b65a');    // binario d'ottone e scaletta
    inchiostra(Q, riga(Q, 150, 0.3, riga(Q, 154, 0.3)), 0.9);
    for (const [a, b] of [[0, 1], [2, 3]]) {
      const s = Forme.poligono([[sc[a][0] - 3.5, sc[a][1]], [sc[a][0] + 3.5, sc[a][1]], [sc[b][0] + 3.5, sc[b][1]], [sc[b][0] - 3.5, sc[b][1]]]);
      aq(Q, s, '#c48a52', sc[b][0] - 4, sc[a][1], 12, sc[b][1] - sc[a][1], { bordo: 0.4, larghezzaBordo: 2 });
      inchiostra(Q, s, 1.3);
    }
    for (let y = 190; y < Q.a - 30; y += 46) {
      const f = (y - 146) / (Q.a - 168), xa = 110 - 10 * f, xb = 150 + 10 * f;
      tinta(c, Forme.rettangolo(xa, y, xb - xa, 5), '#c48a52');
      inchiostra(Q, rettMano(r, xa, y, xb - xa, 5, 0.3), 1);
    }
    for (const x of [110, 150]) { tinta(c, Forme.cerchio(x, 152, 5), '#e0b65a'); inchiostra(Q, Forme.cerchio(x, 152, 5), 1); }
  }],
  libreria_finestra: [3.0, (Q) => {
    const c = Q.c, r = Q.rng, lx = 216, ly = 420, piede = Forme.ellisse(lx, Q.a - 22, 18, 5), bocca = Forme.ellisse(lx, ly, 26, 5);
    pareteInterna(Q, '#d4e4c8', 230, '#6e4a33');
    for (let x = 16; x < Q.l; x += 32) {                      // carta da parati a righe
      c.save(); c.globalAlpha = 0.16; c.fillStyle = '#9fbf8f'; c.fillRect(x - 5, 30, 10, Q.a - 260); c.restore();
      inchiostra(Q, mano(r, [[x, 44], [x, Q.a - 236]], false, 0.4), 0.6, 0.25);
    }
    finestra(Q, 106, 120, 116, 420, { arco: true, telaio: '#8a5a3a', righe: 4, interno: stradaFuori, vetro: '#d6ecf7', spessore: 10, coloreDavanzale: '#c8a27c' });
    inchiostra(Q, mano(r, [[lx, ly], [lx, Q.a - 22]], false, 0.4), 3);   // lampada da lettura a stelo
    macchia(c, piede, '#5a4636', 1, 0.2); inchiostra(Q, piede, 1.2);
    bagliore(Q, lx, ly + 40, 120, '#ffcf70', 0.4);
    const par = Forme.poligono([[lx - 14, ly - 40], [lx + 14, ly - 40], [lx + 28, ly], [lx - 28, ly]]);
    aq(Q, par, '#f0c25a', lx - 28, ly - 40, 56, 40, { luce: 'alto', bordo: 0.4 });
    tinta(c, bocca, '#fff4c4', 0.9); inchiostra(Q, par, 1.4); inchiostra(Q, bocca, 0.9);
  }],
};

/* ============= 10. LE RICETTE DEI PAVIMENTI (256 × 256) ================== */

/** Asfalto lilla ad acquerello con puntini e qualche crepa. */
function asfalto(Q) {
  const c = Q.c, r = Q.rng;
  lavaggio(Q, 0, 0, Q.l, Q.a, '#9b92b0', { variazione: 0.3, luce: false, fioriture: 6 });
  for (let k = 0; k < 900; k++) {
    const x = r() * Q.l, y = r() * Q.a, d = tra(r, 0.6, 1.6);
    c.globalAlpha = tra(r, 0.15, 0.45); c.fillStyle = r() < 0.6 ? '#6c6382' : '#d4cde0'; c.fillRect(x, y, d, d);
  }
  c.globalAlpha = 1;
  for (let k = 0; k < 3; k++) {
    const pts = [[r() * Q.l, r() * Q.a]];
    for (let s = 0; s < 4; s++) pts.push([pts[s][0] + tra(r, -14, 14), pts[s][1] + tra(r, 6, 14)]);
    const p = mano(r, pts, false, 0.8), xs = pts.map((q) => q[0]);
    ripeti(Q, Math.min(...xs), pts[0][1], Math.max(...xs), pts[4][1], () => inchiostra(Q, p, 0.8, 0.35));
  }
}

const PAVIMENTI = {
  marciapiede: (Q) => posa(Q, 0, Q.a, {
    righe: 2, colonne: 2, sfalsa: 0.5, giunto: 3, malta: '#a2adbb', tondi: 0.03, luce: 0.35, inch: 0.85,
    colori: ['#cbd5dd', '#c2ced8', '#d6dce1', '#cad3d4', '#dde1e5', '#bfcbd6'],
    dettaglio: (r, x, y, l, a) => {                           // macchie della pietra e qualche crepa
      const m = [0, 1, 2].map(() => Forme.ellisse(x + tra(r, 15, l - 15), y + tra(r, 15, a - 15), tra(r, 8, 24), tra(r, 5, 14)));
      const crepa = r() < 0.4 ? mano(r, [[x + l * 0.7, y + 2], [x + l * 0.62, y + a * 0.25], [x + l * 0.68, y + a * 0.4]], false, 0.8) : null;
      return () => { for (const f of m) tinta(Q.c, f, '#8f9fb4', 0.12); if (crepa) inchiostra(Q, crepa, 0.8, 0.45); };
    },
  }),
  tattile: (Q) => posa(Q, 0, Q.a, {
    righe: 2, colonne: 2, giunto: 6, malta: '#d6d8d6', colori: ['#f5cd4c', '#f7d35c', '#f2c744'], tondi: 0.04, luce: 0.4, inch: 0.8,
    dettaglio: (r, x, y, l, a) => (col) => {                  // quattro barre in rilievo parallele all'asse X
      for (let k = 0; k < 4; k++) {
        const by = y + (a * (k + 0.5)) / 4, barra = Forme.rettangolo(x + 12, by - 7, l - 24, 14, 7);
        tinta(Q.c, Forme.rettangolo(x + 14, by - 4, l - 24, 14, 7), OMBRA, 0.25);
        macchia(Q.c, barra, schiarisci(col, 0.12), 1, 0.3, 1.5);
        tinta(Q.c, Forme.rettangolo(x + 18, by - 5, l - 36, 3, 1.5), '#ffffff', 0.45);
        inchiostra(Q, barra, 1, 0.75);
      }
    },
  }),
  asfalto,
  asfalto_riga: (Q) => {
    const r = Q.rng, x = 44, y = 117, l = 168, a = 22;
    asfalto(Q);
    aq(Q, Forme.rettangolo(x, y, l, a, 2), '#fbf8ef', x, y, l, a, { variazione: 0.1, bordo: 0.2, granulosita: 0.2 });
    for (let k = 0; k < 6; k++) tinta(Q.c, Forme.ellisse(x + tra(r, 10, l - 10), y + tra(r, 4, a - 4), tra(r, 3, 8), tra(r, 2, 4)), '#a59cb8', 0.3);
    inchiostra(Q, rettMano(r, x, y, l, a, 0.5), 1.1, 0.45);
  },
  mattonelle_rosa: (Q) => posa(Q, 0, Q.a, { righe: 8, colonne: 4, sfalsa: 0.5, giunto: 3, malta: '#f7cdb6', tondi: 0.22, inch: 0.55, luce: 0.5, colori: ['#f4a184', '#f6b195', '#ef9476', '#f8bea3', '#f2a88e'] }),
  ciottoli: (Q) => pietre(Q, 0, Q.a, { righe: 6, min: 0.9, max: 1.6, gap: 3, malta: '#9a7c62', inch: 0.7, colori: ['#e2c49c', '#d9b98f', '#cfa982', '#e8cfaa', '#d8b4a0', '#c9a07a'] }),
  vicolo: (Q) => {
    const r = Q.rng;
    lavaggio(Q, 0, 0, Q.l, Q.a, '#b3bf9f', { variazione: 0.3, luce: false, fioriture: 8 });
    for (let k = 0; k < 160; k++) {                           // muschio a macchioline
      const x = r() * Q.l, y = r() * Q.a, rr = tra(r, 3, 9), col = scegli(r, ['#8db27a', '#a3c487', '#7ea36d', '#c4d3a2', '#9aae84']);
      const f = Forme.poligono(blob(r, x, y, rr, rr * 0.7, 7, 0.35), true);
      ripeti(Q, x - rr * 1.4, y - rr * 1.4, x + rr * 1.4, y + rr * 1.4, () => macchia(Q.c, f, col, 0.55, 0.35, 1.2));
    }
    const p = riga(Q, 214, 1.2, riga(Q, 86, 1.2));            // lastroni consumati
    for (const [x, y0, y1] of [[40, 86, 214], [170, 86, 214], [110, -42, 86], [236, -42, 86]]) mano(r, [[x, y0], [x + tra(r, -4, 4), (y0 + y1) / 2], [x, y1]], false, 1, p);
    ripeti(Q, 0, -50, Q.l, 300, () => inchiostra(Q, p, 1, 0.3));
    for (let k = 0; k < 90; k++) {                            // foglioline cadute
      const x = r() * Q.l, y = r() * Q.a, d = tra(r, 3, 6), a = r() * 7, col = scegli(r, ['#d9b65a', '#e0975a', '#9dbb6a', '#c9a24c', '#e7c46e', '#b9c77a']);
      ripeti(Q, x - 12, y - 12, x + 12, y + 12, () => fogliaLunga(Q, x, y, d, a, col));
    }
  },
  acqua: (Q) => {
    const r = Q.rng;
    lavaggio(Q, 0, 0, Q.l, Q.a, '#a6d2ea', { variazione: 0.28, luce: false, fioriture: 5 });
    for (let k = 0; k < 14; k++) {                            // riflessi chiari del cielo
      const x = r() * Q.l, y = r() * Q.a, rx = tra(r, 20, 50), ry = tra(r, 4, 9);
      ripeti(Q, x - rx, y - ry, x + rx, y + ry, () => tinta(Q.c, Forme.ellisse(x, y, rx, ry), '#ffffff', 0.18));
    }
    for (let k = 0; k < 34; k++) {                            // increspature: onde bianche con l'ombra sotto
      const x = r() * Q.l, y = r() * Q.a, l = tra(r, 14, 46), n = 2 + Math.floor(l / 14), pts = [], forte = r() < 0.45;
      for (let i = 0; i <= n; i++) pts.push([x + (l * i) / n, y + (i % 2 ? -tra(r, 1.5, 4) : tra(r, 0, 1.5))]);
      const onda = Forme.curva(pts), sotto = Forme.curva(pts.map(([px, py]) => [px + 2, py + 4]));
      ripeti(Q, x - 4, y - 8, x + l + 4, y + 10, () => {
        linea(Q.c, sotto, { colore: '#6fa8d0', spessore: 2.2, alfa: 0.4 });
        linea(Q.c, onda, { colore: '#ffffff', spessore: forte ? 3.4 : 2.2, alfa: 0.9 });
        if (forte) inchiostra(Q, onda, 0.6, 0.35);
      });
    }
  },
  erba: (Q) => {
    const c = Q.c, r = Q.rng;
    lavaggio(Q, 0, 0, Q.l, Q.a, '#8cc46c', { variazione: 0.3, luce: false, fioriture: 6 });
    c.lineWidth = 1.6; c.globalAlpha = 0.8;
    for (let k = 0; k < 1100; k++) {                          // fili d'erba
      const x = r() * Q.l, y = r() * Q.a, h = tra(r, 5, 12), piega = tra(r, -4, 4);
      c.strokeStyle = scegli(r, ['#5f9a4a', '#6fae55', '#a6d27c', '#7fbb5f', '#c1e08f']);
      for (const [dx, dy] of copie(Q, x - 5, y - h, x + 5, y)) {
        c.beginPath(); c.moveTo(x + dx, y + dy); c.quadraticCurveTo(x + dx + piega * 0.3, y + dy - h * 0.6, x + dx + piega, y + dy - h); c.stroke();
      }
    }
    c.globalAlpha = 1;
    for (let k = 0; k < 30; k++) {                            // ciuffi a inchiostro
      const x = r() * Q.l, y = r() * Q.a, p = new Path2D();
      for (let f = 0; f < 3; f++) { const d = tra(r, -4, 4); p.moveTo(x + f * 3, y); p.quadraticCurveTo(x + f * 3 + d * 0.3, y - 5, x + f * 3 + d, y - tra(r, 7, 11)); }
      ripeti(Q, x - 6, y - 12, x + 12, y, () => inchiostra(Q, p, 0.7, 0.45));
    }
    for (let k = 0; k < 6; k++) {
      const x = r() * Q.l, y = r() * Q.a, s = seme(Q);
      ripeti(Q, x - 10, y - 10, x + 10, y + 10, () => fiorellini(c, x - 6, y - 6, 12, 12, ['#ffffff', '#fff1a8'], 2, s, 2.2));
    }
  },
  parquet: (Q) => {
    const c = Q.c, r = Q.rng, h = 32;
    for (let j = 0, y = 0; j < 8; j++, y += h) {
      for (let x = r() * Q.l, fine = x + Q.l; x < fine - 1;) {
        const l = Math.min(tra(r, 100, 200), fine - x), col = scegli(r, ['#dba068', '#cf9258', '#e4b077', '#c98b52', '#d89a5e']);
        const f = Forme.rettangolo(x + 0.8, y + 0.8, l - 1.6, h - 1.6, 1), vs = seme(Q), bx = x;
        ripeti(Q, bx, y, bx + l, y + h, () => {
          macchia(c, f, col, 1, 0.3, 2); volume(c, f, bx, y, l, h, 0.25);
          venature({ c, rng: casuale(vs) }, bx, y, l, h, col, 4, true); inchiostra(Q, f, 0.9, 0.55);
          tinta(c, Forme.cerchio(bx + 5, y + h / 2, 1.3), '#5a4030', 0.7);
        });
        x += l;
      }
    }
  },
  cotto: (Q) => posa(Q, 0, Q.a, { righe: 4, colonne: 4, giunto: 5, malta: '#efdcc4', tondi: 0.08, inch: 0.6, luce: 0.6, colori: ['#e08a5c', '#d9784c', '#e8996a', '#d4825a', '#eaa275'] }),
  soffitto_travi: (Q) => {
    const c = Q.c, p = new Path2D();
    lavaggio(Q, 0, 0, Q.l, Q.a, '#e3b27c', { variazione: 0.22, luce: false });
    for (let x = 16; x < Q.l; x += 32) riga(Q, x, 0.8, p, true);   // assi del tavolato
    inchiostra(Q, p, 1, 0.6); venature(Q, 0, 0, Q.l, Q.a, '#e3b27c', 6, false);
    for (const y of [64, 192]) {                              // due travi per cella
      ombraSotto(c, 0, y + 22, Q.l, 18, 0.4);
      lavaggio(Q, 0, y - 22, Q.l, 44, '#9a6440', { variazione: 0.22, luce: false, fioriture: 1 });
      velatura(c, 0, y - 22, Q.l, 44, ['rgba(255,235,200,0.3)', 'rgba(255,235,200,0)', conAlfa(OMBRA, 0.25)]);
      venature(Q, 0, y - 20, Q.l, 40, '#9a6440', 5, true);
      inchiostra(Q, riga(Q, y + 22, 0.6, riga(Q, y - 22, 0.6)), 1.5);
    }
  },
  tetto_tegole: (Q) => {
    const c = Q.c, r = Q.rng, n = 8, lt = Q.l / n, h = 32, rr = lt / 2 - 1, colori = ['#d9744a', '#e0855a', '#cf6a42', '#e89a6a', '#d47e55'];
    lavaggio(Q, 0, 0, Q.l, Q.a, '#8f4a35', { variazione: 0.1, luce: false, fioriture: 0 });
    // prepara una volta sola le 8 file di coppi (forma, colore, tratti)
    const file = [];
    for (let jj = 0; jj < 8; jj++) {
      file.push(Array.from({ length: n }, (_, i) => {
        const x = (jj % 2) * lt / 2 + i * lt, y = jj * h, p = new Path2D();
        p.moveTo(x + 1, y - 4); p.lineTo(x + lt - 1, y - 4); p.lineTo(x + lt - 1, y + h - 4);
        p.arc(x + lt / 2, y + h - 4, rr, 0, Math.PI); p.closePath();
        const bordo = Forme.curva([[x + 1, y + h - 4], [x + lt / 2, y + h - 4 + rr * 2], [x + lt - 1, y + h - 4]]);
        return { x, y, p, bordo, lato: mano(r, [[x + lt - 1, y], [x + lt - 1, y + h - 4]], false, 0.3), col: mescola(scegli(r, colori), scegli(r, colori), r() * 0.5) };
      }));
    }
    // dal basso in alto: le file più alte coprono le basse (la fila -1 è la 7 ripetuta sopra)
    for (let j = 8; j >= -1; j--) {
      const jj = (j + 8) % 8;
      for (const t of file[jj]) {
        for (const dx of t.x + lt > Q.l ? [0, -Q.l] : [0]) {
          sposta(Q, dx, (j - jj) * h, () => {
            ombraSotto(c, t.x, t.y + h + rr - 6, lt, 8, 0.35); macchia(c, t.p, t.col, 1, 0.3, 2);
            velatura(c, t.x, t.y, lt, h, ['rgba(110,50,40,0.25)', 'rgba(255,230,200,0.35)', 'rgba(110,50,40,0.3)'], 1, 'orizzontale');
            inchiostra(Q, t.bordo, 1.1, 0.85); inchiostra(Q, t.lato, 0.8, 0.5);
          });
        }
      }
    }
  },
};

/* ============================ 11. CREA TUTTO ============================= */

/** Dipinge tutte le texture → { muri: { nome: {colore, inchiostro, altezza} }, pavimenti: { nome: {colore, inchiostro} } } */
export async function creaTexture() {
  const muri = {}, pavimenti = {};   // ogni texture ha il suo seme: sempre uguale
  let s = 1000;
  for (const nome of Object.keys(MURI)) {
    const [altezza, dipingi] = MURI[nome], Q = nuovoQuadro(U, Math.round(U * altezza), s += 17, false);
    dipingi(Q); carta(Q);
    muri[nome] = { colore: Q.colore, inchiostro: Q.inchiostro, altezza }; await respira();
  }
  for (const nome of Object.keys(PAVIMENTI)) {
    const Q = nuovoQuadro(U, U, s += 17, true);
    PAVIMENTI[nome](Q); carta(Q);
    pavimenti[nome] = { colore: Q.colore, inchiostro: Q.inchiostro }; await respira();
  }
  return { muri, pavimenti };
}
