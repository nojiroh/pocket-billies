// @ts-check
'use strict';
/* ================= THE FIGURE KIT (characters track CH-3b) =================
   A person's figure built from their look (the wardrobe's: body sliders, hair, face, clothes; people/<id>.json or a
   townsperson's seed), out of the simple rounded shapes of logic/figure-pose.js, so nobody is modelled by hand and
   every NPC and the player come out of one kit. The owner's brief (2026-10-28): "I like the simpler shapes but you can
   give it more detail and variety. They can have more personality and less mannequin feeling. So different head
   shapes, heights and body types."
   - Shape: a head shape and a build (game/data/figureKit.json heads, builds) chosen in people/<id>.json `figure`, else
     from the look's sliders and the person's seed. The look's sliders are exaggerated (proportions.sliderGain) because the
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
import { kitAccessory } from './kit-shapes.js';
import {
  figureDark,
  figureGpuMesh,
  figureMesh,
  figureMix,
  figurePose,
  figureUnit,
  frontOf,
  hairCutAt,
  jointMatrices,
  sdfAt,
  sdfNormal,
  sdfTop,
} from './figure-pose.js';
/* eslint-disable no-func-assign */
expose({
  KIT_INK: [() => KIT_INK],
  KIT_JACKETS: [() => KIT_JACKETS],
  KIT_LONG_COATS: [() => KIT_LONG_COATS],
  KIT_LONG_SLEEVES: [() => KIT_LONG_SLEEVES],
  KIT_SLEEVELESS: [() => KIT_SLEEVELESS],
  // @ts-expect-error -- replaced on purpose
  figureKitData: [() => figureKitData, v => (figureKitData = v)],
  // @ts-expect-error -- replaced on purpose
  figureSeed: [() => figureSeed, v => (figureSeed = v)],
  // @ts-expect-error -- replaced on purpose
  figureShapeFor: [() => figureShapeFor, v => (figureShapeFor = v)],
  // @ts-expect-error -- replaced on purpose
  kappiFigure: [() => kappiFigure, v => (kappiFigure = v)],
  // @ts-expect-error -- replaced on purpose
  kitBeardShape: [() => kitBeardShape, v => (kitBeardShape = v)],
  // @ts-expect-error -- replaced on purpose
  kitBuild: [() => kitBuild, v => (kitBuild = v)],
  // @ts-expect-error -- replaced on purpose
  kitExtent: [() => kitExtent, v => (kitExtent = v)],
  // @ts-expect-error -- replaced on purpose
  kitFaceMarks: [() => kitFaceMarks, v => (kitFaceMarks = v)],
  // @ts-expect-error -- replaced on purpose
  kitFaceSet: [() => kitFaceSet, v => (kitFaceSet = v)],
  // @ts-expect-error -- replaced on purpose
  kitFaceStyles: [() => kitFaceStyles, v => (kitFaceStyles = v)],
  // @ts-expect-error -- replaced on purpose
  kitHair: [() => kitHair, v => (kitHair = v)],
  // @ts-expect-error -- replaced on purpose
  kitHat: [() => kitHat, v => (kitHat = v)],
  // @ts-expect-error -- replaced on purpose
  kitHeadShape: [() => kitHeadShape, v => (kitHeadShape = v)],
  // @ts-expect-error -- replaced on purpose
  kitHex: [() => kitHex, v => (kitHex = v)],
  // @ts-expect-error -- replaced on purpose
  kitRandomHeads: [() => kitRandomHeads, v => (kitRandomHeads = v)],
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
/** @typedef {{ head?: string, build?: string, eyes?: string, brows?: string, gait?: FigureGait, variety?: boolean }}
 * FigureShapeChoice a person's `figure` (CH-6: `eyes` and `brows`, a style of figureKit.json faces over the look's); `variety` (townsfolk) lets every build turn up, where anyone else's sliders decide it */

/* CH-5: the head shapes (each a sculpted head's knobs: logic/figure-pose.js headDeform), how far each person strays
   from theirs, the builds (multipliers on the look's exaggerated sliders, and how each moves), the builds townsfolk are
   picked from and the proportions are game/data/figureKit.json's (heads, vary, builds, folk, proportions). The
   proportions (the owner, 2026-10-28: Gen 5's style, "in that HD-2D style", then "not too chibi"): about 2.6 heads, a
   big head for the face and hair, legs, torso and arms a little short; a look's slider counts sliderGain times more on
   a figure than on the flat sprite */
/** the head shapes a seed may pick (not the main character's, `hero`) @param {FigureKitData} kit @returns {string[]} */
export function kitRandomHeads(kit) {
  return Object.keys(kit.heads).filter(k => kit.heads[k].random !== false);
}
/** the eye's and the outline's dark (the props' plum) */
export const KIT_INK = /** @type {Vec3} */ ([36, 25, 54]);
export const KIT_SLEEVELESS = new Set(['tank', 'crop']),
  KIT_LONG_SLEEVES = new Set(['longsleeve', 'sweater', 'dress_shirt', 'tunic', 'track_top']),
  KIT_JACKETS = new Set(['blazer', 'denim_jacket', 'track_top', 'puffer']),
  KIT_LONG_COATS = new Set(['labcoat', 'trench']);

/** @typedef {import('../../types/game-data').FigureKit} FigureKitData */
/**
 * the figure kit's data (game/data/figureKit.json: CH-5): the game's own, from the game data on the page (the figures'
 * helper thread never needs it: it meshes figures already built)
 * @returns {FigureKitData}
 */
export function figureKitData() {
  const D = /** @type {any} */ (globalThis).GAMEDATA;
  if (!D || !D.figureKit) throw new Error('figure kit: no game data (game/data/figureKit.json)');
  return D.figureKit;
}

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
 * @param {KitLook} look @param {number} seed @param {FigureShapeChoice} [choice] @param {FigureKitData} [kit]
 * @returns {{ head: string, build: string }}
 */
export function figureShapeFor(look, seed, choice = {}, kit = figureKitData()) {
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
    const B = kit.folk;
    build = B[Math.floor(kitRnd(seed, 1) * B.length) % B.length];
  }
  const heads = kitRandomHeads(kit),
    head = heads[Math.floor(kitRnd(seed, 2) * heads.length) % heads.length];
  return {
    head: choice.head && choice.head in kit.heads ? choice.head : head,
    build: choice.build && choice.build in kit.builds ? choice.build : build,
  };
}

/**
 * a person's figure from their look: parts on the joints figurePose moves (hips, torso, head, thigh/shin/foot and
 * arm/forearm/hand A and B), dressed from the wardrobe, its face as marks
 * @param {KitLook} look @param {Record<string, KitItem>} items the wardrobe's items (their default colours)
 * @param {{ kit?: FigureKitData, name?: string, seed?: number, figure?: FigureShapeChoice,
 *   chibi?: { head: number, legs: number, torso: number, arms: number, neck: number },
 *   flair?: { hair?: number, scarf?: boolean, cape?: boolean, col?: number[], wear?: Record<string, string>,
 *     detail?: boolean, gloves?: boolean, gloveCol?: number[], goggles?: boolean, fur?: boolean, earrings?: boolean,
 *     ahoge?: boolean, glossy?: boolean } }} [opts]
 * `kit`: the kit's data (game/data/figureKit.json; the game's own when not given). `chibi`: proportions
 * other than the kit's (a direction of figures.js FIGURE_LOOKS)
 * @returns {Figure}
 */
export function lookFigure(look, items, opts = {}) {
  const KIT = opts.kit || figureKitData(),
    PR = opts.chibi || KIT.proportions.chibi,
    GAIN = KIT.proportions.sliderGain,
    VY = /** @type {Record<string, any>} */ (KIT.vary),
    seed = opts.seed ?? figureSeed(opts.name || 'person'),
    shape = figureShapeFor(look, seed, opts.figure, KIT),
    HD = KIT.heads[shape.head],
    BD = KIT.builds[shape.build],
    body = look.body || {},
    wear = look.wear || {},
    /* a slider, exaggerated, times the build's */
    sl = (/** @type {string} */ k, /** @type {number} */ def = 1) => {
      const v = Number.isFinite(body[k]) ? body[k] : def,
        bk = /** @type {Record<string, number>} */ (BD.k)[k] ?? 1;
      return (k === 'chest' ? v : 1 + (v - 1) * GAIN) * bk;
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
    headK = sl('head') * (VY.size[0] + VY.size[1] * kitRnd(seed, 3)),
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
  /* the head (the kit's proportions.chibi.head, a direction's own): room for the face, hair and expressions, and the portraits'
     close-ups; it grows a little with the body too, so a small figure is smaller all over and a tall one taller.
     CH-3b round 6 (the owner: "Even more complex shapes make sure they flow into each other"): one blended surface
     (logic/figure-pose.js sdfSurface) of the skull, the face, the jaw, the chin, cheekbones, the brow, eye sockets
     carved in, the nose, the lips, the ears and the top of the neck, each growing out of the next; by the head shape,
     and a little of each person's own on top */
  const hk3 = headK * PR.head * Math.sqrt(hk),
    /* each person a little wider or narrower, longer or shorter, deeper or flatter than their head shape */
    hr = /** @type {Vec3} */ ([
      0.31 * hk3 * HD.r[0] * (VY.rx[0] + VY.rx[1] * kitRnd(seed, 17)),
      0.3 * hk3 * HD.r[1] * (VY.ry[0] + VY.ry[1] * kitRnd(seed, 18)),
      0.29 * hk3 * HD.r[2] * (VY.rz[0] + VY.rz[1] * kitRnd(seed, 19)),
    ]),
    sculpt = {
      /* a build may make the jaw squarer (a round build's) */
      jaw: HD.jaw + VY.jaw * (kitRnd(seed, 15) - 0.5) + (BD.jaw || 0),
      chin: HD.chin * (VY.chin[0] + VY.chin[1] * kitRnd(seed, 13)),
      cheek: HD.cheek * (VY.cheek[0] + VY.cheek[1] * kitRnd(seed, 14)),
      crown: HD.crown,
      brow: VY.brow[0] + VY.brow[1] * kitRnd(seed, 16),
      face: HD.face + VY.face * (kitRnd(seed, 20) - 0.5),
      /* a head shape's own nose, else the person's */
      nose: HD.nose ?? Math.floor(kitRnd(seed, 21) * 4) % 4,
      noseK: VY.noseK[0] + VY.noseK[1] * kitRnd(seed, 11),
      noseLong: kitRnd(seed, 12),
      ears: VY.ears[0] + VY.ears[1] * kitRnd(seed, 22),
    },
    hc = /** @type {Vec3} */ ([0, hr[1] + 0.005, 0.01]),
    neckR = 0.046 * Math.sqrt(girth),
    head = kitHeadShape(hc, hr, sculpt, neckR);
  /* a neck, longer on a beanpole, all but gone on a kid (the head's own neck grows down into it) */
  add(
    'neck',
    'torso',
    [0, 0.34 * tk, 0],
    { kind: 'capsule', a: [0, 0, 0], b: [0, 0.06 * tk + neckL, 0], r0: 0.048 * Math.sqrt(girth), r1: 0.044, seg: 10 },
    'skin'
  );
  add('head', 'torso', [0, 0.4 * tk + neckL, 0], head, 'skin');
  const c1 = head.c[1],
    c2 = head.c[2];
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
  /* ---- neckwear and bags (CH-5: their shapes in game/data/figureKit.json accessories) ---- */
  const neck = wear.neck || null,
    torsoZ = torso.kind === 'lathe' ? torso.rz[4] : 0.11,
    /* the body's frame the shapes are laid out in */
    bodyFrame = { tk, girth, hipK, torsoZ };
  if (neck) colours.neck = itemCol(neck, 0, [217, 67, 75]);
  const neckKit = neck ? KIT.accessories[neck] : null;
  if (neckKit) {
    if (neckKit.colour) colours.neck = [neckKit.colour[0], neckKit.colour[1], neckKit.colour[2]];
    kitAccessory(add, neckKit, bodyFrame, 'torso');
  }
  const bag = wear.bag || null;
  if (bag) {
    colours.bag = itemCol(bag, 0, [212, 156, 70]);
    colours.bag2 = itemCol(bag, 1, figureDark(colours.bag, 0.7));
    /* a bag the kit has no shapes for is a bum bag */
    kitAccessory(add, KIT.accessories[bag] || KIT.accessories.fannypack, bodyFrame, 'torso');
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
    !!hat && !(KIT.accessories[hat] && KIT.accessories[hat].fringe),
    hat ? 1 : FL.hair || 1,
    {
      ahoge: !!FL.ahoge,
      /* the back and shoulders in the head's frame, for long hair to fall over (and a jacket's bulk) */
      body: {
        c: [0, -0.24 * tk - neckL, -0.01],
        r: [xAt(3) + (outer ? 0.04 : 0.025), 0.26 * tk, zAt(3) + (outer ? 0.04 : 0.025)],
      },
    },
    KIT
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
  if (hat) kitHat(add, hat, head, HD.crown * 1.06, KIT);
  /* something worn round the head in the glasses' slot (a headset); glasses are the face's marks */
  const gearKit = wear.glasses ? KIT.accessories[wear.glasses] : null;
  if (gearKit) {
    colours.gear = itemCol(wear.glasses, 0, [40, 40, 48]);
    kitAccessory(add, gearKit, { k: hr[0] / 0.31, hx: hr[0], hy: hr[1], c1 }, 'head');
  }
  /* a beard: a shell over the jaw and chin, the head's own jaw grown out a little, kept below the cheeks (so it
     follows a V jaw or a square one) */
  if (wear.facial === 'facial_beard') add('beard', 'head', [0, 0, 0], kitBeardShape(head.c, head.r, sculpt), 'hair');
  /* ---- the face ---- */
  const face = [...clothMarks, ...kitFaceMarks(head, wear, look, colours, seed, KIT, opts.figure)];
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
    /* CH-6: which tagged marks each face state shows (figure-pose.js figureFaceState) */
    faceSet: kitFaceSet(kitFaceStyles(wear, KIT.faces, opts.figure), KIT.faces),
    colours,
    gait,
    /* where a portrait's cut is (figures.js figurePortrait), metres from the ground: just under the shoulders */
    kit: { ...shape, bust: Math.round((hipY + 0.1 + 0.22 * tk) * 100) / 100 },
    gloss: ['hair', 'hair2', 'shoe', 'sole', 'gear', 'belt', 'lensG', 'gold', 'leather', 'glove'],
  };
}

/** @typedef {{ jaw: number, chin: number, cheek: number, crown: number, brow: number, face: number, nose: number,
 *   noseK: number, noseLong: number, ears: number }} KitSculpt a head's own forms: how V its jaw (below 0 wider at the
 *   jaw than the cheeks), its chin, cheekbones, how big the back of the skull, its brow, how flat its face, its nose (0
 *   a short upturned button, 1 straight, 2 long with a bump on the bridge, 3 broad), the nose's size and length, the
 *   ears' size */
/**
 * a head as one blended surface (logic/figure-pose.js SdfShape), laid out round the ellipsoid at `c` with radii `r`
 * (x across, y up, z the face's way): the skull, the face, the jaw from below each ear to the chin, the chin,
 * cheekbones, the brow ridge, eye sockets carved in, the nose (bridge, tip, wings, nostrils), the lips, the ears with
 * their hollows, and the top of the neck
 * @param {Vec3} c @param {Vec3} r @param {KitSculpt} K @param {number} neckR the neck's radius
 * @returns {import('./figure-pose.js').SdfShape}
 */
export function kitHeadShape(c, r, K, neckR) {
  const k = r[0] / 0.31,
    P = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) =>
      /** @type {Vec3} */ ([c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]]),
    /** @type {import('./figure-pose.js').SdfItem[]} */ items = [],
    ell = (/** @type {Vec3} */ cc, /** @type {Vec3} */ rr, op = /** @type {'add' | 'sub'} */ ('add'), kk = 0) =>
      items.push({ p: { t: 'ell', c: cc, r: rr }, op, k: kk * k }),
    cone = (/** @type {Vec3} */ a, /** @type {Vec3} */ b, /** @type {number} */ ra, /** @type {number} */ rb, kk = 0) =>
      items.push({ p: { t: 'cone', a, b, ra, rb }, op: 'add', k: kk * k }),
    j = K.jaw,
    fz = 0.84 * (1 - 0.12 * K.face),
    /* the face's front at height v (its own ellipsoid's), in the head's z units */
    front = (/** @type {number} */ v) => 0.1 + fz * Math.sqrt(Math.max(0, 1 - ((v + 0.12) / 0.8) ** 2));
  /* the skull, fuller behind */
  ell(P(0, 0.08 * K.crown, -0.1), [r[0] * 0.95, r[1] * 0.9 * K.crown, r[2] * 0.97]);
  /* the face's mass, flatter on a flat face */
  ell(P(0, -0.12, 0.1), [r[0] * 0.86, r[1] * 0.8, r[2] * fz], 'add', 0.08);
  /* the jaw: from the angle below each ear to the chin; a V jaw's angles high and in, a square one's low and out */
  const ax = 0.78 - 0.18 * j,
    ay = -0.42 - 0.12 * (1 - Math.max(0, j)),
    cx = Math.max(0.03, 0.16 - 0.1 * j),
    cy = -0.86 - 0.1 * K.chin;
  for (const s of [1, -1]) cone(P(s * ax, ay, -0.14), P(s * cx, cy, 0.48), r[0] * 0.22, r[0] * 0.13, 0.07);
  /* the chin, standing a little forward */
  ell(
    P(0, cy - 0.04 * K.chin, 0.5 + 0.06 * K.chin),
    [r[0] * (0.17 + 0.05 * (1 - j)), r[1] * 0.14, r[2] * 0.2],
    'add',
    0.05
  );
  /* cheekbones, high and out */
  for (const s of [1, -1]) ell(P(s * 0.55, -0.22, 0.4), [r[0] * 0.26 * K.cheek, r[1] * 0.17, r[2] * 0.26], 'add', 0.1);
  /* the brow ridge */
  ell(P(0, 0.12, front(0.12) - 0.17), [r[0] * 0.62, r[1] * 0.11 * K.brow, r[2] * 0.2], 'add', 0.08);
  /* eye sockets, carved in under it */
  for (const s of [1, -1])
    ell(P(s * 0.35, -0.08, front(-0.08) + 0.08), [r[0] * 0.15, r[1] * 0.09, r[2] * 0.1], 'sub', 0.05);
  /* the nose: a bridge down from the brow to its tip, the tip, its wings, the nostrils carved under them */
  const tipV = -(K.nose === 0 ? 0.26 : K.nose === 2 ? 0.4 : 0.3 + 0.08 * K.noseLong),
    out = (K.nose === 0 ? 0.06 : K.nose === 2 ? 0.11 : 0.085) * K.noseK,
    wing = K.nose === 3 ? 1.45 : 1,
    tip = P(0, tipV + (K.nose === 0 ? 0.03 : 0), front(tipV) + out);
  cone(P(0, 0, front(0) - 0.05), tip, r[0] * 0.035, r[0] * 0.05 * K.noseK, 0.02);
  if (K.nose === 2) ell(P(0, -0.15, front(-0.15) + 0.06), [r[0] * 0.04, r[1] * 0.06, r[2] * 0.04], 'add', 0.015);
  ell(tip, [r[0] * 0.075 * K.noseK, r[1] * 0.065 * K.noseK, r[2] * 0.07 * K.noseK], 'add', 0.02);
  for (const s of [1, -1]) {
    ell(
      [tip[0] + s * r[0] * 0.07 * wing * K.noseK, tip[1] - r[1] * 0.025, tip[2] - r[2] * 0.06],
      [r[0] * 0.05 * wing * K.noseK, r[1] * 0.045, r[2] * 0.05],
      'add',
      0.02
    );
    ell(
      [tip[0] + s * r[0] * 0.04 * wing, tip[1] - r[1] * 0.06, tip[2] - r[2] * 0.03],
      [r[0] * 0.025, r[1] * 0.02, r[2] * 0.03],
      'sub',
      0.008
    );
  }
  /* the lips */
  ell(P(0, -0.56, front(-0.56) + 0.01), [r[0] * 0.17, r[1] * 0.045, r[2] * 0.06], 'add', 0.03);
  ell(P(0, -0.65, front(-0.65) + 0.01), [r[0] * 0.14, r[1] * 0.05, r[2] * 0.06], 'add', 0.03);
  /* the ears and their hollows */
  for (const s of [1, -1]) {
    ell(P(s * 0.9, -0.12, -0.08), [r[0] * 0.08 * K.ears, r[1] * 0.2 * K.ears, r[2] * 0.15 * K.ears], 'add', 0.025);
    ell(
      P(s * (0.9 + 0.07 * K.ears), -0.13, -0.05),
      [r[0] * 0.04, r[1] * 0.12 * K.ears, r[2] * 0.08 * K.ears],
      'sub',
      0.01
    );
  }
  /* the top of the neck, the jaw and the skull growing down into it */
  cone(P(0, -0.5, -0.2), [0, 0, c[2] - r[2] * 0.12], neckR * 1.1, neckR, 0.06);
  return { kind: 'sdf', items, h: r[0] / 12, c, r };
}

/** a beard as a blended shape: the jaw and chin of kitHeadShape grown out, kept below the cheekbones
 * @param {Vec3} c @param {Vec3} r @param {KitSculpt} K @returns {import('./figure-pose.js').SdfShape} */
export function kitBeardShape(c, r, K) {
  const k = r[0] / 0.31,
    P = (/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) =>
      /** @type {Vec3} */ ([c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]]),
    j = K.jaw,
    ax = 0.78 - 0.18 * j,
    ay = -0.42 - 0.12 * (1 - Math.max(0, j)),
    cx = Math.max(0.03, 0.16 - 0.1 * j),
    cy = -0.86 - 0.1 * K.chin,
    g = 0.015 * k,
    /** @type {import('./figure-pose.js').SdfItem[]} */ items = [];
  for (const s of [1, -1])
    items.push({
      p: { t: 'cone', a: P(s * ax, ay, -0.14), b: P(s * cx, cy, 0.48), ra: r[0] * 0.22 + g, rb: r[0] * 0.13 + g },
      op: 'add',
      k: 0.07 * k,
    });
  items.push({
    p: { t: 'ell', c: P(0, cy - 0.06, 0.5), r: [r[0] * 0.24 + g, r[1] * 0.16 + g, r[2] * 0.22 + g] },
    op: 'add',
    k: 0.05 * k,
  });
  items.push({ p: { t: 'slab', y: c[1] - r[1] * 0.38, below: true }, op: 'and', k: 0 });
  /* the mouth left bare */
  items.push({ p: { t: 'ell', c: P(0, -0.6, 0.85), r: [r[0] * 0.2, r[1] * 0.1, r[2] * 0.3] }, op: 'sub', k: 0.02 * k });
  return { kind: 'sdf', items, h: r[0] / 14, c, r };
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
  if (s.kind === 'sdf') return y + sdfTop(s);
  return y + Math.max(s.a[1] + s.r0, s.b[1] + s.r1);
}

/**
 * the hair (CH-3b round 6, the owner: "Add more natural flowy shapes for the hair"): one blended surface: a close cap
 * over the skull to the hairline, and strands grown from the scalp joined into it and into each other, so the hair
 * reads as one flowing mass with grooves between its locks (logic/figure-pose.js sdfSurface). Each strand starts
 * combed away from the crown's whorl (or a part), lifts off the scalp, then falls by its own weight, waving and, for
 * some styles, curling in at its tip; it tapers to a point, and is pushed back out wherever it would go into the head
 * (or, for long hair, the back and shoulders: `body`). By style:
 * - short: the crown combed down and back, a fringe over the brow, over the ears; sidepart: combed from a part;
 * - buzz: the cap alone; bob: to the jaw, its ends curling in; long: down the back in waves;
 * - spiky: thick strands standing up and out; curly: short strands coiling;
 * - bun, pony, twin: swept to where the hair is tied, then a bun, a tail or two tails.
 * Under a hat, only what shows below it, every strand starting under the hat's band; a fringe under a cap or a
 * beanie, none under a brim.
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string | null} style @param {import('./figure-pose.js').SdfShape} H the head (kitHeadShape)
 * @param {boolean} hat @param {number} seed @param {boolean} [brim] under a brimmed hat (no fringe)
 * @param {number} [vol] the strands' thickness and lift times this (a direction's fuller hair)
 * @param {{ ahoge?: boolean, body?: { c: Vec3, r: Vec3 } }} [o] an antenna strand; the back and shoulders, in the
 *   head's frame, for long hair to fall over
 * @param {FigureKitData} [kit] the kit's data: each style's recipe (CH-5: game/data/figureKit.json hair: its hairline,
 *   what shows under a hat, and its steps: grow, spikes, bun, tie, twin, with their strands' numbers)
 */
export function kitHair(add, style, H, hat, seed, brim = false, vol = 1, o = {}, kit = figureKitData()) {
  if (!style) return;
  /* CH-5: the style's recipe (game/data/figureKit.json hair; a style it has none for grows as hair_short) */
  const HR = /** @type {any} */ (kit.hair[style] || kit.hair.hair_short),
    k = H.r[0] / 0.31,
    sk = /** @type {{ t: 'ell', c: Vec3, r: Vec3 }} */ (H.items[0].p),
    sc = sk.c,
    sr = sk.r,
    c1 = H.c[1],
    /** @type {import('./figure-pose.js').SdfItem[]} */ items = [],
    rnd = (/** @type {number} */ i) => kitRnd(seed, 300 + i),
    add3 = (/** @type {number[]} */ a, /** @type {number[]} */ b, s = 1) =>
      /** @type {Vec3} */ ([a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]),
    sub3 = (/** @type {number[]} */ a, /** @type {number[]} */ b) =>
      /** @type {Vec3} */ ([a[0] - b[0], a[1] - b[1], a[2] - b[2]]),
    dot3 = (/** @type {number[]} */ a, /** @type {number[]} */ b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    /* a point on the skull at a way round it (unit), and the way out there */
    onSkull = (/** @type {number[]} */ d) =>
      /** @type {Vec3} */ ([sc[0] + d[0] * sr[0], sc[1] + d[1] * sr[1], sc[2] + d[2] * sr[2]]),
    outAt = (/** @type {number[]} */ d) => figureUnit([d[0] / sr[0], d[1] / sr[1], d[2] / sr[2]]),
    /* the hairline: the style's own, else the usual */
    cut = HR.cut || { front: 0.32, side: -0.15, back: -0.5 },
    /* the hat's band, as a height on the skull's sphere */
    bandV = (c1 + H.r[1] * 0.18 - sc[1]) / sr[1],
    /* the body's ellipsoid's distance at a point, roughly */
    bodyD = (/** @type {Vec3} */ q) => {
      if (!o.body) return 1;
      const B = o.body,
        u = [(q[0] - B.c[0]) / B.r[0], (q[1] - B.c[1]) / B.r[1], (q[2] - B.c[2]) / B.r[2]];
      return (Math.hypot(u[0], u[1], u[2]) - 1) * Math.min(B.r[0], B.r[1], B.r[2]);
    };
  /* the cap: the skull, a little out, cut at the hairline */
  const t = (HR.thin || hat ? 0.012 : 0.02 * vol) * k;
  items.push({ p: { t: 'ell', c: sc, r: [sr[0] + t, sr[1] + t, sr[2] + t] }, op: 'add', k: 0 });
  items.push({ p: { t: 'cut', c: sc, r: sr, cut }, op: 'and', k: 0 });
  /* hollow: a shell over the scalp, nothing hidden inside the head */
  items.push({ p: { t: 'ell', c: sc, r: [sr[0] - 0.012 * k, sr[1] - 0.012 * k, sr[2] - 0.012 * k] }, op: 'sub', k: 0 });
  const blend = 0.014 * k;
  /** a strand: grown from p0 the way d0 for `len` metres, `w` thick at its root
   * @param {Vec3} p0 @param {number[]} d0 @param {number} len @param {number} w
   * @param {{ grav?: number, stiff?: number, wave?: number, freq?: number, curl?: number, stop?: number,
   *   to?: Vec3, phase?: number, hug?: number, frame?: boolean }} S `frame`: parts round the face (never falls
   *   in front of it); `hug`: over that much of its length it lies along the head, pulled
   *   back down to it wherever it lifts off */
  const strand = (p0, d0, len, w, S) => {
    const steps = Math.max(4, Math.min(16, Math.round(len / (0.022 * k)))),
      step = len / steps,
      ph = S.phase ?? rnd(items.length) * 6.28;
    let p = p0,
      d = figureUnit(d0),
      rp = w * 0.85;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps,
        n = figureUnit(sub3(p, H.c)),
        lat = figureUnit([d[1] * n[2] - d[2] * n[1], d[2] * n[0] - d[0] * n[2], d[0] * n[1] - d[1] * n[0]]);
      let nd = d.map(v => v * (S.stiff ?? 0.8));
      nd = add3(nd, [0, -1, 0], (S.grav ?? 0.5) * 0.45);
      if (S.wave) nd = add3(nd, lat, S.wave * Math.cos(6.283 * (S.freq || 1) * f + ph));
      if (S.curl && f > 0.55) nd = add3(nd, n, -S.curl * (f - 0.55) * 2);
      if (S.to) nd = add3(nd, figureUnit(sub3(S.to, p)), 1.2);
      d = figureUnit(nd);
      let q = add3(p, d, step);
      const rad = Math.max(0.004 * k, w * (1 - 0.92 * f ** 1.3));
      /* not into the head, nor (long hair) the back and shoulders */
      const dh = sdfAt(H, q) - rad * 0.7 - 0.003 * k;
      if (dh < 0) q = add3(q, sdfNormal(H, q), -dh);
      else if (S.hug && f <= S.hug && dh < 0.1 * k) q = add3(q, sdfNormal(H, q), -dh * 0.8);
      const db = bodyD(q) - rad;
      if (db < 0 && o.body) {
        q = add3(q, figureUnit(sub3(q, o.body.c)), -db);
        /* pushed off the back, not into the head */
        const d2 = sdfAt(H, q) - rad * 0.7 - 0.003 * k;
        if (d2 < 0) q = add3(q, sdfNormal(H, q), -d2);
      }
      /* framing the face: below the brow and in front of the cheeks, pushed out to the side */
      if (S.frame && q[1] < c1 + H.r[1] * 0.15 && q[2] > H.c[2] + H.r[2] * 0.05 && Math.abs(q[0]) < H.r[0] * 1.02)
        q = [Math.sign(q[0] || 1) * H.r[0] * 1.02, q[1], q[2]];
      if (S.stop != null && q[1] < S.stop) break;
      items.push({ p: { t: 'cone', a: p, b: q, ra: rp, rb: rad }, op: 'add', k: blend });
      d = figureUnit(sub3(q, p));
      p = q;
      rp = rad;
      if (S.to && Math.hypot(...sub3(S.to, p)) < step) break;
    }
    return p;
  };
  /* the roots: points spread over the scalp (a golden spiral), inside the hairline; under a hat only a ring just under
     its band */
  /** @type {{ d: Vec3, p: Vec3, n: Vec3, front: boolean }[]} */
  const roots = [];
  const M = hat ? 700 : 320;
  for (let i = 0; i < M; i++) {
    const y = 1 - (2 * (i + 0.5)) / M,
      rr = Math.sqrt(1 - y * y),
      a = i * 2.399963 + seed * 1e-4,
      d = /** @type {Vec3} */ ([Math.cos(a) * rr, y, Math.sin(a) * rr]),
      l = Math.hypot(d[0], d[2]) || 1,
      edge = hairCutAt(cut, d[0] / l, d[2] / l);
    if (d[1] < edge + 0.06) continue;
    /* under a hat a ring low enough that even a thick strand's top stays under the band */
    if (hat && (d[1] > bandV - 0.24 || d[1] < bandV - 0.44)) continue;
    roots.push({ d, p: onSkull(d), n: outAt(d), front: d[2] > 0.45 && Math.abs(d[0]) < 0.7 && d[1] < edge + 0.35 });
  }
  /** the way along the scalp from a root away from a point on the sphere (the whorl, a part) @param {{ d: Vec3, n: Vec3 }} R @param {number[]} from */
  const comb = (R, from) => {
    const tv = sub3(R.d, from),
      tn = sub3(
        tv,
        R.n.map(v => v * dot3(tv, R.n))
      );
    return figureUnit(tn);
  };
  const whorl = [0, 0.62, -0.78],
    fringeOK = !brim,
    browY = c1 + H.r[1] * 0.04,
    /** grow every root (`every`: one in so many) as `S` with lengths `L` (metres at the usual head) */
    grow = (
      /** @type {number} */ every,
      /** @type {[number, number]} */ L,
      /** @type {number} */ w,
      S,
      lift = 0.3,
      from = whorl
    ) => {
      roots.forEach((R, i) => {
        if (i % every) return;
        if (R.front && !fringeOK) return;
        const dir = add3(R.front ? add3([0, -0.6, 0.55], R.n, 0.2) : comb(R, from), R.n, lift * vol),
          len = (L[0] + (L[1] - L[0]) * rnd(i)) * k;
        strand(add3(R.p, R.n, w * k * vol * 0.45), dir, R.front ? Math.min(len, 0.16 * k) : len, w * k * vol, {
          ...S,
          stop: R.front ? browY : S.stop,
          frame: !R.front,
        });
      });
    };
  /** a tie (a ponytail's, a bun's): every root swept to it */
  const sweep = (/** @type {Vec3} */ T, /** @type {number} */ every) =>
    roots.forEach((R, i) => {
      if (i % every) return;
      if (R.front && fringeOK && R.d[1] < 0.75) {
        strand(add3(R.p, R.n, 0.02 * k), add3([0, -0.6, 0.55], R.n, 0.2), 0.12 * k, 0.045 * k * vol, {
          grav: 0.5,
          stop: browY,
        });
        return;
      }
      strand(add3(R.p, R.n, 0.02 * k), add3(comb(R, [-T[0], 1, -T[2]]), R.n, 0.15), 0.5 * k, 0.045 * k * vol, {
        to: T,
        grav: 0,
        stiff: 0.4,
      });
    });
  /** a tail from a tie: strands bunched at it, falling and waving */
  const tail = (
    /** @type {Vec3} */ T,
    /** @type {number[]} */ dir,
    /** @type {number} */ n,
    /** @type {number} */ len
  ) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283,
        p0 = add3(T, [Math.cos(a) * 0.025 * k, Math.sin(a) * 0.025 * k, 0]);
      strand(
        p0,
        add3(dir, [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15]),
        len * k * (0.85 + 0.3 * rnd(400 + i)),
        0.05 * k * vol,
        {
          grav: 1,
          stiff: 0.75,
          wave: 0.22,
          freq: 1.3,
        }
      );
    }
  };
  if (hat) {
    /* below the hat: a fringe (not under a brim), and what shows of the style below the band */
    const U = HR.under;
    if (U && U.len[1] > 0) grow(1, U.len, U.w, U.strand, U.lift);
    if (U && U.tail)
      tail(
        add3(onSkull([U.tail.at[0], bandV + U.tail.at[1], U.tail.at[2]]), [0, 0, -U.tail.back * k]),
        U.tail.dir,
        U.tail.n,
        U.tail.len
      );
  } else
    for (const st of HR.steps)
      switch (st.op) {
        case 'grow': {
          /* combed from the whorl, or from `from` (a part, mirrored to the side the seed picks) */
          const side = kitRnd(seed, 5) < 0.5 ? 1 : -1,
            from = st.from ? (st.mirror ? [side * st.from[0], st.from[1], st.from[2]] : st.from) : whorl;
          grow(st.every, st.len, st.w, st.strand, st.lift, from);
          break;
        }
        case 'spikes':
          /* big clumps swept back and up from the brow, curving as they go, the front ones flicked forward over it */
          roots.forEach((R, i) => {
            if (i % st.every) return;
            const front = R.d[2] > st.front,
              dir = front
                ? add3(add3(R.n, [0, 0.5, 0.6]), [R.d[0], 0, 0], 0.5)
                : add3(add3(comb(R, whorl), R.n, 0.55), [0, 0.35, 0]);
            strand(add3(R.p, R.n, st.root * k), dir, (st.len + st.lenVar * rnd(i)) * k, st.w * k * vol, st.strand);
          });
          break;
        case 'bun': {
          const T = onSkull(st.at);
          sweep(add3(T, outAt(st.at), st.tie * k), st.every);
          const B = add3(T, outAt(st.at), st.out * k);
          items.push({
            p: { t: 'ell', c: B, r: [st.size[0] * k * vol, st.size[1] * k * vol, st.size[2] * k * vol] },
            op: 'add',
            k: blend * 2,
          });
          /* the bun wound round: a coil of strands */
          for (let i = 0; i < st.coil; i++) {
            const a0 = (i / st.coil) * 6.283 * st.turns,
              a1 = ((i + 1) / st.coil) * 6.283 * st.turns,
              R0 = st.coilR * k * vol * (1 - i * st.coilShrink),
              R1 = st.coilR * k * vol * (1 - (i + 1) * st.coilShrink);
            items.push({
              p: {
                t: 'cone',
                a: add3(B, [Math.cos(a0) * R0, (i / st.coil) * st.coilRise * k, Math.sin(a0) * R0]),
                b: add3(B, [Math.cos(a1) * R1, ((i + 1) / st.coil) * st.coilRise * k, Math.sin(a1) * R1]),
                ra: st.coilW * k,
                rb: st.coilW * k,
              },
              op: 'add',
              k: blend,
            });
          }
          break;
        }
        case 'tie': {
          /* a ponytail: swept to the tie, a knot, a tail */
          const T = add3(onSkull(st.at), [0, 0, -st.back * k]);
          sweep(T, st.every);
          items.push({
            p: { t: 'ell', c: T, r: [st.knot[0] * k, st.knot[1] * k, st.knot[2] * k] },
            op: 'add',
            k: blend,
          });
          tail(T, st.tail.dir, st.tail.n, st.tail.len);
          break;
        }
        case 'twin':
          /* two tails: each side's hair swept to its tie */
          for (const sg of [1, -1]) {
            const T = add3(onSkull([sg * st.at[0], st.at[1], st.at[2]]), [sg * st.out * k, 0, 0]);
            roots.forEach((R, i) => {
              if (i % st.every || Math.sign(R.d[0] || 1) !== sg) return;
              strand(add3(R.p, R.n, 0.02 * k), add3(comb(R, [0, 1, 0]), R.n, 0.15), st.len * k, 0.045 * k * vol, {
                to: T,
                grav: 0,
                stiff: 0.4,
              });
            });
            tail(T, [sg * st.tail.dir[0], st.tail.dir[1], st.tail.dir[2]], st.tail.n, st.tail.len);
          }
          break;
      }
  /* an antenna strand standing up off the crown */
  if (o.ahoge && !hat) strand(onSkull([0, 0.97, 0.2]), [0.2, 1, 0.3], 0.16 * k, 0.03 * k, { grav: 1.4, stiff: 0.9 });
  add('hair', 'head', [0, 0, 0], { kind: 'sdf', items, h: H.r[0] / 13, c: sc, r: sr }, 'hair');
}

/**
 * a hat's parts on the head: a cap with its peak, a beanie with its fold and bobble, a hard hat, a bucket hat, a
 * cowboy hat, a top hat with its band, a chef's toque, a crown
 * @param {(id: string, parent: string | null, at: Vec3, sh: FigureShape, col: string) => void} add
 * @param {string} hat @param {{ c: Vec3, r: Vec3 }} H the head @param {number} [crown] how high its cranium rises
 * (figureKit.json heads) @param {FigureKitData} [kit] the kit's data
 */
export function kitHat(add, hat, H, crown = 1, kit = figureKitData()) {
  /* the owner (2026-10-28: "hats also look weird"): a hat is its own forms fitted round the head and the hair under
     it: a crown from a band at the forehead up over the top of the head, then a bill, a brim, a band, a fold. CH-5:
     its shapes are game/data/figureKit.json's (a hat the kit has no shapes for is a plain crown, a cap's) */
  const { c, r } = H,
    bx = r[0] * 1.1,
    bz = r[2] * 1.14,
    frame = {
      k: r[0] / 0.31,
      rx: r[0],
      /* the band at the forehead, the head's middle front to back, the crown's radii, the top of the head */
      yb: c[1] + r[1] * 0.18,
      zc: c[2] - r[2] * 0.06,
      bx,
      bz,
      top: c[1] + r[1] * (Math.max(1.04, crown) + 0.06),
    };
  kitAccessory(add, kit.accessories[hat] || { rows: [kit.accessories.hat_cap.rows[0]] }, frame, 'head');
}

/**
 * CH-6: a figure's face set: its resting mouth, the talking frames, and each expression's eyes, mouth, blush and
 * talking frames (faces.expressions), for figure-pose.js figureFaceState
 * @param {{ mouth: string }} style @param {FigureKitData['faces']} FC @returns {import('./figure-pose.js').FaceSet}
 */
export function kitFaceSet(style, FC) {
  return {
    mouth: style.mouth,
    talk: FC.talk.slice(),
    expr: Object.fromEntries(
      Object.entries(FC.expressions).map(([id, X]) => [
        id,
        { eyes: X.eyes, mouth: X.mouth || null, blush: !!X.blush, ...(X.talk ? { talk: X.talk.slice() } : {}) },
      ])
    ),
  };
}
/**
 * CH-6: the face styles a look's wardrobe ids draw (figureKit.json faces.wardrobe, else faces.defaults), and its resting
 * mood (the first of faces.rest its ids match; else calm); no brows when it wears none. A person's `figure` choice
 * (people/<id>.json) picks any of the kit's eye and brow styles over the look's
 * @param {Record<string, string | null>} wear @param {FigureKitData['faces']} FC @param {FigureShapeChoice} [choice]
 * @returns {{ eyes: string, brows: string | null, mouth: string, mood: string }}
 */
export function kitFaceStyles(wear, FC, choice = {}) {
  const pick = (/** @type {'eyes' | 'brows' | 'mouth'} */ slot) => {
    const own = slot === 'eyes' ? choice.eyes : slot === 'brows' ? choice.brows : undefined;
    if (own && (slot === 'eyes' ? FC.eyes : FC.brows)[own]) return own;
    const id = wear[slot];
    if (slot === 'brows' && !id) return null;
    const v = id ? FC.wardrobe[id] : undefined;
    return v && (slot === 'mouth' ? FC.mouths : slot === 'eyes' ? FC.eyes : FC.brows)[v] ? v : FC.defaults[slot];
  };
  const rule = FC.rest.find(R =>
    /** @type {('eyes' | 'brows' | 'mouth')[]} */ (['eyes', 'brows', 'mouth']).every(
      sl => !R[sl] || R[sl].includes(String(wear[sl] || ''))
    )
  );
  return {
    eyes: /** @type {string} */ (pick('eyes')),
    brows: pick('brows'),
    mouth: /** @type {string} */ (pick('mouth')),
    mood: rule && FC.moods[rule.mood] ? rule.mood : 'calm',
  };
}
/**
 * the face as marks on the head (logic/figure-pose.js figureFaceMarks paints them in whole pixels): eyes by style
 * with a glint and an iris, lashes, brows by style, the mouth by style (a grin's teeth), blush, freckles, a stache,
 * stubble, and glasses (round and square frames, sunglasses, a monocle)
 * @param {{ c: Vec3, r: Vec3, kind?: string, items?: import('./figure-pose.js').SdfItem[] }} H @param {Record<string, string | null>} wear
 * @param {KitLook} look @param {Record<string, Vec3>} colours @param {number} seed @param {FigureKitData} [kit]
 * @param {FigureShapeChoice} [choice] @returns {FaceMark[]}
 */
export function kitFaceMarks(H, wear, look, colours, seed, kit = figureKitData(), choice = {}) {
  /** @type {FaceMark[]} */
  const out = [];
  const FC = kit.faces,
    { c, r } = H,
    /** @param {string} kind @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<FaceMark>} [o] */
    mark = (kind, x, y, w, h, o = {}) => out.push({ part: 'head', kind, ...frontOf(H, x, y), w, h, ...o }),
    /* every size is the spike's head's times how big this head is */
    k = r[0] / 0.31,
    /* CH-6: each wardrobe id draws a style of the kit's data (figureKit.json faces), the portrait kit's */
    style = kitFaceStyles(wear, FC, choice),
    ES = FC.eyes[style.eyes],
    /* eyes set wider or closer, higher or lower, by the person (and the style: wide-set) */
    ex = r[0] * (0.32 + 0.06 * kitRnd(seed, 23)) * (ES.gap ?? 1),
    ey = c[1] - r[1] * (0.07 + 0.07 * kitRnd(seed, 24)),
    /* the owner (2026-10-28: "the eyes look way too chibi and cute"): almond eyes, wider than tall, under a heavy lid;
       wide ones open more, sharp and sleepy ones narrower */
    ew = ES.w * k,
    eh = ES.h * k,
    /* the face's resting mood from the look's brows and mouth (faces.rest) */
    MD = FC.moods[style.mood];
  colours.irisD = figureMix(figureDark(colours.iris, 0.5), [30, 20, 70], 0.3);
  colours.irisL = figureMix(colours.iris, [255, 255, 240], 0.3);
  colours.tongue = [214, 92, 104];
  colours.crease = figureMix(figureDark(colours.skin, 0.74), [120, 70, 90], 0.15);
  colours.lip = figureMix(colours.skin, [196, 96, 104], 0.32);
  colours.blush = figureMix(colours.skin, [230, 120, 120], 0.3);
  /* a little colour on the cheeks, in a close-up only: some people's always, everyone's when glad (CH-6: an
     expression's `blush`) */
  const blushes = kitRnd(seed, 40) < 0.3 || ES.blush;
  for (const s of [1, -1])
    mark('blush', s * r[0] * 0.58, c[1] - r[1] * 0.36, 0.08 * k, 0.03 * k, {
      shape: 'oval',
      close: true,
      min: 0.35,
      ...(blushes ? {} : { when: 'blush' }),
    });
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
  const lidY = ey + eh * MD.lid,
    irisK = ES.iris ?? 1,
    flicks = ES.flicks ?? 1,
    wing = ES.wing ?? 1;
  if (ES.shade) colours.lidShade = figureMix(colours.skin, [128, 84, 140], 0.38);
  /* CH-6: the eyes in every frame of faces.eyeFrames (open, half, closed, happy, angry, wide, narrow, bored and
     glancing), each mark tagged with its frame (`when`; figureFaceMarks shows the face state's) */
  for (const [fr, EF] of Object.entries(FC.eyeFrames)) {
    const when = 'eyes:' + fr,
      /** @param {string} kind @param {number} x @param {number} y @param {number} w @param {number} h @param {Partial<FaceMark>} [o] */
      em = (kind, x, y, w, h, o = {}) => mark(kind, x, y, w, h, { ...o, when }),
      op = EF.open ?? 1,
      sc = EF.scale ?? 1,
      ew2 = ew * sc,
      eh2 = eh * sc,
      /* a lid coming down covers the eye's top: the line drops, what shows of the eye is lower and shorter */
      top = (1 - op) * eh2,
      ly = lidY + (sc - 1) * eh * 0.5 - top,
      cy = ey - top * 0.5;
    for (const s of [1, -1]) {
      const ix = s * (ex - ew2 * 0.06) + (EF.look || 0) * ew2 * 0.22,
        ik = irisK * (EF.iris ?? 1),
        lash = (/** @type {number} */ y) => {
          /* the lashes: the outer corner's flick drawn out (an almond's and a sharp eye's longer, a wing), a second
             below it, a third on top (lashy) */
          if (flicks > 0)
            em('flick', s * (ex + ew * (0.48 + 0.12 * wing)), y - eh * 0.12, ew * 0.24 * wing, eh * 0.4, {
              col: 'lash',
              shape: 'slant',
              dir: s,
              t: 0.014 * k,
              min: 0.35,
            });
          if (flicks > 1)
            em('flick', s * (ex + ew * 0.7), y + eh * 0.04, ew * 0.22, eh * 0.36, {
              col: 'lash',
              shape: 'slant',
              dir: s,
              t: 0.014 * k,
              min: 0.35,
            });
          if (flicks > 2)
            em('flick', s * (ex + ew * 0.28), y + eh * 0.24, ew * 0.18, eh * 0.34, {
              col: 'lash',
              shape: 'slant',
              dir: s,
              t: 0.012 * k,
              min: 0.4,
            });
        };
      if (EF.shut || EF.happy) {
        /* shut: the lid's line curved down (a blink, a sleeper); happy: curved up, the kit's ^ ^ */
        em(
          'eye',
          s * (ex + ew * 0.06),
          EF.happy ? ey + eh * 0.05 : ey - eh * 0.1,
          ew * 1.12,
          Math.max(eh * 0.4, 0.022),
          {
            glint: false,
            shape: EF.happy ? 'cap' : 'arc',
            t: 0.016 * k,
            col: 'lash',
          }
        );
        lash(EF.happy ? ey + eh * 0.3 : ey);
      } else {
        em('white', s * ex, cy, ew2, eh2 * op, { col: 'sclera', shut: true, narrow: true, shape: 'oval' });
        em('iris', ix, cy + eh2 * 0.04, ew2 * 0.48 * ik, eh2 * 1.02 * op, { col: 'iris', narrow: true, shape: 'oval' });
        em('irisD', ix, cy + eh2 * 0.3 * op, ew2 * 0.48 * ik, eh2 * 0.36 * op, {
          col: 'irisD',
          shut: true,
          narrow: true,
          shape: 'cap',
        });
        if (op >= 0.7)
          em('irisL', ix, cy - eh2 * 0.28, ew2 * 0.3 * ik, eh2 * 0.2, {
            col: 'irisL',
            shut: true,
            narrow: true,
            close: true,
          });
        em('pupil', ix, cy + eh2 * 0.02, ew2 * 0.2 * ik, eh2 * 0.46 * Math.min(1, op * 1.3), {
          col: 'eye',
          shut: true,
          narrow: true,
          shape: 'oval',
        });
        if (op >= 0.6)
          em('shine', ix + s * ew2 * 0.1, cy + eh2 * 0.22, ew2 * 0.13, ew2 * 0.13, {
            col: 'glint',
            shut: true,
            min: 0.55,
          });
        if (ES.lid)
          em('lid', s * ex, ey + eh * ES.lid[0] - top * 0.5, ew * ES.lid[1], eh * ES.lid[2], {
            col: 'skin',
            shut: true,
          });
        /* a shadowed eye's lid, tinted, over the eye's top */
        if (ES.shade)
          em('shade', s * ex, ly + eh * 0.3, ew2 * 1.12, eh * 0.42, {
            col: 'lidShade',
            shape: 'oval',
            close: true,
            min: 0.4,
          });
        /* the upper lid: an arch, flat when bored; an angry eye's lid slants down to the nose */
        em('eye', s * (ex + ew2 * 0.06), ly, ew2 * 1.16, Math.max(eh * 0.32, 0.016 * k), {
          glint: false,
          col: 'lash',
          ...(EF.flat ? {} : { shape: 'cap' }),
        });
        if (EF.slant)
          em('lidS', s * ex, ly - eh2 * 0.06, ew2 * 1.1, eh2 * 0.4, {
            col: 'lash',
            shape: 'slant',
            dir: EF.slant > 0 ? -s : s,
            t: 0.018 * k,
            min: 0.35,
          });
        lash(ly);
        em('under', s * ex, ey - eh * 0.56, ew * 0.66, 0.01 * k, { col: 'crease', shut: true, close: true, min: 0.5 });
      }
    }
  }
  for (const s of [1, -1]) {
    mark('crease', s * (ex + ew * 0.04), lidY + eh * 0.42 + 0.008 * k, ew * 0.9, 0.012 * k, {
      col: 'crease',
      shape: 'cap',
      close: true,
      min: 0.45,
    });
    /* a tired eye's bags show at any size; a weary one's lines in a close-up */
    if (ES.bags) mark('bags', s * ex, ey - eh * 0.72, ew * 0.74, 0.012 * k, { col: 'crease', shape: 'arc', min: 0.5 });
    if (ES.lines)
      mark('lines', s * (ex + ew * 0.1), lidY + eh * 0.78, ew * 0.8, 0.01 * k, {
        col: 'crease',
        shape: 'cap',
        close: true,
        min: 0.5,
      });
  }
  /* the nostrils' shadow under the tip of the nose */
  mark('nose', 0, c[1] - r[1] * 0.43, 0.034 * k, 0.012 * k, { col: 'crease', min: 0.45 });
  /* brows close over the eyes, by style (the portrait kit's twelve): a slant where the style or the mood tilts them
     (down to the nose cross, up worried), else a peak, a flat bar or a low arch; one side higher on an uneven pair,
     a crease between knit ones, tufts on bushy ones */
  const by = lidY + 0.034 * k + eh * 0.25;
  if (style.brows) {
    const BS = FC.brows[style.brows],
      thick = BS.t,
      bw = (0.092 * BS.w) / 0.09;
    /* CH-6: a pair for each expression (faces.expressions: its tilt and lift over the style's own) */
    for (const [xid, X] of Object.entries(FC.expressions)) {
      const when = 'brows:' + xid,
        tilt = (BS.tilt || 0) + (X.tilt || 0);
      for (const s of [1, -1]) {
        const bx = s * (ex + 0.008 * k),
          y = by + (X.lift || 0) * k + (s < 0 ? BS.uneven || 0 : 0) * k;
        if (Math.abs(tilt) >= 0.5)
          mark('brow', bx, y, bw * k, 0.017 * Math.abs(tilt) * k, {
            col: 'brow',
            shape: 'slant',
            dir: tilt > 0 ? -s : s,
            t: thick * k,
            when,
          });
        else if (BS.peak)
          for (const [dx, dir] of [
            [-0.25, -s],
            [0.25, s],
          ])
            mark('brow', bx + s * dx * BS.w * k, y + 0.004 * k, BS.w * 0.5 * k, (0.02 + thick * 0.5) * k, {
              col: 'brow',
              shape: 'slant',
              dir,
              t: thick * k,
              when,
            });
        else if (BS.flat) mark('brow', bx, y, BS.w * k, thick * k, { col: 'brow', when });
        else
          mark('brow', bx, y, BS.w * k, (0.016 + thick * 0.7 + (BS.arch || 0)) * k, {
            col: 'brow',
            shape: 'cap',
            t: thick * k,
            when,
          });
        if (BS.bushy)
          for (const dx of [-0.22, 0.18])
            mark('brow', bx + s * dx * BS.w * k, y + (0.012 + thick * 0.5) * k, 0.014 * k, 0.012 * k, {
              col: 'brow',
              close: true,
              when,
            });
      }
    }
    if (BS.knit) mark('brow', 0, by - 0.012 * k, 0.008 * k, 0.024 * k, { col: 'crease', close: true, min: 0.45 });
  }
  /* the mouth, a frame of faces.mouths (a smile's arc; a grin open on teeth; an open mouth; a smirk tucked to one side;
     a neutral line; and in a close-up the lower lip's shade) */
  const my = c[1] - r[1] * (0.56 + 0.08 * kitRnd(seed, 25));
  if (wear.facial === 'facial_stache') mark('stache', 0, my + 0.04 * k, 0.1 * k, 0.034 * k, { col: 'brow', min: 0.25 });
  /* a goatee under the lower lip, down the chin */
  if (wear.facial === 'facial_goatee')
    mark('goatee', 0, my - 0.05 * k, 0.044 * k, 0.046 * k, { col: 'brow', min: 0.25, shape: 'oval' });
  /* CH-6: every mouth frame, tagged (the resting one is the look's; talking runs through others) */
  for (const [fr, rows] of Object.entries(FC.mouths))
    for (const m of rows) {
      const { kind, x = 0, y = 0, w, h, t, ...o } = m;
      mark(kind, x * k, my + y * k, w * k, h * k, {
        ...o,
        ...(t === undefined ? {} : { t: t * k }),
        when: 'mouth:' + fr,
      });
    }
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
 * @param {Figure} F @param {{ data: Float32Array, count: number }} [M0] the figure's mesh if already built (any detail)
 * @returns {import('./figure-pose.js').FigureExtent}
 */
export function kitExtent(F, M0) {
  const M = M0 || figureMesh(F),
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
/**
 * CH-4: a code figure's extent and its GPU mesh at `detail` from one build of its mesh (CH-3b built it twice when a
 * figure was first wanted: once to measure, once to draw; about 150 + 230 ms for a gouache-night figure in Node)
 * @param {Figure} F @param {number} [detail]
 * @returns {{ ext: import('./figure-pose.js').FigureExtent, data: Float32Array, count: number, colours: string[],
 *   slots: number[] }}
 */
export function kitBuild(F, detail = 1) {
  const M = figureMesh(F, detail),
    ext = kitExtent(F, M);
  return { ext, ...figureGpuMesh(F, detail, M) };
}
