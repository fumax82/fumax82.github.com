/*
 * receipts.js - Lettura degli SCONTRINI e analisi della spesa.
 *
 * 1. parseText(): dal testo letto con l'OCR ricava negozio, data, totale e
 *    le righe di prodotto (nome, quantità, prezzo).
 * 2. productCategory(): assegna un reparto al prodotto (frutta, latticini...).
 * 3. analyze(): numeri per grafici e filtri (reparti, prodotti più comprati,
 *    andamento dei prezzi, scontrino medio per negozio).
 *
 * L'OCR non è perfetto: per questo dopo la lettura puoi correggere tutto
 * prima di salvare.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  // Reparti e parole chiave (testo in minuscolo, senza accenti)
  const DEPARTMENTS = [
    ['Frutta', ['mele', 'pera ', 'pere ', 'kaki', 'mela', 'banan', 'arance', 'arancia', 'pere ', 'kiwi', 'uva', 'limon', 'fragol', 'frutta', 'ananas', 'pesche', 'albicocc', 'mandarin', 'clementin', 'melone', 'anguria', 'mirtill', 'avocado']],
    ['Verdura', ['insalata', 'pomodor', 'zucchin', 'patat', 'carot', 'cipoll', 'verdur', 'spinaci', 'finocch', 'peperon', 'melanzan', 'lattuga', 'rucola', 'broccol', 'cavol', 'funghi', 'aglio', 'basilico', 'sedano', 'cetriol', 'legumi fres']],
    ['Carne', ['pollo', 'petto', 'manzo', 'maiale', 'bovino', 'tacchin', 'salsicc', 'macinato bov', 'macinato mist', 'macinato di', 'hamburger', 'bistecc', 'vitello', 'arrosto', 'cotolett', 'wurstel', 'spiedin', 'agnello', 'carne']],
    ['Pesce', ['salmone', 'merluzz', 'gamber', 'pesce', 'orata', 'branzino', 'cozze', 'vongole', 'calamar', 'polpo', 'baccala', 'sgombro', 'alici', 'acciughe']],
    ['Salumi', ['prosciutto', 'crudo', 'cotto', 'salame', 'mortadell', 'bresaola', 'speck', 'pancetta', 'coppa']],
    ['Latte e formaggi', ['latte', 'yogurt', 'yogh', 'yog ', 'feta', 'brie', 'asiago', 'montasio', 'skyr', 'formagg', 'mozzarell', 'parmigian', 'grana', 'burro', 'ricotta', 'panna', 'stracchino', 'gorgonzola', 'mascarpone', 'emmental', 'provola', 'scamorza', 'kefir', 'fontina', 'pecorino']],
    ['Uova', ['uova', 'uovo']],
    ['Pane e forno', ['pane', 'gris ', 'taralli', 'friselle', 'piadin', 'schiacciat', 'focacc', 'cracker', 'grissin', 'fette biscott', 'piadina', 'pizza', 'panini', 'brioche', 'cornett', 'tramezz']],
    ['Pasta, riso e farine', ['pasta', 'spaghett', 'penne', 'riso', 'fusilli', 'farina', 'rigaton', 'tagliatell', 'lasagne', 'gnocchi', 'ravioli', 'tortellin', 'cous cous', 'orzo', 'farro']],
    ['Dispensa', ['olio', 'aceto', 'sale ', 'zucchero', 'passata', 'pelati', 'polpa', 'ceci', 'fagioli', 'lenticch', 'caffe', 'tonno', 'sugo', 'pesto', 'maionese', 'ketchup', 'marmellat', 'miele', 'cereali', 'muesli', 'spezie', 'brodo', 'dado', 'legumi', 'conserv', 'the ', 'te ', 'camomilla', 'tisana']],
    ['Dolci e snack', ['biscott', 'cioccolat', 'merendin', 'patatin', 'snack', 'gelat', 'torta', 'nutella', 'caramell', 'wafer', 'crostatin', 'chips', 'pop corn', 'dolci', 'barrett', 'pandoro', 'panettone', 'colomba']],
    ['Bevande', ['acqua', 'succo', 'spremut', 'nettare', 'kombucha', 'coca', 'aranciata', 'bibita', 'the fredd', 'te fredd', 'estathe', 'chinotto', 'gassosa', 'energy', 'red bull', 'sprite', 'fanta', 'pepsi', 'lemon soda']],
    ['Alcolici', ['vino', 'birra', 'moretti', 'peroni', 'heineken', 'menabrea', 'ichnusa', 'nastro azzurro', 'tennent', 'corona', 'beck', 'prosecco doc', 'spritz', 'prosecco', 'spumante', 'liquor', 'gin ', 'vodka', 'whisky', 'rum ', 'amaro', 'aperol', 'campari', 'lambrusco', 'chianti']],
    ['Surgelati', ['surgel', 'findus', 'bastoncin', 'frozen', 'gelo ', 'sofficin', '4 salti']],
    ['Casa e pulizia', ['detersiv', 'ammorbid', 'carta igien', 'scottex', 'tovagliol', 'sgrassat', 'candeggin', 'spugn', 'sacchett', 'pellicol', 'alluminio', 'piatti', 'bicchieri', 'lavastovigl', 'pastiglie', 'anticalcare', 'deodorante amb', 'scopa', 'carta cucina', 'fazzolett']],
    ['Igiene personale', ['shampoo', 'bagnoschiuma', 'dentifric', 'sapone', 'deodorant', 'assorbent', 'rasoi', 'cotton', 'balsamo', 'spazzolin', 'crema', 'docciaschiuma', 'collutorio', 'salviett']],
    ['Bambini', ['pannolin', 'omogeneizz', 'biberon', 'baby', 'plasmon', 'mellin']],
    ['Animali', ['crocchett', 'cane', 'gatto', 'lettiera', 'pet ', 'whiskas', 'friskies', 'purina']]
  ];

  /**
   * Reparto di un prodotto in base al nome. Vince la parola che compare PRIMA
   * nel nome: in "SUCCO ARANCIA" conta "succo" (bevanda), non "arancia" (frutta).
   */
  function productCategory(name) {
    const n = ' ' + U.norm(name).replace(/[^a-z0-9]+/g, ' ') + ' ';
    let best = null, bestPos = Infinity;
    for (const [dep, words] of DEPARTMENTS) {
      for (const w of words) {
        const pos = n.indexOf(w);
        if (pos >= 0 && pos < bestPos) { bestPos = pos; best = dep; }
      }
    }
    return best || 'Altro';
  }

  // ---------------------------------------------------------------------
  // Riconoscimento del negozio
  // ---------------------------------------------------------------------

  /** Insegne conosciute: chiave senza accenti/spazi -> nome da mostrare. */
  const SHOPS = {
    naturasi: 'NaturaSì', cadoro: 'Cadoro', esselunga: 'Esselunga', conad: 'Conad', coop: 'Coop', ipercoop: 'Ipercoop',
    lidl: 'Lidl', aldi: 'Aldi', eurospin: 'Eurospin', penny: 'Penny', carrefour: 'Carrefour', despar: 'Despar',
    interspar: 'Interspar', eurospar: 'Eurospar', spar: 'Spar', famila: 'Famila', ali: 'Alì', alisupermercati: 'Alì',
    aliper: 'Alìper', iper: 'Iper', pam: 'Pam', panorama: 'Panorama', tigre: 'Tigre', crai: 'Crai', sigma: 'Sigma',
    bennet: 'Bennet', unes: 'Unes', tosano: 'Tosano', prix: 'Prix', todis: 'Todis', emisfero: 'Emisfero', visotto: 'Visotto',
    basko: 'Basko', iperal: 'Iperal', gigante: 'Il Gigante', deco: 'Decò', tuodi: 'Tuodì',
    eataly: 'Eataly', tigota: 'Tigotà', acquaesapone: 'Acqua & Sapone', decathlon: 'Decathlon', ikea: 'Ikea',
    leroymerlin: 'Leroy Merlin', mediaworld: 'MediaWorld', unieuro: 'Unieuro', euronics: 'Euronics', ovs: 'OVS',
    zara: 'Zara', primark: 'Primark', mcdonalds: "McDonald's", autogrill: 'Autogrill', farmacia: 'Farmacia'
  };

  /** Distanza di modifica (quante lettere cambiare per passare da a a b). */
  function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return d[a.length][b.length];
  }

  /** Cerca un'insegna conosciuta in una parola, tollerando errori di lettura ("natfurasi"). */
  function knownShop(word) {
    const w = U.norm(word).replace(/[^a-z]/g, '');
    if (w.length < 3) return '';
    if (SHOPS[w]) return SHOPS[w];
    if (w.length < 5) return '';
    for (const k in SHOPS) {
      if (k.length < 5) continue;
      // Errori ammessi: 1 lettera (2 per nomi lunghi), lunghezza quasi uguale
      const tolerance = k.length >= 9 ? 2 : 1;
      if (Math.abs(k.length - w.length) <= 1 && editDistance(k, w) <= tolerance) return SHOPS[k];
    }
    return '';
  }

  /**
   * Nome del negozio, in ordine di affidabilità:
   *  1. insegna conosciuta nelle prime righe (anche con piccoli errori di lettura)
   *  2. sito internet stampato sullo scontrino (es. www.cadoro.it -> Cadoro)
   *  3. insegna conosciuta in qualsiasi riga
   *  4. prima riga "sensata" in alto (non indirizzo, non partita IVA...)
   */
  function findShop(lines) {
    const scan = list => {
      for (const l of list) {
        const words = l.split(/[\s.,*'’-]+/);
        for (let i = 0; i < words.length; i++) {
          const one = knownShop(words[i]);
          if (one) return one;
          if (i + 1 < words.length) { const two = knownShop(words[i] + words[i + 1]); if (two) return two; }
        }
      }
      return '';
    };
    const top = scan(lines.slice(0, 10));
    if (top) return top;
    for (const l of lines) {
      const m = U.norm(l).replace(/\s/g, '').match(/www[.,]?([a-z0-9-]{3,})[.,](it|com|eu|net)/);
      if (m) return knownShop(m[1]) || m[1].charAt(0).toUpperCase() + m[1].slice(1);
    }
    const any = scan(lines);
    if (any) return any;
    const first = lines.slice(0, 6).find(l => /[a-z]{4,}/i.test(l) && !SKIP.test(U.norm(l)) && !HEADER.test(U.norm(l)) && !LEGAL.test(U.norm(l)));
    return first ? first.replace(/[^\w\sàèéìòù'&.-]/gi, '').trim().slice(0, 40) : '';
  }

  // ---------------------------------------------------------------------
  // Righe dello scontrino
  // ---------------------------------------------------------------------

  // Righe che NON sono prodotti
  const SKIP = /(^|\s)(totale|subtotale|sub totale|tot\.|iva|imponibile|contante|contanti|resto|pagamento|pagato|carta|bancomat|elettronico|documento|commerciale|scontrino|p\.?\s?iva|partita|c\.f\.|cod\.? fisc|tel\.?|telefono|via |viale|piazza|corso |cassa|cassiere|operatore|transazione|autorizz|grazie|arrivederci|www\.|http|num\.|n\. doc|rt |matricola|euro$|importo|punti|saldo punti|fidelity|carta fedelta|esercente|acquirer|stan|terminale|aid|pan |chip|contactless|rif\.|non riscosso|articoli|arrotondamento|tessera|descrizione|prezzo)/;
  // Intestazione della tabella prodotti: i prodotti iniziano DOPO queste righe
  const HEADER = /(descrizione|documento commerciale|di vendita o prest|vendita o prestazione)/;
  // Fine della tabella prodotti
  const BODY_END = /^(sub ?totale|totale|tot\b|articoli\b|n\.? ?articoli|pezzi\b|di cui iva|pagamento|importo pagato|[-=_ ]*info tessera)|info tessera/;
  // Righe societarie (ragione sociale, indirizzo)
  const LEGAL = /(s\.?r\.?l|s\.?p\.?a|s\.?n\.?c|s\.?a\.?s|socio unico|cap\. soc|rea |p\.? ?iva|via |viale |piazza |corso )/;
  // Sconti e offerte (riga che riduce il prezzo del prodotto sopra)
  const DISCOUNT = /^(offerta|sconto|promo|promozione|buono|coupon|risparmio|riduzione|taglio prezzo)/;

  // Prezzo in fondo alla riga, seguito eventualmente dal codice IVA (A, B, C...) o da €
  const PRICE_END = /(-?\d{1,4}[.,]\d{2})\s*(?:€|eur|[a-z]{1,2}\b|%|\*|[|!])?\s*$/i;
  const QTY_LINE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:x|×|\*|pz\.?\s*x?)\s*(\d{1,4}[.,]\d{2})\b/i;
  const WEIGHT_LINE = /(\d+[.,]\d{1,3})\s*kg\s*(?:x|×|\*)\s*(\d{1,4}[.,]\d{2})/i;

  /** "1,29" / "1.29" / "1.234,56" -> centesimi. */
  function toCents(text) {
    let s = String(text).trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(s) * 100);
  }

  /** Corregge piccoli errori tipici dell'OCR nei numeri: "2 ,90" -> "2,90", "0.,40" -> "0,40". */
  function fixNumbers(line) {
    return line
      .replace(/(\d)\s+([.,])\s*(\d{2})\b/g, '$1$2$3')
      .replace(/(\d)([.,])\s+(\d{2})\b/g, '$1$2$3')
      .replace(/(\d)[.,]{2}(\d{2})\b/g, '$1,$2')
      .replace(/(^|\s)=\s?(\d)/g, '$1-$2'); // "=0,40" letto al posto di "-0,40"
  }

  /** Data dello scontrino: preferisce una data seguita da un orario (es. "30/10/26 19:21"). */
  function findDate(text) {
    const parse = m => {
      let d = +m[1], mo = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      return d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100
        ? y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0') : '';
    };
    const withTime = /\b(\d{1,2})[\/.,-](\d{1,2})[\/.,-](\d{2,4})[ \t]+(?:ore[ \t]+)?\d{1,2}[:.;]\d{2}/g;
    let m;
    while ((m = withTime.exec(text))) { const d = parse(m); if (d) return d; }
    const any = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g;
    while ((m = any.exec(text))) { const d = parse(m); if (d) return d; }
    return '';
  }

  /**
   * Totale: raccoglie gli importi delle righe "totale", "subtotale", "importo
   * pagato", "pagamento elettronico", "importo"... e sceglie quello che
   * coincide con la somma dei prodotti; altrimenti il più ricorrente.
   * (Il "TOTALE" stampato grande viene spesso letto male: per questo
   * guardiamo tutte le righe che lo ripetono.)
   */
  function findTotal(lines, itemsTotal) {
    const found = [];
    for (const raw of lines) {
      const l = fixNumbers(raw), n = U.norm(l);
      if (!/(totale|importo|pagamento elettronico|pagato|pb banca|da pagare)/.test(n) || /iva|resto|contante|non riscosso|sconti|risparmi/.test(n)) continue;
      const m = l.match(/(\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*$/i);
      if (!m) continue;
      const v = toCents(m[1]);
      if (v > 0) found.push({ v, strong: /totale complessivo|^totale\b/.test(n) });
    }
    if (!found.length) return 0;
    const near = found.filter(f => Math.abs(f.v - itemsTotal) <= 2);
    if (itemsTotal && near.length) return near.find(f => f.strong) ? near.find(f => f.strong).v : near[0].v;
    const counts = {};
    for (const f of found) counts[f.v] = (counts[f.v] || 0) + (f.strong ? 1.5 : 1);
    return +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  /** Pulisce il nome del prodotto. */
  function cleanName(s) {
    return s.replace(PRICE_END, '')
      .replace(/\s\d{1,2}\s?%\s*$/, '')      // colonna IVA (es. "22%")
      .replace(/^(off\.?|offerta)\s+/i, '')   // prefisso "OFF." delle offerte
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s*#.|-]+|[\s*#.|-]+$/g, '')
      .trim();
  }

  /**
   * Interpreta il testo di uno scontrino.
   * Restituisce { shop, date, total, items:[{name, qty, unit, price, discount, category}], itemsTotal, check }
   * - price è il prezzo della riga in centesimi, già moltiplicato per la quantità e
   *   al netto di sconti/offerte
   * - check: 'ok' se la somma delle righe coincide con il totale (±5 cent)
   */
  function parseText(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => fixNumbers(l.trim())).filter(Boolean);
    // Inizio dei prodotti: dopo l'ultima riga di intestazione tra le prime 20
    let start = 0;
    for (let i = 0; i < Math.min(20, lines.length); i++) if (HEADER.test(U.norm(lines[i]))) start = i + 1;
    const items = [];
    let pendingQty = null, pendingName = '';
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      const n = U.norm(line);
      if (BODY_END.test(n)) break; // fine prodotti
      // Riga quantità: "2x2,90   5,80" oppure "0,532 kg x 2,99"
      const q = line.match(QTY_LINE) || line.match(WEIGHT_LINE);
      if (q && !/[a-z]{4,}/i.test(line.replace(q[0], ''))) {
        const qty = parseFloat(q[1].replace(',', '.'));
        const unit = toCents(q[2]);
        const rest = line.slice(line.indexOf(q[0]) + q[0].length);
        const pm = rest.match(PRICE_END);
        const lineTotal = pm ? toCents(pm[1]) : Math.round(qty * unit);
        const last = items[items.length - 1];
        if (pendingName) {
          // Il nome era sulla riga precedente, senza prezzo
          items.push({ name: cleanName(pendingName), qty, unit, price: lineTotal, category: productCategory(pendingName) });
          pendingName = '';
        } else if (last && !last.qtySet && Math.abs(last.price - lineTotal) <= 2) {
          last.qty = qty; last.unit = unit; last.qtySet = true;
        } else {
          pendingQty = { qty, unit };
        }
        continue;
      }
      const p = line.match(PRICE_END);
      const name = cleanName(line);
      const isDiscount = DISCOUNT.test(n) || (p && toCents(p[1]) < 0);
      if (!p) {
        // Nome senza prezzo: il prezzo potrebbe essere sulla riga dopo (es. "2x2,90 5,80")
        if (!isDiscount && !SKIP.test(n) && /[a-z]{3,}/i.test(name)) pendingName = line;
        continue;
      }
      if (SKIP.test(n) && !isDiscount) continue;
      const price = toCents(p[1]);
      if (isDiscount) {
        // Sconto/offerta: riduce il prodotto precedente
        const last = items[items.length - 1];
        // (se lo sconto supera il prezzo, la riga è stata letta male: la ignoriamo)
        if (last && Math.abs(price) < last.price) { last.discount = (last.discount || 0) + Math.abs(price); last.price -= Math.abs(price); }
        continue;
      }
      if (!/[a-z]{2,}/i.test(name)) continue;
      pendingName = '';
      const item = { name, qty: 1, unit: price, price, category: productCategory(name) };
      if (pendingQty) {
        item.qty = pendingQty.qty; item.unit = pendingQty.unit; item.qtySet = true;
        pendingQty = null;
      }
      items.push(item);
    }
    items.forEach(it => delete it.qtySet);
    const itemsTotal = U.sum(items, it => it.price);
    const total = findTotal(lines, itemsTotal);
    return {
      shop: findShop(lines),
      date: findDate(lines.join('\n')),
      total: total || itemsTotal,
      items,
      itemsTotal,
      check: total ? (Math.abs(total - itemsTotal) <= 5 ? 'ok' : 'diff') : 'no-total',
      payment: paymentMethod(text),
      body: items.length > 0
    };
  }

  /** Somiglianza tra due righe (0-1), per riconoscere la stessa riga letta due volte. */
  function similar(a, b) {
    const x = U.norm(a).replace(/\s+/g, ''), y = U.norm(b).replace(/\s+/g, '');
    if (!x || !y) return 0;
    if (Math.abs(x.length - y.length) > Math.max(x.length, y.length) * 0.3) return 0;
    return 1 - editDistance(x, y) / Math.max(x.length, y.length);
  }

  /**
   * Unisce i testi di più foto dello stesso scontrino. Se una foto ripete le
   * ultime righe della precedente (sovrapposizione), le togliamo, anche se
   * l'OCR le ha lette in modo leggermente diverso.
   */
  function mergeTexts(texts) {
    let out = [];
    for (const t of texts) {
      const lines = String(t).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      // Cerchiamo dove questa foto si sovrappone alla precedente: proviamo ogni
      // aggancio (riga s della precedente = riga t della nuova) e contiamo le
      // righe "quasi uguali". Le righe sovrapposte della nuova foto si scartano.
      let skip = 0, best = 0;
      for (let s = Math.max(0, out.length - 30); s < out.length; s++) {
        for (let t0 = 0; t0 < Math.min(6, lines.length); t0++) {
          const k = Math.min(out.length - s, lines.length - t0);
          let ok = 0;
          for (let j = 0; j < k; j++) if (similar(out[s + j], lines[t0 + j]) >= 0.7) ok++;
          if (ok >= 2 && ok >= k * 0.4 && ok > best) { best = ok; skip = t0 + k; }
        }
      }
      out = out.concat(lines.slice(skip));
    }
    return out.join('\n');
  }

  /** Nome "normalizzato" di un prodotto, per confrontare prezzi nel tempo. */
  function productKey(name) {
    return U.norm(name).replace(/\d+([.,]\d+)?\s*(g|gr|kg|ml|l|lt|cl|pz|x)\b/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Analisi della spesa sugli scontrini salvati.
   * filters = { from, to, shop, category }
   */
  function analyze(receipts, filters) {
    const f = filters || {};
    const list = (receipts || []).filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to)
      && (!f.shop || U.norm(r.shop) === U.norm(f.shop)));
    const items = [];
    for (const r of list) for (const it of r.items || []) {
      if (f.category && it.category !== f.category) continue;
      items.push(Object.assign({ date: r.date, shop: r.shop, receipt: r.id }, it));
    }
    const byCategory = {};
    for (const it of items) byCategory[it.category || 'Altro'] = (byCategory[it.category || 'Altro'] || 0) + it.price;
    const products = {};
    for (const it of items) {
      const k = productKey(it.name);
      if (!k) continue;
      const p = (products[k] = products[k] || { key: k, name: it.name, count: 0, qty: 0, spent: 0, prices: [], category: it.category });
      p.count++;
      p.qty += it.qty || 1;
      p.spent += it.price;
      p.prices.push({ date: it.date, unit: it.unit || it.price, shop: it.shop });
    }
    const productList = Object.values(products).map(p => {
      p.prices.sort((a, b) => a.date.localeCompare(b.date));
      const first = p.prices[0].unit, last = p.prices[p.prices.length - 1].unit;
      p.change = p.prices.length >= 2 && first > 0 ? (last - first) / first : 0;
      p.minUnit = Math.min(...p.prices.map(x => x.unit));
      p.maxUnit = Math.max(...p.prices.map(x => x.unit));
      return p;
    });
    const byShop = {};
    for (const r of list) {
      const s = (byShop[r.shop || 'Senza nome'] = byShop[r.shop || 'Senza nome'] || { shop: r.shop || 'Senza nome', count: 0, total: 0 });
      s.count++;
      s.total += r.total || 0;
    }
    const byMonth = {};
    for (const it of items) byMonth[it.date.slice(0, 7)] = (byMonth[it.date.slice(0, 7)] || 0) + it.price;
    return {
      receipts: list.length,
      total: U.sum(list, r => r.total || 0),
      items: items.length,
      average: list.length ? Math.round(U.sum(list, r => r.total || 0) / list.length) : 0,
      byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
      top: productList.slice().sort((a, b) => b.spent - a.spent).slice(0, 15),
      frequent: productList.slice().sort((a, b) => b.count - a.count).slice(0, 15),
      rising: productList.filter(p => p.change > 0.05).sort((a, b) => b.change - a.change).slice(0, 10),
      byShop: Object.values(byShop).sort((a, b) => b.total - a.total).map(s => Object.assign(s, { average: Math.round(s.total / s.count) })),
      byMonth: Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])),
      shops: [...new Set((receipts || []).map(r => r.shop).filter(Boolean))].sort(),
      categories: DEPARTMENTS.map(d => d[0]).concat('Altro')
    };
  }

  /**
   * Movimenti a cui collegare lo scontrino: uscite con lo STESSO IMPORTO nei
   * giorni dello scontrino. La banca può registrare il pagamento qualche
   * giorno dopo (fino a 5) o, raramente, il giorno prima.
   * Restituisce [{ tx, diff, days, exact, sameDay, label }] dal più probabile.
   *   - stesso importo al centesimo; fino a 5 centesimi solo per gli
   *     arrotondamenti dei pagamenti in contanti (es. 21,14 -> 21,15)
   *   - senza data sullo scontrino: stesso importo negli ultimi 30 giorni
   * excludeIds: movimenti già collegati ad altri scontrini
   */
  function matchPayments(receipt, transactions, excludeIds, todayIso) {
    const total = Math.abs(receipt.total || 0);
    if (!total) return [];
    const skip = new Set(excludeIds || []);
    const ref = receipt.date || todayIso || U.today();
    return transactions
      .filter(t => t.state === 'active' && t.cents < 0 && !skip.has(t.id) && t.kind !== 'withdrawal' && t.kind !== 'transfer')
      .map(t => {
        const diff = Math.abs(-t.cents - total);
        const delta = U.daysBetween(ref, t.date); // positivo = registrato dopo lo scontrino
        return { tx: t, diff, days: Math.abs(delta), delta, exact: diff === 0, sameDay: delta === 0 };
      })
      .filter(x => x.diff <= 5 && (receipt.date ? x.delta >= -1 && x.delta <= 5 : x.delta <= 0 && x.delta >= -30))
      .map(x => Object.assign(x, {
        label: (x.exact ? 'stesso importo' : 'importo quasi uguale (' + (x.diff / 100).toFixed(2).replace('.', ',') + ' € di differenza)')
          + (!receipt.date ? '' : x.sameDay ? ', stesso giorno' : x.delta > 0 ? ', registrato ' + x.delta + (x.delta === 1 ? ' giorno' : ' giorni') + ' dopo' : ', il giorno prima'),
        score: x.diff * 10 + x.days * 3 + (x.tx.status === 'NO' ? 1 : 0)
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);
  }

  /**
   * Come è stato pagato secondo lo scontrino: 'cash' (contanti), 'card'
   * (carta/bancomat) oppure '' se non si capisce o è misto.
   * Guarda le righe "Pagamento contante 52,00", "Pagamento elettronico 13,65"...
   * ignorando quelle a 0,00.
   */
  function paymentMethod(text) {
    let cash = 0, card = 0;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const l = fixNumbers(raw), n = U.norm(l);
      const m = l.match(/(\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*$/i);
      const v = m ? toCents(m[1]) : 0;
      if (/resto|non riscosso/.test(n)) continue;
      if (/(pagamento|pagato|pag\.)\s*(in\s*)?contant|^contant/.test(n) && v > 0) cash += v;
      if (/(pagamento elettronico|pago ?bancomat|bancomat|carta di credito|carta di debito|pb banca|pos\b|contactless|visa|mastercard|maestro)/.test(n) && (v > 0 || /pago ?bancomat|transazione autorizzata/.test(n))) card += v || 1;
    }
    if (cash && !card) return 'cash';
    if (card && !cash) return 'card';
    return '';
  }

  const Receipts = { DEPARTMENTS, SHOPS, productCategory, knownShop, findShop, parseText, mergeTexts, productKey, analyze, matchPayments, paymentMethod, findDate, toCents };
  root.Receipts = Receipts;
  if (typeof module !== 'undefined') module.exports = Receipts;
})(typeof window === 'undefined' ? globalThis : window);
