// @ts-check
'use strict';
/* ================= BREEDING (roguelite track RL-10) =================
   Copperleaf's ranch breeds two Billies from home (the team or storage) into an egg that hatches on real time
   (rules.json ranch.breed.hours) in the ranch's nursery, as many at once as its nests (by ranch level).
   - Safe: two of one line, for Scrap (safeCost). The Billie is the line's first stage at breed.lvl; each part's size
     comes from one parent or the other; its coat is rolled as an egg's (coats.json odds.egg).
   - Risky: any two, for less Scrap (riskyCost), and odds.safe / quirk / abom decide what hatches: as a safe egg (the
     line one parent's or the other's), a quirk (a parent's move and a coat or size swing) or an abomination (every
     part S or L, a name made from both parents', one stat raised by abomUp and another lowered by abomDown: m.mut).
   The egg is rolled when breeding starts, from the parents' uids and the ranch's count of pairs (ranch.bred), so the
   ranch shows it before you pay, asking again shows the same egg, and releasing a parent later changes nothing. The
   parents stay free. The clock is passed in (no Date here). An egg's ready time never moves: a clock turned back only
   makes it wait longer, and turning it forward again gains nothing it wouldn't have had (moving the start back
   would: turned back, then forward, an egg would hatch early).
   Logic only: no DOM, runs in Node (tools/test/breeding.test.mjs, tools/test/sim/breeding-sim.mjs). */
/** @import { Billy, PartSize, SaveData } from '../../types/save-data' */
/** @import { BreedRules, RanchRules } from '../../types/game-data' */
/** @typedef {'safe' | 'quirk' | 'abom'} BreedOut */
/** @typedef {{ a: string, b: string, mode: 'safe' | 'risky', at: number, ready: number, egg: Billy }} NurseryEgg */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
import { COATS, MOVES, STAT_IDS } from '../game-data.js';
import { hashString, rngFrom } from './rng.js';
import { isRobot, speciesOf } from './fighters.js';
import { cleanBuild, makeBilly, maxHp, moveSlotCount, movesAt, partSlots, teamSize } from './rules.js';
import { coatRoll } from './coats.js';
import { ranchLevel } from './ranch.js';
/* eslint-disable no-func-assign */
expose({
  BREED_HOUR: [() => BREED_HOUR],
  // @ts-expect-error -- replaced on purpose
  breedCan: [() => breedCan, v => (breedCan = v)],
  breedCost: [() => breedCost],
  // @ts-expect-error -- replaced on purpose
  breedHatch: [() => breedHatch, v => (breedHatch = v)],
  breedLine: [() => breedLine],
  // @ts-expect-error -- replaced on purpose
  breedName: [() => breedName, v => ((breedName = v), provide({ breedName }))],
  breedNests: [() => breedNests],
  // @ts-expect-error -- replaced on purpose
  breedParent: [() => breedParent, v => (breedParent = v)],
  breedReady: [() => breedReady],
  // @ts-expect-error -- replaced on purpose
  breedRoll: [() => breedRoll, v => (breedRoll = v)],
  breedSeed: [() => breedSeed],
  // @ts-expect-error -- replaced on purpose
  breedStart: [() => breedStart, v => (breedStart = v)],
});
/* eslint-enable no-func-assign */
provide({ breedName });
/* to-module: end */
export const BREED_HOUR = 3600000;
/** how many eggs the nursery holds at this ranch level (past the list's end, its last) */
/** @param {SaveData} s @param {BreedRules} BR */
export const breedNests = (s, BR) => BR.nests[Math.min(ranchLevel(s), BR.nests.length) - 1];
/** a Billie at home (the team or storage) that can be a parent: not a robot */
/** @param {SaveData} s @param {string} uid */
export function breedParent(s, uid) {
  const m = s.team.find(x => x.uid === uid) || s.box.find(x => x.uid === uid);
  return m && !isRobot(m) && speciesOf(m) ? m : undefined;
}
/** the line a Billie belongs to */
/** @param {Billy} m */
export const breedLine = m => speciesOf(m).line;
/** what a pair costs in this mode */
/** @param {'safe' | 'risky'} mode @param {BreedRules} BR */
export const breedCost = (mode, BR) => (mode === 'safe' ? BR.safeCost : BR.riskyCost);
/** may these two breed in this mode: why not, or '' when they may */
/** @param {SaveData} s @param {string} a @param {string} b @param {'safe' | 'risky'} mode @param {BreedRules} BR
    @returns {'' | 'run' | 'parent' | 'same' | 'line' | 'full' | 'scrap'} */
export function breedCan(s, a, b, mode, BR) {
  if (s.run) return 'run';
  const A = breedParent(s, a),
    B = breedParent(s, b);
  if (!A || !B) return 'parent';
  if (a === b) return 'same';
  if (mode === 'safe' && breedLine(A) !== breedLine(B)) return 'line';
  if (s.ranch.nursery.length >= breedNests(s, BR)) return 'full';
  if (s.meta.scrap < breedCost(mode, BR)) return 'scrap';
  return '';
}
/** the egg's seed: both parents (in either order) and the ranch's count of pairs */
/** @param {SaveData} s @param {string} a @param {string} b */
export const breedSeed = (s, a, b) => `breed|${[a, b].sort().join('|')}|${s.ranch.bred || 0}`;
/** a name made from two: the first half of one and the second half of the other ("Emberox" + "Cartotter" ->
    "Embeotter"), at most 24 letters */
/** @param {string} x @param {string} y */
export function breedName(x, y) {
  const head = x.slice(0, Math.ceil(x.length / 2)),
    tail = y.slice(Math.floor(y.length / 2)).toLowerCase();
  return (head + tail).slice(0, 24) || x;
}
/** what this pair's egg hatches into, rolled from the seed: the Billie (its uid from the seed too) and what it is.
    The parents aren't changed. */
/** @param {SaveData} s @param {Billy} A @param {Billy} B @param {'safe' | 'risky'} mode @param {BreedRules} BR
    @returns {{ m: Billy, out: BreedOut }} */
export function breedRoll(s, A, B, mode, BR) {
  const seed = breedSeed(s, A.uid, B.uid),
    r = rngFrom(seed, mode),
    /* the pair in a set order, so the egg doesn't depend on which was picked first */
    [P, Q] = A.uid < B.uid ? [A, B] : [B, A],
    out = /** @type {BreedOut} */ (mode === 'safe' ? 'safe' : r.pick(BR.odds)),
    body = mode === 'safe' || r.chance(0.5) ? P : Q,
    other = body === P ? Q : P,
    line = breedLine(body),
    sp = line + '0',
    bp = cleanBuild(P.build),
    bq = cleanBuild(Q.build),
    /** @type {Record<string, PartSize>} */
    build = {};
  for (const k of partSlots()) build[k] = out === 'abom' ? (r.chance(0.5) ? 'S' : 'L') : r.chance(0.5) ? bp[k] : bq[k];
  let coat = coatRoll(COATS, 'egg', r.next);
  /** @type {string[]} */
  let moves = movesAt(line, BR.lvl);
  if (out === 'quirk') {
    /* a move from the other parent it wouldn't know, and a swing: a coat (if any can come from an egg) or one size */
    const learn = other.moves.filter(mv => MOVES[mv] && !moves.includes(mv));
    if (learn.length) {
      const mv = learn[r.int(0, learn.length - 1)];
      moves = moves.length < moveSlotCount() ? moves.concat(mv) : moves.slice(1).concat(mv);
    }
    const eggCoats = Object.keys(COATS).filter(c => COATS[c].odds && COATS[c].odds.egg);
    if (eggCoats.length && !coat && r.chance(0.5)) coat = eggCoats[r.int(0, eggCoats.length - 1)];
    else {
      const slots = partSlots(),
        k = slots[r.int(0, slots.length - 1)];
      if (k) build[k] = build[k] === 'L' ? 'S' : build[k] === 'S' ? 'L' : r.chance(0.5) ? 'S' : 'L';
    }
  }
  const m = /** @type {Billy} */ (makeBilly(sp, BR.lvl, { build, coat }));
  m.uid = 'b' + hashString(seed).toString(36) + (s.ranch.bred || 0).toString(36);
  m.moves = moves;
  if (out === 'quirk') m.mut = { k: 'quirk' };
  else if (out === 'abom') {
    const ids = STAT_IDS.slice(),
      up = ids.splice(r.int(0, ids.length - 1), 1)[0],
      down = ids[r.int(0, ids.length - 1)];
    m.mut = { k: 'abom', name: breedName(speciesOf(body).name, speciesOf(other).name), up, down };
  }
  delete m.met;
  m.hp = maxHp(m);
  return { m, out };
}
/** start breeding: pays the Scrap and puts the rolled egg in the nursery; why not, or '' when it started */
/** @param {SaveData} s @param {string} a @param {string} b @param {'safe' | 'risky'} mode @param {number} now
    @param {BreedRules} BR */
export function breedStart(s, a, b, mode, now, BR) {
  const why = breedCan(s, a, b, mode, BR);
  if (why) return why;
  const A = /** @type {Billy} */ (breedParent(s, a)),
    B = /** @type {Billy} */ (breedParent(s, b)),
    { m } = breedRoll(s, A, B, mode, BR),
    at = Math.max(0, Math.floor(now));
  s.meta.scrap -= breedCost(mode, BR);
  s.ranch.nursery.push({ a, b, mode, at, ready: at + BR.hours * BREED_HOUR, egg: m });
  s.ranch.bred = (s.ranch.bred || 0) + 1;
  return '';
}
/** is this egg ready to hatch */
/** @param {NurseryEgg} e @param {number} now */
export const breedReady = (e, now) => now >= e.ready;
/** hatch a ready egg: its Billie joins the team, or storage when the team is full; where it went, or '' when the egg
    isn't there or isn't ready */
/** @param {SaveData} s @param {number} i the egg's place in the nursery @param {number} now
    @returns {{ m: Billy, where: 'team' | 'box' } | null} */
export function breedHatch(s, i, now) {
  const e = s.ranch.nursery[i];
  if (s.run || !e || !breedReady(e, now)) return null;
  const m = e.egg;
  s.ranch.nursery.splice(i, 1);
  m.met = { n: 'ranch', t: Math.max(0, Math.floor(now)) };
  s.caught[m.sp] = 1;
  s.seen[m.sp] = 1;
  s.hatched = (s.hatched || 0) + 1;
  if (s.team.length < teamSize()) {
    s.team.push(m);
    return { m, where: 'team' };
  }
  m.boxedAt = Math.max(0, Math.floor(now));
  s.box.push(m);
  return { m, where: 'box' };
}
