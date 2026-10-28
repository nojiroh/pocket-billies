// @ts-check
'use strict';
/* ================= EFFECTS (roguelite track RL-12) =================
   What a run's Perks (perks.json) change, as effect rows read at named points of the game (roguelite-track.md 2d;
   phase 19's handler-table idea). A Perk is data: a list of rows, each of one kind in FX_KINDS. fxRows turns the
   ids held into one list; each point asks only for its kind:
     money   a won battle's money (battle-rewards.js)         price   a run shop's prices, a run clinic's charge
     catch   a coin's chance to catch (catchOdds)              stat    stat stages for your Billies as a battle starts
     damage  what your Billies deal or take (calcDamage)       heal    a share of HP on walking into a place
     payout  the payout's Research, or the share items count at
     level   foes' levels      bossHp  the run's boss's HP   (RL-13; PK-1: every run row, fxRunFoeLevels,
                                                             fxRunBossHp)
     xp      the holder's XP   turnHeal  a share of HP at each turn's end   pinchHeal  once a battle, low on HP
                                                             (RL-12c, held items; PK-1: a run's too)
     dna     a Gene Sample's DNA (battle-rewards.js spliceSample)    splice  the wild splice odds (rules.js, a run
     unstable  an Unstable splice's turn-end hurt (battle-engine.js)          place's stocking)   (SP-6, Perks)
     crit    critical-hit stages for yours hitting (calcDamage); at `when: move` the move is a critical hit (PK-3)
     immune  yours can't get a status (brn, slp, par), or aren't hurt by the Sandstorm or sharp stones (PK-3)
     inflict a status with a chance on the foe yours hit (`when: hit`; chances together at most FX_CHANCE) (PK-3)
     chip    what a burn takes from yours at each turn's end, times mult (PK-3)
     first   yours move before the foe's (within a move's priority), where its `if` holds: `turn:1` (PK-3)
   RL-12c: a Billie's own rows (fxOfBillie: its held item's `hold` in items.json) count for that Billie alone and never
   join the run's list; the battle asks for them by fighter (battle-engine.js, battle-state.js).
   Stacking: rows of one kind combine whatever order they were picked in. Stages and shares add up; multipliers are
   multiplied smallest first (the same product for any order), and the product stays within FX_LIMIT, so a run holding
   every Perk stays finite. With no rows every answer is the number it was given (a multiplier of exactly 1), so a
   battle or a run without Perks is the same as before them. Later sessions add rows from other places into the same
   list (RL-11 building levels; RL-13: the run's Expedition and challenges, logic/modifiers.js; RS-4: residents').
   Logic only: no DOM, no Date, no Math.random (tools/test/effects.test.mjs). */
/** @import { FxRow, Perk } from '../../types/game-data' */
/** @typedef {FxRow & { src: string, row?: number }} Fx */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { PERKS, RELATIONS, RESIDENTS, billyGeneFx, provide } from '../hooks.js';
import { relFxRows } from './relations.js';
import { modFxRows } from './modifiers.js';
import { resFxRows } from './residents.js';
import { encBoonRows } from './run-enc.js';
/* eslint-disable no-func-assign */
expose({
  FX_CHANCE: [() => FX_CHANCE],
  FX_CHIP: [() => FX_CHIP],
  FX_CRIT: [() => FX_CRIT],
  FX_EVERY: [() => FX_EVERY],
  FX_FOES: [() => FX_FOES],
  FX_IF_KEYS: [() => FX_IF_KEYS],
  FX_IF_WORDS: [() => FX_IF_WORDS],
  FX_IMMUNE: [() => FX_IMMUNE],
  FX_KINDS: [() => FX_KINDS],
  FX_LIMIT: [() => FX_LIMIT],
  FX_ONCE: [() => FX_ONCE],
  FX_PER: [() => FX_PER],
  FX_SAY: [() => FX_SAY],
  FX_STAGES: [() => FX_STAGES],
  FX_WHEN: [() => FX_WHEN],
  FX_WHEN_BATTLE: [() => FX_WHEN_BATTLE],
  fxAt: [() => fxAt],
  fxCatch: [() => fxCatch],
  fxChip: [() => fxChip],
  // @ts-expect-error -- replaced on purpose
  fxCond: [() => fxCond, v => (fxCond = v)],
  fxCrit: [() => fxCrit],
  // @ts-expect-error -- replaced on purpose
  fxDamage: [() => fxDamage, v => (fxDamage = v)],
  // @ts-expect-error -- replaced on purpose
  fxFire: [() => fxFire, v => ((fxFire = v), provide({ fxFire }))],
  fxHealShare: [() => fxHealShare],
  fxIfs: [() => fxIfs],
  fxImmune: [() => fxImmune],
  // @ts-expect-error -- replaced on purpose
  fxInflictPick: [() => fxInflictPick, v => (fxInflictPick = v)],
  fxKey: [() => fxKey],
  // @ts-expect-error -- replaced on purpose
  fxLive: [() => fxLive, v => (fxLive = v)],
  fxMoney: [() => fxMoney],
  // @ts-expect-error -- replaced on purpose
  fxMult: [() => fxMult, v => (fxMult = v)],
  fxOfBillie: [() => fxOfBillie],
  fxOfRun: [() => fxOfRun],
  // @ts-expect-error -- replaced on purpose
  fxPayoutRates: [() => fxPayoutRates, v => (fxPayoutRates = v)],
  // @ts-expect-error -- replaced on purpose
  fxPeek: [() => fxPeek, v => (fxPeek = v)],
  fxPinchHeal: [() => fxPinchHeal],
  fxPrice: [() => fxPrice],
  // @ts-expect-error -- replaced on purpose
  fxRowNow: [() => fxRowNow, v => (fxRowNow = v)],
  fxRows: [() => fxRows],
  fxRunBossHp: [() => fxRunBossHp],
  fxRunFoeLevels: [() => fxRunFoeLevels],
  fxRunMarks: [() => fxRunMarks],
  fxRunPrice: [() => fxRunPrice],
  // @ts-expect-error -- replaced on purpose
  fxSpend: [() => fxSpend, v => (fxSpend = v)],
  fxSplice: [() => fxSplice],
  // @ts-expect-error -- replaced on purpose
  fxStages: [() => fxStages, v => (fxStages = v)],
  // @ts-expect-error -- replaced on purpose
  fxStateLog: [() => fxStateLog, v => (fxStateLog = v)],
  fxStateful: [() => fxStateful],
  fxTurnHeal: [() => fxTurnHeal],
  fxTurnHurt: [() => fxTurnHurt],
  fxXp: [() => fxXp],
  growClamp: [() => growClamp],
  mark: [() => mark],
  runMarks: [() => runMarks],
});
/* eslint-enable no-func-assign */
provide({ fxFire });
/* to-module: end */
export const FX_KINDS = /** @type {const} */ ([
  'money',
  'price',
  'catch',
  'stat',
  'damage',
  'heal',
  'payout',
  'level',
  'bossHp',
  'xp',
  'turnHeal',
  'pinchHeal',
  'turnHurt',
  'dna',
  'splice',
  'unstable',
  'crit',
  'immune',
  'inflict',
  'chip',
  'first',
]);
/** a product of multipliers stays within these */
export const FX_LIMIT = { lo: 0.1, hi: 4 };
/** stat stages from effects stay within these (the battle clamps again to its own stageMax) */
export const FX_STAGES = 6;

/** the effect rows of the Perks held, in the order held, each tagged with its Perk's id; an id with no entry
 * gives none @param {string[]} ids @param {Record<string, Perk>} perks @returns {Fx[]} */
export const fxRows = (ids, perks) =>
  ids.flatMap(id => (perks[id] ? perks[id].fx.map(f => /** @type {Fx} */ ({ ...f, src: id })) : []));

/** the effect rows of a run's Perks, its events' boons, its Expedition and challenges and (RL-S2) the hub folk's level
 * bonuses it took off with (null in the hub, or with
 * none) @param {{ perks: string[], expedition?: number, mods?: string[] } | null | undefined} run
 * @param {Record<string, Perk>} perks @returns {Fx[] | null} */
export const fxOfRun = (run, perks) => {
  /* RL-12b: an event's boons (logic/run-enc.js) after the Perks' rows; RL-13: the Expedition's and challenges' last */
  const rows = run
    ? [
        ...fxRows(run.perks || [], perks),
        ...encBoonRows(/** @type {any} */ (run)),
        .../** @type {Fx[]} */ (modFxRows(run)),
        /* RL-S2: the hub folk's level bonuses (logic/relations.js) */
        .../** @type {Fx[]} */ (relFxRows(/** @type {any} */ (run), RELATIONS)),
        /* RS-4: the residents' service levels it took off with (logic/residents.js) */
        .../** @type {Fx[]} */ (resFxRows(/** @type {any} */ (run), RESIDENTS)),
      ]
    : [];
  if (!rows.length) return null;
  /* PK-1: a row that keeps state (a counter, a growth, a once mark) knows its place among its source's rows */
  /** @type {Record<string, number>} */
  const at = {};
  return rows.map(f => {
    const row = (at[f.src] = (at[f.src] ?? -1) + 1),
      r = /** @type {any} */ (f);
    return r.every || r.grow || r.once ? /** @type {Fx} */ ({ ...f, row }) : f;
  });
};
provide({ fxOfRun }); /* to-module */

/** RL-12c: a Billie's own effect rows: its held item's (items.json `hold`), tagged `held:<id>`, then (SP-2) its
 * splice's (rules.js billyGeneFx: its traits', tagged `gene:<trait>`, and an Unstable splice's drawback, `unstable`);
 * null with none (SP-5: an Augment's Unstable splice too)
 * @param {{ held?: string, sp?: string, graft?: Record<string, string>, aug?: any } | null | undefined} m
 * @param {Record<string, { hold?: import('../../types/game-data').FxRow[] }>} items @returns {Fx[] | null} */
export const fxOfBillie = (m, items) => {
  const I = m && m.held ? items[m.held] : null,
    held = I && I.hold && I.hold.length ? I.hold.map(f => /** @type {Fx} */ ({ ...f, src: 'held:' + m?.held })) : null;
  if (!m || (!m.graft && !m.aug)) return held;
  const gene = /** @type {Fx[]} */ (billyGeneFx(m));
  return held || gene.length ? [...(held || []), ...gene] : null;
};

/** the product of the multipliers of the rows that pass `test`, smallest first, within FX_LIMIT (1 when none)
 * @param {Fx[] | null | undefined} fx @param {(f: Fx) => boolean} test */
export function fxMult(fx, test) {
  const m = (fx || [])
    .filter(test)
    .map(f => /** @type {number} */ (/** @type {any} */ (f).mult))
    .sort((a, b) => a - b);
  if (!m.length) return 1;
  const p = m.reduce((a, b) => a * b, 1);
  return Math.min(FX_LIMIT.hi, Math.max(FX_LIMIT.lo, p));
}

/** a won battle's money with the money rows (whole $) @param {Fx[] | null | undefined} fx @param {number} n */
export const fxMoney = (fx, n) => {
  const k = fxMult(fx, f => f.kind === 'money');
  return k === 1 ? n : Math.round(n * k);
};

/** a price on the run with the price rows of `what` (whole $, never below 0)
 * @param {Fx[] | null | undefined} fx @param {'shop' | 'heal'} what @param {number} n */
export const fxPrice = (fx, what, n) => {
  const k = fxMult(fx, f => f.kind === 'price' && f.what === what);
  return k === 1 ? n : Math.max(0, Math.round(n * k));
};

/** Studio plan T3.2: a price on a run with its Perks' price rows of `what` (the page's clinic and shops, and the
 * run's simulation): the price itself with no run or none held @param {{ perks: string[] } | null | undefined} run
 * @param {Record<string, Perk>} perks @param {'shop' | 'heal'} what @param {number} n */
export const fxRunPrice = (run, perks, what, n) => fxPrice(fxOfRun(run, perks), what, n);

/** what multiplies a coin's chance to catch (the chance itself stays at most 1) @param {Fx[] | null | undefined} fx */
export const fxCatch = fx => fxMult(fx, f => f.kind === 'catch');

/**
 * What multiplies a hit's damage: the deal rows when one of yours hits, the take rows when one of yours is hit (both
 * when one of yours hits another of yours). A row with a category or a type counts only for a move of it.
 * @param {Fx[] | null | undefined} fx
 * @param {{ cat: string, type: string, deal: boolean, take: boolean }} hit the move's category (H, S, X) and type
 */
export function fxDamage(fx, hit) {
  if (!fx || !fx.length || (!hit.deal && !hit.take)) return 1;
  return fxMult(
    fx,
    f =>
      f.kind === 'damage' &&
      ((f.side === 'deal' && hit.deal) || (f.side === 'take' && hit.take)) &&
      (!f.cat || f.cat === hit.cat) &&
      (!f.type || f.type === hit.type)
  );
}

/** the stat stages your Billies on the field get as a battle starts, by stat (summed, within FX_STAGES; none: {})
 * @param {Fx[] | null | undefined} fx @returns {Record<string, number>} */
export function fxStages(fx) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const f of fx || []) if (f.kind === 'stat') out[f.stat] = (out[f.stat] || 0) + f.stages;
  for (const k of Object.keys(out)) {
    out[k] = Math.max(-FX_STAGES, Math.min(FX_STAGES, out[k]));
    if (!out[k]) delete out[k];
  }
  return out;
}

/** the share of HP walking into a place heals (summed, at most 1; 0 when none) @param {Fx[] | null | undefined} fx */
export const fxHealShare = fx =>
  Math.min(
    1,
    (fx || []).reduce((a, f) => a + (f.kind === 'heal' ? f.share : 0), 0)
  );
provide({ fxHealShare }); /* to-module */

/**
 * The payout's rates with the payout rows: `itemShare` times its rows (at most 1: an item never counts above its
 * price) and `research`, what the payout's Research is multiplied by (1 when none). The other rates as they were.
 * @template {{ itemShare: number }} R
 * @param {Fx[] | null | undefined} fx @param {R} rates @returns {R & { research: number }}
 */
export function fxPayoutRates(fx, rates) {
  const share = fxMult(fx, f => f.kind === 'payout' && f.what === 'itemShare');
  return {
    ...rates,
    itemShare: share === 1 ? rates.itemShare : Math.min(1, rates.itemShare * share),
    research: fxMult(fx, f => f.kind === 'payout' && f.what === 'research'),
  };
}

/** RL-12c: a holder's XP with its xp rows (whole XP) @param {Fx[] | null | undefined} fx @param {number} n */
export const fxXp = (fx, n) => {
  const k = fxMult(fx, f => f.kind === 'xp');
  return k === 1 ? n : Math.floor(n * k);
};

/** RL-12c: the share of its HP a holder heals at each turn's end (summed, at most 1; 0 when none)
 * @param {Fx[] | null | undefined} fx */
export const fxTurnHeal = fx =>
  Math.min(
    1,
    (fx || []).reduce((a, f) => a + (f.kind === 'turnHeal' ? f.share : 0), 0)
  );

/** SP-2: the share of its HP a Billie loses at each turn's end (an Unstable splice's drawback), at most a half
 * @param {Fx[] | null | undefined} fx */
export const fxTurnHurt = fx =>
  Math.min(
    0.5,
    (fx || []).reduce((a, f) => a + (f.kind === 'turnHurt' ? f.share : 0), 0)
  );

/** SP-6: what multiplies a Gene Sample's DNA, the wild splice odds and an Unstable splice's turn-end hurt: the run's
 * rows of that kind (1 when none) @param {Fx[] | null | undefined} fx @param {'dna' | 'splice' | 'unstable'} kind */
export const fxSplice = (fx, kind) => fxMult(fx, f => f.kind === kind);
provide({ fxSplice }); /* to-module */

/** PK-3: the most critical-hit stages crit rows give (rules.json battle.critChances has 4 steps: 0 to 3) */
export const FX_CRIT = 3;
/** PK-3: the critical-hit stages the crit rows without a when give (summed, 0 to FX_CRIT; 0 when none). A crit row
 * at a moment (when: move) gives no stages: it makes that move a critical hit (battle-engine.js fxMoment)
 * @param {Fx[] | null | undefined} fx */
export const fxCrit = fx =>
  Math.max(
    0,
    Math.min(
      FX_CRIT,
      (fx || []).reduce((a, f) => a + (f.kind === 'crit' && !f.when ? f.stages || 0 : 0), 0)
    )
  );

/** PK-3: what an immune row can keep off your Billies: a status (statuses.json), the Sandstorm's buffeting (a move's
 * storm, rules.json battle.shockName) and sharp stones on switching in */
export const FX_IMMUNE = /** @type {const} */ (['brn', 'slp', 'par', 'sandstorm', 'stones']);
/** PK-3: the immune rows against `what` (their sources name the line; none: []) @param {Fx[] | null | undefined} fx
 * @param {string} what */
export const fxImmune = (fx, what) => (fx || []).filter(f => f.kind === 'immune' && f.what === what);
provide({ fxImmune }); /* to-module */

/** PK-3: the most the chance rows acting at one moment add up to (Risk of Rain 2's lesson, perks-track.md rule 5) */
export const FX_CHANCE = 0.5;
/** PK-3: which inflict row lands, from one roll r (0-1) of the battle's stream: the rows' chances are laid end to end,
 * scaled down to FX_CHANCE together when they add up to more; null when the roll falls past them
 * @param {any[] | null | undefined} rows @param {number} r @returns {any} */
export function fxInflictPick(rows, r) {
  const L = (rows || []).filter(f => f.kind === 'inflict' && f.chance > 0),
    total = L.reduce((a, f) => a + f.chance, 0),
    k = total > FX_CHANCE ? FX_CHANCE / total : 1;
  let at = 0;
  for (const f of L) if (r < (at += f.chance * k)) return f;
  return null;
}

/** PK-3: the turn-end hurts a chip row can change (a burn's, rules.json battle.drainFraction) */
export const FX_CHIP = /** @type {const} */ (['burn']);
/** PK-3: what multiplies a turn-end hurt `what` on yours: its chip rows' product (1 when none)
 * @param {Fx[] | null | undefined} fx @param {string} what */
export const fxChip = (fx, what) => fxMult(fx, f => f.kind === 'chip' && f.what === what);

/** RL-12c: a holder's once-a-battle heal when low: the first pinchHeal row, or null
 * @param {Fx[] | null | undefined} fx @returns {{ at: number, share: number } | null} */
export const fxPinchHeal = fx => {
  const f = (fx || []).find(r => r.kind === 'pinchHeal');
  return f && f.kind === 'pinchHeal' ? { at: f.at, share: f.share } : null;
};

/* ---------- PK-1: when a row acts, on what condition, how often, how it grows (perks-track.md section 7) ----------
   Optional fields on any effect row, from fixed lists (data-checks.js checks them; no script language):
     when   the moment it acts (FX_WHEN). Without one a row acts where its kind always acts (a stat row as each of
            your Billies takes the field, a heal row on walking into a place, a damage row on every hit...)
     if     one condition or a list of them, all of which must hold (fxCond)
     every  N: it acts on every Nth time its `when` comes (the count lasts the run)
     grow   {on, by, max, reset?, if?}: a value that builds by `by` each time `on` comes (up to `max`, back to 0 at
            `reset`) and is added to the row's number (mult, stages, share or n)
     per    'teamTypes': its number counts once for each different type on your team ("3% for each")
     once   'battle', 'run' or 'billie' (once a battle for each of your Billies)
   State: the run's counters, growth and once-a-run marks are run.perkState ({'<src>/<row>': {n, v, used}}, missing
   reads as empty); once-a-battle and per-Billie marks are the battle's own (b.fxState). Chances are rolled by the
   caller on the battle's seeded stream. A row with none of these fields reads exactly as before. */
/** the moments a row can act at: in battle (battleStart .. throwMiss), then on the run */
export const FX_WHEN = /** @type {const} */ ([
  'battleStart',
  'switchIn',
  'move',
  'hit',
  'hurt',
  'crit',
  'ko',
  'faint',
  'turnEnd',
  'throwMiss',
  'catch',
  'win',
  'arrive',
  'buy',
  'take',
]);
/** the moments that happen inside a battle (the battle's own marks exist there) */
export const FX_WHEN_BATTLE = FX_WHEN.slice(0, 10);
export const FX_ONCE = /** @type {const} */ (['battle', 'run', 'billie']);
export const FX_PER = /** @type {const} */ (['teamTypes']);
/** what a foe can be, for `if: foe:<k>` */
export const FX_FOES = /** @type {const} */ (['wild', 'trainer', 'leader', 'rival', 'boss', 'bot', 'spliced']);
/** the condition words with nothing after them */
export const FX_IF_WORDS = /** @type {const} */ ([
  'mono',
  'alone',
  'lead',
  'notLead',
  'newSpecies',
  'superEffective',
  'noFaint',
]);
/** the condition words with a value after a colon ('hp<' takes a share instead) */
export const FX_IF_KEYS = /** @type {const} */ (['weather', 'type', 'team', 'foe', 'turn', 'place', 'cat']);
/** the most `every` can be, and the longest line a Perk says */
export const FX_EVERY = 99;
export const FX_SAY = 40;

/**
 * @typedef {{ weather?: string, type?: string[], team?: string[][], lead?: boolean, alone?: boolean, hp?: number,
 *   foe?: string[], turn?: number, newSpecies?: boolean, place?: string, superEffective?: boolean, noFaint?: boolean,
 *   cat?: string, uid?: string }} FxCtx what a moment knows: the weather, the acting Billie's types, every type list
 *   on your team, whether it leads or stands alone, its share of HP, what the foe is, the turn, ...
 * @typedef {Record<string, { n?: number, v?: number, used?: 1, by?: string[] }>} FxMarks
 * @typedef {{ run?: FxMarks | null, battle?: FxMarks | null }} FxState the run's marks and the battle's
 */

/** a row's place in the state: its source and its row number there @param {any} f */
export const fxKey = f => `${f.src}/${f.row || 0}`;
/** a row's (or a grow's) conditions as a list @param {{ if?: string | string[] }} f @returns {string[]} */
export const fxIfs = f => (f.if == null ? [] : Array.isArray(f.if) ? f.if : [f.if]);

/** does one condition hold? A thing the moment doesn't know makes it false @param {string} c @param {FxCtx} ctx */
export function fxCond(c, ctx) {
  if (c.startsWith('hp<')) return ctx.hp != null && ctx.hp < Number(c.slice(3));
  const i = c.indexOf(':'),
    k = i < 0 ? c : c.slice(0, i),
    any = i < 0 ? [] : c.slice(i + 1).split('|'),
    team = ctx.team;
  switch (k) {
    case 'weather':
      return ctx.weather != null && any.includes(ctx.weather);
    case 'type':
      return !!ctx.type && any.some(t => /** @type {string[]} */ (ctx.type).includes(t));
    case 'team':
      return !!team && team.some(ty => any.some(t => ty.includes(t)));
    case 'mono':
      return !!team && team.length > 0 && team[0].some(t => team.every(ty => ty.includes(t)));
    case 'alone':
    case 'lead':
    case 'newSpecies':
    case 'superEffective':
    case 'noFaint':
      return ctx[k] === true;
    case 'notLead':
      return ctx.lead === false;
    case 'foe':
      return !!ctx.foe && any.some(t => /** @type {string[]} */ (ctx.foe).includes(t));
    case 'turn':
      return ctx.turn != null && any.some(n => Number(n) === ctx.turn);
    case 'place':
      return ctx.place != null && any.includes(ctx.place);
    case 'cat':
      return ctx.cat != null && any.includes(ctx.cat);
  }
  return false;
}

/** the marks the run's counters live in (the battle's when there is no run) @param {FxState} st */
export const runMarks = st => st.run || st.battle || null;
/** a mark, made when first written @param {FxMarks} o @param {string} key */
export const mark = (o, key) => o[key] || (o[key] = {});

/** may this row act now: its conditions hold and its once mark is not spent @param {any} f @param {FxCtx} ctx
 * @param {FxState} st */
export function fxLive(f, ctx, st) {
  if (!fxIfs(f).every(c => fxCond(c, ctx))) return false;
  if (!f.once) return true;
  const key = fxKey(f),
    M = f.once === 'run' ? runMarks(st) : st.battle,
    m = M && M[key];
  if (!m) return true;
  return f.once === 'billie' ? !(m.by || []).includes(ctx.uid || '') : !m.used;
}

/** spend a row's once mark (nothing without one, or without the marks it needs) @param {any} f @param {FxCtx} ctx
 * @param {FxState} st */
export function fxSpend(f, ctx, st) {
  if (!f.once) return;
  const M = f.once === 'run' ? runMarks(st) : st.battle;
  if (!M) return;
  const m = mark(M, fxKey(f));
  if (f.once === 'billie') m.by = [...(m.by || []), ctx.uid || ''];
  else m.used = 1;
}

/** a row with its number as it is now: its growth added, then counted per team type (within FX_LIMIT for a
 * multiplier); the row itself without grow or per @template {any} F @param {F} f @param {FxCtx} ctx
 * @param {FxMarks | null | undefined} run the run's marks @returns {F} */
export function fxRowNow(f, ctx, run) {
  const r = /** @type {any} */ (f);
  if (!r.grow && !r.per) return f;
  const v = r.grow ? ((run && run[fxKey(r)]) || {}).v || 0 : 0,
    n = r.per === 'teamTypes' ? new Set((ctx.team || []).flat()).size : 1,
    o = { ...r };
  if ('mult' in r) o.mult = Math.min(FX_LIMIT.hi, Math.max(FX_LIMIT.lo, 1 + (r.mult + v - 1) * n));
  if ('stages' in r) o.stages = Math.trunc((r.stages + v) * n);
  if ('share' in r) o.share = (r.share + v) * n;
  if ('n' in r) o.n = Math.trunc((r.n + v) * n);
  return o;
}

/** the rows that count at a reading point (a kind read where it always acts): those without `when` that may act now,
 * each with its number as it is now. Nothing is spent @param {any[] | null | undefined} fx @param {FxCtx} ctx
 * @param {FxState} st @returns {any[]} */
export const fxAt = (fx, ctx, st) =>
  (fx || []).filter(f => !f.when && fxLive(f, ctx, st)).map(f => fxRowNow(f, ctx, runMarks(st)));
provide({ fxAt }); /* to-module */

/** the rows of `when` that would act at its next coming, without counting or spending (a hit's damage is worked out
 * before the hit lands; fxFire counts it after) @param {any[] | null | undefined} fx @param {string} when
 * @param {FxCtx} ctx @param {FxState} st @returns {any[]} */
export function fxPeek(fx, when, ctx, st) {
  const R = runMarks(st);
  return (fx || [])
    .filter(
      f =>
        f.when === when && fxLive(f, ctx, st) && (!f.every || ((R && R[fxKey(f)] && R[fxKey(f)].n) || 0) + 1 >= f.every)
    )
    .map(f => fxRowNow(f, ctx, R));
}

/** a grow's value moved by `by`, kept between 0 and its max (a negative max: between max and 0)
 * @param {number} v @param {number} max */
export const growClamp = (v, max) => (max >= 0 ? Math.min(max, Math.max(0, v)) : Math.max(max, Math.min(0, v)));

/**
 * A moment comes: rows that grow on it grow (or reset), rows of that `when` count it (`every`), and those that act
 * now spend their once marks and are returned, each with its number as it is now. The caller does what each kind
 * does at that moment. `only` limits it to one source's rows (a Perk taken).
 * @param {any[] | null | undefined} fx @param {string} when @param {FxCtx} ctx @param {FxState} st
 * @param {string} [only] @returns {any[]}
 */
export function fxFire(fx, when, ctx, st, only) {
  const out = [],
    R = runMarks(st);
  for (const f of fx || []) {
    if (only != null && f.src !== only) continue;
    const key = fxKey(f),
      g = f.grow;
    if (g && R) {
      if (g.reset === when) {
        if (R[key] && R[key].v) R[key].v = 0;
      } else if (g.on === when && fxIfs(g).every(c => fxCond(c, ctx))) {
        const m = mark(R, key);
        m.v = growClamp((m.v || 0) + g.by, g.max);
      }
    }
    if (f.when !== when || !fxLive(f, ctx, st)) continue;
    if (f.every) {
      if (!R) continue;
      const m = mark(R, key);
      m.n = (m.n || 0) + 1;
      if (m.n < f.every) continue;
      m.n = 0;
    }
    fxSpend(f, ctx, st);
    out.push(fxRowNow(f, ctx, R));
  }
  return out;
}

/** does any row keep state (a counter, a growth or a once mark)? @param {any[] | null | undefined} fx */
export const fxStateful = fx => (fx || []).some(f => f.every || f.grow || f.once);
provide({ fxStateful }); /* to-module */

/** a run's marks (run.perkState), made when first needed @param {any} run @returns {FxMarks} */
export const fxRunMarks = run => run.perkState || (run.perkState = {});
provide({ fxRunMarks }); /* to-module */

/** PK-1: how many levels foes are up on a run: the level rows of all its rows (Perks, boons, its Expedition and
 * challenges, the hub folk's, residents'; was the Expedition's and challenges' alone, modifiers.js modFoeLevels),
 * summed with their growth; 0 in the hub. Nothing a battle knows applies here, so a row with `if` never counts
 * @param {any} run @param {Record<string, Perk>} [perks] */
export const fxRunFoeLevels = (run, perks = PERKS) =>
  run
    ? fxAt(fxOfRun(run, perks), {}, { run: run.perkState }).reduce((a, f) => a + (f.kind === 'level' ? f.n : 0), 0)
    : 0;
provide({ fxRunFoeLevels }); /* to-module */
/** PK-1: what the run's boss's HP is multiplied by: the product of all its bossHp rows (1 when none; was the
 * modifiers' alone, modifiers.js modBossHp) @param {any} run @param {Record<string, Perk>} [perks] */
export const fxRunBossHp = (run, perks = PERKS) =>
  run
    ? fxAt(fxOfRun(run, perks), {}, { run: run.perkState }).reduce((a, f) => a * (f.kind === 'bossHp' ? f.mult : 1), 1)
    : 1;
provide({ fxRunBossHp }); /* to-module */

/** PK-1: the debug log's relicState: the run's Perk marks, counters only ({'<source>/<row>': {n, v, used}}; null with
 * none): numbers the run keeps, nothing about the player @param {any} run
 * @returns {Record<string, { n?: number, v?: number, used?: 1 }> | null} */
export function fxStateLog(run) {
  const P = run && run.perkState;
  if (!P || !Object.keys(P).length) return null;
  return Object.fromEntries(
    Object.entries(P).map(([k, m]) => [
      k,
      Object.fromEntries(['n', 'v', 'used'].filter(q => typeof m[q] === 'number').map(q => [q, m[q]])),
    ])
  );
}
