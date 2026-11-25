/* ==========================================================================
 *  piazzetta.js — LA PIAZZETTA GIALLA (finale)
 *  --------------------------------------------------------------------------
 *  La balena lascia Lia in una piazzetta luminosa, tra una casa gialla e
 *  una azzurra. Qui Biscotto la ritrova, con la borsa in bocca.
 * ========================================================================== */
export default {
  id: 'piazzetta',
  arte: { modulo: 'scene_varie', nome: 'piazzetta' },
  musica: 'finale',
  percorso: [[0, 0, 0], [13, 0, 0]],
  arrivi: { arrivo: { s: 3.5, verso: 1 } },
  atmosfera: { foschia: [24, 120], bordoBianco: 0.55 },
  cielo: {
    sfondi: [
      { arte: 'panorama_citta', raggio: 150, ripeti: 5, foschia: 0.25, y: -3 },
    ],
    nuvole: 8,
    uccelli: 2,
    palloncini: 2,
  },
  inquadrature: [
    { da: 0, a: 13, tipo: 'segui', taglio: true, chiavi: [
      { s: 0, pos: [0.4, 1.3, 4.4], guarda: [0.5, 0.85, -0.3] },
      { s: 13, pos: [-0.8, 1.5, 4.8], guarda: [0.5, 0.9, -0.3] },
    ] },
  ],
  attori: [
    { id: 'biscotto', tipo: 'animale', arte: 'biscotto', nome: 'Biscotto', x: 15, z: 0.25, visibile: false },
  ],
  oggetti: [
    { arte: 'vaso_foglie', x: 1.2, z: -1.4, scala: 1.3 },
    { arte: 'cassetta_fiori', x: 10.6, z: -1.45, y: 1.15, scala: 1.3 },
    { arte: 'alberello', x: 12.0, z: -1.1, scala: 1.3, oscilla: 0.02 },
  ],
  effetti: [
    { x: 6, y: 3, z: -1, ritmo: 1, forma: 'petalo', colori: ['#f7b6d8', '#ffffff', '#ffe08a'], su: 0, velocita: 0.3, gravita: 0.08, vita: 7, dim: 0.13, sparpaglia: 4 },
  ],
};
