'use strict';
/* ================= THE OPENING: THE FALL =================
   v47: the first minute of the story, before Sundown (lore.story: the fall).
   1. The surface, late: a street under a billboard for Vinylla's Forever Tour. You walk by with a lanyard round your
      neck, looking at your phone; the pavement gives way. (pixel art on a small canvas, a few screen pixels to one)
   2. Through the crust: soil, rock, pipes, a crate from Legacy Labs, a seam of magma, tumbling, light below.
   3. The inner sky: you come out on the far side of the Hollow Earth and fall right across it, past the Inner Sun, down
      to Sundown, filmed with the world map's renderer, the real Hollow Earth (world-map-gl.js).
   4. A white flash, and the walk scene takes over (cutscene.js): you wake in the dust outside Hazel's lab, the papers
      that fell with you still fluttering down.
   Skip ends the fall at once; without the fall, the step-by-step intro tells it in words. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { openingDone, provide } from './hooks.js';
import { $, clamp } from './util.js';
import { MOVES, SPECIES, START_NODE, typeEffectiveness } from './game-data.js';
import { maxHp } from './logic/rules.js';
import { actorTypes, fighter } from './logic/battle-engine.js';
import { activeBattle, escapeHtml, reducedMotion } from './game-state.js';
import { artLoad } from './art.js';
import { portraitHTML } from './person-art.js';
import { particleSprite } from './battle-stage.js';
import { walkView } from './walk-view.js';
import { ensurePrograms, gpuState } from './engine/webgl.js';
import { POST_EFFECT_SHADERS } from './engine/post-effects.js';
import { canvasForContext, ensureWalkGl, standingHeightAt } from './walk-view-gl.js';
import { endBattle, stopTimers } from './battle.js';
import { LOCATION_VECTORS, WORLD_ART, vector3, worldMap, worldMapHeight, worldMapWidth } from './world-map.js';
import { WORLD_MAP_GL_SHADERS, worldMapGl, worldMapGlRender, worldMapGlSize } from './world-map-gl.js';
import { music, soundEffect } from './sound.js';
import { cutscene, cutsceneCaption } from './cutscene.js';
/* eslint-disable no-func-assign */
expose({
  FALL_BANDS: [() => FALL_BANDS],
  FALL_LEG_PIXELS: [() => FALL_LEG_PIXELS],
  FALL_PALETTE: [() => FALL_PALETTE],
  FALL_PLAYER_PIXELS: [() => FALL_PLAYER_PIXELS],
  FALL_STILLS: [() => FALL_STILLS],
  TUTOR_TIPS: [() => TUTOR_TIPS],
  battleTip: [() => battleTip, v => (battleTip = v)],
  battleTipHide: [() => battleTipHide, v => ((battleTipHide = v), provide({ battleTipHide }))],
  battleTutor: [() => battleTutor, v => ((battleTutor = v), provide({ battleTutor }))],
  drawFallingPlayer: [() => drawFallingPlayer, v => (drawFallingPlayer = v)],
  fallCamera: [() => fallCamera, v => (fallCamera = v)],
  fallCanvas: [() => fallCanvas, v => (fallCanvas = v)],
  fallCrust: [() => fallCrust, v => (fallCrust = v)],
  fallFont: [() => fallFont, v => (fallFont = v)],
  fallOverWorldMap: [() => fallOverWorldMap, v => (fallOverWorldMap = v)],
  fallPlay: [() => fallPlay, v => ((fallPlay = v), provide({ fallPlay }))],
  fallRandom: [() => fallRandom],
  fallSky: [() => fallSky, v => (fallSky = v)],
  fallStill: [() => fallStill, v => (fallStill = v)],
  fallStreet: [() => fallStreet, v => (fallStreet = v)],
  fallWorldMapCanvas: [() => fallWorldMapCanvas, v => (fallWorldMapCanvas = v)],
  landing: [() => landing],
  landingBurst: [() => landingBurst, v => ((landingBurst = v), provide({ landingBurst }))],
  landingFrame: [() => landingFrame, v => ((landingFrame = v), provide({ landingFrame }))],
  openingFall: [() => openingFall],
  tutorSkip: [() => tutorSkip, v => (tutorSkip = v)],
  tutorTypesTip: [() => tutorTypesTip, v => (tutorTypesTip = v)],
});
/* eslint-enable no-func-assign */
provide({ battleTipHide, battleTutor, fallPlay, landingBurst, landingFrame });
/* to-module: end */
const openingFall = { cv: null, x: null, raf: 0, run: 0, W: 0, H: 0 };
provide({ openingFall }); /* to-module */
const fallRandom = (a, b) => {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function fallCanvas() {
  let cv = $('#csFall');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'csFall';
    cv.className = 'cs-fall';
    const cs = $('#cs');
    (cs || document.body).prepend(cv);
  }
  const w = innerWidth,
    h = innerHeight,
    s = Math.min(w, h) / 140;
  openingFall.W = Math.round(w / s);
  openingFall.H = Math.round(h / s);
  if (cv.width !== openingFall.W || cv.height !== openingFall.H) {
    cv.width = openingFall.W;
    cv.height = openingFall.H;
  }
  openingFall.cv = cv;
  openingFall.x = cv.getContext('2d');
  openingFall.x.imageSmoothingEnabled = false;
  cv.hidden = false;
  return cv;
}
/* the walk scene's canvas, ready for the world map's renderer (the map is drawn on it before Sundown is mounted) */
export function fallWorldMapCanvas() {
  if (typeof worldMapGlRender !== 'function' || typeof ensureWalkGl !== 'function' || gpuState.fail || gpuState.lost)
    return null;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv = canvasForContext(cv, 'gl');
  if (!ensureWalkGl(cv)) return null;
  try {
    ensurePrograms(WORLD_MAP_GL_SHADERS);
    ensurePrograms(POST_EFFECT_SHADERS);
  } catch (e) {
    console.error(e);
    return null;
  }
  cv.classList.add('gl');
  return cv;
}
function fallFont(px) {
  return `400 ${px}px Tiny5, ui-monospace, monospace`;
}
/* ---- you, as a few pixels: hair, face lit by your phone, a blue hoodie with the lanyard, jeans (7 x 16) ---- */
const FALL_PALETTE = {
  h: '#3A2A20',
  s: '#F0C8A0',
  S: '#BFF4FF',
  k: '#1E1830',
  b: '#4A6FA5',
  B: '#34507E',
  y: '#F2C14E',
  c: '#FFF8EC',
  P: '#20202A',
  p: '#8EF0FF',
  j: '#2A3048',
  e: '#E8E0D0',
};
const FALL_PLAYER_PIXELS = [
  '..hhh..',
  '.hhhhh.',
  '.hSSs..',
  '..SSs..',
  '..kkk..',
  '.bbbbb.',
  'bbybbBb',
  'bbybbPp',
  '.bcbBb.',
  '.bbbB..',
  '.jjjj..',
];
const FALL_LEG_PIXELS = [
  ['.jj.jj.', '.jj..jj', 'jj...jj', 'ee...ee', '.......'],
  ['..jjj..', '..jjj..', '..jjj..', '..eee..', '.......'],
];
function drawFallingPlayer(x0, y0, frame, ph) {
  const x = openingFall.x,
    rows = FALL_PLAYER_PIXELS.concat(FALL_LEG_PIXELS[frame || 0]);
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < 7; c++) {
      let ch = rows[r][c];
      if (ch === '.') continue;
      if (!ph && (ch === 'S' || ch === 'p')) ch = ch === 'S' ? 's' : 'P';
      x.fillStyle = FALL_PALETTE[ch];
      x.fillRect(x0 + c, y0 + r, 1, 1);
    }
}
/* ---- 1. the surface ---- */
function fallStreet(t) {
  const x = openingFall.x,
    W = openingFall.W,
    H = openingFall.H,
    gY = Math.round(H - clamp(H * 0.2, 26, 64)),
    shake =
      !reducedMotion && t > 5 && t < 7.2
        ? Math.round((fallRandom(Math.floor(t * 30), 3) - 0.5) * 2 * (t > 6.3 ? 2 : 1))
        : 0,
    drop = t > 6.9 ? Math.pow((t - 6.9) / 0.5, 2) * H * 0.6 : 0;
  x.fillStyle = '#050408';
  x.fillRect(0, 0, W, H);
  x.save();
  x.translate(shake, -drop);
  const g = x.createLinearGradient(0, 0, 0, gY);
  g.addColorStop(0, '#14122E');
  g.addColorStop(0.55, '#3A2A5E');
  g.addColorStop(0.85, '#8A4E7A');
  g.addColorStop(1, '#E0876A');
  x.fillStyle = g;
  x.fillRect(-4, -4, W + 8, gY + 4);
  for (let i = 0; i < 70; i++) {
    const sx = Math.floor(fallRandom(i, 1) * W),
      sy = Math.floor(fallRandom(i, 2) * gY * 0.55);
    if (fallRandom(i, Math.floor(t * 2)) > 0.15) {
      x.fillStyle = fallRandom(i, 9) > 0.8 ? '#FFE9A8' : '#C8C8F0';
      x.fillRect(sx, sy, 1, 1);
    }
  }
  /* the moon, full and a little smug */
  const mx = Math.round(W * 0.76),
    my = Math.round(Math.min(gY * 0.2, 34)),
    mg = x.createRadialGradient(mx, my, 0, mx, my, 20);
  mg.addColorStop(0, 'rgba(255,242,208,.35)');
  mg.addColorStop(1, 'rgba(255,242,208,0)');
  x.fillStyle = mg;
  x.fillRect(mx - 20, my - 20, 40, 40);
  x.fillStyle = '#FFF2D0';
  x.beginPath();
  x.arc(mx, my, 7, 0, 7);
  x.fill();
  x.fillStyle = '#E8D8B0';
  x.fillRect(mx - 3, my - 2, 2, 2);
  x.fillRect(mx + 2, my + 2, 2, 1);
  x.fillRect(mx - 1, my + 3, 1, 1);
  /* the skyline: a far row in haze, a near row with lit windows */
  let bx = -4,
    k = 0;
  while (bx < W + 4) {
    const bw = 12 + Math.floor(fallRandom(k, 14) * 14),
      bh = 36 + Math.floor(fallRandom(k, 15) * Math.min(110, gY * 0.55));
    x.fillStyle = '#2E2650';
    x.fillRect(bx, gY - bh, bw, bh);
    if (fallRandom(k, 16) > 0.6) {
      x.fillStyle = '#E25A5A';
      x.fillRect(bx + (bw >> 1), gY - bh - 3, 1, 3);
      if (Math.floor(t * 1.5 + k) % 2) x.fillRect(bx + (bw >> 1), gY - bh - 4, 1, 1);
    }
    bx += bw;
    k++;
  }
  bx = -6;
  k = 0;
  while (bx < W + 6) {
    const bw = 10 + Math.floor(fallRandom(k, 4) * 16),
      bh = 22 + Math.floor(fallRandom(k, 5) * Math.min(80, gY * 0.42)),
      top = gY - bh;
    x.fillStyle = k % 2 ? '#221C3C' : '#28214A';
    x.fillRect(bx, top, bw, bh);
    x.fillStyle = '#352C5E';
    x.fillRect(bx, top, bw, 1);
    for (let wy = top + 4; wy < gY - 14; wy += 5)
      for (let wx = bx + 2; wx < bx + bw - 2; wx += 4)
        if (fallRandom(wx * 7 + k, wy) > 0.7) {
          x.fillStyle = fallRandom(wx, wy * 3) > 0.5 ? '#FFD88A' : '#F2B65E';
          x.fillRect(wx, wy, 2, 2);
        }
    bx += bw;
    k++;
  }
  /* the billboard: Vinylla, the Forever Tour */
  const bw = Math.min(W - 16, 80),
    bh = 30,
    bX = Math.round(W / 2 - bw / 2),
    bY = gY - 68;
  x.fillStyle = '#120E1E';
  x.fillRect(bX + 8, bY + bh, 2, gY - bY - bh);
  x.fillRect(bX + bw - 10, bY + bh, 2, gY - bY - bh);
  x.fillRect(bX - 2, bY - 2, bw + 4, bh + 4);
  const bg = x.createLinearGradient(bX, bY, bX + bw, bY + bh);
  bg.addColorStop(0, '#C2408A');
  bg.addColorStop(1, '#5A2A8A');
  x.fillStyle = bg;
  x.fillRect(bX, bY, bw, bh);
  const rc = [bX + bw - 14, bY + bh / 2];
  x.fillStyle = '#120E1E';
  x.beginPath();
  x.arc(rc[0], rc[1], 11, 0, 7);
  x.fill();
  x.fillStyle = '#2A2238';
  x.beginPath();
  x.arc(rc[0], rc[1], 7, 0, 7);
  x.fill();
  x.fillStyle = '#F2C14E';
  x.beginPath();
  x.arc(rc[0], rc[1], 3, 0, 7);
  x.fill();
  x.fillStyle = '#FFE9A8';
  x.font = fallFont(16);
  x.textBaseline = 'alphabetic';
  x.fillText('VINYLLA', bX + 4, bY + 15);
  x.fillStyle = '#FFF7E6';
  x.font = fallFont(8);
  x.fillText('FOREVER TOUR', bX + 4, bY + 25);
  if (Math.floor(t * 3) % 5) ((x.fillStyle = 'rgba(255,180,230,.16)'), x.fillRect(bX - 4, bY - 4, bw + 8, bh + 8));
  /* a smaller board: Legacy Labs, "Your fortune, backed up" (where there's room) */
  if (W >= 170) {
    const lx = 6,
      ly = gY - 50;
    x.fillStyle = '#120E1E';
    x.fillRect(lx + 18, ly + 12, 2, gY - ly - 12);
    x.fillRect(lx - 1, ly - 1, 42, 14);
    x.fillStyle = '#E8F2EA';
    x.fillRect(lx, ly, 40, 12);
    x.fillStyle = '#3F8A63';
    x.font = fallFont(8);
    x.fillText('LEGACY', lx + 3, ly + 9);
  }
  /* shopfronts along the street, a lit doorway */
  x.fillStyle = '#1A1530';
  x.fillRect(-4, gY - 12, W + 8, 12);
  for (let i = 0; i < W; i += 9) {
    const lit = fallRandom(i, 21);
    if (lit > 0.45) {
      x.fillStyle = lit > 0.8 ? '#FFE4A0' : '#C99A5A';
      x.fillRect(i + 2, gY - 9, 5, 5);
    }
  }
  /* pavement, kerb, road */
  x.fillStyle = '#57525E';
  x.fillRect(-4, gY, W + 8, 4);
  x.fillStyle = '#77707F';
  x.fillRect(-4, gY, W + 8, 1);
  x.fillStyle = '#3C3846';
  x.fillRect(-4, gY + 4, W + 8, 1);
  x.fillStyle = '#24222C';
  x.fillRect(-4, gY + 5, W + 8, H - gY);
  for (let i = 0; i < W; i += 12) {
    x.fillStyle = '#CFC6AE';
    x.fillRect(i, gY + Math.round((H - gY) * 0.45), 6, 1);
  }
  for (const lx of [Math.round(W * 0.16), Math.round(W * 0.84)]) {
    x.fillStyle = '#120E1E';
    x.fillRect(lx, gY - 36, 2, 36);
    x.fillRect(lx - 2, gY - 37, 6, 2);
    const lg = x.createRadialGradient(lx + 1, gY - 34, 0, lx + 1, gY - 34, 22);
    lg.addColorStop(0, 'rgba(255,220,150,.5)');
    lg.addColorStop(1, 'rgba(255,220,150,0)');
    x.fillStyle = lg;
    x.fillRect(lx - 22, gY - 56, 46, 46);
    x.fillStyle = '#FFE9A8';
    x.fillRect(lx, gY - 35, 2, 1);
    x.fillStyle = 'rgba(255,220,150,.18)';
    x.fillRect(lx - 9, gY, 20, 4);
  }
  /* the crack and the hole, under your feet */
  const fx = Math.round(Math.min(W * 0.5 - 3, -8 + (t / 4.6) * (W * 0.5 + 5))),
    cx = fx + 3,
    hr = t > 6.2 ? Math.min(9, (t - 6.2) * 24) : 0;
  if (t > 5.5) {
    const n = Math.min(1, (t - 5.5) / 0.8);
    x.fillStyle = '#0B0912';
    for (let i = 0; i < 14; i++) {
      const a = fallRandom(i, 77) * 6.28,
        L = Math.floor(n * (6 + fallRandom(i, 78) * 14));
      for (let q = 0; q < L; q++) {
        const px = Math.round(cx + Math.cos(a) * q + Math.sin(q * 1.7 + i)),
          py = Math.round(gY + 1 + Math.abs(Math.sin(a)) * q * 0.25);
        if (py < gY + 4) x.fillRect(px, py, 1, 1);
      }
    }
  }
  if (hr) {
    x.fillStyle = '#050408';
    x.beginPath();
    x.ellipse(cx, gY + 1, hr, hr * 0.32, 0, 0, 7);
    x.fill();
  }
  /* you: walking in, stopping to read your phone, then down you go (into the hole, not through the pavement) */
  const fall = t > 6.45 ? Math.pow((t - 6.45) / 0.5, 2) * 40 : 0,
    fy = gY - 16 + Math.round(fall),
    walking = t < 4.6;
  if (fy < H + 20) {
    x.save();
    if (fall > 0) {
      x.beginPath();
      x.rect(-8, -8, W + 16, gY + 9);
      x.ellipse(cx, gY + 1, Math.max(1, hr), Math.max(1, hr * 0.32), 0, 0, 7);
      x.clip();
    }
    drawFallingPlayer(fx, fy, walking ? Math.floor(t * 6) % 2 : 1, t < 5.6);
    x.restore();
    if (t < 5.6) {
      x.fillStyle = 'rgba(142,240,255,.22)';
      x.fillRect(fx + 1, fy + 1, 6, 4);
    }
  }
  x.restore();
  if (t > 7.1) {
    x.fillStyle = `rgba(5,4,8,${clamp((t - 7.1) / 0.3, 0, 1)})`;
    x.fillRect(0, 0, W, H);
  }
}
/* ---- 2. through the crust ---- */
const FALL_BANDS = [
  '#5E4430',
  '#6B4A2E',
  '#4A3A2E',
  '#5A5A66',
  '#46424E',
  '#3A3440',
  '#5A5A66',
  '#3A3440',
  '#7A3A2A',
  '#3A3440',
];
function fallCrust(t) {
  const x = openingFall.x,
    W = openingFall.W,
    H = openingFall.H,
    sp = H * 1.7,
    off = t * sp,
    BH = 26,
    n = FALL_BANDS.length;
  x.fillStyle = '#2A2430';
  x.fillRect(0, 0, W, H);
  const i0 = Math.floor((off - H * 0.2) / BH) - 1;
  for (let i = i0; i < i0 + Math.ceil(H / BH) + 3; i++) {
    const y = Math.round(i * BH - off + H * 0.2),
      c = FALL_BANDS[((i % n) + n) % n],
      seed = ((i % 997) + 997) % 997;
    /* each layer's top edge wanders a little */
    x.fillStyle = c;
    x.beginPath();
    x.moveTo(-2, y + BH + 8);
    for (let q = -2; q <= W + 4; q += 4)
      x.lineTo(q, y + Math.round(Math.sin(q * 0.07 + seed) * 2 + fallRandom(seed, q >> 2) * 2));
    x.lineTo(W + 4, y + BH + 8);
    x.closePath();
    x.fill();
    for (let q = 0; q < W * 1.2; q++) {
      const sx = Math.floor(fallRandom(seed, q) * W),
        sy = y + 3 + Math.floor(fallRandom(q, seed) * (BH - 3));
      x.fillStyle = fallRandom(seed * 3, q) > 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.18)';
      x.fillRect(sx, sy, 1, 1);
    }
    /* stones in the layer */
    for (let r = 0; r < 3; r++) {
      if (fallRandom(seed, 40 + r) < 0.45) continue;
      const rx = Math.floor(fallRandom(seed, 50 + r) * W),
        ry = y + 7 + Math.floor(fallRandom(seed, 60 + r) * (BH - 13)),
        rw = 2 + Math.floor(fallRandom(seed, 70 + r) * 5),
        rh = Math.max(2, Math.round(rw * 0.6));
      for (let dy = -rh; dy <= rh; dy++) {
        const hw = Math.round(rw * Math.sqrt(Math.max(0, 1 - (dy / (rh + 0.5)) ** 2)));
        if (hw < 1) continue;
        x.fillStyle = dy === rh ? 'rgba(0,0,0,.35)' : dy <= -rh + 1 ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)';
        x.fillRect(rx - hw, ry + dy, hw * 2, 1);
      }
    }
    if (c === '#7A3A2A') {
      x.fillStyle = 'rgba(255,140,60,.5)';
      x.fillRect(0, y + 11, W, 3);
      x.fillStyle = '#FFB060';
      for (let q = 0; q < W; q += 7) x.fillRect(q + (seed % 3), y + 12, 2, 1);
    }
  }
  /* things on the way down: a pipe, a fossil in a tie, a crate from Legacy Labs, a cable */
  const things = [
    [0.25, 'pipe'],
    [0.9, 'fossil'],
    [1.45, 'crate'],
    [2.0, 'cable'],
  ];
  for (const [at, k] of things) {
    const y = Math.round(H * 1.1 - (t - at) * sp * 0.9);
    if (y < -40 || y > H + 40) continue;
    if (k === 'pipe') {
      x.fillStyle = '#7A7E88';
      x.fillRect(0, y, W, 5);
      x.fillStyle = '#A4A8B2';
      x.fillRect(0, y, W, 1);
      for (let q = 8; q < W; q += 24) {
        x.fillStyle = '#5A5E68';
        x.fillRect(q, y - 1, 3, 7);
      }
    }
    if (k === 'cable') {
      x.strokeStyle = '#22202A';
      x.lineWidth = 1;
      x.beginPath();
      for (let q = 0; q <= W; q += 4) x.lineTo(q, y + Math.sin(q * 0.15) * 4);
      x.stroke();
    }
    if (k === 'fossil') {
      const fx = Math.round(W * 0.2);
      x.fillStyle = '#E8E0D0';
      x.fillRect(fx + 3, y, 4, 4);
      x.fillRect(fx + 4, y + 4, 2, 9);
      for (let r = 0; r < 3; r++) x.fillRect(fx + 1, y + 6 + r * 2, 8, 1);
      x.fillRect(fx + 2, y + 13, 2, 5);
      x.fillRect(fx + 6, y + 13, 2, 5);
      x.fillStyle = '#C2408A';
      x.fillRect(fx + 5, y + 5, 1, 4); /* the tie */
    }
    if (k === 'crate') {
      const cx = Math.round(W * 0.66);
      x.save();
      x.translate(cx + 10, y + 8);
      x.rotate(0.2 + t * 0.6);
      x.fillStyle = '#8A6A44';
      x.fillRect(-12, -8, 24, 16);
      x.fillStyle = '#5E4428';
      x.fillRect(-12, -8, 24, 2);
      x.fillRect(-12, 6, 24, 2);
      x.fillStyle = '#E8F2EA';
      x.font = fallFont(8);
      x.fillText('LEGACY', -11, 3);
      x.restore();
    }
  }
  /* speed: streaks of grit rushing past */
  for (let q = 0; q < 16; q++) {
    const sx = Math.floor(fallRandom(q, 5) * W),
      len = 6 + Math.floor(fallRandom(q, 6) * 14),
      sy = Math.round((((fallRandom(q, 7) * H - t * sp * 1.6) % (H + len)) + H + len) % (H + len)) - len;
    x.fillStyle = 'rgba(255,236,210,.16)';
    x.fillRect(sx, sy, 1, len);
  }
  /* you, tumbling: the same few pixels, turning a quarter at a time */
  const cx = Math.round(W / 2),
    cy = Math.round(H * 0.45),
    a = Math.round((t * 5.2) / (Math.PI / 2));
  x.save();
  x.translate(cx, cy);
  x.rotate((a * Math.PI) / 2);
  drawFallingPlayer(-3, -8, 1, false);
  x.restore();
  /* the light below */
  if (t > 1.9) {
    const kk = clamp((t - 1.9) / 0.9, 0, 1),
      lg = x.createLinearGradient(0, H, 0, H * (1 - kk));
    lg.addColorStop(0, `rgba(255,248,226,${kk})`);
    lg.addColorStop(1, 'rgba(255,248,226,0)');
    x.fillStyle = lg;
    x.fillRect(0, 0, W, H);
    if (kk >= 1) {
      x.fillStyle = '#FFF8EC';
      x.fillRect(0, 0, W, H);
    }
  }
}
/* ---- 3 (still). the inner sky as pixels: the far side of the world on every side, the Inner Sun in the middle.
   For the opening's pictures, and when the 3D map can't be shown (reduced motion, no WebGL). ---- */
function fallSky(t) {
  const x = openingFall.x,
    W = openingFall.W,
    H = openingFall.H,
    cx = Math.round(W / 2),
    cy = Math.round(H * 0.44);
  x.fillStyle = '#4E7CC8';
  x.fillRect(0, 0, W, H);
  const land = ['#6FA060', '#86AE6C', '#B4A676', '#5E8E58', '#9CB878'];
  for (let i = 0; i < 46; i++) {
    const bx = fallRandom(i, 1) * (W + 40) - 20,
      by = fallRandom(i, 2) * (H + 40) - 20,
      rx = 6 + fallRandom(i, 3) * Math.min(W, H) * 0.16,
      ry = rx * (0.45 + fallRandom(i, 4) * 0.5);
    x.fillStyle = land[i % land.length];
    for (let dy = -Math.floor(ry); dy <= ry; dy++) {
      const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)) * (0.82 + 0.18 * Math.sin(dy * 0.7 + i));
      if (hw >= 1) x.fillRect(Math.round(bx - hw), Math.round(by + dy), Math.round(hw * 2), 1);
    }
  }
  /* haze, thicker toward the sun, and the sun */
  const R = Math.max(W, H) * 0.75,
    g = x.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, 'rgba(255,250,232,1)');
  g.addColorStop(0.1, 'rgba(255,242,206,.95)');
  g.addColorStop(0.3, 'rgba(226,232,250,.6)');
  g.addColorStop(1, 'rgba(196,210,246,.22)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#FFFDF4';
  x.beginPath();
  x.arc(cx, cy, 9, 0, 7);
  x.fill();
  for (let i = 0; i < 7; i++) {
    const px = Math.round(fallRandom(i, 11) * W),
      py = Math.round(fallRandom(i, 12) * H),
      r = 3 + Math.floor(fallRandom(i, 13) * 4);
    if (Math.hypot(px - cx, py - cy) < 20) continue;
    x.fillStyle = 'rgba(255,255,255,.85)';
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(r * 1.8 * Math.sqrt(Math.max(0, 1 - (dy / (r + 0.5)) ** 2)));
      x.fillRect(px - hw + (((t * 3 + i * 5) | 0) % 3), py + dy, hw * 2, 1);
    }
  }
  /* you, small against all that, falling toward the bottom of the picture */
  x.save();
  x.translate(Math.round(W * 0.5), Math.round(H * 0.74 + Math.sin(t * 3) * 2));
  x.rotate(((Math.round(t * 2) % 4) * Math.PI) / 2);
  drawFallingPlayer(-3, -8, 1, false);
  x.restore();
}
/* one still picture of the fall, as an image (cached): 'street', 'crust' or 'sky' at time t */
const FALL_STILLS = {};
export function fallStill(kind, t, w = 200, h = 124) {
  const key = kind + '|' + t + '|' + w + 'x' + h;
  if (FALL_STILLS[key]) return FALL_STILLS[key];
  const keep = { cv: openingFall.cv, x: openingFall.x, W: openingFall.W, H: openingFall.H },
    cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  Object.assign(openingFall, { cv, x: cv.getContext('2d'), W: w, H: h });
  openingFall.x.imageSmoothingEnabled = false;
  try {
    ({ street: fallStreet, crust: fallCrust, sky: fallSky })[kind](t);
    FALL_STILLS[key] = cv.toDataURL();
  } catch (e) {
    console.error(e);
    FALL_STILLS[key] = '';
  } finally {
    Object.assign(openingFall, keep);
  }
  return FALL_STILLS[key];
}
/* ---- 3. the inner sky: across the Hollow Earth, past the Inner Sun, down to Sundown ---- */
function fallCamera(k) {
  const S0 = LOCATION_VECTORS[START_NODE],
    e = vector3.norm(vector3.cross(S0, [0, 1, 0])),
    n = vector3.norm(vector3.cross(e, S0)),
    L = (a, b, f) => vector3.add(vector3.mul(a, 1 - f), vector3.mul(b, f)),
    ease = f => f * f * (3 - 2 * f);
  const P0 = vector3.add(vector3.mul(S0, -0.82), vector3.mul(e, 0.16)),
    P1 = vector3.add(vector3.mul(S0, -0.16), vector3.mul(e, 0.14)),
    P2 = vector3.add(vector3.add(vector3.mul(S0, 0.3), vector3.mul(e, 0.1)), vector3.mul(n, 0.03)),
    P3 = vector3.add(vector3.mul(S0, 0.962), vector3.mul(n, 0.004));
  let C, look;
  if (k < 0.36) {
    const f = ease(k / 0.36);
    C = L(P0, P1, f);
    look = vector3.norm(vector3.mul(C, -1));
  } else if (k < 0.6) {
    const f = ease((k - 0.36) / 0.24);
    C = L(P1, P2, f);
    look = vector3.norm(L(vector3.norm(vector3.mul(C, -1)), vector3.norm(vector3.sub(S0, C)), f));
  } else {
    const f = (k - 0.6) / 0.4,
      g = f * f;
    C = L(P2, P3, g);
    look = vector3.norm(vector3.add(vector3.norm(vector3.sub(S0, C)), vector3.mul(n, 0.25 * (1 - f))));
  }
  const roll = (k > 0.55 ? (k - 0.55) * 5.5 : 0) + Math.sin(k * 9) * 0.12,
    base = Math.abs(vector3.dot(look, n)) > 0.95 ? e : n,
    rt0 = vector3.norm(vector3.cross(look, base)),
    up0 = vector3.cross(rt0, look),
    cr = Math.cos(roll),
    sr = Math.sin(roll);
  const rt = vector3.norm(vector3.add(vector3.mul(rt0, cr), vector3.mul(up0, sr))),
    up = vector3.cross(rt, look);
  return { C, fw: look, rt, up, P: S0, foc: Math.min(worldMapWidth * 0.55, worldMapHeight * 0.42) };
}
export function fallOverWorldMap(run, ms) {
  return new Promise(res0 => {
    const flat = worldMapGl.flat,
      focus = worldMap.focus,
      res = () => {
        worldMapGl.flat = flat;
        worldMapGl.noClouds = false;
        worldMap.focus = focus;
        worldMap.dirty = true;
        res0();
      };
    if (typeof worldMapGlRender !== 'function' || !gpuState.gl) {
      res();
      return;
    }
    try {
      ensurePrograms(WORLD_MAP_GL_SHADERS);
    } catch (e) {
      console.error(e);
      res();
      return;
    }
    const t0 = performance.now();
    worldMap.focus = LOCATION_VECTORS[START_NODE];
    worldMapGl.flat = false;
    worldMapGl.noClouds = true;
    let capA = 0,
      capB = 0;
    const step = ts => {
      if (!cutscene.on || cutscene.run !== run || cutscene.skip || gpuState.lost) {
        res();
        return;
      }
      const k = Math.min(1, (performance.now() - t0) / ms);
      try {
        worldMapGlSize();
        worldMap.cam = fallCamera(k);
        worldMapGlRender(ts);
      } catch (e) {
        console.error(e);
        res();
        return;
      }
      if (!capA && k > 0.12) {
        capA = 1;
        cutsceneCaption('Inside the planet', 'The Hollow Earth', 2600);
      }
      if (!capB && k > 0.4) {
        capB = 1;
        cutsceneCaption('At the centre of everything', 'The Inner Sun', 2400);
      }
      if (k >= 1) {
        res();
        return;
      }
      openingFall.raf = requestAnimationFrame(step);
    };
    openingFall.raf = requestAnimationFrame(step);
  });
}
/* the whole fall; resolves on a white screen, ready for Sundown */
async function fallPlay(run) {
  const alive = () => cutscene.on && cutscene.run === run && !cutscene.skip;
  openingFall.run = run;
  if (typeof music === 'function') music('fall');
  if (typeof artLoad === 'function')
    artLoad([typeof WORLD_ART !== 'undefined' ? WORLD_ART : 'map/world.png', 'map/world_h.png']).catch(() => {});
  fallCanvas();
  const fade = $('#csFade');
  document.body.classList.add('cs-falling');
  const anim = (fn, ms) =>
    new Promise(res => {
      const t0 = performance.now();
      const tick = () => {
        if (!alive()) {
          res();
          return;
        }
        const t = (performance.now() - t0) / 1000;
        fallCanvas();
        fn(t);
        if (t * 1000 >= ms) {
          res();
          return;
        }
        openingFall.raf = requestAnimationFrame(tick);
      };
      tick();
    });
  setTimeout(() => {
    if (alive()) cutsceneCaption('The surface', 'Late, after the show', 3000);
  }, 700);
  let snd = 0;
  await anim(t => {
    fallStreet(t);
    if (!snd && t > 5) {
      snd = 1;
      if (typeof soundEffect === 'function') soundEffect('rumble');
    }
    if (snd === 1 && t > 5.6) {
      snd = 2;
      if (typeof soundEffect === 'function') soundEffect('crack');
    }
    if (snd === 2 && t > 6.5) {
      snd = 3;
      if (typeof soundEffect === 'function') soundEffect('whoosh', { dur: 2.4 });
    }
  }, 7600);
  if (alive()) await anim(t => fallCrust(t), 2900);
  const gcv = alive() && !reducedMotion ? fallWorldMapCanvas() : null;
  if (!gcv && alive()) {
    cutsceneCaption('At the centre of everything', 'The Inner Sun', 2600);
    await anim(t => fallSky(t), reducedMotion ? 2600 : 3400);
  }
  if (gcv) {
    if (fade) fade.classList.add('on');
    await new Promise(r => setTimeout(r, 350));
    gcv.hidden = false;
    gcv.classList.add('in');
    if (openingFall.cv) openingFall.cv.hidden = true;
    if (fade) fade.classList.remove('on');
    if (typeof soundEffect === 'function') soundEffect('whoosh', { dur: 3 });
    await fallOverWorldMap(run, 9000);
  }
  cancelAnimationFrame(openingFall.raf);
  if (fade) fade.classList.add('on');
  if (typeof soundEffect === 'function' && alive()) soundEffect('thud');
  await new Promise(r => setTimeout(r, reducedMotion || cutscene.skip ? 0 : 500));
  if (openingFall.cv) {
    openingFall.cv.remove();
    openingFall.cv = null;
  }
  document.body.classList.remove('cs-falling');
}

/* ---- 4. the landing: dust, and the papers that fell with you, settling round you (drawn by cutsceneFrame) ---- */
const landing = { bits: [] };
provide({ landing }); /* to-module */
function landingBurst(x, z) {
  if (typeof walkView === 'undefined' || !walkView.parts) return;
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * 6.283,
      sp = 0.5 + Math.random() * 2.2;
    walkView.parts.push({
      k: 'dust',
      x: x + (Math.random() - 0.5) * 0.5,
      z: z + (Math.random() - 0.5) * 0.4,
      y: 0.05,
      vx: Math.cos(a) * sp,
      vz: Math.sin(a) * sp * 0.7,
      vy: 0.3 + Math.random() * 0.9,
      g: 0.9,
      life: 0,
      max: 2 + Math.random() * 1.8,
    });
  }
  const now = performance.now(),
    y0 = standingHeightAt(x, z),
    ic = ['paper', 'paper', 'tag', 'paper', 'floppy', 'paper', 'paper', 'bit'];
  landing.bits = [];
  for (let i = 0; i < 10; i++)
    landing.bits.push({
      k: ic[i % ic.length],
      x: x + (Math.random() - 0.5) * 4.5,
      z: z + (Math.random() - 0.2) * 3.2,
      y: y0 + 2.5 + Math.random() * 4.5,
      vy: -(0.32 + Math.random() * 0.28),
      ph: Math.random() * 6.28,
      t0: now + i * 260,
      last: 0,
      down: 0,
    });
}
function landingFrame(now, parts) {
  if (!landing.bits.length) return;
  landing.bits = landing.bits.filter(b => !b.down || now - b.down < 1600);
  for (const b of landing.bits) {
    if (now < b.t0) continue;
    const dt = b.last ? Math.min(0.25, (now - b.last) / 1000) : 0;
    b.last = now;
    const gy = standingHeightAt(b.x, b.z) + 0.03;
    if (!b.down) {
      b.y += b.vy * dt;
      b.x += Math.sin(now / 520 + b.ph) * 0.45 * dt;
      b.z += Math.cos(now / 830 + b.ph) * 0.15 * dt;
      if (b.y <= gy) {
        b.y = gy;
        b.down = now;
      }
    }
    const im = typeof particleSprite === 'function' ? particleSprite(b.k) : null;
    if (!im || im.width < 2) continue;
    const turn = b.down ? 1 : Math.abs(Math.cos(now / 330 + b.ph)),
      a = b.down ? 1 - (now - b.down) / 1600 : 1;
    parts.push({ im, x: b.x, y: b.y + 0.09, z: b.z, w: 0.2 * Math.max(0.15, turn), h: 0.2, a, glow: false });
  }
}

/* ================= THE FIRST BATTLE: BLAKE, OUTSIDE THE LAB =================
   Right after you choose, Blake picks the starter that beats yours (rules.start.rival) and battles you on the spot
   (trainer blake0: tutorial). His billionaire is as new as yours and only knows Tackle. Hazel explains as it happens:
   moves and types, switching and items, and the coin you'd throw at a wild one. Win or lose the story goes on
   (story.js: storyAfterRival) with your team healed and no fee. The self-test's run of the opening stops before it. */
function tutorTypesTip() {
  const me = fighter(0),
    foe = fighter(1);
  if (!me || !foe) return null;
  const ft = actorTypes(1);
  const mine = me.moves.map(k => MOVES[k]).filter(m => m && m.p),
    weak = mine.filter(m => m.t !== 'None' && typeEffectiveness(m.t, ft) < 1),
    strong = mine.filter(m => m.t !== 'None' && typeEffectiveness(m.t, ft) > 1),
    plain = mine.find(m => m.t === 'None');
  const a = `Every move has a type, shown by its colour. ${ft.join('/')} Billies take double from some types and half from others.`;
  if (strong.length)
    return `${a} ${strong[0].n} is ${strong[0].t}: that one hits ${SPECIES[foe.sp].name} hard. Use it!`;
  if (weak.length)
    return `${a} Your ${weak.map(m => m.n).join(' and ')} only half hurt${weak.length > 1 ? '' : 's'} ${SPECIES[foe.sp].name}.${plain ? ` Plain ${plain.n} hits anything normally.` : ''}`;
  return `${a} Watch for “Super effective” when you hit.`;
}
const TUTOR_TIPS = {
  start: () => '[happy] A battle! Tap Fight and pick a move. Knock out Blake’s Billie before it knocks out yours.',
  types: tutorTypesTip,
  hurt: () =>
    '[surprised] Getting hurt? You could use an item from your Bag, or swap in another Billie once you have one. Or keep swinging.',
  coin: () =>
    'Nearly there! In the wild you’d flick a coin now: a tired Billie can’t resist one. Not Blake’s, though. He’d sue.',
};
function battleTutor() {
  if (!activeBattle || !activeBattle.T || !activeBattle.T.tutorial || activeBattle.over) return;
  const seen = activeBattle.tips || (activeBattle.tips = {}),
    me = fighter(0),
    foe = fighter(1),
    fresh = k => !seen[k];
  let k = null;
  if (fresh('start')) k = 'start';
  else if (fresh('types') && activeBattle.turn >= 1) k = 'types';
  else if (fresh('hurt') && me && me.hp < maxHp(me) * 0.5) k = 'hurt';
  else if (fresh('coin') && foe && foe.hp < maxHp(foe) * 0.45) k = 'coin';
  if (!k) return;
  seen[k] = 1;
  const text = TUTOR_TIPS[k]();
  if (text)
    battleTip(
      'gini',
      text,
      k === 'start' && typeof openingDone === 'function' && openingDone()
        ? { l: 'Skip this battle', a: 'tutskip' }
        : null
    );
}
/* seen it all before: Blake's battle ends at once, and the story carries on */
function tutorSkip() {
  if (!activeBattle || !activeBattle.T || !activeBattle.T.tutorial || activeBattle.over) return;
  stopTimers();
  activeBattle.over = 'skip';
  endBattle();
}
/* a word from someone at the top of the battle, without stopping it; it goes after a while, or with a tap */
function battleTip(who, text, btn) {
  let el = $('#btip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'btip';
    el.className = 'btip';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  let ex = null;
  const m = /^\[(\w+)\]\s*/.exec(text || '');
  if (m) {
    ex = m[1];
    text = text.slice(m[0].length);
  }
  el.innerHTML = `<span class="btip-face">${typeof portraitHTML === 'function' ? portraitHTML(who, 44, ex) : ''}</span><span class="btip-t"><b>${who === 'gini' ? 'Professor Hazel' : escapeHtml(who)}</b>${escapeHtml(text)}${btn ? `<button class="pb small quiet btip-b" data-a="${btn.a}">${escapeHtml(btn.l)}</button>` : ''}</span>`;
  el.classList.remove('off');
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('off'), Math.max(btn ? 9000 : 6000, text.length * 65));
  el.onclick = ev => {
    const b = ev.target.closest('[data-a]');
    if (b && b.dataset.a === 'tutskip') {
      ev.stopPropagation();
      el.classList.add('off');
      tutorSkip();
      return;
    }
    el.classList.add('off');
  };
}
export function battleTipHide() {
  const el = $('#btip');
  if (el) {
    clearTimeout(el._t);
    el.remove();
  }
}
