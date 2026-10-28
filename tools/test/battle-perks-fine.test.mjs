// PK-7: Fine Print's effect kinds (perks-track.md 5.6 and section 7): recoil, a money row's add on arrival, loot,
// the run rules noDrop and faintPaysNothing, each with test-only Perks first; foe levels and the boss's HP taken
// mid-run; then the 12 Fine Print Perks of perks.json, each working with its downside, and every Perk of Waves A-D
// and Fine Print held at once staying finite.
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

/** made-up Perks (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};
/** a seeded wild battle with a team of `n`, holding these rows; extra laid over */
function battle(fx, extra = {}, n = 2, lvl = 12) {
  reseed(7);
  const s = startedSave(starter(), lvl);
  while (s.team.length < n) s.team.push(fn('makeBilly')(starter(), lvl));
  const foe = fn('makeBilly')(wild(), lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
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
/** a status move that never misses and does nothing to HP */
const anyStatus = () =>
  Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return M.c === 'X' && (!M.a || M.a >= 100) && M.fx && M.fx.selfStage && Object.keys(M.fx).length === 1;
  });
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};
const RULE = GAME_DATA.rules.run.perks;
/** a run holding these Perks */
const runOf = (...ids) => {
  const r = modules['run-state'].newRun('FINERUN001', 1, 1, { team: [] });
  r.perks = ids;
  return r;
};

/* ---------- recoil ---------- */

test('PK-7 recoil: an attack of yours that deals damage costs its user a share of its HP; never the foe’s', () => {
  const { P, fx } = perks({ id: 'test_chip', name: 'Test Chip', fx: [{ kind: 'recoil', share: 0.1 }] });
  const H = anyHit('H'),
    X = anyStatus();
  assert.ok(H && X, 'a sure physical hit and a status move');
  withPerks(P, () => {
    const b = battle(fx),
      m = mine(b),
      mx = fn('maxHp')(m);
    tough(foe(b));
    m.hp = mx;
    fn('useMove')(0, H, 1);
    assert.equal(m.hp, mx - Math.max(1, Math.floor(mx * 0.1)), 'the attack cost 10% of its HP');
    assert.ok(
      lines(b).some(t => /^Test Chip: .* lost some HP\.$/.test(t)),
      'a line names the Perk'
    );
    /* a status move costs nothing */
    const was = m.hp;
    fn('useMove')(0, X, 1);
    assert.equal(m.hp, was, 'a status move costs nothing');
    /* the foe's attacks cost it nothing */
    const f = foe(b),
      fw = f.hp;
    m.hp = 99999;
    fn('useMove')(1, H, 0);
    assert.equal(f.hp, fw, 'the foe pays no recoil');
  });
  /* at low HP the cost can knock its user out */
  withPerks(P, () => {
    const b = battle(fx),
      m = mine(b);
    tough(foe(b));
    m.hp = 1;
    fn('useMove')(0, H, 1);
    assert.equal(m.hp, 0, 'the cost can make it faint');
  });
  /* without the row nothing is lost */
  const b = battle(null),
    m = mine(b),
    mx = fn('maxHp')(m);
  tough(foe(b));
  m.hp = mx;
  fn('useMove')(0, H, 1);
  assert.equal(m.hp, mx);
  /* several recoil rows add up, to at most a half */
  assert.equal(
    modules.effects.fxRecoil([
      { kind: 'recoil', share: 0.3 },
      { kind: 'recoil', share: 0.4 },
    ]),
    0.5
  );
});

/* ---------- a money row's add on arrival ---------- */

const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};

test('PK-7 money add: walking in pays its Moneys, or charges them below 0 (never below none); none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks(
      { id: 'test_box', fx: [{ kind: 'money', add: -15, when: 'arrive' }] },
      { id: 'test_tip', fx: [{ kind: 'money', add: 20, when: 'arrive' }] }
    );
  const walk = (se, ids) => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.se = se;
    s.run = { perks: ids, perkState: {} };
    const out = {};
    L.runArriveFx(s, P, out);
    return [s.se, out.money, out.cost];
  };
  assert.deepEqual(walk(100, ['test_box']), [85, 0, 15]);
  assert.deepEqual(walk(10, ['test_box']), [0, 0, 10], 'never below none: it takes what is there');
  assert.deepEqual(walk(0, ['test_box']), [0, 0, 0]);
  assert.deepEqual(walk(100, ['test_tip']), [120, 20, 0]);
  /* both: what is paid comes first, then the charge */
  assert.deepEqual(walk(0, ['test_box', 'test_tip']), [5, 20, 15]);
  assert.deepEqual(walk(100, []), [100, 0, 0]);
  /* a battle's money ignores an add row */
  assert.equal(fn('fxMoney')([{ kind: 'money', add: -15, when: 'arrive', src: 'x' }], 100), 100);
});

/* ---------- loot ---------- */

test('PK-7 loot: walking in brings n of the reward picks’ item cards by weight, the same on a reload; none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks(
      { id: 'test_box', name: 'Test Box', fx: [{ kind: 'loot', what: 'item', when: 'arrive' }] },
      { id: 'test_crate', name: 'Test Crate', fx: [{ kind: 'loot', what: 'item', n: 3, when: 'arrive' }] }
    );
  const cards = Object.values(data.REWARDS).filter(R => R.kind === 'item' && R.weight > 0),
    ids = new Set(cards.map(R => (R.pyramid ? 'coin_' + R.pyramid : R.item)));
  const walk = (ids0, visited) => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.run = modules['run-state'].newRun('FINELOOT01', 1, 1, { team: [] });
    s.run.perks = ids0;
    s.run.path = Array.from({ length: visited }, (_, i) => i);
    const bag = JSON.stringify([s.items, s.pyramids]),
      out = {};
    L.runArriveFx(s, P, out);
    return { out: out.items || {}, same: bag === JSON.stringify([s.items, s.pyramids]), s };
  };
  const a = walk(['test_box'], 3);
  assert.equal(Object.keys(a.out).length, 1, 'one card');
  for (const [id, n] of Object.entries(a.out)) {
    assert.ok(ids.has(id), `${id} is a reward pick's item card`);
    const R = cards.find(c => (c.pyramid ? 'coin_' + c.pyramid : c.item) === id);
    assert.equal(n, R.n || 1, 'with its stack');
    if (id.startsWith('coin_')) assert.ok(a.s.pyramids[id.slice(5)] >= n);
    else assert.ok(a.s.items[id] >= n);
  }
  assert.equal(a.same, false, 'into the bag');
  assert.deepEqual(walk(['test_box'], 3).out, a.out, 'the same place brings the same (a reload)');
  /* over many places every card turns up, and three at once are three different cards */
  const seen = new Set();
  for (let v = 0; v < 120; v++) for (const id of Object.keys(walk(['test_box'], v).out)) seen.add(id);
  assert.deepEqual([...seen].sort(), [...ids].sort());
  assert.equal(Object.keys(walk(['test_crate'], 5).out).length, 3);
  /* none held: nothing */
  const none = walk([], 3);
  assert.deepEqual(none.out, {});
  assert.equal(none.same, true);
  /* what it brought, in words: pyramids by name */
  assert.match(L.runGaveText({ money: 0, items: { coin_step_pyramid: 2 } }), /^2 \S/);
  assert.doesNotMatch(L.runGaveText({ money: 0, items: { coin_step_pyramid: 2 } }), /coin_/);
});

/* ---------- rule noDrop, with cap and copy ---------- */

test('PK-7 rule noDrop: no Perk held can be let go, so at the cap nothing more is taken; with cap rows and a copier', () => {
  const PK = modules.perks,
    { P } = perks(
      {
        id: 'test_ticket',
        name: 'Test Ticket',
        fx: [
          { kind: 'rule', rule: 'cap', n: 2 },
          { kind: 'rule', rule: 'noDrop', n: 1 },
        ],
      },
      { id: 'test_file', name: 'Test File', fx: [{ kind: 'rule', rule: 'cap', n: 1 }] },
      { id: 'test_copier', name: 'Test Copier', fx: [{ kind: 'copy' }] }
    );
  withPerks(P, () => {
    const fill = Object.keys(data.PERKS).filter(
        k =>
          !k.startsWith('test') &&
          !data.PERKS[k].fx.some(f => f.kind === 'copy' || (f.kind === 'rule' && f.rule === 'cap'))
      ),
      r = runOf();
    for (const id of fill.slice(0, RULE.cap)) assert.equal(PK.perkTake(r, id, data.PERKS, RULE), '');
    assert.equal(PK.perkNoDrop(r, data.PERKS), '');
    /* taking the Ticket at the cap lets one go (nothing says no yet) */
    assert.equal(PK.perkTake(r, 'test_ticket', data.PERKS, RULE, fill[0]), '');
    assert.equal(PK.perkNoDrop(r, data.PERKS), 'test_ticket');
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap + 2);
    /* two more fit, then none: nothing can be let go, not even the Ticket */
    assert.equal(PK.perkTake(r, fill[RULE.cap], data.PERKS, RULE), '');
    assert.equal(PK.perkTake(r, 'test_file', data.PERKS, RULE), '');
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap + 3, 'Ticket and File together');
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE), '');
    assert.equal(r.perks.length, RULE.cap + 3);
    assert.equal(PK.perkTake(r, fill[RULE.cap + 2], data.PERKS, RULE), 'full');
    for (const k of r.perks) {
      assert.equal(PK.perkDropOk(r, k, fill[RULE.cap + 2], data.PERKS, RULE), false, k);
      assert.equal(PK.perkTake(r, fill[RULE.cap + 2], data.PERKS, RULE, k), 'noDrop', k);
    }
    /* a pick at the cap can still be answered with none */
    r.offer = [fill[RULE.cap + 2]];
    assert.equal(PK.perkChoose(r, fill[RULE.cap + 2], data.PERKS, RULE, r.perks[1]), 'noDrop');
    assert.equal(PK.perkChoose(r, null, data.PERKS, RULE), '');
    /* a copier just below the Ticket copies its cap and its rule: one more held, still none let go */
    const c = runOf(...fill.slice(0, 3), 'test_ticket', 'test_copier');
    assert.equal(PK.perkCap(c, RULE, data.PERKS), RULE.cap + 4);
    assert.equal(PK.perkNoDrop(c, data.PERKS), 'test_ticket');
    /* under another Perk the copier copies that one, and the Ticket alone says no */
    const d = runOf('test_ticket', fill[0], 'test_copier');
    assert.equal(PK.perkCap(d, RULE, data.PERKS), RULE.cap + 2);
    assert.equal(PK.perkNoDrop(d, data.PERKS), 'test_ticket');
    /* the copier alone under the Ticket, the Ticket gone: nothing */
    assert.equal(PK.perkNoDrop(runOf(fill[0], 'test_copier'), data.PERKS), '');
  });
});

/* ---------- rule faintPaysNothing ---------- */

test('PK-7 rule faintPaysNothing: a win in which one of yours fainted pays no Moneys; a clean win pays', () => {
  const BR = modules['battle-rewards'],
    { fx } = perks({
      id: 'test_contract',
      name: 'Test Contract',
      fx: [
        { kind: 'money', mult: 3, if: 'foe:trainer' },
        { kind: 'rule', rule: 'faintPaysNothing', n: 1 },
      ],
    });
  reseed(3);
  const s = startedSave(ofType('Water'), 30),
    T = { reward: 100 },
    pay = (kind, fainted, rows) =>
      BR.battleRewards({ kind, over: 'win', T, tid: 'x', foe: [{ lvl: 10 }], fx: rows, fainted }, s, null);
  /* the contract's rows as a trainer battle reads them (foe:trainer holds) */
  const trainer = fx.map(f => ({ ...f })),
    wildRows = fx.filter(f => f.kind === 'rule');
  assert.equal(pay('trainer', 0, trainer).reward, 300, 'trainers pay triple');
  const lost = pay('trainer', 1, trainer);
  assert.equal(lost.reward, 0);
  assert.equal(lost.noPay, 'test_contract');
  const w = pay('wild', 0, wildRows);
  assert.ok(w.prize > 0);
  assert.equal(pay('wild', 2, wildRows).prize, 0);
  /* without the rule a faint changes nothing */
  assert.equal(pay('trainer', 1, null).reward, 100);
  assert.equal(pay('trainer', 1, null).noPay, undefined);
  /* in a real battle: one of yours fainted, then the win */
  withPerks(
    perks({ id: 'test_contract', name: 'Test Contract', fx: [{ kind: 'rule', rule: 'faintPaysNothing', n: 1 }] }).P,
    () => {
      const b = battle(fn('fxOfRun')({ perks: ['test_contract'] }, data.PERKS));
      b.fainted = 1;
      b.over = 'win';
      const r = BR.battleSettle(b, hooks.saveData || startedSave(ofType('Water'), 30));
      assert.equal(r.pay.prize, 0);
      assert.equal(r.pay.noPay, 'test_contract');
    }
  );
});

/* ---------- foe levels and the boss's HP, taken mid-run ---------- */

test('PK-7 level and bossHp rows taken mid-run move the foes at once (pools, trainers, the boss); let go, back', () => {
  const PK = modules.perks,
    L = modules['run-loop'],
    R = GAME_DATA.rules.run,
    MAP_DATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
    WORLD = {
      nodeTypes: GAME_DATA.nodeTypes,
      biomes: GAME_DATA.biomes,
      pools: data.POOLS,
      scenery: GAME_DATA.scenery,
      rules: R,
      region: modules['run-region'].runRegionData(GAME_DATA, data.TRAINERS),
    },
    { P } = perks(
      { id: 'test_early', name: 'Test Early', fx: [{ kind: 'level', n: 3 }] },
      { id: 'test_promo', name: 'Test Promo', fx: [{ kind: 'bossHp', mult: 1.3 }] }
    );
  withPerks(P, () => {
    const run = modules['run-state'].newRun('FINELEVEL1', 1, 1, {
      team: [],
      se: 0,
      items: {},
      pyramids: {},
      trip: { node: 0, plan: [] },
      wild: {},
      flags: {},
      seats: [],
      visited: {},
    });
    modules['run-map'].runMapStart(run, MAP_DATA);
    const W = modules['run-scenes'].runWorldTables(run, data.LOCATIONS[0], WORLD),
      foes = L.runFoes(run, { leaders: Object.values(data.TRAINERS).filter(T => T.miniboss), rules: R });
    assert.equal(W.foeUp, 0);
    try {
      data.worldPut({
        ...W,
        maps: Object.fromEntries(W.locations.slice(1).map(p => [p.mapId, { _lite: { tiles: 't' } }])),
        trainers: foes,
      });
      const pools = () => Object.keys(W.pools).map(id => data.POOLS[id].lv.join('-')),
        teams = () => Object.keys(foes).map(id => data.TRAINERS[id].team.map(e => e.lvl).join(',')),
        boss = Object.keys(foes).find(id => foes[id].runFoe === 'boss'),
        p0 = pools(),
        t0 = teams();
      assert.ok(boss, 'the run has a boss');
      assert.equal(data.TRAINERS[boss].hpMult, undefined);
      /* Early Access Pass's row: every pool and trainer three levels up, at once */
      assert.equal(PK.perkTake(run, 'test_early', data.PERKS, RULE), '');
      assert.deepEqual(
        pools(),
        p0.map(r =>
          r
            .split('-')
            .map(v => Math.min(100, +v + 3))
            .join('-')
        )
      );
      const t3 = teams();
      for (const [i, id] of Object.keys(foes).entries())
        assert.deepEqual(
          t3[i],
          t0[i]
            .split(',')
            .map(v => Math.min(100, +v + 3))
            .join(','),
          id
        );
      assert.notDeepEqual(pools(), p0);
      /* Paid Promotion's row: the boss's HP */
      assert.equal(PK.perkTake(run, 'test_promo', data.PERKS, RULE), '');
      assert.equal(data.TRAINERS[boss].hpMult, 1.3);
      assert.deepEqual(teams(), t3, 'a bossHp row moves no level');
      /* let go: back to as made */
      run.perks = [];
      assert.equal(L.runFoesSync(run, data.PERKS), -3);
      assert.deepEqual(pools(), p0);
      assert.deepEqual(teams(), t0);
      assert.equal(data.TRAINERS[boss].hpMult, undefined);
      /* the world made again with the Perk held agrees with the one moved */
      run.perks = ['test_early'];
      L.runFoesSync(run, data.PERKS);
      const W2 = modules['run-scenes'].runWorldTables(run, data.LOCATIONS[0], WORLD);
      assert.equal(W2.foeUp, 3);
      assert.deepEqual(
        pools(),
        Object.keys(W2.pools).map(id => W2.pools[id].lv.join('-'))
      );
      /* another run's take leaves this world alone */
      const other = runOf();
      other.seed = 'ANOTHER001';
      assert.equal(PK.perkTake(other, 'test_promo', data.PERKS, RULE), '');
      assert.equal(data.TRAINERS[boss].hpMult, undefined);
    } finally {
      data.worldHubBack();
    }
    assert.equal(L.runFoesSync(run, data.PERKS), 0, 'no run world in: nothing');
  });
});

/* ---------- the fine rarity and the leader's pick ---------- */

test('PK-7 fine: a leader rule draws that rarity alone, evenly; ordinary picks, shops and events never offer fine', () => {
  const PK = modules.perks,
    E = modules.encounters,
    fineIds = ['test_f1', 'test_f2', 'test_f3', 'test_f4'],
    P = Object.fromEntries(fineIds.map(id => [id, { name: id, d: 'A test.', rarity: 'fine', fx: [] }])),
    LEAD = { ...RULE, leader: { rarity: 'fine', pick: 3 } };
  withPerks(P, () => {
    const seen = Object.fromEntries(fineIds.map(id => [id, 0]));
    for (let n = 0; n < 200; n++) {
      const r = runOf();
      r.offerN = n;
      const offer = PK.perkOffer(r, data.PERKS, LEAD, undefined, 'leader');
      assert.equal(offer.length, 3);
      for (const id of offer) {
        assert.ok(fineIds.includes(id), `${id} is fine`);
        seen[id]++;
      }
      /* the ordinary pick, a shop's shelf and an event's draw: never fine */
      for (const id of PK.perkOffer(r, data.PERKS, LEAD)) assert.notEqual(data.PERKS[id].rarity, 'fine');
      assert.notEqual(data.PERKS[PK.perkShelf(r, 1, n, data.PERKS, LEAD) || 'lucky_charm'].rarity, 'fine');
      const ev = E.encPerk(r, undefined, data.PERKS, LEAD);
      assert.ok(!ev || data.PERKS[ev].rarity !== 'fine');
    }
    /* evenly: each about 3/4 of the picks */
    for (const id of fineIds) assert.ok(seen[id] > 110 && seen[id] < 190, `${id}: ${seen[id]}`);
    /* held ones leave the leader's pool; all held: no pick */
    const r = runOf('test_f1', 'test_f2');
    assert.deepEqual(PK.perkOffer(r, data.PERKS, LEAD, undefined, 'leader').sort(), ['test_f3', 'test_f4']);
    assert.equal(PK.perkOfferMake(runOf(...fineIds), data.PERKS, LEAD, undefined, 'leader'), null);
    /* the No Perks challenge empties it too */
    const none = runOf();
    none.mods = ['noperks'];
    assert.equal(PK.perkOfferMake(none, data.PERKS, LEAD, undefined, 'leader'), null);
    /* without a leader rule a leader's pick is the ordinary one */
    const plain = runOf();
    assert.deepEqual(PK.perkOffer(plain, data.PERKS, RULE, undefined, 'leader'), PK.perkOffer(plain, data.PERKS, RULE));
    /* the Studio's offer order is the leader's pick */
    for (const o of PK.perkOfferOrder('FINEORDER1', data.PERKS, LEAD, 3))
      for (const id of o.offer) assert.equal(data.PERKS[id].rarity, 'fine');
  });
});
