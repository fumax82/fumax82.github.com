/* ==========================================================================
 *  config.js — PARAMETRI DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui sono raccolti in un solo posto tutti i "numeri" che regolano il gioco.
 *  Puoi modificarli liberamente per cambiare il comportamento del gioco
 *  senza toccare il resto del codice.
 *
 *  Unità di misura: le distanze sono in "caselle" della mappa
 *  (1 casella = un quadrato della griglia del mondo).
 * ========================================================================== */

// "Gioco" è l'unico oggetto globale: tutti i file del gioco ci aggiungono
// i propri moduli (Gioco.Config, Gioco.Mondo, Gioco.Renderer, ...).
window.Gioco = window.Gioco || {};

Gioco.Config = {
  /* ---------------------------------------------------------------------
   * GRAFICA
   * ------------------------------------------------------------------- */
  grafica: {
    altezzaRender: 220,     // righe di pixel dell'immagine interna (più basso = più veloce ma più sgranato)
    altezzaMinima: 150,     // con la qualità automatica il gioco può scendere fin qui
    qualitaAutomatica: true, // riduce da solo la risoluzione se il dispositivo fatica
    levigatura: true,       // true = immagine morbida "ad acquerello", false = pixel netti stile retrò
    campoVisivo: 54,        // campo visivo verticale in gradi
    nebbiaInizio: 3.5,      // distanza a cui le cose iniziano a sfumare nella carta
    nebbiaFine: 15,         // distanza a cui le cose spariscono del tutto
    distanzaMassima: 24,    // oltre questa distanza i raggi non vengono più calcolati
    schizzoIntensita: 0.42, // quanto si vedono i tratti a matita delle cose NON percepite (0 = invisibili)
    schizzoDistanza: 7.5,   // oltre questa distanza i tratti a matita svaniscono
  },

  /* ---------------------------------------------------------------------
   * GIOCATRICE (Lia)
   * ------------------------------------------------------------------- */
  giocatore: {
    velocita: 1.7,           // caselle al secondo camminando
    velocitaCorsa: 3.0,      // caselle al secondo correndo
    velocitaRotazione: 2.4,  // radianti al secondo (frecce sinistra/destra)
    sensibilitaMouse: 0.0024,
    sensibilitaTouch: 0.006,
    raggio: 0.2,             // "ingombro" per le collisioni
    inclinazioneMassima: 0.55, // quanto si può guardare in alto/in basso
    passiPerCasella: 1.6,    // quanti passi per ogni casella percorsa
  },

  /* ---------------------------------------------------------------------
   * TELECAMERA (prima e terza persona)
   * ------------------------------------------------------------------- */
  camera: {
    altezzaOcchi: 0.5,       // altezza degli occhi in prima persona (i muri delle case sono alti 1.6)
    oscillazionePasso: 0.012, // quanto "ondeggia" la vista camminando
    durataTransizione: 0.5,  // secondi per passare da una vista all'altra
    terza: {
      distanza: 1.9,         // distanza della telecamera dietro a Lia
      altezza: 0.8,          // altezza della telecamera
      inclinazione: 0.16,    // quanto la telecamera guarda verso il basso
      morbidezzaRotazione: 7, // più è alto, più la telecamera segue rapidamente le rotazioni
    },
  },

  /* ---------------------------------------------------------------------
   * ONDE DI PERCEZIONE
   * Ogni suono crea un'onda circolare che "colora" ciò che raggiunge.
   * ------------------------------------------------------------------- */
  onde: {
    bastone: { velocita: 6.5, raggio: 7.5, spessore: 0.6, forza: 0.95, colore: '#ffd977', livello: 1.0 },
    passo:   { velocita: 4.0, raggio: 1.7, spessore: 0.35, forza: 0.3, colore: '#ffffff', livello: 0.85 },
    abbaio:  { velocita: 5.0, raggio: 4.8, spessore: 0.5,  forza: 0.75, colore: '#ffbe85', livello: 0.9 },
    acqua:   { velocita: 3.0, raggio: 3.6, spessore: 0.45, forza: 0.55, colore: '#b9e6ff', livello: 0.85 },
    scintilla: { velocita: 2.2, raggio: 1.7, spessore: 0.3, forza: 0.7, colore: '#ffe07a', livello: 0.7 },
    finale:  { velocita: 9.0, raggio: 40, spessore: 1.4, forza: 0.8, colore: '#ffd6e8', livello: 1.0 },
  },
  ricaricaBastone: 0.45,     // secondi minimi tra un colpo di bastone e l'altro

  /* ---------------------------------------------------------------------
   * PERCEZIONE E MEMORIA
   * ------------------------------------------------------------------- */
  percezione: {
    velocitaComparsa: 2.2,   // quanto velocemente i colori appaiono
    velocitaScomparsa: 0.3,  // quanto velocemente i colori svaniscono
    durataRicordo: 22,       // secondi dopo i quali un luogo percepito torna sfumato
    livelloRicordoBase: 0.22, // quanto resta colorato un luogo già visitato
    livelloRicordoPerOggetto: 0.11, // ogni ricordo raccolto rende il mondo più colorato
    raggioTatto: 1.25,       // Lia "sente" sempre il terreno vicino a sé
    coloreCieloBase: 0.32,   // quanto è colorato il cielo all'inizio (0..1)
  },

  /* ---------------------------------------------------------------------
   * AUDIO
   * ------------------------------------------------------------------- */
  audio: {
    volume: 0.8,
  },
};
