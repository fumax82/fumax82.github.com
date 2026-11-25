/* ==========================================================================
 *  interni.js — I LUOGHI PICCOLI: FORNO, LIBRERIA E PIAZZETTA DEL FINALE
 *  --------------------------------------------------------------------------
 *  Gli interni hanno un SOFFITTO (niente cielo) e luci calde.
 *  Legenda in più: 'I' muro del forno con gli scaffali, 'O' il forno a legna,
 *  'D' muro con finestra, '1' scaffali di libri, '2' finestra della libreria,
 *  't' cotto, 'p' parquet, 'Y' casa gialla con la finestra azzurra.
 * ========================================================================== */

export const forno = {
  id: 'forno',
  nome: 'Il forno',
  mappa: [
    'IIIIIIIII',
    'ItttttttI',
    'ItttttttO', // il forno a legna sulla parete est
    'ItttttttO',
    'ItttttttI',
    'ItttttttI',
    'DDDDDDDDD', // la parete con la vetrina e la porta
  ],
  pavimentoSottoMuri: 't',
  soffitto: { altezza: 2.6, texture: 'soffitto_travi' },
  atmosfera: { nebbiaColore: '#f7e6cc', nebbia: [7, 20], sole: [0.3, 0.9, 0.2], coloreCielo: 1, bordoBianco: 0.35, tuttoVisibile: true },
  musica: 'interno',
  suoni: [{ tipo: 'fuoco', x: 7.8, y: 3, volume: 0.22 }],
  arrivi: { ingresso: { x: 4.5, y: 5.3, angolo: -Math.PI / 2 } },
  porte: [{ id: 'esci_forno', x: 4.5, y: 5.75, raggio: 0.8, etichetta: 'Esci', verso: 'oltre', arrivo: 'dal_forno', campanello: true }],
  oggetti: [
    { tipo: 'bancone', x: 4.5, y: 2.5 },
    { tipo: 'lampada', x: 2.6, y: 3.2, z: 2.6 },
    { tipo: 'lampada', x: 6.4, y: 3.2, z: 2.6 },
    { tipo: 'forno_fuoco', x: 7.96, y: 2.5, z: 0.25, piatto: Math.PI / 2 },
    { tipo: 'forno_fuoco', x: 7.96, y: 3.5, z: 0.25, piatto: Math.PI / 2 },
    { tipo: 'cesto_baguette', x: 1.5, y: 1.5 },
    { tipo: 'cesto_baguette', x: 7.3, y: 5.3 },
    { tipo: 'pagnotta', x: 4.05, y: 2.45, z: 0.97 },
    { tipo: 'pane_tondo', x: 4.95, y: 2.45, z: 0.97 },
    // pani e ciambelle che danzano nell'aria
    { tipo: 'ciambella', x: 2.5, y: 4.2, z: 1.7, fluttua: 0.15, luce: 0.4 },
    { tipo: 'pagnotta', x: 6.3, y: 4.4, z: 1.9, fluttua: 0.12, luce: 0.4 },
    { tipo: 'baguette', x: 3.4, y: 3.6, z: 2.1, fluttua: 0.1, luce: 0.4 },
    { tipo: 'pane_tondo', x: 5.6, y: 3.7, z: 1.55, fluttua: 0.13, luce: 0.4 },
  ],
  attori: [
    {
      id: 'fornaia_dentro', tipo: 'persona', arte: 'fornaia', nome: 'La fornaia', x: 4.5, y: 1.65,
      chiacchiere: ['Il segreto? Farina, acqua, lievito... e un pizzico di pazienza.', 'Il forno a legna canta, se lo ascolti bene.'],
    },
  ],
};

export const libreria = {
  id: 'libreria',
  nome: 'La libreria della Tigre',
  mappa: [
    '111121111',
    '1ppppppp1',
    '1ppppppp1',
    '2ppppppp2',
    '1ppppppp1',
    '1ppppppp1',
    '1ppppppp1',
    '111111111',
  ],
  pavimentoSottoMuri: 'p',
  soffitto: { altezza: 3.0, texture: 'soffitto_travi' },
  atmosfera: { nebbiaColore: '#efe3d6', nebbia: [7, 20], sole: [0.2, 0.9, -0.3], coloreCielo: 1, bordoBianco: 0.35, tuttoVisibile: true },
  musica: 'interno',
  arrivi: { ingresso: { x: 4.5, y: 6.2, angolo: -Math.PI / 2 } },
  porte: [{ id: 'esci_libreria', x: 4.5, y: 6.6, raggio: 0.8, etichetta: 'Esci', verso: 'oltre', arrivo: 'dalla_libreria', campanello: true }],
  oggetti: [
    { tipo: 'poltrona', x: 2.0, y: 2.0 },
    { tipo: 'pila_libri', x: 6.9, y: 1.6 },
    { tipo: 'pila_libri', x: 1.5, y: 5.6 },
    { tipo: 'pila_libri', x: 7.4, y: 5.3, scala: 0.8 },
    { tipo: 'lampada', x: 4.5, y: 3.6, z: 3.0 },
    // libri che volano come uccelli
    { tipo: 'libro_volante', arte: 'libro_volante', x: 4.5, y: 4, animazione: 8, orbita: { cx: 4.5, cy: 3.8, raggio: 1.8, velocita: 0.7, z: 2.0, fase: 0 } },
    { tipo: 'libro_volante', arte: 'libro_volante', x: 4.5, y: 4, animazione: 9, orbita: { cx: 4.5, cy: 3.8, raggio: 2.4, velocita: -0.5, z: 2.4, fase: 2 } },
    { tipo: 'libro_volante', arte: 'libro_volante', x: 4.5, y: 4, animazione: 7, orbita: { cx: 3.5, cy: 3.2, raggio: 1.2, velocita: 0.9, z: 1.6, fase: 4 } },
  ],
  attori: [
    {
      id: 'tigre_dentro', tipo: 'persona', arte: 'tigre', nome: 'La Tigre libraia', x: 5.6, y: 2.6,
      chiacchiere: ['Ogni libro ha un profumo diverso. Questo sa di mare.', 'Prenditi tutto il tempo che vuoi.'],
    },
  ],
};

export const piazzetta = {
  id: 'piazzetta',
  nome: 'La piazzetta gialla',
  mappa: [
    'YYYYYYYYYYYY',
    'YYYYYYYYYYYY',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'Zrrrrrrrrrrr',
    'NNNNNNNNNNNN',
  ],
  atmosfera: { nebbiaColore: '#fbf4e6', nebbia: [10, 34], sole: [0.45, 0.85, 0.3], coloreCielo: 1, bordoBianco: 0.8 },
  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 110, ripeti: 4, foschia: 0.3, y: -3 },
      { arte: 'panorama_mucchio', raggio: 60, ripeti: 4, foschia: 0.05, y: -6 },
    ],
    nuvole: 10,
    uccelli: 2,
    palloncini: 2,
  },
  musica: 'finale',
  arrivi: { arrivo: { x: 4.5, y: 5, angolo: 0 } },
  oggetti: [
    { tipo: 'albero', x: 1.8, y: 8.2 },
    { tipo: 'alberello', x: 10.3, y: 8.3 },
    { tipo: 'vaso_lavanda', x: 2.5, y: 2.25 },
    { tipo: 'cassetta_fiori', x: 6.0, y: 2.2 },
    { tipo: 'vaso_foglie', x: 7.0, y: 2.2 },
    { tipo: 'lampione', x: 9.0, y: 2.25 },
    { tipo: 'edera', x: 3.5, y: 2.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 8.5, y: 2.02, z: 3.1, piatto: 0 },
  ],
  attori: [
    { id: 'biscotto', tipo: 'animale', arte: 'biscotto', nome: 'Biscotto', x: 15, y: 5.5, velocita: 3.4, visibile: false },
  ],
};
