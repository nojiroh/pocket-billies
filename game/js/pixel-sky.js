'use strict';
/* ================= PIXEL SKY ================= */
/* UI-5: the animated pixel sky behind the app, moved from ui.js as it was */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { random } from './util.js';
import { activeBattle, reducedMotion } from './game-state.js';
import { frameTask } from './frame-scheduler.js';
import { makeCanvas } from './art.js';
/* eslint-disable no-func-assign */
expose({
  SKY_STOPS: [() => SKY_STOPS],
  buildPixelSky: [() => buildPixelSky, v => (buildPixelSky = v)],
  initPixelSky: [() => initPixelSky, v => (initPixelSky = v)],
  isDark: [() => isDark],
  pixelSky: [() => pixelSky],
  pixelSkyTick: [() => pixelSkyTick, v => (pixelSkyTick = v)],
  resizePixelSky: [() => resizePixelSky, v => (resizePixelSky = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* ---------- animated pixel sky behind the app ---------- */
const pixelSky = { cv: null, x: null, last: 0, w: 160, h: 300, dark: null, base: null, isl: [], sp: [] };
provide({ pixelSky }); /* to-module */
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
/* the sky's colours top to bottom (the old sky pictures, deleted from art/background on main, drawn as a gradient) */
const SKY_STOPS = {
  light: ['#9a86b8', '#dcc0de', '#eecac8', '#fae4c8', '#fdf0da'],
  dark: ['#05040a', '#100c22', '#1c1538', '#3a2758', '#4a2e5e'],
};
function buildPixelSky() {
  const W = pixelSky.w,
    H = pixelSky.h,
    dk = pixelSky.dark,
    stops = SKY_STOPS[dk ? 'dark' : 'light'],
    c = makeCanvas(W, H),
    x = c.getContext('2d'),
    g = x.createLinearGradient(0, 0, 0, H);
  stops.forEach((col, i) => g.addColorStop(i / (stops.length - 1), col));
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  pixelSky.base = c;
  pixelSky.sp = Array.from({ length: dk ? 40 : 14 }, () => ({
    x: random() * W,
    y: random() * H * 0.8,
    p: random() * 6,
  }));
}
export function initPixelSky() {
  const c = document.createElement('canvas');
  c.id = 'bgfx';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  pixelSky.cv = c;
  pixelSky.x = c.getContext('2d');
  resizePixelSky();
  window.addEventListener('resize', resizePixelSky);
  frameTask('bg', pixelSkyTick, () => (activeBattle ? 1 : 15));
}
function resizePixelSky() {
  pixelSky.w = 160;
  pixelSky.h = Math.max(200, Math.round((160 * innerHeight) / Math.max(1, innerWidth)));
  pixelSky.cv.width = pixelSky.w;
  pixelSky.cv.height = pixelSky.h;
  pixelSky.dark = null;
}
function pixelSkyTick(ts) {
  if (activeBattle) return;
  pixelSky.last = ts;
  const dk = isDark();
  if (dk !== pixelSky.dark) {
    pixelSky.dark = dk;
    buildPixelSky();
  }
  if (reducedMotion && pixelSky._still === pixelSky.base) return;
  pixelSky._still = pixelSky.base;
  const x = pixelSky.x,
    W = pixelSky.w,
    H = pixelSky.h,
    t = reducedMotion ? 0 : ts;
  x.imageSmoothingEnabled = false;
  x.drawImage(pixelSky.base, 0, 0);
  const sx = W * 0.78,
    sy = H * 0.16,
    pr = 10 + Math.sin(t / 900) * 1.2;
  x.globalCompositeOperation = 'lighter';
  [
    [pr * 3.2, 0.06],
    [pr * 2, 0.1],
    [pr * 1.3, 0.18],
  ].forEach(([r, a]) => {
    x.fillStyle = `rgba(255,${dk ? 190 : 214},${dk ? 120 : 150},${a})`;
    x.beginPath();
    x.arc(sx, sy, r, 0, 7);
    x.fill();
  });
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = dk ? '#FFE9A8' : '#FFF8E0';
  x.beginPath();
  x.arc(Math.round(sx), Math.round(sy), 6, 0, 7);
  x.fill();
  pixelSky.sp.forEach(p => {
    const a = 0.5 + 0.5 * Math.sin(t / 500 + p.p);
    if (a < 0.55) return;
    x.fillStyle = dk ? `rgba(255,240,200,${a})` : `rgba(255,255,255,${a * 0.8})`;
    x.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  });
}
