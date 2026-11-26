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
  // Lia cammina vicino al muro (come nel film) per poterlo toccare col bastone
  vicinoAlMuro: [{ da: 0, a: 20, d: 1.55 }],
  materiali: [
    { da: -2, a: 1.6, muro: 'intonaco', terra: 'ceramica' },
    { da: 1.6, a: 20, muro: 'metallo', terra: 'ceramica' },
  ],
  vento: 4.5,   // ogni quanti secondi passa una folata di vento disegnata
  arrivi: { scala: { s: 1.0, verso: 1 } },
  atmosfera: { foschia: [26, 140], bordoBianco: 0.85 },
  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 230, ripeti: 3, foschia: 0.35, y: -12 },
    ],
    nuvole: 10,
    uccelli: 3,
    palloncini: 3,
  },
  meraviglie: [
    { id: 'comignolo', x: 0.0, y: 3.2, z: -2.2, effetto: 'uccelli', testo: 'Rondini sul comignolo!' },
    { id: 'bucato', x: 7.5, y: 2.0, z: -1.6, effetto: 'farfalle', testo: 'Il bucato steso balla con il vento.' },
    { id: 'tetti', x: 8.0, y: 0.5, z: -9.0, effetto: 'palloncino', testo: 'Un palloncino scappa da un tetto!' },
    { id: 'pecore', x: 5.0, y: 5.5, z: -9.5, effetto: 'note', testo: 'Nuvole con le zampe... sono pecore-nuvola!' },
    { id: 'vasi', x: 11.0, y: 0.4, z: -2.0, effetto: 'fiori', testo: 'Gerani e margherite lungo il parapetto.' },
  ],
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
  attori: [
    // pecore fatte di nuvola che brucano il cielo sopra i tetti
    { id: 'pecora1', tipo: 'attore', arte: 'pecora_nuvola', x: 3, y: 3.9, z: -8.2, ombra: 0, scala: 1.6, ronda: [[-4, -8.2], [14, -8.2]], velocita: 0.35, lunghezzaPasso: 0.9 },
    { id: 'pecora2', tipo: 'attore', arte: 'pecora_nuvola', x: 10, y: 5.0, z: -10, ombra: 0, scala: 1.3, ronda: [[16, -10], [-2, -10]], velocita: 0.3, lunghezzaPasso: 0.9 },
    // un orsetto in mongolfiera che attraversa il cielo
    { id: 'orso', tipo: 'animato', arte: 'orso_mongolfiera', x: -6, y: 9, z: -26, fps: 1.2, dondola: 0.4, velocita: 0.8, ricomincia: true,
      giro: [[30, 11, -26], [-30, 9, -26]] },
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
