/* ==========================================================================
 *  mondo.js — IL MONDO: griglia, percezione, onde e oggetti
 *  --------------------------------------------------------------------------
 *  Il mondo è una griglia di caselle. Ogni casella ha:
 *    - un MURO (0 = nessun muro) oppure
 *    - un PAVIMENTO (strada, erba, acqua...)
 *
 *  LA PERCEZIONE
 *  Ogni casella ha un livello di "rivelazione" tra 0 e 1:
 *    0 = Lia non la percepisce: si vede solo la carta e qualche tratto a matita
 *    1 = Lia la percepisce: si vede a colori
 *  Le ONDE (create dal bastone, dai passi, dall'abbaiare...) si allargano
 *  e alzano la rivelazione delle caselle che raggiungono. Col tempo i
 *  colori sbiadiscono, ma i luoghi già visitati restano un po' colorati.
 * ========================================================================== */
(function () {
  'use strict';

  const G = window.Gioco;
  const U = G.Utilita;
  const CFG = G.Config;

  const M = {
    larghezza: 0,
    altezza: 0,
    muro: null,          // Uint8Array: indice del tipo di muro per ogni casella (0 = nessuno)
    pavimento: null,     // Uint8Array: indice del tipo di pavimento
    tipiMuro: [null],    // l'indice 0 è "nessun muro"
    tipiPavimento: [],
    altezzeTipo: null,   // altezza di ogni tipo di muro (per il renderer)
    altezzaMassima: 1,

    rivelazione: null,   // livello attuale (0..1) — quello che si vede
    obiettivo: null,     // livello verso cui la rivelazione si sta muovendo
    visitato: null,      // 1 se la casella è già stata percepita almeno una volta
    rivelazioneBordata: null, // copia con un bordo di una casella (per il renderer)

    onde: [],
    oggetti: [],
    solidi: [],

    livelloRicordo: 0,   // quanto restano colorati i luoghi visitati
    coloreGlobale: 0,    // quanto è colorato il cielo (cresce con i ricordi)
    coloreGlobaleObiettivo: 0,
    ricordiTotali: 0,
    tempo: 0,
  };

  /* --------------------------------------------------------------------- */
  /*  Costruzione del mondo a partire da ambientazione.js                    */
  /* --------------------------------------------------------------------- */
  M.costruisci = function (amb) {
    const righe = amb.mappa;
    this.altezza = righe.length;
    this.larghezza = righe[0].length;

    // Tipi di muro: ogni lettera diventa un numero (1, 2, 3...)
    const indiceMuro = {};
    this.tipiMuro = [null];
    for (const [car, def] of Object.entries(amb.muri)) {
      indiceMuro[car] = this.tipiMuro.length;
      this.tipiMuro.push({ carattere: car, nome: def.nome, altezza: def.altezza, texture: G.Texture.muri[car] });
    }
    // Tipi di pavimento
    const indicePav = {};
    this.tipiPavimento = [];
    for (const [car, def] of Object.entries(amb.pavimenti)) {
      indicePav[car] = this.tipiPavimento.length;
      this.tipiPavimento.push({
        carattere: car, nome: def.nome, calpestabile: !!def.calpestabile,
        animata: !!def.animata, texture: G.Texture.pavimenti[car],
      });
    }
    this.altezzeTipo = Float32Array.from(this.tipiMuro.map((t) => (t ? t.altezza : 0)));
    this.altezzaMassima = Math.max(...this.altezzeTipo);

    // Lettura della mappa carattere per carattere
    const n = this.larghezza * this.altezza;
    this.muro = new Uint8Array(n);
    this.pavimento = new Uint8Array(n);
    for (let y = 0; y < this.altezza; y++) {
      if (righe[y].length !== this.larghezza) {
        throw new Error('La riga ' + y + ' della mappa ha una lunghezza diversa dalle altre.');
      }
      for (let x = 0; x < this.larghezza; x++) {
        const car = righe[y][x];
        const i = y * this.larghezza + x;
        if (car in indiceMuro) {
          this.muro[i] = indiceMuro[car];
          this.pavimento[i] = indicePav[amb.pavimentoSottoMuri];
        } else if (car in indicePav) {
          this.pavimento[i] = indicePav[car];
        } else {
          throw new Error('Carattere "' + car + '" sconosciuto nella mappa (riga ' + y + ', colonna ' + x + ').');
        }
      }
    }

    // Livelli di percezione
    this.rivelazione = new Float32Array(n);
    this.obiettivo = new Float32Array(n);
    this.visitato = new Uint8Array(n);
    this.rivelazioneBordata = new Float32Array((this.larghezza + 2) * (this.altezza + 2));

    // Oggetti: ogni oggetto unisce le proprietà del suo tipo e quelle proprie
    this.oggetti = [];
    for (const def of amb.oggetti) {
      const tipo = amb.tipiOggetto[def.tipo];
      if (!tipo) throw new Error('Tipo di oggetto sconosciuto: ' + def.tipo);
      const o = {
        tipo: def.tipo,
        sprite: tipo.sprite,
        fps: tipo.fps || 0,
        altezza: tipo.altezza,
        zBase: tipo.z || 0,
        z: tipo.z || 0,
        solido: !!tipo.solido,
        raggio: tipo.raggio || 0,
        ombra: tipo.ombra || 0,
        luce: tipo.luce || 0,
        orientabile: !!tipo.orientabile,
        suono: tipo.suono || null,
        ricordo: tipo.ricordo || null,
        x: def.x || 0,
        y: def.y || 0,
        angolo: 0,
        movimento: def.movimento ? Object.assign({}, def.movimento) : null,
        raccolto: false,
        timer: Math.random() * 3,      // per i suoni periodici
        sfasamento: Math.random() * 10, // così le animazioni non sono tutte sincronizzate
      };
      this.oggetti.push(o);
    }
    this.solidi = this.oggetti.filter((o) => o.solido);
    this.ricordiTotali = this.oggetti.filter((o) => o.ricordo).length;
    this.aggiornaLivelli(0);
    this.coloreGlobale = this.coloreGlobaleObiettivo;
    this._muoviOggetti(0);
  };

  /* --------------------------------------------------------------------- */
  /*  Domande sul mondo                                                     */
  /* --------------------------------------------------------------------- */

  /** È una casella dentro la mappa? */
  M.dentro = function (cx, cy) {
    return cx >= 0 && cy >= 0 && cx < this.larghezza && cy < this.altezza;
  };

  /** Lia può stare nel punto (x, y)? (false se c'è un muro, acqua o si è fuori mappa) */
  M.bloccato = function (x, y) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.dentro(cx, cy)) return true;
    const i = cy * this.larghezza + cx;
    if (this.muro[i]) return true;
    return !this.tipiPavimento[this.pavimento[i]].calpestabile;
  };

  /** La telecamera può stare in (x, y) all'altezza z? (può passare sopra i muri bassi) */
  M.bloccaCamera = function (x, y, z) {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (!this.dentro(cx, cy)) return true;
    const w = this.muro[cy * this.larghezza + cx];
    return w !== 0 && this.altezzeTipo[w] > z - 0.08;
  };

  /**
   * C'è una "linea libera" tra due punti? I muri più bassi di
   * altezzaMinima non bloccano (il suono passa sopra siepi e staccionate).
   * cellaObiettivo (facoltativa): la casella di arrivo, che può essere un muro.
   */
  M.lineaDiVista = function (x0, y0, x1, y1, altezzaMinima, cellaObiettivo) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const passi = Math.ceil(d * 4);
    for (let k = 1; k < passi; k++) {
      const t = k / passi;
      const cx = Math.floor(x0 + (x1 - x0) * t);
      const cy = Math.floor(y0 + (y1 - y0) * t);
      if (!this.dentro(cx, cy)) return false;
      const i = cy * this.larghezza + cx;
      if (i === cellaObiettivo) return true;
      const w = this.muro[i];
      if (w && this.altezzeTipo[w] >= altezzaMinima) return false;
    }
    return true;
  };

  /** Livello di rivelazione in un punto qualsiasi (interpolato tra le caselle). */
  M.rivelazioneIn = function (x, y) {
    const LB = this.larghezza + 2;
    const rx = U.limita(x + 0.5, 0, this.larghezza + 0.999);
    const ry = U.limita(y + 0.5, 0, this.altezza + 0.999);
    const ix = Math.floor(rx), iy = Math.floor(ry);
    const ax = rx - ix, ay = ry - iy;
    const b = iy * LB + ix;
    const R = this.rivelazioneBordata;
    const sopra = R[b] + (R[b + 1] - R[b]) * ax;
    const sotto = R[b + LB] + (R[b + LB + 1] - R[b + LB]) * ax;
    return sopra + (sotto - sopra) * ay;
  };

  /* --------------------------------------------------------------------- */
  /*  Percezione                                                            */
  /* --------------------------------------------------------------------- */

  /** Alza la rivelazione di una casella almeno fino a "livello". */
  M.rivela = function (i, livello) {
    if (this.obiettivo[i] < livello) this.obiettivo[i] = livello;
    this.visitato[i] = 1;
  };

  /** Rivela tutte le caselle entro un raggio (usato per il "tatto" di Lia). */
  M.rivelaCerchio = function (x, y, raggio, livello) {
    const x0 = Math.max(0, Math.floor(x - raggio)), x1 = Math.min(this.larghezza - 1, Math.floor(x + raggio));
    const y0 = Math.max(0, Math.floor(y - raggio)), y1 = Math.min(this.altezza - 1, Math.floor(y + raggio));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= raggio) this.rivela(cy * this.larghezza + cx, livello);
      }
    }
  };

  /**
   * Crea un'onda di percezione nel punto (x, y).
   * opzioni: { velocita, raggio, spessore, forza, colore, livello, attraversaMuri }
   * Al momento della creazione calcoliamo quali caselle l'onda potrà
   * raggiungere (quelle non nascoste da muri alti) ordinate per distanza:
   * poi, mentre l'onda si allarga, le riveliamo una dopo l'altra.
   */
  M.creaOnda = function (x, y, opzioni) {
    const colore = U.esadecimaleARgb(opzioni.colore);
    const onda = {
      x, y, r: 0,
      raggio: opzioni.raggio, velocita: opzioni.velocita, spessore: opzioni.spessore,
      forza: opzioni.forza, livello: opzioni.livello || 0,
      cr: colore.r, cg: colore.g, cb: colore.b,
      celle: [], prossima: 0,
    };
    if (onda.livello > 0) {
      const R = onda.raggio;
      const x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(this.larghezza - 1, Math.floor(x + R));
      const y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(this.altezza - 1, Math.floor(y + R));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const d = Math.hypot(cx + 0.5 - x, cy + 0.5 - y);
          if (d > R + 0.5) continue;
          const i = cy * this.larghezza + cx;
          if (opzioni.attraversaMuri || this.lineaDiVista(x, y, cx + 0.5, cy + 0.5, 1.0, i)) {
            onda.celle.push({ i, d: Math.max(0, d - 0.5) });
          }
        }
      }
      onda.celle.sort((a, b) => a.d - b.d);
    }
    this.onde.push(onda);
    if (this.onde.length > 8) this.onde.shift(); // il renderer gestisce al massimo 8 onde
    return onda;
  };

  /**
   * Aggiorna i livelli legati ai ricordi raccolti: più ricordi = mondo
   * più colorato (i luoghi visitati sbiadiscono meno e il cielo si colora).
   */
  M.aggiornaLivelli = function (ricordiRaccolti) {
    const P = CFG.percezione;
    const frazione = this.ricordiTotali ? ricordiRaccolti / this.ricordiTotali : 0;
    this.livelloRicordo = Math.min(0.9, P.livelloRicordoBase + P.livelloRicordoPerOggetto * ricordiRaccolti);
    this.coloreGlobaleObiettivo = Math.min(1, P.coloreCieloBase + (1 - P.coloreCieloBase) * frazione * 0.85);
  };

  /** Alla fine del gioco tutto il mondo resta colorato per sempre. */
  M.coloraTutto = function () {
    this.livelloRicordo = 1;
    this.coloreGlobaleObiettivo = 1;
  };

  /* --------------------------------------------------------------------- */
  /*  Aggiornamento a ogni fotogramma                                       */
  /* --------------------------------------------------------------------- */
  M.aggiorna = function (dt, giocatore) {
    const P = CFG.percezione;
    this.tempo += dt;

    // 1) Le onde si allargano e rivelano le caselle che raggiungono
    for (const o of this.onde) {
      o.r += o.velocita * dt;
      while (o.prossima < o.celle.length && o.celle[o.prossima].d <= o.r) {
        this.rivela(o.celle[o.prossima].i, o.livello);
        o.prossima++;
      }
    }
    this.onde = this.onde.filter((o) => o.r < o.raggio + o.spessore);

    // 2) Il "tatto": Lia sente sempre il terreno vicino a sé
    if (giocatore) this.rivelaCerchio(giocatore.x, giocatore.y, P.raggioTatto, 0.9);

    // 3) Memoria: l'obiettivo scende lentamente fino al livello del ricordo,
    //    e la rivelazione visibile si avvicina all'obiettivo
    const n = this.rivelazione.length;
    const LB = this.larghezza + 2;
    const calo = dt / P.durataRicordo;
    const su = P.velocitaComparsa * dt, giu = P.velocitaScomparsa * dt;
    for (let i = 0; i < n; i++) {
      const minimo = this.visitato[i] ? this.livelloRicordo : 0;
      if (this.obiettivo[i] > minimo) this.obiettivo[i] = Math.max(minimo, this.obiettivo[i] - calo);
      else if (this.obiettivo[i] < minimo) this.obiettivo[i] = minimo;
      const diff = this.obiettivo[i] - this.rivelazione[i];
      this.rivelazione[i] += diff > 0 ? Math.min(diff, su) : Math.max(diff, -giu);
      // copia nella griglia "bordata" (una casella vuota tutto intorno)
      const x = i % this.larghezza, y = (i / this.larghezza) | 0;
      this.rivelazioneBordata[(y + 1) * LB + (x + 1)] = this.rivelazione[i];
    }

    // 4) Il colore del cielo segue lentamente i ricordi raccolti
    this.coloreGlobale += (this.coloreGlobaleObiettivo - this.coloreGlobale) * Math.min(1, dt * 1.2);

    // 5) Oggetti che si muovono (pesci, farfalle) e suoni periodici
    this._muoviOggetti(dt);
    for (const o of this.oggetti) {
      if (o.suono === 'acqua') {
        o.timer -= dt;
        if (o.timer <= 0) { o.timer = 4.5; this.creaOnda(o.x, o.y, CFG.onde.acqua); }
      } else if (o.ricordo && !o.raccolto) {
        o.timer -= dt;
        if (o.timer <= 0) {
          o.timer = 3.5 + Math.random() * 2;
          this.creaOnda(o.x, o.y, CFG.onde.scintilla);
          if (G.Audio) G.Audio.scintilla(o.x, o.y);
        }
      }
    }
  };

  /** Muove gli oggetti che girano in cerchio e fa "fluttuare" i ricordi. */
  M._muoviOggetti = function (dt) {
    for (const o of this.oggetti) {
      const m = o.movimento;
      if (m) {
        m.fase += m.velocita * dt;
        o.x = m.cx + Math.cos(m.fase) * m.raggio;
        o.y = m.cy + Math.sin(m.fase) * m.raggio;
        o.z = m.z + Math.sin(this.tempo * 1.7 + m.fase * 3) * (m.ampiezzaZ || 0);
        // la direzione di marcia è tangente al cerchio
        o.angolo = m.fase + (m.velocita > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else if (o.ricordo) {
        o.z = o.zBase + Math.sin(this.tempo * 2.2 + o.sfasamento) * 0.03;
      }
    }
  };

  /** Nome dello sprite da disegnare per un oggetto (gestisce le animazioni). */
  M.spriteOggetto = function (o) {
    if (o.sprite.length === 1 || !o.fps) return o.sprite[0];
    const f = Math.floor(this.tempo * o.fps + o.sfasamento) % o.sprite.length;
    return o.sprite[f];
  };

  G.Mondo = M;
})();
