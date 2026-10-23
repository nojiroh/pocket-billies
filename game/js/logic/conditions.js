// @ts-check
'use strict';
/* ================= CONDITIONS (Project Story S1) =================
   The small grammar the story's scripts, gates and `when` fields are written in (docs/SCRIPTS.md). A condition is
   parsed once into a tree and read against a plain story state (storyStateOf); it is never run as code.
     met_juniper            a story flag is set          !met_juniper, not met_juniper   it isn't
     rival0 = win           a story flag holds a word    beat:chad                      a trainer is beaten
     item:honey >= 3        items in the bag             coin:gold_pyramid > 0                  pyramids
     quest:ledger = asked   a quest's stage (also >=, <: in the quest's order of stages; `none` before it starts)
     visits:juniper >= 2    times you have talked to someone
     visited:copperleaf     a place you have been        billie:musk                    a Billie of that line caught
     robot                  you have a robot             badges >= 2                    badges won
     caught >= 15           kinds of Billie caught (the Index)
     unlock:shop_revive    an unlock is owned (RL-11)  runs >= 3, wins >= 1           runs ended, runs won (RL-11)
   combined with `and`, `or`, `not` / `!` and parentheses (`and` binds tighter than `or`). A bare count term
   (`item:honey`, `visits:juniper`, `badges`) means more than 0. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  CONDITION_KINDS: [() => CONDITION_KINDS],
  OPS: [() => OPS],
  WORDS: [() => WORDS],
  // @ts-expect-error -- replaced on purpose
  compare: [() => compare, v => (compare = v)],
  // @ts-expect-error -- replaced on purpose
  conditionError: [() => conditionError, v => (conditionError = v)],
  // @ts-expect-error -- replaced on purpose
  conditionHolds: [() => conditionHolds, v => (conditionHolds = v)],
  // @ts-expect-error -- replaced on purpose
  conditionNames: [() => conditionNames, v => (conditionNames = v)],
  // @ts-expect-error -- replaced on purpose
  conditionProblem: [() => conditionProblem, v => (conditionProblem = v)],
  // @ts-expect-error -- replaced on purpose
  conditionTree: [() => conditionTree, v => (conditionTree = v)],
  // @ts-expect-error -- replaced on purpose
  didYouMean: [() => didYouMean, v => (didYouMean = v)],
  // @ts-expect-error -- replaced on purpose
  editDistance: [() => editDistance, v => (editDistance = v)],
  // @ts-expect-error -- replaced on purpose
  parseCondition: [() => parseCondition, v => (parseCondition = v)],
  parsed: [() => parsed],
  // @ts-expect-error -- replaced on purpose
  storyStateOf: [() => storyStateOf, v => (storyStateOf = v)],
  // @ts-expect-error -- replaced on purpose
  termValue: [() => termValue, v => (termValue = v)],
  // @ts-expect-error -- replaced on purpose
  tokens: [() => tokens, v => (tokens = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {'=' | '!=' | '>=' | '<=' | '>' | '<'} Op */
/** @typedef {{ t: 'term', kind: string, id: string, op: Op | null, val: string | number | null }} Term */
/** @typedef {Term | { t: 'and', a: Cond, b: Cond } | { t: 'or', a: Cond, b: Cond } | { t: 'not', a: Cond }} Cond */
/** @typedef {{ flags: Record<string, any>, beaten: Record<string, any>, items: Record<string, number>,
 *   pyramids: Record<string, number>, quests: Record<string, string>, visits: Record<string, number>,
 *   visited: Record<string, any>, lines: Record<string, any>, robots: number, badges: number, caught: number,
 *   unlocks: Record<string, any>, runs: number, wins: number, questStages?: Record<string, string[]> }} StoryState */

/** each term kind: whether it takes an id after the colon, whether it is a count (compared as a number), and what it
 * reads, for the Studio's reference (Project Story S3) */
export const CONDITION_KINDS = {
  beat: { id: true, count: false, about: 'you beat this trainer: beat:chad' },
  item: { id: true, count: true, about: 'how many of an item you carry: item:honey >= 2' },
  coin: { id: true, count: true, about: 'how many of a coin you have: coin:gold_pyramid >= 3' },
  quest: { id: true, count: false, about: 'a quest’s stage, in the quest’s order: quest:lost_cat >= found' },
  visits: { id: true, count: true, about: 'times you have talked to someone: visits:juniper >= 2' },
  visited: { id: true, count: false, about: 'you have been to a place: visited:copperleaf' },
  billie: { id: true, count: false, about: 'a Billie of that line caught: billie:musk' },
  robot: { id: false, count: true, about: 'you have a robot' },
  badges: { id: false, count: true, about: 'badges won: badges >= 3' },
  caught: { id: false, count: true, about: 'kinds of Billie caught (the Index)' },
  unlock: { id: true, count: false, about: 'an unlock is owned (unlocks.json): unlock:ranch_2' },
  runs: { id: false, count: true, about: 'runs ended, won or lost: runs >= 3' },
  wins: { id: false, count: true, about: 'runs won: wins >= 1' },
};
export const OPS = ['>=', '<=', '!=', '==', '=', '>', '<'];
export const WORDS = new Set(['and', 'or', 'not']);

/** an error in a condition, with the column (from 0) it was found at @param {string} message @param {number} col */
export function conditionError(message, col) {
  return Object.assign(new Error(message), { name: 'ConditionError', col });
}

/** how many single-letter edits (a swap of two neighbours counts as one) turn a into b, for "did you mean"
 * @param {string} a @param {string} b */
export function editDistance(a, b) {
  /** @type {number[][]} */
  const d = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    d[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
/** the nearest of the names, if it is near enough to be a typo @param {string} w @param {Iterable<string>} names */
export function didYouMean(w, names) {
  let best = '',
    d = Infinity;
  for (const n of names) {
    const e = editDistance(w, n);
    if (e < d) [best, d] = [n, e];
  }
  return d <= Math.max(1, Math.floor(best.length / 3)) ? best : '';
}

/** @param {string} src @returns {{ k: string, v: string, col: number }[]} */
export function tokens(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ k: c, v: c, col: i });
      i++;
      continue;
    }
    const op = OPS.find(o => src.startsWith(o, i));
    if (op) {
      out.push({ k: 'op', v: op === '==' ? '=' : op, col: i });
      i += op.length;
      continue;
    }
    if (c === '!') {
      out.push({ k: 'not', v: '!', col: i });
      i++;
      continue;
    }
    const m = /^[A-Za-z0-9_][\w.-]*(?::[\w.-]+)?/.exec(src.slice(i));
    if (!m) throw conditionError(`unexpected "${c}"`, i);
    const w = m[0];
    out.push({ k: WORDS.has(w) ? w : 'word', v: w, col: i });
    i += w.length;
  }
  return out;
}

/** reads a condition into its tree; throws a conditionError @param {string} src @returns {Cond} */
export function parseCondition(src) {
  const T = tokens(String(src));
  let p = 0;
  const peek = () => T[p],
    end = () => (T.length ? T[T.length - 1].col + T[T.length - 1].v.length : 0);
  const expect = (/** @type {string} */ what) => {
    const t = T[p];
    if (!t) throw conditionError(`${what} expected at the end`, end());
    return t;
  };
  /** @returns {Cond} */
  const or = () => {
    let a = and();
    while (peek() && peek().k === 'or') {
      p++;
      a = { t: 'or', a, b: and() };
    }
    return a;
  };
  /** @returns {Cond} */
  const and = () => {
    let a = not();
    while (peek() && peek().k === 'and') {
      p++;
      a = { t: 'and', a, b: not() };
    }
    return a;
  };
  /** @returns {Cond} */
  const not = () => {
    if (peek() && peek().k === 'not') {
      p++;
      return { t: 'not', a: not() };
    }
    return atom();
  };
  /** @returns {Cond} */
  const atom = () => {
    const t = expect('a flag or a term');
    if (t.k === '(') {
      p++;
      const a = or(),
        c = expect('")"');
      if (c.k !== ')') throw conditionError(`")" expected, found "${c.v}"`, c.col);
      p++;
      return a;
    }
    if (t.k !== 'word') throw conditionError(`a flag or a term expected, found "${t.v}"`, t.col);
    p++;
    const colon = t.v.indexOf(':');
    let kind = colon < 0 ? 'flag' : t.v.slice(0, colon),
      id = colon < 0 ? t.v : t.v.slice(colon + 1);
    if (colon < 0 && t.v in CONDITION_KINDS && !CONDITION_KINDS[t.v].id) [kind, id] = [t.v, ''];
    if (kind !== 'flag' && !(kind in CONDITION_KINDS)) {
      const near = didYouMean(kind, Object.keys(CONDITION_KINDS));
      throw conditionError(`unknown term "${kind}:"${near ? `, did you mean "${near}:"?` : ''}`, t.col);
    }
    if (kind !== 'flag' && CONDITION_KINDS[kind].id && !id)
      throw conditionError(`"${kind}:" needs a name after the colon`, t.col);
    if (kind !== 'flag' && !CONDITION_KINDS[kind].id && colon >= 0)
      throw conditionError(`"${kind}" takes no name (write "${kind} >= 1")`, t.col);
    /** @type {Term} */
    const term = { t: 'term', kind, id, op: null, val: null };
    if (peek() && peek().k === 'op') {
      const o = T[p++],
        v = expect('a value after ' + o.v);
      if (v.k !== 'word') throw conditionError(`a value expected after "${o.v}", found "${v.v}"`, v.col);
      p++;
      term.op = /** @type {Op} */ (o.v);
      const num = /^-?\d+(\.\d+)?$/.test(v.v);
      if (kind === 'flag' && !['=', '!='].includes(o.v) && !num)
        throw conditionError(`"${o.v}" compares numbers; a flag's word takes = or !=`, o.col);
      if (kind !== 'flag' && kind !== 'quest' && !CONDITION_KINDS[kind].count)
        throw conditionError(`"${kind}:" is yes or no; it takes no "${o.v}"`, o.col);
      if (kind !== 'flag' && kind !== 'quest' && !num)
        throw conditionError(`"${kind}" is a count: a number expected after "${o.v}"`, v.col);
      term.val = num ? +v.v : v.v;
    } else if (kind === 'quest') throw conditionError(`"quest:${id}" needs a stage (quest:${id} = <stage>)`, t.col);
    return term;
  };
  const tree = or();
  if (p < T.length) {
    const t = T[p];
    throw conditionError(`"and" or "or" expected before "${t.v}"`, t.col);
  }
  return tree;
}

/** @type {Map<string, Cond>} */
export const parsed = new Map();
/** a condition's tree, parsed once per text @param {string} src */
export function conditionTree(src) {
  let c = parsed.get(src);
  if (!c) parsed.set(src, (c = parseCondition(src)));
  return c;
}
/** null if the condition reads, else its error and column @param {string} src */
export function conditionProblem(src) {
  try {
    conditionTree(src);
    return null;
  } catch (e) {
    const err = /** @type {Error & { col?: number }} */ (e);
    if (err.name === 'ConditionError') return { message: err.message, col: err.col };
    throw e;
  }
}
/** every name a condition reads, by kind (the story checks use it) @param {Cond} c
 * @param {Record<string, Set<string>>} [out] */
export function conditionNames(c, out = {}) {
  if (c.t === 'term') (out[c.kind] || (out[c.kind] = new Set())).add(c.id);
  else if (c.t === 'not') conditionNames(c.a, out);
  else {
    conditionNames(c.a, out);
    conditionNames(c.b, out);
  }
  return out;
}

/** @param {any} a @param {Op} op @param {any} b */
export function compare(a, op, b) {
  switch (op) {
    case '=':
      return a === b;
    case '!=':
      return a !== b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '<':
      return a < b;
  }
}
/** @param {Term} c @param {StoryState} S */
export function termValue(c, S) {
  switch (c.kind) {
    case 'flag':
      return S.flags[c.id];
    case 'beat':
      return !!S.beaten[c.id];
    case 'item':
      return S.items[c.id] || 0;
    case 'coin':
      return S.pyramids[c.id] || 0;
    case 'visits':
      return S.visits[c.id] || 0;
    case 'visited':
      return !!S.visited[c.id];
    case 'billie':
      return !!S.lines[c.id];
    case 'robot':
      return S.robots;
    case 'badges':
      return S.badges;
    case 'caught':
      return S.caught;
    case 'unlock':
      return !!S.unlocks[c.id];
    case 'runs':
      return S.runs;
    case 'wins':
      return S.wins;
  }
}
/** whether a condition holds for the state @param {Cond | string} c @param {StoryState} S @returns {boolean} */
export function conditionHolds(c, S) {
  if (typeof c === 'string') c = conditionTree(c);
  if (c.t === 'and') return conditionHolds(c.a, S) && conditionHolds(c.b, S);
  if (c.t === 'or') return conditionHolds(c.a, S) || conditionHolds(c.b, S);
  if (c.t === 'not') return !conditionHolds(c.a, S);
  if (c.kind === 'quest') {
    const at = S.quests[c.id] || 'none';
    if (c.op === '=' || c.op === '!=') return compare(at, c.op, String(c.val));
    /* the order of stages: the quest's own list, 'none' before the first */
    const order = ['none', ...((S.questStages || {})[c.id] || [])];
    const i = order.indexOf(at),
      j = order.indexOf(String(c.val));
    return i >= 0 && j >= 0 && compare(i, /** @type {Op} */ (c.op), j);
  }
  const v = termValue(c, S);
  if (c.op) return compare(c.kind === 'flag' && typeof c.val === 'number' ? +(v || 0) : v, c.op, c.val);
  return CONDITION_KINDS[c.kind] && CONDITION_KINDS[c.kind].count ? v > 0 : !!v;
}

/** the story state a save gives, for conditionHolds: the save's own objects where they fit (so a script's changes to
 * story flags, items and pyramids show at once), counts and lookups made fresh
 * @param {any} save @param {{ locations?: { id: string }[], questStages?: Record<string, string[]> }} [o] */
export function storyStateOf(save, o = {}) {
  const story = save.story || (save.story = {}),
    visited = /** @type {Record<string, number>} */ ({}),
    lines = /** @type {Record<string, number>} */ ({});
  (o.locations || []).forEach((r, i) => {
    if (save.visited && save.visited[i]) visited[r.id] = 1;
  });
  for (const sp of Object.keys(save.caught || {})) {
    lines[sp] = 1;
    lines[sp.replace(/\d+$/, '')] = 1;
    /* RO-1: a regional form (trump_waterfront0) counts for its line (trump) */
    lines[sp.replace(/(?:_[a-z0-9]+)?\d+$/, '')] = 1;
  }
  const all = [...(save.team || []), ...(save.box || [])],
    /* RL-11: what lasts between runs (the same in a run and in the hub) */
    meta = save.meta || {};
  return {
    flags: story,
    beaten: save.flags || {},
    items: save.items || {},
    pyramids: save.pyramids || {},
    quests: story.quests || {},
    visits: story.talks || {},
    visited,
    lines,
    robots: all.filter(m => m && m.kind === 'robot').length,
    badges: (save.seats || []).length,
    caught: Object.keys(save.caught || {}).length,
    unlocks: meta.unlocks || {},
    runs: meta.runs || 0,
    wins: meta.wins || 0,
    questStages: o.questStages,
  };
}
