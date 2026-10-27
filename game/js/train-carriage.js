'use strict';
/* ================= THE CARRIAGE (hub track HB-8) =================
   The run's loading screen at a take-off (run-loading.js, pb-loading's `view` slot) shows the inside of the run's sky
   train: its seat backs, the luggage rack, the windows, and the portal's tunnel streaming past them. A small canvas
   drawn as pixel art (about 144 px across, scaled up without smoothing), the size of the screen it fills, in the
   train's own colours. It moves while it is on the page (one frame a requestAnimationFrame, nothing once it is gone);
   with reduced motion it is drawn once, still. Its colours are the train's catalogue entry's (`carriage`, and the
   portal's `tunnel`: tools/build-station-trains.py). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { walkData } from './walk-view.js';
/* eslint-disable no-func-assign */
expose({
  carriageDraw: [() => carriageDraw, v => (carriageDraw = v)],
  carriageTunnel: [() => carriageTunnel, v => (carriageTunnel = v)],
  hash: [() => hash],
  trainCarriage: [() => trainCarriage, v => (trainCarriage = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const hash = (/** @type {number} */ i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** the carriage for train `key`: a canvas (in a box that fades it into the screen's own colour under the text),
 * moving until it leaves the page @param {string} key @param {boolean} still drawn once (reduced motion)
 * @returns {HTMLElement} */
export function trainCarriage(key, still) {
  const cv = document.createElement('canvas'),
    vw = Math.max(1, window.innerWidth || 390),
    /* the top half of the screen (pb-loading night: its text below) */
    vh = Math.max(1, (window.innerHeight || 640) * 0.48),
    w = 144,
    h = Math.max(64, Math.min(200, Math.round((w * vh) / vw)));
  cv.width = w;
  cv.height = h;
  const box = document.createElement('div');
  box.className = 'train-carriage';
  box.setAttribute('aria-hidden', 'true');
  box.appendChild(cv);
  const c = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d')),
    C = walkData().sc.props,
    M = C[key] || C.train_greenbelt || {},
    P = C.sky_portal || {},
    L = M.carriage || { wall: 'gray', trim: 'silver', seat: 'dimgray', dark: 'black', bags: [] },
    T = P.tunnel || ['black', 'midnightblue', 'slateblue', 'royalblue', 'skyblue', 'white'],
    t0 = performance.now();
  const frame = () => {
    carriageDraw(c, w, h, L, T, still ? 0 : performance.now() - t0);
    if (!still && (cv.isConnected || performance.now() - t0 < 1000)) requestAnimationFrame(frame);
  };
  frame();
  return box;
}

/** one picture of the carriage at t ms @param {CanvasRenderingContext2D} c @param {number} w @param {number} h
 * @param {{ wall: string, trim: string, seat: string, dark: string, bags: string[] }} L the carriage's colours
 * @param {string[]} T the tunnel's @param {number} t */
function carriageDraw(c, w, h, L, T, t) {
  c.imageSmoothingEnabled = false;
  c.fillStyle = L.wall;
  c.fillRect(0, 0, w, h);
  /* the ceiling's shade and its lamps */
  c.fillStyle = L.dark;
  c.fillRect(0, 0, w, Math.round(h * 0.06));
  const n = w < h ? 2 : 3,
    gap = 6,
    ww = Math.floor((w - gap * (n + 1)) / n),
    wy = Math.round(h * 0.12),
    wh = Math.round(h * 0.3);
  for (let i = 0; i < n; i++) {
    const wx = gap + i * (ww + gap);
    /* the window's frame, then the tunnel through it */
    c.fillStyle = L.trim;
    c.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
    carriageTunnel(c, wx, wy, ww, wh, T, t, i);
    /* the glass's shine */
    c.fillStyle = 'rgba(255,255,255,0.10)';
    for (let k = 0; k < 4; k++) c.fillRect(wx + 3 + k, wy + wh - 4 - k * 3, ww * 0.35, 1);
    /* a lamp between the windows */
    c.fillStyle = 'rgba(255,232,160,0.95)';
    c.fillRect(wx + ww + gap / 2 - 1, wy - 6, 2, 2);
  }
  /* the luggage rack: a brass bar and the bags on it */
  const ry = wy - 9;
  c.fillStyle = L.trim;
  c.fillRect(0, ry + 4, w, 2);
  for (let i = 0; i < L.bags.length; i++) {
    const bx = Math.round(hash(i + 3) * (w - 16)),
      bw = 8 + Math.round(hash(i + 9) * 8);
    c.fillStyle = L.bags[i];
    c.fillRect(bx, ry - 1, bw, 5);
  }
  /* the seat backs, a row of them below the windows, and the floor's dark */
  const sy = Math.round(h * 0.6);
  c.fillStyle = L.dark;
  c.fillRect(0, sy + 6, w, h - sy - 6);
  const sw = Math.round(w / (n + 0.5));
  for (let i = 0; i <= n; i++) {
    const sx = Math.round(i * sw - sw * 0.25);
    c.fillStyle = L.seat;
    c.fillRect(sx + 2, sy, sw - 4, h - sy);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(sx + 4, sy + 2, sw - 8, 2);
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(sx + 2, sy, 2, h - sy);
  }
  /* the tunnel's light on the carriage, pulsing as the rings go by */
  const pulse = 0.06 + 0.05 * Math.max(0, Math.sin(t / 140));
  c.fillStyle = `rgba(143,228,255,${pulse.toFixed(3)})`;
  c.fillRect(0, 0, w, h);
}

/** the portal's tunnel through one window: streaks of its colours rushing past, rings flashing by
 * @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} w @param {number} h
 * @param {string[]} TUNNEL its colours, darkest first @param {number} t @param {number} win */
function carriageTunnel(c, x, y, w, h, TUNNEL, t, win) {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = TUNNEL[0];
  c.fillRect(x, y, w, h);
  /* the far glow down the tunnel's middle */
  c.fillStyle = TUNNEL[1];
  c.fillRect(x, y + Math.round(h * 0.3), w, Math.round(h * 0.4));
  c.fillStyle = TUNNEL[2];
  c.fillRect(x, y + Math.round(h * 0.42), w, Math.round(h * 0.16));
  /* streaks: each its own row, length and speed, rushing right to left, the same tunnel through every window */
  for (let i = 0; i < 26; i++) {
    const r = hash(i),
      sp = 0.05 + hash(i + 40) * 0.12,
      len = 4 + Math.round(hash(i + 80) * 14),
      span = 3 * w,
      gx = (((r * span - t * sp - win * w * 1.1) % span) + span) % span,
      sx = x + Math.round(gx - len),
      sy = y + Math.round(hash(i + 120) * (h - 1));
    if (sx > x + w || sx + len < x) continue;
    c.fillStyle = TUNNEL[2 + Math.floor(hash(i + 160) * 4)];
    c.fillRect(sx, sy, len, 1);
  }
  /* a ring of the tunnel flashing past: a bright band crossing the window */
  const ring = ((t / 4.2 + win * 37) % (w * 2.6)) | 0,
    rx = x + w - ring;
  if (rx > x - 3 && rx < x + w) {
    c.fillStyle = TUNNEL[4];
    c.fillRect(rx, y, 2, h);
    c.fillStyle = TUNNEL[5];
    c.fillRect(rx + 1, y, 1, h);
  }
  c.restore();
}
