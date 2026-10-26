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
  // before the first run (meta.runs 0) too
  const fresh = /** @type {any} */ ({ story: {}, meta: { ...newMeta(), beans: 1 } });
  R.relGift(fresh.meta, 'hazel', GAME_DATA.relations);
  assert.equal(conditionHolds('gifted:hazel', storyStateOf(fresh)), true, 'a gift before any run');
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

test('RL-S2 part B: a favour asked is paid on the way home once its check holds: the quest done, its points, once', () => {
  const FL = {
    ...RL,
    people: {
      hazel: { ...RL.people.hazel, favour: { quest: 'fav_hazel', check: 'last:row >= 6' } },
      chosen: { ...RL.people.chosen, favour: { quest: 'fav_chosen', check: 'last:leaders >= 1', points: 3 } },
    },
  };
  const s = { meta: { ...newMeta(), runs: 1 }, story: { quests: { fav_hazel: 'asked' } }, wardrobe: { owned: {} } };
  const row = n => ({
    seed: 'S',
    theme: '',
    region: '',
    exp: 1,
    end: 'lost',
    by: null,
    row: n,
    days: 5,
    team: [],
    perks: [],
    leaders: [{ id: 'marina', beat: 1 }],
    rival: null,
  });
  const holds = c => conditionHolds(c, storyStateOf(s));
  s.meta.history = [row(3)];
  assert.deepEqual(R.relFavoursPay(s, holds, FL), [], 'not far enough: still asked');
  assert.equal(s.story.quests.fav_hazel, 'asked');
  s.meta.history.push(row(7));
  s.meta.rel = { hazel: 3 };
  assert.deepEqual(R.relFavoursPay(s, holds, FL), [{ who: 'hazel', quest: 'fav_hazel', points: 2, from: 2, to: 3 }]);
  assert.deepEqual([s.story.quests.fav_hazel, s.meta.rel.hazel, s.wardrobe.owned.tee], ['done', 5, 1]);
  assert.equal(s.meta.rel.chosen, undefined, 'a favour never asked is never paid, its check holding or not');
  assert.deepEqual(R.relFavoursPay(s, holds, FL), [], 'paid once');
  s.story.quests.fav_chosen = 'asked';
  assert.deepEqual(R.relFavoursPay(s, holds, FL), [{ who: 'chosen', quest: 'fav_chosen', points: 3, from: 0, to: 2 }]);
  assert.ok(conditionHolds('quest:fav_chosen = done', storyStateOf(s)));
});

test("RL-S2 part B: Chapter 1's beats come one a return, in order, each once; chapter1-end moves the story to chapter 2", async () => {
  const B = GAME_DATA.banter,
    { storyPick, storyPickSaid } = modules['story-pick'];
  const save = /** @type {any} */ ({ story: {}, items: {}, pyramids: {}, meta: { ...newMeta() } });
  const entry = (o = {}) => ({
    seed: 'S',
    theme: '',
    region: '',
    exp: 1,
    end: 'lost',
    by: null,
    row: 2,
    days: 4,
    team: [],
    perks: [],
    leaders: [],
    rival: null,
    ...o,
  });
  /** a return as story-stage.js storyHomeArrive plays it: the run kept, each hub person's line picked (a must line
   * not yet heard kept), then the talks (skipping who is in `skip`), each playing its script (a beat's `set`) */
  let fresh = {};
  const home = async (e, o = {}, skip = []) => {
    save.meta.history.push(e);
    save.meta.runs = save.meta.history.length;
    Object.assign(save.meta, o);
    const was = fresh;
    fresh = {};
    for (const who of ['chosen', 'hazel']) {
      const S = storyStateOf(save),
        keep = was[who] && B[was[who]].must ? was[who] : null,
        k = keep || storyPick(who, B, c => conditionHolds(c, S), save.story, save.meta.runs);
      if (!k) continue;
      if (!keep) storyPickSaid(k, B, save.story, save.meta.runs);
      fresh[who] = k;
    }
    const said = [];
    for (const [who, k] of Object.entries(fresh)) {
      if (skip.includes(who)) continue;
      delete fresh[who];
      await runScript(parseScript(B[k].script), { say: () => {}, choose: () => 0 }, { save, id: 'banter:' + k });
      said.push(k);
    }
    return said.filter(k => k.startsWith('ch1_'));
  };
  assert.deepEqual(await home(entry(), {}, ['hazel']), [], 'Hazel not talked to: her beat waits');
  assert.deepEqual(await home(entry()), ['ch1_drop'], 'and is said the next time');
  assert.deepEqual(await home(entry()), [], 'Blake not met yet');
  assert.deepEqual(await home(entry({ rival: { met: 1, won: 0 } }), { beans: 1 }), ['ch1_blake']);
  assert.deepEqual(await home(entry()), ['ch1_beans']);
  assert.deepEqual(await home(entry({ by: { kind: 'route', id: 'bureau_clerk', bureau: 1 } })), ['ch1_number']);
  assert.deepEqual(await home(entry({ by: { kind: 'boss', id: 'x' } })), ['ch1_signal']);
  assert.deepEqual(await home(entry({ by: { kind: 'boss', id: 'x' } })), [], 'each once');
  assert.equal(save.meta.chapter || 1, 1);
  await runScript(
    parseScript(GAME_DATA.story.scripts['chapter1-end'].script),
    { say: () => {}, choose: () => 0 },
    { save, id: 'story:chapter1-end' }
  );
  assert.equal(save.meta.chapter, 2);
});
