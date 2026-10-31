/*
 * search.js - CERCA E SOMMA: quanto ho speso per...?
 *
 * Tre pezzi, tutti senza grafica (testati in tests/search.test.js):
 *
 *  1. PERIODI: "da sempre", "questo mese", "ultimi 12 mesi", "anno 2025",
 *     un mese preciso o date scelte da te. range() li trasforma in
 *     { from, to } (date "AAAA-MM-GG"; vuoto = nessun limite).
 *
 *  2. RICERCA nel testo, con regole semplici:
 *       netflix            contiene "netflix"
 *       amazon prime       contiene TUTTE le parole
 *       netflix, spotify   contiene l'una O l'altra (separate da virgola)
 *       amazon -prime      contiene "amazon" ma NON "prime"
 *     Maiuscole e accenti non contano.
 *
 *  3. SOMME: totale uscite, entrate, saldo, media al mese e ripartizioni per
 *     mese, famiglia, categoria e soggetto.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  // -------------------------------------------------------------------
  // 1. Periodi
  // -------------------------------------------------------------------

  const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const pad = n => String(n).padStart(2, '0');

  /** Ultimo giorno del mese "AAAA-MM" → "AAAA-MM-GG". */
  function monthEnd(ym) {
    const [y, m] = ym.split('-').map(Number);
    return ym + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate());
  }

  /** Mese spostato di "delta" mesi: shiftMonth('2026-01', -1) = '2025-12'. */
  function shiftMonth(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
  }

  function monthLabel(ym) {
    const [y, m] = ym.split('-');
    return MONTHS[Number(m) - 1] + ' ' + y;
  }

  /** Periodi pronti, nell'ordine in cui compaiono nel menu. */
  const PRESETS = [
    ['all', 'Da sempre'], ['month', 'Questo mese'], ['prevMonth', 'Mese scorso'], ['last3', 'Ultimi 3 mesi'],
    ['last12', 'Ultimi 12 mesi'], ['year', 'Quest\'anno'], ['prevYear', 'Anno scorso'], ['custom', 'Date a scelta…']
  ];

  /**
   * Trasforma un periodo in date.
   *   preset: un id di PRESETS, oppure "m:AAAA-MM" (un mese) o "y:AAAA" (un anno)
   *   custom: { from, to } usato solo con 'custom'
   * Restituisce { from, to, label }.
   */
  function range(preset, todayIso, custom) {
    const ym = todayIso.slice(0, 7), y = todayIso.slice(0, 4);
    const month = m => ({ from: m + '-01', to: monthEnd(m), label: monthLabel(m) });
    if (!preset || preset === 'all') return { from: '', to: '', label: 'Da sempre' };
    if (preset.startsWith('m:')) return month(preset.slice(2));
    if (preset.startsWith('y:')) return { from: preset.slice(2) + '-01-01', to: preset.slice(2) + '-12-31', label: 'anno ' + preset.slice(2) };
    switch (preset) {
      case 'month': return month(ym);
      case 'prevMonth': return month(shiftMonth(ym, -1));
      case 'last3': return { from: shiftMonth(ym, -2) + '-01', to: monthEnd(ym), label: 'ultimi 3 mesi' };
      case 'last12': return { from: shiftMonth(ym, -11) + '-01', to: monthEnd(ym), label: 'ultimi 12 mesi' };
      case 'year': return { from: y + '-01-01', to: y + '-12-31', label: 'anno ' + y };
      case 'prevYear': return { from: (y - 1) + '-01-01', to: (y - 1) + '-12-31', label: 'anno ' + (y - 1) };
      case 'custom': {
        const c = custom || {};
        const from = c.from || '', to = c.to || '';
        return { from, to, label: (from ? 'dal ' + from.split('-').reverse().join('/') : 'dall\'inizio') + ' ' + (to ? 'al ' + to.split('-').reverse().join('/') : 'a oggi') };
      }
      default: return { from: '', to: '', label: 'Da sempre' };
    }
  }

  /** Il periodo è esattamente un mese? Restituisce "AAAA-MM" oppure ''. */
  function singleMonth(r) {
    if (!r.from || !r.to || r.from.slice(8) !== '01') return '';
    const ym = r.from.slice(0, 7);
    return r.to === monthEnd(ym) ? ym : '';
  }

  function inRange(date, r) {
    return (!r.from || date >= r.from) && (!r.to || date <= r.to);
  }

  // -------------------------------------------------------------------
  // 2. Ricerca nel testo
  // -------------------------------------------------------------------

  /**
   * Prepara la ricerca: { groups: [[parole tutte presenti], ...], exclude: [...] }
   * Basta che UN gruppo corrisponda (le virgole separano i gruppi).
   */
  function parseQuery(query) {
    const exclude = [];
    const groups = String(query || '').split(',').map(part => U.norm(part).split(' ').filter(w => {
      if (w.startsWith('-') && w.length > 1) { exclude.push(w.slice(1)); return false; }
      return w && w !== '-';
    })).filter(g => g.length);
    return { groups, exclude };
  }

  /** true se il testo soddisfa la ricerca (ricerca vuota = tutto). */
  function matchText(text, query) {
    const q = typeof query === 'string' ? parseQuery(query) : query;
    const t = U.norm(text);
    if (q.exclude.some(w => t.includes(w))) return false;
    return !q.groups.length || q.groups.some(g => g.every(w => t.includes(w)));
  }

  // -------------------------------------------------------------------
  // 3. Somme
  // -------------------------------------------------------------------

  /** Mesi da "a" a "b" compresi: ['2026-01', '2026-02', ...]. */
  function monthsBetween(a, b) {
    const out = [];
    for (let m = a; m <= b && out.length < 600; m = shiftMonth(m, 1)) out.push(m);
    return out;
  }

  /**
   * Riepilogo di una lista di movimenti.
   *   sign: -1 = conta le uscite, 1 = le entrate, 0 = tutto (le uscite in positivo)
   *   by:   funzioni che danno l'etichetta di un movimento:
   *         { family(t), category(t), subject(t) }
   * Le ripartizioni sono liste [etichetta, centesimi] dalla più grande.
   */
  function summarize(list, sign, by) {
    by = by || {};
    const out = U.sum(list.filter(t => t.cents < 0), t => -t.cents);
    const inc = U.sum(list.filter(t => t.cents > 0), t => t.cents);
    const value = t => (sign === 1 ? Math.max(0, t.cents) : sign === -1 ? Math.max(0, -t.cents) : -t.cents);
    const dates = list.map(t => t.date).sort();
    const months = dates.length ? monthsBetween(dates[0].slice(0, 7), dates[dates.length - 1].slice(0, 7)) : [];
    const total = U.sum(list, value);

    const group = fn => {
      const m = new Map();
      for (const t of list) {
        const k = (fn && fn(t)) || '—';
        m.set(k, (m.get(k) || 0) + value(t));
      }
      return [...m.entries()].filter(e => e[1] !== 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    };
    const byMonth = new Map(months.map(m => [m, 0]));
    for (const t of list) byMonth.set(t.date.slice(0, 7), (byMonth.get(t.date.slice(0, 7)) || 0) + value(t));

    return {
      count: list.length,
      out, in: inc, net: inc - out,
      total,                                    // somma secondo "sign"
      perMonth: months.length ? Math.round(total / months.length) : 0,
      average: list.length ? Math.round(total / list.length) : 0,
      first: dates[0] || '', last: dates[dates.length - 1] || '',
      months: [...byMonth.entries()],
      byFamily: group(by.family), byCategory: group(by.category), bySubject: group(by.subject)
    };
  }

  const Search = { PRESETS, range, singleMonth, inRange, monthEnd, shiftMonth, monthLabel, parseQuery, matchText, monthsBetween, summarize };
  root.Search = Search;
  if (typeof module !== 'undefined') module.exports = Search;
})(typeof window === 'undefined' ? globalThis : window);
