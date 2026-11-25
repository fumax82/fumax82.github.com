/* ==========================================================================
 *  via.js — LA VIA DEL CAFFÈ (prologo e capitolo 1)
 *  --------------------------------------------------------------------------
 *  La strada dove Lia passeggia con Biscotto: case colorate, il caffè,
 *  gli alberi sul marciapiede, il percorso tattile giallo per chi non vede.
 *  In fondo, nell'angolo in ombra, la staccionata di legno con il buco
 *  in cui sparisce Biscotto.
 *
 *  Legenda (vedi dati/tipi.js): lettere maiuscole = muri, '.' marciapiede,
 *  ':' percorso tattile, ',' asfalto, '=' asfalto con la riga, ' ' il bianco.
 *  La prima riga è il nord; x cresce verso est.
 * ========================================================================== */

const NORD = 'GGGGHMMMMAAABAAKKKCCCVVVVRRRRZZZZGSSSSUTSSSS';
const NORD_DIETRO = 'GGGGHMMMMAAABAAKKKCCCVVVVRRRRZZZZGSSSS  SSSS';
const SUD = 'ZZZZCCCCRRRGGGHMMMMAAABAAAVVVVCCCCZZZSSSSSSS';
const riga = (c) => c.repeat(44);

export default {
  id: 'via',
  nome: 'Via del Caffè',

  mappa: [
    NORD_DIETRO, NORD_DIETRO, NORD_DIETRO, // 0-2 case a nord (dietro la staccionata: il bianco)
    NORD,                                   // 3 facciate a nord
    riga('.'),                              // 4 marciapiede
    riga(':'),                              // 5 percorso tattile
    riga(','),                              // 6 strada
    riga('='),                              // 7 riga di mezzeria
    riga(','),                              // 8 strada
    riga('.'),                              // 9 marciapiede sud
    SUD, SUD, SUD, SUD,                     // 10-13 case a sud
  ],

  atmosfera: {
    nebbiaColore: '#f6eedf',
    nebbia: [12, 40],
    sole: [0.5, 0.8, 0.35],
    coloreCielo: 1,
    bordoBianco: 0,
  },

  cielo: {
    sfondi: [
      { arte: 'panorama_colline', raggio: 120, ripeti: 4, foschia: 0.35, y: -3 },
      { arte: 'panorama_citta', raggio: 85, ripeti: 4, foschia: 0.12, y: -4 },
    ],
    nuvole: 10,
    uccelli: 2,
  },

  musica: 'passeggiata',
  suoni: [{ tipo: 'citta', volume: 0.06 }],

  arrivi: {
    inizio: { x: 3.5, y: 4.55, angolo: 0 },
  },

  interazioni: [
    { id: 'buco', x: 38.5, y: 4.3, raggio: 1.5, etichetta: 'Tocca' },
    { id: 'passaggio', x: 38.5, y: 4.3, raggio: 1.6, etichetta: 'Attraversa' },
  ],

  oggetti: [
    // alberi sul marciapiede sud
    { tipo: 'albero', x: 6.5, y: 9.55 },
    { tipo: 'albero', x: 13.2, y: 9.55 },
    { tipo: 'albero', x: 21.5, y: 9.55 },
    { tipo: 'albero', x: 29.5, y: 9.55 },
    // lampioni
    { tipo: 'lampione', x: 8.5, y: 4.18 },
    { tipo: 'lampione', x: 24.5, y: 4.18 },
    { tipo: 'lampione', x: 17.5, y: 9.82 },
    { tipo: 'lampione', x: 33.5, y: 9.82 },
    // fiori e vasi
    { tipo: 'cassetta_fiori', x: 2.5, y: 4.15 },
    { tipo: 'cassetta_fiori', x: 10.5, y: 4.15 },
    { tipo: 'cassetta_fiori', x: 19.5, y: 4.15 },
    { tipo: 'alberello', x: 34.9, y: 4.22 },
    { tipo: 'vaso_foglie', x: 36.1, y: 4.18 },
    { tipo: 'vaso_lavanda', x: 36.8, y: 4.18 },
    { tipo: 'vaso_bonsai', x: 37.5, y: 4.2 },
    // arredo
    { tipo: 'panchina', x: 19.5, y: 9.78 },
    { tipo: 'bidone', x: 27.5, y: 9.8 },
    { tipo: 'bicicletta', x: 11.2, y: 9.8 },
    // edera e fiori che pendono dalle facciate (appoggiati al muro: "piatto")
    { tipo: 'edera', x: 22.5, y: 4.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 30.5, y: 4.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 10.5, y: 4.02, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 2.5, y: 9.98, z: 3.1, piatto: 0 },
    { tipo: 'edera', x: 35.5, y: 9.98, z: 3.1, piatto: 0 },
  ],

  attori: [
    { id: 'biscotto', tipo: 'animale', arte: 'biscotto', nome: 'Biscotto', x: 4.4, y: 4.75, velocita: 3.6 },
    { id: 'ladro', tipo: 'attore', arte: 'ladro', nome: 'Il ladro', x: 47, y: 4.45, angolo: Math.PI, velocita: 1.3, visibile: false },
    {
      id: 'signora', tipo: 'persona', arte: 'signora', nome: 'Una signora profumata',
      x: 30, y: 9.45, ronda: [[30, 9.45], [3, 9.45]], velocita: 0.75,
      scia: { forma: [3, 13], colori: ['#f7b6d0', '#e9a3e0', '#ffd1e8'], ritmo: 4, velocita: 0.25, su: 0.2, vita: 2.8, dim: 0.13, vortice: 0.5, altezza: 1.2 },
      chiacchiere: ['Buongiorno piccola! Che bel cagnolino.', 'Ti piace il mio profumo? Si chiama «Giardino di primavera».'],
    },
    {
      id: 'signore', tipo: 'persona', arte: 'signore', nome: 'Il signore con la pipa',
      x: 16.6, y: 4.38,
      scia: { forma: [9, 14], colori: ['#ffffff', '#efe9f3'], ritmo: 2.5, su: 0.45, velocita: 0.12, vita: 3.5, dim: 0.34, altezza: 1.45, vortice: 0.15 },
      chiacchiere: ['Mmm... il caffè qui è il migliore della città.', 'Attenta a dove vai, piccola. C\'è gente strana in giro, oggi.'],
    },
    { id: 'piccioni', tipo: 'piccioni', x: 13, y: 5.5, quanti: 5 },
    { id: 'auto_rossa', tipo: 'veicolo', arte: 'auto_rossa', x: -3, y: 8.4, da: -4, a: 48, velocita: 2.6 },
    { id: 'autobus', tipo: 'veicolo', arte: 'autobus', x: 50, y: 6.6, da: 50, a: -8, velocita: 1.8 },
  ],
};
