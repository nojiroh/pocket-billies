// Island track IS-2: writes an island map made by the island generator (game/js/logic/island-gen.js) into the game data.
// The dials and seed are the map's own islandGen when it exists (so a rerun makes the same ground), else the
// generator's defaults; --seed and --dials change them. A map whose ground is locked (islandGen.lock) is never made
// again: the tool stops. Its locked zones are kept exactly unless --fresh is given.
//
//   node tools/build-island.mjs                       # game/data/maps/copperleaf_island.json, seed "copperleaf"
//   node tools/build-island.mjs --seed hello          # another seed (the locked zones stay)
//   node tools/build-island.mjs --dials d.json        # dials from a file (any left out: the defaults)
//   node tools/build-island.mjs --id test_isle --fresh
//
// The look (sky, haze, wind) is Copperleaf's; the map is a test map (kind test, test: 1) until IS-5 moves the town onto
// it. Written through tools/write-data.mjs, as every build tool writes the data.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';
import { islandGenerate, ISLAND_GEN_BUILT } from '../game/js/logic/island-gen.js';
import { islandProblems } from '../game/js/logic/island.js';

const args = process.argv.slice(2),
  opt = k => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : undefined;
  };
const ID = opt('--id') || 'copperleaf_island',
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
    : (prev && prev.islandGen && prev.islandGen.dials) || {},
  seed = opt('--seed') || (prev && prev.islandGen && prev.islandGen.seed) || 'copperleaf';
const { scene: sc, notes, paths } = islandGenerate(dials, seed, { scenery: D.scenery }, FRESH ? null : prev);

/* Copperleaf's look, the walking checks for the in-game test */
const look = D.maps.copperleaf || {};
for (const k of ['sky', 'haze', 'hazeD', 'amb', 'wind', 'blur', 'tint', 'indoor']) if (k in look) sc[k] = look[k];
sc.name = ID === 'copperleaf_island' ? 'Copperleaf island (generated ground)' : `Island ${ID}`;
sc.folk = 0;
const mid = poly => poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]),
  r2 = v => Math.round(v * 100) / 100,
  spot = k => (sc.spots || []).find(s => s.kind === k);
sc.checks = [
  ...sc.zones
    .filter(Z => ISLAND_GEN_BUILT.includes(Z.k) && Z.k !== 'town')
    .map(Z => ({ from: sc.hub, to: mid(Z.poly).map(r2), reach: true, what: `from the town to the ${Z.k}` })),
  ...['summit', 'dock']
    .map(spot)
    .filter(Boolean)
    .map(s => ({ from: sc.hub, to: [s.x, s.z], reach: true, what: `from the town to the ${s.kind}` })),
  { from: sc.hub, to: [4, 4], reach: false, what: 'out into the sea' },
];

const bad = islandProblems(sc);
if (bad.length) {
  console.error(`${ID}: the island fails its checks:\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
D.maps[ID] = sc;
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
