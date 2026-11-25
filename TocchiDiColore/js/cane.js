/* ==========================================================================
 *  cane.js — BISCOTTO, IL CANE ("cane" = dog; il "bastone" è quello di Lia)
 *  --------------------------------------------------------------------------
 *  Biscotto segue un percorso fatto di tappe (vedi ambientazione.js):
 *    - "attesa": aspetta alla tappa e abbaia ogni tanto
 *    - "corsa":  quando Lia si avvicina, corre alla tappa successiva
 *    - "finale": all'ultima tappa aspetta Lia con la borsa ritrovata
 *  Ogni abbaio crea un'onda che colora i dintorni: è così che Lia lo trova.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const K = {
    x: 0,
    y: 0,
    angolo: 0,
    stato: 'attesa',
    tappa: 0,
    timerAbbaio: 1.5,
    tempoAbbaio: 0,     // > 0 mentre ha la bocca aperta
    tempoAnimazione: 0,
    def: null,
    eventi: [],         // messaggi per main.js ('fuga', ...)
  };

  K.inizializza = function (def) {
    this.def = def;
    this.tappa = 0;
    this.x = def.percorso[0][0];
    this.y = def.percorso[0][1];
    this.angolo = Math.PI;
    this.stato = 'attesa';
    this.timerAbbaio = 1.2;
  };

  K.aggiorna = function (dt, giocatore, mondo) {
    this.tempoAnimazione += dt;
    this.tempoAbbaio = Math.max(0, this.tempoAbbaio - dt);
    const distanzaLia = U.distanza(this.x, this.y, giocatore.x, giocatore.y);

    if (this.stato === 'attesa' || this.stato === 'finale') {
      // guarda verso Lia e abbaia ogni tanto
      this.angolo = U.interpolaAngolo(this.angolo, Math.atan2(giocatore.y - this.y, giocatore.x - this.x), Math.min(1, dt * 4));
      this.timerAbbaio -= dt;
      if (this.timerAbbaio <= 0) {
        this.abbaia(mondo);
        this.timerAbbaio = this.stato === 'finale' ? 2.2 : 3.0 + Math.random() * 1.5;
      }
      // Lia è vicina: si riparte verso la tappa successiva
      if (this.stato === 'attesa' && distanzaLia < this.def.distanzaFuga) {
        this.tappa++;
        this.stato = 'corsa';
        this.abbaia(mondo);
        this.eventi.push('fuga');
      }
    } else if (this.stato === 'corsa') {
      const [tx, ty] = this.def.percorso[this.tappa];
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      const passo = this.def.velocita * dt;
      this.angolo = Math.atan2(dy, dx);
      if (d <= passo) {
        this.x = tx;
        this.y = ty;
        this.stato = this.tappa === this.def.percorso.length - 1 ? 'finale' : 'attesa';
        this.timerAbbaio = 0.5;
      } else {
        this.x += (dx / d) * passo;
        this.y += (dy / d) * passo;
      }
    }
  };

  K.abbaia = function (mondo) {
    this.tempoAbbaio = 0.3;
    mondo.creaOnda(this.x, this.y, CFG.onde.abbaio);
    if (G.Audio) G.Audio.abbaio(this.x, this.y);
  };

  /** Biscotto sta aspettando Lia all'ultima tappa? */
  K.eArrivato = function () {
    return this.stato === 'finale';
  };

  /** Immagine da disegnare vista da una telecamera in (camX, camY). */
  K.spriteCorrente = function (camX, camY) {
    const v = U.vistaDaAngolo(this.angolo, this.x - camX, this.y - camY);
    const abbaia = this.tempoAbbaio > 0;
    let nome;
    if (v.vista === 'lato') {
      let f = 0;
      if (this.stato === 'corsa') f = 1 + (Math.floor(this.tempoAnimazione * 10) % 2);
      else if (abbaia) f = 3;
      nome = 'cane_lato_' + f;
    } else if (v.vista === 'fronte') {
      nome = 'cane_fronte_' + (abbaia ? 1 : 0);
    } else {
      nome = 'cane_retro_' + (Math.floor(this.tempoAnimazione * 6) % 2);
    }
    return { nome, specchio: v.specchio };
  };

  G.Cane = K;
})();
