// Island track IS-5: Copperleaf moves onto the island. Puts the town (game/data/maps/copperleaf.json's buildings,
// gardens, people and life, as they were before the island, kept in tools/data/copperleaf-town.json) on the island's
// ground (the generator's: build-island.mjs) and writes the hub map, copperleaf.
//
//   node tools/build-copperleaf.mjs            # the town on the island's ground, into game/data/maps/copperleaf.json
//   node tools/build-copperleaf.mjs --extract  # once: the town as it stands in copperleaf.json, into the input file
//
// The ground is copperleaf_island's while that map exists, else copperleaf's own (every ground field below). The
// generator laid the town out and left plots facing their streets (IS-2): the lab, the airship station on the mast
// plot, Juniper's home, the shop (the General store, closed: Copperleaf has nothing to buy), the well; cottages on
// every house plot and the farmhouse plot. A building stands in the middle of its plot (its level pad), its door
// toward the plot's front: rot = the front's angle + 90 (logic/prop-turn.js: a building at rot 0 faces south). The
// props round a building in the old town (its garden) move with it, turned with it: worked out in the building's own
// metres, put down in the new building's; what would land on a street, the square, water, a bridge, another plot or
// in front of a door is left out (and counted). Rerunnable: the same ground and input write the same map.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';
import { islandPointIn, islandProblems } from '../game/js/logic/island.js';
import { hashString } from '../game/js/logic/rng.js';

const INPUT = join(ROOT, 'tools/data/copperleaf-town.json');
const D = readGameData(),
  C = D.scenery.props,
  PPU = D.scenery.ppu || 34;

if (process.argv.includes('--extract')) {
  const M = D.maps.copperleaf;
  if (M.islandGen) throw new Error('copperleaf is already on the island: the old town is in ' + INPUT);
  const keep = [
    'name',
    'sky',
    'haze',
    'hazeD',
    'blur',
    'amb',
    'tint',
    'indoor',
    'folk',
    'kind',
    'locationId',
    'wind',
    'a04place',
    'biome',
    'chat',
    'people',
    'life',
    'props',
    'hub',
    'npcSpots',
  ];
  const out = {
    about: 'Copperleaf Town as it stood before the island (IS-5): the input of tools/build-copperleaf.mjs',
  };
  for (const k of keep) if (k in M) out[k] = M[k];
  writeFileSync(INPUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`wrote ${INPUT}: ${out.props.length} props, ${out.people.length} people`);
  process.exit(0);
}

const TOWN = JSON.parse(readFileSync(INPUT, 'utf8')),
  G = D.maps.copperleaf_island || D.maps.copperleaf;
if (!G || !G.islandGen || !G.plots) throw new Error('no island ground (run node tools/build-island.mjs first)');

/* ---------- small helpers ---------- */
const r2 = v => Math.round(v * 100) / 100,
  RAD = Math.PI / 180,
  turn = (x, z, deg) => {
    const c = Math.cos(deg * RAD),
      s = Math.sin(deg * RAD);
    return [x * c - z * s, x * s + z * c];
  },
  norm = a => {
    const d = ((((a + 180) % 360) + 360) % 360) - 180;
    return Math.round(d * 10) / 10;
  },
  tileAt = (x, z) => (G.tiles[G.h - 1 - Math.floor(z)] || '')[Math.floor(x)] || 'd',
  boxOf = k => (C[k] && C[k].box) || null;
/** a building's own metres: x across its front, z back from its front (its footprint z 0 to its depth) */
const own = (B, x, z) => turn(x - B.x, z - B.z, -(B.rot || 0)),
  world = (B, lx, lz) => {
    const [a, b] = turn(lx, lz, B.rot || 0);
    return [B.x + a, B.z + b];
  },
  /** how far a point is outside a building's footprint (its box; a round 1 m for one without) */
  footDist = (B, x, z) => {
    const bx = boxOf(B.k),
      [lx, lz] = own(B, x, z);
    if (!bx) return Math.max(0, Math.hypot(lx, lz) - 1);
    const s = B.s || 1,
      dx = Math.max(0, Math.abs(lx) - (bx[0] * s) / 2),
      dz = Math.max(0, -lz, lz - bx[1] * s);
    return Math.hypot(dx, dz);
  };
/** a plot's rectangle test, grown by m */
const inPlot = (L, x, z, m = 0) => {
  const a = L.a * RAD,
    dx = x - L.x,
    dz = z - L.z,
    u = dx * Math.cos(a) + dz * Math.sin(a) /* toward the front */,
    v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= L.d / 2 + m && Math.abs(v) <= L.w / 2 + m;
};

/* ---------- the old town: its buildings and what stands round each ---------- */
const OLD = TOWN.props,
  oldBuildings = OLD.filter(
    p => ['lab', 'home', 'house', 'ranch', 'fly'].includes(p.act) || p.k === 'well' || p.k === 'airship'
  ),
  /* how far a building's garden reaches (Juniper's lavender and hives; the barn's farm patch) */
  REACH = { cottage_juniper: 10, barn: 16, lab: 5, airship_station: 3, well: 3 };
const garden = new Map(oldBuildings.map(B => [B, []]));
const loose = [];
for (const p of OLD) {
  if (oldBuildings.includes(p) || p.k === 'signpost') continue;
  let best = null,
    bd = 1e9;
  for (const B of oldBuildings) {
    if (B.k === 'airship') continue;
    const d = footDist(B, p.x, p.z);
    if (d < bd) [best, bd] = [B, d];
  }
  if (best && bd <= (REACH[best.k] ?? 4.5)) garden.get(best).push(p);
  else loose.push(p);
}

/* ---------- the plots: who stands where ---------- */
const plots = G.plots.map((L, i) => ({ ...L, i })),
  plotOf = k => plots.find(L => L.k === k),
  well = plotOf('well'),
  byWell = L => Math.hypot(L.x - well.x, L.z - well.z),
  townZone = G.zones.find(Z => Z.k === 'town'),
  townHouses = plots
    .filter(L => L.k === 'house' && islandPointIn(townZone.poly, L.x, L.z))
    .sort((a, b) => byWell(a) - byWell(b)),
  otherHouses = plots
    .filter(L => (L.k === 'house' && !townHouses.includes(L)) || L.k === 'farmhouse')
    .sort((a, b) => a.k.localeCompare(b.k) || a.i - b.i);
const oldCottages = oldBuildings.filter(B => B.act === 'house').sort((a, b) => a.x - b.x || a.z - b.z);
if (townHouses.length < oldCottages.length)
  throw new Error(`${townHouses.length} town house plots for ${oldCottages.length} cottages`);
/** [old building or a made one, plot] */
const pairs = [
  [oldBuildings.find(B => B.act === 'lab'), plotOf('lab')],
  [oldBuildings.find(B => B.act === 'fly'), plotOf('mast')],
  [oldBuildings.find(B => B.act === 'home'), plotOf('home')],
  [oldBuildings.find(B => B.k === 'well'), well],
  [{ k: 'shop', x: 0, z: 0, label: 'General store' }, plotOf('shop')],
  ...oldCottages.map((B, i) => [B, townHouses[i]]),
  /* the new cottages: the two kinds and their looks taken in turn */
  ...[...townHouses.slice(oldCottages.length), ...otherHouses].map((L, i) => [
    { k: i % 2 ? 'cottage_solar' : 'cottage_moss', x: 0, z: 0, act: 'house', ...(i % 4 > 1 ? { v: 1 + (i % 3) } : {}) },
    L,
  ]),
];
for (const [B, L] of pairs)
  if (!B || !L) throw new Error('a building or a plot is missing: ' + JSON.stringify([B && B.k, L && L.k]));

/* ---------- the buildings on their plots, their gardens with them ---------- */
const props = [],
  left = { street: 0, water: 0, plot: 0, door: 0 },
  doorFronts = [];
const STREET = 'pvc',
  WATER = 'wdS',
  bridges = G.bridges || [],
  onBridge = (x, z) =>
    bridges.some(b => {
      const dx = b.b[0] - b.a[0],
        dz = b.b[1] - b.a[1],
        L2 = dx * dx + dz * dz || 1,
        t = Math.max(0, Math.min(1, ((x - b.a[0]) * dx + (z - b.a[1]) * dz) / L2));
      return Math.hypot(b.a[0] + dx * t - x, b.a[1] + dz * t - z) < (b.w || 2) / 2 + 0.6;
    });
/** a building put in the middle of its plot, facing its front */
function place(B, L) {
  const rot = norm(L.a + 90),
    bx = boxOf(B.k),
    s = B.s || 1,
    /* the footprint's middle on the plot's middle (a building's base point is the middle of its front) */
    back = bx ? (bx[1] * s) / 2 : 0,
    [ox, oz] = turn(0, -back, rot),
    q = { ...B, x: r2(L.x + ox), z: r2(L.z + oz) };
  if (B.k === 'well') q.x = r2(L.x);
  if (B.k === 'well') q.z = r2(L.z);
  if (Math.abs(rot) > 0.05) q.rot = rot;
  else delete q.rot;
  if (bx && (bx[0] * s > L.w + 0.01 || bx[1] * s > L.d + 0.01))
    throw new Error(`${B.k} (${bx[0] * s} x ${bx[1] * s} m) doesn't fit its ${L.k} plot (${L.w} x ${L.d} m)`);
  return q;
}
for (const [B, L] of pairs) {
  const N = place(B, L);
  props.push(N);
  if (B.act === 'fly') {
    const ship = OLD.find(p => p.k === 'airship');
    props.push({ ...ship, x: N.x, z: N.z, ...(N.rot ? { rot: N.rot } : {}) });
  }
  if (C[N.k] && C[N.k].door) {
    const dx = (C[N.k].door.x / PPU) * (N.s || 1) * (N.f ? -1 : 1),
      [ax, az] = world(N, dx, 0),
      [fx, fz] = turn(0, -1, N.rot || 0);
    doorFronts.push([ax, az, fx, fz]);
  }
  for (const p of garden.get(B) || []) {
    const [lx, lz] = own(B, p.x, p.z),
      [x, z] = world(N, lx, lz),
      M = C[p.k] || {},
      q = { ...p, x: r2(x), z: r2(z) };
    /* a model or a thing with a footprint turns with its building; a picture keeps facing you */
    if (M.box || M.model) {
      const r = norm((p.rot || 0) + (N.rot || 0) - (B.rot || 0));
      if (Math.abs(r) > 0.05) q.rot = r;
      else delete q.rot;
    }
    q._from = L.i;
    props.push(q);
  }
}
/* the farm patch's crops by the barn, the barn in its zone beside the pasture */
const barnZone = G.zones.find(Z => Z.k === 'barn'),
  pasture = G.zones.find(Z => Z.k === 'pasture'),
  mid = poly => poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]),
  farm = plotOf('farmhouse');
{
  const B = oldBuildings.find(b => b.act === 'ranch'),
    [cx, cz] = mid(barnZone.poly),
    /* its doors toward the farmhouse */
    a = Math.atan2(farm.z - cz, farm.x - cx) / RAD,
    L = { k: 'barn', x: cx, z: cz, w: 12, d: 12, a, i: -1 };
  const N = place(B, L);
  props.push(N);
  const dx = (C.barn.door.x / PPU) * (N.s || 1),
    [ax, az] = world(N, dx, 0),
    [fx, fz] = turn(0, -1, N.rot || 0);
  doorFronts.push([ax, az, fx, fz]);
  for (const p of garden.get(B) || []) {
    const [lx, lz] = own(B, p.x, p.z),
      [x, z] = world(N, lx, lz),
      M = C[p.k] || {},
      q = { ...p, x: r2(x), z: r2(z) };
    if (M.box || M.model) {
      const r = norm((p.rot || 0) + (N.rot || 0));
      if (Math.abs(r) > 0.05) q.rot = r;
      else delete q.rot;
    }
    q._from = -1;
    props.push(q);
  }
}
/* the signpost at the square, on the side away from the lab */
{
  const S = OLD.find(p => p.k === 'signpost'),
    lab = plotOf('lab'),
    dx = well.x - lab.x,
    dz = well.z - lab.z,
    l = Math.hypot(dx, dz) || 1;
  props.push({ ...S, x: r2(well.x + (dx / l) * 4.5), z: r2(well.z + (dz / l) * 4.5 + 2.5) });
}
/* a few of the old town's trees on open ground in the town, away from its plots and streets */
{
  const trees = loose
      .filter(p => /^tree_(oak|blossom|fruit|chestnut|beech)/.test(p.k))
      .sort((a, b) => a.x - b.x || a.z - b.z),
    spots = [];
  for (let k = 0; k < 4000 && spots.length < 8; k++) {
    const h = hashString('copperleaf town trees ' + k),
      x = townZone.poly.reduce((m, p) => Math.min(m, p[0]), 1e9) + ((h % 1000) / 1000) * 100,
      z = townZone.poly.reduce((m, p) => Math.min(m, p[1]), 1e9) + ((Math.floor(h / 1000) % 1000) / 1000) * 90;
    if (!islandPointIn(townZone.poly, x, z) || !'gGE'.includes(tileAt(x, z))) continue;
    if (plots.some(L => inPlot(L, x, z, 3)) || spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 9)) continue;
    let near = false;
    for (let a = 0; a < 8 && !near; a++)
      near =
        STREET.includes(tileAt(x + Math.cos(a * 0.785) * 3, z + Math.sin(a * 0.785) * 3)) ||
        WATER.includes(tileAt(x + Math.cos(a * 0.785) * 3, z + Math.sin(a * 0.785) * 3));
    if (near) continue;
    spots.push([x, z]);
  }
  spots.forEach((s, i) => trees[i] && props.push({ ...trees[i], x: r2(s[0]), z: r2(s[1]) }));
}

/* ---------- what can't stand where it landed ---------- */
const kept = props.filter(p => {
  if (p._from === undefined) return true;
  const t = tileAt(p.x, p.z);
  if (STREET.includes(t)) return !++left.street;
  if (WATER.includes(t) || onBridge(p.x, p.z)) return !++left.water;
  if (plots.some(L => L.i !== p._from && inPlot(L, p.x, p.z, 0.3))) return !++left.plot;
  /* nothing in front of a door: 1.6 m either side of it, 3 m out */
  for (const [ax, az, fx, fz] of doorFronts) {
    const u = (p.x - ax) * fx + (p.z - az) * fz,
      v = -(p.x - ax) * fz + (p.z - az) * fx;
    if (u > -0.5 && u < 3 && Math.abs(v) < 1.6) return !++left.door;
  }
  return true;
});
for (const p of kept) delete p._from;

/* ---------- the dock: a walkable pier from the landing out along the deep channel ---------- */
const dock = (G.spots || []).find(s => s.kind === 'dock'),
  bridgesOut = (G.bridges || []).filter(b => !b.pier);
if (dock) {
  let best = null;
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2,
      ux = Math.cos(a),
      uz = Math.sin(a);
    let wet = 0,
      deep = 0;
    for (let d = 1; d <= 9; d++) {
      const t = tileAt(dock.x + ux * d, dock.z + uz * d);
      if ('wd'.includes(t)) wet++;
      if (t === 'd') deep++;
    }
    const score = wet * 2 + deep;
    if (!best || score > best.score) best = { score, ux, uz };
  }
  /* it starts a step inland of the landing, on the land, so you walk onto it */
  bridgesOut.push({
    a: [r2(dock.x - best.ux * 1), r2(dock.z - best.uz * 1)],
    b: [r2(dock.x + best.ux * 7), r2(dock.z + best.uz * 7)],
    w: 1.7,
    kind: 'wood',
    pier: 1,
  });
}

/* ---------- people, their spots, the animals ---------- */
const front = (k, out = 2.4, side = 0) => {
  const L = plotOf(k),
    a = L.a * RAD;
  return [
    r2(L.x + Math.cos(a) * (L.d / 2 + out) - Math.sin(a) * side),
    r2(L.z + Math.sin(a) * (L.d / 2 + out) + Math.cos(a) * side),
  ];
};
const people = TOWN.people.map(P => {
  const at = P.who === 'juniper' ? front('home', 1.4, 1.6) : [P.x, P.z];
  return { ...P, x: at[0], z: at[1] };
});
const npcSpots = [
  front('lab', 2.5),
  front('mast', 2.5),
  [r2(well.x - 3), r2(well.z + 2.5)],
  front('shop', 2.2),
  front('home', 1.4, 1.6),
];
const box = (x, z, r) => [r2(x - r), r2(z - r), r2(x + r), r2(z + r)],
  bboxOf = poly => [
    r2(Math.min(...poly.map(p => p[0]))),
    r2(Math.min(...poly.map(p => p[1]))),
    r2(Math.max(...poly.map(p => p[0]))),
    r2(Math.max(...poly.map(p => p[1]))),
  ],
  pond = (G.spots || []).find(s => s.kind === 'pond'),
  forest = G.zones.find(Z => Z.k === 'forest');
const AREA = {
  duck: pond ? box(pond.x, pond.z, 7) : null,
  chicken: box(farm.x, farm.z, 8),
  rabbit: bboxOf(pasture.poly),
  squirrel: forest ? bboxOf(forest.poly) : null,
  cat: box(well.x, well.z, 26),
};
const life = TOWN.life.map(L => {
  const { area, ...rest } = L;
  return AREA[L.k] ? { ...rest, area: AREA[L.k] } : rest;
});

/* ---------- the map ---------- */
const GROUND = [
  'w',
  'h',
  'edge',
  'waterKind',
  'far',
  'farH',
  'flatFar',
  'cam',
  'island',
  'zones',
  'islandGen',
  'hub',
  'exits',
  'tiles',
  'heights',
  'plots',
  'streams',
  'spots',
  'steps',
  'stepm',
  'grassPatches',
  'checks',
];
const sc = {};
for (const k of [
  'name',
  'sky',
  'haze',
  'hazeD',
  'blur',
  'amb',
  'tint',
  'indoor',
  'folk',
  'kind',
  'locationId',
  'wind',
  'a04place',
  'biome',
  'chat',
])
  if (k in TOWN) sc[k] = TOWN[k];
for (const k of GROUND) if (k in G) sc[k] = G[k];
Object.assign(sc, { edgeExits: [], bridges: bridgesOut, props: kept, people, npcSpots, life });
/* the walking checks are the island's (build-island.mjs: from the square to each plot's front, the barn, the summit,
   the dock); the in-game full test walks from the hub to every door besides (self-test.js stGeometry) */
const bad = islandProblems(sc);
if (bad.length) {
  console.error('copperleaf: the island fails its checks:\n  ' + bad.join('\n  '));
  process.exit(1);
}
D.maps.copperleaf = sc;
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});
const n = k => kept.filter(p => p.k === k).length;
console.log(
  `wrote game/data/maps/copperleaf.json: ${sc.w} x ${sc.h} m, ${kept.length} props (${pairs.length + 1} buildings: ` +
    `${n('cottage_moss') + n('cottage_solar')} cottages), ${people.length} people; left out: ${left.street} on streets, ` +
    `${left.water} in water, ${left.plot} on other plots, ${left.door} before doors; ${loose.length} props of the old ` +
    `town belonged to no building (IS-9 dresses the island)`
);
