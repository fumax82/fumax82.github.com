/* ==========================================================================
 *  main.js — IL CUORE DEL GIOCO
 *  --------------------------------------------------------------------------
 *  Qui nasce l'oggetto "Gioco" che tiene insieme tutto:
 *    - prepara la grafica (Three.js) e fa dipingere le immagini
 *    - carica i LUOGHI (la via, la città immaginata, il forno...)
 *    - circa 60 volte al secondo aggiorna il mondo e lo disegna
 *    - offre alla STORIA (dati/storia.js) dei comandi semplici:
 *        g.vai('forno'), g.dialogo('fornaia', [...]), g.pensa('...'),
 *        g.obiettivo('...'), g.attendi(2), g.evento('...'), g.musica('...')
 *
 *  Fasi: 'caricamento' → 'menu' → 'gioco' (o 'volo' sulla balena) → 'fine'
 * ========================================================================== */
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Galleria } from './arte/galleria.js';
import { UNIFORMI, creaRumore } from './motore/materiali.js';
import { costruisciLuogo } from './motore/costruttore.js';
import { Telecamera } from './motore/camera.js';
import { Acquerello } from './motore/acquerello.js';
import { Particelle, FORME } from './motore/particelle.js';
import { Volo } from './motore/volo.js';
import { Sagoma } from './motore/sagoma.js';
import { Mondo } from './gioco/mondo.js';
import { Giocatore } from './gioco/giocatore.js';
import { creaAttore, Guinzaglio, Persona } from './gioco/attori.js';
import { Audio } from './gioco/audio.js';
import { Musica } from './gioco/musica.js';
import { Input } from './gioco/input.js';
import { Interfaccia } from './gioco/interfaccia.js';
import { Regista } from './gioco/regista.js';
import via from './dati/luoghi/via.js';
import oltre from './dati/luoghi/oltre.js';
import { forno, libreria, piazzetta } from './dati/luoghi/interni.js';
import { avviaStoria } from './dati/storia.js';

const LUOGHI = { via, oltre, forno, libreria, piazzetta };
const FERMO = { avanti: 0, laterale: 0, rotazione: 0, corsa: false };
const NESSUNO_SGUARDO = { dx: 0, dy: 0 };
const CHIAVE = 'tocchi-di-colore-salvataggio';
const CARTA = '#fbf6ea';

class Gioco {
  constructor() {
    this.fase = 'caricamento';
    this.tempo = 0;
    this.inPausa = false;
    this.inScena = false;          // true durante le scene della storia
    this.luoghi = {};
    this.corrente = null;
    this.mondo = null;
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

    Interfaccia.caricamento(0.02, 'Preparo i pennelli...');
    const anisotropia = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    await Galleria.carica((f, testo) => Interfaccia.caricamento(0.04 + f * 0.92, testo), anisotropia);

    this.scena = new THREE.Scene();
    this.scena.background = new THREE.Color(CARTA);
    this.telecamera = new Telecamera();
    this.acquerello = new Acquerello(this.renderer);
    this.particelle = new Particelle();
    this.scena.add(this.particelle.punti);
    this.regista = new Regista();
    this.lia = new Giocatore(this);
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

    // Quando Lia sbatte contro qualcosa nel mondo bianco, l'ostacolo "appare"
    // (come nel cortometraggio, dove al posto dell'urto spunta un albero)
    this.regista.su('urto', () => {
      if (!this.mondo || this.mondo.rivelaTutto > 0.5) return;
      const x = this.lia.x + Math.cos(this.lia.angolo) * 0.5, y = this.lia.y + Math.sin(this.lia.angolo) * 0.5;
      this.mondo.creaOnda(x, y, { velocita: 4, raggio: 2.4, forza: 0.6, colore: '#9fd08a', livello: 1 });
      this.particelle.emetti(x, this.lia.quota + 0.9, y, 10, { forma: [FORME.foglia], colori: ['#8fc27f', '#6faa5e', '#b4dea1'], velocita: 1, su: 0.6, gravita: 0.8, vita: 1.6, dim: 0.2 });
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
    Audio.avvia();
    Interfaccia.nascondiMenu();
    Input.richiediAggancio();
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
    Input.su('vista', () => {
      if (this.fase !== 'gioco') return;
      this.telecamera.cambiaModo();
      document.getElementById('btnVista').classList.toggle('terza', this.telecamera.modo === 'terza');
    });
    Input.su('pausa', () => { if (this.fase === 'gioco' || this.fase === 'volo') this.pausa(!this.inPausa); });
    Input.su('perdiFuoco', () => { if ((this.fase === 'gioco' || this.fase === 'volo') && !this.inPausa) this.pausa(true); });
  }

  pausa(si) {
    this.inPausa = si;
    Interfaccia.pausa(si);
    Audio.sospendi(si);
    if (si) Input.rilasciaAggancio();
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
    this.telecamera.ridimensiona(L, A);
    if (this.volo) this.volo.ridimensiona(L, A);
    this.particelle.ridimensiona(A * dpr * p.scala);
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
  /*  LUOGHI                                                                */
  /* ====================================================================== */
  _prepara(id) {
    if (this.luoghi[id]) return this.luoghi[id];
    const dati = LUOGHI[id];
    const mondo = new Mondo(dati);
    const costruito = costruisciLuogo(mondo, dati);
    const attori = (dati.attori || []).map((def) => {
      const a = creaAttore(this, def);
      a.aggiungiA(costruito.gruppo);
      if (def.visibile === false) a.visibile = false;
      return a;
    });
    const interazioni = [];
    for (const p of dati.porte || []) interazioni.push({ ...p, tipo: 'porta', attiva: true });
    for (const i of dati.interazioni || []) interazioni.push({ ...i, tipo: 'evento', attiva: false });
    for (const a of attori) {
      if (a instanceof Persona) interazioni.push({ id: a.id, tipo: 'persona', attore: a, raggio: 1.6, etichetta: 'Parla', attiva: true });
    }
    const L = { id, dati, mondo, costruito, attori, interazioni };
    this.luoghi[id] = L;
    return L;
  }

  /**
   * Porta Lia in un altro luogo, con una dissolvenza al bianco.
   * opz: { subito: true } = senza dissolvenza; { senzaMusica: true }
   */
  async vai(id, arrivo, opz) {
    const o = opz || {};
    if (this.corrente && !o.subito) await this.bianco(1, 0.55);
    if (this.corrente) this._esci();
    const L = this._prepara(id);
    this.corrente = L;
    this.mondo = L.mondo;
    this.scena.add(L.costruito.gruppo);
    UNIFORMI.uRiv.value = L.mondo.textureRiv;
    UNIFORMI.uDimMondo.value.set(L.mondo.larghezza, L.mondo.altezza);
    const atm = L.dati.atmosfera || {};
    UNIFORMI.uNebbiaColore.value.set(atm.nebbiaColore || '#f6efe2');
    UNIFORMI.uNebbia.value.set(...(atm.nebbia || CONFIG.grafica.nebbia));
    if (atm.sole) UNIFORMI.uSole.value.set(...atm.sole).normalize();
    // gli interni (forno, libreria) sono caldi e accoglienti: tutti a colori
    if (atm.tuttoVisibile) L.mondo.rivelaTutto = 1;
    if (atm.bordoBianco !== undefined) this.bordoBianco(atm.bordoBianco, o.subito ? 0 : 0.8);
    Audio.mondo = L.mondo;
    this.lia.mondo = L.mondo;
    const a = (L.dati.arrivi || {})[arrivo] || Object.values(L.dati.arrivi)[0];
    this.lia.posiziona(a.x, a.y, a.angolo);
    this.lia.inclinazione = 0;
    this.telecamera.angoloLiscio = a.angolo;
    this.telecamera.libera();
    this.suoniLuogo = (L.dati.suoni || []).map((s) => Audio.continuo(s.tipo, s.x, s.y, s.volume));
    if (L.dati.musica && !o.senzaMusica) Musica.suona(L.dati.musica);
    this.regista.emetti('entrato:' + id);
    if (!o.subito) await this.bianco(0, 0.7);
  }

  _esci() {
    const L = this.corrente;
    this.scena.remove(L.costruito.gruppo);
    Audio.fermaContinui();
    for (const a of L.attori) {
      if (a.silenzia) a.silenzia();
      if (a.emettitore) a.emettitore.attivo = false;
    }
    this.particelle.emettitori = this.particelle.emettitori.filter((e) => !e.delLuogo);
  }

  attore(id) {
    const L = this.corrente;
    return L ? L.attori.find((a) => a.id === id) : null;
  }

  attoriSolidi() {
    return this.corrente ? this.corrente.attori.filter((a) => a.solido && a.visibile && a.x !== undefined && !a.def.galleggia) : [];
  }

  /* ====================================================================== */
  /*  INTERAZIONI (porte, persone, punti speciali)                          */
  /* ====================================================================== */
  _cercaInterazione() {
    const L = this.corrente;
    if (!L || !this.lia.controllo || this.inScena || Interfaccia.dialogoAperto) return null;
    let migliore = null, dMin = Infinity;
    for (const it of L.interazioni) {
      if (!it.attiva) continue;
      let x = it.x, y = it.y;
      if (it.attore) { if (!it.attore.visibile) continue; x = it.attore.x; y = it.attore.y; }
      if (it.segue) { const a = this.attore(it.segue); if (!a || !a.visibile) continue; x = a.x; y = a.y; }
      const d = Math.hypot(x - this.lia.x, y - this.lia.y);
      if (d > it.raggio) continue;
      let diff = Math.abs(((Math.atan2(y - this.lia.y, x - this.lia.x) - this.lia.angolo) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (d > 0.8 && diff > 1.4) continue;   // deve essere più o meno davanti a Lia
      if (d < dMin) { dMin = d; migliore = it; }
    }
    return migliore;
  }

  async _interagisci(it) {
    if (it.tipo === 'porta') {
      if (it.bloccata && !this.porteAperte[it.id]) { Interfaccia.messaggio(it.bloccata, 3.5, true); return; }
      if (it.campanello) Audio.campanello();
      await this.vai(it.verso, it.arrivo);
    } else if (it.tipo === 'persona') {
      const a = it.attore;
      this.lia.controllo = false;
      a.parlando = true;
      a.guarda(this.lia.x, this.lia.y);
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
      else if (this.corrente) this._aggiornaGioco(dt);
      this.regista.aggiorna(dt);
      this.particelle.aggiorna(dt, this.tempo);
      this._aggiornaAnimazioni(dt);
    }
    Musica.aggiorna();
    this._disegna(dt);
    Interfaccia.aggiorna(dt);
    this._qualitaAutomatica(dt);
  }

  _aggiornaGioco(dt) {
    const L = this.corrente;
    const libero = this.lia.controllo && !this.inScena && !Interfaccia.dialogoAperto;
    const mov = libero ? Input.leggiMovimento() : FERMO;
    const sguardo = Input.consumaSguardo();
    this.lia.aggiorna(dt, mov, libero ? sguardo : NESSUNO_SGUARDO);
    for (const a of L.attori) a.aggiorna(dt, L.mondo);
    L.mondo.aggiorna(dt, this.lia);
    UNIFORMI.uNumOnde.value = L.mondo.scriviOnde(UNIFORMI.uOnde.value, UNIFORMI.uOndeColori.value);
    UNIFORMI.uRivelaTutto.value = L.mondo.rivelaTutto;
    this.telecamera.aggiorna(dt, this.lia, L.mondo);
    Audio.aggiorna(this.lia.x, this.lia.y, this.lia.angolo);
    const it = this._cercaInterazione();
    if (it !== this.interazioneAttuale && !this.occupato) {
      this.interazioneAttuale = it;
      Interfaccia.azione(it ? it.etichetta : null);
    }
  }

  _disegna(dt) {
    if (this.fase === 'volo') {
      this.acquerello.disegna(this.volo.scena, this.volo.camera);
      Interfaccia.disegnaMano(this.lia, 1, this.tempo);
      return;
    }
    const L = this.corrente;
    if (!L) return;
    const cam = this.telecamera.camera;
    const cx = cam.position.x, cy = cam.position.z;
    for (const a of L.attori) a.disegna(cx, cy);
    const terza = !!this.telecamera.cinematica || (this.telecamera.transizione > 0.35 && this.telecamera.distanza > 0.45);
    this.lia.disegna(cx, cy, terza && !this.liaNascosta);
    // guinzaglio tra la mano di Lia e il collare di Biscotto
    const b = this.attore('biscotto');
    const g = this.guinzaglioLinea;
    g.linea.visible = !!(this.mostraGuinzaglio && b && b.visibile && terza);
    if (g.linea.visible) {
      const dx = Math.cos(this.lia.angolo + Math.PI / 2) * 0.17, dy = Math.sin(this.lia.angolo + Math.PI / 2) * 0.17;
      g.aggiorna([this.lia.x + dx, this.lia.quota + 0.42, this.lia.y + dy], [b.x, b.h + 0.3, b.y]);
    }
    L.costruito.aggiorna(dt, this.tempo, cam);
    this.acquerello.disegna(this.scena, cam);
    Interfaccia.disegnaMano(this.lia, this.telecamera.cinematica ? 1 : this.telecamera.transizione, this.tempo);
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
    this.fase = 'gioco';
  }

  _aggiornaVolo(dt) {
    this.voloT = Math.min(1, this.voloT + dt / 30);
    this.volo.aggiorna(dt, this.voloT);
    this.particelle.punti.visible = false;
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

  /** Abilita o disabilita un punto di interazione del luogo attuale. */
  interazione(id, attiva) {
    const it = this.corrente && this.corrente.interazioni.find((i) => i.id === id);
    if (it) it.attiva = attiva;
  }

  apriPorta(id) { this.porteAperte[id] = true; }

  inquadra(pos, guarda, durata) { this.telecamera.inquadra(pos, guarda, durata); }
  libera() { this.telecamera.libera(); }

  vista(modo) {
    this.telecamera.modo = modo;
    document.getElementById('btnVista').classList.toggle('terza', modo === 'terza');
  }

  /** Onda di percezione: tipo = 'bastone' | 'abbaio' | 'profumo' | 'suono' | 'magia' */
  onda(x, y, tipo, extra) {
    if (this.mondo) this.mondo.creaOnda(x, y, { ...CONFIG.onde[tipo], ...(extra || {}) });
  }

  scintille(x, h, y, quante, opz) {
    this.particelle.emetti(x, h, y, quante, {
      forma: [FORME.stella, FORME.scintilla, FORME.punto], colori: ['#fff0a0', '#ffd36b', '#ffffff', '#f7b6d8'],
      velocita: 1.5, su: 1, gravita: 0.8, vita: 1.6, dim: 0.22, ...(opz || {}),
    });
  }

  /** Emettitore di particelle legato al luogo attuale (sparisce uscendo). */
  emettitore(x, h, y, ritmo, opz) {
    const e = this.particelle.aggiungiEmettitore(x, h, y, ritmo, opz);
    e.delLuogo = true;
    return e;
  }

  /** Dissolvenza verso il bianco (1) o ritorno all'immagine (0). */
  bianco(valore, durata) { return this.anima(this.acquerello.uniformi.uBianco, valore, durata); }
  bordoBianco(valore, durata) { return this.anima(this.acquerello.uniformi.uBordoBianco, valore, durata || 0); }
  cieloColore(valore, durata) { return this.anima(UNIFORMI.uColoreCielo, valore, durata || 0); }

  /** Tutto il luogo visibile (1) o tutto bianco (0), con eventuale transizione. */
  coloraMondo(livello, durata) {
    if (!this.mondo) return Promise.resolve();
    if (livello <= 0) { this.mondo.rivelaTutto = 0; this.mondo.coloraTutto(0); return Promise.resolve(); }
    const ogg = { value: this.mondo.rivelaTutto };
    const m = this.mondo;
    const p = this.anima(ogg, livello, durata || 0);
    const r = this.ogni(0.02, () => { m.rivelaTutto = ogg.value; if (ogg.value >= livello - 0.001) r.ferma(); });
    if (!durata) m.rivelaTutto = livello;
    return p;
  }

  /** Un nuovo ricordo raccolto: icona, suono e scintille. */
  ricordo(arte, titolo) {
    this.ricordiPresi.push({ arte, titolo });
    Interfaccia.ricordo(arte, titolo);
    Audio.ricordo();
    this.scintille(this.lia.x, this.lia.quota + 0.8, this.lia.y, 30, { forma: [FORME.stella, FORME.cuore, FORME.scintilla] });
    this.pensa('Nuovo ricordo: ' + titolo, 3, true);
  }

  salva(capitolo) {
    try { localStorage.setItem(CHIAVE, JSON.stringify({ capitolo, ricordi: this.ricordiPresi })); } catch (e) { /* niente spazio */ }
  }

  leggiSalvataggio() {
    try { return JSON.parse(localStorage.getItem(CHIAVE) || 'null'); } catch (e) { return null; }
  }

  /** Mostra o nasconde il guinzaglio. */
  guinzaglio(si) { this.mostraGuinzaglio = si; }

  /** La sagoma dell'abbraccio finale (Lia e Biscotto insieme). */
  sagomaAbbraccio(x, y) {
    const s = new Sagoma('abbraccio', { ombra: 0.45, luce: 1 });
    s.aggiungiA(this.corrente.costruito.gruppo);
    s.posiziona(x, y, this.mondo.quota(x, y));
    this.ogni(0.6, () => s.mostra(s.fotogramma === 'base_0' ? 'base_1' : 'base_0'));
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
gioco.avvia().catch((errore) => {
  console.error(errore);
  const el = document.getElementById('testoCaricamento');
  if (el) el.textContent = 'Si è verificato un errore: ' + errore.message;
});
