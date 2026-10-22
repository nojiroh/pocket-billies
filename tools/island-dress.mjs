// Island track IS-9: the hub island's dressing. Puts the props that make the ground read as what it is (the forest's
// trees and its floor, beach grass on the dunes, driftwood and shells on the sand, rocks on the rocky shore, tide pool
// rims, boulders and scree on the mountain, cairns by the trail, the summit lookout, bushes on the heath, flowers and
// the odd tree in the meadows) onto an island map that already carries its town (tools/build-copperleaf.mjs runs this
// as its last step). Seeded: the same ground, town and seed give the same props.
//
// Never dressed: the barn's and the pasture's zones (IS-8 owns the pasture), the town's zone, the plots, streets,
// paths and the trail, water, bridges and the pier, the ground in front of a door, the hub and the people's spots,
// the wild Billies' tall grass, slopes and shelf edges. A solid prop never cuts off ground you could walk to before:
// the walk grid is compared with and without the dressing and whatever shuts a pocket in is taken out again.
// Each prop it puts down carries `dress: 1`, so a rerun replaces exactly its own.
import { rngFrom } from '../game/js/logic/rng.js';
import { mapgenFbm, mapgenRadius, mapgenReach, mapgenSceneGround } from '../game/js/logic/mapgen.js';
import { islandDecodeGround } from '../game/js/logic/island-gen.js';

export const DRESS_VERSION = 1;

/* what grows where. Each layer: the ground letters it takes, the spacing of its candidate grid (m), how likely a
   candidate is kept, the props by weight, a size range for models, how far from a path it stays */
const TREES_LOW = {
  tree_oak: 3,
  tree_oak_b: 2,
  tree_beech: 3,
  tree_birch: 2,
  tree_birch_b: 1,
  tree_hazel: 1,
  tree_rowan: 1,
};
const TREES_MID = { tree_beech: 2, tree_birch: 2, tree_larch: 1, tree_pine: 2, tree_pine_b: 1, tree_oak_b: 1 };
const TREES_HIGH = { tree_pine: 3, tree_pine_b: 2, tree_pine_small: 2, tree_larch: 1 };
const FOREST = 'yLMF';
const MEADOW = 'GEgfC';
const STREETS = 'pvcu';
/* props whose variants are shapes, not looks: any of them is fine */
const SHAPES = new Set(['driftwood', 'shore_rocks', 'boulder_granite']);

const RAD = Math.PI / 180;
const r2 = v => Math.round(v * 100) / 100;
const turn = (x, z, deg) => {
  const c = Math.cos(deg * RAD),
    s = Math.sin(deg * RAD);
  return [x * c - z * s, x * s + z * c];
};
const inPoly = (P, x, z) => {
  let o = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i],
      [xj, zj] = P[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) o = !o;
  }
  return o;
};
const inPlot = (L, x, z, m = 0) => {
  const a = L.a * RAD,
    dx = x - L.x,
    dz = z - L.z,
    u = dx * Math.cos(a) + dz * Math.sin(a),
    v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= L.d / 2 + m && Math.abs(v) <= L.w / 2 + m;
};
const segDist = (x, z, a, b) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = dx * dx + dz * dz || 1,
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
};

/**
 * the island's dressing: { props, counts, notes }. sc: the map with its town's props (any old dressing is left out);
 * scenery: the game's scenery (props, terrains).
 * @param {any} sc
 * @param {any} scenery
 * @param {{ seed?: string }} [o]
 */
export function islandDress(sc, scenery, o = {}) {
  const C = scenery.props,
    PPU = scenery.ppu || 34,
    seed = o.seed || `${(sc.islandGen && sc.islandGen.seed) || sc.name || 'island'}|dress${DRESS_VERSION}`,
    G = islandDecodeGround(sc),
    { w, h, T } = G,
    W2 = w * 2,
    notes = /** @type {string[]} */ ([]),
    town = (sc.props || []).filter(p => !p.dress),
    zone = k => (sc.zones || []).filter(Z => Z.k === k);
  const tileAt = (x, z) => (x < 0 || z < 0 || x >= w || z >= h ? 'd' : T[Math.floor(z) * w + Math.floor(x)]);
  const stepAt = (x, z) => {
    if (!G.S) return 0;
    const i = Math.max(0, Math.min(W2 - 1, Math.floor(x * 2))),
      j = Math.max(0, Math.min(h * 2 - 1, Math.floor(z * 2)));
    return G.S[j * W2 + i] / 20;
  };
  const groundAt = (x, z) => mapgenSceneGround(sc, x, z) + stepAt(x, z);

  /* ---------- where nothing goes ---------- */
  const keepOut = /** @type {number[][]} */ ([]); /* [x, z, r] circles */
  const skipZones = [...zone('barn'), ...zone('pasture'), ...zone('town')].map(Z => Z.poly);
  for (const p of town) {
    const M = C[p.k];
    if (!M) continue;
    const s = p.s || 1;
    if (M.box) {
      /* a building: its turned footprint as a circle round its middle, and the ground in front of its door */
      const [bx, bd] = [M.box[0] * s, M.box[1] * s],
        [cx, cz] = turn(0, bd / 2, p.rot || 0);
      keepOut.push([p.x + cx, p.z + cz, Math.hypot(bx, bd) / 2 + 1]);
      const dx = M.door ? (M.door.x / PPU) * s * (p.f ? -1 : 1) : 0,
        [fx, fz] = turn(dx, -2, p.rot || 0);
      keepOut.push([p.x + fx, p.z + fz, 3]);
    } else keepOut.push([p.x, p.z, mapgenRadius(M, s) + 0.4]);
  }
  for (const L of sc.plots || []) keepOut.push([L.x, L.z, 0]); /* (the plots are tested as rectangles below) */
  if (sc.hub) keepOut.push([sc.hub[0], sc.hub[1], 4]);
  for (const s of sc.npcSpots || []) keepOut.push([s[0], s[1], 2]);
  for (const s of sc.spots || []) keepOut.push([s.x, s.z, s.kind === 'summit' ? 4 : s.kind === 'pond' ? 2 : 3]);
  for (const c of sc.checks || []) for (const p of [c.from, c.to]) if (c.reach && p) keepOut.push([p[0], p[1], 1.5]);
  const bridges = sc.bridges || [];
  const wild = sc.grassPatches || [];

  /* how far each cell is from a street, path or the trail (metres, to 4) and from water (to 4) */
  const far = (test, cap) => {
    const D = new Float32Array(w * h).fill(cap);
    const Q = [];
    for (let q = 0; q < w * h; q++)
      if (test(T[q])) {
        D[q] = 0;
        Q.push(q);
      }
    for (let k = 0; k < Q.length; k++) {
      const q = Q[k],
        i = q % w,
        j = (q - i) / w;
      for (const [a, b] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = i + a,
          jj = j + b;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        const n = jj * w + ii;
        if (D[n] > D[q] + 1) {
          D[n] = D[q] + 1;
          if (D[n] < cap) Q.push(n);
        }
      }
    }
    return D;
  };
  const toPath = far(ch => STREETS.includes(ch), 6),
    toWater = far(ch => ch === 'w' || ch === 'd', 6),
    toForestEdge = far(ch => !FOREST.includes(ch), 8);
  const cellOf = (x, z) =>
    Math.max(0, Math.min(h - 1, Math.floor(z))) * w + Math.max(0, Math.min(w - 1, Math.floor(x)));

  /* the shelf edges and slopes: the step grid's spread under a prop, the smooth land's fall over a metre */
  const onEdge = (x, z, r) => {
    if (!G.S) return false;
    const rr = Math.min(1.5, Math.max(0.25, r));
    let lo = 1e9,
      hi = -1e9;
    for (let j = Math.max(0, Math.floor((z - rr) * 2)); j <= Math.min(h * 2 - 1, Math.floor((z + rr) * 2)); j++)
      for (let i = Math.max(0, Math.floor((x - rr) * 2)); i <= Math.min(W2 - 1, Math.floor((x + rr) * 2)); i++) {
        const v = G.S[j * W2 + i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    return (hi - lo) / 20 > 0.3;
  };
  const steep = (x, z, r) => {
    const e = Math.max(0.5, r);
    const gx = (mapgenSceneGround(sc, x + e, z) - mapgenSceneGround(sc, x - e, z)) / (2 * e),
      gz = (mapgenSceneGround(sc, x, z + e) - mapgenSceneGround(sc, x, z - e)) / (2 * e);
    return Math.hypot(gx, gz);
  };

  /* ---------- what is put down ---------- */
  const placed = /** @type {any[]} */ ([]);
  const occ = new Map(); /* 2 m buckets of [x, z, r] */
  const occFree = (x, z, r) => {
    const n = Math.ceil((r + 3) / 2),
      bi = Math.floor(x / 2),
      bj = Math.floor(z / 2);
    for (let j = bj - n; j <= bj + n; j++)
      for (let i = bi - n; i <= bi + n; i++) {
        const L = occ.get(`${i},${j}`);
        if (L) for (const c of L) if (Math.hypot(x - c[0], z - c[1]) < c[2] + r) return false;
      }
    return true;
  };
  const occAdd = (x, z, r) => {
    const k = `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    if (!occ.has(k)) occ.set(k, []);
    occ.get(k).push([x, z, r]);
  };
  const variantOf = (k, rnd) => {
    const M = C[k],
      L = M && M.variants;
    if (!L || !L.length) return 0;
    if (L.some(v => v.weight > 0)) {
      let t = rnd.next() * L.reduce((a, v) => a + (v.weight > 0 ? v.weight : 0), 1) - 1;
      if (t < 0) return 0;
      for (let i = 0; i < L.length; i++) if (L[i].weight > 0 && (t -= L[i].weight) < 0) return i + 1;
      return 0;
    }
    return SHAPES.has(k) ? rnd.int(0, L.length) : 0;
  };
  const counts = /** @type {Record<string, number>} */ ({}),
    why = /** @type {Record<string, number>} */ ({}),
    no = (k, r) => ((why[`${k}: ${r}`] = (why[`${k}: ${r}`] || 0) + 1), null);
  /**
   * one prop at (x, z) if the spot allows it: o.gap extra room round it, o.path how far from a path it stays (m),
   * o.slope the steepest ground it stands on, o.wild may stand in the wild grass, o.scale a size range for a model
   */
  const put = (k, x, z, rnd, opt = {}) => {
    const M = C[k];
    if (!M) {
      if (!notes.includes(`no prop ${k}`)) notes.push(`no prop ${k}`);
      return null;
    }
    if (x < 1 || z < 1 || x > w - 1 || z > h - 1) return no(k, 'edge of the scene');
    const v = variantOf(k, rnd),
      s = M.model && opt.scale ? r2(rnd.range(opt.scale[0], opt.scale[1])) : 1,
      span = v && M.variants[v - 1].span ? M.variants[v - 1].span : 1,
      r = mapgenRadius(M, s) * span,
      solid = !M.flat && (M.solid || 0) > 0.05;
    const ch = tileAt(x, z);
    if (ch === 'w' || ch === 'd') return no(k, 'water');
    if (toPath[cellOf(x, z)] < (opt.path ?? (solid ? 2 : 1))) return no(k, 'by a path');
    if (skipZones.some(P => inPoly(P, x, z))) return no(k, 'zone');
    if ((sc.plots || []).some(L => inPlot(L, x, z, solid ? 2 : 1))) return no(k, 'plot');
    for (const c of keepOut) if (Math.hypot(x - c[0], z - c[1]) < c[2] + r * 0.5) return no(k, 'kept clear');
    for (const b of bridges) if (segDist(x, z, b.a, b.b) < (b.w || 2) / 2 + r + 1.5) return no(k, 'bridge');
    if (!opt.wild)
      for (const g of wild) if (Math.hypot(x - g.x, z - g.z) < g.r + (solid ? 1.5 : 0)) return no(k, 'wild grass');
    if (steep(x, z, r) > (opt.slope ?? 0.6)) return no(k, 'slope');
    if (onEdge(x, z, opt.edgeR ?? r)) return no(k, 'shelf edge');
    if (!occFree(x, z, r + (opt.gap || 0))) return no(k, 'crowded');
    const p = /** @type {any} */ ({ k, x: r2(x), z: r2(z) });
    if (Math.abs(s - 1) > 0.02) p.s = s;
    if (v) p.v = v;
    if (!M.model && rnd.chance(0.5)) p.f = 1;
    p.dress = 1;
    placed.push(p);
    occAdd(x, z, r);
    counts[k] = (counts[k] || 0) + 1;
    return p;
  };
  /** a jittered grid over the scene: fn(x, z, rnd) at each point */
  const sweep = (salt, step, fn) => {
    const rnd = rngFrom(seed, salt);
    for (let z = step / 2; z < h; z += step)
      for (let x = step / 2; x < w; x += step) {
        const jx = x + rnd.range(-0.45, 0.45) * step,
          jz = z + rnd.range(-0.45, 0.45) * step;
        fn(jx, jz, rnd);
      }
  };
  const noise = (x, z, size, salt) => mapgenFbm(x / size, z / size, salt);

  /* ---------- the forest: trees, thick inside, thinning to its edge; glades where the noise opens it ---------- */
  sweep('forest', 2.9, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if (!FOREST.includes(ch)) return;
    const inner = Math.min(1, toForestEdge[cellOf(x, z)] / 5),
      glade = noise(x, z, 9, 91) > 0.71;
    if (glade || !rnd.chance(0.55 + 0.4 * inner)) return;
    const y = groundAt(x, z),
      pool = y > 6 ? TREES_HIGH : y > 2.5 ? TREES_MID : TREES_LOW;
    put(rnd.pick(pool), x, z, rnd, { scale: [0.85, 1.2], gap: 0.7, slope: 0.7 });
  });
  /* its edge: a few trees step out onto the meadow */
  sweep('forest edge', 4.5, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if (!MEADOW.includes(ch) || toForestEdge[cellOf(x, z)] > 0) return;
    let near = false;
    for (let a = 0; a < 8 && !near; a++)
      near = FOREST.includes(tileAt(x + 3 * Math.cos(a * 0.785), z + 3 * Math.sin(a * 0.785)));
    if (near && rnd.chance(0.25))
      put(rnd.pick({ tree_oak_small: 2, tree_hazel: 2, tree_rowan: 1, bush_hawthorn: 2 }), x, z, rnd, {
        scale: [0.85, 1.1],
        gap: 1,
      });
  });
  /* its floor */
  sweep('forest floor', 2.1, (x, z, rnd) => {
    if (!FOREST.includes(tileAt(x, z)) || !rnd.chance(0.25)) return;
    const k = rnd.pick({
      fern: 3,
      fern_b: 2,
      bracken: 3,
      forest_litter: 4,
      mushroom: 1,
      mushroom_brown: 1,
      stump_mossy: 0.7,
      log_mossy: 0.6,
      bush_holly: 0.6,
    });
    put(k, x, z, rnd, { scale: [0.85, 1.1], path: 1, wild: !C[k] || !C[k].solid });
  });

  /* ---------- the meadows: flowers in drifts, now and then a lone tree ---------- */
  sweep('meadow', 4, (x, z, rnd) => {
    if (!MEADOW.includes(tileAt(x, z))) return;
    if (noise(x, z, 12, 92) > 0.58 && rnd.chance(0.45))
      put(
        rnd.pick({
          flowers_meadow: 3,
          daisies: 2,
          clover_patch: 2,
          dandelion_clocks: 2,
          flowers_white: 1,
          flowers_yellow: 1,
        }),
        x,
        z,
        rnd,
        { path: 1 }
      );
  });
  sweep('lone trees', 11, (x, z, rnd) => {
    if (!MEADOW.includes(tileAt(x, z)) || !rnd.chance(0.12)) return;
    put(rnd.pick({ tree_oak: 2, tree_hazel: 1, tree_rowan: 1, tree_birch: 1, bush_hawthorn: 2 }), x, z, rnd, {
      scale: [0.9, 1.15],
      gap: 2,
    });
  });

  /* ---------- the heath ---------- */
  sweep('heath', 3, (x, z, rnd) => {
    if (tileAt(x, z) !== 'H' || !rnd.chance(0.3)) return;
    put(rnd.pick({ bush_juniper: 3, dry_bush: 2, bush_bramble: 1, bush_rosemary: 1 }), x, z, rnd, {
      scale: [0.8, 1.1],
    });
  });

  /* ---------- the beaches and the shore ---------- */
  sweep('dunes', 1.7, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if ((ch === 'B' && rnd.chance(0.4)) || (ch === 's' && toWater[cellOf(x, z)] > 4 && rnd.chance(0.06)))
      put('beach_grass', x, z, rnd, { path: 0.6, wild: true });
  });
  sweep('driftwood', 6, (x, z, rnd) => {
    const ch = tileAt(x, z),
      d = toWater[cellOf(x, z)];
    if ((ch === 's' || ch === 'S') && d >= 1 && d <= 4 && rnd.chance(0.3))
      put('driftwood', x, z, rnd, { scale: [0.85, 1.15], gap: 1.5 });
  });
  sweep('shells', 3, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if ((ch === 'S' && rnd.chance(0.06)) || (ch === 's' && rnd.chance(0.025))) put('shells', x, z, rnd, { path: 0.5 });
  });
  sweep('shore rocks', 3, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if ((ch === '3' && rnd.chance(0.35)) || (ch === 'j' && rnd.chance(0.25)))
      put('shore_rocks', x, z, rnd, { scale: [0.8, 1.2], slope: 1.2, path: 1.5 });
  });
  sweep('tide pools', 4, (x, z, rnd) => {
    if (tileAt(x, z) === '2' && rnd.chance(0.6)) put('tidepool_rim', x, z, rnd, { gap: 1, path: 1.5 });
  });

  /* ---------- the mountain ---------- */
  sweep('boulders', 3.5, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if ((ch === 'r' && rnd.chance(0.3)) || (ch === 'P' && rnd.chance(0.1)))
      put('boulder_granite', x, z, rnd, { scale: [0.55, 0.95], gap: 1.2, slope: 0.9, edgeR: 0.5 });
  });
  /* outcrops on the mountain's grassy foot */
  const mountain = zone('mountain').map(Z => Z.poly);
  sweep('outcrops', 5, (x, z, rnd) => {
    if (!'CgGEHP'.includes(tileAt(x, z)) || !mountain.some(P => inPoly(P, x, z)) || !rnd.chance(0.2)) return;
    put('boulder_granite', x, z, rnd, { scale: [0.6, 1.05], gap: 1.5, slope: 0.9, edgeR: 0.5 });
  });
  /* scree at the foot of a shelf: level ground with a rock face rising within a metre */
  const footOfFace = (x, z) => {
    const y = stepAt(x, z);
    for (const d of [0.8, 1.5])
      for (let a = 0; a < 8; a++)
        if (stepAt(x + d * Math.cos(a * 0.785), z + d * Math.sin(a * 0.785)) - y > 0.5) return true;
    return false;
  };
  sweep('scree', 2.2, (x, z, rnd) => {
    const ch = tileAt(x, z);
    if (!'rPC'.includes(ch) || !footOfFace(x, z)) return;
    if (rnd.chance(ch === 'C' ? 0.2 : 0.55)) put('scree', x, z, rnd, { slope: 0.9, path: 1, edgeR: 0.3 });
  });
  /* cairns by the trail, every 25 m or so of it, on the downhill side's level ground */
  {
    const rnd = rngFrom(seed, 'cairns');
    const trail = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (T[j * w + i] === 'v') trail.push([i + 0.5, j + 0.5]);
    trail.sort((a, b) => groundAt(a[0], a[1]) - groundAt(b[0], b[1]));
    let last = /** @type {number[] | null} */ (null);
    for (const [x, z] of trail) {
      if (last && Math.hypot(x - last[0], z - last[1]) < 25) continue;
      for (let a = 0; a < 8; a++) {
        const px = x + 2.4 * Math.cos(a * 0.785),
          pz = z + 2.4 * Math.sin(a * 0.785);
        if (STREETS.includes(tileAt(px, pz))) continue;
        if (put('cairn', px, pz, rnd, { path: 1, slope: 0.7 })) {
          last = [x, z];
          break;
        }
      }
    }
  }
  /* the summit lookout on the flat top, beside where the trail arrives (the summit spot itself stays free) */
  {
    const S = (sc.spots || []).find(s => s.kind === 'summit');
    if (S && !town.some(p => p.k === 'summit_lookout')) {
      let done = null;
      /* on the top's own level (the crags cut into it aside), 3.5 to 8 m from the summit spot, off the trail; the
         flattest such spot, nearest the summit */
      const M = C.summit_lookout,
        R = M ? mapgenRadius(M, 1) : 2,
        top = groundAt(S.x, S.z);
      let best = Infinity;
      for (let dz = -8; dz <= 8; dz += 0.5)
        for (let dx = -8; dx <= 8; dx += 0.5) {
          const d = Math.hypot(dx, dz),
            x = S.x + dx,
            z = S.z + dz;
          if (!M || d < 3.5 || d > 8) continue;
          let lo = 1e9,
            hi = -1e9,
            trail = false;
          for (let b = -R; b <= R; b += 0.5)
            for (let a = -R; a <= R; a += 0.5) {
              if (Math.hypot(a, b) > R) continue;
              const y = groundAt(x + a, z + b);
              lo = Math.min(lo, y);
              hi = Math.max(hi, y);
              if (STREETS.includes(tileAt(x + a, z + b))) trail = true;
            }
          if (trail || Math.abs(groundAt(x, z) - top) > 0.6 || !occFree(x, z, R)) continue;
          const score = (hi - lo) * 4 + d * 0.1;
          if (hi - lo < 1.2 && score < best) {
            best = score;
            done = { k: 'summit_lookout', x: r2(x), z: r2(z), dress: 1 };
          }
        }
      if (done) {
        placed.push(done);
        occAdd(done.x, done.z, mapgenRadius(C.summit_lookout, 1));
        counts.summit_lookout = 1;
      } else notes.push('no room for the summit lookout by the summit');
    }
  }

  /* ---------- nothing shut in: what the walk reached without the dressing it still reaches ---------- */
  const reachOf = props => {
    const R = mapgenReach({ ...sc, props }, scenery, sc.hub, { slope: true });
    return R;
  };
  const before = reachOf(town);
  let props = [...town, ...placed],
    removed = 0;
  for (let round = 0; round < 12; round++) {
    const after = reachOf(props),
      { N, gw, gh } = after,
      lost = [];
    const W = after.blk;
    for (let q = 0; q < gw * gh; q++) {
      if (before.dist[q] < 0 || after.dist[q] >= 0) continue;
      if (W && W[q]) continue; /* under a prop: that's its footprint, not a pocket */
      lost.push(q);
    }
    if (!lost.length) break;
    /* the solid dressing next to the lost cells goes */
    const drop = new Set();
    for (const q of lost) {
      const x = ((q % gw) + 0.5) / N,
        z = (Math.floor(q / gw) + 0.5) / N;
      let best = null,
        bd = 3;
      for (const p of placed) {
        const M = C[p.k];
        if (!M || M.flat || !(M.solid > 0.05)) continue;
        const d = Math.hypot(p.x - x, p.z - z) - M.solid * (p.s || 1);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) drop.add(best);
    }
    if (!drop.size) {
      notes.push(`${lost.length} half-metre cells shut in by the dressing and no prop to blame`);
      break;
    }
    for (let i = placed.length - 1; i >= 0; i--)
      if (drop.has(placed[i])) {
        counts[placed[i].k]--;
        placed.splice(i, 1);
        removed++;
      }
    props = [...town, ...placed];
  }
  if (removed) notes.push(`${removed} props taken out again: they shut walkable ground in`);
  return { props: placed, counts, notes, why };
}
