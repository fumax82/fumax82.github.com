/* ==========================================================================
 *  via.js — LA VIA DEL CAFFÈ (prologo e capitolo 1)
 *  --------------------------------------------------------------------------
 *  La strada del cortometraggio: case color pastello, il caffè con la
 *  tenda rossa, gli alberi sul marciapiede e, in fondo, l'angolo in ombra
 *  con la staccionata di legno e il buco in basso.
 *  Lia cammina verso destra sul marciapiede (z = 0), da x = 0 a x ≈ 46.
 *  Siccome il percorso è dritto lungo x, qui "s" coincide con x.
 * ========================================================================== */
export default {
  id: 'via',
  arte: { modulo: 'scene_via', nome: 'via' },
  musica: 'passeggiata',
  percorso: [[0, 0.08, 0], [46.15, 0.08, 0]],
  arrivi: {
    inizio: { s: 2.2, verso: 1 },
    staccionata: { s: 45.7, verso: 1 },
  },
  superficie: 'pietra',
  atmosfera: { foschia: [22, 120] },
  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 220, ripeti: 4, foschia: 0.45, y: -6 },
      { arte: 'panorama_citta', raggio: 150, ripeti: 5, foschia: 0.3, y: -3 },
    ],
    nuvole: 8,
    uccelli: 2,
  },

  /* --- Le inquadrature (vedi motore/regia.js) --------------------------- */
  inquadrature: [
    // 1. apertura: bassa, da dietro, lungo la strada (la prospettiva del film)
    { da: 0, a: 9, tipo: 'segui', taglio: true, chiavi: [
      { s: 0, pos: [-3.4, 1.0, 3.0], guarda: [3.6, 0.95, -0.9], fov: 42 },
      { s: 9, pos: [-2.0, 1.2, 3.7], guarda: [2.4, 0.9, -0.5], fov: 40 },
    ] },
    // 2. di fianco: la camera accompagna Lia e piano piano gira e sale
    { da: 9, a: 21, tipo: 'segui', taglio: true, chiavi: [
      { s: 9, pos: [0.7, 1.3, 4.5], guarda: [0.8, 0.8, 0] },
      { s: 15, pos: [-0.3, 1.6, 5.1], guarda: [0.7, 0.9, 0] },
      { s: 21, pos: [-1.5, 2.0, 5.7], guarda: [0.6, 1.0, 0], fov: 37 },
    ] },
    // 3. campo largo dall'altro marciapiede: tutta la via (arriva il ladro)
    { da: 21, a: 31, tipo: 'segui', taglio: true, anticipo: 1.6, chiavi: [
      { s: 21, pos: [1.2, 2.9, 8.8], guarda: [1.2, 1.3, -0.6], fov: 36 },
      { s: 31, pos: [-0.5, 2.5, 8.2], guarda: [1.0, 1.2, -0.6] },
    ] },
    // 4. tre quarti da davanti: Lia ci viene incontro, la via si apre dietro di lei
    { da: 31, a: 39, tipo: 'segui', taglio: true, chiavi: [
      { s: 31, pos: [3.9, 1.0, 3.3], guarda: [0, 0.85, 0], fov: 40 },
      { s: 39, pos: [3.2, 0.95, 3.6], guarda: [0, 0.8, 0] },
    ] },
    // 5. l'angolo al tramonto: camera ferma, gira la testa per seguire Lia
    { da: 39, a: 47, tipo: 'fisso', taglio: true, chiavi: [
      { s: 39, pos: [43.2, 1.15, 3.7], guarda: [0.5, 0.7, 0], fov: 42 },
      { s: 46, pos: [43.6, 1.05, 3.4], guarda: [0.4, 0.65, 0], fov: 40 },
    ] },
  ],

  /* --- Chi c'è ------------------------------------------------------------ */
  attori: [
    { id: 'biscotto', tipo: 'animale', arte: 'biscotto', nome: 'Biscotto', x: 3.2, z: 0.32 },
    { id: 'ladro', tipo: 'attore', arte: 'ladro', nome: 'L\'uomo col berretto', x: 60, z: 0.5, visibile: false, velocita: 1.3, lunghezzaPasso: 1.5 },
    { id: 'signora', tipo: 'persona', arte: 'signora', nome: 'Signora', x: 8, z: 8.4, y: 0.08, ronda: [[30, 8.4], [4, 8.4]], velocita: 0.9, parla: false },
    { id: 'signore', tipo: 'persona', arte: 'signore', nome: 'Signore', x: 30, z: -1.15, y: 0.08, ronda: [[6, -1.15], [34, -1.15]], velocita: 1.0, parla: false },
    { id: 'auto1', tipo: 'veicolo', arte: 'auto_rossa', da: [-14, 3.0], a: [60, 3.0], velocita: 3.2, parti: 0.2 },
    { id: 'auto2', tipo: 'veicolo', arte: 'autobus', da: [60, 5.7], a: [-14, 5.7], velocita: 2.6, parti: 0.55 },
    { id: 'auto3', tipo: 'veicolo', arte: 'auto_gialla', da: [-14, 3.0], a: [60, 3.0], velocita: 3.0, parti: 0.75 },
    { id: 'piccioni', tipo: 'piccioni', x: 18.5, z: 0.75, quanti: 5 },
  ],
  oggetti: [
    { arte: 'lampione', x: 12.4, z: 0.95, y: 0.08, scala: 1.25 },
    { arte: 'lampione', x: 33.6, z: 0.95, y: 0.08, scala: 1.25 },
    { arte: 'panchina', x: 20.5, z: -1.2, y: 0.08, scala: 1.2 },
    { arte: 'bicicletta', x: 31.0, z: -1.3, y: 0.08, scala: 1.2 },
  ],

  /* --- Cose da fare ------------------------------------------------------- */
  interazioni: [
    { id: 'buco', s: 45.7, raggio: 0.8, etichetta: 'Tocca' },
    { id: 'passaggio', s: 45.7, raggio: 0.8, etichetta: 'Attraversa' },
  ],
  // nel mondo bianco Lia sbatte contro gli alberi che non ha ancora "visto"
  ostacoli: [
    { id: 'albero1', s: 7.0, dz: 0.9, colore: '#9fd08a' },
    { id: 'albero2', s: 27.0, dz: 0.9, colore: '#9fd08a' },
    { id: 'lampione2', s: 33.6, dz: 0.95, colore: '#cfc7e8' },
  ],
  effetti: [
    // profumo di caffè dalla porta del caffè
    { x: 15.2, y: 1.4, z: -1.3, ritmo: 3, forma: 'fumo', colori: ['#f3e3cf', '#e9d3bb', '#fff7ea'], su: 0.35, velocita: 0.12, vita: 3.2, dim: 0.32, vortice: 0.4 },
  ],
  suoni: [{ tipo: 'citta', volume: 0.06 }],
};
