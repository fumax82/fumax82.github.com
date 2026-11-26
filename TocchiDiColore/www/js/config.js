/* ==========================================================================
 *  config.js — PARAMETRI DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Tutti i "numeri" regolabili, raccolti in un solo posto.
 *  Unità di misura: 1 unità = circa 1 metro. Lia è alta circa 1,
 *  un piano di una casa circa 3.
 * ========================================================================== */

export const CONFIG = {
  /* ---------------------------------------------------------------------
   * GRAFICA
   * ------------------------------------------------------------------- */
  grafica: {
    // Qualità: 'auto' sceglie da sola in base alla velocità del dispositivo
    qualita: 'auto',
    // pixelRatio = risoluzione con cui si disegna il mondo (rispetto ai pixel "CSS");
    // uscita     = risoluzione dell'immagine finale sullo schermo (più alta: linee pulite);
    // campioni   = antialiasing (bordi lisci, senza "scalini" di pixel)
    preimpostazioni: {
      alta:  { pixelRatio: 2.0, uscita: 2.0, scala: 1.0, campioni: 4 },
      media: { pixelRatio: 1.6, uscita: 2.0, scala: 1.0, campioni: 4 },
      bassa: { pixelRatio: 1.25, uscita: 1.6, scala: 1.0, campioni: 4 },
      minima: { pixelRatio: 1.0, uscita: 1.25, scala: 1.0, campioni: 2 },   // solo per telefoni molto lenti
    },
    schizzo: 0.75,           // quanto si vedono i tratti a matita delle cose non percepite (0..1)
    effettiAcquerello: true, // filtro acquerello a tutto schermo
  },

  /* ---------------------------------------------------------------------
   * GIOCATRICE (Lia)
   * ------------------------------------------------------------------- */
  giocatore: {
    velocita: 0.95,          // camminata (metri al secondo): passetti da bambina
    velocitaCorsa: 2.2,      // corsa
    accelerazione: 5,        // quanto in fretta prende velocità
    frenata: 7,              // quanto in fretta si ferma
    tempoPerCorrere: 1.6,    // tenendo premuto per questi secondi, Lia comincia a correre
    distanzaInterazione: 1.2,
  },

  /* ---------------------------------------------------------------------
   * TELECAMERA
   * ------------------------------------------------------------------- */
  camera: {
    campoVisivo: 38,         // gradi (verticale): stretto come un obiettivo da cinema
    morbidezza: 2.6,         // quanto dolcemente la telecamera insegue Lia
    anticipo: 0.9,           // metri: l'inquadratura guarda un po' avanti, dove Lia va
  },

  /* ---------------------------------------------------------------------
   * ONDE DI PERCEZIONE ("toc toc" del bastone, abbai, suoni...)
   * ------------------------------------------------------------------- */
  onde: {
    bastone:   { velocita: 7.5, raggio: 10, forza: 0.85, colore: '#ffd36b', livello: 1.0 },
    passo:     { velocita: 4.5, raggio: 2.0, forza: 0.22, colore: '#ffffff', livello: 0.9 },
    abbaio:    { velocita: 6.0, raggio: 6.5, forza: 0.7, colore: '#ffb27a', livello: 0.95 },
    profumo:   { velocita: 3.0, raggio: 5.0, forza: 0.55, colore: '#f7a8c8', livello: 0.95 },
    suono:     { velocita: 5.0, raggio: 5.5, forza: 0.5, colore: '#a8d8ff', livello: 0.9 },
    magia:     { velocita: 9.0, raggio: 60, forza: 0.9, colore: '#fff0a8', livello: 1.0 },
    urto:      { velocita: 4.0, raggio: 3.2, forza: 0.8, colore: '#9fd08a', livello: 1.0 },
  },
  ricaricaBastone: 0.4,
  // Il dito sullo schermo: fin dove arriva il colpo (metri, misurati a terra)
  bacchetta: {
    portata: 2.4,          // il bastoncino: solo vicino a Lia
    portataMagica: 24,     // la bacchetta magica: quasi ovunque si veda
    distanzaCometa: 1.6,   // oltre questa distanza la magia vola come una cometa
  },

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
