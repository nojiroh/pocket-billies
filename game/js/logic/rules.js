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
/** @import { Billy, JobSlot, PartInstance, RobotFit } from '../../types/save-data' */
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
  COINS,
  EGGS,
  EGG_TIERS,
  ITEMS,
  JOBS,
  JOB_STEPS,
  LINE_BY_ID,
  LOCATIONS,
  MOVES,
  POOLS,
  ROADS_BY_NODE,
  RULES,
  SPECIES,
  STAT_IDS,
  STEPS_PER_KM,
  TRAINERS,
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
  STEP_BRACKETS: [() => STEP_BRACKETS],
  // @ts-expect-error -- replaced on purpose
  addBilly: [() => addBilly, v => (addBilly = v)],
  // @ts-expect-error -- replaced on purpose
  addEgg: [() => addEgg, v => (addEgg = v)],
  // @ts-expect-error -- replaced on purpose
  addPart: [() => addPart, v => (addPart = v)],
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
  // @ts-expect-error -- replaced on purpose
  collectJob: [() => collectJob, v => (collectJob = v)],
  // @ts-expect-error -- replaced on purpose
  earningsBetween: [() => earningsBetween, v => (earningsBetween = v)],
  eggSlotCount: [() => eggSlotCount],
  emptyJob: [() => emptyJob],
  // @ts-expect-error -- replaced on purpose
  encounterBuild: [() => encounterBuild, v => (encounterBuild = v)],
  // @ts-expect-error -- replaced on purpose
  encounterPoolHere: [() => encounterPoolHere, v => (encounterPoolHere = v)],
  // @ts-expect-error -- replaced on purpose
  endShift: [() => endShift, v => (endShift = v)],
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
  jobSlotCount: [() => jobSlotCount],
  // @ts-expect-error -- replaced on purpose
  makeBilly: [() => makeBilly, v => ((makeBilly = v), provide({ makeBilly }))],
  // @ts-expect-error -- replaced on purpose
  makeRobot: [() => makeRobot, v => ((makeRobot = v), provide({ makeRobot }))],
  maxHp: [() => maxHp],
  maxLevel: [() => maxLevel],
  moveSlotCount: [() => moveSlotCount],
  // @ts-expect-error -- replaced on purpose
  moveUsable: [() => moveUsable, v => (moveUsable = v)],
  // @ts-expect-error -- replaced on purpose
  movesAt: [() => movesAt, v => (movesAt = v)],
  newUid: [() => newUid],
  nextBracket: [() => nextBracket],
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
  rollDay: [() => rollDay, v => (rollDay = v)],
  // @ts-expect-error -- replaced on purpose
  rollPartSize: [() => rollPartSize, v => (rollPartSize = v)],
  setTrip: [() => setTrip, v => setSetTrip(v)],
  // @ts-expect-error -- replaced on purpose
  spawn: [() => spawn, v => (spawn = v)],
  // @ts-expect-error -- replaced on purpose
  splitPath: [() => splitPath, v => (splitPath = v)],
  // @ts-expect-error -- replaced on purpose
  stat: [() => stat, v => (stat = v)],
  stepRate: [() => stepRate],
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
  upgradePart: [() => upgradePart, v => (upgradePart = v)],
  // @ts-expect-error -- replaced on purpose
  walkDistances: [() => walkDistances, v => (walkDistances = v)],
  xpFor: [() => xpFor],
});
/* eslint-enable no-func-assign */
provide({ addSteps, makeBilly, makeRobot, riderOf });
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
    s0 = speciesOf(m);
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

/* ---------- steps ---------- */
export const STEP_BRACKETS = RULES.steps.brackets
  .map(b => [b.upTo > 0 ? b.upTo : Infinity, b.rate])
  .sort((a, b) => a[0] - b[0]);
if (!STEP_BRACKETS.length || STEP_BRACKETS[STEP_BRACKETS.length - 1][0] !== Infinity)
  STEP_BRACKETS.push([Infinity, STEP_BRACKETS.length ? STEP_BRACKETS[STEP_BRACKETS.length - 1][1] : 1]);
export function earningsBetween(a, b) {
  let se = 0,
    lo = 0;
  for (const [hi, r] of STEP_BRACKETS) {
    const s = Math.max(a, lo),
      e = Math.min(b, hi);
    if (e > s) se += (e - s) * r;
    lo = hi;
  }
  return se;
}
export const stepRate = st => {
  for (const [hi, r] of STEP_BRACKETS) if (st < hi) return r;
  return STEP_BRACKETS[STEP_BRACKETS.length - 1][1];
};
export const nextBracket = st => STEP_BRACKETS.find(([hi]) => st < hi);
export function rollDay() {
  if (saveData.day.date !== today()) saveData.day = { date: today(), steps: 0 };
}
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
export function encounterPoolHere() {
  return POOLS[hereLocation().pool] || POOLS[Object.keys(POOLS)[0]];
}
export function spawn(gentle, force) {
  const P = encounterPoolHere();
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
  saveData.queue.push(q);
  return q;
}
export function addSteps(n, quiet) {
  n = Math.floor(Number(n));
  if (!saveData.started || !Number.isFinite(n) || n <= 0 || n > 100000) return;
  rollDay();
  const a = saveData.day.steps,
    b = a + n,
    g = earningsBetween(a, b) + saveData.seFrac,
    gi = Math.floor(g);
  saveData.seFrac = g - gi;
  saveData.se += gi;
  saveData.day.steps = b;
  saveData.totalSteps += n;
  const every = Math.max(1, RULES.steps.encounterEverySE);
  saveData.meter += gi;
  let sp = 0;
  while (saveData.meter >= every) {
    saveData.meter -= every;
    if (saveData.queue.length < RULES.steps.maxEncounters) {
      spawn();
      sp++;
    }
  }
  const bud = findBilly(saveData.buddy),
    per = Math.max(1, RULES.progression.buddyStepsPerXp);
  if (bud) bud.bsteps = (bud.bsteps || 0) + n;
  /* v37: the rest of the party walks too, at half weight (for the Build path of a split evolution) */ for (const m of saveData.team)
    if (m !== bud) m.psteps = (m.psteps || 0) + n;
  saveData.buddyRem += n;
  const xp = Math.floor(saveData.buddyRem / per);
  saveData.buddyRem -= xp * per;
  const notes = [];
  if (bud && xp > 0) gainXp(bud, xp, t => notes.push(t));
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
  /* phase 06-2: the money earned rises from the money chip (ui.js pbFloat), so the toast leaves it out */
  if (!quiet || sp) toast(`+${formatNumber(n)} steps${sp ? `, ${plural(sp, 'new encounter')}` : ''}`);
  notes.forEach(t => toast(t));
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
