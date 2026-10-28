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

test('PK-7 loot: walking in brings n items of an events.json loot table by weight, the same on a reload; none without the row', () => {
  const L = modules['run-loop'],
    { P } = perks(
      { id: 'test_box', name: 'Test Box', fx: [{ kind: 'loot', table: 'common', when: 'arrive' }] },
      { id: 'test_crate', name: 'Test Crate', fx: [{ kind: 'loot', table: 'common', n: 3, when: 'arrive' }] },
      { id: 'test_none', name: 'Test None', fx: [{ kind: 'loot', table: 'nosuchtable', when: 'arrive' }] }
    );
  const table = GAME_DATA.events.loot.common,
    ids = new Set(Object.keys(table).filter(k => table[k] > 0));
  const walk = (ids0, visited) => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.run = modules['run-state'].newRun('FINELOOT01', 1, 1, { team: [] });
    s.run.perks = ids0;
    s.run.path = Array.from({ length: visited }, (_, i) => i);
    const bag = JSON.stringify(s.items),
      out = {};
    L.runArriveFx(s, P, out);
    return { out: out.items || {}, same: bag === JSON.stringify(s.items), s };
  };
  const a = walk(['test_box'], 3);
  assert.deepEqual(Object.values(a.out), [1], 'one item');
  for (const id of Object.keys(a.out)) {
    assert.ok(ids.has(id), `${id} is in the common loot table`);
    assert.ok(a.s.items[id] >= 1, 'into the bag');
  }
  assert.equal(a.same, false);
  assert.deepEqual(walk(['test_box'], 3).out, a.out, 'the same place brings the same (a reload)');
  /* over many places every item of the table turns up */
  const seen = new Set();
  for (let v = 0; v < 120; v++) for (const id of Object.keys(walk(['test_box'], v).out)) seen.add(id);
  assert.deepEqual([...seen].sort(), [...ids].sort());
  assert.equal(
    Object.values(walk(['test_crate'], 5).out).reduce((x, y) => x + y, 0),
    3
  );
  /* none held, or a table that isn't there: nothing */
  for (const held of [[], ['test_none']]) {
    const none = walk(held, 3);
    assert.deepEqual(none.out, {});
    assert.equal(none.same, true);
  }
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
    /* the file's own Fine Print Perks are held, so the leader's pool is the four test ones */
    const held = Object.keys(data.PERKS).filter(k => data.PERKS[k].rarity === 'fine' && !fineIds.includes(k)),
      runOf = (...ids) => {
        const r = modules['run-state'].newRun('FINERUN001', 1, 1, { team: [] });
        r.perks = [...held, ...ids];
        return r;
      };
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

/* ---------- the reward pick's Perk card ---------- */

test('PK-7 the reward pick’s Perk card: an ordinary Perk not held, never Fine Print; taken through perkTake', () => {
  const W = modules.rewards,
    PK = modules.perks;
  /* a made-up Fine Print Perk in the file: never on a card */
  withPerks({ test_fine: { name: 'Test Fine', d: 'A test.', rarity: 'fine', fx: [] } }, () => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.run = runOf();
    const D = W.rewardDataGame(s.team);
    let seen = 0;
    for (let n = 0; n < 300 && seen < 25; n++) {
      void n;
      const R = W.rewardOfferMake(s.run, 'test', D);
      for (const c of R.cards.filter(c => c.kind === 'perk')) {
        seen++;
        assert.ok(data.PERKS[c.perk], c.perk);
        assert.notEqual(data.PERKS[c.perk].rarity, 'fine');
        assert.ok(!s.run.perks.includes(c.perk));
        assert.ok(modules['run-state'].validRunEnc(s.run.enc), 'the pick with a perk card is saved as valid');
      }
    }
    assert.ok(seen >= 10, `a perk card turned up ${seen} times`);
  });
  /* taken: held; at the cap it needs the one to let go */
  reseed(3);
  const s = startedSave(ofType('Water'), 30),
    fill = Object.keys(data.PERKS).filter(
      k =>
        data.PERKS[k].rarity !== 'fine' &&
        !data.PERKS[k].fx.some(f => f.kind === 'rule' || f.kind === 'copy' || f.kind === 'give')
    );
  s.run = runOf();
  const D = W.rewardDataGame(s.team),
    card = id => ({ cards: [{ id: 'perk', kind: 'perk', perk: id }], rolls: 0, from: 'test' });
  modules['run-enc'].encOf(s.run).reward = card(fill[0]);
  assert.equal(W.rewardTake(s.run, s, 0, D), '');
  assert.deepEqual(s.run.perks, [fill[0]]);
  assert.equal(s.run.enc.reward, null);
  s.run.perks = fill.slice(0, RULE.cap);
  s.run.enc.reward = card(fill[RULE.cap]);
  assert.equal(W.rewardTake(s.run, s, 0, D), 'full');
  assert.ok(s.run.enc.reward, 'the pick stays open');
  assert.equal(W.rewardTake(s.run, s, 0, D, { drop: fill[0] }), '');
  assert.ok(s.run.perks.includes(fill[RULE.cap]) && !s.run.perks.includes(fill[0]));
  /* the No Perks challenge: no perk card at all */
  const none = runOf();
  none.mods = ['noperks'];
  for (let n = 0; n < 60; n++) {
    void n;
    const R = W.rewardOfferMake(none, 'test', D);
    assert.ok(!R || !R.cards.some(c => c.kind === 'perk'));
  }
  /* a pick of one kind (an event's "reward tutor") never holds one */
  assert.ok(
    W.rewardOfferMake(s.run, 'test', D, { kind: 'tutor' }) == null ||
      !s.run.enc.reward.cards.some(c => c.kind === 'perk')
  );
  void PK;
});

/* ---------- xp rows on a Perk ---------- */

test('PK-7 xp on a Perk: the XP your Billies get from a battle, times its mult (heldXp reads the run’s rows)', () => {
  const { P, fx } = perks({ id: 'test_planner', fx: [{ kind: 'xp', mult: 0.25 }] });
  withPerks(P, () => {
    const b = battle(fx),
      m = mine(b);
    assert.equal(fn('heldXp')(m, 100), 25);
  });
  const b = battle(null);
  assert.equal(fn('heldXp')(mine(b), 100), 100);
});

/* ---------- the 12 Fine Print Perks of perks.json ---------- */

const FINE = [
  'terms_conditions',
  'energy_drink',
  'glass_trophy',
  'overclock_chip',
  'ethics_waiver',
  'hustle_planner',
  'influencer_contract',
  'nonrefundable_ticket',
  'early_access',
  'subscription_box',
  'heavy_crown',
  'paid_promotion',
];
const real = ids => fn('fxOfRun')({ perks: ids }, data.PERKS);
const hit = (deal, take) => ({ cat: 'H', type: 'None', deal, take });

test('PK-7 the 12 Fine Print Perks: in perks.json, rarity fine, a picture each, a downside in each text', () => {
  for (const id of FINE) {
    const P = data.PERKS[id];
    assert.ok(P, id);
    assert.equal(P.rarity, 'fine', id);
    assert.equal(P.img, `perks/${id}.svg`);
    assert.ok(P.d.length <= 160);
  }
  assert.deepEqual(
    Object.keys(data.PERKS).filter(k => data.PERKS[k].rarity === 'fine'),
    FINE
  );
});

test('PK-7 Terms and Conditions, Glass Trophy, Paid Promotion: harder hits, dearer shops; harder hits taken; cheaper shops, a tougher boss', () => {
  const E = modules.effects;
  assert.equal(E.fxDamage(real(['terms_conditions']), hit(true, false)), 1.3);
  assert.equal(E.fxRunPrice({ perks: ['terms_conditions'] }, data.PERKS, 'shop', 100), 150);
  assert.equal(E.fxRunPrice({ perks: ['terms_conditions'] }, data.PERKS, 'heal', 40), 60);
  assert.equal(E.fxDamage(real(['glass_trophy']), hit(true, false)), 1.5);
  assert.equal(E.fxDamage(real(['glass_trophy']), hit(false, true)), 1.3);
  assert.equal(E.fxRunPrice({ perks: ['paid_promotion'] }, data.PERKS, 'shop', 100), 60);
  assert.equal(E.fxRunBossHp({ perks: ['paid_promotion'] }), 1.3);
  /* both: 1.5 x 0.6 */
  assert.equal(E.fxRunPrice({ perks: ['terms_conditions', 'paid_promotion'] }, data.PERKS, 'shop', 100), 90);
});

test('PK-7 Energy Drink: Speed up two stages as each takes the field; 15% more damage taken', () => {
  const b = battle(real(['energy_drink']));
  assert.equal(fn('fieldState')(0).st.hus, 2);
  /* the lines wait for the sides to come out (sayBattleFx) */
  fn('sayBattleFx')();
  assert.ok(
    lines(b).some(t => /^Energy Drink: .*Speed rose sharply\.$/.test(t)),
    lines(b).join(' | ')
  );
  assert.equal(modules.effects.fxDamage(real(['energy_drink']), hit(false, true)), 1.15);
});

test('PK-7 Overclock Chip: 35% harder hits, 8% of the user’s HP for each attack that lands', () => {
  const H = anyHit('H'),
    b = battle(real(['overclock_chip'])),
    m = mine(b),
    mx = fn('maxHp')(m);
  tough(foe(b));
  m.hp = mx;
  fn('useMove')(0, H, 1);
  assert.equal(m.hp, mx - Math.max(1, Math.floor(mx * 0.08)));
  assert.equal(modules.effects.fxDamage(real(['overclock_chip']), hit(true, false)), 1.35);
});

test('PK-7 Ethics Waiver: spliced wild Billies three times as often, twice the DNA; clinics charge double', () => {
  const E = modules.effects,
    fx = real(['ethics_waiver']);
  assert.equal(E.fxSplice(fx, 'splice'), 3);
  assert.equal(E.fxSplice(fx, 'dna'), 2);
  assert.equal(E.fxRunPrice({ perks: ['ethics_waiver'] }, data.PERKS, 'heal', 40), 80);
  assert.equal(E.fxRunPrice({ perks: ['ethics_waiver'] }, data.PERKS, 'shop', 40), 40);
});

test('PK-7 Hustle Planner: wins pay double, Billies get a quarter of the XP', () => {
  assert.equal(modules.effects.fxMoney(real(['hustle_planner']), 100), 200);
  const b = battle(real(['hustle_planner']));
  assert.equal(fn('heldXp')(mine(b), 100), 25);
});

test('PK-7 Influencer Contract: trainers pay triple, wild Billies as before; a faint and the battle pays nothing', () => {
  const BR = modules['battle-rewards'];
  reseed(3);
  const s = startedSave(ofType('Water'), 30),
    pay = (kind, fainted) =>
      BR.battleRewards(
        {
          kind,
          over: 'win',
          T: { reward: 100 },
          tid: 'x',
          foe: [{ lvl: 10 }],
          fx: fn('fxBattleRows')({
            kind,
            fx: real(['influencer_contract']),
            T: { reward: 100 },
            sides: [{ team: s.team }, { team: [] }],
            turn: 1,
          }),
          fainted,
        },
        s,
        null
      ),
    plain = BR.battleRewards({ kind: 'wild', over: 'win', foe: [{ lvl: 10 }] }, s, null);
  assert.equal(pay('trainer', 0).reward, 300);
  assert.equal(pay('wild', 0).prize, plain.prize, 'a wild Billie pays as before');
  const lost = pay('trainer', 1);
  assert.equal(lost.reward, 0);
  assert.equal(lost.noPay, 'influencer_contract');
  assert.equal(pay('wild', 1).prize, 0);
});

test('PK-7 Non-Refundable Ticket with Accordion File and Photocopier: 8, 9 and 11 held; none ever let go', () => {
  const PK = modules.perks,
    fill = Object.keys(data.PERKS).filter(
      k =>
        data.PERKS[k].rarity !== 'fine' &&
        !data.PERKS[k].fx.some(f => f.kind === 'rule' || f.kind === 'copy' || f.kind === 'give')
    );
  const r = runOf('nonrefundable_ticket');
  assert.equal(PK.perkCap(r, RULE, data.PERKS), 8);
  assert.equal(PK.perkNoDrop(r, data.PERKS), 'nonrefundable_ticket');
  r.perks.push('accordion_file');
  assert.equal(PK.perkCap(r, RULE, data.PERKS), 9);
  /* a Photocopier just below the Ticket copies its +2 and its no */
  const c = runOf('accordion_file', 'nonrefundable_ticket', 'photocopier');
  assert.equal(PK.perkCap(c, RULE, data.PERKS), 11);
  for (const id of fill.slice(0, 8)) assert.equal(PK.perkTake(c, id, data.PERKS, RULE), '');
  assert.equal(c.perks.length, 11);
  assert.equal(PK.perkTake(c, fill[8], data.PERKS, RULE), 'full');
  for (const k of c.perks) assert.equal(PK.perkTake(c, fill[8], data.PERKS, RULE, k), 'noDrop', k);
  /* the Ticket taken at the cap may let one go; from then on none */
  const d = runOf(...fill.slice(0, 6));
  assert.equal(PK.perkTake(d, 'nonrefundable_ticket', data.PERKS, RULE, fill[0]), '');
  assert.equal(PK.perkTake(d, fill[6], data.PERKS, RULE), '');
  assert.equal(PK.perkTake(d, fill[7], data.PERKS, RULE), '');
  assert.equal(PK.perkTake(d, fill[8], data.PERKS, RULE, fill[1]), 'noDrop');
});

test('PK-7 Early Access Pass: the map shown; foes 3 levels higher, at once when taken mid-run', () => {
  const E = modules.effects,
    r = runOf('early_access');
  assert.equal(E.fxRunRule(r, 'mapReveal'), 1);
  assert.equal(E.fxRunFoeLevels(r), 3);
  assert.equal(E.fxRunFoeLevels(runOf()), 0);
});

test('PK-7 Subscription Box: an item of the common loot table and 15 Moneys gone at every place walked into', () => {
  const L = modules['run-loop'],
    table = GAME_DATA.events.loot.common;
  reseed(3);
  const s = startedSave(ofType('Water'), 30);
  s.run = modules['run-state'].newRun('FINEBOXRUN', 1, 1, { team: [] });
  s.run.perks = ['subscription_box'];
  s.se = 100;
  let got = 0;
  for (let v = 1; v <= 4; v++) {
    s.run.path = Array.from({ length: v }, (_, i) => i);
    const out = {};
    L.runArriveFx(s, data.PERKS, out);
    assert.equal(out.cost, 15);
    for (const id of Object.keys(out.items)) assert.ok(table[id] > 0, id);
    got += Object.values(out.items).reduce((a, n) => a + n, 0);
  }
  assert.equal(s.se, 40);
  assert.equal(got, 4);
});

test('PK-7 Heavy Crown: the lead hits 40% harder and takes 20% less; the other Billie on the field hits 15% less', () => {
  reseed(7);
  const s = startedSave(starter(), 12);
  s.team.push(fn('makeBilly')(starter(), 12));
  const foes = [fn('makeBilly')(wild(), 12), fn('makeBilly')(wild(), 12)];
  assert.ok(fn('newBattle')('wild', foes, { fmt: 'double', seed: 'crown', fx: real(['heavy_crown']) }));
  const H = data.MOVES[anyHit('H')],
    h = { crit: false, te: 1 },
    lead = fn('actorIndex')(0, 0),
    other = fn('actorIndex')(0, 1),
    foeK = fn('actorIndex')(1, 0);
  assert.ok(Math.abs(fn('fxHitMult')(lead, foeK, H, h) - 1.4) < 1e-9);
  assert.ok(Math.abs(fn('fxHitMult')(other, foeK, H, h) - 0.85) < 1e-9);
  assert.ok(Math.abs(fn('fxHitMult')(foeK, lead, H, h) - 0.8) < 1e-9);
  assert.equal(fn('fxHitMult')(foeK, other, H, h), 1);
});

test('PK-7 every Perk of Waves A-D and Fine Print at once: whole battles end, every number finite, replayable', () => {
  const ids = Object.keys(data.PERKS).slice(13);
  assert.equal(ids.length, 65);
  const team = [ofType('Fire'), ofType('Water'), ofType('Grass')];
  const play = seed => {
    reseed(7);
    const s = startedSave(team[0], 20);
    for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, 20));
    const f = fn('makeBilly')(ofType('Grass'), 20);
    assert.ok(fn('newBattle')('wild', [f], { fmt: 'single', seed, fx: real(ids), perkState: {} }));
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
  for (const seed of ['all-fine-a', 'all-fine-b', 'all-fine-c']) assert.equal(play(seed), play(seed), seed);
  /* the run's moments and rules, many times over: finite */
  reseed(3);
  const s = startedSave(ofType('Water'), 30),
    L = modules['run-loop'],
    E = modules.effects;
  s.run = modules['run-state'].newRun('FINEALLRUN', 1, 1, { team: [] });
  s.run.perks = ids;
  s.se = 500;
  for (let i = 0; i < 12; i++) {
    s.run.path = Array.from({ length: i }, (_, j) => j);
    L.runArriveFx(s, data.PERKS, {});
    L.runBuyFx(s, data.PERKS, 50);
    L.runFxMoment(s, data.PERKS, 'win', { foe: ['wild'], noFaint: true });
    L.runFxMoment(s, data.PERKS, 'catch', { foe: ['wild'] });
  }
  assert.ok(Number.isInteger(s.se) && s.se >= 0, String(s.se));
  for (const r of E.FX_RULES) assert.ok(Number.isInteger(E.fxRunRule(s.run, r)), r);
  assert.ok(Number.isFinite(E.fxRunFoeLevels(s.run)) && Number.isFinite(E.fxRunBossHp(s.run)));
  for (const f of E.fxAt(real(ids), {}, { run: s.run.perkState }))
    for (const k of ['mult', 'share', 'n', 'stages', 'add'])
      if (k in f) assert.ok(Number.isFinite(f[k]), `${f.src} ${k}`);
  const dm = E.fxDamage(real(ids), hit(true, true));
  assert.ok(dm >= E.FX_LIMIT.lo && dm <= E.FX_LIMIT.hi * E.FX_LIMIT.hi, String(dm));
});
