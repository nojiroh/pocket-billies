// Hub track HB-4a: island sketches. Makes each direction in tools/data/hub-sketches.json with the island generator
// (game/js/logic/island-gen.js) in memory (the hub's own dials and seed with the direction's changes on top) and writes
// what tools/island-sketches.py draws: OUT/<id>.json (the ground, streets, plots, spots, zones, the pivot and each
// building's door against facing out from it). Nothing is written to the game data.
//
//   node tools/island-sketches.mjs OUT_DIR             # every direction
//   node tools/island-sketches.mjs OUT_DIR today b     # only these
//   node tools/island-sketches.mjs OUT_DIR --drafts    # also: each direction as a draft test map hb4a_<id> in the game
//                                                      # data, stand-in buildings on its plots, dressed (for the
//                                                      # from-above pictures, tools/island-shots.py --scene=hb4a_<id>)
//   node tools/island-sketches.mjs --clean             # the draft maps removed again (never commit them)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readGameData, ROOT } from './data-files.mjs';
import { islandDress } from './island-dress.mjs';
import { islandAngleDiff, islandDecodeGround, islandGenerate } from '../game/js/logic/island-gen.js';

const ARGS = process.argv.slice(2),
  DRAFTS = ARGS.includes('--drafts'),
  CLEAN = ARGS.includes('--clean'),
  [OUT = 'validation/hub-sketches', ...ONLY] = ARGS.filter(a => !a.startsWith('--'));
const writeData = D =>
  execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
    input: JSON.stringify(D),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
if (CLEAN) {
  const D0 = readGameData();
  for (const k of Object.keys(D0.maps)) if (k.startsWith('hb4a_')) delete D0.maps[k];
  writeData(D0);
  process.exit(0);
}
const D = readGameData(),
  hub = D.maps.copperleaf.islandGen,
  dirs = JSON.parse(readFileSync(join(ROOT, 'tools/data/hub-sketches.json'), 'utf8')).directions;
mkdirSync(OUT, { recursive: true });

/** the hub's dials with a direction's changes on top: objects merge one level down, everything else replaces */
const merge = (a, b) => {
  const o = structuredClone(a);
  for (const [k, v] of Object.entries(b || {}))
    o[k] = v && typeof v === 'object' && !Array.isArray(v) && o[k] && typeof o[k] === 'object' ? { ...o[k], ...v } : v;
  return o;
};

/* the stand-in model on each kind of plot (the new buildings' own models come in HB-5 and HB-7) */
const STAND_IN = {
  lab: 'lab',
  home: 'cottage_juniper',
  shop: 'shop',
  mast: 'airship_station',
  farmhouse: 'cottage_moss',
  inn: 'inn',
  library: 'library',
  workshop: 'bakery',
  genebank: 'greenhouse',
  station: 'market_hall',
  lighthouse: 'lighthouse',
  windmill: 'windmill',
};
const look = D.maps.copperleaf,
  dress = JSON.parse(readFileSync(join(ROOT, 'tools/data/copperleaf-town.json'), 'utf8')).dress || {};
/** a draft test map of a direction: the generator's ground, a stand-in building on every plot (its base point, the
 * middle of its front, on the plot's front edge; rot = the front's angle + 90, as build-copperleaf.mjs), a barn on
 * the barn's zone, then the island's dressing without the summit lookout */
function draft(sc, id) {
  const m = structuredClone(sc);
  for (const k of ['sky', 'haze', 'hazeD', 'amb', 'wind', 'blur', 'tint', 'indoor']) if (k in look) m[k] = look[k];
  m.name = `HB-4a sketch ${id}`;
  m.folk = 0;
  const r2 = v => Math.round(v * 100) / 100,
    put = (k, x, z, a) => {
      const rot = ((((a + 90 + 180) % 360) + 360) % 360) - 180;
      m.props.push({ k, x: r2(x), z: r2(z), ...(Math.abs(rot) > 0.05 ? { rot: r2(rot) } : {}) });
    };
  let n = 0;
  for (const L of m.plots) {
    const k = L.k === 'house' ? (n++ % 2 ? 'cottage_solar' : 'cottage_moss') : STAND_IN[L.k];
    if (!k) continue;
    const a = (L.a * Math.PI) / 180;
    put(k, L.x + (Math.cos(a) * L.d) / 2, L.z + (Math.sin(a) * L.d) / 2, L.a);
  }
  const barn = m.zones.find(Z => Z.k === 'barn');
  if (barn) {
    const c = barn.poly.reduce((s, p) => [s[0] + p[0] / barn.poly.length, s[1] + p[1] / barn.poly.length], [0, 0]);
    put('barn', c[0], c[1] - 4, 270);
  }
  const dressed = islandDress(m, D.scenery, dress);
  m.props = [...m.props, ...dressed.props.filter(p => p.k !== 'summit_lookout')];
  return m;
}

/** the water track's hub waterfall (docs/phases/water-track.md WA-2b, the owner's yes first): candidate sites in its
 * falls contract ({x, z, dir, w, h, pool}, the lip's middle, the way it falls, metres). 'cliff': the island's biggest
 * drop of 4 m or more within 3 m onto water (a sea cliff; a stream would have to reach it). 'pond': above the pond at
 * the stream's head, toward the summit, where the ground first stands 4 m over the pond (a shelf to cut there) */
function fallSites(G, sc, dials) {
  const W1 = G.w + 1,
    hAt = (x, z) => G.H[Math.round(z) * W1 + Math.round(x)],
    wet = (x, z) => 'wd'.includes(G.T[Math.floor(z) * G.w + Math.floor(x)]),
    r2 = v => Math.round(v * 100) / 100,
    out = [];
  let best = null;
  for (let z = 3; z < G.h - 3; z++)
    for (let x = 3; x < G.w - 3; x++)
      for (const [dx, dz] of [
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
      ]) {
        const drop = hAt(x, z) - hAt(x + dx, z + dz);
        if (drop >= 4 && wet(x + dx, z + dz) && (!best || drop > best.h))
          best = { site: 'cliff', x, z, dir: [dx / 3, dz / 3], w: 3, h: r2(drop), pool: 0 };
      }
  if (best) out.push(best);
  const pond = (sc.spots || []).find(S => S.kind === 'pond'),
    top = (sc.spots || []).find(S => S.kind === 'summit');
  if (pond && top) {
    const L = Math.hypot(top.x - pond.x, top.z - pond.z) || 1,
      ux = (top.x - pond.x) / L,
      uz = (top.z - pond.z) / L,
      y0 = hAt(pond.x, pond.z);
    for (let r = 2; r < L; r += 0.5)
      if (hAt(pond.x + ux * r, pond.z + uz * r) >= y0 + 4) {
        out.push({
          site: 'pond',
          x: r2(pond.x + ux * r),
          z: r2(pond.z + uz * r),
          dir: [r2(-ux), r2(-uz)],
          w: 3,
          h: r2(hAt(pond.x + ux * r, pond.z + uz * r) - y0),
          pool: dials.stream.pond,
          run: r2(r),
        });
        break;
      }
  }
  return out;
}

for (const dir of dirs) {
  if (ONLY.length && !ONLY.includes(dir.id)) continue;
  const t0 = Date.now(),
    {
      scene: sc,
      notes,
      paths,
      landmarks,
    } = islandGenerate(merge(hub.dials, dir.dials), dir.seed || hub.seed, {
      scenery: D.scenery,
    }),
    G = islandDecodeGround(sc),
    [cx, cz] = sc.cam.orbit.c,
    doors = sc.plots
      .filter(L => L.k !== 'well')
      .map(L => ({
        k: L.k,
        x: L.x,
        z: L.z,
        w: L.w,
        d: L.d,
        a: L.a,
        off: Math.round(islandAngleDiff(L.a, (Math.atan2(L.z - cz, L.x - cx) * 180) / Math.PI)),
      }));
  const n45 = doors.filter(o => Math.abs(o.off) <= 45).length,
    quarter = doors.filter(o => Math.abs(o.off) <= 45 && Math.abs(o.a % 90) < 0.01).length;
  writeFileSync(
    join(OUT, `${dir.id}.json`),
    JSON.stringify({
      id: dir.id,
      name: dir.name,
      blurb: dir.blurb || '',
      seed: dir.seed || hub.seed,
      dials: dir.dials || {},
      w: G.w,
      h: G.h,
      T: Array.from(G.T).join(''),
      H: Array.from(G.H, v => Math.round(v * 10) / 10),
      coast: sc.island.coast,
      c: sc.island.c,
      pivot: [cx, cz],
      roads: paths.map(p => ({ name: p.name, w: p.width || 2, pts: p.pts.filter((_q, i) => i % 2 === 0) })),
      bridges: (sc.bridges || []).map(b => [b.a, b.b, !!b.pier]),
      zones: (sc.zones || []).filter(Z => ['barn', 'pasture'].includes(Z.k)).map(Z => ({ k: Z.k, poly: Z.poly })),
      spots: sc.spots || [],
      plots: sc.plots,
      landmarks: landmarks || null,
      falls: fallSites(G, sc, merge(hub.dials, dir.dials)),
      doors,
      n45,
      quarter,
      notes,
    })
  );
  if (DRAFTS && dir.id !== 'today') D.maps[`hb4a_${dir.id}`] = draft(sc, dir.id);
  console.log(
    `${dir.id}: ${doors.length} building plots, ${n45} within 45 of outward, ${quarter} on a quarter turn` +
      ` (${Date.now() - t0} ms)${notes.length ? ' notes: ' + notes.join('; ') : ''}`
  );
}
if (DRAFTS) writeData(D);
