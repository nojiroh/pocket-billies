// @ts-check
'use strict';
/* ================= THE RANCH CLOCK (roguelite track RL-10b) =================
   One clock for every ranch timer (training, eggs, passive income), so a phone's clock turned back and then forward
   can't pay any timer more than the real time. The save keeps a high-water mark, saveData.ranch.seen: the latest time
   any ranch timer counted to. A clock more than rules.json ranch.guardMs behind it is turned back: time stands still
   at the mark (nothing pays, nothing hatches) until the clock passes it again; no timer's stamp ever moves back.
   Signed in, two things from the server tighten it (account.js): the cloud save's server time `t` raises the mark when
   the save loads (ranchAnchor), and the phone clock's measured skew against the server is taken off the phone's time
   (a phone set ahead counts at the server's pace). Offline, or signed out, it is the phone's clock and the mark.
   The clock is passed in (no Date here). Logic only: no DOM, runs in Node (tools/test/ranch-clock.test.mjs). */
/** @import { SaveData } from '../../types/save-data' */
/** @import { RanchRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  clockSkew: [() => clockSkew, v => (clockSkew = v)],
  // @ts-expect-error -- replaced on purpose
  ranchAnchor: [() => ranchAnchor, v => (ranchAnchor = v)],
  // @ts-expect-error -- replaced on purpose
  ranchNow: [() => ranchNow, v => (ranchNow = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the ranch's time now: the phone's time less the measured skew, or, when that is more than guardMs behind the
    mark (the clock turned back), the mark itself with `back` set. Raises the mark. */
/** @param {SaveData} s @param {number} deviceNow @param {Pick<RanchRules, 'guardMs'>} R @param {number} [skew] the
    phone's clock minus the server's (ms; 0 when unknown) @returns {{ now: number, back: boolean }} */
export function ranchNow(s, deviceNow, R, skew = 0) {
  const t = Math.max(0, Math.floor(deviceNow - (Number.isFinite(skew) ? skew : 0))),
    seen = s.ranch.seen || 0;
  if (t < seen - R.guardMs) return { now: seen, back: true };
  s.ranch.seen = Math.max(seen, t);
  return { now: t, back: false };
}
/** the cloud save's server time (ms) raises the mark: a clock behind the last time the save reached the server is
    turned back, on any device */
/** @param {SaveData} s @param {number} serverMs */
export function ranchAnchor(s, serverMs) {
  if (Number.isFinite(serverMs) && serverMs > 0) s.ranch.seen = Math.max(s.ranch.seen || 0, Math.floor(serverMs));
}
/** the phone clock's skew from a write stamped by the server: the local times just before and after the write and
    the server's time on it; under guardMs either way it counts as none (the round trip's own wobble) */
/** @param {number} before @param {number} after @param {number} serverMs @param {Pick<RanchRules, 'guardMs'>} R */
export function clockSkew(before, after, serverMs, R) {
  if (![before, after, serverMs].every(Number.isFinite) || after < before) return 0;
  const skew = Math.round((before + after) / 2 - serverMs);
  return Math.abs(skew) <= R.guardMs + (after - before) / 2 ? 0 : skew;
}
