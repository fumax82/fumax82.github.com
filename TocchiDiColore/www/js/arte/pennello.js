/* ==========================================================================
 *  pennello.js — GLI STRUMENTI DEL PITTORE
 *  --------------------------------------------------------------------------
 *  Tutta la grafica del gioco è dipinta dal codice su "tele" (canvas 2D).
 *  Questo file contiene i pennelli comuni a tutti i disegni, così che
 *  personaggi, case, alberi e cielo abbiano lo stesso stile:
 *
 *    - INCHIOSTRO SEPPIA: linee sottili marroni (come nel cartone animato)
 *    - TINTA PIATTA:      campiture pastello per i personaggi (stile "cel")
 *    - ACQUERELLO:        velature con variazioni di colore, granulosità
 *                         della carta e bordi più scuri dove il colore
 *                         "si asciuga" (per fondali, muri, alberi, cielo)
 *
 *  Le "forme" si possono passare come Path2D oppure come funzione che
 *  costruisce il percorso, ad esempio:  (p) => { p.moveTo(0,0); p.lineTo(10,0); }
 *  In Forme ci sono scorciatoie per ellissi, rettangoli arrotondati, poligoni.
 * ========================================================================== */

/* ------------------------------------------------------------------------ */
/*  STILE COMUNE                                                            */
/* ------------------------------------------------------------------------ */
export const STILE = {
  inchiostro: '#6b4b37',       // linee seppia
  inchiostroChiaro: '#a07e64', // linee secondarie (pieghe, dettagli)
  carta: '#fbf6ea',            // colore della carta
  ombra: 'rgba(96, 64, 110, 0.20)', // ombra "cel" sui personaggi (lilla trasparente)
  luce: 'rgba(255, 255, 240, 0.35)',
};

/* ------------------------------------------------------------------------ */
/*  TELE E CASO                                                             */
/* ------------------------------------------------------------------------ */

/** Crea una tela (canvas) vuota e trasparente. */
export function nuovaTela(larghezza, altezza) {
  const t = document.createElement('canvas');
  t.width = Math.max(1, Math.ceil(larghezza));
  t.height = Math.max(1, Math.ceil(altezza));
  return t;
}

/**
 * Generatore casuale "con seme": stesso seme = stessi numeri, così ogni
 * disegno esce sempre uguale. Restituisce una funzione che dà numeri 0..1.
 */
export function casuale(seme) {
  let s = (seme >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numero casuale tra a e b. */
export function tra(rng, a, b) {
  return a + (b - a) * rng();
}

/* ------------------------------------------------------------------------ */
/*  COLORI                                                                  */
/* ------------------------------------------------------------------------ */
export function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbAHex(r, g, b) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

/** Mescola due colori '#rrggbb' (t = 0 → primo, t = 1 → secondo). */
export function mescola(a, b, t) {
  const x = hexARgb(a), y = hexARgb(b);
  return rgbAHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
}

/** Schiarisce verso il bianco caldo della carta. */
export function schiarisci(hex, t) {
  return mescola(hex, '#fffdf6', t);
}

/** Scurisce verso un viola-bruno caldo (mai verso il nero: è acquerello!). */
export function scurisci(hex, t) {
  return mescola(hex, '#3c2a3a', t);
}

/** '#rrggbb' + opacità → 'rgba(...)' */
export function conAlfa(hex, alfa) {
  const c = hexARgb(hex);
  return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alfa + ')';
}

/* ------------------------------------------------------------------------ */
/*  FORME                                                                   */
/* ------------------------------------------------------------------------ */

/** Trasforma una "forma" (Path2D o funzione) in un Path2D. */
export function percorso(forma) {
  if (forma instanceof Path2D) return forma;
  const p = new Path2D();
  forma(p);
  return p;
}

export const Forme = {
  /** Ellisse (rot in radianti). */
  ellisse(x, y, rx, ry, rot) {
    const p = new Path2D();
    p.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2);
    return p;
  },

  /** Cerchio. */
  cerchio(x, y, r) {
    return Forme.ellisse(x, y, r, r, 0);
  },

  /** Rettangolo con angoli arrotondati (raggio facoltativo). */
  rettangolo(x, y, l, a, raggio) {
    const p = new Path2D();
    const r = Math.min(raggio || 0, l / 2, a / 2);
    p.moveTo(x + r, y);
    p.lineTo(x + l - r, y);
    p.quadraticCurveTo(x + l, y, x + l, y + r);
    p.lineTo(x + l, y + a - r);
    p.quadraticCurveTo(x + l, y + a, x + l - r, y + a);
    p.lineTo(x + r, y + a);
    p.quadraticCurveTo(x, y + a, x, y + a - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
    p.closePath();
    return p;
  },

  /**
   * Poligono chiuso. Se morbido è true gli spigoli diventano curve
   * (utile per vestiti, capelli, nuvole...).
   */
  poligono(punti, morbido) {
    const p = new Path2D();
    const n = punti.length;
    if (!morbido) {
      p.moveTo(punti[0][0], punti[0][1]);
      for (let k = 1; k < n; k++) p.lineTo(punti[k][0], punti[k][1]);
      p.closePath();
      return p;
    }
    // curve che passano per i punti medi dei lati
    const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const inizio = medio(punti[n - 1], punti[0]);
    p.moveTo(inizio[0], inizio[1]);
    for (let k = 0; k < n; k++) {
      const m = medio(punti[k], punti[(k + 1) % n]);
      p.quadraticCurveTo(punti[k][0], punti[k][1], m[0], m[1]);
    }
    p.closePath();
    return p;
  },

  /** Linea curva aperta che passa per i punti (per capelli, code, pieghe). */
  curva(punti) {
    const p = new Path2D();
    p.moveTo(punti[0][0], punti[0][1]);
    if (punti.length === 2) { p.lineTo(punti[1][0], punti[1][1]); return p; }
    for (let k = 1; k < punti.length - 1; k++) {
      const m = [(punti[k][0] + punti[k + 1][0]) / 2, (punti[k][1] + punti[k + 1][1]) / 2];
      const fine = k === punti.length - 2 ? punti[k + 1] : m;
      p.quadraticCurveTo(punti[k][0], punti[k][1], fine[0], fine[1]);
    }
    return p;
  },
};

/* ------------------------------------------------------------------------ */
/*  TRAME DELLA CARTA (create una volta sola e riutilizzate)                */
/* ------------------------------------------------------------------------ */
const cacheTrame = {};

/**
 * Restituisce una tela 256x256 ripetibile senza cuciture:
 *   'grana'  — granulosità fine della carta (chiara, da usare in "multiply")
 *   'macchie'— grandi macchie morbide (variazioni di pigmento)
 */
export function trama(tipo) {
  if (cacheTrame[tipo]) return cacheTrame[tipo];
  const dim = 256;
  const t = nuovaTela(dim, dim);
  const c = t.getContext('2d');
  const img = c.createImageData(dim, dim);
  const rng = casuale(tipo === 'grana' ? 11 : 23);
  const celle = tipo === 'grana' ? 64 : 6;
  const ottave = tipo === 'grana' ? 2 : 3;
  const valori = new Float32Array(dim * dim);
  let ampiezza = 1, cc = celle;
  for (let o = 0; o < ottave; o++) {
    const griglia = new Float32Array(cc * cc);
    for (let k = 0; k < griglia.length; k++) griglia[k] = rng();
    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        const gx = (x / dim) * cc, gy = (y / dim) * cc;
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const fx = gx - x0, fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const a = griglia[y0 * cc + x0], b = griglia[y0 * cc + (x0 + 1) % cc];
        const d = griglia[((y0 + 1) % cc) * cc + x0], e = griglia[((y0 + 1) % cc) * cc + (x0 + 1) % cc];
        const v = (a + (b - a) * sx) + ((d + (e - d) * sx) - (a + (b - a) * sx)) * sy;
        valori[y * dim + x] += v * ampiezza;
      }
    }
    ampiezza *= 0.5;
    cc *= 2;
  }
  let min = Infinity, max = -Infinity;
  for (const v of valori) { if (v < min) min = v; if (v > max) max = v; }
  for (let i = 0; i < dim * dim; i++) {
    let v = (valori[i] - min) / (max - min);
    if (tipo === 'grana') v = 0.72 + v * 0.28 + (rng() - 0.5) * 0.12; // puntini fini
    else v = 0.55 + v * 0.45;
    const g = Math.max(0, Math.min(255, v * 255));
    img.data[i * 4] = g; img.data[i * 4 + 1] = g * 0.985; img.data[i * 4 + 2] = g * 0.96; img.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  cacheTrame[tipo] = t;
  return t;
}

/* ------------------------------------------------------------------------ */
/*  INCHIOSTRO E TINTE PIATTE (stile dei personaggi)                        */
/* ------------------------------------------------------------------------ */

/** Riempie una forma con un colore piatto. */
export function tinta(ctx, forma, colore, alfa) {
  ctx.save();
  ctx.globalAlpha = alfa === undefined ? 1 : alfa;
  ctx.fillStyle = colore;
  ctx.fill(percorso(forma));
  ctx.restore();
}

/**
 * Linea a inchiostro seppia.
 * opz: { colore, spessore, alfa }
 */
export function linea(ctx, forma, opz) {
  const o = opz || {};
  ctx.save();
  ctx.globalAlpha = o.alfa === undefined ? 1 : o.alfa;
  ctx.strokeStyle = o.colore || STILE.inchiostro;
  ctx.lineWidth = o.spessore || 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(percorso(forma));
  ctx.restore();
}

/** Tinta piatta + contorno a inchiostro (il "mattone" dei personaggi). */
export function contorna(ctx, forma, colore, spessore, coloreLinea) {
  const p = percorso(forma);
  tinta(ctx, p, colore);
  linea(ctx, p, { spessore: spessore || 2, colore: coloreLinea });
}

/**
 * Ombra "cel": colora la parte di "ombraForma" che sta dentro "forma".
 * Esempio: il lato destro di un vestito leggermente più scuro.
 */
export function ombreggia(ctx, forma, ombraForma, colore) {
  ctx.save();
  ctx.clip(percorso(forma));
  ctx.fillStyle = colore || STILE.ombra;
  ctx.fill(percorso(ombraForma));
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  ACQUERELLO (fondali, muri, alberi, nuvole)                              */
/* ------------------------------------------------------------------------ */

/**
 * Stende una velatura ad acquerello dentro una forma.
 * opz (tutte facoltative):
 *   area:        [x, y, l, a] zona dove cade la forma (aiuta a piazzare le macchie)
 *   seme:        numero per avere sempre lo stesso risultato
 *   opacita:     0..1 (default 0.95)
 *   variazione:  intensità delle macchie chiare/scure interne (default 0.22)
 *   granulosita: grana della carta (default 0.25)
 *   bordo:       intensità del bordo più scuro (default 0.45)
 *   larghezzaBordo: in pixel (default 5)
 *   luce:        'alto' | 'basso' | 'sinistra' | null — sfumatura più chiara da un lato
 */
export function acquerello(ctx, forma, colore, opz) {
  const o = opz || {};
  const p = percorso(forma);
  const rng = casuale(o.seme || 7);
  const [ax, ay, al, aa] = o.area || [0, 0, ctx.canvas.width, ctx.canvas.height];
  ctx.save();
  ctx.clip(p);

  // 1) la stesura di base
  ctx.globalAlpha = o.opacita === undefined ? 0.95 : o.opacita;
  ctx.fillStyle = colore;
  ctx.fillRect(ax, ay, al, aa);

  // 2) macchie morbide: il pigmento non è mai uniforme
  const variazione = o.variazione === undefined ? 0.22 : o.variazione;
  if (variazione > 0) {
    const quante = 3 + Math.round((al * aa) / 9000);
    for (let k = 0; k < Math.min(quante, 40); k++) {
      const cx = ax + rng() * al, cy = ay + rng() * aa;
      const r = (0.15 + rng() * 0.4) * Math.max(al, aa);
      const chiaro = rng() < 0.55;
      const tono = chiaro ? schiarisci(colore, 0.35) : scurisci(colore, 0.18);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, conAlfa(tono, variazione));
      g.addColorStop(1, conAlfa(tono, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(ax, ay, al, aa);
    }
  }

  // 3) luce: un lato più chiaro, come la luce del sole
  if (o.luce) {
    let g;
    if (o.luce === 'alto') g = ctx.createLinearGradient(0, ay, 0, ay + aa);
    else if (o.luce === 'basso') g = ctx.createLinearGradient(0, ay + aa, 0, ay);
    else g = ctx.createLinearGradient(ax, 0, ax + al, 0);
    g.addColorStop(0, 'rgba(255,253,240,0.38)');
    g.addColorStop(0.6, 'rgba(255,253,240,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(ax, ay, al, aa);
  }

  // 4) granulosità della carta
  const granulosita = o.granulosita === undefined ? 0.25 : o.granulosita;
  if (granulosita > 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = granulosita;
    ctx.fillStyle = ctx.createPattern(trama('grana'), 'repeat');
    ctx.fillRect(ax, ay, al, aa);
    ctx.globalAlpha = granulosita * 0.8;
    ctx.fillStyle = ctx.createPattern(trama('macchie'), 'repeat');
    ctx.fillRect(ax, ay, al, aa);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 5) bordo bagnato: dove l'acqua si asciuga il colore si accumula
  const bordo = o.bordo === undefined ? 0.45 : o.bordo;
  if (bordo > 0) {
    const lb = o.larghezzaBordo || 5;
    ctx.globalAlpha = bordo;
    ctx.filter = 'blur(' + (lb * 0.4).toFixed(1) + 'px)';
    ctx.strokeStyle = scurisci(colore, 0.28);
    ctx.lineWidth = lb;
    ctx.stroke(p);
    ctx.filter = 'none';
  }
  ctx.restore();
}

/**
 * Velatura sfumata su un rettangolo (per cieli, ombre portate, luce calda).
 * colori: [coloreInizio, coloreFine]; direzione 'verticale' o 'orizzontale'.
 */
export function velatura(ctx, x, y, l, a, colori, alfa, direzione) {
  const g = direzione === 'orizzontale'
    ? ctx.createLinearGradient(x, 0, x + l, 0)
    : ctx.createLinearGradient(0, y, 0, y + a);
  colori.forEach((c, k) => g.addColorStop(k / (colori.length - 1), c));
  ctx.save();
  ctx.globalAlpha = alfa === undefined ? 1 : alfa;
  ctx.fillStyle = g;
  ctx.fillRect(x, y, l, a);
  ctx.restore();
}

/** Pennellata morbida lungo una curva (bordi sfumati). */
export function pennellata(ctx, punti, colore, spessore, alfa) {
  ctx.save();
  ctx.globalAlpha = alfa === undefined ? 0.7 : alfa;
  ctx.strokeStyle = colore;
  ctx.lineWidth = spessore;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.filter = 'blur(' + Math.max(0.5, spessore * 0.12).toFixed(1) + 'px)';
  ctx.stroke(Forme.curva(punti));
  ctx.filter = 'none';
  ctx.restore();
}

/** Applica la grana della carta su una zona (in "multiply"). */
export function granula(ctx, x, y, l, a, intensita) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = intensita === undefined ? 0.25 : intensita;
  ctx.fillStyle = ctx.createPattern(trama('grana'), 'repeat');
  ctx.fillRect(x, y, l, a);
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  VEGETAZIONE                                                             */
/* ------------------------------------------------------------------------ */

/**
 * Una foglia appuntita.
 *   (x, y) attacco, ang direzione (radianti), lung/larg dimensioni
 *   inchiostroAlfa: 0 = senza contorno, 1 = contorno pieno
 */
export function foglia(ctx, x, y, ang, lung, larg, colore, inchiostroAlfa) {
  const p = new Path2D();
  const c = Math.cos(ang), s = Math.sin(ang);
  const punta = [x + c * lung, y + s * lung];
  const nx = -s * larg, ny = c * larg;
  const mx = x + c * lung * 0.45, my = y + s * lung * 0.45;
  p.moveTo(x, y);
  p.quadraticCurveTo(mx + nx, my + ny, punta[0], punta[1]);
  p.quadraticCurveTo(mx - nx, my - ny, x, y);
  p.closePath();
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = colore;
  ctx.fill(p);
  ctx.globalAlpha = 0.35;                          // nervatura centrale più chiara
  ctx.strokeStyle = schiarisci(colore, 0.4);
  ctx.lineWidth = Math.max(0.6, larg * 0.18);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(mx + c * lung * 0.3, my + s * lung * 0.3); ctx.stroke();
  if (inchiostroAlfa) {
    ctx.globalAlpha = inchiostroAlfa;
    ctx.strokeStyle = STILE.inchiostro;
    ctx.lineWidth = Math.max(0.7, larg * 0.12);
    ctx.stroke(p);
  }
  ctx.restore();
}

/**
 * Un ciuffo di fogliame ad acquerello (chiome d'albero, edera, cespugli).
 * opz: { colori: [scuro, medio, chiaro], quante, seme, dimFoglia, inchiostro (0..1), schiaccia (0..1) }
 * Le foglie in basso sono più scure, quelle in alto più chiare: dà volume.
 */
export function fogliame(ctx, cx, cy, raggio, opz) {
  const o = opz || {};
  const colori = o.colori || ['#4f8a52', '#6faa5e', '#9fcd7c'];
  const rng = casuale(o.seme || 3);
  const quante = o.quante || Math.round(raggio * 1.6);
  const dim = o.dimFoglia || raggio * 0.28;
  const schiaccia = o.schiaccia === undefined ? 0.85 : o.schiaccia;
  // massa di fondo morbida
  acquerello(ctx, Forme.ellisse(cx, cy, raggio * 0.92, raggio * 0.92 * schiaccia), colori[1],
    { area: [cx - raggio, cy - raggio, raggio * 2, raggio * 2], seme: (o.seme || 3) + 1, bordo: 0.25, variazione: 0.3, opacita: 0.75 });
  for (let k = 0; k < quante; k++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * raggio;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * schiaccia;
    const altezzaRel = (y - (cy - raggio * schiaccia)) / (2 * raggio * schiaccia); // 0 in alto, 1 in basso
    const indice = altezzaRel > 0.62 ? 0 : altezzaRel > 0.3 ? 1 : 2;
    const colore = mescola(colori[indice], colori[Math.min(2, indice + 1)], rng() * 0.5);
    foglia(ctx, x, y, rng() * Math.PI * 2, dim * (0.7 + rng() * 0.6), dim * (0.3 + rng() * 0.15),
      colore, rng() < 0.35 ? (o.inchiostro === undefined ? 0.55 : o.inchiostro) : 0);
  }
}

/** Fiorellini (gruppetti di petali) sparsi in un'area. */
export function fiorellini(ctx, x, y, l, a, colori, quanti, seme, dim) {
  const rng = casuale(seme || 5);
  const d = dim || 3;
  for (let k = 0; k < quanti; k++) {
    const fx = x + rng() * l, fy = y + rng() * a;
    const colore = colori[Math.floor(rng() * colori.length)];
    for (let p = 0; p < 5; p++) {
      const ang = (p / 5) * Math.PI * 2 + rng();
      tinta(ctx, Forme.cerchio(fx + Math.cos(ang) * d, fy + Math.sin(ang) * d, d * 0.75), colore, 0.9);
    }
    tinta(ctx, Forme.cerchio(fx, fy, d * 0.5), '#f6d66b');
  }
}

/* ------------------------------------------------------------------------ */
/*  UTILITÀ PER TELE E ATLANTI                                              */
/* ------------------------------------------------------------------------ */

/**
 * Sfuma verso la trasparenza i bordi di una tela (per panorami, nuvole,
 * oggetti che devono "svanire" nella carta). larghezza in pixel.
 */
export function sfumaBordi(tela, larghezza, lati) {
  const c = tela.getContext('2d');
  const l = tela.width, a = tela.height;
  const quali = lati || ['alto', 'basso', 'sinistra', 'destra'];
  c.save();
  c.globalCompositeOperation = 'destination-out';
  for (const lato of quali) {
    let g;
    if (lato === 'alto') { g = c.createLinearGradient(0, 0, 0, larghezza); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, l, larghezza); }
    if (lato === 'basso') { g = c.createLinearGradient(0, a, 0, a - larghezza); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, a - larghezza, l, larghezza); }
    if (lato === 'sinistra') { g = c.createLinearGradient(0, 0, larghezza, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, larghezza, a); }
    if (lato === 'destra') { g = c.createLinearGradient(l, 0, l - larghezza, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(l - larghezza, 0, larghezza, a); }
  }
  c.restore();
}

/**
 * Crea un ATLANTE: tante celle uguali affiancate in una sola tela.
 * È il formato con cui personaggi e oggetti vengono consegnati al motore.
 *
 *   nomi:   elenco dei nomi dei fotogrammi
 *   cella:  { l, a } dimensioni di una cella in pixel
 *   disegna(ctx, nome, l, a): disegna UN fotogramma con l'origine nell'angolo
 *           in alto a sinistra della cella (i piedi devono toccare il bordo
 *           inferiore, al centro: x = l/2, y = a)
 *
 * Restituisce { tela, fotogrammi: { nome: {x, y, l, a} } }
 */
export function creaAtlante(nomi, cella, disegna) {
  const colonne = Math.min(nomi.length, Math.max(1, Math.floor(2048 / cella.l)));
  const righe = Math.ceil(nomi.length / colonne);
  const tela = nuovaTela(colonne * cella.l, righe * cella.a);
  const ctx = tela.getContext('2d');
  const fotogrammi = {};
  nomi.forEach((nome, k) => {
    const x = (k % colonne) * cella.l, y = Math.floor(k / colonne) * cella.a;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cella.l, cella.a);
    ctx.clip();
    ctx.translate(x, y);
    disegna(ctx, nome, cella.l, cella.a);
    ctx.restore();
    fotogrammi[nome] = { x, y, l: cella.l, a: cella.a };
  });
  return { tela, fotogrammi };
}

/** Attende il prossimo fotogramma (per non bloccare la pagina mentre si dipinge). */
export function respira() {
  return new Promise((ok) => requestAnimationFrame(() => ok()));
}
