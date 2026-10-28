// Characters track CH-4: the figures' live atlas (game/js/figure-atlas.js) against a stand-in WebGL2 context: a person
// drawn into their cell once and again only when their picture changes, everyone in the one atlas, the sprites taking
// a cell's rect and the figure flag, and a lost context drawing everyone again. No graphics.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fakeProgram, recordingGL } from './walk-renderer.mjs';

await import('../../game/js/figure-atlas.js');
const G = globalThis;
const TILT = (26 * Math.PI) / 180;

/* a stand-in context whose objects are numbered (so a texture is a texture), with the atlas's programs */
function setup() {
  const gl = recordingGL();
  let n = 0;
  const made = new Proxy(gl, {
    get(o, k) {
      if (typeof k === 'string' && /^create/.test(k))
        return () => {
          o.calls.push([k]);
          return { id: ++n, of: k.slice(6) };
        };
      return o[k];
    },
  });
  G.gpuState.gl = made;
  G.gpuState.lost = 0;
  G.gpuState.gen = (G.gpuState.gen || 0) + 1;
  G.gpuState.fb = {};
  G.gpuState.P = {
    figAtlas: fakeProgram(['uJ', 'uM', 'uR', 'uRow', 'uH']),
    figCell: fakeProgram([
      'uT0',
      'uT1',
      'uRamp',
      'uS',
      'uO',
      'uOut',
      'uOutW',
      'uInk',
      'uInner',
      'uAO',
      'uM7',
      'uFx',
      'uOL',
    ]),
    figMark: fakeProgram(['uA']),
  };
  G.engineContext.look = { people: { figures: true, atlas: true, style: 'pixel', density: 32, yawSteps: 16 } };
  return gl;
}
const draws = gl => gl.calls.filter(c => c[0] === 'drawArrays' || c[0] === 'drawArraysInstanced');

test('the atlas: a person is drawn into their cell once, and again only when their picture changes', () => {
  const gl = setup(),
    rec = {},
    p = G.figurePicture(rec, 'mannequin', 'idle', 0, Math.PI, 0, TILT);
  assert.ok(p && p.figAtlas, 'a picture in the atlas');
  assert.equal(G.imageTexture(p), p.atlasT, "the sprites take the atlas's textures");
  gl.calls.length = 0;
  G.figureAtlasPass();
  const count = G.figureMesh(G.mannequinFigure()).count;
  assert.deepEqual(
    draws(gl).map(c => c.slice(0, 4)),
    [
      ['drawArrays', 'TRIANGLES', 0, count],
      ['drawArrays', 'TRIANGLES', 0, 6],
      ['drawArraysInstanced', 'TRIANGLES', 0, 6],
    ],
    'the figure into the scratch target, its cell, then the face marks (it faces the camera)'
  );
  const S = G.cardSize(32, 13 * G.TILT_STEP);
  assert.deepEqual([p.width, p.height, p.ax, p.ay, p.ppm], [S.w, S.h, S.ax, S.ay, 32]);
  assert.ok(G.personPicture(p), "counted as a person's picture (logic/person-view.js)");
  assert.deepEqual(p.uv, [0, 0, S.w / 2048, S.h / 1024], 'the first cell, at the bottom left');
  /* the same picture: nothing drawn */
  gl.calls.length = 0;
  assert.equal(G.figurePicture(rec, 'mannequin', 'idle', 0, Math.PI, 0, TILT), p, 'one picture object a person');
  G.figureAtlasPass();
  assert.equal(draws(gl).length, 0);
  /* the next frame of the idle: drawn again, in the same cell */
  G.figurePicture(rec, 'mannequin', 'idle', 2, Math.PI, 0, TILT);
  G.figureAtlasPass();
  assert.equal(draws(gl).length, 3);
  assert.equal(p.uv[0], 0);
  assert.equal(G.figureAtlasReport().draws >= 2, true);
});

test('the atlas: everyone in one texture, each in a cell of their own; a sprite record takes the cell and the flag', () => {
  setup();
  const P = [0, 1, 2].map(i => G.figurePicture({ i }, 'mannequin', 'walk', i, i, 0, TILT));
  G.figureAtlasPass();
  assert.ok(
    P.every(p => p.atlasT === P[0].atlasT),
    'one texture'
  );
  assert.equal(new Set(P.map(p => p.uv.join(','))).size, 3, 'three cells');
  const it = { im: P[1], x: 1, y: 0, z: 2, ox: -P[1].ax, oy: -P[1].ay, w: P[1].width, h: P[1].height, mpp: 1 / 32 };
  const r = { uv: new Float32Array(4) };
  G.spriteGeometry(r, it);
  assert.deepEqual(Array.from(r.uv), Array.from(new Float32Array(P[1].uv)));
  G.packSpriteInstance(0, { ...G.spriteRecordAt(0), ...r, right: [1, 0, 0], back: [0, 0, 1], fig: 1, mt: null }, true);
  const u = G.unpackSpriteInstance(0);
  assert.equal(u.fig, 1);
  assert.ok(u.cell.every((v, k) => Math.abs(v - P[1].uv[k]) < 1e-4));
});

test('the atlas: a lost context makes it again and draws everyone again', () => {
  const gl = setup(),
    rec = {};
  G.figurePicture(rec, 'mannequin', 'idle', 0, 0, 0, TILT);
  G.figureAtlasPass();
  /* the context comes back: a new generation; the restore drops the atlas's objects */
  G.gpuState.gen++;
  G.gpuState.fb = {};
  for (const [name, fn] of G.gpuRes.restore) if (name === 'figure atlas') fn();
  gl.calls.length = 0;
  const p = G.figurePicture(rec, 'mannequin', 'idle', 0, 0, 0, TILT);
  assert.ok(p, 'the same person, queued again');
  G.figureAtlasPass();
  assert.equal(draws(gl).filter(c => c[0] === 'drawArrays').length, 2, 'drawn again into the new atlas');
  assert.ok(
    gl.calls.some(c => c[0] === 'bufferData'),
    "the figure's buffers made again"
  );
});

test('the atlas off (Engine > People > Live atlas): the baked pictures, as before', () => {
  setup();
  G.engineContext.look.people.atlas = false;
  assert.equal(G.figureAtlasOn(), false);
});

test('the atlas: density by distance: a person twice as far as the camera target is drawn at half the dial', () => {
  setup();
  const was = G.walkView.C;
  try {
    G.walkView.C = { ...(was || {}), eye: [0, 1, 0], df: 10, sp: Math.sin(TILT), cp: Math.cos(TILT) };
    const near = G.figurePicture({}, 'mannequin', 'idle', 0, 0, 0, TILT, 'pixel', 0, [0, 9]),
      far = G.figurePicture({}, 'mannequin', 'idle', 0, 0, 0, TILT, 'pixel', 0, [0, 25]);
    G.figureAtlasPass();
    assert.deepEqual([near.ppm, far.ppm], [32, 16]);
    assert.ok(far.height < near.height * 0.6, 'a smaller cell');
  } finally {
    G.walkView.C = was;
  }
});
