// Island track IS-8: the fenced pasture by Copperleaf's barn, a step of its own limited to the map's `pasture` zone.
// tools/build-copperleaf.mjs runs it as its last step before writing the map; it can also run alone on the map as it
// stands (after a merge, say), changing nothing outside the zone:
//
//   node tools/build-pasture.mjs     # the pasture's props on game/data/maps/copperleaf.json
//
// It takes every prop off the zone (whatever an earlier step or a rerun put there), then lays the fence along the
// zone's outline lightly smoothed and set a little inside it (logic/pasture.js, the same line the game's Billies wander
// inside). HB-6: a weathered post-and-rail fence that bends as the zone does: posts (`fence_post`) spaced evenly round
// the line, each a few degrees turned and leaning a little; between each two a rail (`fence_rail`) sized to its span,
// resting on the ground at both posts; a few rails weathered, a few broken; a gap where the island's path to the
// pasture arrives (or nearest the barn's door on a map with no island) with the field gate (`fence_gate`, act `pasture`: it opens the ranch's sheet) hung on its own post at one
// end of the gap and standing swung open into the field, so you can walk in; the water trough by the gate; the hay
// rack with round bales by it in the middle; two more bales. Nothing but props is touched: the ground, the zones,
// people and life stay as they were.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGameData, ROOT } from './data-files.mjs';
import {
  pastureFenceLine,
  pastureIn,
  pastureRoamLine,
  pastureSegDist,
  pastureSpot,
  pastureZone,
} from '../game/js/logic/pasture.js';
import { rngFn } from '../game/js/logic/rng.js';

const r2 = v => Math.round(v * 100) / 100,
  deg = (x, z) => {
    const d = (Math.atan2(z, x) * 180) / Math.PI;
    return Math.round((((((d + 180) % 360) + 360) % 360) - 180) * 10) / 10;
  },
  /** a prop placed, its turn left out when it has none */
  put = (k, x, z, rot, more = {}) => ({ k, x: r2(x), z: r2(z), ...(rot ? { rot } : {}), ...more });
/** the gap you walk through, from post middle to post middle */
export const PASTURE_GAP = 2.4;

/**
 * The pasture's props on a map: returns { props, cleared, made, gate, gap } with props the map's whole new list (the
 * zone's own props taken off, the pasture's added after the rest). Throws when the map has no pasture zone or a prop
 * would stand outside it.
 * @param {any} sc the map (its zones and props; not changed)
 * @param {any} scenery the game's scenery (props: their boxes and doors)
 */
export function pastureProps(sc, scenery) {
  const zone = pastureZone(sc);
  if (!zone) throw new Error('the map has no pasture zone');
  const C = scenery.props,
    PPU = scenery.ppu || 34,
    RAIL = C.fence_rail.box[0],
    line = pastureFenceLine(zone),
    n = line.length;
  /* the barn's door: where you come from on a map with no island */
  const barn = (sc.props || []).find(p => p.act === 'ranch'),
    door = barn
      ? (() => {
          const dx = ((C[barn.k] && C[barn.k].door ? C[barn.k].door.x : 0) / PPU) * (barn.s || 1),
            r = ((barn.rot || 0) * Math.PI) / 180;
          return [barn.x + dx * Math.cos(r), barn.z + dx * Math.sin(r)];
        })()
      : line[0];
  /* the line walked round: how far round each of its points is */
  const at = [0];
  for (let i = 1; i <= n; i++)
    at.push(at[i - 1] + Math.hypot(line[i % n][0] - line[i - 1][0], line[i % n][1] - line[i - 1][1]));
  const P = at[n],
    /** the point d metres round the line (any d: it goes round and round) */
    pointAt = d => {
      d = ((d % P) + P) % P;
      let i = 0;
      while (i < n - 1 && at[i + 1] < d) i++;
      const a = line[i],
        b = line[(i + 1) % n],
        f = (d - at[i]) / (at[i + 1] - at[i] || 1);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };
  /* the gate: where the path arrives. The island's generator lays a path (a spoke) from the middle of the zone's side
     facing the sea, straight out from the island's middle through the zone's middle (logic/island-gen.js, the flat
     zones' spokes): the gap's middle is where that line crosses the fence. With no island, where the line comes
     nearest the barn's door. */
  const zm = zone.reduce((a, p) => [a[0] + p[0] / zone.length, a[1] + p[1] / zone.length], [0, 0]),
    ic = sc.island && Array.isArray(sc.island.c) ? sc.island.c : null,
    aim = (() => {
      if (!ic) return door;
      const dl = Math.hypot(zm[0] - ic[0], zm[1] - ic[1]) || 1,
        dx = (zm[0] - ic[0]) / dl,
        dz = (zm[1] - ic[1]) / dl;
      let r = 0;
      while (r < 200 && pastureIn(line, zm[0] + dx * r, zm[1] + dz * r)) r += 0.05;
      return [zm[0] + dx * r, zm[1] + dz * r];
    })();
  let gd = 0,
    best = Infinity;
  for (let d = 0; d < P; d += 0.1) {
    const q = pointAt(d),
      e = Math.hypot(q[0] - aim[0], q[1] - aim[1]);
    if (e < best) [gd, best] = [d, e];
  }
  /* the gap's two posts, then the posts round the rest of the line spaced evenly (a rail's length apart, near enough
     that the rail, sized to its span, stays within a twentieth of its own size) */
  const g0 = pointAt(gd - PASTURE_GAP / 2),
    g1 = pointAt(gd + PASTURE_GAP / 2),
    S = P - PASTURE_GAP,
    k = Math.max(3, Math.round(S / RAIL)),
    posts = [];
  for (let j = 0; j <= k; j++) posts.push(pointAt(gd + PASTURE_GAP / 2 + (S * j) / k));
  const c = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2],
    gl = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]),
    ux = (g1[0] - g0[0]) / gl,
    uz = (g1[1] - g0[1]) / gl,
    /* into the field, square to the gap */
    inw = pastureIn(line, c[0] - uz * 0.5, c[1] + ux * 0.5) ? 1 : -1,
    inX = -uz * inw,
    inZ = ux * inw;
  /* the trough by the gap, on the side with more room (a step further in if it's near the fence); the gate hangs on
     the gap's other end */
  const clear = (x, z) => {
    let d = Infinity;
    for (let i = 0; i < n; i++) d = Math.min(d, pastureSegDist(line[i], line[(i + 1) % n], x, z));
    return d;
  };
  let trough = null;
  for (const depth of [1.6, 2.4, 3.2])
    for (const ts of [-1, 1]) {
      const x = c[0] + ts * ux * (PASTURE_GAP / 2 + 1.8) + inX * depth,
        z = c[1] + ts * uz * (PASTURE_GAP / 2 + 1.8) + inZ * depth,
        d = clear(x, z);
      if (pastureIn(line, x, z) && d >= 1.3 && (!trough || (trough.depth === depth && d > trough.d)))
        trough = { x, z, ts, d, depth };
    }
  if (!trough) throw new Error('no room for the trough by the pasture gate');
  /* the post the gate hangs on: the gap's end away from the trough (its own post stands there) */
  const hinge = trough.ts < 0 ? 0 : k;
  const made = [],
    rnd = rngFn('copperleaf pasture', 'fence'),
    pick = (lo, hi) => lo + rnd() * (hi - lo);
  /* the posts (not the one the gate hangs on: its own post stands there): a few degrees turned, a little lean, now and
     then silvered */
  posts.forEach((q, j) => {
    if (j === hinge) return;
    const lean = pick(0.6, 2.2),
      la = pick(0, Math.PI * 2),
      v = rnd() < 0.3 ? 1 : 0;
    made.push(
      put('fence_post', q[0], q[1], Math.round(pick(-12, 12) * 10) / 10, {
        tilt: [Math.round(Math.cos(la) * lean * 10) / 10 || 0, Math.round(Math.sin(la) * lean * 10) / 10 || 0],
        ...(v ? { v } : {}),
      })
    );
  });
  /* a rail between each two posts, sized to the span; some weathered, a few broken (never by the gate, never two
     broken side by side) */
  let wasBroken = false;
  for (let j = 0; j < k; j++) {
    const a = posts[j],
      b = posts[j + 1],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      sz = Math.round((L / RAIL) * 1000) / 1000;
    if (Math.abs(sz - 1) > 0.08) throw new Error(`a span of the pasture's fence is ${L.toFixed(2)} m: no rail fits it`);
    const old = rnd() < 0.25,
      broke = !wasBroken && j > 0 && j < k - 1 && rnd() < 0.07,
      v = broke ? (old ? 3 : 2) : old ? 1 : 0;
    wasBroken = broke;
    made.push(
      put('fence_rail', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, deg(b[0] - a[0], b[1] - a[1]), {
        ...(sz !== 1 ? { s: sz } : {}),
        ...(v ? { v } : {}),
      })
    );
  }
  /* the gate swung open into the field, hung on its own post (at its left-hand end, a little back: where the fence's
     post would be) */
  const hp = posts[hinge],
    grot = deg(inX, inZ),
    gr = (grot * Math.PI) / 180,
    gpx = -1 * Math.cos(gr) - 0.125 * Math.sin(gr),
    gpz = -1 * Math.sin(gr) + 0.125 * Math.cos(gr),
    gateProp = put('fence_gate', hp[0] - gpx, hp[1] - gpz, grot, { act: 'pasture', label: 'Pasture' });
  made.push(gateProp, put('water_trough', trough.x, trough.z, deg(ux, uz)));
  const gate = { c, ux, uz };
  /* the hay rack in the middle of the field, two round bales beside it, two more out in the field */
  const roam = pastureRoamLine(zone),
    mid = roam.reduce((a, p) => [a[0] + p[0] / roam.length, a[1] + p[1] / roam.length], [0, 0]);
  if (!pastureIn(roam, mid[0], mid[1])) throw new Error('the pasture has no middle inside its fence');
  made.push(
    put('hay_feeder', mid[0], mid[1], deg(gate.ux, gate.uz)),
    put('hay_round', mid[0] + gate.ux * 2, mid[1] + gate.uz * 2, 0),
    put('hay_round', mid[0] - gate.ux * 2.1 + inX * 0.4, mid[1] - gate.uz * 2.1 + inZ * 0.4, 0)
  );
  const rndB = rngFn('copperleaf pasture', 'bales'),
    taken = () => made.filter(p => C[p.k] && C[p.k].solid > 0.3).map(p => [p.x, p.z, 6]);
  for (let k = 0; k < 2; k++) {
    const spot = pastureSpot(roam, taken(), rndB);
    if (spot) made.push(put('hay_round', spot[0], spot[1], 0));
  }
  /* every prop inside the zone, none on the fence's line but the fence */
  for (const p of made)
    if (!pastureIn(zone, p.x, p.z)) throw new Error(`the pasture's ${p.k} at (${p.x}, ${p.z}) is outside its zone`);
  for (const p of made.filter(p => !/^fence_/.test(p.k)))
    for (let i = 0; i < n; i++)
      if (pastureSegDist(line[i], line[(i + 1) % n], p.x, p.z) < 0.9)
        throw new Error(`the pasture's ${p.k} at (${p.x}, ${p.z}) stands on the fence`);
  const kept = (sc.props || []).filter(p => !pastureIn(zone, p.x, p.z));
  return {
    props: [...kept, ...made],
    cleared: (sc.props || []).length - kept.length,
    made: made.length,
    gate: gateProp,
    gap: [r2(gate.c[0]), r2(gate.c[1])],
    posts: posts.map(q => [r2(q[0]), r2(q[1])]),
  };
}

/* alone: the pasture on the hub as it stands */
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const D = readGameData(),
    sc = D.maps.copperleaf,
    out = pastureProps(sc, D.scenery);
  sc.props = out.props;
  execFileSync('node', [join(ROOT, 'tools/write-data.mjs')], {
    input: JSON.stringify(D),
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log(`the pasture: ${out.made} props (${out.cleared} taken off the zone first)`);
}
