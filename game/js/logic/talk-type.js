// @ts-check
'use strict';
/* ================= TALK TYPING (dialogue track DL-2) =================
   When each letter of a spoken line shows (docs/phases/dialogue-track.md, "Text that acts"): the Text speed setting,
   `[slow]` and `[fast]` runs, `[p]` pauses, and the beats the reader's eye wants after punctuation (a short one after
   `, ; :`, a longer one after `. ! ?` and an ellipsis, typed slowly). talk.js reveals the letters on these times; a tap
   jumps to the end. Logic only: no DOM, runs in Node (tools/test/talk-type.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BEAT_LONG: [() => BEAT_LONG],
  BEAT_SHORT: [() => BEAT_SHORT],
  CLOSERS: [() => CLOSERS],
  ELLIPSIS_SLOW: [() => ELLIPSIS_SLOW],
  TEXT_SPEEDS: [() => TEXT_SPEEDS],
  // @ts-expect-error -- replaced on purpose
  letterTimes: [() => letterTimes, v => (letterTimes = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the Text speed setting (Settings, game tab): ms a letter; Instant shows the line at once */
export const TEXT_SPEEDS = { slow: 42, normal: 28, fast: 14, instant: 0 };
/** the beats, in letters' time: after `, ; :` and after `. ! ? …` */
export const BEAT_SHORT = 4,
  BEAT_LONG = 8;
/** an ellipsis is typed this many times slower */
export const ELLIPSIS_SLOW = 3;

/** letters that may close a sentence before the space: quotes and brackets */
export const CLOSERS = '"\'”’)]»';

/**
 * The time each letter of a parsed line shows, from the line's start, in ms. `at` indexes the line's letters as
 * parseLine counts them (code points, `[...plain]`).
 * @param {{ plain: string, runs?: { from: number, to: number, fx: Record<string, string | true> }[],
 *   events?: { at: number, kind: string, v?: string | number }[] }} parsed
 * @param {string} [speed] a TEXT_SPEEDS key (unknown: normal)
 * @returns {{ at: number[], end: number }}
 */
export function letterTimes(parsed, speed) {
  const ch = [...String(parsed.plain || '')],
    n = ch.length,
    base = TEXT_SPEEDS[/** @type {keyof typeof TEXT_SPEEDS} */ (speed)] ?? TEXT_SPEEDS.normal,
    at = new Array(n).fill(0);
  if (!base) return { at, end: 0 };
  /** each letter's own time: [slow] ×2, [fast] ×0.5 */
  const own = new Array(n).fill(base);
  for (const r of parsed.runs || [])
    for (let i = r.from; i < Math.min(r.to, n); i++)
      if (r.fx.slow) own[i] = base * 2;
      else if (r.fx.fast) own[i] = base / 2;
  /** the pauses before each letter, ms */
  const wait = new Array(n + 1).fill(0);
  for (const e of parsed.events || []) if (e.kind === 'p') wait[Math.min(e.at, n)] += Number(e.v) * 1000;
  /** the ellipses' dots */
  const dots = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (ch[i] === '…') dots[i] = true;
    if (ch[i] !== '.') continue;
    let j = i;
    while (ch[j] === '.') j++;
    if (j - i >= 3) dots.fill(true, i, j);
    i = j - 1;
  }
  /** the letter after i, past closing quotes and brackets */
  const next = (/** @type {number} */ i) => {
    let j = i + 1;
    while (j < n && CLOSERS.includes(ch[j])) j++;
    return j < n ? ch[j] : '';
  };
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += wait[i];
    at[i] = t;
    t += dots[i] ? own[i] * ELLIPSIS_SLOW : own[i];
    if (i === n - 1) break;
    const after = next(i);
    // a beat only where a space follows: not inside "3.5", "?!" or "..." (the last mark gets it), not at the end
    if (!/\s/.test(after)) continue;
    if (/[.!?…]/.test(ch[i])) t += BEAT_LONG * own[i];
    else if (/[,;:]/.test(ch[i])) t += BEAT_SHORT * own[i];
  }
  return { at, end: n ? t : 0 };
}
