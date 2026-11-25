/* ==========================================================================
 *  giocatore.js — LIA, LA PROTAGONISTA
 *  --------------------------------------------------------------------------
 *  Gestisce il movimento di Lia (con le collisioni contro muri e oggetti),
 *  i passi, il colpo di bastone e quale immagine mostrare in terza persona.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const DURATA_TOCCO = 0.35; // durata dell'animazione del bastone (secondi)

  const P = {
    x: 0,
    y: 0,
    angolo: 0,          // direzione dello sguardo (radianti)
    inclinazione: 0,    // guardare in alto (+) o in basso (-)
    inMovimento: false,
    faseP: 0,           // "contapassi": cresce camminando
    tempoTocco: 0,      // > 0 mentre il bastone sta battendo
    ricarica: 0,        // tempo prima di poter battere di nuovo
    distanzaPercorsa: 0,
    colpiBastone: 0,
  };

  P.inizializza = function (def) {
    this.x = def.x;
    this.y = def.y;
    this.angolo = def.angolo;
    this.inclinazione = 0;
  };

  /**
   * mov:     { avanti, laterale, rotazione, corsa } dai comandi
   * sguardo: { dx, dy } spostamento di mouse/dito (già moltiplicato per la sensibilità)
   */
  P.aggiorna = function (dt, mov, sguardo, mondo) {
    const C = CFG.giocatore;

    // --- Rotazione dello sguardo ---------------------------------------
    this.angolo += mov.rotazione * C.velocitaRotazione * dt + sguardo.dx;
    this.inclinazione = U.limita(this.inclinazione - sguardo.dy, -C.inclinazioneMassima, C.inclinazioneMassima);

    // --- Movimento -----------------------------------------------------
    let avanti = mov.avanti, laterale = mov.laterale;
    const intensita = Math.hypot(avanti, laterale);
    if (intensita > 1) { avanti /= intensita; laterale /= intensita; }
    const velocita = mov.corsa ? C.velocitaCorsa : C.velocita;
    const fx = Math.cos(this.angolo), fy = Math.sin(this.angolo);   // davanti
    const dx = (fx * avanti - fy * laterale) * velocita * dt;       // (-fy, fx) = destra
    const dy = (fy * avanti + fx * laterale) * velocita * dt;

    const primaX = this.x, primaY = this.y;
    this._muovi(dx, dy, mondo);
    const percorso = Math.hypot(this.x - primaX, this.y - primaY);
    this.inMovimento = percorso > 0.0005;
    this.distanzaPercorsa += percorso;

    // --- Passi: ogni passo fa un piccolo suono e una piccola onda --------
    const passoPrima = Math.floor(this.faseP);
    this.faseP += percorso * C.passiPerCasella;
    if (Math.floor(this.faseP) !== passoPrima) {
      if (G.Audio) G.Audio.passo(Math.floor(this.faseP) % 2);
      mondo.creaOnda(this.x, this.y, CFG.onde.passo);
    }

    // --- Timer del bastone ----------------------------------------------
    this.tempoTocco = Math.max(0, this.tempoTocco - dt);
    this.ricarica = Math.max(0, this.ricarica - dt);
  };

  /**
   * Movimento con collisioni "separate per asse": prima proviamo a
   * muoverci in orizzontale, poi in verticale. Così, contro un muro,
   * Lia scivola lungo di esso invece di fermarsi di colpo.
   */
  P._muovi = function (dx, dy, mondo) {
    const r = CFG.giocatore.raggio;
    if (!this._collide(this.x + dx, this.y, r, mondo)) this.x += dx;
    if (!this._collide(this.x, this.y + dy, r, mondo)) this.y += dy;
  };

  /** Lia (un quadratino di lato 2r) in (x, y) urterebbe qualcosa? */
  P._collide = function (x, y, r, mondo) {
    if (mondo.bloccato(x - r, y - r) || mondo.bloccato(x + r, y - r) ||
        mondo.bloccato(x - r, y + r) || mondo.bloccato(x + r, y + r)) return true;
    for (const o of mondo.solidi) {
      if (Math.hypot(x - o.x, y - o.y) < r + o.raggio) {
        // permettiamo comunque di allontanarsi da un oggetto in cui si è "dentro"
        if (Math.hypot(this.x - o.x, this.y - o.y) >= r + o.raggio) return true;
      }
    }
    return false;
  };

  /** Colpo di bastone: crea una grande onda di percezione. */
  P.tocca = function (mondo) {
    if (this.ricarica > 0) return false;
    this.ricarica = CFG.ricaricaBastone;
    this.tempoTocco = DURATA_TOCCO;
    this.colpiBastone++;
    // l'onda parte dalla punta del bastone, un po' davanti a Lia
    const px = this.x + Math.cos(this.angolo) * 0.35;
    const py = this.y + Math.sin(this.angolo) * 0.35;
    const ox = mondo.bloccato(px, py) ? this.x : px;
    const oy = mondo.bloccato(px, py) ? this.y : py;
    mondo.creaOnda(ox, oy, CFG.onde.bastone);
    if (G.Audio) G.Audio.bastone();
    return true;
  };

  /** Fase dell'animazione del bastone: 0 → 1 → 0 durante un colpo. */
  P.faseTocco = function () {
    return this.tempoTocco > 0 ? Math.sin((1 - this.tempoTocco / DURATA_TOCCO) * Math.PI) : 0;
  };

  /** Immagine da usare in terza persona, vista da una telecamera in (camX, camY). */
  P.spriteCorrente = function (camX, camY) {
    const v = U.vistaDaAngolo(this.angolo, this.x - camX, this.y - camY);
    let fotogramma = 0;
    if (this.tempoTocco > 0.08) fotogramma = 3;
    else if (this.inMovimento) fotogramma = [1, 0, 2, 0][Math.floor(this.faseP * 2) % 4];
    return { nome: 'lia_' + v.vista + '_' + fotogramma, specchio: v.specchio };
  };

  G.Giocatore = P;
})();
