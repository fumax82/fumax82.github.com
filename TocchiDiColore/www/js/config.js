/* ==========================================================================
 *  config.js — PARAMETRI DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Tutti i "numeri" regolabili, raccolti in un solo posto.
 *  Unità di misura: 1 casella della mappa = 1 unità (circa 1,5 metri).
 *  Lia è alta circa 0.85 unità, le case circa 3.2.
 * ========================================================================== */

export const CONFIG = {
  /* ---------------------------------------------------------------------
   * GRAFICA
   * ------------------------------------------------------------------- */
  grafica: {
    // Qualità: 'auto' sceglie da sola in base alla velocità del dispositivo
    qualita: 'auto',
    preimpostazioni: {
      alta:  { pixelRatio: 1.6, scala: 1.0, campioni: 4 },
      media: { pixelRatio: 1.25, scala: 1.0, campioni: 2 },
      bassa: { pixelRatio: 1.0, scala: 0.8, campioni: 0 },
    },
    campoVisivo: 60,         // gradi (verticale)
    nebbia: [9, 34],         // distanza a cui inizia e finisce la foschia
    schizzo: 0.6,            // quanto si vedono i tratti a matita delle cose non percepite
    effettiAcquerello: true, // filtro acquerello a tutto schermo
  },

  /* ---------------------------------------------------------------------
   * GIOCATRICE (Lia)
   * ------------------------------------------------------------------- */
  giocatore: {
    velocita: 1.7,
    velocitaCorsa: 2.9,
    velocitaRotazione: 2.3,  // frecce (radianti/s)
    sensibilitaTouch: 0.0065,
    sensibilitaMouse: 0.0024,
    raggio: 0.2,
    gradinoMassimo: 0.36,    // dislivello superabile camminando (marciapiedi, ponte)
    distanzaInterazione: 1.5,
  },

  /* ---------------------------------------------------------------------
   * TELECAMERA
   * ------------------------------------------------------------------- */
  camera: {
    altezzaOcchi: 0.7,
    oscillazionePasso: 0.018,
    durataTransizione: 0.6,
    terza: { distanza: 2.5, altezza: 1.45, inclinazione: -0.22, morbidezza: 6 },
    inclinazioneMassima: 0.9,
  },

  /* ---------------------------------------------------------------------
   * ONDE DI PERCEZIONE ("toc toc" del bastone, abbai, suoni...)
   * ------------------------------------------------------------------- */
  onde: {
    bastone:   { velocita: 7.5, raggio: 10, forza: 0.85, colore: '#ffd36b', livello: 1.0 },
    passo:     { velocita: 4.5, raggio: 2.2, forza: 0.25, colore: '#ffffff', livello: 0.9 },
    abbaio:    { velocita: 6.0, raggio: 6.5, forza: 0.7, colore: '#ffb27a', livello: 0.95 },
    profumo:   { velocita: 3.0, raggio: 5.0, forza: 0.55, colore: '#f7a8c8', livello: 0.95 },
    suono:     { velocita: 5.0, raggio: 5.5, forza: 0.5, colore: '#a8d8ff', livello: 0.9 },
    magia:     { velocita: 9.0, raggio: 60, forza: 0.9, colore: '#fff0a8', livello: 1.0 },
  },
  ricaricaBastone: 0.4,

  /* ---------------------------------------------------------------------
   * PERCEZIONE (il mondo bianco che si colora)
   * ------------------------------------------------------------------- */
  percezione: {
    velocitaComparsa: 1.8,
    velocitaScomparsa: 0.12,
    durataRicordo: 40,        // secondi prima che un luogo percepito inizi a sbiadire
    livelloRicordo: 0.72,     // quanto resta colorato un luogo già visitato
    raggioTatto: 1.6,
  },

  /* ---------------------------------------------------------------------
   * AUDIO
   * ------------------------------------------------------------------- */
  audio: {
    musica: 0.55,
    effetti: 0.9,
  },
};
