'use strict';
/* ================= WORLD MAP ON THE ENGINE =================
   The Map tab drawn by the GPU on the same canvas as the walk scene (no second WebGL context, nothing reloads): the
   inside of the Hollow Earth at full resolution with soft focus around where you look, the Inner Sun blooming, clouds
   and their shadows, and the landmark stamps standing on the ground. On top: your trip as a moving gold line, the
   route to the place you picked, step counts on the roads around it, and pins with icons for every stop (here,
   destination, visited, new, locked). A Places list finds any stop by name, and Flat shows the whole world unrolled.
   world-map.js keeps the camera, the walking animation and the picking, and still draws the map itself where WebGL isn't
   available (a lost context). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { FR, flyDraw, flyTick, provide } from './hooks.js';
import { $, clamp } from './util.js';
import { FUTURE, LINKS, ROUTE, linkCost, placeSub } from './game-data.js';
import { RM, S, U, canEnter, esc, fmt, nextStop, tripTo } from './game-state.js';
import { frameCount, frameStop, frameTask, userFps } from './frame-scheduler.js';
import { artLoad, artPixels, cnv, hexA, mstamp, uiIco } from './art.js';
import { owFrames, portraitHTML } from './person-art.js';
import { EASE } from './battle-stage.js';
import { artImage, dioHash, dioStep, imageReady, mapById, walkData, walkView } from './walk-view.js';
import { ENG_CTX, eng, engSource } from './engine/settings.js';
import { EGL, eglBindQuad, eglFree, eglImg, eglInit, eglMesh, eglOK, eglPrograms, eglTarget } from './engine/webgl.js';
import { EGL_POST_SH, eglPost, eglScreenOf } from './engine/post-effects.js';
import { dglWorldTex, dioHRaw, walkRenderer } from './walk-view-gl.js';
import {
  D2R,
  MAP,
  MCL,
  MH,
  MLAND,
  MNV,
  MW,
  REGV,
  edgePos,
  mapCam,
  mapFit,
  mapLabels,
  mapMount,
  mapReset,
  mapSelect,
  mapWalk,
  mapZoom,
  mePos,
  mproj,
  setMH,
  setMW,
  setMapFit,
  setMapLabels,
  setMapMount,
  setMapReset,
  setMapZoom,
  slerp,
  sunBlocks,
  v3,
} from './world-map.js';
/* eslint-disable no-func-assign */
expose({
  MGL: [() => MGL],
  MGL_ALT: [() => MGL_ALT],
  MGL_F: [() => MGL_F],
  MGL_N: [() => MGL_N],
  MGL_SH: [() => MGL_SH],
  MGL_TILT: [() => MGL_TILT],
  MINI_K: [() => MINI_K],
  MM: [() => MM],
  WORLD_RELIEF: [() => WORLD_RELIEF],
  _mapLabelsCPU: [() => _mapLabelsCPU],
  _mapMountCPU: [() => _mapMountCPU],
  _mapResetCPU: [() => _mapResetCPU],
  _mapZoomCPU: [() => _mapZoomCPU],
  mapGLAction: [() => mapGLAction, v => (mapGLAction = v)],
  mapGLCanvas: [() => mapGLCanvas, v => (mapGLCanvas = v)],
  mapGLLoop: [() => mapGLLoop, v => (mapGLLoop = v)],
  mapGLReady: [() => mapGLReady, v => (mapGLReady = v)],
  mapGLWanted: [() => mapGLWanted, v => (mapGLWanted = v)],
  mglChrome: [() => mglChrome, v => (mglChrome = v)],
  mglEase: [() => mglEase, v => (mglEase = v)],
  mglFlatMin: [() => mglFlatMin],
  mglHeightTex: [() => mglHeightTex, v => (mglHeightTex = v)],
  mglLL: [() => mglLL],
  mglLift: [() => mglLift, v => (mglLift = v)],
  mglLine: [() => mglLine, v => (mglLine = v)],
  mglMat: [() => mglMat, v => (mglMat = v)],
  mglMiniImg: [() => mglMiniImg, v => (mglMiniImg = v)],
  mglMiniTop: [() => mglMiniTop, v => (mglMiniTop = v)],
  mglMiniUp: [() => mglMiniUp, v => (mglMiniUp = v)],
  mglMinis: [() => mglMinis, v => (mglMinis = v)],
  mglOverlay: [() => mglOverlay, v => (mglOverlay = v)],
  mglPanTo: [() => mglPanTo, v => (mglPanTo = v)],
  mglPath: [() => mglPath, v => (mglPath = v)],
  mglPick: [() => mglPick, v => (mglPick = v)],
  mglPinState: [() => mglPinState, v => (mglPinState = v)],
  mglPinch: [() => mglPinch],
  mglPins: [() => mglPins, v => (mglPins = v)],
  mglPlacesHTML: [() => mglPlacesHTML, v => (mglPlacesHTML = v)],
  mglProj: [() => mglProj, v => (mglProj = v)],
  mglRender: [() => mglRender, v => setMglRender(v)],
  mglSize: [() => mglSize, v => (mglSize = v)],
  mglUV: [() => mglUV, v => (mglUV = v)],
  mmBuild: [() => mmBuild, v => setMmBuild(v)],
  mmCols: [() => mmCols, v => (mmCols = v)],
  mmDraw: [() => mmDraw, v => (mmDraw = v)],
  mmGet: [() => mmGet, v => (mmGet = v)],
  mmKey: [() => mmKey, v => (mmKey = v)],
  mmOn: [() => mmOn, v => (mmOn = v)],
  setMglRender: [() => setMglRender, v => (setMglRender = v)],
});
/* eslint-enable no-func-assign */
export function setMmBuild(v) {
  mmBuild = v; // eslint-disable-line no-func-assign
  provide({ mmBuild });
}
/* to-module: end */
export const MGL = {
  flat: false,
  fv: { u: 0.5, v: 0.5, s: 1 },
  pins: null,
  ov: null,
  dpr: 1,
  list: false,
  altT: null,
  lastT: 0,
  fd: null,
};
const MGL_N = 0.002,
  MGL_F = 3;
export const MGL_SH = {
  mglobe: [
    `#version 300 es
precision highp float;in vec2 aC;void main(){gl_Position=vec4(aC*2.-1.,.5,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;uniform vec3 uC,uFw,uRt,uUp,uHaze;uniform float uFoc,uR,uT,uFlat;uniform vec2 uWH;uniform vec3 uFv;uniform sampler2D uWorld,uHgt;uniform vec4 uCl[16];uniform int uNCl;uniform float uRelief;uniform vec3 uSunL;
float h2(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec2 uvOf(vec3 p){vec3 n=normalize(p);return vec2(fract(atan(n.z,n.x)/6.2831853+1.),.5-asin(clamp(n.y,-1.,1.))/3.1415927);}
float hAt(vec3 p){return textureLod(uHgt,uvOf(p),0.).r;}
void main(){vec2 px=gl_FragCoord.xy/uR;
 if(uFlat>.5){/* the whole world unrolled: texture space, panned and zoomed */
  vec2 s=vec2(px.x,uWH.y-px.y);float u=uFv.x+(s.x-uWH.x*.5)/uFv.z,v=uFv.y+(s.y-uWH.y*.5)/(uFv.z*.5);
  vec3 c=v<0.||v>1.?vec3(.09,.07,.16):texture(uWorld,vec2(u,v)).rgb;if(uRelief>0.&&v>=0.&&v<=1.){vec2 e=vec2(1./1024.,1./512.),uv=vec2(fract(u),v);float hx=textureLod(uHgt,uv+vec2(e.x,0.),0.).r-textureLod(uHgt,uv-vec2(e.x,0.),0.).r,hy=textureLod(uHgt,uv+vec2(0.,e.y),0.).r-textureLod(uHgt,uv-vec2(0.,e.y),0.).r;c*=clamp(1.+(hx*uSunL.x+hy*uSunL.y)*uSunL.z,.55,1.3);}o=vec4(c,1.);gl_FragDepth=.999;return;}
 float dx=(px.x-uWH.x*.5)/uFoc,dy=(px.y-uWH.y*.5)/uFoc;vec3 d=normalize(uFw+uRt*dx+uUp*dy);
 float b=dot(uC,d),cc=dot(uC,uC),ts=-b+sqrt(max(0.,b*b-cc+1.)),th=ts;int hit=0;vec3 col;
 /* ground texture coordinates with seam-free gradients (two wraps of the longitude, the smoother one wins) */
 /* relief: march down from the height of the tallest peak to the sea-level shell */
 float tg=ts,shade=1.;if(uRelief>0.){float R2=1.-uRelief,q=b*b-cc+R2*R2;float t0=q>0.?-b+sqrt(q):ts;if(t0<ts&&t0>0.){float pt=t0,pe=1.;
  for(int i=1;i<=18;i++){float t=mix(t0,ts,float(i)/18.);vec3 p=uC+d*t;float e=(1.-length(p))-hAt(p)*uRelief;if(e<=0.){tg=mix(pt,t,pe/max(pe-e,1e-6));break;}pt=t;pe=e;}}}
 vec3 pg=uC+d*tg;float glat=asin(clamp(pg.y,-1.,1.)),glon=atan(pg.z,pg.x),ua=fract(glon/6.2831853+1.),ub=fract(glon/6.2831853+.5),vv=.5-glat/3.1415927;
 vec2 ga=vec2(dFdx(ua),dFdy(ua)),gb=vec2(dFdx(ub),dFdy(ub)),gg=dot(ga,ga)<dot(gb,gb)?ga:gb;vec2 gx=vec2(gg.x,dFdx(vv)),gy=vec2(gg.y,dFdy(vv));
 float sd=b*b-cc+.075*.075;if(sd>0.){float t0=-b-sqrt(sd);if(t0>0.&&t0<th){th=t0;hit=1;}}
 int ck=-1;for(int i=0;i<16;i++){if(i>=uNCl)break;vec3 oc=uC-uCl[i].xyz;float bb=dot(oc,d),q=bb*bb-(dot(oc,oc)-uCl[i].w*uCl[i].w);if(q>0.){float t0=-bb-sqrt(q);if(t0>0.&&t0<th){th=t0;ck=i;hit=2;}}}
 vec3 p=uC+d*th;
 if(hit==2){vec3 n=normalize(p-uCl[ck].xyz),cn=normalize(uCl[ck].xyz);float lit=-dot(n,cn);col=mix(vec3(.77,.73,.91),vec3(1.05),clamp(.55+lit*.6,0.,1.));}
 else if(hit==1){float nz=max(0.,-dot(normalize(p),d));col=mix(vec3(1.,.77,.35),vec3(1.,.99,.91),pow(nz,.6))*2.4;}
 else{col=textureGrad(uWorld,vec2(ua,vv),gx,gy).rgb;
  for(int i=0;i<16;i++){if(i>=uNCl)break;vec3 c=uCl[i].xyz;float cd=dot(c,p);if(cd>0.){float e=length(c-p*cd)/(uCl[i].w*1.25);if(e<1.){col=mix(col,vec3(.14,.1,.3),.42*smoothstep(1.,.65,e));}}}
  if(uRelief>0.){vec2 uv=uvOf(pg),e=vec2(1./1024.,1./512.);float hx=textureLod(uHgt,uv+vec2(e.x,0.),0.).r-textureLod(uHgt,uv-vec2(e.x,0.),0.).r,hy=textureLod(uHgt,uv+vec2(0.,e.y),0.).r-textureLod(uHgt,uv-vec2(0.,e.y),0.).r;
   shade=clamp(1.+(hx*uSunL.x+hy*uSunL.y)*uSunL.z,.55,1.3);col*=shade;col=mix(col,col*vec3(.92,.94,1.05),smoothstep(.55,.9,textureLod(uHgt,uv,0.).r)*.3);}
  float fk=1.-exp(-max(0.,ts-.3)*.72);col=mix(col,uHaze,clamp(fk+(h2(gl_FragCoord.xy)-.5)*.03,0.,.86));}
 if(hit!=1&&b<0.){float dist=sqrt(max(0.,cc-b*b)),g=clamp(1.-dist/.42,0.,1.);col=mix(col,vec3(1.,.93,.71),g*g*.85);}
 o=vec4(col,1.);float z=th*dot(d,uFw);gl_FragDepth=((${((MGL_F + MGL_N) / (MGL_F - MGL_N)).toFixed(6)})-(${((2 * MGL_F * MGL_N) / (MGL_F - MGL_N)).toFixed(6)})/max(z,1e-4))*.5+.5;}`,
  ],
  mspr: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uP,uRt,uUp;uniform vec2 uS;out vec2 vUV;out vec3 vW;
void main(){vec3 p=uP+uRt*(aC.x-.5)*uS.x+uUp*aC.y*uS.y;vW=p;vUV=vec2(aC.x,1.-aC.y);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec3 uC,uHaze;
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;float d=length(vW-uC),fk=1.-exp(-max(0.,d-.3)*.72);o=vec4(mix(c.rgb*.97,uHaze,clamp(fk,0.,.86)),1.);}`,
  ],
};
/* ---------- when it runs ---------- */
export function mapGLWanted() {
  return typeof EGL !== 'undefined' && !EGL.fail && !EGL.lost && eglOK();
}
function mapGLCanvas() {
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  return cv;
}
function mapGLReady() {
  if (!mapGLWanted()) return false;
  const cv = mapGLCanvas();
  if (EGL.cv !== cv) {
    if (walkView.cv && walkView.cv !== cv) return false;
    if (!eglInit(cv)) {
      EGL.fail = 1;
      return false;
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.gkey = '';
      walkRenderer.farKey = '';
      walkRenderer.wtex = null;
    }
  }
  try {
    eglPrograms(MGL_SH);
    eglPrograms(EGL_POST_SH);
  } catch (e) {
    console.error(e);
    EGL.fail = 1;
    return false;
  }
  cv.hidden = false;
  cv.classList.add('gl', 'in');
  return true;
}
/* ---------- projection (globe or flat) ---------- */
const mglLL = v => [Math.atan2(v[2], v[0]), Math.asin(clamp(v[1], -1, 1))];
function mglUV(v) {
  const [lon, lat] = mglLL(v);
  return [(lon / (Math.PI * 2) + 1) % 1, 0.5 - lat / Math.PI];
}
function mglProj(v) {
  if (!MGL.flat) {
    const q = mproj(MAP.cam, v);
    if (!q || sunBlocks(MAP.cam, v)) return null;
    return q;
  }
  const F = MGL.fv,
    [u, vv] = mglUV(v);
  let du = u - F.u;
  du -= Math.round(du);
  return { x: MW / 2 + du * F.s, y: MH / 2 + (vv - F.v) * F.s * 0.5, z: 0.5 };
}
function mglMat(cam) {
  const ax = (2 * cam.foc) / MW,
    ay = (2 * cam.foc) / MH,
    A = (MGL_F + MGL_N) / (MGL_F - MGL_N),
    B = (-2 * MGL_F * MGL_N) / (MGL_F - MGL_N),
    C = cam.C,
    m = new Float32Array(16),
    dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const set = (row, v, w) => {
    m[row] = v[0];
    m[4 + row] = v[1];
    m[8 + row] = v[2];
    m[12 + row] = w;
  };
  set(
    0,
    cam.rt.map(x => x * ax),
    -ax * dt(cam.rt, C)
  );
  set(
    1,
    cam.up.map(x => x * ay),
    -ay * dt(cam.up, C)
  );
  set(
    2,
    cam.fw.map(x => x * A),
    -A * dt(cam.fw, C) + B
  );
  set(3, cam.fw, -dt(cam.fw, C));
  return m;
}
/* ---------- mount and loop ---------- */
const _mapMountCPU = mapMount,
  _mapLabelsCPU = mapLabels,
  _mapZoomCPU = mapZoom,
  _mapResetCPU = mapReset;
setMapMount(function () {
  const cv = $('#mapcv');
  if (!cv) return;
  if (!mapGLReady()) {
    MAP.gl = false;
    document.body.classList.remove('map-gl');
    return _mapMountCPU();
  }
  MAP.gl = true;
  document.body.classList.add('map-gl');
  MAP.cv = cv;
  MAP.ctx = cv.getContext('2d');
  MGL.pins = null;
  mglSize();
  const to = mePos();
  if (!MAP.me) MAP.me = to;
  else if (v3.dot(MAP.me, to) < 0.999999) mapWalk(MAP.me, to);
  if (!MAP.focus) MAP.focus = to;
  /* arriving from the walk screen: start close to you and pull back */
  if (U.mglFrom === 'walk' && !RM && !MGL.flat) {
    MAP.alt = 0.11;
    MGL.altT = 0.32;
  }
  U.mglFrom = null;
  /* v31: a free camera. One finger (or the left mouse button) drags the land; two fingers pinch to zoom, twist to turn
    and slide up or down to tilt; the right mouse button (or Shift with the left) turns and tilts; the wheel zooms
    (Shift + wheel turns). Zoom goes right down to the miniatures. "Back to you" puts everything back. */
  if (!cv._bound) {
    cv._bound = 1;
    const pts = new Map(),
      two = () => {
        const [a, b] = [...pts.values()];
        return {
          d: Math.hypot(a[0] - b[0], a[1] - b[1]),
          ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
          my: (a[1] + b[1]) / 2,
        };
      };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      MAP.drag = {
        x: e.clientX,
        y: e.clientY,
        yaw: MAP.yaw,
        pitch: MAP.pitch,
        tilt: MAP.tilt ?? 0.5733,
        focus: MAP.focus || mePos(),
        cam: MAP.cam,
        fu: MGL.fv.u,
        fv: MGL.fv.v,
        moved: 0,
        id: e.pointerId,
        turn: e.button === 2 || e.shiftKey || e.ctrlKey,
        g: null,
        alt: MAP.alt,
        s: MGL.fv.s,
      };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const D = MAP.drag;
      if (!D) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size > 1) {
        const g = two();
        if (!D.g) {
          D.g = g;
          D.alt = MAP.alt;
          D.s = MGL.fv.s;
          D.yaw = MAP.yaw;
          D.tilt = MAP.tilt ?? 0.5733;
        }
        const k = D.g.d / Math.max(1, g.d);
        if (MGL.flat) MGL.fv.s = clamp(D.s / k, mglFlatMin(), MW * 8);
        else {
          MAP.alt = clamp(D.alt * k, MGL_ALT[0], MGL_ALT[1]);
          let da = g.ang - D.g.ang;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          MAP.yaw = D.yaw - da;
          MAP.tilt = clamp(D.tilt + (g.my - D.g.my) * 0.004, MGL_TILT[0], MGL_TILT[1]);
        }
        D.moved = 1;
        MGL.altT = null;
        MAP.dirty = true;
        return;
      }
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) D.moved = 1;
      if (!D.moved) return;
      if (MGL.flat) {
        MGL.fv.u = D.fu - dx / MGL.fv.s;
        MGL.fv.v = clamp(D.fv - dy / (MGL.fv.s * 0.5), 0, 1);
      } else if (D.turn) {
        MAP.yaw = D.yaw - dx * 0.006;
        MAP.tilt = clamp(D.tilt + dy * 0.004, MGL_TILT[0], MGL_TILT[1]);
      } else mglPanTo(D, dx, dy);
      MAP.dirty = true;
    });
    const up = e => {
      pts.delete(e.pointerId);
      const D = MAP.drag;
      if (pts.size) {
        if (D) D.g = null;
        return;
      }
      MAP.drag = null;
      MAP.dirty = true;
      if (D && !D.moved && e.type === 'pointerup') mglPick(e);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        if (e.shiftKey && !MGL.flat) {
          MAP.yaw += (e.deltaY || e.deltaX) * 0.003;
          MAP.dirty = true;
          return;
        }
        const k = e.deltaY > 0 ? 1.12 : 0.89;
        if (MGL.flat) MGL.fv.s = clamp(MGL.fv.s / k, mglFlatMin(), MW * 8);
        else MAP.alt = clamp(MAP.alt * k, MGL_ALT[0], MGL_ALT[1]);
        MGL.altT = null;
        MAP.dirty = true;
      },
      { passive: false }
    );
    cv.tabIndex = 0;
    cv.addEventListener('keydown', e => {
      if (MGL.flat) return;
      const k = e.key,
        D = { focus: MAP.focus || mePos(), cam: MAP.cam };
      let used = 1;
      if (k === 'ArrowLeft' || k === 'a') mglPanTo(D, 60, 0);
      else if (k === 'ArrowRight' || k === 'd') mglPanTo(D, -60, 0);
      else if (k === 'ArrowUp' || k === 'w') mglPanTo(D, 0, 60);
      else if (k === 'ArrowDown' || k === 's') mglPanTo(D, 0, -60);
      else if (k === 'q') MAP.yaw -= 0.2;
      else if (k === 'e') MAP.yaw += 0.2;
      else if (k === '+' || k === '=') mapZoom(0.8);
      else if (k === '-') mapZoom(1.25);
      else used = 0;
      if (used) {
        e.preventDefault();
        MAP.dirty = true;
      }
    });
  }
  mglChrome();
  if (!MAP.on) {
    MAP.on = true;
    MAP.last = performance.now();
    frameTask('map', mapGLLoop);
  }
});
const mglPinch = pts => {
  const [a, b] = [...pts.values()];
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
};
const MGL_ALT = [0.022, 0.7],
  MGL_TILT = [0.2, 1.35];
/* drag the land: the spot under the middle of the view slides with your finger, across the inside of the world */
/* a smooth turn or tilt from the buttons */
function mglEase(k, to) {
  const from = MAP[k] ?? (k === 'tilt' ? 0.5733 : 0),
    t0 = performance.now();
  const step = () => {
    const f = Math.min(1, (performance.now() - t0) / 380),
      e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    MAP[k] = from + (to - from) * e;
    MAP.dirty = true;
    if (f < 1) requestAnimationFrame(step);
  };
  step();
}
function mglPanTo(D, dx, dy) {
  const cam = D.cam || MAP.cam;
  if (!cam) return;
  const P0 = D.focus,
    n = v3.mul(P0, -1),
    tang = v => {
      const t = v3.sub(v, v3.mul(n, v3.dot(v, n)));
      return v3.len(t) > 1e-6 ? v3.norm(t) : null;
    };
  const rt = tang(cam.rt),
    fw = tang(cam.fw) || tang(v3.mul(cam.up, -1));
  if (!rt || !fw) return;
  const s = (MAP.alt * 1.84) / cam.foc;
  MAP.focus = v3.norm(v3.add(P0, v3.add(v3.mul(rt, -dx * s), v3.mul(fw, dy * s))));
  MAP.free = true;
  MAP.fT = null;
}
const mglFlatMin = () => Math.max(MW, MH * 2) * 0.9;
export function mglSize() {
  const cv = MAP.cv,
    r = cv && cv.isConnected ? cv.getBoundingClientRect() : null,
    w = Math.round(r && r.width > 20 ? r.width : innerWidth),
    h = Math.round(r && r.height > 20 ? r.height : innerHeight);
  if (w !== MW || h !== MH) {
    setMW(w);
    setMH(h);
    MAP.dirty = true;
  }
  MAP.s = 1;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (cv && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  MGL.dpr = dpr;
  if (MGL.fv.s < mglFlatMin()) MGL.fv.s = mglFlatMin();
}
function mapGLLoop(ts) {
  if (!MAP.cv || !MAP.cv.isConnected || !MAP.gl) {
    MAP.on = false;
    frameStop('map');
    return;
  }
  if (EGL.lost) return;
  let moving = false;
  if (MAP.fly && typeof flyTick === 'function' && flyTick(ts)) moving = true;
  if (MAP.anim) {
    const a = MAP.anim,
      k = Math.min(1, (ts - a.t0) / a.dur);
    MAP.me = v3.norm(slerp(a.from, a.to, EASE.io(k)));
    moving = k < 1;
    MAP.face = 'up';
    if (k >= 1) {
      MAP.anim = null;
      MAP.me = a.to;
    }
  }
  MAP.moving = moving;
  let panning = false;
  if (MAP.fT) {
    const a = MAP.fT,
      k = Math.min(1, (ts - a.t0) / a.dur);
    MAP.focus = v3.norm(slerp(a.from, a.to, EASE.io(k)));
    panning = k < 1;
    if (k >= 1) MAP.fT = null;
    if (MGL.flat) {
      const [u, v] = mglUV(MAP.focus);
      MGL.fv.u = u;
      MGL.fv.v = v;
    }
  } else if (U.mapSel == null && MAP.me && !MGL.flat && !MAP.free) MAP.focus = MAP.me;
  if (MGL.altT != null) {
    MAP.alt += (MGL.altT - MAP.alt) * Math.min(1, (ts - (MGL.lastT || ts)) / 260);
    if (Math.abs(MGL.altT - MAP.alt) < 0.002) {
      MAP.alt = MGL.altT;
      MGL.altT = null;
    }
    panning = true;
  }
  const busy = !!(MAP.drag || moving || panning);
  if (ts - MAP.lastDraw < (busy ? 1000 / userFps() - 2 : 1000 / 24) && !MAP.dirty) return;
  MAP.lastDraw = ts;
  MAP.dirty = false;
  MGL.lastT = ts;
  const w0 = performance.now();
  mglSize();
  MAP.cam = mapCam();
  mglRender(ts);
  mglOverlay(ts);
  mglPins();
  frameCount(performance.now() - w0);
}
/* the land's height (art/map/world_h.png, made by tools/build-world-relief.py) */
export const WORLD_RELIEF = 'map/world_h.png';
function mglHeightTex() {
  if (MGL.htex !== undefined && MGL.htex) return MGL.htex;
  const im = typeof artImage === 'function' ? artImage(WORLD_RELIEF) : null;
  if (!im || !imageReady(im)) {
    if (!MGL.hload) {
      MGL.hload = 1;
      artLoad([WORLD_RELIEF])
        .then(() => {
          MAP.dirty = true;
        })
        .catch(() => {});
    }
    return null;
  }
  const gl = EGL.gl,
    t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return (MGL.htex = t);
}
export function mglRender(t) {
  const es = typeof engSource === 'function' ? engSource() : null;
  ENG_CTX.look = (es && es.map) || null;
  const gl = EGL.gl,
    cv = EGL.cv,
    cam = MAP.cam,
    px = MW * MH,
    R =
      Math.min(devicePixelRatio || 1, 1.75) *
      Math.min(1, Math.sqrt(1.4e6 / (px * Math.pow(Math.min(devicePixelRatio || 1, 1.75), 2)))),
    rw = Math.max(64, Math.round(MW * R)),
    rh = Math.max(64, Math.round(MH * R));
  if (cv.width !== rw || cv.height !== rh) {
    cv.width = rw;
    cv.height = rh;
  }
  const S = eglTarget('scene', rw, rh, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, rw, rh);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.ALWAYS);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  const haze = [176 / 255, 186 / 255, 236 / 255];
  let p = EGL.P.mglobe,
    U2 = p.U;
  gl.useProgram(p.p);
  eglBindQuad();
  gl.uniform3fv(U2.uC, cam.C);
  gl.uniform3fv(U2.uFw, cam.fw);
  gl.uniform3fv(U2.uRt, cam.rt);
  gl.uniform3fv(U2.uUp, cam.up);
  gl.uniform3fv(U2.uHaze, haze);
  gl.uniform1f(U2.uFoc, cam.foc);
  gl.uniform1f(U2.uR, rw / MW);
  gl.uniform1f(U2.uT, t);
  gl.uniform2f(U2.uWH, MW, MH);
  gl.uniform1f(U2.uFlat, MGL.flat ? 1 : 0);
  gl.uniform3f(U2.uFv, MGL.fv.u, MGL.fv.v, MGL.fv.s);
  const cl = new Float32Array(64);
  MCL.forEach((k, i) => {
    const a = (k.lon + (t / 1000) * k.sp) * D2R,
      la = k.lat * D2R;
    cl.set([Math.cos(la) * Math.cos(a) * k.alt, Math.sin(la) * k.alt, Math.cos(la) * Math.sin(a) * k.alt, k.r], i * 4);
  });
  gl.uniform4fv(U2.uCl, cl);
  gl.uniform1i(U2.uNCl, MGL.noClouds ? 0 : Math.min(16, MCL.length));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, typeof dglWorldTex === 'function' ? dglWorldTex() : EGL.white);
  gl.uniform1i(U2.uWorld, 0);
  const HT = mglHeightTex();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, HT || EGL.white);
  gl.uniform1i(U2.uHgt, 1);
  gl.uniform1f(U2.uRelief, HT ? 0.014 * eng('world', 'relief') : 0);
  gl.uniform3f(U2.uSunL, -0.7, -0.7, 14 * eng('world', 'reliefShade'));
  gl.activeTexture(gl.TEXTURE0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthFunc(gl.LEQUAL);
  if (!MGL.flat) {
    /* landmark stamps standing on the ground */ p = EGL.P.mspr;
    U2 = p.U;
    gl.useProgram(p.p);
    const vp = mglMat(cam);
    gl.uniformMatrix4fv(U2.uVP, false, vp);
    gl.uniform3fv(U2.uC, cam.C);
    gl.uniform3fv(U2.uHaze, haze);
    gl.uniform1i(U2.uTex, 0);
    /* v24: a miniature of every stop's walk scene, standing on the globe where the stop is (art/map/mini, tools/build-map-minis.py) */
    const m3 = typeof mmDraw === 'function' && mmDraw(cam);
    if (m3) {
      p = EGL.P.mspr;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(U2.uVP, false, vp);
      gl.uniform3fv(U2.uC, cam.C);
      gl.uniform3fv(U2.uHaze, haze);
      gl.uniform1i(U2.uTex, 0);
      eglBindQuad();
    }
    if (!m3)
      mglMinis(cam, (im, v, k) => {
        const T = eglImg(im, { noNormal: true });
        if (!T) return;
        const n = v3.norm(v3.mul(v, -1)),
          rt = v3.norm(v3.sub(cam.rt, v3.mul(n, v3.dot(cam.rt, n)))),
          bk = v3.norm(v3.cross(rt, n)),
          up = v3.norm(v3.add(v3.mul(n, 0.62), v3.mul(bk, -0.78))); /* laid back like a tabletop seen from above */
        gl.uniform3fv(U2.uP, v);
        gl.uniform3fv(U2.uRt, rt);
        gl.uniform3fv(U2.uUp, up);
        gl.uniform2f(U2.uS, im.width * k, im.height * k);
        gl.bindTexture(gl.TEXTURE_2D, T.t);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    for (const l of MLAND) {
      const d = v3.sub(l.v, cam.C),
        z = v3.dot(d, cam.fw);
      if (z < 0.01 || z > 1.3) continue;
      const im = mstamp(l.k),
        T = eglImg(im, { noNormal: true });
      if (!T) continue;
      const up = v3.mul(l.v, -1),
        rt = v3.norm(v3.sub(cam.rt, v3.mul(up, v3.dot(cam.rt, up)))),
        k = 0.0011;
      gl.uniform3fv(U2.uP, l.v);
      gl.uniform3fv(U2.uRt, rt);
      gl.uniform3fv(U2.uUp, up);
      gl.uniform2f(U2.uS, im.width * k, im.height * k);
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
  const P = MAP.focus || mePos(),
    fd = Math.max(0.02, v3.dot(v3.sub(P, cam.C), cam.fw));
  MGL.fd = MGL.fd == null ? fd : MGL.fd + (fd - MGL.fd) * 0.2;
  eglPost(S, { near: MGL_N, far: MGL_F, df: MGL.fd * 1.6, F: (cam.foc * rw) / MW }, MGL.fd, rw, rh, {
    blur: MGL.flat ? 0 : 0.5,
    fast: rw * rh > 1.2e6,
    noAO: true,
    sun: MGL.flat ? null : eglScreenOf(mglMat(cam), [0, 0, 0]),
    sunCol: [1, 0.9, 0.7],
  });
  gl.depthFunc(gl.LEQUAL);
}
/* phase 04d: the in-game full test (self-test.js) times the map */
export function setMglRender(v) {
  mglRender = v; // eslint-disable-line no-func-assign
  provide({ mglRender });
}
/* the miniatures: loaded the first time the map opens; size in world units per pixel (about 3 degrees across) */
const MINI_K = 0.0004;
function mglMiniImg(i) {
  const r = ROUTE[i];
  if (!r || !r.scene) return null;
  const p = `map/mini/${r.scene}.png`,
    im = typeof artImage === 'function' ? artImage(p) : null;
  if (!im || !imageReady(im)) {
    MGL.miniLoad = MGL.miniLoad || {};
    if (!MGL.miniLoad[p]) {
      MGL.miniLoad[p] = 1;
      artLoad([p])
        .then(() => {
          MAP.dirty = true;
        })
        .catch(() => {});
    }
    return null;
  }
  return im;
}
/* the land's height under a point (the same relief the globe shader marches), so a miniature stands on the hills, not inside them */
function mglLift(v) {
  const R = eng('world', 'relief') * 0.014;
  if (!R) return v;
  if (!MGL.hpix) {
    if (!MGL.hpl) {
      MGL.hpl = 1;
      artPixels(WORLD_RELIEF)
        .then(p => {
          MGL.hpix = p;
          MAP.dirty = true;
        })
        .catch(() => {});
    }
    return v;
  }
  const [u, w] = mglUV(v),
    W = 1024,
    H = 512,
    x = Math.floor(u * W) % W,
    y = clamp(Math.floor(w * H), 0, H - 1),
    h = (MGL.hpix[y * W + x] & 255) / 255;
  return v3.mul(v, 1 - h * R);
}
function mglMinis(cam, draw) {
  ROUTE.forEach((r, i) => {
    const v = mglLift(MNV[i]),
      d = v3.sub(v, cam.C),
      z = v3.dot(d, cam.fw);
    if (z < 0.01 || z > 1.3) return;
    const im = mglMiniImg(i);
    if (im) draw(im, v, MINI_K * (r.town ? 1.15 : 1));
  });
}
/* how far above the stop a pin goes so it sits on top of the miniature */
function mglMiniUp(v, cam) {
  const n = v3.norm(v3.mul(v, -1)),
    rt = v3.norm(v3.sub(cam.rt, v3.mul(n, v3.dot(cam.rt, n)))),
    bk = v3.norm(v3.cross(rt, n));
  return v3.norm(v3.add(v3.mul(n, 0.62), v3.mul(bk, -0.78)));
}
function mglMiniTop(i) {
  if (typeof mmOn === 'function' && mmOn() && !MGL.flat && MAP.cam) {
    const e = MM.cache.get(i);
    if (e && e.m && e.m.top) return e.m.top;
  }
  const im = mglMiniImg(i);
  if (!im || MGL.flat || !MAP.cam) return null;
  const r = ROUTE[i],
    v = mglLift(MNV[i]);
  return v3.add(v, v3.mul(mglMiniUp(v, MAP.cam), im.height * MINI_K * (r.town ? 1.15 : 1) * 0.92));
}
/* ---------- overlay: trip, route preview, player ---------- */
function mglLine(c, pts, col, w, dash, off) {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.setLineDash(dash || []);
  c.lineDashOffset = off || 0;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  let pen = false,
    last = null;
  for (const q of pts) {
    if (!q) {
      pen = false;
      continue;
    }
    if (pen && last && Math.hypot(q.x - last.x, q.y - last.y) > MW * 0.4) pen = false;
    if (pen) c.lineTo(q.x, q.y);
    else c.moveTo(q.x, q.y);
    pen = true;
    last = q;
  }
  c.stroke();
  c.setLineDash([]);
}
function mglPath(seq, startF) {
  const pts = [];
  for (let k = 0; k < seq.length - 1; k++) {
    const a = seq[k],
      b = seq[k + 1];
    for (let f = k === 0 ? startF : 0; f <= 1.0001; f += 0.025) pts.push(mglProj(edgePos(a, b, Math.min(1, f))));
  }
  return pts;
}
function mglOverlay(t) {
  const c = MAP.ctx,
    cv = MAP.cv,
    d = MGL.dpr;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  const r = S.route,
    plan = [r.node, ...r.plan];
  if (plan.length > 1) {
    const pts = mglPath(plan, r.prog / linkCost(plan[0], plan[1]));
    mglLine(c, pts, 'rgba(255,214,90,.35)', 9);
    mglLine(c, pts, r.hold ? 'rgba(255,255,255,.9)' : '#FFE27A', 3.5, [10, 8], -t / 40);
  }
  const sel = U.mapSel;
  if (typeof sel === 'number' && sel !== r.node && sel !== (r.plan.length ? r.plan[r.plan.length - 1] : null)) {
    const tr = tripTo(sel);
    if (tr && tr.plan.length) {
      const from = nextStop() != null && r.prog > 0 ? (tr.back ? r.node : nextStop()) : r.node;
      const seq = [r.prog > 0 && !tr.back ? r.node : from, ...tr.plan.filter((x, i) => !(i === 0 && x === from))];
      mglLine(
        c,
        mglPath(seq.length > 1 ? seq : [r.node, ...tr.plan], 0),
        'rgba(255,255,255,.85)',
        2.5,
        [4, 7],
        -t / 60
      );
    }
  }
  const pq = mglProj(MAP.me || mePos());
  if (pq && MAP.fly && typeof flyDraw === 'function') flyDraw(c, t, mglProj);
  else if (pq) {
    const fr = owFrames('me'),
      set = fr[MAP.face] || fr.down,
      f = MAP.moving ? set[1 + (Math.floor(t / 140) % 2)] : set[0],
      k = 2,
      bob = MAP.moving ? 0 : Math.floor(t / 600) % 2;
    c.imageSmoothingEnabled = false;
    c.fillStyle = 'rgba(20,10,40,.35)';
    c.beginPath();
    c.ellipse(pq.x, pq.y, 11, 3.5, 0, 0, 7);
    c.fill();
    const k2 = 0.42,
      w = Math.round(f.width * k2),
      h = Math.round(f.height * k2);
    c.drawImage(
      f,
      Math.round(pq.x - (f.ax || f.width / 2) * k2),
      Math.round(pq.y - (f.ay || f.height) * k2 + bob),
      w,
      h
    );
  }
}
/* ---------- pins and road chips (HTML, so they're crisp and easy to tap) ---------- */
function mglPinState(i) {
  const n = ROUTE[i],
    dest = S.route.plan.length ? S.route.plan[S.route.plan.length - 1] : null,
    locked = !canEnter(i);
  const ico = i === S.route.node ? 'walk' : locked ? 'lock' : i === dest ? 'flag' : n.town ? 'house' : 'leaf';
  return {
    ico,
    cls:
      'mpin' +
      (i === S.route.node ? ' here' : '') +
      (U.mapSel === i ? ' sel' : '') +
      (i === dest ? ' dest' : '') +
      (!S.visited[i] && !locked ? ' new' : '') +
      (locked ? ' locked' : '') +
      (n.town ? ' town' : ''),
  };
}
function mglPins() {
  const host = $('#maplabels');
  if (!host || !MAP.cam) return;
  if (!MGL.pins || MGL.pins.host !== host) {
    host.innerHTML = '';
    MGL.pins = { host, el: new Map() };
  }
  const E = MGL.pins.el,
    seen = new Set();
  const put = (key, q, html, cls, attrs, chip) => {
    if (!q || q.x < -60 || q.x > MW + 60 || q.y < -30 || q.y > MH + 30) {
      const e = E.get(key);
      if (e) e.hidden = true;
      return;
    }
    seen.add(key);
    let e = E.get(key);
    if (!e) {
      e = document.createElement(attrs ? 'button' : 'span');
      if (attrs) for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v);
      host.appendChild(e);
      E.set(key, e);
    }
    const sig = cls + '|' + html;
    if (e._sig !== sig) {
      e._sig = sig;
      e.className = cls;
      e.innerHTML = html;
    }
    e.hidden = false;
    const tf = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) translate(-50%,${attrs ? '-100%' : '-50%'})`;
    if (e._tf !== tf) {
      e._tf = tf;
      e.style.transform = tf;
    }
  };
  const sel = U.mapSel == null ? S.route.node : U.mapSel,
    dest = S.route.plan.length ? S.route.plan[S.route.plan.length - 1] : null;
  const placed = [],
    pr = i => (i === S.route.node ? 0 : i === U.mapSel ? 1 : i === dest ? 2 : S.visited[i] ? 3 : 4),
    order = ROUTE.map((n, i) => i).sort((a, b) => pr(a) - pr(b));
  for (const i of order) {
    const n = ROUTE[i],
      tv = mglMiniTop(i);
    let q = mglProj(tv || MNV[i]);
    const far = q && q.z > 0.9 && i !== S.route.node && i !== sel && i !== dest && !MGL.flat;
    const st = mglPinState(i);
    if (far) q = null;
    if (q && i === S.route.node) q = { x: q.x, y: q.y - 44, z: q.z }; /* above your character */
    let mini = false;
    if (q) {
      const w = n.name.length * 7.4 + 40,
        r = [q.x - w / 2, q.y - 30, q.x + w / 2, q.y];
      if (placed.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) {
        mini = true;
        placed.push([q.x - 14, q.y - 30, q.x + 14, q.y]);
      } else placed.push(r);
    }
    put(
      'r' + i,
      q,
      `<span class="mp-i">${uiIco(st.ico, 14)}</span><span class="mp-n">${esc(n.name)}</span>`,
      st.cls + (mini ? ' mini' : ''),
      { 'data-a': 'msel', 'data-n': String(i), 'aria-label': n.name }
    );
  }
  FUTURE.forEach((f, i) => {
    let q = f.t === 'sun' ? (MGL.flat ? null : mproj(MAP.cam, [0, 0, 0])) : mglProj(REGV[i]);
    if (q && q.z > 0.95 && U.mapSel !== 'f' + i && !MGL.flat) return put('f' + i, null);
    if (q && U.mapSel !== 'f' + i) {
      const w = f.name.length * 7 + 20,
        r = [q.x - w / 2, q.y - 12, q.x + w / 2, q.y + 12];
      if (placed.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) q = null;
      else placed.push(r);
    }
    put(
      'f' + i,
      q,
      `<span class="mp-n">${esc(f.name)}</span>`,
      'mpin fog' + (f.t === 'sun' ? ' sun' : '') + (U.mapSel === 'f' + i ? ' sel' : ''),
      { 'data-a': 'msel', 'data-n': 'f' + i, 'aria-label': f.name }
    );
  });
  /* step counts on the roads around the picked place, and along the trip */
  const plan = [S.route.node, ...S.route.plan],
    onPlan = new Set();
  for (let k = 0; k < plan.length - 1; k++)
    onPlan.add(Math.min(plan[k], plan[k + 1]) + '-' + Math.max(plan[k], plan[k + 1]));
  LINKS.forEach(([a, b, c], i) => {
    const show =
      (typeof sel === 'number' && (a === sel || b === sel)) || onPlan.has(Math.min(a, b) + '-' + Math.max(a, b));
    const q = show ? mglProj(edgePos(a, b, 0.5)) : null;
    put('L' + i, q, `${fmt(c)} steps`, 'mchip' + (onPlan.has(Math.min(a, b) + '-' + Math.max(a, b)) ? ' trip' : ''));
  });
  /* 0.5: friends, at the place they were last */
  if (typeof FR !== 'undefined')
    for (const u of FR.list) {
      const d = FR.data[u],
        a = d && d.at;
      if (!a || a.node == null || !MNV[a.node]) {
        put('fr' + u, null);
        continue;
      }
      const tv = mglMiniTop(a.node);
      let q = mglProj(tv || MNV[a.node]);
      if (q && q.z > 0.92 && !MGL.flat) q = null;
      if (q) q = { x: q.x + 22, y: q.y - 6, z: q.z };
      put(
        'fr' + u,
        q,
        `<span class="mp-face">${typeof portraitHTML === 'function' ? portraitHTML('friend:' + u, 26) : ''}</span><span class="mp-n">${esc(d.name || 'Friend')}</span>`,
        'mpin friend',
        { 'data-a': 'fr-pin', 'data-u': u, 'aria-label': (d.name || 'Friend') + ' was here' }
      );
    }
  for (const [k, e] of E) if (!seen.has(k)) e.hidden = true;
}
function mglPick(ev) {
  const r = MAP.cv.getBoundingClientRect(),
    x = ev.clientX - r.left,
    y = ev.clientY - r.top;
  let best = null,
    bd = 30;
  ROUTE.forEach((n, i) => {
    const q = mglProj(MNV[i]);
    if (!q) return;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best === null)
    FUTURE.forEach((f, i) => {
      const q = f.t === 'sun' ? (MGL.flat ? null : mproj(MAP.cam, [0, 0, 0])) : mglProj(REGV[i]);
      if (!q) return;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < bd) {
        bd = d;
        best = 'f' + i;
      }
    });
  if (best !== null) mapSelect(best);
}
setMapLabels(function () {
  if (MAP.gl) return mglPins();
  return _mapLabelsCPU();
});
{
  const cpuFit = mapFit;
  setMapFit(function () {
    if (MAP.gl) {
      mglSize();
      MAP.dirty = true;
      return;
    }
    cpuFit();
  });
}
setMapZoom(function (k) {
  if (!MAP.gl) return _mapZoomCPU(k);
  MGL.altT = null;
  if (MGL.flat) MGL.fv.s = clamp(MGL.fv.s / k, mglFlatMin(), MW * 8);
  else MAP.alt = clamp(MAP.alt * k, MGL_ALT[0], MGL_ALT[1]);
  MAP.dirty = true;
});
setMapReset(function () {
  if (!MAP.gl) return _mapResetCPU();
  MAP.free = false;
  MAP.tilt = 0.5733;
  _mapResetCPU();
  if (MGL.flat) {
    const [u, v] = mglUV(mePos());
    MGL.fv.u = u;
    MGL.fv.v = v;
  }
  MAP.dirty = true;
});
/* ---------- extra controls: places list and flat view ---------- */
function mglChrome() {
  const box = $('.map-full');
  if (!box) return;
  const ctl = box.querySelector('.mapctl');
  if (ctl && !ctl.querySelector('[data-a=mflat]')) {
    ctl.insertAdjacentHTML(
      'beforeend',
      `<button class="mbtn" data-a="mlist" aria-label="Places" title="Places">${uiIco('list', 16)}</button><button class="mbtn" data-a="mflat" aria-label="${MGL.flat ? 'Show the globe' : 'Show the whole world flat'}" title="${MGL.flat ? 'Globe' : 'Flat map'}">${uiIco('globe', 16)}</button>`
    );
  }
  if (!box.querySelector('.mapview'))
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="mapview glass" role="group" aria-label="Look around"><button class="mbtn sm" data-a="mturn" data-k="-1" aria-label="Turn left" title="Turn left">⟲</button><button class="mbtn sm" data-a="mtilt" aria-label="Tilt the view" title="Tilt: low, normal, from above">⦨</button><button class="mbtn sm" data-a="mturn" data-k="1" aria-label="Turn right" title="Turn right">⟳</button></div>`
    );
  {
    const mv = box.querySelector('.mapview');
    if (mv) mv.hidden = MGL.flat;
  }
  ctl && ctl.querySelector('[data-a=mflat]').classList.toggle('on', MGL.flat);
  let pl = box.querySelector('.mplaces');
  if (MGL.list) {
    if (!pl) {
      box.insertAdjacentHTML('beforeend', '<div class="mplaces glass" role="dialog" aria-label="Places"></div>');
      pl = box.querySelector('.mplaces');
    }
    pl.innerHTML = mglPlacesHTML();
  } else if (pl) pl.remove();
}
function mglPlacesHTML() {
  const rows = ROUTE.map((n, i) => {
    const st = mglPinState(i),
      t = i === S.route.node ? null : tripTo(i),
      locked = st.cls.includes('locked');
    const sub =
      i === S.route.node
        ? 'You are here'
        : locked
          ? 'Locked'
          : t
            ? `${fmt(t.steps)} steps${S.visited[i] ? '' : ' · new'}`
            : 'No road yet';
    return { i, n, st, sub, g: i === S.route.node ? 0 : locked ? 3 : S.visited[i] ? 1 : 2, steps: t ? t.steps : 1e9 };
  });
  rows.sort((a, b) => a.g - b.g || a.steps - b.steps);
  const G = ['Here', 'Visited', 'Not visited yet', 'Locked'];
  let h =
      '<div class="mpl-head"><b>Places</b><button class="mbtn sm" data-a="mlist" aria-label="Close">×</button></div><div class="mpl-body">',
    g = -1;
  for (const r of rows) {
    if (r.g !== g) {
      g = r.g;
      h += `<div class="mpl-g">${G[g]}</div>`;
    }
    h += `<button class="mpl-row ${r.st.cls.replace('mpin', '')}" data-a="msel" data-n="${r.i}"><span class="mp-i">${uiIco(r.st.ico, 14)}</span><span class="mpl-n">${esc(r.n.name)}<small>${esc(placeSub(r.n))}</small></span><span class="mpl-s">${esc(r.sub)}</span></button>`;
  }
  return h + '</div>';
}
export function mapGLAction(a, d) {
  if (a === 'mturn' && !MGL.flat) {
    mglEase('yaw', MAP.yaw + ((+d.k || 1) * Math.PI) / 4);
    return true;
  }
  if (a === 'mtilt' && !MGL.flat) {
    const T = [0.28, 0.5733, 1.15],
      cur = MAP.tilt ?? 0.5733,
      i = T.findIndex(v => v > cur + 0.05);
    mglEase('tilt', T[i < 0 ? 0 : i]);
    return true;
  }
  if (a === 'mflat') {
    MGL.flat = !MGL.flat;
    if (MGL.flat) {
      const [u, v] = mglUV(MAP.focus || mePos());
      MGL.fv.u = u;
      MGL.fv.v = v;
      MGL.fv.s = Math.max(mglFlatMin(), MGL.fv.s);
    }
    MGL.altT = null;
    MAP.dirty = true;
    mglChrome();
    return true;
  }
  if (a === 'mlist') {
    MGL.list = !MGL.list;
    mglChrome();
    return true;
  }
  if (a === 'msel' && MGL.list && innerWidth < 850) {
    MGL.list = false;
    setTimeout(mglChrome, 0);
  }
  return false;
}
/* ================= v32: 3D MINIATURES =================
   Each stop stands on the globe as a little model built from its own walk scene: the ground as blocks one metre
   across at their real heights (terraces and cliffs read as steps), coloured by what's painted there, water a little
   lower and blue; every building a block with a pitched roof in its own wall and roof colours; trees as cones (pines)
   or rounded crowns on a trunk; big rocks as stones. The light is worked into the colours once (from above, as the
   sun in the middle of the world shines, a little from the side so the shapes read). Built when first seen and
   rebuilt when the scene changes (Studio edits, new districts). */
export const MM = { cache: new Map(), col: new WeakMap(), on: true };
MGL_SH.mmini = [
  `#version 300 es
precision highp float;in vec3 aPos;in vec3 aUV;uniform mat4 uVP;out vec3 vW;out vec3 vC;void main(){vW=aPos;vC=aUV;gl_Position=uVP*vec4(aPos,1.);}`,
  `#version 300 es
precision highp float;in vec3 vW;in vec3 vC;out vec4 o;uniform vec3 uC,uHaze;void main(){float d=length(vW-uC),fk=1.-exp(-max(0.,d-.3)*.72);o=vec4(mix(vC,uHaze,clamp(fk,0.,.86)),1.);}`,
];
export function mmOn() {
  return MM.on && (eng('world', 'mini3d') ?? true) !== false;
}
/* average colours of a picture's upper and lower parts (roof and walls of a building, crown and trunk of a tree) */
function mmCols(im) {
  let c = MM.col.get(im);
  if (c) return c;
  c = { top: [0.5, 0.5, 0.5], mid: [0.6, 0.6, 0.6], low: [0.5, 0.45, 0.4] };
  try {
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      k = Math.min(1, 64 / Math.max(w, h)),
      W = Math.max(1, Math.round(w * k)),
      H = Math.max(1, Math.round(h * k)),
      cv = cnv(W, H),
      x = cv.getContext('2d');
    x.drawImage(im, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H).data;
    const avg = (y0, y1, x0 = 0.2, x1 = 0.8) => {
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let y = Math.floor(y0 * H); y < Math.ceil(y1 * H); y++)
        for (let X = Math.floor(x0 * W); X < Math.ceil(x1 * W); X++) {
          const q = (y * W + X) * 4;
          if (d[q + 3] < 128) continue;
          r += d[q];
          g += d[q + 1];
          b += d[q + 2];
          n++;
        }
      return n ? [r / n / 255, g / n / 255, b / n / 255] : null;
    };
    c = { top: avg(0.05, 0.4) || c.top, mid: avg(0.45, 0.8) || c.mid, low: avg(0.82, 1, 0.35, 0.65) || c.low };
  } catch (e) {}
  MM.col.set(im, c);
  return c;
}
function mmKey(sc) {
  return [
    sc.w,
    sc.h,
    (sc.props || []).length,
    (sc.tiles || []).join('').length,
    sc.steps ? sc.steps.length : 0,
    sc.heights ? sc.heights.length : 0,
    typeof dioArtVer === 'function' ? dioArtVer() : 0,
  ].join('|');
}
export function mmBuild(i) {
  const r = ROUTE[i],
    sc = r && r.scene && mapById(r.scene);
  if (!sc || !sc.w) return null;
  const C0 = walkData().sc,
    W = sc.w,
    H = sc.h,
    town = !!r.town;
  const v = mglLift(MNV[i]),
    U = v3.norm(v3.mul(v, -1)),
    E0 = v3.norm(v3.cross(v, [0, 1, 0])),
    E = v3.len(E0) > 0.1 ? E0 : [1, 0, 0],
    N = v3.norm(v3.cross(U, E)),
    span = 0.088 * (town ? 1.15 : 1),
    k = span / Math.max(W, H),
    vex = 1.7;
  const L = v3.norm(v3.add(v3.add(v3.mul(U, 0.82), v3.mul(E, -0.42)), v3.mul(N, -0.3)));
  const V = [],
    I = [];
  let top = 0;
  const P = (x, y, z) => [
    v[0] + (E[0] * (x - W / 2) + N[0] * (z - H / 2)) * k + U[0] * y * k * vex,
    v[1] + (E[1] * (x - W / 2) + N[1] * (z - H / 2)) * k + U[1] * y * k * vex,
    v[2] + (E[2] * (x - W / 2) + N[2] * (z - H / 2)) * k + U[2] * y * k * vex,
  ];
  /* a flat-shaded face: four corners in scene metres (x, height, z), a colour; the light is worked in here */
  const quad = (a, b, c, d, col, nl) => {
    let n = nl || v3.norm(v3.cross(v3.sub(b, a), v3.sub(d, a)));
    if (!nl && n[1] < 0) n = v3.mul(n, -1);
    const wn = v3.norm(v3.add(v3.add(v3.mul(E, n[0]), v3.mul(U, n[1])), v3.mul(N, n[2]))),
      lit = 0.58 + 0.52 * Math.max(0, v3.dot(wn, L));
    const b0 = V.length / 6;
    for (const q of [a, b, c, d]) {
      const p = P(q[0], q[1], q[2]);
      V.push(p[0], p[1], p[2], col[0] * lit, col[1] * lit, col[2] * lit);
      if (q[1] > top) top = q[1];
    }
    I.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  };
  const box = (x0, z0, x1, z1, y0, y1, c) => {
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], c, [0, 1, 0]);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], c, [0, 0, -1]);
    quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], c, [0, 0, 1]);
    quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], c, [-1, 0, 0]);
    quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], c, [1, 0, 0]);
  };
  /* the ground: one block per metre (routes: two) at its height, sides dropping to the lower neighbour */
  const rows = sc.tiles || [],
    tcol = ch => {
      const T = C0.terrains[ch] || C0.terrains[sc.edge] || {};
      return hexA(T.edge || '#4A7A3C').map(c => c / 255);
    },
    cs = town ? 1 : 2,
    base = -1.2;
  const hAt = (x, z) => {
    const ch = (rows[H - 1 - Math.floor(z)] || '')[Math.floor(x)] || sc.edge;
    let h = dioHRaw(sc, x, z) + dioStep(x, z, sc);
    if (ch === 'w' || ch === 'd') h -= 0.35;
    return h;
  };
  const nx = Math.ceil(W / cs),
    nz = Math.ceil(H / cs),
    HG = new Float32Array(nx * nz),
    CG = [];
  for (let j = 0; j < nz; j++)
    for (let i2 = 0; i2 < nx; i2++) {
      const x = (i2 + 0.5) * cs,
        z = (j + 0.5) * cs;
      HG[j * nx + i2] = hAt(Math.min(W - 0.1, x), Math.min(H - 0.1, z));
      const ch = (rows[H - 1 - Math.floor(Math.min(H - 0.1, z))] || '')[Math.floor(Math.min(W - 0.1, x))] || sc.edge;
      CG.push(tcol(ch));
    }
  for (let j = 0; j < nz; j++)
    for (let i2 = 0; i2 < nx; i2++) {
      const q = j * nx + i2,
        h = HG[q],
        c = CG[q],
        x0 = i2 * cs,
        x1 = Math.min(W, x0 + cs),
        z0 = j * cs,
        z1 = Math.min(H, z0 + cs);
      quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], c, [0, 1, 0]);
      const side = c.map(u => u * 0.72);
      const nb = (a, b) => (a < 0 || b < 0 || a >= nx || b >= nz ? base : HG[b * nx + a]);
      {
        const n = nb(i2, j - 1);
        if (n < h - 0.05)
          quad([x0, n, z0], [x1, n, z0], [x1, h, z0], [x0, h, z0], j === 0 ? [0.36, 0.27, 0.2] : side, [0, 0, -1]);
      }
      {
        const n = nb(i2, j + 1);
        if (n < h - 0.05) quad([x1, n, z1], [x0, n, z1], [x0, h, z1], [x1, h, z1], side, [0, 0, 1]);
      }
      {
        const n = nb(i2 - 1, j);
        if (n < h - 0.05)
          quad([x0, n, z1], [x0, n, z0], [x0, h, z0], [x0, h, z1], i2 === 0 ? [0.36, 0.27, 0.2] : side, [-1, 0, 0]);
      }
      {
        const n = nb(i2 + 1, j);
        if (n < h - 0.05)
          quad([x1, n, z0], [x1, n, z1], [x1, h, z1], [x1, h, z0], i2 === nx - 1 ? [0.36, 0.27, 0.2] : side, [1, 0, 0]);
      }
    }
  /* buildings, trees, big rocks */
  const PPU = C0.ppu || 34;
  let trees = 0;
  const props = (sc.props || [])
    .slice()
    .sort(
      (a, b) => dioHash(Math.round(a.x * 7), Math.round(a.z * 5)) - dioHash(Math.round(b.x * 7), Math.round(b.z * 5))
    );
  for (const p of props) {
    const M = C0.props[p.k];
    if (!M) continue;
    const g = (M.group || p.k) + ' ' + p.k,
      s = p.s || 1,
      im = artImage(M.img),
      hpx = -(M.oy || 0),
      hm = (hpx * s) / PPU,
      y = hAt(Math.min(W - 0.1, Math.max(0, p.x)), Math.min(H - 0.1, Math.max(0, p.z + 0.3)));
    if (p.x < 0 || p.z < 0 || p.x > W || p.z > H) continue;
    const cols = im && imageReady(im) ? mmCols(im) : null;
    if (
      M.box &&
      (M.door ||
        M.build ||
        /house|shop|clinic|lab|tower|apartment|hall|villa|chalet|mart|cafe|boutique|windmill/.test(g))
    ) {
      const w = M.box[0] * s,
        d = M.box[1] * s,
        wall = cols ? cols.mid : [0.8, 0.75, 0.65],
        roof = cols ? cols.top : [0.6, 0.3, 0.25],
        wh = Math.max(1.6, hm * 0.55),
        rh = Math.min(w, d) * 0.35 + 0.4,
        x0 = p.x - w / 2,
        x1 = p.x + w / 2,
        z0 = p.z,
        z1 = p.z + d;
      box(x0, z0, x1, z1, y - 0.3, y + wh, wall);
      const ym = y + wh + rh,
        zm = (z0 + z1) / 2;
      /* a pitched roof along the width, with a little overhang */ const o = 0.25;
      quad([x0 - o, y + wh, z0 - o], [x1 + o, y + wh, z0 - o], [x1 + o, ym, zm], [x0 - o, ym, zm], roof);
      quad(
        [x1 + o, y + wh, z1 + o],
        [x0 - o, y + wh, z1 + o],
        [x0 - o, ym, zm],
        [x1 + o, ym, zm],
        roof.map(u => u * 0.85)
      );
      quad(
        [x0, y + wh, z1],
        [x0, y + wh, z0],
        [x0, ym, zm],
        [x0, ym, zm],
        wall.map(u => u * 0.9),
        [-1, 0, 0]
      );
      quad(
        [x1, y + wh, z0],
        [x1, y + wh, z1],
        [x1, ym, zm],
        [x1, ym, zm],
        wall.map(u => u * 0.9),
        [1, 0, 0]
      );
      continue;
    }
    if (/tree|palm/.test(g) && trees < (town ? 70 : 110)) {
      trees++;
      const th = Math.max(1.6, hm),
        cr = cols ? cols.top : [0.25, 0.5, 0.25],
        tr = cols ? cols.low : [0.4, 0.28, 0.18],
        r = Math.max(0.6, th * (/pine|snow/.test(g) ? 0.3 : 0.36)) * (/small/.test(p.k) ? 0.8 : 1),
        tx = p.x,
        tz = p.z + 0.2,
        tk = 0.14 + r * 0.08;
      box(tx - tk, tz - tk, tx + tk, tz + tk, y, y + th * 0.42, tr);
      const cy = y + th * (/pine|snow/.test(g) ? 0.2 : 0.36);
      if (/pine|snow/.test(g)) {
        /* a cone: four sloping faces */ const tt = y + th;
        for (const [a, b] of [
          [
            [-1, -1],
            [1, -1],
          ],
          [
            [1, -1],
            [1, 1],
          ],
          [
            [1, 1],
            [-1, 1],
          ],
          [
            [-1, 1],
            [-1, -1],
          ],
        ])
          quad([tx + a[0] * r, cy, tz + a[1] * r], [tx + b[0] * r, cy, tz + b[1] * r], [tx, tt, tz], [tx, tt, tz], cr);
      } else {
        /* a rounded crown: an octagon prism with bevelled top and bottom */ const c0 = cy + th * 0.1,
          c1 = y + th * 0.8,
          tt = y + th,
          bt = cy;
        const ring = [];
        for (let a = 0; a < 8; a++) {
          const an = (a / 8) * Math.PI * 2 + 0.39;
          ring.push([Math.cos(an) * r, Math.sin(an) * r]);
        }
        for (let a = 0; a < 8; a++) {
          const A = ring[a],
            Bq = ring[(a + 1) % 8];
          quad(
            [tx + A[0], c0, tz + A[1]],
            [tx + Bq[0], c0, tz + Bq[1]],
            [tx + Bq[0], c1, tz + Bq[1]],
            [tx + A[0], c1, tz + A[1]],
            cr
          );
          quad(
            [tx + A[0], c1, tz + A[1]],
            [tx + Bq[0], c1, tz + Bq[1]],
            [tx + Bq[0] * 0.45, tt, tz + Bq[1] * 0.45],
            [tx + A[0] * 0.45, tt, tz + A[1] * 0.45],
            cr.map(u => u * 1.08)
          );
          quad(
            [tx + Bq[0], c0, tz + Bq[1]],
            [tx + A[0], c0, tz + A[1]],
            [tx + A[0] * 0.5, bt, tz + A[1] * 0.5],
            [tx + Bq[0] * 0.5, bt, tz + Bq[1] * 0.5],
            cr.map(u => u * 0.8)
          );
        }
      }
      continue;
    }
    if (/boulder|basalt_columns|mesa/.test(g)) {
      const r = Math.max(0.4, hm * 0.45),
        c = cols ? cols.mid : [0.5, 0.5, 0.5];
      box(p.x - r, p.z - r * 0.6, p.x + r, p.z + r * 0.6, y - 0.1, y + Math.max(0.5, hm * 0.7), c);
    }
  }
  if (!V.length) return null;
  const mesh = eglMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aUV', 3, 12],
    ],
    24
  );
  mesh.top = v3.add(v, v3.mul(U, (top + 0.6) * k * vex));
  mesh.v = v;
  return mesh;
}
function mmGet(i) {
  const r = ROUTE[i],
    sc = r && r.scene && mapById(r.scene);
  if (!sc) return null;
  const key = mmKey(sc) + '|' + (MGL.hpix ? 1 : 0),
    e = MM.cache.get(i);
  if (e && e.key === key && e.gl === EGL.gl) return e.m;
  if (MM.busy > 0) return e && e.gl === EGL.gl ? e.m : null;
  MM.busy = (MM.busy || 0) + 1;
  let m = null;
  try {
    m = mmBuild(i);
  } catch (err) {
    console.warn('mini', err);
  }
  if (e && e.m && e.gl === EGL.gl) eglFree(e.m);
  MM.cache.set(i, { key, m, gl: EGL.gl });
  return m;
}
function mmDraw(cam) {
  if (!mmOn() || MGL.flat) return false;
  const gl = EGL.gl;
  eglPrograms({ mmini: MGL_SH.mmini });
  const p = EGL.P.mmini;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, mglMat(cam));
  gl.uniform3fv(p.U.uC, cam.C);
  gl.uniform3fv(p.U.uHaze, [176 / 255, 186 / 255, 236 / 255]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  MM.busy = 0;
  ROUTE.forEach((r, i) => {
    const d = v3.sub(MNV[i], cam.C),
      z = v3.dot(d, cam.fw);
    if (z < 0.005 || z > 1.3) return;
    const m = mmGet(i);
    if (!m) return;
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0);
  });
  gl.bindVertexArray(null);
  return true;
}
