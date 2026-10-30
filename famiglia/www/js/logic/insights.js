/*
 * insights.js - AVVISI sulle abitudini di spesa: "sto buttando soldi?"
 *
 * Ogni avviso ha:
 *   level   'alta' | 'media' | 'info'
 *   icon    simbolo da mostrare
 *   title   frase breve
 *   text    spiegazione con i numeri
 *   tip     consiglio pratico
 *   ids     movimenti coinvolti (per mostrarli con un tocco)
 *   saving  risparmio annuo stimato in centesimi (se calcolabile)
 *
 * Sono indizi calcolati sui tuoi dati, non giudizi: puoi nasconderli.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const F = root.Finance || require('./finance.js');
  const C = root.Classify || require('./classify.js');
  const eur = c => (c / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  /** Mese precedente di "AAAA-MM". */
  function prevMonth(m, n) {
    const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 - (n || 1), 1));
    return d.toISOString().slice(0, 7);
  }

  function inMonth(rows, m) {
    return rows.filter(t => t.date.startsWith(m));
  }

  /**
   * Calcola tutti gli avvisi per il mese "month" (AAAA-MM).
   * data = { transactions, links, prefs } come arriva dal database.
   */
  function compute(data, month, todayIso) {
    const all = data.transactions || [];
    const links = data.links || [];
    const prefs = data.prefsParsed || {};
    const tax = C.taxonomy(prefs);
    const ctx = { links, all, taxonomy: tax };
    const hidden = new Set(prefs.hiddenInsights || []);
    const out = [];
    const add = a => { if (!hidden.has(a.id)) out.push(a); };
    const booked = all.filter(F.booked);
    if (!booked.length) return out;
    const m = month || booked.map(t => t.date.slice(0, 7)).sort().pop();
    const cur = inMonth(all, m);
    const s = F.totals(cur, ctx);

    // 1) Spendi più di quanto entra
    const concluded = m < (todayIso || U.today()).slice(0, 7); // mese finito: confronto equo
    if (concluded && s.income > 0 && s.expense > s.income) {
      add({ id: 'deficit:' + m, level: 'alta', icon: '⚠', title: 'Questo mese hai speso più di quanto è entrato',
        text: 'Spese ' + eur(s.expense) + ' contro entrate ' + eur(s.income) + ': mancano ' + eur(s.expense - s.income) + '.',
        tip: 'Guarda le categorie in crescita qui sotto: di solito il recupero più facile è lì.' });
    }

    // 2) Categorie in crescita rispetto alla media dei 3 mesi precedenti
    const now = Object.fromEntries(F.categories(cur, ctx));
    const prev = [1, 2, 3].map(n => Object.fromEntries(F.categories(inMonth(all, prevMonth(m, n)), ctx)));
    const monthsWithData = [1, 2, 3].filter(n => inMonth(all, prevMonth(m, n)).length > 0).length;
    if (monthsWithData >= 2) {
      for (const cat in now) {
        const avg = prev.reduce((acc, p) => acc + (p[cat] || 0), 0) / monthsWithData;
        if (avg > 0 && now[cat] > avg * 1.3 && now[cat] - avg >= 5000) {
          add({ id: 'trend:' + m + ':' + cat, level: now[cat] > avg * 2 ? 'alta' : 'media', icon: '↗',
            title: cat + ': +' + Math.round((now[cat] / avg - 1) * 100) + '% rispetto al solito',
            text: eur(now[cat]) + ' questo mese contro una media di ' + eur(avg) + ' nei mesi precedenti.',
            tip: 'Se non è una spesa straordinaria, prova a fissare un budget per questa categoria.',
            ids: cur.filter(t => t.category === cat && t.kind === 'expense').map(t => t.id), category: cat });
        }
      }
    }

    // 3) Budget superati o quasi
    const budgets = prefs.budgets || {};
    for (const cat in budgets) {
      const spent = now[cat] || 0, limit = budgets[cat];
      if (!limit) continue;
      if (spent > limit) {
        add({ id: 'budget:' + m + ':' + cat, level: 'alta', icon: '◎', title: 'Budget "' + cat + '" superato',
          text: 'Speso ' + eur(spent) + ' su ' + eur(limit) + ' (' + Math.round(spent / limit * 100) + '%).', tip: 'Rivedi il limite o le spese del mese.', category: cat });
      } else if (spent > limit * 0.8) {
        add({ id: 'budget80:' + m + ':' + cat, level: 'media', icon: '◎', title: 'Budget "' + cat + '" quasi esaurito',
          text: 'Speso ' + eur(spent) + ' su ' + eur(limit) + '. Restano ' + eur(limit - spent) + '.', tip: '', category: cat });
      }
    }

    // 4) Abbonamenti: totale e doppioni nella stessa categoria
    const groups = C.recurringGroups(all, prefs).filter(g => g.subscription && U.daysBetween(g.last, todayIso || U.today()) <= (g.cadenceDays || 30) * 1.6);
    const subsMonthly = U.sum(groups, g => g.monthly);
    if (groups.length >= 3) {
      add({ id: 'subs:' + groups.length + ':' + Math.round(subsMonthly / 1000), level: 'info', icon: '↻',
        title: groups.length + ' pagamenti ricorrenti attivi: ' + eur(subsMonthly) + ' al mese',
        text: 'Cioè circa ' + eur(subsMonthly * 12) + ' all\'anno. ' + groups.slice(0, 5).map(g => g.token + ' ' + eur(g.typical)).join(' · '),
        tip: 'Una volta all\'anno verifica quali usi davvero: ogni abbonamento dimenticato pesa 12 volte.',
        ids: groups.flatMap(g => g.ids) });
    }
    const byCat = U.groupBy(groups.filter(g => g.category), g => g.category);
    for (const cat in byCat) {
      const list = byCat[cat];
      if (list.length < 2 || /mutuo|affitto|utenze|prestiti|assicuraz|condominio/i.test(cat)) continue;
      const monthly = U.sum(list, g => g.monthly);
      add({ id: 'dupsubs:' + cat + ':' + list.length, level: 'media', icon: '⧉',
        title: list.length + ' abbonamenti nella categoria ' + cat,
        text: list.map(g => g.token + ' (' + eur(g.typical) + ' ' + g.cadence + ')').join(', ') + ' = ' + eur(monthly) + '/mese.',
        tip: 'Servizi simili spesso si sovrappongono: tenerne uno solo farebbe risparmiare circa ' + eur((monthly - Math.max(...list.map(g => g.monthly))) * 12) + ' l\'anno.',
        saving: (monthly - Math.max(...list.map(g => g.monthly))) * 12, ids: list.flatMap(g => g.ids) });
    }

    // 5) Rincari di pagamenti ricorrenti
    for (const g of C.recurringGroups(all, prefs)) {
      if (!g.subscription || g.priceChange <= 0 || g.priceChange < Math.max(100, g.typical * 0.05)) continue;
      if (U.daysBetween(g.last, todayIso || U.today()) > 60) continue;
      add({ id: 'rise:' + g.key + ':' + g.lastCents, level: 'media', icon: '▲', title: g.token + ': prezzo aumentato',
        text: 'Ultimo addebito ' + eur(g.lastCents) + ', prima circa ' + eur(g.lastCents - g.priceChange) + ' (+' + eur(g.priceChange) + ').',
        tip: 'Controlla se è un rincaro del piano: a volte esiste un piano più economico o annuale.', ids: g.ids,
        saving: g.cadenceDays ? Math.round(g.priceChange * 365 / g.cadenceDays) : 0 });
    }

    // 6) Commissioni e costi bancari dell'ultimo anno
    const yearAgo = U.addDays(todayIso || U.today(), -365);
    const fees = booked.filter(t => t.date >= yearAgo && t.cents < 0 && (U.norm(t.category).includes('commission')
      || /commission|canone|spese tenuta|imposta di bollo|competenze/.test(U.norm(t.operation + ' ' + t.details))));
    const feesTotal = -U.sum(fees, t => t.cents);
    if (feesTotal >= 3000) {
      add({ id: 'fees:' + Math.round(feesTotal / 1000), level: 'media', icon: '🏦', title: 'Costi bancari: ' + eur(feesTotal) + ' in un anno',
        text: fees.length + ' addebiti tra commissioni, canoni e imposte di bollo.',
        tip: 'Confronta il tuo conto con offerte a canone zero: l\'imposta di bollo resta, canone e commissioni spesso no.',
        ids: fees.map(t => t.id), saving: feesTotal });
    }

    // 7) Piccole spese frequenti (bar, delivery, fast food...)
    const small = cur.filter(t => F.booked(t) && t.kind === 'expense' && t.cents < 0 && -t.cents <= 1500
      && /bar|caff|delivery|fast food|ristor|snack|tabacc/i.test((t.category || '') + ' ' + C.familyOf(t, tax)));
    const smallTotal = -U.sum(small, t => t.cents);
    if (small.length >= 8 && smallTotal >= 5000) {
      add({ id: 'small:' + m, level: 'media', icon: '☕', title: small.length + ' piccole spese fuori casa questo mese',
        text: 'Insieme fanno ' + eur(smallTotal) + ': su un anno circa ' + eur(smallTotal * 12) + '.',
        tip: 'Non serve eliminarle: dimezzarle libera circa ' + eur(smallTotal * 6) + ' l\'anno.', ids: small.map(t => t.id), saving: smallTotal * 6 });
    }

    // 8) Delivery più caro della spesa al supermercato
    const delivery = now['Delivery'] || 0, market = now['Supermercato'] || 0;
    if (delivery >= 4000 && delivery > market * 0.5) {
      add({ id: 'delivery:' + m, level: 'media', icon: '🛵', title: 'Consegne a domicilio: ' + eur(delivery) + ' questo mese',
        text: 'Pari al ' + (market ? Math.round(delivery / market * 100) + '% della spesa al supermercato.' : 'nessuna spesa al supermercato registrata.'),
        tip: 'Un pasto a domicilio costa spesso 3-4 volte lo stesso pasto cucinato a casa.', saving: Math.round(delivery * 0.5 * 12) });
    }

    // 9) Addebiti doppi: ora nei Controlli sui doppioni (logic/duplicates.js), più precisi

    // 10) Contanti non tracciati negli ultimi 90 giorni
    const recentW = booked.filter(t => t.kind === 'withdrawal' && t.date >= U.addDays(todayIso || U.today(), -90));
    const alloc = F.cashAllocation(all, links);
    const w = -U.sum(recentW, t => t.cents), free = U.sum(recentW, t => (alloc[t.id] ? alloc[t.id].free : 0));
    if (w > 0 && free > w * 0.5 && free >= 5000) {
      add({ id: 'cash:' + Math.round(free / 1000), level: 'info', icon: '💶', title: eur(free) + ' di contanti senza traccia',
        text: 'Negli ultimi 90 giorni hai prelevato ' + eur(w) + ' e registrato spese in contanti solo per ' + eur(w - free) + '.',
        tip: 'Registra i pagamenti in contanti (tasto "Contanti"): sapere dove vanno è il primo passo per risparmiare.', ids: recentW.map(t => t.id) });
    }

    // 11) Tasso di risparmio basso
    if (s.income > 0 && s.rate !== null && s.rate < 0.1 && s.rate >= 0) {
      add({ id: 'rate:' + m, level: 'info', icon: '◔', title: 'Risparmio del mese: ' + Math.round(s.rate * 100) + '% delle entrate',
        text: 'Margine di ' + eur(s.margin) + ' su ' + eur(s.income) + ' di entrate.',
        tip: 'Un obiettivo comune è il 10-20%: imposta un trasferimento automatico verso il risparmio subito dopo lo stipendio.' });
    }

    // 12) Spese fuori dall'abitudine
    for (const x of F.unusual(cur)) {
      add({ id: 'unusual:' + x.tx.id, level: 'info', icon: '!', title: 'Spesa insolita: ' + (x.tx.details || x.tx.operation),
        text: eur(-x.tx.cents) + ', oltre 3 volte la mediana della categoria ' + (x.tx.category || '') + ' (' + eur(x.median) + ').', tip: '', ids: [x.tx.id] });
    }

    // 13) Spese superflue (campo "Necessità" indicato da te)
    const curExp = cur.filter(t => F.booked(t) && t.kind === 'expense' && t.cents < 0);
    const sup = curExp.filter(t => (t.extra || {}).need === 'superflua');
    const supTotal = -U.sum(sup, t => t.cents), expTotal = -U.sum(curExp, t => t.cents);
    if (supTotal >= 3000 && expTotal > 0 && supTotal / expTotal >= 0.15) {
      add({ id: 'superflue:' + m, level: supTotal / expTotal >= 0.25 ? 'alta' : 'media', icon: '✂', title: 'Spese superflue: ' + Math.round(supTotal / expTotal * 100) + '% del mese',
        text: eur(supTotal) + ' in spese che hai indicato come superflue.', tip: 'Ridurle di un terzo libererebbe circa ' + eur(supTotal * 4) + ' all\'anno.',
        ids: sup.map(t => t.id), saving: Math.round(supTotal * 4) });
    }

    // 14) Spese che non rifaresti (ultimi 90 giorni)
    const regret = booked.filter(t => (t.extra || {}).rating === 'no' && t.date >= U.addDays(todayIso || U.today(), -90));
    if (regret.length >= 2) {
      add({ id: 'regret:' + regret.length, level: 'info', icon: '👎', title: regret.length + ' spese che non rifaresti negli ultimi 3 mesi',
        text: 'Totale ' + eur(-U.sum(regret, t => t.cents)) + '.', tip: 'Prima di un acquisto simile, aspetta 48 ore: spesso la voglia passa.', ids: regret.map(t => t.id) });
    }

    // 15) Rimborsi attesi da più di 30 giorni
    const waiting = all.filter(t => t.state === 'active' && (t.extra || {}).refund && U.daysBetween(t.date, todayIso || U.today()) > 30
      && !links.some(l => l.type === 'refund' && l.to === t.id));
    if (waiting.length) {
      add({ id: 'refundwait:' + waiting.map(t => t.id).join(','), level: 'media', icon: '⏳', title: waiting.length + ' rimborsi attesi da più di 30 giorni',
        text: 'Totale ' + eur(-U.sum(waiting, t => t.cents)) + ' da ricevere.', tip: 'Sollecita il rimborso; quando arriva, collegalo alla spesa dal dettaglio.', ids: waiting.map(t => t.id) });
    }

    // 16) Promemoria 730 (da marzo a giugno)
    const today = todayIso || U.today(), mm = +today.slice(5, 7);
    if (mm >= 3 && mm <= 6) {
      const lastYear = String(+today.slice(0, 4) - 1);
      const tax = booked.filter(t => t.date.startsWith(lastYear) && (t.extra || {}).tax);
      if (tax.length) {
        add({ id: '730:' + lastYear, level: 'info', icon: '🧾', title: 'Dichiarazione dei redditi: ' + eur(-U.sum(tax, t => t.cents)) + ' di spese detraibili ' + lastYear,
          text: tax.length + ' spese segnate come detraibili.', tip: 'Controlla che siano nel 730 precompilato e conserva le ricevute.', ids: tax.map(t => t.id) });
      }
    }

    const order = { alta: 0, media: 1, info: 2 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }

  const Insights = { compute, prevMonth };
  root.Insights = Insights;
  if (typeof module !== 'undefined') module.exports = Insights;
})(typeof window === 'undefined' ? globalThis : window);
