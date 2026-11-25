/* ==========================================================================
 *  storia.js — LA STORIA DEL GIOCO (la "sceneggiatura")
 *  --------------------------------------------------------------------------
 *  Ispirata al cortometraggio «Out of Sight» (敲敲, 2010), e ampliata:
 *
 *    PROLOGO    La passeggiata — Lia e Biscotto nella Via del Caffè; il
 *               ladro, la borsa rubata, Biscotto che sparisce nella
 *               staccionata. Il mondo diventa bianco.
 *    CAPITOLO 1 Toc toc — il bastoncino nel buco, il mondo che si disegna,
 *               la bacchetta magica e il vestito da streghetta.
 *    CAPITOLO 2 Il profumo del pane — la città immaginata, il forno.
 *    CAPITOLO 3 Il gattino del vicolo — un gattino fa strada fino al canale.
 *    CAPITOLO 4 La città sull'acqua — le auto che galleggiano, gli
 *               abitanti-animali sul ponte, la libreria della Tigre.
 *    CAPITOLO 5 La balena del cielo — il volo sopra la città.
 *    FINALE     Ritrovati — Biscotto torna con la borsa.
 *
 *  Ogni capitolo ha:
 *    prepara(g): rimette le cose a posto se si riprende da un salvataggio
 *    gioca(g):   la sequenza degli eventi (con "await" si aspetta)
 *  "g" è il Gioco: vedi i "COMANDI PER LA STORIA" in main.js.
 * ========================================================================== */
import { Audio } from '../gioco/audio.js';
import { Input } from '../gioco/input.js';
import { FORME } from '../motore/particelle.js';

const distanza = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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
    g.lia.vestiti('lia_borsa');
    g.lia.puoToccare = false;
    g.lia.magica = false;
    g.ui.mostraToc(false);
    g.coloraMondo(1);          // Biscotto guida Lia: il mondo è tutto colorato
    g.cieloColore(1);
    g.bordoBianco(0);
    g.vista('terza');
    const b = g.attore('biscotto');
    b.visibile = true;
    b.guinzaglio = g.lia;
    g.guinzaglio(true);
    g.bianco(0, 2);
    await g.capitolo('Prologo', 'La passeggiata');
    g.obiettivo('Passeggia con Biscotto lungo la via');
    g.pensa('Che bella giornata! Senti, Biscotto? Profumo di caffè.', 4.5);
    g.pensa(Input.eTouch
      ? 'Joystick a sinistra per camminare, trascina a destra per guardarti intorno.'
      : 'Muoviti con W A S D o le frecce, guarda col mouse. V cambia la vista.', 6);

    // --- il ladro --------------------------------------------------------
    await g.quando(() => g.lia.x > 13);
    const ladro = g.attore('ladro');
    ladro.teletrasporta(Math.min(42.5, g.lia.x + 15), 4.45, Math.PI);
    ladro.visibile = true;
    g.pensa('Passi pesanti... qualcuno ci viene incontro.', 3);
    while (distanza(ladro, g.lia) > 1.3) {
      ladro.vaiA(g.lia.x + 0.8, g.lia.y < 4.6 ? 4.9 : 4.3, 1.4);
      await g.attendi(0.2);
    }
    g.controllo(false);
    ladro.ferma();
    ladro.guarda(g.lia.x, g.lia.y);
    ladro.posa('scippo', 0.7);
    Audio.scippo(ladro.x, ladro.y);
    g.lia.vestiti('lia');
    g.lia.posa('sorpresa', 2.5);
    g.telecamera.scuoti(0.7);
    g.pensa('Ehi! La mia borsa!', 2.5, true);
    b.guinzaglio = null;
    g.guinzaglio(false);
    b.guarda(ladro.x, ladro.y);
    b.posa('ringhia', 1.3);
    Audio.ringhio(b.x, b.y);
    await g.attendi(0.7);
    ladro.percorri([[48, 4.45]], 3.6);
    await g.attendi(0.6);
    b.faVerso(g.mondo);
    b.percorri([[37.6, 4.55], [38.5, 3.7]], 4.2).then(() => { b.visibile = false; });
    g.pensa('«Biscotto! Aspetta!»', 2.5);
    await g.attendi(1.0);
    g.controllo(true);
    g.obiettivo('Corri dietro a Biscotto!');
    g.quando(() => ladro.x > 45).then(() => { ladro.visibile = false; });

    // --- la staccionata --------------------------------------------------
    await g.quando(() => g.lia.x > 36.0);
    g.controllo(false);
    await g.lia.vaiA(38.5, 4.35, 2.2);
    g.lia.angolo = -Math.PI / 2;
    Audio.botta();
    g.telecamera.scuoti(1.2);
    g.lia.posa('sorpresa', 1.5);
    await g.bianco(1, 0.3);
    // il mondo diventa bianco: senza Biscotto, Lia non sa più dove si trova
    g.coloraMondo(0);
    g.cieloColore(0.15);
    g.bordoBianco(1);
    g.musica('bianco');
    g.inquadra([37.1, 1.05, 5.4], [38.6, 0.7, 3.9], 0.1);
    await g.bianco(0, 2.2);
    g.lia.posa('ascolta', Infinity);
    await g.attendi(1.2);
    Audio.abbaio(38.5, 0.8);
    g.onda(38.5, 3.6, 'abbaio');
    g.pensa('Bau... bau... È dall\'altra parte!', 3, true);
    await g.attendi(2);
    await g.dialogo('lia', [
      'Biscotto... dove sei? Senza di te è tutto bianco... non so più dove sono.',
      'Però posso ascoltare. E posso toccare.',
    ]);
    g.lia.posa(null, 0);
    g.libera();
    g.controllo(true);
  },
};

/* ======================================================================== */
const CAPITOLO_1 = {
  async prepara(g) {
    await g.vai('via', 'inizio', { subito: true });
    g.lia.vestiti('lia');
    g.lia.posiziona(38.5, 4.4, -Math.PI / 2);
    g.attore('biscotto').visibile = false;
    g.coloraMondo(0); g.cieloColore(0.15); g.bordoBianco(1);
    g.musica('bianco');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    await g.capitolo('Capitolo 1', 'Toc toc');
    g.obiettivo('Tocca la staccionata, in basso');
    g.interazione('buco', true);
    await g.evento('interagisci:buco');
    g.interazione('buco', false);
    g.controllo(false);
    g.lia.posa('ascolta', 2);
    await g.dialogo('lia', [
      'C\'è un buco, qui in basso... Biscotto è passato di qui!',
      'È troppo piccolo per me. Ma dentro c\'è... qualcosa di liscio.',
      'Un bastoncino!',
    ]);
    g.lia.puoToccare = true;
    g.ui.mostraToc(true, false);
    g.ricordo('bastone', 'Il bastoncino');
    g.controllo(true);
    g.obiettivo('Batti il bastone per «vedere» intorno a te');
    g.pensa(Input.eTouch
      ? 'Tocca il pulsante «Toc!» oppure la parte destra dello schermo.'
      : 'Premi SPAZIO o clicca per battere il bastone.', 6, true);
    for (let k = 0; k < 4; k++) {
      await g.evento('tocco');
      if (k === 0) g.pensa('Toc toc... il suono rimbalza e il mondo si disegna!', 4, true);
      if (k === 2) g.pensa('Più busso, più vedo. Come un pennello fatto di suoni.', 4, true);
    }
    await g.attendi(1);

    // --- la trasformazione -------------------------------------------------
    g.controllo(false);
    await g.dialogo('lia', ['Ogni volta che il bastone bussa, il mondo si colora...', 'Ehi... il bastoncino è tiepido. Brilla!']);
    const L = g.lia;
    const fx = Math.cos(L.angolo), fy = Math.sin(L.angolo);
    g.inquadra([L.x + fx * 2.3, 0.95, L.y + fy * 2.3], [L.x, 0.55, L.y], 1.2);
    await g.attendi(1.2);
    Audio.trasformazione();
    g.onda(L.x, L.y, 'magia');
    const giro = g.ogni(0.08, () => g.scintille(L.x, L.quota + 0.1 + Math.random() * 0.9, L.y, 6, { velocita: 2, su: 1.4, sparpaglia: 0.3 }));
    await g.attendi(0.9);
    await g.bianco(0.92, 0.35);
    streghetta(g);
    g.musica('magia');
    g.cieloColore(0.6, 2);
    await g.bianco(0, 1.2);
    giro.ferma();
    L.posa('saluta', 3);
    g.scintille(L.x, L.quota + 1, L.y, 50, { forma: [FORME.stella, FORME.cuore, FORME.scintilla], velocita: 2.5 });
    await g.dialogo('lia', [
      'Una bacchetta con la stella... e un vestito da streghetta!',
      'Con questa posso immaginare tutto quello che sento.',
      'Arrivo, Biscotto!',
    ]);
    g.libera();
    g.controllo(true);
    // la staccionata incantata
    const brillio = g.emettitore(38.5, 0.35, 3.9, 10, { forma: [FORME.stella, FORME.scintilla], colori: ['#fff0a0', '#ffd36b', '#ffffff'], su: 0.7, velocita: 0.5, vita: 1.4, dim: 0.15 });
    g.interazione('passaggio', true);
    g.obiettivo('Attraversa la staccionata incantata');
    g.pensa('Il buco nella staccionata brilla... ora ci posso passare!', 4, true);
    await g.evento('interagisci:passaggio');
    brillio.attivo = false;
    g.interazione('passaggio', false);
    Audio.magia(0.6);
    await g.vai('oltre', 'ingresso');
  },
};

/* ======================================================================== */
const CAPITOLO_2 = {
  async prepara(g) {
    streghetta(g);
    await g.vai('oltre', 'ingresso', { subito: true });
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    mondoImmaginato(g);
    g.musica('magia');
    await g.capitolo('Capitolo 2', 'Il profumo del pane');
    g.pensa('Che profumo... pane appena sfornato!', 4);
    g.obiettivo('Segui il profumo del pane');
    const scie = [[5.4, 15.2], [4.4, 16.8], [3.6, 18.4]].map(([x, y]) => g.emettitore(x, 0.9, y, 4, {
      forma: [FORME.briciole, FORME.punto, FORME.fiore], colori: ['#f2d49a', '#e8b878', '#fff3d6'],
      velocita: 0.25, su: 0.15, vita: 2.4, dim: 0.14, vortice: 0.7, sparpaglia: 0.4,
    }));
    const profumo = g.ogni(3.5, () => g.onda(5.5, 14.4, 'profumo'));
    await g.quando(() => Math.hypot(g.lia.x - 5, g.lia.y - 14.9) < 2.6);
    scie.forEach((s) => { s.attivo = false; });
    profumo.ferma();

    g.controllo(false);
    g.onda(5.5, 14.4, 'profumo', { raggio: 9 });
    const f = g.attore('fornaia');
    f.visibile = true;
    f.teletrasporta(4.5, 14.1);
    Audio.campanello();
    f.vaiA(3.7, 14.7, 0.8);
    await g.attendi(1.2);
    await g.dialogo('fornaia', [
      'Oh! Una piccola streghetta davanti alla mia vetrina!',
      'Hai sentito il profumo, vero? È appena uscito dal forno.',
      'Vieni dentro, ti faccio assaggiare qualcosa.',
    ]);
    g.apriPorta('porta_forno');
    g.controllo(true);
    g.obiettivo('Entra nel forno');
    await g.evento('entrato:forno');

    // --- dentro il forno ---------------------------------------------------
    await g.attendi(0.8);
    g.controllo(false);
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
      'Correva verso il vicolo dei gatti, quello che porta al canale.',
      'Tieni: una pagnotta calda per te... e un pezzetto per lui, quando lo ritroverai!',
    ]);
    g.ricordo('pagnotta', 'Il profumo del pane');
    g.controllo(true);
    g.obiettivo('Esci dal forno e cerca il vicolo dei gatti');
    await g.evento('entrato:oltre');
  },
};

/* ======================================================================== */
const CAPITOLO_3 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    await g.vai('oltre', 'dal_forno', { subito: true });
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    await g.capitolo('Capitolo 3', 'Il gattino del vicolo');
    const gatto = g.attore('gattino');
    gatto.visibile = true;
    gatto.teletrasporta(12.9, 13.6, Math.PI / 2);
    gatto.versiAutomatici = true;
    g.obiettivo('Cerca il vicolo a nord della piazzetta');
    await g.quando(() => distanza(g.lia, gatto) < 3.2);
    g.pensa('Miao? Un gattino! Sembra che voglia farmi strada.', 3.5, true);
    g.obiettivo('Segui il gattino');
    const tappe = [[12.8, 10.4], [13.1, 7.6], [17.5, 7.5], [21.8, 7.5], [23.3, 7.6]];
    for (let k = 0; k < tappe.length; k++) {
      await gatto.percorri([tappe[k]], 2.4);
      gatto.guarda(g.lia.x, g.lia.y);
      if (k < tappe.length - 1) await g.quando(() => distanza(g.lia, gatto) < 2.4);
    }
    gatto.versiAutomatici = false;
    gatto.sempreDiFronte = true;
    gatto.posa('seduto', Infinity);
    g.musica('citta');
    g.interazione('gattino', true);
    g.obiettivo('Accarezza il gattino');
    await g.evento('interagisci:gattino');
    g.interazione('gattino', false);
    g.controllo(false);
    Audio.miagolio(gatto.x, gatto.y);
    g.particelle.emetti(gatto.x, 0.6, gatto.y, 12, { forma: [FORME.cuore], colori: ['#f7a8c8', '#ffd1e8'], su: 0.8, velocita: 0.4, vita: 1.6, dim: 0.16 });
    await g.dialogo('lia', ['Che morbido... sembra una nuvola calda.', 'Grazie, micio! Mi hai portata fino al canale.']);
    g.ricordo('gattino', 'Il pelo morbido');
    g.controllo(true);
  },
};

/* ======================================================================== */
const CAPITOLO_4 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    await g.vai('oltre', 'dal_forno', { subito: true });
    g.lia.posiziona(22.5, 7.5, 0);
    mondoImmaginato(g);
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    g.musica('citta');
    await g.capitolo('Capitolo 4', 'La città sull\'acqua');
    g.pensa('La strada... è diventata un fiume! E le auto galleggiano!', 4.5, true);
    g.obiettivo('Chiedi agli abitanti del ponte se hanno visto Biscotto');
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
    await g.quando(() => parlati.has('uccello') || parlati.has('tigre'));
    if (!parlati.has('tigre')) g.obiettivo('Cerca la Tigre davanti alla libreria, sulla riva nord');
    await g.quando(() => parlati.has('tigre'));
    await g.evento('entrato:libreria');

    // --- in libreria -------------------------------------------------------
    await g.attendi(0.6);
    g.controllo(false);
    Audio.pagine(4.5, 3.8);
    await g.dialogo('tigre_dentro', [
      'Ecco: «La Balena del Cielo». Senti come frusciano le pagine?',
      'Qui c\'è scritto: chi la chiama dalla terrazza in fondo al canale...',
      '...può volare sopra tutta la città e vedere ogni cosa.',
      'Il tuo cane non potrà nascondersi! Vai, piccola streghetta.',
    ]);
    g.ricordo('libro_volante', 'Il fruscio delle pagine');
    g.controllo(true);
    g.obiettivo('Esci e vai sulla terrazza in fondo al canale (a est)');
    await g.evento('entrato:oltre');
  },
};

/* ======================================================================== */
const CAPITOLO_5 = {
  async prepara(g) {
    streghetta(g);
    g.apriPorta('porta_forno');
    g.apriPorta('porta_libreria');
    await g.vai('oltre', 'dalla_libreria', { subito: true });
    mondoImmaginato(g);
    g.musica('citta');
    g.bianco(0, 1.5);
  },
  async gioca(g) {
    await g.capitolo('Capitolo 5', 'La balena del cielo');
    g.interazione('terrazza', true);
    g.obiettivo('Sulla terrazza in fondo al canale, chiama la balena');
    await g.evento('interagisci:terrazza');
    g.interazione('terrazza', false);
    g.controllo(false);
    const L = g.lia;
    L.angolo = 0;
    L.posa('tocca', 1.2);
    Audio.toc(true);
    g.onda(L.x, L.y, 'magia');
    g.scintille(L.x, L.quota + 1.2, L.y, 40, { su: 2.5 });
    g.inquadra([L.x - 3, 1.3, L.y + 2], [L.x + 12, 9, L.y - 2], 2);
    Audio.balena();
    await g.dialogo('lia', ['Balena del cielo! Mi porti a cercare Biscotto?']);
    await g.attendi(1.5);
    Audio.balena();
    await g.voloSullaBalena();
    g.libera();
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
    g.particelle.punti.visible = true;
    g.coloraMondo(0);
    g.coloraMondo(1, 4);
    g.cieloColore(1, 3);
    g.bordoBianco(0.55, 3);
    g.musica('finale');
    await g.bianco(0, 1.6);
    await g.capitolo('Finale', 'Ritrovati');
    g.pensa('La balena mi ha lasciata in una piazzetta gialla...', 3.5);
    await g.attendi(2.5);
    const b = g.attore('biscotto');
    b.visibile = true;
    b.conBorsa = true;
    b.teletrasporta(13.5, 5.2, Math.PI);
    Audio.abbaio(b.x, b.y);
    g.onda(11, 5.2, 'abbaio');
    g.pensa('Questo abbaio... lo riconoscerei tra mille!', 3, true);
    g.controllo(false);
    const L = g.lia;
    L.angolo = 0;
    g.inquadra([L.x + 1.4, 1.05, L.y + 2.8], [L.x + 2.2, 0.45, L.y], 1.5);
    await b.percorri([[L.x + 1.05, L.y + 0.1]], 3.2);
    b.guarda(L.x, L.y);
    L.posa('sorpresa', 2);
    g.scintille(L.x, L.quota + 1.2, L.y, 20, { forma: [FORME.stella] });
    await g.attendi(1.4);
    // l'abbraccio
    await g.bianco(0.7, 0.25);
    g.liaNascosta = true;
    b.visibile = false;
    const abbraccio = g.sagomaAbbraccio(L.x + 0.5, L.y + 0.05);
    g.inquadra([L.x + 0.5, 0.75, L.y + 2.1], [L.x + 0.5, 0.45, L.y], 0.1);
    await g.bianco(0, 0.8);
    const cuori = g.ogni(0.25, () => g.particelle.emetti(L.x + 0.5, 0.9, L.y, 3, { forma: [FORME.cuore, FORME.stella], colori: ['#f7a8c8', '#ffd36b', '#ffffff'], su: 0.9, velocita: 0.5, vita: 1.8, dim: 0.16 }));
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
