// @ts-check
'use strict';
/* ================= STORY PICK (roguelite track RL-S1, the story director) =================
   Picks one of banter.json's lines for who is speaking (a hub character after a run, the scene after a lost run, a
   run's leader, a Bureau agent), the way Hades picks a character's line: of the lines for `who` whose `when` holds,
   not said yet if `once`, and past their `cooldown` (runs ended since last said), a `must` line comes first, then the
   highest priority; a tie is drawn from the runs ended and who, so the same save picks the same line. What was said
   is kept in the story's own records: saveData.story.said (line id -> meta.runs when said) and story.once
   ('banter:<id>'). The script command `pick <who>` plays it (logic/script.js; story-stage.js gives the game's), and
   run.js picks the hub characters' first lines on the way home (story.fresh). Logic only: no DOM, no Date, no
   Math.random (tools/test/story-pick.test.mjs). */
/** @import { BanterLine } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BANTER_HUB: [() => BANTER_HUB],
  BANTER_WHO: [() => BANTER_WHO],
  banterOwner: [() => banterOwner],
  // @ts-expect-error -- replaced on purpose
  pickHash: [() => pickHash, v => (pickHash = v)],
  // @ts-expect-error -- replaced on purpose
  storyPick: [() => storyPick, v => (storyPick = v)],
  // @ts-expect-error -- replaced on purpose
  storyPickSaid: [() => storyPickSaid, v => (storyPickSaid = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** who a line can be for (banter.schema.json's list); the first three are the hub characters picked on the way home */
export const BANTER_WHO = [
    'chosen',
    'kappi',
    'juniper',
    'back_lost',
    'leader',
    'bureau',
    'rival',
    /* RL-S2 part B: a hub person's thank-you for a gift (story.js storyGiftOffer) */
    'thanks_chosen',
    'thanks_kappi',
    'thanks_juniper',
    /* HB-10d: what the town square's folk say after a won or a lost run (logic/square-talk.js: every line that holds) */
    'square_won',
    'square_lost',
    /* HB-10e: what they say on a festival or market day (each line's `when` names its festival) */
    'square_fest',
  ],
  BANTER_HUB = ['chosen', 'kappi', 'juniper'];

/** whose line it is when it names nobody: a hub person's own lines and their thank-yous are theirs, the others name
 * their speakers @param {string} who @returns {string | null} */
export const banterOwner = who => {
  const w = who.startsWith('thanks_') ? who.slice(7) : who;
  return BANTER_HUB.includes(w) ? w : null;
};

/** a small, steady string hash (FNV-1a) for the tie's draw @param {string} s */
export function pickHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * The line to say for `who`, or null when none can be said.
 * @param {string} who
 * @param {Record<string, BanterLine>} banter banter.json
 * @param {(cond: string) => boolean} holds whether a condition holds (conditions.js on the story state)
 * @param {{ once?: Record<string, any>, said?: Record<string, number> }} story saveData.story (its records)
 * @param {number} runs meta.runs (runs ended)
 * @returns {string | null}
 */
export function storyPick(who, banter, holds, story, runs) {
  const once = story.once || {},
    said = story.said || {};
  const can = Object.entries(banter || {})
    .filter(([id, B]) => {
      if (B.who !== who) return false;
      if (B.once && once['banter:' + id]) return false;
      if (B.cooldown && said[id] !== undefined && runs - said[id] < B.cooldown) return false;
      return !B.when || holds(B.when);
    })
    .sort(([a], [b]) => (a < b ? -1 : 1));
  if (!can.length) return null;
  const must = can.filter(([, B]) => B.must),
    from = must.length ? must : can,
    top = Math.max(...from.map(([, B]) => B.priority)),
    ties = from.filter(([, B]) => B.priority === top);
  return ties[pickHash(`${runs}|${who}`) % ties.length][0];
}
/** a line has been said: its cooldown starts, a `once` line is done @param {string} id
 * @param {Record<string, BanterLine>} banter @param {Record<string, any>} story saveData.story @param {number} runs */
export function storyPickSaid(id, banter, story, runs) {
  const B = banter && banter[id];
  if (!B) return;
  (story.said || (story.said = {}))[id] = runs;
  if (B.once) (story.once || (story.once = {}))['banter:' + id] = 1;
}
