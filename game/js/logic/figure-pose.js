// @ts-check
'use strict';
/* ================= A FIGURE'S PARTS, POSES AND VIEW (characters track CH-2, the spike) =================
   The maths of the figure baker (game/js/figures.js draws with it): a figure is jointed rigid parts (the Studio's rule:
   "spinning and jointed parts; no skinning"), each vertex on one joint.
   - The mannequin: a person built in code from boxes, 1.75 m tall at about 2.75 heads (the track's proportions), with
     big hands and shoes and two eyes. Its own axes: y up, facing +z (a heading of 0, logic/person-view.js), x across.
   - Poses: an idle (breathing, a blink) and an 8-frame walk, each frame a rotation (and a small lift) per part. A pose
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
  figureBox: [() => figureBox],
  // @ts-expect-error -- replaced on purpose
  figureClipMatrix: [() => figureClipMatrix, v => (figureClipMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  figureDark: [() => figureDark, v => (figureDark = v)],
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
  jointMatrices: [() => jointMatrices, v => (jointMatrices = v)],
  // @ts-expect-error -- replaced on purpose
  mannequinFigure: [() => mannequinFigure, v => (mannequinFigure = v)],
  // @ts-expect-error -- replaced on purpose
  mat4Mul: [() => mat4Mul, v => (mat4Mul = v)],
  // @ts-expect-error -- replaced on purpose
  outlineOf: [() => outlineOf, v => (outlineOf = v)],
  // @ts-expect-error -- replaced on purpose
  partMatrix: [() => partMatrix, v => (partMatrix = v)],
  // @ts-expect-error -- replaced on purpose
  restPose: [() => restPose, v => (restPose = v)],
  // @ts-expect-error -- replaced on purpose
  toonBand: [() => toonBand, v => (toonBand = v)],
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
/** @typedef {{ id: string, parent: number, at: Vec3, box: [number, number, number, number, number, number], col: string }} FigurePart
 * a part: its joint at `at` from its parent's joint (rest pose, metres), its box from its own joint, its colour */
/** @typedef {{ name: string, height: number, parts: FigurePart[], colours: Record<string, Vec3> }} Figure */
/** @typedef {{ rot: Vec3[], lift: Vec3[], scale: Vec3[], rootY: number }} FigurePose per part (in parts order) */

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
/** a box from its sides: x from -w to w, y from y0 to y1, z from z0 to z1 @returns {[number, number, number, number, number, number]} */
export const figureBox = (
  /** @type {number} */ w,
  /** @type {number} */ y0,
  /** @type {number} */ y1,
  /** @type {number} */ z0,
  /** @type {number} */ z1
) => [-w, y0, z0, w, y1, z1];
/**
 * the spike's mannequin: 1.75 m, the head 0.64 m (2.75 heads), legs 0.5 m, big hands and shoes. Parts in order, a
 * parent before its children; the eyes and the hair sit on the head's joint.
 * @returns {Figure}
 */
export function mannequinFigure() {
  /** @type {FigurePart[]} */
  const parts = [];
  /** @param {string} id @param {string | null} parent @param {Vec3} at @param {FigurePart['box']} box @param {string} col */
  const add = (id, parent, at, box, col) => {
    parts.push({ id, parent: parent == null ? -1 : parts.findIndex(p => p.id === parent), at, box, col });
  };
  add('hips', null, [0, 0.5, 0], figureBox(0.15, -0.06, 0.1, -0.1, 0.1), 'pants');
  add('torso', 'hips', [0, 0.1, 0], figureBox(0.16, 0, 0.42, -0.1, 0.11), 'shirt');
  add('head', 'torso', [0, 0.44, 0], [-0.29, 0, -0.26, 0.29, 0.62, 0.27], 'skin');
  add('hair', 'head', [0, 0, 0], [-0.31, 0.4, -0.29, 0.31, 0.7, 0.2], 'hair');
  add('fringe', 'head', [0, 0, 0], [-0.31, 0.5, 0.2, 0.31, 0.7, 0.3], 'hair');
  for (const s of [1, -1]) {
    const k = s > 0 ? 'A' : 'B';
    add('eye' + k, 'head', [s * 0.12, 0.22, 0.27], figureBox(0.04, 0, 0.13, 0, 0.012), 'eye');
    add('glint' + k, 'head', [s * 0.12 - 0.02, 0.29, 0.282], figureBox(0.016, 0, 0.032, 0, 0.004), 'glint');
    add('thigh' + k, 'hips', [s * 0.085, 0, 0], figureBox(0.07, -0.25, 0, -0.07, 0.07), 'pants');
    add('shin' + k, 'thigh' + k, [0, -0.25, 0], figureBox(0.065, -0.2, 0, -0.065, 0.065), 'pants');
    add('foot' + k, 'shin' + k, [0, -0.2, 0], figureBox(0.08, -0.05, 0.02, -0.07, 0.15), 'shoe');
    add('arm' + k, 'torso', [s * 0.215, 0.38, 0], figureBox(0.055, -0.21, 0.02, -0.055, 0.055), 'shirt');
    add('forearm' + k, 'arm' + k, [0, -0.21, 0], figureBox(0.05, -0.17, 0, -0.05, 0.05), 'skin');
    add('hand' + k, 'forearm' + k, [0, -0.17, 0], figureBox(0.07, -0.12, 0, -0.06, 0.07), 'skin');
  }
  return {
    name: 'mannequin',
    height: 1.75,
    parts,
    colours: {
      skin: [248, 214, 178],
      hair: [132, 84, 60],
      shirt: [46, 164, 160],
      pants: [70, 84, 112],
      shoe: [178, 118, 72],
      eye: [36, 25, 54],
      glint: [234, 238, 236],
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
 * - idle (16 frames, two ticks each: 2.7 s): the chest and head rise a little for half the breath, the arms ease out;
 *   a blink on frame 14.
 * - walk (8 frames): the legs swing 0.55 rad, the knee of the leg coming forward bends, the feet stay level, the arms
 *   swing against the legs with the elbows a little bent, the body twists and drops as the legs part.
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
    P.rootY = -0.5 * (1 - Math.cos(swing * s));
  } else {
    const up = f >= 4 && f < 12 ? 1 : 0;
    P.lift[at('torso')][1] = up * 0.02;
    for (const [k, sg] of /** @type {[string, number][]} */ ([
      ['A', 1],
      ['B', -1],
    ])) {
      P.rot[at('arm' + k)][2] = sg * (0.06 + up * 0.03);
      rx('forearm' + k, -0.12);
    }
    if (f === 14)
      for (const k of ['eyeA', 'eyeB', 'glintA', 'glintB']) P.scale[at(k)][1] = k.startsWith('eye') ? 0.25 : 0;
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
/**
 * the figure's boxes as triangles, each vertex with its part (one joint) and colour: 8 numbers a vertex (x, y, z, the
 * face's normal, the part, the colour's place in `colours`)
 * @param {Figure} F @returns {{ data: Float32Array, count: number, colours: string[] }}
 */
export function figureMesh(F) {
  const colours = Object.keys(F.colours),
    /** @type {number[]} */ v = [];
  /* each face: its normal and its four corners as (x, y, z) picks from the box's low (0) and high (1) sides, wound
     counter-clockwise seen from outside */
  const FACES = /** @type {[Vec3, number[][]][]} */ ([
    [
      [1, 0, 0],
      [
        [1, 0, 1],
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
    [
      [0, 1, 0],
      [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
    [
      [0, -1, 0],
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1],
      ],
    ],
    [
      [0, 0, 1],
      [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
    ],
    [
      [0, 0, -1],
      [
        [1, 0, 0],
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
  ]);
  F.parts.forEach((p, j) => {
    const b = p.box,
      ci = Math.max(0, colours.indexOf(p.col));
    for (const [n, q] of FACES) {
      const pt = (/** @type {number[]} */ c) => [c[0] ? b[3] : b[0], c[1] ? b[4] : b[1], c[2] ? b[5] : b[2]];
      for (const k of [0, 1, 2, 0, 2, 3]) v.push(...pt(q[k]), ...n, j, ci);
    }
  });
  return { data: new Float32Array(v), count: v.length / 8, colours };
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
/**
 * the bake's picture for a view: its size in pixels and its anchor (the ground point under the figure), with a margin
 * of 2 pixels for the outline. Wide enough for a swinging limb seen side-on, tall enough for the head lifted by the
 * tilt and for the feet nearer the camera dropped below the ground point.
 * @param {number} ppm @param {number} tilt @param {number} [height]
 * @returns {{ w: number, h: number, ax: number, ay: number }}
 */
export function cardSize(ppm, tilt, height = 1.75) {
  const tn = Math.tan(tilt),
    half = Math.ceil(0.62 * ppm),
    top = Math.ceil((height + 0.06 + 0.4 * tn) * ppm),
    bottom = Math.ceil(0.4 * tn * ppm + 0.06 * ppm);
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
 * the key a baked picture is kept by: the figure, clip and frame, the view's steps, the density and the outline
 * @param {string} name @param {string} clip @param {number} frame @param {{ k: number, tiltStep: number }} V
 * @param {number} steps @param {number} ppm @param {boolean} outline
 */
export function figureKey(name, clip, frame, V, steps, ppm, outline) {
  return `${name}|${clip}|${frame}|${V.k}/${steps}|${V.tiltStep}|${ppm}|${outline ? 1 : 0}`;
}
