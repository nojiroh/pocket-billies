// @ts-check
'use strict';
/* ================= SCATTER (assets track AS-0) =================
   Natural placement for trees, shrubs, rocks and flowers, shared by the hub island's dressing (tools/island-dress.mjs,
   AS-5) and the run places' plants (logic/mapgen.js, AS-6). Jittered grids and white noise read as either too even
   or clumped in the wrong places; these read as grown:
   - scatterPoisson: Poisson-disc sampling (Bridson 2007) with a spacing that may change from spot to spot, so a
     forest thins toward its edge, inside any mask (a forest's cells, the land above the beach).
   - scatterClusters: seed-spread clumps (a parent and its young round it, densest near the parent), for groves,
     flower drifts and rock outcrops.
   - scatterLayers: ecological layers in order (canopy, understory, shrubs, ground cover): each later layer keeps
     clear of the earlier ones' points, and each point gets a kind picked by weight from its layer's list (the biomes'
     `flora` lists, docs/phases/assets-track.md).
   Every result depends only on its arguments and the seed (rngFrom), so a map built twice is the same map. Plain
   numbers, no graphics, usable from tools and the game. */
import { rngFrom } from './rng.js';

/**
 * @typedef {{x:number, z:number, r:number}} ScatterPoint
 * @typedef {{x0?:number, z0?:number, w:number, h:number}} ScatterArea
 * @typedef {(x:number, z:number) => boolean} ScatterKeep
 * @typedef {{id:string, w:number}} ScatterKind
 */

/* a bucket grid for points of different spacings: cell c, look out as far as the widest spacing needs. A point of
   the same fill keeps the larger of the two spacings; a point placed before (`fixed`, an earlier layer's trunk) only
   its own footprint, so a wide-spaced layer can still stand near a narrow trunk */
function scatterGrid(area, c, rMax) {
  const x0 = area.x0 || 0,
    z0 = area.z0 || 0,
    reach = Math.ceil(rMax / c),
    /* a margin of `reach` cells round the area, so a point just outside it still counts */
    pad = reach + 1,
    nx = Math.max(1, Math.ceil(area.w / c)) + 2 * pad,
    nz = Math.max(1, Math.ceil(area.h / c)) + 2 * pad,
    cells = new Map();
  const cellOf = (x, z) => [Math.floor((x - x0) / c) + pad, Math.floor((z - z0) / c) + pad];
  return {
    add(p) {
      const [i, j] = cellOf(p.x, p.z);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return;
      const k = j * nx + i,
        b = cells.get(k);
      if (b) b.push(p);
      else cells.set(k, [p]);
    },
    /* true when no point is too near (x, z) */
    free(x, z, r) {
      const [cx, cz] = cellOf(x, z);
      for (let j = Math.max(0, cz - reach); j <= Math.min(nz - 1, cz + reach); j++)
        for (let i = Math.max(0, cx - reach); i <= Math.min(nx - 1, cx + reach); i++) {
          const b = cells.get(j * nx + i);
          if (!b) continue;
          for (const q of b) {
            const m = q.fixed ? q.r : Math.max(r, q.r),
              dx = q.x - x,
              dz = q.z - z;
            if (dx * dx + dz * dz < m * m) return false;
          }
        }
      return true;
    },
  };
}

/**
 * Poisson-disc points in an area: no two closer than the larger of their spacings, and no gap where another point
 * would fit (Bridson's algorithm, k tries round each point, several starts so separate patches of a mask fill too).
 * o.r: the spacing in metres, unless o.radiusAt gives the spacing at a spot (kept between o.rMin and o.rMax, which
 * default to o.r); o.keep: only the spots it allows; o.k: tries round each point (30); o.max: stop after this many;
 * o.avoid: points already placed (an earlier layer), kept clear of by their own r.
 * @param {ScatterArea & {r?:number, radiusAt?:(x:number, z:number) => number, rMin?:number, rMax?:number,
 *   keep?:ScatterKeep, seed?:string|number, salt?:string, k?:number, max?:number, avoid?:ScatterPoint[]}} o
 * @returns {ScatterPoint[]}
 */
export function scatterPoisson(o) {
  const x0 = o.x0 || 0,
    z0 = o.z0 || 0,
    W = o.w,
    H = o.h,
    R = rngFrom(o.seed ?? 0, o.salt ?? 'scatter'),
    k = o.k ?? 30,
    max = o.max ?? Infinity,
    keep = o.keep || (() => true);
  const r0 = o.r ?? 1,
    rMin = Math.max(0.05, o.rMin ?? r0),
    rMax = Math.max(rMin, o.rMax ?? r0),
    at = o.radiusAt,
    rad = at ? (x, z) => Math.min(rMax, Math.max(rMin, at(x, z))) : () => r0;
  const avoid = o.avoid || [];
  let aMax = rMax;
  for (const q of avoid) aMax = Math.max(aMax, q.r);
  const G = scatterGrid({ x0, z0, w: W, h: H }, rMin, aMax);
  for (const q of avoid) G.add({ x: q.x, z: q.z, r: q.r, fixed: true });
  /** @type {ScatterPoint[]} */
  const out = [];
  const active = [];
  const inside = (x, z) => x >= x0 && x < x0 + W && z >= z0 && z < z0 + H;
  const tryAdd = (x, z) => {
    if (!inside(x, z) || !keep(x, z)) return false;
    const r = rad(x, z);
    if (!G.free(x, z, r)) return false;
    const p = { x, z, r };
    G.add(p);
    out.push(p);
    active.push(p);
    return true;
  };
  /* several starts spread over the area, so every patch of the mask gets one */
  const starts = Math.ceil((W * H) / (rMax * rMax * 6)) + 4;
  for (let s = 0; s < starts && out.length < max; s++) {
    tryAdd(x0 + R.next() * W, z0 + R.next() * H);
    while (active.length && out.length < max) {
      const i = Math.floor(R.next() * active.length),
        p = active[i];
      let placed = false;
      for (let t = 0; t < k && out.length < max; t++) {
        const a = R.next() * Math.PI * 2,
          d = p.r * (1 + R.next());
        if (tryAdd(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d)) placed = true;
      }
      if (!placed) {
        active[i] = active[active.length - 1];
        active.pop();
      }
    }
  }
  return out;
}

/**
 * Seed-spread clumps: parents spaced by `apart`, each with young round it at a spread that falls off from the
 * parent (a Gaussian of sd `spread`, metres), none closer than `gap` to another point. o.size: young per clump,
 * lowest and highest; o.parentKeep: where parents may stand (default o.keep); o.thin(x, z), 0 to 1: the share of
 * the parents kept at a spot, drawn after they are spread (thinning a full spread keeps the spacing honest, where a
 * mask with holes would only send the parents to the next spot over).
 * @param {ScatterArea & {apart:number, spread:number, size:[number, number], gap:number, keep?:ScatterKeep,
 *   parentKeep?:ScatterKeep, thin?:(x:number, z:number) => number, seed?:string|number, salt?:string,
 *   avoid?:ScatterPoint[]}} o
 * @returns {(ScatterPoint & {clump:number})[]}
 */
export function scatterClusters(o) {
  const keep = o.keep || (() => true),
    R = rngFrom(o.seed ?? 0, `${o.salt ?? 'scatter'}|young`);
  const parents = scatterPoisson({
    ...o,
    r: o.apart,
    radiusAt: undefined,
    keep: o.parentKeep || keep,
    avoid: o.avoid,
    salt: `${o.salt ?? 'scatter'}|parents`,
  }).filter(p => !o.thin || R.next() < o.thin(p.x, p.z));
  const x0 = o.x0 || 0,
    z0 = o.z0 || 0;
  let aMax = o.gap;
  for (const q of o.avoid || []) aMax = Math.max(aMax, q.r);
  const G = scatterGrid({ x0, z0, w: o.w, h: o.h }, o.gap, aMax);
  for (const q of o.avoid || []) G.add({ x: q.x, z: q.z, r: q.r, fixed: true });
  /** @type {(ScatterPoint & {clump:number})[]} */
  const out = [];
  const inside = (x, z) => x >= x0 && x < x0 + o.w && z >= z0 && z < z0 + o.h;
  parents.forEach((p, ci) => {
    if (!G.free(p.x, p.z, o.gap)) return;
    const pp = { x: p.x, z: p.z, r: o.gap, clump: ci };
    G.add(pp);
    out.push(pp);
    const n = o.size[0] + Math.floor(R.next() * (o.size[1] - o.size[0] + 1));
    let made = 0;
    for (let t = 0; t < n * 8 && made < n; t++) {
      const x = p.x + R.gauss() * o.spread,
        z = p.z + R.gauss() * o.spread;
      if (!inside(x, z) || !keep(x, z) || !G.free(x, z, o.gap)) continue;
      const q = { x, z, r: o.gap, clump: ci };
      G.add(q);
      out.push(q);
      made++;
    }
  });
  return out;
}

/** a kind from a weighted list, by one number in [0,1) @param {ScatterKind[]} list @param {number} u */
export function scatterPick(list, u) {
  let s = 0;
  for (const e of list) s += Math.max(0, e.w);
  if (!(s > 0)) return null;
  let r = u * s;
  for (const e of list) if ((r -= Math.max(0, e.w)) < 0) return e.id;
  return list[list.length - 1].id;
}

/**
 * Layers in order, each keeping clear of every point before it by its own `clear` (a trunk's footprint), each point
 * given a kind from the layer's list.
 * @param {ScatterArea & {
 *   seed?: string|number, salt?: string, keep?: ScatterKeep, avoid?: ScatterPoint[],
 *   layers: {name:string, kinds:ScatterKind[], r?:number, rMin?:number, rMax?:number,
 *            radiusAt?:(x:number,z:number)=>number, clear?:number, keep?:ScatterKeep,
 *            clumps?:{apart:number, spread:number, size:[number,number], gap:number}, parentKeep?:ScatterKeep,
 *            thin?:(x:number,z:number)=>number, max?:number}[],
 * }} o
 * @returns {{x:number, z:number, r:number, layer:string, id:string}[]}
 */
export function scatterLayers(o) {
  const out = [];
  /** @type {ScatterPoint[]} */
  const placed = [...(o.avoid || [])];
  for (const L of o.layers) {
    if (!L.kinds || !L.kinds.length) continue;
    const salt = `${o.salt ?? 'scatter'}|${L.name}`,
      lk = L.keep,
      ok = o.keep,
      both = lk && ok ? (x, z) => lk(x, z) && ok(x, z) : lk || ok,
      pk = L.parentKeep,
      R = rngFrom(o.seed ?? 0, `${salt}|kinds`);
    const area = { x0: o.x0, z0: o.z0, w: o.w, h: o.h };
    const pts = L.clumps
      ? scatterClusters({
          ...area,
          ...L.clumps,
          keep: both,
          parentKeep: pk && both ? (x, z) => pk(x, z) && both(x, z) : pk || both,
          thin: L.thin,
          seed: o.seed,
          salt,
          avoid: placed,
        })
      : scatterPoisson({
          ...area,
          r: L.r,
          rMin: L.rMin,
          rMax: L.rMax,
          radiusAt: L.radiusAt,
          keep: both,
          seed: o.seed,
          salt,
          max: L.max,
          avoid: placed,
        });
    const clear = L.clear ?? 0;
    for (const p of pts) {
      const id = scatterPick(L.kinds, R.next());
      if (!id) continue;
      out.push({ x: p.x, z: p.z, r: p.r, layer: L.name, id });
      if (clear > 0) placed.push({ x: p.x, z: p.z, r: clear });
    }
  }
  return out;
}

/**
 * A biome's plants over an area, by its `flora` layers (biomes.json, AS-0): each layer's kinds come from the biome's
 * list it names (trees, shrubs, plants...). o.density(layer, x, z), 0 to 1, says how thick a layer grows at a spot (a
 * forest's core 1, its edge 0.3, a clearing 0): an even layer's spacing goes from its sparse r to its dense r, and
 * that share of a clumped layer's parents is kept (o.thin of scatterClusters). Without it every layer grows at
 * its densest. o.keep and o.avoid as scatterLayers (a road, the buildings).
 * @param {{flora?: import('../../types/game-data').BiomeFloraLayer[]} & Record<string, any>} biome
 * @param {ScatterArea & {seed?:string|number, salt?:string, keep?:ScatterKeep, avoid?:ScatterPoint[],
 *   density?:(layer:string, x:number, z:number) => number, only?:string[]}} o
 */
export function scatterFlora(biome, o) {
  const dens = o.density;
  const layers = (biome.flora || [])
    .filter(L => !o.only || o.only.includes(L.layer))
    .map(L => {
      const kinds = Object.entries(biome[L.from] || {}).map(([id, w]) => ({ id, w: Number(w) || 0 }));
      const d = dens ? (x, z) => Math.max(0, Math.min(1, dens(L.layer, x, z))) : null;
      const keep = d ? (x, z) => d(x, z) > 0.02 : undefined;
      const base = { name: L.layer, kinds, clear: L.clear, keep };
      if (L.clumps)
        return {
          ...base,
          clumps: {
            ...L.clumps,
            size: /** @type {[number, number]} */ ([L.clumps.size[0], L.clumps.size[1]]),
          },
          thin: d || undefined,
        };
      const [dense, sparse] = L.r || [1, 1];
      return {
        ...base,
        rMin: dense,
        rMax: sparse,
        radiusAt: d ? (x, z) => sparse + (dense - sparse) * d(x, z) : () => dense,
      };
    });
  return scatterLayers({
    x0: o.x0,
    z0: o.z0,
    w: o.w,
    h: o.h,
    seed: o.seed,
    salt: o.salt,
    keep: o.keep,
    avoid: o.avoid,
    layers,
  });
}
