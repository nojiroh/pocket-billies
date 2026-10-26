// RL-R1/RL-R2: each place of a run is its zone's biome, except a side area's, which are its field move's (Cut's
// thicket, Surf's lake, Rock Smash's cave: fieldMoves.json `biome`, roguelite track RL-R2a/RL-R2b) in the zone of
// their row. The in-game full test's run phase checks the same rule (self-test.js "A run: the train"); it once asked
// every place for its zone's biome and failed on any run with a side area, as on its own seed SELFTESTRUN8.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'];
const RAW = readGameData(),
  MOVES = GAME_DATA.fieldMoves.moves,
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: GAME_DATA.rules.run,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: runRegionData(RAW, RAW.trainers),
    fieldMoves: MOVES,
  },
  /* the debug menu's short map (self-test.js runTakeOff) and the full one */
  SHORT = { rows: 5, minibosses: 1 },
  SEEDS = Array.from({ length: 150 }, (_, k) => `Z${k.toString(36).toUpperCase()}BIOME`);

/** the biome a run's place should be: its side area's move's, else its zone's */
const want = (plan, n) => (n.side ? MOVES[plan.map.side.move].biome : plan.region.zones[n.zone].biome);

test("the self-test's seed: a Cut detour on row 4 is thicket in a meadow zone", () => {
  const plan = runStartPlan('SELFTESTRUN8', DATA, { map: SHORT }),
    S = plan.map.side,
    off = plan.map.nodes.filter(n => plan.region.zones[n.zone].biome !== n.biome);
  assert.equal(S.move, 'cut');
  assert.ok(off.length > 0, 'a side place off its zone, as the old rule saw');
  for (const n of off) {
    assert.equal(n.side, 1, 'only side places are off their zone');
    assert.equal(n.row, 3);
    assert.equal(n.biome, 'thicket');
  }
});

test("every place is its zone's biome, a side area's its move's: short and full maps, many seeds", () => {
  const moves = new Set();
  for (const map of [SHORT, undefined])
    for (const seed of SEEDS) {
      const plan = runStartPlan(seed, DATA, map ? { map } : {});
      if (plan.map.side) moves.add(plan.map.side.move);
      for (const n of plan.map.nodes) {
        assert.ok(plan.region.zones[n.zone], `${seed}: row ${n.row} has a zone`);
        assert.equal(n.biome, want(plan, n), `${seed}: row ${n.row}${n.side ? ' (side)' : ''}`);
      }
    }
  assert.deepEqual([...moves].sort(), Object.keys(MOVES).sort(), 'every move rolls a side area');
});
