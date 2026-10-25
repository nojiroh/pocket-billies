// Island track IS-2: the island generator (game/js/logic/island-gen.js) on the game's own scenery, its town on the
// river (the owner, after the sketches) included: plots on level pads, every plot's front walked to. The same seed makes
// the same island; the coast is closed and passes the contract (logic/island.js, the map schema); nothing but sea lies
// past it; the coast path is one loop you can walk along; every zone, the summit and the dock are reached on foot from
// the town, with nowhere you can't walk back from; the town, barn and pasture are flat; a second run keeps the locked
// zones' ground exactly; a locked ground is refused. Each check is a function giving its problems, and a planted fault
// in each is seen to fail. The map in the game data is the generator's own output for its stored dials and seed (made
// again as tools/build-island.mjs makes it, its locked zones kept).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { readGameData, ROOT } from '../data-files.mjs';
import {
  ISLAND_GEN_BUILT,
  ISLAND_GEN_DEFAULTS,
  ISLAND_GEN_VERSION,
  islandGenDials,
  islandGenerate,
  islandPolyDist,
} from '../../game/js/logic/island-gen.js';
import { islandPointIn, islandProblems } from '../../game/js/logic/island.js';
import {
  mapgenDecodeBase64,
  mapgenEncodeBase64,
  mapgenReach,
  mapgenReached,
  mapgenTraps,
} from '../../game/js/logic/mapgen.js';

const D = readGameData(),
  ctx = { scenery: D.scenery };
const SCHEMA = join(ROOT, 'game/data/schema');
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const f of readdirSync(SCHEMA)) ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA, f), 'utf8')));

const made = new Map();
/* one island per seed, made once */
const isle = (seed = 'copperleaf') => {
  if (!made.has(seed)) made.set(seed, islandGenerate({}, seed, ctx));
  return made.get(seed);
};
const copy = sc => structuredClone(sc);
const tileAt = (sc, i, j) => sc.tiles[sc.h - 1 - j][i];
const setTile = (sc, i, j, ch) => {
  const r = sc.h - 1 - j;
  sc.tiles[r] = sc.tiles[r].slice(0, i) + ch + sc.tiles[r].slice(i + 1);
};
const steps = sc => {
  if (!sc.steps) return null;
  const u = mapgenDecodeBase64(sc.steps);
  return new Int16Array(u.buffer, 0, u.length >> 1);
};

/* ---------- the checks, each giving its problems ---------- */
/** a cell whose middle lies past the coast that isn't water */
function seaProblems(sc) {
  const out = [];
  for (let j = 0; j < sc.h; j++)
    for (let i = 0; i < sc.w; i++)
      if (!islandPointIn(sc.island.coast, i + 0.5, j + 0.5) && !'wd'.includes(tileAt(sc, i, j)))
        out.push(`land past the coast at (${i}, ${j})`);
  return out;
}
/** the loop: closed, and walked along its own path cells (paths, trail, bridges) from end to end */
function loopProblems(sc, loop) {
  const out = [],
    a = loop.pts[0],
    z = loop.pts[loop.pts.length - 1];
  if (Math.hypot(a[0] - z[0], a[1] - z[1]) > 0.6) out.push('the loop is not closed');
  /* the walk grid with only path ground walkable (bridges open by themselves; the town square's paving is walked like
     a street: since the look pass the coast road crosses the river on the square's bridge) */
  const terrains = {};
  for (const k of Object.keys(sc.scenery.terrains)) terrains[k] = { walk: k === 'p' || k === 'v' || k === 'c' };
  const R = mapgenReach(sc, { terrains, props: {} }, a, { slope: true }),
    off = loop.pts.filter(p => !mapgenReached(R, p[0], p[1]));
  if (off.length) out.push(`${off.length} of the loop's points can't be walked to along it, first (${off[0]})`);
  return out;
}
/** a zone with no cell reached from the hub, a spot not reached, a place you can't walk back from */
function reachProblems(sc) {
  const out = [],
    R = mapgenReach(sc, sc.scenery, sc.hub, { slope: true });
  for (const Z of sc.zones) {
    let ok = false;
    for (let j = 0; j < R.gh && !ok; j++)
      for (let i = 0; i < R.gw && !ok; i++)
        ok = !!R.seen[j * R.gw + i] && islandPointIn(Z.poly, (i + 0.5) / 2, (j + 0.5) / 2);
    if (!ok) out.push(`the ${Z.k} zone can't be walked to from the town`);
  }
  for (const S of sc.spots || [])
    if (['summit', 'dock'].includes(S.kind) && !mapgenReached(R, S.x, S.z))
      out.push(`the ${S.kind} can't be walked to from the town`);
  for (const L of sc.plots || []) {
    const a = (L.a * Math.PI) / 180;
    if (L.k !== 'well' && !mapgenReached(R, L.x + Math.cos(a) * (L.d / 2 + 0.9), L.z + Math.sin(a) * (L.d / 2 + 0.9)))
      out.push(`the ${L.k} plot's front at (${L.x}, ${L.z}) can't be walked to from the town`);
  }
  /* IS-5: the wild Billies' grass */
  for (const g of sc.grassPatches || [])
    if (!mapgenReached(R, g.x, g.z)) out.push(`the tall grass at (${g.x}, ${g.z}) can't be walked to from the town`);
  const T = mapgenTraps(sc, sc.scenery);
  if (T.n) out.push(`${T.n} cells you can walk to but not back from, first (${T.at[0]})`);
  return out;
}
/** IS-5: the tall grass lies in its patches only, 15-70 m² each, none in a built zone, on the beach or the mountain */
function grassProblems(sc) {
  const out = [],
    P = sc.grassPatches || [],
    want = (sc.islandGen.dials.wild || {}).n ?? 5;
  if (P.length !== want) out.push(`${P.length} tall grass patches, not ${want}`);
  for (const g of P) if (g.n < 15 || g.n > 70) out.push(`a patch of ${g.n} m²`);
  let tall = 0;
  for (let j = 0; j < sc.h; j++)
    for (let i = 0; i < sc.w; i++) {
      if (tileAt(sc, i, j) !== 't') continue;
      tall++;
      const x = i + 0.5,
        z = j + 0.5;
      if (!P.some(g => Math.hypot(g.x - x, g.z - z) <= g.r)) out.push(`tall grass outside any patch at (${x}, ${z})`);
      const Z = sc.zones.find(
        Z => ['town', 'hamlet', 'barn', 'pasture', 'beach', 'mountain'].includes(Z.k) && islandPointIn(Z.poly, x, z)
      );
      if (Z) out.push(`tall grass in the ${Z.k} zone at (${x}, ${z})`);
    }
  if (tall !== P.reduce((n, g) => n + g.n, 0)) out.push(`${tall} tall grass cells, the patches say otherwise`);
  return out.slice(0, 6);
}
/** a plot whose pad isn't level (corners under it within 0.1 m) or has steps in it; a town that is one flat box */
function padProblems(sc) {
  const out = [],
    S = steps(sc);
  for (const L of sc.plots || []) {
    const a = (L.a * Math.PI) / 180,
      ca = Math.cos(a),
      sa = Math.sin(a),
      inside = (x, z) => {
        const ox = x - L.x,
          oz = z - L.z;
        return Math.abs(-sa * ox + ca * oz) <= L.w / 2 && Math.abs(ca * ox + sa * oz) <= L.d / 2;
      };
    let lo = 1e9,
      hi = -1e9,
      raised = 0;
    for (let j = Math.floor(L.z - L.w - L.d); j <= Math.ceil(L.z + L.w + L.d); j++)
      for (let i = Math.floor(L.x - L.w - L.d); i <= Math.ceil(L.x + L.w + L.d); i++) {
        if (i < 0 || j < 0 || i > sc.w || j > sc.h || !inside(i, j)) continue;
        const y = sc.heights[sc.h - j][i];
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
        if (S && i < sc.w && j < sc.h && inside(i + 0.5, j + 0.5))
          for (const q of [0, 1, sc.w * 2, sc.w * 2 + 1]) if (S[j * 2 * sc.w * 2 + i * 2 + q]) raised++;
      }
    if (hi - lo > 0.1) out.push(`the ${L.k} plot at (${L.x}, ${L.z}) rises ${(hi - lo).toFixed(2)} m`);
    if (raised) out.push(`the ${L.k} plot at (${L.x}, ${L.z}) has ${raised} raised step cells`);
  }
  const T = sc.zones.find(Z => Z.k === 'town');
  if (T) {
    let lo = 1e9,
      hi = -1e9;
    for (let j = 0; j <= sc.h; j++)
      for (let i = 0; i <= sc.w; i++)
        if (islandPointIn(T.poly, i, j) && 'wd'.indexOf(tileAt(sc, Math.min(i, sc.w - 1), Math.min(j, sc.h - 1))) < 0) {
          const y = sc.heights[sc.h - j][i];
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
    if (hi - lo < 1) out.push(`the town is one flat box (it rises ${(hi - lo).toFixed(2)} m)`);
  }
  return out;
}
/** the barn's or the pasture's zone that isn't flat: corners within 0.1 m, no steps, no water or path in it */
function flatProblems(sc) {
  const out = [],
    S = steps(sc);
  for (const Z of sc.zones.filter(Z => ['barn', 'pasture'].includes(Z.k))) {
    let lo = 1e9,
      hi = -1e9,
      raised = 0,
      wet = 0;
    for (let j = 0; j <= sc.h; j++)
      for (let i = 0; i <= sc.w; i++)
        if (islandPointIn(Z.poly, i, j)) {
          const y = sc.heights[sc.h - j][i];
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
    for (let j = 0; j < sc.h; j++)
      for (let i = 0; i < sc.w; i++) {
        if (!islandPointIn(Z.poly, i + 0.5, j + 0.5)) continue;
        if ('wdp'.includes(tileAt(sc, i, j))) wet++;
        if (S) for (const q of [0, 1, sc.w * 2, sc.w * 2 + 1]) if (S[j * 2 * sc.w * 2 + i * 2 + q]) raised++;
      }
    if (hi - lo > 0.1) out.push(`the ${Z.k} zone rises ${(hi - lo).toFixed(2)} m`);
    if (raised) out.push(`the ${Z.k} zone has ${raised} raised step cells`);
    if (wet) out.push(`the ${Z.k} zone has ${wet} cells of water or path`);
  }
  return out;
}
const withScenery = sc => Object.assign(copy(sc), { scenery: D.scenery });

test('the same seed makes the same island; another seed another; the dials are filled in and kept in range', () => {
  const a = isle(),
    b = islandGenerate({}, 'copperleaf', ctx);
  assert.deepEqual(b.scene, a.scene);
  const c = isle('another');
  assert.notDeepEqual(c.scene.tiles, a.scene.tiles);
  assert.equal(a.scene.islandGen.v, ISLAND_GEN_VERSION);
  assert.equal(a.scene.islandGen.seed, 'copperleaf');
  assert.deepEqual(a.scene.islandGen.dials, islandGenDials({}));
  const d = islandGenDials({ size: { r: 999 }, hills: -3, zones: [{ k: 'lighthouse' }, { k: 'town', a: 450 }] });
  assert.equal(d.size.r, 120);
  assert.equal(d.hills, 0);
  assert.deepEqual(
    d.zones.map(Z => [Z.k, Z.a]),
    [['town', 90]]
  );
  assert.deepEqual(
    ISLAND_GEN_DEFAULTS.zones.map(Z => Z.k),
    ['barn', 'pasture']
  );
  assert.equal(islandGenDials({ town: { houses: 99 } }).town.houses, 40);
});

test('the island passes the contract and the schema, a closed coast with only sea past it', () => {
  for (const seed of ['copperleaf', 'another']) {
    const { scene: sc, notes } = isle(seed);
    assert.deepEqual(islandProblems(sc), [], seed);
    assert.ok(ajv.validate('map.schema.json', sc), JSON.stringify(ajv.errors));
    assert.deepEqual(seaProblems(sc), [], seed);
    assert.deepEqual(
      notes.filter(n => /overlap|no trail|no room|no bridge/.test(n)),
      [],
      seed
    );
    assert.ok(sc.island.coast.length >= 100, 'the coast has its points');
    assert.ok(
      isle(seed).paths.some(p => p.name === 'town main street'),
      `${seed}: the town's main street (the trail starts at its top)`
    );
    const kinds = new Set((sc.plots || []).map(L => L.k));
    for (const k of ['well', 'lab', 'mast', 'shop', 'home', 'farmhouse', 'house'])
      assert.ok(kinds.has(k), `${seed}: a ${k} plot`);
    /* the look pass (the owner): a smaller island, 6-8 cottages, no hamlet */
    assert.ok(sc.plots.filter(L => L.k === 'house').length >= 6, `${seed}: houses in the town`);
    assert.ok(!sc.zones.some(Z => Z.k === 'hamlet'), `${seed}: no hamlet`);
    /* at most two bridges over the river, not close to one another */
    const mids = (sc.bridges || []).map(B => [(B.a[0] + B.b[0]) / 2, (B.a[1] + B.b[1]) / 2]);
    assert.ok(mids.length >= 1 && mids.length <= 2, `${seed}: ${mids.length} bridges`);
    if (mids.length === 2)
      assert.ok(Math.hypot(mids[0][0] - mids[1][0], mids[0][1] - mids[1][1]) >= 25, `${seed}: the bridges 25 m apart`);
    for (const k of ['town', 'barn', 'pasture', 'mountain', 'forest', 'cove', 'beach'])
      assert.ok(
        sc.zones.some(Z => Z.k === k),
        `a ${k} zone`
      );
    assert.ok(
      sc.zones.filter(Z => [...ISLAND_GEN_BUILT, 'hamlet'].includes(Z.k)).every(Z => Z.lock),
      'the built zones, the town and the hamlet are locked'
    );
    assert.deepEqual((sc.spots || []).map(S => S.kind).sort(), ['dock', 'fall', 'pond', 'summit', 'trailhead']);
  }
  /* planted: a cell of grass out at sea */
  const bad = copy(isle().scene);
  setTile(bad, 2, 2, 'g');
  assert.match(seaProblems(bad)[0], /land past the coast at \(2, 2\)/);
});

test('the coast path is one closed loop you can walk along', () => {
  const { scene, paths } = isle(),
    loop = paths.find(p => p.name === 'loop');
  assert.ok(loop, 'a loop');
  assert.deepEqual(loopProblems(withScenery(scene), loop), []);
  /* planted: a stretch of the loop turned to deep water, so the way round is cut */
  const bad = withScenery(scene),
    p = loop.pts[Math.floor(loop.pts.length / 3)];
  for (let j = Math.floor(p[1]) - 3; j <= Math.floor(p[1]) + 3; j++)
    for (let i = Math.floor(p[0]) - 3; i <= Math.floor(p[0]) + 3; i++) setTile(bad, i, j, 'd');
  assert.match(loopProblems(bad, loop).join(), /can't be walked to along it/);
});

test('every zone, the summit and the dock are walked to from the town, with nowhere you cannot walk back from', () => {
  for (const seed of ['copperleaf', 'another'])
    assert.deepEqual(reachProblems(withScenery(isle(seed).scene)), [], seed);
  /* planted: the trail's foot cut (a ring of deep water round the mountain zone's outline; the mountain stands off the
     island's middle since the look pass) */
  const bad = withScenery(isle().scene),
    M = bad.zones.find(Z => Z.k === 'mountain');
  for (let j = 0; j < bad.h; j++)
    for (let i = 0; i < bad.w; i++) {
      const d = islandPolyDist(M.poly, i + 0.5, j + 0.5);
      if (d > 1 && d < 4) setTile(bad, i, j, 'd');
    }
  bad.bridges = [];
  assert.match(reachProblems(bad).join(), /the summit can't be walked to/);
  /* planted: deep water in front of the lab */
  const bad2 = withScenery(isle().scene),
    lab = bad2.plots.find(L => L.k === 'lab'),
    la = (lab.a * Math.PI) / 180,
    fx = lab.x + Math.cos(la) * (lab.d / 2 + 0.9),
    fz = lab.z + Math.sin(la) * (lab.d / 2 + 0.9);
  for (let j = Math.floor(fz) - 2; j <= Math.floor(fz) + 2; j++)
    for (let i = Math.floor(fx) - 2; i <= Math.floor(fx) + 2; i++) setTile(bad2, i, j, 'd');
  assert.match(reachProblems(bad2).join(), /the lab plot's front .* can't be walked to/);
});

test('the barn and pasture are flat; every plot stands on a level pad; the town keeps its slopes', () => {
  for (const seed of ['copperleaf', 'another']) {
    assert.deepEqual(flatProblems(isle(seed).scene), [], seed);
    assert.deepEqual(padProblems(isle(seed).scene), [], seed);
  }
  /* planted: a corner in the barn's zone raised half a metre */
  const bad = copy(isle().scene),
    B = bad.zones.find(Z => Z.k === 'barn'),
    m = B.poly.reduce((a, p, _, L) => [a[0] + p[0] / L.length, a[1] + p[1] / L.length], [0, 0]).map(Math.round);
  bad.heights[bad.h - m[1]][m[0]] += 0.5;
  assert.match(flatProblems(bad).join(), /the barn zone rises 0\.5/);
  /* planted: a corner under the lab raised, and the whole town levelled */
  const bad2 = copy(isle().scene),
    lab = bad2.plots.find(L => L.k === 'lab');
  bad2.heights[bad2.h - Math.round(lab.z)][Math.round(lab.x)] += 0.4;
  assert.match(padProblems(bad2).join(), /the lab plot .* rises 0\.4/);
  const flat = copy(isle().scene);
  flat.heights = flat.heights.map(r => r.map(() => 1));
  flat.plots = [];
  assert.match(padProblems(flat).join(), /the town is one flat box/);
});

test("a second run keeps the locked zones' ground exactly; a locked ground is refused", () => {
  const A = copy(isle().scene),
    town = A.zones.find(Z => Z.k === 'town'),
    S = steps(A) || new Int16Array(4 * A.w * A.h);
  /* hand edits in the town, as the Studio would make them: a paved square, a raised corner, a step */
  const m = town.poly.reduce((a, p, _, L) => [a[0] + p[0] / L.length, a[1] + p[1] / L.length], [0, 0]).map(Math.floor);
  for (let j = m[1] - 2; j <= m[1] + 2; j++) for (let i = m[0] - 2; i <= m[0] + 2; i++) setTile(A, i, j, 'K');
  A.heights[A.h - m[1]][m[0]] += 0.3;
  S[m[1] * 2 * A.w * 2 + m[0] * 2] = 6;
  A.steps = mapgenEncodeBase64(new Uint8Array(S.buffer));
  A.stepm = A.stepm || mapgenEncodeBase64(new Uint8Array(4 * A.w * A.h));
  const { scene: B } = islandGenerate({}, 'a whole other seed', ctx, A);
  assert.notDeepEqual(B.tiles, A.tiles, 'the rest was made again');
  assert.deepEqual(B.island.c, A.island.c, 'the middle stays');
  const SB = steps(B);
  for (const Z of A.zones.filter(Z => Z.lock)) {
    assert.deepEqual(B.zones.find(Y => Y.k === Z.k && Y.lock).poly, Z.poly, `the ${Z.k} zone stays where it was`);
    for (let j = 0; j < A.h; j++)
      for (let i = 0; i < A.w; i++) {
        if (!islandPointIn(Z.poly, i + 0.5, j + 0.5)) continue;
        assert.equal(tileAt(B, i, j), tileAt(A, i, j), `${Z.k} ground at (${i}, ${j})`);
        for (const [ci, cj] of [
          [i, j],
          [i + 1, j + 1],
        ])
          assert.equal(B.heights[B.h - cj][ci], A.heights[A.h - cj][ci], `${Z.k} height at (${ci}, ${cj})`);
        for (const q of [0, 1, A.w * 2, A.w * 2 + 1]) {
          const k = j * 2 * A.w * 2 + i * 2 + q,
            kb = j * 2 * B.w * 2 + i * 2 + (q >= A.w * 2 ? q - A.w * 2 + B.w * 2 : q);
          assert.equal(SB ? SB[kb] : 0, S[k], `${Z.k} step at (${i}, ${j})`);
        }
      }
  }
  assert.deepEqual(islandProblems(B), []);
  /* the locked zones' plots come through as they were */
  const inLocked = L => A.zones.some(Z => Z.lock && islandPointIn(Z.poly, L.x, L.z)),
    key = L => JSON.stringify([L.k, L.x, L.z, L.w, L.d, L.a]);
  assert.deepEqual(B.plots.filter(inLocked).map(key).sort(), A.plots.filter(inLocked).map(key).sort());
  /* locked: never made again */
  const L = copy(A);
  L.islandGen = { ...L.islandGen, lock: true, hash: 'g00000000' };
  assert.throws(() => islandGenerate({}, 'x', ctx, L), /locked/);
});

test('the wild Billies wait in tall grass patches out by the woods, away from the town and the farm (IS-5)', () => {
  for (const seed of ['copperleaf', 's1', 's2']) {
    const sc = withScenery(isle(seed).scene);
    assert.deepEqual(grassProblems(sc), [], seed);
  }
  /* none asked for, none made; a planted fault seen */
  assert.equal(islandGenerate({ wild: { n: 0 } }, 'x', ctx).scene.grassPatches, undefined);
  const bad = copy(isle().scene),
    town = bad.zones.find(Z => Z.k === 'town'),
    [x, z] = town.poly.reduce((a, p) => [a[0] + p[0] / town.poly.length, a[1] + p[1] / town.poly.length], [0, 0]);
  setTile(bad, Math.floor(x), Math.floor(z), 't');
  assert.ok(grassProblems(bad).length > 0);
});

test('zones placed on top of each other are turned apart; organic 0 keeps plain rectangles', () => {
  const dials = structuredClone(ISLAND_GEN_DEFAULTS);
  dials.zones[1] = { ...dials.zones[0], k: 'pasture', w: 10, h: 10 };
  const { scene, notes } = islandGenerate(dials, 'x', ctx),
    barn = scene.zones.find(Z => Z.k === 'barn'),
    pasture = scene.zones.find(Z => Z.k === 'pasture');
  assert.ok(!pasture.poly.some(p => islandPointIn(barn.poly, p[0], p[1])), 'the pasture was turned off the barn');
  assert.ok(!notes.some(n => /overlap/.test(n)), notes.join());
  /* organic 0: every built zone the dial's rectangle */
  const plain = islandGenerate({ organic: 0 }, 'x', ctx).scene;
  for (const Z of plain.zones.filter(Z => ['barn', 'pasture'].includes(Z.k))) assert.equal(Z.poly.length, 4, Z.k);
});

test("the game's island is the generator's own output for its stored dials and seed", () => {
  /* IS-5: the hub, copperleaf, stands on the generator's ground (its town, people and pier are its own) */
  const sc = D.maps.copperleaf;
  assert.ok(sc && sc.islandGen, 'copperleaf is on the island');
  if (sc.islandGen.lock || sc.islandGen.v !== ISLAND_GEN_VERSION) return;
  /* as the tool makes it again: its own locked zones kept */
  const { scene, landmarks } = islandGenerate(sc.islandGen.dials, sc.islandGen.seed, ctx, sc);
  for (const k of [
    'w',
    'h',
    'tiles',
    'heights',
    'steps',
    'stepm',
    'island',
    'zones',
    'spots',
    'streams',
    'plots',
    'grassPatches',
  ])
    assert.deepEqual(sc[k], scene[k], `${k} (run node tools/build-island.mjs to remake it)`);
  assert.deepEqual(
    sc.bridges.filter(b => !b.pier),
    scene.bridges.filter(b => !b.pier),
    "bridges (the pier is the town's own, tools/build-copperleaf.mjs; a kept town's comes back with it)"
  );
  assert.deepEqual(sc.cam.orbit, scene.cam.orbit);
  /* HB-4b: the station's sky rail and portal, kept by build-island */
  assert.deepEqual(sc.landmarks, landmarks, 'landmarks (run node tools/build-island.mjs to remake it)');
});
