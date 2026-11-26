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
  // Lia cammina vicino al muro (come nel film) per poterlo toccare col bastone
  vicinoAlMuro: [{ da: 0, a: 42.3, d: 1.15 }],
  // di che cosa sono fatti muro e pavimento, tratto per tratto (vale l'ultimo che corrisponde):
  // ogni materiale ha il suo suono e il suo modo di "colorarsi" quando lo tocca il bastone
  materiali: [
    { da: -5, a: 4, muro: 'mattoni' },
    { da: 4, a: 10, muro: 'intonaco' },
    { da: 6.3, a: 7.8, muro: 'legno' },
    { da: 10, a: 12.5, muro: 'foglie' },
    { da: 12.5, a: 18, muro: 'vetro' },
    { da: 18, a: 33, muro: 'intonaco' },
    { da: 33, a: 38, muro: 'ceramica' },
    { da: 38, a: 44, muro: 'mattoni' },
    { da: 44, a: 47, muro: 'legno' },
  ],
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
  // meraviglie nascoste nel mondo bianco (vedi gioco/meraviglie.js)
  meraviglie: [
    { id: 'vasi', x: 42.5, y: 0.6, z: -1.5, effetto: 'farfalle', testo: 'Bonsai, lavanda... e due farfalle che si svegliano!' },
    { id: 'fiori_azzurri', x: 35.5, y: 2.6, z: -1.7, effetto: 'fiori', testo: 'Fiori arancioni che si arrampicano sul muro azzurro!' },
    { id: 'lampione', x: 33.6, y: 2.8, z: 0.95, effetto: 'sveglia', attore: 'lampione_vivo', nascondi: 'lampione2', testo: 'Il lampione si sveglia!',
      dialogo: ['Ahhh... che sonno. Oh! Una bambina con il bastone!', 'Toc toc, mi hai svegliato. Aspetta... ecco: ti faccio un po\' di luce.'] },
    { id: 'chiocciola', x: 25.0, y: 0.3, z: -1.6, effetto: 'appare', attore: 'chiocciola', testo: 'Una chiocciola postina, con il berretto!' },
    { id: 'bicicletta', x: 31.0, y: 0.7, z: -1.2, effetto: 'note', testo: 'Drin drin! Una bicicletta con il cestino.' },
    { id: 'albero', x: 27.0, y: 3.0, z: 0.9, effetto: 'uccelli', testo: 'Nell\'albero dormivano degli uccellini!' },
    { id: 'caffe', x: 15.5, y: 1.4, z: -1.6, effetto: 'note', testo: 'Dal caffè arriva una musica... e profumo di brioche.' },
  ],
  inquadrature: [
    // 1. apertura: bassa, da dietro, lungo la strada (la prospettiva del film)
    { da: 0, a: 9, tipo: 'segui', taglio: true, chiavi: [
      { s: 0, pos: [-3.4, 1.0, 3.0], guarda: [3.6, 0.95, -0.9], fov: 42 },
      { s: 9, pos: [-2.0, 1.2, 3.7], guarda: [2.4, 0.9, -0.5], fov: 40 },
    ] },
    // 2. di fianco: la camera accompagna Lia e piano piano gira e sale
    { da: 9, a: 21, tipo: 'segui', taglio: true, chiavi: [
      { s: 9, pos: [0.7, 1.15, 3.5], guarda: [0.8, 0.75, 0] },
      { s: 15, pos: [-0.3, 1.4, 4.0], guarda: [0.7, 0.85, 0] },
      { s: 21, pos: [-1.4, 1.8, 4.6], guarda: [0.6, 0.95, 0], fov: 37 },
    ] },
    // 3. campo largo dall'altro marciapiede: tutta la via (arriva il ladro)
    { da: 21, a: 31, tipo: 'segui', taglio: true, anticipo: 1.6, chiavi: [
      { s: 21, pos: [1.2, 2.3, 6.9], guarda: [1.2, 1.15, -0.6], fov: 36 },
      { s: 31, pos: [-0.5, 2.0, 6.4], guarda: [1.0, 1.05, -0.6] },
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
    // una signora passeggia lungo le vetrine, dietro a Lia
    { id: 'signora', tipo: 'persona', arte: 'signora', nome: 'Signora', x: 16, z: -0.35, y: 0.08, ronda: [[3, -0.35], [21, -0.35]], velocita: 0.8, parla: false },
    { id: 'auto1', tipo: 'veicolo', arte: 'auto_rossa', da: [-14, 3.0], a: [60, 3.0], velocita: 3.2, parti: 0.2 },
    { id: 'auto2', tipo: 'veicolo', arte: 'autobus', da: [60, 5.7], a: [-14, 5.7], velocita: 2.6, parti: 0.55 },
    { id: 'auto3', tipo: 'veicolo', arte: 'auto_gialla', da: [-14, 3.0], a: [60, 3.0], velocita: 3.0, parti: 0.75 },
    { id: 'piccioni', tipo: 'piccioni', x: 18.5, z: 0.75, quanti: 5 },
    // personaggi delle fiabe: compaiono solo quando Lia li "scopre" nel mondo bianco
    { id: 'lampione_vivo', tipo: 'lampione', arte: 'lampione_vivo', nome: 'Il Lampione', x: 33.6, z: 0.95, y: 0.08, visibile: false,
      chiacchiere: ['Di notte faccio luce alle lucciole, di giorno ai pensieri.', 'Il tuo cane? Ha la coda più veloce del vento!'] },
    { id: 'chiocciola', tipo: 'persona', arte: 'chiocciola', nome: 'La chiocciola postina', x: 25, z: -1.6, y: 0.08, visibile: false,
      ronda: [[22.5, -1.6], [27.5, -1.6]], velocita: 0.12, lunghezzaPasso: 0.3,
      chiacchiere: ['Posta! Posta! Vado pianissimo... ma arrivo sempre.', 'Un cane giallo? È passato così veloce che mi ha fatto girare il guscio!'] },
  ],
  oggetti: [
    { arte: 'lampione', x: 12.4, z: 0.95, y: 0.08, scala: 1.25 },
    { id: 'lampione2', arte: 'lampione', x: 33.6, z: 0.95, y: 0.08, scala: 1.25 },
    { arte: 'panchina', x: 20.5, z: -1.55, y: 0.08, scala: 1.2 },
    { arte: 'bicicletta', x: 31.0, z: -1.6, y: 0.08, scala: 1.2 },
  ],

  /* --- Cose da fare ------------------------------------------------------- */
  interazioni: [
    { id: 'buco', s: 45.7, raggio: 0.8, etichetta: 'Tocca' },
    { id: 'passaggio', s: 45.7, raggio: 0.8, etichetta: 'Attraversa' },
  ],
  // nel mondo bianco Lia sbatte contro le cose appoggiate al muro che non ha ancora "visto"
  ostacoli: [
    { id: 'panchina', s: 20.5, colore: '#d9b48a', testo: 'Ahi! Una panchina... di legno, dura dura.' },
    { id: 'bicicletta', s: 31.0, colore: '#8fc6e8', testo: 'Oh! Una bicicletta appoggiata al muro.' },
    { id: 'vasi', s: 41.4, colore: '#c9b6ea', testo: 'Piano... qui ci sono dei vasi di fiori!' },
  ],
  effetti: [
    // profumo di caffè dalla porta del caffè
    { x: 15.2, y: 1.4, z: -1.3, ritmo: 3, forma: 'fumo', colori: ['#f3e3cf', '#e9d3bb', '#fff7ea'], su: 0.35, velocita: 0.12, vita: 3.2, dim: 0.32, vortice: 0.4 },
  ],
  suoni: [{ tipo: 'citta', volume: 0.06 }],
};
