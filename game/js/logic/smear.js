// @ts-check
'use strict';
/* ===== SMEARS: THE THROW'S PACE, AFTERIMAGES, RIBBON, STRETCH AND IMPACT FRAME (VFX track VFX-1..VFX-4) =====
   A thrown pyramid leaves "multiples" behind it, the classic smear of hand-drawn animation: copies of itself at the
   places it just was, held, not blurred. Its places are kept on a 24 fps grid (the rigs' "on ones",
   skeleton-rig.js rigFrame), so the copies step like the rest of the animation; each copy is drawn dithered (the
   models' Bayer fade) and brighter in its own colours. After it stops, the copies run out one by one, oldest first.
   The throw's pace: fast at the release, a hang at the top, fast into the hit (smears read on speed contrast).
   VFX-2: the motion lines, a ribbon along the last part of the arc (the same kept places), tapered to its tail, hard
   edged, eroded in dithered steps: its tail frays in flight, and once the object stops it erodes away in four steps
   on the same grid (about 150 ms). A spinning throw twists it about the tumble axis.
   VFX-3: the elongated in-between, on the throw's fastest cells only (the release and before the hit): the side of
   the object facing away from its motion is dragged back toward its place one grid cell ago, broken up a little by
   noise (the vertex shader does the dragging: prop-models.js SMEAR_GLSL), held for the cell like everything else.
   VFX-4: the impact frame (below).
   VFX-5: attack lunges (below): the same history kept for a Billie while it lunges, its lean, its afterimages and, on
   a dash, its ribbon.
   Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FLASH_DARK: [() => FLASH_DARK],
  FLASH_SOFT_MAX: [() => FLASH_SOFT_MAX],
  IMPACT_KINDS: [() => IMPACT_KINDS],
  IMPACT_LINES: [() => IMPACT_LINES],
  IMPACT_SPEED_LIFE: [() => IMPACT_SPEED_LIFE],
  LUNGE_DASH: [() => LUNGE_DASH],
  LUNGE_GHOSTS: [() => LUNGE_GHOSTS],
  LUNGE_LEAN_BACK: [() => LUNGE_LEAN_BACK],
  LUNGE_LEAN_K: [() => LUNGE_LEAN_K],
  LUNGE_LEAN_MAX: [() => LUNGE_LEAN_MAX],
  LUNGE_RIBBON_HALF: [() => LUNGE_RIBBON_HALF],
  LUNGE_RIBBON_MAX: [() => LUNGE_RIBBON_MAX],
  LUNGE_RIBBON_MIN: [() => LUNGE_RIBBON_MIN],
  RIBBON_BRIGHT: [() => RIBBON_BRIGHT],
  RIBBON_CELLS: [() => RIBBON_CELLS],
  RIBBON_CORE: [() => RIBBON_CORE],
  RIBBON_FRAY: [() => RIBBON_FRAY],
  RIBBON_HALF: [() => RIBBON_HALF],
  RIBBON_STEPS: [() => RIBBON_STEPS],
  RIBBON_SUB: [() => RIBBON_SUB],
  RIBBON_TWIST: [() => RIBBON_TWIST],
  SMEAR_GHOSTS: [() => SMEAR_GHOSTS],
  SMEAR_KEEP: [() => SMEAR_KEEP],
  SMEAR_MIN_GAP: [() => SMEAR_MIN_GAP],
  SMEAR_NEAR: [() => SMEAR_NEAR],
  SMEAR_STEP: [() => SMEAR_STEP],
  STRETCH_K: [() => STRETCH_K],
  STRETCH_MAX: [() => STRETCH_MAX],
  STRETCH_PACE: [() => STRETCH_PACE],
  THROW_EASE: [() => THROW_EASE],
  // @ts-expect-error -- replaced on purpose
  flashFor: [() => flashFor, v => (flashFor = v)],
  // @ts-expect-error -- replaced on purpose
  flashLuma: [() => flashLuma, v => (flashLuma = v)],
  // @ts-expect-error -- replaced on purpose
  impactAt: [() => impactAt, v => (impactAt = v)],
  // @ts-expect-error -- replaced on purpose
  impactFrame: [() => impactFrame, v => (impactFrame = v)],
  // @ts-expect-error -- replaced on purpose
  impactLength: [() => impactLength, v => (impactLength = v)],
  // @ts-expect-error -- replaced on purpose
  lungeDash: [() => lungeDash, v => (lungeDash = v)],
  // @ts-expect-error -- replaced on purpose
  lungeGhostCount: [() => lungeGhostCount, v => (lungeGhostCount = v)],
  // @ts-expect-error -- replaced on purpose
  lungeLean: [() => lungeLean, v => (lungeLean = v)],
  // @ts-expect-error -- replaced on purpose
  lungeLeanFor: [() => lungeLeanFor, v => (lungeLeanFor = v)],
  // @ts-expect-error -- replaced on purpose
  lungeLeanOn: [() => lungeLeanOn, v => (lungeLeanOn = v)],
  // @ts-expect-error -- replaced on purpose
  lungeRibbonHalf: [() => lungeRibbonHalf, v => (lungeRibbonHalf = v)],
  // @ts-expect-error -- replaced on purpose
  ribbonCells: [() => ribbonCells, v => (ribbonCells = v)],
  // @ts-expect-error -- replaced on purpose
  ribbonEdges: [() => ribbonEdges, v => (ribbonEdges = v)],
  // @ts-expect-error -- replaced on purpose
  ribbonTone: [() => ribbonTone, v => (ribbonTone = v)],
  // @ts-expect-error -- replaced on purpose
  smearCount: [() => smearCount, v => (smearCount = v)],
  // @ts-expect-error -- replaced on purpose
  smearGhosts: [() => smearGhosts, v => (smearGhosts = v)],
  // @ts-expect-error -- replaced on purpose
  smearHistory: [() => smearHistory, v => (smearHistory = v)],
  // @ts-expect-error -- replaced on purpose
  smearRecord: [() => smearRecord, v => (smearRecord = v)],
  // @ts-expect-error -- replaced on purpose
  smearRibbon: [() => smearRibbon, v => (smearRibbon = v)],
  // @ts-expect-error -- replaced on purpose
  smearStretch: [() => smearStretch, v => (smearStretch = v)],
  // @ts-expect-error -- replaced on purpose
  throwArcEase: [() => throwArcEase, v => (throwArcEase = v)],
  // @ts-expect-error -- replaced on purpose
  throwArcPace: [() => throwArcPace, v => (throwArcPace = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the history's grid (ms): 24 places a second */
export const SMEAR_STEP = 1000 / 24;
/** the afterimages, newest first: how much of each is drawn (the dithered fade) and how much brighter it is in its
 * own colours (battle-3d.js: the colours' value times 1 + glow) */
export const SMEAR_GHOSTS = [
  { fade: 0.6, glow: 0.45 },
  { fade: 0.4, glow: 0.7 },
  { fade: 0.25, glow: 0.95 },
];
/** a copy closer than this (metres) to the next newer one is not drawn: at the top of the arc they would only
 * dither over the pyramid itself */
export const SMEAR_MIN_GAP = 0.12;
/** a copy closer than this (metres) to the camera is not drawn: a throw leaves the camera, so its first copies lie
 * between the lens and the pyramid and would fill the screen */
export const SMEAR_NEAR = 2;
/** VFX-2: the ribbon's kept places (the owner's choice: six, about 250 ms of the arc) */
export const RIBBON_CELLS = 6;
/** how many places a history keeps: what the afterimages and the ribbon need */
export const SMEAR_KEEP = Math.max(SMEAR_GHOSTS.length + 1, RIBBON_CELLS);
/** the ribbon's half width at its head (metres), tapered to nothing at its tail: about half the thrown pyramid's side
 * (battle-stage.js PYRAMID_SIDE x PYRAMID_SCALE) */
export const RIBBON_HALF = 0.24;
/** how much of the tumble the ribbon twists by: the whole of it turned the strip nearly twice along its length, so it
 * mostly showed its edge (a thin line) */
export const RIBBON_TWIST = 0.35;
/** its colour's value, times this: the object's own colour, brighter (as the afterimages are) */
export const RIBBON_BRIGHT = 1.35;
/** the white core's share of its width (the rest is the object's own colour) */
export const RIBBON_CORE = 0.4;
/** how much of the ribbon's tail is eroded in flight (0 at the head, this at the tail) */
export const RIBBON_FRAY = 0.75;
/** the erosion's steps: once the object stops, one more step each grid cell, gone after this many */
export const RIBBON_STEPS = 4;
/** points drawn between two kept places (a smooth curve through them; it still moves on the grid) */
export const RIBBON_SUB = 3;
/** how much the throw's pace varies: 0 even, below 1 always forward; 0.45 is 1.45x the mean speed at both ends and
 * 0.55x at the top */
export const THROW_EASE = 0.45;
/** VFX-3: a cell is stretched when the throw's pace there is at least this times its mean speed (about the first and
 * last eighth of the arc: one or two cells at each end of a 380-480 ms throw) */
export const STRETCH_PACE = 1.3;
/** how far back the trailing side is dragged: this share of the way to the place one cell ago */
export const STRETCH_K = 0.6;
/** at most this far (metres): about one and a half times the thrown pyramid's side */
export const STRETCH_MAX = 0.8;

/** a throw's progress (0..1) for its time (0..1): same start, middle and end, faster at both ends
 * @param {number} k */
export function throwArcEase(k, a = THROW_EASE) {
  return k + (a * Math.sin(2 * Math.PI * k)) / (2 * Math.PI);
}

/** VFX-3: the throw's pace at time k (0..1), times its mean speed: throwArcEase's slope
 * @param {number} k */
export function throwArcPace(k, a = THROW_EASE) {
  return 1 + a * Math.cos(2 * Math.PI * k);
}

/** @typedef {{ x: number, y: number, z: number, t?: number, [k: string]: any }} SmearPlace */
/** @typedef {{ cell: number, list: SmearPlace[] }} SmearHistory */

/** an empty history
 * @returns {SmearHistory} */
export function smearHistory() {
  return { cell: -Infinity, list: [] };
}

/** keeps place s (and the time t, ms) when t is in a new grid cell; true when kept
 * @param {SmearHistory} H @param {number} t @param {SmearPlace} s */
export function smearRecord(H, t, s) {
  const cell = Math.floor(t / SMEAR_STEP);
  if (cell === H.cell) return false;
  H.cell = cell;
  H.list.unshift({ ...s, t });
  if (H.list.length > SMEAR_KEEP) H.list.length = SMEAR_KEEP;
  return true;
}

/** the afterimages to draw at time t, newest first: up to n of them (the battle's quality), each a kept place with
 * its look. The newest place is the cell the object is in now, so the copies start one cell back; a copy lives
 * (count + 1) steps, so in flight all show, and once the object stops they run out oldest first. eye: the camera
 * (the same metres), none drawn within SMEAR_NEAR of it
 * @param {SmearHistory | null | undefined} H @param {number} t @param {number} n
 * @param {{ x: number, y: number, z: number } | null} [eye]
 * @param {{ fade: number, glow: number }[]} [looks] the copies' looks, newest first (a lunge's are LUNGE_GHOSTS)
 * @returns {{ s: SmearPlace, fade: number, glow: number }[]} */
export function smearGhosts(H, t, n = SMEAR_GHOSTS.length, eye = null, looks = SMEAR_GHOSTS) {
  const out = [];
  if (!H || n <= 0) return out;
  const L = H.list,
    life = (looks.length + 1) * SMEAR_STEP;
  for (let i = 1; i < L.length && i <= Math.min(n, looks.length); i++) {
    const s = L[i],
      p = L[i - 1];
    if (t - (s.t ?? t) >= life) break;
    if (Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < SMEAR_MIN_GAP) continue;
    if (eye && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < SMEAR_NEAR) continue;
    out.push({ s, ...looks[i - 1] });
  }
  return out;
}

/** how many afterimages a battle draws: none under Reduced motion or at its lowest quality (level 3), two at
 * level 2 @param {boolean} reduced @param {number} lvl */
export function smearCount(reduced, lvl) {
  return reduced || lvl >= 3 ? 0 : lvl >= 2 ? 2 : SMEAR_GHOSTS.length;
}

/** how many places the ribbon runs along: none where the afterimages are off (Reduced motion, quality level 3), four
 * at level 2 @param {boolean} reduced @param {number} lvl */
export function ribbonCells(reduced, lvl) {
  return reduced || lvl >= 3 ? 0 : lvl >= 2 ? 4 : RIBBON_CELLS;
}

/** @typedef {{ x: number, y: number, z: number, w: number, e: number, tum: number }} RibbonPoint */

/** the ribbon at time t, head first: up to `cells` kept places with a smooth curve through them, each point with its
 * half width w (tapered to 0 at the tail) and erosion e (0 whole .. 1 gone, in 1 / RIBBON_STEPS steps). head: where
 * the object is now while it flies (the ribbon reaches it between grid cells); none once it stops. It ends before the
 * first place within SMEAR_NEAR of the eye (a throw leaves the camera: its tail is the near end)
 * @param {SmearHistory | null | undefined} H @param {number} t @param {number} cells
 * @param {{ x: number, y: number, z: number } | null} [eye] @param {SmearPlace | null} [head]
 * @param {number} [half] its half width at the head (metres; a dash's is the Billie's own, LUNGE_RIBBON_HALF)
 * @returns {RibbonPoint[]} */
export function smearRibbon(H, t, cells, eye = null, head = null, half = RIBBON_HALF) {
  if (!H || cells < 2 || !H.list.length) return [];
  const L = H.list,
    /* the grid cells since the newest place was kept: 0 in flight, then one erosion step a cell */
    gone = Math.max(0, Math.floor(t / SMEAR_STEP) - H.cell);
  if (gone >= RIBBON_STEPS) return [];
  const near = s => !!eye && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < SMEAR_NEAR,
    P = [];
  if (head && !near(head)) P.push(head);
  for (let i = 0; i < L.length && i < cells; i++) {
    const s = L[i];
    if (near(s)) break;
    const p = P[P.length - 1];
    if (p && Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) < SMEAR_MIN_GAP) continue;
    P.push(s);
  }
  if (P.length < 2) return [];
  /* a Catmull-Rom curve through the places, RIBBON_SUB points a span */
  const at = (i, k) => {
      const a = P[Math.max(0, i - 1)],
        b = P[i],
        c = P[i + 1],
        d = P[Math.min(P.length - 1, i + 2)],
        f = key =>
          0.5 *
          (2 * b[key] +
            (c[key] - a[key]) * k +
            (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * k * k +
            (3 * b[key] - a[key] - 3 * c[key] + d[key]) * k * k * k);
      return { x: f('x'), y: f('y'), z: f('z'), tum: (b.tum || 0) + ((c.tum || 0) - (b.tum || 0)) * k };
    },
    n = (P.length - 1) * RIBBON_SUB,
    out = [];
  for (let j = 0; j <= n; j++) {
    const i = Math.min(P.length - 2, Math.floor(j / RIBBON_SUB)),
      q = at(i, j / RIBBON_SUB - i),
      u = j / n,
      e = Math.min(1, Math.round((RIBBON_FRAY * u + gone / RIBBON_STEPS) * RIBBON_STEPS) / RIBBON_STEPS);
    out.push({ ...q, w: half * (1 - u), e });
  }
  return out;
}

/** the ribbon's two edges at each point, [left, right] (the same metres): across the curve and toward the eye, so it
 * faces the camera; a spinning throw (ax, its tumble axis) turns that about the axis by each point's tumble, so the
 * ribbon twists (RIBBON_TWIST of the tumble) and at times shows its edge
 * @param {RibbonPoint[]} R @param {{ x: number, y: number, z: number }} eye
 * @param {number[] | null} [ax] @returns {number[][][]} */
export function ribbonEdges(R, eye, ax = null) {
  const out = [],
    nrm = v => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : null;
    },
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    A = ax && nrm(ax);
  let last = [0, 1, 0];
  for (let i = 0; i < R.length; i++) {
    const p = R[i],
      a = R[Math.max(0, i - 1)],
      b = R[Math.min(R.length - 1, i + 1)],
      tg = nrm([b.x - a.x, b.y - a.y, b.z - a.z]) || [1, 0, 0];
    let s = nrm(cross(tg, [eye.x - p.x, eye.y - p.y, eye.z - p.z])) || nrm(cross(tg, [0, 1, 0])) || last;
    if (A) {
      /* Rodrigues: s turned about the axis by the tumble, then made square to the curve again */
      const c = Math.cos(p.tum * RIBBON_TWIST),
        n = Math.sin(p.tum * RIBBON_TWIST),
        k = A[0] * s[0] + A[1] * s[1] + A[2] * s[2],
        x = cross(A, s),
        r = [0, 1, 2].map(j => s[j] * c + x[j] * n + A[j] * k * (1 - c)),
        d = r[0] * tg[0] + r[1] * tg[1] + r[2] * tg[2];
      s = nrm([r[0] - tg[0] * d, r[1] - tg[1] * d, r[2] - tg[2] * d]) || s;
    }
    last = s;
    out.push([
      [p.x - s[0] * p.w, p.y - s[1] * p.w, p.z - s[2] * p.w],
      [p.x + s[0] * p.w, p.y + s[1] * p.w, p.z + s[2] * p.w],
    ]);
  }
  return out;
}

/** the ribbon's colour for a '#rrggbb' colour: [r, g, b] 0..1, its value RIBBON_BRIGHT times (capped at white's)
 * @param {string} hex @returns {number[]} */
export function ribbonTone(hex) {
  const n = parseInt(hex.slice(1, 7), 16),
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => v / 255),
    k = Math.min(RIBBON_BRIGHT, 1 / Math.max(...c, 1e-6));
  return c.map(v => v * k);
}

/** VFX-3: the stretch at time t, or null: the drag d (the same metres; the trailing side is pushed by up to d) and a
 * noise seed (0..1, new each cell). Only while the object flies (on: its arc, and the smears on) and the newest place
 * is this cell's, on a fast cell (its progress k at STRETCH_PACE or more), with the place one cell ago to drag toward;
 * none when either place is within SMEAR_NEAR of the eye (a catch's release: it would fill the screen)
 * @param {SmearHistory | null | undefined} H @param {number} t @param {boolean} on
 * @param {{ x: number, y: number, z: number } | null} [eye]
 * @returns {{ d: number[], seed: number } | null} */
export function smearStretch(H, t, on, eye = null) {
  if (!on || !H || H.list.length < 2 || H.cell !== Math.floor(t / SMEAR_STEP)) return null;
  const [a, b] = H.list;
  if (a.k == null || throwArcPace(a.k) < STRETCH_PACE) return null;
  const near = s => !!eye && Math.hypot(s.x - eye.x, s.y - eye.y, s.z - eye.z) < SMEAR_NEAR;
  if (near(a) || near(b)) return null;
  const d = [(b.x - a.x) * STRETCH_K, (b.y - a.y) * STRETCH_K, (b.z - a.z) * STRETCH_K],
    l = Math.hypot(d[0], d[1], d[2]);
  if (l < 1e-6) return null;
  const f = Math.min(1, STRETCH_MAX / l);
  return { d: d.map(v => v * f), seed: (((H.cell * 0.618034) % 1) + 1) % 1 };
}

/* VFX-4: the impact frame. For a cell or two on the same 24 fps grid the whole picture turns two-tone (ink and paper,
   hard edged, no gradient) with radial lines from the hit point: the negative first, then the positive (one cell at
   quality level 2: the positive only). On a crit the speed lines then stay over the normal picture for a short while,
   moving outward (they were 2D-canvas lines before VFX-4; engine/post-effects.js draws both). Real time, not the
   battle's clock: it plays through the hit-stop, which freezes that clock. */
/** the radial lines a frame (16 at quality level 2) */
export const IMPACT_LINES = 24;
/** how long a crit's speed lines stay after the frame (ms) */
export const IMPACT_SPEED_LIFE = 260;
/** the frame's kinds: a catch's pyramid, the mail move's coin and a crit */
export const IMPACT_KINDS = ['catch', 'coin', 'crit'];

/** @typedef {{ kind: string, cells: number, lines: number, warm: boolean, speed: boolean }} ImpactFrame */

/** the impact frame for a hit of this kind, or null: none under Reduced motion; two cells, one at quality level 2,
 * none at level 3 (a crit still has its speed lines there, as before VFX-4); paper warm on a crit. SY-1: with Flashes
 * off (noFlash) the two-tone cells go, as at level 3: a crit keeps its speed lines (motion, not a flash)
 * @param {string} kind @param {boolean} reduced @param {number} lvl @param {boolean} [noFlash]
 * @returns {ImpactFrame | null} */
export function impactFrame(kind, reduced, lvl, noFlash = false) {
  if (reduced || !IMPACT_KINDS.includes(kind)) return null;
  const cells = noFlash || lvl >= 3 ? 0 : lvl >= 2 ? 1 : 2,
    speed = kind === 'crit';
  if (!cells && !speed) return null;
  return { kind, cells, lines: lvl >= 2 ? 16 : IMPACT_LINES, warm: kind === 'crit', speed };
}

/** what the frame shows ms after the hit, or null once it is over: mode 1 the negative, 2 the positive, 3 the speed
 * lines alone (age 0..1, stepped on the grid) @param {ImpactFrame | null | undefined} F @param {number} ms
 * @returns {{ mode: number, age: number } | null} */
export function impactAt(F, ms) {
  if (!F || !(ms >= 0)) return null;
  const cell = Math.floor(ms / SMEAR_STEP);
  if (cell < F.cells) return { mode: F.cells - cell >= 2 ? 1 : 2, age: 0 };
  if (!F.speed) return null;
  const s = (cell - F.cells) * SMEAR_STEP;
  return s < IMPACT_SPEED_LIFE ? { mode: 3, age: s / IMPACT_SPEED_LIFE } : null;
}

/** how long the two-tone part lasts (ms): what a flash that would wash it out waits @param {ImpactFrame | null} F */
export function impactLength(F) {
  return F ? F.cells * SMEAR_STEP : 0;
}

/* SY-1 (style track): the battle's full-screen flashes (battle-stage.js battleStageFlash) under the player's settings.
   None under Reduced motion. With Flashes off a bright flash is held to a faint tint; a dark one (a faint's deep red)
   stays as it is, since it doesn't flash bright. */
/** the most a bright flash shows with Flashes off (opacity) */
export const FLASH_SOFT_MAX = 0.15;
/** below this luma (0..1) a flash is dark and stays as it is with Flashes off */
export const FLASH_DARK = 0.25;

/** a colour's luma 0..1 (Rec. 709), from #RGB or #RRGGBB; anything else counts as bright @param {string} col */
export function flashLuma(col) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(col || '').trim());
  if (!m) return 1;
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1],
    ch = i => parseInt(h.slice(i, i + 2), 16) / 255;
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/** what a flash of this colour and opacity becomes under the settings, or null when nothing shows
 * @param {string} col @param {number} a @param {boolean} reduced @param {boolean} flashesOff
 * @returns {{ col: string, a: number } | null} */
export function flashFor(col, a, reduced, flashesOff) {
  if (reduced || !(a > 0)) return null;
  if (!flashesOff || flashLuma(col) < FLASH_DARK) return { col, a };
  return { col, a: Math.min(a, FLASH_SOFT_MAX) };
}

/* VFX-5: attack lunges. While a Billie lunges (battle-stage.js battleLunge, the step Part 2's runner reuses) its places
   are kept on the same 24 fps grid as a throw's. From them: its lean (the sprite shader's uShear: the top ahead of the
   feet, by how fast it moved over the last cell, held for the cell), one or two afterimages of its billboard at older
   places (dithered, brighter, no shadow) and, on a dash, Part 1's ribbon at its middle's height. Nothing adds time:
   they ride the lunge's own tweens. Off under Reduced motion; thinner as the battle's quality drops; they still play
   under Calm (the action causes them; Part 2's rule 9). */
/** a lunge's afterimages, newest first: fewer and fainter than a throw's (a Billie is much bigger on screen) */
export const LUNGE_GHOSTS = [
  { fade: 0.5, glow: 0.35 },
  { fade: 0.28, glow: 0.6 },
];
/** the lean (a shear: how far the top moves sideways per metre of height) per stage pixel a millisecond of sideways
 * speed. The H move's lunge (30 px in 120 ms, eased in) reaches about 0.25 px/ms in its last cell */
export const LUNGE_LEAN_K = 1;
/** at most this lean (about 17 degrees at the top) */
export const LUNGE_LEAN_MAX = 0.3;
/** moving back home (away from where it lunged), the lean is this share: it settles rather than leaning back hard */
export const LUNGE_LEAN_BACK = 0.5;
/** a dash's ribbon: its half width as a share of the Billie's height (metres), and its bounds */
export const LUNGE_RIBBON_HALF = 0.3;
export const LUNGE_RIBBON_MIN = 0.12;
export const LUNGE_RIBBON_MAX = 0.45;
/** the dash moves (vfx-track.md's family table, "dash": too fast to see), by move id, until VFX-8/VFX-11 give every
 * move its family in battleAnims.json: Quick Strike, Zip, Dash Kick, Flame Dash, Front Run, Just Do It */
export const LUNGE_DASH = ['flashsale', 'movefast', 'dashkick', 'pipeline', 'frontrun', 'justdoit'];

/** whether a move (its id) dashes: its lunge leaves a ribbon too @param {string | null | undefined} id */
export function lungeDash(id) {
  return !!id && LUNGE_DASH.includes(id);
}

/** how many afterimages a lunge leaves: two, one at quality level 2, none at level 3 or under Reduced motion
 * @param {boolean} reduced @param {number} lvl */
export function lungeGhostCount(reduced, lvl) {
  return reduced || lvl >= 3 ? 0 : lvl >= 2 ? 1 : LUNGE_GHOSTS.length;
}

/** whether a lunge leans: where its afterimages show (not under Reduced motion, not at quality level 3)
 * @param {boolean} reduced @param {number} lvl */
export function lungeLeanOn(reduced, lvl) {
  return lungeGhostCount(reduced, lvl) > 0;
}

/** the lean for a sideways speed v (stage px a ms, + to the screen's right); fwd: the lunge's way on screen (1 or -1),
 * so moving back home leans LUNGE_LEAN_BACK as much. Rounded to hundredths (a held, stepped value)
 * @param {number} v @param {number} [fwd] */
export function lungeLeanFor(v, fwd = 0) {
  if (!Number.isFinite(v) || !v) return 0;
  const k = fwd && Math.sign(v) !== Math.sign(fwd) ? LUNGE_LEAN_BACK : 1,
    l = Math.max(-LUNGE_LEAN_MAX, Math.min(LUNGE_LEAN_MAX, v * LUNGE_LEAN_K)) * k;
  return Math.round(l * 100) / 100 || 0;
}

/** the lean now, from a lunge's history: the speed between its two newest places (their x in metres; mpp the metres a
 * stage pixel at the Billie's depth), held for the cell they were kept in; 0 once it stops being kept (the lunge is
 * over), when off, or before two places
 * @param {SmearHistory | null | undefined} H @param {number} t @param {number} mpp @param {boolean} on
 * @param {number} [fwd] */
export function lungeLean(H, t, mpp, on, fwd = 0) {
  if (!on || !H || H.list.length < 2 || !(mpp > 0) || H.cell !== Math.floor(t / SMEAR_STEP)) return 0;
  const [a, b] = H.list,
    dt = (a.t ?? 0) - (b.t ?? 0);
  if (!(dt > 0)) return 0;
  return lungeLeanFor((a.x - b.x) / mpp / dt, fwd);
}

/** a dash's ribbon half width for a Billie h metres tall @param {number} h */
export function lungeRibbonHalf(h) {
  return Math.max(LUNGE_RIBBON_MIN, Math.min(LUNGE_RIBBON_MAX, (h || 0) * LUNGE_RIBBON_HALF));
}
