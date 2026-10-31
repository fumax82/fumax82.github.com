// Test di "Spese fisse e previsioni" (logic/forecast.js): node --test tests/*.test.js
// L'elenco è inventato: imita il modo in cui si scrive una lista di spese.
const test = require('node:test');
const assert = require('node:assert');
const FC = require('../www/js/logic/forecast.js');
const C = require('../www/js/logic/classify.js');

const LIST = `Ecco le mie spese, scritte di fretta: questa riga non è una voce.

Spese mensili
Mutuo casa — 700 €
Bolletta gas — 90 € (media annua: d'inverno di più)
Gasolio — 150 €
Fondo pensione — 50 €
Internet - 25
Semestrale (a semestre)
Condominio — 300 €
Vacanze — 1.200 € (una volta l'anno)
Tassa rifiuti — 120 € a rata
Annuale (all'anno)
RCA — 400 €
Imposta di bollo — 34,20 € circa (sul conto)
Quadriennale e oltre
Cambio auto — 18.000 € ogni 10 anni
Scuola — da valutare

BONUS:
Assegno unico +150€ mese
Rimborso 730 , 250€ anno`;

test('elenco incollato: voci, importi, periodicità e note', () => {
  const items = FC.parseList(LIST);
  const by = Object.fromEntries(items.map(it => [it.name, it]));
  assert.strictEqual(items.length, 14);
  assert.deepStrictEqual([by['Mutuo casa'].amount, by['Mutuo casa'].every], [70000, 1]);
  assert.strictEqual(by['Bolletta gas'].every, 1);                   // "media annua" nella nota non cambia la periodicità
  assert.strictEqual(by['Bolletta gas'].note, "media annua: d'inverno di più");
  assert.strictEqual(by['Internet'].amount, 2500);                  // anche senza il simbolo €
  assert.strictEqual(by['Condominio'].every, 6);
  assert.deepStrictEqual([by['Vacanze'].amount, by['Vacanze'].every], [120000, 12]);   // "(una volta l'anno)"
  assert.strictEqual(by['Tassa rifiuti'].note, 'a rata');
  assert.strictEqual(by['Imposta di bollo'].amount, 3420);
  assert.deepStrictEqual([by['Cambio auto'].amount, by['Cambio auto'].every], [1800000, 120]);
  assert.deepStrictEqual([by['Scuola'].amount, by['Scuola'].active, by['Scuola'].every], [0, false, 48]);
  assert.deepStrictEqual([by['Assegno unico'].section, by['Assegno unico'].every], ['bonus', 1]);
  assert.deepStrictEqual([by['Rimborso 730'].amount, by['Rimborso 730'].every, by['Rimborso 730'].section], [25000, 12, 'bonus']);
});

test('famiglia e categoria proposte, coerenti con quelle dei movimenti', () => {
  const tax = C.DEFAULT_TAXONOMY;
  const g = (name, section) => { const r = FC.guess(name, section || 'expense', tax); return r.family + ' › ' + r.category; };
  assert.strictEqual(g('Gasolio'), 'Trasporti › Carburante');
  assert.strictEqual(g('Bolletta gas'), 'Casa › Utenze');
  assert.strictEqual(g('Mutuo casa'), 'Casa › Mutuo e affitto');
  assert.strictEqual(g('Bollo auto'), 'Finanza e tasse › Tasse e imposte');
  assert.strictEqual(g('Manutenzione macchina'), 'Trasporti › Auto e moto');
  assert.strictEqual(g('Telepass'), 'Trasporti › Pedaggi e parcheggi');
  assert.strictEqual(g('Assegno unico', 'bonus'), 'Entrate › Assegni e bonus');
  assert.strictEqual(FC.guess('Fondo pensione', 'expense', tax).kind, 'saving');
  assert.strictEqual(FC.guess('Assegno unico', 'bonus', tax).isNew, true);      // categoria da creare
  // Se hai spostato una categoria in un'altra famiglia, la proposta segue la tua tassonomia
  const mine = [{ family: 'Auto', categories: ['Carburante'] }];
  assert.strictEqual(FC.resolve('Trasporti', 'Carburante', mine).family, 'Auto');
  assert.strictEqual(FC.guess('Voce misteriosa xyz', 'expense', tax).category, '');
});

test('totali al mese e quota da accantonare per le spese non mensili', () => {
  const items = [
    { name: 'Mutuo', section: 'expense', kind: 'expense', amount: 60000, every: 1 },
    { name: 'RCA', section: 'expense', kind: 'expense', amount: 48000, every: 12 },
    { name: 'Fondo pensione', section: 'expense', kind: 'saving', amount: 10000, every: 1 },
    { name: 'Prova esclusa', section: 'expense', kind: 'expense', amount: 99900, every: 1, active: false },
    { name: 'Assegno', section: 'bonus', kind: 'income', amount: 14000, every: 1 }
  ];
  assert.deepStrictEqual(FC.totals(items), { expense: 64000, saving: 10000, bonus: 14000, out: 74000, net: 60000, setAside: 4000 });
  assert.strictEqual(FC.periodName(48), 'Ogni 4 anni');
  assert.strictEqual(FC.periodName(5), 'Ogni 5 mesi');
  assert.strictEqual(FC.groupOf(120), 'Ogni 4 anni e oltre');
});

test('giudizio: ottimistica, pessimistica, coerente', () => {
  assert.strictEqual(FC.verdict(10000, 10500, 'out').code, 'coherent');
  assert.strictEqual(FC.verdict(10000, 13000, 'out').code, 'optimistic');     // spendi più del previsto
  assert.strictEqual(FC.verdict(10000, 7000, 'out').code, 'pessimistic');
  assert.strictEqual(FC.verdict(10000, 7000, 'in').code, 'optimistic');       // incassi meno del previsto
  assert.strictEqual(FC.verdict(0, 5000, 'out').code, 'missing');
  assert.strictEqual(FC.verdict(5000, 0, 'out').code, 'unseen');
  assert.strictEqual(FC.verdict(1000, 2400, 'out').code, 'coherent');         // differenze sotto i 15 € al mese
});

test('confronto con i movimenti reali degli ultimi mesi completi', () => {
  let id = 0;
  const tx = (date, cents, kind, category) => ({ id: ++id, date, cents, kind, category, family: '', state: 'active', status: 'SI', details: category });
  const txs = [];
  for (const m of ['2026-01', '2026-02', '2026-03']) {
    txs.push(tx(m + '-05', -70000, 'expense', 'Mutuo e affitto'));
    txs.push(tx(m + '-10', -12000, 'expense', 'Utenze'));
    txs.push(tx(m + '-15', -40000, 'expense', 'Supermercato'));
    txs.push(tx(m + '-20', 15000, 'income', 'Assegni e bonus'));
  }
  txs.push(tx('2026-04-02', -99999, 'expense', 'Utenze'));                 // mese in corso: escluso
  const tax = C.DEFAULT_TAXONOMY.map(f => (f.family === 'Entrate' ? { family: 'Entrate', categories: f.categories.concat('Assegni e bonus') } : f));
  const win = FC.lastMonths(txs, null, 12, '2026-04-10');
  assert.deepStrictEqual(win.list, ['2026-01', '2026-02', '2026-03']);
  // Con le importazioni: fuori i mesi non coperti dai file e quelli con un buco importante
  const gaps = { first: '2025-12-15', last: '2026-03-31', gaps: [{ start: '2026-02-10', end: '2026-02-20', level: 'alta' }, { start: '2026-03-07', end: '2026-03-08', level: 'minima' }] };
  assert.deepStrictEqual(FC.lastMonths(txs, gaps, 12, '2026-04-10').list, ['2026-01', '2026-03']);
  const items = [
    { name: 'Mutuo', section: 'expense', kind: 'expense', amount: 70000, every: 1, family: 'Casa', category: 'Mutuo e affitto' },
    { name: 'Gas', section: 'expense', kind: 'expense', amount: 9000, every: 1, family: 'Casa', category: 'Utenze', match: 'utenze' },
    { name: 'Assegno', section: 'bonus', kind: 'income', amount: 15000, every: 1, family: 'Entrate', category: 'Assegni e bonus' }
  ];
  const r = FC.compare(items, txs, { links: [], all: txs, taxonomy: tax }, win);
  assert.strictEqual(r.months, 3);
  assert.deepStrictEqual([r.expense.forecast, r.expense.actual, r.expense.verdict.code], [79000, 122000, 'optimistic']);
  const casa = r.expense.rows.find(x => x.family === 'Casa');
  assert.deepStrictEqual([casa.forecast, casa.actual, casa.verdict.code], [79000, 82000, 'coherent']);
  assert.strictEqual(casa.cats.find(c => c.category === 'Utenze').verdict.code, 'optimistic');
  assert.deepStrictEqual(r.unplanned.map(x => x.family), ['Alimentari']);
  assert.deepStrictEqual([r.bonus.forecast, r.bonus.actual, r.bonus.verdict.code], [15000, 15000, 'coherent']);
  assert.strictEqual(r.itemActual[0].actual, 12000);                      // voce "Gas" ritrovata con la parola "utenze"
});

test('accantonamenti e voci rare', () => {
  const tx = (id, date, cents, kind, category) => ({ id, date, cents, kind, category, family: 'Movimenti interni', state: 'active', status: 'SI' });
  const txs = [tx(1, '2026-01-10', -5000, 'saving', 'Fondo pensione'), tx(2, '2026-02-10', -5000, 'saving', 'Fondo pensione')];
  const win = FC.lastMonths(txs, null, 12, '2026-03-01');
  const items = [
    { name: 'Fondo pensione', section: 'expense', kind: 'saving', amount: 10000, every: 1, family: 'Movimenti interni', category: 'Fondo pensione' },
    { name: 'Cambio auto', section: 'expense', kind: 'expense', amount: 1200000, every: 120, family: 'Trasporti', category: 'Auto e moto' }
  ];
  const ctx = { links: [], all: txs, taxonomy: C.DEFAULT_TAXONOMY };
  const all = FC.compare(items, txs, ctx, win);
  assert.strictEqual(all.saving.verdict.code, 'optimistic');               // metti da parte meno del previsto
  assert.strictEqual(all.expense.forecast, 10000);                          // il cambio auto pesa 100 € al mese
  const fair = FC.compare(items, txs, ctx, win, { excludeRare: true });
  assert.strictEqual(fair.expense.forecast, 0);                             // su 2 mesi di dati il cambio auto non conta
  assert.deepStrictEqual(fair.rare.map(it => it.name), ['Cambio auto']);
});

test('prossimi 12 mesi: rate nel loro mese, il resto accantonato', () => {
  const items = [
    { name: 'Mutuo', section: 'expense', amount: 60000, every: 1 },
    { name: 'RCA', section: 'expense', amount: 48000, every: 12, month: 6 },
    { name: 'IMU', section: 'expense', amount: 25000, every: 6, month: 6 },
    { name: 'Cambio auto', section: 'expense', amount: 2400000, every: 120 },
    { name: 'Assegno', section: 'bonus', amount: 14000, every: 1 }
  ];
  const p = FC.projection(items, '2026-01', 12);
  const june = p.find(x => x.month === '2026-06'), dec = p.find(x => x.month === '2026-12'), jan = p[0];
  assert.deepStrictEqual([june.base, june.due, june.provision], [60000, 73000, 20000]);
  assert.deepStrictEqual(june.dueItems, ['RCA', 'IMU']);
  assert.strictEqual(dec.due, 25000);                                       // seconda rata dell'IMU
  assert.deepStrictEqual([jan.due, jan.out, jan.net], [0, 80000, 66000]);
  // Quota al mese: cambio auto 200 €, IMU 41,67 €, RCA 40 €
  assert.deepStrictEqual(FC.setAsideList(items).map(x => [x.item.name, x.monthly]), [['Cambio auto', 20000], ['IMU', 4167], ['RCA', 4000]]);
});
