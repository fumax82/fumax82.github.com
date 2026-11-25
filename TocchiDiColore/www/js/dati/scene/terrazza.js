/* ==========================================================================
 *  terrazza.js — LA TERRAZZA SUI TETTI (capitolo 5)
 *  --------------------------------------------------------------------------
 *  In cima alla scala: panni stesi che sventolano, i tetti della città e,
 *  lontano, il mucchio di casette. Da qui Lia chiama la Balena del Cielo.
 * ========================================================================== */
export default {
  id: 'terrazza',
  arte: { modulo: 'scene_varie', nome: 'terrazza' },
  musica: 'citta',
  percorso: [[0, 0, 0], [14, 0, 0]],
  arrivi: { scala: { s: 1.0, verso: 1 } },
  atmosfera: { foschia: [26, 140] },
  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 230, ripeti: 3, foschia: 0.35, y: -12 },
    ],
    nuvole: 10,
    uccelli: 3,
    palloncini: 3,
  },
  inquadrature: [
    { da: 0, a: 8, tipo: 'segui', taglio: true, chiavi: [
      { s: 0, pos: [0.5, 1.5, 5.2], guarda: [0.8, 1.2, -1] },
      { s: 8, pos: [-0.6, 1.8, 6.0], guarda: [1.2, 1.6, -2] },
    ] },
    // verso il bordo: la camera si allarga e guarda il cielo
    { da: 8, a: 14, tipo: 'segui', chiavi: [
      { s: 8, pos: [-0.6, 1.8, 6.0], guarda: [1.2, 1.6, -2] },
      { s: 12.5, pos: [-2.4, 1.2, 7.2], guarda: [2.4, 3.4, -6], fov: 44 },
    ] },
  ],
  porte: [
    { id: 'scala_giu', s: 0.4, raggio: 0.6, etichetta: 'Scendi', verso: 'canale', arrivo: 'dalla_terrazza' },
  ],
  interazioni: [
    { id: 'terrazza', s: 12.2, raggio: 1.4, etichetta: 'Chiama' },
  ],
  effetti: [
    { x: 6, y: 2.2, z: -1.6, ritmo: 0.8, forma: 'petalo', colori: ['#f7b6d8', '#ffffff', '#ffd1e8'], su: 0.1, velocita: 0.4, gravita: 0.08, vita: 6, dim: 0.13, sparpaglia: 3, direzione: [0.4, 0, 0] },
  ],
  suoni: [{ tipo: 'vento', volume: 0.12 }],
};
