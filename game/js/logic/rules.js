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
  EGGS,
  EGG_TIERS,
  ITEMS,
  LINE_BY_ID,
  LOCATIONS,
  LOCATION_BY_ID,
  MOVES,
  POOLS,
  ROADS_BY_NODE,
  RULES,
  SPECIES,
  STAT_IDS,
  TRAINERS,
  gameData,
  isTown,
  trainersAt,
  typeEffectiveness,
} from '../game-data.js';
import { partsLean, partsPrime, partsStatFactor, partsWeightRatio } from './parts.js';
import {
  ROBOT_LIMBS,
  ROBOT_SLOTS,
  isRobot,
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
  billyBuild: [() => billyBuild],
  billyName: [() => billyName],
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
  encounterStock: [() => encounterStock, v => (encounterStock = v)],
  // @ts-expect-error -- replaced on purpose
  encountersHere: [() => encountersHere, v => (encountersHere = v)],
  // @ts-expect-error -- replaced on purpose
  evolutionHint: [() => evolutionHint, v => (evolutionHint = v)],
  evolutionItemName: [() => evolutionItemName],
  // @ts-expect-error -- replaced on purpose
  evolve: [() => evolve, v => (evolve = v)],
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
  // @ts-expect-error -- replaced on purpose
  hatchEgg: [() => hatchEgg, v => (hatchEgg = v)],
  hatchable: [() => hatchable],
  // @ts-expect-error -- replaced on purpose
  healAll: [() => healAll, v => (healAll = v)],
  hereLocation: [() => hereLocation],
  isPrime: [() => isPrime],
  // @ts-expect-error -- replaced on purpose
  makeBilly: [() => makeBilly, v => ((makeBilly = v), provide({ makeBilly }))],
  // @ts-expect-error -- replaced on purpose
  makeRobot: [() => makeRobot, v => ((makeRobot = v), provide({ makeRobot }))],
  maxHp: [() => maxHp],
  maxLevel: [() => maxLevel],
  metresToKm: [() => metresToKm],
  moveSlotCount: [() => moveSlotCount],
  // @ts-expect-error -- replaced on purpose
  moveUsable: [() => moveUsable, v => (moveUsable = v)],
  // @ts-expect-error -- replaced on purpose
  movesAt: [() => movesAt, v => (movesAt = v)],
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
provide({ addWalked, makeBilly, makeRobot, riderOf });
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
export const billyWeight = m => Math.round(speciesOf(m).wt * buildWeightRatio(billyBuild(m)) * 10) / 10;
/** @param {Build} b @param {string} k a stat id @returns {number} what the build does to that stat (1 = nothing) */
export const buildStatFactor = (b, k) => partsStatFactor(RULES.parts, b, k);
/** @param {Build} b phase 06: which way the build leans (attack, speed, lean, off, prime), for the Build tab */
export const buildLean = b => partsLean(RULES.parts, b);

/* ---------- billionaires ---------- */
export function stat(m, k) {
  const b = speciesOf(m).base[STAT_IDS.indexOf(k)];
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
    gold: false,
    nick: o.nick || '',
    partDmg: {},
  };
  m.hp = maxHp(m);
  return m;
}
/** after its parts change: its sp and moves follow them, and its HP stays the same share of the new max
 * @param {Billy} m */
export function refreshRobot(m) {
  if (!isRobot(m) || !validRobot(m.gem, m.fit)) return;
  const fit = /** @type {RobotFit} */ (m.fit),
    gem = /** @type {string} */ (m.gem),
    was = m.hp > 0 ? m.hp / Math.max(1, maxHp(m)) : 0;
  m.sp = robotSp(gem, fit);
  m.moves = robotMoves(gem, fit);
  m.hp = m.hp > 0 ? Math.max(1, Math.round(maxHp(m) * was)) : 0;
  m.partDmg = m.partDmg || {};
}
/** a limb's own HP when whole @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export function partMaxHp(m, slot) {
  const P = m.fit && robotPartDef(m.fit[slot].id);
  return Math.max(1, Math.round(maxHp(m) * robotRules().partHpRatio * ((P && P.dur) ?? 1)));
}
/** @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export const partHpLeft = (m, slot) => Math.max(0, partMaxHp(m, slot) - ((m.partDmg && m.partDmg[slot]) || 0));
/** @param {Billy} m @param {'armL' | 'armR' | 'legs'} slot */
export const partBroken = (m, slot) => isRobot(m) && partHpLeft(m, slot) <= 0;
/** @param {Billy} m @returns {('armL' | 'armR' | 'legs')[]} */
export const brokenParts = m => (isRobot(m) ? ROBOT_LIMBS.filter(k => partBroken(m, k)) : []);
/** can it use this move now? A robot can't use a move whose every part giving it is broken (the gem's always works)
 * @param {Billy} m @param {string} mid */
export function moveUsable(m, mid) {
  if (!isRobot(m)) return true;
  const src = moveSources(/** @type {string} */ (m.gem), /** @type {RobotFit} */ (m.fit), mid);
  return !src.length || src.some(k => k === 'gem' || !partBroken(m, /** @type {'armL' | 'armR' | 'legs'} */ (k)));
}
/** fixes a share (1 = all) of each limb's lost HP; a broken one comes back once it is above zero
 * @param {Billy} m @param {number} share @returns {boolean} whether anything was fixed */
export function repairParts(m, share = 1) {
  if (!isRobot(m) || !m.partDmg) return false;
  let any = false;
  for (const k of ROBOT_LIMBS) {
    const d = m.partDmg[k] || 0;
    if (d <= 0) continue;
    const fix = share >= 1 ? d : Math.ceil(partMaxHp(m, k) * share);
    m.partDmg[k] = Math.max(0, d - fix);
    any = true;
  }
  return any;
}
/** does it have damaged parts? @param {Billy} m */
export const partsDamaged = m => isRobot(m) && ROBOT_LIMBS.some(k => ((m.partDmg && m.partDmg[k]) || 0) > 0);
/** puts a part from your parts on a robot; the part it replaces goes back to your parts. A gem (slot 'gem') swaps the
 * robot's gem the same way: the robot keeps its level, the old gem goes back as a spare.
 * @param {Billy} m @param {RobotSlot | 'gem'} slot @param {string} uid a part in saveData.parts @returns {boolean} */
export function fitPart(m, slot, uid) {
  if (!isRobot(m)) return false;
  const i = saveData.parts.findIndex(p => p.uid === uid);
  if (i < 0) return false;
  const p = saveData.parts[i];
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
  refreshRobot(m);
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
  p.up = (p.up || 0) + 1;
  for (const m of allBillies()) if (isRobot(m) && m.fit && Object.values(m.fit).includes(p)) refreshRobot(m);
  return true;
}
export const billyName = m => m.nick || speciesOf(m).name;
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
  /* phase 17: robots aren't in the Guide */
  if (!isRobot(m)) {
    saveData.caught[m.sp] = 1;
    saveData.seen[m.sp] = 1;
  }
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
    const sp = speciesOf(m);
    if (!sp || !sp.types.some(t => (R.types || ['Water']).includes(t)) || sp.ht < (R.minHeight || 1.5)) continue;
    if (!best || sp.ht > speciesOf(best).ht) best = m;
  }
  return best;
}
export const canRide = () => !!riderOf();
export const riderName = () => {
  const m = riderOf();
  return m ? m.nick || speciesOf(m).name : '';
};
export const canEnter = n =>
  (!LOCATIONS[n].gate || saveData.seats.includes(LOCATIONS[n].gate)) && (!LOCATIONS[n].ride || canRide());
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
    gold: random() < 1 / RULES.encounters.goldOdds,
    no: ++saveData.serial,
    build: rollBuild(),
  };
  /* v33: now and then an Alpha (once you have two billionaires to stand with your lead) */
  if (!gentle && !force && saveData.team.length >= 2 && random() < 1 / (RULES.encounters.alphaOdds || 45))
    q.alpha = true;
  wildList(node).push(q);
  return q;
}

/* ---------- walking and eggs ---------- */
/* phase 08: the metres you walk outdoors (walk-view.js movePlayer; not in rooms, on ladders or test benches, and not a
   jump to a new view): the distance on your trainer card, and what hatches the eggs in your incubators (eggs.json need,
   in metres). Saved every 20 m, and at once when an egg is ready */
export let walkedUnsaved = 0;
export function addWalked(m) {
  if (!saveData.started || !Number.isFinite(m) || m <= 0 || m > 1000) return;
  const S = saveData.stats || (saveData.stats = {});
  S.walked = (S.walked || 0) + m;
  let ready = false;
  for (const e of saveData.eggs) {
    const need = EGGS[e.tier].need;
    if (e.slot == null || e.prog >= need) continue;
    e.prog = Math.min(need, e.prog + m);
    if (e.prog >= need) ready = true;
  }
  walkedUnsaved += m;
  if (!ready && walkedUnsaved < 20) return;
  walkedUnsaved = 0;
  save();
  if (ready && !activeBattle) {
    render();
    showPendingWindows();
  }
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
