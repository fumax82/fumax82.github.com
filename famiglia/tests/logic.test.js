// Test automatici della logica (senza interfaccia). Avvio: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const path = '../www/js/logic/';
const U = require(path + 'util.js');
const C = require(path + 'classify.js');
const G = require(path + 'gaps.js');
const F = require(path + 'finance.js');
const L = require(path + 'links.js');
const I = require(path + 'insights.js');
const R = require(path + 'receipts.js');

let nextId = 1;
const tx = o => Object.assign({ id: nextId++, date: '2026-03-01', operation: '', details: '', account: 'Carta 1234', accountUser: '',
  cents: -1000, status: 'SI', state: 'active', kind: 'expense', category: '', family: '', classifiedBy: '', source: 'bank' }, o);

test('chiave controparte e parola principale', () => {
  const t = tx({ operation: 'Pagamento POS', details: 'ANTHROPIC* CLAUDE SUBSCRIPTION 10/03 carta *1234' });
  assert.strictEqual(C.merchantKey(t), 'anthropic claude subscription');
  assert.strictEqual(C.mainToken(t), 'anthropic');
});

test('dizionario: Anthropic, OpenAI e Gemini sono AI', () => {
  for (const d of ['ANTHROPIC PBC', 'OPENAI *CHATGPT SUBSCR', 'Google GEMINI Advanced']) {
    const m = C.dictionaryMatch(tx({ details: d }));
    assert.ok(m, d);
    assert.strictEqual(m.category, 'AI');
    assert.strictEqual(m.family, 'Tecnologia e abbonamenti');
  }
  assert.strictEqual(C.dictionaryMatch(tx({ details: 'ESSELUNGA MILANO' })).category, 'Supermercato');
});

test('regole: corrispondenza, segno, importi e modifiche automatiche', () => {
  const rule = { id: 'r1', name: 'AI', text: 'anthropic|openai', sign: 'out', set: { family: 'Tecnologia e abbonamenti', category: 'AI' } };
  const a = tx({ details: 'ANTHROPIC PBC' }), b = tx({ details: 'OPENAI LLC' }), c = tx({ details: 'OPENAI', cents: 500 }),
    d = tx({ details: 'ANTHROPIC', classifiedBy: 'user', category: 'Lavoro' }), e = tx({ details: 'CONAD' });
  assert.ok(C.ruleMatches(rule, a));
  assert.ok(!C.ruleMatches(rule, c), 'entrata esclusa da sign out');
  const edits = C.pendingRuleEdits([a, b, c, d, e], [rule]);
  assert.deepStrictEqual(edits.map(x => x.id), [a.id, b.id], 'non tocca classificazioni manuali');
  assert.strictEqual(edits[0].classifiedBy, 'rule:r1');
  // dopo l'applicazione non ci sono più modifiche (niente cicli infiniti)
  Object.assign(a, edits[0]); Object.assign(b, edits[1]);
  assert.strictEqual(C.pendingRuleEdits([a, b], [rule]).length, 0);
  assert.ok(!C.ruleMatches(Object.assign({}, rule, { min: 2000 }), a), 'importo minimo');
});

test('informazioni mancanti e lista da completare con proposta', () => {
  const t1 = tx({ details: 'ANTHROPIC', account: '' });
  const t2 = tx({ details: 'X', category: 'Supermercato' });
  const t3 = tx({ details: 'Y', kind: 'transfer', category: '' });
  assert.deepStrictEqual(C.missingInfo(t1, C.DEFAULT_TAXONOMY), ['category', 'family', 'account']);
  assert.deepStrictEqual(C.missingInfo(t2, C.DEFAULT_TAXONOMY), []);
  assert.deepStrictEqual(C.missingInfo(t3, C.DEFAULT_TAXONOMY), []);
  assert.ok(C.isGenericCategory('Altre uscite'));
  const list = C.todoList([t1, t2, t3], {});
  assert.strictEqual(list.length, 1);
  assert.strictEqual(list[0].suggestion.category, 'AI');
});

test('memoria storica: propone la scelta fatta per la stessa controparte', () => {
  const done = tx({ details: 'PALESTRA ZETA', category: 'Sport e palestra', family: 'Salute e benessere', classifiedBy: 'user' });
  const fresh = tx({ details: 'PALESTRA ZETA' });
  const list = C.todoList([done, fresh], {});
  assert.strictEqual(list[0].suggestion.source, 'history');
  assert.strictEqual(list[0].suggestion.category, 'Sport e palestra');
});

test('ricorrenze mensili e proposta di regola', () => {
  const rows = ['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05'].map(d => tx({ date: d, details: 'NETFLIX.COM', cents: -1399 }));
  const g = C.recurringGroups(rows, {});
  assert.strictEqual(g.length, 1);
  assert.strictEqual(g[0].cadence, 'mensile');
  assert.ok(g[0].subscription);
  assert.strictEqual(g[0].next, '2026-05-05');
  assert.strictEqual(C.ruleProposals(rows, {}).length, 1);
  assert.strictEqual(C.ruleProposals(rows, { rules: [{ id: 'n', text: 'netflix', set: { category: 'Streaming' } }] }).length, 0);
});

test('buchi: periodi sovrapposti non sono buchi, i salti sì', () => {
  const imports = [
    { id: 1, start: '2026-01-01', end: '2026-01-31' },
    { id: 2, start: '2026-01-15', end: '2026-02-28' },   // si sovrappone: nessun buco
    { id: 3, start: '2026-03-03', end: '2026-03-31' },   // buco 1-2 marzo (2 giorni)
    { id: 4, start: '2026-04-15', end: '2026-05-31' },   // buco 1-14 aprile (14 giorni)
    { id: 5, start: '2026-02-01', end: '2026-02-10' }    // contenuto in un altro: ignorato
  ];
  const a = G.analyze(imports, [], [], '2026-06-10');
  assert.strictEqual(a.covered.length, 3);
  const byStart = Object.fromEntries(a.gaps.map(g => [g.start, g]));
  assert.strictEqual(byStart['2026-03-01'].days, 2);
  assert.ok(['bassa', 'minima'].includes(byStart['2026-03-01'].level));
  assert.strictEqual(byStart['2026-04-01'].days, 14);
  assert.strictEqual(byStart['2026-04-01'].level, 'critica');
  assert.strictEqual(a.recent.days, 10);
  // "non è un buco": ricordato, e un'ignoranza parziale spezza il buco
  const b = G.analyze(imports, [], [{ start: '2026-03-01', end: '2026-03-02' }, { start: '2026-04-01', end: '2026-04-07' }], '2026-06-10');
  assert.deepStrictEqual(b.gaps.map(g => [g.start, g.end, g.level]), [['2026-04-08', '2026-04-14', 'alta']]);
  assert.ok(G.monthCovered('2026-02', imports));
  assert.ok(!G.monthCovered('2026-03', imports));
});

test('buchi di soli weekend hanno priorità minima', () => {
  const a = G.analyze([{ id: 1, start: '2026-03-01', end: '2026-03-06' }, { id: 2, start: '2026-03-09', end: '2026-03-20' }], [], [], '2026-03-20');
  assert.strictEqual(a.gaps[0].level, 'minima'); // 7-8 marzo 2026 = sabato e domenica
});

test('totali: i prelievi non si contano due volte con le spese in contanti', () => {
  const w = tx({ kind: 'withdrawal', cents: -10000, details: 'PRELIEVO ATM' });
  const cash = tx({ kind: 'expense', cents: -3000, source: 'manual', account: 'Contanti', category: 'Bar e caffè' });
  const inc = tx({ kind: 'income', cents: 200000 });
  const links = [{ id: 1, type: 'cash', from: cash.id, to: w.id, cents: 3000 }];
  const s = F.totals([w, cash, inc], { links });
  assert.strictEqual(s.expense, 10000, '30 spesi + 70 non tracciati = 100');
  assert.strictEqual(s.cashUntracked, 7000);
  const cats = Object.fromEntries(F.categories([w, cash], { links }));
  assert.strictEqual(cats['Contanti non tracciati'], 7000);
  assert.strictEqual(cats['Bar e caffè'], 3000);
});

test('collegamenti: proposta del prelievo per un pagamento in contanti', () => {
  const w1 = tx({ kind: 'withdrawal', cents: -5000, date: '2026-03-01' });
  const w2 = tx({ kind: 'withdrawal', cents: -2000, date: '2026-03-08' });
  const c = L.cashCandidates('2026-03-10', 3000, [w1, w2], []);
  assert.strictEqual(c[0].tx.id, w1.id, 'w2 non ha abbastanza contanti');
  const c2 = L.cashCandidates('2026-03-10', 1500, [w1, w2], []);
  assert.strictEqual(c2[0].tx.id, w2.id, 'il più vicino con disponibilità');
  const pairs = L.transferPairs([tx({ cents: -50000, account: 'Conto A' }), tx({ cents: 50000, account: 'Conto B', kind: 'income' })], [], []);
  assert.strictEqual(pairs.length, 1);
});

test('avvisi: doppioni di abbonamenti AI (gli addebiti doppi sono nei controlli)', () => {
  const rows = [];
  for (const m of ['01', '02', '03', '04']) {
    rows.push(tx({ date: '2026-' + m + '-03', details: 'ANTHROPIC', cents: -2200, category: 'AI', family: 'Tecnologia e abbonamenti' }));
    rows.push(tx({ date: '2026-' + m + '-10', details: 'OPENAI CHATGPT', cents: -2300, category: 'AI', family: 'Tecnologia e abbonamenti' }));
  }
  rows.push(tx({ date: '2026-04-20', details: 'NEGOZIO X', cents: -4590 }), tx({ date: '2026-04-20', details: 'NEGOZIO X', cents: -4590 }));
  rows.push(tx({ date: '2026-04-01', kind: 'income', cents: 250000 }));
  const out = I.compute({ transactions: rows, links: [], prefsParsed: {} }, '2026-04', '2026-04-25');
  const ids = out.map(a => a.id.split(':')[0]);
  assert.ok(ids.includes('dupsubs'), JSON.stringify(ids));
  assert.ok(!ids.includes('dup'), 'gli addebiti doppi ora sono nei Controlli sui doppioni (duplicates.js)');
});

const RECEIPT = `ESSELUNGA S.P.A.
Via Roma 1 Milano
P.IVA 01234567890
DOCUMENTO COMMERCIALE
LATTE INTERO 1L        1,29
BANANE                 2,10
2 x 0,89
PASTA PENNE 500G       1,78
SCONTO PASTA          -0,30
DETERSIVO PIATTI       2,49
TOTALE COMPLESSIVO     7,36
PAGAMENTO ELETTRONICO  7,36
12/03/2026 18:22`;

test('scontrino: prodotti, quantità, sconti, totale, data e reparti', () => {
  const r = R.parseText(RECEIPT);
  assert.strictEqual(r.shop, 'Esselunga');
  assert.strictEqual(r.date, '2026-03-12');
  assert.strictEqual(r.total, 736);
  assert.deepStrictEqual(r.items.map(i => [i.name, i.price, i.category]), [
    ['LATTE INTERO 1L', 129, 'Latte e formaggi'], ['BANANE', 210, 'Frutta'],
    ['PASTA PENNE 500G', 148, 'Pasta, riso e farine'], ['DETERSIVO PIATTI', 249, 'Casa e pulizia']]);
  assert.strictEqual(r.items[2].qty, 2);
  assert.strictEqual(r.check, 'ok');
});

test('scontrino in più foto: righe sovrapposte rimosse', () => {
  const t = R.mergeTexts(['MELE 1,00\nPANE 2,00\nUOVA 3,00', 'PANE 2,00\nUOVA 3,00\nRISO 4,00\nTOTALE 10,00']);
  assert.strictEqual(R.parseText(t).items.length, 4);
});

test('analisi spesa: reparti e prezzi nel tempo', () => {
  const recs = [
    { id: 1, date: '2026-01-10', shop: 'Esselunga', total: 300, items: [{ name: 'LATTE INTERO 1L', qty: 1, unit: 120, price: 120, category: 'Latte e formaggi' }, { name: 'BANANE', qty: 1, unit: 180, price: 180, category: 'Frutta' }] },
    { id: 2, date: '2026-03-10', shop: 'Esselunga', total: 140, items: [{ name: 'LATTE INTERO 1 L', qty: 1, unit: 140, price: 140, category: 'Latte e formaggi' }] }
  ];
  const a = R.analyze(recs, {});
  assert.strictEqual(a.byCategory[0][0], 'Latte e formaggi');
  assert.strictEqual(a.rising[0].key, 'latte intero');
  assert.strictEqual(a.byShop[0].average, 220);
  assert.strictEqual(R.analyze(recs, { category: 'Frutta' }).items, 1);
});

test('date utili', () => {
  assert.strictEqual(U.addDays('2026-02-28', 1), '2026-03-01');
  assert.strictEqual(U.daysBetween('2026-01-01', '2026-01-31'), 30);
});

test('parola della regola: "gemini" e non "google"; categorie banca raggruppate', () => {
  assert.strictEqual(C.mainToken(tx({ details: 'GOOGLE *GEMINI ADVANCED' })), 'gemini');
  const a = tx({ details: 'CONAD', category: 'Alimentari e supermercato' }), b = tx({ details: 'LIDL', category: 'Alimentari e supermercato' });
  assert.strictEqual(C.todoList([a, b], {}).length, 0, 'non 2 avvisi separati...');
  assert.deepStrictEqual(C.bankCategoryGaps([a, b], {}), [['Alimentari e supermercato', 2]], '...ma una sola associazione');
  const w = tx({ kind: 'withdrawal', details: 'PRELIEVO', category: '' });
  assert.deepStrictEqual(C.missingInfo(w, C.DEFAULT_TAXONOMY), [], 'un prelievo non ha bisogno di categoria');
});
