'use strict';
/* ================= WALK PROP LOOKS =================
   Phase 20 (stage B): every prop's look (material, slope, foliage, variety, alternates, wind lean) and the props'
   grid, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { SPECIES, propBaseHeight, provide, reducedMotion, riderOf, saveData } from '../hooks.js';
import { clamp } from '../util.js';
import { spanFit, tiltSpin, turnedPoint } from '../logic/prop-turn.js';
import { hexToRgb, makeCanvas } from '../art.js';
import { drawRig, rigFrame, rigParts, rigPreload } from '../skeleton-rig.js';
import { artImage, hash2d, imageReady, terrainAt, walkView } from '../walk-view.js';
import { engineSetting } from '../engine/settings.js';
import { SURFACE_MATERIALS, gpuState, windBendAt } from '../engine/webgl.js';
import { FIXED_RIGHT, walkRenderer } from './walk-state.js';
import { groundHeightAt, standingHeightAt } from './heights.js';
import { addWakeRipple } from './water.js';
/* eslint-disable no-func-assign */
expose({
  ALTERNATE_PROPS: [() => ALTERNATE_PROPS],
  BOBBING_PROPS: [() => BOBBING_PROPS],
  EVERGREEN_PROPS: [() => EVERGREEN_PROPS],
  FOLIAGE_PROPS: [() => FOLIAGE_PROPS],
  NEUTRAL_LOOK: [() => NEUTRAL_LOOK],
  PROP_LOOK_CACHE: [() => PROP_LOOK_CACHE],
  PROP_VARIETY_DEFAULT: [() => PROP_VARIETY_DEFAULT],
  PROP_VARIETY_RULES: [() => PROP_VARIETY_RULES],
  SLOPE_HUGGERS: [() => SLOPE_HUGGERS],
  SLOPE_HUG_CACHE: [() => SLOPE_HUG_CACHE],
  STILL_PROP_CACHE: [() => STILL_PROP_CACHE],
  WAVING_PROPS: [() => WAVING_PROPS],
  alternatePropImage: [() => alternatePropImage, v => (alternatePropImage = v)],
  computePropLook: [() => computePropLook, v => (computePropLook = v)],
  foliageAmount: [() => foliageAmount, v => (foliageAmount = v)],
  hugSlope: [() => hugSlope, v => (hugSlope = v)],
  propCheckedAt: [() => propCheckedAt, v => (propCheckedAt = v)],
  propGrid: [() => propGrid, v => (propGrid = v)],
  propLook: [() => propLook, v => (propLook = v)],
  propLookSettings: [() => propLookSettings, v => (propLookSettings = v)],
  propMaterial: [() => propMaterial, v => (propMaterial = v)],
  propModelTip: [() => propModelTip, v => (propModelTip = v)],
  propVariety: [() => propVariety, v => (propVariety = v)],
  rideMountItem: [() => rideMountItem, v => (rideMountItem = v)],
  setPropLookUniforms: [() => setPropLookUniforms, v => ((setPropLookUniforms = v), provide({ setPropLookUniforms }))],
  stillPropState: [() => stillPropState, v => (stillPropState = v)],
  windLeanAt: [() => windLeanAt, v => (windLeanAt = v)],
});
/* eslint-enable no-func-assign */
provide({ setPropLookUniforms });
/* to-module: end */
export function propMaterial(k, M) {
  if (M && M.mat && SURFACE_MATERIALS[M.mat]) return M.mat;
  const n = ((M && M.group) || '') + ' ' + k;
  if (/house|shop|clinic|lab|bunker|tent|stall|windmill|busstop|kiosk/.test(n)) return 'building';
  if (/crystal|glass|coral/.test(n)) return 'crystal';
  if (/tree|bush|hedge|flower|reed|cattail|lily|grass|crop|seaweed|cactus|mushroom|vine|plant|hay/.test(n))
    return 'foliage';
  if (/lamp|lantern|pipe|derrick|tire|scrap|bin|trash|escal|salesign|cartS|pretzel|mailbox|flag/.test(n))
    return 'metal';
  if (/rock|boulder|well|fountain|statue|stalag|mesa|stepping|planter|flowerpot|cave|arch/.test(n)) return 'stone';
  if (/fence|bench|sign|crate|barrel|log|stump|cart|picnic|table|campfire|planter_box/.test(n)) return 'wood';
  if (/mesa/.test(n)) return 'stone';
  if (/escal|bin|pretzel|derrick/.test(n)) return 'metal';
  return M && M.box ? 'building' : 'plain';
}
/* ---------- what stands in the scene this frame ---------- */
/* v23: low, wide things (fences, benches, logs, rocks, hedges, planters) follow the slope they stand on: a picture's two
   ends sit on the ground (a vertical skew along its width), a solid prop tilts with the ground. Upright things (trees,
   lamps, signs, people, buildings) stay plumb. Steps of a cliff aren't a slope: anything steeper than 35° stays level. */
const SLOPE_HUGGERS =
  /fence|bench|log|rock|boulder|stone|hedge|planter|crate|pipe|rail|wall|bush|flower|hay|pumpkin|melon|crop|tire|planks|stump|vineyard/;
/* v26: how much a thing is leaves or grass (it turns with the seasons; evergreens hardly) and whether snow settles on it */
const FOLIAGE_PROPS =
    /tree_(oak|fruit|birch|maple|willow|blossom)|street_tree|^tree$|bush|hedge|tallgrass|reeds|cattail|flowers|fern|crops|vine|ivy|lily|grass/,
  EVERGREEN_PROPS = /pine|palm|cactus|dead|snow/;
export function foliageAmount(it) {
  if (!it || it.k !== 'prop' || it.person || !it.M) return [0, 0];
  const M = it.M;
  if (M._fol) return M._fol;
  const g = (M.group || '') + ' ' + ((it.p && it.p.k) || '');
  return (M._fol = [
    EVERGREEN_PROPS.test(g)
      ? 0.3
      : /tallgrass|reeds|cattail|grass|fern|flowers|crops|lily/.test(g)
        ? 0.7
        : FOLIAGE_PROPS.test(g)
          ? 1
          : 0,
    it.flat || /puddle|crosswalk|manhole|lily|fallen/.test(g) ? 0 : 1,
  ]);
}
/* alpha 0.4.1: worked out once per prop and kept (the ground doesn't move): six height samples a prop every frame were
   a quarter of gathering the frame's items in a big place; the slope across the view again only when the camera turns */
const SLOPE_HUG_CACHE = new WeakMap();
export function hugSlope(it, C) {
  if (!it || it.bld3 || it.flat || !engineSetting('world', 'hugSlopes')) return;
  const M = it.M,
    p = it.p;
  if (M._hugK !== p.k) {
    M._hugK = p.k;
    const g = (M.group || '') + ' ' + p.k;
    M._hug = SLOPE_HUGGERS.test(g) && !/tree|lamp|post|sign|pole/.test(g);
  }
  if (!M._hug) return;
  const R = it.fixed ? FIXED_RIGHT : C.right,
    e = 0.45,
    h = (x, z) => groundHeightAt(x, z),
    x = it.x,
    z = it.z,
    id = walkView.id,
    ig = walkRenderer.itemGen || 0;
  let c = SLOPE_HUG_CACHE.get(p);
  if (!c || c.id !== id || c.ig !== ig || c.x !== x || c.z !== z) {
    const gx = (h(x + e, z) - h(x - e, z)) / (2 * e),
      gz = (h(x, z + e) - h(x, z - e)) / (2 * e),
      gm = Math.hypot(gx, gz);
    c = { id, ig, x, z, tilt: gm < 0.7 && gm > 0.02 ? [gx, gz] : null, rx: NaN, rz: NaN, slope: null };
    SLOPE_HUG_CACHE.set(p, c);
  }
  if (c.rx !== R[0] || c.rz !== R[2]) {
    const s = (h(x + R[0] * e, z + R[2] * e) - h(x - R[0] * e, z - R[2] * e)) / (2 * e);
    c.rx = R[0];
    c.rz = R[2];
    c.slope = Math.abs(s) > 0.02 && Math.abs(s) < 0.7 ? s : null;
  }
  if (c.slope != null) it.slope = c.slope;
  if (c.tilt) it.tilt = c.tilt;
}
/* v24: riding. On water in a riding scene you sit on your biggest Water billionaire (rules.ride), drawn from its rig,
   facing away when you head up the screen; it bobs, and leaves ripple rings behind. WA-6b: and anywhere you Surf
   (walk-view.js P.surf: on deep water, and up a waterfall), the lift eased in as you mount at the edge; rings now and
   then while you sit still. */
export function rideMountItem(P, t) {
  const sc = walkView.sc;
  if (!sc || typeof riderOf !== 'function' || typeof saveData === 'undefined' || !saveData.team) return null;
  const surf = !!P.surf || !!(P.climb && P.climb.fall);
  if (!sc.ride && !surf) {
    walkRenderer.mountOn = false;
    return null;
  }
  const ch = terrainAt(P.x, P.z);
  if (!surf && ch !== 'w' && ch !== 'd') {
    walkRenderer.mountOn = false;
    return null;
  }
  const m =
    riderOf() ||
    saveData.team.find(x => x.hp > 0 && SPECIES[x.sp] && SPECIES[x.sp].types.includes('Water')) ||
    saveData.team.find(x => SPECIES[x.sp] && SPECIES[x.sp].types.includes('Water'));
  if (!m || !SPECIES[m.sp]) return null;
  const back = P.dir === 'up',
    R = rigParts(m.sp, back ? 2 : 1, m.coat);
  if (!R) {
    if (!walkRenderer.mountLoad) {
      walkRenderer.mountLoad = 1;
      rigPreload([
        [m.sp, 1, m.coat],
        [m.sp, 2, m.coat],
      ]).then(() => {
        walkRenderer.mountLoad = 0;
      });
    }
    return null;
  }
  let cv = walkRenderer.mountCv;
  if (!cv || cv.width !== R.BW || cv.height !== R.BH) {
    cv = walkRenderer.mountCv = makeCanvas(R.BW, R.BH);
    cv.__v = 0;
  }
  const x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, cv.width, cv.height);
  x.imageSmoothingEnabled = false;
  const F = rigFrame(R, null, 0, reducedMotion ? 0 : Math.floor(t / 50) * 50, 1.7);
  if (m.build) F.build = m.build;
  drawRig(x, R, F, back ? 'back' : 'front');
  cv.__v++;
  const ht = clamp(SPECIES[m.sp].ht, 0.9, 3),
    hm = 0.75 + ht * 0.32,
    mpp = hm / Math.max(40, R.base - (R.geo && R.geo.top != null ? R.geo.top : 0)),
    bob = reducedMotion ? 0 : Math.sin(t / 420) * 0.05,
    /* WA-6b: mounting at the edge: the lift eased in over a quarter second (P.surfT, when you got on) */
    ease = surf && !sc.ride && P.surfT != null && !reducedMotion ? clamp((walkView.t - P.surfT) / 250, 0, 1) : 1,
    y = (P.climb ? (P.yv ?? standingHeightAt(P.x, P.z)) : standingHeightAt(P.x, P.z)) + bob - 0.08;
  if (!reducedMotion && !P.climb && (!walkRenderer.wakeT || t - walkRenderer.wakeT > (P.walk ? 320 : 1800))) {
    walkRenderer.wakeT = t;
    /* water track WA-5b: the wake's own rings (walk/water.js addWakeRipple), so riding never pushes out the scene's */
    addWakeRipple(P.x, P.z - 0.1, P.walk ? 0.9 : 0.5);
  }
  walkRenderer.mountOn = true;
  return {
    it: {
      k: 'life',
      im: cv,
      x: P.x,
      z: P.z + 0.01,
      y,
      mpp,
      ox: -R.cx,
      oy: -R.base,
      w: R.BW,
      h: R.BH,
      flip: P.dir === 'side' ? -1 : 1,
      shear: 0,
      sh: 0,
      aoR: 0,
      person: 1,
    },
    lift: (hm * 0.62 + bob - 0.12) * ease * ease * (3 - 2 * ease),
  };
}
/* ---------- v32: every prop its own look ----------
   Variety (size, colour, a little turn and lean) and wear (dirt, moss, faded paint, cracks), from three places:
   defaults by kind of thing (below), the catalog ("vary" and "wear" on a prop in the Studio's prop editor) and each
   placed prop ("vary", "wear", "tint"), scaled by the scene ("variety", "wear") and the Engine dials (World →
   Variety, Wear and tear, Prop turning). Each placed prop draws its own values from where it stands, so a scene
   looks the same every visit. */
const PROP_VARIETY_RULES = [
  [/tree|palm|street_tree/, { size: 0.14, hue: 9, sat: 0.12, val: 0.1, rot: 0, lean: 1.5, mask: [104, 47], wear: {} }],
  [
    /bush|hedge|fern|tallgrass|reeds|cattail|crops|vine|ivy/,
    { size: 0.16, hue: 11, sat: 0.14, val: 0.1, rot: 10, lean: 2, mask: [104, 54], wear: {} },
  ],
  [/flower|lily/, { size: 0.16, hue: 22, sat: 0.1, val: 0.08, rot: 10, lean: 2, mask: null, wear: {} }],
  [
    /rock|boulder|stone|pebble|basalt|obsidian|stalag|crystal|mesa|lava_rock/,
    { size: 0.18, hue: 0, sat: 0.08, val: 0.09, rot: 22, lean: 3, mask: null, wear: { moss: 0.35, dirt: 0.1 } },
  ],
  [
    /house|shop|clinic|lab|tower|apartment|hall|villa|chalet|mart|cafe|boutique|windmill|cave_house|townhouse/,
    {
      size: 0,
      hue: 11,
      sat: 0.12,
      val: 0.06,
      rot: 0,
      lean: 0,
      mask: null,
      wear: { dirt: 0.38, moss: 0.2, fade: 0.25, crack: 0.22 },
    },
  ],
  [
    /crate|barrel|bench|fence|sign|cart|log|stump|wheelbarrow|picnic|table|chair|planter|hay|sack|firewood|beehive|birdhouse|dock_post|stall|scarecrow|laundry/,
    {
      size: 0.08,
      hue: 5,
      sat: 0.08,
      val: 0.1,
      rot: 7,
      lean: 1.5,
      mask: null,
      wear: { dirt: 0.25, moss: 0.15, fade: 0.25, crack: 0.12 },
    },
  ],
  [
    /lamp|lantern|hydrant|mailbox|bin|trash|bollard|traffic|phone|vending|newsstand|bus|bike|meter|pipe|tire|scrap|car_|food_truck|kiosk|pretzel/,
    {
      size: 0.04,
      hue: 7,
      sat: 0.08,
      val: 0.06,
      rot: 3,
      lean: 0.8,
      mask: null,
      wear: { dirt: 0.22, fade: 0.18, crack: 0.05 },
    },
  ],
  [
    /statue|fountain|well|arch|wall|column|snowman/,
    {
      size: 0.03,
      hue: 0,
      sat: 0.05,
      val: 0.06,
      rot: 0,
      lean: 0,
      mask: null,
      wear: { dirt: 0.25, moss: 0.3, crack: 0.25 },
    },
  ],
];
const PROP_VARIETY_DEFAULT = {
  size: 0.06,
  hue: 7,
  sat: 0.06,
  val: 0.06,
  rot: 5,
  lean: 1,
  mask: null,
  wear: { dirt: 0.12 },
};
export function propVariety(k, M) {
  const mk =
    M && M.vary ? JSON.stringify(M.vary) + JSON.stringify(M.wear || 0) : M && M.wear ? JSON.stringify(M.wear) : '';
  if (M && M._vy && M._vyk === mk) return M._vy;
  const g = ((M && M.group) || '') + ' ' + k;
  let d = PROP_VARIETY_DEFAULT;
  for (const [re, v] of PROP_VARIETY_RULES)
    if (re.test(g)) {
      d = v;
      break;
    }
  if (M && M.flat && !/flower|lily/.test(g)) d = Object.assign({}, d, { rot: 0, lean: 0 });
  const out = Object.assign({}, d, (M && M.vary) || {}, { wear: Object.assign({}, d.wear, (M && M.wear) || {}) });
  if (M) {
    Object.defineProperty(M, '_vy', { value: out, writable: true, configurable: true, enumerable: false });
    Object.defineProperty(M, '_vyk', { value: mk, writable: true, configurable: true, enumerable: false });
  }
  return out;
}
/* v32: a stump or log here and there is drawn with its mossy twin (same size and footprint), so a wood isn't a row of
   copies. Prop variety at 0, "Exactly as drawn" on the prop, or alt:0 on it keeps the picture as placed. */
const ALTERNATE_PROPS = { stump: ['stump_mossy'], log: ['log_mossy'] };
provide({ ALTERNATE_PROPS }); /* to-module */
export function alternatePropImage(p, M, C0, sc) {
  const L = ALTERNATE_PROPS[p.k];
  if (
    !L ||
    p.v ||
    p.plain ||
    p.alt === 0 ||
    !((engineSetting('world', 'variety') ?? 1) > 0) ||
    (sc && sc.variety === 0)
  )
    return M.img;
  const h = hash2d(Math.round(p.x * 23) + 5, Math.round(p.z * 19) + 11);
  if (h > 0.38) return M.img;
  const A = C0.props[L[Math.floor((h / 0.38) * L.length) % L.length]];
  const ai = A && A.img;
  if (!ai) return M.img;
  const t = artImage(ai);
  return imageReady(t) ? ai : M.img;
}
const PROP_LOOK_CACHE = new WeakMap();
/* v34: a still prop keeps what it worked out last frame (its look, its height on the ground, its material) and only
   checks again twice a second or when it moves, so a big scene doesn't redo hundreds of string keys every frame */
const STILL_PROP_CACHE = new WeakMap();
/* when a prop checked last, rounded down to its own half-second beat (set by its place): props worked out in the same
   frame (a scene opening, the ground changing) check again spread over the next half second, not all in one frame twice
   a second, which was a regular spike on phones */
function propCheckedAt(p, t) {
  return t - ((t + hash2d(Math.round(p.x * 7) + 3, Math.round(p.z * 5) + 11) * 500) % 500);
}
export function propGrid(sc) {
  const L = sc.props || [],
    G = walkRenderer.pgrid;
  /* made again only when a prop is added, moved or resized, or the ground changes (itemGen), not on a timer: a full
     rebuild every 2 s was a regular spike on phones; the signature reads every prop (cheap next to the rebuild) */
  let sig = L.length;
  for (const p of L) sig = (sig * 31 + (p.x * 7 + p.z * 13 + (p.s || 1) * 101) * 16) | 0;
  const gen = walkRenderer.itemGen || 0;
  if (G && G.sc === sc && G.sig === sig && G.gen === gen) return G;
  const S = 6,
    m = new Map();
  for (const p of L) {
    const k = Math.floor(p.x / S) + ',' + Math.floor(p.z / S);
    let c = m.get(k);
    if (!c) {
      c = { list: [], x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y0: 1e9, y1: -1e9 };
      m.set(k, c);
    }
    c.list.push(p);
    const r = 2.5 * (p.s || 1),
      y = typeof standingHeightAt === 'function' ? standingHeightAt(p.x, p.z) : 0;
    c.x0 = Math.min(c.x0, p.x - r);
    c.x1 = Math.max(c.x1, p.x + r);
    c.z0 = Math.min(c.z0, p.z - r);
    c.z1 = Math.max(c.z1, p.z + r);
    c.y0 = Math.min(c.y0, y);
    c.y1 = Math.max(c.y1, y + 8 * (p.s || 1));
  }
  const cells = [...m.values()].map(c => ({
    list: c.list,
    x: (c.x0 + c.x1) / 2,
    z: (c.z0 + c.z1) / 2,
    y: (c.y0 + c.y1) / 2,
    r: Math.hypot(c.x1 - c.x0, c.z1 - c.z0, c.y1 - c.y0) / 2,
  }));
  return (walkRenderer.pgrid = { sc, sig, gen, cells });
}
export function stillPropState(p, M, im, sc) {
  const t = walkView.t || 0,
    s = p.s || 1,
    id = walkView.id || '',
    src = (im && im.src) || '',
    gen = walkRenderer.itemGen || 0;
  let c = STILL_PROP_CACHE.get(p);
  /* alpha 0.4.1: compared field by field (a key string was built for every prop every frame) */
  if (
    c &&
    c.k === p.k &&
    c.x === p.x &&
    c.z === p.z &&
    c.s === s &&
    c.id === id &&
    c.src === src &&
    c.gen === gen &&
    t - c.at < 500 &&
    t >= c.at
  )
    return c;
  const mat = propMaterial(p.k, M),
    at = propCheckedAt(p, t);
  c = {
    k: p.k,
    x: p.x,
    z: p.z,
    s,
    id,
    src,
    gen,
    at,
    y: propBaseHeight(p, M),
    mat,
    plane: M.face === 'fixed' || !!M.box || mat === 'wood' || mat === 'building',
    cross:
      M.face !== 'billboard' &&
      !M.flat &&
      mat === 'foliage' &&
      /tree|flower|fern|tallgrass|reed|cattail|crop/.test((M.group || '') + p.k),
    bob: BOBBING_PROPS.test(p.k),
    flag: WAVING_PROPS.test(p.k),
  };
  propModelTip(p, M, c);
  STILL_PROP_CACHE.set(p, c);
  return c;
}
/* HB-6: a model tipped off the upright (logic/prop-turn.js): one that spans two points (a fence rail between its posts:
   the catalogue's restEnds) rests on the ground under each end, tipped between them; any other leans by its placement's
   tilt. Pictures don't tip. */
function propModelTip(p, M, c) {
  c.spin = null;
  if (!M.model) return;
  if (M.restEnds && M.box) {
    const L = M.box[0] * (p.s || 1),
      a = turnedPoint(p, -L / 2, 0),
      b = turnedPoint(p, L / 2, 0),
      F = spanFit(L, standingHeightAt(a[0], a[1]), standingHeightAt(b[0], b[1]), p.f ? -1 : 1);
    c.y = F.y;
    c.spin = F.spin;
  } else c.spin = tiltSpin(p.tilt);
}
/* alpha 0.4.1: the settings a prop's look depends on, read once a frame rather than once a prop */
function propLookSettings(sc) {
  if (walkRenderer._lsF === walkRenderer.frames && walkRenderer._lsSc === sc) return walkRenderer._ls;
  walkRenderer._lsF = walkRenderer.frames;
  walkRenderer._lsSc = sc;
  return (walkRenderer._ls =
    (engineSetting('world', 'variety') ?? 1) +
    ',' +
    (engineSetting('world', 'wear') ?? 1) +
    ',' +
    (engineSetting('world', 'propTurn') ?? 1) +
    ',' +
    (sc.variety ?? 1) +
    ',' +
    (sc.wear ?? 1) +
    ',' +
    (sc.lookSeed || 0));
}
export function propLook(p, M, sc) {
  const c0 = PROP_LOOK_CACHE.get(p),
    t = walkView.t || 0,
    sg = propLookSettings(sc);
  if (
    c0 &&
    c0.at !== undefined &&
    t - c0.at < 500 &&
    t >= c0.at &&
    c0.px === p.x &&
    c0.pz === p.z &&
    c0.sg === sg &&
    c0.gen === (walkRenderer.itemGen || 0)
  )
    return c0;
  const L0 = computePropLook(p, M, sc);
  L0.at = propCheckedAt(p, t);
  L0.px = p.x;
  L0.pz = p.z;
  L0.sg = sg;
  L0.gen = walkRenderer.itemGen || 0;
  return L0;
}
function computePropLook(p, M, sc) {
  const E = [
      engineSetting('world', 'variety') ?? 1,
      engineSetting('world', 'wear') ?? 1,
      engineSetting('world', 'propTurn') ?? 1,
    ],
    key =
      p.k +
      '|' +
      p.x +
      '|' +
      p.z +
      '|' +
      JSON.stringify(p.vary || 0) +
      JSON.stringify(p.wear ?? 0) +
      (p.tint || '') +
      (p.tintAmt ?? '') +
      (p.plain ? 'P' : '') +
      '|' +
      (sc.variety ?? 1) +
      '|' +
      (sc.wear ?? 1) +
      '|' +
      (sc.lookSeed || 0) +
      '|' +
      E.join(',') +
      '|' +
      (M && M._vyk !== undefined ? M._vyk : '') +
      (M && M.vary ? JSON.stringify(M.vary) : '') +
      (M && M.wear ? JSON.stringify(M.wear) : '');
  const c = PROP_LOOK_CACHE.get(p);
  if (c && c.key === key) return c;
  const V = Object.assign({}, propVariety(p.k, M), p.vary || {}),
    sd = (sc.lookSeed || 0) * 101,
    r = n => hash2d(Math.round(p.x * 31) + n * 17 + sd, Math.round(p.z * 29) + n * 7 + sd) * 2 - 1,
    vk = p.plain ? 0 : E[0] * (sc.variety ?? 1);
  let W = Object.assign({}, V.wear);
  if (typeof p.wear === 'number') for (const k in W) W[k] *= p.wear;
  else if (p.wear && typeof p.wear === 'object') Object.assign(W, p.wear);
  const wk = E[1] * (sc.wear ?? 1),
    dry = /[sznj]/.test(sc.edge || '') || /desert|volcano|canyon/.test(sc.far || '') ? 0.25 : 1,
    jit = n => 0.55 + 0.9 * hash2d(Math.round(p.x * 13) + n * 5, Math.round(p.z * 11) + n * 3);
  const wear = [
    (W.dirt || 0) * wk * jit(1),
    (W.moss || 0) * wk * jit(2) * dry,
    (W.fade || 0) * wk * jit(3),
    (W.crack || 0) * wk * jit(4),
  ].map(v => clamp(v, 0, 1.5));
  const hue = ((V.hue || 0) / 360) * vk * r(1),
    sat = (V.sat || 0) * vk * r(2),
    val = (V.val || 0) * vk * r(3),
    on = Math.abs(hue) + Math.abs(sat) + Math.abs(val) > 0.002 ? 1 : 0;
  let tint = [1, 1, 1, 0];
  if (p.tint && p.tint !== '#000000') {
    const t = hexToRgb(p.tint);
    tint = [t[0] / 255, t[1] / 255, t[2] / 255, clamp(p.tintAmt ?? 0.6, 0, 1)];
  }
  const L = {
    key,
    hsv: [hue, sat, val, on],
    wear,
    tint,
    mask: V.mask && V.mask.length === 2 && V.mask[1] > 0 ? [V.mask[0] / 360, V.mask[1] / 360] : [0, 0],
    size: 1 + (V.size || 0) * vk * r(4) * (p.s && p.vary && p.vary.size === 0 ? 0 : 1),
    rot: p.plain ? 0 : ((V.rot || 0) * E[2] * r(5) * Math.PI) / 180,
    lean: p.plain ? 0 : ((V.lean || 0) * E[2] * r(6) * Math.PI) / 180,
  };
  PROP_LOOK_CACHE.set(p, L);
  return L;
}
const NEUTRAL_LOOK = { hsv: [0, 0, 0, 0], wear: [0, 0, 0, 0], tint: [1, 1, 1, 0], mask: [0, 0] };
export function setPropLookUniforms(U, L, bp) {
  const gl = gpuState.gl;
  if (!U.uWear) return;
  L = L || NEUTRAL_LOOK;
  gl.uniform4fv(U.uWear, L.wear);
  gl.uniform4fv(U.uHsv, L.hsv);
  gl.uniform4fv(U.uLkTint, L.tint);
  gl.uniform2fv(U.uMaskH, L.mask);
  if (U.uBP && bp) gl.uniform3fv(U.uBP, bp);
}
const BOBBING_PROPS = /sailboat|rowboat|buoy/,
  WAVING_PROPS = /banner|laundry|beach_umbrella|ski_sign/;
/* v43: one wind for every plant: a slow lean that drifts across the scene, a faster flutter, and the gust bands
   (windGustAt) that travel over the grass; the result is a lean of the top of the sprite as a fraction of its height */
export function windLeanAt(x, z, t, sc, wind) {
  const k = (sc.wind || 1) * (wind == null ? engineSetting('grass', 'wind') : wind);
  return windBendAt(x, z, t, engineSetting('grass', 'gusts')) * k;
}
