// @ts-check
'use strict';
/* ================= THE SHOWCASE (the online track, ON-3) =================
   Players share a Billie's look and vote on each other's (docs/phases/online-track.md, ON-3). Only the look goes
   online: species, coat, sizes, splice, Augments, level and names; nothing of value moves, and the game draws it
   with its own art (skeleton-rig.js rigCanvasHTML), so there are no image uploads. js/showcase.js does the
   Firestore side; firebase/firestore.rules guards it.
   - Entries: showcase/<uid>_<slot>, three slots a player (SHOW_SLOTS). `k` stamps each entry when it is made, so
     votes and reports on an entry that was replaced don't carry over.
   - Weekly themes (showcase.json, one a week from Monday 00:00 UTC, logic/daily.js boardWeek): an entry made in a
     week enters that week's theme when its Billie fits (`th`); `wv` is its sort key (week * SHOW_WEEK_KEY + votes,
     0 when off the theme), so one range on one field lists a week's theme by votes with no index to set up.
   - Votes: each entry keeps its own count `v`; Spark's SDK (Firebase compat 10.12.5) has no count(), and a count
     can't sort a list anyway. The vote and the count go in one batch.
   - Ribbons: the week's top entries in its theme (showcase.json ribbons: how many, and their names) earn one; the
     winner's own game gives it (showAward) when it next looks after the week is over. Cosmetic: shown on the Billie
     sheet and the Trainer card, never in battle (the owner, 2026-10-27).
   - Hidden: an entry the moderator hid, or one reported by ONLINE_HIDE_AT accounts more than the moderator cleared.
   Logic only: no DOM, no Date.now (tools/test/showcase.test.mjs). */
/** @import { ShowcaseData, ShowcaseTheme } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { COATS, ROBOTS, RULES, SPECIES } from '../game-data.js';
import { augFit } from './augments.js';
import { graftFit } from './genes.js';
import { billyTypes, cleanName, geneData, partSlots } from './rules.js';
import {
  SHOW_NAME_MOST,
  SHOW_NICK_MOST,
  SHOW_RIBBONS_MOST,
  SHOW_RIB_MOST,
  SHOW_SLOTS,
  SHOW_VOTES_MOST,
  SHOW_WEEK_KEY,
} from './meta-state.js';
import { graftShapeOk } from './saves.js';
import { reportHidden, reportTarget } from './online.js';
import { legalBilly, onlineCopy } from './online-legal.js';
/* eslint-disable no-func-assign */
expose({
  SHOW_KEYS: [() => SHOW_KEYS],
  // @ts-expect-error -- replaced on purpose
  ribbonName: [() => ribbonName, v => (ribbonName = v)],
  showAbom: [() => showAbom],
  // @ts-expect-error -- replaced on purpose
  showAward: [() => showAward, v => (showAward = v)],
  showByVotes: [() => showByVotes],
  // @ts-expect-error -- replaced on purpose
  showEntry: [() => showEntry, v => (showEntry = v)],
  showHidden: [() => showHidden],
  showId: [() => showId],
  // @ts-expect-error -- replaced on purpose
  showLook: [() => showLook, v => (showLook = v)],
  showPlain: [() => showPlain],
  showReportTarget: [() => showReportTarget],
  // @ts-expect-error -- replaced on purpose
  showSlotFree: [() => showSlotFree, v => (showSlotFree = v)],
  showText: [() => showText],
  // @ts-expect-error -- replaced on purpose
  showTheme: [() => showTheme, v => (showTheme = v)],
  // @ts-expect-error -- replaced on purpose
  showThemeFits: [() => showThemeFits, v => (showThemeFits = v)],
  // @ts-expect-error -- replaced on purpose
  showValid: [() => showValid, v => (showValid = v)],
  showVoteId: [() => showVoteId],
  showVoteKey: [() => showVoteKey],
  // @ts-expect-error -- replaced on purpose
  showVoteSet: [() => showVoteSet, v => (showVoteSet = v)],
  showWeekRange: [() => showWeekRange],
  showWhole: [() => showWhole],
  // @ts-expect-error -- replaced on purpose
  showWinners: [() => showWinners, v => (showWinners = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the keys an entry may hold, as the rules' validShow (hid: the moderator's alone) */
export const SHOW_KEYS = [
  'u',
  'name',
  'sp',
  'coat',
  'build',
  'graft',
  'aug',
  'abom',
  'lvl',
  'nick',
  'ot',
  'th',
  'w',
  'k',
  'v',
  'wv',
  'r',
  'ok',
  'hid',
];

/** a week's theme: showcase.json's themes in order, round again @param {number} week @param {ShowcaseData} S
 * @returns {ShowcaseTheme} */
export function showTheme(week, S) {
  const n = S.themes.length;
  return S.themes[((Math.floor(week) % n) + n) % n];
}

/** whether a Billie (or an entry's look) is an abomination: a risky egg's mark, or an Unstable splice @param {any} m */
export const showAbom = m => !!m && ((!!m.mut && m.mut.k === 'abom') || !!m.unstable);

/** whether a Billie fits a theme @param {ShowcaseTheme} T @param {any} m @param {(m: any) => string[]} [typesOf]
 * a Billie's types (rules.js billyTypes) */
export function showThemeFits(T, m, typesOf = billyTypes) {
  if (!T || !m) return false;
  switch (T.need) {
    case 'any':
      return true;
    case 'abom':
      return showAbom(m);
    case 'aug':
      return !!m.aug && Object.keys(m.aug).length > 0;
    case 'graft':
      return !!m.graft && Object.keys(m.graft).length > 0;
    case 'type':
      return !!T.type && typesOf(m).includes(T.type);
  }
  return false;
}

/** an entry's id @param {string} u @param {number} slot */
export const showId = (u, slot) => `${u}_${slot}`;
/** a vote's id: the entry, its stamp, the voter @param {string} id @param {number} k @param {string} u */
export const showVoteId = (id, k, u) => `${id}_${k}_${u}`;
/** the key a save remembers a vote by @param {string} id @param {number} k */
export const showVoteKey = (id, k) => `${id}_${k}`;
/** an entry's report target (reports/<target>, ON-1's 'user_<uid>' beside it): its id and stamp @param {string} id @param {number} k */
export const showReportTarget = (id, k) => reportTarget('show', `${id}_${k}`);
/** the range of the sort key that lists a week's theme @param {number} w @returns {[number, number]} [from, to) */
export const showWeekRange = w => [w * SHOW_WEEK_KEY, (w + 1) * SHOW_WEEK_KEY];

/**
 * a Billie as a new entry: only its look and names, in the week's theme when it fits. Null with a reason when it
 * can't go: a robot, or a Billie the legality check refuses (logic/online-legal.js legalBilly, on its online copy).
 * @param {any} m a Billie of the save
 * @param {{ u: string, name: string }} me
 * @param {number} week @param {number} k the entry's stamp (ms) @param {ShowcaseTheme} T the week's theme
 * @returns {{ e: Record<string, any> | null, why: string }}
 */
export function showEntry(m, me, week, k, T) {
  const c = onlineCopy(m, { u: me.u, n: me.name });
  if (!c) return { e: null, why: 'robot' };
  const why = legalBilly(c);
  if (why) return { e: null, why };
  const fits = showThemeFits(T, c),
    /** @type {Record<string, any>} */
    e = {
      u: me.u,
      name: cleanName(me.name, SHOW_NAME_MOST) || 'Trainer',
      sp: c.sp,
      abom: showAbom(c),
      lvl: c.lvl,
      nick: c.nick || '',
      ot: (c.ot && c.ot.n) || cleanName(me.name, SHOW_NAME_MOST) || 'Trainer',
      th: fits ? T.id : '',
      w: week,
      k,
      v: 0,
      wv: fits ? week * SHOW_WEEK_KEY : 0,
      r: 0,
      ok: 0,
    };
  if (c.coat) e.coat = c.coat;
  if (c.build) e.build = { ...c.build };
  if (c.graft) e.graft = { ...c.graft };
  if (c.aug) e.aug = Object.fromEntries(Object.entries(c.aug).map(([s, p]) => [s, /** @type {any} */ (p).id]));
  return { e, why: '' };
}

/** an entry's look as a Billie-like object for the drawing (graftLook, rigCanvasHTML) and the theme check
 * @param {any} e */
export function showLook(e) {
  /** @type {any} */
  const m = { sp: e.sp };
  if (e.coat) m.coat = e.coat;
  if (e.build) m.build = e.build;
  if (e.graft) m.graft = e.graft;
  if (e.aug) m.aug = Object.fromEntries(Object.entries(e.aug).map(([s, id]) => [s, { uid: 'show', id, up: 0 }]));
  if (e.abom) m.mut = { k: 'abom' };
  return m;
}

export const showPlain = (/** @type {unknown} */ v) =>
  !!v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(/** @type {object} */ (v), '__proto__');
export const showWhole = (/** @type {unknown} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
  Number.isInteger(v) && /** @type {number} */ (v) >= lo && /** @type {number} */ (v) <= hi;
export const showText = (/** @type {unknown} */ v, /** @type {number} */ n) =>
  typeof v === 'string' && v.length <= n && cleanName(v, n) === v;

/** '' when an entry read from the database can be drawn and listed, else why not: the shapes the rules allow, a
 * species, coat, sizes, splice and Augments the game has (a look made by hand that the game can't draw is dropped)
 * @param {any} e */
export function showValid(e) {
  if (!showPlain(e) || Object.keys(e).some(k => !SHOW_KEYS.includes(k))) return 'shape';
  if (typeof e.u !== 'string' || !e.u || e.u.length > 128) return 'owner';
  if (!showText(e.name, SHOW_NAME_MOST) || !showText(e.ot, SHOW_NAME_MOST) || !showText(e.nick, SHOW_NICK_MOST))
    return 'name';
  const S = typeof e.sp === 'string' && Object.hasOwn(SPECIES, e.sp) ? SPECIES[e.sp] : null;
  if (!S) return 'species';
  if (!showWhole(e.lvl, 1, 100)) return 'level';
  if (typeof e.abom !== 'boolean') return 'shape';
  for (const k of ['w', 'k', 'v', 'wv', 'r', 'ok']) if (!showWhole(e[k], 0, 1e15)) return 'shape';
  if (e.hid != null && typeof e.hid !== 'boolean') return 'shape';
  if (typeof e.th !== 'string' || e.th.length > 32) return 'theme';
  if (e.coat != null) {
    const C = typeof e.coat === 'string' && Object.hasOwn(COATS, e.coat) ? COATS[e.coat] : null;
    if (!C || (C.form && S.coat !== e.coat)) return 'coat';
  }
  if (e.build != null) {
    const sizes = (RULES.parts && RULES.parts.sizes) || {},
      slots = partSlots();
    if (!showPlain(e.build) || Object.keys(e.build).length !== slots.length) return 'build';
    if (slots.some(s => !Object.hasOwn(sizes, e.build[s]))) return 'build';
  }
  const D = geneData();
  if (e.graft != null) {
    if (!graftShapeOk(e.graft) || !showPlain(e.graft)) return 'splice';
    const g = graftFit(D, e.sp, e.graft);
    if (!g || Object.keys(g).length !== Object.keys(e.graft).length) return 'splice';
  }
  if (e.aug != null) {
    if (!showPlain(e.aug) || Object.values(e.aug).some(id => typeof id !== 'string' || !ROBOTS.parts[id]))
      return 'augment';
    const a = augFit(D, e.sp, showLook(e).aug);
    if (!a || Object.keys(a).length !== Object.keys(e.aug).length) return 'augment';
  }
  return '';
}

/** whether an entry is hidden for everyone: the moderator hid it, or enough accounts reported it @param {any} e */
export const showHidden = e => !!e && (e.hid === true || reportHidden({ n: e.r, ok: e.ok }));

/** entries by votes, then the earlier first (an equal count keeps the one that was there first)
 * @param {any[]} list */
export const showByVotes = list => list.slice().sort((a, b) => b.v - a.v || a.k - b.k);

/**
 * a week's ribbon winners: its theme's entries (the week's sort key range), not hidden, with at least one vote, by
 * votes; as many as showcase.json has ribbons. p: the place, 0 first
 * @param {any[]} list entries read for the week @param {number} week @param {ShowcaseData} S
 * @returns {{ id: string, u: string, k: number, th: string, p: number }[]}
 */
export function showWinners(list, week, S) {
  const [lo, hi] = showWeekRange(week),
    T = showTheme(week, S);
  return showByVotes(
    list.filter(
      e => e && e.id && e.w === week && e.th === T.id && e.wv >= lo && e.wv < hi && e.v >= 1 && !showHidden(e)
    )
  )
    .slice(0, S.ribbons.length)
    .map((e, p) => ({ id: e.id, u: e.u, k: e.k, th: e.th, p }));
}

/** the first free slot of mine, or -1 when all three hold an entry @param {{ s: { i: number }[] }} show meta.show */
export function showSlotFree(show) {
  for (let i = 0; i < SHOW_SLOTS; i++) if (!show.s.some(x => x.i === i)) return i;
  return -1;
}

/** remember (or forget) a vote of mine; the oldest go past SHOW_VOTES_MOST @param {{ v: string[] }} show
 * @param {string} key showVoteKey @param {boolean} on */
export function showVoteSet(show, key, on) {
  show.v = show.v.filter(x => x !== key);
  if (on) show.v.push(key);
  if (show.v.length > SHOW_VOTES_MOST) show.v = show.v.slice(-SHOW_VOTES_MOST);
}

/** a ribbon's name: its place's ("Gold") and the theme's ("Best splice") @param {{ p: number, th: string }} r
 * @param {ShowcaseData} S */
export function ribbonName(r, S) {
  const T = S.themes.find(t => t.id === r.th);
  return `${S.ribbons[r.p] || S.ribbons[S.ribbons.length - 1]} · ${T ? T.name : 'Showcase'}`;
}

/**
 * give a finished week's ribbons to my winning Billies: each winner of mine whose slot (meta.show.s) still holds that
 * entry gives its Billie (by uid, wherever it is: `billies`) a ribbon, and the Trainer card's list one; the week is
 * marked looked at (meta.show.rw), so a ribbon is given once. A Billie released since keeps its line on the card.
 * @param {import('../../types/save-data').MetaShow} show meta.show
 * @param {any[]} billies every Billie of the save @param {ReturnType<typeof showWinners>} winners
 * @param {string} me my uid @param {number} week the week looked at
 * @returns {{ w: number, th: string, p: number, sp: string, nick: string }[]} the ribbons given
 */
export function showAward(show, billies, winners, me, week) {
  const out = [];
  if (show.rw >= week) return out;
  for (const W of winners) {
    if (W.u !== me) continue;
    const slot = show.s.find(x => showId(me, x.i) === W.id && x.k === W.k);
    if (!slot) continue;
    const m = billies.find(b => b && b.uid === slot.b),
      rib = { w: week, th: W.th, p: W.p };
    if (m) m.ribbons = [...(Array.isArray(m.ribbons) ? m.ribbons : []), rib].slice(-SHOW_RIBBONS_MOST);
    const line = {
      ...rib,
      sp: m ? m.sp : 'unknown',
      nick: cleanName(m ? m.nick || '' : '', SHOW_NICK_MOST),
    };
    show.rib = [...show.rib, line].slice(-SHOW_RIB_MOST);
    out.push(line);
  }
  show.rw = week;
  return out;
}
