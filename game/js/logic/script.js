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
   Indentation is two spaces inside the strings. A line that starts with a small letter is a command or a keyword; an
   unknown one is an error with "did you mean", never a line of dialogue. Logic only: no DOM, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { conditionHolds, conditionProblem, conditionTree, didYouMean, storyStateOf } from './conditions.js';
/* eslint-disable no-func-assign */
expose({
  END: [() => END],
  KEYWORDS: [() => KEYWORDS],
  SCRIPT_COMMANDS: [() => SCRIPT_COMMANDS],
  // @ts-expect-error -- replaced on purpose
  checkedCondition: [() => checkedCondition, v => (checkedCondition = v)],
  // @ts-expect-error -- replaced on purpose
  parseScript: [() => parseScript, v => (parseScript = v)],
  // @ts-expect-error -- replaced on purpose
  runScript: [() => runScript, v => (runScript = v)],
  // @ts-expect-error -- replaced on purpose
  sayLine: [() => sayLine, v => (sayLine = v)],
  // @ts-expect-error -- replaced on purpose
  scriptError: [() => scriptError, v => (scriptError = v)],
  // @ts-expect-error -- replaced on purpose
  scriptProblem: [() => scriptProblem, v => (scriptProblem = v)],
});
/* eslint-enable no-func-assign */
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
  walk: { args: ['who', 'x', 'z', 'ms?'], about: 'walk someone to a spot in the scene' },
  face: { args: ['who', 'dir'], about: 'turn someone (up, down, side, sideR, or toward someone)' },
  camera: { args: ['...'], about: 'move the camera (a named shot, or follow / back)' },
  wait: { args: ['s'], about: 'wait, in seconds' },
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
      if (v != null && ['n', 's', 'x', 'z', 'ms'].includes(b) && !/^-?\d+(\.\d+)?$/.test(v))
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
 *   onCheckpoint?: (path: number[]) => void, control?: { skipping: boolean } }} RunOptions */

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
          await stage.say({ who: n.who || o.speaker || null, expr: n.expr, text: n.text, line: n.line });
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
