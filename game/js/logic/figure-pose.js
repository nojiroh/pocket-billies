// @ts-check
'use strict';
/* ================= A FIGURE'S PARTS, POSES AND VIEW (characters track CH-2, the spike) =================
   The maths of the figure baker (game/js/figures.js draws with it): a figure is jointed rigid parts (the Studio's rule:
   "spinning and jointed parts; no skinning"), each vertex on one joint.
   - The mannequin: a person built in code, 1.75 m tall at about 2.75 heads (the track's proportions), from rounded
     low-poly shapes (the owner, 2026-10-27: "less boxy, more charming"): an egg of a head under a hair cap with a
     fringe and a cowlick, a bean of a body with a scarf, capsule limbs, mitten hands and bean shoes, every shape
     smooth-shaded so the toon bands follow its curve. Its face is marks painted on the picture in whole pixels (big
     eyes with a glint, a small mouth, blush) where its head faces the camera, not geometry, so a face 18 pixels wide
     stays crisp. Its own axes: y up, facing +z (a heading of 0, logic/person-view.js), x across.
   - Poses: an idle (breathing, a nod, a blink) and an 8-frame walk, each frame a rotation (and a small lift) per part. A pose
     is sampled on the 12 fps clock (skeleton-rig.js rigFrame's grid): the idle holds each pose two ticks, the walk is
     keyed to the distance walked (WALK_CYCLE_M a cycle) and read once a tick.
   - The view: an oblique projection onto the upright card the sprite path stands in the world. The card is upright and
     the camera looks down at it at its tilt, so a picture drawn as the camera sees it would be squashed twice; instead
     a point's height on the card is its height plus its depth into the view times tan(tilt), which the camera then
     shortens back by cos(tilt) into what a camera at that tilt would see. The heading seen from the camera is stepped
     (yaw steps), the tilt is stepped (TILT_STEP), and the figure's lift is snapped to whole texels, so a held pose
     never shimmers.
   - Colours: the scene props' ramps and outline (tools/build-scene-props.py ramp, olc): three toon bands lit from the
     top left, shadows leaning lavender, lights warm, the dark plum outline.
   Logic only: no DOM, runs in Node (tools/test/figure-pose.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CLIP_FRAMES: [() => CLIP_FRAMES],
  FIGURE_BANDS: [() => FIGURE_BANDS],
  FIGURE_FPS: [() => FIGURE_FPS],
  FIGURE_JOINTED: [() => FIGURE_JOINTED],
  FIGURE_LIGHT: [() => FIGURE_LIGHT],
  FIGURE_MARK_HIDE: [() => FIGURE_MARK_HIDE],
  FIGURE_PAL_MAX: [() => FIGURE_PAL_MAX],
  FIGURE_TALK_MS: [() => FIGURE_TALK_MS],
  OUTLINE_RGB: [() => OUTLINE_RGB],
  SDF_CORNERS: [() => SDF_CORNERS],
  TILT_STEP: [() => TILT_STEP],
  WALK_CYCLE_M: [() => WALK_CYCLE_M],
  // @ts-expect-error -- replaced on purpose
  cardPoint: [() => cardPoint, v => (cardPoint = v)],
  // @ts-expect-error -- replaced on purpose
  cardSize: [() => cardSize, v => (cardSize = v)],
  // @ts-expect-error -- replaced on purpose
  clipFrameAt: [() => clipFrameAt, v => (clipFrameAt = v)],
  // @ts-expect-error -- replaced on purpose
  codeExtent: [() => codeExtent, v => (codeExtent = v)],
  // @ts-expect-error -- replaced on purpose
  ellipsoidWarp: [() => ellipsoidWarp, v => (ellipsoidWarp = v)],
  // @ts-expect-error -- replaced on purpose
  figureBlinkAt: [() => figureBlinkAt, v => (figureBlinkAt = v)],
  // @ts-expect-error -- replaced on purpose
  figureClipMatrix: [() => figureClipMatrix, v => (figureClipMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  figureDark: [() => figureDark, v => (figureDark = v)],
  // @ts-expect-error -- replaced on purpose
  figureDensityStep: [() => figureDensityStep, v => (figureDensityStep = v)],
  // @ts-expect-error -- replaced on purpose
  figureFaceMarks: [() => figureFaceMarks, v => (figureFaceMarks = v)],
  // @ts-expect-error -- replaced on purpose
  figureFaceState: [() => figureFaceState, v => (figureFaceState = v)],
  // @ts-expect-error -- replaced on purpose
  figureGpuMesh: [() => figureGpuMesh, v => (figureGpuMesh = v)],
  // @ts-expect-error -- replaced on purpose
  figureKey: [() => figureKey, v => (figureKey = v)],
  // @ts-expect-error -- replaced on purpose
  figureMarkHidden: [() => figureMarkHidden, v => (figureMarkHidden = v)],
  // @ts-expect-error -- replaced on purpose
  figureMesh: [() => figureMesh, v => (figureMesh = v)],
  // @ts-expect-error -- replaced on purpose
  figureMix: [() => figureMix, v => (figureMix = v)],
  // @ts-expect-error -- replaced on purpose
  figurePose: [() => figurePose, v => (figurePose = v)],
  // @ts-expect-error -- replaced on purpose
  figureRamp: [() => figureRamp, v => (figureRamp = v)],
  // @ts-expect-error -- replaced on purpose
  figureRound: [() => figureRound, v => (figureRound = v)],
  // @ts-expect-error -- replaced on purpose
  figureSceneLight: [() => figureSceneLight, v => (figureSceneLight = v)],
  // @ts-expect-error -- replaced on purpose
  figureTalkFace: [() => figureTalkFace, v => (figureTalkFace = v)],
  // @ts-expect-error -- replaced on purpose
  figureTick: [() => figureTick, v => (figureTick = v)],
  // @ts-expect-error -- replaced on purpose
  figureUnit: [() => figureUnit, v => (figureUnit = v)],
  // @ts-expect-error -- replaced on purpose
  figureView: [() => figureView, v => (figureView = v)],
  // @ts-expect-error -- replaced on purpose
  finerShape: [() => finerShape, v => (finerShape = v)],
  // @ts-expect-error -- replaced on purpose
  frontOf: [() => frontOf, v => (frontOf = v)],
  // @ts-expect-error -- replaced on purpose
  hairCutAt: [() => hairCutAt, v => (hairCutAt = v)],
  // @ts-expect-error -- replaced on purpose
  headDeform: [() => headDeform, v => (headDeform = v)],
  // @ts-expect-error -- replaced on purpose
  headFrontOf: [() => headFrontOf, v => (headFrontOf = v)],
  // @ts-expect-error -- replaced on purpose
  jointMatrices: [() => jointMatrices, v => (jointMatrices = v)],
  // @ts-expect-error -- replaced on purpose
  mannequinFigure: [() => mannequinFigure, v => (mannequinFigure = v)],
  // @ts-expect-error -- replaced on purpose
  mat4Mul: [() => mat4Mul, v => (mat4Mul = v)],
  // @ts-expect-error -- replaced on purpose
  meshClipFrame: [() => meshClipFrame, v => (meshClipFrame = v)],
  // @ts-expect-error -- replaced on purpose
  meshClipMatrices: [() => meshClipMatrices, v => (meshClipMatrices = v)],
  // @ts-expect-error -- replaced on purpose
  outlineOf: [() => outlineOf, v => (outlineOf = v)],
  // @ts-expect-error -- replaced on purpose
  partMatrix: [() => partMatrix, v => (partMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  quadPose: [() => quadPose, v => (quadPose = v)],
  // @ts-expect-error -- replaced on purpose
  restPose: [() => restPose, v => (restPose = v)],
  // @ts-expect-error -- replaced on purpose
  ringSurface: [() => ringSurface, v => (ringSurface = v)],
  // @ts-expect-error -- replaced on purpose
  sdfAt: [() => sdfAt, v => (sdfAt = v)],
  // @ts-expect-error -- replaced on purpose
  sdfBox: [() => sdfBox, v => (sdfBox = v)],
  // @ts-expect-error -- replaced on purpose
  sdfFrontOf: [() => sdfFrontOf, v => (sdfFrontOf = v)],
  // @ts-expect-error -- replaced on purpose
  sdfNormal: [() => sdfNormal, v => (sdfNormal = v)],
  // @ts-expect-error -- replaced on purpose
  sdfPrimAt: [() => sdfPrimAt, v => (sdfPrimAt = v)],
  // @ts-expect-error -- replaced on purpose
  sdfPrimFn: [() => sdfPrimFn, v => (sdfPrimFn = v)],
  // @ts-expect-error -- replaced on purpose
  sdfSmin: [() => sdfSmin, v => (sdfSmin = v)],
  // @ts-expect-error -- replaced on purpose
  sdfSurface: [() => sdfSurface, v => (sdfSurface = v)],
  // @ts-expect-error -- replaced on purpose
  sdfTop: [() => sdfTop, v => (sdfTop = v)],
  // @ts-expect-error -- replaced on purpose
  shapeSurface: [() => shapeSurface, v => (shapeSurface = v)],
  // @ts-expect-error -- replaced on purpose
  shapeTriangles: [() => shapeTriangles, v => (shapeTriangles = v)],
  // @ts-expect-error -- replaced on purpose
  taperAt: [() => taperAt, v => (taperAt = v)],
  // @ts-expect-error -- replaced on purpose
  toonBand: [() => toonBand, v => (toonBand = v)],
  vCross: [() => vCross],
  vDot: [() => vDot],
  vSub: [() => vSub],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the walk's length a cycle (two steps), metres: at the player's 3.4 m/s a frame every 0.3 m, 11 a second */
export const WALK_CYCLE_M = 2.4;
/** frames in each clip */
export const CLIP_FRAMES = Object.freeze({ idle: 16, walk: 8, cheer: 8, throw: 8, sit: 1 });
/** the most colours a figure's parts may use (the baker's palette: three shades each) */
export const FIGURE_PAL_MAX = 28;
/** the clock poses step on (frames a second) */
export const FIGURE_FPS = 12;
/** the tilt is stepped by this much (radians: 2 degrees), so zooming between stops bakes a few views, not hundreds */
export const TILT_STEP = Math.PI / 90;
/** the dark plum outline of the props and battle props (tools/build-scene-props.py OL) */
export const OUTLINE_RGB = Object.freeze([36, 25, 54]);
/** the top-left light in the camera's frame (x to the screen's right, y up, z into the view): from the upper left
 * and a little from the viewer, as the props are painted */
export const FIGURE_LIGHT = Object.freeze(figureUnit([-0.55, 0.7, -0.45]));
/**
 * CH-3b (the owner, 2026-10-28: "make sure the lighting is used to make sense in all scenes in the game"): the light
 * a figure is baked in, from the scene it stands in rather than the fixed top-left FIGURE_LIGHT. The key is the sun
 * (or the moon, or a room's window light: walk/lighting.js mapSun) and the lamps near the figure, each by how strongly
 * it reaches it (the shader's falloff, engine/webgl.js points); it is turned into the camera's frame and stepped (16
 * ways round, 15 degree heights) so the pictures are shared. `flat` is how much of the light is the sky's (an
 * overcast day, the night, a room: softer forms); keyT and ambT tint the lit side by the key's colour and the shade by
 * the sky's; the back rim comes from the side away from the key in the sky's colour, stronger after dark.
 * @param {{ sunDir: number[], sunCol: number[], amb?: number[], lamps?: { p: number[], r: number, c: number[], pool?: number, src?: unknown }[],
 *   at?: number[] | null, right: number[], fwd: number[], dark?: number }} S
 * @returns {{ L: Vec3, flat: number, keyT: Vec3, ambT: Vec3, rim: Vec3, rimCol: Vec3, rimK: number, key: string }}
 */
export function figureSceneLight(S) {
  const lum = (/** @type {number[]} */ c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2],
    sd = S.sunDir,
    sunI = lum(S.sunCol) * Math.max(0, Math.min(1, sd[1] * 3 + 0.15)),
    K = [sd[0] * sunI, sd[1] * sunI, sd[2] * sunI],
    KC = S.sunCol.map(v => v * sunI);
  let total = sunI;
  if (S.at && S.lamps)
    for (const l of S.lamps) {
      /* not a pool on the ground, nor the lantern you carry (it lights the place round you, not you from behind) */
      if (l.pool || l.src === 'lantern') continue;
      const d = [l.p[0] - S.at[0], l.p[1] - S.at[1], l.p[2] - S.at[2]],
        len = Math.hypot(d[0], d[1], d[2]),
        x = Math.min(1, len / Math.max(0.01, Math.abs(l.r)));
      if (x >= 1 || len < 1e-3) continue;
      const f = ((1 - x * x) * (1 - x * x)) / (1 + len * len * 0.6),
        I = lum(l.c) * f;
      for (let i = 0; i < 3; i++) {
        K[i] += (d[i] / len) * I;
        KC[i] += l.c[i] * f;
      }
      total += I;
    }
  /* into the camera's frame: x its right, y up, z into the view (level: the figure stands upright on its card) */
  const rh = figureUnit([S.right[0], 0, S.right[2]]),
    fh = figureUnit([S.fwd[0], 0, S.fwd[2]]),
    kl = Math.hypot(K[0], K[1], K[2]);
  let L = kl > 1e-4 ? [K[0] * rh[0] + K[2] * rh[2], K[1], K[0] * fh[0] + K[2] * fh[2]] : [...FIGURE_LIGHT];
  /* stepped: 16 ways round the upright, heights 15 to 75 degrees (a light from below the figure's middle still lights
     it from above: the ground and the sky fill the rest) */
  const az = Math.round((Math.atan2(L[0], -L[2]) / (2 * Math.PI)) * 16) & 15,
    el = Math.max(
      1,
      Math.min(
        5,
        Math.round((Math.asin(Math.max(-1, Math.min(1, L[1] / (Math.hypot(...L) || 1)))) * 180) / Math.PI / 15)
      )
    ),
    a = (az / 16) * 2 * Math.PI,
    e = (el * 15 * Math.PI) / 180;
  L = [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
  const amb = S.amb || [0.6, 0.65, 0.75],
    ambI = lum(amb),
    flat = Math.round(Math.max(0, Math.min(1, ambI / (ambI + total + 1e-3) - 0.2) * 1.4) * 4) / 4,
    /* a colour's hue at the light's brightness, stepped to 1/16 */
    hue = (/** @type {number[]} */ c, /** @type {number} */ k) => {
      const l = lum(c);
      return /** @type {Vec3} */ (
        c.map(v => Math.round((1 + ((l > 1e-4 ? Math.max(0.55, Math.min(1.5, v / l)) : 1) - 1) * k) * 16) / 16)
      );
    },
    keyT = hue(KC, 0.45),
    ambT = hue(amb, 0.4),
    dark = Math.round(Math.max(0, Math.min(1, S.dark ?? 0)) * 4) / 4,
    rim = figureUnit([-L[0], 0.35, 0.6]),
    rimCol = /** @type {Vec3} */ (hue(amb, 1).map(v => Math.min(248, Math.round((v * 200) / 8) * 8))),
    rimK = 0.3 + 0.7 * dark;
  return {
    L: /** @type {Vec3} */ (L),
    flat,
    keyT,
    ambT,
    rim,
    rimCol,
    rimK,
    key: `${az}.${el}.${flat}.${dark}.${keyT.join(',')}.${ambT.join(',')}`,
  };
}
/** where the toon bands split, on the light's dot with a face's normal: above LIGHT the light band, above BASE the base;
 * above SHINE a glossy colour's shine (CH-3b: hair, shoes, lenses: the anime hair highlight); below DEEP the deep
 * shadow (CH-3b's fidelity pass: a fourth tone, so forms turn) */
export const FIGURE_BANDS = Object.freeze({ light: 0.5, base: -0.1, shine: 0.86, deep: -0.55 });

/** @typedef {[number, number, number]} Vec3 */
/** @typedef {{ front: number, side: number, back: number, bangs?: number, depth?: number, under?: boolean }} HairCut
 * (`under`: keep what is below the edge instead, a beard) where a hair cap
 * ends, as a height on its own sphere (-1 the bottom, 1 the top) at the front, the sides and the back, its fringe in
 * `bangs` points `depth` deep */
/** @typedef {{ jaw?: number, chin?: number, cheek?: number, crown?: number, brow?: number, face?: number,
 *   skull?: boolean }} HeadDeform a sculpted head (headDeform): how V the jaw is (0 square .. 1 a point), how far the
 *   chin drops, the cheekbones, how big the back of the skull, the brow, how flat the face; `skull` only the skull's
 *   shape (a hair cap over it), no features */
/** @typedef {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg?: number, rings?: number, cut?: HairCut, sq?: number,
 *     taper?: number, deform?: HeadDeform }
 *   | { kind: 'lathe', c: Vec3, y: number[], rx: number[], rz: number[], seg?: number }
 *   | { kind: 'capsule', a: Vec3, b: Vec3, r0: number, r1: number, seg?: number }
 *   | { kind: 'cone', a: Vec3, b: Vec3, r: number, seg?: number }
 *   | { kind: 'torus', c: Vec3, R: [number, number], r: number, seg?: number, rings?: number }
 *   | { kind: 'tube', a: Vec3, ctrl: Vec3, b: Vec3, r0: number, r1: number, flat?: number, n?: Vec3, seg?: number,
 *     steps?: number }
 *   | SdfShape} FigureShape
 * a part's shape, in its joint's space: an ellipsoid (centre, radii; a hair cap is one with a cut; `sq` 0..1 makes it
 * squarer, `taper` widens its bottom half and narrows its top, below 0 the other way: CH-3b's head shapes), a lathe (rings
 * round an upright axis through c at heights y, radii rx across and rz front to back; a radius of 0 closes it), a
 * capsule from a to b (radii r0 and r1), a cone from its base a to its tip b, a torus round an upright axis, or
 * (CH-3b) a tube: a stroke along the curve from a through ctrl's pull to b, its radius going from r0 to r1 (0: a
 * point), squashed to `flat` of it along `n` (a lock of hair lying on the head, a ponytail, a coat's tail) */
/** @typedef {{ id: string, parent: number, at: Vec3, shape: FigureShape, col: string,
 *   stripe?: { col: string, every: number, from?: number } }} FigurePart
 * a part: its joint at `at` from its parent's joint (rest pose, metres), its shape and its colour; `stripe` bands it
 * in a second colour every `every` metres of its height (from `from`) */
/** @typedef {{ part: string, kind: string, at: Vec3, n: Vec3, w: number, h: number, col?: string,
 *   hollow?: boolean, min?: number, narrow?: boolean, shut?: boolean, glint?: boolean, shape?: 'oval' | 'arc' | 'cap' | 'slant', dir?: number, t?: number, close?: boolean, when?: string }}
 * FaceMark
 * a mark painted on the picture in whole pixels: on part `part` at `at`, facing `n`, w by h metres, in colour `col`
 * (else the figure's colour named as its kind); `hollow` paints only its edge (a glasses frame); `min` how much it
 * must face the camera to show (else by kind: an eye 0.15, a mouth 0.25, anything else 0.2); `narrow` makes it a
 * pixel wide seen from the side, as an eye is; `shut` hides it in a blink; `glint: false` keeps an eye's own glint
 * off (the kit paints bigger ones); `shape` paints it as an oval, a smile's arc or a brow's cap (an arc the other
 * way up) once it is 3 pixels or more (a portrait); `close` shows it only in a close-up (90 px a metre or more: a
 * portrait, a battle). An 'eye' blinks and
 * narrows to a pixel seen from the side; an eye 2 pixels wide and 3 tall or more gets a glint (CH-3b: brows, lashes,
 * glasses, a stache, freckles, a name tag are marks too). CH-6: `when` shows it only in a face state that has it
 * ('eyes:half', 'mouth:talk_a', 'brows:angry', 'blush': figureFaceState) */
/** @typedef {{ mouth: string, talk: string[], expr: Record<string, { eyes: string, mouth: string | null,
 *   blush: boolean, talk?: string[] }> }} FaceSet CH-6: a kit figure's faces (logic/figure-kit.js kitFaceSet): its
 *   resting mouth, the talking frames, and each expression's eyes, mouth, blush and talking frames */
/** @typedef {{ when: Set<string>, key: string }} FaceState the tags a face shows and a short key for a picture's
 *   name ('' at rest) */
/** @typedef {{ swing?: number, arms?: number, bounce?: number, lean?: number, hang?: number, head?: number }}
 * FigureGait how a figure moves (figurePose): its legs' and arms' swing and its bounce as parts of the usual (1), its
 * lean forward (radians, below 0 back), how far out its arms hang (radians) and how its head is held (radians, a
 * stoop's forward) */
/** @typedef {{ name: string, height: number, parts: FigurePart[], colours: Record<string, Vec3>, face?: FaceMark[],
 *   gloss?: string[], faceSet?: FaceSet, skinRamp?: Vec3[],
 *   gait?: FigureGait, kit?: { head: string, build: string, bust?: number } }} Figure (`kit`: the head shape and build the figure
 * kit chose, logic/figure-kit.js) */
/** @typedef {{ rot: Vec3[], lift: Vec3[], scale: Vec3[], rootY: number, blink?: boolean }} FigurePose per part (in
 * parts order); `blink` closes the eyes */

/** @param {number[]} v @returns {Vec3} */
export function figureUnit(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Python's round (half to even), so the ramps match tools/build-scene-props.py to the unit @param {number} v */
export function figureRound(v) {
  const f = Math.floor(v),
    d = v - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(v);
}
/** @param {readonly number[]} a @param {readonly number[]} b @param {number} t @returns {Vec3} */
export function figureMix(a, b, t) {
  const m = (/** @type {number} */ i) => Math.trunc(figureRound(a[i] + (b[i] - a[i]) * t));
  return [m(0), m(1), m(2)];
}
/** @param {readonly number[]} c @param {number} k @returns {Vec3} */
export function figureDark(c, k) {
  const m = (/** @type {number} */ i) => Math.max(0, Math.min(255, Math.trunc(c[i] * k)));
  return [m(0), m(1), m(2)];
}
/**
 * a colour's ramp as the scene props paint it: [deep shadow, shadow, base, light, highlight], the shadows leaning
 * lavender and the lights warm (tools/build-scene-props.py ramp)
 * @param {readonly number[]} b @returns {Vec3[]}
 */
export function figureRamp(b) {
  return [
    figureMix(figureDark(b, 0.55), [60, 42, 112], 0.3),
    figureMix(figureDark(b, 0.79), [96, 74, 152], 0.17),
    [b[0], b[1], b[2]],
    figureMix(b, [255, 244, 196], 0.3),
    figureMix(b, [255, 252, 234], 0.6),
  ];
}
/** the outline a colour gets beside the background (tools/build-scene-props.py olc) @param {readonly number[]} c */
export function outlineOf(c) {
  return figureMix(figureDark(c, 0.45), OUTLINE_RGB, 0.8);
}
/** the band a face lit from the top left falls in: 0 shadow, 1 base, 2 light @param {number[]} n its normal, in the
 * camera's frame */
export function toonBand(n) {
  const d = n[0] * FIGURE_LIGHT[0] + n[1] * FIGURE_LIGHT[1] + n[2] * FIGURE_LIGHT[2];
  return d > FIGURE_BANDS.light ? 2 : d > FIGURE_BANDS.base ? 1 : 0;
}

/* ---------- the mannequin ---------- */
/**
 * a point on the front of an ellipsoid at (x, y), and its outward normal: where a face mark sits
 * @param {{ c: Vec3, r: Vec3, sq?: number, taper?: number, deform?: HeadDeform, kind?: string, items?: SdfItem[] }} E @param {number} x @param {number} y
 * @returns {{ at: Vec3, n: Vec3 }}
 */
export function frontOf(E, x, y) {
  if (E.kind === 'sdf' && E.items) return sdfFrontOf(/** @type {SdfShape} */ (/** @type {unknown} */ (E)), x, y);
  if (E.deform) return headFrontOf(E, x, y);
  const { c, r } = E,
    u = (x - c[0]) / r[0],
    v = (y - c[1]) / r[1],
    w = Math.sqrt(Math.max(0, 1 - u * u - v * v)),
    z = c[2] + r[2] * ellipsoidWarp(w, E.sq) * taperAt(v, E.taper);
  return { at: [x, y, z], n: figureUnit([u / r[0], v / r[1], w / r[2]]) };
}
/**
 * CH-3b round 5 (the owner: "Complete redo the heads. Use complex shapes with deformation"): a point of the unit
 * sphere (x right, y up, z the face's way) moved to where a sculpted head has it, before its radii scale it: the skull
 * fuller behind and drawn up underneath into the neck, the face flatter, the temples flat, the jaw narrowing toward
 * the chin (more at the front, the jaw line running back under the ear), the chin dropped and forward, and (not on a
 * `skull`) a brow ridge, eye sockets and cheekbones as raised and sunken patches
 * @param {number[]} d @param {HeadDeform} D @returns {Vec3}
 */
export function headDeform(d, D) {
  let [x, y, z] = d;
  const sm = (/** @type {number} */ t) => {
      const q = Math.max(0, Math.min(1, t));
      return q * q * (3 - 2 * q);
    },
    low = sm(-y),
    front = Math.max(0, z),
    back = Math.max(0, -z),
    cr = D.crown ?? 1,
    jw = D.jaw ?? 0.5,
    ch = D.chin ?? 0.5;
  /* the skull: fuller behind and above, its underside behind drawn up into the neck */
  const bulge = 1 + 0.1 * cr * back * sm(y + 0.6);
  z *= bulge;
  y *= bulge * (1 + 0.04 * (cr - 1));
  y += 0.32 * low * back * back;
  /* the jaw narrows toward the chin, the front more than the back */
  x *= 1 - low * (0.22 + 0.42 * jw) * (0.35 + 0.65 * front);
  /* the chin, down and a little forward */
  y -= 0.2 * ch * low * front * front;
  z += 0.06 * ch * low * low * front;
  /* a flatter face and flat temples (an egg's front is a dome) */
  z -= (D.face ?? 0.5) * 0.16 * front ** 4;
  x -= 0.1 * Math.sign(x) * Math.abs(x) ** 4 * (1 - low);
  if (!D.skull && front > 0) {
    const f = sm(front * 2),
      g = (/** @type {number} */ cx, /** @type {number} */ cy, /** @type {number} */ sx, /** @type {number} */ sy) =>
        Math.exp(-(((d[0] - cx) / sx) ** 2) - ((d[1] - cy) / sy) ** 2) * f,
      /* raised and sunken, along the way out */
      k =
        1 +
        0.045 * (D.brow ?? 1) * Math.exp(-(((d[1] - 0.13) / 0.09) ** 2) - (d[0] / 0.5) ** 4) * f -
        0.03 * (g(0.36, -0.07, 0.14, 0.1) + g(-0.36, -0.07, 0.14, 0.1)) +
        0.05 * (D.cheek ?? 1) * (g(0.56, -0.3, 0.2, 0.16) + g(-0.56, -0.3, 0.2, 0.16)) -
        0.03 * (g(0.62, -0.6, 0.18, 0.18) + g(-0.62, -0.6, 0.18, 0.18));
    x *= k;
    y *= k;
    z *= k;
  }
  return [x, y, z];
}
/** a point on the front of a sculpted head at (x, y) (where the sphere's point under it is moved to), and the way
 * out there (from its neighbours) @param {{ c: Vec3, r: Vec3, deform?: HeadDeform }} E @param {number} x @param {number} y
 * @returns {{ at: Vec3, n: Vec3 }} */
export function headFrontOf(E, x, y) {
  const { c, r } = E,
    D = /** @type {HeadDeform} */ (E.deform),
    at = (/** @type {number} */ u, /** @type {number} */ v) => {
      const w = Math.sqrt(Math.max(0, 1 - u * u - v * v)),
        q = headDeform([u, v, w], D);
      return /** @type {Vec3} */ ([c[0] + r[0] * q[0], c[1] + r[1] * q[1], c[2] + r[2] * q[2]]);
    },
    u = Math.max(-0.95, Math.min(0.95, (x - c[0]) / r[0])),
    v = Math.max(-0.95, Math.min(0.95, (y - c[1]) / r[1])),
    e = 0.02,
    p = at(u, v),
    a = vSub(at(u + e, v), at(u - e, v)),
    b = vSub(at(u, v + e), at(u, v - e));
  return { at: p, n: figureUnit(vCross(a, b)) };
}
/** a squarer ellipsoid's reach along an axis (`sq` 0..1: 0 round, 1 nearly a box) @param {number} d @param {number} [sq] */
export function ellipsoidWarp(d, sq) {
  return sq ? Math.sign(d) * Math.pow(Math.abs(d), 1 - 0.6 * sq) : d;
}
/** a tapered ellipsoid's width at height v on it (-1 the bottom, 1 the top) @param {number} v @param {number} [taper] */
export function taperAt(v, taper) {
  return taper ? 1 - taper * v : 1;
}
/**
 * the spike's mannequin, 1.75 m to the tip of its cowlick: the head and hair 0.6 m (about 2.9 heads), legs 0.5 m,
 * big mitten hands and bean shoes, a scarf. Parts in order, a parent before its children; the hair, the cowlick and
 * the face sit on the head's joint, the scarf on the body's.
 * @returns {Figure}
 */
export function mannequinFigure() {
  /** @type {FigurePart[]} */
  const parts = [];
  /** @param {string} id @param {string | null} parent @param {Vec3} at @param {FigureShape} shape @param {string} col */
  const add = (id, parent, at, shape, col) => {
    parts.push({ id, parent: parent == null ? -1 : parts.findIndex(p => p.id === parent), at, shape, col });
  };
  /** @type {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg: number, rings: number }} */
  const head = { kind: 'ellipsoid', c: [0, 0.29, 0.01], r: [0.3, 0.285, 0.275], seg: 16, rings: 12 };
  add(
    'hips',
    null,
    [0, 0.5, 0],
    { kind: 'ellipsoid', c: [0, 0.03, 0], r: [0.15, 0.09, 0.105], seg: 12, rings: 6 },
    'pants'
  );
  add(
    'torso',
    'hips',
    [0, 0.1, 0],
    {
      kind: 'lathe',
      c: [0, 0, 0],
      y: [-0.08, -0.05, 0.04, 0.17, 0.29, 0.37, 0.41],
      rx: [0, 0.1, 0.165, 0.172, 0.15, 0.1, 0],
      rz: [0, 0.08, 0.12, 0.125, 0.108, 0.075, 0],
      seg: 12,
    },
    'shirt'
  );
  add(
    'scarf',
    'torso',
    [0, 0.36, 0],
    { kind: 'torus', c: [0, 0, 0.005], R: [0.105, 0.085], r: 0.04, seg: 12, rings: 6 },
    'scarf'
  );
  add('head', 'torso', [0, 0.4, 0], head, 'skin');
  add(
    'hair',
    'head',
    [0, 0, 0],
    {
      kind: 'ellipsoid',
      c: [0, 0.305, 0.0],
      r: [0.318, 0.302, 0.294],
      seg: 16,
      rings: 12,
      cut: { front: 0.36, side: -0.05, back: -0.5, bangs: 3, depth: 0.16 },
    },
    'hair'
  );
  add(
    'cowlick',
    'head',
    [0, 0, 0],
    { kind: 'cone', a: [0.02, 0.56, -0.02], b: [0.09, 0.75, -0.1], r: 0.05, seg: 7 },
    'hair'
  );
  for (const s of [1, -1]) {
    const k = s > 0 ? 'A' : 'B';
    add(
      'thigh' + k,
      'hips',
      [s * 0.08, 0, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -0.24, 0], r0: 0.07, r1: 0.062, seg: 9 },
      'pants'
    );
    add(
      'shin' + k,
      'thigh' + k,
      [0, -0.24, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -0.19, 0], r0: 0.06, r1: 0.055, seg: 9 },
      'pants'
    );
    add(
      'foot' + k,
      'shin' + k,
      [0, -0.19, 0],
      { kind: 'ellipsoid', c: [0, -0.03, 0.04], r: [0.075, 0.04, 0.108], seg: 10, rings: 6 },
      'shoe'
    );
    add(
      'arm' + k,
      'torso',
      [s * 0.2, 0.33, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -0.19, 0], r0: 0.058, r1: 0.052, seg: 9 },
      'shirt'
    );
    add(
      'forearm' + k,
      'arm' + k,
      [0, -0.19, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -0.14, 0], r0: 0.047, r1: 0.044, seg: 8 },
      'skin'
    );
    add(
      'hand' + k,
      'forearm' + k,
      [0, -0.15, 0],
      { kind: 'ellipsoid', c: [0, -0.045, 0.008], r: [0.064, 0.068, 0.062], seg: 9, rings: 6 },
      'skin'
    );
  }
  /** @type {FaceMark[]} blush first, so the eyes and mouth go over it */
  const face = [];
  /** @param {FaceMark['kind']} kind @param {number} x @param {number} y @param {number} w @param {number} h */
  const mark = (kind, x, y, w, h) => face.push({ part: 'head', kind, ...frontOf(head, x, y), w, h });
  mark('blush', 0.18, 0.18, 0.07, 0.03);
  mark('blush', -0.18, 0.18, 0.07, 0.03);
  mark('mouth', 0, 0.135, 0.06, 0.03);
  mark('eye', 0.11, 0.255, 0.09, 0.125);
  mark('eye', -0.11, 0.255, 0.09, 0.125);
  return {
    name: 'mannequin',
    height: 1.75,
    parts,
    face,
    colours: {
      skin: [248, 214, 178],
      hair: [164, 98, 58],
      shirt: [46, 164, 160],
      scarf: [232, 98, 86],
      pants: [70, 84, 112],
      shoe: [132, 84, 60],
      eye: [36, 25, 54],
      glint: [250, 250, 245],
      mouth: [150, 70, 74],
      blush: [238, 146, 140],
    },
  };
}

/* ---------- poses ---------- */
/** a still pose: every part at rest @param {Figure} F @returns {FigurePose} */
export function restPose(F) {
  return {
    rot: F.parts.map(() => /** @type {Vec3} */ ([0, 0, 0])),
    lift: F.parts.map(() => /** @type {Vec3} */ ([0, 0, 0])),
    scale: F.parts.map(() => /** @type {Vec3} */ ([1, 1, 1])),
    rootY: 0,
  };
}
/**
 * a clip's pose at one of its frames. A swing forward is toward the figure's +z. A figure's `gait` gives it its own
 * way of moving (CH-3b: a stiff clerk, a bouncy kid, a swagger): how far the legs and arms swing, how much it bounces,
 * how it leans, and how wide its arms hang.
 * - idle (16 frames, two ticks each: 2.7 s): the chest and head rise a little for half the breath, the arms ease out,
 *   the head nods and leans; a blink on frame 14.
 * - walk (8 frames): the legs swing, the knee of the leg coming forward bends, the feet stay level, the arms swing
 *   against the legs with the elbows a little bent, the body twists and drops as the legs part and bounces as they
 *   pass, the head rocks.
 * - cheer (8 frames, on ones): both arms up and waving, a little hop on every other beat.
 * - throw (8 frames): the throwing arm (B, the figure's right) winds back and over, the body turns into it.
 * - sit (1 frame): thighs forward, shins down, the arms resting.
 * A four-legged figure (CH-3b's Kappi: parts legFL, legFR, legBL, legBR) walks its legs in diagonal pairs and nods.
 * @param {Figure} F @param {string} clip @param {number} frame @returns {FigurePose}
 */
export function figurePose(F, clip, frame) {
  const P = restPose(F),
    at = (/** @type {string} */ id) => F.parts.findIndex(p => p.id === id),
    rot = (/** @type {string} */ id, /** @type {number} */ ax, /** @type {number} */ a) => {
      const i = at(id);
      if (i >= 0) P.rot[i][ax] = a;
    },
    rx = (/** @type {string} */ id, /** @type {number} */ a) => rot(id, 0, a),
    G = { swing: 1, arms: 1, bounce: 1, lean: 0, hang: 0, head: 0, ...(F.gait || {}) };
  const n = CLIP_FRAMES[/** @type {keyof typeof CLIP_FRAMES} */ (clip)] || 1,
    f = ((Math.floor(frame) % n) + n) % n;
  if (at('legFL') >= 0) return quadPose(F, P, clip, f, n, rx);
  const sides = /** @type {[string, number][]} */ ([
    ['A', 1],
    ['B', -1],
  ]);
  if (clip === 'walk') {
    const a = (2 * Math.PI * f) / n,
      s = Math.sin(a),
      c = Math.cos(a),
      swing = 0.55 * G.swing;
    /* a forward swing is a turn about x by minus the angle (a turn by +a sends a hanging limb toward -z) */
    for (const [k, sg] of sides) {
      const th = swing * s * sg,
        knee = 0.75 * G.swing * Math.max(0, c * sg);
      rx('thigh' + k, -th);
      rx('shin' + k, knee);
      rx('foot' + k, th - knee);
      rx('arm' + k, 0.45 * G.arms * s * sg);
      rot('arm' + k, 2, sg * G.hang);
      rx('forearm' + k, -0.3);
    }
    P.rot[at('torso')][1] = 0.12 * G.swing * s;
    P.rot[at('head')][1] = -0.08 * s;
    P.rot[at('head')][0] = G.head;
    P.rot[at('torso')][0] = -0.06 + G.lean;
    /* the body drops as the legs part and bounces up as they pass (a spring in the step) */
    P.rootY = -0.5 * (1 - Math.cos(swing * s)) + 0.02 * G.bounce * (1 - Math.abs(s));
    P.rot[at('head')][2] = 0.03 * s;
    return P;
  }
  if (clip === 'cheer') {
    const wave = f % 2 ? 0.28 : -0.12;
    for (const [k, sg] of sides) {
      rot('arm' + k, 2, sg * (2.55 + (k === 'A' ? wave : -wave)));
      rx('forearm' + k, -0.35);
    }
    P.rootY = f % 4 < 2 ? 0.04 * G.bounce : 0;
    P.rot[at('head')][0] = -0.12;
    P.rot[at('torso')][0] = G.lean - 0.04;
    return P;
  }
  if (clip === 'throw') {
    const k = f / (n - 1),
      /* back over the shoulder by frame 3, then forward and down past the hip */
      arm = k < 0.45 ? 2.4 * (k / 0.45) : 2.4 - 3.6 * Math.min(1, (k - 0.45) / 0.4);
    rx('armB', arm);
    rx('forearmB', k < 0.45 ? -0.9 : -0.2);
    rx('armA', -0.5 * k);
    rot('armA', 2, 0.3);
    P.rot[at('torso')][1] = k < 0.45 ? -0.35 * (k / 0.45) : -0.35 + 0.75 * Math.min(1, (k - 0.45) / 0.4);
    P.rot[at('torso')][0] = G.lean + (k < 0.45 ? 0.05 : -0.12);
    rx('thighA', -0.25);
    rx('shinA', 0.2);
    rx('footA', 0.05);
    rx('thighB', 0.15);
    return P;
  }
  if (clip === 'sit') {
    for (const [k, sg] of sides) {
      rx('thigh' + k, -1.5);
      rx('shin' + k, 1.45);
      rx('foot' + k, 0.05);
      rx('arm' + k, -0.35);
      rot('arm' + k, 2, sg * 0.12);
      rx('forearm' + k, -0.7);
    }
    P.rot[at('torso')][0] = G.lean;
    return P;
  }
  const up = f >= 4 && f < 12 ? 1 : 0;
  P.lift[at('torso')][1] = up * 0.02;
  P.rot[at('torso')][0] = G.lean;
  /* a slow nod and a lean of the head with the breath */
  P.rot[at('head')][0] = G.head + (up ? -0.05 : 0.02);
  P.rot[at('head')][2] = f >= 8 ? 0.05 : -0.03;
  for (const [k, sg] of sides) {
    P.rot[at('arm' + k)][2] = sg * (0.06 + G.hang + up * 0.03);
    rx('forearm' + k, -0.12);
  }
  if (f === 14) P.blink = true;
  return P;
}
/**
 * a four-legged figure's pose (figurePose): the walk's legs in diagonal pairs (front left with back right), the body
 * rocking and the head bobbing; a cheer is a hop with the head up; anything else the idle, its breath lifting the
 * body, the head nodding, a blink on frame 14
 * @param {Figure} F @param {FigurePose} P @param {string} clip @param {number} f @param {number} n
 * @param {(id: string, a: number) => void} rx @returns {FigurePose}
 */
export function quadPose(F, P, clip, f, n, rx) {
  const at = (/** @type {string} */ id) => F.parts.findIndex(p => p.id === id),
    head = at('head');
  if (clip === 'walk') {
    const s = Math.sin((2 * Math.PI * f) / n);
    rx('legFL', -0.5 * s);
    rx('legBR', -0.5 * s);
    rx('legFR', 0.5 * s);
    rx('legBL', 0.5 * s);
    P.rot[at('body')][2] = 0.04 * s;
    if (head >= 0) P.rot[head][0] = 0.06 * Math.abs(s) - 0.03;
    P.rootY = 0.015 * (1 - Math.abs(s));
    return P;
  }
  if (clip === 'cheer') {
    P.rootY = f % 4 < 2 ? 0.05 : 0;
    if (head >= 0) P.rot[head][0] = -0.3;
    return P;
  }
  const up = f >= 4 && f < 12 ? 1 : 0;
  P.lift[at('body')][1] = up * 0.012;
  if (head >= 0) {
    P.rot[head][0] = up ? -0.06 : 0.04;
    P.rot[head][1] = f >= 8 ? 0.08 : -0.04;
  }
  if (f === 14 && clip !== 'sit') P.blink = true;
  return P;
}

/* ---------- matrices (column-major, as WebGL reads them) ---------- */
/** @param {Float32Array | number[]} a @param {Float32Array | number[]} b @returns {Float32Array} */
export function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
  return o;
}
/** a turn about x, then y, then z (radians), a scale, then a move to (tx, ty, tz): T · Rz · Ry · Rx · S
 * @param {number[]} r @param {number[]} s @param {number[]} t @returns {Float32Array} */
export function partMatrix(r, s, t) {
  const [cx, sx] = [Math.cos(r[0]), Math.sin(r[0])],
    [cy, sy] = [Math.cos(r[1]), Math.sin(r[1])],
    [cz, sz] = [Math.cos(r[2]), Math.sin(r[2])];
  /* R = Rz · Ry · Rx, written out */
  const m00 = cz * cy,
    m01 = cz * sy * sx - sz * cx,
    m02 = cz * sy * cx + sz * sx,
    m10 = sz * cy,
    m11 = sz * sy * sx + cz * cx,
    m12 = sz * sy * cx - cz * sx,
    m20 = -sy,
    m21 = cy * sx,
    m22 = cy * cx;
  return new Float32Array([
    m00 * s[0],
    m10 * s[0],
    m20 * s[0],
    0,
    m01 * s[1],
    m11 * s[1],
    m21 * s[1],
    0,
    m02 * s[2],
    m12 * s[2],
    m22 * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ]);
}
/**
 * each part's matrix from its own box to the figure's space, posed: a child turns about its joint on its parent. The
 * whole figure is lifted by the pose's rootY, snapped to whole texels (1 / ppm), so the body steps a pixel at a time.
 * Scales don't pass to children (a blink shrinks the eye, nothing on it).
 * @param {Figure} F @param {FigurePose} P @param {number} ppm @returns {Float32Array} 16 numbers a part
 */
export function jointMatrices(F, P, ppm) {
  const out = new Float32Array(F.parts.length * 16),
    /** @type {Float32Array[]} */ noScale = [],
    snap = ppm > 0 ? Math.round(P.rootY * ppm) / ppm : P.rootY;
  F.parts.forEach((p, i) => {
    const L = P.lift[i],
      t = [p.at[0] + L[0], p.at[1] + L[1] + (p.parent < 0 ? snap : 0), p.at[2] + L[2]],
      local = partMatrix(P.rot[i], [1, 1, 1], t),
      world = p.parent < 0 ? local : mat4Mul(noScale[p.parent], local);
    noScale[i] = world;
    const sc = P.scale[i];
    out.set(
      sc[0] === 1 && sc[1] === 1 && sc[2] === 1 ? world : mat4Mul(world, partMatrix([0, 0, 0], sc, [0, 0, 0])),
      i * 16
    );
  });
  return out;
}

/* ---------- the mesh ---------- */
/** @param {number[]} a @param {number[]} b @returns {Vec3} */
export const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} a @param {number[]} b @returns {Vec3} */
export const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** @param {number[]} a @param {number[]} b */
export const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * a surface from rings of points (a ring of one point is a pole), each point with a way out of the shape: triangles
 * between each ring and the next (and the last and the first, `closed`)
 * @param {Vec3[][]} rings @param {Vec3[][]} out @param {boolean} [closed]
 * @returns {{ pts: Vec3[], out: Vec3[], tris: number[][] }}
 */
export function ringSurface(rings, out, closed = false) {
  /** @type {Vec3[]} */ const pts = [],
    /** @type {Vec3[]} */ hint = [],
    /** @type {number[][]} */ tris = [],
    /** @type {number[]} */ at = [];
  rings.forEach((R, i) => {
    at.push(pts.length);
    R.forEach((p, j) => {
      pts.push(p);
      hint.push(out[i][j]);
    });
  });
  const n = rings.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const A = rings[i],
      B = rings[(i + 1) % n],
      a = at[i],
      b = at[(i + 1) % n];
    if (A.length === 1 && B.length === 1) continue;
    if (A.length === 1) for (let j = 0; j < B.length; j++) tris.push([a, b + j, b + ((j + 1) % B.length)]);
    else if (B.length === 1) for (let j = 0; j < A.length; j++) tris.push([a + j, b, a + ((j + 1) % A.length)]);
    else
      for (let j = 0; j < A.length; j++) {
        const j1 = (j + 1) % A.length;
        tris.push([a + j, b + j, b + j1], [a + j, b + j1, a + j1]);
      }
  }
  return { pts, out: hint, tris };
}
/**
 * the hair cap's edge: the height on its sphere (-1..1) below which an ellipsoid is cut away, at a point (u across, w
 * front to back) of its sphere; the fringe comes down in points at the front
 * @param {HairCut} C @param {number} u @param {number} w
 */
export function hairCutAt(C, u, w) {
  let v = w >= 0 ? C.side + (C.front - C.side) * w : C.side + (C.back - C.side) * -w;
  if (C.bangs && w > 0.3)
    v -= (C.depth || 0) * (0.5 + 0.5 * Math.cos(u * C.bangs * Math.PI)) * Math.min(1, (w - 0.3) / 0.4);
  return v;
}
/* ---------- blended shapes: signed distances, meshed ----------
   CH-3b round 6 (the owner: "Even more complex shapes make sure they flow into each other. Add more natural flowy
   shapes for the hair"): a head (its skull, face, jaw, chin, cheekbones, brow, nose, ears and the top of its neck) or
   a head of hair (its cap and every lock) as one surface: simple shapes, each a signed distance (below 0 inside),
   joined smoothly (a smooth minimum, so one form grows out of the next with no seam), cut away or carved, then meshed
   on a grid (surface nets). The same distances answer where a face mark sits (sdfFrontOf) and keep hair out
   of the head (sdfAt). */
/** @typedef {{ t: 'ell', c: Vec3, r: Vec3 } | { t: 'cone', a: Vec3, b: Vec3, ra: number, rb: number }
 *   | { t: 'cut', c: Vec3, r: Vec3, cut: HairCut } | { t: 'slab', y: number, below?: boolean }} SdfPrim a shape:
 *   an ellipsoid, a tapered capsule (radius ra at a to rb at b), a hair cap's edge round an ellipsoid (keep above it,
 *   or below with `cut.under`), or everything above (below) a height */
/** @typedef {{ p: SdfPrim, op: 'add' | 'sub' | 'and', k?: number }} SdfItem one step: join (smoothly, over k
 *   metres), carve away (smoothly) or keep only the inside of (a cut: everywhere) */
/** @typedef {{ kind: 'sdf', items: SdfItem[], h: number, c: Vec3, r: Vec3 }} SdfShape a blended shape: its steps in
 *   order, the grid's cell (metres), and the ellipsoid it is laid out round (a head's: the face marks and the hair go by
 *   it) */
/** a smooth minimum over k @param {number} a @param {number} b @param {number} k */
export function sdfSmin(a, b, k) {
  if (!(k > 0)) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** a shape's signed distance at (x, y, z) @param {SdfPrim} P @param {number} x @param {number} y @param {number} z */
export function sdfPrimAt(P, x, y, z) {
  if (P.t === 'ell') {
    const px = (x - P.c[0]) / P.r[0],
      py = (y - P.c[1]) / P.r[1],
      pz = (z - P.c[2]) / P.r[2],
      k0 = Math.hypot(px, py, pz),
      k1 = Math.hypot(px / P.r[0], py / P.r[1], pz / P.r[2]);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(P.r[0], P.r[1], P.r[2]);
  }
  if (P.t === 'cone') {
    const bx = P.b[0] - P.a[0],
      by = P.b[1] - P.a[1],
      bz = P.b[2] - P.a[2],
      L2 = bx * bx + by * by + bz * bz || 1e-12,
      t = Math.max(0, Math.min(1, ((x - P.a[0]) * bx + (y - P.a[1]) * by + (z - P.a[2]) * bz) / L2));
    return Math.hypot(x - P.a[0] - bx * t, y - P.a[1] - by * t, z - P.a[2] - bz * t) - (P.ra + (P.rb - P.ra) * t);
  }
  if (P.t === 'cut') {
    const u = (x - P.c[0]) / P.r[0],
      v = (y - P.c[1]) / P.r[1],
      w = (z - P.c[2]) / P.r[2],
      l = Math.hypot(u, w) || 1,
      /* the edge's height at this way round (the cap's sphere seen from its upright axis) */
      e = hairCutAt(P.cut, u / l, w / l);
    return (P.cut.under ? v - e : e - v) * P.r[1];
  }
  return P.below ? y - P.y : P.y - y;
}
/** a shape's signed distance as a function with its numbers worked out once (the grid's inner loop)
 * @param {SdfPrim} P @returns {(x: number, y: number, z: number) => number} */
export function sdfPrimFn(P) {
  if (P.t === 'ell') {
    const [cx, cy, cz] = P.c,
      [rx, ry, rz] = P.r,
      mn = -Math.min(rx, ry, rz);
    return (x, y, z) => {
      const px = (x - cx) / rx,
        py = (y - cy) / ry,
        pz = (z - cz) / rz,
        k0 = Math.sqrt(px * px + py * py + pz * pz),
        qx = px / rx,
        qy = py / ry,
        qz = pz / rz,
        k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
      return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : mn;
    };
  }
  if (P.t === 'cone') {
    const [ax, ay, az] = P.a,
      bx = P.b[0] - ax,
      by = P.b[1] - ay,
      bz = P.b[2] - az,
      L2 = bx * bx + by * by + bz * bz || 1e-12,
      ra = P.ra,
      dr = P.rb - P.ra;
    return (x, y, z) => {
      const px = x - ax,
        py = y - ay,
        pz = z - az;
      let t = (px * bx + py * by + pz * bz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px - bx * t,
        dy = py - by * t,
        dz = pz - bz * t;
      return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + dr * t);
    };
  }
  return (x, y, z) => sdfPrimAt(P, x, y, z);
}
/** a step's box: [x0, y0, z0, x1, y1, z1], or null for one that reaches everywhere @param {SdfPrim} P
 * @returns {number[] | null} */
export function sdfBox(P) {
  if (P.t === 'ell')
    return [P.c[0] - P.r[0], P.c[1] - P.r[1], P.c[2] - P.r[2], P.c[0] + P.r[0], P.c[1] + P.r[1], P.c[2] + P.r[2]];
  if (P.t === 'cone') {
    const m = Math.max(P.ra, P.rb);
    return [0, 1, 2].map(i => Math.min(P.a[i], P.b[i]) - m).concat([0, 1, 2].map(i => Math.max(P.a[i], P.b[i]) + m));
  }
  return null;
}
/** how high a blended shape reaches (the top of its joined steps' boxes) @param {SdfShape} S */
export function sdfTop(S) {
  let y = -Infinity;
  for (const it of S.items) {
    const B = it.op === 'add' ? sdfBox(it.p) : null;
    if (B) y = Math.max(y, B[4]);
  }
  return y;
}
/** the blended distance at a point (every step, wherever its box is) @param {SdfShape} S @param {number[]} p */
export function sdfAt(S, p) {
  let f = 1e9;
  for (const it of S.items) {
    const k = it.k || 0;
    const d = sdfPrimAt(it.p, p[0], p[1], p[2]);
    f = it.op === 'add' ? sdfSmin(f, d, k) : it.op === 'sub' ? -sdfSmin(-f, d, k) : Math.max(f, d);
  }
  return f;
}
/** the way out of a blended shape at a point (its distance's slope) @param {SdfShape} S @param {number[]} p @returns {Vec3} */
export function sdfNormal(S, p) {
  const e = S.h * 0.5,
    d = (/** @type {number} */ i) => {
      const a = [p[0], p[1], p[2]],
        b = [p[0], p[1], p[2]];
      a[i] += e;
      b[i] -= e;
      return sdfAt(S, a) - sdfAt(S, b);
    };
  return figureUnit([d(0), d(1), d(2)]);
}
/** where the surface is seen straight on at (x, y) (the face's way, +z), and the way out there: a face mark's place
 * on a blended head @param {SdfShape} S @param {number} x @param {number} y @returns {{ at: Vec3, n: Vec3 }} */
export function sdfFrontOf(S, x, y) {
  const z0 = S.c[2] + S.r[2] * 1.8,
    z1 = S.c[2] - S.r[2] * 0.5,
    step = S.h * 0.5;
  let zo = z0,
    fo = sdfAt(S, [x, y, z0]);
  for (let z = z0 - step; z >= z1; z -= step) {
    const f = sdfAt(S, [x, y, z]);
    if (f < 0) {
      let a = z,
        b = zo;
      for (let i = 0; i < 12; i++) {
        const m = (a + b) / 2;
        if (sdfAt(S, [x, y, m]) < 0) a = m;
        else b = m;
      }
      const at = /** @type {Vec3} */ ([x, y, (a + b) / 2]);
      return { at, n: sdfNormal(S, at) };
    }
    zo = z;
    fo = f;
  }
  void fo;
  return { at: [x, y, S.c[2] + S.r[2]], n: [0, 0, 1] };
}
/** the eight corners of a grid cell */
export const SDF_CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
/**
 * a blended shape's surface: the distances on a grid (each step laid only over its own box, so a head of hair's
 * hundreds of strokes stay quick), then surface nets; each point with the distance's slope as its way out
 * @param {SdfShape} S @returns {{ pts: Vec3[], out: Vec3[], tris: number[][] }}
 */
export function sdfSurface(S) {
  const h = S.h,
    m = 1.5 * h;
  /* the grid round every joined step */
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (const it of S.items) {
    const B = it.op === 'add' ? sdfBox(it.p) : null;
    if (!B) continue;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], B[i] - m - (it.k || 0));
      hi[i] = Math.max(hi[i], B[i + 3] + m + (it.k || 0));
    }
  }
  if (!(lo[0] < hi[0])) return { pts: [], out: [], tris: [] };
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1,
    ny = Math.ceil((hi[1] - lo[1]) / h) + 1,
    nz = Math.ceil((hi[2] - lo[2]) / h) + 1,
    F = new Float32Array(nx * ny * nz).fill(1e9),
    at = (/** @type {number} */ i, /** @type {number} */ j, /** @type {number} */ k) => i + nx * (j + ny * k);
  for (const it of S.items) {
    const B = sdfBox(it.p),
      k = it.k || 0,
      r = m + k,
      i0 = B ? Math.max(0, Math.floor((B[0] - r - lo[0]) / h)) : 0,
      j0 = B ? Math.max(0, Math.floor((B[1] - r - lo[1]) / h)) : 0,
      k0 = B ? Math.max(0, Math.floor((B[2] - r - lo[2]) / h)) : 0,
      i1 = B ? Math.min(nx - 1, Math.ceil((B[3] + r - lo[0]) / h)) : nx - 1,
      j1 = B ? Math.min(ny - 1, Math.ceil((B[4] + r - lo[1]) / h)) : ny - 1,
      k1 = B ? Math.min(nz - 1, Math.ceil((B[5] + r - lo[2]) / h)) : nz - 1;
    const op = it.op === 'add' ? 0 : it.op === 'sub' ? 1 : 2,
      D = sdfPrimFn(it.p),
      kk = k > 0 ? k : 1e-9;
    for (let c = k0; c <= k1; c++) {
      const z = lo[2] + c * h;
      for (let b = j0; b <= j1; b++) {
        const y = lo[1] + b * h;
        let n = i0 + nx * (b + ny * c);
        for (let a = i0; a <= i1; a++, n++) {
          const d = D(lo[0] + a * h, y, z),
            f = F[n];
          if (op === 2) {
            if (d > f) F[n] = d;
            continue;
          }
          /* a smooth minimum (join) or maximum (carve) */
          const p = op === 0 ? f : -f,
            q = op === 0 ? d : d,
            e = Math.max(kk - Math.abs(p - q), 0) / kk,
            v = Math.min(p, q) - e * e * kk * 0.25;
          F[n] = op === 0 ? v : -v;
        }
      }
    }
  }
  /* surface nets: a point in each cell the surface passes through (the average of where it crosses the cell's
     edges), and a quad round each grid edge it crosses, joining the four cells that share that edge */
  /** @type {Vec3[]} */ const pts = [],
    /** @type {Vec3[]} */ out = [],
    /** @type {number[][]} */ tris = [],
    cell = new Int32Array(nx * ny * nz).fill(-1),
    V = new Float64Array(8),
    EDGES = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ];
  for (let c = 0; c < nz - 1; c++)
    for (let b = 0; b < ny - 1; b++)
      for (let a = 0; a < nx - 1; a++) {
        let inside = 0;
        for (let q = 0; q < 8; q++) {
          const o = SDF_CORNERS[q];
          V[q] = F[at(a + o[0], b + o[1], c + o[2])];
          if (V[q] < 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        let sx = 0,
          sy = 0,
          sz = 0,
          n = 0;
        for (const [p, q] of EDGES) {
          if (V[p] < 0 === V[q] < 0) continue;
          const t = V[p] / (V[p] - V[q]),
            P = SDF_CORNERS[p],
            Q = SDF_CORNERS[q];
          sx += P[0] + (Q[0] - P[0]) * t;
          sy += P[1] + (Q[1] - P[1]) * t;
          sz += P[2] + (Q[2] - P[2]) * t;
          n++;
        }
        cell[at(a, b, c)] = pts.length;
        pts.push([lo[0] + (a + sx / n) * h, lo[1] + (b + sy / n) * h, lo[2] + (c + sz / n) * h]);
        /* the slope across the cell: its way out */
        out.push(
          figureUnit([
            V[1] + V[2] + V[5] + V[6] - V[0] - V[3] - V[4] - V[7],
            V[2] + V[3] + V[6] + V[7] - V[0] - V[1] - V[4] - V[5],
            V[4] + V[5] + V[6] + V[7] - V[0] - V[1] - V[2] - V[3],
          ])
        );
      }
  /** the quad round the grid edge from (a, b, c) one step along axis `ax`, if the surface crosses it */
  const quad = (
    /** @type {number} */ a,
    /** @type {number} */ b,
    /** @type {number} */ c,
    /** @type {number} */ ax
  ) => {
    const f0 = F[at(a, b, c)],
      f1 = ax === 0 ? F[at(a + 1, b, c)] : ax === 1 ? F[at(a, b + 1, c)] : F[at(a, b, c + 1)];
    if (f0 < 0 === f1 < 0) return;
    /* the four cells round the edge */
    const C =
      ax === 0
        ? [at(a, b - 1, c - 1), at(a, b, c - 1), at(a, b, c), at(a, b - 1, c)]
        : ax === 1
          ? [at(a - 1, b, c - 1), at(a, b, c - 1), at(a, b, c), at(a - 1, b, c)]
          : [at(a - 1, b - 1, c), at(a, b - 1, c), at(a, b, c), at(a - 1, b, c)];
    const v = C.map(i => cell[i]);
    if (v.some(i => i < 0)) return;
    tris.push([v[0], v[1], v[2]], [v[0], v[2], v[3]]);
  };
  for (let c = 1; c < nz - 1; c++)
    for (let b = 1; b < ny - 1; b++)
      for (let a = 1; a < nx - 1; a++) {
        quad(a, b, c, 0);
        quad(a, b, c, 1);
        quad(a, b, c, 2);
      }
  return { pts, out, tris };
}
/**
 * a shape's surface: points, a way out of the shape at each, and triangles
 * @param {FigureShape} sh @returns {{ pts: Vec3[], out: Vec3[], tris: number[][] }}
 */
export function shapeSurface(sh) {
  if (sh.kind === 'sdf') return sdfSurface(sh);
  /** @type {Vec3[][]} */ const R = [],
    /** @type {Vec3[][]} */ O = [];
  const ring = (/** @type {number} */ n, /** @type {(t: number) => [Vec3, Vec3]} */ f) => {
    const r = [],
      o = [];
    for (let j = 0; j < n; j++) {
      const [p, q] = f((2 * Math.PI * j) / n);
      r.push(p);
      o.push(q);
    }
    R.push(r);
    O.push(o);
  };
  if (sh.kind === 'ellipsoid') {
    const { c, r } = sh,
      seg = sh.seg || 12,
      rings = sh.rings || 8,
      /** the sphere's points under a sculpted head's, for the hair's cut @type {Vec3[]} */ dirs = [];
    for (let i = 0; i <= rings; i++) {
      const ph = (Math.PI * i) / rings,
        sp = Math.sin(ph),
        cp = Math.cos(ph);
      if (i === 0 || i === rings) {
        const q = sh.deform ? headDeform([0, cp, 0], sh.deform) : [0, cp, 0],
          p = /** @type {Vec3} */ ([c[0] + r[0] * q[0], c[1] + r[1] * q[1], c[2] + r[2] * q[2]]);
        if (sh.deform) dirs.push([0, cp, 0]);
        R.push([p]);
        O.push([[0, cp, 0]]);
      } else
        ring(seg, t => {
          const d = /** @type {Vec3} */ ([sp * Math.sin(t), cp, sp * Math.cos(t)]),
            k = taperAt(cp, sh.taper),
            q = sh.deform
              ? headDeform(d, sh.deform)
              : /** @type {Vec3} */ ([
                  ellipsoidWarp(d[0], sh.sq) * k,
                  ellipsoidWarp(d[1], sh.sq),
                  ellipsoidWarp(d[2], sh.sq) * k,
                ]);
          if (sh.deform) dirs.push(d);
          return [[c[0] + r[0] * q[0], c[1] + r[1] * q[1], c[2] + r[2] * q[2]], d];
        });
    }
    const S = ringSurface(R, O);
    if (sh.cut) {
      const C = sh.cut;
      S.tris = S.tris.filter(tr => {
        if (sh.deform) {
          const m = [0, 1, 2].map(k => (dirs[tr[0]][k] + dirs[tr[1]][k] + dirs[tr[2]][k]) / 3);
          return C.under ? m[1] < hairCutAt(C, m[0], m[2]) : m[1] > hairCutAt(C, m[0], m[2]);
        }
        const m = [0, 1, 2].map(k => (S.pts[tr[0]][k] + S.pts[tr[1]][k] + S.pts[tr[2]][k]) / 3);
        const u = (m[0] - c[0]) / r[0],
          v = (m[1] - c[1]) / r[1],
          w = (m[2] - c[2]) / r[2];
        return v > hairCutAt(C, u, w);
      });
    }
    return S;
  }
  if (sh.kind === 'lathe') {
    const seg = sh.seg || 12,
      c = sh.c,
      mid = sh.y.reduce((a, b) => a + b, 0) / sh.y.length;
    sh.y.forEach((y, i) => {
      if (!(sh.rx[i] > 0)) {
        R.push([[c[0], y, c[2]]]);
        O.push([[0, y - mid, 0]]);
      } else
        ring(seg, t => {
          const p = /** @type {Vec3} */ ([c[0] + sh.rx[i] * Math.sin(t), y, c[2] + sh.rz[i] * Math.cos(t)]);
          return [p, vSub(p, [c[0], mid, c[2]])];
        });
    });
    return ringSurface(R, O);
  }
  if (sh.kind === 'tube') {
    /* a quadratic curve a -> ctrl -> b, rings of `seg` points round it at `steps` + 1 places, a cap at each end */
    const steps = sh.steps || 6,
      seg = sh.seg || 6,
      at = (/** @type {number} */ t) =>
        /** @type {Vec3} */ (
          [0, 1, 2].map(i => (1 - t) * (1 - t) * sh.a[i] + 2 * (1 - t) * t * sh.ctrl[i] + t * t * sh.b[i])
        ),
      tangent = (/** @type {number} */ t) =>
        figureUnit([0, 1, 2].map(i => 2 * (1 - t) * (sh.ctrl[i] - sh.a[i]) + 2 * t * (sh.b[i] - sh.ctrl[i]))),
      up = sh.n || [0, 0, 1];
    const T0 = tangent(0);
    R.push([sh.a]);
    O.push([[-T0[0], -T0[1], -T0[2]]]);
    for (let k = 0; k <= steps; k++) {
      const t = k / steps,
        C = at(t),
        T = tangent(t);
      let p0 = figureUnit(vCross(T, up));
      if (!Number.isFinite(p0[0]) || Math.hypot(...vCross(T, up)) < 1e-6) p0 = figureUnit(vCross(T, [1, 0, 0]));
      const q0 = vCross(p0, T),
        /* round at its root, tapering to its tip; a little fuller a third of the way along */
        rad = (sh.r0 + (sh.r1 - sh.r0) * t) * (1 + 0.15 * Math.sin(Math.PI * Math.min(1, t * 1.5))),
        fl = sh.flat ?? 1;
      ring(seg, a => {
        const d = /** @type {Vec3} */ ([0, 1, 2].map(i => p0[i] * Math.cos(a) + q0[i] * Math.sin(a) * fl)),
          p = /** @type {Vec3} */ ([C[0] + d[0] * rad, C[1] + d[1] * rad, C[2] + d[2] * rad]);
        return [p, vSub(p, C)];
      });
    }
    const T1 = tangent(1);
    R.push([sh.b]);
    O.push([T1]);
    return ringSurface(R, O);
  }
  if (sh.kind === 'capsule' || sh.kind === 'cone') {
    const a = sh.a,
      b = sh.b,
      d = vSub(b, a),
      L = Math.hypot(d[0], d[1], d[2]) || 1e-6,
      e = /** @type {Vec3} */ ([d[0] / L, d[1] / L, d[2] / L]),
      /* two ways across the axis */
      p0 = figureUnit(Math.abs(e[1]) < 0.9 ? vCross(e, [0, 1, 0]) : vCross(e, [1, 0, 0])),
      q0 = vCross(e, p0),
      seg = sh.seg || 8,
      /** @param {number} along @param {number} rad @param {Vec3} axisAt */
      circle = (along, rad, axisAt) =>
        ring(seg, t => {
          const dir = /** @type {Vec3} */ ([
            p0[0] * Math.cos(t) + q0[0] * Math.sin(t),
            p0[1] * Math.cos(t) + q0[1] * Math.sin(t),
            p0[2] * Math.cos(t) + q0[2] * Math.sin(t),
          ]);
          const centre = [a[0] + e[0] * along, a[1] + e[1] * along, a[2] + e[2] * along],
            p = /** @type {Vec3} */ ([centre[0] + dir[0] * rad, centre[1] + dir[1] * rad, centre[2] + dir[2] * rad]);
          return [p, vSub(p, axisAt)];
        }),
      pole = (/** @type {number} */ along, /** @type {Vec3} */ way) => {
        R.push([[a[0] + e[0] * along, a[1] + e[1] * along, a[2] + e[2] * along]]);
        O.push([way]);
      };
    if (sh.kind === 'cone') {
      const mid = /** @type {Vec3} */ ([a[0] + d[0] / 3, a[1] + d[1] / 3, a[2] + d[2] / 3]);
      pole(0, [-e[0], -e[1], -e[2]]);
      circle(0, sh.r, mid);
      circle(L * 0.5, sh.r * 0.5, mid);
      pole(L, e);
      return ringSurface(R, O);
    }
    /* a half sphere at each end, the side between them */
    const steps = 3;
    pole(-sh.r0, [-e[0], -e[1], -e[2]]);
    for (let k = steps - 1; k >= 0; k--) {
      const al = (Math.PI / 2) * (k / steps);
      circle(-sh.r0 * Math.sin(al), sh.r0 * Math.cos(al), a);
    }
    for (let k = 0; k < steps; k++) {
      const al = (Math.PI / 2) * (k / steps);
      circle(L + sh.r1 * Math.sin(al), sh.r1 * Math.cos(al), b);
    }
    pole(L + sh.r1, e);
    return ringSurface(R, O);
  }
  /* a torus round an upright axis through c: a ring of the tube's circles */
  const { c, r } = sh,
    seg = sh.seg || 12,
    rings = sh.rings || 6;
  for (let i = 0; i < seg; i++) {
    const t = (2 * Math.PI * i) / seg,
      cx = c[0] + sh.R[0] * Math.sin(t),
      cz = c[2] + sh.R[1] * Math.cos(t),
      rad = /** @type {Vec3} */ ([Math.sin(t), 0, Math.cos(t)]),
      tube = /** @type {Vec3} */ ([cx, c[1], cz]);
    const ringPts = [],
      ringOut = [];
    for (let j = 0; j < rings; j++) {
      const a = (2 * Math.PI * j) / rings,
        dir = /** @type {Vec3} */ ([rad[0] * Math.cos(a), Math.sin(a), rad[2] * Math.cos(a)]);
      ringPts.push(/** @type {Vec3} */ ([cx + dir[0] * r, c[1] + dir[1] * r, cz + dir[2] * r]));
      ringOut.push(vSub(ringPts[j], tube));
    }
    R.push(ringPts);
    O.push(ringOut);
  }
  return ringSurface(R, O, true);
}
/**
 * a shape's triangles, each wound counter-clockwise seen from outside, with smooth normals (each point's the sum of
 * the faces round it, so the toon bands follow the curve): 6 numbers a vertex (x, y, z, the normal)
 * @param {FigureShape} sh @returns {number[][][]} three vertices a triangle
 */
export function shapeTriangles(sh) {
  const S = shapeSurface(sh),
    /** @type {Vec3[]} */ nrm = S.pts.map(() => [0, 0, 0]);
  const tris = S.tris.map(tr => {
    let [i, j, k] = tr;
    let g = vCross(vSub(S.pts[j], S.pts[i]), vSub(S.pts[k], S.pts[i]));
    const o = [0, 1, 2].map(m => S.out[i][m] + S.out[j][m] + S.out[k][m]);
    if (vDot(g, o) < 0) {
      [j, k] = [k, j];
      g = [-g[0], -g[1], -g[2]];
    }
    for (const v of [i, j, k]) for (let m = 0; m < 3; m++) nrm[v][m] += g[m];
    return [i, j, k];
  });
  const N = nrm.map(n => figureUnit(n));
  return tris.map(tr => tr.map(v => [...S.pts[v], ...N[v]]));
}
/**
 * the figure's shapes as triangles, each vertex with its part (one joint) and colour: 8 numbers a vertex (x, y, z, the
 * smooth normal, the part, the colour's place in `colours`: the colours its parts use, at most FIGURE_PAL_MAX)
 * @param {Figure} F @param {number} [detail] rings and segments times this (a close-up's finer mesh)
 * @returns {{ data: Float32Array, count: number, colours: string[] }}
 */
export function figureMesh(F, detail = 1) {
  /* only the colours the parts use (face marks are painted, not shaded): the baker's palette holds FIGURE_PAL_MAX */
  const colours = [...new Set(F.parts.map(p => p.col))].filter(k => k in F.colours),
    /** @type {number[]} */ v = [];
  if (colours.length > FIGURE_PAL_MAX) throw new Error(`figure ${F.name}: ${colours.length} colours`);
  for (const p of F.parts)
    if (p.stripe && !colours.includes(p.stripe.col) && p.stripe.col in F.colours) colours.push(p.stripe.col);
  if (colours.length > FIGURE_PAL_MAX) throw new Error(`figure ${F.name}: ${colours.length} colours`);
  F.parts.forEach((p, j) => {
    const ci = Math.max(0, colours.indexOf(p.col)),
      S = p.stripe,
      si = S ? colours.indexOf(S.col) : -1;
    for (const tri of shapeTriangles(detail !== 1 ? finerShape(p.shape, detail) : p.shape)) {
      /* CH-3b: a striped part's triangles take the stripe's colour in every other band of its height */
      const y = (tri[0][1] + tri[1][1] + tri[2][1]) / 3,
        c = S && si >= 0 && Math.floor((y - (S.from || 0)) / S.every) % 2 === 1 ? si : ci;
      for (const q of tri) v.push(...q, j, c);
    }
  });
  return { data: new Float32Array(v), count: v.length / 8, colours };
}

/**
 * a shape with `k` times its rings and segments, for a close-up (CH-3b: a portrait at 160 px a metre showed the
 * low-poly facets the walking size hides)
 * @param {FigureShape} sh @param {number} k @returns {FigureShape}
 */
export function finerShape(sh, k) {
  /** @type {any} */
  const o = { ...sh };
  if (sh.kind !== 'sdf' && ('seg' in sh || sh.kind !== 'lathe')) o.seg = Math.max(4, Math.round((sh.seg || 12) * k));
  if (sh.kind === 'ellipsoid' || sh.kind === 'torus') o.rings = Math.max(3, Math.round((sh.rings || 8) * k));
  if (sh.kind === 'tube') o.steps = Math.max(2, Math.round((sh.steps || 6) * k));
  /* a blended shape: a finer grid (at most twice as fine: a portrait's grid is already a few hundred thousand points) */
  if (sh.kind === 'sdf') o.h = sh.h / Math.min(2.2, Math.max(0.5, k));
  return o;
}

/** the parts a pose moves (figurePose): the root, and these; every other part only rides its parent */
export const FIGURE_JOINTED = /^(torso|head|body|(thigh|shin|foot|arm|forearm)[AB]|leg(FL|FR|BL|BR))$/;
/**
 * the figure's mesh as the baker draws it (CH-3b: a figure of 50 parts and more, its locks, buttons and goggles, ran
 * past the shader's 32 joint matrices): a matrix only for each part a pose moves (FIGURE_JOINTED, and the root), every
 * other part's vertices carried by its own place (its `at` and its parents' up to the first moving one) and drawn on
 * that one's matrix. `slots`: the part each matrix is (jointMatrices' index), in the order the vertices name them.
 * CH-4: `M`, the figure's mesh already built at this detail (figureMesh), is taken as it is (its data rewritten), so
 * one build serves the figure's extent (figure-kit.js kitBuild) and its GPU mesh.
 * @param {Figure} F @param {number} [detail] @param {{ data: Float32Array, count: number, colours: string[] }} [M0]
 * @returns {{ data: Float32Array, count: number, colours: string[], slots: number[] }}
 */
export function figureGpuMesh(F, detail = 1, M0) {
  const M = M0 || figureMesh(F, detail),
    jointOf = F.parts.map(() => -1),
    off = F.parts.map(() => /** @type {Vec3} */ ([0, 0, 0])),
    /** @type {number[]} */ slots = [];
  F.parts.forEach((p, i) => {
    if (p.parent < 0 || FIGURE_JOINTED.test(p.id)) {
      jointOf[i] = slots.length;
      slots.push(i);
    } else {
      jointOf[i] = jointOf[p.parent];
      const o = off[p.parent];
      off[i] = [o[0] + p.at[0], o[1] + p.at[1], o[2] + p.at[2]];
    }
  });
  const d = M.data;
  for (let v = 0; v < M.count; v++) {
    const k = v * 8,
      i = d[k + 6],
      o = off[i];
    d[k] += o[0];
    d[k + 1] += o[1];
    d[k + 2] += o[2];
    d[k + 6] = jointOf[i];
  }
  return { ...M, slots };
}

/* ---------- the face ---------- */
/**
 * CH-6: a kit figure's face state: the expression's (faces.expressions; `idle` when it has none of that name) eyes,
 * brows, mouth and blush; a blink (1 half shut, 2 shut) over open eyes; talking (`talk`, a count) runs through the
 * expression's talking frames; `mouth` and `eyes` name a frame outright (the Studio); null for a figure with no face set (Kappi,
 * the mannequin)
 * @param {Figure} F @param {{ expr?: string | null, blink?: number, talk?: number | null, mouth?: string,
 *   eyes?: string }} [o]
 * @returns {FaceState | null}
 */
export function figureFaceState(F, o = {}) {
  const FS = F.faceSet;
  if (!FS) return null;
  const xid = o.expr && FS.expr[o.expr] ? o.expr : 'idle',
    X = FS.expr[xid] || { eyes: 'open', mouth: null, blush: false },
    /* a blink closes open eyes (half, then shut); happy and shut ones stay as they are */
    eye0 = o.eyes || X.eyes,
    eyes = o.blink && eye0 !== 'happy' && eye0 !== 'closed' ? (o.blink > 1 ? 'closed' : 'half') : eye0,
    talk = X.talk || FS.talk,
    mouth = o.mouth
      ? o.mouth
      : o.talk != null && o.talk >= 0 && talk.length
        ? talk[o.talk % talk.length]
        : X.mouth || FS.mouth,
    when = new Set(['eyes:' + eyes, 'mouth:' + mouth, 'brows:' + xid]);
  if (X.blush) when.add('blush');
  const rest = xid === 'idle' && eyes === (FS.expr.idle ? FS.expr.idle.eyes : 'open') && mouth === FS.mouth;
  return { when, key: rest ? '' : `${xid}.${eyes}.${mouth}` };
}
/**
 * the face marks to paint on a baked picture, in its pixels (x, y from the top left, w by h): each mark where its part
 * holds it this pose, seen in view V, if it faces the camera enough (eyes most, the mouth least); an eye seen from the
 * side is a pixel wide; a closed eye (`blink`) a line; an open eye 2 pixels or wider and 3 or taller gets a glint at
 * its top left, toward the light. CH-6: a kit figure's marks in face state `face` (figureFaceState; its rest when not
 * given, a pose's blink closing its eyes)
 * @param {Figure} F @param {Float32Array} J the pose's joint matrices (jointMatrices) @param {FigurePose} P
 * @param {{ rel: number, tilt: number }} V @param {number} ppm @param {{ ax: number, ay: number }} S
 * @param {FaceState | null} [face]
 * @returns {{ x: number, y: number, w: number, h: number, rgb: Vec3, kind: string, hollow?: boolean }[]}
 */
export function figureFaceMarks(F, J, P, V, ppm, S, face = null) {
  const tagged = !!F.faceSet,
    FS = tagged ? face || figureFaceState(F, { blink: P.blink ? 2 : 0 }) : null,
    blink = !tagged && P.blink;
  /** @type {{ x: number, y: number, w: number, h: number, rgb: Vec3, kind: string, hollow?: boolean, shape?: string,
   *   dir?: number, t?: number, d?: number }[]} */
  const out = [];
  const c = Math.cos(V.rel),
    s = Math.sin(V.rel),
    ct = Math.cos(V.tilt),
    st = Math.sin(V.tilt);
  for (const m of F.face || []) {
    const i = F.parts.findIndex(p => p.id === m.part);
    if (i < 0) continue;
    const M = J.subarray(i * 16, i * 16 + 16),
      at = /** @type {Vec3} */ (
        [0, 1, 2].map(r => M[r] * m.at[0] + M[4 + r] * m.at[1] + M[8 + r] * m.at[2] + M[12 + r])
      ),
      n = [0, 1, 2].map(r => M[r] * m.n[0] + M[4 + r] * m.n[1] + M[8 + r] * m.n[2]),
      /* the normal in the camera's frame, and how much it faces the camera (which looks along (0, -sin, cos)) */
      nx = n[0] * c + n[2] * s,
      nz = -n[0] * s + n[2] * c,
      facing = -(n[1] * -st + nz * ct) / (Math.hypot(nx, n[1], nz) || 1);
    /* the camera looks down, so a face's lower half faces it less: the eyes show the longest, the mouth the least */
    if (facing < (m.min ?? (m.kind === 'eye' ? 0.15 : m.kind === 'mouth' ? 0.25 : 0.2))) continue;
    if (m.close && ppm < 90) continue;
    /* an iris is on an open eye, and so is anything `shut` (an eye's shines) */
    if ((m.kind === 'iris' || m.shut) && blink) continue;
    if (m.when && !(FS && FS.when.has(m.when))) continue;
    let w = Math.max(1, Math.round(m.w * ppm)),
      h = Math.max(1, Math.round(m.h * ppm));
    if ((m.kind === 'eye' || m.narrow) && facing < 0.6) w = 1;
    /* a closed eye is a line, a pixel thick at walking size and thicker in a close-up (a portrait) */
    if (m.kind === 'eye' && blink) h = Math.max(1, Math.round(0.022 * ppm));
    /* CH-6: its depth as a picture's pass 1 keeps it (the alpha: nearer larger; figureClipMatrix's depth), so a
       painter can leave out the pixels something nearer covers (a brim, a hand) */
    const zc = (-s * ct * at[0] - st * at[1] + c * ct * at[2]) / 2.5,
      d = 1 - 0.92 * (zc * 0.5 + 0.5);
    const q = cardPoint(at, V.rel, V.tilt),
      x = Math.round(S.ax + q.u * ppm - w / 2),
      y = Math.round(S.ay - q.v * ppm - h / 2);
    const rgb = F.colours[m.col || m.kind] || [OUTLINE_RGB[0], OUTLINE_RGB[1], OUTLINE_RGB[2]];
    /** @type {{ x: number, y: number, w: number, h: number, rgb: Vec3, kind: string, hollow?: boolean, shape?: string,
     *   dir?: number, t?: number, d?: number }} */
    const o = { x, y, w, h, rgb, kind: m.kind, d };
    if (m.hollow) o.hollow = true;
    /* CH-3b: an oval (an eye, a pupil, a shine) or a smile's arc, painted as such once it is 3 pixels or more (a
       portrait's close-up); smaller, a block */
    if (m.shape && w >= 3 && h >= 3 && !(m.kind === 'eye' && blink)) {
      o.shape = m.shape;
      /* CH-6: a rim (a brow's cap) as thick as its own `t` */
      if (m.t && m.shape !== 'oval') o.t = Math.max(1, Math.round(m.t * ppm));
    }
    /* a slant (a brow, a lash's flick) keeps its way down, mirrored when the figure is seen from behind its side */
    if (m.shape === 'slant' && w >= 2) {
      o.shape = 'slant';
      o.dir = m.dir || 1;
      o.t = Math.max(1, Math.round((m.t || 0.02) * ppm));
    }
    out.push(o);
    if (m.kind === 'eye' && !blink && w >= 2 && h >= 3 && m.glint !== false)
      out.push({ x, y, w: 1, h: 1, rgb: F.colours.glint || [255, 255, 255], kind: 'glint', d });
  }
  return out;
}

/* ---------- the view ---------- */
/**
 * the stepped view of a figure: its heading as the camera sees it (heading less the camera's turn) to the nearest of
 * `steps` around, and the camera's tilt to the nearest TILT_STEP. `k` is the step (0: facing into the view, its back
 * to the camera).
 * @param {number} heading the figure's heading in the world (logic/person-view.js personHeading)
 * @param {number} yaw the camera's turn (walk-view.js seenYaw) @param {number} tilt the camera's tilt (radians)
 * @param {number} steps @returns {{ k: number, rel: number, tilt: number, tiltStep: number }}
 */
export function figureView(heading, yaw, tilt, steps) {
  const n = Math.max(1, Math.round(steps) || 1),
    step = (2 * Math.PI) / n,
    k = (((Math.round((heading - yaw) / step) % n) + n) % n) | 0,
    ts = Math.round(Math.max(0, Math.min(Math.PI / 2 - 0.05, tilt)) / TILT_STEP);
  return { k, rel: k * step, tilt: ts * TILT_STEP, tiltStep: ts };
}
/**
 * where a point of the figure lands on its card: `u` across (metres, the camera's right), `v` up the card (metres
 * from the ground point), `depth` along the camera's view (metres, farther larger). The figure is turned `rel` in the
 * camera's frame (0: facing into the view).
 * @param {number[]} p a point in the figure's space @param {number} rel @param {number} tilt
 * @returns {{ u: number, v: number, depth: number }}
 */
export function cardPoint(p, rel, tilt) {
  const c = Math.cos(rel),
    s = Math.sin(rel),
    x = p[0] * c + p[2] * s,
    z = -p[0] * s + p[2] * c;
  return { u: x, v: p[1] + z * Math.tan(tilt), depth: z * Math.cos(tilt) - p[1] * Math.sin(tilt) };
}
/** @typedef {{ r: number, depth: number, top: number, bottom: number }} FigureExtent the room every pose of a figure
 * takes, metres: its reach round its upright axis (r), how far it reaches toward or away from the camera (depth: what
 * the tilt lifts or drops on the card), its top and its bottom */
/**
 * the room a code figure of this height takes: wide enough for a swinging limb seen side-on (0.62 m), 0.4 m deep
 * @param {number} height @returns {FigureExtent}
 */
export function codeExtent(height = 1.75) {
  return { r: 0.62, depth: 0.4, top: height + 0.06, bottom: -0.06 };
}
/**
 * the bake's picture for a view: its size in pixels and its anchor (the ground point under the figure), with a margin
 * of 2 pixels for the outline: as wide as the figure's reach, tall enough for its top lifted by the tilt and for its
 * feet nearer the camera dropped below the ground point
 * @param {number} ppm @param {number} tilt @param {number | FigureExtent} [ext] an extent, or a code figure's height
 * @returns {{ w: number, h: number, ax: number, ay: number }}
 */
export function cardSize(ppm, tilt, ext = 1.75) {
  const E = typeof ext === 'number' ? codeExtent(ext) : ext,
    tn = Math.tan(tilt),
    half = Math.ceil(E.r * ppm),
    top = Math.ceil((E.top + E.depth * tn) * ppm),
    bottom = Math.ceil((E.depth * tn - E.bottom) * ppm);
  return { w: half * 2 + 4, h: top + bottom + 4, ax: half + 2, ay: top + 2 };
}
/**
 * the matrix from the figure's space to the bake's clip space (column-major): the turn `rel`, the oblique card, the
 * card's pixels (x to the right, y up the card, the anchor at (ax, ay) from the top left) and the depth along the view
 * in -1..1 over ±2.5 m, nearer smaller
 * @param {number} rel @param {number} tilt @param {number} ppm @param {{ w: number, h: number, ax: number, ay: number }} S
 * @returns {Float32Array}
 */
export function figureClipMatrix(rel, tilt, ppm, S) {
  const c = Math.cos(rel),
    s = Math.sin(rel),
    tn = Math.tan(tilt),
    ct = Math.cos(tilt),
    st = Math.sin(tilt),
    kx = (2 * ppm) / S.w,
    ky = (2 * ppm) / S.h,
    ox = (2 * S.ax) / S.w - 1,
    oy = 1 - (2 * S.ay) / S.h,
    kz = 1 / 2.5;
  /* u = x c + z s; v = y + (-x s + z c) tn; depth = (-x s + z c) ct - y st */
  return new Float32Array([
    kx * c,
    ky * -s * tn,
    kz * -s * ct,
    0,
    0,
    ky,
    kz * -st,
    0,
    kx * s,
    ky * c * tn,
    kz * c * ct,
    0,
    ox,
    oy,
    0,
    1,
  ]);
}

/* ---------- the clock ---------- */
/**
 * the frame of a clip at time `t` (ms) and distance walked `gait` (m), on the 12 fps clock: the idle steps every two
 * ticks; the walk is the distance walked by the last tick, WALK_CYCLE_M a cycle
 * @param {string} clip @param {number} t @param {number} [gait] @returns {number}
 */
export function clipFrameAt(clip, t, gait = 0) {
  const n = CLIP_FRAMES[/** @type {keyof typeof CLIP_FRAMES} */ (clip)] || 1;
  if (clip === 'walk') return ((Math.floor((gait / WALK_CYCLE_M) * n) % n) + n) % n;
  const tick = Math.floor(t / (1000 / FIGURE_FPS));
  /* a cheer or a throw on ones, the idle (and the sit) on twos */
  return ((Math.floor(clip === 'cheer' || clip === 'throw' ? tick : tick / 2) % n) + n) % n;
}
/**
 * CH-4: density by distance: the share of the density dial a person is drawn at, by how far they stand from the camera
 * against how far its target is (`k`: the target's distance over theirs; 1 or more at the target or nearer): 1 near, 3/4
 * past about 1.25 times the target's distance, 1/2 past about 1.8 times. Shrunk on screen by the perspective as much,
 * they keep at least the pixels a screen pixel the near ones have. `prev` (the step they had) holds within 0.05 of an
 * edge, so a person walking along one doesn't flicker between steps.
 * @param {number} k @param {number} [prev] @returns {number}
 */
export function figureDensityStep(k, prev = 1) {
  const edges = [
      [0.8, 1, 0.75],
      [0.55, 0.75, 0.5],
    ],
    m = 0.05;
  let s = 1;
  for (const [e, hi, lo] of edges) if (k < e + (prev <= lo ? m : prev >= hi ? -m : 0)) s = lo;
  return s;
}
/** the tick a time falls in on the 12 fps clock @param {number} t ms */
/**
 * CH-6: how much nearer (in a picture's depth alpha) something must be than a face mark to hide it: about 4 cm, past
 * the head's own mesh against the smooth surface the mark sits on and the 8-bit depth (about 2 cm a step), so a brim,
 * a hat's crown or a hand in front hides the eyes and mouth and the face itself doesn't
 */
export const FIGURE_MARK_HIDE = (0.92 * 0.5 * 0.04) / 2.5;
/** CH-6: whether a mark of depth `d` is hidden where the picture's depth alpha is `a` (0: nothing there)
 * @param {number} a @param {number | undefined} d */
export function figureMarkHidden(a, d) {
  return d != null && a > d + FIGURE_MARK_HIDE;
}
/** CH-6: how often a talking mouth changes (ms; the portrait kit's about 8 a second) */
export const FIGURE_TALK_MS = 125;
/**
 * CH-6: the face a speaker shows for a dialogue line (talk.js talkBox): the line's expression (its [tag]) and, while
 * its text is typing, a talking frame every FIGURE_TALK_MS; the mouth rests on punctuation (the kit's pause) and
 * under Reduced motion
 * @param {{ expr?: string | null, text?: string, n?: number, typing?: boolean, t: number, reduced?: boolean }} o
 * @returns {{ expr: string | null, talk?: number }}
 */
export function figureTalkFace(o) {
  const out = { expr: o.expr || null };
  if (!o.typing || o.reduced) return out;
  const ch = (o.text || '').charAt(Math.max(0, (o.n || 0) - 1));
  if (/[.,!?;:\u2026\u2014-]/.test(ch)) return out;
  return { ...out, talk: Math.floor(o.t / FIGURE_TALK_MS) };
}
/**
 * CH-6: a person's blink at time `t` (ms), on the portrait kit's timing: one every 2.6 to 5.2 seconds (the gap set by
 * the person's seed and varied each time), half shut, shut, half shut over 200 ms; 0 open, 1 half, 2 shut
 * @param {number} t @param {number} seed @returns {number}
 */
export function figureBlinkAt(t, seed) {
  const gap = 2600 + (seed % 2600),
    u = t + (seed % 9973),
    n = Math.floor(u / gap),
    /* where in this gap the blink falls, by the gap's number */
    j = (Math.abs(Math.sin(n * 12.9898 + (seed % 997) * 0.731) * 43758.5453) % 1) * (gap - 200),
    o = u - n * gap - j;
  return o < 0 || o >= 200 ? 0 : o < 50 || o >= 150 ? 1 : 2;
}
export function figureTick(t) {
  return Math.floor(t / (1000 / FIGURE_FPS));
}
/**
 * the key a baked picture is kept by: the figure, clip and frame, the view's steps, the density, the outline and the
 * style (pixel, or smooth: the plain 3D figure)
 * @param {string} name @param {string} clip @param {number} frame @param {{ k: number, tiltStep: number }} V
 * @param {number} steps @param {number} ppm @param {boolean} outline @param {string} [style]
 */
export function figureKey(name, clip, frame, V, steps, ppm, outline, style = 'pixel') {
  return `${name}|${clip}|${frame}|${V.k}/${steps}|${V.tiltStep}|${ppm}|${outline ? 1 : 0}|${style}`;
}

/* ---------- figures made from a model (tools/gltf-figure.mjs) ---------- */
/** @typedef {{ fps: number, frames: number, lift: number[], cycleM?: number, mats: Float32Array }} MeshClip a clip
 * of a figure made from a model: for each frame and joint a 3 x 4 matrix (12 numbers, column by column) from where a
 * vertex is modelled to where the clip has it, and the hips' height over their rest */
/**
 * a mesh clip's frame at time `t` (ms) and distance walked `gait` (m), on the 12 fps clock. A walk or a run (a clip
 * with a stride) goes by the distance: a cycle is its own stride or what it covers at `speed` (m/s) at its own
 * cadence, the longer (a short stride at the game's speed would race through its frames; its feet slide instead).
 * Anything else goes by time, each frame held 12 / fps ticks (a clip at 6 fps is "on twos").
 * @param {MeshClip} c @param {number} t @param {number} gait @param {number} speed @returns {number}
 */
export function meshClipFrame(c, t, gait, speed) {
  const n = Math.max(1, c.frames);
  if (c.cycleM) {
    const cycle = Math.max(c.cycleM, (speed * n) / c.fps);
    return ((Math.floor((gait / cycle) * n) % n) + n) % n;
  }
  const hold = Math.max(1, Math.round(FIGURE_FPS / (c.fps || FIGURE_FPS)));
  return ((Math.floor(figureTick(t) / hold) % n) + n) % n;
}
/**
 * a mesh clip's joint matrices at a frame (16 numbers each, as jointMatrices gives a code figure's), the whole figure
 * moved so the hips' lift is snapped to whole texels (1 / ppm)
 * @param {MeshClip} c @param {number} frame @param {number} joints @param {number} ppm @returns {Float32Array}
 */
export function meshClipMatrices(c, frame, joints, ppm) {
  const f = ((Math.floor(frame) % c.frames) + c.frames) % c.frames,
    lift = c.lift[f] || 0,
    dy = ppm > 0 ? Math.round(lift * ppm) / ppm - lift : 0,
    out = new Float32Array(joints * 16);
  for (let j = 0; j < joints; j++) {
    const m = c.mats.subarray((f * joints + j) * 12, (f * joints + j) * 12 + 12);
    out.set([m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, m[9], m[10] + dy, m[11], 1], j * 16);
  }
  return out;
}
