// PK-8: Perk sets (perks-track.md 5.7) and the kinds their bonuses need, in battle and on the run. heldBoost (the Tech
// Gear set): your Billies' held items work better, a foe's as they are; nothing held, or no boost: nothing changes.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const E = modules.effects;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wildSpecies = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));
const BOOST = [{ kind: 'heldBoost', mult: 1.5, src: 'test' }];

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
  reseed(7);
});

/** a single wild battle, your lead holding `held` (and the foe `foeHeld`), the run's rows `fx` */
function battle(held, foeHeld, fx) {
  const s = startedSave(starter(), 12);
  if (held) s.team[0].held = held;
  const foe = fn('makeBilly')(wildSpecies(), 12);
  if (foeHeld) foe.held = foeHeld;
  fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'sets', ...(fx ? { fx } : {}) });
  return { s, B: hooks.activeBattle, me: s.team[0], foe };
}

test('PK-8 fxBoostRow: factors move further from 1, stages, shares and chances grow, within the limits', () => {
  const b = f => E.fxBoostRow(f, 1.5);
  assert.equal(b({ kind: 'damage', side: 'deal', mult: 1.2 }).mult.toFixed(4), '1.3000');
  assert.equal(b({ kind: 'damage', side: 'take', mult: 0.85 }).mult.toFixed(4), '0.7750', 'a take works better too');
  assert.equal(b({ kind: 'stat', stat: 'hus', stages: 1 }).stages, 2, '+1 rounds up to +2');
  assert.equal(b({ kind: 'stat', stat: 'hus', stages: -2 }).stages, -3);
  assert.equal(b({ kind: 'stat', stat: 'hus', stages: 6 }).stages, E.FX_STAGES, 'within FX_STAGES');
  assert.equal(b({ kind: 'turnHeal', share: 0.0625 }).share, 0.09375);
  assert.equal(b({ kind: 'turnHeal', share: 0.8 }).share, 1, 'a share at most 1');
  assert.equal(b({ kind: 'first', chance: 0.2 }).chance.toFixed(2), '0.30');
  assert.equal(b({ kind: 'first', chance: 0.4 }).chance, E.FX_CHANCE, 'a chance at most FX_CHANCE');
  assert.equal(b({ kind: 'pinchHeal', share: 0.25, at: 0.5 }).at, 0.5, 'its threshold as it is');
  assert.equal(b({ kind: 'money', mult: 3 }).mult, E.FX_LIMIT.hi, 'within FX_LIMIT');
  const f = { kind: 'damage', side: 'deal', mult: 1.2 };
  assert.equal(E.fxBoostRow(f, 1), f, 'k 1: the row itself');
  assert.equal(E.fxHeldBoost(null), 1);
  assert.equal(E.fxHeldBoost([...BOOST, { kind: 'heldBoost', mult: 1.2, src: 'x' }]).toFixed(2), '1.80');
});

test('PK-8 fxOfBillie and fxHeldAt: a boost scales the held item’s rows, never the genes’', () => {
  const m = { held: 'brass_knuckles' };
  assert.equal(E.fxOfBillie(m, data.ITEMS)[0].mult, 1.2);
  assert.equal(E.fxOfBillie(m, data.ITEMS, 1.5)[0].mult.toFixed(2), '1.30');
  assert.equal(E.fxOfBillie(m, data.ITEMS, 1.5)[0].src, 'held:brass_knuckles');
  const cf = Object.keys(data.ITEMS).find(k => (data.ITEMS[k].hold || []).some(f => f.when));
  if (cf) {
    const w = data.ITEMS[cf].hold.find(f => f.when).when,
      at = E.fxHeldAt({ held: cf }, data.ITEMS, w, 1.5);
    assert.ok(at.length && at.every(f => f.src === 'held:' + cf));
  }
});

test('PK-8 heldBoost in battle: your holder’s stages, damage and turn heal; a foe’s held item as it is', () => {
  assert.equal(battle('quick_laces').B.sides[0].f[0].v.st.hus, 1);
  assert.equal(battle('quick_laces', null, BOOST).B.sides[0].f[0].v.st.hus, 2, 'Quick Laces +1 is +2');
  assert.equal(battle(null, 'quick_laces', BOOST).B.sides[1].f[0].v.st.hus, 1, 'the foe’s is not boosted');
  assert.equal(fn('heldBoostOf')(battle('quick_laces', null, BOOST).me), 1.5);
  assert.equal(fn('heldBoostOf')(battle(null, 'quick_laces', BOOST).foe), 1);
  assert.equal(fn('heldBoostOf')(battle('quick_laces').me), 1, 'no rows: 1');
  const mid = battle(null).me.moves.find(m => data.MOVES[m].p),
    phys = data.MOVES[mid].c === 'H',
    dmg = fx => {
      battle(phys ? 'brass_knuckles' : 'smart_specs', null, fx);
      reseed(9);
      hooks.activeBattle.rng = null;
      return fn('calcDamage')(0, 1, mid).dmg;
    };
  assert.ok(dmg(BOOST) >= dmg(null), 'it hits at least as hard');
  const { B, me } = battle('leftover_sandwich', null, BOOST),
    mx = fn('maxHp')(me);
  me.hp = Math.floor(mx / 2);
  const at = me.hp;
  fn('endTurn')();
  assert.equal(me.hp, at + Math.max(1, Math.floor(mx * 0.0625 * 1.5)));
  assert.match(JSON.stringify(B.events), /Leftover Sandwich restored a little HP/);
});

test('PK-8 heldBoost: a won battle’s money rows of yours held, boosted', () => {
  const { B } = battle('lucky_coin', null, BOOST),
    rows = fn('battleMoneyFx')(B).filter(f => f.src === 'held:lucky_coin');
  assert.equal(rows[0].mult.toFixed(3), '1.375');
  const { B: B2 } = battle('lucky_coin');
  assert.equal(fn('battleMoneyFx')(B2).find(f => f.src === 'held:lucky_coin').mult, 1.25);
});

/** your Kidling spliced Unstable (the Gene Bank's limit at 0 while it is tidied), in a wild battle with the run's rows */
function unstableBattle(fx) {
  const S = data.GENES.stability,
    was = S.limit;
  const s = startedSave('gates0', 20),
    me = s.team[0];
  me.build = { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' };
  me.graft = { front: 'bear_arm@musk3' };
  S.limit = 0;
  try {
    fn('unstableTidy')(me);
  } finally {
    S.limit = was;
  }
  fn('newBattle')('wild', [fn('makeBilly')('cuban0', 20)], { fmt: 'single', seed: 'genes', ...(fx ? { fx } : {}) });
  return { s, B: hooks.activeBattle, me };
}

test('PK-8 if: unstable holds for an Unstable splice acting, not for a stable Billie', () => {
  assert.equal(E.fxCond('unstable', { unstable: true }), true);
  assert.equal(E.fxCond('unstable', {}), false, 'unknown: false');
  const { me } = unstableBattle();
  assert.ok(fn('billyUnstable')(me));
  assert.equal(fn('fxBattleCtx')(0).unstable, true);
  battle(null);
  assert.equal(fn('fxBattleCtx')(0).unstable, false);
  /* a damage row for Unstable Billies counts for them alone */
  const rows = [{ kind: 'damage', side: 'deal', mult: 1.2, if: 'unstable', src: 'test' }];
  unstableBattle(rows);
  assert.equal(E.fxAt(rows, fn('fxBattleCtx')(0), {}).length, 1);
  battle(null, null, rows);
  assert.equal(E.fxAt(rows, fn('fxBattleCtx')(0), {}).length, 0);
});

test('PK-8 rule unstableSafe: an Unstable splice of yours loses no HP at a turn’s end', () => {
  const share = data.GENES.unstable.fx[0].share,
    hurtWith = fx => {
      const { me, B } = unstableBattle(fx),
        mx = fn('maxHp')(me);
      me.hp = mx;
      fn('endTurn')();
      return { lost: mx - me.hp, said: JSON.stringify(B.events), mx };
    };
  const plain = hurtWith(null);
  assert.equal(plain.lost, Math.max(1, Math.floor(plain.mx * share)));
  const safe = hurtWith([{ kind: 'rule', rule: 'unstableSafe', n: 1, src: 'test' }]);
  assert.equal(safe.lost, 0);
  assert.doesNotMatch(safe.said, /unstable cells hurt it/);
});

/* ---------- rule sidePerk ---------- */

test('PK-8 rule sidePerk: a side place holds a Perk’s find that shows only with the rule; the rest stays the same', () => {
  const F = modules['route-finds'],
    D = { rules: data.RULES.run.finds, cards: data.REWARDS },
    spots = [20, 40, 60, 80, 100, 120, 140].map((x, k) => ({ kind: k % 2 ? 'pocket' : 'deadend', x, z: x })),
    make = side => {
      const run = { seed: 'SIDEFINDS1', map: { nodes: [{}, side ? { side: 1 } : {}] } },
        scenes = [null, { props: [], spots: structuredClone(spots), pieces: [] }],
        got = F.routeFindsPlace(run, { T: { runNode: 1, route: { at: [0, 0] } } }, scenes, {}, D);
      return { got, props: scenes[1].props };
    };
  const main = make(false),
    side = make(true),
    P = side.props.filter(p => p.perk);
  assert.equal(P.length, 1, 'one Perk find on a side place');
  assert.equal(main.props.filter(p => p.perk).length, 0, 'none on a main place');
  assert.deepEqual(
    side.props.filter(p => !p.perk && !p.more),
    main.props,
    'the place’s own finds are the same'
  );
  assert.deepEqual([P[0].card, P[0].find, side.got[1].perk], ['perk', 'find.1.perk', 1]);
  assert.ok(
    side.props.filter(p => p !== P[0]).every(q => Math.hypot(q.x - P[0].x, q.z - P[0].z) > 6),
    '6 m from the other finds'
  );
  /* picked up only with the rule */
  const p = P[0];
  assert.equal(F.routeFindAt({ props: [p] }, p.x, p.z, {}, 2), null);
  assert.deepEqual(F.routeFindAt({ props: [p] }, p.x, p.z, {}, 0, true), { card: 'perk', flag: 'find.1.perk' });
  assert.equal(F.routeFindAt({ props: [p] }, p.x, p.z, { 'find.1.perk': 1 }, 0, true), null, 'once a run');
  const old = { ...data.PERKS };
  data.PERKS.test_pack = { name: 'T', d: 'T.', rarity: 'common', fx: [{ kind: 'rule', rule: 'sidePerk', n: 1 }] };
  try {
    const r = modules['run-state'].newRun('SIDEPERK01', 1, 1, { team: [] });
    assert.equal(F.routeFindsPerk(r), false);
    r.perks = ['test_pack'];
    assert.equal(F.routeFindsPerk(r), true);
    assert.equal(F.routeFindsPerk(null), false);
  } finally {
    for (const k of Object.keys(data.PERKS)) if (!(k in old)) delete data.PERKS[k];
  }
});

test('PK-8 perkFindMake: the find’s Perk as a pick of one, the same for the same find; none over an open pick', () => {
  const PK = modules.perks,
    RULE = data.RULES.run.perks,
    r = modules['run-state'].newRun('SIDEPERK01', 1, 1, { team: [] }),
    id = PK.perkFindMake(r, 'find.3.perk', data.PERKS, RULE);
  assert.ok(data.PERKS[id] && data.PERKS[id].rarity !== 'fine', id);
  assert.deepEqual(r.offer, [id]);
  /* a run as runBegin starts one keeps a pick of one valid */
  const s = startedSave('musk0', 10);
  s.run = null;
  const rb = modules['run-state'].runBegin(s, {
    seed: 'SIDEPERK01',
    expedition: 1,
    mapgenV: 1,
    se: 300,
    pyramids: {},
    items: {},
  });
  assert.ok(PK.perkFindMake(rb, 'find.3.perk', data.PERKS, RULE));
  assert.equal(modules['run-state'].validRun(rb), true);
  assert.equal(PK.perkFindMake(r, 'find.4.perk', data.PERKS, RULE), '', 'a pick already open');
  const r2 = modules['run-state'].newRun('SIDEPERK01', 1, 1, { team: [] });
  assert.equal(PK.perkFindMake(r2, 'find.3.perk', data.PERKS, RULE), id, 'the same run and find');
  const r3 = modules['run-state'].newRun('SIDEPERK01', 1, 1, { team: [] });
  r3.perks = Object.keys(data.PERKS).filter(k => data.PERKS[k].rarity !== 'fine');
  assert.equal(PK.perkFindMake(r3, 'find.3.perk', data.PERKS, RULE), '', 'nothing left');
  assert.equal(r3.offer, null);
  /* it takes through the pick, as any offer */
  assert.equal(PK.perkChoose(r, id, data.PERKS, RULE), '');
  assert.ok(r.perks.includes(id));
  assert.equal(r.offer, null);
});
