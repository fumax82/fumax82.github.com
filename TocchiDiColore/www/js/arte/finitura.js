/* ==========================================================================
 *  finitura.js — L'ULTIMA MANO DI ACQUERELLO SUI FONDALI
 *  --------------------------------------------------------------------------
 *  I fondali del cortometraggio sono acquerelli veri: il colore non è mai
 *  uniforme, ai bordi di ogni macchia il pigmento si accumula (un orlo più
 *  scuro, come quando l'acqua asciuga), i contorni sono morbidi e la carta
 *  si vede sotto il colore. I nostri fondali sono dipinti dal codice con
 *  forme precise: questa "finitura" li ripassa tutti allo stesso modo,
 *  usando solo le operazioni di fusione della tela (veloci, fatte dalla
 *  scheda grafica):
 *
 *    1. ORLI BAGNATI   dove il colore cambia, il pigmento si accumula
 *    2. SPANDIMENTO    il colore si spande appena (niente bordi "vettoriali")
 *    3. STESURA        velature larghe e irregolari, un po' calde un po' fredde
 *    4. CARTA          la grana della carta trattiene il pigmento
 *
 *  Le parti trasparenti del disegno restano trasparenti (alla fine si
 *  "ritaglia" con la forma originale).
 *
 *  Uso: finitura(tela, { forza: 1, pxm: 84 })   (pxm = pixel per metro)
 * ========================================================================== */
import { nuovaTela } from './pennello.js';

// tele di appoggio riutilizzate (per non riempire la memoria del telefono)
let A = null, B = null;
function appoggio(t, l, a) {
  if (!t) t = nuovaTela(l, a);
  if (t.width !== l || t.height !== a) { t.width = l; t.height = a; }
  const c = t.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.filter = 'none';
  c.clearRect(0, 0, l, a);
  return t;
}

/* Macchie morbide e grandi (le velature irregolari): si dipingono una volta sola. */
let MACCHIE = null, GRANA = null;
function trame() {
  if (MACCHIE) return;
  // macchie: tanti cerchi sfumati, chiari e scuri
  MACCHIE = nuovaTela(256, 256);
  const m = MACCHIE.getContext('2d');
  m.fillStyle = '#808080';
  m.fillRect(0, 0, 256, 256);
  let seme = 7;
  const rnd = () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; };
  for (let k = 0; k < 70; k++) {
    const x = rnd() * 256, y = rnd() * 256, r = 18 + rnd() * 60, v = rnd() < 0.5 ? 0 : 255;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {   // ripetibile senza cuciture
      const g = m.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.16)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      m.fillStyle = g;
      m.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
  // grana: puntini finissimi, più fitti in certe zone
  GRANA = nuovaTela(128, 128);
  const g = GRANA.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let k = 0; k < 128 * 128; k++) {
    const v = 255 - Math.floor(Math.pow(rnd(), 3) * 90);
    img.data[k * 4] = img.data[k * 4 + 1] = img.data[k * 4 + 2] = v;
    img.data[k * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

/**
 * Ripassa la tela con l'ultima mano di acquerello.
 * opz: { forza (0..1.5), pxm (pixel per metro, per adattare le misure), seme }
 */
export function finitura(tela, opz) {
  const o = opz || {};
  const W = tela.width, H = tela.height;
  if (!tela.getContext || W < 16 || H < 16) return tela;
  const c = tela.getContext('2d');
  if (!('filter' in c)) return tela;          // browser senza filtri: si lascia com'è
  trame();
  const forza = o.forza === undefined ? 1 : o.forza;
  const pxm = o.pxm || 84;
  // misure in pixel ricavate dai metri (così ogni strato riceve lo stesso trattamento)
  const rOrlo = Math.max(1.5, pxm * 0.045);     // ~4,5 cm: lo spessore dell'orlo bagnato
  const rSpande = Math.max(0.6, pxm * 0.009);   // ~1 cm: quanto si spande il colore

  // i pittori lasciano sulla tela la loro trasformazione (metri → pixel):
  // qui lavoriamo in pixel, quindi la azzeriamo e alla fine la rimettiamo
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.filter = 'none';

  // 0. una copia del disegno com'è (servirà come "forma" per ritagliare)
  A = appoggio(A, W, H);
  const a = A.getContext('2d');
  a.drawImage(tela, 0, 0);

  // 1. ORLI BAGNATI: |disegno - disegno sfocato| è chiaro dove il colore cambia.
  //    Lo invertiamo (bianco = nessun orlo) e lo moltiplichiamo sul disegno.
  B = appoggio(B, W, H);
  const b = B.getContext('2d');
  b.fillStyle = '#ffffff';
  b.fillRect(0, 0, W, H);
  b.filter = `blur(${rOrlo.toFixed(1)}px)`;
  b.drawImage(A, 0, 0);
  b.filter = 'none';
  b.globalCompositeOperation = 'difference';
  b.drawImage(A, 0, 0);
  // ora B = differenza (scuro = uguale, chiaro = bordo): la rendiamo grigia,
  // la invertiamo (bianco = nessun orlo) e la moltiplichiamo due volte
  // (l'acqua che asciuga lascia una riga piena, più scura della macchia)
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.filter = 'grayscale(1) invert(1)';
  c.globalAlpha = Math.min(1, 0.75 * forza);
  c.drawImage(B, 0, 0);
  c.globalAlpha = Math.min(1, 0.45 * forza);
  c.drawImage(B, 0, 0);
  c.restore();

  // 2. SPANDIMENTO: una copia appena sfocata sopra, poco visibile
  c.save();
  c.filter = `blur(${rSpande.toFixed(1)}px)`;
  c.globalAlpha = 0.42 * forza;
  c.drawImage(A, 0, 0);
  c.restore();

  // 3. STESURA IRREGOLARE: macchie grandi (circa 1,5 m) chiare e scure
  const passo = Math.max(96, pxm * 2.6);
  const ox = ((o.seme || 0) * 37) % passo;
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = 0.42 * forza;
  for (let y = -ox; y < H; y += passo) {
    for (let x = -ox; x < W; x += passo) c.drawImage(MACCHIE, x, y, passo + 1, passo + 1);
  }
  // un velo caldo in alto e fresco in basso (la luce del film)
  c.globalCompositeOperation = 'soft-light';
  c.globalAlpha = 0.18 * forza;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffd9a8');
  g.addColorStop(1, '#a8c0e0');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.restore();

  // 4. CARTA: la grana trattiene un po' di pigmento
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = 0.09 * forza;
  const motivo = c.createPattern(GRANA, 'repeat');
  c.fillStyle = motivo;
  c.fillRect(0, 0, W, H);
  c.restore();

  // 5. si ritaglia con la forma originale: le parti trasparenti restano tali
  c.save();
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(A, 0, 0);
  c.restore();
  c.restore();     // la trasformazione del pittore torna com'era
  return tela;
}

/** Libera le tele di appoggio (dopo aver dipinto una scena intera). */
export function liberaFinitura() {
  if (A) { A.width = A.height = 1; }
  if (B) { B.width = B.height = 1; }
}
