// Island track IS-8: the fenced pasture by Copperleaf's barn, a step of its own limited to the map's `pasture` zone.
// tools/build-copperleaf.mjs runs it as its last step before writing the map; it can also run alone on the map as it
// stands (after a merge, say), changing nothing outside the zone:
//
//   node tools/build-pasture.mjs     # the pasture's props on game/data/maps/copperleaf.json
//
// It takes every prop off the zone (whatever an earlier step or a rerun put there), then lays the fence along the
// zone's outline made straight and set a little inside it (logic/pasture.js, the same line the game's Billies wander
// inside): rail sections (`fence_wood`) along each side, a post at each corner; a gap on the side nearest the barn's
// door with the field gate (`fence_gate`, act `pasture`: it opens the ranch's sheet) standing swung open into the
// field beside it, so you can walk in; the water trough by the gate; the hay rack with round bales by it in the middle;
// two more bales. Nothing but props is touched: the ground, the zones, people and life stay as they were.
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
/** the rail section's length, the gap you walk through */
export const PASTURE_RAIL = 2.2,
  PASTURE_GAP = 2.4;

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
    line = pastureFenceLine(zone),
    n = line.length,
    sgn = line.reduce((a, p, i) => a + p[0] * line[(i + 1) % n][1] - line[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
  /* the barn's door: where you come from */
  const barn = (sc.props || []).find(p => p.act === 'ranch'),
    door = barn
      ? (() => {
          const dx = ((C[barn.k] && C[barn.k].door ? C[barn.k].door.x : 0) / PPU) * (barn.s || 1),
            r = ((barn.rot || 0) * Math.PI) / 180;
          return [barn.x + dx * Math.cos(r), barn.z + dx * Math.sin(r)];
        })()
      : line[0];
  /* the gate: on the side nearest the door, its gap's middle at least a section from either corner */
  let gate = null;
  for (let i = 0; i < n; i++) {
    const a = line[i],
      b = line[(i + 1) % n],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      ux = (b[0] - a[0]) / L,
      uz = (b[1] - a[1]) / L,
      lo = PASTURE_GAP / 2 + 1.4,
      hi = L - lo;
    if (hi < lo) continue;
    const t = Math.max(lo, Math.min(hi, (door[0] - a[0]) * ux + (door[1] - a[1]) * uz)),
      c = [a[0] + ux * t, a[1] + uz * t],
      d = Math.hypot(c[0] - door[0], c[1] - door[1]);
    if (!gate || d < gate.d) gate = { i, t, L, c, ux, uz, d };
  }
  if (!gate) throw new Error('no side of the pasture is long enough for its gate');
  const inX = -gate.uz * sgn,
    inZ = gate.ux * sgn;
  const made = [];
  /* the rails along a stretch of fence, sections overlapping a little rather than leaving a gap */
  const rails = (a, b) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.3) return;
    const k = Math.max(1, Math.ceil(L / PASTURE_RAIL - 0.05)),
      rot = deg(b[0] - a[0], b[1] - a[1]);
    for (let j = 0; j < k; j++) {
      const f = (j + 0.5) / k;
      made.push(put('fence_wood', a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, rot));
    }
  };
  for (let i = 0; i < n; i++) {
    const a = line[i],
      b = line[(i + 1) % n];
    made.push(put('fence_wood_post', a[0], a[1], 0));
    if (i !== gate.i) {
      rails(a, b);
      continue;
    }
    const g0 = [gate.c[0] - (gate.ux * PASTURE_GAP) / 2, gate.c[1] - (gate.uz * PASTURE_GAP) / 2],
      g1 = [gate.c[0] + (gate.ux * PASTURE_GAP) / 2, gate.c[1] + (gate.uz * PASTURE_GAP) / 2];
    rails(a, g0);
    rails(g1, b);
    made.push(put('fence_wood_post', g0[0], g0[1], 0), put('fence_wood_post', g1[0], g1[1], 0));
  }
  /* the gate swung open into the field from the post on the gap's tighter side (nearer its corner): its base point
     (the middle of its front) half its length in from the post; the trough by the gap on the roomier side */
  const side = gate.t > gate.L / 2 ? 1 : -1,
    hx = gate.c[0] + (side * gate.ux * PASTURE_GAP) / 2,
    hz = gate.c[1] + (side * gate.uz * PASTURE_GAP) / 2,
    gateProp = put(
      'fence_gate',
      hx + (inX * PASTURE_RAIL) / 2 - side * gate.ux * 0.15,
      hz + (inZ * PASTURE_RAIL) / 2 - side * gate.uz * 0.15,
      deg(inX, inZ),
      { act: 'pasture', label: 'Pasture' }
    );
  made.push(gateProp);
  const trough = put(
    'water_trough',
    gate.c[0] - side * gate.ux * (PASTURE_GAP / 2 + 1.8) + inX * 1.6,
    gate.c[1] - side * gate.uz * (PASTURE_GAP / 2 + 1.8) + inZ * 1.6,
    deg(gate.ux, gate.uz)
  );
  made.push(trough);
  /* the hay rack in the middle of the field, two round bales beside it, two more out in the field */
  const roam = pastureRoamLine(zone),
    mid = roam.reduce((a, p) => [a[0] + p[0] / roam.length, a[1] + p[1] / roam.length], [0, 0]);
  if (!pastureIn(roam, mid[0], mid[1])) throw new Error('the pasture has no middle inside its fence');
  made.push(
    put('hay_feeder', mid[0], mid[1], deg(gate.ux, gate.uz)),
    put('hay_round', mid[0] + gate.ux * 2, mid[1] + gate.uz * 2, 0),
    put('hay_round', mid[0] - gate.ux * 2.1 + inX * 0.4, mid[1] - gate.uz * 2.1 + inZ * 0.4, 0)
  );
  const rnd = rngFn('copperleaf pasture', 'bales'),
    taken = () => made.filter(p => C[p.k] && C[p.k].solid > 0.3).map(p => [p.x, p.z, 6]);
  for (let k = 0; k < 2; k++) {
    const at = pastureSpot(roam, taken(), rnd);
    if (at) made.push(put('hay_round', at[0], at[1], 0));
  }
  /* every prop inside the zone, none on the fence's line but the fence */
  for (const p of made)
    if (!pastureIn(zone, p.x, p.z)) throw new Error(`the pasture's ${p.k} at (${p.x}, ${p.z}) is outside its zone`);
  for (const p of made.filter(p => !/^fence_wood/.test(p.k) && p.k !== 'fence_gate'))
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
