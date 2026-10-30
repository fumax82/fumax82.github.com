/*
 * links.js - COLLEGAMENTI tra movimenti, per dare una logica ai flussi:
 *
 *  - cash      pagamento in contanti  -> prelievo bancomat da cui vengono i soldi
 *              (oppure "chiusura forzata": soldi ricevuti, es. regalo)
 *  - refund    rimborso / reso / soldi restituiti da amici -> spesa originale
 *  - transfer  uscita da un conto -> entrata su un altro conto tuo (giroconto)
 *
 * Qui ci sono solo i calcoli per PROPORRE i collegamenti; la conferma la dai tu.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const F = root.Finance || require('./finance.js');
  const C = root.Classify || require('./classify.js');

  /** Prelievi con quanto resta ancora "da spiegare". */
  function withdrawals(transactions, links) {
    const alloc = F.cashAllocation(transactions, links);
    return transactions
      .filter(t => t.kind === 'withdrawal' && t.state === 'active')
      .map(t => Object.assign({ tx: t }, alloc[t.id]))
      .sort((a, b) => b.tx.date.localeCompare(a.tx.date));
  }

  /**
   * Prelievi a cui collegare un pagamento in contanti di "cents" (positivo)
   * fatto in data "date". Preferiamo il prelievo più vicino PRIMA della spesa
   * che ha ancora abbastanza contanti disponibili.
   */
  function cashCandidates(date, cents, transactions, links, excludeTxId) {
    const linksOther = (links || []).filter(l => l.from !== excludeTxId);
    return withdrawals(transactions, linksOther)
      .filter(w => w.tx.date <= U.addDays(date, 1) && U.daysBetween(w.tx.date, date) <= 90)
      .map(w => {
        const days = U.daysBetween(w.tx.date, date);
        const enough = w.free >= cents;
        return Object.assign(w, { days, enough, score: (enough ? 0 : 1000) + Math.max(0, days) });
      })
      .sort((a, b) => a.score - b.score);
  }

  /** Collegamento "contanti" di un movimento (o null). */
  function cashLinkOf(txId, links) {
    return (links || []).find(l => l.type === 'cash' && l.from === txId) || null;
  }

  /** Pagamenti in contanti registrati a mano. */
  function cashPayments(transactions) {
    return transactions.filter(t => t.source === 'manual' && t.state === 'active');
  }

  /** Movimenti collegati (in entrambe le direzioni) a un movimento. */
  function linksOf(txId, links) {
    return (links || []).filter(l => l.from === txId || l.to === txId);
  }

  /**
   * Possibili giroconti: un'uscita e un'entrata dello stesso importo, entro 3
   * giorni, su conti diversi. Esclude coppie già collegate o rifiutate.
   */
  function transferPairs(transactions, links, rejected) {
    const linked = new Set();
    for (const l of links || []) if (l.type === 'transfer') { linked.add(l.from); linked.add(l.to); }
    const no = new Set(rejected || []);
    const active = transactions.filter(t => t.state === 'active' && t.status === 'SI' && t.source !== 'manual' && !linked.has(t.id));
    const ins = active.filter(t => t.cents > 0);
    const out = [];
    for (const a of active) {
      if (a.cents >= 0) continue;
      for (const b of ins) {
        if (b.cents !== -a.cents) continue;
        if (Math.abs(U.daysBetween(a.date, b.date)) > 3) continue;
        const accA = U.account(a), accB = U.account(b);
        if (!accA || !accB || U.norm(accA) === U.norm(accB)) continue;
        if (no.has(a.id + ':' + b.id)) continue;
        out.push({ out: a, in: b });
      }
    }
    return out;
  }

  /** Spese che un rimborso potrebbe compensare (stessa controparte, prima del rimborso). */
  function refundCandidates(refundTx, transactions) {
    const key = C.merchantKey(refundTx);
    return transactions
      .filter(t => t.state === 'active' && t.cents < 0 && t.id !== refundTx.id
        && t.date <= refundTx.date && U.daysBetween(t.date, refundTx.date) <= 180)
      .map(t => ({ tx: t, same: C.merchantKey(t) === key, exact: -t.cents === refundTx.cents }))
      .filter(x => x.same || x.exact)
      .sort((a, b) => (b.same + b.exact) - (a.same + a.exact) || b.tx.date.localeCompare(a.tx.date))
      .slice(0, 8);
  }

  /** Quanto è stato rimborsato di una spesa (somma dei rimborsi collegati). */
  function refundedAmount(expenseId, links) {
    return U.sum((links || []).filter(l => l.type === 'refund' && l.to === expenseId), l => Math.abs(l.cents));
  }

  const Links = { withdrawals, cashCandidates, cashLinkOf, cashPayments, linksOf, transferPairs, refundCandidates, refundedAmount };
  root.Links = Links;
  if (typeof module !== 'undefined') module.exports = Links;
})(typeof window === 'undefined' ? globalThis : window);
