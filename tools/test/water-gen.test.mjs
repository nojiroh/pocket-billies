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
