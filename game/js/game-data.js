// @ts-check
'use strict';
/* ================= DATA =================
   Everything here is built from the game data (data/*.json, put together as data/gamedata.js), which Pocket Billies
   Studio edits.
   The rest of the game reads these globals, so the file format can change without touching game code.
   Phase 04e: the data is read from globalThis, the page's window; in plain Node (tools/test/logic.test.mjs) a test puts
   its own small data there before it imports this module. */
/**
 * @import { EggTier, Evolution, GameData, LocationData, LocationEntry, Pool, Road, RoadFromNode, RoadLink } from '../types/game-data'
 * @import { CutsceneData, Perk, Seat, Species, TrainerEntry } from '../types/game-data'
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { makeBilly, makeRobot, provide, saveData, storyAllows } from './hooks.js';
import { formSpeciesOf } from './logic/forms.js';
/* eslint-disable no-func-assign */
expose({
  BANTER: [() => BANTER],
  BATTLE_STAGES: [() => BATTLE_STAGES],
  BUILDINGS: [() => BUILDINGS],
  COATS: [() => COATS],
  CURRENCIES: [() => CURRENCIES],
  CUTSCENES: [() => CUTSCENES],
  DATA_WARN: [() => DATA_WARN],
  DEFAULT_EVOLUTIONS: [() => DEFAULT_EVOLUTIONS],
  DEX_ORDER: [() => DEX_ORDER],
  EGGS: [() => EGGS],
  EGG_TIERS: [() => EGG_TIERS],
  EVENTS: [() => EVENTS],
  FACTIONS: [() => FACTIONS],
  FIELD_MOVES: [() => FIELD_MOVES],
  GENES: [() => GENES],
  HIT_EFFECTS_BY_TYPE: [() => HIT_EFFECTS_BY_TYPE],
  HUB_LOCATIONS: [() => HUB_LOCATIONS],
  ITEMS: [() => ITEMS],
  LINES: [() => LINES],
  LINE_BY_ID: [() => LINE_BY_ID],
  LOCATIONS: [() => LOCATIONS],
  LOCATION_BY_ID: [() => LOCATION_BY_ID],
  MODIFIERS: [() => MODIFIERS],
  MOVES: [() => MOVES],
  MUSIC: [() => MUSIC],
  NODE_TYPES: [() => NODE_TYPES],
  PASSIVE: [() => PASSIVE],
  PASSIVE_INFO: [() => PASSIVE_INFO],
  PEOPLE: [() => PEOPLE],
  PERKS: [() => PERKS],
  POOLS: [() => POOLS],
  PYRAMIDS: [() => PYRAMIDS],
  QUESTS: [() => QUESTS],
  RARITY_STAT_TOTALS: [() => RARITY_STAT_TOTALS],
  REWARDS: [() => REWARDS],
  ROADS: [() => ROADS],
  ROADS_BY_NODE: [() => ROADS_BY_NODE],
  ROBOTS: [() => ROBOTS],
  RULES: [() => RULES],
  SEATS: [() => SEATS],
  SET_PIECES: [() => SET_PIECES],
  SHOPS: [() => SHOPS],
  SPECIES: [() => SPECIES],
  SPECIES_FORMS: [() => SPECIES_FORMS],
  STAND_IN_LINES: [() => STAND_IN_LINES],
  START_NODE: [() => START_NODE],
  STATUS_NAMES: [() => STATUS_NAMES],
  STAT_IDS: [() => STAT_IDS],
  STAT_NAMES: [() => STAT_NAMES],
  STORY_DATA: [() => STORY_DATA],
  TRAINERS: [() => TRAINERS],
  TYPES: [() => TYPES],
  TYPE_COLORS: [() => TYPE_COLORS],
  TYPE_RESISTED_BY: [() => TYPE_RESISTED_BY],
  TYPE_STRONG_AGAINST: [() => TYPE_STRONG_AGAINST],
  UNLOCKS: [() => UNLOCKS],
  UNLOCK_DATA: [() => UNLOCK_DATA],
  atOrLast: [() => atOrLast],
  // @ts-expect-error -- replaced on purpose
  exitLength: [() => exitLength, v => (exitLength = v)],
  gameData: [() => gameData],
  hasPassive: [() => hasPassive],
  hubRoadCost: [() => hubRoadCost],
  hubRoadsByNode: [() => hubRoadsByNode],
  // @ts-expect-error -- replaced on purpose
  isTown: [() => isTown, v => (isTown = v)],
  // @ts-expect-error -- replaced on purpose
  locationFullName: [() => locationFullName, v => (locationFullName = v)],
  // @ts-expect-error -- replaced on purpose
  locationKind: [() => locationKind, v => (locationKind = v)],
  // @ts-expect-error -- replaced on purpose
  locationSubtitle: [() => locationSubtitle, v => (locationSubtitle = v)],
  passiveName: [() => passiveName],
  // @ts-expect-error -- replaced on purpose
  rivalSpecies: [() => rivalSpecies, v => (rivalSpecies = v)],
  roadCost: [() => roadCost],
  roadEndNode: [() => roadEndNode],
  // @ts-expect-error -- replaced on purpose
  roadMetres: [() => roadMetres, v => (roadMetres = v)],
  standInList: [() => standInList],
  // @ts-expect-error -- replaced on purpose
  standInSpecies: [() => standInSpecies, v => (standInSpecies = v)],
  standInsWarned: [() => standInsWarned],
  trainerById: [() => trainerById],
  // @ts-expect-error -- replaced on purpose
  trainerRobotOk: [() => trainerRobotOk, v => (trainerRobotOk = v)],
  // @ts-expect-error -- replaced on purpose
  trainerTeam: [() => trainerTeam, v => (trainerTeam = v)],
  trainersAt: [() => trainersAt],
  // @ts-expect-error -- replaced on purpose
  typeEffectiveness: [() => typeEffectiveness, v => (typeEffectiveness = v)],
  typesWith: [() => typesWith],
  warnData: [() => warnData],
  // @ts-expect-error -- replaced on purpose
  worldAddTrainers: [() => worldAddTrainers, v => (worldAddTrainers = v)],
  worldExtra: [() => worldExtra],
  worldExtraMaps: [() => worldExtraMaps],
  // @ts-expect-error -- replaced on purpose
  worldHubBack: [() => worldHubBack, v => (worldHubBack = v)],
  // @ts-expect-error -- replaced on purpose
  worldPut: [() => worldPut, v => (worldPut = v)],
  // @ts-expect-error -- replaced on purpose
  worldSetGraph: [() => worldSetGraph, v => (worldSetGraph = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the check below stops the page when it is missing, so the rest can count on it */
export const gameData = /** @type {GameData} */ (globalThis.GAMEDATA);
provide({ gameData }); /* to-module */
if (!gameData)
  throw new Error(
    'The game data did not load: data/gamedata.js is missing and the data files in data/ could not be read (npm run check:data says what is wrong).'
  );
export const DATA_WARN = [];
export const warnData = m => {
  DATA_WARN.push(m);
  console.warn('[gamedata] ' + m);
};
export const RULES = gameData.rules;
provide({ RULES }); /* to-module */
/* ---------- types ---------- */
export const TYPES = gameData.types.map(t => t.id);
export const TYPE_COLORS = Object.fromEntries(gameData.types.map(t => [t.id, [t.color, t.text || '#fff']]));
provide({ TYPE_COLORS }); /* to-module */
TYPE_COLORS.None = [gameData.untyped.color, gameData.untyped.text || '#fff'];
export const TYPE_STRONG_AGAINST = Object.fromEntries(
  gameData.types.map(t => [t.id, (t.strong || []).filter(x => TYPE_COLORS[x])])
);
export const TYPE_RESISTED_BY = Object.fromEntries(
  gameData.types.map(t => [t.id, (t.weak || []).filter(x => TYPE_COLORS[x])])
);
export const PASSIVE = Object.fromEntries(gameData.types.map(t => [t.id, t.passive || '']));
export const HIT_EFFECTS_BY_TYPE = Object.fromEntries(
  gameData.types.map(t => [t.id, t.fx && t.fx.length ? t.fx : ['pow', 'star']])
);
provide({ HIT_EFFECTS_BY_TYPE }); /* to-module */
HIT_EFFECTS_BY_TYPE.None = gameData.untyped.fx || ['pow', 'star'];
export const typesWith = p => TYPES.filter(t => PASSIVE[t] === p);
export const hasPassive = (types, p) => types.some(t => PASSIVE[t] === p);
/** RF-3: a passive's name and text as the player reads them (types.json passiveName, passiveText), by type */
export const PASSIVE_INFO = Object.fromEntries(
  gameData.types.map(t => [t.id, { name: t.passiveName || '', text: t.passiveText || '' }])
);
/** RF-3: the name of passive p as one of these types carries it ('' if none does) @param {string[]} types
 * @param {string} p */
export const passiveName = (types, p) => {
  const t = types.find(x => PASSIVE[x] === p);
  return (t && PASSIVE_INFO[t].name) || '';
};
export function typeEffectiveness(at, defs) {
  if (at === 'None' || !TYPE_STRONG_AGAINST[at]) return 1;
  let m = 1;
  for (const d of defs) {
    if (TYPE_STRONG_AGAINST[at].includes(d)) m *= 2;
    else if (TYPE_RESISTED_BY[at].includes(d)) m *= 0.5;
  }
  return m;
}
export const STAT_IDS = gameData.stats.map(s => s.id);
export const STAT_NAMES = Object.fromEntries(gameData.stats.map(s => [s.id, s.name]));
export const STATUS_NAMES = Object.fromEntries(gameData.statuses.map(s => [s.id, s.name]));
/* ---------- moves ---------- */
export const MOVES = gameData.moves;
provide({ MOVES }); /* to-module */
for (const k in MOVES) {
  const M = MOVES[k];
  if (!TYPE_COLORS[M.t]) {
    warnData(`Move ${k} has unknown type ${M.t}; using None.`);
    M.t = 'None';
  }
  if (M.a == null) M.a = 100;
}
/* ---------- robots (phase 17): parts and gems, put together in logic/fighters.js ---------- */
/** @type {import('../types/game-data').RobotData} */
export const ROBOTS = gameData.robots || { parts: {}, gems: {} };
provide({ ROBOTS }); /* to-module */
/* ---------- billionaires ---------- */
/** @type {Evolution[]} */
export const DEFAULT_EVOLUTIONS = [
  { k: 'lvl', at: 16 },
  { k: 'lvl', at: 36 },
];
export const LINES = gameData.lines;
export const LINE_BY_ID = Object.fromEntries(LINES.map(l => [l.id, l]));
export const SPECIES = /** @type {Record<string, Species>} */ ({}),
  DEX_ORDER = /** @type {string[]} */ ([]);
provide({ SPECIES }); /* to-module */
export const RARITY_STAT_TOTALS = Object.fromEntries(Object.entries(gameData.rarities).map(([k, v]) => [k, v.totals]));
export const atOrLast = (a, i) => a[Math.min(i, a.length - 1)];
LINES.forEach(L => {
  L.learn = (L.learn || []).filter(([lv, mv]) => {
    if (MOVES[mv]) return true;
    warnData(`${L.id} learns unknown move ${mv}.`);
    return false;
  });
  if (!L.learn.length) L.learn = [[1, 'handshake']];
  const sum = L.prof.reduce((a, b) => a + b, 0) || 1,
    ev = L.evo || DEFAULT_EVOLUTIONS,
    /* RO-2c: a line may carry its own stat total per stage (`totals`), in place of its rarity's: a 2-stage line whose
      final is the payoff (Sharktank) or a pseudo-legend needs a total its rarity's table cannot give */
    tot = L.totals || RARITY_STAT_TOTALS[L.rar] || RARITY_STAT_TOTALS.common;
  /* v36: a split line has four names: stages 1, 2 and two finals (3A, 3B); the middle stage evolves into one of the two
    by the Hype/Build rule (see evolve). Both finals count as stage 2 for stats, catch rate and XP yield */
  /* v40: a species with no evolutions (the singles) has the stats and XP yield of a final stage and the catch rate of a middle one */
  L.names.forEach((n, st0) => {
    const st = L.split ? Math.min(st0, 2) : st0,
      single = L.names.length === 1 && L.rar !== 'mythical',
      sI = single ? 2 : st,
      cI = single ? 1 : st,
      id = L.id + st0,
      last = L.split ? st0 >= 2 : st0 === L.names.length - 1,
      at = (arr, d) => (Array.isArray(arr) ? atOrLast(arr, st0) : d);
    const types = (at(L.types, ['None']) || ['None']).filter(t => TYPE_COLORS[t]);
    SPECIES[id] = {
      id,
      name: n,
      line: L.id,
      stage: st,
      types: types.length ? types : ['None'],
      base: L.base && L.base[st] ? L.base[st].slice() : L.prof.map(w => Math.round((atOrLast(tot, sI) * w) / sum)),
      cat: at(L.cat, ''),
      ht: at(L.ht, 1),
      wt: at(L.wt, 10),
      hab: at(L.hab, ''),
      diet: at(L.diet, ''),
      blurb: at(L.bio, ''),
      note: at(L.note, ''),
      /* SND-3: its own cry (base, pitch, length), or null for the one its id makes; a stage doesn't take another's */
      cry: (Array.isArray(L.cry) && L.cry[st0]) || null,
      cr:
        L.catchRate != null
          ? L.catchRate
          : cI === 0
            ? (RULES.catching.rarity[L.rar] ?? 0.45)
            : atOrLast(RULES.catching.evolved, cI - 1),
      yld: atOrLast(RULES.progression.xpYield, sI),
      next: last ? null : L.id + (st0 + 1),
      alt: L.split && st0 === 1 ? L.id + '3' : null,
      evo: last
        ? null
        : L.split && st0 === 1
          ? { k: 'split', at: (ev[1] && /** @type {{ at?: number }} */ (ev[1]).at) || 32 }
          : ev[st] || DEFAULT_EVOLUTIONS[Math.min(st, 1)],
      no: DEX_ORDER.length + 1,
      rar: L.rar,
      form: L.split && st0 >= 2 ? (st0 === 2 ? 'A' : 'B') : null,
    };
    DEX_ORDER.push(id);
  });
});
/* RO-1: a line's regional forms, a species per stage (logic/forms.js), after every line's own: each keeps its base
   stage's dex number and stays out of DEX_ORDER (the Guide shows it on its base's page, SPECIES_FORMS: a base stage's
   form species) */
export const SPECIES_FORMS = /** @type {Record<string, string[]>} */ ({});
LINES.forEach(L => {
  for (const F of L.forms || []) {
    if (!(gameData.coats || {})[F.coat]) warnData(`${L.id}'s form ${F.id} has unknown coat ${F.coat}.`);
    L.names.forEach((_, st0) => {
      const S = formSpeciesOf(SPECIES[L.id + st0], L, F);
      S.base = S.base.slice();
      S.types = S.types.filter(t => TYPE_COLORS[t]);
      if (!S.types.length) S.types = ['None'];
      SPECIES[S.id] = S;
      (SPECIES_FORMS[S.formOf] || (SPECIES_FORMS[S.formOf] = [])).push(S.id);
    });
  }
});
/* phase 16: a Billie from a line that is now in game/data/legacy (or missing) is stood in for by one of the new
   lines at the same stage, so pools, eggs, trainers and legendaries further out keep working until they are redone.
   The starters' lines never stand in. Each stand-in is listed in the data warnings. */
export const STAND_IN_LINES = ['swift', 'kardashian', 'trump', 'zuck'].filter(l => LINE_BY_ID[l]);
export const standInsWarned = new Set();
export function standInSpecies(id) {
  if (SPECIES[id] || !STAND_IN_LINES.length || typeof id !== 'string') return id;
  const m = /^(.*?)(\d+)$/.exec(id),
    line = m ? m[1] : id,
    st = m ? Math.min(+m[2], 2) : 0;
  let h = 0;
  for (const ch of line) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const L = LINE_BY_ID[STAND_IN_LINES[h % STAND_IN_LINES.length]],
    to = L.id + Math.min(st, L.names.length - 1);
  if (!SPECIES[to]) return id;
  if (!standInsWarned.has(id)) {
    standInsWarned.add(id);
    warnData(`${id} is in legacy; ${SPECIES[to].name} stands in for it.`);
  }
  return to;
}
export const standInList = list => list.map(([id, w]) => [standInSpecies(id), w]);
if (RULES.legends) for (const L of RULES.legends) L.sp = standInSpecies(L.sp);
if (RULES.eggs && RULES.eggs.mythSpecies) RULES.eggs.mythSpecies = standInSpecies(RULES.eggs.mythSpecies);
/* ---------- world ---------- */
/* RL-5: the places and the roads between them, as the rest of the game reads them. worldSetGraph (below the trainers)
   fills these tables in place, so every module that imports them sees the new rows: here once from the game data,
   the hub; a run puts its own world in (RL-7) and the hub back after */
export const LOCATIONS = /** @type {LocationEntry[]} */ ([]);
provide({ LOCATIONS }); /* to-module */
export const POOLS = /** @type {Record<string, Pool>} */ ({});
for (const k in gameData.pools) {
  const P = gameData.pools[k];
  POOLS[k] = {
    lv: P.lv,
    list: standInList(P.list).filter(([id]) => SPECIES[id] || warnData(`Pool ${k} lists unknown Billie ${id}.`)),
  };
  if (!POOLS[k].list.length) POOLS[k].list = [[DEX_ORDER[0], 1]];
}
export const BATTLE_STAGES = gameData.battleStages;
provide({ BATTLE_STAGES }); /* to-module */
/* phase 08: a road is as long as the walk from one place's middle out to its edge plus the other's from its edge in:
   the two exits' len (a map's edgeExits, in the boot bundle). A road without named exits counts 100 m */
export function exitLength(node, id) {
  const sc = id && gameData.maps ? gameData.maps[LOCATIONS[node].mapId] : null,
    e = sc ? (sc.edgeExits || []).find(x => x.id === id) : null;
  return e && Number.isFinite(e.len) ? e.len : null;
}
export function roadMetres(a, b, j) {
  const la = j ? exitLength(a, j.a) : null,
    lb = j ? exitLength(b, j.b) : null;
  return la != null && lb != null ? Math.max(1, Math.round(la + lb)) : 100;
}
/* the walking network: links between stops (both directions), with their length in metres. roads.json is a list of
   typed links, {id, name, kind: 'seam', a: {map, exit}, b: {map, exit}}, each end naming a place by its map (phase 08b;
   the Studio and the tools read it through data-files.js PB_DATA.road). Here each becomes [a node, b node, metres,
   {a: exit, b: exit, id, from, to, name}], the form the game reads. A world without roads has none (RL-5: the
   places once made one chain without them) */
export const roadEndNode = (/** @type {string} */ m) => LOCATIONS.findIndex(r => r.mapId === m || r.id === m);
/** @type {Road[]} */
export const ROADS = [];
/* v46: what each place, scene and road is (the one-off tools/migrate-places.py filled these): use these instead of id prefixes */
/* copies made before board is filled in (below), so they have none: read LOCATIONS[node].board */
/** @type {Record<string, LocationData & { node: number, trainers: string[] }>} */
export const LOCATION_BY_ID = {};
/* alpha 0.4: what a place is, under its name: its route number ("Route 2"), or "Town" / "City"; and its full name,
   the number and the name together ("Route 2 · Tallgrass Meadow"), for signposts, postcards and the like */
export function locationSubtitle(n) {
  if (!n) return '';
  if (n.town) return /City$/.test(n.name || '') ? 'City' : 'Town';
  return n.route || '';
}
export function locationFullName(n) {
  if (!n) return '';
  return !n.town && /^Route \d/.test(n.route || '') ? n.route + ' · ' + n.name : n.name;
}
export function locationKind(id) {
  const sc = gameData.maps && gameData.maps[id];
  if (sc && sc.kind) return sc.kind;
  const p = LOCATION_BY_ID[id];
  return p
    ? p.kind || (p.town ? 'town' : 'route')
    : /^int_/.test(id || '')
      ? 'room'
      : /^test_/.test(id || '')
        ? 'test'
        : null;
}
export function isTown(nodeOrId) {
  const r = typeof nodeOrId === 'number' ? LOCATIONS[nodeOrId] : LOCATION_BY_ID[nodeOrId];
  return !!r && (r.kind ? r.kind === 'town' : !!r.town);
}
export const ROADS_BY_NODE = /** @type {RoadFromNode[][]} */ ([]);
export const roadCost = (a, b) => {
  const e = (ROADS_BY_NODE[a] || []).find(e => e.to === b);
  return e ? e.cost : null;
};
export const EGGS = /** @type {Record<string, EggTier>} */ ({});
for (const k in gameData.eggs) {
  const E = gameData.eggs[k];
  EGGS[k] = {
    need: E.need,
    lv: E.lv,
    list: standInList(E.list).filter(([id]) => SPECIES[id] || warnData(`Egg ${k} km lists unknown Billie ${id}.`)),
  };
  if (!EGGS[k].list.length) EGGS[k].list = [[DEX_ORDER[0], 1]];
}
export const EGG_TIERS = Object.keys(EGGS)
  .map(Number)
  .sort((a, b) => a - b);
export const PYRAMIDS = gameData.pyramids;
provide({ PYRAMIDS }); /* to-module */
/* studio track ST-0: coats, a recolour of a Billie's art (game/js/logic/coats.js) */
export const COATS = gameData.coats || {};
provide({ COATS }); /* to-module */
export const ITEMS = gameData.items;
provide({ ITEMS }); /* to-module */
export const PEOPLE = gameData.people;
provide({ PEOPLE }); /* to-module */
export const SHOPS = gameData.shops || {};
/* roguelite track RL-6: the kinds of node on a run's map (logic/run-map.js takes them as an argument) */
export const NODE_TYPES = gameData.nodeTypes || {};
/* sound track SND-2: the songs, jingles, cries' bases and where each song plays (music.json; audio/tracker.js plays them) */
export const MUSIC = gameData.music || { songs: {}, jingles: {}, cries: { bases: [] }, where: [] };
/* roguelite track RL-R2: the field moves that open a run's side areas (fieldMoves.json; logic/run-side.js) */
export const FIELD_MOVES = (gameData.fieldMoves && gameData.fieldMoves.moves) || {};
provide({ FIELD_MOVES }); /* to-module */
/* splicing track SP-2: what spliced parts do (genes.json; logic/genes.js) */
export const GENES = /** @type {import('../types/game-data').Genes} */ (
  gameData.genes || {
    kinds: {},
    traits: {},
    parts: {},
    maxTraits: 3,
    stability: { line: 0, kit: 1, other: 2, augment: 3, limit: 3, refuse: 3 },
    bank: { levels: [{ limit: 3, slots: ['sig'] }], price: { base: 5, perCost: 5 }, inherit: 0 },
    unstable: { up: 1.3, down: 0.75, name: 'Unstable', d: '', fx: [] },
    augment: {
      slots: {},
      statShare: 0,
      field: {},
      move: 'none',
      escapedNear: 1,
      knockout: 'none',
      levels: [{ slots: [], maxUp: 0 }],
      price: { fit: 0, up: [] },
    },
  }
);
provide({ GENES }); /* to-module */
/* RT-3: set pieces, prop groups placed as a unit on a laid-out place (setPieces.json; logic/mapgen.js) */
export const SET_PIECES = /** @type {import('../types/game-data').SetPiecesData | null} */ (gameData.setPieces || null);
/* roguelite track RL-13: a run's Expeditions and challenges (modifiers.json; logic/modifiers.js) */
export const MODIFIERS = /** @type {import('../types/game-data').ModifiersData} */ (
  gameData.modifiers || { expeditions: [{ name: 'Expedition I', d: '', fx: [] }], challenges: {} }
);
provide({ MODIFIERS }); /* to-module */
/* roguelite track RL-14: the runs' enemy factions and their bots (factions.json; logic/factions.js) */
export const FACTIONS = /** @type {Record<string, import('../types/game-data').Faction>} */ (
  (gameData.factions && gameData.factions.factions) || {}
);
/* towns track TW-3: a run's quests (quests.json; logic/run-quests.js) */
export const QUESTS = /** @type {import('../types/game-data').QuestsData} */ (gameData.quests);
/* roguelite track RL-12: a run's Perks (relics) and their effect rows (logic/effects.js) */
export const PERKS = /** @type {Record<string, Perk>} */ (gameData.perks || {});
/** RL-12b: the reward pick's cards */
export const REWARDS = /** @type {Record<string, import('../types/game-data').RewardRow>} */ (gameData.rewards || {});
/** RL-12b: a run's events, loot tables and trainer classes */
export const EVENTS = /** @type {import('../types/game-data').EventsData} */ (
  gameData.events || { loot: {}, classes: {}, events: {} }
);
/** RL-S1: the story director's lines (banter.json; logic/story-pick.js) */
export const BANTER = /** @type {Record<string, import('../types/game-data').BanterLine>} */ (gameData.banter || {});
/* roguelite track RL-11: the four currencies (currencies.json) */
export const CURRENCIES = gameData.currencies || {};
/* RL-11: the hub's buildings, each upgraded with one currency (buildings.json; levels are unlocks.json rows) */
export const BUILDINGS = gameData.buildings || {};
/* RL-11: the one unlock table (unlocks.json; logic/unlocks.js) */
export const UNLOCKS = gameData.unlocks || {};
/* the tables logic/unlocks.js is given */
export const UNLOCK_DATA = { unlocks: UNLOCKS, buildings: BUILDINGS };
/* Project Story: the story layer's flags, speakers, quests and start presets (story.json) */
export const STORY_DATA = gameData.story;
/* cutscenes, one file each (game/data/cutscenes/<id>.json, docs/CUTSCENES.md) */
export const CUTSCENES = /** @type {Record<string, CutsceneData>} */ (gameData.cutscenes || {});
/* ---------- trainers: plain data, turned into teams when a battle starts ---------- */
export const TRAINERS = /** @type {Record<string, TrainerEntry>} */ (gameData.trainers || {});
for (const id in TRAINERS) {
  const T = TRAINERS[id];
  T.id = id;
  if (!PEOPLE[T.who]) T.who = 'chosen';
  T.team = (T.team || [])
    .map(e => (/^@rival\d?$/.test(e.sp) || e.sp === 'robot' ? e : { ...e, sp: standInSpecies(e.sp) }))
    .filter(
      e =>
        /^@rival\d?$/.test(e.sp) ||
        SPECIES[e.sp] ||
        (e.sp === 'robot' ? trainerRobotOk(e) : false) ||
        warnData(`Trainer ${id} has ${e.sp === 'robot' ? 'a robot with unknown parts' : 'unknown Billie ' + e.sp}.`)
    );
}
/* phase 17: a trainer's robot names a known gem and a part of the right kind for each slot */
export function trainerRobotOk(e) {
  const R = e.robot,
    fits = { torso: 'torso', armL: 'arm', armR: 'arm', legs: 'legs' };
  return (
    !!R &&
    !!ROBOTS.gems[R.gem] &&
    Object.entries(fits).every(([k, kind]) => ROBOTS.parts[R[k]] && ROBOTS.parts[R[k]].slot === kind)
  );
}
/** RL-5: put a world's places and roads in: the tables above (LOCATIONS, ROADS, LOCATION_BY_ID, ROADS_BY_NODE) are
    filled again in place. Each place's pool and battle stage are checked, it gets the trainers that stand there and
    its Boardroom; each seam road becomes [a node, b node, metres, ends] (the glass lift is left out). The game data's
    world (the hub) goes in below; a run's in RL-7
    @param {LocationData[]} locations @param {RoadLink[]} [roads] */
export function worldSetGraph(locations, roads) {
  /* a copy first: the list given may be LOCATIONS itself */
  LOCATIONS.splice(0, LOCATIONS.length, .../** @type {LocationEntry[]} */ (locations.slice()));
  LOCATIONS.forEach(r => {
    if (!POOLS[r.pool]) {
      warnData(`${r.name} uses unknown pool ${r.pool}.`);
      r.pool = Object.keys(POOLS)[0];
    }
    if (!BATTLE_STAGES[r.battleStage]) r.battleStage = BATTLE_STAGES[r.pool] ? r.pool : 'grass';
    r.trainers = [];
    /* a place put in again keeps no Boardroom from before (the copies by id below are made without one) */
    delete (/** @type {{ board?: string | null }} */ (r).board);
  });
  const roadList = (roads || [])
    .filter(l => (l.kind || 'seam') === 'seam')
    .map(l => {
      const a = roadEndNode(l.a && l.a.map),
        b = roadEndNode(l.b && l.b.map);
      return /** @type {Road} */ ([
        a,
        b,
        0,
        {
          a: l.a.exit,
          b: l.b.exit,
          id: l.id,
          from: LOCATIONS[a] && LOCATIONS[a].id,
          to: LOCATIONS[b] && LOCATIONS[b].id,
          name: l.name,
        },
      ]);
    })
    .filter(l => LOCATIONS[l[0]] && LOCATIONS[l[1]] && l[0] !== l[1])
    .map(/** @returns {Road} */ ([a, b, , j]) => [a, b, roadMetres(a, b, j), j]);
  ROADS.splice(0, ROADS.length, ...roadList);
  for (const k of Object.keys(LOCATION_BY_ID)) delete LOCATION_BY_ID[k];
  LOCATIONS.forEach((r, i) => (LOCATION_BY_ID[r.id || r.mapId] = Object.assign({ node: i }, r)));
  ROADS_BY_NODE.splice(0, ROADS_BY_NODE.length, ...LOCATIONS.map(() => /** @type {RoadFromNode[]} */ ([])));
  ROADS.forEach(([a, b, c], i) => {
    ROADS_BY_NODE[a].push({ to: b, cost: c, i });
    ROADS_BY_NODE[b].push({ to: a, cost: c, i });
  });
  /* v47: a "tutorial" trainer only battles in a story scene (blake0, in the opening); it stands on no stop. RL-5: nor
     does a mini-boss (the eight badge leaders, the runs' mini-boss pool from RL-13) */
  for (const id in TRAINERS) {
    const T = TRAINERS[id];
    if (T.tutorial || T.miniboss) {
      /* it waits on no location */
    } else if (T.node !== undefined && LOCATIONS[T.node]) {
      /* RL-8: a world's trainers stand only in that world: a run's on its place (runNode), the hub's off a run's */
      if ((T.runNode ?? null) === (LOCATIONS[T.node].runNode ?? null)) LOCATIONS[T.node].trainers.push(id);
    } else warnData(`Trainer ${id} stands on a stop that doesn’t exist.`);
  }
  /* the first trainer at a stop that hands out a Board Seat (or doesn’t block the road) is that stop’s Boardroom */
  LOCATIONS.forEach(r => {
    r.board = r.trainers.find(id => TRAINERS[id].seat) || null;
  });
}
worldSetGraph(gameData.locations, gameData.roads);
/* RL-7: the hub's places and roads as they go in here, kept while a run's world is in (game/js/run-world.js): a hub
   save is checked against these (saves.js), whatever world the tables hold when it loads */
export const HUB_LOCATIONS = /** @type {LocationEntry[]} */ (LOCATIONS.slice());
export const hubRoadsByNode = ROADS_BY_NODE.map(e => e.slice());
/* RL-7: another world goes in (a run's: game/js/run-world.js) with what its places need first: its scenes into
   gameData.maps (a road's length is its exits' walk) and its pools into POOLS (a place keeps only a pool that
   exists), then its places and roads. worldHubBack takes them out and puts the hub's world back */
export const worldExtra = {
  /* RL-8b: the world map's look of the world that is in (a run's own, logic/run-bowl.js); null: worldmap.json's */
  look: /** @type {any} */ (null),
  maps: /** @type {Record<string, any>} */ ({}),
  pools: /** @type {string[]} */ ([]),
  shops: /** @type {string[]} */ ([]),
  trainers: /** @type {string[]} */ ([]),
};
provide({ worldExtra }); /* to-module */
/** RL-8: and its shops (a run town's) into SHOPS and its trainers (a run's mini-bosses and boss) into TRAINERS;
 * RL-8b: and its own world map look
 * @param {{ locations: LocationData[], roads: RoadLink[], pools: Record<string, Pool>, maps: Record<string, any>,
 *   shops?: Record<string, any>, trainers?: Record<string, any>, look?: any }} w */
export function worldPut(w) {
  worldHubBack();
  worldExtra.look = w.look || null;
  Object.assign(worldExtra.maps, w.maps);
  Object.assign(gameData.maps, w.maps);
  Object.assign(POOLS, w.pools);
  worldExtra.pools.push(...Object.keys(w.pools));
  Object.assign(SHOPS, w.shops || {});
  worldExtra.shops.push(...Object.keys(w.shops || {}));
  worldAddTrainers(w.trainers || {});
  worldSetGraph(w.locations, w.roads);
}
/** RL-12b: trainers put into the world as it stands (a run's event foe), gone with it at worldHubBack
 * @param {Record<string, any>} trainers */
export function worldAddTrainers(trainers) {
  for (const [id, T] of Object.entries(trainers)) {
    TRAINERS[id] = /** @type {TrainerEntry} */ ({ ...T, id, who: PEOPLE[T.who] ? T.who : 'chosen' });
    if (!worldExtra.trainers.includes(id)) worldExtra.trainers.push(id);
  }
}
export function worldHubBack() {
  worldExtra.look = null;
  for (const id of Object.keys(worldExtra.maps)) {
    delete gameData.maps[id];
    delete worldExtra.maps[id];
  }
  for (const id of worldExtra.pools.splice(0)) delete POOLS[id];
  for (const id of worldExtra.shops.splice(0)) delete SHOPS[id];
  for (const id of worldExtra.trainers.splice(0)) delete TRAINERS[id];
  worldSetGraph(gameData.locations, gameData.roads);
}
/** the scenes of the world that is in when it isn't the hub's, by map id (none in the hub) */
export const worldExtraMaps = () => worldExtra.maps;
/** the walk between two of the hub's places (roadCost on the hub's roads), null without a road */
export const hubRoadCost = (a, b) => {
  const e = (hubRoadsByNode[a] || []).find(e => e.to === b);
  return e ? e.cost : null;
};
/* alpha 0.4: where a new game starts (rules.start.locationId: Copperleaf Town; before alpha 0.4 the first stop, Marigold Town) */
export const START_NODE = (() => {
  const p = RULES.start && RULES.start.locationId;
  return p && LOCATION_BY_ID[p] ? LOCATION_BY_ID[p].node : 0;
})();
export const SEATS = Object.values(TRAINERS)
  .filter(T => T.seat)
  .map(T => /** @type {Seat} */ (T.seat).id);
/* "@rival" is the starter that beats yours; "@rival1" / "@rival2" the same line evolved */
export function rivalSpecies(code) {
  const base = RULES.start.rival[saveData.starter] || DEX_ORDER[0],
    st = +(code.slice(6) || 0),
    id = base.replace(/\d+$/, '') + st;
  return SPECIES[id] ? id : base;
}
/* a team entry may name its moves (v47: Blake's first billionaire only knows Tackle) */
export function trainerTeam(T) {
  return T.team.map(e => {
    /* phase 17: a robot, built from new parts */
    if (e.sp === 'robot' && e.robot) {
      const R = e.robot,
        fit = Object.fromEntries(['torso', 'armL', 'armR', 'legs'].map(k => [k, { uid: '', id: R[k], up: 0 }]));
      const m = makeRobot(R.gem, fit, e.lvl);
      /* RL-14: a faction's bot goes by its name (factions.json) */
      if (e.nick) m.nick = e.nick;
      return m;
    }
    const m = makeBilly(/^@rival\d?$/.test(e.sp) ? rivalSpecies(e.sp) : e.sp, e.lvl),
      mv = Array.isArray(e.moves) ? e.moves.filter(k => MOVES[k]) : [];
    if (mv.length) m.moves = mv;
    return m;
  });
}
export const trainerById = id => TRAINERS[id] || null;
/* a trainer with "after" only turns up once you've beaten that one; Project Story S2: one with "when" / "unless"
   only while the story allows (logic/script.js storyAllows) */
export const trainersAt = i =>
  ((LOCATIONS[i] && LOCATIONS[i].trainers) || [])
    .map(id => TRAINERS[id])
    .filter(T => !T.after || (typeof saveData !== 'undefined' && saveData.flags && saveData.flags[T.after]))
    .filter(T => (!T.when && !T.unless) || storyAllows(T));
