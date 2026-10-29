// @ts-check
'use strict';
/* ================= KAPPI'S TIPS (intro track IN-2) =================
   Kappi speaks during a run only when you struggle or stall (docs/phases/intro-track.md, IN-2): two failed catches in
   a row, the first faint, a Billie under a third of its HP with a potion unused for a whole battle, no pyramids with a
   wild one near, a choice sheet left open without a real choice, a place stood in without heading for a road out, the
   first fight against a type that beats your lead. Each tip is a trigger, a line and a cap (kappiTips.json): never in
   the first battle of a run, at most one per place, a few per run, each one once ever (meta.tipsSeen), never while a
   line or a menu is moving. A world cue (a pulsing button, the road's marker) comes first where the tip has one; Kappi
   speaks only if the cue didn't help.
   This file keeps the run's counters and decides; kappi.js watches the game, shows the cues and Kappi's bubble.
   Logic only: no DOM, no Date (the time is passed in, in ms), runs in Node (tools/test/kappi-tips.test.mjs). */
/** @import { KappiTips, KappiTip } from '../../types/game-data' */
/**
 * @typedef {{ place: string, placeSaid: number, said: number, battles: number, inBattle: boolean, fails: number,
 *   faints: number, sheet: string, sheetT: number, placeT: number, best: number, cued: Record<string, 1>,
 *   due: { id: string, t: number }[], potionLow: boolean }} TipRun
 * what this run's tips know: the place you are in (its id) and whether Kappi spoke there, how many tips Kappi said,
 * battles fought (the one going on counts), the failed catches in a row, faints, the choice sheet open (its key) and
 * since when, since when you've been in this place without getting nearer a road out and the nearest you got, the cues
 * shown, the tips waiting for a quiet moment, and whether the battle on now saw a Billie of yours low with a potion
 * in the bag. Kept in memory: a reload starts the counters over (meta.tipsSeen lasts).
 * @typedef {{ t: number, on: boolean, seen: Record<string, any>, busy: boolean, battle: boolean, sheet?: boolean,
 *   cues?: Record<string, boolean> }} TipCtx
 * the moment: the time (ms), the setting (Kappi's tips on), meta.tipsSeen, whether a line or a menu is moving (busy),
 * whether a battle's on screen and whether a choice sheet is, and which cues can be shown now (cues: absent means all)
 * @typedef {{ kind: 'cue' | 'say', id: string, cue?: string, line?: string }} TipShow
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  TIP_CUES: [() => TIP_CUES],
  TIP_DEFAULTS: [() => TIP_DEFAULTS],
  TIP_TRIGGERS: [() => TIP_TRIGGERS],
  // @ts-expect-error -- replaced on purpose
  hintPlan: [() => hintPlan, v => (hintPlan = v)],
  // @ts-expect-error -- replaced on purpose
  newTipRun: [() => newTipRun, v => (newTipRun = v)],
  // @ts-expect-error -- replaced on purpose
  tipBattle: [() => tipBattle, v => (tipBattle = v)],
  // @ts-expect-error -- replaced on purpose
  tipBattleEnd: [() => tipBattleEnd, v => (tipBattleEnd = v)],
  // @ts-expect-error -- replaced on purpose
  tipBeaten: [() => tipBeaten, v => (tipBeaten = v)],
  // @ts-expect-error -- replaced on purpose
  tipCatch: [() => tipCatch, v => (tipCatch = v)],
  // @ts-expect-error -- replaced on purpose
  tipClocks: [() => tipClocks, v => (tipClocks = v)],
  // @ts-expect-error -- replaced on purpose
  tipDataProblems: [() => tipDataProblems, v => (tipDataProblems = v)],
  // @ts-expect-error -- replaced on purpose
  tipEarlyCue: [() => tipEarlyCue, v => (tipEarlyCue = v)],
  // @ts-expect-error -- replaced on purpose
  tipFaint: [() => tipFaint, v => (tipFaint = v)],
  // @ts-expect-error -- replaced on purpose
  tipFirstRun: [() => tipFirstRun, v => (tipFirstRun = v)],
  // @ts-expect-error -- replaced on purpose
  tipMayCue: [() => tipMayCue, v => (tipMayCue = v)],
  // @ts-expect-error -- replaced on purpose
  tipMaySay: [() => tipMaySay, v => (tipMaySay = v)],
  // @ts-expect-error -- replaced on purpose
  tipMoved: [() => tipMoved, v => (tipMoved = v)],
  // @ts-expect-error -- replaced on purpose
  tipNext: [() => tipNext, v => (tipNext = v)],
  // @ts-expect-error -- replaced on purpose
  tipNoPyramids: [() => tipNoPyramids, v => (tipNoPyramids = v)],
  // @ts-expect-error -- replaced on purpose
  tipOf: [() => tipOf, v => (tipOf = v)],
  // @ts-expect-error -- replaced on purpose
  tipPlace: [() => tipPlace, v => (tipPlace = v)],
  // @ts-expect-error -- replaced on purpose
  tipRaise: [() => tipRaise, v => (tipRaise = v)],
  // @ts-expect-error -- replaced on purpose
  tipSaid: [() => tipSaid, v => (tipSaid = v)],
  // @ts-expect-error -- replaced on purpose
  tipSheet: [() => tipSheet, v => (tipSheet = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the tips' own defaults, for a kappiTips.json that leaves them out */
export const TIP_DEFAULTS = Object.freeze({ run: 5, place: 1, keepS: 30, showS: 4, near: 2 });
/** the triggers a tip may name, and where its line can be said: in a battle, in the world (no battle), on a choice
 * sheet, or anywhere */
export const TIP_TRIGGERS = Object.freeze({
  catchFails: 'battle',
  faint: 'any',
  potionUnused: 'world',
  noPyramids: 'world',
  sheetStall: 'sheet',
  placeStall: 'world',
  foeBeatsLead: 'battle',
});
/** the world cues kappi.js can show */
export const TIP_CUES = Object.freeze(['catchButton', 'itemsButton', 'sheetPulse', 'roadMarker']);

/** a run's tips, before anything happened @returns {TipRun} */
export function newTipRun() {
  return {
    place: '',
    placeSaid: 0,
    said: 0,
    battles: 0,
    inBattle: false,
    fails: 0,
    faints: 0,
    sheet: '',
    sheetT: 0,
    placeT: 0,
    best: Infinity,
    cued: {},
    due: [],
    potionLow: false,
  };
}

/** whether this is the player's first run: the prepared run (run.first, intro track IN-1), or, on a run that doesn't
 * say, the first run played (meta.runs 0) @param {any} run @param {any} meta */
export function tipFirstRun(run, meta) {
  if (!run) return false;
  if (typeof run.first === 'boolean') return run.first;
  return !(meta && meta.runs);
}

/** the tip of a trigger (the first in the file's order), or null @param {KappiTips} D @param {string} when
 * @returns {[string, KappiTip] | null} */
export function tipOf(D, when) {
  for (const [id, T] of Object.entries((D && D.tips) || {})) if (T.when === when) return [id, T];
  return null;
}
/** a trigger fired: its tip waits for a quiet moment (once per run; never one raised in the first battle)
 * @param {TipRun} st @param {KappiTips} D @param {string} when @param {number} t */
export function tipRaise(st, D, when, t) {
  const hit = tipOf(D, when);
  if (!hit) return;
  if (st.inBattle && st.battles <= 1) return;
  if (st.due.some(d => d.id === hit[0])) return;
  st.due.push({ id: hit[0], t });
}

/* ---------- what happened ---------- */
/** you walked into a place (its id): a new place, a new allowance, the stall clock starts
 * @param {TipRun} st @param {string} place @param {number} t */
export function tipPlace(st, place, t) {
  if (place === st.place) return;
  st.place = place;
  st.placeSaid = 0;
  st.placeT = t;
  st.best = Infinity;
  /* the road's marker may pulse again in the next place */
  delete st.cued.roadMarker;
}
/** where you stand: the distance (m) to the nearest road out of the place. Getting nearer by `near` metres than you
 * have been is progress, and the stall clock starts again; wandering about isn't
 * @param {TipRun} st @param {KappiTips} D @param {number} dist @param {number} t */
export function tipMoved(st, D, dist, t) {
  if (!Number.isFinite(dist)) return;
  const near = (D && D.near) ?? TIP_DEFAULTS.near;
  if (st.best === Infinity) st.best = dist;
  else if (dist <= st.best - near) {
    st.best = dist;
    st.placeT = t;
    delete st.cued.roadMarker;
  }
}
/** a battle starts; `beaten`: the foe's type beats your lead's (known now, or later with tipBeaten)
 * @param {TipRun} st @param {KappiTips} D @param {{ beaten?: boolean }} o @param {number} t */
export function tipBattle(st, D, o, t) {
  st.battles++;
  st.inBattle = true;
  st.potionLow = false;
  if (o.beaten) tipBeaten(st, D, t);
}
/** the battle on: the foe out front has a type that beats your lead's @param {TipRun} st @param {KappiTips} D
 * @param {number} t */
export function tipBeaten(st, D, t) {
  tipRaise(st, D, 'foeBeatsLead', t);
}
/** a battle ended. `potion`: the battle saw one of yours under the tip's share of its HP with a potion in the bag, and
 * none was used @param {TipRun} st @param {KappiTips} D @param {{ potion?: boolean }} o @param {number} t */
export function tipBattleEnd(st, D, o, t) {
  /* a tip raised by this battle's end belongs to it: none after the first battle either */
  if (o.potion) tipRaise(st, D, 'potionUnused', t);
  st.inBattle = false;
  st.potionLow = false;
}
/** a pyramid thrown: caught or not. Two misses in a row raise the catch tip; one miss lets its cue show
 * @param {TipRun} st @param {KappiTips} D @param {boolean} caught @param {number} t */
export function tipCatch(st, D, caught, t) {
  if (caught) {
    st.fails = 0;
    return;
  }
  st.fails++;
  const hit = tipOf(D, 'catchFails');
  if (hit && st.fails >= (hit[1].n || 2)) tipRaise(st, D, 'catchFails', t);
}
/** one of yours fainted; the run's first raises the faint tip @param {TipRun} st @param {KappiTips} D @param {number} t */
export function tipFaint(st, D, t) {
  st.faints++;
  if (st.faints === 1) tipRaise(st, D, 'faint', t);
}
/** no pyramids left, and a wild one near: the pyramids tip @param {TipRun} st @param {KappiTips} D @param {number} t */
export function tipNoPyramids(st, D, t) {
  tipRaise(st, D, 'noPyramids', t);
}
/** the choice sheet on screen, by a key that changes with real progress on it (a pick, a purchase), or '' when none
 * is open: the sheet's clock starts when its key changes and only then @param {TipRun} st @param {string} key
 * @param {number} t */
export function tipSheet(st, key, t) {
  if (key === st.sheet) return;
  st.sheet = key || '';
  st.sheetT = t;
  delete st.cued.sheetPulse;
}

/* ---------- what to show ---------- */
/** whether Kappi may say a tip now (its trigger has fired): the setting, once ever, the run's and the place's caps,
 * not in the first battle, not while something moves, and only where its trigger allows
 * @param {TipRun} st @param {KappiTips} D @param {string} id @param {TipCtx} c */
export function tipMaySay(st, D, id, c) {
  const T = D && D.tips && D.tips[id];
  if (!T || !c.on || c.busy || (c.seen && c.seen[id])) return false;
  if (st.said >= ((D.caps && D.caps.run) ?? TIP_DEFAULTS.run)) return false;
  if (st.placeSaid >= ((D.caps && D.caps.place) ?? TIP_DEFAULTS.place)) return false;
  if (c.battle && st.battles <= 1) return false;
  const where = TIP_TRIGGERS[/** @type {keyof typeof TIP_TRIGGERS} */ (T.when)] || 'any';
  if (where === 'battle' && !c.battle) return false;
  if (where === 'world' && (c.battle || c.sheet)) return false;
  if (where === 'sheet' && !c.sheet) return false;
  return true;
}
/** a cue may show: the setting on, the tip never said, its cue not shown yet (this run; this place or this sheet for
 * the stall cues) and kappi.js able to show it now @param {TipRun} st @param {KappiTip} T @param {string} id
 * @param {TipCtx} c */
export function tipMayCue(st, T, id, c) {
  return (
    !!T.cue &&
    c.on &&
    !c.busy &&
    !(c.battle && st.battles <= 1) &&
    !(c.seen && c.seen[id]) &&
    !st.cued[T.cue] &&
    (!c.cues || !!c.cues[T.cue])
  );
}
/** the time-based triggers: a choice sheet or a place stood in too long. A cue at `cueS`, Kappi's line at `s`
 * @param {TipRun} st @param {KappiTips} D @param {TipCtx} c @returns {TipShow | null} */
export function tipClocks(st, D, c) {
  const clocks = /** @type {[string, boolean, number][]} */ ([
    ['sheetStall', !!st.sheet, st.sheetT],
    ['placeStall', !!st.place && !c.battle && !c.sheet && st.best !== Infinity, st.placeT],
  ]);
  for (const [when, open, t0] of clocks) {
    const hit = open && tipOf(D, when);
    if (!hit) continue;
    const [id, T] = hit,
      s = (c.t - t0) / 1000;
    if (T.cueS != null && s >= T.cueS && tipMayCue(st, T, id, c)) {
      st.cued[/** @type {string} */ (T.cue)] = 1;
      return { kind: 'cue', id, cue: T.cue };
    }
    if (s >= (T.s ?? Infinity) && tipMaySay(st, D, id, c)) return tipSaid(st, D, id);
  }
  return null;
}
/** Kappi says it: counted for the run and the place @param {TipRun} st @param {KappiTips} D @param {string} id
 * @returns {TipShow} */
export function tipSaid(st, D, id) {
  st.said++;
  st.placeSaid++;
  st.due = st.due.filter(d => d.id !== id);
  return { kind: 'say', id, line: D.tips[id].line };
}
/** a cue for a trigger that hasn't fired yet but is close: one miss (the catch button, while the foe is low), one of
 * yours low with a potion in the bag (the items button). kappi.js passes which apply now in c.cues
 * @param {TipRun} st @param {KappiTips} D @param {TipCtx} c @returns {TipShow | null} */
export function tipEarlyCue(st, D, c) {
  for (const when of ['catchFails', 'potionUnused']) {
    const hit = tipOf(D, when);
    if (!hit || !c.battle) continue;
    const [id, T] = hit;
    if (when === 'catchFails' && st.fails < 1) continue;
    if (tipMayCue(st, T, id, c) && c.cues) {
      st.cued[/** @type {string} */ (T.cue)] = 1;
      return { kind: 'cue', id, cue: T.cue };
    }
  }
  return null;
}
/** what to show now, if anything: a waiting tip that may be said (the oldest first; one waiting too long is dropped),
 * else a clock's cue or line, else an early cue. Call it often (kappi.js: about once a second, and after each event);
 * the caller marks a said tip in meta.tipsSeen @param {TipRun} st @param {KappiTips} D @param {TipCtx} c
 * @returns {TipShow | null} */
export function tipNext(st, D, c) {
  const keep = ((D && D.keepS) ?? TIP_DEFAULTS.keepS) * 1000;
  st.due = st.due.filter(d => c.t - d.t <= keep && !(c.seen && c.seen[d.id]) && D.tips[d.id]);
  if (!c.on) return null;
  for (const d of st.due) if (tipMaySay(st, D, d.id, c)) return tipSaid(st, D, d.id);
  return tipClocks(st, D, c) || tipEarlyCue(st, D, c);
}

/* ---------- the first run's hints (run.js RUN_HINTS) ---------- */
/** what becomes of a RUN_HINTS toast (run.js runHint): on the first run Kappi's tips and cues take over, so it is
 * dropped and counts as met (`drop`); from the second run on it is a toast while meta.tipsSeen lacks it (`toast`),
 * else nothing (`skip`) @param {boolean} first @param {Record<string, any>} seen @param {string} id
 * @returns {'drop' | 'toast' | 'skip'} */
export function hintPlan(first, seen, id) {
  if (first) return 'drop';
  return seen && seen['hint:' + id] ? 'skip' : 'toast';
}
/** the tips data's problems (data-checks.js reads it too) @param {any} D @returns {string[]} */
export function tipDataProblems(D) {
  const out = /** @type {string[]} */ ([]);
  if (!D || typeof D !== 'object' || !D.tips) return ['kappiTips.json: no tips'];
  const whens = new Set();
  for (const [id, T] of Object.entries(D.tips)) {
    if (!(T.when in TIP_TRIGGERS)) out.push(`kappiTips.json ${id}: no trigger "${T.when}"`);
    if (whens.has(T.when)) out.push(`kappiTips.json ${id}: a second tip for "${T.when}"`);
    whens.add(T.when);
    if (T.cue && !TIP_CUES.includes(T.cue)) out.push(`kappiTips.json ${id}: no cue "${T.cue}"`);
    if (T.cueS != null && T.s != null && T.cueS >= T.s) out.push(`kappiTips.json ${id}: its cue comes after its line`);
    if ((T.when === 'sheetStall' || T.when === 'placeStall') && T.s == null)
      out.push(`kappiTips.json ${id}: a stall tip needs its seconds (s)`);
    if (!/#l:[0-9a-f]{4}$/.test(T.line || ''))
      out.push(`kappiTips.json ${id}: its line has no line id (npm run story:ids)`);
  }
  return out;
}
