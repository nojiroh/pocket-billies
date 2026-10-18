'use strict';
/* ================= WORLD MAP: the inside of a sphere, raycast in pixels; surface texture from art/map/world.png =================
   Fills the screen. The trails painted on the texture follow the links between stops (the walking network).
   Tap a place to see it; travel there, stay, stop or turn back from the card. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { flyDraw, flyTick, paintMapCard, provide, toast } from './hooks.js';
import { $, clamp } from './util.js';
import { FUTURE, LINKS, ROUTE, linkCost } from './data.js';
import { RM, S, U, canEnter, esc, nextStop } from './core.js';
import { frameCount, frameStop, frameTask, userFps } from './frame.js';
import { artPixels, d44, mixA, mstamp, pk, seeded } from './art.js';
import { owFrames } from './trainer.js';
import { EASE } from './battle-stage.js';
/* eslint-disable no-func-assign */
expose({
  D2R: [() => D2R],
  ESEG: [() => ESEG],
  MAP: [() => MAP],
  MCL: [() => MCL],
  MH: [() => MH, v => setMH(v)],
  MLAND: [() => MLAND],
  MNV: [() => MNV],
  MREG: [() => MREG],
  MW: [() => MW, v => setMW(v)],
  REGV: [() => REGV],
  TH: [() => TH],
  TW: [() => TW],
  WORLD_ART: [() => WORLD_ART],
  WTEX: [() => WTEX, v => (WTEX = v)],
  edgePos: [() => edgePos, v => (edgePos = v)],
  llv: [() => llv],
  mapCam: [() => mapCam, v => (mapCam = v)],
  mapFit: [() => mapFit, v => setMapFit(v)],
  mapFocus: [() => mapFocus, v => (mapFocus = v)],
  mapLabels: [() => mapLabels, v => setMapLabels(v)],
  mapLoop: [() => mapLoop, v => (mapLoop = v)],
  mapMount: [() => mapMount, v => setMapMount(v)],
  mapPick: [() => mapPick, v => (mapPick = v)],
  mapPrepare: [() => mapPrepare, v => (mapPrepare = v)],
  mapRender: [() => mapRender, v => (mapRender = v)],
  mapReset: [() => mapReset, v => setMapReset(v)],
  mapSelect: [() => mapSelect, v => (mapSelect = v)],
  mapSize: [() => mapSize, v => (mapSize = v)],
  mapWalk: [() => mapWalk, v => (mapWalk = v)],
  mapZoom: [() => mapZoom, v => setMapZoom(v)],
  mePos: [() => mePos, v => (mePos = v)],
  mproj: [() => mproj, v => (mproj = v)],
  onStepsAdded: [() => onStepsAdded, v => ((onStepsAdded = v), provide({ onStepsAdded }))],
  pixRingM: [() => pixRingM, v => (pixRingM = v)],
  setMH: [() => setMH, v => (setMH = v)],
  setMW: [() => setMW, v => (setMW = v)],
  setMapFit: [() => setMapFit, v => (setMapFit = v)],
  setMapLabels: [() => setMapLabels, v => (setMapLabels = v)],
  setMapMount: [() => setMapMount, v => (setMapMount = v)],
  setMapReset: [() => setMapReset, v => (setMapReset = v)],
  setMapZoom: [() => setMapZoom, v => (setMapZoom = v)],
  slerp: [() => slerp, v => (slerp = v)],
  sunBlocks: [() => sunBlocks, v => (sunBlocks = v)],
  v3: [() => v3],
});
/* eslint-enable no-func-assign */
provide({ onStepsAdded });
/* to-module: end */
export let MW = 176,
  MH = 232;
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMH(v) {
  MH = v;
  provide({ MH });
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMW(v) {
  MW = v;
  provide({ MW });
}
export const TW = 1536,
  TH = 768,
  D2R = Math.PI / 180;
const llv = (lon, lat) => {
  lon *= D2R;
  lat *= D2R;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
};
export const v3 = {
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
  const d = clamp(v3.dot(a, b), -1, 1),
    w = Math.acos(d);
  if (w < 1e-5) return a;
  const s = Math.sin(w);
  return v3.add(v3.mul(a, Math.sin((1 - t) * w) / s), v3.mul(b, Math.sin(t * w) / s));
}
export const MNV = ROUTE.map(r => llv(r.lon || 0, r.lat || 0));
export const REGV = FUTURE.map(f => (f.t === 'sun' || f.lon == null ? [0, 0, 0] : llv(f.lon, f.lat || 0)));
const MREG = ROUTE.map((r, i) => ({ t: r.t, v: MNV[i], r: r.town ? 4.6 : 5.6 })).concat(
  FUTURE.map((f, i) => ({ f, i }))
    .filter(o => o.f.t !== 'sun' && o.f.lon != null)
    .map(({ f, i }) => ({ t: f.t, v: REGV[i], r: f.t === 'trench' ? 9 : 6.5 }))
);
/* each link as points on the sphere, curved exactly like the painted trail */
const ESEG = LINKS.map(([a, b], i) => {
  const A = MNV[a],
    Bv = MNV[b],
    nrm = v3.norm(v3.cross(A, Bv)),
    pts = [];
  let len = 0,
    prev = null;
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    let p = slerp(A, Bv, t);
    p = v3.norm(v3.add(p, v3.mul(nrm, Math.sin(t * Math.PI) * 0.035 * (i % 2 ? 1 : -1))));
    if (prev) len += v3.len(v3.sub(p, prev));
    pts.push({ p, l: len });
    prev = p;
  }
  return { a, b, pts, len };
});
export function edgePos(a, b, f) {
  const i = LINKS.findIndex(l => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a));
  if (i < 0) return MNV[a];
  const s = ESEG[i],
    g = (s.a === a ? f : 1 - f) * s.len;
  let k = 1;
  while (k < s.pts.length - 1 && s.pts[k].l < g) k++;
  const p0 = s.pts[k - 1],
    p1 = s.pts[k],
    u = (g - p0.l) / (p1.l - p0.l || 1);
  return v3.norm(v3.add(v3.mul(p0.p, 1 - u), v3.mul(p1.p, u)));
}
export function mePos() {
  const r = S.route,
    nx = nextStop();
  if (nx == null || !r.prog) return MNV[r.node];
  return edgePos(r.node, nx, clamp(r.prog / linkCost(r.node, nx), 0, 1));
}
/* the inner surface of the world, read from art/map/world.png */
export const WORLD_ART = 'map/world.png';
provide({ WORLD_ART }); /* to-module */
let WTEX = null;
export function mapPrepare() {
  return WTEX
    ? Promise.resolve(WTEX)
    : artPixels(WORLD_ART).then(t => {
        WTEX = t;
        MAP.dirty = true;
        return t;
      });
}
/* clouds floating inside the sphere */
export const MCL = [];
(function () {
  const R = seeded(812);
  for (let i = 0; i < 16; i++) {
    const lon = R() * 200 - 20,
      lat = (R() - 0.5) * 50,
      v = llv(lon, lat),
      alt = 0.86 + R() * 0.06;
    MCL.push({ c: v3.mul(v, alt), r: 0.022 + R() * 0.028, lon, lat, alt, sp: 0.4 + R() * 0.6 });
  }
})();
/* landmark billboards standing on the surface (stamps live in the icon atlas as map_*) */
export const MLAND = [];
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
  MREG.forEach((r, ri) => {
    if (ri < ROUTE.length && ROUTE[ri].scene) return;
    /* v24: stops have miniatures (world-map-gl.js) */ const L = KIND[r.t] || [],
      R = seeded(ri * 131 + 9),
      n = r.t === 'mall' ? 1 : L.length ? 7 : 0;
    for (let k = 0; k < n; k++) {
      const sp = r.r * D2R * 0.6,
        off = r.t === 'mall' ? [0, 0, 0] : [(R() - 0.5) * sp * 2, (R() - 0.5) * sp * 2, (R() - 0.5) * sp * 2];
      MLAND.push({ v: v3.norm(v3.add(r.v, off)), k: L[k % L.length] });
    }
  });
})();
/* ---------- state & camera ---------- */
export const MAP = {
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
function mapSize() {
  const cr = MAP.cv && MAP.cv.isConnected ? MAP.cv.getBoundingClientRect() : null,
    w = cr && cr.width > 20 ? cr.width : innerWidth,
    h = cr && cr.height > 20 ? cr.height : innerHeight,
    H0 = clamp(Math.round(h / 3.4), 180, 300),
    W0 = clamp(Math.round((H0 * w) / h), 120, 640),
    kk = Math.min(1, Math.sqrt(70000 / (W0 * H0))),
    H = Math.round(H0 * kk),
    W = Math.round(W0 * kk);
  if (W !== MW || H !== MH) {
    MW = W;
    MH = H;
    MAP.img = null;
    if (MAP.cv) {
      MAP.cv.width = MW;
      MAP.cv.height = MH;
    }
  }
  MAP.s = w / MW;
  MAP.dirty = true;
}
export function mapFit() {
  if (!MAP.cv || !MAP.cv.isConnected) return;
  mapSize();
  mapLabels();
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMapFit(v) {
  mapFit = v; // eslint-disable-line no-func-assign
  provide({ mapFit });
}
export function mapCam() {
  const P = MAP.focus || mePos(),
    U = v3.mul(P, -1),
    east = v3.norm(v3.cross(P, [0, 1, 0]));
  let F = v3.norm(v3.sub(east, v3.mul(U, v3.dot(east, U))));
  const R0 = v3.norm(v3.cross(F, U)),
    cy = Math.cos(MAP.yaw),
    sy = Math.sin(MAP.yaw),
    Fa = v3.norm(v3.add(v3.mul(F, cy), v3.mul(R0, sy)));
  /* v31: MAP.tilt is the camera's angle above the ground (default about 33 degrees, as before) */
  const alt = MAP.alt,
    th = MAP.tilt ?? 0.5733,
    dk = alt * 1.8385,
    C = v3.add(v3.add(P, v3.mul(U, dk * Math.sin(th))), v3.mul(Fa, -dk * Math.cos(th))),
    dp = v3.norm(v3.sub(P, C)),
    ds = v3.norm(v3.mul(C, -1)),
    w = clamp((MW < MH ? MAP.look * 0.2 : MAP.look) * Math.min(1, MAP.alt / 0.3) + MAP.pitch, -0.3, 1);
  const fw = v3.norm(v3.add(v3.mul(dp, 1 - w), v3.mul(ds, w))),
    rt = v3.norm(v3.cross(fw, U)),
    up = v3.cross(rt, fw);
  return { C, fw, rt, up, P, foc: Math.min(MW * 0.62, MH * 0.47) };
}
export function mproj(cam, p) {
  const d = v3.sub(p, cam.C),
    z = v3.dot(d, cam.fw);
  if (z < 0.004) return null;
  return { x: MW / 2 + (cam.foc * v3.dot(d, cam.rt)) / z, y: MH / 2 - (cam.foc * v3.dot(d, cam.up)) / z, z };
}
function mapRender(t, lo) {
  const c = MAP.ctx;
  if (!WTEX) return;
  if (!MAP.img || MAP.img.width !== MW || MAP.img.height !== MH) MAP.img = c.createImageData(MW, MH);
  const buf = new Uint32Array(MAP.img.data.buffer),
    T = WTEX,
    cam = mapCam(),
    C = cam.C,
    cc = v3.dot(C, C);
  MAP.cam = cam;
  const haze = [176, 186, 236],
    RS = 0.075,
    st = lo ? 2 : 1;
  const cl = [];
  MCL.forEach(k => {
    const a = (k.lon + (t / 1000) * k.sp) * D2R,
      la = k.lat * D2R,
      cv = [Math.cos(la) * Math.cos(a) * k.alt, Math.sin(la) * k.alt, Math.cos(la) * Math.sin(a) * k.alt],
      n = v3.norm(cv),
      q = mproj(cam, cv),
      qs = mproj(cam, n);
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
  const sq = mproj(cam, [0, 0, 0]),
    sR = sq ? (0.42 * cam.foc) / sq.z + 4 : 0;
  for (let j = 0; j < MH; j += st) {
    const rowC = cl.filter(k => k.b && j >= k.b[2] && j <= k.b[3]),
      rowS = cl.filter(k => k.sb && j >= k.sb[2] && j <= k.sb[3]),
      nearSun = sq && Math.abs(j - sq.y) < sR;
    for (let i = 0; i < MW; i += st) {
      const dx = (i + 0.5 - MW / 2) / cam.foc,
        dy = (MH / 2 - j - 0.5) / cam.foc,
        d = v3.norm([
          cam.fw[0] + cam.rt[0] * dx + cam.up[0] * dy,
          cam.fw[1] + cam.rt[1] * dx + cam.up[1] * dy,
          cam.fw[2] + cam.rt[2] * dx + cam.up[2] * dy,
        ]);
      const b = v3.dot(C, d),
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
        const oc = v3.sub(C, k.c),
          bb = v3.dot(oc, d),
          q = bb * bb - (v3.dot(oc, oc) - k.r * k.r);
        if (q > 0) {
          const t0 = -bb - Math.sqrt(q);
          if (t0 > 0 && t0 < tHit) {
            tHit = t0;
            cloud = k;
          }
        }
      }
      if (sunHit && !cloud) {
        const p = v3.add(C, v3.mul(d, tHit)),
          nz = Math.max(0, -v3.dot(v3.norm(p), d));
        col = mixA([255, 196, 90], [255, 252, 232], Math.pow(nz, 0.6));
        if (nz > 0.55 && (i + j) & 1 && nz < 0.62) col = [255, 236, 170];
      } else if (cloud) {
        const p = v3.add(C, v3.mul(d, tHit)),
          n = v3.norm(v3.sub(p, cloud.c)),
          lit = -v3.dot(n, cloud.n);
        col = mixA([196, 186, 232], [255, 255, 255], clamp(0.55 + lit * 0.6 + (d44(i, j) - 0.5) * 0.25, 0, 1));
      } else {
        const p = v3.add(C, v3.mul(d, ts)),
          lat = Math.asin(clamp(p[1], -1, 1)),
          lon = Math.atan2(p[2], p[0]);
        let u = Math.floor(((lon / (Math.PI * 2) + 1) % 1) * TW),
          v = Math.floor((0.5 - lat / Math.PI) * TH);
        if (u >= TW) u = TW - 1;
        v = clamp(v, 0, TH - 1);
        const px = T[v * TW + u];
        col = [px & 255, (px >> 8) & 255, (px >> 16) & 255];
        for (const k of rowS) {
          if (i < k.sb[0] || i > k.sb[1]) continue;
          const cd = v3.dot(k.c, p);
          if (cd > 0) {
            const perp = v3.len(v3.sub(k.c, v3.mul(p, cd)));
            if (perp < k.r * 1.25) {
              const e = perp / (k.r * 1.25);
              if (e < 0.7 || d44(i, j) < (1 - e) * 3.3) {
                col = mixA(col, [36, 26, 76], 0.42);
              }
              break;
            }
          }
        }
        const fogk = 1 - Math.exp(-Math.max(0, ts - 0.3) * 0.72);
        col = mixA(col, haze, clamp(fogk + (d44(i, j) - 0.5) * 0.06, 0, 0.86));
      }
      if ((!sunHit || cloud) && sq && b < 0) {
        const dist = Math.sqrt(Math.max(0, cc - b * b)),
          g = clamp(1 - dist / 0.42, 0, 1);
        if (g > 0) col = mixA(col, [255, 236, 180], g * g * 0.85);
      }
      const pc = pk(col[0], col[1], col[2]);
      buf[j * MW + i] = pc;
      if (st > 1) {
        if (i + 1 < MW) buf[j * MW + i + 1] = pc;
        if (j + 1 < MH) {
          buf[(j + 1) * MW + i] = pc;
          if (i + 1 < MW) buf[(j + 1) * MW + i + 1] = pc;
        }
      }
    }
  }
  c.putImageData(MAP.img, 0, 0);
  /* the planned trip, drawn over the painted trail */
  const plan = [S.route.node, ...S.route.plan];
  if (plan.length > 1) {
    c.fillStyle = S.route.hold ? 'rgba(255,255,255,.75)' : '#FFE27A';
    for (let k = 0; k < plan.length - 1; k++) {
      const a = plan[k],
        b = plan[k + 1];
      for (let f = 0; f <= 1; f += 0.04) {
        if (k === 0 && f < S.route.prog / linkCost(a, b)) continue;
        if (Math.floor(f * 25 + t / 120) % 3 === 0) continue;
        const q = mproj(cam, edgePos(a, b, f));
        if (q && q.z < 1.4) c.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
      }
    }
  }
  /* markers, landmarks, player */
  const L = [];
  ROUTE.forEach((n, i) => {
    const q = mproj(cam, MNV[i]);
    if (q) L.push({ q, i, kind: 'r' });
  });
  FUTURE.forEach((f, i) => {
    if (f.t === 'sun') {
      const q = mproj(cam, [0, 0, 0]);
      if (q) L.push({ q, i, kind: 'sun' });
      return;
    }
    const q = mproj(cam, REGV[i]);
    if (q) L.push({ q, i, kind: 'f' });
  });
  MAP.proj = L;
  L.sort((a, b) => b.q.z - a.q.z);
  const dest = S.route.plan.length ? S.route.plan[S.route.plan.length - 1] : null;
  L.forEach(({ q, i, kind }) => {
    if (kind === 'sun') return;
    const occ = sunBlocks(cam, kind === 'r' ? MNV[i] : REGV[i]);
    if (occ) return;
    const s = clamp(0.16 / q.z, 0.6, 2.4);
    if (kind === 'r') {
      const n = ROUTE[i],
        reached = !!S.visited[i],
        locked = !canEnter(i),
        col =
          i === S.route.node
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
        c.fillStyle = n.board ? (S.flags[n.board] ? '#F4C542' : '#D9434B') : '#5DD6A0';
        c.fillRect(x + r + 1, y - r * 4 - 2, Math.max(2, r + 1), Math.max(2, r));
      }
      if (U.mapSel === i || i === dest) {
        const rr = Math.round(5 * s + Math.sin(t / 200) * 1.5);
        pixRingM(c, x, y - r * 2, rr, i === dest && U.mapSel !== i ? '#FFE27A' : '#FFFFFF');
      }
    } else {
      const x = Math.round(q.x),
        y = Math.round(q.y);
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.fillRect(x - 1, y - 1, 3, 3);
      c.fillStyle = '#5A5080';
      c.fillRect(x, y, 1, 1);
      if (U.mapSel === 'f' + i) pixRingM(c, x, y, Math.round(5 * s + Math.sin(t / 200) * 1.5), '#FFFFFF');
    }
  });
  const sq2 = mproj(cam, [0, 0, 0]);
  const sunI = FUTURE.findIndex(f => f.t === 'sun');
  if (sq2 && sunI >= 0 && U.mapSel === 'f' + sunI)
    pixRingM(c, Math.round(sq2.x), Math.round(sq2.y), Math.round(12 + Math.sin(t / 200) * 2), '#FFFFFF');
  const LS = [];
  MLAND.forEach(l => {
    const q = mproj(cam, l.v);
    if (q && q.z < 1.25 && q.x > -20 && q.x < MW + 20 && q.y > -20 && q.y < MH + 20 && !sunBlocks(cam, l.v))
      LS.push([q, l]);
  });
  LS.sort((a, b) => b[0].z - a[0].z);
  LS.forEach(([q, l]) => {
    const im = mstamp(l.k),
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
  const pq = mproj(cam, MAP.me || mePos());
  if (pq && MAP.fly && typeof flyDraw === 'function') flyDraw(c, t, v => mproj(cam, v));
  else if (pq) {
    const fr = owFrames('me'),
      set = fr[MAP.face] || fr.down,
      f = MAP.moving ? set[1 + (Math.floor(t / 140) % 2)] : set[0],
      bob = MAP.moving ? 0 : Math.floor(t / 600) % 2;
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
export function sunBlocks(cam, p) {
  const d = v3.sub(p, cam.C),
    L = v3.len(d),
    u = v3.mul(d, 1 / L),
    b = v3.dot(cam.C, u),
    q = b * b - (v3.dot(cam.C, cam.C) - 0.075 * 0.075);
  if (q <= 0) return false;
  const t0 = -b - Math.sqrt(q);
  return t0 > 0 && t0 < L;
}
function pixRingM(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let a = 0; a < 360; a += Math.max(4, 60 / r)) {
    const rad = (a * Math.PI) / 180;
    c.fillRect(Math.round(cx + Math.cos(rad) * r), Math.round(cy + Math.sin(rad) * r), 1, 1);
  }
}
export function mapMount() {
  const cv = $('#mapcv');
  if (!cv) return;
  if (!WTEX) {
    document.body.classList.add('map-loading');
    mapPrepare()
      .then(() => document.body.classList.remove('map-loading'))
      .catch(e => {
        console.error(e);
        toast(e.message);
      });
  }
  MAP.cv = cv;
  MAP.ctx = cv.getContext('2d');
  MAP.img = null;
  mapSize();
  cv.width = MW;
  cv.height = MH;
  MAP.dirty = true;
  const to = mePos();
  if (!MAP.me) MAP.me = to;
  else if (v3.dot(MAP.me, to) < 0.999999) mapWalk(MAP.me, to);
  if (!MAP.focus) MAP.focus = to;
  if (!cv._bound) {
    cv._bound = 1;
    cv.addEventListener('pointerdown', e => {
      MAP.drag = { x: e.clientX, y: e.clientY, yaw: MAP.yaw, pitch: MAP.pitch, moved: 0, id: e.pointerId };
      cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      const D = MAP.drag;
      if (!D) return;
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) D.moved = 1;
      MAP.yaw = D.yaw - dx * 0.006;
      MAP.pitch = clamp(D.pitch + dy * 0.0025, -0.44, 0.5);
    });
    cv.addEventListener('pointerup', e => {
      const D = MAP.drag;
      MAP.drag = null;
      MAP.dirty = true;
      if (D && !D.moved) mapPick(e);
    });
    cv.addEventListener('pointercancel', () => {
      MAP.drag = null;
    });
    cv.addEventListener(
      'wheel',
      e => {
        e.preventDefault();
        MAP.alt = clamp(MAP.alt * (e.deltaY > 0 ? 1.12 : 0.89), 0.08, 0.7);
        MAP.dirty = true;
      },
      { passive: false }
    );
  }
  if (!MAP.on) {
    MAP.on = true;
    MAP.last = performance.now();
    frameTask('map', mapLoop);
  }
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMapMount(v) {
  mapMount = v; // eslint-disable-line no-func-assign
  provide({ mapMount });
}
export function mapZoom(k) {
  MAP.alt = clamp(MAP.alt * k, 0.08, 0.7);
  MAP.dirty = true;
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMapZoom(v) {
  mapZoom = v; // eslint-disable-line no-func-assign
  provide({ mapZoom });
}
export function mapReset() {
  MAP.yaw = 0;
  MAP.pitch = 0;
  MAP.alt = 0.32;
  mapFocus(mePos());
  U.mapSel = null;
  paintMapCard();
  MAP.dirty = true;
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMapReset(v) {
  mapReset = v; // eslint-disable-line no-func-assign
  provide({ mapReset });
}
function mapFocus(v) {
  MAP.fT = { from: MAP.focus || v, to: v, t0: performance.now(), dur: RM ? 1 : 700 };
}
export function mapWalk(from, to) {
  MAP.anim = {
    from,
    to,
    t0: performance.now(),
    dur: RM ? 1 : clamp(Math.acos(clamp(v3.dot(from, to), -1, 1)) * 9000, 600, 3200),
  };
}
function onStepsAdded() {
  if (U.tab !== 'map' || !MAP.cv || !MAP.cv.isConnected || MAP.fly) return;
  const to = mePos();
  if (MAP.me && v3.dot(MAP.me, to) < 0.999999) {
    mapWalk(MAP.me, to);
    if (U.mapSel == null) mapFocus(to);
  }
  paintMapCard();
}
function mapLoop(ts) {
  if (!MAP.cv || !MAP.cv.isConnected) {
    MAP.on = false;
    frameStop('map');
    return;
  }
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
  } else if (U.mapSel == null && MAP.me) MAP.focus = MAP.me;
  const busy = !!(MAP.drag || moving || panning || MAP.zt);
  if (ts - MAP.lastDraw < (busy ? 1000 / userFps() - 2 : 400) && !MAP.dirty) return;
  MAP.lastDraw = ts;
  MAP.dirty = false;
  const w0 = performance.now();
  mapRender(ts, busy);
  frameCount(performance.now() - w0);
  mapLabels();
  if (busy && !MAP.drag && !moving) MAP.zt = 0;
  if (MAP.wasBusy && !busy) MAP.dirty = true;
  MAP.wasBusy = busy;
}
export function mapLabels() {
  const L = $('#maplabels');
  if (!L || !MAP.cam) return;
  let cr = MAP.cv && MAP.cv.getBoundingClientRect();
  if (cr && cr.width > 20 && cr.height > 20 && Math.abs(cr.width / cr.height - MW / MH) > 0.04) {
    mapSize();
    cr = MAP.cv.getBoundingClientRect();
  }
  const s = cr && cr.width ? cr.width / MW : MAP.s,
    sy = cr && cr.height ? cr.height / MH : s;
  let h = '';
  const dest = S.route.plan.length ? S.route.plan[S.route.plan.length - 1] : null;
  (MAP.proj || []).forEach(({ q, i, kind }) => {
    if (q.x < -10 || q.x > MW + 10 || q.y < 0 || q.y > MH) return;
    let name,
      cls = '';
    if (kind === 'r') {
      if (sunBlocks(MAP.cam, MNV[i])) return;
      const far = q.z > 0.85 && i !== S.route.node && U.mapSel !== i && i !== dest;
      if (far) return;
      name = ROUTE[i].name;
      cls =
        (i === S.route.node ? ' here' : '') +
        (U.mapSel === i ? ' sel' : '') +
        (i === dest ? ' dest' : '') +
        (!S.visited[i] ? ' new' : '');
    } else if (kind === 'f') {
      if (sunBlocks(MAP.cam, REGV[i])) return;
      if (q.z > 0.9 && U.mapSel !== 'f' + i) return;
      name = FUTURE[i].name;
      cls = ' fog' + (U.mapSel === 'f' + i ? ' sel' : '');
    } else {
      name = FUTURE[i].name;
      cls = ' sun' + (U.mapSel === 'f' + i ? ' sel' : '');
    }
    const n = kind === 'r' ? i : 'f' + i,
      estW = name.length * 7.2 + 14,
      right = q.x * s + 8 + estW < MW * s || q.x < MW * 0.35;
    h += `<button class="mlab${cls}" data-a="msel" data-n="${n}" style="top:${((q.y - (kind === 'r' ? 6 : 0)) * sy).toFixed(1)}px;${right ? `left:${((q.x + 5) * s).toFixed(1)}px` : `right:${((MW - q.x + 5) * s).toFixed(1)}px`}">${esc(name)}</button>`;
  });
  if (L._h !== h) {
    L.innerHTML = h;
    L._h = h;
  }
}
/* phase 04d: world-map-gl.js puts the 3D map in place */
export function setMapLabels(v) {
  mapLabels = v; // eslint-disable-line no-func-assign
  provide({ mapLabels });
}
export function mapSelect(n) {
  U.mapSel = n;
  paintMapCard();
  mapLabels();
  const v =
    typeof n === 'number'
      ? MNV[n]
      : typeof n === 'string'
        ? FUTURE[+n.slice(1)].t === 'sun'
          ? null
          : REGV[+n.slice(1)]
        : null;
  if (v) mapFocus(v);
  MAP.dirty = true;
}
function mapPick(ev) {
  const cv = MAP.cv;
  if (!cv) return;
  const r = cv.getBoundingClientRect(),
    x = ((ev.clientX - r.left) / r.width) * MW,
    y = ((ev.clientY - r.top) / r.height) * MH;
  let best = null,
    bd = 14;
  (MAP.proj || []).forEach(({ q, i, kind }) => {
    const d = Math.hypot(q.x - x, q.y - (kind === 'r' ? 3 : 0) - y);
    if (d < bd) {
      bd = d;
      best = kind === 'r' ? i : 'f' + i;
    }
  });
  if (best !== null) mapSelect(best);
}
