// alpha 0.4's water rules in the game data: no building's footprint (turned as it stands) holds water, and boards
// never run out over water as ground: a jetty is a flat deck on posts with the water under it (scene.bridges, pier: 1)
// that ends over water. (TC-3: was the full check's water step, tools/check-quick.py; buildingsInWater and piersOf
// are its buildings_in_water and piers_of, first written in the one-off tools/fix-marigold-stream.py and
// tools/fix-piers.py.)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';

const D = readGameData();
const WET = new Set(['w', 'd']);

/** the ground kind at a cell of a scene, or null off it (row 0 of tiles is the far edge) */
const groundAt = T => (x, z) => (x >= 0 && z >= 0 && x < T[0].length && z < T.length ? T[T.length - 1 - z][x] : null);

/** every building whose footprint (turned as it stands) has water in it: [scene, kind, x, z, wet half-metres] */
function buildingsInWater(data) {
  const C = data.scenery.props,
    out = [];
  for (const [sid, sc] of Object.entries(data.maps)) {
    if (sid.includes('@') || !sc.tiles) continue;
    const at = groundAt(sc.tiles);
    for (const p of sc.props || []) {
      const M = C[p.k] || {};
      if (!M.box || !(M.build || M.door)) continue;
      const s0 = p.s || 1,
        w = M.box[0] * s0,
        d = M.box[1] * s0,
        r = ((p.rot || 0) * Math.PI) / 180,
        c = Math.cos(r),
        sn = Math.sin(r);
      let wet = 0;
      for (let ix = 1; ix < Math.trunc(w * 2); ix++)
        for (let iz = 1; iz < Math.trunc(d * 2); iz++) {
          const lx = -w / 2 + ix / 2,
            lz = iz / 2,
            x = p.x + lx * c - lz * sn,
            z = p.z + lx * sn + lz * c;
          if (WET.has(at(Math.floor(x), Math.floor(z)))) wet++;
        }
      if (wet) out.push([sid, p.k, p.x, p.z, wet]);
    }
  }
  return out;
}

/** the strips of boards ('b') that run out into the water from a bank: [{cells over water, a, b, width}] in the
 *  scene's metres; boards across the water from bank to bank (a bridge) are left alone */
function piersOf(sc) {
  const at = groundAt(sc.tiles),
    H = sc.tiles.length,
    W = sc.tiles[0].length,
    key = (x, z) => x * 100000 + z,
    cells = new Set(),
    list = [];
  for (let z = 0; z < H; z++)
    for (let x = 0; x < W; x++) if (at(x, z) === 'b') (cells.add(key(x, z)), list.push([x, z]));
  list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const seen = new Set(),
    out = [],
    near = (x, z) => [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ];
  for (const c of list) {
    if (seen.has(key(...c))) continue;
    const comp = [c],
      st = [c];
    seen.add(key(...c));
    while (st.length) {
      const [x, z] = st.pop();
      for (const q of near(x, z))
        if (cells.has(key(...q)) && !seen.has(key(...q))) (seen.add(key(...q)), st.push(q), comp.push(q));
    }
    if (!comp.some(([x, z]) => near(x, z).some(q => WET.has(at(...q))))) continue;
    /* the strip's axis: the longer way of its spread (principal axis of the squares' middles) */
    const n = comp.length,
      mx = comp.reduce((s, [x]) => s + x + 0.5, 0) / n,
      mz = comp.reduce((s, [, z]) => s + z + 0.5, 0) / n;
    let sxx = 0,
      szz = 0,
      sxz = 0;
    for (const [x, z] of comp) {
      sxx += (x + 0.5 - mx) ** 2;
      szz += (z + 0.5 - mz) ** 2;
      sxz += (x + 0.5 - mx) * (z + 0.5 - mz);
    }
    let ang = 0.5 * Math.atan2(2 * sxz, sxx - szz);
    /* a strip that is nearly square to the map runs square to it */
    for (const a90 of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI])
      if (Math.abs(ang - a90) < (10 * Math.PI) / 180) ang = a90;
    const ux = Math.cos(ang),
      uz = Math.sin(ang),
      px = -uz,
      pz = ux,
      rows = new Map();
    for (const [x, z] of comp) {
      const t = (x + 0.5 - mx) * ux + (z + 0.5 - mz) * uz,
        s = (x + 0.5 - mx) * px + (z + 0.5 - mz) * pz,
        k = Math.floor(t + 0.5);
      if (!rows.has(k)) rows.set(k, []);
      rows.get(k).push([x, z, s]);
    }
    /* both sides of this row of boards are water */
    const sideWet = row => {
      const lo = Math.min(...row.map(r => r[2])),
        hi = Math.max(...row.map(r => r[2])),
        tt = row.reduce((a, r) => a + (r[0] + 0.5 - mx) * ux + (r[1] + 0.5 - mz) * uz, 0) / row.length,
        wet = s => WET.has(at(Math.floor(mx + ux * tt + px * s), Math.floor(mz + uz * tt + pz * s)));
      return wet(lo - 1) && wet(hi + 1);
    };
    const ks = [...rows.keys()].sort((a, b) => a - b),
      over = ks.filter(k => sideWet(rows.get(k)));
    if (!over.length) continue;
    const t0 = Math.min(...over),
      t1 = Math.max(...over);
    let landLo = ks.some(k => k < t0);
    const landHi = ks.some(k => k > t1),
      beyond = t => at(Math.floor(mx + ux * t), Math.floor(mz + uz * t));
    /* no boards on land: the bank is whichever end is dry */
    if (!landLo && !landHi) landLo = !WET.has(beyond(t0 - 1.2));
    if (landLo && landHi) continue;
    /* from the bank (a little onto the boards there) out to the end */
    const [ta, tb] = landLo ? [t0 - 0.5 - 0.6, t1 + 0.5] : [t1 + 0.5 + 0.6, t0 - 0.5];
    const overRows = over.flatMap(k => rows.get(k)),
      lat = overRows.map(r => r[2]),
      sm = (Math.min(...lat) + Math.max(...lat)) / 2;
    /* its width: the squares under it over its length (a slanting strip of squares is wider than the boards were) */
    let w = overRows.length / Math.max(1, t1 - t0 + 1);
    if (Math.abs(ux) > 0.2 && Math.abs(uz) > 0.2) w = Math.min(w * 0.62, 2.2);
    w = Math.max(1.2, Math.round((w - 0.3) * 100) / 100);
    const pt = t => [Math.round((mx + ux * t + px * sm) * 100) / 100, Math.round((mz + uz * t + pz * sm) * 100) / 100];
    out.push({ cells: overRows.map(r => [r[0], r[1]]), a: pt(ta), b: pt(tb), w });
  }
  return out;
}

const OUTDOOR = Object.entries(D.maps).filter(([sid, sc]) => !sid.includes('@') && sc.tiles && sc.kind !== 'room');

test('no building has water in its footprint', () => {
  assert.deepEqual(
    buildingsInWater(D).map(([sid, k, x, z]) => `${sid}: ${k} at ${x},${z}`),
    []
  );
});

test('no boards run out over the water as ground (a jetty is scene.bridges, pier: 1)', () => {
  const bad = OUTDOOR.flatMap(([sid, sc]) => piersOf(sc).map(P => `${sid}: boards run out over the water at ${P.a}`));
  assert.deepEqual(bad, []);
});

test('every jetty ends over water', () => {
  const bad = [];
  for (const [sid, sc] of OUTDOOR)
    for (const B of sc.bridges || []) {
      if (!B.pier) continue;
      const [x, z] = B.b,
        end = groundAt(sc.tiles)(Math.floor(x), Math.floor(B.b[1] > B.a[1] ? z - 0.3 : z + 0.3));
      if (!WET.has(end)) bad.push(`${sid}: the jetty to ${B.b}`);
    }
  assert.deepEqual(bad, []);
});

/** a little 12 m square scene: land ('g') where land(x, z), water elsewhere, boards ('b') where boards(x, z) */
const scene = (land, boards = () => false) => ({
  tiles: Array.from({ length: 12 }, (_, r) =>
    Array.from({ length: 12 }, (_, x) => {
      const z = 11 - r;
      return boards(x, z) ? 'b' : land(x, z) ? 'g' : 'w';
    }).join('')
  ),
  props: [],
});

test('a building standing in water is found', () => {
  const sc = scene(() => false);
  sc.props.push({ k: 'house', x: 6, z: 6 });
  const data = { maps: { pond: sc }, scenery: { props: { house: { box: [3, 3], door: { x: 0 } } } } };
  assert.deepEqual(buildingsInWater(data)[0].slice(0, 2), ['pond', 'house']);
});

test('boards run out from the bank into the water are found; from bank to bank they are a bridge', () => {
  const south = (x, z) => z < 3,
    both = (x, z) => z < 3 || z > 9,
    strip = (x, z) => (x === 5 || x === 6) && z >= 1 && z <= 7,
    across = (x, z) => (x === 5 || x === 6) && z >= 1 && z <= 10;
  const P = piersOf(scene(south, strip));
  assert.equal(P.length, 1, 'one pier');
  assert.ok(P[0].b[1] > P[0].a[1], `it runs out north, from the bank (${P[0].a} to ${P[0].b})`);
  assert.equal(piersOf(scene(both, across)).length, 0, 'a bridge is left alone');
  assert.equal(piersOf(scene(south)).length, 0, 'no boards, no pier');
});
