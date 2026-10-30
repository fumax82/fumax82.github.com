// Test dell'anagrafica soggetti e dei controlli sui doppioni. Avvio: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const C = require('../www/js/logic/classify.js');
const FL = require('../www/js/logic/fields.js');
const SJ = require('../www/js/logic/subjects.js');
const D = require('../www/js/logic/duplicates.js');

let id = 1;
const tx = o => Object.assign({ id: id++, date: '2026-03-01', operation: 'Pagamento POS', details: '', account: 'Carta 1', accountUser: '',
  cents: -1000, status: 'SI', state: 'active', kind: 'expense', category: '', family: '', classifiedBy: '', source: 'bank', person: 'Famiglia', note: '', extra: {} }, o);

const claude = { id: 's1', name: 'Claude (Anthropic)', description: 'Abbonamento AI', direction: 'out', match: 'anthropic|claude.ai',
  set: { class: { family: 'Tecnologia e abbonamenti', category: 'AI' }, need: 'utile', nature: 'fissa' }, auto: true, since: 0 };

test('soggetto: riconoscimento, direzione, collegamento manuale e parola più precisa', () => {
  const a = tx({ details: 'ANTHROPIC* CLAUDE.AI SUBSCR' }), refund = tx({ details: 'ANTHROPIC REFUND', cents: 500 });
  const pinnedOut = tx({ details: 'ANTHROPIC', extra: { subject: '-' } }), pinnedIn = tx({ details: 'BONIFICO XYZ', extra: { subject: 's1' } });
  const gen = { id: 's2', name: 'Generico', match: 'pos', direction: 'any', set: {} };
  assert.strictEqual(SJ.subjectOf(a, [gen, claude]), claude, '"anthropic" è più preciso di "pos"');
  assert.strictEqual(SJ.subjectOf(refund, [claude]), null, 'solo uscite');
  assert.strictEqual(SJ.subjectOf(pinnedOut, [claude]), null, 'escluso a mano');
  assert.strictEqual(SJ.subjectOf(pinnedIn, [claude]), claude, 'collegato a mano');
});

test('soggetto: lista da confermare con valori attuali e nuovi, spunte rispettose delle scelte manuali', () => {
  const a = tx({ details: 'ANTHROPIC PBC', category: 'Altre uscite' });
  const mine = tx({ details: 'ANTHROPIC PBC', category: 'Lavoro', family: 'Lavoro', classifiedBy: 'user' });
  const rows = SJ.proposals(claude, [a, mine], [claude], C.DEFAULT_TAXONOMY);
  const ck = r => Object.fromEntries(r.changes.map(c => [c.key, c.checked]));
  assert.deepStrictEqual(ck(rows.find(r => r.tx.id === a.id)), { class: true, need: true, nature: true });
  assert.strictEqual(ck(rows.find(r => r.tx.id === mine.id)).class, false, 'categoria scelta a mano: chiede');
});

test('soggetto: assegnazione automatica solo ai movimenti nuovi, prima di memoria e regole', () => {
  const old = tx({ details: 'ANTHROPIC PBC' });
  const s = Object.assign({}, claude, { since: old.id });
  const fresh = tx({ details: 'ANTHROPIC PBC' }), manual = tx({ details: 'ANTHROPIC PBC', classifiedBy: 'user', category: 'Lavoro' });
  const prefs = { subjects: [s], rules: [{ id: 'r', text: 'anthropic', set: { category: 'Software e cloud' } }] };
  const edits = FL.autoEdits([old, fresh, manual], prefs);
  assert.deepStrictEqual(edits.map(e => e.id), [fresh.id], 'il vecchio va confermato dalla lista, la regola non interviene');
  assert.strictEqual(edits[0].category, 'AI');
  assert.strictEqual(edits[0].classifiedBy, 'subject:s1');
  assert.deepStrictEqual(edits[0].extra, { need: 'utile', nature: 'fissa' });
  assert.strictEqual(FL.autoEdits([old, fresh], { subjects: [Object.assign({}, s, { auto: false })] }).length, 0, 'automatico disattivabile');
});

test('soggetti da creare: gruppi per controparte con proposta', () => {
  const rows = [tx({ details: 'ESSELUNGA MILANO' }), tx({ details: 'ESSELUNGA MILANO' }), tx({ details: 'ANTHROPIC PBC' })];
  const c = SJ.candidates(rows, { subjects: [claude] });
  assert.strictEqual(c.length, 1, 'Anthropic ha già un soggetto');
  assert.strictEqual(c[0].ids.length, 2);
  assert.strictEqual(c[0].suggestion.category, 'Supermercato');
  assert.strictEqual(SJ.fromTx(rows[0]).match, 'esselunga');
});

const IMPORTS = [{ id: 1, name: 'marzo.xlsx', start: '2026-03-01', end: '2026-03-31' }, { id: 2, name: 'marzo-aprile.xlsx', start: '2026-03-15', end: '2026-04-30' }];

test('doppioni: stesso movimento da due file con descrizione diversa = doppia importazione', () => {
  const a = tx({ date: '2026-03-20', details: 'ESSELUNGA MILANO VIALE PIAVE', cents: -4590, imports: [1] });
  const b = tx({ date: '2026-03-20', details: 'ESSELUNGA SPA MILANO', cents: -4590, imports: [2] });
  const r = D.analyze([a, b], IMPORTS, {});
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].type, 'import');
  assert.strictEqual(r[0].level, 'alta', 'il file 1 copre il 20/03 ma non contiene il secondo');
  assert.match(r[0].reasons.join(' '), /marzo\.xlsx/);
  assert.strictEqual(D.analyze([a, b], IMPORTS, { [r[0].key]: 'distinct' }).length, 0, 'decisione ricordata');
});

test('doppioni: due addebiti uguali nello stesso file = possibile doppio addebito; spese diverse no', () => {
  const a = tx({ date: '2026-03-10', details: 'DECATHLON MILANO', cents: -4590, imports: [1] });
  const b = tx({ date: '2026-03-10', details: 'DECATHLON MILANO', cents: -4590, imports: [1] });
  const c = tx({ date: '2026-03-10', details: 'FARMACIA CENTRALE', cents: -4590, imports: [1] });
  const monthLater = tx({ date: '2026-04-10', details: 'DECATHLON MILANO', cents: -4590, imports: [2] });
  const r = D.analyze([a, b, c, monthLater], IMPORTS, {});
  assert.deepStrictEqual(r.map(x => [x.type, x.level]), [['charge', 'alta']]);
});

test('doppioni: contanti inseriti a mano e pagamento con carta; storno; carta contata due volte', () => {
  const cash = tx({ date: '2026-03-05', details: 'Parrucchiere', source: 'manual', account: 'Contanti', cents: -2500, category: 'Cura della persona' });
  const pos = tx({ date: '2026-03-05', details: 'SALONE BELLEZZA', cents: -2500, category: 'Cura della persona', imports: [1] });
  const buy = tx({ date: '2026-03-07', details: 'ZALANDO', cents: -3999, imports: [1] });
  const back = tx({ date: '2026-03-15', details: 'ZALANDO RIMBORSO', cents: 3999, kind: 'refund', imports: [1] });
  const c1 = tx({ date: '2026-02-10', details: 'AMAZON', cents: -3000, account: 'Carta Visa' });
  const c2 = tx({ date: '2026-02-20', details: 'IKEA', cents: -7000, account: 'Carta Visa' });
  const bal = tx({ date: '2026-03-15', operation: 'Addebito', details: 'SALDO CARTA DI CREDITO VISA', cents: -10000, account: 'Conto corrente' });
  const types = D.analyze([cash, pos, buy, back, c1, c2, bal], IMPORTS, {}).map(x => x.type).sort();
  assert.deepStrictEqual(types, ['card', 'manual', 'reversal']);
});
