'use strict';
/* ================= THE FIGURES' LIVE ATLAS (characters track CH-4) =================
   With Engine > People > Figures and Live atlas on, the people in the walk view are drawn by the game's own renderer
   into one shared atlas, before the shadow passes, on each step of the 12 fps clock, and lit where they stand by the
   sprite shader (walk-shaders.js FIGURE_SPRITE_GLSL): the sun, the sky, every lamp and the world's shadows. CH-3b
   baked a canvas a picture in the figure baker's own context, lit by a stepped scene light and kept by it (so lamps at
   night made more of them); one texture each, so people never batched.
   - The atlas is unlit: two RGBA8 textures (renderTarget o.colors). Colour: the light-independent shading as a
     multiplier (soft occlusion, an inner line, a direction's height gradient and grain), or for an unlit pixel (the
     outline, the face's marks) its colour. Normal: the surface's normal in the picture's frame (x right, y down, z
     toward the eye) and its colour's row of the ramp (row 0: unlit).
   - The ramp: one 8 x 256 texture of every colour's five shades as the figure's direction takes them (figures.js
     figurePalette), shared by all figures; its sixth texel marks skin (no deep tone).
   - A figure is drawn into a scratch target (its depth in alpha, as the baker's pass 1), then copied into its cell
     with the outline, the inner line and the occlusion added (the baker's pass 2), the face's marks over it last.
     A cell (logic/atlas-pack.js) is kept while its person is in view and drawn again only when their picture changes
     (turn, frame, tilt, density, style): an idle figure every other tick.
   - A person's picture is one object (kept against them) carrying the atlas's textures (`atlasT`, what imageTexture
     gives for it) and its cell (`uv`), so the sprites, their shadows and the reflection take every person from one
     texture, in one run.
   - A lost context: the atlas, the ramp and every figure's buffers are made again on next use and each person drawn
     again; a person keeps their last picture (or today's) until then. figureAtlasReport counts it all. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import {
  FIGURE_BANDS,
  FIGURE_PAL_MAX,
  OUTLINE_RGB,
  cardSize,
  figureClipMatrix,
  figureFaceMarks,
  figureKey,
  figurePose,
  jointMatrices,
} from './logic/figure-pose.js';
import { atlasPackAdd, atlasPackFree, atlasPackNew, atlasPackUse } from './logic/atlas-pack.js';
import { engineContext, engineSetting } from './engine/settings.js';
import {
  ensurePrograms,
  gpuBuffer,
  gpuFree,
  gpuOnRestore,
  gpuSized,
  gpuState,
  gpuTexture,
  gpuVao,
  renderTarget,
  setTextureParams,
} from './engine/webgl.js';
import { environment } from './environment.js';
import { figureMeshGet } from './figure-meshes.js';
import { FIGURE_LOOKS, FIGURE_VS, figurePaintMark, figurePalette, figureSlotMatrices, figureStyle } from './figures.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_ATLAS_FS: [() => FIGURE_ATLAS_FS],
  FIGURE_ATLAS_H: [() => FIGURE_ATLAS_H],
  FIGURE_ATLAS_KEEP: [() => FIGURE_ATLAS_KEEP],
  FIGURE_ATLAS_MESH_BYTES: [() => FIGURE_ATLAS_MESH_BYTES],
  FIGURE_ATLAS_PROGRAMS: [() => FIGURE_ATLAS_PROGRAMS],
  FIGURE_ATLAS_W: [() => FIGURE_ATLAS_W],
  FIGURE_CELL_FS: [() => FIGURE_CELL_FS],
  FIGURE_MARK_FS: [() => FIGURE_MARK_FS],
  FIGURE_MARK_VS: [() => FIGURE_MARK_VS],
  FIGURE_QUAD_VS: [() => FIGURE_QUAD_VS],
  FIGURE_RAMP_ROWS: [() => FIGURE_RAMP_ROWS],
  FIGURE_RAMP_UNIT: [() => FIGURE_RAMP_UNIT],
  FIGURE_RAMP_W: [() => FIGURE_RAMP_W],
  figureAtlas: [() => figureAtlas],
  figureAtlasCell: [() => figureAtlasCell, v => (figureAtlasCell = v)],
  figureAtlasDetail: [() => figureAtlasDetail, v => (figureAtlasDetail = v)],
  figureAtlasDraw: [() => figureAtlasDraw, v => (figureAtlasDraw = v)],
  figureAtlasMarks: [() => figureAtlasMarks, v => (figureAtlasMarks = v)],
  figureAtlasOn: [() => figureAtlasOn, v => ((figureAtlasOn = v), provide({ figureAtlasOn }))],
  figureAtlasPass: [() => figureAtlasPass, v => (figureAtlasPass = v)],
  figureAtlasPicture: [() => figureAtlasPicture, v => ((figureAtlasPicture = v), provide({ figureAtlasPicture }))],
  figureAtlasReady: [() => figureAtlasReady, v => (figureAtlasReady = v)],
  figureAtlasRedrawAll: [() => figureAtlasRedrawAll, v => (figureAtlasRedrawAll = v)],
  figureAtlasReport: [() => figureAtlasReport, v => ((figureAtlasReport = v), provide({ figureAtlasReport }))],
  figureAtlasRes: [() => figureAtlasRes, v => (figureAtlasRes = v)],
  figureAtlasTrim: [() => figureAtlasTrim, v => (figureAtlasTrim = v)],
  figureRampMake: [() => figureRampMake, v => (figureRampMake = v)],
  figureRampRows: [() => figureRampRows, v => (figureRampRows = v)],
  figureSpriteUniforms: [
    () => figureSpriteUniforms,
    v => ((figureSpriteUniforms = v), provide({ figureSpriteUniforms })),
  ],
});
/* eslint-enable no-func-assign */
provide({ figureAtlasOn, figureAtlasPicture, figureAtlasReport, figureSpriteUniforms });
/* to-module: end */
/** the atlas's size in pixels (WebGL2 guarantees 2048): about 300 figures at 48 px a metre */
const FIGURE_ATLAS_W = 2048,
  FIGURE_ATLAS_H = 1024,
  /** a person out of view this many frames gives their cell back */
  FIGURE_ATLAS_KEEP = 90,
  /** the ramp texture: a row a colour (row 0 the unlit one), five shades and the skin mark */
  FIGURE_RAMP_ROWS = 256,
  FIGURE_RAMP_W = 8,
  /** the texture unit the sprite programs read the ramp from (0-1 the picture, 4-5 post and models, 6-13 shadows) */
  FIGURE_RAMP_UNIT = 9,
  /** the figures' meshes on the graphics card, at most this many bytes (a gouache-night figure's is about 4.6 MB):
   * the longest unused go first, made again from figure-meshes.js when wanted */
  FIGURE_ATLAS_MESH_BYTES = 64 * 1048576;
/** the atlas: its targets, cells, ramp, each figure's buffers, the people in it and counts (debug log) */
const figureAtlas = {
  gen: -1,
  failed: '',
  pack: /** @type {any} */ (null),
  T: /** @type {any} */ (null),
  scratch: [0, 0],
  quad: null,
  res: new Map(),
  resBytes: 0,
  trimmed: 0,
  ramp: { tex: null, rows: new Map(), n: 1, dirty: false, data: new Uint8Array(FIGURE_RAMP_W * FIGURE_RAMP_ROWS * 4) },
  /** each figure's ramp rows by its name and style */
  rowsOf: new Map(),
  byRec: new WeakMap(),
  live: new Set(),
  queue: new Set(),
  marks: /** @type {number[]} */ ([]),
  frame: 0,
  draws: 0,
  /* CH-6: of them, those drawn with a face not at rest (talking, a blink, an expression) */
  faceDraws: 0,
  drawn: 0,
  ms: 0,
  full: 0,
  resets: 0,
};

/* pass 1: the figure's ramp row and its depth (as the baker's pass 1: nearer larger, 0 none), its normal and height */
const FIGURE_ATLAS_FS = `#version 300 es
precision highp float;in vec3 vN;in vec2 vUV;in vec3 vLS;in vec3 vP;flat in int vC;uniform float uRow[28];uniform float uH;
layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;
void main(){vec3 n=normalize(vN);o0=vec4(uRow[vC]/255.,0.,0.,mix(1.,.08,gl_FragCoord.z));
 o1=vec4(n.x*.5+.5,-n.y*.5+.5,-n.z*.5+.5,clamp(vP.y/max(uH,.5),0.,1.));}`;
const FIGURE_QUAD_VS = `#version 300 es
layout(location=0) in vec2 aQ;void main(){gl_Position=vec4(aQ*2.-1.,0.,1.);}`;
/* pass 2, into the cell: the outline round it (each outside pixel the outline of its nearest neighbour's base colour,
   unlit), and inside the light-independent shading as a multiplier (the inner line, the occlusion, mode 7's gradient
   and grain); the picture's top row at the cell's first */
const FIGURE_CELL_FS = `#version 300 es
precision highp float;uniform sampler2D uT0,uT1,uRamp;uniform ivec2 uS,uO;uniform float uOut,uInk,uInner,uAO,uM7;uniform int uOutW;uniform vec3 uOL;uniform vec4 uFx;
layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;
vec4 at(ivec2 p){return (p.x<0||p.y<0||p.x>=uS.x||p.y>=uS.y)?vec4(0.):texelFetch(uT0,p,0);}
vec3 baseOf(vec4 c){return texelFetch(uRamp,ivec2(2,int(c.r*255.+.5)),0).rgb;}
vec3 olc(vec3 c){return uInk>1.5?mix(c*.42,uOL,.35):uInk>.5?uOL*.55:mix(floor(c*255.*.45)/255.,uOL,.8);}
void main(){ivec2 l=ivec2(gl_FragCoord.xy)-uO,p=ivec2(l.x,uS.y-1-l.y);vec4 c=at(p);
 if(c.a==0.){o0=vec4(0.);o1=vec4(0.);if(uOut<.5)return;
  vec4 best=vec4(0.);for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){if(abs(x)+abs(y)>uOutW||(x==0&&y==0))continue;vec4 v=at(p+ivec2(x,y));if(v.a>best.a)best=v;}
  if(best.a>0.){o0=vec4(olc(baseOf(best)),1.);o1=vec4(.5,.5,1.,0.);}return;}
 vec3 base=baseOf(c),m=vec3(1.);
 if(uOut>.5&&uInner>0.){bool line=false;vec4 q[4]=vec4[4](at(p+ivec2(1,0)),at(p-ivec2(1,0)),at(p+ivec2(0,1)),at(p-ivec2(0,1)));
  for(int i=0;i<4;i++)if(q[i].a>c.a+uInner)line=true;if(line)m*=mix(base,olc(base),uInk>.5?.85:.6)/max(base,vec3(.02));}
 if(uAO>0.){float k=0.;for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){if(at(p+ivec2(x,y)).a>c.a+.012)k+=1.;}m*=mix(vec3(1.),vec3(.62,.58,.82),uAO*min(1.,k/7.));}
 vec4 nr=texelFetch(uT1,p,0);
 if(uM7>.5){m*=mix(vec3(.9,.93,1.05),vec3(1.05,1.02,.95),mix(.5,nr.w,uFx.y));
  vec2 gp=floor(vec2(p)*vec2(1.,.5));m*=1.+(fract(sin(dot(gp,vec2(12.9898,78.233)))*43758.5453)-.5)*uFx.z;}
 o0=vec4(clamp(m*.5,0.,1.),1.);o1=vec4(nr.xyz,c.r);}`;
/* the face's marks: whole-pixel rects in the atlas's pixels, unlit */
const FIGURE_MARK_VS = `#version 300 es
layout(location=0) in vec2 aQ;layout(location=1) in vec4 aR;layout(location=2) in vec3 aCol;uniform vec2 uA;flat out vec3 vCol;
void main(){vCol=aCol;gl_Position=vec4((aR.xy+aQ*aR.zw)/uA*2.-1.,0.,1.);}`;
const FIGURE_MARK_FS = `#version 300 es
precision highp float;flat in vec3 vCol;layout(location=0) out vec4 o0;layout(location=1) out vec4 o1;
void main(){o0=vec4(vCol,1.);o1=vec4(.5,.5,1.,0.);}`;
const FIGURE_ATLAS_PROGRAMS = {};

/** whether people are drawn through the atlas: Figures and Live atlas on, the game's renderer up, nothing failed */
function figureAtlasOn() {
  return (
    !figureAtlas.failed &&
    typeof gpuState !== 'undefined' &&
    !!gpuState.gl &&
    !gpuState.lost &&
    typeof engineSetting === 'function' &&
    engineSetting('people', 'atlas') !== false
  );
}
/** the atlas's GL objects on this context (made on first use and again after a lost context); false if they can't be */
function figureAtlasReady() {
  const A = figureAtlas,
    gl = gpuState.gl;
  if (A.gen === gpuState.gen && A.T) return true;
  try {
    if (!FIGURE_ATLAS_PROGRAMS.figAtlas)
      Object.assign(FIGURE_ATLAS_PROGRAMS, {
        figAtlas: [FIGURE_VS, FIGURE_ATLAS_FS],
        figCell: [FIGURE_QUAD_VS, FIGURE_CELL_FS],
        figMark: [FIGURE_MARK_VS, FIGURE_MARK_FS],
      });
    ensurePrograms(FIGURE_ATLAS_PROGRAMS);
    const R = renderTarget('figAtlas', FIGURE_ATLAS_W, FIGURE_ATLAS_H, { colors: 1, nearest: true });
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.f);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    A.T = { t: R.c, n: R.cs[0], w: FIGURE_ATLAS_W, h: FIGURE_ATLAS_H, nDone: true, atlas: true };
    A.pack = atlasPackNew(FIGURE_ATLAS_W, FIGURE_ATLAS_H, 1);
    A.scratch = [0, 0];
    A.res = new Map();
    A.resBytes = 0;
    A.quad = gpuVao('meshes');
    gl.bindVertexArray(A.quad);
    const qb = gpuBuffer('meshes', 48);
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    A.markBuf = gpuBuffer('meshes', 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, A.markBuf);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
    figureRampMake();
    /* every person is drawn again into their new cell */
    for (const E of A.live) {
      E.cell = null;
      E.drawnKey = '';
      E.drawn = false;
    }
    A.gen = gpuState.gen;
    return true;
  } catch (e) {
    A.failed = String((e && e.message) || e);
    if (typeof debugLog !== 'undefined') debugLog.add('figures', 'atlas: ' + A.failed);
    return false;
  }
}
/** the ramp texture, with every row kept so far (a new context gets them all again) */
function figureRampMake() {
  const gl = gpuState.gl,
    M = figureAtlas.ramp;
  M.tex = gpuTexture('pictures', FIGURE_RAMP_W * FIGURE_RAMP_ROWS * 4);
  gl.bindTexture(gl.TEXTURE_2D, M.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, FIGURE_RAMP_W, FIGURE_RAMP_ROWS, 0, gl.RGBA, gl.UNSIGNED_BYTE, M.data);
  setTextureParams({});
  M.dirty = false;
}
/** a figure's colours' rows of the ramp in a direction (figures.js figurePalette's five shades each), added once */
function figureRampRows(Fig, R, style) {
  const A = figureAtlas,
    k = Fig.name + '|' + style;
  let rows = A.rowsOf.get(k);
  if (rows) return rows;
  const LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel,
    pal = figurePalette(Fig.F, R.colours, LK.ramp, LK),
    M = A.ramp;
  rows = new Float32Array(FIGURE_PAL_MAX);
  for (let i = 0; i < R.colours.length; i++) {
    const skin = R.colours[i] === 'skin' ? 255 : 0,
      shades = Array.from(pal.subarray(i * 15, i * 15 + 15), v => Math.max(0, Math.min(255, Math.round(v)))),
      key = shades.join(',') + '|' + skin;
    let row = M.rows.get(key);
    if (row === undefined) {
      if (M.n >= FIGURE_RAMP_ROWS) {
        /* full (many looks in many styles): start again; every figure takes its rows again */
        M.rows.clear();
        A.rowsOf.clear();
        M.n = 1;
        M.data.fill(0);
        figureAtlasRedrawAll();
        return figureRampRows(Fig, R, style);
      }
      row = M.n++;
      M.rows.set(key, row);
      const o = row * FIGURE_RAMP_W * 4;
      for (let s = 0; s < 5; s++) M.data.set([shades[s * 3], shades[s * 3 + 1], shades[s * 3 + 2], 255], o + s * 4);
      M.data.set([skin, 0, 0, 255], o + 20);
      M.dirty = true;
    }
    rows[i] = row;
  }
  A.rowsOf.set(k, rows);
  return rows;
}
/** every person drawn again on their next picture (the ramp started again) */
function figureAtlasRedrawAll() {
  for (const E of figureAtlas.live) E.drawnKey = '';
}
/** a figure's buffers on the game's context: its mesh from the helper thread (figure-meshes.js); null until then */
function figureAtlasRes(Fig, detail) {
  const A = figureAtlas,
    key = Fig.name + '|' + detail;
  let R = A.res.get(key);
  if (R) {
    R.seen = A.frame;
    return R;
  }
  const M = figureMeshGet(key, Fig.F, detail);
  if (!M) return null;
  const gl = gpuState.gl,
    vao = gpuVao('meshes'),
    buf = gpuBuffer('meshes', M.data.byteLength);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, M.data, gl.STATIC_DRAW);
  /* x y z, the normal, its joint, its colour (FIGURE_VS's locations) */
  [
    [0, 3, 0],
    [1, 3, 3],
    [2, 1, 6],
    [3, 1, 7],
  ].forEach(([loc, n, at]) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 32, at * 4);
  });
  gl.disableVertexAttribArray(4);
  gl.bindVertexArray(null);
  R = { vao, buf, count: M.count, colours: M.colours, slots: M.slots, bytes: M.data.byteLength, seen: A.frame };
  A.res.set(key, R);
  A.resBytes += R.bytes;
  return R;
}
/** past FIGURE_ATLAS_MESH_BYTES, the meshes unused the longest (never one used this frame) are freed */
function figureAtlasTrim() {
  const A = figureAtlas;
  if (A.resBytes <= FIGURE_ATLAS_MESH_BYTES) return;
  const old = [...A.res].filter(([, R]) => R.seen < A.frame).sort((a, b) => a[1].seen - b[1].seen);
  for (const [k, R] of old) {
    if (A.resBytes <= FIGURE_ATLAS_MESH_BYTES) break;
    gpuFree(R.vao);
    gpuFree(R.buf);
    A.res.delete(k);
    A.resBytes -= R.bytes;
    A.trimmed++;
  }
}
/** the detail a figure is meshed at for a direction and density (figures.js bakeFigure's) */
function figureAtlasDetail(style, ppm) {
  const LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel;
  return (ppm >= 90 ? 2.5 : 1) * (LK.detail || 1);
}
/**
 * a person's picture in the atlas this frame (figures.js figurePicture, with the atlas on): one object kept against
 * `rec`, drawn into its cell by figureAtlasPass when it changes; null when it can't be shown yet (no mesh, a full
 * atlas: the caller keeps the person's last picture)
 */
function figureAtlasPicture(rec, Fig, clip, frame, V, steps, ppm, outline, style, face = null) {
  const A = figureAtlas;
  if (!rec || typeof rec !== 'object' || Fig.kind !== 'code' || !figureAtlasReady()) return null;
  let E = A.byRec.get(rec);
  if (!E) {
    E = {
      pic: { width: 0, height: 0, ax: 0, ay: 0, ppm, figure: '', atlasT: A.T, figAtlas: true, uv: [0, 0, 1, 1] },
      cell: null,
      key: '',
      drawnKey: '',
      drawn: false,
      seen: 0,
      job: null,
    };
    A.byRec.set(rec, E);
  }
  A.live.add(E);
  E.seen = A.frame;
  E.pic.atlasT = A.T;
  /* CH-6: a new face (a mouth while talking, a blink) draws the cell again */
  const key =
    figureKey(Fig.name, clip, frame, V, steps, ppm, outline, style) + (face && face.key ? '|' + face.key : '');
  if (key !== E.drawnKey) {
    /* the mesh first: without it the cell can't be drawn (the last picture stays, or the caller's) */
    if (!figureAtlasRes(Fig, figureAtlasDetail(style, ppm))) return E.drawn ? E.pic : null;
    const S = cardSize(ppm, V.tilt, Fig.ext);
    E.job = { Fig, clip, frame, V, ppm, outline, style, S, key, face };
    A.queue.add(E);
  }
  return E.drawn || A.queue.has(E) ? E.pic : null;
}
/** a cell of w x h for a person: theirs if it fits, else a new one (people out of view give theirs back first) */
function figureAtlasCell(E, w, h) {
  const A = figureAtlas;
  if (E.cell && E.cell.w === w && E.cell.h === h) return E.cell;
  if (E.cell) atlasPackFree(A.pack, E.cell);
  E.cell = atlasPackAdd(A.pack, w, h);
  if (!E.cell) {
    A.full++;
    for (const O of A.live)
      if (O !== E && O.seen < A.frame && O.cell) {
        atlasPackFree(A.pack, O.cell);
        O.cell = null;
        O.drawn = false;
        O.drawnKey = '';
      }
    E.cell = atlasPackAdd(A.pack, w, h);
  }
  return E.cell;
}
/**
 * CH-4: the frame's figures into the atlas (walk-view-gl.js, after the items are gathered and before the shadow
 * passes): each person whose picture changed drawn into their cell, the face marks over them, and those long out of
 * view let go. Leaves the default framebuffer bound.
 */
export function figureAtlasPass() {
  const A = figureAtlas;
  A.frame++;
  if (!A.T || A.gen !== gpuState.gen) {
    A.queue.clear();
    return;
  }
  /* the ones out of view a while give their cells back */
  for (const E of A.live)
    if (A.frame - E.seen > FIGURE_ATLAS_KEEP) {
      if (E.cell) atlasPackFree(A.pack, E.cell);
      E.cell = null;
      E.drawn = false;
      E.drawnKey = '';
      A.live.delete(E);
    }
  figureAtlasTrim();
  if (!A.queue.size) return;
  const gl = gpuState.gl,
    t0 = performance.now();
  if (A.ramp.dirty) {
    gl.bindTexture(gl.TEXTURE_2D, A.ramp.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FIGURE_RAMP_W, FIGURE_RAMP_ROWS, gl.RGBA, gl.UNSIGNED_BYTE, A.ramp.data);
    A.ramp.dirty = false;
  }
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  gl.enable(gl.SCISSOR_TEST);
  A.marks.length = 0;
  for (const E of A.queue)
    try {
      figureAtlasDraw(E);
    } catch (e) {
      A.failed = String((e && e.message) || e);
      if (typeof debugLog !== 'undefined') debugLog.add('figures', 'atlas: ' + A.failed);
      break;
    }
  A.queue.clear();
  figureAtlasMarks();
  gl.disable(gl.SCISSOR_TEST);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.bindVertexArray(null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.activeTexture(gl.TEXTURE0);
  A.ms += performance.now() - t0;
}
/** one person's picture into their cell (passes 1 and 2) and their face's marks queued */
function figureAtlasDraw(E) {
  const A = figureAtlas,
    gl = gpuState.gl,
    J0 = E.job,
    { Fig, S } = J0,
    R = figureAtlasRes(Fig, figureAtlasDetail(J0.style, J0.ppm)),
    cell = R && figureAtlasCell(E, S.w, S.h);
  if (!R || !cell) return;
  const LK = FIGURE_LOOKS[J0.style] || FIGURE_LOOKS.pixel,
    pose = figurePose(Fig.F, J0.clip, J0.frame),
    J = jointMatrices(Fig.F, pose, J0.ppm),
    JG = figureSlotMatrices(J, R.slots),
    rows = figureRampRows(Fig, R, J0.style),
    c = Math.cos(J0.V.rel),
    s = Math.sin(J0.V.rel);
  /* the scratch target, grown to the biggest picture yet (in steps, so it is rarely made again) */
  if (S.w > A.scratch[0] || S.h > A.scratch[1])
    A.scratch = [Math.max(A.scratch[0], Math.ceil(S.w / 64) * 64), Math.max(A.scratch[1], Math.ceil(S.h / 64) * 64)];
  const W = renderTarget('figScratch', A.scratch[0], A.scratch[1], { colors: 1, depth: true, nearest: true }),
    P1 = gpuState.P.figAtlas,
    P2 = gpuState.P.figCell;
  /* pass 1 */
  gl.bindFramebuffer(gl.FRAMEBUFFER, W.f);
  gl.viewport(0, 0, S.w, S.h);
  gl.scissor(0, 0, S.w, S.h);
  gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
  gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]);
  gl.clearBufferfv(gl.DEPTH, 0, [1]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LESS);
  gl.depthMask(true);
  gl.useProgram(P1.p);
  gl.uniformMatrix4fv(P1.U.uJ, false, JG);
  gl.uniformMatrix4fv(P1.U.uM, false, figureClipMatrix(J0.V.rel, J0.V.tilt, J0.ppm, S));
  gl.uniformMatrix3fv(P1.U.uR, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]));
  gl.uniform1fv(P1.U.uRow, rows);
  gl.uniform1f(P1.U.uH, Fig.height || 1.7);
  gl.bindVertexArray(R.vao);
  gl.drawArrays(gl.TRIANGLES, 0, R.count);
  /* pass 2, into the cell */
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget('figAtlas', FIGURE_ATLAS_W, FIGURE_ATLAS_H).f);
  gl.viewport(cell.x, cell.y, S.w, S.h);
  gl.scissor(cell.x, cell.y, S.w, S.h);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(P2.p);
  for (const [u, t] of [
    [0, W.c],
    [1, W.cs[0]],
    [2, A.ramp.tex],
  ]) {
    gl.activeTexture(gl.TEXTURE0 + u);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.bindSampler(u, null);
  }
  const U = P2.U;
  gl.uniform1i(U.uT0, 0);
  gl.uniform1i(U.uT1, 1);
  gl.uniform1i(U.uRamp, 2);
  gl.uniform2i(U.uS, S.w, S.h);
  gl.uniform2i(U.uO, cell.x, cell.y);
  gl.uniform1f(U.uOut, J0.outline && LK.outline > 0 ? 1 : 0);
  gl.uniform1i(U.uOutW, Math.max(1, LK.outline));
  gl.uniform1f(U.uInk, LK.ink || 0);
  gl.uniform1f(U.uInner, LK.inner || 0);
  gl.uniform1f(U.uAO, LK.ao || 0);
  gl.uniform1f(U.uM7, LK.mode === 7 ? 1 : 0);
  gl.uniform4fv(U.uFx, new Float32Array(LK.fx || [0, 0, 0, 0]));
  gl.uniform3f(U.uOL, OUTLINE_RGB[0] / 255, OUTLINE_RGB[1] / 255, OUTLINE_RGB[2] / 255);
  gl.bindVertexArray(A.quad);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  /* the face's marks (logic/figure-pose.js figureFaceMarks), painted as the baker paints them, as rects */
  let col = [0, 0, 0];
  const M = A.marks,
    x = {
      fillRect: (
        /** @type {number} */ mx,
        /** @type {number} */ my,
        /** @type {number} */ w,
        /** @type {number} */ h
      ) => M.push(cell.x + mx, cell.y + my, w, h, col[0] / 255, col[1] / 255, col[2] / 255),
    };
  for (const m of figureFaceMarks(Fig.F, J, pose, J0.V, J0.ppm, S, J0.face)) {
    col = m.rgb;
    figurePaintMark(x, m, J0.ppm);
  }
  /* the picture as the sprites take it */
  const p = E.pic;
  p.width = S.w;
  p.height = S.h;
  p.ax = S.ax;
  p.ay = S.ay;
  p.ppm = J0.ppm;
  p.figure = Fig.name;
  p.uv[0] = cell.x / FIGURE_ATLAS_W;
  p.uv[1] = cell.y / FIGURE_ATLAS_H;
  p.uv[2] = S.w / FIGURE_ATLAS_W;
  p.uv[3] = S.h / FIGURE_ATLAS_H;
  E.drawnKey = J0.key;
  E.drawn = true;
  E.job = null;
  A.draws++;
  if (J0.face && J0.face.key) A.faceDraws++;
}
/** the frame's face marks over their cells, in one draw */
function figureAtlasMarks() {
  const A = figureAtlas,
    n = A.marks.length / 7;
  if (!n) return;
  const gl = gpuState.gl,
    P = gpuState.P.figMark;
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget('figAtlas', FIGURE_ATLAS_W, FIGURE_ATLAS_H).f);
  gl.viewport(0, 0, FIGURE_ATLAS_W, FIGURE_ATLAS_H);
  gl.disable(gl.SCISSOR_TEST);
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(P.p);
  gl.uniform2f(P.U.uA, FIGURE_ATLAS_W, FIGURE_ATLAS_H);
  gl.bindVertexArray(A.quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, A.markBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(A.marks), gl.DYNAMIC_DRAW);
  gpuSized(A.markBuf, A.marks.length * 4);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
}
/**
 * the figure light's uniforms for a sprite program (walk-shaders.js FIGURE_SPRITE_GLSL), each frame it draws: the
 * ramp on FIGURE_RAMP_UNIT, the direction's bands and effects, how dark it is, and the lights a figure isn't lit by
 * (pools on the ground, the lantern you carry: walk/lighting.js) as a mask of their places in the frame's lights
 */
function figureSpriteUniforms(p, X) {
  const U = p.U;
  if (U.uFigRamp == null) return;
  const gl = gpuState.gl,
    style = typeof figureStyle === 'function' ? figureStyle() : 'gnight',
    LK = FIGURE_LOOKS[style] || FIGURE_LOOKS.pixel,
    BD = LK.bands || FIGURE_BANDS,
    L = (X && X.lights) || [];
  gl.activeTexture(gl.TEXTURE0 + FIGURE_RAMP_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, figureAtlas.ramp.tex);
  gl.bindSampler(FIGURE_RAMP_UNIT, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(U.uFigRamp, FIGURE_RAMP_UNIT);
  gl.uniform4f(U.uFigB, BD.light, BD.base, BD.shine, BD.deep);
  gl.uniform4fv(U.uFigFx, new Float32Array(LK.fx || [0, 0, 0, 0]));
  const r2 = LK.rim2 || [0, 0, 1, 0];
  gl.uniform2f(U.uFigMode, LK.mode || 0, r2[3]);
  let skip = 0;
  for (let i = 0; i < Math.min(16, L.length); i++) if (L[i].pool || L[i].src === 'lantern') skip |= 1 << i;
  gl.uniform1i(U.uFigSkip, skip);
  const E =
    typeof environment !== 'undefined' && typeof engineContext !== 'undefined' && engineContext.env
      ? environment
      : null;
  gl.uniform1f(
    U.uFigDark,
    X && X.sun && X.sun.room ? 0.4 : E ? Math.max(0, Math.min(1, Math.max(E.lampK || 0, E.night || 0))) : 0
  );
}
/** the atlas's numbers for the debug log's people section (numbers only) */
function figureAtlasReport() {
  const A = figureAtlas;
  return {
    on: figureAtlasOn(),
    failed: A.failed || null,
    people: A.live.size,
    cells: A.pack ? A.pack.cells : 0,
    use: A.pack ? Math.round(atlasPackUse(A.pack) * 100) / 100 : 0,
    rows: A.ramp.n - 1,
    figures: A.res.size,
    meshMb: Math.round((A.resBytes / 1048576) * 10) / 10,
    trimmed: A.trimmed,
    draws: A.draws,
    faceDraws: A.faceDraws,
    ms: Math.round(A.ms * 10) / 10,
    full: A.full,
    mb: Math.round(((FIGURE_ATLAS_W * FIGURE_ATLAS_H * 8) / 1048576) * 10) / 10,
  };
}
/* a lost context: the atlas's GL objects are made again on next use (figureAtlasReady sees the new generation) */
if (typeof gpuOnRestore === 'function')
  gpuOnRestore('figure atlas', () => {
    figureAtlas.gen = -1;
    figureAtlas.T = null;
    figureAtlas.res = new Map();
    figureAtlas.resBytes = 0;
    figureAtlas.queue.clear();
  });
