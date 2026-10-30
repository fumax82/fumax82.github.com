/*
 * classify.js - Tutto ciò che serve a CLASSIFICARE i movimenti:
 *
 *  1. TASSONOMIA: "famiglie di spesa" (macro-gruppi) che contengono categorie.
 *     Es. famiglia "Tecnologia e abbonamenti" -> categorie "AI", "Streaming"...
 *  2. DIZIONARIO: parole chiave note (Anthropic, OpenAI, Esselunga, Eni...)
 *     che permettono di proporre una categoria anche la prima volta.
 *  3. REGOLE: create da te ("tutto ciò che contiene 'anthropic' va in AI").
 *     Si applicano in automatico ai movimenti nuovi.
 *  4. INFORMAZIONI MANCANTI: famiglia, categoria o conto/carta assenti.
 *  5. RICORRENZE: pagamenti ripetuti verso lo stesso soggetto, candidati a
 *     diventare una regola.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  // ---------------------------------------------------------------------
  // 1. Tassonomia predefinita (modificabile dall'app, salvata in prefs.taxonomy)
  // ---------------------------------------------------------------------
  const DEFAULT_TAXONOMY = [
    { family: 'Casa', categories: ['Mutuo e affitto', 'Utenze', 'Condominio', 'Manutenzione', 'Arredamento'] },
    { family: 'Alimentari', categories: ['Supermercato', 'Negozi alimentari', 'Mercato'] },
    { family: 'Ristoranti e bar', categories: ['Ristoranti', 'Bar e caffè', 'Delivery', 'Fast food'] },
    { family: 'Trasporti', categories: ['Carburante', 'Pedaggi e parcheggi', 'Mezzi pubblici', 'Taxi e sharing', 'Auto e moto'] },
    { family: 'Tecnologia e abbonamenti', categories: ['AI', 'Streaming', 'Software e cloud', 'Telefonia e internet', 'Elettronica'] },
    { family: 'Salute e benessere', categories: ['Farmacia', 'Visite mediche', 'Sport e palestra'] },
    { family: 'Persona e famiglia', categories: ['Abbigliamento', 'Cura della persona', 'Figli e scuola', 'Animali', 'Regali'] },
    { family: 'Svago e viaggi', categories: ['Viaggi', 'Hobby', 'Eventi e cultura', 'Giochi e scommesse'] },
    { family: 'Shopping', categories: ['Shopping online', 'Negozi e grandi magazzini'] },
    { family: 'Finanza e tasse', categories: ['Commissioni bancarie', 'Tasse e imposte', 'Assicurazioni', 'Prestiti e rate', 'Contanti'] },
    { family: 'Entrate', categories: ['Stipendio', 'Rimborsi ricevuti', 'Regali ricevuti', 'Altre entrate'] },
    { family: 'Movimenti interni', categories: ['Giroconti', 'Risparmio', 'Investimenti', 'Saldo carta di credito'] }
  ];

  /** Categorie troppo generiche: le consideriamo "da completare". */
  const GENERIC_CATEGORY = /^(|altr[oei].*|varie|spese varie|da classificare|non (categorizzat|classificat).*|n\.?d\.?|generico|uscite varie|entrate varie)$/;

  // ---------------------------------------------------------------------
  // 2. Dizionario di parole chiave -> [famiglia, categoria]
  //    Le parole sono confrontate sul testo normalizzato (minuscolo, senza accenti).
  // ---------------------------------------------------------------------
  const DICTIONARY = [
    // Intelligenza artificiale (richiesta esplicita: Claude/Anthropic, OpenAI, Gemini...)
    [['anthropic', 'claude.ai', 'claude ai', 'openai', 'chatgpt', 'gemini', 'google one ai', 'midjourney', 'perplexity',
      'mistral ai', 'github copilot', 'copilot pro', 'cursor ai', 'elevenlabs', 'runwayml', 'character.ai', 'poe.com', 'deepl'],
     'Tecnologia e abbonamenti', 'AI', 'servizio di intelligenza artificiale'],
    [['netflix', 'spotify', 'disney plus', 'disneyplus', 'dazn', 'prime video', 'primevideo', 'now tv', 'nowtv', 'youtube premium',
      'paramount', 'apple tv', 'timvision', 'infinity', 'audible', 'crunchyroll'],
     'Tecnologia e abbonamenti', 'Streaming', 'abbonamento streaming'],
    [['dropbox', 'icloud', 'google storage', 'microsoft 365', 'office 365', 'adobe', 'canva', 'notion', '1password', 'nordvpn', 'github'],
     'Tecnologia e abbonamenti', 'Software e cloud', 'software o cloud'],
    [['tim spa', 'telecom italia', 'vodafone', 'windtre', 'wind tre', 'iliad', 'fastweb', 'ho mobile', 'ho. mobile', 'very mobile',
      'kena mobile', 'poste mobile', 'postemobile', 'tiscali', 'sky italia', 'sky wifi'],
     'Tecnologia e abbonamenti', 'Telefonia e internet', 'operatore telefonico'],
    [['mediaworld', 'unieuro', 'euronics', 'expert ', 'apple store', 'trony'],
     'Tecnologia e abbonamenti', 'Elettronica', 'negozio di elettronica'],
    [['esselunga', 'coop ', 'ipercoop', 'conad', 'carrefour', 'lidl', 'eurospin', 'pam ', 'panorama', 'despar', 'interspar',
      'eurospar', 'iper ', 'aldi', 'penny', 'md spa', 'md discount', 'todis', 'tigre', 'bennet', 'famila', 'crai', 'sigma',
      'unes', 'tuodi', 'naturasi', 'in\'s', 'ins mercato', 'basko', 'emisfero', 'il gigante', 'tosano', 'decò', 'deco ',
      'supermercat', 'iperal', 'prestofresco', 'carrefour market'],
     'Alimentari', 'Supermercato', 'supermercato'],
    [['panificio', 'macelleria', 'pescheria', 'fruttivendolo', 'salumeria', 'alimentari', 'pasticceria', 'forno '],
     'Alimentari', 'Negozi alimentari', 'negozio alimentare'],
    [['glovo', 'deliveroo', 'just eat', 'justeat', 'uber eats', 'ubereats'], 'Ristoranti e bar', 'Delivery', 'consegna a domicilio'],
    [['mcdonald', 'burger king', 'kfc', 'old wild west', 'roadhouse', 'autogrill', 'poke'], 'Ristoranti e bar', 'Fast food', 'fast food'],
    [['ristorante', 'trattoria', 'osteria', 'pizzeria', 'sushi', 'bistrot'], 'Ristoranti e bar', 'Ristoranti', 'ristorante'],
    [[' bar ', 'caffe', 'caffetteria', 'starbucks'], 'Ristoranti e bar', 'Bar e caffè', 'bar'],
    [['eni ', 'enilive', 'eni station', 'agip', 'q8', 'tamoil', 'esso', 'ip gestioni', 'api-ip', 'total erg', 'totalenergies',
      'erg ', 'carburant', 'distributore', 'repsol', 'shell'],
     'Trasporti', 'Carburante', 'distributore di carburante'],
    [['telepass', 'autostrade', 'autostrada', 'parcheggio', 'parking', 'easypark', 'mycicero', 'saba '], 'Trasporti', 'Pedaggi e parcheggi', 'pedaggi o parcheggi'],
    [['trenitalia', 'italo', 'trenord', 'atm milano', 'atac', 'gtt ', 'tper', 'flixbus', 'metro'], 'Trasporti', 'Mezzi pubblici', 'trasporto pubblico'],
    [['uber', 'free now', 'freenow', 'itaxi', 'enjoy', 'share now', 'lime', 'bird ', 'dott ', 'taxi'], 'Trasporti', 'Taxi e sharing', 'taxi o sharing'],
    [['enel', 'a2a', 'hera', 'iren', 'edison', 'acea', 'sorgenia', 'e.on', 'eon energia', 'plenitude', 'eni gas', 'servizio elettrico',
      'acquedotto', 'gas e luce', 'tari'],
     'Casa', 'Utenze', 'fornitore di luce, gas o acqua'],
    [['condominio', 'amministrazione condomin'], 'Casa', 'Condominio', 'spese condominiali'],
    [['mutuo', 'affitto', 'canone locazione'], 'Casa', 'Mutuo e affitto', 'casa'],
    [['ikea', 'leroy merlin', 'bricoman', 'brico', 'obi ', 'maisons du monde', 'jysk', 'mondo convenienza', 'tecnomat'],
     'Casa', 'Arredamento', 'arredamento e fai da te'],
    [['amazon', 'amzn', 'ebay', 'aliexpress', 'temu', 'shein', 'zalando', 'vinted', 'paypal'], 'Shopping', 'Shopping online', 'acquisto online'],
    [['zara', 'h&m', 'h & m', 'ovs', 'primark', 'decathlon sport', 'calzedonia', 'intimissimi', 'tezenis', 'benetton', 'uniqlo'],
     'Persona e famiglia', 'Abbigliamento', 'abbigliamento'],
    [['farmacia', 'parafarmacia', 'farmacie'], 'Salute e benessere', 'Farmacia', 'farmacia'],
    [['decathlon', 'palestra', 'virgin active', 'mcfit', 'fitness', 'piscina'], 'Salute e benessere', 'Sport e palestra', 'sport'],
    [['dentista', 'studio medico', 'poliambulatorio', 'ospedale', 'analisi cliniche', 'ticket sanitario', 'asl '],
     'Salute e benessere', 'Visite mediche', 'spese mediche'],
    [['booking.com', 'airbnb', 'ryanair', 'easyjet', 'ita airways', 'wizz', 'expedia', 'hotel', 'volotea', 'vueling', 'trivago'],
     'Svago e viaggi', 'Viaggi', 'viaggi'],
    [['cinema', 'ticketone', 'ticketmaster', 'teatro', 'museo', 'feltrinelli', 'mondadori'], 'Svago e viaggi', 'Eventi e cultura', 'cultura'],
    [['playstation', 'steam', 'nintendo', 'xbox', 'lottomatica', 'sisal', 'snai', 'gratta'], 'Svago e viaggi', 'Giochi e scommesse', 'giochi'],
    [['zooplus', 'arcaplanet', 'veterinari', 'isola dei tesori'], 'Persona e famiglia', 'Animali', 'animali'],
    [['commissione', 'commissioni', 'canone conto', 'canone mensile', 'spese tenuta', 'imposta di bollo', 'bollo conto', 'competenze'],
     'Finanza e tasse', 'Commissioni bancarie', 'costi bancari'],
    [['f24', 'agenzia entrate', 'agenzia delle entrate', 'pagopa', 'bollo auto', 'tassa'], 'Finanza e tasse', 'Tasse e imposte', 'tasse'],
    [['assicurazion', 'unipol', 'generali', 'allianz', 'axa', 'zurich', 'prima.it', 'genialloyd', 'linear'],
     'Finanza e tasse', 'Assicurazioni', 'assicurazione'],
    [['rata finanziamento', 'findomestic', 'agos', 'compass', 'prestito'], 'Finanza e tasse', 'Prestiti e rate', 'finanziamento'],
    [['prelievo', 'prelevamento'], 'Finanza e tasse', 'Contanti', 'prelievo di contanti'],
    [['stipendio', 'emolumenti', 'retribuzione', 'cedolino'], 'Entrate', 'Stipendio', 'stipendio'],
    [['saldo carta', 'addebito carta di credito', 'estratto conto carta'], 'Movimenti interni', 'Saldo carta di credito', 'saldo carta di credito'],
    [['giroconto', 'girofondi'], 'Movimenti interni', 'Giroconti', 'giroconto']
  ];

  // Parole che non identificano la controparte (le togliamo per riconoscere i "simili")
  const NOISE = /\b(pagamento|pagam|pag|pos|tramite|presso|effettuato|su|internet|carta|card|n|nr|num|del|della|di|da|a|il|lo|la|op|operazione|addebito|sdd|diretto|bonifico|a vostro favore|disposto|favore|vs|ns|sepa|core|mandato|rif|riferimento|ordinante|beneficiario|data|ora|valuta|spa|s p a|srl|s r l|ltd|inc|llc|gmbh|com|www|it|us|ie|gb|nl|lu|eur|euro|ita|italia|italy|mi|rm|to|apple pay|google pay|contactless|cod|codice)\b/g;

  /**
   * Chiave della controparte: serve a riconoscere pagamenti "simili".
   * "Pagamento POS ANTHROPIC* CLAUDE SUBSCR 10/03 carta *1234" -> "anthropic claude subscr"
   */
  function merchantKey(t) {
    let s = U.norm((t.details || '') + ' ' + (t.details ? '' : t.operation || ''));
    s = s
      .replace(/\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?/g, ' ')   // date
      .replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ')                   // orari
      .replace(/[*x]{2,}\d*|\*\d+/g, ' ')                      // numeri carta mascherati
      .replace(/\d{3,}/g, ' ')                                 // codici numerici lunghi
      .replace(/[^a-z0-9&' ]+/g, ' ')
      .replace(NOISE, ' ')
      .replace(/\b[a-z]\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return s.split(' ').filter(Boolean).slice(0, 3).join(' ');
  }

  /** Parola più significativa della controparte (es. "anthropic"): base per una regola. */
  function mainToken(t) {
    // Se la controparte è nota nel dizionario (es. "gemini" in "GOOGLE *GEMINI"), usiamo quella parola
    const d = dictionaryMatch(t);
    if (d && d.keyword.trim().length >= 3 && merchantKey(t).includes(d.keyword.trim())) return d.keyword.trim();
    const key = merchantKey(t);
    const words = key.split(' ').filter(w => w.length >= 3);
    return words[0] || key || U.norm(t.operation).split(' ')[0] || '';
  }

  /** Testo completo usato per cercare parole chiave. */
  function haystack(t) {
    return ' ' + U.norm([t.operation, t.details, t.note].join(' ')) + ' ';
  }

  /** Cerca nel dizionario. Restituisce { family, category, reason, keyword } o null. */
  function dictionaryMatch(t) {
    const text = haystack(t);
    for (const [words, family, category, reason] of DICTIONARY) {
      for (const w of words) {
        if (text.includes(w)) return { family, category, reason, keyword: w.trim() };
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Tassonomia: utilità
  // ---------------------------------------------------------------------

  /** Tassonomia attuale (predefinita + aggiunte dell'utente). */
  function taxonomy(prefs) {
    const custom = prefs && prefs.taxonomy;
    return Array.isArray(custom) && custom.length ? custom : DEFAULT_TAXONOMY;
  }

  /** Famiglia a cui appartiene una categoria (confronto senza maiuscole/accenti). */
  function familyOfCategory(category, tax) {
    const c = U.norm(category);
    if (!c) return '';
    for (const f of tax) if (f.categories.some(x => U.norm(x) === c)) return f.family;
    return '';
  }

  /** Famiglia effettiva di un movimento: scelta da te oppure dedotta dalla categoria. */
  function familyOf(t, tax) {
    return t.family || familyOfCategory(t.category, tax);
  }

  function isGenericCategory(category) {
    return GENERIC_CATEGORY.test(U.norm(category));
  }

  // ---------------------------------------------------------------------
  // 3. Regole
  //   { id, name, text: "anthropic|openai", field: "any"|"operation"|"details",
  //     sign: "out"|"in"|"any", account: "", min: centesimi?, max: centesimi?,
  //     set: { family, category, kind?, accountUser?, person? }, enabled: true,
  //     afterId: n (facoltativo: vale solo per i movimenti con id > n, cioè futuri) }
  // ---------------------------------------------------------------------

  /** Le parole della regola: separate da | o da virgola. */
  function ruleWords(rule) {
    return String(rule.text || '').split(/[|,]/).map(U.norm).filter(Boolean);
  }

  function ruleMatches(rule, t) {
    if (rule.enabled === false) return false;
    const words = ruleWords(rule);
    if (!words.length) return false;
    const field = rule.field || 'any';
    const text = ' ' + U.norm(field === 'operation' ? t.operation : field === 'details' ? t.details
      : [t.operation, t.details].join(' ')) + ' ';
    if (!words.some(w => text.includes(w))) return false;
    if (rule.sign === 'out' && t.cents >= 0) return false;
    if (rule.sign === 'in' && t.cents <= 0) return false;
    if (rule.account && U.norm(U.account(t)) !== U.norm(rule.account)) return false;
    const abs = Math.abs(t.cents);
    if (rule.min != null && rule.min !== '' && abs < rule.min) return false;
    if (rule.max != null && rule.max !== '' && abs > rule.max) return false;
    return true;
  }

  /** Prima regola che corrisponde al movimento (l'ordine conta). */
  function ruleFor(t, rules) {
    return (rules || []).find(r => ruleMatches(r, t)) || null;
  }

  /** Movimenti modificabili dalle regole: attivi e NON classificati a mano da te. */
  function ruleCanTouch(t) {
    return t.state !== 'excluded' && t.classifiedBy !== 'user';
  }

  /**
   * Modifiche da applicare in automatico: per ogni movimento coperto da una
   * regola, i campi che la regola imposta e che oggi sono diversi.
   */
  function pendingRuleEdits(transactions, rules) {
    const out = [];
    if (!rules || !rules.length) return out;
    for (const t of transactions) {
      if (!ruleCanTouch(t)) continue;
      const r = ruleFor(t, rules);
      if (!r) continue;
      if (r.afterId && t.id <= r.afterId) continue; // regola valida solo per i movimenti arrivati dopo
      const edit = { id: t.id };
      let changed = false;
      for (const k of ['family', 'category', 'kind', 'accountUser', 'person']) {
        const v = r.set && r.set[k];
        if (!v) continue;
        if (k === 'accountUser' && t.account) continue; // il conto della banca ha la precedenza
        if (t[k] !== v) { edit[k] = v; changed = true; }
      }
      if (t.classifiedBy !== 'rule:' + r.id && changed) edit.classifiedBy = 'rule:' + r.id;
      if (changed) out.push(edit);
    }
    return out;
  }

  /** Crea una regola a partire da un movimento (precompilata). */
  function ruleFromTx(t, set) {
    return {
      id: U.uid(),
      name: mainToken(t),
      text: mainToken(t),
      field: 'any',
      sign: t.cents < 0 ? 'out' : 'in',
      account: '',
      min: '',
      max: '',
      set: Object.assign({}, set),
      enabled: true,
      created: U.today()
    };
  }

  /** Quanti movimenti corrisponderebbero a una regola (anteprima). */
  function ruleMatchesCount(rule, transactions) {
    return transactions.filter(t => t.state !== 'excluded' && ruleMatches(rule, t)).length;
  }

  // ---------------------------------------------------------------------
  // 4. Suggerimenti e informazioni mancanti
  // ---------------------------------------------------------------------

  /**
   * Memoria storica: per ogni controparte, la categoria scelta più spesso da te
   * (o dalle tue regole). Serve a proporre la stessa scelta ai movimenti simili.
   */
  function learnHistory(transactions) {
    const votes = {};
    for (const t of transactions) {
      if (t.classifiedBy !== 'user' && !String(t.classifiedBy || '').startsWith('rule:')) continue;
      if (!t.category || isGenericCategory(t.category)) continue;
      const k = merchantKey(t);
      if (!k) continue;
      const v = (votes[k] = votes[k] || {});
      const id = (t.family || '') + '\u0001' + t.category;
      v[id] = (v[id] || 0) + 1;
    }
    const best = {};
    for (const k in votes) {
      const [id, n] = Object.entries(votes[k]).sort((a, b) => b[1] - a[1])[0];
      const [family, category] = id.split('\u0001');
      best[k] = { family, category, count: n };
    }
    return best;
  }

  /**
   * Proposta per un movimento. Fonti in ordine di affidabilità:
   *  regola > scelte passate per la stessa controparte > dizionario > categoria banca.
   */
  function suggest(t, ctx) {
    const tax = ctx.taxonomy;
    const r = ruleFor(t, ctx.rules);
    if (r) {
      return { family: r.set.family || familyOfCategory(r.set.category, tax), category: r.set.category || t.category,
        source: 'rule', ruleId: r.id, confidence: 'alta', reason: 'regola "' + (r.name || r.text) + '"' };
    }
    const h = ctx.history && ctx.history[merchantKey(t)];
    if (h) {
      return { family: h.family || familyOfCategory(h.category, tax), category: h.category, source: 'history',
        confidence: h.count >= 2 ? 'alta' : 'media', reason: 'scelta ' + h.count + (h.count === 1 ? ' volta' : ' volte') + ' per questa controparte' };
    }
    const d = dictionaryMatch(t);
    if (d) {
      return { family: d.family, category: d.category, source: 'dictionary', keyword: d.keyword,
        confidence: 'media', reason: 'riconosciuto: ' + d.reason + ' ("' + d.keyword + '")' };
    }
    if (t.category && !isGenericCategory(t.category)) {
      const fam = familyOfCategory(t.category, tax);
      if (fam) return { family: fam, category: t.category, source: 'bank', confidence: 'media', reason: 'categoria della banca' };
    }
    return null;
  }

  /** Tipi di movimento per cui la categoria non è indispensabile. */
  const INTERNAL_KINDS = ['transfer', 'saving', 'investment'];
  /** Tipi per cui basta il conto (la categoria non serve). */
  const NO_CATEGORY_KINDS = INTERNAL_KINDS.concat(['withdrawal']);

  /**
   * Cosa manca a un movimento? Restituisce una lista tra:
   * 'family', 'category', 'account'.
   */
  function missingInfo(t, tax) {
    if (t.state !== 'active') return [];
    const miss = [];
    const internal = NO_CATEGORY_KINDS.includes(t.kind);
    if (!internal) {
      if (!t.category || isGenericCategory(t.category)) miss.push('category');
      if (!familyOf(t, tax)) miss.push('family');
    }
    if (!U.account(t)) miss.push('account');
    return miss;
  }

  /**
   * Lista degli "avvisi da completare": movimenti con informazioni mancanti,
   * ognuno con la proposta migliore e l'elenco dei movimenti simili.
   */
  function todoList(transactions, prefs) {
    const tax = taxonomy(prefs);
    const ctx = { taxonomy: tax, rules: (prefs && prefs.rules) || [], history: learnHistory(transactions) };
    const ignored = new Set((prefs && prefs.todoIgnored) || []);
    const items = [];
    const byKey = {};
    for (const t of transactions) {
      const miss = missingInfo(t, tax);
      if (!miss.length || ignored.has(t.id)) continue;
      // Manca solo la famiglia di una categoria della banca: si risolve una volta per tutte
      // nella scheda "Categorie banca" (bankCategoryGaps), non movimento per movimento.
      if (miss.length === 1 && miss[0] === 'family' && t.category && !t.family && !isGenericCategory(t.category)) continue;
      const item = { tx: t, missing: miss, suggestion: suggest(t, ctx), key: merchantKey(t) };
      items.push(item);
      (byKey[item.key] = byKey[item.key] || []).push(t.id);
    }
    for (const it of items) it.similar = (byKey[it.key] || []).filter(id => id !== it.tx.id);
    // Prima i più rilevanti: importo alto e date recenti
    items.sort((a, b) => b.tx.date.localeCompare(a.tx.date) || Math.abs(b.tx.cents) - Math.abs(a.tx.cents));
    return items;
  }

  // ---------------------------------------------------------------------
  // 5. Ricorrenze: pagamenti ripetuti verso la stessa controparte
  // ---------------------------------------------------------------------

  const CADENCES = [
    { name: 'settimanale', min: 5, max: 9, days: 7 },
    { name: 'mensile', min: 25, max: 35, days: 30 },
    { name: 'bimestrale', min: 55, max: 65, days: 61 },
    { name: 'trimestrale', min: 85, max: 97, days: 91 },
    { name: 'semestrale', min: 170, max: 195, days: 182 },
    { name: 'annuale', min: 350, max: 380, days: 365 }
  ];

  /**
   * Gruppi di pagamenti ripetuti. Un gruppo è "ricorrente" se ha almeno 3
   * movimenti (o 2 con cadenza riconoscibile) verso la stessa controparte.
   */
  function recurringGroups(transactions, prefs) {
    const rules = (prefs && prefs.rules) || [];
    const active = transactions.filter(t => t.state === 'active' && t.status !== 'NO'
      && t.cents !== 0 && !INTERNAL_KINDS.includes(t.kind));
    const groups = U.groupBy(active, t => (t.cents < 0 ? '-' : '+') + merchantKey(t));
    const out = [];
    for (const key in groups) {
      const list = groups[key].sort((a, b) => a.date.localeCompare(b.date));
      if (key.length < 3 || list.length < 2) continue;
      const gaps = list.slice(1).map((t, i) => U.daysBetween(list[i].date, t.date));
      const gap = U.median(gaps);
      const cadence = CADENCES.find(c => gap >= c.min && gap <= c.max) || null;
      const regular = cadence && gaps.filter(g => g >= cadence.min && g <= cadence.max).length >= Math.max(1, gaps.length * 0.6);
      if (!regular && list.length < 3) continue;
      const amounts = list.map(t => Math.abs(t.cents));
      const typical = U.median(amounts);
      const stable = amounts.filter(a => Math.abs(a - typical) <= Math.max(100, typical * 0.2)).length >= amounts.length * 0.6;
      const last = list[list.length - 1];
      const previous = list.length > 1 ? Math.abs(list[list.length - 2].cents) : typical;
      const rule = ruleFor(last, rules);
      out.push({
        key: key.slice(1),
        sign: key[0] === '-' ? 'out' : 'in',
        label: last.details || last.operation,
        token: mainToken(last),
        count: list.length,
        cadence: regular ? cadence.name : 'irregolare',
        cadenceDays: regular ? cadence.days : null,
        typical,
        stable,
        lastCents: Math.abs(last.cents),
        priceChange: stable && list.length >= 3 ? Math.abs(last.cents) - previous : 0,
        last: last.date,
        next: regular ? U.addDays(last.date, cadence.days) : null,
        monthly: regular ? Math.round(typical * 30 / cadence.days) : 0,
        ids: list.map(t => t.id),
        category: last.category,
        family: last.family,
        rule: rule ? rule.id : null,
        subscription: regular && stable && key[0] === '-'
      });
    }
    return out.sort((a, b) => b.monthly - a.monthly || b.count - a.count);
  }

  /** Gruppi ricorrenti senza regola: l'app propone di crearne una. */
  function ruleProposals(transactions, prefs) {
    const dismissed = new Set((prefs && prefs.ruleProposalsDismissed) || []);
    const tax = taxonomy(prefs);
    const byId = {};
    for (const t of transactions) byId[t.id] = t;
    // Proponiamo solo gruppi in cui almeno un movimento ha categoria o famiglia mancanti
    const incomplete = g => g.ids.some(id => {
      const t = byId[id], m = missingInfo(t, tax);
      if (m.includes('category')) return true;
      // famiglia mancante solo per una categoria della banca: si risolve in "Categorie banca"
      return m.includes('family') && !(t.category && !isGenericCategory(t.category));
    });
    return recurringGroups(transactions, prefs)
      .filter(g => !g.rule && !dismissed.has(g.key) && (g.cadence !== 'irregolare' || g.count >= 4) && incomplete(g));
  }

  /** Categorie della banca che non appartengono a nessuna famiglia: [[categoria, n], ...] */
  function bankCategoryGaps(transactions, prefs) {
    const tax = taxonomy(prefs);
    const out = {};
    for (const t of transactions) {
      if (t.state !== 'active' || !t.category || t.family || isGenericCategory(t.category)) continue;
      if (NO_CATEGORY_KINDS.includes(t.kind) || familyOfCategory(t.category, tax)) continue;
      out[t.category] = (out[t.category] || 0) + 1;
    }
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  }

  const Classify = {
    DEFAULT_TAXONOMY, DICTIONARY, merchantKey, mainToken, dictionaryMatch, taxonomy, familyOfCategory, familyOf,
    isGenericCategory, ruleWords, ruleMatches, ruleFor, pendingRuleEdits, ruleFromTx, ruleMatchesCount,
    learnHistory, suggest, missingInfo, todoList, bankCategoryGaps, recurringGroups, ruleProposals, INTERNAL_KINDS
  };
  root.Classify = Classify;
  if (typeof module !== 'undefined') module.exports = Classify;
})(typeof window === 'undefined' ? globalThis : window);
