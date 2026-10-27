// @ts-check
'use strict';
/* ================= MODEL OBJ (studio track ST-7: Model mode import) =================
   A Wavefront .obj with its .mtl and pictures beside it, read into the same shape as model-gltf.js readGltf, so
   model-mesh.js treats both alike: one node per object or group (o, g), its triangles (polygons fanned), normals
   and texture coordinates where the file has them, vertex colours (v x y z r g b, as MagicaVoxel and others write),
   materials from the .mtl (Kd, d or Tr, map_Kd). Indices may count from the end (negative).
   Axes: Blender's OBJ export has y up and the front at -z; glTF's front is +z, so the model is turned half round
   about y here (a turn, not a mirror: the triangles keep facing out). Texture coordinates start at the bottom in an
   OBJ and at the top in glTF: v is flipped. Pivots are each group's lowest middle point (OBJ has no nodes).
   Logic only: no DOM, runs in Node (tools/test/model-import.test.mjs). */
/** @import { ModelFiles, ModelSource, ModelMaterial, ModelImage, ModelNode } from './model-gltf.js' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { gltfSideFile, utf8Text } from './model-gltf.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  readMtl: [() => readMtl, v => (readMtl = v)],
  // @ts-expect-error -- replaced on purpose
  readObj: [() => readObj, v => (readObj = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the .mtl's materials: name -> { color, map } */
export function readMtl(text) {
  /** @type {Record<string, { color: number[], map: string }>} */
  const out = {};
  /** @type {{ color: number[], map: string } | null} */
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...a] = line.split(/\s+/);
    if (k === 'newmtl') out[a.join(' ')] = cur = { color: [1, 1, 1, 1], map: '' };
    else if (!cur) continue;
    else if (k === 'Kd') cur.color = [+a[0], +(a[1] ?? a[0]), +(a[2] ?? a[0]), cur.color[3]];
    else if (k === 'd') cur.color[3] = +a[0];
    else if (k === 'Tr') cur.color[3] = 1 - +a[0];
    else if (k === 'map_Kd') cur.map = a[a.length - 1] || '';
  }
  return out;
}

/**
 * @param {ModelFiles} files
 * @param {string} main
 * @returns {ModelSource}
 */
export function readObj(files, main) {
  const raw = files[main];
  if (!raw) throw new Error(`No file "${main}".`);
  const text = utf8Text(raw),
    warnings = [];
  /** @type {number[][]} */
  const V = [],
    VT = [],
    VN = [],
    VC = [];
  /** @type {ModelMaterial[]} */
  const materials = [];
  /** @type {ModelImage[]} */
  const images = [];
  /** @type {Record<string, number>} */
  const matIndex = {};
  /** @type {Record<string, { color: number[], map: string }>} */
  let mtl = {};
  /* each group: its corners, [v, vt, vn] per corner, 3 a triangle, with its material */
  /** @type {{ name: string, tris: { mat: number, c: number[][] }[] }[]} */
  const groups = [];
  /** @type {{ name: string, tris: { mat: number, c: number[][] }[] } | null} */
  let g = null;
  let mat = -1,
    anyColour = false;
  const group = (/** @type {string} */ name) => {
    g = groups.find(q => q.name === name) || null;
    if (!g) groups.push((g = { name, tris: [] }));
    return /** @type {{ name: string, tris: { mat: number, c: number[][] }[] }} */ (g);
  };
  const material = (/** @type {string} */ name) => {
    if (matIndex[name] !== undefined) return matIndex[name];
    const m = mtl[name] || { color: [0.8, 0.8, 0.8, 1], map: '' };
    if (!mtl[name]) warnings.push(`Material "${name}" isn't in the .mtl: drawn grey.`);
    let image = -1;
    if (m.map) {
      const name2 = m.map.replace(/^.*[\\/]/, '');
      image = images.findIndex(i => i.name === name2);
      if (image < 0) {
        let bytes = new Uint8Array(0);
        try {
          bytes = gltfSideFile(files, name2);
        } catch (e) {
          warnings.push(`${/** @type {Error} */ (e).message} Drawn in its material's colour.`);
        }
        images.push({ name: name2, mime: /\.jpe?g$/i.test(name2) ? 'image/jpeg' : 'image/png', bytes });
        image = images.length - 1;
      }
    }
    materials.push({
      name,
      color: m.color.slice(),
      image,
      texCoord: 0,
      alpha: m.color[3] < 1 ? 'BLEND' : 'OPAQUE',
      cutoff: 0.5,
      wrap: true,
    });
    return (matIndex[name] = materials.length - 1);
  };
  const at = (/** @type {string} */ s, /** @type {number} */ n) => {
    if (!s) return -1;
    const i = parseInt(s, 10);
    if (!Number.isFinite(i) || i === 0) return -1;
    return i < 0 ? n + i : i - 1;
  };
  for (const raw2 of text.split(/\r?\n/)) {
    const line = raw2.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...a] = line.split(/\s+/);
    if (k === 'v') {
      V.push([+a[0], +a[1], +a[2]]);
      if (a.length >= 6) {
        VC.push([+a[3], +a[4], +a[5]]);
        anyColour = true;
      } else VC.push([1, 1, 1]);
    } else if (k === 'vt') VT.push([+a[0], +(a[1] || 0)]);
    else if (k === 'vn') VN.push([+a[0], +a[1], +a[2]]);
    else if (k === 'o' || k === 'g') group(a.join(' ') || 'object');
    else if (k === 'mtllib') {
      try {
        mtl = { ...mtl, ...readMtl(utf8Text(gltfSideFile(files, a.join(' ')))) };
      } catch (e) {
        warnings.push(`${/** @type {Error} */ (e).message} Its materials are drawn grey.`);
      }
    } else if (k === 'usemtl') mat = material(a.join(' '));
    else if (k === 'f') {
      const c = a.map(s => {
        const [v, t, n] = s.split('/');
        return [at(v, V.length), at(t, VT.length), at(n, VN.length)];
      });
      if (c.some(q => q[0] < 0 || q[0] >= V.length))
        throw new Error(`A face points at a vertex that isn't there: "${line}".`);
      const G2 = g || group(main.replace(/\.obj$/i, ''));
      for (let i = 1; i + 1 < c.length; i++) G2.tris.push({ mat, c: [c[0], c[i], c[i + 1]] });
    }
  }
  /** @type {ModelNode[]} */
  const nodes = [];
  for (const q of groups) {
    if (!q.tris.length) continue;
    /* one primitive per material: the corners as their own vertices (an OBJ corner has its own v, vt, vn) */
    const byMat = new Map();
    for (const t of q.tris) {
      if (!byMat.has(t.mat)) byMat.set(t.mat, []);
      byMat.get(t.mat).push(t);
    }
    const prims = [];
    let lo = Infinity,
      xs = 0,
      zs = 0,
      cnt = 0;
    for (const [m, T] of byMat) {
      const n = T.length * 3,
        pos = new Float32Array(n * 3),
        hasN = T.every((/** @type {any} */ t) => t.c.every((/** @type {number[]} */ c) => c[2] >= 0)),
        hasT = T.every((/** @type {any} */ t) => t.c.every((/** @type {number[]} */ c) => c[1] >= 0)),
        nrm = hasN ? new Float32Array(n * 3) : null,
        uv = hasT ? new Float32Array(n * 2) : null,
        col = anyColour ? new Float32Array(n * 4) : null,
        idx = new Uint32Array(n);
      T.forEach((/** @type {any} */ t, /** @type {number} */ ti) =>
        t.c.forEach((/** @type {number[]} */ c, /** @type {number} */ j) => {
          const v = ti * 3 + j,
            p = V[c[0]];
          /* half a turn about y: Blender's OBJ front (-z) to glTF's (+z) */
          pos.set([-p[0], p[1], -p[2]], v * 3);
          lo = Math.min(lo, p[1]);
          xs -= p[0];
          zs -= p[2];
          cnt++;
          if (nrm) {
            const q2 = VN[c[2]];
            nrm.set([-q2[0], q2[1], -q2[2]], v * 3);
          }
          if (uv) uv.set([VT[c[1]][0], 1 - VT[c[1]][1]], v * 2);
          if (col) col.set([...VC[c[0]], 1], v * 4);
          idx[v] = v;
        })
      );
      prims.push({ pos, nrm, uv, col, idx, mat: m });
    }
    nodes.push({
      name: q.name,
      parent: -1,
      pivot: [xs / cnt, lo, zs / cnt],
      axes: [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      extras: null,
      prims,
    });
  }
  if (!nodes.length) throw new Error('No faces in this .obj.');
  return { format: 'obj', nodes, materials, images, warnings, unitsHint: '' };
}
