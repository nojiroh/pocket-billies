// @ts-check
'use strict';
/* ================= A RUN'S LOADING (hub track HB-2) =================
   What the run's loading screen waits on: a list of stages (the run's scenes, the landing map, its models, the run's
   world map, the walk view), each with a weight in the bar, a share done and the time it was ready. The screen lifts
   when every stage is ready, or at the cap (rules.json run.load.capMs), which marks the stages still waiting late.
   The summary is what the debug log keeps: stage names and milliseconds only, never a seed, a name or the save.
   Logic only: no DOM (tools/test/run-load.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  runLoadDone: [() => runLoadDone],
  // @ts-expect-error -- replaced on purpose
  runLoadNew: [() => runLoadNew, v => (runLoadNew = v)],
  // @ts-expect-error -- replaced on purpose
  runLoadPart: [() => runLoadPart, v => (runLoadPart = v)],
  // @ts-expect-error -- replaced on purpose
  runLoadShare: [() => runLoadShare, v => (runLoadShare = v)],
  // @ts-expect-error -- replaced on purpose
  runLoadSummary: [() => runLoadSummary, v => (runLoadSummary = v)],
  // @ts-expect-error -- replaced on purpose
  runLoadTick: [() => runLoadTick, v => (runLoadTick = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** HB-8: a `hard` stage is one nothing can show without (the run's places, made behind the screen at a take-off): the cap
 * never marks it late, and the cap's clock starts once every hard stage is ready */
/** @typedef {{ id: string, label: string, w?: number, hard?: boolean }} RunLoadStageDef */
/** @typedef {{ id: string, label: string, w: number, f: number, ms: number, late: boolean, hard: boolean }} RunLoadStage */
/** @typedef {{ why: string, t0: number, stages: RunLoadStage[], end: '' | 'ready' | 'capped', ms: number }} RunLoad */

/** a new loading, started at `now` @param {string} why what it loads for ('take-off', 'resume')
 * @param {RunLoadStageDef[]} defs @param {number} now @returns {RunLoad} */
export function runLoadNew(why, defs, now) {
  return {
    why,
    t0: now,
    stages: defs.map(d => ({
      id: d.id,
      label: d.label,
      w: d.w && d.w > 0 ? d.w : 1,
      f: 0,
      ms: -1,
      late: false,
      hard: !!d.hard,
    })),
    end: '',
    ms: -1,
  };
}

/** a stage's share done (0-1; 1 is ready, and keeps the time it was first ready); an unknown stage or a loading
 * that has ended changes nothing @param {RunLoad} L @param {string} id @param {number} f @param {number} now */
export function runLoadPart(L, id, f, now) {
  const S = L.stages.find(s => s.id === id);
  if (!S || L.end) return;
  S.f = Math.max(S.f, Math.min(1, Math.max(0, f || 0)));
  if (S.f >= 1 && S.ms < 0) S.ms = Math.round(now - L.t0);
}

/** the bar's share: each stage's share done by its weight @param {RunLoad} L */
export function runLoadShare(L) {
  let w = 0,
    d = 0;
  for (const s of L.stages) {
    w += s.w;
    d += s.w * s.f;
  }
  return w > 0 ? d / w : 1;
}

/** every stage ready @param {RunLoad} L */
export const runLoadDone = L => L.stages.every(s => s.f >= 1);

/** look at the loading: 'ready' when every stage is, 'capped' once capMs have gone by since the hard stages were ready
 * (from the start when there are none; the stages still waiting marked late), else '' (still waiting). The first
 * answer that isn't '' ends it and stays
 * @param {RunLoad} L @param {number} now @param {number} capMs @returns {'' | 'ready' | 'capped'} */
export function runLoadTick(L, now, capMs) {
  if (L.end) return L.end;
  const hard = L.stages.filter(s => s.hard),
    from = hard.length ? (hard.every(s => s.f >= 1) ? L.t0 + Math.max(...hard.map(s => s.ms)) : Infinity) : L.t0;
  if (runLoadDone(L)) L.end = 'ready';
  else if (capMs > 0 && now - from >= capMs) {
    L.end = 'capped';
    for (const s of L.stages) if (s.f < 1) s.late = true;
  } else return '';
  L.ms = Math.round(now - L.t0);
  return L.end;
}

/** the debug log's line: what it loaded for, the time in all, each stage's time (ms from the start; late ones with
 * their share done) and whether the cap lifted it, e.g. "take-off 2140 ms: map 900, models 1210, bowl late 40%; capped"
 * @param {RunLoad} L @param {Record<string, number | string>} [more] extra numbers (the scenes made, their ms) */
export function runLoadSummary(L, more) {
  const st = L.stages.map(s => (s.late ? `${s.id} late ${Math.round(s.f * 100)}%` : `${s.id} ${s.ms}`)).join(', '),
    ex = more
      ? Object.entries(more)
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
      : '';
  return `${L.why} ${L.ms} ms: ${st}${ex ? `; ${ex}` : ''}${L.end === 'capped' ? '; capped' : ''}`;
}
