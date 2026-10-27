// ON-2: a friend's ghost and a board run on the game's own data: where the ghost waits on a run's map (logic/run-map.js
// runMapGhost: one main-path place in its band, never on Blake's row, the rest of the map as without it), its foe
// (run-loop.js runFoes: the friend's name, their Billies as they were at the node's level), the trainer team it makes
// (game-data.js trainerTeam), and a daily's start (every unlock, Blake meeting you for the first time, no hub bonus).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { GAME_DATA, data, fn, hooks, modules, reseed } from './setup-real.mjs';

const { runStartPlan, runStartOn } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { runFoes } = modules['run-loop'],
  { validRun } = modules['run-state'],
  { onlineCopy } = modules['online-legal'];
const RAW = readGameData(),
  R = GAME_DATA.rules.run,
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: R,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: runRegionData(RAW, RAW.trainers),
    fieldMoves: GAME_DATA.fieldMoves.moves,
  },
  SEEDS = Array.from({ length: 60 }, (_, k) => `G${k.toString(36).toUpperCase()}HOST`),
  SP = Object.keys(data.SPECIES);

/** a friend's ghost: two of their Billies, at Lv 30 and 20 */
function ghost() {
  reseed(3);
  const a = onlineCopy(fn('makeBilly')(SP[0], 30), { u: 'fr1', n: 'Robin' }),
    b = onlineCopy(fn('makeBilly')(SP[1], 20), { u: 'fr1', n: 'Robin' });
  a.nick = 'Boss';
  return { u: 'fr1', n: 'Robin', party: [a, b] };
}

test('the ghost waits on one main-path place in its band, Blake keeping his; the rest of the map is as without it', () => {
  let placed = 0;
  for (const seed of SEEDS) {
    const plain = runStartPlan(seed, DATA, { expedition: 2 }),
      p = runStartPlan(seed, DATA, { expedition: 2, ghost: ghost() }),
      at = p.map.nodes.flatMap((n, i) => (n.type === 'ghost' ? [i] : []));
    assert.ok(at.length <= 1, seed);
    assert.equal(plain.map.nodes.filter(n => n.type === 'ghost').length, 0);
    /* every other place is the same */
    p.map.nodes.forEach((n, i) => {
      if (n.type !== 'ghost') assert.deepEqual(n, plain.map.nodes[i]);
    });
    if (!at.length) {
      assert.equal(p.ghost, null, 'no place, no ghost kept');
      continue;
    }
    placed++;
    const n = p.map.nodes[at[0]],
      was = plain.map.nodes[at[0]],
      rows = p.map.nodes.filter(x => !x.side).reduce((m, x) => Math.max(m, x.row), 0) + 1;
    assert.ok(R.ghost.on.includes(was.type) || was.type === R.ghost.spare, `${seed}: on a ${was.type}`);
    /* a town taken leaves another on its row */
    if (was.type === R.ghost.spare)
      assert.ok(p.map.nodes.some((x, j) => j !== at[0] && x.row === n.row && x.type === R.ghost.spare));
    assert.ok(!n.side);
    assert.ok(n.row / rows >= R.ghost.band[0] && n.row / rows < R.ghost.band[1]);
    assert.equal(p.ghost.u, 'fr1');
    assert.deepEqual(
      runStartPlan(seed, DATA, { expedition: 2, ghost: ghost() }).map,
      p.map,
      'the same seed, the same map'
    );
  }
  assert.ok(placed >= SEEDS.length * 0.9, `placed on ${placed} of ${SEEDS.length}`);
});

test("the ghost's foe: the friend's name, their Billies as they were at the node's level, a reward, never blocking", () => {
  const leaders = Object.values(GAME_DATA.trainers).filter(T => T.miniboss),
    seed = SEEDS.find(s => runStartPlan(s, DATA, { ghost: ghost() }).ghost);
  const p = runStartPlan(seed, DATA, { ghost: ghost() }),
    run = modules['run-state'].newRun(seed, 1, 1, {});
  Object.assign(run, { map: p.map, region: p.region, ghost: p.ghost });
  const F = Object.values(runFoes(run, { leaders, rules: R })).filter(f => f.runFoe === 'ghost');
  assert.equal(F.length, 1);
  const [G] = F;
  assert.equal(G.name, 'Robin');
  assert.equal(G.who, R.ghost.who);
  assert.equal(G.reward, R.ghost.reward);
  assert.equal(G.blocks, false);
  assert.equal(G.team.length, 2);
  assert.equal(
    G.team[1].lvl,
    Math.max(1, Math.round((G.team[0].lvl * 20) / 30)),
    'in the same proportion as they were'
  );
  /* the trainer team the battle fields: their moves, nickname and look, at the node's level, full HP */
  const team = fn('trainerTeam')(G);
  assert.equal(team[0].sp, SP[0]);
  assert.equal(team[0].lvl, G.team[0].lvl);
  assert.equal(team[0].nick, 'Boss');
  assert.deepEqual(team[0].moves, p.ghost.party[0].moves);
  assert.notEqual(team[0].uid, p.ghost.party[0].uid, 'a battle copy');
  assert.equal(team[0].hp, fn('maxHp')(team[0]));
  /* without its ghost (an old run), the node fields nobody rather than failing */
  delete run.ghost;
  assert.equal(Object.values(runFoes(run, { leaders, rules: R })).filter(f => f.runFoe === 'ghost').length, 0);
});

test('a daily starts the same for everyone: its board, Blake meeting you for the first time, no hub bonus', () => {
  reseed(1);
  const s = fn('newSave')();
  s.started = true;
  s.starter = GAME_DATA.rules.start.starters[0];
  s.team.push(fn('makeBilly')(s.starter + '0', 5));
  s.meta.history = [
    {
      ...{
        seed: 'X',
        theme: '',
        region: '',
        exp: 1,
        won: 1,
        lost: 0,
        quit: 0,
        days: 3,
        perks: 0,
        team: [],
        leaders: [],
        rival: { met: 2, won: 1 },
      },
    },
  ];
  s.meta.rel = { hazel: 999 };
  hooks.provide({ saveData: s });
  const unlocks = modules.unlocks.runUnlocks({ meta: { unlocks: GAME_DATA.unlocks } }, DATA.unlockData),
    run = runStartOn(
      s,
      runStartPlan('d2026-10-26', DATA, { unlocks, expedition: 1, board: { k: 'd', n: 20387 }, ghost: ghost() }),
      { home: [s.team[0].uid] }
    );
  assert.deepEqual(run.board, { k: 'd', n: 20387 });
  assert.equal(run.rival.past, 0);
  assert.equal(run.rel, undefined);
  assert.deepEqual(run.unlocks, unlocks);
  assert.ok(unlocks.length > 0);
  assert.equal(validRun(run), true);
  assert.equal(validRun({ ...run, board: { k: 'x', n: 1 } }), false);
  assert.equal(validRun({ ...run, ghost: { ...run.ghost, party: [] } }), false);
});
