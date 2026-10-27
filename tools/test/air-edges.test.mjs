// Air track AIR-4: the light in the air keeps to its edges. JS twins of the shaders' sums (engine/post-effects.js):
// the march-size depth packed in two 8-bit steps (vdep) and read back (VOLZ_GLSL), the blur's depth weight (vblur)
// and the upscale's pick by depth (grade's volUp); then the shader sources, the dial and the plain look.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window ??= globalThis;
globalThis.document ??= {};
const { ENGINE_DEFAULTS, PLAIN_LOOK } = await import('../../game/js/engine/settings.js');

const read = f => readFileSync(new URL('../../game/js/' + f, import.meta.url), 'utf8');
const FAR = 400;
/* vdep: metres over the far plane, red the coarse step, green the fine; 8-bit storage rounds green to 1/255 */
const pack = z => {
  const zn = (z / FAR) * 255,
    hi = Math.floor(zn);
  return [hi / 255, Math.round((zn - hi) * 255) / 255];
};
/* a half-float target keeps red only nearly (11 bits) */
const half = v => {
  if (!v) return 0;
  const e = Math.floor(Math.log2(v));
  return Math.round(v * 2 ** (10 - e)) / 2 ** (10 - e);
};
const unpack = ([r, g]) => ((Math.floor(r * 255 + 0.5) + g) / 255) * FAR;
/* vblur: a tap's weight against the middle's depth */
const blurW = (z, z0) => {
  const e = (z - z0) / (z0 * 0.04 + 0.08);
  return Math.exp(-e * e);
};
/* volUp: the four depths round a pixel, its own depth: -1 for the bilinear read, else the index of the nearest */
const pick = (zs, z) => {
  let best = 1e9,
    bi = 0,
    md = 0;
  zs.forEach((zi, i) => {
    const e = Math.abs(zi - z);
    md = Math.max(md, e);
    if (e < best) {
      best = e;
      bi = i;
    }
  });
  return md < z * 0.05 + 0.1 ? -1 : bi;
};

test('the march-size depth reads back within a step of 1/65025 of the far plane, in 8-bit and half-float targets', () => {
  for (let z = 0.3; z <= FAR; z *= 1.07) {
    const p = pack(z);
    assert.ok(Math.abs(unpack(p) - z) <= FAR / 65025 + 1e-9, `8-bit at ${z}`);
    assert.ok(Math.abs(unpack([half(p[0]), p[1]]) - z) <= FAR / 65025 + 1e-9, `half float at ${z}`);
  }
  assert.equal(unpack(pack(FAR)), FAR, 'the sky is the far plane');
});

test('the blur keeps to its depth: a neighbour on the same surface counts, one across an edge does not', () => {
  assert.equal(blurW(20, 20), 1);
  assert.ok(blurW(20.3, 20) > 0.8, 'a slope across a pixel');
  assert.ok(blurW(40, 20) < 1e-6, 'the ground behind a tree');
  assert.ok(blurW(FAR, 20) < 1e-6, 'the sky behind a roof');
});

test('the upscale: smooth on a surface, the nearest depth at an edge', () => {
  assert.equal(pick([20, 20.2, 20.1, 20.3], 20.1), -1, 'one surface: the bilinear read');
  /* a tree at 12 m in front of ground at 30 m: a tree pixel takes a tree texel, a ground pixel a ground one */
  assert.equal(pick([12, 30, 12.1, 30.2], 12.05) % 2, 0);
  assert.equal(pick([12, 30, 12.1, 30.2], 30.1) % 2, 1);
  /* the player's head against the sky */
  assert.equal(pick([FAR, FAR, 18, FAR], 18), 2);
});

test('the shaders: the air reads the shrunk depth and the blue noise, blurs and upscales by depth', () => {
  const post = read('engine/post-effects.js'),
    gl = read('engine/webgl.js');
  assert.match(post, /vdep: \[/);
  assert.match(post, /d=min\(d,texelFetch\(uDep/, 'the nearest of the corners');
  assert.match(post, /use\('vblur', VO, qw, qh, true\)/, 'the air is softened by depth');
  assert.doesNotMatch(post, /use\('down', VO/, 'not by the plain blur');
  assert.match(post, /uniform sampler2D uZ,uBN;/);
  assert.doesNotMatch(post, /float j=lhash\(/, 'no hash jitter');
  assert.match(post, /texelFetch\(uBN,ivec2\(gl_FragCoord\.xy\)&63,0\)/);
  assert.match(post, /vec4 va=volUp\(\);/);
  assert.match(post, /float ah=hz\?min\(\.35,hsh\*uHS\*3\.\):0\.;/, 'the haze in shade, at most .35');
  assert.match(post, /1\.-\(1\.-sa\)\*\(1\.-ah\)\*T/);
  assert.match(gl, /gl\.R8, 64, 64, 0, gl\.RED, gl\.UNSIGNED_BYTE, blueNoiseTable\(\)/);
  /* VOLZ_GLSL is the twin's unpack */
  assert.match(post, /return \(floor\(v\.r\*255\.\+\.5\)\+v\.g\)\/255\.\*f;/);
  assert.match(post, /float e=\(volZ\(uZ,q,uZF\)-z0\)\/r,k=exp\(-e\*e\)/);
  assert.match(post, /z0\*\.04\+\.08/);
  assert.match(post, /md<z\*\.05\+\.1\?texture\(uVol,vUV\):texelFetch\(uVol,bi,0\)/);
});

test('Shade in the haze: a dial, on by default, none in battles, rooms or the plain look', () => {
  const settings = read('engine/settings.js'),
    walk = read('walk-view-gl.js');
  assert.equal(ENGINE_DEFAULTS.air.hazeShade, 0.5);
  assert.equal(PLAIN_LOOK.air.hazeShade, 0);
  assert.match(settings, /'hazeShade',\n\s+'Shade in the haze',/);
  assert.match(walk, /hazeShade: BT \|\| sc\.indoor \? 0 :/);
});
