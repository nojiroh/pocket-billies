// Island track IS-2: the island generator (game/js/logic/island-gen.js) on the game's own scenery. The same seed makes
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
  /* the walk grid with only path ground walkable (bridges open by themselves) */
  const terrains = {};
  for (const k of Object.keys(sc.scenery.terrains)) terrains[k] = { walk: k === 'p' || k === 'v' };
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
  const T = mapgenTraps(sc, sc.scenery);
  if (T.n) out.push(`${T.n} cells you can walk to but not back from, first (${T.at[0]})`);
  return out;
}
/** a built zone (town, barn, pasture) that isn't flat: corners within 0.1 m, no steps, no water or path in it */
function flatProblems(sc) {
  const out = [],
    S = steps(sc);
  for (const Z of sc.zones.filter(Z => ISLAND_GEN_BUILT.includes(Z.k))) {
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
  assert.equal(ISLAND_GEN_DEFAULTS.zones.length, 3);
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
    for (const k of ['town', 'barn', 'pasture', 'mountain', 'forest', 'cove', 'beach'])
      assert.ok(
        sc.zones.some(Z => Z.k === k),
        `a ${k} zone`
      );
    assert.ok(
      sc.zones.filter(Z => ISLAND_GEN_BUILT.includes(Z.k)).every(Z => Z.lock),
      'the built zones are locked'
    );
    assert.deepEqual((sc.spots || []).map(S => S.kind).sort(), ['dock', 'fall', 'pond', 'summit']);
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
  /* planted: the trail's foot cut (a ring of deep water round the mountain's foot) */
  const bad = withScenery(isle().scene),
    M = bad.zones.find(Z => Z.k === 'mountain');
  const c = bad.island.c;
  for (let j = 0; j < bad.h; j++)
    for (let i = 0; i < bad.w; i++) {
      const d = Math.hypot(i + 0.5 - c[0], j + 0.5 - c[1]),
        foot = Math.max(...M.poly.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])));
      if (d > foot + 1 && d < foot + 4) setTile(bad, i, j, 'd');
    }
  bad.bridges = [];
  assert.match(reachProblems(bad).join(), /the summit can't be walked to/);
});

test('the town, barn and pasture are flat and empty, ready to build on', () => {
  assert.deepEqual(flatProblems(isle().scene), []);
  /* planted: a corner in the town raised half a metre */
  const bad = copy(isle().scene),
    T = bad.zones.find(Z => Z.k === 'town'),
    m = T.poly.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]).map(Math.round);
  bad.heights[bad.h - m[1]][m[0]] += 0.5;
  assert.match(flatProblems(bad).join(), /the town zone rises 0\.5/);
});

test("a second run keeps the locked zones' ground exactly; a locked ground is refused", () => {
  const A = copy(isle().scene),
    town = A.zones.find(Z => Z.k === 'town'),
    S = steps(A) || new Int16Array(4 * A.w * A.h);
  /* hand edits in the town, as the Studio would make them: a paved square, a raised corner, a step */
  const m = town.poly.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]).map(Math.floor);
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
  /* locked: never made again */
  const L = copy(A);
  L.islandGen = { ...L.islandGen, lock: true, hash: 'g00000000' };
  assert.throws(() => islandGenerate({}, 'x', ctx, L), /locked/);
});

test('zones on top of each other are named in the notes', () => {
  const dials = structuredClone(ISLAND_GEN_DEFAULTS);
  dials.zones[1] = { ...dials.zones[0], k: 'barn', w: 10, h: 10 };
  assert.match(islandGenerate(dials, 'x', ctx).notes.join(), /the town and barn zones overlap/);
});

test("the game's island is the generator's own output for its stored dials and seed", () => {
  const sc = D.maps.copperleaf_island;
  assert.ok(sc, 'copperleaf_island is in the game data');
  if (sc.islandGen.lock || sc.islandGen.v !== ISLAND_GEN_VERSION) return;
  /* as the tool makes it again: its own locked zones kept */
  const { scene } = islandGenerate(sc.islandGen.dials, sc.islandGen.seed, ctx, sc);
  for (const k of ['w', 'h', 'tiles', 'heights', 'steps', 'stepm', 'island', 'zones', 'spots', 'bridges', 'streams'])
    assert.deepEqual(sc[k], scene[k], `${k} (run node tools/build-island.mjs to remake it)`);
  assert.deepEqual(sc.cam.orbit, scene.cam.orbit);
});
