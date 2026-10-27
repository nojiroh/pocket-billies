// @ts-check
'use strict';
/* ================= PUBLISH PLAN (Studio plan Phase 0, docs/plans/studio-roguelite-improvement-plan.md) =================
   The Studio's Save / Propose as decisions, so no failure can drop a change. A save first stages what it will send
   (the data's text, the rigs' text, each picture and, SA-2b, each text file with the version it had), sends it, and only after the server said
   yes clears what is still the same as what was sent: a picture painted again, or data edited, while the send was on
   stays unsaved. Also the proposal's branch name and the files a proposal shares with commits made on main since the
   Studio loaded. Logic only: no DOM, runs in Node (tools/test/publish-plan.test.mjs). studio/js/studio-app.js and
   studio/js/github.js use it. */
/** @typedef {{ dataText: string | null, rigsText: string | null, art: { path: string, ver: number }[], texts?: { path: string, ver: number }[] }} PublishStaged */
/** @typedef {{ dataText: string | null, rigsText: string | null, art: Record<string, number | null>, texts?: Record<string, number | null> }} PublishNow */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  publishBranchName: [() => publishBranchName, v => (publishBranchName = v)],
  // @ts-expect-error -- replaced on purpose
  publishConfirm: [() => publishConfirm, v => (publishConfirm = v)],
  publishEmpty: [() => publishEmpty],
  // @ts-expect-error -- replaced on purpose
  publishOverlap: [() => publishOverlap, v => (publishOverlap = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what a confirmed send may mark as saved: data and rigs when their text is still the one sent, and each picture
 * (and text file) still at the version sent
 * @param {PublishStaged} staged @param {PublishNow} now */
export function publishConfirm(staged, now) {
  return {
    data: staged.dataText != null && now.dataText === staged.dataText,
    rigs: staged.rigsText != null && now.rigsText === staged.rigsText,
    art: staged.art.filter(a => now.art[a.path] === a.ver).map(a => a.path),
    texts: (staged.texts || []).filter(a => (now.texts || {})[a.path] === a.ver).map(a => a.path),
  };
}

/** true when a stage holds nothing to send @param {PublishStaged} staged */
export const publishEmpty = staged =>
  staged.dataText == null && staged.rigsText == null && !staged.art.length && !(staged.texts || []).length;

/** the files of a proposal that commits on main have changed since the Studio loaded, sorted
 * @param {string[]} paths @param {string[]} changedOnMain */
export function publishOverlap(paths, changedOnMain) {
  const on = new Set(changedOnMain);
  return [...new Set(paths.filter(p => on.has(p)))].sort();
}

/** a proposal's branch: studio/<login>-<UTC date>-<time to the second>-<4 letters>, so two proposals never share one
 * @param {string} login @param {Date} date @param {string} rand */
export function publishBranchName(login, date, rand) {
  const iso = date.toISOString(),
    stamp = iso.slice(0, 10).replace(/-/g, '') + '-' + iso.slice(11, 19).replace(/:/g, ''),
    who = String(login).replace(/[^A-Za-z0-9-]/g, '') || 'studio',
    tail = String(rand)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 4);
  return `studio/${who}-${stamp}${tail ? '-' + tail : ''}`;
}
