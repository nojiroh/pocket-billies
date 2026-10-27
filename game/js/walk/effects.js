'use strict';
/* ================= WALK EFFECTS =================
   Phase 20 (stage B): the frame's effects pass (glows, smoke, sparks, flags and the rest), moved from walk-view-gl.js
   as it was. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  buildingItems,
  buildingState,
  chimneySmoke,
  clueDraw,
  frontWindowLight,
  litWindowFraction,
  provide,
  reducedMotion,
  soundEffectAt,
  worldBillyGlows,
} from '../hooks.js';
import { clamp } from '../util.js';
import { placedTurn } from '../logic/prop-turn.js';
import { crownGaps, pickShafts } from '../logic/shaft-pick.js';
import { hexToRgb } from '../art.js';
import { EFFECT_FRAMES, artImage, walkData, walkView } from '../walk-view.js';
import { engineContext, engineSetting } from '../engine/settings.js';
import {
  LIGHT_GLSL,
  bindQuad,
  ensurePrograms,
  gpuBuffer,
  gpuSized,
  gpuState,
  gpuVao,
  imageTexture,
  windGustAt,
} from '../engine/webgl.js';
import { environment, environmentWindowLit } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { standingHeightAt } from './heights.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
import { WATER_KIND_LOOKS } from './water-data.js';
import { drawRoomEffects, roomSkyLight, windowLightShare } from './rooms.js';
import { addRipple, waterAt } from './water.js';
import { lampLit } from './lighting.js';
import { drawFootprints, drawFountainEffects, drawLifeEffects, drawWeather } from './fountains-weather.js';
/* eslint-disable no-func-assign */
expose({
  RIBBON_FLOATS: [() => RIBBON_FLOATS],
  RIBBON_SHADERS: [() => RIBBON_SHADERS],
  SHAFT_FADE_S: [() => SHAFT_FADE_S],
  SHAFT_MAX: [() => SHAFT_MAX],
  SHAFT_PICK_MS: [() => SHAFT_PICK_MS],
  SHAFT_RANGE: [() => SHAFT_RANGE],
  WEATHER_FLOATS: [() => WEATHER_FLOATS],
  WEATHER_FX_SHADERS: [() => WEATHER_FX_SHADERS],
  drawClimbSpray: [() => drawClimbSpray, v => (drawClimbSpray = v)],
  drawDivers: [() => drawDivers, v => (drawDivers = v)],
  effectsPass: [() => effectsPass, v => setEffectsPass(v)],
  lightShafts: [() => lightShafts, v => (lightShafts = v)],
  ribbonPass: [() => ribbonPass, v => (ribbonPass = v)],
  shaftList: [() => shaftList],
  shaftStrength: [() => shaftStrength, v => (shaftStrength = v)],
  smartLightShafts: [() => smartLightShafts, v => (smartLightShafts = v)],
  smartShafts: [() => smartShafts],
  volumeAirOn: [() => volumeAirOn, v => (volumeAirOn = v)],
  weatherBatch: [() => weatherBatch],
});
/* eslint-enable no-func-assign */
export function setEffectsPass(v) {
  effectsPass = v; // eslint-disable-line no-func-assign
  provide({ effectsPass });
}
/* to-module: end */
/* phase 20 R2 (pixels): the weather's quads (rain, snow, ash and their splashes, one picture) in one draw
   (quality.rainBatch): the fx program's maths, with each quad's place, size, frame, colour and up axis per instance,
   drawn in the same order */
export const WEATHER_FX_SHADERS = {
  fxW: [
    `#version 300 es
precision highp float;in vec2 aC;layout(location=1) in vec3 iP;layout(location=2) in vec2 iS;layout(location=3) in vec4 iUV;layout(location=4) in vec4 iCol;layout(location=5) in vec3 iUp;
uniform mat4 uVP;uniform vec3 uRight;out vec2 vUV;out vec3 vW;out vec4 vCol;
void main(){vec2 c=aC-.5;vec3 p=iP+uRight*c.x*iS.x+iUp*(-c.y)*iS.y;vW=p;vUV=vec2(iUV.x+aC.x*iUV.z,iUV.y+aC.y*iUV.w);vCol=iCol;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;in vec4 vCol;out vec4 o;uniform sampler2D uTex;uniform float uLitFx;${LIGHT_GLSL}
void main(){vec4 c=texture(uTex,vUV)*vCol;if(c.a<.02)discard;if(uLitFx>.5)c.rgb*=mix(uAmbTop,vec3(1.),.5)+uSunCol*.4;c.rgb=fogit(c.rgb,vW);o=c;}`,
  ],
};
/* VFX-2: a thrown pyramid's motion lines (battle-3d.js battle3dFrame's ribbon): one strip, flat and unlit, hard
   edged, a white core along its middle and its own colour outside; eroded by a 4x4 Bayer dither on the screen's
   pixels (never a soft fade). Per vertex: its place, which side (-1, 1) and its erosion (0 whole .. 1 gone) */
export const RIBBON_SHADERS = {
  ribbon: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 aP;layout(location=1) in vec2 aA;uniform mat4 uVP;out vec3 vW;out vec2 vA;
void main(){vW=aP;vA=aA;gl_Position=uVP*vec4(aP,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vA;out vec4 o;uniform vec3 uCol;uniform float uCore;${LIGHT_GLSL}
float rbBayer(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
void main(){if(rbBayer(gl_FragCoord.xy)<vA.y)discard;o=vec4(fogit(abs(vA.x)<uCore?vec3(1.):uCol,vW),1.);}`,
  ],
};
const RIBBON_FLOATS = 5;
/* R: { v: [x, y, z, side, erosion, ...] two vertices a point, head first; col: [r, g, b] 0..1; core: the white
   share }. Drawn after the effects, before the post pass; leaves the fx program's quad bound as it found it */
export function ribbonPass(C, R, X) {
  const n = R && R.v ? R.v.length / RIBBON_FLOATS : 0;
  if (n < 4) return;
  const gl = gpuState.gl;
  ensurePrograms(RIBBON_SHADERS);
  const p = useWalkProgram('ribbon', C, X);
  if (!p.rb) {
    /* made with the program, so a new context (initWebgl empties gpuState.P) makes them again */
    const vao = gpuVao('instances'),
      buf = gpuBuffer('instances');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, RIBBON_FLOATS * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, RIBBON_FLOATS * 4, 12);
    gl.bindVertexArray(null);
    p.rb = { vao, buf, d: new Float32Array(RIBBON_FLOATS * 64) };
  }
  if (p.rb.d.length < R.v.length) p.rb.d = new Float32Array(R.v.length * 2);
  const d = p.rb.d;
  for (let i = 0; i < R.v.length; i += RIBBON_FLOATS) {
    d[i] = R.v[i];
    d[i + 1] = R.v[i + 1] + worldCurveDrop(R.v[i], R.v[i + 2]);
    d[i + 2] = R.v[i + 2];
    d[i + 3] = R.v[i + 3];
    d[i + 4] = R.v[i + 4];
  }
  gl.uniform3fv(p.U.uCol, R.col);
  gl.uniform1f(p.U.uCore, R.core);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.disable(gl.BLEND);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.rb.buf);
  gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, R.v.length), gl.DYNAMIC_DRAW);
  gpuSized(p.rb.buf, R.v.length * 4);
  gl.bindVertexArray(p.rb.vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);
  gl.bindVertexArray(null);
  gl.enable(gl.BLEND);
  bindQuad();
}
const WEATHER_FLOATS = 16;
const weatherBatch = {
  n: 0,
  d: new Float32Array(WEATHER_FLOATS * 256),
  T: null,
  m: null,
  C: null,
  X: null,
  R: null,
  /* one quad, as the effects pass's quad() takes it, and the up axis it would have set */
  put(fr, x, y, z, sw, sh, a, col, up) {
    if ((this.n + 1) * WEATHER_FLOATS > this.d.length) {
      const d = new Float32Array(this.d.length * 2);
      d.set(this.d);
      this.d = d;
    }
    const d = this.d,
      o = this.n++ * WEATHER_FLOATS,
      m = this.m,
      w = this.T.w;
    d[o] = x;
    d[o + 1] = y + worldCurveDrop(x, z);
    d[o + 2] = z;
    d[o + 3] = sw;
    d[o + 4] = sh;
    d[o + 5] = ((fr % m[2]) * m[0]) / w;
    d[o + 6] = 0;
    d[o + 7] = m[0] / w;
    d[o + 8] = 1;
    d[o + 9] = col ? col[0] : 1;
    d[o + 10] = col ? col[1] : 1;
    d[o + 11] = col ? col[2] : 1;
    d[o + 12] = a;
    d[o + 13] = up[0];
    d[o + 14] = up[1];
    d[o + 15] = up[2];
  },
  /* the quads put so far in one instanced draw; the fx program is in use again after */
  flush() {
    const n = this.n;
    this.n = 0;
    if (!n) return;
    const gl = gpuState.gl;
    ensurePrograms(WEATHER_FX_SHADERS);
    const p = useWalkProgram('fxW', this.C, this.X);
    if (!p.wx) {
      /* made with the program, so a new context (initWebgl empties gpuState.P) makes them again */
      const vao = gpuVao('instances'),
        buf = gpuBuffer('instances'),
        S = WEATHER_FLOATS * 4;
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, gpuState.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      [
        [1, 3, 0],
        [2, 2, 3],
        [3, 4, 5],
        [4, 4, 9],
        [5, 3, 13],
      ].forEach(([l, k, o]) => {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, k, gl.FLOAT, false, S, o * 4);
        gl.vertexAttribDivisor(l, 1);
      });
      gl.bindVertexArray(null);
      p.wx = { vao, buf };
    }
    gl.uniform3fv(p.U.uRight, this.R);
    gl.uniform1i(p.U.uTex, 0);
    gl.uniform1f(p.U.uLitFx, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.T.t);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.wx.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.d.subarray(0, n * WEATHER_FLOATS), gl.DYNAMIC_DRAW);
    gpuSized(p.wx.buf, n * WEATHER_FLOATS * 4);
    gl.bindVertexArray(p.wx.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.useProgram(gpuState.P.fx.p);
    bindQuad();
  },
};
export function effectsPass(C, items, X, dark, t, dt) {
  const gl = gpuState.gl,
    p = useWalkProgram('fx', C, X),
    U = p.U,
    sc = walkView.sc,
    C0 = walkData().sc,
    rm = reducedMotion ? 0 : 1,
    R = C.right,
    Up = [0, 1, 0],
    lb = engineSetting('lights', 'brightness'),
    gk = engineSetting('lights', 'glow'),
    winDay = engineSetting('lights', 'windowsDay'),
    flick = engineSetting('lights', 'flicker');
  bindQuad();
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
  gl.uniform1i(U.uTex, 0);
  gl.uniform1f(U.uLitFx, 1);
  gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.enable(gl.DEPTH_TEST);
  const fxT = k => imageTexture(artImage(`scene/fx/${k}.png`), { noNormal: true }),
    quad = (k, fr, x, y, z, sw, sh, a, col) => {
      const T = fxT(k);
      if (!T) return;
      const m = EFFECT_FRAMES[k];
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.uniform3f(U.uP, x, y + worldCurveDrop(x, z), z);
      gl.uniform2f(U.uS, sw, sh);
      gl.uniform4f(U.uUV, ((fr % m[2]) * m[0]) / T.w, 0, m[0] / T.w, 1);
      gl.uniform4f(U.uCol, col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1, a);
      gl.uniform1f(U.uGlow, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
  /* phase 20 R2: the weather's batch of picture k (null until its picture is loaded) */
  quad.batch = k => {
    const T = fxT(k);
    if (!T) return null;
    const B = weatherBatch;
    B.n = 0;
    B.T = T;
    B.m = EFFECT_FRAMES[k];
    B.C = C;
    B.X = X;
    B.R = R;
    return B;
  };
  const glows = [];
  walkRenderer.fires = [];
  const RR = sc.roomRect,
    dOut =
      RR && typeof environment !== 'undefined' && engineContext.env
        ? environment.lampK || 0
        : 0; /* v46: lamps and windows outside a room laid into the place keep the outdoor hour */
  for (const it of items) {
    /* 0.1.0 alpha: not for props outside the view (cullItems; a fountain alone is 150-250 draws) */
    if (it.k !== 'prop' || it.far || it.layer || it.vis === false) continue;
    const s = it.mpp,
      chim = it.bld3 && typeof chimneySmoke === 'function' ? chimneySmoke(it) : null,
      out = !!RR && (it.x < RR[0] || it.x > RR[0] + RR[2] || it.z < RR[1] || it.z > RR[1] + RR[3]),
      dIt = out ? (dOut > 0.4 ? dOut : 0) : dark;
    /* phase 09 batch 9: a turned prop's chimneys and lamps sit along its turned front, not the camera's way */
    const ta = placedTurn(it.p),
      r0 = ta ? Math.cos(ta) : R[0],
      r2 = ta ? Math.sin(ta) : R[2];
    (it.M.fx || []).forEach((e, i) => {
      const dark = dIt;
      const cs = chim && e.k === 'smoke',
        x = cs ? chim[0] : it.x + r0 * e.x * s * it.flip - (ta ? r2 * (e.z || 0) : 0),
        z = cs ? chim[2] : it.z + r2 * e.x * s * it.flip + (e.z || 0) * (ta ? r0 : 1),
        y = cs ? chim[1] : it.y - e.y * s,
        sd = it.x * 13.1 + it.z * 7.7 + i,
        fl = 1 - flick * 0.2 + flick * 0.2 * Math.sin(t / 170 + sd * 3) * Math.sin(t / 97 + sd);
      if (e.k === 'smoke')
        for (let n = 0; n < 5; n++) {
          const ph = ((t * rm) / 3200 + n / 5 + sd * 0.13) % 1,
            sz = 0.35 + 0.8 * ph;
          quad(
            'smoke',
            Math.floor(ph * 4),
            x + (ph * 0.9 + 0.15 * Math.sin(ph * 6 + n + sd)) * (sc.wind || 1),
            y + ph * 2.4,
            z + ph * 0.3,
            sz,
            sz,
            0.55 * (1 - ph) * Math.min(1, ph * 6)
          );
        }
      else if (e.k === 'spray') {
        if (walkRenderer.basinP && walkRenderer.basinP.has(it.p)) return;
        for (let n = 0; n < 14; n++) {
          const ph = ((t * rm) / 1100 + n / 14) % 1,
            an = n * 2.4 + sd,
            r = ph * 0.75;
          quad(
            'spray',
            n % 4,
            x + Math.cos(an) * r,
            y + 4 * 1.05 * ph * (1 - ph) - ph * 0.15,
            z + Math.sin(an) * r * 0.5,
            0.12,
            0.12,
            (1 - ph) * 0.9
          );
        }
      } else if (e.k === 'sparkle') {
        for (let n = 0; n < 3; n++) {
          const ph = ((t * rm) / 1400 + n / 3 + sd * 0.31) % 1;
          quad(
            'sparkle',
            Math.floor(ph * 4),
            x + Math.sin(n * 2.1 + sd) * 0.4,
            y - Math.cos(n * 1.7 + sd) * 0.3,
            z,
            0.3,
            0.3,
            Math.sin(ph * Math.PI)
          );
        }
      } else if (e.k === 'fire') {
        for (let n = 0; n < 7; n++) {
          const ph = ((t * rm) / 800 + n / 7 + sd * 0.2) % 1;
          glows.push([
            x + Math.sin(n * 2.7 + t / 300 + sd) * 0.2,
            y + ph * 1.5,
            z,
            0.06,
            [1, 0.85, 0.45],
            (1 - ph) * 3,
          ]);
        }
        glows.push([x, y + 0.15, z, 0.42 * gk, [1, 0.62, 0.25], (1.6 + dark) * fl * lb]);
        /* alpha 0.4: the flames themselves, a few hand-drawn frames looped with a little variation (two tongues, out of step),
      and the fire's place for the shimmer above it */
        const sz = Math.max(0.5, s * 34 * 0.024) * (e.s || 1);
        for (let n = 0; n < 2; n++) {
          const fr = Math.floor((t * rm) / (105 + n * 23) + sd * 3 + n * 2) % 4,
            w = (n ? 0.3 : 0.42) * sz * (1 + 0.08 * Math.sin(t / 180 + n + sd));
          quad(
            'flame',
            fr,
            x + (n ? 0.12 : -0.05) * sz,
            y + (n ? 0.18 : 0.26) * sz,
            z - 0.03,
            w,
            w * 1.5,
            1,
            [1.35, 1.2, 1.05]
          );
        }
        (walkRenderer.fires || (walkRenderer.fires = [])).push([x, y + 0.8 * sz, z, sz]);
      } else if (e.k === 'window') {
        if (it.bld3 && !(sc.room && !out) && buildingState.mesh.get(it.p)) return;
        /* a low-poly building's glass lights itself (prop-models.js glassLit): a disc here floated in front of it */
        if (it.wins) return;
        const RS = sc.room && !out ? roomSkyLight() : null;
        let k = RS ? RS.I * (1 - RS.night) * 0.9 * windowLightShare(sc) : dark ? 1 : winDay;
        if (
          !RS &&
          typeof environmentWindowLit === 'function' &&
          typeof environment !== 'undefined' &&
          engineContext.env &&
          !environmentWindowLit(x, z, environment.tod)
        )
          k *= 0.05;
        /* v47: lit one at a time */ if (k > 0.02)
          glows.push([x, y, z - 0.06, 0.32 * gk, [1, 0.82, 0.5], (0.6 + dark * 1.8) * k * fl * lb]);
      }
      /* several lamps on one prop share their light, so a four-lamp lantern isn't four times as bright */
      else if (e.k === 'glow') {
        const on = lampLit(it.x, it.z, dark),
          k = on + (1 - on) * 0.1,
          nG = it.M.fx.filter(f => f.k === 'glow').length,
          share = Math.min(1, 2.2 / nG);
        if (k > 0.02)
          glows.push([
            x,
            y,
            z - 0.06,
            (nG > 2 ? 0.26 : 0.34) * gk,
            [1, 0.9, 0.62],
            (0.5 + 0.8 * on) * share * k * fl * lb * (it.M.glowK ?? 1),
          ]);
      } else if (e.k === 'fireflies') {
        /* HB-10b: n fireflies drifting within r metres of the point after dusk, each blinking on its own slow beat;
        none by day. Reduced motion holds them still (they still blink, more slowly) */
        const on = lampLit(it.x, it.z, dark);
        if (on > 0.02)
          for (let n = 0, N = e.n || 6, r = e.r || 2; n < N; n++) {
            const q = sd * 0.7 + n * 2.39,
              w = (t * (rm || 0.3)) / 1000,
              ph = (w / (3.1 + (n % 3) * 0.7) + n / N) % 1,
              blink = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 2,
              d = r * (0.35 + ((0.65 * (((n * 0.618) % 1) + 0.15 * Math.sin(rm * w * 0.31 + q))) % 1)),
              a = q + rm * w * (0.12 + (n % 4) * 0.03) * (n % 2 ? 1 : -1);
            if (blink > 0.03)
              glows.push([
                x + Math.cos(a) * d,
                y + 0.5 + 0.6 * ((n * 0.37) % 1) + rm * 0.15 * Math.sin(w * 0.9 + q),
                z + Math.sin(a) * d,
                0.11 * gk,
                [0.78, 1, 0.42],
                (0.4 + 1.6 * blink) * on * lb,
              ]);
          }
      }
    });
    /* alpha 0.4: a 3D building's front windows glow when its window shader lights them (the same seed), not by a second guess */
    if (it.bld3 && !(sc.room && !out)) {
      const E = buildingState.mesh.get(it.p);
      if (E && E.fw) {
        const lf = litWindowFraction(),
          k = dIt ? 1 : winDay,
          fl = 1 - flick * 0.1 + flick * 0.1 * Math.sin(t / 230 + it.x);
        if (k > 0.02)
          for (const f of E.fw) {
            const w = frontWindowLight(f[3], lf);
            if (w)
              glows.push([
                f[0] + E.fn[0] * 0.06,
                f[1],
                f[2] + E.fn[1] * 0.06,
                0.5 * gk,
                w.c.map(v => v * 0.8),
                (0.2 + (dIt ? 1 : 0) * 0.45) * k * w.k * fl * lb,
              ]);
          }
      }
    }
    if (it.M.glow) {
      const g = it.M.glow,
        c = hexToRgb(g.c).map(v => v / 255),
        on = lampLit(it.x, it.z, dIt);
      /* v47: "day" sets how much of it shows by day (a neon sign's halo hardly does) */ glows.push([
        it.x,
        it.y + g.y,
        it.z - 0.08,
        0.4 * gk,
        c,
        (on * 1.6 + (1 - on) * (g.day ?? 0.3)) * lb,
      ]);
    }
  }
  /* Particles is how many: at 1 six butterflies, seven falling leaves, five bees a hive, fourteen fireflies (it was
     only on or off: any value above 0 drew them all) */
  const pk = engineSetting('air', 'particles');
  if (!sc.indoor && pk > 0) {
    if (!walkView.life || walkView.life.id !== walkView.id) {
      const fl = [],
        tr = [];
      for (const p of sc.props || []) {
        const M = C0.props[p.k];
        if (!M) continue;
        const g = M.group || p.k;
        if (/flower/.test(g) || /flower/.test(p.k)) fl.push(p);
        if (/tree_(oak|fruit|birch)|^tree$/.test(g) || p.k === 'tree_oak_autumn') tr.push(p);
      }
      walkView.life = {
        id: walkView.id,
        fl: fl.filter((_, i) => i % 2 === 0).slice(0, 12),
        tr: tr.filter((_, i) => i % 2 === 0).slice(0, 14),
      };
    }
    walkView.life.fl.slice(0, Math.round(6 * pk)).forEach((p, i) => {
      const bx = p.x + Math.sin((t * rm) / 1500 + i * 1.7) * 1.1 + Math.sin((t * rm) / 610 + i) * 0.25,
        bz = p.z + Math.cos((t * rm) / 1900 + i * 2) * 0.7;
      quad(
        'butterfly',
        Math.floor((t * rm) / 110 + i) % 2,
        bx,
        standingHeightAt(bx, bz) + 0.55 + 0.35 * Math.sin((t * rm) / 480 + i * 3),
        bz,
        0.3,
        0.26,
        1
      );
    });
    walkView.life.tr.slice(0, Math.round(7 * pk)).forEach((p, i) => {
      const M = C0.props[p.k],
        per = 6500 + i * 700,
        ph = ((t * rm) / per + i * 0.37) % 1,
        top = M ? Math.min(4, (-M.oy / 34) * (p.s || 1) * 0.75) : 3,
        bx = p.x + Math.sin(ph * 9 + i) * 0.55 + ph * (0.6 + windGustAt(p.x, p.z, t * rm) * 0.5) * (sc.wind || 1),
        bz = p.z - 0.4 - ph * 0.6;
      quad(
        'leaf',
        Math.floor((t * rm) / 220 + i) % 3,
        bx,
        standingHeightAt(bx, bz) + top * (1 - ph),
        bz,
        0.18,
        0.18,
        Math.min(1, (1 - ph) * 4) * Math.min(1, ph * 8)
      );
    });
    drawLifeEffects(quad, glows, t, rm, dt, sc, C0, pk);
  }
  /* v18: spray and mist where water falls over a step. Water track WA-2a: with pixel water they stand on the 32 grid
     and move in its steps (water.frames); the mist sits out from the step, so the cliff no longer cuts it in half */
  const pixW = engineSetting('water', 'pixel') !== false,
    fps = pixW ? (engineSetting('water', 'frames') ?? 10) : 0,
    tq = fps > 0 ? Math.floor((t * rm * fps) / 1000) * (1000 / fps) : t * rm,
    g32 = v => (pixW ? Math.round(v * 32) / 32 : v);
  if (walkRenderer.falls && walkRenderer.falls.length) {
    const F = walkRenderer.falls,
      stp = Math.max(1, Math.ceil(F.length / 40));
    for (let k = 0; k < F.length; k += stp) {
      const [x, y, z, dh, di = 0, dj = 0] = F[k],
        sd = k * 1.37,
        big = Math.min(1.6, 0.5 + dh * 0.4);
      for (let n = 0; n < 6; n++) {
        const ph = (tq / 900 + n / 6 + sd * 0.17) % 1,
          an = n * 2.3 + sd,
          r = ph * 0.6 * big;
        quad(
          'spray',
          n % 4,
          g32(x + Math.cos(an) * r),
          g32(y + 0.05 + 2.2 * big * ph * (1 - ph)),
          g32(z + Math.sin(an) * r * 0.5),
          0.13,
          0.13,
          (1 - ph) * 0.85
        );
      }
      if (k % (2 * stp) === 0) {
        const ph = (tq / 2600 + sd * 0.3) % 1,
          sz = 0.4 + ph * big * 0.7;
        quad(
          'smoke',
          Math.floor(ph * 4),
          g32(x + Math.sin(ph * 5 + sd) * 0.3 + di * sz * 0.5),
          g32(y + 0.15 + ph * 0.9 * big),
          g32(z + 0.1 + dj * sz * 0.5),
          sz,
          sz,
          0.22 * (1 - ph) * Math.min(1, ph * 5),
          [0.92, 0.97, 1]
        );
      }
    }
  }
  /* WA-2a: a falls entry: spray thrown up and out along its width at the foot, droplets off the curled lip, and mist
     that rises from the plunge pool and drifts with the wind, the taller the fall the more */
  for (const f of walkRenderer.fallSets || []) {
    const px = -f.dz,
      pz = f.dx,
      fy = f.footY,
      nS = clamp(Math.ceil(f.w * 5), 6, 24),
      up = Math.min(2.2, 0.6 + f.h * 0.18),
      sd = f.x * 3.1 + f.z * 1.7;
    for (let n = 0; n < nS; n++) {
      const ph = (tq / 1000 + n / nS + Math.sin(n * 7.3) * 0.37 + 1) % 1,
        a = ((n + 0.5) / nS - 0.5) * f.w,
        out = (0.2 + 0.6 * ((n * 0.618) % 1)) * ph * up;
      quad(
        'spray',
        n % 4,
        g32(f.fx + px * a * (1 + ph * 0.3) + f.dx * out),
        g32(fy + 0.05 + up * 1.6 * ph * (1 - ph)),
        g32(f.fz + pz * a * (1 + ph * 0.3) + f.dz * out),
        0.13,
        0.13,
        (1 - ph) * 0.9,
        [0.93, 0.97, 1]
      );
    }
    for (let n = 0; n < Math.min(6, nS / 3); n++) {
      const ph = (tq / 700 + n / 6 + sd) % 1,
        a = (((n * 0.618 + sd) % 1) - 0.5) * f.w * 0.9;
      quad(
        'spray',
        (n + 1) % 4,
        g32(f.x + px * a + f.dx * (f.curl + ph * 0.35)),
        g32(f.lipY - ph * ph * 1.2),
        g32(f.z + pz * a + f.dz * (f.curl + ph * 0.35)),
        0.1,
        0.1,
        (1 - ph) * 0.7
      );
    }
    const nM = clamp(Math.round(2 + f.h * 0.5 + f.w * 0.4), 3, 8),
      wind = sc.wind || 1;
    for (let n = 0; n < nM; n++) {
      const ph = (tq / (3200 + f.h * 150) + n / nM + sd * 0.11) % 1,
        a = (((n * 0.618 + sd * 0.3) % 1) - 0.5) * f.w,
        sz = 0.6 + f.w * 0.35 + ph * (0.8 + f.h * 0.2),
        drift = ph * (0.4 + 0.5 * wind);
      quad(
        'smoke',
        Math.floor(ph * 4),
        g32(f.fx + px * (a + Math.sin(ph * 4 + n) * 0.3) + f.dx * (sz * 0.45 + drift)),
        g32(fy + 0.2 + ph * Math.min(f.h * 0.55, 4)),
        g32(f.fz + pz * (a + Math.sin(ph * 4 + n) * 0.3) + f.dz * (sz * 0.45 + drift)),
        sz,
        sz,
        (0.28 + Math.min(0.14, f.h * 0.02)) * (1 - ph) * Math.min(1, ph * 4),
        [0.92, 0.97, 1]
      );
    }
  }
  /* v22: leaves riding the streams (lying flat on the water), and steam breathing off warm springs (WA-5b: a hot spring's
     thicker, three puffs a cell) */
  if (
    walkRenderer.streamCells &&
    walkRenderer.streamCells.length &&
    engineSetting('water', 'leaves') &&
    !walkRenderer.bt
  ) {
    const S = walkRenderer.streamCells,
      n = Math.min(10, Math.ceil(S.length / 12));
    if (!walkRenderer.leaves || walkRenderer.leaves.length !== n)
      walkRenderer.leaves = Array.from({ length: n }, (_, i) => ({ age: 99, i }));
    gl.uniform3f(U.uUp, 0, 0, 1);
    for (const L of walkRenderer.leaves) {
      if (L.age > 16 || !L.ok) {
        const c = S[Math.floor(Math.random() * S.length)];
        Object.assign(L, {
          x: c[0] + Math.random() * 0.4 - 0.2,
          z: c[1] + Math.random() * 0.4 - 0.2,
          age: 0,
          fr: L.i % 3,
          sp: 0.6 + Math.random() * 0.5,
          ok: true,
        });
      }
      const f = walkRenderer.flowAt(L.x, L.z);
      L.age += dt;
      if (!rm) {
        L.x += (f[0] * L.sp + Math.sin(L.age * 1.3 + L.i) * 0.05) * dt;
        L.z += (f[1] * L.sp + Math.cos(L.age * 1.1 + L.i) * 0.05) * dt;
      }
      const g = waterAt(L.x, L.z);
      if (!g || (!WATER_KIND_LOOKS[g.kind].run && L.age > 2)) {
        L.ok = false;
        continue;
      }
      const a = Math.min(1, L.age * 2) * Math.min(1, (16 - L.age) / 2);
      gl.uniform3f(U.uRight, Math.cos(L.age * 0.4 + L.i), 0, Math.sin(L.age * 0.4 + L.i) * 0.6);
      quad('leaf', L.fr, L.x, g.y + 0.04, L.z, 0.17, 0.17, a);
    }
    gl.uniform3fv(U.uRight, R);
    gl.uniform3fv(U.uUp, Up);
  }
  if (walkRenderer.springCells && walkRenderer.springCells.length && engineSetting('water', 'steam')) {
    walkRenderer.springCells.forEach(([x, z, dp, st], k) => {
      const g = waterAt(x, z),
        y = g ? g.y : standingHeightAt(x, z);
      for (let n = 0; n < (st > 1 ? 3 : 2); n++) {
        const ph = (tq / 5200 + n / (st > 1 ? 3 : 2) + k * 0.37) % 1,
          sz = 0.5 + ph * 1.3;
        quad(
          'smoke',
          Math.floor(ph * 4),
          g32(x + Math.sin(ph * 4 + k) * 0.35 * (sc.wind || 1)),
          g32(y + 0.05 + ph * 1.6),
          g32(z + 0.1),
          sz,
          sz,
          0.16 * (1 - ph) * Math.min(1, ph * 4) * (0.6 + dp * 0.4) * (st > 1 ? 1.5 : 1),
          [0.94, 0.97, 1]
        );
      }
    });
  }
  drawDivers(quad, dt, rm, sc, g32, fps);
  drawClimbSpray(quad, tq, g32);
  if (engineContext.env && !sc.indoor && engineSetting('air', 'weather') > 0)
    drawWeather(quad, glows, U, R, Up, dt, rm);
  if (!walkRenderer.bt) drawFootprints(quad, U, R, Up, dt);
  drawFountainEffects(quad, t, rm, dt);
  drawRoomEffects(C, U, items, glows, t, rm);
  gl.uniform3fv(U.uRight, R);
  gl.uniform3fv(U.uUp, Up);
  if (typeof clueDraw === 'function') clueDraw(quad, glows, t);
  if (typeof worldBillyGlows === 'function' && !walkRenderer.bt) worldBillyGlows(glows, dt);
  if (!walkRenderer.bt && walkRenderer.encPos)
    walkRenderer.encPos.forEach(([x, z, id], k) => {
      const ph = (t / 1000 + k * 1.7) % 6;
      if (ph > 1.1) return;
      const a = Math.sin((ph / 1.1) * Math.PI),
        y = standingHeightAt(x, z) + 0.38,
        ex = R[0] * 0.07,
        ez = R[2] * 0.07,
        c = [1, 0.95, 0.62];
      glows.push([x - ex, y, z - ez - 0.15, 0.035, c, 1.6 * a]);
      glows.push([x + ex, y, z + ez - 0.15, 0.035, c, 1.6 * a]);
    });
  if (walkRenderer.splash && walkRenderer.splash.length) {
    for (let i = walkRenderer.splash.length - 1; i >= 0; i--) {
      const q = walkRenderer.splash[i];
      q.a += dt;
      if (q.a > 0.7) {
        walkRenderer.splash.splice(i, 1);
        continue;
      }
      /* WA-5b: on the 32 grid in water.frames steps with pixel water */
      const qa = fps > 0 ? Math.floor(q.a * fps) / fps : q.a;
      for (let n = 0; n < 8; n++) {
        const an = n * 0.785,
          r = qa * 0.9,
          h = qa * (2.6 - qa * 3.4);
        quad(
          'spray',
          n % 4,
          g32(q.x + Math.cos(an) * r),
          g32(q.y + 0.05 + Math.max(0, h)),
          g32(q.z + Math.sin(an) * r * 0.6),
          0.1,
          0.1,
          (1 - qa / 0.7) * 0.85,
          [0.9, 0.96, 1]
        );
      }
      /* v47: and the fish itself, arcing out and back in (WA-5b: not after a diving bird's splash) */ if (
        qa < 0.62 &&
        !q.bird
      ) {
        const k = qa / 0.62,
          dir = q.dir || (q.dir = Math.random() < 0.5 ? -1 : 1);
        quad(
          'fish',
          k < 0.35 || k > 0.7 ? 0 : 1,
          q.x + dir * (k - 0.5) * 0.7,
          q.y + 0.08 + Math.sin(k * Math.PI) * 0.55,
          q.z - 0.05,
          0.3,
          0.17,
          1
        );
      }
    }
  }
  const PS = walkView.parts;
  for (let i = PS.length - 1; i >= 0; i--) {
    const q = PS[i];
    q.life += dt;
    if (q.life >= q.max) {
      PS.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.z += q.vz * dt;
    q.vy -= q.g * dt;
    q.y = Math.max(0, q.y + q.vy * dt);
    const a = 1 - q.life / q.max,
      gy = standingHeightAt(q.x, q.z);
    if (q.k === 'leaf') quad('leaf', q.fr, q.x, gy + q.y, q.z, 0.16, 0.16, a);
    /* WA-2a: a wading step's splash: droplets as the spray's, not the dust's puff */ else if (q.k === 'splash')
      quad('spray', (i + Math.floor(q.life * 12)) % 4, q.x, gy + q.y + 0.05, q.z, 0.09, 0.09, a * 0.9, [0.9, 0.96, 1]);
    else
      quad('smoke', 1, q.x, gy + q.y + 0.1, q.z, 0.25 + q.life * 0.6, 0.25 + q.life * 0.6, a * 0.35, [0.95, 0.9, 0.8]);
  }
  /* bright cores, added in HDR: the bloom spreads them into soft glows */
  /* battle move effects as sprites in the world: hidden behind things, blurred by depth, glowing ones bloom */
  const BP = walkRenderer.bt && walkRenderer.bt.parts;
  if (BP && BP.length) {
    gl.uniform1f(U.uLitFx, 0);
    gl.uniform1f(U.uGlow, 0);
    gl.uniform4f(U.uUV, 0, 0, 1, 1);
    for (const pass of [0, 1]) {
      if (pass) gl.blendFunc(gl.ONE, gl.ONE);
      for (const q of BP) {
        if (!!q.glow !== !!pass) continue;
        const T = imageTexture(q.im, { noNormal: true });
        if (!T) continue;
        gl.bindTexture(gl.TEXTURE_2D, T.t);
        gl.uniform3f(U.uP, q.x, q.y + worldCurveDrop(q.x, q.z), q.z);
        gl.uniform2f(U.uS, q.w, q.h);
        const k = pass ? 1.6 : 1;
        gl.uniform4f(U.uCol, k, k, k, q.a);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.uniform1f(U.uGlow, 1);
  gl.uniform1f(U.uLitFx, 0);
  /* alpha 0.4: the whole disc (the last flame or smoke quad left its frame's strip here, which cut each halo down to an off-centre square) */ gl.uniform4f(
    U.uUV,
    0,
    0,
    1,
    1
  );
  for (const [x, y, z, r, c, a] of glows) {
    if (a <= 0.01) continue;
    gl.uniform3f(U.uP, x, y + worldCurveDrop(x, z), z);
    gl.uniform2f(U.uS, r * 2, r * 2);
    gl.uniform4f(U.uCol, c[0], c[1], c[2], a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  /* phase 20 R2 (D7): cheap light shafts while the light in the air (the vol pass) is off */
  const sk = engineSetting('air', 'cheapShafts') || 0;
  if (sk > 0.01 && !sc.indoor && !volumeAirOn(X)) {
    const smart = !!engineSetting('air', 'shaftPick'),
      S = smart ? smartLightShafts(items, C, walkRenderer.sun, sk, dt) : lightShafts(items, C, walkRenderer.sun, sk);
    if (smart) gl.uniform1f(U.uGlow, 2);
    for (const h of S) {
      gl.uniform3fv(U.uRight, h.right);
      gl.uniform3fv(U.uUp, h.up);
      gl.uniform3f(U.uP, h.p[0], h.p[1] + worldCurveDrop(h.p[0], h.p[2]), h.p[2]);
      gl.uniform2f(U.uS, h.w, h.len);
      gl.uniform4f(U.uCol, h.col[0], h.col[1], h.col[2], h.a);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (S.length) {
      gl.uniform3fv(U.uRight, R);
      gl.uniform3fv(U.uUp, Up);
    }
    if (smart) gl.uniform1f(U.uGlow, 1);
  } else smartShafts.fade.clear();
  gl.uniform1f(U.uGlow, 0);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
/* water track WA-5b: birds that dive. Now and then by day one circles high over water deep enough for fish near you (a
   fish's home), folds and dives in with a splash, stays under a moment and flies off low; with pixel water on the 32
   grid in water.frames steps. The fx sheet's bird (two frames; unused before). One at a time, none indoors, at night
   or in a storm */
function drawDivers(quad, dt, rm, sc, g32, fps) {
  const D = (walkRenderer.divers = walkRenderer.divers || []),
    P = walkView.pl,
    hr = environment.tod ?? 12;
  if (sc.indoor || !P) return void (D.length = 0);
  if (
    rm &&
    !walkRenderer.bt &&
    !D.length &&
    hr > 6.5 &&
    hr < 19.5 &&
    !((environment.storm || 0) > 0.5) &&
    Math.random() < dt * 0.035
  ) {
    const H = (walkRenderer.fishHomes || []).filter(h => Math.hypot(h[0] - P.x, h[1] - P.z) < 14);
    if (H.length) {
      const h = H[Math.floor(Math.random() * H.length)];
      D.push({ x: h[0], z: h[1], y: h[2], a: 0, an: Math.random() * 6.283, dir: Math.random() < 0.5 ? -1 : 1 });
    }
  }
  const C = 5,
    R = 2.2;
  for (let i = D.length - 1; i >= 0; i--) {
    const b = D[i];
    b.a += dt;
    const k = fps > 0 ? Math.floor(b.a * fps) / fps : b.a,
      an = b.an + Math.min(k, C) * 0.9 * b.dir,
      cx = b.x + Math.cos(an) * R,
      cz = b.z + Math.sin(an) * R * 0.7;
    let x,
      y,
      z,
      fr = 1,
      al = 1;
    if (k < C) {
      x = cx;
      z = cz;
      y = b.y + 5.5 + Math.sin(k * 1.3) * 0.3;
      fr = Math.floor(k * 6) % 2;
      al = Math.min(1, k * 2);
    } else if (k < C + 0.55) {
      const f = (k - C) / 0.55;
      x = cx + (b.x - cx) * f;
      z = cz + (b.z - cz) * f;
      y = b.y + 5.5 * (1 - f * f);
    } else if (k < C + 1.1) {
      if (!b.sp) {
        b.sp = 1;
        (walkRenderer.splash = walkRenderer.splash || []).push({ x: b.x, z: b.z, y: b.y, a: 0, bird: 1 });
        addRipple(b.x, b.z, 1);
        if (typeof soundEffectAt === 'function') soundEffectAt('plop', b.x, b.z);
      }
      continue;
    } else if (k < C + 4) {
      const f = (k - C - 1.1) / 2.9;
      x = b.x + b.dir * f * 6;
      z = b.z + f * 3;
      y = b.y + 0.1 + f * f * 6;
      fr = Math.floor(k * 8) % 2;
      al = Math.min(1, (1 - f) * 5);
    } else {
      D.splice(i, 1);
      continue;
    }
    quad('bird', fr, g32(x), g32(y), g32(z), 0.46, 0.28, al, [0.92, 0.94, 0.98]);
  }
}
/* water track WA-5b: spray on you while you climb a waterfall on your mount (walk-view.js startFallClimb: P.climb.fall),
   droplets bursting round you and falling back, in water.frames steps on the 32 grid */
function drawClimbSpray(quad, tq, g32) {
  const P = walkView.pl,
    C = P && P.climb;
  if (!C || !C.fall || reducedMotion) return;
  const y = P.yv ?? standingHeightAt(P.x, P.z);
  for (let n = 0; n < 10; n++) {
    const ph = (tq / 650 + n / 10) % 1,
      an = n * 2.4 + Math.floor(tq / 650 + n / 10) * 1.7,
      r = 0.25 + ph * 0.45;
    quad(
      'spray',
      n % 4,
      g32(P.x + Math.cos(an) * r),
      g32(y + 0.5 + 1.4 * ph * (1 - ph) - ph * 0.4),
      g32(P.z - 0.15 + Math.sin(an) * r * 0.4),
      0.11,
      0.11,
      (1 - ph) * 0.8,
      [0.92, 0.97, 1]
    );
  }
}
/* whether the post chain's light in the air will draw the sun's beams this frame (engine/post-effects.js: off at
   quality step 3, with god rays at 0, or with no shadow map) */
function volumeAirOn(X) {
  return (walkRenderer.qe || 0) < 3 && (engineSetting('air', 'godRays') ?? 0.6) > 0.01 && !!(X && X.shadow);
}
/* phase 20 R2 (D7): a few soft beams of sunlight, each one additive quad (the glow disc stretched), from a tree's
   crown down along the sun's light, turned about its own line to face the camera. Placed at about half the trees
   whose leaf pictures stand within 26 m of you (by a hash of the tree's place, so the same trees every frame), plus
   a place's own list (scene `shafts`: [x, z, top above the ground (6 m), width (1.2 m)]). Strongest with the sun low
   (dawn, golden hour), fading as it climbs, at night, in grey weather and close to the camera. */
const SHAFT_MAX = 6,
  SHAFT_RANGE = 26;
const shaftList = [];
/* how strong the shafts are now: strongest with the sun low (dawn, golden hour), fading as it climbs, at night, in
   grey weather and in rain */
function shaftStrength(sun, k) {
  const E = typeof environment !== 'undefined' && engineContext.env ? environment : null,
    e = sun.dir[1];
  return (
    k *
    clamp((e - 0.03) / 0.12, 0, 1) *
    (1 - clamp((e - 0.4) / 0.35, 0, 1)) *
    (E ? (1 - E.night) * (1 - E.grey * 0.85) * (1 - Math.min(1, E.rain)) : 1)
  );
}
function lightShafts(items, C, sun, k) {
  shaftList.length = 0;
  if (!sun || !C.eye) return shaftList;
  const tk = shaftStrength(sun, k);
  if (tk < 0.01) return shaftList;
  const P = walkRenderer.bt ? { x: walkRenderer.bt.center[0], z: walkRenderer.bt.center[1] } : walkView.pl,
    byTree = new Map(),
    cand = [];
  /* candidates [distance, x, z, crown's y (a tree) or top above the ground (the list), width, a tree]; a tree's crown is
     the highest of its leaf pictures (their y is where each stands) */
  for (const it of items) {
    if (!it.voxImg || !it.layer || it.vis === false) continue;
    const c = byTree.get(it.p);
    if (c) {
      c[3] = Math.max(c[3], it.y);
      continue;
    }
    const d = Math.hypot(it.x - P.x, it.z - P.z),
      hs = Math.abs(Math.sin(Math.round(it.x * 10) * 12.9898 + Math.round(it.z * 10) * 78.233) * 43758.5453) % 1;
    const e = [d, it.x, it.z, it.y, 0, true];
    byTree.set(it.p, e);
    if (d <= SHAFT_RANGE && hs < 0.5) cand.push(e);
  }
  for (const f of walkView.sc.shafts || []) {
    const d = Math.hypot(f[0] - P.x, f[1] - P.z);
    if (d <= SHAFT_RANGE) cand.push([d, f[0], f[1], f[2] || 6, f[3] || 1.2, false]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  const t = sun.travel,
    up = [-t[0], -t[1], -t[2]];
  for (let i = 0; i < cand.length && shaftList.length < SHAFT_MAX; i++) {
    const c = cand[i],
      tree = c[5],
      x = c[1],
      z = c[2],
      g = standingHeightAt(x, z),
      top = tree ? Math.min(9, Math.max(3, c[3] - g)) : c[3],
      len = Math.min(14, top / Math.max(0.25, up[1])),
      d = c[0],
      /* the middle of the beam: from the crown halfway down along the light */
      cx = x + t[0] * len * 0.5,
      cy = g + top + t[1] * len * 0.5,
      cz = z + t[2] * len * 0.5,
      tx = C.eye[0] - cx,
      ty = C.eye[1] - cy,
      tz = C.eye[2] - cz,
      de = Math.hypot(tx, ty, tz);
    /* the beam's right: across its line, square to the way to the camera */
    let rx = up[1] * tz - up[2] * ty,
      ry = up[2] * tx - up[0] * tz,
      rz = up[0] * ty - up[1] * tx;
    const rl = Math.hypot(rx, ry, rz);
    if (rl < 1e-4) continue;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const a = tk * 0.22 * clamp((de - 3) / 5, 0, 1) * clamp((SHAFT_RANGE - d) / 6, 0, 1);
    if (a < 0.005) continue;
    shaftList.push({
      p: [cx, cy, cz],
      right: [rx, ry, rz],
      up,
      w: c[4] || 1.4,
      len,
      col: sun.col,
      a,
    });
  }
  return shaftList;
}
/* smart light shafts (Engine > Air "Smart light shafts"): the same beams, placed by logic/shaft-pick.js where they show
   best (shade behind them, looking into the light, apart, never over you) from the crowns near you, the gaps between
   them, the sides of the roofs and the place's own list. Picked again every 0.4 s; a picked beam fades in over about
   1.2 s and a dropped one fades out, so none pops. Fewer on a struggling device (the quality step), and together they
   may cover at most a quarter of the screen: an additive quad costs its pixels */
const SHAFT_PICK_MS = 400,
  SHAFT_FADE_S = 1.2;
const smartShafts = { t: -1e9, fade: new Map(), list: [] };
function smartLightShafts(items, C, sun, k, dt) {
  const L = smartShafts.list,
    F = smartShafts.fade;
  L.length = 0;
  if (!sun || !C.eye || !C.vp) return L;
  const tk = shaftStrength(sun, k),
    now = performance.now();
  if (tk < 0.01) {
    F.clear();
    return L;
  }
  if (now - smartShafts.t > SHAFT_PICK_MS) {
    smartShafts.t = now;
    const P = walkRenderer.bt ? { x: walkRenderer.bt.center[0], z: walkRenderer.bt.center[1] } : walkView.pl,
      qe = walkRenderer.qe || 0,
      max = qe >= 3 ? 3 : qe >= 1 ? 5 : 8,
      byTree = new Map(),
      cands = [],
      blockers = [];
    /* buildings: the old 3D ones and the low-poly models with windows (a house, the lab), 3.5 m wide or more */
    const houses = typeof buildingItems === 'function' ? buildingItems(items).slice() : [],
      houseOf = new Set(houses.map(it => it.p));
    for (const it of items)
      if (it.vox && it.wins && it.vis !== false && it.w * it.mpp >= 3.5 && !houseOf.has(it.p)) {
        houses.push(it);
        houseOf.add(it.p);
      }
    /* a tree's crown: the highest and widest of its leaf pictures (not a building's vines or flower boxes) */
    for (const it of items) {
      if (!it.voxImg || !it.layer || it.vis === false || houseOf.has(it.p)) continue;
      const top = it.y + it.h * it.mpp,
        r = (it.w * it.mpp) / 2,
        c = byTree.get(it.p);
      if (c) {
        c.top = Math.max(c.top, top);
        c.r = Math.max(c.r, r);
      } else if (Math.hypot(it.x - P.x, it.z - P.z) <= SHAFT_RANGE + 4)
        byTree.set(it.p, { key: `t:${Math.round(it.x * 10)},${Math.round(it.z * 10)}`, x: it.x, z: it.z, top, r });
    }
    const crowns = [...byTree.values()].filter(c => c.r >= 0.7);
    for (const c of crowns) {
      blockers.push({ x: c.x, z: c.z, y: c.top - c.r, r: c.r });
      cands.push({ key: c.key, x: c.x, z: c.z, top: c.top, w: Math.min(2.4, Math.max(0.8, c.r * 0.9)), kind: 'crown' });
    }
    for (const g of crownGaps(crowns)) cands.push(g);
    /* a building: light grazing past its two sides square to the sun, from its roof's height (its picture's size) */
    const sl = Math.hypot(sun.dir[0], sun.dir[2]) || 1,
      px = -sun.dir[2] / sl,
      pz = sun.dir[0] / sl;
    for (const it of houses) {
      const hw = (it.w * it.mpp) / 2,
        top = it.y + it.h * it.mpp * 0.8;
      if (Math.hypot(it.x - P.x, it.z - P.z) > SHAFT_RANGE + 6) continue;
      blockers.push({ x: it.x, z: it.z, y: it.y + it.h * it.mpp * 0.4, r: hw });
      for (const sd of [-1, 1])
        cands.push({
          key: `b:${Math.round(it.x * 10)},${Math.round(it.z * 10)},${sd}`,
          x: it.x + px * (hw + 0.6) * sd,
          z: it.z + pz * (hw + 0.6) * sd,
          top,
          w: 1.6,
          kind: 'roof',
        });
    }
    for (const f of walkView.sc.shafts || [])
      cands.push({
        key: `l:${f[0]},${f[1]}`,
        x: f[0],
        z: f[1],
        top: standingHeightAt(f[0], f[1]) + (f[2] || 6),
        w: f[3] || 1.2,
        kind: 'list',
      });
    const keep = new Set();
    for (const [key, f] of F) if (f.on) keep.add(key);
    const picks = pickShafts(cands, {
      eye: C.eye,
      vp: C.vp,
      sun: sun.dir,
      player: walkView.pl ? [walkView.pl.x, standingHeightAt(walkView.pl.x, walkView.pl.z), walkView.pl.z] : null,
      focus: [P.x, 0, P.z],
      ground: standingHeightAt,
      blockers,
      keep,
      max,
      range: SHAFT_RANGE,
    });
    for (const f of F.values()) f.on = false;
    for (const q of picks) {
      const f = F.get(q.key);
      if (f) Object.assign(f, { q, on: true });
      else F.set(q.key, { q, on: true, a: 0 });
    }
  }
  const t = sun.travel,
    up = [-t[0], -t[1], -t[2]];
  for (const [key, f] of F) {
    f.a = clamp(f.a + (f.on ? dt : -dt) / SHAFT_FADE_S, 0, 1);
    if (!f.on && f.a <= 0) {
      F.delete(key);
      continue;
    }
    const q = f.q,
      g = standingHeightAt(q.x, q.z),
      len = Math.min(14, q.top / Math.max(0.25, up[1])),
      cx = q.x + t[0] * len * 0.5,
      cy = g + q.top + t[1] * len * 0.5,
      cz = q.z + t[2] * len * 0.5,
      tx = C.eye[0] - cx,
      ty = C.eye[1] - cy,
      tz = C.eye[2] - cz,
      de = Math.hypot(tx, ty, tz);
    let rx = up[1] * tz - up[2] * ty,
      ry = up[2] * tx - up[0] * tz,
      rz = up[0] * ty - up[1] * tx;
    const rl = Math.hypot(rx, ry, rz);
    if (rl < 1e-4) continue;
    const a = tk * 0.55 * f.a * clamp((de - 3) / 5, 0, 1) * Math.min(1, 0.55 + q.score * 0.6);
    if (a < 0.005) continue;
    L.push({
      p: [cx, cy, cz],
      right: [rx / rl, ry / rl, rz / rl],
      up,
      w: q.w,
      len,
      col: sun.col,
      a,
    });
  }
  return L;
}
