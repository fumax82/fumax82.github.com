/*
 * subjects.js - ANAGRAFICA DEI SOGGETTI: chi ricevi soldi e a chi li dai.
 *
 * Un soggetto (negozio, azienda, persona, ente...) raccoglie tutti i suoi
 * movimenti e porta con sé le proprietà da assegnare loro:
 *
 *   {
 *     id, name: "Claude (Anthropic)",
 *     description: "Abbonamento AI di lavoro",      // mostrata sopra la descrizione della banca
 *     type: "abbonamento",                          // vedi TYPES
 *     direction: "out" | "in" | "any",              // uscite, entrate o entrambe
 *     match: "anthropic|claude.ai",                 // come riconoscerlo nella descrizione della banca
 *     set: { class: {family, category}, kind, person, accountUser, need, nature, tax, tags, refund, note },
 *     auto: true,                                   // assegna da solo i dati ai NUOVI movimenti
 *     since: 1234                                   // id massimo quando hai confermato: i movimenti
 *   }                                               //   fino a lì li confermi tu dalla lista
 *
 * Un movimento può anche essere legato a mano a un soggetto (extra.subject = id)
 * oppure escluso ("-"): vale più del riconoscimento automatico.
 * I soggetti sono salvati nelle preferenze (prefs.subjects).
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const C = root.Classify || require('./classify.js');
  const FL = () => root.Fields || require('./fields.js'); // caricato "pigro" (i due file si usano a vicenda)

  const TYPES = [
    ['negozio', 'Negozio / esercizio'], ['abbonamento', 'Abbonamento / servizio'], ['azienda', 'Azienda / fornitore'],
    ['persona', 'Persona'], ['lavoro', 'Datore di lavoro'], ['ente', 'Ente pubblico / tasse'],
    ['banca', 'Banca / finanziaria'], ['altro', 'Altro']
  ];

  function list(prefs) {
    return (prefs && Array.isArray(prefs.subjects)) ? prefs.subjects : [];
  }

  /** Parole con cui riconoscere il soggetto nella descrizione (separate da | o virgola). */
  function words(s) {
    return String(s.match || '').split(/[|,]/).map(U.norm).filter(w => w.length >= 2);
  }

  /** Testo del movimento in cui cercare: operazione + dettagli. */
  function haystack(t) {
    return ' ' + U.norm((t.operation || '') + ' ' + (t.details || '')) + ' ';
  }

  /** Lunghezza della parola più lunga del soggetto trovata nel movimento (0 = nessuna). */
  function matchStrength(s, t) {
    if (s.direction === 'out' && t.cents >= 0) return 0;
    if (s.direction === 'in' && t.cents <= 0) return 0;
    const text = haystack(t);
    let best = 0;
    for (const w of words(s)) if (text.includes(w) && w.length > best) best = w.length;
    return best;
  }

  /**
   * Soggetto di un movimento: prima il collegamento fatto a mano, poi il
   * riconoscimento automatico (vince la parola più lunga, cioè più precisa).
   */
  function subjectOf(t, subjects) {
    const pin = t.extra && t.extra.subject;
    if (pin === '-') return null;
    if (pin) {
      const s = subjects.find(x => x.id === pin);
      if (s) return s;
    }
    let best = null, strength = 0;
    for (const s of subjects) {
      const m = matchStrength(s, t);
      if (m > strength) { strength = m; best = s; }
    }
    return best;
  }

  function movementsOf(s, all, subjects) {
    return all.filter(t => t.state !== 'excluded' && subjectOf(t, subjects) === s)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Il soggetto ha dati da assegnare ai movimenti? */
  function hasValues(s) {
    const set = s.set || {};
    return Object.keys(set).some(k => !FL().isEmpty(set[k], k));
  }

  /** Dati del soggetto da copiare (solo quelli compilati). */
  function values(s) {
    const out = {};
    const set = s.set || {};
    for (const k in set) if (FL().byKey[k] && !FL().isEmpty(set[k], k)) out[k] = set[k];
    return out;
  }

  /**
   * Lista da confermare: per ogni movimento del soggetto, i campi che
   * cambierebbero ("valore attuale -> valore del soggetto"), con la spunta.
   */
  function proposals(s, all, subjects, tax) {
    const vals = values(s);
    return movementsOf(s, all, subjects)
      .map(t => ({ tx: t, group: 'subject', changes: FL().changesFor(t, vals, tax, null, 'subject') }))
      .filter(r => r.changes.length);
  }

  /**
   * Assegnazione automatica: i movimenti NUOVI (arrivati dopo l'ultima conferma)
   * di un soggetto con "auto" attivo ricevono i suoi dati, se non li hai già
   * cambiati tu a mano.
   */
  function autoEdits(all, prefs) {
    const subjects = list(prefs);
    if (!subjects.length) return [];
    const tax = C.taxonomy(prefs);
    const out = [];
    for (const t of all) {
      if (t.state !== 'active' || t.classifiedBy === 'user') continue;
      const s = subjectOf(t, subjects);
      if (!s || s.auto === false || !hasValues(s) || t.id <= (s.since || 0)) continue;
      const vals = values(s), diff = {};
      for (const k in vals) {
        if (k === 'accountUser' && t.account) continue;
        if (!FL().same(FL().get(t, k, tax), vals[k], k)) diff[k] = vals[k];
      }
      if (!Object.keys(diff).length) continue;
      out.push(Object.assign({ id: t.id, classifiedBy: 'subject:' + s.id }, FL().toEdit(diff)));
    }
    return out;
  }

  /** Nome proposto per un nuovo soggetto partendo da un movimento. */
  function suggestedName(t) {
    if (t.extra && t.extra.merchant) return t.extra.merchant;
    const d = C.dictionaryMatch(t);
    const base = d && d.keyword.trim().length >= 3 ? d.keyword.trim() : C.merchantKey(t) || C.mainToken(t) || t.operation;
    return String(base).replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Bozza di soggetto creata da un movimento. */
  function fromTx(t, set) {
    const d = C.dictionaryMatch(t);
    return {
      id: U.uid(),
      name: suggestedName(t),
      description: '',
      type: d && /AI|Streaming|Software|Telefonia/.test(d.category) ? 'abbonamento' : t.cents > 0 ? 'azienda' : 'negozio',
      direction: t.cents < 0 ? 'out' : 'in',
      match: d && d.keyword.trim().length >= 3 ? d.keyword.trim() : C.mainToken(t),
      set: Object.assign({}, set || {}),
      auto: true,
      created: U.today()
    };
  }

  /**
   * Soggetti da creare: movimenti senza soggetto raggruppati per controparte.
   * Per ogni gruppo: nome proposto, movimenti, totale e proposta di categoria.
   */
  function candidates(all, prefs) {
    const subjects = list(prefs);
    const tax = C.taxonomy(prefs);
    const ctx = { taxonomy: tax, rules: (prefs && prefs.rules) || [], history: C.learnHistory(all) };
    const dismissed = new Set((prefs && prefs.subjectsDismissed) || []);
    const groups = {};
    for (const t of all) {
      if (t.state !== 'active' || subjectOf(t, subjects)) continue;
      const k = C.merchantKey(t);
      if (!k) continue;
      const key = (t.cents < 0 ? '-' : '+') + k;
      if (dismissed.has(key)) continue;
      const g = (groups[key] = groups[key] || { key, ids: [], total: 0, last: t, missing: 0 });
      g.ids.push(t.id);
      g.total += Math.abs(t.cents);
      if (t.date > g.last.date) g.last = t;
      if (C.missingInfo(t, tax).some(m => m !== 'account')) g.missing++;
    }
    return Object.values(groups).map(g => Object.assign(g, {
      name: suggestedName(g.last),
      sign: g.key[0] === '-' ? 'out' : 'in',
      suggestion: C.suggest(g.last, ctx)
    })).sort((a, b) => (b.missing > 0) - (a.missing > 0) || b.ids.length - a.ids.length || b.total - a.total);
  }

  const Subjects = { TYPES, list, words, matchStrength, subjectOf, movementsOf, hasValues, values, proposals, autoEdits, suggestedName, fromTx, candidates };
  root.Subjects = Subjects;
  if (typeof module !== 'undefined') module.exports = Subjects;
})(typeof window === 'undefined' ? globalThis : window);
