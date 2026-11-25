/* ==========================================================================
 *  personaggi.js — I PERSONAGGI DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui si dipingono (solo con il codice!) tutti i personaggi:
 *
 *    - LIA       la bambina col cappellino a campana (tre "vestiti")
 *    - BISCOTTO  il suo cagnolino color crema dalle orecchie lunghe
 *    - GATTINO   il micetto del vicolo
 *    - LADRO     il signore con la giacca di pelle che ruba la borsetta
 *
 *  Stile: campiture piatte pastello ("cel"), contorno sottile a inchiostro
 *  seppia, un'ombra leggerissima su un lato. Ogni personaggio viene
 *  consegnato al motore come ATLANTE: tante celle uguali, una per
 *  fotogramma, con i piedi che toccano il bordo inferiore al centro.
 *
 *  Come si legge il codice: ogni personaggio si disegna in "coordinate
 *  locali" con l'origine (0, 0) a terra, al centro dei piedi; l'asse y
 *  cresce verso il basso, quindi tutto ciò che sta sopra il suolo ha y < 0.
 * ========================================================================== */

import {
  STILE, nuovaTela, casuale, tra, scurisci, percorso, Forme, tinta, linea, acquerello, foglia,
  velatura, pennellata, granula, fogliame, fiorellini, creaAtlante, respira,
} from './pennello.js';

/* ------------------------------------------------------------------------ */
/*  COLORI E PENNELLI DI BASE                                               */
/* ------------------------------------------------------------------------ */
const LW = 2.7;                    // spessore dell'inchiostro dei personaggi
const INK = STILE.inchiostro;

const C = {
  pelle: '#fde8d0', pelleOmbra: '#f1d6c2', capelli: '#f2b066',
  bianco: '#fdfcf7', azzurro: '#74c3c7', salmone: '#f2a391', salmoneScuro: '#d98572',
  viola: '#7b6a92', violaScuro: '#6a5a80', oro: '#ecc75a', legno: '#8d5c3b', stella: '#f8e88f',
  pupilla: '#3a2926', boccaDentro: '#9a4444', lingua: '#ef9290',
  cane: '#f5e4b3', caneScuro: '#e6d09c', orecchie: '#c4834f', macchia: '#c98d58',
  naso: '#3d2c2b', collare: '#8cc6e6', muso: '#fbf1d6',
  gatto: '#f6e9cf', gattoScuro: '#e8d8b8', rosa: '#f2aaa6',
  giacca: '#9c6b45', giaccaScura: '#86593a', berretto: '#8a5c3c', pantaloni: '#aaa3d8',
  pantaloniScuri: '#958dc6', scarpeLadro: '#4c3428', pelleLadro: '#f3d9bf', capelliLadro: '#7a5238',
};

/**
 * Ombra "cel": scurisce la striscia del pezzo che resta scoperta quando
 * la sua sagoma viene spostata di (dx, dy). Con dx negativo l'ombra cade
 * sul lato destro (la luce arriva da sinistra, in alto).
 */
function ombraCel(ctx, p, dx = -6, dy = -2) {
  const fuori = new Path2D();
  fuori.rect(-4000, -4000, 8000, 8000);
  fuori.addPath(p, new DOMMatrix([1, 0, 0, 1, dx, dy]));
  ctx.save();
  ctx.clip(p);
  ctx.fillStyle = STILE.ombra;
  ctx.fill(fuori, 'evenodd');        // pari/dispari = "fuori dalla sagoma spostata"
  ctx.restore();
}

/** Un pezzo del personaggio: tinta piatta + ombra cel + contorno a inchiostro. */
function pezzo(ctx, forma, colore, ombra = true) {
  const p = percorso(forma);
  tinta(ctx, p, colore);
  if (ombra) ombraCel(ctx, p);
  linea(ctx, p, { spessore: LW });
  return p;
}

/** Più forme fuse in una sola sagoma: il contorno resta solo all'esterno. */
function sagoma(ctx, forme, colore, ombra = true) {
  const pp = forme.map(percorso);
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineWidth = LW * 2; ctx.lineJoin = 'round';
  pp.forEach((p) => ctx.stroke(p));     // prima il bordo largo...
  ctx.restore();
  tinta(ctx, pp[0], colore);            // ...poi il colore lo copre all'interno
  if (ombra) ombraCel(ctx, pp[0]);
  pp.slice(1).forEach((p) => tinta(ctx, p, colore));
}

/** Linea spezzata (segmenti dritti) come Path2D. */
function spezzata(punti) {
  const p = new Path2D();
  punti.forEach(([x, y], k) => (k ? p.lineTo(x, y) : p.moveTo(x, y)));
  return p;
}

/** "Tubo" con il contorno: braccia, gambe, zampe, cinghie, code sottili. */
function tubo(ctx, punti, larg, colore, dritto = false) {
  const p = dritto ? spezzata(punti) : Forme.curva(punti);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = larg + LW * 2; ctx.stroke(p);
  ctx.strokeStyle = colore; ctx.lineWidth = larg; ctx.stroke(p);
  ctx.restore();
}

/** Tratto sottile di dettaglio (pieghe, ciuffi, bocche). */
function tratto(ctx, punti, chiaro = false, spessore = LW * 0.75) {
  linea(ctx, Forme.curva(punti), { spessore, colore: chiaro ? STILE.inchiostroChiaro : INK });
}

/**
 * Occhio come nel cartone: tondo bianco con un puntino scuro.
 * (gx, gy) = dove guarda (-1..1). stato: null, 'blink' (chiuso), 'felice' (ad arco).
 */
function occhio(ctx, x, y, r, gx, gy, stato) {
  if (stato === 'blink') return tratto(ctx, [[x - r * 0.8, y + 1], [x, y + r * 0.45], [x + r * 0.8, y + 1]], false, LW);
  if (stato === 'felice') return tratto(ctx, [[x - r * 0.8, y + 3], [x, y - r * 0.6], [x + r * 0.8, y + 3]], false, LW);
  pezzo(ctx, Forme.cerchio(x, y, r), C.bianco, false);
  tinta(ctx, Forme.cerchio(x + gx * r * 0.52, y + gy * r * 0.52, Math.max(1.8, r * 0.26)), C.pupilla);
}

/** Mano tonda; se aperta spuntano cinque ditini nella direzione "dir". */
function mano(ctx, x, y, r, dir, aperta, colore) {
  if (aperta) {
    for (let k = -2; k <= 2; k++) {
      const a = dir + k * 0.45;
      tubo(ctx, [[x, y], [x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55]], r * 0.5, colore);
    }
  }
  pezzo(ctx, Forme.cerchio(x, y, r), colore, false);
}

/** Stellina a cinque punte (rot = direzione della punta principale). */
function stellina(ctx, x, y, r, rot, colore) {
  const punti = [];
  for (let k = 0; k < 10; k++) {
    const a = rot + (k * Math.PI) / 5, rr = k % 2 ? r * 0.5 : r;
    punti.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  pezzo(ctx, Forme.poligono(punti), colore, false);
}

/** Scintilla a quattro punte (magia, colpetti). */
function scintilla(ctx, x, y, r) {
  const q = r * 0.25;
  const p = Forme.poligono([[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]]);
  tinta(ctx, p, '#fff4a8');
  linea(ctx, p, { spessore: 1.4, colore: '#cf9a45' });
}

/** Bastoncino di legno tenuto in mano; con "stella" diventa una bacchetta magica. */
function bastone(ctx, x, y, ang, lung, stella) {
  const cx = Math.cos(ang), cy = Math.sin(ang);
  tubo(ctx, [[x - cx * 9, y - cy * 9], [x + cx * lung, y + cy * lung]], 3.4, C.legno);
  if (stella) stellina(ctx, x + cx * (lung + 8), y + cy * (lung + 8), 12, ang, C.stella);
}

/** La borsetta tonda color salmone (con la patta e il bottoncino). */
function borsetta(ctx, x, y, r) {
  pezzo(ctx, Forme.ellisse(x, y, r * 1.1, r), C.salmone);
  tratto(ctx, [[x - r * 0.95, y - r * 0.35], [x, y + r * 0.25], [x + r * 0.95, y - r * 0.35]]);
  pezzo(ctx, Forme.cerchio(x, y + r * 0.15, r * 0.17), C.salmoneScuro, false);
}

/* ------------------------------------------------------------------------ */
/*  LIA                                                                      */
/* ------------------------------------------------------------------------ */
/*  Misure (coordinate locali, altezza totale ~272 px):
 *    scarpe 0..-23 · gambe fino a -86 · vestito -157..-76 · viso centro -184
 *    cappello a campana fino a -270 (quello da strega fino a ~-295)        */

const ABITI = {
  borsa: { vestito: C.azzurro, strega: false, borsa: true, oggetto: null },
  semplice: { vestito: C.azzurro, strega: false, borsa: false, oggetto: 'bastone' },
  strega: { vestito: C.viola, strega: true, borsa: false, oggetto: 'bacchetta' },
};

/**
 * Lo "scheletro" di Lia per una posa: posizione dei piedi, delle mani,
 * dondolio del corpo, sguardo, bocca... Tutto il disegno parte da qui.
 * Nella vista di lato l'indice 0 è il lato lontano, 1 quello vicino.
 */
function posaLia(vista, posa, f, abito) {
  const lato = vista === 'lato';
  const P = {
    bob: 0, incl: 0, anca: [0, -84], orlo: 0,
    piedi: lato ? [[-4, 0], [4, 0]] : [[-12, 0], [12, 0]],
    mani: lato ? [[-4, -106], [6, -106]] : [[-33, -106], [33, -106]],
    aperte: [false, false], sguardo: lato ? [0.85, -0.2] : [0.55, -0.45],
    occhi: null, bocca: 'chiusa', colpo: false,
    oggetto: abito.oggetto === 'bacchetta' ? 'bacchetta' : null,   // la streghetta non la lascia mai
    ang: lato ? -0.9 : vista === 'retro' ? -1.95 : -1.2,           // inclinazione della bacchetta
  };
  const io = vista === 'retro' ? 0 : 1;                            // mano che regge l'oggetto
  if (posa === 'fermo' && f === 1) { P.occhi = 'blink'; P.bob = 1; }
  if (posa === 'cammina') {
    const s = [-1, 0, 1, 0][f];                                    // -1 / +1 = passo, 0 = appoggio
    if (lato) {
      const passo = [[-17, 17], [6, -2], [17, -17], [-2, 6]][f];   // [piede lontano, piede vicino]
      P.piedi = [[passo[0], f === 1 ? -9 : 0], [passo[1], f === 3 ? -9 : 0]];
      P.mani = [[-2 - s * 13, -106 - Math.abs(s) * 4], [4 + s * 16, -106 - Math.abs(s) * 5]];
      P.orlo = s ? -3 : 2;
      P.bob = s ? 0 : -3;
    } else {
      P.piedi = [[-12, s < 0 ? -9 : 0], [12, s > 0 ? -9 : 0]];
      const av0 = s > 0, av1 = s < 0;                              // il braccio opposto va avanti
      P.mani = [[-33 + (av0 ? 6 : s ? -3 : 0), -106 + (av0 ? -9 : s ? 4 : 0)],
        [33 - (av1 ? 6 : s ? -3 : 0), -106 + (av1 ? -9 : s ? 4 : 0)]];
      P.orlo = s * 2.5;
      P.bob = s ? -3 : 0;
    }
  }
  if (posa === 'tocca') {
    P.oggetto = abito.oggetto; P.colpo = f === 1; P.bocca = 'o';
    if (vista === 'fronte') { P.mani[1] = f ? [42, -136] : [40, -170]; P.ang = f ? -0.6 : -1.25; P.sguardo = [0.8, f ? -0.1 : -0.75]; }
    else if (lato) { P.mani = [[4, -118], f ? [38, -130] : [30, -150]]; P.ang = f ? 0.45 : -0.9; P.sguardo = [0.9, f ? 0.25 : -0.5]; }
    else { P.mani[0] = f ? [-40, -146] : [-34, -182]; P.ang = f ? -2.45 : -1.95; }
    if (!P.oggetto) P.aperte[io] = true;                           // con la borsa: mano vuota alzata
  }
  if (posa === 'ascolta') {
    P.anca = [-10, -82]; P.incl = 0.15; P.piedi = [[-26, 0], [-14, 0]];
    P.mani = [[44, -178], [50, -161]]; P.aperte = [true, true];
    P.sguardo = [-0.3, -0.8]; P.bocca = 'o'; P.oggetto = null;
  }
  if (posa === 'sorpresa') {
    P.piedi = [[-16, 0], [16, 0]]; P.mani = [[-46, -188], [46, -188]];
    P.aperte = [true, !P.oggetto]; P.ang = -1.35; P.bocca = 'aperta'; P.sguardo = [0, -0.1]; P.bob = -2;
  }
  if (posa === 'saluta') {
    P.mani[1] = [46, -192]; P.aperte[1] = !P.oggetto; P.ang = -1.45; P.bocca = 'sorriso'; P.sguardo = [0.3, -0.35];
  }
  return P;
}

/**
 * Disegna Lia. abito: 'borsa' | 'semplice' | 'strega';
 * vista: 'fronte' | 'retro' | 'lato'; posa: 'fermo', 'cammina', 'tocca'...
 * manoGuinzaglio (facoltativa) sposta la mano vicina (per le illustrazioni).
 * Restituisce la posizione della mano vicina (utile per il guinzaglio).
 */
function disegnaLia(ctx, nomeAbito, vista, posa, fase, manoGuinzaglio) {
  const abito = ABITI[nomeAbito];
  const P = posaLia(vista, posa, fase, abito);
  if (manoGuinzaglio) P.mani[1] = manoGuinzaglio;
  const lato = vista === 'lato';
  // il busto si muove (dondola, si piega) attorno all'anca
  const T = new DOMMatrix().translate(P.anca[0], P.anca[1] + P.bob).rotate(P.incl * 57.3).translate(0, 84);
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
  const spalle = lato ? [[-2, -146], [3, -146]] : [[-24, -146], [24, -146]];
  const anche = lato ? [[-3, -88], [3, -88]] : [[-9, -88], [9, -88]];
  const io = vista === 'retro' ? 0 : 1;
  const alzata = (i) => P.mani[i][1] < -140;
  const braccio = (i) => braccioLia(ctx, abito, spalle[i], P.mani[i], P.aperte[i],
    i === io ? P.oggetto : null, P.ang, P.colpo, alzata(i), lato && i === 0);

  // 1) gambe e scarpe (prima quella lontana)
  P.piedi.forEach(([px, py], i) => {
    const lontano = lato && i === 0;
    tubo(ctx, [nelMondo(...anche[i]), [px, py - 18]], 8.5, lontano ? C.pelleOmbra : C.pelle);
    scarpaLia(ctx, abito, vista, px, py, lontano);
  });
  // 2) il busto, nel sistema di riferimento che dondola
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  if (lato) braccio(0);                                   // braccio lontano, dietro al vestito
  if (abito.strega) pezzo(ctx, mutandine(lato), C.bianco, false);
  vestitoLia(ctx, abito, vista, P.orlo);
  if (abito.borsa) borsaLia(ctx, vista);
  const davanti = lato ? [1] : [0, 1];
  davanti.filter((i) => !alzata(i)).forEach(braccio);     // braccia basse: sotto mantellina e testa
  collettoLia(ctx, abito, vista);
  testaLia(ctx, abito, vista, P);
  davanti.filter(alzata).forEach(braccio);                // braccia alzate: davanti a tutto
  ctx.restore();
  return nelMondo(...P.mani[1]);
}

/** Le mutandine bianche che spuntano sotto il vestito da strega. */
function mutandine(lato) {
  const pp = lato
    ? [[-20, -80], [18, -80], [16, -60], [6, -64], [-4, -59], [-14, -64], [-22, -60]]
    : [[-25, -80], [25, -80], [25, -60], [12, -64], [0, -59], [-12, -64], [-25, -60]];
  return Forme.poligono(pp, true);
}

/** Vestitino a trapezio (azzurro, o viola per la streghetta). */
function vestitoLia(ctx, abito, vista, orlo) {
  const L = abito.strega ? 49 : 46;
  const p = new Path2D();
  if (vista === 'lato') {
    p.moveTo(-5, -157); p.quadraticCurveTo(-17, -152, -18, -136);
    p.lineTo(-L + 5 + orlo, -73); p.quadraticCurveTo(-4, -63, L - 9 + orlo * 0.4, -72);
    p.lineTo(17, -136); p.quadraticCurveTo(15, -153, 5, -157);
  } else {
    p.moveTo(-14, -157); p.quadraticCurveTo(-25, -153, -26, -136);
    p.lineTo(-L + orlo, -73); p.quadraticCurveTo(orlo, -62, L + orlo, -73);
    p.lineTo(26, -136); p.quadraticCurveTo(25, -153, 14, -157);
  }
  p.closePath();
  pezzo(ctx, p, abito.vestito);
  // due pieghe leggere
  tratto(ctx, [[-6, -122], [-9, -100], [-14 + orlo, -72]], true);
  tratto(ctx, [[9, -120], [12, -98], [19 + orlo, -73]], true);
}

/** Colletto bianco "alla Peter Pan" oppure mantellina viola con bottone d'oro. */
function collettoLia(ctx, abito, vista) {
  if (!abito.strega) {
    if (vista === 'fronte') {
      pezzo(ctx, Forme.ellisse(-8, -154, 10, 5.5, 0.3), C.bianco, false);
      pezzo(ctx, Forme.ellisse(8, -154, 10, 5.5, -0.3), C.bianco, false);
    } else if (vista === 'lato') pezzo(ctx, Forme.ellisse(6, -154, 9, 5, -0.3), C.bianco, false);
    else pezzo(ctx, Forme.ellisse(0, -155, 15, 4.5), C.bianco, false);
    return;
  }
  const p = new Path2D();
  if (vista === 'lato') {
    p.moveTo(-6, -158); p.quadraticCurveTo(-27, -152, -28, -127);
    p.quadraticCurveTo(-4, -116, 22, -127); p.quadraticCurveTo(20, -152, 6, -158);
  } else {
    p.moveTo(-13, -158); p.quadraticCurveTo(-33, -154, -38, -128);
    p.quadraticCurveTo(-20, -116, 0, -124); p.quadraticCurveTo(20, -116, 38, -128);
    p.quadraticCurveTo(33, -154, 13, -158);
  }
  p.closePath();
  pezzo(ctx, p, C.violaScuro);
  if (vista === 'fronte') { tratto(ctx, [[0, -148], [0, -125]], true); pezzo(ctx, Forme.cerchio(0, -151, 3.8), C.oro, false); }
  if (vista === 'lato') pezzo(ctx, Forme.cerchio(15, -151, 3.2), C.oro, false);
}

/** Tracolla e borsetta tonda (solo nel prologo). */
function borsaLia(ctx, vista) {
  const dati = {
    fronte: [[[-17, -154], [8, -128], [27, -104]], 29, -95],
    lato: [[[-4, -156], [4, -128], [9, -106]], 10, -97],
    retro: [[[17, -154], [-8, -128], [-27, -104]], -31, -97],
  }[vista];
  tubo(ctx, dati[0], 2.6, C.salmoneScuro);
  borsetta(ctx, dati[1], dati[2], 12);
}

/** Un braccio di Lia (con manica, mano ed eventuale bastone/bacchetta). */
function braccioLia(ctx, abito, spalla, m, aperta, oggetto, ang, colpo, alzato, lontano) {
  const [sx, sy] = spalla, [mx, my] = m;
  const dir = Math.atan2(my - sy, mx - sx);
  const pelle = lontano ? C.pelleOmbra : C.pelle;
  tubo(ctx, [[sx, sy], [(sx + mx) / 2 - Math.sin(dir) * 2, (sy + my) / 2 + Math.cos(dir) * 2], [mx, my]], 8, pelle);
  const manica = abito.strega ? (alzato ? C.violaScuro : null) : abito.vestito;
  if (manica) pezzo(ctx, Forme.ellisse(sx + Math.cos(dir) * 5, sy + Math.sin(dir) * 5, 10.5, 9, dir), lontano ? scurisci(manica, 0.08) : manica);
  if (oggetto) {
    const bacchetta = oggetto === 'bacchetta', lung = bacchetta ? 36 : 56;
    bastone(ctx, mx, my, ang, lung, bacchetta);
    if (colpo) {
      const px = mx + Math.cos(ang) * (lung + 8), py = my + Math.sin(ang) * (lung + 8);
      if (bacchetta) { scintilla(ctx, px + 16, py - 10, 7); scintilla(ctx, px - 8, py - 18, 5); scintilla(ctx, px + 10, py + 14, 4.5); }
      else for (const a of [-0.9, 0, 0.9]) tratto(ctx, [[px + Math.cos(ang + a) * 5, py + Math.sin(ang + a) * 5], [px + Math.cos(ang + a) * 12, py + Math.sin(ang + a) * 12]]);
    }
  }
  mano(ctx, mx, my, 6.5, dir, aperta, pelle);
}

/** Scarpe bianche tonde (o stivaletti viola con il risvolto arricciato). */
function scarpaLia(ctx, abito, vista, x, y, lontano) {
  const base = abito.strega ? C.viola : C.bianco;
  const col = lontano ? scurisci(base, 0.08) : base;
  if (vista === 'lato') pezzo(ctx, Forme.ellisse(x + 5, y - 10, 16, 10), col);
  else pezzo(ctx, Forme.ellisse(x, y - 11.5, 14.5, 11.5), col);
  if (abito.strega) {
    const cx = vista === 'lato' ? x + 1 : x;
    pezzo(ctx, Forme.poligono([[cx - 10, y - 17], [cx - 15, y - 30], [cx - 5, y - 24], [cx, y - 32],
      [cx + 5, y - 24], [cx + 15, y - 30], [cx + 10, y - 17]]), col, false);
  } else if (vista !== 'retro') {
    tratto(ctx, vista === 'lato' ? [[x - 3, y - 19], [x + 3, y - 15], [x + 9, y - 18]] : [[x - 9, y - 17], [x, y - 14], [x + 9, y - 17]]);
  }
}

/** Testa: caschetto arancio, viso, occhioni e cappello. */
function testaLia(ctx, abito, vista, P) {
  if (vista === 'retro') {
    pezzo(ctx, Forme.rettangolo(-48, -212, 96, 56, 14), C.capelli);
    for (const x of [-30, -12, 8, 27]) tratto(ctx, [[x, -192], [x + 1, -160]], true);
  } else if (vista === 'fronte') {
    pezzo(ctx, Forme.rettangolo(-48, -210, 96, 54, 14), C.capelli);
    pezzo(ctx, Forme.ellisse(0, -182, 39, 29), C.pelle);
    for (const s of [-1, 1]) {                       // ciocche ai lati del viso
      pezzo(ctx, Forme.poligono([[s * 49, -206], [s * 33, -206], [s * 33, -176], [s * 35, -156], [s * 51, -156]]), C.capelli, s > 0);
      tratto(ctx, [[s * 41, -186], [s * 42, -159]], true);
    }
    occhio(ctx, -14, -186, 11, P.sguardo[0], P.sguardo[1], P.occhi);
    occhio(ctx, 14, -186, 11, P.sguardo[0], P.sguardo[1], P.occhi);
    tratto(ctx, [[-2.5, -174], [0, -171.5], [2.5, -174]]);
    boccaLia(ctx, 0, -165, P.bocca);
  } else {
    sagoma(ctx, [Forme.ellisse(4, -182, 35, 29), Forme.ellisse(37, -172, 6, 5.5)], C.pelle);
    const p = new Path2D();
    p.moveTo(-40, -207); p.lineTo(14, -207); p.quadraticCurveTo(17, -180, 6, -156);
    p.lineTo(-44, -156); p.quadraticCurveTo(-51, -184, -40, -207); p.closePath();
    pezzo(ctx, p, C.capelli);
    tratto(ctx, [[-10, -190], [-12, -160]], true); tratto(ctx, [[-27, -192], [-29, -160]], true);
    pezzo(ctx, Forme.poligono([[10, -210], [38, -210], [37, -200], [12, -199]]), C.capelli, false); // frangetta
    occhio(ctx, 24, -186, 10.5, P.sguardo[0], P.sguardo[1], P.occhi);
    boccaLia(ctx, 33, -164, P.bocca);
  }
  if (abito.strega) cappelloStrega(ctx, vista); else cloche(ctx, vista);
}

function boccaLia(ctx, x, y, tipo) {
  if (tipo === 'chiusa') tratto(ctx, [[x - 4, y], [x, y + 1.5], [x + 4, y]]);
  else if (tipo === 'sorriso') tratto(ctx, [[x - 7, y - 3], [x, y + 4], [x + 7, y - 3]], false, LW * 0.9);
  else if (tipo === 'o') pezzo(ctx, Forme.ellisse(x, y, 3.5, 4.2), '#d77a6c', false);
  else {
    pezzo(ctx, Forme.ellisse(x, y + 1, 7.5, 8.5), C.boccaDentro, false);
    tinta(ctx, Forme.ellisse(x, y + 6, 4.8, 2.8), C.lingua);
  }
}

/** Cappellino bianco a campana con la fascia salmone. */
function cloche(ctx, vista) {
  const dx = vista === 'lato' ? 3 : 0, avanti = vista === 'lato' ? 6 : 0;
  const tesa = new Path2D();
  tesa.moveTo(dx - 42, -232); tesa.lineTo(dx - 57 + avanti * 0.5, -209);
  tesa.quadraticCurveTo(dx + avanti, -197, dx + 57 + avanti, -209); tesa.lineTo(dx + 42, -232); tesa.closePath();
  pezzo(ctx, tesa, C.bianco);
  const cupola = new Path2D();
  cupola.moveTo(dx - 45, -223); cupola.bezierCurveTo(dx - 51, -285, dx + 51, -285, dx + 45, -223);
  cupola.quadraticCurveTo(dx, -216, dx - 45, -223); cupola.closePath();
  tinta(ctx, cupola, C.bianco);
  ctx.save();
  ctx.clip(cupola);
  const fascia = new Path2D();
  fascia.moveTo(dx - 60, -251); fascia.quadraticCurveTo(dx, -243, dx + 60, -251);
  fascia.lineTo(dx + 60, -232); fascia.quadraticCurveTo(dx, -223, dx - 60, -232); fascia.closePath();
  tinta(ctx, fascia, C.salmone);
  linea(ctx, fascia, { spessore: LW * 0.8 });
  ctx.restore();
  ombraCel(ctx, cupola, -8, -3);
  linea(ctx, cupola, { spessore: LW });
}

/** Cappello da strega a tesa larga con la punta piegata. */
function cappelloStrega(ctx, vista) {
  const v = vista === 'fronte' ? 1 : -1;            // verso cui si piega la punta
  const dx = vista === 'lato' ? 3 : 0;
  const X = (x) => dx + v * x;
  pezzo(ctx, Forme.ellisse(dx + (vista === 'lato' ? 4 : 0), -210, 68, vista === 'lato' ? 9 : 12), C.viola);
  const p = new Path2D();
  p.moveTo(X(-38), -212);
  p.quadraticCurveTo(X(-28), -259, X(-6), -287);
  p.quadraticCurveTo(X(8), -304, X(35), -299);
  p.quadraticCurveTo(X(14), -292, X(10), -278);
  p.quadraticCurveTo(X(26), -247, X(38), -212);
  p.quadraticCurveTo(X(0), -205, X(-38), -212);
  p.closePath();
  pezzo(ctx, p, C.viola);
  tratto(ctx, [[X(-22), -238], [X(-8), -244], [X(8), -237]], true);
}

/* ------------------------------------------------------------------------ */
/*  PEZZI DA QUATTROZAMPE (cane e gatto)                                    */
/* ------------------------------------------------------------------------ */

/** Zampa: tubo dall'anca alla caviglia, poi il piedino tondo con le dita. */
function zampa(ctx, anca, piede, larg, colore, posteriore, rp = 9) {
  const [ax, ay] = anca, [px, py] = piede;
  const cav = [px + 1, py - rp * 0.6];
  const mezzo = [(ax + cav[0]) / 2 + (posteriore ? -rp * 0.7 : rp * 0.3), (ay + cav[1]) / 2];
  tubo(ctx, [[ax, ay], mezzo, cav], larg, colore);
  pezzo(ctx, Forme.ellisse(px + rp * 0.4, py - rp * 0.6, rp, rp * 0.6), colore, false);
  for (const d of [0.55, 0.95]) tratto(ctx, [[px + rp * d, py - rp * 0.55], [px + rp * d, py - 1]], false, LW * 0.6);
}

/** Calcola dove stanno i piedi in una camminata a 4 tempi (coppie diagonali). */
function passiQuattroZampe(piedi, f, ampiezza, alzata, sfasa = 0) {
  const t = (f + sfasa) * Math.PI / 2;
  const fasi = { pl: 0, av: 0, pv: Math.PI, al: Math.PI };
  const nuovi = {};
  for (const k in fasi) {
    const a = t + fasi[k];
    nuovi[k] = [piedi[k][0] + ampiezza * Math.cos(a), -alzata * Math.max(0, -Math.sin(a))];
  }
  return nuovi;
}

/**
 * Coda piumata (Biscotto): una "piuma" lungo una linea curva, con i
 * ciuffi del pelo sul lato esterno. ang = direzione iniziale, curva = quanto gira.
 */
function codaPiumosa(ctx, x, y, ang, lung, curva, colore) {
  const N = 12, sopra = [], sotto = [];
  let px = x, py = y, a = ang;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const w = 2.5 + 10 * Math.pow(Math.sin(Math.PI * Math.min(t * 1.05, 1)), 0.7);
    const nx = -Math.sin(a), ny = Math.cos(a), ciuffo = i % 2 ? 1.7 : 1;
    sopra.push([px + nx * w * 0.6, py + ny * w * 0.6]);
    sotto.push([px - nx * w * ciuffo, py - ny * w * ciuffo]);
    px += (Math.cos(a) * lung) / N; py += (Math.sin(a) * lung) / N; a += curva / N;
  }
  pezzo(ctx, Forme.poligono(sopra.concat(sotto.slice().reverse()), true), colore);
  for (let i = 3; i < N - 1; i += 2) {
    const [x1, y1] = sotto[i], [x0, y0] = sopra[i];
    tratto(ctx, [[x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45], [x1 + (x0 - x1) * 0.12, y1 + (y0 - y1) * 0.12]], true, 1.5);
  }
}

/** Orecchio lungo e morbido di Biscotto (attaccato in alto, pende verso il basso). */
function orecchioCane(ctx, x, y, ang, verso = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const pp = [[-6, -4], [8, -6], [13, 10], [12, 30], [5, 45], [-5, 46], [-11, 34], [-12, 12]];
  pezzo(ctx, Forme.poligono(pp.map(([a, b]) => [a * verso, b]), true), C.orecchie);
  ctx.restore();
}

/* ------------------------------------------------------------------------ */
/*  BISCOTTO, IL CAGNOLINO                                                   */
/* ------------------------------------------------------------------------ */
// anche delle quattro zampe nel sistema del corpo (p = posteriore, a = anteriore,
// l = lontana, v = vicina)
const ANCHE_CANE = { pl: [-38, 8], al: [30, 8], pv: [-30, 10], av: [38, 10] };
const PIEDI_CANE = { pl: [-52, 0], al: [20, 0], pv: [-42, 0], av: [32, 0] };

function posaCaneLato(posa, f) {
  const P = {
    corpo: [-10, -53], rot: 0, lungo: 1, rotTesta: 0, coda: -2.45, curva: 1.5, orecchio: 0.12,
    bocca: 0, ringhia: false, borsa: false, sguardo: [0.55, -0.45], occhi: null, lungCoda: 74,
    piedi: { ...PIEDI_CANE },
  };
  if (posa === 'fermo') { P.coda = f ? -2.2 : -2.55; P.curva = f ? 1.8 : 1.5; }
  if (posa === 'cammina') {
    P.piedi = passiQuattroZampe(PIEDI_CANE, f, 12, 7);
    P.corpo[1] += f % 2 ? -2 : 0; P.coda = f % 2 ? -2.3 : -2.6; P.orecchio = 0.12 + (f % 2) * 0.12;
  }
  if (posa === 'borsa') {                     // trotterella con la borsetta in bocca
    P.piedi = passiQuattroZampe(PIEDI_CANE, f * 2, 12, 8, 0.5);
    P.corpo[1] -= f ? 3 : 0; P.coda = f ? -2.25 : -2.6; P.orecchio = f ? 0.3 : 0.15; P.borsa = true;
    P.sguardo = [0.3, -0.8]; P.rotTesta = -0.08;
  }
  if (posa === 'corre') {                     // galoppo: zampe distese / raccolte
    const K = [
      { c: [-12, -53], rot: 0.03, lungo: 1.08, pl: [-92, -12], pv: [-80, -5], al: [52, -8], av: [66, 0], or: 1.1 },
      { c: [-12, -63], rot: -0.03, lungo: 0.94, pl: [-14, -4], pv: [-4, 0], al: [8, -16], av: [20, -12], or: 1.45 },
      { c: [-12, -56], rot: -0.1, lungo: 1.0, pl: [-42, 0], pv: [-30, 0], al: [40, -20], av: [54, -26], or: 1.2 },
      { c: [-12, -51], rot: 0.08, lungo: 1.04, pl: [-76, -8], pv: [-64, -2], al: [20, 0], av: [34, 0], or: 1.35 },
    ][f];
    Object.assign(P, { corpo: K.c, rot: K.rot, lungo: K.lungo, orecchio: K.or, coda: -2.6, curva: 0.5 + (f % 2) * 0.3, bocca: 0.3, lungCoda: 62 });
    P.piedi = { pl: K.pl, pv: K.pv, al: K.al, av: K.av };
    P.sguardo = [0.8, -0.1];
  }
  if (posa === 'abbaia') {
    Object.assign(P, { corpo: [-12, -55], rotTesta: f ? -0.3 : -0.2, bocca: f ? 1 : 0.6, coda: f ? -2.1 : -2.45, orecchio: f ? 0.45 : 0.3, sguardo: [0.75, -0.15] });
    P.piedi = { pl: [-56, 0], pv: [-46, 0], al: [26, 0], av: [40, 0] };
  }
  if (posa === 'ringhia') {
    Object.assign(P, { corpo: [-16, -47], rot: 0.12, rotTesta: 0.12, bocca: 0.22, ringhia: true, orecchio: 0.75, coda: -2.6, curva: 0.2, lungCoda: 58, sguardo: [0.9, 0.2] });
    P.piedi = { pl: [-66, 0], pv: [-54, 0], al: [24, 0], av: [38, 0] };
  }
  return P;
}

/** Biscotto di lato (guarda a destra). */
function caneLato(ctx, P) {
  const T = new DOMMatrix().translate(P.corpo[0], P.corpo[1]).rotate(P.rot * 57.3);
  const L = P.lungo;
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x * L, y)); return [q.x, q.y]; };
  // coda dietro al corpo
  const [cx, cy] = nelMondo(-44, -10);
  codaPiumosa(ctx, cx, cy, P.coda + P.rot, P.lungCoda, P.curva, C.cane);
  // zampe (prima le lontane, un po' più scure)
  for (const k of ['pl', 'al', 'pv', 'av']) {
    zampa(ctx, nelMondo(...ANCHE_CANE[k]), P.piedi[k], k[0] === 'p' ? 12 : 11, k[1] === 'l' ? C.caneScuro : C.cane, k[0] === 'p');
  }
  // corpo + petto + collo in un'unica sagoma
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const corpo = Forme.ellisse(0, 0, 50 * L, 23);
  sagoma(ctx, [corpo, Forme.ellisse(36 * L, -4, 21, 21), Forme.ellisse(50 * L, -24, 13, 21, 0.6)], C.cane);
  ctx.save(); ctx.clip(corpo);                       // macchia marrone sul dorso
  pezzo(ctx, Forme.ellisse(-6 * L, -20, 21, 10, -0.05), C.macchia, false);
  ctx.restore();
  tratto(ctx, [[-20 * L, 16], [-30 * L, -6], [-44 * L, -2]], true);   // coscia
  for (const k of [0, 1, 2]) tratto(ctx, [[28 * L + k * 7, 13 + k * 2], [31 * L + k * 7, 19 + k * 2]], true, 1.4); // pelo del petto
  tubo(ctx, [[37 * L, -27], [46 * L, -18], [56 * L, -12]], 5.5, C.collare);  // collare
  ctx.restore();
  // testa
  const [tx, ty] = nelMondo(64, -44);
  ctx.save();
  ctx.translate(tx, ty); ctx.rotate(P.rot + P.rotTesta);
  testaCaneLato(ctx, P);
  ctx.restore();
}

/** Testa di profilo: cranio tondo, muso lungo, nasone, occhio grande, orecchio. */
function testaCaneLato(ctx, P) {
  const apri = P.bocca, cer = [8, 13];              // cerniera della mandibola
  const ruota = (x, y) => {
    const a = apri * 0.5, dx = x - cer[0], dy = y - cer[1];
    return [cer[0] + dx * Math.cos(a) - dy * Math.sin(a), cer[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  };
  if (apri > 0) {                                   // bocca aperta: interno, lingua, mandibola
    pezzo(ctx, Forme.poligono([[6, 9], [52, 11], ruota(48, 21), ruota(12, 22)]), C.boccaDentro, false);
    ctx.save();
    ctx.translate(...cer); ctx.rotate(apri * 0.5); ctx.translate(-cer[0], -cer[1]);
    if (!P.ringhia) tinta(ctx, Forme.ellisse(34, 16, 10, 4), C.lingua);
    pezzo(ctx, Forme.ellisse(28, 21, 21, 6), C.cane, false);
    ctx.restore();
  }
  sagoma(ctx, [Forme.ellisse(0, 0, 24, 23), Forme.ellisse(29, 7, 27, 12.5, -0.06)], C.cane);
  pezzo(ctx, Forme.ellisse(55, 2, 7.5, 6.5), C.naso, false);
  tinta(ctx, Forme.ellisse(53, -0.5, 2.6, 1.6), '#ffffff', 0.7);
  if (!apri) tratto(ctx, [[18, 15], [32, 17.5], [46, 15]]);
  if (P.ringhia) {                                  // denti digrignati e muso arricciato
    pezzo(ctx, Forme.poligono([[18, 15], [49, 14], [48, 21], [19, 23]]), C.bianco, false);
    const zz = [];
    for (let k = 0; k <= 8; k++) zz.push([19 + k * 3.7, k % 2 ? 22 : 15]);
    linea(ctx, spezzata(zz), { spessore: 1.4 });
    tratto(ctx, [[22, -3], [26, -7], [30, -3]]); tratto(ctx, [[31, -2], [35, -6], [39, -2]]);
  }
  for (const k of [0, 1, 2]) tratto(ctx, [[-13 + k * 6, -21], [-16 + k * 6, -28]]);   // ciuffetto
  orecchioCane(ctx, -8, -15, P.orecchio);
  occhio(ctx, 7, -13, 11.5, P.sguardo[0], P.sguardo[1], P.occhi);
  if (P.ringhia) {                                  // sopracciglio arrabbiato
    ctx.save(); ctx.clip(Forme.cerchio(7, -13, 11.5));
    tinta(ctx, Forme.poligono([[-8, -30], [22, -18], [22, -40], [-8, -40]]), C.cane);
    ctx.restore();
    tratto(ctx, [[-6, -28], [7, -24], [21, -17]], false, LW * 1.2);
  }
  if (P.borsa) {                                    // la borsetta tenuta in bocca
    tubo(ctx, [[32, 20], [12, 66], [46, 60], [46, 22]], 2.6, C.salmoneScuro);
    borsetta(ctx, 40, 30, 14);
  }
}

/** Biscotto di fronte (in piedi o seduto). */
function caneFronte(ctx, posa, f, extra) {
  const seduto = posa === 'seduto';
  const E = Object.assign({
    coda: f ? -0.55 : 0.55, bocca: posa === 'abbaia', borsa: posa === 'borsa',
    sguardo: [0.45, -0.5], occhi: null, rotTesta: 0, testa: [0, seduto ? -114 : -104],
  }, extra);
  const lc = E.codaLato || 1;                       // da che parte sta la coda quando è seduto
  if (seduto) codaPiumosa(ctx, 26 * lc, -10, lc > 0 ? -0.3 : Math.PI + 0.3, 54, (-1.2 + E.coda) * lc, C.cane);
  else codaPiumosa(ctx, E.coda * 10, -60, -Math.PI / 2 + E.coda, 56, E.coda * 1.2, C.cane);
  for (const s of [-1, 1]) {                        // zampe posteriori ai lati
    pezzo(ctx, Forme.ellisse(s * 27, seduto ? -24 : -30, seduto ? 17 : 13, seduto ? 22 : 18), C.caneScuro);
    pezzo(ctx, Forme.ellisse(s * (seduto ? 34 : 29), -5.5, 10, 5.5), C.caneScuro, false);
  }
  pezzo(ctx, Forme.ellisse(0, seduto ? -56 : -50, 26, seduto ? 32 : 28), C.cane);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 8, seduto ? -36 : -32], [k * 9, seduto ? -30 : -26]], true, 1.4);
  for (const s of [-1, 1]) zampa(ctx, [s * 12, seduto ? -50 : -44], [s * 13 - 4, 0], 11, C.cane, false);
  tubo(ctx, [[-19, seduto ? -86 : -79], [0, seduto ? -78 : -71], [19, seduto ? -86 : -79]], 6, C.collare);
  ctx.save();
  ctx.translate(...E.testa); ctx.rotate(E.rotTesta);
  testaCaneFronte(ctx, E);
  ctx.restore();
}

function testaCaneFronte(ctx, E) {
  pezzo(ctx, Forme.ellisse(0, 0, 27, 25), C.cane);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 6, -23], [k * 7.5, -30]]);
  pezzo(ctx, Forme.ellisse(0, 14, 17, 12.5), C.muso, false);
  if (E.bocca) {
    pezzo(ctx, Forme.ellisse(0, 21, 9, 8), C.boccaDentro, false);
    tinta(ctx, Forme.ellisse(0, 25.5, 5.5, 3.2), C.lingua);
  } else tratto(ctx, [[-6, 17], [0, 20.5], [6, 17]]);
  pezzo(ctx, Forme.ellisse(0, 7, 8, 5.5), C.naso, false);
  for (const s of [-1, 1]) orecchioCane(ctx, s * 21, -14, s * -0.12, s);
  occhio(ctx, -12, -9, 10, E.sguardo[0], E.sguardo[1], E.occhi);
  occhio(ctx, 12, -9, 10, E.sguardo[0], E.sguardo[1], E.occhi);
  if (E.borsa) { tubo(ctx, [[-8, 22], [-16, 60], [16, 62], [8, 22]], 2.6, C.salmoneScuro); borsetta(ctx, 0, 34, 14); }
}

/** Biscotto visto da dietro (fermo o mentre corre via). */
function caneRetro(ctx, posa, f) {
  const corre = posa === 'corre', bob = corre && f ? -6 : 0;
  ctx.save(); ctx.translate(0, -106 + bob);          // testa dietro al corpo
  pezzo(ctx, Forme.ellisse(0, 0, 26, 24), C.cane);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 6, -22], [k * 7.5, -29]]);
  for (const s of [-1, 1]) orecchioCane(ctx, s * 19, -12, s * (corre ? (f ? -0.9 : -0.45) : -0.1), s);
  ctx.restore();
  tubo(ctx, [[-17, -86 + bob], [0, -82 + bob], [17, -86 + bob]], 6, C.collare);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 10, -5.5, 8, 5.5), C.caneScuro, false); // zampe davanti
  const corpo = Forme.ellisse(0, -56 + bob, 30, 27);
  pezzo(ctx, corpo, C.cane);
  ctx.save(); ctx.clip(corpo); pezzo(ctx, Forme.ellisse(-3, -76 + bob, 16, 9), C.macchia, false); ctx.restore();
  for (const s of [-1, 1]) {                         // cosce e piedi posteriori
    const alza = corre && (f === 0) === (s < 0) ? 1 : 0;
    pezzo(ctx, Forme.ellisse(s * 17, -36 + bob - alza * 5, 16, 21), C.cane);
    pezzo(ctx, Forme.ellisse(s * 18, -6 - alza * 12, 9.5, 6), C.cane, false);
    if (alza) tinta(ctx, Forme.ellisse(s * 18, -6 - alza * 12, 5, 3), C.rosa);
  }
  const ang = -Math.PI / 2 + (corre ? (f ? 0.5 : -0.5) : f ? 0.6 : -0.6);
  codaPiumosa(ctx, 0, -64 + bob, ang, 60, (ang + Math.PI / 2) * 1.2, C.cane);
}

function disegnaCane(ctx, vista, posa, f) {
  if (vista === 'lato') caneLato(ctx, posaCaneLato(posa, f));
  else if (vista === 'fronte') caneFronte(ctx, posa, f);
  else caneRetro(ctx, posa, f);
}

/* ------------------------------------------------------------------------ */
/*  IL GATTINO                                                              */
/* ------------------------------------------------------------------------ */
const ANCHE_GATTO = { pl: [-19, 5], al: [11, 5], pv: [-13, 6], av: [17, 6] };
const PIEDI_GATTO = { pl: [-24, 0], al: [8, 0], pv: [-18, 0], av: [15, 0] };

/** Testa del micio: tonda, orecchie a punta, occhioni, sorriso a "ω". */
function testaGatto(ctx, gx, gy, occhi, bocca, fronte) {
  const orecchie = fronte
    ? [[[-20, -6], [-16, -28], [-4, -16]], [[4, -16], [16, -28], [20, -6]]]
    : [[[-17, -7], [-13, -28], [-1, -15]], [[5, -15], [16, -27], [18, -5]]];
  sagoma(ctx, [Forme.ellisse(0, 0, fronte ? 22 : 20, 18), ...orecchie.map((o) => Forme.poligono(o))], C.gatto);
  for (const o of orecchie) {
    const m = o.reduce((a, b) => [a[0] + b[0] / 3, a[1] + b[1] / 3], [0, 0]);
    tinta(ctx, Forme.poligono(o.map(([x, y]) => [m[0] + (x - m[0]) * 0.5, m[1] + (y - m[1]) * 0.5 + 1])), C.rosa);
  }
  const ox = fronte ? [-9, 9] : [-4, 11], nx = fronte ? 0 : 15;
  occhio(ctx, ox[0], -1, 7.5, gx, gy, occhi);
  occhio(ctx, ox[1], -1, fronte ? 7.5 : 7, gx, gy, occhi);
  tinta(ctx, Forme.poligono([[nx - 2.5, 6], [nx + 2.5, 6], [nx, 8.5]]), C.rosa);
  if (bocca) pezzo(ctx, Forme.ellisse(nx, 12, 3.6, 4.2), C.boccaDentro, false);
  else { tratto(ctx, [[nx - 5, 10], [nx - 2.5, 13], [nx, 9.5]], false, 1.6); tratto(ctx, [[nx, 9.5], [nx + 2.5, 13], [nx + 5, 10]], false, 1.6); }
  for (const s of fronte ? [-1, 1] : [1]) {           // baffi
    tratto(ctx, [[nx + s * 9, 6], [nx + s * 22, 3]], false, 1.2);
    tratto(ctx, [[nx + s * 9, 9], [nx + s * 22, 10]], false, 1.2);
  }
}

function gattoLato(ctx, posa, f) {
  let corpo = [-6, -30], rot = 0, lungo = 1, occhi = null, piedi = { ...PIEDI_GATTO };
  let codaPunte = [[-46, -38], [-50, -66]];
  if (posa === 'fermo') { occhi = f ? 'blink' : null; codaPunte = [[-48, -38], [-48 + f * 5, -66]]; }
  if (posa === 'cammina') {
    piedi = passiQuattroZampe(PIEDI_GATTO, f, 7, 5);
    corpo = [-6, f % 2 ? -31.5 : -30]; codaPunte = [[-46, -40], [-52 + (f % 2) * 4, -64]];
  }
  if (posa === 'corre') {
    const K = [
      { c: [-4, -30], rot: 0.04, lungo: 1.12, pl: [-50, -6], pv: [-42, -2], al: [26, -4], av: [34, 0] },
      { c: [-4, -36], rot: -0.04, lungo: 0.92, pl: [-8, -2], pv: [-2, 0], al: [4, -9], av: [10, -6] },
      { c: [-4, -32], rot: -0.1, lungo: 1, pl: [-22, 0], pv: [-15, 0], al: [22, -11], av: [30, -14] },
      { c: [-4, -29], rot: 0.08, lungo: 1.05, pl: [-40, -4], pv: [-34, -1], al: [10, 0], av: [17, 0] },
    ][f];
    corpo = K.c; rot = K.rot; lungo = K.lungo; piedi = { pl: K.pl, pv: K.pv, al: K.al, av: K.av };
    codaPunte = [[-54, -36], [-70, -48 + (f % 2) * 6]];
  }
  const T = new DOMMatrix().translate(corpo[0], corpo[1]).rotate(rot * 57.3);
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x * lungo, y)); return [q.x, q.y]; };
  const base = nelMondo(-22, -4);
  tubo(ctx, [base, ...codaPunte.map(([x, y]) => [x + corpo[0] + 6, y + corpo[1] + 30])], 5, C.gatto);
  for (const k of ['pl', 'al', 'pv', 'av']) {
    zampa(ctx, nelMondo(...ANCHE_GATTO[k]), piedi[k], 6.5, k[1] === 'l' ? C.gattoScuro : C.gatto, k[0] === 'p', 5.5);
  }
  ctx.save();
  ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  sagoma(ctx, [Forme.ellisse(0, 0, 24 * lungo, 13), Forme.ellisse(18 * lungo, -6, 11, 11)], C.gatto);
  tratto(ctx, [[-10 * lungo, 10], [-16 * lungo, -2], [-24 * lungo, 0]], true, 1.5);
  ctx.restore();
  const [tx, ty] = nelMondo(33, -21);
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(rot * 0.6);
  testaGatto(ctx, 0.55, -0.1, occhi, false, false);
  ctx.restore();
}

function gattoFronte(ctx, posa, f) {
  const miagola = posa === 'miagola';
  tubo(ctx, [[10, -8], [36, -4], [34 - f * 4, -26 - f * 3]], 5, C.gatto);           // coda arricciata
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 12, -12, 11, 12), C.gattoScuro);
  pezzo(ctx, Forme.ellisse(0, -30, 18, 24), C.gatto);
  for (const k of [-1, 0, 1]) tratto(ctx, [[k * 5, -42], [k * 6, -37]], true, 1.3);
  for (const s of [-1, 1]) zampa(ctx, [s * 6, -30], [s * 7 - 2, 0], 6.5, C.gatto, false, 5.5);
  ctx.save(); ctx.translate(0, -64); ctx.rotate(miagola ? -0.08 : f ? 0.06 : 0);
  testaGatto(ctx, 0.2, -0.3, miagola ? 'felice' : f ? 'blink' : null, miagola, true);
  ctx.restore();
}

function disegnaGatto(ctx, vista, posa, f) {
  if (vista === 'lato') gattoLato(ctx, posa, f);
  else gattoFronte(ctx, posa, f);
}

/* ------------------------------------------------------------------------ */
/*  IL LADRO                                                                */
/* ------------------------------------------------------------------------ */
/*  Adulto alto ~355 px: scarpe scure, pantaloni lilla, giubbotto di pelle
 *  marrone con elastico in vita, berretto piatto calato sugli occhi.      */

/** Ginocchio: dove si piega una gamba lunga "lung" tra anca e caviglia. */
function ginocchio(anca, cav, lung, verso) {
  const dx = cav[0] - anca[0], dy = cav[1] - anca[1], d = Math.hypot(dx, dy) || 1;
  const h = Math.sqrt(Math.max(0, lung * lung - (d / 2) * (d / 2)));
  let nx = -dy / d, ny = dx / d;
  if (nx * verso < 0) { nx = -nx; ny = -ny; }
  return [(anca[0] + cav[0]) / 2 + nx * h, (anca[1] + cav[1]) / 2 + ny * h];
}

function posaLadroLato(posa, f) {
  const P = { x: 0, bob: 0, incl: 0.06, piedi: [[-10, 0], [10, 0]], braccia: 'tasche', faccia: 'furbo' };
  if (posa === 'cammina') {
    const passo = [[-28, 28], [8, -4], [28, -28], [-4, 8]][f];
    P.piedi = [[passo[0], f === 1 ? -14 : 0], [passo[1], f === 3 ? -14 : 0]];
    P.bob = f % 2 ? -4 : 0;
  }
  if (posa === 'corre' || posa === 'fuga') {
    const passo = [[-50, 40], [16, -6], [40, -50], [-6, 16]][f];
    const alto = [[-16, 0], [-36, 0], [0, -16], [0, -36]][f];
    P.piedi = [[passo[0], alto[0]], [passo[1], alto[1]]];
    Object.assign(P, { x: -6, bob: f % 2 ? -8 : 0, incl: 0.2, braccia: posa === 'corre' ? 'borsa' : 'panico', faccia: posa === 'corre' ? 'ghigno' : 'paura', fase: f });
  }
  if (posa === 'scippo') Object.assign(P, { x: -24, piedi: [[-52, 0], [44, 0]], incl: 0.22, bob: 10, braccia: 'afferra', faccia: 'avido' });
  return P;
}

/** Il ladro di lato (guarda a destra). */
function ladroLato(ctx, P) {
  const T = new DOMMatrix().translate(P.x, -172 + P.bob).rotate(P.incl * 57.3).translate(0, 172);
  const nelMondo = (x, y) => { const q = T.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
  const lontano = { tasche: null, borsa: [[-36, -258], [-32, -226]], afferra: [[-34, -260], [-54, -246]], panico: [[-30, -318], [-46, -348]] }[P.braccia];
  const vicino = { tasche: [[-8, -236], [14, -200]], borsa: [[-4, -242], [22, -252]], afferra: [[32, -278], [60, -272]], panico: [[34, -262], [62, -290]] }[P.braccia];
  ctx.save(); ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  if (lontano) braccioLadro(ctx, [-6, -284], lontano, P.braccia === 'panico', C.giaccaScura);
  ctx.restore();
  P.piedi.forEach(([px, py], i) => {                // gambe: anca → ginocchio → caviglia
    const anca = nelMondo(i ? 6 : -6, -178), cav = [px, py - 13];
    tubo(ctx, [anca, ginocchio(anca, cav, 86, 1), cav], 24, i ? C.pantaloni : C.pantaloniScuri, true);
    pezzo(ctx, Forme.ellisse(px + 9, py - 7.5, 19, 7.5), i ? C.scarpeLadro : scurisci(C.scarpeLadro, 0.15), false);
  });
  ctx.save(); ctx.transform(T.a, T.b, T.c, T.d, T.e, T.f);
  const g = new Path2D();
  g.moveTo(-8, -300); g.quadraticCurveTo(-31, -298, -35, -268); g.lineTo(-37, -190);
  g.quadraticCurveTo(-37, -168, -20, -166); g.lineTo(22, -166); g.quadraticCurveTo(35, -168, 33, -190);
  g.lineTo(35, -262); g.quadraticCurveTo(31, -296, 10, -300); g.closePath();
  giacca(ctx, g);
  tinta(ctx, Forme.poligono([[4, -302], [16, -300], [10, -288]]), C.bianco);     // colletto della camicia
  tubo(ctx, [[4, -296], [6, -306]], 11, C.pelleLadro);
  testaLadroLato(ctx, P.faccia);
  if (P.braccia === 'borsa') {                     // stringe la borsetta al petto
    const sv = [0, 8, 0, -8][P.fase];
    tubo(ctx, [[20, -240], [-16, -226 + sv], [-50, -238 - sv]], 2.6, C.salmoneScuro);
    borsetta(ctx, 30, -246, 15);
  }
  braccioLadro(ctx, [2, -284], vicino, P.braccia === 'afferra' || P.braccia === 'panico', C.giacca, P.braccia !== 'tasche');
  if (P.braccia === 'tasche') tratto(ctx, [[6, -212], [20, -194]]);
  ctx.restore();
}

/** Giubbotto: pelle marrone, ombra, elastico in vita. */
function giacca(ctx, forma) {
  const p = pezzo(ctx, forma, C.giacca);
  ctx.save(); ctx.clip(p);
  pezzo(ctx, Forme.rettangolo(-60, -182, 120, 18, 2), C.giaccaScura, false);
  ctx.restore();
  linea(ctx, p, { spessore: LW });
}

/** Braccio del ladro: spalla → gomito → mano (pugno o mano aperta). */
function braccioLadro(ctx, spalla, [gomito, m], aperta, colore, conMano = true) {
  tubo(ctx, [spalla, gomito, m], 21, colore, true);
  const dir = Math.atan2(m[1] - gomito[1], m[0] - gomito[0]);
  if (conMano) mano(ctx, m[0] + Math.cos(dir) * 10, m[1] + Math.sin(dir) * 10, 8, dir, aperta, C.pelleLadro);
}

/** Testa di profilo: naso lungo, berretto piatto calato, espressione. */
function testaLadroLato(ctx, faccia) {
  sagoma(ctx, [Forme.ellisse(5, -324, 17, 23), Forme.poligono([[17, -333], [37, -316], [19, -310]])], C.pelleLadro);
  pezzo(ctx, Forme.poligono([[-13, -342], [0, -342], [-4, -322], [-11, -316]], true), C.capelliLadro, false);
  pezzo(ctx, Forme.ellisse(-4, -321, 4.5, 6), C.pelleLadro, false);              // orecchio
  if (faccia === 'paura' || faccia === 'avido') {
    occhio(ctx, 15, -326, 6, faccia === 'paura' ? -0.6 : 0.8, 0, null);
    if (faccia === 'paura') {
      pezzo(ctx, Forme.ellisse(22, -301, 5, 6), C.boccaDentro, false);
      tinta(ctx, Forme.ellisse(-14, -310, 3, 4.5), '#bfe3f2'); tinta(ctx, Forme.ellisse(-20, -298, 2.4, 3.6), '#bfe3f2');
    } else tratto(ctx, [[14, -306], [22, -300], [30, -305]], false, LW * 0.9);
  } else {
    pezzo(ctx, Forme.ellisse(16, -325, 4.5, 3.6), C.bianco, false);             // occhio socchiuso
    tinta(ctx, Forme.cerchio(19, -324.5, 1.9), C.pupilla);
    tratto(ctx, [[10, -328], [16, -329], [22, -327]], false, LW);
    tratto(ctx, faccia === 'ghigno' ? [[13, -305], [22, -302], [29, -307]] : [[14, -304], [21, -303], [26, -307]], false, LW * 0.9);
  }
  berretto(ctx, faccia === 'paura' ? -8 : 0, true);
}

/** Berretto piatto (di lato con la visiera in avanti, oppure di fronte). */
function berretto(ctx, alza, lato) {
  const y = -341 + alza;
  if (lato) {
    pezzo(ctx, Forme.poligono([[12, y + 1], [40, y + 2], [42, y + 8], [14, y + 8]], true), C.giaccaScura, false);
    const p = new Path2D();
    p.moveTo(-21, y + 3); p.quadraticCurveTo(-24, y - 15, 4, y - 15); p.quadraticCurveTo(32, y - 13, 36, y + 2);
    p.quadraticCurveTo(8, y + 6, -21, y + 3); p.closePath();
    pezzo(ctx, p, C.berretto);
  } else {
    pezzo(ctx, Forme.ellisse(0, y - 3, 28, 12), C.berretto);
    pezzo(ctx, Forme.poligono([[-21, y + 2], [21, y + 2], [17, y + 12], [-17, y + 12]], true), C.giaccaScura, false);
  }
  tratto(ctx, [[lato ? -4 : -12, y - 12], [lato ? 4 : 0, y - 8], [lato ? 12 : 12, y - 12]], true);
}

/** Il ladro di fronte: fermo con le mani in tasca, oppure spaventato. */
function ladroFronte(ctx, spaventato) {
  for (const s of [-1, 1]) {
    const anca = [s * 13, -176], cav = [s * (spaventato ? 22 : 14), -13];
    tubo(ctx, [anca, spaventato ? [s * 22, -96] : [s * 14, -96], cav], 25, C.pantaloni, true);
    pezzo(ctx, Forme.ellisse(s * (spaventato ? 26 : 17), -7.5, 17, 7.5), C.scarpeLadro, false);
  }
  const g = new Path2D();
  g.moveTo(-22, -298); g.quadraticCurveTo(-44, -296, -46, -268); g.lineTo(-42, -186);
  g.quadraticCurveTo(-40, -167, -30, -166); g.lineTo(30, -166); g.quadraticCurveTo(40, -167, 42, -186);
  g.lineTo(46, -268); g.quadraticCurveTo(44, -296, 22, -298); g.closePath();
  giacca(ctx, g);
  tratto(ctx, [[2, -290], [3, -168]], true);                                       // cerniera
  tinta(ctx, Forme.poligono([[-12, -300], [12, -300], [0, -282]]), C.bianco);
  tratto(ctx, [[-12, -300], [0, -282], [12, -300]]);
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) {
    if (spaventato) braccioLadro(ctx, [s * 38, -284], [[s * 64, -300], [s * 58, -338]], true, C.giacca);
    else { tubo(ctx, [[s * 38, -284], [s * 48, -236], [s * 28, -200]], 21, C.giacca, true); tratto(ctx, [[s * 18, -212], [s * 34, -196]]); }
  }
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 19, -320, 4, 6), C.pelleLadro, false);
  if (spaventato) {
    occhio(ctx, -8, -326, 6.5, 0, 0, null); occhio(ctx, 8, -326, 6.5, 0, 0, null);
    pezzo(ctx, Forme.ellisse(0, -304, 6, 7.5), C.boccaDentro, false);
    tinta(ctx, Forme.ellisse(-26, -330, 3, 4.5), '#bfe3f2'); tinta(ctx, Forme.ellisse(27, -318, 2.5, 4), '#bfe3f2');
  } else {
    for (const s of [-1, 1]) {
      pezzo(ctx, Forme.ellisse(s * 8, -326, 4.5, 3.4), C.bianco, false);
      tinta(ctx, Forme.cerchio(s * 8 + 2.5, -325.5, 1.8), C.pupilla);
      tratto(ctx, [[s * 8 - 5, -328.5], [s * 8 + 5, -329]], false, LW);
    }
    tratto(ctx, [[-6, -304], [2, -303], [8, -307]], false, LW * 0.9);
  }
  tratto(ctx, [[0, -322], [2, -313], [-2, -311]]);                                // nasone
  berretto(ctx, spaventato ? -10 : 0, false);
}

/** Il ladro visto di spalle mentre scappa. */
function ladroRetro(ctx, f) {
  for (const s of [-1, 1]) {
    const su = (f === 0) === (s < 0);
    const cav = su ? [s * 12, -60] : [s * 14, -13];
    tubo(ctx, [[s * 13, -176 - 6], su ? [s * 16, -112] : [s * 14, -96], cav], 25, C.pantaloni, true);
    pezzo(ctx, Forme.ellisse(cav[0], cav[1] + 6, 16, su ? 9 : 7.5), su ? '#3a271e' : C.scarpeLadro, false);
  }
  const g = Forme.rettangolo(-44, -300, 88, 136, 26);
  giacca(ctx, g);
  tubo(ctx, [[-30, -230], [-58, -246], [-74, -262]], 2.6, C.salmoneScuro);         // la cinghia della borsetta
  for (const s of [-1, 1]) {
    const su = (f === 0) === (s > 0);
    braccioLadro(ctx, [s * 38, -282], su ? [[s * 60, -250], [s * 50, -296]] : [[s * 58, -250], [s * 50, -216]], false, C.giacca);
  }
  tubo(ctx, [[0, -296], [0, -306]], 13, C.pelleLadro);
  for (const s of [-1, 1]) pezzo(ctx, Forme.ellisse(s * 18, -322, 4, 6), C.pelleLadro, false);
  pezzo(ctx, Forme.ellisse(0, -324, 19, 24), C.pelleLadro);
  pezzo(ctx, Forme.poligono([[-19, -342], [19, -342], [18, -318], [0, -312], [-18, -318]], true), C.capelliLadro);
  berretto(ctx, 0, false);
}

function disegnaLadro(ctx, vista, posa, f) {
  if (vista === 'fronte') ladroFronte(ctx, posa === 'spaventato');
  else if (vista === 'retro') ladroRetro(ctx, f);
  else ladroLato(ctx, posaLadroLato(posa, f));
}

/* ------------------------------------------------------------------------ */
/*  L'ABBRACCIO (Lia streghetta in ginocchio stringe Biscotto)              */
/* ------------------------------------------------------------------------ */
function disegnaAbbraccio(ctx, f) {
  const felice = f === 1, strega = ABITI.strega, X = 36;        // X = dove sta Lia
  bastone(ctx, 92, -5, -0.1, 40, true);                         // la bacchetta posata a terra
  pezzo(ctx, Forme.ellisse(X + 60, -11, 17, 10, -0.2), C.viola); // uno stivaletto spunta dietro
  const g = new Path2D();                                        // gonna allargata: è in ginocchio
  g.moveTo(X - 15, -114); g.quadraticCurveTo(X - 27, -110, X - 30, -92); g.quadraticCurveTo(X - 56, -44, X - 60, -8);
  g.quadraticCurveTo(X, 3, X + 62, -8); g.quadraticCurveTo(X + 58, -44, X + 30, -92);
  g.quadraticCurveTo(X + 27, -110, X + 15, -114); g.closePath();
  pezzo(ctx, g, C.viola);
  tratto(ctx, [[X - 4, -8], [X - 2, -30], [X + 14, -36], [X + 28, -30], [X + 32, -8]], true);   // le ginocchia
  tratto(ctx, [[X - 20, -70], [X - 26, -40], [X - 34, -10]], true);
  tubo(ctx, [[X - 26, -102], [X - 50, -132], [-26, -142]], 8, C.pelle);   // braccio dietro la testa del cane
  ctx.save(); ctx.translate(-46, 0);                            // Biscotto seduto che guarda Lia
  caneFronte(ctx, 'seduto', 0, { testa: [12, -112], rotTesta: 0.32, sguardo: [0.65, -0.7],
    coda: felice ? -0.75 : -0.15, codaLato: -1, occhi: felice ? 'felice' : null });
  ctx.restore();
  mano(ctx, -28, -142, 6.5, Math.PI, false, C.pelle);          // la manina sulla testa di Biscotto
  ctx.save(); ctx.translate(X, 44);                             // busto e testa ("in piedi" abbassati di 44)
  collettoLia(ctx, strega, 'fronte');
  ctx.translate(0, -152); ctx.rotate(felice ? -0.16 : -0.1); ctx.translate(0, 152);   // testa inclinata
  testaLia(ctx, strega, 'fronte', { sguardo: [-0.6, 0.25], occhi: felice ? 'felice' : null, bocca: felice ? 'sorriso' : 'o' });
  ctx.restore();
  tubo(ctx, [[X + 22, -100], [X + 4, -62], [-28, -70], [-38, -76]], 8, C.pelle);   // braccio che stringe il collo
  mano(ctx, -40, -76, 6.5, Math.PI, false, C.pelle);
}

/* ------------------------------------------------------------------------ */
/*  ATLANTI                                                                 */
/* ------------------------------------------------------------------------ */
const NOMI_LIA = [
  'fronte_fermo_0', 'fronte_fermo_1', 'fronte_cammina_0', 'fronte_cammina_1', 'fronte_cammina_2', 'fronte_cammina_3',
  'retro_fermo_0', 'retro_cammina_0', 'retro_cammina_1', 'retro_cammina_2', 'retro_cammina_3',
  'lato_fermo_0', 'lato_cammina_0', 'lato_cammina_1', 'lato_cammina_2', 'lato_cammina_3',
  'fronte_tocca_0', 'fronte_tocca_1', 'lato_tocca_0', 'lato_tocca_1', 'retro_tocca_0', 'retro_tocca_1',
  'lato_ascolta', 'fronte_sorpresa', 'fronte_saluta',
];
const NOMI_CANE = [
  'lato_fermo_0', 'lato_fermo_1', 'lato_cammina_0', 'lato_cammina_1', 'lato_cammina_2', 'lato_cammina_3',
  'lato_corre_0', 'lato_corre_1', 'lato_corre_2', 'lato_corre_3', 'lato_abbaia_0', 'lato_abbaia_1', 'lato_ringhia',
  'fronte_fermo_0', 'fronte_fermo_1', 'fronte_abbaia', 'fronte_seduto', 'retro_fermo_0', 'retro_fermo_1',
  'retro_corre_0', 'retro_corre_1', 'lato_borsa_0', 'lato_borsa_1', 'fronte_borsa',
];
const NOMI_GATTO = [
  'lato_fermo_0', 'lato_fermo_1', 'lato_cammina_0', 'lato_cammina_1', 'lato_cammina_2', 'lato_cammina_3',
  'lato_corre_0', 'lato_corre_1', 'lato_corre_2', 'lato_corre_3', 'fronte_seduto_0', 'fronte_seduto_1', 'fronte_miagola',
];
const NOMI_LADRO = [
  'fronte_fermo_0', 'lato_cammina_0', 'lato_cammina_1', 'lato_cammina_2', 'lato_cammina_3',
  'lato_corre_0', 'lato_corre_1', 'lato_corre_2', 'lato_corre_3', 'lato_scippo', 'retro_corre_0', 'retro_corre_1', 'fronte_spaventato',
];

/** "lato_cammina_2" → ['lato', 'cammina', 2];  "lato_ascolta" → ['lato', 'ascolta', 0] */
function leggiNome(nome) {
  const parti = nome.split('_');
  const fase = /^\d+$/.test(parti[parti.length - 1]) ? Number(parti.pop()) : 0;
  return [parti[0], parti[1] || 'fermo', fase];
}

/** Costruisce un atlante: ogni cella ha l'origine a terra, al centro in basso. */
function atlante(nomi, l, a, altezzaMondo, disegna) {
  const { tela, fotogrammi } = creaAtlante(nomi, { l, a }, (ctx, nome, cl, ca) => {
    ctx.translate(cl / 2, ca - 1.4);
    disegna(ctx, ...leggiNome(nome));
  });
  return { tela, fotogrammi, cella: { l, a }, altezzaMondo };
}

/** Dipinge tutti i personaggi e li restituisce come atlanti per il motore. */
export async function creaPersonaggi() {
  const r = {};
  for (const [nome, abito] of [['lia_borsa', 'borsa'], ['lia', 'semplice'], ['lia_strega', 'strega']]) {
    r[nome] = atlante(NOMI_LIA, 224, 320, 1.0, (ctx, v, p, f) => disegnaLia(ctx, abito, v, p, f));
    await respira();
  }
  r.biscotto = atlante(NOMI_CANE, 256, 192, 0.6, disegnaCane);
  await respira();
  r.gattino = atlante(NOMI_GATTO, 160, 128, 0.36, disegnaGatto);
  r.ladro = atlante(NOMI_LADRO, 192, 384, 1.6, disegnaLadro);
  await respira();
  r.abbraccio = atlante(['base_0', 'base_1'], 320, 320, 1.0, (ctx, v, p, f) => disegnaAbbraccio(ctx, f));
  return r;
}

/* ------------------------------------------------------------------------ */
/*  ILLUSTRAZIONI (titolo e titoli di coda)                                 */
/* ------------------------------------------------------------------------ */
/*  Fondali ad acquerello (velature, macchie, fogliame) con sopra i
 *  personaggi nello stesso stile "cel" dei giochi.                         */

/** Disegna un personaggio in (x, y) ingrandito di "scala" (y = dove poggia). */
function inScena(ctx, x, y, scala, disegna) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scala, scala);
  const r = disegna(ctx);
  ctx.restore();
  return r ? [x + r[0] * scala, y + r[1] * scala] : null;
}

/** Ombra morbida lilla sotto un personaggio (nel gioco la fa il motore). */
function ombraTerra(ctx, x, y, rx, ry) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, 'rgba(110, 90, 140, 0.32)'); g.addColorStop(1, 'rgba(110, 90, 140, 0)');
  ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Una finestra con cornice chiara, vetri azzurri, davanzale e a volte persiane. */
function finestra(ctx, x, y, l, a, seme, persiane) {
  const rng = casuale(seme);
  if (persiane) for (const s of [-1, 1]) {
    const px = s < 0 ? x - l * 0.45 : x + l;
    acquerello(ctx, Forme.rettangolo(px, y, l * 0.45, a, 2), persiane, { area: [px, y, l * 0.45, a], seme: seme + s, bordo: 0.3, variazione: 0.15 });
    for (let k = 1; k < 6; k++) linea(ctx, (p) => { p.moveTo(px + 3, y + (k * a) / 6); p.lineTo(px + l * 0.45 - 3, y + (k * a) / 6); }, { spessore: 1, alfa: 0.35 });
  }
  const vetro = Forme.rettangolo(x, y, l, a, 3);
  acquerello(ctx, vetro, '#86aac0', { area: [x, y, l, a], seme, bordo: 0.4, variazione: 0.35, granulosita: 0.2, luce: 'alto' });
  tinta(ctx, Forme.poligono([[x + l * 0.15, y + a], [x + l * 0.75, y], [x + l * 0.95, y], [x + l * 0.35, y + a]]), '#ffffff', 0.22 + rng() * 0.1);
  linea(ctx, vetro, { colore: '#fbf8ef', spessore: 4 });
  linea(ctx, (p) => { p.moveTo(x + l / 2, y); p.lineTo(x + l / 2, y + a); p.moveTo(x, y + a * 0.4); p.lineTo(x + l, y + a * 0.4); }, { colore: '#fbf8ef', spessore: 2.5 });
  linea(ctx, Forme.rettangolo(x - 2, y - 2, l + 4, a + 4, 3), { spessore: 1.3, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(x - 6, y + a, l + 12, 6, 1), '#efe6d6', { area: [x - 6, y + a, l + 12, 6], seme: seme + 9, bordo: 0.2, variazione: 0 });
  linea(ctx, Forme.rettangolo(x - 6, y + a, l + 12, 6, 1), { spessore: 1.2, alfa: 0.7 });
}

/** Una facciata ad acquerello con cornicione, finestre, porta e fioriere. */
function facciata(ctx, x, y, l, a, colore, seme, suolo) {
  const rng = casuale(seme * 131);
  const muro = Forme.rettangolo(x, y, l, suolo - y + 2, 0);
  acquerello(ctx, muro, colore, { area: [x, y, l, suolo - y], seme, luce: 'alto', larghezzaBordo: 7 });
  linea(ctx, muro, { spessore: 1.6, alfa: 0.7 });
  const corn = Forme.rettangolo(x - 5, y - 8, l + 10, 14, 2);
  acquerello(ctx, corn, scurisci(colore, 0.18), { area: [x - 5, y - 8, l + 10, 14], seme: seme + 3, bordo: 0.3, variazione: 0.1 });
  linea(ctx, corn, { spessore: 1.4, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(x, suolo - 34, l, 34, 0), scurisci(colore, 0.12), { area: [x, suolo - 34, l, 34], seme: seme + 4, bordo: 0.2, opacita: 0.5 });
  const colonne = Math.max(2, Math.round(l / 95)), piani = Math.max(1, Math.floor((suolo - y - 190) / 120));
  const persiane = rng() < 0.5 ? ['#8fb7a2', '#9db4d4', '#e6b27a'][Math.floor(rng() * 3)] : null;
  const porta = Math.floor(rng() * colonne);
  for (let p = 0; p <= piani; p++) {
    for (let c = 0; c < colonne; c++) {
      const fx = x + ((c + 0.5) * l) / colonne - 24, fy = y + 30 + p * 120;
      if (p === piani) {                               // piano terra: porta o vetrina
        if (c !== porta) continue;
        const pp = Forme.rettangolo(fx - 8, suolo - 150, 64, 150, 14);
        acquerello(ctx, pp, ['#8a5b3e', '#5f86a0', '#7c9a6c'][seme % 3], { area: [fx - 8, suolo - 150, 64, 150], seme: seme + 11, bordo: 0.4 });
        linea(ctx, pp, { spessore: 1.6, alfa: 0.8 });
        linea(ctx, Forme.rettangolo(fx + 2, suolo - 138, 44, 56, 5), { spessore: 1.2, alfa: 0.5 });
        tinta(ctx, Forme.cerchio(fx + 46, suolo - 72, 3), '#e8c45a');
        continue;
      }
      finestra(ctx, fx, fy, 48, 72, seme * 10 + p * 3 + c, persiane);
      if (p === piani - 1 && (c + seme) % 2 === 0) {   // fioriera con gerani
        fogliame(ctx, fx + 24, fy + 84, 26, { seme: seme + c, quante: 26, schiaccia: 0.5, dimFoglia: 9, inchiostro: 0.3 });
        fiorellini(ctx, fx + 2, fy + 72, 44, 12, ['#e86f6a', '#f29bb0', '#ffffff'], 6, seme + c, 3);
        acquerello(ctx, Forme.rettangolo(fx - 4, fy + 82, 56, 14, 2), '#c98a63', { area: [fx - 4, fy + 82, 56, 14], seme: seme + 7, bordo: 0.3 });
        linea(ctx, Forme.rettangolo(fx - 4, fy + 82, 56, 14, 2), { spessore: 1.2, alfa: 0.7 });
      }
    }
  }
}

/** Il marciapiede con le piastrelle e il percorso tattile giallo. */
function marciapiede(ctx, y0, y1) {
  acquerello(ctx, Forme.rettangolo(0, y0, 1280, y1 - y0, 0), '#e6e0d4', { area: [0, y0, 1280, y1 - y0], seme: 41, variazione: 0.18, bordo: 0, luce: 'basso' });
  for (let x = -400; x < 1700; x += 110) linea(ctx, (p) => { p.moveTo(640 + (x - 640) * 0.8, y0); p.lineTo(640 + (x - 640) * 1.25, y1); }, { spessore: 1, colore: STILE.inchiostroChiaro, alfa: 0.45 });
  for (const y of [y0 + 24, y0 + 100, y0 + 140]) linea(ctx, (p) => { p.moveTo(0, y); p.lineTo(1280, y); }, { spessore: 1, colore: STILE.inchiostroChiaro, alfa: 0.45 });
  const t0 = y0 + 54, ta = 32;                            // percorso tattile: piastre gialle a righe
  acquerello(ctx, Forme.rettangolo(0, t0, 1280, ta, 0), '#f6d65e', { area: [0, t0, 1280, ta], seme: 43, variazione: 0.2, bordo: 0.25, granulosita: 0.3 });
  for (let x = 0; x < 1280; x += 40) {
    linea(ctx, (p) => { p.moveTo(x, t0); p.lineTo(x - 3, t0 + ta); }, { spessore: 1.2, colore: '#b98f2e', alfa: 0.6 });
    for (let k = 0; k < 4; k++) {
      const bar = Forme.rettangolo(x + 8 + k * 7.5, t0 + 5, 4, ta - 10, 2);
      tinta(ctx, bar, '#fde99c'); linea(ctx, bar, { spessore: 0.9, colore: '#b98f2e', alfa: 0.7 });
    }
  }
  linea(ctx, (p) => { p.moveTo(0, t0); p.lineTo(1280, t0); p.moveTo(0, t0 + ta); p.lineTo(1280, t0 + ta); }, { spessore: 1.3, alfa: 0.6 });
}

/** Nuvolette bianche ad acquerello. */
function nuvole(ctx, rng) {
  for (let k = 0; k < 5; k++) {
    const nx = 120 + k * 260 + tra(rng, -40, 40), ny = tra(rng, 40, 110);
    for (let j = 0; j < 4; j++) acquerello(ctx, Forme.ellisse(nx + j * 34 - 50, ny + (j % 2) * 8, 46, 26), '#ffffff', { area: [nx - 110, ny - 40, 220, 90], seme: k * 9 + j, opacita: 0.6, bordo: 0.12, granulosita: 0.1, variazione: 0.1 });
  }
}

/** Edera che pende da un cornicione: tralci ondulati, foglioline e qualche fiore rosso. */
function edera(ctx, x, y, lung, seme) {
  const rng = casuale(seme);
  for (let t = 0; t < 4; t++) {
    const x0 = x + t * 15 - 22, L = lung * tra(rng, 0.5, 1), punti = [];
    for (let k = 0; k <= 10; k++) punti.push([x0 + Math.sin(k * 0.9 + t) * 7, y + (k * L) / 10]);
    pennellata(ctx, punti, '#5d7f45', 2, 0.8);
    punti.forEach(([px, py], k) => k && foglia(ctx, px, py, (k % 2 ? 0.5 : 2.6) + rng() * 0.5, 14, 6, ['#4f8a52', '#6faa5e', '#8fc070'][k % 3], 0.5));
    if (rng() < 0.6) fiorellini(ctx, x0 - 8, y + L * 0.3, 16, L * 0.6, ['#e8665d', '#f08a7a'], 3, seme + t, 3);
  }
}

/** Illustrazione del titolo: una via pastello e Lia a passeggio con Biscotto. */
export async function creaIllustrazioneTitolo() {
  const tela = nuovaTela(1280, 720), ctx = tela.getContext('2d');
  const rng = casuale(1910);
  ctx.fillStyle = STILE.carta; ctx.fillRect(0, 0, 1280, 720);
  velatura(ctx, 0, 0, 1280, 460, ['#b9dcec', '#dcecec', '#fbf2da']);
  nuvole(ctx, rng);
  const sole = ctx.createRadialGradient(140, 0, 0, 140, 0, 900);   // luce calda del sole
  sole.addColorStop(0, 'rgba(255, 238, 190, 0.45)'); sole.addColorStop(1, 'rgba(255, 238, 190, 0)');
  const suolo = 500;
  const colori = ['#f2b8a0', '#f5d993', '#bcd9c0', '#cbc2e2', '#f3c3c6', '#a8d0de', '#f4cd9a'];
  let x = -30;
  for (let k = 0; x < 1290; k++) {
    const l = Math.round(tra(rng, 220, 290)), alto = Math.round(tra(rng, 340, 470));
    facciata(ctx, x, suolo - alto, l, alto, colori[k % colori.length], k + 3, suolo);
    if (k % 3 === 1) edera(ctx, x + l * 0.8, suolo - alto + 6, 260, k);
    x += l;
    if (k % 2) await respira();
  }
  ctx.fillStyle = sole; ctx.fillRect(0, 0, 1280, 720);
  marciapiede(ctx, suolo, 670);
  acquerello(ctx, Forme.rettangolo(0, 670, 1280, 12, 0), '#d6d2cc', { area: [0, 670, 1280, 12], seme: 51, bordo: 0.3 });
  linea(ctx, (p) => { p.moveTo(0, 670); p.lineTo(1280, 670); p.moveTo(0, 682); p.lineTo(1280, 682); }, { spessore: 1.4, alfa: 0.7 });
  acquerello(ctx, Forme.rettangolo(0, 682, 1280, 40, 0), '#aaa3ba', { area: [0, 682, 1280, 40], seme: 52, variazione: 0.25, bordo: 0 });
  for (let x2 = 40; x2 < 1280; x2 += 200) tinta(ctx, Forme.rettangolo(x2, 706, 110, 6, 3), '#f6f2ea', 0.85);
  // Lia con la borsetta porta a spasso Biscotto al guinzaglio
  const yP = 648, sc = 1.0;
  ombraTerra(ctx, 560, yP, 52, 9); ombraTerra(ctx, 770, yP, 80, 10);
  const presa = inScena(ctx, 560, yP, sc, (c) => disegnaLia(c, 'borsa', 'lato', 'cammina', 0, [26, -118]));
  const collare = [770 + 38 * sc, yP - 70 * sc];                 // il guinzaglio, un po' molle
  linea(ctx, (p) => { p.moveTo(...presa); p.quadraticCurveTo((presa[0] + collare[0]) / 2, Math.max(presa[1], collare[1]) + 6, ...collare); }, { colore: '#c4574a', spessore: 2.4 });
  inScena(ctx, 770, yP, sc, (c) => caneLato(c, posaCaneLato('cammina', 2)));
  inScena(ctx, 560, yP, sc, (c) => mano(c, 26, -118, 6.5, 0, false, C.pelle));   // la manina stringe il guinzaglio
  granula(ctx, 0, 0, 1280, 720, 0.12);
  return tela;
}

/** Illustrazione finale: al parco Biscotto abbaia al ladro che scappa. */
export async function creaIllustrazioneFinale() {
  const tela = nuovaTela(1280, 720), ctx = tela.getContext('2d');
  const rng = casuale(77);
  ctx.fillStyle = STILE.carta; ctx.fillRect(0, 0, 1280, 720);
  velatura(ctx, 0, 0, 1280, 440, ['#b6d8ea', '#e0eeea', '#faf0d6']);
  nuvole(ctx, rng);
  const lontani = ['#6f9a86', '#8db59a', '#b4d2b0'];
  for (let k = 0; k < 14; k++) fogliame(ctx, k * 100 + tra(rng, -20, 20), 390 + tra(rng, -14, 10), tra(rng, 50, 80), { seme: 200 + k, colori: lontani, quante: 40, inchiostro: 0.15, schiaccia: 0.7 });
  await respira();
  const prato = Forme.rettangolo(0, 405, 1280, 320, 0);
  acquerello(ctx, prato, '#b4d48e', { area: [0, 405, 1280, 315], seme: 5, luce: 'alto', variazione: 0.3, bordo: 0 });
  const sentiero = new Path2D();
  sentiero.moveTo(1280, 470); sentiero.quadraticCurveTo(900, 480, 760, 560); sentiero.quadraticCurveTo(620, 650, 520, 720);
  sentiero.lineTo(820, 720); sentiero.quadraticCurveTo(900, 620, 1020, 540); sentiero.quadraticCurveTo(1120, 490, 1280, 486); sentiero.closePath();
  acquerello(ctx, sentiero, '#eadcbc', { area: [500, 460, 780, 260], seme: 6, bordo: 0.35 });
  for (let k = 0; k < 260; k++) {                       // fili d'erba
    const gx = rng() * 1280, gy = 420 + rng() * 300, h = 5 + rng() * 9;
    pennellata(ctx, [[gx, gy], [gx + tra(rng, -3, 3), gy - h]], rng() < 0.5 ? '#7fae61' : '#9cc777', 1.6, 0.7);
  }
  fiorellini(ctx, 0, 450, 1280, 260, ['#ffffff', '#f6b6c4', '#f7e08a'], 60, 9, 3);
  ombraTerra(ctx, 250, 590, 230, 30);                   // il grande albero
  for (const [a, b] of [[[236, 340], [120, 220]], [[262, 330], [380, 200]], [[250, 300], [258, 130]]]) {
    pennellata(ctx, [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14], b], '#6e513d', 22, 0.95);
    pennellata(ctx, [a, [(a[0] + b[0]) / 2 - 3, (a[1] + b[1]) / 2 - 16], b], '#9a7a5e', 9, 0.6);
  }
  const tronco = Forme.poligono([[180, 604], [214, 570], [224, 430], [214, 300], [278, 300], [270, 430], [282, 566], [326, 606], [252, 596]], true);
  acquerello(ctx, tronco, '#8c6a50', { area: [180, 290, 150, 320], seme: 13, luce: 'sinistra', bordo: 0.5 });
  linea(ctx, tronco, { spessore: 2, alfa: 0.75 });
  for (const xx of [236, 254]) pennellata(ctx, [[xx, 560], [xx + 4, 470], [xx - 2, 380]], '#6e513d', 2, 0.5);
  const chioma = [[90, 300, 80], [440, 290, 85], [250, 260, 120], [130, 210, 105], [380, 200, 110], [250, 150, 130], [170, 90, 95], [340, 80, 95], [260, 30, 90]];
  for (const [k, [cx, cy, r]] of chioma.entries()) {
    fogliame(ctx, cx, cy, r, { seme: 300 + k, quante: Math.round(r * 1.5), inchiostro: 0.45, colori: k < 3 ? ['#3f7346', '#5d9650', '#86bb6b'] : ['#4c8450', '#6ea65b', '#a2cf7f'] });
    if (k % 3 === 2) await respira();
  }
  // la borsetta caduta sull'erba
  ombraTerra(ctx, 712, 652, 40, 8);
  inScena(ctx, 712, 636, 1.6, (c) => { tubo(c, [[-6, -6], [-40, 4], [-30, 14], [10, 10]], 2.6, C.salmoneScuro); borsetta(c, 0, 0, 12); });
  // Biscotto abbaia, il ladro scappa spaventato
  ombraTerra(ctx, 470, 642, 90, 12); ombraTerra(ctx, 990, 600, 70, 11);
  inScena(ctx, 470, 642, 1.25, (c) => caneLato(c, posaCaneLato('abbaia', 1)));
  for (const a of [-0.5, -0.15, 0.2]) tratto(ctx, [[600 + Math.cos(a) * 14, 500 + Math.sin(a) * 14], [600 + Math.cos(a) * 34, 500 + Math.sin(a) * 34]], false, 2.4);
  inScena(ctx, 990, 600, 1.15, (c) => ladroLato(c, posaLadroLato('fuga', 0)));
  for (let k = 0; k < 4; k++) pennellata(ctx, [[880 - k * 6, 330 + k * 46], [800 - k * 10, 330 + k * 46]], '#a07e64', 2.2, 0.55);
  for (let k = 0; k < 3; k++) acquerello(ctx, Forme.ellisse(915 - k * 26, 598 - k * 6, 16 - k * 3, 9 - k * 2), '#efe3c8', { area: [860, 570, 80, 40], seme: 60 + k, opacita: 0.7, bordo: 0.2 });
  granula(ctx, 0, 0, 1280, 720, 0.12);
  return tela;
}
