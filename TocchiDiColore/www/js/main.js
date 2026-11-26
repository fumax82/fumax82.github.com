/* ==========================================================================
 *  main.js — IL CUORE DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui nasce l'oggetto "Gioco" che tiene insieme tutto:
 *    - prepara la grafica (Three.js) e fa dipingere personaggi e oggetti
 *    - monta le SCENE (la via, la piazza, il forno, il canale...): piani
 *      dipinti appesi nello spazio, come in un teatrino di carta
 *    - circa 60 volte al secondo muove Lia lungo il suo percorso, aggiorna
 *      il mondo che si colora, la regia delle telecamere, e disegna
 *    - offre alla STORIA (dati/storia.js) dei comandi semplici:
 *        g.vai('forno'), g.dialogo('fornaia', [...]), g.pensa('...'),
 *        g.obiettivo('...'), g.attendi(2), g.evento('...'), g.musica('...')
 *
 *  Fasi: 'caricamento' → 'menu' → 'gioco' (o 'volo' sulla balena) → 'fine'
 * ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Galleria } from './arte/galleria.js';
import { UNIFORMI, creaRumore, creaPennellate } from './motore/materiali.js';
import { Scena, dimenticaDipinti } from './motore/scena.js';
import { Regia } from './motore/regia.js';
import { Acquerello } from './motore/acquerello.js';
import { Particelle, FORME } from './motore/particelle.js';
import { Volo } from './motore/volo.js';
import { Sagoma } from './motore/sagoma.js';
import { Lia } from './gioco/lia.js';
import { Guinzaglio } from './gioco/attori.js';
import { Audio } from './gioco/audio.js';
import { Musica } from './gioco/musica.js';
import { Input } from './gioco/input.js';
import { Interfaccia } from './gioco/interfaccia.js';
import { Regista } from './gioco/regista.js';
import { Magia } from './gioco/magia.js';
import { Meteo } from './gioco/meteo.js';
import { Effetti } from './motore/effetti.js';
import { Meraviglie } from './gioco/meraviglie.js';
import via from './dati/scene/via.js';
import piazza from './dati/scene/piazza.js';
import forno from './dati/scene/forno.js';
import canale from './dati/scene/canale.js';
import libreria from './dati/scene/libreria.js';
import terrazza from './dati/scene/terrazza.js';
import piazzetta from './dati/scene/piazzetta.js';
import { avviaStoria } from './dati/storia.js';

const SCENE = { via, piazza, forno, canale, libreria, terrazza, piazzetta };
const CHIAVE = 'tocchi-di-colore-salvataggio';
const CARTA = '#fbf6ea';

class Gioco {
  constructor() {
    this.fase = 'caricamento';
    this.tempo = 0;
    this.inPausa = false;
    this.inScena = false;          // true durante le scene della storia
    this.corrente = null;          // la Scena montata adesso
    this.onde = CONFIG.onde;
    this.dialoghiSpeciali = {};    // id del personaggio → dialogo della storia
    this.porteAperte = {};
    this.ricordiPresi = [];
    this.animazioni = [];          // dissolvenze e altre transizioni
    this.ripetizioni = [];         // azioni da ripetere ogni tot secondi
    this.suoniLuogo = [];
    this.occupato = false;
    this.interazioneAttuale = null;
    this.qualita = 'media';
    this.mediaLavoro = 12;
    this.tempoLento = 0;
    this.direzioneSchermo = 0;     // freccia premuta (-1, 0, +1)
    this.meraviglieTrovate = new Set();
    // quante meraviglie nascoste ci sono in tutto il gioco
    this.totaleMeraviglie = Object.values(SCENE).reduce((n, d) => n + (d.meraviglie || []).length, 0);
    this.mappaDirezione = 1;       // come la freccia si traduce in avanti/indietro sul percorso
    this.ui = Interfaccia;
  }

  /* ====================================================================== */
  /*  AVVIO                                                                 */
  /* ====================================================================== */
  async avvia() {
    const tela = document.getElementById('schermo');
    this.renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: false, powerPreference: 'high-performance' });
    // Lavoriamo direttamente con i colori dipinti: nessuna conversione di colore
    THREE.ColorManagement.enabled = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(new THREE.Color(CARTA), 1);
    UNIFORMI.uRumore.value = creaRumore();
    UNIFORMI.uPennellate.value = creaPennellate();
    UNIFORMI.uSchizzo.value = CONFIG.grafica.schizzo;

    Interfaccia.caricamento(0.02, 'Preparo i pennelli...');
    const anisotropia = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    await Galleria.carica((f, testo) => Interfaccia.caricamento(0.04 + f * 0.92, testo), anisotropia);

    this.scena = new THREE.Scene();
    this.scena.background = new THREE.Color(CARTA);
    this.regia = new Regia();
    this.acquerello = new Acquerello(this.renderer);
    this.particelle = new Particelle();            // petali, note, foglie (dipinti)
    this.scena.add(this.particelle.punti);
    this.luci = new Particelle({ additivo: true });  // scintille, stelle, lucciole (di luce)
    this.scena.add(this.luci.punti);
    this.magia = new Magia(this);
    this.effetti = new Effetti(this.scena);   // onomatopee, archi sonori, nastri di profumo, luce
    this.meteo = new Meteo(this);              // pioggia, fiume, balena con le pinne
    this.regista = new Regista();
    this.lia = new Lia(this);
    this.lia.aggiungiA(this.scena);
    this.guinzaglioLinea = new Guinzaglio();
    this.scena.add(this.guinzaglioLinea.linea);

    Input.inizializza(tela);
    Interfaccia.inizializza({
      nuovaPartita: () => this.inizia(null),
      continua: () => this.inizia((this.leggiSalvataggio() || {}).capitolo),
      pausa: (si) => this.pausa(si),
      qualita: (q) => this.impostaQualita(q),
    });
    this._collegaComandi();
    this.qualita = Input.eTouch ? 'media' : 'alta';
    this.impostaQualita(CONFIG.grafica.qualita);
    window.addEventListener('resize', () => this.ridimensiona());

    // Nel mondo bianco, quando Lia sbatte contro qualcosa, quella cosa
    // "appare" (come nel cortometraggio, dove dopo l'urto spunta un albero)
    this.regista.su('urto', (o) => {
      if (!o || !this.corrente) return;
      const p = this.corrente.percorso.puntoLaterale(o.s);
      const z = p.z;
      this.onda(p.x, z, 'urto', { colore: o.colore || '#9fd08a' });
      this.particelle.emetti(p.x, p.y + 1.2, z, 18, { forma: [FORME.foglia], colori: ['#8fc27f', '#6faa5e', '#b4dea1'], velocita: 1.2, su: 0.7, gravita: 0.8, vita: 1.8, dim: 0.18 });
      this.regia.scuoti(0.6);
      Audio.botta();
      this.pensa(o.testo || 'Ahi! C\'era qualcosa qui davanti!', 2.5, true);
    });

    // La prima volta che il bastone tocca un materiale, Lia dice che cosa immagina
    const IMMAGINA = {
      vetro: 'Tin! È vetro... una vetrina piena di luce!',
      legno: 'Tok tok... legno. Una porta, calda come il pane.',
      mattoni: 'Mattoni ruvidi, uno sopra l\'altro.',
      intonaco: 'Un muro liscio, tiepido di sole.',
      metallo: 'Dong! Ferro che canta... un cancello!',
      foglie: 'Frrr... foglie! Un giardino dietro il muro.',
      ceramica: 'Piastrelle lisce e fresche, tutte in fila.',
      libri: 'Libri! Profumano di carta e di storie.',
      acqua: 'Plip! Acqua che si muove.',
      pietra: 'Toc... pietra. Il marciapiede è fatto di lastre grandi.',
    };
    this.materialiSentiti = new Set();
    this.regista.su('tocco', (d) => {
      if (!d || !d.materiale || this.materialiSentiti.has(d.materiale) || !this.lia.magica && !this.lia.puoToccare) return;
      if (this.corrente && this.corrente.percezione.rivelaTutto > 0.5) return;
      this.materialiSentiti.add(d.materiale);
      if (IMMAGINA[d.materiale]) this.pensa(IMMAGINA[d.materiale], 3);
    });

    Interfaccia.caricamento(1, 'Pronto!');
    Interfaccia.nascondiCaricamento();
    Interfaccia.mostraMenu(!!this.leggiSalvataggio());
    this.fase = 'menu';
    this.ultimo = performance.now();
    requestAnimationFrame((t) => this.ciclo(t));
  }

  /** Comincia (o riprende) la storia. */
  async inizia(capitolo) {
    // riprendendo una partita, ritroviamo le meraviglie già scoperte
    const salvato = capitolo ? this.leggiSalvataggio() : null;
    if (salvato && salvato.meraviglie) {
      salvato.meraviglie.forEach((k) => this.meraviglieTrovate.add(k));
      if (this.meraviglieTrovate.size) Interfaccia.meraviglie(this.meraviglieTrovate.size, this.totaleMeraviglie);
    }
    Audio.avvia();
    Interfaccia.nascondiMenu();
    UNIFORMI.uRivelaTutto.value = 0;
    this.acquerello.uniformi.uBianco.value = 1;
    this.fase = 'gioco';
    try {
      await avviaStoria(this, capitolo);
    } catch (errore) {
      console.error('Errore nella storia:', errore);
    }
  }

  _collegaComandi() {
    Input.su('tocco', () => {
      if (Interfaccia.dialogoAperto) { Interfaccia.avanzaDialogo(); return; }
      if (this.fase === 'gioco' && !this.inPausa) this.lia.tocca();
    });
    Input.su('azione', () => {
      if (Interfaccia.dialogoAperto) { Interfaccia.avanzaDialogo(); return; }
      const it = this.interazioneAttuale;
      if (it && !this.occupato && this.fase === 'gioco' && !this.inPausa) {
        this.occupato = true;
        Interfaccia.azione(null);
        this._interagisci(it).catch((e) => console.error(e)).finally(() => { this.occupato = false; this.interazioneAttuale = null; });
      }
    });
    Input.su('pausa', () => { if (this.fase === 'gioco' || this.fase === 'volo') this.pausa(!this.inPausa); });
    Input.su('perdiFuoco', () => { if ((this.fase === 'gioco' || this.fase === 'volo') && !this.inPausa) this.pausa(true); });
  }

  pausa(si) {
    this.inPausa = si;
    Interfaccia.pausa(si);
    Audio.sospendi(si);
  }

  /* ====================================================================== */
  /*  QUALITÀ E DIMENSIONI                                                  */
  /* ====================================================================== */
  impostaQualita(q) {
    CONFIG.grafica.qualita = q;
    if (q !== 'auto') this.qualita = q;
    this.ridimensiona();
  }

  ridimensiona() {
    const L = window.innerWidth, A = window.innerHeight;
    const p = CONFIG.grafica.preimpostazioni[this.qualita];
    const dpr = Math.min(window.devicePixelRatio || 1, p.pixelRatio);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(L, A);
    this.acquerello.imposta(L, A, dpr, p.scala, p.campioni);
    this.regia.ridimensiona(L, A);
    if (this.volo) this.volo.ridimensiona(L, A);
    this.particelle.ridimensiona(A * dpr * p.scala);
    this.luci.ridimensiona(A * dpr * p.scala);
  }

  /** Se il dispositivo fatica, abbassa la qualità da solo. */
  _qualitaAutomatica(dt) {
    if (CONFIG.grafica.qualita !== 'auto' || this.fase === 'menu') return;
    this.mediaLavoro = this.mediaLavoro * 0.97 + dt * 1000 * 0.03;
    if (this.mediaLavoro > 30) this.tempoLento += dt; else this.tempoLento = 0;
    if (this.tempoLento > 3 && this.qualita !== 'bassa') {
      this.qualita = this.qualita === 'alta' ? 'media' : 'bassa';
      this.tempoLento = 0;
      this.mediaLavoro = 16;
      this.ridimensiona();
      console.info('Qualità automatica:', this.qualita);
    }
  }

  /* ====================================================================== */
  /*  SCENE                                                                 */
  /* ====================================================================== */
  /**
   * Porta Lia in un'altra scena, con una dissolvenza al bianco.
   * opz: { subito: true } = senza dissolvenza; { senzaMusica: true }
   */
  async vai(id, arrivo, opz) {
    const o = opz || {};
    const def = SCENE[id];
    if (!def) throw new Error('Scena sconosciuta: ' + id);
    if (this.corrente && !o.subito) await this.bianco(1, 0.55);
    this.caricaScena = true;
    if (this.corrente) this._esci();
    // teniamo in memoria solo i dipinti di questa scena e di quelle vicine
    const vicine = { piazza: ['forno'], forno: ['piazza'], canale: ['libreria', 'terrazza'], libreria: ['canale'], terrazza: ['canale'] };
    dimenticaDipinti([id, ...(vicine[id] || [])].map((k) => SCENE[k].arte.modulo + ':' + SCENE[k].arte.nome));
    this._indicatore(true);
    const S = await new Scena(def, this).monta();
    this._indicatore(false);
    this.corrente = S;
    this.meraviglie = new Meraviglie(this, S);
    this.scena.add(S.gruppo);
    S.percezione.collega(UNIFORMI);
    const atm = def.atmosfera || {};
    UNIFORMI.uFoschia.value.set(...(atm.foschia || [18, 100]));
    UNIFORMI.uLuceScena.value.set(atm.luce || '#ffffff');
    // all'aperto passano le ombre delle nuvole (negli interni no)
    UNIFORMI.uOmbreNuvole.value = atm.tuttoVisibile ? 0 : (atm.ombreNuvole !== undefined ? atm.ombreNuvole : 0.2);
    if (atm.sole) UNIFORMI.uSole.value.set(...atm.sole).normalize();
    this.scena.background = new THREE.Color(CARTA);
    // gli interni (forno, libreria) sono caldi e accoglienti: tutti a colori
    if (atm.tuttoVisibile) S.percezione.rivelaTutto = 1;
    if (atm.bordoBianco !== undefined) this.bordoBianco(atm.bordoBianco, o.subito ? 0 : 0.8);
    Audio.mondo = null;
    const a = (def.arrivi || {})[arrivo] || Object.values(def.arrivi)[0];
    this.lia.entra(S, a.s, a.verso);
    this.regia.imposta(def.inquadrature);
    this.regia.aggiorna(0, this.lia);
    // effetti di particelle della scena (profumi, foglie, scintille)
    for (const e of def.effetti || []) {
      const em = this.emettitore(e.x, e.y, e.z, e.ritmo, { ...e, forma: FORME[e.forma] !== undefined ? FORME[e.forma] : FORME.punto });
      if (e.id) S['effetto_' + e.id] = em;
    }
    this.suoniLuogo = (def.suoni || []).map((s) => Audio.continuo(s.tipo, s.x, s.y, s.volume));
    // il vento si vede: ogni tanto una folata disegnata attraversa l'inquadratura
    if (def.vento) {
      const r = this.ogni(def.vento, () => {
        if (this.corrente !== S) { r.ferma(); return; }
        const L = this.lia, d = Math.random() < 0.5 ? 1 : -1;
        this.effetti.profumo([L.x - 6 * d, L.y + 2.2 + Math.random(), L.z - 1.2], [L.x + 6 * d, L.y + 1.6 + Math.random(), L.z - 0.4], '#e6f1ff', Math.random() * 6);
      });
    }
    if (def.musica && !o.senzaMusica) Musica.suona(def.musica);
    this.caricaScena = false;
    this.regista.emetti('entrato:' + id);
    if (!o.subito) await this.bianco(0, 0.7);
  }

  /** Un piccolo "sto dipingendo..." mentre la scena nuova viene preparata. */
  _indicatore(si) {
    const el = document.getElementById('messaggio');
    if (!el) return;
    if (si) { el.textContent = '...'; el.classList.add('visibile'); } else el.classList.remove('visibile');
  }

  _esci() {
    const S = this.corrente;
    Audio.fermaContinui();
    for (const a of S.attori) if (a.emettitore) a.emettitore.attivo = false;
    this.particelle.emettitori = this.particelle.emettitori.filter((e) => !e.delLuogo);
    this.luci.emettitori = this.luci.emettitori.filter((e) => !e.delLuogo);
    this.effetti.svuota();
    this.meteo.reset();
    if (this.meraviglie) this.meraviglie.smonta();
    S.smonta();
    this.corrente = null;
    this.mostraGuinzaglio = false;
  }

  attore(id) { return this.corrente ? this.corrente.attore(id) : null; }

  /* ====================================================================== */
  /*  INTERAZIONI (porte, persone, punti speciali)                          */
  /* ====================================================================== */
  _cercaInterazione() {
    const S = this.corrente;
    if (!S || !this.lia.controllo || this.inScena || Interfaccia.dialogoAperto) return null;
    let migliore = null, dMin = Infinity;
    for (const it of S.interazioni) {
      if (!it.attiva) continue;
      let d;
      if (it.attore) {
        if (!it.attore.visibile) continue;
        const v = S.percorso.piuVicino(it.attore.x, it.attore.z);
        if (v.distanza > 3.2) continue;
        d = Math.abs(v.s - this.lia.s);
      } else d = Math.abs(it.s - this.lia.s);
      if (d > it.raggio) continue;
      if (d < dMin) { dMin = d; migliore = it; }
    }
    return migliore;
  }

  async _interagisci(it) {
    if (it.tipo === 'porta') {
      if (it.bloccata && !this.porteAperte[it.id]) { Interfaccia.messaggio(it.bloccata, 3.5, true); return; }
      if (it.campanello) this.campanello(this.lia.x, this.lia.y + 1.9, this.lia.z - 0.5);
      await this.vai(it.verso, it.arrivo);
    } else if (it.tipo === 'persona') {
      const a = it.attore;
      this.lia.controllo = false;
      a.parlando = true;
      a.guarda(this.lia.x, this.lia.z);
      // Lia si gira verso chi le parla
      const v = this.corrente.percorso.piuVicino(a.x, a.z);
      if (Math.abs(v.s - this.lia.s) > 0.05) this.lia.verso = Math.sign(v.s - this.lia.s);
      const speciale = this.dialoghiSpeciali[a.id];
      if (speciale) await speciale(this, a);
      else {
        const righe = a.chiacchiere || ['...'];
        a._indice = a._indice || 0;
        await this.dialogo(a.id, [righe[a._indice % righe.length]]);
        a._indice++;
      }
      a.parlando = false;
      this.lia.controllo = !this.inScena;
      this.regista.emetti('parlato:' + a.id);
    } else {
      this.regista.emetti('interagisci:' + it.id);
    }
  }

  /* ====================================================================== */
  /*  CICLO PRINCIPALE                                                      */
  /* ====================================================================== */
  ciclo(t) {
    requestAnimationFrame((tt) => this.ciclo(tt));
    let dt = (t - this.ultimo) / 1000;
    this.ultimo = t;
    if (!(dt > 0)) dt = 0.016;
    if (dt > 0.05) dt = 0.05;
    dt *= this.scalaTempo || 1;   // solo per i test: accelera il tempo di gioco
    if (this.fase === 'caricamento' || this.fase === 'menu') return;

    if (!this.inPausa) {
      this.tempo += dt;
      UNIFORMI.uTempo.value = this.tempo;
      if (this.fase === 'volo') this._aggiornaVolo(dt);
      else if (this.corrente && !this.caricaScena) this._aggiornaGioco(dt);
      this.regista.aggiorna(dt);
      this.particelle.aggiorna(dt, this.tempo);
      this.luci.aggiorna(dt, this.tempo);
      this._aggiornaAnimazioni(dt);
    }
    Musica.aggiorna();
    this._disegna(dt);
    Interfaccia.aggiorna(dt);
    this._qualitaAutomatica(dt);
  }

  /**
   * La freccia premuta (sinistra/destra SULLO SCHERMO) diventa "avanti" o
   * "indietro" sul percorso, a seconda di come la telecamera lo inquadra.
   * La scelta si blocca finché il dito resta sulla freccia: così, se
   * l'inquadratura cambia mentre Lia cammina, lei non torna indietro.
   */
  _direzioneSulPercorso() {
    const d = Input.direzione();
    if (d !== this.direzioneSchermo) {
      this.direzioneSchermo = d;
      if (d !== 0) {
        const e = this.regia.camera.matrixWorld.elements;   // colonna 0 = destra della camera
        const t = this.lia.tangente;
        const dx = t.x * e[0] + t.z * e[2];
        // se il percorso va "dentro lo schermo", destra = avanti
        this.mappaDirezione = Math.abs(dx) > 0.3 ? Math.sign(dx) : 1;
      }
    }
    return d * this.mappaDirezione;
  }

  _aggiornaGioco(dt) {
    const S = this.corrente;
    const libero = this.lia.controllo && !this.inScena && !Interfaccia.dialogoAperto;
    const dir = libero ? this._direzioneSulPercorso() : 0;
    if (!libero) this.direzioneSchermo = 0;
    this.lia.aggiorna(dt, dir, Input.corsa());
    for (const a of S.attori) a.aggiorna(dt, S);
    S.percezione.aggiorna(dt, { x: this.lia.x, z: this.lia.z });
    this.magia.aggiorna(dt);
    this.meraviglie.aggiorna(dt);
    this.meteo.aggiorna(dt, this.regia.camera);
    UNIFORMI.uNumOnde.value = S.percezione.scriviOnde(UNIFORMI.uOnde.value, UNIFORMI.uOndeColori.value);
    UNIFORMI.uRivelaTutto.value = S.percezione.rivelaTutto;
    this.regia.aggiorna(dt, this.lia);
    // la messa a fuoco segue Lia (vedi la profondità di campo in materiali.js)
    const c = this.regia.camera.position;
    const fuoco = Math.hypot(c.x - this.lia.x, c.y - this.lia.y - 0.6, c.z - this.lia.z);
    UNIFORMI.uFuoco.value += (fuoco - UNIFORMI.uFuoco.value) * Math.min(1, dt * 4);
    const e = this.regia.camera.matrixWorld.elements;
    Audio.aggiorna(this.lia.x, this.lia.z, Math.atan2(-e[10], -e[8]));
    const it = this._cercaInterazione();
    if (it !== this.interazioneAttuale && !this.occupato) {
      this.interazioneAttuale = it;
      Interfaccia.azione(it ? it.etichetta : null);
    }
  }

  _disegna(dt) {
    if (this.fase === 'volo') {
      this.acquerello.disegna(this.volo.scena, this.volo.camera);
      return;
    }
    const S = this.corrente;
    if (!S) return;
    const cam = this.regia.camera;
    for (const a of S.attori) a.disegna(cam);
    this.lia.disegna(cam);
    // guinzaglio tra la mano di Lia e il collare di Biscotto
    const b = this.attore('biscotto');
    const g = this.guinzaglioLinea;
    g.linea.visible = !!(this.mostraGuinzaglio && b && b.visibile && !this.lia.nascosta);
    if (g.linea.visible) {
      // il collare è verso la testa: davanti, nella direzione in cui il cane guarda sullo schermo
      const e = cam.matrixWorld.elements;
      const verso = (b.dir.x * e[0] + b.dir.z * e[2]) >= 0 ? 1 : -1;
      g.aggiorna(this.lia.mano(cam), [b.x + e[0] * 0.15 * verso, b.y + 0.4, b.z + e[2] * 0.15 * verso]);
    }
    S.aggiorna(dt, this.tempo, cam);
    this.effetti.aggiorna(this.inPausa ? 0 : dt, cam);
    this.acquerello.disegna(this.scena, cam);
  }

  /* ====================================================================== */
  /*  ANIMAZIONI DI VALORI (dissolvenze) E RIPETIZIONI                      */
  /* ====================================================================== */
  /** Porta gradualmente "oggetto.value" a "valore" in "durata" secondi. */
  anima(oggetto, valore, durata) {
    this.animazioni = this.animazioni.filter((a) => a.oggetto !== oggetto);
    if (!durata) { oggetto.value = valore; return Promise.resolve(); }
    return new Promise((ok) => this.animazioni.push({ oggetto, da: oggetto.value, a: valore, t: 0, durata, ok }));
  }

  _aggiornaAnimazioni(dt) {
    const finite = [];
    for (const a of this.animazioni) {
      a.t = Math.min(1, a.t + dt / a.durata);
      const e = a.t * a.t * (3 - 2 * a.t);
      a.oggetto.value = a.da + (a.a - a.da) * e;
      if (a.t >= 1) finite.push(a);
    }
    if (finite.length) {
      this.animazioni = this.animazioni.filter((a) => !finite.includes(a));
      finite.forEach((a) => a.ok());
    }
    for (const r of this.ripetizioni) {
      if (!r.attiva) continue;
      r.conto -= dt;
      if (r.conto <= 0) { r.conto = r.intervallo; r.funzione(); }
    }
    this.ripetizioni = this.ripetizioni.filter((r) => r.attiva);
  }

  /** Esegue "funzione" ogni "intervallo" secondi finché non si chiama .ferma() */
  ogni(intervallo, funzione) {
    const r = { intervallo, conto: 0, funzione, attiva: true, ferma() { this.attiva = false; } };
    this.ripetizioni.push(r);
    return r;
  }

  /* ====================================================================== */
  /*  IL VOLO SULLA BALENA                                                  */
  /* ====================================================================== */
  async voloSullaBalena() {
    if (!this.volo) { this.volo = new Volo(); this.ridimensiona(); }
    await this.bianco(1, 1.4);
    await this.volo.prepara();   // dipinge la città vista dall'alto
    this.fase = 'volo';
    this.voloT = 0;
    Interfaccia.azione(null);
    Musica.suona('volo');
    const vento = Audio.continuo('vento', undefined, undefined, 0.22);
    Audio.balena();
    const canti = this.ogni(9, () => Audio.balena());
    this.acquerello.uniformi.uBordoBianco.value = 0.35;
    await this.bianco(0, 1.6);
    this.pensa('Si vola! La città è piena di colori... e laggiù il fiume è una strada!', 5, true);
    await this.regista.quando(() => this.voloT > 0.45);
    this.pensa('Eccolo! Un puntino giallo che corre nella piazzetta... Biscotto!', 4.5, true);
    await this.regista.quando(() => this.voloT >= 1);
    await this.bianco(1, 1.4);
    canti.ferma();
    vento.ferma();
    this.particelle.punti.visible = true;
    this.luci.punti.visible = true;
    this.fase = 'gioco';
  }

  _aggiornaVolo(dt) {
    this.voloT = Math.min(1, this.voloT + dt / 30);
    this.volo.aggiorna(dt, this.voloT);
    this.particelle.punti.visible = false;
    this.luci.punti.visible = false;
  }

  /* ====================================================================== */
  /*  COMANDI PER LA STORIA                                                 */
  /* ====================================================================== */
  attendi(s) { return this.regista.attendi(s); }
  quando(f) { return this.regista.quando(f); }
  evento(nome) { return this.regista.evento(nome); }

  /** Toglie (false) o ridà (true) il controllo di Lia al giocatore. */
  controllo(si) {
    this.inScena = !si;
    this.lia.controllo = si;
    if (!si) Interfaccia.azione(null);
  }

  pensa(testo, durata, urgente) { Interfaccia.messaggio(testo, durata || 4, urgente); }
  obiettivo(testo) { Interfaccia.obiettivo(testo); }
  capitolo(numero, titolo) { return Interfaccia.capitolo(numero, titolo); }
  musica(nome) { Musica.suona(nome); }

  /** Dialogo: chi = 'lia', l'id di un personaggio, oppure null (narratore). */
  async dialogo(chi, righe) {
    let info = null, attore = null;
    if (chi === 'lia') info = { nome: 'Lia', arte: this.lia.costume };
    else if (chi) {
      attore = this.attore(chi);
      info = attore ? { nome: attore.nome, arte: attore.def.arte } : { nome: chi, arte: chi };
    }
    const primaControllo = this.lia.controllo;
    this.lia.controllo = false;
    if (attore) attore.parlando = true;
    await Interfaccia.dialogo(info, righe);
    if (attore) attore.parlando = false;
    this.lia.controllo = primaControllo && !this.inScena;
  }

  /** Abilita o disabilita un punto di interazione della scena attuale. */
  interazione(id, attiva) {
    const it = this.corrente && this.corrente.interazioni.find((i) => i.id === id);
    if (it) it.attiva = attiva;
  }

  apriPorta(id) { this.porteAperte[id] = true; }

  /** Inquadratura scelta dalla storia: pos e guarda sono punti del mondo [x, y, z]. */
  inquadra(pos, guarda, durata, fov) { this.regia.inquadra(pos, guarda, durata, fov); }
  libera(stacco) { this.regia.libera(stacco); }

  /** Dove cammina Lia dopo s metri, come [x, y, z] (comodo per le inquadrature). */
  punto(s, dx, dy, dz) {
    const p = this.corrente.percorso.puntoLaterale(s);
    return [p.x + (dx || 0), p.y + (dy || 0), p.z + (dz || 0)];
  }

  /** Onda di percezione in (x, z): tipo = 'bastone' | 'abbaio' | 'profumo' | 'suono' | 'magia' | 'passo' */
  onda(x, z, tipo, extra) {
    if (!this.corrente) return null;
    const onda = this.corrente.percezione.creaOnda(x, z, { ...CONFIG.onde[tipo], tipo, ...(extra || {}) });
    this.magia.nuovaOnda(onda, tipo);   // particelle, increspatura, nota (vedi gioco/magia.js)
    // il profumo si vede: nastri colorati che volteggiano dalla sorgente fino a Lia
    if (tipo === 'profumo') {
      const L = this.lia, q = this.corrente.quota(x, z) + 1.3;
      const naso = [L.x, L.y + 0.85, L.z];
      this.effetti.profumo([x, q, z], naso, '#f7a8c8', 0);
      this.effetti.profumo([x, q - 0.2, z], naso, '#f6d38a', 2.5);
    }
    return onda;
  }

  /**
   * Un suono reso visibile, come nei fumetti: la scritta ("BAU!"), gli archi
   * sonori che si allargano e qualche nota. tipo: 'abbaio' | 'miagolio' |
   * 'campanello' | 'clacson' | 'balena'
   */
  suonoVisibile(tipo, x, y, z) {
    const S = {
      abbaio: ['BAU!', '#f0a070', '#ffd2b0'], miagolio: ['MIAO~', '#f7a8c8', '#ffe0ef'],
      campanello: ['DRIN!', '#ffd36b', '#fff3c0'], clacson: ['PIII!', '#9fc4f0', '#dff3ff'],
      balena: ['UUUUH...', '#a8c8f0', '#e6f0ff'],
    }[tipo];
    if (!S) return;
    this.effetti.onomatopea(S[0], x, y + 0.35, z, S[1], tipo === 'balena' ? 2.6 : 0.85);
    this.effetti.archi(x, y, z, S[2], tipo === 'balena' ? 3 : 2);
  }

  /** Il campanello della porta di un negozio: si sente e si vede. */
  campanello(x, y, z) {
    Audio.campanello();
    this.suonoVisibile('campanello', x, y, z);
    this.luci.emetti(x, y, z, 10, { forma: [FORME.scintilla, FORME.nota], colori: ['#fff0a0', '#ffd36b'], velocita: 0.8, su: 0.5, gravita: 0.4, vita: 1.2, dim: 0.12 });
  }

  scintille(x, y, z, quante, opz) {
    this.particelle.emetti(x, y, z, quante, {
      forma: [FORME.stella, FORME.scintilla, FORME.punto], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'],
      velocita: 1.5, su: 1, gravita: 0.8, vita: 1.6, dim: 0.2, ...(opz || {}),
    });
  }

  /** Emettitore di particelle legato alla scena attuale (sparisce uscendo). */
  emettitore(x, y, z, ritmo, opz) {
    const e = this.particelle.aggiungiEmettitore(x, y, z, ritmo, opz);
    e.delLuogo = true;
    return e;
  }

  /** Dissolvenza verso il bianco (1) o ritorno all'immagine (0). */
  bianco(valore, durata) { return this.anima(this.acquerello.uniformi.uBianco, valore, durata); }
  bordoBianco(valore, durata) { return this.anima(this.acquerello.uniformi.uBordoBianco, valore, durata || 0); }
  cieloColore(valore, durata) { return this.anima(UNIFORMI.uColoreCielo, valore, durata || 0); }

  /** Tutta la scena visibile (1) o tutta bianca (0), con eventuale transizione. */
  coloraMondo(livello, durata) {
    const S = this.corrente;
    if (!S) return Promise.resolve();
    const P = S.percezione;
    if (livello <= 0) { P.rivelaTutto = 0; P.coloraTutto(0); return Promise.resolve(); }
    const ogg = { value: P.rivelaTutto };
    const p = this.anima(ogg, livello, durata || 0);
    const r = this.ogni(0.02, () => { P.rivelaTutto = ogg.value; if (ogg.value >= livello - 0.001) r.ferma(); });
    if (!durata) P.rivelaTutto = livello;
    return p;
  }

  /** Un nuovo ricordo raccolto: icona, suono e scintille. */
  ricordo(arte, titolo) {
    this.ricordiPresi.push({ arte, titolo });
    Interfaccia.ricordo(arte, titolo);
    Audio.ricordo();
    this.scintille(this.lia.x, this.lia.y + 0.9, this.lia.z, 30, { forma: [FORME.stella, FORME.cuore, FORME.scintilla] });
    this.pensa('Nuovo ricordo: ' + titolo, 3, true);
  }

  salva(capitolo) {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({ capitolo, ricordi: this.ricordiPresi, meraviglie: [...this.meraviglieTrovate] }));
    } catch (e) { /* niente spazio */ }
  }

  leggiSalvataggio() {
    try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch (e) { return null; }
  }

  /** Mostra o nasconde il guinzaglio. */
  guinzaglio(si) { this.mostraGuinzaglio = si; }

  /** La sagoma dell'abbraccio finale (Lia e Biscotto insieme) in (x, z). */
  sagomaAbbraccio(x, z) {
    const s = new Sagoma('abbraccio', { ombra: 0.45, luce: 1 });
    s.aggiungiA(this.corrente.gruppo);
    s.posiziona(x, this.corrente.quota(x, z), z);
    const nomi = s.atlante.nomi;
    let k = 0;
    this.ogni(0.45, () => { k = (k + 1) % nomi.length; s.mostra(nomi[k]); });
    return s;
  }

  fine(testo) {
    this.fase = 'fine';
    Interfaccia.fine(testo);
    try { localStorage.removeItem(CHIAVE); } catch (e) { /* niente */ }
  }
}

/* -------------------------------------------------------------------------- */
const gioco = new Gioco();
window.Gioco = gioco; // per curiosare dalla console del browser
window.__input = Input; // per i collaudi automatici
gioco.avvia().catch((errore) => {
  console.error(errore);
  const el = document.getElementById('testoCaricamento');
  if (el) el.textContent = 'Si è verificato un errore: ' + errore.message;
});

