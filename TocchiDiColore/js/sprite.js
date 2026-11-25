/* ==========================================================================
 *  sprite.js — IMMAGINI DI PERSONAGGI E OGGETTI
 *  --------------------------------------------------------------------------
 *  Gli "sprite" sono immagini piatte che il renderer disegna nel mondo
 *  sempre rivolte verso la telecamera (tecnica "billboard").
 *  Anche questi vengono disegnati dal codice all'avvio.
 *
 *  Personaggi con più punti di vista:
 *    lia_fronte_N, lia_retro_N, lia_lato_N   (N: 0 ferma, 1-2 passo, 3 bastone)
 *    cane_lato_N (0 fermo, 1-2 corsa, 3 abbaio), cane_fronte_N, cane_retro_N
 *  Le immagini "di lato" guardano verso destra: il renderer le specchia.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const D = U.D;
  const PI = Math.PI;

  const S = { immagini: {} };

  /**
   * Crea uno sprite. Oltre ai colori calcola:
   *   alfa:  1 dove l'immagine è piena, 0 dove è trasparente
   *   bordo: 1 sui pixel del contorno (diventano tratti a matita/inchiostro)
   */
  S.crea = function (larghezza, altezza, disegna) {
    const tela = document.createElement('canvas');
    tela.width = larghezza;
    tela.height = altezza;
    const c = tela.getContext('2d');
    disegna(c, larghezza, altezza);
    const dati = c.getImageData(0, 0, larghezza, altezza).data;
    const n = larghezza * altezza;
    const colore = new Uint32Array(n);
    const alfa = new Uint8Array(n);
    const bordo = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      const k = p * 4;
      colore[p] = U.impacchetta(dati[k], dati[k + 1], dati[k + 2]);
      alfa[p] = dati[k + 3] >= 110 ? 1 : 0;
    }
    for (let y = 0; y < altezza; y++) {
      for (let x = 0; x < larghezza; x++) {
        const p = y * larghezza + x;
        if (!alfa[p]) continue;
        const vuoto = (xx, yy) => xx < 0 || yy < 0 || xx >= larghezza || yy >= altezza || !alfa[yy * larghezza + xx];
        if (vuoto(x - 1, y) || vuoto(x + 1, y) || vuoto(x, y - 1) || vuoto(x, y + 1)) bordo[p] = 1;
      }
    }
    return { larghezza, altezza, colore, alfa, bordo, tela };
  };

  /* =====================================================================
   *  LIA — la protagonista
   * =================================================================== */
  const LIA = {
    pelle: '#f7d8c4', capelli: '#5b3a33', capelliLuce: '#7a5148',
    cappotto: '#f2c14e', cappottoOmbra: '#dca63c', colletto: '#fff3d6',
    calze: '#5f71a0', stivali: '#d0606a', bastone: '#fbfaf5', bastoneRosso: '#d9534f',
    guance: '#f3a5a0', occhi: '#4d4254', bocca: '#b5524f', fermaglio: '#f49ac1', bottoni: '#b5832b',
  };

  /** Il bastone bianco con la punta rossa. */
  function bastone(c, x1, y1, x2, y2) {
    D.linea(c, x1, y1, x2, y2, LIA.bastone, 2.2);
    const t = 0.82;
    D.linea(c, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, x2, y2, LIA.bastoneRosso, 2.2);
  }

  /** Cappotto visto di fronte o da dietro. */
  function cappotto(c, cucitura) {
    D.poligono(c, [[13, 26], [27, 26], [31, 49], [9, 49]], LIA.cappotto);
    D.poligono(c, [[23, 26], [27, 26], [31, 49], [25, 49]], LIA.cappottoOmbra);
    D.rett(c, 9, 47, 22, 2, LIA.cappottoOmbra);
    if (cucitura) D.linea(c, 20, 30, 20, 47, LIA.cappottoOmbra, 1);
  }

  function liaFronte(c, f) {
    const passo = f === 1 ? 2 : f === 2 ? -2 : 0;
    D.rett(c, 15, 46 - Math.max(0, passo), 4, 12, LIA.calze);
    D.rett(c, 21, 46 - Math.max(0, -passo), 4, 12, LIA.calze);
    D.rett(c, 14, 56 - Math.max(0, passo), 6, 6, LIA.stivali);
    D.rett(c, 20, 56 - Math.max(0, -passo), 6, 6, LIA.stivali);
    cappotto(c, false);
    for (const y of [32, 38, 44]) D.ellisse(c, 20, y, 1, 1, LIA.bottoni);
    D.poligono(c, [[15, 25], [20, 30], [25, 25], [20, 24]], LIA.colletto);
    D.linea(c, 13, 28, 10, 40, LIA.cappotto, 5);
    D.linea(c, 27, 28, 30, 40, LIA.cappottoOmbra, 5);
    D.ellisse(c, 10, 42, 2.3, 2.3, LIA.pelle);
    D.ellisse(c, 30, 42, 2.3, 2.3, LIA.pelle);
    if (f === 3) bastone(c, 10, 41, 2, 56); else bastone(c, 10, 41, 5, 63);
    D.rett(c, 18, 22, 4, 5, LIA.pelle);
    // capelli (dietro), viso, frangia
    D.ellisse(c, 20, 17, 11, 11, LIA.capelli);
    D.rett(c, 9, 17, 22, 8, LIA.capelli);
    D.ellisse(c, 20, 17, 8.5, 9, LIA.pelle);
    D.ellisse(c, 20, 10.5, 9.5, 5, LIA.capelli);
    D.ellisse(c, 16, 9, 3, 1.2, LIA.capelliLuce);
    D.ellisse(c, 27, 10, 2, 2, LIA.fermaglio);
    // occhi chiusi e sereni, guance, sorriso
    D.arco(c, 16.5, 16.5, 1.8, 0.15 * PI, 0.85 * PI, LIA.occhi, 1);
    D.arco(c, 23.5, 16.5, 1.8, 0.15 * PI, 0.85 * PI, LIA.occhi, 1);
    D.ellisse(c, 14.5, 20, 1.6, 1, LIA.guance);
    D.ellisse(c, 25.5, 20, 1.6, 1, LIA.guance);
    D.arco(c, 20, 20.3, 1.6, 0.2 * PI, 0.8 * PI, LIA.bocca, 1);
  }

  function liaRetro(c, f) {
    const passo = f === 1 ? 2 : f === 2 ? -2 : 0;
    D.rett(c, 15, 46 - Math.max(0, passo), 4, 12, LIA.calze);
    D.rett(c, 21, 46 - Math.max(0, -passo), 4, 12, LIA.calze);
    D.rett(c, 14, 56 - Math.max(0, passo), 6, 6, LIA.stivali);
    D.rett(c, 20, 56 - Math.max(0, -passo), 6, 6, LIA.stivali);
    cappotto(c, true);
    D.linea(c, 13, 28, 10, 40, LIA.cappottoOmbra, 5);
    D.linea(c, 27, 28, 30, 40, LIA.cappotto, 5);
    D.ellisse(c, 10, 42, 2.3, 2.3, LIA.pelle);
    D.ellisse(c, 30, 42, 2.3, 2.3, LIA.pelle);
    if (f === 3) bastone(c, 30, 41, 38, 56); else bastone(c, 30, 41, 35, 63);
    D.ellisse(c, 20, 16, 10.5, 11, LIA.capelli);
    D.rett(c, 9.5, 16, 21, 9, LIA.capelli);
    D.arco(c, 20, 14, 6, 1.15 * PI, 1.6 * PI, LIA.capelliLuce, 1.5);
    D.ellisse(c, 13, 10, 2, 2, LIA.fermaglio);
  }

  function liaLato(c, f) {
    const ava = f === 1 ? 3 : f === 2 ? -3 : 0;
    const calzeScure = U.mescola(LIA.calze, '#000000', 0.18);
    const stivaliScuri = U.mescola(LIA.stivali, '#000000', 0.15);
    D.rett(c, 17 - ava, 46, 4, 11, calzeScure);          // gamba dietro
    D.rett(c, 16 - ava, 56, 7, 6, stivaliScuri);
    D.rett(c, 18 + ava, 46, 4, 11, LIA.calze);           // gamba davanti
    D.rett(c, 18 + ava, 56, 7, 6, LIA.stivali);
    D.poligono(c, [[15, 26], [25, 26], [28, 49], [12, 49]], LIA.cappotto);
    D.poligono(c, [[15, 26], [18, 26], [16, 49], [12, 49]], LIA.cappottoOmbra);
    D.rett(c, 12, 47, 16, 2, LIA.cappottoOmbra);
    D.linea(c, 21, 28, 26, 38, LIA.cappottoOmbra, 5);    // braccio teso col bastone
    D.ellisse(c, 27, 40, 2.3, 2.3, LIA.pelle);
    if (f === 3) bastone(c, 27, 40, 39, 54); else bastone(c, 27, 40, 36, 63);
    D.ellisse(c, 18, 16, 10, 10.5, LIA.capelli);         // capelli dietro
    D.rett(c, 8.5, 16, 14, 9, LIA.capelli);
    D.ellisse(c, 22, 17, 7.5, 8.5, LIA.pelle);           // viso di profilo
    D.ellisse(c, 29.3, 17.5, 1.3, 1.2, LIA.pelle);       // nasino
    D.ellisse(c, 21, 10.5, 8.5, 4.5, LIA.capelli);       // frangia
    D.ellisse(c, 14, 10, 2, 2, LIA.fermaglio);
    D.arco(c, 25.5, 16.5, 1.7, 0.15 * PI, 0.85 * PI, LIA.occhi, 1);
    D.ellisse(c, 25, 20, 1.6, 1, LIA.guance);
    D.arco(c, 27, 20.3, 1.3, 0.2 * PI, 0.7 * PI, LIA.bocca, 1);
  }

  /* =====================================================================
   *  BISCOTTO — il cane
   * =================================================================== */
  const CANE = {
    crema: '#f6e3c3', ombra: '#e2c59b', macchia: '#c99467', orecchie: '#a86f4c',
    naso: '#3a2c2c', collare: '#d9534f', bocca: '#7a3b3b', lingua: '#ef8f9b', medaglietta: '#f1c75b',
  };

  function caneLato(c, f) {
    const corsa = f === 1 ? 1 : f === 2 ? -1 : 0;
    const zampa = (x, y, ang, colore) => {
      const x2 = x + Math.sin(ang) * 9, y2 = y + Math.cos(ang) * 9;
      D.linea(c, x, y, x2, y2, colore, 3.6);
      D.ellisse(c, x2 + 0.8, y2, 2.2, 1.4, colore);
    };
    D.linea(c, 11, 17, 4, f === 2 ? 11 : 7, CANE.crema, 3.6);       // coda
    zampa(15, 24, corsa * 0.55, CANE.ombra);                          // zampe lontane
    zampa(32, 24, -corsa * 0.55, CANE.ombra);
    D.ellisse(c, 23, 20, 13, 7.5, CANE.crema);                        // corpo
    D.ellisse(c, 19, 17, 4.5, 3, CANE.macchia);
    zampa(13, 24, -corsa * 0.55, CANE.crema);                         // zampe vicine
    zampa(34, 24, corsa * 0.55, CANE.crema);
    D.linea(c, 32, 14, 33, 22, CANE.collare, 2.5);
    D.ellisse(c, 37, 13, 7.5, 7, CANE.crema);                         // testa
    D.ellisse(c, 43, 15.5, 4.8, 3.6, CANE.crema);                     // muso
    D.ellisse(c, 47, 14.6, 1.7, 1.5, CANE.naso);
    D.ellisse(c, 39, 11.5, 1.2, 1.5, CANE.naso);                      // occhio
    D.ellisse(c, 39.4, 11, 0.4, 0.4, '#ffffff');
    D.ellisse(c, 33.5, 13.5, 3, 6, CANE.orecchie, 0.35);              // orecchio
    if (f === 3) {                                                    // bocca aperta: abbaia
      D.poligono(c, [[41, 18], [47, 17.2], [44, 21.5]], CANE.bocca);
      D.ellisse(c, 44, 20.3, 1.4, 0.9, CANE.lingua);
    }
  }

  function caneFronte(c, f) {
    D.linea(c, 33, 23, 38, f ? 13 : 16, CANE.crema, 3.4);             // coda che scodinzola
    D.ellisse(c, 24, 26, 10, 8, CANE.crema);
    D.rett(c, 18, 27, 4, 8, CANE.crema);
    D.rett(c, 26, 27, 4, 8, CANE.crema);
    D.ellisse(c, 20, 34.5, 2.5, 1.4, CANE.ombra);
    D.ellisse(c, 28, 34.5, 2.5, 1.4, CANE.ombra);
    D.ellisse(c, 14.5, 15, 3.2, 6.5, CANE.orecchie, 0.3);
    D.ellisse(c, 33.5, 15, 3.2, 6.5, CANE.orecchie, -0.3);
    D.ellisse(c, 24, 14, 9, 8.5, CANE.crema);
    D.ellisse(c, 28, 10, 3, 2.4, CANE.macchia);
    D.ellisse(c, 24, 18.5, 4.5, 3.5, '#fbf0dc');
    D.ellisse(c, 24, 16.8, 2, 1.5, CANE.naso);
    D.ellisse(c, 20, 12.5, 1.4, 1.7, CANE.naso);
    D.ellisse(c, 28, 12.5, 1.4, 1.7, CANE.naso);
    D.ellisse(c, 20.4, 12, 0.45, 0.45, '#ffffff');
    D.ellisse(c, 28.4, 12, 0.45, 0.45, '#ffffff');
    D.linea(c, 17, 22, 31, 22, CANE.collare, 2.5);
    D.ellisse(c, 24, 24, 1.5, 1.5, CANE.medaglietta);
    if (f) {
      D.ellisse(c, 24, 20.8, 2, 1.8, CANE.bocca);
      D.ellisse(c, 24, 21.8, 1.2, 0.8, CANE.lingua);
    }
  }

  function caneRetro(c, f) {
    D.ellisse(c, 17.5, 11, 2.8, 5.5, CANE.orecchie, 0.3);
    D.ellisse(c, 30.5, 11, 2.8, 5.5, CANE.orecchie, -0.3);
    D.ellisse(c, 24, 10, 7, 6.5, CANE.crema);                         // testa (dietro al corpo)
    D.rett(c, 17, 26, 5, 9, CANE.ombra);
    D.rett(c, 26, 26, 5, 9, CANE.ombra);
    D.ellisse(c, 24, 22, 11, 9, CANE.crema);
    D.ellisse(c, 20, 20, 4, 3, CANE.macchia);
    D.linea(c, 18, 15, 30, 15, CANE.collare, 2);
    D.linea(c, 24, 16, 24 + (f ? 6 : -6), 6, CANE.crema, 3.6);        // coda
  }

  /* =====================================================================
   *  OGGETTI
   * =================================================================== */
  function albero(c, colori, lucine) {
    D.poligono(c, [[28, 96], [36, 96], [35, 58], [29, 58]], '#a7836a');
    D.linea(c, 32, 70, 24, 60, '#a7836a', 3);
    D.linea(c, 33, 66, 41, 57, '#a7836a', 3);
    const chiome = [[32, 42, 21], [17, 52, 14], [47, 52, 14], [23, 28, 14], [41, 28, 14], [32, 17, 12]];
    for (const [x, y, r] of chiome) D.ellisse(c, x, y, r, r * 0.92, colori[0]);
    for (const [x, y, r] of chiome) D.ellisse(c, x - r * 0.18, y - r * 0.2, r * 0.75, r * 0.65, colori[1]);
    for (const [x, y, r] of chiome) D.ellisse(c, x - r * 0.3, y - r * 0.35, r * 0.4, r * 0.32, colori[2]);
    if (lucine) {
      const casuale = U.creaCasuale(77);
      for (let k = 0; k < 9; k++) D.ellisse(c, 12 + casuale() * 40, 14 + casuale() * 46, 1.4, 1.4, '#fff3b0');
    }
  }

  function fontana(c, f) {
    D.ellisse(c, 32, 47, 29, 8, '#c5ccd3');
    D.rett(c, 3, 38, 58, 9, '#d3d9de');
    D.ellisse(c, 32, 38, 29, 6, '#e3e8ec');
    D.ellisse(c, 32, 38, 25, 4, '#a9dcef');
    D.rett(c, 29, 20, 6, 18, '#d3d9de');
    D.ellisse(c, 32, 20, 11, 3.2, '#e3e8ec');
    D.ellisse(c, 32, 19.5, 9, 2, '#a9dcef');
    // getti d'acqua: gocce lungo due parabole, spostate a ogni fotogramma
    for (const lato of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const t = (k / 6 + f / 18) % 1;
        const x = 32 + lato * (3 + t * 19);
        const y = 18 + t * 19 - Math.sin(t * PI) * 10;
        D.ellisse(c, x, y, 1.5, 1.8, '#cdeefa');
      }
    }
    D.ellisse(c, 32, 12 + f, 1.6, 3.5, '#cdeefa');
    D.ellisse(c, 32, 6 + f * 2, 1.2, 1.4, '#e5f7fd');
  }

  function fioriera(c, l, a) {
    D.poligono(c, [[6, 14], [34, 14], [31, 28], [9, 28]], '#d98f6c');
    D.rett(c, 5, 13, 30, 3, '#c97f5d');
    const casuale = U.creaCasuale(5);
    for (let k = 0; k < 12; k++) D.ellisse(c, 8 + casuale() * 24, 9 + casuale() * 6, 3, 2.2, '#86b77a');
    const colori = ['#f28fa6', '#f7c65c', '#ffffff', '#c7a3e6'];
    for (let k = 0; k < 9; k++) D.ellisse(c, 8 + casuale() * 24, 4 + casuale() * 8, 2, 2, colori[k % 4]);
  }

  function gatto(c, f) {
    const pelo = '#b9b3c9', scuro = '#9d96b0';
    D.arco(c, 24, 24, 5, -PI / 2, PI / 2, pelo, 3);                   // coda
    D.ellisse(c, 16, 23, 9, 8, pelo);
    D.poligono(c, [[10, 9], [11, 1], [16, 6]], pelo);
    D.poligono(c, [[22, 9], [21, 1], [16, 6]], pelo);
    D.poligono(c, [[11.5, 7], [12, 3], [14.5, 6]], '#f3b6c4');
    D.poligono(c, [[20.5, 7], [20, 3], [17.5, 6]], '#f3b6c4');
    D.ellisse(c, 16, 12, 7, 6.5, pelo);
    D.linea(c, 12, 19, 14, 24, scuro, 1.2);
    D.linea(c, 20, 19, 18, 24, scuro, 1.2);
    if (f === 0) {
      D.ellisse(c, 13.5, 12, 1.2, 1.6, '#4d4254');
      D.ellisse(c, 18.5, 12, 1.2, 1.6, '#4d4254');
    } else {
      D.arco(c, 13.5, 11.5, 1.4, 0.15 * PI, 0.85 * PI, '#4d4254', 1);
      D.arco(c, 18.5, 11.5, 1.4, 0.15 * PI, 0.85 * PI, '#4d4254', 1);
    }
    D.ellisse(c, 16, 14.5, 1, 0.7, '#f3a5b5');
    D.ellisse(c, 13, 30, 2.5, 1.6, '#f4f1f8');
    D.ellisse(c, 19, 30, 2.5, 1.6, '#f4f1f8');
  }

  function pesce(c, f) {
    const arancio = '#f5a36c';
    if (f === 0) D.poligono(c, [[9, 12], [2, 5], [3, 19]], arancio);
    else D.poligono(c, [[9, 12], [1, 8], [4, 20]], arancio);
    D.poligono(c, [[18, 6.5], [24, 1.5], [26, 7]], '#f08a52');
    D.poligono(c, [[19, 17], [23, 22], [25, 17]], '#f08a52');
    D.ellisse(c, 21, 12, 13, 6.5, arancio);
    D.ellisse(c, 18, 10, 4, 2.5, '#fff4ea');
    D.ellisse(c, 26, 14, 3, 2, '#fff4ea');
    D.ellisse(c, 29.5, 10.5, 1.5, 1.5, '#4d4254');
    D.ellisse(c, 29.9, 10.1, 0.5, 0.5, '#ffffff');
  }

  function farfalla(c, f) {
    const apertura = f === 0 ? 1 : 0.35;
    D.ellisse(c, 10 - 4.5 * apertura, 5, 4.5 * apertura, 4, '#9fd0f0');
    D.ellisse(c, 10 + 4.5 * apertura, 5, 4.5 * apertura, 4, '#9fd0f0');
    D.ellisse(c, 10 - 3.5 * apertura, 11, 3.5 * apertura, 3, '#f7b7d2');
    D.ellisse(c, 10 + 3.5 * apertura, 11, 3.5 * apertura, 3, '#f7b7d2');
    D.ellisse(c, 10, 8, 1.2, 5, '#4d4254');
  }

  /* =====================================================================
   *  GENERAZIONE DI TUTTI GLI SPRITE
   * =================================================================== */
  S.generaTutte = function () {
    const I = S.immagini;
    const aggiungi = (nome, l, a, disegna) => { I[nome] = S.crea(l, a, disegna); };

    // Lia: 3 punti di vista x 4 fotogrammi
    for (let f = 0; f < 4; f++) {
      aggiungi('lia_fronte_' + f, 40, 64, (c) => liaFronte(c, f));
      aggiungi('lia_retro_' + f, 40, 64, (c) => liaRetro(c, f));
      aggiungi('lia_lato_' + f, 40, 64, (c) => liaLato(c, f));
    }
    // Biscotto
    for (let f = 0; f < 4; f++) aggiungi('cane_lato_' + f, 48, 36, (c) => caneLato(c, f));
    for (let f = 0; f < 2; f++) {
      aggiungi('cane_fronte_' + f, 48, 36, (c) => caneFronte(c, f));
      aggiungi('cane_retro_' + f, 48, 36, (c) => caneRetro(c, f));
    }

    // Natura e arredo urbano
    aggiungi('albero', 64, 96, (c) => albero(c, ['#7ab06f', '#93c785', '#b4dea1'], false));
    aggiungi('alberoSogno', 64, 96, (c) => albero(c, ['#e9a3bb', '#f3b6c8', '#fde3ea'], true));
    aggiungi('cespuglio', 48, 32, (c) => {
      for (const [x, y, r] of [[14, 20, 11], [33, 20, 11], [24, 14, 12]]) D.ellisse(c, x, y, r, r * 0.85, '#86bd79');
      for (const [x, y, r] of [[12, 17, 6], [30, 16, 6], [22, 10, 6]]) D.ellisse(c, x, y, r, r * 0.8, '#a9d69a');
      for (const [x, y] of [[16, 14], [30, 22], [24, 8]]) D.ellisse(c, x, y, 1.6, 1.6, '#fff6f8');
      D.rett(c, 4, 28, 40, 4, '#86bd79');
    });
    aggiungi('lampione', 24, 96, (c) => {
      D.rett(c, 8, 88, 8, 8, '#4f6d7a');
      D.rett(c, 10.5, 22, 3, 68, '#5b7a87');
      D.rett(c, 9, 60, 6, 3, '#4f6d7a');
      D.poligono(c, [[5, 10], [19, 10], [16, 22], [8, 22]], '#ffe9a8');
      D.ellisse(c, 12, 16, 3, 4, '#fff8dc');
      D.poligono(c, [[3, 10], [21, 10], [12, 3]], '#4f6d7a');
      D.rett(c, 7, 22, 10, 2, '#4f6d7a');
    });
    aggiungi('panchina', 64, 32, (c) => {
      D.rett(c, 8, 4, 3, 28, '#5b5f6b');
      D.rett(c, 53, 4, 3, 28, '#5b5f6b');
      D.rett(c, 4, 4, 56, 4, '#c99a6d');
      D.rett(c, 4, 10, 56, 4, '#d3a678');
      D.rett(c, 2, 17, 60, 5, '#b98a5e');
      D.rett(c, 2, 16, 4, 2, '#5b5f6b');
      D.rett(c, 58, 16, 4, 2, '#5b5f6b');
    });
    for (let f = 0; f < 3; f++) aggiungi('fontana_' + f, 64, 56, (c) => fontana(c, f));
    aggiungi('fioriera', 40, 28, fioriera);
    aggiungi('girasole', 32, 96, (c) => {
      D.rett(c, 15, 28, 3, 68, '#79b16f');
      D.ellisse(c, 9, 62, 7, 2.6, '#8fc27f', 0.5);
      D.ellisse(c, 23, 48, 7, 2.6, '#8fc27f', -0.5);
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * PI * 2;
        D.ellisse(c, 16 + Math.cos(ang) * 9.5, 16 + Math.sin(ang) * 9.5, 4.5, 2.2, k % 2 ? '#f7c948' : '#fbd86a', ang);
      }
      D.ellisse(c, 16, 16, 6.5, 6.5, '#9a6a3f');
      const casuale = U.creaCasuale(9);
      for (let k = 0; k < 10; k++) D.ellisse(c, 12 + casuale() * 8, 12 + casuale() * 8, 0.7, 0.7, '#6f4a2c');
    });
    aggiungi('fungo', 48, 48, (c) => {
      D.poligono(c, [[18, 47], [30, 47], [28, 24], [20, 24]], '#fbf3e4');
      c.fillStyle = '#f2a7b5';
      c.beginPath(); c.ellipse(24, 26, 22, 18, 0, PI, 2 * PI); c.fill();
      D.ellisse(c, 24, 26, 22, 3, '#e58fa0');
      for (const [x, y, r] of [[14, 18, 3], [26, 13, 3.5], [35, 19, 2.6], [20, 22, 2], [31, 24, 1.8]]) D.ellisse(c, x, y, r, r * 0.8, '#ffffff');
    });
    for (let f = 0; f < 2; f++) aggiungi('gatto_' + f, 32, 32, (c) => gatto(c, f));
    for (let f = 0; f < 2; f++) aggiungi('pesce_' + f, 40, 24, (c) => pesce(c, f));
    for (let f = 0; f < 2; f++) aggiungi('farfalla_' + f, 20, 16, (c) => farfalla(c, f));
    aggiungi('borsa', 28, 24, (c) => {
      D.arco(c, 14, 11, 7, PI, 2 * PI, '#b85f74', 2.5);
      D.poligono(c, [[4, 11], [24, 11], [26, 23], [2, 23]], '#e7849b');
      D.poligono(c, [[4, 11], [24, 11], [21, 17], [7, 17]], '#d36f87');
      D.ellisse(c, 14, 16.5, 1.8, 1.8, '#f1c75b');
    });

    // I cinque ricordi
    aggiungi('pane', 24, 24, (c) => {
      D.ellisse(c, 12, 14, 10.5, 6.5, '#d9a066');
      D.ellisse(c, 12, 12.5, 9, 4.3, '#e8b97f');
      for (const x of [7, 11.5, 16]) D.linea(c, x, 14, x + 2, 10, '#f6d9a8', 1.3);
    });
    aggiungi('fiore', 24, 24, (c) => {
      D.linea(c, 12, 23, 12, 12, '#7fb36f', 1.8);
      D.ellisse(c, 15.5, 18, 3.2, 1.5, '#8fc27f', -0.5);
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * PI * 2 - PI / 2;
        D.ellisse(c, 12 + Math.cos(ang) * 4, 9 + Math.sin(ang) * 4, 3.2, 3.2, '#f28fa6');
      }
      D.ellisse(c, 12, 9, 2.4, 2.4, '#f7d35c');
    });
    aggiungi('campanella', 24, 24, (c) => {
      D.arco(c, 12, 4.5, 2, 0, 2 * PI, '#c58f2c', 1.5);
      D.ellisse(c, 12, 11, 6, 5.5, '#f1c75b');
      D.poligono(c, [[6, 11], [18, 11], [20.5, 18.5], [3.5, 18.5]], '#f1c75b');
      D.ellisse(c, 12, 18.5, 8.6, 2.3, '#e0ad3c');
      D.ellisse(c, 12, 21, 1.9, 1.9, '#c58f2c');
      D.ellisse(c, 9, 10, 1.4, 3, '#fbe3a0', 0.3);
    });
    aggiungi('conchiglia', 24, 24, (c) => {
      const punti = [[12, 21]];
      for (let k = 0; k <= 10; k++) {
        const ang = PI * (1.05 + (k / 10) * 0.9);
        punti.push([12 + Math.cos(ang) * 10.5, 19 + Math.sin(ang) * 13]);
      }
      D.poligono(c, punti, '#f7c1a6');
      for (let k = 1; k < 10; k += 2) D.linea(c, 12, 20, punti[k + 1][0], punti[k + 1][1] + 1.5, '#e79f86', 1.1);
      D.ellisse(c, 12, 21, 3.5, 2, '#eaa58a');
    });
    aggiungi('carillon', 24, 24, (c) => {
      D.rett(c, 4, 11, 16, 11, '#b9a0e0');
      D.rett(c, 3, 8, 18, 4, '#cdb8ef');
      D.rett(c, 4, 16, 16, 1.5, '#f1c75b');
      D.linea(c, 20, 15, 23, 15, '#c58f2c', 1.5);
      D.ellisse(c, 23, 17, 1.2, 1.8, '#c58f2c');
      D.ellisse(c, 9, 5.5, 1.8, 1.4, '#4d4254', -0.3);
      D.linea(c, 10.6, 5.2, 10.6, 0.8, '#4d4254', 1);
      D.linea(c, 10.6, 0.8, 13.5, 2, '#4d4254', 1);
    });
  };

  G.Sprite = S;
})();
