// Water track WA-3a: rivers that run downhill (game/js/logic/water-gen.js). The flood fills every dip and drains to
// its outlets; a generated river is the same for the same dials, its water never higher than the point before, wider
// downstream, on water all the way, and it ends at its mouth (the sea, a lake, a side or a pool).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  WG = modules['water-gen'],
  ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes },
  BIOMES = Object.keys(GAME_DATA.biomes);

/** a scene's corner height at (x, z), bilinear (its rows run far to near) */
function heightAt(sc, x, z) {
  const H = new Float32Array((sc.w + 1) * (sc.h + 1));
  for (let j = 0; j <= sc.h; j++) for (let i = 0; i <= sc.w; i++) H[j * (sc.w + 1) + i] = sc.heights[sc.h - j][i];
  return WG.waterGenHeightAt(H, sc.w, sc.h, x, z);
}
const tileAt = (sc, x, z) => sc.tiles[sc.h - 1 - Math.min(sc.h - 1, Math.floor(z))][Math.min(sc.w - 1, Math.floor(x))];
const riverOf = sc => (sc.streams || []).find(st => st.src);

/* a spread of dials with a river: biomes, hills, pinned sides (a run's), a pond (lake mouths and sources), a coast
   (sea mouths), the bridge feature */
const CASES = Array.from({ length: 24 }, (_, i) => ({
  seed: 500 + i,
  biome: BIOMES[i % BIOMES.length],
  pin: i % 3 === 0 ? 'EW' : '',
  feature: i % 4 === 1 ? 'bridge' : i % 4 === 2 ? 'jetty' : 'none',
  land: {
    water: i % 4 === 1 ? 'coast' : 'stream',
    waterAmount: (i % 5) / 4,
    hills: (i % 6) / 5,
  },
}));
const MADE = CASES.map(c => ({ c, ...G.mapgenScene(c, ctx) }));

test('the flood fills a dip and drains every corner to an outlet, never uphill', () => {
  /* a 6 x 6 bowl with a pit in its middle, drained from its west edge */
  const w = 6,
    h = 6,
    H = new Float32Array(49);
  for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) H[j * 7 + i] = 1 + Math.hypot(i - 3, j - 3) * 0.1;
  H[3 * 7 + 3] = -2;
  const outlets = [0, 7, 14, 21, 28, 35, 42],
    { Hf, recv, order } = WG.waterGenFlood(H, w, h, outlets, null);
  assert.equal(order.length, 49, 'every corner reached');
  assert.ok(Hf[3 * 7 + 3] > 1, 'the pit is filled');
  for (let c = 0; c < 49; c++) {
    let n = 0;
    for (let k = c; recv[k] >= 0; k = recv[k], n++) {
      assert.ok(Hf[recv[k]] < Hf[k], 'each step down the filled land');
      assert.ok(n < 49);
    }
    let k = c;
    while (recv[k] >= 0) k = recv[k];
    assert.ok(outlets.includes(k), `corner ${c} drains to an outlet`);
  }
  const f = WG.waterGenFlowSum(recv, order);
  assert.equal(
    outlets.reduce((a, c) => a + f[c], 0),
    49,
    'the flow sums to every corner at the outlets'
  );
});

test('the same dials make the same river', () => {
  for (const { c, scene } of MADE.slice(0, 6)) {
    const again = G.mapgenScene(c, ctx).scene;
    assert.deepEqual(again.streams, scene.streams, `seed ${c.seed}`);
    assert.deepEqual(again.heights, scene.heights, `seed ${c.seed}`);
  }
});

test('a river runs downhill on water, wider downstream, with the contract fields', () => {
  let rivers = 0,
    rapids = 0;
  for (const { c, scene: sc, notes } of MADE) {
    const where = `seed ${c.seed} ${c.biome} ${c.land.water} ${c.feature}`,
      st = riverOf(sc);
    assert.ok(st, `${where}: a river (${notes.join('; ')})`);
    rivers++;
    assert.ok(['spring', 'edge', 'lake'].includes(st.src), `${where}: src ${st.src}`);
    assert.ok(['sea', 'lake', 'edge', 'pool'].includes(st.mouth), `${where}: mouth ${st.mouth}`);
    assert.equal(st.w.length, st.pts.length, `${where}: a width per point`);
    for (let i = 1; i < st.pts.length; i++) {
      const up = heightAt(sc, ...st.pts[i - 1]),
        down = heightAt(sc, ...st.pts[i]);
      assert.ok(down <= up + 0.02, `${where}: point ${i} at ${st.pts[i]} is ${(down - up).toFixed(3)} m higher`);
      assert.ok(st.w[i] >= st.w[i - 1], `${where}: narrower at point ${i}`);
    }
    /* on water all the way (a jetty's boards may lie across it where it reaches the pond) */
    for (const p of st.pts) assert.ok('wdb'.includes(tileAt(sc, ...p)), `${where}: ${p} on ${tileAt(sc, ...p)}`);
    for (const [a, b] of st.rapids || []) {
      assert.ok(a >= 0 && b <= 1 && a < b, `${where}: rapids ${a}-${b}`);
      rapids++;
    }
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery), [], where);
  }
  assert.equal(rivers, CASES.length);
  assert.ok(rapids > 0, 'some rivers have rapids');
});

test('a river ends at its mouth: the side it leaves by, the sea, a lake, its pool', () => {
  const seen = new Set();
  for (const { c, scene: sc } of MADE) {
    const st = riverOf(sc),
      [x, z] = st.pts[st.pts.length - 1],
      where = `seed ${c.seed} ${st.src}>${st.mouth} at ${x},${z}`;
    seen.add(st.mouth);
    if (st.mouth === 'edge') assert.ok(Math.min(x, z, sc.w - x, sc.h - z) < 0.01, `${where}: on the side`);
    else {
      /* the water goes on past the end: the sea's, the lake's or the pool's */
      let wet = 0;
      for (let dz = -3; dz <= 3; dz++)
        for (let dx = -3; dx <= 3; dx++) if ('wd'.includes(tileAt(sc, x + dx, z + dz))) wet++;
      assert.ok(wet >= 20, `${where}: ${wet} wet cells round the end`);
    }
    if (st.src === 'edge') {
      const [x0, z0] = st.pts[0];
      assert.ok(Math.min(x0, z0, sc.w - x0, sc.h - z0) < 0.01, `${where}: comes in at a side`);
    }
  }
  for (const m of ['edge', 'sea']) assert.ok(seen.has(m), `a ${m} mouth among the cases`);
});

test('no stream dial, no river; a river never runs off a scene through an exit road', () => {
  const sc = G.mapgenScene({ seed: 77, land: { water: 'none' } }, ctx).scene;
  assert.equal(riverOf(sc), undefined);
  for (const { c, scene: s } of MADE) {
    const st = riverOf(s);
    for (const e of s.edgeExits) {
      const [ex, ez] = s.exits[s.edgeExits.indexOf(e)];
      for (const p of st.pts)
        assert.ok(Math.hypot(p[0] - ex, p[1] - ez) > 2.5, `seed ${c.seed}: the river at exit ${e.id}`);
    }
  }
});

/* ---------- WA-2b: waterfalls placed ---------- */
/** a scene's step raise at (x, z) (scene.steps: 5 cm units, a half-metre grid, row 0 at the near edge) */
function raiseAt(sc, x, z) {
  if (!sc.steps) return 0;
  const b = Buffer.from(sc.steps, 'base64'),
    S = new Int16Array(b.buffer, b.byteOffset, b.length / 2),
    i = Math.max(0, Math.min(sc.w * 2 - 1, Math.floor(x * 2))),
    j = Math.max(0, Math.min(sc.h * 2 - 1, Math.floor(z * 2)));
  return S[j * sc.w * 2 + i] / 20;
}
/* rivers across terraces that step down toward them (the seeds of a sweep that made falls), and massifs whose cliffs
   take a set piece (the cave's dials, Rock Smash's side area) */
const FALL_CASES = [917, 931, 933, 941].map(seed => {
  const i = seed - 900;
  return {
    seed,
    biome: BIOMES[i % BIOMES.length],
    pin: i % 2 ? 'EW' : '',
    land: {
      water: 'stream',
      waterAmount: 0.5,
      terraces: [0, 0.4, 0.7, 1][i % 4],
      mountains: i % 3 === 0 ? 1 : 0,
      massif: 'NS',
      cliffs: (i % 5) / 4,
    },
  };
});
const SET_CASES = [301, 305, 342].map(seed => ({
  seed,
  biome: seed % 2 ? 'cave' : 'ridge',
  pin: 'EW',
  land: { water: 'none', mountains: 1, massif: 'NS', cliffs: 0.5, terraces: 0.5, ledges: 1 },
}));
const FALLS_MADE = [...FALL_CASES, ...SET_CASES].map(c => ({ c, ...G.mapgenScene(c, ctx) }));

test('a fall: its lip on its water, its foot on water below it, the contract fields', () => {
  let falls = 0,
    sets = 0,
    pools = 0,
    climbs = 0;
  for (const { c, scene: sc, notes } of FALLS_MADE) {
    const where = `seed ${c.seed} ${c.biome}`;
    assert.ok(sc.falls && sc.falls.length, `${where}: a fall (${notes.join('; ')})`);
    for (const f of sc.falls) {
      const at = `${where} fall at ${f.x},${f.z}`,
        [dx, dz] = f.dir;
      falls++;
      assert.ok(Math.abs(Math.hypot(dx, dz) - 1) < 0.02, `${at}: dir is a unit`);
      assert.ok(
        f.w >= 1.4 && f.h >= WG.WATERGEN_FALL_MIN && f.h <= WG.WATERGEN_SET_PIECE[1],
        `${at}: w ${f.w} h ${f.h}`
      );
      if (f.h >= WG.WATERGEN_SET_PIECE[0]) sets++;
      /* the lip: water just above it and just below it, the water above raised more than below */
      const up = [f.x - dx * 0.3, f.z - dz * 0.3],
        down = [f.x + dx * 0.3, f.z + dz * 0.3];
      assert.ok('wd'.includes(tileAt(sc, ...up)), `${at}: water above the lip`);
      assert.ok('wd'.includes(tileAt(sc, ...down)), `${at}: water below the lip`);
      assert.ok(raiseAt(sc, ...up) - raiseAt(sc, ...down) >= 0.05, `${at}: it drops at the lip`);
      /* on a river: a stream's line passes the lip */
      assert.ok(
        (sc.streams || []).some(st =>
          st.pts.some((p, i) => i && WG.waterGenSegDist(f.x, f.z, st.pts[i - 1], p) < f.w / 2 + 0.5)
        ),
        `${at}: on a stream's line`
      );
      if (f.pool) pools++;
      if (f.climb) climbs++;
    }
  }
  assert.ok(sets > 0, 'a set piece among the cases');
  assert.ok(pools > 0, 'a plunge pool among the cases');
  assert.ok(climbs > 0, 'a climbable fall among the cases');
  assert.ok(falls >= FALLS_MADE.length);
});

test('a plunge pool and a climbable fall are walked to; the exits still are', () => {
  for (const { c, scene: sc } of FALLS_MADE) {
    const where = `seed ${c.seed} ${c.biome}`,
      R = G.mapgenReach(sc, GAME_DATA.scenery, sc.hub, { slope: true });
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery, { slope: true }), [], where);
    for (const f of sc.falls || []) {
      const at = `${where} fall at ${f.x},${f.z}`,
        { top, foot } = WG.waterGenFallEnds(f);
      if (f.pool) {
        assert.ok('wd'.includes(tileAt(sc, foot[0], foot[1])), `${at}: the pool's water`);
        assert.ok(WG.waterGenReachedRing(sc, R, ...foot), `${at}: its pool is walked to`);
      }
      if (f.climb) {
        assert.ok(f.pool > 0 && f.h >= WG.WATERGEN_CLIMB_MIN, `${at}: a climb has a pool and is tall`);
        assert.ok(WG.waterGenReachedRing(sc, R, ...top), `${at}: its top is walked to`);
      }
    }
  }
});

test('the same seed makes the same falls; no river or mountain, no fall; the hub island has none', () => {
  for (const { c, scene } of FALLS_MADE.slice(0, 4)) {
    const again = G.mapgenScene(c, ctx).scene;
    assert.deepEqual(again.falls, scene.falls, `seed ${c.seed}`);
    assert.equal(again.steps, scene.steps, `seed ${c.seed}`);
  }
  assert.equal(G.mapgenScene({ seed: 77, land: { water: 'none' } }, ctx).scene.falls, undefined);
  assert.equal(G.mapgenScene({ seed: 77, land: { water: 'stream', terraces: 0 } }, ctx).scene.falls, undefined);
  const hub = modules['island-gen'].islandGenerate({}, 'copperleaf', ctx).scene;
  assert.equal(hub.falls, undefined, 'the hub island (locked; its fall waits for HB-4b)');
});

/* ---------- WA-5a: the new kinds placed ---------- */
/* run-like routes (pinned east and west, two exits) over the biomes with marsh, dry and cave water */
const KIND_BIOMES = ['meadow', 'lake', 'thicket', 'ridge', 'autumn', 'canyon', 'cave', 'jungle'];
const KIND_CASES = Array.from({ length: 48 }, (_, i) => ({
  seed: 9000 + i,
  biome: KIND_BIOMES[i % KIND_BIOMES.length],
  kind: 'route',
  pin: 'EW',
  w: 96,
  h: 64,
  road: {
    exits: [
      { side: 'E', t: 0.5, width: 2 },
      { side: 'W', t: 0.5, width: 2 },
    ],
  },
  land: {
    water: ['stream', 'pond', 'none', 'stream', 'pond'][i % 5],
    waterAmount: 0.3 + (i % 5) / 10,
    hills: (i % 4) / 4,
  },
}));
const KIND_MADE = KIND_CASES.map(c => ({ c, ...G.mapgenScene(c, ctx) }));
/** the cells of a scene's rectangles of kind k, as [x + 0.5, z + 0.5] */
const cellsOf = (sc, k) =>
  (sc.waters || [])
    .filter(r => r.k === k)
    .flatMap(r =>
      Array.from({ length: r.w * r.h }, (_, n) => [r.x + (n % r.w) + 0.5, r.z + Math.floor(n / r.w) + 0.5])
    );

test('WA-5a: rectangles over row runs, joined down the rows when they match', () => {
  const w = 10,
    cells = [2, 3, 4, 12, 13, 14, 22, 23, 27];
  assert.deepEqual(WG.waterGenRects(w, cells, 'bog'), [
    { x: 2, z: 0, w: 3, h: 2, k: 'bog' },
    { x: 2, z: 2, w: 2, h: 1, k: 'bog' },
    { x: 7, z: 2, w: 1, h: 1, k: 'bog' },
  ]);
});

test("WA-5a: rapids lie on the river's water, clear of roads and bridges; a hot spring is shallows walked to", () => {
  let springs = 0,
    rapids = 0;
  for (const { c, scene: sc, notes } of KIND_MADE) {
    const where = `seed ${c.seed} ${c.biome}`;
    assert.deepEqual(notes, [], where);
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery), [], `${where}: every exit reached`);
    const rp = cellsOf(sc, 'rapids');
    if (rp.length) rapids++;
    for (const [x, z] of rp) {
      assert.ok('wd'.includes(tileAt(sc, x, z)), `${where}: rapids at ${x},${z} on water`);
      assert.ok(!'pvKq'.includes(tileAt(sc, x, z)), `${where}: rapids at ${x},${z} off the road`);
      assert.ok(riverOf(sc) && riverOf(sc).rapids, `${where}: rapids on a river with rapids`);
    }
    const hs = cellsOf(sc, 'hotspring');
    if (!hs.length) continue;
    springs++;
    const R = G.mapgenReach(sc, GAME_DATA.scenery, sc.hub, { slope: true });
    for (const [x, z] of hs) assert.equal(tileAt(sc, x, z), 'w', `${where}: the hot spring at ${x},${z} is shallows`);
    const [mx, mz] = hs[Math.floor(hs.length / 2)];
    assert.ok(WG.waterGenReachedRing(sc, R, mx, mz, 3.5), `${where}: the hot spring is walked to`);
  }
  assert.ok(rapids > 0, 'some rivers have rapids');
  assert.ok(springs >= 1 && springs <= 16, `${springs} hot springs in ${KIND_MADE.length} routes`);
});

test('WA-5a: the bog in a marsh biome, an oasis in a dry one, cave water in a cave; reeds hide items there only', () => {
  const items = new Set(WG.WATERGEN_REED_ITEMS.map(([k]) => k));
  let bog = 0,
    reeds = 0;
  for (const { c, scene: sc } of KIND_MADE) {
    const where = `seed ${c.seed} ${c.biome}`,
      B = GAME_DATA.biomes[c.biome],
      W = sc.waters || [];
    for (const r of W) assert.ok(modules['water-kinds'].waterKindKnown(r.k), `${where}: ${r.k}`);
    if (W.some(r => r.k === 'bog')) {
      bog++;
      assert.equal(B.water, 'swamp', `${where}: a bog in a marsh biome`);
      assert.equal(sc.waterKind, 'swamp', `${where}: the scene keeps the marsh's look`);
    }
    if (W.some(r => r.k === 'oasis')) assert.equal(B.climate, 'dry', `${where}: an oasis in a dry place`);
    if (W.some(r => r.k === 'cave')) assert.equal(c.biome, 'cave', where);
    if (c.biome === 'cave' && sc.waterKind) assert.equal(W[0].k, 'cave', `${where}: cave water first, lava over it`);
    const hid = sc.props.filter(p => p.hide);
    if (hid.length) reeds++;
    for (const p of hid) {
      assert.ok(items.has(p.hide), `${where}: ${p.hide}`);
      assert.ok(/[wd]/.test(GAME_DATA.scenery.props[p.k].grow || ''), `${where}: ${p.k} is a water plant`);
      assert.ok(sc.waterKind === 'swamp', `${where}: reeds hide items in a marsh`);
    }
  }
  assert.ok(bog > 0 && reeds > 0, `${bog} bogs, ${reeds} scenes with a find`);
});

test('WA-5a: the same seed places the same kinds; a town never gets a hot spring', () => {
  for (const { c, scene } of KIND_MADE.slice(0, 8)) {
    const again = G.mapgenScene(c, ctx).scene;
    assert.deepEqual(again.waters, scene.waters, `seed ${c.seed}`);
    assert.deepEqual(
      again.props.filter(p => p.hide),
      scene.props.filter(p => p.hide),
      `seed ${c.seed}`
    );
  }
  for (const { c } of KIND_MADE.slice(0, 8)) {
    const t = G.mapgenScene({ ...c, kind: 'town' }, ctx).scene;
    assert.ok(!(t.waters || []).some(r => r.k === 'hotspring'), `seed ${c.seed}: a town`);
  }
});

test('WA-5a: shallows for others: rocks and folk stand only in shallows you wade, never deep water or a hot spring', () => {
  const W = modules['wading'];
  let rocks = 0;
  for (const { c, scene: sc } of [...KIND_MADE, ...MADE]) {
    const where = `seed ${c.seed} ${c.biome}`;
    for (const p of sc.props) {
      const ch = tileAt(sc, p.x, p.z);
      if (!'wd'.includes(ch) || /[wd]/.test(GAME_DATA.scenery.props[p.k].grow || '') || p.k === 'dock_post') continue;
      assert.equal(ch, 'w', `${where}: ${p.k} at ${p.x},${p.z} not in deep water`);
      assert.ok(WG.WATERGEN_SHALLOW_PROP.test(p.k), `${where}: ${p.k} is a rock`);
      const k = W.wadeKindAt(sc, p.x, p.z);
      assert.ok(W.wadeWalkable(sc, 'w', null, p.x, p.z) && k !== 'hotspring', `${where}: ${p.k} in ${k}`);
      rocks++;
    }
    for (const [x, z] of sc.npcSpots || []) {
      const ch = tileAt(sc, x, z);
      if ('wd'.includes(ch)) assert.ok(ch === 'w' && W.wadeHere(sc, x, z), `${where}: a folk spot at ${x},${z}`);
    }
  }
  assert.ok(rocks > 0, 'some rocks stand in shallows');
});
