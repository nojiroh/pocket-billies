// @ts-check
'use strict';
/* ================= RULES =================
   Phase 04e: the game's rules outside battle, moved here from game-state.js: a Billie's stats, levels, moves and
   evolution, the team and storage, steps and their money, the trip along the roads and its gates, encounters from the
   pool where you are, eggs and day jobs, and the small helpers they share.
   Logic only (game/js/logic/): no DOM, WebGL or window, so it runs in plain Node (tools/test/logic.test.mjs). The data
   tables come from game-data.js; the save, the battle and the interface state (saveData, activeBattle, uiState), and
   what the rules tell the interface (save, toast, render), come through hooks.js, filled by game-state.js and ui.js on
   the page or by a test in Node. */
/** @import { Billy, JobSlot } from '../../types/save-data' */
/** @import { Trainer } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  JINGLES,
  activeBattle,
  environmentOdds,
  jingle,
  provide,
  render,
  save,
  saveData,
  showPendingWindows,
  soundEffect,
  toast,
  uiState,
} from '../hooks.js';
import { random } from '../util.js';
import {
  COINS,
  EGGS,
  EGG_TIERS,
  ITEMS,
  JOBS,
  JOB_STEPS,
  LINE_BY_ID,
  LOCATIONS,
  LOCATION_BY_ID,
  MOVES,
  POOLS,
  ROADS_BY_NODE,
  RULES,
  SPECIES,
  STAT_IDS,
  STEPS_PER_KM,
  TRAINERS,
  gameData,
  isTown,
  trainersAt,
  typeEffectiveness,
} from '../game-data.js';
import { partsPrime, partsStatFactor, partsWeightRatio } from './parts.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  addBilly: [() => addBilly, v => (addBilly = v)],
  // @ts-expect-error -- replaced on purpose
  addEgg: [() => addEgg, v => (addEgg = v)],
  // @ts-expect-error -- replaced on purpose
  addSteps: [() => addSteps, v => ((addSteps = v), provide({ addSteps }))],
  allBillies: [() => allBillies],
  // @ts-expect-error -- replaced on purpose
  assignJob: [() => assignJob, v => (assignJob = v)],
  // @ts-expect-error -- replaced on purpose
  autoSlot: [() => autoSlot, v => (autoSlot = v)],
  billyBuild: [() => billyBuild],
  billyName: [() => billyName],
  billyWeight: [() => billyWeight],
  // @ts-expect-error -- replaced on purpose
  blockerAt: [() => blockerAt, v => (blockerAt = v)],
  buildStatFactor: [() => buildStatFactor],
  buildWeightRatio: [() => buildWeightRatio],
  canEnter: [() => canEnter],
  // @ts-expect-error -- replaced on purpose
  canEvolve: [() => canEvolve, v => (canEvolve = v)],
  canRide: [() => canRide],
  // @ts-expect-error -- replaced on purpose
  cleanBuild: [() => cleanBuild, v => (cleanBuild = v)],
  cleanName: [() => cleanName],
  // @ts-expect-error -- replaced on purpose
  collectJob: [() => collectJob, v => (collectJob = v)],
  // @ts-expect-error -- replaced on purpose
  dropEncounter: [() => dropEncounter, v => (dropEncounter = v)],
  eggSlotCount: [() => eggSlotCount],
  emptyJob: [() => emptyJob],
  // @ts-expect-error -- replaced on purpose
  encounterBuild: [() => encounterBuild, v => (encounterBuild = v)],
  // @ts-expect-error -- replaced on purpose
  encounterPoolHere: [() => encounterPoolHere, v => (encounterPoolHere = v)],
  // @ts-expect-error -- replaced on purpose
  encounterStock: [() => encounterStock, v => (encounterStock = v)],
  // @ts-expect-error -- replaced on purpose
  encountersHere: [() => encountersHere, v => (encountersHere = v)],
  // @ts-expect-error -- replaced on purpose
  endShift: [() => endShift, v => (endShift = v)],
  // @ts-expect-error -- replaced on purpose
  evolutionHint: [() => evolutionHint, v => (evolutionHint = v)],
  evolutionItemName: [() => evolutionItemName],
  // @ts-expect-error -- replaced on purpose
  evolve: [() => evolve, v => (evolve = v)],
  findBilly: [() => findBilly],
  formatNumber: [() => formatNumber],
  // @ts-expect-error -- replaced on purpose
  gainXp: [() => gainXp, v => (gainXp = v)],
  // @ts-expect-error -- replaced on purpose
  gateOwner: [() => gateOwner, v => (gateOwner = v)],
  // @ts-expect-error -- replaced on purpose
  gateText: [() => gateText, v => (gateText = v)],
  // @ts-expect-error -- replaced on purpose
  hatchEgg: [() => hatchEgg, v => (hatchEgg = v)],
  hatchable: [() => hatchable],
  // @ts-expect-error -- replaced on purpose
  healAll: [() => healAll, v => (healAll = v)],
  hereLocation: [() => hereLocation],
  isPrime: [() => isPrime],
  jobSlotCount: [() => jobSlotCount],
  // @ts-expect-error -- replaced on purpose
  makeBilly: [() => makeBilly, v => ((makeBilly = v), provide({ makeBilly }))],
  maxHp: [() => maxHp],
  maxLevel: [() => maxLevel],
  moveSlotCount: [() => moveSlotCount],
  // @ts-expect-error -- replaced on purpose
  movesAt: [() => movesAt, v => (movesAt = v)],
  newUid: [() => newUid],
  nextTripNode: [() => nextTripNode],
  partRules: [() => partRules],
  partSlots: [() => partSlots],
  pathFrom: [() => pathFrom],
  // @ts-expect-error -- replaced on purpose
  pickWeighted: [() => pickWeighted, v => (pickWeighted = v)],
  plural: [() => plural],
  // @ts-expect-error -- replaced on purpose
  primeBuild: [() => primeBuild, v => (primeBuild = v)],
  riderName: [() => riderName],
  // @ts-expect-error -- replaced on purpose
  riderOf: [() => riderOf, v => ((riderOf = v), provide({ riderOf }))],
  // @ts-expect-error -- replaced on purpose
  rollBuild: [() => rollBuild, v => (rollBuild = v)],
  // @ts-expect-error -- replaced on purpose
  rollPartSize: [() => rollPartSize, v => (rollPartSize = v)],
  setTrip: [() => setTrip, v => setSetTrip(v)],
  // @ts-expect-error -- replaced on purpose
  spawn: [() => spawn, v => (spawn = v)],
  // @ts-expect-error -- replaced on purpose
  splitPath: [() => splitPath, v => (splitPath = v)],
  // @ts-expect-error -- replaced on purpose
  stat: [() => stat, v => (stat = v)],
  stepsToKm: [() => stepsToKm],
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
  walkDistances: [() => walkDistances, v => (walkDistances = v)],
  // @ts-expect-error -- replaced on purpose
  wildList: [() => wildList, v => (wildList = v)],
  wildPrize: [() => wildPrize],
  xpFor: [() => xpFor],
});
/* eslint-enable no-func-assign */
provide({ addSteps, makeBilly, riderOf });
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
export const stepsToKm = st => (st / STEPS_PER_KM).toFixed(1);
export const newUid = () => 'm' + Date.now().toString(36) + Math.floor(random() * 1e8).toString(36);
export const today = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
export const plural = (n, w) => `${formatNumber(n)} ${w}${n === 1 ? '' : 's'}`;
export function pickWeighted(list) {
  const tot = list.reduce((a, b) => a + b[1], 0);
  let r = random() * tot;
  for (const [id, w] of list) {
    r -= w;
    if (r <= 0) return id;
  }
  return list[0][0];
}

/* ---------- state ---------- */
export const xpFor = L => Math.floor(RULES.progression.xpFactor * L * L * L);
export const maxLevel = () => RULES.progression.maxLevel,
  moveSlotCount = () => RULES.progression.moveSlots,
  teamSize = () => RULES.progression.teamSize;
export const jobSlotCount = () => Math.max(1, RULES.jobs.positions || 3);
/** @returns {JobSlot} */
export const emptyJob = () => ({ uid: null, job: null, acc: 0, pend: 0 });

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
export function rollPartSize() {
  const S = RULES.parts.sizes,
    list = /** @type {[string, number][]} */ (Object.keys(S).map(k => [k, S[k].odds]));
  return /** @type {PartSize} */ (pickWeighted(list));
}
/** @returns {Build} a wild Billie's sizes */
export function rollBuild() {
  /** @type {Build} */
  const b = {};
  for (const k of partSlots()) b[k] = rollPartSize();
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
/** @param {Build} b */
export const isPrime = b => partsPrime(RULES.parts, b);
/** @param {Build} b the weight as a share of the species' own weight (1 = all M) */
export const buildWeightRatio = b => partsWeightRatio(RULES.parts, b);
/** @returns {number} a Billie's weight in kg (its species' weight times its build) */
export const billyWeight = m => Math.round(SPECIES[m.sp].wt * buildWeightRatio(billyBuild(m)) * 10) / 10;
/** @param {Build} b @param {string} k a stat id @returns {number} what the build does to that stat (1 = nothing) */
export const buildStatFactor = (b, k) => partsStatFactor(RULES.parts, b, k);

/* ---------- billionaires ---------- */
export function stat(m, k) {
  const b = SPECIES[m.sp].base[STAT_IDS.indexOf(k)];
  let v = k === 'hp' ? Math.floor((2 * b * m.lvl) / 100) + m.lvl + 10 : Math.floor((2 * b * m.lvl) / 100) + 5;
  /* phase 16: its parts (weight and Prime) */
  if (m.build) v = Math.max(1, Math.round(v * buildStatFactor(m.build, k)));
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
    gold: !!o.gold,
    nick: '',
    /* phase 16: sizes given (a wild one's), rolled (o.wild) or all M (starters, trainers) */
    build: o.build ? cleanBuild(o.build) : o.wild ? rollBuild() : primeBuild(),
  };
  m.hp = maxHp(m);
  try {
    if (typeof saveData !== 'undefined' && saveData && saveData.trip && LOCATIONS[saveData.trip.node])
      m.met = { n: LOCATIONS[saveData.trip.node].id || saveData.trip.node, t: Date.now() };
  } catch (e) {}
  return m;
}
export const billyName = m => m.nick || SPECIES[m.sp].name;
export const allBillies = () => saveData.team.concat(saveData.box);
export const findBilly = id => allBillies().find(m => m.uid === id);
export function gainXp(m, amt, say) {
  if (m.lvl >= maxLevel() || amt <= 0) return;
  m.xp += amt;
  while (m.lvl < maxLevel() && m.xp >= xpFor(m.lvl + 1)) {
    const old = maxHp(m);
    m.lvl++;
    if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) - old);
    say(`${billyName(m)} grew to level ${m.lvl}.`, { k: 'lvl', uid: m.uid });
    for (const [lv, mv] of LINE_BY_ID[SPECIES[m.sp].line].learn) {
      if (lv !== m.lvl || m.moves.includes(mv)) continue;
      if (m.moves.length < moveSlotCount()) {
        m.moves.push(mv);
        say(`${billyName(m)} learned ${MOVES[mv].n}.`);
      } else uiState.learnQ.push({ uid: m.uid, mv });
    }
  }
}
export function canEvolve(m) {
  const e = SPECIES[m.sp].evo;
  if (!e) return false;
  if (m.evoNo != null && m.lvl <= m.evoNo) return false;
  switch (e.k) {
    case 'lvl':
    case 'split':
      return m.lvl >= e.at;
    case 'buddy':
      return (m.bsteps || 0) >= e.steps;
    case 'idle':
      return !!m.boxedAt && !m.job && saveData.box.includes(m) && Date.now() - m.boxedAt >= e.ms && m.lvl >= e.min;
    case 'streak':
      return (m.streak || 0) >= e.n && m.lvl >= e.min;
    default:
      return false;
  }
}
export const evolutionItemName = e => (ITEMS[e.item || 'bell'] ? ITEMS[e.item || 'bell'].n : 'Shining Stone');
export function evolutionHint(m) {
  const s = SPECIES[m.sp],
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
      return `Evolves at level ${e.at} into ${nm} or ${an}: ${splitPath(m) === 'A' ? 'the Build path is ahead' : 'the Hype path is ahead'} (${m.wins || 0} battles won, ${stepsToKm(m.bsteps || 0)} km walked as buddy${m.psteps ? ` + ${stepsToKm((m.psteps || 0) / 2)} km in the party at half weight` : ''}).`;
    }
    case 'buddy':
      return `Evolves after you walk ${stepsToKm(e.steps)} km with it as your buddy. ${stepsToKm(m.bsteps || 0)} of ${stepsToKm(e.steps)} km so far.`;
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
/* v36: which final a split line takes: Build (A) when the kilometres it walked as your buddy outweigh the battles it won
   (1 km counts as one win), Hype (B) otherwise. A tie goes to Build. */
export function splitPath(m) {
  const wins = m.wins || 0,
    kmW = ((m.bsteps || 0) + (m.psteps || 0) / 2) / STEPS_PER_KM;
  return wins > kmW ? 'B' : 'A';
}
export function evolve(m) {
  if (typeof jingle === 'function') jingle(JINGLES.evolve, 140);
  const old = maxHp(m),
    from = billyName(m),
    s0 = SPECIES[m.sp];
  m.sp = s0.evo && s0.evo.k === 'split' && s0.alt && splitPath(m) === 'B' ? s0.alt : s0.next;
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
  }
}
export function toBox(m) {
  const i = saveData.team.indexOf(m);
  if (i >= 0) saveData.team.splice(i, 1);
  if (!saveData.box.includes(m)) saveData.box.push(m);
  m.boxedAt = Date.now();
}
export function toTeam(m) {
  const i = saveData.box.indexOf(m);
  if (i >= 0) saveData.box.splice(i, 1);
  if (!saveData.team.includes(m)) saveData.team.push(m);
  m.boxedAt = null;
}
export function addBilly(m) {
  saveData.caught[m.sp] = 1;
  saveData.seen[m.sp] = 1;
  if (saveData.team.length < teamSize()) {
    saveData.team.push(m);
    return 'team';
  }
  m.boxedAt = Date.now();
  saveData.box.push(m);
  return 'box';
}

/* ---------- gates ---------- */
export function gateOwner(seat) {
  return Object.values(TRAINERS).find(T => T.seat && T.seat.id === seat);
}
export function gateText(n) {
  if (n.gate && !saveData.seats.includes(n.gate) && n.gateText) return n.gateText;
  if (n.ride && !canRide()) {
    const R = RULES.ride || { minHeight: 1.5 };
    return `To cross ${n.name} you need a Water Billie at least ${R.minHeight || 1.5} m tall in your team to ride on. Quant and Billigator are big enough.`;
  }
  if (n.gateText) return n.gateText;
  const T = gateOwner(n.gate);
  return `${n.name} opens once you earn ${T ? T.name + '’s' : 'another'} badge.`;
}
export function blockerAt(i) {
  return trainersAt(i).find(T => T.blocks && !saveData.flags[T.id]) || null;
}
/* ---------- travel: a plan of stops to walk to, one link at a time; an empty plan means staying put ---------- */
/* v24: lake and sea roads need a Water billionaire big enough to ride (rules.ride: types, minHeight in metres) */
export function riderOf() {
  const R = RULES.ride || { minHeight: 1.5, types: ['Water'] };
  /** @type {Billy | null} */
  let best = null;
  for (const m of saveData.team) {
    const sp = SPECIES[m.sp];
    if (!sp || !sp.types.some(t => (R.types || ['Water']).includes(t)) || sp.ht < (R.minHeight || 1.5)) continue;
    if (!best || sp.ht > SPECIES[best.sp].ht) best = m;
  }
  return best;
}
export const canRide = () => !!riderOf();
export const riderName = () => {
  const m = riderOf();
  return m ? m.nick || SPECIES[m.sp].name : '';
};
export const canEnter = n =>
  (!LOCATIONS[n].gate || saveData.seats.includes(LOCATIONS[n].gate)) && (!LOCATIONS[n].ride || canRide());
export const nextTripNode = () => (saveData.trip.plan.length ? saveData.trip.plan[0] : null);
/* shortest walk (in steps) between stops, entering only stops you may enter; returns {d,prev} */
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
/* steps from where you stand to stop j, and the plan that gets there */
export function tripTo(j) {
  const node = saveData.trip.node;
  if (j === node) return { steps: 0, plan: [] };
  const D = walkDistances(node);
  if (D.d[j] === Infinity) return null;
  return { steps: D.d[j], plan: pathFrom(D.prev, j) };
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
export function encountersHere(node = saveData.trip.node) {
  const L = LOCATIONS[node];
  if (!L) return [];
  const W = saveData.wild || (saveData.wild = {}),
    now = saveData.playMs || 0,
    cap = encounterStock(node),
    w = W[L.id];
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
export function spawn(gentle, force, node = saveData.trip.node) {
  const P = encounterPoolHere(node);
  let list = typeof environmentOdds === 'function' ? environmentOdds(P.list) : P.list;
  if (gentle) {
    const my = SPECIES[saveData.starter + '0'].types,
      g = list.filter(([id]) => !SPECIES[id].types.some(t => typeEffectiveness(t, my) > 1));
    if (g.length) list = g;
  }
  const sp = force || pickWeighted(list),
    lvl = P.lv[0] + Math.floor(random() * (P.lv[1] - P.lv[0] + 1));
  const q = {
    id: newUid(),
    sp,
    lvl,
    gold: random() < 1 / RULES.steps.goldOdds,
    no: ++saveData.serial,
    build: rollBuild(),
  };
  /* v33: now and then an Alpha (once you have two billionaires to stand with your lead) */
  if (
    !gentle &&
    !force &&
    saveData.team.filter(m => m.job == null).length >= 2 &&
    random() < 1 / ((RULES.steps && RULES.steps.alphaOdds) || 45)
  )
    q.alpha = true;
  wildList(node).push(q);
  return q;
}
export function addSteps(n, quiet) {
  n = Math.floor(Number(n));
  if (!saveData.started || !Number.isFinite(n) || n <= 0 || n > 100000) return;
  saveData.totalSteps += n;
  const bud = findBilly(saveData.buddy);
  if (bud) bud.bsteps = (bud.bsteps || 0) + n;
  /* v37: the rest of the party walks too, at half weight (for the Build path of a split evolution) */ for (const m of saveData.team)
    if (m !== bud) m.psteps = (m.psteps || 0) + n;
  saveData.eggs.forEach(e => {
    if (e.slot != null) e.prog = Math.min(EGGS[e.tier].need, e.prog + n);
  });
  saveData.jobs.forEach(j => {
    if (!j.uid) return;
    j.acc += n;
    while (j.acc >= JOB_STEPS) {
      j.acc -= JOB_STEPS;
      if (j.pend < RULES.jobs.maxPending) j.pend++;
    }
  });
  if (!quiet) toast(`+${formatNumber(n)} steps`);
  save();
  if (!activeBattle) {
    render();
    showPendingWindows();
  }
}

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
  let sp = pickWeighted(T.list),
    gold = random() < 1 / (top ? R.goldOdds10 : R.goldOdds);
  if (top && SPECIES[R.mythSpecies] && random() < 1 / R.mythOdds) {
    sp = R.mythSpecies;
    gold = false;
  }
  const m = makeBilly(sp, T.lv, { gold, wild: true });
  saveData.eggs = saveData.eggs.filter(x => x !== e);
  saveData.hatched = (saveData.hatched || 0) + 1;
  autoSlot();
  const where = addBilly(m);
  save();
  return { m, where };
}

/* ---------- Day Jobs ---------- */
export function assignJob(slot, job, id) {
  const m = findBilly(id);
  if (!m || m.job != null) return false;
  if (saveData.team.includes(m) && saveData.team.filter(x => x.job == null).length <= 1) return false;
  toBox(m);
  m.boxedAt = null;
  m.job = slot;
  saveData.jobs[slot] = { uid: id, job, acc: 0, pend: 0 };
  save();
  return true;
}
export function collectJob(slot) {
  const j = saveData.jobs[slot];
  if (!j.uid || !j.pend) return null;
  /* a slot with a Billie has a job (assignJob sets both) */
  const J = JOBS[/** @type {string} */ (j.job)],
    [kind, key, amt] = J.out,
    n = j.pend;
  j.pend = 0;
  if (kind === 'item') saveData.items[key] += amt * n;
  else if (kind === 'coin') saveData.coins[key] += amt * n;
  else saveData.se += amt * n;
  save();
  const m = findBilly(j.uid);
  return `${m ? billyName(m) : 'Your Billie'} ${J.quip} You collected ${kind === 'se' ? '$' + formatNumber(amt * n) : `${amt * n} × ${kind === 'item' ? ITEMS[key].n : COINS[key].n}`}.`;
}
export function endShift(slot) {
  const j = saveData.jobs[slot];
  const msg = collectJob(slot);
  const m = findBilly(j.uid);
  if (m) {
    m.job = null;
    m.boxedAt = Date.now();
  }
  saveData.jobs[slot] = { uid: null, job: null, acc: 0, pend: 0 };
  save();
  return msg;
}
