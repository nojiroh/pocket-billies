// @ts-check
'use strict';
/* ================= HISTORY (studio track ST-2; Studio plan T1.2) =================
   The Studio's one undo, as a stack. Two kinds of step share one order:
   - data: the parts of the data an edit changed, `{ parts: { name: [before, after] } }`, each a JSON text (null for a
     part added or removed). The data is held as parts (historyParts): one text per second-level entry of the game
     data (`D/maps/<id>`, `D/lines/<i>`, `D/meta/<key>`, or `D/<key>` for a value), one per rig (`R/<species>`), and
     `@order`, the keys and their order. The parts now are `last`, held once; a step holds only what changed.
   - art: a patch of a picture, `{ art: path, before, after }`, each a box of pixels `{ x, y, width, height, data }`
     (or the whole picture when its size changed, `whole: true`; `made: true` when the picture is new, its `before`
     0 x 0: undoing it drops the picture). Art does not change `last`.
   - a text file (SA-2b: an SVG icon, art/manifest.js), `{ art: path, text: { before, after } }` with empty patches:
     `before` is null when the file is new (undoing it drops the file).
   - a group of art steps, one step of the undo (`group`: a kit's parts written at once; studio track ST-3), with the
     data it changed as a data step's parts (`snapshot`) when it changed data too.
   Undoing a data step puts its `before` texts into `last` and hands them back to put into the data; undoing art hands
   the step back to put `before` on the picture. Strings count 2 bytes a character; the data steps and the pictures
   each have a byte cap. Logic only: no DOM, runs in Node (tools/test/history.test.mjs). studio/js/studio-app.js keeps
   it in studioState. */
/** @typedef {{ x: number, y: number, width: number, height: number, data: Uint8ClampedArray }} Patch */
/** @typedef {Record<string, [string | null, string | null]>} PartsDiff */
/** @typedef {Map<string, string>} Parts */
/** @typedef {{ parts: PartsDiff }} DataStep */
/** @typedef {{ art: string, before: Patch, after: Patch, whole?: boolean, made?: boolean, group?: ArtStep[], snapshot?: PartsDiff, text?: { before: string | null, after: string } }} ArtStep */
/** @typedef {{ undo: (DataStep | ArtStep)[], redo: (DataStep | ArtStep)[], last: Parts | null, ver?: number }} History */
/** @typedef {{ kind: 'data', put: Record<string, string | null> } | { kind: 'art', step: ArtStep, put: Patch, parts?: Record<string, string | null> }} Undone */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  HISTORY_ART_BYTES: [() => HISTORY_ART_BYTES],
  HISTORY_DATA_BYTES: [() => HISTORY_DATA_BYTES],
  HISTORY_ORDER: [() => HISTORY_ORDER],
  HISTORY_STEPS: [() => HISTORY_STEPS],
  HISTORY_WIDE_TEXT: [() => HISTORY_WIDE_TEXT],
  // @ts-expect-error -- replaced on purpose
  historyApply: [() => historyApply, v => (historyApply = v)],
  // @ts-expect-error -- replaced on purpose
  historyArt: [() => historyArt, v => (historyArt = v)],
  // @ts-expect-error -- replaced on purpose
  historyArtGroup: [() => historyArtGroup, v => (historyArtGroup = v)],
  historyBytes: [() => historyBytes],
  // @ts-expect-error -- replaced on purpose
  historyCommit: [() => historyCommit, v => (historyCommit = v)],
  // @ts-expect-error -- replaced on purpose
  historyDiff: [() => historyDiff, v => (historyDiff = v)],
  historyDiffBytes: [() => historyDiffBytes],
  // @ts-expect-error -- replaced on purpose
  historyMove: [() => historyMove, v => (historyMove = v)],
  // @ts-expect-error -- replaced on purpose
  historyParts: [() => historyParts, v => (historyParts = v)],
  // @ts-expect-error -- replaced on purpose
  historyPartsBytes: [() => historyPartsBytes, v => (historyPartsBytes = v)],
  // @ts-expect-error -- replaced on purpose
  historyPartsData: [() => historyPartsData, v => (historyPartsData = v)],
  // @ts-expect-error -- replaced on purpose
  historyRedo: [() => historyRedo, v => (historyRedo = v)],
  historyTextBytes: [() => historyTextBytes],
  // @ts-expect-error -- replaced on purpose
  historyTextStep: [() => historyTextStep, v => (historyTextStep = v)],
  // @ts-expect-error -- replaced on purpose
  historyTrim: [() => historyTrim, v => (historyTrim = v)],
  // @ts-expect-error -- replaced on purpose
  historyUndo: [() => historyUndo, v => (historyUndo = v)],
  isCacheKey: [() => isCacheKey],
  isPartObject: [() => isPartObject],
  noPixels: [() => noPixels],
  partReplacer: [() => partReplacer],
  partText: [() => partText],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** at most this many steps, at most this many bytes of pictures and this many bytes of data in them; the oldest go
    first */
export const HISTORY_STEPS = 80;
export const HISTORY_ART_BYTES = 64 * 1024 * 1024;
export const HISTORY_DATA_BYTES = 64 * 1024 * 1024;
/** the part that holds the keys and their order */
export const HISTORY_ORDER = '@order';

/* caches kept on the data (keys starting with _, as the height cache's clock in a map) are left out, as saving does */
export const isCacheKey = (/** @type {string} */ k) => k[0] === '_' && k.length > 1;
export const partReplacer = (/** @type {string} */ k, /** @type {unknown} */ v) => (isCacheKey(k) ? undefined : v);
export const partText = (/** @type {unknown} */ v) => JSON.stringify(v, partReplacer);
export const isPartObject = (/** @type {unknown} */ v) => v !== null && typeof v === 'object';

/**
 * The data and the rigs as parts: `D/<key>/<id>` for each entry of an object or array section, `D/<key>` for a value,
 * `R/<species>` for each rig, and `@order` (the keys, in order). Parsing them back (historyPartsData) gives data whose
 * JSON is the same as the whole data's, without the `_` caches.
 * @param {any} D @param {any} R @returns {Parts}
 */
export function historyParts(D, R) {
  /** @type {Parts} */
  const parts = new Map();
  /** @type {any[]} */
  const order = [];
  for (const k of Object.keys(D || {})) {
    if (isCacheKey(k)) continue;
    const v = D[k];
    if (Array.isArray(v)) {
      order.push([k, 'a', v.length]);
      for (let i = 0; i < v.length; i++) parts.set(`D/${k}/${i}`, partText(v[i]) ?? 'null');
    } else if (isPartObject(v)) {
      const ks = [];
      for (const s of Object.keys(v)) {
        if (isCacheKey(s)) continue;
        const t = partText(v[s]);
        if (t === undefined) continue;
        ks.push(s);
        parts.set(`D/${k}/${s}`, t);
      }
      order.push([k, 'o', ks]);
    } else {
      const t = partText(v);
      if (t === undefined) continue;
      order.push([k, 'v']);
      parts.set(`D/${k}`, t);
    }
  }
  /** @type {string[] | null} */
  let rigs = null;
  if (isPartObject(R)) {
    rigs = [];
    for (const s of Object.keys(R)) {
      if (isCacheKey(s)) continue;
      const t = partText(R[s]);
      if (t === undefined) continue;
      rigs.push(s);
      parts.set(`R/${s}`, t);
    }
  }
  parts.set(HISTORY_ORDER, JSON.stringify({ D: order, R: rigs }));
  return parts;
}

/** the whole data and rigs back from parts (new objects) */
export function historyPartsData(/** @type {Parts} */ parts) {
  const O = JSON.parse(/** @type {string} */ (parts.get(HISTORY_ORDER)));
  const read = (/** @type {string} */ name) => JSON.parse(/** @type {string} */ (parts.get(name)));
  /** @type {any} */
  const D = {};
  for (const [k, kind, x] of O.D) {
    if (kind === 'v') D[k] = read(`D/${k}`);
    else if (kind === 'a') D[k] = Array.from({ length: x }, (_, i) => read(`D/${k}/${i}`));
    else {
      /** @type {any} */
      const o = {};
      for (const s of x) o[s] = read(`D/${k}/${s}`);
      D[k] = o;
    }
  }
  /** @type {any} */
  let R = null;
  if (O.R) {
    R = {};
    for (const s of O.R) R[s] = read(`R/${s}`);
  }
  return { D, R };
}

/** where two sets of parts differ: { name: [before, after] } (null for a part one side lacks), or null */
export function historyDiff(/** @type {Parts} */ a, /** @type {Parts} */ b) {
  /** @type {PartsDiff} */
  const d = {};
  let n = 0;
  for (const [k, v] of b) {
    const o = a.get(k);
    if (o !== v) {
      d[k] = [o ?? null, v];
      n++;
    }
  }
  for (const [k, v] of a)
    if (!b.has(k)) {
      d[k] = [v, null];
      n++;
    }
  return n ? d : null;
}

/** one side of a diff (0 before, 1 after), put into `parts`; returns what to put into the data */
export function historyApply(/** @type {Parts} */ parts, /** @type {PartsDiff} */ d, /** @type {0 | 1} */ side) {
  /** @type {Record<string, string | null>} */
  const put = {};
  for (const k of Object.keys(d)) {
    const v = d[k][side];
    if (v == null) parts.delete(k);
    else parts.set(k, v);
    put[k] = v;
  }
  return put;
}

/* a text's bytes: 2 a character for the caps; `real`: as the browser stores it, 1 a character when every one is up
   to U+00FF (the self-test's measurement) */
export const HISTORY_WIDE_TEXT = /[\u0100-\uffff]/;
export const historyTextBytes = (/** @type {string | null} */ t, real = false) =>
  !t ? 0 : t.length * (real && !HISTORY_WIDE_TEXT.test(t) ? 1 : 2);
export const historyDiffBytes = (/** @type {PartsDiff} */ d, real = false) => {
  let n = 0;
  for (const k of Object.keys(d)) n += historyTextBytes(d[k][0], real) + historyTextBytes(d[k][1], real);
  return n;
};
/** what a step holds in bytes: its pictures (`art`), its data (`data`), or both; `real` as historyTextBytes */
export const historyBytes = (
  /** @type {DataStep | ArtStep} */ s,
  /** @type {'art' | 'data' | undefined} */ kind = undefined,
  real = false
) => {
  if ('parts' in s) return kind === 'art' ? 0 : historyDiffBytes(s.parts, real);
  const data = kind === 'art' || !s.snapshot ? 0 : historyDiffBytes(s.snapshot, real);
  if (kind === 'data') return data;
  const art = s.group
    ? s.group.reduce((n, g) => n + historyBytes(g, 'art'), 0)
    : s.before.data.length +
      s.after.data.length +
      (s.text ? 2 * ((s.text.before || '').length + s.text.after.length) : 0);
  return art + data;
};
/** the bytes the parts hold, names and texts (`real` as historyTextBytes) */
export function historyPartsBytes(/** @type {Parts | null} */ parts, real = false) {
  let n = 0;
  if (parts) for (const [k, v] of parts) n += historyTextBytes(k, real) + historyTextBytes(v, real);
  return n;
}
export const noPixels = () => ({ x: 0, y: 0, width: 0, height: 0, data: new Uint8ClampedArray(0) });
/** SA-2b: a text file changed from `before` (null: new) to `after`: an art step holding the texts, or null when
 * nothing changed @param {string} path @param {string | null} before @param {string} after @returns {ArtStep | null} */
export function historyTextStep(path, before, after) {
  if (!path || typeof after !== 'string' || before === after) return null;
  return { art: path, before: noPixels(), after: noPixels(), text: { before, after } };
}
/** several picture steps as one (undone and redone together), with the data as it is now when they changed data too */
export function historyArtGroup(
  /** @type {History} */ H,
  /** @type {ArtStep[]} */ steps,
  /** @type {Parts | undefined} */ parts = undefined
) {
  if (!steps.length) return;
  const d = parts && H.last ? historyDiff(H.last, parts) : null;
  if (parts) H.last = parts;
  historyArt(H, {
    art: '',
    before: noPixels(),
    after: noPixels(),
    group: steps,
    ...(d ? { snapshot: d } : {}),
  }); /* two objects: undo and redo tell them apart */
}
export function historyTrim(/** @type {History} */ H) {
  let art = 0,
    data = 0;
  for (const s of H.undo) {
    art += historyBytes(s, 'art');
    data += historyBytes(s, 'data');
  }
  while (
    H.undo.length > HISTORY_STEPS ||
    ((art > HISTORY_ART_BYTES || data > HISTORY_DATA_BYTES) && H.undo.length > 1)
  ) {
    const s = /** @type {DataStep | ArtStep} */ (H.undo.shift());
    art -= historyBytes(s, 'art');
    data -= historyBytes(s, 'data');
  }
}
/** the data now (as parts): a step when it differs from the last. True when one was added (or this is the first) */
export function historyCommit(/** @type {History} */ H, /** @type {Parts} */ parts) {
  if (!H.last) {
    H.last = parts;
    return true;
  }
  const d = historyDiff(H.last, parts);
  if (!d) return false;
  H.undo.push({ parts: d });
  H.redo = [];
  H.last = parts;
  H.ver = (H.ver || 0) + 1;
  historyTrim(H);
  return true;
}
/** a picture changed: a step */
export function historyArt(/** @type {History} */ H, /** @type {ArtStep} */ step) {
  H.undo.push(step);
  H.redo = [];
  H.ver = (H.ver || 0) + 1;
  historyTrim(H);
}
/** one step back: what to put back (data: the parts' texts, null for a part to drop; art: the patch to put on the
    picture, and the parts when the group changed data), or null */
export function historyUndo(/** @type {History} */ H) {
  return historyMove(H, H.undo, H.redo, 0);
}
/** one step forward again, as historyUndo */
export function historyRedo(/** @type {History} */ H) {
  return historyMove(H, H.redo, H.undo, 1);
}
export function historyMove(
  /** @type {History} */ H,
  /** @type {(DataStep | ArtStep)[]} */ from,
  /** @type {(DataStep | ArtStep)[]} */ to,
  /** @type {0 | 1} */ side
) {
  const s = from.pop();
  if (s == null) return null;
  to.push(s);
  H.ver = (H.ver || 0) + 1;
  if ('parts' in s)
    return /** @type {Undone} */ ({ kind: 'data', put: H.last ? historyApply(H.last, s.parts, side) : {} });
  const put = side ? s.after : s.before;
  if (s.snapshot && H.last)
    return /** @type {Undone} */ ({ kind: 'art', step: s, put, parts: historyApply(H.last, s.snapshot, side) });
  return /** @type {Undone} */ ({ kind: 'art', step: s, put });
}
