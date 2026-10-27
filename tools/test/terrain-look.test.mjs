// Terrain TR-4: the ground's look by height and steepness. The wall atlas's fourth row (the biomes' cliff faces) next to
// the first three, kept pixel for pixel; every biome's cliff block; the biome's face material only with
// world.cliffFaces on; what the ground draw sends for strata and the snow line; and the painter's scree and turf edges
// (world.cliffEdges) on a small scene with a 1.2 m step, none of it with the switches off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPng } from './png.mjs';
import { recordingGL, fakeProgram } from './walk-renderer.mjs';
import { ENGINE_DEFAULTS } from '../../game/js/engine/settings.js';
import { provide } from '../../game/js/hooks.js';

const ROOT = join(import.meta.dirname, '..', '..');
const G = globalThis;
const { biomeCliff, defaultWallMaterial, wallAtlasRows, WALL_MATERIALS, WALL_COLORS, paintGroundSteps } = G;
const BIOMES = JSON.parse(readFileSync(join(ROOT, 'game', 'data', 'biomes.json'), 'utf8'));
// the game data the walk modules read through hooks.js: the biomes alone
provide({ gameData: { biomes: BIOMES } });

// with one World switch on for the length of f
function withSwitch(k, f) {
  const was = ENGINE_DEFAULTS.world[k];
  ENGINE_DEFAULTS.world[k] = true;
  try {
    return f();
  } finally {
    ENGINE_DEFAULTS.world[k] = was;
  }
}

test('the wall atlas has four rows; the first three are the cells from before TR-4, unchanged', () => {
  const im = readPng(join(ROOT, 'game', 'art', 'scene', 'build', 'walls.png'));
  assert.equal(im.width, 256);
  assert.equal(im.height, 256);
  assert.equal(wallAtlasRows(im), 4);
  assert.equal(wallAtlasRows({ width: 256, height: 192 }), 3);
  assert.equal(wallAtlasRows(null), 3);
  const grey = new Uint8Array(256 * 256);
  for (let i = 0; i < grey.length; i++) grey[i] = im.data[i * 4];
  // the 4 x 3 atlas as it was (game/art/scene/build/walls.png before TR-4), as a hash of its grey rows
  assert.equal(
    createHash('sha256')
      .update(grey.subarray(0, 256 * 192))
      .digest('hex')
      .slice(0, 16),
    '86243cceac5faf3c'
  );
  // the fourth row is greyscale in the five levels the ramp reads
  const levels = new Set();
  for (let i = 256 * 192 * 4; i < im.data.length; i += 4) {
    assert.ok(im.data[i] === im.data[i + 1] && im.data[i] === im.data[i + 2]);
    levels.add(im.data[i]);
  }
  for (const v of levels) assert.ok([0, 64, 128, 191, 255].includes(v), `grey level ${v}`);
  assert.equal(WALL_MATERIALS.length, 16);
  assert.equal(WALL_COLORS.length, 16);
});

test('every biome has a cliff block: a natural rock face, three strata colours, a band, and the agreed snow lines', () => {
  const nat = m => m < 4 || m === 9 || m > 10;
  for (const [b, B] of Object.entries(BIOMES)) {
    assert.ok(B.cliff, b);
    assert.ok(nat(B.cliff.mat) && B.cliff.mat >= 1 && B.cliff.mat <= 15, `${b}: mat ${B.cliff.mat}`);
    assert.equal(B.cliff.strata.length, 3, b);
    assert.ok(B.cliff.band > 0, b);
  }
  const lines = Object.fromEntries(Object.entries(BIOMES).map(([b, B]) => [b, B.cliff.snowLine ?? null]));
  assert.deepEqual(lines, {
    meadow: 15,
    thicket: 15,
    lake: 15,
    canyon: null,
    volcano: null,
    tundra: 4,
    sea: null,
    ridge: 11,
    autumn: 15,
    badlands: null,
    jungle: null,
    cave: null,
  });
});

test("a run place's walls take its biome's face only with world.cliffFaces on; a hand-made map keeps its rock", () => {
  {
    const ridge = { w: 4, h: 4, biome: 'ridge' },
      town = { w: 4, h: 4 };
    assert.equal(biomeCliff(ridge).mat, 15);
    assert.equal(biomeCliff(town), null);
    assert.equal(defaultWallMaterial(ridge), 1);
    withSwitch('cliffFaces', () => {
      assert.equal(defaultWallMaterial(ridge), 15);
      assert.equal(defaultWallMaterial(town), 1);
      assert.equal(defaultWallMaterial({ ...ridge, cliffMat: 5 }), 5);
    });
  }
});

test('the ground draw sends the strata and the snow line only with their switches on', () => {
  const { walkView } = G;
  const sent = () => {
    const gl = recordingGL(),
      U = fakeProgram(['uFaceB', 'uStrata', 'uSnowL']).U,
      K = biomeCliff(walkView.sc);
    // the part of drawGround (walk/ground-draw.js) that sets these, through the real program's uniform setter
    G.setTerrainLookUniforms(gl, U, walkView.sc, K);
    return Object.fromEntries(gl.calls.map(c => [c[1], c.slice(2)]));
  };
  const was = { sc: walkView.sc };
  try {
    walkView.sc = { w: 4, h: 4, biome: 'ridge' };
    let u = sent();
    assert.equal(u.uFaceB[1], 0);
    assert.equal(u.uSnowL[2], 0);
    assert.equal(u.uStrata, undefined);
    u = withSwitch('cliffFaces', sent);
    assert.deepEqual(u.uFaceB, [1.6, 1, 1, 15]);
    assert.equal(u.uStrata[0].length, 9);
    u = withSwitch('snowLine', sent);
    assert.deepEqual(u.uSnowL.slice(0, 3), [11, 1.5, 1]);
    walkView.sc = { w: 4, h: 4, biome: 'canyon' };
    u = withSwitch('snowLine', sent);
    assert.equal(u.uSnowL[2], 0, 'a biome without a snow line');
  } finally {
    walkView.sc = was.sc;
  }
});

// a scene 8 x 8 m of grass with its east half 1.2 m up (the step at x 4 m, a natural face of the scene's own rock),
// painted at 16 px a metre with plain one-colour tiles: grass green, rock grey, so scree is the grey pixels
function paintStep(ce) {
  const was = { wd: G.walkData, ts: G.tileSetPixels };
  const one = (c, TP) => ({ w: TP, h: TP, d: new Uint32Array(TP * TP).fill(c) });
  G.walkData = () => ({
    scenes: {},
    sc: {
      terrains: {
        g: { tile: 'scene/tiles/grass.png', edge: '#336633' },
        r: { tile: 'scene/tiles/rock.png', edge: '#555555' },
      },
    },
  });
  G.tileSetPixels = (T, TP) => [one(/rock/.test(T.tile) ? 0xff808080 : 0xff20a040, TP)];
  try {
    const sc = { id: 'tr4', w: 8, h: 8, edge: 'g', tiles: Array(8).fill('gggggggg') },
      E = G.newStepGrid(sc);
    for (let j = 0; j < 16; j++) for (let i = 8; i < 16; i++) E.H[j * 16 + i] = 1.2;
    G.storeStepGrid(sc, E);
    sc.ce = ce;
    const it = paintGroundSteps(sc, { TP: 16, margin: 0, normals: false });
    let r;
    do r = it.next();
    while (!r.done);
    return r.value;
  } finally {
    G.walkData = was.wd;
    G.tileSetPixels = was.ts;
  }
}
const greyAt = (P, x, y) => {
  const c = P.px[y * P.w + x],
    r = c & 255,
    g = (c >> 8) & 255,
    b = (c >> 16) & 255;
  return r === g && g === b;
};

test('scree gathers at the foot of a natural face and a turf edge lines the grassy top, only with world.cliffEdges', () => {
  const off = paintStep(null),
    on = paintStep({ nat0: true, rock: 'r' }),
    B = (on.w - 8 * 16) / 2,
    foot = B + 4 * 16; // the first pixel of the upper side
  const count = (P, x0, x1) => {
    let n = 0;
    for (let y = B + 16; y < B + 7 * 16; y++) for (let x = x0; x < x1; x++) n += greyAt(P, x, y);
    return n;
  };
  assert.equal(count(off, foot - 24, foot), 0, 'no scree with the switch off');
  const near = count(on, foot - 8, foot),
    far = count(on, foot - 24, foot - 16);
  assert.ok(near > 0, 'scree at the foot');
  assert.ok(near > far, `thinning out away from it: ${near} near, ${far} further`);
  assert.equal(count(on, foot - 64, foot - 32), 0, 'none 2 m away');
  assert.equal(count(on, foot, foot + 64), 0, 'none on the top');
  // the top's edge pixel: a light lip with the switch off, a dark turf edge with it on
  const g = (P, x) => (P.px[(B + 64) * P.w + x] >> 8) & 255;
  assert.ok(g(off, foot) > g(off, foot + 8), 'the light lip');
  assert.ok(g(on, foot) < g(on, foot + 8), 'the turf edge');
  // and nothing else in the picture changes
  let diff = 0;
  for (let y = 0; y < on.h; y++)
    for (let x = 0; x < on.w; x++)
      if (x < foot - 32 || x > foot + 8) diff += off.px[y * on.w + x] !== on.px[y * on.w + x];
  assert.equal(diff, 0);
});
