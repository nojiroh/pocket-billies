'use strict';
/* ================= POCKET BILLIES STUDIO · the shared pixel canvas (studio track ST-2) =================
   One canvas for painting pixels, used by the sheet editor (sprites.js) and the prop and ground tile painter
   (map-editor.js). The picture is a canvas the host owns (an atlas from atlasGet); the canvas shows it at a whole
   zoom, with the grid and the host's outlines on top, and paints into it a stroke at a time. The numbers are in
   game/js/logic/pixel-ops.js.
   pixelCanvas(stage, o) puts it in `stage` (a scrolling box) and returns its state; o:
     get()        the picture (a canvas), or null
     ids          an id prefix for the elements ('px': pxWrap, pxCv, pxGrid, pxParts)
     repeat       3 for a ground tile: the picture repeats around itself and clicks wrap
     boxAt(x, y)  the box (a part) a pixel is in: fill stays inside it
     overlay(P)   SVG for the outlines, in picture pixels
     hostTool(P, t, x, y, ev)  a host's own tool (true when it took the click; ST-4: or { move(P, fx, fy), up(P) } to
                  follow the drag, in picture pixels with fractions, pixelCanvasPointF)
     hover(P, x, y)    the pointer moved over the picture
     focusBox(P)  the box a flip or turn acts on when nothing is selected (the part in focus; null: none)
     onion(P)     the onion skin: { src: a canvas, from: [x, y, w, h], to: [x, y], clip?: [x, y, w, h] } drawn faint
                  under the art
     path()       where the picture is saved (art/...): a stroke is a step of the Studio's undo for it
     changed(P)   a stroke ended, or an undo or redo changed the picture
     drawn(P)     the canvas was drawn (zoom and grid may have changed) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { forgetArt, loadedAtlas, markArt, openShortcutSheet, provide } from '../../game/js/hooks.js';
import { clamp } from '../../game/js/util.js';
import { makeCanvas } from '../../game/js/art.js';
import { historyArt, historyArtGroup } from '../../game/js/logic/history.js';
import {
  PIXEL_GRID_FROM,
  offPalette,
  paletteColors,
  paletteNearest,
  pixelClip,
  pixelCopy,
  pixelDiffBox,
  pixelFill,
  pixelFlip,
  pixelGet,
  pixelHex,
  pixelLine,
  pixelMirrored,
  pixelRgba,
  pixelRotate,
  pixelSet,
  pixelSymmetryFor,
  pixelZoomNext,
} from '../../game/js/logic/pixel-ops.js';
import { commit, redo, studioState, toast, undo, updateTopBar } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  PIXEL_SYMMETRY: [() => PIXEL_SYMMETRY],
  artStep: [() => artStep, v => (artStep = v)],
  artStepOf: [() => artStepOf, v => (artStepOf = v)],
  artStepPut: [() => artStepPut, v => ((artStepPut = v), provide({ artStepPut }))],
  artSteps: [() => artSteps, v => (artSteps = v)],
  bindPixelCanvasEvents: [() => bindPixelCanvasEvents, v => (bindPixelCanvasEvents = v)],
  drawPixelCanvas: [() => drawPixelCanvas, v => (drawPixelCanvas = v)],
  gamePalette: [() => gamePalette, v => (gamePalette = v)],
  gamePaletteMemo: [() => gamePaletteMemo, v => (gamePaletteMemo = v)],
  imageOf: [() => imageOf],
  pictureImage: [() => pictureImage],
  pixelCanvas: [() => pixelCanvas, v => (pixelCanvas = v)],
  pixelCanvasAct: [() => pixelCanvasAct, v => (pixelCanvasAct = v)],
  pixelCanvasBox: [() => pixelCanvasBox, v => (pixelCanvasBox = v)],
  pixelCanvasColor: [() => pixelCanvasColor, v => (pixelCanvasColor = v)],
  pixelCanvasDeselect: [() => pixelCanvasDeselect, v => (pixelCanvasDeselect = v)],
  pixelCanvasFit: [() => pixelCanvasFit, v => (pixelCanvasFit = v)],
  pixelCanvasInk: [() => pixelCanvasInk],
  pixelCanvasLock: [() => pixelCanvasLock, v => (pixelCanvasLock = v)],
  pixelCanvasOnion: [() => pixelCanvasOnion, v => (pixelCanvasOnion = v)],
  pixelCanvasPanel: [() => pixelCanvasPanel, v => (pixelCanvasPanel = v)],
  pixelCanvasPanelHTML: [() => pixelCanvasPanelHTML, v => (pixelCanvasPanelHTML = v)],
  pixelCanvasPanelSync: [() => pixelCanvasPanelSync, v => (pixelCanvasPanelSync = v)],
  pixelCanvasPoint: [() => pixelCanvasPoint, v => (pixelCanvasPoint = v)],
  pixelCanvasPointF: [() => pixelCanvasPointF, v => (pixelCanvasPointF = v)],
  pixelCanvasRepeat: [() => pixelCanvasRepeat],
  pixelCanvasSymmetry: [() => pixelCanvasSymmetry, v => (pixelCanvasSymmetry = v)],
  pixelCanvasTool: [() => pixelCanvasTool, v => (pixelCanvasTool = v)],
  pixelCanvasToolsHTML: [() => pixelCanvasToolsHTML, v => (pixelCanvasToolsHTML = v)],
  pixelCanvasTransform: [() => pixelCanvasTransform, v => (pixelCanvasTransform = v)],
  pixelCanvasZoom: [() => pixelCanvasZoom, v => (pixelCanvasZoom = v)],
  strokeEnd: [() => strokeEnd, v => (strokeEnd = v)],
  strokeLineTo: [() => strokeLineTo, v => (strokeLineTo = v)],
  strokePlot: [() => strokePlot, v => (strokePlot = v)],
  strokeShow: [() => strokeShow, v => (strokeShow = v)],
  strokeStart: [() => strokeStart, v => (strokeStart = v)],
  symmetryAt: [() => symmetryAt, v => (symmetryAt = v)],
  symmetryLines: [() => symmetryLines],
});
/* eslint-enable no-func-assign */
provide({ artStepPut });
/* to-module: end */
export function pixelCanvas(stage, o) {
  const id = n => (o.ids ? ` id="${o.ids}${n}"` : '');
  stage.innerHTML = `<div class="px-wrap"${id('Wrap')}><canvas class="pc-art"${id('Cv')}></canvas><div class="px-grid"${id('Grid')}></div><svg class="pc-over"${id('Parts')}></svg></div>`;
  const P = {
    o,
    stage,
    wrap: stage.querySelector('.px-wrap'),
    cv: stage.querySelector('.pc-art'),
    grid: stage.querySelector('.px-grid'),
    over: stage.querySelector('.pc-over'),
    tool: o.tool || 'pen',
    color: o.color || '#2A1E2E',
    color2: '#FFFFFF' /* X swaps it with the colour */,
    zoom: 0,
    showGrid: true,
    stroke: null,
    sel: null /* the selected box, in picture pixels */,
    lastAt: null /* where the last stroke ended: Shift-click draws a line from there */,
    hoverAt: null,
    symMode: 'off',
    symShift: [0, 0] /* the axes moved, in half pixels */,
    lock: false /* colours snap to the game palette */,
    showOff: false /* pixels not on the game palette show in magenta */,
    showOnion: false,
  };
  bindPixelCanvasEvents(P);
  const onArt = ev => {
    if (!P.cv.isConnected) return document.removeEventListener('studio-art', onArt);
    if (P.o.path && ev.detail.path === P.o.path()) {
      if (P.o.changed) P.o.changed(P);
      drawPixelCanvas(P);
    }
  };
  document.addEventListener('studio-art', onArt);
  return P;
}
/* ---------- the panel the hosts put beside the canvas: symmetry (and the palette and onion skin) ---------- */
/* a tool bar for a host that has none of its own (the prop and tile painter); `extra`: the host's tools [key, name] */
export function pixelCanvasToolsHTML(extra = []) {
  const T = [
    ['pen', 'Pencil', 'B'],
    ['erase', 'Eraser', 'E'],
    ['fill', 'Fill', 'G'],
    ['pick', 'Pick color', 'I'],
    ['line', 'Line', 'L'],
    ['select', 'Select', 'M'],
    ...extra,
  ];
  return `<span class="px-tools">${T.map(([k, n, key]) => `<button class="seg" data-pc="tool" data-t="${k}"${key ? ` title="${n} (${key})"` : ''}>${n}</button>`).join('')}</span><span class="px-tools"><button class="seg" data-pc="zoom" data-z="-1" title="Zoom out (−)">−</button><span class="pc-zoom"></span><button class="seg" data-pc="zoom" data-z="1" title="Zoom in (+)">+</button><button class="seg" data-pc="grid" title="Pixel grid (Ctrl+')">Grid</button></span><span class="px-tools"><button class="seg" data-pc="xf" data-x="flipH" title="Flip the selection or picture left-right (Shift+H)">Flip ↔</button><button class="seg" data-pc="xf" data-x="flipV" title="Flip upside down (Shift+V)">Flip ↕</button><button class="seg" data-pc="xf" data-x="rotate" title="Turn a quarter right (Shift+R)">Turn ⟳</button></span><span class="px-tools"><button class="seg" data-pc="undo" title="Undo (Ctrl+Z)">↶</button><button class="seg" data-pc="redo" title="Redo (Ctrl+Y)">↷</button><button class="seg" data-pc="keys" title="Every key (?)">?</button></span>`;
}
export function pixelCanvasPanelHTML(opts = {}) {
  return `<div class="px-sec pc-panel"><h4>Symmetry</h4><div class="seg-row">${PIXEL_SYMMETRY.map(
    ([k, l]) =>
      `<button class="seg sm" data-pc="sym" data-m="${k}" title="Symmetry: ${k === 'v' ? 'left-right' : k === 'h' ? 'top-bottom' : k} (Y)">${l}</button>`
  ).join(
    ''
  )}</div><p class="help">Mirrors about the middle of the selection, else of the part under the pointer.</p><div class="pc-shift"><label>Move the axis ↔ <input type="number" step="1" data-pc="shift" data-i="0" value="0" title="In half pixels"></label><label>↕ <input type="number" step="1" data-pc="shift" data-i="1" value="0" title="In half pixels"></label></div></div>
  <div class="px-sec pc-panel"><h4>Game palette</h4><label class="chk"><input type="checkbox" data-pc="lock"> Lock to the game palette (K)</label><label class="chk"><input type="checkbox" data-pc="off"> Show colours not on it <span class="pc-offn"></span></label></div>${opts.onion ? '<div class="px-sec pc-panel"><h4>Onion skin</h4><label class="chk"><input type="checkbox" data-pc="onion"> The other view faint underneath (O)</label><p class="help">The same part from the back (or front), centred under the part you point at.</p>' : ''}<div class="pc-ramps" hidden>${Object.entries(
    (window.NW_PALETTE && window.NW_PALETTE.ramps) || {}
  )
    .filter(([, v]) => Array.isArray(v))
    .map(
      ([k, v]) =>
        `<div class="pc-ramp" title="${k}">${v.map(h => `<button class="sw" style="background:${h}" data-pc="sw" data-c="${h}" title="${k} ${h}"></button>`).join('')}</div>`
    )
    .join('')}</div></div>`;
}
export function pixelCanvasPanel(P, root) {
  P.panel = root;
  root.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pc]');
    if (!b || !P.cv.isConnected) return;
    const k = b.dataset.pc;
    if (k === 'sym') pixelCanvasSymmetry(P, b.dataset.m);
    else if (k === 'tool') pixelCanvasTool(P, b.dataset.t);
    else if (k === 'zoom') pixelCanvasZoom(P, pixelZoomNext(P.zoom, +b.dataset.z));
    else if (k === 'grid') pixelCanvasAct(P, 'grid');
    else if (k === 'xf') pixelCanvasTransform(P, b.dataset.x);
    else if (k === 'undo') undo();
    else if (k === 'redo') redo();
    else if (k === 'keys') openShortcutSheet();
    else if (k === 'sw') pixelCanvasColor(P, b.dataset.c);
  });
  root.addEventListener('change', ev => {
    const b = ev.target.closest('[data-pc=lock], [data-pc=off], [data-pc=onion]');
    if (!b || !P.cv.isConnected) return;
    if (b.dataset.pc === 'lock') pixelCanvasLock(P, b.checked);
    else if (b.dataset.pc === 'onion') pixelCanvasOnion(P, b.checked);
    else {
      P.showOff = b.checked;
      drawPixelCanvas(P);
    }
  });
  root.addEventListener('input', ev => {
    const b = ev.target.closest('[data-pc=shift]');
    if (!b) return;
    P.symShift[+b.dataset.i] = Math.round(+b.value || 0);
    drawPixelCanvas(P);
  });
  pixelCanvasPanelSync(P);
}
function pixelCanvasPanelSync(P) {
  const r = P.panel;
  if (!r) return;
  r.querySelectorAll('[data-pc=sym]').forEach(b => b.classList.toggle('on', b.dataset.m === (P.symMode || 'off')));
  r.querySelectorAll('.pc-shift').forEach(e => (e.hidden = !P.symMode || P.symMode === 'off'));
  r.querySelectorAll('[data-pc=tool]').forEach(e => e.classList.toggle('on', e.dataset.t === P.tool));
  r.querySelectorAll('[data-pc=grid]').forEach(e => e.classList.toggle('on', !!P.showGrid));
  r.querySelectorAll('.pc-zoom').forEach(e => (e.textContent = P.zoom + '×'));
  r.querySelectorAll('[data-pc=lock]').forEach(e => (e.checked = !!P.lock));
  r.querySelectorAll('[data-pc=off]').forEach(e => (e.checked = !!P.showOff));
  r.querySelectorAll('[data-pc=onion]').forEach(e => (e.checked = !!P.showOnion));
  r.querySelectorAll('.pc-ramps').forEach(e => (e.hidden = !P.lock));
  r.querySelectorAll('.pc-offn').forEach(
    e => (e.textContent = P.showOff && !P.stroke ? `(${P.offCount || 0} pixels)` : '')
  );
  r.querySelectorAll('[data-pc=sw]').forEach(e => e.classList.toggle('on', e.dataset.c.toUpperCase() === P.color));
}
function pixelCanvasOnion(P, on = !P.showOnion) {
  P.showOnion = !!on;
  drawPixelCanvas(P);
}
/* a symmetry mode, or the next one */
function pixelCanvasSymmetry(P, mode) {
  const ks = PIXEL_SYMMETRY.map(m => m[0]);
  P.symMode = mode || ks[(ks.indexOf(P.symMode) + 1) % ks.length];
  drawPixelCanvas(P);
}
/* ---------- the Studio's undo for pictures: a step holds the box that changed, before and after ---------- */
const imageOf = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);
/* a picture at `path` changed from `before` to `after` (ImageData): a step of the undo, after any data edit still
   waiting to be one */
export function artStep(path, before, after) {
  const step = artStepOf(path, before, after);
  if (!step) return;
  commit(true);
  historyArt(studioState, step);
  updateTopBar();
}
/* studio track ST-3: several pictures changed at once, one step of the undo; [path, before, after] each, before null
   for a new picture (undoing it drops the picture) */
export function artSteps(list) {
  const steps = list.map(([path, before, after]) => artStepOf(path, before, after)).filter(Boolean);
  if (!steps.length) return;
  commit(true);
  historyArtGroup(studioState, steps);
  updateTopBar();
}
function artStepOf(path, before, after) {
  if (!path || !after) return null;
  if (!before)
    return {
      art: path,
      whole: true,
      made: true,
      before: { x: 0, y: 0, width: 0, height: 0, data: new Uint8ClampedArray(0) },
      after: { x: 0, y: 0, width: after.width, height: after.height, data: after.data },
    };
  if (before.width !== after.width || before.height !== after.height)
    return {
      art: path,
      whole: true,
      before: { x: 0, y: 0, width: before.width, height: before.height, data: before.data },
      after: { x: 0, y: 0, width: after.width, height: after.height, data: after.data },
    };
  const box = pixelDiffBox(before, after);
  return box ? { art: path, before: pixelCopy(before, box), after: pixelCopy(after, box) } : null;
}
/* the whole picture now, for a step around a change made elsewhere (an upload, a revert) */
export const pictureImage = c => (c ? imageOf(c) : null);
/* undo or redo put a step's pixels back on its picture */
function artStepPut(step, put) {
  if (step.group) {
    const back = put === step.before;
    for (const s of back ? [...step.group].reverse() : step.group) artStepPut(s, back ? s.before : s.after);
    return;
  }
  if (!put.width) {
    forgetArt(step.art);
    document.dispatchEvent(new CustomEvent('studio-art', { detail: { path: step.art } }));
    return;
  }
  const im = new ImageData(new Uint8ClampedArray(put.data), put.width, put.height);
  let c = loadedAtlas(step.art);
  if (step.whole || !c) {
    c = makeCanvas(put.width, put.height);
    c.getContext('2d').putImageData(im, 0, 0);
  } else c.getContext('2d').putImageData(im, put.x, put.y);
  markArt(step.art, c);
  document.dispatchEvent(new CustomEvent('studio-art', { detail: { path: step.art } }));
}
const pixelCanvasRepeat = P => P.o.repeat || 1;
/* the zoom that fits the picture in the stage, a whole number */
export function pixelCanvasFit(P, lo = 2, hi = 24) {
  const c = P.o.get();
  if (!c) return 1;
  const st = P.stage.getBoundingClientRect(),
    n = pixelCanvasRepeat(P);
  return clamp(Math.floor(Math.min((st.width - 40) / (c.width * n), (st.height - 40) / (c.height * n))), lo, hi);
}
/* a whole zoom; the picture pixel under the pointer (or the middle of the view) stays where it is */
export function pixelCanvasZoom(P, z, at = null) {
  const st = P.stage.getBoundingClientRect(),
    ax = at ? at.clientX : st.left + st.width / 2,
    ay = at ? at.clientY : st.top + st.height / 2,
    r0 = P.cv.getBoundingClientRect(),
    fx = r0.width ? (ax - r0.left) / r0.width : 0.5,
    fy = r0.height ? (ay - r0.top) / r0.height : 0.5;
  P.zoom = clamp(Math.round(z), 1, 32);
  drawPixelCanvas(P);
  const r1 = P.cv.getBoundingClientRect();
  P.stage.scrollLeft += r1.left + fx * r1.width - ax;
  P.stage.scrollTop += r1.top + fy * r1.height - ay;
}
export function drawPixelCanvas(P) {
  const c = P.o.get(),
    v = P.cv;
  if (!c || !v.isConnected) return;
  if (!P.zoom) P.zoom = pixelCanvasFit(P);
  const n = pixelCanvasRepeat(P),
    W = c.width * n,
    H = c.height * n;
  if (v.width !== W || v.height !== H) {
    v.width = W;
    v.height = H;
  }
  const x = v.getContext('2d');
  x.clearRect(0, 0, W, H);
  /* onion skin: the host's other view of the part, faint, under the art */
  const on = P.showOnion && P.o.onion ? P.o.onion(P) : null;
  if (on && on.src) {
    const [sx, sy, sw, sh] = on.from,
      ox = n > 1 ? c.width : 0,
      oy = n > 1 ? c.height : 0;
    x.save();
    if (on.clip) {
      x.beginPath();
      x.rect(ox + on.clip[0], oy + on.clip[1], on.clip[2], on.clip[3]);
      x.clip();
    }
    x.globalAlpha = 0.35;
    x.drawImage(on.src, sx, sy, sw, sh, ox + on.to[0], oy + on.to[1], sw, sh);
    x.restore();
  }
  P.onionShown = !!(on && on.src);
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      x.globalAlpha = n > 1 && !(a === 1 && b === 1) ? 0.45 : 1;
      x.drawImage(c, a * c.width, b * c.height);
    }
  x.globalAlpha = 1;
  /* the pixels that are not game palette colours, in magenta */
  P.offCount = 0;
  if (P.showOff && !P.stroke) {
    const m = offPalette(c.getContext('2d').getImageData(0, 0, c.width, c.height), gamePalette()),
      ox = n > 1 ? c.width : 0,
      oy = n > 1 ? c.height : 0;
    x.fillStyle = '#FF00FF';
    for (let i = 0; i < m.length; i++)
      if (m[i]) {
        P.offCount++;
        x.fillRect(ox + (i % c.width), oy + Math.floor(i / c.width), 1, 1);
      }
  }
  P.wrap.style.width = W * P.zoom + 'px';
  P.wrap.style.height = H * P.zoom + 'px';
  P.wrap.dataset.tool = P.tool;
  P.grid.hidden = !(P.showGrid && P.zoom >= PIXEL_GRID_FROM);
  P.grid.style.backgroundSize = `${P.zoom}px ${P.zoom}px`;
  P.over.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const off = n > 1 ? c.width : 0,
    offY = n > 1 ? c.height : 0;
  const sel = P.sel
    ? `<rect class="pc-sel" x="${P.sel[0]}" y="${P.sel[1]}" width="${P.sel[2]}" height="${P.sel[3]}"/>`
    : '';
  const sym = symmetryLines(P, P.stroke ? P.stroke.sym : P.hoverAt ? symmetryAt(P, ...P.hoverAt) : symmetryAt(P));
  P.over.innerHTML = `<g transform="translate(${off} ${offY})">${P.o.overlay ? P.o.overlay(P) : ''}${sel}${sym}</g>`;
  pixelCanvasPanelSync(P);
  if (P.o.drawn) P.o.drawn(P);
}
/* the picture pixel under the pointer (a ground tile's repeats wrap onto the picture) */
function pixelCanvasPoint(P, ev) {
  const c = P.o.get(),
    r = P.cv.getBoundingClientRect(),
    n = pixelCanvasRepeat(P),
    x = Math.floor(((ev.clientX - r.left) / r.width) * c.width * n),
    y = Math.floor(((ev.clientY - r.top) / r.height) * c.height * n);
  if (n === 1) return [x, y];
  const m = (v, k) => ((v % k) + k) % k;
  return [m(x, c.width), m(y, c.height)];
}
/* the point under the pointer in picture pixels, with fractions (not wrapped) */
function pixelCanvasPointF(P, ev) {
  const c = P.o.get(),
    r = P.cv.getBoundingClientRect(),
    n = pixelCanvasRepeat(P);
  return [((ev.clientX - r.left) / r.width) * c.width * n, ((ev.clientY - r.top) / r.height) * c.height * n];
}
/* ---------- strokes: painted into a copy of the picture's pixels, shown as they go, kept when the stroke ends ---------- */
function strokeStart(P) {
  const c = P.o.get(),
    cx = c.getContext('2d');
  P.stroke = {
    c,
    before: cx.getImageData(0, 0, c.width, c.height),
    work: cx.getImageData(0, 0, c.width, c.height),
    sym: P.hoverAt ? symmetryAt(P, P.hoverAt[0], P.hoverAt[1]) : symmetryAt(P),
  };
  return P.stroke;
}
function strokeShow(P) {
  const s = P.stroke;
  s.c.getContext('2d').putImageData(s.work, 0, 0);
  drawPixelCanvas(P);
}
function strokeEnd(P) {
  const s = P.stroke;
  if (!s) return;
  P.stroke = null;
  s.c.getContext('2d').putImageData(s.work, 0, 0);
  if (P.o.path) artStep(P.o.path(), s.before, s.work);
  if (P.o.changed) P.o.changed(P);
  drawPixelCanvas(P);
}
const pixelCanvasInk = P => (P.tool === 'erase' ? null : pixelRgba(P.color));
function strokePlot(P, x, y) {
  const ink = pixelCanvasInk(P);
  for (const [a, b] of pixelMirrored(x, y, P.stroke.sym)) pixelSet(P.stroke.work, a, b, ink);
}
/* ---------- symmetry: mirror every pixel about the middle of the selection, else of the part under the pointer, else
   of the picture; the axis can be moved by half pixels ---------- */
const PIXEL_SYMMETRY = [
  ['off', 'Off'],
  ['v', '↔'],
  ['h', '↕'],
  ['both', 'Both'],
];
function symmetryAt(P, x, y) {
  if (!P.symMode || P.symMode === 'off') return null;
  const c = P.o.get(),
    box = P.sel || (P.o.boxAt && x != null && P.o.boxAt(x, y)) || [0, 0, c.width, c.height],
    s = pixelSymmetryFor(P.symMode, box);
  return { ...s, sx: s.sx + P.symShift[0], sy: s.sy + P.symShift[1], box };
}
/* the axes across the box they mirror in */
const symmetryLines = (P, s) => {
  if (!s) return '';
  const [x, y, w, h] = s.box,
    ax = (s.sx + 1) / 2,
    ay = (s.sy + 1) / 2,
    out = [];
  if (s.mode === 'v' || s.mode === 'both')
    out.push(`<line class="pc-axis" x1="${ax}" y1="${y}" x2="${ax}" y2="${y + h}"/>`);
  if (s.mode === 'h' || s.mode === 'both')
    out.push(`<line class="pc-axis" x1="${x}" y1="${ay}" x2="${x + w}" y2="${ay}"/>`);
  return out.join('');
};
/* a line from a to b over the picture as it was before the stroke (it follows the pointer until let go) */
function strokeLineTo(P, a, b) {
  const s = P.stroke;
  s.work.data.set(s.before.data);
  for (const [x, y] of pixelLine(a, b)) strokePlot(P, x, y);
  s.to = b;
  strokeShow(P);
}
/* the box a flip or turn acts on: the selection, else the host's (the part in focus), else the whole picture */
function pixelCanvasBox(P) {
  const c = P.o.get();
  if (!c) return null;
  if (P.sel) return P.sel;
  return P.o.focusBox ? P.o.focusBox(P) : [0, 0, c.width, c.height];
}
/* flipH, flipV or rotate (a quarter clockwise) on the selection or the part in focus, as one step */
export function pixelCanvasTransform(P, kind) {
  const box = pixelCanvasBox(P);
  if (!box) return toast('Point at a part, or select a box (M), first.');
  strokeStart(P);
  if (kind === 'rotate') {
    const nb = pixelRotate(P.stroke.work, box, 1);
    if (P.sel) P.sel = nb;
  } else pixelFlip(P.stroke.work, box, kind === 'flipV' ? 'v' : 'h');
  strokeEnd(P);
}
/* what a key does (logic/pixel-ops.js PIXEL_KEYS): true when the canvas did it */
export function pixelCanvasAct(P, a) {
  if (!a) return false;
  if (a.startsWith('tool:')) pixelCanvasTool(P, a.slice(5));
  else if (a.startsWith('zoom:')) pixelCanvasZoom(P, +a.slice(5));
  else if (a === 'zoomIn' || a === 'zoomOut') pixelCanvasZoom(P, pixelZoomNext(P.zoom, a === 'zoomIn' ? 1 : -1));
  else if (a === 'zoomFit') pixelCanvasZoom(P, pixelCanvasFit(P, 1, 32));
  else if (a === 'flipH' || a === 'flipV' || a === 'rotate') pixelCanvasTransform(P, a);
  else if (a === 'symmetry') pixelCanvasSymmetry(P);
  else if (a === 'lock') pixelCanvasLock(P);
  else if (a === 'onion') pixelCanvasOnion(P);
  else if (a === 'grid') {
    P.showGrid = !P.showGrid;
    drawPixelCanvas(P);
  } else if (a === 'swap') {
    const c = P.color;
    pixelCanvasColor(P, P.color2 || '#FFFFFF');
    P.color2 = c;
  } else return false;
  return true;
}
export function pixelCanvasDeselect(P) {
  if (!P.sel) return false;
  P.sel = null;
  drawPixelCanvas(P);
  return true;
}
/* ---------- the game palette (next/palette.js): every colour in its ramps ---------- */
let gamePaletteMemo = null;
function gamePalette() {
  const ramps = window.NW_PALETTE && window.NW_PALETTE.ramps;
  if (!gamePaletteMemo || gamePaletteMemo.ramps !== ramps) gamePaletteMemo = { ramps, colors: paletteColors(ramps) };
  return gamePaletteMemo.colors;
}
/* locked to the palette: a colour becomes its nearest palette shade */
function pixelCanvasLock(P, on = !P.lock) {
  P.lock = !!on && gamePalette().length > 0;
  if (P.lock) pixelCanvasColor(P, P.color);
  drawPixelCanvas(P);
}
export function pixelCanvasColor(P, hex) {
  P.color = (P.lock ? paletteNearest(hex, gamePalette()) : hex).toUpperCase();
  if (P.tool === 'erase' || P.tool === 'pick') P.tool = 'pen';
  if (P.o.colorChanged) P.o.colorChanged(P);
  pixelCanvasPanelSync(P);
}
export function pixelCanvasTool(P, t) {
  P.tool = t;
  P.wrap.dataset.tool = t;
  if (P.o.toolChanged) P.o.toolChanged(P);
  pixelCanvasPanelSync(P);
}
function bindPixelCanvasEvents(P) {
  const w = P.wrap;
  let last = null,
    from = null,
    drag = null;
  w.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const c = P.o.get();
    if (!c) return;
    const [x, y] = pixelCanvasPoint(P, ev);
    P.hoverAt = [x, y];
    const took = P.o.hostTool && P.o.hostTool(P, P.tool, x, y, ev);
    if (took && typeof took === 'object') {
      drag = took;
      w.setPointerCapture(ev.pointerId);
    }
    if (took) return;
    if (P.tool === 'pick' || ev.altKey) {
      const d = pixelGet(c.getContext('2d').getImageData(0, 0, c.width, c.height), x, y);
      if (d && d[3]) pixelCanvasColor(P, pixelHex(d[0], d[1], d[2]));
      return;
    }
    w.setPointerCapture(ev.pointerId);
    if (P.tool === 'select') {
      from = [x, y];
      P.sel = pixelClip(c, [x, y, 1, 1]);
      drawPixelCanvas(P);
      return;
    }
    strokeStart(P);
    if (P.tool === 'fill') {
      for (const [a, b] of pixelMirrored(x, y, P.stroke.sym))
        pixelFill(P.stroke.work, a, b, pixelCanvasInk(P), P.o.boxAt ? P.o.boxAt(a, b) : null);
      strokeEnd(P);
      return;
    }
    /* the line tool, or Shift with the pencil or eraser from where the last stroke ended */
    if (P.tool === 'line' || (ev.shiftKey && P.lastAt)) {
      from = P.tool === 'line' && !ev.shiftKey ? [x, y] : P.lastAt;
      strokeLineTo(P, from, [x, y]);
      return;
    }
    last = [x, y];
    strokePlot(P, x, y);
    strokeShow(P);
  });
  w.addEventListener('pointermove', ev => {
    const c = P.o.get();
    if (!c) return;
    if (drag) {
      const [fx, fy] = pixelCanvasPointF(P, ev);
      drag.move(P, fx, fy);
      return;
    }
    const p = pixelCanvasPoint(P, ev);
    if (from && P.tool === 'select') {
      P.sel = pixelClip(c, [
        Math.min(from[0], p[0]),
        Math.min(from[1], p[1]),
        Math.abs(p[0] - from[0]) + 1,
        Math.abs(p[1] - from[1]) + 1,
      ]);
      drawPixelCanvas(P);
      return;
    }
    if (P.stroke && from) {
      strokeLineTo(P, from, p);
      return;
    }
    if (P.stroke && last) {
      for (const [x, y] of pixelLine(last, p)) strokePlot(P, x, y);
      last = p;
      strokeShow(P);
      return;
    }
    const was = P.hoverAt;
    P.hoverAt = p;
    if (P.symMode && P.symMode !== 'off' && !P.sel && P.o.boxAt) {
      const a = was && P.o.boxAt(was[0], was[1]),
        b = P.o.boxAt(p[0], p[1]);
      if (String(a) !== String(b)) drawPixelCanvas(P);
    }
    if (P.o.hover) P.o.hover(P, p[0], p[1]);
  });
  const up = ev => {
    if (drag) {
      const d = drag;
      drag = null;
      d.up(P);
      return;
    }
    if (P.stroke) {
      P.lastAt = from && P.stroke.to ? P.stroke.to : last;
      strokeEnd(P);
    }
    if (from && P.tool === 'select' && P.o.selected) P.o.selected(P);
    last = from = null;
    if (ev.type === 'pointercancel') P.lastAt = null;
  };
  w.addEventListener('pointerup', up);
  w.addEventListener('pointercancel', up);
  P.stage.addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      pixelCanvasZoom(P, pixelZoomNext(P.zoom, ev.deltaY < 0 ? 1 : -1), ev);
    },
    { passive: false }
  );
  /* move the view: the middle button, or the left one with Space held */
  let pan = null;
  P.stage.addEventListener(
    'pointerdown',
    ev => {
      if (!(ev.button === 1 || (ev.button === 0 && P.space))) return;
      ev.preventDefault();
      ev.stopPropagation();
      pan = { x: ev.clientX, y: ev.clientY, l: P.stage.scrollLeft, t: P.stage.scrollTop };
      P.stage.setPointerCapture(ev.pointerId);
      P.stage.classList.add('panning');
    },
    true
  );
  P.stage.addEventListener('pointermove', ev => {
    if (!pan) return;
    P.stage.scrollLeft = pan.l - (ev.clientX - pan.x);
    P.stage.scrollTop = pan.t - (ev.clientY - pan.y);
  });
  const panEnd = () => {
    pan = null;
    P.stage.classList.remove('panning');
  };
  P.stage.addEventListener('pointerup', panEnd);
  P.stage.addEventListener('pointercancel', panEnd);
  const space = ev => {
    if (!P.cv.isConnected) {
      document.removeEventListener('keydown', space);
      document.removeEventListener('keyup', space);
      return;
    }
    if (ev.key !== ' ' || (ev.target.closest && ev.target.closest('input,textarea,select,button'))) return;
    ev.preventDefault();
    P.space = ev.type === 'keydown';
    P.stage.classList.toggle('pan-ready', P.space);
  };
  document.addEventListener('keydown', space);
  document.addEventListener('keyup', space);
}
