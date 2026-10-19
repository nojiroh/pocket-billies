// Phase 20 C4: the flat things drawn as one group on the fx program, and the fx program's camera and light sent once per
// frame for blades and clock hands. A stand-in WebGL context keeps the state a real one keeps (the bound program, each
// program's uniforms, the texture on each unit) and notes all of it at every draw; the draws must be the same, in the
// same order and with the same state, as with the code these replaced (kept here as the reference). No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './walk-renderer.mjs';

const G = globalThis;
const { gpuState, drawSprites, drawRotatingBlades, useWalkProgram, worldCurveDrop, standingHeightAt } = G;

// a context that keeps state; every draw notes the bound program, its uniforms and the textures on every unit
function stateGL() {
  const S = { prog: null, uni: new Map(), unit: 0, tex: {}, samp: {}, draws: [], calls: 0 };
  const uni = p => S.uni.get(p) || S.uni.set(p, {}).get(p);
  const gl = new Proxy(S, {
    get(o, k) {
      if (k === 'state') return S;
      if (typeof k !== 'string') return undefined;
      if (/^[A-Z_0-9]+$/.test(k)) return k === 'TEXTURE0' ? 0 : k;
      return (...a) => {
        S.calls++;
        if (k === 'useProgram') S.prog = a[0];
        else if (k === 'activeTexture') S.unit = a[0];
        else if (k === 'bindTexture') S.tex[S.unit] = a[1];
        else if (k === 'bindSampler') S.samp[a[0]] = a[1];
        else if (k.startsWith('uniformMatrix')) uni(S.prog)[a[0]] = Array.from(a[2]);
        else if (k.startsWith('uniform') && a[0] != null)
          uni(S.prog)[a[0]] = a
            .slice(1)
            .flatMap(v => (ArrayBuffer.isView(v) || Array.isArray(v) ? Array.from(v) : [v]));
        else if (k === 'drawArrays')
          S.draws.push(JSON.stringify({ prog: S.prog, u: uni(S.prog), tex: S.tex, samp: S.samp }));
        return null;
      };
    },
  });
  return gl;
}
const LIGHT = ['uEye', 'uSunDir', 'uSunCol', 'uAmbTop', 'uAmbBot', 'uFogCol', 'uFogStart', 'uFogD', 'uShadow'];
const FX = ['uVP', 'uCurve', 'uCurveD0', ...LIGHT, 'uShadowD', 'uShadowOn', 'uShadowM', 'uP', 'uRight', 'uUp', 'uS'];
const program = (name, extra) => ({
  p: name,
  U: Object.fromEntries([...FX, 'uUV', 'uCol', 'uGlow', 'uLitFx', 'uTex', ...extra].map(n => [n, name + '.' + n])),
});
function setup() {
  const gl = stateGL();
  gpuState.gl = gl;
  gpuState.samp = { cmp: 'cmp', raw: 'raw' };
  gpuState.fb = {};
  gpuState.depthStub = 'stub';
  gpuState.P = { fx: program('fx', []), sprite: program('sprite', ['uBack', 'uFwd', 'uEmit', 'uFade']) };
  return gl.state;
}
const C = {
  vp: Array.from({ length: 16 }, (_, i) => i),
  right: [0.96, 0, 0.28],
  fwd: [0.1, -0.6, 0.79],
  back: [0, 0, 1],
};
const X = {
  eye: [1, 8, -12],
  sun: { dir: [0.3, 0.8, 0.52], col: [1, 0.9, 0.7] },
  ambTop: [0.4, 0.5, 0.6],
  ambBot: [0.2, 0.2, 0.1],
  fog: [0.6, 0.7, 0.8],
  fogStart: 12,
  fogD: 40,
  curve: [32, 24, 0.0004, 40],
  shadow: { d: 'nearDepth', vp: Array.from({ length: 16 }, (_, i) => -i), size: 2048, pen: 3 },
  lights: [],
  ao: [],
};
const blade = (x, z) => ({ x, y: 0.5, z, mpp: 1 / 32, flip: 1, M: {} });

/* the code before C4 */
function oldBlades(p, it, b, BT, rot, C, X, lift) {
  const gl = gpuState.gl,
    s = it.mpp,
    lf = lift || 0,
    cx = it.x + C.right[0] * b.x * s * it.flip - C.fwd[0] * lf,
    cz = it.z + C.right[2] * b.x * s * it.flip - C.fwd[2] * lf,
    cy = it.y - b.y * s,
    bs = b.w * s,
    c = Math.cos(rot),
    sn = Math.sin(rot),
    fp = useWalkProgram('fx', C, X);
  const R = C.right,
    r2 = [R[0] * c, sn, R[2] * c],
    u2 = [-R[0] * sn, c, -R[2] * sn];
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, BT.t);
  gl.uniform3f(fp.U.uP, cx, cy + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3fv(fp.U.uRight, r2);
  gl.uniform3fv(fp.U.uUp, u2);
  gl.uniform2f(fp.U.uS, bs, bs);
  gl.uniform4f(fp.U.uUV, 0, 0, 1, 1);
  gl.uniform4f(fp.U.uCol, 1, 1, 1, 1);
  gl.uniform1f(fp.U.uGlow, 0);
  gl.uniform1f(fp.U.uLitFx, 1);
  gl.uniform1i(fp.U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.useProgram(p.p);
}
function oldFlatItem(it, T, C, X) {
  const gl = gpuState.gl,
    fp = useWalkProgram('fx', C, X),
    U = fp.U,
    s = it.mpp,
    w = it.w * s,
    h = it.h * s,
    cx = it.x + (it.ox * s + w / 2) * it.flip,
    cz = it.z - (it.oy * s + h / 2) * 0.95;
  const wet = /lily/.test((it.p && it.p.k) || '') && !G.reducedMotion,
    ph = (G.walkView.t || 0) / 1000 + it.x * 1.3 + it.z * 0.7,
    an = wet ? Math.sin(ph * 0.45) * 0.07 : 0,
    bob = wet ? Math.sin(ph * 1.2) * 0.012 : 0;
  gl.uniform3f(U.uP, cx, standingHeightAt(it.x, it.z) + 0.04 + bob + worldCurveDrop(it.x, it.z), cz);
  gl.uniform3f(U.uRight, it.flip * Math.cos(an), 0, Math.sin(an));
  gl.uniform3f(U.uUp, -Math.sin(an) * it.flip, 0, Math.cos(an));
  gl.uniform2f(U.uS, w, h * 0.95);
  gl.uniform4f(U.uUV, 0, 0, 1, 1);
  gl.uniform4f(U.uCol, 1, 1, 1, 1);
  gl.uniform1f(U.uGlow, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, T.t);
  gl.uniform1i(U.uTex, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.useProgram(gpuState.P.sprite.p);
}

test('blades and clock hands: the same draws with the same state, the camera and light sent once', () => {
  const jobs = [
    [blade(3, 4), { x: 2, y: 30, w: 40 }, { t: 'sails' }, 0.7, 0],
    [blade(-6, 9), { x: -1, y: 52, w: 12 }, { t: 'hour' }, -1.2, 0.06],
    [blade(-6, 9), { x: -1, y: 52, w: 16 }, { t: 'minute' }, 2.5, 0.06],
  ];
  const run = draw => {
    const S = setup();
    gpuState.gl.useProgram('sprite');
    for (const [it, b, T, rot, lift] of jobs) draw(gpuState.P.sprite, it, b, T, rot, C, X, lift);
    return S;
  };
  const was = run(oldBlades),
    now = run(drawRotatingBlades);
  assert.equal(now.draws.length, 3);
  assert.deepEqual(now.draws, was.draws);
  assert.equal(now.prog, 'sprite', 'the sprite program is bound again after');
  assert.ok(now.calls < was.calls - 20, `fewer calls: ${now.calls} against ${was.calls}`);
  // a new frame (another light context) sends them again
  const S = setup();
  drawRotatingBlades(gpuState.P.sprite, ...jobs[0].slice(0, 4), C, X, 0);
  const n = S.calls;
  drawRotatingBlades(gpuState.P.sprite, ...jobs[0].slice(0, 4), C, { ...X }, 0);
  assert.equal(S.calls - n, n, 'a new light context is sent in full');
});

test('flat things: one group on the fx program, the same draws with the same state, the sprite program after', () => {
  G.walkView.sc = { w: 64, h: 48 };
  G.walkView.t = 5000;
  const im = { t: 'tex' },
    flat = (x, z, k) => ({
      flat: true,
      x,
      y: 0,
      z,
      mpp: 1 / 32,
      ox: -16,
      oy: -16,
      w: 32,
      h: 32,
      flip: 1,
      im,
      p: { k },
    }),
    items = [flat(1, 2, 'rug'), flat(4, 6, 'lily_pad'), flat(-3, 1, 'mat'), { ...flat(9, 9, 'rug'), vis: false }];
  const keep = G.imageTexture;
  G.imageTexture = i => i;
  try {
    // before: drawSprites' flat loop called the old drawFlatItem for each (the sprite pass itself draws nothing here)
    let S = setup();
    gpuState.gl.useProgram('sprite');
    for (const it of items) if (it.vis !== false) oldFlatItem(it, im, C, X);
    const was = S;
    S = setup();
    drawSprites(C, items, X, [], [], 32);
    assert.equal(S.draws.length, 3);
    assert.deepEqual(S.draws, was.draws);
    assert.equal(S.prog, 'sprite');
  } finally {
    G.imageTexture = keep;
  }
});
