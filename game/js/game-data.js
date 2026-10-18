'use strict';
/* ================= DATA =================
   Everything here is built from the game data (data/*.json, put together as data/gamedata.js), which Pocket Billies
   Studio edits.
   The rest of the game reads these globals, so the file format can change without touching game code. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { makeBilly, provide, saveData } from './hooks.js';
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
  JOBS: [() => JOBS],
  JOB_STEPS: [() => JOB_STEPS],
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
  RULES: [() => RULES],
  SEATS: [() => SEATS],
  SHOPS: [() => SHOPS],
  SPECIES: [() => SPECIES],
  START_NODE: [() => START_NODE],
  STATUS_NAMES: [() => STATUS_NAMES],
  STAT_IDS: [() => STAT_IDS],
  STAT_NAMES: [() => STAT_NAMES],
  STEPS_PER_KM: [() => STEPS_PER_KM],
  TRAINERS: [() => TRAINERS],
  TYPES: [() => TYPES],
  TYPE_COLORS: [() => TYPE_COLORS],
  TYPE_RESISTED_BY: [() => TYPE_RESISTED_BY],
  TYPE_STRONG_AGAINST: [() => TYPE_STRONG_AGAINST],
  atOrLast: [() => atOrLast],
  gameData: [() => gameData],
  hasPassive: [() => hasPassive],
  isTown: [() => isTown, v => (isTown = v)],
  locationFullName: [() => locationFullName, v => (locationFullName = v)],
  locationKind: [() => locationKind, v => (locationKind = v)],
  locationSubtitle: [() => locationSubtitle, v => (locationSubtitle = v)],
  rivalSpecies: [() => rivalSpecies, v => (rivalSpecies = v)],
  roadCost: [() => roadCost],
  roadsOf: [() => roadsOf, v => (roadsOf = v)],
  trainerById: [() => trainerById],
  trainerTeam: [() => trainerTeam, v => (trainerTeam = v)],
  trainersAt: [() => trainersAt],
  typeEffectiveness: [() => typeEffectiveness, v => (typeEffectiveness = v)],
  typesWith: [() => typesWith],
  warnData: [() => warnData],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const gameData = window.GAMEDATA;
provide({ gameData }); /* to-module */
if (!gameData)
  throw new Error(
    'The game data did not load: data/gamedata.js is missing and the data files in data/ could not be read (npm run check:data says what is wrong).'
  );
export const DATA_WARN = [];
const warnData = m => {
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
const TYPE_STRONG_AGAINST = Object.fromEntries(
  gameData.types.map(t => [t.id, (t.strong || []).filter(x => TYPE_COLORS[x])])
);
const TYPE_RESISTED_BY = Object.fromEntries(
  gameData.types.map(t => [t.id, (t.weak || []).filter(x => TYPE_COLORS[x])])
);
export const PASSIVE = Object.fromEntries(gameData.types.map(t => [t.id, t.passive || '']));
const HIT_EFFECTS_BY_TYPE = Object.fromEntries(
  gameData.types.map(t => [t.id, t.fx && t.fx.length ? t.fx : ['pow', 'star']])
);
provide({ HIT_EFFECTS_BY_TYPE }); /* to-module */
HIT_EFFECTS_BY_TYPE.None = gameData.untyped.fx || ['pow', 'star'];
const typesWith = p => TYPES.filter(t => PASSIVE[t] === p);
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
/* ---------- billionaires ---------- */
const DEFAULT_EVOLUTIONS = [
  { k: 'lvl', at: 16 },
  { k: 'lvl', at: 36 },
];
export const LINES = gameData.lines;
export const LINE_BY_ID = Object.fromEntries(LINES.map(l => [l.id, l]));
export const SPECIES = {},
  DEX_ORDER = [];
provide({ SPECIES }); /* to-module */
const RARITY_STAT_TOTALS = Object.fromEntries(Object.entries(gameData.rarities).map(([k, v]) => [k, v.totals]));
const atOrLast = (a, i) => a[Math.min(i, a.length - 1)];
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
          ? { k: 'split', at: (ev[1] && ev[1].at) || 32 }
          : ev[st] || DEFAULT_EVOLUTIONS[Math.min(st, 1)],
      no: DEX_ORDER.length + 1,
      rar: L.rar,
      form: L.split && st0 >= 2 ? (st0 === 2 ? 'A' : 'B') : null,
    };
    DEX_ORDER.push(id);
  });
});
/* ---------- world ---------- */
export const LOCATIONS = gameData.locations;
export const REGIONS = gameData.regions;
export const POOLS = {};
for (const k in gameData.pools) {
  const P = gameData.pools[k];
  POOLS[k] = {
    lv: P.lv,
    list: P.list.filter(([id]) => SPECIES[id] || warnData(`Pool ${k} lists unknown Billie ${id}.`)),
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
  if (!BATTLE_STAGES[r.area]) r.area = BATTLE_STAGES[r.pool] ? r.pool : 'grass';
  r.trainers = [];
});
/* the walking network: links between stops (both directions); older data is a single chain */
export const ROADS = (
  gameData.roads && gameData.roads.length ? gameData.roads : LOCATIONS.slice(1).map((r, i) => [i, i + 1, r.cost || 500])
)
  .filter(l => LOCATIONS[l[0]] && LOCATIONS[l[1]] && l[0] !== l[1])
  .map(([a, b, c, j]) =>
    j && typeof j === 'object'
      ? [a, b, Math.max(1, Math.round(+c || 500)), j]
      : [a, b, Math.max(1, Math.round(+c || 500))]
  ); /* v42: a fourth entry {a,b} names the exit at each end (the join table) */
/* v46: what each place, scene and road is (tools/migrate-places.py fills these): use these instead of id prefixes */
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
function roadsOf(id) {
  const n = LOCATION_BY_ID[id] ? LOCATION_BY_ID[id].node : -1;
  return ROADS.map((L, i) => Object.assign({ i, a: L[0], b: L[1], cost: L[2] }, L[3] || {})).filter(
    R => R.a === n || R.b === n
  );
}
export const ROADS_BY_NODE = LOCATIONS.map(() => []);
ROADS.forEach(([a, b, c], i) => {
  ROADS_BY_NODE[a].push({ to: b, cost: c, i });
  ROADS_BY_NODE[b].push({ to: a, cost: c, i });
});
export const roadCost = (a, b) => {
  const e = (ROADS_BY_NODE[a] || []).find(e => e.to === b);
  return e ? e.cost : null;
};
export const STEPS_PER_KM = RULES.steps.stepsPerKm;
export const EGGS = {};
for (const k in gameData.eggs) {
  const E = gameData.eggs[k];
  EGGS[k] = {
    need: E.need,
    lv: E.lv,
    list: E.list.filter(([id]) => SPECIES[id] || warnData(`Egg ${k} km lists unknown Billie ${id}.`)),
  };
}
export const EGG_TIERS = Object.keys(EGGS)
  .map(Number)
  .sort((a, b) => a - b);
export const COINS = gameData.coins;
provide({ COINS }); /* to-module */
export const ITEMS = gameData.items;
export const JOBS = gameData.jobs;
export const JOB_STEPS = RULES.jobs.stepsPerPay;
export const PEOPLE = gameData.people;
provide({ PEOPLE }); /* to-module */
export const SHOPS = gameData.shops || {};
/* ---------- trainers: plain data, turned into teams when a battle starts ---------- */
export const TRAINERS = gameData.trainers || {};
/* v47: a "tutorial" trainer only battles in a story scene (blake0, in the opening); it stands on no stop */
for (const id in TRAINERS) {
  const T = TRAINERS[id];
  T.id = id;
  if (T.tutorial);
  else if (LOCATIONS[T.node]) LOCATIONS[T.node].trainers.push(id);
  else warnData(`Trainer ${id} stands on a stop that doesn’t exist.`);
  if (!PEOPLE[T.who]) T.who = 'gini';
  T.team = (T.team || []).filter(
    e => /^@rival\d?$/.test(e.sp) || SPECIES[e.sp] || warnData(`Trainer ${id} has unknown Billie ${e.sp}.`)
  );
}
/* the first trainer at a stop that hands out a Board Seat (or doesn’t block the road) is that stop’s Boardroom */
LOCATIONS.forEach(r => {
  r.board = r.trainers.find(id => TRAINERS[id].seat) || null;
});
const SEATS = Object.values(TRAINERS)
  .filter(T => T.seat)
  .map(T => T.seat.id);
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
    const m = makeBilly(/^@rival\d?$/.test(e.sp) ? rivalSpecies(e.sp) : e.sp, e.lvl),
      mv = Array.isArray(e.moves) ? e.moves.filter(k => MOVES[k]) : [];
    if (mv.length) m.moves = mv;
    return m;
  });
}
const trainerById = id => TRAINERS[id] || null;
/* a trainer with "after" only turns up once you've beaten that one */
export const trainersAt = i =>
  ((LOCATIONS[i] && LOCATIONS[i].trainers) || [])
    .map(id => TRAINERS[id])
    .filter(T => !T.after || (typeof saveData !== 'undefined' && saveData.flags && saveData.flags[T.after]));
