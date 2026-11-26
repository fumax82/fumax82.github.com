/* ==========================================================================
 *  storia.js — LA STORIA DEL GIOCO (la "sceneggiatura")
 *  --------------------------------------------------------------------------
 *  Ispirata al cortometraggio «Out of Sight» (敲敲, 2010).
 *
 *  Il gioco è pensato per una BIMBA DI 2 ANNI: niente da leggere, niente
 *  dialoghi, niente pulsanti da cercare, niente fermate. Lia cammina da
 *  sola e la storia scorre come un cartone animato; i personaggi passano,
 *  salutano, fanno festa. La bimba tocca lo schermo e ogni tocco fa nascere
 *  colori, suoni e sorprese (vedi gioco/sorprese.js).
 *
 *    PROLOGO    La passeggiata con Gogo; il ladro prende la borsa, Gogo lo
 *               insegue abbaiando, Lia lo chiama... il mondo diventa bianco.
 *    CAPITOLO 1 Il bastoncino nel buco; ogni tocco colora il mondo; la
 *               bacchetta magica; la pioggia immaginata (auto-pesce,
 *               animali alla fermata, la balena con le pinne).
 *    CAPITOLO 2 Il profumo del pane: la fornaia lancia un panino caldo.
 *    CAPITOLO 3 Il gattino del vicolo fa strada a Lia.
 *    CAPITOLO 4 La città sull'acqua: gli animali sul ponte salutano,
 *               dalla libreria della Tigre volano via le pagine.
 *    CAPITOLO 5 La balena del cielo e il volo sulla città.
 *    FINALE     Gogo torna con la borsa: l'abbraccio.
 *
 *  Ogni capitolo ha:
 *    prepara(g): rimette le cose a posto se si riprende da un salvataggio
 *    gioca(g):   la sequenza degli eventi (con "await" si aspetta)
 *  "g" è il Gioco: vedi i comandi in main.js.
 *  Le posizioni sul percorso si chiamano "s" (metri dall'inizio della scena);
 *  per le inquadrature si usano punti del mondo [x, y, z] (vedi g.punto).
 * ========================================================================== */
import { CONFIG } from '../config.js';
import { Audio } from '../gioco/audio.js';
import { FORME } from '../motore/particelle.js';
import { Sagoma } from '../motore/sagoma.js';

const distanza = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/* ------------------------------------------------------------------------ */
/*  PICCOLI AIUTI                                                           */
/* ------------------------------------------------------------------------ */

/** Lia cammina da sola fino al punto s del percorso (v in metri al secondo). */
function cammina(g, s, v) {
  return g.lia.vaiA(s, v || CONFIG.bimbi.passo);
}

/** Mette Lia in modalità streghetta (serve per riprendere dai salvataggi). */
function streghetta(g) {
  g.lia.vestiti('lia_strega');
  g.lia.puoToccare = true;
  g.lia.magica = true;
  g.ui.mostraToc(true, true);
}

/**
 * Lia chiama il suo cane: la voce si vede, come in un fumetto ("GOGO!"),
 * con gli archi sonori che partono da lei.
 */
function chiamaGogo(g, testo) {
  const L = g.lia;
  if (!L.posaSpeciale) L.posa('sorpresa', 0.8);
  g.effetti.onomatopea(testo, L.x, L.y + 1.45, L.z, '#f08a6a', testo.length > 6 ? 1.15 : 1.0);
  g.effetti.archi(L.x, L.y + 1.0, L.z, '#ffd2b0', 2);
  if (Audio.chiama) Audio.chiama(L.x, L.z, testo.length > 6);
}

/** Atmosfera del mondo immaginato: bianco ai bordi, colori dove Lia percepisce. */
function mondoImmaginato(g) {
  g.coloraMondo(0);
  g.cieloColore(0.75);
  g.bordoBianco(1);
}

/** Un personaggio saluta Lia che passa: saltello, verso, cuori (senza fermare niente). */
function saluta(g, a) {
  if (!a || !a.visibile) return;
  a.guarda(g.lia.x, g.lia.z);
  a.parlando = true;                       // la bocca si muove: è contento
  g.attendi(1.4).then(() => { a.parlando = false; });
  g.sorprese.festa(a);
}

/** Quando Lia passa vicino a questi personaggi, ognuno la saluta (una volta sola). */
function salutiAlPassaggio(g, ids, quanto) {
  const fatti = new Set();
  return g.ogni(0.25, () => {
    for (const id of ids) {
      if (fatti.has(id)) continue;
      const a = g.attore(id);
      if (a && a.visibile && distanza(g.lia, a) < (quanto || 2.6)) { fatti.add(id); saluta(g, a); }
    }
  });
}

/**
 * Un dono che vola ad arco da "da" [x, y, z] fino alle mani di Lia
 * (per esempio il panino caldo della fornaia), lasciando una scia di luce.
 */
function lancia(g, arte, da, durata) {
  return new Promise((ok) => {
    const s = new Sagoma(arte, { ancora: 0.5, scala: 0.8, luce: 1 });
    s.aggiungiA(g.corrente.gruppo);
    const inizio = g.tempo;
    const volo = g.ogni(0.016, () => {
      const L = g.lia;
      const k = Math.min(1, (g.tempo - inizio) / durata);
      const a = [L.x, L.y + 0.6, L.z + 0.05];
      const x = da[0] + (a[0] - da[0]) * k;
      const y = da[1] + (a[1] - da[1]) * k + Math.sin(Math.PI * k) * 1.2;
      const z = da[2] + (a[2] - da[2]) * k;
      s.posiziona(x, y, z);
      g.luci.emetti(x, y, z, 1, { forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b'], velocita: 0.2, su: 0.1, vita: 0.6, dim: 0.12 });
      if (k >= 1) {
        volo.ferma();
        s.rimuovi();
        g.dono(a[0], a[1], a[2]);
        g.lia.posa('saluta', 1.2);
        ok();
      }
    });
  });
}

/* ======================================================================== */
const PROLOGO = {
  async prepara() {},
  async gioca(g) {
    await g.vai('via', 'inizio', { subito: true });
    const L = g.lia;
    L.vestiti('lia_borsa');
    L.puoToccare = false;      // il bastoncino arriverà dopo: ora i tocchi fanno solo sorprese
    L.magica = false;
    g.ui.mostraToc(false);
    g.coloraMondo(1);          // Gogo guida Lia: il mondo è tutto colorato
    g.cieloColore(1);
    g.bordoBianco(0);
    const b = g.attore('gogo');
    b.visibile = true;
    b.guinzaglio = L;
    g.guinzaglio(true);
    await g.bianco(0, 2);
    const abbai = g.ogni(6, () => { if (Math.random() < 0.7) b.faVerso(); });

    // --- la passeggiata: Lia cammina da sola -----------------------------
    await cammina(g, 22);

    // --- il ladro --------------------------------------------------------
    const ladro = g.attore('ladro');
    ladro.teletrasporta(L.x + 13, L.z + 0.6, -1);
    ladro.visibile = true;
    while (ladro.x - L.x > 1.0) {
      ladro.vaiA(L.x + 0.9, L.z + 0.6, 1.35);
      await g.attendi(0.2);
    }
    abbai.ferma();
    g.controllo(false);
    ladro.ferma();
    ladro.guarda(L.x, L.z);
    // primo piano: lo scippo
    g.inquadra([L.x + 0.6, 1.05, L.z + 2.9], [L.x + 0.55, 0.95, L.z + 0.2], 0, 40);
    ladro.posa('scippo', 0.9);
    Audio.scippo(ladro.x, ladro.z);
    g.concentra([L.x + 0.4, 1.0, L.z], 1.6, '#3e2a20', 0.6);
    L.vestiti('lia');
    L.posa('sorpresa', 2.5);
    g.regia.scuoti(0.4);
    b.guinzaglio = null;
    g.guinzaglio(false);
    b.guarda(ladro.x, ladro.z);
    b.posa('ringhia', 1.3);
    Audio.ringhio(b.x, b.z);
    await g.attendi(0.9);
    g.libera(true);
    ladro.percorri([[54, L.z + 0.6]], 3.8).then(() => { ladro.visibile = false; });
    await g.attendi(0.5);
    // Gogo parte all'inseguimento del ladro abbaiando... e Lia lo chiama!
    b.faVerso();
    b.percorri([[46.0, 0.1], [46.9, 0.0]], 4.2).then(() => { b.visibile = false; });
    await g.attendi(0.35);
    chiamaGogo(g, 'GOGO!');
    // mentre corre via abbaia ancora, sempre più lontano, e lei lo chiama di nuovo
    let chiamate = 0;
    const inseguimento = g.ogni(1.4, () => {
      if (!b.visibile || chiamate >= 3) { inseguimento.ferma(); return; }
      b.faVerso();
      g.attendi(0.45).then(() => chiamaGogo(g, chiamate === 2 ? 'GOGOOO!' : 'GOGO!'));
      chiamate++;
    });
    await g.attendi(0.8);
    g.controllo(true);
    // Lia corre dietro a Gogo, fino alla staccionata
    await cammina(g, 44.3, 2.0);

    // --- la staccionata --------------------------------------------------
    g.controllo(false);
    await L.vaiA(45.75, 2.4);
    Audio.botta();
    g.regia.scuoti(0.8);
    L.posa('urto', 1.2);
    await g.bianco(1, 0.3);
    // il mondo diventa bianco: senza Gogo, Lia non sa più dove si trova
    g.coloraMondo(0);
    g.cieloColore(0.15);
    g.bordoBianco(1);
    g.musica('bianco');
    g.inquadra([44.7, 0.9, 1.9], [46.2, 0.72, 0], 0, 42);
    await g.bianco(0, 2.2);
    L.posa('ascolta', Infinity);
    await g.attendi(1.2);
    Audio.abbaio(46.9, 0);
    g.onda(46.9, 0, 'abbaio');
    await g.attendi(1.0);
    chiamaGogo(g, 'Gogo...?');
    await g.attendi(1.6);
    L.posa(null, 0);
  },
};

/* ======================================================================== */
const CAPITOLO_1 = {
  async prepara(g) {
    await g.vai('via', 'staccionata', { subito: true });
    g.lia.vestiti('lia');
    g.attore('gogo').visibile = false;
    g.coloraMondo(0); g.cieloColore(0.15); g.bordoBianco(1);
    g.musica('bianco');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    g.attore('gogo').visibile = false;
    // --- nel buco della staccionata c'è un bastoncino! ------------------
    g.controllo(false);
    L.posa('china', Infinity);
    g.inquadra([45.0, 0.45, 1.35], [46.4, 0.3, 0], 1.0, 44);
    await g.attendi(1.0);
    g.effetti.colonnaLuce(46.3, 0, 0.05, '#fff3b8', 3);
    g.scintille(46.3, 0.3, 0.05, 24, { colori: ['#fff0a0', '#ffd36b', '#ffffff'] });
    Audio.scoperta(0.8);
    await g.attendi(1.3);
    g.dono(L.x, L.y + 0.8, L.z);
    L.posa('saluta', 1.6);
    await g.attendi(1.2);
    L.posa(null, 0);
    g.libera();
    L.puoToccare = true;
    g.ui.mostraToc(true, false);
    g.controllo(true);

    // --- toc toc: ogni tocco colora il mondo (Lia bussa anche da sola) ---
    await g.attendi(4);
    // Lia torna indietro piano piano: le cose del marciapiede "spuntano"
    await cammina(g, 30, 0.6);

    // --- la trasformazione -------------------------------------------------
    g.controllo(false);
    const p = g.punto(L.s);
    g.inquadra([p[0] + 1.0, p[1] + 0.85, p[2] + 2.5], [p[0], p[1] + 0.6, p[2]], 1.2, 40);
    await g.attendi(1.2);
    Audio.trasformazione();
    g.onda(L.x, L.z, 'magia');
    g.concentra([L.x, L.y + 0.8, L.z], 2.6, '#fffaf0', 0.9);
    // la camera gira intorno a Lia salendo, mentre la magia la avvolge
    g.inquadra([p[0] - 1.9, p[1] + 1.7, p[2] + 2.1], [p[0], p[1] + 0.8, p[2]], 2.6, 48);
    g.regia.pulsa(1);
    const giro = g.ogni(0.08, () => g.scintille(L.x, L.y + 0.1 + Math.random() * 1.0, L.z, 6, { velocita: 2, su: 1.4, sparpaglia: 0.3 }));
    const spirali = g.ogni(0.45, () => {
      const c = ['#ffd36b', '#f7b6d8', '#a8d8ff', '#c9b6ea'][Math.floor(Math.random() * 4)];
      g.effetti.spirale(L.x, L.y, L.z, c, { raggio: 0.55 + Math.random() * 0.3, altezza: 1.8, giri: 3, fase: Math.random() * 6, durata: 1.6, larghezza: 0.09 });
    });
    // una pioggia di petali e stelle che scende dal cielo
    const petali = g.ogni(0.1, () => g.particelle.emetti(L.x + (Math.random() - 0.5) * 3, L.y + 3.2, L.z + (Math.random() - 0.5) * 1.5, 2, {
      forma: [FORME.petalo, FORME.fiore], colori: ['#f7a8c8', '#ffd1e8', '#fff3a8', '#c9b6ea'], velocita: 0.3, su: -0.4, gravita: 0.25, vita: 3, dim: 0.14, vortice: 0.8,
    }));
    await g.attendi(1.6);
    await g.bianco(0.92, 0.35);
    streghetta(g);
    g.musica('magia');
    g.cieloColore(0.6, 2);
    g.effetti.colonnaLuce(L.x, L.y, L.z, '#fff3b8', 10);
    await g.bianco(0, 1.2);
    giro.ferma();
    spirali.ferma();
    L.posa('saluta', 3);
    g.scintille(L.x, L.y + 1, L.z, 50, { forma: [FORME.stella, FORME.cuore, FORME.scintilla], velocita: 2.5 });
    g.inquadra([p[0] + 0.3, p[1] + 0.95, p[2] + 2.3], [p[0], p[1] + 0.7, p[2]], 1.8, 40);
    await g.attendi(2.4);
    petali.ferma();
    L.posa(null, 0);
    g.libera();

    // --- la pioggia: Lia la sente, e la immagina --------------------------
    await g.attendi(0.8);
    g.meteo.pioggia(0.55);
    g.regia.sogno(1);
    await g.attendi(2.4);
    Audio.splash(L.x + 4, 3);
    // controcampo: la camera guarda attraverso la strada, verso la fermata
    g.inquadra([L.x - 0.6, 1.15, L.z + 0.5], [26.9, 1.5, 8.5], 2.2, 46);
    ['auto1', 'auto2', 'auto3'].forEach((id) => { const a = g.attore(id); if (a) a.visibile = false; });
    g.meteo.diventaFiume(1);
    ['pesce1', 'pesce2', 'pesce3'].forEach((id) => { g.attore(id).visibile = true; });
    g.onda(L.x + 3, 4.2, 'suono', { raggio: 16, colore: '#a8d8ff', livello: 1 });
    await g.attendi(2.8);
    // la fermata degli animali, sotto gli ombrelli
    g.corrente.oggetto('fermata').visibile = true;
    const attesa = ['attesa_lepre', 'attesa_uccello', 'attesa_cavallo', 'attesa_nonna'].map((id) => g.attore(id));
    attesa.forEach((a) => { a.visibile = true; });
    g.meteo.ombrelliPer(attesa);
    g.onda(26.9, 8.5, 'magia', { raggio: 7, forza: 0.6 });
    await g.attendi(3.2);
    // arriva l'autobus-pesce
    const bus = g.attore('bus');
    bus.visibile = true;
    bus.teletrasporta(62, 6.2);
    bus.def.giro = [[27.2, 0.02, 6.2]];
    await g.quando(() => Math.abs(bus.x - 27.2) < 0.3);
    Audio.clacson(bus.x, bus.z);
    g.suonoVisibile('clacson', bus.x, 2.4, bus.z);
    await g.attendi(1.0);
    for (const a of attesa) {
      await g.attendi(0.45);
      a.visibile = false;
      g.scintille(a.x, 1.0, a.z, 14, { colori: ['#a8d8ff', '#ffffff', '#fff0a0'] });
    }
    await g.attendi(0.6);
    bus.def.giro = [[-20, 0.02, 6.2]];
    // in cielo... la balena con tante pinne
    const balena = g.attore('balena_pinne');
    balena.visibile = true;
    balena.teletrasporta(L.x - 34, 6);
    balena.y = 15;
    balena.def.giro = [[L.x + 70, 18, 5]];
    g.inquadra([L.x - 1.2, 1.0, L.z + 0.6], [L.x + 2.5, 12.5, 6.5], 2.8, 60);
    Audio.balena();
    await g.quando(() => balena.x > L.x - 6);
    Audio.balena();
    g.concentra([balena.x, balena.y, balena.z], 2.0, '#fffaf0', 0.75);
    g.suonoVisibile('balena', balena.x, balena.y, balena.z);
    await g.attendi(4.5);
    g.libera();
    g.meteo.pioggia(0.3);
    g.controllo(true);
    g.quando(() => balena.x > L.x + 60).then(() => { balena.visibile = false; });
    g.quando(() => bus.x < -15).then(() => { bus.visibile = false; });

    // --- la staccionata incantata: ora Lia ci passa ----------------------
    const brillio = g.emettitore(46.5, 0.32, 0, 10, { forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff'], su: 0.7, velocita: 0.5, vita: 1.4, dim: 0.13 });
    const richiamo = g.ogni(4, () => g.onda(46.4, 0, 'magia', { raggio: 4, forza: 0.5 }));
    await cammina(g, 45.6, 1.1);
    brillio.attivo = false;
    richiamo.ferma();
    Audio.magia(0.6);
    g.scintille(L.x, L.y + 0.6, L.z, 40, { forma: [FORME.stella, FORME.scintilla, FORME.cuore] });
    await g.vai('piazza', 'staccionata');
  },
};

/* ======================================================================== */
const CAPITOLO_2 = {
  async prepara(g) {
    streghetta(g);
    await g.vai('piazza', 'staccionata', { subito: true });
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    g.musica('magia');
    // il profumo del pane arriva a nastri colorati
    const profumo = g.ogni(3.2, () => g.onda(7.6, -1.6, 'profumo'));
    await cammina(g, 6.4);
    profumo.ferma();
    // la fornaia esce sulla porta, saluta e lancia a Lia un panino caldo
    g.onda(7.6, -1.6, 'profumo', { raggio: 9 });
    const f = g.attore('fornaia');
    f.visibile = true;
    f.teletrasporta(7.6, -1.85);
    g.campanello(7.6, 2.3, -1.9);
    f.vaiA(7.9, -1.45, 0.8);
    await g.attendi(0.9);
    saluta(g, f);
    await lancia(g, 'pagnotta', [f.x, f.y + 0.9, f.z], 1.1);
    f.vaiA(7.6, -1.95, 0.9).then(() => { f.visibile = false; });
  },
};

/* ======================================================================== */
const CAPITOLO_3 = {
  async prepara(g) {
    streghetta(g);
    await g.vai('piazza', 'dal_forno', { subito: true });
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    // il gattino del vicolo: aspetta Lia e poi le fa strada
    const gatto = g.attore('gattino');
    gatto.visibile = true;
    gatto.teletrasporta(21.5, -0.85, -1);
    gatto.versiAutomatici = true;
    const percorso = g.corrente.percorso;
    await cammina(g, percorso.piuVicino(gatto.x, gatto.z).s - 2.2);
    saluta(g, gatto);
    const tappe = [[26.3, -0.9], [27.6, -2.0], [27.85, -6.4], [27.85, -10.4], [27.85, -13.4]];
    for (const tappa of tappe) {
      // il gattino trotterella avanti e Lia lo segue (insieme, senza fermarsi)
      const s = percorso.piuVicino(tappa[0], tappa[1]).s - 0.9;
      await Promise.all([gatto.percorri([tappa], 1.7), cammina(g, Math.max(L.s, s), 0.95)]);
      gatto.guarda(L.x, L.z);
    }
    gatto.versiAutomatici = false;
    g.musica('citta');
    // una carezza: il gattino fa le fusa, cuori
    g.controllo(false);
    L.posa('china', Infinity);
    gatto.guarda(L.x, L.z);
    gatto.posa('strofina', Infinity);
    g.inquadra([L.x + 1.5, 0.7, L.z - 1.6], [L.x + 0.1, 0.4, L.z - 0.4], 1.0, 42);
    Audio.miagolio(gatto.x, gatto.z);
    g.particelle.emetti(gatto.x, 0.6, gatto.z, 16, { forma: [FORME.cuore], colori: ['#f7a8c8', '#ffd1e8'], su: 0.8, velocita: 0.4, vita: 1.6, dim: 0.14 });
    await g.attendi(2.2);
    L.posa(null, 0);
    gatto.sempreDiFronte = true;
    gatto.posa('seduto', Infinity);
    g.libera();
    g.controllo(true);
    await cammina(g, 42.4);
    await g.vai('canale', 'vicolo');
  },
};

/* ======================================================================== */
const CAPITOLO_4 = {
  async prepara(g) {
    streghetta(g);
    await g.vai('canale', 'vicolo', { subito: true });
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    g.musica('citta');
    // gli abitanti del ponte salutano Lia che passa
    const saluti = salutiAlPassaggio(g, ['lepre', 'uccello', 'cavallo', 'nonna', 'tigre'], 2.8);
    // davanti alla libreria della Tigre le pagine volano via come uccellini
    g.quando(() => L.s > 28).then(() => {
      Audio.pagine(31, -2.3);
      g.particelle.emetti(31.3, 1.6, -2.3, 30, {
        forma: [FORME.pagina, FORME.piuma], colori: ['#fffaf0', '#f3ead6', '#e8f1ff'],
        velocita: 1.2, su: 1.4, gravita: -0.05, vita: 4, dim: 0.24, sparpaglia: 0.4, vortice: 1.2,
      });
      if (g.meraviglie) for (let k = 0; k < 3; k++) g.meraviglie._vola('uccellino', 31.3, 1.8, -2.3, k);
    });
    await cammina(g, 40.4, 0.85);
    saluti.ferma();
    await g.vai('terrazza', 'scala');
  },
};

/* ======================================================================== */
const CAPITOLO_5 = {
  async prepara(g) {
    streghetta(g);
    await g.vai('terrazza', 'scala', { subito: true });
    mondoImmaginato(g);
    g.musica('citta');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    g.cieloColore(0.9, 2);
    await cammina(g, 12.2, 0.85);
    g.controllo(false);
    L.verso = 1;
    // tre colpi di bacchetta verso il cielo...
    g.inquadra([L.x - 2.6, 1.2, 6.4], [L.x + 5, 6.5, -12], 2.4, 46);
    for (let k = 0; k < 3; k++) {
      L.tocca(true);
      g.onda(L.x, L.z, 'magia', { raggio: 25 });
      g.scintille(L.x, L.y + 1.2, L.z, 30, { su: 2.5 });
      await g.attendi(0.8);
    }
    // ...e la balena arriva da lontano, nuotando nel cielo
    const balena = new Sagoma('balena', { cielo: true, ancora: 0.5, scala: 0.9 });
    balena.mesh.renderOrder = -2.5;   // davanti alle casette lontane, dietro ai tetti vicini
    balena.aggiungiA(g.corrente.gruppo);
    const da = [L.x + 60, 26, -70], a = [L.x + 6, 7.5, -16];
    let t = 0;
    const inizio = g.tempo;
    const nuota = g.ogni(0.016, () => {
      t = Math.min(1, (g.tempo - inizio) / 6);   // 6 secondi di viaggio, qualunque sia la velocità del telefono
      const e = t * t * (3 - 2 * t);
      balena.posiziona(da[0] + (a[0] - da[0]) * e, da[1] + (a[1] - da[1]) * e + Math.sin(g.tempo * 0.8) * 0.4, da[2] + (a[2] - da[2]) * e);
      balena.mostra('f' + (Math.floor(g.tempo * 0.8) % 2), true);
    });
    Audio.balena();
    g.suonoVisibile('balena', L.x + 8, 9, -14);
    L.posa('saluta', 3);
    await g.quando(() => t >= 1);
    Audio.balena();
    await g.attendi(1.2);
    nuota.ferma();
    await g.voloSullaBalena();
    g.libera(true);
  },
};

/* ======================================================================== */
const FINALE = {
  async prepara(g) {
    streghetta(g);
    g.acquerello.uniformi.uBianco.value = 1;
  },
  async gioca(g) {
    await g.vai('piazzetta', 'arrivo', { subito: true });
    const L = g.lia;
    g.particelle.punti.visible = true;
    g.coloraMondo(0);
    g.coloraMondo(1, 4);
    g.cieloColore(1, 3);
    g.bordoBianco(0.55, 3);
    g.musica('finale');
    await g.bianco(0, 1.6);
    await g.attendi(2.0);
    const b = g.attore('gogo');
    b.visibile = true;
    b.conBorsa = true;
    b.teletrasporta(14.5, L.z + 0.35, -1);
    Audio.abbaio(b.x, b.z);
    g.onda(11, L.z + 0.2, 'abbaio');
    chiamaGogo(g, 'GOGO!');
    g.controllo(false);
    L.verso = 1;
    g.inquadra([L.x + 1.7, 0.95, L.z + 3.4], [L.x + 1.3, 0.6, L.z], 1.5, 40);
    await b.percorri([[L.x + 0.95, L.z + 0.22]], 3.2);
    b.guarda(L.x, L.z);
    L.posa('sorpresa', 2);
    g.concentra([L.x + 0.5, 0.7, L.z], 1.8, '#fffaf0', 0.85);
    g.scintille(L.x, L.y + 1.2, L.z, 20, { forma: [FORME.stella] });
    // i fiori della piazzetta cantano di gioia
    const fiori = g.attore('fiori');
    if (fiori) {
      Audio.coro(fiori.x, fiori.z);
      g.emettitore(fiori.x, 0.9, fiori.z, 3, { forma: FORME.nota, colori: ['#f7a8c8', '#fff3a8', '#c9b6ea'], velocita: 0.3, su: 0.7, vita: 2.2, dim: 0.18 });
    }
    await g.attendi(1.4);
    // l'abbraccio
    await g.bianco(0.7, 0.25);
    L.nascosta = true;
    b.visibile = false;
    const abbraccio = g.sagomaAbbraccio(L.x + 0.45, L.z + 0.1);
    g.inquadra([L.x + 0.45, 0.85, L.z + 2.7], [L.x + 0.45, 0.62, L.z + 0.1], 0, 38);
    await g.bianco(0, 0.8);
    g.inquadra([L.x + 0.45, 0.8, L.z + 2.2], [L.x + 0.45, 0.6, L.z + 0.1], 6, 36);
    const cuori = g.ogni(0.25, () => g.particelle.emetti(L.x + 0.45, 0.9, L.z, 3, { forma: [FORME.cuore, FORME.stella], colori: ['#f7a8c8', '#ffd36b', '#ffffff'], su: 0.9, velocita: 0.5, vita: 1.8, dim: 0.14 }));
    Audio.abbaio(L.x + 0.45, L.z);
    await g.attendi(1.5);
    g.dono(L.x + 0.45, 1.0, L.z);
    // festa finale: una pioggia di stelle, cuori e note su tutta la piazzetta
    const festa = g.ogni(0.3, () => g.luci.emetti(L.x + (Math.random() - 0.5) * 6, 3.5, L.z - Math.random() * 2, 6, {
      forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#f7b6d8', '#a8d8ff'], velocita: 0.4, su: -0.3, gravita: 0.4, vita: 2.5, dim: 0.18,
    }));
    await g.attendi(5);
    cuori.ferma();
    festa.ferma();
    await g.bianco(1, 2.5);
    abbraccio.visibile = false;
    L.nascosta = false;
    g.fine();
  },
};

/* ======================================================================== */
const CAPITOLI = [
  ['prologo', PROLOGO],
  ['cap1', CAPITOLO_1],
  ['cap2', CAPITOLO_2],
  ['cap3', CAPITOLO_3],
  ['cap4', CAPITOLO_4],
  ['cap5', CAPITOLO_5],
  ['finale', FINALE],
];

/** Fa partire la storia dal capitolo indicato (o dall'inizio). */
export async function avviaStoria(g, daCapitolo) {
  let inizio = CAPITOLI.findIndex(([nome]) => nome === daCapitolo);
  if (inizio < 0) inizio = 0;
  for (let k = inizio; k < CAPITOLI.length; k++) {
    const [nome, capitolo] = CAPITOLI[k];
    g.salva(nome);
    if (k === inizio && k > 0) await capitolo.prepara(g);
    await capitolo.gioca(g);
  }
}
