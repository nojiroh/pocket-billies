// Map generator MG-2: scenes that meet. mapgenSeamAgreement measures how two scenes meet where they join (heights
// along the shared edge, the step raise across it, a straight walk across), and a scene generated against its
// neighbour's edge agrees with it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
const C = GAME_DATA.scenery;

/* two flat meadows 40 × 30 meeting east to west, half way along */
function flatPair() {
  const flat = (side, id) => {
    const sc = {
      w: 40,
      h: 30,
      edge: 'g',
      tiles: Array.from({ length: 30 }, () => 'g'.repeat(40)),
      heights: Array.from({ length: 31 }, () => new Array(41).fill(0)),
      props: [],
      edgeExits: [{ id, side, t: 0.5, width: 2 }],
    };
    sc.exits = sc.edgeExits.map(e => G.mapgenExitPoint(sc.w, sc.h, e));
    return sc;
  };
  return [flat('E', 'east'), flat('W', 'west')];
}
const steps = (sc, fn) => {
  const S = new Int16Array(sc.w * sc.h * 4);
  for (let j = 0; j < sc.h * 2; j++) for (let i = 0; i < sc.w * 2; i++) S[j * sc.w * 2 + i] = fn(i / 2, j / 2) * 20;
  sc.steps = G.mapgenEncodeBase64(new Uint8Array(S.buffer));
};

test('two flat scenes meet: no gap, the same raise, a straight walk across', () => {
  const [A, B] = flatPair();
  assert.deepEqual(G.mapgenSeamAgreement(A, 'east', B, 'west', C), {
    off: [40, 0],
    dhNear: 0,
    dhBand: 0,
    raiseExit: 0,
    raiseBand: 0,
    walk: null,
  });
});

test('the measure sees each fault: a height gap, a raise, water or a step on the way across', () => {
  let [A, B] = flatPair();
  B.heights[30 - 17][0] = 0.2; /* B's west edge (x 0), 2 m from the exit (z 15) */
  let r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.equal(r.dhNear, 0.2);
  [A, B] = flatPair();
  B.heights[30 - 5][0] = 0.4; /* 10 m from the exit: in the band, not near it */
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.deepEqual([r.dhNear, r.dhBand], [0, 0.4]);
  [A, B] = flatPair();
  steps(B, x => (x < 6 ? 0.5 : 0));
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.equal(r.raiseExit, 0.5);
  assert.match(r.walk, /^a step of 0\.50 m/);
  [A, B] = flatPair();
  B.tiles = B.tiles.map(row => 'ww' + row.slice(2));
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.match(r.walk, /^blocked .* in the second scene/);
});

test('two routes generated on their own do not meet (so the measure can tell)', () => {
  const mk = (seed, exits) => G.mapgenScene({ seed, w: 112, h: 64, land: { hills: 0.5 }, road: { exits } }, ctx).scene;
  const P = mk(3, [
      { side: 'S', t: 0.5 },
      { side: 'N', t: 0.25 },
    ]),
    K = mk(9, [
      { side: 'S', t: 0.75 },
      { side: 'N', t: 0.5 },
    ]);
  const r = G.mapgenSeamAgreement(P, 'north', K, 'south', C);
  assert.deepEqual(r.off, [-56, 64]);
  assert.ok(r.dhBand > 0.05, `the band differs by ${r.dhBand} m`);
});

/* a parent route south to north with two exits north (a run's layout: t 0.25 and 0.75 on a 112 m side) */
const parentParams = (seed, extra = {}) => ({
  seed,
  w: 112,
  h: 64,
  land: { hills: 0.5 },
  road: {
    exits: [
      { side: 'S', t: 0.5 },
      { side: 'N', t: 0.25 },
      { side: 'N', t: 0.75 },
    ],
  },
  ...extra,
});
const childParams = (seed, edges, extra = {}) => ({
  seed,
  w: 112,
  h: 64,
  land: { hills: 0.5 },
  road: {
    exits: [
      { side: 'S', t: 0.75 },
      { side: 'N', t: 0.5 },
    ],
  },
  edges,
  ...extra,
});
const R = modules['seam-rules'];

test("a neighbour's strip: the opposite side, as wide, a whole number of metres along; the exit moves onto it", () => {
  const P = G.mapgenScene(parentParams(3), ctx).scene,
    strip = G.mapgenEdgeStrip(P, 'north', { w: 112, h: 64 }, 0.75);
  assert.equal(strip.side, 'S');
  assert.equal(strip.width, 2);
  assert.equal(strip.at, 84);
  assert.equal(strip.heights.length, Math.floor(strip.hi) - strip.u0 + 1);
  assert.equal(strip.ground.length, Math.ceil(strip.hi) - strip.c0);
  const K = G.mapgenScene(childParams(9, [strip]), ctx).scene,
    eK = K.edgeExits.find(e => e.side === 'S'),
    eP = P.edgeExits.find(e => e.id === 'north');
  assert.deepEqual(R.seamRulesPair(P, eP, K, eK), []);
  assert.deepEqual(R.seamRulesSides(K), []);
  /* asked for too near a corner: kept inside 0.08..0.92, still a whole number of metres from the neighbour's */
  const edge = G.mapgenEdgeStrip(P, 'north', { w: 112, h: 64 }, 0.99);
  assert.ok(edge.t <= 0.92 && Number.isInteger(28 - edge.at), `t ${edge.t}, at ${edge.at}`);
});

test("joined dials are copied, so the caller's are not changed; no room for a fifth exit is a note", () => {
  const P = G.mapgenScene(parentParams(3), ctx).scene,
    strip = G.mapgenEdgeStrip(P, 'north', { w: 112, h: 64 }, 0.75),
    p = childParams(9, [strip]),
    copy = structuredClone(p),
    Q = G.mapgenParams(p);
  assert.deepEqual(p, copy);
  assert.notEqual(Q.edges[0], strip);
  const full = childParams(9, [strip]);
  full.road.exits = ['W', 'E', 'N', 'N'].map((side, i) => ({ side, t: i === 3 ? 0.8 : 0.2 }));
  const r = G.mapgenScene(full, ctx);
  assert.deepEqual(r.notes, ['no room for the exit joined on the south side (four exits at most)']);
  assert.equal(G.mapgenParams({}).edges, undefined, 'no edges key unless joined');
});

/* a sweep of joined pairs: random dials for both, the child joined to one of the parent's north exits */
function joinedPairs(seed, n, { terraces }) {
  const Rn = modules.rng.rngFrom(seed, 'pairs'),
    pick = o => Object.keys(o)[Rn.int(0, Object.keys(o).length - 1)],
    feats = Object.keys(G.MAPGEN_FEATURES).filter(f => terraces || f !== 'terraces');
  const dials = exits => ({
    biome: pick(GAME_DATA.biomes),
    seed: Rn.int(0, 1e6),
    w: 112,
    h: 64,
    land: {
      hills: Rn.next(),
      water: pick(G.MAPGEN_WATER),
      waterAmount: Rn.next(),
      terraces: terraces && Rn.chance(0.6) ? Rn.next() : 0,
      cliffs: Rn.next(),
    },
    road: { exits, shape: pick(G.MAPGEN_SHAPES), wobble: Rn.next(), surface: pick(G.MAPGEN_SURFACES) },
    feature: feats[Rn.int(0, feats.length - 1)],
    nature: { trees: Rn.next(), growth: Rn.next(), tall: Rn.next() },
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const pd = dials([
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.25 },
        { side: 'N', t: 0.75 },
      ]),
      P = G.mapgenScene(pd, ctx).scene,
      exit = Rn.chance(0.5) ? 'north' : 'north2',
      strip = G.mapgenEdgeStrip(P, exit, { w: 112, h: 64 }, [0.25, 0.5, 0.75][Rn.int(0, 2)]),
      cd = {
        ...dials([
          { side: 'S', t: 0.5 },
          { side: 'N', t: 0.5 },
        ]),
        edges: [strip],
      },
      K = G.mapgenScene(cd, ctx).scene;
    out.push({
      P,
      exit,
      K,
      kExit: K.edgeExits.find(e => e.side === 'S').id,
      where: JSON.stringify({ pd, cd: { ...cd, edges: 1 } }),
    });
  }
  return out;
}

test('a child joined to its parent meets it: the same heights along the band, a straight walk across', () => {
  for (const { P, exit, K, kExit, where } of joinedPairs(5, 24, { terraces: false })) {
    const a = G.mapgenSeamAgreement(P, exit, K, kExit, C);
    assert.equal(a.dhNear, 0, where);
    assert.equal(a.dhBand, 0, where);
    assert.equal(a.walk, null, where);
    assert.deepEqual(G.mapgenUnreachable(K, C), [], where);
    assert.deepEqual(
      R.seamRulesPair(
        P,
        P.edgeExits.find(e => e.id === exit),
        K,
        K.edgeExits.find(e => e.id === kExit)
      ),
      [],
      where
    );
  }
});

test('a node with two parents on one side meets each of them up to the midpoint', () => {
  const P1 = G.mapgenScene(parentParams(21), ctx).scene,
    P2 = G.mapgenScene(parentParams(22, { land: { hills: 1 } }), ctx).scene,
    s1 = G.mapgenEdgeStrip(P1, 'north', { w: 112, h: 64 }, 0.25),
    s2 = G.mapgenEdgeStrip(P2, 'north2', { w: 112, h: 64 }, 0.75),
    K = G.mapgenScene(
      {
        ...childParams(23, [s1, s2]),
        road: {
          exits: [
            { side: 'S', t: 0.25 },
            { side: 'S', t: 0.75 },
            { side: 'N', t: 0.5 },
          ],
        },
      },
      ctx
    ).scene;
  assert.deepEqual(R.seamRulesSides(K), []);
  for (const [P, exit, id] of [
    [P1, 'north', 'south'],
    [P2, 'north2', 'south2'],
  ]) {
    const a = G.mapgenSeamAgreement(P, exit, K, id, C);
    assert.deepEqual([a.dhNear, a.dhBand, a.walk], [0, 0, null], exit);
  }
});
