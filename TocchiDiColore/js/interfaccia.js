/* ==========================================================================
 *  interfaccia.js — MENU, MESSAGGI, ICONE E MAPPA MENTALE
 *  --------------------------------------------------------------------------
 *  Gestisce tutto ciò che sta "sopra" il gioco ed è fatto in HTML:
 *  la schermata iniziale, i pensieri di Lia, i ricordi raccolti, i pulsanti,
 *  la mappa mentale e la schermata finale.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;

  const UI = {
    el: {},
    coda: [],            // messaggi in attesa di essere mostrati
    messaggioAttivo: false,
    tempoMessaggio: 0,
    mappaVisibile: false,
    tempoMappa: 0,
    iconeRicordi: {},
  };

  const $ = (id) => document.getElementById(id);

  UI.inizializza = function (opzioni) {
    const el = this.el;
    for (const id of ['menu', 'hud', 'messaggio', 'minimappa', 'vittoria', 'testoVittoria', 'statistiche',
      'btnInizia', 'btnRicomincia', 'btnVista', 'btnMappa', 'btnAudio', 'btnSchermoIntero',
      'comandiTouch', 'btnTocco', 'iconeRicordi', 'storia', 'comandiPC', 'comandiTelefono', 'grana']) {
      el[id] = $(id);
    }

    // Testi presi dall'ambientazione
    el.storia.textContent = G.Ambientazione.testi.storia;
    const touch = G.Input.eTouch;
    el.comandiPC.hidden = touch;
    el.comandiTelefono.hidden = !touch;

    // Pulsanti
    el.btnInizia.addEventListener('click', () => opzioni.alInizio());
    el.btnRicomincia.addEventListener('click', () => window.location.reload());
    el.btnVista.addEventListener('click', () => G.Input.emetti('vista'));
    el.btnMappa.addEventListener('click', () => G.Input.emetti('mappa'));
    el.btnAudio.addEventListener('click', () => {
      const muto = G.Audio.alternaMuto();
      el.btnAudio.classList.toggle('spento', muto);
    });
    el.btnSchermoIntero.addEventListener('click', () => this.schermoIntero());
    el.btnTocco.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); G.Input.emetti('tocco'); });

    // Icone dei ricordi: disegniamo i veri sprite in piccole tele
    for (const o of G.Mondo.oggetti) {
      if (!o.ricordo || this.iconeRicordi[o.tipo]) continue;
      const tela = document.createElement('canvas');
      tela.width = 24; tela.height = 24;
      tela.className = 'icona';
      tela.title = o.tipo;
      tela.getContext('2d').drawImage(G.Sprite.immagini[o.sprite[0]].tela, 0, 0);
      el.iconeRicordi.appendChild(tela);
      this.iconeRicordi[o.tipo] = tela;
    }

    this._grana();
  };

  /**
   * Crea una grana di carta: puntini scuri quasi trasparenti, ripetuti sopra
   * tutto il gioco. (Usiamo la trasparenza normale invece dei "metodi di
   * fusione" CSS perché è molto più leggera per i telefoni.)
   */
  UI._grana = function () {
    const tela = document.createElement('canvas');
    tela.width = 160; tela.height = 160;
    const c = tela.getContext('2d');
    const dati = c.createImageData(160, 160);
    const casuale = U.creaCasuale(7);
    const ink = U.esadecimaleARgb(G.Ambientazione.colori.inchiostro);
    for (let i = 0; i < dati.data.length; i += 4) {
      dati.data[i] = ink.r; dati.data[i + 1] = ink.g; dati.data[i + 2] = ink.b;
      dati.data[i + 3] = Math.floor(casuale() * casuale() * 34); // per lo più quasi invisibili
    }
    c.putImageData(dati, 0, 0);
    this.el.grana.style.backgroundImage = 'url(' + tela.toDataURL() + ')';
  };

  UI.schermoIntero = function () {
    const doc = document.documentElement;
    if (!document.fullscreenElement && doc.requestFullscreen) {
      doc.requestFullscreen().then(() => {
        // sul telefono proviamo anche a bloccare l'orientamento orizzontale
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      }).catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  UI.nascondiMenu = function () {
    this.el.menu.classList.add('nascosto');
    this.el.hud.classList.remove('nascosto');
    if (G.Input.eTouch) this.el.comandiTouch.classList.remove('nascosto');
  };

  /**
   * Mette in coda un pensiero di Lia da mostrare per "durata" secondi.
   * Se "urgente" è true il messaggio salta la coda e appare subito.
   */
  UI.messaggio = function (testo, durata, urgente) {
    const m = { testo, durata: durata || 4 };
    if (!urgente) { this.coda.push(m); return; }
    this.coda.unshift(m);
    this.tempoMessaggio = 0; // chiude subito il messaggio attuale (o salta la pausa)
  };

  UI.aggiornaRicordi = function (raccolti) {
    for (const [tipo, tela] of Object.entries(this.iconeRicordi)) {
      tela.classList.toggle('trovato', raccolti.has(tipo));
    }
  };

  UI.aggiornaVista = function (modo) {
    this.el.btnVista.classList.toggle('terza', modo === 'terza');
  };

  UI.alternaMappa = function () {
    this.mappaVisibile = !this.mappaVisibile;
    this.el.minimappa.classList.toggle('nascosto', !this.mappaVisibile);
  };

  UI.mostraVittoria = function (statistiche) {
    this.el.testoVittoria.textContent = G.Ambientazione.testi.vittoria;
    const minuti = Math.floor(statistiche.tempo / 60);
    const secondi = Math.floor(statistiche.tempo % 60).toString().padStart(2, '0');
    this.el.statistiche.innerHTML =
      'Tempo: <b>' + minuti + ':' + secondi + '</b><br>' +
      'Ricordi trovati: <b>' + statistiche.ricordi + ' / ' + statistiche.ricordiTotali + '</b><br>' +
      'Colpi di bastone: <b>' + statistiche.colpi + '</b>';
    this.el.vittoria.classList.remove('nascosto');
    this.el.comandiTouch.classList.add('nascosto');
    // via i messaggi rimasti in coda: ora parla la schermata finale
    this.coda.length = 0;
    this.messaggioAttivo = false;
    this.el.messaggio.classList.remove('visibile');
    if (document.exitPointerLock) document.exitPointerLock();
  };

  /** Aggiornamento a ogni fotogramma: messaggi e mappa. */
  UI.aggiorna = function (dt) {
    // Messaggi: uno alla volta, con dissolvenza (gestita dal CSS)
    if (this.messaggioAttivo) {
      this.tempoMessaggio -= dt;
      if (this.tempoMessaggio <= 0) {
        this.el.messaggio.classList.remove('visibile');
        this.messaggioAttivo = false;
        this.tempoMessaggio = 0.6;      // pausa tra un messaggio e l'altro
      }
    } else {
      this.tempoMessaggio -= dt;
      if (this.tempoMessaggio <= 0 && this.coda.length) {
        const m = this.coda.shift();
        this.el.messaggio.textContent = m.testo;
        this.el.messaggio.classList.add('visibile');
        this.messaggioAttivo = true;
        this.tempoMessaggio = m.durata;
      }
    }

    // Mappa mentale (ridisegnata qualche volta al secondo)
    if (this.mappaVisibile) {
      this.tempoMappa -= dt;
      if (this.tempoMappa <= 0) { this.tempoMappa = 0.15; this._disegnaMappa(); }
    }
  };

  /** La "mappa mentale": mostra solo i luoghi che Lia ha percepito. */
  UI._disegnaMappa = function () {
    const tela = this.el.minimappa, c = tela.getContext('2d');
    const M = G.Mondo, g = G.Giocatore, K = G.Cane;
    const lato = Math.floor(Math.min(tela.width / M.larghezza, tela.height / M.altezza));
    const ox = Math.floor((tela.width - lato * M.larghezza) / 2);
    const oy = Math.floor((tela.height - lato * M.altezza) / 2);
    const carta = U.esadecimaleARgb(G.Ambientazione.colori.carta);
    c.fillStyle = G.Ambientazione.colori.carta;
    c.fillRect(0, 0, tela.width, tela.height);
    for (let y = 0; y < M.altezza; y++) {
      for (let x = 0; x < M.larghezza; x++) {
        const i = y * M.larghezza + x;
        const rev = M.rivelazione[i];
        if (rev < 0.03) continue;
        const w = M.muro[i];
        const m = w ? M.tipiMuro[w].texture[0].medio : M.tipiPavimento[M.pavimento[i]].texture.medio;
        const k = Math.min(1, rev * 1.2) * (w ? 0.9 : 0.75);
        c.fillStyle = 'rgb(' + Math.round(carta.r + (m.r * (w ? 0.8 : 1) - carta.r) * k) + ',' +
          Math.round(carta.g + (m.g * (w ? 0.8 : 1) - carta.g) * k) + ',' +
          Math.round(carta.b + (m.b * (w ? 0.8 : 1) - carta.b) * k) + ')';
        c.fillRect(ox + x * lato, oy + y * lato, lato, lato);
      }
    }
    // Biscotto, se Lia lo sta percependo
    if (M.rivelazioneIn(K.x, K.y) > 0.35) {
      c.fillStyle = '#e8894f';
      c.beginPath(); c.arc(ox + K.x * lato, oy + K.y * lato, lato * 0.55, 0, Math.PI * 2); c.fill();
    }
    // Lia: una freccia nella direzione in cui guarda
    const px = ox + g.x * lato, py = oy + g.y * lato, a = g.angolo, r = lato * 1.1;
    c.fillStyle = G.Ambientazione.colori.inchiostro;
    c.beginPath();
    c.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
    c.lineTo(px + Math.cos(a + 2.5) * r * 0.7, py + Math.sin(a + 2.5) * r * 0.7);
    c.lineTo(px + Math.cos(a - 2.5) * r * 0.7, py + Math.sin(a - 2.5) * r * 0.7);
    c.closePath();
    c.fill();
  };

  G.Interfaccia = UI;
})();
