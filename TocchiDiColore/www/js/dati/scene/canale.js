/* ==========================================================================
 *  canale.js — LA CITTÀ SULL'ACQUA (capitolo 4)
 *  --------------------------------------------------------------------------
 *  La strada è diventata un canale: le auto galleggiano come barchette.
 *  Lia attraversa il ponte a schiena d'asino (il percorso SALE e SCENDE),
 *  incontra gli abitanti-animali, arriva alla libreria della Tigre e poi
 *  sale la scala verso la terrazza.
 * ========================================================================== */
import { campiona } from '../../gioco/percorso.js';

// la gobba del ponte: tra x = 12 e x = 22 la quota sale fino a 1.8 e riscende
const ponte = (x) => 1.8 * Math.sin((Math.PI * (x - 12)) / 10);

export default {
  id: 'canale',
  arte: { modulo: 'scene_canale', nome: 'canale' },
  musica: 'citta',
  percorso: [
    [0, 0, 0],
    ...campiona(12, 22, 16, ponte, 0),
    [37, 0, 0],
    [41, 3.0, 0],
  ],
  larghezzaPercorso: 1.6,
  // la mappa della percezione copre anche il canale che si allontana verso il fondo
  percezione: { x: -14, z: -42, larghezza: 70, profondita: 56 },
  suolo: -1.3,
  arrivi: {
    vicolo: { s: 0.8, verso: 1 },
    dalla_libreria: { s: 29.5, verso: 1 },
    dalla_terrazza: { s: 40.2, verso: -1 },
  },
  superfici: [{ da: 12, a: 22.1, tipo: 'legno' }],
  atmosfera: { foschia: [24, 120], bordoBianco: 1 },
  cielo: {
    sfondi: [
      { arte: 'panorama_mucchio', raggio: 160, ripeti: 4, foschia: 0.2, y: -5, rotazione: 0.6 },
      { arte: 'panorama_colline', raggio: 230, ripeti: 3, foschia: 0.4, y: -9 },
    ],
    nuvole: 9,
    uccelli: 2,
    palloncini: 2,
    balena: { raggio: 120, altezza: 46, fase: 1.2 },
  },
  inquadrature: [
    // 1. di fianco lungo la riva (lampioni e fronde in primo piano scorrono davanti)
    { da: 0, a: 10.5, tipo: 'segui', taglio: true, chiavi: [
      { s: 0, pos: [0.4, 1.55, 6.4], guarda: [0.6, 0.9, 0], fov: 34 },
      { s: 10.5, pos: [-0.6, 1.8, 6.8], guarda: [0.8, 0.95, 0], fov: 34 },
    ] },
    // 2. il ponte visto dall'acqua: dietro di lui il canale si perde lontano
    { da: 10.5, a: 23.5, tipo: 'fisso', taglio: true, seguiAltezza: 1, chiavi: [
      { s: 10.5, pos: [16.0, 0.6, 10.5], guarda: [0, 0.7, 0], fov: 40 },
      { s: 23.5, pos: [18.2, 0.8, 10.0], guarda: [0, 0.7, 0], fov: 38 },
    ] },
    // 3. la via della libreria: la camera gira piano da tre quarti a di fianco
    { da: 23.5, a: 36.5, tipo: 'segui', taglio: true, chiavi: [
      { s: 23.5, pos: [-3.2, 1.6, 6.2], guarda: [1.6, 1.0, -0.6], fov: 35 },
      { s: 36.5, pos: [1.8, 1.6, 6.4], guarda: [0.4, 0.95, 0], fov: 35 },
    ] },
    // 4. la scala vista dal basso
    { da: 36.5, a: 42, tipo: 'segui', taglio: true, seguiAltezza: 1, chiavi: [
      { s: 36.5, pos: [2.6, -0.2, 3.9], guarda: [-0.3, 1.3, 0], fov: 42 },
    ] },
  ],
  attori: [
    { id: 'lepre', tipo: 'persona', arte: 'lepre', nome: 'La signora Lepre', x: 13.9, z: -0.5, dir: 1,
      chiacchiere: ['Che profumo di lavanda, oggi!'], scia: { ritmo: 2, forma: 13, colori: ['#c7b2e6', '#e3d4f3'], su: 0.3, velocita: 0.2, vita: 2, dim: 0.12, altezza: 1.3 } },
    { id: 'uccello', tipo: 'persona', arte: 'uccello', nome: 'Il signor Pennuto', x: 16.4, z: -0.55, chiacchiere: ['Ehm ehm!'] },
    { id: 'cavallo', tipo: 'persona', arte: 'cavallo', nome: 'Il Cavallo', x: 20.2, z: -0.5, dir: -1, chiacchiere: ['Mmh.'] },
    { id: 'nonna', tipo: 'persona', arte: 'nonna', nome: 'Nonna Pecora', x: 25.2, z: -0.8, chiacchiere: ['Che bella giornata per una passeggiata.'] },
    { id: 'tigre', tipo: 'persona', arte: 'tigre', nome: 'La Tigre', x: 31.0, z: -0.9, dir: -1, chiacchiere: ['Shh... sto leggendo.'] },
    { id: 'barca1', tipo: 'veicolo', arte: 'auto_rossa', da: [14.6, -40], a: [14.6, 7.5], y: -1.3, velocita: 1.1, galleggia: true, parti: 0.3 },
    { id: 'barca2', tipo: 'veicolo', arte: 'auto_gialla', da: [19.2, 7.5], a: [19.2, -40], y: -1.3, velocita: 0.9, galleggia: true, parti: 0.6 },
    { id: 'barca3', tipo: 'veicolo', arte: 'auto_blu', da: [17.0, -40], a: [17.0, 7.5], y: -1.3, velocita: 0.7, galleggia: true, parti: 0.85, scala: 0.8 },
  ],
  oggetti: [
    { arte: 'pila_libri', x: 27.8, z: -1.6, scala: 1.3 },
    { arte: 'libro_volante', x: 29.0, z: -1.2, y: 2.4, animazione: 6, oscilla: 0.03 },
    { arte: 'vaso_lavanda', x: 13.0, z: -0.62, scala: 1.2 },
  ],
  porte: [
    { id: 'porta_libreria', s: 29.5, raggio: 0.7, verso: 'libreria', arrivo: 'ingresso', bloccata: 'La libreria è chiusa. Forse la Tigre sa qualcosa...', campanello: true },
  ],
  interazioni: [
    { id: 'scala', s: 40.6, raggio: 0.8, etichetta: 'Sali' },
  ],
  effetti: [
    // luccichii sull'acqua
    { x: 17, y: -1.1, z: -6, ritmo: 3, forma: 'scintilla', colori: ['#ffffff', '#dff3ff'], su: 0.05, velocita: 0.05, vita: 1.2, dim: 0.12, sparpaglia: 5 },
  ],
  suoni: [{ tipo: 'acqua', x: 17, y: -4, volume: 0.2 }],
};
