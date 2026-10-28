// The owner (2026-10-28): the hub island's ground, by hand patches after the generator's new mountain (its dials:
// game/data/maps/copperleaf.json islandGen.dials.mountain, tools/build-island.mjs). The town zone stays locked (an
// unlocked rebuild makes the town again differently); only what is named below changes. Run once on the ground as the
// generator and the earlier patches left it: a rebuild (build-island.mjs) keeps the locked town zone's ground, this
// patch's work in it included, so the tool refuses a map that already has the pond's fall (its `falls`, which a
// rebuild keeps too). To make it again, start from the map before it (git) and run the whole chain.
//
//   node tools/patch-copperleaf-terrain.mjs --seam --roll --pond
//
// --seam: the town zone kept the old mountain's lowest shelf and its trail's steps (it is locked, so a rebuild keeps
//   its ground exactly) where the new mountain no longer stands: a thin rock wall along the zone's edge. Those step
//   raises (0.2 m and more, never on water) are cleared, the dead end of the old trail into the slope is grass again,
//   and the ground within SEAM_W metres of the zone's edge is eased (corner heights averaged, plots and streets kept).
// --roll: gentle rises and dips (up to ROLL_UP metres up, ROLL_DOWN down) over the land, faded out by plots, streets,
//   the square, paths, water, sand, bridges and the barn's and pasture's flat zones, so every pad stays level.
// --pond: the pond lifted onto a terrace on the mountain's foot (POND_RAISE metres): its bed and rim raised, a rock
//   face to the east and south where the river leaves over a waterfall (a `falls` entry) into a plunge pool by the
//   bridge, the river's first metres carved from the pool down to its old bed; on the west and north the terrace slopes
//   down into the mountain's foot. A thin stream (FEED) comes down the mountain's foot into the pond, white water all
//   the way. The fall's spot, the pond's spot and the stream entries follow.
// Written through tools/write-data.mjs, as every build tool writes the data; the dressing is laid again last.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readGameData, ROOT } from './data-files.mjs';
import { islandDress } from './island-dress.mjs';
import { islandPointIn } from '../game/js/logic/island.js';
import { islandPolyDist } from '../game/js/logic/island-gen.js';
import { mapgenDecodeBase64, mapgenEncodeBase64, mapgenFbm } from '../game/js/logic/mapgen.js';

const SEAM_W = 4; /* metres either side of the town zone's edge that are eased */
const ROLL_UP = 1.1; /* the rolling land's rises (m) */
const ROLL_DOWN = 0.35; /* and its dips (m) */
const POND_RAISE = 3.2; /* how far the pond and its terrace are lifted (m) */
const POND_R = 6.6; /* the terrace's radius round the pond's middle (m), wandering by noise */
const LIP = 1.4; /* the fall's lip, metres down the river from its head */
const POOL = 1.8; /* the plunge pool's radius (m) */
const FEED = [
  [95.5, 92.5],
  [98.2, 89.4],
  [100.6, 86.9],
  [102.6, 84.9],
]; /* the stream down the mountain's foot into the pond, from its spring */

const D = readGameData(),
  M = D.maps.copperleaf,
  { w, h } = M,
  W2 = w * 2,
  args = process.argv.slice(2),
  want = k => args.includes(k);
if (!['--seam', '--roll', '--pond'].some(want)) {
  console.error('usage: node tools/patch-copperleaf-terrain.mjs --seam --roll --pond');
  process.exit(1);
}
{
  const p0 = M.streams[0] && M.streams[0].pts[0];
  if (p0 && (M.falls || []).some(f => Math.hypot(f.x - p0[0], f.z - p0[1]) < 4)) {
    console.error(
      "copperleaf already has the pond's fall: its town zone keeps this patch's ground through a rebuild; start from the map before it"
    );
    process.exit(1);
  }
}
/* corner heights: rows from the far edge (island-gen.js islandDecodeGround), j counted from the south */
const H = (i, j) => +M.heights[h - Math.max(0, Math.min(h, j))][Math.max(0, Math.min(w, i))] || 0,
  setH = (i, j, v) => (M.heights[h - j][i] = Math.round(v * 100) / 100),
  tile = (i, j) => (M.tiles[h - 1 - j] || '')[i],
  setTile = (i, j, c) => {
    const r = M.tiles[h - 1 - j];
    M.tiles[h - 1 - j] = r.slice(0, i) + c + r.slice(i + 1);
  },
  smooth = f => f * f * (3 - 2 * f),
  clamp01 = v => Math.max(0, Math.min(1, v)),
  /* the ground at a point, bilinear on the corners */
  ground = (x, z) => {
    const i = Math.max(0, Math.min(w - 1, Math.floor(x))),
      j = Math.max(0, Math.min(h - 1, Math.floor(z))),
      u = x - i,
      v = z - j;
    return (
      H(i, j) * (1 - u) * (1 - v) + H(i + 1, j) * u * (1 - v) + H(i, j + 1) * (1 - u) * v + H(i + 1, j + 1) * u * v
    );
  };
/* the step raise (half-metre cells, 0.05 m a unit) and its flags */
const S = (() => {
    const u = mapgenDecodeBase64(M.steps);
    return new Int16Array(u.buffer.slice(u.byteOffset, u.byteOffset + u.length));
  })(),
  SM = mapgenDecodeBase64(M.stepm);
const WET = 'wd',
  /* what stays as it is under the rolling land and the eased seam: streets, paths, the square, bridges' ends, sand */
  KEEP = 'pvcuKqsSP',
  town = M.zones.find(Z => Z.k === 'town'),
  flat = M.zones.filter(Z => Z.k === 'barn' || Z.k === 'pasture'),
  notes = [];

/* how far each corner is from what must stay level (plots with 2 m round them, streets, water, sand, flat zones) */
const keepDist = (() => {
  const W1 = w + 1,
    d = new Float32Array(W1 * (h + 1)).fill(1e9),
    Q = [];
  const seed = (i, j) => {
    if (i < 0 || j < 0 || i > w || j > h) return;
    const q = j * W1 + i;
    if (d[q]) {
      d[q] = 0;
      Q.push(q);
    }
  };
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = tile(i, j);
      if (WET.includes(c) || KEEP.includes(c))
        for (const [a, b] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          seed(i + a, j + b);
    }
  for (const L of M.plots || []) {
    const a = ((L.a || 0) * Math.PI) / 180,
      ca = Math.cos(a),
      sa = Math.sin(a);
    for (let j = Math.floor(L.z - 12); j <= L.z + 12; j++)
      for (let i = Math.floor(L.x - 12); i <= L.x + 12; i++) {
        const dx = i - L.x,
          dz = j - L.z,
          u = dx * ca + dz * sa,
          v = -dx * sa + dz * ca;
        if (Math.abs(u) <= L.w / 2 + 2 && Math.abs(v) <= L.d / 2 + 2) seed(i, j);
      }
  }
  for (const B of M.bridges || [])
    for (const p of [B.a, B.b])
      if (p)
        for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) seed(Math.round(p[0]) + i, Math.round(p[1]) + j);
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++)
      if (flat.some(Z => islandPointIn(Z.poly, i, j) || islandPolyDist(Z.poly, i, j, 3) < 2)) seed(i, j);
  /* a two-pass chamfer distance (metres) */
  const R2 = Math.SQRT2;
  for (const pass of [0, 1])
    for (let k = 0; k < d.length; k++) {
      const q = pass ? d.length - 1 - k : k,
        i = q % W1,
        j = (q - i) / W1,
        s = pass ? 1 : -1;
      for (const [a, b, c] of [
        [s, 0, 1],
        [0, s, 1],
        [s, s, R2],
        [-s, s, R2],
      ]) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii > w || jj > h) continue;
        const v = d[jj * W1 + ii] + c;
        if (v < d[q]) d[q] = v;
      }
    }
  return (i, j) => d[j * W1 + i];
})();

if (want('--seam')) {
  let cleared = 0,
    grass = 0,
    eased = 0;
  for (let j = 0; j < h * 2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        q = j * W2 + i;
      if (Math.abs(S[q]) < 4 || WET.includes(tile(Math.floor(x), Math.floor(z)))) continue;
      if (!islandPointIn(town.poly, x, z)) continue;
      /* only the old mountain's: away from the town's own streets and plots (they have none anyway) */
      S[q] = 0;
      SM[q] = 0;
      cleared++;
    }
  /* the old trail's dead end, up into the slope where the trail was: grass again */
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (
        tile(i, j) === 'v' &&
        islandPointIn(town.poly, i + 0.5, j + 0.5) &&
        islandPolyDist(town.poly, i + 0.5, j + 0.5, 12) < 10 &&
        j > 92 &&
        i < 110
      ) {
        setTile(i, j, 'G');
        grass++;
      }
  for (let pass = 0; pass < 4; pass++) {
    const next = [];
    for (let j = 1; j < h; j++)
      for (let i = 1; i < w; i++) {
        if (islandPolyDist(town.poly, i, j, SEAM_W + 1) > SEAM_W || keepDist(i, j) < 1.5) continue;
        let s = 0,
          n = 0;
        for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) ((s += H(i + a, j + b)), n++);
        next.push([i, j, s / n]);
      }
    for (const [i, j, v] of next) setH(i, j, v);
    eased = next.length;
  }
  notes.push(
    `the seam: ${cleared} old step cells cleared, ${grass} tiles of the old trail's dead end to grass, ${eased} corners eased`
  );
}

if (want('--roll')) {
  let n = 0,
    top = 0;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const k = smooth(clamp01((keepDist(i, j) - 1.5) / 5));
      if (k <= 0) continue;
      const f = mapgenFbm(i / 24, j / 24, 9101) - 0.5 + 0.45 * (mapgenFbm(i / 9, j / 9, 9103) - 0.5),
        /* the noise's spread is narrow (about +-0.25): stretched to +-1 */
        dy = f > 0 ? Math.min(1, f * 4) * ROLL_UP : Math.max(-1, f * 4) * ROLL_DOWN;
      setH(i, j, H(i, j) + dy * k);
      n++;
      top = Math.max(top, dy * k);
    }
  notes.push(`the rolling land: ${n} corners, rises up to ${Math.round(top * 100) / 100} m`);
}

if (want('--pond')) {
  const pond = M.spots.find(s => s.kind === 'pond'),
    st = M.streams[0],
    p0 = st.pts[0],
    p1 = st.pts[1],
    dl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]),
    dir = [(p1[0] - p0[0]) / dl, (p1[1] - p0[1]) / dl],
    lip = [p0[0] + dir[0] * LIP, p0[1] + dir[1] * LIP],
    poolC = [lip[0] + dir[0] * (POOL + 0.25), lip[1] + dir[1] * (POOL + 0.25)],
    /* the terrace: round the pond, its edge wandering; the side facing the river and the path (east and south) a rock
       face, the side toward the mountain (west and north) a slope down into its foot */
    radius = a => POND_R + 1.1 * (mapgenFbm(Math.cos(a) * 2 + 7, Math.sin(a) * 2 + 7, 9201) - 0.5) * 2,
    faceSide = a => {
      /* the rock face: from the north-east round by the east and south to the south-west */
      const deg = ((a * 180) / Math.PI + 360) % 360;
      return deg > 200 || deg < 50;
    },
    inTerrace = (x, z) => {
      const a = Math.atan2(z - pond.z, x - pond.x),
        r = Math.hypot(x - pond.x, z - pond.z),
        R = radius(a);
      /* the lip stands on the terrace's edge, the river's line beyond it does not */
      const along = (x - p0[0]) * dir[0] + (z - p0[1]) * dir[1],
        across = Math.abs(-(x - p0[0]) * dir[1] + (z - p0[1]) * dir[0]);
      if (across < 1.7 && along > LIP) return 0;
      if (faceSide(a)) return r <= R ? 1 : 0;
      return clamp01(1 - (r - R) / 6);
    };
  /* the pond's water now (as the walk view lays it: the mean of its cells' ground less 0.12) */
  let sum = 0,
    cells = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (
        WET.includes(tile(i, j)) &&
        Math.hypot(i + 0.5 - pond.x, j + 0.5 - pond.z) < 5.5 &&
        Math.hypot(i + 0.5 - p0[0], j + 0.5 - p0[1]) > 2
      ) {
        sum += ground(i + 0.5, j + 0.5);
        cells++;
      }
  const was = sum / cells - 0.12,
    water = was + POND_RAISE,
    rim = water + 0.35;
  let raised = 0,
    face = 0;
  const old = M.heights.map(r => r.slice()),
    Hold = (i, j) => +old[h - Math.max(0, Math.min(h, j))][Math.max(0, Math.min(w, i))] || 0;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const f = inTerrace(i, j);
      if (f <= 0) continue;
      /* a corner of the pond (any cell round it wet) keeps its depth under the new water; dry ground rises to the rim
         (a little uneven), on the slope side blending into the ground that is there */
      const wet = [
          [0, 0],
          [-1, 0],
          [0, -1],
          [-1, -1],
        ].some(([a, b]) => WET.includes(tile(i + a, j + b) || '') && Math.hypot(i - pond.x, j - pond.z) < POND_R),
        top = wet ? Hold(i, j) + POND_RAISE : rim + 0.25 * (mapgenFbm(i / 3, j / 3, 9203) - 0.5),
        v = Math.max(Hold(i, j), Hold(i, j) * (1 - f) + top * f);
      if (v > Hold(i, j) + 0.005) {
        setH(i, j, v);
        raised++;
      }
    }
  /* the rock face: the cells across the drop are rock */
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (WET.includes(tile(i, j)) || Math.hypot(i + 0.5 - pond.x, j + 0.5 - pond.z) > POND_R + 3.5) continue;
      const c = [H(i, j), H(i + 1, j), H(i, j + 1), H(i + 1, j + 1)];
      if (Math.max(...c) - Math.min(...c) > 1.2) {
        setTile(i, j, 'r');
        face++;
      }
    }
  /* the river: from the pond's level to its lip, then the plunge pool cut down at its foot, then down to its old bed
     over the next metres (its line is the same) */
  const foot = Hold(Math.round(poolC[0]), Math.round(poolC[1])),
    poolLev = Math.min(foot, was) - 0.1;
  let pooled = 0;
  for (let j = Math.floor(poolC[1] - POOL - 2); j <= poolC[1] + POOL + 2; j++)
    for (let i = Math.floor(poolC[0] - POOL - 2); i <= poolC[0] + POOL + 2; i++) {
      const r = Math.hypot(i + 0.5 - poolC[0], j + 0.5 - poolC[1]);
      if (r > POOL + 0.3) continue;
      setTile(i, j, r < POOL - 1.1 ? 'd' : 'w');
      pooled++;
    }
  for (let j = Math.floor(poolC[1] - POOL - 2); j <= poolC[1] + POOL + 3; j++)
    for (let i = Math.floor(poolC[0] - POOL - 2); i <= poolC[0] + POOL + 3; i++) {
      const r = Math.hypot(i - poolC[0], j - poolC[1]);
      if (r <= POOL + 0.2) setH(i, j, Math.min(H(i, j), poolLev - 0.5 * clamp01(1 - r / POOL) - 0.1));
      else if (r <= POOL + 1.5 && !inTerrace(i, j)) setH(i, j, Math.min(H(i, j), poolLev + 0.35));
    }
  /* the river's head on the terrace (from its head to the lip): at the pond's new level */
  for (let j = Math.floor(p0[1] - 4); j <= p0[1] + 4; j++)
    for (let i = Math.floor(p0[0] - 4); i <= p0[0] + 4; i++) {
      const along = (i - p0[0]) * dir[0] + (j - p0[1]) * dir[1],
        across = Math.abs(-(i - p0[0]) * dir[1] + (j - p0[1]) * dir[0]);
      if (along < -1 || along > LIP || across > 1.6) continue;
      setH(i, j, water + 0.12);
    }
  M.falls = [
    ...(M.falls || []).filter(f => Math.hypot(f.x - lip[0], f.z - lip[1]) > 3),
    {
      x: Math.round(lip[0] * 100) / 100,
      z: Math.round(lip[1] * 100) / 100,
      dir: dir.map(v => Math.round(v * 1000) / 1000),
      w: 2.4,
      h: Math.round((water - poolLev) * 100) / 100,
      pool: POOL,
      k: 'stream',
    },
  ];
  /* the stream down the mountain's foot: a narrow channel cut into the slope (its bed under the ground, never
     raised, never rising downhill), white water all the way down into the pond */
  let fed = 0;
  const near = (x, z) => {
    let best = Infinity,
      s = 0,
      acc = 0;
    for (let k = 0; k < FEED.length - 1; k++) {
      const a = FEED[k],
        b = FEED[k + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = clamp01(((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (l * l)),
        d = Math.hypot(a[0] + (b[0] - a[0]) * t - x, a[1] + (b[1] - a[1]) * t - z);
      if (d < best) [best, s] = [d, acc + l * t];
      acc += l;
    }
    return [best, s];
  };
  /* the bed along the line, every quarter metre: the ground less 0.25, never rising downhill, never under the pond */
  const prof = [];
  {
    let acc = 0,
      low = Infinity;
    for (let k = 0; k < FEED.length - 1; k++) {
      const a = FEED[k],
        b = FEED[k + 1],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < l; t += 0.25) {
        const x = a[0] + ((b[0] - a[0]) * t) / l,
          z = a[1] + ((b[1] - a[1]) * t) / l;
        low = Math.max(water + 0.12, Math.min(low, ground(x, z) - 0.25));
        prof.push([acc + t, low]);
      }
      acc += l;
    }
  }
  const bedAt = s => (prof.find(q => q[0] >= s) || prof[prof.length - 1])[1];
  const [x0, x1, z0, z1] = [
    Math.min(...FEED.map(p => p[0])) - 2,
    Math.max(...FEED.map(p => p[0])) + 2,
    Math.min(...FEED.map(p => p[1])) - 2,
    Math.max(...FEED.map(p => p[1])) + 2,
  ];
  for (let j = Math.floor(z0); j <= z1; j++)
    for (let i = Math.floor(x0); i <= x1; i++) {
      const [d] = near(i + 0.5, j + 0.5);
      if (d > 0.75 || WET.includes(tile(i, j))) continue;
      setTile(i, j, 'w');
      fed++;
    }
  for (let j = Math.floor(z0); j <= z1; j++)
    for (let i = Math.floor(x0); i <= x1; i++) {
      const [d, s] = near(i, j);
      if (d <= 0.9) setH(i, j, Math.min(H(i, j), bedAt(s)));
    }
  M.streams = [
    {
      ...st,
      pts: [[Math.round(lip[0] * 100) / 100, Math.round(lip[1] * 100) / 100], ...st.pts.slice(1)],
      rapids: [[0, 0.06]],
    },
    { pts: FEED.map(p => p.slice()), speed: 0.9, src: 'spring', mouth: 'lake', rapids: [[0, 1]] },
  ];
  pond.y = Math.round(water * 100) / 100;
  const fallSpot = M.spots.find(s => s.kind === 'fall');
  if (fallSpot) Object.assign(fallSpot, { x: M.falls[0].x, z: M.falls[0].z, y: Math.round(water * 100) / 100 });
  notes.push(
    `the pond: water ${Math.round(was * 100) / 100} -> ${Math.round(water * 100) / 100} m on its terrace (${raised} corners raised, ${face} rock tiles); ` +
      `its fall ${M.falls[0].h} m at ${M.falls[0].x}, ${M.falls[0].z} into a ${POOL} m pool (${pooled} tiles); the stream down the foot ${fed} tiles`
  );
}

M.steps = mapgenEncodeBase64(new Uint8Array(S.buffer));
M.stepm = mapgenEncodeBase64(SM);
const tags = ['--seam', '--roll', '--pond'].filter(want).map(k => 'terrain ' + k);
M.islandGen.patched = [...new Set([...(M.islandGen.patched || []), ...tags])];

/* the dressing reads the ground (a street, the square), so it is laid again as build-copperleaf.mjs lays it, last */
{
  const town = M.props.filter(p => !p.dress),
    O = JSON.parse(readFileSync(join(ROOT, 'tools/data/copperleaf-town.json'), 'utf8')).dress || {},
    before = M.props.length - town.length,
    dressed = islandDress({ ...M, props: town }, D.scenery, O);
  M.props = [...town, ...dressed.props];
  notes.push(`the dressing laid again: ${dressed.props.length} props (${before} before)`);
}
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});
for (const n of notes) console.log(n);
