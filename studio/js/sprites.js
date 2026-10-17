'use strict';
/* ================= POCKET BILLIES STUDIO · sprites =================
   Billionaire art lives in four atlases per species (front, back, and their Gold-Plated versions), cut into
   parts by art/rigs.js. The Studio loads those atlases into editable canvases, assembles the skeleton exactly like
   the game does, animates previews, and provides the pixel editor, gold regeneration and recoloring. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/bridge.js';
import { openSkeleton, provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { cnv } from '../../game/js/art.js';
import { animFor } from '../../game/js/anim.js';
import { drawRig, rigPose } from '../../game/js/rig.js';
import { ST, ask, render, spName, toast, updTop } from './core.js';
/* eslint-disable no-func-assign */
expose({
  ATL: [() => ATL],
  ATL_VER: [() => ATL_VER, v => (ATL_VER = v)],
  ATL_WAIT: [() => ATL_WAIT],
  FACE_N: [() => FACE_N],
  GOLD_RAMP: [() => GOLD_RAMP],
  PREV: [() => PREV],
  PX_ED: [() => PX_ED],
  RIGB: [() => RIGB],
  atlasGet: [() => atlasGet, v => (atlasGet = v)],
  atlasNow: [() => atlasNow],
  atlasPath: [() => atlasPath],
  canvasCopy: [() => canvasCopy, v => (canvasCopy = v)],
  downloadCanvas: [() => downloadCanvas, v => (downloadCanvas = v)],
  drawPrev: [() => drawPrev, v => (drawPrev = v)],
  fileToCanvas: [() => fileToCanvas, v => (fileToCanvas = v)],
  goldFrom: [() => goldFrom, v => (goldFrom = v)],
  hsv2rgb: [() => hsv2rgb, v => (hsv2rgb = v)],
  hueShift: [() => hueShift, v => (hueShift = v)],
  loadImage: [() => loadImage, v => (loadImage = v)],
  lumOf: [() => lumOf],
  markArt: [() => markArt, v => (markArt = v)],
  mountPreviews: [() => mountPreviews, v => (mountPreviews = v)],
  openPixelEditor: [() => openPixelEditor, v => (openPixelEditor = v)],
  partsOf: [() => partsOf, v => (partsOf = v)],
  pickFile: [() => pickFile, v => (pickFile = v)],
  prevAct: [() => prevAct, v => (prevAct = v)],
  prevCanvas: [() => prevCanvas, v => (prevCanvas = v)],
  prevLoop: [() => prevLoop, v => (prevLoop = v)],
  prevOn: [() => prevOn, v => (prevOn = v)],
  previewsDirty: [() => previewsDirty, v => (previewsDirty = v)],
  pxBind: [() => pxBind, v => (pxBind = v)],
  pxBindCanvas: [() => pxBindCanvas, v => (pxBindCanvas = v)],
  pxBones: [() => pxBones, v => (pxBones = v)],
  pxCanvas: [() => pxCanvas, v => (pxCanvas = v)],
  pxChanged: [() => pxChanged, v => (pxChanged = v)],
  pxDraw: [() => pxDraw, v => (pxDraw = v)],
  pxFill: [() => pxFill, v => (pxFill = v)],
  pxKeys: [() => pxKeys, v => (pxKeys = v)],
  pxLine: [() => pxLine, v => (pxLine = v)],
  pxLoad: [() => pxLoad, v => (pxLoad = v)],
  pxLoadTools: [() => pxLoadTools, v => (pxLoadTools = v)],
  pxPalette: [() => pxPalette, v => (pxPalette = v)],
  pxPath: [() => pxPath, v => (pxPath = v)],
  pxPlot: [() => pxPlot, v => (pxPlot = v)],
  pxPos: [() => pxPos, v => (pxPos = v)],
  pxPush: [() => pxPush, v => (pxPush = v)],
  pxRedo: [() => pxRedo, v => (pxRedo = v)],
  pxSetColor: [() => pxSetColor, v => (pxSetColor = v)],
  pxUndo: [() => pxUndo, v => (pxUndo = v)],
  rampAt: [() => rampAt, v => (rampAt = v)],
  rgb2hsv: [() => rgb2hsv, v => (rgb2hsv = v)],
  rigFor: [() => rigFor, v => (rigFor = v)],
  spriteCacheClear: [() => spriteCacheClear, v => (spriteCacheClear = v)],
});
/* eslint-enable no-func-assign */
provide({ mountPreviews, spriteCacheClear });
/* to-module: end */
export const ATL = new Map(); /* path -> canvas */
const ATL_WAIT = new Map();
const RIGB = new Map(); /* key -> {ver,R} */
export let ATL_VER = 0;
export const atlasPath = (sp, view, gold) => {
  const m = ST.rigs && ST.rigs[sp] && ST.rigs[sp][view];
  if (m && m.sheet) return 'art/' + (gold ? m.sheet.replace(/\.png$/, '_gold.png') : m.sheet);
  return `art/billionaires/${sp}${view === 'back' ? '_back' : ''}${gold ? '_gold' : ''}.png`;
};
export function spriteCacheClear() {
  RIGB.clear();
  ATL_VER++;
}
export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not load ' + src));
    im.src = src;
  });
}
export function atlasGet(path) {
  if (ST.artDirty.has(path)) return Promise.resolve(ST.artDirty.get(path));
  if (ATL.has(path)) return Promise.resolve(ATL.get(path));
  if (ATL_WAIT.has(path)) return ATL_WAIT.get(path);
  const p = loadImage('../game/' + path + '?v=' + Date.now())
    .then(im => {
      const c = cnv(im.naturalWidth, im.naturalHeight);
      c.getContext('2d').drawImage(im, 0, 0);
      ATL.set(path, c);
      ATL_WAIT.delete(path);
      return c;
    })
    .catch(e => {
      ATL_WAIT.delete(path);
      throw e;
    });
  ATL_WAIT.set(path, p);
  return p;
}
export const atlasNow = path => ST.artDirty.get(path) || ATL.get(path) || null;
/* assemble a skeleton like rig.js rigParts(), but from the Studio's editable atlas */
export function rigFor(sp, view, gold) {
  const path = atlasPath(sp, view, gold),
    atlas = atlasNow(path);
  if (!atlas) {
    atlasGet(path).catch(() => {});
    return null;
  }
  const meta = ST.rigs[sp] && ST.rigs[sp][view];
  if (!meta) return null;
  const key = path,
    ver = (ST.rigVer || 0) + ':' + ATL_VER + ':' + (atlas._ver || 0),
    hit = RIGB.get(key);
  if (hit && hit.ver === ver) return hit.R;
  const cut = ([x, y, w, h]) => {
    const c = cnv(Math.max(1, w), Math.max(1, h));
    c.getContext('2d').drawImage(atlas, x, y, w, h, 0, 0, w, h);
    return c;
  };
  const imgs = meta.imgs.map(e => {
    const names = Object.keys(e.f);
    if (names.length === 1 && names[0] === 'main') return { ox: e.ox, oy: e.oy, c: cut(e.f.main) };
    const v = {};
    names.forEach(n => (v[n] = cut(e.f[n])));
    return { ox: e.ox, oy: e.oy, v, c: v.idle || v[names[0]] };
  });
  const bones = meta.bones.map(b => Object.assign({}, b, { img: b.i >= 0 ? imgs[b.i] : null }));
  const R = {
    k: meta.k,
    BW: meta.BW,
    BH: meta.BH,
    cx: meta.cx,
    base: meta.base,
    tipX: meta.tipX,
    plan: meta.plan,
    geo: meta.geo,
    bones,
    anim: animFor(meta.plan, meta.q || {}),
  };
  RIGB.set(key, { ver, R });
  return R;
}
/* ---------- previews ---------- */
const PREV = new Set();
let prevOn = false;
export function prevCanvas(o) {
  return `<canvas class="spr-prev ${o.cls || ''}" data-prev='${esc(JSON.stringify(o))}' width="10" height="10"></canvas>`;
}
export function mountPreviews(root = document) {
  $$('canvas[data-prev]', root).forEach(c => {
    if (c._p) return;
    const o = JSON.parse(c.dataset.prev);
    c._p = { ...o, seed: Math.random() * 6, t0: performance.now(), act: o.act || null };
    PREV.add(c);
    drawPrev(c, performance.now());
  });
  if (!prevOn) {
    prevOn = true;
    requestAnimationFrame(prevLoop);
  }
}
export function prevAct(c, act) {
  if (c && c._p) {
    c._p.act = act;
    c._p.t0 = performance.now();
  }
}
function drawPrev(c, ts) {
  const o = c._p,
    R = rigFor(o.sp, o.view || 'front', !!o.gold);
  const x = c.getContext('2d');
  if (!R) {
    if (!o.miss) {
      o.miss = 1;
      atlasGet(atlasPath(o.sp, o.view || 'front', !!o.gold))
        .then(() => {
          o.miss = 0;
          drawPrev(c, performance.now());
        })
        .catch(() => {
          x.clearRect(0, 0, c.width, c.height);
          c.classList.add('missing');
        });
    }
    return;
  }
  if (c.width !== R.BW || c.height !== R.BH) {
    c.width = R.BW;
    c.height = R.BH;
  }
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  const tau = ts - o.t0,
    act = o.act && (o.act === 'faint' || tau < 1100) ? o.act : null;
  if (o.act && !act && o.loop) o.t0 = ts;
  drawRig(x, R, rigPose(act, tau, o.still ? 0 : ts, o.seed), o.view || 'front');
  o.drawn = 1;
}
function prevLoop(ts) {
  let any = false;
  for (const c of PREV) {
    if (!c.isConnected) {
      PREV.delete(c);
      continue;
    }
    any = true;
    if (c._p.still && c._p.drawn && !c._p.dirty) continue;
    c._p.dirty = 0;
    drawPrev(c, ts);
  }
  if (any) requestAnimationFrame(prevLoop);
  else prevOn = false;
}
export function previewsDirty() {
  for (const c of PREV) c._p.dirty = 1;
}
/* ---------- color tools ---------- */
const lumOf = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const GOLD_RAMP = [
  [0, [64, 40, 14]],
  [0.35, [150, 100, 30]],
  [0.6, [214, 162, 58]],
  [0.8, [244, 206, 110]],
  [1, [255, 246, 206]],
];
function rampAt(L) {
  for (let i = 1; i < GOLD_RAMP.length; i++) {
    const [a, ca] = GOLD_RAMP[i - 1],
      [b, cb] = GOLD_RAMP[i];
    if (L <= b) {
      const t = (L - a) / (b - a);
      return ca.map((v, k) => v + (cb[k] - v) * t);
    }
  }
  return GOLD_RAMP[GOLD_RAMP.length - 1][1];
}
/* Gold-Plated version from the normal art: tint toward a gold ramp by brightness; outlines, eyes and highlights keep most of their color */
export function goldFrom(src, strength = 0.6) {
  const c = cnv(src.width, src.height),
    x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const r = d[i],
      g = d[i + 1],
      b = d[i + 2],
      L = lumOf(r, g, b),
      mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      sat = mx ? (mx - mn) / mx : 0;
    let k = strength;
    if (L < 0.13) k *= 0.3;
    else if (L > 0.93) k *= 0.35;
    if (b > r * 1.6 && b > g * 1.25 && sat > 0.45) k *= 0.15;
    const t = rampAt(L);
    d[i] = r + (t[0] - r) * k;
    d[i + 1] = g + (t[1] - g) * k;
    d[i + 2] = b + (t[2] - b) * k;
  }
  x.putImageData(im, 0, 0);
  return c;
}
function rgb2hsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
/* recolor: rotate the hue of colorful pixels (skin-ish and grey pixels are left alone when protectSkin is on) */
export function hueShift(src, deg, satK = 1, protectSkin = true) {
  const c = cnv(src.width, src.height),
    x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  if (!deg && satK === 1) return c;
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, v] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    if (s < 0.12) continue;
    if (protectSkin && h > 12 && h < 42 && s < 0.55 && v > 0.45) continue;
    const [r, g, b] = hsv2rgb((h + deg + 360) % 360, clamp(s * satK, 0, 1), v);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  x.putImageData(im, 0, 0);
  return c;
}
function canvasCopy(src) {
  const c = cnv(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
export function markArt(path, c) {
  c._ver = (c._ver || 0) + 1;
  ATL_VER++;
  ST.artDirty.set(path, c);
  ATL.set(path, c);
  updTop();
  previewsDirty();
}
export function downloadCanvas(c, name) {
  c.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => res(i.files[0] || null);
    i.click();
  });
}
export async function fileToCanvas(f) {
  const url = URL.createObjectURL(f);
  try {
    const im = await loadImage(url);
    const c = cnv(im.naturalWidth, im.naturalHeight);
    c.getContext('2d').drawImage(im, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
/* ================= PIXEL EDITOR ================= */
export const PX_ED = {};
const FACE_N = { idle: 'face', blink: 'blink', happy: 'happy', hurt: 'hurt', shout: 'shout', main: '' };
function partsOf(sp, view) {
  const meta = ST.rigs[sp] && ST.rigs[sp][view];
  if (!meta) return [];
  const out = [];
  meta.imgs.forEach((e, i) => {
    const bones = meta.bones.filter(b => b.i === i).map(b => b.n);
    Object.entries(e.f).forEach(([v, r]) =>
      out.push({ i, v, r, label: (bones.join(', ') || 'part ' + i) + (v !== 'main' ? ` (${FACE_N[v] || v})` : '') })
    );
  });
  return out;
}
export async function openPixelEditor(sp, view = 'front', gold = false, focus = null) {
  const E = PX_ED;
  Object.assign(E, {
    sp,
    view,
    gold,
    tool: 'pen',
    color: '#2A1E2E',
    zoom: 0,
    undo: [],
    redo: [],
    grid: true,
    parts: true,
    act: 'idle',
    hover: null,
    focus,
    back: null,
  });
  try {
    await Promise.all([
      atlasGet(atlasPath(sp, 'front', false)),
      atlasGet(atlasPath(sp, 'back', false)),
      atlasGet(atlasPath(sp, 'front', true)).catch(() => null),
      atlasGet(atlasPath(sp, 'back', true)).catch(() => null),
    ]);
  } catch (e) {
    toast(e.message, 'err');
    return;
  }
  const m = $('#modal');
  m.innerHTML = `<div class="pxed" role="dialog" aria-modal="true" aria-label="Pixel editor">
 <header class="px-top"><b>${esc(spName(sp))}</b><span class="px-tabs">${[
   ['front', 0, 'Front'],
   ['back', 0, 'Back'],
   ['front', 1, 'Front · golden'],
   ['back', 1, 'Back · golden'],
 ]
   .map(([v, g, l]) => `<button class="seg" data-pe="atlas" data-v="${v}" data-g="${g}">${l}</button>`)
   .join('')}</span>
  <span class="px-tools">${[
    ['pen', 'Pencil', 'P'],
    ['erase', 'Eraser', 'E'],
    ['fill', 'Fill', 'F'],
    ['pick', 'Pick color', 'I'],
  ]
    .map(([k, l, s]) => `<button class="seg" data-pe="tool" data-t="${k}" title="${l} (${s})">${l}</button>`)
    .join('')}</span>
  <span class="px-tools"><button class="seg" data-pe="zoom" data-z="-1" title="Zoom out (−)">−</button><span id="pxZoom"></span><button class="seg" data-pe="zoom" data-z="1" title="Zoom in (+)">+</button><button class="seg" data-pe="grid" title="Pixel grid">Grid</button><button class="seg" data-pe="parts" title="Part outlines">Parts</button></span>
  <span class="px-tools"><button class="seg" data-pe="undo" title="Undo (Ctrl+Z)">↶</button><button class="seg" data-pe="redo" title="Redo (Ctrl+Y)">↷</button></span>
  <span class="grow"></span><button class="btn" data-pe="skel" title="Add, move and connect body parts">Skeleton builder</button><button class="btn" data-pe="close">Done</button></header>
 <div class="px-body"><div class="px-stage" id="pxStage"><div class="px-wrap" id="pxWrap"><canvas id="pxCv"></canvas><div class="px-grid" id="pxGrid"></div><svg id="pxParts"></svg></div></div>
 <aside class="px-side">
  <div class="px-sec"><h4>Color</h4><div class="px-color"><input type="color" id="pxColor" value="${E.color}"><span id="pxHex">${E.color}</span></div><div class="px-pal" id="pxPal"></div></div>
  <div class="px-sec"><h4>Preview</h4><div class="px-prev"><canvas id="pxPrev"></canvas></div><div class="seg-row">${['idle', 'attack', 'cast', 'hurt', 'cheer', 'faint'].map(a => `<button class="seg sm" data-pe="act" data-a="${a}">${a}</button>`).join('')}</div></div>
  <div class="px-sec"><h4>Under the cursor</h4><p class="px-hover" id="pxHover">Point at a part of the sheet.</p></div>
  <div class="px-sec" id="pxGoldSec"><h4>Golden version</h4><p class="help">Rebuild the gold sheet from the normal one. Hand edits on the gold sheet are replaced.</p><label class="fld range"><span>Gold strength <output id="pxGS">60%</output></span><input type="range" id="pxGoldK" min="20" max="100" value="60"></label><button class="btn" data-pe="gold">Rebuild gold from normal</button></div>
  <div class="px-sec"><h4>Whole sheet</h4><p class="help">Edit in another app (Aseprite, Photoshop…): download, edit, upload. Keep the size and layout so the parts line up.</p><div class="seg-row"><button class="btn" data-pe="dl">Download PNG</button><button class="btn" data-pe="ul">Upload PNG</button></div><button class="btn subtle" data-pe="revert">Revert to the saved file</button></div>
  <div class="px-sec"><h4>Skeleton</h4><p class="help">Nudge where each part attaches and how parts stack. Changes animate live.</p><div id="pxBones"></div></div>
 </aside></div></div>`;
  pxBind();
  pxLoad();
}
function pxPath() {
  return atlasPath(PX_ED.sp, PX_ED.view, PX_ED.gold);
}
function pxCanvas() {
  return atlasNow(pxPath());
}
function pxLoad() {
  const E = PX_ED,
    c = pxCanvas();
  $$('.pxed [data-pe=atlas]').forEach(b =>
    b.classList.toggle('on', b.dataset.v === E.view && (+b.dataset.g === 1) === E.gold)
  );
  $$('.pxed [data-pe=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === E.tool));
  $('#pxGoldSec').hidden = !E.gold;
  if (!c) {
    $('#pxStage').innerHTML =
      '<p class="help">This sheet doesn’t exist yet. Switch to the normal sheet and use “Rebuild gold from normal”.</p>';
    return;
  }
  if (!$('#pxCv')) {
    $('#pxStage').innerHTML =
      '<div class="px-wrap" id="pxWrap"><canvas id="pxCv"></canvas><div class="px-grid" id="pxGrid"></div><svg id="pxParts"></svg></div>';
    pxBindCanvas();
  }
  if (!E.zoom) {
    const st = $('#pxStage').getBoundingClientRect();
    E.zoom = clamp(Math.floor(Math.min((st.width - 40) / c.width, (st.height - 40) / c.height)), 2, 24);
  }
  E.undo = [];
  E.redo = [];
  if (E.focus) {
    const k = partsOf(E.sp, E.view).findIndex(p => p.i === E.focus.i && (!E.focus.v || p.v === E.focus.v));
    if (k >= 0) {
      E.hover = k;
      const r = partsOf(E.sp, E.view)[k].r;
      E.zoom = Math.max(E.zoom, clamp(Math.floor(220 / Math.max(r[2], r[3])), 2, 16));
      setTimeout(() => {
        const st = $('#pxStage');
        if (st)
          st.scrollTo({
            left: r[0] * E.zoom - st.clientWidth / 2 + (r[2] * E.zoom) / 2 + 20,
            top: r[1] * E.zoom - st.clientHeight / 2 + (r[3] * E.zoom) / 2 + 20,
          });
      }, 30);
    }
  }
  pxDraw();
  pxPalette();
  pxBones();
  const pv = $('#pxPrev');
  pv.dataset.prev = JSON.stringify({
    sp: E.sp,
    view: E.view,
    gold: E.gold,
    act: E.act === 'idle' ? null : E.act,
    loop: 1,
  });
  pv._p = null;
  PREV.delete(pv);
  mountPreviews($('.pxed'));
}
function pxDraw() {
  const E = PX_ED,
    c = pxCanvas(),
    v = $('#pxCv');
  if (!c || !v) return;
  v.width = c.width;
  v.height = c.height;
  const x = v.getContext('2d');
  x.clearRect(0, 0, v.width, v.height);
  x.drawImage(c, 0, 0);
  const W = c.width * E.zoom,
    Hh = c.height * E.zoom;
  $('#pxWrap').style.width = W + 'px';
  $('#pxWrap').style.height = Hh + 'px';
  $('#pxZoom').textContent = E.zoom + '×';
  const g = $('#pxGrid');
  g.hidden = !(E.grid && E.zoom >= 6);
  g.style.backgroundSize = `${E.zoom}px ${E.zoom}px`;
  const sv = $('#pxParts');
  sv.setAttribute('viewBox', `0 0 ${c.width} ${c.height}`);
  sv.style.display = E.parts ? '' : 'none';
  sv.innerHTML = partsOf(E.sp, E.view)
    .map(
      (p, k) =>
        `<rect data-k="${k}" x="${p.r[0]}" y="${p.r[1]}" width="${p.r[2]}" height="${p.r[3]}" class="${E.hover === k ? 'hov' : ''}"/>`
    )
    .join('');
  $$('.pxed [data-pe=grid]').forEach(b => b.classList.toggle('on', E.grid));
  $$('.pxed [data-pe=parts]').forEach(b => b.classList.toggle('on', E.parts));
}
function pxPalette() {
  const c = pxCanvas();
  if (!c) return;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data,
    cnt = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const top = [...cnt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 48)
    .map(([k]) => '#' + k.toString(16).padStart(6, '0').toUpperCase());
  $('#pxPal').innerHTML = top
    .map(h => `<button class="sw" style="background:${h}" data-pe="sw" data-c="${h}" title="${h}"></button>`)
    .join('');
}
function pxBones() {
  const E = PX_ED,
    meta = ST.rigs[E.sp] && ST.rigs[E.sp][E.view];
  if (!meta) {
    $('#pxBones').innerHTML = '';
    return;
  }
  const base = `@rigs.${E.sp}.${E.view}.bones`;
  $('#pxBones').innerHTML =
    `<table class="bones"><thead><tr><th>Part</th><th>X</th><th>Y</th><th>${E.view === 'back' ? 'Layer (back)' : 'Layer'}</th><th>Tilt</th></tr></thead><tbody>${meta.bones
      .map(
        (b, i) => `<tr><td title="attached to ${esc(b.par || 'body')}">${esc(b.n)}</td>
  <td><input type="number" step="0.5" data-p="${base}.${i}.at.0" data-k="num" value="${b.at[0]}"></td><td><input type="number" step="0.5" data-p="${base}.${i}.at.1" data-k="num" value="${b.at[1]}"></td>
  <td><input type="number" step="1" data-p="${base}.${i}.${E.view === 'back' && b.zb != null ? 'zb' : 'z'}" data-k="num" value="${E.view === 'back' && b.zb != null ? b.zb : b.z}"></td><td><input type="number" step="0.02" data-p="${base}.${i}.rr" data-k="num" data-opt="1" value="${b.rr || ''}" placeholder="0"></td></tr>`
      )
      .join('')}</tbody></table>`;
}
function pxPos(ev) {
  const v = $('#pxCv'),
    r = v.getBoundingClientRect(),
    c = pxCanvas();
  return [
    Math.floor(((ev.clientX - r.left) / r.width) * c.width),
    Math.floor(((ev.clientY - r.top) / r.height) * c.height),
  ];
}
function pxPush() {
  const c = pxCanvas(),
    E = PX_ED;
  E.undo.push(c.getContext('2d').getImageData(0, 0, c.width, c.height));
  if (E.undo.length > 40) E.undo.shift();
  E.redo = [];
}
function pxChanged() {
  const c = pxCanvas();
  markArt(pxPath(), c);
  pxDraw();
}
function pxPlot(x, y) {
  const E = PX_ED,
    c = pxCanvas(),
    cx = c.getContext('2d');
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  if (E.tool === 'erase') cx.clearRect(x, y, 1, 1);
  else {
    cx.fillStyle = E.color;
    cx.fillRect(x, y, 1, 1);
  }
}
function pxLine(a, b) {
  let [x0, y0] = a;
  const [x1, y1] = b,
    dx = Math.abs(x1 - x0),
    dy = -Math.abs(y1 - y0),
    sx = x0 < x1 ? 1 : -1,
    sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    pxPlot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) {
      e += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y0 += sy;
    }
  }
}
function pxFill(x, y) {
  const E = PX_ED,
    c = pxCanvas(),
    cx = c.getContext('2d'),
    W = c.width,
    Hh = c.height,
    im = cx.getImageData(0, 0, W, Hh),
    d = new Uint32Array(im.data.buffer);
  const part = partsOf(E.sp, E.view).find(
      p => x >= p.r[0] && y >= p.r[1] && x < p.r[0] + p.r[2] && y < p.r[1] + p.r[3]
    ),
    bx = part ? part.r : [0, 0, W, Hh];
  const t = d[y * W + x],
    n = parseInt(E.color.slice(1), 16),
    rep = (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16);
  if (t === rep) return;
  const st = [[x, y]];
  while (st.length) {
    const [px, py] = st.pop();
    if (px < bx[0] || py < bx[1] || px >= bx[0] + bx[2] || py >= bx[1] + bx[3]) continue;
    const i = py * W + px;
    if (d[i] !== t) continue;
    d[i] = rep;
    st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
  }
  cx.putImageData(im, 0, 0);
}
function pxSetColor(h) {
  PX_ED.color = h.toUpperCase();
  $('#pxColor').value = h;
  $('#pxHex').textContent = PX_ED.color;
  if (PX_ED.tool === 'erase' || PX_ED.tool === 'pick') {
    PX_ED.tool = 'pen';
    pxLoadTools();
  }
}
function pxLoadTools() {
  $$('.pxed [data-pe=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === PX_ED.tool));
  const w = $('#pxWrap');
  if (w) w.dataset.tool = PX_ED.tool;
}
function pxBindCanvas() {
  const w = $('#pxWrap');
  let down = false,
    last = null;
  w.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const E = PX_ED,
      p = pxPos(ev),
      c = pxCanvas();
    if (!c) return;
    w.setPointerCapture(ev.pointerId);
    if (E.tool === 'pick') {
      const d = c.getContext('2d').getImageData(p[0], p[1], 1, 1).data;
      if (d[3]) pxSetColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''));
      return;
    }
    pxPush();
    if (E.tool === 'fill') {
      pxFill(p[0], p[1]);
      pxChanged();
      return;
    }
    down = true;
    last = p;
    pxPlot(p[0], p[1]);
    pxDraw();
  });
  w.addEventListener('pointermove', ev => {
    const E = PX_ED,
      p = pxPos(ev);
    if (down) {
      pxLine(last, p);
      last = p;
      pxDraw();
      return;
    }
    const parts = partsOf(E.sp, E.view),
      k = parts.findIndex(q => p[0] >= q.r[0] && p[1] >= q.r[1] && p[0] < q.r[0] + q.r[2] && p[1] < q.r[1] + q.r[3]);
    if (k !== E.hover) {
      E.hover = k;
      $('#pxHover').textContent = k >= 0 ? parts[k].label : 'Empty space';
      $$('#pxParts rect').forEach(r => r.classList.toggle('hov', +r.dataset.k === k));
    }
  });
  const up = () => {
    if (down) {
      down = false;
      pxChanged();
    }
  };
  w.addEventListener('pointerup', up);
  w.addEventListener('pointercancel', up);
  $('#pxStage').addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      PX_ED.zoom = clamp(PX_ED.zoom + (ev.deltaY < 0 ? 1 : -1), 1, 32);
      pxDraw();
    },
    { passive: false }
  );
  pxLoadTools();
}
function pxBind() {
  const m = $('.pxed');
  pxBindCanvas();
  $('#pxColor').addEventListener('input', e => pxSetColor(e.target.value));
  $('#pxGoldK').addEventListener('input', e => ($('#pxGS').textContent = e.target.value + '%'));
  m.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-pe]');
    if (!b) return;
    const E = PX_ED,
      k = b.dataset.pe;
    if (k === 'atlas') {
      E.view = b.dataset.v;
      E.gold = b.dataset.g === '1';
      E.zoom = 0;
      E.hover = null;
      pxLoad();
    } else if (k === 'tool') {
      E.tool = b.dataset.t;
      pxLoadTools();
    } else if (k === 'zoom') {
      E.zoom = clamp(E.zoom + +b.dataset.z, 1, 32);
      pxDraw();
    } else if (k === 'grid') {
      E.grid = !E.grid;
      pxDraw();
    } else if (k === 'parts') {
      E.parts = !E.parts;
      pxDraw();
    } else if (k === 'undo') {
      pxUndo();
    } else if (k === 'redo') {
      pxRedo();
    } else if (k === 'sw') pxSetColor(b.dataset.c);
    else if (k === 'act') {
      E.act = b.dataset.a;
      prevAct($('#pxPrev'), E.act === 'idle' ? null : E.act);
      $('#pxPrev')._p.loop = 1;
    } else if (k === 'gold') {
      const src = atlasNow(atlasPath(E.sp, E.view, false));
      if (!src) return;
      const g = goldFrom(src, +$('#pxGoldK').value / 100);
      if (pxCanvas()) pxPush();
      markArt(pxPath(), g);
      pxLoad();
      toast('Gold sheet rebuilt. Save to game to keep it.');
    } else if (k === 'dl') {
      const c = pxCanvas();
      if (c) downloadCanvas(c, pxPath().split('/').pop());
    } else if (k === 'ul') {
      const f = await pickFile('image/png');
      if (!f) return;
      const up = await fileToCanvas(f),
        c = pxCanvas();
      if (
        c &&
        (up.width !== c.width || up.height !== c.height) &&
        !(await ask(
          `The uploaded image is ${up.width}×${up.height}, but this sheet is ${c.width}×${c.height}. Parts won’t line up unless the layout matches. Use it anyway?`,
          'Use it'
        ))
      )
        return;
      if (c) pxPush();
      markArt(pxPath(), up);
      pxLoad();
      toast('Sheet replaced. Save to game to keep it.');
    } else if (k === 'revert') {
      const p = pxPath();
      if (!(await ask('Throw away unsaved edits to this sheet?', 'Revert'))) return;
      ST.artDirty.delete(p);
      ATL.delete(p);
      await atlasGet(p).catch(() => null);
      previewsDirty();
      updTop();
      pxLoad();
    } else if (k === 'close') {
      const back = E.back;
      $('#modal').innerHTML = '';
      previewsDirty();
      if (back) back();
      else render();
    } else if (k === 'skel') {
      openSkeleton(E.sp, E.view);
    }
  });
  document.addEventListener('keydown', pxKeys);
}
function pxUndo() {
  const E = PX_ED,
    c = pxCanvas();
  if (!E.undo.length || !c) return;
  const x = c.getContext('2d');
  E.redo.push(x.getImageData(0, 0, c.width, c.height));
  x.putImageData(E.undo.pop(), 0, 0);
  pxChanged();
}
function pxRedo() {
  const E = PX_ED,
    c = pxCanvas();
  if (!E.redo.length || !c) return;
  const x = c.getContext('2d');
  E.undo.push(x.getImageData(0, 0, c.width, c.height));
  x.putImageData(E.redo.pop(), 0, 0);
  pxChanged();
}
function pxKeys(ev) {
  if (!$('.pxed:not(.skel)')) {
    document.removeEventListener('keydown', pxKeys);
    return;
  }
  if (ev.target.closest('input')) return;
  const k = ev.key.toLowerCase(),
    mod = ev.ctrlKey || ev.metaKey;
  if (mod && k === 'z') {
    ev.preventDefault();
    ev.shiftKey ? pxRedo() : pxUndo();
    return;
  }
  if (mod && k === 'y') {
    ev.preventDefault();
    pxRedo();
    return;
  }
  if (mod) return;
  const T = { p: 'pen', b: 'pen', e: 'erase', f: 'fill', g: 'fill', i: 'pick' };
  if (T[k]) {
    PX_ED.tool = T[k];
    pxLoadTools();
  } else if (k === '+' || k === '=') {
    PX_ED.zoom = Math.min(32, PX_ED.zoom + 1);
    pxDraw();
  } else if (k === '-') {
    PX_ED.zoom = Math.max(1, PX_ED.zoom - 1);
    pxDraw();
  } else if (k === 'escape') {
    $('#modal').innerHTML = '';
    render();
  }
}
