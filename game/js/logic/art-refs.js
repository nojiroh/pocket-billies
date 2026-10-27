// @ts-check
'use strict';
/* ================= ART REFERENCES (Studio art track SA-1) =================
   What names each art file, for the Art browser's "Used by" and its unused and legacy searches:
   - the data: any text in the game data (or the parked legacy data) that is an art file's path, with or without
     `art/` in front ("scene/props/house.png" in scenery.json), found wherever it sits; each reference keeps the data
     key and the path inside it (`scenery` › `props/house/img`),
   - the code: the patterns tools/art-code-refs.mjs reads from the game's code (studio/art-code-refs.json), where a `*`
     is a name the code fills in (one folder or file name). A pattern's name that is only a legacy place's (a legacy
     map or location id, never a live one) makes that reference legacy: `scene/flags/*.png` names the flag of a
     legacy town for legacy places only,
   - the art folder's own JSON files (the model recipes' decals and leaves; also in studio/art-code-refs.json),
   - extra references the Studio adds itself (a Billie's sheet from its rig, which no data text names).
   - the keep list (studio/art-keep.json, SA-5): pictures nothing loads that stay on purpose (a tool's input, the portrait
     kit), each with its reason,
   - the legacy folder (art/legacy/, SA-5): art of the legacy world, kept for reference and shown read-only.
   A file is `used` when a live reference names it, `legacy` when only legacy ones do (or it sits in art/legacy/),
   `kept` when only the keep list does, `unused` when nothing does.
   The code is read as patterns, so "unused" means "no reference found", never proof: the unused-art report (SA-5)
   checks each file again with grep before anything is deleted.
   Logic only: no DOM, runs in Node (tools/test/art-refs.test.mjs). */
/** @typedef {{ kind: 'data' | 'code' | 'recipe' | 'rig' | 'kept' | 'folder', from: string, at: string, legacy: boolean }} ArtRef */
/** @typedef {{ p: string, why: string }} KeepRef */
/** @typedef {{ p: string, at: string[] }} CodeRef */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LEGACY_DIR: [() => LEGACY_DIR],
  PICTURE_TEXT: [() => PICTURE_TEXT],
  // @ts-expect-error -- replaced on purpose
  artPathOf: [() => artPathOf, v => (artPathOf = v)],
  // @ts-expect-error -- replaced on purpose
  artPathsInData: [() => artPathsInData, v => (artPathsInData = v)],
  // @ts-expect-error -- replaced on purpose
  artPatternTest: [() => artPatternTest, v => (artPatternTest = v)],
  // @ts-expect-error -- replaced on purpose
  artRefIndex: [() => artRefIndex, v => (artRefIndex = v)],
  // @ts-expect-error -- replaced on purpose
  artRefInputs: [() => artRefInputs, v => (artRefInputs = v)],
  // @ts-expect-error -- replaced on purpose
  artRefState: [() => artRefState, v => (artRefState = v)],
  // @ts-expect-error -- replaced on purpose
  artReport: [() => artReport, v => (artReport = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/**
 * A text in the data as an art path ('art/...'), or '' when it names no file in `known`
 * @param {string} s @param {Set<string>} known
 */
export function artPathOf(s, known) {
  if (typeof s !== 'string' || s.length > 300 || !s.includes('/')) return '';
  let p = s.replace(/[?#].*$/, '').replace(/^(\.\.\/)*(game\/)?/, '');
  if (!p.startsWith('art/')) p = 'art/' + p;
  if (known.has(p)) return p;
  if (!/\.\w+$/.test(p) && known.has(p + '.png')) return p + '.png';
  return '';
}

/**
 * Every art path a data value names, with where: [path, at] (at: the keys and indices inside the value, joined by /)
 * @param {unknown} value @param {Set<string>} known
 * @returns {[string, string][]}
 */
export function artPathsInData(value, known) {
  /** @type {[string, string][]} */
  const out = [];
  const walk = (/** @type {unknown} */ v, /** @type {string} */ at, /** @type {number} */ depth) => {
    if (depth > 40) return;
    if (typeof v === 'string') {
      const p = artPathOf(v, known);
      if (p) out.push([p, at]);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, at ? at + '/' + i : String(i), depth + 1));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, at ? at + '/' + k : k, depth + 1);
  };
  walk(value, '', 0);
  return out;
}

/**
 * A code pattern as a test on paths (inside art/): `*` is one name (no slash); the names it matched come back
 * @param {string} p
 * @returns {(path: string) => string[] | null}
 */
export function artPatternTest(p) {
  const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '([^/]+)') + '$');
  return path => {
    const m = re.exec(path);
    return m ? m.slice(1) : null;
  };
}

/**
 * The reference index: art path → the references to it.
 * @param {string[]} paths the art files ('art/...')
 * @param {{
 *   data?: { from: string, value: unknown, legacy?: boolean }[],
 *   code?: CodeRef[],
 *   recipes?: CodeRef[],
 *   extra?: { path: string, ref: ArtRef }[],
 *   ids?: { live: Iterable<string>, legacy: Iterable<string> },
 *   kept?: KeepRef[],
 * }} o
 * @returns {Map<string, ArtRef[]>}
 */
export function artRefIndex(paths, o) {
  const known = new Set(paths),
    /** @type {Map<string, ArtRef[]>} */ ix = new Map(),
    add = (/** @type {string} */ p, /** @type {ArtRef} */ r) => {
      if (!ix.has(p)) ix.set(p, []);
      /** @type {ArtRef[]} */ (ix.get(p)).push(r);
    };
  for (const { from, value, legacy } of o.data || [])
    for (const [p, at] of artPathsInData(value, known)) add(p, { kind: 'data', from, at, legacy: !!legacy });
  const live = new Set(o.ids ? o.ids.live : []),
    old = new Set([...(o.ids ? o.ids.legacy : [])].filter(k => !live.has(k)));
  const code = (o.code || []).map(c => ({ c, test: artPatternTest(c.p) }));
  for (const path of paths) {
    const inArt = path.slice(4);
    for (const { c, test } of code) {
      const names = test(inArt);
      if (!names) continue;
      const legacy = names.some(n => old.has(n.replace(/\.\w+$/, '')));
      add(path, { kind: 'code', from: c.at[0] || '', at: c.p, legacy });
    }
  }
  for (const { p, at } of o.recipes || [])
    for (const from of at) if (known.has('art/' + p)) add('art/' + p, { kind: 'recipe', from, at: '', legacy: false });
  for (const { path, ref } of o.extra || []) if (known.has(path)) add(path, ref);
  for (const k of o.kept || [])
    for (const path of paths)
      if (path === 'art/' + k.p || (k.p.endsWith('/') && path.startsWith('art/' + k.p)))
        add(path, { kind: 'kept', from: 'art-keep', at: k.why, legacy: false });
  for (const path of paths)
    if (path.startsWith(LEGACY_DIR)) add(path, { kind: 'folder', from: 'art/legacy', at: '', legacy: true });
  return ix;
}

/** the legacy art folder: art of the legacy world, read-only in the Studio (SA-5) */
export const LEGACY_DIR = 'art/legacy/';

/**
 * used, legacy (only legacy references, or in art/legacy/), kept (only the keep list) or unused (none)
 * @param {ArtRef[] | undefined} refs
 * @returns {'used' | 'legacy' | 'kept' | 'unused'}
 */
export function artRefState(refs) {
  if (!refs || !refs.length) return 'unused';
  if (refs.some(r => r.kind === 'folder')) return 'legacy';
  if (refs.some(r => !r.legacy && r.kind !== 'kept')) return 'used';
  return refs.some(r => r.legacy) ? 'legacy' : 'kept';
}

/**
 * The index's inputs from the game data, the parked legacy data (as legacy-view.js reads it: `mapIds`, `lines` and the
 * other keys), studio/art-code-refs.json, the keep list and a Billie sheet's path (`sheet(sp, view)`): the same for the
 * Studio's Art browser and tools/art-unused.mjs, so both count alike
 * @param {{ D: Record<string, any>, legacy?: Record<string, any>, code?: { refs?: CodeRef[], recipes?: CodeRef[] },
 *   kept?: KeepRef[], sheet: (sp: string, view: string) => string }} o
 */
export function artRefInputs(o) {
  const D = o.D,
    L = o.legacy || {},
    data = Object.entries(D).map(([from, value]) => ({ from, value, legacy: false }));
  for (const [k, v] of Object.entries(L))
    if (k !== 'mapIds' && k !== 'lines') data.push({ from: 'legacy ' + k, value: v, legacy: true });
  /** @type {{ path: string, ref: ArtRef }[]} */
  const extra = [];
  for (const Ln of D.lines || [])
    (Ln.names || []).forEach((/** @type {string} */ _n, /** @type {number} */ i) => {
      for (const v of ['front', 'back'])
        extra.push({ path: o.sheet(Ln.id + i, v), ref: { kind: 'rig', from: 'lines', at: Ln.id + i, legacy: false } });
    });
  const ids = (/** @type {any[]} */ rows) => (rows || []).map(r => r && r.id).filter(Boolean);
  return {
    data,
    code: (o.code && o.code.refs) || [],
    recipes: (o.code && o.code.recipes) || [],
    extra,
    kept: o.kept || [],
    ids: {
      live: [...Object.keys(D.maps || {}), ...ids(D.locations)],
      legacy: [...(L.mapIds || []), ...ids(L.locations)],
    },
  };
}

/** a text that reads as an art picture's path ('scene/props/house.png', 'art/ui/bag.svg') */
export const PICTURE_TEXT = /^(art\/)?[a-z0-9_-]+\/[\w/.-]+\.(png|webp|jpg|svg)$/i;

/**
 * The unused-art report: the pictures by state, and what names a picture that isn't there (a data text, or a keep
 * entry whose file or folder is gone)
 * @param {string[]} paths @param {Map<string, ArtRef[]>} ix
 * @param {{ data?: { from: string, value: unknown }[], kept?: KeepRef[] }} o
 * @returns {{ unused: string[], legacy: string[], kept: string[], missing: { path: string, from: string, at: string }[] }}
 */
export function artReport(paths, ix, o) {
  const out = {
    unused: /** @type {string[]} */ ([]),
    legacy: /** @type {string[]} */ ([]),
    kept: /** @type {string[]} */ ([]),
    missing: /** @type {{ path: string, from: string, at: string }[]} */ ([]),
  };
  for (const p of paths) {
    const s = artRefState(ix.get(p));
    if (s !== 'used') out[s].push(p);
  }
  const known = new Set(paths);
  const walk = (
    /** @type {unknown} */ v,
    /** @type {string} */ from,
    /** @type {string} */ at,
    /** @type {number} */ depth
  ) => {
    if (depth > 40) return;
    if (typeof v === 'string') {
      if (v.length > 300 || !PICTURE_TEXT.test(v)) return;
      const p = v.startsWith('art/') ? v : 'art/' + v;
      if (!known.has(p)) out.missing.push({ path: p, from, at });
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, from, at ? at + '/' + i : String(i), depth + 1));
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) walk(x, from, at ? at + '/' + k : k, depth + 1);
  };
  for (const { from, value } of o.data || []) walk(value, from, '', 0);
  for (const k of o.kept || [])
    if (!paths.some(p => p === 'art/' + k.p || (k.p.endsWith('/') && p.startsWith('art/' + k.p))))
      out.missing.push({ path: 'art/' + k.p, from: 'art-keep', at: k.why });
  return out;
}
