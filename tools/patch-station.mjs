// Skyline Station in Copperleaf (game/data/maps/copperleaf.json), placed without building the whole map again
// (tools/build-copperleaf.mjs moves the dressing's trees each run). The owner (2026-10-28): not tucked into a corner by
// the edge but somewhere natural: inland, on the open heather north of the library, between the river path, the shop
// and the inn, a short walk from the square. Its front (the steps) faces east, out from the island's middle, where the
// hub's orbit camera looks in from, so you see its platform side; its own track runs north-south behind it, with no
// piece out of its right-hand end (it would run into the inn): the trains glide in from the south over the bay and lift
// off on their engines. The portal floats high over the town's east side, out toward the sea (far enough to read as
// the sky's, near enough to stand clear of the haze). Its plot, the ground under it levelled to the
// plot's level, a path from the street to its steps, the portal (tools/station-place.mjs), the landmarks (island-gen.js
// stationLandmarks), the walking check to its steps, what stood in the way taken out, the dressing laid again.
// Rerunnable: the same map comes out.
//
//   node tools/patch-station.mjs
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readGameData, ROOT } from './data-files.mjs';
import { stationLandmarks } from '../game/js/logic/island-gen.js';
import { stationProps } from './station-place.mjs';
import { islandDress } from './island-dress.mjs';

/** the plot: its middle, its front's angle (0: facing east) */
const PLOT = { x: 124.0, z: 83.0, a: 0 };
/** the station's own track and portal (SKY_RAIL's tear: along the front from the track's start, out in front of the
    track, its middle's height) */
const RAIL = { looks: [], tear: [-2, 44, 24] };
/** metres of level ground round the footprint, and the path from the street to the steps (rectangles x0, x1, z0, z1) */
const LEVEL_PAD = 1;
const APRON = [
  [117, 129, 77, 78],
  [129, 131, 77, 85],
];
const D = readGameData(),
  C = D.scenery.props,
  M = D.maps.copperleaf,
  r2 = v => Math.round(v * 100) / 100,
  L = M.plots.find(p => p.k === 'station');
if (!L) throw new Error('copperleaf has no station plot');
Object.assign(L, PLOT);
const [bw, bd] = C.train_station.box,
  rot = Math.round(((((L.a + 90 + 180) % 360) + 360) % 360) - 180),
  R = (rot * Math.PI) / 180,
  st = M.props.find(p => p.k === 'train_station');
/* the base point (the middle of its front) half its depth in front of the plot's middle, as build-copperleaf.mjs place() */
Object.assign(st, { x: r2(L.x + Math.sin(R) * (bd / 2)), z: r2(L.z - Math.cos(R) * (bd / 2)) });
if (rot) st.rot = rot;
else delete st.rot;
/* the ground: flat at the plot's level under the station (its plot's rectangle and LEVEL_PAD round it), meadow there;
   the plot's level is the mean of the ground it stands on */
const inPlot = (x, z, m) => {
  const a = (L.a * Math.PI) / 180,
    dx = x - L.x,
    dz = z - L.z,
    u = dx * Math.cos(a) + dz * Math.sin(a),
    v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= L.d / 2 + m && Math.abs(v) <= L.w / 2 + m;
};
{
  let sum = 0,
    n = 0;
  for (let z = Math.floor(L.z - 10); z <= L.z + 10; z++)
    for (let x = Math.floor(L.x - 10); x <= L.x + 10; x++)
      if (inPlot(x, z, 0)) {
        sum += +M.heights[M.h - z][x];
        n++;
      }
  L.y = r2(sum / n);
}
for (let z = Math.floor(L.z - 12); z <= L.z + 12; z++)
  for (let x = Math.floor(L.x - 12); x <= L.x + 12; x++) {
    if (inPlot(x, z, LEVEL_PAD)) M.heights[M.h - z][x] = L.y;
    if (inPlot(x + 0.5, z + 0.5, 0.5)) {
      const i = M.h - 1 - z;
      M.tiles[i] = M.tiles[i].slice(0, x) + 'g' + M.tiles[i].slice(x + 1);
    }
  }
/* the path from the street to the steps, its ground eased to the plot's level */
for (const [x0, x1, z0, z1] of APRON) {
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      const i = M.h - 1 - z;
      M.tiles[i] = M.tiles[i].slice(0, x) + 'p' + M.tiles[i].slice(x + 1);
    }
  for (let z = z0; z <= z1 + 1; z++)
    for (let x = x0; x <= x1 + 1; x++) {
      const row = M.heights[M.h - z];
      row[x] = r2((row[x] + L.y) / 2);
    }
}
/* the station's own props again: the track and the portal */
const rest = M.props.filter(p => p.k !== 'sky_rail' && p.k !== 'sky_portal'),
  mine = stationProps(st, L, C, bd, RAIL),
  own = (x, z) => {
    const dx = x - st.x,
      dz = z - st.z;
    return [dx * Math.cos(R) + dz * Math.sin(R), -dx * Math.sin(R) + dz * Math.cos(R)];
  },
  /* in the way: on the footprint (and 0.6 m round), or within 2 m of the track's line out of the right-hand end */
  inWay = p => {
    if (p === st) return false;
    const [u, w] = own(p.x, p.z);
    if (Math.abs(u) < bw / 2 + 0.6 && w > -2.5 && w < bd + 0.6) return true;
    /* the way the trains glide in from: no tree over the track's line past its left-hand end */
    return u < -bw / 2 && u > -bw / 2 - 10 && Math.abs(w - (bd / 2 + 2.8)) < 2.5 && /^tree/.test(p.k);
  },
  gone = rest.filter(inWay);
M.props = rest.filter(p => !inWay(p));
M.props.splice(M.props.indexOf(st) + 1, 0, ...mine);
M.landmarks = stationLandmarks({ x: L.x, z: L.z, a: (L.a * Math.PI) / 180, y: L.y }, RAIL);
/* the walking check to its door: the foot of its steps */
const door = M.checks.find(c => /station's door/.test(c.what));
if (door) door.to = [r2(st.x + Math.sin(R) * 1.6), r2(st.z - Math.cos(R) * 1.6)];
/* the dressing reads the ground (a street, the square), so it is laid again as build-copperleaf.mjs lays it, last */
{
  const town = M.props.filter(p => !p.dress),
    O = JSON.parse(readFileSync(join(ROOT, 'tools/data/copperleaf-town.json'), 'utf8')).dress || {};
  M.props = [...town, ...islandDress({ ...M, props: town }, D.scenery, O).props];
}
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log(
  `copperleaf: the station at ${st.x}, ${st.z} turned ${rot}, its track and the portal (${mine.length} props); ` +
    `taken out of the way: ${gone.map(p => p.k).join(', ') || 'nothing'}`
);
