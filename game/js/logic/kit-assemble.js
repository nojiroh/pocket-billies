// @ts-check
'use strict';
/* ================= KIT ASSEMBLE (Studio plan Phase 5, T5.1) =================
   A kit Billie baked from its recipe (game/data/kitBuilds.json: which kit part on which bone, at what
   size and colour, plus extras such as horns, ears, a crest or a shell), as tools/build-kit-billies.py builds it,
   number for number: the pieces of each view (legs set the torso's height, arms and extras mirrored by the kinds'
   sides in partKits.json, draw order from partKits' z, a tail turned to its aim, the head on the neck with its blink),
   the stage scale that fits both views in the stage box, the packed sheet, the rig of each view and the stage's native
   parts (the piece layout <name>.json the Python builder also wrote retired: nothing read it the rig does not hold). tools/test/kit-bake-parity.test.mjs checks all 24 against what the Python builder wrote.
   Logic only: no DOM, runs in Node. A picture is ImageData-shaped. */
/** @import { KitBake, PartKits } from '../../types/game-data' */
/** @typedef {import('./kit-pixels.js').Pixels} Pixels */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { roundHalfEven } from './sheet-slice.js';
import { partForSide, partZ } from './part-joints.js';
import {
  kitAffine,
  kitBlank,
  kitBlinkFrame,
  kitFlipX,
  kitFlipY,
  kitOpaqueWidth,
  kitPartScale,
  kitPaste,
  kitRecolour,
  kitRecolourHead,
  kitRoundDigits,
  kitSquashFrames,
} from './kit-pixels.js';
/* eslint-disable no-func-assign */
expose({
  colourOf: [() => colourOf],
  // @ts-expect-error -- replaced on purpose
  kitArmRest: [() => kitArmRest, v => (kitArmRest = v)],
  // @ts-expect-error -- replaced on purpose
  kitBakeForm: [() => kitBakeForm, v => (kitBakeForm = v)],
  // @ts-expect-error -- replaced on purpose
  kitBakeWhole: [() => kitBakeWhole, v => (kitBakeWhole = v)],
  // @ts-expect-error -- replaced on purpose
  kitBounds: [() => kitBounds, v => (kitBounds = v)],
  // @ts-expect-error -- replaced on purpose
  kitBuildView: [() => kitBuildView, v => (kitBuildView = v)],
  // @ts-expect-error -- replaced on purpose
  kitDrawRest: [() => kitDrawRest, v => (kitDrawRest = v)],
  // @ts-expect-error -- replaced on purpose
  kitFitScale: [() => kitFitScale, v => (kitFitScale = v)],
  // @ts-expect-error -- replaced on purpose
  kitNativeParts: [() => kitNativeParts, v => (kitNativeParts = v)],
  // @ts-expect-error -- replaced on purpose
  kitPack: [() => kitPack, v => (kitPack = v)],
  // @ts-expect-error -- replaced on purpose
  kitRestPose: [() => kitRestPose, v => (kitRestPose = v)],
  matMul: [() => matMul],
  // @ts-expect-error -- replaced on purpose
  socketsPx: [() => socketsPx, v => (socketsPx = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * @typedef {{ n: string, par: string, frames: Record<string, Pixels>, pivot: [number, number], at: [number, number],
 *   z: number, zb: number, rr?: number, lag?: number, slot?: string | null, face?: boolean }} KitPiece
 * @typedef {{ name: string, rig: string, line: string, stage: number, scale: number,
 *   parts: Record<string, [string, number, string | number[] | null]>, extras?: any[][], armOut?: number,
 *   slots?: Record<string, string> }} KitForm
 * @typedef {(id: string, view: string) => Pixels} KitPartPixels a kit part's picture at M (game/art/next/parts)
 */

/** a part's sockets in pixels of its picture (mirrored when the picture is)
 * @param {PartKits} K @param {string} id @param {string} view @param {Pixels} im @param {boolean} [mirror] */
export function socketsPx(K, id, view, im, mirror = false) {
  const s = K.parts[id]?.views[/** @type {'front'|'back'} */ (view)]?.sockets || {},
    w = im.width,
    h = im.height;
  return /** @type {Record<string, [number, number]>} */ (
    Object.fromEntries(Object.entries(s).map(([n, [fx, fy]]) => [n, [(mirror ? 1 - fx : fx) * w, fy * h]]))
  );
}
/** a colour of the recipe: a name in its colours, a [hue, sat, val], or null @param {any} spec
 * @param {Record<string, number[]>} C */
export const colourOf = (spec, C) => (spec == null ? null : typeof spec === 'string' ? C[spec] : spec);

/** arm_rest: the rest tilt (radians, as a rig bone's rr: positive turns clockwise on screen) that hangs a limb straight
 * down from its joint with its far end outDeg degrees out from the body
 * @param {Pixels} im @param {[number, number]} joint @param {boolean} outRight @param {number} outDeg */
export function kitArmRest(im, joint, outRight, outDeg) {
  let bot = -1;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 0) bot = Math.max(bot, y);
  let sx = 0,
    cnt = 0;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++)
      if (im.data[(y * im.width + x) * 4 + 3] > 0 && y >= bot - 3) {
        sx += x;
        cnt++;
      }
  const px = sx / cnt,
    py = bot,
    deg = 180.0 / Math.PI,
    now = Math.atan2(-(py - joint[1]), px - joint[0]) * deg,
    want = -90 + (outRight ? outDeg : -outDeg);
  return kitRoundDigits(-((want - now) * (Math.PI / 180.0)), 3);
}

/** build_view: the pieces of one view at stage scale k
 * @param {PartKits} K @param {KitForm} form @param {Record<string, number[]>} C @param {string} view @param {number} k
 * @param {KitPartPixels} pics @param {KitBake} D @returns {KitPiece[]} */
export function kitBuildView(K, form, C, view, k, pics, D) {
  const P = form.parts,
    /** @type {Record<string, Pixels>} */ get = {};
  for (const [kind, [pid, size, col]] of Object.entries(P)) {
    if (!K.parts[pid]) throw new Error(`unknown part ${pid} (not in game/data/partKits.json)`);
    const im = kitPartScale(pics(pid, view), size * k);
    get[kind] = kind === 'head' ? kitRecolourHead(im, colourOf(col, C)) : kitRecolour(im, colourOf(col, C));
  }
  const torso = get.torso,
    tw = torso.width,
    th = torso.height,
    T0 = socketsPx(K, P.torso[0], view, torso),
    T = (/** @type {string} */ n) => [T0[n][0] - tw / 2, T0[n][1] - th / 2],
    zOf = (/** @type {string} */ id) => [partZ(K, id, 'front'), partZ(K, id, 'back')],
    /** @type {KitPiece[]} */ pieces = [];
  const piece = (
    /** @type {string} */ n,
    /** @type {string} */ par,
    /** @type {Record<string, Pixels>} */ frames,
    /** @type {[number, number]} */ pivot,
    /** @type {number[]} */ at,
    /** @type {number} */ z,
    /** @type {number | undefined} */ zb,
    kw = {}
  ) =>
    pieces.push({
      n,
      par,
      frames,
      pivot,
      at: /** @type {[number, number]} */ (at),
      z,
      zb: zb === undefined ? z : zb,
      ...kw,
    });

  /* legs hang from the hips; the torso stands as high as the legs are long, so the feet meet the ground line. The
     kit draws a leg for one side (partKits sides) and mirrors it for the other */
  let torsoY;
  if (get.leg) {
    const legId = P.leg[0],
      leg = get.leg,
      lw = leg.width,
      lh = leg.height,
      [jx, jy] = socketsPx(K, legId, view, leg).joint,
      [lz, lzb] = zOf(legId);
    torsoY = -(lh - jy) - T('hipL')[1];
    let hl = T('hipL')[0],
      hr = T('hipR')[0];
    const gap = kitOpaqueWidth(leg) * D.footGap;
    if (hr - hl < gap) {
      const mid = (hl + hr) / 2;
      hl = mid - gap / 2;
      hr = mid + gap / 2;
    }
    const hipY = T('hipL')[1];
    for (const side of ['L', 'R']) {
      const flip = partForSide(K, legId, side).flip;
      piece(
        'leg' + side,
        'torso',
        { main: flip ? kitFlipX(leg) : leg },
        flip ? [lw - jx, jy] : [jx, jy],
        [side === 'L' ? hl : hr, hipY],
        lz,
        lzb
      );
    }
  } else torsoY = -th / 2; /* a blob sits on its body */
  const [tz, tzb] = zOf(P.torso[0]);
  piece(
    'torso',
    'root',
    kitSquashFrames(torso, D.pad, D.squash),
    [tw / 2 + D.pad, th / 2 + D.pad],
    [0, torsoY],
    tz,
    tzb
  );
  pieces.unshift(/** @type {KitPiece} */ (pieces.pop())); /* the torso first: everything hangs on it */

  /* arms (or wings, or fins) from the shoulders, the art mirrored on the side it is not drawn for */
  if (get.arm) {
    const armId = P.arm[0],
      arm = get.arm,
      out = form.armOut ?? D.armOut,
      [az, azb] = zOf(armId);
    for (const side of ['L', 'R']) {
      const mirror = partForSide(K, armId, side).flip,
        im = mirror ? kitFlipX(arm) : arm,
        j = socketsPx(K, armId, view, arm, mirror).joint;
      piece('arm' + side, 'torso', { main: im }, j, T('shoulder' + side), az, azb, {
        rr: kitArmRest(im, j, !mirror, out),
      });
    }
  }

  /* the tail from the torso's tail socket, turned to its aim (from behind it sweeps flatter) */
  if (get.tail) {
    const tailId = P.tail[0],
      tail = get.tail,
      ts = socketsPx(K, tailId, view, tail),
      [tlz, tlzb] = zOf(tailId);
    if (ts.base && tailId in D.tailAim) {
      const [bx, by] = ts.base,
        [px, py] = ts.tip,
        now = Math.atan2(-(py - by), px - bx) * (180.0 / Math.PI),
        aim = D.tailAim[tailId],
        want = view === 'front' ? aim : aim * D.tailBackSweep;
      piece('tail', 'torso', { main: tail }, [bx, by], T('tail'), tlz, tlzb, {
        rr: kitRoundDigits(-((want - now) * (Math.PI / 180.0)), 3),
        lag: 1,
      });
    } else piece('tail', 'torso', { main: tail }, [tail.width / 2, tail.height / 2], T('tail'), tlz, tlzb, { lag: 1 });
  }

  /* the head on the neck, its chin a little below the neck socket so there is no gap; a front head blinks */
  const head = get.head,
    hw = head.width,
    hh = head.height,
    [chx, chy] = socketsPx(K, P.head[0], view, head).chin || [hw / 2, hh * 0.9],
    [nx, ny] = T('neck'),
    [hz, hzb] = zOf(P.head[0]);
  /** @type {Record<string, Pixels>} */
  let hf = { main: head };
  if (view === 'front') {
    const b = kitBlinkFrame(head);
    if (b) hf = { idle: head, blink: b };
  }
  piece('head', 'torso', hf, [chx, chy], [nx, ny + hh * D.chinDrop], hz, hzb, { face: view === 'front' });

  /* extras, placed by their anchor on the head (from its chin pivot) or the torso (from its middle) */
  /** @type {Record<string, number>} */
  const names = {};
  (form.extras || []).forEach((ex, i) => {
    const [pid, anchor, size, col, pair] = ex,
      slot = ex.length > 5 ? ex[5] : null,
      A = D.anchors[anchor];
    if (!A) throw new Error(`${form.name}: unknown anchor ${anchor}`);
    if (!K.parts[pid]) throw new Error(`unknown part ${pid} (not in game/data/partKits.json)`);
    let e = kitRecolour(kitPartScale(pics(pid, view), size * k), colourOf(col, C));
    const ew = e.width,
      eh = e.height,
      onHead = A.on === 'head',
      pw = onHead ? hw : tw;
    if (anchor === 'chin') e = kitFlipY(e); /* a beard hangs from the chin */
    let dx, dy;
    if (anchor === 'collar') {
      dx = T0.neck[0] - ew / 2;
      dy = T0.neck[1] - eh * 0.45;
    } else {
      dx = pw * A.x[0] + ew * A.x[1];
      dy = (onHead ? hh : th) * A.y[0] + eh * A.y[1];
    }
    const z = A.z + i * 0.01,
      zb = A.zb + i * 0.01 /* later extras over earlier ones */,
      [ox, oy] = onHead ? [-chx, -chy] : [-tw / 2, -th / 2],
      piv = /** @type {[number, number]} */ (anchor === 'chin' ? [ew / 2, 0] : [ew / 2, eh]),
      par = onHead ? 'head' : 'torso';
    names[A.name] = (names[A.name] || 0) + 1;
    const nm = names[A.name] === 1 ? A.name : `${A.name}${names[A.name]}`;
    if (pair) {
      piece(nm + 'L', par, { main: e }, piv, [ox + dx + piv[0], oy + dy + piv[1]], z, zb, { slot });
      const mdx = pw - dx - ew;
      piece(nm + 'R', par, { main: kitFlipX(e) }, piv, [ox + mdx + piv[0], oy + dy + piv[1]], z, zb, { slot });
    } else piece(nm, par, { main: e }, piv, [ox + dx + piv[0], oy + dy + piv[1]], z, zb, { slot });
  });
  /* bone kinds that fill another slot (the slug's tail is its back part) */
  for (const p of pieces) {
    const kind = p.n.replace(/[LR]$/, '');
    if (form.slots && kind in form.slots) p.slot = form.slots[kind];
  }
  return pieces;
}

/* ---------- the rest pose: matrices, drawing, bounds ---------- */
/** @param {number[]} m @param {number[]} n */
export const matMul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
/** each piece's matrix in the rest pose, as skeleton-rig.js works them out (the back view drawn mirrored), in draw
 * order @param {KitPiece[]} pieces @param {boolean} back @param {KitBake} D */
export function kitRestPose(pieces, back, D) {
  let M = [1, 0, 0, 1, D.box.cx, D.box.base];
  if (back) M = matMul(M, [-1, 0, 0, 1, 0, 0]);
  /** @type {Record<string, number[]>} */
  const W = { root: M },
    /** @type {[number, number[], KitPiece][]} */ out = [];
  for (const p of pieces) {
    let m = matMul(W[p.par], [1, 0, 0, 1, roundHalfEven(p.at[0]), roundHalfEven(p.at[1])]);
    const r = p.rr || 0;
    if (r) {
      const c = Math.cos(r),
        s = Math.sin(r);
      m = matMul(m, [c, s, -s, c, 0, 0]);
    }
    W[p.n] = m;
    out.push([back ? p.zb : p.z, m, p]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
/** the rest pose drawn into the stage box (Pillow's nearest-neighbour affine, as the builder drew it)
 * @param {KitPiece[]} pieces @param {boolean} back @param {KitBake} D */
export function kitDrawRest(pieces, back, D) {
  const cv = kitBlank(D.box.w, D.box.h);
  for (const [, m, p] of kitRestPose(pieces, back, D)) {
    const im = p.frames.main || p.frames.idle,
      ox = -roundHalfEven(p.pivot[0]),
      oy = -roundHalfEven(p.pivot[1]),
      [a, b, c, d, e, f] = m,
      det = a * d - b * c,
      ia = d / det,
      ib = -b / det,
      ic = -c / det,
      id = a / det,
      ie = -(ia * e + ic * f),
      iff = -(ib * e + id * f);
    kitPaste(cv, kitAffine(im, D.box.w, D.box.h, [ia, ic, ie - ox, ib, id, iff - oy]), 0, 0);
  }
  return cv;
}
/** the box round the pixels drawn: [x0, y0, x1, y1] (x1 and y1 past the last) @param {Pixels} img */
export function kitBounds(img) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return [x0, y0, x1 + 1, y1 + 1];
}

/* ---------- one form: fit, sheet, rig ---------- */
/** fit_form: the stage scale that keeps both views inside the stage box (shrunk from the recipe's if it doesn't fit)
 * @param {PartKits} K @param {KitForm} form @param {Record<string, number[]>} C @param {KitPartPixels} pics
 * @param {KitBake} D */
export function kitFitScale(K, form, C, pics, D) {
  let k = form.scale;
  for (let n = 0; n < 30; n++) {
    let ok = true;
    for (const view of ['front', 'back']) {
      const [x0, y0, x1] = kitBounds(kitDrawRest(kitBuildView(K, form, C, view, k, pics, D), view === 'back', D));
      if (y0 < D.margin || x0 < D.margin || x1 > D.box.w - D.margin) ok = false;
    }
    if (ok) return k;
    k = kitRoundDigits(k * 0.96, 4);
  }
  throw new Error(`${form.name} doesn't fit the stage box`);
}
/** shelf-pack pictures into one sheet `width` wide: the sheet and each picture's place
 * @param {Pixels[]} images @param {number} width */
export function kitPack(images, width) {
  let x = 2,
    y = 2,
    rowh = 0;
  const spots = images.map(im => {
    if (x + im.width + 2 > width) {
      x = 2;
      y += rowh + 2;
      rowh = 0;
    }
    const at = /** @type {[number, number]} */ ([x, y]);
    x += im.width + 2;
    rowh = Math.max(rowh, im.height);
    return at;
  });
  const sheet = kitBlank(width, y + rowh + 2);
  images.forEach((im, i) => kitPaste(sheet, im, spots[i][0], spots[i][1]));
  return { sheet, spots };
}
/** build_form: a kit Billie baked from its recipe: its stage scale, both views' pieces, the sheet and the rig (both
 * views, as rigs-next.js holds it)
 * @param {PartKits} K @param {KitForm} form @param {Record<string, number[]>} C @param {KitPartPixels} pics
 * @param {KitBake} D */
export function kitBakeForm(K, form, C, pics, D) {
  const k = kitFitScale(K, form, C, pics, D),
    { w: BW, h: BH, cx: CX, base: BASE } = D.box,
    /** @type {Record<string, KitPiece[]>} */ views = {},
    pics2 = [],
    where = [];
  for (const v of ['front', 'back']) {
    views[v] = kitBuildView(K, form, C, v, k, pics, D);
    views[v].forEach((p, pi) => {
      for (const [fn, im] of Object.entries(p.frames)) {
        where.push(`${v}|${pi}|${fn}`);
        pics2.push(im);
      }
    });
  }
  const { sheet, spots } = kitPack(pics2, D.sheetW),
    place = Object.fromEntries(where.map((w, i) => [w, [...spots[i], pics2[i].width, pics2[i].height]])),
    /** @type {Record<string, any>} */ rig = {};
  for (const v of ['front', 'back']) {
    const ps = views[v],
      imgs = [],
      bones = [];
    for (const [pi, p] of ps.entries()) {
      const f = Object.fromEntries(Object.keys(p.frames).map(fn => [fn, place[`${v}|${pi}|${fn}`]]));
      imgs.push({ ox: -roundHalfEven(p.pivot[0]), oy: -roundHalfEven(p.pivot[1]), f });
      /** @type {Record<string, any>} */
      const b = { n: p.n, par: p.par, at: [roundHalfEven(p.at[0]), roundHalfEven(p.at[1])], z: p.z, zb: p.zb, i: pi };
      for (const key of /** @type {const} */ (['rr', 'lag', 'slot']))
        if (p[key] != null && p[key] !== 0) b[key] = p[key];
      if (p.face) b.face = true;
      bones.push(b);
    }
    const [x0, y0, x1] = kitBounds(kitDrawRest(ps, false, D)); /* bounds in the view's own (unmirrored) drawing */
    rig[v] = {
      k: 1,
      BW,
      BH,
      cx: CX,
      base: BASE,
      tipX: 0,
      plan: 'biped',
      q: { lift: 0, flapMs: 300 },
      geo: { cx: CX, base: BASE, top: y0, mid: (y0 + BASE) / 2, hw: (x1 - x0) / 2, lift: 0, k: 1, cy: (y0 + BASE) / 2 },
      size: [sheet.width, sheet.height],
      imgs,
      bones,
      clock: 12,
      sheet: `next/billionaires/${form.name}.png`,
      kit: 'kitBuilds.json',
    };
  }
  return { k, views, sheet, rig };
}
/** native_parts: the stage's fitting set, the kit part on the bone that fills each slot of rules.json parts.slots
 * (`slotList`); a bone kind fills its partKits.json "slots" one (`kindSlot`) unless the form's "slots" or an extra's
 * slot says otherwise
 * @param {KitForm} form @param {Record<string, string>} kindSlot @param {string[]} slotList
 * @returns {Record<string, string>} */
export function kitNativeParts(form, kindSlot, slotList) {
  /** @type {Record<string, string>} */
  const slots = {},
    over = form.slots || {};
  for (const [kind, [pid]] of Object.entries(form.parts)) {
    const s = over[kind] ?? kindSlot[kind];
    if (s in slots) throw new Error(`${form.name}: two parts fill slot ${s}`);
    slots[s] = pid;
  }
  for (const ex of form.extras || [])
    if (ex.length > 5 && ex[5]) {
      if (ex[5] in slots) throw new Error(`${form.name}: two parts fill slot ${ex[5]}`);
      slots[ex[5]] = ex[0];
    }
  const miss = slotList.filter(s => !(s in slots));
  if (miss.length) throw new Error(`${form.name}: no part fills ${miss}`);
  return Object.fromEntries(slotList.map(s => [s, slots[s]]));
}
/** one kit Billie baked from the game data, as `npm run bake:kits` and the Studio's Write Billie bake it: the stage
 * scale, the sheet, the rig (both views) and the stage's native parts
 * @param {{ partKits: PartKits, kitBuilds: { bake: KitBake, colours: Record<string, number[]> },
 *   rules: { parts: { slots: string[] } } }} D the game data (partKits.json, kitBuilds.json, rules.json)
 * @param {KitForm} form @param {KitPartPixels} pics */
export function kitBakeWhole(D, form, pics) {
  const K = D.partKits,
    B = D.kitBuilds,
    made = kitBakeForm(K, form, B.colours, pics, B.bake);
  return { ...made, parts: kitNativeParts(form, K.slots || {}, D.rules.parts.slots) };
}
