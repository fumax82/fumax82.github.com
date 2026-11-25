/* ==========================================================================
 *  oltre.js — LA CITTÀ IMMAGINATA (capitoli 2, 3, 4, 5)
 *  --------------------------------------------------------------------------
 *  Il mondo oltre la staccionata, come lo immagina Lia:
 *    - a ovest la PIAZZETTA DEL PANE, con il forno di mattoni rosa
 *    - il VICOLO DEL GATTINO, stretto tra muri rosa coperti d'edera
 *    - il CANALE: la strada è diventata acqua e le auto galleggiano;
 *      sul PONTE stanno gli abitanti-animali
 *    - la LIBRERIA della tigre, sulla riva nord
 *    - la TERRAZZA in fondo, da cui si chiama la balena del cielo
 *
 *  Legenda in più rispetto alla via: 'r' mattonelle rosa, 'n' ponte,
 *  '~' acqua, 'v' vicolo, 'c' ciottoli. La staccionata (T, U) a ovest è la
 *  stessa della via, vista dall'altra parte.
 * ========================================================================== */

const NORD = 'RRRRRRRRRZZZZZGGGGCCCCZZZZZLPLVVVVVAAAAA';                      // 0-2
const RIVA = 'RRRR' + 'r'.repeat(36);                                         // 3 e 7
const ACQUA = 'RRRR' + '~'.repeat(20) + 'nn' + '~'.repeat(14);                // 4-6
const BLOCCO = 'MM' + 'XXXXXXXXX' + 'Q' + 'vv' + 'Q' + 'CCCCCVVVVVRRRRRGGGGG' + 'cccc' + 'E'; // 8-11
const BLOCCO_FINE = 'MM' + 'XXXXXXXXX' + 'Q' + 'vv' + 'Q' + 'CCCCCVVVVVRRRRRGGGGG' + 'EEEE' + 'E'; // 12
const FORNO = 'MM' + 'XX' + 'F' + 'WW' + 'X' + 'HGG' + 'Q' + 'vv' + 'Q' + 'AAAAAA' + 'M'.repeat(19); // 13
const PIAZZA = (c) => 'M' + c + 'r'.repeat(19) + 'V' + 'M'.repeat(18);       // 14-24
const SUD = 'MM' + 'RRRR' + 'YYYY' + 'CCC' + 'ZZZZ' + 'RRRR' + 'M'.repeat(19); // 25-29

export default {
  id: 'oltre',
  nome: 'La città oltre la staccionata',

  mappa: [
    NORD, NORD, NORD,
    RIVA,
    ACQUA, ACQUA, ACQUA,
    RIVA,
    BLOCCO, BLOCCO, BLOCCO, BLOCCO,
    BLOCCO_FINE,
    FORNO,
    PIAZZA('T'), PIAZZA('T'), PIAZZA('T'), PIAZZA('T'), PIAZZA('T'),
    PIAZZA('U'),
    PIAZZA('T'), PIAZZA('T'), PIAZZA('T'), PIAZZA('T'), PIAZZA('T'),
    SUD, SUD, SUD, SUD, SUD,
  ],

  atmosfera: {
    nebbiaColore: '#fbf4e6',
    nebbia: [11, 36],
    sole: [0.4, 0.85, 0.3],
    coloreCielo: 1,
    bordoBianco: 1,
  },

  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 125, ripeti: 4, foschia: 0.3, y: -3 },
      { arte: 'panorama_mucchio', raggio: 75, ripeti: 4, foschia: 0.05, y: -6 },
    ],
    nuvole: 12,
    uccelli: 2,
    balena: true,
    palloncini: 3,
  },

  musica: 'citta',
  suoni: [
    { tipo: 'acqua', x: 12, y: 5, volume: 0.16 },
    { tipo: 'acqua', x: 32, y: 5, volume: 0.16 },
  ],

  arrivi: {
    ingresso: { x: 2.7, y: 19.5, angolo: 0 },
    dal_forno: { x: 4.5, y: 14.7, angolo: Math.PI / 2 },
    dalla_libreria: { x: 28.5, y: 3.5, angolo: Math.PI / 2 },
    terrazza: { x: 36.5, y: 9.5, angolo: 0 },
  },

  porte: [
    { id: 'porta_forno', x: 4.5, y: 14.3, raggio: 1.1, etichetta: 'Entra nel forno', verso: 'forno', arrivo: 'ingresso', campanello: true, bloccata: 'La porta è chiusa... dentro qualcuno canticchia.' },
    { id: 'porta_libreria', x: 28.5, y: 3.4, raggio: 1.1, etichetta: 'Entra in libreria', verso: 'libreria', arrivo: 'ingresso', campanello: true, bloccata: 'La libreria è chiusa. Si sente il fruscio di tante pagine.' },
  ],

  interazioni: [
    { id: 'gattino', x: 0, y: 0, raggio: 1.4, etichetta: 'Accarezza', segue: 'gattino' },
    { id: 'terrazza', x: 37, y: 9.6, raggio: 2.2, etichetta: 'Chiama la balena' },
  ],

  oggetti: [
    // --- piazzetta del pane ---
    { tipo: 'albero', x: 3.4, y: 23.4 },
    { tipo: 'albero', x: 19.4, y: 15.3 },
    { tipo: 'albero', x: 11.5, y: 23.6, scala: 0.9 },
    { tipo: 'lampione', x: 8.6, y: 14.25 },
    { tipo: 'lampione', x: 16.4, y: 23.8 },
    { tipo: 'panchina', x: 14.5, y: 23.7 },
    { tipo: 'panchina', x: 6.5, y: 23.7 },
    { tipo: 'vaso_lavanda', x: 2.5, y: 14.2 },
    { tipo: 'vaso_foglie', x: 9.4, y: 14.2 },
    { tipo: 'cesto_baguette', x: 7.3, y: 14.22 },
    { tipo: 'cancello', x: 18.3, y: 24.62, piatto: 0 },
    { tipo: 'cassetta_fiori', x: 2.6, y: 24.6 },
    // pani che fluttuano davanti alla vetrina (l'immaginazione di Lia)
    { tipo: 'pagnotta', x: 5.5, y: 14.35, z: 1.55, fluttua: 0.12, luce: 0.3 },
    { tipo: 'pane_tondo', x: 6.4, y: 14.3, z: 1.25, fluttua: 0.1, luce: 0.3 },
    { tipo: 'ciambella', x: 6.0, y: 14.45, z: 1.95, fluttua: 0.15, luce: 0.3 },
    { tipo: 'baguette', x: 5.0, y: 14.4, z: 2.15, fluttua: 0.1, luce: 0.3 },
    // --- vicolo del gattino ---
    { tipo: 'bidone', x: 12.3, y: 9.3 },
    { tipo: 'edera', x: 12.03, y: 10.5, z: 2.4, piatto: Math.PI / 2 },
    { tipo: 'edera', x: 13.97, y: 12.0, z: 2.4, piatto: Math.PI / 2 },
    { tipo: 'vaso_bonsai', x: 13.6, y: 8.4 },
    // --- canale ---
    { tipo: 'lampione', x: 8.5, y: 3.2 },
    { tipo: 'lampione', x: 20.5, y: 3.2 },
    { tipo: 'lampione', x: 16.5, y: 7.82 },
    { tipo: 'lampione', x: 31.5, y: 7.82 },
    { tipo: 'albero', x: 12.5, y: 3.3, scala: 0.9 },
    { tipo: 'albero', x: 34.0, y: 3.3, scala: 0.95 },
    { tipo: 'alberello', x: 6.5, y: 7.8 },
    { tipo: 'cassetta_fiori', x: 22.3, y: 7.85 },
    { tipo: 'edera', x: 17.5, y: 2.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 33.0, y: 2.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 9.5, y: 7.98, z: 3.1, piatto: 0 },
    // --- terrazza ---
    { tipo: 'panchina', x: 36.6, y: 11.6 },
    { tipo: 'vaso_lavanda', x: 35.4, y: 11.6 },
    { tipo: 'vaso_foglie', x: 38.5, y: 8.4 },
  ],

  attori: [
    {
      id: 'fornaia', tipo: 'persona', arte: 'fornaia', nome: 'La fornaia', x: 3.6, y: 14.55, visibile: false,
      scia: { forma: [6, 0], colori: ['#f2d49a', '#e8b878', '#fff3d6'], ritmo: 3, velocita: 0.2, su: 0.3, vita: 2.5, dim: 0.12, vortice: 0.4, altezza: 1.0 },
      chiacchiere: ['Il pane è il profumo più buono del mondo, non trovi?', 'Torna quando vuoi, streghetta!'],
    },
    {
      id: 'lepre', tipo: 'persona', arte: 'lepre', nome: 'La signora Lepre', x: 24.3, y: 4.25,
      scia: { forma: [13, 3], colori: ['#c9a8ec', '#b48fe0', '#e7d3fb'], ritmo: 3, velocita: 0.2, su: 0.25, vita: 3, dim: 0.13, vortice: 0.5, altezza: 1.3 },
      chiacchiere: ['Che bella giornata per una passeggiata sul ponte!', 'La lavanda calma il cuore, piccola.'],
    },
    {
      id: 'uccello', tipo: 'persona', arte: 'uccello', nome: 'Il signor Piumato', x: 24.3, y: 4.95,
      chiacchiere: ['Ehm ehm! Il cilindro? Un regalo di mio nonno.', 'Da quassù sul ponte vedo tutto quello che passa!'],
    },
    {
      id: 'cavallo', tipo: 'persona', arte: 'cavallo', nome: 'Il Cavallo', x: 24.3, y: 5.65,
      chiacchiere: ['Mmh. (mastica un filo d\'erba)', 'Dall\'alto si vede tutto, piccola. Tutto.'],
    },
    {
      id: 'nonna', tipo: 'persona', arte: 'nonna', nome: 'Nonna Gelsomina', x: 24.3, y: 6.35,
      chiacchiere: ['Ai miei tempi la balena del cielo passava ogni giorno a mezzogiorno...', 'Che cappello buffo! Mi ricorda quando ero bambina.'],
    },
    {
      id: 'tigre', tipo: 'persona', arte: 'tigre', nome: 'La Tigre libraia', x: 29.7, y: 3.35,
      chiacchiere: ['Shh... sto leggendo il capitolo più bello.', 'Un buon libro è come un viaggio, sai?'],
    },
    { id: 'gattino', tipo: 'animale', arte: 'gattino', nome: 'Il gattino', x: 12.9, y: 13.4, verso: 'miagolio', velocita: 2.4, visibile: false, ombra: 0.16 },
    { id: 'piccioni', tipo: 'piccioni', x: 11, y: 19.5, quanti: 6 },
    { id: 'auto_blu', tipo: 'veicolo', arte: 'auto_blu', x: 37, y: 5.05, da: 37.6, a: 27.3, velocita: 1.3, galleggia: true, pingpong: true },
    { id: 'auto_gialla', tipo: 'veicolo', arte: 'auto_gialla', x: 6, y: 5.45, da: 5.4, a: 22.6, velocita: 1.7, galleggia: true, pingpong: true },
  ],
};
