// Region map track WM-7: the leaders' arenas (game/js/logic/arena-gen.js, game/data/arenas.json) on the game's own
// scenery, biomes and set pieces. Over a sweep of plans, biomes, road shapes and themes: the same dials give the same
// scene; the generator notes nothing and every exit is reached; the walkable share stays 55-65%; the ring is level at
// its top, raised over its apron, of its theme's ground, fenced in its theme's fence; no spot stands on it; the leader's
// and the challenger's spots are on it and reached from the way back. A leader's: with its gate shut the way on is not
// reached from the way back (the barrier shuts the whole scene), with it open it is. The boss's: no gate, no barrier.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  A = modules['arena-gen'];
const C = GAME_DATA.scenery,
  D = GAME_DATA.arenas,
  ctx = { scenery: C, biomes: GAME_DATA.biomes, setPieces: GAME_DATA.setPieces };
const PLANS = Object.keys(G.MAPGEN_LAYOUTS).filter(k => k !== 'none'),
  BIOMES = ['meadow', 'lake', 'thicket', 'ridge', 'autumn', 'canyon', 'tundra', 'badlands'],
  THEMES = Object.keys(D.themes);
/** a sweep's dials: a leader's ring, every fourth the boss's @param {number} k */
const params = k => {
  const mode = k % 4 === 3 ? 'boss' : 'leader';
  return {
    seed: 900 + k,
    biome: BIOMES[k % BIOMES.length],
    layout: PLANS[k % PLANS.length],
    pin: 'EW',
    ahead: 'E',
    pieces: 3,
    arena: { mode, ...D.sizes[mode], ...D.themes[THEMES[k % THEMES.length]] },
    road: {
      exits: [
        { side: 'W', t: 0.5 },
        { side: 'E', t: 0.5 },
      ],
      shape: ['winding', 'scurve', 'straight'][k % 3],
    },
  };
};
const SWEEP = 12;
const made = Array.from({ length: SWEEP }, (_, k) => ({ k, P: params(k), ...G.mapgenScene(params(k), ctx) }));
const exitAt = (/** @type {any} */ sc, /** @type {string} */ id) =>
  G.mapgenExitPoint(
    sc.w,
    sc.h,
    sc.edgeExits.find((/** @type {any} */ e) => e.id === id)
  );
/** the scene with its gates shut (as a run puts them: logic/run-scenes.js) @param {any} sc */
const shut = sc => {
  const out = { ...sc, props: sc.props.slice() };
  A.arenaGenGates(out, C, 'beat:run_0_foe');
  return out;
};

test('arena: the same dials give the same scene, and a scene without the dial has no arena', () => {
  assert.deepEqual(G.mapgenScene(params(1), ctx).scene, made[1].scene);
  const { arena: _, ...plain } = params(1);
  assert.equal(G.mapgenScene(plain, ctx).scene.arena, undefined);
  assert.equal(G.mapgenParams(plain).arena, undefined);
});

test('arena: the dial is filled in and kept in range', () => {
  assert.equal(A.arenaGenParams(null), undefined);
  assert.equal(A.arenaGenParams('ring'), undefined);
  const P = A.arenaGenParams({ r: 99, rise: 0, dress: ['lantern', 3] });
  assert.equal(P.mode, 'leader');
  assert.equal(P.r, 14);
  assert.equal(P.rise, 0.4);
  assert.equal(P.back, A.ARENA_SIZES.leader.back);
  assert.deepEqual(P.dress, ['lantern']);
  assert.equal(P.fence, A.ARENA_PLAIN.fence);
  assert.equal(A.arenaGenParams({ mode: 'boss' }).back, undefined);
});

test('arena: every place of the sweep is made whole, its walkable share in range', () => {
  for (const { k, scene: sc, notes } of made) {
    assert.deepEqual(notes, [], `${k}: notes`);
    assert.ok(sc.arena, `${k}: an arena`);
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], `${k}: every exit reached`);
    assert.ok(
      sc.layout.walk >= G.MAPGEN_WALKABLE[0] && sc.layout.walk <= G.MAPGEN_WALKABLE[1],
      `${k}: walkable ${sc.layout.walk}`
    );
  }
});

test('arena: the ring is level at its top, raised over its apron, of its ground and fenced', () => {
  for (const { k, P, scene: sc } of made) {
    const R = sc.arena,
      S = G.mapgenDecodeBase64(sc.steps),
      raise = new Int16Array(S.buffer, S.byteOffset, S.length / 2),
      at = (/** @type {number} */ x, /** @type {number} */ z) =>
        raise[Math.floor(z * 2) * sc.w * 2 + Math.floor(x * 2)] / 20;
    for (let a = 0; a < 8; a++) {
      const t = (a * Math.PI) / 4,
        c = Math.cos(t),
        s = Math.sin(t);
      for (const d of [0, R.r * 0.5, R.r - 0.6])
        assert.equal(at(R.x + c * d, R.z + s * d), R.top, `${k}: level at ${a}/${d}`);
    }
    /* off a road, the apron sits a rise below the top: the ring is entered by its ramps */
    let walls = 0;
    for (let a = 0; a < 16; a++) {
      const t = (a * Math.PI) / 8,
        /* at octagon distance r + 0.8 (the apron's middle) */
        f = (R.r + 0.8) / A.arenaOct(Math.cos(t), Math.sin(t)),
        x = R.x + Math.cos(t) * f,
        z = R.z + Math.sin(t) * f;
      if (R.top - at(x, z) > 0.34) walls++;
    }
    assert.ok(walls >= 8, `${k}: a wall round most of the rim (${walls} of 16)`);
    const tile = (/** @type {number} */ x, /** @type {number} */ z) =>
      sc.tiles[sc.h - 1 - Math.floor(z)][Math.floor(x)];
    assert.equal(tile(R.x + 2.3, R.z + 2.3), P.arena.ground, `${k}: its ground`);
    const fence = sc.props.filter(
      (/** @type {any} */ p) => p.k === P.arena.fence && A.arenaOct(p.x - R.x, p.z - R.z) <= R.r
    );
    assert.ok(fence.length >= 8, `${k}: fenced (${fence.length})`);
    for (const s of sc.spots || [])
      assert.ok(A.arenaOct(s.x - R.x, s.z - R.z) > R.r, `${k}: no ${s.kind} spot on the ring`);
  }
});

test("arena: a leader's gate shuts the way on, the boss's ring has none", () => {
  for (const { k, P, scene: sc } of made) {
    const R = sc.arena,
      from = exitAt(sc, 'west'),
      open = G.mapgenReach(sc, C, from, { slope: true });
    for (const p of [R.leader, R.from]) {
      assert.ok(A.arenaOct(p[0] - R.x, p[1] - R.z) < R.r - 1, `${k}: ${p} on the ring`);
      assert.ok(G.mapgenReached(open, ...p), `${k}: ${p} reached`);
    }
    if (P.arena.mode === 'boss') {
      assert.deepEqual(R.gates, [], `${k}: the boss's ring has no gate`);
      continue;
    }
    assert.ok(R.gates.length >= 1, `${k}: a gate`);
    assert.ok(G.mapgenReached(open, ...exitAt(sc, 'east')), `${k}: the way on, gate open`);
    const gated = G.mapgenReach(shut(sc), C, from, { slope: true });
    assert.ok(!G.mapgenReached(gated, ...exitAt(sc, 'east')), `${k}: no way on with the gate shut`);
    assert.ok(G.mapgenReached(gated, ...R.leader), `${k}: the leader reached with the gate shut`);
    const gates = shut(sc).props.filter((/** @type {any} */ p) => p.act === 'arenagate');
    assert.ok(
      gates.length >= 1 && gates.every((/** @type {any} */ p) => p.k === P.arena.gate && p.unless === 'beat:run_0_foe')
    );
  }
});
