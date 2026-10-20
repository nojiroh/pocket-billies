'use strict';
/* ================= POCKET BILLIES STUDIO · sprites =================
   Billionaire art lives in atlases per species (front and back views), cut into
   parts by art/rigs.js. The Studio loads those atlases into editable canvases, assembles the skeleton exactly like
   the game does, animates previews, and provides the pixel editor and recoloring. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { openShortcutSheet, openSkeleton, provide } from '../../game/js/hooks.js';
import { $, $$, clamp } from '../../game/js/util.js';
import { coatArt } from '../../game/js/logic/coats.js';
import { makeCanvas } from '../../game/js/art.js';
import { animFor } from '../../game/js/body-plan-animation.js';
import { coatAtlas, drawRig, rigPose, setCoatRigData } from '../../game/js/skeleton-rig.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelKeyAction, pixelZoomNext } from '../../game/js/logic/pixel-ops.js';
import { ask, redo, render, speciesName, studioState, toast, undo, updateTopBar } from './studio-app.js';
import {
  artStep,
  drawPixelCanvas,
  pictureImage,
  pixelCanvas,
  pixelCanvasAct,
  pixelCanvasColor,
  pixelCanvasDeselect,
  pixelCanvasFit,
  pixelCanvasPanel,
  pixelCanvasPanelHTML,
  pixelCanvasTool,
  pixelCanvasTransform,
  pixelCanvasZoom,
} from './pixel-canvas.js';
/* eslint-disable no-func-assign */
expose({
  ATLAS_CACHE: [() => ATLAS_CACHE],
  ATLAS_LOADS: [() => ATLAS_LOADS],
  FACE_FRAMES: [() => FACE_FRAMES],
  RIG_CACHE: [() => RIG_CACHE],
  SPRITE_PREVIEWS: [() => SPRITE_PREVIEWS],
  atlasGet: [() => atlasGet, v => (atlasGet = v)],
  atlasPath: [() => atlasPath],
  atlasVersion: [() => atlasVersion, v => (atlasVersion = v)],
  bindPixelEditor: [() => bindPixelEditor, v => (bindPixelEditor = v)],
  canvasCopy: [() => canvasCopy, v => (canvasCopy = v)],
  choosePixelColor: [() => choosePixelColor, v => (choosePixelColor = v)],
  coatRigDataSet: [() => coatRigDataSet, v => (coatRigDataSet = v)],
  coatVersion: [() => coatVersion, v => (coatVersion = v)],
  coatedAtlas: [() => coatedAtlas, v => (coatedAtlas = v)],
  coatsChanged: [() => coatsChanged, v => (coatsChanged = v)],
  downloadCanvas: [() => downloadCanvas, v => (downloadCanvas = v)],
  drawPixelEditor: [() => drawPixelEditor, v => (drawPixelEditor = v)],
  drawSpritePreview: [() => drawSpritePreview, v => (drawSpritePreview = v)],
  fileToCanvas: [() => fileToCanvas, v => (fileToCanvas = v)],
  forgetArt: [() => forgetArt, v => ((forgetArt = v), provide({ forgetArt }))],
  hsvToRgb: [() => hsvToRgb, v => (hsvToRgb = v)],
  hueShift: [() => hueShift, v => (hueShift = v)],
  loadImage: [() => loadImage, v => (loadImage = v)],
  loadedAtlas: [() => loadedAtlas],
  markArt: [() => markArt, v => ((markArt = v), provide({ markArt }))],
  mountPreviews: [() => mountPreviews, v => ((mountPreviews = v), provide({ mountPreviews }))],
  openPixelEditor: [() => openPixelEditor, v => (openPixelEditor = v)],
  partsOf: [() => partsOf, v => (partsOf = v)],
  pickFile: [() => pickFile, v => (pickFile = v)],
  pixelEditor: [() => pixelEditor],
  pixelEditorAtlasPath: [() => pixelEditorAtlasPath, v => (pixelEditorAtlasPath = v)],
  pixelEditorBones: [() => pixelEditorBones, v => (pixelEditorBones = v)],
  pixelEditorCanvas: [() => pixelEditorCanvas, v => (pixelEditorCanvas = v)],
  pixelEditorChanged: [() => pixelEditorChanged, v => (pixelEditorChanged = v)],
  pixelEditorHover: [() => pixelEditorHover, v => (pixelEditorHover = v)],
  pixelEditorKeys: [() => pixelEditorKeys, v => (pixelEditorKeys = v)],
  pixelEditorOnion: [() => pixelEditorOnion, v => (pixelEditorOnion = v)],
  pixelEditorPalette: [() => pixelEditorPalette, v => (pixelEditorPalette = v)],
  playSpritePreviewAction: [() => playSpritePreviewAction, v => (playSpritePreviewAction = v)],
  previewsDirty: [() => previewsDirty, v => (previewsDirty = v)],
  redoPixels: [() => redoPixels, v => (redoPixels = v)],
  refreshPixelEditor: [() => refreshPixelEditor, v => (refreshPixelEditor = v)],
  refreshPixelTools: [() => refreshPixelTools, v => (refreshPixelTools = v)],
  rgbToHsv: [() => rgbToHsv, v => (rgbToHsv = v)],
  rigFor: [() => rigFor, v => (rigFor = v)],
  spriteCacheClear: [() => spriteCacheClear, v => ((spriteCacheClear = v), provide({ spriteCacheClear }))],
  spritePreviewHTML: [() => spritePreviewHTML, v => (spritePreviewHTML = v)],
  spritePreviewLoop: [() => spritePreviewLoop, v => (spritePreviewLoop = v)],
  spritePreviewsRunning: [() => spritePreviewsRunning, v => (spritePreviewsRunning = v)],
  undoPixels: [() => undoPixels, v => (undoPixels = v)],
});
/* eslint-enable no-func-assign */
provide({ forgetArt, markArt, mountPreviews, spriteCacheClear });
/* to-module: end */
export const ATLAS_CACHE = new Map(); /* path -> canvas */
const ATLAS_LOADS = new Map();
const RIG_CACHE = new Map(); /* key -> {ver,R} */
export let atlasVersion = 0;
export const atlasPath = (sp, view) => {
  const m = studioState.rigs && studioState.rigs[sp] && studioState.rigs[sp][view];
  if (m && m.sheet) return 'art/' + m.sheet;
  return `art/billionaires/${sp}${view === 'back' ? '_back' : ''}.png`;
};
export function spriteCacheClear() {
  RIG_CACHE.clear();
  atlasVersion++;
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
  if (studioState.artDirty.has(path)) return Promise.resolve(studioState.artDirty.get(path));
  if (ATLAS_CACHE.has(path)) return Promise.resolve(ATLAS_CACHE.get(path));
  if (ATLAS_LOADS.has(path)) return ATLAS_LOADS.get(path);
  const p = loadImage('../game/' + path + '?v=' + Date.now())
    .then(im => {
      const c = makeCanvas(im.naturalWidth, im.naturalHeight);
      c.getContext('2d').drawImage(im, 0, 0);
      ATLAS_CACHE.set(path, c);
      ATLAS_LOADS.delete(path);
      return c;
    })
    .catch(e => {
      ATLAS_LOADS.delete(path);
      throw e;
    });
  ATLAS_LOADS.set(path, p);
  return p;
}
export const loadedAtlas = path => studioState.artDirty.get(path) || ATLAS_CACHE.get(path) || null;
provide({ loadedAtlas }); /* to-module */
/* assemble a skeleton like skeleton-rig.js rigParts(), but from the Studio's editable atlas */
/* studio track ST-0: the coats being edited (coats.json); a coat edit bumps coatVersion so previews recolour again */
let coatVersion = 0;
export function coatsChanged() {
  coatVersion++;
  setCoatRigData(studioState.D.coats || {});
  previewsDirty();
}
/* the sheet a coat draws from: its own hand-painted one, or the normal sheet recoloured */
function coatedAtlas(sp, view, coat) {
  const C = coat && studioState.D.coats && studioState.D.coats[coat],
    own = C ? coatArt(C, sp, view) : null,
    path = own ? 'art/' + own : atlasPath(sp, view),
    atlas = loadedAtlas(path);
  if (!atlas) {
    atlasGet(path).catch(() => {});
    return { path, atlas: null };
  }
  if (!C || own) return { path, atlas };
  if (coatRigDataSet !== studioState.D.coats) {
    coatRigDataSet = studioState.D.coats;
    setCoatRigData(coatRigDataSet);
  }
  return { path, atlas: coatAtlas(atlas, `${path}@${atlas._ver || 0}:${atlasVersion}:${coatVersion}`, sp, view, coat) };
}
let coatRigDataSet = null;
export function rigFor(sp, view, coat) {
  const { path, atlas } = coatedAtlas(sp, view, coat);
  if (!atlas) return null;
  const meta = studioState.rigs[sp] && studioState.rigs[sp][view];
  if (!meta) return null;
  const key = sp + ':' + view + ':' + path + (coat ? '#' + coat : ''),
    ver = (studioState.rigVer || 0) + ':' + atlasVersion + ':' + (atlas._ver || 0) + ':' + (coat ? coatVersion : 0),
    hit = RIG_CACHE.get(key);
  if (hit && hit.ver === ver) return hit.R;
  const cut = ([x, y, w, h]) => {
    const c = makeCanvas(Math.max(1, w), Math.max(1, h));
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
  RIG_CACHE.set(key, { ver, R });
  return R;
}
/* ---------- previews ---------- */
const SPRITE_PREVIEWS = new Set();
let spritePreviewsRunning = false;
export function spritePreviewHTML(o) {
  return `<canvas class="spr-prev ${o.cls || ''}" data-prev='${escapeHtml(JSON.stringify(o))}' width="10" height="10"></canvas>`;
}
export function mountPreviews(root = document) {
  $$('canvas[data-prev]', root).forEach(c => {
    if (c._p) return;
    const o = JSON.parse(c.dataset.prev);
    c._p = { ...o, seed: Math.random() * 6, t0: performance.now(), act: o.act || null };
    SPRITE_PREVIEWS.add(c);
    drawSpritePreview(c, performance.now());
  });
  if (!spritePreviewsRunning) {
    spritePreviewsRunning = true;
    requestAnimationFrame(spritePreviewLoop);
  }
}
export function playSpritePreviewAction(c, act) {
  if (c && c._p) {
    c._p.act = act;
    c._p.t0 = performance.now();
  }
}
function drawSpritePreview(c, ts) {
  const o = c._p,
    R = rigFor(o.sp, o.view || 'front', o.coat);
  const x = c.getContext('2d');
  if (!R) {
    if (!o.miss) {
      o.miss = 1;
      atlasGet(coatedAtlas(o.sp, o.view || 'front', o.coat).path)
        .then(() => {
          o.miss = 0;
          drawSpritePreview(c, performance.now());
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
  const P = rigPose(act, tau, o.still ? 0 : ts, o.seed);
  /* phase 16: a preview can show a build (part sizes) */
  if (o.build) P.build = o.build;
  drawRig(x, R, P, o.view || 'front');
  o.drawn = 1;
}
function spritePreviewLoop(ts) {
  let any = false;
  for (const c of SPRITE_PREVIEWS) {
    if (!c.isConnected) {
      SPRITE_PREVIEWS.delete(c);
      continue;
    }
    any = true;
    if (c._p.still && c._p.drawn && !c._p.dirty) continue;
    c._p.dirty = 0;
    drawSpritePreview(c, ts);
  }
  if (any) requestAnimationFrame(spritePreviewLoop);
  else spritePreviewsRunning = false;
}
export function previewsDirty() {
  for (const c of SPRITE_PREVIEWS) c._p.dirty = 1;
}
/* ---------- color tools ---------- */
function rgbToHsv(r, g, b) {
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
function hsvToRgb(h, s, v) {
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
  const c = makeCanvas(src.width, src.height),
    x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  if (!deg && satK === 1) return c;
  const im = x.getImageData(0, 0, c.width, c.height),
    d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    if (s < 0.12) continue;
    if (protectSkin && h > 12 && h < 42 && s < 0.55 && v > 0.45) continue;
    const [r, g, b] = hsvToRgb((h + deg + 360) % 360, clamp(s * satK, 0, 1), v);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  x.putImageData(im, 0, 0);
  return c;
}
function canvasCopy(src) {
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}
export function markArt(path, c) {
  c._ver = (c._ver || 0) + 1;
  atlasVersion++;
  studioState.artDirty.set(path, c);
  ATLAS_CACHE.set(path, c);
  updateTopBar();
  previewsDirty();
}
/* studio track ST-3: a picture made in this session and not saved, taken back (an undo of a new part) */
function forgetArt(path) {
  studioState.artDirty.delete(path);
  ATLAS_CACHE.delete(path);
  atlasVersion++;
  updateTopBar();
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
    const c = makeCanvas(im.naturalWidth, im.naturalHeight);
    c.getContext('2d').drawImage(im, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
/* ================= PIXEL EDITOR ================= */
export const pixelEditor = {};
const FACE_FRAMES = { idle: 'face', blink: 'blink', happy: 'happy', hurt: 'hurt', shout: 'shout', main: '' };
function partsOf(sp, view) {
  const meta = studioState.rigs[sp] && studioState.rigs[sp][view];
  if (!meta) return [];
  const out = [];
  meta.imgs.forEach((e, i) => {
    const bones = meta.bones.filter(b => b.i === i).map(b => b.n);
    Object.entries(e.f).forEach(([v, r]) =>
      out.push({
        i,
        v,
        r,
        label: (bones.join(', ') || 'part ' + i) + (v !== 'main' ? ` (${FACE_FRAMES[v] || v})` : ''),
      })
    );
  });
  return out;
}
export async function openPixelEditor(sp, view = 'front', focus = null) {
  const E = pixelEditor;
  Object.assign(E, {
    sp,
    view,
    tool: 'pen',
    color: '#2A1E2E',
    parts: true,
    pc: null,
    act: 'idle',
    hover: null,
    focus,
    back: null,
  });
  try {
    await Promise.all([atlasGet(atlasPath(sp, 'front')), atlasGet(atlasPath(sp, 'back'))]);
  } catch (e) {
    toast(e.message, 'err');
    return;
  }
  const m = $('#modal');
  m.innerHTML = `<div class="pxed" role="dialog" aria-modal="true" aria-label="Pixel editor">
 <header class="px-top"><b>${escapeHtml(speciesName(sp))}</b><span class="px-tabs">${[
   ['front', 'Front'],
   ['back', 'Back'],
 ]
   .map(([v, l]) => `<button class="seg" data-pe="atlas" data-v="${v}">${l}</button>`)
   .join('')}</span>
  <span class="px-tools">${[
    ['pen', 'Pencil', 'P'],
    ['erase', 'Eraser', 'E'],
    ['fill', 'Fill', 'F'],
    ['pick', 'Pick color', 'I'],
    ['line', 'Line', 'L'],
    ['select', 'Select', 'M'],
  ]
    .map(([k, l, s]) => `<button class="seg" data-pe="tool" data-t="${k}" title="${l} (${s})">${l}</button>`)
    .join('')}</span>
  <span class="px-tools"><button class="seg" data-pe="zoom" data-z="-1" title="Zoom out (−)">−</button><span id="pxZoom"></span><button class="seg" data-pe="zoom" data-z="1" title="Zoom in (+)">+</button><button class="seg" data-pe="grid" title="Pixel grid">Grid</button><button class="seg" data-pe="parts" title="Part outlines">Parts</button></span>
  <span class="px-tools">${[
    ['flipH', 'Flip ↔', 'Flip the selection, or the part under the pointer, left-right (Shift+H)'],
    ['flipV', 'Flip ↕', 'Flip upside down (Shift+V)'],
    ['rotate', 'Turn ⟳', 'Turn a quarter right (Shift+R)'],
  ]
    .map(([k, l, t]) => `<button class="seg" data-pe="xf" data-x="${k}" title="${t}">${l}</button>`)
    .join('')}</span>
  <span class="px-tools"><button class="seg" data-pe="undo" title="Undo (Ctrl+Z)">↶</button><button class="seg" data-pe="redo" title="Redo (Ctrl+Y)">↷</button></span>
  <span class="grow"></span><button class="btn" data-pe="keys" title="Every key (?)">Keys</button><button class="btn" data-pe="skel" title="Add, move and connect body parts">Skeleton builder</button><button class="btn" data-pe="close">Done</button></header>
 <div class="px-body"><div class="px-stage" id="pxStage"></div>
 <aside class="px-side">
  <div class="px-sec"><h4>Color</h4><div class="px-color"><input type="color" id="pxColor" value="${E.color}"><span id="pxHex">${E.color}</span></div><div class="px-pal" id="pxPal"></div></div>
  ${pixelCanvasPanelHTML({ onion: true })}
  <div class="px-sec"><h4>Preview</h4><div class="px-prev"><canvas id="pxPrev"></canvas></div><div class="seg-row">${['idle', 'attack', 'cast', 'hurt', 'cheer', 'faint'].map(a => `<button class="seg sm" data-pe="act" data-a="${a}">${a}</button>`).join('')}</div></div>
  <div class="px-sec"><h4>Under the cursor</h4><p class="px-hover" id="pxHover">Point at a part of the sheet.</p></div>
  <div class="px-sec"><h4>Whole sheet</h4><p class="help">Edit in another app (Aseprite, Photoshop…): download, edit, upload. Keep the size and layout so the parts line up.</p><div class="seg-row"><button class="btn" data-pe="dl">Download PNG</button><button class="btn" data-pe="ul">Upload PNG</button></div><button class="btn subtle" data-pe="revert">Revert to the saved file</button></div>
  <div class="px-sec"><h4>Skeleton</h4><p class="help">Nudge where each part attaches and how parts stack. Changes animate live.</p><div id="pxBones"></div></div>
 </aside></div></div>`;
  bindPixelEditor();
  refreshPixelEditor();
}
function pixelEditorAtlasPath() {
  return atlasPath(pixelEditor.sp, pixelEditor.view);
}
function pixelEditorCanvas() {
  return loadedAtlas(pixelEditorAtlasPath());
}
function refreshPixelEditor() {
  const E = pixelEditor,
    c = pixelEditorCanvas();
  $$('.pxed [data-pe=atlas]').forEach(b => b.classList.toggle('on', b.dataset.v === E.view));
  if (!c) {
    $('#pxStage').innerHTML = '<p class="help">This sheet doesn’t exist yet.</p>';
    return;
  }
  if (!E.pc || !E.pc.cv.isConnected) {
    E.pc = pixelCanvas($('#pxStage'), {
      ids: 'px',
      tool: E.tool,
      color: E.color,
      get: pixelEditorCanvas,
      boxAt: (x, y) => {
        const p = partsOf(E.sp, E.view).find(
          q => x >= q.r[0] && y >= q.r[1] && x < q.r[0] + q.r[2] && y < q.r[1] + q.r[3]
        );
        return p ? p.r : null;
      },
      overlay: () =>
        E.parts
          ? partsOf(E.sp, E.view)
              .map(
                (p, k) =>
                  `<rect data-k="${k}" x="${p.r[0]}" y="${p.r[1]}" width="${p.r[2]}" height="${p.r[3]}" class="${E.hover === k ? 'hov' : ''}"/>`
              )
              .join('')
          : '',
      hover: (P, x, y) => pixelEditorHover(x, y),
      onion: () => pixelEditorOnion(),
      focusBox: () => {
        const p = E.hover >= 0 ? partsOf(E.sp, E.view)[E.hover] : null;
        return p ? p.r : null;
      },
      path: pixelEditorAtlasPath,
      changed: pixelEditorChanged,
      toolChanged: refreshPixelTools,
      drawn: P => {
        $('#pxZoom').textContent = P.zoom + '×';
        $$('.pxed [data-pe=grid]').forEach(b => b.classList.toggle('on', P.showGrid));
        $$('.pxed [data-pe=parts]').forEach(b => b.classList.toggle('on', E.parts));
      },
      colorChanged: P => {
        E.color = P.color;
        $('#pxColor').value = P.color;
        $('#pxHex').textContent = P.color;
        refreshPixelTools();
      },
    });
    pixelCanvasPanel(E.pc, $('.pxed .px-side'));
  }
  if (E.focus) {
    const k = partsOf(E.sp, E.view).findIndex(p => p.i === E.focus.i && (!E.focus.v || p.v === E.focus.v));
    if (k >= 0) {
      E.hover = k;
      const r = partsOf(E.sp, E.view)[k].r;
      E.pc.zoom = Math.max(E.pc.zoom || pixelCanvasFit(E.pc), clamp(Math.floor(220 / Math.max(r[2], r[3])), 2, 16));
      setTimeout(() => {
        const st = $('#pxStage'),
          Z = E.pc.zoom;
        if (st)
          st.scrollTo({
            left: r[0] * Z - st.clientWidth / 2 + (r[2] * Z) / 2 + 20,
            top: r[1] * Z - st.clientHeight / 2 + (r[3] * Z) / 2 + 20,
          });
      }, 30);
    }
  }
  refreshPixelTools();
  drawPixelEditor();
  pixelEditorPalette();
  pixelEditorBones();
  const pv = $('#pxPrev');
  pv.dataset.prev = JSON.stringify({
    sp: E.sp,
    view: E.view,
    act: E.act === 'idle' ? null : E.act,
    loop: 1,
  });
  pv._p = null;
  SPRITE_PREVIEWS.delete(pv);
  mountPreviews($('.pxed'));
}
function drawPixelEditor() {
  const E = pixelEditor;
  if (!E.pc || !pixelEditorCanvas()) return;
  drawPixelCanvas(E.pc);
}
function pixelEditorPalette() {
  const c = pixelEditorCanvas();
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
function pixelEditorBones() {
  const E = pixelEditor,
    meta = studioState.rigs[E.sp] && studioState.rigs[E.sp][E.view];
  if (!meta) {
    $('#pxBones').innerHTML = '';
    return;
  }
  const base = `@rigs.${E.sp}.${E.view}.bones`;
  $('#pxBones').innerHTML =
    `<table class="bones"><thead><tr><th>Part</th><th>X</th><th>Y</th><th>${E.view === 'back' ? 'Layer (back)' : 'Layer'}</th><th>Tilt</th></tr></thead><tbody>${meta.bones
      .map(
        (b, i) => `<tr><td title="attached to ${escapeHtml(b.par || 'body')}">${escapeHtml(b.n)}</td>
  <td><input type="number" step="0.5" data-p="${base}.${i}.at.0" data-k="num" value="${b.at[0]}"></td><td><input type="number" step="0.5" data-p="${base}.${i}.at.1" data-k="num" value="${b.at[1]}"></td>
  <td><input type="number" step="1" data-p="${base}.${i}.${E.view === 'back' && b.zb != null ? 'zb' : 'z'}" data-k="num" value="${E.view === 'back' && b.zb != null ? b.zb : b.z}"></td><td><input type="number" step="0.02" data-p="${base}.${i}.rr" data-k="num" data-opt="1" value="${b.rr || ''}" placeholder="0"></td></tr>`
      )
      .join('')}</tbody></table>`;
}
/* the onion skin: the part under the pointer as the other view draws it (the bone of the same name), centred on the
   part's box (lining up the pivots put most back parts beside their front ones: the views place them differently); a
   face frame shows the same frame there when it has one */
function pixelEditorOnion() {
  const E = pixelEditor,
    p = E.hover >= 0 ? partsOf(E.sp, E.view)[E.hover] : null,
    other = E.view === 'back' ? 'front' : 'back',
    R = studioState.rigs[E.sp] || {},
    A = R[E.view],
    B = R[other];
  if (!p || !A || !B) return null;
  const names = A.bones.filter(b => b.i === p.i).map(b => b.n),
    ob = B.bones.find(b => names.includes(b.n) && b.i >= 0);
  if (!ob) return null;
  const theirs = B.imgs[ob.i],
    r2 = theirs && (theirs.f[p.v] || theirs.f.main || theirs.f.idle || Object.values(theirs.f)[0]);
  if (!r2) return null;
  return {
    src: loadedAtlas(atlasPath(E.sp, other)),
    from: r2,
    to: [p.r[0] + Math.round((p.r[2] - r2[2]) / 2), p.r[1] + Math.round((p.r[3] - r2[3]) / 2)],
    clip: p.r,
  };
}
function pixelEditorHover(x, y) {
  const E = pixelEditor,
    parts = partsOf(E.sp, E.view),
    k = parts.findIndex(q => x >= q.r[0] && y >= q.r[1] && x < q.r[0] + q.r[2] && y < q.r[1] + q.r[3]);
  if (k !== E.hover) {
    E.hover = k;
    $('#pxHover').textContent = k >= 0 ? parts[k].label : 'Empty space';
    $$('#pxParts rect').forEach(r => r.classList.toggle('hov', +r.dataset.k === k));
    if (E.pc && E.pc.showOnion) drawPixelCanvas(E.pc);
  }
}
function pixelEditorChanged() {
  const c = pixelEditorCanvas();
  if (c) markArt(pixelEditorAtlasPath(), c);
  pixelEditorPalette();
}
function choosePixelColor(h) {
  pixelCanvasColor(pixelEditor.pc, h);
}
function refreshPixelTools() {
  const E = pixelEditor;
  if (E.pc) E.tool = E.pc.tool;
  $$('.pxed [data-pe=tool]').forEach(b => b.classList.toggle('on', b.dataset.t === E.tool));
}
function bindPixelEditor() {
  const m = $('.pxed');
  $('#pxColor').addEventListener('input', e => choosePixelColor(e.target.value));
  m.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-pe]');
    if (!b) return;
    const E = pixelEditor,
      k = b.dataset.pe;
    if (k === 'atlas') {
      E.view = b.dataset.v;
      if (E.pc) E.pc.zoom = 0;
      E.hover = null;
      refreshPixelEditor();
    } else if (k === 'tool') {
      if (E.pc) pixelCanvasTool(E.pc, b.dataset.t);
    } else if (k === 'zoom') {
      if (E.pc) pixelCanvasZoom(E.pc, pixelZoomNext(E.pc.zoom, +b.dataset.z));
    } else if (k === 'grid') {
      if (E.pc) E.pc.showGrid = !E.pc.showGrid;
      drawPixelEditor();
    } else if (k === 'parts') {
      E.parts = !E.parts;
      drawPixelEditor();
    } else if (k === 'xf') {
      if (E.pc) pixelCanvasTransform(E.pc, b.dataset.x);
    } else if (k === 'undo') {
      undoPixels();
    } else if (k === 'redo') {
      redoPixels();
    } else if (k === 'sw') choosePixelColor(b.dataset.c);
    else if (k === 'act') {
      E.act = b.dataset.a;
      playSpritePreviewAction($('#pxPrev'), E.act === 'idle' ? null : E.act);
      $('#pxPrev')._p.loop = 1;
    } else if (k === 'dl') {
      const c = pixelEditorCanvas();
      if (c) downloadCanvas(c, pixelEditorAtlasPath().split('/').pop());
    } else if (k === 'ul') {
      const f = await pickFile('image/png');
      if (!f) return;
      const up = await fileToCanvas(f),
        c = pixelEditorCanvas();
      if (
        c &&
        (up.width !== c.width || up.height !== c.height) &&
        !(await ask(
          `The uploaded image is ${up.width}×${up.height}, but this sheet is ${c.width}×${c.height}. Parts won’t line up unless the layout matches. Use it anyway?`,
          'Use it'
        ))
      )
        return;
      const before = pictureImage(c);
      markArt(pixelEditorAtlasPath(), up);
      artStep(pixelEditorAtlasPath(), before, pictureImage(up));
      refreshPixelEditor();
      toast('Sheet replaced. Save to game to keep it.');
    } else if (k === 'revert') {
      const p = pixelEditorAtlasPath();
      if (!(await ask('Throw away unsaved edits to this sheet?', 'Revert'))) return;
      const before = pictureImage(loadedAtlas(p));
      studioState.artDirty.delete(p);
      ATLAS_CACHE.delete(p);
      artStep(p, before, pictureImage(await atlasGet(p).catch(() => null)));
      previewsDirty();
      updateTopBar();
      refreshPixelEditor();
    } else if (k === 'close') {
      const back = E.back;
      $('#modal').innerHTML = '';
      previewsDirty();
      if (back) back();
      else render();
    } else if (k === 'keys') {
      openShortcutSheet();
    } else if (k === 'skel') {
      openSkeleton(E.sp, E.view);
    }
  });
  document.addEventListener('keydown', pixelEditorKeys);
}
/* the pixel editor's undo is the Studio's: it takes pixels and the skeleton table's numbers back in order */
function undoPixels() {
  undo();
  pixelEditorBones();
}
function redoPixels() {
  redo();
  pixelEditorBones();
}
function pixelEditorKeys(ev) {
  if (!$('.pxed:not(.skel)')) {
    document.removeEventListener('keydown', pixelEditorKeys);
    return;
  }
  if (ev.target.closest('input') || $('#dlg').innerHTML) return;
  const P = pixelEditor.pc,
    a = pixelKeyAction(ev);
  if (!P || !a) return;
  ev.preventDefault();
  if (a === 'undo') undoPixels();
  else if (a === 'redo') redoPixels();
  else if (a === 'deselect') {
    if (pixelCanvasDeselect(P)) return;
    $('#modal').innerHTML = '';
    render();
  } else pixelCanvasAct(P, a);
}
