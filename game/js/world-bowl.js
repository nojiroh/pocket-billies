'use strict';
/* ================= THE BOWL WORLD MAP, PREVIEW (phase 10, session E-map-3) =================
   The lower half of the Hollow Earth seen from above, like a tabletop (docs/phases/10-world-map-bowl.md). For now it
   is a preview next to the old sphere map: the debug menu switches it on for this device ("Bowl world map"), and the
   old map stays the default until the bowl replaces it (session E-map-6).
   This session: the camera and its controls. One finger drags the land; two fingers pinch to zoom, twist to turn and
   slide up or down to tilt; on a computer the wheel zooms and the right button (or Shift) turns and tilts. Home goes
   back to where you are; tapping a place's miniature opens its card (Travel is the card's own button).
   The ground is a placeholder: plain floor and walls tinted by region, with the Inner Sun overhead. The real ground,
   routes in the ground, clouds and the airship hop come in sessions E-map-4 and E-map-5.
   The camera's arithmetic is logic/bowl-camera.js; where each place sits is locations.json "bowl" (logic/bowl.js). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { $ } from './util.js';
import { LOCATIONS, LOCATION_BY_ID, ROADS } from './game-data.js';
import { canEnter } from './logic/rules.js';
import { BOWL_FLOOR, BOWL_RIM_HEIGHT, bowlRoad, bowlSpotOf, bowlXY } from './logic/bowl.js';
import {
  BOWL_CAMERA,
  bowlCamClamp,
  bowlCamEase,
  bowlCamGap,
  bowlCamHome,
  bowlCamMatrix,
  bowlCamOverview,
  bowlCamPan,
  bowlCamProject,
  bowlCamTurn,
  bowlCamView,
  bowlCamZoom,
  bowlPickGround,
  bowlSurface,
  bowlToGpu,
} from './logic/bowl-camera.js';
import { reducedMotion, saveData, uiState } from './game-state.js';
import { frameCount, frameStop, frameTask } from './frame-scheduler.js';
import { personWalkFrames } from './person-art.js';
import { bindQuad, ensurePrograms, gpuState, imageTexture, renderTarget } from './engine/webgl.js';
import { drawPostEffects, projectToScreenUv } from './engine/post-effects.js';
import {
  setWorldMapLabels,
  setWorldMapMount,
  setWorldMapReset,
  setWorldMapZoom,
  worldMap,
  worldMapHeight,
  worldMapLabels,
  worldMapMount,
  worldMapReset,
  worldMapSelect,
  worldMapWidth,
  worldMapZoom,
} from './world-map.js';
import {
  worldMapGl,
  worldMapGlChrome,
  worldMapGlMiniPicture,
  worldMapGlReady,
  worldMapGlSize,
} from './world-map-gl.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_HAZE: [() => BOWL_HAZE],
  BOWL_MINI_SIZE: [() => BOWL_MINI_SIZE],
  BOWL_PREVIEW_KEY: [() => BOWL_PREVIEW_KEY],
  BOWL_REGION_COLORS: [() => BOWL_REGION_COLORS],
  BOWL_SUN: [() => BOWL_SUN],
  BOWL_WATER: [() => BOWL_WATER],
  WORLD_BOWL_SHADERS: [() => WORLD_BOWL_SHADERS],
  bowlDepth: [() => bowlDepth],
  bowlMapPreview: [() => bowlMapPreview, v => (bowlMapPreview = v)],
  oldWorldMapLabels: [() => oldWorldMapLabels],
  oldWorldMapMount: [() => oldWorldMapMount],
  oldWorldMapReset: [() => oldWorldMapReset],
  oldWorldMapZoom: [() => oldWorldMapZoom],
  switchBowlMapPreview: [() => switchBowlMapPreview, v => (switchBowlMapPreview = v)],
  worldBowl: [() => worldBowl],
  worldBowlBind: [() => worldBowlBind, v => (worldBowlBind = v)],
  worldBowlChrome: [() => worldBowlChrome, v => (worldBowlChrome = v)],
  worldBowlDot: [() => worldBowlDot, v => (worldBowlDot = v)],
  worldBowlLock: [() => worldBowlLock, v => (worldBowlLock = v)],
  worldBowlLoop: [() => worldBowlLoop, v => (worldBowlLoop = v)],
  worldBowlMarkerTop: [() => worldBowlMarkerTop, v => (worldBowlMarkerTop = v)],
  worldBowlOverlay: [() => worldBowlOverlay, v => (worldBowlOverlay = v)],
  worldBowlPick: [() => worldBowlPick, v => (worldBowlPick = v)],
  worldBowlPlaceColors: [() => worldBowlPlaceColors, v => (worldBowlPlaceColors = v)],
  worldBowlRender: [() => worldBowlRender, v => (worldBowlRender = v)],
  worldBowlSpots: [() => worldBowlSpots, v => (worldBowlSpots = v)],
  worldBowlWanted: [() => worldBowlWanted],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the switch: per device, in the browser's storage, never in the save (a preview, not a setting) */
const BOWL_PREVIEW_KEY = 'pb-bowl-map-preview';
export function bowlMapPreview() {
  try {
    return localStorage.getItem(BOWL_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}
export function switchBowlMapPreview(on) {
  try {
    if (on) localStorage.setItem(BOWL_PREVIEW_KEY, '1');
    else localStorage.removeItem(BOWL_PREVIEW_KEY);
  } catch {
    /* storage blocked: the preview stays off */
  }
}

const worldBowl = {
  on: false,
  /** the camera now and where it is easing to (null: nowhere) */
  cam: null,
  goal: null,
  view: null,
  /** the place picked last, so a new pick (card, Places list) brings the camera over */
  sel: undefined,
  drag: null,
  pts: new Map(),
  lastT: 0,
  dirty: true,
  /** each place's spot seen from above, in node order (Pearlantis: Kelpport's, with under = 1) */
  spots: null,
  roads: null,
};

/* region colours for the placeholder ground (session E-map-4 replaces them with terrain) */
const BOWL_REGION_COLORS = {
  starter: [0.5, 0.68, 0.35],
  meadowlands: [0.79, 0.84, 0.35],
  goldenhills: [0.88, 0.66, 0.24],
  sporeforest: [0.65, 0.48, 0.77],
  crystalcaverns: [0.37, 0.72, 0.79],
  coraltrench: [0.25, 0.5, 0.75],
  cloudspire: [0.73, 0.76, 0.84],
  innersun: [0.95, 0.82, 0.29],
};
const BOWL_WATER = { sea: 1, pond: 1, lake: 1, island: 1 };
const BOWL_SUN = [0, 1.7, 0];
const BOWL_HAZE = [0.69, 0.73, 0.92];
const BOWL_MINI_SIZE = 0.075; /* a miniature's width on the ground, in bowl radii (towns a little bigger) */

const bowlDepth = n =>
  `((${((BOWL_CAMERA.far + BOWL_CAMERA.near) / (BOWL_CAMERA.far - BOWL_CAMERA.near)).toFixed(6)})-(${((2 * BOWL_CAMERA.far * BOWL_CAMERA.near) / (BOWL_CAMERA.far - BOWL_CAMERA.near)).toFixed(6)})/max(${n},1e-4))*.5+.5`;
const WORLD_BOWL_SHADERS = {
  /* the ground and the sky: one full-screen pass that finds where each pixel's ray meets the bowl */
  mbowl: [
    `#version 300 es
precision highp float;in vec2 aC;void main(){gl_Position=vec4(aC*2.-1.,.5,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;uniform vec3 uC,uFw,uRt,uUp,uHaze,uSun;uniform float uFoc,uR;uniform vec2 uWH;
uniform vec4 uPl[48];uniform vec3 uPc[48];uniform int uNPl;
const float FL=${BOWL_FLOOR.toFixed(6)},RIM=${BOWL_RIM_HEIGHT.toFixed(6)};
float surf(vec2 q){float r=length(q);if(r>1.)return RIM;float k=max(0.,r-FL);return k*k/(2.*(1.-FL));}
void main(){vec2 px=gl_FragCoord.xy/uR;float dx=(px.x-uWH.x*.5)/uFoc,dy=(px.y-uWH.y*.5)/uFoc;vec3 d=normalize(uFw+uRt*dx+uUp*dy);
 float t0=${BOWL_CAMERA.near.toFixed(4)},t1=6.,pt=t0,th=-1.;float pe=uC.y-surf(vec2(uC.x,-uC.z));
 for(int i=1;i<=96;i++){float t=mix(t0,t1,pow(float(i)/96.,1.6));vec3 p=uC+d*t;if(length(p.xz)>1.9)break;float e=p.y-surf(vec2(p.x,-p.z));
  if(e<=0.){float a=pt,b=t;for(int k=0;k<8;k++){float m=(a+b)*.5;vec3 q=uC+d*m;if(q.y-surf(vec2(q.x,-q.z))>0.)a=m;else b=m;}th=(a+b)*.5;break;}pt=t;pe=e;}
 vec3 col;float z;
 if(th<0.){/* sky: pale near the rim line, the Inner Sun overhead */
  float up=clamp(d.y*.5+.5,0.,1.);col=mix(vec3(.98,.86,.7),vec3(.62,.72,.95),smoothstep(.45,1.,up));
  vec3 sd=normalize(uSun-uC);float a=max(0.,dot(d,sd));col+=vec3(1.,.9,.6)*(pow(a,900.)*3.+pow(a,40.)*.35);z=t1;}
 else{vec3 p=uC+d*th;vec2 q=vec2(p.x,-p.z);float r=length(q);
  /* the region tint: a soft mix of the nearest places' colours */
  vec3 acc=vec3(0.);float ws=0.,dmin=9.;for(int i=0;i<48;i++){if(i>=uNPl)break;float e=distance(q,uPl[i].xy);dmin=min(dmin,e);float w=1./(pow(e,4.)+2e-5);acc+=uPc[i]*w;ws+=w;}
  vec3 tint=ws>0.?acc/ws:vec3(.6,.55,.45);col=mix(tint,vec3(.62,.56,.46),smoothstep(.12,.3,dmin));
  /* light from the Inner Sun above the centre; the walls lean towards it */
  float g=r<=1.?max(0.,r-FL)/(1.-FL):0.;vec3 n=normalize(vec3(-g*q.x/max(r,1e-4),1.,g*q.y/max(r,1e-4)));
  float lit=.6+.45*max(0.,dot(n,normalize(uSun-p)));col*=lit;
  float hh=p.y;col*=1.-.06*(1.-smoothstep(0.,.02,abs(fract(hh*30.)-.5)-.45));
  if(r>1.){col=mix(vec3(.4,.38,.42),vec3(.55,.5,.5),.3);}else col=mix(col,vec3(1.,.95,.82),smoothstep(.985,1.,r)*.6);
  z=th;}
 float fk=1.-exp(-max(0.,z-.6)*.35);col=mix(col,uHaze,clamp(fk,0.,.7));
 o=vec4(col,1.);float zz=z*dot(d,uFw);gl_FragDepth=${bowlDepth('zz')};}`,
  ],
  /* a miniature standing on the ground, facing the camera */
  mbspr: [
    `#version 300 es
precision highp float;in vec2 aC;uniform mat4 uVP;uniform vec3 uP,uRt,uUp;uniform vec2 uS;out vec2 vUV;out vec3 vW;
void main(){vec3 p=uP+uRt*(aC.x-.5)*uS.x+uUp*aC.y*uS.y;vW=p;vUV=vec2(aC.x,1.-aC.y);gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in vec3 vW;out vec4 o;uniform sampler2D uTex;uniform vec3 uC,uHaze;uniform float uDim;
void main(){vec4 c=texture(uTex,vUV);if(c.a<.5)discard;vec3 k=mix(c.rgb,vec3(dot(c.rgb,vec3(.3,.59,.11)))*.7,uDim);float d=length(vW-uC),fk=1.-exp(-max(0.,d-.6)*.35);o=vec4(mix(k,uHaze,clamp(fk,0.,.7)),1.);}`,
  ],
};

/* ---------- the places and roads on the bowl ---------- */
function worldBowlSpots() {
  if (worldBowl.spots) return worldBowl.spots;
  const byId = id => LOCATION_BY_ID[id];
  worldBowl.spots = LOCATIONS.map(l => {
    const s = bowlSpotOf(l, byId),
      [x, y] = bowlXY(s.a, s.r);
    return { x, y, under: s.under, h: bowlSurface(x, y) };
  });
  worldBowl.roads = ROADS.filter(([a, b]) => worldBowl.spots[a] && worldBowl.spots[b]).map(([a, b]) => {
    const A = worldBowl.spots[a],
      B = worldBowl.spots[b];
    return bowlRoad([A.x, A.y], [B.x, B.y], 16).pts.map(([x, y, h]) => bowlToGpu(x, y, h + 0.004));
  });
  return worldBowl.spots;
}
function worldBowlPlaceColors() {
  const P = new Float32Array(48 * 4),
    C = new Float32Array(48 * 3);
  let n = 0;
  worldBowlSpots().forEach((s, i) => {
    if (s.under || n >= 48) return;
    const l = LOCATIONS[i],
      c = BOWL_WATER[l.t] ? [0.36, 0.6, 0.78] : BOWL_REGION_COLORS[l.region] || BOWL_REGION_COLORS.starter;
    P.set([s.x, s.y, 0, 0], n * 4);
    C.set(c, n * 3);
    n++;
  });
  return { P, C, n };
}

/* ---------- mount, size, loop ---------- */
/* the map uses the bowl when the preview is on, WebGL works, and no airship flight is showing over the old map */
const worldBowlWanted = () => bowlMapPreview() && !worldMap.fly && worldMapGlReady();
const oldWorldMapMount = worldMapMount,
  oldWorldMapZoom = worldMapZoom,
  oldWorldMapReset = worldMapReset,
  oldWorldMapLabels = worldMapLabels;
setWorldMapMount(function () {
  const cv = $('#mapcv');
  worldBowl.on = false;
  if (!cv || !worldBowlWanted()) return oldWorldMapMount();
  try {
    ensurePrograms(WORLD_BOWL_SHADERS);
  } catch (e) {
    console.error(e);
    return oldWorldMapMount();
  }
  worldBowl.on = true;
  worldMap.gl = true;
  /* the bowl takes the map's frame task over from the old map's loop, which would have cleared this on stopping */
  worldMap.on = false;
  document.body.classList.add('map-gl', 'map-bowl');
  worldMap.cv = cv;
  worldMap.ctx = cv.getContext('2d');
  worldMapGlSize();
  worldBowlSpots();
  const me = worldBowl.spots[saveData.trip.node] || { x: 0, y: 0 },
    home = bowlCamHome(me.x, me.y, worldBowl.cam ? worldBowl.cam.yaw : 0);
  if (!worldBowl.cam) {
    /* first opening: from the whole bowl down to where you are */
    worldBowl.cam = reducedMotion ? home : bowlCamOverview(home.yaw);
    worldBowl.goal = reducedMotion ? null : home;
  }
  worldBowl.sel = uiState.mapSel;
  worldBowlBind(cv);
  worldBowlChrome();
  worldBowl.dirty = true;
  frameTask('map', worldBowlLoop);
});
setWorldMapZoom(function (k) {
  if (!worldBowl.on) return oldWorldMapZoom(k);
  worldBowl.goal = bowlCamZoom(worldBowl.goal || worldBowl.cam, k);
  worldBowl.dirty = true;
});
setWorldMapReset(function () {
  if (!worldBowl.on) return oldWorldMapReset();
  const me = worldBowlSpots()[saveData.trip.node];
  worldBowl.goal = bowlCamHome(me.x, me.y, worldBowl.cam.yaw);
  worldBowl.dirty = true;
});
setWorldMapLabels(function () {
  if (!worldBowl.on) return oldWorldMapLabels();
  worldBowl.dirty = true;
});
function worldBowlLoop(ts) {
  if (!worldBowl.on || !worldMap.cv || !worldMap.cv.isConnected) {
    worldBowl.on = false;
    document.body.classList.remove('map-bowl');
    frameStop('map');
    return;
  }
  if (gpuState.lost) return;
  const dt = Math.min(100, ts - (worldBowl.lastT || ts));
  worldBowl.lastT = ts;
  /* a new pick (the card, the Places list): bring the camera over it, keeping the turn and not zooming out */
  if (uiState.mapSel !== worldBowl.sel) {
    worldBowl.sel = uiState.mapSel;
    const s = typeof worldBowl.sel === 'number' ? worldBowl.spots[worldBowl.sel] : null;
    if (s && !worldBowl.drag) {
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.goal = bowlCamClamp({ ...c, tx: s.x, ty: s.y, dist: Math.min(c.dist, 1.3) });
    }
    worldBowl.dirty = true;
  }
  let moving = !!worldBowl.drag;
  if (worldBowl.goal) {
    worldBowl.cam = bowlCamEase(worldBowl.cam, worldBowl.goal, reducedMotion ? 1 : 1 - Math.exp(-dt / 110));
    if (bowlCamGap(worldBowl.cam, worldBowl.goal) < 1e-3) {
      worldBowl.cam = worldBowl.goal;
      worldBowl.goal = null;
    }
    moving = true;
  }
  const breathe = Math.floor(ts / 600) !== Math.floor((ts - dt) / 600);
  if (!moving && !worldBowl.dirty && !breathe) return;
  worldBowl.dirty = false;
  const w0 = performance.now();
  worldMapGlSize();
  worldBowl.view = bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight);
  worldBowlRender(ts);
  worldBowlOverlay(ts);
  frameCount(performance.now() - w0);
}

/* ---------- drawing ---------- */
function worldBowlRender(t) {
  const gl = gpuState.gl,
    cv = gpuState.cv,
    v = worldBowl.view,
    px = worldMapWidth * worldMapHeight,
    dp = Math.min(devicePixelRatio || 1, 1.75),
    R = dp * Math.min(1, Math.sqrt(1.4e6 / (px * dp * dp))),
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
  let p = gpuState.P.mbowl,
    U = p.U;
  gl.useProgram(p.p);
  bindQuad();
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uFw, v.fw);
  gl.uniform3fv(U.uRt, v.rt);
  gl.uniform3fv(U.uUp, v.up);
  gl.uniform3fv(U.uHaze, BOWL_HAZE);
  gl.uniform3fv(U.uSun, BOWL_SUN);
  gl.uniform1f(U.uFoc, v.foc);
  gl.uniform1f(U.uR, rw / worldMapWidth);
  gl.uniform2f(U.uWH, worldMapWidth, worldMapHeight);
  if (!worldBowl.pc) worldBowl.pc = worldBowlPlaceColors();
  gl.uniform4fv(U.uPl, worldBowl.pc.P);
  gl.uniform3fv(U.uPc, worldBowl.pc.C);
  gl.uniform1i(U.uNPl, worldBowl.pc.n);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  /* the miniatures, standing up and facing the camera */
  gl.depthFunc(gl.LEQUAL);
  p = gpuState.P.mbspr;
  U = p.U;
  gl.useProgram(p.p);
  const VP = bowlCamMatrix(v);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uHaze, BOWL_HAZE);
  gl.uniform1i(U.uTex, 0);
  gl.activeTexture(gl.TEXTURE0);
  const flatRt = [v.rt[0], 0, v.rt[2]],
    up = [0, 1, 0];
  worldBowl.spots.forEach((s, i) => {
    if (s.under) return;
    const im = worldMapGlMiniPicture(i);
    if (!im) return;
    const T = imageTexture(im, { noNormal: true });
    if (!T) return;
    const w = BOWL_MINI_SIZE * (LOCATIONS[i].town ? 1.2 : 1);
    gl.uniform3fv(U.uP, bowlToGpu(s.x, s.y, s.h));
    gl.uniform3fv(U.uRt, flatRt);
    gl.uniform3fv(U.uUp, up);
    gl.uniform2f(U.uS, w, (w * im.height) / im.width);
    gl.uniform1f(U.uDim, canEnter(i) ? 0 : 0.75);
    gl.bindTexture(gl.TEXTURE_2D, T.t);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  });
  const fd = Math.max(0.05, v.foc ? worldBowl.cam.dist : 1);
  drawPostEffects(
    S,
    { near: BOWL_CAMERA.near, far: BOWL_CAMERA.far, df: fd * 1.6, F: (v.foc * rw) / worldMapWidth },
    fd,
    rw,
    rh,
    { blur: 0, fast: rw * rh > 1.2e6, noAO: true, sun: projectToScreenUv(VP, BOWL_SUN), sunCol: [1, 0.9, 0.7] }
  );
}
/* the top of a place's miniature, for its marker and label (GPU coordinates) */
function worldBowlMarkerTop(i) {
  const s = worldBowl.spots[i],
    im = worldMapGlMiniPicture(i),
    w = BOWL_MINI_SIZE * (LOCATIONS[i].town ? 1.2 : 1),
    h = im ? (w * im.height) / im.width : w * 0.6;
  return bowlToGpu(s.x, s.y, s.h + h);
}
/* roads, labels, the state of each place, and you */
function worldBowlOverlay(t) {
  const c = worldMap.ctx,
    cv = worldMap.cv,
    d = worldMapGl.dpr,
    v = worldBowl.view;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  c.lineJoin = c.lineCap = 'round';
  /* roads (session E-map-4 lays them into the ground) */
  for (const pts of worldBowl.roads) {
    c.beginPath();
    let on = false;
    for (const p of pts) {
      const q = bowlCamProject(v, p);
      if (!q) {
        on = false;
        continue;
      }
      if (on) c.lineTo(q.x, q.y);
      else c.moveTo(q.x, q.y);
      on = true;
    }
    c.strokeStyle = 'rgba(60,40,30,.35)';
    c.lineWidth = 4;
    c.stroke();
    c.strokeStyle = 'rgba(250,236,200,.9)';
    c.lineWidth = 2;
    c.stroke();
  }
  /* your trip, gold */
  const trip = [saveData.trip.node, ...saveData.trip.plan];
  if (trip.length > 1) {
    c.beginPath();
    trip.forEach((n, k) => {
      const s = worldBowl.spots[n],
        q = bowlCamProject(v, bowlToGpu(s.x, s.y, s.h + 0.004));
      if (q) k ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y);
    });
    c.setLineDash([10, 8]);
    c.lineDashOffset = -t / 40;
    c.strokeStyle = '#FFE27A';
    c.lineWidth = 3.5;
    c.stroke();
    c.setLineDash([]);
  }
  /* each place: its state on the marker, its name for towns, the picked one and close up */
  const sel = uiState.mapSel,
    close = worldBowl.cam.dist < 0.8,
    dest = saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null;
  worldBowl.marks = [];
  LOCATIONS.forEach((l, i) => {
    const s = worldBowl.spots[i],
      base = bowlCamProject(v, bowlToGpu(s.x, s.y, s.h));
    if (!base) return;
    let top = bowlCamProject(v, worldBowlMarkerTop(i)) || base;
    if (s.under) {
      /* reached by lift: a small marker just under its parent, a dashed line up to it */
      const y = base.y + 26;
      c.setLineDash([3, 4]);
      c.strokeStyle = 'rgba(159,211,255,.9)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(base.x, base.y + 4);
      c.lineTo(base.x, y - 6);
      c.stroke();
      c.setLineDash([]);
      top = { x: base.x, y: y, z: base.z };
      worldBowlDot(c, top.x, top.y, 6, '#9fd3ff');
    }
    worldBowl.marks.push({ i, base, top, z: base.z });
    const here = i === saveData.trip.node,
      locked = !canEnter(i),
      fresh = !saveData.visited[i] && !locked;
    if (here) {
      const k = 1 + 0.15 * Math.sin(t / 300);
      c.strokeStyle = 'rgba(255,226,122,.95)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(base.x, base.y, 16 * k, 6 * k, 0, 0, 7);
      c.stroke();
    }
    if (i === sel) {
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(base.x, base.y, 20, 7.5, 0, 0, 7);
      c.stroke();
    }
    if (locked) worldBowlLock(c, top.x, top.y - 10);
    else if (fresh) worldBowlDot(c, top.x + 9, top.y - 6, 4, '#ff9ec4');
    if (i === dest && !here) worldBowlDot(c, top.x, top.y - 10, 5, '#FFE27A');
    if (l.town || i === sel || here || close) {
      const name = l.name,
        y = (s.under ? top.y + 10 : top.y - 14) + (locked ? -10 : 0);
      c.font = `${l.town ? '700 ' : ''}${l.town ? 12 : 11}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(20,14,30,.75)';
      c.strokeText(name, top.x, y);
      c.fillStyle = locked ? '#cfc8d8' : '#fff8e8';
      c.fillText(name, top.x, y);
    }
  });
  /* you, standing at your place */
  const me = worldBowl.spots[saveData.trip.node],
    pq = me && bowlCamProject(v, bowlToGpu(me.x, me.y, me.h));
  if (pq) {
    const fr = personWalkFrames('me'),
      f = (fr.down || fr[Object.keys(fr)[0]])[0],
      k = 0.42,
      bob = Math.floor(t / 600) % 2;
    c.imageSmoothingEnabled = false;
    c.fillStyle = 'rgba(20,10,40,.35)';
    c.beginPath();
    c.ellipse(pq.x + 18, pq.y, 9, 3, 0, 0, 7);
    c.fill();
    c.drawImage(
      f,
      Math.round(pq.x + 18 - (f.ax || f.width / 2) * k),
      Math.round(pq.y - (f.ay || f.height) * k + bob),
      Math.round(f.width * k),
      Math.round(f.height * k)
    );
  }
}
function worldBowlDot(c, x, y, r, col) {
  c.fillStyle = 'rgba(20,14,30,.6)';
  c.beginPath();
  c.arc(x, y, r + 1.5, 0, 7);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, r, 0, 7);
  c.fill();
}
function worldBowlLock(c, x, y) {
  c.fillStyle = 'rgba(20,14,30,.7)';
  c.fillRect(x - 6, y - 4, 12, 10);
  c.strokeStyle = 'rgba(20,14,30,.7)';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(x, y - 4, 4, Math.PI, 0);
  c.stroke();
  c.fillStyle = '#d8d0e4';
  c.fillRect(x - 5, y - 3, 10, 8);
  c.strokeStyle = '#d8d0e4';
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y - 4, 4, Math.PI, 0);
  c.stroke();
}

/* ---------- touch, mouse and keys ---------- */
function worldBowlBind(cv) {
  if (cv._bowlBound) return;
  cv._bowlBound = 1;
  cv.tabIndex = 0;
  cv.addEventListener('contextmenu', e => worldBowl.on && e.preventDefault());
  const P = worldBowl.pts,
    two = () => {
      const [a, b] = [...P.values()];
      return {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
        my: (a[1] + b[1]) / 2,
      };
    },
    live = e => worldBowl.on && (e.stopImmediatePropagation(), true);
  /* capture first, so the old map's own listeners (bound to the same canvas) never see a gesture meant for the bowl */
  cv.addEventListener(
    'pointerdown',
    e => {
      if (!live(e)) return;
      P.set(e.pointerId, [e.clientX, e.clientY]);
      worldBowl.goal = null;
      worldBowl.drag = {
        x: e.clientX,
        y: e.clientY,
        cam: worldBowl.cam,
        view: worldBowl.view || bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight),
        turn: e.button === 2 || e.shiftKey || e.ctrlKey,
        moved: 0,
        g: null,
      };
      cv.setPointerCapture(e.pointerId);
    },
    true
  );
  cv.addEventListener(
    'pointermove',
    e => {
      if (!live(e)) return;
      const D = worldBowl.drag;
      if (!D) return;
      if (P.has(e.pointerId)) P.set(e.pointerId, [e.clientX, e.clientY]);
      if (P.size > 1) {
        const g = two();
        if (!D.g) {
          D.g = g;
          D.cam = worldBowl.cam;
        }
        let da = g.ang - D.g.ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        worldBowl.cam = bowlCamTurn(bowlCamZoom(D.cam, D.g.d / Math.max(1, g.d)), -da, (g.my - D.g.my) * 0.004);
        D.moved = 1;
        worldBowl.dirty = true;
        return;
      }
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) D.moved = 1;
      if (!D.moved) return;
      worldBowl.cam = D.turn ? bowlCamTurn(D.cam, -dx * 0.006, dy * 0.004) : bowlCamPan(D.cam, D.view, dx, dy);
      worldBowl.dirty = true;
    },
    true
  );
  const up = e => {
    if (!live(e)) return;
    P.delete(e.pointerId);
    const D = worldBowl.drag;
    if (P.size) {
      /* one finger left of two: carry on dragging from here */
      if (D) {
        const [p] = [...P.values()];
        Object.assign(D, { g: null, x: p[0], y: p[1], cam: worldBowl.cam, view: worldBowl.view, turn: false });
      }
      return;
    }
    worldBowl.drag = null;
    worldBowl.dirty = true;
    if (D && !D.moved && e.type === 'pointerup') worldBowlPick(e);
  };
  cv.addEventListener('pointerup', up, true);
  cv.addEventListener('pointercancel', up, true);
  cv.addEventListener(
    'wheel',
    e => {
      if (!live(e)) return;
      e.preventDefault();
      if (e.shiftKey) worldBowl.cam = bowlCamTurn(worldBowl.cam, (e.deltaY || e.deltaX) * 0.003, 0);
      else worldBowl.cam = bowlCamZoom(worldBowl.cam, e.deltaY > 0 ? 1.12 : 0.89);
      worldBowl.goal = null;
      worldBowl.dirty = true;
    },
    { passive: false, capture: true }
  );
  cv.addEventListener(
    'keydown',
    e => {
      if (!live(e)) return;
      const k = e.key,
        v = worldBowl.view || bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight),
        c = worldBowl.cam;
      const next =
        k === 'ArrowLeft' || k === 'a'
          ? bowlCamPan(c, v, 60, 0)
          : k === 'ArrowRight' || k === 'd'
            ? bowlCamPan(c, v, -60, 0)
            : k === 'ArrowUp' || k === 'w'
              ? bowlCamPan(c, v, 0, 60)
              : k === 'ArrowDown' || k === 's'
                ? bowlCamPan(c, v, 0, -60)
                : k === 'q'
                  ? bowlCamTurn(c, -0.2, 0)
                  : k === 'e'
                    ? bowlCamTurn(c, 0.2, 0)
                    : k === '+' || k === '='
                      ? bowlCamZoom(c, 0.8)
                      : k === '-'
                        ? bowlCamZoom(c, 1.25)
                        : null;
      if (!next) return;
      e.preventDefault();
      worldBowl.goal = next;
      worldBowl.dirty = true;
    },
    true
  );
}
/* a tap: the nearest miniature under the finger (its whole height counts), else the place nearest the ground tapped */
function worldBowlPick(e) {
  const r = worldMap.cv.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;
  let best = null,
    bd = 30;
  for (const m of worldBowl.marks || []) {
    const ax = m.base.x,
      ay = m.base.y,
      bx = m.top.x,
      by = m.top.y,
      L = (bx - ax) ** 2 + (by - ay) ** 2,
      k = L ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)) : 0,
      dd = Math.hypot(x - (ax + (bx - ax) * k), y - (ay + (by - ay) * k)) + m.z * 2;
    if (dd < bd) {
      bd = dd;
      best = m.i;
    }
  }
  if (best === null) {
    const g = worldBowl.view && bowlPickGround(worldBowl.view, x, y);
    if (g) {
      let gd = 0.07;
      worldBowl.spots.forEach((s, i) => {
        if (s.under) return;
        const dd = Math.hypot(s.x - g[0], s.y - g[1]);
        if (dd < gd) {
          gd = dd;
          best = i;
        }
      });
    }
  }
  if (best !== null) worldMapSelect(best);
}

/* ---------- the map's buttons: the old map's extra set, minus what the bowl doesn't have ---------- */
function worldBowlChrome() {
  worldMapGlChrome();
  const box = $('.map-full');
  if (!box) return;
  const flat = box.querySelector('[data-a=mflat]');
  if (flat) flat.remove();
  const mv = box.querySelector('.mapview');
  if (mv) mv.hidden = true;
  const h = box.querySelector('.map-head .sub');
  if (h) h.textContent = 'The Hollow Earth · bowl preview';
  if (!box.querySelector('.mapbowl')) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="mapview mapbowl glass" role="group" aria-label="Look around"><button class="mbtn sm" data-k="left" aria-label="Turn left" title="Turn left">⟲</button><button class="mbtn sm" data-k="all" aria-label="See the whole bowl" title="The whole bowl">◎</button><button class="mbtn sm" data-k="right" aria-label="Turn right" title="Turn right">⟳</button></div>`
    );
    box.querySelector('.mapbowl').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !worldBowl.on) return;
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.goal =
        b.dataset.k === 'all' ? bowlCamOverview(c.yaw) : bowlCamTurn(c, b.dataset.k === 'left' ? -0.6 : 0.6, 0);
      worldBowl.dirty = true;
    });
  }
}
