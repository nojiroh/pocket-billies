// Fluid track FL-2a: the contact shade under a standing picture, worked out once per picture on the CPU
// (game/js/logic/contact-shade.js) instead of engine/webgl.js contactAO in every pixel. The twin must give what the
// shader gave: the GLSL is pinned here, and the twin is checked against a float32 run of the same steps. The batched
// path carries it in the flags varying's fraction: every flag reads back the same and the shade to a 65535th.
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('./walk-renderer.mjs');
const G = globalThis;
const { CONTACT_SHADE_MAX, contactShade } = await import('../../game/js/logic/contact-shade.js');

const GLSL =
  'float contactAO(vec3 p){float a=1.;for(int i=0;i<64;i++){if(i>=uNAO)break;vec4 b=uAO[i];vec2 d=(p.xz-b.xy)/b.zw;float e=dot(d,d);if(e<1.){float k=1.-e;a=min(a,1.-k*k*uContact);}}return a;}';

test("the shader's contactAO is the one the twin copies", () => {
  assert.ok(G.LIGHT_GLSL.includes(GLSL), 'webgl.js contactAO changed: change logic/contact-shade.js with it');
  assert.equal(CONTACT_SHADE_MAX, 64);
});

// the shader's steps in float32, as the GPU runs them
const f = Math.fround;
function shaderAO(ao, contact, x, z) {
  let a = f(1);
  const c = f(contact);
  for (let i = 0; i < Math.min(64, ao.length); i++) {
    const b = ao[i].map(f),
      dx = f(f(f(x) - b[0]) / b[2]),
      dz = f(f(f(z) - b[1]) / b[3]),
      e = f(f(dx * dx) + f(dz * dz));
    if (e < 1) {
      const k = f(1 - e);
      a = Math.min(a, f(1 - f(f(k * k) * c)));
    }
  }
  return a;
}
// a small seeded random, so a failure repeats
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

test('the twin against the float32 shader steps: 2000 points over random patches', () => {
  const R = rng(7);
  for (let t = 0; t < 20; t++) {
    const ao = Array.from({ length: Math.floor(R() * 80) }, () => [R() * 40, R() * 40, 0.2 + R() * 3, 0.2 + R() * 2]),
      contact = R();
    for (let j = 0; j < 100; j++) {
      const x = R() * 40,
        z = R() * 40;
      assert.ok(Math.abs(contactShade(ao, contact, x, z) - shaderAO(ao, contact, x, z)) < 2e-6);
    }
  }
});

test('away from every patch, with no patches or the dial at 0: 1; under a middle: 1 - contact', () => {
  const ao = [[5, 5, 1, 1]];
  assert.equal(contactShade(ao, 0.6, 20, 20), 1);
  assert.equal(contactShade([], 0.6, 5, 5), 1);
  assert.equal(contactShade(null, 0.6, 5, 5), 1);
  assert.equal(contactShade(ao, 0, 5, 5), 1);
  assert.ok(Math.abs(contactShade(ao, 0.6, 5, 5) - 0.4) < 1e-12);
  // only the first 64 patches count, as in the Frame block
  const many = Array.from({ length: 64 }, () => [100, 100, 1, 1]).concat([[5, 5, 1, 1]]);
  assert.equal(contactShade(many, 0.6, 5, 5), 1);
});

test('the batched path: the flags and the shade share vSelfS.w and read back apart', () => {
  const [vs, fs] = G.SPRITE_INSTANCE_SHADERS.spriteI;
  assert.ok(vs.includes('+float(iFlags.z|(iFlags.w<<8u))/131070.'), 'the shade added to the flags');
  assert.ok(fs.includes('#define uCAO (fract(vSelfS.w)*2.)'));
  assert.ok(!G.WALK_SHADERS.sprite[1].includes('contactAO(uBaseP)'), 'no per-pixel loop for a picture');
  // the defines' maths in float32, for every flag combination and shades from 0 to 1
  for (let flags = 0; flags < 16; flags++)
    for (const cao of [0, 1 / 65535, 0.25, 0.5, 0.731, 0.99999, 1]) {
      const c16 = Math.round(cao * 65535),
        w = f(flags + f(c16 / 131070)),
        flipN = (f(Math.floor(w)) % 2 > 0.5 ? -1 : 1) === -1,
        fixed = Math.floor(w * 0.5) % 2,
        noRecv = Math.floor(w * 0.25) % 2,
        fig = Math.floor(w * 0.125),
        back = f(w - Math.floor(w)) * 2;
      assert.deepEqual([flipN, fixed, noRecv, fig], [!!(flags & 1), (flags >> 1) & 1, (flags >> 2) & 1, flags >> 3]);
      assert.ok(Math.abs(back - cao) < 1.5 / 65535, `${flags} ${cao}: ${back}`);
    }
});
