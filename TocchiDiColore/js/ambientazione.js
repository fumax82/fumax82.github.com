/* ==========================================================================
 *  ambientazione.js — IL MONDO DEL GIOCO (dati, nessuna logica)
 *  --------------------------------------------------------------------------
 *  Questo è il file da modificare per cambiare il mondo:
 *    - i COLORI della carta, dell'inchiostro e del cielo
 *    - i tipi di MURI (case, botteghe, siepi...) e di PAVIMENTI
 *    - la MAPPA, disegnata con dei caratteri
 *    - gli OGGETTI (alberi, lampioni, fontane, pesci volanti...)
 *    - il PERCORSO del cane, i RICORDI da raccogliere e i TESTI
 *
 *  Il gioco è ispirato al tema del cortometraggio "Out of Sight" (2010):
 *  una bambina cieca che, seguendo il proprio cane, scopre il mondo con
 *  l'udito, il tatto e l'immaginazione. Personaggi, luoghi e grafica di
 *  questo gioco sono originali.
 * ========================================================================== */
window.Gioco = window.Gioco || {};

Gioco.Ambientazione = {
  titolo: 'Tocchi di Colore',
  nomi: { bambina: 'Lia', cane: 'Biscotto' },

  /* ---------------------------------------------------------------------
   * COLORI GENERALI
   * ------------------------------------------------------------------- */
  colori: {
    carta: '#f4eedf',       // colore del "foglio": ciò che Lia non percepisce
    inchiostro: '#4d4254',  // colore dei tratti a matita e dei contorni
    cieloAlto: '#a9c9e6',
    cieloMedio: '#d4e6ee',
    cieloOrizzonte: '#fbe4d0',
    nuvole: '#ffffff',
    ombraNuvole: '#e4dff0',
    sole: '#fff2c2',
  },

  /* ---------------------------------------------------------------------
   * TIPI DI MURO
   * Ogni lettera MAIUSCOLA della mappa è un muro.
   *   ricetta:  quale "disegnatore" di texture usare (vedi texture.js)
   *   altezza:  altezza del muro (gli occhi di Lia sono a 0.5)
   *   varianti: quante versioni diverse della texture creare
   * ------------------------------------------------------------------- */
  muri: {
    A: { nome: 'Casa rosa', ricetta: 'casa', altezza: 1.6, varianti: 2, persiane: true,
         colori: { base: '#f2b9b3', accento: '#8cc0ad', vetro: '#bfd8e8' } },
    B: { nome: 'Casa gialla', ricetta: 'casa', altezza: 1.6, varianti: 2, persiane: true,
         colori: { base: '#f5dc8f', accento: '#7fa7c9', vetro: '#c3dcea' } },
    C: { nome: 'Casa azzurra', ricetta: 'casa', altezza: 1.6, varianti: 2, persiane: false,
         colori: { base: '#b9d9e6', accento: '#e8a0a0', vetro: '#e6f2f7' } },
    D: { nome: 'Mattoni', ricetta: 'mattoni', altezza: 1.6, varianti: 2,
         colori: { base: '#e3a48c', malta: '#f1dccd', vetro: '#c3dcea' } },
    E: { nome: 'Forno', ricetta: 'bottega', altezza: 1.6, varianti: 1, testo: 'PANE', merce: 'pane',
         colori: { base: '#f4d8ad', insegna: '#fbf3e2', testo: '#8a5a3c', tenda1: '#d39570',
                   tenda2: '#fbeedd', legno: '#a8774f', vetro: '#f6ead2' } },
    F: { nome: 'Fioraio', ricetta: 'bottega', altezza: 1.6, varianti: 1, testo: 'FIORI', merce: 'fiori',
         colori: { base: '#c4e5cc', insegna: '#fff7f1', testo: '#c0587a', tenda1: '#f1a6bd',
                   tenda2: '#fff7f1', legno: '#8a9f78', vetro: '#eef7f2' } },
    G: { nome: 'Staccionata', ricetta: 'staccionata', altezza: 0.7, varianti: 1,
         colori: { base: '#e2bf93', scuro: '#a9825c', traverse: '#cfa678' } },
    H: { nome: 'Siepe', ricetta: 'siepe', altezza: 0.9, varianti: 2,
         colori: { base: '#93c785', scuro: '#79b16f', chiaro: '#b3dca1', fiori: '#fff6f8' } },
    J: { nome: 'Casetta lilla', ricetta: 'casa', altezza: 1.6, varianti: 2, finestra: 'tonda', decorazioni: 'stelle',
         colori: { base: '#d9c7ef', accento: '#9f88cf', vetro: '#fdf1c9' } },
  },

  // Pavimento usato "sotto" i muri (serve solo per completezza)
  pavimentoSottoMuri: '.',

  /* ---------------------------------------------------------------------
   * TIPI DI PAVIMENTO
   * Ogni carattere minuscolo o simbolo della mappa è un pavimento.
   *   calpestabile: false = non ci si può camminare sopra (acqua, vuoto)
   *   animata:      la texture si muove lentamente (acqua)
   * ------------------------------------------------------------------- */
  pavimenti: {
    '.': { nome: 'Marciapiede', ricetta: 'marciapiede', calpestabile: true,
           colori: { base: '#e9e2d4', fuga: '#d6cdbd' } },
    ',': { nome: 'Strada', ricetta: 'strada', calpestabile: true,
           colori: { base: '#c0c5d2', riga: '#fbf6e9' } },
    ';': { nome: 'Strada con riga', ricetta: 'strada', riga: true, calpestabile: true,
           colori: { base: '#c0c5d2', riga: '#fbf6e9' } },
    'p': { nome: 'Selciato', ricetta: 'piazza', calpestabile: true,
           colori: { base: '#ddd3c6', fuga: '#c7baab' } },
    'g': { nome: 'Erba', ricetta: 'erba', calpestabile: true,
           colori: { base: '#bcdfa6', scuro: '#a6d18f', chiaro: '#d0ebbd' } },
    'f': { nome: 'Prato fiorito', ricetta: 'erba', fiori: true, calpestabile: true,
           colori: { base: '#c3e3ae', scuro: '#a9d393', chiaro: '#d7eec5' } },
    's': { nome: 'Sentiero', ricetta: 'sentiero', calpestabile: true,
           colori: { base: '#eddab5', sassi: '#d6be96' } },
    'w': { nome: 'Acqua', ricetta: 'acqua', calpestabile: false, animata: true,
           colori: { base: '#a8dbeb', chiaro: '#dff4fa' } },
    ' ': { nome: 'Ignoto', ricetta: 'vuoto', calpestabile: false, colori: {} },
  },

  /* ---------------------------------------------------------------------
   * MAPPA
   * Ogni riga è una fila di caselle da ovest (sinistra) a est (destra);
   * la prima riga è il nord. Tutte le righe devono avere la stessa lunghezza.
   *
   *   A B C D  case          E forno       F fioraio
   *   G staccionata          H siepe       J casetta lilla
   *   . marciapiede   , strada   ; strada con riga   p selciato
   *   g erba   f prato fiorito   s sentiero   w acqua   (spazio) ignoto
   *
   * Zone: a ovest la via con le botteghe, a nord la piazza con la fontana,
   * a sud un cortile; a est, oltre la staccionata, il parco immaginario.
   * ------------------------------------------------------------------- */
  mappa: [
    //          1111111111222222222233333
    //01234567890123456789012345678901234 5
    'AAAAABBBCCCCCCCBBBDDDD              ', // 0
    'AAAAABBBCCCCCCCBBBDDDDHHHHHHHHHHHHHH', // 1
    'AAAAABBBCCpppppDBBDDDDHffffggggggggH', // 2
    'AAAAABBBCCpppppDBBDDDDHffffggggggggH', // 3
    'AAAAABBBCFpppppDBBDDDDHffffgggggsggH', // 4
    'AAAAABBBCFpppppDBBDDDDHffffgggggsggH', // 5
    'AAAAABBBCFpppppDBBDDDDHffffgggggsggH', // 6
    'AAAAABBBCCpppppDBBDDDDHffffgwwggsggH', // 7
    'AAAAABBBCCpppppDBBDDDDHggggwwwwgsggH', // 8
    'AAAAABBBCCpppppDBBDDDDHggggwwwwgsggH', // 9
    'CAAAAEEECCpppppBBBDDAAHgggggwwggsggH', // 10
    'C.....................GgggggggggsggH', // 11
    'C,,,,,,,,,,,,,,,,,,,,,GggggssssssggH', // 12
    'C;;;;;;;;;;;;;;;;;;;;;sssssggggggggH', // 13
    'C,,,,,,,,,,,,,,,,,,,,,GgggssgggffffH', // 14
    'C.....................GggggsgggffffH', // 15
    'CDDDAA.CCCBBBDDDAAACCCHgggggsggffffH', // 16
    'CDDDAA.CCCBBBDDDAAACCCHgggggsggffffH', // 17
    'CDDDAA.CCCBBBDDDAAACCCHggggggsgggggH', // 18
    'CDDpppppppBBBDDDAAACCCHfffggggsggggH', // 19
    'CDDpppppppBBBDDDAAACCCHfffggggssJJJH', // 20
    'CDDpppppppBBBDDDAAACCCHfffggggggJJJH', // 21
    'CDDpppppppBBBDDDAAACCCHfffggggggJJJH', // 22
    'CDDDAAACCCBBBDDDAAACCCHfffgggggggggH', // 23
    'CDDDAAACCCBBBDDDAAACCCHHHHHHHHHHHHHH', // 24
    'CDDDAAACCCBBBDDDAAACCC              ', // 25
  ],

  /* ---------------------------------------------------------------------
   * PUNTO DI PARTENZA DI LIA
   * angolo: 0 = est, π/2 = sud, π = ovest, -π/2 = nord (in radianti)
   * ------------------------------------------------------------------- */
  giocatore: { x: 2.5, y: 13.5, angolo: 0 },

  /* ---------------------------------------------------------------------
   * IL CANE (Biscotto)
   * Aspetta in ogni punto del percorso abbaiando; quando Lia si avvicina
   * corre al punto successivo. Nell'ultimo punto aspetta con la borsa.
   * ------------------------------------------------------------------- */
  cane: {
    percorso: [
      [9.5, 13.5], [15.5, 13.2], [20.8, 13.5], [24.5, 13.5], [27.5, 15.2], [30.5, 20.5],
    ],
    distanzaFuga: 3.0,   // quanto vicino deve arrivare Lia prima che il cane riparta
    velocita: 3.0,       // velocità di corsa del cane
    distanzaVittoria: 1.5,  // quanto vicino bisogna arrivare per ritrovarlo
  },

  /* ---------------------------------------------------------------------
   * TIPI DI OGGETTO
   *   sprite:  nomi delle immagini (vedi sprite.js); più nomi = animazione
   *   fps:     velocità dell'animazione
   *   altezza: altezza nel mondo
   *   z:       altezza da terra (per oggetti sospesi)
   *   solido:  se true Lia non lo può attraversare (raggio = ingombro)
   *   ombra:   raggio dell'ombra a terra (0 = nessuna ombra)
   *   luce:    quanto l'oggetto è visibile anche se non percepito (0..1)
   *   suono:   suono che emette ('acqua' = fontana)
   *   ricordo: messaggio mostrato quando Lia raccoglie l'oggetto
   * ------------------------------------------------------------------- */
  tipiOggetto: {
    albero:      { sprite: ['albero'], altezza: 1.75, solido: true, raggio: 0.28, ombra: 0.55 },
    alberoSogno: { sprite: ['alberoSogno'], altezza: 1.8, solido: true, raggio: 0.28, ombra: 0.55 },
    cespuglio:   { sprite: ['cespuglio'], altezza: 0.45, solido: true, raggio: 0.3, ombra: 0.38 },
    lampione:    { sprite: ['lampione'], altezza: 1.45, solido: true, raggio: 0.1, ombra: 0.16 },
    panchina:    { sprite: ['panchina'], altezza: 0.42, solido: true, raggio: 0.35, ombra: 0.45 },
    fontana:     { sprite: ['fontana_0', 'fontana_1', 'fontana_2'], fps: 7, altezza: 1.0, solido: true,
                   raggio: 0.62, ombra: 0.72, suono: 'acqua' },
    fioriera:    { sprite: ['fioriera'], altezza: 0.34, ombra: 0.2 },
    girasole:    { sprite: ['girasole'], altezza: 1.7, solido: true, raggio: 0.15, ombra: 0.32 },
    fungo:       { sprite: ['fungo'], altezza: 0.75, solido: true, raggio: 0.25, ombra: 0.36 },
    gatto:       { sprite: ['gatto_0', 'gatto_1'], fps: 0.8, altezza: 0.32, ombra: 0.18 },
    borsa:       { sprite: ['borsa'], altezza: 0.26, ombra: 0.16 },
    pesce:       { sprite: ['pesce_0', 'pesce_1'], fps: 5, altezza: 0.24, orientabile: true, ombra: 0.12, luce: 0.12 },
    farfalla:    { sprite: ['farfalla_0', 'farfalla_1'], fps: 9, altezza: 0.13, orientabile: true, luce: 0.12 },

    // --- I cinque RICORDI da raccogliere -------------------------------
    pane:       { sprite: ['pane'], altezza: 0.22, z: 0.12, luce: 0.35, ombra: 0.1,
                  ricordo: 'Profumo di pane appena sfornato: il mondo si scalda di colori.' },
    fiore:      { sprite: ['fiore'], altezza: 0.24, z: 0.12, luce: 0.35, ombra: 0.1,
                  ricordo: 'Petali di velluto sotto le dita. Che profumo!' },
    campanella: { sprite: ['campanella'], altezza: 0.22, z: 0.12, luce: 0.35, ombra: 0.1,
                  ricordo: 'Una campanella! Ogni suono disegna una forma nuova.' },
    conchiglia: { sprite: ['conchiglia'], altezza: 0.22, z: 0.12, luce: 0.35, ombra: 0.1,
                  ricordo: 'Dentro la conchiglia c\'è il respiro del mare.' },
    carillon:   { sprite: ['carillon'], altezza: 0.24, z: 0.12, luce: 0.35, ombra: 0.1,
                  ricordo: 'Un piccolo carillon: la sua melodia riempie l\'aria di colori.' },
  },

  /* ---------------------------------------------------------------------
   * OGGETTI NEL MONDO
   * movimento (facoltativo): l'oggetto gira in cerchio attorno a (cx, cy)
   *   raggio, velocita (radianti/s, negativa = senso opposto), fase iniziale,
   *   z = altezza di volo, ampiezzaZ = quanto sale e scende
   * ------------------------------------------------------------------- */
  oggetti: [
    // --- La via -------------------------------------------------------
    { tipo: 'lampione', x: 3.5, y: 11.2 },
    { tipo: 'lampione', x: 9.5, y: 11.2 },
    { tipo: 'lampione', x: 16.5, y: 11.2 },
    { tipo: 'lampione', x: 5.0, y: 15.8 },
    { tipo: 'lampione', x: 12.5, y: 15.8 },
    { tipo: 'lampione', x: 19.5, y: 15.8 },
    { tipo: 'fioriera', x: 1.6, y: 11.2 },
    { tipo: 'fioriera', x: 7.7, y: 11.2 },
    { tipo: 'fioriera', x: 14.2, y: 15.8 },
    { tipo: 'fioriera', x: 20.6, y: 11.2 },
    { tipo: 'pane', x: 6.5, y: 11.5 },

    // --- La piazza con la fontana ---------------------------------------
    { tipo: 'fontana', x: 12.5, y: 6.0 },
    { tipo: 'albero', x: 10.7, y: 2.8 },
    { tipo: 'albero', x: 14.3, y: 2.8 },
    { tipo: 'panchina', x: 14.4, y: 6.2 },
    { tipo: 'lampione', x: 10.6, y: 9.0 },
    { tipo: 'lampione', x: 14.4, y: 9.0 },
    { tipo: 'fioriera', x: 10.3, y: 6.9 },
    { tipo: 'fiore', x: 10.6, y: 5.4 },

    // --- Il cortile ---------------------------------------------------
    { tipo: 'gatto', x: 3.6, y: 19.6 },
    { tipo: 'panchina', x: 8.2, y: 22.5 },
    { tipo: 'fioriera', x: 3.5, y: 22.5 },
    { tipo: 'fioriera', x: 9.4, y: 19.5 },
    { tipo: 'campanella', x: 5.5, y: 21.6 },

    // --- Il parco immaginario -------------------------------------------
    { tipo: 'albero', x: 24.3, y: 9.7 },
    { tipo: 'albero', x: 33.8, y: 10.8 },
    { tipo: 'albero', x: 27.0, y: 19.2 },
    { tipo: 'alberoSogno', x: 29.5, y: 3.0 },
    { tipo: 'alberoSogno', x: 24.0, y: 16.5 },
    { tipo: 'alberoSogno', x: 33.6, y: 18.4 },
    { tipo: 'cespuglio', x: 23.6, y: 11.4 },
    { tipo: 'cespuglio', x: 26.3, y: 11.0 },
    { tipo: 'cespuglio', x: 34.2, y: 12.8 },
    { tipo: 'girasole', x: 23.6, y: 2.6 },
    { tipo: 'girasole', x: 26.4, y: 3.3 },
    { tipo: 'girasole', x: 33.9, y: 14.2 },
    { tipo: 'girasole', x: 23.6, y: 22.4 },
    { tipo: 'fungo', x: 25.6, y: 21.8 },
    { tipo: 'fungo', x: 28.6, y: 22.9 },
    { tipo: 'fungo', x: 34.1, y: 7.6 },
    { tipo: 'lampione', x: 31.6, y: 19.2 },
    { tipo: 'borsa', x: 31.15, y: 20.75 },
    { tipo: 'conchiglia', x: 31.6, y: 9.4 },
    { tipo: 'carillon', x: 33.5, y: 3.5 },

    // Pesci che nuotano nell'aria attorno allo stagno
    { tipo: 'pesce', movimento: { cx: 29.0, cy: 9.0, raggio: 2.1, velocita: 0.5, fase: 0.0, z: 0.5, ampiezzaZ: 0.1 } },
    { tipo: 'pesce', movimento: { cx: 29.0, cy: 9.0, raggio: 2.5, velocita: -0.4, fase: 2.0, z: 0.68, ampiezzaZ: 0.12 } },
    { tipo: 'pesce', movimento: { cx: 29.0, cy: 9.0, raggio: 1.7, velocita: 0.65, fase: 4.0, z: 0.4, ampiezzaZ: 0.08 } },
    { tipo: 'pesce', movimento: { cx: 29.0, cy: 9.0, raggio: 2.9, velocita: 0.35, fase: 1.0, z: 0.8, ampiezzaZ: 0.1 } },
    // Farfalle sui prati fioriti
    { tipo: 'farfalla', movimento: { cx: 24.8, cy: 4.8, raggio: 1.1, velocita: 0.9, fase: 0.0, z: 0.35, ampiezzaZ: 0.15 } },
    { tipo: 'farfalla', movimento: { cx: 32.8, cy: 15.6, raggio: 0.9, velocita: -1.1, fase: 1.5, z: 0.3, ampiezzaZ: 0.12 } },
    { tipo: 'farfalla', movimento: { cx: 24.2, cy: 21.0, raggio: 1.0, velocita: 1.0, fase: 3.0, z: 0.4, ampiezzaZ: 0.15 } },
  ],

  /* ---------------------------------------------------------------------
   * PENSIERI DI LIA che compaiono quando arriva in un punto preciso
   * (ognuno viene mostrato una sola volta)
   * ------------------------------------------------------------------- */
  inneschi: [
    { x: 6.5, y: 12.0, raggio: 2.0, testo: 'Che profumino... il forno è qui vicino.' },
    { x: 12.5, y: 9.8, raggio: 1.2, testo: 'Lo scroscio di una fontana... immagino l\'acqua che danza nella luce.' },
    { x: 6.5, y: 18.0, raggio: 1.2, testo: 'Un vicolo stretto. In fondo qualcosa tintinna.' },
    { x: 22.0, y: 13.5, raggio: 1.3, testo: 'Un varco nella staccionata! Biscotto è passato di qui.' },
    { x: 25.0, y: 13.5, raggio: 1.2, testo: 'Erba morbida sotto le scarpe. Qui posso immaginare qualunque cosa...' },
    { x: 28.8, y: 11.9, raggio: 1.6, testo: 'L\'acqua sciaborda... e nella mia testa i pesci nuotano nell\'aria!' },
  ],

  // Zona del parco in cui si sentono gli uccellini
  zonaUccellini: { x1: 23, y1: 2, x2: 35, y2: 24 },

  /* ---------------------------------------------------------------------
   * TESTI
   * ------------------------------------------------------------------- */
  testi: {
    storia:
      'Lia non può vedere, ma il suo mondo è pieno di colori: li immagina ascoltando i suoni, ' +
      'sentendo i profumi e toccando le cose. Oggi un ladro le ha strappato la borsa e il suo cane ' +
      'Biscotto si è lanciato all\'inseguimento... Batti il bastone per «vedere» ciò che ti circonda ' +
      'e segui l\'abbaiare di Biscotto.',
    inizio: [
      '«Biscotto! Dove sei?»',
      'SUGGERIMENTO_BASTONE', // sostituito con il suggerimento adatto (tastiera o touch)
      'Ascolta... segui l\'abbaiare di Biscotto.',
    ],
    bastoneTastiera: 'Premi SPAZIO o clicca per battere il bastone e percepire ciò che hai intorno.',
    bastoneTouch: 'Tocca la parte destra dello schermo (o il pulsante "Tocca") per battere il bastone.',
    caneScappa: 'Bau! Biscotto corre più avanti... seguilo!',
    vittoria: 'Biscotto! Eccoti! E guarda: hai ritrovato la mia borsa. Il ladro è scappato a mani vuote.',
  },
};
