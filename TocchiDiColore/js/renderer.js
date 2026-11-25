/* ==========================================================================
 *  renderer.js — IL MOTORE GRAFICO PSEUDO-3D
 *  --------------------------------------------------------------------------
 *  Tecnica: RAYCASTING (la stessa idea dei primi giochi in prima persona).
 *  Il mondo è una griglia 2D; per ogni COLONNA di pixel dello schermo
 *  lanciamo un "raggio" e cerchiamo i muri che incontra. Più un muro è
 *  lontano, più lo disegniamo basso: così nasce l'illusione del 3D.
 *
 *  Ordine di disegno di ogni fotogramma (dal fondo verso chi guarda):
 *    1. CIELO     — un panorama che ruota con lo sguardo
 *    2. PAVIMENTO — per ogni riga sotto l'orizzonte calcoliamo quale punto
 *                   del terreno si vede ("floor casting")
 *    3. MURI      — anche di altezze diverse: un raggio può vedere una siepe
 *                   bassa e, dietro, una casa alta
 *    4. OMBRE e SPRITE — personaggi e oggetti, dal più lontano al più vicino
 *    5. BASTONE   — in prima persona, la mano di Lia col bastone
 *
 *  L'immagine viene calcolata pixel per pixel in un buffer piccolo
 *  (es. 390 x 220) e poi ingrandita sullo schermo: è veloce anche sul telefono.
 *
 *  L'EFFETTO ACQUERELLO: ogni pixel parte dal colore della CARTA e si
 *  "dipinge" con il colore della texture in base alla percezione di Lia
 *  (vedi mondo.js). Un rumore morbido rende irregolari i bordi delle zone
 *  colorate, come macchie di acquerello. I tratti a "inchiostro" delle
 *  texture restano visibili anche dove Lia non percepisce: è lo "schizzo".
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config.grafica;

  const MAX_COLPI = 6; // muri ricordati per ogni colonna (servono per coprire gli sprite)
  const MAX_ONDE = 8;
  const DUE_PI = Math.PI * 2;

  const R = {
    W: 0, H: 0,          // dimensioni del buffer interno
    f: 0,                // "focale": quanti pixel misura 1 unità a distanza 1
    piano: 0,            // metà larghezza del piano di proiezione
    altezzaRender: CFG.altezzaRender,
  };

  /* --------------------------------------------------------------------- */
  /*  Preparazione                                                          */
  /* --------------------------------------------------------------------- */
  R.inizializza = function (telaSchermo) {
    this.telaSchermo = telaSchermo;
    this.ctxSchermo = telaSchermo.getContext('2d');
    this.tela = document.createElement('canvas');      // buffer interno
    this.ctx = this.tela.getContext('2d');

    const A = G.Ambientazione.colori;
    this.carta = U.esadecimaleARgb(A.carta);
    this.inchiostro = U.esadecimaleARgb(A.inchiostro);
    this.coloreCarta = U.impacchetta(this.carta.r, this.carta.g, this.carta.b);
    this.coloreOmbra = U.esadecimaleARgb('#8a7f99');
    this.rumore = U.creaRumore(64, 6, 3, 2024);        // per i bordi ad acquerello

    // Dati delle onde copiati in array veloci a ogni fotogramma
    this.ondaX = new Float32Array(MAX_ONDE); this.ondaY = new Float32Array(MAX_ONDE);
    this.ondaR = new Float32Array(MAX_ONDE); this.ondaS = new Float32Array(MAX_ONDE);
    this.ondaK = new Float32Array(MAX_ONDE);
    this.ondaCR = new Float32Array(MAX_ONDE); this.ondaCG = new Float32Array(MAX_ONDE); this.ondaCB = new Float32Array(MAX_ONDE);
    this.nOnde = 0;

    // Dati temporanei del raggio (muri incontrati da una colonna)
    this.tD = new Float32Array(MAX_COLPI); this.tE = new Float32Array(MAX_COLPI);
    this.tC = new Int32Array(MAX_COLPI); this.tL = new Uint8Array(MAX_COLPI);
    this.tW = new Uint8Array(MAX_COLPI); this.tMX = new Int32Array(MAX_COLPI); this.tMY = new Int32Array(MAX_COLPI);

    this.sprite = [];
    this.ridimensiona();
    window.addEventListener('resize', () => this.ridimensiona());
  };

  /** Calcola le dimensioni del buffer in base alla forma dello schermo. */
  R.ridimensiona = function () {
    const ls = Math.max(1, window.innerWidth), as = Math.max(1, window.innerHeight);
    this.telaSchermo.width = ls;
    this.telaSchermo.height = as;
    const aspetto = ls / as;
    let H = this.altezzaRender;
    let W = Math.round(H * aspetto);
    if (W < 200) { W = 200; H = Math.min(440, Math.round(W / aspetto)); } // schermo verticale
    if (W > 640) { W = 640; H = Math.round(W / aspetto); }                 // schermo molto largo
    this.W = W;
    this.H = H;
    this.tela.width = W;
    this.tela.height = H;
    this.immagine = this.ctx.createImageData(W, H);
    this.pixel = new Uint32Array(this.immagine.data.buffer); // un numero per pixel

    // Focale: campo visivo verticale scelto, ma non troppo stretto in orizzontale
    const mezzoV = (CFG.campoVisivo / 2) * Math.PI / 180;
    this.f = Math.min((H / 2) / Math.tan(mezzoV), (W / 2) / Math.tan(32 * Math.PI / 180));
    this.piano = (W / 2) / this.f;

    this.colpiDist = new Float32Array(W * MAX_COLPI);
    this.colpiAlto = new Float32Array(W * MAX_COLPI);
    this.colpiNum = new Uint8Array(W);
    this.cieloU = new Int32Array(W);
  };

  /** Cambia la risoluzione interna (usato dalla qualità automatica). */
  R.impostaAltezza = function (altezza) {
    this.altezzaRender = altezza;
    this.ridimensiona();
  };

  /* --------------------------------------------------------------------- */
  /*  Disegno di un fotogramma                                              */
  /* --------------------------------------------------------------------- */
  R.disegna = function () {
    const cam = G.Camera;
    const M = G.Mondo;

    // Valori condivisi dalle varie fasi del disegno
    const F = {
      cx: cam.x, cy: cam.y, cz: cam.z, angolo: cam.angolo,
      dirX: Math.cos(cam.angolo), dirY: Math.sin(cam.angolo),
      orizzonte: this.H / 2 + cam.inclinazione * this.H * 0.5,
      tempo: M.tempo,
    };
    F.destraX = -F.dirY; // vettore "destra" della telecamera
    F.destraY = F.dirX;

    this._preparaOnde(M);
    this._cielo(F, M);
    this._pavimento(F, M);
    this._muri(F, M);
    this._oggetti(F, M);

    this.ctx.putImageData(this.immagine, 0, 0);
    this._bastone();

    // Ingrandimento sullo schermo vero
    const cs = this.ctxSchermo;
    cs.imageSmoothingEnabled = CFG.levigatura;
    cs.drawImage(this.tela, 0, 0, this.telaSchermo.width, this.telaSchermo.height);
  };

  /** Copia le onde attive in array semplici (più veloci da leggere nei cicli). */
  R._preparaOnde = function (M) {
    let n = 0;
    for (const o of M.onde) {
      if (n >= MAX_ONDE) break;
      const t = o.r / o.raggio;
      const k = o.forza * (1 - t * t);           // l'onda si affievolisce allargandosi
      if (k <= 0.01) continue;
      this.ondaX[n] = o.x; this.ondaY[n] = o.y; this.ondaR[n] = o.r; this.ondaS[n] = o.spessore;
      this.ondaK[n] = k; this.ondaCR[n] = o.cr; this.ondaCG[n] = o.cg; this.ondaCB[n] = o.cb;
      n++;
    }
    this.nOnde = n;
  };

  /** Quanto è visibile qualcosa a distanza d (1 = vicino, 0 = perso nella nebbia di carta). */
  function visibilita(d) {
    let t = (d - CFG.nebbiaInizio) / (CFG.nebbiaFine - CFG.nebbiaInizio);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return 1 - t * t * (3 - 2 * t);
  }

  /** Quanto si vedono i tratti a matita a distanza d. */
  function schizzo(d) {
    const t = 1 - d / CFG.schizzoDistanza;
    return t > 0 ? CFG.schizzoIntensita * t : 0;
  }

  /* --------------------------------------------------------------------- */
  /*  1. CIELO                                                              */
  /* --------------------------------------------------------------------- */
  R._cielo = function (F, M) {
    const W = this.W, H = this.H, px = this.pixel;
    const cielo = G.Texture.cielo, cl = cielo.larghezza, ca = cielo.altezza, cc = cielo.colore;
    const yFine = Math.min(H, Math.ceil(F.orizzonte));
    if (yFine <= 0) return;

    // Per ogni colonna: quale porzione del panorama si vede (dipende dall'angolo)
    for (let x = 0; x < W; x++) {
      const camX = (2 * (x + 0.5)) / W - 1;
      const ang = F.angolo + Math.atan(camX * this.piano);
      let u = Math.floor((ang / DUE_PI) * cl) % cl;
      if (u < 0) u += cl;
      this.cieloU[x] = u;
    }
    const PR = this.carta.r, PG = this.carta.g, PB = this.carta.b;
    const altezzaCielo = H * 0.9;
    for (let y = 0; y < yFine; y++) {
      const sopra = Math.max(0, F.orizzonte - (y + 0.5));     // pixel sopra l'orizzonte
      let v = ca - 1 - Math.floor((sopra / altezzaCielo) * ca);
      if (v < 0) v = 0; else if (v > ca - 1) v = ca - 1;
      // vicino all'orizzonte il cielo sfuma nella carta (foschia)
      const k = M.coloreGlobale * Math.min(1, 0.3 + sopra / (H * 0.35));
      const riga = v * cl;
      let idx = y * W;
      for (let x = 0; x < W; x++, idx++) {
        const c = cc[riga + this.cieloU[x]];
        const r = PR + ((c & 255) - PR) * k;
        const g = PG + (((c >>> 8) & 255) - PG) * k;
        const b = PB + (((c >>> 16) & 255) - PB) * k;
        px[idx] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
  };

  /* --------------------------------------------------------------------- */
  /*  2. PAVIMENTO                                                          */
  /* --------------------------------------------------------------------- */
  R._pavimento = function (F, M) {
    const W = this.W, H = this.H, px = this.pixel, f = this.f, piano = this.piano;
    const MW = M.larghezza, MH = M.altezza, LB = MW + 2;
    const pav = M.pavimento, tipi = M.tipiPavimento, RB = M.rivelazioneBordata, RUM = this.rumore;
    const PR = this.carta.r, PG = this.carta.g, PB = this.carta.b;
    const IR = this.inchiostro.r, IG = this.inchiostro.g, IB = this.inchiostro.b;
    const CARTA = this.coloreCarta;
    const nO = this.nOnde;
    const oX = this.ondaX, oY = this.ondaY, oR = this.ondaR, oS = this.ondaS, oK = this.ondaK;
    const oCR = this.ondaCR, oCG = this.ondaCG, oCB = this.ondaCB;
    const scorrimento = (F.tempo * 0.06) % 1;               // per l'acqua che si muove

    // Raggi ai bordi sinistro e destro dello schermo
    const sxX = F.dirX - F.destraX * piano, sxY = F.dirY - F.destraY * piano;
    const dxX = F.dirX + F.destraX * piano, dxY = F.dirY + F.destraY * piano;

    const yInizio = Math.max(0, Math.floor(F.orizzonte) + 1);
    for (let y = yInizio; y < H; y++) {
      const p = y + 0.5 - F.orizzonte;
      let idx = y * W;
      if (p <= 0) { px.fill(CARTA, idx, idx + W); continue; }
      const d = (F.cz * f) / p;                               // distanza della riga
      if (d >= CFG.nebbiaFine) { px.fill(CARTA, idx, idx + W); continue; }
      const vis = visibilita(d), sk = schizzo(d);
      const passoX = (d * (dxX - sxX)) / W, passoY = (d * (dxY - sxY)) / W;
      let wx = F.cx + d * sxX + passoX * 0.5;
      let wy = F.cy + d * sxY + passoY * 0.5;

      for (let x = 0; x < W; x++, idx++, wx += passoX, wy += passoY) {
        if (wx < 0 || wy < 0 || wx >= MW || wy >= MH) { px[idx] = CARTA; continue; }
        const cx = wx | 0, cy = wy | 0;
        const t = tipi[pav[cy * MW + cx]];
        const tex = t.texture;
        let fx = wx - cx, fy = wy - cy;
        if (t.animata) { fx += scorrimento; fx -= fx | 0; fy += scorrimento * 0.5; fy -= fy | 0; }
        const ti = ((fy * tex.altezza) | 0) * tex.larghezza + ((fx * tex.larghezza) | 0);
        const col = tex.colore[ti];

        // Percezione interpolata tra le caselle + rumore per i bordi ad acquerello
        const rx = wx + 0.5, ry = wy + 0.5;
        const ix = rx | 0, iy = ry | 0, ax = rx - ix, ay = ry - iy;
        const b = iy * LB + ix;
        const r0 = RB[b] + (RB[b + 1] - RB[b]) * ax;
        const r1 = RB[b + LB] + (RB[b + LB + 1] - RB[b + LB]) * ax;
        const rev = r0 + (r1 - r0) * ay;
        const nz = RUM[(((wy * 9) | 0) & 63) * 64 + (((wx * 9) | 0) & 63)];
        let v = rev * 1.25 - 0.12 + (nz - 0.5) * 0.55;
        v = (v < 0 ? 0 : v > 1 ? 1 : v) * vis;

        // Dalla carta al colore della texture
        let r = PR + ((col & 255) - PR) * v;
        let g = PG + (((col >>> 8) & 255) - PG) * v;
        let bb = PB + (((col >>> 16) & 255) - PB) * v;

        // Tratti a inchiostro (visibili anche come "schizzo" dove non si percepisce)
        const ink = tex.inchiostro[ti];
        if (ink) {
          const a = ink * (1 / 255) * (sk * (1 - v) + 0.45 * v);
          r += (IR - r) * a; g += (IG - g) * a; bb += (IB - bb) * a;
        }

        // Anelli delle onde
        for (let k = 0; k < nO; k++) {
          const ddx = wx - oX[k], ddy = wy - oY[k];
          let dd = Math.sqrt(ddx * ddx + ddy * ddy) - oR[k];
          if (dd < 0) dd = -dd;
          if (dd < oS[k]) {
            let q = 1 - dd / oS[k];
            q = q * q * oK[k] * vis;
            r += (oCR[k] - r) * q; g += (oCG[k] - g) * q; bb += (oCB[k] - bb) * q;
          }
        }
        px[idx] = 0xff000000 | (bb << 16) | (g << 8) | r;
      }
    }
  };

  /* --------------------------------------------------------------------- */
  /*  3. MURI                                                               */
  /* --------------------------------------------------------------------- */
  R._muri = function (F, M) {
    const W = this.W, H = this.H, px = this.pixel, f = this.f, piano = this.piano;
    const MW = M.larghezza, MH = M.altezza;
    const muri = M.muro, altezze = M.altezzeTipo, tipi = M.tipiMuro, RIV = M.rivelazione, RUM = this.rumore;
    const PR = this.carta.r, PG = this.carta.g, PB = this.carta.b;
    const IR = this.inchiostro.r, IG = this.inchiostro.g, IB = this.inchiostro.b;
    const hMax = M.altezzaMassima - 1e-6;
    const dMax = CFG.distanzaMassima;
    const tD = this.tD, tE = this.tE, tC = this.tC, tL = this.tL, tW = this.tW, tMX = this.tMX, tMY = this.tMY;
    const cz = F.cz, orizz = F.orizzonte;

    for (let x = 0; x < W; x++) {
      // --- Direzione del raggio per questa colonna ----------------------
      const camX = (2 * (x + 0.5)) / W - 1;
      const rdx = F.dirX + F.destraX * piano * camX;
      const rdy = F.dirY + F.destraY * piano * camX;

      // --- DDA: avanziamo di casella in casella lungo il raggio ---------
      let mx = Math.floor(F.cx), my = Math.floor(F.cy);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let sx, sy, sdx, sdy;
      if (rdx < 0) { sx = -1; sdx = (F.cx - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - F.cx) * ddx; }
      if (rdy < 0) { sy = -1; sdy = (F.cy - my) * ddy; } else { sy = 1; sdy = (my + 1 - F.cy) * ddy; }

      let n = 0;
      for (let passi = 0; passi < 64; passi++) {
        let dEntra, lato;
        if (sdx < sdy) { dEntra = sdx; sdx += ddx; mx += sx; lato = 0; }
        else { dEntra = sdy; sdy += ddy; my += sy; lato = 1; }
        if (dEntra > dMax || mx < 0 || my < 0 || mx >= MW || my >= MH) break;
        const cella = my * MW + mx;
        const w = muri[cella];
        if (w) {
          tD[n] = dEntra; tE[n] = sdx < sdy ? sdx : sdy; tC[n] = cella;
          tL[n] = lato; tW[n] = w; tMX[n] = mx; tMY[n] = my;
          n++;
          // un muro alto nasconde tutto quello che c'è dietro: ci fermiamo
          if (altezze[w] >= hMax || n >= MAX_COLPI) break;
        }
      }
      this.colpiNum[x] = n;

      // --- Disegno dei muri trovati, dal più lontano al più vicino -------
      const base = x * MAX_COLPI;
      for (let k = n - 1; k >= 0; k--) {
        const d = tD[k] > 0.05 ? tD[k] : 0.05;
        const w = tW[k], h = altezze[w], scala = f / d;
        const yAlto = orizz + (cz - h) * scala;             // cima del muro sullo schermo
        const yBasso = orizz + cz * scala;                  // base del muro sullo schermo
        const tipo = tipi[w];
        const tex = tipo.texture[(tMX[k] * 7 + tMY[k] * 13) % tipo.texture.length];
        const tl = tex.larghezza, ta = tex.altezza;

        // Colonna della texture colpita dal raggio
        let muroX = tL[k] === 0 ? F.cy + d * rdy : F.cx + d * rdx;
        muroX -= Math.floor(muroX);
        let tx = (muroX * tl) | 0;
        // capovolgiamo la texture quando la guardiamo "da dietro", così le scritte si leggono sempre
        if ((tL[k] === 0 && rdx < 0) || (tL[k] === 1 && rdy > 0)) tx = tl - 1 - tx;

        const ombra = tL[k] === 1 ? 0.86 : 1;                // le facce nord/sud sono più scure
        const rev = RIV[tC[k]];
        const vis = visibilita(d), sk = schizzo(d);
        const colRumore = ((tx >> 1) + tMX[k] * 23 + tMY[k] * 7) & 63;

        // Onda più forte che tocca questo punto del muro
        const hx = F.cx + rdx * d, hy = F.cy + rdy * d;
        let qO = 0, oR = 0, oG = 0, oB = 0;
        for (let o = 0; o < this.nOnde; o++) {
          let dd = Math.hypot(hx - this.ondaX[o], hy - this.ondaY[o]) - this.ondaR[o];
          if (dd < 0) dd = -dd;
          if (dd < this.ondaS[o]) {
            let q = 1 - dd / this.ondaS[o];
            q = q * q * this.ondaK[o] * vis;
            if (q > qO) { qO = q; oR = this.ondaCR[o]; oG = this.ondaCG[o]; oB = this.ondaCB[o]; }
          }
        }

        // Cima dei muri più bassi della telecamera (siepi, staccionate viste dall'alto)
        let copreDa = yAlto;
        if (h < cz) {
          const yCima = orizz + (cz - h) * f / (tE[k] > 0.05 ? tE[k] : 0.05);
          copreDa = yCima;
          const m = tex.medio;
          const v = U.limita(rev * 1.2 - 0.1, 0, 1) * vis;
          const r = PR + (m.r * 0.82 - PR) * v, g = PG + (m.g * 0.82 - PG) * v, b = PB + (m.b * 0.82 - PB) * v;
          const yc0 = Math.max(0, Math.floor(yCima)), yc1 = Math.min(H - 1, Math.floor(yAlto) - 1);
          for (let y = yc0; y <= yc1; y++) {
            let rr = r, gg = g, bb = b;
            if (y === yc0) { const a = sk * (1 - v) + 0.5 * v; rr += (IR - rr) * a; gg += (IG - gg) * a; bb += (IB - bb) * a; }
            px[y * W + x] = 0xff000000 | (bb << 16) | (gg << 8) | rr;
          }
        }
        this.colpiDist[base + k] = d;
        this.colpiAlto[base + k] = copreDa;

        // Faccia verticale del muro
        const y0 = Math.max(0, Math.floor(yAlto)), y1 = Math.min(H - 1, Math.floor(yBasso));
        const passoT = ta / (yBasso - yAlto);
        let posT = (y0 + 0.5 - yAlto) * passoT;
        for (let y = y0; y <= y1; y++, posT += passoT) {
          let ty = posT | 0;
          if (ty >= ta) ty = ta - 1; else if (ty < 0) ty = 0;
          const ti = ty * tl + tx;
          const col = tex.colore[ti];
          const nz = RUM[((ty >> 1) & 63) * 64 + colRumore];
          let v = rev * 1.25 - 0.12 + (nz - 0.5) * 0.55;
          v = (v < 0 ? 0 : v > 1 ? 1 : v) * vis;
          let r = PR + ((col & 255) * ombra - PR) * v;
          let g = PG + (((col >>> 8) & 255) * ombra - PG) * v;
          let b = PB + (((col >>> 16) & 255) * ombra - PB) * v;
          const ink = tex.inchiostro[ti];
          if (ink) {
            const a = ink * (1 / 255) * (sk * (1 - v) + 0.45 * v);
            r += (IR - r) * a; g += (IG - g) * a; b += (IB - b) * a;
          }
          if (qO > 0) { r += (oR - r) * qO; g += (oG - g) * qO; b += (oB - b) * qO; }
          px[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }
    }
  };

  /* --------------------------------------------------------------------- */
  /*  4. OGGETTI E PERSONAGGI (sprite)                                      */
  /* --------------------------------------------------------------------- */

  /** Raccoglie tutto ciò che va disegnato come sprite, ordinato per distanza. */
  R._raccogliSprite = function (F, M) {
    const lista = this.sprite;
    lista.length = 0;
    const aggiungi = (x, y, z, altezza, nome, specchio, luce, ombra) => {
      const rx = x - F.cx, ry = y - F.cy;
      const prof = rx * F.dirX + ry * F.dirY;                 // distanza "in avanti"
      if (prof < 0.12 || prof > CFG.distanzaMassima) return;
      const lat = rx * F.destraX + ry * F.destraY;            // spostamento laterale
      const sx = this.W / 2 + (lat * this.f) / prof;          // posizione sullo schermo
      if (sx < -this.W || sx > this.W * 2) return;
      lista.push({ x, y, z, altezza, nome, specchio, luce, ombra, prof, sx });
    };

    // Oggetti del mondo
    for (const o of M.oggetti) {
      if (o.raccolto) continue;
      let specchio = false;
      if (o.orientabile) specchio = U.vistaDaAngolo(o.angolo, o.x - F.cx, o.y - F.cy).specchio;
      let luce = o.luce;
      if (o.ricordo) luce *= 0.75 + 0.25 * Math.sin(F.tempo * 3 + o.sfasamento);  // brillio
      aggiungi(o.x, o.y, o.z, o.altezza, M.spriteOggetto(o), specchio, luce, o.ombra);
    }
    // Biscotto
    const K = G.Cane;
    const sc = K.spriteCorrente(F.cx, F.cy);
    aggiungi(K.x, K.y, 0, 0.36, sc.nome, sc.specchio, 0.15, 0.24);
    // Lia, solo in terza persona (Lia "conosce" sé stessa: è sempre a colori)
    const cam = G.Camera, g = G.Giocatore;
    if (cam.transizione > 0.25 && cam.distanzaDalGiocatore > 0.3) {
      const sg = g.spriteCorrente(cam.x, cam.y);
      aggiungi(g.x, g.y, 0, 0.64, sg.nome, sg.specchio, 1, 0.2);
    }
    lista.sort((a, b) => b.prof - a.prof);                    // dal più lontano al più vicino
    return lista;
  };

  /** Riga dello schermo da cui in giù una colonna è coperta da muri più vicini di "prof". */
  R._copertura = function (x, prof) {
    let limite = this.H;
    const n = this.colpiNum[x], base = x * MAX_COLPI;
    for (let k = 0; k < n; k++) {
      if (this.colpiDist[base + k] < prof && this.colpiAlto[base + k] < limite) limite = this.colpiAlto[base + k];
    }
    return limite;
  };

  R._oggetti = function (F, M) {
    const lista = this._raccogliSprite(F, M);
    for (const s of lista) if (s.ombra > 0) this._ombra(F, M, s);   // prima tutte le ombre (stanno a terra)
    for (const s of lista) this._sprite(F, M, s);
  };

  /** Ombra morbida a forma di ellisse sotto un oggetto. */
  R._ombra = function (F, M, s) {
    if (s.prof < 0.35) return;
    const W = this.W, H = this.H, px = this.pixel, f = this.f;
    const r = s.ombra;
    const yVicino = F.orizzonte + (F.cz * f) / Math.max(0.15, s.prof - r * 0.7);
    const yLontano = F.orizzonte + (F.cz * f) / (s.prof + r * 0.7);
    const cy = (yVicino + yLontano) / 2, ry = (yVicino - yLontano) / 2;
    const rx = (r * f) / s.prof;
    if (rx < 0.5 || ry < 0.3) return;
    const rev = Math.max(s.luce, M.rivelazioneIn(s.x, s.y));
    const forza = 0.3 * (s.z > 0.05 ? 0.5 : 1) * visibilita(s.prof) * (0.35 + 0.65 * rev);
    const OR = this.coloreOmbra.r, OG = this.coloreOmbra.g, OB = this.coloreOmbra.b;
    const x0 = Math.max(0, Math.floor(s.sx - rx)), x1 = Math.min(W - 1, Math.ceil(s.sx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
    for (let x = x0; x <= x1; x++) {
      const limite = Math.min(y1 + 1, Math.floor(this._copertura(x, s.prof)));
      const ex = (x + 0.5 - s.sx) / rx;
      for (let y = y0; y < limite; y++) {
        const ey = (y + 0.5 - cy) / ry;
        const e = ex * ex + ey * ey;
        if (e >= 1) continue;
        const a = forza * (1 - e);
        const i = y * W + x, c = px[i];
        const rr = (c & 255) + (OR - (c & 255)) * a;
        const gg = ((c >>> 8) & 255) + (OG - ((c >>> 8) & 255)) * a;
        const bb = ((c >>> 16) & 255) + (OB - ((c >>> 16) & 255)) * a;
        px[i] = 0xff000000 | (bb << 16) | (gg << 8) | rr;
      }
    }
  };

  /** Disegna uno sprite colonna per colonna, nascondendo le parti dietro ai muri. */
  R._sprite = function (F, M, s) {
    const img = G.Sprite.immagini[s.nome];
    if (!img) return;
    const W = this.W, H = this.H, px = this.pixel;
    const scala = this.f / s.prof;
    const altPix = s.altezza * scala;
    const larPix = altPix * (img.larghezza / img.altezza);
    const xInizio = s.sx - larPix / 2;
    const yBase = F.orizzonte + (F.cz - s.z) * scala;
    const yCima = yBase - altPix;
    const x0 = Math.max(0, Math.floor(xInizio)), x1 = Math.min(W - 1, Math.floor(xInizio + larPix));
    const y0 = Math.max(0, Math.floor(yCima)), y1 = Math.min(H - 1, Math.floor(yBase));
    if (x1 < x0 || y1 < y0) return;

    const PR = this.carta.r, PG = this.carta.g, PB = this.carta.b;
    const IR = this.inchiostro.r, IG = this.inchiostro.g, IB = this.inchiostro.b;
    const vis = visibilita(s.prof), sk = schizzo(s.prof);
    const rev = M.rivelazioneIn(s.x, s.y);
    const v = Math.max(U.limita(rev * 1.2 - 0.08, 0, 1), s.luce) * vis;
    const aInk = sk * (1 - v) + 0.55 * v;

    // onda più forte sulla posizione dello sprite
    let qO = 0, oR = 0, oG = 0, oB = 0;
    for (let o = 0; o < this.nOnde; o++) {
      let dd = Math.hypot(s.x - this.ondaX[o], s.y - this.ondaY[o]) - this.ondaR[o];
      if (dd < 0) dd = -dd;
      if (dd < this.ondaS[o] * 1.5) {
        let q = 1 - dd / (this.ondaS[o] * 1.5);
        q = q * q * this.ondaK[o] * vis * 0.8;
        if (q > qO) { qO = q; oR = this.ondaCR[o]; oG = this.ondaCG[o]; oB = this.ondaCB[o]; }
      }
    }

    const il = img.larghezza, ia = img.altezza;
    for (let x = x0; x <= x1; x++) {
      const limite = Math.min(y1, Math.floor(this._copertura(x, s.prof)) - 1);
      if (limite < y0) continue;
      let tx = (((x + 0.5 - xInizio) / larPix) * il) | 0;
      if (tx < 0) tx = 0; else if (tx >= il) tx = il - 1;
      if (s.specchio) tx = il - 1 - tx;
      for (let y = y0; y <= limite; y++) {
        let ty = (((y + 0.5 - yCima) / altPix) * ia) | 0;
        if (ty < 0) ty = 0; else if (ty >= ia) ty = ia - 1;
        const ii = ty * il + tx;
        if (!img.alfa[ii]) continue;
        const col = img.colore[ii];
        let r = PR + ((col & 255) - PR) * v;
        let g = PG + (((col >>> 8) & 255) - PG) * v;
        let b = PB + (((col >>> 16) & 255) - PB) * v;
        if (img.bordo[ii]) { r += (IR - r) * aInk; g += (IG - g) * aInk; b += (IB - b) * aInk; }
        if (qO > 0) { r += (oR - r) * qO; g += (oG - g) * qO; b += (oB - b) * qO; }
        px[y * W + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
  };

  /* --------------------------------------------------------------------- */
  /*  5. IL BASTONE IN PRIMA PERSONA                                        */
  /* --------------------------------------------------------------------- */
  R._bastone = function () {
    const cam = G.Camera, g = G.Giocatore;
    const e = cam.transizione;
    if (e > 0.97) return;
    const W = this.W, H = this.H, c = this.ctx;
    const abbassa = e * H * 0.9;                               // scende fuori schermo passando in terza persona
    const ondeggia = Math.sin(g.faseP * Math.PI) * H * 0.012;
    const k = g.faseTocco();                                   // 0 → 1 → 0 durante il colpo
    const manoX = W * 0.76 + ondeggia, manoY = H * 1.02 + abbassa + Math.abs(ondeggia);
    const puntaX = W * 0.57 - k * W * 0.03 + ondeggia * 0.5;
    const puntaY = H * 0.67 + k * H * 0.11 + abbassa;
    const spessore = Math.max(2.5, H * 0.022);

    c.lineCap = 'round';
    c.strokeStyle = G.Ambientazione.colori.inchiostro;          // contorno
    c.lineWidth = spessore + 2;
    c.beginPath(); c.moveTo(manoX, manoY); c.lineTo(puntaX, puntaY); c.stroke();
    c.strokeStyle = '#fbfaf5';                                 // bastone bianco
    c.lineWidth = spessore;
    c.beginPath(); c.moveTo(manoX, manoY); c.lineTo(puntaX, puntaY); c.stroke();
    const t = 0.84;                                            // punta rossa
    c.strokeStyle = '#d9534f';
    c.beginPath(); c.moveTo(manoX + (puntaX - manoX) * t, manoY + (puntaY - manoY) * t); c.lineTo(puntaX, puntaY); c.stroke();

    // manica e mano
    c.fillStyle = '#f2c14e';
    c.beginPath(); c.ellipse(manoX + W * 0.035, manoY + H * 0.05, H * 0.11, H * 0.08, -0.5, 0, DUE_PI); c.fill();
    c.fillStyle = '#f7d8c4';
    c.beginPath(); c.ellipse(manoX - W * 0.005, manoY - H * 0.035, H * 0.045, H * 0.04, -0.4, 0, DUE_PI); c.fill();
    c.strokeStyle = G.Ambientazione.colori.inchiostro;
    c.globalAlpha = 0.55; c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;

    // scintille sulla punta quando tocca terra
    if (k > 0.55) {
      c.strokeStyle = '#ffe9a0';
      c.lineWidth = 1;
      c.globalAlpha = (k - 0.55) / 0.45;
      for (let a = 0; a < 6; a++) {
        const ang = (a / 6) * DUE_PI, r1 = H * 0.015, r2 = H * 0.04;
        c.beginPath();
        c.moveTo(puntaX + Math.cos(ang) * r1, puntaY + Math.sin(ang) * r1);
        c.lineTo(puntaX + Math.cos(ang) * r2, puntaY + Math.sin(ang) * r2);
        c.stroke();
      }
      c.globalAlpha = 1;
    }
  };

  G.Renderer = R;
})();
