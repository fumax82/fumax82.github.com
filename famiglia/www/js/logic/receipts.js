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
    ['Frutta', ['mele', 'mela', 'banan', 'arance', 'arancia', 'pere ', 'kiwi', 'uva', 'limon', 'fragol', 'frutta', 'ananas', 'pesche', 'albicocc', 'mandarin', 'clementin', 'melone', 'anguria', 'mirtill', 'avocado']],
    ['Verdura', ['insalata', 'pomodor', 'zucchin', 'patat', 'carot', 'cipoll', 'verdur', 'spinaci', 'finocch', 'peperon', 'melanzan', 'lattuga', 'rucola', 'broccol', 'cavol', 'funghi', 'aglio', 'basilico', 'sedano', 'cetriol', 'legumi fres']],
    ['Carne', ['pollo', 'petto', 'manzo', 'maiale', 'bovino', 'tacchin', 'salsicc', 'macinato bov', 'macinato mist', 'macinato di', 'hamburger', 'bistecc', 'vitello', 'arrosto', 'cotolett', 'wurstel', 'spiedin', 'agnello', 'carne']],
    ['Pesce', ['salmone', 'merluzz', 'gamber', 'pesce', 'orata', 'branzino', 'cozze', 'vongole', 'calamar', 'polpo', 'baccala', 'sgombro', 'alici', 'acciughe']],
    ['Salumi', ['prosciutto', 'crudo', 'cotto', 'salame', 'mortadell', 'bresaola', 'speck', 'pancetta', 'coppa']],
    ['Latte e formaggi', ['latte', 'yogurt', 'yogh', 'formagg', 'mozzarell', 'parmigian', 'grana', 'burro', 'ricotta', 'panna', 'stracchino', 'gorgonzola', 'mascarpone', 'emmental', 'provola', 'scamorza', 'kefir', 'fontina', 'pecorino']],
    ['Uova', ['uova', 'uovo']],
    ['Pane e forno', ['pane', 'focacc', 'cracker', 'grissin', 'fette biscott', 'piadina', 'pizza', 'panini', 'brioche', 'cornett', 'tramezz']],
    ['Pasta, riso e farine', ['pasta', 'spaghett', 'penne', 'riso', 'fusilli', 'farina', 'rigaton', 'tagliatell', 'lasagne', 'gnocchi', 'ravioli', 'tortellin', 'cous cous', 'orzo', 'farro']],
    ['Dispensa', ['olio', 'aceto', 'sale ', 'zucchero', 'passata', 'pelati', 'polpa', 'ceci', 'fagioli', 'lenticch', 'caffe', 'tonno', 'sugo', 'pesto', 'maionese', 'ketchup', 'marmellat', 'miele', 'cereali', 'muesli', 'spezie', 'brodo', 'dado', 'legumi', 'conserv', 'the ', 'te ', 'camomilla', 'tisana']],
    ['Dolci e snack', ['biscott', 'cioccolat', 'merendin', 'patatin', 'snack', 'gelat', 'torta', 'nutella', 'caramell', 'wafer', 'crostatin', 'chips', 'pop corn', 'dolci', 'barrett', 'pandoro', 'panettone', 'colomba']],
    ['Bevande', ['acqua', 'succo', 'coca', 'aranciata', 'bibita', 'the fredd', 'te fredd', 'estathe', 'chinotto', 'gassosa', 'energy', 'red bull', 'sprite', 'fanta', 'pepsi', 'lemon soda']],
    ['Alcolici', ['vino', 'birra', 'prosecco', 'spumante', 'liquor', 'gin ', 'vodka', 'whisky', 'rum ', 'amaro', 'aperol', 'campari', 'lambrusco', 'chianti']],
    ['Surgelati', ['surgel', 'findus', 'bastoncin', 'frozen', 'gelo ', 'sofficin', '4 salti']],
    ['Casa e pulizia', ['detersiv', 'ammorbid', 'carta igien', 'scottex', 'tovagliol', 'sgrassat', 'candeggin', 'spugn', 'sacchett', 'pellicol', 'alluminio', 'piatti', 'bicchieri', 'lavastovigl', 'pastiglie', 'anticalcare', 'deodorante amb', 'scopa', 'carta cucina', 'fazzolett']],
    ['Igiene personale', ['shampoo', 'bagnoschiuma', 'dentifric', 'sapone', 'deodorant', 'assorbent', 'rasoi', 'cotton', 'balsamo', 'spazzolin', 'crema', 'docciaschiuma', 'collutorio', 'salviett']],
    ['Bambini', ['pannolin', 'omogeneizz', 'biberon', 'baby', 'plasmon', 'mellin']],
    ['Animali', ['crocchett', 'cane', 'gatto', 'lettiera', 'pet ', 'whiskas', 'friskies', 'purina']]
  ];

  /** Reparto di un prodotto in base al nome. */
  function productCategory(name) {
    const n = ' ' + U.norm(name) + ' ';
    for (const [dep, words] of DEPARTMENTS) if (words.some(w => n.includes(w))) return dep;
    return 'Altro';
  }

  // Righe che NON sono prodotti
  const SKIP = /(^|\s)(totale|subtotale|sub totale|tot\.|iva|imponibile|contante|contanti|resto|pagamento|pagato|carta|bancomat|elettronico|documento|commerciale|scontrino|p\.?\s?iva|partita|c\.f\.|cod\.? fisc|tel\.?|telefono|via |viale|piazza|corso |cassa|cassiere|operatore|transazione|autorizz|grazie|arrivederci|www\.|http|num\.|n\. doc|rt |matricola|euro$|importo|punti|saldo punti|fidelity|carta fedelta|esercente|acquirer|stan|terminale|aid|pan |chip|contactless|rif\.)/;
  const PRICE_END = /(-?\d{1,4}[.,]\d{2})\s*(?:€|eur|[a-z]{1,2}|%|\*)?\s*$/i;
  const QTY_LINE = /^\s*(\d+(?:[.,]\d+)?)\s*(?:x|\*|pz\.?\s*x?)\s*(\d{1,4}[.,]\d{2})\b/i;
  const WEIGHT_LINE = /(\d+[.,]\d{1,3})\s*kg\s*(?:x|\*)\s*(\d{1,4}[.,]\d{2})/i;

  /** "1,29" / "1.29" / "1.234,56" -> centesimi. */
  function toCents(text) {
    let s = String(text).trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Math.round(parseFloat(s) * 100);
  }

  /** Prima data plausibile nel testo -> "AAAA-MM-GG". */
  function findDate(text) {
    const re = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/g;
    let m;
    while ((m = re.exec(text))) {
      let [, d, mo, y] = m;
      d = +d; mo = +mo; y = +y;
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y >= 2000 && y <= 2100) {
        return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      }
    }
    return '';
  }

  /** Totale: cerca "TOTALE COMPLESSIVO", poi "TOTALE", poi "IMPORTO PAGATO". */
  function findTotal(lines) {
    const pick = re => {
      for (const l of lines) {
        const n = U.norm(l);
        if (re.test(n)) {
          const m = l.match(PRICE_END) || l.match(/(\d{1,4}[.,]\d{2})/);
          if (m) return toCents(m[1]);
        }
      }
      return 0;
    };
    return pick(/totale\s*(complessivo|euro|eur|€)/) || pick(/^totale\b|\btotale\b(?!.*iva)/) || pick(/importo pagato|pagamento elettronico|pagato/);
  }

  /** Nome del negozio: prima riga "con lettere" in alto, preferendo insegne note. */
  function findShop(lines) {
    const C = root.Classify || (typeof require !== 'undefined' ? require('./classify.js') : null);
    for (const l of lines.slice(0, 8)) {
      if (C) {
        const d = C.dictionaryMatch({ operation: l, details: '' });
        if (d && d.category === 'Supermercato') return d.keyword.replace(/\b\w/g, c => c.toUpperCase()).trim();
      }
    }
    const first = lines.slice(0, 5).find(l => /[a-z]{3,}/i.test(l) && !SKIP.test(U.norm(l)));
    return first ? first.replace(/[^\w\s'&.-]/g, '').trim().slice(0, 40) : '';
  }

  /** Pulisce il nome del prodotto. */
  function cleanName(s) {
    return s.replace(PRICE_END, '').replace(/\s{2,}/g, ' ').replace(/^[\s*#.-]+|[\s*#.-]+$/g, '').trim();
  }

  /**
   * Interpreta il testo di uno scontrino.
   * Restituisce { shop, date, total, items:[{name, qty, price, unit, category}], itemsTotal, check }
   * - price è il prezzo della riga in centesimi (già moltiplicato per la quantità)
   * - check: 'ok' se la somma delle righe coincide con il totale (±5 cent)
   */
  function parseText(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items = [];
    let pendingQty = null;
    let inBody = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const n = U.norm(line);
      if (/^totale|^subtotale|^sub totale|totale complessivo/.test(n)) break; // fine prodotti
      // "2 x 0,89": quantità per la riga successiva o precedente
      const q = line.match(QTY_LINE) || line.match(WEIGHT_LINE);
      if (q && !/[a-z]{4,}/i.test(line.replace(q[0], ''))) {
        const qty = parseFloat(q[1].replace(',', '.'));
        const unit = toCents(q[2]);
        const last = items[items.length - 1];
        if (last && !last.qtySet && Math.abs(last.price - Math.round(qty * unit)) <= 2) {
          last.qty = qty; last.unit = unit; last.qtySet = true;
        } else {
          pendingQty = { qty, unit };
        }
        continue;
      }
      if (SKIP.test(n)) continue;
      const p = line.match(PRICE_END);
      if (!p) continue;
      const name = cleanName(line);
      if (!/[a-z]{2,}/i.test(name)) continue;
      const price = toCents(p[1]);
      // Sconti: riga negativa o con "sconto" -> si applica al prodotto precedente
      if (price < 0 || /sconto|promo|buono|coupon/.test(n)) {
        const last = items[items.length - 1];
        if (last) { last.discount = (last.discount || 0) + Math.abs(price); last.price -= Math.abs(price); }
        continue;
      }
      inBody = true;
      const item = { name, qty: 1, unit: price, price, category: productCategory(name) };
      if (pendingQty) {
        item.qty = pendingQty.qty; item.unit = pendingQty.unit; item.qtySet = true;
        pendingQty = null;
      }
      items.push(item);
    }
    items.forEach(it => delete it.qtySet);
    const total = findTotal(lines);
    const itemsTotal = U.sum(items, it => it.price);
    return {
      shop: findShop(lines),
      date: findDate(lines.join('\n')),
      total: total || itemsTotal,
      items,
      itemsTotal,
      check: total ? (Math.abs(total - itemsTotal) <= 5 ? 'ok' : 'diff') : 'no-total',
      body: inBody
    };
  }

  /**
   * Unisce i testi di più foto dello stesso scontrino: se una foto ripete le
   * ultime righe della precedente (sovrapposizione), le togliamo.
   */
  function mergeTexts(texts) {
    let out = [];
    for (const t of texts) {
      const lines = String(t).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let skip = 0;
      for (let k = Math.min(6, lines.length, out.length); k > 0; k--) {
        const tail = out.slice(-k).map(U.norm).join('|');
        const head = lines.slice(0, k).map(U.norm).join('|');
        if (tail === head) { skip = k; break; }
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

  /** Pagamenti che potrebbero corrispondere allo scontrino (importo e data). */
  function matchPayments(receipt, transactions) {
    return transactions
      .filter(t => t.state === 'active' && t.cents < 0)
      .map(t => {
        const diff = Math.abs(-t.cents - receipt.total);
        const days = receipt.date ? Math.abs(U.daysBetween(t.date, receipt.date)) : 99;
        return { tx: t, diff, days, score: diff / 10 + days * 3 };
      })
      .filter(x => x.diff <= Math.max(5, receipt.total * 0.02) && x.days <= 4)
      .sort((a, b) => a.score - b.score)
      .slice(0, 6);
  }

  const Receipts = { DEPARTMENTS, productCategory, parseText, mergeTexts, productKey, analyze, matchPayments, findDate, toCents };
  root.Receipts = Receipts;
  if (typeof module !== 'undefined') module.exports = Receipts;
})(typeof window === 'undefined' ? globalThis : window);
