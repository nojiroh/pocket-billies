// @ts-check
'use strict';
/* ================= DATA =================
   Everything here is built from the game data (data/*.json, put together as data/gamedata.js), which Pocket Billies
   Studio edits.
   The rest of the game reads these globals, so the file format can change without touching game code.
   Phase 04e: the data is read from globalThis, the page's window; in plain Node (tools/test/logic.test.mjs) a test puts
   its own small data there before it imports this module. */
/**
 * @import { EggTier, Evolution, GameData, LocationData, LocationEntry, Pool, Road, RoadFromNode } from '../types/game-data'
 * @import { Seat, Species, TrainerEntry } from '../types/game-data'
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { makeBilly, makeRobot, provide, saveData } from './hooks.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_STAGES: [() => BATTLE_STAGES],
  COINS: [() => COINS],
  DATA_WARN: [() => DATA_WARN],
  DEFAULT_EVOLUTIONS: [() => DEFAULT_EVOLUTIONS],
  DEX_ORDER: [() => DEX_ORDER],
  EGGS: [() => EGGS],
  EGG_TIERS: [() => EGG_TIERS],
  HIT_EFFECTS_BY_TYPE: [() => HIT_EFFECTS_BY_TYPE],
  ITEMS: [() => ITEMS],
  LINES: [() => LINES],
  LINE_BY_ID: [() => LINE_BY_ID],
  LOCATIONS: [() => LOCATIONS],
  LOCATION_BY_ID: [() => LOCATION_BY_ID],
  MOVES: [() => MOVES],
  PASSIVE: [() => PASSIVE],
  PEOPLE: [() => PEOPLE],
  POOLS: [() => POOLS],
  RARITY_STAT_TOTALS: [() => RARITY_STAT_TOTALS],
  REGIONS: [() => REGIONS],
  ROADS: [() => ROADS],
  ROADS_BY_NODE: [() => ROADS_BY_NODE],
  ROBOTS: [() => ROBOTS],
  RULES: [() => RULES],
  SEATS: [() => SEATS],
  SHOPS: [() => SHOPS],
  SPECIES: [() => SPECIES],
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
  atOrLast: [() => atOrLast],
  // @ts-expect-error -- replaced on purpose
  exitLength: [() => exitLength, v => (exitLength = v)],
  gameData: [() => gameData],
  hasPassive: [() => hasPassive],
  // @ts-expect-error -- replaced on purpose
  isTown: [() => isTown, v => (isTown = v)],
  // @ts-expect-error -- replaced on purpose
  locationFullName: [() => locationFullName, v => (locationFullName = v)],
  // @ts-expect-error -- replaced on purpose
  locationKind: [() => locationKind, v => (locationKind = v)],
  // @ts-expect-error -- replaced on purpose
  locationSubtitle: [() => locationSubtitle, v => (locationSubtitle = v)],
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
    tot = RARITY_STAT_TOTALS[L.rar] || RARITY_STAT_TOTALS.common;
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
/* trainers and board are filled in below */
export const LOCATIONS = /** @type {LocationEntry[]} */ (gameData.locations);
export const REGIONS = gameData.regions;
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
LOCATIONS.forEach((r, i) => {
  if (!POOLS[r.pool]) {
    warnData(`${r.name} uses unknown pool ${r.pool}.`);
    r.pool = Object.keys(POOLS)[0];
  }
  if (!BATTLE_STAGES[r.battleStage]) r.battleStage = BATTLE_STAGES[r.pool] ? r.pool : 'grass';
  r.trainers = [];
});
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
   {a: exit, b: exit, id, from, to, name}], the form the game reads. Without roads the locations make one chain */
export const roadEndNode = (/** @type {string} */ m) => LOCATIONS.findIndex(r => r.mapId === m || r.id === m);
/** @type {Road[]} */
export const ROADS = (
  gameData.roads && gameData.roads.length
    ? gameData.roads
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
    : LOCATIONS.slice(1).map((r, i) => /** @type {Road} */ ([i, i + 1, 0]))
)
  .filter(l => LOCATIONS[l[0]] && LOCATIONS[l[1]] && l[0] !== l[1])
  .map(
    /** @returns {Road} */ ([a, b, , j]) =>
      j && typeof j === 'object' ? [a, b, roadMetres(a, b, j), j] : [a, b, roadMetres(a, b, null)]
  );
/* v46: what each place, scene and road is (tools/migrate-places.py fills these): use these instead of id prefixes */
/* copies made before board is filled in (below), so they have none: read LOCATIONS[node].board */
/** @type {Record<string, LocationData & { node: number, trainers: string[] }>} */
export const LOCATION_BY_ID = Object.fromEntries(
  LOCATIONS.map((r, i) => [r.id || r.mapId, Object.assign({ node: i }, r)])
);
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
/* alpha 0.4: where a new game starts (rules.start.locationId: Copperleaf Town; before alpha 0.4 the first stop, Marigold Town) */
export const START_NODE = (() => {
  const p = RULES.start && RULES.start.locationId;
  return p && LOCATION_BY_ID[p] ? LOCATION_BY_ID[p].node : 0;
})();
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
export const ROADS_BY_NODE = LOCATIONS.map(() => /** @type {RoadFromNode[]} */ ([]));
ROADS.forEach(([a, b, c], i) => {
  ROADS_BY_NODE[a].push({ to: b, cost: c, i });
  ROADS_BY_NODE[b].push({ to: a, cost: c, i });
});
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
export const COINS = gameData.coins;
provide({ COINS }); /* to-module */
export const ITEMS = gameData.items;
export const PEOPLE = gameData.people;
provide({ PEOPLE }); /* to-module */
export const SHOPS = gameData.shops || {};
/* Project Story: the story layer's flags, speakers, quests and start presets (story.json) */
export const STORY_DATA = gameData.story;
/* ---------- trainers: plain data, turned into teams when a battle starts ---------- */
export const TRAINERS = /** @type {Record<string, TrainerEntry>} */ (gameData.trainers || {});
/* v47: a "tutorial" trainer only battles in a story scene (blake0, in the opening); it stands on no stop */
for (const id in TRAINERS) {
  const T = TRAINERS[id];
  T.id = id;
  if (T.tutorial) {
    /* it waits on no location */
  } else if (LOCATIONS[T.node]) LOCATIONS[T.node].trainers.push(id);
  else warnData(`Trainer ${id} stands on a stop that doesn’t exist.`);
  if (!PEOPLE[T.who]) T.who = 'gini';
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
/* the first trainer at a stop that hands out a Board Seat (or doesn’t block the road) is that stop’s Boardroom */
LOCATIONS.forEach(r => {
  r.board = r.trainers.find(id => TRAINERS[id].seat) || null;
});
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
      return makeRobot(R.gem, fit, e.lvl);
    }
    const m = makeBilly(/^@rival\d?$/.test(e.sp) ? rivalSpecies(e.sp) : e.sp, e.lvl),
      mv = Array.isArray(e.moves) ? e.moves.filter(k => MOVES[k]) : [];
    if (mv.length) m.moves = mv;
    return m;
  });
}
export const trainerById = id => TRAINERS[id] || null;
/* a trainer with "after" only turns up once you've beaten that one */
export const trainersAt = i =>
  ((LOCATIONS[i] && LOCATIONS[i].trainers) || [])
    .map(id => TRAINERS[id])
    .filter(T => !T.after || (typeof saveData !== 'undefined' && saveData.flags && saveData.flags[T.after]));
