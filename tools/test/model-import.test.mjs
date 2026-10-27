// Studio track ST-7: Model mode import (game/js/logic/model-gltf.js, model-obj.js, model-mesh.js). The readers on
// sample files: the three CC0 KayKit models RP-3 converted (validation/cc0-src/, checked against RP-3's Python reader,
// tools/glb-to-recipe.py, through model-import-rp3.json), and small files made here for what those don't have: a .glb
// with its picture inside, a mirrored node, a sparse accessor, a strip and a fan, vertex colours, a child that spins,
// an OBJ with its MTL. Then the mesh format v2 (packed and read back), the atlas, texel density and the resample.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { encodePng, readPng } from './png.mjs';
import { modules, ROOT } from './setup-real.mjs';

const G = modules['model-gltf'],
  pngWH = b => {
    const s = modules['art-search'].pngSize(b);
    return s && [s.w, s.h];
  },
  O = modules['model-obj'],
  M = modules['model-mesh'],
  K = modules['model-bake'];
const CC0 = join(ROOT, 'validation/cc0-src');
const kayFiles = () => Object.fromEntries(readdirSync(CC0).map(f => [f, new Uint8Array(readFileSync(join(CC0, f)))]));
const RP3 = JSON.parse(readFileSync(join(ROOT, 'tools/test/model-import-rp3.json'), 'utf8'));
const near = (a, b, e, what) => assert.ok(Math.abs(a - b) <= e, `${what}: ${a} vs ${b}`);

test('the KayKit models read as RP-3 reads them: the same triangles, nodes and texture colours', () => {
  const F = kayFiles();
  for (const [name, want] of Object.entries(RP3)) {
    const S = G.readGltf(F, name + '.gltf');
    const im = readPng(join(CC0, S.images[0].name + '.png'));
    let tris = 0;
    const lo = [Infinity, Infinity, Infinity],
      hi = [-Infinity, -Infinity, -Infinity],
      sum = [0, 0, 0],
      col = [0, 0, 0],
      nodes = {};
    for (const n of S.nodes) {
      nodes[n.name] = 0;
      for (const p of n.prims)
        for (let t = 0; t < p.idx.length; t += 3) {
          tris++;
          nodes[n.name]++;
          const c = [0, 0];
          for (let j = 0; j < 3; j++) {
            const i = p.idx[t + j],
              q = [p.pos[i * 3], -p.pos[i * 3 + 2], p.pos[i * 3 + 1]]; /* RP-3's recipe axes: z up, front -y */
            for (let k = 0; k < 3; k++) {
              lo[k] = Math.min(lo[k], q[k]);
              hi[k] = Math.max(hi[k], q[k]);
              sum[k] += q[k];
            }
            c[0] += p.uv[i * 2] / 3;
            c[1] += p.uv[i * 2 + 1] / 3;
          }
          /* the texture at the triangle's UV centre, as RP-3 colours a triangle */
          const x = Math.min(im.width - 1, Math.max(0, Math.floor((((c[0] % 1) + 1) % 1) * im.width))),
            y = Math.min(im.height - 1, Math.max(0, Math.floor((((c[1] % 1) + 1) % 1) * im.height)));
          for (let k = 0; k < 3; k++) col[k] += im.data[(y * im.width + x) * 4 + k];
        }
    }
    assert.equal(tris, want.tris, name);
    assert.deepEqual(nodes, want.nodes, name);
    for (let k = 0; k < 3; k++) {
      near(lo[k], want.lo[k], 1e-3, `${name} low ${k}`);
      near(hi[k], want.hi[k], 1e-3, `${name} high ${k}`);
      near(sum[k], want.sum[k], 0.05, `${name} sum ${k}`);
      near(col[k], want.colourSum[k], 1, `${name} colour ${k}`);
    }
  }
});

test('the turbine: its fan is a part of its own, hanging from the tower at its node origin; a palette texture', () => {
  const F = kayFiles(),
    S = G.readGltf(F, 'windturbine_tall.gltf'),
    B = M.modelBuild(
      S,
      S.images.map(i => pngWH(i.bytes)),
      { height: 4.6, key: 'turbine', src: 'windturbine_tall.gltf' }
    );
  assert.deepEqual(
    B.rec.parts.map(p => p.name),
    ['windturbine_tall', 'windturbine_tall_fan']
  );
  assert.equal(B.rec.parts[1].parent, 0);
  near(B.rec.box[4], 4.6, 0.01, 'height');
  assert.equal(B.rec.box[1], 0, 'stands on the ground');
  near(B.rec.box[0] + B.rec.box[3], 0, 0.01, 'centred across');
  near(B.rec.parts[1].pivot[1], (2.05 / 3) * 4.6, 0.01, 'the fan turns about its node origin');
  assert.equal(B.rec.tex, 'scene/models/turbine.png');
  assert.equal(B.rec.v, 2);
  const D = M.modelDensity(M.modelFaces(B.rec), B.atlas.w, B.atlas.h, readPng(join(CC0, 'spacebits_texture.png')));
  assert.ok(D.isPalette, 'KayKit colours a face with one swatch');
  assert.equal(D.fix, 1, 'no resample offered for a palette texture');
  assert.ok(M.modelCheckLines(B.rec, D).some(l => /Palette texture/.test(l.text)));
});

/* ---------------------------------------------------------------- a .glb made here */
/** a .glb from a JSON and its binary chunk */
function glb(json, bin) {
  const j = Buffer.from(JSON.stringify(json)),
    jp = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]),
    bp = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]),
    h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546c67, 0);
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(12 + 8 + jp.length + 8 + bp.length, 8);
  const ch = (b, kind) => {
    const c = Buffer.alloc(8);
    c.writeUInt32LE(b.length, 0);
    c.writeUInt32LE(kind, 4);
    return Buffer.concat([c, b]);
  };
  return new Uint8Array(Buffer.concat([h, ch(jp, 0x4e4f534a), ch(bp, 0x004e4942)]));
}
/** a binary buffer with views: put(kind, values) -> view index */
function binBuilder() {
  const parts = [],
    views = [];
  let len = 0;
  const put = (Arr, vals, extra = {}) => {
    const a = new Arr(vals),
      b = Buffer.from(a.buffer);
    const pad = (4 - (len % 4)) % 4;
    if (pad) parts.push(Buffer.alloc(pad));
    len += pad;
    views.push({ buffer: 0, byteOffset: len, byteLength: b.length, ...extra });
    parts.push(b);
    len += b.length;
    return views.length - 1;
  };
  return { put, views, bin: () => Buffer.concat(parts) };
}
/* a 2 x 2 picture: red, green, blue, white */
const PIC = encodePng({
  width: 2,
  height: 2,
  data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
});

function sampleGlb() {
  const B = binBuilder();
  /* a unit quad facing +z (glTF's front), counter-clockwise from the front */
  const pos = B.put(Float32Array, [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    nrm = B.put(Float32Array, [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv = B.put(Float32Array, [0, 1, 1, 1, 1, 0, 0, 0]),
    idx = B.put(Uint16Array, [0, 1, 2, 0, 2, 3]),
    /* vertex colours as normalised bytes: half grey */
    col = B.put(Uint8Array, [128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255]),
    /* a strip of 5 vertices (3 triangles) and a fan of 5 (3 triangles) */
    strip = B.put(Float32Array, [0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 2, 0, 0]),
    /* sparse: index 2's y moved to 5 */
    sIdx = B.put(Uint8Array, [2]),
    sVal = B.put(Float32Array, [1, 5, 0]),
    png = B.put(Uint8Array, [...PIC]);
  const json = {
    asset: { version: '2.0', generator: 'model-import.test' },
    scene: 0,
    scenes: [{ nodes: [0, 2, 3] }],
    nodes: [
      { name: 'body', mesh: 0, children: [1] },
      {
        name: 'rotor',
        mesh: 0,
        translation: [0, 2, 0],
        extras: { pb: { spin: { axis: [0, 0, 1], rps: 2 }, joint: { axis: [1, 0, 0], min: -30, max: 45 } } },
      },
      { name: 'mirror', mesh: 0, translation: [3, 0, 0], scale: [-1, 1, 1] },
      { name: 'shapes', mesh: 1, translation: [0, 0, -2] },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 4 }, indices: 3, material: 0 }] },
      {
        primitives: [
          { attributes: { POSITION: 5 }, mode: 5, material: 1 },
          { attributes: { POSITION: 6 }, mode: 6, material: 1 },
          { attributes: { POSITION: 7 }, mode: 1 },
        ],
      },
    ],
    materials: [
      { name: 'pic', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
      { name: 'paint', pbrMetallicRoughness: { baseColorFactor: [0.5, 0.2140411, 0, 1] } },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: png, mimeType: 'image/png' }],
    accessors: [
      { bufferView: pos, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: nrm, componentType: 5126, count: 4, type: 'VEC3' },
      { bufferView: uv, componentType: 5126, count: 4, type: 'VEC2' },
      { bufferView: idx, componentType: 5123, count: 6, type: 'SCALAR' },
      { bufferView: col, componentType: 5121, normalized: true, count: 4, type: 'VEC4' },
      { bufferView: strip, componentType: 5126, count: 5, type: 'VEC3' },
      {
        bufferView: strip,
        componentType: 5126,
        count: 5,
        type: 'VEC3',
        sparse: { count: 1, indices: { bufferView: sIdx, componentType: 5121 }, values: { bufferView: sVal } },
      },
      { bufferView: strip, componentType: 5126, count: 4, type: 'VEC3' },
    ],
    bufferViews: B.views,
    buffers: [{ byteLength: B.bin().length }],
  };
  return glb(json, B.bin());
}

test('a .glb: picture inside, child with extras, mirrored node, strip, fan, sparse values, lines left out', () => {
  const S = G.readGltf({ 'm.glb': sampleGlb() }, 'm.glb');
  assert.equal(S.format, 'glb');
  assert.deepEqual(
    S.nodes.map(n => [n.name, n.parent]),
    [
      ['body', -1],
      ['rotor', 0],
      ['mirror', -1],
      ['shapes', -1],
    ]
  );
  assert.deepEqual(S.nodes[1].pivot, [0, 2, 0]);
  assert.equal(S.images[0].bytes.length, PIC.length, 'the picture from the binary chunk');
  assert.deepEqual(
    [...S.nodes[0].prims[0].col.slice(0, 4)].map(v => Math.round(v * 255)),
    [128, 128, 128, 255]
  );
  /* strip 3 + fan 3 triangles; the line primitive left out with a warning */
  const sh = S.nodes[3].prims;
  assert.equal(sh.length, 2);
  assert.equal(sh[0].idx.length / 3, 3);
  assert.equal(sh[1].idx.length / 3, 3);
  assert.ok(S.warnings.some(w => /points or lines/.test(w)));
  /* the strip's second triangle is turned so all three face the same way */
  const facing = (p, t) => {
    const P = [0, 1, 2].map(j => [...p.pos.slice(p.idx[t + j] * 3, p.idx[t + j] * 3 + 3)]);
    return Math.sign((P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[1][1] - P[0][1]) * (P[2][0] - P[0][0]));
  };
  assert.deepEqual(
    [0, 3, 6].map(t => facing(sh[0], t)),
    [-1, -1, -1]
  );
  assert.equal(sh[1].pos[2 * 3 + 1], 5, 'the sparse value');
  /* the mirrored node: its triangles turned round, so they still wind counter-clockwise seen along its normal */
  const m = S.nodes[2].prims[0],
    wind = t => {
      const P = [0, 1, 2].map(j => [...m.pos.slice(m.idx[t + j] * 3, m.idx[t + j] * 3 + 3)]),
        u = P[1].map((v, k) => v - P[0][k]),
        w = P[2].map((v, k) => v - P[0][k]),
        n = [...m.nrm.slice(m.idx[t] * 3, m.idx[t] * 3 + 3)];
      return Math.sign((u[0] * w[1] - u[1] * w[0]) * n[2]);
    };
  assert.equal(wind(0), 1);
  assert.equal(wind(3), 1);
});

test('the .glb built: v2 parts, a spin and a joint from extras, flat paint, axes, packing read back', () => {
  const S = G.readGltf({ 'm.glb': sampleGlb() }, 'm.glb'),
    B = M.modelBuild(S, [[2, 2]], { scale: 1, key: 'sample', centre: false, ground: false });
  const R = B.rec;
  assert.equal(R.kind, 'mesh');
  assert.equal(R.v, 2);
  assert.equal(R.tris, 2 + 2 + 2 + 6);
  const rotor = R.parts.find(p => p.name === 'rotor');
  assert.equal(rotor.parent, 0);
  assert.deepEqual(rotor.spin, { a: [0, 0, -1], rps: 2 }, 'glTF +z is the game -z');
  assert.deepEqual(rotor.joint, { a: [1, 0, 0], min: -30, max: 45 });
  assert.deepEqual(rotor.pivot, [0, 2, 0]);
  /* read back: positions within a 256th of a metre, glTF's front (+z) is the game's -z */
  const F = M.modelFaces(R),
    shapes = F.filter(f => R.parts[f.part].name === 'shapes');
  assert.equal(F.length, R.tris);
  assert.ok(
    shapes.every(f => f.p.every(p => Math.abs(p[2] - 2) < 1 / 256)),
    'z -2 in glTF is +2 in the game'
  );
  assert.ok(
    shapes.every(f => f.uv === null),
    'a painted face has no texture'
  );
  const body = F.filter(f => f.part === 0);
  assert.ok(
    body.every(f => f.uv),
    'a textured face'
  );
  /* the vertex colour (linear 0.5) times the texture: the game's colour is its sRGB, 188 */
  const raw = Buffer.from(R.parts[0].data, 'base64');
  assert.equal(raw[16], M.MODEL_OWN_CELL);
  assert.equal(raw[18], 0);
  assert.equal(raw[20], M.linearToSrgb(128 / 255));
  /* the paint: baseColorFactor 0.5, 0.214 linear -> 188, about 128 */
  const sraw = Buffer.from(R.parts.find(p => p.name === 'shapes').data, 'base64');
  assert.deepEqual([sraw[16], sraw[18], sraw[20], sraw[21], sraw[22]], [255, 1, 188, M.linearToSrgb(0.2140411), 0]);
  /* the faces wind as the game's own meshes do (the airship: clockwise seen along the normal) */
  const n0 = [raw.readInt8(8), raw.readInt8(9), raw.readInt8(10)];
  assert.deepEqual(n0, [0, 0, -127]);
  const f = body[0],
    u = f.p[1].map((v, k) => v - f.p[0][k]),
    w = f.p[2].map((v, k) => v - f.p[0][k]),
    cz = u[0] * w[1] - u[1] * w[0];
  assert.ok(cz * -1 < 0, 'clockwise against its normal, as the airship');
});

test('refused: a compressed file, a file outside the model folder, a missing .bin', () => {
  const draco = new TextEncoder().encode(
    JSON.stringify({ asset: { version: '2.0' }, extensionsRequired: ['KHR_draco_mesh_compression'] })
  );
  assert.throws(() => G.readGltf({ 'd.gltf': draco }, 'd.gltf'), /compressed/);
  const out = new TextEncoder().encode(
    JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: '../secret.bin', byteLength: 4 }] })
  );
  assert.throws(() => G.readGltf({ 'o.gltf': out }, 'o.gltf'), /only files beside/);
  const miss = new TextEncoder().encode(
    JSON.stringify({ asset: { version: '2.0' }, buffers: [{ uri: 'gone.bin', byteLength: 4 }] })
  );
  assert.throws(() => G.readGltf({ 'g.gltf': miss }, 'g.gltf'), /needs "gone.bin"/);
  assert.throws(
    () => G.readGltf({ 'v1.gltf': new TextEncoder().encode('{"asset":{"version":"1.0"}}') }, 'v1.gltf'),
    /2\.0/
  );
});

test('a .gltf with a data: buffer reads as the .glb does', () => {
  const g = sampleGlb(),
    d = new DataView(g.buffer),
    jl = d.getUint32(12, true),
    json = JSON.parse(new TextDecoder().decode(g.subarray(20, 20 + jl))),
    bl = d.getUint32(20 + jl, true),
    bin = g.subarray(28 + jl, 28 + jl + bl);
  json.buffers = [
    { byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + Buffer.from(bin).toString('base64') },
  ];
  const S = G.readGltf({ 'm.gltf': new TextEncoder().encode(JSON.stringify(json)) }, 'm.gltf');
  assert.equal(S.format, 'gltf');
  assert.equal(S.nodes.length, 4);
  assert.equal(G.base64Encode(G.base64Decode('aGVsbG8gd29ybGQ=')), 'aGVsbG8gd29ybGQ=');
});

/* ---------------------------------------------------------------- OBJ */
const OBJ = `# a quad and a triangle
mtllib box.mtl
o crate
v 0 0 0 1 0 0
v 1 0 0 1 0 0
v 1 1 0 1 0 0
v 0 1 0 1 0 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
vn 0 0 -1
usemtl wood
f 1/1/1 2/2/1 3/3/1 4/4/1
g lid
v 0 2 0 0 1 0
usemtl paint
f -1 1 2
`;
const MTL = 'newmtl wood\nKd 1 1 1\nmap_Kd textures/wood.png\nnewmtl paint\nKd 0.5 0.25 0\n';

test('an .obj with its .mtl: groups, polygons fanned, negative indices, the texture beside it, v flipped', () => {
  const enc = s => new TextEncoder().encode(s),
    F = { 'crate.obj': enc(OBJ), 'box.mtl': enc(MTL), 'wood.png': PIC },
    S = O.readObj(F, 'crate.obj');
  assert.deepEqual(
    S.nodes.map(n => n.name),
    ['crate', 'lid']
  );
  assert.equal(S.nodes[0].prims[0].idx.length, 6, 'a quad is two triangles');
  assert.equal(S.images[0].name, 'wood.png');
  assert.equal(S.images[0].bytes.length, PIC.length, 'map_Kd found by its name beside the model');
  assert.deepEqual([...S.nodes[0].prims[0].uv.slice(0, 2)], [0, 1], 'v from the bottom to the top');
  /* turned half round about y: x and z change sign */
  assert.deepEqual([...S.nodes[0].prims[0].pos.slice(3, 6)], [-1, 0, -0]);
  assert.deepEqual([...S.nodes[0].prims[0].nrm.slice(0, 3)], [-0, 0, 1]);
  assert.deepEqual([...S.nodes[1].prims[0].col.slice(0, 4)], [0, 1, 0, 1], 'vertex colours');
  assert.deepEqual(S.materials[1].color, [0.5, 0.25, 0, 1]);
  const B = M.modelBuild(S, [[2, 2]], { height: 2, key: 'crate' });
  const lid = Buffer.from(B.rec.parts[1].data, 'base64');
  /* an OBJ's colours are taken as written (not linear): 0.5 * 0, 0.25 * 1 */
  assert.deepEqual([lid[18], lid[20], lid[21], lid[22]], [1, 0, 64, 0]);
  assert.throws(() => O.readObj({ 'x.obj': enc('v 0 0 0\nf 1 2 3\n') }, 'x.obj'), /isn't there/);
  const missing = O.readObj({ 'c.obj': enc(OBJ) }, 'c.obj');
  assert.ok(missing.warnings.some(w => /box\.mtl/.test(w)));
});

/* ---------------------------------------------------------------- the checks */
/** a flat model of quads, each 1 m square, its texture coordinates covering `px` pixels a side of a `tex` texture */
function quads(n, px, tex) {
  const faces = [];
  for (let i = 0; i < n; i++) {
    const p = [
        [i, 0, 0],
        [i + 1, 0, 0],
        [i + 1, 1, 0],
        [i, 1, 0],
      ],
      u = [
        [0, 0],
        [px / tex, 0],
        [px / tex, px / tex],
        [0, px / tex],
      ];
    faces.push({ p: [p[0], p[1], p[2]], uv: [u[0], u[1], u[2]] }, { p: [p[0], p[2], p[3]], uv: [u[0], u[2], u[3]] });
  }
  return faces;
}

test('texel density: area-weighted median, the share off, the resample fix and nearest-pixel scaling', () => {
  const ok = M.modelDensity(quads(4, 32, 64), 64, 64);
  near(ok.median, 32, 1e-3, 'median');
  assert.equal(ok.off, 0);
  assert.equal(ok.fix, 1);
  assert.equal(ok.isPalette, false);
  assert.equal(M.modelCheckLines({ tris: 8 }, ok)[0].level, 'ok');
  /* three quads at 64 px/m and one at 32: the median is 64, 3/4 off, the fix halves the texture */
  const mix = [...quads(3, 64, 64), ...quads(1, 32, 64)],
    D = M.modelDensity(mix, 64, 64);
  near(D.median, 64, 1e-3, 'median');
  near(D.off, 0.75, 1e-3, 'off');
  near(D.fix, 0.5, 1e-6, 'fix');
  assert.equal(M.modelCheckLines({ tris: 8 }, D)[0].level, 'warn');
  assert.equal(M.modelResampleFactor(1000), 1 / 8, 'kept to 1/8');
  /* nearest pixel: a 2 x 2 picture doubled is 4 x 4 blocks of the same colours */
  const P = { width: 2, height: 2, data: new Uint8Array([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]) },
    R = M.modelResample(P, 2);
  assert.equal(R.width, 4);
  assert.deepEqual(
    [0, 1, 2, 3].map(x => R.data[(3 * 4 + x) * 4]),
    [3, 3, 4, 4]
  );
  /* faces of one colour under their texels: a palette */
  const flat = { width: 4, height: 4, data: new Uint8Array(64).fill(200) },
    pal = M.modelDensity(quads(2, 2, 4), 4, 4, flat);
  assert.equal(pal.isPalette, true);
  /* untextured faces counted apart */
  assert.equal(M.modelDensity([{ p: quads(1, 1, 1)[0].p, uv: null }], 4, 4).plain, 0.5);
});

test('several textures packed into one: slots side by side, coordinates moved into them', () => {
  const A = M.modelAtlas([[64, 32], null, [16, 16]]);
  assert.equal(A.w, 64);
  assert.equal(A.slots.length, 2);
  const s0 = A.slots.find(s => s.image === 0),
    s2 = A.slots.find(s => s.image === 2);
  assert.ok(s2.y >= s0.y + 32 || s2.x >= s0.x + 64, 'no overlap');
  const pix = M.modelAtlasPixels(A, [
    { width: 64, height: 32, data: new Uint8Array(64 * 32 * 4).fill(9) },
    null,
    { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4).fill(7) },
  ]);
  assert.equal(pix.data[(s2.y * A.w + s2.x) * 4], 7);
  /* a model with two textured materials */
  const S = G.readGltf({ 'm.glb': sampleGlb() }, 'm.glb');
  S.materials.push({ ...S.materials[0], image: 1 });
  S.images.push({ name: 'b', mime: 'image/png', bytes: PIC });
  S.nodes[2].prims[0] = { ...S.nodes[2].prims[0], mat: 2 };
  const B = M.modelBuild(
    S,
    [
      [2, 2],
      [2, 2],
    ],
    { key: 'two' }
  );
  assert.equal(B.atlas.slots.length, 2);
  const uvs = M.modelFaces(B.rec)
    .filter(f => f.uv)
    .flatMap(f => f.uv);
  assert.ok(uvs.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1));
});

test('the triangle warning and a part cut at 65,535 vertices', () => {
  const n = 190,
    B = binBuilder(),
    P = [],
    I = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) P.push(x / n, y / n, (x * y) % 3);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x;
      I.push(a, a + 1, a + n + 2, a, a + n + 2, a + n + 1);
    }
  const pos = B.put(Float32Array, P),
    idx = B.put(Uint32Array, I);
  const json = {
    asset: { version: '2.0' },
    nodes: [{ name: 'grid', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: pos, componentType: 5126, count: P.length / 3, type: 'VEC3' },
      { bufferView: idx, componentType: 5125, count: I.length, type: 'SCALAR' },
    ],
    bufferViews: B.views,
    buffers: [{ byteLength: B.bin().length }],
  };
  const S = G.readGltf({ 'g.glb': glb(json, B.bin()) }, 'g.glb'),
    R = M.modelBuild(S, [], { height: 3 });
  assert.equal(R.rec.tris, n * n * 2);
  assert.ok(R.warnings.some(w => /over the 2000/.test(w)));
  assert.ok(R.rec.parts.length >= 2, 'cut in pieces');
  assert.ok(R.rec.parts.every(p => p.n <= 65535));
  assert.equal(
    R.rec.parts.reduce((s, p) => s + p.ni / 3, 0),
    n * n * 2
  );
  assert.equal(R.rec.tex, undefined, 'no texture: colours only');
});

/* ---------------------------------------------------------------- the bakes */
const PALETTE = Object.values(
  JSON.parse(
    readFileSync(join(ROOT, 'game/art/next/palette.js'), 'utf8')
      .replace(/^[\s\S]*?window\.NW_PALETTE=/, '')
      .replace(/;\s*$/, '')
  ).ramps
).flat();

test('the prop picture: 32 px to the metre, base point at the bottom middle, an ink outline', () => {
  const S = G.readGltf(kayFiles(), 'arch.gltf'),
    tex = readPng(join(CC0, 'halloweenbits_texture.png')),
    B = M.modelBuild(S, [[tex.width, tex.height]], { height: 4, key: 'arch' }),
    P = K.modelBakePicture(B.rec, tex);
  const wide = B.rec.box[3] - B.rec.box[0];
  near(P.pixels.width, Math.ceil(wide * 32) + 4, 1, 'width');
  near(-P.ox, P.pixels.width / 2, 2, 'base point across');
  /* the ground is near the bottom (the depth adds half its size above it) */
  assert.ok(-P.oy > P.pixels.height - 4 - ((B.rec.box[5] - B.rec.box[2]) * 32) / 2 - 2);
  const ink = [...P.pixels.data].filter((v, i) => i % 4 === 0 && v === K.MODEL_INK[0]).length;
  assert.ok(ink > 100, 'outlined');
});

test('Bake to 32 px/m: a palette model gets a texture of its own at 32 px/m, in our palette', () => {
  const S = G.readGltf(kayFiles(), 'arch.gltf'),
    tex = readPng(join(CC0, 'halloweenbits_texture.png')),
    B = M.modelBuild(S, [[tex.width, tex.height]], { height: 4, key: 'arch' }),
    sheet = readPng(join(ROOT, 'game/art/scene/build/detail-a04b.png')),
    R = K.modelBakeTexture(B.rec, tex, { palette: PALETTE, sheet, cols: 8, cell: 64 });
  assert.equal(R.rec.tris, B.rec.tris);
  assert.equal(M.modelFaces(R.rec).length, B.rec.tris, 'every face kept');
  const D = M.modelDensity(M.modelFaces(R.rec), R.pixels.width, R.pixels.height, R.pixels);
  near(D.median, 32, 2, 'the art density');
  assert.ok(D.off < 0.05, `${D.off} off`);
  assert.equal(D.isPalette, false);
  /* the colours at shade level 2 are the palette's own */
  const base = K.modelSnapColour([120, 124, 130], PALETTE);
  assert.ok(PALETTE.includes('#' + base.map(v => v.toString(16).padStart(2, '0')).join('')));
  assert.deepEqual(K.modelRamp([100, 150, 200], 2), [100, 150, 200]);
  assert.equal(K.modelBakeMaterial([128, 128, 132]), 'stone');
  assert.equal(K.modelBakeMaterial([139, 90, 43]), 'wood');
  assert.equal(K.modelBakeMaterial([60, 160, 60]), 'leaves');
  /* the vertex colours are white: the texture carries the colour */
  const raw = Buffer.from(R.rec.parts[0].data, 'base64');
  assert.deepEqual([raw[16], raw[18], raw[20], raw[21], raw[22]], [255, 0, 255, 255, 255]);
});

/* ---------------------------------------------------------------- .vox */
/** a .vox: SIZE, XYZI and RGBA chunks inside MAIN */
function voxFile(size, voxels, rgba) {
  const chunk = (tag, body) => {
    const h = Buffer.alloc(12);
    h.write(tag, 0, 'latin1');
    h.writeInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  const S = Buffer.alloc(12);
  size.forEach((v, i) => S.writeInt32LE(v, i * 4));
  const X = Buffer.alloc(4 + voxels.length * 4);
  X.writeInt32LE(voxels.length, 0);
  voxels.forEach((v, i) => X.set(v, 4 + i * 4));
  const parts = [chunk('SIZE', S), chunk('XYZI', X)];
  if (rgba) parts.push(chunk('RGBA', Buffer.from(rgba)));
  const kids = Buffer.concat(parts),
    main = Buffer.alloc(12);
  main.write('MAIN', 0, 'latin1');
  main.writeInt32LE(0, 4);
  main.writeInt32LE(kids.length, 8);
  const head = Buffer.alloc(8);
  head.write('VOX ', 0, 'latin1');
  head.writeInt32LE(150, 4);
  return new Uint8Array(Buffer.concat([head, main, kids]));
}

test('a .vox: read as the Props import read it, its raw layer, and its outer faces as a model', () => {
  const V = modules['model-vox'],
    pal = new Uint8Array(1024);
  pal.set([10, 20, 30, 255], 0);
  const f = voxFile(
      [4, 2, 3],
      [
        [0, 0, 0, 1],
        [1, 0, 0, 1],
      ],
      pal
    ),
    P = V.voxParse(f);
  assert.deepEqual(P.size, [4, 2, 3]);
  assert.equal(P.voxels.length, 2);
  assert.deepEqual(P.palette[0], [10, 20, 30]);
  /* the raw layer as model-editor.js always wrote it: btoa of x, y, z, r, g, b characters */
  const L = V.voxRawLayer(P, 'two.vox');
  assert.equal(L.data, Buffer.from([0, 0, 0, 10, 20, 30, 1, 0, 0, 10, 20, 30]).toString('base64'));
  assert.deepEqual([L.name, L.n, L.ox, L.oy, L.vpm], ['two', 2, -2, -1, 32]);
  /* two voxels side by side: 10 faces show, 20 triangles; a voxel is 1/32 m */
  const S = V.voxSource(P, 'two'),
    B = M.modelBuild(S, [], { scale: 1 / 32 });
  assert.equal(B.rec.tris, 20);
  near(B.rec.box[3] - B.rec.box[0], 2 / 32, 1e-3, 'two voxels wide');
  near(B.rec.box[4], 1 / 32, 1e-3, 'one tall');
  /* sRGB colours as they are */
  const raw = Buffer.from(B.rec.parts[0].data, 'base64');
  assert.deepEqual([raw[18], raw[20], raw[21], raw[22]], [1, 10, 20, 30]);
  assert.throws(() => V.voxParse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /not a \.vox/);
});
