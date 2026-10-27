// @ts-check
'use strict';
/* ================= ONLINE (the online track, ON-1) =================
   The pure parts of playing with others (docs/phases/online-track.md), tested in plain Node
   (tools/test/online.test.mjs); friends.js does the Firestore side.
   - Who is a friend: each pair's newest request decides (an old "removed" from one side no longer undoes a newer
     "accepted" from the other, the bug SECURITY.md listed).
   - Blocks: blocks/<uid> { list, names } is the owner's own (names: what each was called, for the Unblock list), read by nobody else (the rules read it to refuse a request).
   - Reports: reports/<target> { n, ok } counts the accounts that reported a target, each once
     (reports/<target>/by/<uid>); a target with ONLINE_HIDE_AT reports more than the moderator last cleared is hidden
     for everyone until the moderator looks at it. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BLOCKS_MOST: [() => BLOCKS_MOST],
  ONLINE_HIDE_AT: [() => ONLINE_HIDE_AT],
  REPORT_REASONS: [() => REPORT_REASONS],
  // @ts-expect-error -- replaced on purpose
  blockListClean: [() => blockListClean, v => (blockListClean = v)],
  // @ts-expect-error -- replaced on purpose
  friendListFrom: [() => friendListFrom, v => (friendListFrom = v)],
  onlinePlayOn: [() => onlinePlayOn],
  // @ts-expect-error -- replaced on purpose
  reportHidden: [() => reportHidden, v => (reportHidden = v)],
  reportTarget: [() => reportTarget],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a target's reports at which it is hidden (the owner, 2026-10-26: three different accounts) */
export const ONLINE_HIDE_AT = 3,
  BLOCKS_MOST = 200,
  REPORT_REASONS = ['name', 'picture', 'cheating', 'other'];

/** the friend list from the two sides' requests: per other player, the newest request (by t) decides; one still
 * pending changes nothing
 * @param {string[]} list @param {string} me
 * @param {{ from: string, to: string, status: string, t?: number }[]} inc requests to me
 * @param {{ from: string, to: string, status: string, t?: number }[]} out requests from me */
export function friendListFrom(list, me, inc, out) {
  /** @type {Map<string, { status: string, t: number, mine: boolean }>} */
  const newest = new Map();
  const take = (u, r, mine) => {
    const t = Number.isFinite(r.t) ? /** @type {number} */ (r.t) : 0,
      had = newest.get(u);
    if (!had || t > had.t || (t === had.t && r.status !== 'pending')) newest.set(u, { status: r.status, t, mine });
  };
  for (const r of inc) take(r.from, r, false);
  for (const r of out) take(r.to, r, true);
  const L = new Set(list);
  for (const [u, r] of newest) {
    if (r.status === 'accepted') L.add(u);
    else if (r.status === 'removed' || (r.status === 'declined' && r.mine)) L.delete(u);
  }
  return [...L].filter(u => u && u !== me).slice(0, 50);
}

/** a blocks/<uid> list as stored: player uids, no repeats, at most BLOCKS_MOST @param {unknown} v @returns {string[]} */
export function blockListClean(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(u => typeof u === 'string' && u.length > 0 && u.length <= 128))].slice(0, BLOCKS_MOST);
}

/** whether a player has turned on Online play (Settings; off by default: the owner, 2026-10-26): global views
 * (the Showcase's browsing, GTS, Surprise Trade, random matches) show only with it; friends work either way
 * @param {any} prefs saveData.preferences */
export const onlinePlayOn = prefs => !!(prefs && prefs.online === true);

/** a report target's id: what kind of thing and whose, as one Firestore id ('user_<uid>')
 * @param {'user'} kind @param {string} id */
export const reportTarget = (kind, id) => kind + '_' + id;

/** whether a target is hidden for everyone: reported by ONLINE_HIDE_AT accounts more than the moderator cleared
 * @param {{ n?: number, ok?: number } | null | undefined} r a reports/<target> document */
export function reportHidden(r) {
  if (!r) return false;
  const n = Number.isFinite(r.n) ? /** @type {number} */ (r.n) : 0,
    ok = Number.isFinite(r.ok) ? /** @type {number} */ (r.ok) : 0;
  return n - ok >= ONLINE_HIDE_AT;
}
