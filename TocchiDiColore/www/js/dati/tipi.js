/* ==========================================================================
 *  tipi.js — LEGENDA DELLE MAPPE E TIPI DI OGGETTI
 *  --------------------------------------------------------------------------
 *  Le mappe dei luoghi (cartella dati/luoghi) sono disegnate con caratteri.
 *  Qui si stabilisce che cosa vuol dire ogni carattere:
 *    - lettere MAIUSCOLE e cifre: MURI (il nome è quello della texture)
 *    - minuscole e simboli: PAVIMENTI
 *  Un luogo può aggiungere o cambiare caratteri con la sua "legenda".
 * ========================================================================== */

/** Muri: carattere → nome della texture (l'altezza la decide la texture). */
export const MURI = {
  A: 'casa_arancio',
  B: 'casa_arancio_porta',
  G: 'casa_gialla',
  H: 'casa_gialla_porta',
  R: 'casa_rosa',
  Z: 'casa_azzurra',
  V: 'casa_verde',
  C: 'casa_crema',
  M: 'mattoni',
  K: 'caffe',
  F: 'forno_porta',
  W: 'forno_vetrina',
  X: 'forno_mattoni',
  L: 'libreria',
  P: 'libreria_porta',
  S: 'muro_sera',
  T: 'staccionata',
  U: 'staccionata_buco',
  Q: 'muro_vicolo',
  N: 'muretto',
  E: 'muretto_mattoni',
  Y: 'casa_gialla_finestra',
  J: 'siepe',
  I: 'forno_interno',
  O: 'forno_forno',
  D: 'forno_finestra',
  1: 'libreria_scaffali',
  2: 'libreria_finestra',
};

/**
 * Pavimenti: carattere → { texture, quota (altezza del suolo), calpestabile, animato }
 * La "quota" crea marciapiedi rialzati e il canale più basso della strada.
 */
export const PAVIMENTI = {
  '.': { texture: 'marciapiede', quota: 0.08 },
  ':': { texture: 'tattile', quota: 0.08 },
  ',': { texture: 'asfalto', quota: 0 },
  '=': { texture: 'asfalto_riga', quota: 0 },
  r: { texture: 'mattonelle_rosa', quota: 0.04 },
  n: { texture: 'mattonelle_rosa', quota: 0.3 },   // il ponte sul canale
  c: { texture: 'ciottoli', quota: 0.04 },
  v: { texture: 'vicolo', quota: 0.02 },
  '~': { texture: 'acqua', quota: -0.22, calpestabile: false, animato: true },
  g: { texture: 'erba', quota: 0.02 },
  p: { texture: 'parquet', quota: 0 },
  t: { texture: 'cotto', quota: 0 },
  ' ': { texture: null, quota: 0, calpestabile: false }, // il bianco: niente
};

/**
 * Tipi di oggetti decorativi.
 *   arte:      nome dell'immagine (dai moduli oggetti.js / cielo.js)
 *   solido:    Lia non lo attraversa (raggio = ingombro)
 *   ombra:     raggio dell'ombra a terra (0 = nessuna)
 *   oscilla:   quanto ondeggia al vento (alberi, edera)
 *   z:         altezza da terra (oggetti appesi o sopra un bancone)
 *   scala:     ingrandimento rispetto alla dimensione normale
 *   animazione:fotogrammi al secondo (se l'immagine ha f0, f1, ...)
 *   luce:      quanto è visibile anche quando Lia non lo percepisce
 */
export const OGGETTI = {
  albero:         { arte: 'albero', solido: true, raggio: 0.3, ombra: 1.1, oscilla: 0.025, animazione: 0 },
  alberello:      { arte: 'alberello', solido: true, raggio: 0.3, ombra: 0.45, oscilla: 0.02 },
  vaso_bonsai:    { arte: 'vaso_bonsai', solido: true, raggio: 0.2, ombra: 0.25 },
  vaso_lavanda:   { arte: 'vaso_lavanda', solido: true, raggio: 0.18, ombra: 0.22, oscilla: 0.03 },
  vaso_foglie:    { arte: 'vaso_foglie', solido: true, raggio: 0.2, ombra: 0.25, oscilla: 0.02 },
  cassetta_fiori: { arte: 'cassetta_fiori', solido: true, raggio: 0.25, ombra: 0.3 },
  lampione:       { arte: 'lampione', solido: true, raggio: 0.1, ombra: 0.25 },
  bidone:         { arte: 'bidone', solido: true, raggio: 0.22, ombra: 0.28 },
  panchina:       { arte: 'panchina', solido: true, raggio: 0.4, ombra: 0.5 },
  bicicletta:     { arte: 'bicicletta', solido: true, raggio: 0.35, ombra: 0.4 },
  edera:          { arte: 'edera_pendente', ancoraAlto: true, oscilla: 0.04, animazione: 0.6 },
  cancello:       { arte: 'cancello', solido: true, raggio: 0.5, ombra: 0 },
  cesto_baguette: { arte: 'cesto_baguette', solido: true, raggio: 0.2, ombra: 0.22 },
  pagnotta:       { arte: 'pagnotta', ombra: 0.12 },
  pane_tondo:     { arte: 'pane_tondo', ombra: 0.1 },
  ciambella:      { arte: 'ciambella', ombra: 0.08 },
  baguette:       { arte: 'baguette', ombra: 0.1 },
  bancone:        { arte: 'bancone', solido: true, raggio: 0.7, ombra: 0.8 },
  forno_fuoco:    { arte: 'forno_fuoco', animazione: 8, luce: 1 },
  lampada:        { arte: 'lampada_appesa', ancoraAlto: true, luce: 0.6, oscilla: 0.01 },
  pila_libri:     { arte: 'pila_libri', solido: true, raggio: 0.2, ombra: 0.22 },
  poltrona:       { arte: 'poltrona', solido: true, raggio: 0.4, ombra: 0.45 },
  tronco_cavo:    { arte: 'tronco_cavo', solido: true, raggio: 0.35, ombra: 0.4 },
  bastone:        { arte: 'bastone', ombra: 0.1, luce: 0.5 },
  bacchetta:      { arte: 'bacchetta', animazione: 3, luce: 1 },
  borsa:          { arte: 'borsa', ombra: 0.15 },
  chiave:         { arte: 'chiave', luce: 0.8 },
};
