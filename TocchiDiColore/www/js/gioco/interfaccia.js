/* ==========================================================================
 *  interfaccia.js — TUTTO CIÒ CHE STA SOPRA IL GIOCO (HTML)
 *  --------------------------------------------------------------------------
 *  Caricamento, menu, opzioni, dialoghi con ritratto, pensieri di Lia,
 *  cartelli dei capitoli, obiettivo, ricordi raccolti, pulsanti touch,
 *  pausa e finale.
 * ========================================================================== */
import { Galleria } from '../arte/galleria.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
const pausaBreve = (ms) => new Promise((ok) => setTimeout(ok, ms));

export const Interfaccia = {
  coda: [],
  messaggioAttivo: false,
  tempoMessaggio: 0,
  dialogoAperto: false,
  _avanzaDialogo: null,
  ricordiPresi: [],
};

Interfaccia.inizializza = function (azioni) {
  this.azioni = azioni;
  // pulsanti del menu
  $('btnNuova').onclick = () => { Audio.clic(); azioni.nuovaPartita(); };
  $('btnContinua').onclick = () => { Audio.clic(); azioni.continua(); };
  $('btnOpzioni').onclick = () => { Audio.clic(); this.mostraOpzioni(true); };
  $('btnCrediti').onclick = () => { Audio.clic(); $('crediti').classList.remove('nascosto'); };
  $('btnChiudiCrediti').onclick = () => $('crediti').classList.add('nascosto');
  $('btnChiudiOpzioni').onclick = () => { Audio.clic(); this.mostraOpzioni(false); };
  $('btnRiprendi').onclick = () => { Audio.clic(); azioni.pausa(false); };
  $('btnOpzioniPausa').onclick = () => { Audio.clic(); this.mostraOpzioni(true); };
  $('btnMenuPrincipale').onclick = () => { Audio.clic(); window.location.reload(); };
  $('btnFineMenu').onclick = () => window.location.reload();
  // pulsanti di gioco
  const premi = (id, evento) => {
    $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Input.emetti(evento); });
  };
  premi('btnToc', 'tocco');
  premi('btnAzione', 'azione');
  premi('btnPausa', 'pausa');
  // il dialogo avanza toccando ovunque
  $('dialogo').addEventListener('pointerdown', (e) => { e.preventDefault(); this.avanzaDialogo(); });

  // opzioni
  const qualita = $('optQualita');
  qualita.value = CONFIG.grafica.qualita;
  qualita.onchange = () => azioni.qualita(qualita.value);
  const musica = $('optMusica'), effetti = $('optEffetti');
  musica.value = CONFIG.audio.musica; effetti.value = CONFIG.audio.effetti;
  musica.oninput = effetti.oninput = () => Audio.impostaVolumi(parseFloat(musica.value), parseFloat(effetti.value));

  if (Input.eTouch) document.body.classList.add('touch');
};

/* ------------------------------------------------------------------------ */
/*  Caricamento e menu                                                      */
/* ------------------------------------------------------------------------ */
Interfaccia.caricamento = function (frazione, testo) {
  $('barraCaricamento').style.width = Math.round(frazione * 100) + '%';
  if (testo) $('testoCaricamento').textContent = testo;
};

Interfaccia.nascondiCaricamento = function () {
  $('caricamento').classList.add('sparisce');
  setTimeout(() => $('caricamento').classList.add('nascosto'), 900);
};

Interfaccia.mostraMenu = function (haSalvataggio) {
  const tela = Galleria.illustrazioni.titolo;
  const sfondo = $('sfondoMenu');
  if (tela && !sfondo.dataset.pronto) {
    sfondo.style.backgroundImage = 'url(' + tela.toDataURL('image/jpeg', 0.9) + ')';
    sfondo.dataset.pronto = '1';
  }
  $('btnContinua').classList.toggle('nascosto', !haSalvataggio);
  $('menu').classList.remove('nascosto');
};

Interfaccia.nascondiMenu = function () {
  $('menu').classList.add('nascosto');
  $('hud').classList.remove('nascosto');
};

Interfaccia.mostraOpzioni = function (si) {
  $('opzioni').classList.toggle('nascosto', !si);
};

Interfaccia.pausa = function (si) {
  $('pausa').classList.toggle('nascosto', !si);
  if (!si) this.mostraOpzioni(false);
};

/* ------------------------------------------------------------------------ */
/*  Pensieri di Lia (messaggi in basso)                                     */
/* ------------------------------------------------------------------------ */
Interfaccia.messaggio = function (testo, durata, urgente) {
  const m = { testo, durata: durata || 4 };
  if (urgente) { this.coda.unshift(m); this.tempoMessaggio = 0; } else this.coda.push(m);
};

Interfaccia.svuotaMessaggi = function () {
  this.coda.length = 0;
  this.tempoMessaggio = 0;
};

/* ------------------------------------------------------------------------ */
/*  Dialoghi                                                                */
/* ------------------------------------------------------------------------ */

/** Disegna il ritratto di un personaggio ritagliando la testa dal suo disegno. */
Interfaccia._ritratto = function (nomeAtlante) {
  const tela = $('ritratto');
  const c = tela.getContext('2d');
  c.clearRect(0, 0, tela.width, tela.height);
  if (!nomeAtlante) { tela.classList.add('nascosto'); return; }
  tela.classList.remove('nascosto');
  const at = Galleria.atlante(nomeAtlante);
  const f = at.fotogrammi.fronte_fermo_0 || at.fotogrammi[at.nomi[0]];
  const alt = f.a * 0.42;
  const lato = Math.min(f.l, alt);
  c.drawImage(at.tela, f.x + (f.l - lato) / 2, f.y + (alt - lato) * 0.5, lato, lato, 0, 0, tela.width, tela.height);
};

/**
 * Mostra un dialogo e aspetta che il giocatore lo legga tutto.
 *   chi: { nome, arte } oppure null (narratore)
 *   righe: elenco di frasi
 */
Interfaccia.dialogo = async function (chi, righe) {
  this.dialogoAperto = true;
  Input.azzera();
  // un pensiero ancora visibile si nasconde per non coprire il dialogo
  if (this.messaggioAttivo) {
    $('messaggio').classList.remove('visibile');
    this.messaggioAttivo = false;
    this.tempoMessaggio = 0.4;
  }
  $('dialogo').classList.remove('nascosto');
  $('nomeDialogo').textContent = chi ? chi.nome : '';
  $('nomeDialogo').classList.toggle('nascosto', !chi);
  this._ritratto(chi && chi.arte);
  for (const riga of righe) {
    await this._scrivi(riga);
  }
  $('dialogo').classList.add('nascosto');
  await pausaBreve(120);
  this.dialogoAperto = false;
};

/** Scrive una frase lettera per lettera; un tocco la completa, un altro va avanti. */
Interfaccia._scrivi = function (testo) {
  const el = $('testoDialogo');
  return new Promise((ok) => {
    let n = 0, finito = false;
    el.textContent = '';
    $('avantiDialogo').classList.add('nascosto');
    const passo = () => {
      if (finito) return;
      n += 1;
      el.textContent = testo.slice(0, n);
      if (n >= testo.length) { finito = true; $('avantiDialogo').classList.remove('nascosto'); return; }
      this._timerScrivi = setTimeout(passo, 22);
    };
    passo();
    this._avanzaDialogo = () => {
      if (!finito) {
        clearTimeout(this._timerScrivi);
        finito = true;
        el.textContent = testo;
        $('avantiDialogo').classList.remove('nascosto');
      } else {
        this._avanzaDialogo = null;
        Audio.clic();
        ok();
      }
    };
  });
};

Interfaccia.avanzaDialogo = function () {
  if (this._avanzaDialogo) this._avanzaDialogo();
};

/* ------------------------------------------------------------------------ */
/*  Capitoli, obiettivi, ricordi, pulsante azione                           */
/* ------------------------------------------------------------------------ */
Interfaccia.capitolo = async function (numero, titolo) {
  $('cartelloNumero').textContent = numero;
  $('cartelloTitolo').textContent = titolo;
  $('capitoloHud').textContent = numero + ' · ' + titolo;
  const c = $('cartello');
  c.classList.remove('nascosto');
  c.classList.add('visibile');
  await pausaBreve(3200);
  c.classList.remove('visibile');
  await pausaBreve(800);
  c.classList.add('nascosto');
};

Interfaccia.obiettivo = function (testo) {
  const el = $('obiettivo');
  el.textContent = testo || '';
  el.classList.toggle('nascosto', !testo);
  el.classList.remove('nuovo');
  void el.offsetWidth; // fa ripartire l'animazione
  if (testo) el.classList.add('nuovo');
};

/** Aggiunge l'icona di un ricordo (disegnata dall'immagine dell'oggetto). */
Interfaccia.ricordo = function (nomeArte, titolo) {
  this.ricordiPresi.push({ nomeArte, titolo });
  const at = Galleria.atlante(nomeArte);
  const f = at.fotogrammi[at.nomi[0]];
  const t = document.createElement('canvas');
  t.width = 64; t.height = 64;
  const s = Math.min(64 / f.l, 64 / f.a);
  t.getContext('2d').drawImage(at.tela, f.x, f.y, f.l, f.a, (64 - f.l * s) / 2, (64 - f.a * s) / 2, f.l * s, f.a * s);
  t.className = 'icona nuova';
  t.title = titolo;
  $('ricordi').appendChild(t);
  $('ricordi').classList.remove('nascosto');
};

/** Il contatore delle meraviglie scoperte (compare alla prima). */
Interfaccia.meraviglie = function (trovate, totale) {
  const el = $('meraviglieHud');
  if (!el) return;
  el.textContent = '✦ ' + trovate + ' / ' + totale;
  el.classList.remove('nascosto');
  el.classList.remove('nuova');
  void el.offsetWidth;   // fa ripartire l'animazione
  el.classList.add('nuova');
};

Interfaccia.azione = function (etichetta) {
  const b = $('btnAzione');
  if (etichetta) { b.textContent = etichetta; b.classList.remove('nascosto'); }
  else b.classList.add('nascosto');
};

Interfaccia.mostraToc = function (si, magico) {
  $('btnToc').classList.toggle('nascosto', !si);
  $('btnToc').classList.toggle('magico', !!magico);
};

/* ------------------------------------------------------------------------ */
/*  Aggiornamento continuo                                                  */
/* ------------------------------------------------------------------------ */
Interfaccia.aggiorna = function (dt) {
  const el = $('messaggio');
  if (this.messaggioAttivo) {
    this.tempoMessaggio -= dt;
    if (this.tempoMessaggio <= 0) {
      el.classList.remove('visibile');
      this.messaggioAttivo = false;
      this.tempoMessaggio = 0.5;
    }
  } else {
    this.tempoMessaggio -= dt;
    if (this.tempoMessaggio <= 0 && this.coda.length && !this.dialogoAperto) {
      const m = this.coda.shift();
      el.textContent = m.testo;
      el.classList.add('visibile');
      this.messaggioAttivo = true;
      this.tempoMessaggio = m.durata;
    }
  }
};

/* ------------------------------------------------------------------------ */
/*  Finale                                                                  */
/* ------------------------------------------------------------------------ */
Interfaccia.fine = function (testo) {
  $('hud').classList.add('nascosto');
  const tela = Galleria.illustrazioni.finale;
  if (tela) $('illustrazioneFine').style.backgroundImage = 'url(' + tela.toDataURL('image/jpeg', 0.9) + ')';
  $('testoFine').textContent = testo;
  $('fine').classList.remove('nascosto');
};
