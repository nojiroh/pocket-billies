// Water track WA-10: a small hand patch to the hub's map (game/data/maps/copperleaf.json) inside its locked town
// zone, the owner's choice (an unlocked rebuild makes the town again differently: 19 plots of 22, three buildings
// lost). The ground stays locked; only what is named below changes. Rerunnable: a second run changes nothing.
//
//   node tools/patch-copperleaf-water.mjs --river    # the pond's outflow: a slope with a little rapids, no fall
//
// --river: the river left the pond by a 0.45 m drop over its first metre (island-gen.js, the dial stream.fall 0.8,
// capped), which the walk view drew as a staircase of fall sheets. Its bed now ramps from the pond's level down to the
// bed as it was RIVER_RAMP metres along the line, eased; the banks beside the ramp stay 0.25 m over it; the dial
// stream.fall is set to 0 (what a rebuild of an unlocked town would make), the `fall` spot to the river's start, and
// the ramp is marked as rapids on the stream (water-flow.js: faster, white water along the middle).
// (WA-10's --square, the square paved to about 8 m, is now hub track HB-10a's tools/patch-copperleaf-square.mjs.)
// Written through tools/write-data.mjs, as every build tool writes the data.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readGameData, ROOT } from './data-files.mjs';
import { islandDress } from './island-dress.mjs';

const RIVER_RAMP = 6; /* metres of the river's line the ramp takes */
const RIVER_HALF = 1.5; /* the river's half width (island-gen.js ISLAND_RIVER_W / 2) */

const D = readGameData(),
  M = D.maps.copperleaf,
  { w, h } = M,
  args = process.argv.slice(2);
if (!args.includes('--river')) {
  console.error('usage: node tools/patch-copperleaf-water.mjs --river');
  process.exit(1);
}
/* corner heights: rows from the far edge (island-gen.js islandDecodeGround), j counted from the south */
const H = (i, j) => +M.heights[h - j][i] || 0,
  setH = (i, j, v) => (M.heights[h - j][i] = Math.round(v * 100) / 100),
  tile = (i, j) => (M.tiles[h - 1 - j] || '')[i],
  setTile = (i, j, c) => {
    const r = M.tiles[h - 1 - j];
    M.tiles[h - 1 - j] = r.slice(0, i) + c + r.slice(i + 1);
  },
  smooth = f => f * f * (3 - 2 * f);
const notes = [];

/* the terrain patch's fall (tools/patch-copperleaf-terrain.mjs --pond) stands at the river's head: no ramp there */
const fallAtHead =
  M.streams[0] && (M.falls || []).some(f => Math.hypot(f.x - M.streams[0].pts[0][0], f.z - M.streams[0].pts[0][1]) < 4);
if (fallAtHead)
  notes.push('the river leaves the pond over its fall (patch-copperleaf-terrain.mjs --pond): its outflow stays');
if (args.includes('--river') && !fallAtHead) {
  const st = M.streams[0],
    p = st.pts,
    pond = M.spots.find(s => s.kind === 'pond');
  /* the pond's water level as the walk view lays it (ground-mesh.js: still water at the mean of its half-metre cells'
     ground less 0.12, the ground read as walk/heights.js rawHeightAt does); the river's bed starts 0.12 under it so
     its water leaves the pond at the pond's own level */
  const cr = (p0, p1, p2, p3, t) =>
      p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))),
    g = (a, b) => H(Math.max(0, Math.min(w, a)), Math.max(0, Math.min(h, b))),
    raw = (x, z) => {
      const i = Math.min(w - 1, Math.floor(x)),
        j = Math.min(h - 1, Math.floor(z)),
        u = x - i,
        v = z - j,
        r = [-1, 0, 1, 2].map(b => cr(g(i - 1, j + b), g(i, j + b), g(i + 1, j + b), g(i + 2, j + b), u)),
        q = [g(i, j), g(i + 1, j), g(i, j + 1), g(i + 1, j + 1)];
      return Math.max(Math.min(...q), Math.min(Math.max(...q), cr(r[0], r[1], r[2], r[3], v)));
    };
  let sum = 0,
    cells = 0;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const c = tile(i, j);
      if ((c !== 'w' && c !== 'd') || Math.hypot(i + 0.5 - pond.x, j + 0.5 - pond.z) > 4.5) continue;
      /* the river's own head (the patch raises it) is not the pond's */
      if (Math.hypot(i + 0.5 - p[0][0], j + 0.5 - p[0][1]) < RIVER_HALF + 1) continue;
      for (const [a, b] of [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
      ]) {
        sum += raw(i + a, j + b);
        cells++;
      }
    }
  const lvl = Math.round((sum / cells) * 100) / 100;
  /* the line every 0.25 m, how far along it each point lies */
  const P = [];
  let acc = 0;
  for (let k = 0; k < p.length - 1; k++) {
    const l = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
    for (let t = 0; t < l; t += 0.25)
      P.push([p[k][0] + ((p[k + 1][0] - p[k][0]) * t) / l, p[k][1] + ((p[k + 1][1] - p[k][1]) * t) / l, acc + t]);
    acc += l;
  }
  const bedAt = (x, z) => H(Math.round(x), Math.round(z)),
    end = P.find(q => q[2] >= RIVER_RAMP),
    b6 = bedAt(end[0], end[1]),
    ramp = s => lvl - (lvl - b6) * smooth(Math.min(1, s / RIVER_RAMP));
  let bed = 0,
    bank = 0;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      /* the nearest point of the ramp's stretch (and a bank's width past it) */
      let best = Infinity,
        s = 0;
      for (const q of P) {
        if (q[2] > RIVER_RAMP + 1.5) break;
        const d = Math.hypot(i - q[0], j - q[1]);
        if (d < best) [best, s] = [d, q[2]];
      }
      if (best > RIVER_HALF + 1.5 || s > RIVER_RAMP) continue;
      /* the pond's own bed and flat rim (island-gen.js: level within its radius + 1.5 m) stay as they are */
      if (Math.hypot(i - pond.x, j - pond.z) < 5.5 && best > RIVER_HALF + 0.6) continue;
      const y = ramp(s),
        want = best <= RIVER_HALF + 0.6 ? y : y + 0.25;
      if (H(i, j) < want - 0.005) {
        setH(i, j, want);
        best <= RIVER_HALF + 0.6 ? bed++ : bank++;
      }
    }
  M.islandGen.dials.stream = { ...(M.islandGen.dials.stream || { on: 1, pond: 4 }), fall: 0 };
  /* marked as hand-patched, so island-gen.test does not ask for the generator's own ground */
  M.islandGen.patched = [...new Set([...(M.islandGen.patched || []), 'water --river'])];
  const fall = M.spots.find(s => s.kind === 'fall');
  if (fall) fall.y = Math.round(lvl * 100) / 100;
  st.rapids = [[0, Math.round((RIVER_RAMP / acc) * 100) / 100]];
  notes.push(
    `the river's outflow: ${bed} bed corners and ${bank} bank corners raised, from the pond's ${lvl} m (its water ` +
      `${Math.round((lvl - 0.12) * 100) / 100} m) to ${b6} m over ` +
      `${RIVER_RAMP} m; rapids ${JSON.stringify(st.rapids)}`
  );
}

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
