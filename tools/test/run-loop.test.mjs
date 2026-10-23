// RL-8: the run loop's rules (game/js/logic/run-loop.js) on the game's own data: a run town's
// heal price and shop, the mini-bosses and the boss, a battle's seed, releasing a Billie and the payout screen's rows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, data, fn, modules, reseed, startedSave } from './setup-real.mjs';

const L = modules['run-loop'],
  { runMapStart } = modules['run-map'],
  { newRun, payoutOf } = modules['run-state'],
  { runWildLevels } = modules['run-scenes'];
const R = GAME_DATA.rules.run,
  MAPDATA = { nodeTypes: GAME_DATA.nodeTypes, biomes: GAME_DATA.biomes, rules: R },
  LEADERS = Object.values(data.TRAINERS).filter(T => T.miniboss);
/** a run on the game's rules, its map made from the seed */
function runOf(seed) {
  const run = newRun(seed, 1, 1, { team: [] });
  runMapStart(run, MAPDATA);
  return run;
}

test("a run town's clinic charges for each hurt Billie: below full HP, fainted, with a status", () => {
  reseed();
  const s = startedSave('musk0', 10),
    mk = () => fn('makeBilly')('musk0', 10);
  s.team.push(mk(), mk(), mk());
  assert.deepEqual(L.runHealCost(s.team, 60), { hurt: 0, cost: 0 });
  s.team[0].hp -= 1;
  s.team[1].hp = 0;
  s.team[2].status = 'scn';
  assert.deepEqual(L.runHealCost(s.team, 60), { hurt: 3, cost: 180 });
  assert.deepEqual(L.runHealCost(s.team, 0), { hurt: 3, cost: 0 });
});

test("a run town's clinic: paid and healed when hurt and the money is there, else nothing changes", () => {
  reseed();
  const s = startedSave('musk0', 10),
    mk = () => fn('makeBilly')('musk0', 10);
  s.team.push(mk());
  s.se = 100;
  assert.deepEqual(L.runClinic(s, 60), { hurt: 0, cost: 0, paid: 0 }, 'nobody hurt: nothing to pay');
  s.team[0].hp = 1;
  s.team[1].status = 'scn';
  assert.deepEqual(L.runClinic(s, 60), { hurt: 2, cost: 120, paid: 0 }, 'too little money');
  assert.equal(s.se, 100);
  assert.equal(s.team[0].hp, 1);
  s.se = 130;
  assert.deepEqual(L.runClinic(s, 60), { hurt: 2, cost: 120, paid: 120 });
  assert.equal(s.se, 10);
  assert.equal(s.team[0].hp, fn('maxHp')(s.team[0]));
  assert.equal(s.team[1].status, null);
});

test("a run town's shop: always its wares, then more drawn by weight, the same on a reload, by day", () => {
  const run = runOf('SHOPRUN'),
    stocks = new Set();
  for (let day = 1; day <= 12; day++) {
    const a = L.runShopStock(run, 3, day, R.shop),
      key = JSON.stringify(a);
    assert.equal(key, JSON.stringify(L.runShopStock(run, 3, day, R.shop)), 'the same stock again');
    assert.equal(a.length, R.shop.always.length + R.shop.more);
    const ids = a.map(w => (w.coin ? 'coin:' + w.coin : w.item));
    assert.deepEqual(ids.slice(0, R.shop.always.length), R.shop.always);
    assert.equal(new Set(ids).size, ids.length, 'no ware twice');
    stocks.add(key);
  }
  assert.ok(stocks.size >= 3, `the stock changes with the day (${stocks.size} stocks in 12 days)`);
  /* a weight of 0 is never drawn; the record's layout doesn't change the draw */
  const rule = { always: [], more: 2, pick: { pretzel: 1, loophole: 0, bailout: 1 } },
    flipped = { always: [], more: 2, pick: { bailout: 1, loophole: 0, pretzel: 1 } };
  for (let day = 1; day <= 30; day++) {
    const a = L.runShopStock(run, 1, day, rule);
    assert.ok(!a.some(w => w.item === 'loophole'));
    assert.equal(new Set(a.map(w => w.item)).size, 2, 'both, none twice');
    assert.deepEqual(a, L.runShopStock(run, 1, day, flipped));
  }
});

test("the run's foes: a leader on every mini-boss node and the boss's, none twice, at their row's levels", () => {
  assert.equal(LEADERS.length, 8);
  for (let k = 0; k < 200; k++) {
    const run = runOf(`FOES${k}`),
      foes = L.runFoes(run, { leaders: LEADERS, rules: R }),
      want = run.map.nodes.flatMap((n, i) => (n.type === 'miniboss' || n.type === 'boss' ? [i] : []));
    assert.deepEqual(Object.keys(foes).sort(), want.map(L.runFoeId).sort());
    assert.equal(new Set(Object.values(foes).map(F => F.from)).size, want.length, 'no leader twice in a run');
    assert.deepEqual(L.runFoes(run, { leaders: LEADERS.slice().reverse(), rules: R }), foes, 'the same foes again');
    for (const F of Object.values(foes)) {
      const i = F.runNode,
        node = run.map.nodes[i],
        T = data.TRAINERS[F.from],
        top = runWildLevels(run.map, i, { rules: R })[1] + R.foes[node.type].up;
      assert.equal(F.node, i + 1);
      assert.equal(Math.max(...F.team.map(e => e.lvl)), top);
      assert.ok(F.team.every(e => e.lvl >= 1 && e.lvl <= 100));
      for (const k of ['script', 'seat', 'egg', 'runsUp', 'after', 'when', 'unless', 'hint', 'miniboss'])
        assert.ok(!(k in F), `a run foe has no ${k}`);
      assert.ok(!/Badge/.test(F.win), F.win);
      if (node.type === 'miniboss') {
        assert.deepEqual([F.blocks, F.double, F.alpha], [true, true, undefined]);
        assert.equal(F.team.length, T.team.length);
        assert.equal(F.reward, R.foes.miniboss.reward);
      } else {
        assert.deepEqual([F.blocks, F.double, F.alpha, F.team.length], [false, false, true, 1]);
        assert.equal(F.reward, R.foes.boss.reward);
      }
    }
  }
});

test("a leader's win line loses its badge", () => {
  assert.equal(L.runFoeWinText('“Well fought. The Ground Badge is yours.”'), '“Well fought.”');
  assert.equal(
    L.runFoeWinText('“Not a flaw on you. The Electric Badge is yours. And the needle? It cracked.”'),
    '“Not a flaw on you. And the needle? It cracked.”'
  );
  assert.equal(L.runFoeWinText('“The Fire Badge is yours.”'), '');
  assert.equal(L.runFoeWinText('Plain words.'), 'Plain words.');
});

test("a battle's seed is its node's and its number's", () => {
  const run = runOf('SEEDRUN');
  assert.equal(L.runBattleSeed(run, 2, 5), 'SEEDRUN|n2|battle|5');
  assert.notEqual(L.runBattleSeed(run, 2, 5), L.runBattleSeed(run, 2, 6));
});

test("a run battle's start: its seed, the forecast's weather (clear is sunny), the Loopholes' rows when held", () => {
  const run = runOf('RL8BATTLEX'),
    { runWeather } = modules['run-map'],
    { battleWeatherOf } = modules.weather;
  for (let i = 0; i < run.map.nodes.length; i++) {
    const w = runWeather(run, i, run.clock) || 'clear',
      x = L.runBattleExtra(run, i, 4, GAME_DATA.rules.env, null);
    assert.equal(x.seed, L.runBattleSeed(run, i, 4));
    assert.deepEqual(x.wx, battleWeatherOf(w === 'clear' ? 'sunny' : w, GAME_DATA.rules.env), `node ${i}: ${w}`);
    assert.ok(!('fx' in x), 'no Loopholes: no fx');
  }
  const fx = [{ kind: 'money', mult: 1.2, src: 'x' }];
  assert.equal(L.runBattleExtra(run, 0, 0, GAME_DATA.rules.env, fx).fx, fx);
});

test("the run's end keeps the whole party on a win, only the one picked on a loss; items count at their shop price", () => {
  const team = [{ uid: 'a' }, { uid: 'b' }, { uid: 'c' }];
  assert.deepEqual(L.runKept(team, true, 'b'), ['a', 'b', 'c']);
  assert.deepEqual(L.runKept(team, false, 'b'), ['b']);
  assert.deepEqual(L.runKept(team, false, 'z'), [], 'not in the party: none');
  const id = Object.keys(data.ITEMS).find(k => data.ITEMS[k].price > 0);
  assert.equal(L.runItemPrice(id), data.ITEMS[id].price);
  assert.equal(L.runItemPrice('no-such-item'), 0);
});

test('releasing: a Billie caught on the run is paid at the end, one from home only leaves the party', () => {
  reseed();
  const s = startedSave('musk0', 10),
    home = s.team[0],
    caught = fn('makeBilly')('musk0', 7);
  s.run = newRun('R', 1, 1, { team: [JSON.parse(JSON.stringify(home))] });
  s.team.push(caught);
  L.runRelease(s, home);
  assert.deepEqual(s.run.released, []);
  L.runRelease(s, caught);
  assert.deepEqual(s.run.released, [{ sp: 'musk0', lvl: 7 }]);
  assert.equal(s.team.length, 0);
});

test("the payout screen's rows: payoutOf's lines with their words, the win row only on a win", () => {
  const price = id => (id === 'taxbreak' ? 150 : 0),
    end = { se: 750, items: { taxbreak: 2 }, released: 1, cleared: 6 },
    lost = L.runPayoutRows(payoutOf({ ...end, won: false }, R.payout, price), R.payout),
    won = L.runPayoutRows(payoutOf({ ...end, won: true }, R.payout, price), R.payout);
  assert.deepEqual(
    lost.map(r => r.label),
    ['Money left', 'Items in the bag', 'Billies released', 'Places reached']
  );
  assert.equal(won.at(-1).label, 'The boss beaten');
  assert.ok(!won.some(r => r.label === 'Items in the bag'), 'RL-9b: a win takes the bag home, not paid');
  assert.equal(won.at(-1).value, R.payout.win);
  assert.equal(lost[0].value, Math.floor(750 * R.payout.money));
  assert.match(lost[0].note, /\$750 at 10%/);
});

test('during a run storage stays in Copperleaf: only the party counts, nothing moves in or out, a 7th waits', () => {
  reseed();
  const s = startedSave('musk0', 10),
    mk = () => fn('makeBilly')('musk0', 5);
  for (let k = 0; k < 5; k++) s.team.push(mk());
  const resting = mk();
  s.box.push(resting);
  assert.equal(fn('allBillies')().length, 7, 'in the hub the box counts');
  s.run = newRun('R', 1, 1, { team: [] });
  assert.equal(fn('allBillies')().length, 6, 'in a run only the party');
  assert.equal(fn('findBilly')(resting.uid), undefined);
  assert.equal(fn('toBox')(s.team[1]), false);
  assert.equal(fn('toTeam')(resting), false);
  assert.equal(s.team.length, 6);
  assert.deepEqual(s.box, [resting]);
  const seventh = mk();
  assert.equal(fn('addBilly')(seventh), 'full');
  assert.equal(s.team.length, 6);
  assert.deepEqual(s.box, [resting], 'the 7th never goes to the hub’s storage');
  s.team[0].hp = 1;
  resting.hp = 1;
  fn('healAll')();
  assert.equal(s.team[0].hp, fn('maxHp')(s.team[0]));
  assert.equal(resting.hp, 1, 'a heal on a run doesn’t reach storage');
  s.run = null;
  assert.equal(fn('addBilly')(seventh), 'box');
});

test("on a run new ids come from the run's counter, so a run made again gives the same ones", () => {
  const s = startedSave('musk0', 10);
  assert.match(fn('newUid')(), /^m[0-9a-z]+$/, 'the hub: from the clock');
  s.meta.runs = 3;
  s.run = newRun('R', 1, 1, { team: [] });
  assert.deepEqual([fn('newUid')(), fn('newUid')(), fn('makeBilly')('musk0', 5).uid], ['r3-0', 'r3-1', 'r3-2']);
  assert.equal(s.run.uidN, 3);
  s.run = null;
});
