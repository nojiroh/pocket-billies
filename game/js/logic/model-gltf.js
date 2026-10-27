// @ts-check
'use strict';
/* ================= MODEL GLTF (studio track ST-7: Model mode import) =================
   A glTF 2.0 model read by hand: a .glb (one file: the JSON chunk and the binary chunk), or a .gltf with the files it
   names beside it (its .bin and its pictures; only plain names in the same folder, as tools/glb-to-recipe.py allows,
   or data: links). What comes out is the model as the source has it (glTF's own axes: y up, the front at +z; the
   source's units): one entry per node that has a mesh, with its triangles already placed by the node's whole
   transform, its parent among those entries, its pivot (where the node's origin lands) and its extras (where a
   Blender round trip keeps spins and joints: extras.pb, ST-8), the materials (colour, picture) and the pictures as
   bytes (the Studio decodes them). model-mesh.js makes the game's mesh from it.
   Read: accessors with a byte stride, normalised integers, sparse accessors; node matrices or translation, rotation
   and scale; triangles, strips and fans (points and lines are left out); a mirrored node's triangles turned round so
   they still face out; vertex colours (COLOR_0); the texture's coordinate set (TEXCOORD_n). Refused with a message:
   Draco and meshopt compression (the file is made again without it). Left out with a warning: skins and morph
   targets (no skinning: ST decisions), cameras, lights, animations.
   The port of RP-3's reader (tools/glb-to-recipe.py read_gltf, accessor, load_triangles); the unit test reads the
   same three KayKit files and finds the same triangles.
   Logic only: no DOM, runs in Node (tools/test/model-import.test.mjs). */
/** @typedef {Record<string, Uint8Array>} ModelFiles file name -> bytes (the model and the files beside it) */
/** @typedef {{ name: string, color: number[], image: number, texCoord: number, alpha: string, cutoff: number, wrap: boolean }} ModelMaterial color: base colour 0-1 RGBA; image: index into images or -1 */
/** @typedef {{ name: string, mime: string, bytes: Uint8Array }} ModelImage */
/** @typedef {{ pos: Float32Array, nrm: Float32Array | null, uv: Float32Array | null, col: Float32Array | null, idx: Uint32Array, mat: number }} ModelPrim triangles: idx in threes */
/** @typedef {{ name: string, parent: number, pivot: number[], axes: number[][], extras: any, prims: ModelPrim[] }} ModelNode axes: the node's own x, y, z directions in the model (unit) */
/** @typedef {{ format: string, nodes: ModelNode[], materials: ModelMaterial[], images: ModelImage[], warnings: string[], unitsHint: string }} ModelSource */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  GLTF_COMP: [() => GLTF_COMP],
  GLTF_NCOMP: [() => GLTF_NCOMP],
  GLTF_NORM: [() => GLTF_NORM],
  GLTF_REFUSED: [() => GLTF_REFUSED],
  // @ts-expect-error -- replaced on purpose
  base64Decode: [() => base64Decode, v => (base64Decode = v)],
  // @ts-expect-error -- replaced on purpose
  base64Encode: [() => base64Encode, v => (base64Encode = v)],
  // @ts-expect-error -- replaced on purpose
  gltfAccessor: [() => gltfAccessor, v => (gltfAccessor = v)],
  gltfMat3Det: [() => gltfMat3Det],
  // @ts-expect-error -- replaced on purpose
  gltfMat4Mul: [() => gltfMat4Mul, v => (gltfMat4Mul = v)],
  gltfMat4Point: [() => gltfMat4Point],
  // @ts-expect-error -- replaced on purpose
  gltfNodeMatrix: [() => gltfNodeMatrix, v => (gltfNodeMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  gltfNormalMatrix: [() => gltfNormalMatrix, v => (gltfNormalMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  gltfParts: [() => gltfParts, v => (gltfParts = v)],
  // @ts-expect-error -- replaced on purpose
  gltfSideFile: [() => gltfSideFile, v => (gltfSideFile = v)],
  // @ts-expect-error -- replaced on purpose
  gltfTriangles: [() => gltfTriangles, v => (gltfTriangles = v)],
  // @ts-expect-error -- replaced on purpose
  readGltf: [() => readGltf, v => (readGltf = v)],
  // @ts-expect-error -- replaced on purpose
  utf8Bytes: [() => utf8Bytes, v => (utf8Bytes = v)],
  // @ts-expect-error -- replaced on purpose
  utf8Text: [() => utf8Text, v => (utf8Text = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const GLTF_COMP = /** @type {Record<number, [string, number]>} */ ({
  5120: ['Int8', 1],
  5121: ['Uint8', 1],
  5122: ['Int16', 2],
  5123: ['Uint16', 2],
  5125: ['Uint32', 4],
  5126: ['Float32', 4],
});
export const GLTF_NCOMP = /** @type {Record<string, number>} */ ({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
});
export const GLTF_NORM = /** @type {Record<string, number>} */ ({ Int8: 127, Uint8: 255, Int16: 32767, Uint16: 65535 });
/** compressions the reader can't undo: the file is made again without them */
export const GLTF_REFUSED = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_meshopt_compression'];

/** a file the model names beside it: a data: link, else only a plain name in the model's own folder (no paths out of it) */
export function gltfSideFile(files, uri) {
  if (/^data:/i.test(uri)) {
    const c = uri.indexOf(',');
    if (c < 0) throw new Error('A data: link without data.');
    const body = uri.slice(c + 1);
    return /;base64$/i.test(uri.slice(0, c)) ? base64Decode(body) : utf8Bytes(decodeURIComponent(body));
  }
  let name = uri;
  try {
    name = decodeURIComponent(uri);
  } catch {
    /* keep it as written */
  }
  if (/[\\/]/.test(name) || name === '' || name === '.' || name === '..')
    throw new Error(`Refusing the file name "${uri}": only files beside the model.`);
  const hit = files[name] || files[Object.keys(files).find(k => k.toLowerCase() === name.toLowerCase()) || ''];
  if (!hit) throw new Error(`The model needs "${name}" beside it: drop it together with the model.`);
  return hit;
}
/** UTF-8 bytes as text (the logic has no TextDecoder) */
export function utf8Text(b) {
  let s = '';
  for (let i = 0; i < b.length;) {
    const c = b[i++];
    let u = c;
    if (c >= 0xf0) u = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) u = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xc0) u = ((c & 31) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(u);
  }
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
/** text as UTF-8 bytes */
export function utf8Bytes(s) {
  const o = [];
  for (const ch of s) {
    const u = /** @type {number} */ (ch.codePointAt(0));
    if (u < 0x80) o.push(u);
    else if (u < 0x800) o.push(0xc0 | (u >> 6), 0x80 | (u & 63));
    else if (u < 0x10000) o.push(0xe0 | (u >> 12), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
    else o.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 63), 0x80 | ((u >> 6) & 63), 0x80 | (u & 63));
  }
  return Uint8Array.from(o);
}
/** base64 to bytes, without atob (Node and the page alike) */
export function base64Decode(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    t = s.replace(/[^A-Za-z0-9+/]/g, ''),
    out = new Uint8Array(Math.floor((t.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < t.length; i += 4) {
    const n =
      (A.indexOf(t[i]) << 18) |
      (A.indexOf(t[i + 1]) << 12) |
      ((i + 2 < t.length ? A.indexOf(t[i + 2]) : 0) << 6) |
      (i + 3 < t.length ? A.indexOf(t[i + 3]) : 0);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length && i + 2 < t.length) out[o++] = (n >> 8) & 255;
    if (o < out.length && i + 3 < t.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}
/** bytes to base64 (the mesh format's vertex data) */
export function base64Encode(b) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
    s +=
      A[(n >> 18) & 63] +
      A[(n >> 12) & 63] +
      (i + 1 < b.length ? A[(n >> 6) & 63] : '=') +
      (i + 2 < b.length ? A[n & 63] : '=');
  }
  return s;
}

/** the JSON and its buffers from a .glb or a .gltf (main: the model's file name in files) */
export function gltfParts(files, main) {
  const raw = files[main];
  if (!raw) throw new Error(`No file "${main}".`);
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let G,
    bin = null;
  if (raw.length >= 12 && dv.getUint32(0, true) === 0x46546c67) {
    if (dv.getUint32(4, true) !== 2) throw new Error('Only glTF 2.0 files can be read.');
    const total = Math.min(dv.getUint32(8, true), raw.length);
    let off = 12;
    while (off + 8 <= total) {
      const n = dv.getUint32(off, true),
        kind = dv.getUint32(off + 4, true),
        chunk = raw.subarray(off + 8, off + 8 + n);
      if (kind === 0x4e4f534a) G = JSON.parse(utf8Text(chunk));
      else if (kind === 0x004e4942 && !bin) bin = chunk;
      off += 8 + n + ((4 - (n % 4)) % 4);
    }
    if (!G) throw new Error('This .glb has no JSON chunk.');
  } else {
    try {
      G = JSON.parse(utf8Text(raw));
    } catch {
      throw new Error('This is neither a .glb nor a .gltf (JSON) file.');
    }
  }
  if (!G.asset || String(G.asset.version || '').split('.')[0] !== '2')
    throw new Error('Only glTF 2.0 files can be read.');
  const req = [...(G.extensionsRequired || []), ...(G.extensionsUsed || [])].filter(e => GLTF_REFUSED.includes(e));
  if (req.length)
    throw new Error(
      `This file is compressed (${[...new Set(req)].join(', ')}). Export it again without compression (Blender: glTF export, Data > Compression off).`
    );
  const bufs = (G.buffers || []).map((/** @type {any} */ b, /** @type {number} */ i) => {
    if (b.uri === undefined) {
      if (!bin || i !== 0) throw new Error('A buffer without a file or a .glb binary chunk.');
      return bin;
    }
    return gltfSideFile(files, b.uri);
  });
  return { G, bufs };
}

/** an accessor's values as rows of floats (normalised integers to 0-1 or -1-1), sparse values put in */
export function gltfAccessor(G, bufs, i) {
  const a = G.accessors && G.accessors[i];
  if (!a) throw new Error(`No accessor ${i}.`);
  const [ty, size] = GLTF_COMP[a.componentType] || [];
  if (!ty) throw new Error(`Accessor ${i}: an unknown component type ${a.componentType}.`);
  const nc = GLTF_NCOMP[a.type] || 1,
    out = new Float32Array(a.count * nc),
    norm = a.normalized && GLTF_NORM[ty] ? GLTF_NORM[ty] : 0;
  const readInto = (
    /** @type {number} */ view,
    /** @type {number} */ extra,
    /** @type {number} */ count,
    /** @type {(r: number, c: number, v: number) => void} */ put,
    /** @type {number} */ comps,
    /** @type {string} */ t,
    /** @type {number} */ sz
  ) => {
    const v = G.bufferViews[view];
    if (!v) throw new Error(`No buffer view ${view}.`);
    const buf = bufs[v.buffer];
    if (!buf) throw new Error(`No buffer ${v.buffer}.`);
    const d = new DataView(buf.buffer, buf.byteOffset, buf.byteLength),
      start = (v.byteOffset || 0) + (extra || 0),
      stride = v.byteStride || sz * comps,
      get = /** @type {(o: number, le: boolean) => number} */ (/** @type {any} */ (d)['get' + t].bind(d));
    if (start + (count - 1) * stride + sz * comps > buf.byteLength)
      throw new Error(`Accessor ${i} reads past its buffer.`);
    for (let r = 0; r < count; r++) for (let c = 0; c < comps; c++) put(r, c, get(start + r * stride + c * sz, true));
  };
  if (a.bufferView !== undefined)
    readInto(
      a.bufferView,
      a.byteOffset || 0,
      a.count,
      (r, c, v) => (out[r * nc + c] = norm ? Math.max(v / norm, -1) : v),
      nc,
      ty,
      size
    );
  if (a.sparse) {
    const s = a.sparse,
      [ity, isz] = GLTF_COMP[s.indices.componentType] || [],
      at = new Uint32Array(s.count);
    if (!ity) throw new Error(`Accessor ${i}: unknown sparse index type.`);
    readInto(s.indices.bufferView, s.indices.byteOffset || 0, s.count, (r, _c, v) => (at[r] = v), 1, ity, isz);
    readInto(
      s.values.bufferView,
      s.values.byteOffset || 0,
      s.count,
      (r, c, v) => {
        if (at[r] < a.count) out[at[r] * nc + c] = norm ? Math.max(v / norm, -1) : v;
      },
      nc,
      ty,
      size
    );
  }
  return { data: out, n: nc, count: a.count };
}

/** a node's local transform as a column-major 4x4 (glTF's own order) */
export function gltfNodeMatrix(n) {
  if (Array.isArray(n.matrix) && n.matrix.length === 16) return n.matrix.map(Number);
  const [tx, ty, tz] = n.translation || [0, 0, 0],
    [x, y, z, w] = n.rotation || [0, 0, 0, 1],
    [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}
/** a * b, both column-major 4x4 */
export function gltfMat4Mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export const gltfMat4Point = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
export const gltfMat3Det = m =>
  m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
/** the normal matrix's rows (the inverse transpose of the upper 3x3), for normals */
export function gltfNormalMatrix(m) {
  const a = m[0],
    b = m[4],
    c = m[8],
    d = m[1],
    e = m[5],
    f = m[9],
    g = m[2],
    h = m[6],
    k = m[10];
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g) || 1;
  /* inverse transpose = cofactor matrix / det */
  return [
    [(e * k - f * h) / det, -(d * k - f * g) / det, (d * h - e * g) / det],
    [-(b * k - c * h) / det, (a * k - c * g) / det, -(a * h - b * g) / det],
    [(b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det],
  ];
}
/** a primitive's triangles as indices (lists, strips and fans; others none) */
export function gltfTriangles(mode, idx, nVerts) {
  const I = idx || Uint32Array.from({ length: nVerts }, (_, i) => i),
    out = [];
  if (mode === 4) for (let i = 0; i + 2 < I.length; i += 3) out.push(I[i], I[i + 1], I[i + 2]);
  else if (mode === 5)
    for (let i = 0; i + 2 < I.length; i++) {
      if (i % 2) out.push(I[i + 1], I[i], I[i + 2]);
      else out.push(I[i], I[i + 1], I[i + 2]);
    }
  else if (mode === 6) for (let i = 1; i + 1 < I.length; i++) out.push(I[0], I[i], I[i + 1]);
  return Uint32Array.from(out);
}

/**
 * The model read: nodes with meshes (triangles in the model's space), materials, pictures, warnings.
 * @param {ModelFiles} files
 * @param {string} main
 * @returns {ModelSource}
 */
export function readGltf(files, main) {
  const { G, bufs } = gltfParts(files, main),
    warnings = [];
  const skipped = new Set();
  if ((G.skins || []).length)
    warnings.push(
      `${G.skins.length} skin(s) left out: models have jointed and spinning parts, no skinning. Each node is drawn at rest.`
    );
  if ((G.animations || []).length)
    warnings.push(`${G.animations.length} animation(s) left out (spins and joints are set in the parts list).`);
  if ((G.extensionsUsed || []).includes('KHR_texture_transform'))
    warnings.push('KHR_texture_transform is not read: a texture moved or scaled in the material may sit wrong.');
  const materials = (G.materials || []).map((/** @type {any} */ m, /** @type {number} */ i) => {
    const pbr = m.pbrMetallicRoughness || {},
      t = pbr.baseColorTexture,
      tex = t && G.textures && G.textures[t.index],
      smp = tex && tex.sampler !== undefined && G.samplers ? G.samplers[tex.sampler] || {} : {},
      wrap =
        !!tex && (smp.wrapS === undefined || smp.wrapS === 10497 || smp.wrapT === undefined || smp.wrapT === 10497);
    return {
      name: m.name || `material ${i}`,
      color: (pbr.baseColorFactor || [1, 1, 1, 1]).map(Number),
      image: tex && tex.source !== undefined ? tex.source : -1,
      texCoord: (t && t.texCoord) || 0,
      alpha: m.alphaMode || 'OPAQUE',
      cutoff: m.alphaCutoff ?? 0.5,
      wrap,
    };
  });
  const images = (G.images || []).map((/** @type {any} */ im, /** @type {number} */ i) => {
    let bytes = new Uint8Array(0);
    try {
      if (im.bufferView !== undefined) {
        const v = G.bufferViews[im.bufferView];
        bytes = bufs[v.buffer].subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
      } else bytes = gltfSideFile(files, im.uri);
    } catch (e) {
      warnings.push(
        `Picture ${im.name || im.uri || i}: ${/** @type {Error} */ (e).message} Drawn in its material's colour.`
      );
    }
    const mime = im.mimeType || (/\.jpe?g$/i.test(im.uri || '') ? 'image/jpeg' : 'image/png');
    return { name: im.name || (im.uri ? String(im.uri).replace(/^.*[\\/]/, '') : `picture ${i}`), mime, bytes };
  });
  /** @type {ModelNode[]} */
  const nodes = [];
  const walk = (
    /** @type {number} */ ni,
    /** @type {number[]} */ M,
    /** @type {number} */ parent,
    /** @type {Set<number>} */ seen
  ) => {
    if (seen.has(ni)) throw new Error('The node tree loops back on itself.');
    seen.add(ni);
    const n = G.nodes[ni];
    if (!n) return;
    const W = gltfMat4Mul(M, gltfNodeMatrix(n));
    let me = parent;
    if (n.mesh !== undefined && G.meshes && G.meshes[n.mesh]) {
      const mesh = G.meshes[n.mesh],
        flip = gltfMat3Det(W) < 0,
        NM = gltfNormalMatrix(W),
        prims = [];
      if (n.skin !== undefined) skipped.add('skin');
      for (const p of mesh.primitives || []) {
        const mode = p.mode ?? 4;
        if (mode < 4) {
          warnings.push(`${n.name || mesh.name || 'A node'}: points or lines left out.`);
          continue;
        }
        if (p.targets && p.targets.length) skipped.add('morph');
        const A = p.attributes || {};
        if (A.POSITION === undefined) continue;
        const P = gltfAccessor(G, bufs, A.POSITION),
          nv = P.count,
          pos = new Float32Array(nv * 3);
        for (let v = 0; v < nv; v++)
          pos.set(gltfMat4Point(W, P.data[v * 3], P.data[v * 3 + 1], P.data[v * 3 + 2]), v * 3);
        /** @type {Float32Array | null} */
        let nrm = null;
        if (A.NORMAL !== undefined) {
          const N = gltfAccessor(G, bufs, A.NORMAL);
          nrm = new Float32Array(nv * 3);
          for (let v = 0; v < nv; v++) {
            const x = N.data[v * 3],
              y = N.data[v * 3 + 1],
              z = N.data[v * 3 + 2];
            const q = NM.map(r => r[0] * x + r[1] * y + r[2] * z),
              l = Math.hypot(q[0], q[1], q[2]) || 1;
            nrm.set([q[0] / l, q[1] / l, q[2] / l], v * 3);
          }
        }
        const mat = p.material ?? -1,
          tc = mat >= 0 && materials[mat] ? materials[mat].texCoord : 0,
          uvA = A['TEXCOORD_' + tc];
        /** @type {Float32Array | null} */
        let uv = null;
        if (uvA !== undefined) {
          const U = gltfAccessor(G, bufs, uvA);
          uv = new Float32Array(nv * 2);
          for (let v = 0; v < nv; v++) uv.set([U.data[v * U.n], U.data[v * U.n + 1]], v * 2);
        }
        /** @type {Float32Array | null} */
        let col = null;
        if (A.COLOR_0 !== undefined) {
          const C = gltfAccessor(G, bufs, A.COLOR_0);
          col = new Float32Array(nv * 4);
          for (let v = 0; v < nv; v++)
            col.set(
              [C.data[v * C.n], C.data[v * C.n + 1], C.data[v * C.n + 2], C.n > 3 ? C.data[v * C.n + 3] : 1],
              v * 4
            );
        }
        /** @type {Uint32Array | null} */
        let ix = null;
        if (p.indices !== undefined) {
          const I = gltfAccessor(G, bufs, p.indices);
          ix = Uint32Array.from(I.data);
          for (const k of ix)
            if (k >= nv) throw new Error(`${n.name || 'A node'}: a triangle points past its vertices.`);
        }
        const idx = gltfTriangles(mode, ix, nv);
        /* a mirrored node (a negative scale) turns its triangles inside out: turned round again */
        if (flip) for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
        prims.push({ pos, nrm, uv, col, idx, mat });
      }
      const len = (/** @type {number} */ c) => Math.hypot(W[c], W[c + 1], W[c + 2]) || 1;
      nodes.push({
        name: n.name || mesh.name || `node ${ni}`,
        parent,
        pivot: [W[12], W[13], W[14]],
        axes: [0, 4, 8].map(c => [W[c] / len(c), W[c + 1] / len(c), W[c + 2] / len(c)]),
        extras: n.extras && typeof n.extras === 'object' ? n.extras : null,
        prims,
      });
      me = nodes.length - 1;
    }
    for (const c of n.children || []) walk(c, W, me, seen);
  };
  const scene = G.scenes && G.scenes.length ? G.scenes[G.scene || 0] || G.scenes[0] : null,
    roots = scene
      ? scene.nodes || []
      : (G.nodes || [])
          .map((/** @type {any} */ _n, /** @type {number} */ i) => i)
          .filter(
            (/** @type {number} */ i) => !(G.nodes || []).some((/** @type {any} */ m) => (m.children || []).includes(i))
          );
  const seen = new Set();
  for (const r of roots) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], -1, seen);
  if (skipped.has('morph')) warnings.push('Morph targets left out: the model is drawn in its base shape.');
  if (!nodes.some(n => n.prims.some(p => p.idx.length))) throw new Error('No triangles in this model.');
  const gen = String((G.asset && G.asset.generator) || '');
  return {
    format: main.toLowerCase().endsWith('.glb') ? 'glb' : 'gltf',
    nodes,
    materials,
    images,
    warnings,
    unitsHint: /blockbench/i.test(gen) ? 'blockbench' : '',
  };
}
