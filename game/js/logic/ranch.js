// @ts-check
'use strict';
/* ================= THE RANCH (roguelite track RL-9) =================
   Copperleaf's ranch trains Billies between runs. A Billie in storage starts training for some Scrap; from then on it
   gains levels with real time (rules.json ranch.levelsPerHour, each level its own share of XP), banking at most
   ranch.bankHours between visits, never past the ranch's level cap. What it banked is collected when you open the
   ranch, stop its training or bring it onto the team. The ranch's level is saveData.meta.buildings.ranch (1 until
   RL-11's upgrades); its slots and cap come from rules.json ranch.
   The clock is passed in (no Date here; the page passes the ranch clock's time, logic/ranch-clock.js): a clock turned
   back further than ranch.guardMs behind a trainee's start pays nothing, and a trainee's start never moves back
   (RL-10b: RL-9 moved it back to the turned-back clock, so turning it forward again paid the gap), so moving the
   phone's clock back and forth can't bank more than the real time.
   Logic only: no DOM, runs in Node (tools/test/ranch.test.mjs). */
/** @import { Billy, SaveData } from '../../types/save-data' */
/** @import { RanchRules } from '../../types/game-data' */
/** @typedef {(text: string, opt?: any) => void} Say */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { gainXp, maxLevel, xpFor } from './rules.js';
/* eslint-disable no-func-assign */
expose({
  RANCH_HOUR: [() => RANCH_HOUR],
  // @ts-expect-error -- replaced on purpose
  ranchBanked: [() => ranchBanked, v => (ranchBanked = v)],
  // @ts-expect-error -- replaced on purpose
  ranchCanTrain: [() => ranchCanTrain, v => (ranchCanTrain = v)],
  ranchCap: [() => ranchCap],
  // @ts-expect-error -- replaced on purpose
  ranchCollect: [() => ranchCollect, v => (ranchCollect = v)],
  // @ts-expect-error -- replaced on purpose
  ranchElapsed: [() => ranchElapsed, v => (ranchElapsed = v)],
  ranchLevel: [() => ranchLevel],
  ranchSlots: [() => ranchSlots],
  // @ts-expect-error -- replaced on purpose
  ranchStop: [() => ranchStop, v => ((ranchStop = v), provide({ ranchStop }))],
  // @ts-expect-error -- replaced on purpose
  ranchTake: [() => ranchTake, v => (ranchTake = v)],
  // @ts-expect-error -- replaced on purpose
  ranchTidy: [() => ranchTidy, v => (ranchTidy = v)],
  // @ts-expect-error -- replaced on purpose
  ranchTrainStart: [() => ranchTrainStart, v => (ranchTrainStart = v)],
  // @ts-expect-error -- replaced on purpose
  ranchXp: [() => ranchXp, v => (ranchXp = v)],
  stored: [() => stored],
});
/* eslint-enable no-func-assign */
provide({ ranchStop });
/* to-module: end */
export const RANCH_HOUR = 3600000;
/** the ranch's level: meta.buildings.ranch, 1 until it is upgraded (RL-11) */
/** @param {SaveData} s */
export const ranchLevel = s => Math.max(1, (s.meta && s.meta.buildings && s.meta.buildings.ranch) || 1);
/** how many Billies train at once at this ranch level (past the list's end, its last) */
/** @param {SaveData} s @param {RanchRules} R */
export const ranchSlots = (s, R) => R.slots[Math.min(ranchLevel(s), R.slots.length) - 1];
/** the highest level a Billie trains to at this ranch level (never past the game's own cap) */
/** @param {SaveData} s @param {RanchRules} R */
export const ranchCap = (s, R) => Math.min(maxLevel(), R.capBase + R.capStep * (ranchLevel(s) - 1));
/** a trainee's Billie, if it is still in storage */
/** @param {SaveData} s @param {string} uid */
export const stored = (s, uid) => s.box.find(m => m.uid === uid);
/** the trainee's time to count: 0 after a rollback, else the time since it started, at most the bank's hours */
/** @param {{ uid: string, at: number }} t @param {number} now @param {RanchRules} R */
export function ranchElapsed(t, now, R) {
  if (now < t.at - R.guardMs) return 0;
  return Math.min(Math.max(0, now - t.at), R.bankHours * RANCH_HOUR);
}
/** the XP `ms` of training gives this Billie: levelsPerHour levels an hour, each level counted at its own size, up to
    the cap's XP and no further */
/** @param {Billy} m @param {number} ms @param {number} cap @param {RanchRules} R @returns {number} */
export function ranchXp(m, ms, cap, R) {
  let left = (ms / RANCH_HOUR) * R.levelsPerHour,
    L = m.lvl,
    xp = Math.max(m.xp, xpFor(L));
  while (left > 0 && L < cap) {
    const span = xpFor(L + 1) - xpFor(L),
      need = (xpFor(L + 1) - xp) / span;
    if (left >= need) {
      xp = xpFor(L + 1);
      L++;
      left -= need;
    } else {
      xp += left * span;
      left = 0;
    }
  }
  return Math.max(0, Math.floor(Math.min(xp, xpFor(Math.max(cap, m.lvl))) - m.xp));
}
/** what a trainee has banked now, for the ranch screen: the XP, the hours counted, whether the bank is full and
    whether its Billie is at the cap */
/** @param {SaveData} s @param {{ uid: string, at: number }} t @param {number} now @param {RanchRules} R */
export function ranchBanked(s, t, now, R) {
  const m = stored(s, t.uid) || s.team.find(b => b.uid === t.uid),
    ms = ranchElapsed(t, now, R),
    cap = ranchCap(s, R);
  return {
    xp: m ? ranchXp(m, ms, cap, R) : 0,
    hours: ms / RANCH_HOUR,
    full: ms >= R.bankHours * RANCH_HOUR,
    atCap: !!m && m.lvl >= cap,
  };
}
/** may this Billie start training: why not, or '' when it may */
/** @param {SaveData} s @param {string} uid @param {RanchRules} R @returns {'' | 'run' | 'stored' | 'training' | 'full' | 'cap' | 'scrap'} */
export function ranchCanTrain(s, uid, R) {
  if (s.run) return 'run';
  const m = stored(s, uid);
  if (!m) return 'stored';
  if (s.ranch.trainees.some(t => t.uid === uid)) return 'training';
  if (s.ranch.trainees.length >= ranchSlots(s, R)) return 'full';
  if (m.lvl >= ranchCap(s, R)) return 'cap';
  if (s.meta.scrap < R.trainCost) return 'scrap';
  return '';
}
/** start training a Billie in storage: pays the Scrap; why not, or '' when it started */
/** @param {SaveData} s @param {string} uid @param {number} now @param {RanchRules} R */
export function ranchTrainStart(s, uid, now, R) {
  const why = ranchCanTrain(s, uid, R);
  if (why) return why;
  s.meta.scrap -= R.trainCost;
  s.ranch.trainees.push({ uid, at: Math.max(0, Math.floor(now)) });
  return '';
}
/** collect one trainee's bank into its Billie (gainXp: levels, HP and moves as in battle) and count again from now,
    or from its start when the clock is behind it (a start never moves back); the levels it went up */
/** @param {SaveData} s @param {{ uid: string, at: number }} t @param {number} now @param {RanchRules} R @param {Say} say */
export function ranchTake(s, t, now, R, say) {
  const m = stored(s, t.uid) || s.team.find(b => b.uid === t.uid),
    xp = m ? ranchXp(m, ranchElapsed(t, now, R), ranchCap(s, R), R) : 0,
    from = m ? m.lvl : 0;
  if (m && xp > 0) gainXp(m, xp, say);
  t.at = Math.max(t.at, Math.floor(now));
  return { uid: t.uid, xp, up: m ? m.lvl - from : 0 };
}
/** collect every trainee's bank (the ranch screen opening); what each gained */
/** @param {SaveData} s @param {number} now @param {RanchRules} R @param {Say} say */
export function ranchCollect(s, now, R, say) {
  if (s.run) return [];
  ranchTidy(s);
  return s.ranch.trainees.map(t => ranchTake(s, t, now, R, say));
}
/** stop a Billie's training, collecting its bank first (the ranch's Stop, or the Billie brought onto the team);
    what it gained, or null when it wasn't training */
/** @param {SaveData} s @param {string} uid @param {number} now @param {RanchRules} R @param {Say} say */
export function ranchStop(s, uid, now, R, say) {
  const i = s.ranch.trainees.findIndex(t => t.uid === uid);
  if (i < 0) return null;
  const got = ranchTake(s, s.ranch.trainees[i], now, R, say);
  s.ranch.trainees.splice(i, 1);
  return got;
}
/** drop trainees whose Billie is gone from storage (released, combined, or moved without the ranch) or listed twice */
/** @param {SaveData} s */
export function ranchTidy(s) {
  const seen = new Set();
  s.ranch.trainees = s.ranch.trainees.filter(t => {
    if (seen.has(t.uid) || !stored(s, t.uid)) return false;
    seen.add(t.uid);
    return true;
  });
}
