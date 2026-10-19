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
     changed(P, before)  a stroke ended (before: the picture's pixels before it)
     drawn(P)     the canvas was drawn (zoom and grid may have changed) */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { clamp } from '../../game/js/util.js';
import { pixelFill, pixelGet, pixelHex, pixelLine, pixelRgba, pixelSet } from '../../game/js/logic/pixel-ops.js';
/* eslint-disable no-func-assign */
expose({
  bindPixelCanvasEvents: [() => bindPixelCanvasEvents, v => (bindPixelCanvasEvents = v)],
  drawPixelCanvas: [() => drawPixelCanvas, v => (drawPixelCanvas = v)],
  pixelCanvas: [() => pixelCanvas, v => (pixelCanvas = v)],
  pixelCanvasColor: [() => pixelCanvasColor, v => (pixelCanvasColor = v)],
  pixelCanvasFit: [() => pixelCanvasFit, v => (pixelCanvasFit = v)],
  pixelCanvasInk: [() => pixelCanvasInk],
  pixelCanvasPoint: [() => pixelCanvasPoint, v => (pixelCanvasPoint = v)],
  pixelCanvasRepeat: [() => pixelCanvasRepeat],
  pixelCanvasTool: [() => pixelCanvasTool, v => (pixelCanvasTool = v)],
  pixelCanvasZoom: [() => pixelCanvasZoom, v => (pixelCanvasZoom = v)],
  strokeEnd: [() => strokeEnd, v => (strokeEnd = v)],
  strokePlot: [() => strokePlot, v => (strokePlot = v)],
  strokeShow: [() => strokeShow, v => (strokeShow = v)],
  strokeStart: [() => strokeStart, v => (strokeStart = v)],
});
/* eslint-enable no-func-assign */
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
  };
  bindPixelCanvasEvents(P);
  return P;
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
export function pixelCanvasZoom(P, z) {
  P.zoom = clamp(Math.round(z), 1, 32);
  drawPixelCanvas(P);
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
  P.grid.hidden = !(P.showGrid && P.zoom >= 6);
  P.grid.style.backgroundSize = `${P.zoom}px ${P.zoom}px`;
  P.over.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const off = n > 1 ? c.width : 0,
    offY = n > 1 ? c.height : 0;
  P.over.innerHTML = `<g transform="translate(${off} ${offY})">${P.o.overlay ? P.o.overlay(P) : ''}</g>`;
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
  if (P.o.changed) P.o.changed(P, s.before);
  drawPixelCanvas(P);
}
const pixelCanvasInk = P => (P.tool === 'erase' ? null : pixelRgba(P.color));
function strokePlot(P, x, y) {
  pixelSet(P.stroke.work, x, y, pixelCanvasInk(P));
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
  let last = null;
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
    strokeStart(P);
    if (P.tool === 'fill') {
      pixelFill(P.stroke.work, x, y, pixelCanvasInk(P), P.o.boxAt ? P.o.boxAt(x, y) : null);
      strokeEnd(P);
      return;
    }
    w.setPointerCapture(ev.pointerId);
    last = [x, y];
    strokePlot(P, x, y);
    strokeShow(P);
  });
  w.addEventListener('pointermove', ev => {
    const c = P.o.get();
    if (!c) return;
    const p = pixelCanvasPoint(P, ev);
    if (P.stroke && last) {
      for (const [x, y] of pixelLine(last, p)) strokePlot(P, x, y);
      last = p;
      strokeShow(P);
      return;
    }
    if (P.o.hover) P.o.hover(P, p[0], p[1]);
  });
  const up = () => {
    if (P.stroke) strokeEnd(P);
    last = null;
  };
  w.addEventListener('pointerup', up);
  w.addEventListener('pointercancel', up);
  P.stage.addEventListener(
    'wheel',
    ev => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      pixelCanvasZoom(P, P.zoom + (ev.deltaY < 0 ? 1 : -1));
    },
    { passive: false }
  );
}
