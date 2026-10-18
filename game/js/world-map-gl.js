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
import { artLoad, artPixels, hexToRgb, makeCanvas, uiIconHTML, worldMapStamp } from './art.js';
import { owFrames, portraitHTML } from './person-art.js';
import { EASE } from './battle-stage.js';
import { artImage, hash2d, imageReady, mapById, stepRaiseAt, walkData, walkView } from './walk-view.js';
import { engineContext, engineDataSource, engineSetting } from './engine/settings.js';
import {
  bindQuad,
  ensurePrograms,
  freeMesh,
  gpuState,
  imageTexture,
  initWebgl,
  renderTarget,
  uploadMesh,
  webgl2Supported,
} from './engine/webgl.js';
import { POST_EFFECT_SHADERS, drawPostEffects, projectToScreenUv } from './engine/post-effects.js';
import { rawHeightAt, walkRenderer, worldMapTexture } from './walk-view-gl.js';
import {
  LOCATION_VECTORS,
  RADIANS_PER_DEGREE,
  REGION_VECTORS,
  WORLD_MAP_CLOUDS,
  WORLD_MAP_LANDMARKS,
  roadPosition,
  setWorldMapFit,
  setWorldMapHeight,
  setWorldMapLabels,
  setWorldMapMount,
  setWorldMapReset,
  setWorldMapWidth,
  setWorldMapZoom,
  slerp,
  sunBlocks,
  vector3,
  worldMap,
  worldMapCamera,
  worldMapFit,
  worldMapHeight,
  worldMapLabels,
  worldMapMount,
  worldMapPlayerPosition,
  worldMapProject,
  worldMapReset,
  worldMapSelect,
  worldMapWalk,
  worldMapWidth,
  worldMapZoom,
} from './world-map.js';
/* eslint-disable no-func-assign */
expose({
  MINI_PICTURE_SCALE: [() => MINI_PICTURE_SCALE],
  WORLD_MAP_GL_ALTITUDE_RANGE: [() => WORLD_MAP_GL_ALTITUDE_RANGE],
  WORLD_MAP_GL_FAR: [() => WORLD_MAP_GL_FAR],
  WORLD_MAP_GL_NEAR: [() => WORLD_MAP_GL_NEAR],
  WORLD_MAP_GL_SHADERS: [() => WORLD_MAP_GL_SHADERS],
  WORLD_MAP_GL_TILT_RANGE: [() => WORLD_MAP_GL_TILT_RANGE],
  WORLD_RELIEF: [() => WORLD_RELIEF],
  cpuWorldMapLabels: [() => cpuWorldMapLabels],
  cpuWorldMapMount: [() => cpuWorldMapMount],
  cpuWorldMapReset: [() => cpuWorldMapReset],
  cpuWorldMapZoom: [() => cpuWorldMapZoom],
  setWorldMapGlRender: [() => setWorldMapGlRender, v => (setWorldMapGlRender = v)],
  worldMapGl: [() => worldMapGl],
  worldMapGlAction: [() => worldMapGlAction, v => (worldMapGlAction = v)],
  worldMapGlCanvas: [() => worldMapGlCanvas, v => (worldMapGlCanvas = v)],
  worldMapGlChrome: [() => worldMapGlChrome, v => (worldMapGlChrome = v)],
  worldMapGlEase: [() => worldMapGlEase, v => (worldMapGlEase = v)],
  worldMapGlFlatMin: [() => worldMapGlFlatMin],
  worldMapGlHeightTexture: [() => worldMapGlHeightTexture, v => (worldMapGlHeightTexture = v)],
  worldMapGlLift: [() => worldMapGlLift, v => (worldMapGlLift = v)],
  worldMapGlLine: [() => worldMapGlLine, v => (worldMapGlLine = v)],
  worldMapGlLocationListHTML: [() => worldMapGlLocationListHTML, v => (worldMapGlLocationListHTML = v)],
  worldMapGlLonLat: [() => worldMapGlLonLat],
  worldMapGlLoop: [() => worldMapGlLoop, v => (worldMapGlLoop = v)],
  worldMapGlMatrix: [() => worldMapGlMatrix, v => (worldMapGlMatrix = v)],
  worldMapGlMiniPicture: [() => worldMapGlMiniPicture, v => (worldMapGlMiniPicture = v)],
  worldMapGlMiniPictures: [() => worldMapGlMiniPictures, v => (worldMapGlMiniPictures = v)],
  worldMapGlMiniTop: [() => worldMapGlMiniTop, v => (worldMapGlMiniTop = v)],
  worldMapGlOverlay: [() => worldMapGlOverlay, v => (worldMapGlOverlay = v)],
  worldMapGlPanTo: [() => worldMapGlPanTo, v => (worldMapGlPanTo = v)],
  worldMapGlPath: [() => worldMapGlPath, v => (worldMapGlPath = v)],
  worldMapGlPick: [() => worldMapGlPick, v => (worldMapGlPick = v)],
  worldMapGlPinState: [() => worldMapGlPinState, v => (worldMapGlPinState = v)],
  worldMapGlPinUp: [() => worldMapGlPinUp, v => (worldMapGlPinUp = v)],
  worldMapGlPinch: [() => worldMapGlPinch],
  worldMapGlPins: [() => worldMapGlPins, v => (worldMapGlPins = v)],
  worldMapGlProject: [() => worldMapGlProject, v => (worldMapGlProject = v)],
  worldMapGlReady: [() => worldMapGlReady, v => (worldMapGlReady = v)],
  worldMapGlRender: [() => worldMapGlRender, v => setWorldMapGlRender(v)],
  worldMapGlSize: [() => worldMapGlSize, v => (worldMapGlSize = v)],
  worldMapGlUV: [() => worldMapGlUV, v => (worldMapGlUV = v)],
  worldMapGlWanted: [() => worldMapGlWanted, v => (worldMapGlWanted = v)],
  worldMapMiniBuild: [() => worldMapMiniBuild, v => setWorldMapMiniBuild(v)],
  worldMapMiniColors: [() => worldMapMiniColors, v => (worldMapMiniColors = v)],
  worldMapMiniDraw: [() => worldMapMiniDraw, v => (worldMapMiniDraw = v)],
  worldMapMiniGet: [() => worldMapMiniGet, v => (worldMapMiniGet = v)],
  worldMapMiniKey: [() => worldMapMiniKey, v => (worldMapMiniKey = v)],
  worldMapMinis: [() => worldMapMinis],
  worldMapMinisOn: [() => worldMapMinisOn, v => (worldMapMinisOn = v)],
});
/* eslint-enable no-func-assign */
export function setWorldMapMiniBuild(v) {
  worldMapMiniBuild = v; // eslint-disable-line no-func-assign
  provide({ worldMapMiniBuild });
}
/* to-module: end */
export const worldMapGl = {
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
const WORLD_MAP_GL_NEAR = 0.002,
  WORLD_MAP_GL_FAR = 3;
export const WORLD_MAP_GL_SHADERS = {
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
 o=vec4(col,1.);float z=th*dot(d,uFw);gl_FragDepth=((${((WORLD_MAP_GL_FAR + WORLD_MAP_GL_NEAR) / (WORLD_MAP_GL_FAR - WORLD_MAP_GL_NEAR)).toFixed(6)})-(${((2 * WORLD_MAP_GL_FAR * WORLD_MAP_GL_NEAR) / (WORLD_MAP_GL_FAR - WORLD_MAP_GL_NEAR)).toFixed(6)})/max(z,1e-4))*.5+.5;}`,
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
export function worldMapGlWanted() {
  return typeof gpuState !== 'undefined' && !gpuState.fail && !gpuState.lost && webgl2Supported();
}
function worldMapGlCanvas() {
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  return cv;
}
function worldMapGlReady() {
  if (!worldMapGlWanted()) return false;
  const cv = worldMapGlCanvas();
  if (gpuState.cv !== cv) {
    if (walkView.cv && walkView.cv !== cv) return false;
    if (!initWebgl(cv)) {
      gpuState.fail = 1;
      return false;
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.gkey = '';
      walkRenderer.farKey = '';
      walkRenderer.wtex = null;
    }
  }
  try {
    ensurePrograms(WORLD_MAP_GL_SHADERS);
    ensurePrograms(POST_EFFECT_SHADERS);
  } catch (e) {
    console.error(e);
    gpuState.fail = 1;
    return false;
  }
  cv.hidden = false;
  cv.classList.add('gl', 'in');
  return true;
}
/* ---------- projection (globe or flat) ---------- */
const worldMapGlLonLat = v => [Math.atan2(v[2], v[0]), Math.asin(clamp(v[1], -1, 1))];
function worldMapGlUV(v) {
  const [lon, lat] = worldMapGlLonLat(v);
  return [(lon / (Math.PI * 2) + 1) % 1, 0.5 - lat / Math.PI];
}
function worldMapGlProject(v) {
  if (!worldMapGl.flat) {
    const q = worldMapProject(worldMap.cam, v);
    if (!q || sunBlocks(worldMap.cam, v)) return null;
    return q;
  }
  const F = worldMapGl.fv,
    [u, vv] = worldMapGlUV(v);
  let du = u - F.u;
  du -= Math.round(du);
  return { x: worldMapWidth / 2 + du * F.s, y: worldMapHeight / 2 + (vv - F.v) * F.s * 0.5, z: 0.5 };
}
function worldMapGlMatrix(cam) {
  const ax = (2 * cam.foc) / worldMapWidth,
    ay = (2 * cam.foc) / worldMapHeight,
    A = (WORLD_MAP_GL_FAR + WORLD_MAP_GL_NEAR) / (WORLD_MAP_GL_FAR - WORLD_MAP_GL_NEAR),
    B = (-2 * WORLD_MAP_GL_FAR * WORLD_MAP_GL_NEAR) / (WORLD_MAP_GL_FAR - WORLD_MAP_GL_NEAR),
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
const cpuWorldMapMount = worldMapMount,
  cpuWorldMapLabels = worldMapLabels,
  cpuWorldMapZoom = worldMapZoom,
  cpuWorldMapReset = worldMapReset;
setWorldMapMount(function () {
  const cv = $('#mapcv');
  if (!cv) return;
  if (!worldMapGlReady()) {
    worldMap.gl = false;
    document.body.classList.remove('map-gl');
    return cpuWorldMapMount();
  }
  worldMap.gl = true;
  document.body.classList.add('map-gl');
  worldMap.cv = cv;
  worldMap.ctx = cv.getContext('2d');
  worldMapGl.pins = null;
  worldMapGlSize();
  const to = worldMapPlayerPosition();
  if (!worldMap.me) worldMap.me = to;
  else if (vector3.dot(worldMap.me, to) < 0.999999) worldMapWalk(worldMap.me, to);
  if (!worldMap.focus) worldMap.focus = to;
  /* arriving from the walk screen: start close to you and pull back */
  if (U.mglFrom === 'walk' && !RM && !worldMapGl.flat) {
    worldMap.alt = 0.11;
    worldMapGl.altT = 0.32;
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
      worldMap.drag = {
        x: e.clientX,
        y: e.clientY,
        yaw: worldMap.yaw,
        pitch: worldMap.pitch,
        tilt: worldMap.tilt ?? 0.5733,
        focus: worldMap.focus || worldMapPlayerPosition(),
        cam: worldMap.cam,
        fu: worldMapGl.fv.u,
        fv: worldMapGl.fv.v,
        moved: 0,
        id: e.pointerId,
        turn: e.button === 2 || e.shiftKey || e.ctrlKey,
        g: null,
        alt: worldMap.alt,
        s: worldMapGl.fv.s,
      };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const D = worldMap.drag;
      if (!D) return;
      if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size > 1) {
        const g = two();
        if (!D.g) {
          D.g = g;
          D.alt = worldMap.alt;
          D.s = worldMapGl.fv.s;
          D.yaw = worldMap.yaw;
          D.tilt = worldMap.tilt ?? 0.5733;
        }
        const k = D.g.d / Math.max(1, g.d);
        if (worldMapGl.flat) worldMapGl.fv.s = clamp(D.s / k, worldMapGlFlatMin(), worldMapWidth * 8);
        else {
          worldMap.alt = clamp(D.alt * k, WORLD_MAP_GL_ALTITUDE_RANGE[0], WORLD_MAP_GL_ALTITUDE_RANGE[1]);
          let da = g.ang - D.g.ang;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          worldMap.yaw = D.yaw - da;
          worldMap.tilt = clamp(
            D.tilt + (g.my - D.g.my) * 0.004,
            WORLD_MAP_GL_TILT_RANGE[0],
            WORLD_MAP_GL_TILT_RANGE[1]
          );
        }
        D.moved = 1;
        worldMapGl.altT = null;
        worldMap.dirty = true;
        return;
      }
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) D.moved = 1;
      if (!D.moved) return;
      if (worldMapGl.flat) {
        worldMapGl.fv.u = D.fu - dx / worldMapGl.fv.s;
        worldMapGl.fv.v = clamp(D.fv - dy / (worldMapGl.fv.s * 0.5), 0, 1);
      } else if (D.turn) {
        worldMap.yaw = D.yaw - dx * 0.006;
        worldMap.tilt = clamp(D.tilt + dy * 0.004, WORLD_MAP_GL_TILT_RANGE[0], WORLD_MAP_GL_TILT_RANGE[1]);
      } else worldMapGlPanTo(D, dx, dy);
      worldMap.dirty = true;
    });
    const up = e => {
      pts.delete(e.pointerId);
      const D = worldMap.drag;
      if (pts.size) {
        if (D) D.g = null;
        return;
      }
      worldMap.drag = null;
      worldMap.dirty = true;
      if (D && !D.moved && e.type === 'pointerup') worldMapGlPick(e);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        if (e.shiftKey && !worldMapGl.flat) {
          worldMap.yaw += (e.deltaY || e.deltaX) * 0.003;
          worldMap.dirty = true;
          return;
        }
        const k = e.deltaY > 0 ? 1.12 : 0.89;
        if (worldMapGl.flat) worldMapGl.fv.s = clamp(worldMapGl.fv.s / k, worldMapGlFlatMin(), worldMapWidth * 8);
        else worldMap.alt = clamp(worldMap.alt * k, WORLD_MAP_GL_ALTITUDE_RANGE[0], WORLD_MAP_GL_ALTITUDE_RANGE[1]);
        worldMapGl.altT = null;
        worldMap.dirty = true;
      },
      { passive: false }
    );
    cv.tabIndex = 0;
    cv.addEventListener('keydown', e => {
      if (worldMapGl.flat) return;
      const k = e.key,
        D = { focus: worldMap.focus || worldMapPlayerPosition(), cam: worldMap.cam };
      let used = 1;
      if (k === 'ArrowLeft' || k === 'a') worldMapGlPanTo(D, 60, 0);
      else if (k === 'ArrowRight' || k === 'd') worldMapGlPanTo(D, -60, 0);
      else if (k === 'ArrowUp' || k === 'w') worldMapGlPanTo(D, 0, 60);
      else if (k === 'ArrowDown' || k === 's') worldMapGlPanTo(D, 0, -60);
      else if (k === 'q') worldMap.yaw -= 0.2;
      else if (k === 'e') worldMap.yaw += 0.2;
      else if (k === '+' || k === '=') worldMapZoom(0.8);
      else if (k === '-') worldMapZoom(1.25);
      else used = 0;
      if (used) {
        e.preventDefault();
        worldMap.dirty = true;
      }
    });
  }
  worldMapGlChrome();
  if (!worldMap.on) {
    worldMap.on = true;
    worldMap.last = performance.now();
    frameTask('map', worldMapGlLoop);
  }
});
const worldMapGlPinch = pts => {
  const [a, b] = [...pts.values()];
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
};
const WORLD_MAP_GL_ALTITUDE_RANGE = [0.022, 0.7],
  WORLD_MAP_GL_TILT_RANGE = [0.2, 1.35];
/* drag the land: the spot under the middle of the view slides with your finger, across the inside of the world */
/* a smooth turn or tilt from the buttons */
function worldMapGlEase(k, to) {
  const from = worldMap[k] ?? (k === 'tilt' ? 0.5733 : 0),
    t0 = performance.now();
  const step = () => {
    const f = Math.min(1, (performance.now() - t0) / 380),
      e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    worldMap[k] = from + (to - from) * e;
    worldMap.dirty = true;
    if (f < 1) requestAnimationFrame(step);
  };
  step();
}
function worldMapGlPanTo(D, dx, dy) {
  const cam = D.cam || worldMap.cam;
  if (!cam) return;
  const P0 = D.focus,
    n = vector3.mul(P0, -1),
    tang = v => {
      const t = vector3.sub(v, vector3.mul(n, vector3.dot(v, n)));
      return vector3.len(t) > 1e-6 ? vector3.norm(t) : null;
    };
  const rt = tang(cam.rt),
    fw = tang(cam.fw) || tang(vector3.mul(cam.up, -1));
  if (!rt || !fw) return;
  const s = (worldMap.alt * 1.84) / cam.foc;
  worldMap.focus = vector3.norm(vector3.add(P0, vector3.add(vector3.mul(rt, -dx * s), vector3.mul(fw, dy * s))));
  worldMap.free = true;
  worldMap.fT = null;
}
const worldMapGlFlatMin = () => Math.max(worldMapWidth, worldMapHeight * 2) * 0.9;
export function worldMapGlSize() {
  const cv = worldMap.cv,
    r = cv && cv.isConnected ? cv.getBoundingClientRect() : null,
    w = Math.round(r && r.width > 20 ? r.width : innerWidth),
    h = Math.round(r && r.height > 20 ? r.height : innerHeight);
  if (w !== worldMapWidth || h !== worldMapHeight) {
    setWorldMapWidth(w);
    setWorldMapHeight(h);
    worldMap.dirty = true;
  }
  worldMap.s = 1;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (cv && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  worldMapGl.dpr = dpr;
  if (worldMapGl.fv.s < worldMapGlFlatMin()) worldMapGl.fv.s = worldMapGlFlatMin();
}
function worldMapGlLoop(ts) {
  if (!worldMap.cv || !worldMap.cv.isConnected || !worldMap.gl) {
    worldMap.on = false;
    frameStop('map');
    return;
  }
  if (gpuState.lost) return;
  let moving = false;
  if (worldMap.fly && typeof flyTick === 'function' && flyTick(ts)) moving = true;
  if (worldMap.anim) {
    const a = worldMap.anim,
      k = Math.min(1, (ts - a.t0) / a.dur);
    worldMap.me = vector3.norm(slerp(a.from, a.to, EASE.io(k)));
    moving = k < 1;
    worldMap.face = 'up';
    if (k >= 1) {
      worldMap.anim = null;
      worldMap.me = a.to;
    }
  }
  worldMap.moving = moving;
  let panning = false;
  if (worldMap.fT) {
    const a = worldMap.fT,
      k = Math.min(1, (ts - a.t0) / a.dur);
    worldMap.focus = vector3.norm(slerp(a.from, a.to, EASE.io(k)));
    panning = k < 1;
    if (k >= 1) worldMap.fT = null;
    if (worldMapGl.flat) {
      const [u, v] = worldMapGlUV(worldMap.focus);
      worldMapGl.fv.u = u;
      worldMapGl.fv.v = v;
    }
  } else if (U.mapSel == null && worldMap.me && !worldMapGl.flat && !worldMap.free) worldMap.focus = worldMap.me;
  if (worldMapGl.altT != null) {
    worldMap.alt += (worldMapGl.altT - worldMap.alt) * Math.min(1, (ts - (worldMapGl.lastT || ts)) / 260);
    if (Math.abs(worldMapGl.altT - worldMap.alt) < 0.002) {
      worldMap.alt = worldMapGl.altT;
      worldMapGl.altT = null;
    }
    panning = true;
  }
  const busy = !!(worldMap.drag || moving || panning);
  if (ts - worldMap.lastDraw < (busy ? 1000 / userFps() - 2 : 1000 / 24) && !worldMap.dirty) return;
  worldMap.lastDraw = ts;
  worldMap.dirty = false;
  worldMapGl.lastT = ts;
  const w0 = performance.now();
  worldMapGlSize();
  worldMap.cam = worldMapCamera();
  worldMapGlRender(ts);
  worldMapGlOverlay(ts);
  worldMapGlPins();
  frameCount(performance.now() - w0);
}
/* the land's height (art/map/world_h.png, made by tools/build-world-relief.py) */
export const WORLD_RELIEF = 'map/world_h.png';
function worldMapGlHeightTexture() {
  if (worldMapGl.htex !== undefined && worldMapGl.htex) return worldMapGl.htex;
  const im = typeof artImage === 'function' ? artImage(WORLD_RELIEF) : null;
  if (!im || !imageReady(im)) {
    if (!worldMapGl.hload) {
      worldMapGl.hload = 1;
      artLoad([WORLD_RELIEF])
        .then(() => {
          worldMap.dirty = true;
        })
        .catch(() => {});
    }
    return null;
  }
  const gl = gpuState.gl,
    t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, im);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return (worldMapGl.htex = t);
}
export function worldMapGlRender(t) {
  const es = typeof engineDataSource === 'function' ? engineDataSource() : null;
  engineContext.look = (es && es.map) || null;
  const gl = gpuState.gl,
    cv = gpuState.cv,
    cam = worldMap.cam,
    px = worldMapWidth * worldMapHeight,
    R =
      Math.min(devicePixelRatio || 1, 1.75) *
      Math.min(1, Math.sqrt(1.4e6 / (px * Math.pow(Math.min(devicePixelRatio || 1, 1.75), 2)))),
    rw = Math.max(64, Math.round(worldMapWidth * R)),
    rh = Math.max(64, Math.round(worldMapHeight * R));
  if (cv.width !== rw || cv.height !== rh) {
    cv.width = rw;
    cv.height = rh;
  }
  const S = renderTarget('scene', rw, rh, { depth: true, hdr: true });
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
  let p = gpuState.P.mglobe,
    U2 = p.U;
  gl.useProgram(p.p);
  bindQuad();
  gl.uniform3fv(U2.uC, cam.C);
  gl.uniform3fv(U2.uFw, cam.fw);
  gl.uniform3fv(U2.uRt, cam.rt);
  gl.uniform3fv(U2.uUp, cam.up);
  gl.uniform3fv(U2.uHaze, haze);
  gl.uniform1f(U2.uFoc, cam.foc);
  gl.uniform1f(U2.uR, rw / worldMapWidth);
  gl.uniform1f(U2.uT, t);
  gl.uniform2f(U2.uWH, worldMapWidth, worldMapHeight);
  gl.uniform1f(U2.uFlat, worldMapGl.flat ? 1 : 0);
  gl.uniform3f(U2.uFv, worldMapGl.fv.u, worldMapGl.fv.v, worldMapGl.fv.s);
  const cl = new Float32Array(64);
  WORLD_MAP_CLOUDS.forEach((k, i) => {
    const a = (k.lon + (t / 1000) * k.sp) * RADIANS_PER_DEGREE,
      la = k.lat * RADIANS_PER_DEGREE;
    cl.set([Math.cos(la) * Math.cos(a) * k.alt, Math.sin(la) * k.alt, Math.cos(la) * Math.sin(a) * k.alt, k.r], i * 4);
  });
  gl.uniform4fv(U2.uCl, cl);
  gl.uniform1i(U2.uNCl, worldMapGl.noClouds ? 0 : Math.min(16, WORLD_MAP_CLOUDS.length));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, typeof worldMapTexture === 'function' ? worldMapTexture() : gpuState.white);
  gl.uniform1i(U2.uWorld, 0);
  const HT = worldMapGlHeightTexture();
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, HT || gpuState.white);
  gl.uniform1i(U2.uHgt, 1);
  gl.uniform1f(U2.uRelief, HT ? 0.014 * engineSetting('world', 'relief') : 0);
  gl.uniform3f(U2.uSunL, -0.7, -0.7, 14 * engineSetting('world', 'reliefShade'));
  gl.activeTexture(gl.TEXTURE0);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.depthFunc(gl.LEQUAL);
  if (!worldMapGl.flat) {
    /* landmark stamps standing on the ground */ p = gpuState.P.mspr;
    U2 = p.U;
    gl.useProgram(p.p);
    const vp = worldMapGlMatrix(cam);
    gl.uniformMatrix4fv(U2.uVP, false, vp);
    gl.uniform3fv(U2.uC, cam.C);
    gl.uniform3fv(U2.uHaze, haze);
    gl.uniform1i(U2.uTex, 0);
    /* v24: a miniature of every stop's walk scene, standing on the globe where the stop is (art/map/mini, tools/build-map-minis.py) */
    const m3 = typeof worldMapMiniDraw === 'function' && worldMapMiniDraw(cam);
    if (m3) {
      p = gpuState.P.mspr;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(U2.uVP, false, vp);
      gl.uniform3fv(U2.uC, cam.C);
      gl.uniform3fv(U2.uHaze, haze);
      gl.uniform1i(U2.uTex, 0);
      bindQuad();
    }
    if (!m3)
      worldMapGlMiniPictures(cam, (im, v, k) => {
        const T = imageTexture(im, { noNormal: true });
        if (!T) return;
        const n = vector3.norm(vector3.mul(v, -1)),
          rt = vector3.norm(vector3.sub(cam.rt, vector3.mul(n, vector3.dot(cam.rt, n)))),
          bk = vector3.norm(vector3.cross(rt, n)),
          up = vector3.norm(
            vector3.add(vector3.mul(n, 0.62), vector3.mul(bk, -0.78))
          ); /* laid back like a tabletop seen from above */
        gl.uniform3fv(U2.uP, v);
        gl.uniform3fv(U2.uRt, rt);
        gl.uniform3fv(U2.uUp, up);
        gl.uniform2f(U2.uS, im.width * k, im.height * k);
        gl.bindTexture(gl.TEXTURE_2D, T.t);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
    for (const l of WORLD_MAP_LANDMARKS) {
      const d = vector3.sub(l.v, cam.C),
        z = vector3.dot(d, cam.fw);
      if (z < 0.01 || z > 1.3) continue;
      const im = worldMapStamp(l.k),
        T = imageTexture(im, { noNormal: true });
      if (!T) continue;
      const up = vector3.mul(l.v, -1),
        rt = vector3.norm(vector3.sub(cam.rt, vector3.mul(up, vector3.dot(cam.rt, up)))),
        k = 0.0011;
      gl.uniform3fv(U2.uP, l.v);
      gl.uniform3fv(U2.uRt, rt);
      gl.uniform3fv(U2.uUp, up);
      gl.uniform2f(U2.uS, im.width * k, im.height * k);
      gl.bindTexture(gl.TEXTURE_2D, T.t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }
  const P = worldMap.focus || worldMapPlayerPosition(),
    fd = Math.max(0.02, vector3.dot(vector3.sub(P, cam.C), cam.fw));
  worldMapGl.fd = worldMapGl.fd == null ? fd : worldMapGl.fd + (fd - worldMapGl.fd) * 0.2;
  drawPostEffects(
    S,
    { near: WORLD_MAP_GL_NEAR, far: WORLD_MAP_GL_FAR, df: worldMapGl.fd * 1.6, F: (cam.foc * rw) / worldMapWidth },
    worldMapGl.fd,
    rw,
    rh,
    {
      blur: worldMapGl.flat ? 0 : 0.5,
      fast: rw * rh > 1.2e6,
      noAO: true,
      sun: worldMapGl.flat ? null : projectToScreenUv(worldMapGlMatrix(cam), [0, 0, 0]),
      sunCol: [1, 0.9, 0.7],
    }
  );
  gl.depthFunc(gl.LEQUAL);
}
/* phase 04d: the in-game full test (self-test.js) times the map */
export function setWorldMapGlRender(v) {
  worldMapGlRender = v; // eslint-disable-line no-func-assign
  provide({ worldMapGlRender });
}
/* the miniatures: loaded the first time the map opens; size in world units per pixel (about 3 degrees across) */
const MINI_PICTURE_SCALE = 0.0004;
function worldMapGlMiniPicture(i) {
  const r = ROUTE[i];
  if (!r || !r.scene) return null;
  const p = `map/mini/${r.scene}.png`,
    im = typeof artImage === 'function' ? artImage(p) : null;
  if (!im || !imageReady(im)) {
    worldMapGl.miniLoad = worldMapGl.miniLoad || {};
    if (!worldMapGl.miniLoad[p]) {
      worldMapGl.miniLoad[p] = 1;
      artLoad([p])
        .then(() => {
          worldMap.dirty = true;
        })
        .catch(() => {});
    }
    return null;
  }
  return im;
}
/* the land's height under a point (the same relief the globe shader marches), so a miniature stands on the hills, not inside them */
function worldMapGlLift(v) {
  const R = engineSetting('world', 'relief') * 0.014;
  if (!R) return v;
  if (!worldMapGl.hpix) {
    if (!worldMapGl.hpl) {
      worldMapGl.hpl = 1;
      artPixels(WORLD_RELIEF)
        .then(p => {
          worldMapGl.hpix = p;
          worldMap.dirty = true;
        })
        .catch(() => {});
    }
    return v;
  }
  const [u, w] = worldMapGlUV(v),
    W = 1024,
    H = 512,
    x = Math.floor(u * W) % W,
    y = clamp(Math.floor(w * H), 0, H - 1),
    h = (worldMapGl.hpix[y * W + x] & 255) / 255;
  return vector3.mul(v, 1 - h * R);
}
function worldMapGlMiniPictures(cam, draw) {
  ROUTE.forEach((r, i) => {
    const v = worldMapGlLift(LOCATION_VECTORS[i]),
      d = vector3.sub(v, cam.C),
      z = vector3.dot(d, cam.fw);
    if (z < 0.01 || z > 1.3) return;
    const im = worldMapGlMiniPicture(i);
    if (im) draw(im, v, MINI_PICTURE_SCALE * (r.town ? 1.15 : 1));
  });
}
/* how far above the stop a pin goes so it sits on top of the miniature */
function worldMapGlPinUp(v, cam) {
  const n = vector3.norm(vector3.mul(v, -1)),
    rt = vector3.norm(vector3.sub(cam.rt, vector3.mul(n, vector3.dot(cam.rt, n)))),
    bk = vector3.norm(vector3.cross(rt, n));
  return vector3.norm(vector3.add(vector3.mul(n, 0.62), vector3.mul(bk, -0.78)));
}
function worldMapGlMiniTop(i) {
  if (typeof worldMapMinisOn === 'function' && worldMapMinisOn() && !worldMapGl.flat && worldMap.cam) {
    const e = worldMapMinis.cache.get(i);
    if (e && e.m && e.m.top) return e.m.top;
  }
  const im = worldMapGlMiniPicture(i);
  if (!im || worldMapGl.flat || !worldMap.cam) return null;
  const r = ROUTE[i],
    v = worldMapGlLift(LOCATION_VECTORS[i]);
  return vector3.add(
    v,
    vector3.mul(worldMapGlPinUp(v, worldMap.cam), im.height * MINI_PICTURE_SCALE * (r.town ? 1.15 : 1) * 0.92)
  );
}
/* ---------- overlay: trip, route preview, player ---------- */
function worldMapGlLine(c, pts, col, w, dash, off) {
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
    if (pen && last && Math.hypot(q.x - last.x, q.y - last.y) > worldMapWidth * 0.4) pen = false;
    if (pen) c.lineTo(q.x, q.y);
    else c.moveTo(q.x, q.y);
    pen = true;
    last = q;
  }
  c.stroke();
  c.setLineDash([]);
}
function worldMapGlPath(seq, startF) {
  const pts = [];
  for (let k = 0; k < seq.length - 1; k++) {
    const a = seq[k],
      b = seq[k + 1];
    for (let f = k === 0 ? startF : 0; f <= 1.0001; f += 0.025)
      pts.push(worldMapGlProject(roadPosition(a, b, Math.min(1, f))));
  }
  return pts;
}
function worldMapGlOverlay(t) {
  const c = worldMap.ctx,
    cv = worldMap.cv,
    d = worldMapGl.dpr;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  const r = S.route,
    plan = [r.node, ...r.plan];
  if (plan.length > 1) {
    const pts = worldMapGlPath(plan, r.prog / linkCost(plan[0], plan[1]));
    worldMapGlLine(c, pts, 'rgba(255,214,90,.35)', 9);
    worldMapGlLine(c, pts, r.hold ? 'rgba(255,255,255,.9)' : '#FFE27A', 3.5, [10, 8], -t / 40);
  }
  const sel = U.mapSel;
  if (typeof sel === 'number' && sel !== r.node && sel !== (r.plan.length ? r.plan[r.plan.length - 1] : null)) {
    const tr = tripTo(sel);
    if (tr && tr.plan.length) {
      const from = nextStop() != null && r.prog > 0 ? (tr.back ? r.node : nextStop()) : r.node;
      const seq = [r.prog > 0 && !tr.back ? r.node : from, ...tr.plan.filter((x, i) => !(i === 0 && x === from))];
      worldMapGlLine(
        c,
        worldMapGlPath(seq.length > 1 ? seq : [r.node, ...tr.plan], 0),
        'rgba(255,255,255,.85)',
        2.5,
        [4, 7],
        -t / 60
      );
    }
  }
  const pq = worldMapGlProject(worldMap.me || worldMapPlayerPosition());
  if (pq && worldMap.fly && typeof flyDraw === 'function') flyDraw(c, t, worldMapGlProject);
  else if (pq) {
    const fr = owFrames('me'),
      set = fr[worldMap.face] || fr.down,
      f = worldMap.moving ? set[1 + (Math.floor(t / 140) % 2)] : set[0],
      k = 2,
      bob = worldMap.moving ? 0 : Math.floor(t / 600) % 2;
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
function worldMapGlPinState(i) {
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
function worldMapGlPins() {
  const host = $('#maplabels');
  if (!host || !worldMap.cam) return;
  if (!worldMapGl.pins || worldMapGl.pins.host !== host) {
    host.innerHTML = '';
    worldMapGl.pins = { host, el: new Map() };
  }
  const E = worldMapGl.pins.el,
    seen = new Set();
  const put = (key, q, html, cls, attrs, chip) => {
    if (!q || q.x < -60 || q.x > worldMapWidth + 60 || q.y < -30 || q.y > worldMapHeight + 30) {
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
      tv = worldMapGlMiniTop(i);
    let q = worldMapGlProject(tv || LOCATION_VECTORS[i]);
    const far = q && q.z > 0.9 && i !== S.route.node && i !== sel && i !== dest && !worldMapGl.flat;
    const st = worldMapGlPinState(i);
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
      `<span class="mp-i">${uiIconHTML(st.ico, 14)}</span><span class="mp-n">${esc(n.name)}</span>`,
      st.cls + (mini ? ' mini' : ''),
      { 'data-a': 'msel', 'data-n': String(i), 'aria-label': n.name }
    );
  }
  FUTURE.forEach((f, i) => {
    let q =
      f.t === 'sun'
        ? worldMapGl.flat
          ? null
          : worldMapProject(worldMap.cam, [0, 0, 0])
        : worldMapGlProject(REGION_VECTORS[i]);
    if (q && q.z > 0.95 && U.mapSel !== 'f' + i && !worldMapGl.flat) return put('f' + i, null);
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
    const q = show ? worldMapGlProject(roadPosition(a, b, 0.5)) : null;
    put('L' + i, q, `${fmt(c)} steps`, 'mchip' + (onPlan.has(Math.min(a, b) + '-' + Math.max(a, b)) ? ' trip' : ''));
  });
  /* 0.5: friends, at the place they were last */
  if (typeof FR !== 'undefined')
    for (const u of FR.list) {
      const d = FR.data[u],
        a = d && d.at;
      if (!a || a.node == null || !LOCATION_VECTORS[a.node]) {
        put('fr' + u, null);
        continue;
      }
      const tv = worldMapGlMiniTop(a.node);
      let q = worldMapGlProject(tv || LOCATION_VECTORS[a.node]);
      if (q && q.z > 0.92 && !worldMapGl.flat) q = null;
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
function worldMapGlPick(ev) {
  const r = worldMap.cv.getBoundingClientRect(),
    x = ev.clientX - r.left,
    y = ev.clientY - r.top;
  let best = null,
    bd = 30;
  ROUTE.forEach((n, i) => {
    const q = worldMapGlProject(LOCATION_VECTORS[i]);
    if (!q) return;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (best === null)
    FUTURE.forEach((f, i) => {
      const q =
        f.t === 'sun'
          ? worldMapGl.flat
            ? null
            : worldMapProject(worldMap.cam, [0, 0, 0])
          : worldMapGlProject(REGION_VECTORS[i]);
      if (!q) return;
      const d = Math.hypot(q.x - x, q.y - y);
      if (d < bd) {
        bd = d;
        best = 'f' + i;
      }
    });
  if (best !== null) worldMapSelect(best);
}
setWorldMapLabels(function () {
  if (worldMap.gl) return worldMapGlPins();
  return cpuWorldMapLabels();
});
{
  const cpuFit = worldMapFit;
  setWorldMapFit(function () {
    if (worldMap.gl) {
      worldMapGlSize();
      worldMap.dirty = true;
      return;
    }
    cpuFit();
  });
}
setWorldMapZoom(function (k) {
  if (!worldMap.gl) return cpuWorldMapZoom(k);
  worldMapGl.altT = null;
  if (worldMapGl.flat) worldMapGl.fv.s = clamp(worldMapGl.fv.s / k, worldMapGlFlatMin(), worldMapWidth * 8);
  else worldMap.alt = clamp(worldMap.alt * k, WORLD_MAP_GL_ALTITUDE_RANGE[0], WORLD_MAP_GL_ALTITUDE_RANGE[1]);
  worldMap.dirty = true;
});
setWorldMapReset(function () {
  if (!worldMap.gl) return cpuWorldMapReset();
  worldMap.free = false;
  worldMap.tilt = 0.5733;
  cpuWorldMapReset();
  if (worldMapGl.flat) {
    const [u, v] = worldMapGlUV(worldMapPlayerPosition());
    worldMapGl.fv.u = u;
    worldMapGl.fv.v = v;
  }
  worldMap.dirty = true;
});
/* ---------- extra controls: places list and flat view ---------- */
function worldMapGlChrome() {
  const box = $('.map-full');
  if (!box) return;
  const ctl = box.querySelector('.mapctl');
  if (ctl && !ctl.querySelector('[data-a=mflat]')) {
    ctl.insertAdjacentHTML(
      'beforeend',
      `<button class="mbtn" data-a="mlist" aria-label="Places" title="Places">${uiIconHTML('list', 16)}</button><button class="mbtn" data-a="mflat" aria-label="${worldMapGl.flat ? 'Show the globe' : 'Show the whole world flat'}" title="${worldMapGl.flat ? 'Globe' : 'Flat map'}">${uiIconHTML('globe', 16)}</button>`
    );
  }
  if (!box.querySelector('.mapview'))
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="mapview glass" role="group" aria-label="Look around"><button class="mbtn sm" data-a="mturn" data-k="-1" aria-label="Turn left" title="Turn left">⟲</button><button class="mbtn sm" data-a="mtilt" aria-label="Tilt the view" title="Tilt: low, normal, from above">⦨</button><button class="mbtn sm" data-a="mturn" data-k="1" aria-label="Turn right" title="Turn right">⟳</button></div>`
    );
  {
    const mv = box.querySelector('.mapview');
    if (mv) mv.hidden = worldMapGl.flat;
  }
  ctl && ctl.querySelector('[data-a=mflat]').classList.toggle('on', worldMapGl.flat);
  let pl = box.querySelector('.mplaces');
  if (worldMapGl.list) {
    if (!pl) {
      box.insertAdjacentHTML('beforeend', '<div class="mplaces glass" role="dialog" aria-label="Places"></div>');
      pl = box.querySelector('.mplaces');
    }
    pl.innerHTML = worldMapGlLocationListHTML();
  } else if (pl) pl.remove();
}
function worldMapGlLocationListHTML() {
  const rows = ROUTE.map((n, i) => {
    const st = worldMapGlPinState(i),
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
    h += `<button class="mpl-row ${r.st.cls.replace('mpin', '')}" data-a="msel" data-n="${r.i}"><span class="mp-i">${uiIconHTML(r.st.ico, 14)}</span><span class="mpl-n">${esc(r.n.name)}<small>${esc(placeSub(r.n))}</small></span><span class="mpl-s">${esc(r.sub)}</span></button>`;
  }
  return h + '</div>';
}
export function worldMapGlAction(a, d) {
  if (a === 'mturn' && !worldMapGl.flat) {
    worldMapGlEase('yaw', worldMap.yaw + ((+d.k || 1) * Math.PI) / 4);
    return true;
  }
  if (a === 'mtilt' && !worldMapGl.flat) {
    const T = [0.28, 0.5733, 1.15],
      cur = worldMap.tilt ?? 0.5733,
      i = T.findIndex(v => v > cur + 0.05);
    worldMapGlEase('tilt', T[i < 0 ? 0 : i]);
    return true;
  }
  if (a === 'mflat') {
    worldMapGl.flat = !worldMapGl.flat;
    if (worldMapGl.flat) {
      const [u, v] = worldMapGlUV(worldMap.focus || worldMapPlayerPosition());
      worldMapGl.fv.u = u;
      worldMapGl.fv.v = v;
      worldMapGl.fv.s = Math.max(worldMapGlFlatMin(), worldMapGl.fv.s);
    }
    worldMapGl.altT = null;
    worldMap.dirty = true;
    worldMapGlChrome();
    return true;
  }
  if (a === 'mlist') {
    worldMapGl.list = !worldMapGl.list;
    worldMapGlChrome();
    return true;
  }
  if (a === 'msel' && worldMapGl.list && innerWidth < 850) {
    worldMapGl.list = false;
    setTimeout(worldMapGlChrome, 0);
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
export const worldMapMinis = { cache: new Map(), col: new WeakMap(), on: true };
WORLD_MAP_GL_SHADERS.mmini = [
  `#version 300 es
precision highp float;in vec3 aPos;in vec3 aUV;uniform mat4 uVP;out vec3 vW;out vec3 vC;void main(){vW=aPos;vC=aUV;gl_Position=uVP*vec4(aPos,1.);}`,
  `#version 300 es
precision highp float;in vec3 vW;in vec3 vC;out vec4 o;uniform vec3 uC,uHaze;void main(){float d=length(vW-uC),fk=1.-exp(-max(0.,d-.3)*.72);o=vec4(mix(vC,uHaze,clamp(fk,0.,.86)),1.);}`,
];
export function worldMapMinisOn() {
  return worldMapMinis.on && (engineSetting('world', 'mini3d') ?? true) !== false;
}
/* average colours of a picture's upper and lower parts (roof and walls of a building, crown and trunk of a tree) */
function worldMapMiniColors(im) {
  let c = worldMapMinis.col.get(im);
  if (c) return c;
  c = { top: [0.5, 0.5, 0.5], mid: [0.6, 0.6, 0.6], low: [0.5, 0.45, 0.4] };
  try {
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      k = Math.min(1, 64 / Math.max(w, h)),
      W = Math.max(1, Math.round(w * k)),
      H = Math.max(1, Math.round(h * k)),
      cv = makeCanvas(W, H),
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
  worldMapMinis.col.set(im, c);
  return c;
}
function worldMapMiniKey(sc) {
  return [
    sc.w,
    sc.h,
    (sc.props || []).length,
    (sc.tiles || []).join('').length,
    sc.steps ? sc.steps.length : 0,
    sc.heights ? sc.heights.length : 0,
    typeof artCacheVersion === 'function' ? artCacheVersion() : 0,
  ].join('|');
}
export function worldMapMiniBuild(i) {
  const r = ROUTE[i],
    sc = r && r.scene && mapById(r.scene);
  if (!sc || !sc.w) return null;
  const C0 = walkData().sc,
    W = sc.w,
    H = sc.h,
    town = !!r.town;
  const v = worldMapGlLift(LOCATION_VECTORS[i]),
    U = vector3.norm(vector3.mul(v, -1)),
    E0 = vector3.norm(vector3.cross(v, [0, 1, 0])),
    E = vector3.len(E0) > 0.1 ? E0 : [1, 0, 0],
    N = vector3.norm(vector3.cross(U, E)),
    span = 0.088 * (town ? 1.15 : 1),
    k = span / Math.max(W, H),
    vex = 1.7;
  const L = vector3.norm(vector3.add(vector3.add(vector3.mul(U, 0.82), vector3.mul(E, -0.42)), vector3.mul(N, -0.3)));
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
    let n = nl || vector3.norm(vector3.cross(vector3.sub(b, a), vector3.sub(d, a)));
    if (!nl && n[1] < 0) n = vector3.mul(n, -1);
    const wn = vector3.norm(vector3.add(vector3.add(vector3.mul(E, n[0]), vector3.mul(U, n[1])), vector3.mul(N, n[2]))),
      lit = 0.58 + 0.52 * Math.max(0, vector3.dot(wn, L));
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
      return hexToRgb(T.edge || '#4A7A3C').map(c => c / 255);
    },
    cs = town ? 1 : 2,
    base = -1.2;
  const hAt = (x, z) => {
    const ch = (rows[H - 1 - Math.floor(z)] || '')[Math.floor(x)] || sc.edge;
    let h = rawHeightAt(sc, x, z) + stepRaiseAt(x, z, sc);
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
      (a, b) => hash2d(Math.round(a.x * 7), Math.round(a.z * 5)) - hash2d(Math.round(b.x * 7), Math.round(b.z * 5))
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
    const cols = im && imageReady(im) ? worldMapMiniColors(im) : null;
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
  const mesh = uploadMesh(
    new Float32Array(V),
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aUV', 3, 12],
    ],
    24
  );
  mesh.top = vector3.add(v, vector3.mul(U, (top + 0.6) * k * vex));
  mesh.v = v;
  return mesh;
}
function worldMapMiniGet(i) {
  const r = ROUTE[i],
    sc = r && r.scene && mapById(r.scene);
  if (!sc) return null;
  const key = worldMapMiniKey(sc) + '|' + (worldMapGl.hpix ? 1 : 0),
    e = worldMapMinis.cache.get(i);
  if (e && e.key === key && e.gl === gpuState.gl) return e.m;
  if (worldMapMinis.busy > 0) return e && e.gl === gpuState.gl ? e.m : null;
  worldMapMinis.busy = (worldMapMinis.busy || 0) + 1;
  let m = null;
  try {
    m = worldMapMiniBuild(i);
  } catch (err) {
    console.warn('mini', err);
  }
  if (e && e.m && e.gl === gpuState.gl) freeMesh(e.m);
  worldMapMinis.cache.set(i, { key, m, gl: gpuState.gl });
  return m;
}
function worldMapMiniDraw(cam) {
  if (!worldMapMinisOn() || worldMapGl.flat) return false;
  const gl = gpuState.gl;
  ensurePrograms({ mmini: WORLD_MAP_GL_SHADERS.mmini });
  const p = gpuState.P.mmini;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.U.uVP, false, worldMapGlMatrix(cam));
  gl.uniform3fv(p.U.uC, cam.C);
  gl.uniform3fv(p.U.uHaze, [176 / 255, 186 / 255, 236 / 255]);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  worldMapMinis.busy = 0;
  ROUTE.forEach((r, i) => {
    const d = vector3.sub(LOCATION_VECTORS[i], cam.C),
      z = vector3.dot(d, cam.fw);
    if (z < 0.005 || z > 1.3) return;
    const m = worldMapMiniGet(i);
    if (!m) return;
    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0);
  });
  gl.bindVertexArray(null);
  return true;
}
