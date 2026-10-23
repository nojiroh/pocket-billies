// @ts-check
'use strict';
/* ================= THE RANCH'S PASSIVE INCOME (roguelite track RL-10b) =================
   The ranch earns Scrap by itself on real time: rules.json ranch.income.rate Scrap an hour by ranch level, banking at
   most ranch.income.capHours between collections (the pile is full then, and stops growing). The save keeps
   saveData.ranch.income: `lastAt`, the time counted to (0 until the ranch first opens: a new save doesn't start with
   a full pile), and `bank`, whole Scrap earned at an old rate (an upgrade banks what the old level earned first).
   Collect pays the pile into meta.scrap and moves lastAt on by the time it paid for only, so the part of a Scrap
   already earned carries over; a full pile counts again from now. lastAt never moves back.
   The time is the ranch clock's (logic/ranch-clock.js: a clock turned back stands still, so nothing pays twice);
   offline it is the same sum on the phone's clock. Logic only: no DOM, runs in Node
   (tools/test/ranch-income.test.mjs). */
/** @import { SaveData } from '../../types/save-data' */
/** @import { RanchRules } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  INCOME_HOUR: [() => INCOME_HOUR],
  // @ts-expect-error -- replaced on purpose
  incomeBank: [() => incomeBank, v => (incomeBank = v)],
  // @ts-expect-error -- replaced on purpose
  incomeCollect: [() => incomeCollect, v => (incomeCollect = v)],
  // @ts-expect-error -- replaced on purpose
  incomePile: [() => incomePile, v => (incomePile = v)],
  // @ts-expect-error -- replaced on purpose
  incomeRate: [() => incomeRate, v => (incomeRate = v)],
  // @ts-expect-error -- replaced on purpose
  incomeStart: [() => incomeStart, v => (incomeStart = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const INCOME_HOUR = 3600000;
/** Scrap an hour at this ranch's level (past the list's end, its last) */
/** @param {SaveData} s @param {RanchRules} R */
export function incomeRate(s, R) {
  const L = R.income.rate,
    lvl = Math.max(1, (s.meta && s.meta.buildings && s.meta.buildings.ranch) || 1);
  return L[Math.min(lvl, L.length) - 1];
}
/** the pile now: whole Scrap waiting (the bank and what the time since lastAt earned), whether it is full, the ms
    until it is, and whether income has started at all */
/** @param {SaveData} s @param {number} now @param {RanchRules} R */
export function incomePile(s, now, R) {
  const I = s.ranch.income,
    cap = R.income.capHours * INCOME_HOUR,
    rate = incomeRate(s, R);
  if (!I.lastAt) return { scrap: I.bank, earned: 0, full: false, left: cap, started: false, rate };
  const ms = Math.min(Math.max(0, now - I.lastAt), cap),
    earned = Math.floor((ms / INCOME_HOUR) * rate);
  return { scrap: I.bank + earned, earned, full: ms >= cap, left: cap - ms, started: true, rate };
}
/** start counting the first time the ranch opens (a new save's lastAt is 0); later calls change nothing */
/** @param {SaveData} s @param {number} now */
export function incomeStart(s, now) {
  if (!s.ranch.income.lastAt) s.ranch.income.lastAt = Math.max(1, Math.floor(now));
}
/** move what the time since lastAt earned into the bank (whole Scrap), lastAt on by the time that paid for; the
    Scrap banked. Before an upgrade changes the rate, so the old level's time is paid at the old rate */
/** @param {SaveData} s @param {number} now @param {RanchRules} R */
export function incomeBank(s, now, R) {
  const I = s.ranch.income,
    P = incomePile(s, now, R);
  if (!P.started) return 0;
  I.bank += P.earned;
  if (P.full) I.lastAt = Math.max(I.lastAt, Math.floor(now));
  else if (P.earned > 0) I.lastAt += Math.floor((P.earned / P.rate) * INCOME_HOUR);
  return P.earned;
}
/** Collect: the pile into meta.scrap; the Scrap paid (0 before income has started, which starts it) */
/** @param {SaveData} s @param {number} now @param {RanchRules} R */
export function incomeCollect(s, now, R) {
  if (s.run) return 0;
  if (!s.ranch.income.lastAt) {
    incomeStart(s, now);
    return 0;
  }
  incomeBank(s, now, R);
  const paid = s.ranch.income.bank;
  s.meta.scrap += paid;
  s.ranch.income.bank = 0;
  return paid;
}
