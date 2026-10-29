// PK-9: boons and curses (perks-track.md 5.9 and section 7): the kinds the curses need (last, turnHurt at arrive,
// rewardPick below 0, the rules shopClosed and muteNewest), each with test-only rows first; then the 20 named boons and
// curses of boons.json, each working and running out, the appeal, Correction Fluid, and everything at once finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wild = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of `n`, holding these rows; extra laid over */
function battle(fx, extra = {}, n = 2, lvl = 12) {
  reseed(7);
  const s = startedSave(starter(), lvl);
  while (s.team.length < n) s.team.push(fn('makeBilly')(starter(), lvl));
  const foe = fn('makeBilly')(wild(), lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'boon-test', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};
/** any damaging, never-missing move in the game of a category (to teach a fighter) */
const anyHit = cat =>
  Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return (
      M.p > 0 &&
      M.c === cat &&
      (!M.a || M.a >= 100) &&
      !M.pr &&
      !(M.fx && Object.keys(M.fx).some(k => k !== 'crit' || M.fx.crit))
    );
  });
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};
const order = b =>
  b.events
    .filter(e => e.an && e.an.k === 'move')
    .map(e => e.an.si)
    .join(',');

/* ---------- last ---------- */

test('PK-9 last: on turn 1 yours move after a slower foe (with a line); from turn 2 speed decides again', () => {
  const { P, fx } = perks({ id: 'test_hold', name: 'Test Hold', fx: [{ kind: 'last', if: 'turn:1' }] });
  const H = anyHit('H');
  for (const held of [true, false])
    withPerks(P, () => {
      const b = battle(held ? fx : null);
      tough(mine(b));
      tough(foe(b));
      b.sides[0].f[0].v.st.hus = 6;
      b.sides[1].f[0].v.st.hus = -6;
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.match(order(b), held ? /^1,0/ : /^0,1/, `turn 1, held ${held}`);
      assert.equal(
        lines(b).some(t => /^Test Hold: .* moves last\.$/.test(t)),
        held
      );
      fn('runTurn')([{ who: 0, k: 'move', mid: H, tk: 1 }], b);
      assert.match(order(b), /^0,1/, `turn 2, held ${held}`);
    });
});

/* ---------- the run ---------- */

/** a started save on a fresh run holding these Perks (its map made) */
function runSave(perkIds = []) {
  reseed(3);
  const s = startedSave(starter(), 30),
    G = GAME_DATA;
  s.run = modules['run-state'].newRun('BOONSEED01', 1, 1, { team: [] });
  s.run.perks = perkIds;
  modules['run-map'].runMapStart(s.run, { nodeTypes: G.nodeTypes, biomes: G.biomes, rules: G.rules.run });
  return s;
}
const top = m => fn('maxHp')(m);

/* ---------- turnHurt at arrive ---------- */

test('PK-9 turnHurt at arrive: each place walked into costs a share of HP (rounded up), never below 1 HP', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_cuts', name: 'Test Cuts', fx: [{ kind: 'turnHurt', share: 0.05, when: 'arrive' }] });
  withPerks(P, () => {
    const s = runSave(['test_cuts']),
      m = s.team[0],
      out = {};
    m.hp = top(m);
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, top(m) - Math.ceil(top(m) * 0.05));
    assert.equal(out.hurt, Math.ceil(top(m) * 0.05));
    assert.deepEqual(out.hurtBy, ['test_cuts']);
    m.hp = 2;
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, 1, 'never below 1 HP');
    m.hp = 0;
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(m.hp, 0, 'a fainted Billie is left as it is');
    /* in battle a row with a when is read only at its moment: no turn-end hurt */
    const fx = fn('fxOfRun')(s.run, data.PERKS);
    assert.equal(modules.effects.fxAt(fx, {}, {}).length, 0);
  });
  const t = runSave([]),
    n = t.team[0];
  n.hp = top(n);
  L.runArriveFx(t, data.PERKS, {});
  assert.equal(n.hp, top(n), 'without the row nothing is lost');
});

/* ---------- rewardPick below 0 ---------- */

test('PK-9 rewardPick below 0: reward picks show one card fewer, never under one; the pick keeps its count', () => {
  const W = modules.rewards,
    { P } = perks({ id: 'test_review', name: 'Test Review', fx: [{ kind: 'rule', rule: 'rewardPick', n: -1 }] });
  withPerks(P, () => {
    const s = runSave(['test_review']),
      D = W.rewardDataGame(s.team),
      R = W.rewardOfferMake(s.run, 'test', D);
    assert.equal(R.cards.length, GAME_DATA.rules.run.rewards.pick - 1);
    assert.equal(R.n, GAME_DATA.rules.run.rewards.pick - 1);
    const one = W.rewardOfferMake(s.run, 'test', D, { n: 1 });
    assert.equal(one.cards.length, 1, 'never under one card');
  });
  const t = runSave([]);
  assert.equal(
    W.rewardOfferMake(t.run, 'test', W.rewardDataGame(t.team)).cards.length,
    GAME_DATA.rules.run.rewards.pick
  );
});

/* ---------- rule shopClosed ---------- */

test('PK-9 rule shopClosed: a run town’s shop is shut while it holds, by its source', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_ooo', name: 'Test Out', fx: [{ kind: 'rule', rule: 'shopClosed', n: 1 }] });
  withPerks(P, () => assert.equal(L.runShopShut(runSave(['test_ooo']), data.PERKS), 'test_ooo'));
  assert.equal(L.runShopShut(runSave([]), data.PERKS), '');
});

/* ---------- rule muteNewest ---------- */

test('PK-9 rule muteNewest: the newest Perk gives nothing and counts toward no set; it shows REVOKED', () => {
  const FX = modules.effects,
    PK = modules.perks,
    classics = Object.keys(data.PERKS)
      .filter(k => (data.PERKS[k].tags || []).includes('classics'))
      .slice(0, 3),
    s = runSave(['lucky_charm', ...classics]),
    srcs = () => new Set((fn('fxOfRun')(s.run, data.PERKS) || []).map(f => f.src));
  assert.equal(classics.length, 3);
  assert.ok(srcs().has('set:classics'), 'three Trainer Classics: Old School on');
  assert.ok(srcs().has(classics[2]));
  modules['run-enc'].encBoon(s.run, [{ kind: 'rule', rule: 'muteNewest', n: 1 }], 1, 'test');
  assert.equal(FX.fxMuted(s.run), classics[2]);
  assert.deepEqual(FX.fxLivePerks(s.run), ['lucky_charm', ...classics.slice(0, 2)]);
  assert.ok(!srcs().has(classics[2]), 'the newest gives no rows');
  assert.ok(!srcs().has('set:classics'), 'and the set loses its bonus');
  assert.ok(srcs().has('lucky_charm'));
  assert.equal(PK.perkCount(s.run, classics[2], data.PERKS), 'REVOKED');
  assert.match(PK.perkSetLine(s.run, classics[2], data.PERKS), /2\/3$/);
  assert.equal(PK.perkGroups(s.run, data.PERKS).find(g => g.set === 'classics').on, false);
  /* it runs out with the curse's places */
  for (let k = 0; k < 2; k++) modules['run-enc'].encArrive(s.run);
  assert.equal(FX.fxMuted(s.run), '');
  assert.ok(srcs().has('set:classics'));
});

/* ---------- named boons on the run ---------- */

test('PK-9 named boons: given by id, their rows read from boons.json as boon:<id>, counted down, named', () => {
  const E = modules['run-enc'],
    s = runSave([]),
    run = s.run;
  assert.equal(E.encBoonGive(run, 'surge_pricing', 'terms_of_service'), 3);
  assert.deepEqual(run.enc.boons, [{ id: 'surge_pricing', left: 3, src: 'terms_of_service' }]);
  assert.deepEqual(E.encBoonRows(run), [{ kind: 'price', what: 'shop', mult: 1.25, src: 'boon:surge_pricing' }]);
  assert.equal(fn('fxSrcName')('boon:surge_pricing'), 'Surge Pricing');
  assert.equal(E.encBoonGive(run, 'no_such_boon', 'x'), -1, 'no such boon: nothing given');
  /* given again while on, it lasts the longer of the two and never stacks */
  E.encArrive(run);
  assert.equal(E.encBoonGive(run, 'surge_pricing', 'again'), 3);
  assert.equal(run.enc.boons.length, 1);
  assert.equal(run.enc.boons[0].left, 3);
  assert.deepEqual(
    E.encBoonsOn(run).map(b => [b.id, b.left, b.boon.name]),
    [['surge_pricing', 3, 'Surge Pricing']]
  );
  for (let k = 0; k < 3; k++) E.encArrive(run);
  assert.equal(E.encBoonRows(run).length, 1, 'its last place');
  E.encArrive(run);
  assert.equal(E.encBoonRows(run).length, 0, 'gone');
  assert.equal(
    E.encBoonLine(data.BOONS.surge_pricing, 3),
    'Curse: Surge Pricing, for this place and 3 more. Run shops charge 25% more.'
  );
  assert.equal(
    E.encBoonLine(data.BOONS.tailwind, 0),
    'Boon: Tailwind, for this place. Your Billies take the field with their Speed up.'
  );
});

test('PK-9 a run in progress loads: validRun takes an event’s own rows (before PK-9) and a named boon', () => {
  const V = modules['run-state'].validRun,
    s = startedSave(starter(), 10);
  s.run = null;
  const run = modules['run-state'].runBegin(s, {
    seed: 'BOONSEED02',
    expedition: 1,
    mapgenV: 1,
    se: 300,
    pyramids: {},
    items: {},
  });
  assert.equal(V(run), true, 'as begun');
  modules['run-enc'].encBoon(run, [{ kind: 'price', what: 'shop', mult: 1.25 }], 3, 'terms_of_service');
  modules['run-enc'].encBoonGive(run, 'tailwind', 'fountain');
  assert.equal(V(JSON.parse(JSON.stringify(run))), true);
  for (const bad of [
    { id: 'tailwind', fx: [], left: 1, src: 'x' },
    { left: 1, src: 'x' },
    { id: 'Bad Id', left: 1, src: 'x' },
    { id: 'tailwind', left: 1, src: 'x', more: 1 },
  ]) {
    const r = JSON.parse(JSON.stringify(run));
    r.enc.boons.push(bad);
    assert.equal(V(r), false, JSON.stringify(bad));
  }
  /* a boon a pack took away gives nothing and doesn't crash */
  const r = JSON.parse(JSON.stringify(run));
  r.enc.boons.push({ id: 'gone_boon', left: 1, src: 'x' });
  assert.equal(V(r), true);
  assert.ok(fn('fxOfRun')(r, data.PERKS).every(f => f.src !== 'boon:gone_boon'));
});

test('PK-9 the four events name their boons and curses, with the rows and places they had', () => {
  const E = GAME_DATA.events.events,
    B = GAME_DATA.boons,
    lines = id => E[id].options.flatMap(o => o.then);
  for (const [ev, cmd, places, fx] of [
    ['ring_light', 'boon camera_ready', 1, [{ kind: 'stat', stat: 'hus', stages: 1 }]],
    ['terms_of_service', 'curse surge_pricing', 3, [{ kind: 'price', what: 'shop', mult: 1.25 }]],
    ['surveyor_hole', 'curse clinic_backlog', 2, [{ kind: 'price', what: 'heal', mult: 1.5 }]],
    ['poster_grove', 'boon fired_up', 1, [{ kind: 'stat', stat: 'lev', stages: 1 }]],
  ]) {
    assert.ok(lines(ev).includes(cmd), `${ev}: ${cmd}`);
    assert.ok(!lines(ev).some(l => /^fx /.test(l)), `${ev}: no unnamed row left`);
    const id = cmd.split(' ')[1];
    assert.equal(B[id].places, places, id);
    assert.deepEqual(B[id].fx, fx, id);
    assert.equal(!!B[id].curse, cmd.startsWith('curse'), id);
  }
});

/* ---------- Correction Fluid ---------- */

test('PK-9 Correction Fluid: the run’s first curse is erased, later curses last one place less, boons as they are', () => {
  const L = modules['run-loop'],
    s = runSave(['correction_fluid']),
    run = s.run;
  assert.equal(data.PERKS.correction_fluid.rarity, 'uncommon');
  assert.ok(data.PERKS.correction_fluid.tags.includes('office'), 'an Office Supplies Perk');
  assert.deepEqual(L.runBoonGive(run, 'surge_pricing', 'terms_of_service', data.PERKS), {
    left: -1,
    erased: 'correction_fluid',
  });
  assert.equal(run.enc.boons.length, 0, 'erased: nothing given');
  assert.equal(run.enc.erased, 1);
  assert.deepEqual(L.runBoonGive(run, 'surge_pricing', 'terms_of_service', data.PERKS), { left: 2, erased: '' });
  assert.deepEqual(L.runBoonGive(run, 'tailwind', 'x', data.PERKS), { left: 2, erased: '' }, 'a boon is as it is');
  assert.deepEqual(L.runBoonGive(run, 'camera_ready', 'x', data.PERKS), { left: 1, erased: '' });
  /* let go and taken again, it doesn't erase a second curse this run */
  run.perks = [];
  run.perks = ['correction_fluid'];
  assert.deepEqual(L.runBoonGive(run, 'audit_trail', 'x', data.PERKS), { left: 2, erased: '' });
  /* without it a curse lasts its places */
  const t = runSave([]);
  assert.deepEqual(L.runBoonGive(t.run, 'surge_pricing', 'x', data.PERKS), { left: 3, erased: '' });
  assert.deepEqual(L.runBoonGive(t.run, 'clinic_backlog', 'x', data.PERKS), { left: 2, erased: '' });
  /* a curse of 0 more places stays 0 */
  const u = runSave(['correction_fluid']);
  u.run.enc = { ...modules['run-enc'].encOf(u.run), erased: 1 };
  const B = { quick: { name: 'Quick', d: 'A test.', curse: true, places: 0, fx: [{ kind: 'money', mult: 0.9 }] } };
  assert.equal(modules['run-enc'].encBoonGive(u.run, 'quick', 'x', B, { shorter: 1, erase: 1 }), 0);
});

/* ---------- the appeal ---------- */

test('PK-9 the appeal: a clinic’s fee lifts a curse at once; not a boon, not without the money, not when shut', () => {
  const L = modules['run-loop'],
    E = modules['run-enc'],
    fee = GAME_DATA.rules.run.appealCost,
    s = runSave([]);
  assert.equal(fee, 50);
  E.encBoonGive(s.run, 'audit_trail', 'x');
  E.encBoonGive(s.run, 'tailwind', 'x');
  s.se = 40;
  assert.deepEqual(L.runAppeal(s, 'audit_trail', fee), { paid: 0, why: 'poor' });
  s.se = 120;
  assert.deepEqual(L.runAppeal(s, 'tailwind', fee), { paid: 0, why: 'none' }, 'a boon is not appealed');
  assert.deepEqual(L.runAppeal(s, 'surge_pricing', fee), { paid: 0, why: 'none' }, 'not on');
  assert.deepEqual(L.runAppeal(s, 'audit_trail', fee), { paid: 50 });
  assert.equal(s.se, 70);
  assert.deepEqual(
    s.run.enc.boons.map(b => b.id),
    ['tailwind']
  );
  assert.ok(E.encBoonRows(s.run).every(f => f.src !== 'boon:audit_trail'));
  /* the "No healing" challenge shuts the clinic: no appeal either */
  E.encBoonGive(s.run, 'audit_trail', 'x');
  s.run.mods = ['noheal'];
  assert.deepEqual(L.runAppeal(s, 'audit_trail', fee), { paid: 0, why: 'shut' });
});

/* ---------- the Bureau's new events ---------- */

const NEW_EVENTS = [
  'mandatory_orientation',
  'routine_audit',
  'please_hold',
  'permit_inspection',
  'paperwork_avalanche',
];
/** play one option of an event's script on a stage that gives its boons and curses on a run (runBoonGive) and
 * records every other command @returns {Promise<{ cmds: string[], given: string[] }>} */
async function playOption(s, id, k) {
  const cmds = [],
    given = [],
    give = ([bid]) => {
      modules['run-loop'].runBoonGive(s.run, bid, id, data.PERKS);
      given.push(bid);
    };
  const stage = new Proxy(
    { say: () => {}, choose: () => 0, boon: give, curse: give },
    { get: (t, c) => t[c] || (() => cmds.push(c)) }
  );
  const ev = GAME_DATA.events.events[id];
  await modules.script.runScript(modules['script-parse'].parseScript(ev.options[k].then), stage, {
    save: { story: {} },
    id: 'event:' + id,
  });
  return { cmds, given };
}

test('PK-9 the five new Bureau events: case files that hand out curses, every Red Tape curse among them', async () => {
  const E = GAME_DATA.events.events,
    B = GAME_DATA.boons,
    seen = new Set();
  for (const id of NEW_EVENTS) {
    assert.equal(E[id].bureau, 1, id);
    let curses = 0;
    for (let k = 0; k < E[id].options.length; k++) {
      const s = runSave([]),
        { given } = await playOption(s, id, k);
      for (const b of given) {
        assert.ok(B[b], `${id}: ${b}`);
        assert.ok(
          s.run.enc.boons.some(x => x.id === b),
          `${id} option ${k}: ${b} on the run`
        );
        if (B[b].curse) curses++;
        seen.add(b);
      }
    }
    assert.ok(curses >= 1, `${id} hands out a curse`);
  }
  for (const id of [
    'pending_review',
    'mandatory_training',
    'audit_trail',
    'hold_music',
    'permit_revoked',
    'out_of_office',
    'paper_cuts',
  ])
    assert.ok(seen.has(id), id);
  /* every one of the 20 can be met: in an event or the fountain */
  const all = new Set([
    ...Object.values(E).flatMap(e =>
      e.options.flatMap(o => o.then.filter(l => /^(boon|curse) /.test(l)).map(l => l.split(' ')[1]))
    ),
    ...GAME_DATA.rules.square.wish.outcomes.filter(o => o.boon).map(o => o.boon),
  ]);
  assert.deepEqual(
    Object.keys(B).filter(id => !all.has(id)),
    []
  );
});

test('PK-9 with Correction Fluid the first Bureau curse of a run is erased', async () => {
  const s = runSave(['correction_fluid']);
  await playOption(s, 'routine_audit', 0);
  assert.equal(s.run.enc.boons.length, 0, 'Audit Trail erased');
  await playOption(s, 'paperwork_avalanche', 2);
  assert.deepEqual(s.run.enc.boons, [{ id: 'out_of_office', left: 2, src: 'paperwork_avalanche' }]);
});

/* ---------- everything at once ---------- */

test('PK-9 every Perk, set, boon and curse at once: whole battles end, every number finite, replayable', () => {
  const ids = Object.keys(data.PERKS),
    boons = Object.keys(data.BOONS);
  assert.equal(ids.length, 79);
  assert.equal(boons.length, 20);
  reseed(3);
  const s = runSave(ids),
    E = modules.effects,
    L = modules['run-loop'];
  for (const id of boons) modules['run-enc'].encBoonGive(s.run, id, 'test');
  const fx = fn('fxOfRun')(s.run, data.PERKS),
    srcs = new Set(fx.map(f => f.src));
  for (const id of boons) assert.ok(srcs.has('boon:' + id), id);
  assert.ok(!srcs.has(ids[ids.length - 1]), 'Permit Revoked: the newest Perk gives nothing');
  const play = seed => {
    reseed(7);
    const t = startedSave(starter(), 20);
    for (let i = 0; i < 2; i++) t.team.push(fn('makeBilly')(starter(), 20));
    assert.ok(fn('newBattle')('wild', [fn('makeBilly')(wild(), 20)], { fmt: 'single', seed, fx, perkState: {} }));
    const b = hooks.activeBattle,
      out = [];
    for (let k = 0; k < 200 && !b.over; k++) {
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
  for (const seed of ['boons-all-a', 'boons-all-b']) assert.equal(play(seed), play(seed), seed);
  /* the run's moments and rules, many times over: finite */
  s.se = 500;
  for (let i = 0; i < 6; i++) {
    L.runArriveFx(s, data.PERKS, {});
    L.runBuyFx(s, data.PERKS, 50);
    L.runFxMoment(s, data.PERKS, 'win', { foe: ['wild'], noFaint: true });
  }
  assert.ok(Number.isInteger(s.se) && s.se >= 0, String(s.se));
  for (const m of s.team) assert.ok(Number.isInteger(m.hp) && m.hp >= 0);
  for (const r of E.FX_RULES) assert.ok(Number.isInteger(E.fxRunRule(s.run, r)), r);
  assert.ok(s.run.enc.boons.length === 0, 'every boon and curse ran out');
});

test('PK-9 every timed effect has a name and a picture; no event leaves an unnamed one', async () => {
  const { existsSync, readFileSync } = await import('node:fs'),
    { svgProblem } = modules['svg-pixels'],
    art = new URL('../../game/art/', import.meta.url);
  for (const [id, B] of Object.entries(GAME_DATA.boons)) {
    assert.ok(B.name && B.d, id);
    assert.equal(B.img, `boons/${id}.svg`, id);
    const f = new URL(B.img, art);
    assert.ok(existsSync(f), `${id}: ${B.img}`);
    assert.equal(svgProblem(readFileSync(f, 'utf8')), '', id);
  }
  for (const [id, E] of Object.entries(GAME_DATA.events.events))
    for (const o of E.options) assert.ok(!o.then.some(l => /^fx /.test(l)), `${id}: an unnamed fx row`);
  assert.ok(!GAME_DATA.rules.square.wish.outcomes.some(o => o.fx), 'the fountain names its boons');
});
