/* ==========================================================================
 *  main.js — AVVIO E CICLO PRINCIPALE DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Questo file "dirige l'orchestra": prepara tutti i moduli e poi, circa
 *  60 volte al secondo, aggiorna il mondo e lo disegna.
 *
 *  Fasi del gioco:
 *    'menu'     la schermata iniziale (sullo sfondo il mondo gira piano)
 *    'gioco'    si gioca
 *    'finale'   Biscotto è stato ritrovato: il mondo si colora tutto
 *    'vittoria' la schermata finale
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const FERMO = { avanti: 0, laterale: 0, rotazione: 0, corsa: false };

  const Stato = {
    fase: 'menu',
    tempoGioco: 0,
    tempoFinale: 0,
    ultimoTempo: 0,
    raccolti: new Set(),       // ricordi trovati
    inneschiFatti: new Set(),  // pensieri già mostrati
    fugaMostrata: false,
    tempoMenu: 0,
    // qualità automatica
    mediaLavoro: 10,
    tempoLento: 0,
  };

  /* --------------------------------------------------------------------- */
  /*  Avvio                                                                 */
  /* --------------------------------------------------------------------- */
  function avvia() {
    const amb = G.Ambientazione;
    G.Texture.generaTutte(amb);   // disegna tutte le texture
    G.Sprite.generaTutte();       // disegna tutti gli sprite
    G.Mondo.costruisci(amb);      // legge la mappa
    G.Giocatore.inizializza(amb.giocatore);
    G.Cane.inizializza(amb.cane);
    G.Camera.inizializza(G.Giocatore);

    const tela = document.getElementById('schermo');
    G.Renderer.inizializza(tela);
    G.Input.inizializza(tela);
    G.Interfaccia.inizializza({ alInizio: iniziaPartita });

    // Che cosa fanno i comandi "speciali"
    G.Input.su('tocco', () => { if (Stato.fase === 'gioco') G.Giocatore.tocca(G.Mondo); });
    G.Input.su('vista', () => {
      if (Stato.fase === 'menu') return;
      G.Camera.cambiaModo();
      G.Interfaccia.aggiornaVista(G.Camera.modo);
    });
    G.Input.su('mappa', () => { if (Stato.fase === 'gioco') G.Interfaccia.alternaMappa(); });
    G.Input.su('aggancio', () => {
      if (!G.Input.agganciato && Stato.fase === 'gioco') {
        G.Interfaccia.messaggio('Clicca sul gioco per usare di nuovo il mouse.', 3);
      }
    });

    // Un primo colpo di bastone "finto" per lo sfondo del menu
    G.Mondo.creaOnda(amb.giocatore.x, amb.giocatore.y, CFG.onde.bastone);
    G.Mondo.rivelaCerchio(amb.giocatore.x, amb.giocatore.y, 3, 1);

    document.body.classList.add('pronto');
    requestAnimationFrame(ciclo);
  }

  function iniziaPartita() {
    const amb = G.Ambientazione;
    G.Audio.avvia();
    G.Interfaccia.nascondiMenu();
    G.Input.richiediAggancio();
    G.Giocatore.angolo = amb.giocatore.angolo;
    G.Camera.inizializza(G.Giocatore);
    Stato.fase = 'gioco';
    G.Giocatore.tocca(G.Mondo);
    for (const testo of amb.testi.inizio) {
      const t = testo === 'SUGGERIMENTO_BASTONE'
        ? (G.Input.eTouch ? amb.testi.bastoneTouch : amb.testi.bastoneTastiera)
        : testo;
      G.Interfaccia.messaggio(t, 4);
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Ciclo principale                                                      */
  /* --------------------------------------------------------------------- */
  function ciclo(tempo) {
    let dt = (tempo - Stato.ultimoTempo) / 1000;
    Stato.ultimoTempo = tempo;
    if (!(dt > 0) || dt > 0.05) dt = dt > 0.05 ? 0.05 : 0.016; // evita salti se la scheda era nascosta

    const inizioLavoro = performance.now();
    if (Stato.fase === 'menu') aggiornaMenu(dt);
    else aggiornaGioco(dt);
    G.Renderer.disegna();
    G.Interfaccia.aggiorna(dt);
    qualitaAutomatica(dt, performance.now() - inizioLavoro);

    requestAnimationFrame(ciclo);
  }

  /** Sullo sfondo del menu il mondo ruota lentamente e il bastone batte ogni tanto. */
  function aggiornaMenu(dt) {
    Stato.tempoMenu += dt;
    G.Giocatore.angolo += dt * 0.12;
    if (Stato.tempoMenu > 4) {
      Stato.tempoMenu = 0;
      G.Mondo.creaOnda(G.Giocatore.x, G.Giocatore.y, CFG.onde.bastone);
    }
    G.Mondo.aggiorna(dt, G.Giocatore);
    G.Camera.aggiorna(dt, G.Giocatore, G.Mondo);
  }

  function aggiornaGioco(dt) {
    const comandiAttivi = Stato.fase === 'gioco';
    if (comandiAttivi) Stato.tempoGioco += dt;

    const movimento = comandiAttivi ? G.Input.leggiMovimento() : FERMO;
    const sguardo = G.Input.consumaSguardo();
    G.Giocatore.aggiorna(dt, movimento, comandiAttivi ? sguardo : { dx: 0, dy: 0 }, G.Mondo);
    G.Cane.aggiorna(dt, G.Giocatore, G.Mondo);
    G.Mondo.aggiorna(dt, G.Giocatore);
    G.Camera.aggiorna(dt, G.Giocatore, G.Mondo);
    G.Audio.aggiorna(dt, G.Giocatore);

    if (comandiAttivi) {
      controllaRicordi();
      controllaInneschi();
      controllaCane();
    } else if (Stato.fase === 'finale') {
      Stato.tempoFinale += dt;
      if (Stato.tempoFinale > 4) {
        Stato.fase = 'vittoria';
        G.Interfaccia.mostraVittoria({
          tempo: Stato.tempoGioco,
          ricordi: Stato.raccolti.size,
          ricordiTotali: G.Mondo.ricordiTotali,
          colpi: G.Giocatore.colpiBastone,
        });
      }
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Regole del gioco                                                      */
  /* --------------------------------------------------------------------- */

  /** Lia raccoglie un ricordo quando ci passa sopra. */
  function controllaRicordi() {
    const g = G.Giocatore;
    for (const o of G.Mondo.oggetti) {
      if (!o.ricordo || o.raccolto) continue;
      if (U.distanza(g.x, g.y, o.x, o.y) < 0.55) {
        o.raccolto = true;
        Stato.raccolti.add(o.tipo);
        G.Mondo.aggiornaLivelli(Stato.raccolti.size);
        G.Mondo.creaOnda(o.x, o.y, Object.assign({}, CFG.onde.bastone, { colore: '#ffd7a8', raggio: 9 }));
        G.Audio.raccolta();
        G.Interfaccia.messaggio(o.ricordo, 5, true);
        G.Interfaccia.aggiornaRicordi(Stato.raccolti);
      }
    }
  }

  /** Pensieri di Lia legati ai luoghi (ognuno una volta sola). */
  function controllaInneschi() {
    const g = G.Giocatore;
    G.Ambientazione.inneschi.forEach((innesco, indice) => {
      if (Stato.inneschiFatti.has(indice)) return;
      if (U.distanza(g.x, g.y, innesco.x, innesco.y) < innesco.raggio) {
        Stato.inneschiFatti.add(indice);
        G.Interfaccia.messaggio(innesco.testo, 4.5);
      }
    });
  }

  /** Messaggi legati a Biscotto e condizione di vittoria. */
  function controllaCane() {
    const K = G.Cane, g = G.Giocatore;
    while (K.eventi.length) {
      const evento = K.eventi.shift();
      if (evento === 'fuga' && !Stato.fugaMostrata) {
        Stato.fugaMostrata = true;
        G.Interfaccia.messaggio(G.Ambientazione.testi.caneScappa, 3.5);
      }
    }
    if (K.eArrivato() && U.distanza(g.x, g.y, K.x, K.y) < G.Ambientazione.cane.distanzaVittoria) {
      Stato.fase = 'finale';
      G.Mondo.coloraTutto();
      G.Mondo.creaOnda(K.x, K.y, Object.assign({ attraversaMuri: true }, CFG.onde.finale));
      G.Audio.vittoria();
      K.abbaia(G.Mondo);
      G.Interfaccia.messaggio('«Biscotto!»', 3.5, true);
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Qualità automatica: se disegnare richiede troppo tempo, riduciamo     */
  /*  la risoluzione interna (l'immagine resta morbida e armoniosa).        */
  /* --------------------------------------------------------------------- */
  function qualitaAutomatica(dt, millisecondi) {
    if (!CFG.grafica.qualitaAutomatica) return;
    Stato.mediaLavoro = Stato.mediaLavoro * 0.95 + millisecondi * 0.05;
    if (Stato.mediaLavoro > 22) Stato.tempoLento += dt; else Stato.tempoLento = 0;
    const R = G.Renderer;
    if (Stato.tempoLento > 2 && R.altezzaRender > CFG.grafica.altezzaMinima) {
      R.impostaAltezza(Math.max(CFG.grafica.altezzaMinima, R.altezzaRender - 20));
      Stato.tempoLento = 0;
      Stato.mediaLavoro = 10;
    }
  }

  // Per i curiosi: dalla console del browser si può scrivere Gioco.Stato
  G.Stato = Stato;

  window.addEventListener('load', avvia);
})();
