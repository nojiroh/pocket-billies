// Water track WA-10: a small hand patch to the hub's map (game/data/maps/copperleaf.json) inside its locked town
// zone, the owner's choice (an unlocked rebuild makes the town again differently: 19 plots of 22, three buildings
// lost). The ground stays locked; only what is named below changes. Rerunnable: a second run changes nothing.
//
//   node tools/patch-copperleaf-water.mjs --river    # the pond's outflow: a slope with a little rapids, no fall
//   node tools/patch-copperleaf-water.mjs --bridge   # the bridge below the pond's fall moved down the river
//   node tools/patch-copperleaf-water.mjs --unfeed   # the spring stream into the pond taken away
//
// --river: the river left the pond by a 0.45 m drop over its first metre (island-gen.js, the dial stream.fall 0.8,
// capped), which the walk view drew as a staircase of fall sheets. Its bed now ramps from the pond's level down to the
// bed as it was RIVER_RAMP metres along the line, eased; the banks beside the ramp stay 0.25 m over it; the dial
// stream.fall is set to 0 (what a rebuild of an unlocked town would make), the `fall` spot to the river's start, and
// the ramp is marked as rapids on the stream (water-flow.js: faster, white water along the middle).
// --bridge (the owner, 2026-10-29: "the bridge under the waterfall is too close"): the bridge across the river by the
// pond's fall stood over its plunge pool, its middle 2 m from the lip. It moves BRIDGE_DOWN metres further down the
// river's line, square across the water there and centred on it, at least as long as it was; a path ('p') is laid
// from each end to the nearest path tile. A bridge already more than BRIDGE_NEAR metres from the lip is left alone.
// --unfeed (the owner, 2026-10-29: "water above the pond for no reason"): the thin stream from a spring into the pond
// (patch-copperleaf-terrain.mjs --pond, its FEED) starts 1 m below the pond's water, across a dip of 2.3-2.8 m between
// the mountain's foot and the pond's terrace, so its level floated up to 2.3 m over the ground. The owner chose to take
// it away: the stream entry goes, its channel's water tiles (within FEED_HALF metres of its line) take the commonest
// dry tile round them, and its carved bed is filled from the ground beside it (never lowered).
// (WA-10's --square, the square paved to about 8 m, is now hub track HB-10a's tools/patch-copperleaf-square.mjs.)
// Written through tools/write-data.mjs, as every build tool writes the data.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { readGameData, ROOT } from './data-files.mjs';
import { islandDress } from './island-dress.mjs';

const RIVER_RAMP = 6; /* metres of the river's line the ramp takes */
const RIVER_HALF = 1.5; /* the river's half width (island-gen.js ISLAND_RIVER_W / 2) */
const BRIDGE_DOWN = 5; /* metres the bridge moves down the river */
const BRIDGE_NEAR = 4; /* a bridge whose middle is this close to the fall's lip is the one moved (m) */
const BRIDGE_PATH = 8; /* how far from an end a path tile is looked for (m) */
const FEED_HALF = 0.75; /* the spring stream's channel: its water tiles this close to its line (the terrain patch's) */
const FEED_FILL = [1.1, 2.4]; /* its bed is filled from the corners this far from its line (m) */

const D = readGameData(),
  M = D.maps.copperleaf,
  { w, h } = M,
  args = process.argv.slice(2);
if (!['--river', '--bridge', '--unfeed'].some(k => args.includes(k))) {
  console.error('usage: node tools/patch-copperleaf-water.mjs --river --bridge --unfeed');
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

if (args.includes('--bridge')) {
  const lip = (M.falls || [])[0],
    line = M.streams[0] && M.streams[0].pts,
    mid = b => [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2],
    B = lip && (M.bridges || []).find(b => !b.pier && Math.hypot(mid(b)[0] - lip.x, mid(b)[1] - lip.z) < BRIDGE_NEAR);
  if (!B || !line) notes.push('the bridge: none within ' + BRIDGE_NEAR + ' m of the fall (moved already)');
  else {
    /* where a point lies along the line (metres from its head), and the point and direction at a distance along it */
    const segs = [];
    for (let k = 0, acc = 0; k < line.length - 1; k++) {
      const [a, b] = [line[k], line[k + 1]],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a, d: [(b[0] - a[0]) / l, (b[1] - a[1]) / l], l, s: acc });
      acc += l;
    }
    const along = (x, z) => {
        let best = Infinity,
          s = 0;
        for (const g of segs) {
          const t = Math.max(0, Math.min(g.l, (x - g.a[0]) * g.d[0] + (z - g.a[1]) * g.d[1])),
            d = Math.hypot(g.a[0] + g.d[0] * t - x, g.a[1] + g.d[1] * t - z);
          if (d < best) [best, s] = [d, g.s + t];
        }
        return s;
      },
      at = s => {
        const g = segs.find(q => s <= q.s + q.l) || segs[segs.length - 1],
          t = s - g.s;
        return { p: [g.a[0] + g.d[0] * t, g.a[1] + g.d[1] * t], d: g.d };
      };
    const m0 = mid(B),
      len = Math.hypot(B.b[0] - B.a[0], B.b[1] - B.a[1]),
      { p, d } = at(along(m0[0], m0[1]) + BRIDGE_DOWN),
      n = [-d[1], d[0]],
      wet = (x, z) => 'wd'.includes(tile(Math.floor(x), Math.floor(z)) || '');
    /* the water's run across the river at p, every 5 cm: the bridge is centred on it and reaches 0.8 m onto each bank */
    let lo = 0,
      hi = 0;
    while (lo > -6 && wet(p[0] + n[0] * (lo - 0.05), p[1] + n[1] * (lo - 0.05))) lo -= 0.05;
    while (hi < 6 && wet(p[0] + n[0] * (hi + 0.05), p[1] + n[1] * (hi + 0.05))) hi += 0.05;
    const c = (lo + hi) / 2,
      half = Math.max(len / 2, (hi - lo) / 2 + 0.8),
      r2 = v => Math.round(v * 100) / 100,
      end = k => [r2(p[0] + n[0] * (c + k * half)), r2(p[1] + n[1] * (c + k * half))],
      was = { a: B.a, b: B.b };
    /* a keeps the side it had */
    const [ea, eb] = [end(1), end(-1)],
      sideA = (B.a[0] - m0[0]) * n[0] + (B.a[1] - m0[1]) * n[1] > 0;
    [B.a, B.b] = sideA ? [ea, eb] : [eb, ea];
    /* a path from each end to the nearest path tile, in a straight line over dry ground */
    let laid = 0;
    for (const e of [B.a, B.b]) {
      let best = null,
        bd = BRIDGE_PATH;
      for (let j = Math.floor(e[1] - BRIDGE_PATH); j <= e[1] + BRIDGE_PATH; j++)
        for (let i = Math.floor(e[0] - BRIDGE_PATH); i <= e[0] + BRIDGE_PATH; i++) {
          const dd = Math.hypot(i + 0.5 - e[0], j + 0.5 - e[1]);
          if (tile(i, j) === 'p' && dd < bd) [best, bd] = [[i + 0.5, j + 0.5], dd];
        }
      if (!best) continue;
      for (let t = 0; t <= bd; t += 0.25) {
        const i = Math.floor(e[0] + ((best[0] - e[0]) * t) / bd),
          j = Math.floor(e[1] + ((best[1] - e[1]) * t) / bd),
          ch = tile(i, j);
        if (!ch || 'wdpr'.includes(ch)) continue;
        setTile(i, j, 'p');
        laid++;
      }
    }
    M.islandGen.patched = [...new Set([...(M.islandGen.patched || []), 'water --bridge'])];
    notes.push(
      `the bridge: ${JSON.stringify(was)} -> ${JSON.stringify({ a: B.a, b: B.b })}, ${BRIDGE_DOWN} m down the river ` +
        `(its middle ${r2(Math.hypot(mid(B)[0] - lip.x, mid(B)[1] - lip.z))} m from the lip, was ` +
        `${r2(Math.hypot(m0[0] - lip.x, m0[1] - lip.z))} m); ${laid} path tiles laid to its ends`
    );
  }
}

if (args.includes('--unfeed')) {
  const k = M.streams.findIndex(s => s.src === 'spring' && s.mouth === 'lake'),
    F = k >= 0 ? M.streams[k].pts : null;
  if (!F) notes.push('the spring stream: none (taken away already)');
  else {
    const dist = (x, z) => {
      let b = Infinity;
      for (let n = 0; n < F.length - 1; n++) {
        const [a, c] = [F[n], F[n + 1]],
          l2 = (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2,
          t = Math.max(0, Math.min(1, ((x - a[0]) * (c[0] - a[0]) + (z - a[1]) * (c[1] - a[1])) / l2));
        b = Math.min(b, Math.hypot(a[0] + (c[0] - a[0]) * t - x, a[1] + (c[1] - a[1]) * t - z));
      }
      return b;
    };
    const [x0, x1, z0, z1] = [
      Math.floor(Math.min(...F.map(p => p[0])) - 4),
      Math.ceil(Math.max(...F.map(p => p[0])) + 4),
      Math.floor(Math.min(...F.map(p => p[1])) - 4),
      Math.ceil(Math.max(...F.map(p => p[1])) + 4),
    ];
    /* the channel's tiles, then each one the commonest dry tile among its neighbours that are not the channel */
    const chan = [];
    for (let j = z0; j <= z1; j++)
      for (let i = x0; i <= x1; i++) if (tile(i, j) === 'w' && dist(i + 0.5, j + 0.5) <= FEED_HALF) chan.push([i, j]);
    const inChan = new Set(chan.map(([i, j]) => i + ',' + j));
    for (const [i, j] of chan) {
      const count = {};
      for (let b = -1; b <= 1; b++)
        for (let a = -1; a <= 1; a++) {
          const ch = tile(i + a, j + b);
          if ((a || b) && ch && !'wd'.includes(ch) && !inChan.has(i + a + ',' + (j + b)))
            count[ch] = (count[ch] || 0) + 1;
        }
      const best = Object.entries(count).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))[0];
      setTile(i, j, best ? best[0] : 'G');
    }
    /* the bed: each corner the carve could reach takes the mean of the corners beside the channel, if that is higher */
    const fill = [];
    for (let j = z0; j <= z1; j++)
      for (let i = x0; i <= x1; i++) {
        if (dist(i, j) > 0.9) continue;
        let s = 0,
          c = 0;
        for (let b = -3; b <= 3; b++)
          for (let a = -3; a <= 3; a++) {
            const d = dist(i + a, j + b);
            if (d >= FEED_FILL[0] && d <= FEED_FILL[1] && Math.hypot(a, b) <= 3) {
              s += H(i + a, j + b);
              c++;
            }
          }
        if (c) fill.push([i, j, s / c]);
      }
    let raised = 0;
    for (const [i, j, v] of fill)
      if (v > H(i, j) + 0.005) {
        setH(i, j, v);
        raised++;
      }
    M.streams.splice(k, 1);
    M.islandGen.patched = [...new Set([...(M.islandGen.patched || []), 'water --unfeed'])];
    notes.push(`the spring stream taken away: ${chan.length} channel tiles dry again, ${raised} bed corners filled`);
  }
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
