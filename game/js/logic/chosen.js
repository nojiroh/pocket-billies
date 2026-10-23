// @ts-check
'use strict';
/* ================= CHOSEN (phase 06-2b) =================
   What the professor (Professor Chosen, since 2026-10-23) says around the opening that isn't a line of its script (game/data/cutscenes/opening.json
   holds those): the staged fight's log, the pick card's note, her hot takes, her tips in Blake's battle and her
   comments on tapping too fast, in one table, and the small rules around them: which hot take comes next when you tap
   her during the pick, her (wrong on purpose) type tips, and when she comments on tapping too fast.
   A line may start with [expression] (talk.js). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CHOSEN: [() => CHOSEN],
  FAST_PICKS: [() => FAST_PICKS],
  FAST_PICK_MS: [() => FAST_PICK_MS],
  FAST_SKIPS: [() => FAST_SKIPS],
  FAST_SKIP_MS: [() => FAST_SKIP_MS],
  TIP_MAX: [() => TIP_MAX],
  // @ts-expect-error -- replaced on purpose
  fillLine: [() => fillLine, v => (fillLine = v)],
  // @ts-expect-error -- replaced on purpose
  hazelTip: [() => hazelTip, v => (hazelTip = v)],
  // @ts-expect-error -- replaced on purpose
  hotTake: [() => hotTake, v => (hotTake = v)],
  // @ts-expect-error -- replaced on purpose
  speedWatch: [() => speedWatch, v => (speedWatch = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const CHOSEN = {
  /** the Chosen's own fight: the log lines under the plates ({foe} is Blake's Billie) */
  fight: {
    start: 'Professor Chosen wants to battle! He sent out… himself.',
    blakeGo: 'Go, {foe}! Tackle!',
    tackle: '{foe} used Tackle! It bounced off his lab coat.',
    moves: ['Plot Armor', 'Main Character Energy', 'Prophecy', 'Katana (Decorative)'],
    hit: 'Professor Chosen used Plot Armor!',
    effective: 'It’s super effective. He says it always is.',
    faint: '{foe} fainted! It’s fine. It’s having a little lie-down.',
  },
  /** the note on the pick card */
  pickNote: 'Tap Professor Chosen for his (chosen) opinion.',
  /** his hot takes per starter line, then annoyed ones for any line */
  hotTakes: /** @type {Record<string, string[]>} */ ({
    musk: [
      'It’s going to Mars. I’ve been to Mars. In a dream. It counts.',
      'Strong, loud, thinks it’s the main character. I respect that. I don’t trust it.',
      'Don’t ask it about the launch date. I did. We don’t talk now.',
    ],
    bezos: [
      'It’ll deliver your groceries in two days. Destiny takes longer.',
      'Cute. Don’t sign anything it hands you.',
      'That box has more storage than my lab. Hazel says that’s not hard.',
    ],
    gates: [
      'Very sensible. It’ll ask you to restart it twice a day.',
      'It jumped over a chair once. You’ll hear about it. I jumped two.',
      'It ate Hazel’s thesis. Twice. I told her it was the Billie. It was the Billie.',
    ],
  }),
  annoyed: [
    'I’m a professor, not a vending machine. I’m a legend.',
    'Tap me again and I unsheathe. The katana’s at the cleaners. But I could.',
    'Pick one. The prophecy has a deadline.',
  ],
  /** Blake's battle: no tutorial; the meta line first, then his tips (at most TIP_MAX) */
  meta: 'You’ve played one of these before. Everyone has. Tap the move that sounds the most legendary.',
  /** a flipped type tip from the real matchup: {weak} is the type that loses, {strong} the one that wins */
  flippedTip: '{weak} beats {strong}. It was foretold. In a forum post.',
  badTips: [
    'Fire is weak to Fire. Fight fire with fire. That’s from a prophecy. Or a poster.',
    'Always use the move with the longest name. Longer name, more power. That’s just lore.',
    'Type advantage is a myth. Real heroes win by believing harder.',
  ],
  tooFastPicks: [
    'Instant picks. Reckless. I respect it. Hazel doesn’t.',
    'Did you even read the moves? Hazel wrote those. I approved them.',
  ],
  tooFastSkips: [
    'You skipped that. I could tell. Chosen ones can always tell.',
    'That was my monologue. It had a wolf in it.',
  ],
};

/** how many HOT TIPs Blake's battle gets, at most */
export const TIP_MAX = 4;
/** a move picked within this long of the menu showing is "instant"; this many in a row gets a comment */
export const FAST_PICK_MS = 1000;
export const FAST_PICKS = 2;
/** a line skipped within this long of starting is "skipped fast"; this many in a row gets a comment */
export const FAST_SKIP_MS = 700;
export const FAST_SKIPS = 3;

/** {name} placeholders filled from vars @param {string} text @param {Record<string, string>} vars */
export function fillLine(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** the hot take for the n-th tap (0-based) on one starter line: its own takes in order, then the annoyed ones, which
 * stay on the last one @param {string} line @param {number} n */
export function hotTake(line, n) {
  const own = CHOSEN.hotTakes[line] || [],
    all = own.concat(CHOSEN.annoyed);
  return all[Math.min(n, all.length - 1)] || '';
}

/** the i-th tip in Blake's battle (0-based): the meta line, then a type tip flipped from the real matchup when there is
 * one, then the canned bad tips; null when she is out of tips.
 * @param {number} i @param {{ weak: string, strong: string } | null} matchup the real one: strong beats weak */
export function hazelTip(i, matchup) {
  if (i >= TIP_MAX) return null;
  const L = [CHOSEN.meta];
  if (matchup) L.push(fillLine(CHOSEN.flippedTip, { weak: matchup.weak, strong: matchup.strong }));
  L.push(...CHOSEN.badTips);
  return L[i] ?? null;
}

/** a tracker for "too fast": record(ms) takes how long the player waited; it returns a comment when the last `need`
 * were all faster than `limit`, then starts counting again. Each comment is said once; after that, none.
 * @param {number} limit @param {number} need @param {string[]} comments */
export function speedWatch(limit, need, comments) {
  let run = 0,
    said = 0;
  return {
    /** @param {number} ms @returns {string | null} */
    record(ms) {
      run = ms < limit ? run + 1 : 0;
      if (run < need || said >= comments.length) return null;
      run = 0;
      return comments[said++];
    },
  };
}
