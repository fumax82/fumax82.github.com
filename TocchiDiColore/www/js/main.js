/* ==========================================================================
 *  main.js — IL CUORE DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui nasce l'oggetto "Gioco" che tiene insieme tutto:
 *    - prepara la grafica (Three.js) e fa dipingere personaggi e oggetti
 *    - monta le SCENE (la via, la piazza, il forno, il canale...): piani
 *      dipinti appesi nello spazio, come in un teatrino di carta
 *    - circa 60 volte al secondo muove Lia lungo il suo percorso, aggiorna
 *      il mondo che si colora, la regia delle telecamere, e disegna
 *    - a ogni tocco del ditino fa succedere qualcosa (gioco/sorprese.js):
 *      il gioco è per i più piccoli, non c'è niente da leggere
 *    - offre alla STORIA (dati/storia.js) dei comandi semplici:
 *        g.vai('piazza'), g.attendi(2), g.quando(...), g.musica('...'),
 *        g.inquadra(...), g.onda(...), g.scintille(...)
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
import { Sorprese } from './gioco/sorprese.js';
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
    this.animazioni = [];          // dissolvenze e altre transizioni
    this.ripetizioni = [];         // azioni da ripetere ogni tot secondi
    this.suoniLuogo = [];
    this.senzaTocchi = 0;          // da quanto la bimba non tocca lo schermo (secondi)
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
    this.sorprese = new Sorprese(this);       // a ogni tocco del ditino, una sorpresa
    this.effetti.particelle = this.particelle;
    this.effetti.luci = this.luci;
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
      this.concentra([p.x, p.y + 0.7, z], 0.9, '#3e2a20', 0.6);
      Audio.botta();
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
    this.meraviglieTrovate.clear();          // ogni nuova storia: tutte le meraviglie da riscoprire
    if (salvato && salvato.meraviglie) salvato.meraviglie.forEach((k) => this.meraviglieTrovate.add(k));
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
    Input.su('tocco', (dove) => {
      if (this.fase !== 'gioco' || this.inPausa) return;
      this.senzaTocchi = 0;
      if (dove) {                                      // dito o mouse: nel punto toccato
        Interfaccia.segnoTocco(dove.x, dove.y);
        this._toccoSchermo(dove.x, dove.y);
      }
      else this.lia.tocca();                          // tastiera: davanti ai piedi
    });
    Input.su('pausa', () => { if (this.fase === 'gioco' || this.fase === 'volo') this.pausa(!this.inPausa); });
    Input.su('perdiFuoco', () => { if ((this.fase === 'gioco' || this.fase === 'volo') && !this.inPausa) this.pausa(true); });
  }

  /**
   * IL DITO SULLO SCHERMO (cx, cy in pixel): dove cade nel mondo?
   *  1. se il dito tocca un PERSONAGGIO (o Lia), quel personaggio fa festa
   *  2. altrimenti un raggio parte dalla telecamera e attraversa il punto
   *     toccato: il primo strato dipinto (non trasparente) che incontra è il
   *     punto in cui nasce una sorpresa e in cui Lia batte il bastone (o fa
   *     arrivare la magia della bacchetta) e il mondo si colora
   */
  _toccoSchermo(cx, cy) {
    const S = this.corrente;
    if (!S) return;
    const cam = this.regia.camera;
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = this._ndc || (this._ndc = new THREE.Vector2());
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    // --- 1. un personaggio sotto il dito? -----------------------------------
    const chi = this._personaggioSotto(ndc, r);
    if (chi) { this.sorprese.festa(chi); return; }
    // --- 2. il punto del mondo sotto il dito ---------------------------------
    const raggio = this._raggio || (this._raggio = new THREE.Raycaster());
    raggio.setFromCamera(ndc, cam);
    raggio.far = 60;
    let colpo = S.colpisci(raggio);
    if (!colpo || colpo.lontano) {
      // niente di vicino sotto il dito (il cielo, un fondale lontano):
      // si prende il punto del pavimento, oppure quello alla stessa
      // distanza di Lia lungo il raggio
      const L = this.lia, o = raggio.ray.origin, d = raggio.ray.direction;
      let t = d.y < -0.02 ? (L.y - o.y) / d.y : Infinity;
      const avanti = cam.getWorldDirection(this._avanti || (this._avanti = new THREE.Vector3()));
      const tLia = ((L.x - o.x) * avanti.x + (L.y + 0.5 - o.y) * avanti.y + (L.z - o.z) * avanti.z) / (d.dot(avanti) || 1);
      if (!(t > 0) || t > tLia * 3) t = tLia;
      if (!colpo || colpo.punto.distanceTo(o) > t) {
        const p = o.clone().addScaledVector(d, t);
        colpo = { punto: p, muro: p.y > S.quota(p.x, p.z) + 0.4, materiale: null };
      }
    }
    const p = colpo.punto;
    this.sorprese.nelPunto(p.x, p.y + (colpo.muro ? 0 : 0.15), p.z);
    this.lia.toccaPunto(p, colpo);
  }

  /** Il personaggio (o Lia) che sta sotto il punto toccato, se c'è. */
  _personaggioSotto(ndc, r) {
    const cam = this.regia.camera;
    const v = this._v1 || (this._v1 = new THREE.Vector3());
    const w = this._v2 || (this._v2 = new THREE.Vector3());
    let migliore = null, dMin = Infinity;
    const candidati = [this.lia, ...this.corrente.attori];
    for (const a of candidati) {
      if (!a || !a.sagoma || (a.visibile === false) || (a === this.lia && a.nascosta)) continue;
      const alto = a.sagoma.altezza || 1;
      // i piedi e la testa sullo schermo: così sappiamo quanto è grande
      v.set(a.x, a.y, a.z).project(cam);
      w.set(a.x, a.y + alto, a.z).project(cam);
      if (v.z > 1 || w.z > 1) continue;                     // dietro la camera
      const altezzaSchermo = Math.abs(w.y - v.y);
      const cx = v.x, cy = (v.y + w.y) / 2;
      const larg = Math.max(altezzaSchermo * 0.45 * (r.height / r.width), 0.05);
      const dx = (ndc.x - cx) / larg, dy = (ndc.y - cy) / Math.max(altezzaSchermo * 0.6, 0.06);
      const d = dx * dx + dy * dy;
      if (d < 1 && d < dMin) { dMin = d; migliore = a; }
    }
    return migliore;
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
    const schermo = window.devicePixelRatio || 1;
    // il mondo si disegna a una risoluzione (dpr) e l'immagine finale, più
    // nitida, a quella dello schermo (uscita): il filtro acquerello ingrandisce
    // con cura e ripassa i contorni (vedi motore/acquerello.js)
    const dpr = Math.min(schermo, p.pixelRatio);
    const uscita = Math.max(dpr, Math.min(schermo, p.uscita || p.pixelRatio));
    this.renderer.setPixelRatio(uscita);
    this.renderer.setSize(L, A);
    this.acquerello.imposta(L, A, dpr, p.scala, p.campioni, uscita);
    this.regia.ridimensiona(L, A);
    if (this.volo) this.volo.ridimensiona(L, A);
    this.particelle.ridimensiona(A * dpr * p.scala);
    this.luci.ridimensiona(A * dpr * p.scala);
  }

  /** Se il dispositivo fatica, abbassa la qualità da solo. */
  _qualitaAutomatica(dt) {
    if (CONFIG.grafica.qualita !== 'auto' || this.fase === 'menu' || this.inPausa) return;
    // mentre si dipinge una scena nuova i fotogrammi sono lenti per forza: non contano
    if (this.caricaScena) { this.dopoCarica = 2.5; return; }
    if (this.dopoCarica > 0) { this.dopoCarica -= dt; return; }
    const LIVELLI = ['minima', 'bassa', 'media', 'alta'];
    const k = LIVELLI.indexOf(this.qualita);
    // media "scivolante" del tempo di ogni fotogramma (millisecondi)
    this.mediaLavoro = this.mediaLavoro * 0.97 + Math.min(dt, 0.1) * 1000 * 0.03;
    // troppo lento (meno di ~30 fotogrammi al secondo) per 3 secondi: si scende
    this.tempoLento = this.mediaLavoro > 33 ? this.tempoLento + dt : 0;
    // molto fluido (quasi 60 al secondo) per 12 secondi: si prova a risalire
    // (ma mai sopra un livello che si è già dimostrato troppo pesante)
    this.tempoVeloce = this.mediaLavoro < 18.5 ? (this.tempoVeloce || 0) + dt : 0;
    let nuovo = k;
    if (this.tempoLento > 3 && k > 0) { nuovo = k - 1; this.tettoQualita = k - 1; }
    else if (this.tempoVeloce > 12 && k < (this.tettoQualita !== undefined ? this.tettoQualita : 3)) nuovo = k + 1;
    if (nuovo !== k) {
      this.qualita = LIVELLI[nuovo];
      this.tempoLento = 0; this.tempoVeloce = 0;
      this.mediaLavoro = 20;
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
    // niente linee manga rimaste dalla scena di prima
    this.focus = null;
    this.acquerello.uniformi.uFocus.value.z = 0;
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
  /*  CICLO PRINCIPALE                                                      */
  /* ====================================================================== */
  ciclo(t) {
    requestAnimationFrame((tt) => this.ciclo(tt));
    let grezzo = (t - this.ultimo) / 1000;
    this.ultimo = t;
    if (!(grezzo > 0)) grezzo = 0.016;
    if (grezzo > 0.05) grezzo = 0.05;
    // FLUIDITÀ: i telefoni consegnano i fotogrammi a intervalli un po'
    // irregolari (16, 21, 12 ms...). Se usassimo il tempo "grezzo" il
    // movimento farebbe piccoli scatti; lo smussiamo un poco (la media resta
    // la stessa, quindi il gioco non rallenta né accelera).
    this.dtLiscio = this.dtLiscio ? this.dtLiscio + (grezzo - this.dtLiscio) * 0.3 : grezzo;
    let dt = Math.abs(grezzo - this.dtLiscio) > 0.025 ? grezzo : this.dtLiscio;
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
    this._qualitaAutomatica(grezzo);
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
    const libero = this.lia.controllo && !this.inScena;
    const dir = libero ? this._direzioneSulPercorso() : 0;
    if (!libero) this.direzioneSchermo = 0;
    this.lia.aggiorna(dt, dir, Input.corsa());
    for (const a of S.attori) a.aggiorna(dt, S);
    S.percezione.aggiorna(dt, { x: this.lia.x, z: this.lia.z });
    this.magia.aggiorna(dt);
    this.meraviglie.aggiorna(dt);
    this.meteo.aggiorna(dt, this.regia.camera);
    // linee manga: concentrazione che si spegne, velocità quando Lia corre
    const ua = this.acquerello.uniformi;
    if (this.focus) {
      this.focus.t += dt;
      const k = this.focus.t / this.focus.durata;
      ua.uFocus.value.z = this.focus.forza * Math.max(0, 1 - k * k);
      if (k >= 1) { this.focus = null; ua.uFocus.value.z = 0; }
    }
    const corsa = this.lia.corre && Math.abs(this.lia.vel) > 1.6 ? 0.8 : 0;
    ua.uVelocita.value += (corsa - ua.uVelocita.value) * Math.min(1, dt * 4);
    const ec = this.regia.camera.matrixWorld.elements;
    ua.uVersoVelocita.value = (this.lia.tangente.x * this.lia.verso * ec[0] + this.lia.tangente.z * this.lia.verso * ec[2]) >= 0 ? 1 : -1;
    UNIFORMI.uNumOnde.value = S.percezione.scriviOnde(UNIFORMI.uOnde.value, UNIFORMI.uOndeColori.value);
    UNIFORMI.uRivelaTutto.value = S.percezione.rivelaTutto;
    this.regia.aggiorna(dt, this.lia);
    // la messa a fuoco segue Lia (vedi la profondità di campo in materiali.js)
    const c = this.regia.camera.position;
    const fuoco = Math.hypot(c.x - this.lia.x, c.y - this.lia.y - 0.6, c.z - this.lia.z);
    UNIFORMI.uFuoco.value += (fuoco - UNIFORMI.uFuoco.value) * Math.min(1, dt * 4);
    const e = this.regia.camera.matrixWorld.elements;
    Audio.aggiorna(this.lia.x, this.lia.z, Math.atan2(-e[10], -e[8]));
    this.sorprese.aggiorna(dt);
    // se la bimba non tocca per un po', Lia batte il bastone da sola: il
    // mondo continua a colorarsi e non ci si annoia mai
    this.senzaTocchi += dt;
    if (this.senzaTocchi > CONFIG.bimbi.toccoDaSola && this.lia.puoToccare && this.lia.controllo && S.percezione.rivelaTutto < 0.5) {
      this.senzaTocchi = 0;
      this.lia.tocca();
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
    // guinzaglio tra la mano di Lia e il collare di Gogo
    const b = this.attore('gogo');
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
    Musica.suona('volo');
    const vento = Audio.continuo('vento', undefined, undefined, 0.22);
    Audio.balena();
    const canti = this.ogni(9, () => Audio.balena());
    this.acquerello.uniformi.uBordoBianco.value = 0.35;
    await this.bianco(0, 1.6);
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
  }

  musica(nome) { Musica.suona(nome); }

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
    this.effetti.onomatopea(S[0], x, y + 0.35, z, S[1], tipo === 'balena' ? 3.2 : 1.25);
    this.effetti.archi(x, y, z, S[2], tipo === 'balena' ? 3 : 2);
  }

  /**
   * LINEE DI CONCENTRAZIONE (manga) verso il punto [x, y, z] del mondo, per
   * "durata" secondi. colore: '#fffaf0' (meraviglia) o '#3e2a20' (sorpresa).
   */
  concentra(punto, durata, colore, forza) {
    const v = new THREE.Vector3(...punto).project(this.regia.camera);
    const u = this.acquerello.uniformi;
    u.uFocus.value.set((v.x + 1) / 2, (v.y + 1) / 2, forza || 0.85, Math.random() * 10);
    u.uColoreFocus.value.set(colore || '#fffaf0');
    this.focus = { t: 0, durata: durata || 1.2, forza: forza || 0.85 };
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

  /** Un dono per Lia (il bastoncino, il pane...): suono e una pioggia di stelle e cuori. */
  dono(x, y, z) {
    Audio.ricordo();
    this.scintille(x, y, z, 30, { forma: [FORME.stella, FORME.cuore, FORME.scintilla] });
  }

  salva(capitolo) {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({ capitolo, meraviglie: [...this.meraviglieTrovate] }));
    } catch (e) { /* niente spazio */ }
  }

  leggiSalvataggio() {
    try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch (e) { return null; }
  }

  /** Mostra o nasconde il guinzaglio. */
  guinzaglio(si) { this.mostraGuinzaglio = si; }

  /** La sagoma dell'abbraccio finale (Lia e Gogo insieme) in (x, z). */
  sagomaAbbraccio(x, z) {
    const s = new Sagoma('abbraccio', { ombra: 0.45, luce: 1 });
    s.aggiungiA(this.corrente.gruppo);
    s.posiziona(x, this.corrente.quota(x, z), z);
    const nomi = s.atlante.nomi;
    let k = 0;
    this.ogni(0.45, () => { k = (k + 1) % nomi.length; s.mostra(nomi[k]); });
    return s;
  }

  /** La fine: un'illustrazione senza parole e un grande pulsante per ricominciare. */
  fine() {
    this.fase = 'fine';
    Interfaccia.fine();
    try { localStorage.removeItem(CHIAVE); } catch (e) { /* niente */ }
  }
}

/* -------------------------------------------------------------------------- */
const gioco = new Gioco();
window.Gioco = gioco; // per curiosare dalla console del browser
window.__input = Input; // per i collaudi automatici

/**
 * Scarica i disegni come PNG, da usare come "traccia" per ridipingerli a mano
 * (vedi arte/dipinti_a_mano.js). Dalla console del browser:
 *   esportaDisegni()           i fondali della scena in cui si trova Lia
 *   esportaDisegni('atlanti')  tutti i personaggi e gli oggetti
 */
window.esportaDisegni = async (cosa) => {
  const { esporta } = await import('./arte/dipinti_a_mano.js');
  if (cosa === 'atlanti') {
    for (const [nome, at] of Object.entries(Galleria.atlanti)) esporta(at.tela, nome);
    return Object.keys(Galleria.atlanti);
  }
  const S = gioco.corrente;
  if (!S) return 'Entra prima in una scena';
  const nomi = [];
  for (const m of S.gruppo.children) {
    if (!m.userData || !m.userData.tela || !m.name) continue;
    esporta(m.userData.tela, S.def.arte.nome + '_' + m.name);
    nomi.push(S.def.arte.nome + '/' + m.name);
  }
  return nomi;
};
gioco.avvia().catch((errore) => {
  console.error(errore);
  const el = document.getElementById('testoCaricamento');
  if (el) el.textContent = 'Si è verificato un errore: ' + errore.message;
});

