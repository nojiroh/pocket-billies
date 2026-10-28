// Characters track CH-3: a rigged glTF character (a .glb) to a figure the figure baker draws (game/js/figures.js):
// jointed rigid parts, each vertex on the joint that moves it most (the Studio's rule: "spinning and jointed parts; no
// skinning"), its clips sampled on the 12 fps clock, its texture point-sampled down and snapped to the master palette.
//
//   node tools/gltf-figure.mjs <model.glb> <name> [--height=1.75] [--tex=128] [--meshes=A,B] [--clips=src:name@fps,...]
//
//   <name>           writes game/art/figures/<name>.json and game/art/figures/<name>.png
//   --height=M       the figure's height to the top of its head, metres (1.75)
//   --tex=N          the texture's size, pixels (128: the source's atlas is swatches, so a point in each cell keeps it)
//   --meshes=A,B     the meshes to keep, by node name (by default every skinned mesh, and every other mesh but what a
//                    hand holds: a node under a `handslot` bone)
//   --clips=...      the clips to keep, `SourceName:name@fps` (by default Idle:idle@6, Walking_A:walk@12,
//                    Running_A:run@12, Cheer:cheer@12, Throw:throw@12, Sit_Chair_Idle:sit@6); an idle at 6 fps holds
//                    each pose two ticks of the 12 fps clock ("on twos"), at 12 one tick
//
// What it writes (format 1): `height`, `joints` (names, one a kept joint), `texture`, `vertices` (base64 Float32: x, y,
// z, the normal, the joint, u, v), `indices` (base64 Uint16 triangles), and `clips`: for each, `fps`, `frames`, `loop`,
// `lift` (the hips' height over their rest, metres, a frame: the baker snaps it to whole texels), `cycleM` (a walk or a
// run: metres a cycle, from its feet) and `matrices` (base64 Float32: for each frame and joint the 3 x 4 matrix that
// takes a vertex from where it is modelled to where the clip has it, column by column). The figure's axes are the
// game's: y up, facing +z, metres. The source's x is flipped: glTF is right-handed and the game's camera mirrors x
// (walk/camera.js), so without it a figure would be drawn as its mirror image.
// The source is a file on disk (a CC0 pack's, its licence in validation/cc0-src/LICENSES.md); nothing is fetched.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { deflateSync, inflateSync, crc32 } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');

/* ---------- the GLB ---------- */
export function readGlb(buf) {
  if (buf.toString('latin1', 0, 4) !== 'glTF') throw new Error('not a .glb');
  let at = 12,
    json = null,
    bin = null;
  while (at < buf.length) {
    const len = buf.readUInt32LE(at),
      type = buf.toString('latin1', at + 4, at + 8);
    if (type === 'JSON') json = JSON.parse(buf.toString('utf8', at + 8, at + 8 + len));
    else if (type === 'BIN\0') bin = buf.subarray(at + 8, at + 8 + len);
    at += 8 + len;
  }
  return { json, bin };
}
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYPES = {
  5120: [Int8Array, 127],
  5121: [Uint8Array, 255],
  5122: [Int16Array, 32767],
  5123: [Uint16Array, 65535],
  5125: [Uint32Array, 0],
  5126: [Float32Array, 0],
};
/** an accessor's values as rows of numbers (normalised integers made 0..1) */
export function accessor(G, i) {
  const A = G.json.accessors[i],
    V = G.json.bufferViews[A.bufferView],
    [T, norm] = TYPES[A.componentType],
    n = COMPONENTS[A.type],
    size = T.BYTES_PER_ELEMENT,
    stride = V.byteStride || n * size,
    base = (V.byteOffset || 0) + (A.byteOffset || 0),
    dv = new DataView(G.bin.buffer, G.bin.byteOffset, G.bin.byteLength),
    rows = [];
  const read = {
    5120: o => dv.getInt8(o),
    5121: o => dv.getUint8(o),
    5122: o => dv.getInt16(o, true),
    5123: o => dv.getUint16(o, true),
    5125: o => dv.getUint32(o, true),
    5126: o => dv.getFloat32(o, true),
  }[A.componentType];
  for (let k = 0; k < A.count; k++) {
    const r = [];
    for (let c = 0; c < n; c++) {
      const v = read(base + k * stride + c * size);
      r.push(A.normalized && norm ? Math.max(v / norm, -1) : v);
    }
    rows.push(r);
  }
  return rows;
}

/* ---------- matrices (column-major 4 x 4, as glTF has them) ---------- */
export const ID = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q,
    xx = x * x,
    yy = y * y,
    zz = z * z,
    xy = x * y,
    xz = x * z,
    yz = y * z,
    wx = w * x,
    wy = w * y,
    wz = w * z;
  return [
    (1 - 2 * (yy + zz)) * s[0],
    2 * (xy + wz) * s[0],
    2 * (xz - wy) * s[0],
    0,
    2 * (xy - wz) * s[1],
    (1 - 2 * (xx + zz)) * s[1],
    2 * (yz + wx) * s[1],
    0,
    2 * (xz + wy) * s[2],
    2 * (yz - wx) * s[2],
    (1 - 2 * (xx + yy)) * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ];
}
export function apply(m, p, w = 1) {
  return [0, 1, 2].map(r => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * w);
}
/* spherical between two unit quaternions */
export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (d > 0.9995) {
    const q = a.map((v, i) => v + (b[i] * s - v) * t),
      l = Math.hypot(...q);
    return q.map(v => v / l);
  }
  const th = Math.acos(d),
    k0 = Math.sin((1 - t) * th) / Math.sin(th),
    k1 = Math.sin(t * th) / Math.sin(th);
  return a.map((v, i) => v * k0 + b[i] * s * k1);
}

/* ---------- PNG, 8-bit, not interlaced ---------- */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let at = 8,
    w = 0,
    h = 0,
    depth = 0,
    ctype = 0,
    pal = null,
    trns = null;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at),
      type = buf.toString('latin1', at + 4, at + 8),
      d = buf.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      w = d.readUInt32BE(0);
      h = d.readUInt32BE(4);
      depth = d[8];
      ctype = d[9];
      if (d[12]) throw new Error('interlaced PNG');
    } else if (type === 'PLTE') pal = d;
    else if (type === 'tRNS') trns = d;
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (depth !== 8) throw new Error('PNG depth ' + depth);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype],
    raw = inflateSync(Buffer.concat(idat)),
    row = w * ch,
    px = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (row + 1)],
      src = raw.subarray(y * (row + 1) + 1, (y + 1) * (row + 1)),
      o = y * row;
    for (let x = 0; x < row; x++) {
      const a = x >= ch ? px[o + x - ch] : 0,
        b = y ? px[o - row + x] : 0,
        c = x >= ch && y ? px[o - row + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - b),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      px[o + x] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 3) {
      const k = px[i];
      rgba.set([pal[k * 3], pal[k * 3 + 1], pal[k * 3 + 2], trns && k < trns.length ? trns[k] : 255], i * 4);
    } else if (ctype === 0 || ctype === 4) {
      const g = px[i * ch];
      rgba.set([g, g, g, ctype === 4 ? px[i * ch + 1] : 255], i * 4);
    } else rgba.set([px[i * ch], px[i * ch + 1], px[i * ch + 2], ch === 4 ? px[i * ch + 3] : 255], i * 4);
  }
  return { w, h, rgba };
}
export function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'latin1');
    data.copy(out, 8);
    out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'latin1'), data])) >>> 0, 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- the master palette (game/art/next/palette.js), nearest colours in OKLab ---------- */
export function masterPalette() {
  const t = readFileSync(join(ROOT, 'game/art/next/palette.js'), 'utf8'),
    P = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)),
    hex = new Set();
  const walk = v => {
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) hex.add(v.toLowerCase());
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(P);
  return [...hex].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
}
export function oklab([r, g, b]) {
  const lin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4),
    [R, G, B] = [lin(r), lin(g), lin(b)],
    l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B),
    m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B),
    s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
export function nearestColour(pal, labs, c) {
  const L = oklab(c);
  let best = 0,
    bd = Infinity;
  labs.forEach((p, i) => {
    const d = (p[0] - L[0]) ** 2 + (p[1] - L[1]) ** 2 + (p[2] - L[2]) ** 2;
    if (d < bd) [bd, best] = [d, i];
  });
  return pal[best];
}

/* ---------- the figure ---------- */
const DEFAULT_CLIPS =
  'Idle:idle@6,Walking_A:walk@12,Running_A:run@12,Cheer:cheer@12,Throw:throw@12,Sit_Chair_Idle:sit@6';

/** every node's parent, and a node's local matrix (its rest, or a clip's values for it) */
function nodeTree(G) {
  const N = G.json.nodes,
    parent = N.map(() => -1);
  N.forEach((n, i) => (n.children || []).forEach(c => (parent[c] = i)));
  const local = (i, over) => {
    const n = N[i],
      o = (over && over[i]) || {};
    if (n.matrix && !o.t && !o.r && !o.s) return n.matrix.slice();
    return trs(o.t || n.translation, o.r || n.rotation, o.s || n.scale);
  };
  const worlds = over => {
    const W = [];
    const at = i => W[i] || (W[i] = parent[i] < 0 ? local(i, over) : mul(at(parent[i]), local(i, over)));
    N.forEach((_, i) => at(i));
    return W;
  };
  return { N, parent, local, worlds };
}
/** a clip's values for its nodes at time t (s): linear (rotations spherical) or stepped; a cubic spline's values */
function sampleClip(G, anim, t) {
  const over = {};
  for (const ch of anim.channels) {
    const S = anim.samplers[ch.sampler],
      times = accessor(G, S.input).map(r => r[0]),
      vals = accessor(G, S.output),
      path = { translation: 't', rotation: 'r', scale: 's' }[ch.target.path];
    if (!path) continue;
    const cubic = S.interpolation === 'CUBICSPLINE',
      val = k => (cubic ? vals[k * 3 + 1] : vals[k]);
    let k = 0;
    while (k < times.length - 1 && times[k + 1] <= t) k++;
    let v;
    if (t <= times[0] || times.length === 1) v = val(0);
    else if (k >= times.length - 1) v = val(times.length - 1);
    else {
      const f = (t - times[k]) / (times[k + 1] - times[k]);
      if (S.interpolation === 'STEP') v = val(k);
      else if (path === 'r') v = slerp(val(k), val(k + 1), f);
      else v = val(k).map((x, i) => x + (val(k + 1)[i] - x) * f);
    }
    (over[ch.target.node] ||= {})[path] = v;
  }
  return over;
}
function clipLength(G, anim) {
  return Math.max(...anim.samplers.map(S => G.json.accessors[S.input].max?.[0] ?? 0));
}

export function buildFigure(G, opts = {}) {
  const T = nodeTree(G),
    { N } = T,
    skin = G.json.skins[0],
    joints = skin.joints,
    invBind = accessor(G, skin.inverseBindMatrices),
    restW = T.worlds(null),
    named = i => N[i].name || 'node' + i;
  /* the meshes: skinned ones, and others that ride a bone (not in a hand) */
  const under = i => {
    const p = [];
    for (let k = T.parent[i]; k >= 0; k = T.parent[k]) p.push(named(k));
    return p;
  };
  const meshNodes = N.map((n, i) => i).filter(i => 'mesh' in N[i]);
  const keep = opts.meshes
    ? meshNodes.filter(i => opts.meshes.includes(named(i)))
    : meshNodes.filter(i => 'skin' in N[i] || !under(i).some(p => /handslot/i.test(p)));
  /* each vertex: the bone that moves it most; a mesh on a bone, that bone */
  const verts = [],
    tris = [],
    used = new Set();
  for (const ni of keep) {
    const node = N[ni],
      skinned = 'skin' in node,
      bone = skinned ? -1 : joints.indexOf(T.parent[ni]) >= 0 ? T.parent[ni] : -1;
    if (!skinned && bone < 0) {
      /* a mesh under a node that isn't a bone: under its nearest bone */
      let k = T.parent[ni];
      while (k >= 0 && joints.indexOf(k) < 0) k = T.parent[k];
      if (k < 0) continue;
    }
    for (const pr of G.json.meshes[node.mesh].primitives) {
      if (pr.mode != null && pr.mode !== 4) continue;
      const P = accessor(G, pr.attributes.POSITION),
        Nn = pr.attributes.NORMAL != null ? accessor(G, pr.attributes.NORMAL) : null,
        UV = pr.attributes.TEXCOORD_0 != null ? accessor(G, pr.attributes.TEXCOORD_0) : null,
        J = skinned ? accessor(G, pr.attributes.JOINTS_0) : null,
        Wt = skinned ? accessor(G, pr.attributes.WEIGHTS_0) : null,
        I = pr.indices != null ? accessor(G, pr.indices).map(r => r[0]) : P.map((_, k) => k),
        base = verts.length;
      let hostBone = bone;
      if (!skinned && hostBone < 0) {
        let k = T.parent[ni];
        while (k >= 0 && joints.indexOf(k) < 0) k = T.parent[k];
        hostBone = k;
      }
      const M = skinned ? ID() : restW[ni];
      P.forEach((p, k) => {
        let j;
        if (skinned) {
          let best = 0;
          for (let c = 1; c < 4; c++) if (Wt[k][c] > Wt[k][best]) best = c;
          j = joints[J[k][best]];
        } else j = hostBone;
        used.add(j);
        const q = apply(M, p),
          n = Nn ? apply(M, Nn[k], 0) : [0, 1, 0],
          l = Math.hypot(...n) || 1;
        verts.push({ p: q, n: n.map(v => v / l), uv: UV ? UV[k] : [0, 0], j });
      });
      for (let k = 0; k + 2 < I.length; k += 3) tris.push([base + I[k], base + I[k + 1], base + I[k + 2]]);
    }
  }
  /* the joints kept: those that move something, in the skin's order */
  const kept = joints.filter(j => used.has(j)),
    slot = new Map(kept.map((j, i) => [j, i]));
  /* the scale, the source's x flipped: F = diag(-s, s, s) */
  let top = -Infinity,
    bottom = Infinity;
  for (const v of verts) {
    top = Math.max(top, v.p[1]);
    bottom = Math.min(bottom, v.p[1]);
  }
  const height = opts.height || 1.75,
    s = height / (top - bottom),
    Fm = [-s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, -bottom * s, 0, 1],
    Fi = [-1 / s, 0, 0, 0, 0, 1 / s, 0, 0, 0, 0, 1 / s, 0, 0, bottom, 0, 1];
  const data = new Float32Array(verts.length * 9);
  verts.forEach((v, k) => {
    const p = apply(Fm, v.p);
    data.set([p[0], p[1], p[2], -v.n[0], v.n[1], v.n[2], slot.get(v.j), v.uv[0], v.uv[1]], k * 9);
  });
  /* the flip turns the triangles inside out: wind them back */
  const index = new Uint16Array(tris.length * 3);
  tris.forEach((t, k) => index.set([t[0], t[2], t[1]], k * 3));
  if (verts.length > 65535) throw new Error('more than 65535 vertices');
  /* the clips: each joint's matrix a frame, from where it is modelled to where the clip has it */
  const jb = kept.map(j => invBind[joints.indexOf(j)]),
    hips = kept.find(j => /hips/i.test(named(j))) ?? kept[0],
    restHips = restW[hips][13] * s,
    clips = {};
  const want = (opts.clips || DEFAULT_CLIPS).split(',').map(x => {
    const [src, rest] = x.split(':'),
      [name, fps] = (rest || src).split('@');
    return { src, name, fps: +fps || 12 };
  });
  /* the room every pose takes (the baker sizes its pictures by it): the reach round the upright axis, top, bottom */
  const ext = { r: 0, top: -Infinity, bottom: Infinity };
  const reach = (mats, frames) => {
    for (let f = 0; f < frames; f++)
      for (let v = 0; v < verts.length; v++) {
        const j = data[v * 9 + 6],
          m = mats.subarray((f * kept.length + j) * 12, (f * kept.length + j) * 12 + 12),
          [x, y, z] = [data[v * 9], data[v * 9 + 1], data[v * 9 + 2]],
          X = m[0] * x + m[3] * y + m[6] * z + m[9],
          Y = m[1] * x + m[4] * y + m[7] * z + m[10],
          Z = m[2] * x + m[5] * y + m[8] * z + m[11];
        ext.r = Math.max(ext.r, Math.hypot(X, Z));
        ext.top = Math.max(ext.top, Y);
        ext.bottom = Math.min(ext.bottom, Y);
      }
  };
  for (const w of want) {
    const anim = (G.json.animations || []).find(a => a.name === w.src);
    if (!anim) throw new Error('no clip ' + w.src);
    const len = clipLength(G, anim),
      frames = Math.max(1, Math.round(len * w.fps)),
      mats = new Float32Array(frames * kept.length * 12),
      lift = [],
      feet = { l: [], r: [] };
    for (let f = 0; f < frames; f++) {
      const W = T.worlds(sampleClip(G, anim, (f / frames) * len));
      kept.forEach((j, i) => {
        const S = mul(Fm, mul(mul(W[j], jb[i]), Fi));
        mats.set(
          [S[0], S[1], S[2], S[4], S[5], S[6], S[8], S[9], S[10], S[12], S[13], S[14]],
          (f * kept.length + i) * 12
        );
      });
      lift.push(Math.round((W[hips][13] * s - restHips) * 1e4) / 1e4);
      for (const [k, side] of [
        ['l', /foot\.l|toes\.l/i],
        ['r', /foot\.r|toes\.r/i],
      ]) {
        const j = kept.find(x => side.test(named(x)));
        if (j != null) feet[k].push(W[j][14] * s);
      }
    }
    /* a walk's or a run's metres a cycle: each foot's swing front to back, twice (two steps), as it would be planted */
    const swing = a => (a.length ? Math.max(...a) - Math.min(...a) : 0),
      cycleM = /walk|run/.test(w.name) ? Math.round((swing(feet.l) + swing(feet.r)) * 1000) / 1000 : undefined;
    reach(mats, frames);
    clips[w.name] = {
      source: w.src,
      fps: w.fps,
      frames,
      loop: true,
      lift,
      ...(cycleM ? { cycleM } : {}),
      matrices: Buffer.from(mats.buffer).toString('base64'),
    };
  }
  const r2 = v => Math.round(v * 100) / 100;
  return {
    joints: kept.map(named),
    height: Math.round(height * 1000) / 1000,
    /* a margin of 2 cm round it */
    extent: { r: r2(ext.r + 0.02), depth: r2(ext.r + 0.02), top: r2(ext.top + 0.02), bottom: r2(ext.bottom - 0.02) },
    vertices: Buffer.from(data.buffer).toString('base64'),
    indices: Buffer.from(index.buffer).toString('base64'),
    counts: { vertices: verts.length, triangles: tris.length, joints: kept.length },
    clips,
  };
}

/** the texture point-sampled to n x n (a point in each cell: the source is swatches) and snapped to the palette */
export function snapTexture(img, n) {
  const pal = masterPalette(),
    labs = pal.map(oklab),
    out = new Uint8Array(n * n * 4),
    memo = new Map();
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const sx = Math.min(img.w - 1, Math.floor(((x + 0.5) * img.w) / n)),
        sy = Math.min(img.h - 1, Math.floor(((y + 0.5) * img.h) / n)),
        i = (sy * img.w + sx) * 4,
        c = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]],
        k = c.join(',');
      if (!memo.has(k)) memo.set(k, nearestColour(pal, labs, c));
      out.set([...memo.get(k), img.rgba[i + 3]], (y * n + x) * 4);
    }
  return out;
}

function main() {
  const args = process.argv.slice(2),
    arg = (k, d) => args.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d,
    [src, name] = args.filter(a => !a.startsWith('--'));
  if (!src || !name || !/^[a-z][a-z0-9_]*$/.test(name)) {
    console.error(
      'usage: node tools/gltf-figure.mjs <model.glb> <name> [--height=1.75] [--tex=128] [--meshes=A,B] [--clips=...]'
    );
    process.exit(1);
  }
  const G = readGlb(readFileSync(src)),
    fig = buildFigure(G, {
      height: +arg('height', 1.75),
      meshes: arg('meshes') ? arg('meshes').split(',') : null,
      clips: arg('clips'),
    });
  /* the texture: the model's own image */
  const im = G.json.images?.[0];
  if (!im || im.bufferView == null) throw new Error('no texture in the model');
  const V = G.json.bufferViews[im.bufferView],
    png = decodePng(Buffer.from(G.bin.subarray(V.byteOffset || 0, (V.byteOffset || 0) + V.byteLength))),
    n = +arg('tex', 128);
  const dir = join(ROOT, 'game/art/figures');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name + '.png'), encodePng(n, n, snapTexture(png, n)));
  const out = {
    format: 1,
    name,
    source: src.split('/').pop(),
    made: 'tools/gltf-figure.mjs',
    texture: `figures/${name}.png`,
    ...fig,
  };
  writeFileSync(join(dir, name + '.json'), JSON.stringify(out) + '\n');
  console.log(
    `figures/${name}: ${fig.counts.vertices} vertices, ${fig.counts.triangles} triangles, ${fig.counts.joints} joints; clips ` +
      Object.entries(fig.clips)
        .map(([k, c]) => `${k} ${c.frames}@${c.fps}${c.cycleM ? ` ${c.cycleM} m a cycle` : ''}`)
        .join(', ') +
      `; texture ${n} x ${n}`
  );
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) main();
