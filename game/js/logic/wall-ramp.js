// @ts-check
'use strict';
/* ================= WALL RAMP (Studio art track SA-2b) =================
   The game's textured surfaces that are greyscale sheets coloured in the shader: the walls and cliffs
   (art/scene/build/walls.png: 4 x 3 cells of 64 px, walk-shaders.js rampW) and the buildings' walls and roofs
   (art/scene/build/detail-a04b.png: 8 cells across of 64 px, buildings.js rampC). One cell covers 2 m (32 px a metre)
   and repeats; only the red channel is read, as one of five levels (dark, darker, the colour, light, lighter), each
   the surface's colour mixed as here. Also the names of the cells and rooms (tools/build-walls.py,
   build-buildings.py, build-props-a04.py, build-airship.py and build-props-batch1.py drew them) and a flag's ripple
   (walk-shaders.js uWave), for the Studio's previews (studio/js/scene-art-preview.js).
   Logic only: no DOM, runs in Node (tools/test/wall-ramp.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BUILD_CELL_NAMES: [() => BUILD_CELL_NAMES],
  ROOM_FACES: [() => ROOM_FACES],
  ROOM_NAMES: [() => ROOM_NAMES],
  WALL_CELL_NAMES: [() => WALL_CELL_NAMES],
  // @ts-expect-error -- replaced on purpose
  flagRipple: [() => flagRipple, v => (flagRipple = v)],
  mix3: [() => mix3],
  // @ts-expect-error -- replaced on purpose
  wallCellColoured: [() => wallCellColoured, v => (wallCellColoured = v)],
  wallHex: [() => wallHex],
  wallLevel: [() => wallLevel],
  // @ts-expect-error -- replaced on purpose
  wallOffLevels: [() => wallOffLevels, v => (wallOffLevels = v)],
  // @ts-expect-error -- replaced on purpose
  wallRamp: [() => wallRamp, v => (wallRamp = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* walk-view's walls.png cells, in order (heights.js WALL_MATERIALS) */
export const WALL_CELL_NAMES = [
  'scene rock',
  'rock',
  'layered sandstone',
  'cave rock',
  'brick',
  'dressed stone',
  'hedge',
  'wooden boards',
  'stone steps',
  'mossy rock',
  'concrete',
  'dark slate',
  /* terrain TR-4: the biomes' cliff faces (the fourth row) */
  'columnar basalt',
  'limestone',
  'crystal-veined rock',
  'speckled granite',
];
/* the building sheet's cells (detail-a04b.png); past the end reads as plaster */
export const BUILD_CELL_NAMES = [
  'plaster',
  'siding',
  'brick',
  'stone',
  'battens',
  'panels',
  'corrugated',
  'tile wall',
  'clay tiles',
  'shingles',
  'slate',
  'thatch',
  'metal seams',
  'flat roof',
  'planks',
  'plain (trim)',
  'moss',
  'solar shingles',
  'balloon cloth',
  'rivets',
  'stripes',
  'rings',
  'bark',
  'rock',
];
/* rooms.png: a row a room, its four columns the faces */
export const ROOM_NAMES = ['living room', 'kitchen', 'bedroom', 'shop', 'office', 'clinic', 'lab', 'stairs'];
export const ROOM_FACES = ['back wall', 'side wall', 'floor', 'ceiling'];

export const mix3 = (/** @type {number[]} */ a, /** @type {number[]} */ b, /** @type {number} */ t) =>
  a.map((v, i) => v + (b[i] - v) * t);
/** the colour of one level (0-4) of a surface whose colour is b (0-1 each), as rampW and rampC
 * @param {number[]} b @param {number} t @returns {number[]} */
export function wallRamp(b, t) {
  if (t < 0.5)
    return mix3(
      b.map(v => v * 0.55),
      [0.235, 0.165, 0.439],
      0.3
    );
  if (t < 1.5)
    return mix3(
      b.map(v => v * 0.79),
      [0.376, 0.29, 0.596],
      0.17
    );
  if (t < 2.5) return b.slice();
  if (t < 3.5) return mix3(b, [1, 0.957, 0.769], 0.3);
  return mix3(b, [1, 0.988, 0.918], 0.6);
}
/** the level the shader reads from a red value (0-255): floor(r / 255 * 4 + .5) @param {number} r */
export const wallLevel = r => Math.floor((r / 255) * 4 + 0.5);
/** how many opaque pixels sit between two levels (more than a tenth of a step off one), in a box of an RGBA picture
 * @param {ArrayLike<number>} rgba @param {number} w @param {number[]} box [x, y, w, h] */
export function wallOffLevels(rgba, w, box) {
  let n = 0;
  for (let y = box[1]; y < box[1] + box[3]; y++)
    for (let x = box[0]; x < box[0] + box[2]; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < 128) continue;
      const v = (rgba[i] / 255) * 4;
      if (Math.abs(v - Math.round(v)) > 0.1) n++;
    }
  return n;
}
/** a '#RRGGBB' colour as 0-1 numbers @param {string} h */
export const wallHex = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) / 255);

/** a cell (box [x, y, w, h] of the sheet) coloured as the game colours it: RGBA w x h
 * @param {ArrayLike<number>} rgba the sheet @param {number} W its width @param {number[]} box @param {number[]} base 0-1 */
export function wallCellColoured(rgba, W, box, base) {
  const [x0, y0, w, h] = box,
    out = new Uint8ClampedArray(w * h * 4),
    lv = [0, 1, 2, 3, 4].map(t => wallRamp(base, t).map(v => Math.round(Math.max(0, Math.min(1, v)) * 255)));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * W + x0 + x) * 4,
        c = lv[Math.max(0, Math.min(4, wallLevel(rgba[i])))],
        o = (y * w + x) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = 255;
    }
  return out;
}

/** a flag's ripple at u (0 at the pole, 1 at the free end) and time t (ms), wind lean `lean`: the cloth's shift up and
 * toward the pole (metres) and its brightness (1 + vRip), as walk-shaders.js's sprite program with uWave
 * @param {number} u @param {number} t @param {number} lean @param {number} [x] the pole's x (a phase per pole) */
export function flagRipple(u, t, lean, x = 0) {
  const amp = 0.05 + Math.abs(lean) * 1.1,
    ph = u * 6.5 - (t / 170 + x * 0.7),
    a = amp * u;
  return {
    up: Math.sin(ph + 0.8) * a * 0.45,
    back: u * u * amp * 0.35 * (0.5 + 0.5 * Math.sin(ph - 1.2)),
    light: 1 + Math.cos(ph) * a * 2.2,
  };
}
