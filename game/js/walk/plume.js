'use strict';
/* ================= ROCKET PLUMES (assets track AS-1) =================
   The sky train's jet fire on its ride (train-ride.js asks for it through its director frame's `plume`; the walk view
   draws it after the effects, walk-view-gl.js). Each nozzle of the train's model (its recipe's `nozzles`, written by
   tools/build-station-trains.py: [x, back, up, radius] in the model's metres, pointing back along -x) gets:
   - a cone along the nozzle and two crossed quads through it, set by the train's whole pose (its turn, size, mirror,
     bob and its tilt, so the fire stays on the nozzle when the nose climbs), bent down while it holds the train up;
   - a hot disc facing the camera at the nozzle, so the fire reads from straight behind too;
   - scrolling noise through a stepped ramp (white-blue core, yellow, orange, a deep red edge, then clear), quantised
     to 48 px a metre along and across the plume, its steps dithered in the plume's own pixels; its light added over
     a little cover (premultiplied, so it reads on a bright sky by day; the scene is HDR, so the core blooms), the same
     by day and by night;
   - shock diamonds in the core at full thrust.
   Smoke at lift-off and touch-down (stepped, dithered puffs, lit by the sky and the sun) and sparks are drawn here
   too, worked out from the ride's clock alone (no state), so a held moment of the pictures tool is always the same.
   On Beautiful the air behind the plume shimmers (a half-size copy of the scene read with a wobble); never on other
   presets or when the automatic quality has stepped down. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { mooredBob, reducedMotion, saveData } from '../hooks.js';
import { propTurn, spinPoint, turnedPoint } from '../logic/prop-turn.js';
import {
  LIGHT_GLSL,
  bindQuad,
  ensurePrograms,
  gpuBuffer,
  gpuFree,
  gpuSized,
  gpuState,
  gpuVao,
  renderTarget,
} from '../engine/webgl.js';
import { walkRenderer } from './walk-state.js';
import { useWalkProgram, worldCurveDrop } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  PLUME_COMMON: [() => PLUME_COMMON],
  PLUME_PX: [() => PLUME_PX],
  PLUME_SHADERS: [() => PLUME_SHADERS],
  PLUME_SIDES: [() => PLUME_SIDES],
  PLUME_T: [() => PLUME_T],
  PLUME_VS: [() => PLUME_VS],
  modelPointAt: [() => modelPointAt, v => (modelPointAt = v)],
  norm3: [() => norm3, v => (norm3 = v)],
  plumeBasis: [() => plumeBasis, v => (plumeBasis = v)],
  plumeBits: [() => plumeBits, v => (plumeBits = v)],
  plumeDone: [() => plumeDone, v => (plumeDone = v)],
  plumeHash: [() => plumeHash, v => (plumeHash = v)],
  plumeHaze: [() => plumeHaze, v => (plumeHaze = v)],
  plumeHazeOn: [() => plumeHazeOn, v => (plumeHazeOn = v)],
  plumeMesh: [() => plumeMesh, v => (plumeMesh = v)],
  plumeNozzles: [() => plumeNozzles, v => (plumeNozzles = v)],
  plumePass: [() => plumePass, v => (plumePass = v)],
  plumeUniforms: [() => plumeUniforms, v => (plumeUniforms = v)],
  plumeVao: [() => plumeVao, v => (plumeVao = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the plume's pixel size: the models' 48 px a metre (the owner, 2026-10-29) */
const PLUME_PX = 48;
/** stations along the plume (0 the nozzle, 1 the tip) and round the cone */
const PLUME_T = [0, 0.06, 0.15, 0.27, 0.42, 0.6, 0.8, 1];
const PLUME_SIDES = 10;

const PLUME_COMMON = `float phs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float pvn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(phs(i),phs(i+vec2(1.,0.)),f.x),mix(phs(i+vec2(0.,1.)),phs(i+1.),f.x),f.y);}
float pby(vec2 p){ivec2 i=ivec2(mod(p,4.));int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i.y*4+i.x])+.5)/16.;}
float prad(float t,float r){return r*(1.+.55*t)*(1.-pow(t,1.7)*.88);}`;

/* the plume: aA = [t along, angle round, s across (-1..1, quads and disc), kind (0 cone, 1 quads, 2 disc)] */
const PLUME_VS = `#version 300 es
precision highp float;layout(location=0) in vec4 aA;
uniform mat4 uVP;uniform vec3 uCamP,uRoot,uAx,uU,uV;uniform float uLen,uRad,uBend,uGrow;out vec3 vW;out vec4 vA;out vec3 vN;
${PLUME_COMMON}
void main(){float t=aA.x,a=aA.y,s=aA.z;int kd=int(aA.w+.5);vec3 dn=vec3(0.,-1.,0.);
 vec3 c=uRoot+uAx*t*uLen*uGrow+dn*uBend*t*t*uLen*uGrow*.5;float r=prad(t,uRad)*uGrow;vec3 n=uU*cos(a)+uV*sin(a),w;
 if(kd==0)w=c+n*r;else if(kd==1)w=c+n*r*s;else{vec3 v=normalize(uRoot-uCamP),up=abs(v.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.),rr=normalize(cross(v,up)),uu=cross(rr,v);w=uRoot+uAx*uRad*.3-v*uRad*.4+(rr*s+uu*a)*uRad*1.2;}
 vW=w;vA=aA;vN=n;gl_Position=uVP*vec4(w,1.);}`;

const PLUME_SHADERS = {
  plume: [
    PLUME_VS,
    `#version 300 es
precision highp float;in vec3 vW;in vec4 vA;in vec3 vN;out vec4 o;uniform float uLen,uRad,uT,uSeed,uK,uDia,uFl;${LIGHT_GLSL}
${PLUME_COMMON}
void main(){int kd=int(vA.w+.5);float px=${PLUME_PX}.,c,Lq,X,tq,kw;
 if(kd==2){float m=uRad*1.2*px;vec2 q=(floor(vec2(vA.z,vA.y)*m)+.5)/m;c=1.-length(q)+(pvn(q*3.1+vec2(uT*6.,uSeed*11.))-.5)*.45;if(c<=0.)discard;Lq=0.;tq=0.;X=floor(vA.z*m);kw=.7;c=c*1.2;}
 else{Lq=floor(vA.x*uLen*px)+.5;tq=Lq/(uLen*px);float r=max(prad(tq,uRad)*px,1.);
  if(kd==0){float f=abs(dot(normalize(vN),normalize(uEye-vW)));X=floor(f*r);c=(X+.5)/r;kw=.4;}
  else{X=floor(vA.z*r);c=1.-abs(X+.5)/r;kw=.32;}}
 float n=(pvn(vec2(Lq*.07-uT*7.,c*3.4+uSeed*13.))+.5*pvn(vec2(Lq*.19-uT*13.,c*6.5+uSeed*3.)))/1.5;
 float h=(1.-tq*1.02)*(.42+.58*c)+(n-.5)*.6*(.3+tq)+.3*max(0.,1.-tq*3.5)*c*c;
 h+=uDia*.24*step(.5,c)*step(.55,fract(Lq/px*2.6))*(1.-tq);
 h=h*uFl+(pby(vec2(Lq,X))-.5)*.09;
 if(h<.17)discard;
 /* the steps: white-blue core, yellow, orange, deep red, a dark-red edge; each with its own cover (premultiplied: the fire
    is its light plus some cover, so it reads on a bright sky by day and glows by night) */
 vec4 st=h>.8?vec4(1.3,1.45,1.8,.3):h>.6?vec4(1.55,1.15,.5,.42):h>.4?vec4(1.3,.5,.12,.55):h>.27?vec4(.62,.16,.05,.5):vec4(.24,.05,.02,.32);
 vec3 e=st.rgb*uK*kw;float f=dot(fogit(vec3(1.),vW)-fogit(vec3(0.),vW),vec3(.333));e=max(fogit(e,vW)-fogit(vec3(0.),vW),vec3(0.));o=vec4(e,min(1.,st.a*uK*kw*2.)*f);}`,
  ],
  /* the shimmer (Beautiful): the crossed quads a little wider and longer, reading the scene's copy with a wobble */
  plumeHaze: [
    PLUME_VS,
    `#version 300 es
precision highp float;in vec3 vW;in vec4 vA;in vec3 vN;out vec4 o;uniform sampler2D uCopy;uniform vec2 uScr;uniform float uT,uSeed,uK;
${PLUME_COMMON}
void main(){if(vA.w<.5||vA.w>1.5)discard;float e=(1.-abs(vA.z))*(1.-vA.x)*smoothstep(0.,.12,vA.x);if(e<.05)discard;
 vec2 q=floor(gl_FragCoord.xy/3.),uv=gl_FragCoord.xy/uScr;
 vec2 d=vec2(pvn(q*.31+vec2(uT*7.,uSeed*9.)),pvn(q*.27-vec2(uSeed*5.,uT*9.)))-.5;
 o=vec4(texture(uCopy,uv+d*.012*e*uK).rgb,1.);}`,
  ],
  /* smoke puffs and sparks: aP their middle, aB [corner x, corner y], aK [kind (0 smoke, 1 spark), alpha, size, seed] */
  plumeBits: [
    `#version 300 es
precision highp float;layout(location=0) in vec3 aP;layout(location=1) in vec2 aB;layout(location=2) in vec4 aK;
uniform mat4 uVP;uniform vec3 uCamP;out vec3 vW;out vec2 vB;out vec4 vK;
void main(){vec3 v=normalize(aP-uCamP),up=abs(v.y)>.98?vec3(1.,0.,0.):vec3(0.,1.,0.),rr=normalize(cross(v,up)),uu=cross(rr,v);
 vec3 w=aP+(rr*aB.x+uu*aB.y)*aK.z;vW=w;vB=aB;vK=aK;gl_Position=uVP*vec4(w,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;in vec2 vB;in vec4 vK;out vec4 o;${LIGHT_GLSL}
${PLUME_COMMON}
void main(){float m=max(vK.z*${PLUME_PX}.,1.);vec2 q=(floor(vB*m)+.5)/m;
 if(vK.x>.5){if(max(abs(q.x),abs(q.y))>.75)discard;o=vec4(vec3(2.3,1.5,.6)*vK.y,1.);return;}
 float r=length(q)+(pvn(q*2.6+vK.w*17.)-.5)*.42;if(r>.95)discard;
 if(pby(floor(vB*m))>vK.y)discard;
 float lt=dot(normalize(vec3(q.x,q.y,.8)),normalize(vec3(.4,.7,.6)));float tone=lt>.62?1.:lt>.3?.84:.68;
 vec3 c=vec3(.8,.78,.76)*tone*(uAmbTop*.9+uSunCol*.45*tone);o=vec4(fogit(c,vW),1.);}`,
  ],
};

/** a recipe's nozzles: [x, back, up, radius] in the model's metres (tools/build-station-trains.py), else found from
 * its 'rocket glow' layers (a Studio copy without them) @param {any} rec @returns {number[][]} */
function plumeNozzles(rec) {
  if (!rec) return [];
  if (Array.isArray(rec.nozzles)) return rec.nozzles;
  if (rec._nozzles) return rec._nozzles;
  const L = (rec.layers || []).filter(l => l && l.k === 'limb' && l.name === 'rocket glow');
  return (rec._nozzles = L.map(l => [Math.min(l.x, l.x2 ?? l.x), l.y || 0, l.z || 0, l.r || 0.3]));
}

/** a point of a model, given in its metres [x, up, back], where its shaders draw it (prop-models.js: the spin about
 * its pivot, the mirror, the size, the turn and the bob, then the place and the world's curve); dir: a way, not a
 * point (no place, no curve) @param {any} it @param {number[]} m @param {boolean} [dir] @returns {number[]} */
function modelPointAt(it, m, dir = false) {
  const S = it.spin,
    bo = typeof mooredBob === 'function' ? mooredBob(it) : null,
    s = ((it.p && it.p.s) || 1) * (it.lk ? it.lk.size : 1),
    ro = propTurn(it) + (bo ? bo[1] : 0);
  let [x, y, z] = spinPoint(S && dir ? { ...S, c: [0, 0, 0] } : S, m);
  x *= (it.flip || 1) * s;
  y *= s;
  z *= s;
  const cr = Math.cos(ro),
    sr = Math.sin(ro),
    X = x * cr - z * sr,
    Z = x * sr + z * cr;
  if (dir) return [X, y, Z];
  return [it.x + X, it.y + (bo ? bo[0] : 0) + y + worldCurveDrop(it.x, it.z), it.z + Z];
}

/** two ways square to d (unit) @param {number[]} d */
function plumeBasis(d) {
  const a = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
    u = norm3([d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]]),
    v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  return [u, v];
}
function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** the plume's mesh, once: cone rings, the two crossed quads and the disc, as aA quadruples (PLUME_VS) */
function plumeMesh() {
  const v = [],
    T = PLUME_T,
    put = (/** @type {number[]} */ ...q) => v.push(...q);
  for (let i = 0; i + 1 < T.length; i++)
    for (let j = 0; j < PLUME_SIDES; j++) {
      const a0 = (j / PLUME_SIDES) * Math.PI * 2,
        a1 = ((j + 1) / PLUME_SIDES) * Math.PI * 2;
      put(T[i], a0, 0, 0, T[i], a1, 0, 0, T[i + 1], a1, 0, 0);
      put(T[i], a0, 0, 0, T[i + 1], a1, 0, 0, T[i + 1], a0, 0, 0);
    }
  for (const a of [0, Math.PI / 2])
    for (let i = 0; i + 1 < T.length; i++) {
      put(T[i], a, -1, 1, T[i], a, 1, 1, T[i + 1], a, 1, 1);
      put(T[i], a, -1, 1, T[i + 1], a, 1, 1, T[i + 1], a, -1, 1);
    }
  put(0, -1, -1, 2, 0, -1, 1, 2, 0, 1, 1, 2);
  put(0, -1, -1, 2, 0, 1, 1, 2, 0, 1, -1, 2);
  return new Float32Array(v);
}

/** a little steady randomness: 0..1 from a number @param {number} n */
function plumeHash(n) {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** the haze copy (Beautiful): on when the player chose Beautiful and the automatic quality hasn't stepped down */
function plumeHazeOn() {
  const pr = typeof saveData !== 'undefined' && saveData && saveData.preferences;
  return !!pr && pr.aim === 'sharp' && !(walkRenderer.q > 0) && !reducedMotion;
}

/**
 * the frame's plumes. P (train-ride.js trainPlume): t the ride's ms, len the plume's length in metres at full size,
 * k its strength (0 off), bend (0 straight back .. 1 down), dia the shock diamonds (0-1), smoke and sparks (or null):
 * {t0 the ms they started, p the train's placement then ({x, z, rot}), y the ground's height there, n, life (ms)}
 * @param {any} C the camera @param {any[]} items the frame's items @param {any} X the light context @param {any} P
 */
export function plumePass(C, items, X, P) {
  if (!P) return;
  const it = items.find(q => q && q.p && q.p.trainRide && q.vox && !q.layer),
    N = it ? plumeNozzles(it.vox) : [];
  if (!it || !N.length) return;
  const gl = gpuState.gl,
    t = P.t / 1000,
    seed = plumeHash((it.p.k || '').length + 3.1),
    fl = 0.86 + 0.14 * plumeHash(Math.floor(P.t / 45)),
    s = ((it.p && it.p.s) || 1) * (it.lk ? it.lk.size : 1);
  ensurePrograms(PLUME_SHADERS);
  const nz = N.map(n => {
    const root = modelPointAt(it, [n[0], n[2], n[1]]),
      ax0 = norm3(modelPointAt(it, [-1, 0, 0], true)),
      b = P.bend || 0,
      ax = norm3([ax0[0] * (1 - b * 0.7), ax0[1] * (1 - b * 0.7) - b * 0.9, ax0[2] * (1 - b * 0.7)]);
    return { root, ax, uv: plumeBasis(ax), r: n[3] * s * 0.82 };
  });
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(false);
  if (P.k > 0.01) {
    /* the shimmer first: it bends what is behind the fire */
    if (plumeHazeOn()) plumeHaze(C, X, nz, P, t, seed, s);
    const p = useWalkProgram('plume', C, X);
    plumeVao(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform3fv(p.U.uCamP, C.eye);
    gl.uniform1f(p.U.uT, t);
    gl.uniform1f(p.U.uK, P.k);
    gl.uniform1f(p.U.uDia, P.dia || 0);
    gl.uniform1f(p.U.uFl, fl);
    gl.uniform1f(p.U.uBend, P.bend || 0);
    gl.uniform1f(p.U.uGrow, 1);
    gl.bindVertexArray(p.pm.vao);
    nz.forEach((q, i) => {
      plumeUniforms(p, q, P.len * s * (0.94 + 0.06 * plumeHash(i * 7 + Math.floor(P.t / 60))), seed + i * 0.37);
      gl.drawArrays(gl.TRIANGLES, 0, p.pm.n);
    });
    gl.bindVertexArray(null);
  }
  if (P.smoke || P.sparks) plumeBits(C, X, it, N, P, s);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.depthMask(true);
  bindQuad();
}
function plumeUniforms(p, q, len, seed) {
  const gl = gpuState.gl;
  gl.uniform3fv(p.U.uRoot, q.root);
  gl.uniform3fv(p.U.uAx, q.ax);
  gl.uniform3fv(p.U.uU, q.uv[0]);
  gl.uniform3fv(p.U.uV, q.uv[1]);
  gl.uniform1f(p.U.uLen, len);
  gl.uniform1f(p.U.uRad, q.r);
  gl.uniform1f(p.U.uSeed, seed);
}
/** the plume mesh's buffer, made with the program (a new context makes them again) */
function plumeVao(p) {
  if (p.pm) return;
  const gl = gpuState.gl,
    d = plumeMesh(),
    vao = gpuVao('meshes'),
    buf = gpuBuffer('meshes');
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
  gpuSized(buf, d.byteLength);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  gl.bindVertexArray(null);
  p.pm = { vao, buf, n: d.length / 4 };
}

/** Beautiful: a half-size copy of the scene so far, read back through the crossed quads with a wobble */
function plumeHaze(C, X, nz, P, t, seed, s) {
  const gl = gpuState.gl,
    S = gpuState.fb.scene;
  if (!S || !S.f) return;
  const w = Math.max(1, S.w >> 1),
    h = Math.max(1, S.h >> 1),
    K = renderTarget('plumeCopy', w, h, { hdr: true });
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.f);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, K.f);
  gl.blitFramebuffer(0, 0, S.w, S.h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, S.w, S.h);
  const p = useWalkProgram('plumeHaze', C, null);
  plumeVao(p);
  gl.disable(gl.BLEND);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, K.c);
  gl.uniform1i(p.U.uCopy, 0);
  gl.uniform2f(p.U.uScr, S.w, S.h);
  gl.uniform3fv(p.U.uCamP, C.eye);
  gl.uniform1f(p.U.uT, t);
  gl.uniform1f(p.U.uK, Math.min(1, P.k));
  gl.uniform1f(p.U.uBend, P.bend || 0);
  gl.uniform1f(p.U.uGrow, 1.35);
  gl.bindVertexArray(p.pm.vao);
  for (const q of nz) {
    plumeUniforms(p, q, P.len * s * 1.1, seed);
    gl.drawArrays(gl.TRIANGLES, 0, p.pm.n);
  }
  gl.bindVertexArray(null);
}
/** the ride is over: the shimmer's copy goes (it is only made on the ride) */
export function plumeDone() {
  const F = gpuState.fb && gpuState.fb.plumeCopy;
  if (!F) return;
  gpuFree(F.f);
  gpuFree(F.c);
  delete gpuState.fb.plumeCopy;
}

/** the smoke and sparks at lift-off and touch-down, each from the ride's clock: born one after another from t0 at the
 * nozzles' spots on the ground where the train stood then, drifting out and up, growing, thinning (dithered away) */
function plumeBits(C, X, it, N, P, s) {
  const gl = gpuState.gl,
    out = [],
    quad = (/** @type {number[]} */ c, kind, a, size, sd) => {
      for (const [bx, by] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, -1],
        [1, 1],
        [-1, 1],
      ])
        out.push(c[0], c[1], c[2], bx, by, kind, a, size, sd);
    },
    spots = (/** @type {any} */ E) =>
      N.map(n => {
        const g = { x: E.p.x, z: E.p.z, rot: E.p.rot },
          q = turnedPoint(g, n[0] * s * (it.flip || 1), n[1] * s);
        return [q[0], E.y + worldCurveDrop(q[0], q[1]), q[1]];
      });
  const E = P.smoke;
  if (E) {
    const G = spots(E);
    for (let i = 0; i < E.n; i++) {
      const age = P.t - (E.t0 + i * (E.every || 80));
      if (age < 0 || age > E.life) continue;
      const k = age / E.life,
        g = G[i % G.length],
        h1 = plumeHash(i * 3.7 + 1),
        h2 = plumeHash(i * 5.3 + 2),
        an = h1 * Math.PI * 2,
        out1 = (0.6 + 1.9 * Math.sqrt(k)) * (0.6 + 0.6 * h2) * (E.spread || 1);
      quad(
        [g[0] + Math.cos(an) * out1, g[1] + 0.25 + k * (0.9 + h2 * 0.8), g[2] + Math.sin(an) * out1],
        0,
        (1 - k) * (1 - k) * 0.95,
        (0.35 + k * 1.1) * (0.8 + 0.4 * h1),
        h2
      );
    }
  }
  const K = P.sparks,
    nSm = out.length;
  if (K) {
    const G = spots(K);
    for (let i = 0; i < K.n; i++) {
      const age = (P.t - (K.t0 + i * (K.every || 40))) / 1000;
      if (age < 0 || age > 0.55) continue;
      const g = G[i % G.length],
        h1 = plumeHash(i * 2.1 + 9),
        h2 = plumeHash(i * 4.9 + 4),
        an = h1 * Math.PI * 2,
        v = 2.5 + 3 * h2;
      quad(
        [
          g[0] + Math.cos(an) * v * age,
          g[1] + K.up + (1.5 + 2 * h1) * age - 4.9 * age * age,
          g[2] + Math.sin(an) * v * age,
        ],
        1,
        1 - age / 0.55,
        0.035,
        h1
      );
    }
  }
  if (!out.length) return;
  const p = useWalkProgram('plumeBits', C, X);
  gl.uniform3fv(p.U.uCamP, C.eye);
  if (!p.pb) {
    const vao = gpuVao('instances'),
      buf = gpuBuffer('instances');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    [
      [0, 3, 0],
      [1, 2, 3],
      [2, 4, 5],
    ].forEach(([l, k, o]) => {
      gl.enableVertexAttribArray(l);
      gl.vertexAttribPointer(l, k, gl.FLOAT, false, 36, o * 4);
    });
    gl.bindVertexArray(null);
    p.pb = { vao, buf };
  }
  const d = new Float32Array(out);
  gl.bindBuffer(gl.ARRAY_BUFFER, p.pb.buf);
  gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
  gpuSized(p.pb.buf, d.byteLength);
  gl.bindVertexArray(p.pb.vao);
  const nS = nSm / 9,
    nK = (out.length - nSm) / 9;
  if (nS) {
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.drawArrays(gl.TRIANGLES, 0, nS);
    gl.depthMask(false);
  }
  if (nK) {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, nS, nK);
  }
  gl.bindVertexArray(null);
}
