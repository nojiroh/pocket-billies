// @ts-check
'use strict';
/* ================= RULES =================
   Phase 04e: the game's rules outside battle, moved here from game-state.js: a Billie's stats, levels, moves and
   evolution, the team and storage, the trip along the roads (in metres) and its gates, the wild Billies on each
   place's map, walking and eggs, and the small helpers they share.
   Logic only (game/js/logic/): no DOM, WebGL or window, so it runs in plain Node (tools/test/logic.test.mjs). The data
   tables come from game-data.js; the save, the battle and the interface state (saveData, activeBattle, uiState), and
   what the rules tell the interface (save, toast, render), come through hooks.js, filled by game-state.js and ui.js on
   the page or by a test in Node. */
/** @import { Billy, PartInstance, RobotFit } from '../../types/save-data' */
/** @import { RobotSlot } from '../../types/game-data' */
/** @import { Trainer } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  JINGLES,
  breedName,
  coatRoll,
  environmentOdds,
  factionBotSp,
  factionWildChance,
  fieldMoveState,
  fieldMoveText,
  fxOfRun,
  fxSplice,
  jingle,
  provide,
  ranchNow,
  ranchStop,
  runNodeSeed,
  runWeather,
  save,
  saveData,
  soundEffect,
  storyHolds,
  toast,
  uiState,
  waterWildOdds,
  wildHabitat,
  wildRareList,
} from '../hooks.js';
import { random } from '../util.js';
import {
  COATS,
  EGGS,
  EGG_TIERS,
  FACTIONS,
  FIELD_MOVES,
  GENES,
  ITEMS,
  LINE_BY_ID,
  LOCATIONS,
  LOCATION_BY_ID,
  MOVES,
  PERKS,
  POOLS,
  ROADS_BY_NODE,
  ROBOTS,
  RULES,
  SPECIES,
  SPECIES_FORMS,
  STAT_IDS,
  TRAINERS,
  gameData,
  isTown,
  trainersAt,
  typeEffectiveness,
} from '../game-data.js';
import { rngFn } from './rng.js';
import { wildOddsBy } from './weather.js';
import { partsLean, partsPrime, partsStatFactor, partsWeightRatio } from './parts.js';
import { graftKey, graftSet } from './graft-art.js';
import { augBase, augFit, augLimb, augMoves } from './augments.js';
import {
  geneWords,
  graftFields,
  graftFit,
  graftRel,
  graftStability,
  graftTraits,
  graftTypes,
  graftUnstable,
  wildSplice,
} from './genes.js';
import {
  ROBOT_LIMBS,
  ROBOT_SLOTS,
  isRobot,
  isRobotSp,
  moveSources,
  newPart,
  partFits,
  robotGemDef,
  robotMoves,
  robotPartDef,
  robotRules,
  robotSp,
  speciesOf,
  validRobot,
} from './fighters.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  addBilly: [() => addBilly, v => (addBilly = v)],
  // @ts-expect-error -- replaced on purpose
  addEgg: [() => addEgg, v => (addEgg = v)],
  // @ts-expect-error -- replaced on purpose
  addPart: [() => addPart, v => (addPart = v)],
  // @ts-expect-error -- replaced on purpose
  addWalked: [() => addWalked, v => ((addWalked = v), provide({ addWalked }))],
  allBillies: [() => allBillies],
  // @ts-expect-error -- replaced on purpose
  autoSlot: [() => autoSlot, v => (autoSlot = v)],
  billyAug: [() => billyAug],
  billyBuild: [() => billyBuild],
  // @ts-expect-error -- replaced on purpose
  billyFieldTypes: [() => billyFieldTypes, v => (billyFieldTypes = v)],
  // @ts-expect-error -- replaced on purpose
  billyGeneFx: [() => billyGeneFx, v => ((billyGeneFx = v), provide({ billyGeneFx }))],
  billyGraft: [() => billyGraft],
  billyName: [() => billyName],
  billyPrime: [() => billyPrime],
  billyRel: [() => billyRel],
  // @ts-expect-error -- replaced on purpose
  billySpliceCost: [() => billySpliceCost, v => ((billySpliceCost = v), provide({ billySpliceCost }))],
  billySpliced: [() => billySpliced],
  billyTypes: [() => billyTypes],
  // @ts-expect-error -- replaced on purpose
  billyUnstable: [() => billyUnstable, v => (billyUnstable = v)],
  billyWeight: [() => billyWeight],
  // @ts-expect-error -- replaced on purpose
  blockerAt: [() => blockerAt, v => (blockerAt = v)],
  brokenParts: [() => brokenParts],
  buildLean: [() => buildLean],
  // @ts-expect-error -- replaced on purpose
  buildRobot: [() => buildRobot, v => (buildRobot = v)],
  buildStatFactor: [() => buildStatFactor],
  buildWeightRatio: [() => buildWeightRatio],
  canEnter: [() => canEnter],
  // @ts-expect-error -- replaced on purpose
  canEvolve: [() => canEvolve, v => (canEvolve = v)],
  canRide: [() => canRide],
  // @ts-expect-error -- replaced on purpose
  cleanBuild: [() => cleanBuild, v => (cleanBuild = v)],
  cleanName: [() => cleanName],
  coatPrefix: [() => coatPrefix],
  dexCaught: [() => dexCaught],
  dexSeen: [() => dexSeen],
  distanceText: [() => distanceText],
  // @ts-expect-error -- replaced on purpose
  dropEncounter: [() => dropEncounter, v => (dropEncounter = v)],
  eggKm: [() => eggKm],
  eggSlotCount: [() => eggSlotCount],
  // @ts-expect-error -- replaced on purpose
  encounterBuild: [() => encounterBuild, v => (encounterBuild = v)],
  // @ts-expect-error -- replaced on purpose
  encounterPoolHere: [() => encounterPoolHere, v => (encounterPoolHere = v)],
  // @ts-expect-error -- replaced on purpose
  encounterRunVisits: [() => encounterRunVisits, v => (encounterRunVisits = v)],
  // @ts-expect-error -- replaced on purpose
  encounterStock: [() => encounterStock, v => (encounterStock = v)],
  // @ts-expect-error -- replaced on purpose
  encountersHere: [() => encountersHere, v => (encountersHere = v)],
  // @ts-expect-error -- replaced on purpose
  evolutionHint: [() => evolutionHint, v => (evolutionHint = v)],
  evolutionItemName: [() => evolutionItemName],
  // @ts-expect-error -- replaced on purpose
  evolve: [() => evolve, v => (evolve = v)],
  // @ts-expect-error -- replaced on purpose
  feedLevels: [() => feedLevels, v => (feedLevels = v)],
  fieldOpen: [() => fieldOpen],
  findBilly: [() => findBilly],
  // @ts-expect-error -- replaced on purpose
  fitPart: [() => fitPart, v => (fitPart = v)],
  formatNumber: [() => formatNumber],
  // @ts-expect-error -- replaced on purpose
  gainXp: [() => gainXp, v => (gainXp = v)],
  // @ts-expect-error -- replaced on purpose
  gateOwner: [() => gateOwner, v => (gateOwner = v)],
  // @ts-expect-error -- replaced on purpose
  gateText: [() => gateText, v => (gateText = v)],
  geneData: [() => geneData],
  // @ts-expect-error -- replaced on purpose
  geneLimit: [() => geneLimit, v => ((geneLimit = v), provide({ geneLimit }))],
  // @ts-expect-error -- replaced on purpose
  hatchEgg: [() => hatchEgg, v => (hatchEgg = v)],
  hatchable: [() => hatchable],
  // @ts-expect-error -- replaced on purpose
  healAll: [() => healAll, v => ((healAll = v), provide({ healAll }))],
  hereLocation: [() => hereLocation],
  isPrime: [() => isPrime],
  limbKeys: [() => limbKeys],
  // @ts-expect-error -- replaced on purpose
  limbsOf: [() => limbsOf, v => (limbsOf = v)],
  // @ts-expect-error -- replaced on purpose
  makeBilly: [() => makeBilly, v => ((makeBilly = v), provide({ makeBilly }))],
  // @ts-expect-error -- replaced on purpose
  makeRobot: [() => makeRobot, v => ((makeRobot = v), provide({ makeRobot }))],
  maxHp: [() => maxHp],
  maxLevel: [() => maxLevel],
  metresToKm: [() => metresToKm],
  moveSlotCount: [() => moveSlotCount],
  // @ts-expect-error -- replaced on purpose
  moveSourceLimbs: [() => moveSourceLimbs, v => (moveSourceLimbs = v)],
  // @ts-expect-error -- replaced on purpose
  moveUsable: [() => moveUsable, v => (moveUsable = v)],
  // @ts-expect-error -- replaced on purpose
  movesAt: [() => movesAt, v => (movesAt = v)],
  // @ts-expect-error -- replaced on purpose
  movesOf: [() => movesOf, v => (movesOf = v)],
  newUid: [() => newUid],
  nextTripNode: [() => nextTripNode],
  partBroken: [() => partBroken],
  partHpLeft: [() => partHpLeft],
  // @ts-expect-error -- replaced on purpose
  partMaxHp: [() => partMaxHp, v => (partMaxHp = v)],
  partRules: [() => partRules],
  partSlots: [() => partSlots],
  partsDamaged: [() => partsDamaged],
  pathFrom: [() => pathFrom],
  // @ts-expect-error -- replaced on purpose
  pickWeighted: [() => pickWeighted, v => (pickWeighted = v)],
  plural: [() => plural],
  // @ts-expect-error -- replaced on purpose
  primeBuild: [() => primeBuild, v => (primeBuild = v)],
  // @ts-expect-error -- replaced on purpose
  refreshRobot: [() => refreshRobot, v => (refreshRobot = v)],
  // @ts-expect-error -- replaced on purpose
  repairParts: [() => repairParts, v => (repairParts = v)],
  riderName: [() => riderName],
  // @ts-expect-error -- replaced on purpose
  riderOf: [() => riderOf, v => ((riderOf = v), provide({ riderOf }))],
  robotStartLevel: [() => robotStartLevel],
  // @ts-expect-error -- replaced on purpose
  rollBuild: [() => rollBuild, v => (rollBuild = v)],
  // @ts-expect-error -- replaced on purpose
  rollPartSize: [() => rollPartSize, v => (rollPartSize = v)],
  setTrip: [() => setTrip, v => setSetTrip(v)],
  // @ts-expect-error -- replaced on purpose
  spawn: [() => spawn, v => (spawn = v)],
  // @ts-expect-error -- replaced on purpose
  spawnBot: [() => spawnBot, v => (spawnBot = v)],
  // @ts-expect-error -- replaced on purpose
  spawnRare: [() => spawnRare, v => (spawnRare = v)],
  speciesStep: [() => speciesStep],
  // @ts-expect-error -- replaced on purpose
  spliceReport: [() => spliceReport, v => (spliceReport = v)],
  // @ts-expect-error -- replaced on purpose
  spliceSet: [() => spliceSet, v => (spliceSet = v)],
  // @ts-expect-error -- replaced on purpose
  spliceWords: [() => spliceWords, v => (spliceWords = v)],
  // @ts-expect-error -- replaced on purpose
  stat: [() => stat, v => (stat = v)],
  // @ts-expect-error -- replaced on purpose
  stopTrip: [() => stopTrip, v => (stopTrip = v)],
  teamSize: [() => teamSize],
  // @ts-expect-error -- replaced on purpose
  toBox: [() => toBox, v => (toBox = v)],
  // @ts-expect-error -- replaced on purpose
  toTeam: [() => toTeam, v => (toTeam = v)],
  today: [() => today],
  // @ts-expect-error -- replaced on purpose
  tripTo: [() => tripTo, v => (tripTo = v)],
  // @ts-expect-error -- replaced on purpose
  unstableName: [() => unstableName, v => (unstableName = v)],
  // @ts-expect-error -- replaced on purpose
  unstableTidy: [() => unstableTidy, v => ((unstableTidy = v), provide({ unstableTidy }))],
  // @ts-expect-error -- replaced on purpose
  upgradePart: [() => upgradePart, v => (upgradePart = v)],
  // @ts-expect-error -- replaced on purpose
  walkDistances: [() => walkDistances, v => (walkDistances = v)],
  walkedUnsaved: [() => walkedUnsaved, v => (walkedUnsaved = v)],
  // @ts-expect-error -- replaced on purpose
  wildList: [() => wildList, v => (wildList = v)],
  wildPrize: [() => wildPrize],
  xpFor: [() => xpFor],
});
/* eslint-enable no-func-assign */
provide({ addWalked, billyGeneFx, billySpliceCost, geneLimit, healAll, makeBilly, makeRobot, riderOf, unstableTidy });
export function setSetTrip(v) {
  // @ts-expect-error -- replaced on purpose
  setTrip = v; // eslint-disable-line no-func-assign
  provide({ setTrip });
}
/* to-module: end */
/* phase 02: a name the player typed, or that came from a backup file or a friend, loses the characters that could
   end a piece of HTML (< > " & `) and control characters, so it is safe in any page text or attribute */
export const cleanName = (s, max) =>
  String(s == null ? '' : s)
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f<>"&`]/g, '')
    .trim()
    .slice(0, max);
provide({ cleanName }); /* to-module */
export const formatNumber = n => Math.floor(n).toLocaleString('en-US');
provide({ formatNumber }); /* to-module */
/* RL-8: on a run, from the run's own counter (run.uidN: 'r' + the runs played before + '-' + n), so a run made again
   from its seed (a resume, its simulation) gives its Billies, encounters and eggs the same ids; the hub's from the
   clock as before */
export const newUid = () => {
  const run = saveData && saveData.run;
  if (run) return `r${(saveData.meta && saveData.meta.runs) || 0}-${run.uidN++}`;
  return 'm' + Date.now().toString(36) + Math.floor(random() * 1e8).toString(36);
};
export const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const plural = (n, w) => `${formatNumber(n)} ${w}${n === 1 ? '' : 's'}`;
provide({ plural }); /* to-module */
/** one id from [id, weight] pairs; rnd is the random source (a run passes its seeded stream, logic/rng.js rngFn) */
export function pickWeighted(list, rnd = random) {
  const tot = list.reduce((a, b) => a + b[1], 0);
  let r = rnd() * tot;
  for (const [id, w] of list) {
    r -= w;
    if (r <= 0) return id;
  }
  return list[0][0];
}

/* ---------- state ---------- */
export const xpFor = L => Math.floor(RULES.progression.xpFactor * L * L * L);
/** RL-13: how far along its line a species is: 0 a first stage, 1 a middle one, 2 a final form whatever its stage
 * number (a two-stage line's final is stage 1 and a Billie with no evolutions stage 0, yet both have a final form's
 * stats: game-data.js). What a level may field and what a Billie costs read this @param {any} S a species (SPECIES) */
export const speciesStep = S => (!S ? 0 : S.next ? Math.min(1, S.stage) : 2);
provide({ speciesStep }); /* to-module */
export const maxLevel = () => RULES.progression.maxLevel,
  moveSlotCount = () => RULES.progression.moveSlots,
  teamSize = () => RULES.progression.teamSize;

/* ---------- parts (phase 16, docs/phases/16) ----------
   Every Billie has a size (S, M or L) for each part slot: head, body, front, back and sig (its signature part). Wild
   ones roll their sizes; starters and trainers have all M, which makes them Prime. Bigger parts weigh more: more
   Attack and Sp. Atk, less Speed, capped. The numbers are in rules.json "parts" (the Studio's Parts section). */
/** @import { Build, PartSize } from '../../types/save-data' */
export const partRules = () => RULES.parts;
export const partSlots = () => (RULES.parts ? RULES.parts.slots : []);
/** @returns {Build} all M: a Prime build */
export function primeBuild() {
  /** @type {Build} */
  const b = {};
  for (const k of partSlots()) b[k] = 'M';
  return b;
}
/** @returns {PartSize} one size, by the odds */
export function rollPartSize(rnd = random) {
  const S = RULES.parts.sizes,
    list = /** @type {[string, number][]} */ (Object.keys(S).map(k => [k, S[k].odds]));
  return /** @type {PartSize} */ (pickWeighted(list, rnd));
}
/** @returns {Build} a wild Billie's sizes */
export function rollBuild(rnd = random) {
  /** @type {Build} */
  const b = {};
  for (const k of partSlots()) b[k] = rollPartSize(rnd);
  return b;
}
/** @param {any} b @returns {Build} a build with every slot, unknown sizes as M (an old save, hand-made data) */
export function cleanBuild(b) {
  const out = primeBuild(),
    S = RULES.parts ? RULES.parts.sizes : {};
  if (b && typeof b === 'object') for (const k in out) if (S[b[k]]) out[k] = b[k];
  return out;
}
/** an encounter keeps the sizes it appeared with; one queued before parts existed gets them now */
export function encounterBuild(q) {
  if (!q.build) q.build = rollBuild();
  return cleanBuild(q.build);
}
export const billyBuild = m => cleanBuild(m && m.build);
/** @param {Build} b @param {boolean} [spliced] SP-2: a splice is never Prime */
export const isPrime = (b, spliced) => partsPrime(RULES.parts, b, spliced);
/** @param {Build} b the weight as a share of the species' own weight (1 = all M)
 * @param {Record<string, number> | null} [rel] SP-2: the spliced slots' relative weights (billyRel) */
export const buildWeightRatio = (b, rel) => partsWeightRatio(RULES.parts, b, rel);
/** @returns {number} a Billie's weight in kg (its species' weight times its build; SP-2: its foreign parts weigh what
 * they did on their donors) */
export const billyWeight = m => Math.round(speciesOf(m).wt * buildWeightRatio(billyBuild(m), billyRel(m)) * 10) / 10;
/* SP-2: the game's data for logic/genes.js @returns {import('./genes.js').GeneData} */
export const geneData = () => ({
  kitBuilds: gameData.kitBuilds || { forms: [] },
  partKits: /** @type {import('../../types/game-data').PartKits} */ (gameData.partKits),
  genes: GENES,
  species: SPECIES,
  parts: RULES.parts,
  /* SP-5: Augments are robots.json parts (logic/augments.js) */
  robots: ROBOTS,
  robotRules: robotRules(),
});
/** SP-2: a Billie's (or an encounter's) splice, the slots that still fit it; null for none or a robot. SP-5: but
 * not a slot an Augment holds @param {{ sp: string, kind?: string, graft?: Record<string, string>, aug?: any } | null | undefined} m */
export const billyGraft = m => {
  if (!m || !m.graft || m.kind === 'robot') return null;
  const g = graftFit(geneData(), m.sp, m.graft),
    a = g && m.aug ? billyAug(m) : null;
  /* SP-5: a slot an Augment holds has no Gene */
  if (g && a) for (const slot of Object.keys(a)) delete g[slot];
  return g && Object.keys(g).length ? g : null;
};
provide({ billyGraft }); /* to-module */
/** SP-5: a Billie's (or an encounter's) Augments, the slots that still fit it; null for none or a robot
 * @param {{ sp: string, kind?: string, aug?: any } | null | undefined} m @returns {import('./augments.js').Aug | null} */
export const billyAug = m => (m && m.aug && m.kind !== 'robot' ? augFit(geneData(), m.sp, m.aug) : null);
provide({ billyAug }); /* to-module */
/** SP-5: spliced at all: a Gene or an Augment (never Prime; Unstable can come with either) @param {any} m */
export const billySpliced = m => !!(billyGraft(m) || billyAug(m));
/** SP-4: the Stability a Billie's splice spends (0 with none; starter points charge for it)
 * @param {{ sp: string, kind?: string, graft?: Record<string, string> } | null | undefined} m */
export function billySpliceCost(m) {
  return m && billySpliced(m) ? graftStability(geneData(), m.sp, billyGraft(m), undefined, billyAug(m)).cost : 0;
}
/** SP-2: per spliced slot, its part's weight over the Billie's own part's; null with no splice
 * @param {{ sp: string, kind?: string, graft?: Record<string, string> } | null | undefined} m */
export const billyRel = m => (m && billySpliced(m) ? graftRel(geneData(), m.sp, billyGraft(m), billyAug(m)) : null);
/** SP-2: a Billie's types: its species', the second replaced by its heaviest dominant Gene's (logic/genes.js
 * graftTypes); a robot's or an unspliced Billie's are its species' own @param {any} m @returns {string[]} */
export const billyTypes = m =>
  billySpliced(m) ? graftTypes(geneData(), m.sp, billyGraft(m), m.build, billyAug(m)) : speciesOf(m).types;
/** SP-4: a Billie's types for the field moves: its own (billyTypes) and, for each part that counts for a field move
 * (genes.json field: fins for Surf), that move's type @param {any} m @returns {string[]} */
export function billyFieldTypes(m) {
  const own = billyTypes(m);
  if (!billySpliced(m)) return own;
  const more = graftFields(geneData(), m.sp, billyGraft(m), billyAug(m))
    .map(f => FIELD_MOVES[f] && FIELD_MOVES[f].type)
    .filter(t => t && !own.includes(t));
  return more.length ? [...own, ...new Set(more)] : own;
}
/** SP-3: a spliced Billie's foreign parts in words, in slot order ("a shark’s tail"); [] with no splice
 * @param {{ sp: string, kind?: string, graft?: Record<string, string> } | null | undefined} m @returns {string[]} */
export function spliceWords(m) {
  const g = billyGraft(m);
  return g
    ? Object.entries(g)
        .map(([slot, donor]) => geneWords(geneData(), slot, donor))
        .filter(Boolean)
    : [];
}
/** SP-2: the debug log's splices: per spliced Billie on the team, its place, species, splice code, Stability, traits
 * and types (data ids only: no names) */
export function spliceReport() {
  return (saveData.team || [])
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => billySpliced(m))
    .map(({ m, i }) => {
      const g = billyGraft(m),
        a = billyAug(m),
        st = graftStability(geneData(), m.sp, g, geneLimit(), a);
      return {
        at: i,
        sp: m.sp,
        graft: graftKey(g),
        /* SP-5: its Augments, slot=part+upgrade (data ids only) */
        ...(a
          ? {
              aug: Object.entries(a)
                .map(([s, p]) => `${s}=${p.id}+${p.up || 0}`)
                .join(','),
            }
          : {}),
        cost: st.cost,
        limit: st.limit,
        unstable: st.unstable,
        traits: g ? graftTraits(geneData(), m.sp, g) : [],
        types: billyTypes(m),
      };
    });
}
/** SP-2: an Unstable Billie's roll (its raised and lowered stats and merged name, Billy.unstable); null with no splice.
 * SP-4: a stored fact, settled by unstableTidy with its owner's limit (yours: the Gene Bank's; a wild one's: the
 * default), so it is never worked out again here @param {any} m
 * @returns {{ up: string, down: string, name: string } | null} */
export function billyUnstable(m) {
  return m && m.unstable && billySpliced(m) ? m.unstable : null;
}
/** SP-4: the Stability limit your Billies are held to: the Gene Bank's level's (genes.json bank.levels; buildings.json
 * genebank, a level raised by its unlock rows), the default (stability.limit) with no Bank data @param {any} [s] */
export function geneLimit(s = saveData) {
  const L = GENES.bank && GENES.bank.levels,
    lv = Math.max(1, (s && s.meta && s.meta.buildings && s.meta.buildings.genebank) || 1);
  return L && L.length ? L[Math.min(lv, L.length) - 1].limit : GENES.stability.limit;
}
/** SP-2: after a splice changes (or the Billie evolves, or a save loads): past the limit it is Unstable, rolled once
 * and kept while it stays past it (a new splice keeps the old roll); within the limit the roll goes. SP-4: the limit
 * is the owner's (geneLimit() for yours; the default for a wild one)
 * @param {any} m @param {() => number} [rnd] @param {number} [limit] */
export function unstableTidy(m, rnd = random, limit) {
  const g = billyGraft(m),
    a = billyAug(m);
  if ((!g && !a) || !graftStability(geneData(), m.sp, g, limit, a).unstable) {
    delete m.unstable;
    return;
  }
  if (m.unstable) return;
  const D = geneData(),
    r = graftUnstable(D, { sp: m.sp, graft: g || undefined, build: m.build, aug: a || undefined }, STAT_IDS, rnd),
    donor = SPECIES[r.donor];
  /* SP-5: an Augment's name merges as a donor's would */
  m.unstable = {
    up: r.up,
    down: r.down,
    name: breedName(speciesOf(m).name, donor ? donor.name : r.name || speciesOf(m).name),
  };
}
/** SP-2: give a Billie (or an encounter) a splice ('' or null takes it off), then settle Unstable (SP-4: with the
 * owner's limit; the default when not given, as for a wild one)
 * @param {any} m @param {Record<string, string> | string | null} graft a graft or a graft code @param {number} [limit] */
export function spliceSet(m, graft, limit) {
  graftSet(m, typeof graft === 'string' ? graft : graftKey(graft));
  unstableTidy(m, random, limit);
}
/** SP-2: a spliced Billie's own effect rows (logic/effects.js fxOfBillie): its traits', tagged gene:<trait>, and an
 * Unstable splice's drawback, tagged unstable @param {any} m @returns {(import('../../types/game-data').FxRow & { src: string })[]} */
export function billyGeneFx(m) {
  const g = billyGraft(m);
  if (!g && !billyAug(m)) return [];
  const out = [];
  if (g)
    for (const t of graftTraits(geneData(), m.sp, g))
      for (const f of GENES.traits[t].fx) out.push({ ...f, src: 'gene:' + t });
  if (billyUnstable(m)) for (const f of GENES.unstable.fx) out.push({ ...f, src: 'unstable' });
  return out;
}
/** SP-2: Prime: every part its own and at M @param {any} m */
export const billyPrime = m => isPrime(billyBuild(m), billySpliced(m));
/** @param {Build} b @param {string} k a stat id @param {Record<string, number> | null} [rel] SP-2 (billyRel)
 * @returns {number} what the build does to that stat (1 = nothing) */
export const buildStatFactor = (b, k, rel) => partsStatFactor(RULES.parts, b, k, rel);
/** @param {Build} b phase 06: which way the build leans (attack, speed, lean, off, prime), for the Build tab
 * @param {Record<string, number> | null} [rel] SP-2 (billyRel) */
export const buildLean = (b, rel) => partsLean(RULES.parts, b, rel);

/* ---------- billionaires ---------- */
export function stat(m, k) {
  let b = speciesOf(m).base[STAT_IDS.indexOf(k)];
  /* SP-5: an Augment's share of its part's stats joins the base */
  if (m.aug) {
    const add = augBase(geneData(), m.sp, billyAug(m))[k];
    if (add) b += add;
  }
  let v = k === 'hp' ? Math.floor((2 * b * m.lvl) / 100) + m.lvl + 10 : Math.floor((2 * b * m.lvl) / 100) + 5;
  /* phase 16: its parts (weight and Prime) */
  /* SP-2: and its foreign parts' weight (a splice is never Prime) */
  const rel = m.graft || m.aug ? billyRel(m) : null;
  if (m.build || rel) v = Math.max(1, Math.round(v * buildStatFactor(m.build, k, rel)));
  /* RL-10: an abomination's spike and drawback (rules.json ranch.breed) */
  const mu = m.mut,
    B = mu && mu.k === 'abom' && RULES.ranch && RULES.ranch.breed;
  if (B && (k === mu.up || k === mu.down)) v = Math.max(1, Math.round(v * (k === mu.up ? B.abomUp : B.abomDown)));
  /* SP-2: an Unstable splice's spike and drawback (genes.json unstable), picked from the Billie and its splice */
  const un = m.graft || m.aug ? billyUnstable(m) : null;
  if (un && (k === un.up || k === un.down))
    v = Math.max(1, Math.round(v * (k === un.up ? GENES.unstable.up : GENES.unstable.down)));
  /* v33: an Alpha in battle is much tougher (m.boss); one you caught keeps a little of it (m.alpha) */
  if (m.boss) v = Math.floor(v * (k === 'hp' ? m.boss.hp : m.boss.st));
  else if (m.alpha) v = Math.floor(v * ((RULES.battle && RULES.battle.alphaKeep) ?? 1.08));
  return v;
}
export const maxHp = m => stat(m, 'hp');
provide({ maxHp }); /* to-module */
export function movesAt(lid, lvl) {
  const out = [];
  for (const [lv, mv] of LINE_BY_ID[lid].learn) if (lv <= lvl && !out.includes(mv)) out.push(mv);
  return out.slice(-moveSlotCount());
}
/** studio track ST-0: a coat's name before a Billie's, for the player's words ("Midnight "), or nothing; RO-1: a
 * regional form's coat adds none (the form's name says it)
 * @param {string | undefined} coat */
export const coatPrefix = coat => (coat && COATS[coat] && !COATS[coat].form ? COATS[coat].name + ' ' : '');
/** RO-1: a dex entry (a DEX_ORDER id) counts as seen when it or one of its regional forms is @param {string} id */
export const dexSeen = id => !!saveData.seen[id] || (SPECIES_FORMS[id] || []).some(f => saveData.seen[f]);
/** RO-1: and as caught the same way @param {string} id */
export const dexCaught = id => !!saveData.caught[id] || (SPECIES_FORMS[id] || []).some(f => saveData.caught[f]);
/* alpha 0.5: a Billie remembers where and when it joined you (shown in its details) */
export function makeBilly(sp, lvl, o = {}) {
  const m = {
    uid: newUid(),
    sp,
    lvl,
    xp: xpFor(lvl),
    hp: 0,
    status: null,
    sTurns: 0,
    moves: movesAt(SPECIES[sp].line, lvl),
    nick: '',
    /* phase 16: sizes given (a wild one's), rolled (o.wild) or all M (starters, trainers) */
    build: o.build ? cleanBuild(o.build) : o.wild ? rollBuild() : primeBuild(),
  };
  /* RO-1: a regional form wears its own coat unless it came with another */
  const coat = o.coat || SPECIES[sp].coat;
  if (coat && COATS[coat]) m.coat = coat;
  m.hp = maxHp(m);
  try {
    if (typeof saveData !== 'undefined' && saveData && saveData.trip && LOCATIONS[saveData.trip.node])
      m.met = { n: LOCATIONS[saveData.trip.node].id || saveData.trip.node, t: Date.now() };
  } catch (e) {}
  return m;
}
/* ---------- robots (phase 17): a gem with four parts, a team member like a Billie (logic/fighters.js) ---------- */
/** a robot, from its gem and fitted parts (part instances, or { id } for a trainer's)
 * @param {string} gem @param {RobotFit} fit @param {number} lvl */
export function makeRobot(gem, fit, lvl, o = {}) {
  const f = /** @type {RobotFit} */ (
    Object.fromEntries(
      ROBOT_SLOTS.map(k => [k, { uid: fit[k].uid || newUid(), id: fit[k].id, up: Math.max(0, fit[k].up || 0) }])
    )
  );
  const m = {
    uid: newUid(),
    kind: /** @type {'robot'} */ ('robot'),
    gem,
    fit: f,
    sp: robotSp(gem, f),
    lvl,
    xp: xpFor(lvl),
    hp: 0,
    status: null,
    sTurns: 0,
    moves: robotMoves(gem, f),
    nick: o.nick || '',
    partDmg: {},
  };
  m.hp = maxHp(m);
  return m;
}
/** after its parts change: its sp and moves follow them, and its HP stays the same share of the new max
 * @param {Billy} m @param {number} [previousMaxHp] maximum HP before changing equipment */
export function refreshRobot(m, previousMaxHp) {
  if (!isRobot(m) || !validRobot(m.gem, m.fit)) return;
  const fit = /** @type {RobotFit} */ (m.fit),
    gem = /** @type {string} */ (m.gem),
    was = m.hp > 0 ? m.hp / Math.max(1, previousMaxHp ?? maxHp(m)) : 0;
  m.sp = robotSp(gem, fit);
  m.moves = robotMoves(gem, fit);
  m.hp = m.hp > 0 ? Math.max(1, Math.round(maxHp(m) * was)) : 0;
  m.partDmg = m.partDmg || {};
}
/** SP-5: the limbs that can break: a robot's arms and legs (its fit), a Billie's Augments (each on the limb its
 * slot is: the front's on its side's arm, the back's as legs); null for none @param {any} m
 * @returns {Partial<Record<'armL' | 'armR' | 'legs', PartInstance>> | null} */
export function limbsOf(m) {
  if (!m) return null;
  if (isRobot(m)) return m.fit ? { armL: m.fit.armL, armR: m.fit.armR, legs: m.fit.legs } : null;
  const a = m.aug ? billyAug(m) : null;
  if (!a) return null;
  /** @type {Partial<Record<'armL' | 'armR' | 'legs', PartInstance>>} */
  const out = {};
  for (const [slot, p] of Object.entries(a)) {
    const limb = augLimb(geneData(), slot);
    if (limb && p) out[limb] = p;
  }
  return Object.keys(out).length ? out : null;
}
/** SP-5: the limbs it has, in ROBOT_LIMBS' order ([] for a Billie with no Augment) @param {any} m
 * @returns {('armL' | 'armR' | 'legs')[]} */
export const limbKeys = m => {
  const L = limbsOf(m);
  return L ? ROBOT_LIMBS.filter(k => L[k]) : [];
};
/** a limb's own HP when whole @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export function partMaxHp(m, slot) {
  const L = limbsOf(m),
    P = L && L[slot] && robotPartDef(/** @type {PartInstance} */ (L[slot]).id);
  return Math.max(1, Math.round(maxHp(m) * robotRules().partHpRatio * ((P && P.dur) ?? 1)));
}
/** @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export const partHpLeft = (m, slot) => Math.max(0, partMaxHp(m, slot) - ((m.partDmg && m.partDmg[slot]) || 0));
/** SP-5: a Billie's Augment breaks as a robot's limb does @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export const partBroken = (m, slot) => limbKeys(m).includes(slot) && partHpLeft(m, slot) <= 0;
/** @param {Billy} m @returns {('armL' | 'armR' | 'legs')[]} */
export const brokenParts = m => limbKeys(m).filter(k => partBroken(m, k));
/** the limbs that give a move (a robot's gem: 'gem'); SP-5: a Billie's Augments that bring it, but none when it
 * learned the move itself @param {Billy} m @param {string} mid @returns {string[]} */
export function moveSourceLimbs(m, mid) {
  if (isRobot(m)) return moveSources(/** @type {string} */ (m.gem), /** @type {RobotFit} */ (m.fit), mid);
  const L = limbsOf(m);
  if (!L || (m.moves || []).includes(mid)) return [];
  return limbKeys(m).filter(k => {
    const P = robotPartDef(/** @type {PartInstance} */ (L[k]).id);
    return !!P && P.move === mid;
  });
}
/** can it use this move now? A robot can't use a move whose every part giving it is broken (the gem's always works);
 * SP-5: nor a Billie the move of a broken Augment @param {Billy} m @param {string} mid */
export function moveUsable(m, mid) {
  if (!isRobot(m) && !m.aug) return true;
  const src = moveSourceLimbs(m, mid);
  return !src.length || src.some(k => k === 'gem' || !partBroken(m, /** @type {'armL' | 'armR' | 'legs'} */ (k)));
}
/** SP-5: the moves it can pick in battle: its own, then the moves its Augments bring (genes.json augment.move
 * 'extra'); a robot's and an un-Augmented Billie's are m.moves @param {Billy} m @returns {string[]} */
export function movesOf(m) {
  if (isRobot(m) || !m.aug) return m.moves;
  const more = augMoves(geneData(), m.sp, billyAug(m)).filter(id => MOVES[id] && !m.moves.includes(id));
  return more.length ? [...m.moves, ...more] : m.moves;
}
/** fixes a share (1 = all) of each limb's lost HP; a broken one comes back once it is above zero
 * @param {Billy} m @param {number} share @returns {boolean} whether anything was fixed */
export function repairParts(m, share = 1) {
  if (!m.partDmg || !limbKeys(m).length) return false;
  let any = false;
  for (const k of limbKeys(m)) {
    const d = m.partDmg[k] || 0;
    if (d <= 0) continue;
    const fix = share >= 1 ? d : Math.ceil(partMaxHp(m, k) * share);
    m.partDmg[k] = Math.max(0, d - fix);
    any = true;
  }
  return any;
}
/** does it have damaged parts? @param {Billy} m */
export const partsDamaged = m => limbKeys(m).some(k => ((m.partDmg && m.partDmg[k]) || 0) > 0);
/** puts a part from your parts on a robot; the part it replaces goes back to your parts. A gem (slot 'gem') swaps the
 * robot's gem the same way: the robot keeps its level, the old gem goes back as a spare.
 * @param {Billy} m @param {RobotSlot | 'gem'} slot @param {string} uid a part in saveData.parts @returns {boolean} */
export function fitPart(m, slot, uid) {
  if (!isRobot(m)) return false;
  const i = saveData.parts.findIndex(p => p.uid === uid);
  if (i < 0) return false;
  const p = saveData.parts[i],
    previousMaxHp = maxHp(m);
  if (slot === 'gem') {
    if (!robotGemDef(p.id)) return false;
    saveData.parts.splice(i, 1, { uid: newUid(), id: /** @type {string} */ (m.gem), up: 0 });
    m.gem = p.id;
  } else {
    if (!partFits(p.id, slot)) return false;
    const fit = /** @type {RobotFit} */ (m.fit),
      old = fit[slot];
    saveData.parts.splice(i, 1, old);
    fit[slot] = p;
    if (slot !== 'torso' && m.partDmg) delete m.partDmg[slot];
  }
  refreshRobot(m, previousMaxHp);
  return true;
}
/** builds a new robot from a spare gem and four spare parts; it joins the team, or storage when the team is full
 * @param {string} gemUid @param {Record<RobotSlot, string>} uids @returns {Billy | null} */
export function buildRobot(gemUid, uids) {
  const take = /** @param {string} u */ u => saveData.parts.find(p => p.uid === u);
  const g = take(gemUid);
  if (!g || !robotGemDef(g.id)) return null;
  const fit = /** @type {RobotFit} */ ({});
  for (const k of ROBOT_SLOTS) {
    const p = take(uids[k]);
    if (!p || !partFits(p.id, k) || Object.values(fit).includes(p)) return null;
    fit[k] = p;
  }
  saveData.parts = saveData.parts.filter(p => p !== g && !Object.values(fit).includes(p));
  const m = makeRobot(g.id, fit, robotStartLevel());
  addBilly(m);
  return m;
}
/** a new robot's level: the level of your strongest team member, at least 5 (prototype; ask the owner) */
export const robotStartLevel = () => Math.max(5, ...saveData.team.map(m => m.lvl));
/** adds a part (or a spare gem) to your parts @param {string} id */
export function addPart(id) {
  if (!robotPartDef(id) && !robotGemDef(id)) return null;
  const p = newPart(id, newUid());
  saveData.parts.push(p);
  return p;
}
/** upgrades a part one level (prototype: free; crafting costs come with the workshop) @param {PartInstance} p */
export function upgradePart(p) {
  if (!p || (p.up || 0) >= robotRules().maxUpgrade || !robotPartDef(p.id)) return false;
  const fitted = allBillies()
    .filter(m => isRobot(m) && m.fit && Object.values(m.fit).includes(p))
    .map(m => ({ m, previousMaxHp: maxHp(m) }));
  p.up = (p.up || 0) + 1;
  for (const { m, previousMaxHp } of fitted) refreshRobot(m, previousMaxHp);
  return true;
}
/* SP-2: an Unstable Billie is called by its own and its heaviest donor's names merged, as an abomination is */
export const billyName = m => m.nick || (m.mut && m.mut.name) || unstableName(m) || speciesOf(m).name;
provide({ billyName }); /* to-module */
/** SP-2: an Unstable Billie's merged name ('' when it isn't one) @param {any} m */
export function unstableName(m) {
  const un = m.graft || m.aug ? billyUnstable(m) : null;
  return un ? un.name : '';
}
/* RL-8: during a run storage stays in Copperleaf (the box isn't a run field): only the party counts, so nothing in a run
   reads, heals, merges or moves a Billie that is resting at home */
export const allBillies = () => (saveData.run ? saveData.team.slice() : saveData.team.concat(saveData.box));
export const findBilly = id => allBillies().find(m => m.uid === id);
export function gainXp(m, amt, say) {
  if (m.lvl >= maxLevel() || amt <= 0) return;
  m.xp += amt;
  while (m.lvl < maxLevel() && m.xp >= xpFor(m.lvl + 1)) {
    const old = maxHp(m);
    m.lvl++;
    if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) - old);
    say(`${billyName(m)} grew to level ${m.lvl}.`, { k: 'lvl', uid: m.uid });
    /* phase 17: a robot's moves come from its parts, not from levels */
    if (isRobot(m)) continue;
    for (const [lv, mv] of LINE_BY_ID[speciesOf(m).line].learn) {
      if (lv !== m.lvl || m.moves.includes(mv)) continue;
      if (m.moves.length < moveSlotCount()) {
        m.moves.push(mv);
        say(`${billyName(m)} learned ${MOVES[mv].n}.`);
      } else uiState.learnQ.push({ uid: m.uid, mv });
    }
  }
}
/** RL-12b: a Billie eats a level item (the Protein Bar): it gains `n` levels' worth of XP, learning moves on the way
 * as a battle's XP would (gainXp); the levels gained (0 at the top level or for a robot) @param {any} m
 * @param {number} n @param {(text: string, o?: any) => void} say */
export function feedLevels(m, n, say) {
  if (isRobot(m) || m.lvl >= maxLevel() || !(n > 0)) return 0;
  const from = m.lvl,
    to = Math.min(maxLevel(), m.lvl + Math.floor(n));
  gainXp(m, Math.max(1, xpFor(to) - m.xp), say);
  return m.lvl - from;
}
export function canEvolve(m) {
  const e = speciesOf(m).evo;
  if (!e) return false;
  if (m.evoNo != null && m.lvl <= m.evoNo) return false;
  switch (e.k) {
    case 'lvl':
    case 'split':
      return m.lvl >= e.at;
    case 'idle':
      return !!m.boxedAt && saveData.box.includes(m) && Date.now() - m.boxedAt >= e.ms && m.lvl >= e.min;
    case 'streak':
      return (m.streak || 0) >= e.n && m.lvl >= e.min;
    default:
      return false;
  }
}
export const evolutionItemName = e => (ITEMS[e.item || 'bell'] ? ITEMS[e.item || 'bell'].n : 'Shining Stone');
export function evolutionHint(m) {
  if (isRobot(m)) return 'Robots don’t evolve. They grow with their gem’s level, and change with their parts.';
  const s = speciesOf(m),
    e = s.evo;
  if (!e) return s.rar === 'mythical' ? 'Does not evolve.' : 'Fully evolved.';
  /* a species with an evolution has a next stage (game-data.js sets both, or neither) */
  const nx = SPECIES[/** @type {string} */ (s.next)],
    nm = saveData.seen[nx.id] ? nx.name : 'something bigger';
  switch (e.k) {
    case 'lvl':
      return `Evolves at level ${e.at} into ${nm}.`;
    case 'split': {
      /* SPECIES[null] is undefined, which alt && handles */
      const alt = SPECIES[/** @type {string} */ (s.alt)],
        an = alt && saveData.seen[alt.id] ? alt.name : 'something else';
      return `Evolves at level ${e.at} into ${nm} (the Build path) or ${an} (the Hype path): you choose.`;
    }
    case 'item':
      return `Evolves when you use ${/^[AEIOU]/.test(evolutionItemName(e)) ? 'an' : 'a'} ${evolutionItemName(e)}, once it reaches level ${e.min}.`;
    case 'donate':
      return `Evolves after it gives away ${e.n} items, once it reaches level ${e.min}. ${m.donated || 0} of ${e.n} given.`;
    case 'merge':
      return `Evolves by combining with another ${s.name}, once it reaches level ${e.min}.`;
    case 'idle':
      return `Evolves after resting a full day in storage, once it reaches level ${e.min}.`;
    case 'streak':
      return `Evolves after winning ${e.n} battles in a row as your lead, once it reaches level ${e.min}. Streak: ${m.streak || 0}.`;
    case 'rename':
      return `Evolves when you give it a new nickname, once it reaches level ${e.min}.`;
  }
  return '';
}
/* phase 08: a split line's middle stage takes the path you pick when it evolves: Build (A, its next stage) or Hype
   (B, the other final) */
export function evolve(m, path = 'A') {
  if (typeof jingle === 'function') jingle(JINGLES.evolve, 140);
  const old = maxHp(m),
    from = billyName(m),
    s0 = speciesOf(m);
  m.sp = s0.evo && s0.evo.k === 'split' && s0.alt && path === 'B' ? s0.alt : s0.next;
  /* SP-2: a splice survives evolving (its foreign parts stay and are drawn at the new stage's size); a slot the new
     stage has no bone for loses its Gene */
  if (m.graft) {
    const g = billyGraft(m);
    if (g) m.graft = g;
    else delete m.graft;
  }
  unstableTidy(m, random, geneLimit());
  if (m.hp > 0) m.hp = Math.max(1, Math.min(maxHp(m), m.hp + maxHp(m) - old));
  saveData.caught[m.sp] = 1;
  saveData.seen[m.sp] = 1;
  m.evoNo = null;
  m.streak = 0;
  m.donated = 0;
  return from;
}
export function healAll() {
  if (typeof soundEffect === 'function') soundEffect('heal');
  for (const m of allBillies()) {
    m.hp = maxHp(m);
    m.status = null;
    m.sTurns = 0;
    /* phase 17: a robot's parts are fixed like its HP */
    repairParts(m);
  }
}
/** move a Billie to storage (false during a run: storage stays in Copperleaf) */
export function toBox(m) {
  if (saveData.run) return false;
  const i = saveData.team.indexOf(m);
  if (i >= 0) saveData.team.splice(i, 1);
  if (!saveData.box.includes(m)) saveData.box.push(m);
  m.boxedAt = Date.now();
  return true;
}
/** bring a Billie from storage onto the team (false during a run); one training at the ranch collects what it banked
    and stops (RL-9) */
export function toTeam(m) {
  if (saveData.run) return false;
  if (RULES.ranch && saveData.ranch)
    ranchStop(saveData, m.uid, ranchNow(saveData, Date.now(), RULES.ranch).now, RULES.ranch, toast);
  const i = saveData.box.indexOf(m);
  if (i >= 0) saveData.box.splice(i, 1);
  if (!saveData.team.includes(m)) saveData.team.push(m);
  m.boxedAt = null;
  return true;
}
export function addBilly(m) {
  /* SP-4: a caught spliced Billie is held to your Gene Bank's limit from now on */
  if (m.graft) unstableTidy(m, random, geneLimit());
  /* phase 17: robots aren't in the Guide */
  if (!isRobot(m)) {
    saveData.caught[m.sp] = 1;
    saveData.seen[m.sp] = 1;
  }
  if (saveData.team.length < teamSize()) {
    saveData.team.push(m);
    return 'team';
  }
  /* RL-8: a run's party is full: the Billie waits with the caller until one is released (a team of seven can't be
     saved, and storage is the hub's) */
  if (saveData.run) return 'full';
  m.boxedAt = Date.now();
  saveData.box.push(m);
  return 'box';
}

/* ---------- gates ---------- */
export function gateOwner(seat) {
  return Object.values(TRAINERS).find(T => T.seat && T.seat.id === seat);
}
export function gateText(n) {
  /* Project Story S2: a place the story keeps closed (requires), and what you are told (locked) */
  if (n.requires && !storyHolds(n.requires)) return n.locked || `${n.name} is closed for now.`;
  if (n.gate && !saveData.seats.includes(n.gate) && n.gateText) return n.gateText;
  /* RL-R2: a side area's first place, closed until its field move's obstacle is open: what the obstacle says */
  if (n.field && !fieldOpen()) {
    const M = FIELD_MOVES[n.field];
    if (!M) return 'The way is blocked.';
    const team = saveData.team
        .filter(m => m.hp > 0 && speciesOf(m))
        .map(m => ({ name: billyName(m), types: billyFieldTypes(m) })),
      st = fieldMoveState(M, (saveData.meta || {}).badges, team);
    return st.state === 'ask' ? `Use ${M.name} on what blocks the way first.` : fieldMoveText(M, st.state);
  }
  if (n.ride && !canRide()) {
    const R = RULES.ride || {};
    return `To cross ${n.name} you need a Water Billie${R.minHeight ? ` at least ${R.minHeight} m tall` : ''} in your team to ride on.`;
  }
  if (n.gateText) return n.gateText;
  const T = gateOwner(n.gate);
  return `${n.name} opens once you earn ${T ? T.name + '’s' : 'another'} badge.`;
}
export function blockerAt(i) {
  return trainersAt(i).find(T => T.blocks && !saveData.flags[T.id]) || null;
}
/* ---------- travel: a plan of stops to walk to, one link at a time; an empty plan means staying put ---------- */
/* v24: lake and sea roads need a Water billionaire to ride (rules.ride: types, an optional minHeight in metres); WA-6b:
   the owner dropped the 1.5 m floor (any Water Billie carries you, as RL-R2's Surf), and only one still standing
   (hp > 0, as field-moves.js fieldTeam) does. The tallest rides */
export function riderOf() {
  const R = RULES.ride || { types: ['Water'] };
  /** @type {Billy | null} */
  let best = null;
  for (const m of saveData.team) {
    const sp = speciesOf(m);
    if (!sp || !(m.hp > 0) || !sp.types.some(t => (R.types || ['Water']).includes(t)) || sp.ht < (R.minHeight || 0))
      continue;
    if (!best || sp.ht > speciesOf(best).ht) best = m;
  }
  return best;
}
export const canRide = () => !!riderOf();
export const riderName = () => {
  const m = riderOf();
  return m ? m.nick || speciesOf(m).name : '';
};
provide({ riderName }); /* to-module */
/** RL-R2: whether the run's side area is open (its field move used; logic/run-side.js runSideOpen) */
export const fieldOpen = () => {
  const run = saveData.run;
  return !!(run && run.map && run.map.side && run.map.side.open);
};
export const canEnter = n =>
  (!LOCATIONS[n].field || fieldOpen()) &&
  (!LOCATIONS[n].gate || saveData.seats.includes(LOCATIONS[n].gate)) &&
  (!LOCATIONS[n].ride || canRide()) &&
  (!LOCATIONS[n].requires || storyHolds(LOCATIONS[n].requires));
export const nextTripNode = () => (saveData.trip.plan.length ? saveData.trip.plan[0] : null);
/* shortest walk (in metres) between stops, entering only stops you may enter; returns {d,prev} */
export function walkDistances(from) {
  const N = LOCATIONS.length,
    d = Array(N).fill(Infinity),
    prev = Array(N).fill(-1),
    done = Array(N).fill(false);
  d[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < Infinity && (u < 0 || d[i] < d[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const e of ROADS_BY_NODE[u]) {
      if (!canEnter(e.to)) continue;
      if (u !== from && blockerAt(u) && !saveData.visited[e.to]) continue;
      const nd = d[u] + e.cost;
      if (nd < d[e.to]) {
        d[e.to] = nd;
        prev[e.to] = u;
      }
    }
  }
  return { d, prev };
}
export const pathFrom = (prev, to) => {
  const out = [];
  for (let x = to; x >= 0 && prev[x] >= 0; x = prev[x]) out.unshift(x);
  return out;
};
/* metres from where you stand to stop j, and the plan that gets there */
export function tripTo(j) {
  const node = saveData.trip.node;
  if (j === node) return { metres: 0, plan: [] };
  const D = walkDistances(node);
  if (D.d[j] === Infinity) return null;
  return { metres: D.d[j], plan: pathFrom(D.prev, j) };
}
export function setTrip(j) {
  const t = tripTo(j);
  if (!t) return false;
  saveData.trip.plan = t.plan;
  save();
  return true;
}
export function stopTrip() {
  saveData.trip.plan = [];
  save();
}
/* encounters come from where you are */
export const hereLocation = () => LOCATIONS[saveData.trip.node];
export function encounterPoolHere(node = saveData.trip.node) {
  return POOLS[LOCATIONS[node].pool] || POOLS[Object.keys(POOLS)[0]];
}
/* phase 08: wild Billies live on each place's map (saveData.wild, by location id): a route keeps a few, a town with
   tall grass fewer, other towns none (rooms are not places). A map is full the first time you come; after that one
   more wanders over every minute of play, up to its stock */
export function encounterStock(node) {
  const L = LOCATIONS[node],
    R = RULES.encounters;
  if (!L) return 0;
  /* RL-7: a run's place walked back to holds fewer (rules.json run.wild.back) */
  if (encounterRunVisits(node) > 1) return RULES.run.wild.back;
  /* RL-12b: a waystation (an event's or a stall's place) holds fewer */
  if (L.waystation) return RULES.run.wild.waystation;
  /* RT-2: a run route's trainers stand in for some of its wild Billies */
  if (L.trainerCount) return Math.max(RULES.run.wild.routeMin, RULES.run.wild.route - L.trainerCount);
  if (!isTown(node)) return R.route;
  const sc = L.mapId && gameData.maps ? gameData.maps[L.mapId] : null,
    tiles = sc ? (sc._lite ? sc._lite.tiles : (sc.tiles || []).join('')) : '';
  return tiles.includes('t') ? R.townGrass : 0;
}
/* the list a place's encounters are kept in (made empty if it has none yet) */
export function wildList(node) {
  const W = saveData.wild || (saveData.wild = {}),
    id = LOCATIONS[node].id;
  return (W[id] || (W[id] = { at: saveData.playMs || 0, list: [] })).list;
}
/* RL-7: how many times you have arrived at a run's place (its map node in run.path); 0 for a hub place */
export function encounterRunVisits(node) {
  const L = LOCATIONS[node],
    run = saveData.run;
  return L && L.runNode != null && run ? run.path.filter(i => i === L.runNode).length : 0;
}
export function encountersHere(node = saveData.trip.node) {
  const L = LOCATIONS[node];
  if (!L) return [];
  const W = saveData.wild || (saveData.wild = {}),
    now = saveData.playMs || 0,
    cap = encounterStock(node),
    w = W[L.id],
    visit = encounterRunVisits(node);
  /* RL-7: a run's place is stocked once on each visit, from its own stream (rngFrom(its node's seed, 'wild|' + the
     visit)), and not topped up by play time: a run's time is its days */
  if (visit) {
    if (!w || w.v !== visit) {
      const rnd = rngFn(runNodeSeed(saveData.run.seed, L.runNode), 'wild|' + visit),
        /* SP-3: now and then a wild splice (genes.json wild), from a stream of its own: the stock's species, levels,
           sizes and coats stay what they were */
        spl = rngFn(runNodeSeed(saveData.run.seed, L.runNode), 'splice|' + visit),
        pool = encounterPoolHere(node).list.map(([id]) => id),
        /* SP-6: a run's splice rows (Perks) on the odds */
        odds = fxSplice(fxOfRun(saveData.run, PERKS), 'splice');
      W[L.id] = { at: now, list: [], v: visit };
      /* RT-4: a run route's first visit keeps the last of its stock for a rarer one (rules.json run.wild.rare) */
      /* RL-14: none in a scrapyard, where every wild one is a bot */
      const yard = !!saveData.run.map && saveData.run.map.nodes[/** @type {number} */ (L.runNode)].type === 'scrapyard',
        rare = visit === 1 && !!L.trainerCount && !!RULES.run.wild.rare && cap > 0 && !yard;
      while (W[L.id].list.length < cap - (rare ? 1 : 0)) {
        const q = spawn(false, null, node, rnd);
        /* SP-3: a bot (RL-14) is never spliced and draws nothing from the splice stream */
        const g = isRobotSp(q.sp) ? null : wildSplice(geneData(), q.sp, pool, spl, odds);
        if (!g) continue;
        q.graft = g;
        unstableTidy(q, spl); /* SP-2: past the limit, its Unstable roll, from the same stream (the same on a reload) */
      }
      if (rare) spawnRare(node, rnd);
    }
    return W[L.id].list;
  }
  if (!w) {
    const list = wildList(node);
    while (list.length < cap) spawn(false, null, node);
    return list;
  }
  if (w.list.length >= cap) w.at = now;
  else {
    const every = Math.max(1000, RULES.encounters.refillMs),
      n = Math.floor((now - w.at) / every);
    for (let i = 0; i < n && w.list.length < cap; i++) spawn(false, null, node);
    w.at = w.list.length >= cap ? now : w.at + Math.max(0, n) * every;
  }
  return w.list;
}
/* phase 08: the prize money for beating a wild Billie */
export const wildPrize = lvl => Math.max(0, Math.round(lvl * (RULES.encounters.prizePerLevel || 0)));
/* a battled (or fled-from) encounter leaves the map it was on; a map that was full starts its minute from now */
export function dropEncounter(id) {
  for (const [k, w] of Object.entries(saveData.wild || {})) {
    const L = LOCATION_BY_ID[k],
      full = !!L && w.list.length >= encounterStock(L.node);
    w.list = w.list.filter(q => q.id !== id);
    if (full) w.at = saveData.playMs || 0;
  }
}
/** RT-4: a run route's rarer one: of the rarest of its list (wild-pool.js wildRareList), `up` levels above the rest,
 * never an Alpha; it waits in a hard pocket (route-trainers.js routeRareSpots, the place's rareAt)
 * @param {number} node @param {() => number} rnd */
export function spawnRare(node, rnd) {
  const P = encounterPoolHere(node),
    q = spawn(false, pickWeighted(wildRareList(P.list), rnd), node, rnd);
  q.lvl = Math.min(100, q.lvl + (RULES.run.wild.rare ? RULES.run.wild.rare.up : 0));
  q.rare = 1;
  return q;
}
/** RL-14: a run place's wild bot (factions.json), or null: a draw against its faction's chance (none for a place that
 * can't have one), then the bot by weight and its level, all from rnd; it waits in the tall grass, never an Alpha. The
 * first faction (by id) that can field one here @param {number} where the place (a location) @param {() => number} rnd */
export function spawnBot(where, rnd) {
  const L = LOCATIONS[where],
    run = saveData.run,
    node = L && L.runNode != null && run && run.map ? run.map.nodes[L.runNode] : null;
  if (!node) return null;
  for (const id of Object.keys(FACTIONS).sort()) {
    const F = FACTIONS[id],
      chance = factionWildChance(F, node);
    if (!(chance > 0) || rnd() >= chance) continue;
    const bots = Object.keys(F.bots)
        .sort()
        .filter(k => F.bots[k].weight > 0),
      B = F.bots[pickWeighted(/** @type {[string, number][]} */ (bots.map(k => [k, F.bots[k].weight])), rnd)],
      P = encounterPoolHere(where),
      q = {
        id: newUid(),
        sp: factionBotSp(B),
        lvl: P.lv[0] + Math.floor(rnd() * (P.lv[1] - P.lv[0] + 1)),
        no: ++saveData.serial,
      };
    wildList(where).push(q);
    return q;
  }
  return null;
}
/* RL-2: every outcome draw (species, level, sizes, coat, Alpha) comes from rnd; a run passes its own stream */
export function spawn(gentle, force, node = saveData.trip.node, rnd = random) {
  const P = encounterPoolHere(node),
    L = LOCATIONS[node],
    run = saveData.run;
  /* RL-8: a run's place draws by its forecast for today alone, here in logic (a run has no hour: the same Billies on
     every device, at any time of day, and in a run's simulation); the hub by the real clock's weather and hour */
  const anyRules = /** @type {any} */ (RULES),
    likes = anyRules.env ? anyRules.env.likes : undefined,
    typesOf = (/** @type {string} */ id) => (SPECIES[id] ? SPECIES[id].types : []);
  let list =
    L && L.runNode != null && run && run.map
      ? wildOddsBy(P.list, runWeather(run, L.runNode, run.clock), likes, typesOf)
      : typeof environmentOdds === 'function'
        ? environmentOdds(P.list)
        : P.list;
  /* WA-5a: a place with marsh or bog water draws more of the Billies that like it (logic/water-play.js) */
  if (L && L.marsh) list = waterWildOdds(list, L.marsh, typesOf);
  if (gentle) {
    const my = SPECIES[saveData.starter + '0'].types,
      g = list.filter(([id]) => !SPECIES[id].types.some(t => typeEffectiveness(t, my) > 1));
    if (g.length) list = g;
  }
  /* RL-14: on a run place, now and then the Bureau's bot instead (factions.json wild; every one in a scrapyard). Only
     a place that can have one draws for it, so the others' Billies stay as they were */
  const bot = !force && !gentle ? spawnBot(node, rnd) : null;
  if (bot) return bot;
  const sp = force || pickWeighted(list, rnd),
    lvl = P.lv[0] + Math.floor(rnd() * (P.lv[1] - P.lv[0] + 1));
  const q = {
    id: newUid(),
    sp,
    lvl,
    no: ++saveData.serial,
    build: rollBuild(rnd),
  };
  /* RT-4: a run place's Billie waits in its habitat (by its types): by the water, in the woods, else the tall grass */
  if (L && L.runNode != null) {
    const hab = wildHabitat(SPECIES[sp].types, RULES.run.wild.habitats);
    if (hab !== 'grass') q.hab = hab;
  }
  /* studio track ST-0: a coat, once in its odds (none: never) */
  const coat = coatRoll(COATS, 'wild', rnd) || SPECIES[sp].coat;
  if (coat) q.coat = coat;
  /* v33: now and then an Alpha (once you have two billionaires to stand with your lead) */
  if (!gentle && !force && saveData.team.length >= 2 && rnd() < 1 / (RULES.encounters.alphaOdds || 45)) q.alpha = true;
  wildList(node).push(q);
  return q;
}

/* ---------- walking and eggs ---------- */
/* phase 08: the metres you walk outdoors (walk-view.js movePlayer; not in rooms, on ladders or test benches, and not a
   jump to a new view): the distance on your trainer card. Saved every 20 m. RL-10: walking hatches nothing any more
   (eggs hatch at the ranch on real time, logic/breeding.js) */
export let walkedUnsaved = 0;
export function addWalked(m) {
  if (!saveData.started || !Number.isFinite(m) || m <= 0 || m > 1000) return;
  const S = saveData.stats || (saveData.stats = {});
  S.walked = (S.walked || 0) + m;
  walkedUnsaved += m;
  if (walkedUnsaved < 20) return;
  walkedUnsaved = 0;
  save();
}
export const metresToKm = m => (m / 1000).toFixed(1);
/* a walking distance for people: "80 m", "850 m", "1.2 km" */
export const distanceText = m => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m` : `${metresToKm(m)} km`);
/* an egg's name comes from the distance it needs ("2 km egg"); its tier id is only a key */
export const eggKm = tier => Math.round((EGGS[tier] ? EGGS[tier].need : 0) / 100) / 10;
/* ---------- Seed Rounds ---------- */
export const eggSlotCount = () => Math.max(1, RULES.eggs.slots);
export function autoSlot() {
  for (let sl = 0; sl < eggSlotCount(); sl++) {
    if (saveData.eggs.some(e => e.slot === sl)) continue;
    const e = saveData.eggs.find(e => e.slot == null);
    if (e) e.slot = sl;
  }
}
export function addEgg(tier) {
  if (!EGGS[tier]) return false;
  if (saveData.eggs.length >= RULES.eggs.capacity) {
    toast('You’re carrying too many eggs. Hatch a few first.');
    return false;
  }
  saveData.eggs.push({ id: newUid(), tier, prog: 0, slot: null });
  autoSlot();
  return true;
}
export const hatchable = () => saveData.eggs.filter(e => e.slot != null && e.prog >= EGGS[e.tier].need);
export function hatchEgg(e) {
  if (typeof jingle === 'function') jingle(JINGLES.hatch);
  const T = EGGS[e.tier],
    R = RULES.eggs,
    top = e.tier === EGG_TIERS[EGG_TIERS.length - 1];
  let sp = pickWeighted(T.list);
  if (top && SPECIES[R.mythSpecies] && random() < 1 / R.mythOdds) sp = R.mythSpecies;
  const m = makeBilly(sp, T.lv, { wild: true, coat: coatRoll(COATS, 'egg', random) });
  saveData.eggs = saveData.eggs.filter(x => x !== e);
  saveData.hatched = (saveData.hatched || 0) + 1;
  autoSlot();
  const where = addBilly(m);
  save();
  return { m, where };
}
