'use strict';
/* ================= POCKET BILLIES STUDIO · world map painter =================
   art/map/world.png is the inside of the sphere, unrolled (longitude across, latitude down).
   Paint it directly, repaint the trail along the route stops (the same path the game walks), and move a stop's painted
   patch along with the stop. Holes are filled from the surrounding terrain. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { cnv } from '../../game/js/art.js';
import { esc } from './shims.js';
import { ST, after, ask, card, changed, commit, fmtN, render, toast } from './core.js';
import { atlasGet, atlasNow, markArt } from './sprites.js';
/* eslint-disable no-func-assign */
expose({
  D2R_: [() => D2R_],
  MP: [() => MP],
  MPW: [() => MPW],
  WORLD_PATH: [() => WORLD_PATH],
  c32hex: [() => c32hex],
  carryPatch: [() => carryPatch, v => (carryPatch = v)],
  dirOf: [() => dirOf, v => (dirOf = v)],
  eraseTrailAll: [() => eraseTrailAll, v => (eraseTrailAll = v)],
  gamePath: [() => gamePath, v => (gamePath = v)],
  hex32: [() => hex32],
  inpaint: [() => inpaint, v => (inpaint = v)],
  llv_: [() => llv_],
  mpBind: [() => mpBind, v => (mpBind = v)],
  mpCenter: [() => mpCenter, v => (mpCenter = v)],
  mpCommitPixels: [() => mpCommitPixels, v => (mpCommitPixels = v)],
  mpData: [() => mpData, v => (mpData = v)],
  mpDisp: [() => mpDisp],
  mpDraw: [() => mpDraw, v => (mpDraw = v)],
  mpFill: [() => mpFill, v => (mpFill = v)],
  mpGlobe: [() => mpGlobe, v => (mpGlobe = v)],
  mpHint: [() => mpHint, v => (mpHint = v)],
  mpMarkers: [() => mpMarkers, v => (mpMarkers = v)],
  mpMount: [() => mpMount, v => (mpMount = v)],
  mpPalette: [() => mpPalette, v => (mpPalette = v)],
  mpPush: [() => mpPush, v => (mpPush = v)],
  mpRedo: [() => mpRedo, v => (mpRedo = v)],
  mpScrollTo: [() => mpScrollTo, v => (mpScrollTo = v)],
  mpSetColor: [() => mpSetColor, v => (mpSetColor = v)],
  mpStamp: [() => mpStamp, v => (mpStamp = v)],
  mpUndo: [() => mpUndo, v => (mpUndo = v)],
  mpView: [() => mpView, v => (mpView = v)],
  paintTrail: [() => paintTrail, v => (paintTrail = v)],
  plotDisc: [() => plotDisc, v => (plotDisc = v)],
  slerp_: [() => slerp_, v => (slerp_ = v)],
  trailSet: [() => trailSet, v => (trailSet = v)],
  uvOf: [() => uvOf, v => (uvOf = v)],
  v3s: [() => v3s],
  worldPaint: [() => worldPaint, v => ((worldPaint = v), provide({ worldPaint }))],
  wrapU: [() => wrapU],
});
/* eslint-enable no-func-assign */
provide({ worldPaint });
/* to-module: end */
const MP = {
  off: null,
  tool: 'brush',
  size: 4,
  color: '#68AA54',
  zoom: 1,
  src: null,
  undo: [],
  redo: [],
  carry: true,
  radius: 8,
  style: { path: '#8A6A3E', pathR: 2, dots: '#E2C48A', dotEvery: 7, future: '#F0E6C8', futureR: 0.8 },
  trailCols: ['#8A6A3E', '#E2C48A', '#F0E6C8'],
};
const WORLD_PATH = 'art/map/world.png';
const v3s = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
const D2R_ = Math.PI / 180;
const llv_ = (lon, lat) => {
  lon *= D2R_;
  lat *= D2R_;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
};
function slerp_(a, b, t) {
  const d = clamp(v3s.dot(a, b), -1, 1),
    w = Math.acos(d);
  if (w < 1e-5) return a;
  const s = Math.sin(w);
  return v3s.add(v3s.mul(a, Math.sin((1 - t) * w) / s), v3s.mul(b, Math.sin(t * w) / s));
}
/* the walking path, computed exactly as game/js/world-map.js does */
function gamePath() {
  const D = ST.D,
    pts = D.route
      .map(r => llv_(r.lon || 0, r.lat || 0))
      .concat(D.regions.filter(f => f.t !== 'sun' && f.lon != null).map(f => llv_(f.lon, f.lat || 0))),
    last = D.route.length - 1,
    segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1],
      nrm = v3s.norm(v3s.cross(a, b)),
      P = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      let p = slerp_(a, b, t);
      p = v3s.norm(v3s.add(p, v3s.mul(nrm, Math.sin(t * Math.PI) * 0.035 * (i % 2 ? 1 : -1))));
      P.push(p);
    }
    segs.push({ pts: P, locked: i >= last });
  }
  return segs;
}
const MPW = () => {
  const c = atlasNow(WORLD_PATH);
  return c ? [c.width, c.height] : [1536, 768];
};
function uvOf(v, W, H) {
  const lat = Math.asin(clamp(v[1], -1, 1)),
    lon = Math.atan2(v[2], v[0]);
  return [((lon / (Math.PI * 2) + 1) % 1) * W, (0.5 - lat / Math.PI) * H];
}
function dirOf(u, v, W, H) {
  const lon = ((u + 0.5) / W) * Math.PI * 2,
    lat = (0.5 - (v + 0.5) / H) * Math.PI;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}
const hex32 = h => {
  const n = parseInt(h.slice(1), 16);
  return ((255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0;
}; /* unsigned, like Uint32Array reads */
const c32hex = c =>
  '#' +
  [c & 255, (c >> 8) & 255, (c >> 16) & 255]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
/* ---------- section ---------- */
function worldPaint() {
  after(mpMount);
  const s = MP.style;
  return `<div class="mp">${card(
    'Map art',
    `<div class="mp-bar">
  <span class="px-tools">${[
    ['brush', 'Brush', 'B'],
    ['pick', 'Pick color', 'I'],
    ['fill', 'Fill', 'F'],
    ['clone', 'Clone', 'C'],
    ['terrain', 'Fill with terrain', 'T'],
    ['trailErase', 'Erase trail', 'E'],
    ['trail', 'Trail brush', 'R'],
  ]
    .map(
      ([k, l, sc]) =>
        `<button class="seg ${MP.tool === k ? 'on' : ''}" data-mp="tool" data-t="${k}" title="${l} (${sc})">${l}</button>`
    )
    .join('')}</span>
  <label class="mp-size"><span>Size</span><input type="range" id="mpSize" min="1" max="24" value="${MP.size}"><output id="mpSizeO">${MP.size}</output></label>
  <span class="colw"><input type="color" id="mpColor" value="${MP.color}"></span>
  <span class="px-tools"><button class="seg" data-mp="zoom" data-z="-1">−</button><span id="mpZoom">${MP.zoom}×</span><button class="seg" data-mp="zoom" data-z="1">+</button><button class="seg" data-mp="undo" title="Undo (Ctrl+Z)">↶</button><button class="seg" data-mp="redo" title="Redo (Ctrl+Y)">↷</button></span></div>
  <div class="mp-stage" id="mpStage"><div class="mp-wrap" id="mpWrap"><canvas id="mpCv"></canvas><svg id="mpSvg"></svg></div></div>
  <div class="mp-pal" id="mpPal"></div>
  <p class="help" id="mpHint">${mpHint()}</p>`,
    {
      sub: 'Drag stops to move them. With “carry the painted patch” on, the area painted around a stop moves with it and the old spot is filled with the surrounding terrain.',
    }
  )}
 ${card(
   'Trail and patches',
   `<div class="grid">${[
     ['path', 'Trail color'],
     ['dots', 'Trail markings'],
     ['future', 'Path ahead (locked regions)'],
   ]
     .map(
       ([k, n]) =>
         `<label class="fld color"><span>${n}</span><span class="colw"><input type="color" data-mps="${k}" value="${s[k]}"></span></label>`
     )
     .join('')}
  <label class="fld"><span>Trail width</span><input type="number" data-mps="pathR" min=".5" max="6" step=".25" value="${s.pathR}"></label><label class="fld"><span>Markings every</span><input type="number" data-mps="dotEvery" min="0" max="40" step="1" value="${s.dotEvery}"><small class="help">0 = none</small></label><label class="fld"><span>Path ahead width</span><input type="number" data-mps="futureR" min=".25" max="4" step=".25" value="${s.futureR}"></label></div>
  <div class="seg-row"><button class="btn" data-mp="eraseTrail">Remove the painted trail everywhere</button><button class="btn primary" data-mp="paintTrail">Paint the trail along the stops</button></div>
  <p class="help">Trail colors that “Remove” and the trail eraser look for: ${MP.trailCols.map(c => `<span class="sw-i" style="background:${c}" title="${c}"></span>`).join('')} <button class="btn sm subtle" data-mp="addTrailCol">Add the current color</button> <button class="btn sm subtle" data-mp="resetTrailCol">Reset</button></p>
  <div class="grid"><label class="fld chk"><input type="checkbox" id="mpCarry" ${MP.carry ? 'checked' : ''}><span>Carry the painted patch when a stop moves</span></label><label class="fld range"><span>Patch size <output id="mpRadO">${MP.radius}°</output></span><input type="range" id="mpRad" min="3" max="16" step=".5" value="${MP.radius}"></label></div>`
 )}
 ${card('On the sphere', `<div class="mp-globe"><canvas id="mpGlobe" width="240" height="300"></canvas><div><p class="help">How the selected stop looks from the game’s map camera. Click a stop on the flat map to look at it.</p><label class="fld range"><span>Height <output id="mpAltO"></output></span><input type="range" id="mpAlt" min=".08" max=".6" step=".01" value=".34"></label></div></div>`)}</div>`;
}
function mpHint() {
  return {
    brush: 'Paint with the color. Alt-click to pick a color.',
    pick: 'Click to take a color from the map.',
    fill: 'Fill a connected area of one color.',
    clone: 'Alt-click (or right-click) to set where to copy from, then paint.',
    terrain: 'Paint over something to replace it with the terrain around it.',
    trailErase: 'Paint along the old trail: only trail-colored pixels are replaced with terrain.',
    trail: 'Draw a trail by hand in the trail style.',
  }[MP.tool];
}
async function mpMount() {
  const stage = $('#mpStage');
  if (!stage) return;
  let c;
  try {
    c = await atlasGet(WORLD_PATH);
  } catch (e) {
    stage.textContent = e.message;
    return;
  }
  if (!MP.zoom0) {
    MP.zoom = Math.max(1, Math.floor(((stage.clientWidth - 20) / c.width) * 2) / 2);
    MP.zoom0 = 1;
  }
  if (MP.off == null) mpCenter(c);
  mpView();
  mpPalette();
  mpBind();
  mpGlobe();
  mpScrollTo();
}
/* the texture wraps around; turn it so the route sits in the middle instead of across the left/right seam */
function mpCenter(c) {
  const D = ST.D;
  let sx = 0,
    sy = 0;
  D.route.forEach(r => {
    const a = (r.lon || 0) * D2R_;
    sx += Math.cos(a);
    sy += Math.sin(a);
  });
  const lon = Math.atan2(sy, sx) / D2R_;
  MP.off = wrapU(Math.round(((lon / 360 + 1) % 1) * c.width - c.width / 2), c.width);
}
const mpDisp = u => {
  const c = atlasNow(WORLD_PATH);
  return wrapU(u - (MP.off || 0), c ? c.width : 1536);
};
function mpScrollTo() {
  const st = $('#mpStage'),
    c = atlasNow(WORLD_PATH);
  if (!st || !c) return;
  const sel = ST.sel.stop,
    o = typeof sel === 'string' ? ST.D.regions[+sel.slice(1)] : ST.D.route[typeof sel === 'number' ? sel : 0];
  if (!o) return;
  const [u, v] = uvOf(llv_(o.lon || 0, o.lat || 0), c.width, c.height);
  st.scrollLeft = mpDisp(u) * MP.zoom - st.clientWidth / 2;
  st.scrollTop = v * MP.zoom - st.clientHeight / 2;
}
function mpDraw(c) {
  const v = $('#mpCv');
  if (!v) return;
  const x = v.getContext('2d'),
    o = MP.off || 0;
  x.drawImage(c, -o, 0);
  if (o) x.drawImage(c, c.width - o, 0);
}
function mpView() {
  const c = atlasNow(WORLD_PATH),
    v = $('#mpCv');
  if (!c || !v) return;
  if (v.width !== c.width) {
    v.width = c.width;
    v.height = c.height;
  }
  mpDraw(c);
  $('#mpWrap').style.width = c.width * MP.zoom + 'px';
  $('#mpWrap').style.height = c.height * MP.zoom + 'px';
  $('#mpZoom').textContent = MP.zoom + '×';
  mpMarkers();
}
function mpMarkers() {
  const svg = $('#mpSvg'),
    c = atlasNow(WORLD_PATH);
  if (!svg || !c) return;
  const [W, H] = [c.width, c.height],
    D = ST.D;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  let h = '';
  gamePath().forEach(s => {
    let d = '',
      prev = null;
    s.pts.forEach(p => {
      let [u, v] = uvOf(p, W, H);
      u = mpDisp(u);
      d += (prev != null && Math.abs(u - prev) < W / 2 ? 'L' : 'M') + u.toFixed(1) + ' ' + v.toFixed(1);
      prev = u;
    });
    h += `<path d="${d}" class="mp-path ${s.locked ? 'lk' : ''}"/>`;
  });
  const mk = (lon, lat, id, label, full, cls) => {
    let [u, v] = uvOf(llv_(lon, lat), W, H);
    u = mpDisp(u);
    const z = MP.zoom;
    return `<g class="mk ${cls}" data-mk="${id}" transform="translate(${u.toFixed(1)},${v.toFixed(1)})"><title>${esc(full)}</title><circle r="${(6 / z).toFixed(2)}" style="stroke-width:${(2 / z).toFixed(2)}"/><text y="${(-10 / z).toFixed(2)}" style="font-size:${(12 / z).toFixed(2)}px;stroke-width:${(3 / z).toFixed(2)}">${esc(label)}</text></g>`;
  };
  D.regions.forEach((g, i) => {
    if (g.lon != null)
      h += mk(g.lon, g.lat || 0, 'r' + i, g.name, g.name, 'reg' + (ST.sel.stop === 'r' + i ? ' on' : ''));
  });
  D.route.forEach((r, i) => {
    const on = ST.sel.stop === i;
    h += mk(
      r.lon || 0,
      r.lat || 0,
      i,
      on ? `${i + 1}. ${r.name}` : String(i + 1),
      `${i + 1}. ${r.name}`,
      (r.town ? 'town' : '') + (on ? ' on' : '')
    );
  });
  if (MP.src) h += `<circle class="mp-src" cx="${mpDisp(MP.src[0])}" cy="${MP.src[1]}" r="${MP.size}"/>`;
  h += `<circle id="mpCursor" class="mp-cur" r="${MP.size / 2}" cx="-99" cy="-99"/>`;
  svg.innerHTML = h;
}
function mpPalette() {
  const c = atlasNow(WORLD_PATH);
  if (!c) return;
  const d = new Uint32Array(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.buffer),
    cnt = new Map();
  for (let i = 0; i < d.length; i += 7) cnt.set(d[i], (cnt.get(d[i]) || 0) + 1);
  $('#mpPal').innerHTML = [...cnt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([k]) => {
      const h = c32hex(k);
      return `<button class="sw" style="background:${h}" data-mp="sw" data-c="${h}" title="${h}"></button>`;
    })
    .join('');
}
/* ---------- pixels ---------- */
function mpData() {
  const c = atlasNow(WORLD_PATH),
    x = c.getContext('2d'),
    img = x.getImageData(0, 0, c.width, c.height);
  return { c, x, img, d: new Uint32Array(img.data.buffer), W: c.width, H: c.height };
}
function mpCommitPixels(P) {
  P.x.putImageData(P.img, 0, 0);
  markArt(WORLD_PATH, P.c);
  mpView();
}
function mpPush() {
  const c = atlasNow(WORLD_PATH);
  MP.undo.push(c.getContext('2d').getImageData(0, 0, c.width, c.height));
  if (MP.undo.length > 12) MP.undo.shift();
  MP.redo = [];
}
function mpUndo() {
  const c = atlasNow(WORLD_PATH);
  if (!MP.undo.length) return toast('Nothing to undo on the map.');
  const x = c.getContext('2d');
  MP.redo.push(x.getImageData(0, 0, c.width, c.height));
  x.putImageData(MP.undo.pop(), 0, 0);
  markArt(WORLD_PATH, c);
  mpView();
  mpGlobe();
}
function mpRedo() {
  const c = atlasNow(WORLD_PATH);
  if (!MP.redo.length) return;
  const x = c.getContext('2d');
  MP.undo.push(x.getImageData(0, 0, c.width, c.height));
  x.putImageData(MP.redo.pop(), 0, 0);
  markArt(WORLD_PATH, c);
  mpView();
  mpGlobe();
}
const wrapU = (u, W) => ((u % W) + W) % W;
/* fill masked pixels from their unmasked neighbors, wave by wave (the most common neighbor color wins) */
function inpaint(d, W, H, mask) {
  let front = [];
  const nb = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const at = (x, y) => y * W + wrapU(x, W);
  for (let i = 0; i < mask.length; i++)
    if (mask[i]) {
      const x = i % W,
        y = (i / W) | 0;
      if (
        nb.some(([dx, dy]) => {
          const yy = y + dy;
          return yy >= 0 && yy < H && !mask[at(x + dx, yy)];
        })
      )
        front.push(i);
    }
  let guard = 0;
  while (front.length && guard++ < 400) {
    const upd = [];
    for (const i of front) {
      const x = i % W,
        y = (i / W) | 0,
        cnt = new Map();
      let best = 0,
        bc = d[i];
      for (const [dx, dy] of nb) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        const j = at(x + dx, yy);
        if (mask[j]) continue;
        const c = d[j],
          n = (cnt.get(c) || 0) + (dx && dy ? 1 : 2);
        cnt.set(c, n);
        if (n > best) {
          best = n;
          bc = c;
        }
      }
      upd.push([i, bc]);
    }
    const nextSet = new Set();
    for (const [i, c] of upd) {
      d[i] = c;
      mask[i] = 0;
    }
    for (const [i] of upd) {
      const x = i % W,
        y = (i / W) | 0;
      for (const [dx, dy] of nb) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        const j = at(x + dx, yy);
        if (mask[j]) nextSet.add(j);
      }
    }
    front = [...nextSet];
  }
}
function trailSet() {
  return new Set(MP.trailCols.map(hex32));
}
function plotDisc(P, v, rad, col) {
  const [cu, cv] = uvOf(v, P.W, P.H),
    lat = Math.asin(clamp(v[1], -1, 1)),
    rx = rad / Math.max(0.2, Math.cos(lat));
  for (let j = -Math.ceil(rad); j <= Math.ceil(rad); j++)
    for (let i = -Math.ceil(rx); i <= Math.ceil(rx); i++) {
      if ((i / rx) ** 2 + (j / rad) ** 2 > 1) continue;
      const X = wrapU(Math.round(cu + i), P.W),
        Y = clamp(Math.round(cv + j), 0, P.H - 1);
      P.d[Y * P.W + X] = col;
    }
}
function paintTrail() {
  const P = mpData(),
    s = MP.style;
  let n = 0;
  gamePath().forEach(sg => {
    for (let k = 0; k < sg.pts.length - 1; k++)
      for (let q = 0; q < 6; q++) {
        const p = v3s.norm(v3s.add(v3s.mul(sg.pts[k], 1 - q / 6), v3s.mul(sg.pts[k + 1], q / 6)));
        n++;
        if (sg.locked) plotDisc(P, p, s.futureR, hex32(s.future));
        else {
          plotDisc(P, p, s.pathR, hex32(s.path));
          if (s.dotEvery > 0 && n % s.dotEvery === 0) plotDisc(P, p, Math.max(0.5, s.pathR * 0.3), hex32(s.dots));
        }
      }
  });
  mpCommitPixels(P);
}
function eraseTrailAll() {
  const P = mpData(),
    T = trailSet(),
    mask = new Uint8Array(P.W * P.H);
  let n = 0;
  for (let i = 0; i < P.d.length; i++)
    if (T.has(P.d[i])) {
      mask[i] = 1;
      n++;
    }
  inpaint(P.d, P.W, P.H, mask);
  mpCommitPixels(P);
  return n;
}
/* move a stop's painted patch: keep only colors that stand out from the ring around it, rotate them to the new spot */
function carryPatch(lon0, lat0, lon1, lat1) {
  const P = mpData(),
    { W, H, d } = P,
    R = MP.radius * D2R_,
    c0 = llv_(lon0, lat0),
    c1 = llv_(lon1, lat1),
    cosR = Math.cos(R),
    cosR2 = Math.cos(R * 1.35),
    T = trailSet();
  const box = (lat, lon, r) => {
    const v0 = Math.max(0, Math.floor((0.5 - (lat + r) / Math.PI) * H) - 1),
      v1 = Math.min(H - 1, Math.ceil((0.5 - (lat - r) / Math.PI) * H) + 1),
      cl = Math.max(0.15, Math.cos(Math.min(Math.PI / 2 - 0.01, Math.abs(lat) + r))),
      du = Math.ceil((r / cl / (Math.PI * 2)) * W) + 2,
      uc = Math.round(((lon / (Math.PI * 2) + 1) % 1) * W);
    return { v0, v1, u0: uc - du, u1: uc + du };
  };
  const L0 = lat0 * D2R_,
    O0 = lon0 * D2R_,
    b0 = box(L0, O0, R * 1.35),
    ring = new Map();
  let rn = 0;
  for (let v = b0.v0; v <= b0.v1; v++)
    for (let u = b0.u0; u <= b0.u1; u++) {
      const x = wrapU(u, W),
        dd = v3s.dot(dirOf(x, v, W, H), c0);
      if (dd < cosR && dd >= cosR2) {
        const c = d[v * W + x];
        ring.set(c, (ring.get(c) || 0) + 1);
        rn++;
      }
    }
  const bg = new Set([...ring.entries()].filter(([c, n]) => n >= rn * 0.02).map(([c]) => c));
  const mask = new Uint8Array(W * H),
    src = new Map();
  for (let v = b0.v0; v <= b0.v1; v++)
    for (let u = b0.u0; u <= b0.u1; u++) {
      const x = wrapU(u, W),
        i = v * W + x;
      if (v3s.dot(dirOf(x, v, W, H), c0) < cosR) continue;
      const c = d[i];
      if (bg.has(c) || T.has(c)) continue;
      mask[i] = 1;
      src.set(i, c);
    }
  if (!src.size) return 0;
  inpaint(d, W, H, mask);
  const axis = v3s.cross(c1, c0),
    s = Math.hypot(...axis),
    cth = v3s.dot(c1, c0),
    ax = s > 1e-9 ? v3s.mul(axis, 1 / s) : [0, 1, 0],
    rot = p => {
      const kxp = v3s.cross(ax, p),
        kdp = v3s.dot(ax, p);
      return v3s.add(v3s.add(v3s.mul(p, cth), v3s.mul(kxp, s)), v3s.mul(ax, kdp * (1 - cth)));
    };
  const L1 = lat1 * D2R_,
    O1 = lon1 * D2R_,
    b1 = box(L1, O1, R);
  let n = 0;
  for (let v = b1.v0; v <= b1.v1; v++)
    for (let u = b1.u0; u <= b1.u1; u++) {
      const x = wrapU(u, W),
        t = dirOf(x, v, W, H);
      if (v3s.dot(t, c1) < cosR) continue;
      const sp = rot(t),
        [su, sv] = uvOf(sp, W, H),
        si = clamp(Math.floor(sv), 0, H - 1) * W + wrapU(Math.floor(su), W),
        c = src.get(si);
      if (c != null) {
        d[v * W + x] = c;
        n++;
      }
    }
  mpCommitPixels(P);
  return n;
}
/* ---------- brush strokes ---------- */
function mpStamp(P, cx, cy, stroke) {
  const r = MP.size / 2,
    T = MP.tool,
    col = hex32(MP.color),
    trail = T === 'trailErase' ? trailSet() : null,
    mask = T === 'terrain' || T === 'trailErase' ? new Uint8Array(P.W * P.H) : null;
  let any = false;
  for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++)
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
      if ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2 > r * r + 0.25) continue;
      if (j < 0 || j >= P.H) continue;
      const k = j * P.W + wrapU(i, P.W);
      if (T === 'brush') P.d[k] = col;
      else if (T === 'trail') P.d[k] = hex32(MP.style.path);
      else if (T === 'clone' && MP.src) {
        const sx = wrapU(Math.round(i + stroke.off[0]), P.W),
          sy = clamp(Math.round(j + stroke.off[1]), 0, P.H - 1);
        P.d[k] = stroke.snap[sy * P.W + sx];
      } else if (mask && (!trail || trail.has(P.d[k]))) {
        mask[k] = 1;
        any = true;
      }
    }
  if (mask && any) inpaint(P.d, P.W, P.H, mask);
}
function mpFill(P, x, y) {
  x = wrapU(x, P.W);
  const t = P.d[y * P.W + x],
    c = hex32(MP.color);
  if (t === c) return;
  const st = [[x, y]];
  let n = 0;
  while (st.length && n < 400000) {
    const [px, py] = st.pop();
    if (py < 0 || py >= P.H) continue;
    const X = wrapU(px, P.W),
      i = py * P.W + X;
    if (P.d[i] !== t) continue;
    P.d[i] = c;
    n++;
    st.push([X + 1, py], [X - 1, py], [X, py + 1], [X, py - 1]);
  }
}
function mpBind() {
  const w = $('#mpWrap');
  if (!w || w._b) return;
  w._b = 1;
  let stroke = null;
  const pos = ev => {
    const r = w.getBoundingClientRect(),
      c = atlasNow(WORLD_PATH),
      xd = ((ev.clientX - r.left) / r.width) * c.width;
    return [xd + (MP.off || 0), ((ev.clientY - r.top) / r.height) * c.height, xd];
  };
  w.addEventListener('contextmenu', ev => ev.preventDefault());
  w.addEventListener('pointerdown', ev => {
    const mkEl = ev.target.closest('[data-mk]');
    const [x, y] = pos(ev);
    if (mkEl) {
      const id = mkEl.dataset.mk,
        o = id.startsWith('r') ? ST.D.regions[+id.slice(1)] : ST.D.route[+id];
      ST.sel.stop = id.startsWith('r') ? id : +id;
      stroke = { mk: o, lon0: o.lon || 0, lat0: o.lat || 0 };
      w.setPointerCapture(ev.pointerId);
      mpMarkers();
      mpGlobe();
      return;
    }
    if (MP.tool === 'pick' || (ev.altKey && MP.tool !== 'clone')) {
      const P = mpData(),
        c = P.d[clamp(Math.floor(y), 0, P.H - 1) * P.W + wrapU(Math.floor(x), P.W)];
      mpSetColor(c32hex(c));
      return;
    }
    if (MP.tool === 'clone' && (ev.altKey || ev.button === 2)) {
      MP.src = [x, y];
      mpMarkers();
      toast('Copying from here.');
      return;
    }
    if (MP.tool === 'clone' && !MP.src) return toast('Alt-click (or right-click) where to copy from first.');
    mpPush();
    const P = mpData();
    if (MP.tool === 'fill') {
      mpFill(P, Math.floor(x), Math.floor(y));
      mpCommitPixels(P);
      mpGlobe();
      return;
    }
    stroke = {
      P,
      last: [x, y],
      off: MP.src ? [MP.src[0] - x, MP.src[1] - y] : [0, 0],
      snap: MP.tool === 'clone' ? P.d.slice() : null,
    };
    w.setPointerCapture(ev.pointerId);
    mpStamp(P, x, y, stroke);
    P.x.putImageData(P.img, 0, 0);
    mpDraw(P.c);
  });
  w.addEventListener('pointermove', ev => {
    const [x, y, xd] = pos(ev),
      cur = $('#mpCursor');
    if (cur) {
      cur.setAttribute('cx', xd);
      cur.setAttribute('cy', y);
      cur.setAttribute('r', MP.size / 2);
    }
    if (!stroke) return;
    if (stroke.mk) {
      const c = atlasNow(WORLD_PATH),
        lon = Math.round((((x / c.width) * 360 + 180) % 360) - 180),
        lat = Math.round(90 - (y / c.height) * 180);
      stroke.mk.lon = lon;
      stroke.mk.lat = clamp(lat, -80, 80);
      mpMarkers();
      return;
    }
    const [lx, ly] = stroke.last,
      dist = Math.hypot(x - lx, y - ly),
      n = Math.max(1, Math.ceil(dist / Math.max(1, MP.size / 3)));
    for (let i = 1; i <= n; i++) mpStamp(stroke.P, lx + ((x - lx) * i) / n, ly + ((y - ly) * i) / n, stroke);
    stroke.last = [x, y];
    stroke.P.x.putImageData(stroke.P.img, 0, 0);
    mpDraw(stroke.P.c);
  });
  const up = () => {
    const s = stroke;
    stroke = null;
    if (!s) return;
    if (s.mk) {
      if (s.mk.lon !== s.lon0 || s.mk.lat !== s.lat0) {
        if (MP.carry) {
          mpPush();
          const n = carryPatch(s.lon0, s.lat0, s.mk.lon, s.mk.lat);
          if (n) toast('Moved the stop and its painted patch.');
        }
        changed();
        commit(true);
      }
      mpMarkers();
      mpGlobe();
      return;
    }
    mpCommitPixels(s.P);
    mpGlobe();
  };
  w.addEventListener('pointerup', up);
  w.addEventListener('pointercancel', up);
  $('#mpStage').addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      MP.zoom = clamp(MP.zoom + (ev.deltaY < 0 ? 0.5 : -0.5), 0.5, 8);
      mpView();
    },
    { passive: false }
  );
  $('#mpSize').addEventListener('input', e => {
    MP.size = +e.target.value;
    $('#mpSizeO').textContent = MP.size;
  });
  $('#mpColor').addEventListener('input', e => mpSetColor(e.target.value));
  $('#mpCarry').addEventListener('change', e => (MP.carry = e.target.checked));
  $('#mpRad').addEventListener('input', e => {
    MP.radius = +e.target.value;
    $('#mpRadO').textContent = MP.radius + '°';
  });
  $('#mpAlt').addEventListener('input', () => mpGlobe());
  $$('[data-mps]').forEach(el =>
    el.addEventListener('input', () => {
      const k = el.dataset.mps;
      MP.style[k] = el.type === 'color' ? el.value.toUpperCase() : +el.value;
    })
  );
}
function mpSetColor(h) {
  MP.color = h.toUpperCase();
  const c = $('#mpColor');
  if (c) c.value = MP.color;
  if (MP.tool === 'pick') {
    MP.tool = 'brush';
    render();
  }
}
document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-mp]');
  if (!el) return;
  const a = el.dataset.mp;
  if (a === 'tool') {
    MP.tool = el.dataset.t;
    $$('[data-mp=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === MP.tool));
    $('#mpHint').textContent = mpHint();
  } else if (a === 'zoom') {
    MP.zoom = clamp(MP.zoom + +el.dataset.z, 0.5, 8);
    mpView();
  } else if (a === 'undo') mpUndo();
  else if (a === 'redo') mpRedo();
  else if (a === 'sw') mpSetColor(el.dataset.c);
  else if (a === 'paintTrail') {
    mpPush();
    paintTrail();
    mpGlobe();
    toast('Trail painted along the stops. Save to game to keep it.');
  } else if (a === 'eraseTrail') {
    if (!(await ask('Replace every trail-colored pixel with the terrain around it?', 'Remove the trail'))) return;
    mpPush();
    const n = eraseTrailAll();
    mpGlobe();
    toast(n ? `Removed ${fmtN(n)} trail pixels.` : 'No trail-colored pixels found.');
  } else if (a === 'addTrailCol') {
    if (!MP.trailCols.includes(MP.color)) MP.trailCols.push(MP.color);
    render();
  } else if (a === 'resetTrailCol') {
    MP.trailCols = ['#8A6A3E', '#E2C48A', '#F0E6C8'];
    render();
  }
});
document.addEventListener(
  'keydown',
  ev => {
    if (!$('#mpWrap') || ev.target.closest('input,select,textarea') || $('#modal').innerHTML || $('#dlg').innerHTML)
      return;
    const k = ev.key.toLowerCase(),
      mod = ev.ctrlKey || ev.metaKey;
    if (mod && k === 'z') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.shiftKey ? mpRedo() : mpUndo();
      return;
    }
    if (mod && k === 'y') {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      mpRedo();
      return;
    }
    if (mod) return;
    const T = { b: 'brush', i: 'pick', f: 'fill', c: 'clone', t: 'terrain', e: 'trailErase', r: 'trail' };
    if (T[k]) {
      MP.tool = T[k];
      $$('[data-mp=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === MP.tool));
      $('#mpHint').textContent = mpHint();
    }
  },
  true
);
/* ---------- in-sphere preview (the game's map camera, without clouds) ---------- */
function mpGlobe() {
  const cv = $('#mpGlobe'),
    tex = atlasNow(WORLD_PATH);
  if (!cv || !tex) return;
  const D = ST.D,
    sel = ST.sel.stop,
    o = typeof sel === 'string' ? D.regions[+sel.slice(1)] : D.route[typeof sel === 'number' ? sel : 0];
  if (!o || o.lon == null) return;
  const W = tex.width,
    H = tex.height,
    T = new Uint32Array(tex.getContext('2d').getImageData(0, 0, W, H).data.buffer),
    MW = 120,
    MH = 150,
    x = cv.getContext('2d'),
    img = x.createImageData(MW, MH),
    buf = new Uint32Array(img.data.buffer);
  const P = llv_(o.lon, o.lat || 0),
    Q = llv_((o.lon || 0) + 2, o.lat || 0),
    U = v3s.mul(P, -1);
  let F = v3s.add(Q, v3s.mul(P, -1));
  F = v3s.norm(v3s.add(F, v3s.mul(U, -v3s.dot(F, U))));
  const alt = +($('#mpAlt') || { value: 0.34 }).value;
  $('#mpAltO') && ($('#mpAltO').textContent = alt.toFixed(2));
  const C = v3s.add(v3s.add(P, v3s.mul(U, alt)), v3s.mul(F, -alt * 1.55)),
    dp = v3s.norm(v3s.add(P, v3s.mul(C, -1))),
    ds = v3s.norm(v3s.mul(C, -1)),
    w = clamp(0.44 * Math.min(1, alt / 0.3), 0, 1),
    fw = v3s.norm(v3s.add(v3s.mul(dp, 1 - w), v3s.mul(ds, w))),
    rt = v3s.norm(v3s.cross(fw, U)),
    up = v3s.cross(rt, fw),
    foc = MW * 0.6,
    cc = v3s.dot(C, C);
  for (let j = 0; j < MH; j++)
    for (let i = 0; i < MW; i++) {
      const dx = (i + 0.5 - MW / 2) / foc,
        dy = (MH / 2 - j - 0.5) / foc,
        d = v3s.norm([
          fw[0] + rt[0] * dx + up[0] * dy,
          fw[1] + rt[1] * dx + up[1] * dy,
          fw[2] + rt[2] * dx + up[2] * dy,
        ]),
        b = v3s.dot(C, d),
        ts = -b + Math.sqrt(b * b - cc + 1),
        p = v3s.add(C, v3s.mul(d, ts)),
        [u, v] = uvOf(p, W, H);
      let c = T[clamp(Math.floor(v), 0, H - 1) * W + wrapU(Math.floor(u), W)];
      const f = clamp(1 - Math.exp(-Math.max(0, ts - 0.3) * 0.72), 0, 0.86),
        r = c & 255,
        g = (c >> 8) & 255,
        bb = (c >> 16) & 255;
      buf[j * MW + i] = (255 << 24) | ((bb + (236 - bb) * f) << 16) | ((g + (186 - g) * f) << 8) | (r + (176 - r) * f);
    }
  const tmp = cnv(MW, MH);
  tmp.getContext('2d').putImageData(img, 0, 0);
  x.imageSmoothingEnabled = false;
  x.drawImage(tmp, 0, 0, cv.width, cv.height);
}
