// Buildings track BD-2b: the normal sheet. tools/build-surfaces.py paints it from the height map beside the building
// sheet; scenery.buildArt.normal names it; the buildings' and the models' shaders read it in bldBump (one read, in the
// face's own frame); bindBuildingNormals puts it on its unit and sets the strength, flat while it is missing. The
// setting is on by default and off with the graphics preset Off. No graphics: the shader texts and recorded calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPng } from './png.mjs';
import { recordingGL } from './walk-renderer.mjs';
await import('../../game/js/prop-models.js');
const { BUILDING_SHADERS, bindBuildingNormals } = await import('../../game/js/buildings.js');

const G = globalThis;
const ROOT = new URL('../../', import.meta.url);
const art = p => new URL('game/art/' + p, ROOT);
const scenery = JSON.parse(readFileSync(new URL('game/data/scenery.json', ROOT), 'utf8'));

test('the normal sheet: named by the scene data, the building sheet’s size, every normal facing out', () => {
  const A = scenery.buildArt;
  assert.ok(A.normal, 'scenery.buildArt.normal');
  const det = readPng(art(A.detail)),
    nm = readPng(art(A.normal));
  assert.deepEqual([nm.width, nm.height], [det.width, det.height]);
  let flat = 0,
    tilted = 0;
  for (let i = 0; i < nm.width * nm.height; i++) {
    const [x, y, z] = [0, 1, 2].map(c => nm.data[i * 4 + c] / 127.5 - 1);
    assert.ok(z > 0.1, `texel ${i} faces into the wall`);
    assert.ok(Math.abs(Math.hypot(x, y, z) - 1) < 0.03, `texel ${i} is not a unit normal`);
    if (Math.abs(x) + Math.abs(y) < 0.02) flat++;
    else tilted++;
  }
  /* bricks, shingles and seams tilt; their faces stay flat */
  assert.ok(flat > 0 && tilted > nm.width * nm.height * 0.1, `${flat} flat, ${tilted} tilted`);
});

test('the buildings’ shader reads the normal sheet once, in place of the three-read bump', () => {
  const f = BUILDING_SHADERS.bld[1];
  assert.ok(f.includes('uniform sampler2D uNrm'));
  assert.equal(f.split('textureLod(uNrm').length - 1, 1);
  assert.ok(!f.includes('bldH('), 'the old height reads are gone');
  assert.ok(f.includes('n=bldBump(n,g);'));
});

test('the models’ shaders bump from it too (their own-picture models stay flat)', () => {
  G.propModelShaders();
  for (const k of ['mdl']) assert.ok(G.PROP_MODEL_SHADERS[k][1].includes('if(!own)n=bldBump(n,g);'), k);
  const P = G.propModelShaders();
  assert.ok(P.mdlI[1].includes('if(!own)n=bldBump(n,g);'), 'mdlI');
});

test('bindBuildingNormals: its own unit, then back to unit 0; flat while the sheet is missing', () => {
  const was = G.gpuState.gl;
  try {
    const gl = recordingGL();
    G.gpuState.gl = gl;
    bindBuildingNormals({ U: { uNrm: 'N', uBStr: 'S' } }, { detail: 'scene/build/detail-a04b.png' });
    const unit = gl.calls.find(c => c[0] === 'uniform1i' && c[1] === 'N')[2];
    assert.notEqual(unit, 0);
    assert.ok(gl.calls.some(c => c[0] === 'bindSampler' && c[1] === unit && c[2] === null));
    assert.deepEqual(gl.calls.filter(c => c[0] === 'activeTexture').at(-1), ['activeTexture', 'TEXTURE0']);
    assert.deepEqual(
      gl.calls.find(c => c[0] === 'uniform1f'),
      ['uniform1f', 'S', 0]
    );
    gl.calls.length = 0;
    bindBuildingNormals({ U: {} }, { normal: 'x.png' });
    assert.equal(gl.calls.length, 0, 'a program without the sheet is left alone');
  } finally {
    G.gpuState.gl = was;
  }
});

test('on by default; the graphics preset Off turns it off', () => {
  assert.equal(G.ENGINE_DEFAULTS.world.buildingBumps, 1);
  assert.equal(G.OFF_LOOK.world.buildingBumps, 0);
});
