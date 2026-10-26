// @ts-check
'use strict';
/* ================= EVENTS ON A RUN (roguelite track RL-12b) =================
   A run's events (events.json, PokeRogue's mystery encounters): an intro, 2-3 options, each with a need (a condition,
   logic/conditions.js) and a cost in Moneys, and a script (docs/SCRIPTS.md) with the event commands. This file is the
   rules; the sheet that shows them is encounter-screen.js, which plays an option's script with logic/script.js on a
   stage made of these functions and its own windows.
   - which event a waystation holds: drawn once from its node's stream ('event'), by weight, among those of its biome
     not played yet this run (unless `repeat`), and kept in run.enc.node (so a reload shows the same one);
   - an option is open when its need holds and the Moneys are there; a closed one says why (eventOptionState);
   - every chance an event takes (a wager, a loot draw, which Billie, which Perk) comes from the run's events stream,
     rngFrom(run.seed, 'event|' + run.enc.n), one draw a step (encRng), so a run made again plays the same;
   - foes: a trainer of a class (events.json classes) with Billies of the region's dex, its levels the place's top wild
     level plus `up` (encClassFoe; route trainers use it too), or a wild Billie of the dex (encWildFoe).
   Logic only: no DOM, no Date, no Math.random (tools/test/encounters.test.mjs). */
/** @import { Run, Billy } from '../../types/save-data' */
/** @import { EventsData, RunEventOption, Perk, Item } from '../../types/game-data' */
/** @typedef {{ cap: number, pick: number, rarity: Record<string, number>, price: Record<string, number> }} PerkRules */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { rngFrom } from './rng.js';
import { speciesStep } from './rules.js';
import { modFoeLevels } from './modifiers.js';
import { runNodeSeed, runWorldNode } from './run-map.js';
import { runWildLevels } from './run-scenes.js';
import { encOf } from './run-enc.js';
import { perkDraw, perkPool } from './perks.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  encChanges: [() => encChanges, v => (encChanges = v)],
  // @ts-expect-error -- replaced on purpose
  encClassFoe: [() => encClassFoe, v => (encClassFoe = v)],
  // @ts-expect-error -- replaced on purpose
  encDexAt: [() => encDexAt, v => (encDexAt = v)],
  encEventFoe: [() => encEventFoe],
  // @ts-expect-error -- replaced on purpose
  encHeal: [() => encHeal, v => (encHeal = v)],
  // @ts-expect-error -- replaced on purpose
  encHurt: [() => encHurt, v => (encHurt = v)],
  // @ts-expect-error -- replaced on purpose
  encLoot: [() => encLoot, v => (encLoot = v)],
  // @ts-expect-error -- replaced on purpose
  encMoney: [() => encMoney, v => (encMoney = v)],
  // @ts-expect-error -- replaced on purpose
  encPerk: [() => encPerk, v => (encPerk = v)],
  // @ts-expect-error -- replaced on purpose
  encPickBilly: [() => encPickBilly, v => (encPickBilly = v)],
  encPlaceLevel: [() => encPlaceLevel],
  // @ts-expect-error -- replaced on purpose
  encRng: [() => encRng, v => (encRng = v)],
  // @ts-expect-error -- replaced on purpose
  encStatus: [() => encStatus, v => (encStatus = v)],
  // @ts-expect-error -- replaced on purpose
  encWildFoe: [() => encWildFoe, v => (encWildFoe = v)],
  // @ts-expect-error -- replaced on purpose
  eventAt: [() => eventAt, v => (eventAt = v)],
  // @ts-expect-error -- replaced on purpose
  eventOptionState: [() => eventOptionState, v => (eventOptionState = v)],
  // @ts-expect-error -- replaced on purpose
  eventPlayed: [() => eventPlayed, v => (eventPlayed = v)],
  // @ts-expect-error -- replaced on purpose
  eventPool: [() => eventPool, v => (eventPool = v)],
  // @ts-expect-error -- replaced on purpose
  needWords: [() => needWords, v => (needWords = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the stream for an event's next chance: one draw a step, counted in run.enc.n @param {Run} run */
export function encRng(run) {
  const e = encOf(run);
  return rngFrom(run.seed, 'event|' + e.n++);
}

/** the events a place may hold: weight above 0, its biome's (or every biome's), not played this run unless `repeat`,
 * by id; RS-2: a `resident` event only when `meet` (the run's resident can be met at an event, logic/residents.js)
 * @param {Run} run @param {EventsData} E @param {string | undefined} biome @param {boolean} [meet] */
export function eventPool(run, E, biome, meet = false) {
  const seen = new Set(run.enc ? run.enc.seen : []);
  return Object.keys(E.events)
    .filter(id => {
      const ev = E.events[id];
      return (
        ev.weight > 0 &&
        (!ev.biomes || !biome || ev.biomes.includes(biome)) &&
        (ev.repeat || !seen.has(id)) &&
        (!ev.resident || meet)
      );
    })
    .sort();
}

/** the event at a map node: the one kept, else drawn now from the node's stream and kept ('' when none is left);
 * `meet`: RS-2, the run's resident can be met at an event (eventPool)
 * @param {Run} run @param {number} i the map node @param {EventsData} E @param {boolean} [meet] */
export function eventAt(run, i, E, meet = false) {
  const e = encOf(run),
    k = String(i);
  if (Object.hasOwn(e.node, k)) return e.node[k];
  const node = run.map && run.map.nodes[i],
    pool = eventPool(run, E, (node && node.biome) || undefined, meet),
    id = pool.length
      ? rngFrom(runNodeSeed(run.seed, i), 'event').pick(Object.fromEntries(pool.map(p => [p, E.events[p].weight])))
      : '';
  e.node[k] = id;
  return id;
}

/** an event is played: it leaves the pool (unless `repeat`) and its node's is spent @param {Run} run @param {string} id
 * @param {number | null} i the map node (null: played from elsewhere, the debug menu) */
export function eventPlayed(run, id, i) {
  const e = encOf(run);
  e.seen.push(id);
  if (i != null) e.node[String(i)] = '';
}

/** what a closed option needs, in words, from its condition (a guess for anything not plain; needText wins)
 * @param {string} need @param {Record<string, Item>} items */
export function needWords(need, items) {
  let m;
  if ((m = /^type:(\w+)(?:\s*>=\s*(\d+))?$/.exec(need)))
    return m[2] && +m[2] > 1 ? `Needs ${m[2]} ${m[1]} Billies` : `Needs a ${m[1]} Billie`;
  if ((m = /^item:(\w+)(?:\s*>=\s*(\d+))?$/.exec(need))) {
    const n = (items[m[1]] && items[m[1]].n) || m[1];
    return m[2] && +m[2] > 1 ? `Needs ${m[2]} ${n}s` : `Needs ${/^[AEIOU]/.test(n) ? 'an' : 'a'} ${n}`;
  }
  if ((m = /^badge:(\w+)$/.exec(need))) return `Needs the ${m[1]} Badge`;
  if (/^badges(\s*>=\s*1)?$/.test(need)) return 'Needs a badge';
  if ((m = /^team\s*>=\s*(\d+)$/.exec(need))) return `Needs ${m[1]} Billies`;
  if ((m = /^money\s*>=\s*(\d+)$/.exec(need))) return `Needs ${m[1]} Moneys`;
  return 'Not now';
}

/** whether an option can be picked: its need holds (holds(need)) and the Moneys are there; why not, in words
 * @param {RunEventOption} o @param {(cond: string) => boolean} holds @param {number} money
 * @param {Record<string, Item>} items @returns {{ ok: boolean, why: string }} */
export function eventOptionState(o, holds, money, items) {
  if (o.need && !holds(o.need)) return { ok: false, why: o.needText || needWords(o.need, items) };
  if (o.cost && money < o.cost) return { ok: false, why: `Needs ${o.cost} Moneys` };
  return { ok: true, why: '' };
}

/* ---------- what the event commands do (encounter-screen.js's stage calls these) ---------- */

/** Moneys gained or lost (never below 0); the change made @param {{ se: number }} s @param {number} n */
export function encMoney(s, n) {
  const before = s.se;
  s.se = Math.max(0, Math.round(s.se + n));
  return s.se - before;
}

/** every Billie standing loses `share` of its HP (rounded up), never past 1 HP; the HP lost in all
 * @param {Billy[]} team @param {number} share @param {(m: Billy) => number} maxHp */
export function encHurt(team, share, maxHp) {
  let lost = 0;
  for (const m of team) {
    if (m.hp <= 0) continue;
    const to = Math.max(1, m.hp - Math.ceil(maxHp(m) * share));
    lost += m.hp - to;
    m.hp = to;
  }
  return lost;
}

/** every Billie standing gains `share` of its HP (all of it with none given); fainted ones stay down; the HP gained
 * @param {Billy[]} team @param {number | undefined} share @param {(m: Billy) => number} maxHp */
export function encHeal(team, share, maxHp) {
  let gained = 0;
  for (const m of team) {
    if (m.hp <= 0) continue;
    const top = maxHp(m),
      to = share == null ? top : Math.min(top, m.hp + Math.ceil(top * share));
    gained += to - m.hp;
    m.hp = to;
  }
  return gained;
}

/** every Billie standing with no status gets one; how many did @param {Billy[]} team @param {string} id */
export function encStatus(team, id) {
  let n = 0;
  for (const m of team)
    if (m.hp > 0 && !m.status) {
      m.status = id;
      m.sTurns = 0;
      n++;
    }
  return n;
}

/** items drawn from a loot table (with repeats), from the events stream, as { item: count }
 * @param {Run} run @param {EventsData} E @param {string} table @param {number} [n] */
export function encLoot(run, E, table, n = 1) {
  const T = E.loot[table] || {},
    g = encRng(run),
    /** @type {Record<string, number>} */
    out = {};
  const W = Object.fromEntries(
    Object.keys(T)
      .sort()
      .map(k => [k, T[k]])
  );
  if (!Object.keys(W).length) return out;
  for (let k = 0; k < Math.max(1, Math.floor(n)); k++) {
    const id = g.pick(W);
    out[id] = (out[id] || 0) + 1;
  }
  return out;
}

/** a Billie of the team drawn from the events stream (fainted ones too; robots never), or null @param {Run} run
 * @param {Billy[]} team */
export function encPickBilly(run, team) {
  const L = team.filter(m => m.kind !== 'robot');
  return L.length ? L[encRng(run).int(0, L.length - 1)] : null;
}

/** the Perk an event offers: that id (if not held), else drawn by rarity weight from the events stream among those
 * not held (of that rarity when one is given); '' when none is left @param {Run} run @param {string | undefined} arg
 * @param {Record<string, Perk>} perks @param {PerkRules} rule */
export function encPerk(run, arg, perks, rule) {
  if (arg && perks[arg]) return run.perks.includes(arg) ? '' : arg;
  const pool = perkPool(run, perks, rule).filter(id => !arg || perks[id].rarity === arg);
  return perkDraw(encRng(run), pool, perks, rule, 1)[0] || '';
}

/** species to meet at a level: the region's dex (else every species given), the stages that fit the level (a first
 * stage under 16, no final form under 32), by id @param {Run} run @param {Record<string, any>} species @param {number} lvl */
export function encDexAt(run, species, lvl) {
  const dex = (run.region && run.region.dex) || Object.keys(species),
    fits = (/** @type {string} */ id) => {
      const S = species[id];
      /* RL-13: a final form is one whatever its stage number (rules.js speciesStep): a Billie with no evolutions
         (Altmowl, Peacouture) waits for 32 like any final */
      return !!S && (lvl < 16 ? speciesStep(S) === 0 : lvl < 32 ? speciesStep(S) <= 1 : true);
    },
    L = dex.filter(fits);
  return (L.length ? L : dex.filter(id => species[id])).slice().sort();
}

/** a place's top wild level @param {Run} run @param {number} i @param {{ wild: { lv: [number, number], perRow: number } }} rules */
export const encPlaceLevel = (run, i, rules) =>
  run.map
    ? runWildLevels(run.map, i, /** @type {any} */ ({ rules }), modFoeLevels(run))[1]
    : Math.max(1, rules.wild.lv[1]);

/**
 * A trainer of a class at a map node, as a trainer entry (the shape runFoes makes): its Billies drawn from `salt`'s
 * stream (how many from the class's team range, which from the region's dex), at the place's top wild level plus
 * `up`; the reward its class pays. The id is given (route trainers: run_<i>_t<k>; an event's foe: run_<i>_ev).
 * @param {Run} run @param {number} i @param {string} id @param {string} cls
 * @param {{ classes: EventsData['classes'], species: Record<string, any>, rules: any, up?: number, salt: string,
 *   reward: number, foe: string }} o rules: rules.json run (its `wild`); foe: the entry's runFoe ('route', 'event')
 */
export function encClassFoe(run, i, id, cls, o) {
  const C = o.classes[cls],
    g = rngFrom(runNodeSeed(run.seed, i), o.salt),
    lvl = Math.max(1, Math.min(100, encPlaceLevel(run, i, o.rules) + (o.up || 0))),
    n = g.int(C.team[0], C.team[1]),
    dex = encDexAt(run, o.species, lvl),
    team = [];
  for (let k = 0; k < n && dex.length; k++)
    team.push({ sp: dex[g.int(0, dex.length - 1)], lvl: Math.max(1, lvl - (n - 1 - k)) });
  return {
    id,
    name: C.name,
    who: C.who,
    cls,
    win: `“${C.lose}”`,
    lose: '',
    sight: C.sight,
    /* RL-S1: the Bureau's agents (logic/run-history.js, banter's `bureau` lines) */
    ...(C.bureau ? { bureau: 1 } : {}),
    reward: o.reward,
    team,
    node: runWorldNode(i),
    runFoe: o.foe,
    runNode: i,
  };
}

/** an event's foe (the `foe` command) at map node i: its class's trainer, id run_<i>_ev, from the event's own stream,
 * paying a route trainer's reward; made again the same after a reload (run.enc.play.foe)
 * @param {Run} run @param {number} i @param {string} eventId @param {string} cls @param {number} up
 * @param {{ classes: EventsData['classes'], species: Record<string, any>, rules: any }} data rules: rules.json run */
export const encEventFoe = (run, i, eventId, cls, up, data) =>
  encClassFoe(run, i, `run_${i}_ev`, cls, {
    ...data,
    up,
    salt: 'event|foe|' + eventId,
    reward: data.rules.trainers.reward,
    foe: 'event',
  });

/** a wild Billie of the region's dex for an event, from the events stream, at the place's top wild level plus `up`
 * @param {Run} run @param {number} i @param {Record<string, any>} species @param {any} rules rules.json run
 * @param {number} up @returns {{ sp: string, lvl: number } | null} */
export function encWildFoe(run, i, species, rules, up) {
  const lvl = Math.max(1, Math.min(100, encPlaceLevel(run, i, rules) + up)),
    dex = encDexAt(run, species, lvl);
  return dex.length ? { sp: dex[encRng(run).int(0, dex.length - 1)], lvl } : null;
}

/** what an option's script changed, for the sheet's summary: Moneys, items and pyramids gained (+) or lost (−), as
 * [what, n] in order @param {{ se: number, items: Record<string, number>, pyramids: Record<string, number> }} a
 * before @param {{ se: number, items: Record<string, number>, pyramids: Record<string, number> }} b after */
export function encChanges(a, b) {
  /** @type {[string, number][]} */
  const out = [];
  if (b.se !== a.se) out.push(['money', b.se - a.se]);
  for (const [pre, A, B] of /** @type {const} */ ([
    ['', a.items, b.items],
    ['coin:', a.pyramids, b.pyramids],
  ]))
    for (const k of [...new Set([...Object.keys(A), ...Object.keys(B)])].sort()) {
      const d = (B[k] || 0) - (A[k] || 0);
      if (d) out.push([pre + k, d]);
    }
  return out;
}
