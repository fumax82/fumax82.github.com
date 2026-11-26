/* ==========================================================================
 *  dipinti_a_mano.js — I DISEGNI FATTI A MANO (facoltativi)
 *  --------------------------------------------------------------------------
 *  Tutti i disegni del gioco sono dipinti dal codice. Ma qualunque disegno
 *  (un fondale, un personaggio, un oggetto) può essere SOSTITUITO da
 *  un'immagine dipinta a mano, da te o da un illustratore: è il modo per
 *  avere la stessa qualità di un cartone animato vero.
 *
 *  COME SI FA
 *    1. Apri il gioco nel browser del computer, entra nella scena e apri la
 *       console (F12). Scrivi:
 *          esportaDisegni()            → scarica i fondali della scena attuale
 *          esportaDisegni('atlanti')   → scarica personaggi e oggetti
 *       Ogni file PNG ha la misura e la disposizione giuste: è la "traccia".
 *    2. Dipingi sopra la traccia (acquerello scansionato, tavoletta grafica...)
 *       mantenendo le stesse misure e la trasparenza dove non c'è niente.
 *       Per i personaggi ogni riquadro è un fotogramma dell'animazione.
 *    3. Salva il file in  www/img/dipinti/  e scrivi il suo nome in
 *       www/img/dipinti/elenco.json, per esempio:
 *          { "strati":  { "via/facciate_1": "via_facciate_1.png" },
 *            "atlanti": { "gogo": "gogo.png" } }
 *    Al prossimo avvio il gioco usa il tuo dipinto al posto di quello del codice.
 *
 *  Attenzione: usa solo disegni tuoi o di cui hai il permesso (non i
 *  fotogrammi del film: appartengono ai loro autori).
 * ========================================================================== */

let ELENCO = null;

/** Legge (una volta sola) l'elenco dei dipinti fatti a mano. */
async function elenco() {
  if (ELENCO) return ELENCO;
  try {
    const r = await fetch('img/dipinti/elenco.json', { cache: 'no-cache' });
    ELENCO = r.ok ? await r.json() : {};
  } catch (e) {
    ELENCO = {};
  }
  ELENCO.strati = ELENCO.strati || {};
  ELENCO.atlanti = ELENCO.atlanti || {};
  return ELENCO;
}

function carica(file) {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => { console.warn('Dipinto a mano non trovato:', file); ok(null); };
    im.src = 'img/dipinti/' + file;
  });
}

/** Mette l'immagine "file" al posto del contenuto della tela (stessa misura). */
async function sostituisci(tela, file) {
  const im = await carica(file);
  if (!im) return false;
  const c = tela.getContext('2d');
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, tela.width, tela.height);
  c.drawImage(im, 0, 0, tela.width, tela.height);
  c.restore();
  return true;
}

/** Fondali: la chiave è "nomeScena/nomeStrato" (per esempio "via/facciate_1"). */
export async function stratiAMano(nomeScena, strati) {
  const E = await elenco();
  for (const d of strati) {
    const file = d && d.nome && E.strati[nomeScena + '/' + d.nome];
    // un dipinto vero non ha bisogno della "finitura" ad acquerello
    if (file && d.tela && await sostituisci(d.tela, file)) d.finitura = false;
  }
}

/** Personaggi e oggetti: la chiave è il nome dell'atlante (per esempio "gogo"). */
export async function atlantiAMano(insieme) {
  const E = await elenco();
  for (const [nome, at] of Object.entries(insieme || {})) {
    const file = E.atlanti[nome];
    if (at && at.aMano) continue;
    if (file && at && at.tela && await sostituisci(at.tela, file)) at.aMano = true;
  }
  return insieme;
}

/** Scarica una tela come PNG (per fare la "traccia" da ridipingere). */
export function esporta(tela, nome) {
  const a = document.createElement('a');
  a.download = nome + '.png';
  a.href = tela.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  a.remove();
}
