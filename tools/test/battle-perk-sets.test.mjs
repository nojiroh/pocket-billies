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

/* ---------- the sets (perkSets.json) ---------- */

const PERKS = data.PERKS,
  SETS = data.gameData.perkSets,
  RULE = data.RULES.run.perks,
  newRun = (...ids) => {
    const r = modules['run-state'].newRun('PERKSETS01', 1, 1, { team: [] });
    r.perks = ids;
    return r;
  },
  members = id => Object.keys(PERKS).filter(k => (PERKS[k].tags || []).includes(id)),
  setRows = run => (E.fxOfRun(run, PERKS) || []).filter(f => f.src.startsWith('set:'));

test('PK-8 the 7 sets: their Perks as 5.7 lists them, need 3, each Perk in one set at most', () => {
  assert.deepEqual(Object.keys(SETS), ['office', 'influencer', 'tech', 'lab', 'adventurer', 'weather', 'classics']);
  assert.deepEqual(members('office'), [
    'rubber_stamp',
    'click_pen',
    'punch_card',
    'accordion_file',
    'photocopier',
    'time_card',
  ]);
  assert.deepEqual(members('lab'), ['petri_dish', 'gene_lure', 'stabilizer_gel', 'lab_goggles']);
  assert.deepEqual(members('weather'), ['rubber_boots', 'umbrella', 'snow_globe', 'barometer']);
  for (const id of ['influencer', 'tech', 'adventurer', 'classics']) assert.equal(members(id).length, 5, id);
  for (const [id, T] of Object.entries(SETS)) {
    assert.equal(T.need, 3, id);
    assert.ok(T.name && T.title && T.d.length <= 160, id);
  }
  for (const k of Object.keys(PERKS)) assert.ok((PERKS[k].tags || []).filter(t => SETS[t]).length <= 1, k);
});

test('PK-8 a set’s bonus starts with its third Perk and stops when one goes: taken, let go, swapped', () => {
  const [a, b, c, d] = members('classics'),
    other = 'lucky_charm',
    PK = modules.perks,
    run = newRun(a, b);
  assert.equal(E.fxSetHeld(run.perks, 'classics', PERKS), 2);
  assert.deepEqual(E.fxSetsOn(run.perks, PERKS), []);
  assert.deepEqual(setRows(run), [], 'two held: nothing');
  assert.equal(PK.perkTake(run, c, PERKS, RULE), '');
  assert.deepEqual(E.fxSetsOn(run.perks, PERKS), ['classics'], 'the third');
  assert.deepEqual(
    setRows(run).map(f => [f.src, f.kind]),
    SETS.classics.fx.map(f => ['set:classics', f.kind])
  );
  assert.equal(PK.perkTake(run, d, PERKS, RULE), '');
  assert.equal(setRows(run).length, SETS.classics.fx.length, 'a fourth adds nothing more');
  /* let go at the cap (perkTake with a drop): swapped for a Perk of no set */
  run.perks = [a, b, c, other, 'coupon_book', 'clinic_card'];
  assert.equal(setRows(run).length, SETS.classics.fx.length);
  assert.equal(PK.perkTake(run, 'bubble_wrap', PERKS, RULE, c), '');
  assert.deepEqual([run.perks.includes(c), setRows(run).length], [false, 0], 'swapped out: stops');
  /* swapped back in for a member: starts again */
  assert.equal(PK.perkTake(run, d, PERKS, RULE, 'bubble_wrap'), '');
  assert.equal(setRows(run).length, SETS.classics.fx.length);
  /* the set's rows keep their own marks' places (once: battle) */
  const inf = newRun(...members('influencer').slice(0, 3));
  const crit = E.fxOfRun(inf, PERKS).find(f => f.src === 'set:influencer' && f.kind === 'crit');
  assert.equal(E.fxKey(crit), 'set:influencer/1');
});

test('PK-8 copies: a Photocopier counts as itself (Office Supplies), never as the Perk it copies', () => {
  const [a, b] = members('classics');
  /* Photocopier just below Running Shoes copies it: still two Trainer Classics */
  const run = newRun(a, b, 'photocopier');
  assert.equal(E.fxCopyOf(run.perks, 2, PERKS), b);
  assert.equal(E.fxSetHeld(run.perks, 'classics', PERKS), 2);
  assert.equal(E.fxSetHeld(run.perks, 'office', PERKS), 1);
  assert.deepEqual(E.fxSetsOn(run.perks, PERKS), []);
  /* with two more Office Supplies the Photocopier makes the third */
  run.perks.push('rubber_stamp', 'click_pen');
  assert.deepEqual(E.fxSetsOn(run.perks, PERKS), ['office']);
  /* the same Perk twice (never held so, but a list may say it) counts once */
  assert.equal(E.fxSetHeld(['rubber_stamp', 'rubber_stamp', 'click_pen'], 'office', PERKS), 2);
});

test('PK-8 Non-Refundable Ticket: in no set; with it held a set’s Perk can’t be let go, so the bonus stays', () => {
  const PK = modules.perks,
    T = 'nonrefundable_ticket',
    [a, b, c] = members('tech');
  assert.equal(E.fxSetHeld([T], 'office', PERKS), 0);
  const run = newRun(a, b, c, T, 'lucky_charm', 'coupon_book', 'clinic_card', 'bubble_wrap');
  assert.equal(run.perks.length, PK.perkCap(run, RULE, PERKS));
  assert.equal(PK.perkTake(run, 'umbrella', PERKS, RULE, a), 'noDrop');
  assert.deepEqual(E.fxSetsOn(run.perks, PERKS), ['tech']);
  /* a Photocopier below the Ticket copies its rules, not a set */
  assert.deepEqual(E.fxSetsOn([T, 'photocopier'], PERKS), []);
});

test('PK-8 Office Supplies (Middle Management): a run shop’s Perk at half price', () => {
  const PK = modules.perks,
    [a, b, c] = members('office'),
    base = PK.perkPrice(PERKS.lucky_charm, RULE);
  assert.equal(PK.perkShopPrice(newRun(a, b), 'lucky_charm', PERKS, RULE), base);
  assert.equal(PK.perkShopPrice(newRun(a, b, c), 'lucky_charm', PERKS, RULE), Math.round(base * 0.5));
  assert.equal(E.fxRunPrice(newRun(a, b, c), PERKS, 'shop', 100), 100, 'the shop’s wares as they are');
});

test('PK-8 Influencer Kit (Verified): wins pay 25% more; the team’s first attack of a battle is critical, once', () => {
  const ids = members('influencer')
      .filter(k => k !== 'like_button' && k !== 'streak_tracker')
      .slice(0, 3),
    fx = E.fxOfRun(newRun(...ids), PERKS),
    own = E.fxOfRun({ perks: ids }, { ...PERKS }).filter(f => !f.src.startsWith('set:')),
    money = rows => E.fxMoney(rows, 1000);
  assert.equal(money(own), 1000, 'these three pay nothing more themselves');
  assert.equal(money(fx), 1250);
  /* in battle: the first attack is critical, the second not */
  const { B } = battle(null, null, fx);
  const H = Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return M.p > 0 && M.c === 'H' && (!M.a || M.a >= 100) && !M.pr && !M.fx;
  });
  B.sides[1].team[0].hp = 99999;
  B.perkState = {};
  const rng = B.rng;
  B.rng = () => 0.99;
  try {
    B.events.length = 0;
    fn('useMove')(0, H, 1);
    const first = JSON.stringify(B.events).includes('A critical hit!');
    B.events.length = 0;
    fn('useMove')(0, H, 1);
    const second = JSON.stringify(B.events).includes('A critical hit!');
    assert.deepEqual([first, second], [true, false]);
  } finally {
    B.rng = rng;
  }
});

test('PK-8 Tech Gear (Power User): held items work 50% better in battle', () => {
  const fx = E.fxOfRun(newRun(...members('tech').slice(0, 3)), PERKS);
  assert.equal(E.fxHeldBoost(fx), 1.5);
  assert.equal(battle('quick_laces', null, fx).B.sides[0].f[0].v.st.hus, 2);
  const two = E.fxOfRun(newRun(...members('tech').slice(0, 2)), PERKS);
  assert.equal(battle('quick_laces', null, two).B.sides[0].f[0].v.st.hus, 1, 'two held: as before');
});

test('PK-8 Lab Kit (Mad Science): Unstable Billies hit 20% harder and their cells never hurt them', () => {
  const fx = E.fxOfRun(newRun(...members('lab').slice(0, 3)), PERKS),
    { me } = unstableBattle(fx),
    mx = fn('maxHp')(me);
  const rows = E.fxAt(fx, fn('fxBattleCtx')(0), {}).filter(f => f.src === 'set:lab' && f.kind === 'damage');
  assert.equal(rows.length, 1);
  assert.equal(E.fxDamage(rows, { cat: 'H', type: 'None', deal: true, take: false }), 1.2);
  me.hp = mx;
  fn('endTurn')();
  assert.equal(me.hp, mx, 'no HP lost (Stabilizer Gel alone halves it)');
  battle(null, null, fx);
  assert.equal(
    E.fxAt(fx, fn('fxBattleCtx')(0), {}).filter(f => f.src === 'set:lab' && f.kind === 'damage').length,
    0,
    'a stable Billie: no boost'
  );
});

test('PK-8 Adventurer’s Pack (Seasoned Adventurer): side areas show their Perk on the ground', () => {
  const F = modules['route-finds'],
    [a, b, c] = members('adventurer');
  assert.equal(F.routeFindsPerk(newRun(a, b)), false);
  assert.equal(F.routeFindsPerk(newRun(a, b, c)), true);
});

test('PK-8 Weather Kit (Weather Person): 15% harder in rain, storms, snow, fog and ash; not in clear or sun', () => {
  const fx = E.fxOfRun(newRun(...members('weather').slice(0, 3)), PERKS),
    at = w =>
      E.fxDamage(
        E.fxAt(fx, { weather: w }, {}).filter(f => f.src === 'set:weather'),
        { cat: 'H', type: 'None', deal: true, take: false }
      );
  for (const w of ['rain', 'storm', 'snow', 'fog', 'ash']) assert.equal(at(w), 1.15, w);
  for (const w of ['clear', 'sunny']) assert.equal(at(w), 1, w);
});

test('PK-8 Trainer Classics (Old School): 25% more XP, catching 10% easier', () => {
  const rows = setRows(newRun(...members('classics').slice(0, 3)));
  assert.equal(E.fxXp(rows, 100), 125);
  assert.equal(E.fxCatch(rows).toFixed(2), '1.10');
});

test('PK-8 every Perk and every set at once: all 7 bonuses on, whole battles end, every number finite', () => {
  const ids = Object.keys(PERKS);
  assert.deepEqual(E.fxSetsOn(ids, PERKS), Object.keys(SETS));
  const run = newRun(...ids),
    fx = E.fxOfRun(run, PERKS);
  assert.equal(fx.filter(f => f.src.startsWith('set:')).length, Object.values(SETS).flatMap(T => T.fx).length);
  for (const f of E.fxAt(fx, {}, { run: {} }))
    for (const k of ['mult', 'share', 'n', 'stages', 'add', 'chance'])
      if (k in f) assert.ok(Number.isFinite(f[k]), `${f.src} ${k}`);
  const play = seed => {
    reseed(7);
    const s = startedSave(starter(), 20);
    s.team[0].held = 'brass_knuckles';
    s.team.push(fn('makeBilly')(starter(), 20));
    assert.ok(
      fn('newBattle')('wild', [fn('makeBilly')(wildSpecies(), 20)], { fmt: 'single', seed, fx, perkState: {} })
    );
    const b = hooks.activeBattle,
      out = [];
    for (let t = 0; t < 200 && !b.over; t++) {
      if ((b.needSwitch || []).length) {
        const i = fn('benchCandidates')(0)[0];
        if (i == null) break;
        fn('doSwitch')(b.needSwitch.shift(), i);
        continue;
      }
      const m = fn('fighter')(0),
        mid = m.moves.find(id => data.MOVES[id] && data.MOVES[id].p > 0) || m.moves[0];
      fn('runTurn')([{ who: 0, k: 'move', mid, tk: 1 }], b);
      for (const side of b.sides)
        for (const q of side.team) assert.ok(Number.isInteger(q.hp) && q.hp >= 0, `hp ${q.hp}`);
      out.push(b.events.length);
    }
    assert.ok(b.over || (b.needSwitch || []).length, `${seed}: over within 200 turns`);
    return [b.over, ...out].join();
  };
  for (const seed of ['sets-a', 'sets-b']) assert.equal(play(seed), play(seed), seed);
  assert.ok(Number.isFinite(modules.perks.perkShopPrice(run, 'lucky_charm', PERKS, RULE)));
  assert.equal(modules['route-finds'].routeFindsPerk(run), true);
});
