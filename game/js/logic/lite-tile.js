// @ts-check
'use strict';
/* ================= LITE TILES FROM THE 32 PX GROUND (Studio art track SA-2a) =================
   The full-mode ground is next/tiles47: twelve 32 px tiles a kind. Lite mode (and the Walk scenes thumbnails) draw
   the 16 px tiles of scene/tiles: a kind's base tile from its first 32 px tile, its five variants (_1.._5) from tiles
   2-6. Lite lays no soft patches of light and shade over the ground, so each 16 px tile has a piece of them baked in,
   taken at its own spot of the world, before the halving (a 2 x 2 box average).
   tools/build-terrain-v47.py made them (its `small`); it retired in SA-2a, when the Studio's ground tile set became
   the place the 32 px tiles are painted, and the Studio makes the 16 px ones from them with this module.
   The soft patches are the game's own sums (walk-view.js groundToneAt and applyGroundTone), passed in, so there is
   one copy of them. Logic only: no DOM, runs in Node (tools/test/lite-tile.test.mjs). */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray | Uint8Array }} Pixels */
/** @typedef {{ toneAt: (x: number, z: number) => number, applyTone: (c: number, v: number, odd: boolean, k: number) => number }} ToneFns */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LITE_FROM: [() => LITE_FROM],
  LITE_SAME: [() => LITE_SAME],
  LITE_SIZE: [() => LITE_SIZE],
  // @ts-expect-error -- replaced on purpose
  liteDiff: [() => liteDiff, v => (liteDiff = v)],
  liteKindName: [() => liteKindName],
  // @ts-expect-error -- replaced on purpose
  liteTile: [() => liteTile, v => (liteTile = v)],
  // @ts-expect-error -- replaced on purpose
  liteTileOf: [() => liteTileOf, v => (liteTileOf = v)],
  // @ts-expect-error -- replaced on purpose
  liteTilePlan: [() => liteTilePlan, v => (liteTilePlan = v)],
  // @ts-expect-error -- replaced on purpose
  liteToneK: [() => liteToneK, v => (liteToneK = v)],
  // @ts-expect-error -- replaced on purpose
  sameTiles: [() => sameTiles, v => (sameTiles = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the 32 px tiles a metre and the size of a Lite tile */
export const LITE_FROM = 32,
  LITE_SIZE = 16;

/* a kind's name from its catalogue tile path: scene/tiles/<name>.png */
export const liteKindName = (/** @type {string} */ tile) =>
  String(tile || '')
    .replace(/^.*\//, '')
    .replace(/\.png$/i, '');

/* how far a Lite tile may be from the one its 32 px tile makes and still count as made from it (rounding) */
export const LITE_SAME = 1;

/** the largest difference of a colour channel between two pictures of one size (Infinity when the sizes differ)
 * @param {Pixels} a @param {Pixels} b */
export function liteDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let worst = 0;
  for (let i = 0; i < a.data.length; i++)
    if (i % 4 !== 3) {
      const d = Math.abs(a.data[i] - b.data[i]);
      if (d > worst) worst = d;
    }
  return worst;
}

/** which Lite tile each 32 px tile makes: the base (the catalogue's `tile`) from tile 1, the variants (its `vars`,
 * _1.._5) from tiles 2-6. Every path comes from the catalogue and walk-view.js bigTilePaths, never written here.
 * @param {{ tile: string, vars?: string[] }} terrain a catalogue kind (scenery.terrains)
 * @param {string[]} big its twelve 32 px tiles, in order
 * @returns {{ from: string, to: string, k: number }[]} paths under art/ */
export function liteTilePlan(terrain, big) {
  const to = [terrain.tile, ...(terrain.vars || [])],
    out = [];
  for (let k = 0; k < 6; k++) if (to[k] && big[k]) out.push({ from: big[k], to: to[k], k });
  return out;
}

/** the Lite tile a 32 px tile number (1-12) makes, or null (tiles 7-12)
 * @param {{ tile: string, vars?: string[] }} terrain @param {string[]} big @param {number} n */
export function liteTileOf(terrain, big, n) {
  return liteTilePlan(terrain, big).find(p => p.k === n - 1) || null;
}

/** how strongly the soft patches lie on a kind: its catalogue `tone`, else none on paving and full on the rest (as
 * walk-view.js's ground painter reads it)
 * @param {{ tone?: number, paved?: boolean } | null | undefined} terrain */
export function liteToneK(terrain) {
  if (!terrain) return 0;
  return terrain.tone != null ? +terrain.tone : terrain.paved ? 0 : 1;
}

/** the 16 px Lite tile from a 32 px one: the soft patches of variant k (0 the base) at full size, then halved
 * @param {Pixels} src RGBA, 32 x 32
 * @param {number} k the variant (0-5): it picks the spot of the world the patches come from
 * @param {number} toneK how strongly the patches lie (liteToneK)
 * @param {ToneFns} tone
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }} */
export function liteTile(src, k, toneK, tone) {
  const W = src.width,
    H = src.height,
    d = src.data,
    rgb = new Float64Array(W * H * 3);
  const x0 = 13.7 * k + 3.1,
    z0 = 7.3 * k + 1.9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4,
        o = (y * W + x) * 3;
      let c = d[i] | (d[i + 1] << 8) | (d[i + 2] << 16);
      if (toneK > 0)
        c = tone.applyTone(
          c,
          tone.toneAt(x0 + (x + 0.5) / LITE_FROM, z0 + (y + 0.5) / LITE_FROM),
          (x + y) % 2 === 1,
          toneK
        );
      rgb[o] = c & 255;
      rgb[o + 1] = (c >> 8) & 255;
      rgb[o + 2] = (c >> 16) & 255;
    }
  const w = Math.max(1, W >> 1),
    h = Math.max(1, H >> 1),
    out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      for (let n = 0; n < 3; n++) {
        const at = (/** @type {number} */ yy, /** @type {number} */ xx) => rgb[(yy * W + xx) * 3 + n];
        out[o + n] = Math.round(
          (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4
        );
      }
      out[o + 3] = 255;
    }
  return { width: w, height: h, data: out };
}

/** the tile numbers (1-12) of a kind whose pixels are the same as an earlier one's (the quick check's Ground step
 * wants twelve different tiles a kind)
 * @param {(Pixels | null)[]} tiles the twelve, in order (null: not loaded) */
export function sameTiles(tiles) {
  /** @type {[number, number][]} */
  const out = [],
    keys = tiles.map(t => (t ? t.width + 'x' + t.height + ':' + Array.prototype.join.call(t.data, ',') : ''));
  for (let i = 0; i < keys.length; i++)
    for (let j = 0; j < i; j++)
      if (keys[i] && keys[i] === keys[j]) {
        out.push([j + 1, i + 1]);
        break;
      }
  return out;
}
