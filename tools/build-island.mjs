// Island track IS-2: writes an island map made by the island generator (game/js/logic/island-gen.js) into the game data.
// The dials and seed are the map's own islandGen when it exists (so a rerun makes the same ground), else the
// generator's defaults; --seed and --dials change them. A map whose ground is locked (islandGen.lock) is never made
// again: the tool stops. Its locked zones are kept exactly unless --fresh is given.
//
//   node tools/build-island.mjs                       # the hub's ground: game/data/maps/copperleaf.json, seed "copperleaf"
//   node tools/build-island.mjs --seed hello          # another seed (the locked zones stay)
//   node tools/build-island.mjs --dials d.json        # dials from a file (any left out: the defaults)
//   node tools/build-island.mjs --defaults --fresh    # the generator's current defaults, nothing kept
//   node tools/build-island.mjs --id test_isle --fresh
//
// A new map is a test map (kind test, test: 1) with Copperleaf's look (sky, haze, wind). IS-5: a place's map (the hub,
// copperleaf) keeps everything but its ground: its name, buildings, people, life and its pier; only the ground fields
// (GROUND below) are made again. The town stands on the plots, so after a new ground run
// node tools/build-copperleaf.mjs to put it on them again. Written through tools/write-data.mjs, as every build tool
// writes the data.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';
import { islandGenerate } from '../game/js/logic/island-gen.js';
import { islandProblems } from '../game/js/logic/island.js';
import { mapgenReach } from '../game/js/logic/mapgen.js';

const args = process.argv.slice(2),
  opt = k => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
const ID = opt('--id') || 'copperleaf',
  FRESH = args.includes('--fresh'),
  WALK_SPEED = 3.4; /* walk-view.js */

const D = readGameData(),
  prev = D.maps[ID] || null;
if (prev && prev.islandGen && prev.islandGen.lock) {
  console.error(`${ID}: the ground is locked (islandGen.lock); unlock it in the Studio's Hub island editor first`);
  process.exit(1);
}
const dials = opt('--dials')
    ? JSON.parse(readFileSync(opt('--dials'), 'utf8'))
    : args.includes('--defaults')
      ? {}
      : (prev && prev.islandGen && prev.islandGen.dials) || {},
  seed = opt('--seed') || (prev && prev.islandGen && prev.islandGen.seed) || 'copperleaf';
const { scene: sc, notes, paths, landmarks } = islandGenerate(dials, seed, { scenery: D.scenery }, FRESH ? null : prev);
/* HB-4b: the station's sky rail and its portal (landmarks.on), [x, z, y] each: the rail runs on past the map's edge out
   over the sea (HB-7 draws it in the sea's skirt) */
if (landmarks) sc.landmarks = landmarks;

/* IS-5: what the generator makes (the rest of a place's map is its own) */
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
  'bridges',
  'landmarks',
];
const place = !!(prev && prev.locationId);
if (place) {
  for (const k of Object.keys(prev)) if (!GROUND.includes(k)) sc[k] = prev[k];
  for (const k of ['kind', 'test']) if (!(k in prev)) delete sc[k];
  /* its pier is the town's (build-copperleaf.mjs), not the generator's */
  const same = b => JSON.stringify(b),
    have = new Set((sc.bridges || []).map(same));
  sc.bridges = [...(sc.bridges || []), ...(prev.bridges || []).filter(b => b.pier && !have.has(same(b)))];
} else {
  /* Copperleaf's look, the walking checks for the in-game test */
  const look = D.maps.copperleaf || {};
  for (const k of ['sky', 'haze', 'hazeD', 'amb', 'wind', 'blur', 'tint', 'indoor']) if (k in look) sc[k] = look[k];
  sc.name = `Island ${ID}`;
  sc.folk = 0;
}
const mid = poly => poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]),
  r2 = v => Math.round(v * 100) / 100,
  spot = k => (sc.spots || []).find(s => s.kind === k),
  up = paths.find(p => p.name === 'town main street') || paths.find(p => p.name === 'town to the mountain'),
  foot = up && (up.name === 'town main street' ? up.pts[0] : up.pts[up.pts.length - 1]),
  summit = spot('summit'),
  dock = spot('dock'),
  /* a plot's front: a step out from the middle of the side it faces */
  front = L => {
    const a = (L.a * Math.PI) / 180;
    return [r2(L.x + Math.cos(a) * (L.d / 2 + 0.9)), r2(L.z + Math.sin(a) * (L.d / 2 + 0.9))];
  };
/* the game's findPath gives up after 30000 cells, a fraction of this map: a long walk is checked in legs of about 40 m
   along the way the walk grid finds (the same rules as the game's: water, slopes, steps), each leg by the game itself */
const legs = (from, to, what) => {
  const R = mapgenReach(sc, D.scenery, from, { slope: true }),
    { N, gw, gh, dist, step } = R,
    cell = p =>
      Math.min(gh - 1, Math.max(0, Math.floor(p[1] * N))) * gw + Math.min(gw - 1, Math.max(0, Math.floor(p[0] * N)));
  let q = cell(to);
  if (dist[q] < 0) return [{ from, to, reach: true, what }];
  const way = [q];
  while (dist[q] > 0) {
    const i = q % gw,
      j = Math.floor(q / gw),
      prev = [
        [i + 1, j],
        [i - 1, j],
        [i, j + 1],
        [i, j - 1],
      ]
        .filter(([a, b]) => a >= 0 && b >= 0 && a < gw && b < gh)
        .map(([a, b]) => b * gw + a)
        .find(n => dist[n] === dist[q] - 1 && step(n, q));
    if (prev === undefined) break;
    way.push((q = prev));
  }
  way.reverse();
  const at = c => [r2(((c % gw) + 0.5) / N), r2((Math.floor(c / gw) + 0.5) / N)],
    marks = [from];
  for (let k = 80; k < way.length - 20; k += 80) marks.push(at(way[k]));
  marks.push(to);
  return marks.slice(1).map((p, k) => ({
    from: marks[k],
    to: p,
    reach: true,
    what: marks.length > 2 ? `${what} (${k + 1} of ${marks.length - 1})` : what,
  }));
};
sc.checks = [
  ...sc.zones
    .filter(Z => ['barn', 'pasture', 'hamlet'].includes(Z.k))
    .flatMap(Z => legs(sc.hub, mid(Z.poly).map(r2), `from the town to the ${Z.k}`)),
  ...(sc.plots || [])
    .filter(L =>
      ['lab', 'mast', 'home', 'shop', 'farmhouse', 'inn', 'library', 'workshop', 'genebank', 'station'].includes(L.k)
    )
    .flatMap(L => legs(sc.hub, front(L), `from the square to the ${L.k}'s door`)),
  ...(foot && summit
    ? [
        ...legs(sc.hub, foot, "from the town to the trail's foot"),
        ...legs(foot, [summit.x, summit.z], 'up the trail from its foot to the summit'),
      ]
    : []),
  ...(dock ? legs(sc.hub, [dock.x, dock.z], 'from the town to the dock') : []),
  { from: sc.hub, to: [4, 4], reach: false, what: 'out into the sea' },
];

const bad = islandProblems(sc);
if (bad.length) {
  console.error(`${ID}: the island fails its checks:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
/* a place keeps its own order of fields, so a rerun that changes nothing writes nothing */
D.maps[ID] = place
  ? Object.fromEntries(
      [...Object.keys(prev), ...Object.keys(sc)].filter((k, i, a) => a.indexOf(k) === i && k in sc).map(k => [k, sc[k]])
    )
  : sc;
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});

const loop = paths.find(p => p.name === 'loop'),
  lap = loop.pts.reduce((L, p, i) => (i ? L + Math.hypot(p[0] - loop.pts[i - 1][0], p[1] - loop.pts[i - 1][1]) : 0), 0),
  xs = sc.island.coast.map(p => p[0]),
  zs = sc.island.coast.map(p => p[1]);
console.log(
  `wrote game/data/maps/${ID}.json: ${sc.w} x ${sc.h} m, land ${Math.round(Math.max(...xs) - Math.min(...xs))} x ` +
    `${Math.round(Math.max(...zs) - Math.min(...zs))} m, seed "${seed}"; the coast loop ${Math.round(lap)} m ` +
    `(${Math.round(lap / WALK_SPEED)} s walking); ${(sc.bridges || []).length} bridge(s); ` +
    `${Math.round(JSON.stringify(sc).length / 1024)} KB`
);
for (const n of notes) console.log('  note: ' + n);
if (place)
  console.log(`  ${ID}'s town, people and life kept: node tools/build-copperleaf.mjs puts the town on the new plots`);
