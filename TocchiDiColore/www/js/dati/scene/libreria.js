/* ==========================================================================
 *  libreria.js — LA LIBRERIA DELLA TIGRE (capitolo 4)
 *  --------------------------------------------------------------------------
 *  Scaffali fino al soffitto, una poltrona, libri che volano come uccelli.
 *  Qui la Tigre racconta della Balena del Cielo.
 * ========================================================================== */
export default {
  id: 'libreria',
  arte: { modulo: 'scene_varie', nome: 'libreria' },
  musica: 'interno',
  percorso: [[0, 0, 0.2], [9, 0, 0.2]],
  arrivi: { ingresso: { s: 0.8, verso: 1 } },
  superficie: 'legno',
  atmosfera: { tuttoVisibile: true, foschia: [30, 90], luce: '#fff6ea', bordoBianco: 0.3 },
  inquadrature: [
    // la camera accompagna Lia dentro la stanza, senza uscire dalle pareti
    { da: 0, a: 9, tipo: 'segui', taglio: true, anticipo: 0.5, limitiX: [1.7, 7.3], seguiAltezza: 0, chiavi: [
      { s: 0, pos: [0.5, 1.5, 3.1], guarda: [0.5, 1.0, -1.4], fov: 44 },
    ] },
  ],
  attori: [
    { id: 'tigre_dentro', tipo: 'persona', arte: 'tigre', nome: 'La Tigre', x: 6.6, z: -1.3, parla: true,
      chiacchiere: ['Ogni libro è una finestra.', 'Shh... le pagine stanno dormendo.'] },
  ],
  oggetti: [
    { arte: 'poltrona', x: 7.8, z: -2.0, scala: 1.2 },
    { arte: 'libro_volante', x: 3.0, z: -1.2, y: 2.3, animazione: 6, oscilla: 0.04 },
    { arte: 'libro_volante', x: 5.6, z: -1.6, y: 2.8, animazione: 5, oscilla: 0.03, specchio: true },
    { arte: 'pila_libri', x: 1.6, z: -2.2, scala: 1.3 },
    { arte: 'lampada_appesa', x: 4.5, z: -0.6, y: 3.6, appeso: true, luce: 1, oscilla: 0.02 },
  ],
  porte: [
    { id: 'uscita_libreria', s: 0.4, raggio: 0.7, etichetta: 'Esci', verso: 'canale', arrivo: 'dalla_libreria', campanello: true },
  ],
  effetti: [
    // polvere dorata nella luce della finestra
    { x: 4.5, y: 1.6, z: -2.2, ritmo: 3, forma: 'punto', colori: ['#fff3c4', '#ffe7a0'], su: 0.04, velocita: 0.06, vita: 4, dim: 0.06, sparpaglia: 0.9, luce: true },
  ],
};
