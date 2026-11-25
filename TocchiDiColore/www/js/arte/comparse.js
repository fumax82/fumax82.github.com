/* ==========================================================================
 *  comparse.js — LE COMPARSE (i personaggi secondari)
 *  --------------------------------------------------------------------------
 *  Qui dipingiamo, solo con il codice, chi incontriamo per strada:
 *
 *    mondo "vero" (la strada del prologo, persone):
 *      fornaia  — caschetto castano, dolcevita bianco, gonna lunga menta,
 *                 stivali marroni, un sacchetto di baguette in braccio
 *      signora  — elegante e profumata: cappello di paglia col fiore,
 *                 cappotto lavanda, foulard e borsetta
 *      signore  — vecchio signore con basco, cappotto marrone, occhialini
 *                 tondi, baffi e pipa
 *
 *    mondo immaginato (animali del paese):
 *      lepre    — golfino rosa, gonna lunga giallo-verde, lanternina blu
 *      uccello  — palla di piume gialla, cilindro viola, occhialini, papillon
 *      cavallo  — maglietta azzurra, pantaloni bianchi, braccia conserte,
 *                 un filo d'erba in bocca
 *      nonna    — piccola e curva, crocchia grigia, scialle lilla, bastone
 *      tigre    — maglione verde oliva, pantaloni blu, legge un libro
 *
 *  COME SONO FATTE LE COORDINATE
 *  Ogni fotogramma ha l'origine TRA I PIEDI del personaggio (al centro, sul
 *  bordo inferiore della cella). La x va verso destra e la y verso il basso:
 *  tutto ciò che sta sopra il terreno ha quindi y NEGATIVA (la testa della
 *  fornaia è a y = -324, cioè 324 pixel sopra i piedi).
 *  Le viste "lato" guardano a DESTRA: il motore le specchia da solo.
 * ========================================================================== */

import {
  STILE, scurisci, schiarisci, percorso, Forme, tinta, linea, creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  COSTANTI                                                                */
/* ------------------------------------------------------------------------ */
const INK = 2.7;                    // spessore dell'inchiostro seppia
const PUPILLA = '#4a3326';          // occhi a puntino (bruno scurissimo)
const BOCCA = '#b4525a';
const LINGUA = '#f09a96';
const ROSA_GUANCE = '#f4a0a0';
const BIANCO = '#fffdf6';

const POSE_FERME = ['fronte_fermo_0', 'fronte_fermo_1', 'fronte_parla_0', 'fronte_parla_1'];
const POSE_CAMMINO = POSE_FERME.concat([0, 1, 2, 3].map((k) => 'lato_cammina_' + k));

/* ------------------------------------------------------------------------ */
/*  PICCOLI ATTREZZI DI GEOMETRIA                                           */
/* ------------------------------------------------------------------------ */
const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lungo = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function direzione(a, b) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
}

/** Aggiunge a un percorso una linea morbida che passa vicino ai punti. */
function segui(p, pt, nuovo) {
  if (nuovo) p.moveTo(pt[0][0], pt[0][1]); else p.lineTo(pt[0][0], pt[0][1]);
  if (pt.length === 2) { p.lineTo(pt[1][0], pt[1][1]); return; }
  for (let k = 1; k < pt.length - 1; k++) {
    const fine = k === pt.length - 2 ? pt[k + 1] : medio(pt[k], pt[k + 1]);
    p.quadraticCurveTo(pt[k][0], pt[k][1], fine[0], fine[1]);
  }
}

/* ------------------------------------------------------------------------ */
/*  PENNELLI DEI PERSONAGGI                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Il "mattone" di tutti i disegni: tinta piatta + ombra cel sul lato
 * destro/basso + contorno a inchiostro. ombra = quanti pixel di ombra (0 = niente).
 */
function pezzo(ctx, forma, colore, ombra) {
  const p = percorso(forma);
  tinta(ctx, p, colore);
  if (ombra !== 0) ombraCel(ctx, p, ombra || 5);
  linea(ctx, p, { spessore: INK });
}

/**
 * Ombra "cel": la luce arriva da sinistra in alto, quindi scuriamo la
 * falce di forma che resta scoperta spostando una copia della forma
 * verso sinistra-alto.
 */
function ombraCel(ctx, p, d) {
  const fuori = new Path2D();
  fuori.rect(-4000, -4000, 8000, 8000);
  fuori.addPath(p, new DOMMatrix([1, 0, 0, 1, -d, -d * 0.6]));
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = STILE.ombra;
  ctx.fill(fuori, 'evenodd');   // "evenodd": colora solo fuori dalla copia spostata
  ctx.restore();
}

/** Un tratto di inchiostro morbido (per sopracciglia, pieghe, bocche...). */
function tratto(ctx, punti, spessore, colore) {
  linea(ctx, Forme.curva(punti), { spessore: spessore || INK * 0.85, colore });
}

/**
 * Forma di un ARTO (braccio, gamba, coda): un "tubo" che passa per i punti,
 * con le larghezze date in ogni punto e le estremità arrotondate.
 */
function arto(punti, larghezze) {
  // aggiungo i punti medi: il tubo resta dritto e si curva solo alle giunture
  const pt = [], w = [];
  punti.forEach((q, k) => {
    pt.push(q); w.push(larghezze[k]);
    if (k < punti.length - 1) { pt.push(medio(q, punti[k + 1])); w.push((larghezze[k] + larghezze[k + 1]) / 2); }
  });
  const n = pt.length, sx = [], dx = [];
  for (let k = 0; k < n; k++) {
    const [tx, ty] = direzione(pt[Math.max(0, k - 1)], pt[Math.min(n - 1, k + 1)]);
    sx.push([pt[k][0] - ty * w[k] / 2, pt[k][1] + tx * w[k] / 2]);
    dx.push([pt[k][0] + ty * w[k] / 2, pt[k][1] - tx * w[k] / 2]);
  }
  const p = new Path2D();
  segui(p, sx, true);
  const f = pt[n - 1], a1 = Math.atan2(sx[n - 1][1] - f[1], sx[n - 1][0] - f[0]);
  p.arc(f[0], f[1], w[n - 1] / 2, a1, a1 - Math.PI, true);          // punta arrotondata
  segui(p, dx.reverse(), false);
  const i = pt[0], a0 = Math.atan2(dx[n - 1][1] - i[1], dx[n - 1][0] - i[0]);
  p.arc(i[0], i[1], w[0] / 2, a0, a0 - Math.PI, true);              // base arrotondata
  p.closePath();
  return p;
}

/** Una mano (o zampa) tonda alla fine di un braccio. */
function manoSu(ctx, b, colore, r) {
  const d = direzione(b.gomito, b.mano);
  const c = [b.mano[0] + d[0] * r * 0.95, b.mano[1] + d[1] * r * 0.95];
  pezzo(ctx, Forme.ellisse(c[0], c[1], r * 0.9, r, Math.atan2(d[1], d[0]) - Math.PI / 2), colore, 2);
}

/** Scarpa: di lato punta a destra, di fronte è un ovale. La suola tocca y del piede. */
function scarpa(ctx, piede, colore, lato, lung, alta, ang) {
  const x = piede[0], y = piede[1] - 1.2;   // 1.2: il contorno resta dentro la cella
  if (ang) {   // piede alzato: la punta scende (ruoto attorno alla caviglia)
    ctx.save();
    ctx.translate(x, y - alta * 0.6); ctx.rotate(ang); ctx.translate(-x, -(y - alta * 0.6));
    scarpa(ctx, piede, colore, lato, lung, alta, 0);
    ctx.restore();
    return;
  }
  const pt = lato
    ? [[x - lung * 0.4, y], [x + lung * 0.8, y], [x + lung * 0.78, y - alta * 0.75], [x + lung * 0.1, y - alta], [x - lung * 0.42, y - alta * 1.05]]
    : [[x - lung * 0.42, y], [x + lung * 0.42, y], [x + lung * 0.45, y - alta], [x - lung * 0.45, y - alta]];
  pezzo(ctx, Forme.poligono(pt, true), colore, 3);
}

/** Occhio: puntino con riflesso, oppure archetto se chiuso o felice. */
function occhio(ctx, x, y, r, stato) {
  if (stato === 'chiuso') return tratto(ctx, [[x - r * 1.5, y - r * 0.1], [x, y + r * 0.9], [x + r * 1.5, y - r * 0.1]]);
  if (stato === 'felice') return tratto(ctx, [[x - r * 1.5, y + r * 0.5], [x, y - r * 0.9], [x + r * 1.5, y + r * 0.5]]);
  tinta(ctx, Forme.ellisse(x, y, r * 0.78, r), PUPILLA);
  tinta(ctx, Forme.cerchio(x - r * 0.22, y - r * 0.38, r * 0.3), '#ffffff', 0.9);
}

/** Bocca: sorriso a filo oppure aperta (per i fotogrammi del dialogo). */
function bocca(ctx, x, y, l, aperta) {
  if (!aperta) return tratto(ctx, [[x - l * 0.5, y - l * 0.1], [x, y + l * 0.28], [x + l * 0.5, y - l * 0.1]]);
  const p = new Path2D();
  p.moveTo(x - l * 0.5, y - l * 0.12);
  p.quadraticCurveTo(x, y - l * 0.2, x + l * 0.5, y - l * 0.12);
  p.quadraticCurveTo(x + l * 0.42, y + l * 0.62, x, y + l * 0.62);
  p.quadraticCurveTo(x - l * 0.42, y + l * 0.62, x - l * 0.5, y - l * 0.12);
  p.closePath();
  tinta(ctx, p, BOCCA);
  ctx.save(); ctx.clip(p); tinta(ctx, Forme.ellisse(x, y + l * 0.62, l * 0.34, l * 0.24), LINGUA); ctx.restore();
  linea(ctx, p, { spessore: INK * 0.85 });
}

function guance(ctx, x1, x2, y, r) {
  tinta(ctx, Forme.ellisse(x1, y, r, r * 0.6), ROSA_GUANCE, 0.4);
  tinta(ctx, Forme.ellisse(x2, y, r, r * 0.6), ROSA_GUANCE, 0.4);
}

/** Occhialini tondi (vetro appena lucido + montatura sottile). */
function occhiali(ctx, x1, x2, y, r, colore) {
  for (const x of [x1, x2]) {
    tinta(ctx, Forme.cerchio(x, y, r), '#ffffff', 0.3);
    linea(ctx, Forme.cerchio(x, y, r), { spessore: INK * 0.75, colore });
  }
  linea(ctx, Forme.curva([[x1 + r, y], [(x1 + x2) / 2, y - r * 0.4], [x2 - r, y]]), { spessore: INK * 0.75, colore });
}

/* ------------------------------------------------------------------------ */
/*  POSE E SCHELETRO                                                        */
/* ------------------------------------------------------------------------ */

/** Dal nome del fotogramma ("lato_cammina_2") ricava la posa. */
function leggiPosa(nome) {
  const [vista, azione, n] = nome.split('_');
  const f = Number(n);
  return {
    lato: vista === 'lato', azione, f,
    idle: azione === 'fermo' && f === 1,     // la piccola azione da fermo
    parla: azione === 'parla',
    aperta: azione === 'parla' && f === 0,   // bocca aperta
  };
}

/** Ginocchio (o gomito) con due segmenti lunghi a e b: sceglie quello "in avanti". */
function ginocchio(anca, cav, a, b) {
  const dx = cav[0] - anca[0], dy = cav[1] - anca[1];
  const d = Math.min(Math.hypot(dx, dy), a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const alfa = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k1 = [anca[0] + a * Math.cos(base + alfa), anca[1] + a * Math.sin(base + alfa)];
  const k2 = [anca[0] + a * Math.cos(base - alfa), anca[1] + a * Math.sin(base - alfa)];
  return k1[0] > k2[0] ? k1 : k2;
}

/**
 * Calcola le articolazioni di un personaggio in piedi.
 * D = misure in pixel (altezze da terra):
 *   gamba (altezza del bacino), coscia, caviglia, anche (mezza distanza),
 *   vita, spalla, spalle (mezza larghezza), testa (centro), braccio, avambraccio,
 *   passo, alzata (del piede), bob (su e giù), oscilla (braccia), inclina (schiena curva)
 * Restituisce S con: vita, collo, testa, gambe[2], braccia[2].
 * Indice 0 = arto lontano (di lato) o di sinistra (di fronte); 1 = vicino / destra.
 */
function scheletro(D, P) {
  const cammina = P.azione === 'cammina';
  const fi = cammina ? (P.f * Math.PI) / 2 : 0;
  // nel passo il corpo si abbassa quando i piedi sono larghi; da fermo "respira"
  const giu = cammina ? (P.f % 2 === 0 ? D.bob : 0) : (P.idle ? -1.5 : 0);
  const incl = P.lato ? D.inclina || 0 : 0;
  const S = { giu, fi };
  S.vita = [incl * 0.3, -D.vita + giu];
  S.collo = [incl, -D.spalla + giu];
  S.testa = [incl * 1.5 + (P.lato ? D.testaAvanti || 0 : 0), -D.testa + giu + (P.lato ? D.testaGiu || 0 : 0)];
  const yAnca = -D.gamba + Math.max(0, giu);
  const stinco = D.gamba - D.coscia - D.caviglia;
  const gamba = (anca, piede) => {
    const cav = [piede[0], piede[1] - D.caviglia];
    return { anca, ginocchio: ginocchio(anca, cav, D.coscia, stinco), caviglia: cav, piede };
  };
  if (P.lato) {
    const c = Math.cos(fi), s = Math.sin(fi);
    S.gambe = [
      gamba([incl * 0.3 - 3, yAnca], [-D.passo * c, -D.alzata * Math.max(0, s)]),
      gamba([incl * 0.3 + 3, yAnca], [D.passo * c, -D.alzata * Math.max(0, -s)]),
    ];
    // le braccia oscillano al contrario delle gambe
    S.braccia = [1, -1].map((segno, k) => {
      const th = segno * D.oscilla * c;
      const spalla = [S.collo[0] + (k ? 2 : -3), S.collo[1] + 6];
      const gomito = [spalla[0] + D.braccio * Math.sin(th), spalla[1] + D.braccio * Math.cos(th)];
      const piega = 0.25 + Math.max(0, th) * 0.9;
      return { spalla, gomito, mano: [gomito[0] + D.avambraccio * Math.sin(th + piega), gomito[1] + D.avambraccio * Math.cos(th + piega)] };
    });
  } else {
    S.gambe = [-1, 1].map((s) => {
      const g = gamba([s * D.anche, yAnca], [s * D.anche * 1.1, 0]);
      g.ginocchio = [lungo(g.anca, g.caviglia, 0.5)[0] + s, lungo(g.anca, g.caviglia, 0.5)[1]];
      return g;
    });
    S.braccia = [-1, 1].map((s) => {
      const spalla = [s * D.spalle, S.collo[1] + 6];
      const gomito = [spalla[0] + s * 5, spalla[1] + D.braccio];
      return { spalla, gomito, mano: [gomito[0] + s * 1.5, gomito[1] + D.avambraccio] };
    });
  }
  return S;
}

/** x di una gamba all'altezza y (per far seguire l'orlo della gonna alle gambe). */
function xGambaA(g, y) {
  for (const [a, b] of [[g.anca, g.ginocchio], [g.ginocchio, g.caviglia]]) {
    if ((y - a[1]) * (y - b[1]) <= 0) return lungo(a, b, (y - a[1]) / ((b[1] - a[1]) || 1))[0];
  }
  return g.caviglia[0];
}

/* ------------------------------------------------------------------------ */
/*  IL CORPO COMUNE (usato da tutti i bipedi)                               */
/* ------------------------------------------------------------------------ */

function gamba(ctx, g, C, P, lontano) {
  const scuro = (c) => (lontano ? scurisci(c, 0.12) : c);
  const w = C.gambaLarg;
  pezzo(ctx, arto([g.anca, g.ginocchio, g.caviglia], [w, w * 0.88, w * 0.74]), scuro(C.gamba), 3);
  if (C.piede) C.piede(ctx, g, P, scuro);
  else scarpa(ctx, g.piede, scuro(C.scarpa), P.lato, C.scarpaL || 24, C.scarpaA || 12, g.piede[1] < -1 ? 0.45 : 0);
}

function braccio(ctx, b, C, lontano) {
  const scuro = (c) => (lontano ? scurisci(c, 0.12) : c);
  const w = C.manicaLarg;
  if (!b.nascosta) manoSu(ctx, b, scuro(C.mano || C.pelle), C.manoR || 6.5);
  if (C.manicaCorta) {
    // braccio nudo (o col pelo) e manica corta sopra
    pezzo(ctx, arto([b.spalla, b.gomito, b.mano], [w * 0.8, w * 0.72, w * 0.66]), scuro(C.pelle), 3);
    pezzo(ctx, arto([b.spalla, lungo(b.spalla, b.gomito, 0.45)], [w * 1.15, w * 1.1]), scuro(C.manica), 3);
  } else {
    pezzo(ctx, arto([b.spalla, b.gomito, b.mano], [w, w * 0.9, w * 0.82]), scuro(C.manica), 3);
  }
}

/**
 * Disegna un personaggio bipede. C contiene misure (D), colori e "ganci":
 *   posa(S,P)            cambia le articolazioni (oggetti in mano...)
 *   dietro(ctx,S,P)      cose dietro a tutto (coda)
 *   sotto(ctx,S,P)       gonna o falda del cappotto
 *   busto(ctx,S,P)       maglia / cappotto
 *   mantella(ctx,S,P)    scialle sopra le braccia (facoltativo)
 *   testa(ctx,S,P)       testa, capelli, cappello
 *   davanti(ctx,S,P)     oggetti tenuti davanti (sacchetto, libro...)
 */
function corpo(ctx, P, C) {
  const S = scheletro(C.D, P);
  if (C.posa) C.posa(S, P);
  if (C.dietro) C.dietro(ctx, S, P);
  if (P.lato) braccio(ctx, S.braccia[0], C, true);             // braccio lontano, dietro
  S.gambe.forEach((g, k) => gamba(ctx, g, C, P, P.lato && k === 0));
  if (C.sotto) C.sotto(ctx, S, P);
  C.busto(ctx, S, P);
  // di fronte le braccia vanno prima della testa; di lato il braccio vicino va
  // davanti a tutto, tranne quando la testa sporge in avanti (la nonna curva)
  const vicinoPrima = P.lato && C.testaDavanti;
  if (!P.lato) S.braccia.forEach((b) => braccio(ctx, b, C, false));
  if (vicinoPrima) braccio(ctx, S.braccia[1], C, false);
  if (C.mantella) C.mantella(ctx, S, P);                       // scialle sopra le braccia
  C.testa(ctx, S, P);
  if (P.lato && !vicinoPrima) braccio(ctx, S.braccia[1], C, false);
  if (C.davanti) C.davanti(ctx, S, P);
}

/** Sagoma del busto (maglia, golf, cappotto) dalle spalle alla vita (+ "sotto" pixel). */
function sagomaBusto(S, P, spalle, vita, sotto) {
  const [cx, cy] = S.collo, [vx, vy0] = S.vita, vy = vy0 + (sotto || 0);
  const p = new Path2D();
  if (!P.lato) {
    p.moveTo(cx - spalle * 0.4, cy - 3);
    p.quadraticCurveTo(cx - spalle, cy - 2, cx - spalle - 1, cy + 15);
    p.quadraticCurveTo(cx - spalle + 2, (cy + vy) / 2 + 10, vx - vita, vy);
    p.lineTo(vx + vita, vy);
    p.quadraticCurveTo(cx + spalle - 2, (cy + vy) / 2 + 10, cx + spalle + 1, cy + 15);
    p.quadraticCurveTo(cx + spalle, cy - 2, cx + spalle * 0.4, cy - 3);
  } else {
    const d = spalle * 0.55;                       // di lato il corpo è più stretto
    p.moveTo(cx - d * 0.3, cy - 4);
    p.quadraticCurveTo(cx - d - 3, cy - 2, cx - d - 1, cy + 18);              // schiena
    p.quadraticCurveTo(cx - d, (cy + vy) / 2, vx - vita * 0.8, vy);
    p.lineTo(vx + vita * 0.85, vy);
    p.quadraticCurveTo(cx + d + 6, (cy + vy) / 2, cx + d * 0.8, cy + 12);     // petto
    p.quadraticCurveTo(cx + d * 0.7, cy - 3, cx + d * 0.3, cy - 4);
  }
  p.closePath();
  return p;
}

/**
 * Gonna (o falda di cappotto) dalla vita fino all'orlo.
 *   vita: mezza larghezza in vita, orlo: altezza dell'orlo da terra,
 *   largo: mezza larghezza dell'orlo. Di lato l'orlo segue le gambe.
 */
function gonna(ctx, S, P, colore, vita, orlo, largo, pieghe) {
  const [vx, vy] = S.vita, yo = -orlo;
  let sx = vx - largo, dx = vx + largo, vw = vita;
  if (P.lato) {
    vw = vita * 0.8;
    const xs = S.gambe.map((g) => xGambaA(g, yo + 4));
    sx = Math.min(vx - largo * 0.7, Math.min(...xs) - 13);
    dx = Math.max(vx + largo * 0.75, Math.max(...xs) + 13);
    // se un ginocchio sta sopra l'orlo, allargo la gonna in avanti quanto serve
    for (const g of S.gambe) {
      const [kx, ky] = g.ginocchio;
      if (ky > vy && ky < yo) dx = Math.max(dx, vx + vw + (kx + 12 - vx - vw) * (yo - vy) / (ky - vy));
    }
  }
  const p = new Path2D();
  p.moveTo(vx - vw, vy);
  p.lineTo(vx + vw, vy);
  p.quadraticCurveTo(dx - (dx - vx - vw) * 0.2, (vy + yo) / 2, dx, yo);
  p.quadraticCurveTo((sx + dx) / 2, yo + 7, sx, yo);
  p.quadraticCurveTo(sx + (vx - vw - sx) * 0.2, (vy + yo) / 2, vx - vw, vy);
  p.closePath();
  pezzo(ctx, p, colore, 8);
  if (pieghe !== false) {
    const c = { spessore: 1.6, colore: STILE.inchiostroChiaro };
    linea(ctx, Forme.curva([[vx - vw * 0.3, vy + 14], [sx + (dx - sx) * 0.3, yo - 2]]), c);
    linea(ctx, Forme.curva([[vx + vw * 0.4, vy + 20], [sx + (dx - sx) * 0.68, yo - 1]]), c);
  }
  return { sx, dx, yo };
}

/**
 * Testa umana: ovale color pelle, occhi a puntino, nasino, bocca, guance.
 * Di lato (P.lato) i lineamenti scivolano a destra: vista di tre quarti.
 * T: { r, pelle, occhi, dietro(), capelli(), sopra(), senzaBocca, inclina }
 */
function testaUmana(ctx, S, P, T) {
  const [x, y] = S.testa, r = T.r, g = P.lato ? 1 : 0;
  ctx.save();
  if (T.inclina) { ctx.translate(x, y); ctx.rotate(T.inclina); ctx.translate(-x, -y); }
  if (T.dietro) T.dietro(ctx, x, y, r, g);
  pezzo(ctx, Forme.ellisse(x, y, r * 0.92, r), T.pelle, r * 0.14);
  const cx = x + g * r * 0.32, ex = r * (0.34 - g * 0.06), ey = y + r * 0.1;
  guance(ctx, cx - ex - r * 0.08, cx + ex + r * 0.06, y + r * 0.38, r * 0.17);
  const stato = T.occhi || 'aperto';
  occhio(ctx, cx - ex, ey, r * 0.1, stato);
  occhio(ctx, cx + ex, ey, r * 0.1, stato);
  const nx = cx + g * r * 0.12;
  tratto(ctx, [[nx - r * 0.03, y + r * 0.22], [nx + r * 0.08, y + r * 0.33], [nx - r * 0.03, y + r * 0.38]], INK * 0.75);
  if (!T.senzaBocca) bocca(ctx, cx + g * r * 0.06, y + r * 0.58, r * 0.32, P.aperta);
  if (T.capelli) T.capelli(ctx, x, y, r, g);
  if (T.sopra) T.sopra(ctx, x, y, r, g, { cx, ex, ey });
  ctx.restore();
}

/**
 * Capelli a caschetto con frangia (davanti al viso, con la "finestra" per
 * il viso). giu = dove finiscono le punte (in raggi sotto il centro).
 */
function caschetto(x, y, r, g, giu) {
  const p = new Path2D();
  const oL = x - r * 1.12, oR = x + r * (1.12 - g * 0.16);
  const iL = x - r * (0.72 - g * 0.42), iR = x + r * (0.72 + g * 0.18);
  const yg = y + r * giu, fr = y - r * 0.36;
  p.moveTo(oL + r * 0.12, yg);
  p.bezierCurveTo(oL - r * 0.14, y, oL, y - r * 1.2, x - g * r * 0.1, y - r * 1.18);
  p.bezierCurveTo(oR, y - r * 1.2, oR + r * 0.14, y, oR - r * 0.12, yg);
  p.quadraticCurveTo((oR + iR) / 2, yg + r * 0.1, iR, yg - r * 0.14);
  p.quadraticCurveTo(iR + r * 0.1, y, iR - r * 0.04, fr);
  const denti = 5;  // la frangia: "denti" morbidi da destra a sinistra
  for (let k = 1; k <= denti; k++) {
    const xa = iR - r * 0.04 + (iL - iR + r * 0.08) * (k / denti);
    p.quadraticCurveTo(xa + (iR - iL) / denti * 0.5, fr - r * 0.2, xa, fr + (k % 2 ? r * 0.06 : 0));
  }
  p.quadraticCurveTo(iL - r * 0.1, y, iL, yg - r * 0.14);
  p.quadraticCurveTo((oL + iL) / 2, yg + r * 0.1, oL + r * 0.12, yg);
  p.closePath();
  return p;
}

/* ======================================================================== */
/*  FORNAIA                                                                 */
/* ======================================================================== */
const FORNAIA = {
  pelle: '#f9dcc6', capelli: '#9c6b47', maglia: '#fbf7ee', gonna: '#9fd4c5',
  stivali: '#8b5c3f', sacco: '#e8cf9f', pane: '#e3ad62',
};

/** Il sacchetto di carta con le baguette che spuntano. */
function saccoPane(ctx, s) {
  const C = FORNAIA;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.ang);
  for (const [bx, a, lu] of [[-7, 0.02, 44], [4, 0.17, 50], [11, 0.32, 38]]) {
    ctx.save();
    ctx.translate(bx, -20);
    ctx.rotate(a);
    pezzo(ctx, Forme.rettangolo(-6.5, -lu, 13, lu + 12, 6.5), C.pane, 3);
    for (let k = 0; k < 2; k++) tratto(ctx, [[-3, -lu + 13 + k * 13], [3.5, -lu + 7 + k * 13]], 2, schiarisci(C.pane, 0.55));
    ctx.restore();
  }
  const sacco = Forme.poligono([[-17, -29], [-10, -26], [-3, -30], [5, -26], [12, -30], [17, -27], [16, 30], [-16, 30]], false);
  pezzo(ctx, sacco, C.sacco, 6);
  tratto(ctx, [[-16.5, -18], [16.5, -17]], 1.6, STILE.inchiostroChiaro);
  ctx.restore();
}

function disegnaFornaia(ctx, P) {
  const C = FORNAIA;
  corpo(ctx, P, {
    D: { gamba: 168, coscia: 82, caviglia: 12, anche: 14, vita: 206, spalla: 284, spalle: 27, testa: 325,
      braccio: 60, avambraccio: 54, passo: 32, alzata: 14, bob: 4, oscilla: 0.45 },
    gamba: C.stivali, gambaLarg: 15, scarpa: C.stivali, scarpaL: 26, scarpaA: 13,
    manica: C.maglia, manicaLarg: 15, pelle: C.pelle,
    posa(S, P) {
      // il braccio destro (o quello vicino) regge il sacchetto del pane
      const b = S.braccia[1], su = P.idle ? 7 : 0;
      if (P.lato) {
        b.gomito = [S.collo[0] + 9, S.collo[1] + 52];
        b.mano = [S.collo[0] + 25, S.collo[1] + 60];
      } else {
        b.gomito = [b.spalla[0] + 8, b.spalla[1] + 50 - su * 0.5];
        b.mano = [b.spalla[0] - 11, b.spalla[1] + 60 - su];
      }
      b.nascosta = true;   // la mano va sopra al sacchetto
      S.sacco = { x: b.mano[0] + 10, y: b.mano[1] - 27, ang: (P.lato ? 0.18 : 0.08) + (P.idle ? 0.12 : 0) };
    },
    sotto(ctx, S, P) { gonna(ctx, S, P, C.gonna, 19, 50, 38); },
    busto(ctx, S, P) {
      pezzo(ctx, sagomaBusto(S, P, 27, 19, 3), C.maglia, 6);
      const [cx, cy] = S.collo, sx = P.lato ? 3 : 0;
      pezzo(ctx, Forme.rettangolo(cx - 11 + sx, cy - 18, 22, 21, 7), C.maglia, 3);   // collo alto
      tratto(ctx, [[cx - 7 + sx, cy - 9], [cx + 8 + sx, cy - 9]], 1.5, STILE.inchiostroChiaro);
    },
    testa(ctx, S, P) {
      testaUmana(ctx, S, P, {
        r: 29, pelle: C.pelle,
        capelli: (c, x, y, r, g) => pezzo(c, caschetto(x, y, r, g, 0.86), C.capelli, 5),
      });
    },
    davanti(ctx, S) {
      saccoPane(ctx, S.sacco);
      manoSu(ctx, S.braccia[1], C.pelle, 6.5);
    },
  });
}

/* ======================================================================== */
/*  SIGNORA ELEGANTE                                                        */
/* ======================================================================== */
const SIGNORA = {
  pelle: '#f8dac6', capelli: '#b0704a', cappotto: '#b9a7d8', paglia: '#f0d89c', nastro: '#e08ea6',
  fiore: '#f2897f', foulard: '#f6c0c8', borsa: '#c86c7c', calze: '#e9c4ae', scarpe: '#7a4c6c', guanti: '#fbf6ee',
};

/** Cappello di paglia a tesa larga, con nastro e fiore. */
function cappelloPaglia(ctx, x, y, r) {
  const C = SIGNORA, by = y - r * 0.8;
  pezzo(ctx, Forme.ellisse(x, by, r * 1.95, r * 0.42, -0.05), C.paglia, 4);
  linea(ctx, Forme.ellisse(x, by, r * 1.6, r * 0.3, -0.05), { spessore: 1.4, colore: STILE.inchiostroChiaro, alfa: 0.7 });
  const cupola = (p) => {
    p.moveTo(x - r * 0.92, by + 1);
    p.bezierCurveTo(x - r * 0.98, by - r * 1.15, x + r * 0.98, by - r * 1.15, x + r * 0.92, by + 1);
    p.quadraticCurveTo(x, by + r * 0.2, x - r * 0.92, by + 1);
  };
  pezzo(ctx, cupola, C.paglia, 6);
  // nastro: la parte bassa della cupola
  ctx.save();
  ctx.clip(percorso(cupola));
  tinta(ctx, Forme.rettangolo(x - r, by - r * 0.38, r * 2, r * 0.7, 0), C.nastro);
  ctx.restore();
  linea(ctx, cupola, { spessore: INK });
  tratto(ctx, [[x - r * 0.94, by - r * 0.36], [x, by - r * 0.44], [x + r * 0.94, by - r * 0.36]], INK * 0.8);
  // fiore sul fianco
  const fx = x - r * 0.62, fy = by - r * 0.24;
  pezzo(ctx, Forme.ellisse(fx - 9, fy + 3, 7, 3.5, 0.5), '#8fbf78', 0);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - 0.3;
    pezzo(ctx, Forme.cerchio(fx + Math.cos(a) * 5.5, fy + Math.sin(a) * 5.5, 4.6), C.fiore, 0);
  }
  pezzo(ctx, Forme.cerchio(fx, fy, 3.2), '#f8d66d', 0);
}

function disegnaSignora(ctx, P) {
  const C = SIGNORA;
  corpo(ctx, P, {
    D: { gamba: 166, coscia: 80, caviglia: 10, anche: 12, vita: 214, spalla: 282, spalle: 27, testa: 318,
      braccio: 58, avambraccio: 52, passo: 29, alzata: 12, bob: 3, oscilla: 0.32 },
    gamba: C.calze, gambaLarg: 12, scarpa: C.scarpe, scarpaL: 22, scarpaA: 10,
    manica: C.cappotto, manicaLarg: 15, pelle: C.pelle, mano: C.guanti, manoR: 6,
    posa(S, P) {
      const [b0, b1] = S.braccia;
      if (P.lato) { S.borsa = b1.mano; return; }
      // braccio sinistro piegato: la borsetta pende dall'avambraccio
      b0.gomito = [b0.spalla[0] - 8, b0.spalla[1] + 48];
      b0.mano = [b0.spalla[0] + 9, b0.spalla[1] + 64];
      S.borsa = lungo(b0.gomito, b0.mano, 0.35);
      if (P.idle) {   // si tocca la tesa del cappello
        b1.gomito = [b1.spalla[0] + 20, b1.spalla[1] - 12];
        b1.mano = [b1.spalla[0] + 14, b1.spalla[1] - 54];
      }
    },
    sotto(ctx, S, P) {
      const g = gonna(ctx, S, P, C.cappotto, 20, 102, 40);
      if (!P.lato) tratto(ctx, [[S.vita[0] + 2, S.vita[1] + 4], [S.vita[0] + 4, g.yo + 4]], INK * 0.8);
    },
    busto(ctx, S, P) {
      pezzo(ctx, sagomaBusto(S, P, 27, 20, 4), C.cappotto, 6);
      const [cx, cy] = S.collo, [vx, vy] = S.vita;
      // cintura
      if (P.lato) pezzo(ctx, Forme.rettangolo(vx - 15, vy - 4, 31, 8, 3), scurisci(C.cappotto, 0.12), 0);
      else pezzo(ctx, Forme.rettangolo(vx - 20, vy - 4, 40, 8, 3), scurisci(C.cappotto, 0.12), 0);
      // bottoni
      const bx = P.lato ? cx + 10 : cx + 3;
      for (const yy of [cy + 32, cy + 50]) pezzo(ctx, Forme.cerchio(bx, yy, 2.6), scurisci(C.cappotto, 0.35), 0);
      // foulard annodato al collo
      const fx = P.lato ? cx + 4 : cx;
      pezzo(ctx, Forme.ellisse(fx, cy - 4, 14, 8), C.foulard, 3);
      pezzo(ctx, Forme.poligono([[fx + 3, cy], [fx + 12, cy + 20], [fx + 4, cy + 23], [fx - 1, cy + 4]], true), C.foulard, 2);
      pezzo(ctx, Forme.cerchio(fx + 1, cy + 1, 4.5), C.foulard, 0);
    },
    testa(ctx, S, P) {
      testaUmana(ctx, S, P, {
        r: 27, pelle: C.pelle, occhi: P.idle ? 'felice' : 'aperto',
        dietro: (c, x, y, r, g) => {
          // riccioli castani che spuntano sotto la tesa
          for (const s of g ? [-1] : [-1, 1]) pezzo(c, Forme.ellisse(x + s * r * 0.86 - g * r * 0.1, y - r * 0.05, r * 0.34, r * 0.46), C.capelli, 3);
        },
        capelli: (c, x, y, r, g) => pezzo(c, caschetto(x, y, r, g, 0.4), C.capelli, 4),
        sopra: (c, x, y, r, g, V) => {
          // sopracciglia sottili ad arco, ciglia corte all'esterno, poi il cappello
          for (const s of [-1, 1]) {
            const ox = V.cx + s * V.ex;
            tratto(c, [[ox - r * 0.13, V.ey - r * 0.3], [ox, V.ey - r * 0.38], [ox + r * 0.13, V.ey - r * 0.31]], 1.5);
            if (P.idle) continue;
            tratto(c, [[ox + s * r * 0.07, V.ey - r * 0.04], [ox + s * r * 0.15, V.ey - r * 0.1]], 1.5);
          }
          cappelloPaglia(c, x - g * r * 0.05, y, r);
        },
      });
    },
    davanti(ctx, S, P) {
      // borsetta appesa con il manico sottile
      const [hx, hy] = S.borsa;
      const by = hy + (P.lato ? 16 : 22);
      linea(ctx, (p) => { p.moveTo(hx - 8, by); p.quadraticCurveTo(hx, hy - 10, hx + 8, by); }, { spessore: 2 });
      const borsa = (p) => {
        p.moveTo(hx - 13, by); p.lineTo(hx + 13, by);
        p.quadraticCurveTo(hx + 16, by + 20, hx + 12, by + 20); p.lineTo(hx - 12, by + 20);
        p.quadraticCurveTo(hx - 16, by + 20, hx - 13, by); p.closePath();
      };
      pezzo(ctx, borsa, C.borsa, 4);
      pezzo(ctx, (p) => { p.moveTo(hx - 13, by); p.lineTo(hx + 13, by); p.quadraticCurveTo(hx, by + 13, hx - 13, by); }, scurisci(C.borsa, 0.1), 0);
      pezzo(ctx, Forme.cerchio(hx, by + 7, 2.2), '#f5d77a', 0);
      if (P.lato || P.idle) manoSu(ctx, S.braccia[1], C.guanti, 6);   // mano sopra borsa o tesa
    },
  });
}

/* ======================================================================== */
/*  VECCHIO SIGNORE CON LA PIPA                                             */
/* ======================================================================== */
const SIGNORE = {
  pelle: '#f3d0b3', capelli: '#e4e0d8', basco: '#7d5238', cappotto: '#a97b52', pantaloni: '#a59bc6',
  scarpe: '#5d4031', pipa: '#6e4532', fumo: '#f3f1ee',
};

/** La pipa: cannello curvo e fornello. */
function pipa(ctx, x, y, r) {
  const C = SIGNORE;
  tratto(ctx, [[x, y], [x + r * 0.35, y + r * 0.12], [x + r * 0.58, y + r * 0.08]], 4.4, STILE.inchiostro);
  tratto(ctx, [[x, y], [x + r * 0.35, y + r * 0.12], [x + r * 0.58, y + r * 0.08]], 2, C.pipa);
  pezzo(ctx, Forme.rettangolo(x + r * 0.5, y - r * 0.24, r * 0.34, r * 0.42, r * 0.12), C.pipa, 2);
  tinta(ctx, Forme.ellisse(x + r * 0.67, y - r * 0.22, r * 0.12, r * 0.04), '#3a2820');
}

/** Tre nuvolette di fumo che salgono dal fornello (x, y). */
function fumo(ctx, x, y) {
  [[6, -14, 5], [15, -30, 7], [11, -50, 9.5]].forEach(([dx, dy, rr]) => {
    const f = Forme.poligono([[x + dx - rr, y + dy], [x + dx - rr * 0.6, y + dy - rr], [x + dx + rr * 0.5, y + dy - rr * 1.05],
      [x + dx + rr, y + dy - rr * 0.1], [x + dx + rr * 0.6, y + dy + rr * 0.8], [x + dx - rr * 0.5, y + dy + rr * 0.85]], true);
    tinta(ctx, f, SIGNORE.fumo, 0.95);
    linea(ctx, f, { spessore: 1.6, colore: STILE.inchiostroChiaro, alfa: 0.85 });
  });
}

function disegnaSignore(ctx, P) {
  const C = SIGNORE;
  corpo(ctx, P, {
    D: { gamba: 158, coscia: 76, caviglia: 10, anche: 15, vita: 200, spalla: 270, spalle: 30, testa: 305,
      braccio: 58, avambraccio: 52, passo: 25, alzata: 10, bob: 3, oscilla: 0.32, inclina: 6, testaAvanti: 4 },
    gamba: C.pantaloni, gambaLarg: 17, scarpa: C.scarpe, scarpaL: 27, scarpaA: 12,
    manica: C.cappotto, manicaLarg: 17, pelle: C.pelle, manoR: 7,
    posa(S, P) {
      if (P.lato) return;
      // di fronte tiene le mani in tasca
      S.braccia.forEach((b, k) => {
        const s = k ? 1 : -1;
        b.gomito = [s * 36, b.spalla[1] + 52];
        b.mano = [s * 21, b.spalla[1] + 90];
        b.nascosta = true;
      });
    },
    sotto(ctx, S, P) {
      const g = gonna(ctx, S, P, C.cappotto, 25, 96, 33, false);
      if (!P.lato) tratto(ctx, [[S.vita[0] + 3, S.vita[1]], [S.vita[0] + 4, g.yo + 3]], INK * 0.8);
      else tratto(ctx, [[S.vita[0] + 14, S.vita[1] + 10], [g.dx - 16, g.yo + 2]], 1.6, STILE.inchiostroChiaro);
    },
    busto(ctx, S, P) {
      pezzo(ctx, sagomaBusto(S, P, 30, 25, 4), C.cappotto, 6);
      const [cx, cy] = S.collo;
      // bavero: due triangoli morbidi
      if (!P.lato) {
        for (const s of [-1, 1]) pezzo(ctx, Forme.poligono([[cx + s * 4, cy - 3], [cx + s * 19, cy - 2], [cx + s * 6, cy + 36]], true), schiarisci(C.cappotto, 0.12), 0);
        for (const yy of [cy + 52, cy + 74]) pezzo(ctx, Forme.cerchio(cx + 8, yy, 2.8), scurisci(C.cappotto, 0.4), 0);
      } else {
        pezzo(ctx, Forme.poligono([[cx + 2, cy - 3], [cx + 17, cy + 2], [cx + 10, cy + 34]], true), schiarisci(C.cappotto, 0.12), 0);
        pezzo(ctx, Forme.cerchio(cx + 13, cy + 54, 2.8), scurisci(C.cappotto, 0.4), 0);
      }
      tinta(ctx, Forme.ellisse(cx + (P.lato ? 4 : 0), cy - 4, 10, 6), C.pelle);  // collo
    },
    testa(ctx, S, P) {
      testaUmana(ctx, S, P, {
        r: 28, pelle: C.pelle, senzaBocca: true, occhi: P.idle ? 'chiuso' : 'aperto',
        dietro: (c, x, y, r, g) => {
          // ciuffi bianchi e orecchie
          for (const s of g ? [-1] : [-1, 1]) {
            pezzo(c, Forme.ellisse(x + s * r * 0.84 - g * r * 0.08, y - r * 0.08, r * 0.34, r * 0.46), C.capelli, 3);
            pezzo(c, Forme.ellisse(x + s * r * (0.9 - g * 0.06), y + r * 0.18, r * 0.2, r * 0.27), C.pelle, 2);
          }
        },
        sopra: (c, x, y, r, g, V) => {
          // sopracciglia folte
          for (const s of [-1, 1]) tratto(c, [[V.cx + s * V.ex - r * 0.13, V.ey - r * 0.36], [V.cx + s * V.ex + r * 0.13, V.ey - r * 0.4]], 3.2, '#bdb6ab');
          occhiali(c, V.cx - V.ex, V.cx + V.ex, V.ey, r * 0.23, STILE.inchiostro);
          // baffi
          const mx = V.cx + g * r * 0.08, my = y + r * 0.47;
          for (const s of [-1, 1]) pezzo(c, Forme.ellisse(mx + s * r * 0.17, my, r * 0.21, r * 0.11, s * 0.25), C.capelli, 0);
          if (P.aperta) pezzo(c, Forme.ellisse(mx - r * 0.05, my + r * 0.2, r * 0.11, r * 0.09), BOCCA, 0);
          pipa(c, mx + r * 0.2, my + r * 0.15, r);
          // basco
          const bx = x + r * 0.08 - g * r * 0.1, by = y - r * 0.74;
          pezzo(c, Forme.ellisse(bx, by, r * 1.12, r * 0.44, -0.13), C.basco, 4);
          pezzo(c, Forme.rettangolo(bx - 2, by - r * 0.6, 4, 8, 2), C.basco, 0);
          if (P.idle) fumo(c, mx + r * 0.87, my - r * 0.1);   // sbuffa!
        },
      });
    },
    davanti(ctx, S, P) {
      if (P.lato) return;
      // le tasche coprono le mani
      for (const s of [-1, 1]) pezzo(ctx, Forme.rettangolo(s * 21 - 11, S.braccia[0].mano[1] - 4, 22, 12, 3), scurisci(C.cappotto, 0.08), 0);
    },
  });
}

/* ======================================================================== */
/*  LEPRE (O CANGURA) CON LA LANTERNINA                                     */
/* ======================================================================== */
const LEPRE = {
  pelo: '#b48c69', chiaro: '#dcc3a3', interno: '#eab1aa', naso: '#6b4535', golf: '#f3b8d0',
  colletto: '#fffaf1', gonna: '#e0e8a8', lanterna: '#8db7e4', telaio: '#56789f',
};

function orecchioLepre(ctx, bx, by, ang, C) {
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(ang);
  pezzo(ctx, Forme.ellisse(0, -32, 9.5, 35), C.pelo, 4);
  tinta(ctx, Forme.ellisse(0.5, -30, 4.5, 26), C.interno);
  ctx.restore();
}

function testaLepre(ctx, S, P) {
  const C = LEPRE, [x, y] = S.testa, occhi = P.idle ? 'chiuso' : 'aperto';
  if (!P.lato) {
    orecchioLepre(ctx, x - 9, y - 24, -0.16 - (P.idle ? 0.22 : 0), C);
    orecchioLepre(ctx, x + 9, y - 24, 0.14, C);
    pezzo(ctx, Forme.poligono([[x - 20, y - 32], [x + 20, y - 32], [x + 25, y - 6], [x + 13, y + 27], [x, y + 32], [x - 13, y + 27], [x - 25, y - 6]], true), C.pelo, 5);
    tinta(ctx, Forme.ellisse(x, y + 17, 11, 9), C.chiaro);
    guance(ctx, x - 15, x + 15, y + 6, 4.5);
    occhio(ctx, x - 11, y - 7, 3.2, occhi);
    occhio(ctx, x + 11, y - 7, 3.2, occhi);
    tinta(ctx, Forme.ellisse(x, y + 11, 4.2, 3), C.naso);
    tratto(ctx, [[x, y + 13], [x, y + 17]], 1.8);
    if (P.aperta) bocca(ctx, x, y + 19, 9, true);
    else tratto(ctx, [[x - 5, y + 17], [x - 2.5, y + 19.5], [x, y + 17], [x + 2.5, y + 19.5], [x + 5, y + 17]], 1.8);
  } else {
    // di profilo: muso lungo verso destra
    orecchioLepre(ctx, x - 10, y - 20, -0.5, C);
    orecchioLepre(ctx, x - 2, y - 24, -0.32, C);
    pezzo(ctx, Forme.poligono([[x - 18, y - 26], [x + 8, y - 30], [x + 24, y - 10], [x + 40, y + 12], [x + 32, y + 24], [x + 4, y + 24], [x - 20, y + 6]], true), C.pelo, 5);
    tinta(ctx, Forme.ellisse(x + 26, y + 15, 9, 6, 0.4), C.chiaro);
    guance(ctx, x + 8, x + 8, y + 6, 5);
    occhio(ctx, x + 8, y - 8, 3.2, 'aperto');
    tinta(ctx, Forme.ellisse(x + 35, y + 10, 3.6, 2.8), C.naso);
    tratto(ctx, [[x + 33, y + 17], [x + 27, y + 19], [x + 22, y + 17]], 1.8);
  }
}

function lanterna(ctx, x, y) {
  const C = LEPRE;
  linea(ctx, (p) => { p.moveTo(x - 7, y + 9); p.quadraticCurveTo(x, y - 7, x + 7, y + 9); }, { spessore: 2.2 });
  pezzo(ctx, Forme.rettangolo(x - 10, y + 7, 20, 6, 3), C.telaio, 0);
  pezzo(ctx, Forme.rettangolo(x - 9, y + 12, 18, 25, 4), C.lanterna, 3);
  tinta(ctx, Forme.cerchio(x, y + 21, 3.2), '#3e5678');
  tinta(ctx, Forme.poligono([[x - 1.8, y + 22], [x + 1.8, y + 22], [x + 3, y + 31], [x - 3, y + 31]]), '#3e5678');
  pezzo(ctx, Forme.rettangolo(x - 10, y + 36, 20, 5, 2.5), C.telaio, 0);
}

function disegnaLepre(ctx, P) {
  const C = LEPRE;
  corpo(ctx, P, {
    D: { gamba: 150, coscia: 72, caviglia: 12, anche: 12, vita: 194, spalla: 262, spalle: 21, testa: 316,
      braccio: 54, avambraccio: 48, passo: 30, alzata: 12, bob: 3, oscilla: 0.35 },
    gamba: C.pelo, gambaLarg: 13, pelle: C.pelo, manica: C.golf, manicaLarg: 13, manoR: 5.5,
    piede(ctx, g, P, scuro) {
      // piedoni da lepre
      const [x, y] = g.piede;
      if (P.lato) pezzo(ctx, Forme.poligono([[x - 8, y - 1.2], [x + 30, y - 1.2], [x + 30, y - 9], [x - 8, y - 11]], true), scuro(C.pelo), 3);
      else pezzo(ctx, Forme.ellisse(x + Math.sign(x) * 2, y - 7.5, 9, 6.3), scuro(C.pelo), 3);
    },
    posa(S, P) {
      const b = S.braccia[1];
      if (!P.lato) {
        b.gomito = [b.spalla[0] + 7, b.spalla[1] + 48];
        b.mano = [b.spalla[0] + 1, b.spalla[1] + 80];
      }
      b.nascosta = true;
      S.lanterna = b.mano;
    },
    dietro(ctx, S, P) {
      // la lunga coda appoggiata a terra
      const ond = P.lato ? Math.sin(S.fi) * 3 : 0;
      const pt = P.lato
        ? [[S.vita[0] - 10, -112], [-48, -46 + ond], [-88, -9]]
        : [[-12, -80], [-46, -28], [-84, -8]];
      pezzo(ctx, arto(pt, [17, 11, 5]), C.pelo, 3);
    },
    sotto(ctx, S, P) { gonna(ctx, S, P, C.gonna, 17, 22, 37); },
    busto(ctx, S, P) {
      const [cx, cy] = S.collo, [tx, ty] = S.testa;
      pezzo(ctx, arto([[cx + (P.lato ? 2 : 0), cy + 8], [tx, ty + 12]], [19, 17]), C.pelo, 3);   // collo
      pezzo(ctx, sagomaBusto(S, P, 21, 18, 18), C.golf, 5);
      // colletto bianco tondo e bottoni
      const ox = P.lato ? cx + 4 : cx;
      for (const s of P.lato ? [1] : [-1, 1]) pezzo(ctx, Forme.ellisse(ox + s * 7, cy + 1, 9, 6.5, s * 0.35), C.colletto, 2);
      const bx = P.lato ? cx + 9 : cx;
      for (const yy of [cy + 20, cy + 38, cy + 56]) pezzo(ctx, Forme.cerchio(bx, yy, 2.2), C.colletto, 0);
    },
    testa: testaLepre,
    davanti(ctx, S) {
      lanterna(ctx, S.lanterna[0], S.lanterna[1] + 3);
      manoSu(ctx, S.braccia[1], C.pelo, 5.5);
    },
  });
}

/* ======================================================================== */
/*  NONNINA COL BASTONE                                                     */
/* ======================================================================== */
const NONNA = {
  pelle: '#f3d5be', interno: '#eeb3a8', capelli: '#cfcbc6', scialle: '#ab94cc', abito: '#efc6d9',
  bastone: '#8d6a4b', scarpe: '#9a7356',
};

function testaNonna(ctx, S, P) {
  const C = NONNA, g = P.lato ? 1 : 0;
  testaUmana(ctx, S, P, {
    r: 27, pelle: C.pelle, occhi: 'felice', inclina: P.idle ? 0.12 : 0,
    dietro: (c, x, y, r) => {
      // crocchia e orecchie grandi e tonde
      pezzo(c, Forme.cerchio(x - g * r * 0.7, y - r * (1.12 - g * 0.18), r * 0.42), C.capelli, 4);
      for (const s of g ? [-1] : [-1, 1]) {
        pezzo(c, Forme.cerchio(x + s * r * (0.94 - g * 0.08), y + r * 0.1, r * 0.3), C.pelle, 2);
        tinta(c, Forme.cerchio(x + s * r * (0.97 - g * 0.06), y + r * 0.12, r * 0.15), C.interno);
      }
    },
    capelli: (c, x, y, r) => {
      // capelli grigi pettinati all'indietro con la riga in mezzo
      const p = new Path2D();
      p.moveTo(x - r * 0.93, y + r * 0.02);
      p.bezierCurveTo(x - r * 1.0, y - r * 1.25, x + r * 1.0, y - r * 1.25, x + r * 0.93, y + r * 0.02);
      p.quadraticCurveTo(x + r * 0.7, y - r * 0.5, x + r * 0.1 + g * r * 0.3, y - r * 0.52);
      p.quadraticCurveTo(x - r * 0.7, y - r * 0.5, x - r * 0.93, y + r * 0.02);
      p.closePath();
      pezzo(c, p, C.capelli, 4);
      tratto(c, [[x - r * 0.5, y - r * 0.6], [x - r * 0.1, y - r * 0.85], [x + r * 0.15, y - r * 0.95]], 1.4, STILE.inchiostroChiaro);
      tratto(c, [[x + r * 0.55, y - r * 0.55], [x + r * 0.35, y - r * 0.85]], 1.4, STILE.inchiostroChiaro);
    },
    sopra: (c, x, y, r, gg, V) => occhiali(c, V.cx - V.ex, V.cx + V.ex, V.ey, r * 0.24, STILE.inchiostro),
  });
}

/** Lo scialle lilla appoggiato sulle spalle (copre anche le braccia). */
function scialle(ctx, S, P) {
  const C = NONNA, [cx, cy] = S.collo;
  const pt = P.lato
    ? [[cx - 24, cy + 6], [cx - 10, cy - 10], [cx + 10, cy - 8], [cx + 22, cy + 8], [cx + 20, cy + 30], [cx + 4, cy + 44], [cx - 12, cy + 62], [cx - 28, cy + 40]]
    : [[cx - 12, cy - 9], [cx - 35, cy + 2], [cx - 39, cy + 40], [cx - 20, cy + 50], [cx, cy + 62], [cx + 20, cy + 50], [cx + 39, cy + 40], [cx + 35, cy + 2], [cx + 12, cy - 9]];
  pezzo(ctx, Forme.poligono(pt, true), C.scialle, 7);
  const c = { spessore: 1.5, colore: STILE.inchiostroChiaro };
  if (P.lato) {
    linea(ctx, Forme.curva([[cx + 6, cy + 2], [cx - 2, cy + 26], [cx - 10, cy + 50]]), c);
  } else {
    linea(ctx, Forme.curva([[cx - 24, cy + 12], [cx - 12, cy + 34], [cx - 2, cy + 50]]), c);
    linea(ctx, Forme.curva([[cx + 24, cy + 12], [cx + 12, cy + 34], [cx + 2, cy + 50]]), c);
    pezzo(ctx, Forme.cerchio(cx, cy + 6, 4), '#f2d27a', 0);          // spilla
  }
}

function disegnaNonna(ctx, P) {
  const C = NONNA;
  corpo(ctx, P, {
    D: { gamba: 96, coscia: 45, caviglia: 8, anche: 12, vita: 132, spalla: 190, spalle: 25, testa: 215,
      braccio: 44, avambraccio: 40, passo: 15, alzata: 6, bob: 2, oscilla: 0.2,
      inclina: 20, testaAvanti: 12, testaGiu: 18 },
    gamba: C.pelle, gambaLarg: 10, scarpa: C.scarpe, scarpaL: 22, scarpaA: 11,
    manica: C.abito, manicaLarg: 12, pelle: C.pelle, manoR: 6, testaDavanti: true,
    posa(S, P) {
      const [b0, b1] = S.braccia;
      if (P.lato) {
        // la mano vicina regge il bastone davanti a sé
        b1.gomito = [S.collo[0] + 16, S.collo[1] + 44];
        b1.mano = [S.collo[0] + 32, S.collo[1] + 84];
        S.bastone = { top: b1.mano, x: S.collo[0] + 37 + Math.sin(S.fi) * 5 };
      } else {
        // entrambe le mani sul manico del bastone
        b0.gomito = [-33, b0.spalla[1] + 42];
        b0.mano = [-6, -114];
        b1.gomito = [33, b1.spalla[1] + 44];
        b1.mano = [10, -109];
        S.bastone = { top: [4, -118], x: 4 };
      }
      if (P.idle) S.testa = [S.testa[0], S.testa[1] + 5];   // annuisce
    },
    sotto(ctx, S, P) { gonna(ctx, S, P, C.abito, 21, 12, 35); },
    busto(ctx, S, P) {
      pezzo(ctx, sagomaBusto(S, P, 25, 21, 4), C.abito, 5);
      // bastone: dritto, col manico ricurvo
      const b = S.bastone;
      const asta = Forme.curva([[b.top[0], b.top[1]], [b.x, -1.5]]);
      const manico = Forme.curva([[b.top[0], b.top[1]], [b.top[0] - 4, b.top[1] - 9], [b.top[0] - 13, b.top[1] - 5]]);
      for (const p of [asta, manico]) {
        linea(ctx, p, { spessore: 7.5 });
        linea(ctx, p, { spessore: 3.8, colore: C.bastone });
      }
    },
    mantella: scialle,
    testa: testaNonna,
  });
}

/* ======================================================================== */
/*  TIGRE CHE LEGGE                                                         */
/* ======================================================================== */
const TIGRE = {
  pelo: '#f2a75b', strisce: '#6f4430', bianco: '#fcf1de', naso: '#c9707a', maglione: '#8e9a57',
  pantaloni: '#3f4f88', libro: '#8eb5de',
};

/** Strisce scure dentro una forma (clip), date come tratti. */
function strisce(ctx, forma, tratti, spessore) {
  ctx.save();
  ctx.clip(percorso(forma));
  for (const t of tratti) linea(ctx, Forme.curva(t), { spessore, colore: TIGRE.strisce });
  ctx.restore();
  linea(ctx, forma, { spessore: INK });
}

function testaTigre(ctx, S, P) {
  const C = TIGRE, [x, y] = S.testa;
  // ciuffi sulle guance (dietro la testa)
  for (const s of [-1, 1]) {
    pezzo(ctx, Forme.poligono([[x + s * 28, y - 6], [x + s * 48, y + 2], [x + s * 38, y + 8], [x + s * 47, y + 16], [x + s * 30, y + 24]]), C.pelo, 0);
  }
  for (const s of [-1, 1]) {
    pezzo(ctx, Forme.cerchio(x + s * 26, y - 26, 11.5), C.pelo, 3);
    tinta(ctx, Forme.cerchio(x + s * 26, y - 24.5, 6), C.bianco);
  }
  const testa = Forme.ellisse(x, y, 38, 31);
  tinta(ctx, testa, C.pelo);
  ombraCel(ctx, percorso(testa), 5);
  strisce(ctx, testa, [
    [[x, y - 32], [x, y - 20]], [[x - 11, y - 31], [x - 8, y - 21]], [[x + 11, y - 31], [x + 8, y - 21]],
    [[x - 40, y - 8], [x - 28, y - 6]], [[x - 40, y + 4], [x - 30, y + 2]],
    [[x + 40, y - 8], [x + 28, y - 6]], [[x + 40, y + 4], [x + 30, y + 2]],
  ], 3.6);
  // muso bianco
  for (const s of [-1, 1]) tinta(ctx, Forme.ellisse(x + s * 9, y + 15, 12, 10), C.bianco);
  tinta(ctx, Forme.ellisse(x, y + 22, 10, 7), C.bianco);
  guance(ctx, x - 22, x + 22, y + 8, 5.5);
  // occhi: da fermo guarda in basso, nel libro
  const leggi = !P.parla;
  for (const s of [-1, 1]) {
    if (leggi) {   // palpebra a metà: guarda giù nel libro
      const ox = x + s * 14;
      tinta(ctx, Forme.ellisse(ox, y - 3, 3, 3.6), PUPILLA);
      tinta(ctx, Forme.rettangolo(ox - 5, y - 9, 10, 6, 0), C.pelo);
      tratto(ctx, [[ox - 5.5, y - 3.5], [ox + 5.5, y - 3.5]], 2.2);
    } else occhio(ctx, x + s * 14, y - 6, 3.6, 'aperto');
  }
  pezzo(ctx, Forme.poligono([[x - 6, y + 5], [x + 6, y + 5], [x, y + 11]], true), C.naso, 0);
  tratto(ctx, [[x, y + 10], [x, y + 14]], 1.8);
  if (P.aperta) bocca(ctx, x, y + 16, 11, true);
  else tratto(ctx, [[x - 6, y + 13], [x - 3, y + 16], [x, y + 14], [x + 3, y + 16], [x + 6, y + 13]], 1.8);
}

/** Il libro visto da dietro (copertina blu con un fantasmino) e, se gira pagina, il foglio alzato. */
function libro(ctx, x, y, giraPagina) {
  const C = TIGRE;
  pezzo(ctx, Forme.poligono([[x - 40, y - 27], [x, y - 22], [x + 40, y - 27], [x + 40, y - 29], [x, y - 25], [x - 40, y - 29]]), BIANCO, 0);
  if (giraPagina) {
    pezzo(ctx, (p) => { p.moveTo(x - 1, y - 24); p.bezierCurveTo(x - 2, y - 62, x - 34, y - 66, x - 40, y - 38); p.quadraticCurveTo(x - 22, y - 42, x - 1, y - 24); }, BIANCO, 3);
    tratto(ctx, [[x - 6, y - 40], [x - 22, y - 50]], 1.4, STILE.inchiostroChiaro);
  }
  pezzo(ctx, Forme.poligono([[x - 42, y - 27], [x - 1, y - 22], [x - 1, y + 25], [x - 42, y + 20]]), C.libro, 4);
  pezzo(ctx, Forme.poligono([[x + 1, y - 22], [x + 42, y - 27], [x + 42, y + 20], [x + 1, y + 25]]), C.libro, 4);
  pezzo(ctx, Forme.rettangolo(x - 4, y - 23, 8, 48, 3), scurisci(C.libro, 0.18), 0);
  // il fantasmino sulla copertina
  const fx = x + 22, fy = y + 2;
  pezzo(ctx, (p) => { p.moveTo(fx - 9, fy + 11); p.quadraticCurveTo(fx - 11, fy - 12, fx, fy - 12); p.quadraticCurveTo(fx + 11, fy - 12, fx + 9, fy + 11); p.lineTo(fx + 4, fy + 8); p.lineTo(fx, fy + 11); p.lineTo(fx - 4, fy + 8); p.closePath(); }, BIANCO, 0);
  tinta(ctx, Forme.cerchio(fx - 3, fy - 3, 1.4), PUPILLA);
  tinta(ctx, Forme.cerchio(fx + 3, fy - 3, 1.4), PUPILLA);
}

function disegnaTigre(ctx, P) {
  const C = TIGRE;
  corpo(ctx, P, {
    D: { gamba: 146, coscia: 68, caviglia: 12, anche: 22, vita: 172, spalla: 270, spalle: 42, testa: 318,
      braccio: 56, avambraccio: 46 },
    gamba: C.pantaloni, gambaLarg: 37, pelle: C.pelo, manica: C.maglione, manicaLarg: 25, manoR: 9,
    piede(ctx, g) {
      const [x, y] = g.piede;
      pezzo(ctx, Forme.poligono([[x - 19, y - 1.2], [x + 19, y - 1.2], [x + 18, y - 17], [x - 18, y - 17]], true), C.pelo, 3);
      for (const d of [-6, 6]) tratto(ctx, [[x + d, y - 2], [x + d, y - 7]], 1.6);
    },
    posa(S) {
      // entrambe le zampe reggono il libro davanti al petto
      S.braccia.forEach((b, k) => {
        const s = k ? 1 : -1;
        b.gomito = [s * 52, b.spalla[1] + 48];
        b.mano = [s * 34, b.spalla[1] + 30];
        b.nascosta = true;
      });
    },
    dietro(ctx) {
      // coda a S con gli anelli scuri messi di traverso
      const pt = [[-30, -150], [-66, -136], [-88, -160], [-84, -204]];
      const coda = arto(pt, [16, 15, 14, 13]);
      tinta(ctx, coda, C.pelo);
      const anelli = [[0.34, -0.2], [0.5, 0.3], [0.66, 0.9], [0.8, 1.3], [0.93, 1.5]].map(([t, a]) => {
        const k = Math.min(2, Math.floor(t * 3)), q = lungo(pt[k], pt[k + 1], t * 3 - k);
        return [[q[0] - 11 * Math.cos(a), q[1] - 11 * Math.sin(a)], [q[0] + 11 * Math.cos(a), q[1] + 11 * Math.sin(a)]];
      });
      strisce(ctx, coda, anelli, 4.2);
    },
    busto(ctx, S) {
      const [cx, cy] = S.collo;
      const m = Forme.poligono([[cx - 18, cy - 6], [cx - 46, cy + 2], [cx - 52, cy + 60], [cx - 44, cy + 112], [cx + 44, cy + 112],
        [cx + 52, cy + 60], [cx + 46, cy + 2], [cx + 18, cy - 6]], true);
      pezzo(ctx, m, C.maglione, 8);
      // bordo a costine in basso e collo
      pezzo(ctx, Forme.rettangolo(cx - 45, cy + 98, 90, 14, 6), scurisci(C.maglione, 0.08), 0);
      for (let k = -40; k <= 40; k += 8) tratto(ctx, [[cx + k, cy + 101], [cx + k, cy + 109]], 1.3, STILE.inchiostroChiaro);
      pezzo(ctx, Forme.ellisse(cx, cy - 2, 21, 8), scurisci(C.maglione, 0.08), 0);
    },
    testa: testaTigre,
    davanti(ctx, S, P) {
      libro(ctx, 0, S.braccia[0].mano[1] - 10, P.idle);
      for (const b of S.braccia) manoSu(ctx, { gomito: [b.mano[0] * 1.4, b.mano[1] + 10], mano: b.mano }, C.pelo, 9);
    },
  });
}

/* ======================================================================== */
/*  CAVALLO A BRACCIA CONSERTE                                              */
/* ======================================================================== */
const CAVALLO = {
  pelo: '#b99872', criniera: '#ecd59b', scuro: '#5c4637', maglia: '#93b3e3', toppa: '#f2a6a2',
  pantaloni: '#f8f5ed', erba: '#7fae5a',
};

function testaCavallo(ctx, S, P) {
  const C = CAVALLO, [x, y] = S.testa;
  const mastica = P.idle ? 2 : 0;
  ctx.save();
  ctx.translate(x, y); ctx.scale(1.18, 1.18); ctx.translate(-x, -y);   // testone da cavallo
  // criniera che scende lungo il collo
  pezzo(ctx, Forme.poligono([[x - 22, y - 30], [x - 8, y - 22], [x - 14, y + 20], [x - 22, y + 58], [x - 33, y + 52], [x - 32, y + 22], [x - 36, y - 6]], true), C.criniera, 4);
  // orecchio
  pezzo(ctx, Forme.poligono([[x - 16, y - 24], [x - 18, y - 52], [x - 4, y - 30]], true), C.pelo, 2);
  // muso lungo di profilo, verso destra
  const testa = Forme.poligono([[x - 18, y - 22], [x + 4, y - 32], [x + 26, y - 24], [x + 46, y + 4], [x + 50, y + 22],
    [x + 44, y + 36 + mastica], [x + 26, y + 36 + mastica], [x + 6, y + 30], [x - 16, y + 18], [x - 26, y - 4]], true);
  pezzo(ctx, testa, C.pelo, 6);
  // ciuffo sulla fronte
  pezzo(ctx, Forme.poligono([[x - 18, y - 26], [x + 2, y - 33], [x + 16, y - 24], [x + 12, y - 12], [x + 6, y - 20], [x + 2, y - 8], [x - 4, y - 18], [x - 12, y - 10]], true), C.criniera, 3);
  occhio(ctx, x + 6, y - 2, 3.4, 'aperto');
  tratto(ctx, [[x + 1, y - 9], [x + 11, y - 9]], 1.8);
  tratto(ctx, [[x + 40, y + 13], [x + 44, y + 18], [x + 41, y + 22]], 2);         // narice
  if (P.aperta) {
    pezzo(ctx, Forme.poligono([[x + 48, y + 28], [x + 28, y + 30], [x + 44, y + 40]], true), BOCCA, 0);
  } else {
    tratto(ctx, [[x + 47, y + 29 + mastica * 0.5], [x + 32, y + 30 + mastica * 0.5]], 2);
  }
  // filo d'erba: da fermo lo mastica (si alza e si abbassa)
  const ang = P.idle ? -0.45 : 0.25;
  const ex = x + 34 + Math.cos(ang) * 36, ey = y + 30 + Math.sin(ang) * 36;
  tratto(ctx, [[x + 34, y + 30], [(x + 34 + ex) / 2, (y + 30 + ey) / 2 - 3], [ex, ey]], 2.4, scurisci(C.erba, 0.15));
  pezzo(ctx, Forme.ellisse(ex + 2, ey - 3, 5, 2.4, ang - 0.8), C.erba, 0);
  guance(ctx, x + 22, x + 22, y + 14, 6);
  ctx.restore();
}

function disegnaCavallo(ctx, P) {
  const C = CAVALLO;
  corpo(ctx, P, {
    D: { gamba: 190, coscia: 92, caviglia: 18, anche: 19, vita: 222, spalla: 298, spalle: 36, testa: 364,
      braccio: 60, avambraccio: 56 },
    gamba: C.pantaloni, gambaLarg: 31, pelle: C.pelo, manica: C.maglia, manicaLarg: 22, manicaCorta: true,
    mano: C.scuro, manoR: 8,
    piede(ctx, g) {
      const [x, y] = g.piede;
      pezzo(ctx, Forme.rettangolo(x - 17, g.caviglia[1] - 8, 34, 12, 5), C.pantaloni, 0);    // risvolto
      pezzo(ctx, Forme.poligono([[x - 15, y - 1.2], [x + 15, y - 1.2], [x + 14, y - 11], [x - 14, y - 11]], true), C.scuro, 3);
    },
    posa(S) {
      // braccia conserte
      const [b0, b1] = S.braccia;
      b0.gomito = [-43, b0.spalla[1] + 52]; b0.mano = [26, b0.spalla[1] + 38];
      b1.gomito = [43, b1.spalla[1] + 58]; b1.mano = [-24, b1.spalla[1] + 44];
    },
    sotto(ctx, S) {
      // pantaloni larghi: il bacino unisce le due gambe (contorno solo ai lati)
      const [vx, vy] = S.vita, su = vy - 4, giu = vy + 60, sx = vx - 35, dx = vx + 35;
      tinta(ctx, Forme.rettangolo(sx, su, 70, giu - su, 14), C.pantaloni);
      linea(ctx, (p) => {
        p.moveTo(sx, giu); p.lineTo(sx, su + 14); p.quadraticCurveTo(sx, su, sx + 14, su);
        p.lineTo(dx - 14, su); p.quadraticCurveTo(dx, su, dx, su + 14); p.lineTo(dx, giu);
      }, { spessore: INK });
      tratto(ctx, [[vx - 4, giu + 1], [vx, giu - 8], [vx + 4, giu + 1]]);
      tratto(ctx, [[vx, giu - 8], [vx + 1, giu - 30]], 1.5, STILE.inchiostroChiaro);
    },
    busto(ctx, S) {
      const [cx, cy] = S.collo, [x, y] = S.testa;
      // collo robusto (dietro la maglietta)
      pezzo(ctx, Forme.poligono([[x - 28, cy + 14], [x - 2, cy + 18], [x + 24, cy + 12], [x + 22, y + 24], [x - 12, y - 4], [x - 32, y + 10]], true), C.pelo, 5);
      pezzo(ctx, sagomaBusto(S, { lato: false }, 36, 33, 10), C.maglia, 7);
      pezzo(ctx, Forme.poligono([[cx - 14, cy + 14], [cx + 16, cy + 12], [cx + 18, cy + 34], [cx - 15, cy + 36]], true), C.toppa, 0);
      tratto(ctx, [[cx - 12, cy - 2], [cx, cy + 6], [cx + 12, cy - 2]], 1.8);
    },
    testa: testaCavallo,
  });
}

/* ======================================================================== */
/*  UCCELLO COL CILINDRO                                                    */
/* ======================================================================== */
const UCCELLO = {
  piume: '#f2c65c', pancia: '#f9e3a6', becco: '#e99a48', zampe: '#9b7a4b', cilindro: '#7b69a8',
  nastro: '#d9534f', papillon: '#e0524b',
};

/** Contorno "spettinato": un ovale con ciuffetti di piume a punta sui fianchi bassi. */
function palla(x, y, rx, ry) {
  const p = new Path2D();
  const pt = (a, r) => [x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r];
  const n = 26, passo = (Math.PI * 2) / n;
  p.moveTo(...pt(-Math.PI / 2, 1));
  for (let k = 0; k < n; k++) {
    const a0 = -Math.PI / 2 + k * passo, a1 = a0 + passo, am = a0 + passo / 2;
    const ciuffo = Math.sin(am) > 0.0 && Math.abs(Math.cos(am)) > 0.2;
    if (ciuffo) {          // ciuffetto: sale a punta e ridiscende
      p.quadraticCurveTo(...pt(a0 + passo * 0.15, 1.06), ...pt(am + passo * 0.2, 1.1));
      p.quadraticCurveTo(...pt(am + passo * 0.25, 1.02), ...pt(a1, 1));
    } else {               // tratto liscio (arco)
      p.quadraticCurveTo(...pt(am, 1 / Math.cos(passo / 2)), ...pt(a1, 1));
    }
  }
  p.closePath();
  return p;
}

/** Un'ala: spalla tonda e tre piume in punta (lung = lunghezza). */
function ala(ctx, x, y, ang, lung) {
  const L = lung || 58;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const p = new Path2D();
  p.moveTo(-12, 0);
  p.quadraticCurveTo(0, -8, 12, 0);
  p.quadraticCurveTo(17, L * 0.5, 10, L * 0.84);
  p.quadraticCurveTo(9, L * 1.02, 4, L * 0.9);
  p.quadraticCurveTo(1, L * 1.07, -3, L * 0.88);
  p.quadraticCurveTo(-7, L * 1.0, -10, L * 0.8);
  p.quadraticCurveTo(-16, L * 0.45, -12, 0);
  p.closePath();
  pezzo(ctx, p, UCCELLO.piume, 4);
  tratto(ctx, [[2, L * 0.45], [3, L * 0.78]], 1.4, STILE.inchiostroChiaro);
  tratto(ctx, [[-5, L * 0.5], [-5, L * 0.74]], 1.4, STILE.inchiostroChiaro);
  ctx.restore();
}

function disegnaUccello(ctx, P) {
  const C = UCCELLO;
  const sistema = P.idle ? 3 : 0;   // si sistema gli occhiali
  // zampette sottili con le dita
  for (const s of [-1, 1]) {
    const x = s * 20;
    linea(ctx, Forme.curva([[x, -52], [x + s * 2, -2]]), { spessore: 7.5 });
    linea(ctx, Forme.curva([[x, -52], [x + s * 2, -2]]), { spessore: 3.6, colore: C.zampe });
    for (const d of [-12, 0, 12]) {
      linea(ctx, Forme.curva([[x + s * 2, -3], [x + s * 2 + d, -1.8]]), { spessore: 5.6 });
      linea(ctx, Forme.curva([[x + s * 2, -3], [x + s * 2 + d, -1.8]]), { spessore: 2.4, colore: C.zampe });
    }
  }
  // corpo tondo e piumoso, pancia più chiara
  const corpoP = palla(0, -150, 74, 100);
  tinta(ctx, corpoP, C.piume);
  tinta(ctx, Forme.ellisse(8, -112, 50, 64), C.pancia);
  ombraCel(ctx, corpoP, 9);
  linea(ctx, corpoP, { spessore: INK });
  for (const [x1, y1, x2, y2] of [[-40, -110, -34, -98], [30, -70, 38, -62], [-18, -76, -12, -66], [44, -128, 50, -118]]) {
    tratto(ctx, [[x1, y1], [x2, y2]], 1.4, STILE.inchiostroChiaro);
  }
  // ala sinistra lungo il fianco
  ala(ctx, -62, -176, 0.3, 60);
  // faccia
  const fy = -210;
  guance(ctx, -26, 26, fy + 14, 7);
  const stato = P.idle ? 'chiuso' : 'aperto';
  occhio(ctx, -14, fy, 3.4, stato);
  occhio(ctx, 14, fy, 3.4, stato);
  occhiali(ctx, -14, 14, fy - sistema, 9.5, STILE.inchiostro);
  // becco (aperto per parlare)
  if (P.aperta) {
    pezzo(ctx, Forme.poligono([[-6, fy + 18], [6, fy + 18], [0, fy + 30]], true), scurisci(C.becco, 0.12), 0);
    tinta(ctx, Forme.ellisse(0, fy + 18, 5, 3), BOCCA);
    pezzo(ctx, Forme.poligono([[-9, fy + 8], [9, fy + 8], [0, fy + 19]], true), C.becco, 0);
  } else {
    pezzo(ctx, Forme.poligono([[-8, fy + 9], [8, fy + 9], [0, fy + 24]], true), C.becco, 0);
    tratto(ctx, [[-5, fy + 15], [5, fy + 15]], 1.4);
  }
  // papillon rosso
  const py = -168;
  pezzo(ctx, Forme.poligono([[0, py], [-15, py - 8], [-15, py + 8]], true), C.papillon, 2);
  pezzo(ctx, Forme.poligono([[0, py], [15, py - 8], [15, py + 8]], true), C.papillon, 2);
  pezzo(ctx, Forme.cerchio(0, py, 3.5), scurisci(C.papillon, 0.1), 0);
  // cilindro viola con il nastro rosso
  ctx.save();
  ctx.translate(2, -250);
  ctx.rotate(-0.05);
  const tuba = Forme.poligono([[-22, 0], [-24, -58], [24, -58], [22, 0]], false);
  pezzo(ctx, tuba, C.cilindro, 7);
  ctx.save();
  ctx.clip(percorso(tuba));
  tinta(ctx, Forme.rettangolo(-30, -14, 60, 13, 0), C.nastro);
  ctx.restore();
  linea(ctx, tuba, { spessore: INK });
  tratto(ctx, [[-23, -14], [23, -14]], INK * 0.8);
  pezzo(ctx, Forme.ellisse(0, -58, 24, 5.5), schiarisci(C.cilindro, 0.15), 0);
  pezzo(ctx, Forme.ellisse(0, 0, 40, 8), C.cilindro, 4);
  tinta(ctx, Forme.rettangolo(-21, -5, 42, 4, 0), C.cilindro);
  ctx.restore();
  // ala destra: appoggiata al petto, oppure alzata agli occhiali
  if (P.idle) ala(ctx, 54, -180, 2.25, 58);
  else ala(ctx, 58, -174, 0.95, 54);
}

/* ======================================================================== */
/*  ATLANTI                                                                 */
/* ======================================================================== */

/** Crea l'atlante di un personaggio con il formato atteso dal motore. */
function atlante(nomi, l, a, altezzaMondo, disegna) {
  const { tela, fotogrammi } = creaAtlante(nomi, { l, a }, (ctx, nome) => {
    ctx.translate(l / 2, a);        // origine tra i piedi
    disegna(ctx, leggiPosa(nome));
  });
  return { tela, fotogrammi, cella: { l, a }, altezzaMondo };
}

/**
 * Dipinge tutte le comparse. Restituisce
 * { fornaia, signora, signore, lepre, uccello, cavallo, nonna, tigre }.
 */
export async function creaComparse() {
  const elenco = [
    ['fornaia', POSE_CAMMINO, 192, 384, 1.6, disegnaFornaia],
    ['signora', POSE_CAMMINO, 192, 384, 1.65, disegnaSignora],
    ['signore', POSE_CAMMINO, 192, 384, 1.6, disegnaSignore],
    ['lepre', POSE_CAMMINO, 192, 448, 1.85, disegnaLepre],
    ['uccello', POSE_FERME, 224, 320, 1.3, disegnaUccello],
    ['cavallo', POSE_FERME, 192, 448, 1.85, disegnaCavallo],
    ['nonna', POSE_CAMMINO, 192, 320, 1.25, disegnaNonna],
    ['tigre', POSE_FERME, 224, 384, 1.6, disegnaTigre],
  ];
  const risultato = {};
  for (const [nome, pose, l, a, h, disegna] of elenco) {
    risultato[nome] = atlante(pose, l, a, h, disegna);
    await respira();   // lascia respirare la pagina tra un personaggio e l'altro
  }
  return risultato;
}
