// Characters track CH-3: tools/gltf-figure.mjs, a rigged .glb to a figure: on a small model made here (a hips, a head,
// two feet and a hand's slot; a skinned body, a hat on the head and a knife in the hand; an idle that turns the head
// and a walk that swings the feet), and its PNG and palette pieces.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFigure, decodePng, encodePng, masterPalette, readGlb, snapTexture } from '../gltf-figure.mjs';

/** a .glb from glTF JSON and its binary pieces (each piece a typed array, given a bufferView and an accessor) */
function makeGlb(json, pieces) {
  const views = [],
    accessors = [],
    parts = [];
  let at = 0;
  for (const p of pieces) {
    const bytes = Buffer.from(p.data.buffer, p.data.byteOffset, p.data.byteLength),
      pad = (4 - (bytes.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length });
    accessors.push({
      bufferView: views.length - 1,
      componentType: p.ct,
      count: p.count,
      type: p.type,
      ...(p.normalized ? { normalized: true } : {}),
      ...(p.max ? { min: p.min, max: p.max } : {}),
    });
    parts.push(bytes, Buffer.alloc(pad));
    at += bytes.length + pad;
  }
  const bin = Buffer.concat(parts);
  const j = {
      asset: { version: '2.0' },
      ...json,
      bufferViews: views,
      accessors,
      buffers: [{ byteLength: bin.length }],
    },
    jb = Buffer.from(JSON.stringify(j)),
    jpad = Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20),
    jsonChunk = Buffer.concat([jb, jpad]);
  const head = Buffer.alloc(12),
    c0 = Buffer.alloc(8),
    c1 = Buffer.alloc(8);
  c0.writeUInt32LE(jsonChunk.length, 0);
  c0.write('JSON', 4, 'latin1');
  c1.writeUInt32LE(bin.length, 0);
  c1.write('BIN\0', 4, 'latin1');
  head.write('glTF', 0, 'latin1');
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
  return Buffer.concat([head, c0, jsonChunk, c1, bin]);
}
const f32 = (a, type, extra = {}) => ({ data: new Float32Array(a.flat()), ct: 5126, count: a.length, type, ...extra });

/* the model: hips at 1 m, the head 1 m above them, the feet on the ground, the hand's slot right of the head */
const POS = [
  [0.3, 1, 0], //   0 1 2: the body near the hips
  [-0.3, 1, 0],
  [0, 1.4, 0.1],
  [0.3, 2.2, 0], // 3 4 5: the face, moved by the head
  [-0.3, 2.2, 0],
  [0, 2.4, 0.1],
  [0.2, 0, 0], //   6 7 8: the soles
  [-0.2, 0, 0],
  [0, 0.05, 0.05],
];
const JOINTS = [
  [0, 1, 0, 0],
  [0, 1, 0, 0],
  [0, 1, 0, 0],
  [0, 1, 0, 0],
  [0, 1, 0, 0],
  [0, 1, 0, 0],
  [2, 0, 0, 0],
  [3, 0, 0, 0],
  [2, 3, 0, 0],
];
const WEIGHTS = [
  [0.7, 0.3, 0, 0],
  [0.7, 0.3, 0, 0],
  [0.6, 0.4, 0, 0],
  [0.2, 0.8, 0, 0],
  [0.2, 0.8, 0, 0],
  [0.1, 0.9, 0, 0],
  [1, 0, 0, 0],
  [1, 0, 0, 0],
  [0.6, 0.4, 0, 0],
];
const TRI = [
  [0, 0, 0],
  [0.2, 0, 0],
  [0, 0.2, 0],
];
const inv = t => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -t[0], -t[1], -t[2], 1];
const s45 = Math.sin(Math.PI / 8),
  c45 = Math.cos(Math.PI / 8),
  s90 = Math.sin(Math.PI / 4),
  c90 = Math.cos(Math.PI / 4);
const MODEL = makeGlb(
  {
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      { name: 'Rig', children: [1, 6, 7] },
      { name: 'hips', translation: [0, 1, 0], children: [2, 3, 4] },
      { name: 'head', translation: [0, 1, 0], children: [5, 8] },
      { name: 'foot.l', translation: [0.2, -1, 0] },
      { name: 'foot.r', translation: [-0.2, -1, 0] },
      { name: 'handslot.r', translation: [0.5, 0, 0], children: [9] },
      { name: 'Body', mesh: 0, skin: 0 },
      { name: 'Empty' },
      { name: 'Hat', mesh: 1, translation: [0, 0.5, 0] },
      { name: 'Knife', mesh: 1 },
    ],
    meshes: [
      {
        name: 'body',
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, JOINTS_0: 3, WEIGHTS_0: 4 }, indices: 5 }],
      },
      { name: 'tri', primitives: [{ attributes: { POSITION: 6, NORMAL: 7, TEXCOORD_0: 8 } }] },
    ],
    skins: [{ joints: [1, 2, 3, 4, 5], inverseBindMatrices: 9 }],
    animations: [
      {
        name: 'Idle',
        samplers: [{ input: 10, output: 11, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 2, path: 'rotation' } }],
      },
      {
        name: 'Walking_A',
        samplers: [
          { input: 12, output: 13, interpolation: 'LINEAR' },
          { input: 12, output: 14, interpolation: 'LINEAR' },
        ],
        channels: [
          { sampler: 0, target: { node: 3, path: 'translation' } },
          { sampler: 1, target: { node: 4, path: 'translation' } },
        ],
      },
    ],
  },
  [
    f32(POS, 'VEC3'),
    f32(
      POS.map(() => [0, 0, 1]),
      'VEC3'
    ),
    f32(
      POS.map(() => [0.5, 0.5]),
      'VEC2'
    ),
    { data: new Uint8Array(JOINTS.flat()), ct: 5121, count: 9, type: 'VEC4' },
    f32(WEIGHTS, 'VEC4'),
    { data: new Uint16Array([0, 1, 2, 3, 4, 5, 6, 7, 8]), ct: 5123, count: 9, type: 'SCALAR' },
    f32(TRI, 'VEC3'),
    f32(
      TRI.map(() => [0, 0, 1]),
      'VEC3'
    ),
    f32(
      TRI.map(() => [0.1, 0.1]),
      'VEC2'
    ),
    f32([inv([0, 1, 0]), inv([0, 2, 0]), inv([0.2, 0, 0]), inv([-0.2, 0, 0]), inv([0.5, 2, 0])], 'MAT4'),
    f32([[0], [1]], 'SCALAR', { min: [0], max: [1] }),
    f32(
      [
        [0, 0, 0, 1],
        [0, 0, s90, c90],
      ],
      'VEC4'
    ),
    f32([[0], [0.5], [1]], 'SCALAR', { min: [0], max: [1] }),
    f32(
      [
        [0.2, -1, -0.15],
        [0.2, -1, 0.15],
        [0.2, -1, -0.15],
      ],
      'VEC3'
    ),
    f32(
      [
        [-0.2, -1, 0.15],
        [-0.2, -1, -0.15],
        [-0.2, -1, 0.15],
      ],
      'VEC3'
    ),
  ]
);
void s45;
void c45;

/* a Buffer may sit in a shared pool: copy out its own bytes */
const decode = (b64, T) => {
  const b = Buffer.from(b64, 'base64');
  return new T(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

test('gltf figure: the skinned body and the hat kept, the knife in the hand left out; one joint a vertex', () => {
  const fig = buildFigure(readGlb(MODEL), { clips: 'Idle:idle@6,Walking_A:walk@12' });
  assert.deepEqual(fig.joints, ['hips', 'head', 'foot.l', 'foot.r'], 'the hand’s slot moves nothing kept');
  assert.equal(fig.counts.vertices, 12, 'the body’s 9 and the hat’s 3');
  assert.equal(fig.counts.triangles, 4);
  const V = decode(fig.vertices, Float32Array),
    slot = k => V[k * 9 + 6];
  /* the strongest joint: the body near the hips on the hips (0), the face on the head (1), the soles on the feet */
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(slot), [0, 0, 0, 1, 1, 1, 2, 3, 2, 1]);
  /* the hat rides the head, where it rests: 2.5 m up (before the scale) */
  const s = 1.75 / 2.7;
  assert.ok(Math.abs(V[9 * 9 + 1] - 2.5 * s) < 1e-5);
  /* the source's x flipped, and every vertex scaled to 1.75 m, the soles on the ground */
  assert.ok(Math.abs(V[0] - -0.3 * s) < 1e-6 && Math.abs(V[1] - 1 * s) < 1e-6);
  assert.ok(Math.abs(V[3] - 0) < 1e-6 && Math.abs(V[5] - 1) < 1e-6, 'the normal +z stays +z');
  let top = 0;
  for (let k = 0; k < 12; k++) top = Math.max(top, V[k * 9 + 1]);
  assert.ok(Math.abs(top - 1.75) < 1e-5);
  /* the triangles wound back after the flip */
  assert.deepEqual([...decode(fig.indices, Uint16Array).subarray(0, 3)], [0, 2, 1]);
});

test('gltf figure: a clip’s matrices move a vertex as the clip does, in the figure’s space', () => {
  const fig = buildFigure(readGlb(MODEL), { clips: 'Idle:idle@6,Walking_A:walk@12' }),
    s = 1.75 / 2.7,
    V = decode(fig.vertices, Float32Array),
    I = fig.clips.idle,
    M = decode(I.matrices, Float32Array),
    J = fig.joints.length;
  assert.equal(I.frames, 6);
  assert.equal(I.fps, 6);
  assert.deepEqual(I.lift, [0, 0, 0, 0, 0, 0], 'the hips never move');
  /* frame 3 is half the clip: the head turned 45 degrees about z, round itself (2 m up) */
  const m = M.subarray((3 * J + 1) * 12, (3 * J + 1) * 12 + 12),
    p = [V[3 * 9], V[3 * 9 + 1], V[3 * 9 + 2]],
    q = [0, 1, 2].map(r => m[r] * p[0] + m[3 + r] * p[1] + m[6 + r] * p[2] + m[9 + r]);
  /* in the source: (0.3, 0.2) from the head turned 45 degrees, then flipped and scaled */
  const a = Math.PI / 4,
    x = 0.3 * Math.cos(a) - 0.2 * Math.sin(a),
    y = 2 + 0.3 * Math.sin(a) + 0.2 * Math.cos(a);
  assert.ok(Math.abs(q[0] - -x * s) < 1e-4 && Math.abs(q[1] - y * s) < 1e-4, `${q} against ${[-x * s, y * s]}`);
  /* frame 0 leaves everything where it is modelled */
  const m0 = M.subarray(J * 0, 12);
  assert.deepEqual(
    [...m0].map(v => Math.round(v * 1e6) / 1e6),
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0].map(v => v)
  );
});

test('gltf figure: a walk’s stride from its feet, an extent round every pose', () => {
  const fig = buildFigure(readGlb(MODEL), { clips: 'Idle:idle@6,Walking_A:walk@12' }),
    s = 1.75 / 2.7;
  assert.equal(fig.clips.walk.frames, 12);
  /* each foot swings 0.3 m front to back: 0.6 m a cycle (before the scale) */
  assert.ok(Math.abs(fig.clips.walk.cycleM - 0.6 * s) < 0.002, `${fig.clips.walk.cycleM}`);
  assert.equal(fig.clips.idle.cycleM, undefined);
  assert.ok(fig.extent.top >= 1.75 && fig.extent.bottom <= 0 && fig.extent.r > 0.3 * s);
  assert.throws(() => buildFigure(readGlb(MODEL), { clips: 'Nope:idle@6' }), /no clip Nope/);
});

test('gltf figure: PNGs round trip; a texture snapped to the master palette, point-sampled', () => {
  const rgba = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 128, 10, 20, 30, 255, 200, 200, 200, 255, 1, 2, 3, 0,
    ]),
    back = decodePng(encodePng(3, 2, rgba));
  assert.deepEqual([back.w, back.h], [3, 2]);
  assert.deepEqual([...back.rgba], [...rgba]);
  const pal = new Set(masterPalette().map(c => c.join(',')));
  assert.ok(pal.size >= 160, `${pal.size} colours`);
  const big = { w: 8, h: 8, rgba: new Uint8Array(8 * 8 * 4) };
  for (let i = 0; i < 64; i++) big.rgba.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255], i * 4);
  const out = snapTexture(big, 4);
  for (let i = 0; i < 16; i++) {
    assert.ok(pal.has([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]].join(',')), `texel ${i}`);
    assert.equal(out[i * 4 + 3], 255);
  }
});
