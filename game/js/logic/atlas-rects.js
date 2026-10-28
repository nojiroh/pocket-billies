// @ts-check
'use strict';
/* ================= ATLAS RECTANGLES (Studio art track SA-2b) =================
   The small icons (items, battle particles, map marks) are cut from one sheet, art/icons/icons.png, by the rectangles
   in art/manifest.js: `window.ARTMAN={"icons":{"<key>":[x,y,w,h],...},"battle":{...}};`, one line (art.js iconCanvas
   reads them). The Studio's atlas editor (studio/js/atlas-editor.js) moves, resizes, adds, renames and deletes them;
   this is its arithmetic: the file's text, the problems a sheet can have, a free spot, a rename that keeps the order,
   and what in the data names a key: an item's icon is `i_` + (its `icon` or its id) unless it has its own picture
   (`img`, PK-11), a type's battle particles are its `fx` list. The code names some keys as words too (art-code-refs.json `atlas`).
   Logic only: no DOM, runs in Node (tools/test/atlas-rects.test.mjs). */
/** @typedef {[number, number, number, number]} Rect */
/** @typedef {Record<string, Rect>} Rects */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  MANIFEST_HEAD: [() => MANIFEST_HEAD],
  // @ts-expect-error -- replaced on purpose
  atlasFreeSpot: [() => atlasFreeSpot, v => (atlasFreeSpot = v)],
  atlasKeyOk: [() => atlasKeyOk],
  atlasOverlap: [() => atlasOverlap],
  // @ts-expect-error -- replaced on purpose
  atlasProblems: [() => atlasProblems, v => (atlasProblems = v)],
  // @ts-expect-error -- replaced on purpose
  atlasRename: [() => atlasRename, v => (atlasRename = v)],
  // @ts-expect-error -- replaced on purpose
  atlasRenameData: [() => atlasRenameData, v => (atlasRenameData = v)],
  // @ts-expect-error -- replaced on purpose
  atlasUses: [() => atlasUses, v => (atlasUses = v)],
  // @ts-expect-error -- replaced on purpose
  manifestParse: [() => manifestParse, v => (manifestParse = v)],
  manifestText: [() => manifestText],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MANIFEST_HEAD = 'window.ARTMAN=';

/** art/manifest.js's text as its object; throws when it isn't that file's shape @param {string} text */
export function manifestParse(text) {
  const t = String(text || '');
  if (!t.startsWith(MANIFEST_HEAD)) throw new Error('art/manifest.js doesn’t start with window.ARTMAN=');
  const man = JSON.parse(t.slice(MANIFEST_HEAD.length).replace(/;\s*$/, ''));
  if (!man || typeof man !== 'object' || !man.icons || typeof man.icons !== 'object')
    throw new Error('art/manifest.js has no icons.');
  return man;
}
/** the object as art/manifest.js's text (one line, as it has always been written) @param {any} man */
export const manifestText = man => MANIFEST_HEAD + JSON.stringify(man) + ';\n';

/** what is wrong with the rectangles on a sheet of w x h: { key, msg } each, the sheet's order
 * @param {Rects} icons @param {number} w @param {number} h */
export function atlasProblems(icons, w, h) {
  const out = [],
    E = Object.entries(icons);
  for (const [k, r] of E) {
    if (!Array.isArray(r) || r.length !== 4 || !r.every(v => Number.isInteger(v)))
      out.push({ key: k, msg: 'is not four whole numbers' });
    else if (r[2] < 1 || r[3] < 1) out.push({ key: k, msg: 'has no size' });
    else if (r[0] < 0 || r[1] < 0 || r[0] + r[2] > w || r[1] + r[3] > h)
      out.push({ key: k, msg: `leaves the ${w}×${h} sheet` });
  }
  for (let i = 0; i < E.length; i++)
    for (let j = i + 1; j < E.length; j++)
      if (atlasOverlap(E[i][1], E[j][1])) out.push({ key: E[j][0], msg: `overlaps ${E[i][0]}` });
  return out;
}
/** two rectangles share a pixel @param {Rect} a @param {Rect} b */
export const atlasOverlap = (a, b) =>
  a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** the first spot (rows from the top, left to right) where a w x h rectangle fits a pixel apart from every other on
 * a W x H sheet, or null @param {Rects} icons @param {number} W @param {number} H @param {number} w @param {number} h */
export function atlasFreeSpot(icons, W, H, w, h) {
  const R = Object.values(icons);
  for (let y = 1; y + h <= H; y++)
    for (let x = 1; x + w <= W; x++) {
      const pad = /** @type {Rect} */ ([x - 1, y - 1, w + 2, h + 2]);
      if (!R.some(r => atlasOverlap(pad, r))) return [x, y];
    }
  return null;
}

/** the rectangles with one key renamed, in the same order @param {Rects} icons @param {string} from @param {string} to */
export function atlasRename(icons, from, to) {
  /** @type {Rects} */
  const out = {};
  for (const [k, r] of Object.entries(icons)) out[k === from ? to : k] = r;
  return out;
}

/** a key the Studio may give: letters, digits and _ @param {string} k */
export const atlasKeyOk = k => /^[a-z][a-z0-9_]*$/i.test(k);

/** what in the data names a key: [{ at, kind }] (items/<id>, types/<id>)
 * @param {string} key @param {{ items?: Record<string, any>, types?: any[] }} D */
export function atlasUses(key, D) {
  const out = [];
  /* PK-11: an item with its own picture (img, art/items) draws no rectangle, so it uses none */
  if (key.startsWith('i_'))
    for (const [id, I] of Object.entries(D.items || {}))
      if (I && !I.img && 'i_' + (I.icon || id) === key) out.push({ at: 'items/' + id, kind: 'item icon' });
  for (const t of D.types || [])
    if (t && (t.fx || []).includes(key)) out.push({ at: 'types/' + t.id, kind: 'battle particle' });
  return out;
}

/** renames a key where the data names it (in place): items' icons (an item icon stays i_<name>) and types' particles.
 * Returns how many places changed, or -1 when an item uses it and the new key isn't an item icon's (i_...)
 * @param {{ items?: Record<string, any>, types?: any[] }} D @param {string} from @param {string} to */
export function atlasRenameData(D, from, to) {
  const uses = atlasUses(from, D);
  if (uses.some(u => u.kind === 'item icon') && !to.startsWith('i_')) return -1;
  for (const u of uses) {
    const [kind, id] = u.at.split('/');
    if (kind === 'items') /** @type {Record<string, any>} */ (D.items)[id].icon = to.slice(2);
    else {
      const t = (D.types || []).find(x => x.id === id);
      t.fx = t.fx.map((/** @type {string} */ k) => (k === from ? to : k));
    }
  }
  return uses.length;
}
