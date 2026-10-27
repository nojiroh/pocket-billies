// @ts-check
'use strict';
/* ================= MODEL VOX (studio track ST-7: Model mode import) =================
   A MagicaVoxel .vox read (the first model's SIZE and XYZI, the RGBA palette), as the Props section's voxel import
   always read it (model-editor.js vxeImport now calls voxParse), and its voxels as a model source of the shape
   model-gltf.js gives (voxSource: each voxel face that no other voxel covers, coloured), so Model mode can show a
   .vox beside the other formats and bake its picture. The prop itself stays a voxel recipe (a raw layer), drawn by
   the game's voxel path as before; voxel props become meshes in ST-8.
   MagicaVoxel's axes: z up, the front at -y; glTF's (the source shape's): y up, the front at +z.
   Logic only: no DOM, runs in Node (tools/test/model-import.test.mjs). */
/** @import { ModelSource } from './model-gltf.js' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { base64Encode } from './model-gltf.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  voxParse: [() => voxParse, v => (voxParse = v)],
  // @ts-expect-error -- replaced on purpose
  voxRawLayer: [() => voxRawLayer, v => (voxRawLayer = v)],
  // @ts-expect-error -- replaced on purpose
  voxSource: [() => voxSource, v => (voxSource = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * The first model of a .vox: its size, voxels [x, y, z, colour index 1-255] and palette (256 [r, g, b], index 1 at 0).
 * @param {Uint8Array} buf
 */
export function voxParse(buf) {
  if (buf.length < 8 || String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) !== 'VOX ')
    throw new Error('That is not a .vox file.');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 8,
    /** @type {number[] | null} */
    size = null,
    /** @type {number[][] | null} */
    xyzi = null,
    /** @type {number[][] | null} */
    pal = null;
  while (i + 12 <= buf.length) {
    const tag = String.fromCharCode(buf[i], buf[i + 1], buf[i + 2], buf[i + 3]),
      n = dv.getInt32(i + 4, true),
      body = i + 12;
    if (tag === 'SIZE' && !size)
      size = [dv.getInt32(body, true), dv.getInt32(body + 4, true), dv.getInt32(body + 8, true)];
    else if (tag === 'XYZI' && !xyzi) {
      const cnt = dv.getInt32(body, true);
      xyzi = [];
      for (let j = 0; j < cnt; j++)
        xyzi.push([buf[body + 4 + j * 4], buf[body + 5 + j * 4], buf[body + 6 + j * 4], buf[body + 7 + j * 4]]);
    } else if (tag === 'RGBA') {
      pal = [];
      for (let j = 0; j < 256; j++) pal.push([buf[body + j * 4], buf[body + j * 4 + 1], buf[body + j * 4 + 2]]);
    }
    i = body + n;
  }
  if (!xyzi) throw new Error('No voxels found in that file.');
  if (!pal) pal = Array.from({ length: 256 }, () => [200, 200, 200]);
  return { size, voxels: xyzi, palette: pal };
}

/**
 * A .vox's voxels as a voxel recipe's raw layer (the Props section's import): x, y, z, r, g, b a voxel in base64,
 * centred across and in depth on the base point, 32 voxels to the metre.
 * @param {ReturnType<typeof voxParse>} V
 * @param {string} file
 */
export function voxRawLayer(V, file) {
  const b = new Uint8Array(V.voxels.length * 6);
  V.voxels.forEach(([x, y, z, c], i) => {
    const col = V.palette[c - 1] || [200, 200, 200];
    b.set([x, y, z, col[0], col[1], col[2]], i * 6);
  });
  return {
    k: 'raw',
    name: file.replace(/\.vox$/i, ''),
    src: file,
    n: V.voxels.length,
    vpm: 32,
    x: 0,
    y: 0,
    z: 0,
    ox: -Math.round((V.size ? V.size[0] : 0) / 2),
    oy: -Math.round((V.size ? V.size[1] : 0) / 2),
    oz: 0,
    data: base64Encode(b),
  };
}
/**
 * A .vox's voxels as a model source: the faces no voxel covers, one node, vertex colours, 1 unit a voxel.
 * @param {ReturnType<typeof voxParse>} V
 * @param {string} name
 * @returns {ModelSource}
 */
export function voxSource(V, name) {
  const filled = new Set(V.voxels.map(v => `${v[0]},${v[1]},${v[2]}`)),
    pos = [],
    nrm = [],
    col = [],
    idx = [];
  /* each side: its normal (vox axes) and its four corners, counter-clockwise seen from outside */
  /** @type {[number[], number[][]][]} */
  const SIDES = [
    [
      [1, 0, 0],
      [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [0, 1, 0],
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
      ],
    ],
    [
      [0, 1, 0],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
      ],
    ],
    [
      [0, -1, 0],
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
    ],
    [
      [0, 0, 1],
      [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    ],
    [
      [0, 0, -1],
      [
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0],
        [0, 0, 0],
      ],
    ],
  ];
  /* vox (x, y, z up, front -y) to the source's (x, y up, front +z) */
  const to = (/** @type {number[]} */ p) => [p[0], p[2], -p[1]];
  for (const [x, y, z, c] of V.voxels) {
    const rgb = (V.palette[c - 1] || [200, 200, 200]).map(q => q / 255);
    for (const [n, corners] of SIDES) {
      if (filled.has(`${x + n[0]},${y + n[1]},${z + n[2]}`)) continue;
      const b = pos.length / 3;
      for (const q of corners) {
        pos.push(...to([x + q[0], y + q[1], z + q[2]]));
        nrm.push(...to(n));
        col.push(...rgb, 1);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  return {
    format: 'vox',
    nodes: [
      {
        name,
        parent: -1,
        pivot: [0, 0, 0],
        axes: [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ],
        extras: null,
        prims: [
          {
            pos: Float32Array.from(pos),
            nrm: Float32Array.from(nrm),
            uv: null,
            col: Float32Array.from(col),
            idx: Uint32Array.from(idx),
            mat: -1,
          },
        ],
      },
    ],
    materials: [],
    images: [],
    warnings: [],
    unitsHint: 'vox',
  };
}
