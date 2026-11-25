/* ==========================================================================
 *  texture.js — TEXTURE DI MURI, PAVIMENTI E CIELO
 *  --------------------------------------------------------------------------
 *  Il gioco non usa immagini esterne: ogni texture viene DISEGNATA dal
 *  codice all'avvio, con le normali funzioni del canvas 2D.
 *
 *  Ogni texture ha due livelli:
 *    - COLORE:     i colori "ad acquerello" che si vedono quando Lia percepisce
 *    - INCHIOSTRO: i tratti a matita (contorni, fughe, finestre...) che si
 *                  intravedono anche quando Lia NON percepisce quella zona
 *
 *  Le "ricette" (R.casa, R.erba, ...) sono funzioni che ricevono la
 *  definizione presa da ambientazione.js e restituiscono una texture.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const D = U.D;

  const T = {
    muri: {},      // carattere della mappa → elenco di varianti di texture
    pavimenti: {}, // carattere della mappa → texture
    cielo: null,
  };

  /* --------------------------------------------------------------------- */
  /*  Funzione base: crea una texture a partire da una funzione di disegno  */
  /* --------------------------------------------------------------------- */
  function nuovaTela(larghezza, altezza) {
    const tela = document.createElement('canvas');
    tela.width = larghezza;
    tela.height = altezza;
    return tela;
  }

  /**
   * disegna(c, i, larghezza, altezza)
   *   c = contesto del livello COLORE
   *   i = contesto del livello INCHIOSTRO (si disegna in nero, conta solo l'opacità)
   */
  T.crea = function (larghezza, altezza, disegna) {
    const telaColore = nuovaTela(larghezza, altezza);
    const telaInchiostro = nuovaTela(larghezza, altezza);
    const c = telaColore.getContext('2d');
    const i = telaInchiostro.getContext('2d');
    i.strokeStyle = '#000';
    i.fillStyle = '#000';

    disegna(c, i, larghezza, altezza);

    const datiColore = c.getImageData(0, 0, larghezza, altezza).data;
    const datiInchiostro = i.getImageData(0, 0, larghezza, altezza).data;
    const n = larghezza * altezza;
    const colore = new Uint32Array(n);
    const inchiostro = new Uint8Array(n);
    let sr = 0, sg = 0, sb = 0;
    for (let p = 0; p < n; p++) {
      const k = p * 4;
      colore[p] = U.impacchetta(datiColore[k], datiColore[k + 1], datiColore[k + 2]);
      inchiostro[p] = datiInchiostro[k + 3];
      sr += datiColore[k]; sg += datiColore[k + 1]; sb += datiColore[k + 2];
    }
    return {
      larghezza, altezza, colore, inchiostro,
      medio: { r: sr / n, g: sg / n, b: sb / n }, // colore medio (per mappa e cime dei muri)
    };
  };

  /* --------------------------------------------------------------------- */
  /*  Piccoli aiuti di disegno condivisi dalle ricette                      */
  /* --------------------------------------------------------------------- */

  /** Puntini chiari e scuri per dare l'effetto "carta dipinta". */
  function macchie(c, l, a, casuale, base, quante) {
    for (let k = 0; k < quante; k++) {
      const chiaro = casuale() < 0.5;
      c.globalAlpha = 0.25 + casuale() * 0.3;
      D.rett(c, Math.floor(casuale() * l), Math.floor(casuale() * a),
        1 + Math.floor(casuale() * 2), 1 + Math.floor(casuale() * 2),
        U.mescola(base, chiaro ? '#ffffff' : '#000000', chiaro ? 0.35 : 0.12));
    }
    c.globalAlpha = 1;
  }

  /** Bordo superiore e laterali a matita, comune a tutti i muri. */
  function bordiMuro(i, l, a, conLati) {
    D.tratto(i, 0, 0.5, l, 0.5, 0.9);
    if (conLati) {
      D.tratto(i, 0.5, 0, 0.5, a, 0.7);
      D.tratto(i, l - 0.5, 0, l - 0.5, a, 0.7);
    }
  }

  const COLORI_FIORI = ['#f28fa6', '#f7c65c', '#ffffff', '#c7a3e6', '#f5a27a'];

  /** Finestra (quadrata o tonda) con cornice, riflesso, persiane e fiori. */
  function finestra(c, i, x, y, l, a, colori, opzioni, casuale) {
    const bianco = '#fbf6ec';
    if (opzioni.tonda) {
      const cx = x + l / 2, cy = y + a / 2, r = Math.min(l, a) / 2;
      D.ellisse(c, cx, cy, r + 2, r + 2, bianco);
      D.ellisse(c, cx, cy, r, r, colori.vetro);
      c.globalAlpha = 0.4;
      D.ellisse(c, cx - r * 0.3, cy - r * 0.3, r * 0.35, r * 0.2, '#ffffff', -0.6);
      c.globalAlpha = 1;
      D.rett(c, cx - 1, cy - r, 2, r * 2, bianco);
      D.rett(c, cx - r, cy - 1, r * 2, 2, bianco);
      i.globalAlpha = 0.85; i.lineWidth = 1;
      i.beginPath(); i.arc(cx, cy, r + 2, 0, Math.PI * 2); i.stroke();
      i.globalAlpha = 0.45;
      i.beginPath(); i.arc(cx, cy, r, 0, Math.PI * 2); i.stroke();
      i.globalAlpha = 1;
      return;
    }
    if (opzioni.persiane) {
      const scuro = U.mescola(colori.accento, '#000000', 0.18);
      for (const px of [x - 9, x + l + 2]) {
        D.rett(c, px, y - 1, 7, a + 2, colori.accento);
        for (let yy = y + 2; yy < y + a; yy += 3) D.rett(c, px + 1, yy, 5, 1, scuro);
        D.contorno(i, px, y - 1, 7, a + 2, 0.7);
      }
    }
    D.rett(c, x - 2, y - 2, l + 4, a + 4, bianco);           // cornice
    D.rett(c, x, y, l, a, colori.vetro);                      // vetro
    c.globalAlpha = 0.25;                                     // tendina interna
    D.rett(c, x, y, 4, a, '#ffffff');
    D.rett(c, x + l - 4, y, 4, a, '#ffffff');
    c.globalAlpha = 0.4;                                      // riflesso
    D.poligono(c, [[x + 3, y + a - 2], [x + 9, y + 2], [x + 13, y + 2], [x + 7, y + a - 2]], '#ffffff');
    c.globalAlpha = 1;
    D.rett(c, x + l / 2 - 1, y, 2, a, bianco);               // montanti a croce
    D.rett(c, x, y + a / 2 - 1, l, 2, bianco);
    D.rett(c, x - 4, y + a + 2, l + 8, 3, '#ece2d1');        // davanzale
    D.contorno(i, x - 2, y - 2, l + 4, a + 4, 0.85);
    D.contorno(i, x, y, l, a, 0.4);
    D.tratto(i, x - 4, y + a + 5.5, x + l + 4, y + a + 5.5, 0.6);
    if (opzioni.fiori && casuale() < 0.75) {                  // vaso di fiori sul davanzale
      D.rett(c, x - 2, y + a + 6, l + 4, 4, '#b98262');
      for (let k = 0; k < 6; k++) {
        D.ellisse(c, x + 1 + k * 3.6, y + a + 4.5, 1.6, 1.6, '#86b77a');
        D.ellisse(c, x + 1 + k * 3.6, y + a + 3.5, 1.7, 1.7,
          COLORI_FIORI[Math.floor(casuale() * COLORI_FIORI.length)]);
      }
      D.contorno(i, x - 2, y + a + 6, l + 4, 4, 0.5);
    }
  }

  /** Porta con riquadri e pomello. */
  function porta(c, i, x, y, l, a, colori, tonda) {
    const scuro = U.mescola(colori.accento, '#000000', 0.15);
    D.rett(c, x - 2, y - 2, l + 4, a + 2, '#fbf6ec');
    if (tonda) D.ellisse(c, x + l / 2, y, l / 2 + 2, l / 2 + 2, '#fbf6ec');
    D.rett(c, x, y, l, a, colori.accento);
    if (tonda) D.ellisse(c, x + l / 2, y, l / 2, l / 2, colori.accento);
    D.rett(c, x + 3, y + 4, l - 6, a * 0.34, scuro);
    D.rett(c, x + 3, y + a * 0.5, l - 6, a * 0.42, scuro);
    D.ellisse(c, x + l - 4, y + a * 0.47, 1.5, 1.5, '#f1c75b');
    D.contorno(i, x - 2, y - 2, l + 4, a + 2, 0.85);
    if (tonda) { i.globalAlpha = 0.85; i.beginPath(); i.arc(x + l / 2, y, l / 2 + 2, Math.PI, 0); i.stroke(); i.globalAlpha = 1; }
    D.contorno(i, x + 3, y + 4, l - 6, Math.round(a * 0.34), 0.35);
    D.contorno(i, x + 3, Math.round(y + a * 0.5), l - 6, Math.round(a * 0.42), 0.35);
  }

  /** Piccola stella a cinque punte (decorazioni della casetta lilla). */
  function stella(c, x, y, r, colore) {
    const punti = [];
    for (let k = 0; k < 10; k++) {
      const ang = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 === 0 ? r : r * 0.45;
      punti.push([x + Math.cos(ang) * rr, y + Math.sin(ang) * rr]);
    }
    D.poligono(c, punti, colore);
  }

  /* --------------------------------------------------------------------- */
  /*  RICETTE DEI MURI                                                       */
  /* --------------------------------------------------------------------- */
  const R = {};

  /** Casa intonacata con finestre, persiane, porta. */
  R.casa = function (def, variante, seme) {
    const col = def.colori;
    const alt = Math.round(64 * def.altezza);
    return T.crea(64, alt, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      macchie(c, l, a, casuale, col.base, 160);
      // cornicione in alto e zoccolo in basso
      D.rett(c, 0, 0, l, 6, U.mescola(col.base, '#ffffff', 0.35));
      D.rett(c, 0, 6, l, 2, U.mescola(col.base, '#000000', 0.12));
      D.rett(c, 0, a - 9, l, 9, U.mescola(col.base, '#000000', 0.14));
      bordiMuro(i, l, a, true);
      D.tratto(i, 0, 7.5, l, 7.5, 0.55);
      D.tratto(i, 0, a - 9.5, l, a - 9.5, 0.55);

      const tonda = def.finestra === 'tonda';
      const opzioni = { tonda, persiane: def.persiane, fiori: true };
      finestra(c, i, 22, Math.round(a * 0.2), 20, Math.round(a * 0.25), col, opzioni, casuale);
      const yBasso = Math.round(a * 0.56);
      if (variante % 2 === 0) porta(c, i, 23, yBasso + (tonda ? 4 : 0), 18, a - 9 - yBasso - (tonda ? 4 : 0), col, tonda);
      else finestra(c, i, 22, Math.round(a * 0.58), 20, Math.round(a * 0.2), col, opzioni, casuale);

      if (def.decorazioni === 'stelle') {
        for (let k = 0; k < 4; k++) {
          stella(c, 6 + casuale() * 10 + (k % 2) * 40, 14 + casuale() * (a - 40), 2.5 + casuale() * 1.5,
            ['#fff3b0', '#ffffff', '#f7c6dc'][k % 3]);
        }
      }
    });
  };

  /** Muro di mattoni (con un oblò nella seconda variante). */
  R.mattoni = function (def, variante, seme) {
    const col = def.colori;
    const alt = Math.round(64 * def.altezza);
    return T.crea(64, alt, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.malta);
      const hMattone = 8;
      for (let riga = 0, y = 0; y < a; riga++, y += hMattone) {
        const sfasamento = (riga % 2) * 8;
        for (let x = -sfasamento; x < l; x += 16) {
          const chiaro = casuale() < 0.5;
          D.rett(c, x + 1, y + 1, 14, hMattone - 2,
            U.mescola(col.base, chiaro ? '#ffffff' : '#000000', casuale() * (chiaro ? 0.25 : 0.12)));
          D.contorno(i, x + 1, y + 1, 14, hMattone - 2, 0.28);
        }
      }
      macchie(c, l, a, casuale, col.base, 80);
      bordiMuro(i, l, a, true);
      if (variante === 1) {
        const cx = 32, cy = Math.round(a * 0.35);
        D.ellisse(c, cx, cy, 11, 11, '#f6efe6');
        D.ellisse(c, cx, cy, 9, 9, col.vetro);
        c.globalAlpha = 0.45; D.ellisse(c, cx - 3, cy - 3, 3, 2, '#ffffff', -0.6); c.globalAlpha = 1;
        i.globalAlpha = 0.85; i.beginPath(); i.arc(cx, cy, 11, 0, Math.PI * 2); i.stroke(); i.globalAlpha = 1;
      }
    });
  };

  /** Facciata di bottega: insegna, tenda a strisce e vetrina con la merce. */
  R.bottega = function (def, variante, seme) {
    const col = def.colori;
    const alt = Math.round(64 * def.altezza);
    return T.crea(64, alt, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      macchie(c, l, a, casuale, col.base, 120);
      bordiMuro(i, l, a, true);
      // insegna
      D.rett(c, 6, 5, 52, 13, col.insegna);
      c.fillStyle = col.testo;
      c.font = 'bold 9px sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(def.testo, 32, 12);
      D.contorno(i, 6, 5, 52, 13, 0.85);
      // tenda a strisce con il bordo a festoni
      for (let k = 0; k < 8; k++) {
        const colore = k % 2 ? col.tenda2 : col.tenda1;
        D.rett(c, k * 8, 22, 8, 12, colore);
        D.ellisse(c, k * 8 + 4, 34, 4, 3, colore);
      }
      D.tratto(i, 0, 22.5, l, 22.5, 0.8);
      i.globalAlpha = 0.7;
      for (let k = 0; k < 8; k++) { i.beginPath(); i.arc(k * 8 + 4, 34, 4, 0, Math.PI); i.stroke(); }
      i.globalAlpha = 1;
      // vetrina
      const vy = 42, vh = a - 9 - vy - 4;
      D.rett(c, 6, vy - 2, 52, vh + 4, col.legno);
      D.rett(c, 8, vy, 48, vh, col.vetro);
      D.rett(c, 8, vy + vh * 0.5, 48, 2, col.legno);
      D.contorno(i, 6, vy - 2, 52, vh + 4, 0.85);
      D.tratto(i, 8, vy + vh * 0.5 + 0.5, 56, vy + vh * 0.5 + 0.5, 0.5);
      if (def.merce === 'pane') {
        for (let k = 0; k < 4; k++) {           // pagnotte sul ripiano
          const x = 14 + k * 12, y = vy + vh * 0.5 - 4;
          D.ellisse(c, x, y, 5, 3.5, '#d9a066');
          D.linea(c, x - 2, y - 1, x - 1, y + 1, '#f2cf9a', 1);
          D.linea(c, x + 1, y - 1, x + 2, y + 1, '#f2cf9a', 1);
          i.globalAlpha = 0.45; i.beginPath(); i.ellipse(x, y, 5, 3.5, 0, 0, Math.PI * 2); i.stroke(); i.globalAlpha = 1;
        }
        for (let k = 0; k < 5; k++) {           // panini rotondi in basso
          const x = 13 + k * 9.5, y = vy + vh - 5;
          D.ellisse(c, x, y, 3.8, 3.2, k % 2 ? '#e2b277' : '#c98d55');
        }
      } else {
        for (let k = 0; k < 4; k++) {           // secchi di fiori
          const x = 14 + k * 12;
          for (const yy of [vy + vh * 0.5 - 3, vy + vh - 6]) {
            D.rett(c, x - 3, yy, 6, 5, '#9fb8c8');
            for (let f = 0; f < 4; f++) {
              D.ellisse(c, x - 3 + casuale() * 6, yy - 1 - casuale() * 5, 2, 2,
                COLORI_FIORI[Math.floor(casuale() * COLORI_FIORI.length)]);
            }
          }
        }
      }
      // zoccolo
      D.rett(c, 0, a - 9, l, 9, U.mescola(col.base, '#000000', 0.14));
      D.tratto(i, 0, a - 9.5, l, a - 9.5, 0.55);
    });
  };

  /** Staccionata di assi di legno. */
  R.staccionata = function (def, variante, seme) {
    const col = def.colori;
    const alt = Math.round(64 * def.altezza);
    return T.crea(64, alt, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.scuro);
      for (let k = 0; k < 8; k++) {
        const x = k * 8;
        const colore = U.mescola(col.base, casuale() < 0.5 ? '#ffffff' : '#000000', casuale() * 0.12);
        D.rett(c, x + 1, 0, 6, a, colore);
        for (let v = 0; v < 3; v++) {          // venature del legno
          const vx = x + 2 + Math.floor(casuale() * 4);
          D.rett(c, vx, Math.floor(casuale() * a), 1, 4 + Math.floor(casuale() * 6), U.mescola(colore, '#000000', 0.1));
        }
        D.contorno(i, x + 1, 0, 6, a, 0.55);
      }
      for (const y of [8, a - 14]) {           // traverse con chiodi
        D.rett(c, 0, y, l, 4, col.traverse);
        D.tratto(i, 0, y + 0.5, l, y + 0.5, 0.5);
        D.tratto(i, 0, y + 3.5, l, y + 3.5, 0.5);
        for (let k = 0; k < 8; k++) D.rett(c, k * 8 + 4, y + 1, 1, 1, '#6d5a4a');
      }
      D.tratto(i, 0, 0.5, l, 0.5, 0.9);
    });
  };

  /** Siepe fitta di foglie, con qualche fiorellino. */
  R.siepe = function (def, variante, seme) {
    const col = def.colori;
    const alt = Math.round(64 * def.altezza);
    return T.crea(64, alt, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      const verdi = [col.scuro, col.base, col.chiaro, U.mescola(col.base, '#ffffff', 0.15)];
      for (let k = 0; k < 190; k++) {
        const x = casuale() * l, y = casuale() * a, r = 2 + casuale() * 3.5;
        // disegna anche "dall'altra parte" per una texture che si ripete senza cuciture
        for (const ox of [-l, 0, l]) D.ellisse(c, x + ox, y, r, r * 0.8, verdi[Math.floor(casuale() * verdi.length)]);
      }
      for (let k = 0; k < 10; k++) D.ellisse(c, casuale() * l, casuale() * a, 1.3, 1.3, col.fiori);
      i.globalAlpha = 0.28;
      for (let k = 0; k < 14; k++) {
        const x = casuale() * l, y = 4 + casuale() * (a - 8);
        i.beginPath(); i.arc(x, y, 2.5, Math.PI * 0.1, Math.PI * 0.9); i.stroke();
      }
      i.globalAlpha = 1;
      D.tratto(i, 0, 0.5, l, 0.5, 0.75);
    });
  };

  /* --------------------------------------------------------------------- */
  /*  RICETTE DEI PAVIMENTI (tutte 64 x 64 = una casella)                    */
  /* --------------------------------------------------------------------- */

  /** Marciapiede a piastrelle (4 per casella). */
  R.marciapiede = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.fuga);
      for (let ty = 0; ty < 2; ty++) {
        for (let tx = 0; tx < 2; tx++) {
          D.rett(c, tx * 32 + 1, ty * 32 + 1, 30, 30, U.mescola(col.base, '#ffffff', casuale() * 0.25));
          D.contorno(i, tx * 32, ty * 32, 32, 32, 0.45);
        }
      }
      macchie(c, l, a, casuale, col.base, 60);
    });
  };

  /** Asfalto (con la riga tratteggiata se def.riga è vero). */
  R.strada = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      macchie(c, l, a, casuale, col.base, 220);
      if (def.riga) {
        D.rett(c, 12, 30, 40, 4, col.riga);
        D.contorno(i, 12, 30, 40, 4, 0.45);
      }
      i.globalAlpha = 0.18;               // qualche crepa leggera
      for (let k = 0; k < 2; k++) {
        const x = casuale() * l, y = casuale() * a;
        i.beginPath(); i.moveTo(x, y); i.lineTo(x + 6, y + 3); i.lineTo(x + 10, y + 1); i.stroke();
      }
      i.globalAlpha = 1;
    });
  };

  /** Selciato della piazza: pietre arrotondate. */
  R.piazza = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.fuga);
      for (let riga = 0; riga < 4; riga++) {
        const sfasamento = (riga % 2) * 8;
        for (let k = -1; k < 4; k++) {
          const x = k * 16 + sfasamento, y = riga * 16;
          D.ellisse(c, x + 8, y + 8, 6.8, 6.5, U.mescola(col.base, casuale() < 0.5 ? '#ffffff' : '#000000', casuale() * 0.18));
          i.globalAlpha = 0.4; i.beginPath(); i.ellipse(x + 8, y + 8, 6.8, 6.5, 0, 0, Math.PI * 2); i.stroke(); i.globalAlpha = 1;
        }
      }
    });
  };

  /** Erba (con fiorellini se def.fiori è vero). */
  R.erba = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      for (let k = 0; k < 320; k++) {
        D.rett(c, Math.floor(casuale() * l), Math.floor(casuale() * a), 1, 2 + Math.floor(casuale() * 2),
          casuale() < 0.5 ? col.scuro : col.chiaro);
      }
      i.globalAlpha = 0.22;
      for (let k = 0; k < 10; k++) {       // ciuffi a matita
        const x = 3 + casuale() * (l - 6), y = 3 + casuale() * (a - 6);
        i.beginPath(); i.moveTo(x - 2, y + 2); i.lineTo(x, y - 2); i.lineTo(x + 2, y + 2); i.stroke();
      }
      i.globalAlpha = 1;
      if (def.fiori) {
        for (let k = 0; k < 14; k++) {
          const x = 3 + casuale() * (l - 6), y = 3 + casuale() * (a - 6);
          const colore = COLORI_FIORI[Math.floor(casuale() * COLORI_FIORI.length)];
          for (let p = 0; p < 5; p++) {
            const ang = (p / 5) * Math.PI * 2;
            D.ellisse(c, x + Math.cos(ang) * 1.6, y + Math.sin(ang) * 1.6, 1.2, 1.2, colore);
          }
          D.ellisse(c, x, y, 0.9, 0.9, '#f7d35c');
          i.globalAlpha = 0.35; i.beginPath(); i.arc(x, y, 2.6, 0, Math.PI * 2); i.stroke(); i.globalAlpha = 1;
        }
      }
    });
  };

  /** Sentiero di sabbia con sassolini. */
  R.sentiero = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      macchie(c, l, a, casuale, col.base, 160);
      for (let k = 0; k < 16; k++) {
        const x = 3 + casuale() * (l - 6), y = 3 + casuale() * (a - 6);
        const rx = 1.5 + casuale() * 2, ry = 1 + casuale() * 1.5;
        D.ellisse(c, x, y, rx, ry, col.sassi);
        i.globalAlpha = 0.45; i.beginPath(); i.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); i.stroke(); i.globalAlpha = 1;
      }
    });
  };

  /** Acqua con increspature (la texture scorre lentamente nel renderer). */
  R.acqua = function (def, variante, seme) {
    const col = def.colori;
    return T.crea(64, 64, (c, i, l, a) => {
      const casuale = U.creaCasuale(seme);
      D.rett(c, 0, 0, l, a, col.base);
      for (let k = 0; k < 18; k++) {
        const x = casuale() * l, y = casuale() * a, r = 3 + casuale() * 4;
        for (const ox of [-l, 0, l]) {
          for (const oy of [-a, 0, a]) {
            D.arco(c, x + ox, y + oy, r, Math.PI * 1.15, Math.PI * 1.85, col.chiaro, 1.2);
          }
        }
        i.globalAlpha = 0.3; i.beginPath(); i.arc(x, y, r, Math.PI * 1.2, Math.PI * 1.8); i.stroke(); i.globalAlpha = 1;
      }
    });
  };

  /** Il "vuoto": solo carta. */
  R.vuoto = function () {
    const carta = G.Ambientazione.colori.carta;
    return T.crea(64, 64, (c, i, l, a) => D.rett(c, 0, 0, l, a, carta));
  };

  /* --------------------------------------------------------------------- */
  /*  CIELO: panorama che gira tutto intorno (512 px = 360 gradi)           */
  /* --------------------------------------------------------------------- */
  T.creaCielo = function (colori) {
    const l = 512, a = 128;
    const tela = nuovaTela(l, a);
    const c = tela.getContext('2d');
    const sfumatura = c.createLinearGradient(0, 0, 0, a);
    sfumatura.addColorStop(0, colori.cieloAlto);
    sfumatura.addColorStop(0.6, colori.cieloMedio);
    sfumatura.addColorStop(1, colori.cieloOrizzonte);
    c.fillStyle = sfumatura;
    c.fillRect(0, 0, l, a);
    // sole sfumato
    for (let r = 26; r > 8; r -= 3) {
      c.globalAlpha = 0.12;
      D.ellisse(c, 380, 64, r, r, colori.sole);
    }
    c.globalAlpha = 1;
    D.ellisse(c, 380, 64, 9, 9, colori.sole);
    // nuvole: gruppi di cerchi morbidi, disegnati due volte per non avere cuciture
    const casuale = U.creaCasuale(4242);
    for (let n = 0; n < 9; n++) {
      const cx = casuale() * l, cy = 20 + casuale() * 70, dim = 8 + casuale() * 10;
      for (const ox of [-l, 0, l]) {
        c.globalAlpha = 0.6;
        for (let k = 0; k < 6; k++) {
          D.ellisse(c, cx + ox + (k - 2.5) * dim * 0.7, cy + 3, dim * 0.8, dim * 0.45, colori.ombraNuvole);
        }
        c.globalAlpha = 0.9;
        for (let k = 0; k < 6; k++) {
          D.ellisse(c, cx + ox + (k - 2.5) * dim * 0.7, cy - Math.sin((k / 5) * Math.PI) * dim * 0.5,
            dim * (0.6 + casuale() * 0.3), dim * 0.55, colori.nuvole);
        }
      }
    }
    c.globalAlpha = 1;
    const dati = c.getImageData(0, 0, l, a).data;
    const colore = new Uint32Array(l * a);
    for (let p = 0; p < l * a; p++) colore[p] = U.impacchetta(dati[p * 4], dati[p * 4 + 1], dati[p * 4 + 2]);
    return { larghezza: l, altezza: a, colore };
  };

  /* --------------------------------------------------------------------- */
  /*  Genera tutte le texture descritte in ambientazione.js                 */
  /* --------------------------------------------------------------------- */
  T.generaTutte = function (amb) {
    let seme = 1;
    for (const [carattere, def] of Object.entries(amb.muri)) {
      const ricetta = R[def.ricetta];
      if (!ricetta) throw new Error('Ricetta di muro sconosciuta: ' + def.ricetta);
      const varianti = def.varianti || 1;
      T.muri[carattere] = [];
      for (let v = 0; v < varianti; v++) T.muri[carattere].push(ricetta(def, v, 100 + seme++ * 31));
    }
    for (const [carattere, def] of Object.entries(amb.pavimenti)) {
      const ricetta = R[def.ricetta];
      if (!ricetta) throw new Error('Ricetta di pavimento sconosciuta: ' + def.ricetta);
      T.pavimenti[carattere] = ricetta(def, 0, 500 + seme++ * 17);
    }
    T.cielo = T.creaCielo(amb.colori);
  };

  T.ricette = R;
  G.Texture = T;
})();
