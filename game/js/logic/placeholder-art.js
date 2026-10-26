// @ts-check
'use strict';
/* ================= PLACEHOLDER ART (roster track RO-3a) =================
   Billies on any of the 14 body plans (game/data/bodyPlans.json, the plans body-plan-animation.js animates), drawn
   as very obvious placeholders: flat shapes in the Billie's colours, a thick outline, a diagonal hatch and the part's
   name inside where it fits. Each picture is a cell: the part with room round it, its pivot at a fixed spot. The
   cells go out as drawing sheets (one per Billie: a column per picture, a row per view; one per body plan: a column
   per picture, two rows per Billie) on a magenta ground with a label strip and pivot ticks, are drawn on in any tool,
   come back in (cut by the same layout), and bake into the Billie's sheet and rig, as kit-assemble.js bakes a kit
   Billie. npm run bake:placeholders (tools/bake-placeholders.mjs) runs it.
   Logic only: no DOM, runs in Node. A picture is ImageData-shaped. */
/** @typedef {import('./kit-pixels.js').Pixels} Pixels */
/** @typedef {[number, number, number]} Rgb */
/**
 * @typedef {{ n: string, par?: string, c?: [number, number], size?: [number, number] | null, pv?: [number, number],
 *   shape?: string, tone?: string, z?: number, zb?: number, slot?: string | null, also?: string, rr?: number, face?: boolean,
 *   squash?: boolean, lag?: number, mirror?: string, label?: string }} PlanBone a bone as bodyPlans.json writes it
 * @typedef {{ n: string, par: string, c: [number, number], size: [number, number] | null, pv: [number, number],
 *   shape: string, tone: string, z: number, zb: number, slot: string | null, also: string | null, rr: number, face: boolean,
 *   squash: boolean, lag: number, label: string, src: string, flip: boolean }} PlaceholderBone a bone worked out:
 *   mirrors applied, the form's sizes on; `src` names the bone whose picture it draws (flipped when `flip`)
 * @typedef {{ name: string, rig: string, line?: string, stage?: number, form?: string, plan: string,
 *   colours: { main: string | Rgb, accent?: string | Rgb }, size?: Record<string, number>, scale?: number,
 *   add?: PlanBone[], drop?: string[], q?: Record<string, number> }} PlaceholderForm one placeholder Billie (bodyPlans.json forms)
 * @typedef {{ bg: Rgb, grid: Rgb, label: number, room: number, min: number }} PlaceholderSheetSet
 * @typedef {{ ink: Rgb, hatch: number, hatchDark: number, dark: number, light: number, back: number, eye: Rgb,
 *   glint: Rgb }} PlaceholderPaintSet
 * @typedef {{ sheet: PlaceholderSheetSet, paint: PlaceholderPaintSet,
 *   plans: Record<string, { q: Record<string, number>, bones: PlanBone[] }>, forms: PlaceholderForm[] }} BodyPlans
 * @typedef {{ key: string, bone: string, frame: string, w: number, h: number, px: number, py: number, pxb: number }}
 *   CellSpec a cell: its key (`head` or `head.blink`), its size and the pivot inside it (pxb: from behind, where the
 *   part shows mirrored)
 * @typedef {Record<string, Pixels>} CellPics a view's cells' pictures by key
 * @typedef {{ front: CellPics, back: CellPics }} PlaceholderCells
 * @typedef {{ x: number, y: number, w: number, h: number, key: string, view: string, form: string }} SheetCell
 * @typedef {{ width: number, height: number, cells: SheetCell[], strips: { x: number, y: number, w: number,
 *   text: string }[] }} SheetLayout
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { roundHalfEven } from './sheet-slice.js';
import { kitBlank, kitCopy, kitFlipX, kitPaste, kitSquashFrames } from './kit-pixels.js';
import { kitBounds, kitDrawRest, kitPack } from './kit-assemble.js';
/* eslint-disable no-func-assign */
expose({
  PLACEHOLDER_BOX: [() => PLACEHOLDER_BOX],
  PLACEHOLDER_FONT: [() => PLACEHOLDER_FONT],
  PLACEHOLDER_VIEWS: [() => PLACEHOLDER_VIEWS],
  // @ts-expect-error -- replaced on purpose
  placeholderBake: [() => placeholderBake, v => (placeholderBake = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderBones: [() => placeholderBones, v => ((placeholderBones = v), provide({ placeholderBones }))],
  placeholderCellLabel: [() => placeholderCellLabel],
  // @ts-expect-error -- replaced on purpose
  placeholderCellSpecs: [() => placeholderCellSpecs, v => (placeholderCellSpecs = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderCellsWith: [() => placeholderCellsWith, v => (placeholderCellsWith = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderInside: [() => placeholderInside, v => (placeholderInside = v)],
  placeholderJoint: [() => placeholderJoint],
  placeholderMix: [() => placeholderMix],
  placeholderNearKey: [() => placeholderNearKey],
  // @ts-expect-error -- replaced on purpose
  placeholderPaint: [() => placeholderPaint, v => (placeholderPaint = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderPaintCells: [() => placeholderPaintCells, v => (placeholderPaintCells = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderPieces: [() => placeholderPieces, v => (placeholderPieces = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderPut: [() => placeholderPut, v => (placeholderPut = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderRestPieces: [() => placeholderRestPieces, v => (placeholderRestPieces = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderRgb: [() => placeholderRgb, v => (placeholderRgb = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderScaleUp: [() => placeholderScaleUp, v => (placeholderScaleUp = v)],
  placeholderShade: [() => placeholderShade],
  // @ts-expect-error -- replaced on purpose
  placeholderSheet: [() => placeholderSheet, v => (placeholderSheet = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderSheetCut: [() => placeholderSheetCut, v => (placeholderSheetCut = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderSheetLayout: [() => placeholderSheetLayout, v => (placeholderSheetLayout = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderText: [() => placeholderText, v => (placeholderText = v)],
  placeholderTextW: [() => placeholderTextW],
  // @ts-expect-error -- replaced on purpose
  placeholderTones: [() => placeholderTones, v => (placeholderTones = v)],
  // @ts-expect-error -- replaced on purpose
  placeholderTrim: [() => placeholderTrim, v => (placeholderTrim = v)],
});
/* eslint-enable no-func-assign */
provide({ placeholderBones });
/* to-module: end */
/** the stage box, the torso pad and squash shapes every Billie shares with the kit Billies (kitBuilds.json bake) */
export const PLACEHOLDER_BOX = { w: 128, h: 128, cx: 64, base: 120 };
provide({ PLACEHOLDER_BOX }); /* to-module */
export const PLACEHOLDER_VIEWS = /** @type {const} */ (['front', 'back']);
provide({ PLACEHOLDER_VIEWS }); /* to-module */

/* ---------- the bones ---------- */
/** a plan's bones for one form: mirrors filled in (middle, pivot and turn mirrored, the parent mirrored too when it
 * has a mirror), the form's dropped bones gone, its added ones on, its sizes applied, then its scale (RO-3b: the whole
 * Billie, middles and sizes, as a kit recipe's scale sizes a stage)
 * @param {BodyPlans} P @param {PlaceholderForm} form @returns {PlaceholderBone[]} */
export function placeholderBones(P, form) {
  const plan = P.plans[form.plan];
  if (!plan) throw new Error(`${form.name}: no body plan ${form.plan}`);
  const raw = [...plan.bones, ...(form.add || [])].filter(b => !(form.drop || []).includes(b.n)),
    byName = Object.fromEntries(raw.map(b => [b.n, b])),
    /** @type {Record<string, string>} */ twin = {};
  for (const b of raw) if (b.mirror) twin[b.mirror] = b.n;
  const sz = form.size || {},
    sc = form.scale ?? 1;
  return raw.map(b => {
    const s = b.mirror ? byName[b.mirror] : null;
    if (b.mirror && !s) throw new Error(`${form.name}: ${b.n} mirrors ${b.mirror}, which isn't there`);
    /** @type {any} */
    const o = s ? { ...s, ...b } : { ...b };
    if (s) {
      o.par = b.par ?? twin[s.par || 'root'] ?? s.par;
      o.c = b.c ?? [-(s.c || [0, 0])[0], (s.c || [0, 0])[1]];
      o.pv = b.pv ?? (s.pv ? [1 - s.pv[0], s.pv[1]] : [0.5, 0.5]);
      o.rr = b.rr ?? -(s.rr || 0);
      o.label = b.label ?? s.label ?? s.n;
    }
    const k = (sz[s ? s.n : b.n] ?? 1) * sc,
      size =
        o.size == null
          ? null
          : /** @type {[number, number]} */ (o.size.map((/** @type {number} */ v) => Math.max(2, Math.round(v * k))));
    return {
      n: b.n,
      par: o.par || 'root',
      c: /** @type {[number, number]} */ ((o.c || [0, 0]).map((/** @type {number} */ v) => v * sc)),
      size,
      pv: o.pv || [0.5, 0.5],
      shape: o.shape || 'ellipse',
      tone: o.tone || 'main',
      z: o.z ?? 5,
      zb: o.zb ?? o.z ?? 5,
      slot: o.slot === undefined ? null : o.slot,
      also: o.also || null,
      rr: o.rr || 0,
      face: !!o.face,
      squash: !!o.squash,
      lag: o.lag || 0,
      label: o.label || b.n,
      src: s ? s.n : b.n,
      flip: !!s,
    };
  });
}
/** a bone's joint in the stage box at rest (from the middle of the ground line) @param {PlaceholderBone} b */
export const placeholderJoint = b =>
  b.size ? [b.c[0] + (b.pv[0] - 0.5) * b.size[0], b.c[1] + (b.pv[1] - 0.5) * b.size[1]] : [b.c[0], b.c[1]];

/* ---------- colours ---------- */
/** '#rrggbb' or [r, g, b] as [r, g, b] @param {string | Rgb} c @returns {Rgb} */
export function placeholderRgb(c) {
  if (Array.isArray(c)) return [c[0], c[1], c[2]];
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (!m) throw new Error(`not a colour: ${c}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}
/** @param {Rgb} c @param {number} k @returns {Rgb} */
export const placeholderShade = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
/** @param {Rgb} c @param {Rgb} d @param {number} t @returns {Rgb} */
export const placeholderMix = (c, d, t) =>
  /** @type {Rgb} */ ([0, 1, 2].map(i => Math.round(c[i] + (d[i] - c[i]) * t)));
/** the four tones a form paints with: its main colour, a darker one, its accent (the main lightened if it has none)
 * and a light one @param {PlaceholderPaintSet} S @param {PlaceholderForm['colours']} colours */
export function placeholderTones(S, colours) {
  const main = placeholderRgb(colours.main),
    accent = colours.accent ? placeholderRgb(colours.accent) : placeholderMix(main, [255, 255, 255], 0.35);
  return { main, dark: placeholderShade(main, S.dark), accent, light: placeholderMix(main, [255, 255, 255], S.light) };
}
/** is a colour near the sheets' magenta (the background a sheet is cut by) @param {number[]} c */
export const placeholderNearKey = c => c[0] > 200 && c[1] < 60 && c[2] > 200;

/* ---------- painting ---------- */
/* a 3 x 5 pixel font: each glyph five rows of three bits */
export const PLACEHOLDER_FONT = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  0: [7, 5, 5, 5, 7],
  1: [2, 6, 2, 2, 7],
  2: [6, 1, 2, 4, 7],
  3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1],
  5: [7, 4, 6, 1, 6],
  6: [3, 4, 7, 5, 7],
  7: [7, 1, 2, 2, 2],
  8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 6],
  '.': [0, 0, 0, 0, 2],
  '-': [0, 0, 7, 0, 0],
  ' ': [0, 0, 0, 0, 0],
};
/** how wide a text is in the 3 x 5 font @param {string} t */
export const placeholderTextW = t => (t.length ? t.length * 4 - 1 : 0);
/** write text in the 3 x 5 font, its top left at (x, y) @param {Pixels} p @param {string} t @param {number} x
 * @param {number} y @param {Rgb} col */
export function placeholderText(p, t, x, y, col) {
  [...t.toUpperCase()].forEach((ch, i) => {
    const g = /** @type {Record<string, number[]>} */ (PLACEHOLDER_FONT)[ch] || PLACEHOLDER_FONT['-'];
    for (let r = 0; r < 5; r++)
      for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) placeholderPut(p, x + i * 4 + b, y + r, col);
  });
}
/** @param {Pixels} p @param {number} x @param {number} y @param {number[]} c */
export function placeholderPut(p, x, y, c) {
  if (x < 0 || y < 0 || x >= p.width || y >= p.height) return;
  const i = (y * p.width + x) * 4;
  p.data[i] = c[0];
  p.data[i + 1] = c[1];
  p.data[i + 2] = c[2];
  p.data[i + 3] = 255;
}
/** is (u, v), each 0-1 across the part's box, inside a shape
 * @param {string} shape @param {number} u @param {number} v */
export function placeholderInside(shape, u, v) {
  const x = u * 2 - 1,
    y = v * 2 - 1;
  switch (shape) {
    case 'ellipse':
      return x * x + y * y <= 1;
    case 'round': /* a box with round corners */ {
      const r = 0.45,
        ax = Math.max(0, Math.abs(x) - (1 - r)),
        ay = Math.max(0, Math.abs(y) - (1 - r));
      return ax * ax + ay * ay <= r * r;
    }
    case 'capsule': /* a stadium along its longer side */ {
      const r = 1;
      return Math.abs(x) <= r && (Math.abs(y) <= 0.5 || x * x + ((Math.abs(y) - 0.5) / 0.5) ** 2 <= 1);
    }
    case 'taper' /* thick at its root (left), thin at its tip */:
      return Math.abs(y) <= 1 - 0.75 * u && u <= 1;
    case 'tri':
      return Math.abs(x) <= v;
    case 'triDown':
      return Math.abs(x) <= 1 - v;
    case 'leaf': /* a lens along its longer side */ {
      const long = Math.abs(y) > Math.abs(x) ? 0 : 1;
      return long ? y * y <= (1 - x * x) ** 2 : x * x <= (1 - y * y) ** 2;
    }
    case 'wing' /* a feathered half oval hanging from its root */:
      return x * x + (v * 1.0) ** 2 * 0.6 <= 1 && !(v > 0.7 && Math.floor(u * 4) % 2 === 1 && v > 0.85);
    case 'fan':
      return x * x + (1 - v) ** 2 <= 1 && v <= 1;
    case 'fin' /* a forked tail fin from its root (left) */:
      return Math.abs(y) <= 0.25 + 0.75 * u && !(u > 0.6 && Math.abs(y) < (u - 0.6) * 1.2);
    case 'cup' /* a pot: wider at the top */:
      return Math.abs(x) <= 1 - 0.3 * v;
    case 'claw' /* a pincer: a round with a bite out of its top */:
      return x * x + y * y <= 1 && !(y < 0.1 && Math.abs(x - 0.25) < 0.22);
    default:
      return Math.abs(x) <= 1 && Math.abs(y) <= 1;
  }
}
/** one bone's placeholder picture at its size (no room): the shape in its tone, hatched, outlined, its name inside
 * where it fits; a front face gets eyes (`blink` shuts them); from behind it is darker and has no face
 * @param {PlaceholderPaintSet} S @param {PlaceholderBone} b @param {ReturnType<typeof placeholderTones>} T
 * @param {string} view @param {string} [frame] */
export function placeholderPaint(S, b, T, view, frame = 'main') {
  if (!b.size) throw new Error(`${b.n} has no picture`);
  const [w, h] = b.size,
    p = kitBlank(w, h),
    back = view === 'back',
    base = /** @type {Rgb} */ (/** @type {any} */ (T)[b.tone] || T.main),
    col = back ? placeholderShade(base, S.back) : base,
    hat = placeholderShade(col, S.hatchDark),
    ins = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) ins[y * w + x] = placeholderInside(b.shape, (x + 0.5) / w, (y + 0.5) / h) ? 1 : 0;
  const at = (/** @type {number} */ x, /** @type {number} */ y) => x >= 0 && y >= 0 && x < w && y < h && ins[y * w + x];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!ins[y * w + x]) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      placeholderPut(p, x, y, edge ? S.ink : (x + y) % S.hatch === 0 ? hat : col);
    }
  /* the outline twice as thick where there is room */
  if (w >= 10 && h >= 10)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (ins[y * w + x] && (!at(x - 2, y) || !at(x + 2, y) || !at(x, y - 2) || !at(x, y + 2)))
          placeholderPut(p, x, y, S.ink);
  /* from behind the shape shows mirrored (the renderer mirrors the back view back); its words don't */
  const q = back ? kitFlipX(p) : p;
  p.data.set(q.data);
  const light = (col[0] + col[1] + col[2]) / 3 > 140,
    text = /** @type {Rgb} */ (light ? S.ink : [255, 255, 255]);
  if (b.face && !back) {
    /* two eyes a fifth of the way out from the middle, above the label */
    const ey = Math.round(h * 0.38),
      ex = Math.max(2, Math.round(w * 0.2));
    for (const sx of [-1, 1]) {
      const cx = Math.round(w / 2 + sx * ex);
      if (frame === 'blink') for (let d = -1; d <= 1; d++) placeholderPut(p, cx + d, ey + 1, S.eye);
      else {
        for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx <= 0; dx++) placeholderPut(p, cx + dx, ey + dy, S.eye);
        placeholderPut(p, cx - 1, ey, S.glint);
      }
    }
    const t = b.label.toUpperCase();
    if (placeholderTextW(t) + 6 <= w && h >= 18)
      placeholderText(p, t, Math.floor((w - placeholderTextW(t)) / 2), Math.min(h - 8, ey + 5), text);
  } else {
    let t = b.label.toUpperCase();
    while (t.length > 1 && placeholderTextW(t) + 6 > w) t = t.slice(0, -1);
    if (placeholderTextW(t) + 6 <= w && h >= 11)
      placeholderText(p, t, Math.floor((w - placeholderTextW(t)) / 2), Math.floor((h - 5) / 2), text);
  }
  return p;
}

/* ---------- cells ---------- */
/** the cells a form draws: one per bone with a picture that mirrors nothing, plus a front blink cell per face; each
 * with room round the part (so a drawing may grow) and its pivot inside
 * @param {BodyPlans} P @param {PlaceholderForm} form @returns {CellSpec[]} */
export function placeholderCellSpecs(P, form) {
  const S = P.sheet,
    out = [];
  for (const b of placeholderBones(P, form)) {
    if (!b.size || b.flip) continue;
    const [w, h] = b.size,
      mx = Math.max(2, Math.round((w * S.room) / 2)),
      my = Math.max(2, Math.round((h * S.room) / 2)),
      W = Math.max(S.min, w + 2 * mx),
      H = Math.max(S.min, h + 2 * my),
      px = (W - w) / 2 + b.pv[0] * w,
      py = (H - h) / 2 + b.pv[1] * h;
    out.push({ key: b.n, bone: b.n, frame: 'main', w: W, h: H, px, py, pxb: W - px });
    if (b.face) out.push({ key: b.n + '.blink', bone: b.n, frame: 'blink', w: W, h: H, px, py, pxb: W - px });
  }
  return out;
}
/** the painted cells of a form, both views (a blink cell is front only)
 * @param {BodyPlans} P @param {PlaceholderForm} form @returns {PlaceholderCells} */
export function placeholderPaintCells(P, form) {
  const T = placeholderTones(P.paint, form.colours),
    bones = Object.fromEntries(placeholderBones(P, form).map(b => [b.n, b])),
    /** @type {PlaceholderCells} */ out = { front: {}, back: {} };
  for (const view of PLACEHOLDER_VIEWS)
    for (const c of placeholderCellSpecs(P, form)) {
      if (view === 'back' && c.frame !== 'main') continue;
      const b = bones[c.bone],
        pic = placeholderPaint(P.paint, b, T, view, c.frame),
        cell = kitBlank(c.w, c.h);
      const x = view === 'back' ? c.pxb - (1 - b.pv[0]) * pic.width : c.px - b.pv[0] * pic.width;
      kitPaste(cell, pic, Math.round(x), Math.round(c.py - b.pv[1] * pic.height));
      out[view][c.key] = cell;
    }
  return out;
}

/* ---------- baking ---------- */
/** a picture cut to its pixels, and how far its top left moved @param {Pixels} p */
export function placeholderTrim(p) {
  const [x0, y0, x1, y1] = kitBounds(p);
  if (x1 <= x0) return { pic: kitBlank(1, 1), dx: 0, dy: 0 };
  const o = kitBlank(x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y++)
    o.data.set(p.data.subarray((y * p.width + x0) * 4, (y * p.width + x1) * 4), (y - y0) * o.width * 4);
  return { pic: o, dx: x0, dy: y0 };
}
/** a form's pieces in one view, from its cells (painted, or cut from a drawn sheet), as kit-assemble.js's KitPiece
 * @param {BodyPlans} P @param {PlaceholderForm} form @param {PlaceholderCells} cells @param {string} view
 * @param {{ pad: number, squash: Record<string, [number, number]> }} D */
export function placeholderPieces(P, form, cells, view, D) {
  const bones = placeholderBones(P, form),
    specs = Object.fromEntries(placeholderCellSpecs(P, form).map(c => [c.key, c])),
    J = Object.fromEntries(bones.map(b => [b.n, placeholderJoint(b)])),
    pieces = [];
  J.root = [0, 0];
  for (const b of bones) {
    if (!(b.par in J)) throw new Error(`${form.name}: ${b.n} hangs on ${b.par}, which isn't there`);
    const at = [J[b.n][0] - J[b.par][0], J[b.n][1] - J[b.par][1]],
      /** @type {any} */ piece = { n: b.n, par: b.par, at, z: b.z, zb: b.zb, rr: b.rr, lag: b.lag, slot: b.slot };
    if (b.size) {
      const sp = specs[b.src],
        /** @type {Record<string, Pixels>} */ frames = {};
      let pivot = /** @type {[number, number]} */ ([0, 0]);
      /* the renderer mirrors the back view, so a back cell (drawn as it shows on screen) is flipped here, and a
         mirrored bone's picture is flipped once more */
      const flip = b.flip !== (view === 'back'),
        keys =
          b.face && view === 'front'
            ? [
                ['idle', b.src],
                ['blink', b.src + '.blink'],
              ]
            : [['main', b.src]];
      /* every frame of a bone trims by the box of its first frame, so the pivot stays placeholderPut */
      const first = cells[/** @type {'front' | 'back'} */ (view)][keys[0][1]];
      if (!first) throw new Error(`${form.name}: no ${view} cell ${keys[0][1]}`);
      const { dx, dy, pic } = placeholderTrim(first);
      for (const [fn, key] of keys) {
        const src = cells[/** @type {'front' | 'back'} */ (view)][key] || first,
          cut = kitBlank(pic.width, pic.height);
        kitPaste(cut, src, -dx, -dy);
        frames[fn] = flip ? kitFlipX(cut) : cut;
      }
      pivot = [(view === 'back' ? sp.pxb : sp.px) - dx, sp.py - dy];
      if (flip) pivot = [pic.width - pivot[0], pivot[1]];
      if (b.squash && frames.main) {
        const sq = kitSquashFrames(frames.main, D.pad, D.squash);
        for (const k of Object.keys(frames)) delete frames[k];
        Object.assign(frames, sq);
        pivot = [pivot[0] + D.pad, pivot[1] + D.pad];
      }
      piece.frames = frames;
      piece.pivot = pivot;
      piece.face = b.face && view === 'front';
    } else piece.frames = null;
    pieces.push(piece);
  }
  return pieces;
}
/** a form baked: its sheet and both views' rigs (as rigs-next.js holds them, marked placeholder), from its cells
 * (painted unless given) @param {BodyPlans} P @param {PlaceholderForm} form
 * @param {{ pad: number, squash: Record<string, [number, number]>, sheetW: number, margin: number }} D the kit
 * baker's settings (kitBuilds.json bake) @param {PlaceholderCells} [cells] */
export function placeholderBake(P, form, D, cells = placeholderPaintCells(P, form)) {
  const box = PLACEHOLDER_BOX,
    DD = /** @type {any} */ ({ ...D, box }),
    plan = P.plans[form.plan],
    /** @type {Record<string, any[]>} */ views = {},
    /** @type {Pixels[]} */ pics = [],
    /** @type {string[]} */ where = [];
  for (const v of PLACEHOLDER_VIEWS) {
    views[v] = placeholderPieces(P, form, cells, v, D);
    views[v].forEach((p, pi) => {
      if (!p.frames) return;
      for (const [fn, im] of Object.entries(p.frames)) {
        where.push(`${v}|${pi}|${fn}`);
        pics.push(im);
      }
    });
  }
  const { sheet, spots } = kitPack(pics, D.sheetW),
    place = Object.fromEntries(where.map((w, i) => [w, [...spots[i], pics[i].width, pics[i].height]])),
    /** @type {Record<string, any>} */ rig = {};
  for (const v of PLACEHOLDER_VIEWS) {
    const ps = views[v],
      imgs = [],
      bones = [];
    for (const [pi, p] of ps.entries()) {
      /** @type {Record<string, any>} */
      const b = { n: p.n, par: p.par, at: [roundHalfEven(p.at[0]), roundHalfEven(p.at[1])], z: p.z, zb: p.zb, i: -1 };
      if (p.frames) {
        const f = Object.fromEntries(Object.keys(p.frames).map(fn => [fn, place[`${v}|${pi}|${fn}`]]));
        b.i = imgs.length;
        imgs.push({ ox: -roundHalfEven(p.pivot[0]), oy: -roundHalfEven(p.pivot[1]), f });
      }
      if (p.rr) b.rr = Math.round(p.rr * 1000) / 1000;
      if (p.lag) b.lag = p.lag;
      b.slot = p.slot;
      if (p.face) b.face = true;
      bones.push(b);
    }
    const drawn = ps.filter(p => p.frames),
      rest = kitDrawRest(placeholderRestPieces(ps, drawn), v === 'back', DD),
      [x0, y0, x1, y1] = kitBounds(rest);
    if (x0 < D.margin || y0 < D.margin || x1 > box.w - D.margin || y1 > box.base + 2)
      throw new Error(`${form.name}: the ${v} view doesn't fit the stage box (${x0},${y0} - ${x1},${y1})`);
    rig[v] = {
      k: 1,
      BW: box.w,
      BH: box.h,
      cx: box.cx,
      base: box.base,
      tipX: 0,
      plan: form.plan,
      q: { ...plan.q, ...(form.q || {}) },
      geo: {
        cx: box.cx,
        base: box.base,
        top: y0,
        mid: (y0 + box.base) / 2,
        hw: (x1 - x0) / 2,
        lift: 0,
        k: 1,
        cy: (y0 + box.base) / 2,
      },
      size: [sheet.width, sheet.height],
      imgs,
      bones,
      clock: 12,
      sheet: `next/billionaires/${form.name}.png`,
      placeholder: 'bodyPlans.json',
    };
  }
  return { sheet, rig, views };
}
/** the pieces as kitDrawRest wants them: bones with no picture kept as joints (an empty picture), in bone order
 * @param {any[]} all @param {any[]} drawn */
export function placeholderRestPieces(all, drawn) {
  void drawn;
  return all.map(p => (p.frames ? p : { ...p, frames: { main: kitBlank(1, 1) }, pivot: [0, 0] }));
}

/* ---------- drawing sheets ---------- */
/** where every cell sits on a form's sheet (a column per cell, a row per view) or a plan's sheet (a column per cell,
 * two rows per form): a label strip over each row of cells, a one-pixel grid line round each cell
 * @param {BodyPlans} P @param {PlaceholderForm[]} forms one form for a Billie's sheet, all of a plan for its sheet
 * @param {boolean} [named] write each form's name in a strip of its own (the plan sheet) @returns {SheetLayout} */
export function placeholderSheetLayout(P, forms, named = false) {
  const L = P.sheet.label,
    /** @type {Record<string, number>} */ colW = {},
    /** @type {string[]} */ keys = [];
  /** @type {Record<string, CellSpec[]>} */
  const specs = {};
  for (const f of forms) {
    specs[f.name] = placeholderCellSpecs(P, f);
    for (const c of specs[f.name]) {
      if (!(c.key in colW)) keys.push(c.key);
      colW[c.key] = Math.max(colW[c.key] || 0, c.w, placeholderTextW(placeholderCellLabel(c.key, 'front')) + 2);
    }
  }
  /** @type {Record<string, number>} */
  const colX = {};
  let x = 1;
  for (const k of keys) {
    colX[k] = x;
    x += colW[k] + 3;
  }
  const width = Math.max(x, ...forms.map(f => placeholderTextW(f.name.toUpperCase()) + 4)),
    /** @type {SheetCell[]} */ cells = [],
    /** @type {SheetLayout['strips']} */ strips = [];
  let y = 0;
  for (const f of forms) {
    if (named) {
      strips.push({ x: 0, y, w: width, text: f.name.toUpperCase() });
      y += L;
    }
    for (const view of PLACEHOLDER_VIEWS) {
      const row = specs[f.name].filter(c => view === 'front' || c.frame === 'main'),
        rowH = Math.max(...row.map(c => c.h));
      for (const c of row) strips.push({ x: colX[c.key], y, w: colW[c.key], text: placeholderCellLabel(c.key, view) });
      y += L;
      for (const c of row) cells.push({ x: colX[c.key], y: y + 1, w: c.w, h: c.h, key: c.key, view, form: f.name });
      y += rowH + 2;
    }
  }
  return { width, height: y, cells, strips };
}
/** a cell's label: its bone (and frame) and the view's first letter @param {string} key @param {string} view */
export const placeholderCellLabel = (key, view) => `${key.replace('.', ' ')} ${view[0]}`;
/** a drawing sheet: the cells' pictures on magenta, the rest grid grey, the labels, and yellow ticks on the grid line
 * at each cell's pivot @param {BodyPlans} P @param {PlaceholderForm[]} forms
 * @param {Record<string, PlaceholderCells>} cellsByForm @param {boolean} [named] @param {number} [scale] each sheet
 * pixel drawn as scale x scale */
export function placeholderSheet(P, forms, cellsByForm, named = false, scale = 1) {
  const S = P.sheet,
    lay = placeholderSheetLayout(P, forms, named),
    p = kitBlank(lay.width, lay.height),
    specs = Object.fromEntries(
      forms.map(f => [f.name, Object.fromEntries(placeholderCellSpecs(P, f).map(c => [c.key, c]))])
    );
  for (let i = 0; i < p.data.length; i += 4) p.data.set([...S.grid, 255], i);
  for (const s of lay.strips) placeholderText(p, s.text, s.x + 1, s.y + 2, [235, 235, 240]);
  const tick = [255, 214, 0];
  for (const c of lay.cells) {
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) placeholderPut(p, c.x + x, c.y + y, S.bg);
    const pic = cellsByForm[c.form]?.[/** @type {'front' | 'back'} */ (c.view)]?.[c.key];
    if (pic) kitPaste(p, pic, c.x, c.y);
    const sp = specs[c.form][c.key],
      tx = c.x + Math.floor(c.view === 'back' ? sp.pxb : sp.px),
      ty = c.y + Math.floor(sp.py);
    placeholderPut(p, tx, c.y - 1, tick);
    placeholderPut(p, tx, c.y + c.h, tick);
    placeholderPut(p, c.x - 1, ty, tick);
    placeholderPut(p, c.x + c.w, ty, tick);
  }
  return scale > 1 ? placeholderScaleUp(p, scale) : p;
}
/** each pixel drawn as k x k @param {Pixels} p @param {number} k */
export function placeholderScaleUp(p, k) {
  const o = kitBlank(p.width * k, p.height * k);
  for (let y = 0; y < o.height; y++)
    for (let x = 0; x < o.width; x++) {
      const i = (Math.floor(y / k) * p.width + Math.floor(x / k)) * 4;
      o.data.set(p.data.subarray(i, i + 4), (y * o.width + x) * 4);
    }
  return o;
}
/** a drawn sheet cut back into cells by the same layout: its scale found from its width (each cell read at the middle
 * of its big pixels), magenta and near-magenta made clear, alpha made hard
 * @param {BodyPlans} P @param {PlaceholderForm[]} forms @param {Pixels} sheet @param {boolean} [named]
 * @returns {Record<string, PlaceholderCells>} */
export function placeholderSheetCut(P, forms, sheet, named = false) {
  const lay = placeholderSheetLayout(P, forms, named),
    k = sheet.width / lay.width;
  if (!Number.isInteger(k) || k < 1 || sheet.height !== lay.height * k)
    throw new Error(
      `the sheet is ${sheet.width} x ${sheet.height}; this layout is ${lay.width} x ${lay.height} (or a whole multiple). Was a Billie's plan or sizes changed since it was exported?`
    );
  const off = Math.floor(k / 2),
    /** @type {Record<string, PlaceholderCells>} */ out = {};
  for (const f of forms) out[f.name] = { front: {}, back: {} };
  for (const c of lay.cells) {
    const pic = kitBlank(c.w, c.h);
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++) {
        const i = (((c.y + y) * k + off) * sheet.width + (c.x + x) * k + off) * 4,
          px = [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2], sheet.data[i + 3]];
        if (px[3] < 128 || placeholderNearKey(px)) continue;
        placeholderPut(pic, x, y, px);
      }
    out[c.form][/** @type {'front' | 'back'} */ (c.view)][c.key] = pic;
  }
  return out;
}
/** the painted cells for a form with its drawn ones on top (a drawn cell wins; one with no pixels keeps the
 * placeholder) @param {BodyPlans} P @param {PlaceholderForm} form @param {PlaceholderCells | null} drawn */
export function placeholderCellsWith(P, form, drawn) {
  const out = placeholderPaintCells(P, form);
  if (!drawn) return out;
  for (const v of PLACEHOLDER_VIEWS)
    for (const [k, pic] of Object.entries(drawn[v] || {}))
      if (k in out[v] && pic.data.some((x, i) => i % 4 === 3 && x)) out[v][k] = kitCopy(pic);
  return out;
}
