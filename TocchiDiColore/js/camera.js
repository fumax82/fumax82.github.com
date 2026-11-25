/* ==========================================================================
 *  camera.js — TELECAMERA IN PRIMA E TERZA PERSONA
 *  --------------------------------------------------------------------------
 *  In PRIMA PERSONA la telecamera è negli occhi di Lia.
 *  In TERZA PERSONA si sposta dietro e sopra di lei, guarda un po' in basso
 *  e segue le rotazioni con un leggero ritardo (più cinematografico).
 *  Il passaggio tra le due viste è un'animazione morbida: il valore
 *  "transizione" va da 0 (prima persona) a 1 (terza persona).
 *  Se dietro a Lia c'è un muro, la telecamera si avvicina per non entrarci.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const C = {
    modo: 'prima',        // 'prima' o 'terza'
    x: 0,
    y: 0,
    z: 0.5,               // altezza della telecamera
    angolo: 0,
    inclinazione: 0,      // guardare in alto (+) / in basso (-)
    avanzamento: 0,       // 0..1 lineare
    transizione: 0,       // 0..1 "ammorbidito": quello da usare per disegnare
    angoloLiscio: 0,      // angolo che insegue quello di Lia (terza persona)
    distanzaDalGiocatore: 0,
  };

  C.inizializza = function (giocatore) {
    this.angoloLiscio = giocatore.angolo;
    this.x = giocatore.x;
    this.y = giocatore.y;
    this.angolo = giocatore.angolo;
  };

  C.cambiaModo = function () {
    this.modo = this.modo === 'prima' ? 'terza' : 'prima';
  };

  C.aggiorna = function (dt, g, mondo) {
    const K = CFG.camera, T = K.terza;

    // 1) Avanza la transizione verso la vista scelta
    const meta = this.modo === 'terza' ? 1 : 0;
    const passo = dt / K.durataTransizione;
    this.avanzamento = meta > this.avanzamento ? Math.min(meta, this.avanzamento + passo) : Math.max(meta, this.avanzamento - passo);
    const e = U.morbido(this.avanzamento);
    this.transizione = e;

    // 2) Angolo: in terza persona insegue quello di Lia con un po' di ritardo
    this.angoloLiscio = U.interpolaAngolo(this.angoloLiscio, g.angolo, 1 - Math.exp(-T.morbidezzaRotazione * dt));
    const angolo = U.interpolaAngolo(g.angolo, this.angoloLiscio, e);

    // 3) Altezza: occhi di Lia (con l'ondeggiare dei passi) → sopra le spalle
    const oscillazione = Math.sin(g.faseP * Math.PI) * K.oscillazionePasso * (g.inMovimento ? 1 : 0);
    const z = U.interpola(K.altezzaOcchi + oscillazione, T.altezza, e);

    // 4) Distanza dietro a Lia, accorciata se c'è un muro
    let distanza = e * T.distanza;
    const bx = -Math.cos(angolo), by = -Math.sin(angolo);
    let libera = 0;
    for (let s = 0.05; s <= distanza + 0.001; s += 0.05) {
      if (mondo.bloccaCamera(g.x + bx * s, g.y + by * s, z)) break;
      libera = s;
    }
    if (libera < distanza) distanza = Math.max(0, libera - 0.12);

    this.x = g.x + bx * distanza;
    this.y = g.y + by * distanza;
    this.z = z;
    this.angolo = angolo;
    this.inclinazione = g.inclinazione - e * T.inclinazione;
    this.distanzaDalGiocatore = distanza;
  };

  G.Camera = C;
})();
