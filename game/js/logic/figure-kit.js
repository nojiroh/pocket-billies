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
import {
  figureDark,
  figureMesh,
  figureMix,
  figurePose,
  figureUnit,
  frontOf,
  headDeform,
  jointMatrices,
} from './figure-pose.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_BUILDS: [() => FIGURE_BUILDS],
  FIGURE_HEADS: [() => FIGURE_HEADS],
  FIGURE_SLIDER_GAIN: [() => FIGURE_SLIDER_GAIN],
  KIT_CHIBI: [() => KIT_CHIBI],
  KIT_INK: [() => KIT_INK],
  KIT_JACKETS: [() => KIT_JACKETS],
  KIT_LONG_COATS: [() => KIT_LONG_COATS],
  KIT_LONG_SLEEVES: [() => KIT_LONG_SLEEVES],
  KIT_RANDOM_HEADS: [() => KIT_RANDOM_HEADS],
  KIT_SLEEVELESS: [() => KIT_SLEEVELESS],
  // @ts-expect-error -- replaced on purpose
  figureSeed: [() => figureSeed, v => (figureSeed = v)],
  // @ts-expect-error -- replaced on purpose
  figureShapeFor: [() => figureShapeFor, v => (figureShapeFor = v)],
  // @ts-expect-error -- replaced on purpose
  kappiFigure: [() => kappiFigure, v => (kappiFigure = v)],
  // @ts-expect-error -- replaced on purpose
  kitExtent: [() => kitExtent, v => (kitExtent = v)],
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
/** @typedef {{ head?: string, build?: string, gait?: FigureGait, variety?: boolean }} FigureShapeChoice a person's
 * `figure`; `variety` (townsfolk) lets every build turn up, where anyone else's sliders decide it */

/** the head shapes (CH-3b round 5, the owner: "Complete redo the heads. Use complex shapes with deformation"): each
 * a sculpted head (logic/figure-pose.js headDeform): its radii as parts of the usual head's, how V its jaw is (below 0
 * wider at the jaw than the cheeks), how far its chin drops, its cheekbones, how big the back of its skull, how flat its
 * face. `hero` is the main character's (you), never picked at random */
export const FIGURE_HEADS = Object.freeze({
  round: { r: [1.02, 0.98, 1], jaw: 0.2, chin: 0.25, cheek: 1.25, crown: 1, face: 0.4 },
  oval: { r: [0.95, 1.03, 0.98], jaw: 0.55, chin: 0.5, cheek: 0.9, crown: 1.05, face: 0.55 },
  square: { r: [1, 0.96, 0.98], jaw: -0.15, chin: 0.45, cheek: 1, crown: 0.95, face: 0.75 },
  long: { r: [0.9, 1.1, 0.96], jaw: 0.45, chin: 0.85, cheek: 0.85, crown: 1.1, face: 0.6 },
  pear: { r: [0.98, 0.98, 1], jaw: -0.35, chin: 0.35, cheek: 0.75, crown: 0.9, face: 0.5 },
  heart: { r: [1.02, 1, 0.98], jaw: 0.95, chin: 0.55, cheek: 1.3, crown: 1.05, face: 0.5 },
  /* narrow at the brow and the chin, wide at the cheekbones */
  diamond: { r: [0.95, 1.03, 0.98], jaw: 0.8, chin: 0.7, cheek: 1.5, crown: 0.9, face: 0.55 },
  /* wide and flat-faced, a strong jaw */
  broad: { r: [1.08, 0.95, 1], jaw: 0.05, chin: 0.3, cheek: 1.1, crown: 0.95, face: 0.85 },
  hero: { r: [0.97, 1.02, 0.98], jaw: 0.72, chin: 0.62, cheek: 1.1, crown: 1.12, face: 0.65 },
});
/** the head shapes a seed may pick (not the main character's) */
export const KIT_RANDOM_HEADS = Object.freeze(Object.keys(FIGURE_HEADS).filter(k => k !== 'hero'));
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
  tall: { k: { height: 1.1, legs: 1.14, body: 0.9, arms: 1.06, neck: 1.5 }, gait: { swing: 1.12, lean: -0.02 } },
  small: { k: { height: 0.84, legs: 0.86, head: 1.08, neck: 0.5 }, gait: { swing: 1.15, bounce: 1.7 } },
  /* CH-3b's second pass: forms by their masses (a wedge, a pear, a beanpole, a stoop) */
  athletic: {
    k: { shoulders: 1.32, hips: 0.86, waist: 0.78, legs: 1.04, arms: 1.06, chestOut: 1 },
    gait: { swing: 1.1, arms: 1.25, lean: -0.04 },
  },
  pear: { k: { shoulders: 0.84, hips: 1.32, legs: 0.92, body: 1.06, waist: 1.1 }, gait: { swing: 0.9, hang: 0.08 } },
  lanky: {
    k: { height: 1.12, legs: 1.2, arms: 1.16, body: 0.74, shoulders: 0.96, neck: 1.8 },
    gait: { swing: 1.15, lean: 0.07, head: 0.1, bounce: 1.25 },
  },
  elder: {
    k: { height: 0.9, legs: 0.88, body: 1.06, head: 0.96, waist: 1.1 },
    gait: { swing: 0.6, arms: 0.5, lean: 0.17, head: 0.08, bounce: 0.3, hang: 0.08 },
  },
});
/** the proportions (the owner, 2026-10-28: Gen 5's style, "in that HD-2D style", then "not too chibi"): about 2.6
 * heads, a big head for the face and hair, legs, torso and arms a little short */
export const KIT_CHIBI = Object.freeze({ head: 1.13, legs: 0.86, torso: 0.92, arms: 0.9, neck: 0.8 });
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
  else if (choice.variety) {
    /* townsfolk: every form turns up, the usual ones more often */
    const B = ['average', 'average', 'slim', 'stocky', 'athletic', 'pear', 'lanky', 'round', 'elder'];
    build = B[Math.floor(kitRnd(seed, 1) * B.length) % B.length];
  }
  const heads = KIT_RANDOM_HEADS,
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
 * @param {{ name?: string, seed?: number, figure?: FigureShapeChoice,
 *   chibi?: { head: number, legs: number, torso: number, arms: number, neck: number },
 *   flair?: { hair?: number, scarf?: boolean, cape?: boolean, col?: number[], wear?: Record<string, string>,
 *     detail?: boolean, gloves?: boolean, gloveCol?: number[], goggles?: boolean, fur?: boolean, earrings?: boolean,
 *     ahoge?: boolean, glossy?: boolean } }} [opts]
 * `chibi`: proportions
 * other than KIT_CHIBI (a direction of figures.js FIGURE_LOOKS)
 * @returns {Figure}
 */
export function lookFigure(look, items, opts = {}) {
  const PR = opts.chibi || KIT_CHIBI,
    seed = opts.seed ?? figureSeed(opts.name || 'person'),
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
    /* the tallest and shortest a build and slider make (an exaggerated tall build would tower over the town) */
    hk = Math.max(0.8, Math.min(1.14, sl('height'))),
    legK = sl('legs') * hk * PR.legs,
    armK = sl('arms') * hk * PR.arms,
    /* the widest and thinnest (a round build on a big body slider would be a ball) */
    girth = Math.max(0.75, Math.min(1.5, sl('body'))),
    shK = sl('shoulders'),
    hipK = sl('hips'),
    /* heads vary a little from person to person, beyond the slider */
    headK = sl('head') * (0.96 + 0.08 * kitRnd(seed, 3)),
    chest = Math.max(0, Math.min(1, sl('chest', 0.2))),
    BK = /** @type {Record<string, number>} */ (BD.k),
    belly = BK.belly || 0,
    waist = BK.waist || 1,
    chestOut = BK.chestOut || 0,
    neckL = 0.035 * (BK.neck ?? 1) * PR.neck,
    tk = hk * (0.96 + 0.04 * girth) * PR.torso;
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
  colours.hair2 = figureMix(figureDark(colours.hair, 0.86), [96, 74, 152], 0.06);
  colours.top = itemCol(wear.top, 0, [62, 143, 176]);
  colours.pants = itemCol(wear.bottom, 0, [70, 84, 112]);
  colours.shoe = itemCol(wear.shoes, 0, [60, 50, 50]);
  colours.sole = /sneakers|runners|hightops/.test(wear.shoes || 'sneakers')
    ? itemCol(wear.shoes, 1, [240, 236, 226])
    : figureDark(colours.shoe, 0.55);
  colours.top2 = itemCol(wear.top, 1, figureMix(colours.top, [250, 248, 240], 0.75));
  colours.pants2 = itemCol(wear.bottom, 1, figureDark(colours.pants, 0.7));
  colours.belt = [74, 50, 38];
  colours.button = [232, 206, 120];
  colours.eye = KIT_INK;
  colours.iris = kitHex(look.eyes, [74, 123, 187]);
  colours.glint = [250, 250, 245];
  colours.mouth = [140, 62, 70];
  colours.teeth = [246, 242, 232];
  colours.brow = figureDark(colours.hair, 0.62);
  colours.stubble = figureMix(colours.skin, colours.hair, 0.45);
  colours.freckle = figureDark(colours.skin, 0.72);
  colours.nose = figureMix(colours.skin, [150, 80, 70], 0.3);
  colours.sclera = figureMix([250, 248, 244], colours.skin, 0.12);
  colours.lash = figureMix(KIT_INK, colours.hair, 0.25);
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
        tw(0.165) * (0.6 + 0.4 * hipK) * waist + belly * 0.03,
        tw(0.172) * (0.8 + 0.2 * shK) + belly * 0.04 + chest * 0.01,
        tw(0.15) * shK,
        tw(0.1) * shK,
        0,
      ],
      rz: [
        0,
        tw(0.08),
        tw(0.12) * waist + belly * 0.05,
        tw(0.125) + chest * 0.035 + belly * 0.04 + chestOut * 0.02,
        tw(0.108) + chest * 0.03 + chestOut * 0.025,
        tw(0.075),
        0,
      ],
      seg: 16,
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
  /* the head (KIT_CHIBI.head, a direction's own): room for the face, hair and expressions, and the portraits'
     close-ups; it grows a little with the body too, so a small figure is smaller all over and a tall one taller.
     One sculpted mesh (logic/figure-pose.js headDeform): the skull, the jaw line, the chin, cheekbones, the brow and
     the eye sockets by the head shape, a little of each person's own on top; the nose and ears as parts on it */
  const hk3 = headK * PR.head * Math.sqrt(hk),
    /* each person a little wider or narrower, longer or shorter, deeper or flatter than their head shape */
    hr = /** @type {Vec3} */ ([
      0.31 * hk3 * HD.r[0] * (0.95 + 0.1 * kitRnd(seed, 17)),
      0.3 * hk3 * HD.r[1] * (0.95 + 0.1 * kitRnd(seed, 18)),
      0.29 * hk3 * HD.r[2] * (0.96 + 0.08 * kitRnd(seed, 19)),
    ]),
    deform = {
      jaw: HD.jaw + 0.16 * (kitRnd(seed, 15) - 0.5) - (shape.build === 'round' ? 0.25 : 0),
      chin: HD.chin * (0.85 + 0.3 * kitRnd(seed, 13)),
      cheek: HD.cheek * (0.85 + 0.3 * kitRnd(seed, 14)),
      crown: HD.crown,
      brow: 0.8 + 0.4 * kitRnd(seed, 16),
      face: HD.face + 0.3 * (kitRnd(seed, 20) - 0.5),
    },
    head = /** @type {{ kind: 'ellipsoid', c: Vec3, r: Vec3, seg: number, rings: number, deform: typeof deform }} */ ({
      kind: 'ellipsoid',
      c: [0, hr[1] + 0.005, 0.01],
      r: hr,
      seg: 30,
      rings: 22,
      deform,
    });
  /* a neck, longer on a beanpole, all but gone on a kid */
  add(
    'neck',
    'torso',
    [0, 0.34 * tk, 0],
    { kind: 'capsule', a: [0, 0, 0], b: [0, 0.06 * tk + neckL, 0], r0: 0.048 * Math.sqrt(girth), r1: 0.044, seg: 10 },
    'skin'
  );
  add('head', 'torso', [0, 0.4 * tk + neckL, 0], head, 'skin');
  const c1 = head.c[1],
    c2 = head.c[2],
    hk1 = hr[0] / 0.31,
    /* each person's own nose, from their seed */
    noseK = 0.85 + 0.4 * kitRnd(seed, 11),
    noseLong = kitRnd(seed, 12),
    /** the face's surface straight ahead at height v (-1..1) on the head @param {number} v */
    faceZ = v => c2 + hr[2] * headDeform([0, v, Math.sqrt(Math.max(0, 1 - v * v))], deform)[2];
  /** a form on the head @param {string} id @param {Vec3} cc @param {Vec3} rr @param {Partial<FigureShape>} [o] */
  const form = (id, cc, rr, o = {}, col = 'skin') =>
    add(
      id,
      'head',
      [0, 0, 0],
      /** @type {FigureShape} */ ({ kind: 'ellipsoid', c: cc, r: rr, seg: 14, rings: 9, ...o }),
      col
    );
  /* the nose: a bridge down from the brow, its tip and its wings, of the person's kind: a short upturned button, a
     straight one, a long one with a bump on its bridge, or a broad one */
  const noseKind = Math.floor(kitRnd(seed, 21) * 4) % 4,
    tipV = -(noseKind === 0 ? 0.26 : noseKind === 2 ? 0.4 : 0.3 + 0.08 * noseLong),
    nTip = /** @type {Vec3} */ ([
      0,
      c1 + hr[1] * tipV + (noseKind === 0 ? 0.008 * hk1 : 0),
      faceZ(tipV) + (noseKind === 0 ? 0.022 : noseKind === 2 ? 0.04 : 0.03) * hk1 * noseK,
    ]),
    wingK = noseKind === 3 ? 1.45 : 1;
  if (noseKind === 2)
    form('nbump', [0, c1 - hr[1] * 0.16, faceZ(-0.16) + 0.012 * hk1], [0.014 * hk1, 0.022 * hk1, 0.014 * hk1], {
      seg: 8,
      rings: 5,
    });
  add(
    'nose',
    'head',
    [0, 0, 0],
    {
      kind: 'capsule',
      a: [0, c1 - hr[1] * 0.04, faceZ(-0.04) - 0.004],
      b: nTip,
      r0: 0.011 * hk1,
      r1: 0.019 * hk1 * noseK,
      seg: 8,
    },
    'skin'
  );
  form('ntip', nTip, [0.024 * hk1 * noseK, 0.022 * hk1 * noseK, 0.022 * hk1 * noseK], { seg: 10, rings: 6 });
  for (const s of [1, -1])
    form(
      'nwing' + (s > 0 ? 'A' : 'B'),
      [s * 0.022 * hk1 * noseK * wingK, nTip[1] - 0.006 * hk1, nTip[2] - 0.016 * hk1],
      [0.015 * hk1 * noseK * wingK, 0.013 * hk1, 0.015 * hk1],
      { seg: 8, rings: 5 }
    );
  /* ears, just showing past the hair: the ear and its inner fold, bigger or smaller by the person */
  const earK = 0.85 + 0.35 * kitRnd(seed, 22);
  for (const s of [1, -1]) {
    const e = s > 0 ? 'A' : 'B';
    form(
      'ear' + e,
      [s * hr[0] * 0.88, c1 - hr[1] * 0.1, c2 - hr[2] * 0.08],
      [0.03 * hk1 * earK, 0.06 * hk1 * earK, 0.044 * hk1],
      {
        seg: 8,
        rings: 6,
      }
    );
    form(
      'earin' + e,
      [s * hr[0] * 0.92, c1 - hr[1] * 0.12, c2 - hr[2] * 0.05],
      [0.012 * hk1, 0.033 * hk1, 0.022 * hk1],
      { seg: 6, rings: 4 },
      'nose'
    );
  }
  /* the shoulders' slope up to the neck (the trapezius), so the head sits on a body, not a peg */
  add(
    'traps',
    'torso',
    [0, 0.36 * tk, -0.012],
    {
      kind: 'ellipsoid',
      c: [0, 0, 0],
      r: [0.12 * shK * Math.sqrt(girth), 0.045, 0.075 * Math.sqrt(girth)],
      seg: 12,
      rings: 6,
    },
    wear.outer && wear.outer !== 'apron' ? 'outer' : KIT_SLEEVELESS.has(wear.top || '') ? 'skin' : 'top'
  );
  /* ---- arms, sleeves by the top and the jacket ---- */
  const outer = wear.outer || null,
    sleeved = outer && outer !== 'apron',
    upperCol = sleeved ? 'outer' : KIT_SLEEVELESS.has(wear.top || '') ? 'skin' : 'top',
    lowerCol = sleeved ? 'outer' : KIT_LONG_SLEEVES.has(wear.top || '') ? 'top' : 'skin',
    puff = outer === 'puffer' ? 1.3 : sleeved ? 1.08 : 1,
    armR = 0.058 * Math.sqrt(girth) * Math.pow(shK, 0.7) * puff;
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
    if (lowerCol !== 'skin')
      add(
        'cuff' + k,
        'forearm' + k,
        [0, -foreL + 0.005, 0],
        { kind: 'torus', c: [0, 0, 0], R: [armR * 0.82, armR * 0.82], r: 0.014, seg: 10, rings: 4 },
        lowerCol
      );
    add(
      'hand' + k,
      'forearm' + k,
      [0, -foreL - 0.01, 0],
      { kind: 'ellipsoid', c: [0, -0.045, 0.008], r: [0.06, 0.07, 0.058], seg: 12, rings: 8, sq: 0.25 },
      'skin'
    );
    /* a thumb, forward and in, so a hand reads as a hand */
    add(
      'thumb' + k,
      'hand' + k,
      [0, 0, 0],
      { kind: 'ellipsoid', c: [-s * 0.035, -0.035, 0.045], r: [0.022, 0.038, 0.022], seg: 8, rings: 5 },
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
    /* a sole under every shoe: white on trainers, dark on boots and smart shoes, the strap's colour on sandals */
    add(
      'sole' + k,
      'foot' + k,
      [0, -0.06, 0],
      { kind: 'ellipsoid', c: [0, 0, 0.042 * long], r: [0.078, 0.016, 0.112 * long], seg: 12, rings: 4 },
      shoes === 'sandals' ? 'shoe' : 'sole'
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
        r: [(R ? R.rx[3] : 0.17) * 0.8, 0.28 * tk, 0.035],
        seg: 10,
        rings: 6,
        sq: 0.8,
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
    colours.bag2 = itemCol(bag, 1, figureDark(colours.bag, 0.7));
    if (bag === 'backpack') {
      add(
        'pack',
        'torso',
        [0, 0.2 * tk, -torsoZ - 0.055],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.13 * Math.sqrt(girth), 0.15 * tk, 0.07], seg: 10, rings: 6, sq: 0.9 },
        'bag'
      );
      add(
        'flap',
        'pack',
        [0, 0.07 * tk, -0.045],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.12 * Math.sqrt(girth), 0.07 * tk, 0.04], seg: 10, rings: 5, sq: 0.8 },
        'bag2'
      );
      for (const s of [1, -1])
        add(
          'strap' + (s > 0 ? 'A' : 'B'),
          'torso',
          [s * 0.09 * Math.sqrt(girth), 0.36 * tk, 0],
          { kind: 'torus', c: [0, -0.1 * tk, 0], R: [0.03, torsoZ + 0.012], r: 0.014, seg: 10, rings: 4 },
          'bag2'
        );
    } else if (bag === 'satchel') {
      add(
        'satchel',
        'hips',
        [-0.17 * girth * hipK - 0.02, 0.0, 0.02],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.04, 0.08, 0.11], seg: 8, rings: 5, sq: 0.6 },
        'bag'
      );
      add(
        'sling',
        'torso',
        [0, 0.12 * tk, 0],
        { kind: 'torus', c: [0, 0, 0], R: [0.19 * girth, torsoZ + 0.015], r: 0.013, seg: 14, rings: 4 },
        'bag2'
      );
    } else
      add(
        'fanny',
        'hips',
        [0, 0.05, 0.105 * girth + 0.02],
        { kind: 'ellipsoid', c: [0, 0, 0], r: [0.09, 0.045, 0.04], seg: 8, rings: 5, sq: 0.4 },
        'bag'
      );
  }
  /* ---- the details that make clothes read at 48 px a metre ---- */
  const R4 = torso.kind === 'lathe' ? torso : null,
    zAt = (/** @type {number} */ i) => (R4 ? R4.rz[i] : 0.12),
    xAt = (/** @type {number} */ i) => (R4 ? R4.rx[i] : 0.16),
    top = wear.top || 'tee';
  /** @param {string} kind @param {string} part @param {Vec3} at @param {number} w @param {number} h @param {string} col */
  const cloth = (kind, part, at, w, h, col) => clothMarks.push({ part, kind, at, n: [0, 0, 1], w, h, col, min: 0.35 });
  /** @type {FaceMark[]} */
  const clothMarks = [];
  /* a collar: a ring at the neck, flaps on a polo or a shirt */
  if (!outer || outer === 'apron')
    add(
      'collar',
      'torso',
      [0, 0.37 * tk, 0.005],
      {
        kind: 'torus',
        c: [0, 0, 0],
        R: [0.062 * Math.sqrt(girth), 0.055 * Math.sqrt(girth)],
        r: 0.018,
        seg: 12,
        rings: 4,
      },
      top === 'tank' || top === 'crop' ? 'top' : 'top2'
    );
  if (top === 'polo' || top === 'dress_shirt')
    for (const s of [1, -1])
      add(
        'flap' + (s > 0 ? 'A' : 'B'),
        'torso',
        [s * 0.04, 0.37 * tk, zAt(4) * 0.55],
        { kind: 'ellipsoid', c: [0, -0.015, 0], r: [0.045, 0.028, 0.03], seg: 8, rings: 4, sq: 0.5 },
        'top2'
      );
  if (top === 'tee_stripe') {
    const T = parts.find(q => q.id === 'torso');
    if (T) T.stripe = { col: 'top2', every: 0.045, from: 0 };
  }
  if (top === 'polo' || top === 'dress_shirt')
    for (let i = 0; i < (top === 'polo' ? 2 : 4); i++)
      cloth('button', 'torso', [0, (0.31 - i * 0.07) * tk, zAt(3) + 0.01], 0.02, 0.02, 'button');
  /* an open jacket or coat shows the top down its front, with buttons along one edge; a puffer is quilted, a track
     top zipped */
  if (outer && (KIT_JACKETS.has(outer) || KIT_LONG_COATS.has(outer)) && outer !== 'puffer' && outer !== 'track_top') {
    const z = zAt(3) * (KIT_LONG_COATS.has(outer) ? 1.02 : 1.07) + 0.013;
    add(
      'front',
      'torso',
      [0, 0.2 * tk, z],
      { kind: 'ellipsoid', c: [0, 0, 0], r: [xAt(3) * 0.3, 0.17 * tk, 0.02], seg: 10, rings: 6, sq: 0.6, taper: 0.3 },
      'top'
    );
    for (let i = 0; i < 3; i++)
      cloth('button', 'torso', [xAt(3) * 0.42, (0.22 - i * 0.08) * tk, z], 0.022, 0.022, 'button');
    if (outer === 'labcoat')
      for (const s of [1, -1])
        cloth('pocket', 'torso', [s * xAt(2) * 0.7, -0.02 * tk, zAt(2) + 0.02], 0.07, 0.05, 'outer2');
  }
  if (outer === 'puffer') {
    const J = parts.find(q => q.id === 'jacket');
    if (J) J.stripe = { col: 'outer2', every: 0.05, from: 0.02 };
  }
  if (outer === 'track_top') cloth('zip', 'torso', [0, 0.2 * tk, zAt(3) * 1.07 + 0.012], 0.018, 0.26 * tk, 'outer2');
  if (outer) colours.outer2 = itemCol(outer, 1, figureDark(colours.outer, 0.78));
  /* a belt and its buckle on trousers, jeans and shorts */
  if (!skirt && !legging && bottom !== 'track_pants' && !KIT_LONG_COATS.has(outer || '')) {
    add(
      'belt',
      'hips',
      [0, 0.085, 0],
      { kind: 'torus', c: [0, 0, 0], R: [0.15 * girth * hipK, 0.107 * girth], r: 0.02, seg: 16, rings: 4 },
      'belt'
    );
    cloth('buckle', 'hips', [0, 0.085, 0.107 * girth + 0.02], 0.04, 0.03, 'button');
  }
  /* pockets on cargo and work trousers; a stripe down a track suit's legs */
  if (bottom === 'cargo' || bottom === 'work_pants')
    for (const k of ['A', 'B']) cloth('pocket', 'thigh' + k, [0, -thighL * 0.55, legR * 1.02], 0.06, 0.06, 'pants2');
  if (bottom === 'track_pants')
    for (const [k, s] of /** @type {[string, number][]} */ ([
      ['A', 1],
      ['B', -1],
    ])) {
      add(
        'tstripe' + k,
        'thigh' + k,
        [s * legR * 0.98, 0, 0],
        { kind: 'capsule', a: [0, -0.01, 0], b: [0, -thighL, 0], r0: 0.013, r1: 0.013, seg: 6 },
        'pants2'
      );
      add(
        'sstripe' + k,
        'shin' + k,
        [s * legR * 0.88, 0, 0],
        { kind: 'capsule', a: [0, 0, 0], b: [0, -shinL * 0.9, 0], r0: 0.012, r1: 0.012, seg: 6 },
        'pants2'
      );
    }
  /* ---- hair and hats ---- */
  const hat = wear.hat || null;
  if (hat) colours.hat = itemCol(hat, 0, [217, 67, 75]);
  if (hat) colours.hat2 = itemCol(hat, 1, colours.hat);
  /* a fringe shows under a cap or a beanie, not under a brim */
  const FL = opts.flair || {};
  kitHair(
    add,
    wear.hair || null,
    head,
    !!hat,
    seed,
    !!hat && hat !== 'hat_cap' && hat !== 'hat_beanie',
    hat ? 1 : FL.hair || 1
  );
  /* CH-3b's hybrid variants may redesign (the owner: "you don't have to base them on their original sprites"): a scarf
     with a tail that streams behind, a cape from the shoulders */
  if (FL.scarf || FL.cape)
    colours.flair = Array.isArray(FL.col)
      ? [FL.col[0], FL.col[1], FL.col[2]]
      : figureMix(colours.top, [196, 64, 72], 0.6);
  if (FL.scarf && !wear.neck) {
    add(
      'fscarf',
      'torso',
      [0, 0.36 * tk, 0],
      {
        kind: 'torus',
        c: [0, 0, 0.005],
        R: [0.11 * Math.sqrt(girth), 0.095 * Math.sqrt(girth)],
        r: 0.048,
        seg: 14,
        rings: 7,
      },
      'flair'
    );
    add(
      'ftail',
      'torso',
      [0.06, 0.35 * tk, -0.08],
      {
        kind: 'tube',
        a: [0, 0, 0],
        ctrl: [0.12, -0.05, -0.16],
        b: [0.2, -0.26 * tk, -0.2],
        r0: 0.05,
        r1: 0.035,
        flat: 0.35,
        n: [0, 0, -1],
        seg: 8,
        steps: 7,
      },
      'flair'
    );
  }
  if (FL.cape)
    add(
      'cape',
      'torso',
      [0, 0.36 * tk, -zAt(4) - 0.02],
      {
        kind: 'tube',
        a: [0, 0, 0],
        ctrl: [0, -0.2 * tk, -0.1],
        b: [0, -0.36 * tk - thighL * 0.85, -0.06],
        r0: xAt(4) * 1.05,
        r1: xAt(3) * 1.5,
        flat: 0.16,
        n: [0, 0, -1],
        seg: 10,
        steps: 8,
      },
      'flair'
    );
  /* CH-3b's gouache night: the detail pass (flair.detail) and a character's own design (flair: goggles, fur, earrings,
     gloves, an antenna lock) */
  if (FL.detail) {
    colours.leather = [92, 58, 46];
    colours.gold = [232, 190, 84];
    /* lapels down an open jacket or coat */
    if (outer && (KIT_JACKETS.has(outer) || KIT_LONG_COATS.has(outer)) && outer !== 'puffer' && outer !== 'track_top')
      for (const s of [1, -1])
        add(
          'lapel' + (s > 0 ? 'A' : 'B'),
          'torso',
          [0, 0, 0],
          {
            kind: 'tube',
            a: [s * xAt(4) * 0.3, 0.38 * tk, zAt(4) * 1.05],
            ctrl: [s * xAt(3) * 0.62, 0.3 * tk, zAt(3) * 1.18],
            b: [s * xAt(3) * 0.3, 0.12 * tk, zAt(3) * 1.12],
            r0: 0.035,
            r1: 0.012,
            flat: 0.3,
            n: [0, 0, 1],
            seg: 7,
            steps: 6,
          },
          'outer2'
        );
    /* a long coat's tails, split behind */
    if (outer && KIT_LONG_COATS.has(outer))
      for (const s of [1, -1])
        add(
          'tail' + (s > 0 ? 'A' : 'B'),
          'hips',
          [s * 0.07, 0.02, -0.11 * girth],
          {
            kind: 'tube',
            a: [0, 0, 0],
            ctrl: [s * 0.05, -thighL * 0.5, -0.07],
            b: [s * 0.09, -thighL * 1.05, -0.04],
            r0: 0.07,
            r1: 0.1,
            flat: 0.22,
            n: [0, 0, -1],
            seg: 8,
            steps: 6,
          },
          'outer'
        );
    /* pouches on the belt */
    if (parts.some(q => q.id === 'belt'))
      for (const s of [1, -1])
        if (kitRnd(seed, 200 + s) < 0.7)
          add(
            'pouch' + (s > 0 ? 'A' : 'B'),
            'hips',
            [s * 0.14 * girth * hipK, 0.05, 0.05 * girth],
            { kind: 'ellipsoid', c: [0, -0.02, 0], r: [0.032, 0.045, 0.035], seg: 8, rings: 5, sq: 0.8 },
            'leather'
          );
    /* cuffs on boots and high tops */
    for (const k of ['A', 'B'])
      if (parts.some(q => q.id === 'boot' + k))
        add(
          'bcuff' + k,
          'shin' + k,
          [0, -shinL * 0.55, 0],
          { kind: 'torus', c: [0, 0, 0], R: [legR * 1.05, legR * 1.05], r: 0.02, seg: 10, rings: 4 },
          'sole'
        );
  }
  if (FL.gloves) {
    colours.glove = FL.gloveCol ? [FL.gloveCol[0], FL.gloveCol[1], FL.gloveCol[2]] : [52, 40, 64];
    for (const q of parts) if (/^(hand|thumb)[AB]$/.test(q.id)) q.col = 'glove';
  }
  /* goggles go round the head, not over a hat */
  if (FL.goggles && !hat) {
    colours.gear = colours.gear || [52, 44, 60];
    colours.lensG = [104, 226, 236];
    /* round the cranium, or round a hat's crown */
    const gy = c1 + hr[1] * (hat ? 0.34 : 0.42),
      gz = c2 - hr[2] * 0.06,
      gR = /** @type {[number, number]} */ (hat ? [hr[0] * 1.14, hr[2] * 1.2] : [hr[0] * 1.06, hr[2] * 1.1]);
    add('gband', 'head', [0, 0, 0], { kind: 'torus', c: [0, gy, gz], R: gR, r: 0.02, seg: 18, rings: 4 }, 'gear');
    for (const s of [1, -1])
      add(
        'goggle' + (s > 0 ? 'A' : 'B'),
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [s * hr[0] * 0.36, gy + 0.01, gz + gR[1] * 0.93],
          r: [0.055 * (hr[0] / 0.31), 0.045 * (hr[0] / 0.31), 0.032],
          seg: 12,
          rings: 6,
        },
        'lensG'
      );
    FL.glossy = true;
  }
  if (FL.fur) {
    colours.fur = [238, 228, 208];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      add(
        'fur' + i,
        'torso',
        [0, 0.36 * tk, 0],
        {
          kind: 'ellipsoid',
          c: [Math.sin(a) * 0.13 * Math.sqrt(girth), 0, Math.cos(a) * 0.11 * Math.sqrt(girth)],
          r: [0.07, 0.055, 0.07],
          seg: 9,
          rings: 5,
        },
        'fur'
      );
    }
  }
  if (FL.earrings)
    for (const s of [1, -1])
      add(
        'ring' + (s > 0 ? 'A' : 'B'),
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [s * hr[0] * 0.98, c1 - hr[1] * 0.28, 0],
          r: [0.02, 0.028, 0.02],
          seg: 8,
          rings: 5,
        },
        'gold'
      );
  if (FL.earrings || FL.detail) colours.gold = [232, 190, 84];
  /* an antenna lock standing up off the crown */
  if (FL.ahoge && !hat)
    add(
      'ahoge',
      'head',
      [0, 0, 0],
      {
        kind: 'tube',
        a: [0, c1 + hr[1] * 0.98, -0.02],
        ctrl: [0.06, c1 + hr[1] * 1.5, 0.04],
        b: [0.14, c1 + hr[1] * 1.35, 0.1],
        r0: 0.03 * (hr[0] / 0.31),
        r1: 0.004,
        flat: 0.5,
        n: [0, 0, 1],
        seg: 7,
        steps: 7,
      },
      'hair'
    );
  if (hat) kitHat(add, hat, head, HD.crown * 1.06);
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
  /* a beard: a shell over the jaw and chin (the head's own sculpted shape, a little out), cut below the cheeks and
     round under the ears; so it follows a V jaw or a square one */
  if (wear.facial === 'facial_beard')
    add(
      'beard',
      'head',
      [0, 0, 0],
      {
        kind: 'ellipsoid',
        c: [head.c[0], head.c[1] - 0.004, head.c[2] + 0.006],
        r: [hr[0] * 1.06, hr[1] * 1.04, hr[2] * 1.06],
        seg: 24,
        rings: 16,
        deform: { ...deform, skull: true },
        cut: { front: -0.42, side: -0.2, back: -1.5, under: true },
      },
      'hair'
    );
  /* ---- the face ---- */
  const face = [...clothMarks, ...kitFaceMarks(head, wear, look, colours, seed)];
  if (wear.neck === 'nametag') {
    colours.tag = [246, 244, 236];
    const R = torso.kind === 'lathe' ? torso : null,
      zT = R ? R.rz[3] : 0.12;
    face.push({ part: 'torso', kind: 'tag', at: [0.07, 0.24 * tk, zT + 0.01], n: [0, 0, 1], w: 0.06, h: 0.035 });
  }
  const gait = { ...BD.gait, ...((opts.figure && opts.figure.gait) || {}) };
  const tallest = parts.reduce((m, p) => Math.max(m, kitTopOf(p, parts)), 0);
  return {
    name: opts.name || 'person',
    height: Math.max(0.6, tallest),
    parts,
    face,
    colours,
    gait,
    /* where a portrait's cut is (figures.js figurePortrait), metres from the ground: just under the shoulders */
    kit: { ...shape, bust: Math.round((hipY + 0.1 + 0.22 * tk) * 100) / 100 },
    gloss: ['hair', 'hair2', 'shoe', 'sole', 'gear', 'belt', 'lensG', 'gold', 'leather', 'glove'],
  };
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
  if (s.kind === 'tube') return y + Math.max(s.a[1] + s.r0, s.ctrl[1], s.b[1] + s.r1);
  return y + Math.max(s.a[1] + s.r0, s.b[1] + s.r1);
}

/**
 * the hair's parts on the head (CH-3b's fidelity pass: "hair should read well as hair"): a close cap under it, then
 * locks, each a tapered, curved, flattened stroke (logic/figure-pose.js tube) that bulges off the head and ends in a
 * point, so the hair reads as clumps with lines between them (the outline pass inks where one stands in front of
 * another) and catches the shine band lock by lock. By style:
 * - short: locks from the crown swept down and back to the nape, a fringe of points over the brow, locks over the ears;
 * - buzz: the cap and a few short locks;
 * - sidepart: the fringe swept to one side from the part, the rest short;
 * - bob: a fringe, and locks falling to the jaw all round;
 * - long: a fringe, locks over the shoulders and down the back;
 * - spiky: locks standing up and out from the crown, a ragged fringe;
 * - curly: many short locks curled back on themselves;
 * - bun, pony, twin: locks swept to where the hair is tied, then a bun, a tail or two tails.
 * Under a hat, only what shows below it: a cap or a beanie keeps a fringe, a brim none.
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string | null} style @param {{ c: Vec3, r: Vec3, sq?: number, taper?: number, deform?: import('./figure-pose.js').HeadDeform }} H the head
 * @param {boolean} hat @param {number} seed @param {boolean} [brim] under a brimmed hat (no fringe)
 * @param {number} [vol] the locks' thickness and bow times this (a hybrid variant's fuller hair)
 */
export function kitHair(add, style, H, hat, seed, brim = false, vol = 1) {
  if (!style) return;
  const { c, r } = H,
    S = (r[0] / 0.31) * vol,
    deg = Math.PI / 180,
    /** a point on the hair's surface: around the head (`th`, 0 the front, +90 the figure's +x side), up it (`ph`,
     * 90 the crown), `k` times out from the head's middle
     * @param {number} th @param {number} ph @param {number} [k] @returns {Vec3} */
    P = (th, ph, k = 1.06) =>
      /** @type {Vec3} */ ([
        Math.sin(th * deg) * Math.cos(ph * deg) * r[0] * k,
        c[1] + Math.sin(ph * deg) * r[1] * k,
        c[2] + Math.cos(th * deg) * Math.cos(ph * deg) * r[2] * k,
      ]),
    /** the way out from the head's middle at a point @param {Vec3} q @returns {Vec3} */
    out = q => figureUnit([q[0] / r[0], (q[1] - c[1]) / r[1], (q[2] - c[2]) / r[2]]);
  let n = 0;
  /** a lock from `a` to `b`, bowing out by `bow` (metres) off the head, `w` thick at its root
   * @param {Vec3} a @param {Vec3} b @param {number} bow @param {number} w @param {number} [tip] @param {number} [flat] */
  const lock = (a, b, bow, w, tip = 0.15, flat = 0.5) => {
    const m = /** @type {Vec3} */ ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]),
      o = out(m),
      ctrl = /** @type {Vec3} */ ([m[0] + o[0] * bow, m[1] + o[1] * bow, m[2] + o[2] * bow]);
    /* every other lock a shade darker, so locks read apart even in pale hair */
    add(
      'lock' + n,
      'head',
      [0, 0, 0],
      { kind: 'tube', a, ctrl, b, r0: w * S, r1: w * S * tip, flat, n: out(a), seg: 7, steps: 7 },
      n++ % 2 ? 'hair2' : 'hair'
    );
  };
  const j = (/** @type {number} */ i, /** @type {number} */ amt) => (kitRnd(seed, 80 + i) - 0.5) * amt;
  /* the cap: close to the head, cut at the style's hairline */
  /* the cap sits just under the locks, so the locks are the hair's surface */
  const capK = hat ? 1.0 : style === 'hair_buzz' ? 1.03 : 1.025,
    cut =
      style === 'hair_buzz'
        ? { front: 0.42, side: 0.1, back: -0.2 }
        : style === 'hair_bob' || style === 'hair_long'
          ? { front: 0.3, side: -0.5, back: -0.8 }
          : { front: 0.32, side: -0.15, back: -0.5 };
  add(
    'hair',
    'head',
    [0, 0, 0],
    {
      kind: 'ellipsoid',
      c: [c[0], c[1] + r[1] * 0.03, c[2] - 0.004],
      r: [r[0] * capK, r[1] * capK, r[2] * capK],
      seg: 24,
      rings: 16,
      sq: H.sq,
      taper: H.taper,
      /* over a sculpted head, its skull's shape (no features) */
      ...(H.deform ? { deform: { ...H.deform, skull: true } } : {}),
      cut,
    },
    'hair'
  );
  const fringeOK = !brim;
  /* the fringe: points from high on the brow curving down and out over the forehead */
  const fringe = (
    /** @type {number} */ count,
    /** @type {number} */ spread,
    /** @type {number} */ to = 18,
    swept = 0
  ) => {
    if (!fringeOK) return;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5,
        th = t * spread + j(i, 8),
        /* under a hat the fringe starts just under its band and only its ends show */
        a = P(th * 0.4 + swept * 0.5, hat ? 10 : 72, hat ? 0.97 : 1.06),
        b = P(th + swept + j(i + 20, 6), (hat ? to - 22 : to) + j(i + 40, 10), hat ? 1.04 : 1.1);
      lock(a, b, (hat ? 0 : 0.065) * S, 0.072, 0.12, 0.45);
    }
  };
  /* a ring of locks from the crown down to `ph` (degrees up the head; below -90 runs on down the back), skipping the
     face */
  const crown = (
    /** @type {number} */ count,
    /** @type {number} */ ph,
    /** @type {number} */ bow,
    face = 55,
    w = 0.088
  ) => {
    count = Math.round(count * 1.4);
    for (let i = 0; i < count; i++) {
      const th = face + ((360 - 2 * face) * (i + 0.5)) / count + j(i + 60, 10),
        a = P(th * 0.3, 84 + j(i + 70, 4), 1.0),
        b =
          ph < -90
            ? [P(th, -60)[0] * 0.9, c[1] - r[1] * (1 + (-90 - ph) / 45), P(th, -60)[2] - r[2] * 0.3]
            : P(th, ph + j(i + 90, 8), 1.08);
      lock(a, /** @type {Vec3} */ (b), bow * 1.35 * S, w, 0.12, 0.5);
    }
  };
  /* locks over each ear down to `ph` */
  const sides = (/** @type {number} */ ph, /** @type {number} */ per = 2) => {
    for (const sgn of [1, -1])
      for (let i = 0; i < per; i++) {
        const th = sgn * (70 + i * 18);
        lock(
          /* under a hat every lock starts under its band, so none comes out through its crown */
          P(th * 0.6, hat ? 8 : 70, hat ? 0.98 : 1.06),
          P(th + sgn * 6, ph + j(i + (sgn > 0 ? 100 : 110), 8), 1.1),
          (hat ? 0 : 0.05) * S,
          0.065,
          0.15,
          0.5
        );
      }
  };
  /* everything swept to a point (a bun, a ponytail's tie) */
  const swept = (/** @type {Vec3} */ to, /** @type {number} */ count) => {
    for (let i = 0; i < count; i++) {
      const th = (360 * (i + 0.5)) / count + j(i + 120, 10);
      if (Math.abs(((th + 180) % 360) - 180) < 40) continue;
      lock(P(th, 20, 1.04), to, 0.04 * S, 0.06, 0.3, 0.45);
    }
  };
  /* long flowing hair (the owner: "Give the girl long flowing hair"): locks from all round the back and sides falling
     past the shoulders in two waving lengths, flaring out a little, and a lock each side down in front of the
     shoulders */
  const flowing = (/** @type {number} */ from) => {
    const N = 11;
    for (let i = 0; i < N; i++) {
      const th = 100 + (160 * i) / (N - 1) + j(i + 170, 6),
        sn = Math.sin(th * deg),
        cs = Math.cos(th * deg),
        /* layered: longest down the middle of the back, shorter toward the sides, each lock its own length */
        len = 1.75 + 0.45 * Math.max(0, -cs) + 0.25 * kitRnd(seed, 180 + i),
        wave = (i % 2 ? 1 : -1) * 0.045 * S,
        a = P(th, from, 1.03),
        m = /** @type {Vec3} */ ([sn * r[0] * 1.2, c[1] - r[1] * 1.05, c[2] + cs * r[2] * 1.22]),
        b = /** @type {Vec3} */ ([
          sn * r[0] * (1.12 + 0.12 * kitRnd(seed, 190 + i)),
          c[1] - r[1] * len,
          c[2] + cs * r[2] * 1.18 - 0.03,
        ]),
        mid = (/** @type {Vec3} */ p, /** @type {Vec3} */ q) =>
          /** @type {Vec3} */ ([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
      const up = mid(a, m),
        o1 = out(up),
        k = n++ % 2 ? 'hair2' : 'hair';
      add(
        'lock' + n,
        'head',
        [0, 0, 0],
        {
          kind: 'tube',
          a,
          ctrl: [up[0] + o1[0] * 0.05 * S, up[1] + o1[1] * 0.05 * S, up[2] + o1[2] * 0.05 * S],
          b: m,
          r0: 0.09 * S,
          r1: 0.07 * S,
          flat: 0.45,
          n: out(a),
          seg: 7,
          steps: 6,
        },
        k
      );
      const lo = mid(m, b);
      add(
        'lock' + n++,
        'head',
        [0, 0, 0],
        {
          kind: 'tube',
          a: m,
          ctrl: [lo[0] + sn * wave, lo[1], lo[2] + cs * wave + wave * 0.5],
          b,
          r0: 0.07 * S,
          r1: 0.004 * S,
          flat: 0.45,
          n: [sn, 0, cs],
          seg: 7,
          steps: 8,
        },
        k
      );
    }
    for (const sgn of [1, -1]) {
      const a = P(sgn * 72, from - 10, 1.04),
        b = /** @type {Vec3} */ ([sgn * r[0] * 0.92, c[1] - r[1] * 2.2, c[2] + r[2] * 0.42]);
      lock(a, [sgn * r[0] * 1.08, c[1] - r[1] * 0.9, c[2] + r[2] * 0.2], 0.03 * S, 0.075, 0.6, 0.5);
      lock([sgn * r[0] * 1.08, c[1] - r[1] * 0.9, c[2] + r[2] * 0.2], b, 0.04 * S, 0.06, 0.15, 0.5);
    }
  };
  const tail = (
    /** @type {string} */ id,
    /** @type {Vec3} */ a,
    /** @type {Vec3} */ ctrl,
    /** @type {Vec3} */ b,
    /** @type {number} */ w
  ) =>
    add(
      id,
      'head',
      [0, 0, 0],
      { kind: 'tube', a, ctrl, b, r0: w * S, r1: w * S * 0.25, flat: 0.75, n: [0, 0, -1], seg: 8, steps: 8 },
      'hair'
    );
  if (hat) {
    /* under a hat: a fringe (not under a brim) and locks over the ears */
    if (style !== 'hair_buzz') {
      fringe(style === 'hair_bob' ? 5 : 4, 70);
      if (style !== 'hair_long') sides(style === 'hair_bob' ? -60 : -20);
    }
    if (style === 'hair_long') flowing(6);
    if (style === 'hair_pony')
      tail('pony', P(180, 0, 1.0), P(180, -40, 1.5), [0, c[1] - r[1] * 1.3, c[2] - r[2] * 1.2], 0.08);
    return;
  }
  switch (style) {
    case 'hair_buzz':
      crown(8, 20, 0.01, 50, 0.05);
      break;
    case 'hair_sidepart': {
      const side = kitRnd(seed, 5) < 0.5 ? 1 : -1;
      crown(10, -25, 0.045);
      fringe(5, 60, 30, side * 35);
      sides(-25);
      break;
    }
    case 'hair_bob':
      crown(10, -55, 0.05);
      fringe(6, 90, 14);
      sides(-60, 3);
      break;
    case 'hair_long':
      crown(10, -45, 0.05);
      fringe(5, 80, 14);
      flowing(40);
      break;
    case 'hair_spiky': {
      /* standing up and out from the crown, tips well off the head */
      for (let i = 0; i < 9; i++) {
        const th = -100 + (200 * i) / 8 + 180 + j(i + 130, 12),
          a = P(th * 0.2, 75, 1.0),
          b = P(th, 35 + j(i + 140, 20), 1.55 + j(i + 150, 0.3));
        lock(a, b, 0.02 * S, 0.085, 0.08, 0.6);
      }
      crown(8, -15, 0.04);
      fringe(5, 80, 22);
      sides(-15);
      break;
    }
    case 'hair_curly':
      for (let i = 0; i < 16; i++) {
        const th = (360 * i) / 16 + j(i + 160, 15),
          ph = i % 2 ? 50 : 15,
          a = P(th, ph + 25, 1.0),
          b = P(th + 25, ph - 10, 1.2),
          m = P(th + 40, ph + 10, 1.4);
        add(
          'curl' + i,
          'head',
          [0, 0, 0],
          { kind: 'tube', a, ctrl: m, b, r0: 0.07 * S, r1: 0.03 * S, flat: 0.8, n: out(a), seg: 7, steps: 7 },
          'hair'
        );
      }
      fringe(5, 90, 20);
      break;
    case 'hair_bun': {
      const at = /** @type {Vec3} */ ([0, c[1] + r[1] * 0.85, c[2] - r[2] * 0.55]);
      swept(at, 12);
      fringe(3, 50, 30);
      add(
        'bun',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [at[0], at[1] + 0.03 * S, at[2] - 0.04 * S],
          r: [0.12 * S, 0.11 * S, 0.12 * S],
          seg: 14,
          rings: 9,
        },
        'hair'
      );
      break;
    }
    case 'hair_pony': {
      const at = /** @type {Vec3} */ ([0, c[1] + r[1] * 0.3, c[2] - r[2] * 1.02]);
      swept(at, 12);
      fringe(4, 70, 22);
      tail('pony', at, [0, c[1] - r[1] * 0.2, c[2] - r[2] * 1.5], [0, c[1] - r[1] * 1.3, c[2] - r[2] * 1.25], 0.085);
      break;
    }
    case 'hair_twin':
      for (const sgn of [1, -1]) {
        const at = /** @type {Vec3} */ ([sgn * r[0] * 1.0, c[1] + r[1] * 0.35, c[2] - r[2] * 0.3]);
        swept(at, 6);
        tail(
          'tail' + (sgn > 0 ? 'A' : 'B'),
          at,
          [sgn * r[0] * 1.45, c[1] - r[1] * 0.1, c[2] - r[2] * 0.4],
          [sgn * r[0] * 1.25, c[1] - r[1] * 1.1, c[2] - r[2] * 0.45],
          0.08
        );
      }
      fringe(5, 80, 16);
      break;
    case 'hair_short':
    default:
      crown(10, -20, 0.05);
      fringe(4, 70, 24);
      sides(-25);
  }
}

/**
 * a hat's parts on the head: a cap with its peak, a beanie with its fold and bobble, a hard hat, a bucket hat, a
 * cowboy hat, a top hat with its band, a chef's toque, a crown
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string} hat @param {{ c: Vec3, r: Vec3 }} H the head @param {number} [crown] how high its cranium rises
 * (FIGURE_HEADS)
 */
export function kitHat(add, hat, H, crown = 1) {
  /* the owner (2026-10-28: "hats also look weird"): a hat is its own forms fitted round the head and the hair under
     it: a crown from a band at the forehead up over the top of the head, then a bill, a brim, a band, a fold */
  const { c, r } = H,
    k = r[0] / 0.31,
    yb = c[1] + r[1] * 0.18,
    zc = c[2] - r[2] * 0.06,
    bx = r[0] * 1.1,
    bz = r[2] * 1.14,
    top = c[1] + r[1] * (Math.max(1.04, crown) + 0.06),
    /** @param {string} id @param {number} y0 @param {number} h @param {number} sx @param {number} sz @param {string} col */
    dome = (id, y0, h, sx, sz, col, dz = 0, cut = -0.04) =>
      add(
        id,
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, y0, zc + dz],
          r: [sx, h, sz],
          seg: 18,
          rings: 10,
          cut: { front: cut, side: cut, back: cut },
        },
        col
      ),
    /** a closed solid of rings round the head's upright axis @param {string} id @param {number[]} ys @param {number[]} rxs @param {string} col */
    lathe = (id, ys, rxs, col, dz = 0) =>
      add(
        id,
        'head',
        [0, 0, 0],
        { kind: 'lathe', c: [0, 0, zc + dz], y: ys, rx: rxs, rz: rxs.map(v => (v * bz) / bx), seg: 18 },
        col
      ),
    /** a flat oval (a brim, a peak) @param {string} id @param {number} y @param {number} rx @param {number} rz @param {number} th @param {string} col */
    disc = (id, y, rx, rz, th, col, dz = 0) =>
      add(id, 'head', [0, 0, 0], { kind: 'ellipsoid', c: [0, y, zc + dz], r: [rx, th, rz], seg: 22, rings: 6 }, col),
    /** @param {string} id @param {number} y @param {number} R @param {number} th @param {string} col */
    band = (id, y, R, th, col) =>
      add(
        id,
        'head',
        [0, 0, 0],
        { kind: 'torus', c: [0, y, zc], R: [R, (R * bz) / bx], r: th, seg: 18, rings: 5 },
        col
      ),
    /** a brim's edge rolled up at each side (a cowboy hat's, a top hat's) @param {number} y @param {number} wx @param {number} wz @param {number} lift @param {number} th */
    curls = (y, wx, wz, lift, th) => {
      for (const s of [1, -1])
        add(
          'curl' + (s > 0 ? 'A' : 'B'),
          'head',
          [0, 0, 0],
          {
            kind: 'tube',
            a: [s * wx * 0.78, y, zc + wz * 0.62],
            ctrl: [s * wx * 1.16, y + lift * 2, zc],
            b: [s * wx * 0.78, y, zc - wz * 0.62],
            r0: th,
            r1: th,
            flat: 0.6,
            n: [s, 0, 0],
            seg: 7,
            steps: 8,
          },
          'hat'
        );
    };
  switch (hat) {
    case 'hat_cap':
      /* a fitted crown, its button, and a bill curving down a little over the eyes */
      dome('hat', yb - 0.01, top - yb + 0.02, bx * 0.98, bz * 0.98, 'hat', 0, -0.05);
      disc('button', top + 0.008, 0.022 * k, 0.022 * k, 0.012 * k, 'hat2');
      add(
        'peak',
        'head',
        [0, 0, 0],
        {
          kind: 'tube',
          a: [0, yb + 0.012, zc + bz * 0.8],
          ctrl: [0, yb + 0.004, zc + bz * 1.3],
          b: [0, yb - 0.035 * k, zc + bz * 1.6],
          r0: bx * 0.66,
          r1: bx * 0.56,
          flat: 0.06,
          n: [0, 1, 0],
          seg: 14,
          steps: 6,
        },
        'hat2'
      );
      break;
    case 'hat_beanie':
      /* knit, a little slouched behind, its cuff turned up and a bobble */
      /* fitted to the skull (its own crown hugs, a knit hat does not flare) */
      dome('hat', yb - 0.03, top - yb + 0.04, bx * 0.97, bz * 0.99, 'hat', -0.008, -0.02);
      add(
        'slouch',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, top - 0.05 * k, zc - bz * 0.28],
          r: [bx * 0.6, 0.065 * k, bz * 0.55],
          seg: 14,
          rings: 8,
        },
        'hat'
      );
      band('fold', yb - 0.012, bx * 0.96, 0.034 * k, 'hat');
      add(
        'bobble',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, top + 0.06 * k, zc - 0.04 * k],
          r: [0.07 * k, 0.065 * k, 0.07 * k],
          seg: 10,
          rings: 7,
        },
        'hat2'
      );
      break;
    case 'hat_hardhat':
      dome('hat', yb, top - yb + 0.035, bx * 1.04, bz * 1.04, 'hat');
      add(
        'ridge',
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [0, top + 0.028, zc], r: [0.028 * k, 0.022 * k, bz * 0.55], seg: 8, rings: 8 },
        'hat'
      );
      disc('brim', yb + 0.004, bx * 1.24, bz * 1.3, 0.014 * k, 'hat', bz * 0.08);
      break;
    case 'hat_bucket': {
      /* a soft crown tapering to a round top, and a brim that slopes down all round */
      const m = (yb + top) / 2;
      lathe('hat', [yb - 0.012, yb - 0.006, m, top - 0.012, top + 0.012], [0, bx, bx * 0.97, bx * 0.86, 0], 'hat');
      lathe(
        'brim',
        [yb + 0.008, yb, yb - 0.05 * k, yb - 0.064 * k, yb - 0.02, yb - 0.012],
        [0, bx * 1.01, bx * 1.42, bx * 1.42, bx * 0.98, 0],
        'hat'
      );
      band('band', yb + 0.02, bx * 1.0, 0.016 * k, 'hat2');
      break;
    }
    case 'hat_cowboy': {
      /* a tall creased crown, a wide brim rolled up at the sides, a band */
      const t = top + 0.1 * k;
      lathe(
        'hat',
        [yb - 0.01, yb - 0.004, (yb + t) / 2, t - 0.01, t - 0.03 * k],
        [0, bx * 0.98, bx * 0.95, bx * 0.74, 0],
        'hat'
      );
      disc('brim', yb - 0.006, bx * 1.72, bz * 1.56, 0.016 * k, 'hat');
      curls(yb - 0.006, bx * 1.72, bz * 1.56, 0.04 * k, 0.026 * k);
      band('band', yb + 0.026 * k, bx * 0.97, 0.02 * k, 'hat2');
      break;
    }
    case 'hat_tophat': {
      const t = top + 0.34 * k;
      lathe('hat', [yb - 0.01, yb - 0.004, (yb + t) / 2, t, t + 0.006], [0, bx * 0.93, bx * 0.9, bx * 0.99, 0], 'hat');
      disc('brim', yb - 0.004, bx * 1.36, bz * 1.28, 0.014 * k, 'hat');
      curls(yb - 0.004, bx * 1.36, bz * 1.28, 0.025 * k, 0.02 * k);
      band('band', yb + 0.05 * k, bx * 0.93, 0.03 * k, 'hat2');
      break;
    }
    case 'hat_chef': {
      /* a straight band and a pleated puff of a top */
      lathe('hat', [yb - 0.01, yb - 0.004, top - 0.01, top], [0, bx, bx * 1.03, 0], 'hat');
      add(
        'puff',
        'head',
        [0, 0, 0],
        { kind: 'ellipsoid', c: [0, top + 0.1 * k, zc], r: [bx * 1.18, 0.15 * k, bz * 1.12], seg: 18, rings: 9 },
        'hat'
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(
          'pleat' + i,
          'head',
          [0, 0, 0],
          {
            kind: 'ellipsoid',
            c: [Math.sin(a) * bx * 0.72, top + 0.15 * k, zc + Math.cos(a) * bz * 0.68],
            r: [0.11 * k, 0.12 * k, 0.11 * k],
            seg: 10,
            rings: 6,
          },
          'hat'
        );
      }
      break;
    }
    case 'hat_crown': {
      /* a small crown sat on top of the hair: a band, five points, a jewel on the front */
      const y = top - 0.06 * k,
        R = r[0] * 0.62;
      band('hat', y, R, 0.026 * k, 'hat');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(
          'point' + i,
          'head',
          [0, 0, 0],
          {
            kind: 'cone',
            a: [Math.sin(a) * R, y, zc + Math.cos(a) * R * (bz / bx)],
            b: [Math.sin(a) * R * 1.08, y + 0.11 * k, zc + Math.cos(a) * R * 1.08 * (bz / bx)],
            r: 0.035 * k,
            seg: 5,
          },
          'hat'
        );
      }
      add(
        'jewel',
        'head',
        [0, 0, 0],
        {
          kind: 'ellipsoid',
          c: [0, y + 0.01, zc + R * (bz / bx) + 0.02 * k],
          r: [0.025 * k, 0.025 * k, 0.015 * k],
          seg: 8,
          rings: 5,
        },
        'hat2'
      );
      break;
    }
    default:
      dome('hat', yb - 0.01, top - yb + 0.02, bx * 0.98, bz * 0.98, 'hat', 0, -0.05);
  }
}

/**
 * the face as marks on the head (logic/figure-pose.js figureFaceMarks paints them in whole pixels): eyes by style
 * with a glint and an iris, lashes, brows by style, the mouth by style (a grin's teeth), blush, freckles, a stache,
 * stubble, and glasses (round and square frames, sunglasses, a monocle)
 * @param {{ c: Vec3, r: Vec3, sq?: number, taper?: number, deform?: import('./figure-pose.js').HeadDeform }} H @param {Record<string, string | null>} wear
 * @param {KitLook} look @param {Record<string, Vec3>} colours @param {number} seed @returns {FaceMark[]}
 */
export function kitFaceMarks(H, wear, look, colours, seed) {
  /** @type {FaceMark[]} */
  const out = [];
  const { c, r } = H,
    /** @param {string} kind @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<FaceMark>} [o] */
    mark = (kind, x, y, w, h, o = {}) => out.push({ part: 'head', kind, ...frontOf(H, x, y), w, h, ...o }),
    /* every size is the spike's head's times how big this head is */
    k = r[0] / 0.31,
    /* eyes set wider or closer, higher or lower, by the person */
    ex = r[0] * (0.32 + 0.06 * kitRnd(seed, 23)),
    ey = c[1] - r[1] * (0.07 + 0.07 * kitRnd(seed, 24)),
    eyes = wear.eyes || 'eyes_round',
    /* the owner (2026-10-28: "the eyes look way too chibi and cute"): almond eyes, wider than tall, under a heavy lid;
       wide ones open more, sharp and sleepy ones narrower */
    [ew, eh] = (
      eyes === 'eyes_wide'
        ? [0.076, 0.06]
        : eyes === 'eyes_sharp'
          ? [0.078, 0.034]
          : eyes === 'eyes_sleepy'
            ? [0.072, 0.032]
            : [0.072, 0.048]
    ).map(v => v * k),
    /* the face's mood from the look's brows and mouth: -1 cross, 0 calm, 1 glad, 2 worried */
    brows = wear.brows || null,
    mouth = wear.mouth || 'mouth_smile',
    mood =
      brows === 'brows_stern'
        ? -1
        : mouth === 'mouth_grin' || mouth === 'mouth_open'
          ? 1
          : brows === 'brows_arched'
            ? 2
            : 0;
  colours.irisD = figureMix(figureDark(colours.iris, 0.5), [30, 20, 70], 0.3);
  colours.irisL = figureMix(colours.iris, [255, 255, 240], 0.3);
  colours.tongue = [214, 92, 104];
  colours.crease = figureMix(figureDark(colours.skin, 0.74), [120, 70, 90], 0.15);
  colours.lip = figureMix(colours.skin, [196, 96, 104], 0.32);
  colours.blush = figureMix(colours.skin, [230, 120, 120], 0.3);
  /* a little colour on the cheeks, in a close-up only */
  if (kitRnd(seed, 40) < 0.3 || /lashes/.test(eyes))
    for (const s of [1, -1])
      mark('blush', s * r[0] * 0.58, c[1] - r[1] * 0.36, 0.08 * k, 0.03 * k, { shape: 'oval', close: true, min: 0.35 });
  if (wear.facial === 'facial_freckles')
    for (const s of [1, -1])
      for (const [dx, dy] of [
        [0.5, -0.3],
        [0.62, -0.36],
        [0.55, -0.42],
      ])
        mark('freckle', s * r[0] * dx, c[1] + r[1] * dy, 0.018 * k, 0.018 * k);
  if (wear.facial === 'facial_stubble')
    mark('stubble', 0, c[1] - r[1] * 0.68, r[0] * 0.8, r[1] * 0.28, { min: 0.3, shape: 'oval' });
  /* an eye, in layers: its white, an almond; the iris, a round half hidden under the lid, shaded across its top; a
     small pupil and one small shine; a sleepy eye's heavy lid; the upper lid as a thick line with its outer corner
     drawn out (the closed eye's line in a blink: the 'eye' mark); in a close-up the lid's crease and the lower lid */
  const lidY = ey + eh * (mood === 1 || mood === 2 ? 0.52 : 0.46);
  for (const s of [1, -1]) {
    const ix = s * (ex - ew * 0.06);
    mark('white', s * ex, ey, ew, eh, { col: 'sclera', shut: true, narrow: true, shape: 'oval' });
    mark('iris', ix, ey + eh * 0.04, ew * 0.48, eh * 1.02, { col: 'iris', narrow: true, shape: 'oval' });
    mark('irisD', ix, ey + eh * 0.3, ew * 0.48, eh * 0.36, { col: 'irisD', shut: true, narrow: true, shape: 'cap' });
    mark('irisL', ix, ey - eh * 0.28, ew * 0.3, eh * 0.2, { col: 'irisL', shut: true, narrow: true, close: true });
    mark('pupil', ix, ey + eh * 0.02, ew * 0.2, eh * 0.46, { col: 'eye', shut: true, narrow: true, shape: 'oval' });
    mark('shine', ix + s * ew * 0.1, ey + eh * 0.22, ew * 0.13, ew * 0.13, { col: 'glint', shut: true, min: 0.55 });
    if (eyes === 'eyes_sleepy') mark('lid', s * ex, ey + eh * 0.3, ew * 1.08, eh * 0.55, { col: 'skin', shut: true });
    mark('eye', s * (ex + ew * 0.06), lidY, ew * 1.16, Math.max(eh * 0.32, 0.016 * k), {
      glint: false,
      shape: 'cap',
      col: 'lash',
    });
    mark('flick', s * (ex + ew * 0.6), lidY - eh * 0.12, ew * 0.24, eh * 0.4, {
      col: 'lash',
      shape: 'slant',
      dir: s,
      t: 0.014 * k,
      min: 0.35,
    });
    if (eyes === 'eyes_lashes')
      mark('flick', s * (ex + ew * 0.7), lidY + eh * 0.04, ew * 0.22, eh * 0.36, {
        col: 'lash',
        shape: 'slant',
        dir: s,
        t: 0.014 * k,
        min: 0.35,
      });
    mark('crease', s * (ex + ew * 0.04), lidY + eh * 0.42 + 0.008 * k, ew * 0.9, 0.012 * k, {
      col: 'crease',
      shape: 'cap',
      close: true,
      min: 0.45,
    });
    mark('under', s * ex, ey - eh * 0.56, ew * 0.66, 0.01 * k, { col: 'crease', shut: true, close: true, min: 0.5 });
  }
  /* the nostrils' shadow under the tip of the nose */
  mark('nose', 0, c[1] - r[1] * 0.43, 0.034 * k, 0.012 * k, { col: 'crease', min: 0.45 });
  /* brows close over the eyes that carry the mood: cross ones slant down to the nose, worried ones up, calm ones a
     low arch */
  const by = lidY + 0.034 * k + eh * 0.25;
  if (brows)
    for (const s of [1, -1]) {
      const thick = brows === 'brows_thick' ? 0.03 : brows === 'brows_soft' ? 0.016 : 0.022;
      if (mood === -1 || mood === 2)
        mark('brow', s * (ex + 0.008 * k), by + (mood === 2 ? 0.006 : -0.004) * k, 0.092 * k, 0.034 * k, {
          col: 'brow',
          shape: 'slant',
          dir: mood === -1 ? -s : s,
          t: thick * k,
        });
      else
        mark('brow', s * (ex + 0.008 * k), by, (brows === 'brows_soft' ? 0.075 : 0.09) * k, (0.016 + thick * 0.7) * k, {
          col: 'brow',
          shape: 'cap',
        });
    }
  /* the mouth: a smile's arc; a grin open on teeth; an open mouth; a smirk tucked to one side; a neutral line; and in
     a close-up the lower lip's shade */
  const my = c[1] - r[1] * (0.56 + 0.08 * kitRnd(seed, 25));
  if (wear.facial === 'facial_stache') mark('stache', 0, my + 0.04 * k, 0.1 * k, 0.034 * k, { col: 'brow', min: 0.25 });
  if (mouth === 'mouth_grin') {
    mark('mouth', 0, my, 0.105 * k, 0.05 * k, { shape: 'oval' });
    mark('teeth', 0, my + 0.014 * k, 0.08 * k, 0.018 * k, { min: 0.3 });
  } else if (mouth === 'mouth_open') {
    mark('mouth', 0, my, 0.042 * k, 0.046 * k, { shape: 'oval' });
    mark('tongue', 0, my - 0.012 * k, 0.03 * k, 0.016 * k, { min: 0.3, shape: 'oval', close: true });
  } else if (mouth === 'mouth_neutral') mark('mouth', 0, my, 0.06 * k, 0.014 * k);
  else if (mouth === 'mouth_smirk') {
    mark('mouth', 0.016 * k, my, 0.07 * k, 0.024 * k, { shape: 'slant', dir: -1, t: 0.014 * k });
  } else mark('mouth', 0, my, 0.085 * k, 0.03 * k, { shape: 'arc' });
  if (mouth !== 'mouth_grin' && mouth !== 'mouth_open')
    mark('lip', 0, my - 0.03 * k, 0.05 * k, 0.014 * k, { col: 'lip', close: true, min: 0.35, shape: 'oval' });
  /* glasses over the eyes */
  const g = wear.glasses;
  if (g && g !== 'headset') {
    const frameCol = kitHex(
      (look.colors && look.colors[g] && look.colors[g][0]) || undefined,
      g === 'glasses_sun' ? [30, 26, 34] : [58, 46, 42]
    );
    /* clear frames a little lighter than the eye's dark, so a glasses wearer's eyes still show through them */
    colours.frame = g === 'glasses_sun' ? frameCol : figureMix(frameCol, colours.skin, 0.25);
    colours.lens = [34, 30, 44];
    const gw = ew * 1.2 + 0.035 * k,
      gh = eh + 0.055 * k;
    if (g === 'glasses_monocle') mark('glasses', -ex, ey, gw, gh, { col: 'frame', hollow: true, min: 0.3 });
    else
      for (const s of [1, -1])
        mark('glasses', s * ex, ey, gw, g === 'glasses_square' ? gh * 0.85 : gh, {
          col: g === 'glasses_sun' ? 'lens' : 'frame',
          hollow: g !== 'glasses_sun',
          min: 0.3,
          shape: g === 'glasses_sun' ? 'oval' : undefined,
        });
    if (g !== 'glasses_monocle')
      mark('bridge', 0, ey + 0.01 * k, ex * 2 - gw + 0.02 * k, 0.026 * k, { col: 'frame', min: 0.3 });
    /* a shine on every lens, high on its outer side */
    for (const s of g === 'glasses_monocle' ? [-1] : [1, -1])
      mark('shine', s * (ex + gw * 0.28), ey + gh * 0.28, 0.024 * k, 0.024 * k, { col: 'glint', min: 0.5 });
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

/**
 * the room a code figure's poses take (logic/figure-pose.js FigureExtent): its reach round its upright axis, its
 * depth, its top and bottom, over the idle, the walk, a cheer's raised arms and a throw's wind-up, with a margin
 * @param {Figure} F @returns {import('./figure-pose.js').FigureExtent}
 */
export function kitExtent(F) {
  const M = figureMesh(F),
    poses = [
      ['idle', 0],
      ['walk', 0],
      ['walk', 2],
      ['walk', 6],
      ['cheer', 0],
      ['cheer', 1],
      ['throw', 3],
      ['throw', 7],
      ['sit', 0],
    ];
  let r = 0,
    top = 0,
    bottom = 0;
  for (const [clip, f] of poses) {
    const J = jointMatrices(F, figurePose(F, /** @type {string} */ (clip), /** @type {number} */ (f)), 0);
    for (let v = 0; v < M.count; v++) {
      const o = v * 8,
        j = M.data[o + 6] * 16,
        x = M.data[o],
        y = M.data[o + 1],
        z = M.data[o + 2],
        X = J[j] * x + J[j + 4] * y + J[j + 8] * z + J[j + 12],
        Y = J[j + 1] * x + J[j + 5] * y + J[j + 9] * z + J[j + 13],
        Z = J[j + 2] * x + J[j + 6] * y + J[j + 10] * z + J[j + 14];
      r = Math.max(r, Math.hypot(X, Z));
      top = Math.max(top, Y);
      bottom = Math.min(bottom, Y);
    }
  }
  return { r: r + 0.04, depth: r + 0.04, top: top + 0.04, bottom: Math.min(-0.04, bottom - 0.02) };
}
