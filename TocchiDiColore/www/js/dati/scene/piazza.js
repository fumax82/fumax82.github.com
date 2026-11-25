/* ==========================================================================
 *  piazza.js — LA PIAZZA DEL FORNO (capitoli 2 e 3)
 *  --------------------------------------------------------------------------
 *  Dall'altra parte della staccionata comincia la città IMMAGINATA da Lia:
 *  la piazzetta con il forno, la casa gialla, il vicolo dei gatti.
 *  Il percorso va verso destra lungo la piazza, poi GIRA e si infila nel
 *  vicolo, allontanandosi dalla telecamera (Lia si vede di spalle).
 * ========================================================================== */
export default {
  id: 'piazza',
  arte: { modulo: 'scene_piazza', nome: 'piazza' },
  musica: 'magia',
  percorso: [[0, 0, 0], [26.6, 0, 0], [27.5, 0, -0.4], [28, 0, -1.3], [28, 0, -15.6]],
  arrivi: {
    staccionata: { s: 0.7, verso: 1 },
    dal_forno: { s: 7.5, verso: 1 },
  },
  atmosfera: { foschia: [20, 110] },
  cielo: {
    sfondi: [
      { arte: 'panorama_mucchio', raggio: 170, ripeti: 4, foschia: 0.25, y: -4 },
      { arte: 'panorama_colline', raggio: 230, ripeti: 3, foschia: 0.4, y: -8, rotazione: 1 },
    ],
    nuvole: 8,
    uccelli: 1,
    balena: { raggio: 110, altezza: 42, fase: 2.2 },
  },
  inquadrature: [
    // 1. Lia sbuca dalla staccionata: camera ferma davanti a lei
    { da: 0, a: 4.5, tipo: 'fisso', taglio: true, chiavi: [
      { s: 0, pos: [3.6, 1.0, 3.5], guarda: [0, 0.8, 0], fov: 42 },
    ] },
    // 2. lungo la piazza, il forno e la sua vetrina
    { da: 4.5, a: 18, tipo: 'segui', taglio: true, chiavi: [
      { s: 4.5, pos: [0.3, 1.45, 5.0], guarda: [0.6, 1.0, -0.4] },
      { s: 18, pos: [-0.8, 1.9, 5.8], guarda: [0.6, 1.1, -0.5], fov: 37 },
    ] },
    // 3. campo largo: la casa gialla e l'imbocco del vicolo
    { da: 18, a: 26.2, tipo: 'segui', chiavi: [
      { s: 18, pos: [-1.0, 2.6, 7.6], guarda: [1.4, 1.3, -1.0], fov: 36 },
    ] },
    // 4. la curva: la camera gira intorno a Lia e si mette alle sue spalle
    { da: 26.2, a: 30, tipo: 'segui', morbidezza: 2, chiavi: [
      { s: 26.2, pos: [-1.0, 1.9, 6.0], guarda: [1.2, 1.1, -1.5] },
      { s: 29.6, pos: [0.3, 1.75, 4.2], guarda: [0, 1.15, -4.5] },
    ] },
    // 5. nel vicolo, di spalle (come nel film)
    { da: 30, a: 39.5, tipo: 'segui', anticipo: 0.6, chiavi: [
      { s: 30, pos: [0.4, 1.75, 4.0], guarda: [0, 1.15, -5] },
      { s: 39.5, pos: [0.25, 1.5, 3.4], guarda: [0, 1.0, -4] },
    ] },
    // 6. in fondo al vicolo: controcampo, Lia ci viene incontro
    { da: 39.5, a: 44.5, tipo: 'fisso', taglio: true, chiavi: [
      { s: 39.5, pos: [28.6, 0.95, -16.9], guarda: [0, 0.75, 0], fov: 42 },
    ] },
  ],
  attori: [
    { id: 'fornaia', tipo: 'persona', arte: 'fornaia', nome: 'La fornaia', x: 7.6, z: -1.25, visibile: false, parla: false,
      chiacchiere: ['Il pane è caldo, il forno scoppietta... che bella giornata!'] },
    { id: 'gattino', tipo: 'animale', arte: 'gattino', nome: 'Gattino', verso: 'miagolio', x: 21, z: 0.3, visibile: false, velocita: 1.6, lunghezzaPasso: 0.5 },
    { id: 'piccioni', tipo: 'piccioni', x: 14, z: 1.2, quanti: 4 },
  ],
  oggetti: [
    { arte: 'cesto_baguette', x: 10.2, z: -1.55, scala: 1.3 },
    { arte: 'panchina', x: 21.5, z: -1.4, scala: 1.2 },
    { arte: 'vaso_lavanda', x: 18.0, z: -1.7, scala: 1.4 },
    { arte: 'vaso_foglie', x: 25.6, z: -1.7, scala: 1.4 },
    { arte: 'bidone', x: 27.2, z: -9.5, scala: 1.2 },
  ],
  porte: [
    { id: 'porta_forno', s: 7.5, raggio: 0.75, verso: 'forno', arrivo: 'ingresso', bloccata: 'La porta è chiusa... il profumo arriva da qui, però!', campanello: true },
  ],
  interazioni: [
    { id: 'gattino', s: 40.5, raggio: 0.9, etichetta: 'Accarezza' },
    { id: 'uscita_vicolo', s: 42.5, raggio: 0.6, etichetta: 'Avanti' },
  ],
  ostacoli: [
    { id: 'panchina', s: 21.5, dz: -1.4 },
  ],
  effetti: [
    // profumo di pane che esce dalla porta del forno
    { id: 'profumo_pane', x: 7.6, y: 1.5, z: -1.6, ritmo: 4, forma: 'briciole', colori: ['#f2d49a', '#e8b878', '#fff3d6'], su: 0.25, velocita: 0.25, vita: 2.6, dim: 0.16, vortice: 0.7, sparpaglia: 0.5 },
    // foglie che cadono nel vicolo
    { x: 28, y: 4.2, z: -8, ritmo: 1.2, forma: 'foglia', colori: ['#9fcf7f', '#e8c46a', '#f0a070'], su: -0.2, velocita: 0.3, gravita: 0.15, vita: 6, dim: 0.16, sparpaglia: 1.2 },
  ],
  suoni: [{ tipo: 'vento', volume: 0.05 }],
};
