'use strict';
/* ================= THE FIGURE BAKER (characters track CH-2, the spike; Engine > People > Figures, off) =================
   People as small 3D figures of jointed rigid parts, drawn into pixel pictures that go down today's sprite path. A
   figure is built in code (logic/figure-pose.js: the mannequin, its poses) or made from a rigged model by
   tools/gltf-figure.mjs (CH-3: game/art/figures/*.json and their palette-snapped textures; each vertex on its
   strongest joint, the model's clips sampled on the 12 fps clock). A baked picture is a plain canvas tagged as a person's
   (`ax`, `ay` the ground point, `ppm` its pixels a metre, `noNormal` the flat light people have), so the sprites,
   their shadows, AO, fog, the reflection, the outline round you and the person counters take it as they take a
   person-art.js frame, and nothing else in the renderer changes.
   - The baker draws in its own small WebGL2 context (the owner's pick: kept apart from the game's renderer state).
     Pass 1 draws the figure with its depth into a texture: each face in one of three toon bands from a top-left light,
     the scene props' ramps (a code figure's from its palette, a model's from its texture); the depth goes in alpha.
     Pass 2, at the same pixels: the dark plum outline round it (each outside pixel next to the figure takes the
     outline of its colour, as tools/build-scene-props.py olc) and inside it where a part stands well in front of
     another. Then the pixels go to a 2D canvas, and a code figure's face is painted on it in whole pixels (eyes,
     mouth, blush: logic/figure-pose.js figureFaceMarks).
   - Two styles (Engine > People > Style): 'pixel', the pixel puppet (C) described here, and 'smooth', the plain 3D
     figure (B): a soft light and no outline, baked at FIGURE_SMOOTH_PPM and left to the GPU's mipmaps.
   - Pictures are kept by figure, clip, frame, the view's steps, the density, the outline and the style (figureKey):
     at most FIGURE_CACHE_MAX of them and FIGURE_CACHE_BYTES. One is baked a frame, up to FIGURE_BAKES_A_FRAME while
     the frame's work budget lasts; until then a person keeps their last picture (or today's, or none on a test map).
   - A lost baker context bakes nothing until it is back, then rebuilds; the game's own lost context only drops the
     textures, and the canvases are uploaded again. figureBakerLose forces a loss for the checks.
   The renderer never calls this with the switch off, and a model's file is only fetched when one is first wanted. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { PEOPLE, provide } from './hooks.js';
import {
  FIGURE_BANDS,
  FIGURE_LIGHT,
  FIGURE_PAL_MAX,
  OUTLINE_RGB,
  cardSize,
  clipFrameAt,
  codeExtent,
  figureClipMatrix,
  figureFaceMarks,
  figureKey,
  figureMesh,
  figurePose,
  figureRamp,
  figureTick,
  figureView,
  jointMatrices,
  mannequinFigure,
  meshClipFrame,
  meshClipMatrices,
} from './logic/figure-pose.js';
import { figureSeed, kappiFigure, kitExtent, lookFigure } from './logic/figure-kit.js';
import { artImg, artURL, makeCanvas } from './art.js';
import { lookOf, wardrobeData } from './person-art.js';
import { RUN_FACTOR, WALK_SPEED, seenYaw, walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { gpuState } from './engine/webgl.js';
import { frameBudgetLeft } from './walk/quality-cull.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_BAKES_A_FRAME: [() => FIGURE_BAKES_A_FRAME],
  FIGURE_BATTLE_PPM: [() => FIGURE_BATTLE_PPM],
  FIGURE_CACHE: [() => FIGURE_CACHE],
  FIGURE_CACHE_BYTES: [() => FIGURE_CACHE_BYTES],
  FIGURE_CACHE_MAX: [() => FIGURE_CACHE_MAX],
  FIGURE_DEFS: [() => FIGURE_DEFS],
  FIGURE_FILES: [() => FIGURE_FILES],
  FIGURE_FS: [() => FIGURE_FS],
  FIGURE_LOOK_NAMES: [() => FIGURE_LOOK_NAMES],
  FIGURE_OUT_FS: [() => FIGURE_OUT_FS],
  FIGURE_OUT_VS: [() => FIGURE_OUT_VS],
  FIGURE_PORTRAIT_PPM: [() => FIGURE_PORTRAIT_PPM],
  FIGURE_SHADOW_FS: [() => FIGURE_SHADOW_FS],
  FIGURE_SHADOW_SIZE: [() => FIGURE_SHADOW_SIZE],
  FIGURE_SHADOW_VS: [() => FIGURE_SHADOW_VS],
  FIGURE_SMOOTH_PPM: [() => FIGURE_SMOOTH_PPM],
  FIGURE_TEXTURES: [() => FIGURE_TEXTURES],
  FIGURE_VS: [() => FIGURE_VS],
  bakeFigure: [() => bakeFigure, v => (bakeFigure = v)],
  figureBaker: [() => figureBaker],
  figureBakerLose: [() => figureBakerLose, v => (figureBakerLose = v)],
  figureBattlePicture: [() => figureBattlePicture, v => ((figureBattlePicture = v), provide({ figureBattlePicture }))],
  figureBuild: [() => figureBuild, v => (figureBuild = v)],
  figureBytes: [() => figureBytes, v => (figureBytes = v)],
  figureCacheClear: [() => figureCacheClear, v => (figureCacheClear = v)],
  figureChoice: [() => figureChoice, v => (figureChoice = v)],
  figureCompile: [() => figureCompile, v => (figureCompile = v)],
  figureDef: [() => figureDef, v => (figureDef = v)],
  figureFolk: [() => figureFolk, v => ((figureFolk = v), provide({ figureFolk }))],
  figureFor: [() => figureFor, v => (figureFor = v)],
  figureFromFile: [() => figureFromFile, v => (figureFromFile = v)],
  figureGait: [() => figureGait],
  figureGl: [() => figureGl, v => (figureGl = v)],
  figureItems: [() => figureItems, v => (figureItems = v)],
  figureLast: [() => figureLast],
  figureLightSpace: [() => figureLightSpace, v => (figureLightSpace = v)],
  figureLoad: [() => figureLoad, v => (figureLoad = v)],
  figurePaintMark: [() => figurePaintMark, v => (figurePaintMark = v)],
  figurePalette: [() => figurePalette, v => (figurePalette = v)],
  figurePersonPicture: [() => figurePersonPicture, v => (figurePersonPicture = v)],
  figurePicture: [() => figurePicture, v => (figurePicture = v)],
  figurePortrait: [() => figurePortrait, v => (figurePortrait = v)],
  figureReport: [() => figureReport, v => (figureReport = v)],
  figureRes: [() => figureRes, v => (figureRes = v)],
  figureStyle: [() => figureStyle, v => (figureStyle = v)],
  figureTarget: [() => figureTarget, v => (figureTarget = v)],
  figureTilt: [() => figureTilt, v => (figureTilt = v)],
  figuresOn: [() => figuresOn, v => ((figuresOn = v), provide({ figuresOn }))],
});
/* eslint-enable no-func-assign */
provide({ figureBattlePicture, figureFolk, figuresOn });
/* to-module: end */
const FIGURE_CACHE_MAX = 600,
  /** and at most this many bytes of them (a plain 3D picture at 128 px a metre is about 340 KB, a pixel one 23 KB) */
  FIGURE_CACHE_BYTES = 48 * 1048576,
  FIGURE_BAKES_A_FRAME = 4,
  /** the plain 3D figure (B, the style "smooth") is baked this fine and left to the GPU's mipmaps to smooth */
  FIGURE_SMOOTH_PPM = 128,
  /** figures in battle, where a trainer stands 150 CSS px tall: twice the world's 48 (CH-3b: the owner's "high
   * resolution"; CH-3 baked them at 64) */
  FIGURE_BATTLE_PPM = 96;
/** the figures made from models (tools/gltf-figure.mjs; their CC0 sources in validation/cc0-src/LICENSES.md), each
 * a JSON file and its texture */
const FIGURE_FILES = { rogue: 'figures/rogue.json' };
const FIGURE_TEXTURES = { rogue: 'figures/rogue.png' };
/** the baker: its canvas and context, programs, each figure's buffers and texture, and counts (debug log: people) */
const figureBaker = {
  cv: null,
  gl: null,
  ready: false,
  lost: 0,
  failed: '',
  P: null,
  O: null,
  Sh: null,
  smTex: null,
  smFb: null,
  oVao: null,
  fb: null,
  tex: null,
  depth: null,
  size: [0, 0],
  res: new Map(),
  bakes: 0,
  ms: 0,
  bytes: 0,
  losses: 0,
  frame: -1,
  frameBakes: 0,
};
const FIGURE_CACHE = new Map();
/** each person's last picture (a runtime record or a test map's lineup entry; nothing is written on them) */
const figureLast = new WeakMap();
/** the figures by name: a code figure at once; a model's once its file is in (null while it loads, false if it can't) */
const FIGURE_DEFS = {};

/** whether people are drawn as figures (Engine > People > Figures) */
export function figuresOn() {
  return typeof engineSetting === 'function' && !!engineSetting('people', 'figures');
}
/** the figure you are (Engine > People > Your figure): 'look', your own look through the figure kit (CH-3b), or
 * the spike's mannequin or stand-in */
function figureChoice() {
  const v = typeof engineSetting === 'function' ? engineSetting('people', 'figure') : null;
  return v === 'mannequin' || v in FIGURE_FILES ? v : 'look';
}
/** the figures' names by who (an NPC's look never changes; yours is keyed by the look itself, so the dressing room's
 * changes make a new figure) */
const FIGURE_LOOK_NAMES = new Map();
/**
 * the figure a person is drawn as (CH-3b): `look:<who>` for anyone with a look (people/<id>.json, a townsperson's
 * 'folk:<seed>', a friend), `look:me#<look>` for you ('boy', 'girl' or 'me'), or the spike's figure for you when
 * Engine > People > Your figure picks one
 */
export function figureFor(who) {
  if (who === 'boy' || who === 'girl' || who === 'me') {
    const c = figureChoice();
    if (c !== 'look') return c;
    const L = typeof lookOf === 'function' ? lookOf('me') : null;
    return 'look:me#' + figureSeed(JSON.stringify(L || {})).toString(36);
  }
  let n = FIGURE_LOOK_NAMES.get(who);
  if (!n) FIGURE_LOOK_NAMES.set(who, (n = 'look:' + who));
  return n;
}
/** how figures are drawn (Engine > People > Style): 'pixel' (the pixel puppet, C) or 'smooth' (the plain 3D figure, B) */
export function figureStyle() {
  return typeof engineSetting === 'function' && engineSetting('people', 'style') === 'smooth' ? 'smooth' : 'pixel';
}
/** whether townsfolk are drawn as figures too (Engine > People > Townsfolk as figures) */
export function figureFolk() {
  return typeof engineSetting === 'function' && !!engineSetting('people', 'folk');
}
/** a figure by name: null while its file loads, false if there is none */
function figureDef(name) {
  if (name in FIGURE_DEFS) return FIGURE_DEFS[name];
  if (name === 'mannequin') {
    const F = mannequinFigure();
    return (FIGURE_DEFS[name] = { kind: 'code', name, F, height: F.height, ext: codeExtent(F.height) });
  }
  /* CH-3b: a person's figure from their look (logic/figure-kit.js); Kappi, a creature person, as a capybara */
  if (name.startsWith('look:')) {
    const who = name.slice(5).split('#')[0],
      L = typeof lookOf === 'function' ? lookOf(who) : null,
      items = figureItems();
    if (!L || (!L.creature && !items)) return null;
    const p = typeof PEOPLE !== 'undefined' && PEOPLE[who],
      /* the owner (2026-10-28): no backpack unless the person's own look has a bag (the wardrobe gives everyone one
         by default: person-art.js DEFAULT_WEAR); townsfolk and you keep the bag their look picked */
      own = p && p.look && p.look.wear,
      look = own && !own.bag && L.wear ? { ...L, wear: { ...L.wear, bag: null } } : L,
      F = L.creature
        ? kappiFigure({ name })
        : lookFigure(look, items, {
            name,
            seed: figureSeed(who),
            figure: p && p.figure ? p.figure : who.startsWith('folk:') ? { variety: true } : undefined,
          });
    return (FIGURE_DEFS[name] = { kind: 'code', name, F, height: F.height, ext: kitExtent(F) });
  }
  if (!(name in FIGURE_FILES)) return (FIGURE_DEFS[name] = false);
  FIGURE_DEFS[name] = null;
  figureLoad(name);
  return null;
}
/** the wardrobe's items (their default colours), for the figure kit; null before the game data is in */
function figureItems() {
  const W = typeof wardrobeData === 'function' ? wardrobeData() : null;
  return W ? W.items : null;
}
/** a figure's file, fetched once (inline in a single-file build: a data: link, decoded here) */
function figureLoad(name) {
  const path = FIGURE_FILES[name],
    url = typeof artURL === 'function' ? artURL(path) : 'art/' + path,
    done = j => {
      try {
        FIGURE_DEFS[name] = j ? figureFromFile(name, j) : false;
      } catch (e) {
        FIGURE_DEFS[name] = false;
        if (typeof debugLog !== 'undefined') debugLog.add('figures', name + ': ' + ((e && e.message) || e));
      }
      if (!FIGURE_DEFS[name] && typeof debugLog !== 'undefined') debugLog.add('figures', name + ': not loaded');
    };
  if (url.startsWith('data:')) {
    const c = url.indexOf(','),
      body = url.slice(c + 1);
    try {
      done(
        JSON.parse(
          /;base64/.test(url.slice(5, c)) ? new TextDecoder().decode(figureBytes(body)) : decodeURIComponent(body)
        )
      );
    } catch (e) {
      done(null);
    }
    return;
  }
  fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(done, () => done(null));
}
/** base64 to bytes */
function figureBytes(b64) {
  const s = atob(b64),
    u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
/** a figure from its file (tools/gltf-figure.mjs, format 1): its mesh, joints, clips, extent and texture */
function figureFromFile(name, j) {
  if (j.format !== 1) throw new Error('figure format ' + j.format);
  const clips = {};
  for (const [k, c] of Object.entries(j.clips || {}))
    clips[k] = { ...c, mats: new Float32Array(figureBytes(c.matrices).buffer) };
  return {
    kind: 'mesh',
    name,
    height: j.height,
    joints: j.joints,
    ext: j.extent,
    data: new Float32Array(figureBytes(j.vertices).buffer),
    index: new Uint16Array(figureBytes(j.indices).buffer),
    clips,
    tex: typeof artImg === 'function' ? artImg(FIGURE_TEXTURES[name] || j.texture) : null,
  };
}

const FIGURE_VS = `#version 300 es
layout(location=0) in vec3 aP;layout(location=1) in vec3 aN;layout(location=2) in float aJ;layout(location=3) in float aC;
layout(location=4) in vec2 aUV;uniform mat4 uJ[32];uniform mat4 uM;uniform mat3 uR;uniform mat4 uLS;
out vec3 vN;out vec2 vUV;out vec3 vLS;flat out int vC;
void main(){mat4 J=uJ[int(aJ)];vec4 w=J*vec4(aP,1.);vN=uR*(mat3(J)*aN);vC=int(aC);vUV=aUV;
 vLS=(uLS*vec4(uR*w.xyz+vN*.03,1.)).xyz;gl_Position=uM*w;}`;
/* CH-3b's fidelity pass: the figure's depth seen from the light, so parts shade each other (hair on the brow, the
   head on the neck, an arm on the body) */
const FIGURE_SHADOW_VS = `#version 300 es
layout(location=0) in vec3 aP;layout(location=2) in float aJ;uniform mat4 uJ[32];uniform mat3 uR;uniform mat4 uLS;
void main(){gl_Position=uLS*vec4(uR*(uJ[int(aJ)]*vec4(aP,1.)).xyz,1.);}`;
const FIGURE_SHADOW_FS = `#version 300 es
precision mediump float;out vec4 o;void main(){o=vec4(1.);}`;
/* a code figure's colours come from its palette (its ramps); a model's from its texture, ramped here as the props'
   ramp does it (logic/figure-pose.js figureRamp: the shadow darker and lavender, the light warmer). Smooth (the plain
   3D figure): a soft light, no bands */
const FIGURE_FS = `#version 300 es
precision highp float;in vec3 vN;in vec2 vUV;in vec3 vLS;flat in int vC;uniform vec3 uPal[100];uniform vec3 uL;uniform vec4 uB;
uniform float uTexOn,uSmooth,uShadowOn;uniform sampler2D uTx;uniform highp sampler2D uSM;out vec4 o;
void main(){vec3 n=normalize(vN);float d=dot(n,uL);int b=d>uB.z?3:(d>uB.x?2:(d>uB.y?1:(d>uB.w?0:-1)));
 /* a part in another's shadow (the light's depth map) drops to the shadow tone */
 bool shd=false;
 if(uShadowOn>.5&&b>0){vec3 q=vLS*.5+.5;shd=q.x>0.&&q.y>0.&&q.x<1.&&q.y<1.&&q.z-.006>texture(uSM,q.xy).r;}
 if(shd)b=0;
 /* a rim of light along the lit edge seen side-on (n.z: into the view) */
 else if(b>=0&&n.z>-.25&&dot(normalize(n.xy+1e-4),normalize(uL.xy))>.55)b=max(b,2);
 vec3 base,sh,li,sn,dp;
 if(uTexOn>.5){base=floor(texture(uTx,vUV).rgb*255.+.5);sh=mix(floor(base*.79),vec3(96.,74.,152.),.17);li=mix(base,vec3(255.,244.,196.),.3);sn=li;dp=mix(floor(base*.55),vec3(60.,42.,112.),.3);}
 else{dp=uPal[vC*5];sh=uPal[vC*5+1];base=uPal[vC*5+2];li=uPal[vC*5+3];sn=uPal[vC*5+4];}
 vec3 c=uSmooth>.5?base*clamp(.62+.5*d,.35,1.12):(b==3?sn:(b==2?li:(b==1?base:(b==0?sh:dp))));
/* the depth, nearer larger, in alpha: 0 is no figure */
o=vec4(c/255.,mix(1.,.08,gl_FragCoord.z));}`;
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
 if(uOut>.5){bool line=false;for(int i=0;i<4;i++)if(q[i].a>c.a+.016)line=true;if(line)o.rgb=mix(c.rgb,olc(c.rgb),.6);}}`;

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
/** the programs, the screen quad and the pass-1 target, on a new or restored context (each figure's own buffers and
 * texture are made again the next time it is baked) */
function figureBuild(gl) {
  const B = figureBaker;
  B.P = figureCompile(gl, FIGURE_VS, FIGURE_FS);
  B.Sh = figureCompile(gl, FIGURE_SHADOW_VS, FIGURE_SHADOW_FS);
  /* the light's depth map: FIGURE_SHADOW_SIZE square, depth only */
  B.smTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, B.smTex);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, FIGURE_SHADOW_SIZE, FIGURE_SHADOW_SIZE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  B.smFb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, B.smFb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, B.smTex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  B.O = figureCompile(gl, FIGURE_OUT_VS, FIGURE_OUT_FS);
  B.res = new Map();
  B.oVao = gl.createVertexArray();
  gl.bindVertexArray(B.oVao);
  const qb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, qb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
  const qa = B.O.a('aQ');
  gl.enableVertexAttribArray(qa);
  gl.vertexAttribPointer(qa, 2, gl.FLOAT, false, 8, 0);
  gl.bindVertexArray(null);
  B.fb = null;
  B.size = [0, 0];
  figureTarget(gl, B.cv.width, B.cv.height);
}
/** a figure's buffers (and a model's texture) in the baker's context; null while a model's texture loads */
function figureRes(gl, Fig, detail = 1) {
  const B = figureBaker,
    key = detail > 1 ? Fig.name + '|fine' : Fig.name;
  let R = B.res.get(key);
  if (R) return R;
  if (Fig.kind === 'mesh' && !(Fig.tex && Fig.tex.complete && Fig.tex.naturalWidth > 0)) return null;
  const code = Fig.kind === 'code',
    M = code ? figureMesh(Fig.F, detail) : null,
    vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, code ? M.data : Fig.data, gl.STATIC_DRAW);
  /* a code figure: x y z, the normal, its joint, its colour (8 numbers); a model: x y z, the normal, its joint, u v (9) */
  const L = code
      ? [
          ['aP', 3, 0],
          ['aN', 3, 3],
          ['aJ', 1, 6],
          ['aC', 1, 7],
        ]
      : [
          ['aP', 3, 0],
          ['aN', 3, 3],
          ['aJ', 1, 6],
          ['aUV', 2, 7],
        ],
    stride = code ? 32 : 36;
  for (const k of ['aP', 'aN', 'aJ', 'aC', 'aUV']) {
    const a = B.P.a(k);
    if (a < 0) continue;
    const l = L.find(x => x[0] === k);
    if (l) {
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, l[1], gl.FLOAT, false, stride, l[2] * 4);
    } else gl.disableVertexAttribArray(a);
  }
  let count = code ? M.count : Fig.index.length,
    tex = null;
  if (!code) {
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Fig.index, gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, Fig.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.bindVertexArray(null);
  R = { vao, count, indexed: !code, tex, colours: code ? M.colours : null };
  B.res.set(key, R);
  return R;
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
/** the light's depth map's size (pixels square) */
const FIGURE_SHADOW_SIZE = 512;
/**
 * the matrix from a figure's turned frame (x to the camera's right, y up, z into the view) to the light's clip space:
 * an orthographic view along the light (FIGURE_LIGHT points to it) round the figure's middle, as big as its extent
 */
function figureLightSpace(ext) {
  const L = FIGURE_LIGHT,
    f = [-L[0], -L[1], -L[2]],
    rr = (() => {
      const x = [f[2], 0, -f[0]],
        l = Math.hypot(x[0], x[2]) || 1;
      return [x[0] / l, 0, x[2] / l];
    })(),
    up = [rr[1] * f[2] - rr[2] * f[1], rr[2] * f[0] - rr[0] * f[2], rr[0] * f[1] - rr[1] * f[0]],
    E = ext || { r: 0.7, top: 1.9, bottom: 0 },
    C = [0, ((E.top || 1.9) + (E.bottom || 0)) / 2, 0],
    H = (E.top || 1.9) * 0.62 + (E.r || 0.7),
    D = H * 1.2,
    row = (/** @type {number[]} */ a, /** @type {number} */ k) => [
      a[0] * k,
      a[1] * k,
      a[2] * k,
      -(a[0] * C[0] + a[1] * C[1] + a[2] * C[2]) * k,
    ],
    X = row(rr, 1 / H),
    Y = row(up, 1 / H),
    Z = row(f, 1 / D);
  return new Float32Array([X[0], Y[0], Z[0], 0, X[1], Y[1], Z[1], 0, X[2], Y[2], Z[2], 0, X[3], Y[3], Z[3], 1]);
}
/** a code figure's palette for the shader: for each colour, its shadow, base and light (the props' ramp) */
function figurePalette(F, colours) {
  /* FIGURE_PAL_MAX colours, five shades each (the shader's uPal[100]): the deep shadow, the shadow, the base, the
     light and the shine, which only a glossy colour (F.gloss: hair, shoes, lenses) has; the rest keep their light */
  const out = new Float32Array(FIGURE_PAL_MAX * 5 * 3),
    gloss = new Set(F.gloss || []);
  colours.forEach((k, i) => {
    const R = figureRamp(F.colours[k]),
      flat = k === 'eye' || k === 'glint';
    [
      flat ? R[2] : R[0],
      flat ? R[2] : R[1],
      R[2],
      flat ? R[2] : R[3],
      flat ? R[2] : gloss.has(k) ? R[4] : R[3],
    ].forEach((c, b) => out.set(c, (i * 5 + b) * 3));
  });
  return out;
}
/**
 * one picture of a figure: its pose at a clip's frame, seen in view V at `ppm` pixels a metre, in a style ('pixel':
 * toon bands and the outline as `outline` says; 'smooth': the plain 3D figure, a soft light and no outline). A canvas
 * tagged as a person's picture, or null if the baker can't draw it now.
 */
function bakeFigure(Fig, clip, frame, V, ppm, outline, style = 'pixel') {
  const gl = figureGl();
  if (!gl) return null;
  /* a close-up (a portrait, a battle) gets a code figure's finer mesh */
  const R = figureRes(gl, Fig, Fig.kind === 'code' && ppm >= 90 ? 2.5 : 1);
  if (!R) return null;
  const B = figureBaker,
    t0 = performance.now(),
    smooth = style === 'smooth',
    S = cardSize(ppm, V.tilt, Fig.ext);
  if (S.w > B.cv.width || S.h > B.cv.height) {
    B.cv.width = Math.max(B.cv.width, S.w);
    B.cv.height = Math.max(B.cv.height, S.h);
  }
  figureTarget(gl, B.cv.width, B.cv.height);
  const code = Fig.kind === 'code',
    pose = code ? figurePose(Fig.F, clip, frame) : null,
    J = code ? jointMatrices(Fig.F, pose, ppm) : meshClipMatrices(Fig.clips[clip], frame, Fig.joints.length, ppm),
    c = Math.cos(V.rel),
    s = Math.sin(V.rel);
  /* pass 0 (CH-3b): the figure's depth from the light, in the figure's turned frame; not for the plain 3D style */
  const LS = figureLightSpace(Fig.ext),
    shadows = !smooth && !!B.Sh;
  if (shadows) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.smFb);
    gl.viewport(0, 0, FIGURE_SHADOW_SIZE, FIGURE_SHADOW_SIZE);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    /* pushed back a little, and looked up 3 cm out along the normal (FIGURE_VS vLS), so a surface doesn't shadow
       itself in speckles */
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    gl.useProgram(B.Sh.p);
    gl.uniformMatrix4fv(B.Sh.U.uJ, false, J);
    gl.uniformMatrix3fv(B.Sh.U.uR, false, new Float32Array([c, 0, -s, 0, 1, 0, s, 0, c]));
    gl.uniformMatrix4fv(B.Sh.U.uLS, false, LS);
    gl.bindVertexArray(R.vao);
    if (R.indexed) gl.drawElements(gl.TRIANGLES, R.count, gl.UNSIGNED_SHORT, 0);
    else gl.drawArrays(gl.TRIANGLES, 0, R.count);
  }
  gl.disable(gl.POLYGON_OFFSET_FILL);
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
  if (code) gl.uniform3fv(U.uPal, figurePalette(Fig.F, R.colours));
  gl.uniform3fv(U.uL, FIGURE_LIGHT);
  gl.uniform4f(U.uB, FIGURE_BANDS.light, FIGURE_BANDS.base, FIGURE_BANDS.shine, FIGURE_BANDS.deep);
  gl.uniformMatrix4fv(U.uLS, false, LS);
  gl.uniform1f(U.uShadowOn, shadows ? 1 : 0);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, shadows ? B.smTex : null);
  gl.uniform1i(U.uSM, 2);
  gl.uniform1f(U.uTexOn, code ? 0 : 1);
  gl.uniform1f(U.uSmooth, smooth ? 1 : 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, R.tex);
  gl.uniform1i(U.uTx, 1);
  gl.bindVertexArray(R.vao);
  if (R.indexed) gl.drawElements(gl.TRIANGLES, R.count, gl.UNSIGNED_SHORT, 0);
  else gl.drawArrays(gl.TRIANGLES, 0, R.count);
  /* pass 2: the outline, to the canvas */
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, S.w, S.h);
  gl.disable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(B.O.p);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, B.tex);
  gl.uniform1i(B.O.U.uT, 0);
  gl.uniform1f(B.O.U.uOut, outline && !smooth ? 1 : 0);
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
  /* a code figure's face, painted in whole pixels where its head faces the camera (logic/figure-pose.js
     figureFaceMarks); a model's face is in its texture */
  if (code)
    for (const m of figureFaceMarks(Fig.F, J, pose, V, ppm, S)) {
      x.fillStyle = `rgb(${m.rgb[0]},${m.rgb[1]},${m.rgb[2]})`;
      figurePaintMark(x, m, ppm);
    }
  out.ax = S.ax;
  out.ay = S.ay;
  out.ppm = ppm;
  out.noNormal = true;
  out.figure = Fig.name;
  B.bakes++;
  B.ms += performance.now() - t0;
  return out;
}
/**
 * a face mark painted in whole pixels (logic/figure-pose.js figureFaceMarks): a block; a hollow one (a glasses frame)
 * its edge only, so the eye shows through; an oval (an eye, a pupil, a shine) or a smile's arc pixel by pixel, the
 * arc as thick as the density allows (a portrait's close-up gets proper shapes, not blocks)
 */
function figurePaintMark(x, m, ppm) {
  const th = Math.max(1, Math.round(0.02 * ppm));
  if (m.shape === 'oval' || m.shape === 'arc' || m.shape === 'cap') {
    /* an arc is the lower rim of an ellipse centred on the mark's top, a cap the upper rim of one centred on its
       bottom, each `th` pixels thick */
    const rx = m.w / 2,
      rim = m.shape !== 'oval',
      ry = rim ? m.h : m.h / 2,
      cy = m.shape === 'arc' ? 0 : m.shape === 'cap' ? m.h : ry;
    for (let j = 0; j < m.h; j++)
      for (let i = 0; i < m.w; i++) {
        const dx = i + 0.5 - rx,
          dy = j + 0.5 - cy,
          out = (dx / rx) ** 2 + (dy / ry) ** 2 <= 1,
          inner = rim && (dx / Math.max(0.5, rx - th)) ** 2 + (dy / Math.max(0.5, ry - th)) ** 2 < 1;
        if (out && !inner) x.fillRect(m.x + i, m.y + j, 1, 1);
      }
    return;
  }
  if (m.hollow && m.w > 2 && m.h > 2) {
    const t = Math.min(th, Math.floor((Math.min(m.w, m.h) - 1) / 2));
    x.fillRect(m.x, m.y, m.w, t);
    x.fillRect(m.x, m.y + m.h - t, m.w, t);
    x.fillRect(m.x, m.y + t, t, m.h - 2 * t);
    x.fillRect(m.x + m.w - t, m.y + t, t, m.h - 2 * t);
    return;
  }
  x.fillRect(m.x, m.y, m.w, m.h);
}
/** CH-3b: a portrait's density (pixels a metre): a head about 120 pixels wide */
const FIGURE_PORTRAIT_PPM = 160;
/**
 * a person's portrait from their figure (the owner: the figures are also the character portraits): their head and
 * shoulders at FIGURE_PORTRAIT_PPM, turned three quarters to the camera with a slight tilt, idling (`frame` 14
 * blinks), cut from the top of their head to a little below the shoulders. A canvas, or null while the figure or the
 * baker isn't ready. Baked every call (a dialogue keeps its own).
 */
function figurePortrait(who, frame = 0, turn = 0.9) {
  const Fig = figureDef(figureFor(who));
  if (!Fig) return null;
  const V = figureView(Math.PI * turn, 0, (12 * Math.PI) / 180, 32),
    im = bakeFigure(Fig, 'idle', frame, V, FIGURE_PORTRAIT_PPM, true, 'pixel');
  if (!im) return null;
  /* from the first row with anything on it (a top hat's crown and all) down to just under the shoulders (the kit's
     `bust`, metres from the ground), or a head and a bit for a figure without one */
  const x = im.getContext('2d'),
    d = x.getImageData(0, 0, im.width, im.height).data;
  let top = 0;
  findTop: for (; top < im.height; top++)
    for (let i = 0; i < im.width; i++) if (d[(top * im.width + i) * 4 + 3] > 0) break findTop;
  /* Kappi (no kit) whole */
  const bust = Fig.F && Fig.F.kit && Fig.F.kit.bust != null ? Fig.F.kit.bust : 0,
    h = Math.max(8, Math.min(im.height - top, Math.round(im.ay - bust * FIGURE_PORTRAIT_PPM) - top)),
    out = makeCanvas(im.width, h);
  out.getContext('2d').drawImage(im, 0, top, im.width, h, 0, 0, im.width, h);
  out.figure = Fig.name;
  return out;
}
/**
 * the picture of a person drawn as a figure this frame, or their last one while it isn't baked yet (null when there
 * is none). `rec` is what the last picture is kept against (a runtime record or a lineup entry, never written to);
 * `heading` the way they face in the world (logic/person-view.js personHeading), `yaw` the camera's turn (seenYaw),
 * `tilt` the camera's tilt, `style` 'pixel' or 'smooth' (the plain 3D figure, baked at FIGURE_SMOOTH_PPM); a pixel
 * figure at `ppmAt` pixels a metre if given (a battle's), else at the dial's.
 */
function figurePicture(rec, name, clip, frame, heading, yaw, tilt, style = 'pixel', ppmAt = 0) {
  const Fig = figureDef(name);
  let im = null;
  if (Fig) {
    const e = k => engineSetting('people', k),
      smooth = style === 'smooth',
      ppm = smooth ? FIGURE_SMOOTH_PPM : ppmAt || Math.max(16, Math.min(64, Math.round(e('density') || 32))),
      ys = e('yawSteps') || 16,
      steps = ys >= 32 ? 32 : ys >= 16 ? 16 : 8,
      outline = !smooth && e('outline') !== false,
      V = figureView(heading, yaw, tilt, steps),
      key = figureKey(Fig.name, clip, frame, V, steps, ppm, outline, smooth ? 'smooth' : 'pixel');
    im = FIGURE_CACHE.get(key) || null;
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
      /* the first bake of a frame always (so a figure shows up), more only while the frame's one-off work budget
         lasts (walk/quality-cull.js frameBudgetLeft, the load track's): a bake reads its picture back, which waits on
         the graphics card */
      if (
        B.frameBakes < FIGURE_BAKES_A_FRAME &&
        (B.frameBakes === 0 || typeof frameBudgetLeft !== 'function' || frameBudgetLeft())
      ) {
        B.frameBakes++;
        im = bakeFigure(Fig, clip, frame, V, ppm, outline, smooth ? 'smooth' : 'pixel');
        if (im) {
          FIGURE_CACHE.set(key, im);
          B.bytes += im.width * im.height * 4;
          /* the longest unused go first, past the count or the bytes */
          while (FIGURE_CACHE.size > FIGURE_CACHE_MAX || (B.bytes > FIGURE_CACHE_BYTES && FIGURE_CACHE.size > 1)) {
            const k = FIGURE_CACHE.keys().next().value,
              old = FIGURE_CACHE.get(k);
            B.bytes -= old.width * old.height * 4;
            FIGURE_CACHE.delete(k);
          }
        }
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
 * a person drawn as figure `name` this frame, doing `act`: 'idle', 'walk' or 'run' (by the distance walked, `gait`
 * metres, as it was at the last tick), or another of the figure's clips ('cheer', 'throw', 'sit': a code figure has
 * only idle and walk); turned to `heading` in the world (logic/person-view.js personHeading), seen from this frame's
 * camera, in `style`. `rec` keeps their last picture and their gait at the last tick (nothing is written on it). Null
 * until a first picture is baked (or while a model's file loads).
 */
export function figurePersonPicture(rec, name, t, act, gait, heading, style = 'pixel') {
  const Fig = figureDef(name);
  if (!Fig) return rec && typeof rec === 'object' ? figureLast.get(rec) || null : null;
  const tick = figureTick(t);
  let g = figureGait.get(rec);
  if (!g || g.tick !== tick) figureGait.set(rec, (g = { tick, gait }));
  let clip = act,
    frame;
  if (Fig.kind === 'code') {
    /* CH-3b: a kit figure cheers and sits too; each breathes at its own time, not in step with the crowd */
    clip =
      act === 'walk' || act === 'run' ? 'walk' : act === 'cheer' || act === 'sit' || act === 'throw' ? act : 'idle';
    frame = clipFrameAt(clip, t + (figureSeed(name) % 2700), g.gait);
  } else {
    if (!Fig.clips[clip]) clip = act === 'run' && Fig.clips.walk ? 'walk' : 'idle';
    if (!Fig.clips[clip]) clip = Object.keys(Fig.clips)[0];
    const speed = clip === 'run' ? WALK_SPEED * RUN_FACTOR : WALK_SPEED;
    frame = meshClipFrame(Fig.clips[clip], t, g.gait, speed);
  }
  return figurePicture(rec, name, clip, frame, heading, seenYaw(), figureTilt(), style);
}
/**
 * a battle's trainer drawn as your figure (battle-stage.js trainerBattleFrame): you from behind (i 0) or the rival
 * facing you (i 1), at FIGURE_BATTLE_PPM, square to the battle's level camera; an act of the figure's own (the throw:
 * by how far through it the battle is, `progress` 0..1), else its idle by the clock. `rec` keeps their last picture.
 */
function figureBattlePicture(rec, i, t, act, progress) {
  /* CH-3b: you as your figure, the rival as theirs (`who`, its look through the figure kit) */
  const name = i === 0 ? figureFor('me') : figureFor(rec && rec.who ? rec.who : 'me'),
    Fig = figureDef(name);
  if (!Fig) return rec && typeof rec === 'object' ? figureLast.get(rec) || null : null;
  const C = Fig.kind === 'mesh' ? Fig.clips : null;
  let clip = 'idle',
    frame;
  if (Fig.kind === 'code' && (act === 'throw' || act === 'cheer')) {
    clip = act;
    frame = act === 'throw' ? Math.min(7, Math.floor((progress || 0) * 8)) : clipFrameAt('cheer', t);
  } else if (act && C && C[act]) {
    clip = act;
    frame = Math.max(0, Math.min(C[act].frames - 1, Math.floor((progress || 0) * C[act].frames)));
  } else {
    if (C && !C.idle) clip = Object.keys(C)[0];
    frame = C ? meshClipFrame(C[clip], t, 0, 0) : clipFrameAt('idle', t + (figureSeed(name) % 2700));
  }
  return figurePicture(rec, name, clip, frame, i === 0 ? 0 : Math.PI, 0, 0, figureStyle(), FIGURE_BATTLE_PPM);
}
/** the baker's numbers for the debug log's people section (numbers only) */
export function figureReport() {
  const B = figureBaker;
  const e = k => (typeof engineSetting === 'function' ? engineSetting('people', k) : null);
  return {
    on: figuresOn(),
    figure: figureChoice(),
    looks: Object.keys(FIGURE_DEFS).filter(k => k.startsWith('look:') && FIGURE_DEFS[k]).length,
    style: figureStyle(),
    density: e('density'),
    turns: e('yawSteps'),
    folk: figureFolk(),
    pictures: FIGURE_CACHE.size,
    mb: Math.round((B.bytes / 1048576) * 10) / 10,
    bakes: B.bakes,
    ms: Math.round(B.ms * 10) / 10,
    lost: B.lost,
    losses: B.losses,
    failed: B.failed || null,
    figures: Object.keys(FIGURE_DEFS).filter(k => FIGURE_DEFS[k]).length,
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
  figureBaker.bytes = 0;
}
