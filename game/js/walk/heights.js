'use strict';
/* ================= WALK HEIGHTS =================
   Phase 20 (stage B): the ground's heights, building pads, wall materials and the walk grid's override, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { gameData, provide } from '../hooks.js';
import { clamp } from '../util.js';
import { placedTurn, pointInProp, turnedBounds } from '../logic/prop-turn.js';
import { bridgeAt, mapById, navGrid, setNavGrid, stepRaiseAt, terrainAt, walkData, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { smooth01 } from '../engine/webgl.js';
/* eslint-disable no-func-assign */
expose({
  NO_PAD_PROPS: [() => NO_PAD_PROPS],
  WALL_COLORS: [() => WALL_COLORS],
  WALL_MATERIALS: [() => WALL_MATERIALS],
  baseNavGrid: [() => baseNavGrid],
  biomeCliff: [() => biomeCliff, v => (biomeCliff = v)],
  buildingPads: [() => buildingPads, v => (buildingPads = v)],
  defaultWallMaterial: [() => defaultWallMaterial, v => ((defaultWallMaterial = v), provide({ defaultWallMaterial }))],
  groundHeightAt: [() => groundHeightAt, v => ((groundHeightAt = v), provide({ groundHeightAt }))],
  heightGrid: [() => heightGrid, v => (heightGrid = v)],
  rawHeightAt: [() => rawHeightAt, v => ((rawHeightAt = v), provide({ rawHeightAt }))],
  standingHeightAt: [() => standingHeightAt, v => ((standingHeightAt = v), provide({ standingHeightAt }))],
  wallAtlasRows: [() => wallAtlasRows, v => (wallAtlasRows = v)],
});
/* eslint-enable no-func-assign */
provide({ defaultWallMaterial, groundHeightAt, rawHeightAt, standingHeightAt });
/* to-module: end */
/* ---------- heights ---------- */
/* alpha 0.2: the land between the metre corners is a smooth curve (Catmull-Rom, kept between its four corners so it
   never overshoots) instead of a straight blend, so there is no crease at every metre and the light flows over hills.
   Before that, the ground is levelled under buildings, benches, stalls and the like (buildingPads): flat under the
   footprint, easing back into the land around it, so nothing stands on a slope with a corner in the air. */
const NO_PAD_PROPS =
  /fence|hedge|log|wall|rail|pipe|vineyard|shipwreck|yacht|boat|mesa|derrick|vault_door|mine_entrance|stilt|ferris|festival_stage/;
function buildingPads(sc) {
  const C = walkData().sc,
    ppu = C.ppu || 34,
    out = [];
  if (walkView.noPads) return out;
  for (const p of sc.props || []) {
    const M = C.props[p.k];
    if (!M || !M.box || M.flat || M.walk || NO_PAD_PROPS.test(p.k)) continue;
    const s = p.s || 1,
      bw = (M.box[0] * s) / 2,
      bd = M.box[1] * s,
      bld = !!(M.build || M.door != null),
      /* phase 09 batch 9: a turned prop levels its turned footprint (x0 to z1 then hold the place's rectangle round it) */
      T = turnedBounds(p, -bw, -0.1, bw, bd);
    out.push({
      x0: T[0],
      x1: T[2],
      z0: T[1],
      z1: T[3],
      turn: placedTurn(p) ? { p, a0: -bw, a1: bw, b0: -0.1, b1: bd } : null,
      m: bld ? 1.5 : 0.9,
      ax: p.x,
      az: p.z,
      bld,
      a: bw * bd,
    });
  }
  return out.sort((a, b) => b.a - a.a);
}
function heightGrid(sc) {
  const H = sc.heights;
  if (!H || !H.length) return null;
  /* phase 08b: a room's view: its place's grid with the room's floor laid in (the place isn't worked out again) */
  if (sc.groundOf && sc.roomRect) {
    const B = heightGrid(sc.groundOf),
      c = sc._hg;
    if (B && B.W === sc.w && B.Hh === sc.h) {
      if (c && c.base === B.G && c.H === H) return c;
      const G = new Float32Array(B.G),
        R = sc.roomRect,
        W = sc.w;
      for (let b = Math.max(0, R[1]); b <= Math.min(sc.h, R[1] + R[3]); b++) {
        const r = H[sc.h - b];
        for (let a = Math.max(0, R[0]); a <= Math.min(W, R[0] + R[2]); a++) G[b * (W + 1) + a] = r ? +r[a] || 0 : 0;
      }
      return (sc._hg = { H, sig: 'room', t: performance.now(), G, W, Hh: sc.h, base: B.G });
    }
  }
  const now = performance.now(),
    c = sc._hg;
  if (c && now - c.t < 120 && c.H === H) return c;
  const CP = walkData().sc.props;
  let sig = (sc._hv || 0) + '|' + (sc.props ? sc.props.length : 0);
  if (sc.props)
    for (const p of sc.props) {
      const M = CP[p.k];
      if (M && M.box)
        sig += ',' + Math.round(p.x * 10) + ':' + Math.round(p.z * 10) + ':' + (p.s || 1) + ':' + (p.rot || 0);
    }
  if (c && c.H === H && c.sig === sig) {
    c.t = now;
    return c;
  }
  const W = sc.w,
    Hh = sc.h,
    G = new Float32Array((W + 1) * (Hh + 1));
  for (let b = 0; b <= Hh; b++) {
    const r = H[Hh - b];
    for (let a = 0; a <= W; a++) G[b * (W + 1) + a] = r ? +r[a] || 0 : 0;
  }
  const wet = (a, b) => {
    for (const [da, db] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ]) {
      const i = a + da,
        j = Hh - 1 - (b + db);
      const ch = i >= 0 && j >= 0 && i < W && j < Hh ? ((sc.tiles || [])[j] || '')[i] : null;
      if (ch === 'w' || ch === 'd') return true;
    }
    return false;
  };
  const bil = (x, z) => {
    const fx = clamp(x, 0, W),
      fz = clamp(z, 0, Hh),
      i = Math.min(W - 1, Math.floor(fx)),
      j = Math.min(Hh - 1, Math.floor(fz)),
      u = fx - i,
      v = fz - j,
      g = (a, b) => G[b * (W + 1) + a];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  };
  for (const P of buildingPads(sc)) {
    const tg = bil(P.ax, P.az);
    for (let b = Math.max(0, Math.floor(P.z0 - P.m)); b <= Math.min(Hh, Math.ceil(P.z1 + P.m)); b++)
      for (let a = Math.max(0, Math.floor(P.x0 - P.m)); a <= Math.min(W, Math.ceil(P.x1 + P.m)); a++) {
        let dx, dz;
        if (P.turn) {
          const R = P.turn,
            [la, lb] = pointInProp(R.p, a, b);
          dx = Math.max(0, R.a0 - la, la - R.a1);
          dz = Math.max(0, R.b0 - lb, lb - R.b1);
        } else {
          dx = Math.max(0, P.x0 - a, a - P.x1);
          dz = Math.max(0, P.z0 - b, b - P.z1);
        }
        const d = Math.hypot(dx, dz);
        if (d >= P.m || wet(a, b)) continue;
        const w = d <= 0 ? 1 : 1 - smooth01(d / P.m),
          q = b * (W + 1) + a;
        G[q] += (tg - G[q]) * w;
      }
  }
  return (sc._hg = { H, sig, t: now, G, W, Hh });
}
export function rawHeightAt(sc, x, z) {
  const Q = heightGrid(sc);
  if (!Q) return 0;
  const W = Q.W,
    Hh = Q.Hh,
    G = Q.G,
    fx = clamp(x, 0, W),
    fz = clamp(z, 0, Hh),
    i = Math.min(W - 1, Math.floor(fx)),
    j = Math.min(Hh - 1, Math.floor(fz)),
    u = fx - i,
    v = fz - j;
  const g = (a, b) => G[clamp(b, 0, Hh) * (W + 1) + clamp(a, 0, W)],
    cr = (p0, p1, p2, p3, t) =>
      p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const r0 = cr(g(i - 1, j - 1), g(i, j - 1), g(i + 1, j - 1), g(i + 2, j - 1), u),
    r1 = cr(g(i - 1, j), g(i, j), g(i + 1, j), g(i + 2, j), u),
    r2 = cr(g(i - 1, j + 1), g(i, j + 1), g(i + 1, j + 1), g(i + 2, j + 1), u),
    r3 = cr(g(i - 1, j + 2), g(i, j + 2), g(i + 1, j + 2), g(i + 2, j + 2), u);
  const a = g(i, j),
    b = g(i + 1, j),
    c = g(i, j + 1),
    d = g(i + 1, j + 1);
  return clamp(cr(r0, r1, r2, r3, v), Math.min(a, b, c, d), Math.max(a, b, c, d));
}
/* the visible ground (smooth land plus the terrace, cliff or stair raise of its half-metre cell) and the height you
   stand at (a bridge deck where there is one; a little lower in water) */
export function groundHeightAt(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  return rawHeightAt(sc, x, z) + stepRaiseAt(x, z, sc);
}
export function standingHeightAt(x, z) {
  const sc = walkView.sc;
  if (!sc) return 0;
  if (sc.bridges) {
    const b = bridgeAt(x, z, sc);
    if (b != null) return b;
  }
  let h = groundHeightAt(x, z);
  const ch = terrainAt(x, z);
  if (ch === 'w' || ch === 'd') h -= 0.12;
  return h;
}
/* the scene's wall materials (index → colour; 0 means the scene's own rock) */
export const WALL_MATERIALS = [
  'Scene rock',
  'Rock',
  'Layered sandstone',
  'Cave rock',
  'Brick',
  'Dressed stone',
  'Hedge',
  'Wooden boards',
  'Stone steps',
  'Mossy rock',
  'Concrete',
  'Dark slate',
  /* terrain TR-4: the biomes' cliff faces (walls.png's fourth row) */
  'Columnar basalt',
  'Limestone',
  'Crystal-veined rock',
  'Speckled granite',
];
export const WALL_COLORS = [
  [0.47, 0.45, 0.42],
  [0.5, 0.48, 0.45],
  [0.8, 0.58, 0.38],
  [0.38, 0.35, 0.44],
  [0.69, 0.38, 0.3],
  [0.69, 0.66, 0.62],
  [0.3, 0.52, 0.28],
  [0.58, 0.4, 0.27],
  [0.64, 0.62, 0.57],
  [0.42, 0.47, 0.36],
  [0.62, 0.62, 0.6],
  [0.32, 0.33, 0.38],
  [0.3, 0.3, 0.33],
  [0.8, 0.77, 0.68],
  [0.36, 0.33, 0.46],
  [0.7, 0.68, 0.66],
];
/* terrain TR-4: how many rows of 64 px cells the wall atlas has (3 before TR-4, 4 after; 3 until the picture is in) */
export function wallAtlasRows(im) {
  const w = (im && (im.naturalWidth || im.width)) || 0,
    h = (im && (im.naturalHeight || im.height)) || 0;
  return w > 0 && h > 0 ? clamp(Math.round(h / (w / 4)), 3, 4) : 3;
}
/* terrain TR-4: a generated place's biome's cliff block (biomes.json cliff: mat, strata, band, snowLine), read when it is
   drawn (mapgen doesn't copy it, so a scene's hash is unchanged); null for a hand-made map, which has no biome */
export function biomeCliff(sc) {
  if (!sc) return null;
  /* a seamless view carries no biome: its base place (the map you stand in) has it */
  const base = sc.biome || !sc.baseId ? null : mapById(sc.baseId),
    B = ((gameData && gameData.biomes) || {})[sc.biome || (base && base.biome) || ''];
  return (B && B.cliff) || null;
}
export function defaultWallMaterial(sc) {
  if (sc.cliffMat) return sc.cliffMat;
  const K = engineSetting('world', 'cliffFaces') ? biomeCliff(sc) : null;
  if (K) return K.mat;
  if (sc.far === 'canyon') return 2;
  if (sc.indoor && sc.far === 'cave') return 3;
  if (sc.indoor) return 10;
  if (/city|town/.test(sc.far || '') && sc.folk > 6) return 5;
  return 1;
}
/* walking: too steep is blocked (worked out once per scene, with the rest of the walking grid) */
const baseNavGrid = navGrid;
setNavGrid(function () {
  const sc = walkView.sc,
    fresh = !(
      walkView.nav &&
      walkView.navSc === sc &&
      walkView.navG === walkView.gkey &&
      walkView.navP === (sc.props || []).length
    ),
    n = baseNavGrid();
  if (!fresh || !sc.heights || !sc.heights.length || n._hk) return n;
  const { N, gw, gh, blk } = n;
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      if (blk[j * gw + i]) continue; /* (already blocked: in a room, all of the place outside it) */
      const x = (i + 0.5) / N,
        z = (j + 0.5) / N,
        e = 0.3;
      /* RL-8: on a bridge you walk on its deck, not on the steep bank under it (a run's streams have steep banks) */
      if (sc.bridges && bridgeAt(x, z, sc) != null) continue;
      const gx = (rawHeightAt(sc, x + e, z) - rawHeightAt(sc, x - e, z)) / (2 * e),
        gz = (rawHeightAt(sc, x, z + e) - rawHeightAt(sc, x, z - e)) / (2 * e);
      if (Math.hypot(gx, gz) > 1.05) blk[j * gw + i] = 1;
    }
  n._hk = 1;
  return n;
});
