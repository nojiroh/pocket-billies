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
import { conditionHolds, conditionProblem, conditionTree, didYouMean, storyStateOf } from './conditions.js';
/* eslint-disable no-func-assign */
expose({
  END: [() => END],
  KEYWORDS: [() => KEYWORDS],
  SCRIPT_COMMANDS: [() => SCRIPT_COMMANDS],
  SCRIPT_SLOTS: [() => SCRIPT_SLOTS],
  // @ts-expect-error -- replaced on purpose
  applyStoryPreset: [() => applyStoryPreset, v => (applyStoryPreset = v)],
  // @ts-expect-error -- replaced on purpose
  chapterMap: [() => chapterMap, v => (chapterMap = v)],
  // @ts-expect-error -- replaced on purpose
  checkedCondition: [() => checkedCondition, v => (checkedCondition = v)],
  flagWarned: [() => flagWarned],
  // @ts-expect-error -- replaced on purpose
  parseScript: [() => parseScript, v => (parseScript = v)],
  // @ts-expect-error -- replaced on purpose
  runBase: [() => runBase, v => (runBase = v)],
  // @ts-expect-error -- replaced on purpose
  runScript: [() => runScript, v => (runScript = v)],
  // @ts-expect-error -- replaced on purpose
  saveDuringRun: [() => saveDuringRun, v => (saveDuringRun = v)],
  // @ts-expect-error -- replaced on purpose
  sayLine: [() => sayLine, v => (sayLine = v)],
  // @ts-expect-error -- replaced on purpose
  scriptError: [() => scriptError, v => (scriptError = v)],
  // @ts-expect-error -- replaced on purpose
  scriptProblem: [() => scriptProblem, v => (scriptProblem = v)],
  // @ts-expect-error -- replaced on purpose
  setStoryFlag: [() => setStoryFlag, v => (setStoryFlag = v)],
  // @ts-expect-error -- replaced on purpose
  storyAllows: [() => storyAllows, v => ((storyAllows = v), provide({ storyAllows }))],
  // @ts-expect-error -- replaced on purpose
  storyFlagKnown: [() => storyFlagKnown, v => (storyFlagKnown = v)],
  // @ts-expect-error -- replaced on purpose
  storyHolds: [() => storyHolds, v => (storyHolds = v)],
});
/* eslint-enable no-func-assign */
provide({ storyAllows });
/* to-module: end */
/** @typedef {{ k: 'say', line: number, who: string | null, expr: string | null, text: string }} SayNode */
/** @typedef {{ k: 'cmd', line: number, name: string, args: string[] }} CmdNode */
/** @typedef {{ text: string, cond: string | null, once: boolean, line: number, body: ScriptNode[] }} ChoiceOption */
/** @typedef {{ k: 'choice', line: number, options: ChoiceOption[] }} ChoiceNode */
/** @typedef {{ k: 'if', line: number, clauses: { cond: string | null, body: ScriptNode[] }[] }} IfNode */
/** @typedef {{ k: 'once', line: number, key: string | null, body: ScriptNode[] }} OnceNode */
/** @typedef {{ k: 'cycle' | 'seq', line: number, key: string | null, entries: ScriptNode[][] }} CycleNode */
/** @typedef {SayNode | CmdNode | ChoiceNode | IfNode | OnceNode | CycleNode} ScriptNode */

/** the commands: their arguments (`?` optional, `...` the rest, `n` and `s` numbers), whether they are a checkpoint
 * (a save after one keeps what came before it: logic below), what each does, for the Studio's reference (S3) */
export const SCRIPT_COMMANDS = {
  set: { args: ['flag', 'value?'], about: 'set a story flag (to 1, or to the word or number given)' },
  clear: { args: ['flag'], about: 'clear a story flag' },
  give: { args: ['item', 'n?'], about: 'give items (or coin:<id>), 1 if no count' },
  take: { args: ['item', 'n?'], about: 'take items (or coin:<id>) away, never below 0' },
  quest: { args: ['id', 'stage'], about: 'move a quest to a stage' },
  battle: { args: ['trainer'], checkpoint: true, about: 'battle a trainer; the script goes on after it' },
  heal: { args: [], about: 'heal the team' },
  walk: { args: ['who', '...'], about: 'walk someone in the scene: "walk Blake beside me" (after camera run-up)' },
  face: { args: ['who', 'dir'], about: 'turn someone (up, down, side, sideR, or toward someone)' },
  camera: { args: ['...'], about: 'a camera shot: "run-up" (someone runs up to you in the walk scene)' },
  wait: { args: ['s'], about: 'wait, in seconds' },
  music: { args: ['piece'], about: 'play a piece of music (rival, title, ...: sound.js)' },
  fade: { args: ['dir?'], about: 'fade the screen out, or back in' },
  go: { args: ['place', 'entrance?'], checkpoint: true, about: 'go to a place' },
  call: { args: ['script'], about: 'play another script, then go on' },
  end: { args: [], about: 'stop the script here' },
  /* the openings' commands (Project Story S5, S7): the stage plays them */
  shot: { args: ['...'], opening: true, about: 'a camera shot of the opening' },
  'dressing-room': { args: [], opening: true, checkpoint: true, about: 'open the dressing room' },
  'pick-starter': { args: [], opening: true, checkpoint: true, about: 'the starter pick' },
  'hot-take': { args: ['...'], opening: true, about: 'one of Hazel’s hot takes' },
  tip: { args: ['...'], opening: true, about: 'a HOT TIP card in battle' },
  fall: { args: [], opening: true, checkpoint: true, about: 'the fall through the crust' },
};
export const KEYWORDS = ['choice', 'if', 'elif', 'else', 'once', 'cycle', 'seq'];
/** the slots a line may hold, filled in as it is said: {name} from the stage (o.slots), the counts from the save */
export const SCRIPT_SLOTS = {
  name: 'your name (Trainer before you have one)',
  caught: 'kinds of Billie caught (the Index)',
  badges: 'badges won',
};

/** an error in a script, with the line (from 0) it is on @param {string} message @param {number} line */
export function scriptError(message, line) {
  return Object.assign(new Error(message), { name: 'ScriptError', line });
}

/** @param {string} s @param {number} line */
export function sayLine(s, line) {
  /** @type {SayNode} */
  const n = { k: 'say', line, who: null, expr: null, text: s };
  const e = /^\[([\w-]+)\]\s*/.exec(n.text);
  if (e) [n.expr, n.text] = [e[1], n.text.slice(e[0].length)];
  const w = /^([A-Za-z][\w-]*):\s+/.exec(n.text);
  if (w) [n.who, n.text] = [w[1], n.text.slice(w[0].length)];
  if (!n.text) throw scriptError('a line with nothing to say', line);
  for (const [, k] of n.text.matchAll(/\{(\w*)\}/g))
    if (!(k in SCRIPT_SLOTS)) {
      const near = didYouMean(k, Object.keys(SCRIPT_SLOTS));
      throw scriptError(`unknown slot "{${k}}"${near ? `, did you mean "{${near}}"?` : ''}`, line);
    }
  return n;
}
/** @param {string} cond @param {number} line */
export function checkedCondition(cond, line) {
  if (!cond) throw scriptError('a condition expected', line);
  const p = conditionProblem(cond);
  if (p) throw scriptError(`${p.message} (in "${cond}", at ${(p.col || 0) + 1})`, line);
  return cond;
}

/** reads a script into its tree; throws a scriptError with the line @param {string[]} lines @returns {ScriptNode[]} */
export function parseScript(lines) {
  if (!Array.isArray(lines)) throw scriptError('a script is a list of lines', 0);
  /** @type {{ ind: number, s: string, line: number }[]} */
  const L = [];
  lines.forEach((raw, line) => {
    if (typeof raw !== 'string') throw scriptError('every line is a string', line);
    if (!raw.trim()) return;
    if (/^\s*\t/.test(raw)) throw scriptError('indent with spaces, not tabs', line);
    const ind = raw.length - raw.trimStart().length;
    if (ind % 2) throw scriptError('indented by an odd number of spaces (two per level)', line);
    L.push({ ind, s: raw.trim(), line });
  });
  let p = 0;
  /** the lines at exactly this indent, and everything under them @param {number} ind @returns {ScriptNode[]} */
  const block = ind => {
    /** @type {ScriptNode[]} */
    const out = [];
    while (p < L.length && L[p].ind >= ind) {
      const { s, line } = L[p];
      if (L[p].ind > ind) throw scriptError('indented further than the line above allows', line);
      p++;
      const m = /^([a-z][a-z-]*)(?:\s+(.*))?$/.exec(s),
        word = m ? m[1] : '',
        rest = m ? (m[2] || '').trim() : '';
      if (s.startsWith('>')) throw scriptError('an option ("> ...") belongs right under a choice', line);
      if (/^-(\s|$)/.test(s)) throw scriptError('an entry ("- ...") belongs right under cycle or seq', line);
      if (!m) {
        out.push(sayLine(s, line));
        continue;
      }
      if (word === 'choice') {
        if (rest) throw scriptError('"choice" stands alone; its options go under it', line);
        out.push({ k: 'choice', line, options: options(ind + 2, line) });
      } else if (word === 'if') {
        /** @type {IfNode} */
        const n = { k: 'if', line, clauses: [{ cond: checkedCondition(rest, line), body: body(ind + 2, line) }] };
        while (p < L.length && L[p].ind === ind && /^(elif|else)\b/.test(L[p].s)) {
          const { s: s2, line: l2 } = L[p++],
            [, w2, c2] = /** @type {RegExpExecArray} */ (/^(elif|else)\s*(.*)$/.exec(s2));
          if (n.clauses.at(-1)?.cond === null) throw scriptError(`"${w2}" after "else"`, l2);
          if (w2 === 'else' && c2) throw scriptError('"else" takes no condition (use "elif")', l2);
          n.clauses.push({ cond: w2 === 'elif' ? checkedCondition(c2, l2) : null, body: body(ind + 2, l2) });
        }
        out.push(n);
      } else if (word === 'elif' || word === 'else') throw scriptError(`"${word}" without an "if" above it`, line);
      else if (word === 'once') out.push({ k: 'once', line, key: key(rest, line), body: body(ind + 2, line) });
      else if (word === 'cycle' || word === 'seq')
        out.push({ k: word, line, key: key(rest, line), entries: entries(ind + 2, line, word) });
      else if (word in SCRIPT_COMMANDS) out.push(command(word, rest, line));
      else {
        const near = didYouMean(word, [...KEYWORDS, ...Object.keys(SCRIPT_COMMANDS)]);
        throw scriptError(
          `unknown command "${word}"${near ? `, did you mean "${near}"?` : ' (a line of dialogue starts with a capital, [expression] or Name:)'}`,
          line
        );
      }
    }
    return out;
  };
  /** @param {number} ind @param {number} line */
  const body = (ind, line) => {
    const b = p < L.length && L[p].ind === ind ? block(ind) : [];
    if (!b.length) throw scriptError('nothing under it (indent the lines it holds by two more spaces)', line);
    return b;
  };
  /** @param {string} rest @param {number} line */
  const key = (rest, line) => {
    if (rest && !/^[\w.:-]+$/.test(rest)) throw scriptError(`"${rest}" isn't a key (letters, digits, _ . : -)`, line);
    return rest || null;
  };
  /** @param {number} ind @param {number} line */
  const options = (ind, line) => {
    /** @type {ChoiceOption[]} */
    const out = [];
    while (p < L.length && L[p].ind === ind && L[p].s.startsWith('>')) {
      const { s, line: l } = L[p++];
      let t = s.slice(1).trim(),
        cond = /** @type {string | null} */ (null),
        once = false,
        m;
      while ((m = /^\[(if\s+[^\]]*|once)\]\s*/.exec(t))) {
        if (m[1] === 'once') once = true;
        else cond = checkedCondition(m[1].slice(2).trim(), l);
        t = t.slice(m[0].length);
      }
      if (!t) throw scriptError('an option with no text', l);
      out.push({ text: t, cond, once, line: l, body: p < L.length && L[p].ind > ind ? block(ind + 2) : [] });
    }
    if (p < L.length && L[p].ind === ind) throw scriptError('only options ("> ...") go under a choice', L[p].line);
    if (out.length < 1) throw scriptError('a choice needs options ("> ..." under it)', line);
    return out;
  };
  /** an entry's first line stands after "- " (two places in), the rest of it under that @param {number} ind
   * @param {number} line @param {string} word */
  const entries = (ind, line, word) => {
    /** @type {ScriptNode[][]} */
    const out = [];
    while (p < L.length && L[p].ind === ind && /^-(\s|$)/.test(L[p].s)) {
      const first = L[p];
      const s = first.s.slice(1).trim();
      if (!s) throw scriptError('an entry with nothing in it', first.line);
      L[p] = { ind: ind + 2, s, line: first.line };
      out.push(block(ind + 2));
    }
    if (p < L.length && L[p].ind === ind) throw scriptError(`only entries ("- ...") go under ${word}`, L[p].line);
    if (!out.length) throw scriptError(`${word} needs entries ("- ..." under it)`, line);
    return out;
  };
  /** @param {string} name @param {string} rest @param {number} line @returns {CmdNode} */
  const command = (name, rest, line) => {
    const spec = /** @type {Record<string, { args: string[] }>} */ (SCRIPT_COMMANDS)[name].args,
      args = rest ? rest.split(/\s+/) : [],
      rest_ = spec.includes('...'),
      need = spec.filter(a => !a.endsWith('?') && a !== '...').length;
    if (args.length < need || (!rest_ && args.length > spec.length))
      throw scriptError(`"${name}" takes ${spec.length ? spec.join(' ') : 'nothing'}`, line);
    spec.forEach((a, i) => {
      const v = args[i],
        b = a.replace('?', '');
      if (v != null && ['n', 's'].includes(b) && !/^-?\d+(\.\d+)?$/.test(v))
        throw scriptError(`"${name}": ${b} is a number, not "${v}"`, line);
    });
    return { k: 'cmd', line, name, args };
  };
  const tree = block(0);
  if (p < L.length) throw scriptError('indented further than the line above allows', L[p].line);
  return tree;
}

/** null if the script reads, else its error and line @param {string[]} lines */
export function scriptProblem(lines) {
  try {
    parseScript(lines);
    return null;
  } catch (e) {
    const err = /** @type {Error & { line?: number }} */ (e);
    if (err.name === 'ScriptError') return { message: err.message, line: err.line };
    throw e;
  }
}

/* ---------- the runner ----------
   A stage is what plays the lines: say({ who, expr, text, line }), choose(options) -> index, and a function per
   command it plays (battle, walk, camera, ...). The runner changes the save itself (flags, items, coins, quests, once,
   cycles), through `save` (the game's saveData, or a test's object).
   Where it is: a path of numbers, [statement, branch, statement, branch, ..., statement]: the branch is the clause
   of an if, the option of a choice, the entry of a cycle, 0 for once and call. After a checkpoint command the
   runner hands onCheckpoint the path of the statement after it, and a run started with that path (resume) carries
   on from there without asking again (conditions, choices and counters are not read twice). */

/** @typedef {{ say: (l: { who: string | null, expr: string | null, text: string, line: number }) => any,
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
  const keyOf = (/** @type {{ key?: string | null, line: number }} */ n) => n.key || `${id}@${n.line}`;
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
          await stage.say({ who: n.who || o.speaker || null, expr: n.expr, text: fill(n.text), line: n.line });
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
              .filter(({ op }) => (!op.cond || holds(op.cond)) && !(op.once && taken[`${id}@${op.line}`]));
          if (!shown.length) return -1;
          /* skipping: the first option shown, the one a hurried tap would take */
          const pick = control.skipping
            ? 0
            : await stage.choose(shown.map(({ op }) => ({ text: op.text, line: op.line })));
          const c = shown[Math.max(0, Math.min(shown.length - 1, pick | 0))];
          if (c.op.once) taken[`${id}@${c.op.line}`] = 1;
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
    const [a, b] = n.args,
      count = (/** @type {string | undefined} */ s) => (s == null ? 1 : +s);
    const bag = (/** @type {string} */ thing) =>
      thing.startsWith('coin:')
        ? { o: save.coins || (save.coins = {}), k: thing.slice(5) }
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
      case 'shot':
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
   A script changes the save as it runs, but a save taken halfway through stores the story, items, coins and trainers
   beaten as they were when it started (or at its last checkpoint), with `resume` saying which script to play again
   on Continue and from where. */
/** what JSON.stringify(save) writes while a script runs @param {any} save
 * @param {{ story: any, items: any, coins: any, flags: any }} base @param {{ script: string, path: number[] | null }} at */
export function saveDuringRun(save, base, at) {
  return { ...save, ...base, story: { ...base.story, resume: at } };
}
/** the parts of a save a safe run keeps aside, copied @param {any} save */
export function runBase(save) {
  return JSON.parse(
    JSON.stringify({
      story: save.story || {},
      items: save.items || {},
      coins: save.coins || {},
      flags: save.flags || {},
    })
  );
}

/* ---------- start presets (story.json presets, ?story=<preset> in a test run) ---------- */
/** puts a started save at a point in the story: the place, story flags, trainers beaten (a leader's badge with them),
 * coins, items and the team; returns the preset, or null if there is none by that name
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
  Object.assign(save.coins, P.coins || {});
  Object.assign(save.items, P.items || {});
  save.team = P.team.map((/** @type {{ sp: string, lvl: number }} */ m) => makeBilly(m.sp, m.lvl));
  save.buddy = save.team[0].uid;
  for (const m of save.team) save.caught[m.sp] = save.seen[m.sp] = 1;
  return P;
}
