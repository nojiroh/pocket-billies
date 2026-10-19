'use strict';
/* ================= THE WORLD MAP: THE BOWL (phase 10) =================
   The lower half of the Hollow Earth seen from above, like a tabletop (docs/phases/10-world-map-bowl.md). This is the
   Map tab, the airship flight, the picture of the Hollow Earth in the opening fall (opening-fall.js films it) and the
   far wall the walk scenes see at their horizon (walk/sky.js). The old sphere map is gone (session E-map-4).
   The ground is a low-poly mesh over the grid in logic/bowl.js: the bowl's floor and walls, each place's bump or dip
   (gentle, owner 2026-10-19), coloured by region with the roads laid into it. Places are pins (owner: no miniatures
   yet); the camera's arithmetic is logic/bowl-camera.js. The debug menu's and Settings' "Bowl map test"
   (bowl-map-test.js) checks it on a device.
   Controls: one finger drags the land; two fingers pinch to zoom, twist to turn and slide up or down to tilt; on a
   computer the wheel zooms and the right button (or Shift) turns and tilts; arrows or WASD pan, Q and E turn. Home goes
   back to where you are; tapping a pin opens the place's card (Travel is the card's own button). Coming from a walk
   scene, the walk camera rises and the bowl takes over close above you and pulls back. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { airshipFlight, flyDraw, flySkip, flyTick, paintWorldMapCard, provide, render } from './hooks.js';
import { $ } from './util.js';
import { LOCATIONS, LOCATION_BY_ID, ROADS, gameData, locationSubtitle } from './game-data.js';
import { canEnter, distanceText, tripTo } from './logic/rules.js';
import {
  BOWL_GROUND_EXTENT,
  bowlGridHeight,
  bowlGroundGrid,
  bowlHeight,
  bowlRelief,
  bowlReliefFeatures,
  bowlSpotOf,
  bowlXY,
} from './logic/bowl.js';
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
  bowlCamUseGround,
  bowlCamView,
  bowlCamZoom,
  bowlPickGround,
  bowlSurface,
  bowlToGpu,
} from './logic/bowl-camera.js';
import { isLiteMap, loadMapFile } from './map-files.js';
import { escapeHtml, reducedMotion, saveData, uiState } from './game-state.js';
import { frameCount, frameStop, frameTask } from './frame-scheduler.js';
import { artPixels, uiIconHTML } from './art.js';
import { personWalkFrames } from './person-art.js';
import { walkView } from './walk-view.js';
import {
  bindQuad,
  ensurePrograms,
  gpuLoading,
  gpuState,
  initWebgl,
  renderTarget,
  uploadMesh,
  webgl2Supported,
} from './engine/webgl.js';
import { POST_EFFECT_SHADERS, drawPostEffects, projectToScreenUv } from './engine/post-effects.js';
import { walkRenderer } from './walk/walk-state.js';
import { clampZoom } from './walk/camera.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_BAYER: [() => BOWL_BAYER],
  BOWL_HAZE: [() => BOWL_HAZE],
  BOWL_INDEX: [() => BOWL_INDEX],
  BOWL_KIND_GROUND: [() => BOWL_KIND_GROUND],
  BOWL_METRES: [() => BOWL_METRES],
  BOWL_MIX: [() => BOWL_MIX],
  BOWL_PIN: [() => BOWL_PIN],
  BOWL_REGION_GROUND: [() => BOWL_REGION_GROUND],
  BOWL_SUN: [() => BOWL_SUN],
  BOWL_WALL_W: [() => BOWL_WALL_W],
  WORLD_BOWL_SHADERS: [() => WORLD_BOWL_SHADERS],
  bowlHash: [() => bowlHash],
  bowlNoise: [() => bowlNoise, v => (bowlNoise = v)],
  bowlWallTexture: [() => bowlWallTexture, v => ((bowlWallTexture = v), provide({ bowlWallTexture }))],
  worldBowl: [() => worldBowl],
  worldBowlColorAt: [() => worldBowlColorAt, v => (worldBowlColorAt = v)],
  worldBowlDot: [() => worldBowlDot, v => (worldBowlDot = v)],
  worldBowlFilm: [() => worldBowlFilm, v => (worldBowlFilm = v)],
  worldBowlGpu: [() => worldBowlGpu, v => (worldBowlGpu = v)],
  worldBowlLine: [() => worldBowlLine, v => (worldBowlLine = v)],
  worldBowlLock: [() => worldBowlLock, v => (worldBowlLock = v)],
  worldBowlMesh: [() => worldBowlMesh, v => (worldBowlMesh = v)],
  worldBowlOverlay: [() => worldBowlOverlay, v => (worldBowlOverlay = v)],
  worldBowlPick: [() => worldBowlPick, v => (worldBowlPick = v)],
  worldBowlPin: [() => worldBowlPin, v => (worldBowlPin = v)],
  worldBowlRender: [() => worldBowlRender, v => setWorldBowlRender(v)],
  worldBowlRoadsInto: [() => worldBowlRoadsInto, v => (worldBowlRoadsInto = v)],
  worldBowlSpots: [() => worldBowlSpots, v => (worldBowlSpots = v)],
  worldBowlStampMap: [() => worldBowlStampMap, v => (worldBowlStampMap = v)],
  worldBowlStampMaps: [() => worldBowlStampMaps, v => (worldBowlStampMaps = v)],
  worldBowlTerrainGpu: [() => worldBowlTerrainGpu, v => (worldBowlTerrainGpu = v)],
  worldBowlTerrainKinds: [() => worldBowlTerrainKinds, v => (worldBowlTerrainKinds = v)],
  worldBowlTerrainPictures: [() => worldBowlTerrainPictures, v => (worldBowlTerrainPictures = v)],
  worldBowlTerrainStart: [() => worldBowlTerrainStart, v => (worldBowlTerrainStart = v)],
  worldMap: [() => worldMap],
  worldMapAction: [() => worldMapAction, v => (worldMapAction = v)],
  worldMapBackToWalk: [() => worldMapBackToWalk, v => (worldMapBackToWalk = v)],
  worldMapBind: [() => worldMapBind, v => (worldMapBind = v)],
  worldMapCanvasGl: [() => worldMapCanvasGl, v => (worldMapCanvasGl = v)],
  worldMapChrome: [() => worldMapChrome, v => (worldMapChrome = v)],
  worldMapFade: [() => worldMapFade, v => (worldMapFade = v)],
  worldMapFit: [() => worldMapFit, v => (worldMapFit = v)],
  worldMapHeight: [() => worldMapHeight, v => (worldMapHeight = v)],
  worldMapLocationListHTML: [() => worldMapLocationListHTML, v => (worldMapLocationListHTML = v)],
  worldMapLoop: [() => worldMapLoop, v => (worldMapLoop = v)],
  worldMapMount: [() => worldMapMount, v => setWorldMapMount(v)],
  worldMapOpenFromWalk: [() => worldMapOpenFromWalk, v => (worldMapOpenFromWalk = v)],
  worldMapPinState: [() => worldMapPinState, v => (worldMapPinState = v)],
  worldMapReset: [() => worldMapReset, v => (worldMapReset = v)],
  worldMapSelect: [() => worldMapSelect, v => (worldMapSelect = v)],
  worldMapSize: [() => worldMapSize, v => (worldMapSize = v)],
  worldMapSpot: [() => worldMapSpot, v => (worldMapSpot = v)],
  worldMapWanted: [() => worldMapWanted, v => (worldMapWanted = v)],
  worldMapWidth: [() => worldMapWidth, v => (worldMapWidth = v)],
  worldMapZoom: [() => worldMapZoom, v => (worldMapZoom = v)],
});
/* eslint-enable no-func-assign */
provide({ bowlWallTexture });
export function setWorldBowlRender(v) {
  worldBowlRender = v; // eslint-disable-line no-func-assign
  provide({ worldBowlRender });
}
export function setWorldMapMount(v) {
  worldMapMount = v; // eslint-disable-line no-func-assign
  provide({ worldMapMount });
}
/* to-module: end */
export let worldMapWidth = 176,
  worldMapHeight = 232;
/** the Map tab's canvas (2D, over the GPU's #dio) and whether it shows */
export const worldMap = { cv: null, ctx: null, dirty: true, gl: false, on: false, dpr: 1, list: false };

export const worldBowl = {
  on: false,
  /** the camera now, where it is easing to (null: nowhere), and a timed move (the zoom-out, Home) */
  cam: null,
  goal: null,
  tween: null,
  view: null,
  /** the place picked last, so a new pick (card, Places list) brings the camera over */
  sel: undefined,
  drag: null,
  pts: new Map(),
  lastT: 0,
  dirty: true,
  /** each place's spot seen from above, in node order (Pearlantis: Kelpport's, with under = 1), and the ground */
  spots: null,
  ground: null,
  /** frames drawn, and the last few draw times in ms and frame times (for the bowl map test) */
  frames: 0,
  ms: [],
  ts: [],
  /** the bowl map test: keep drawing every frame and turn by this many radians a second */
  bench: null,
  /** where each pin is on screen, last drawn: { i, base, top, z } */
  marks: [],
};

const BOWL_SUN = [0, 1.7, 0];
const BOWL_HAZE = [0.69, 0.73, 0.92];
const BOWL_PIN = 22; /* a pin's height on screen, in pixels */

/* the ground's scale: metres to the bowl's radius, squares across the terrain map, and the far-colours' size */
const BOWL_METRES = 1000;
const BOWL_INDEX = 2048;
const BOWL_MIX = 1024;
export const WORLD_BOWL_SHADERS = {
  /* the sky: pale towards the rim line, the Inner Sun overhead (depth at the very back) */
  msky: [
    `#version 300 es
precision highp float;in vec2 aC;void main(){gl_Position=vec4(aC*2.-1.,.99999,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;uniform vec3 uC,uFw,uRt,uUp,uSun;uniform float uFoc,uR;uniform vec2 uWH;
void main(){vec2 px=gl_FragCoord.xy/uR;vec3 d=normalize(uFw+uRt*(px.x-uWH.x*.5)/uFoc+uUp*(px.y-uWH.y*.5)/uFoc);
 vec3 c=mix(vec3(.98,.87,.72),vec3(.6,.71,.95),smoothstep(-.05,.7,d.y));
 vec3 sd=normalize(uSun-uC);float a=max(0.,dot(d,sd));c+=vec3(1.,.9,.6)*(pow(a,900.)*3.+pow(a,40.)*.35);o=vec4(c,1.);}`,
  ],
  /* the ground: one low-poly mesh, lit facet by facet by the Inner Sun, painted with the walk scenes' terrain
     pictures (a square a metre, 16 px each, sharp) close up and their average colours far away */
  mground: [
    `#version 300 es
precision highp float;in vec3 aPos;uniform mat4 uVP;out vec3 vW;void main(){vW=aPos;gl_Position=uVP*vec4(aPos,1.);}`,
    `#version 300 es
precision highp float;precision highp sampler2DArray;in vec3 vW;out vec4 o;uniform sampler2D uIdx,uMix;uniform sampler2DArray uLay;uniform vec3 uC,uSun,uHaze;uniform float uOn;
void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));if(n.y<0.)n=-n;
 vec2 q=vec2(vW.x,-vW.z),uv=vec2(q.x*.5+.5,.5-q.y*.5);vec3 far=uOn>.5?texture(uMix,uv).rgb:vec3(.5,.63,.38),c=far;
 vec2 m=q*${BOWL_METRES.toFixed(1)};float px=max(length(dFdx(m)),length(dFdy(m)));
 if(uOn>.5&&px<4.){float L=floor(texelFetch(uIdx,ivec2(clamp(uv*${BOWL_INDEX.toFixed(1)},vec2(0.),vec2(${(BOWL_INDEX - 1).toFixed(1)}))),0).r*255.+.5);
  vec3 near=textureGrad(uLay,vec3(fract(m),L),dFdx(m),dFdy(m)).rgb;c=mix(near,far,smoothstep(1.4,4.,px));}
 float lit=.58+.5*max(0.,dot(n,normalize(uSun-vW)))-.1*(1.-n.y);c*=lit;
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.6)),1.);}`,
  ],
};
provide({ WORLD_BOWL_SHADERS }); /* to-module */

/* ---------- the places and the ground ---------- */
/* where a place is on the bowl: x, y seen from above and the ground's height there */
export function worldMapSpot(i) {
  return worldBowlSpots()[i] || { x: 0, y: 0, h: 0, under: 0 };
}
/* ---------- the ground's terrain (owner, 2026-10-19: high resolution, real terrain) ----------
   The ground is painted with the walk scenes' own terrain pictures (scenery.json terrains, 16 px a square), on a map of
   which terrain lies where: one square of it about a metre (BOWL_METRES to the bowl's radius). Each place's own walk
   map is laid on it square by square, turned the way it sits on the bowl (its north to the centre), as soon as its map
   file is in; between places each region's own grounds in patches with a pixel-art dither, water in the dips, snow on
   the highest tops, and paths along the roads. From far away, where a square is smaller than a pixel, each terrain's
   average colour stands in (BOWL_MIX texture) so the ground doesn't shimmer. */
/* each region's grounds between places (from what its walk maps are made of), and some kinds' own around them */
const BOWL_REGION_GROUND = {
  starter: 'gGlCtg',
  meadowlands: 'gEERCg',
  goldenhills: 'BAB4gB',
  sporeforest: 'JyLMJy',
  crystalcaverns: 'krXvkr',
  coraltrench: 'N3N2gN',
  cloudspire: 'UgUvtU',
  innersun: 'YWYBYW',
};
const BOWL_KIND_GROUND = {
  sea: 'dwdS',
  pond: 'wwgR',
  lake: 'wdwl',
  island: 'sSws',
  volcano: 'zjzZ',
  canyon: 'srsP',
  summit: 'nnIr',
  pass: 'rnrv',
  ridge: 'rgHr',
  trench: 'dd3N',
  thicket: 'yLyM',
  farm: 'oGol',
  golf: 'lGlg',
  bins: 'xvxu',
  grotto: 'krkM',
};
function worldBowlSpots() {
  if (worldBowl.spots) return worldBowl.spots;
  const F = bowlReliefFeatures(LOCATIONS),
    G = bowlGroundGrid(F);
  bowlCamUseGround(G);
  const byId = id => LOCATION_BY_ID[id];
  worldBowl.spots = LOCATIONS.map(l => {
    const s = bowlSpotOf(l, byId),
      [x, y] = bowlXY(s.a, s.r);
    return { x, y, under: s.under, h: bowlGridHeight(G, x, y) };
  });
  worldBowl.ground = { F, G, mesh: null, terrain: null };
  return worldBowl.spots;
}
/* the terrain kinds: their keys in a fixed order (a layer each), their pictures' pixels and average colours */
function worldBowlTerrainKinds() {
  const T = (gameData.scenery && gameData.scenery.terrains) || {},
    keys = Object.keys(T);
  return { T, keys, layer: Object.fromEntries(keys.map((k, n) => [k, n])) };
}
/* a hash in 0-1 for a square, and a smooth value noise (patches of ground) */
const bowlHash = (i, j) => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function bowlNoise(x, y) {
  const i = Math.floor(x),
    j = Math.floor(y),
    u = x - i,
    v = y - j,
    a = bowlHash(i, j),
    b = bowlHash(i + 1, j),
    c = bowlHash(i, j + 1),
    d = bowlHash(i + 1, j + 1),
    su = u * u * (3 - 2 * u),
    sv = v * v * (3 - 2 * v);
  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}
const BOWL_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
/* the terrain between places, worked out in rows a frame at a time (the map shows its colours meanwhile) */
function worldBowlTerrainStart() {
  const g = worldBowl.ground;
  if (g.terrain) return g.terrain;
  const K = worldBowlTerrainKinds(),
    N = BOWL_INDEX,
    idx = new Uint8Array(N * N),
    S = worldBowl.spots,
    /* the nearest place on a coarse grid, for each region's and kind's ground */
    C = 256,
    near = new Uint8Array(C * C),
    own = [];
  S.forEach((s, i) => !s.under && own.push(i));
  for (let j = 0; j < C; j++)
    for (let i = 0; i < C; i++) {
      const x = -1 + ((i + 0.5) / C) * 2,
        y = 1 - ((j + 0.5) / C) * 2;
      let best = 0,
        bd = 9;
      for (const k of own) {
        const d = (x - S[k].x) ** 2 + (y - S[k].y) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      near[j * C + i] = best;
    }
  const lists = LOCATIONS.map(l => {
    const r = (BOWL_REGION_GROUND[l.region] || BOWL_REGION_GROUND.starter).split(''),
      k = (BOWL_KIND_GROUND[l.t] || '').split('');
    return { r: r.filter(c => c in K.layer).map(c => K.layer[c]), k: k.filter(c => c in K.layer).map(c => K.layer[c]) };
  });
  const L = K.layer;
  g.terrain = { K, idx, near, lists, row: 0, ready: false, stamped: new Set(), dirty: true, gl: null };
  g.terrain.fill = rows => {
    const T = g.terrain,
      end = Math.min(N, T.row + rows);
    for (let j = T.row; j < end; j++)
      for (let i = 0; i < N; i++) {
        const x = -1 + ((i + 0.5) / N) * 2,
          y = 1 - ((j + 0.5) / N) * 2,
          r = Math.hypot(x, y);
        if (r > 1.01) continue;
        /* the place this square belongs to, its edges dithered so regions meet in a pixel-art border */
        const ci = Math.min(C - 1, Math.max(0, Math.floor(((x + 1) / 2) * C + (bowlHash(i, j) - 0.5) * 3))),
          cj = Math.min(C - 1, Math.max(0, Math.floor(((1 - y) / 2) * C + (bowlHash(j, i) - 0.5) * 3))),
          p = T.near[cj * C + ci],
          s = S[p],
          ls = T.lists[p],
          d = Math.hypot(x - s.x, y - s.y),
          rel = bowlGridHeight(g.G, x, y) - bowlHeight(Math.min(1, r)) /* the relief, read from the grid: cheap */,
          m = (x * BOWL_METRES) / 9,
          n = (y * BOWL_METRES) / 9,
          pick = list => list[Math.min(list.length - 1, Math.floor(bowlNoise(m + p * 7.3, n) * list.length))],
          th = BOWL_BAYER[(j & 3) * 4 + (i & 3)];
        let t = ls.k.length && d < 0.09 + bowlNoise(m * 0.3, n * 0.3) * 0.04 ? pick(ls.k) : pick(ls.r);
        /* second pick for a dithered patch edge */
        if (ls.r.length > 1 && Math.abs(bowlNoise(m * 1.7, n * 1.7) - 0.5) < 0.06 && th < 0.5)
          t = pick(ls.r.slice().reverse());
        if (rel > 0.05 + th * 0.012 && 'n' in L) t = L.n;
        if (r > 0.985) t = L.r ?? t;
        T.idx[j * N + i] = t;
      }
    T.row = end;
    T.dirty = true;
    if (T.row >= N) {
      worldBowlRoadsInto(T);
      T.ready = true;
    }
  };
  return g.terrain;
}
/* paths along the roads, a few squares wide (the places' own maps lie over their ends) */
function worldBowlRoadsInto(T) {
  const N = BOWL_INDEX,
    S = worldBowl.spots,
    path = T.K.layer.p ?? T.K.layer.u;
  if (path == null) return;
  for (const [a, b] of ROADS) {
    const A = S[a],
      B = S[b];
    if (!A || !B || A.under || B.under) continue;
    const len = Math.hypot(B.x - A.x, B.y - A.y) * (N / 2),
      steps = Math.ceil(len * 2);
    for (let k = 0; k <= steps; k++) {
      const f = k / steps,
        cx = ((A.x + (B.x - A.x) * f + 1) / 2) * N,
        cy = ((1 - (A.y + (B.y - A.y) * f)) / 2) * N;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = Math.floor(cx + dx),
            j = Math.floor(cy + dy);
          if (i >= 0 && j >= 0 && i < N && j < N) T.idx[j * N + i] = path;
        }
    }
  }
}
/* a place's own walk map laid on the ground: each square of the bowl in its turned footprint takes the map's square */
function worldBowlStampMap(T, i) {
  const l = LOCATIONS[i],
    s = worldBowl.spots[i],
    M = l && gameData.maps && gameData.maps[l.mapId];
  if (!M || !M.tiles || !M.tiles.length || s.under || T.stamped.has(i)) return false;
  T.stamped.add(i);
  const N = BOWL_INDEX,
    r = Math.hypot(s.x, s.y),
    north = r < 1e-6 ? [0, 1] : [-s.x / r, -s.y / r],
    east = [north[1], -north[0]],
    w = M.w,
    h = M.h,
    half = Math.hypot(w, h) / 2 / BOWL_METRES,
    i0 = Math.max(0, Math.floor(((s.x - half + 1) / 2) * N)),
    i1 = Math.min(N - 1, Math.ceil(((s.x + half + 1) / 2) * N)),
    j0 = Math.max(0, Math.floor(((1 - (s.y + half)) / 2) * N)),
    j1 = Math.min(N - 1, Math.ceil(((1 - (s.y - half)) / 2) * N)),
    L = T.K.layer;
  for (let j = j0; j <= j1; j++)
    for (let ii = i0; ii <= i1; ii++) {
      const x = -1 + ((ii + 0.5) / N) * 2 - s.x,
        y = 1 - ((j + 0.5) / N) * 2 - s.y,
        mx = (x * east[0] + y * east[1]) * BOWL_METRES + w / 2,
        mz = (x * north[0] + y * north[1]) * BOWL_METRES + h / 2;
      if (mx < 0 || mz < 0 || mx >= w || mz >= h) continue;
      const ch = (M.tiles[h - 1 - Math.floor(mz)] || '')[Math.floor(mx)],
        t = L[ch];
      if (t != null) T.idx[j * N + ii] = t;
    }
  T.dirty = true;
  return true;
}
/* the places' maps, loaded a few at a time while the map is open (the walk scenes load the near ones anyway) */
function worldBowlStampMaps(T) {
  if (T.loading) return;
  for (let i = 0; i < LOCATIONS.length; i++) {
    if (T.stamped.has(i) || worldBowl.spots[i].under) continue;
    const id = LOCATIONS[i].mapId;
    if (!id || !gameData.maps[id]) {
      T.stamped.add(i);
      continue;
    }
    if (typeof isLiteMap === 'function' && isLiteMap(id)) {
      T.loading = true;
      loadMapFile(id)
        .catch(() => {})
        .finally(() => {
          T.loading = false;
          worldBowlStampMap(T, i);
          worldBowl.dirty = true;
        });
      return;
    }
    worldBowlStampMap(T, i);
  }
}
/* the terrain pictures as one stack of layers, and each one's average colour */
async function worldBowlTerrainPictures(T) {
  if (T.pix) return T.pix;
  const n = T.K.keys.length,
    data = new Uint8Array(16 * 16 * 4 * n),
    avg = new Float32Array(n * 3);
  await Promise.all(
    T.K.keys.map(async (k, layer) => {
      const tile = T.K.T[k].tile;
      let px = null;
      try {
        px = tile ? new Uint8Array((await artPixels(tile)).buffer) : null;
      } catch (e) {
        px = null;
      }
      let r = 0,
        g = 0,
        b = 0;
      for (let p = 0; p < 256; p++) {
        /* tiles are 16 x 16; anything else is sampled to fit */
        const q = px ? p * 4 : -1,
          col = q >= 0 && q + 3 < px.length ? [px[q], px[q + 1], px[q + 2]] : [128, 128, 128];
        data.set([col[0], col[1], col[2], 255], (layer * 256 + p) * 4);
        r += col[0];
        g += col[1];
        b += col[2];
      }
      avg.set([r / 256 / 255, g / 256 / 255, b / 256 / 255], layer * 3);
    })
  );
  T.pix = { data, avg };
  return T.pix;
}
/* the GPU's copies: the terrain map (one byte a square), the layers, and the far-away colours */
function worldBowlTerrainGpu(T) {
  const gl = gpuState.gl;
  if (!T.pix) return false;
  if (T.gl !== gl) {
    T.gl = gl;
    T.tIdx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, T.tIdx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, BOWL_INDEX, BOWL_INDEX, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    T.tLay = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, T.tLay);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, T.K.keys.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.pix.data);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    T.tMix = gl.createTexture();
    T.dirty = true;
  }
  /* new squares go up at most twice a second (the terrain fills and the maps come in a bit at a time) */
  const now = performance.now();
  if (T.dirty && now - (T.upAt || 0) > 500) {
    T.dirty = false;
    T.upAt = now;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, T.tIdx);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BOWL_INDEX, BOWL_INDEX, gl.RED, gl.UNSIGNED_BYTE, T.idx);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const M = BOWL_MIX,
      k = BOWL_INDEX / M,
      mix = new Uint8Array(M * M * 4),
      A = T.pix.avg;
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let dj = 0; dj < k; dj++)
          for (let di = 0; di < k; di++) {
            const t = T.idx[(j * k + dj) * BOWL_INDEX + i * k + di] * 3;
            r += A[t];
            g += A[t + 1];
            b += A[t + 2];
          }
        const q = (j * M + i) * 4;
        mix[q] = (r / (k * k)) * 255;
        mix[q + 1] = (g / (k * k)) * 255;
        mix[q + 2] = (b / (k * k)) * 255;
        mix[q + 3] = 255;
      }
    T.mix = mix;
    gl.bindTexture(gl.TEXTURE_2D, T.tMix);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, M, M, 0, gl.RGBA, gl.UNSIGNED_BYTE, mix);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (worldBowl.wall) worldBowl.wall.node = -1; /* the walk scenes' far wall takes the new colours */
  }
  return true;
}
/* the ground's colour at a point, from the far-away colours (or a region's, before they are made) */
function worldBowlColorAt(x, y) {
  const T = worldBowl.ground && worldBowl.ground.terrain;
  if (T && T.mix) {
    const M = BOWL_MIX,
      i = Math.max(0, Math.min(M - 1, Math.floor(((x + 1) / 2) * M))),
      j = Math.max(0, Math.min(M - 1, Math.floor(((1 - y) / 2) * M))),
      q = (j * M + i) * 4;
    return [T.mix[q] / 255, T.mix[q + 1] / 255, T.mix[q + 2] / 255];
  }
  return [0.5, 0.62, 0.38];
}
/* the mesh: the grid's cells over the bowl; corners beyond the rim are pulled onto it, so the edge is a clean circle */
function worldBowlMesh() {
  const { n, e, h } = worldBowl.ground.G,
    w = n + 1,
    V = new Float32Array(w * w * 3),
    I = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      let x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      const r = Math.hypot(x, y);
      if (r > 1) {
        x /= r;
        y /= r;
      }
      V.set(
        bowlToGpu(x, y, r > 1 ? bowlHeight(1) + bowlRelief(worldBowl.ground.F, x, y) : h[j * w + i]),
        (j * w + i) * 3
      );
    }
  const cell = (2 * e) / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -e + cell * (i + 0.5),
        y = -e + cell * (j + 0.5);
      if (Math.hypot(x, y) > 1 + cell) continue;
      const a = j * w + i,
        b = a + 1,
        c = a + w,
        d = c + 1;
      /* split from (i, j) to (i + 1, j + 1), as bowlGridHeight reads it */
      I.push(a, b, d, a, d, c);
    }
  return uploadMesh(V, new Uint32Array(I), [['aPos', 3, 0]], 12);
}
function worldBowlGpu() {
  const g = worldBowl.ground;
  if (!g.mesh || g.gl !== gpuState.gl) {
    g.gl = gpuState.gl;
    g.mesh = worldBowlMesh();
  }
  const T = worldBowlTerrainStart();
  if (!T.ready) {
    T.fill(96);
    worldBowl.dirty = true;
  } else worldBowlStampMaps(T);
  if (!T.pix && !T.pixLoading) {
    T.pixLoading = true;
    worldBowlTerrainPictures(T).then(() => (worldBowl.dirty = true));
  }
  g.ok = T.ready && worldBowlTerrainGpu(T);
  if (T.dirty) worldBowl.dirty = true;
  return g;
}

/* ---------- the walk scenes' horizon: the bowl's far wall ----------
   A strip round the horizon, worked out from where you stand: for each direction (east is the walk scene's +x, north
   its +z), how high the land rises against the sky and its colour there. walk/sky.js draws it under the clouds. */
const BOWL_WALL_W = 512;
function bowlWallTexture() {
  if (typeof gpuState === 'undefined' || !gpuState.gl) return null;
  const node = saveData && saveData.trip ? saveData.trip.node : 0,
    gl = gpuState.gl;
  if (worldBowl.wall && worldBowl.wall.node === node && worldBowl.wall.gl === gl) return worldBowl.wall.t;
  worldBowlSpots();
  const P = worldBowl.spots[node] || { x: 0, y: 0 },
    r = Math.hypot(P.x, P.y),
    north = r < 1e-6 ? [0, 1] : [-P.x / r, -P.y / r],
    east = [north[1], -north[0]],
    eye = bowlSurface(P.x, P.y) + 0.004,
    px = new Uint8Array(BOWL_WALL_W * 4 * 4);
  for (let k = 0; k < BOWL_WALL_W; k++) {
    /* the shader's longitude: atan(d.z, d.x), u = lon / 2pi + .5 */
    const lon = (k / BOWL_WALL_W - 0.5) * 2 * Math.PI,
      ce = Math.cos(lon),
      cn = Math.sin(lon),
      dx = east[0] * ce + north[0] * cn,
      dy = east[1] * ce + north[1] * cn;
    let best = -1,
      bx = P.x,
      by = P.y;
    for (let s = 0.06; s < 2.6; s += 0.015) {
      const x = P.x + dx * s,
        y = P.y + dy * s;
      if (Math.hypot(x, y) > BOWL_GROUND_EXTENT) break;
      const el = (bowlSurface(x, y) - eye) / s;
      if (el > best) {
        best = el;
        bx = x;
        by = y;
      }
    }
    const top = best > 0 ? Math.sin(Math.atan(best)) : 0,
      c = worldBowlColorAt(bx, by);
    for (let row = 0; row < 4; row++) {
      const o = (row * BOWL_WALL_W + k) * 4;
      px[o] = Math.round(Math.min(1, c[0]) * 255);
      px[o + 1] = Math.round(Math.min(1, c[1]) * 255);
      px[o + 2] = Math.round(Math.min(1, c[2]) * 255);
      px[o + 3] = Math.round(Math.min(1, top / 0.6) * 255);
    }
  }
  if (worldBowl.wall && worldBowl.wall.gl === gl) gl.deleteTexture(worldBowl.wall.t);
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BOWL_WALL_W, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  worldBowl.wall = { node, gl, t };
  return t;
}

/* ---------- mount, size, loop ---------- */
/* the bowl needs WebGL 2; without it the Map tab shows the Places list */
export function worldMapWanted() {
  return typeof gpuState !== 'undefined' && !gpuState.fail && !gpuState.lost && webgl2Supported();
}
function worldMapCanvasGl() {
  if (!worldMapWanted()) return false;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  if (gpuState.cv !== cv) {
    if (walkView.cv && walkView.cv !== cv) return false;
    if (!initWebgl(cv)) {
      gpuState.fail = 1;
      return false;
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.gkey = '';
      walkRenderer.farKey = '';
    }
  }
  if (!gpuState.P.msky) gpuLoading();
  try {
    ensurePrograms(WORLD_BOWL_SHADERS);
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
export function worldMapMount() {
  const cv = $('#mapcv');
  worldBowl.on = false;
  if (!cv) return;
  worldMap.cv = cv;
  worldMap.ctx = cv.getContext('2d');
  if (!worldMapCanvasGl()) {
    /* no WebGL here: the Places list is the map */
    worldMap.gl = false;
    document.body.classList.remove('map-gl', 'map-bowl');
    worldMap.list = true;
    worldMapChrome();
    worldMapFade(false);
    return;
  }
  worldBowl.on = true;
  worldMap.gl = true;
  document.body.classList.add('map-gl', 'map-bowl');
  worldMapSize();
  worldBowlSpots();
  const me = worldBowl.spots[saveData.trip.node] || { x: 0, y: 0, h: 0 },
    yaw = worldBowl.cam ? worldBowl.cam.yaw : Math.hypot(me.x, me.y) > 0.05 ? Math.atan2(me.x, me.y) : 0,
    home = bowlCamHome(me.x, me.y, yaw);
  if (typeof airshipFlight !== 'undefined' && airshipFlight.on) {
    /* the flight: from above where it takes off, far enough out to see the way */
    const A = worldBowl.spots[airshipFlight.a] || me;
    worldBowl.cam = bowlCamClamp({ ...bowlCamHome(A.x, A.y, yaw), dist: Math.max(1, airshipFlight.span || 1) });
    worldBowl.goal = null;
    worldBowl.tween = null;
  } else if (uiState.mglFrom === 'walk' && !reducedMotion) {
    /* from the walk scene: start right above you, looking down, and pull back to the usual view */
    worldBowl.cam = { tx: me.x, ty: me.y, yaw: home.yaw, tilt: 1.35, dist: 0.035 };
    worldBowl.goal = null;
    worldBowl.tween = { from: worldBowl.cam, to: home, t0: null, dur: 1300 };
  } else if (!worldBowl.cam) {
    worldBowl.cam = reducedMotion ? home : bowlCamOverview(home.yaw);
    worldBowl.goal = reducedMotion ? null : home;
  }
  uiState.mglFrom = null;
  worldBowl.sel = uiState.mapSel;
  worldMapBind(cv);
  worldMapChrome();
  worldBowl.dirty = true;
  worldBowl.fadeOut = true;
  frameTask('map', worldMapLoop);
}
function worldMapSize() {
  const cv = worldMap.cv,
    r = cv && cv.isConnected ? cv.getBoundingClientRect() : null,
    w = Math.round(r && r.width > 20 ? r.width : innerWidth),
    h = Math.round(r && r.height > 20 ? r.height : innerHeight);
  if (w !== worldMapWidth || h !== worldMapHeight) {
    worldMapWidth = w;
    worldMapHeight = h;
    worldBowl.dirty = true;
  }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (cv && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  worldMap.dpr = dpr;
}
export function worldMapFit() {
  worldMapSize();
  worldBowl.dirty = true;
}
export function worldMapZoom(k) {
  if (!worldBowl.on) return;
  worldBowl.tween = null;
  worldBowl.goal = bowlCamZoom(worldBowl.goal || worldBowl.cam, k);
  worldBowl.dirty = true;
}
/* Home: back over where you are */
export function worldMapReset() {
  if (!worldBowl.on) return;
  const me = worldBowlSpots()[saveData.trip.node];
  worldBowl.tween = null;
  worldBowl.goal = bowlCamHome(me.x, me.y, worldBowl.cam.yaw);
  worldBowl.dirty = true;
}
/* pick a place (or a region, by "f" and its number): its card, and the camera comes over it */
export function worldMapSelect(n) {
  uiState.mapSel = n;
  if (typeof paintWorldMapCard === 'function') paintWorldMapCard();
  if (worldMap.list) worldMapChrome();
  worldBowl.dirty = true;
}
function worldMapLoop(ts) {
  if (!worldBowl.on || !worldMap.cv || !worldMap.cv.isConnected) {
    worldBowl.on = false;
    document.body.classList.remove('map-bowl');
    frameStop('map');
    worldMapBackToWalk();
    return;
  }
  if (gpuState.lost) return;
  const dt = Math.min(100, ts - (worldBowl.lastT || ts));
  worldBowl.lastT = ts;
  let moving = !!(worldBowl.drag || worldBowl.bench);
  /* the airship: its place on the way, and the camera keeping it in view */
  if (typeof airshipFlight !== 'undefined' && airshipFlight.on && typeof flyTick === 'function') {
    if (flyTick(ts) && airshipFlight.pos) {
      const p = airshipFlight.pos,
        c = worldBowl.cam;
      worldBowl.goal = bowlCamClamp({ ...c, tx: p[0], ty: p[1], dist: Math.max(c.dist, airshipFlight.span || 1) });
    }
    moving = true;
  }
  /* a new pick (the card, the Places list): bring the camera over it, keeping the turn and not zooming out */
  if (uiState.mapSel !== worldBowl.sel) {
    worldBowl.sel = uiState.mapSel;
    const s = typeof worldBowl.sel === 'number' ? worldBowl.spots[worldBowl.sel] : null;
    if (s && !worldBowl.drag) {
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.tween = null;
      worldBowl.goal = bowlCamClamp({ ...c, tx: s.x, ty: s.y, dist: Math.min(c.dist, 1.3) });
    }
    worldBowl.dirty = true;
  }
  if (worldBowl.bench && worldBowl.bench.turn)
    worldBowl.cam = bowlCamTurn(worldBowl.cam, (worldBowl.bench.turn * dt) / 1000, 0);
  if (worldBowl.tween) {
    const T = worldBowl.tween;
    if (T.t0 == null) T.t0 = ts;
    const k = Math.min(1, (ts - T.t0) / T.dur),
      e = 1 - Math.pow(1 - k, 3);
    worldBowl.cam = bowlCamEase(T.from, T.to, e);
    if (k >= 1) worldBowl.tween = null;
    moving = true;
  } else if (worldBowl.goal) {
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
  worldMapSize();
  worldBowl.view = bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight);
  worldBowlRender(ts);
  worldBowlOverlay(ts);
  const ms = performance.now() - w0;
  worldBowl.frames++;
  worldBowl.ms.push(ms);
  worldBowl.ts.push(ts);
  if (worldBowl.ms.length > 240) (worldBowl.ms.shift(), worldBowl.ts.shift());
  frameCount(ms);
  if (worldBowl.fadeOut) {
    worldBowl.fadeOut = false;
    worldMapFade(false);
  }
}

/* ---------- drawing ---------- */
export function worldBowlRender(t) {
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
  worldBowlSpots();
  const g = worldBowlGpu();
  const S = renderTarget('scene', rw, rh, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, rw, rh);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  /* the sky, at the very back */
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.ALWAYS);
  gl.depthMask(false);
  let p = gpuState.P.msky,
    U = p.U;
  gl.useProgram(p.p);
  bindQuad();
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uFw, v.fw);
  gl.uniform3fv(U.uRt, v.rt);
  gl.uniform3fv(U.uUp, v.up);
  gl.uniform3fv(U.uSun, BOWL_SUN);
  gl.uniform1f(U.uFoc, v.foc);
  gl.uniform1f(U.uR, rw / worldMapWidth);
  gl.uniform2f(U.uWH, worldMapWidth, worldMapHeight);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  /* the ground */
  gl.depthMask(true);
  gl.depthFunc(gl.LEQUAL);
  const VP = bowlCamMatrix(v);
  p = gpuState.P.mground;
  U = p.U;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uSun, BOWL_SUN);
  gl.uniform3fv(U.uHaze, BOWL_HAZE);
  const T = g.terrain || worldBowl.ground.terrain;
  gl.uniform1f(U.uOn, g.ok ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, g.ok ? T.tIdx : gpuState.white);
  gl.uniform1i(U.uIdx, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, g.ok ? T.tMix : gpuState.white);
  gl.uniform1i(U.uMix, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.ok ? T.tLay : null);
  gl.uniform1i(U.uLay, 2);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(g.mesh.vao);
  gl.drawElements(gl.TRIANGLES, g.mesh.n, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  const fd = Math.max(0.05, worldBowl.cam ? worldBowl.cam.dist : 1);
  drawPostEffects(
    S,
    { near: BOWL_CAMERA.near, far: BOWL_CAMERA.far, df: fd * 1.6, F: (v.foc * rw) / worldMapWidth },
    fd,
    rw,
    rh,
    { blur: 0, fast: rw * rh > 1.2e6, noAO: true, sun: projectToScreenUv(VP, BOWL_SUN), sunCol: [1, 0.9, 0.7] }
  );
}
/* the bowl seen from any eye, for the opening fall: the ground and the sky, no pins */
export function worldBowlFilm(view, t) {
  worldMapWidth = view.W;
  worldMapHeight = view.H;
  worldBowl.view = view;
  worldBowlRender(t);
}
/* roads you're taking, pins, labels and you */
function worldBowlOverlay(t) {
  const c = worldMap.ctx,
    cv = worldMap.cv,
    d = worldMap.dpr,
    v = worldBowl.view;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  c.lineJoin = c.lineCap = 'round';
  const at = s => bowlCamProject(v, bowlToGpu(s.x, s.y, s.h + 0.003));
  /* your trip, gold */
  const trip = [saveData.trip.node, ...saveData.trip.plan],
    flying = typeof airshipFlight !== 'undefined' && airshipFlight.on;
  if (trip.length > 1 && !flying) worldBowlLine(c, trip, '#FFE27A', 3.5, [10, 8], -t / 40);
  /* the way to the place picked */
  const sel = uiState.mapSel;
  if (typeof sel === 'number' && sel !== saveData.trip.node && !flying) {
    const tr = tripTo(sel);
    if (tr && tr.plan.length)
      worldBowlLine(c, [saveData.trip.node, ...tr.plan], 'rgba(255,255,255,.9)', 2.5, [4, 7], -t / 60);
  }
  /* each place: its pin, its name for towns (all when close, or picked), its state */
  const close = worldBowl.cam.dist < 0.8,
    tags = worldBowl.cam.dist < 0.62,
    dest = saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null;
  worldBowl.marks = [];
  LOCATIONS.forEach((l, i) => {
    const s = worldBowl.spots[i],
      base = at(s);
    if (!base) return;
    let top = { x: base.x, y: base.y - BOWL_PIN, z: base.z };
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
      top = { x: base.x, y, z: base.z };
      worldBowlDot(c, top.x, top.y, 6, '#9fd3ff');
    } else if (tags && i !== sel && i !== saveData.trip.node) {
      /* close in, the ground speaks for itself: a small tag instead of a pin (the picked place and yours keep theirs) */
      top = { x: base.x, y: base.y - 6, z: base.z };
      worldBowlDot(c, base.x, base.y - 3, 3, canEnter(i) ? (l.town ? '#ffb46b' : '#8fd18a') : '#9a93a6');
    } else worldBowlPin(c, base.x, base.y, l, i);
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
    if (locked) worldBowlLock(c, top.x, top.y - 12);
    else if (fresh) worldBowlDot(c, top.x + 9, top.y - 6, 4, '#ff9ec4');
    if (i === dest && !here) worldBowlDot(c, top.x, top.y - 12, 5, '#FFE27A');
    if (l.town || i === sel || here || close) {
      const y = (s.under ? top.y + 10 : top.y - 12) + (locked ? -12 : 0);
      c.font = `${l.town ? '700 ' : ''}${l.town ? 12 : 11}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(20,14,30,.75)';
      c.strokeText(l.name, top.x, y);
      c.fillStyle = locked ? '#cfc8d8' : '#fff8e8';
      c.fillText(l.name, top.x, y);
    }
  });
  /* the airship on its way, or you standing at your place */
  if (flying && typeof flyDraw === 'function') flyDraw(c, t, (x, y, h) => bowlCamProject(v, bowlToGpu(x, y, h)));
  else {
    const me = worldBowl.spots[saveData.trip.node],
      pq = me && at(me);
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
}
/* a line along the roads between places, following the ground */
function worldBowlLine(c, nodes, col, w, dash, off) {
  const v = worldBowl.view;
  c.beginPath();
  let on = false;
  for (let k = 1; k < nodes.length; k++) {
    const A = worldBowl.spots[nodes[k - 1]],
      B = worldBowl.spots[nodes[k]];
    for (let s = 0; s <= 12; s++) {
      const x = A.x + ((B.x - A.x) * s) / 12,
        y = A.y + ((B.y - A.y) * s) / 12,
        q = bowlCamProject(v, bowlToGpu(x, y, bowlSurface(x, y) + 0.004));
      if (!q) {
        on = false;
        continue;
      }
      if (on) c.lineTo(q.x, q.y);
      else c.moveTo(q.x, q.y);
      on = true;
    }
  }
  c.setLineDash(dash);
  c.lineDashOffset = off;
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
  c.setLineDash([]);
}
/* a place's pin: a stalk standing on its spot and a round head, a house for a town; locked grey, here gold, picked
   white */
function worldBowlPin(c, x, y, l, i) {
  const locked = !canEnter(i),
    here = i === saveData.trip.node,
    head = y - BOWL_PIN,
    col = locked ? '#9a93a6' : here ? '#FFE27A' : l.town ? '#ffb46b' : '#8fd18a';
  c.fillStyle = 'rgba(20,10,40,.3)';
  c.beginPath();
  c.ellipse(x, y, 5, 2, 0, 0, 7);
  c.fill();
  c.strokeStyle = 'rgba(20,14,30,.75)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, head);
  c.stroke();
  worldBowlDot(c, x, head, l.town ? 8 : 6, uiState.mapSel === i ? '#ffffff' : col);
  if (l.town) {
    c.fillStyle = 'rgba(20,14,30,.85)';
    c.beginPath();
    c.moveTo(x - 4, head + 0.5);
    c.lineTo(x, head - 4);
    c.lineTo(x + 4, head + 0.5);
    c.closePath();
    c.fill();
    c.fillRect(x - 3, head, 6, 3.5);
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
function worldMapBind(cv) {
  if (cv._bowlBound) return;
  cv._bowlBound = 1;
  cv.tabIndex = 0;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const P = worldBowl.pts,
    flying = () => typeof airshipFlight !== 'undefined' && airshipFlight.on,
    two = () => {
      const [a, b] = [...P.values()];
      return {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
        my: (a[1] + b[1]) / 2,
      };
    };
  cv.addEventListener('pointerdown', e => {
    if (!worldBowl.on) return;
    if (flying()) {
      if (typeof flySkip === 'function') flySkip();
      return;
    }
    P.set(e.pointerId, [e.clientX, e.clientY]);
    worldBowl.goal = null;
    worldBowl.tween = null;
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
  });
  cv.addEventListener('pointermove', e => {
    const D = worldBowl.drag;
    if (!worldBowl.on || !D) return;
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
  });
  const up = e => {
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
    if (D && !D.moved && e.type === 'pointerup' && worldBowl.on) worldBowlPick(e);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener(
    'wheel',
    e => {
      if (!worldBowl.on) return;
      e.preventDefault();
      if (e.shiftKey) worldBowl.cam = bowlCamTurn(worldBowl.cam, (e.deltaY || e.deltaX) * 0.003, 0);
      else worldBowl.cam = bowlCamZoom(worldBowl.cam, e.deltaY > 0 ? 1.12 : 0.89);
      worldBowl.goal = null;
      worldBowl.tween = null;
      worldBowl.dirty = true;
    },
    { passive: false }
  );
  cv.addEventListener('keydown', e => {
    if (!worldBowl.on) return;
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
    worldBowl.tween = null;
    worldBowl.goal = next;
    worldBowl.dirty = true;
  });
}
/* a tap: the nearest pin under the finger (its whole height counts), else the place nearest the ground tapped */
export function worldBowlPick(e) {
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

/* ---------- coming from a walk scene: the walk camera rises, then the bowl pulls back from right above you ---------- */
/* returns true when it takes the switch over (the Map tab opens a moment later) */
export function worldMapOpenFromWalk() {
  if (
    uiState.tab !== 'walk' ||
    reducedMotion ||
    worldBowl.opening ||
    !worldMapWanted() ||
    typeof walkRenderer === 'undefined' ||
    !walkRenderer.on
  )
    return false;
  worldBowl.opening = true;
  /* the walk camera's zoom, put back when you come back to the walk scene */
  worldBowl.walkZoom = walkRenderer.zoomT;
  walkRenderer.zoomT = clampZoom(walkRenderer.zoom * 3);
  worldMapFade(true);
  setTimeout(() => {
    worldBowl.opening = false;
    if (uiState.tab !== 'walk') return worldMapFade(false);
    uiState.mglFrom = 'walk';
    uiState.tab = 'map';
    uiState.mapSel = null;
    render();
    scrollTo(0, 0);
  }, 380);
  return true;
}
/* back in the walk scene: the walk camera's zoom as it was before the map, eased in from far out (the zoom out in
   reverse); without the zoom out it is just put back */
function worldMapBackToWalk() {
  const z = worldBowl.walkZoom;
  if (z == null || typeof walkRenderer === 'undefined' || uiState.tab !== 'walk') return;
  worldBowl.walkZoom = null;
  if (!reducedMotion) walkRenderer.zoom = clampZoom(z * 3);
  walkRenderer.zoomT = z;
}
/* a veil in the haze's colour over the switch, so the walk scene's last frame never cuts to the map */
function worldMapFade(on) {
  let f = $('#mapfade');
  if (on) {
    if (!f) {
      f = document.createElement('div');
      f.id = 'mapfade';
      f.style.cssText =
        'position:fixed;inset:0;z-index:5;pointer-events:none;background:rgb(176,186,236);opacity:0;transition:opacity .32s ease-in';
      document.body.appendChild(f);
    }
    requestAnimationFrame(() => (f.style.opacity = '.85'));
  } else if (f) {
    f.style.transition = 'opacity .35s ease-out';
    f.style.opacity = '0';
    setTimeout(() => f.remove(), 400);
  }
}

/* ---------- the map's buttons and the Places list ---------- */
function worldMapChrome() {
  const box = $('.map-full');
  if (!box) return;
  const ctl = box.querySelector('.mapctl');
  if (ctl && !ctl.querySelector('[data-a=mlist]'))
    ctl.insertAdjacentHTML(
      'beforeend',
      `<button class="mbtn" data-a="mlist" aria-label="Places" title="Places">${uiIconHTML('list', 16)}</button>`
    );
  if (worldMap.gl && !box.querySelector('.mapbowl')) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="mapview mapbowl glass" role="group" aria-label="Look around"><button class="mbtn sm" data-k="left" aria-label="Turn left" title="Turn left">⟲</button><button class="mbtn sm" data-k="all" aria-label="See the whole bowl" title="The whole bowl">◎</button><button class="mbtn sm" data-k="right" aria-label="Turn right" title="Turn right">⟳</button></div>`
    );
    box.querySelector('.mapbowl').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !worldBowl.on) return;
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.tween = null;
      worldBowl.goal =
        b.dataset.k === 'all' ? bowlCamOverview(c.yaw) : bowlCamTurn(c, b.dataset.k === 'left' ? -0.6 : 0.6, 0);
      worldBowl.dirty = true;
    });
  }
  let pl = box.querySelector('.mplaces');
  if (worldMap.list) {
    if (!pl) {
      box.insertAdjacentHTML('beforeend', '<div class="mplaces glass" role="dialog" aria-label="Places"></div>');
      pl = box.querySelector('.mplaces');
    }
    pl.innerHTML = worldMapLocationListHTML();
  } else if (pl) pl.remove();
}
function worldMapPinState(i) {
  const n = LOCATIONS[i],
    dest = saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null,
    locked = !canEnter(i);
  return {
    ico: i === saveData.trip.node ? 'walk' : locked ? 'lock' : i === dest ? 'flag' : n.town ? 'house' : 'leaf',
    cls:
      (i === saveData.trip.node ? ' here' : '') +
      (uiState.mapSel === i ? ' sel' : '') +
      (i === dest ? ' dest' : '') +
      (!saveData.visited[i] && !locked ? ' new' : '') +
      (locked ? ' locked' : '') +
      (n.town ? ' town' : ''),
  };
}
function worldMapLocationListHTML() {
  const rows = LOCATIONS.map((n, i) => {
    const st = worldMapPinState(i),
      t = i === saveData.trip.node ? null : tripTo(i),
      locked = st.cls.includes('locked');
    const sub =
      i === saveData.trip.node
        ? 'You are here'
        : locked
          ? 'Locked'
          : t
            ? `${distanceText(t.metres)}${saveData.visited[i] ? '' : ' · new'}`
            : 'No road yet';
    return {
      i,
      n,
      st,
      sub,
      g: i === saveData.trip.node ? 0 : locked ? 3 : saveData.visited[i] ? 1 : 2,
      metres: t ? t.metres : 1e9,
    };
  });
  rows.sort((a, b) => a.g - b.g || a.metres - b.metres);
  const G = ['Here', 'Visited', 'Not visited yet', 'Locked'];
  let h = `<div class="mpl-head"><b>Places</b>${worldMap.gl ? '<button class="mbtn sm" data-a="mlist" aria-label="Close">×</button>' : ''}</div><div class="mpl-body">`,
    g = -1;
  for (const r of rows) {
    if (r.g !== g) {
      g = r.g;
      h += `<div class="mpl-g">${G[g]}</div>`;
    }
    h += `<button class="mpl-row${r.st.cls}" data-a="msel" data-n="${r.i}"><span class="mp-i">${uiIconHTML(r.st.ico, 14)}</span><span class="mpl-n">${escapeHtml(r.n.name)}<small>${escapeHtml(locationSubtitle(r.n))}</small></span><span class="mpl-s">${escapeHtml(r.sub)}</span></button>`;
  }
  return h + '</div>';
}
/* the map's own buttons (ui.js asks before its own actions) */
export function worldMapAction(a) {
  if (a === 'mlist') {
    worldMap.list = !worldMap.list || !worldMap.gl;
    worldMapChrome();
    return true;
  }
  if (a === 'msel' && worldMap.list && worldMap.gl && innerWidth < 850) {
    worldMap.list = false;
    setTimeout(worldMapChrome, 0);
  }
  return false;
}
