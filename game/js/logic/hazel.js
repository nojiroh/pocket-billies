// @ts-check
'use strict';
/* ================= HAZEL (phase 06-2b) =================
   What Professor Hazel says around the opening that isn't a line of its script (game/data/cutscenes/opening.json
   holds those): the staged fight's log, the pick card's note, her hot takes, her tips in Blake's battle and her
   comments on tapping too fast, in one table, and the small rules around them: which hot take comes next when you tap
   her during the pick, her (wrong on purpose) type tips, and when she comments on tapping too fast.
   A line may start with [expression] (talk.js). Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FAST_PICKS: [() => FAST_PICKS],
  FAST_PICK_MS: [() => FAST_PICK_MS],
  FAST_SKIPS: [() => FAST_SKIPS],
  FAST_SKIP_MS: [() => FAST_SKIP_MS],
  HAZEL: [() => HAZEL],
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

export const HAZEL = {
  /** Hazel's own fight: the log lines under the plates ({foe} is Blake's Billie) */
  fight: {
    start: 'Professor Hazel wants to battle! She sent out… herself.',
    blakeGo: 'Go, {foe}! Tackle!',
    tackle: '{foe} used Tackle! It bounced off her lab coat.',
    moves: ['Peer Review', 'Grant Rejection', 'Office Hours', 'Footnote'],
    hit: 'Professor Hazel used Peer Review!',
    effective: 'It’s super effective. Everything is, when she does it.',
    faint: '{foe} fainted! It’s fine. It’s having a little lie-down.',
  },
  /** the note on the pick card */
  pickNote: 'Tap Professor Hazel for her (biased) opinion.',
  /** her hot takes per starter line, then annoyed ones for any line */
  hotTakes: /** @type {Record<string, string[]>} */ ({
    musk: [
      'It’s going to Mars. It has been going to Mars for six years.',
      'Lovely calf. Don’t ask it about the launch date. Don’t.',
      'Strong, loud, and it will tell everyone it invented fire.',
    ],
    bezos: [
      'It’ll deliver your groceries in two days. Your feelings, never.',
      'Cute. Don’t sign anything it brings you.',
      'That box has more storage than my lab.',
    ],
    gates: [
      'Very sensible. It will ask you to restart it twice a day.',
      'It jumped a chair once. You’ll hear about it.',
      'It’s eaten my thesis. Twice. It was on a floppy disk.',
    ],
  }),
  annoyed: [
    'I’m a professor, not a vending machine.',
    'Tap me again and it goes on your permanent record.',
    'Pick one. I have a grant deadline.',
  ],
  /** Blake's battle: no tutorial; the meta line first, then her tips (at most TIP_MAX) */
  meta: 'You’ve played one of these before. Everyone has. Tap the move that sounds the most painful.',
  /** a flipped type tip from the real matchup: {weak} is the type that loses, {strong} the one that wins */
  flippedTip: '{weak} beats {strong}. Trust me, I’m a doctor.',
  badTips: [
    'Fire is weak to Fire. Fight fire with fire, as they say. They’re wrong, but they say it.',
    'Always use the move with the longest name. It costs more, so it’s better.',
    'Type advantage is a myth spread by Big Element.',
  ],
  tooFastPicks: ['Instant picks. Bold. Reckless. Very Sterling of you.', 'Did you even read the moves? I wrote those.'],
  tooFastSkips: ['You skipped that. I could tell. I can always tell.', 'I spent a whole sabbatical on that sentence.'],
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
  const own = HAZEL.hotTakes[line] || [],
    all = own.concat(HAZEL.annoyed);
  return all[Math.min(n, all.length - 1)] || '';
}

/** the i-th tip in Blake's battle (0-based): the meta line, then a type tip flipped from the real matchup when there is
 * one, then the canned bad tips; null when she is out of tips.
 * @param {number} i @param {{ weak: string, strong: string } | null} matchup the real one: strong beats weak */
export function hazelTip(i, matchup) {
  if (i >= TIP_MAX) return null;
  const L = [HAZEL.meta];
  if (matchup) L.push(fillLine(HAZEL.flippedTip, { weak: matchup.weak, strong: matchup.strong }));
  L.push(...HAZEL.badTips);
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
