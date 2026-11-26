/* ==========================================================================
 *  forno.js — DENTRO IL FORNO (capitolo 2)
 *  --------------------------------------------------------------------------
 *  Una stanza calda e piena di profumi: il bancone, i cesti di pane, il
 *  forno a legna che scoppietta. Gli interni sono tutti a colori: il
 *  profumo e il calore "disegnano" ogni cosa.
 * ========================================================================== */
export default {
  id: 'forno',
  arte: { modulo: 'scene_piazza', nome: 'forno' },
  musica: 'interno',
  percorso: [[0, 0, 0.2], [9, 0, 0.2]],
  // Lia cammina vicino al muro (come nel film) per poterlo toccare col bastone
  vicinoAlMuro: [{ da: 0, a: 20, d: 0.75 }],
  materiali: [
    { da: -2, a: 20, terra: 'ceramica' },
    { da: 2.5, a: 6.5, muro: 'legno', terra: 'ceramica' },
  ],
  arrivi: { ingresso: { s: 0.8, verso: 1 } },
  superficie: 'pietra',
  atmosfera: { tuttoVisibile: true, foschia: [30, 90], luce: '#fff4e6', bordoBianco: 0.3 },
  inquadrature: [
    // la camera accompagna Lia dentro la stanza, senza uscire dalle pareti
    { da: 0, a: 9, tipo: 'segui', taglio: true, anticipo: 0.5, limitiX: [1.6, 7.4], seguiAltezza: 0, chiavi: [
      { s: 0, pos: [0.5, 1.5, 3.1], guarda: [0.5, 1.0, -1.4], fov: 44 },
    ] },
  ],
  attori: [
    { id: 'fornaia_dentro', tipo: 'persona', arte: 'fornaia', nome: 'La fornaia', x: 4.6, z: -1.75, parla: true,
      chiacchiere: ['Torna quando vuoi, piccola streghetta!', 'Il segreto del pane? Pazienza e un forno caldo.'] },
  ],
  oggetti: [
    { arte: 'forno_fuoco', x: 8.75, z: -3.15, y: 0.42, scala: 1.0, luce: 1, animazione: 7 },   // fiamme vive dietro la bocca del forno
    { arte: 'lampada_appesa', x: 3.0, z: -0.6, y: 3.4, appeso: true, luce: 1, oscilla: 0.02 },
    { arte: 'lampada_appesa', x: 6.6, z: -0.6, y: 3.4, appeso: true, luce: 1, oscilla: 0.02 },
  ],
  porte: [
    { id: 'uscita_forno', s: 0.4, raggio: 0.7, etichetta: 'Esci', verso: 'piazza', arrivo: 'dal_forno', campanello: true },
  ],
  effetti: [
    { x: 8.7, y: 1.2, z: -2.6, ritmo: 6, forma: 'scintilla', colori: ['#ffd36b', '#ff9a5a', '#fff0a0'], su: 0.9, velocita: 0.3, vita: 1.4, dim: 0.08, luce: true },
    { x: 4.5, y: 1.3, z: -1.2, ritmo: 2, forma: 'fumo', colori: ['#fff4e2', '#f7e6cf'], su: 0.3, velocita: 0.08, vita: 3, dim: 0.28, vortice: 0.5 },
  ],
  suoni: [{ tipo: 'fuoco', x: 8.7, y: -2.6, volume: 0.22 }],
};
