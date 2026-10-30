/*
 * demo.js - ANTEPRIMA DIMOSTRATIVA per il browser del computer.
 *
 * Nel telefono i dati stanno nel database Android. Aprendo index.html in un
 * browser (PC), questo file simula lo stesso database con dati INVENTATI,
 * così puoi provare tutte le schermate. I dati demo restano nel browser
 * (localStorage) e non hanno nulla a che fare con i tuoi dati reali.
 *
 * Il formato dei dati e i comandi sono identici a quelli del codice Android
 * (Bridge.java / Store.java): è utile anche per capire come funziona l'app.
 */
(function () {
  'use strict';
  if (window.Native) return; // nel telefono non serve
  const KEY = 'famiglia-demo-v4';
  const U = window.Util;
  let db = null;
  const photos = {}; // foto scontrini (solo in memoria)

  // Generatore di numeri casuali "ripetibile" (stessi dati a ogni avvio)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const between = (a, b) => Math.round(a + rnd() * (b - a));

  function kindOf(t) {
    const op = U.norm(t.operation + ' ' + t.details), cat = U.norm(t.category);
    if (cat.includes('investiment')) return 'investment';
    if (cat.includes('girocont') || op.includes('giroconto')) return 'transfer';
    if (cat.includes('rimborsi') || cat.includes('storni')) return 'refund';
    if (t.cents < 0 && op.includes('prelievo')) return 'withdrawal';
    return t.cents >= 0 ? 'income' : 'expense';
  }

  function makeTx(date, cents, operation, details, account, category, status) {
    const t = {
      id: db.nextId++, occurrence: 1, date, cents, operation, details, account: account || '', currency: 'EUR', status: status || 'SI',
      originalCategory: category || '', category: category || '', note: '', person: 'Famiglia', state: 'active', replaced: 0,
      family: '', accountUser: '', classifiedBy: category ? 'bank' : '', source: 'bank', extra: {}, imports: [],
      raw: { Data: date, Operazione: operation, Dettagli: details, 'Conto o carta': account || '', Categoria: category || '', Importo: (cents / 100).toFixed(2) }
    };
    t.kind = kindOf(t);
    return t;
  }

  /** Movimenti inventati per un intervallo di giorni. */
  function generate(start, end) {
    const out = [];
    const CARD = 'Carta Visa *4821', CONTO = 'Conto 1000/00012345';
    for (let d = start; d <= end; d = U.addDays(d, 1)) {
      const day = +d.slice(8, 10), wd = U.weekday(d), m = +d.slice(5, 7);
      const add = (...a) => out.push(makeTx(d, ...a));
      if (day === 27) add(245000, 'Bonifico a vostro favore', 'STIPENDIO ACME SRL MENSILITA', CONTO, 'Stipendi e pensioni');
      if (day === 1) add(-78000, 'Addebito SDD', 'MUTUO CASA RATA N. ' + m, '', 'Mutuo e finanziamenti');
      if (day === 3 && m % 2 === 0) add(-between(8000, 11000), 'Addebito SDD', 'ENEL ENERGIA BOLLETTA', '', 'Utenze');
      if (day === 5) add(-2196, 'Pagamento POS', 'ANTHROPIC* CLAUDE.AI SUBSCRIPTION SAN FRANCISCO', CARD, '');
      if (day === 12) add(-2240, 'Pagamento POS', 'OPENAI *CHATGPT SUBSCR', CARD, 'Altre uscite');
      if (day === 18) add(-2199, 'Pagamento POS', 'GOOGLE *GEMINI ADVANCED', CARD, '');
      if (day === 15) add(-1399, 'Pagamento POS', 'NETFLIX.COM', CARD, 'Tempo libero');
      if (day === 20) add(d >= U.addDays(U.today(), -70) ? -1299 : -1199, 'Pagamento POS', 'SPOTIFY P1F2', CARD, 'Tempo libero');
      if (day === 28) add(-300, 'Canone mensile conto', 'CANONE MENSILE', CONTO, 'Commissioni');
      if (wd === 6) add(-between(4500, 12000), 'Pagamento POS', ['ESSELUNGA MILANO', 'CONAD CITY', 'LIDL ITALIA'][between(0, 2)], CARD, 'Alimentari e supermercato');
      if (wd === 2 || wd === 4) add(-between(120, 450), 'Pagamento POS', 'BAR CENTRALE', CARD, 'Ristoranti e bar');
      if (wd === 5 && rnd() < 0.5) add(-between(1800, 3200), 'Pagamento POS', 'GLOVO ORDER', CARD, '');
      if (wd === 1 && rnd() < 0.6) add(-between(5000, 7000), 'Pagamento POS', 'ENI STATION 0423', CARD, 'Carburanti');
      if (day % 10 === 4) add(-between(5, 10) * 1000, 'Prelievo carta', 'PRELIEVO BANCOMAT ATM', CARD, 'Prelievi');
      if (rnd() < 0.05) add(-between(1500, 9000), 'Pagamento su internet', 'AMAZON EU SARL', CARD, '');
      if (rnd() < 0.03) add(-between(2000, 6000), 'Pagamento POS', 'PALESTRA FITLIFE', '', '');
    }
    return out;
  }

  function seedData() {
    const today = U.today();
    const s = U.addDays(today, -200);
    db = { nextId: 1, transactions: [], imports: [], audit: [], prefs: {}, links: [], receipts: [], nextLink: 1, nextReceipt: 1, rejected: [] };
    // Quattro file importati: sovrapposizione, buco di 12 giorni, buco di 2 giorni, ultimi giorni non importati
    const periods = [[s, U.addDays(s, 60)], [U.addDays(s, 55), U.addDays(s, 110)], [U.addDays(s, 123), U.addDays(s, 160)], [U.addDays(s, 163), U.addDays(today, -6)]];
    // il secondo buco deve cadere in giorni feriali per essere visibile
    let id = 1, prevEnd = null;
    for (const [a, b] of periods) {
      // I giorni già coperti dal file precedente contengono gli STESSI movimenti (come nella realtà)
      for (const t of db.transactions) if (t.date >= a && t.date <= b) t.imports.push(id);
      const from = prevEnd && prevEnd >= a ? U.addDays(prevEnd, 1) : a;
      const rows = generate(from, b);
      rows.forEach(t => (t.imports = [id]));
      db.transactions.push(...rows);
      db.imports.push({ id, name: 'Movimenti_Intesa_' + a + '.xlsx', created: b + 'T18:00:00Z', start: a, end: b, count: rows.length, firstDate: a, lastDate: b });
      id++;
      prevEnd = b;
    }
    const tx = db.transactions;
    // Addebito doppio, giroconto, movimenti in attesa
    const d1 = U.addDays(today, -20);
    const lastFile = periods.length;
    const dec = [makeTx(d1, -4590, 'Pagamento POS', 'DECATHLON MILANO', 'Carta Visa *4821', 'Sport'), makeTx(d1, -4590, 'Pagamento POS', 'DECATHLON MILANO', 'Carta Visa *4821', 'Sport')];
    dec.forEach(t => (t.imports = [lastFile]));
    tx.push(...dec);
    // Doppia importazione: nella sovrapposizione tra il 1° e il 2° file la banca ha cambiato la descrizione
    const twinOf = tx.find(t => t.imports.length === 2 && t.cents < 0 && t.kind === 'expense' && t.details.includes(' '));
    if (twinOf) {
      twinOf.imports = [1];
      const twin = makeTx(twinOf.date, twinOf.cents, twinOf.operation, twinOf.details.split(' ')[0] + ' S.P.A. ' + (twinOf.details.split(' ')[1] || ''), twinOf.account, twinOf.category);
      twin.imports = [2];
      tx.push(twin);
    }
    tx.push(makeTx(U.addDays(today, -30), -50000, 'Bonifico disposto', 'A FAVORE CONTO DEPOSITO', 'Conto 1000/00012345', ''), makeTx(U.addDays(today, -29), 50000, 'Bonifico a vostro favore', 'DA CONTO CORRENTE', 'Conto Deposito 7788', ''));
    tx.push(makeTx(U.addDays(today, -7), -2650, 'Pagamento POS', 'RISTORANTE DA MARIO', 'Carta Visa *4821', '', 'NO'));
    tx.push(makeTx(U.addDays(today, -12), 2999, 'Storno pagamento', 'AMAZON EU SARL RIMBORSO', 'Carta Visa *4821', 'Rimborsi e storni'));
    for (const t of tx) t.id = db.nextId++;
    // Contanti: uno collegato, uno da collegare
    const w = tx.filter(t => t.kind === 'withdrawal').slice(-2);
    const cash1 = makeTx(U.addDays(w[0].date, 2), -1800, 'Pagamento in contanti', 'Mercato rionale', 'Contanti', 'Mercato');
    Object.assign(cash1, { source: 'manual', family: 'Alimentari', classifiedBy: 'user' });
    const cash2 = makeTx(U.addDays(w[1].date, 1), -2500, 'Pagamento in contanti', 'Parrucchiere', 'Contanti', 'Cura della persona');
    Object.assign(cash2, { source: 'manual', family: 'Persona e famiglia', classifiedBy: 'user' });
    tx.push(cash1, cash2);
    // Lo stesso parrucchiere risulta anche pagato con la carta: registrato due volte?
    const salon = makeTx(cash2.date, -2500, 'Pagamento POS', 'SALONE BELLEZZA LUCIA', 'Carta Visa *4821', 'Cura della persona');
    salon.id = db.nextId++;
    salon.imports = [lastFile];
    tx.push(salon);
    db.links.push({ id: db.nextLink++, type: 'cash', from: cash1.id, to: w[0].id, cents: 1800, note: '', created: today });
    // Scontrini di esempio collegati alla spesa del sabato
    const shops = tx.filter(t => /ESSELUNGA|CONAD|LIDL/.test(t.details)).slice(-4);
    const catalog = [['LATTE INTERO 1L', 129, 'Latte e formaggi'], ['BANANE', 189, 'Frutta'], ['PASTA PENNE 500G', 89, 'Pasta, riso e farine'], ['MOZZARELLA', 99, 'Latte e formaggi'],
      ['PETTO DI POLLO', 645, 'Carne'], ['BISCOTTI FROLLINI', 219, 'Dolci e snack'], ['ACQUA NATURALE 6X1,5L', 199, 'Bevande'], ['DETERSIVO PIATTI', 249, 'Casa e pulizia'],
      ['POMODORI', 230, 'Verdura'], ['BIRRA 66CL', 139, 'Alcolici'], ['YOGURT BIANCO', 95, 'Latte e formaggi'], ['PANE', 180, 'Pane e forno']];
    shops.forEach((t, k) => {
      const items = catalog.filter(() => rnd() < 0.7).map(([name, unit, category]) => {
        const qty = rnd() < 0.2 ? 2 : 1, price = Math.round(unit * (1 + k * 0.03)) * qty;
        return { name, qty, unit: Math.round(price / qty), price, category };
      });
      const total = U.sum(items, i => i.price);
      t.cents = -total;
      db.receipts.push({ id: db.nextReceipt++, txId: t.id, created: t.date, shop: t.details.split(' ')[0].replace(/^./, c => c) , date: t.date, total, items, photos: 0 });
    });
    // Un esercizio già compilato da te: la memoria esercizi completerà gli altri pagamenti al bar
    const bar = tx.filter(t => t.details === 'BAR CENTRALE').pop();
    Object.assign(bar, { classifiedBy: 'user', family: 'Ristoranti e bar', category: 'Bar e caffè', extra: { merchant: 'Bar Centrale', need: 'superflua', nature: 'variabile' } });
    const mutuo = tx.filter(t => /MUTUO/.test(t.details)).pop();
    Object.assign(mutuo, { classifiedBy: 'user', family: 'Casa', category: 'Mutuo e affitto', extra: { need: 'essenziale', nature: 'fissa', tax: 'mutuo' } });
    // Un soggetto in anagrafica, con descrizione e dati da assegnare ai suoi movimenti
    db.prefs.subjects = JSON.stringify([{ id: 'demo-mutuo', name: 'Mutuo prima casa', description: 'Rata mensile del mutuo con Intesa Sanpaolo',
      type: 'banca', direction: 'out', match: 'mutuo casa', auto: true, since: 0, created: today,
      set: { class: { family: 'Casa', category: 'Mutuo e affitto' }, need: 'essenziale', nature: 'fissa', tax: 'mutuo' } }]);
    db.audit.push({ date: today, action: 'Anteprima', detail: 'Dati dimostrativi generati' });
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* spazio esaurito o non disponibile: pazienza */ }
  }

  function load() {
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { db = null; }
    if (!db || !db.transactions) { seedData(); save(); }
    for (const t of db.transactions) if (!t.extra) t.extra = {};
  }

  /** Stessa struttura di Store.snapshot() in Java. */
  function snapshot() {
    const prefs = {};
    for (const k in db.prefs) prefs[k] = db.prefs[k];
    const used = new Set(db.transactions.filter(t => t.replaced).map(t => t.replaced));
    const pairs = [];
    for (const p of db.transactions) {
      if (p.status !== 'NO' || p.state !== 'active') continue;
      for (const b of db.transactions) {
        if (b.status === 'SI' && b.state === 'active' && b.cents === p.cents && !used.has(b.id) && Math.abs(U.daysBetween(p.date, b.date)) <= 10
          && !db.rejected.includes(p.id + ':' + b.id)) pairs.push({ pending: p.id, booked: b.id });
      }
    }
    return JSON.parse(JSON.stringify({ transactions: db.transactions, imports: db.imports, audit: db.audit.slice(-100).reverse(), pairs, prefs, links: db.links, receipts: db.receipts }));
  }

  const byId = id => db.transactions.find(t => t.id === id);
  const log = (action, detail) => db.audit.push({ date: new Date().toISOString(), action, detail: String(detail).slice(0, 300) });
  const EDITABLE = ['category', 'kind', 'note', 'person', 'family', 'accountUser', 'classifiedBy'];
  /** Come Store.mergeExtra in Java: un valore vuoto cancella il campo. */
  const mergeExtra = (cur, changes) => {
    const out = Object.assign({}, cur);
    for (const k in changes) {
      const v = changes[k];
      if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete out[k]; else out[k] = v;
    }
    return out;
  };
  const editOne = o => {
    const t = byId(o.id);
    if (!t) return;
    for (const k of EDITABLE) if (k in o) t[k] = o[k];
    if (o.extra) t.extra = mergeExtra(t.extra || {}, o.extra);
  };

  /** Esegue un comando come farebbe Bridge.java. */
  function action(cmd, o) {
    let reply = null;
    switch (cmd) {
      case 'edit': editOne(Object.assign({ classifiedBy: 'user' }, o)); log('Modifica classificazione', JSON.stringify(o)); break;
      case 'bulkEdit': o.items.forEach(editOne); log('Classificazione multipla', o.items.length + ' · ' + (o.reason || '')); if (!o.silent) window.notice(o.items.length + ' movimenti aggiornati'); break;
      case 'pref': db.prefs[o.key] = o.value; break;
      case 'link': { const p = byId(o.pending); p.state = 'replaced'; p.replaced = o.booked; log('Riconciliazione', o.pending + ' → ' + o.booked); break; }
      case 'distinct': db.rejected.push(o.pending + ':' + o.booked); break;
      case 'undo': { const t = byId(o.id); if (t.replaced) db.rejected.push(t.id + ':' + t.replaced); t.state = 'active'; t.replaced = 0; break; }
      case 'exclude': byId(o.id).state = 'excluded'; break;
      case 'saveManual': {
        let t = o.id ? byId(o.id) : null;
        if (!t) { t = makeTx(o.date, o.cents, o.operation, o.details, o.account || 'Contanti', o.category); t.id = db.nextId++; db.transactions.push(t); }
        Object.assign(t, { date: o.date, cents: o.cents, operation: o.operation, details: o.details, category: o.category || '', family: o.family || '', kind: o.kind || 'expense', person: o.person || 'Famiglia', note: o.note || '', source: 'manual', classifiedBy: 'user', status: 'SI' });
        if (o.extra) t.extra = mergeExtra(t.extra || {}, o.extra);
        if (o.link) {
          db.links = db.links.filter(l => !(l.from === t.id && l.type === o.link.type));
          db.links.push({ id: db.nextLink++, type: o.link.type, from: t.id, to: o.link.to || 0, cents: o.link.cents || -t.cents, note: o.link.note || '', created: U.today() });
        }
        reply = ['manual', t.id];
        log('Movimento manuale', t.details);
        break;
      }
      case 'deleteManual': db.transactions = db.transactions.filter(t => !(t.id === o.id && t.source === 'manual')); db.links = db.links.filter(l => l.from !== o.id && l.to !== o.id); break;
      case 'addLink': db.links.push({ id: db.nextLink++, type: o.type, from: o.from, to: o.to || 0, cents: o.cents || 0, note: o.note || '', created: U.today() }); break;
      case 'removeLink': db.links = db.links.filter(l => l.id !== o.id); break;
      case 'saveReceipt': {
        let r = o.id ? db.receipts.find(x => x.id === o.id) : null;
        if (!r) { r = { id: db.nextReceipt++, created: U.today(), photos: 0 }; db.receipts.push(r); }
        Object.assign(r, { txId: o.txId || 0, shop: o.shop, date: o.date, total: o.total, items: o.items });
        if (o.photos && o.photos.length) { photos[r.id] = o.photos; r.photos = o.photos.length; }
        db.receipts.sort((a, b) => b.date.localeCompare(a.date));
        reply = ['receipt', r.id];
        break;
      }
      case 'deleteReceipt': db.receipts = db.receipts.filter(r => r.id !== o.id); break;
      case 'receiptPhotos': setTimeout(() => window.receivePhotos(o.id, photos[o.id] || []), 10); return;
      case 'import': return simulateImport();
      case 'csv': return downloadCsv();
      case 'backup': case 'restore': case 'original':
        window.notice('Nell\'anteprima questa funzione non è disponibile: usala nell\'app Android.');
        return;
      default: window.notice('Azione sconosciuta: ' + cmd); return;
    }
    save();
    setTimeout(() => {
      window.receive(snapshot());
      if (reply) window.onSaved(reply[0], reply[1]);
    }, 20);
  }

  /** In anteprima "importare" riempie il buco più grande con nuovi movimenti inventati. */
  function simulateImport() {
    const a = window.Gaps.analyze(db.imports, db.transactions, [], U.today());
    const gap = a.gaps.slice().sort((x, y) => y.days - x.days)[0] || a.recent;
    if (!gap) { window.notice('Anteprima: nessun buco da riempire.'); return; }
    const start = U.addDays(gap.start, -2), end = gap.type === 'recent' ? U.today() : U.addDays(gap.end, 2);
    const rows = generate(start, end).filter(r => r.date >= gap.start && r.date <= gap.end);
    const newImport = db.imports.length + 1;
    rows.forEach(r => { r.id = db.nextId++; r.imports = [newImport]; });
    db.transactions.push(...rows);
    db.imports.push({ id: newImport, name: 'Movimenti_Intesa_' + start + '.xlsx', created: new Date().toISOString(), start, end, count: rows.length, firstDate: start, lastDate: end });
    log('Importazione', 'Anteprima: ' + rows.length + ' nuovi');
    save();
    window.receive(snapshot());
    window.onImported(rows.length + ' nuovi · periodo ' + start + ' → ' + end + ' (simulato)');
  }

  function downloadCsv() {
    const head = 'ID;Data;Operazione;Dettagli;Conto;Famiglia;Categoria;Importo;Tipo\r\n';
    const body = db.transactions.map(t => [t.id, t.date, t.operation, t.details, U.account(t), t.family, t.category, (t.cents / 100).toFixed(2).replace('.', ','), t.kind]
      .map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + head + body], { type: 'text/csv' }));
    a.download = 'Famiglia-demo.csv';
    a.click();
  }

  function start() {
    load();
    window.receive(snapshot());
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignorato */ }
    seed = 7;
    start();
  }

  window.Demo = { start, action, reset };
})();
