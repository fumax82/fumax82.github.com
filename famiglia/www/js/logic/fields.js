/*
 * fields.js - I CAMPI di un movimento e la loro COPIA su altri movimenti.
 *
 * 1. FIELDS: elenco di tutti i campi che puoi compilare a mano. Ogni campo dice:
 *      key      nome interno
 *      label    nome mostrato
 *      extra    true = salvato nella colonna JSON "extra" (campi nuovi della 2.1)
 *      copy     true = proposto già spuntato quando copi sugli altri movimenti
 *      memory   true = "memoria esercizi": i nuovi movimenti dello stesso
 *               esercizio lo ricevono in automatico
 *      scope    'merchant' = si copia solo sui movimenti dello STESSO esercizio
 *
 *    Per aggiungere un campo nuovo basta aggiungerlo qui (e, se è una scelta,
 *    le sue opzioni): finestre di copia, dettaglio, filtri e CSV lo usano.
 *
 * 2. related():     movimenti dello stesso esercizio e movimenti simili
 * 3. proposals():   per ogni movimento collegato, i campi che cambierebbero
 *                   ("valore attuale -> nuovo valore") e se proporli spuntati
 * 4. profiles() / autoEdits(): memoria esercizi + regole applicate da sole
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const C = root.Classify || require('./classify.js');

  const FIELDS = [
    { key: 'class', label: 'Famiglia › categoria', copy: true, memory: true },
    { key: 'kind', label: 'Trattamento', copy: true, memory: true },
    { key: 'accountUser', label: 'Conto / carta', copy: true, memory: true },
    { key: 'person', label: 'Persona', copy: true, memory: true },
    { key: 'merchant', label: 'Esercizio', extra: true, copy: true, memory: true, scope: 'merchant',
      hint: 'Nome leggibile del negozio o soggetto (es. "Esselunga Viale Piave")' },
    { key: 'need', label: 'Necessità', extra: true, copy: true, memory: true, choice: true,
      options: [['essenziale', 'Essenziale'], ['utile', 'Utile'], ['superflua', 'Superflua']],
      hint: 'Distingue ciò che serve da ciò che si può tagliare' },
    { key: 'nature', label: 'Natura', extra: true, copy: true, memory: true, choice: true,
      options: [['fissa', 'Fissa'], ['variabile', 'Variabile'], ['straordinaria', 'Una tantum']],
      hint: 'Fissa = ogni mese uguale; Una tantum = non si ripete' },
    { key: 'tax', label: 'Detrazione 730', extra: true, copy: true, memory: true,
      options: [['sanitaria', 'Spese sanitarie'], ['veterinaria', 'Veterinario'], ['istruzione', 'Istruzione'], ['sport', 'Sport ragazzi'],
        ['mutuo', 'Interessi mutuo'], ['casa', 'Bonus casa / ristrutturazione'], ['assicurazione', 'Assicurazione vita/infortuni'],
        ['trasporti', 'Abbonamento trasporti'], ['altro', 'Altra detrazione']],
      hint: 'Per ritrovare a fine anno le spese da portare in dichiarazione' },
    { key: 'tags', label: 'Etichette / progetto', extra: true, copy: false, memory: false, list: true,
      hint: 'Es. "Vacanza Sardegna 2026", "Ristrutturazione": somma i costi di un progetto' },
    { key: 'refund', label: 'Da farsi rimborsare da', extra: true, copy: false, memory: false,
      options: [['azienda', 'Azienda (nota spese)'], ['familiari', 'Familiari o amici'], ['assicurazione', 'Assicurazione'], ['venditore', 'Venditore (reso)'], ['altro', 'Altro']],
      hint: 'L\'app ti ricorda i rimborsi che non sono ancora arrivati' },
    { key: 'rating', label: 'Rifarei questa spesa?', extra: true, copy: false, memory: false, choice: true,
      options: [['si', 'Sì'], ['forse', 'Forse'], ['no', 'No']],
      hint: 'Le spese con "No" mostrano quanto spendi senza soddisfazione' },
    { key: 'note', label: 'Note', copy: false, memory: false }
  ];
  const KIND_LABELS = { expense: 'Spesa', income: 'Entrata', refund: 'Rimborso / storno', saving: 'Accantonamento',
    investment: 'Investimento', transfer: 'Giroconto', withdrawal: 'Prelievo contanti' };
  const byKey = Object.fromEntries(FIELDS.map(f => [f.key, f]));

  // ---------------------------------------------------------------------
  // Lettura e confronto dei valori
  // ---------------------------------------------------------------------

  /** Valore di un campo in un movimento. "class" è la coppia famiglia+categoria. */
  function get(t, key, tax) {
    if (key === 'class') return { family: C.familyOf(t, tax || C.DEFAULT_TAXONOMY), category: t.category || '' };
    const f = byKey[key];
    const v = f && f.extra ? (t.extra || {})[key] : t[key];
    if (f && f.list) return Array.isArray(v) ? v : (v ? [v] : []);
    return v == null ? '' : v;
  }

  function isEmpty(v, key) {
    if (key === 'class') return !v.category || C.isGenericCategory(v.category);
    if (Array.isArray(v)) return v.length === 0;
    return v === '' || v == null;
  }

  function same(a, b, key) {
    if (key === 'class') return U.norm(a.category) === U.norm(b.category) && (a.family || '') === (b.family || '');
    if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify((a || []).slice().sort()) === JSON.stringify((b || []).slice().sort());
    return String(a) === String(b);
  }

  /** Testo leggibile di un valore. */
  function format(v, key) {
    const f = byKey[key];
    if (key === 'class') return v.category ? (v.family ? v.family + ' › ' : '') + v.category : '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    if (v === '' || v == null) return '—';
    if (f && f.options) { const o = f.options.find(x => x[0] === v); if (o) return o[1]; }
    if (key === 'kind') return KIND_LABELS[v] || v;
    return String(v);
  }

  /**
   * Trasforma { campo: valore } nel comando di modifica per il database:
   * { family, category, kind, person, note, accountUser, extra: {...} }
   */
  function toEdit(values) {
    const e = {};
    for (const key in values) {
      const v = values[key], f = byKey[key];
      if (key === 'class') { e.family = v.family || ''; e.category = v.category || ''; }
      else if (f && f.extra) (e.extra = e.extra || {})[key] = v;
      else e[key] = v;
    }
    return e;
  }

  /** Campi cambiati tra due "fotografie" di valori. */
  function changed(before, after) {
    const out = {};
    for (const key in after) if (!same(before[key], after[key], key) && !isEmpty(after[key], key)) out[key] = after[key];
    return out;
  }

  /** Fotografia di tutti i campi di un movimento. */
  function snapshot(t, tax) {
    const out = {};
    for (const f of FIELDS) out[f.key] = get(t, f.key, tax);
    return out;
  }

  // ---------------------------------------------------------------------
  // Movimenti collegati
  // ---------------------------------------------------------------------

  const sign = t => (t.cents < 0 ? -1 : 1);

  /**
   * Movimenti collegati a "source", divisi in gruppi:
   *   merchant  stesso esercizio (stessa controparte)
   *   brand     stessa insegna in un altro punto vendita (es. Esselunga Milano / Roma)
   *   type      stesso tipo di servizio riconosciuto (es. Anthropic -> OpenAI, Gemini: tutti AI)
   * Sempre con lo stesso segno (un reso non riceve i dati di un acquisto).
   */
  function related(source, all) {
    const key = C.merchantKey(source), token = C.mainToken(source);
    const dict = C.dictionaryMatch(source);
    const out = { merchant: [], brand: [], type: [] };
    for (const t of all) {
      if (t.id === source.id || t.state === 'excluded' || sign(t) !== sign(source)) continue;
      const k = C.merchantKey(t);
      if (key && k === key) { out.merchant.push(t); continue; }
      if (token && token.length >= 3 && C.mainToken(t) === token) { out.brand.push(t); continue; }
      const d = dict && C.dictionaryMatch(t);
      if (d && d.category === dict.category && d.family === dict.family) out.type.push(t);
    }
    for (const g in out) out[g].sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }

  /**
   * Per ogni movimento collegato, i campi che la copia cambierebbe.
   * values = { campo: nuovoValore } (solo i campi che hai compilato/modificato)
   * before = valori del movimento PRIMA della modifica (facoltativo)
   * Un campo è proposto già spuntato se:
   *   - nel movimento di destinazione aveva lo stesso valore "vecchio" del
   *     movimento modificato (erano allineati: li aggiorni insieme), oppure
   *   - è un campo "copiabile" di default (copy: true) e nella destinazione è
   *     vuoto o non l'hai scelto tu a mano
   * Resta senza spunta se nella destinazione hai scelto a mano un valore diverso.
   * Restituisce [{ tx, group, changes: [{ key, label, from, to, checked }] }]
   */
  function proposals(source, values, all, tax, before) {
    const groups = related(source, all);
    const out = [];
    for (const group of ['merchant', 'brand', 'type']) {
      for (const t of groups[group]) {
        const changes = [];
        for (const key in values) {
          const f = byKey[key];
          if (!f || (f.scope === 'merchant' && group !== 'merchant')) continue;
          if (key === 'accountUser' && t.account) continue; // la banca indica già il conto
          const from = get(t, key, tax), to = values[key];
          if (same(from, to, key)) continue;
          const inSync = before && before[key] !== undefined && !isEmpty(before[key], key) && same(from, before[key], key);
          const manual = !isEmpty(from, key) && !inSync && (t.classifiedBy === 'user' || (f.extra && !t.classifiedBy));
          let checked = inSync || (f.copy && !manual);
          if (key === 'accountUser' && group !== 'merchant') checked = false;
          changes.push({ key, label: f.label, from, to, checked });
        }
        if (changes.length) out.push({ tx: t, group, changes });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------
  // Memoria esercizi: i nuovi movimenti prendono i dati dell'ultimo
  // movimento dello stesso esercizio compilato da te.
  // ---------------------------------------------------------------------

  /** Profilo di ogni esercizio: { "segno|chiave": { sourceId, date, values } } */
  function profiles(all, tax) {
    const out = {};
    for (const t of all) {
      if (t.classifiedBy !== 'user' || t.state === 'excluded' || !t.category || C.isGenericCategory(t.category)) continue;
      const key = C.merchantKey(t);
      if (!key) continue;
      const id = sign(t) + '|' + key;
      if (out[id] && out[id].date > t.date) continue;
      const values = {};
      for (const f of FIELDS) {
        if (!f.memory) continue;
        const v = get(t, f.key, tax);
        if (!isEmpty(v, f.key) && !(f.key === 'person' && v === 'Famiglia')) values[f.key] = v;
      }
      out[id] = { sourceId: t.id, date: t.date, values };
    }
    return out;
  }

  /** Chiave del profilo esercizio di un movimento: "segno|controparte". */
  function profileKey(t) {
    return sign(t) + '|' + C.merchantKey(t);
  }

  /**
   * Modifiche automatiche da applicare:
   *  1. memoria esercizi: sui movimenti mai toccati (classificati solo dalla
   *     banca o per niente) ARRIVATI DOPO che hai compilato l'esercizio.
   *     I movimenti già presenti in quel momento te li propone la finestra
   *     di copia, dove scegli tu campo per campo.
   *     prefs.memorySince = { "segno|controparte": id massimo al momento della compilazione }
   *  2. regole (sui movimenti non classificati da te né dalla memoria)
   */
  function autoEdits(all, prefs) {
    const tax = C.taxonomy(prefs);
    const out = [];
    const done = new Set();
    if (!prefs || prefs.merchantMemory !== false) {
      const prof = profiles(all, tax);
      for (const t of all) {
        if (t.state !== 'active' || (t.classifiedBy && t.classifiedBy !== 'bank')) continue;
        const key = profileKey(t), p = prof[key];
        if (!p || p.sourceId === t.id) continue;
        const since = ((prefs && prefs.memorySince) || {})[key];
        if (since && t.id <= since) continue; // già presente quando hai compilato: decide la finestra di copia
        const values = {};
        for (const key in p.values) {
          if (key === 'accountUser' && t.account) continue;
          if (!same(get(t, key, tax), p.values[key], key)) values[key] = p.values[key];
        }
        if (!Object.keys(values).length) continue;
        out.push(Object.assign({ id: t.id, classifiedBy: 'merchant:' + p.sourceId }, toEdit(values)));
        done.add(t.id);
      }
    }
    const rules = (prefs && prefs.rules) || [];
    const others = all.filter(t => !done.has(t.id) && !String(t.classifiedBy || '').startsWith('merchant:'));
    return out.concat(C.pendingRuleEdits(others, rules));
  }

  const Fields = { FIELDS, byKey, get, isEmpty, same, format, toEdit, changed, snapshot, related, proposals, profiles, profileKey, autoEdits };
  root.Fields = Fields;
  if (typeof module !== 'undefined') module.exports = Fields;
})(typeof window === 'undefined' ? globalThis : window);
