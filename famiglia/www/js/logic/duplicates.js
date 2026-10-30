/*
 * duplicates.js - CONTROLLI SUI DOPPIONI: soldi contati due volte?
 *
 * Distingue cinque situazioni, ognuna con una spiegazione e le azioni giuste:
 *
 *  import    DOPPIA IMPORTAZIONE: lo stesso movimento arriva da due file con
 *            una descrizione un po' diversa (la banca a volte la cambia), quindi
 *            l'app non lo riconosce come già presente. Indizio forte: il primo
 *            file copre anche la data dell'altro movimento ma non lo contiene.
 *  charge    DOPPIO ADDEBITO: nello stesso file due addebiti uguali (stesso
 *            esercizio, importo e giorno). Può essere un errore del negozio
 *            o due acquisti veri: decide chi era presente.
 *  manual    REGISTRATO DUE VOLTE: un pagamento in contanti inserito a mano e
 *            un pagamento della banca uguale negli stessi giorni.
 *  card      CARTA CONTATA DUE VOLTE: l'addebito mensile della carta di credito
 *            sul conto è uguale alla somma degli acquisti della carta già
 *            importati: va trattato come giroconto, non come spesa.
 *  reversal  ADDEBITO STORNATO: un addebito e un accredito uguali dalla stessa
 *            controparte; non è un doppione ma si annullano (meglio collegarli).
 *
 * decisions = prefs.dupDecisions: { chiave: 'distinct' | 'dup' | 'contest' }
 * così le coppie già valutate non vengono riproposte.
 */
(function (root) {
  'use strict';
  const U = root.Util || require('./util.js');
  const C = root.Classify || require('./classify.js');

  const fmtDate = d => d.split('-').reverse().join('/');
  const eur = c => (Math.abs(c) / 100).toFixed(2).replace('.', ',') + ' €';

  /** Descrizione "essenziale" per confrontare due movimenti (senza numeri e date). */
  function essence(t) {
    return U.norm((t.operation || '') + ' ' + (t.details || '')).replace(/\d+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Somiglianza 0-1 tra due testi (parole in comune). */
  function similarity(a, b) {
    const A = new Set(a.split(' ').filter(w => w.length > 2)), B = new Set(b.split(' ').filter(w => w.length > 2));
    if (!A.size || !B.size) return a === b ? 1 : 0;
    let common = 0;
    for (const w of A) if (B.has(w)) common++;
    return common / Math.max(A.size, B.size);
  }

  function pairKey(a, b) {
    return Math.min(a.id, b.id) + ':' + Math.max(a.id, b.id);
  }

  /** Periodo coperto da un file importato. */
  function rangeOf(imp) {
    const s = imp.start || imp.firstDate, e = imp.end || imp.lastDate;
    return s && e ? [s, e] : null;
  }

  /**
   * Analisi completa. Restituisce una lista di casi:
   * { key, type, level, ids, title, reasons: [...], suggestion }
   */
  function analyze(transactions, imports, decisions, todayIso) {
    const done = decisions || {};
    const impById = {};
    for (const i of imports || []) impById[i.id] = i;
    const active = transactions.filter(t => t.state === 'active');
    const out = [];
    const add = c => { if (!done[c.key]) out.push(c); };

    // Indice per importo (stesso valore assoluto)
    const byAmount = {};
    for (const t of active) (byAmount[Math.abs(t.cents)] = byAmount[Math.abs(t.cents)] || []).push(t);

    for (const amount in byAmount) {
      const list = byAmount[amount];
      if (list.length < 2 || +amount === 0) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i].date <= list[j].date ? list[i] : list[j];
          const b = a === list[i] ? list[j] : list[i];
          const days = U.daysBetween(a.date, b.date);
          const key = pairKey(a, b);
          const accA = U.norm(U.account(a)), accB = U.norm(U.account(b));
          const sameAccount = !accA || !accB || accA === accB;
          const sim = similarity(essence(a), essence(b));
          const sameKey = C.merchantKey(a) && C.merchantKey(a) === C.merchantKey(b);

          // --- Addebito e storno (segno opposto) ---
          if (Math.sign(a.cents) !== Math.sign(b.cents)) {
            const charge = a.cents < 0 ? a : b, back = charge === a ? b : a;
            if (back.date >= charge.date && U.daysBetween(charge.date, back.date) <= 15 && (sameKey || sim >= 0.5)) {
              add({ key: 'rev:' + key, type: 'reversal', level: 'info', ids: [charge.id, back.id],
                title: 'Addebito e storno: si annullano',
                reasons: [eur(charge.cents) + ' addebitati il ' + fmtDate(charge.date) + ' e restituiti il ' + fmtDate(back.date) + '.'],
                suggestion: 'Collega lo storno all\'addebito: così non risultano né spesa né entrata.' });
            }
            continue;
          }
          if (days > 3) continue;
          if (a.status !== b.status) continue; // in attesa/definitivo: lo gestisce la riconciliazione

          // --- Pagamento in contanti registrato e anche pagato con la banca ---
          if ((a.source === 'manual') !== (b.source === 'manual')) {
            const sameCat = a.category && a.category === b.category;
            if (days <= 2 && (sim >= 0.5 || sameCat || sameKey)) {
              const man = a.source === 'manual' ? a : b;
              add({ key: 'man:' + key, type: 'manual', level: 'media', ids: [a.id, b.id],
                title: 'Spesa registrata due volte?',
                reasons: ['Hai inserito a mano un pagamento in contanti di ' + eur(man.cents) + ' e la banca ne riporta uno uguale ' + (days ? days + ' giorni ' : 'lo stesso giorno') + '.',
                  sameCat ? 'Hanno anche la stessa categoria (' + a.category + ').' : 'Le descrizioni si somigliano.'],
                suggestion: 'Se l\'hai pagato con la carta, elimina il pagamento in contanti inserito a mano.' });
            }
            continue;
          }
          if (a.source === 'manual' || !sameAccount) continue;

          const impA = a.imports || [], impB = b.imports || [];
          const shared = impA.filter(x => impB.includes(x));

          // --- Stesso movimento importato due volte con descrizione diversa ---
          if (impA.length && impB.length && !shared.length && (sim >= 0.5 || sameKey) && days <= 2) {
            const covering = impA.map(x => impById[x]).filter(Boolean).find(f => { const r = rangeOf(f); return r && r[0] <= b.date && r[1] >= b.date; })
              || impB.map(x => impById[x]).filter(Boolean).find(f => { const r = rangeOf(f); return r && r[0] <= a.date && r[1] >= a.date; });
            const reasons = ['Stesso importo (' + eur(a.cents) + ')' + (accA ? ', stesso conto' : '') + (days ? ', date a ' + days + ' giorni' : ', stessa data') + '.',
              'Arrivano da due file diversi e nessun file li contiene entrambi.'];
            if (covering) reasons.push('Il file "' + covering.name + '" copre anche la data dell\'altro movimento ma non lo contiene: se fossero due spese diverse le avrebbe riportate tutte e due.');
            if (essence(a) !== essence(b)) reasons.push('Le descrizioni sono leggermente diverse ("' + (a.details || a.operation) + '" / "' + (b.details || b.operation) + '"): per questo l\'importazione non li ha riconosciuti come uguali.');
            add({ key: 'imp:' + key, type: 'import', level: covering ? 'alta' : 'media', ids: [a.id, b.id],
              title: 'Probabile doppia importazione', reasons,
              suggestion: 'Escludi uno dei due: resta nello storico e puoi sempre ripristinarlo.' });
            continue;
          }

          // --- Due addebiti uguali nello stesso file ---
          if ((sameKey || sim >= 0.8) && days <= 1 && a.cents < 0) {
            const sameText = essence(a) === essence(b);
            add({ key: 'chg:' + key, type: 'charge', level: sameText && !days ? 'alta' : 'media', ids: [a.id, b.id],
              title: 'Possibile doppio addebito',
              reasons: [(a.details || a.operation) + ': ' + eur(a.cents) + ' ' + (days ? 'il ' + fmtDate(a.date) + ' e il ' + fmtDate(b.date) : 'due volte il ' + fmtDate(a.date)) + '.',
                shared.length ? 'Sono entrambi nello stesso file della banca: la banca li ha registrati come due operazioni distinte.' : 'La banca li riporta come due operazioni distinte.'],
              suggestion: 'Se hai fatto un solo acquisto, segnalo come "da contestare" e chiedi lo storno al negozio o alla banca.' });
          }
        }
      }
    }

    // --- Addebito della carta di credito uguale agli acquisti della carta già importati ---
    const CARD_BAL = /(saldo carta|estratto conto carta|addebito carta di credito|carta di credito.*addebito|addebito.*estratto conto|rimborso utilizzo carta)/;
    for (const t of active) {
      if (t.cents >= 0 || t.kind === 'transfer' || !CARD_BAL.test(U.norm(t.operation + ' ' + t.details))) continue;
      const key = 'card:' + t.id;
      if (done[key]) continue;
      const others = {};
      for (const x of active) {
        if (x.id === t.id || x.cents >= 0 || !U.account(x) || U.norm(U.account(x)) === U.norm(U.account(t))) continue;
        (others[U.account(x)] = others[U.account(x)] || []).push(x);
      }
      // Finestre tipiche: il mese precedente, oppure i 40-5 giorni prima dell'addebito
      const prevMonth = U.addDays(t.date.slice(0, 7) + '-01', -1).slice(0, 7);
      const windows = [x => x.date.startsWith(prevMonth), x => x.date >= U.addDays(t.date, -40) && x.date <= U.addDays(t.date, -5)];
      for (const acc in others) {
        for (const w of windows) {
          const sel = others[acc].filter(w);
          const sum = -U.sum(sel, x => x.cents);
          if (sel.length >= 2 && Math.abs(sum + t.cents) <= Math.max(100, -t.cents * 0.02)) {
            add({ key, type: 'card', level: 'alta', ids: [t.id].concat(sel.map(x => x.id)),
              title: 'Spese della carta contate due volte',
              reasons: ['L\'addebito "' + (t.details || t.operation) + '" del ' + fmtDate(t.date) + ' (' + eur(t.cents) + ') è uguale alla somma di ' + sel.length + ' acquisti della carta "' + acc + '" già importati (' + eur(sum) + ').',
                'Contandoli tutti, le stesse spese risultano due volte.'],
              suggestion: 'Tratta l\'addebito della carta come giroconto: gli acquisti restano, l\'addebito non conta più come spesa.' });
            break;
          }
        }
        if (out.some(c => c.key === key)) break;
      }
    }

    const order = { alta: 0, media: 1, info: 2 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  }

  const Duplicates = { analyze, essence, similarity, pairKey };
  root.Duplicates = Duplicates;
  if (typeof module !== 'undefined') module.exports = Duplicates;
})(typeof window === 'undefined' ? globalThis : window);
