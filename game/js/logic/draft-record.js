// @ts-check
'use strict';
/* ================= DRAFT RECORD (Studio plan Phase 1, T1.1, docs/plans/studio-roguelite-improvement-plan.md) =================
   The Studio keeps what you haven't proposed yet in this browser (IndexedDB, studio/js/drafts.js), so a closed tab or
   a crash loses nothing. A draft holds only what is pending, not the whole game data:
   - files: the text of each data file that differs from the commit the Studio loaded (game/data paths, index.json
     included when the list of files changed: a deleted entry is a file the index no longer lists);
   - rigsText: the skeletons' text, when they differ from what was loaded;
   - art: each unsaved picture as a Blob;
   - base: that commit, so a restore reads everything at it again (main may have moved on); login and time for the
     prompt. Never a token, and never sent anywhere.
   Logic only: no DOM, runs in Node (tools/test/draft-record.test.mjs). */
/** @typedef {{ path: string, blob: any }} DraftArt */
/** @typedef {{ v: number, key: string, base: string, login: string, time: number, files: Record<string, string>, rigsText: string | null, art: DraftArt[] }} Draft */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  DRAFT_ART: [() => DRAFT_ART],
  DRAFT_FILE: [() => DRAFT_FILE],
  DRAFT_VERSION: [() => DRAFT_VERSION],
  draftEmpty: [() => draftEmpty],
  // @ts-expect-error -- replaced on purpose
  draftFileText: [() => draftFileText, v => (draftFileText = v)],
  // @ts-expect-error -- replaced on purpose
  draftParse: [() => draftParse, v => (draftParse = v)],
  // @ts-expect-error -- replaced on purpose
  draftRecord: [() => draftRecord, v => (draftRecord = v)],
  // @ts-expect-error -- replaced on purpose
  draftSummary: [() => draftSummary, v => (draftSummary = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const DRAFT_VERSION = 1;
/* a data file's path in game/data (index.json, uiTheme.json, maps/copperleaf.json) and an art path as Save takes it */
export const DRAFT_FILE = /^[\w-]+(\/[\w-]+)?\.json$/;
export const DRAFT_ART = /^art\/[\w\-./]+\.(png|webp)$/i;

/** a draft from what is pending @param {Omit<Draft, 'v'>} d @returns {Draft} */
export function draftRecord(d) {
  return {
    v: DRAFT_VERSION,
    key: d.key,
    base: d.base,
    login: d.login,
    time: d.time,
    files: { ...d.files },
    rigsText: d.rigsText,
    art: d.art.map(a => ({ path: a.path, blob: a.blob })),
  };
}

/** a stored draft checked whole: the draft, or null when anything in it is off (an old version, a bad path, a
 * missing blob). A bad draft is never half restored @param {any} x @returns {Draft | null} */
export function draftParse(x) {
  if (!x || typeof x !== 'object' || x.v !== DRAFT_VERSION) return null;
  if (typeof x.key !== 'string' || typeof x.base !== 'string' || typeof x.login !== 'string') return null;
  if (typeof x.time !== 'number' || !Number.isFinite(x.time)) return null;
  if (!x.files || typeof x.files !== 'object' || Array.isArray(x.files)) return null;
  for (const [p, t] of Object.entries(x.files))
    if (!DRAFT_FILE.test(p) || p.includes('..') || typeof t !== 'string') return null;
  if (x.rigsText !== null && typeof x.rigsText !== 'string') return null;
  if (!Array.isArray(x.art)) return null;
  for (const a of x.art)
    if (!a || typeof a.path !== 'string' || !DRAFT_ART.test(a.path) || a.path.includes('..') || !a.blob) return null;
  return draftRecord(x);
}

/** true when a draft holds nothing to restore @param {Draft} d */
export const draftEmpty = d => !Object.keys(d.files).length && d.rigsText == null && !d.art.length;

/** what a draft holds, in words: "2 data files, the skeletons and 1 picture" @param {Draft} d */
export function draftSummary(d) {
  const n = Object.keys(d.files).filter(p => p !== 'index.json').length,
    parts = [];
  if (n || 'index.json' in d.files) parts.push(n === 1 ? '1 data file' : `${n} data files`);
  if (d.rigsText != null) parts.push('the skeletons');
  if (d.art.length) parts.push(d.art.length === 1 ? '1 picture' : `${d.art.length} pictures`);
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'nothing';
}

/** a data file's text on restore: the draft's own, else the loaded commit's. Throws when neither has it (the draft
 * doesn't belong to that commit) @param {Record<string, string>} files @param {Record<string, string>} base
 * @param {string} path */
export function draftFileText(files, base, path) {
  const t = Object.prototype.hasOwnProperty.call(files, path) ? files[path] : base[path];
  if (typeof t !== 'string') throw new Error(`The draft needs ${path}, which isn't at the commit it was made on.`);
  return t;
}
