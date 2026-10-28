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
  FIGURE_LIGHT: [() => FIGURE_LIGHT],
  OUTLINE_RGB: [() => OUTLINE_RGB],
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
  figureClipMatrix: [() => figureClipMatrix, v => (figureClipMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  figureDark: [() => figureDark, v => (figureDark = v)],
  // @ts-expect-error -- replaced on purpose
  figureFaceMarks: [() => figureFaceMarks, v => (figureFaceMarks = v)],
  // @ts-expect-error -- replaced on purpose
  figureKey: [() => figureKey, v => (figureKey = v)],
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
  figureTick: [() => figureTick, v => (figureTick = v)],
  // @ts-expect-error -- replaced on purpose
  figureUnit: [() => figureUnit, v => (figureUnit = v)],
  // @ts-expect-error -- replaced on purpose
  figureView: [() => figureView, v => (figureView = v)],
  // @ts-expect-error -- replaced on purpose
  frontOf: [() => frontOf, v => (frontOf = v)],
  // @ts-expect-error -- replaced on purpose
  hairCutAt: [() => hairCutAt, v => (hairCutAt = v)],
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
  restPose: [() => restPose, v => (restPose = v)],
  // @ts-expect-error -- replaced on purpose
  ringSurface: [() => ringSurface, v => (ringSurface = v)],
  // @ts-expect-error -- replaced on purpose
  shapeSurface: [() => shapeSurface, v => (shapeSurface = v)],
  // @ts-expect-error -- replaced on purpose
  shapeTriangles: [() => shapeTriangles, v => (shapeTriangles = v)],
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
export const CLIP_FRAMES = Object.freeze({ idle: 16, walk: 8 });
/** the clock poses step on (frames a second) */
export const FIGURE_FPS = 12;
/** the tilt is stepped by this much (radians: 2 degrees), so zooming between stops bakes a few views, not hundreds */
export const TILT_STEP = Math.PI / 90;
/** the dark plum outline of the props and battle props (tools/build-scene-props.py OL) */
export const OUTLINE_RGB = Object.freeze([36, 25, 54]);
/** the top-left light in the camera's frame (x to the screen's right, y up, z into the view): from the upper left
 * and a little from the viewer, as the props are painted */
export const FIGURE_LIGHT = Object.freeze(figureUnit([-0.55, 0.7, -0.45]));
/** where the toon bands split, on the light's dot with a face's normal: above LIGHT the light band, above BASE the base */
export const FIGURE_BANDS = Object.freeze({ light: 0.5, base: -0.1 });

/** @typedef {[number, number, number]} Vec3 */
/** @typedef {{ front: number, side: number, back: number, bangs?: number, depth?: number }} HairCut where a hair cap
 * ends, as a height on its own sphere (-1 the bottom, 1 the top) at the front, the sides and the back, its fringe in
 * `bangs` points `depth` deep */
/** @typedef {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg?: number, rings?: number, cut?: HairCut }
 *   | { kind: 'lathe', c: Vec3, y: number[], rx: number[], rz: number[], seg?: number }
 *   | { kind: 'capsule', a: Vec3, b: Vec3, r0: number, r1: number, seg?: number }
 *   | { kind: 'cone', a: Vec3, b: Vec3, r: number, seg?: number }
 *   | { kind: 'torus', c: Vec3, R: [number, number], r: number, seg?: number, rings?: number }} FigureShape
 * a part's shape, in its joint's space: an ellipsoid (centre, radii; a hair cap is one with a cut), a lathe (rings
 * round an upright axis through c at heights y, radii rx across and rz front to back; a radius of 0 closes it), a
 * capsule from a to b (radii r0 and r1), a cone from its base a to its tip b, or a torus round an upright axis */
/** @typedef {{ id: string, parent: number, at: Vec3, shape: FigureShape, col: string }} FigurePart
 * a part: its joint at `at` from its parent's joint (rest pose, metres), its shape and its colour */
/** @typedef {{ part: string, kind: 'eye' | 'mouth' | 'blush', at: Vec3, n: Vec3, w: number, h: number }} FaceMark
 * a mark painted on the picture in whole pixels: on part `part` at `at`, facing `n`, w by h metres */
/** @typedef {{ name: string, height: number, parts: FigurePart[], colours: Record<string, Vec3>, face?: FaceMark[] }} Figure */
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
 * @param {{ c: Vec3, r: Vec3 }} E @param {number} x @param {number} y @returns {{ at: Vec3, n: Vec3 }}
 */
export function frontOf(E, x, y) {
  const { c, r } = E,
    u = (x - c[0]) / r[0],
    v = (y - c[1]) / r[1],
    w = Math.sqrt(Math.max(0, 1 - u * u - v * v)),
    z = c[2] + r[2] * w;
  return { at: [x, y, z], n: figureUnit([u / r[0], v / r[1], w / r[2]]) };
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
 * a clip's pose at one of its frames. A swing forward is toward the figure's +z.
 * - idle (16 frames, two ticks each: 2.7 s): the chest and head rise a little for half the breath, the arms ease out,
 *   the head nods and leans; a blink on frame 14.
 * - walk (8 frames): the legs swing 0.55 rad, the knee of the leg coming forward bends, the feet stay level, the arms
 *   swing against the legs with the elbows a little bent, the body twists and drops as the legs part and bounces as
 *   they pass, the head rocks.
 * @param {Figure} F @param {string} clip @param {number} frame @returns {FigurePose}
 */
export function figurePose(F, clip, frame) {
  const P = restPose(F),
    at = (/** @type {string} */ id) => F.parts.findIndex(p => p.id === id),
    rx = (/** @type {string} */ id, /** @type {number} */ a) => {
      const i = at(id);
      if (i >= 0) P.rot[i][0] = a;
    };
  const n = CLIP_FRAMES[/** @type {keyof typeof CLIP_FRAMES} */ (clip)] || 1,
    f = ((Math.floor(frame) % n) + n) % n;
  if (clip === 'walk') {
    const a = (2 * Math.PI * f) / n,
      s = Math.sin(a),
      c = Math.cos(a),
      swing = 0.55;
    /* a forward swing is a turn about x by minus the angle (a turn by +a sends a hanging limb toward -z) */
    for (const [k, sg] of /** @type {[string, number][]} */ ([
      ['A', 1],
      ['B', -1],
    ])) {
      const th = swing * s * sg,
        knee = 0.75 * Math.max(0, c * sg);
      rx('thigh' + k, -th);
      rx('shin' + k, knee);
      rx('foot' + k, th - knee);
      rx('arm' + k, 0.45 * s * sg);
      rx('forearm' + k, -0.3);
    }
    P.rot[at('torso')][1] = 0.12 * s;
    P.rot[at('head')][1] = -0.08 * s;
    P.rot[at('torso')][0] = -0.06;
    /* the body drops as the legs part and bounces up as they pass (a spring in the step) */
    P.rootY = -0.5 * (1 - Math.cos(swing * s)) + 0.02 * (1 - Math.abs(s));
    P.rot[at('head')][2] = 0.03 * s;
  } else {
    const up = f >= 4 && f < 12 ? 1 : 0;
    P.lift[at('torso')][1] = up * 0.02;
    /* a slow nod and a lean of the head with the breath */
    P.rot[at('head')][0] = up ? -0.05 : 0.02;
    P.rot[at('head')][2] = f >= 8 ? 0.05 : -0.03;
    for (const [k, sg] of /** @type {[string, number][]} */ ([
      ['A', 1],
      ['B', -1],
    ])) {
      P.rot[at('arm' + k)][2] = sg * (0.06 + up * 0.03);
      rx('forearm' + k, -0.12);
    }
    if (f === 14) P.blink = true;
  }
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
/**
 * a shape's surface: points, a way out of the shape at each, and triangles
 * @param {FigureShape} sh @returns {{ pts: Vec3[], out: Vec3[], tris: number[][] }}
 */
export function shapeSurface(sh) {
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
      rings = sh.rings || 8;
    for (let i = 0; i <= rings; i++) {
      const ph = (Math.PI * i) / rings,
        sp = Math.sin(ph),
        cp = Math.cos(ph);
      if (i === 0 || i === rings) {
        const p = /** @type {Vec3} */ ([c[0], c[1] + r[1] * cp, c[2]]);
        R.push([p]);
        O.push([[0, cp, 0]]);
      } else
        ring(seg, t => {
          const d = /** @type {Vec3} */ ([sp * Math.sin(t), cp, sp * Math.cos(t)]);
          return [[c[0] + r[0] * d[0], c[1] + r[1] * d[1], c[2] + r[2] * d[2]], d];
        });
    }
    const S = ringSurface(R, O);
    if (sh.cut) {
      const C = sh.cut;
      S.tris = S.tris.filter(tr => {
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
 * smooth normal, the part, the colour's place in `colours`)
 * @param {Figure} F @returns {{ data: Float32Array, count: number, colours: string[] }}
 */
export function figureMesh(F) {
  const colours = Object.keys(F.colours),
    /** @type {number[]} */ v = [];
  F.parts.forEach((p, j) => {
    const ci = Math.max(0, colours.indexOf(p.col));
    for (const tri of shapeTriangles(p.shape)) for (const q of tri) v.push(...q, j, ci);
  });
  return { data: new Float32Array(v), count: v.length / 8, colours };
}

/* ---------- the face ---------- */
/**
 * the face marks to paint on a baked picture, in its pixels (x, y from the top left, w by h): each mark where its part
 * holds it this pose, seen in view V, if it faces the camera enough (eyes most, the mouth least); an eye seen from the
 * side is a pixel wide; a closed eye (`blink`) a line; an open eye 2 pixels or wider and 3 or taller gets a glint at
 * its top left, toward the light
 * @param {Figure} F @param {Float32Array} J the pose's joint matrices (jointMatrices) @param {FigurePose} P
 * @param {{ rel: number, tilt: number }} V @param {number} ppm @param {{ ax: number, ay: number }} S
 * @returns {{ x: number, y: number, w: number, h: number, rgb: Vec3, kind: string }[]}
 */
export function figureFaceMarks(F, J, P, V, ppm, S) {
  /** @type {{ x: number, y: number, w: number, h: number, rgb: Vec3, kind: string }[]} */
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
    if (facing < (m.kind === 'eye' ? 0.15 : m.kind === 'mouth' ? 0.25 : 0.2)) continue;
    let w = Math.max(1, Math.round(m.w * ppm)),
      h = Math.max(1, Math.round(m.h * ppm));
    if (m.kind === 'eye') {
      if (facing < 0.6) w = 1;
      if (P.blink) h = 1;
    }
    const q = cardPoint(at, V.rel, V.tilt),
      x = Math.round(S.ax + q.u * ppm - w / 2),
      y = Math.round(S.ay - q.v * ppm - h / 2);
    out.push({ x, y, w, h, rgb: F.colours[m.kind] || [OUTLINE_RGB[0], OUTLINE_RGB[1], OUTLINE_RGB[2]], kind: m.kind });
    if (m.kind === 'eye' && !P.blink && w >= 2 && h >= 3)
      out.push({ x, y, w: 1, h: 1, rgb: F.colours.glint || [255, 255, 255], kind: 'glint' });
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
  return ((Math.floor(tick / 2) % n) + n) % n;
}
/** the tick a time falls in on the 12 fps clock @param {number} t ms */
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
