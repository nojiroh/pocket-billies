// RL-S2: Blake, the rival, on the game's own data: where he waits on a run's map (logic/run-map.js runMapRival):
// how many meetings by Expedition, in which share of the rows, only on a main-path route, one a row, the same for the
// same seed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { data, fn, GAME_DATA, modules } from './setup-real.mjs';

const { runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { runMapRival } = modules['run-map'];
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
  SEEDS = Array.from({ length: 300 }, (_, k) => `RIVAL${k.toString(36).toUpperCase()}`);

test('meetings by Expedition, each in its band, on a main-path place, one a row', () => {
  for (const expedition of [1, 2, 5]) {
    const want = R.rival.meet[Math.min(expedition, R.rival.meet.length) - 1];
    let met = 0;
    for (const seed of SEEDS) {
      const { map } = runStartPlan(seed, DATA, { expedition }),
        main = map.nodes.filter(n => !n.side),
        rows = main.reduce((m, n) => Math.max(m, n.row), 0) + 1,
        rivals = map.nodes.filter(n => n.type === 'rival');
      assert.ok(rivals.length <= want, `${seed}: ${rivals.length} meetings at Expedition ${expedition}`);
      assert.equal(new Set(rivals.map(n => n.row)).size, rivals.length, `${seed}: one a row`);
      for (const n of rivals) {
        assert.ok(!n.side, `${seed}: never in a side area`);
        assert.ok(
          R.rival.bands.some(([lo, hi]) => n.row / rows >= lo && n.row / rows < hi),
          `${seed}: in a band`
        );
      }
      met += rivals.length;
    }
    // a band without a route or a waystation has no meeting (Expedition II's maps often have only two free rows; RL-14's
    // scrapyards take some free nodes before he is placed), so the test asks only that nearly every run meets him at
    // least once
    assert.ok(
      met / SEEDS.length > Math.min(want, 1) * 0.8,
      `Expedition ${expedition}: ${met} meetings in ${SEEDS.length} runs`
    );
  }
});

test('he takes a route before a waystation, never a town; the same seed puts him on the same place; no meeting when meet is 0', () => {
  const nodes = [
      { type: 'landing', row: 0, lane: 0, to: [1, 2], seen: 0, biome: 'meadow' },
      { type: 'route', row: 1, lane: 0, to: [3], seen: 0, biome: 'meadow' },
      { type: 'town', row: 1, lane: 1, to: [3], seen: 0, biome: 'meadow' },
      { type: 'boss', row: 2, lane: 0, to: [], seen: 0, biome: 'meadow' },
    ],
    rules = { ...R.rival, on: ['route', 'event'], meet: [1, 0], bands: [[0, 1]] },
    a = { nodes: structuredClone(nodes) };
  assert.deepEqual(runMapRival('X', a, rules, 1), [1]);
  assert.equal(a.nodes[1].type, 'rival');
  assert.equal(a.nodes[2].type, 'town');
  const b = { nodes: structuredClone(nodes) };
  assert.deepEqual(runMapRival('X', b, rules, 2), [], 'Expedition II meets him 0 times here');
  assert.deepEqual(runMapRival('X', b, rules, 9), [], 'past the end: the last');
});

const { rivalTeam, rivalSize, rivalPast } = modules['rival'],
  typeEffectiveness = fn('typeEffectiveness'),
  { SPECIES } = data,
  { speciesStep } = modules['rules'],
  { rngFrom } = modules['rng'],
  step = id => speciesStep(SPECIES[id]),
  team = (seed, lead, met, top, dex = null) =>
    rivalTeam(rngFrom(seed, 'team'), lead, met, top, R.rival, SPECIES, dex, typeEffectiveness, step);

test('his ace counters the lead, every type; the team is the same for the same seed', () => {
  const TYPES = [...new Set(Object.values(SPECIES).flatMap(S => S.types || []))];
  for (const t of TYPES) {
    const canCounter = Object.values(SPECIES).some(S => (S.types || []).some(a => typeEffectiveness(a, [t]) > 1));
    for (let k = 0; k < 10; k++) {
      const [ace] = team(`ACE${t}${k}`, [t], 0, 20);
      if (canCounter)
        assert.ok(
          SPECIES[ace.sp].types.some(a => typeEffectiveness(a, [t]) > 1),
          `${ace.sp} against ${t}`
        );
      assert.equal(ace.lvl, 20);
    }
  }
  assert.deepEqual(team('SAME', ['Fire'], 3, 25), team('SAME', ['Fire'], 3, 25));
});

test('it grows by meetings, a level down the line, stages fit the level, the dex first', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 6, 50].map(m => rivalSize(R.rival, m)),
    [0, 1, 2, 3, 6, 50].map(m => Math.min(R.rival.max, R.rival.size + Math.floor(m / R.rival.grow)))
  );
  const six = team('GROW', ['Water'], 99, 12);
  assert.equal(six.length, R.rival.max);
  assert.deepEqual(
    six.map(e => e.lvl),
    six.map((_, k) => Math.max(1, 12 - k))
  );
  for (const e of six) assert.equal(step(e.sp), 0, `${e.sp} is a first stage at ${e.lvl}`);
  const dex = Object.keys(SPECIES)
    .filter(id => step(id) === 0)
    .slice(0, 4);
  for (const e of team('DEX', [], 4, 10, dex).slice(1)) assert.ok(dex.includes(e.sp), `${e.sp} from the dex`);
  assert.equal(rivalPast([{ rival: { met: 2, won: 1 } }, { rival: null }, { rival: { met: 1, won: 0 } }]), 3);
});

test("a run's foes: Blake on each rival node, his team bigger at the second meeting, a reward, never blocking", () => {
  const { runFoes } = modules['run-loop'],
    { newRun } = modules['run-state'],
    leaders = Object.values(GAME_DATA.trainers).filter(T => T.miniboss);
  let seen = 0;
  for (const seed of SEEDS.slice(0, 80)) {
    const p = runStartPlan(seed, DATA, { expedition: 3 }),
      run = newRun(seed, 3, 1, {});
    Object.assign(run, { map: p.map, region: p.region, rival: { lead: 'musk0', past: 1, met: 0, won: 0 } });
    const blakes = Object.values(runFoes(run, { leaders, rules: R }))
      .filter(F => F.runFoe === 'rival')
      .sort((a, b) => a.runNode - b.runNode);
    assert.equal(blakes.length, p.map.nodes.filter(n => n.type === 'rival').length, seed);
    blakes.forEach((F, k) => {
      assert.equal(F.from, 'blake');
      assert.equal(F.who, 'chad');
      assert.equal(F.reward, R.rival.reward);
      assert.equal(F.blocks, false);
      assert.equal(F.team.length, rivalSize(R.rival, 1 + k), `${seed}: meeting ${k + 1}`);
      assert.equal(F.script.at(-1), `battle ${F.id}`);
    });
    seen += blakes.length;
  }
  assert.ok(seen > 80);
});
