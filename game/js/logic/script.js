// @ts-check
'use strict';
/* ================= STORY SCRIPTS (Project Story S1) =================
   What people say and do, written as a JSON array of lines in the data (a person, a trainer, the openings), read into a
   tree once and played by a runner on a small stage (the game's own in story-stage.js, a stub in the tests). The
   format is in docs/SCRIPTS.md:
     [happy] Juniper: There you are, dear.     a line: [expression] and Name: are both optional
     choice / > [if cond] [once] text          a choice; the lines under each option are indented two more
     if cond / elif cond / else                conditions (logic/conditions.js)
     once [key]                                the lines under it, the first time only
     cycle [key] / seq [key] with - entries    a different entry each time (cycle starts over, seq stays on the last)
     set flag [value], give item n, battle chad, ...   commands (SCRIPT_COMMANDS)
     {name} {caught} {badges}                  slots in a line (SCRIPT_SLOTS), filled in as it is said
   Indentation is two spaces inside the strings. A line that starts with a small letter is a command or a keyword; an
   unknown one is an error with "did you mean", never a line of dialogue. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide, saveData } from '../hooks.js';
import { LOCATIONS, STORY_DATA, TRAINERS, warnData } from '../game-data.js';
import { makeBilly } from './rules.js';
import { conditionHolds, conditionTree, storyStateOf } from './conditions.js';
import { SCRIPT_COMMANDS } from './script-parse.js';
/* eslint-disable no-func-assign */
expose({
  END: [() => END],
  // @ts-expect-error -- replaced on purpose
  applyStoryPreset: [() => applyStoryPreset, v => (applyStoryPreset = v)],
  // @ts-expect-error -- replaced on purpose
  chapterMap: [() => chapterMap, v => (chapterMap = v)],
  flagWarned: [() => flagWarned],
  // @ts-expect-error -- replaced on purpose
  runBase: [() => runBase, v => (runBase = v)],
  // @ts-expect-error -- replaced on purpose
  runScript: [() => runScript, v => (runScript = v)],
  // @ts-expect-error -- replaced on purpose
  saveDuringRun: [() => saveDuringRun, v => (saveDuringRun = v)],
  // @ts-expect-error -- replaced on purpose
  setStoryFlag: [() => setStoryFlag, v => (setStoryFlag = v)],
  // @ts-expect-error -- replaced on purpose
  storyAllows: [() => storyAllows, v => ((storyAllows = v), provide({ storyAllows }))],
  // @ts-expect-error -- replaced on purpose
  storyFlagKnown: [() => storyFlagKnown, v => (storyFlagKnown = v)],
  // @ts-expect-error -- replaced on purpose
  storyHolds: [() => storyHolds, v => ((storyHolds = v), provide({ storyHolds }))],
});
/* eslint-enable no-func-assign */
provide({ storyAllows, storyHolds });
/* to-module: end */
/** @typedef {import('./script-parse.js').ScriptNode} ScriptNode */
/** @typedef {import('./script-parse.js').CmdNode} CmdNode */

/* ---------- the runner ----------
   A stage is what plays the lines: say({ who, expr, text, line }), choose(options) -> index, and a function per
   command it plays (battle, walk, camera, ...). The runner changes the save itself (flags, items, pyramids, quests, once,
   cycles), through `save` (the game's saveData, or a test's object).
   Where it is: a path of numbers, [statement, branch, statement, branch, ..., statement]: the branch is the clause
   of an if, the option of a choice, the entry of a cycle, 0 for once and call. After a checkpoint command the
   runner hands onCheckpoint the path of the statement after it, and a run started with that path (resume) carries
   on from there without asking again (conditions, choices and counters are not read twice). */

/** @typedef {{ say: (l: { who: string | null, expr: string | null, text: string, line: number, id?: string }) => any,
 *   choose: (options: { text: string, line: number }[]) => number | Promise<number>,
 *   [cmd: string]: any }} Stage */
/** @typedef {{ save: any, id?: string, speaker?: string | null, scripts?: (id: string) => ScriptNode[] | null,
 *   locations?: { id: string }[], questStages?: Record<string, string[]>, resume?: number[] | null,
 *   onCheckpoint?: (path: number[]) => void, control?: { skipping: boolean },
 *   slots?: Record<string, () => string | number> }} RunOptions */

export const END = Symbol('end');
/** plays a script; resolves when it is over @param {ScriptNode[]} tree @param {Stage} stage @param {RunOptions} o */
export async function runScript(tree, stage, o) {
  const save = o.save,
    story = save.story || (save.story = {}),
    control = o.control || { skipping: false },
    id = o.id || 'script';
  const holds = (/** @type {string} */ c) =>
    conditionHolds(conditionTree(c), storyStateOf(save, { locations: o.locations, questStages: o.questStages }));
  /* what once / cycle / seq / [once] remember by: their key, else their (first) line id, else the line number */
  const keyOf = (/** @type {{ key?: string | null, lid?: string, id?: string, line: number }} */ n) =>
    n.key || (n.lid || n.id ? `${id}#${n.lid || n.id}` : `${id}@${n.line}`);
  const fill = (/** @type {string} */ text) =>
    text.includes('{')
      ? text.replace(/\{(\w+)\}/g, (_, k) => {
          const f = o.slots && o.slots[k];
          if (f) return String(f());
          const S = storyStateOf(save);
          return k === 'caught' ? String(S.caught) : k === 'badges' ? String(S.badges) : 'Trainer';
        })
      : text;
  const play = async (/** @type {string} */ cmd, /** @type {any} */ arg) => {
    if (typeof stage[cmd] !== 'function') throw new Error(`the stage can't play "${cmd}" yet`);
    return stage[cmd](arg);
  };
  /** @param {ScriptNode[]} blk @param {number[]} at @param {number[] | null} resume */
  const runBlock = async (blk, at, resume) => {
    for (let i = resume ? resume[0] : 0; i < blk.length; i++) {
      const inner = resume && i === resume[0] ? resume.slice(1) : null;
      if ((await runNode(blk[i], [...at, i], inner && inner.length ? inner : null)) === END) return END;
    }
  };
  /** the branch to take: the resumed one, or the one the node picks now
   * @param {number[] | null} inner @param {() => number | Promise<number>} pick */
  const branch = async (inner, pick) => (inner ? inner[0] : pick());
  /** @param {ScriptNode} n @param {number[]} at @param {number[] | null} inner @returns {Promise<any>} */
  const runNode = async (n, at, inner) => {
    const into = (/** @type {ScriptNode[]} */ b, /** @type {number} */ k) =>
      runBlock(b, [...at, k], inner ? inner.slice(1) : null);
    switch (n.k) {
      case 'say':
        if (!control.skipping)
          await stage.say({
            who: n.who || o.speaker || null,
            expr: n.expr,
            text: fill(n.text),
            line: n.line,
            id: n.id,
          });
        return;
      case 'if': {
        const k = await branch(inner, () => n.clauses.findIndex(c => c.cond === null || holds(c.cond)));
        return k >= 0 ? into(n.clauses[k].body, k) : undefined;
      }
      case 'once': {
        const seen = story.once || (story.once = {}),
          key = keyOf(n);
        if (!inner) {
          if (seen[key]) return;
          seen[key] = 1;
        }
        return into(n.body, 0);
      }
      case 'cycle':
      case 'seq': {
        const k = await branch(inner, () => {
          const C = story.cycles || (story.cycles = {}),
            key = keyOf(n),
            at_ = C[key] || 0;
          C[key] = n.k === 'cycle' ? (at_ + 1) % n.entries.length : Math.min(at_ + 1, n.entries.length - 1);
          return Math.min(at_, n.entries.length - 1);
        });
        return into(n.entries[k], k);
      }
      case 'choice': {
        const k = await branch(inner, async () => {
          const taken = story.once || (story.once = {}),
            shown = n.options
              .map((op, i) => ({ op, i }))
              .filter(({ op }) => (!op.cond || holds(op.cond)) && !(op.once && taken[keyOf(op)]));
          if (!shown.length) return -1;
          /* skipping: the first option shown, the one a hurried tap would take */
          const pick = control.skipping
            ? 0
            : await stage.choose(shown.map(({ op }) => ({ text: op.text, line: op.line })));
          const c = shown[Math.max(0, Math.min(shown.length - 1, pick | 0))];
          if (c.op.once) taken[keyOf(c.op)] = 1;
          return c.i;
        });
        return k >= 0 ? into(n.options[k].body, k) : undefined;
      }
      case 'cmd':
        return runCommand(n, at, inner, into);
    }
  };
  /** @param {CmdNode} n @param {number[]} at @param {number[] | null} inner
   * @param {(b: ScriptNode[], k: number) => Promise<any>} into */
  const runCommand = async (n, at, inner, into) => {
    /* slots in a command are filled in too: "caption 3 The Hollow Earth | {place}" */
    if (n.args.some(x => x.includes('{'))) n = { ...n, args: n.args.map(fill) };
    const [a, b] = n.args,
      count = (/** @type {string | undefined} */ s) => (s == null ? 1 : +s);
    const bag = (/** @type {string} */ thing) =>
      thing.startsWith('coin:')
        ? { o: save.pyramids || (save.pyramids = {}), k: thing.slice(5) }
        : { o: save.items || (save.items = {}), k: thing };
    switch (n.name) {
      case 'set':
        story[a] = b == null ? 1 : /^-?\d+(\.\d+)?$/.test(b) ? +b : b;
        return;
      case 'clear':
        delete story[a];
        return;
      case 'give': {
        const { o: B, k } = bag(a);
        B[k] = (B[k] || 0) + count(b);
        return;
      }
      case 'take': {
        const { o: B, k } = bag(a);
        B[k] = Math.max(0, (B[k] || 0) - count(b));
        return;
      }
      case 'quest':
        (story.quests || (story.quests = {}))[a] = b;
        return;
      case 'end':
        return END;
      case 'call': {
        const t = o.scripts && o.scripts(a);
        if (!t) throw new Error(`${id}, line ${n.line + 1}: no script "${a}" to call`);
        return into(t, 0);
      }
      case 'wait':
      case 'walk':
      case 'face':
      case 'camera':
      case 'fade':
        if (!control.skipping) await play(n.name, n.args);
        else if (stage.skipTo) await stage.skipTo(n.name, n.args);
        return;
      default: {
        const spec = /** @type {Record<string, { checkpoint?: boolean }>} */ (SCRIPT_COMMANDS)[n.name];
        /* what can't be skipped (a battle, the dressing room, a new place) stops the skip there */
        if (spec.checkpoint) control.skipping = false;
        await play(n.name, n.args);
        if (spec.checkpoint && o.onCheckpoint) o.onCheckpoint([...at.slice(0, -1), at[at.length - 1] + 1]);
      }
    }
  };
  await runBlock(tree, [], o.resume && o.resume.length ? o.resume : null);
}

/* ---------- the story flags (story.json flags, patterns, kept) ---------- */
/** a flag story.json lists, by name or by pattern (met_<id> takes every met_...) @param {string} k */
export function storyFlagKnown(k) {
  const S = STORY_DATA || {};
  if (k in (S.flags || {}) || k in (S.kept || {})) return true;
  return Object.keys(S.patterns || {}).some(p => k.startsWith(p.slice(0, p.indexOf('<'))) && k.length > p.indexOf('<'));
}
/** @type {Set<string>} */
export const flagWarned = new Set();
/** every story flag the game sets goes through here: one story.json doesn't list is a warning (the debug log's data
 * list), once @param {string} k @param {any} [v] */
export function setStoryFlag(k, v = 1) {
  if (!storyFlagKnown(k) && !flagWarned.has(k)) {
    flagWarned.add(k);
    warnData(`story flag ${k} is not in story.json`);
  }
  (saveData.story || (saveData.story = {}))[k] = v;
}

/* ---------- the story-dependent world (Project Story S2) ----------
   People, trainers and props can carry `when` and `unless` (conditions); exits and doors `requires` (and a `locked`
   line for when it doesn't hold); a chapter (story.json chapters) swaps a map for a variant file while its condition
   holds. Read against the game's save (saveData) unless a save is given. */
/** whether a condition holds now @param {string} cond @param {any} [save] */
export function storyHolds(cond, save = saveData) {
  const qs = Object.fromEntries(
    Object.entries((STORY_DATA || {}).quests || {}).map(([k, q]) => [k, /** @type {any} */ (q).stages])
  );
  return conditionHolds(conditionTree(cond), storyStateOf(save, { locations: LOCATIONS, questStages: qs }));
}
/** whether a person, trainer or prop is there: its `when` holds (if it has one) and its `unless` doesn't
 * @param {{ when?: string, unless?: string } | null | undefined} thing @param {any} [save] */
export function storyAllows(thing, save = saveData) {
  if (!thing) return false;
  if (thing.when && !storyHolds(thing.when, save)) return false;
  return !(thing.unless && storyHolds(thing.unless, save));
}
/** the map file to load for a map id: a chapter's variant while its condition holds (the first that holds, in
 * story.json's order), else the map itself @param {string} id @param {any} [save] */
export function chapterMap(id, save = saveData) {
  for (const C of Object.values((STORY_DATA || {}).chapters || {})) {
    const c = /** @type {{ when: string, maps?: Record<string, string> }} */ (C);
    if (c.maps && c.maps[id] && storyHolds(c.when, save)) return c.maps[id];
  }
  return id;
}

/* ---------- safe runs ----------
   A script changes the save as it runs, but a save taken halfway through stores the story, items, pyramids and trainers
   beaten as they were when it started (or at its last checkpoint), with `resume` saying which script to play again
   on Continue and from where. */
/** what JSON.stringify(save) writes while a script runs @param {any} save
 * @param {{ story: any, items: any, pyramids: any, flags: any }} base @param {{ script: string, path: number[] | null }} at */
export function saveDuringRun(save, base, at) {
  return { ...save, ...base, story: { ...base.story, resume: at } };
}
/** the parts of a save a safe run keeps aside, copied @param {any} save */
export function runBase(save) {
  return JSON.parse(
    JSON.stringify({
      story: save.story || {},
      items: save.items || {},
      pyramids: save.pyramids || {},
      flags: save.flags || {},
    })
  );
}

/* ---------- start presets (story.json presets, ?story=<preset> in a test run) ---------- */
/** puts a started save at a point in the story: the place, story flags, trainers beaten (a leader's badge with them),
 * pyramids, items and the team; returns the preset, or null if there is none by that name
 * @param {any} save @param {string} name */
export function applyStoryPreset(save, name) {
  const P = ((STORY_DATA || {}).presets || {})[name];
  if (!P) return null;
  const node = LOCATIONS.findIndex(r => r.id === P.place);
  if (node >= 0) {
    save.trip = { node, plan: [] };
    save.visited[node] = 1;
    save.mapSeen = null;
  }
  save.story = Object.assign({}, save.story, P.flags || {});
  for (const id of P.beaten || []) {
    const T = TRAINERS[id];
    if (!T) continue;
    save.flags[id] = 1;
    if (T.seat && !save.seats.includes(T.seat.id)) save.seats.push(T.seat.id);
  }
  Object.assign(save.pyramids, P.pyramids || {});
  Object.assign(save.items, P.items || {});
  save.team = P.team.map((/** @type {{ sp: string, lvl: number }} */ m) => makeBilly(m.sp, m.lvl));
  save.buddy = save.team[0].uid;
  for (const m of save.team) save.caught[m.sp] = save.seen[m.sp] = 1;
  return P;
}
