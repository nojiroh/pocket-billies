// Cutscenes track A: Skyline Station turned to face out to sea in Copperleaf (game/data/maps/copperleaf.json), without
// building the whole map again (tools/build-copperleaf.mjs moves the dressing's trees each run). The hub's orbit camera
// stands out over the sea looking in at the station, so it now shows its front, the platform side: its plot turned
// (logic/island-gen.js STATION_TURN 0) and moved onto the headland's length, the ground under it levelled (and a
// cutting for its track through the knoll behind), its track out of its right-hand end and the portal floating out in
// front (tools/station-place.mjs), the landmarks (island-gen.js stationLandmarks), what stood in the way taken out.
// Rerunnable: the same map comes out.
//
//   node tools/patch-station.mjs
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';
import { stationLandmarks } from '../game/js/logic/island-gen.js';
import { stationProps } from './station-place.mjs';

/** the plot: its middle on the headland, its front to the sea (east) */
const PLOT = { x: 164.0, z: 100.8, a: 0 };
/** the ground levelled to the plot's level: the station's footprint, and the cutting for the track behind it */
const LEVEL = [
  { x0: 160, x1: 167, z0: 94, z1: 107, set: true },
  { x0: 159, x1: 163, z0: 107, z1: 112, set: false },
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
/* the ground: flat at the plot's level under the station, cut down to it (never raised) along the track behind */
for (const A of LEVEL)
  for (let z = A.z0; z <= A.z1; z++)
    for (let x = A.x0; x <= A.x1; x++) {
      const row = M.heights[M.h - z];
      if (!row) continue;
      row[x] = A.set ? L.y : Math.min(row[x], L.y);
    }
for (let z = LEVEL[0].z0; z < LEVEL[0].z1; z++) {
  const i = M.h - 1 - z,
    s = M.tiles[i];
  M.tiles[i] = s.slice(0, LEVEL[0].x0) + 'g'.repeat(LEVEL[0].x1 - LEVEL[0].x0) + s.slice(LEVEL[0].x1);
}
/* the station's own props again: the track and the portal */
const rest = M.props.filter(p => p.k !== 'sky_rail' && p.k !== 'sky_portal'),
  mine = stationProps(st, L, C, bd),
  own = (x, z) => {
    const dx = x - st.x,
      dz = z - st.z;
    return [dx * Math.cos(R) + dz * Math.sin(R), -dx * Math.sin(R) + dz * Math.cos(R)];
  },
  /* in the way: on the footprint (and 0.6 m round), or within 2 m of the track's line out of the right-hand end */
  inWay = p => {
    if (p === st) return false;
    const [u, w] = own(p.x, p.z);
    if (Math.abs(u) < bw / 2 + 0.6 && w > -1.5 && w < bd + 0.6) return true;
    return u > bw / 2 && u < bw / 2 + 12.5 && Math.abs(w - (bd / 2 + 2.8)) < 2;
  },
  gone = rest.filter(inWay);
M.props = rest.filter(p => !inWay(p));
M.props.splice(M.props.indexOf(st) + 1, 0, ...mine);
M.landmarks = stationLandmarks({ x: L.x, z: L.z, a: (L.a * Math.PI) / 180, y: L.y });
execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
  input: JSON.stringify(D),
  stdio: ['pipe', 'inherit', 'inherit'],
});
console.log(
  `copperleaf: the station at ${st.x}, ${st.z} turned ${rot}, its track and the portal (${mine.length} props); ` +
    `taken out of the way: ${gone.map(p => p.k).join(', ') || 'nothing'}`
);
