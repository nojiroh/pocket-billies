// @ts-check
'use strict';
/* ================= THE FIGURE KIT (characters track CH-3b) =================
   A person's figure built from their look (the wardrobe's: body sliders, hair, face, clothes; people/<id>.json or a
   townsperson's seed), out of the simple rounded shapes of logic/figure-pose.js, so nobody is modelled by hand and
   every NPC and the player come out of one kit. The owner's brief (2026-10-28): "I like the simpler shapes but you can
   give it more detail and variety. They can have more personality and less mannequin feeling. So different head
   shapes, heights and body types."
   - Shape: a head shape (FIGURE_HEADS) and a build (FIGURE_BUILDS) chosen in people/<id>.json `figure`, else from the
     look's sliders and the person's seed. The look's sliders are exaggerated (FIGURE_SLIDER_GAIN) because the
     wardrobe's are drawn for small changes on a flat sprite.
   - Gait: each build moves its own way (logic/figure-pose.js figurePose `gait`), and a person's `figure.gait` can
     say more.
   - Clothes: every wardrobe slot has a shape: hair (10 styles), hats (8), tops by sleeve, jackets and long coats,
     aprons, skirts and shorts, shoes, neckwear, bags; glasses, brows, lashes, a stache, stubble and freckles are face
     marks painted in whole pixels.
   - Kappi (people/kappi.json `creature`): a capybara on four legs, in round glasses and a name tag.
   Logic only: no DOM, runs in Node (tools/test/figure-kit.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { figureDark, figureMix, frontOf } from './figure-pose.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_BUILDS: [() => FIGURE_BUILDS],
  FIGURE_HEADS: [() => FIGURE_HEADS],
  FIGURE_SLIDER_GAIN: [() => FIGURE_SLIDER_GAIN],
  KIT_INK: [() => KIT_INK],
  KIT_JACKETS: [() => KIT_JACKETS],
  KIT_LONG_COATS: [() => KIT_LONG_COATS],
  KIT_LONG_SLEEVES: [() => KIT_LONG_SLEEVES],
  KIT_SLEEVELESS: [() => KIT_SLEEVELESS],
  // @ts-expect-error -- replaced on purpose
  figureSeed: [() => figureSeed, v => (figureSeed = v)],
  // @ts-expect-error -- replaced on purpose
  figureShapeFor: [() => figureShapeFor, v => (figureShapeFor = v)],
  // @ts-expect-error -- replaced on purpose
  kappiFigure: [() => kappiFigure, v => (kappiFigure = v)],
  // @ts-expect-error -- replaced on purpose
  kitFaceMarks: [() => kitFaceMarks, v => (kitFaceMarks = v)],
  // @ts-expect-error -- replaced on purpose
  kitHair: [() => kitHair, v => (kitHair = v)],
  // @ts-expect-error -- replaced on purpose
  kitHat: [() => kitHat, v => (kitHat = v)],
  // @ts-expect-error -- replaced on purpose
  kitHex: [() => kitHex, v => (kitHex = v)],
  // @ts-expect-error -- replaced on purpose
  kitRnd: [() => kitRnd, v => (kitRnd = v)],
  // @ts-expect-error -- replaced on purpose
  kitTopOf: [() => kitTopOf, v => (kitTopOf = v)],
  // @ts-expect-error -- replaced on purpose
  lookFigure: [() => lookFigure, v => (lookFigure = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {import('./figure-pose.js').Figure} Figure */
/** @typedef {import('./figure-pose.js').FigurePart} FigurePart */
/** @typedef {import('./figure-pose.js').FigureShape} FigureShape */
/** @typedef {import('./figure-pose.js').FaceMark} FaceMark */
/** @typedef {import('./figure-pose.js').FigureGait} FigureGait */
/** @typedef {import('./figure-pose.js').Vec3} Vec3 */
/** @typedef {{ body?: Record<string, number>, skin?: string, hair?: string, eyes?: string,
 *   wear?: Record<string, string | null>, colors?: Record<string, string[]> }} KitLook a cleaned look
 * (person-art.js cleanLook) */
/** @typedef {{ colors?: [string, string][] }} KitItem a wardrobe item (its colours: [name, hex]) */
/** @typedef {{ head?: string, build?: string, gait?: FigureGait }} FigureShapeChoice a person's `figure` */

/** the head shapes: radii as parts of the usual head's, squareness and taper (logic/figure-pose.js ellipsoid) */
export const FIGURE_HEADS = Object.freeze({
  round: { r: [1.04, 1, 1], sq: 0, taper: 0 },
  oval: { r: [0.92, 1.08, 0.96], sq: 0, taper: 0 },
  square: { r: [1, 0.96, 0.98], sq: 0.65, taper: 0 },
  long: { r: [0.86, 1.12, 0.92], sq: 0.3, taper: 0 },
  pear: { r: [1, 1, 0.98], sq: 0.2, taper: 0.22 },
  heart: { r: [1.02, 1.02, 0.98], sq: 0.1, taper: -0.2 },
});
/** the builds: multipliers on the look's (exaggerated) sliders, and how each moves */
export const FIGURE_BUILDS = Object.freeze({
  average: { k: {}, gait: {} },
  slim: { k: { body: 0.8, shoulders: 0.94, hips: 0.94, legs: 1.04 }, gait: { swing: 1.05, bounce: 1.15 } },
  stocky: {
    k: { body: 1.2, shoulders: 1.14, legs: 0.88, height: 0.95 },
    gait: { swing: 0.85, hang: 0.1, lean: 0.03 },
  },
  round: {
    k: { body: 1.42, shoulders: 1.02, hips: 1.1, legs: 0.84, height: 0.94, belly: 1 },
    gait: { swing: 0.72, arms: 0.8, hang: 0.16, bounce: 0.7, lean: -0.03 },
  },
  tall: { k: { height: 1.1, legs: 1.14, body: 0.9, arms: 1.06 }, gait: { swing: 1.12, lean: -0.02 } },
  small: { k: { height: 0.84, legs: 0.86, head: 1.08 }, gait: { swing: 1.15, bounce: 1.7 } },
});
/** how much more a look's slider counts on a figure than on the flat sprite (1 is as the wardrobe draws it) */
export const FIGURE_SLIDER_GAIN = 2;
/** the eye's and the outline's dark (the props' plum) */
export const KIT_INK = /** @type {Vec3} */ ([36, 25, 54]);
export const KIT_SLEEVELESS = new Set(['tank', 'crop']),
  KIT_LONG_SLEEVES = new Set(['longsleeve', 'sweater', 'dress_shirt', 'tunic', 'track_top']),
  KIT_JACKETS = new Set(['blazer', 'denim_jacket', 'track_top', 'puffer']),
  KIT_LONG_COATS = new Set(['labcoat', 'trench']);

/** a string's seed (FNV-1a, 32 bits) @param {string} s */
export function figureSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** a number in 0..1 from a seed and a salt @param {number} seed @param {number} i */
export function kitRnd(seed, i) {
  const x = Math.sin(seed * 0.000123 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
/** '#RRGGBB' (or '#RGB') to [r, g, b] @param {string | undefined} hex @param {Vec3} fb @returns {Vec3} */
export function kitHex(hex, fb) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return [fb[0], fb[1], fb[2]];
  const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * the head shape and build a person's figure has: their `figure` choice where it names one, else the build their
 * sliders lean to (a big body round, broad and big stocky, tall tall, thin slim) and a head shape from their seed
 * @param {KitLook} look @param {number} seed @param {FigureShapeChoice} [choice]
 * @returns {{ head: string, build: string }}
 */
export function figureShapeFor(look, seed, choice = {}) {
  const b = look.body || {},
    v = (/** @type {string} */ k, /** @type {number} */ d) => (Number.isFinite(b[k]) ? b[k] : d);
  let build = 'average';
  if (v('body', 1) >= 1.15) build = 'round';
  else if (v('body', 1) >= 1.06 && v('shoulders', 1) >= 1.04) build = 'stocky';
  else if (v('height', 1) >= 1.05) build = 'tall';
  else if (v('height', 1) <= 0.92) build = 'small';
  else if (v('body', 1) <= 0.92) build = 'slim';
  else build = ['average', 'average', 'slim', 'stocky'][Math.floor(kitRnd(seed, 1) * 4) % 4];
  const heads = Object.keys(FIGURE_HEADS),
    head = heads[Math.floor(kitRnd(seed, 2) * heads.length) % heads.length];
  return {
    head: choice.head && choice.head in FIGURE_HEADS ? choice.head : head,
    build: choice.build && choice.build in FIGURE_BUILDS ? choice.build : build,
  };
}

/**
 * a person's figure from their look: parts on the joints figurePose moves (hips, torso, head, thigh/shin/foot and
 * arm/forearm/hand A and B), dressed from the wardrobe, its face as marks
 * @param {KitLook} look @param {Record<string, KitItem>} items the wardrobe's items (their default colours)
 * @param {{ name?: string, seed?: number, figure?: FigureShapeChoice }} [opts]
 * @returns {Figure}
 */
export function lookFigure(look, items, opts = {}) {
  const seed = opts.seed ?? figureSeed(opts.name || 'person'),
    shape = figureShapeFor(look, seed, opts.figure),
    HD = FIGURE_HEADS[/** @type {keyof typeof FIGURE_HEADS} */ (shape.head)],
    BD = FIGURE_BUILDS[/** @type {keyof typeof FIGURE_BUILDS} */ (shape.build)],
    body = look.body || {},
    wear = look.wear || {},
    /* a slider, exaggerated, times the build's */
    sl = (/** @type {string} */ k, /** @type {number} */ def = 1) => {
      const v = Number.isFinite(body[k]) ? body[k] : def,
        bk = /** @type {Record<string, number>} */ (BD.k)[k] ?? 1;
      return (k === 'chest' ? v : 1 + (v - 1) * FIGURE_SLIDER_GAIN) * bk;
    },
    hk = sl('height'),
    legK = sl('legs') * hk,
    armK = sl('arms') * hk,
    girth = sl('body'),
    shK = sl('shoulders'),
    hipK = sl('hips'),
    headK = sl('head'),
    chest = Math.max(0, Math.min(1, sl('chest', 0.2))),
    belly = /** @type {Record<string, number>} */ (BD.k).belly || 0,
    tk = hk * (0.96 + 0.04 * girth);
  /* colours: the look's own, else each item's first */
  /** @type {Record<string, Vec3>} */
  const colours = {};
  const itemCol = (/** @type {string | null | undefined} */ id, i = 0, /** @type {Vec3} */ fb = [128, 128, 128]) => {
    if (!id) return fb;
    const own = look.colors && look.colors[id] && look.colors[id][i];
    const def = items[id] && items[id].colors && items[id].colors[i] ? items[id].colors[i][1] : undefined;
    return kitHex(own || def, fb);
  };
  colours.skin = kitHex(look.skin, [230, 176, 138]);
  colours.hair = kitHex(look.hair, [59, 42, 34]);
  colours.top = itemCol(wear.top, 0, [62, 143, 176]);
  colours.pants = itemCol(wear.bottom, 0, [70, 84, 112]);
  colours.shoe = itemCol(wear.shoes, 0, [60, 50, 50]);
  colours.eye = KIT_INK;
  colours.iris = kitHex(look.eyes, [74, 123, 187]);
  colours.glint = [250, 250, 245];
  colours.mouth = [140, 62, 70];
  colours.teeth = [246, 242, 232];
  colours.blush = figureMix(colours.skin, [236, 120, 120], 0.45);
  colours.brow = figureDark(colours.hair, 0.62);
  colours.stubble = figureMix(colours.skin, colours.hair, 0.45);
  colours.freckle = figureDark(colours.skin, 0.72);
  /** @type {FigurePart[]} */
  const parts = [];
  /** @param {string} id @param {string | null} parent @param {Vec3} at @param {FigureShape} sh @param {string} col */
  const add = (id, parent, at, sh, col) => {
    parts.push({ id, parent: parent == null ? -1 : parts.findIndex(p => p.id === parent), at, shape: sh, col });
  };
  /* ---- legs and hips ---- */
  const thighL = 0.24 * legK,
    shinL = 0.19 * legK,
    footH = 0.07,
    hipY = thighL + shinL + footH,
    hipW = 0.08 * Math.sqrt(girth) * hipK,
    legR = 0.066 * Math.sqrt(girth),
    bottom = wear.bottom || 'trousers',
    skirt = bottom === 'skirt',
    shorts = bottom === 'shorts',
    legging = bottom === 'leggings';
  add(
    'hips',
    null,
    [0, hipY, 0],
    { kind: 'ellipsoid', c: [0, 0.03, 0], r: [0.15 * girth * hipK, 0.09, 0.105 * girth], seg: 12, rings: 6 },
    'pants'
  );
  /* ---- the torso, its top (a crop shows the waist) ---- */
  const tw = (/** @type {number} */ k) => k * girth,
    torso = /** @type {FigureShape} */ ({
      kind: 'lathe',
      c: [0, 0, 0],
      y: [-0.08, -0.05, 0.04, 0.17, 0.29, 0.37, 0.41].map(y => y * tk),
      rx: [
        0,
        tw(0.1) * hipK,
        tw(0.165) * (0.6 + 0.4 * hipK) + belly * 0.03,
        tw(0.172) + belly * 0.04 + chest * 0.01,
        tw(0.15) * shK,
        tw(0.1) * shK,
        0,
      ],
      rz: [
        0,
        tw(0.08),
        tw(0.12) + belly * 0.05,
        tw(0.125) + chest * 0.035 + belly * 0.04,
        tw(0.108) + chest * 0.03,
        tw(0.075),
        0,
      ],
      seg: 12,
    });
  add('torso', 'hips', [0, 0.1, 0], torso, 'top');
  if (wear.top === 'crop')
    add(
      'waist',
      'torso',
      [0, 0, 0],
      { kind: 'ellipsoid', c: [0, 0.0, 0], r: [tw(0.158), 0.06, tw(0.118)], seg: 12, rings: 5 },
      'skin'
    );
  /* ---- the head ---- */
  const hr = /** @type {Vec3} */ ([0.28 * headK * HD.r[0], 0.275 * headK * HD.r[1], 0.265 * headK * HD.r[2]]),
    head =
      /** @type {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg: number, rings: number, sq: number, taper: number }} */ ({
        kind: 'ellipsoid',
        c: [0, hr[1] + 0.005, 0.01],
        r: hr,
        seg: 16,
        rings: 12,
        sq: HD.sq,
        taper: HD.taper,
      });
  add('head', 'torso', [0, 0.4 * tk, 0], head, 'skin');
  const c1 = head.c[1];
  /* ears, just showing past the hair */
  for (const s of [1, -1])
    add(
      'ear' + (s > 0 ? 'A' : 'B'),
      'head',
      [0, 0, 0],
      { kind: 'ellipsoid', c: [s * hr[0] * 0.97, c1 - hr[1] * 0.05, 0], r: [0.035, 0.055, 0.04], seg: 8, rings: 5 },
      'skin'
    );
  /* ---- arms, sleeves by the top and the jacket ---- */
  const outer = wear.outer || null,
    sleeved = outer && outer !== 'apron',
    upperCol = sleeved ? 'outer' : KIT_SLEEVELESS.has(wear.top || '') ? 'skin' : 'top',
    lowerCol = sleeved ? 'outer' : KIT_LONG_SLEEVES.has(wear.top || '') ? 'top' : 'skin',
    puff = outer === 'puffer' ? 1.3 : sleeved ? 1.08 : 1,
    armR = 0.056 * Math.sqrt(girth) * puff;
  if (outer) colours.outer = itemCol(outer, 0, [200, 200, 200]);
  for (const s of [1, -1]) {
    const k = s > 0 ? 'A' : 'B',
      armL = 0.19 * armK,
      foreL = 0.14 * armK;
    add(
      'arm' + k,
      'torso',
      [s * (0.2 * shK * Math.sqrt(girth) + belly * 0.02), 0.33 * tk, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -armL, 0], r0: armR, r1: armR * 0.92, seg: 9 },
      upperCol
    );
    add(
      'forearm' + k,
      'arm' + k,
      [0, -armL, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -foreL, 0], r0: armR * 0.85, r1: armR * 0.8, seg: 8 },
      lowerCol
    );
    add(
      'hand' + k,
      'forearm' + k,
      [0, -foreL - 0.01, 0],
      { kind: 'ellipsoid', c: [0, -0.045, 0.008], r: [0.062, 0.066, 0.06], seg: 9, rings: 6 },
      'skin'
    );
  }
  /* ---- legs: trousers, shorts, a skirt over bare legs; shoes ---- */
  const shoes = wear.shoes || 'sneakers';
  for (const s of [1, -1]) {
    const k = s > 0 ? 'A' : 'B',
      r0 = legR * (legging ? 0.88 : 1.06);
    add(
      'thigh' + k,
      'hips',
      [s * hipW, 0, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -thighL, 0], r0, r1: r0 * 0.9, seg: 9 },
      skirt ? 'skin' : 'pants'
    );
    add(
      'shin' + k,
      'thigh' + k,
      [0, -thighL, 0],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -shinL, 0], r0: r0 * 0.88, r1: r0 * 0.82, seg: 9 },
      skirt || shorts ? 'skin' : 'pants'
    );
    const long = shoes === 'oxfords' ? 1.12 : 1,
      tall = shoes === 'boots' || shoes === 'hightops';
    add(
      'foot' + k,
      'shin' + k,
      [0, -shinL, 0],
      {
        kind: 'ellipsoid',
        c: [0, -0.03, 0.04 * long],
        r: [0.072, shoes === 'sandals' ? 0.025 : 0.042, 0.105 * long],
        seg: 10,
        rings: 6,
      },
      shoes === 'sandals' ? 'skin' : 'shoe'
    );
    if (shoes === 'sandals')
      add(
        'sole' + k,
        'foot' + k,
        [0, -0.05, 0],
        { kind: 'ellipsoid', c: [0, 0, 0.04], r: [0.075, 0.014, 0.11], seg: 10, rings: 4 },
        'shoe'
      );
    if (tall)
      add(
        'boot' + k,
        'shin' + k,
        [0, -shinL * 0.55, 0],
        { kind: 'capsule', a: [0, 0, 0], b: [0, -shinL * 0.42, 0], r0: r0 * 0.98, r1: r0 * 0.95, seg: 9 },
        'shoe'
      );
  }
  if (skirt)
    add(
      'skirt',
      'hips',
      [0, 0.06, 0],
      {
        kind: 'lathe',
        c: [0, 0, 0],
        y: [-0.26 * legK, -0.18 * legK, -0.02, 0.04],
        rx: [0.21 * girth * hipK, 0.19 * girth * hipK, 0.155 * girth * hipK, 0],
        rz: [0.17 * girth, 0.15 * girth, 0.115 * girth, 0],
        seg: 12,
      },
      'pants'
    );
  /* ---- jackets, long coats and the apron ---- */
  if (outer && KIT_JACKETS.has(outer)) {
    const p = outer === 'puffer' ? 1.2 : 1.07;
    add(
      'jacket',
      'torso',
      [0, 0, 0],
      {
        kind: 'lathe',
        c: [0, 0, 0],
        y: [-0.07, 0.04, 0.17, 0.29, 0.36, 0.42].map(y => y * tk),
        rx: [1, 2, 3, 4, 5, 0].map(i => (torso.kind === 'lathe' ? torso.rx[i] : 0) * p + (i < 5 ? 0.008 : 0)),
        rz: [1, 2, 3, 4, 5, 0].map(i => (torso.kind === 'lathe' ? torso.rz[i] : 0) * p + (i < 5 ? 0.01 : 0)),
        seg: 12,
      },
      'outer'
    );
  }
  if (outer && KIT_LONG_COATS.has(outer)) {
    const R = torso.kind === 'lathe' ? torso : null,
      rx = R ? R.rx : [],
      rz = R ? R.rz : [];
    add(
      'coat',
      'torso',
      [0, 0, 0],
      {
        kind: 'lathe',
        c: [0, 0, 0],
        y: [-0.1 - thighL * 0.95, -0.08, 0.04 * tk, 0.17 * tk, 0.29 * tk, 0.37 * tk, 0.42 * tk],
        rx: [rx[2] * 1.32 * hipK, rx[1] * 1.25 + 0.03, rx[2] + 0.012, rx[3] + 0.012, rx[4] + 0.012, rx[5] + 0.01, 0],
        rz: [rz[2] * 1.3, rz[1] * 1.3 + 0.02, rz[2] + 0.014, rz[3] + 0.014, rz[4] + 0.014, rz[5] + 0.01, 0],
        seg: 12,
      },
      'outer'
    );
  }
  if (outer === 'apron') {
    const R = torso.kind === 'lathe' ? torso : null;
    add(
      'apron',
      'torso',
      [0, 0, 0],
      {
        kind: 'ellipsoid',
        c: [0, 0.02 * tk, (R ? R.rz[3] : 0.12) * 0.9],
        r: [(R ? R.rx[3] : 0.17) * 0.78, 0.28 * tk, 0.035],
        seg: 10,
        rings: 6,
      },
      'outer'
    );
  }
  /* ---- neckwear ---- */
  const neck = wear.neck || null,
    torsoZ = torso.kind === 'lathe' ? torso.rz[4] : 0.11;
  if (neck) colours.neck = itemCol(neck, 0, [217, 67, 75]);
  if (neck === 'scarf')
    add(
      'scarf',
      'torso',
      [0, 0.36 * tk, 0],
      {
        kind: 'torus',
        c: [0, 0, 0.005],
        R: [0.105 * Math.sqrt(girth), 0.085 * Math.sqrt(girth)],
        r: 0.042,
        seg: 12,
        rings: 6,
      },
      'neck'
    );
  if (neck === 'chain') {
    colours.neck = [226, 184, 74];
    add(
      'chain',
      'torso',
      [0, 0.33 * tk, 0.01],
      { kind: 'torus', c: [0, 0, 0], R: [0.1 * girth, torsoZ + 0.005], r: 0.012, seg: 12, rings: 4 },
      'neck'
    );
  }
  if (neck === 'tie' || neck === 'bowtie') {
    const z = torsoZ + 0.012;
    if (neck === 'tie')
      add(
        'tie',
        'torso',
        [0, 0.36 * tk, z],
        { kind: 'capsule', a: [0, 0, 0], b: [0, -0.2 * tk, 0.015], r0: 0.02, r1: 0.032, seg: 6 },
        'neck'
      );
    else
      for (const s of [1, -1])
        add(
          'bow' + (s > 0 ? 'A' : 'B'),
          'torso',
          [0, 0.365 * tk, z],
          { kind: 'ellipsoid', c: [s * 0.03, 0, 0], r: [0.032, 0.022, 0.016], seg: 8, rings: 5 },
          'neck'
        );
  }
  /* ---- bags ---- */
  const bag = wear.bag || null;
  if (bag) {
    colours.bag = itemCol(bag, 0, [212, 156, 70]);
    if (bag === 'backpack')
      add(
        'pack',
        'torso',
        [0, 0.2 * tk, -torsoZ - 0.06],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.14 * Math.sqrt(girth), 0.16 * tk, 0.075], seg: 10, rings: 6, sq: 0.6 },
        'bag'
      );
    else if (bag === 'satchel')
      add(
        'satchel',
        'hips',
        [-0.17 * girth * hipK - 0.02, 0.0, 0.02],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.04, 0.08, 0.11], seg: 8, rings: 5, sq: 0.6 },
        'bag'
      );
    else
      add(
        'fanny',
        'hips',
        [0, 0.05, 0.105 * girth + 0.02],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.09, 0.045, 0.04], seg: 8, rings: 5, sq: 0.4 },
        'bag'
      );
  }
  /* ---- hair and hats ---- */
  const hat = wear.hat || null;
  if (hat) colours.hat = itemCol(hat, 0, [217, 67, 75]);
  if (hat) colours.hat2 = itemCol(hat, 1, colours.hat);
  kitHair(add, wear.hair || null, head, !!hat, seed);
  if (hat) kitHat(add, hat, head);
  if (wear.glasses === 'headset') {
    colours.gear = itemCol('headset', 0, [40, 40, 48]);
    for (const s of [1, -1])
      add(
        'cup' + (s > 0 ? 'A' : 'B'),
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [s * hr[0] * 1.02, c1 - hr[1] * 0.05, 0], r: [0.035, 0.07, 0.065], seg: 8, rings: 5 },
        'gear'
      );
    add(
      'band',
      'head',
      [0, 0, 0],
      { kind: 'torus', c: [0, c1 + hr[1] * 0.1, 0], R: [hr[0] * 1.06, 0.05], r: 0.018, seg: 14, rings: 4 },
      'gear'
    );
  }
  if (wear.facial === 'facial_beard')
    add(
      'beard',
      'head',
      [0, 0, 0],
      {
        kind: 'ellipsoid',
        c: [0, c1 - hr[1] * 0.62, hr[2] * 0.42],
        r: [hr[0] * 0.78, hr[1] * 0.42, hr[2] * 0.62],
        seg: 12,
        rings: 7,
      },
      'hair'
    );
  /* ---- the face ---- */
  const face = kitFaceMarks(head, wear, look, colours, seed);
  if (wear.neck === 'nametag') {
    colours.tag = [246, 244, 236];
    const R = torso.kind === 'lathe' ? torso : null,
      zT = R ? R.rz[3] : 0.12;
    face.push({ part: 'torso', kind: 'tag', at: [0.07, 0.24 * tk, zT + 0.01], n: [0, 0, 1], w: 0.06, h: 0.035 });
  }
  const gait = { ...BD.gait, ...((opts.figure && opts.figure.gait) || {}) };
  const top = parts.reduce((m, p) => Math.max(m, kitTopOf(p, parts)), 0);
  return { name: opts.name || 'person', height: Math.max(0.6, top), parts, face, colours, gait, kit: shape };
}

/** where a part's top reaches in the rest pose (its joint's height above the ground plus its shape's top), metres
 * @param {FigurePart} p @param {FigurePart[]} parts */
export function kitTopOf(p, parts) {
  let y = 0;
  for (let q = p; q; q = q.parent >= 0 ? parts[q.parent] : /** @type {any} */ (null)) y += q.at[1];
  const s = p.shape;
  if (s.kind === 'ellipsoid') return y + s.c[1] + s.r[1];
  if (s.kind === 'lathe') return y + Math.max(...s.y);
  if (s.kind === 'torus') return y + s.c[1] + s.r;
  if (s.kind === 'cone') return y + Math.max(s.a[1], s.b[1]);
  return y + Math.max(s.a[1] + s.r0, s.b[1] + s.r1);
}

/**
 * the hair's parts on the head: a cap cut to the style, and what a style adds (a bun, a ponytail, twin tails, spikes,
 * curls, a side swoop, long hair down the back). Under a hat, nothing on top.
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string | null} style @param {{ c: Vec3, r: Vec3, sq: number, taper: number }} H the head
 * @param {boolean} hat @param {number} seed
 */
export function kitHair(add, style, H, hat, seed) {
  if (!style) return;
  const { c, r } = H,
    k = style === 'hair_curly' ? 1.13 : style === 'hair_buzz' ? 1.025 : style === 'hair_bob' ? 1.1 : 1.065,
    cap = (/** @type {import('./figure-pose.js').HairCut} */ cut, /** @type {number[]} */ m = [1, 1, 1]) =>
      add(
        'hair',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [c[0], c[1] + r[1] * 0.04, c[2] - 0.005],
          r: [r[0] * k * m[0], r[1] * k * m[1], r[2] * k * m[2]],
          seg: 16,
          rings: 12,
          sq: H.sq,
          taper: H.taper,
          cut,
        },
        'hair'
      );
  const lean = kitRnd(seed, 5) < 0.5 ? 1 : -1;
  switch (style) {
    case 'hair_buzz':
      cap({ front: 0.42, side: 0.12, back: -0.15 });
      break;
    case 'hair_short':
      cap({ front: 0.36, side: -0.05, back: -0.42, bangs: 3, depth: 0.12 });
      break;
    case 'hair_sidepart':
      cap({ front: 0.4, side: -0.08, back: -0.45, bangs: 2, depth: 0.08 });
      add(
        'swoop',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [lean * r[0] * 0.38, c[1] + r[1] * 0.62, r[2] * 0.62],
          r: [r[0] * 0.55, r[1] * 0.22, r[2] * 0.38],
          seg: 10,
          rings: 6,
        },
        'hair'
      );
      break;
    case 'hair_bob':
      cap({ front: 0.3, side: -0.62, back: -0.7, bangs: 4, depth: 0.15 });
      break;
    case 'hair_long':
      cap({ front: 0.32, side: -0.6, back: -0.95, bangs: 3, depth: 0.12 });
      add(
        'locks',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, c[1] - r[1] * 0.75, -r[2] * 0.45],
          r: [r[0] * 0.92, r[1] * 0.95, r[2] * 0.42],
          seg: 12,
          rings: 8,
        },
        'hair'
      );
      break;
    case 'hair_curly':
      cap({ front: 0.28, side: -0.3, back: -0.55, bangs: 5, depth: 0.1 });
      if (!hat)
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + kitRnd(seed, 10 + i) * 0.4,
            up = 0.55 + 0.3 * kitRnd(seed, 20 + i);
          add(
            'curl' + i,
            'head',
            [0, 0, 0],
            {
              kind: 'ellipsoid',
              c: [Math.sin(a) * r[0] * 0.78, c[1] + r[1] * up, Math.cos(a) * r[2] * 0.7 - 0.02],
              r: [0.085, 0.08, 0.085],
              seg: 8,
              rings: 5,
            },
            'hair'
          );
        }
      break;
    case 'hair_spiky':
      cap({ front: 0.38, side: -0.02, back: -0.4, bangs: 4, depth: 0.1 });
      if (!hat)
        for (let i = 0; i < 6; i++) {
          const a = -1.1 + (i / 5) * 2.2,
            back = i % 2 ? -0.3 : 0.05,
            base = /** @type {Vec3} */ ([Math.sin(a) * r[0] * 0.55, c[1] + r[1] * 0.68, back * r[2]]);
          add(
            'spike' + i,
            'head',
            [0, 0, 0],
            {
              kind: 'cone',
              a: base,
              b: [base[0] * 1.6, base[1] + 0.16 + 0.04 * kitRnd(seed, 30 + i), base[2] - 0.1],
              r: 0.075,
              seg: 6,
            },
            'hair'
          );
        }
      break;
    case 'hair_twin':
      cap({ front: 0.34, side: -0.35, back: -0.5, bangs: 4, depth: 0.12 });
      for (const s of [1, -1])
        add(
          'tail' + (s > 0 ? 'A' : 'B'),
          'head',
          [0, 0, 0],
          {
            kind: 'capsule',
            a: [s * r[0] * 0.98, c[1] + r[1] * 0.35, -r[2] * 0.25],
            b: [s * r[0] * 1.25, c[1] - r[1] * 0.75, -r[2] * 0.35],
            r0: 0.07,
            r1: 0.045,
            seg: 8,
          },
          'hair'
        );
      break;
    case 'hair_pony':
      cap({ front: 0.36, side: -0.25, back: -0.45, bangs: 3, depth: 0.1 });
      add(
        'pony',
        'head',
        [0, 0, 0],
        {
          kind: 'capsule',
          a: [0, c[1] + r[1] * 0.45, -r[2] * 1.0],
          b: [0, c[1] - r[1] * 0.75, -r[2] * 1.3],
          r0: 0.075,
          r1: 0.04,
          seg: 8,
        },
        'hair'
      );
      break;
    case 'hair_bun':
    default:
      cap({ front: 0.38, side: -0.15, back: -0.45, bangs: 2, depth: 0.06 });
      if (!hat)
        add(
          'bun',
          'head',
          [0, 0, 0],
          {
            kind: 'ellipsoid',
            c: [0, c[1] + r[1] * 0.92, -r[2] * 0.45],
            r: [0.11, 0.1, 0.11],
            seg: 10,
            rings: 6,
          },
          'hair'
        );
  }
}

/**
 * a hat's parts on the head: a cap with its peak, a beanie with its fold and bobble, a hard hat, a bucket hat, a
 * cowboy hat, a top hat with its band, a chef's toque, a crown
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string} hat @param {{ c: Vec3, r: Vec3 }} H the head
 */
export function kitHat(add, hat, H) {
  const { c, r } = H,
    top = c[1] + r[1] * 0.42,
    w = r[0] * 1.08,
    d = r[2] * 1.08,
    dome = (/** @type {number} */ h, /** @type {number} */ cut) =>
      add(
        'hat',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, top - h * 0.15, -0.005],
          r: [w, h, d],
          seg: 14,
          rings: 8,
          cut: { front: cut, side: cut, back: cut },
        },
        'hat'
      ),
    disc = (
      /** @type {string} */ id,
      /** @type {number} */ y,
      /** @type {number} */ rx,
      /** @type {number} */ rz,
      /** @type {number} */ th,
      /** @type {string} */ col,
      /** @type {number} */ dz = 0
    ) =>
      add(
        id,
        'head',
        [0, 0, 0],
        {
          kind: 'lathe',
          c: [0, 0, dz],
          y: [y - th, y - th * 0.5, y, y + th * 0.3],
          rx: [0, rx, rx * 0.98, 0],
          rz: [0, rz, rz * 0.98, 0],
          seg: 14,
        },
        col
      ),
    drum = (
      /** @type {string} */ id,
      /** @type {number} */ y0,
      /** @type {number} */ h,
      /** @type {number} */ rx0,
      /** @type {number} */ rx1,
      /** @type {string} */ col
    ) =>
      add(
        id,
        'head',
        [0, 0, 0],
        {
          kind: 'lathe',
          c: [0, 0, 0],
          y: [y0, y0 + 0.01, y0 + h * 0.5, y0 + h, y0 + h + 0.005],
          rx: [0, rx0, (rx0 + rx1) / 2, rx1, 0],
          rz: [0, rx0 * 0.94, ((rx0 + rx1) / 2) * 0.94, rx1 * 0.94, 0],
          seg: 14,
        },
        col
      );
  switch (hat) {
    case 'hat_cap':
      dome(r[1] * 0.62, -0.1);
      add(
        'peak',
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [0, top - 0.02, d * 0.92], r: [w * 0.72, 0.022, r[2] * 0.62], seg: 12, rings: 4 },
        'hat2'
      );
      break;
    case 'hat_beanie':
      dome(r[1] * 0.7, -0.15);
      add(
        'fold',
        'head',
        [0, 0, 0],
        { kind: 'torus', c: [0, top - r[1] * 0.2, 0], R: [w * 0.97, d * 0.97], r: 0.035, seg: 14, rings: 5 },
        'hat'
      );
      add(
        'bobble',
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [0, top + r[1] * 0.58, 0], r: [0.06, 0.06, 0.06], seg: 8, rings: 5 },
        'hat2'
      );
      break;
    case 'hat_hardhat':
      dome(r[1] * 0.66, -0.05);
      disc('brim', top - r[1] * 0.12, w * 1.12, d * 1.22, 0.03, 'hat', 0.03);
      break;
    case 'hat_bucket':
      drum('hat', top - 0.06, r[1] * 0.42, w * 0.98, w * 0.86, 'hat');
      disc('brim', top - 0.06, w * 1.32, d * 1.32, 0.025, 'hat');
      break;
    case 'hat_cowboy':
      drum('hat', top - 0.05, r[1] * 0.55, w * 0.9, w * 0.78, 'hat');
      disc('brim', top - 0.05, w * 1.7, d * 1.45, 0.025, 'hat');
      add(
        'band',
        'head',
        [0, 0, 0],
        { kind: 'torus', c: [0, top + 0.0, 0], R: [w * 0.9, w * 0.85], r: 0.022, seg: 14, rings: 4 },
        'hat2'
      );
      break;
    case 'hat_tophat':
      drum('hat', top - 0.06, r[1] * 1.15, w * 0.82, w * 0.86, 'hat');
      disc('brim', top - 0.06, w * 1.18, d * 1.12, 0.022, 'hat');
      add(
        'band',
        'head',
        [0, 0, 0],
        { kind: 'torus', c: [0, top + 0.01, 0], R: [w * 0.84, w * 0.8], r: 0.025, seg: 14, rings: 4 },
        'hat2'
      );
      break;
    case 'hat_chef':
      drum('hat', top - 0.06, r[1] * 0.4, w * 0.95, w * 1.02, 'hat');
      add(
        'puff',
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [0, top + r[1] * 0.62, 0], r: [w * 1.15, r[1] * 0.55, d * 1.1], seg: 12, rings: 7 },
        'hat'
      );
      break;
    case 'hat_crown':
      drum('hat', top - 0.03, r[1] * 0.3, w * 0.8, w * 0.86, 'hat');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(
          'point' + i,
          'head',
          [0, 0, 0],
          {
            kind: 'cone',
            a: [Math.sin(a) * w * 0.78, top + r[1] * 0.25, Math.cos(a) * w * 0.74],
            b: [Math.sin(a) * w * 0.85, top + r[1] * 0.55, Math.cos(a) * w * 0.8],
            r: 0.04,
            seg: 5,
          },
          'hat'
        );
      }
      break;
    default:
      dome(r[1] * 0.62, -0.1);
  }
}

/**
 * the face as marks on the head (logic/figure-pose.js figureFaceMarks paints them in whole pixels): eyes by style
 * with a glint and an iris, lashes, brows by style, the mouth by style (a grin's teeth), blush, freckles, a stache,
 * stubble, and glasses (round and square frames, sunglasses, a monocle)
 * @param {{ c: Vec3, r: Vec3, sq: number, taper: number }} H @param {Record<string, string | null>} wear
 * @param {KitLook} look @param {Record<string, Vec3>} colours @param {number} seed @returns {FaceMark[]}
 */
export function kitFaceMarks(H, wear, look, colours, seed) {
  /** @type {FaceMark[]} */
  const out = [];
  const { c, r } = H,
    /** @param {string} kind @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<FaceMark>} [o] */
    mark = (kind, x, y, w, h, o = {}) => out.push({ part: 'head', kind, ...frontOf(H, x, y), w, h, ...o }),
    ex = r[0] * 0.38,
    ey = c[1] - r[1] * 0.1,
    eyes = wear.eyes || 'eyes_round',
    [ew, eh] =
      eyes === 'eyes_wide'
        ? [0.085, 0.115]
        : eyes === 'eyes_sharp'
          ? [0.085, 0.06]
          : eyes === 'eyes_sleepy'
            ? [0.085, 0.045]
            : [0.068, 0.098];
  if (kitRnd(seed, 40) < 0.4 || /lashes/.test(eyes))
    for (const s of [1, -1]) mark('blush', s * r[0] * 0.6, c[1] - r[1] * 0.36, 0.07, 0.03);
  if (wear.facial === 'facial_freckles')
    for (const s of [1, -1])
      for (const [dx, dy] of [
        [0.52, -0.3],
        [0.66, -0.38],
      ])
        mark('freckle', s * r[0] * dx, c[1] + r[1] * dy, 0.03, 0.03);
  if (wear.facial === 'facial_stubble') mark('stubble', 0, c[1] - r[1] * 0.62, r[0] * 0.9, r[1] * 0.32, { min: 0.3 });
  for (const s of [1, -1]) {
    mark('eye', s * ex, ey, ew, eh);
    mark('iris', s * ex + 0.02, ey - eh * 0.3, 0.032, 0.032, { col: 'iris', min: 0.6 });
    if (eyes === 'eyes_lashes') mark('lash', s * (ex + ew * 0.62), ey + eh * 0.42, 0.03, 0.03, { col: 'eye' });
    if (eyes === 'eyes_sleepy') mark('lid', s * ex, ey + eh * 0.75, ew * 1.1, 0.03, { col: 'brow' });
  }
  /* brows */
  const brows = wear.brows || null,
    by = ey + eh * 0.5 + 0.05;
  if (brows)
    for (const s of [1, -1]) {
      if (brows === 'brows_stern') {
        mark('brow', s * (ex - 0.025), by - 0.018, 0.045, 0.03, { col: 'brow' });
        mark('brow', s * (ex + 0.025), by + 0.012, 0.045, 0.03, { col: 'brow' });
      } else if (brows === 'brows_arched') {
        mark('brow', s * ex, by + 0.015, 0.06, 0.03, { col: 'brow' });
        mark('brow', s * (ex + 0.045), by - 0.012, 0.03, 0.03, { col: 'brow' });
      } else
        mark('brow', s * ex, by, brows === 'brows_soft' ? 0.06 : 0.085, brows === 'brows_thick' ? 0.06 : 0.03, {
          col: 'brow',
        });
    }
  /* the mouth */
  const mouth = wear.mouth || 'mouth_smile',
    my = c[1] - r[1] * 0.52;
  if (wear.facial === 'facial_stache') mark('stache', 0, my + 0.05, 0.1, 0.035, { col: 'brow', min: 0.25 });
  if (mouth === 'mouth_grin') {
    mark('mouth', 0, my, 0.11, 0.06);
    mark('teeth', 0, my + 0.015, 0.08, 0.03, { min: 0.3 });
  } else if (mouth === 'mouth_open') mark('mouth', 0, my, 0.05, 0.065);
  else if (mouth === 'mouth_neutral') mark('mouth', 0, my, 0.06, 0.03);
  else if (mouth === 'mouth_smirk') {
    mark('mouth', 0.02, my, 0.06, 0.03);
    mark('mouth', 0.06, my + 0.025, 0.03, 0.03);
  } else {
    mark('mouth', 0, my - 0.012, 0.06, 0.03);
    for (const s of [1, -1]) mark('mouth', s * 0.045, my + 0.015, 0.03, 0.03);
  }
  /* glasses over the eyes */
  const g = wear.glasses;
  if (g && g !== 'headset') {
    const frameCol = kitHex(
      (look.colors && look.colors[g] && look.colors[g][0]) || undefined,
      g === 'glasses_sun' ? [30, 26, 34] : [58, 46, 42]
    );
    colours.frame = frameCol;
    colours.lens = [34, 30, 44];
    const gw = ew + 0.06,
      gh = Math.max(eh, 0.07) + 0.05;
    if (g === 'glasses_monocle') mark('glasses', -ex, ey, gw, gh, { col: 'frame', hollow: true, min: 0.3 });
    else
      for (const s of [1, -1])
        mark('glasses', s * ex, ey, gw, g === 'glasses_square' ? gh * 0.85 : gh, {
          col: g === 'glasses_sun' ? 'lens' : 'frame',
          hollow: g !== 'glasses_sun',
          min: 0.3,
        });
    if (g !== 'glasses_monocle') mark('bridge', 0, ey + 0.01, ex * 2 - gw + 0.02, 0.03, { col: 'frame', min: 0.3 });
  }
  return out;
}

/**
 * Kappi, a capybara (people/kappi.json `creature`): a barrel of a body on four short legs, a blunt square head with
 * small ears and a big nose, round glasses and a name tag, about 0.8 m to the top of the head; faces +z
 * @param {{ name?: string }} [opts] @returns {Figure}
 */
export function kappiFigure(opts = {}) {
  /** @type {FigurePart[]} */
  const parts = [];
  /** @param {string} id @param {string | null} parent @param {Vec3} at @param {FigureShape} sh @param {string} col */
  const add = (id, parent, at, sh, col) => {
    parts.push({ id, parent: parent == null ? -1 : parts.findIndex(p => p.id === parent), at, shape: sh, col });
  };
  add(
    'body',
    null,
    [0, 0.42, 0],
    { kind: 'ellipsoid', c: [0, 0, -0.04], r: [0.25, 0.23, 0.42], seg: 14, rings: 9, sq: 0.35 },
    'fur'
  );
  const head =
    /** @type {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg: number, rings: number, sq: number, taper: number }} */ ({
      kind: 'ellipsoid',
      c: [0, 0.03, 0.12],
      r: [0.16, 0.16, 0.23],
      seg: 14,
      rings: 9,
      sq: 0.6,
      taper: 0.08,
    });
  add('head', 'body', [0, 0.14, 0.32], head, 'fur');
  add(
    'snout',
    'head',
    [0, 0, 0],
    { kind: 'ellipsoid', c: [0, -0.02, 0.3], r: [0.13, 0.11, 0.07], seg: 12, rings: 6, sq: 0.5 },
    'snout'
  );
  for (const s of [1, -1])
    add(
      'ear' + (s > 0 ? 'A' : 'B'),
      'head',
      [0, 0, 0],
      { kind: 'ellipsoid', c: [s * 0.11, 0.18, 0.02], r: [0.04, 0.045, 0.03], seg: 8, rings: 5 },
      'dark'
    );
  for (const [id, x, z] of /** @type {[string, number, number][]} */ ([
    ['legFL', 0.14, 0.24],
    ['legFR', -0.14, 0.24],
    ['legBL', 0.15, -0.28],
    ['legBR', -0.15, -0.28],
  ])) {
    add(
      id,
      'body',
      [x, -0.12, z],
      { kind: 'capsule', a: [0, 0, 0], b: [0, -0.22, 0], r0: 0.065, r1: 0.055, seg: 8 },
      'fur'
    );
    add(
      'paw' + id.slice(3),
      id,
      [0, -0.24, 0],
      { kind: 'ellipsoid', c: [0, 0, 0.02], r: [0.06, 0.03, 0.075], seg: 8, rings: 4 },
      'dark'
    );
  }
  const fur = /** @type {Vec3} */ ([154, 104, 66]);
  /** @type {FaceMark[]} */
  const face = [];
  /** @param {string} kind @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<FaceMark>} [o] */
  const mark = (kind, x, y, w, h, o = {}) => face.push({ part: 'head', kind, ...frontOf(head, x, y), w, h, ...o });
  for (const s of [1, -1]) {
    mark('eye', s * 0.085, 0.09, 0.05, 0.06);
    mark('glasses', s * 0.085, 0.09, 0.11, 0.1, { col: 'frame', hollow: true, min: 0.3 });
  }
  mark('bridge', 0, 0.1, 0.06, 0.03, { col: 'frame', min: 0.3 });
  const snout = /** @type {{ c: Vec3, r: Vec3, sq: number }} */ ({
    c: [0, -0.02, 0.3],
    r: [0.13, 0.11, 0.07],
    sq: 0.5,
  });
  for (const s of [1, -1])
    face.push({
      part: 'head',
      kind: 'nose',
      ...frontOf(snout, s * 0.04, 0.02),
      w: 0.03,
      h: 0.04,
      col: 'eye',
      min: 0.3,
    });
  face.push({ part: 'body', kind: 'tag', at: [0.12, 0.08, 0.3], n: [0.3, 0.3, 0.9], w: 0.06, h: 0.035, min: 0.3 });
  return {
    name: opts.name || 'kappi',
    height: 0.8,
    parts,
    face,
    colours: {
      fur,
      snout: [118, 78, 52],
      dark: [86, 56, 40],
      eye: KIT_INK,
      glint: [250, 250, 245],
      frame: [58, 46, 42],
      tag: [246, 244, 236],
    },
    gait: { swing: 1, bounce: 0.6 },
  };
}
