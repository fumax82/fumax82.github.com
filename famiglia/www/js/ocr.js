/*
 * ocr.js - Lettura del testo dalle foto degli scontrini, TUTTO sul telefono.
 *
 * Usa Tesseract (cartella vendor/tesseract) con il modello di lingua italiana.
 * Nessuna foto viene inviata su Internet.
 *
 * Passi:
 *  1. prepareForOcr(): ritaglia il foglio, lo ingrandisce, corregge le ombre
 *     e aumenta il contrasto (l'OCR legge molto meglio).
 *  2. recognize(): estrae il testo da una o più foto, mostrando l'avanzamento.
 */
(function (root) {
  'use strict';

  const BASE = 'vendor/tesseract/';
  let workerPromise = null;

  /** Crea (una volta sola) il "lettore" Tesseract in italiano. */
  function getWorker(onProgress) {
    if (!workerPromise) {
      workerPromise = root.Tesseract.createWorker('ita', 1, {   // 1 = motore LSTM (più preciso)
        workerPath: BASE + 'worker.min.js',
        corePath: BASE + 'core/',
        langPath: BASE + 'lang',
        gzip: true,
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: m => onProgress && onProgress(m)
      }).then(async w => {
        // Ogni riga dello scontrino è un blocco di testo uniforme
        await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        return w;
      });
      workerPromise.catch(() => { workerPromise = null; });
    }
    return workerPromise;
  }

  /** Carica un'immagine da un indirizzo (data URL, blob URL...). */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Immagine non leggibile'));
      img.src = src;
    });
  }

  /** Ridimensiona (lato lungo max "maxSide") e restituisce un JPEG (per miniature e archivio). */
  async function prepareImage(src, maxSide) {
    const img = typeof src === 'string' ? await loadImage(src) : src;
    const w0 = img.naturalWidth || img.videoWidth || img.width, h0 = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  }

  /** Soglia di Otsu: il grigio che separa meglio "chiaro" (carta) e "scuro" (sfondo/inchiostro). */
  function otsu(hist, total) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, best = 0, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; threshold = t; }
    }
    return threshold;
  }

  /** Sequenza più lunga di valori "true" in un array: [inizio, fine]. */
  function longestRun(flags) {
    let best = [0, -1], start = -1;
    for (let i = 0; i <= flags.length; i++) {
      if (i < flags.length && flags[i]) { if (start < 0) start = i; }
      else if (start >= 0) { if (i - 1 - start > best[1] - best[0]) best = [start, i - 1]; start = -1; }
    }
    return best;
  }

  /**
   * Trova il foglio dello scontrino nella foto (zona chiara più grande) per
   * ritagliare via il tavolo o lo sfondo. Restituisce {x, y, w, h} in pixel originali.
   */
  function findPaper(img, w0, h0) {
    const W = 300, H = Math.max(1, Math.round(h0 * W / w0));
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const gray = new Uint8Array(W * H), hist = new Uint32Array(256);
    for (let i = 0; i < W * H; i++) {
      const g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
      gray[i] = g; hist[g]++;
    }
    const t = otsu(hist, W * H);
    const cols = [];
    for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y++) if (gray[y * W + x] > t) n++; cols.push(n / H > 0.45); }
    const [x0, x1] = longestRun(cols);
    const rows = [];
    for (let y = 0; y < H; y++) { let n = 0; for (let x = x0; x <= x1; x++) if (gray[y * W + x] > t) n++; rows.push(n / Math.max(1, x1 - x0 + 1) > 0.5); }
    const [y0, y1] = longestRun(rows);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    // Se il "foglio" trovato è troppo piccolo, usiamo tutta la foto
    if (bw < W * 0.12 || bh < H * 0.2) return { x: 0, y: 0, w: w0, h: h0 };
    const k = w0 / W, padX = bw * 0.03, padY = bh * 0.01;
    const x = Math.max(0, (x0 - padX) * k), y = Math.max(0, (y0 - padY) * k);
    return { x, y, w: Math.min(w0 - x, (bw + 2 * padX) * k), h: Math.min(h0 - y, (bh + 2 * padY) * k) };
  }

  /**
   * Prepara la foto per l'OCR:
   *  1. ritaglia il foglio dello scontrino (via lo sfondo)
   *  2. lo porta a una larghezza fissa (testo abbastanza grande da leggere)
   *  3. (facoltativo) corregge ombre e luce non uniforme
   *  4. aumenta il contrasto e converte in bianco e nero, eliminando le filigrane chiare
   */
  async function prepareForOcr(src, opts) {
    const o = Object.assign({ width: 1500, maxPixels: 12e6, crop: true, flatten: false, binarize: 0.85 }, opts);
    const img = typeof src === 'string' ? await loadImage(src) : src;
    const w0 = img.naturalWidth || img.videoWidth || img.width, h0 = img.naturalHeight || img.videoHeight || img.height;
    const box = o.crop ? findPaper(img, w0, h0) : { x: 0, y: 0, w: w0, h: h0 };
    let scale = o.width / box.w;
    if (box.w * scale * box.h * scale > o.maxPixels) scale = Math.sqrt(o.maxPixels / (box.w * box.h));
    const W = Math.round(box.w * scale), H = Math.round(box.h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H), p = data.data;
    let bg = null;
    if (o.flatten) {
      // Sfondo stimato: immagine rimpicciolita (le lettere spariscono) e riallargata
      const sw = Math.max(1, Math.round(W / 40)), sh = Math.max(1, Math.round(H / 40));
      const small = document.createElement('canvas');
      small.width = sw; small.height = sh;
      small.getContext('2d').drawImage(canvas, 0, 0, sw, sh);
      const big = document.createElement('canvas');
      big.width = W; big.height = H;
      const bctx = big.getContext('2d');
      bctx.imageSmoothingEnabled = true;
      bctx.drawImage(small, 0, 0, W, H);
      bg = bctx.getImageData(0, 0, W, H).data;
    }
    const hist = new Uint32Array(256);
    for (let i = 0; i < p.length; i += 4) {
      let g = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
      if (bg) {
        const b = Math.max(1, bg[i] * 0.299 + bg[i + 1] * 0.587 + bg[i + 2] * 0.114);
        g = Math.min(255, (g / b) * 235);
      }
      p[i] = g | 0;
      hist[p[i]]++;
    }
    // Contrasto: dal 1% più scuro al 1% più chiaro (con protezione per immagini uniformi)
    const total = p.length / 4;
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi = v; break; } }
    if (hi - lo < 64) { lo = 0; hi = 255; }
    const h2 = new Uint32Array(256);
    for (let i = 0; i < p.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((p[i] - lo) * 255) / (hi - lo))) | 0;
      p[i] = p[i + 1] = p[i + 2] = v;
      h2[v]++;
    }
    // Bianco e nero: tiene solo l'inchiostro scuro ed elimina loghi e filigrane chiare
    // stampate sul retro della carta. La soglia è quella di Otsu un po' abbassata.
    if (o.binarize) {
      const t = otsu(h2, total) * o.binarize;
      for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = p[i] < t ? 0 : 255;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /** Legge un File scelto dalla galleria come data URL. */
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  /**
   * Riconosce il testo di più foto in sequenza.
   * onProgress(percentuale 0-100, messaggio)
   * Restituisce un array di testi (uno per foto).
   */
  async function recognize(photos, onProgress, options) {
    const texts = [];
    let current = 0;
    const report = m => {
      if (!onProgress) return;
      if (m.status === 'recognizing text') {
        onProgress(Math.round(((current + m.progress) / photos.length) * 100), 'Lettura foto ' + (current + 1) + ' di ' + photos.length);
      } else {
        onProgress(0, 'Preparazione del lettore (solo la prima volta)…');
      }
    };
    const worker = await getWorker(report);
    for (current = 0; current < photos.length; current++) {
      const prepared = await prepareForOcr(photos[current], options);
      const result = await worker.recognize(prepared);
      texts.push(result.data.text);
    }
    if (onProgress) onProgress(100, 'Lettura completata');
    return texts;
  }

  /**
   * Legge uno scontrino (una o più foto) in modo "intelligente":
   * prova prima le impostazioni migliori; se la somma dei prodotti non torna
   * con il totale, riprova con altre dimensioni e tiene la lettura migliore.
   * Restituisce { text, parsed, pass }.
   */
  const PASSES = [{ width: 1100, binarize: 1 }, { width: 1300, binarize: 0.95 }, { width: 1700, binarize: 1 }];

  /** Punteggio di una lettura: totale coerente prima di tutto, poi numero di prodotti. */
  function score(p) {
    return (p.check === 'ok' ? 1000 : 0) + p.items.length * 10 - Math.min(500, Math.abs(p.total - p.itemsTotal) / 10);
  }

  /** Ordini da provare per n foto: tutti fino a 4 foto, altrimenti quello di scatto. */
  function orders(n) {
    const base = [...Array(n).keys()];
    if (n > 4) return [base];
    const out = [];
    const permute = (arr, rest) => {
      if (!rest.length) { out.push(arr); return; }
      rest.forEach((x, i) => permute(arr.concat(x), rest.slice(0, i).concat(rest.slice(i + 1))));
    };
    permute([], base);
    return out;
  }

  async function readReceipt(photos, onProgress) {
    let best = null;
    for (let i = 0; i < PASSES.length; i++) {
      const label = i === 0 ? '' : ' (tentativo ' + (i + 1) + ': controllo dei prezzi)';
      const texts = await recognize(photos, (p, msg) => onProgress && onProgress(p, msg + label), PASSES[i]);
      // Le foto possono essere state scattate in qualsiasi ordine: proviamo gli
      // ordini possibili (solo la lettura del testo, l'OCR non si ripete)
      let candidate = null;
      for (const order of orders(texts.length)) {
        const text = root.Receipts.mergeTexts(order.map(k => texts[k]));
        const parsed = root.Receipts.parseText(text);
        if (!candidate || score(parsed) > score(candidate.parsed)) candidate = { text, parsed, pass: i + 1, order };
      }
      const parsed = candidate.parsed;
      if (!best || score(parsed) > score(best.parsed)) best = candidate;
      if (parsed.check === 'ok' && parsed.items.length) break;
    }
    return best;
  }

  root.OCR = { recognize, readReceipt, prepareImage, prepareForOcr, fileToDataUrl, loadImage, getWorker };
})(window);
