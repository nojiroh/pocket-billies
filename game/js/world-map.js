'use strict';
/* ================= WORLD MAP: the inside of a sphere, raycast in pixels; surface texture from art/map/world.png =================
   Fills the screen. The trails painted on the texture follow the links between stops (the walking network).
   Tap a place to see it; travel there, stay, stop or turn back from the card. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { flyDraw, flyTick, paintMapCard, provide, toast } from './hooks.js';
import { $, clamp } from './util.js';
import { LOCATIONS, REGIONS, ROADS, roadCost } from './game-data.js';
import { canEnter, escapeHtml, nextTripNode, reducedMotion, saveData, uiState } from './game-state.js';
import { frameCount, frameStop, frameTask, userFps } from './frame-scheduler.js';
import { artPixels, bayerThreshold, makeSeededRandom, mixRgb, packPixel, worldMapStamp } from './art.js';
import { owFrames } from './person-art.js';
import { EASE } from './battle-stage.js';
/* eslint-disable no-func-assign */
expose({
  LANDMARK_REGIONS: [() => LANDMARK_REGIONS],
  LOCATION_VECTORS: [() => LOCATION_VECTORS],
  RADIANS_PER_DEGREE: [() => RADIANS_PER_DEGREE],
  REGION_VECTORS: [() => REGION_VECTORS],
  ROAD_CURVES: [() => ROAD_CURVES],
  WORLD_ART: [() => WORLD_ART],
  WORLD_MAP_CLOUDS: [() => WORLD_MAP_CLOUDS],
  WORLD_MAP_LANDMARKS: [() => WORLD_MAP_LANDMARKS],
  WORLD_MAP_TEXTURE_HEIGHT: [() => WORLD_MAP_TEXTURE_HEIGHT],
  WORLD_MAP_TEXTURE_WIDTH: [() => WORLD_MAP_TEXTURE_WIDTH],
  isBehindSun: [() => isBehindSun, v => (isBehindSun = v)],
  lonLatToUnitVector: [() => lonLatToUnitVector],
  onStepsAdded: [() => onStepsAdded, v => ((onStepsAdded = v), provide({ onStepsAdded }))],
  roadPosition: [() => roadPosition, v => (roadPosition = v)],
  setWorldMapFit: [() => setWorldMapFit, v => (setWorldMapFit = v)],
  setWorldMapHeight: [() => setWorldMapHeight, v => (setWorldMapHeight = v)],
  setWorldMapLabels: [() => setWorldMapLabels, v => (setWorldMapLabels = v)],
  setWorldMapMount: [() => setWorldMapMount, v => (setWorldMapMount = v)],
  setWorldMapReset: [() => setWorldMapReset, v => (setWorldMapReset = v)],
  setWorldMapWidth: [() => setWorldMapWidth, v => (setWorldMapWidth = v)],
  setWorldMapZoom: [() => setWorldMapZoom, v => (setWorldMapZoom = v)],
  slerp: [() => slerp, v => (slerp = v)],
  vector3: [() => vector3],
  worldMap: [() => worldMap],
  worldMapCamera: [() => worldMapCamera, v => (worldMapCamera = v)],
  worldMapFit: [() => worldMapFit, v => setWorldMapFit(v)],
  worldMapFocus: [() => worldMapFocus, v => (worldMapFocus = v)],
  worldMapHeight: [() => worldMapHeight, v => setWorldMapHeight(v)],
  worldMapLabels: [() => worldMapLabels, v => setWorldMapLabels(v)],
  worldMapLoop: [() => worldMapLoop, v => (worldMapLoop = v)],
  worldMapMount: [() => worldMapMount, v => setWorldMapMount(v)],
  worldMapPick: [() => worldMapPick, v => (worldMapPick = v)],
  worldMapPixelRing: [() => worldMapPixelRing, v => (worldMapPixelRing = v)],
  worldMapPixels: [() => worldMapPixels, v => (worldMapPixels = v)],
  worldMapPlayerPosition: [() => worldMapPlayerPosition, v => (worldMapPlayerPosition = v)],
  worldMapPrepare: [() => worldMapPrepare, v => (worldMapPrepare = v)],
  worldMapProject: [() => worldMapProject, v => (worldMapProject = v)],
  worldMapRender: [() => worldMapRender, v => (worldMapRender = v)],
  worldMapReset: [() => worldMapReset, v => setWorldMapReset(v)],
  worldMapSelect: [() => worldMapSelect, v => (worldMapSelect = v)],
  worldMapSize: [() => worldMapSize, v => (worldMapSize = v)],
  worldMapWalk: [() => worldMapWalk, v => (worldMapWalk = v)],
  worldMapWidth: [() => worldMapWidth, v => setWorldMapWidth(v)],
  worldMapZoom: [() => worldMapZoom, v => setWorldMapZoom(v)],
});
/* eslint-enable no-func-assign */
provide({ onStepsAdded });
/* to-module: end */
export let worldMapWidth = 176,
  worldMapHeight = 232;
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapHeight(v) {
  worldMapHeight = v;
  provide({ worldMapHeight });
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapWidth(v) {
  worldMapWidth = v;
  provide({ worldMapWidth });
}
export const WORLD_MAP_TEXTURE_WIDTH = 1536,
  WORLD_MAP_TEXTURE_HEIGHT = 768,
  RADIANS_PER_DEGREE = Math.PI / 180;
const lonLatToUnitVector = (lon, lat) => {
  lon *= RADIANS_PER_DEGREE;
  lat *= RADIANS_PER_DEGREE;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
};
export const vector3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
export function slerp(a, b, t) {
  const d = clamp(vector3.dot(a, b), -1, 1),
    w = Math.acos(d);
  if (w < 1e-5) return a;
  const s = Math.sin(w);
  return vector3.add(vector3.mul(a, Math.sin((1 - t) * w) / s), vector3.mul(b, Math.sin(t * w) / s));
}
export const LOCATION_VECTORS = LOCATIONS.map(r => lonLatToUnitVector(r.lon || 0, r.lat || 0));
export const REGION_VECTORS = REGIONS.map(f =>
  f.t === 'sun' || f.lon == null ? [0, 0, 0] : lonLatToUnitVector(f.lon, f.lat || 0)
);
const LANDMARK_REGIONS = LOCATIONS.map((r, i) => ({ t: r.t, v: LOCATION_VECTORS[i], r: r.town ? 4.6 : 5.6 })).concat(
  REGIONS.map((f, i) => ({ f, i }))
    .filter(o => o.f.t !== 'sun' && o.f.lon != null)
    .map(({ f, i }) => ({ t: f.t, v: REGION_VECTORS[i], r: f.t === 'trench' ? 9 : 6.5 }))
);
/* each link as points on the sphere, curved exactly like the painted trail */
const ROAD_CURVES = ROADS.map(([a, b], i) => {
  const A = LOCATION_VECTORS[a],
    Bv = LOCATION_VECTORS[b],
    nrm = vector3.norm(vector3.cross(A, Bv)),
    pts = [];
  let len = 0,
    prev = null;
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    let p = slerp(A, Bv, t);
    p = vector3.norm(vector3.add(p, vector3.mul(nrm, Math.sin(t * Math.PI) * 0.035 * (i % 2 ? 1 : -1))));
    if (prev) len += vector3.len(vector3.sub(p, prev));
    pts.push({ p, l: len });
    prev = p;
  }
  return { a, b, pts, len };
});
export function roadPosition(a, b, f) {
  const i = ROADS.findIndex(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
  if (i < 0) return LOCATION_VECTORS[a];
  const s = ROAD_CURVES[i],
    g = (s.a === a ? f : 1 - f) * s.len;
  let k = 1;
  while (k < s.pts.length - 1 && s.pts[k].l < g) k++;
  const p0 = s.pts[k - 1],
    p1 = s.pts[k],
    u = (g - p0.l) / (p1.l - p0.l || 1);
  return vector3.norm(vector3.add(vector3.mul(p0.p, 1 - u), vector3.mul(p1.p, u)));
}
export function worldMapPlayerPosition() {
  const r = saveData.route,
    nx = nextTripNode();
  if (nx == null || !r.prog) return LOCATION_VECTORS[r.node];
  return roadPosition(r.node, nx, clamp(r.prog / roadCost(r.node, nx), 0, 1));
}
/* the inner surface of the world, read from art/map/world.png */
export const WORLD_ART = 'map/world.png';
provide({ WORLD_ART }); /* to-module */
let worldMapPixels = null;
export function worldMapPrepare() {
  return worldMapPixels
    ? Promise.resolve(worldMapPixels)
    : artPixels(WORLD_ART).then(t => {
        worldMapPixels = t;
        worldMap.dirty = true;
        return t;
      });
}
/* clouds floating inside the sphere */
export const WORLD_MAP_CLOUDS = [];
(function () {
  const R = makeSeededRandom(812);
  for (let i = 0; i < 16; i++) {
    const lon = R() * 200 - 20,
      lat = (R() - 0.5) * 50,
      v = lonLatToUnitVector(lon, lat),
      alt = 0.86 + R() * 0.06;
    WORLD_MAP_CLOUDS.push({ c: vector3.mul(v, alt), r: 0.022 + R() * 0.028, lon, lat, alt, sp: 0.4 + R() * 0.6 });
  }
})();
/* landmark billboards standing on the surface (stamps live in the icon atlas as map_*) */
export const WORLD_MAP_LANDMARKS = [];
(function () {
  const KIND = {
    city: ['tower', 'house', 'tower', 'house', 'mall', 'tree', 'house'],
    town: ['house', 'house', 'tree'],
    grass: ['tree', 'tree', 'bush'],
    golf: ['flag', 'tree', 'bush'],
    thicket: ['bush', 'bush', 'tree'],
    grotto: ['derrick', 'derrick', 'house'],
    canyon: ['mesa', 'cactus', 'mesa'],
    bins: ['bin', 'bin', 'house'],
    food: ['umb', 'umb', 'house'],
    mall: ['mall'],
    feedl: ['tree', 'bush'],
    silicon: ['crystal', 'crystal'],
    spore: ['mush', 'mush', 'mush'],
    trench: [],
    vault: ['vault', 'vault'],
    spire: ['tower', 'tower', 'tower'],
    pond: ['tree', 'bush', 'tree'],
    farm: ['house', 'tree', 'tree'],
    ridge: ['mesa', 'cactus'],
    island: ['tree', 'tree'],
    volcano: ['mesa'],
    pass: ['tree', 'tree'],
    summit: ['tree', 'house'],
    sea: [],
    lake: ['tree', 'bush'],
  };
  LANDMARK_REGIONS.forEach((r, ri) => {
    if (ri < LOCATIONS.length && LOCATIONS[ri].scene) return;
    /* v24: stops have miniatures (world-map-gl.js) */ const L = KIND[r.t] || [],
      R = makeSeededRandom(ri * 131 + 9),
      n = r.t === 'mall' ? 1 : L.length ? 7 : 0;
    for (let k = 0; k < n; k++) {
      const sp = r.r * RADIANS_PER_DEGREE * 0.6,
        off = r.t === 'mall' ? [0, 0, 0] : [(R() - 0.5) * sp * 2, (R() - 0.5) * sp * 2, (R() - 0.5) * sp * 2];
      WORLD_MAP_LANDMARKS.push({ v: vector3.norm(vector3.add(r.v, off)), k: L[k % L.length] });
    }
  });
})();
/* ---------- state & camera ---------- */
export const worldMap = {
  on: false,
  cv: null,
  ctx: null,
  s: 1,
  anim: null,
  face: 'down',
  moving: false,
  last: 0,
  yaw: 0,
  pitch: 0,
  look: 0.16,
  alt: 0.32,
  drag: null,
  dirty: true,
  img: null,
  proj: [],
  lastDraw: 0,
  me: null,
  focus: null,
  fT: null,
};
function worldMapSize() {
  const cr = worldMap.cv && worldMap.cv.isConnected ? worldMap.cv.getBoundingClientRect() : null,
    w = cr && cr.width > 20 ? cr.width : innerWidth,
    h = cr && cr.height > 20 ? cr.height : innerHeight,
    H0 = clamp(Math.round(h / 3.4), 180, 300),
    W0 = clamp(Math.round((H0 * w) / h), 120, 640),
    kk = Math.min(1, Math.sqrt(70000 / (W0 * H0))),
    H = Math.round(H0 * kk),
    W = Math.round(W0 * kk);
  if (W !== worldMapWidth || H !== worldMapHeight) {
    worldMapWidth = W;
    worldMapHeight = H;
    worldMap.img = null;
    if (worldMap.cv) {
      worldMap.cv.width = worldMapWidth;
      worldMap.cv.height = worldMapHeight;
    }
  }
  worldMap.s = w / worldMapWidth;
  worldMap.dirty = true;
}
export function worldMapFit() {
  if (!worldMap.cv || !worldMap.cv.isConnected) return;
  worldMapSize();
  worldMapLabels();
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapFit(v) {
  worldMapFit = v; // eslint-disable-line no-func-assign
  provide({ worldMapFit });
}
export function worldMapCamera() {
  const P = worldMap.focus || worldMapPlayerPosition(),
    U = vector3.mul(P, -1),
    east = vector3.norm(vector3.cross(P, [0, 1, 0]));
  let F = vector3.norm(vector3.sub(east, vector3.mul(U, vector3.dot(east, U))));
  const R0 = vector3.norm(vector3.cross(F, U)),
    cy = Math.cos(worldMap.yaw),
    sy = Math.sin(worldMap.yaw),
    Fa = vector3.norm(vector3.add(vector3.mul(F, cy), vector3.mul(R0, sy)));
  /* v31: worldMap.tilt is the camera's angle above the ground (default about 33 degrees, as before) */
  const alt = worldMap.alt,
    th = worldMap.tilt ?? 0.5733,
    dk = alt * 1.8385,
    C = vector3.add(vector3.add(P, vector3.mul(U, dk * Math.sin(th))), vector3.mul(Fa, -dk * Math.cos(th))),
    dp = vector3.norm(vector3.sub(P, C)),
    ds = vector3.norm(vector3.mul(C, -1)),
    w = clamp(
      (worldMapWidth < worldMapHeight ? worldMap.look * 0.2 : worldMap.look) * Math.min(1, worldMap.alt / 0.3) +
        worldMap.pitch,
      -0.3,
      1
    );
  const fw = vector3.norm(vector3.add(vector3.mul(dp, 1 - w), vector3.mul(ds, w))),
    rt = vector3.norm(vector3.cross(fw, U)),
    up = vector3.cross(rt, fw);
  return { C, fw, rt, up, P, foc: Math.min(worldMapWidth * 0.62, worldMapHeight * 0.47) };
}
export function worldMapProject(cam, p) {
  const d = vector3.sub(p, cam.C),
    z = vector3.dot(d, cam.fw);
  if (z < 0.004) return null;
  return {
    x: worldMapWidth / 2 + (cam.foc * vector3.dot(d, cam.rt)) / z,
    y: worldMapHeight / 2 - (cam.foc * vector3.dot(d, cam.up)) / z,
    z,
  };
}
function worldMapRender(t, lo) {
  const c = worldMap.ctx;
  if (!worldMapPixels) return;
  if (!worldMap.img || worldMap.img.width !== worldMapWidth || worldMap.img.height !== worldMapHeight)
    worldMap.img = c.createImageData(worldMapWidth, worldMapHeight);
  const buf = new Uint32Array(worldMap.img.data.buffer),
    T = worldMapPixels,
    cam = worldMapCamera(),
    C = cam.C,
    cc = vector3.dot(C, C);
  worldMap.cam = cam;
  const haze = [176, 186, 236],
    RS = 0.075,
    st = lo ? 2 : 1;
  const cl = [];
  WORLD_MAP_CLOUDS.forEach(k => {
    const a = (k.lon + (t / 1000) * k.sp) * RADIANS_PER_DEGREE,
      la = k.lat * RADIANS_PER_DEGREE,
      cv = [Math.cos(la) * Math.cos(a) * k.alt, Math.sin(la) * k.alt, Math.cos(la) * Math.sin(a) * k.alt],
      n = vector3.norm(cv),
      q = worldMapProject(cam, cv),
      qs = worldMapProject(cam, n);
    const o = { c: cv, r: k.r, n, b: null, sb: null };
    if (q) {
      const R = (k.r * cam.foc) / q.z + 2;
      o.b = [q.x - R, q.x + R, q.y - R, q.y + R];
    }
    if (qs) {
      const R = (k.r * 1.3 * cam.foc) / qs.z + 2;
      o.sb = [qs.x - R, qs.x + R, qs.y - R, qs.y + R];
    }
    if (o.b || o.sb) cl.push(o);
  });
  const sq = worldMapProject(cam, [0, 0, 0]),
    sR = sq ? (0.42 * cam.foc) / sq.z + 4 : 0;
  for (let j = 0; j < worldMapHeight; j += st) {
    const rowC = cl.filter(k => k.b && j >= k.b[2] && j <= k.b[3]),
      rowS = cl.filter(k => k.sb && j >= k.sb[2] && j <= k.sb[3]),
      nearSun = sq && Math.abs(j - sq.y) < sR;
    for (let i = 0; i < worldMapWidth; i += st) {
      const dx = (i + 0.5 - worldMapWidth / 2) / cam.foc,
        dy = (worldMapHeight / 2 - j - 0.5) / cam.foc,
        d = vector3.norm([
          cam.fw[0] + cam.rt[0] * dx + cam.up[0] * dy,
          cam.fw[1] + cam.rt[1] * dx + cam.up[1] * dy,
          cam.fw[2] + cam.rt[2] * dx + cam.up[2] * dy,
        ]);
      const b = vector3.dot(C, d),
        ts = -b + Math.sqrt(b * b - cc + 1);
      let col,
        tHit = ts;
      let sunHit = false;
      if (nearSun) {
        const disc = b * b - cc + RS * RS;
        if (disc > 0) {
          const t0 = -b - Math.sqrt(disc);
          if (t0 > 0 && t0 < ts) {
            sunHit = true;
            tHit = t0;
          }
        }
      }
      let cloud = null;
      for (const k of rowC) {
        if (i < k.b[0] || i > k.b[1]) continue;
        const oc = vector3.sub(C, k.c),
          bb = vector3.dot(oc, d),
          q = bb * bb - (vector3.dot(oc, oc) - k.r * k.r);
        if (q > 0) {
          const t0 = -bb - Math.sqrt(q);
          if (t0 > 0 && t0 < tHit) {
            tHit = t0;
            cloud = k;
          }
        }
      }
      if (sunHit && !cloud) {
        const p = vector3.add(C, vector3.mul(d, tHit)),
          nz = Math.max(0, -vector3.dot(vector3.norm(p), d));
        col = mixRgb([255, 196, 90], [255, 252, 232], Math.pow(nz, 0.6));
        if (nz > 0.55 && (i + j) & 1 && nz < 0.62) col = [255, 236, 170];
      } else if (cloud) {
        const p = vector3.add(C, vector3.mul(d, tHit)),
          n = vector3.norm(vector3.sub(p, cloud.c)),
          lit = -vector3.dot(n, cloud.n);
        col = mixRgb(
          [196, 186, 232],
          [255, 255, 255],
          clamp(0.55 + lit * 0.6 + (bayerThreshold(i, j) - 0.5) * 0.25, 0, 1)
        );
      } else {
        const p = vector3.add(C, vector3.mul(d, ts)),
          lat = Math.asin(clamp(p[1], -1, 1)),
          lon = Math.atan2(p[2], p[0]);
        let u = Math.floor(((lon / (Math.PI * 2) + 1) % 1) * WORLD_MAP_TEXTURE_WIDTH),
          v = Math.floor((0.5 - lat / Math.PI) * WORLD_MAP_TEXTURE_HEIGHT);
        if (u >= WORLD_MAP_TEXTURE_WIDTH) u = WORLD_MAP_TEXTURE_WIDTH - 1;
        v = clamp(v, 0, WORLD_MAP_TEXTURE_HEIGHT - 1);
        const px = T[v * WORLD_MAP_TEXTURE_WIDTH + u];
        col = [px & 255, (px >> 8) & 255, (px >> 16) & 255];
        for (const k of rowS) {
          if (i < k.sb[0] || i > k.sb[1]) continue;
          const cd = vector3.dot(k.c, p);
          if (cd > 0) {
            const perp = vector3.len(vector3.sub(k.c, vector3.mul(p, cd)));
            if (perp < k.r * 1.25) {
              const e = perp / (k.r * 1.25);
              if (e < 0.7 || bayerThreshold(i, j) < (1 - e) * 3.3) {
                col = mixRgb(col, [36, 26, 76], 0.42);
              }
              break;
            }
          }
        }
        const fogk = 1 - Math.exp(-Math.max(0, ts - 0.3) * 0.72);
        col = mixRgb(col, haze, clamp(fogk + (bayerThreshold(i, j) - 0.5) * 0.06, 0, 0.86));
      }
      if ((!sunHit || cloud) && sq && b < 0) {
        const dist = Math.sqrt(Math.max(0, cc - b * b)),
          g = clamp(1 - dist / 0.42, 0, 1);
        if (g > 0) col = mixRgb(col, [255, 236, 180], g * g * 0.85);
      }
      const pc = packPixel(col[0], col[1], col[2]);
      buf[j * worldMapWidth + i] = pc;
      if (st > 1) {
        if (i + 1 < worldMapWidth) buf[j * worldMapWidth + i + 1] = pc;
        if (j + 1 < worldMapHeight) {
          buf[(j + 1) * worldMapWidth + i] = pc;
          if (i + 1 < worldMapWidth) buf[(j + 1) * worldMapWidth + i + 1] = pc;
        }
      }
    }
  }
  c.putImageData(worldMap.img, 0, 0);
  /* the planned trip, drawn over the painted trail */
  const plan = [saveData.route.node, ...saveData.route.plan];
  if (plan.length > 1) {
    c.fillStyle = saveData.route.hold ? 'rgba(255,255,255,.75)' : '#FFE27A';
    for (let k = 0; k < plan.length - 1; k++) {
      const a = plan[k],
        b = plan[k + 1];
      for (let f = 0; f <= 1; f += 0.04) {
        if (k === 0 && f < saveData.route.prog / roadCost(a, b)) continue;
        if (Math.floor(f * 25 + t / 120) % 3 === 0) continue;
        const q = worldMapProject(cam, roadPosition(a, b, f));
        if (q && q.z < 1.4) c.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
    }
  }
  /* markers, landmarks, player */
  const L = [];
  LOCATIONS.forEach((n, i) => {
    const q = worldMapProject(cam, LOCATION_VECTORS[i]);
    if (q) L.push({ q, i, kind: 'r' });
  });
  REGIONS.forEach((f, i) => {
    if (f.t === 'sun') {
      const q = worldMapProject(cam, [0, 0, 0]);
      if (q) L.push({ q, i, kind: 'sun' });
      return;
    }
    const q = worldMapProject(cam, REGION_VECTORS[i]);
    if (q) L.push({ q, i, kind: 'f' });
  });
  worldMap.proj = L;
  L.sort((a, b) => b.q.z - a.q.z);
  const dest = saveData.route.plan.length ? saveData.route.plan[saveData.route.plan.length - 1] : null;
  L.forEach(({ q, i, kind }) => {
    if (kind === 'sun') return;
    const occ = isBehindSun(cam, kind === 'r' ? LOCATION_VECTORS[i] : REGION_VECTORS[i]);
    if (occ) return;
    const s = clamp(0.16 / q.z, 0.6, 2.4);
    if (kind === 'r') {
      const n = LOCATIONS[i],
        reached = !!saveData.visited[i],
        locked = !canEnter(i),
        col =
          i === saveData.route.node
            ? '#F4C542'
            : i === dest
              ? '#FFE27A'
              : reached
                ? '#FFFFFF'
                : locked
                  ? '#7E8890'
                  : '#E8D8B0',
        x = Math.round(q.x),
        y = Math.round(q.y),
        r = Math.max(1, Math.round(1.6 * s));
      c.fillStyle = 'rgba(20,10,40,.35)';
      c.fillRect(x - r - 1, y, (r + 1) * 2 + 1, Math.max(1, r));
      c.fillStyle = '#1A1430';
      c.fillRect(x - r - 1, y - r - 1 - r * 2, (r + 1) * 2 + 1, (r + 1) * 2 + 1);
      c.fillStyle = col;
      c.fillRect(x - r, y - r - r * 2, r * 2 + 1, r * 2 + 1);
      c.fillStyle = '#1A1430';
      c.fillRect(x, y - r * 2 + r, 1, r * 2);
      if (n.board || n.shop) {
        c.fillStyle = n.board ? (saveData.flags[n.board] ? '#F4C542' : '#D9434B') : '#5DD6A0';
        c.fillRect(x + r + 1, y - r * 4 - 2, Math.max(2, r + 1), Math.max(2, r));
      }
      if (uiState.mapSel === i || i === dest) {
        const rr = Math.round(5 * s + Math.sin(t / 200) * 1.5);
        worldMapPixelRing(c, x, y - r * 2, rr, i === dest && uiState.mapSel !== i ? '#FFE27A' : '#FFFFFF');
      }
    } else {
      const x = Math.round(q.x),
        y = Math.round(q.y);
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillRect(x - 1, y - 1, 3, 3);
      c.fillStyle = '#5A5080';
      c.fillRect(x, y, 1, 1);
      if (uiState.mapSel === 'f' + i)
        worldMapPixelRing(c, x, y, Math.round(5 * s + Math.sin(t / 200) * 1.5), '#FFFFFF');
    }
  });
  const sq2 = worldMapProject(cam, [0, 0, 0]);
  const sunI = REGIONS.findIndex(f => f.t === 'sun');
  if (sq2 && sunI >= 0 && uiState.mapSel === 'f' + sunI)
    worldMapPixelRing(c, Math.round(sq2.x), Math.round(sq2.y), Math.round(12 + Math.sin(t / 200) * 2), '#FFFFFF');
  const LS = [];
  WORLD_MAP_LANDMARKS.forEach(l => {
    const q = worldMapProject(cam, l.v);
    if (
      q &&
      q.z < 1.25 &&
      q.x > -20 &&
      q.x < worldMapWidth + 20 &&
      q.y > -20 &&
      q.y < worldMapHeight + 20 &&
      !isBehindSun(cam, l.v)
    )
      LS.push([q, l]);
  });
  LS.sort((a, b) => b[0].z - a[0].z);
  LS.forEach(([q, l]) => {
    const im = worldMapStamp(l.k),
      sc = clamp(Math.round((0.09 / q.z) * 2) / 2, 0.5, 3),
      w = im.width * sc,
      h = im.height * sc,
      fog = clamp((q.z - 0.3) * 0.9, 0, 0.7);
    c.globalAlpha = 1 - fog;
    c.drawImage(
      im,
      Math.round(q.x - w / 2),
      Math.round(q.y - h),
      Math.max(1, Math.round(w)),
      Math.max(1, Math.round(h))
    );
    c.globalAlpha = 1;
  });
  const pq = worldMapProject(cam, worldMap.me || worldMapPlayerPosition());
  if (pq && worldMap.fly && typeof flyDraw === 'function') flyDraw(c, t, v => worldMapProject(cam, v));
  else if (pq) {
    const fr = owFrames('me'),
      set = fr[worldMap.face] || fr.down,
      f = worldMap.moving ? set[1 + (Math.floor(t / 140) % 2)] : set[0],
      bob = worldMap.moving ? 0 : Math.floor(t / 600) % 2;
    c.fillStyle = 'rgba(20,10,40,.35)';
    c.fillRect(Math.round(pq.x) - 5, Math.round(pq.y), 10, 2);
    c.drawImage(
      f,
      Math.round(pq.x - (f.ax || 12) * 0.24),
      Math.round(pq.y - (f.ay || 30) * 0.24 + bob),
      Math.round(f.width * 0.24),
      Math.round(f.height * 0.24)
    );
  }
}
export function isBehindSun(cam, p) {
  const d = vector3.sub(p, cam.C),
    L = vector3.len(d),
    u = vector3.mul(d, 1 / L),
    b = vector3.dot(cam.C, u),
    q = b * b - (vector3.dot(cam.C, cam.C) - 0.075 * 0.075);
  if (q <= 0) return false;
  const t0 = -b - Math.sqrt(q);
  return t0 > 0 && t0 < L;
}
function worldMapPixelRing(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let a = 0; a < 360; a += Math.max(4, 60 / r)) {
    const rad = (a * Math.PI) / 180;
    c.fillRect(Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), 1, 1);
  }
}
export function worldMapMount() {
  const cv = $('#mapcv');
  if (!cv) return;
  if (!worldMapPixels) {
    document.body.classList.add('map-loading');
    worldMapPrepare()
      .then(() => document.body.classList.remove('map-loading'))
      .catch(e => {
        console.error(e);
        toast(e.message);
      });
  }
  worldMap.cv = cv;
  worldMap.ctx = cv.getContext('2d');
  worldMap.img = null;
  worldMapSize();
  cv.width = worldMapWidth;
  cv.height = worldMapHeight;
  worldMap.dirty = true;
  const to = worldMapPlayerPosition();
  if (!worldMap.me) worldMap.me = to;
  else if (vector3.dot(worldMap.me, to) < 0.999999) worldMapWalk(worldMap.me, to);
  if (!worldMap.focus) worldMap.focus = to;
  if (!cv._bound) {
    cv._bound = 1;
    cv.addEventListener('pointerdown', e => {
      worldMap.drag = {
        x: e.clientX,
        y: e.clientY,
        yaw: worldMap.yaw,
        pitch: worldMap.pitch,
        moved: 0,
        id: e.pointerId,
      };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const D = worldMap.drag;
      if (!D) return;
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) D.moved = 1;
      worldMap.yaw = D.yaw - dx * 0.006;
      worldMap.pitch = clamp(D.pitch + dy * 0.0025, -0.44, 0.5);
    });
    cv.addEventListener('pointerup', e => {
      const D = worldMap.drag;
      worldMap.drag = null;
      worldMap.dirty = true;
      if (D && !D.moved) worldMapPick(e);
    });
    cv.addEventListener('pointercancel', () => {
      worldMap.drag = null;
    });
    cv.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        worldMap.alt = clamp(worldMap.alt * (e.deltaY > 0 ? 1.12 : 0.89), 0.08, 0.7);
        worldMap.dirty = true;
      },
      { passive: false }
    );
  }
  if (!worldMap.on) {
    worldMap.on = true;
    worldMap.last = performance.now();
    frameTask('map', worldMapLoop);
  }
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapMount(v) {
  worldMapMount = v; // eslint-disable-line no-func-assign
  provide({ worldMapMount });
}
export function worldMapZoom(k) {
  worldMap.alt = clamp(worldMap.alt * k, 0.08, 0.7);
  worldMap.dirty = true;
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapZoom(v) {
  worldMapZoom = v; // eslint-disable-line no-func-assign
  provide({ worldMapZoom });
}
export function worldMapReset() {
  worldMap.yaw = 0;
  worldMap.pitch = 0;
  worldMap.alt = 0.32;
  worldMapFocus(worldMapPlayerPosition());
  uiState.mapSel = null;
  paintMapCard();
  worldMap.dirty = true;
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapReset(v) {
  worldMapReset = v; // eslint-disable-line no-func-assign
  provide({ worldMapReset });
}
function worldMapFocus(v) {
  worldMap.fT = { from: worldMap.focus || v, to: v, t0: performance.now(), dur: reducedMotion ? 1 : 700 };
}
export function worldMapWalk(from, to) {
  worldMap.anim = {
    from,
    to,
    t0: performance.now(),
    dur: reducedMotion ? 1 : clamp(Math.acos(clamp(vector3.dot(from, to), -1, 1)) * 9000, 600, 3200),
  };
}
function onStepsAdded() {
  if (uiState.tab !== 'map' || !worldMap.cv || !worldMap.cv.isConnected || worldMap.fly) return;
  const to = worldMapPlayerPosition();
  if (worldMap.me && vector3.dot(worldMap.me, to) < 0.999999) {
    worldMapWalk(worldMap.me, to);
    if (uiState.mapSel == null) worldMapFocus(to);
  }
  paintMapCard();
}
function worldMapLoop(ts) {
  if (!worldMap.cv || !worldMap.cv.isConnected) {
    worldMap.on = false;
    frameStop('map');
    return;
  }
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
  } else if (uiState.mapSel == null && worldMap.me) worldMap.focus = worldMap.me;
  const busy = !!(worldMap.drag || moving || panning || worldMap.zt);
  if (ts - worldMap.lastDraw < (busy ? 1000 / userFps() - 2 : 400) && !worldMap.dirty) return;
  worldMap.lastDraw = ts;
  worldMap.dirty = false;
  const w0 = performance.now();
  worldMapRender(ts, busy);
  frameCount(performance.now() - w0);
  worldMapLabels();
  if (busy && !worldMap.drag && !moving) worldMap.zt = 0;
  if (worldMap.wasBusy && !busy) worldMap.dirty = true;
  worldMap.wasBusy = busy;
}
export function worldMapLabels() {
  const L = $('#maplabels');
  if (!L || !worldMap.cam) return;
  let cr = worldMap.cv && worldMap.cv.getBoundingClientRect();
  if (cr && cr.width > 20 && cr.height > 20 && Math.abs(cr.width / cr.height - worldMapWidth / worldMapHeight) > 0.04) {
    worldMapSize();
    cr = worldMap.cv.getBoundingClientRect();
  }
  const s = cr && cr.width ? cr.width / worldMapWidth : worldMap.s,
    sy = cr && cr.height ? cr.height / worldMapHeight : s;
  let h = '';
  const dest = saveData.route.plan.length ? saveData.route.plan[saveData.route.plan.length - 1] : null;
  (worldMap.proj || []).forEach(({ q, i, kind }) => {
    if (q.x < -10 || q.x > worldMapWidth + 10 || q.y < 0 || q.y > worldMapHeight) return;
    let name,
      cls = '';
    if (kind === 'r') {
      if (isBehindSun(worldMap.cam, LOCATION_VECTORS[i])) return;
      const far = q.z > 0.85 && i !== saveData.route.node && uiState.mapSel !== i && i !== dest;
      if (far) return;
      name = LOCATIONS[i].name;
      cls =
        (i === saveData.route.node ? ' here' : '') +
        (uiState.mapSel === i ? ' sel' : '') +
        (i === dest ? ' dest' : '') +
        (!saveData.visited[i] ? ' new' : '');
    } else if (kind === 'f') {
      if (isBehindSun(worldMap.cam, REGION_VECTORS[i])) return;
      if (q.z > 0.9 && uiState.mapSel !== 'f' + i) return;
      name = REGIONS[i].name;
      cls = ' fog' + (uiState.mapSel === 'f' + i ? ' sel' : '');
    } else {
      name = REGIONS[i].name;
      cls = ' sun' + (uiState.mapSel === 'f' + i ? ' sel' : '');
    }
    const n = kind === 'r' ? i : 'f' + i,
      estW = name.length * 7.2 + 14,
      right = q.x * s + 8 + estW < worldMapWidth * s || q.x < worldMapWidth * 0.35;
    h += `<button class="mlab${cls}" data-a="msel" data-n="${n}" style="top:${((q.y - (kind === 'r' ? 6 : 0)) * sy).toFixed(1)}px;${right ? `left:${((q.x + 5) * s).toFixed(1)}px` : `right:${((worldMapWidth - q.x + 5) * s).toFixed(1)}px`}">${escapeHtml(name)}</button>`;
  });
  if (L._h !== h) {
    L.innerHTML = h;
    L._h = h;
  }
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setWorldMapLabels(v) {
  worldMapLabels = v; // eslint-disable-line no-func-assign
  provide({ worldMapLabels });
}
export function worldMapSelect(n) {
  uiState.mapSel = n;
  paintMapCard();
  worldMapLabels();
  const v =
    typeof n === 'number'
      ? LOCATION_VECTORS[n]
      : typeof n === 'string'
        ? REGIONS[+n.slice(1)].t === 'sun'
          ? null
          : REGION_VECTORS[+n.slice(1)]
        : null;
  if (v) worldMapFocus(v);
  worldMap.dirty = true;
}
function worldMapPick(ev) {
  const cv = worldMap.cv;
  if (!cv) return;
  const r = cv.getBoundingClientRect(),
    x = ((ev.clientX - r.left) / r.width) * worldMapWidth,
    y = ((ev.clientY - r.top) / r.height) * worldMapHeight;
  let best = null,
    bd = 14;
  (worldMap.proj || []).forEach(({ q, i, kind }) => {
    const d = Math.hypot(q.x - x, q.y - (kind === 'r' ? 3 : 0) - y);
    if (d < bd) {
      bd = d;
      best = kind === 'r' ? i : 'f' + i;
    }
  });
  if (best !== null) worldMapSelect(best);
}
