/*
 * forecast.js - SPESE FISSE E PREVISIONI: una base reale per ragionare sul futuro.
 *
 * Una VOCE di previsione è una spesa (o un bonus) che si ripete nel tempo:
 *   {
 *     id, name,
 *     section:  'expense' (spese) | 'bonus' (entrate che compensano)
 *     kind:     'expense' spesa | 'saving' accantonamento o investimento | 'income' entrata
 *     amount:   importo di OGNI pagamento, in centesimi
 *     every:    ogni quanti mesi si paga (1 = ogni mese, 12 = ogni anno, 48 = ogni 4 anni)
 *     month:    mese del pagamento (1-12) per le spese non mensili; 0 = non indicato
 *     family, category:  le stesse famiglie e categorie dei movimenti
 *     match:    parole per ritrovarla nei movimenti (facoltativo, come in "Cerca e somma")
 *     note, active (false = esclusa dai calcoli, per fare delle prove)
 *   }
 *
 * Qui ci sono solo calcoli, senza grafica (testati in tests/forecast.test.js):
 *   1. PERIODICITÀ: importo equivalente al mese e all'anno
 *   2. LETTURA DI UN ELENCO incollato ("Mutuo — 600 €", "Annuale", "BONUS:" ...)
 *   3. FAMIGLIA E CATEGORIA proposte, coerenti con quelle dei movimenti
 *   4. CONFRONTO CON IL REALE: previsioni ottimistiche, pessimistiche o coerenti
 *   5. PROSSIMI 12 MESI: quanto uscirà mese per mese e quanto mettere da parte
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const C = root.Classify || require('./classify.js');
  const F = root.Finance || require('./finance.js');
  const SR = root.Search || require('./search.js');

  // -------------------------------------------------------------------
  // 1. Periodicità
  // -------------------------------------------------------------------

  /** Periodicità proposte nei menu: [mesi, nome]. */
  const PERIODS = [
    [1, 'Mensile'], [2, 'Bimestrale'], [3, 'Trimestrale'], [4, 'Quadrimestrale'], [6, 'Semestrale'],
    [12, 'Annuale'], [24, 'Ogni 2 anni'], [36, 'Ogni 3 anni'], [48, 'Ogni 4 anni'], [60, 'Ogni 5 anni'],
    [72, 'Ogni 6 anni'], [96, 'Ogni 8 anni'], [120, 'Ogni 10 anni'], [180, 'Ogni 15 anni'], [240, 'Ogni 20 anni']
  ];

  /** Nome della periodicità: 1 → "Mensile", 48 → "Ogni 4 anni", 5 → "Ogni 5 mesi". */
  function periodName(every) {
    const p = PERIODS.find(x => x[0] === every);
    if (p) return p[1];
    return every % 12 === 0 ? 'Ogni ' + every / 12 + ' anni' : 'Ogni ' + every + ' mesi';
  }

  /** Gruppi in cui mostrare le voci, dal più frequente: [nome, da mesi, a mesi]. */
  const GROUPS = [
    ['Mensile', 1, 1], ['Ogni 2-4 mesi', 2, 5], ['Semestrale', 6, 11], ['Annuale', 12, 23],
    ['Ogni 2-3 anni', 24, 47], ['Ogni 4 anni e oltre', 48, Infinity]
  ];
  const groupOf = every => (GROUPS.find(g => every >= g[1] && every <= g[2]) || GROUPS[0])[0];

  /** Quanto pesa una voce in un mese (centesimi, con decimali: arrotonda solo chi mostra). */
  const monthly = it => (it.amount || 0) / Math.max(1, it.every || 1);
  const isOn = it => it.active !== false && (it.amount || 0) > 0;

  /**
   * Totali delle voci attive, al mese:
   *   expense (spese), saving (accantonamenti), bonus, out (spese + accantonamenti),
   *   net (out − bonus), setAside (quota delle voci non mensili da mettere da parte)
   */
  function totals(items) {
    const on = items.filter(isOn);
    const sum = f => Math.round(on.filter(f).reduce((s, it) => s + monthly(it), 0));
    const expense = sum(it => it.section !== 'bonus' && it.kind !== 'saving');
    const saving = sum(it => it.section !== 'bonus' && it.kind === 'saving');
    const bonus = sum(it => it.section === 'bonus');
    const setAside = sum(it => it.section !== 'bonus' && it.every > 1);
    return { expense, saving, bonus, out: expense + saving, net: expense + saving - bonus, setAside };
  }

  // -------------------------------------------------------------------
  // 2. Lettura di un elenco incollato
  // -------------------------------------------------------------------

  // Un importo con il simbolo dell'euro: "600 €", "+140€", "25.000 €", "34,20 €", "€ 50"
  const AMOUNT_AFTER = /([+-]?)\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(?:€|euro\b|eur\b)/i;
  const AMOUNT_BEFORE = /([+-]?)\s*€\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/i;
  // Separatore tra nome e importo: "Mutuo — 600 €", "Mutuo - 600", "Mutuo: 600"
  const SEPARATOR = /\s[—–-]\s|\s[—–]|[—–]\s|:\s/;

  const cents = (int, dec) => Number(String(int).replace(/\./g, '')) * 100 + (dec ? Number(dec.padEnd(2, '0')) : 0);

  /** Periodicità scritta nel testo ("al mese", "ogni 4 anni", "anno"...), o 0. */
  function periodInText(s) {
    let m;
    if ((m = s.match(/ogni\s+(\d+)\s+ann/))) return Number(m[1]) * 12;
    if ((m = s.match(/ogni\s+(\d+)\s+mes/))) return Number(m[1]);
    if (/settiman/.test(s)) return -1;                       // settimanale: convertita a mensile
    if (/semestr/.test(s)) return 6;
    if (/trimestr/.test(s)) return 3;
    if (/bimestr/.test(s)) return 2;
    if (/(^|[\s/])(al mese|mese|mensil[ei])\b/.test(s)) return 1;
    if (/(^|[\s/])(all'?anno|l'anno|anno|annu[aoe]|annuale|annuali)\b/.test(s)) return 12;
    return 0;
  }

  /** Riga di intestazione ("Mensile (al mese)", "Annuale", "BONUS:")? */
  function headerOf(line) {
    const s = U.norm(line.replace(/\([^)]*\)/g, '')).replace(/[:.]+$/, '').trim();
    if (!s || s.length > 40 || SEPARATOR.test(line)) return null;
    if (/\b(bonus|entrate|introiti|contributi)\b/.test(s)) return { section: 'bonus', every: 1 };
    const every = /quinquennal/.test(s) ? 60 : /quadriennal/.test(s) ? 48 : /triennal/.test(s) ? 36
      : /biennal|ogni 2 anni/.test(s) ? 24 : /annual|annu|all'?anno/.test(s) ? 12 : /semestr/.test(s) ? 6
        : /quadrimestr/.test(s) ? 4 : /trimestr/.test(s) ? 3 : /bimestr/.test(s) ? 2 : /mensil|al mese/.test(s) ? 1 : 0;
    if (every) return { section: 'expense', every };
    if (/^(spese|uscite|costi)\b/.test(s)) return { section: 'expense', every: 1 };
    return null;
  }

  /**
   * Legge un elenco scritto liberamente, una voce per riga. Capisce:
   *   - intestazioni di periodicità: "Mensile", "Semestrale", "Annuale",
   *     "Biennale", "Quadriennale e oltre"; "BONUS:" apre la sezione dei bonus
   *   - voci: "Mutuo — 600 €", "Assegno unico +140€ mese", "Gomme — 600 € ogni 4 anni"
   *   - note tra parentesi: "(una volta l'anno)" cambia anche la periodicità
   *   - voci senza importo ("Scuola materna — da valutare"): importo 0, escluse
   * Le righe che non sembrano voci (frasi, titoli) vengono ignorate.
   * Restituisce [{ name, amount, every, section, note, active, line }]
   */
  function parseList(text) {
    const out = [];
    let section = 'expense', every = 1;
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.replace(/[’`´]/g, '\'').replace(/^\s*(?:[•*·]|-(?=\s)|\d+[.)](?=\s))\s*/, '').trim();
      if (!line) continue;
      const head = headerOf(line);
      if (head && !AMOUNT_AFTER.test(line) && !AMOUNT_BEFORE.test(line)) { section = head.section; every = head.every; continue; }

      // Le note tra parentesi si mettono da parte: non devono confondere importo e periodicità
      const notes = [];
      const plain = line.replace(/\(([^)]*)\)/g, (_, n) => { notes.push(n.trim()); return ' '; }).replace(/\s+/g, ' ').trim();
      let m = plain.match(AMOUNT_AFTER) || plain.match(AMOUNT_BEFORE);
      let name, rest, amount = 0, sign = '';
      if (m) {
        sign = m[1];
        amount = cents(m[2], m[3]);
        name = plain.slice(0, m.index);
        rest = plain.slice(m.index + m[0].length);
      } else {
        // Senza simbolo dell'euro: "Internet - 30" (numero subito dopo il separatore)
        const sep = plain.match(SEPARATOR);
        if (!sep) continue;                                   // frase qualsiasi: ignorata
        name = plain.slice(0, sep.index);
        rest = plain.slice(sep.index + sep[0].length);
        const n = rest.match(/^\s*([+-]?)\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\b/);
        if (n) { sign = n[1]; amount = cents(n[2], n[3]); rest = rest.slice(n[0].length); }
        // Voce senza importo ("Scuola materna — da valutare"): solo con un trattino e un nome breve
        else if (sep[0].includes(':') || name.trim().split(/\s+/).length > 5) continue;
      }
      name = name.replace(/[\s—–\-:,;+=]+$/, '').replace(/^[\s—–\-:,;+=]+/, '').trim();
      if (!name || name.length > 60) continue;

      const restNorm = U.norm(rest);
      const noteNorm = U.norm(notes.join(' '));
      let itemEvery = periodInText(restNorm) || every;
      // "(una volta l'anno)" nella nota vince sull'intestazione
      if (/una volta (all'?|l')?anno|ogni anno/.test(noteNorm)) itemEvery = 12;
      else if (/due volte (all'?|l')?anno/.test(noteNorm)) itemEvery = 6;
      else { const y = noteNorm.match(/ogni (\d+) anni/); if (y) itemEvery = Number(y[1]) * 12; }
      if (itemEvery === -1) { amount = Math.round(amount * 52 / 12); itemEvery = 1; notes.unshift('settimanale'); }

      // Quello che resta dopo l'importo e non è una periodicità diventa nota ("a rata", "circa")
      const extra = rest.replace(/ogni\s+\d+\s+(anni|mesi)|al mese|all'anno|\/?mese|\/?anno|mensil[ei]|annual[ei]|[—–\-:,;]/gi, ' ').replace(/\s+/g, ' ').trim();
      const note = [extra, ...notes].filter(Boolean).join(' · ');
      out.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        amount,
        every: itemEvery,
        section: sign === '+' ? 'bonus' : section,
        note,
        active: amount > 0,
        line: raw.trim()
      });
    }
    return out;
  }

  // -------------------------------------------------------------------
  // 3. Famiglia e categoria proposte
  // -------------------------------------------------------------------

  /*
   * Parole tipiche dei nomi delle voci → [famiglia, categoria, tipo].
   * Le famiglie e categorie sono quelle predefinite dei movimenti (classify.js),
   * più poche nuove dove non c'era una categoria adatta.
   * Scrittura delle parole: "gas" = parola esatta, "pannolin*" = parola che
   * inizia così, "spesa alimentare" = frase intera. Vince la prima che corrisponde.
   */
  const EXPENSE_MAP = [
    [['fondo pensione', 'previdenza complementare', 'pensione integrativa'], 'Movimenti interni', 'Fondo pensione', 'saving'],
    [['investiment*', 'pac', 'etf', 'piano di accumulo'], 'Movimenti interni', 'Investimenti', 'saving'],
    [['emergenz*', 'risparmi*', 'accantonament*', 'salvadanaio'], 'Movimenti interni', 'Risparmio', 'saving'],
    [['superflash', 'prepagat*', 'ricarica carta', 'paghetta'], 'Persona e famiglia', 'Ricariche carte prepagate'],
    [['mutuo', 'mutui', 'affitto', 'affitti', 'locazione'], 'Casa', 'Mutuo e affitto'],
    [['condomin*', 'amministratore'], 'Casa', 'Condominio'],
    [['caldaia', 'canna fumaria', 'fumi', 'spazzacamino', 'manutenzione casa', 'idraulico', 'elettricista'], 'Casa', 'Manutenzione'],
    [['gasolio', 'benzina', 'diesel', 'carburant*', 'rifornim*', 'gpl', 'metano'], 'Trasporti', 'Carburante'],
    [['bolletta', 'bollette', 'gas', 'luce', 'energia', 'acqua', 'utenz*', 'tari', 'legna', 'pellet', 'riscaldament*', 'teleriscaldamento'], 'Casa', 'Utenze'],
    [['elettrodomestic*', 'arredament*', 'mobili'], 'Casa', 'Arredamento'],
    [['spesa alimentare', 'supermercat*', 'alimentar*'], 'Alimentari', 'Supermercato'],
    [['nido', 'asilo', 'materna', 'scuola', 'bimba', 'bimbo', 'bambin*', 'figli*', 'pannolin*', 'neonat*', 'baby*', 'mensa', 'babysitter', 'tata'], 'Persona e famiglia', 'Figli e scuola'],
    [['telepass', 'pedagg*', 'parchegg*', 'autostrad*'], 'Trasporti', 'Pedaggi e parcheggi'],
    [['rca', 'assicurazione auto', 'assicuraz*', 'polizza', 'polizze'], 'Finanza e tasse', 'Assicurazioni'],
    [['bollo auto', 'imu', 'tasi', 'f24', 'tasse', 'tassa', 'imposte', 'caf', '730', 'commercialista', 'dichiarazione'], 'Finanza e tasse', 'Tasse e imposte'],
    [['imposta di bollo', 'commission*', 'canone conto', 'conto e carte', 'canone carta', 'canoni'], 'Finanza e tasse', 'Commissioni bancarie'],
    [['tagliand*', 'revision*', 'gomme', 'pneumatic*', 'batteria auto', 'manutenzione macchina', 'manutenzione auto', 'meccanic*', 'officina',
      'carrozzeria', 'cambio auto', 'auto nuova', 'patente', 'macchina', 'auto', 'moto'], 'Trasporti', 'Auto e moto'],
    [['treno', 'treni', 'autobus', 'bus', 'abbonamento trasporti', 'mezzi pubblici'], 'Trasporti', 'Mezzi pubblici'],
    [['abbonamento ai', 'intelligenza artificiale', 'chatgpt', 'claude'], 'Tecnologia e abbonamenti', 'AI'],
    [['streaming', 'netflix', 'spotify', 'disney', 'dazn'], 'Tecnologia e abbonamenti', 'Streaming'],
    [['cloud', 'software', 'icloud', 'dropbox'], 'Tecnologia e abbonamenti', 'Software e cloud'],
    [['internet', 'cellular*', 'telefon*', 'fibra', 'wifi', 'sim'], 'Tecnologia e abbonamenti', 'Telefonia e internet'],
    [['elettronica', 'computer', 'smartphone'], 'Tecnologia e abbonamenti', 'Elettronica'],
    [['acquisti online', 'online', 'amazon', 'ecommerce'], 'Shopping', 'Shopping online'],
    [['farmacia', 'farmaci', 'medicin*'], 'Salute e benessere', 'Farmacia'],
    [['dentist*', 'visit*', 'occhial*', 'medic*', 'oculist*', 'analisi', 'ticket'], 'Salute e benessere', 'Visite mediche'],
    [['parrucchier*', 'barbiere', 'estetist*', 'cosmetic*'], 'Persona e famiglia', 'Cura della persona'],
    [['palestra', 'piscina', 'sport'], 'Salute e benessere', 'Sport e palestra'],
    [['ferie', 'vacanz*', 'viagg*', 'hotel', 'voli'], 'Svago e viaggi', 'Viaggi'],
    [['weekend', 'gite', 'gita', 'uscite', 'svago'], 'Svago e viaggi', 'Weekend e uscite'],
    [['skipass', 'sci', 'montagna', 'bici', 'bicicletta', 'quote associative', 'associazion*', 'cai', 'hobby', 'tessera'], 'Svago e viaggi', 'Hobby'],
    [['ristorant*', 'pizzeri*', 'bar', 'aperitiv*'], 'Ristoranti e bar', 'Ristoranti'],
    [['abbigliament*', 'vestiti', 'scarpe'], 'Persona e famiglia', 'Abbigliamento'],
    [['regal*', 'compleann*', 'natale'], 'Persona e famiglia', 'Regali'],
    [['veterinari*', 'cane', 'gatto', 'animal*'], 'Persona e famiglia', 'Animali'],
    [['prestito', 'finanziamento', 'rata'], 'Finanza e tasse', 'Prestiti e rate'],
    [['spesa'], 'Alimentari', 'Supermercato']                        // "fare la spesa": solo se nient'altro corrisponde
  ];

  const INCOME_MAP = [
    [['stipendio', 'stipendi', 'busta paga', 'pensione'], 'Entrate', 'Stipendio'],
    [['assegno unico', 'assegn*', 'bonus*', 'inps', 'contribut*', 'sussidi*'], 'Entrate', 'Assegni e bonus'],
    [['genitor*', 'nonni', 'aiut*', 'regal*', 'famiglia'], 'Entrate', 'Regali ricevuti'],
    [['730', 'rimbors*'], 'Entrate', 'Rimborsi ricevuti'],
    [['affitto', 'affitti', 'locazione'], 'Entrate', 'Affitti incassati']
  ];

  function keywordHit(norm, tokens, kw) {
    if (kw.includes(' ')) return (' ' + norm + ' ').includes(' ' + kw + ' ');
    if (kw.endsWith('*')) return tokens.some(t => t.startsWith(kw.slice(0, -1)));
    return tokens.includes(kw);
  }

  /**
   * Adatta [famiglia, categoria] alla tassonomia attuale: se la categoria
   * esiste già (anche in una famiglia rinominata da te) usa quella.
   * isNew = true se la categoria (o la famiglia) andrà creata.
   */
  function resolve(family, category, tax) {
    if (!category) return { family: '', category: '', isNew: false };
    const cat = U.norm(category);
    for (const f of tax || []) {
      const hit = f.categories.find(c => U.norm(c) === cat);
      if (hit) return { family: f.family, category: hit, isNew: false };
    }
    const fam = (tax || []).find(f => U.norm(f.family) === U.norm(family));
    return { family: fam ? fam.family : family, category, isNew: true };
  }

  /**
   * Famiglia, categoria e tipo proposti per una voce dal suo nome.
   * Per le spese, se le parole della previsione non bastano, usa lo stesso
   * dizionario con cui l'app classifica i movimenti (es. "Telepass").
   * Restituisce { family, category, kind, isNew } (vuoti se non trova nulla).
   */
  function guess(name, section, tax) {
    const norm = U.norm(String(name).replace(/[/+&,]/g, ' ')).replace(/\s+/g, ' ');
    const tokens = norm.split(' ').filter(Boolean);
    const map = section === 'bonus' ? INCOME_MAP : EXPENSE_MAP;
    for (const [words, family, category, kind] of map) {
      if (words.some(w => keywordHit(norm, tokens, w))) {
        return Object.assign(resolve(family, category, tax), { kind: section === 'bonus' ? 'income' : kind || 'expense' });
      }
    }
    if (section === 'bonus') return Object.assign(resolve('Entrate', 'Altre entrate', tax), { kind: 'income' });
    const d = C.dictionaryMatch({ operation: '', details: name, note: '' });
    if (d) return Object.assign(resolve(d.family, d.category, tax), { kind: 'expense' });
    return { family: '', category: '', kind: 'expense', isNew: false };
  }

  // -------------------------------------------------------------------
  // 4. Confronto con il reale
  // -------------------------------------------------------------------

  /**
   * Gli ultimi n mesi COMPLETI con movimenti (il mese in corso è escluso).
   * gaps: l'analisi dei buchi di importazione (Gaps.analyze), se c'è:
   * contano solo i mesi dentro il periodo coperto dai file e senza buchi
   * importanti (quelli di uno-tre giorni, nei fine settimana o segnati come
   * "non è un buco" non escludono il mese).
   * Restituisce { list: ['2025-11', ...], months, from, to, skipped }
   * (skipped: i mesi tra il primo e l'ultimo lasciati fuori per i buchi).
   */
  function lastMonths(transactions, gaps, n, todayIso) {
    const current = String(todayIso || U.today()).slice(0, 7);
    let list = [...new Set(transactions.filter(t => t.state === 'active').map(t => t.date.slice(0, 7)))].filter(m => m < current).sort();
    if (gaps && gaps.first && gaps.last) {
      const serious = (gaps.gaps || []).filter(g => g.level === 'critica' || g.level === 'alta' || g.level === 'media');
      list = list.filter(m => {
        const start = m + '-01', end = SR.monthEnd(m);
        return gaps.first <= start && gaps.last >= end && !serious.some(g => g.start <= end && g.end >= start);
      });
    }
    list = list.slice(-n);
    const skipped = list.length ? SR.monthsBetween(list[0], list[list.length - 1]).filter(m => !list.includes(m)) : [];
    return { list, months: list.length, from: list.length ? list[0] + '-01' : '', to: list.length ? SR.monthEnd(list[list.length - 1]) : '', skipped };
  }

  /**
   * Movimenti reali dei mesi scelti, divisi in spese, accantonamenti ed
   * entrate, per famiglia e categoria. Le spese sono contate come nella
   * Panoramica dell'Analisi (spese contabilizzate + contanti non tracciati),
   * meno i rimborsi ricevuti.
   */
  function actuals(transactions, ctx, monthList) {
    const inWindow = new Set(monthList);
    const tax = (ctx && ctx.taxonomy) || [];
    const alloc = F.cashAllocation((ctx && ctx.all) || transactions, (ctx && ctx.links) || []);
    const buckets = { expense: new Map(), saving: new Map(), income: new Map() };
    const add = (b, family, category, value, id) => {
      if (!value) return;
      const f = buckets[b].get(family) || { total: 0, cats: new Map(), ids: [] };
      f.total += value;
      f.cats.set(category, (f.cats.get(category) || 0) + value);
      f.ids.push(id);
      buckets[b].set(family, f);
    };
    for (const t of transactions) {
      if (!inWindow.has(t.date.slice(0, 7)) || !F.booked(t)) continue;
      const family = C.familyOf(t, tax) || 'Senza famiglia';
      const category = t.category || 'Da classificare';
      if (t.kind === 'expense' || t.kind === 'refund') add('expense', family, category, -t.cents, t.id);
      else if (t.kind === 'withdrawal') add('expense', 'Contanti non tracciati', 'Contanti non tracciati', alloc[t.id] ? alloc[t.id].free : -t.cents, t.id);
      else if (t.kind === 'saving' || t.kind === 'investment') add('saving', family, category, -t.cents, t.id);
      else if (t.kind === 'income') add('income', family, category, t.cents, t.id);
    }
    return buckets;
  }

  /**
   * Giudizio su una previsione confrontata con il reale (valori al mese).
   *   side 'out' (spese): reale > previsto = previsione OTTIMISTICA
   *   side 'in' (entrate): reale < previsto = previsione OTTIMISTICA
   * Coerente se la differenza sta entro il 10% (e comunque entro 15 € al mese).
   * code: coherent | optimistic | pessimistic | missing (non prevista) | unseen (mai vista)
   */
  function verdict(forecast, actual, side) {
    const diff = actual - forecast;
    const pct = forecast > 0 ? diff / forecast : null;
    let code;
    if (forecast <= 0 && actual <= 0) code = 'none';
    else if (forecast <= 0) code = 'missing';
    else if (actual <= 0) code = 'unseen';
    else if (Math.abs(diff) <= Math.max(forecast * 0.10, 1500)) code = 'coherent';
    else code = (diff > 0) === (side !== 'in') ? 'optimistic' : 'pessimistic';
    return { code, diff, pct, strong: pct !== null && Math.abs(pct) > 0.3 };
  }

  /**
   * CONFRONTO tra previsioni e movimenti reali degli ultimi mesi.
   *   items: le voci; transactions: tutti i movimenti
   *   ctx: { links, all, taxonomy }; win: risultato di lastMonths()
   *   opts.excludeRare: lascia fuori le spese che si pagano più di rado del
   *     periodo confrontato (es. cambio auto ogni 10 anni su 12 mesi di dati)
   * Tutti gli importi restituiti sono AL MESE, in centesimi.
   * Per spese e bonus "ottimistica" = la realtà è peggiore della previsione
   * (spendi di più, incassi di meno); per gli accantonamenti = metti da parte meno.
   */
  function compare(items, transactions, ctx, win, opts) {
    const months = Math.max(1, win.months);
    const act = actuals(transactions, ctx, win.list);
    const isRare = it => it.section !== 'bonus' && it.every > win.months;
    const rare = items.filter(it => isOn(it) && isRare(it));
    const on = items.filter(it => isOn(it) && !(opts && opts.excludeRare && isRare(it)));
    const perMonth = v => Math.round(v / months);

    /** Righe per famiglia (con le categorie) di un tipo di voci. */
    function rows(bucket, itemFilter, side) {
      const fam = new Map();
      const row = f => {
        if (!fam.has(f)) fam.set(f, { family: f, forecast: 0, actual: 0, items: [], cats: new Map(), ids: [] });
        return fam.get(f);
      };
      const cat = (r, c) => {
        if (!r.cats.has(c)) r.cats.set(c, { category: c, forecast: 0, actual: 0, items: [] });
        return r.cats.get(c);
      };
      for (const it of on.filter(itemFilter)) {
        const r = row(it.family || 'Senza famiglia');
        r.forecast += monthly(it);
        r.items.push(it);
        const c = cat(r, it.category || 'Da classificare');
        c.forecast += monthly(it);
        c.items.push(it);
      }
      for (const [f, a] of act[bucket]) {
        const r = row(f);
        r.actual += a.total;
        r.ids = a.ids;
        for (const [c, v] of a.cats) cat(r, c).actual += v;
      }
      return [...fam.values()].map(r => {
        r.forecast = Math.round(r.forecast);
        r.actual = perMonth(r.actual);
        r.verdict = verdict(r.forecast, r.actual, side);
        r.cats = [...r.cats.values()].map(c => Object.assign(c, { forecast: Math.round(c.forecast), actual: perMonth(c.actual) }))
          .map(c => Object.assign(c, { verdict: verdict(c.forecast, c.actual, side) }))
          .sort((a, b) => Math.max(b.forecast, b.actual) - Math.max(a.forecast, a.actual));
        return r;
      }).filter(r => r.forecast > 0 || r.actual > 0)
        .sort((a, b) => Math.abs(b.actual - b.forecast) - Math.abs(a.actual - a.forecast));
    }

    const expenseRows = rows('expense', it => it.section !== 'bonus' && it.kind !== 'saving', 'out');
    const savingRows = rows('saving', it => it.section !== 'bonus' && it.kind === 'saving', 'in');
    // Per i bonus contano solo le entrate reali nelle categorie dei bonus (non lo stipendio)
    const bonusCats = new Set(on.filter(it => it.section === 'bonus').map(it => it.category));
    const incomeRows = rows('income', it => it.section === 'bonus', 'in')
      .map(r => {
        const cats = r.cats.filter(c => c.forecast > 0 || bonusCats.has(c.category));
        const actual = cats.reduce((s, c) => s + c.actual, 0);
        return Object.assign(r, { cats, actual, verdict: verdict(r.forecast, actual, 'in') });
      }).filter(r => r.forecast > 0);

    const sum = (list, k) => list.reduce((s, r) => s + r[k], 0);
    const t = totals(on);
    const expenseActual = sum(expenseRows, 'actual');
    const savingActual = sum(savingRows, 'actual');
    const bonusActual = sum(incomeRows, 'actual');
    const incomeAll = perMonth([...act.income.values()].reduce((s, a) => s + a.total, 0));
    const unclassified = expenseRows.filter(r => r.family === 'Senza famiglia' || r.family === 'Contanti non tracciati').reduce((s, r) => s + r.actual, 0);

    // Voci con una parola di ricerca: confronto anche voce per voce
    const itemActual = on.filter(it => it.match).map(it => {
      const wanted = SR.parseQuery(it.match);
      const inWin = new Set(win.list);
      const hits = transactions.filter(x => inWin.has(x.date.slice(0, 7)) && F.booked(x) && (it.section === 'bonus' ? x.cents > 0 : x.cents < 0)
        && SR.matchText([x.operation, x.details, x.note, (x.extra || {}).merchant].join(' '), wanted));
      const actual = perMonth(hits.reduce((s, x) => s + Math.abs(x.cents), 0));
      return { item: it, forecast: Math.round(monthly(it)), actual, ids: hits.map(x => x.id), verdict: verdict(Math.round(monthly(it)), actual, it.section === 'bonus' ? 'in' : 'out') };
    });

    return {
      months: win.months, from: win.from, to: win.to,
      expense: { forecast: t.expense, actual: expenseActual, verdict: verdict(t.expense, expenseActual, 'out'), rows: expenseRows },
      saving: { forecast: t.saving, actual: savingActual, verdict: verdict(t.saving, savingActual, 'in'), rows: savingRows },
      bonus: { forecast: t.bonus, actual: bonusActual, verdict: verdict(t.bonus, bonusActual, 'in'), rows: incomeRows },
      incomeAll,
      unplanned: expenseRows.filter(r => r.verdict.code === 'missing'),
      unseen: expenseRows.concat(savingRows).filter(r => r.verdict.code === 'unseen'),
      unclassifiedShare: expenseActual > 0 ? unclassified / expenseActual : 0,
      // Voci che si pagano più di rado del periodo confrontato (escluse se opts.excludeRare)
      rare, rareExcluded: !!(opts && opts.excludeRare),
      itemActual
    };
  }

  // -------------------------------------------------------------------
  // 5. Prossimi mesi
  // -------------------------------------------------------------------

  /**
   * Uscite previste mese per mese a partire da startYm ("AAAA-MM").
   *   base:      voci mensili
   *   due:       voci non mensili con il mese di pagamento indicato, nel loro mese
   *   provision: le altre voci non mensili, divise sui mesi (quota da accantonare)
   *   bonus:     bonus del mese (stessa logica)
   */
  function projection(items, startYm, n) {
    const on = items.filter(isOn);
    const out = [];
    for (let i = 0; i < (n || 12); i++) {
      const ym = SR.shiftMonth(startYm, i);
      const m = Number(ym.slice(5, 7));
      const r = { month: ym, base: 0, due: 0, provision: 0, bonus: 0, dueItems: [] };
      for (const it of on) {
        const every = Math.max(1, it.every || 1);
        let value = 0, kind;
        if (every === 1) { value = it.amount; kind = 'base'; }
        else if (every <= 12 && it.month >= 1 && it.month <= 12) {
          if (((m - it.month) % every + every) % every === 0) { value = it.amount; kind = 'due'; }
        } else { value = it.amount / every; kind = 'provision'; }
        if (!value) continue;
        if (it.section === 'bonus') { r.bonus += value; continue; }
        r[kind] += value;
        if (kind === 'due') r.dueItems.push(it.name);
      }
      for (const k of ['base', 'due', 'provision', 'bonus']) r[k] = Math.round(r[k]);
      r.out = r.base + r.due + r.provision;
      r.net = r.out - r.bonus;
      out.push(r);
    }
    return out;
  }

  /** Le voci non mensili più pesanti, con la quota mensile da accantonare. */
  function setAsideList(items) {
    return items.filter(it => isOn(it) && it.section !== 'bonus' && it.every > 1)
      .map(it => ({ item: it, monthly: Math.round(monthly(it)) }))
      .sort((a, b) => b.monthly - a.monthly);
  }

  /** Cadenza delle spese ricorrenti trovate nei movimenti → periodicità in mesi. */
  const CADENCE_EVERY = { settimanale: -1, mensile: 1, bimestrale: 2, trimestrale: 3, semestrale: 6, annuale: 12 };

  const Forecast = {
    PERIODS, GROUPS, periodName, groupOf, monthly, isOn, totals,
    parseList, periodInText, guess, resolve, EXPENSE_MAP, INCOME_MAP,
    lastMonths, actuals, verdict, compare, projection, setAsideList, CADENCE_EVERY
  };
  root.Forecast = Forecast;
  if (typeof module !== 'undefined') module.exports = Forecast;
})(typeof window === 'undefined' ? globalThis : window);
