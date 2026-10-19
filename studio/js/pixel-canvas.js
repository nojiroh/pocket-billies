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
     hostTool(P, t, x, y)  a host's own tool (true when it took the click)
     hover(P, x, y)    the pointer moved over the picture
     focusBox(P)  the box a flip or turn acts on when nothing is selected (the part in focus; null: none)
     path()       where the picture is saved (art/...): a stroke is a step of the Studio's undo for it
     changed(P)   a stroke ended, or an undo or redo changed the picture
     drawn(P)     the canvas was drawn (zoom and grid may have changed) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { loadedAtlas, markArt, provide } from '../../game/js/hooks.js';
import { clamp } from '../../game/js/util.js';
import { makeCanvas } from '../../game/js/art.js';
import { historyArt } from '../../game/js/logic/history.js';
import {
  PIXEL_GRID_FROM,
  pixelClip,
  pixelCopy,
  pixelDiffBox,
  pixelFill,
  pixelGet,
  pixelHex,
  pixelLine,
  pixelRgba,
  pixelSet,
  pixelZoomNext,
} from '../../game/js/logic/pixel-ops.js';
import { commit, studioState, updateTopBar } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  artStep: [() => artStep, v => (artStep = v)],
  artStepPut: [() => artStepPut, v => ((artStepPut = v), provide({ artStepPut }))],
  bindPixelCanvasEvents: [() => bindPixelCanvasEvents, v => (bindPixelCanvasEvents = v)],
  drawPixelCanvas: [() => drawPixelCanvas, v => (drawPixelCanvas = v)],
  imageOf: [() => imageOf],
  pictureImage: [() => pictureImage],
  pixelCanvas: [() => pixelCanvas, v => (pixelCanvas = v)],
  pixelCanvasBox: [() => pixelCanvasBox, v => (pixelCanvasBox = v)],
  pixelCanvasColor: [() => pixelCanvasColor, v => (pixelCanvasColor = v)],
  pixelCanvasDeselect: [() => pixelCanvasDeselect, v => (pixelCanvasDeselect = v)],
  pixelCanvasFit: [() => pixelCanvasFit, v => (pixelCanvasFit = v)],
  pixelCanvasInk: [() => pixelCanvasInk],
  pixelCanvasPoint: [() => pixelCanvasPoint, v => (pixelCanvasPoint = v)],
  pixelCanvasRepeat: [() => pixelCanvasRepeat],
  pixelCanvasTool: [() => pixelCanvasTool, v => (pixelCanvasTool = v)],
  pixelCanvasZoom: [() => pixelCanvasZoom, v => (pixelCanvasZoom = v)],
  strokeEnd: [() => strokeEnd, v => (strokeEnd = v)],
  strokeLineTo: [() => strokeLineTo, v => (strokeLineTo = v)],
  strokePlot: [() => strokePlot, v => (strokePlot = v)],
  strokeShow: [() => strokeShow, v => (strokeShow = v)],
  strokeStart: [() => strokeStart, v => (strokeStart = v)],
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
    zoom: 0,
    showGrid: true,
    stroke: null,
    sel: null /* the selected box, in picture pixels */,
    lastAt: null /* where the last stroke ended: Shift-click draws a line from there */,
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
/* ---------- the Studio's undo for pictures: a step holds the box that changed, before and after ---------- */
const imageOf = c => c.getContext('2d').getImageData(0, 0, c.width, c.height);
/* a picture at `path` changed from `before` to `after` (ImageData): a step of the undo, after any data edit still
   waiting to be one */
export function artStep(path, before, after) {
  if (!path || !before || !after) return;
  commit(true);
  if (before.width !== after.width || before.height !== after.height)
    historyArt(studioState, {
      art: path,
      whole: true,
      before: { x: 0, y: 0, width: before.width, height: before.height, data: before.data },
      after: { x: 0, y: 0, width: after.width, height: after.height, data: after.data },
    });
  else {
    const box = pixelDiffBox(before, after);
    if (!box) return;
    historyArt(studioState, { art: path, before: pixelCopy(before, box), after: pixelCopy(after, box) });
  }
  updateTopBar();
}
/* the whole picture now, for a step around a change made elsewhere (an upload, a revert) */
export const pictureImage = c => (c ? imageOf(c) : null);
/* undo or redo put a step's pixels back on its picture */
function artStepPut(step, put) {
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
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      x.globalAlpha = n > 1 && !(a === 1 && b === 1) ? 0.45 : 1;
      x.drawImage(c, a * c.width, b * c.height);
    }
  x.globalAlpha = 1;
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
  P.over.innerHTML = `<g transform="translate(${off} ${offY})">${P.o.overlay ? P.o.overlay(P) : ''}${sel}</g>`;
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
/* ---------- strokes: painted into a copy of the picture's pixels, shown as they go, kept when the stroke ends ---------- */
function strokeStart(P) {
  const c = P.o.get(),
    cx = c.getContext('2d');
  P.stroke = { c, before: cx.getImageData(0, 0, c.width, c.height), work: cx.getImageData(0, 0, c.width, c.height) };
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
  pixelSet(P.stroke.work, x, y, pixelCanvasInk(P));
}
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
export function pixelCanvasDeselect(P) {
  if (!P.sel) return false;
  P.sel = null;
  drawPixelCanvas(P);
  return true;
}
export function pixelCanvasColor(P, hex) {
  P.color = hex.toUpperCase();
  if (P.tool === 'erase' || P.tool === 'pick') P.tool = 'pen';
  if (P.o.colorChanged) P.o.colorChanged(P);
}
export function pixelCanvasTool(P, t) {
  P.tool = t;
  P.wrap.dataset.tool = t;
  if (P.o.toolChanged) P.o.toolChanged(P);
}
function bindPixelCanvasEvents(P) {
  const w = P.wrap;
  let last = null,
    from = null;
  w.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const c = P.o.get();
    if (!c) return;
    const [x, y] = pixelCanvasPoint(P, ev);
    if (P.o.hostTool && P.o.hostTool(P, P.tool, x, y)) return;
    if (P.tool === 'pick') {
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
      pixelFill(P.stroke.work, x, y, pixelCanvasInk(P), P.o.boxAt ? P.o.boxAt(x, y) : null);
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
    if (P.o.hover) P.o.hover(P, p[0], p[1]);
  });
  const up = ev => {
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
