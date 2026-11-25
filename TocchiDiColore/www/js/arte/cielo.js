/* ==========================================================================
 *  cielo.js — CIELO, FONDALI E PARTICELLE
 *  --------------------------------------------------------------------------
 *  Qui si dipinge tutto quello che sta "lontano" o "in aria":
 *    - il cielo ad acquerello (per la cupola del cielo)
 *    - le nuvole a cumulo con il contorno dorato
 *    - la balena del cielo, la sua pinna, uccellini, piccioni, farfalle...
 *    - le casette pastello e i panorami (città, colline, mucchio di case)
 *    - le particelle bianche (il motore le colora)
 *
 *  Tutto è disegnato dal codice, sempre uguale grazie ai "semi" casuali.
 *  Funzione principale:  creaCielo()  →  { nome: { tela, fotogrammi, cella, altezzaMondo } }
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, mescola, schiarisci, scurisci, conAlfa,
  percorso, Forme, trama, linea, tinta, acquerello, pennellata, granula, fogliame,
  creaAtlante, respira,
} from './pennello.js';

const TAU = Math.PI * 2;
const OCRA = '#b08a52';        // inchiostro dorato (nuvole, pieghe della balena)
const OCRA_SCURO = '#8c6a43';  // contorno della balena
const BLU_BALENA = '#79abdf';

/* ------------------------------------------------------------------------ */
/*  PICCOLI AIUTI                                                           */
/* ------------------------------------------------------------------------ */

/** Rampa morbida: 0 prima di a, 1 dopo b, curva a "S" in mezzo. */
function morbido(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Restituisce un atlante nel formato richiesto dal motore. */
function atlante(nomi, l, a, altezzaMondo, disegna) {
  const at = creaAtlante(nomi, { l, a }, disegna);
  return { tela: at.tela, fotogrammi: at.fotogrammi, cella: { l, a }, altezzaMondo };
}

/** Una sola immagine (fotogramma "base"). */
function singola(tela, altezzaMondo) {
  const l = tela.width, a = tela.height;
  return { tela, fotogrammi: { base: { x: 0, y: 0, l, a } }, cella: { l, a }, altezzaMondo };
}

/** Copia di una tela. */
function copiaTela(t) {
  const c = nuovaTela(t.width, t.height);
  c.getContext('2d').drawImage(t, 0, 0);
  return c;
}

/**
 * Grana della carta SOLO dove c'è già colore (le parti trasparenti restano
 * trasparenti). Funziona anche su panorami ripetibili: la trama è 256x256.
 */
function granaSoloDipinto(tela, intensita) {
  const strato = copiaTela(tela);
  const s = strato.getContext('2d');
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = s.createPattern(trama2(), 'repeat');
  s.fillRect(0, 0, strato.width, strato.height);
  const ctx = tela.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = intensita;
  ctx.drawImage(strato, 0, 0);
  ctx.restore();
}

/** Grana + macchie della carta fuse insieme (creata una volta). */
let cacheTrama2 = null;
function trama2() {
  if (cacheTrama2) return cacheTrama2;
  const t = nuovaTela(256, 256), c = t.getContext('2d');
  c.drawImage(trama('grana'), 0, 0);
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.7;
  c.drawImage(trama('macchie'), 0, 0);
  cacheTrama2 = t;
  return t;
}

/**
 * Disegna qualcosa anche spostato di ±L in orizzontale se tocca i bordi:
 * così un panorama largo L si ripete senza cuciture.
 */
function avvolgi(ctx, L, xMin, xMax, disegna) {
  disegna();
  for (const dx of [-L, L]) {
    if ((dx > 0 && xMin < 0) || (dx < 0 && xMax > L)) {
      ctx.save(); ctx.translate(dx, 0); disegna(); ctx.restore();
    }
  }
}

/**
 * Acquerello "leggero" (senza filtri, veloce): colore, luce dall'alto,
 * ombra in basso, una o due macchie di pigmento e il bordo bagnato.
 */
function lava(ctx, forma, colore, area, seme, opz) {
  const o = opz || {};
  const p = percorso(forma);
  const [x, y, l, a] = area;
  const rng = casuale(seme || 1);
  ctx.save();
  ctx.clip(p);
  ctx.globalAlpha = o.alfa === undefined ? 1 : o.alfa;
  ctx.fillStyle = colore;
  ctx.fillRect(x, y, l, a);
  const luce = o.luce === undefined ? 1 : o.luce;
  const g = lineare(ctx, 0, y, 0, y + a,
    [[0, conAlfa('#fffdf4', 0.32 * luce)], [0.5, conAlfa('#fffdf4', 0)], [1, conAlfa(scurisci(colore, 0.4), 0.2 * luce)]]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, l, a);
  const macchie = o.macchie === undefined ? 2 : o.macchie;
  for (let k = 0; k < macchie; k++) {
    const cx = x + rng() * l, cy = y + rng() * a, r = Math.max(l, a) * tra(rng, 0.3, 0.6);
    alone(ctx, cx, cy, r, rng() < 0.5 ? schiarisci(colore, 0.4) : scurisci(colore, 0.2), 0.28);
  }
  const bordo = o.bordo === undefined ? 0.45 : o.bordo;
  if (bordo > 0) {   // metà interna di un tratto scuro = bordo che si asciuga
    ctx.globalAlpha = bordo;
    ctx.strokeStyle = scurisci(colore, 0.3);
    ctx.lineWidth = o.lb || 3;
    ctx.stroke(p);
  }
  ctx.restore();
}

/** Acquerello leggero su un poligono (il riquadro si calcola da solo). */
function lavaPoli(ctx, punti, colore, seme, opz) {
  const xs = punti.map((q) => q[0]), ys = punti.map((q) => q[1]);
  const x = Math.min(...xs) - 2, y = Math.min(...ys) - 2;
  const forma = Forme.poligono(punti, false);
  lava(ctx, forma, colore, [x, y, Math.max(...xs) - x + 4, Math.max(...ys) - y + 4], seme, opz);
  return forma;
}

/** Sfumatura lineare da un elenco di tappe [posizione, colore]. */
function lineare(ctx, x0, y0, x1, y1, tappe) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of tappe) g.addColorStop(p, c);
  return g;
}

/** Alone rotondo e morbido: colore al centro che svanisce verso il bordo. */
function alone(ctx, cx, cy, r, colore, alfa) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, conAlfa(colore, alfa));
  g.addColorStop(1, conAlfa(colore, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
}

/** Inchiostro seppia standard (con trasparenza facoltativa). */
function inchiostra(ctx, forma, spessore, alfa, colore) {
  linea(ctx, forma, { spessore: spessore || 1.6, alfa: alfa === undefined ? 0.9 : alfa, colore: colore || STILE.inchiostro });
}

/* ------------------------------------------------------------------------ */
/*  1. IL CIELO (texture opaca per la cupola)                               */
/* ------------------------------------------------------------------------ */

function creaTextureCielo() {
  const L = 1024, A = 512;
  const tela = nuovaTela(L, A), ctx = tela.getContext('2d');
  const rng = casuale(101);
  // sfumatura: azzurro luminoso in alto, crema chiaro all'orizzonte
  const g = lineare(ctx, 0, 0, 0, A, [[0, '#6eaee6'], [0.35, '#86bdea'], [0.62, '#b4d7f0'], [0.82, '#e3eff0'], [1, '#fdf8ea']]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, A);

  // pennellate orizzontali su uno strato più largo (per sfocarle senza cuciture)
  const M = 64;
  const strato = nuovaTela(L + 2 * M, A), s = strato.getContext('2d');
  s.translate(M, 0);
  s.lineCap = 'round';
  for (let k = 0; k < 70; k++) {
    const y = Math.pow(rng(), 1.3) * A * 0.85;
    const x = rng() * L, lung = tra(rng, 160, 520), spess = tra(rng, 5, 18);
    const chiara = rng() < 0.55;
    const colore = chiara ? '#e8f4ff' : '#4f93d6';
    const alfa = (chiara ? tra(rng, 0.10, 0.22) : tra(rng, 0.05, 0.12)) * (1 - y / A * 0.6);
    const onda = tra(rng, -6, 6);
    avvolgi(s, L, x, x + lung, () => {
      s.globalAlpha = alfa;
      s.strokeStyle = colore;
      s.lineWidth = spess;
      s.beginPath();
      s.moveTo(x, y);
      s.quadraticCurveTo(x + lung / 2, y + onda, x + lung, y + onda * 0.3);
      s.stroke();
    });
  }
  ctx.filter = 'blur(3px)';
  ctx.drawImage(strato, -M, 0);
  ctx.filter = 'none';

  // bagliore crema vicino all'orizzonte e grana della carta
  const h = lineare(ctx, 0, A * 0.55, 0, A, [[0, 'rgba(255,250,232,0)'], [1, 'rgba(255,250,232,0.55)']]);
  ctx.fillStyle = h;
  ctx.fillRect(0, A * 0.55, L, A * 0.45);
  granula(ctx, 0, 0, L, A, 0.13);
  return singola(tela, 1);
}

/* ------------------------------------------------------------------------ */
/*  2. LE NUVOLE A CUMULO                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Calcola la forma di una nuvola a cavolfiore. Restituisce degli "strati"
 * (dal più lontano al più vicino): ognuno ha un corpo e una catena di
 * sbuffi lungo il bordo alto. tipo 0..3 = cupola, due gobbe, torre, lunga.
 */
function nuvolaForma(tipo, l, a, seme) {
  const rng = casuale(seme);
  const base = a * 0.8, x0 = l * 0.1, W = l * 0.8;
  // ogni lobo è una mezza ellisse: [centro, mezza larghezza, altezza]
  const lobi = [
    [[0.5, 0.3, 1], [0.28, 0.22, 0.62], [0.73, 0.22, 0.68]],
    [[0.3, 0.22, 0.66], [0.65, 0.24, 1], [0.86, 0.13, 0.42]],
    [[0.32, 0.19, 1], [0.62, 0.28, 0.56], [0.14, 0.13, 0.42]],
    [[0.3, 0.24, 0.46], [0.6, 0.24, 0.56], [0.85, 0.14, 0.34], [0.12, 0.12, 0.3]],
  ][tipo];
  const Hm = a * 0.62;
  const alt = (t) => {
    if (t <= 0 || t >= 1) return 0;
    let h = 0;
    for (const [c, w, q] of lobi) h = Math.max(h, q * Math.sqrt(Math.max(0, 1 - ((t - c) / w) ** 2)));
    return Hm * h * Math.pow(Math.sin(Math.PI * t), 0.25);
  };

  // catena di sbuffi lungo la curva y = base − h(t)
  const catena = (h, t0, t1, rMin, rMax) => {
    const sb = [];
    for (let t = t0; t < t1;) {
      const pend = (h(t + 0.004) - h(t - 0.004)) / (0.008 * W);   // pendenza
      const n = Math.min(6, Math.hypot(pend, 1));
      const r = Math.min(rMax, rMin + h(t) * 0.16) * tra(rng, 0.82, 1.18);
      sb.push({ x: x0 + t * W + (pend / n) * r * 0.5, y: Math.min(base - r * 0.6, base - h(t) + r * 0.5 / n), r });
      t += (r * tra(rng, 0.85, 1.15)) / (W * n);
    }
    return sb.sort((p, q) => p.y - q.y);
  };
  // corpo sotto la curva (in senso orario, come le ellissi: unione senza buchi)
  const corpoSotto = (h, t0, t1) => {
    const p = new Path2D();
    p.moveTo(x0 + t0 * W, base);
    for (let k = 0; k <= 48; k++) { const t = t0 + ((t1 - t0) * k) / 48; p.lineTo(x0 + t * W, base - h(t)); }
    p.lineTo(x0 + t1 * W, base);
    p.closePath();
    return p;
  };
  const sbuffiFuori = catena(alt, 0.012, 0.99, 20, 46);
  // il corpo sta un po' più in basso degli sbuffi, così non spunta dai lati
  const tMin = (Math.min(...sbuffiFuori.map((q) => q.x)) - x0) / W + 0.01, tMax = (Math.max(...sbuffiFuori.map((q) => q.x)) - x0) / W - 0.01;
  const strati = [{ corpo: corpoSotto((t) => Math.max(0, alt(t) - 14), tMin, tMax), sbuffi: sbuffiFuori, arco: 0.5 }];
  // lobi davanti, dove la nuvola è alta
  let ta = -1;
  for (let t = 0; t <= 1.001; t += 0.01) {
    const alto = alt(t) > Hm * 0.42;
    if (alto && ta < 0) ta = t;
    if ((!alto || t > 1) && ta >= 0) {
      const t0 = ta - 0.06, t1 = t + 0.06;
      ta = -1;
      if (t1 - t0 < 0.2) continue;
      const h1 = (u) => (u <= t0 || u >= t1 ? 0 : alt(u) * 0.52 * Math.pow(Math.sin((Math.PI * (u - t0)) / (t1 - t0)), 0.5));
      strati.push({ corpo: corpoSotto((u) => Math.max(0, h1(u) - 10), t0 + 0.02, t1 - 0.02), sbuffi: catena(h1, t0 + 0.02, t1 - 0.01, 16, 34), arco: 0.38 });
    }
  }
  // sbuffi bassi e schiacciati: la base un po' ondulata
  const fondo = [];
  for (let t = 0.07; t < 0.93;) {
    const r = tra(rng, 22, 34);
    if (alt(t) > 30) fondo.push(Forme.ellisse(x0 + t * W, base - r * 0.1, r, r * 0.45));
    t += (r * 1.6) / W;
  }
  const sagoma = new Path2D();
  for (const f of fondo) sagoma.addPath(f);
  for (const st of strati) {
    st.forma = new Path2D(st.corpo);
    for (const sb of st.sbuffi) st.forma.addPath(Forme.ellisse(sb.x, sb.y, sb.r, sb.r));
    sagoma.addPath(st.forma);
  }
  return { strati, fondo, sagoma, base, Hm };
}

/**
 * Contorno dorato solo sul bordo ESTERNO di una forma fatta di tanti pezzi:
 * si traccia un bordo spesso e poi si cancella l'interno.
 */
function bordoDorato(ctx, l, a, pezzi, spessore, colore) {
  const m = nuovaTela(l, a), c = m.getContext('2d');
  c.lineJoin = 'round';
  c.strokeStyle = colore;
  c.lineWidth = spessore * 2;
  for (const p of pezzi) c.stroke(p);
  c.globalCompositeOperation = 'destination-out';
  for (const p of pezzi) c.fill(p);
  ctx.drawImage(m, 0, 0);
}

/** Dipinge una nuvola completa su una tela l x a. */
function dipingiNuvola(tipo, l, a, seme) {
  const tela = nuovaTela(l, a), ctx = tela.getContext('2d');
  const { strati, fondo, sagoma, base } = nuvolaForma(tipo, l, a, seme);
  const rng = casuale(seme + 9);
  // la base ondulata sta dietro, nel colore caldo dell'ombra
  for (const f of fondo) { ctx.fillStyle = '#f6e2b4'; ctx.fill(f); }
  for (const st of strati) {
    // 1) corpo e sbuffi bianchi; ogni sbuffo lascia un filo d'inchiostro sull'arco alto
    ctx.fillStyle = '#fffdf7';
    ctx.fill(st.corpo);
    for (const sb of st.sbuffi) {
      ctx.fillStyle = '#fffdf7';
      ctx.fill(Forme.ellisse(sb.x, sb.y, sb.r, sb.r));
      const arco = new Path2D();
      arco.ellipse(sb.x, sb.y, sb.r, sb.r, 0, Math.PI - tra(rng, 0, 0.3), TAU + tra(rng, 0, 0.3));
      linea(ctx, arco, { colore: OCRA, spessore: 1.5, alfa: st.arco });
    }
    // 2) ombra calda continua: chiaro in alto, giallo verso la base dello strato
    const cima = Math.min(...st.sbuffi.map((sb) => sb.y - sb.r));
    ctx.save();
    ctx.clip(st.forma);
    const g = lineare(ctx, 0, cima, 0, base + 10,
      [[0, 'rgba(250,226,170,0)'], [0.45, 'rgba(250,226,170,0.12)'], [0.8, 'rgba(246,212,145,0.45)'], [1, 'rgba(240,200,130,0.62)']]);
    ctx.fillStyle = g;
    ctx.fillRect(0, cima, l, base + 10 - cima);
    // 3) un riflesso morbido in alto a sinistra di ogni sbuffo (volume)
    for (const sb of st.sbuffi) alone(ctx, sb.x - sb.r * 0.25, sb.y - sb.r * 0.35, sb.r * 0.9, '#ffffff', 0.7);
    ctx.restore();
  }
  // velature gialle sparse e grana leggera
  ctx.save();
  ctx.clip(sagoma);
  for (let k = 0; k < 3; k++) alone(ctx, tra(rng, l * 0.25, l * 0.75), tra(rng, base - 80, base), tra(rng, 40, 80), '#f8dc96', 0.16);
  ctx.restore();
  granaSoloDipinto(tela, 0.06);
  // contorno esterno dorato
  bordoDorato(ctx, l, a, [sagoma], 2.2, OCRA);
  return tela;
}

function creaNuvole() {
  const nomi = ['f0', 'f1', 'f2', 'f3'];
  return atlante(nomi, 512, 320, 12, (ctx, nome, l, a) => {
    const k = nomi.indexOf(nome);
    ctx.drawImage(dipingiNuvola(k, l, a, 40 + k * 13), 0, 0);
  });
}

/* ------------------------------------------------------------------------ */
/*  3. LA BALENA DEL CIELO                                                  */
/* ------------------------------------------------------------------------ */

/**
 * Una "pagaia" (pinna arrotondata) lungo l'asse x da 0 a L, larghezza W.
 * curva: quanto si piega la punta (positivo = verso il basso).
 */
function pagaia(L, W, curva) {
  const N = 60, su = [], giu = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    let larg = W * (0.5 + 0.5 * morbido(0.1, 0.62, u));
    if (u > 0.68) larg *= Math.sqrt(Math.max(0, 1 - ((u - 0.68) / 0.32) ** 2));   // punta tonda
    if (u < 0.06) larg *= 0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - ((0.06 - u) / 0.06) ** 2));   // radice tonda
    const cx = u * L, cy = curva * L * u * u;
    const ang = Math.atan2(2 * curva * L * u, L);    // pendenza dell'asse
    su.push([cx + Math.sin(ang) * larg, cy - Math.cos(ang) * larg]);
    giu.push([cx - Math.sin(ang) * larg * 0.85, cy + Math.cos(ang) * larg * 0.85]);
  }
  giu.pop();   // la punta c'è già in "su": niente doppioni (farebbero uno spigolo)
  return Forme.poligono(su.concat(giu.reverse()), true);   // bordo morbido
}

/** La geometria del corpo: una spina dorsale curva e due spessori. */
function balenaGeometria(fase) {
  const X0 = 232, X1 = 966;
  const spina = (s) => {
    let y = 300 - 58 * Math.sin(Math.PI * s * 0.95);
    if (fase) y -= 20 * Math.pow(Math.max(0, 1 - s / 0.4), 2);   // coda un po' più su
    return [X0 + (X1 - X0) * s, y];
  };
  const f = (s) => {
    const a = 0.11 + 0.89 * (1 - Math.pow(1 - Math.min(s / 0.6, 1), 2));
    const t = Math.max(0, (s - 0.56) / 0.44);
    return a * Math.sqrt(Math.max(0, 1 - Math.pow(t, 2.3)));
  };
  const hA = (s) => 108 * f(s), hB = (s) => 142 * f(s);
  const alto = (s) => { const [x, y] = spina(s); return [x, y - hA(s)]; };
  const basso = (s) => { const [x, y] = spina(s); return [x, y + hB(s)]; };
  // confine blu/crema: poco sopra la spina, sale verso il muso
  const confine = (s) => { const [x, y] = spina(s); return [x, y - hA(s) * (0.12 + 0.8 * morbido(0.66, 1, s))]; };
  // linea della bocca (e limite alto delle pieghe)
  const bocca = (s) => { const [x, y] = spina(s); return [x, y + hB(s) * (0.2 - 0.16 * morbido(0.66, 0.99, s))]; };
  return { spina, alto, basso, confine, bocca, hA, hB };
}

/** Crea un Path2D da una funzione s → punto, campionata tra s0 e s1. */
function traccia(p, fn, s0, s1, n, prima) {
  for (let i = 0; i <= n; i++) {
    const q = fn(s0 + (s1 - s0) * (i / n));
    if (i === 0 && prima) p.moveTo(q[0], q[1]); else p.lineTo(q[0], q[1]);
  }
}

function dipingiBalena(ctx, fase) {
  const G = balenaGeometria(fase);
  const N = 120;
  const area = [0, 0, 1024, 512];
  // --- corpo
  const contorno = new Path2D();   // aperto: niente taglio verticale vicino alla coda
  traccia(contorno, G.alto, 0, 1, N, true);
  traccia(contorno, G.basso, 1, 0, N, false);
  const corpo = new Path2D(contorno);
  corpo.closePath();
  const dorso = new Path2D();
  traccia(dorso, G.alto, 0, 1, N, true);
  traccia(dorso, G.confine, 1, 0, N, false);
  dorso.closePath();

  // --- coda (dietro al corpo)
  const [cx0, cy0] = G.spina(0);
  const coda = new Path2D();
  coda.moveTo(14, -12);
  coda.bezierCurveTo(-22, -22, -50, -56, -70, -88);
  coda.bezierCurveTo(-86, -66, -88, -30, -56, -5);
  coda.quadraticCurveTo(-50, 0, -56, 5);
  coda.bezierCurveTo(-88, 30, -86, 66, -70, 88);
  coda.bezierCurveTo(-50, 56, -22, 22, 14, 12);
  coda.closePath();
  ctx.save();
  ctx.translate(cx0, cy0);
  ctx.rotate(fase ? -0.2 : 0.12);
  acquerello(ctx, coda, '#6c9fd6', { area: [-100, -100, 130, 200], seme: 31 + fase, bordo: 0.3, variazione: 0.2, granulosita: 0.15, luce: 'alto' });
  inchiostra(ctx, coda, 2.4, 0.95, OCRA_SCURO);
  linea(ctx, Forme.curva([[8, 0], [-20, 0], [-48, 0]]), { colore: '#4d7cb5', spessore: 1.4, alfa: 0.4 });
  ctx.restore();

  // --- pinna dorsale (dietro al corpo)
  const [dx, dy] = G.alto(0.27);
  const dorsale = Forme.poligono([[dx + 30, dy + 10], [dx + 4, dy - 4], [dx - 22, dy - 26], [dx - 20, dy - 8], [dx - 30, dy + 10]], true);
  acquerello(ctx, dorsale, '#5f93cf', { area: [dx - 40, dy - 30, 80, 44], seme: 5, bordo: 0.2, granulosita: 0.1 });
  inchiostra(ctx, dorsale, 2.2, 0.95, OCRA_SCURO);

  // --- pancia color crema
  acquerello(ctx, corpo, '#fdf8e8', { area, seme: 21, variazione: 0.12, granulosita: 0.12, bordo: 0.18, larghezzaBordo: 6 });
  ctx.save();
  ctx.clip(corpo);
  const ombraPancia = lineare(ctx, 0, 260, 0, 400, [[0, 'rgba(232,200,150,0)'], [1, 'rgba(222,186,140,0.42)']]);
  ctx.fillStyle = ombraPancia;
  ctx.fillRect(0, 240, 1024, 200);

  // --- pieghe della gola: tante linee sottili dorate
  const rng = casuale(77 + fase);
  const NP = 10;
  for (let i = 0; i < NP; i++) {
    const u = 0.05 + (i / (NP - 1)) * 0.86;
    const sFine = 0.3 + rng() * 0.08 + (1 - u) * 0.04;
    const punto = (s) => { const b = G.basso(s), t = G.bocca(s); return [b[0], b[1] + (t[1] - b[1]) * u]; };
    const p = new Path2D();
    traccia(p, punto, sFine, 0.995, 60, true);
    const xa = punto(sFine)[0], xb = punto(sFine + 0.12)[0];
    const gr = lineare(ctx, xa, 0, xb, 0, [[0, conAlfa(OCRA, 0)], [1, conAlfa(OCRA, 0.9)]]);
    ctx.strokeStyle = gr;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.stroke(p);
  }
  ctx.restore();

  // --- dorso blu
  acquerello(ctx, dorso, BLU_BALENA, { area: [150, 100, 830, 280], seme: 13, variazione: 0.16, granulosita: 0.18, bordo: 0.15, luce: null });
  ctx.save();
  ctx.clip(dorso);
  const scuro = lineare(ctx, 0, 130, 0, 300, [[0, 'rgba(58,104,170,0.45)'], [1, 'rgba(58,104,170,0)']]);
  ctx.fillStyle = scuro;
  ctx.fillRect(0, 100, 1024, 220);
  ctx.restore();
  // riflesso chiaro lungo la schiena
  const riflesso = [];
  for (let s = 0.12; s <= 0.86; s += 0.04) { const [x, y] = G.alto(s); riflesso.push([x, y + G.hA(s) * 0.38]); }
  ctx.save();
  ctx.clip(dorso);
  pennellata(ctx, riflesso, '#d6ebfd', 18, 0.14);
  ctx.restore();
  // linea tra blu e crema
  const conf = new Path2D();
  traccia(conf, G.confine, 0.02, 0.99, 80, true);
  linea(ctx, conf, { colore: '#4e7fbb', spessore: 1.4, alfa: 0.55 });

  // --- bocca e occhio
  const bocca = new Path2D();
  traccia(bocca, G.bocca, 0.992, 0.68, 50, true);
  const [bx, by] = G.bocca(0.68);
  bocca.quadraticCurveTo(bx - 14, by + 2, bx - 18, by - 10);
  inchiostra(ctx, bocca, 2.2, 0.95, OCRA_SCURO);
  const [ox, oy] = G.spina(0.715);
  tinta(ctx, Forme.ellisse(ox, oy + 2, 6.5, 7.5), '#3b2c3a');
  tinta(ctx, Forme.cerchio(ox + 2, oy - 1, 2), '#ffffff');
  linea(ctx, Forme.curva([[ox - 10, oy - 9], [ox, oy - 14], [ox + 10, oy - 10]]), { colore: OCRA_SCURO, spessore: 1.6, alfa: 0.7 });
  // sfiatatoio
  const [sx, sy] = G.alto(0.8);
  linea(ctx, Forme.curva([[sx - 10, sy + 6], [sx, sy + 2], [sx + 10, sy + 7]]), { colore: '#3f6ea8', spessore: 1.6, alfa: 0.7 });

  // --- contorno del corpo
  inchiostra(ctx, contorno, 2.6, 0.95, OCRA_SCURO);

  // --- pinna pettorale (davanti)
  const [px, py] = G.spina(0.6);
  ctx.save();
  ctx.translate(px + 10, py + G.hB(0.6) * 0.36);
  ctx.rotate(fase ? 1.85 : 2.2);
  const pinna = pagaia(150, 40, fase ? 0.1 : -0.04);
  tinta(ctx, pinna, 'rgba(70,90,140,0.12)');   // ombra sotto
  acquerello(ctx, pinna, '#6a9ed8', { area: [-10, -50, 200, 100], seme: 9 + fase, bordo: 0.25, granulosita: 0.15, luce: 'alto' });
  linea(ctx, Forme.curva([[16, -16], [70, -26], [118, -20]]), { colore: '#d4e8fb', spessore: 6, alfa: 0.25 });
  inchiostra(ctx, pinna, 2.4, 0.95, OCRA_SCURO);
  ctx.restore();
}

function creaBalena() {
  return atlante(['f0', 'f1'], 1024, 512, 14, (ctx, nome) => dipingiBalena(ctx, nome === 'f1' ? 1 : 0));
}

/** La grande pinna vista dall'alto (sequenza del volo). */
function creaPinna() {
  return atlante(['f0', 'f1'], 512, 256, 4, (ctx, nome) => {
    const f = nome === 'f1' ? 1 : 0;
    ctx.save();
    ctx.translate(26, 124);
    ctx.rotate(f ? 0.05 : -0.04);
    const p = pagaia(462, 76, f ? 0.07 : -0.03);
    tinta(ctx, p, 'rgba(40,50,90,0.18)');
    ctx.translate(0, -4);
    acquerello(ctx, p, '#5b93cc', { area: [-10, -110, 500, 220], seme: 61 + f, variazione: 0.14, granulosita: 0.18, bordo: 0.3, larghezzaBordo: 7, luce: 'alto' });
    ctx.save();
    ctx.clip(p);
    const g = lineare(ctx, 0, -80, 0, 80, [[0, 'rgba(160,205,240,0.45)'], [0.45, 'rgba(160,205,240,0)'], [1, 'rgba(40,80,140,0.3)']]);
    ctx.fillStyle = g;
    ctx.fillRect(-10, -110, 520, 220);
    pennellata(ctx, [[40, -28], [180, -50], [320, -50], [400, -34]], '#cfe6fa', 18, 0.2);
    ctx.restore();
    inchiostra(ctx, p, 3, 0.95);
    ctx.restore();
  });
}

/* ------------------------------------------------------------------------ */
/*  4. CREATURE DEL CIELO E DELLA PIAZZA                                    */
/* ------------------------------------------------------------------------ */

/** Ala morbida dalla spalla S alla punta T, con il bordo posteriore piumato. */
function ala(S, T, larghezza) {
  const dx = T[0] - S[0], dy = T[1] - S[1], L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;              // normale
  const punti = [S, [S[0] + dx * 0.5 + nx * larghezza * 0.6, S[1] + dy * 0.5 + ny * larghezza * 0.6], T];
  // bordo posteriore con 3 piume
  for (let k = 1; k <= 3; k++) {
    const t = 1 - k * 0.24;
    const off = larghezza * (k % 2 ? 0.75 : 0.45) * (0.6 + t * 0.5);
    punti.push([S[0] + dx * t - nx * off, S[1] + dy * t - ny * off]);
  }
  punti.push([S[0] - nx * larghezza * 0.3 - dx * 0.05, S[1] - ny * larghezza * 0.3 - dy * 0.05]);
  return Forme.poligono(punti, true);
}

function dipingiUccellino(ctx, k) {
  const lilla = '#7b6aa0', scuro = '#5e4f84', pancia = '#c3b5d9';
  const punte = [[34, 3], [18, 16], [30, 58], [16, 38]];
  const T = punte[k];
  // ala lontana (più scura, dietro al corpo)
  tinta(ctx, ala([50, 30], [T[0] + 10, T[1] + (T[1] < 30 ? 4 : -6)], 9), scurisci(scuro, 0.15));
  // coda
  const coda = Forme.poligono([[30, 34], [9, 27], [12, 35], [8, 43], [30, 40]], true);
  contornaMorbido(ctx, coda, scuro);
  // corpo e pancia
  const corpo = Forme.ellisse(45, 36, 20, 13, -0.12);
  contornaMorbido(ctx, corpo, lilla, () => tinta(ctx, Forme.ellisse(48, 44, 17, 8, -0.1), pancia));
  // testa
  const testa = Forme.cerchio(63, 27, 10.5);
  contornaMorbido(ctx, testa, lilla);
  // becco
  const becco = Forme.poligono([[72, 24], [82, 28.5], [72, 31]], false);
  contornaMorbido(ctx, becco, '#eab35e');
  tinta(ctx, Forme.cerchio(66, 25, 1.9), '#2e2230');
  tinta(ctx, Forme.cerchio(66.6, 24.4, 0.6), '#ffffff');
  tinta(ctx, Forme.ellisse(64, 31, 3, 2), 'rgba(240,150,170,0.6)');
  // ala vicina
  contornaMorbido(ctx, ala([50, 30], T, 11), scuro);
}

/** Tinta piatta con un filo di luce, dettaglio facoltativo e contorno seppia. */
function contornaMorbido(ctx, forma, colore, dettaglio) {
  const p = percorso(forma);
  tinta(ctx, p, colore);
  ctx.save();
  ctx.clip(p);
  if (dettaglio) dettaglio();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = schiarisci(colore, 0.6);
  ctx.lineWidth = 3;
  ctx.translate(1.5, 1.5);
  ctx.stroke(p);
  ctx.restore();
  inchiostra(ctx, p, 1.5, 0.95);
}

/** Pose del piccione: corpo, testa, ali (0 chiuse, 0.5 si aprono, 1 aperte), zampe. */
const POSE_PICCIONE = [
  { dy: 0, rot: -0.12, testa: [88, 34], ali: 0, aTerra: true },
  { dy: 2, rot: 0.22, testa: [99, 80], ali: 0, aTerra: true },
  { dy: 5, rot: -0.05, testa: [90, 42], ali: 0.5, aTerra: true },
  { dy: -16, rot: -0.38, testa: [84, 22], ali: 1, aTerra: false },
];

function dipingiPiccione(ctx, k) {
  const P = POSE_PICCIONE[k];
  const grigio = '#aaa4bf', scuro = '#7e7799', collo = '#8fb7a4', viola = '#9a84b8';
  const cx = 58, cy = 62 + P.dy;
  const loc = (x, y) => {   // punto del corpo → punto della tela
    const c = Math.cos(P.rot), s = Math.sin(P.rot);
    return [cx + x * c - y * s, cy + x * s + y * c];
  };
  // ombra a terra
  tinta(ctx, Forme.ellisse(62, 93, P.aTerra ? 26 : 16, 3.5), 'rgba(80,60,100,' + (P.aTerra ? 0.2 : 0.1) + ')');
  // ala lontana quando vola
  if (P.ali === 1) contornaMorbido(ctx, ala(loc(6, -10), [44, 2], 12), scurisci(scuro, 0.1));
  // zampe
  const rosa = '#e1879a';
  if (P.aTerra) {
    for (const z of [-5, 6]) {
      const [x, y] = loc(z, 14);
      linea(ctx, Forme.curva([[x, y], [x + 1, 93]]), { colore: rosa, spessore: 3 });
      linea(ctx, Forme.curva([[x - 5, 93.5], [x + 7, 93.5]]), { colore: rosa, spessore: 2.4 });
    }
  } else {
    for (const z of [-4, 5]) {
      const [x, y] = loc(z, 14);
      linea(ctx, Forme.curva([[x, y], [x - 4, y + 9]]), { colore: rosa, spessore: 3 });
    }
  }
  // coda
  contornaMorbido(ctx, Forme.poligono([loc(-22, -2), loc(-46, 4), loc(-46, 11), loc(-22, 8)], true), scuro);
  // collo cangiante (dietro al corpo)
  const [qx, qy] = loc(16, -5);
  const [tx, ty] = P.testa;
  const lc = Math.hypot(tx - qx, ty - qy), nx = -(ty - qy) / lc, ny = (tx - qx) / lc;
  const collo2 = Forme.poligono([[qx + nx * 15, qy + ny * 15], [tx + nx * 9, ty + ny * 9], [tx - nx * 9, ty - ny * 9], [qx - nx * 15, qy - ny * 15]], false);
  contornaMorbido(ctx, collo2, grigio, () => {
    tinta(ctx, Forme.ellisse(qx * 0.6 + tx * 0.4 + nx * 4, qy * 0.6 + ty * 0.4 + ny * 4, 8, 7), conAlfa(collo, 0.9));
    tinta(ctx, Forme.ellisse(qx * 0.75 + tx * 0.25 - nx * 4, qy * 0.75 + ty * 0.25 - ny * 4, 8, 7), conAlfa(viola, 0.75));
  });
  // corpo
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(P.rot);
  contornaMorbido(ctx, Forme.ellisse(0, 0, 30, 16.5), grigio, () => {
    tinta(ctx, Forme.ellisse(4, 10, 26, 8), 'rgba(255,255,255,0.18)');
  });
  if (P.ali === 0) {   // ala chiusa con due barre scure
    const alaC = Forme.ellisse(-6, -3, 21, 9.5, 0.08);
    contornaMorbido(ctx, alaC, '#9d97b4', () => {
      linea(ctx, Forme.curva([[-6, -10], [-4, -2], [-8, 6]]), { colore: '#5d5675', spessore: 2.4, alfa: 0.8 });
      linea(ctx, Forme.curva([[-14, -9], [-12, -1], [-16, 6]]), { colore: '#5d5675', spessore: 2.4, alfa: 0.8 });
    });
  }
  ctx.restore();
  // testa
  contornaMorbido(ctx, Forme.cerchio(tx, ty, 10), grigio);
  const verso = ty > 60 ? 1 : 0;   // se becca, il becco punta in basso
  const becco = verso
    ? Forme.poligono([[tx + 4, ty + 7], [tx + 6, ty + 16], [tx + 9, ty + 6]], false)
    : Forme.poligono([[tx + 8, ty - 2], [tx + 17, ty + 2], [tx + 8, ty + 3]], false);
  contornaMorbido(ctx, becco, '#8d7f8c');
  tinta(ctx, Forme.cerchio(tx + 3, ty - 2 + verso * 2, 2.6), '#f0a050');
  tinta(ctx, Forme.cerchio(tx + 3, ty - 2 + verso * 2, 1.2), '#2e2230');
  // ali aperte
  if (P.ali > 0) {
    const S = loc(6, -10);
    const T = P.ali === 1 ? [16, 4] : [24, 30 + P.dy];
    contornaMorbido(ctx, ala(S, T, P.ali === 1 ? 15 : 12), '#9d97b4');
    linea(ctx, Forme.curva([S, [(S[0] + T[0]) / 2, (S[1] + T[1]) / 2 + 3]]), { colore: '#5d5675', spessore: 2.2, alfa: 0.7 });
  }
}

function dipingiFarfalla(ctx, aperta) {
  ctx.save();
  ctx.translate(32, 33);
  const sx = aperta ? 1 : 0.24;
  for (const lato of [-1, 1]) {
    ctx.save();
    ctx.scale(lato * sx, 1);
    const anteriore = Forme.poligono([[1, -2], [8, -19], [21, -26], [29, -19], [25, -5], [3, 1]], true);
    const posteriore = Forme.poligono([[1, 1], [17, 0], [23, 12], [13, 23], [3, 15]], true);
    contornaMorbido(ctx, posteriore, '#f4a3b8', () => tinta(ctx, Forme.cerchio(14, 13, 3.4), '#fbe1a6'));
    contornaMorbido(ctx, anteriore, '#f6c95f', () => {
      tinta(ctx, Forme.cerchio(21, -17, 3), '#e98b6c');
      tinta(ctx, Forme.cerchio(13, -10, 2.2), '#fff3cf');
    });
    ctx.restore();
  }
  contornaMorbido(ctx, Forme.ellisse(0, 0, 2.4, 13), '#6b4b3a');
  linea(ctx, Forme.curva([[-1, -12], [-4, -20], [-8, -25]]), { spessore: 1.2 });
  linea(ctx, Forme.curva([[1, -12], [4, -20], [8, -25]]), { spessore: 1.2 });
  ctx.restore();
}

function dipingiPalloncino(ctx) {
  const pallone = new Path2D();
  pallone.moveTo(64, 14);
  pallone.bezierCurveTo(126, 14, 122, 108, 64, 138);
  pallone.bezierCurveTo(6, 108, 2, 14, 64, 14);
  pallone.closePath();
  // filo
  linea(ctx, Forme.curva([[64, 146], [58, 170], [70, 196], [58, 222], [64, 252]]), { colore: STILE.inchiostroChiaro, spessore: 1.6 });
  acquerello(ctx, pallone, '#f59fb2', { area: [4, 14, 120, 126], seme: 88, variazione: 0.2, granulosita: 0.18, bordo: 0.4, larghezzaBordo: 6, luce: 'alto' });
  tinta(ctx, Forme.poligono([[64, 136], [56, 148], [72, 148]], true), '#e9879c');
  inchiostra(ctx, Forme.poligono([[64, 136], [56, 148], [72, 148]], true), 1.5);
  // riflesso
  ctx.save();
  ctx.filter = 'blur(2px)';
  tinta(ctx, Forme.ellisse(44, 50, 11, 20, 0.5), 'rgba(255,255,255,0.75)');
  ctx.filter = 'none';
  ctx.restore();
  tinta(ctx, Forme.ellisse(40, 40, 4, 7, 0.5), '#ffffff', 0.9);
  inchiostra(ctx, pallone, 2);
}

/* ------------------------------------------------------------------------ */
/*  5. LE CASETTE PASTELLO                                                  */
/* ------------------------------------------------------------------------ */

const CASE = [
  { muro: '#f4b7c0', tetto: '#e08a5f', tipo: 'frontone', tex: 'coppi', w: 100, h: 92, d: 56, rh: 54, piani: 2, col: 2, fin: 'rett', camino: true, persiane: '#7fb39a' },
  { muro: '#f7dc8c', tetto: '#7d8fb3', tipo: 'falda', tex: 'ardesia', w: 84, h: 150, d: 44, rh: 36, piani: 4, col: 2, fin: 'rett' },
  { muro: '#bfe3cf', tetto: '#e0735f', tipo: 'torre', tex: 'coppi', w: 80, h: 128, rh: 84, piani: 3, col: 1, fin: 'arco' },
  { muro: '#b9d7f0', tetto: '#ece4d2', tipo: 'piatto', w: 118, h: 112, d: 50, piani: 3, col: 3, fin: 'arco', fiori: true },
  { muro: '#f8c79a', tetto: '#cf6f4f', tipo: 'falda', tex: 'coppi', w: 122, h: 84, d: 54, rh: 42, piani: 2, col: 3, fin: 'rett', camino: true, persiane: '#6fa0c8' },
  { muro: '#cdb9e3', tetto: '#6f7fa6', tipo: 'frontone', tex: 'ardesia', w: 78, h: 128, d: 46, rh: 58, piani: 3, col: 2, fin: 'rett', oblo: true },
  { muro: '#fbf0d6', tetto: '#7fae7c', tipo: 'frontone', tex: 'liscio', w: 126, h: 80, d: 56, rh: 48, piani: 2, col: 3, fin: 'arco', camino: true },
  { muro: '#f19a8a', tetto: '#f4d79b', tipo: 'cupola', w: 96, h: 108, d: 48, rh: 44, piani: 3, col: 2, fin: 'arco' },
  { muro: '#f6cf6f', tetto: '#a8745a', tipo: 'falda', tex: 'coppi', w: 104, h: 118, d: 50, rh: 40, piani: 3, col: 2, fin: 'rett', balcone: true, fiori: true },
  { muro: '#cfe6a8', tetto: '#d9695a', tipo: 'frontone', tex: 'coppi', w: 92, h: 108, d: 50, rh: 52, piani: 3, col: 2, fin: 'rett', fiori: true, persiane: '#e9a55f' },
  { muro: '#f7c6d9', tetto: '#6d8fc9', tipo: 'torre', tex: 'ardesia', w: 66, h: 146, rh: 72, piani: 4, col: 1, fin: 'tondo' },
  { muro: '#a9c4d8', tetto: '#cfc7da', tipo: 'piatto', w: 110, h: 140, d: 52, piani: 4, col: 3, fin: 'rett', camino: true },
];

/**
 * Tegole o ardesie su una falda (quadrilatero): e0→e1 è la gronda,
 * r0→r1 il colmo. Righe parallele alla gronda + piccoli tagli.
 */
function tegole(ctx, e0, e1, r1, r0, tipo, colore) {
  const falda = Forme.poligono([e0, e1, r1, r0], false);
  ctx.save();
  ctx.clip(falda);
  ctx.strokeStyle = scurisci(colore, 0.35);
  ctx.lineCap = 'round';
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const lungAlt = Math.hypot(r0[0] - e0[0], r0[1] - e0[1]);
  const lungLarg = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  if (tipo === 'liscio') {
    ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
    for (let t = 0.2; t < 1; t += 0.3) { const a = lerp(e0, r0, t), b = lerp(e1, r1, t); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.restore(); return;
  }
  const passo = tipo === 'coppi' ? 9 : 7;
  const righe = Math.max(2, Math.round(lungAlt / passo));
  const colonne = Math.max(2, Math.round(lungLarg / (tipo === 'coppi' ? 7 : 9)));
  ctx.lineWidth = 1.1;
  for (let i = 0; i <= righe; i++) {
    const t = i / righe;
    const a = lerp(e0, r0, t), b = lerp(e1, r1, t);
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    // tagli verticali sfalsati (coppi: archetti, ardesia: tacche)
    ctx.globalAlpha = 0.4;
    const t2 = Math.min(1, (i + 1) / righe);
    for (let j = 0; j < colonne; j++) {
      const u = (j + (i % 2) * 0.5) / colonne;
      const p = lerp(lerp(e0, e1, u), lerp(r0, r1, u), t), q = lerp(lerp(e0, e1, u), lerp(r0, r1, u), t2);
      ctx.beginPath();
      if (tipo === 'coppi') ctx.arc(p[0], p[1] - 1, 3.2, 0.2, Math.PI - 0.2);
      else { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Una finestra con cornice, vetro, eventuali persiane e vaso di fiori. */
function finestra(ctx, cx, cy, ww, wh, forma, persiane, fiori, seme) {
  const x = cx - ww / 2, y = cy - wh / 2;
  const vetro = forma === 'tondo' ? Forme.cerchio(cx, cy, ww / 2)
    : forma === 'arco' ? (() => { const p = new Path2D(); p.moveTo(x, y + wh); p.lineTo(x, y + ww / 2); p.arc(cx, y + ww / 2, ww / 2, Math.PI, 0); p.lineTo(x + ww, y + wh); p.closePath(); return p; })()
      : Forme.rettangolo(x, y, ww, wh, 1);
  if (persiane && forma === 'rett') {
    for (const s of [-1, 1]) {
      const px = s < 0 ? x - ww * 0.48 : x + ww * 1.02;
      const pers = Forme.rettangolo(px, y - 1, ww * 0.46, wh + 2, 1);
      tinta(ctx, pers, persiane);
      for (let k = 1; k < 5; k++) linea(ctx, Forme.curva([[px + 1, y + (wh * k) / 5], [px + ww * 0.45, y + (wh * k) / 5]]), { colore: scurisci(persiane, 0.3), spessore: 0.8, alfa: 0.6 });
      inchiostra(ctx, pers, 1, 0.7);
    }
  }
  tinta(ctx, vetro, '#fbf6ea');
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(0.78, 0.84); ctx.translate(-cx, -cy);
  const g = lineare(ctx, x, y, x + ww, y + wh, [[0, '#9fb6d6'], [0.5, '#6f84ab'], [1, '#5a6890']]);
  tinta(ctx, vetro, g);
  ctx.restore();
  if (forma !== 'tondo' && ww > 9) {
    linea(ctx, Forme.curva([[cx, y + 3], [cx, y + wh - 2]]), { colore: '#fbf6ea', spessore: 1.4 });
    linea(ctx, Forme.curva([[x + 2, cy + 1], [x + ww - 2, cy + 1]]), { colore: '#fbf6ea', spessore: 1.4 });
  }
  inchiostra(ctx, vetro, 1.2, 0.85);
  if (fiori) {
    const vaso = Forme.rettangolo(x - 2, y + wh - 1, ww + 4, 5, 1);
    contorna(ctx, vaso, '#c98a64');
    const rng = casuale(seme);
    for (let k = 0; k < 5; k++) {
      tinta(ctx, Forme.cerchio(x + rng() * ww, y + wh - 3 + rng() * 2, 2.6), '#79a865');
      tinta(ctx, Forme.cerchio(x + rng() * ww, y + wh - 4 + rng() * 2, 1.8), ['#f27b8e', '#f6d66b', '#fff'][k % 3]);
    }
  }
}
function contorna(ctx, forma, colore) { tinta(ctx, forma, colore); inchiostra(ctx, forma, 1, 0.8); }

/** Porta ad arco con un gradino. */
function porta(ctx, cx, yb, pw, ph, colore) {
  const p = new Path2D();
  p.moveTo(cx - pw / 2, yb);
  p.lineTo(cx - pw / 2, yb - ph + pw / 2);
  p.arc(cx, yb - ph + pw / 2, pw / 2, Math.PI, 0);
  p.lineTo(cx + pw / 2, yb);
  p.closePath();
  lava(ctx, p, colore, [cx - pw / 2, yb - ph, pw, ph], 3, { bordo: 0.3 });
  tinta(ctx, Forme.cerchio(cx + pw * 0.25, yb - ph * 0.45, 1.5), '#f3d27a');
  inchiostra(ctx, p, 1.4);
  contorna(ctx, Forme.rettangolo(cx - pw / 2 - 4, yb - 3, pw + 8, 4, 1), '#d8cfc4');
}

/** Disegna la casetta numero k nella cella (base in basso al centro). */
function disegnaCasetta(ctx, k, L, A) {
  const p = CASE[k];
  const seme = 300 + k * 17;
  const rng = casuale(seme);
  const torre = p.tipo === 'torre';
  const d = torre ? 0 : p.d;
  const Dx = d * 0.55, Dy = -d * 0.36;
  const yb = A - 5 - (torre ? p.w * 0.14 : 0);
  const x0 = Math.round(L / 2 - (p.w + Dx) / 2), x1 = x0 + p.w, yt = yb - p.h, xm = x0 + p.w / 2;
  const latoColore = mescola(scurisci(p.muro, 0.14), '#b8a6d6', 0.2);
  const tettoLato = scurisci(p.tetto, 0.18);
  const o = 7;   // sporgenza della gronda
  // ombra a terra
  tinta(ctx, Forme.ellisse(L / 2 + Dx * 0.2, yb + 1, p.w * 0.6 + Dx * 0.5, 4), 'rgba(90,70,110,0.2)');

  if (torre) {
    // cilindro con tetto a cono
    const e = p.w * 0.14;
    const corpo = new Path2D();
    corpo.moveTo(x0, yt); corpo.lineTo(x0, yb);
    corpo.ellipse(xm, yb, p.w / 2, e, 0, Math.PI, 0, true);
    corpo.lineTo(x1, yt); corpo.closePath();
    lava(ctx, corpo, p.muro, [x0, yt, p.w, p.h + e], seme, { bordo: 0.35 });
    ctx.save(); ctx.clip(corpo);
    ctx.fillStyle = lineare(ctx, x0, 0, x1, 0, [[0, 'rgba(255,253,240,0.35)'], [0.45, 'rgba(255,253,240,0)'], [1, 'rgba(90,70,120,0.3)']]);
    ctx.fillRect(x0, yt, p.w, p.h + e);
    ctx.restore();
    inchiostra(ctx, corpo);
    const ph = (p.h - 40) / p.piani;
    for (let r = 0; r < p.piani; r++) finestra(ctx, xm, yt + 22 + r * ph, 15, 22, p.fin, null, r === 1, seme + r);
    porta(ctx, xm, yb + e * 0.6, 20, 32, mescola(p.tetto, '#6b4b3a', 0.4));
    const cono = new Path2D();
    cono.moveTo(x0 - o, yt); cono.lineTo(xm, yt - p.rh); cono.lineTo(x1 + o, yt);
    cono.ellipse(xm, yt, p.w / 2 + o, e + 2, 0, 0, Math.PI, false);
    cono.closePath();
    lava(ctx, cono, p.tetto, [x0 - o, yt - p.rh, p.w + 2 * o, p.rh + e], seme + 2, { bordo: 0.4 });
    ctx.save(); ctx.clip(cono);
    ctx.strokeStyle = scurisci(p.tetto, 0.35); ctx.globalAlpha = 0.45; ctx.lineWidth = 1.1;
    for (let t = 0.2; t < 1.05; t += 0.12) { ctx.beginPath(); ctx.ellipse(xm, yt - p.rh * (1 - t), (p.w / 2 + o) * t, (e + 2) * t, 0, 0, Math.PI); ctx.stroke(); }
    for (let u = -0.8; u <= 0.81; u += 0.2) { ctx.beginPath(); ctx.moveTo(xm, yt - p.rh); ctx.lineTo(xm + u * (p.w / 2 + o), yt + Math.sqrt(1 - u * u) * e); ctx.stroke(); }
    const ombra = lineare(ctx, x0, 0, x1, 0, [[0.5, 'rgba(60,40,80,0)'], [1, 'rgba(60,40,80,0.3)']]);
    ctx.globalAlpha = 1; ctx.fillStyle = ombra; ctx.fillRect(x0 - o, yt - p.rh, p.w + 2 * o, p.rh + e + 4);
    ctx.restore();
    inchiostra(ctx, cono);
    // pennacchio in cima
    linea(ctx, Forme.curva([[xm, yt - p.rh], [xm, yt - p.rh - 12]]), { spessore: 1.6 });
    contorna(ctx, Forme.poligono([[xm, yt - p.rh - 12], [xm + 10, yt - p.rh - 9], [xm, yt - p.rh - 6]]), '#f6d66b');
    return;
  }

  // --- lato destro (in ombra) e facciata
  const lato = lavaPoli(ctx, [[x1, yb], [x1 + Dx, yb + Dy], [x1 + Dx, yt + Dy], [x1, yt]], latoColore, seme + 1, { bordo: 0.3 });
  const fronte = Forme.rettangolo(x0, yt, p.w, p.h, 0);
  lava(ctx, fronte, p.muro, [x0, yt, p.w, p.h], seme, { bordo: 0.35 });

  // --- tetto
  const pezziTetto = [];
  if (p.tipo === 'frontone') {
    const apice = [xm, yt - p.rh];
    const pend = p.rh / (p.w / 2);
    const eS = [x0 - o, yt + o * pend], eD = [x1 + o, yt + o * pend];
    const frontone = lavaPoli(ctx, [[x0, yt + 1], apice, [x1, yt + 1]], p.muro, seme + 3, { bordo: 0.2, luce: 0.5 });
    inchiostra(ctx, frontone, 1.4, 0.7);
    // falda destra che va indietro
    const fd = [eD, [eD[0] + Dx, eD[1] + Dy], [apice[0] + Dx, apice[1] + Dy], apice];
    pezziTetto.push(lavaPoli(ctx, fd, tettoLato, seme + 4, { bordo: 0.3 }));
    tegole(ctx, fd[0], fd[1], fd[2], fd[3], p.tex, tettoLato);
    // bordo del tetto (spessore) sul davanti
    pezziTetto.push(lavaPoli(ctx, [eS, apice, eD, [eD[0] - 2, eD[1] + 6], [xm, yt - p.rh + 7], [eS[0] + 2, eS[1] + 6]], p.tetto, seme + 5, { bordo: 0.2 }));
    if (p.oblo) finestra(ctx, xm, yt - p.rh * 0.38, 15, 15, 'tondo', null, false, seme);
    else finestra(ctx, xm, yt - p.rh * 0.35, 11, 14, 'arco', null, false, seme);
  } else if (p.tipo === 'falda') {
    const e0 = [x0 - o, yt + 3], e1 = [x1 + o, yt + 3];
    const r0 = [x0 - o + Dx / 2, yt - p.rh + Dy / 2], r1 = [x1 + o + Dx / 2, yt - p.rh + Dy / 2];
    // timpano sul lato
    lavaPoli(ctx, [[x1, yt + 1], [x1 + Dx, yt + Dy + 1], [x1 + Dx / 2, yt - p.rh + Dy / 2 + 2]], latoColore, seme + 6, { bordo: 0.2 });
    // falda posteriore vista di taglio (dietro alla falda davanti)
    const b1 = [x1 + o + Dx, yt + 3 + Dy];
    const dietro = lavaPoli(ctx, [r1, b1, [b1[0] - 2, b1[1] + 6], [r1[0] - 3, r1[1] + 8]], tettoLato, seme + 8, { bordo: 0.2 });
    const faldaF = lavaPoli(ctx, [e0, e1, r1, r0], p.tetto, seme + 7, { bordo: 0.3 });
    tegole(ctx, e0, e1, r1, r0, p.tex, p.tetto);
    const spessore = lavaPoli(ctx, [e0, e1, [e1[0], e1[1] + 5], [e0[0], e0[1] + 5]], scurisci(p.tetto, 0.25), seme + 9, { bordo: 0 });
    pezziTetto.push(dietro, faldaF, spessore);
    // abbaino
    if (p.w > 110) finestra(ctx, xm + Dx * 0.25, yt - p.rh * 0.4, 12, 12, 'arco', null, false, seme);
  } else {
    // tetto piatto con cornicione (e cupola)
    pezziTetto.push(lavaPoli(ctx, [[x0 - 3, yt], [x1 + 3, yt], [x1 + 3 + Dx, yt + Dy], [x0 - 3 + Dx, yt + Dy]], p.tetto, seme + 9, { bordo: 0.2 }));
    const corn = Forme.rettangolo(x0 - 4, yt - 2, p.w + 8, 7, 1);
    lava(ctx, corn, schiarisci(p.muro, 0.45), [x0 - 4, yt - 2, p.w + 8, 7], seme, { bordo: 0.2 });
    pezziTetto.push(corn);
    if (p.tipo === 'cupola') {
      const cx = xm + Dx / 2, cy = yt + Dy / 2;
      const tamb = Forme.rettangolo(cx - p.w * 0.24, cy - 12, p.w * 0.48, 14, 1);
      lava(ctx, tamb, schiarisci(p.muro, 0.3), [cx - p.w * 0.24, cy - 12, p.w * 0.48, 14], seme, { bordo: 0.2 });
      inchiostra(ctx, tamb, 1.3);
      const cup = new Path2D();
      cup.moveTo(cx - p.w * 0.28, cy - 10);
      cup.ellipse(cx, cy - 10, p.w * 0.28, p.rh, 0, Math.PI, 0);
      cup.closePath();
      lava(ctx, cup, p.tetto, [cx - p.w * 0.28, cy - 10 - p.rh, p.w * 0.56, p.rh], seme + 10, { bordo: 0.4 });
      ctx.save(); ctx.clip(cup);
      for (let u = -0.6; u <= 0.61; u += 0.3) linea(ctx, Forme.curva([[cx, cy - 10 - p.rh], [cx + u * p.w * 0.2, cy - 10 - p.rh * 0.5], [cx + u * p.w * 0.28, cy - 10]]), { colore: scurisci(p.tetto, 0.3), spessore: 1, alfa: 0.5 });
      ctx.restore();
      inchiostra(ctx, cup, 1.5);
      contorna(ctx, Forme.rettangolo(cx - 4, cy - 10 - p.rh - 10, 8, 11, 2), schiarisci(p.muro, 0.4));
      contorna(ctx, Forme.cerchio(cx, cy - 10 - p.rh - 13, 3), '#f6d66b');
    }
  }

  // --- finestre sulla facciata
  const ph = (p.h - 12) / p.piani;
  const cw = p.w / p.col;
  const portaCol = p.col === 1 ? 0 : Math.floor(rng() * p.col);
  for (let r = 0; r < p.piani; r++) {
    const terra = r === p.piani - 1;
    for (let c = 0; c < p.col; c++) {
      const cx = x0 + cw * (c + 0.5), cy = yt + 8 + ph * (r + 0.5);
      if (terra && c === portaCol) { porta(ctx, cx, yb, Math.min(cw * 0.5, 22), Math.min(ph * 0.92, 36), mescola(p.tetto, '#7a5a48', 0.45)); continue; }
      const ww = Math.min(cw * 0.42, p.persiane ? 13 : 16), wh = Math.min(ph * 0.62, ww * 1.5);
      finestra(ctx, cx, cy, ww, wh, p.fin, p.persiane, p.fiori && r === 1, seme + r * 7 + c);
    }
  }
  if (p.balcone) {
    const by = yt + 8 + ph * 1.9;
    contorna(ctx, Forme.rettangolo(x0 + 8, by, p.w - 16, 4, 1), '#e9e0d0');
    for (let x = x0 + 12; x < x1 - 10; x += 6) linea(ctx, Forme.curva([[x, by], [x, by - 12]]), { spessore: 1.1, alfa: 0.8 });
    linea(ctx, Forme.curva([[x0 + 8, by - 12], [x1 - 8, by - 12]]), { spessore: 1.4 });
  }
  // --- finestre sul lato (deformate in prospettiva)
  ctx.save();
  ctx.transform(Dx / d, Dy / d, 0, 1, x1, yb);
  for (let r = 0; r < p.piani; r++) {
    const vy = -p.h + 8 + ph * (r + 0.5);
    const fin = Forme.rettangolo(d * 0.35, vy - 8, d * 0.3, 16, 1);
    tinta(ctx, fin, '#7486ab', 0.75);
    inchiostra(ctx, fin, 1, 0.6);
  }
  ctx.restore();

  // --- camino
  if (p.camino) {
    const cx = p.tipo === 'frontone' ? xm + Dx * 0.55 + p.w * 0.12 : x0 + p.w * 0.25 + Dx * 0.3;
    const cy = p.tipo === 'frontone' ? yt - p.rh * 0.62 + Dy * 0.55 : p.tipo === 'falda' ? yt - p.rh * 0.75 + Dy * 0.3 : yt + Dy * 0.5;
    const fr = Forme.rettangolo(cx - 6, cy - 24, 12, 26, 0);
    const lt = Forme.poligono([[cx + 6, cy + 2], [cx + 11, cy - 1], [cx + 11, cy - 27], [cx + 6, cy - 24]]);
    contorna(ctx, lt, scurisci('#d98f6e', 0.2));
    lava(ctx, fr, '#d98f6e', [cx - 6, cy - 24, 12, 26], seme, { bordo: 0.2 });
    inchiostra(ctx, fr, 1.3);
    contorna(ctx, Forme.rettangolo(cx - 8, cy - 28, 20, 5, 1), '#b9a7a0');
  }

  // --- contorni a inchiostro
  inchiostra(ctx, lato, 1.5);
  inchiostra(ctx, fronte, 1.6);
  for (const t of pezziTetto) inchiostra(ctx, t, 1.5);
}

function creaCasette() {
  const nomi = CASE.map((_, k) => 'f' + k);
  const at = atlante(nomi, 256, 256, 1.0, (ctx, nome, l, a) => disegnaCasetta(ctx, nomi.indexOf(nome), l, a));
  granaSoloDipinto(at.tela, 0.2);
  return at;
}

/* ------------------------------------------------------------------------ */
/*  6. I PANORAMI RIPETIBILI                                                */
/* ------------------------------------------------------------------------ */

const PASTELLI = ['#f3b6b8', '#f6d08b', '#bcdcc4', '#b7d0ea', '#d8c3e6', '#f7c9a0', '#f0e3b4', '#c9e0a8', '#f5bfd2', '#a9cbd6'];
const TETTI = ['#e08a5f', '#cf6f4f', '#7d8fb3', '#a8745a', '#d9695a', '#8fae86'];

/** Velo d'aria: schiarisce (e azzurra) tutto quello già dipinto. */
function veloAria(ctx, L, A, colore, alfa) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alfa;
  ctx.fillStyle = colore;
  ctx.fillRect(0, 0, L, A);
  ctx.restore();
}

/** Un alberello tondo (chioma a ciuffi) con la base in (x, y). */
function alberello(ctx, x, y, r, colore, seme) {
  const rng = casuale(seme);
  linea(ctx, Forme.curva([[x, y], [x + 1, y - r * 0.9]]), { colore: '#8a6a52', spessore: Math.max(1.5, r * 0.18) });
  const chioma = new Path2D();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + rng();
    chioma.addPath(Forme.cerchio(x + Math.cos(a) * r * 0.45, y - r * 1.4 + Math.sin(a) * r * 0.35, r * tra(rng, 0.5, 0.7)));
  }
  chioma.addPath(Forme.cerchio(x, y - r * 1.4, r * 0.7));
  lava(ctx, chioma, colore, [x - r * 1.2, y - r * 2.3, r * 2.4, r * 2], seme, { bordo: 0.35, lb: 2 });
  ctx.save(); ctx.clip(chioma);
  tinta(ctx, Forme.ellisse(x - r * 0.3, y - r * 1.75, r * 0.5, r * 0.3), schiarisci(colore, 0.35), 0.5);
  ctx.restore();
}

/** Un palazzo lontano visto di fronte (per lo skyline). */
function palazzo(ctx, x, yb, w, h, colore, tetto, tipo, seme, inchiostro) {
  const rng = casuale(seme);
  const yt = yb - h;
  const fronte = Forme.rettangolo(x, yt, w, h + 4, 0);
  lava(ctx, fronte, colore, [x, yt, w, h], seme, { bordo: 0.3, lb: 2.5 });
  let forma = null;
  if (tipo === 0) {        // frontone a punta
    forma = Forme.poligono([[x - 3, yt + 2], [x + w / 2, yt - w * 0.42], [x + w + 3, yt + 2]]);
    lava(ctx, forma, tetto, [x - 3, yt - w * 0.42, w + 6, w * 0.45], seme + 1, { bordo: 0.3, lb: 2 });
  } else if (tipo === 1) { // tetto a falda visto di fronte
    forma = Forme.poligono([[x - 3, yt + 2], [x + w + 3, yt + 2], [x + w - 6, yt - 14], [x + 6, yt - 14]]);
    lava(ctx, forma, tetto, [x - 3, yt - 14, w + 6, 16], seme + 1, { bordo: 0.3, lb: 2 });
  } else if (tipo === 2) { // cornicione piatto
    forma = Forme.rettangolo(x - 3, yt - 3, w + 6, 6, 1);
    tinta(ctx, forma, schiarisci(colore, 0.5));
  } else {                 // torretta
    forma = Forme.poligono([[x + w * 0.3, yt + 1], [x + w * 0.5, yt - 26], [x + w * 0.7, yt + 1]]);
    lava(ctx, forma, tetto, [x + w * 0.3, yt - 26, w * 0.4, 27], seme + 1, { bordo: 0.3, lb: 2 });
  }
  // finestre
  const fw = Math.max(3, Math.min(7, w / 9)), fh = fw * 1.5;
  const cols = Math.max(1, Math.floor((w - 8) / (fw * 2.4)));
  const passoX = (w - 8) / cols;
  const vetro = mescola(colore, '#5f7096', 0.5);
  for (let yy = yt + 10; yy < yb - fh - 4; yy += fh * 2.1) {
    for (let c = 0; c < cols; c++) {
      if (rng() < 0.12) continue;
      tinta(ctx, Forme.rettangolo(x + 4 + passoX * (c + 0.5) - fw / 2, yy, fw, fh, 1), vetro, 0.7);
    }
  }
  if (inchiostro > 0) {
    inchiostra(ctx, fronte, 1.2, inchiostro);
    if (forma) inchiostra(ctx, forma, 1.2, inchiostro);
  }
}

/** La cattedrale con il campanile e la guglia. */
function cattedrale(ctx, x, yb) {
  const pietra = '#e3d7bd', ombra = '#cbbfa8', tetto = '#9fb1c0';
  // navata
  palazzo(ctx, x - 90, yb, 120, 190, pietra, tetto, 0, 900, 0.5);
  finestra(ctx, x - 30, yb - 150, 26, 26, 'tondo', null, false, 1);
  // campanile
  const tx = x + 30, tw = 62;
  const torre = Forme.rettangolo(tx, yb - 350, tw, 350, 0);
  lava(ctx, torre, pietra, [tx, yb - 350, tw, 350], 901, { bordo: 0.3 });
  ctx.save(); ctx.clip(torre);
  tinta(ctx, Forme.rettangolo(tx + tw * 0.68, yb - 350, tw * 0.32, 350, 0), ombra, 0.5);
  ctx.restore();
  for (let k = 0; k < 4; k++) {
    const y = yb - 320 + k * 70;
    linea(ctx, Forme.curva([[tx - 3, y + 40], [tx + tw + 3, y + 40]]), { spessore: 2.5, colore: ombra });
    finestra(ctx, tx + tw / 2, y + 10, 12, 30, 'arco', null, false, k);
  }
  inchiostra(ctx, torre, 1.3, 0.5);
  // guglia con pinnacoli
  const guglia = Forme.poligono([[tx - 4, yb - 348], [tx + tw / 2, yb - 470], [tx + tw + 4, yb - 348]]);
  lava(ctx, guglia, tetto, [tx - 4, yb - 470, tw + 8, 124], 902, { bordo: 0.4 });
  ctx.save(); ctx.clip(guglia);
  tinta(ctx, Forme.poligono([[tx + tw / 2, yb - 470], [tx + tw + 4, yb - 348], [tx + tw / 2 + 4, yb - 348]]), 'rgba(60,70,100,0.25)');
  ctx.restore();
  inchiostra(ctx, guglia, 1.3, 0.5);
  for (const px of [tx - 4, tx + tw - 4]) {
    const pin = Forme.poligono([[px, yb - 346], [px + 4, yb - 380], [px + 8, yb - 346]]);
    contorna(ctx, pin, tetto);
  }
  linea(ctx, Forme.curva([[tx + tw / 2, yb - 470], [tx + tw / 2, yb - 486]]), { spessore: 1.5, alfa: 0.6 });
  linea(ctx, Forme.curva([[tx + tw / 2 - 6, yb - 480], [tx + tw / 2 + 6, yb - 480]]), { spessore: 1.5, alfa: 0.6 });
}

/** Una basilica con la cupola. */
function basilica(ctx, x, yb) {
  palazzo(ctx, x - 70, yb, 140, 160, '#efe2c6', '#b9c9c2', 2, 950, 0.45);
  const tamb = Forme.rettangolo(x - 42, yb - 205, 84, 46, 0);
  lava(ctx, tamb, '#e8dcc0', [x - 42, yb - 205, 84, 46], 951, { bordo: 0.3 });
  for (let k = -2; k <= 2; k++) finestra(ctx, x + k * 15, yb - 182, 6, 14, 'arco', null, false, k);
  inchiostra(ctx, tamb, 1.2, 0.45);
  const cup = new Path2D();
  cup.moveTo(x - 50, yb - 203);
  cup.ellipse(x, yb - 203, 50, 62, 0, Math.PI, 0);
  cup.closePath();
  lava(ctx, cup, '#9fbdb4', [x - 50, yb - 265, 100, 62], 952, { bordo: 0.4 });
  ctx.save(); ctx.clip(cup);
  for (let u = -0.7; u <= 0.71; u += 0.35) linea(ctx, Forme.curva([[x, yb - 265], [x + u * 38, yb - 240], [x + u * 50, yb - 203]]), { colore: '#6f8f88', spessore: 1.2, alfa: 0.5 });
  ctx.restore();
  inchiostra(ctx, cup, 1.3, 0.5);
  contorna(ctx, Forme.rettangolo(x - 7, yb - 282, 14, 18, 3), '#efe2c6');
  contorna(ctx, Forme.cerchio(x, yb - 286, 4), '#9fbdb4');
}

/**
 * Una fila di palazzi affiancati lungo tutto il panorama (ripetibile).
 * o: { w: [min, max], h: [min, max], tipi, nebbia: [colore, quanto], inchiostro, passo: [min, max], buchi }
 */
function filaDiPalazzi(ctx, rng, L, A, o) {
  for (let x = -20; x < L;) {
    const w = tra(rng, o.w[0], o.w[1]), h = tra(rng, o.h[0], o.h[1]);
    const tipo = Math.floor(rng() * o.tipi), seme = Math.floor(rng() * 1e6);
    const col = mescola(PASTELLI[Math.floor(rng() * PASTELLI.length)], o.nebbia[0], o.nebbia[1]);
    const tetto = mescola(TETTI[Math.floor(rng() * TETTI.length)], o.nebbia[0], o.nebbia[1] * 0.9);
    avvolgi(ctx, L, x - 10, x + w + 10, () => palazzo(ctx, x, A, w, h, col, tetto, tipo, seme, o.inchiostro));
    x += w * tra(rng, o.passo[0], o.passo[1]) + (rng() < o.buchi ? tra(rng, 20, 50) : 0);
  }
}

/** Una fila di alberelli tondi (ripetibile). */
function filaDiAlberi(ctx, rng, L, passo, r, y, colori) {
  for (let x = 20; x < L; x += tra(rng, passo[0], passo[1])) {
    const rr = tra(rng, r[0], r[1]), seme = Math.floor(rng() * 1e6), yy = tra(rng, y[0], y[1]);
    const col = mescola(colori[0], colori[1], rng());
    avvolgi(ctx, L, x - rr * 1.3, x + rr * 1.3, () => alberello(ctx, x, yy, rr, col, seme));
  }
}

function creaPanoramaCitta() {
  const L = 2048, A = 512;
  const tela = nuovaTela(L, A), ctx = tela.getContext('2d');
  const rng = casuale(500);
  // a) fila lontana: sagome alte e azzurrine
  filaDiPalazzi(ctx, rng, L, A, { w: [60, 120], h: [190, 330], tipi: 4, nebbia: ['#c6d8ea', 0.55], inchiostro: 0.2, passo: [0.7, 0.95], buchi: 0 });
  veloAria(ctx, L, A, '#e4eef6', 0.42);
  // b) monumenti: la cattedrale e la basilica
  avvolgi(ctx, L, 450, 720, () => cattedrale(ctx, 590, A - 20));
  avvolgi(ctx, L, 1380, 1580, () => basilica(ctx, 1480, A - 60));
  veloAria(ctx, L, A, '#e4eef6', 0.25);
  // c) fila di mezzo, poi alberi in mezzo alle case
  filaDiPalazzi(ctx, rng, L, A, { w: [55, 110], h: [120, 230], tipi: 3, nebbia: ['#eef2f2', 0.25], inchiostro: 0.35, passo: [0.85, 1.05], buchi: 0.15 });
  veloAria(ctx, L, A, '#e8f0f4', 0.18);
  filaDiAlberi(ctx, rng, L, [50, 140], [16, 26], [A - 90, A - 30], ['#8fbf7a', '#a8c9b0']);
  // d) fila davanti, bassa e più colorata, con qualche albero
  filaDiPalazzi(ctx, rng, L, A, { w: [50, 95], h: [60, 140], tipi: 3, nebbia: ['#ffffff', 0], inchiostro: 0.45, passo: [0.9, 1.1], buchi: 0.25 });
  filaDiAlberi(ctx, rng, L, [90, 220], [14, 22], [A + 4, A + 4], ['#86b874', '#86b874']);
  // velo leggero d'insieme e grana della carta
  veloAria(ctx, L, A, '#eef4f8', 0.12);
  granaSoloDipinto(tela, 0.2);
  return singola(tela, 18);
}

/** Profilo periodico (si ripete ogni L pixel): somma di onde intere. */
function profilo(L, onde) {
  return (x) => onde.reduce((s, [amp, cicli, fase]) => s + amp * Math.sin((TAU * cicli * x) / L + fase), 0);
}

function creaPanoramaColline() {
  const L = 2048, A = 384;
  const tela = nuovaTela(L, A), ctx = tela.getContext('2d');
  const rng = casuale(600);
  const strati = [
    { y: 120, col: '#a3c4d3', onde: [[42, 2, 0.5], [22, 5, 1.7], [9, 11, 0.2]], alberi: 0 },
    { y: 175, col: '#a6cbbd', onde: [[36, 3, 2.1], [18, 7, 0.4], [7, 13, 1.1]], alberi: 40 },
    { y: 235, col: '#9cc79c', onde: [[30, 2, 4.0], [16, 6, 2.6], [6, 15, 0.9]], alberi: 70 },
    { y: 295, col: '#8dbd82', onde: [[24, 3, 1.0], [12, 8, 3.3], [5, 17, 2.2]], alberi: 90 },
  ];
  strati.forEach((st, i) => {
    const f = profilo(L, st.onde);
    const quota = (x) => st.y + f(x);
    const collina = new Path2D();
    collina.moveTo(-20, A + 5);
    for (let x = -20; x <= L + 20; x += 8) collina.lineTo(x, quota(x));
    collina.lineTo(L + 20, A + 5);
    collina.closePath();
    ctx.save();
    ctx.clip(collina);
    ctx.fillStyle = st.col;
    ctx.fillRect(0, 0, L, A);
    const g = lineare(ctx, 0, st.y - 50, 0, A,
      [[0, conAlfa(schiarisci(st.col, 0.5), 0.45)], [0.5, conAlfa(st.col, 0)], [1, conAlfa(scurisci(st.col, 0.25), 0.3)]]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, L, A);
    // macchie di colore (ripetute ai bordi)
    for (let k = 0; k < 14; k++) {
      const cx = rng() * L, cy = st.y + rng() * (A - st.y), r = tra(rng, 60, 160);
      const tono = rng() < 0.5 ? schiarisci(st.col, 0.4) : mescola(st.col, '#6f9f6a', 0.4);
      avvolgi(ctx, L, cx - r, cx + r, () => alone(ctx, cx, cy, r, tono, 0.3));
    }
    // campi: pennellate chiare orizzontali
    if (i >= 2) for (let k = 0; k < 10; k++) {
      const x = rng() * L, y = st.y + tra(rng, 10, 70), lung = tra(rng, 60, 160);
      avvolgi(ctx, L, x, x + lung, () => linea(ctx, Forme.curva([[x, y], [x + lung / 2, y + 3], [x + lung, y]]), { colore: schiarisci(st.col, 0.5), spessore: tra(casuale(k), 4, 9), alfa: 0.3 }));
    }
    // bordo bagnato in cima
    ctx.globalAlpha = 0.5; ctx.strokeStyle = scurisci(st.col, 0.25); ctx.lineWidth = 3;
    ctx.stroke(collina);
    ctx.restore();
    // boschetti di alberelli sulla collina
    const col = mescola(scurisci(st.col, 0.3), '#4f8a5a', 0.45);
    for (let k = 0; k < st.alberi / 5; k++) {
      const bx = rng() * L, quanti = 2 + Math.floor(rng() * 6);
      for (let j = 0; j < quanti; j++) {
        const x = bx + tra(rng, -18, 18) * (1 + i * 0.4), r = tra(rng, 3, 5) * (0.7 + i * 0.3);
        const y = quota(x) + tra(rng, 3, 14) + (i ? tra(rng, 0, 50) * (j === 0 ? 1 : 0.1) : 0);
        const tono = mescola(col, '#3f7a4c', rng() * 0.5);
        avvolgi(ctx, L, x - r * 2, x + r * 2, () => {
          linea(ctx, Forme.curva([[x, y], [x, y - r]]), { colore: '#7a6a55', spessore: Math.max(1, r * 0.3), alfa: 0.7 });
          tinta(ctx, Forme.ellisse(x, y - r * 1.4, r, r * 1.1), tono, 0.92);
          tinta(ctx, Forme.ellisse(x + r * 0.3, y - r * 1.1, r * 0.7, r * 0.6), scurisci(tono, 0.2), 0.4);
          tinta(ctx, Forme.ellisse(x - r * 0.3, y - r * 1.8, r * 0.45, r * 0.4), schiarisci(tono, 0.45), 0.6);
        });
      }
    }
    veloAria(ctx, L, A, '#eaf2f6', i < 3 ? 0.12 : 0);
  });
  granaSoloDipinto(tela, 0.22);
  return singola(tela, 10);
}

/** Mucchio di casette: usa le casette già dipinte, rimpicciolite e ricolorate. */
function creaPanoramaMucchio(casette) {
  const L = 2048, A = 512;
  const tela = nuovaTela(L, A), ctx = tela.getContext('2d');
  const rng = casuale(700);
  // sprite rimpiccioliti (12 case x 3 varianti di colore)
  const S = 112;
  const sprite = [];
  const filtri = ['saturate(1.15)', 'hue-rotate(-25deg) saturate(1.2)', 'hue-rotate(20deg) brightness(1.03)'];
  for (const filtro of filtri) {
    for (let k = 0; k < 12; k++) {
      const t = nuovaTela(S, S), c = t.getContext('2d');
      const f = casette.fotogrammi['f' + k];
      c.imageSmoothingQuality = 'high';
      c.filter = filtro;
      c.drawImage(casette.tela, f.x, f.y, f.l, f.a, 0, 0, S, S);
      sprite.push(t);
    }
  }
  // tre alberi
  const alberi = [0, 1, 2].map((k) => {
    const t = nuovaTela(96, 96);
    fogliame(t.getContext('2d'), 48, 46, 34, { seme: 710 + k, colori: ['#5f9a5e', '#7fb46a', '#a9d38a'], quante: 46, inchiostro: 0.4, schiaccia: 0.8 });
    return t;
  });
  const cima = profilo(L, [[48, 1, 1.0], [30, 3, 2.0], [14, 7, 0.4]]);
  const vetta = (x) => 130 + cima(x);
  // riempimento sotto le case (ombre tra una casa e l'altra)
  const fondo = new Path2D();
  fondo.moveTo(-20, A + 5);
  for (let x = -20; x <= L + 20; x += 8) fondo.lineTo(x, vetta(x) + 55);
  fondo.lineTo(L + 20, A + 5);
  fondo.closePath();
  lava(ctx, fondo, '#d9b7a8', [0, 100, L, A], 701, { macchie: 0, bordo: 0 });
  // righe di case, dalla più lontana (in alto, piccole) alla più vicina
  for (let y = 60; y < A + 90;) {
    const prof = Math.min(1, y / A);
    const scala = 0.55 + 1.05 * prof;          // le case vicine sono più grandi
    for (let x = rng() * 30 - 30; x < L;) {
      const dim = S * scala * tra(rng, 0.88, 1.1);
      const yy = y + tra(rng, -5, 5);
      if (yy > vetta(x) + dim * 0.5) {
        if (rng() < 0.1) {
          const t = alberi[Math.floor(rng() * 3)], dd = dim * 0.7;
          avvolgi(ctx, L, x - dd / 2, x + dd / 2, () => ctx.drawImage(t, x - dd / 2, yy - dd * 0.85, dd, dd));
        } else {
          const sp = sprite[Math.floor(rng() * sprite.length)], specchio = rng() < 0.4;
          avvolgi(ctx, L, x - dim / 2, x + dim / 2, () => {
            ctx.save();
            ctx.translate(x, yy);
            if (specchio) ctx.scale(-1, 1);
            ctx.drawImage(sp, -dim / 2, -dim, dim, dim);
            ctx.restore();
          });
        }
      }
      x += dim * tra(rng, 0.36, 0.5);
    }
    veloAria(ctx, L, A, '#f8f3e8', 0.06);
    y += 14 + 30 * prof;
  }
  granaSoloDipinto(tela, 0.12);
  return singola(tela, 16);
}

/* ------------------------------------------------------------------------ */
/*  7. LE PARTICELLE (bianche: il motore le colora)                         */
/* ------------------------------------------------------------------------ */

const BIANCO = '#ffffff', GRIGIO = '#d9d9df';

/** Riempie di bianco con un'ombra grigia in basso a destra. */
function bianco(ctx, forma, cx, cy, r) {
  const p = percorso(forma);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.15);
  g.addColorStop(0, BIANCO);
  g.addColorStop(0.6, '#f6f6f8');
  g.addColorStop(1, GRIGIO);
  ctx.fillStyle = g;
  ctx.fill(p);
}

function stella(cx, cy, punte, rEst, rInt, ruota) {
  const pts = [];
  for (let k = 0; k < punte * 2; k++) {
    const a = ruota + (k * Math.PI) / punte;
    const r = k % 2 ? rInt : rEst;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return Forme.poligono(pts, false);
}

const PARTICELLE = [
  (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 58); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); },
  (c) => { const s = stella(64, 68, 5, 52, 23, -Math.PI / 2); c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = '#f4f4f6'; c.stroke(s); bianco(c, s, 64, 66, 50); },
  (c) => {
    const p = new Path2D();
    p.moveTo(64, 6); p.quadraticCurveTo(70, 58, 122, 64); p.quadraticCurveTo(70, 70, 64, 122); p.quadraticCurveTo(58, 70, 6, 64); p.quadraticCurveTo(58, 58, 64, 6); p.closePath();
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 40); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); c.fillStyle = BIANCO; c.fill(p);
  },
  (c) => { const p = new Path2D(); p.moveTo(64, 12); p.bezierCurveTo(104, 40, 94, 104, 64, 116); p.bezierCurveTo(34, 104, 24, 40, 64, 12); bianco(c, p, 64, 64, 52); linea(c, Forme.curva([[64, 30], [62, 70], [64, 104]]), { colore: GRIGIO, spessore: 2.5, alfa: 0.7 }); },
  (c) => {
    c.translate(64, 64); c.rotate(-0.7);
    const p = new Path2D(); p.moveTo(-54, 0); p.quadraticCurveTo(0, -34, 54, 0); p.quadraticCurveTo(0, 34, -54, 0);
    bianco(c, p, 0, 0, 50);
    linea(c, Forme.curva([[-54, 0], [50, 0]]), { colore: GRIGIO, spessore: 2.5 });
    for (let k = -2; k <= 2; k++) { linea(c, Forme.curva([[k * 16, 0], [k * 16 + 12, -12]]), { colore: GRIGIO, spessore: 1.6 }); linea(c, Forme.curva([[k * 16, 0], [k * 16 + 12, 12]]), { colore: GRIGIO, spessore: 1.6 }); }
  },
  (c) => {
    const testa = Forme.ellisse(46, 94, 19, 14, -0.45);
    bianco(c, testa, 46, 94, 20);
    tinta(c, Forme.rettangolo(58, 22, 8, 74, 3), BIANCO);
    const band = new Path2D(); band.moveTo(60, 22); band.bezierCurveTo(78, 34, 98, 40, 96, 70); band.bezierCurveTo(92, 52, 78, 46, 64, 46); band.closePath();
    tinta(c, band, BIANCO);
  },
  (c) => { const rng = casuale(66); for (let k = 0; k < 9; k++) { const x = tra(rng, 26, 102), y = tra(rng, 30, 100), r = tra(rng, 6, 14); const pts = []; for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU; pts.push([x + Math.cos(a) * r * tra(rng, 0.7, 1.1), y + Math.sin(a) * r * tra(rng, 0.7, 1.1)]); } bianco(c, Forme.poligono(pts, true), x, y, r); } },
  (c) => { const p = new Path2D(); p.moveTo(64, 112); p.bezierCurveTo(8, 72, 14, 18, 64, 40); p.bezierCurveTo(114, 18, 120, 72, 64, 112); bianco(c, p, 64, 62, 54); },
  (c) => {
    const g = c.createRadialGradient(64, 64, 20, 64, 64, 50); g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0.9)');
    c.fillStyle = g; c.fill(Forme.cerchio(64, 64, 50));
    linea(c, Forme.cerchio(64, 64, 49), { colore: BIANCO, spessore: 3 });
    linea(c, Forme.curva([[38, 44], [46, 34], [58, 29]]), { colore: BIANCO, spessore: 6 });
  },
  (c) => { c.filter = 'blur(5px)'; const rng = casuale(9); for (let k = 0; k < 7; k++) { const x = tra(rng, 36, 92), y = tra(rng, 44, 86), r = tra(rng, 18, 30); bianco(c, Forme.cerchio(x, y, r), x, y, r); } c.filter = 'none'; },
  (c) => { const p = new Path2D(); p.moveTo(64, 8); p.bezierCurveTo(72, 40, 98, 60, 98, 84); p.bezierCurveTo(98, 104, 82, 118, 64, 118); p.bezierCurveTo(46, 118, 30, 104, 30, 84); p.bezierCurveTo(30, 60, 56, 40, 64, 8); bianco(c, p, 64, 84, 40); tinta(c, Forme.ellisse(50, 88, 6, 12, 0.3), BIANCO); },
  (c) => {
    const pts = []; const ret = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; const x = 30 + 66 * t, y = 108 - 92 * t + Math.sin(t * Math.PI) * 10; const w = 16 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)); pts.push([x - w * 0.8, y - w * 0.6]); ret.unshift([x + w * 0.8, y + w * 0.6]); }
    bianco(c, Forme.poligono(pts.concat(ret), true), 64, 64, 50);
    for (let k = 2; k < 10; k++) { const t = k / 10; const x = 30 + 66 * t, y = 108 - 92 * t + Math.sin(t * Math.PI) * 10; linea(c, Forme.curva([[x, y], [x - 10, y - 2]]), { colore: GRIGIO, spessore: 1.2 }); }
    linea(c, Forme.curva([[24, 118], [44, 92], [70, 56], [96, 16]]), { colore: GRIGIO, spessore: 2.5 });
  },
  (c) => {
    c.translate(64, 64); c.rotate(0.15);
    const p = Forme.poligono([[-30, -40], [18, -40], [32, -26], [32, 42], [-30, 42]]);
    bianco(c, p, 0, 0, 50); inchiostra(c, p, 1.5, 1, GRIGIO);
    tinta(c, Forme.poligono([[18, -40], [18, -26], [32, -26]]), GRIGIO);
    for (let y = -22; y < 36; y += 9) linea(c, Forme.curva([[-22, y], [22, y]]), { colore: GRIGIO, spessore: 2 });
  },
  (c) => { for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU - Math.PI / 2; const x = 64 + Math.cos(a) * 26, y = 64 + Math.sin(a) * 26; bianco(c, Forme.ellisse(x, y, 22, 17, a), x, y, 22); } tinta(c, Forme.cerchio(64, 64, 14), GRIGIO); },
  (c) => { const p = new Path2D(); for (const [x, y, r] of [[40, 76, 22], [62, 58, 28], [88, 70, 22], [70, 84, 20], [102, 84, 14], [26, 88, 12]]) p.addPath(Forme.cerchio(x, y, r)); p.addPath(Forme.rettangolo(26, 76, 80, 24, 10)); bianco(c, p, 64, 70, 50); },
  (c) => { linea(c, Forme.cerchio(64, 64, 46), { colore: BIANCO, spessore: 7 }); },
];

function creaParticelle() {
  const C = 128;
  const tela = nuovaTela(C * 4, C * 4), ctx = tela.getContext('2d');
  const fotogrammi = {};
  PARTICELLE.forEach((disegna, k) => {
    const t = nuovaTela(C, C), c = t.getContext('2d');
    c.save(); disegna(c); c.restore();
    const x = (k % 4) * C, y = Math.floor(k / 4) * C;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, C, C); ctx.clip();
    ctx.filter = 'blur(1.2px)';           // bordi morbidi
    ctx.drawImage(t, x, y);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(t, x, y);                // un po' di nitidezza al centro
    ctx.restore();
    fotogrammi['p' + k] = { x, y, l: C, a: C };
  });
  return { tela, fotogrammi, cella: { l: C, a: C }, altezzaMondo: 1 };
}

/* ------------------------------------------------------------------------ */
/*  FUNZIONE PRINCIPALE                                                     */
/* ------------------------------------------------------------------------ */

export async function creaCielo() {
  const r = {};
  r.cielo = creaTextureCielo();
  await respira();
  r.nuvola = creaNuvole();
  await respira();
  r.balena = creaBalena();
  r.pinna = creaPinna();
  await respira();
  r.uccellino = atlante(['f0', 'f1', 'f2', 'f3'], 96, 64, 0.35, (ctx, nome) => dipingiUccellino(ctx, +nome[1]));
  r.piccione = atlante(['f0', 'f1', 'f2', 'f3'], 128, 96, 0.3, (ctx, nome) => dipingiPiccione(ctx, +nome[1]));
  r.farfalla = atlante(['f0', 'f1'], 64, 64, 0.18, (ctx, nome) => dipingiFarfalla(ctx, nome === 'f0'));
  r.palloncino = atlante(['base'], 128, 256, 1.2, (ctx) => dipingiPalloncino(ctx));
  await respira();
  r.casetta = creaCasette();
  await respira();
  r.panorama_citta = creaPanoramaCitta();
  await respira();
  r.panorama_colline = creaPanoramaColline();
  await respira();
  r.panorama_mucchio = creaPanoramaMucchio(r.casetta);
  await respira();
  r.particelle = creaParticelle();
  return r;
}
