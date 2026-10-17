'use strict';
/* ================= DATA =================
   Everything here is built from the game data (data/*.json, put together as data/gamedata.js), which Pocket Billies
   Studio edits.
   The rest of the game reads these globals, so the file format can change without touching game code. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { makeMon, provide } from './hooks.js';
/* eslint-disable no-func-assign */
expose({
  ADJ: [() => ADJ],
  BACKDROPS: [() => BACKDROPS],
  COINS: [() => COINS],
  DATA_WARN: [() => DATA_WARN],
  DEX: [() => DEX],
  EGGS: [() => EGGS],
  EGG_TIERS: [() => EGG_TIERS],
  FUTURE: [() => FUTURE],
  GD: [() => GD],
  ITEMS: [() => ITEMS],
  JOBS: [() => JOBS],
  JOB_STEPS: [() => JOB_STEPS],
  LINES: [() => LINES],
  LINKS: [() => LINKS],
  LN: [() => LN],
  LV: [() => LV],
  MOVES: [() => MOVES],
  PASSIVE: [() => PASSIVE],
  PEOPLE: [() => PEOPLE],
  PLACE: [() => PLACE],
  POOLS: [() => POOLS],
  RESm: [() => RESm],
  ROUTE: [() => ROUTE],
  RULES: [() => RULES],
  SEATS: [() => SEATS],
  SEm: [() => SEm],
  SHOPS: [() => SHOPS],
  SP: [() => SP],
  START_NODE: [() => START_NODE],
  STATK: [() => STATK],
  STATN: [() => STATN],
  STATUSN: [() => STATUSN],
  STEPS_PER_KM: [() => STEPS_PER_KM],
  TC: [() => TC],
  TOT: [() => TOT],
  TRAINERS: [() => TRAINERS],
  TYPEFX: [() => TYPEFX],
  TYPES: [() => TYPES],
  eff: [() => eff, v => (eff = v)],
  hasPassive: [() => hasPassive],
  isTown: [() => isTown, v => (isTown = v)],
  linkCost: [() => linkCost],
  pickI: [() => pickI],
  placeFull: [() => placeFull, v => (placeFull = v)],
  placeKind: [() => placeKind, v => (placeKind = v)],
  placeSub: [() => placeSub, v => (placeSub = v)],
  rivalSp: [() => rivalSp, v => (rivalSp = v)],
  roadsOf: [() => roadsOf, v => (roadsOf = v)],
  trainerById: [() => trainerById],
  trainerTeam: [() => trainerTeam, v => (trainerTeam = v)],
  trainersAt: [() => trainersAt],
  typesWith: [() => typesWith],
  warnData: [() => warnData],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const GD = window.GAMEDATA;
provide({ GD }); /* to-module */
if (!GD)
  throw new Error(
    'The game data did not load: data/gamedata.js is missing and the data files in data/ could not be read (npm run check:data says what is wrong).'
  );
export const DATA_WARN = [];
const warnData = m => {
  DATA_WARN.push(m);
  console.warn('[gamedata] ' + m);
};
export const RULES = GD.rules;
provide({ RULES }); /* to-module */
/* ---------- types ---------- */
export const TYPES = GD.types.map(t => t.id);
export const TC = Object.fromEntries(GD.types.map(t => [t.id, [t.color, t.text || '#fff']]));
provide({ TC }); /* to-module */
TC.None = [GD.untyped.color, GD.untyped.text || '#fff'];
const SEm = Object.fromEntries(GD.types.map(t => [t.id, (t.strong || []).filter(x => TC[x])]));
const RESm = Object.fromEntries(GD.types.map(t => [t.id, (t.weak || []).filter(x => TC[x])]));
export const PASSIVE = Object.fromEntries(GD.types.map(t => [t.id, t.passive || '']));
const TYPEFX = Object.fromEntries(GD.types.map(t => [t.id, t.fx && t.fx.length ? t.fx : ['pow', 'star']]));
provide({ TYPEFX }); /* to-module */
TYPEFX.None = GD.untyped.fx || ['pow', 'star'];
const typesWith = p => TYPES.filter(t => PASSIVE[t] === p);
export const hasPassive = (types, p) => types.some(t => PASSIVE[t] === p);
export function eff(at, defs) {
  if (at === 'None' || !SEm[at]) return 1;
  let m = 1;
  for (const d of defs) {
    if (SEm[at].includes(d)) m *= 2;
    else if (RESm[at].includes(d)) m *= 0.5;
  }
  return m;
}
export const STATK = GD.stats.map(s => s.id);
export const STATN = Object.fromEntries(GD.stats.map(s => [s.id, s.name]));
export const STATUSN = Object.fromEntries(GD.statuses.map(s => [s.id, s.name]));
/* ---------- moves ---------- */
export const MOVES = GD.moves;
provide({ MOVES }); /* to-module */
for (const k in MOVES) {
  const M = MOVES[k];
  if (!TC[M.t]) {
    warnData(`Move ${k} has unknown type ${M.t}; using None.`);
    M.t = 'None';
  }
  if (M.a == null) M.a = 100;
}
/* ---------- billionaires ---------- */
const LV = [
  { k: 'lvl', at: 16 },
  { k: 'lvl', at: 36 },
];
export const LINES = GD.lines;
export const LN = Object.fromEntries(LINES.map(l => [l.id, l]));
export const SP = {},
  DEX = [];
provide({ SP }); /* to-module */
const TOT = Object.fromEntries(Object.entries(GD.rarities).map(([k, v]) => [k, v.totals]));
const pickI = (a, i) => a[Math.min(i, a.length - 1)];
LINES.forEach(L => {
  L.learn = (L.learn || []).filter(([lv, mv]) => {
    if (MOVES[mv]) return true;
    warnData(`${L.id} learns unknown move ${mv}.`);
    return false;
  });
  if (!L.learn.length) L.learn = [[1, 'handshake']];
  const sum = L.prof.reduce((a, b) => a + b, 0) || 1,
    ev = L.evo || LV,
    tot = TOT[L.rar] || TOT.common;
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
      at = (arr, d) => (Array.isArray(arr) ? pickI(arr, st0) : d);
    const types = (at(L.types, ['None']) || ['None']).filter(t => TC[t]);
    SP[id] = {
      id,
      name: n,
      line: L.id,
      stage: st,
      types: types.length ? types : ['None'],
      base: L.base && L.base[st] ? L.base[st].slice() : L.prof.map(w => Math.round((pickI(tot, sI) * w) / sum)),
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
            : pickI(RULES.catching.evolved, cI - 1),
      yld: pickI(RULES.progression.xpYield, sI),
      next: last ? null : L.id + (st0 + 1),
      alt: L.split && st0 === 1 ? L.id + '3' : null,
      evo: last
        ? null
        : L.split && st0 === 1
          ? { k: 'split', at: (ev[1] && ev[1].at) || 32 }
          : ev[st] || LV[Math.min(st, 1)],
      no: DEX.length + 1,
      rar: L.rar,
      form: L.split && st0 >= 2 ? (st0 === 2 ? 'A' : 'B') : null,
    };
    DEX.push(id);
  });
});
/* ---------- world ---------- */
export const ROUTE = GD.route;
export const FUTURE = GD.regions;
export const POOLS = {};
for (const k in GD.pools) {
  const P = GD.pools[k];
  POOLS[k] = { lv: P.lv, list: P.list.filter(([id]) => SP[id] || warnData(`Pool ${k} lists unknown Billie ${id}.`)) };
  if (!POOLS[k].list.length) POOLS[k].list = [[DEX[0], 1]];
}
export const BACKDROPS = GD.backdrops;
provide({ BACKDROPS }); /* to-module */
ROUTE.forEach((r, i) => {
  if (!POOLS[r.pool]) {
    warnData(`${r.name} uses unknown pool ${r.pool}.`);
    r.pool = Object.keys(POOLS)[0];
  }
  if (!BACKDROPS[r.area]) r.area = BACKDROPS[r.pool] ? r.pool : 'grass';
  r.trainers = [];
});
/* the walking network: links between stops (both directions); older data is a single chain */
export const LINKS = (GD.links && GD.links.length ? GD.links : ROUTE.slice(1).map((r, i) => [i, i + 1, r.cost || 500]))
  .filter(l => ROUTE[l[0]] && ROUTE[l[1]] && l[0] !== l[1])
  .map(([a, b, c, j]) =>
    j && typeof j === 'object'
      ? [a, b, Math.max(1, Math.round(+c || 500)), j]
      : [a, b, Math.max(1, Math.round(+c || 500))]
  ); /* v42: a fourth entry {a,b} names the exit at each end (the join table) */
/* v46: what each place, scene and road is (tools/migrate-places.py fills these): use these instead of id prefixes */
export const PLACE = Object.fromEntries(ROUTE.map((r, i) => [r.id || r.scene, Object.assign({ node: i }, r)]));
/* alpha 0.4: what a place is, under its name: its route number ("Route 2"), or "Town" / "City"; and its full name,
   the number and the name together ("Route 2 · Tallgrass Meadow"), for signposts, postcards and the like */
export function placeSub(n) {
  if (!n) return '';
  if (n.town) return /City$/.test(n.name || '') ? 'City' : 'Town';
  return n.route || '';
}
export function placeFull(n) {
  if (!n) return '';
  return !n.town && /^Route \d/.test(n.route || '') ? n.route + ' · ' + n.name : n.name;
}
/* alpha 0.4: where a new game starts (rules.start.place: Copperleaf Town; before alpha 0.4 the first stop, Marigold Town) */
export const START_NODE = (() => {
  const p = RULES.start && RULES.start.place;
  return p && PLACE[p] ? PLACE[p].node : 0;
})();
export function placeKind(id) {
  const sc = GD.scenes && GD.scenes[id];
  if (sc && sc.kind) return sc.kind;
  const p = PLACE[id];
  return p
    ? p.kind || (p.town ? 'town' : 'route')
    : /^int_/.test(id || '')
      ? 'room'
      : /^test_/.test(id || '')
        ? 'test'
        : null;
}
export function isTown(nodeOrId) {
  const r = typeof nodeOrId === 'number' ? ROUTE[nodeOrId] : PLACE[nodeOrId];
  return !!r && (r.kind ? r.kind === 'town' : !!r.town);
}
function roadsOf(id) {
  const n = PLACE[id] ? PLACE[id].node : -1;
  return LINKS.map((L, i) => Object.assign({ i, a: L[0], b: L[1], cost: L[2] }, L[3] || {})).filter(
    R => R.a === n || R.b === n
  );
}
export const ADJ = ROUTE.map(() => []);
LINKS.forEach(([a, b, c], i) => {
  ADJ[a].push({ to: b, cost: c, i });
  ADJ[b].push({ to: a, cost: c, i });
});
export const linkCost = (a, b) => {
  const e = (ADJ[a] || []).find(e => e.to === b);
  return e ? e.cost : null;
};
export const STEPS_PER_KM = RULES.steps.stepsPerKm;
export const EGGS = {};
for (const k in GD.eggs) {
  const E = GD.eggs[k];
  EGGS[k] = {
    need: E.need,
    lv: E.lv,
    list: E.list.filter(([id]) => SP[id] || warnData(`Egg ${k} km lists unknown Billie ${id}.`)),
  };
}
export const EGG_TIERS = Object.keys(EGGS)
  .map(Number)
  .sort((a, b) => a - b);
export const COINS = GD.coins;
provide({ COINS }); /* to-module */
export const ITEMS = GD.items;
export const JOBS = GD.jobs;
export const JOB_STEPS = RULES.jobs.stepsPerPay;
export const PEOPLE = GD.people;
provide({ PEOPLE }); /* to-module */
export const SHOPS = GD.shops || {};
/* ---------- trainers: plain data, turned into teams when a battle starts ---------- */
export const TRAINERS = GD.trainers || {};
/* v47: a "tutorial" trainer only battles in a story scene (blake0, in the opening); it stands on no stop */
for (const id in TRAINERS) {
  const T = TRAINERS[id];
  T.id = id;
  if (T.tutorial);
  else if (ROUTE[T.node]) ROUTE[T.node].trainers.push(id);
  else warnData(`Trainer ${id} stands on a stop that doesn’t exist.`);
  if (!PEOPLE[T.who]) T.who = 'gini';
  T.team = (T.team || []).filter(
    e => /^@rival\d?$/.test(e.sp) || SP[e.sp] || warnData(`Trainer ${id} has unknown Billie ${e.sp}.`)
  );
}
/* the first trainer at a stop that hands out a Board Seat (or doesn’t block the road) is that stop’s Boardroom */
ROUTE.forEach(r => {
  r.board = r.trainers.find(id => TRAINERS[id].seat) || null;
});
const SEATS = Object.values(TRAINERS)
  .filter(T => T.seat)
  .map(T => T.seat.id);
/* "@rival" is the starter that beats yours; "@rival1" / "@rival2" the same line evolved */
export function rivalSp(code) {
  const base = RULES.start.rival[S.starter] || DEX[0],
    st = +(code.slice(6) || 0),
    id = base.replace(/\d+$/, '') + st;
  return SP[id] ? id : base;
}
/* a team entry may name its moves (v47: Blake's first billionaire only knows Tackle) */
export function trainerTeam(T) {
  return T.team.map(e => {
    const m = makeMon(/^@rival\d?$/.test(e.sp) ? rivalSp(e.sp) : e.sp, e.lvl),
      mv = Array.isArray(e.moves) ? e.moves.filter(k => MOVES[k]) : [];
    if (mv.length) m.moves = mv;
    return m;
  });
}
const trainerById = id => TRAINERS[id] || null;
/* a trainer with "after" only turns up once you've beaten that one */
export const trainersAt = i =>
  ((ROUTE[i] && ROUTE[i].trainers) || [])
    .map(id => TRAINERS[id])
    .filter(T => !T.after || (typeof S !== 'undefined' && S.flags && S.flags[T.after]));
