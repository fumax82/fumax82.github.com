/*
 * gaps.js - ANALISI DEI BUCHI tra le importazioni.
 *
 * Ogni file importato copre un periodo [inizio, fine] (letto dal file stesso,
 * oppure dalla prima/ultima data dei movimenti). Uniamo tutti i periodi:
 * se un file contiene un intervallo, quell'intervallo NON è un buco, anche
 * se altri file sono più corti. I buchi sono i giorni non coperti da nessun
 * file, tra la prima importazione e l'ultima.
 *
 * Priorità del buco (giorni senza copertura):
 *   1-3   bassa    (potrebbe essere un weekend o un ponte)
 *   4-6   media
 *   7-13  alta     (molto probabilmente hai dimenticato un file)
 *   14+   critica
 *
 * Puoi dire all'app che un intervallo "non è un buco": viene salvato in
 * prefs.gapIgnored e le volte successive non sarà più segnalato.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  /** Periodo coperto da un'importazione: [start, end] in "AAAA-MM-GG". */
  function importRange(imp) {
    const start = imp.start || imp.firstDate;
    const end = imp.end || imp.lastDate;
    if (!start || !end) return null;
    return start <= end ? [start, end] : [end, start];
  }

  /**
   * Unisce periodi sovrapposti o attaccati (fine + 1 giorno = inizio successivo).
   * Restituisce una lista ordinata di { start, end, imports: [id...] }.
   */
  function mergeRanges(ranges) {
    const sorted = ranges.slice().sort((a, b) => a.start.localeCompare(b.start));
    const out = [];
    for (const r of sorted) {
      const last = out[out.length - 1];
      if (last && U.dayNumber(r.start) <= U.dayNumber(last.end) + 1) {
        if (r.end > last.end) last.end = r.end;
        last.imports = last.imports.concat(r.imports);
      } else {
        out.push({ start: r.start, end: r.end, imports: r.imports.slice() });
      }
    }
    return out;
  }

  /** Periodi coperti dalle importazioni, già uniti. */
  function coverage(imports) {
    const ranges = [];
    for (const imp of imports || []) {
      const r = importRange(imp);
      if (r) ranges.push({ start: r[0], end: r[1], imports: [imp.id] });
    }
    return mergeRanges(ranges);
  }

  /** Livello di priorità in base ai giorni scoperti. */
  function priority(days) {
    if (days >= 14) return 'critica';
    if (days >= 7) return 'alta';
    if (days >= 4) return 'media';
    return 'bassa';
  }

  /** Toglie da un intervallo [s,e] le parti dichiarate "non buco". Può spezzarlo. */
  function subtractIgnored(start, end, ignored) {
    let pieces = [[U.dayNumber(start), U.dayNumber(end)]];
    for (const ig of ignored || []) {
      const a = U.dayNumber(ig.start), b = U.dayNumber(ig.end);
      const next = [];
      for (const [s, e] of pieces) {
        if (b < s || a > e) { next.push([s, e]); continue; } // nessuna sovrapposizione
        if (a > s) next.push([s, a - 1]);
        if (b < e) next.push([b + 1, e]);
      }
      pieces = next;
    }
    return pieces.map(([s, e]) => [U.isoFromDay(s), U.isoFromDay(e)]);
  }

  /** Il buco cade solo di sabato/domenica? (spesso è normale non avere movimenti) */
  function onlyWeekend(start, end) {
    for (let d = start; d <= end; d = U.addDays(d, 1)) {
      const w = U.weekday(d);
      if (w !== 0 && w !== 6) return false;
    }
    return true;
  }

  /**
   * Analisi completa.
   * @param imports      lista importazioni ({id, start, end, firstDate, lastDate, name})
   * @param transactions movimenti (per contare quelli che cadono nei buchi, es. contanti)
   * @param ignored      intervalli dichiarati "non buco" [{start, end, note}]
   * @param todayIso     data di oggi (per segnalare il periodo non ancora importato)
   */
  function analyze(imports, transactions, ignored, todayIso) {
    const covered = coverage(imports);
    const gaps = [];
    for (let i = 1; i < covered.length; i++) {
      const start = U.addDays(covered[i - 1].end, 1);
      const end = U.addDays(covered[i].start, -1);
      for (const [s, e] of subtractIgnored(start, end, ignored)) {
        const days = U.daysBetween(s, e) + 1;
        const weekend = onlyWeekend(s, e);
        let level = priority(days);
        if (weekend && level === 'bassa') level = 'minima';
        gaps.push({
          type: 'hole', start: s, end: e, days, level, weekend,
          before: covered[i - 1].end, after: covered[i].start,
          movements: (transactions || []).filter(t => t.date >= s && t.date <= e).length
        });
      }
    }
    // Periodo dall'ultima importazione a oggi
    let recent = null;
    if (covered.length && todayIso) {
      const lastEnd = covered[covered.length - 1].end;
      const days = U.daysBetween(lastEnd, todayIso);
      if (days > 0) recent = { type: 'recent', start: U.addDays(lastEnd, 1), end: todayIso, days, level: days >= 30 ? 'alta' : days >= 7 ? 'media' : 'bassa' };
    }
    const order = { critica: 0, alta: 1, media: 2, bassa: 3, minima: 4 };
    gaps.sort((a, b) => order[a.level] - order[b.level] || b.days - a.days);
    return {
      covered,
      gaps,
      recent,
      first: covered.length ? covered[0].start : null,
      last: covered.length ? covered[covered.length - 1].end : null,
      totalGapDays: gaps.reduce((s, g) => s + g.days, 0),
      important: gaps.filter(g => g.level === 'alta' || g.level === 'critica').length
    };
  }

  /** Un mese è coperto interamente dai file importati? */
  function monthCovered(month, imports) {
    if (!month) return false;
    const start = month + '-01';
    const end = U.addDays(U.isoFromDay(U.dayNumber(start) + 31).slice(0, 7) + '-01', -1);
    return coverage(imports).some(r => r.start <= start && r.end >= end);
  }

  const Gaps = { importRange, mergeRanges, coverage, priority, subtractIgnored, analyze, monthCovered, onlyWeekend };
  root.Gaps = Gaps;
  if (typeof module !== 'undefined') module.exports = Gaps;
})(typeof window === 'undefined' ? globalThis : window);
