// RL-S2: logic/relations.js, the hub's folk and you: levels from points, a gift (its Beans, once a person each time
// home), a favour's points, the levels reached, the run's bonuses (effect rows, the bag at takeoff), the conditions
// rel:, beans and gifted:, and the script commands beans, gift and rel on the game's own relations.json.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules, startedSave } from './setup-real.mjs';

const R = modules.relations,
  { newMeta, validMeta } = modules['meta-state'],
  { storyStateOf, conditionHolds } = modules.conditions,
  { parseScript } = modules['script-parse'],
  { runScript } = modules.script,
  { fxOfRun } = modules.effects,
  { validRun } = modules['run-state'];
const RL = {
  gift: { cost: 1, points: 1, favour: 2 },
  people: {
    hazel: { levels: [{ at: 1 }, { at: 2, items: { potion: 1 } }, { at: 4, wardrobe: 'tee' }] },
    chosen: { levels: [{ at: 1 }, { at: 3, fx: [{ kind: 'money', mult: 1.1 }] }] },
  },
};

test('levels from points; a gift costs a Bean, once a person each time home; a favour adds points', () => {
  const P = RL.people.hazel;
  assert.deepEqual(
    [0, 1, 2, 3, 4, 99].map(n => R.relLevel(n, P)),
    [0, 1, 2, 2, 3, 3]
  );
  const m = { ...newMeta(), beans: 2, runs: 3 };
  assert.equal(R.relGiftBlock(m, 'blake', RL), 'nobody');
  assert.deepEqual(R.relGift(m, 'hazel', RL), { from: 0, to: 1 });
  assert.deepEqual([m.beans, m.rel.hazel, m.gifted.hazel], [1, 1, 3]);
  assert.equal(R.relGiftBlock(m, 'hazel', RL), 'given', 'one gift a person until the next run');
  assert.equal(R.relGift(m, 'hazel', RL), null);
  assert.deepEqual(R.relGift(m, 'chosen', RL), { from: 0, to: 1 });
  assert.equal(R.relGiftBlock(m, 'chosen', RL), 'beans');
  m.runs = 4;
  m.beans = 1;
  assert.deepEqual(R.relGift(m, 'hazel', RL), { from: 1, to: 2 }, 'home again: one more');
  assert.deepEqual(R.relAdd(m, 'hazel', RL.gift.favour, RL), { from: 2, to: 3 });
  assert.deepEqual(R.relReached('hazel', { from: 1, to: 3 }, RL), P.levels.slice(1, 3));
  assert.deepEqual(R.relLevels(m, RL), { hazel: 3, chosen: 1 });
  assert.equal(validMeta(m), true);
});

test("a run's bonuses: the levels it took off with, their rows tagged rel:<who>, their items in the bag", () => {
  const s = { meta: { ...newMeta(), rel: { hazel: 2, chosen: 3 } }, run: { perks: [] }, items: { potion: 1 } };
  const got = R.relTakeoff(/** @type {any} */ (s), RL);
  assert.deepEqual(s.run.rel, { hazel: 2, chosen: 2 });
  assert.deepEqual(got.items, { potion: 1 });
  assert.equal(s.items.potion, 2);
  assert.deepEqual(R.relFxRows(s.run, RL), [{ kind: 'money', mult: 1.1, src: 'rel:chosen' }]);
  assert.deepEqual(R.relFxRows({ perks: [] }, RL), [], 'a run from before has none');
});

test("the game's relations: a Bean to Chosen at level 2 pays his Moneys row on the next run; the run keeps the levels", () => {
  const G = GAME_DATA.relations,
    rows = fxOfRun({ perks: [], rel: { chosen: 2 } }, GAME_DATA.perks) || [];
  assert.ok(G.people.chosen.levels[1].fx, 'the placeholder: level 2 is a Moneys row');
  assert.ok(rows.some(f => f.src === 'rel:chosen' && f.kind === 'money'));
  assert.equal(validRun({ ...minimalRun(), rel: { chosen: 2 } }), true);
  assert.equal(validRun({ ...minimalRun(), rel: { chosen: 11 } }), false);
});

test('the story reads rel:, beans and gifted:; the commands give Beans, a gift and a favour', async () => {
  const save = /** @type {any} */ ({
    story: {},
    items: {},
    pyramids: {},
    meta: { ...newMeta(), runs: 2, beans: 0 },
    wardrobe: { owned: {}, outfits: [null, null, null] },
  });
  const holds = c => conditionHolds(c, storyStateOf(save));
  assert.equal(holds('beans >= 1'), false);
  const said = [];
  await runScript(
    parseScript([
      'beans 2',
      'if beans >= 1 and not gifted:hazel',
      '  gift hazel',
      'gift hazel',
      'rel juniper 2',
      'if rel:hazel >= 1',
      '  Hazel: Thanks.',
    ]),
    { say: l => said.push(l.text), choose: () => 0 },
    { save, id: 'test' }
  );
  assert.deepEqual([save.meta.beans, save.meta.rel.hazel, save.meta.rel.juniper], [1, 1, 2]);
  assert.deepEqual(said, ['Thanks.']);
  assert.equal(holds('gifted:hazel and rel:hazel = 1 and beans = 1'), true);
  save.meta.runs = 3;
  assert.equal(holds('gifted:hazel'), false, 'a new run: a gift can be given again');
});

/** a run as runBegin starts it (the load check takes it) */
function minimalRun() {
  const s = startedSave('musk0', 5);
  s.meta = newMeta();
  s.run = null;
  return modules['run-state'].runBegin(s, { seed: 'RELSEED', expedition: 1, mapgenV: 1, se: 0, items: {} });
}

test('Beans found: into meta at once, counted on the run; a won run pays beansWin; the crate event gives some', () => {
  const s = { meta: { ...newMeta() }, run: { beans: 0 } };
  R.runBeans(s, 2);
  R.runBeans(s, 0);
  assert.deepEqual([s.meta.beans, s.run.beans], [2, 2]);
  const hub = { meta: { ...newMeta() } };
  R.runBeans(hub, 1);
  assert.equal(hub.meta.beans, 1, 'in the hub: no run to count on');
  const { payoutOf } = modules['run-state'],
    P = GAME_DATA.rules.run.payout,
    end = { se: 0, items: {}, released: 0, cleared: 3 };
  assert.equal(payoutOf({ ...end, won: true }, P, () => 0).beans, P.beansWin);
  assert.equal(payoutOf({ ...end, won: false }, P, () => 0).beans, 0);
  const crate = JSON.stringify(GAME_DATA.events.events.beans_crate);
  assert.match(crate, /"\s*beans \d"/, 'the crate holds Beans');
});

test('the chapter: chapter >= n reads meta.chapter; the command moves it on, never back', async () => {
  const save = /** @type {any} */ ({ story: {}, items: {}, pyramids: {}, meta: { ...newMeta() } });
  const holds = c => conditionHolds(c, storyStateOf(save));
  assert.equal(holds('chapter = 1'), true);
  await runScript(parseScript(['chapter 2', 'chapter 1']), { say: () => {}, choose: () => 0 }, { save, id: 'test' });
  assert.equal(save.meta.chapter, 2);
  assert.equal(holds('chapter >= 2'), true);
  assert.equal(validMeta(save.meta), true);
});
