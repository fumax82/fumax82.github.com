/* ==========================================================================
 *  storia.js — LA STORIA DEL GIOCO (la "sceneggiatura")
 *  --------------------------------------------------------------------------
 *  Ispirata al cortometraggio «Out of Sight» (敲敲, 2010), e ampliata:
 *
 *    PROLOGO    La passeggiata — Lia e Biscotto nella Via del Caffè; il
 *               ladro, la borsa rubata, Biscotto che sparisce nel buco
 *               della staccionata. Il mondo diventa bianco.
 *    CAPITOLO 1 Toc toc — il bastoncino nel buco, il mondo che si disegna,
 *               l'albero contro cui si sbatte, la bacchetta magica.
 *    CAPITOLO 2 Il profumo del pane — la piazza immaginata, il forno.
 *    CAPITOLO 3 Il gattino del vicolo — un gattino fa strada nel vicolo.
 *    CAPITOLO 4 La città sull'acqua — le auto che galleggiano, gli
 *               abitanti-animali sul ponte, la libreria della Tigre.
 *    CAPITOLO 5 La balena del cielo — la terrazza e il volo sulla città.
 *    FINALE     Ritrovati — Biscotto torna con la borsa.
 *
 *  Ogni capitolo ha:
 *    prepara(g): rimette le cose a posto se si riprende da un salvataggio
 *    gioca(g):   la sequenza degli eventi (con "await" si aspetta)
 *  "g" è il Gioco: vedi i "COMANDI PER LA STORIA" in main.js.
 *  Le posizioni sul percorso si chiamano "s" (metri dall'inizio della scena);
 *  per le inquadrature si usano punti del mondo [x, y, z] (vedi g.punto).
 * ========================================================================== */
import { Audio } from '../gioco/audio.js';
import { Input } from '../gioco/input.js';
import { FORME } from '../motore/particelle.js';
import { Sagoma } from '../motore/sagoma.js';

const distanza = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Mette Lia in modalità streghetta (serve per riprendere dai salvataggi). */
function streghetta(g) {
  g.lia.vestiti('lia_strega');
  g.lia.puoToccare = true;
  g.lia.magica = true;
  g.ui.mostraToc(true, true);
}

/** Atmosfera del mondo immaginato: bianco ai bordi, colori dove Lia percepisce. */
function mondoImmaginato(g) {
  g.coloraMondo(0);
  g.cieloColore(0.75);
  g.bordoBianco(1);
}

/* ======================================================================== */
const PROLOGO = {
  async prepara() {},
  async gioca(g) {
    await g.vai('via', 'inizio', { subito: true });
    const L = g.lia;
    L.vestiti('lia_borsa');
    L.puoToccare = false;
    L.magica = false;
    g.ui.mostraToc(false);
    g.coloraMondo(1);          // Biscotto guida Lia: il mondo è tutto colorato
    g.cieloColore(1);
    g.bordoBianco(0);
    const b = g.attore('biscotto');
    b.visibile = true;
    b.guinzaglio = L;
    g.guinzaglio(true);
    L.limiti = [0, 30];
    g.bianco(0, 2);
    await g.capitolo('Prologo', 'La passeggiata');
    g.obiettivo('Passeggia con Biscotto lungo la via');
    g.pensa('Che bella giornata! Senti, Biscotto? Profumo di caffè.', 4.5);
    g.pensa(Input.eTouch
      ? 'Tieni premute le frecce ◀ ▶ per camminare. Tenendole a lungo, Lia corre.'
      : 'Cammina con A / D o le frecce ← →. Tieni premuto Shift per correre.', 6);
    const abbai = g.ogni(7, () => { if (Math.random() < 0.6) b.faVerso(); });

    // --- il ladro --------------------------------------------------------
    await g.quando(() => L.s > 22);
    const ladro = g.attore('ladro');
    ladro.teletrasporta(L.x + 13, 0.72, -1);
    ladro.visibile = true;
    g.pensa('Passi pesanti... qualcuno ci viene incontro.', 3);
    while (ladro.x - L.x > 1.0) {
      ladro.vaiA(L.x + 0.9, 0.72, 1.35);
      await g.attendi(0.2);
    }
    abbai.ferma();
    g.controllo(false);
    ladro.ferma();
    ladro.guarda(L.x, L.z);
    // primo piano: lo scippo
    g.inquadra([L.x + 0.6, 1.05, 2.9], [L.x + 0.55, 0.95, 0.2], 0, 40);
    ladro.posa('scippo', 0.9);
    Audio.scippo(ladro.x, ladro.z);
    L.vestiti('lia');
    L.posa('sorpresa', 2.5);
    g.regia.scuoti(0.7);
    g.pensa('Ehi! La mia borsa!', 2.5, true);
    b.guinzaglio = null;
    g.guinzaglio(false);
    b.guarda(ladro.x, ladro.z);
    b.posa('ringhia', 1.3);
    Audio.ringhio(b.x, b.z);
    await g.attendi(0.9);
    g.libera(true);
    ladro.percorri([[54, 0.72]], 3.8).then(() => { ladro.visibile = false; });
    await g.attendi(0.5);
    b.faVerso();
    b.percorri([[46.0, 0.1], [46.9, 0.0]], 4.2).then(() => { b.visibile = false; });
    g.pensa('«Biscotto! Aspetta!»', 2.5);
    await g.attendi(0.8);
    L.limiti = null;
    g.controllo(true);
    g.obiettivo('Corri dietro a Biscotto!');

    // --- la staccionata --------------------------------------------------
    await g.quando(() => L.s > 44.2);
    g.controllo(false);
    await L.vaiA(45.75, 2.4);
    Audio.botta();
    g.regia.scuoti(1.2);
    L.posa('urto', 1.2);
    await g.bianco(1, 0.3);
    // il mondo diventa bianco: senza Biscotto, Lia non sa più dove si trova
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
    g.pensa('Bau... bau... È dall\'altra parte!', 3, true);
    await g.attendi(2);
    await g.dialogo('lia', [
      'Biscotto... dove sei? Senza di te è tutto bianco... non so più dove sono.',
      'Però posso ascoltare. E posso toccare.',
    ]);
    L.posa(null, 0);
    g.libera();
    g.controllo(true);
  },
};

/* ======================================================================== */
const CAPITOLO_1 = {
  async prepara(g) {
    await g.vai('via', 'staccionata', { subito: true });
    g.lia.vestiti('lia');
    g.attore('biscotto').visibile = false;
    g.coloraMondo(0); g.cieloColore(0.15); g.bordoBianco(1);
    g.musica('bianco');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    g.attore('biscotto').visibile = false;
    await g.capitolo('Capitolo 1', 'Toc toc');
    g.obiettivo('Tocca la staccionata, in basso');
    g.interazione('buco', true);
    await g.evento('interagisci:buco');
    g.interazione('buco', false);
    g.controllo(false);
    L.posa('china', Infinity);
    g.inquadra([45.0, 0.45, 1.35], [46.4, 0.3, 0], 1.0, 44);
    await g.dialogo('lia', [
      'C\'è un buco, qui in basso... Biscotto è passato di qui!',
      'È troppo piccolo per me. Ma dentro c\'è... qualcosa di liscio.',
      'Un bastoncino!',
    ]);
    L.posa(null, 0);
    g.libera();
    L.puoToccare = true;
    g.ui.mostraToc(true, false);
    g.ricordo('bastone', 'Il bastoncino');
    g.controllo(true);
    g.obiettivo('Batti il bastone per «vedere» intorno a te');
    g.pensa(Input.eTouch
      ? 'Tocca il pulsante «Toc!» oppure lo schermo.'
      : 'Premi SPAZIO o clicca per battere il bastone.', 6, true);
    for (let k = 0; k < 3; k++) {
      await g.evento('tocco');
      if (k === 0) g.pensa('Toc toc... il suono rimbalza e il mondo si disegna!', 4, true);
      if (k === 2) g.pensa('Più busso, più vedo. Come un pennello fatto di suoni.', 4, true);
    }

    // --- l'esplorazione nel mondo bianco (e l'albero!) --------------------
    g.obiettivo('Torna indietro lungo la via e scopri le meraviglie nascoste ✦');
    g.pensa('E se torno indietro? Attenta... non so che cosa c\'è davanti a me.', 4.5);
    g.pensa('Nel bianco sono nascoste delle meraviglie: bussa vicino alle cose e scoprile! ✦', 5);
    L.limiti = [18, 46.2];
    await Promise.race([g.evento('urto'), g.quando(() => L.s < 24)]);
    await g.attendi(1.2);
    g.pensa('Ogni cosa che tocco o che sento... prende colore.', 4);
    await g.quando(() => L.s < 30 || L.colpi > 9);
    await g.attendi(0.6);

    // --- la trasformazione -------------------------------------------------
    g.controllo(false);
    await g.dialogo('lia', ['Ogni volta che il bastone bussa, il mondo si colora...', 'Ehi... il bastoncino è tiepido. Brilla!']);
    const p = g.punto(L.s);
    g.inquadra([p[0] + 1.0, p[1] + 0.85, p[2] + 2.5], [p[0], p[1] + 0.6, p[2]], 1.2, 40);
    await g.attendi(1.2);
    Audio.trasformazione();
    g.onda(L.x, L.z, 'magia');
    const giro = g.ogni(0.08, () => g.scintille(L.x, L.y + 0.1 + Math.random() * 1.0, L.z, 6, { velocita: 2, su: 1.4, sparpaglia: 0.3 }));
    await g.attendi(0.9);
    await g.bianco(0.92, 0.35);
    streghetta(g);
    g.musica('magia');
    g.cieloColore(0.6, 2);
    await g.bianco(0, 1.2);
    giro.ferma();
    L.posa('saluta', 3);
    g.scintille(L.x, L.y + 1, L.z, 50, { forma: [FORME.stella, FORME.cuore, FORME.scintilla], velocita: 2.5 });
    await g.dialogo('lia', [
      'Una bacchetta con la stella... e un vestito da streghetta!',
      'Con questa posso immaginare tutto quello che sento.',
      'Arrivo, Biscotto!',
    ]);
    L.posa(null, 0);
    L.limiti = null;
    g.libera();
    g.controllo(true);
    // la staccionata incantata
    const brillio = g.emettitore(46.5, 0.32, 0, 10, { forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff'], su: 0.7, velocita: 0.5, vita: 1.4, dim: 0.13 });
    const richiamo = g.ogni(4, () => g.onda(46.4, 0, 'magia', { raggio: 4, forza: 0.5 }));
    g.interazione('passaggio', true);
    g.obiettivo('Torna alla staccionata incantata');
    g.pensa('Il buco nella staccionata brilla... ora ci posso passare!', 4, true);
    await g.evento('interagisci:passaggio');
    brillio.attivo = false;
    richiamo.ferma();
    g.interazione('passaggio', false);
    Audio.magia(0.6);
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
    await g.capitolo('Capitolo 2', 'Il profumo del pane');
    g.pensa('Che profumo... pane appena sfornato!', 4);
    g.obiettivo('Segui il profumo del pane');
    const profumo = g.ogni(3.2, () => g.onda(7.6, -1.6, 'profumo'));
    await g.quando(() => Math.abs(L.s - 7.5) < 1.5);
    profumo.ferma();

    g.controllo(false);
    g.onda(7.6, -1.6, 'profumo', { raggio: 9 });
    const f = g.attore('fornaia');
    f.visibile = true;
    f.teletrasporta(7.6, -1.75);
    Audio.campanello();
    f.vaiA(8.1, -0.85, 0.8);
    // campo e controcampo davanti alla vetrina
    g.inquadra([L.x - 0.9, 1.25, 3.5], [L.x + 0.5, 1.05, -0.6], 1.2, 40);
    await g.attendi(1.2);
    await g.dialogo('fornaia', [
      'Oh! Una piccola streghetta davanti alla mia vetrina!',
      'Hai sentito il profumo, vero? È appena uscito dal forno.',
      'Vieni dentro, ti faccio assaggiare qualcosa.',
    ]);
    f.vaiA(7.6, -1.9, 0.9).then(() => { f.visibile = false; });
    g.apriPorta('porta_forno');
    g.libera();
    g.controllo(true);
    g.obiettivo('Entra nel forno');
    await g.evento('entrato:forno');

    // --- dentro il forno ---------------------------------------------------
    await g.attendi(0.8);
    g.controllo(false);
    await L.vaiA(3.4, 1.2);
    await g.dialogo('fornaia_dentro', [
      'Benvenuta! Senti come scoppietta il forno a legna?',
      'Dimmi, cosa ti porta da queste parti?',
    ]);
    await g.dialogo('lia', [
      'Cerco il mio cane, Biscotto. È piccolo, giallo, con le orecchie lunghe...',
      'Un uomo mi ha rubato la borsa e lui l\'ha inseguito.',
    ]);
    await g.dialogo('fornaia_dentro', [
      'Un cagnolino giallo? Sì! È passato di corsa poco fa.',
      'Correva verso il vicolo dei gatti, dopo la casa gialla.',
      'Tieni: una pagnotta calda per te... e un pezzetto per lui, quando lo ritroverai!',
    ]);
    g.ricordo('pagnotta', 'Il profumo del pane');
    g.controllo(true);
    g.obiettivo('Esci dal forno e cerca il vicolo dei gatti');
    await g.evento('entrato:piazza');
  },
};

/* ======================================================================== */
const CAPITOLO_3 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    await g.vai('piazza', 'dal_forno', { subito: true });
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    await g.capitolo('Capitolo 3', 'Il gattino del vicolo');
    const gatto = g.attore('gattino');
    gatto.visibile = true;
    gatto.teletrasporta(21.5, 0.3, -1);
    gatto.versiAutomatici = true;
    g.obiettivo('Cammina verso la casa gialla');
    await g.quando(() => distanza(L, gatto) < 3.4);
    g.pensa('Miao? Un gattino! Sembra che voglia farmi strada.', 3.5, true);
    g.obiettivo('Segui il gattino');
    // Lia non può superare il gattino: è lui che fa strada
    const percorso = g.corrente.percorso;
    const trattieni = g.ogni(0.1, () => { L.limiti = [0, Math.max(L.s, percorso.piuVicino(gatto.x, gatto.z).s - 0.7)]; });
    const tappe = [[26.3, 0.3], [27.9, -1.7], [28.3, -6.4], [28.3, -10.4], [28.3, -13.4]];
    for (let k = 0; k < tappe.length; k++) {
      await gatto.percorri([tappe[k]], 1.7);
      gatto.guarda(L.x, L.z);
      if (k < tappe.length - 1) await g.quando(() => distanza(L, gatto) < 2.6);
    }
    trattieni.ferma();
    gatto.versiAutomatici = false;
    gatto.sempreDiFronte = true;
    gatto.posa('seduto', Infinity);
    g.musica('citta');
    g.interazione('gattino', true);
    g.obiettivo('Accarezza il gattino');
    await g.evento('interagisci:gattino');
    g.interazione('gattino', false);
    g.controllo(false);
    L.posa('china', Infinity);
    gatto.sempreDiFronte = false;
    gatto.guarda(L.x, L.z);
    gatto.posa('strofina', Infinity);
    g.inquadra([L.x + 1.5, 0.7, L.z - 1.6], [L.x + 0.1, 0.4, L.z - 0.4], 1.0, 42);
    Audio.miagolio(gatto.x, gatto.z);
    g.particelle.emetti(gatto.x, 0.6, gatto.z, 12, { forma: [FORME.cuore], colori: ['#f7a8c8', '#ffd1e8'], su: 0.8, velocita: 0.4, vita: 1.6, dim: 0.14 });
    await g.dialogo('lia', ['Che morbido... sembra una nuvola calda.', 'Grazie, micio! Mi hai portata fino in fondo al vicolo.']);
    g.ricordo('gattino', 'Il pelo morbido');
    L.posa(null, 0);
    gatto.sempreDiFronte = true;
    gatto.posa('seduto', Infinity);
    g.libera();
    g.controllo(true);
    L.limiti = null;
    g.interazione('uscita_vicolo', true);
    g.obiettivo('Prosegui oltre il vicolo');
    g.pensa('Sento dell\'acqua che scorre, più avanti...', 3.5);
    await g.evento('interagisci:uscita_vicolo');
    await g.vai('canale', 'vicolo');
  },
};

/* ======================================================================== */
const CAPITOLO_4 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    await g.vai('canale', 'vicolo', { subito: true });
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    g.musica('citta');
    await g.capitolo('Capitolo 4', 'La città sull\'acqua');
    g.pensa('La strada... è diventata un canale! E le auto galleggiano come barchette!', 4.5, true);
    g.obiettivo('Chiedi agli abitanti del ponte se hanno visto Biscotto');
    L.limiti = [0, 36.2];
    const parlati = new Set();
    g.dialoghiSpeciali.lepre = async () => {
      await g.dialogo('lepre', [
        'Buongiorno, streghetta! Senti che profumo di lavanda?',
        'Un cane giallo? Mi dispiace, avevo il naso tra i fiori.',
        'Tieni un rametto di lavanda: porta fortuna a chi cerca.',
      ]);
      if (!parlati.has('lepre')) g.ricordo('vaso_lavanda', 'Il profumo di lavanda');
      parlati.add('lepre');
      delete g.dialoghiSpeciali.lepre;
    };
    g.dialoghiSpeciali.uccello = async () => {
      await g.dialogo('uccello', [
        'Ehm ehm! Un cane giallo con le orecchie lunghe? Sì, sì!',
        'Inseguiva un tipo con la giacca marrone... e una borsa rosa!',
        'Sono andati su, verso la parte alta della città. Da quaggiù non si vede.',
      ]);
      parlati.add('uccello');
    };
    g.dialoghiSpeciali.cavallo = async () => {
      await g.dialogo('cavallo', ['Mmh. (mastica)', 'Dall\'alto si vede tutto, piccola.', 'Chiedi alla Tigre, davanti alla libreria: lei legge tutto e sa tutto.']);
      parlati.add('cavallo');
    };
    g.dialoghiSpeciali.nonna = async () => {
      await g.dialogo('nonna', ['Un cagnolino smarrito? Ai miei tempi i cani si ritrovavano sempre...', '...bastava chiamare la balena del cielo e guardare giù!']);
      parlati.add('nonna');
    };
    g.dialoghiSpeciali.tigre = async () => {
      await g.dialogo('tigre', [
        'Shh... oh, una piccola lettrice? Cerchi qualcosa?',
        'Un cane smarrito... ho proprio il libro che fa per te.',
        'Vieni, entra in libreria.',
      ]);
      g.apriPorta('porta_libreria');
      parlati.add('tigre');
      g.obiettivo('Entra nella libreria della Tigre');
    };
    await g.quando(() => parlati.has('uccello') || parlati.has('tigre') || parlati.has('cavallo'));
    if (!parlati.has('tigre')) g.obiettivo('Cerca la Tigre davanti alla libreria, dopo il ponte');
    await g.quando(() => parlati.has('tigre'));
    await g.evento('entrato:libreria');

    // --- in libreria -------------------------------------------------------
    await g.attendi(0.6);
    g.controllo(false);
    await L.vaiA(5.0, 1.2);
    Audio.pagine(5.5, -1.5);
    await g.dialogo('tigre_dentro', [
      'Ecco: «La Balena del Cielo». Senti come frusciano le pagine?',
      'Qui c\'è scritto: chi la chiama da una terrazza alta, battendo tre volte...',
      '...può volare sopra tutta la città e vedere ogni cosa.',
      'C\'è una terrazza in cima alla scala, in fondo alla via. Vai, piccola streghetta.',
    ]);
    g.ricordo('libro_volante', 'Il fruscio delle pagine');
    g.controllo(true);
    g.obiettivo('Esci dalla libreria');
    await g.evento('entrato:canale');
  },
};

/* ======================================================================== */
const CAPITOLO_5 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    g.apriPorta('porta_libreria');
    await g.vai('canale', 'dalla_libreria', { subito: true });
    mondoImmaginato(g);
    g.musica('citta');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    const L = g.lia;
    mondoImmaginato(g);
    await g.capitolo('Capitolo 5', 'La balena del cielo');
    L.limiti = null;
    g.interazione('scala', true);
    g.obiettivo('Sali la scala in fondo alla via');
    await g.evento('interagisci:scala');
    g.interazione('scala', false);
    await g.vai('terrazza', 'scala');
    mondoImmaginato(g);
    g.cieloColore(0.9, 2);
    g.pensa('Quanto vento quassù... e quanti tetti!', 3.5);
    g.interazione('terrazza', true);
    g.obiettivo('Vai in fondo alla terrazza e chiama la balena');
    await g.evento('interagisci:terrazza');
    g.interazione('terrazza', false);
    g.controllo(false);
    L.verso = 1;
    // tre colpi di bacchetta, come dice il libro
    g.inquadra([L.x - 2.6, 1.2, 6.4], [L.x + 5, 6.5, -12], 2.4, 46);
    for (let k = 0; k < 3; k++) {
      L.tocca(true);
      g.onda(L.x, L.z, 'magia', { raggio: 25 });
      g.scintille(L.x, L.y + 1.2, L.z, 30, { su: 2.5 });
      await g.attendi(0.8);
    }
    // la balena arriva da lontano, nuotando nel cielo
    const balena = new Sagoma('balena', { cielo: true, ancora: 0.5, scala: 0.9 });
    balena.mesh.renderOrder = -2.5;   // davanti alle casette lontane, dietro ai tetti vicini
    balena.aggiungiA(g.corrente.gruppo);
    const da = [L.x + 60, 26, -70], a = [L.x + 6, 7.5, -16];
    let t = 0;
    const nuota = g.ogni(0.016, () => {
      t = Math.min(1, t + 0.016 / 6);
      const e = t * t * (3 - 2 * t);
      balena.posiziona(da[0] + (a[0] - da[0]) * e, da[1] + (a[1] - da[1]) * e + Math.sin(g.tempo * 0.8) * 0.4, da[2] + (a[2] - da[2]) * e);
      balena.mostra('f' + (Math.floor(g.tempo * 0.8) % 2), true);
    });
    Audio.balena();
    await g.dialogo('lia', ['Balena del cielo! Mi porti a cercare Biscotto?']);
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
    await g.capitolo('Finale', 'Ritrovati');
    g.obiettivo('Ascolta...');
    g.pensa('La balena mi ha lasciata in una piazzetta gialla...', 3.5);
    await g.attendi(2.5);
    const b = g.attore('biscotto');
    b.visibile = true;
    b.conBorsa = true;
    b.teletrasporta(14.5, 0.25, -1);
    Audio.abbaio(b.x, b.z);
    g.onda(11, 0.2, 'abbaio');
    g.pensa('Questo abbaio... lo riconoscerei tra mille!', 3, true);
    g.controllo(false);
    L.verso = 1;
    g.inquadra([L.x + 1.7, 0.95, 3.4], [L.x + 1.3, 0.6, 0], 1.5, 40);
    await b.percorri([[L.x + 0.95, 0.22]], 3.2);
    b.guarda(L.x, L.z);
    L.posa('sorpresa', 2);
    g.scintille(L.x, L.y + 1.2, L.z, 20, { forma: [FORME.stella] });
    await g.attendi(1.4);
    // l'abbraccio
    await g.bianco(0.7, 0.25);
    L.nascosta = true;
    b.visibile = false;
    const abbraccio = g.sagomaAbbraccio(L.x + 0.45, 0.1);
    g.inquadra([L.x + 0.45, 0.85, 2.7], [L.x + 0.45, 0.62, 0.1], 0, 38);
    await g.bianco(0, 0.8);
    g.inquadra([L.x + 0.45, 0.8, 2.2], [L.x + 0.45, 0.6, 0.1], 6, 36);
    const cuori = g.ogni(0.25, () => g.particelle.emetti(L.x + 0.45, 0.9, L.z, 3, { forma: [FORME.cuore, FORME.stella], colori: ['#f7a8c8', '#ffd36b', '#ffffff'], su: 0.9, velocita: 0.5, vita: 1.8, dim: 0.14 }));
    await g.dialogo('lia', ['Biscotto! Mi hai ritrovata!', 'E... questa è la mia borsa! L\'hai ripresa tu?']);
    await g.dialogo('biscotto', ['Bau! Bau!']);
    g.ricordo('borsa', 'La borsa ritrovata');
    await g.attendi(2.5);
    cuori.ferma();
    await g.bianco(1, 2.5);
    abbraccio.visibile = false;
    g.fine('Il ladro? Biscotto lo aveva sorpreso vicino a un grande albero: l\'uomo era scappato così in fretta da lasciar cadere la borsa. ' +
      'Da quel giorno, quando Lia batte il suo bastoncino — toc toc — il mondo intorno a lei si riempie di colori.');
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
