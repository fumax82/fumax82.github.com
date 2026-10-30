/*
 * ocr.js - Lettura del testo dalle foto degli scontrini, TUTTO sul telefono.
 *
 * Usa Tesseract (cartella vendor/tesseract) con il modello di lingua italiana.
 * Nessuna foto viene inviata su Internet.
 *
 * Passi:
 *  1. prepareImage(): ridimensiona la foto e la rende in bianco e nero ad
 *     alto contrasto (l'OCR legge meglio).
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

  /**
   * Ridimensiona (lato lungo max "maxSide") e, se "forOcr", converte in scala di
   * grigi con contrasto aumentato. Restituisce un data URL JPEG.
   */
  async function prepareImage(src, maxSide, forOcr) {
    const img = typeof src === 'string' ? await loadImage(src) : src;
    const w0 = img.naturalWidth || img.videoWidth || img.width, h0 = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w0 * scale);
    canvas.height = Math.round(h0 * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (forOcr) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const p = data.data;
      // Scala di grigi + "stiramento" del contrasto tra l'1% più scuro e l'1% più chiaro.
      // (Percentili bassi: su uno scontrino con poco testo l'inchiostro è una piccola parte dei pixel.)
      const hist = new Uint32Array(256);
      for (let i = 0; i < p.length; i += 4) {
        const g = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) | 0;
        p[i] = g;
        hist[g]++;
      }
      const total = p.length / 4;
      let lo = 0, hi = 255, acc = 0;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.01) { lo = v; break; } }
      acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.01) { hi = v; break; } }
      if (hi - lo < 64) { lo = 0; hi = 255; } // immagine quasi uniforme: niente stiramento
      const range = hi - lo;
      for (let i = 0; i < p.length; i += 4) {
        const v = Math.max(0, Math.min(255, ((p[i] - lo) * 255) / range));
        p[i] = p[i + 1] = p[i + 2] = v;
      }
      ctx.putImageData(data, 0, 0);
    }
    return canvas.toDataURL('image/jpeg', forOcr ? 0.92 : 0.72);
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
  async function recognize(photos, onProgress) {
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
      const prepared = await prepareImage(photos[current], 2200, true);
      const result = await worker.recognize(prepared);
      texts.push(result.data.text);
    }
    if (onProgress) onProgress(100, 'Lettura completata');
    return texts;
  }

  root.OCR = { recognize, prepareImage, fileToDataUrl, loadImage };
})(window);
