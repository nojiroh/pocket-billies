'use strict';
/* ================= THE FIGURE BAKER (characters track CH-2, the spike; Engine > People > Figures, off) =================
   People as small 3D figures of jointed rigid parts (logic/figure-pose.js: the mannequin, its poses and its view),
   drawn into pixel pictures that go down today's sprite path. A baked picture is a plain canvas tagged as a person's
   (`ax`, `ay` the ground point, `ppm` its pixels a metre, `noNormal` the flat light people have), so the sprites,
   their shadows, AO, fog, the reflection, the outline round you and the person counters take it as they take a
   person-art.js frame, and nothing else in the renderer changes.
   - The baker draws in its own small WebGL2 context (the owner's pick: kept apart from the game's renderer state).
     Pass 1 draws the figure with its depth into a texture: each face in one of three toon bands from a top-left light,
     the scene props' ramps; the depth goes in alpha. Pass 2, at the same pixels: the dark plum outline round it (each
     outside pixel next to the figure takes the outline of its colour, as tools/build-scene-props.py olc) and inside it
     where a part stands well in front of another. Then the pixels are copied to a 2D canvas.
   - Pictures are kept by figure, clip, frame, the view's steps, the density and the outline (figureKey), at most
     FIGURE_CACHE_MAX, and at most FIGURE_BAKES_A_FRAME are baked a frame: until a person's picture is ready they keep
     the last one they had (or today's picture, or nobody, on a test map).
   - A lost baker context bakes nothing until it is back, then rebuilds; the game's own lost context only drops the
     textures, and the canvases are uploaded again. figureBakerLose forces a loss for the checks.
   The renderer never calls this with the switch off. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  FIGURE_BANDS,
  FIGURE_LIGHT,
  OUTLINE_RGB,
  cardSize,
  clipFrameAt,
  figureClipMatrix,
  figureKey,
  figureMesh,
  figurePose,
  figureRamp,
  figureTick,
  figureView,
  jointMatrices,
  mannequinFigure,
} from './logic/figure-pose.js';
import { makeCanvas } from './art.js';
import { seenYaw, walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { gpuState } from './engine/webgl.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_BAKES_A_FRAME: [() => FIGURE_BAKES_A_FRAME],
  FIGURE_CACHE: [() => FIGURE_CACHE],
  FIGURE_CACHE_MAX: [() => FIGURE_CACHE_MAX],
  FIGURE_DEFS: [() => FIGURE_DEFS],
  FIGURE_FS: [() => FIGURE_FS],
  FIGURE_OUT_FS: [() => FIGURE_OUT_FS],
  FIGURE_OUT_VS: [() => FIGURE_OUT_VS],
  FIGURE_VS: [() => FIGURE_VS],
  bakeFigure: [() => bakeFigure, v => (bakeFigure = v)],
  figureBaker: [() => figureBaker],
  figureBakerLose: [() => figureBakerLose, v => (figureBakerLose = v)],
  figureBuild: [() => figureBuild, v => (figureBuild = v)],
  figureCacheClear: [() => figureCacheClear, v => (figureCacheClear = v)],
  figureCompile: [() => figureCompile, v => (figureCompile = v)],
  figureDef: [() => figureDef, v => (figureDef = v)],
  figureGait: [() => figureGait],
  figureGl: [() => figureGl, v => (figureGl = v)],
  figureLast: [() => figureLast],
  figurePalette: [() => figurePalette, v => (figurePalette = v)],
  figurePersonPicture: [() => figurePersonPicture, v => (figurePersonPicture = v)],
  figurePicture: [() => figurePicture, v => (figurePicture = v)],
  figureReport: [() => figureReport, v => (figureReport = v)],
  figureTarget: [() => figureTarget, v => (figureTarget = v)],
  figureTilt: [() => figureTilt, v => (figureTilt = v)],
  figuresOn: [() => figuresOn, v => (figuresOn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FIGURE_CACHE_MAX = 600,
  FIGURE_BAKES_A_FRAME = 4;
/** the baker: its canvas and context, programs, buffers and counts (debug log: people.figures) */
const figureBaker = {
  cv: null,
  gl: null,
  ready: false,
  lost: 0,
  failed: '',
  P: null,
  O: null,
  vao: null,
  oVao: null,
  fb: null,
  tex: null,
  depth: null,
  size: [0, 0],
  mesh: null,
  bakes: 0,
  ms: 0,
  losses: 0,
  frame: -1,
  frameBakes: 0,
};
const FIGURE_CACHE = new Map();
/** each person's last picture (a runtime record or a test map's lineup entry; nothing is written on them) */
const figureLast = new WeakMap();
/** the figures by name */
const FIGURE_DEFS = {};

/** whether people are drawn as figures (Engine > People > Figures) */
export function figuresOn() {
  return typeof engineSetting === 'function' && !!engineSetting('people', 'figures');
}
function figureDef(name) {
  if (name !== 'mannequin') return null;
  return FIGURE_DEFS[name] || (FIGURE_DEFS[name] = mannequinFigure());
}

const FIGURE_VS = `#version 300 es
in vec3 aP;in vec3 aN;in float aJ;in float aC;uniform mat4 uJ[24];uniform mat4 uM;uniform mat3 uR;out vec3 vN;flat out int vC;
void main(){mat4 J=uJ[int(aJ)];vN=uR*(mat3(J)*aN);vC=int(aC);gl_Position=uM*(J*vec4(aP,1.));}`;
const FIGURE_FS = `#version 300 es
precision highp float;in vec3 vN;flat in int vC;uniform vec3 uPal[48];uniform vec3 uL;uniform vec2 uB;out vec4 o;
void main(){vec3 n=normalize(vN);float d=dot(n,uL);int b=d>uB.x?2:(d>uB.y?1:0);
/* the depth, nearer larger, in alpha: 0 is no figure */
o=vec4(uPal[vC*3+b]/255.,mix(1.,.08,gl_FragCoord.z));}`;
const FIGURE_OUT_VS = `#version 300 es
in vec2 aQ;void main(){gl_Position=vec4(aQ*2.-1.,0.,1.);}`;
const FIGURE_OUT_FS = `#version 300 es
precision highp float;uniform sampler2D uT;uniform float uOut;uniform vec3 uOL;uniform ivec2 uS;out vec4 o;
vec3 olc(vec3 c){return mix(floor(c*255.*.45)/255.,uOL,.8);}
vec4 at(ivec2 p){return (p.x<0||p.y<0||p.x>=uS.x||p.y>=uS.y)?vec4(0.):texelFetch(uT,p,0);}
void main(){ivec2 p=ivec2(gl_FragCoord.xy);vec4 c=at(p);
 vec4 q[4]=vec4[4](at(p+ivec2(1,0)),at(p-ivec2(1,0)),at(p+ivec2(0,1)),at(p-ivec2(0,1)));
 if(c.a==0.){
  if(uOut<.5){o=vec4(0.);return;}
  /* beside the figure: the outline of the nearest neighbour's colour */
  vec4 best=vec4(0.);for(int i=0;i<4;i++)if(q[i].a>best.a)best=q[i];
  o=best.a>0.?vec4(olc(best.rgb),1.):vec4(0.);return;}
 o=vec4(c.rgb,1.);
 /* a pixel of a part with a part well in front of it beside it: a line, half the outline's weight */
 if(uOut>.5){bool line=false;for(int i=0;i<4;i++)if(q[i].a>c.a+.03)line=true;if(line)o.rgb=mix(c.rgb,olc(c.rgb),.6);}}`;

function figureCompile(gl, vs, fs) {
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('figure shader: ' + gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('figure program: ' + gl.getProgramInfoLog(p));
  const U = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const u = gl.getActiveUniform(p, i),
      name = u.name.replace(/\[0\]$/, '');
    U[name] = gl.getUniformLocation(p, u.name);
  }
  return { p, U, a: k => gl.getAttribLocation(p, k) };
}
/** the baker's context, made the first time a figure is baked; null while lost or if WebGL2 refuses it */
function figureGl() {
  const B = figureBaker;
  if (B.failed) return null;
  if (!B.cv) {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      B.lost = 1;
      B.ready = false;
      B.losses++;
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker context lost');
    });
    cv.addEventListener('webglcontextrestored', () => {
      B.lost = 0;
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker context restored');
    });
    B.cv = cv;
    B.gl = cv.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!B.gl) {
      B.failed = 'no WebGL2 context';
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker: ' + B.failed);
      return null;
    }
  }
  const gl = B.gl;
  if (B.lost || gl.isContextLost()) return null;
  if (!B.ready)
    try {
      figureBuild(gl);
      B.ready = true;
    } catch (e) {
      B.failed = String((e && e.message) || e);
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'baker: ' + B.failed);
      return null;
    }
  return gl;
}
/** the programs, the mesh, the screen quad and the pass-1 target, on a new or restored context */
function figureBuild(gl) {
  const B = figureBaker;
  B.P = figureCompile(gl, FIGURE_VS, FIGURE_FS);
  B.O = figureCompile(gl, FIGURE_OUT_VS, FIGURE_OUT_FS);
  const M = figureMesh(figureDef('mannequin'));
  B.mesh = M;
  B.vao = gl.createVertexArray();
  gl.bindVertexArray(B.vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, M.data, gl.STATIC_DRAW);
  for (const [k, n, off] of [
    ['aP', 3, 0],
    ['aN', 3, 3],
    ['aJ', 1, 6],
    ['aC', 1, 7],
  ]) {
    const a = B.P.a(k);
    if (a < 0) continue;
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, n, gl.FLOAT, false, 32, off * 4);
  }
  B.oVao = gl.createVertexArray();
  gl.bindVertexArray(B.oVao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const qa = B.O.a('aQ');
  gl.enableVertexAttribArray(qa);
  gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  B.size = [0, 0];
  figureTarget(gl, B.cv.width, B.cv.height);
}
/** pass 1's colour (alpha the depth) and depth, as big as the baker's canvas */
function figureTarget(gl, w, h) {
  const B = figureBaker;
  if (B.size[0] === w && B.size[1] === h && B.fb) return;
  if (B.fb) {
    gl.deleteFramebuffer(B.fb);
    gl.deleteTexture(B.tex);
    gl.deleteRenderbuffer(B.depth);
  }
  B.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  B.depth = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, B.depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  B.fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, B.tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, B.depth);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  B.size = [w, h];
}
/** a figure's palette for the shader: for each colour, its shadow, base and light (the props' ramp) */
function figurePalette(F, colours) {
  const out = new Float32Array(48 * 3);
  colours.forEach((k, i) => {
    const R = figureRamp(F.colours[k]),
      flat = k === 'eye' || k === 'glint';
    [flat ? R[2] : R[1], R[2], flat ? R[2] : R[3]].forEach((c, b) => out.set(c, (i * 3 + b) * 3));
  });
  return out;
}
/**
 * one picture of a figure: its pose at a clip's frame, seen in view V at `ppm` pixels a metre. A canvas tagged as a
 * person's picture, or null if the baker can't draw now.
 */
function bakeFigure(F, clip, frame, V, ppm, outline) {
  const gl = figureGl();
  if (!gl) return null;
  const B = figureBaker,
    t0 = performance.now(),
    S = cardSize(ppm, V.tilt, F.height);
  if (S.w > B.cv.width || S.h > B.cv.height) {
    B.cv.width = Math.max(B.cv.width, S.w);
    B.cv.height = Math.max(B.cv.height, S.h);
  }
  figureTarget(gl, B.cv.width, B.cv.height);
  const J = jointMatrices(F, figurePose(F, clip, frame), ppm),
    c = Math.cos(V.rel),
    s = Math.sin(V.rel);
  /* pass 1: the figure with its depth */
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
  gl.viewport(0, 0, S.w, S.h);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  gl.clearColor(0, 0, 0, 0);
  gl.clearDepth(1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(B.P.p);
  const U = B.P.U;
  gl.uniformMatrix4fv(U.uJ, false, J);
  gl.uniformMatrix4fv(U.uM, false, figureClipMatrix(V.rel, V.tilt, ppm, S));
  /* the figure's turn in the camera's frame, for the normals (logic/figure-pose.js cardPoint) */
  gl.uniformMatrix3fv(U.uR, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]));
  gl.uniform3fv(U.uPal, figurePalette(F, B.mesh.colours));
  gl.uniform3fv(U.uL, FIGURE_LIGHT);
  gl.uniform2f(U.uB, FIGURE_BANDS.light, FIGURE_BANDS.base);
  gl.bindVertexArray(B.vao);
  gl.drawArrays(gl.TRIANGLES, 0, B.mesh.count);
  /* pass 2: the outline, to the canvas */
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, S.w, S.h);
  gl.disable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(B.O.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  gl.uniform1i(B.O.U.uT, 0);
  gl.uniform1f(B.O.U.uOut, outline ? 1 : 0);
  gl.uniform3f(B.O.U.uOL, OUTLINE_RGB[0] / 255, OUTLINE_RGB[1] / 255, OUTLINE_RGB[2] / 255);
  gl.uniform2i(B.O.U.uS, S.w, S.h);
  gl.bindVertexArray(B.oVao);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.bindVertexArray(null);
  /* the drawing buffer's rows start at the bottom: the picture is its bottom S.h rows */
  const out = makeCanvas(S.w, S.h),
    x = out.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(B.cv, 0, B.cv.height - S.h, S.w, S.h, 0, 0, S.w, S.h);
  out.ax = S.ax;
  out.ay = S.ay;
  out.ppm = ppm;
  out.noNormal = true;
  out.figure = F.name;
  B.bakes++;
  B.ms += performance.now() - t0;
  return out;
}
/**
 * the picture of a person drawn as a figure this frame, or their last one while it isn't baked yet (null when there
 * is none). `rec` is what the last picture is kept against (a runtime record or a lineup entry, never written to);
 * `heading` the way they face in the world (logic/person-view.js personHeading), `yaw` the camera's turn (seenYaw),
 * `tilt` the camera's tilt.
 */
function figurePicture(rec, name, clip, frame, heading, yaw, tilt) {
  const F = figureDef(name);
  if (!F) return null;
  const e = k => engineSetting('people', k),
    ppm = Math.max(16, Math.min(64, Math.round(e('density') || 32))),
    steps = e('yawSteps') >= 12 ? 16 : 8,
    outline = e('outline') !== false,
    V = figureView(heading, yaw, tilt, steps),
    key = figureKey(F.name, clip, frame, V, steps, ppm, outline);
  let im = FIGURE_CACHE.get(key);
  if (im) {
    /* kept the longest by the last use */
    FIGURE_CACHE.delete(key);
    FIGURE_CACHE.set(key, im);
  } else {
    const B = figureBaker,
      fr = typeof gpuState !== 'undefined' ? gpuState.fr || 0 : 0;
    if (B.frame !== fr) {
      B.frame = fr;
      B.frameBakes = 0;
    }
    if (B.frameBakes < FIGURE_BAKES_A_FRAME) {
      B.frameBakes++;
      im = bakeFigure(F, clip, frame, V, ppm, outline);
      if (im) {
        FIGURE_CACHE.set(key, im);
        while (FIGURE_CACHE.size > FIGURE_CACHE_MAX) FIGURE_CACHE.delete(FIGURE_CACHE.keys().next().value);
      }
    }
  }
  if (im && rec && typeof rec === 'object') figureLast.set(rec, im);
  return im || (rec && typeof rec === 'object' ? figureLast.get(rec) || null : null);
}
/** each person's distance walked at the last tick of the 12 fps clock: the walk is read once a tick */
const figureGait = new WeakMap();
/** the camera's tilt this frame (walk/camera.js), radians; the Normal zoom's 26 degrees with no camera */
function figureTilt() {
  const C = typeof walkView !== 'undefined' ? walkView.C : null;
  return C && C.sp != null ? Math.atan2(C.sp, C.cp) : (26 * Math.PI) / 180;
}
/**
 * a person drawn as figure `name` this frame: idle, or walking by the distance walked (`gait`, metres) as it was at
 * the last tick, turned to `heading` in the world (logic/person-view.js personHeading), seen from this frame's camera.
 * `rec` keeps their last picture and their gait at the last tick (nothing is written on it). Null until a first
 * picture is baked.
 */
export function figurePersonPicture(rec, name, t, walking, gait, heading) {
  const clip = walking ? 'walk' : 'idle',
    tick = figureTick(t);
  let g = figureGait.get(rec);
  if (!g || g.tick !== tick) figureGait.set(rec, (g = { tick, gait }));
  return figurePicture(rec, name, clip, clipFrameAt(clip, t, g.gait), heading, seenYaw(), figureTilt());
}
/** the baker's numbers for the debug log's people section (numbers only) */
export function figureReport() {
  const B = figureBaker;
  return {
    on: figuresOn(),
    pictures: FIGURE_CACHE.size,
    bakes: B.bakes,
    ms: Math.round(B.ms * 10) / 10,
    lost: B.lost,
    losses: B.losses,
    failed: B.failed || null,
  };
}
/** the checks: lose the baker's context on purpose, back after `ms` (WEBGL_lose_context); false if it can't */
function figureBakerLose(ms = 1500) {
  const gl = figureBaker.gl,
    x = gl && gl.getExtension('WEBGL_lose_context');
  if (!x) return false;
  x.loseContext();
  setTimeout(() => x.restoreContext(), ms);
  return true;
}
/** forget every baked picture (the checks; a picture already in the world stays drawn until it's replaced) */
function figureCacheClear() {
  FIGURE_CACHE.clear();
}
