'use strict';
/* ================= WALK WATER =================
   Phase 20 (stage B): the reflection pass, the water's life and ripples, and drawing the water, moved from
   walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  ambientLife,
  drawPropModels,
  provide,
  reducedMotion,
  roomHole,
  setPropLookUniforms,
  soundEffectAt,
} from '../hooks.js';
import { pictureRight } from '../logic/prop-turn.js';
import { walkData, walkView } from '../walk-view.js';
import { engineColor, engineSetting } from '../engine/settings.js';
import { bindQuad, gpuState, imageTexture, matrix4, renderTarget } from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { setSpriteUniforms, useWalkProgram } from './draw-common.js';
import { WATER_KIND_LOOKS, setFlowUniforms, setPixelWaterUniform, setShoreUniforms } from './water-data.js';
import { computeFrustum, inFrustum } from './quality-cull.js';
import { skyColors } from './sky.js';
/* eslint-disable no-func-assign */
expose({
  KIND_ROWS: [() => KIND_ROWS],
  addRipple: [() => addRipple, v => ((addRipple = v), provide({ addRipple }))],
  addWakeRipple: [() => addWakeRipple, v => ((addWakeRipple = v), provide({ addWakeRipple }))],
  drawWater: [() => drawWater, v => setDrawWater(v)],
  kindTex: [() => kindTex, v => (kindTex = v)],
  kindTexture: [() => kindTexture, v => (kindTexture = v)],
  mirrorInView: [() => mirrorInView, v => (mirrorInView = v)],
  reflectionLevel: [() => reflectionLevel, v => (reflectionLevel = v)],
  reflectionPass: [() => reflectionPass, v => setReflectionPass(v)],
  setWaterUniforms: [() => setWaterUniforms, v => (setWaterUniforms = v)],
  waterAt: [() => waterAt, v => (waterAt = v)],
  waterLife: [() => waterLife, v => (waterLife = v)],
  waterNear: [() => waterNear, v => (waterNear = v)],
});
/* eslint-enable no-func-assign */
provide({ addRipple, addWakeRipple });
export function setDrawWater(v) {
  drawWater = v; // eslint-disable-line no-func-assign
  provide({ drawWater });
}
export function setReflectionPass(v) {
  reflectionPass = v; // eslint-disable-line no-func-assign
  provide({ reflectionPass });
}
/* to-module: end */
/* alpha 0.2: is there water within 5 m to the side, 1 m in front or 9 m behind (the reflection pass asks this of
   everything it might mirror): a summed table of the view's water tiles, rebuilt when the tiles change */
function waterNear(x, z) {
  const wt = walkView.water;
  if (!wt || !wt.length) return false;
  let Q = walkRenderer.wsat;
  if (!Q || Q.src !== wt) {
    const sc = walkView.sc,
      W = Math.max(1, sc.w | 0),
      H = Math.max(1, sc.h | 0),
      R = W + 1,
      S = new Int32Array(R * (H + 1));
    for (const w of wt) {
      const i = Math.floor(w[0]),
        k = Math.floor(w[1]);
      if (i >= 0 && k >= 0 && i < W && k < H) S[(k + 1) * R + i + 1]++;
    }
    for (let k = 1; k <= H; k++)
      for (let i = 1; i <= W; i++) {
        const q = k * R + i;
        S[q] += S[q - 1] + S[q - R] - S[q - R - 1];
      }
    Q = walkRenderer.wsat = { src: wt, S, W, H };
  }
  const i0 = Math.max(0, Math.floor(x - 5.5) + 1),
    i1 = Math.min(Q.W - 1, Math.ceil(x + 4.5) - 1),
    k0 = Math.max(0, Math.floor(z - 9.5) + 1),
    k1 = Math.min(Q.H - 1, Math.ceil(z + 0.5) - 1);
  if (i0 > i1 || k0 > k1) return false;
  const S = Q.S,
    R = Q.W + 1;
  return S[(k1 + 1) * R + i1 + 1] - S[k0 * R + i1 + 1] - S[(k1 + 1) * R + i0] + S[k0 * R + i0] > 0;
}
/* alpha 0.2: would a thing's mirror image (across the water at height L) be on screen: the sphere cullItems uses, wider
   for the ripples, and without the world's curve (the reflection is drawn flat, uCurveOn 0) */
function mirrorInView(F, it, L) {
  const s = it.mpp || 0.03,
    w = (it.w || 32) * s,
    h = (it.h || 32) * s,
    b = it.M && it.M.box,
    ext = b ? Math.max(b[0], b[1]) * ((it.p && it.p.s) || 1) : 0,
    r = Math.max(w, h, ext) * 0.75 + 2,
    cy = (it.y || 0) + h * 0.5;
  return inFrustum(F, it.x, 2 * L - cy, it.z, r);
}
export function reflectionPass(items, C, rw, rh, X) {
  const gl = gpuState.gl,
    w = Math.max(32, rw >> 1),
    h = Math.max(32, rh >> 1),
    F = renderTarget('refl', w, h, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.f);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const L = reflectionLevel(),
    mir = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 2 * L, 0, 1]),
    RC = Object.assign({}, C, { vp: matrix4.mul(C.vp, mir) });
  const p = useWalkProgram('sprite', RC, Object.assign({}, X, { shadow: null })),
    U = p.U;
  bindQuad();
  gl.uniform3fv(U.uRight, C.right);
  gl.uniform3fv(U.uBack, C.back);
  gl.uniform3fv(U.uFwd, C.fwd);
  gl.uniform1f(U.uDZ, 0);
  gl.uniform3f(U.uSunH, 0, 0, 0);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1i(U.uNrm, 1);
  gl.uniform1f(U.uFade, 1);
  gl.uniform1f(U.uRim, 0);
  gl.uniform1f(U.uLit, 1);
  gl.uniform1f(U.uAlpha, 1);
  gl.uniform1f(U.uCurveOn, 0);
  gl.uniform1f(U.uShade, 0.3);
  gl.uniform1f(U.uEmit, 0);
  gl.uniform1f(U.uFlipN, 1);
  gl.uniform1f(U.uFixed, 0);
  gl.uniform4f(U.uMat, 0, 1, 0, 0.15);
  if (U.uSelOut) gl.uniform1f(U.uSelOut, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  /* alpha 0.2: near water by a summed table (a joined view can hold thousands of water tiles, and walking them all for
    every thing cost the iPad about 10 ms a frame), and only what shows in the water: its mirror image in view */
  const FR = computeFrustum(C.vp),
    cut = engineSetting('quality', 'cull') ?? true,
    models = [];
  for (const it of items) {
    if (it.flat || it.far) continue;
    if (!waterNear(it.x, it.z)) continue;
    if (cut && !it.person && !mirrorInView(FR, it, L)) continue;
    /* water track WA-1: a prop drawn as a model (every game-flow building) is mirrored as that model, not as its old
       flat picture turned to the camera (the main pass draws no picture for it either) */
    if (it.vox) {
      models.push(it);
      continue;
    }
    const T = imageTexture(it.im);
    if (!T) continue;
    /* phase 09 batch 9: a turned picture's reflection turns with it (logic/prop-turn.js pictureRight) */
    gl.uniform3fv(U.uRight, pictureRight(it, C.right));
    gl.uniform3f(U.uBaseP, it.x, it.y, it.z);
    setPropLookUniforms(U, it.lk);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T.n);
    setSpriteUniforms(p, it);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  if (models.length && typeof drawPropModels === 'function')
    drawPropModels(RC, models, Object.assign({}, X, { shadow: null }));
  walkRenderer.reflModels = models.length;
}
/* v22: the kinds' colours and the water's small lives: fish circling their deep spots, rings from ducks, fish and insects */
/* water track WA-5b: the kinds' looks in a small texture instead of fixed uniform arrays (they stopped at nine): a
   column a kind (its index in WATER_KIND_LOOKS), a row a group: 0 deep and scum, 1 shallow, 2 clarity caustics foam ripples,
   3 glow murk weed mode, 4 the sea's family (swell, surf, tide), white water, coral, bubbles, 5 the glow's colour.
   Made once per context (unit 15, read with texelFetch) */
const KIND_ROWS = 6;
let kindTex = null;
function kindTexture() {
  const gl = gpuState.gl;
  if (kindTex && kindTex.gl === gl) return kindTex.t;
  const N = WATER_KIND_LOOKS.length,
    d = new Float32Array(N * KIND_ROWS * 4);
  WATER_KIND_LOOKS.forEach((k, i) => {
    const row = (r, v) => d.set(v, (r * N + i) * 4);
    row(0, [...k.deep, k.scum || 0]);
    row(1, [...k.shal, 0]);
    row(2, [k.clar, k.caus, k.foam, k.rip]);
    row(3, [k.glow, k.murk, k.weed, k.mode || 0]);
    row(4, [k.sea || 0, k.white || 0, k.coral || 0, k.bub || 0]);
    row(5, [...(k.glowC || [0, 0, 0]), 0]);
  });
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, KIND_ROWS, 0, gl.RGBA, gl.FLOAT, d);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  kindTex = { gl, t };
  return t;
}
export function waterAt(x, z) {
  const G = walkRenderer.wgrid;
  if (!G) return null;
  const i = Math.floor(x * 2),
    j = Math.floor(z * 2);
  if (i < 0 || j < 0 || i >= G.W2 || j >= G.H2) return null;
  const q = j * G.W2 + i;
  return G.dep[q] > 0 || G.y[q] !== 0 ? { dep: G.dep[q], kind: G.kind[q], y: G.y[q] } : null;
}
function waterLife() {
  const t = (reducedMotion ? 0 : walkView.t || 0) / 1000,
    now = performance.now() / 1000,
    dt = Math.min(0.1, Math.max(0, now - (walkRenderer.wlT || now)));
  walkRenderer.wlT = now;
  const fish = new Float32Array(16),
    rings = new Float32Array(32);
  if (engineSetting('water', 'fish'))
    (walkRenderer.fishHomes || []).forEach((h, i) => {
      const sp = 0.35 + 0.12 * Math.sin(i * 2.3),
        a = (t * sp) / Math.max(0.5, h[3]) + i * 1.9,
        r = h[3] * (0.75 + 0.25 * Math.sin(t * 0.13 + i)),
        x = h[0] + Math.cos(a) * r,
        z = h[1] + Math.sin(a) * r * 0.8;
      fish[i * 4] = x;
      fish[i * 4 + 1] = z;
      fish[i * 4 + 2] = Math.atan2(Math.cos(a) * 0.8, -Math.sin(a));
      fish[i * 4 + 3] = 0.75 + (0.25 * ((i * 7) % 3)) / 2;
      if (!walkRenderer.bt && Math.random() < dt * 0.06) addRipple(x, z, 0.7);
      /* v27: now and then one jumps clear of the water */ if (
        !walkRenderer.bt &&
        !reducedMotion &&
        Math.random() < dt * 0.012
      ) {
        addRipple(x, z, 0.9);
        (walkRenderer.splash = walkRenderer.splash || []).push({
          x,
          z,
          y: walkRenderer.wlevelR ?? walkRenderer.wlevel ?? 0,
          a: 0,
        });
        if (typeof soundEffectAt === 'function') soundEffectAt('plop', x, z);
      }
    });
  if (engineSetting('water', 'rings') && !walkRenderer.bt && !reducedMotion) {
    if (typeof ambientLife !== 'undefined')
      for (const c of ambientLife.list || [])
        if (c.k === 'duck') {
          c._rg = (c._rg || Math.random()) - dt * (c.st === 'walk' ? 1.6 : 0.35);
          if (c._rg <= 0) {
            c._rg = 1;
            addRipple(c.x, c.z, c.st === 'walk' ? 0.8 : 0.5);
          }
        }
    /* v47: rings now and then round what stands in the water: rocks, posts, reeds, the legs of a jetty */
    if (walkRenderer.wetPropsId !== walkView.id) {
      walkRenderer.wetPropsId = walkView.id;
      walkRenderer.wetProps = (walkView.sc.props || [])
        .filter(p => {
          const M = walkData().sc.props[p.k];
          return M && !M.walk && typeof waterAt === 'function' && waterAt(p.x, p.z);
        })
        .slice(0, 40);
    }
    const WP = walkRenderer.wetProps;
    if (WP && WP.length && Math.random() < dt * Math.min(2.5, WP.length * 0.35)) {
      const p = WP[Math.floor(Math.random() * WP.length)];
      addRipple(p.x + (Math.random() - 0.5) * 0.3, p.z + (Math.random() - 0.5) * 0.3, 0.45 + Math.random() * 0.25);
    }
    const G = walkRenderer.wgrid;
    if (G && Math.random() < dt * 1.4) {
      for (let k = 0; k < 6; k++) {
        const i = Math.floor(Math.random() * G.W2),
          j = Math.floor(Math.random() * G.H2),
          q = j * G.W2 + i,
          kd = G.kind[q];
        if (G.dep[q] > 0.05 && kd !== 1) {
          addRipple(
            (i + 0.5) * 0.5 + Math.random() * 0.4 - 0.2,
            (j + 0.5) * 0.5 + Math.random() * 0.4 - 0.2,
            kd === 4 ? 0.7 : 0.45
          );
          break;
        }
      }
    }
  }
  const R = walkRenderer.rings || [],
    Wk = walkRenderer.wake || [];
  for (const r of R) r[2] += dt;
  for (const r of Wk) r[2] += dt;
  walkRenderer.rings = R.filter(r => r[2] < 2.4);
  walkRenderer.wake = Wk.filter(r => r[2] < 2.4);
  /* WA-2a: the shader's 8: the wake's newest (up to 3) first, then the scene's newest */
  const w = walkRenderer.wake.slice(-3);
  w.concat(walkRenderer.rings.slice(-(8 - w.length))).forEach((r, i) => rings.set(r, i * 4));
  return { fish, rings };
}
export function addRipple(x, z, k) {
  (walkRenderer.rings = walkRenderer.rings || []).push([x, z, 0, k]);
  if (walkRenderer.rings.length > 16) walkRenderer.rings.shift();
}
/* water track WA-2a: rings of your wake as you wade, kept apart (4 at most) so they never push out the scene's own */
function addWakeRipple(x, z, k) {
  (walkRenderer.wake = walkRenderer.wake || []).push([x, z, 0, k]);
  if (walkRenderer.wake.length > 4) walkRenderer.wake.shift();
}
function setWaterUniforms(U) {
  const gl = gpuState.gl;
  if (U.uKinds == null) return;
  const t = kindTexture();
  gl.activeTexture(gl.TEXTURE15);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.bindSampler(15, null);
  gl.uniform1i(U.uKinds, 15);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1f(U.uCaus, engineSetting('water', 'caustics'));
  gl.uniform1f(U.uClar, engineSetting('water', 'clarity'));
  const L = waterLife();
  gl.uniform4fv(U.uFish, L.fish);
  gl.uniform4fv(U.uRings, L.rings);
}
function reflectionLevel() {
  const G = walkRenderer.wlevels;
  if (!G || G.length < 2) return (walkRenderer.wlevelR = walkRenderer.wlevel || 0);
  const P = walkView.pl;
  let best = null,
    bs = -1;
  for (const g of G) {
    const dx = Math.max(0, g.b[0] - P.x, P.x - g.b[2]),
      dz = Math.max(0, g.b[1] - P.z, P.z - g.b[3]),
      d2 = dx * dx + dz * dz;
    const sc = Math.sqrt(g.n) / (1 + d2 / 16);
    if (sc > bs) {
      bs = sc;
      best = g;
    }
  }
  return (walkRenderer.wlevelR = best ? best.y : walkRenderer.wlevel);
}
export function drawWater(C, X, rw, rh) {
  const gl = gpuState.gl,
    p = useWalkProgram('water', C, X),
    U = p.U,
    sc = walkView.sc,
    sky = skyColors(sc);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, walkRenderer.water && gpuState.fb.refl ? gpuState.fb.refl.c : gpuState.white);
  gl.uniform1i(U.uRefl, 0);
  gl.uniform2f(U.uRes, rw, rh);
  gl.uniform3fv(U.uDeep, engineColor('water', 'deep', '#1D4F78'));
  gl.uniform3fv(U.uShallow, engineColor('water', 'shallow', '#4FA6C0'));
  gl.uniform3fv(U.uSkyR, sky[1]);
  gl.uniform1f(U.uReflK, engineSetting('water', 'reflection'));
  gl.uniform1f(U.uRip, engineSetting('water', 'ripples'));
  gl.uniform1f(U.uFoam, engineSetting('water', 'foam'));
  gl.uniform1f(U.uGlint, engineSetting('water', 'glints'));
  gl.uniform1f(U.uLevel, walkRenderer.wlevelR ?? walkRenderer.wlevel ?? 0);
  setWaterUniforms(U);
  setShoreUniforms(U, sc);
  setFlowUniforms(U, sc);
  if (U.uHole) gl.uniform4fv(U.uHole, roomHole(sc));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  if (walkRenderer.water) {
    gl.bindVertexArray(walkRenderer.water.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.water.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  /* v31: fountain and well basins: the same moving water, mirror off (they sit above the pond level), no shoreline */
  if (walkRenderer.basin) {
    gl.uniform1f(U.uLevel, -99);
    if (U.uShoreR) gl.uniform3f(U.uShoreR, 1, 1, 0);
    setFlowUniforms(U, sc, false);
    gl.bindVertexArray(walkRenderer.basin.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.basin.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  if (walkRenderer.fallMesh) {
    const f = useWalkProgram('fall', C, X);
    gl.uniform3fv(f.U.uShallow, engineColor('water', 'shallow', '#4FA6C0'));
    setPixelWaterUniform(f.U);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(walkRenderer.fallMesh.vao);
    gl.drawElements(gl.TRIANGLES, walkRenderer.fallMesh.n, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
