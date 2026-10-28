// PK-5: Wave C's effect kinds (perks-track.md 5.4 and section 7): catchLevel, refund, inflict at a battle's start,
// a money share on arrival, free, salvage and the run rules rewardPick, rerollFree and mapReveal, each with test-only
// Perks first; then the 12 Wave C Perks of perks.json, each working, and every Perk of Waves A-C held at once staying
// finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { SPECIES } = data;
/** a species of type T (one of that type alone when there is one) */
const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of these species (the first leads), holding these rows; extra laid over */
function battle(fx, team, extra = {}, lvl = 20, foeSp = ofType('Grass')) {
  reseed(7);
  const s = startedSave(team[0], lvl);
  for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, lvl));
  const foe = fn('makeBilly')(foeSp, lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test-c', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
const foe = b => b.sides[1].team[0];
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};

/* ---------- catchLevel ---------- */

test('PK-5 catchLevel: a caught Billie joins n levels higher, learning on the way; none without the row', () => {
  const { P, fx } = perks({ id: 'test_tags', name: 'Test Tags', fx: [{ kind: 'catchLevel', n: 2 }] });
  withPerks(P, () => {
    const b = battle(fx, [ofType('Fire')], {}, 20),
      e = foe(b),
      lvl = e.lvl;
    e.hp = 1;
    fn('catchKeep')(e);
    assert.equal(e.lvl, lvl + 2);
    assert.ok(e.hp > 1, 'its HP rose with the levels');
    assert.ok(lines(b).includes(`Test Tags: ${fn('billyName')(e)} joins at level ${lvl + 2}.`), lines(b).join(' | '));
    assert.ok(!lines(b).some(t => t.includes('grew to level')), 'no line a level');
  });
  const c = battle(null, [ofType('Fire')], {}, 20),
    e2 = foe(c);
  fn('catchKeep')(e2);
  assert.equal(e2.lvl, 20);
  /* a condition that doesn't hold: no levels */
  const { fx: fx2 } = perks({ fx: [{ kind: 'catchLevel', n: 3, if: 'foe:spliced' }] });
  const d = battle(fx2, [ofType('Fire')], {}, 20),
    e3 = foe(d);
  fn('catchKeep')(e3);
  assert.equal(e3.lvl, 20);
  assert.equal(
    fn('fxCatchLevel')([
      { kind: 'catchLevel', n: 8 },
      { kind: 'catchLevel', n: 8 },
    ]),
    10
  );
});

/* ---------- refund ---------- */

/** the battle's stream, giving these values in turn (the last again when they run out) while `run` runs */
const rolls = (b, vs, run) => {
  const rng = b.rng,
    L = [].concat(vs);
  b.rng = () => (L.length > 1 ? L.shift() : L[0]);
  try {
    return run();
  } finally {
    b.rng = rng;
  }
};

test('PK-5 refund: the first pyramid that misses in a battle comes back (once: battle); a catch gives none back', () => {
  const { P, fx } = perks({
    id: 'test_pouch',
    name: 'Test Pouch',
    fx: [{ kind: 'refund', what: 'pyramid', when: 'throwMiss', once: 'battle' }],
  });
  withPerks(P, () => {
    const b = battle(fx, [ofType('Fire')]);
    const miss = () => rolls(b, [0.99], () => fn('catchRoll')('pyramid', 1, false, b));
    const a = miss();
    assert.equal(a.caught, false);
    assert.equal(a.refund, 'Test Pouch');
    const c = miss();
    assert.equal(c.caught, false);
    assert.equal(c.refund, undefined, 'once a battle');
    /* a new battle: back again */
    const b2 = battle(fx, [ofType('Fire')]);
    assert.equal(rolls(b2, [0.99], () => fn('catchRoll')('pyramid', 1, false, b2)).refund, 'Test Pouch');
    /* a catch: nothing back, and the mark not spent */
    const b3 = battle(fx, [ofType('Fire')]);
    const got = rolls(b3, [0.99, 0], () => fn('catchRoll')('pyramid', 1, false, b3));
    assert.equal(got.caught, true);
    assert.equal(got.refund, undefined);
    assert.equal(rolls(b3, [0.99], () => fn('catchRoll')('pyramid', 1, false, b3)).refund, 'Test Pouch');
  });
  /* none held: no refund, and the same rolls taken */
  const b = battle(null, [ofType('Fire')]);
  assert.equal(rolls(b, [0.99], () => fn('catchRoll')('pyramid', 1, false, b)).refund, undefined);
});

/* ---------- inflict at battleStart ---------- */

test('PK-5 inflict at battleStart: each wild foe on the field gets the status on its roll, after the sides come out', () => {
  const { P, fx } = perks({
    id: 'test_box',
    name: 'Test Box',
    fx: [{ kind: 'inflict', status: 'slp', chance: 0.2, when: 'battleStart', if: 'foe:wild' }],
  });
  withPerks(P, () => {
    /* a roll under the chance: asleep, the line after the start's */
    const b = battle(fx, [ofType('Fire')]);
    assert.ok(b.fxStartInflict, 'waits for the sides');
    rolls(b, [0.1, 0], () => fn('sayBattleFx')());
    assert.equal(foe(b).status, 'slp');
    assert.ok(lines(b).includes('Test Box kicked in!'), lines(b).join(' | '));
    assert.equal(b.fxStartInflict, undefined);
    /* over it: awake */
    const c = battle(fx, [ofType('Fire')]);
    rolls(c, [0.5], () => fn('sayBattleFx')());
    assert.equal(foe(c).status, null);
    /* a trainer's: the condition doesn't hold, nothing waits */
    reseed(7);
    startedSave(ofType('Fire'), 20);
    assert.ok(
      fn('newBattle')('trainer', [fn('makeBilly')(ofType('Grass'), 20)], { fmt: 'single', seed: 'perk-test-c', fx })
    );
    assert.equal(hooks.activeBattle.fxStartInflict, undefined);
  });
  /* none held: nothing waits, no roll */
  const d = battle(null, [ofType('Fire')]);
  assert.equal(d.fxStartInflict, undefined);
});

/* ---------- money share on arrival ---------- */

test('PK-5 money share: walking in pays a share of the Moneys carried, up to its most; none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_jar', fx: [{ kind: 'money', share: 0.1, max: 40, when: 'arrive' }] });
  const walk = se => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.se = se;
    s.run = { perks: ['test_jar'], perkState: {} };
    const out = {};
    L.runArriveFx(s, P, out);
    return [s.se, out.money];
  };
  assert.deepEqual(walk(125), [137, 12]);
  assert.deepEqual(walk(1000), [1040, 40], 'at most 40');
  assert.deepEqual(walk(5), [5, 0]);
  /* none held: nothing paid */
  reseed(3);
  const s = startedSave(ofType('Water'), 30);
  s.se = 500;
  s.run = { perks: [], perkState: {} };
  const out = {};
  L.runArriveFx(s, P, out);
  assert.deepEqual([s.se, out.money], [500, 0]);
  /* a battle's money ignores the share row */
  assert.equal(fn('fxMoney')([{ kind: 'money', share: 0.1, max: 40, when: 'arrive', src: 'x' }], 100), 100);
});

/* ---------- free ---------- */

test('PK-5 free: every 4th purchase gives its price back, and the count lasts the run; none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_card', fx: [{ kind: 'free', when: 'buy', every: 4 }] });
  reseed(3);
  const s = startedSave(ofType('Water'), 30);
  s.se = 1000;
  s.run = { perks: ['test_card'], perkState: {} };
  const got = [];
  for (let i = 0; i < 8; i++) {
    s.se -= 100;
    got.push(L.runBuyFx(s, P, 100).free);
  }
  assert.deepEqual(got, [0, 0, 0, 100, 0, 0, 0, 100]);
  assert.equal(s.se, 400);
  assert.equal(L.runBuyFx(s, P, 100).by, '');
  s.run.perks = [];
  assert.equal(L.runBuyFx(s, P, 100).free, 0);
});

/* ---------- salvage ---------- */

test('PK-5 salvage: beaten bots leave their parts offered and Scrap times mult; as before without the row', () => {
  const F = modules.factions,
    fac = GAME_DATA.factions.factions,
    S = fac.bureau.salvage,
    bot = B => fn('trainerTeam')({ team: [F.factionBotEntry(fac.bureau.bots[B], 10)] })[0];
  const pick = fx => {
    reseed(7);
    startedSave(ofType('Fire'), 20);
    assert.ok(
      fn('newBattle')('wild', [bot('repo'), bot('courier')], { fmt: 'double', seed: 'salv', ...(fx ? { fx } : {}) })
    );
    const run = { seed: 'SALVSEED01', perks: [] };
    assert.equal(fn('battleSalvage')(hooks.activeBattle, run), true);
    return run.enc.reward.cards;
  };
  const plain = pick(null),
    parts = F.salvageParts([bot('repo'), bot('courier')]);
  assert.equal(plain.filter(c => c.kind === 'part').length, S.parts);
  assert.equal(plain.at(-1).n, S.scrap + S.scrapPerBot);
  const { fx } = perks({ fx: [{ kind: 'salvage', mult: 2 }] });
  const twice = pick(fx);
  assert.equal(twice.filter(c => c.kind === 'part').length, Math.min(parts.length, S.parts * 2));
  assert.equal(twice.at(-1).n, 2 * S.scrap + 2 * S.scrapPerBot);
  assert.equal(fn('fxSalvage')(null, S), S);
});

/* ---------- rule rewardPick ---------- */

/** a run on the game's data, its team of these species */
function runSave(perkIds, sp = ofType('Water')) {
  reseed(3);
  const s = startedSave(sp, 30);
  s.run = modules['run-state'].newRun('WAVECSEED1', 1, 1, { team: [] });
  s.run.perks = perkIds;
  return s;
}

test('PK-5 rule rewardPick: reward picks show n more cards, rerolls too; as before without the row', () => {
  const W = modules.rewards,
    { P } = perks({ id: 'test_receipt', fx: [{ kind: 'rule', rule: 'rewardPick', n: 1 }] }),
    pick = GAME_DATA.rules.run.rewards.pick;
  withPerks(P, () => {
    const s = runSave(['test_receipt']);
    s.se = 9999;
    const R = W.rewardOfferMake(s.run, 'test', W.rewardDataGame(s.team));
    assert.equal(R.cards.length, pick + 1);
    assert.equal(W.rewardReroll(s.run, s, W.rewardDataGame(s.team)), '');
    assert.equal(s.run.enc.reward.cards.length, pick + 1, 'a reroll shows as many');
    /* an event's pick of n: one more too */
    assert.equal(W.rewardOfferMake(s.run, 'event:x', W.rewardDataGame(s.team), { n: 2 }).cards.length, 3);
    const t = runSave([]);
    assert.equal(W.rewardOfferMake(t.run, 'test', W.rewardDataGame(t.team)).cards.length, pick);
    assert.equal(t.run.enc.reward.n, undefined, 'no count kept without the row');
  });
});

/* ---------- rule rerollFree ---------- */

test('PK-5 rule rerollFree: the first n rerolls of each reward pick are free, then the price grows as before', () => {
  const W = modules.rewards,
    RULE = GAME_DATA.rules.run.rewards,
    { P } = perks({ id: 'test_cookie', fx: [{ kind: 'rule', rule: 'rerollFree', n: 1 }] });
  withPerks(P, () => {
    const s = runSave(['test_cookie']);
    s.se = 1000;
    W.rewardOfferMake(s.run, 'test', W.rewardDataGame(s.team));
    assert.equal(W.rewardRerollCost(s.run.enc.reward, RULE, W.rewardRerollFree(s.run)), 0);
    assert.equal(W.rewardReroll(s.run, s, W.rewardDataGame(s.team)), '');
    assert.equal(s.se, 1000, 'the first was free');
    assert.equal(W.rewardRerollCost(s.run.enc.reward, RULE, W.rewardRerollFree(s.run)), RULE.reroll);
    assert.equal(W.rewardReroll(s.run, s, W.rewardDataGame(s.team)), '');
    assert.equal(s.se, 1000 - RULE.reroll, 'then the first price');
    /* the next pick: free again */
    W.rewardOfferMake(s.run, 'test', W.rewardDataGame(s.team));
    assert.equal(W.rewardRerollCost(s.run.enc.reward, RULE, W.rewardRerollFree(s.run)), 0);
    const t = runSave([]);
    W.rewardOfferMake(t.run, 'test', W.rewardDataGame(t.team));
    assert.equal(W.rewardRerollCost(t.run.enc.reward, RULE, W.rewardRerollFree(t.run)), RULE.reroll);
  });
});
