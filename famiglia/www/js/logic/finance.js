/*
 * finance.js - Calcoli sui soldi: totali, categorie, mesi, ricorrenze,
 * simulatore di investimento (PAC) e spese fuori dall'abitudine.
 *
 * Regola importante sui CONTANTI:
 *   un prelievo al bancomat non è una spesa "vera": sposta soldi dal conto
 *   al portafoglio. Le spese vere sono i pagamenti in contanti che registri
 *   a mano e colleghi al prelievo. La parte del prelievo NON collegata a
 *   nessuna spesa resta conteggiata come "Contanti non tracciati", così i
 *   totali non perdono soldi e non li contano due volte.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');

  /** Solo movimenti attivi e contabilizzati entrano nei totali. */
  const booked = t => t.state === 'active' && t.status === 'SI';

  /** Quanto di ogni prelievo è già stato "spiegato" da spese in contanti. */
  function cashAllocation(transactions, links) {
    const out = {};
    for (const t of transactions) {
      if (t.kind === 'withdrawal' && t.state === 'active') out[t.id] = { amount: -t.cents, allocated: 0, items: [] };
    }
    for (const l of links || []) {
      if (l.type === 'cash' && l.to && out[l.to]) {
        out[l.to].allocated += Math.abs(l.cents);
        out[l.to].items.push(l.from);
      }
    }
    for (const id in out) out[id].free = Math.max(0, out[id].amount - out[id].allocated);
    return out;
  }

  /**
   * Totali di un insieme di movimenti.
   * ctx.links serve per i contanti (vedi spiegazione in alto).
   */
  function totals(rows, ctx) {
    const links = (ctx && ctx.links) || [];
    const all = (ctx && ctx.all) || rows;
    const active = rows.filter(t => t.state === 'active');
    const ok = active.filter(t => t.status === 'SI');
    const pending = active.filter(t => t.status === 'NO');
    const alloc = cashAllocation(all, links);

    const income = U.sum(ok.filter(t => t.kind === 'income'), t => t.cents);
    const expenseOnly = -U.sum(ok.filter(t => t.kind === 'expense'), t => t.cents);
    const withdrawals = ok.filter(t => t.kind === 'withdrawal');
    const withdrawn = -U.sum(withdrawals, t => t.cents);
    const cashUntracked = U.sum(withdrawals, t => (alloc[t.id] ? alloc[t.id].free : -t.cents));
    const expense = expenseOnly + cashUntracked;
    const refund = U.sum(ok.filter(t => t.kind === 'refund'), t => t.cents);
    const margin = income - expense + refund;
    return {
      income, expense, expenseOnly, refund, margin, withdrawn, cashUntracked,
      cash: U.sum(ok.filter(t => t.source !== 'manual'), t => t.cents),
      saving: -U.sum(ok.filter(t => t.kind === 'saving' || t.kind === 'investment'), t => t.cents),
      pending: U.sum(pending, t => t.cents),
      pendingOut: -U.sum(pending.filter(t => t.cents < 0), t => t.cents),
      rate: income > 0 ? margin / income : null,
      count: ok.length,
      pendingCount: pending.length
    };
  }

  /** Spese per categoria (o per famiglia), dalla più alta. */
  function breakdown(rows, ctx, by) {
    const links = (ctx && ctx.links) || [];
    const all = (ctx && ctx.all) || rows;
    const tax = (ctx && ctx.taxonomy) || [];
    const Classify = root.Classify || require('./classify.js');
    const alloc = cashAllocation(all, links);
    const out = {};
    for (const t of rows) {
      if (!booked(t)) continue;
      if (t.kind === 'expense') {
        const k = by === 'family' ? (Classify.familyOf(t, tax) || 'Senza famiglia') : (t.category || 'Da classificare');
        out[k] = (out[k] || 0) - t.cents;
      } else if (t.kind === 'withdrawal') {
        const free = alloc[t.id] ? alloc[t.id].free : -t.cents;
        if (free > 0) out['Contanti non tracciati'] = (out['Contanti non tracciati'] || 0) + free;
      }
    }
    return Object.entries(out).filter(e => e[1] !== 0).sort((a, b) => b[1] - a[1]);
  }

  const categories = (rows, ctx) => breakdown(rows, ctx, 'category');
  const families = (rows, ctx) => breakdown(rows, ctx, 'family');

  /** Totali mese per mese. */
  function months(rows, ctx) {
    const m = U.groupBy(rows, t => t.date.slice(0, 7));
    return Object.keys(m).sort().map(k => Object.assign({ month: k }, totals(m[k], Object.assign({}, ctx, { all: (ctx && ctx.all) || rows }))));
  }

  /** Simulatore di piano di accumulo (versamenti mensili, rendimento costante). */
  function pac(capital, monthly, years, gross, cost, inflation) {
    const rate = (gross - cost) / 100;
    if (rate <= -1 || inflation <= -100) throw Error('Tassi non validi');
    const r = Math.pow(1 + rate, 1 / 12) - 1, n = Math.round(years * 12);
    const end = r === 0 ? capital + monthly * n : capital * Math.pow(1 + r, n) + monthly * (Math.pow(1 + r, n) - 1) / r;
    return { end, paid: capital + monthly * n, real: end / Math.pow(1 + inflation / 100, years) };
  }

  /** Spese oltre 100 € e oltre 3 volte la mediana della loro categoria. */
  function unusual(rows) {
    const g = U.groupBy(rows.filter(t => booked(t) && t.kind === 'expense' && t.cents < 0), t => t.category);
    return Object.values(g).flatMap(a => {
      if (a.length < 5) return [];
      const med = U.median(a.map(t => -t.cents));
      return a.filter(t => -t.cents > Math.max(10000, med * 3)).map(t => ({ tx: t, median: med }));
    });
  }

  const Finance = { booked, cashAllocation, totals, breakdown, categories, families, months, pac, unusual, sum: U.sum };
  root.Finance = Finance;
  if (typeof module !== 'undefined') module.exports = Finance;
})(typeof window === 'undefined' ? globalThis : window);
