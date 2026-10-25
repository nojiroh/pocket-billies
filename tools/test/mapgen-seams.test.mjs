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

test("the neighbour's natural ground runs on across the edge; nothing stands against its things", () => {
  const T = GAME_DATA.scenery.terrains,
    natural = ch => G.mapgenCopyable({ terr: T }, ch);
  for (const { P, exit, K, where } of joinedPairs(6, 16, { terraces: false })) {
    const strip = K.gen.params.edges[0],
      B = GAME_DATA.biomes[K.biome].ground,
      kept = ch =>
        !natural(ch) || ch === B.bank || ch === B.verge || ch === 'S'; /* banks, verges, a coast's wet sand */
    let same = 0;
    for (let n = 0; n < strip.ground.length; n++) {
      const nb = strip.ground[n],
        mine = K.tiles[K.h - 1][strip.c0 + n];
      if (!natural(nb)) continue;
      assert.ok(mine === nb || kept(mine), `${where}: cell ${strip.c0 + n} is ${mine}, the neighbour's ${nb}`);
      if (mine === nb) same++;
    }
    assert.ok(same > 0, where);
    for (const [k, x, z] of strip.props)
      for (const p of K.props)
        if (p.k !== 'signpost')
          assert.ok(Math.hypot(p.x - x, p.z - z) > 0.5, `${where}: ${p.k} against the neighbour's ${k}`);
    void P;
    void exit;
  }
});

test('terraces come down to ground level by every exit, so any exit can be joined with no wall', () => {
  for (let i = 0; i < 12; i++) {
    const exits = [
        [
          { side: 'S', t: 0.5 },
          { side: 'N', t: 0.25 },
          { side: 'N', t: 0.75 },
        ],
        [
          { side: 'W', t: 0.3 },
          { side: 'E', t: 0.7 },
        ],
      ][i % 2],
      sc = G.mapgenScene(
        {
          seed: 300 + i,
          biome: 'ridge',
          land: { terraces: 0.3 + (i % 4) * 0.23, cliffs: (i % 3) / 2 },
          road: { exits },
        },
        ctx
      ).scene;
    assert.ok(sc.steps, `seed ${300 + i} has terraces`);
    const W = G.mapgenWalkGrid(sc, C);
    for (const e of sc.edgeExits) {
      const v = e.side === 'E' || e.side === 'W',
        at = e.t * (v ? sc.h : sc.w);
      for (let u = Math.max(0.25, at - 30); u < Math.min(v ? sc.h : sc.w, at + 30); u += 0.5) {
        const [x, z] = v ? [e.side === 'E' ? sc.w - 0.25 : 0.25, u] : [u, e.side === 'N' ? sc.h - 0.25 : 0.25];
        assert.equal(W.S[Math.floor(z * 2) * W.gw + Math.floor(x * 2)], 0, `seed ${300 + i} exit ${e.id} at ${u}`);
      }
    }
    assert.deepEqual(G.mapgenUnreachable(sc, C), [], `seed ${300 + i}`);
  }
});

test('joined pairs with terraces on either side meet with no raise and walk straight across', () => {
  for (const { P, exit, K, kExit, where } of joinedPairs(7, 24, { terraces: true })) {
    const a = G.mapgenSeamAgreement(P, exit, K, kExit, C);
    assert.deepEqual([a.dhBand, a.raiseExit, a.raiseBand, a.walk], [0, 0, 0, null], where);
    assert.deepEqual(G.mapgenUnreachable(K, C), [], where);
  }
});

test('a pair laid as one scene (the Studio preview): the game format, and from the draft you walk across to the neighbour', () => {
  for (const { P, exit, K, kExit, where } of joinedPairs(8, 8, { terraces: true })) {
    const sc = G.mapgenPairScene(P, exit, K, kExit);
    assert.equal(sc.tiles.length, sc.h, where);
    for (const row of sc.tiles) assert.equal(row.length, sc.w, where);
    assert.equal(sc.heights.length, sc.h + 1, where);
    for (const row of sc.heights) assert.equal(row.length, sc.w + 1, where);
    if (sc.steps) assert.equal(Buffer.from(sc.steps, 'base64').length, sc.w * sc.h * 8, where);
    assert.equal(sc.props.length, P.props.length + K.props.length, where);
    assert.equal(sc.exits.length, P.edgeExits.length + K.edgeExits.length - 2, where);
    assert.equal(sc.exits.length, sc.exitNames.length, where);
    assert.equal(sc.inside.length, 2, where);
    /* from the draft's hub to every other exit, the neighbour's across the seam included */
    const reach = G.mapgenReach(sc, C);
    for (const [k, p] of sc.exits.entries()) assert.ok(G.mapgenReached(reach, ...p), `${where}: ${sc.exitNames[k]}`);
    /* the neighbour's hub too */
    const [ox, oz] = sc.pair.of[0];
    assert.ok(G.mapgenReached(reach, P.hub[0] + ox, P.hub[1] + oz), `${where}: the neighbour's hub`);
  }
  assert.equal(
    G.mapgenPairScene(G.mapgenScene({ seed: 1 }, ctx).scene, 'nowhere', G.mapgenScene({ seed: 2 }, ctx).scene, 'west'),
    null
  );
});

test('WA-3a: a river that leaves by a joined edge goes on in the neighbour, cell for cell and at the same height', () => {
  /* run-like routes (112 x 64, pinned east and west, an exit on each); a parent whose river leaves by its west side
     and the child made from that edge's strip, with and without a river of its own */
  const route = (seed, edges, water) => ({
    seed,
    w: 112,
    h: 64,
    pin: 'EW',
    biome: 'meadow',
    edges,
    land: { water, waterAmount: 0.5, hills: 0.4 },
    road: {
      exits: [
        { side: 'E', t: 0.5 },
        { side: 'W', t: 0.5 },
      ],
    },
  });
  let pairs = 0;
  for (let seed = 1; seed <= 40 && pairs < 6; seed++) {
    const A = G.mapgenScene(route(seed, undefined, 'stream'), ctx).scene,
      st = (A.streams || []).find(s => s.src);
    if (!st || st.pts[st.pts.length - 1][0] > 0) continue;
    const west = A.edgeExits.find(e => e.side === 'W'),
      strip = G.mapgenEdgeStrip(A, west.id, { w: 112, h: 64 }, 0.5);
    for (const water of pairs % 2 ? ['none'] : ['stream']) {
      const { scene: B, notes } = G.mapgenScene(route(seed + 5000, [strip], water), ctx),
        where = `seed ${seed} (child ${water})`,
        east = B.edgeExits.find(e => e.side === 'E');
      assert.deepEqual(notes, [], where);
      const sb = (B.streams || []).find(s => s.src);
      assert.ok(sb && sb.src === 'edge' && sb.pts[0][0] === 112, `${where}: the child's river comes in at the seam`);
      /* the edge cells on both sides of the seam: wet over the same stretch */
      const wet = (sc, col) => sc.tiles.map(r => ('wd'.includes(r[col]) ? 1 : 0)).join('');
      assert.equal(wet(B, 111), wet(A, 0), `${where}: the same water across the seam`);
      for (let j = 0; j <= 64; j++)
        assert.ok(Math.abs(A.heights[j][0] - B.heights[j][112]) < 0.05, `${where}: the heights at row ${j}`);
      const a = G.mapgenSeamAgreement(A, west.id, B, east.id, C);
      assert.deepEqual([a.dhNear, a.dhBand, a.raiseExit, a.walk], [0, 0, 0, null], where);
      assert.deepEqual(G.mapgenUnreachable(B, C), [], where);
      pairs++;
    }
  }
  assert.ok(pairs >= 4, `${pairs} pairs whose river crosses the seam`);
});
