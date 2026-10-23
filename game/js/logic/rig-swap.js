// @ts-check
'use strict';
/* ================= RIG SWAP (Studio plan Phase 5, T5.2) =================
   A bone's picture replaced by a part from the Parts Library (game/data/partKits.json) so the Billie stays whole:
   - which library parts fit: the bone's children that hang on a named socket (a torso's neck, shoulders, hips and
     tail, partKits.json socketRules) need that socket on the new part, else the part is shown greyed with the reason;
   - the children refit: one on a named socket moves to the new part's socket (turned, scaled and moved as the picture
     is), any other keeps its place in proportion to the picture (as the kit baker's anchors are fractions of a head);
   - the frames: a head's blink is made again from the new picture (the kit baker's rule) unless the old frames are
     kept, its happy and hurt then fall back to the new picture; a torso gets its squash and stretch again (the kit
     baker's, padded); any other bone has the one picture;
   - the pictures go below the sheet (nothing is taken away, as before), each frame its own box;
   - geo's top and hw move by what the swap changed (the skeleton builder's framing before and after), so a part of
     the same size leaves the Billie's world size as it was, whatever way its geo was first measured; mid and cy stay
     halfway from the top to the ground line, as every builder made them.
   Logic only: no DOM, runs in Node. A picture is ImageData-shaped (logic/kit-pixels.js Pixels). */
/** @import { PartKits } from '../../types/game-data' */
/** @typedef {import('./kit-pixels.js').Pixels} Pixels */
/** @typedef {import('./rig-joints.js').RigView} RigView */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  rigRefit: [() => rigRefit, v => (rigRefit = v)],
  // @ts-expect-error -- replaced on purpose
  rigSheetGrow: [() => rigSheetGrow, v => (rigSheetGrow = v)],
  // @ts-expect-error -- replaced on purpose
  rigSheetPut: [() => rigSheetPut, v => (rigSheetPut = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapApply: [() => rigSwapApply, v => (rigSwapApply = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapMisfit: [() => rigSwapMisfit, v => (rigSwapMisfit = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapNeeds: [() => rigSwapNeeds, v => (rigSwapNeeds = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapPair: [() => rigSwapPair, v => (rigSwapPair = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapSide: [() => rigSwapSide, v => (rigSwapSide = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapSlot: [() => rigSwapSlot, v => (rigSwapSlot = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapSockets: [() => rigSwapSockets, v => (rigSwapSockets = v)],
  // @ts-expect-error -- replaced on purpose
  rigSwapSocketsAt: [() => rigSwapSocketsAt, v => (rigSwapSocketsAt = v)],
  round3: [() => round3],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a bone's slot as the Parts Library files it: ears, horns, crests and antlers are head extras, shells and ruffs
 * body extras, else the game's boneSlot (skeleton-rig.js, passed in) @param {any} b @param {(b: any) => string | null} boneSlot */
export function rigSwapSlot(b, boneSlot) {
  const role = b.a || b.n;
  if (/^(ear|horn|crest|antler)/i.test(role)) return 'headExtra';
  if (/^(shell|ruff)/i.test(role)) return 'bodyExtra';
  return boneSlot(b) || '';
}
/** a child bone's side: L or R (a quad's near legs are L, far ones R, as the Parts Library pairs them), else '' */
export function rigSwapSide(/** @type {string} */ name) {
  if (/^leg[FB][FN]$/.test(name)) return name.endsWith('N') ? 'L' : 'R';
  return /[a-z](L|R)$/.test(name) ? name.slice(-1) : '';
}
/** a bone's twin on the other side with a picture and the same parent (armL and armR, a quad's legBN and legBF), else
 * null @param {RigView | null | undefined} M @param {string} name */
export function rigSwapPair(M, name) {
  const b = M?.bones.find(x => x.n === name);
  if (!M || !b) return null;
  const other = /[LR]$/.test(name)
    ? name.slice(0, -1) + (name.endsWith('L') ? 'R' : 'L')
    : /^leg[FB][FN]$/.test(name)
      ? name.slice(0, -1) + (name.endsWith('F') ? 'N' : 'F')
      : '';
  return M.bones.find(x => x.n === other && x.par === b.par && x.i >= 0) || null;
}
/** the named sockets a child of this slot hangs on (partKits.json socketRules), on its own side first
 * @param {PartKits} K @param {string} slot @param {string} side @returns {string[]} */
export function rigSwapSockets(K, slot, side) {
  const all = Object.entries(K.socketRules || {})
    .filter(([, slots]) => /** @type {string[]} */ (slots).includes(slot))
    .map(([s]) => s);
  const sided = all.filter(s => /[LR]$/.test(s));
  if (!sided.length) return all;
  const mine = sided.filter(s => s.endsWith(side || 'L'));
  return [...mine, ...all.filter(s => !/[LR]$/.test(s))];
}
/**
 * What a bone's children need from a new part in a view: each child that hangs on a named socket that some library
 * part of the bone's slot carries (a head's horns hang on no socket a head has, so they need nothing).
 * @param {PartKits} K @param {RigView} M @param {string} bone @param {(b: any) => string} slotOf a bone's slot
 * @param {string} partSlot the swapped bone's slot @param {string} view
 * @returns {{ child: string, sockets: string[] }[]}
 */
export function rigSwapNeeds(K, M, bone, slotOf, partSlot, view) {
  const carried = new Set();
  for (const p of Object.values(K.parts || {}))
    if (p.slot === partSlot) for (const s of Object.keys(p.views?.[view]?.sockets || {})) carried.add(s);
  const out = [];
  for (const c of M.bones.filter(b => b.par === bone)) {
    const sockets = rigSwapSockets(K, slotOf(c), rigSwapSide(c.n)).filter(s => carried.has(s));
    if (sockets.length) out.push({ child: c.n, sockets });
  }
  return out;
}
/** why a library part does not fit (its view has no picture, or a socket a child needs is missing), else ''
 * @param {PartKits} K @param {string} id @param {string} view @param {{ child: string, sockets: string[] }[]} needs */
export function rigSwapMisfit(K, id, view, needs) {
  const v = K.parts[id]?.views?.[view];
  if (!v) return `no ${view} picture`;
  const has = v.sockets || {};
  const miss = needs.filter(n => !n.sockets.some(s => s in has));
  return miss.length ? miss.map(n => `no ${n.sockets[0]} socket for ${n.child}`).join('; ') : '';
}
/**
 * Where the new part's sockets land from its pivot, in the swapped picture's pixels: the part's view scaled to the
 * drawn size `w` x `h`, mirrored when `flip`, turned by `angle` (radians) about the pivot and moved by `offset`, as the
 * Studio paints the picture. Sockets in fractions of the part's picture; the pivot too.
 * @param {Record<string, [number, number]>} sockets @param {[number, number]} pivot @param {number} w @param {number} h
 * @param {boolean} flip @param {number} angle @param {[number, number]} offset
 * @returns {Record<string, [number, number]>}
 */
export function rigSwapSocketsAt(sockets, pivot, w, h, flip, angle, offset) {
  const fx = (/** @type {number} */ x) => (flip ? 1 - x : x),
    px = fx(pivot[0]) * w,
    py = pivot[1] * h,
    c = Math.cos(angle),
    s = Math.sin(angle),
    /** @type {Record<string, [number, number]>} */ out = {};
  for (const [name, [x, y]] of Object.entries(sockets)) {
    const dx = fx(x) * w - px,
      dy = y * h - py;
    out[name] = [c * dx - s * dy + offset[0], s * dx + c * dy + offset[1]];
  }
  return out;
}
export const round3 = (/** @type {number} */ v) => +v.toFixed(3) || 0;
/**
 * Moves the bone's children onto the new picture: a child with a named socket the new part has goes to it, any other
 * keeps its place in proportion to the picture (fractions of the old shown box, applied to the new one).
 * @param {RigView} M @param {string} bone
 * @param {{ ox: number, oy: number, w: number, h: number }} before the old picture (its shown frame)
 * @param {{ ox: number, oy: number, w: number, h: number }} after the new picture (its main frame)
 * @param {Record<string, [number, number]>} at the new part's sockets from its pivot (rigSwapSocketsAt)
 * @param {{ child: string, sockets: string[] }[]} needs
 * @returns {Record<string, string>} how each child moved: the socket's name, or 'in proportion'
 */
export function rigRefit(M, bone, before, after, at, needs) {
  /** @type {Record<string, string>} */
  const how = {};
  for (const c of M.bones.filter(b => b.par === bone)) {
    const need = needs.find(n => n.child === c.n),
      s = need && need.sockets.find(name => name in at);
    if (s) {
      c.at = [round3(at[s][0] / M.k), round3(at[s][1] / M.k)];
      how[c.n] = s;
      continue;
    }
    const fx = before.w ? (c.at[0] * M.k - before.ox) / before.w : 0.5,
      fy = before.h ? (c.at[1] * M.k - before.oy) / before.h : 0.5;
    c.at = [round3((after.ox + fx * after.w) / M.k), round3((after.oy + fy * after.h) / M.k)];
    how[c.n] = 'in proportion';
  }
  return how;
}
/** a sheet grown to w x h (the old pixels where they were) @param {Pixels} p @param {number} w @param {number} h */
export function rigSheetGrow(p, w, h) {
  if (p.width === w && p.height === h) return p;
  const out = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let y = 0; y < Math.min(h, p.height); y++)
    out.data.set(p.data.subarray(y * p.width * 4, y * p.width * 4 + Math.min(w, p.width) * 4), y * w * 4);
  return out;
}
/** @param {Pixels} dst @param {Pixels} src @param {number} x @param {number} y */
export function rigSheetPut(dst, src, x, y) {
  for (let j = 0; j < src.height; j++)
    dst.data.set(src.data.subarray(j * src.width * 4, (j + 1) * src.width * 4), ((y + j) * dst.width + x) * 4);
}
/**
 * The swap as one change: for each prepared picture, its frames go below its view's sheet, the bone takes the new
 * picture, its children refit, and geo moves by what changed. Returns the new rig and sheets; the inputs are left
 * as they were (for undo).
 * @param {Record<string, RigView>} rig a species' rig (front, back)
 * @param {Map<string, Pixels>} sheets each view's sheet by its path (both views may share one)
 * @param {(view: string) => string} pathOf a view's sheet path
 * @param {{ view: string, bone: string, frames: Record<string, Pixels>, ox: number, oy: number,
 *   at: Record<string, [number, number]>, needs: { child: string, sockets: string[] }[], keepFrames?: string[] }[]} prepared
 * @param {(M: RigView, view: string) => Record<string, number> | null} geoOf the skeleton builder's framing (rigGeo)
 */
export function rigSwapApply(rig, sheets, pathOf, prepared, geoOf) {
  /** @type {Record<string, RigView>} */
  const out = JSON.parse(JSON.stringify(rig)),
    /** @type {Map<string, Pixels>} */ grown = new Map(sheets),
    /** @type {Record<string, Record<string, number> | null>} */ before = {},
    /** @type {Record<string, Record<string, string>>} */ how = {};
  for (const view of Object.keys(out)) before[view] = geoOf(rig[view], view);
  for (const p of prepared) {
    const M = out[p.view],
      b = M.bones.find(x => x.n === p.bone);
    if (!b) throw new Error(`no bone ${p.bone} in the ${p.view} view`);
    const path = pathOf(p.view),
      sheet = grown.get(path);
    if (!sheet) throw new Error(`no sheet ${path}`);
    const names = Object.keys(p.frames),
      w = names.reduce((s, n) => s + p.frames[n].width + 1, 1),
      h = Math.max(...names.map(n => p.frames[n].height)),
      y = sheet.height + 1,
      next = rigSheetGrow(sheet, Math.max(sheet.width, w + 1), y + h + 1),
      /** @type {Record<string, [number, number, number, number]>} */ f = {};
    let x = 1;
    for (const n of names) {
      const fr = p.frames[n];
      rigSheetPut(next, fr, x, y);
      f[n] = [x, y, fr.width, fr.height];
      x += fr.width + 1;
    }
    const old = b.i >= 0 ? M.imgs[b.i] : null,
      ob = old ? old.f[Object.keys(old.f).includes('idle') ? 'idle' : Object.keys(old.f)[0]] : null;
    for (const keep of p.keepFrames || []) if (old && old.f[keep] && !f[keep]) f[keep] = [...old.f[keep]];
    const main = f.main || f.idle || f[names[0]];
    b.i = M.imgs.length; /* its own picture: bones that shared the old one keep it */
    M.imgs.push({ ox: p.ox, oy: p.oy, f });
    how[`${p.view} ${p.bone}`] = rigRefit(
      M,
      p.bone,
      ob && old ? { ox: old.ox, oy: old.oy, w: ob[2], h: ob[3] } : { ox: p.ox, oy: p.oy, w: main[2], h: main[3] },
      { ox: p.ox, oy: p.oy, w: main[2], h: main[3] },
      p.at,
      p.needs
    );
    grown.set(path, next);
    for (const v of Object.keys(out)) if (pathOf(v) === path) out[v].size = [next.width, next.height];
  }
  for (const view of Object.keys(out)) {
    const a = before[view],
      g = geoOf(out[view], view),
      G = out[view].geo;
    if (!a || !g || !G) continue;
    /* every builder keeps mid = cy = (top + base) / 2 (logic/data-checks.js dataRigs checks it) */
    for (const key of ['top', 'hw']) if (typeof G[key] === 'number') G[key] = +(G[key] + g[key] - a[key]).toFixed(2);
    if (typeof G.top === 'number' && typeof out[view].base === 'number')
      G.mid = G.cy = +((G.top + out[view].base) / 2).toFixed(2);
  }
  return { rig: out, sheets: grown, how };
}
