/* ==========================================================================
 *  interfaccia.js — TUTTO CIÒ CHE STA SOPRA IL GIOCO (HTML)
 *  --------------------------------------------------------------------------
 *  Il gioco è per una bimba di 2 anni: durante il gioco non c'è NIENTE da
 *  leggere (niente dialoghi, obiettivi o cartelli). Qui restano solo le
 *  cose per i grandi: caricamento, menu, opzioni, pausa, crediti; e il
 *  cerchietto che compare sotto il ditino a ogni tocco. Il finale è
 *  un'illustrazione con un grande pulsante "ancora!".
 * ========================================================================== */
import { Galleria } from '../arte/galleria.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);

export const Interfaccia = {
  tocco: 'bastone',      // che segno compare sotto il dito ('bastone' o 'magico')
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
  $('btnFineMenu').onclick = () => { Audio.clic(); azioni.nuovaPartita(); $('fine').classList.add('nascosto'); };
  // il pulsante della pausa (piccolo, in alto: è per i grandi)
  $('btnPausa').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Input.emetti('pausa'); });

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

/**
 * Il bastone (o la bacchetta) si usa toccando lo schermo dove si vuole
 * "vedere": qui ricordiamo solo se si può usare e se è magico (cambia il
 * segno che compare sotto il dito e il puntatore del mouse).
 */
Interfaccia.mostraToc = function (si, magico) {
  this.tocco = magico ? 'magico' : 'bastone';
  document.body.classList.toggle('magica', !!si && !!magico);
};

/** Un cerchietto che si allarga sotto il dito: "ho sentito il tuo tocco". */
Interfaccia.segnoTocco = function (x, y) {
  const d = document.createElement('div');
  d.className = 'segnoTocco ' + this.tocco;
  d.style.left = x + 'px';
  d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 700);
};

/* ------------------------------------------------------------------------ */
/*  Finale                                                                  */
/* ------------------------------------------------------------------------ */
Interfaccia.fine = function () {
  $('hud').classList.add('nascosto');
  const tela = Galleria.illustrazioni.finale;
  if (tela) $('illustrazioneFine').style.backgroundImage = 'url(' + tela.toDataURL('image/jpeg', 0.9) + ')';
  $('fine').classList.remove('nascosto');
};
