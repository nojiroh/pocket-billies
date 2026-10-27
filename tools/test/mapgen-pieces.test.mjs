// Routes track RT-3: set pieces (game/js/logic/mapgen.js mapgenStagePieces, game/data/setPieces.json) on the game's own
// scenery, biomes and pieces. Over a sweep of plans, biomes and seeds: the same dials give the same pieces; a place
// gets no more than it asked for and each piece all of its props, where its origin, turn and mirror put them; no piece
// prop on the road, near a kept spot or in its sight; the walkable share stays 55-65%, every exit and spot is reached
// and nothing traps you; enough spots are left for the route trainers; the fishing jetty stands only on a jetty. A
// piece that can't fit anywhere leaves the scene as it was.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  { turnedPoint, normalTurn } = modules['prop-turn'];
const D = GAME_DATA.setPieces,
  C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes, setPieces: D };
const PLANS = Object.keys(G.MAPGEN_LAYOUTS).filter(k => k !== 'none'),
  BIOMES = ['meadow', 'lake', 'thicket', 'ridge', 'autumn', 'canyon', 'tundra', 'badlands'];
const params = (/** @type {number} */ k, /** @type {number} */ pieces) => ({
  seed: 500 + k,
  biome: BIOMES[k % BIOMES.length],
  layout: PLANS[k % PLANS.length],
  pin: 'EW',
  pieces,
  road: {
    exits: [
      { side: 'E', t: 0.5 },
      { side: 'W', t: 0.5 },
    ],
    shape: ['winding', 'scurve', 'straight'][k % 3],
  },
});
const SWEEP = 15;
const scenes = Array.from({ length: SWEEP }, (_, k) => ({ k, P: params(k, 2 + (k % 3)) })).map(o => ({
  ...o,
  sc: G.mapgenScene(o.P, ctx).scene,
}));

/** where piece L's props should stand: [{ k, x, z, rot? }] @param {any} L */
function expected(L) {
  const S = D.pieces[L.id],
    flip = L.f ? -1 : 1;
  return S.props.map(q => {
    const [x, z] = turnedPoint(L, q.x * flip, q.z);
    return { k: q.k, x, z, rot: C.props[q.k].model ? normalTurn(L.rot + (q.rot || 0) * flip) : 0 };
  });
}

test('set pieces: the same dials give the same pieces', () => {
  const P = params(3, 4),
    a = G.mapgenScene(P, ctx).scene,
    b = G.mapgenScene(P, ctx).scene;
  assert.deepEqual(a.pieces, b.pieces);
  assert.deepEqual(a.props, b.props);
});

test('set pieces: as many as asked at most, each whole, turned and mirrored as it says', () => {
  let n = 0;
  for (const { k, P, sc } of scenes) {
    const L = sc.pieces || [];
    assert.ok(L.length <= P.pieces, `scene ${k}: ${L.length} pieces, asked for ${P.pieces}`);
    assert.equal(new Set(L.map(p => p.id)).size, L.length, `scene ${k}: a piece twice`);
    for (const p of L) {
      assert.ok(D.pieces[p.id].on.includes(p.spot), `scene ${k}: ${p.id} on a ${p.spot}`);
      for (const q of expected(p)) {
        const hit = sc.props.find(o => o.k === q.k && Math.abs(o.x - q.x) < 0.02 && Math.abs(o.z - q.z) < 0.02);
        assert.ok(hit, `scene ${k}: ${p.id} has no ${q.k} at ${q.x.toFixed(2)}, ${q.z.toFixed(2)}`);
        assert.equal(hit.rot || 0, q.rot, `scene ${k}: ${p.id}'s ${q.k} turned ${hit.rot || 0}, not ${q.rot}`);
      }
      n++;
    }
  }
  /* most places get what they ask for (2-4) */
  const asked = scenes.reduce((a, o) => a + o.P.pieces, 0);
  assert.ok(n >= asked * 0.8, `${n} pieces placed of ${asked} asked`);
});

test('set pieces: off the road, clear of every kept spot and its sight; walkable 55-65%, every exit and spot reached', () => {
  const road = new Set(Object.values(G.MAPGEN_SURFACES));
  for (const { k, sc } of scenes) {
    const props = (sc.pieces || []).flatMap(expected),
      R = G.mapgenReach(sc, C, sc.hub, { slope: true });
    for (const q of props) {
      const ch = sc.tiles[sc.h - 1 - Math.floor(q.z)][Math.floor(q.x)];
      assert.ok(!road.has(ch), `scene ${k}: ${q.k} on the road (${ch})`);
      for (const o of sc.spots || []) {
        const at = o.stand || [o.x, o.z];
        assert.ok(Math.hypot(q.x - at[0], q.z - at[1]) >= 1.4, `scene ${k}: ${q.k} on the ${o.kind} spot`);
      }
    }
    for (const o of sc.spots || []) {
      assert.ok(G.mapgenReached(R, o.x, o.z), `scene ${k}: the ${o.kind} spot at ${o.x}, ${o.z} is cut off`);
      if (o.stand) assert.ok(G.mapgenReached(R, o.stand[0], o.stand[1]), `scene ${k}: a pinch's stand is cut off`);
    }
    assert.deepEqual(G.mapgenUnreachable(sc, C, { slope: true }), [], `scene ${k}: an exit is cut off`);
    assert.equal(G.mapgenTraps(sc, C).n, 0, `scene ${k}: something traps you`);
    assert.ok(
      sc.layout.walk >= G.MAPGEN_WALKABLE[0] && sc.layout.walk <= G.MAPGEN_WALKABLE[1],
      `scene ${k}: ${sc.layout.walk} walkable`
    );
    assert.ok(Math.abs(G.mapgenWalkShare(R) - sc.layout.walk) < 0.001, `scene ${k}: the share is not the pieces' walk`);
  }
});

test('set pieces: they leave spots for the route trainers; a fishing jetty stands only on a jetty', () => {
  for (const { k, sc } of scenes) {
    if (!(sc.pieces || []).length) continue;
    const count = (/** @type {any[]} */ L) => (sc.spots || []).filter(o => L.includes(o.kind)).length,
      road = G.MAPGEN_PIECE_LEAVE.road,
      aside = G.MAPGEN_PIECE_LEAVE.aside,
      tookRoad = sc.pieces.some(p => road.includes(p.spot)),
      tookAside = sc.pieces.some(p => aside.includes(p.spot));
    if (tookRoad) assert.ok(count(road) >= road[road.length - 1], `scene ${k}: ${count(road)} spots by the road left`);
    if (tookAside) assert.ok(count(aside) >= aside[aside.length - 1], `scene ${k}: ${count(aside)} spots aside left`);
    for (const p of sc.pieces) assert.equal(p.id === 'fishing_jetty', p.spot === 'jetty', `scene ${k}: ${p.id}`);
  }
  /* a lakeside place with pieces has a jetty, and the fishing jetty stands on some of them */
  let jetties = 0,
    fishing = 0;
  for (let k = 0; k < 8; k++) {
    const sc = G.mapgenScene({ ...params(k, 3), layout: 'lakeside', biome: 'lake' }, ctx).scene;
    if (sc.pieces && sc.pieces.some(p => p.id === 'fishing_jetty')) fishing++;
    if ((sc.spots || []).some(o => o.kind === 'jetty') || (sc.pieces || []).some(p => p.spot === 'jetty')) jetties++;
  }
  assert.ok(jetties >= 6, `${jetties} of 8 lakeside places have a jetty`);
  assert.ok(fishing >= 1, `a fishing jetty on ${fishing} of 8 lakeside places`);
});

test('set pieces: a piece that fits nowhere leaves the scene as it was', () => {
  const none = structuredClone(D);
  /* every piece wants a boat on dry land (and none a jetty, which would be built for it before the layout) */
  for (const S of Object.values(none.pieces)) {
    S.props = [{ k: 'rowboat', x: 0, z: 1, water: true }, ...S.props.filter(q => !q.water)];
    S.on = ['roadside', 'clearing'];
  }
  for (const k of [0, 1, 2]) {
    const P = params(k, 3),
      a = G.mapgenScene(P, { ...ctx, setPieces: none }).scene,
      b = G.mapgenScene({ ...P, pieces: 0 }, ctx).scene;
    assert.equal(a.pieces, undefined);
    assert.deepEqual(a.props, b.props, `scene ${k}: a piece left something behind`);
    assert.deepEqual(a.spots, b.spots);
  }
});

test('RT-4b: a piece’s animals live in its area turned as it lies; farmland has crows; MAPGEN_LIFE_EXTRA at most', () => {
  let pens = 0,
    crows = 0;
  for (const { P, sc } of scenes) {
    const extra = (sc.life || []).filter((/** @type {any} */ l) => l.extra),
      where = `${P.biome}/${P.layout} ${P.seed}`;
    assert.ok(
      extra.reduce((/** @type {number} */ a, /** @type {any} */ l) => a + l.n, 0) <= G.MAPGEN_LIFE_EXTRA,
      `${where}: too many animals added`
    );
    if (P.layout === 'farmland' && extra.some((/** @type {any} */ l) => l.k === 'crow' && !l.area)) crows++;
    for (const L of sc.pieces || []) {
      const S = D.pieces[L.id];
      for (const l of S.life || []) {
        const got = extra.find((/** @type {any} */ e) => e.k === l.k && e.area);
        if (!got) continue;
        const flip = L.f ? -1 : 1,
          [cx, cz] = turnedPoint(L, ((l.area[0] + l.area[2]) / 2) * flip, (l.area[1] + l.area[3]) / 2),
          [a0, b0, a1, b1] = got.area;
        assert.ok(cx >= a0 - 0.01 && cx <= a1 + 0.01 && cz >= b0 - 0.01 && cz <= b1 + 0.01, `${where} ${L.id}`);
        assert.ok(Math.hypot(cx - L.x, cz - L.z) <= S.r, `${where} ${L.id}: its animals' area off the piece`);
        if (L.id === 'farm_pen') pens++;
      }
    }
  }
  assert.ok(crows >= 1, 'a farmland place has its crows');
  console.log(`RT-4b: ${pens} farm pen animal areas, ${crows} farmland places with crows`);
});
