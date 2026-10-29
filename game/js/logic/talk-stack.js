// @ts-check
'use strict';
/* ================= THE TALK STACK (dialogue track DL-4) =================
   A conversation drawn as a stack of bubbles (docs/phases/dialogue-track.md, "A conversation, not a text box"): the
   newest at the bottom, the last two above it, speakers on alternating sides, one speaker's lines in a row linked.
   This decides where each new bubble goes and how many older ones stay; talk.js draws it. Logic only: no DOM, runs in
   Node (tools/test/talk-stack.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  STACK_CAP: [() => STACK_CAP],
  STACK_KEEP: [() => STACK_KEEP],
  // @ts-expect-error -- replaced on purpose
  cutAt: [() => cutAt, v => (cutAt = v)],
  knockOf: [() => knockOf],
  // @ts-expect-error -- replaced on purpose
  stackFit: [() => stackFit, v => (stackFit = v)],
  // @ts-expect-error -- replaced on purpose
  stackStep: [() => stackStep, v => (stackStep = v)],
  waitMs: [() => waitMs],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the most older bubbles kept above the newest */
export const STACK_KEEP = 2;
/** the stack's top may reach this share of the screen's height, measured from the bottom (the oldest drops first) */
export const STACK_CAP = 0.4;

/**
 * @typedef {{ who: string, skin?: string, style?: string, cut?: boolean }} StackLine a line about to be said
 * @typedef {{ n: number, who: string, side: string, cut: boolean, last: { who: string, side: string } | null }} StackState
 *   what is on screen: how many bubbles, the newest's speaker, side and whether it was cut off, and the last speaker
 *   who took a side (narration takes none)
 */

/** where a new line's bubble goes, from what the stack holds now (null: the talk just opened).
 * - narration (the player's field-move notes) sits in the middle, never links and never turns the sides;
 * - the player, when they have lines (the `you` skin), always talks from the right;
 * - anyone else from the side opposite whoever spoke before them, the first speaker from the left;
 * - the same speaker again keeps their side, and the two bubbles are linked (unless the first was cut off).
 * `keep` older bubbles stay, `drop` leave (the oldest first); `state` is the stack after this line.
 * @param {StackState | null} prev @param {StackLine} line
 * @returns {{ side: 'left' | 'right' | 'mid', linked: boolean, keep: number, drop: number, state: StackState }} */
export function stackStep(prev, line) {
  const who = String(line.who || ''),
    n = prev ? Math.max(0, prev.n | 0) : 0,
    last = prev ? prev.last : null;
  /** @type {'left' | 'right' | 'mid'} */
  let side;
  if (line.skin === 'narration') side = 'mid';
  else if (line.skin === 'you') side = 'right';
  else if (!last) side = 'left';
  else if (last.who === who) side = last.side === 'right' ? 'right' : 'left';
  else side = last.side === 'left' ? 'right' : 'left';
  const linked = !!prev && n > 0 && side !== 'mid' && prev.who === who && prev.side === side && !prev.cut,
    keep = Math.min(n, STACK_KEEP),
    drop = n - keep;
  return {
    side,
    linked,
    keep,
    drop,
    state: { n: keep + 1, who, side, cut: !!line.cut, last: side === 'mid' ? last : { who, side } },
  };
}

/** how many older bubbles fit: the newest always shows, then the older ones (newest first) while the stack's top
 * stays within `cap` of the screen's height from its bottom
 * @param {number[]} heights the bubbles' heights in px, the newest first
 * @param {{ vh: number, bottom?: number, gap?: number, cap?: number }} o the screen's height, the space under the
 *   stack (the bottom bar and safe area), the gap between bubbles, the share of the height allowed
 * @returns {number} */
export function stackFit(heights, o) {
  const cap = (o.cap ?? STACK_CAP) * Math.max(0, o.vh || 0),
    gap = o.gap || 0;
  let top = (o.bottom || 0) + (heights[0] || 0),
    k = 0;
  for (let i = 1; i < heights.length && k < STACK_KEEP; i++) {
    top += gap + Math.max(0, heights[i] || 0);
    if (top > cap) break;
    k++;
  }
  return k;
}

/** how long the "…" bubble shows before a line, 400-800 ms, the same each time the line is said
 * @param {number} seed the line's seed (logic/talk-skins.js talkSeed) */
export const waitMs = seed => 400 + ((seed >>> 3) % 401);

/** where a line breaks off: its first cut (a [cut], or a line ending in —), or -1
 * @param {{ events?: { at: number, kind: string }[] }} parsed logic/line-markup.js parseLine's answer */
export function cutAt(parsed) {
  const c = (parsed.events || []).filter(e => e.kind === 'cut').sort((a, b) => a.at - b.at)[0];
  return c ? c.at : -1;
}

/** an interrupted bubble knocked aside by the next one: away from its own side, turned and slid
 * @param {string} side @returns {{ deg: number, px: number }} */
export const knockOf = side => (side === 'right' ? { deg: 8, px: 20 } : { deg: -8, px: -20 });
