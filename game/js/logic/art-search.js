// @ts-check
'use strict';
/* ================= ART SEARCH (Studio art track SA-1) =================
   What the Studio's Art browser needs that isn't drawing: the folders of the art tree (from the file list, never a
   list of names), the search box's words and tokens, and a picture's size from its PNG header.
   A query is words and tokens, split on spaces:
     dir:scene/props   only files in a folder: a folder path, or any part of one ("dir:props")
     w:32  w:>32  w:<=64  w:16-64   the picture's width (h: its height): equal, more, at most, from-to
     unused            nothing in the data or the code names the file (the reference index, logic/art-refs.js)
     legacy            only the legacy world names it
   Every other word must be in the file's path (upper or lower case alike). A token with nothing after its colon is a
   word. Paths are the file list's: `art/<folder>/<name>`.
   Logic only: no DOM, runs in Node (tools/test/art-search.test.mjs). */
/** @typedef {{ op: '=' | '<' | '<=' | '>' | '>=' | '-', a: number, b?: number }} SizeRule */
/** @typedef {{ key: string, text: string, raw: string }} Chip */
/** @typedef {{ words: string[], dirs: string[], w: SizeRule | null, h: SizeRule | null, unused: boolean, legacy: boolean, chips: Chip[] }} ArtQuery */
/** @typedef {{ w?: number, h?: number, state?: 'used' | 'legacy' | 'unused' }} ArtMeta */
/* to-module: start */
/* to-module: end */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  ART_ROOT: [() => ART_ROOT],
  // @ts-expect-error -- replaced on purpose
  artFolderOf: [() => artFolderOf, v => (artFolderOf = v)],
  // @ts-expect-error -- replaced on purpose
  artFolderView: [() => artFolderView, v => (artFolderView = v)],
  // @ts-expect-error -- replaced on purpose
  artMatch: [() => artMatch, v => (artMatch = v)],
  artQueryEmpty: [() => artQueryEmpty],
  artQueryNeedsSize: [() => artQueryNeedsSize],
  // @ts-expect-error -- replaced on purpose
  artQueryParse: [() => artQueryParse, v => (artQueryParse = v)],
  // @ts-expect-error -- replaced on purpose
  artQueryWithout: [() => artQueryWithout, v => (artQueryWithout = v)],
  isArtPicture: [() => isArtPicture],
  // @ts-expect-error -- replaced on purpose
  pngSize: [() => pngSize, v => (pngSize = v)],
  // @ts-expect-error -- replaced on purpose
  sizeRuleParse: [() => sizeRuleParse, v => (sizeRuleParse = v)],
  // @ts-expect-error -- replaced on purpose
  sizeRuleTest: [() => sizeRuleTest, v => (sizeRuleTest = v)],
  sizeRuleText: [() => sizeRuleText],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the art folder's name in the file list's paths */
export const ART_ROOT = 'art';

/** a picture file the browser lists */
export const isArtPicture = (/** @type {string} */ p) => /\.(png|webp|jpg|svg)$/i.test(p);

/**
 * w:/h: text into a rule, or null when it isn't one ("32", ">32", "<=64", "16-64")
 * @param {string} s
 * @returns {SizeRule | null}
 */
export function sizeRuleParse(s) {
  const r = /^(\d+)-(\d+)$/.exec(s);
  if (r) {
    const a = +r[1],
      b = +r[2];
    return { op: '-', a: Math.min(a, b), b: Math.max(a, b) };
  }
  const m = /^(<=|>=|<|>|=)?(\d+)$/.exec(s);
  if (!m) return null;
  return { op: /** @type {SizeRule['op']} */ (m[1] || '='), a: +m[2] };
}

/** @param {SizeRule} r @param {number} v */
export function sizeRuleTest(r, v) {
  switch (r.op) {
    case '<':
      return v < r.a;
    case '<=':
      return v <= r.a;
    case '>':
      return v > r.a;
    case '>=':
      return v >= r.a;
    case '-':
      return v >= r.a && v <= /** @type {number} */ (r.b);
    default:
      return v === r.a;
  }
}

/** @param {SizeRule} r */
export const sizeRuleText = r => (r.op === '-' ? `${r.a}–${r.b}` : r.op === '=' ? String(r.a) : r.op + r.a);

/**
 * The search box's text into a query. Each token is also a chip (what it means, in words, and its own text) so the
 * browser can show it and take it off again (artQueryWithout).
 * @param {string} q
 * @returns {ArtQuery}
 */
export function artQueryParse(q) {
  /** @type {ArtQuery} */
  const Q = { words: [], dirs: [], w: null, h: null, unused: false, legacy: false, chips: [] };
  for (const raw of String(q || '').split(/\s+/)) {
    if (!raw) continue;
    const t = raw.toLowerCase(),
      m = /^(dir|w|h):(.+)$/.exec(t);
    if (t === 'unused' || t === 'legacy') {
      Q[t] = true;
      Q.chips.push({ key: t, text: t === 'unused' ? 'Nothing uses it' : 'Legacy only', raw });
    } else if (m && m[1] === 'dir') {
      const d = m[2].replace(/^\/+|\/+$/g, '').replace(/^art\//, '');
      if (!d) Q.words.push(t);
      else {
        Q.dirs.push(d);
        Q.chips.push({ key: 'dir', text: 'In ' + d, raw });
      }
    } else if (m) {
      const r = sizeRuleParse(m[2]);
      if (!r) Q.words.push(t);
      else {
        Q[/** @type {'w' | 'h'} */ (m[1])] = r;
        Q.chips.push({ key: m[1], text: (m[1] === 'w' ? 'Width ' : 'Height ') + sizeRuleText(r), raw });
      }
    } else Q.words.push(t);
  }
  return Q;
}

/**
 * The text with one chip's token taken out
 * @param {string} q @param {Chip} chip
 */
export function artQueryWithout(q, chip) {
  const parts = String(q || '')
    .split(/\s+/)
    .filter(Boolean);
  const i = parts.indexOf(chip.raw);
  if (i >= 0) parts.splice(i, 1);
  return parts.join(' ');
}

/** a query that keeps every file (the browser then shows the folder, not a search) @param {ArtQuery} Q */
export const artQueryEmpty = Q => !Q.words.length && !Q.dirs.length && !Q.w && !Q.h && !Q.unused && !Q.legacy;

/** the query needs the pictures' sizes @param {ArtQuery} Q */
export const artQueryNeedsSize = Q => !!(Q.w || Q.h);

/** a path's folder inside the art folder ('scene/props' for art/scene/props/a.png) @param {string} path */
export function artFolderOf(path) {
  const p = path.startsWith(ART_ROOT + '/') ? path.slice(ART_ROOT.length + 1) : path;
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

/**
 * Whether a file passes the query. A size rule on a picture whose size isn't known yet doesn't pass ('size': the
 * browser reads the size and asks again).
 * @param {string} path @param {ArtMeta | undefined} meta @param {ArtQuery} Q
 * @returns {boolean | 'size'}
 */
export function artMatch(path, meta, Q) {
  const lower = path.toLowerCase(),
    folder = '/' + artFolderOf(lower) + '/';
  for (const d of Q.dirs) if (!folder.includes('/' + d + '/')) return false;
  for (const w of Q.words) if (!lower.includes(w)) return false;
  if (Q.unused && (!meta || meta.state !== 'unused')) return false;
  if (Q.legacy && (!meta || meta.state !== 'legacy')) return false;
  if (Q.w || Q.h) {
    if (!meta || meta.w == null || meta.h == null) return 'size';
    if (Q.w && !sizeRuleTest(Q.w, meta.w)) return false;
    if (Q.h && !sizeRuleTest(Q.h, meta.h)) return false;
  }
  return true;
}

/**
 * A folder of the tree as the browser shows it: the breadcrumbs to it, its folders (with how many pictures each holds,
 * all the way down) and its own pictures. `at` is a folder inside the art folder ('' for the top).
 * @param {string[]} paths the file list's paths @param {string} at
 * @returns {{ at: string, crumbs: { name: string, at: string }[], folders: { name: string, at: string, count: number }[], files: string[] }}
 */
export function artFolderView(paths, at) {
  at = String(at || '').replace(/^\/+|\/+$/g, '');
  const pre = at ? at + '/' : '',
    /** @type {Map<string, number>} */ sub = new Map(),
    /** @type {string[]} */ files = [];
  for (const p of paths) {
    const f = artFolderOf(p);
    if (f === at) files.push(p);
    else if (f.startsWith(pre) || (!at && f)) {
      const name = f.slice(pre.length).split('/')[0];
      sub.set(name, (sub.get(name) || 0) + 1);
    }
  }
  const crumbs = [{ name: ART_ROOT, at: '' }];
  if (at) at.split('/').reduce((acc, name) => (crumbs.push({ name, at: acc + name }), acc + name + '/'), '');
  return {
    at,
    crumbs,
    folders: [...sub]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, at: pre + name, count })),
    files: files.sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * A PNG's size from its first 24 bytes (the signature and the IHDR chunk), or null when they aren't a PNG's
 * @param {Uint8Array} b
 * @returns {{ w: number, h: number } | null}
 */
export function pngSize(b) {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!b || b.length < 24 || SIG.some((v, i) => b[i] !== v)) return null;
  if (String.fromCharCode(b[12], b[13], b[14], b[15]) !== 'IHDR') return null;
  const u32 = (/** @type {number} */ i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  return { w: u32(16), h: u32(20) };
}
