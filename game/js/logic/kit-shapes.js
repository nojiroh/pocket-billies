// @ts-check
'use strict';
/* ================= THE FIGURE KIT'S SHAPE LISTS (characters track CH-5) =================
   game/data/figureKit.json gives each accessory (hats, the headset, neckwear, bags) as rows of shapes, so the Studio
   can edit them and add new ones without code. A row is a shape on a part: its id, the part it hangs from, where, the
   shape and its colour slot. Every place and size is a number or a short sum of the frame's values ('bx * 0.98',
   'top - yb + 0.02', 'sin(a) * R * 1.08'), so a hat fits every head and a bag every build. The sums are parsed here,
   never run as code: numbers, names, + - * / and brackets, sqrt, sin and cos, and pi; they work out in the order
   JavaScript would, so a shape moved from code into the data is exactly what the code made.
   Besides logic/figure-pose.js's own shapes (ellipsoid, lathe, torus, cone, capsule, tube), a row round the head can
   be a dome (a crown cut at the band), a disc (a brim, a button), a lathe (rings round the head's upright axis), a band
   (a ring round the head) or curls (a brim's edges rolled up). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  KIT_CONSTS: [() => KIT_CONSTS],
  KIT_FRAME_SAMPLE: [() => KIT_FRAME_SAMPLE],
  KIT_FUNCS: [() => KIT_FUNCS],
  KIT_PARSED: [() => KIT_PARSED],
  // @ts-expect-error -- replaced on purpose
  figureKitProblems: [() => figureKitProblems, v => (figureKitProblems = v)],
  // @ts-expect-error -- replaced on purpose
  kitAccessory: [() => kitAccessory, v => (kitAccessory = v)],
  // @ts-expect-error -- replaced on purpose
  kitCurls: [() => kitCurls, v => (kitCurls = v)],
  // @ts-expect-error -- replaced on purpose
  kitExpr: [() => kitExpr, v => (kitExpr = v)],
  // @ts-expect-error -- replaced on purpose
  kitFaceProblems: [() => kitFaceProblems, v => (kitFaceProblems = v)],
  // @ts-expect-error -- replaced on purpose
  kitParse: [() => kitParse, v => (kitParse = v)],
  // @ts-expect-error -- replaced on purpose
  kitShapeOf: [() => kitShapeOf, v => (kitShapeOf = v)],
  // @ts-expect-error -- replaced on purpose
  kitValue: [() => kitValue, v => (kitValue = v)],
  // @ts-expect-error -- replaced on purpose
  kitVars: [() => kitVars, v => (kitVars = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {number | string | KitValue[] | { [k: string]: KitValue }} KitValue a number, a sum, or lists and
 * objects of them */
/** @typedef {{ id: string, parent?: string, at?: KitValue[], shape: Record<string, KitValue>, col: string,
 *   sides?: boolean, repeat?: number, vars?: Record<string, string | number> }} KitRow one shape on a part: `sides` an
 * A and a B mirrored (`s` is 1, then -1), `repeat` n copies id0..id(n-1) (`i` counts them), `vars` named values */
/** @typedef {{ rows: KitRow[], vars?: Record<string, string | number>, fringe?: boolean, colour?: number[] }} KitAccessory */
/** @typedef {(id: string, parent: string | null, at: [number, number, number], sh: any, col: string) => void} KitAdd */

export const KIT_FUNCS = /** @type {Record<string, (x: number) => number>} */ ({
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
});
export const KIT_CONSTS = /** @type {Record<string, number>} */ ({ pi: Math.PI });
/** @type {Map<string, (v: Record<string, number>) => number>} */
export const KIT_PARSED = new Map();

/**
 * a sum's value: `src` read with the usual order (brackets, then a leading minus, then * and /, then + and -, each
 * left to right) over the named values `vars`
 * @param {string} src @param {Record<string, number>} vars @returns {number}
 */
export function kitExpr(src, vars) {
  let f = KIT_PARSED.get(src);
  if (!f) {
    f = kitParse(src);
    KIT_PARSED.set(src, f);
  }
  return f(vars);
}

/** a sum made into a function of the named values; throws on anything else @param {string} src */
export function kitParse(src) {
  const toks = src.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]\w*|[-+*/()]|\S/g) || [];
  let at = 0;
  const bad = (/** @type {string} */ why) => new Error(`figure kit: "${src}": ${why}`);
  const peek = () => toks[at];
  /** @returns {(v: Record<string, number>) => number} */
  const sum = () => {
    let a = product();
    while (peek() === '+' || peek() === '-') {
      const op = toks[at++],
        l = a,
        r = product();
      a = op === '+' ? v => l(v) + r(v) : v => l(v) - r(v);
    }
    return a;
  };
  /** @returns {(v: Record<string, number>) => number} */
  const product = () => {
    let a = unary();
    while (peek() === '*' || peek() === '/') {
      const op = toks[at++],
        l = a,
        r = unary();
      a = op === '*' ? v => l(v) * r(v) : v => l(v) / r(v);
    }
    return a;
  };
  /** @returns {(v: Record<string, number>) => number} */
  const unary = () => {
    if (peek() === '-') {
      at++;
      const a = unary();
      return v => -a(v);
    }
    return primary();
  };
  /** @returns {(v: Record<string, number>) => number} */
  const primary = () => {
    const t = toks[at++];
    if (t === undefined) throw bad('it ends too soon');
    if (t === '(') {
      const a = sum();
      if (toks[at++] !== ')') throw bad('a bracket is not closed');
      return a;
    }
    if (/^[\d.]/.test(t)) {
      const n = Number(t);
      if (!Number.isFinite(n)) throw bad(`${t} is not a number`);
      return () => n;
    }
    if (/^[A-Za-z_]/.test(t)) {
      if (t in KIT_FUNCS) {
        const fn = KIT_FUNCS[t];
        if (toks[at++] !== '(') throw bad(`${t} needs brackets`);
        const a = sum();
        if (toks[at++] !== ')') throw bad('a bracket is not closed');
        return v => fn(a(v));
      }
      if (t in KIT_CONSTS) {
        const n = KIT_CONSTS[t];
        return () => n;
      }
      return v => {
        const n = v[t];
        if (typeof n !== 'number') throw bad(`no value named ${t}`);
        return n;
      };
    }
    throw bad(`"${t}" is not allowed`);
  };
  const f = sum();
  if (at < toks.length) throw bad(`"${toks[at]}" is not expected there`);
  return f;
}

/** a value worked out: a number as it is, a sum by kitExpr, lists and objects item by item (their order kept; a
 * shape's kind as it is)
 * @param {KitValue} x @param {Record<string, number>} V @returns {any} */
export function kitValue(x, V) {
  if (typeof x === 'string') return kitExpr(x, V);
  if (Array.isArray(x)) return x.map(y => kitValue(y, V));
  if (x && typeof x === 'object') {
    /** @type {Record<string, any>} */
    const o = {};
    for (const [k, y] of Object.entries(x)) o[k] = k === 'kind' ? y : kitValue(y, V);
    return o;
  }
  return x;
}

/** named values worked out in order, each seeing the ones before @param {Record<string, string | number> | undefined} vars
 * @param {Record<string, number>} V */
export function kitVars(vars, V) {
  const out = { ...V };
  for (const [k, x] of Object.entries(vars || {})) out[k] = typeof x === 'number' ? x : kitExpr(x, out);
  return out;
}

/**
 * the row's shape for logic/figure-pose.js: its own kinds as they are (every value worked out), and the shapes round
 * the head (dome, disc, lathe, band) laid round its frame (V: zc, bx, bz)
 * @param {Record<string, KitValue>} S @param {Record<string, number>} V
 */
export function kitShapeOf(S, V) {
  const g = (/** @type {string} */ k, d = 0) => (S[k] === undefined ? d : kitValue(S[k], V)),
    { zc, bx, bz } = V;
  switch (S.kind) {
    case 'dome': {
      const cut = g('cut', -0.04);
      return {
        kind: 'ellipsoid',
        c: [0, g('y'), zc + g('dz')],
        r: [g('sx'), g('h'), g('sz')],
        seg: 18,
        rings: 10,
        cut: { front: cut, side: cut, back: cut },
      };
    }
    case 'disc':
      return { kind: 'ellipsoid', c: [0, g('y'), zc + g('dz')], r: [g('rx'), g('th'), g('rz')], seg: 22, rings: 6 };
    case 'band': {
      const R = g('R');
      return { kind: 'torus', c: [0, g('y'), zc], R: [R, (R * bz) / bx], r: g('th'), seg: 18, rings: 5 };
    }
    case 'lathe':
      /* rings round the head (its x and z radii in the head's proportions) when only x radii are given */
      if (S.rz === undefined) {
        const rxs = /** @type {number[]} */ (g('rx'));
        return {
          kind: 'lathe',
          c: [0, 0, zc + g('dz')],
          y: g('y'),
          rx: rxs,
          rz: rxs.map(v => (v * bz) / bx),
          seg: 18,
        };
      }
      return kitValue(S, V);
    default:
      return kitValue(S, V);
  }
}

/**
 * an accessory's rows added to the figure: each row's copies (sides, repeat) with their values worked out
 * @param {KitAdd} add @param {KitAccessory} acc @param {Record<string, number>} frame the frame's values
 * @param {string} parent the part a row hangs from when it names none
 */
export function kitAccessory(add, acc, frame, parent) {
  const V0 = kitVars(acc.vars, frame);
  for (const row of acc.rows || []) {
    const copies = row.sides
      ? [
          { s: 1, id: row.id + 'A' },
          { s: -1, id: row.id + 'B' },
        ]
      : row.repeat
        ? Array.from({ length: row.repeat }, (_, i) => ({ i, id: row.id + i }))
        : [{ id: row.id }];
    for (const cp of copies) {
      /** @type {Record<string, number>} */
      const V1 = { ...V0 };
      if ('s' in cp) V1.s = /** @type {number} */ (cp.s);
      if ('i' in cp) V1.i = /** @type {number} */ (cp.i);
      const V = kitVars(row.vars, V1),
        at = row.at ? kitValue(row.at, V) : [0, 0, 0],
        par = row.parent || parent;
      if (row.shape.kind === 'curls') kitCurls(add, row, V, par, at);
      else add(cp.id, par, at, kitShapeOf(row.shape, V), row.col);
    }
  }
}

/** a brim's edges rolled up at each side (a cowboy hat's, a top hat's): two bent tubes, id + A and B
 * @param {KitAdd} add @param {KitRow} row @param {Record<string, number>} V @param {string} par @param {number[]} at */
export function kitCurls(add, row, V, par, at) {
  const S = row.shape,
    g = (/** @type {string} */ k) => kitValue(S[k], V),
    y = g('y'),
    wx = g('wx'),
    wz = g('wz'),
    lift = g('lift'),
    th = g('th'),
    zc = V.zc;
  for (const s of [1, -1])
    add(
      row.id + (s > 0 ? 'A' : 'B'),
      par,
      [at[0], at[1], at[2]],
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
      row.col
    );
}

/** the frames' values a sum may name: round the head (a hat's), the head (the headset's) and the body (neckwear,
 * bags), at the usual figure's sizes, for checking */
export const KIT_FRAME_SAMPLE = Object.freeze({
  k: 1,
  rx: 0.31,
  yb: 0.35,
  zc: 0,
  bx: 0.34,
  bz: 0.33,
  top: 0.62,
  hx: 0.31,
  hy: 0.3,
  c1: 0.3,
  tk: 1,
  girth: 1,
  hipK: 1,
  torsoZ: 0.11,
});

/**
 * what is wrong with the figure kit's data, as sentences (tools/check-data.mjs): people's head shapes and builds are
 * the kit's, every sum works out on the frames,
 * every build townsfolk pick and every head's build exists, some head can be picked at random, and every hair style and
 * accessory is a wardrobe item
 * @param {any} kit game/data/figureKit.json @param {Record<string, { slot?: string }>} items the wardrobe's items
 * @param {Record<string, { figure?: { head?: string, build?: string, eyes?: string, brows?: string } }>} [people] people/<id>.json: their `figure`'s
 *   head shape and build are the kit's
 * @returns {string[]}
 */
export function figureKitProblems(kit, items, people = {}) {
  /** @type {string[]} */
  const out = [];
  for (const [who, p] of Object.entries(people)) {
    const f = (p && p.figure) || {};
    if (f.head && !(kit.heads || {})[f.head]) out.push(`people/${who}.json: figure.head ${f.head} is no head shape`);
    if (f.build && !(kit.builds || {})[f.build]) out.push(`people/${who}.json: figure.build ${f.build} is no build`);
    if (f.eyes && !((kit.faces || {}).eyes || {})[f.eyes])
      out.push(`people/${who}.json: figure.eyes ${f.eyes} is no eye style`);
    if (f.brows && !((kit.faces || {}).brows || {})[f.brows])
      out.push(`people/${who}.json: figure.brows ${f.brows} is no brow style`);
  }
  for (const b of kit.folk || []) if (!(kit.builds || {})[b]) out.push(`folk: no build ${b}`);
  if (!Object.values(kit.heads || {}).some(H => /** @type {any} */ (H).random !== false))
    out.push('heads: none can be picked at random');
  for (const id of Object.keys(kit.hair || {}))
    if (!items[id] || items[id].slot !== 'hair') out.push(`hair: ${id} is not a hair style in the wardrobe`);
  for (const [id, acc] of Object.entries(kit.accessories || {})) {
    if (!items[id]) out.push(`accessories: ${id} is not in the wardrobe`);
    try {
      kitAccessory(
        (pid, _parent, at, sh) => {
          const bad = JSON.stringify([at, sh]).match(/null/);
          if (bad) out.push(`accessories: ${id} ${pid}: a value is not a number`);
        },
        /** @type {KitAccessory} */ (acc),
        { ...KIT_FRAME_SAMPLE },
        'head'
      );
    } catch (e) {
      out.push(`accessories: ${id}: ${/** @type {Error} */ (e).message}`);
    }
  }
  out.push(...kitFaceProblems(kit, items));
  return out;
}
/**
 * CH-6: the faces section's references: each wardrobe id is in the wardrobe and draws a style its slot has, the
 * defaults and the resting moods exist
 * @param {any} kit @param {Record<string, { slot?: string }>} items @returns {string[]}
 */
export function kitFaceProblems(kit, items) {
  /** @type {string[]} */
  const out = [];
  const FC = kit.faces;
  if (!FC) return ['faces: missing'];
  /** @type {Record<string, any>} */
  const bySlot = { eyes: FC.eyes, brows: FC.brows, mouth: FC.mouths };
  for (const [id, v] of Object.entries(FC.wardrobe || {})) {
    const slot = items[id] && items[id].slot;
    if (!slot || !bySlot[slot]) out.push(`faces.wardrobe: ${id} is no eyes, brows or mouth in the wardrobe`);
    else if (!bySlot[slot][v]) out.push(`faces.wardrobe: ${id} draws ${v}, which faces has no ${slot} of`);
  }
  for (const [slot, v] of Object.entries(FC.defaults || {}))
    if (!bySlot[slot] || !bySlot[slot][v]) out.push(`faces.defaults: no ${slot} ${v}`);
  for (const [id, X] of Object.entries(FC.expressions || {})) {
    if (!(FC.eyeFrames || {})[X.eyes]) out.push(`faces.expressions: ${id}'s eyes ${X.eyes} is no eye frame`);
    for (const m of [X.mouth, ...(X.talk || [])])
      if (m && !(FC.mouths || {})[m]) out.push(`faces.expressions: ${id}'s mouth ${m} is no mouth frame`);
  }
  for (const m of FC.talk || []) if (!(FC.mouths || {})[m]) out.push(`faces.talk: ${m} is no mouth frame`);
  for (const R of FC.rest || []) {
    if (!(FC.moods || {})[R.mood]) out.push(`faces.rest: no mood ${R.mood}`);
    for (const slot of ['eyes', 'brows', 'mouth'])
      for (const id of R[slot] || []) if (!items[id]) out.push(`faces.rest: ${id} is not in the wardrobe`);
  }
  return out;
}
