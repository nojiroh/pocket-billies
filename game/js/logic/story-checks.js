// @ts-check
'use strict';
/* ================= STORY CHECKS (Project Story S2; one check for the Studio and the command line since S3) =========
   check-data.mjs (through tools/story-checks.mjs) and the Studio run these on the whole game data;
   tools/test/story-checks.test.mjs plants a fault for each. Problems fail the data check; warnings are listed.
   Problems: a script that doesn't read (file, line), a line without a line id or one used twice, a speaker, trainer,
   place, item, coin, Billie or script that doesn't exist, a quest stage that isn't one of the quest's, a condition
   (when, unless, requires, a chapter's when) that doesn't read, a place whose `requires` can never come true where
   the player can get to (the reach check).
   Warnings: a flag read but set nowhere (no script sets it and story.json doesn't list it, so the game doesn't
   either), a flag a script sets that story.json doesn't list, a flag set but read nowhere, items taken but never
   given, a once key two scripts share, a quest stage nothing moves to.
   Line ids (tools/story-ids.mjs gives them from the command line, the Studio from its script fields): every line of
   dialogue and every choice option ends with " #l:3fa9". Logic only: no DOM, no game data of its own, runs in Node. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { HISTORY_FACTS, LAST_FACTS, LOST_TO_KINDS } from './run-history.js';
import { conditionHolds, conditionNames, conditionProblem, conditionTree, storyStateOf } from './conditions.js';
import { CUTSCENE_YOU, cutsceneNames, cutsceneStep } from './cutscene-set.js';
import { LINE_ID, SCRIPT_COMMANDS, parseScript } from './script-parse.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  giveLineIds: [() => giveLineIds, v => (giveLineIds = v)],
  // @ts-expect-error -- replaced on purpose
  lineIdProblems: [() => lineIdProblems, v => (lineIdProblems = v)],
  // @ts-expect-error -- replaced on purpose
  lineKind: [() => lineKind, v => (lineKind = v)],
  // @ts-expect-error -- replaced on purpose
  scriptsOf: [() => scriptsOf, v => (scriptsOf = v)],
  // @ts-expect-error -- replaced on purpose
  storyChecks: [() => storyChecks, v => (storyChecks = v)],
  // @ts-expect-error -- replaced on purpose
  storyFindings: [() => storyFindings, v => (storyFindings = v)],
  // @ts-expect-error -- replaced on purpose
  storyNamesIn: [() => storyNamesIn, v => (storyNamesIn = v)],
  // @ts-expect-error -- replaced on purpose
  storyPreviewAllows: [() => storyPreviewAllows, v => (storyPreviewAllows = v)],
  // @ts-expect-error -- replaced on purpose
  storyPreviewSave: [() => storyPreviewSave, v => (storyPreviewSave = v)],
  // @ts-expect-error -- replaced on purpose
  storySwitches: [() => storySwitches, v => (storySwitches = v)],
  storySwitchesOf: [() => storySwitchesOf],
  storySwitchesText: [() => storySwitchesText],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what a line of a script is, for ids: 'say' (dialogue), 'option' (> text), or null (a command or a keyword) */
export function lineKind(raw) {
  let s = raw.trim();
  if (s.startsWith('>')) return 'option';
  if (/^-(\s|$)/.test(s)) s = s.slice(1).trim();
  if (!s || /^[a-z][a-z-]*(\s|$)/.test(s)) return null;
  return 'say';
}
/** the lines without an id, and the ids used twice: [{ script, line, problem }] */
export function lineIdProblems(scripts) {
  const seen = new Map(),
    out = [];
  for (const sc of scripts)
    sc.lines.forEach((raw, i) => {
      if (typeof raw !== 'string' || !lineKind(raw)) return;
      const m = LINE_ID.exec(raw);
      if (!m) return out.push({ script: sc.id, line: i, problem: 'has no line id (npm run story:ids)' });
      if (seen.has(m[1]))
        out.push({ script: sc.id, line: i, problem: `line id ${m[1]} is also ${seen.get(m[1])} (npm run story:ids)` });
      else seen.set(m[1], `${sc.id} line ${i + 1}`);
    });
  return out;
}
/** gives each line without an id (or with an id seen before) a new one; returns how many. idOf(seed): a hex string
 * made from the seed (story-ids.mjs: sha1; the Studio: its own), cut to 4 characters (6 after 50 tries) */
export function giveLineIds(scripts, idOf) {
  const used = new Set();
  for (const sc of scripts)
    for (const raw of sc.lines) {
      const m = LINE_ID.exec(raw);
      if (m) used.add(m[1]);
    }
  const seen = new Set();
  let n = 0;
  for (const sc of scripts) {
    const L = sc.lines.map((raw, i) => {
      if (typeof raw !== 'string' || !lineKind(raw)) return raw;
      const m = LINE_ID.exec(raw);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        return raw;
      }
      const text = m ? raw.slice(0, m.index) : raw.trimEnd();
      let id,
        k = 0;
      do id = idOf(`${sc.id}|${i}|${text}|${k++}`).slice(0, k > 50 ? 6 : 4);
      while (used.has(id));
      used.add(id);
      seen.add(id);
      n++;
      return `${text} #l:${id}`;
    });
    sc.put(L);
    sc.lines = L;
  }
  return n;
}

/** every script in the game data: { id, where, owner, lines, place } (place: the location id it is met at) */
export function scriptsOf(G) {
  const out = [],
    placeOfMap = Object.fromEntries(G.locations.filter(l => l.mapId).map(l => [l.mapId, l.id]));
  for (const [mid, M] of Object.entries(G.maps || {}))
    for (const P of M.people || [])
      if (P.script)
        out.push({
          id: 'person:' + P.id,
          where: `maps/${mid}.json`,
          owner: P,
          lines: P.script,
          place: placeOfMap[mid],
        });
  for (const [id, T] of Object.entries(G.trainers || {}))
    if (T.script)
      out.push({
        id: 'trainer:' + id,
        where: `trainers/${id}.json`,
        owner: T,
        lines: T.script,
        place: (G.locations[T.node] || {}).id,
      });
  for (const [k, v] of Object.entries((G.story || {}).scripts || {}))
    out.push({ id: 'story:' + k, where: 'story.json', owner: v, lines: v.script, place: null });
  /* RL-S1: the story director's lines (banter.json; logic/story-pick.js) */
  for (const [k, v] of Object.entries(G.banter || {}))
    out.push({ id: 'banter:' + k, where: 'banter.json', owner: v, lines: v.script, place: null });
  for (const [k, C] of Object.entries(G.cutscenes || {}))
    out.push({
      id: 'cutscene:' + k,
      where: `cutscenes/${k}.json`,
      owner: C,
      lines: C.script,
      place: null,
      cutscene: C,
    });
  return out;
}

/** where a finding is: its file, the script (person:<id>, trainer:<id>, story:<key>) and line (from 0) when it is in
 * one, the thing and field when it is a condition (when, unless, requires); written as the label in the text
 * @typedef {{ file: string | null, script?: string, line?: number, thing?: string, field?: string }} StorySpot */
/** one finding: level problem (fails the data check) or warning, where, the message, and the text check-data prints
 * @typedef {StorySpot & { level: 'problem' | 'warning', message: string, text: string }} StoryFinding */

/** the checks as strings, for check-data.mjs and the tests @returns {{ problems: string[], warnings: string[] }} */
export function storyChecks(G, L = undefined) {
  const F = storyFindings(G, L);
  return {
    problems: F.filter(f => f.level === 'problem').map(f => f.text),
    warnings: F.filter(f => f.level === 'warning').map(f => f.text),
  };
}

/** the checks, each finding with where it is (the Studio points at the field and line); L: the logic they use
 * (parseScript, conditionTree, conditionProblem, conditionNames; the tests may hand in their own)
 * @returns {StoryFinding[]} */
export function storyFindings(G, L = { parseScript, conditionTree, conditionProblem, conditionNames }) {
  /** @type {StoryFinding[]} */
  const found = [];
  /** a spot reads as its label in a text @param {string} label @param {StorySpot} o */
  const spot = (label, o) => ({ ...o, toString: () => label });
  /** @param {'problem' | 'warning'} level @param {any} at @param {string} message */
  const add = (level, at, message) => {
    const { toString, ...where } = typeof at === 'string' ? { file: null, toString: null } : at;
    found.push({ level, ...where, message, text: `${at}: ${message}` });
  };
  const problems = { push: (/** @type {any} */ at, /** @type {string} */ m) => add('problem', at, m) },
    warnings = { push: (/** @type {any} */ at, /** @type {string} */ m) => add('warning', at, m) };
  const S = G.story || {},
    places = new Set(G.locations.map(l => l.id)),
    trainers = G.trainers || {},
    items = G.items || {},
    pyramids = G.pyramids || {},
    speakers = S.speakers || {},
    quests = S.quests || {},
    lines = new Set((G.lines || []).map(l => l.id)),
    species = new Set((G.lines || []).flatMap(l => (l.names || []).map((_, i) => l.id + i)));
  /* a flag story.json lists (by name, by pattern, or a record it keeps), as logic/script.js storyFlagKnown reads it */
  const known = f =>
    f in (S.flags || {}) ||
    f in (S.kept || {}) ||
    Object.keys(S.patterns || {}).some(p => f.startsWith(p.slice(0, p.indexOf('<'))) && f.length > p.indexOf('<'));
  const scripts = scriptsOf(G),
    ids = new Set(scripts.map(s => s.id));
  const set = new Map(), // flag -> where set
    read = new Map(), // flag -> where read
    given = new Set(),
    taken = new Map(),
    onceKeys = new Map(),
    questSet = new Map(); // quest -> stages moved to
  const note = (m, k, at) => m.has(k) || m.set(k, at);

  /* a condition: reads, and its names exist */
  const condition = (c, at) => {
    const p = L.conditionProblem(c);
    if (p) return problems.push(at, `${p.message} (in "${c}")`);
    const N = L.conditionNames(L.conditionTree(c));
    for (const f of N.flag || []) note(read, f, at);
    for (const t of N.beat || []) if (!trainers[t]) problems.push(at, `beat:${t}, no such trainer`);
    for (const i of N.item || []) if (!items[i]) problems.push(at, `item:${i}, no such item`);
    for (const i of N.coin || []) if (!pyramids[i]) problems.push(at, `coin:${i}, no such coin`);
    for (const v of N.visited || []) if (!places.has(v)) problems.push(at, `visited:${v}, no such place`);
    for (const b of N.billie || [])
      if (!lines.has(b) && !species.has(b)) problems.push(at, `billie:${b}, no such Billie`);
    for (const q of N.quest || []) if (!quests[q]) problems.push(at, `quest:${q}, no such quest (story.json quests)`);
    for (const u of N.unlock || [])
      if (!(G.unlocks || {})[u]) problems.push(at, `unlock:${u}, no such unlock (unlocks.json)`);
    /* RL-S1: the run history's facts (logic/run-history.js) */
    for (const f of N.last || [])
      if (!LAST_FACTS.includes(f)) problems.push(at, `last:${f}, no such fact (${LAST_FACTS.join(', ')})`);
    for (const f of N.history || [])
      if (!HISTORY_FACTS.includes(f)) problems.push(at, `history:${f}, no such fact (${HISTORY_FACTS.join(', ')})`);
    for (const b of N.lastby || [])
      if (
        !LOST_TO_KINDS.includes(b) &&
        b !== 'bureau' &&
        !trainers[b] &&
        !((G.events || {}).classes || {})[b] &&
        !lines.has(b) &&
        !species.has(b)
      )
        problems.push(at, `lastby:${b}, not a kind of foe, a trainer, a class nor a Billie`);
    /* RL-S2: the team the last run ended with: a type, a line or a species */
    const typeIds = new Set((G.types || []).map((/** @type {any} */ t) => String(t.id).toLowerCase()));
    for (const t of N.lastteam || [])
      if (!typeIds.has(t.toLowerCase()) && !lines.has(t) && !species.has(t))
        problems.push(at, `lastteam:${t}, not a type, a line nor a Billie`);
    /* RL-S2: the hub folk (relations.json people) */
    const folk = (G.relations || {}).people || {};
    for (const k of ['rel', 'gifted'])
      for (const w of N[k] || [])
        if (!folk[w]) problems.push(at, `${k}:${w}, nobody in relations.json people (${Object.keys(folk).join(', ')})`);
  };
  const who = (w, at) => {
    if (w && !(w in speakers) && !(G.people || {})[w] && w !== 'me')
      problems.push(at, `speaker ${w}, not in story.json speakers nor a person`);
  };

  /* a cutscene's own commands: only in a cutscene; there, every spot, shot and person it names is its own or a
     speaker (logic/cutscene-set.js reads them) */
  const CMD = /** @type {Record<string, { group?: string }>} */ (SCRIPT_COMMANDS);
  const cutsceneChecks = (/** @type {any} */ sc, /** @type {any[]} */ tree) => {
    const at = (/** @type {number} */ line) =>
      spot(`${sc.where} ${sc.id}, line ${line + 1}`, { file: sc.where, script: sc.id, line });
    const C = sc.cutscene;
    const each = (/** @type {any[]} */ blk, /** @type {(n: any) => void} */ f) => {
      for (const n of blk) {
        f(n);
        for (const c of n.clauses || []) each(c.body, f);
        for (const o of n.options || []) each(o.body, f);
        if (n.body) each(n.body, f);
        for (const e of n.entries || []) each(e, f);
      }
    };
    if (!C) {
      each(tree, n => {
        if (n.k !== 'cmd') return;
        const g = CMD[n.name] && CMD[n.name].group;
        if (g) problems.push(at(n.line), `${n.name} plays only in a cutscene (game/data/cutscenes)`);
        else if (n.name === 'wait' && !/^\d+(\.\d+)?$/.test(n.args[0]))
          problems.push(at(n.line), `wait ${n.args[0]}: seconds (waiting for someone is a cutscene's)`);
      });
      return;
    }
    each(tree, n => {
      if (n.k !== 'cmd' || !['camera', 'walk', 'face', 'wait', 'fade'].includes(n.name)) return;
      const p = cutsceneStep(n).problem;
      if (p) problems.push(at(n.line), p);
    });
    const people = new Set([CUTSCENE_YOU, ...Object.keys(speakers)]);
    for (const x of cutsceneNames(tree)) {
      const ok =
        x.kind === 'shot'
          ? !!C.shots[x.name]
          : x.kind === 'lane'
            ? !!(C.lanes || {})[x.name]
            : x.kind === 'prop'
              ? !!((G.scenery || {}).props || {})[x.name]
              : x.kind === 'spot'
                ? !!C.spots[x.name] || people.has(x.name) || x.name === 'starter'
                : people.has(x.name);
      if (!ok)
        problems.push(
          at(x.line),
          x.kind === 'who'
            ? `${x.name}: not a speaker (story.json) nor ${CUTSCENE_YOU}`
            : `${x.kind} ${x.name}: not one of this cutscene's ${x.kind}s`
        );
    }
  };
  for (const sc of scripts) {
    let tree;
    try {
      tree = L.parseScript(sc.lines);
    } catch (err) {
      const e = /** @type {Error & { line: number }} */ (err);
      if (e.name !== 'ScriptError') throw e;
      problems.push(
        spot(`${sc.where} ${sc.id}, line ${e.line + 1}`, { file: sc.where, script: sc.id, line: e.line }),
        e.message
      );
      continue;
    }
    const walk = blk => {
      for (const n of blk) {
        const at = spot(`${sc.where} ${sc.id}, line ${n.line + 1}`, { file: sc.where, script: sc.id, line: n.line });
        if (n.k === 'say') who(n.who, at);
        else if (n.k === 'if')
          for (const c of n.clauses) {
            if (c.cond) condition(c.cond, at);
            walk(c.body);
          }
        else if (n.k === 'choice')
          for (const o of n.options) {
            if (o.cond)
              condition(
                o.cond,
                spot(`${sc.where} ${sc.id}, line ${o.line + 1}`, { file: sc.where, script: sc.id, line: o.line })
              );
            walk(o.body);
          }
        else if (n.k === 'once') {
          if (n.key) {
            const was = onceKeys.get(n.key);
            if (was && was !== sc.id) warnings.push(at, `once key ${n.key} is also used by ${was}`);
            else onceKeys.set(n.key, sc.id);
          }
          walk(n.body);
        } else if (n.k === 'cycle' || n.k === 'seq') n.entries.forEach(walk);
        else if (n.k === 'cmd') {
          const [a, b] = n.args;
          if (n.name === 'set') note(set, a, { at, place: sc.place });
          else if (n.name === 'give' || n.name === 'take') {
            const coin = a.startsWith('coin:');
            if (coin ? !pyramids[a.slice(5)] : !items[a])
              problems.push(at, `${n.name} ${a}, no such ${coin ? 'coin' : 'item'}`);
            if (n.name === 'give') given.add(a);
            else note(taken, a, at);
          } else if (n.name === 'battle' && !trainers[a]) problems.push(at, `battle ${a}, no such trainer`);
          else if (n.name === 'call' && !ids.has(a)) problems.push(at, `call ${a}, no such script`);
          else if (n.name === 'pick' && !Object.values(G.banter || {}).some(B => B.who === a))
            problems.push(at, `pick ${a}, no banter.json line is for ${a}`);
          else if (n.name === 'go' && !places.has(a)) problems.push(at, `go ${a}, no such place`);
          /* RL-S2: the hub folk (relations.json people), whole counts */
          else if ((n.name === 'gift' || n.name === 'rel') && !((G.relations || {}).people || {})[a])
            problems.push(at, `${n.name} ${a}, nobody in relations.json people`);
          else if ((n.name === 'rel' && !/^-?\d+$/.test(b || '')) || (n.name === 'beans' && !/^\d+$/.test(a || '')))
            problems.push(at, `${n.name}: ${n.name === 'rel' ? b : a} is not a whole number`);
          else if (n.name === 'chapter' && !/^[1-9]$/.test(a || ''))
            problems.push(at, `chapter ${a}: a chapter from 1 to 9`);
          else if (n.name === 'quest') {
            if (!quests[a]) problems.push(at, `quest ${a}, no such quest (story.json quests)`);
            else if (!quests[a].stages.includes(b)) problems.push(at, `quest ${a} has no stage ${b}`);
            else (questSet.get(a) || questSet.set(a, new Set()).get(a)).add(b);
          } else if ((n.name === 'walk' || n.name === 'face') && a && !sc.cutscene) who(a, at);
        }
      }
    };
    walk(tree);
    cutsceneChecks(sc, tree);
  }
  const fileOf = Object.fromEntries(scripts.map(sc => [sc.id, sc.where]));
  for (const p of lineIdProblems(scripts))
    problems.push(
      spot(`${p.script}, line ${p.line + 1}`, { file: fileOf[p.script], script: p.script, line: p.line }),
      p.problem
    );

  /* when, unless, requires and chapters: their conditions read */
  for (const [k, B] of Object.entries(G.banter || {}))
    if (B.when)
      condition(B.when, spot(`banter.json ${k} when`, { file: 'banter.json', thing: 'banter:' + k, field: 'when' }));
  for (const [mid, M] of Object.entries(G.maps || {})) {
    for (const P of M.people || [])
      for (const k of ['when', 'unless'])
        if (P[k])
          condition(
            P[k],
            spot(`maps/${mid}.json person ${P.id} ${k}`, {
              file: `maps/${mid}.json`,
              thing: 'person:' + P.id,
              field: k,
            })
          );
    (M.props || []).forEach((p, i) => {
      for (const k of ['when', 'unless'])
        if (p[k])
          condition(
            p[k],
            spot(`maps/${mid}.json prop ${p.k} ${k}`, { file: `maps/${mid}.json`, thing: 'prop:' + i, field: k })
          );
    });
  }
  for (const [id, T] of Object.entries(trainers))
    for (const k of ['when', 'unless'])
      if (T[k])
        condition(
          T[k],
          spot(`trainers/${id}.json ${k}`, { file: `trainers/${id}.json`, thing: 'trainer:' + id, field: k })
        );
  for (const l of G.locations)
    if (l.requires)
      condition(
        l.requires,
        spot(`locations.json ${l.id} requires`, { file: 'locations.json', thing: 'place:' + l.id, field: 'requires' })
      );
  for (const [id, C] of Object.entries(S.chapters || {})) {
    const at = spot(`story.json chapter ${id}`, { file: 'story.json', thing: 'chapter:' + id, field: 'when' });
    condition(C.when, at);
    for (const v of Object.values(C.maps || {}))
      if (!(G.maps || {})[v] && !/^[a-z0-9_]+$/.test(v)) problems.push(at, `map ${v}`);
  }

  /* the flags */
  for (const [f, at] of read) if (!set.has(f) && !known(f)) warnings.push(at, `reads flag ${f}, set nowhere`);
  /* a flag story.json lists may be read by the game itself; one it doesn't is the scripts' own */
  for (const [f, w] of set)
    if (!known(f)) warnings.push(w.at, `sets flag ${f}, not in story.json${read.has(f) ? '' : ', and read nowhere'}`);
  for (const [i, at] of taken) if (!given.has(i)) warnings.push(at, `takes ${i}, given nowhere`);
  for (const [q, Q] of Object.entries(quests))
    for (const st of Q.stages)
      if (!(questSet.get(q) || new Set()).has(st))
        warnings.push(
          spot(`story.json quest ${q}`, { file: 'story.json', thing: 'quest:' + q }),
          `no script moves it to ${st}`
        );

  /* the reach check: from the start, along roads and lifts, into places whose requires can come true by then (a flag
     some reachable script sets, or the game sets; trainers there beaten; other terms taken as earnable) */
  /* a requires that doesn't read is a problem above already; the reach check takes it as open */
  const reads = c => !L.conditionProblem(c),
    gated = G.locations.filter(l => l.requires && reads(l.requires));
  if (gated.length) {
    const byMap = Object.fromEntries(G.locations.filter(l => l.mapId).map(l => [l.mapId, l.id])),
      next = new Map();
    for (const r of G.roads || []) {
      const a = byMap[r.a && r.a.map],
        b = byMap[r.b && r.b.map];
      if (!a || !b) continue;
      (next.get(a) || next.set(a, []).get(a)).push(b);
      (next.get(b) || next.set(b, []).get(b)).push(a);
    }
    const start = (G.rules.start && G.rules.start.locationId) || G.locations[0].id,
      can = new Set([start]);
    const flagsHere = () => new Set([...set].filter(([, w]) => !w.place || can.has(w.place)).map(([f]) => f));
    const holds = c => {
      const F = flagsHere(),
        ok = t =>
          t.t === 'and'
            ? ok(t.a) && ok(t.b)
            : t.t === 'or'
              ? ok(t.a) || ok(t.b)
              : t.t === 'not'
                ? true
                : t.kind === 'flag'
                  ? F.has(t.id) || known(t.id)
                  : t.kind === 'beat'
                    ? can.has((G.locations[(trainers[t.id] || {}).node] || {}).id)
                    : t.kind === 'visited'
                      ? can.has(t.id)
                      : true;
      return ok(L.conditionTree(c));
    };
    for (let grew = true; grew;) {
      grew = false;
      for (const p of [...can])
        for (const q of next.get(p) || []) {
          const Q = G.locations.find(l => l.id === q);
          if (!can.has(q) && (!Q.requires || !reads(Q.requires) || holds(Q.requires))) {
            can.add(q);
            grew = true;
          }
        }
    }
    for (const l of gated)
      if (!can.has(l.id))
        problems.push(
          spot(`locations.json ${l.id}`, { file: 'locations.json', thing: 'place:' + l.id, field: 'requires' }),
          `requires ${l.requires}, which can't come true anywhere the player can get to`
        );
  }
  return found;
}

/* ---------- the Studio's story preview (Project Story S3) ----------
   A stand-in save at a start preset with flags switched on or off, and whether a person, trainer or prop is there in
   it: the map editor hides what isn't, and Play from here starts the game the same way. */

/** a save as far as conditions read it: a start preset (story.json presets), then flags switched on or off on top
 * ("beat:<trainer>" switches a trainer beaten) @param {any} G the game data
 * @param {{ preset?: string, flags?: Record<string, boolean> }} o */
export function storyPreviewSave(G, o = {}) {
  const P = ((G.story || {}).presets || {})[o.preset || ''] || {},
    save = {
      story: /** @type {Record<string, any>} */ ({ ...(P.flags || {}) }),
      flags: /** @type {Record<string, number>} */ ({}),
      seats: /** @type {string[]} */ ([]),
      items: { ...(P.items || {}) },
      pyramids: { ...(P.pyramids || {}) },
      visited: /** @type {Record<number, number>} */ ({}),
      caught: /** @type {Record<string, number>} */ ({}),
      team: [],
      box: [],
    };
  storySwitches(save, G, Object.fromEntries((P.beaten || []).map((/** @type {string} */ id) => ['beat:' + id, true])));
  for (const m of P.team || []) save.caught[m.sp] = 1;
  /* where a new game starts is visited (newSave), and the preset's place */
  for (const id of [((G.rules || {}).start || {}).locationId, P.place]) {
    const node = (G.locations || []).findIndex((/** @type {{ id: string }} */ l) => l.id === id);
    if (node >= 0) save.visited[node] = 1;
  }
  storySwitches(save, G, o.flags || {});
  return save;
}
/** flags switched on (to 1, unless already set) or off, and "beat:<trainer>" beaten (with its badge) or not, in a
 * save: the preview's and, from Play from here, the game's test run @param {any} save @param {any} G
 * @param {Record<string, boolean>} flags */
export function storySwitches(save, G, flags) {
  save.story = save.story || {};
  save.flags = save.flags || {};
  save.seats = save.seats || [];
  for (const [f, on] of Object.entries(flags)) {
    const T = f.startsWith('beat:') ? (G.trainers || {})[f.slice(5)] : null;
    if (f.startsWith('beat:')) {
      if (!T) continue;
      if (on) {
        save.flags[f.slice(5)] = 1;
        if (T.seat && !save.seats.includes(T.seat.id)) save.seats.push(T.seat.id);
      } else {
        delete save.flags[f.slice(5)];
        if (T.seat) save.seats = save.seats.filter((/** @type {string} */ x) => x !== T.seat.id);
      }
    } else if (on) save.story[f] = save.story[f] ?? 1;
    else delete save.story[f];
  }
  return save;
}
/** switches as Play from here writes them in the address: "met_x,!rival0,beat:chad" @param {Record<string, boolean>} F */
export const storySwitchesText = F =>
  Object.entries(F)
    .map(([f, on]) => (on ? f : '!' + f))
    .join(',');
/** @param {string | null} t @returns {Record<string, boolean>} */
export const storySwitchesOf = t =>
  Object.fromEntries(
    String(t || '')
      .split(',')
      .map(x => x.trim())
      .filter(x => /^!?[\w:.-]+$/.test(x))
      .map(x => (x.startsWith('!') ? [x.slice(1), false] : [x, true]))
  );
/** whether a person, trainer or prop is there in that save: its when holds and its unless doesn't (one that doesn't
 * read counts as false, so a broken when hides it and a broken unless doesn't) @param {any} G
 * @param {{ when?: string, unless?: string }} thing @param {any} save */
export function storyPreviewAllows(G, thing, save) {
  const qs = Object.fromEntries(
      Object.entries((G.story || {}).quests || {}).map(([k, q]) => [k, /** @type {any} */ (q).stages])
    ),
    S = storyStateOf(save, { locations: G.locations, questStages: qs }),
    holds = (/** @type {string} */ c) => !conditionProblem(c) && conditionHolds(conditionTree(c), S);
  if (thing.when && !holds(thing.when)) return false;
  return !(thing.unless && holds(thing.unless));
}
/** the flags and trainers the when / unless of these things read, for the preview's switches
 * @param {{ when?: string, unless?: string }[]} things @returns {{ flags: string[], beat: string[] }} */
export function storyNamesIn(things) {
  const flags = new Set(),
    beat = new Set();
  for (const t of things)
    for (const c of [t.when, t.unless])
      if (c && !conditionProblem(c)) {
        const N = conditionNames(conditionTree(c));
        for (const f of N.flag || []) flags.add(f);
        for (const b of N.beat || []) beat.add(b);
      }
  return { flags: [...flags].sort(), beat: [...beat].sort() };
}
