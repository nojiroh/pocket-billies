// @ts-check
'use strict';
/* ================= STORY SCRIPTS: READING (Project Story S1; apart from the runner in S3) =================
   The script format's tables (commands, keywords, slots, line ids) and the parser that reads a script's lines into a
   tree, with errors that name the line (docs/SCRIPTS.md). Kept apart from the runner (script.js), which needs the
   game's data and save, so the Studio and the data check can read and check scripts with this file and
   conditions.js alone. Logic only: no DOM, no game data, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { CONDITION_KINDS, conditionProblem, didYouMean } from './conditions.js';
import { cutsceneStep } from './cutscene-set.js';
/* eslint-disable no-func-assign */
expose({
  KEYWORDS: [() => KEYWORDS],
  KEYWORD_ABOUT: [() => KEYWORD_ABOUT],
  LINE_ID: [() => LINE_ID],
  SCRIPT_COMMANDS: [() => SCRIPT_COMMANDS],
  SCRIPT_SLOTS: [() => SCRIPT_SLOTS],
  // @ts-expect-error -- replaced on purpose
  checkedCondition: [() => checkedCondition, v => (checkedCondition = v)],
  firstId: [() => firstId],
  // @ts-expect-error -- replaced on purpose
  parseScript: [() => parseScript, v => (parseScript = v)],
  // @ts-expect-error -- replaced on purpose
  sayLine: [() => sayLine, v => (sayLine = v)],
  // @ts-expect-error -- replaced on purpose
  scriptError: [() => scriptError, v => (scriptError = v)],
  // @ts-expect-error -- replaced on purpose
  scriptProblem: [() => scriptProblem, v => (scriptProblem = v)],
  // @ts-expect-error -- replaced on purpose
  scriptReference: [() => scriptReference, v => (scriptReference = v)],
  withoutId: [() => withoutId],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{ k: 'say', line: number, who: string | null, expr: string | null, text: string, id?: string }} SayNode */
/** @typedef {{ k: 'cmd', line: number, name: string, args: string[] }} CmdNode */
/** @typedef {{ text: string, cond: string | null, once: boolean, line: number, body: ScriptNode[], id?: string }} ChoiceOption */
/** @typedef {{ k: 'choice', line: number, options: ChoiceOption[] }} ChoiceNode */
/** @typedef {{ k: 'if', line: number, clauses: { cond: string | null, body: ScriptNode[] }[] }} IfNode */
/** @typedef {{ k: 'once', line: number, key: string | null, body: ScriptNode[], lid?: string }} OnceNode */
/** @typedef {{ k: 'cycle' | 'seq', line: number, key: string | null, entries: ScriptNode[][], lid?: string }} CycleNode */
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
  heal: { args: ['s?'], about: 'heal the team (an event: that share of each Billie’s HP, "heal 0.5")' },
  walk: {
    args: ['who', '...'],
    about:
      'walk someone: in a cutscene "walk Hazel door 1.5 [nowait]" (waits till they arrive unless nowait); in the walk scene "walk Blake beside me" (after camera run-up)',
  },
  face: { args: ['who', 'dir'], about: 'turn someone (up, down, side, sideR, or toward someone)' },
  camera: {
    args: ['...'],
    about:
      'a camera shot: in a cutscene one of its shots, "camera trio 1.1 [on Blake [you]]" (glides that many seconds, 0 cuts; doesn’t wait); in the walk scene "run-up" (someone runs up to you)',
  },
  wait: { args: ['seconds|who'], about: 'wait, in seconds; in a cutscene also "wait Blake": till Blake stops walking' },
  music: { args: ['piece'], about: 'play a piece of music (rival, title, ...: sound.js)' },
  fade: { args: ['dir?', 'colour?'], about: 'fade the screen out (to a colour, #0B0912), or back in' },
  go: { args: ['place', 'entrance?'], checkpoint: true, about: 'go to a place' },
  call: { args: ['script'], about: 'play another script, then go on' },
  pick: {
    args: ['who'],
    about:
      'say the story director’s line for who (banter.json, picked by the run history: RL-S1): chosen, hazel, juniper, back_lost, leader, bureau, rival (RL-S2); nothing if none fits',
  },
  /* RL-S2: the hub folk and you (logic/relations.js) */
  beans: { args: ['n'], about: 'give Beans, the gift currency, kept between runs (RL-S2): beans 1' },
  gift: {
    args: ['who'],
    about:
      'give a hub person a gift (RL-S2, relations.json): a Bean, points with them; nothing when you have too few Beans or gave them one since the last run (gate it with "[if beans >= 1 and not gifted:hazel]")',
  },
  rel: { args: ['who', 'n'], about: 'points with a hub person, as for a favour done (RL-S2): rel hazel 2' },
  chapter: {
    args: ['n'],
    about: 'move the story on to chapter n (RL-S2; never back): an Expedition’s boss scene, "chapter 2"',
  },
  end: { args: [], about: 'stop the script here' },
  /* a cutscene's own (game/data/cutscenes, docs/CUTSCENES.md: logic/cutscene-set.js reads them) */
  actor: {
    args: ['who', 'at', 'spot', '...'],
    group: 'cutscene',
    about: 'put someone in the scene: "actor Hazel at door down"; "actor you at street up silhouette" (a dark figure)',
  },
  act: {
    args: ['who', 'pose', 's?'],
    group: 'cutscene',
    about: 'a pose for a while: throw, cheer, react, reach (doesn’t wait)',
  },
  caption: {
    args: ['s', '...'],
    group: 'cutscene',
    about: 'a caption for a while: "caption 3.4 The Hollow Earth | {place}" (small line | big line; doesn’t wait)',
  },
  blink: { args: [], group: 'cutscene', about: 'the letterbox closes and opens like eyelids' },
  screen: { args: ['look'], group: 'cutscene', about: 'the look of the picture: dazed, waking, clear' },
  effect: {
    args: ['name', '...'],
    group: 'cutscene',
    about: 'a little effect: landing, sparkle; "effect landing at me"',
  },
  hide: {
    args: ['what', '...'],
    group: 'cutscene',
    about:
      'hide box: the dialogue box goes away; hide Blake: Blake leaves the scene; hide prop rift: the prop nearest that spot',
  },
  show: { args: ['what', '...'], group: 'cutscene', about: 'show Blake, show prop rift: back in the scene' },
  traffic: {
    args: ['lane', 'prop', 's', 'n?'],
    group: 'cutscene',
    about:
      'that many of a prop (a flying car) along one of the cutscene’s lanes, end to end in s seconds, again and again (doesn’t wait)',
  },
  sound: { args: ['effect'], group: 'cutscene', about: 'a sound effect (throw, pop, hit: sound.js)' },
  /* RL-12b: an event's own (events.json, logic/encounters.js), on a run */
  perk: {
    args: ['rarity?'],
    group: 'event',
    about: 'offer one Perk: any, or of a rarity (common, uncommon, rare), or a Perk by id; past the cap you let one go',
  },
  money: { args: ['n'], group: 'event', about: 'Moneys gained, or lost with a minus (never below 0): "money -50"' },
  hurt: { args: ['s'], group: 'event', about: 'every Billie standing loses that share of its HP, never past 1 HP' },
  status: { args: ['id'], group: 'event', about: 'every Billie standing without one gets a status (par, slp, brn)' },
  fx: {
    args: ['n', 'kind', '...'],
    group: 'event',
    about:
      'an effect row (perks.json’s kinds) for this place and n more: "fx 3 price what=shop mult=1.25", "fx 1 stat stat=hus stages=1"',
  },
  wager: {
    args: ['n'],
    group: 'event',
    about: 'a chance in percent from the run’s stream: sets the flag wager to win or lose ("if wager = win")',
  },
  loot: { args: ['table', 'n?'], group: 'event', about: 'items drawn from a loot table (events.json loot)' },
  level: {
    args: ['n'],
    group: 'event',
    about: 'a Billie of the team, drawn from the run’s stream, gains or loses levels',
  },
  recall: {
    args: ['n?'],
    group: 'event',
    checkpoint: true,
    about: 'you pick a Billie to give up; a Billie of the region’s dex takes its place, n levels up',
  },
  foe: {
    args: ['class', 'n?'],
    group: 'event',
    checkpoint: true,
    about: 'battle a trainer of a class (events.json classes), its levels the place’s plus n; lost, the run ends',
  },
  wild: {
    args: ['n?'],
    group: 'event',
    checkpoint: true,
    about: 'a wild battle with a Billie of the region, n levels up',
  },
  reward: {
    args: ['kind?', 'n?'],
    group: 'event',
    checkpoint: true,
    about: 'a reward pick (rewards.json): of every kind, or of one (item, tutor, candy, evo), n cards',
  },
  /* the opening's own (cutscene/opening.js) */
  'dressing-room': {
    args: [],
    group: 'opening',
    checkpoint: true,
    about: 'you make yourself up (skipping stops here)',
  },
  'throw-coins': { args: [], group: 'opening', about: 'the professor’s three pyramids pop open into the starters' },
  'pick-starter': {
    args: [],
    group: 'opening',
    checkpoint: true,
    about: 'the starter pick (skipping stops here); {starter} and {counter} after it',
  },
  'staged-fight': {
    args: [],
    group: 'opening',
    about: 'the Chosen fights Blake himself, staged (Project Story S6 makes it a real battle); {foe} after it',
  },
  'rival-battle': { args: [], group: 'opening', about: 'Blake’s battle starts when the opening ends' },
  fall: { args: [], group: 'opening', checkpoint: true, about: 'the fall through the crust' },
};
/** the keywords, with how each is written and what it does, for the Studio's reference (S3) */
export const KEYWORD_ABOUT = {
  choice: ['choice', 'a choice: its options go under it as "> text", the lines under each indented two more'],
  if: ['if cond', 'the lines under it only when the condition holds'],
  elif: ['elif cond', 'after an if: when the ones above didn’t hold and this does'],
  else: ['else', 'after an if: when none above held'],
  once: ['once [key]', 'the lines under it the first time only'],
  cycle: ['cycle [key]', 'a different "- " entry each time, then from the first again'],
  seq: ['seq [key]', 'a different "- " entry each time, staying on the last'],
};
export const KEYWORDS = Object.keys(KEYWORD_ABOUT);
/** a line's id at its end, " #l:3fa9" (tools/story-ids.mjs gives them): kept when the text changes or moves */
export const LINE_ID = /\s+#l:([0-9a-z]{4,8})$/;
/** a text and its line id, apart @param {string} t @returns {[string, string | null]} */
export const withoutId = t => {
  const m = LINE_ID.exec(t);
  return m ? [t.slice(0, m.index), m[1]] : [t, null];
};
/** the first line id in a block, for once / cycle / seq without a key @param {ScriptNode[]} b @returns {string | undefined} */
export const firstId = b => {
  for (const n of b) {
    const id =
      n.k === 'say'
        ? n.id
        : n.k === 'choice'
          ? n.options.map(o => o.id || firstId(o.body)).find(Boolean)
          : n.k === 'if'
            ? n.clauses.map(c => firstId(c.body)).find(Boolean)
            : n.k === 'once'
              ? n.lid
              : n.k === 'cycle' || n.k === 'seq'
                ? n.lid
                : undefined;
    if (id) return id;
  }
};
/** the slots a line may hold, filled in as it is said: {name} from the stage (o.slots), the counts from the save */
export const SCRIPT_SLOTS = {
  name: 'your name (Trainer before you have one)',
  caught: 'kinds of Billie caught (the Index)',
  badges: 'badges won',
  /* the opening's (cutscene/opening.js) */
  place: 'the place a cutscene is filmed in (Copperleaf Town)',
  starter: 'the opening: the Billie you picked',
  counter: 'the opening: the one Blake takes, that beats yours',
  foe: 'the opening: Blake’s first Billie, the one the Chosen flattens',
};

/** an error in a script, with the line (from 0) it is on @param {string} message @param {number} line */
export function scriptError(message, line) {
  return Object.assign(new Error(message), { name: 'ScriptError', line });
}

/** @param {string} s @param {number} line */
export function sayLine(s, line) {
  const [t, id] = withoutId(s);
  /** @type {SayNode} */
  const n = { k: 'say', line, who: null, expr: null, text: t };
  if (id) n.id = id;
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
      else if (word === 'once') {
        /** @type {OnceNode} */
        const n = { k: 'once', line, key: key(rest, line), body: body(ind + 2, line) },
          lid = firstId(n.body);
        if (lid) n.lid = lid;
        out.push(n);
      } else if (word === 'cycle' || word === 'seq') {
        /** @type {CycleNode} */
        const n = { k: word, line, key: key(rest, line), entries: entries(ind + 2, line, word) },
          lid = firstId(n.entries.flat());
        if (lid) n.lid = lid;
        out.push(n);
      } else if (word in SCRIPT_COMMANDS) out.push(command(word, rest, line));
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
      let [t, oid] = withoutId(s.slice(1).trim()),
        cond = /** @type {string | null} */ (null),
        once = false,
        m;
      while ((m = /^\[(if\s+[^\]]*|once)\]\s*/.exec(t))) {
        if (m[1] === 'once') once = true;
        else cond = checkedCondition(m[1].slice(2).trim(), l);
        t = t.slice(m[0].length);
      }
      if (!t) throw scriptError('an option with no text', l);
      /** @type {ChoiceOption} */
      const op = { text: t, cond, once, line: l, body: p < L.length && L[p].ind > ind ? block(ind + 2) : [] };
      if (oid) op.id = oid;
      out.push(op);
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
    /** @type {CmdNode} */
    const n = { k: 'cmd', line, name, args };
    /* a cutscene's own commands read the same way here, in the stage and in the Studio (logic/cutscene-set.js) */
    if (/** @type {Record<string, { group?: string }>} */ (SCRIPT_COMMANDS)[name].group === 'cutscene') {
      const p = cutsceneStep(n).problem;
      if (p) throw scriptError(p, line);
    }
    for (const a of args)
      for (const [, k] of a.matchAll(/\{(\w*)\}/g))
        if (!(k in SCRIPT_SLOTS)) throw scriptError(`unknown slot "{${k}}"`, line);
    return n;
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

/** the format at a glance, built from the tables above and conditions.js (the Studio's command reference), so it
 * can't drift from what the parser reads: [{ title, rows: [{ use, about, tag }] }] */
export function scriptReference() {
  /** @param {string[]} args */
  const usage = args => args.map(a => (a.endsWith('?') ? `[${a.slice(0, -1)}]` : a === '...' ? '…' : a)).join(' ');
  const C = /** @type {Record<string, { args: string[], about: string, group?: string, checkpoint?: boolean }>} */ (
    SCRIPT_COMMANDS
  );
  const commands = (/** @type {string | undefined} */ group) =>
    Object.entries(C)
      .filter(([, c]) => c.group === group)
      .map(([k, c]) => ({
        use: `${k} ${usage(c.args)}`.trim(),
        about: c.about,
        tag: c.checkpoint ? 'checkpoint' : '',
      }));
  const K = /** @type {Record<string, { id: boolean, count: boolean, about: string }>} */ (CONDITION_KINDS);
  return [
    {
      title: 'Lines',
      rows: [
        { use: 'Text', about: 'a line said by the one you talk to', tag: '' },
        { use: 'Name: text', about: 'a line said by someone else (story.json speakers)', tag: '' },
        { use: '[happy] Name: text', about: 'with an expression on their portrait', tag: '' },
        ...Object.entries(SCRIPT_SLOTS).map(([k, about]) => ({ use: `{${k}}`, about, tag: 'slot' })),
      ],
    },
    {
      title: 'Blocks',
      rows: [
        ...Object.values(KEYWORD_ABOUT).map(([use, about]) => ({ use, about, tag: '' })),
        { use: '> [if cond] text', about: 'an option shown only when the condition holds', tag: '' },
        { use: '> [once] text', about: 'an option that goes away once picked', tag: '' },
      ],
    },
    { title: 'Commands', rows: commands(undefined) },
    { title: 'Cutscene commands', rows: commands('cutscene') },
    { title: 'Opening commands', rows: commands('opening') },
    { title: 'Event commands', rows: commands('event') },
    {
      title: 'Conditions',
      rows: [
        { use: 'flag', about: 'a story flag is set (!flag or not flag: it isn’t)', tag: '' },
        { use: 'flag = word', about: 'a flag set to a word or number', tag: '' },
        ...Object.entries(K).map(([k, c]) => ({
          use: c.id ? `${k}:id${c.count ? ' >= n' : ''}` : `${k}${c.count ? ' >= n' : ''}`,
          about: c.about,
          tag: '',
        })),
        { use: 'a and b, a or b, (a or b)', about: 'combined; a count alone means more than 0', tag: '' },
      ],
    },
  ];
}
