// @ts-check
'use strict';
/* ================= BATTLE ENGINE =================
   Every number comes from RULES.battle / RULES.catching (data/gamedata.js); type abilities come from each type's passive.
   v33: a side fields one, two or three fighters at once. Each fighter on the field is an actor, numbered so a classic
   one-on-one battle is still 0 (yours) against 1 (theirs): 0 = your first, 1 = their first, 2 = your second, 3 = their
   second, 4 = your third. Doubles (some trainers) are 0+2 against 1+3; an Alpha is fought by 0, 2 and 4 against 1. */
/* Phase 04e: the battle engine, moved here from battle.js, which keeps the battle screen (BATTLE UI). Logic only
   (game/js/logic/, see rules.js): a turn writes what happens into activeBattle.events; battle.js plays them
   (playTurnEvents) and opens the screen (openBattle), reached through hooks.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  activeBattle,
  battleWeatherMultiplier,
  openBattle,
  playTurnEvents,
  provide,
  runBattleStart,
  save,
  saveData,
  setActiveBattle,
  toast,
  uiState,
} from '../hooks.js';
import { clamp, random } from '../util.js';
import {
  BATTLE_STAGES,
  BOSSES,
  EVENTS,
  FACTIONS,
  ITEMS,
  MODIFIERS,
  MOVES,
  PASSIVE,
  PERKS,
  PYRAMIDS,
  RESIDENTS,
  RULES,
  SPECIES,
  STATUS_NAMES,
  STAT_NAMES,
  TRAINERS,
  hasPassive,
  passiveName,
  trainerTeam,
  typeEffectiveness,
} from '../game-data.js';
import { graftLook, graftOf, graftSet } from './graft-art.js';
import {
  ROBOT_SLOT_NAMES,
  fitFromIds,
  isRobot,
  isRobotSp,
  robotGemDef,
  robotIdsFromSp,
  robotRules,
  speciesOf,
} from './fighters.js';
import {
  addBilly,
  billyName,
  billyTypes,
  brokenParts,
  coatPrefix,
  encounterBuild,
  feedLevels,
  findBilly,
  formatNumber,
  gainXp,
  hereLocation,
  limbKeys,
  makeBilly,
  makeRobot,
  maxHp,
  moveSourceLimbs,
  moveUsable,
  movesOf,
  newUid,
  partBroken,
  partHpLeft,
  partMaxHp,
  partsDamaged,
  pickWeighted,
  plural,
  repairParts,
  spliceWords,
  stat,
  unstableTidy,
  xpFor,
} from './rules.js';
import { factionBotOf } from './factions.js';
import {
  fxAt,
  fxBenchXp,
  fxCatch,
  fxCatchLevel,
  fxChip,
  fxCrit,
  fxDamage,
  fxDamageBy,
  fxFire,
  fxImmune,
  fxInflictPick,
  fxLive,
  fxOfBillie,
  fxPassive,
  fxPeek,
  fxPinchHeal,
  fxSources,
  fxSpend,
  fxSplice,
  fxStages,
  fxStateful,
  fxTurnHeal,
  fxTurnHurt,
  fxWeather,
  fxXp,
} from './effects.js';
import { makeBattle, newFieldState } from './battle-state.js';
/* eslint-disable no-func-assign */
expose({
  ACTOR_SIDE: [() => ACTOR_SIDE],
  ACTOR_SLOT: [() => ACTOR_SLOT],
  BATTLE_RULES: [() => BATTLE_RULES],
  CATCH_RULES: [() => CATCH_RULES],
  PAGE_HOST: [() => PAGE_HOST],
  SIDE_ACTORS: [() => SIDE_ACTORS],
  SILENT_HOST: [() => SILENT_HOST],
  actorIndex: [() => actorIndex],
  // @ts-expect-error -- replaced on purpose
  actorSnapshot: [() => actorSnapshot, v => (actorSnapshot = v)],
  actorTypes: [() => actorTypes],
  // @ts-expect-error -- replaced on purpose
  aiAimPart: [() => aiAimPart, v => (aiAimPart = v)],
  // @ts-expect-error -- replaced on purpose
  aiDamage: [() => aiDamage, v => (aiDamage = v)],
  // @ts-expect-error -- replaced on purpose
  aiScore: [() => aiScore, v => (aiScore = v)],
  allActors: [() => allActors],
  allSnapshots: [() => allSnapshots],
  // @ts-expect-error -- replaced on purpose
  alphaPhase: [() => alphaPhase, v => (alphaPhase = v)],
  // @ts-expect-error -- replaced on purpose
  applyItem: [() => applyItem, v => (applyItem = v)],
  // @ts-expect-error -- replaced on purpose
  applyStatStages: [() => applyStatStages, v => (applyStatStages = v)],
  // @ts-expect-error -- replaced on purpose
  award: [() => award, v => (award = v)],
  battleBag: [() => battleBag],
  battleBuddy: [() => battleBuddy],
  battleHere: [() => battleHere, v => (battleHere = v)],
  battleHost: [() => battleHost],
  battleNow: [() => battleNow],
  battleOnSave: [() => battleOnSave],
  battleRoll: [() => battleRoll],
  // @ts-expect-error -- replaced on purpose
  battleSay: [() => battleSay, v => (battleSay = v)],
  battleSeen: [() => battleSeen],
  // @ts-expect-error -- replaced on purpose
  battleStageKey: [() => battleStageKey, v => (battleStageKey = v)],
  // @ts-expect-error -- replaced on purpose
  bedrockHolds: [() => bedrockHolds, v => (bedrockHolds = v)],
  // @ts-expect-error -- replaced on purpose
  benchCandidates: [() => benchCandidates, v => (benchCandidates = v)],
  // @ts-expect-error -- replaced on purpose
  bossAlpha: [() => bossAlpha, v => (bossAlpha = v)],
  // @ts-expect-error -- replaced on purpose
  bossPhase: [() => bossPhase, v => (bossPhase = v)],
  // @ts-expect-error -- replaced on purpose
  calcDamage: [() => calcDamage, v => (calcDamage = v)],
  canUse: [() => canUse],
  // @ts-expect-error -- replaced on purpose
  catchKeep: [() => catchKeep, v => (catchKeep = v)],
  // @ts-expect-error -- replaced on purpose
  catchOdds: [() => catchOdds, v => (catchOdds = v)],
  // @ts-expect-error -- replaced on purpose
  catchRoll: [() => catchRoll, v => (catchRoll = v)],
  catchable: [() => catchable],
  // @ts-expect-error -- replaced on purpose
  checkFaints: [() => checkFaints, v => (checkFaints = v)],
  // @ts-expect-error -- replaced on purpose
  chooseAI: [() => chooseAI, v => (chooseAI = v)],
  // @ts-expect-error -- replaced on purpose
  doSwitch: [() => doSwitch, v => (doSwitch = v)],
  // @ts-expect-error -- replaced on purpose
  effectiveStat: [() => effectiveStat, v => (effectiveStat = v)],
  // @ts-expect-error -- replaced on purpose
  endTurn: [() => endTurn, v => (endTurn = v)],
  // @ts-expect-error -- replaced on purpose
  enemyOnly: [() => enemyOnly, v => (enemyOnly = v)],
  // @ts-expect-error -- replaced on purpose
  fieldEffects: [() => fieldEffects, v => (fieldEffects = v)],
  fieldSlot: [() => fieldSlot],
  fieldState: [() => fieldState],
  fighter: [() => fighter],
  foeSide: [() => foeSide],
  // @ts-expect-error -- replaced on purpose
  fxBattleCtx: [() => fxBattleCtx, v => (fxBattleCtx = v)],
  // @ts-expect-error -- replaced on purpose
  fxBattleRows: [() => fxBattleRows, v => (fxBattleRows = v)],
  // @ts-expect-error -- replaced on purpose
  fxBattleStart: [() => fxBattleStart, v => (fxBattleStart = v)],
  // @ts-expect-error -- replaced on purpose
  fxBattleState: [() => fxBattleState, v => (fxBattleState = v)],
  // @ts-expect-error -- replaced on purpose
  fxCatchLevelUp: [() => fxCatchLevelUp, v => (fxCatchLevelUp = v)],
  // @ts-expect-error -- replaced on purpose
  fxFieldStages: [() => fxFieldStages, v => (fxFieldStages = v)],
  // @ts-expect-error -- replaced on purpose
  fxFirstActs: [() => fxFirstActs, v => (fxFirstActs = v)],
  // @ts-expect-error -- replaced on purpose
  fxFoeTags: [() => fxFoeTags, v => (fxFoeTags = v)],
  // @ts-expect-error -- replaced on purpose
  fxHitMoments: [() => fxHitMoments, v => (fxHitMoments = v)],
  // @ts-expect-error -- replaced on purpose
  fxHitMult: [() => fxHitMult, v => (fxHitMult = v)],
  // @ts-expect-error -- replaced on purpose
  fxHitRows: [() => fxHitRows, v => (fxHitRows = v)],
  // @ts-expect-error -- replaced on purpose
  fxImmuneSay: [() => fxImmuneSay, v => (fxImmuneSay = v)],
  // @ts-expect-error -- replaced on purpose
  fxImmuneTo: [() => fxImmuneTo, v => (fxImmuneTo = v)],
  // @ts-expect-error -- replaced on purpose
  fxInflict: [() => fxInflict, v => (fxInflict = v)],
  // @ts-expect-error -- replaced on purpose
  fxMoment: [() => fxMoment, v => (fxMoment = v)],
  fxNames: [() => fxNames],
  // @ts-expect-error -- replaced on purpose
  fxPassiveOf: [() => fxPassiveOf, v => (fxPassiveOf = v)],
  // @ts-expect-error -- replaced on purpose
  fxRevive: [() => fxRevive, v => (fxRevive = v)],
  // @ts-expect-error -- replaced on purpose
  fxSrcName: [() => fxSrcName, v => (fxSrcName = v)],
  // @ts-expect-error -- replaced on purpose
  fxStageLines: [() => fxStageLines, v => (fxStageLines = v)],
  // @ts-expect-error -- replaced on purpose
  fxTurnEnd: [() => fxTurnEnd, v => (fxTurnEnd = v)],
  // @ts-expect-error -- replaced on purpose
  fxWeatherFor: [() => fxWeatherFor, v => (fxWeatherFor = v)],
  // @ts-expect-error -- replaced on purpose
  heldStages: [() => heldStages, v => (heldStages = v)],
  heldXp: [() => heldXp],
  // @ts-expect-error -- replaced on purpose
  hitPart: [() => hitPart, v => (hitPart = v)],
  // @ts-expect-error -- replaced on purpose
  inflict: [() => inflict, v => (inflict = v)],
  // @ts-expect-error -- replaced on purpose
  inherit: [() => inherit, v => (inherit = v)],
  isMulti: [() => isMulti],
  joinNames: [() => joinNames],
  liveActors: [() => liveActors],
  // @ts-expect-error -- replaced on purpose
  makeAlpha: [() => makeAlpha, v => (makeAlpha = v)],
  // @ts-expect-error -- replaced on purpose
  makeBossRobot: [() => makeBossRobot, v => (makeBossRobot = v)],
  // @ts-expect-error -- replaced on purpose
  movePower: [() => movePower, v => (movePower = v)],
  newBattle: [() => newBattle, v => setNewBattle(v)],
  perkNamesFor: [() => perkNamesFor],
  // @ts-expect-error -- replaced on purpose
  refreshLastSnapshot: [() => refreshLastSnapshot, v => (refreshLastSnapshot = v)],
  // @ts-expect-error -- replaced on purpose
  retarget: [() => retarget, v => (retarget = v)],
  // @ts-expect-error -- replaced on purpose
  runTurn: [() => runTurn, v => (runTurn = v)],
  // @ts-expect-error -- replaced on purpose
  sayBattleFx: [() => sayBattleFx, v => (sayBattleFx = v)],
  shockName: [() => shockName],
  stageFactor: [() => stageFactor],
  // @ts-expect-error -- replaced on purpose
  startTrainer: [() => startTrainer, v => (startTrainer = v)],
  // @ts-expect-error -- replaced on purpose
  startWild: [() => startWild, v => (startWild = v)],
  // @ts-expect-error -- replaced on purpose
  startWildBot: [() => startWildBot, v => (startWildBot = v)],
  teamNeedsHp: [() => teamNeedsHp],
  // @ts-expect-error -- replaced on purpose
  turnCapCheck: [() => turnCapCheck, v => (turnCapCheck = v)],
  // @ts-expect-error -- replaced on purpose
  useMove: [() => useMove, v => (useMove = v)],
  // @ts-expect-error -- replaced on purpose
  withBattle: [() => withBattle, v => (withBattle = v)],
});
/* eslint-enable no-func-assign */
export function setNewBattle(v) {
  // @ts-expect-error -- replaced on purpose
  newBattle = v; // eslint-disable-line no-func-assign
  provide({ newBattle });
}
/* to-module: end */
/* RL-4: the battle the engine plays. An entry point given a battle (its last argument) plays that one for the
   call (withBattle), so a fight can run beside the page's; otherwise the page's current battle (activeBattle). */
export let battleHere = null;
export const battleNow = () => battleHere || activeBattle;
export function withBattle(b, f) {
  if (!b || b === battleHere) return f();
  const was = battleHere;
  battleHere = b;
  try {
    return f();
  } finally {
    battleHere = was;
  }
}
/* RL-4: what the engine asks of the page, through the battle's host: a toast, a save, opening the battle screen,
   playing a turn's events, the debug menu's sure catch, the weather's boost to a move type. A battle without a host
   (b.host) uses the page's; SILENT_HOST shows, saves and plays nothing and has no weather, for a fight in a test, a
   simulation or a ghost. */
export const PAGE_HOST = {
  toast: t => toast(t),
  save: () => save(),
  open: () => openBattle(),
  play: () => playTurnEvents(),
  sureCatch: () => !!uiState.dbgCatch,
  weather: t => (typeof battleWeatherMultiplier === 'function' ? battleWeatherMultiplier(t) : 1),
};
export const SILENT_HOST = Object.freeze({
  toast() {},
  save() {},
  open() {},
  play() {},
  sureCatch: () => false,
  weather: () => 1,
});
export const battleHost = (b = battleNow()) => (b && b.host) || PAGE_HOST;
/* RL-4: a battle on the save's own team (the page's battles: newBattle) marks species seen, spends items and
   gives the buddy its XP in the save, as always. A battle on a copied team (a ghost, a simulation) touches nothing of
   the save: it brings its own seen list (b.seen), bag (b.bag, item id -> count) and buddy uid (b.buddy), or none. */
export const battleOnSave = b => !!b && b.sides[0].team === saveData.team;
export const battleSeen = (b = battleNow()) => (!b || battleOnSave(b) ? saveData.seen : b.seen || (b.seen = {}));
export const battleBag = b => (!b || battleOnSave(b) ? saveData.items : b.bag || (b.bag = {}));
export const battleBuddy = b => (battleOnSave(b) ? saveData.buddy : b.buddy);
/* RL-4: every chance in a battle (crits, damage rolls, sleep, confusion, accuracy, effects, the AI and its weighted
   pick, the limb a hit lands on, speed ties, catch rolls) comes from battleRoll(): the battle's own stream b.rng when
   it has one (makeBattle gives it one from b.seed), else util.js random, as before. The same seed plays the same
   battle, whatever else draws numbers meanwhile. */
export const battleRoll = () => {
  const b = battleNow();
  return b && b.rng ? b.rng() : random();
};
export const BATTLE_RULES = RULES.battle,
  CATCH_RULES = RULES.catching;
export const ACTOR_SIDE = [0, 1, 0, 1, 0],
  ACTOR_SLOT = [0, 0, 1, 1, 2],
  SIDE_ACTORS = [
    [0, 2, 4],
    [1, 3],
  ];
export const actorIndex = (si, sl) => SIDE_ACTORS[si][sl];
export const fieldSlot = k => {
  const sd = battleNow() && battleNow().sides[ACTOR_SIDE[k]];
  return sd ? sd.f[ACTOR_SLOT[k]] : null;
};
export const fighter = k => {
  const f = fieldSlot(k);
  return f && f.on ? battleNow().sides[ACTOR_SIDE[k]].team[f.act] : undefined;
};
provide({ fighter }); /* to-module */
export const fieldState = k => fieldSlot(k).v;
provide({ fieldState }); /* to-module */
/* every actor on the field, the live ones, and those of one side */
export const allActors = () => {
  const o = [];
  if (!battleNow()) return o;
  battleNow().sides.forEach((sd, si) => sd.f.forEach((f, sl) => o.push(actorIndex(si, sl))));
  return o;
};
export const liveActors = si =>
  allActors().filter(k => (si == null || ACTOR_SIDE[k] === si) && fighter(k) && fighter(k).hp > 0);
export const foeSide = k => 1 - ACTOR_SIDE[k];
export const actorTypes = k => fieldState(k).ov || billyTypes(fighter(k));
export const shockName = () => BATTLE_RULES.shockName || `${BATTLE_RULES.shockType} storm`;
export const isMulti = () => !!battleNow() && (battleNow().sides[0].f.length > 1 || battleNow().sides[1].f.length > 1);
/** what a stat's stages multiply it by in battle: +1 is x1.5, -1 is x2/3 (Studio plan T4.1: the Perk preview
 * reads it too) @param {number} s */
export const stageFactor = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
export function effectiveStat(k, s2) {
  const m = fighter(k),
    v = fieldState(k);
  let x = stat(m, s2);
  const s = v.st[s2] || 0;
  x *= stageFactor(s);
  if (s2 === 'lev') {
    if (m.status === 'brn') x *= 0.5;
    if (hasPassive(actorTypes(k), 'kindling')) {
      /* PK-4: a passive row (Bellows) counts a turn in battle `rate` times over, up to the same top */
      const kp = fxPassiveOf(k, 'kindling');
      x *= 1 + BATTLE_RULES.kindlingBoost * Math.min(BATTLE_RULES.kindlingTurns, v.turnsIn * ((kp && kp.rate) || 1));
    }
  }
  if (s2 === 'hus' && m.status === 'par') x *= 0.5;
  /* phase 17: a robot with broken legs is slow */
  if (s2 === 'hus' && partBroken(m, 'legs')) x *= robotRules().legBreakSpeed;
  return Math.max(1, x);
}
export function actorSnapshot(k) {
  const f = fieldSlot(k);
  if (!f || !f.on) return null;
  const m = battleNow().sides[ACTOR_SIDE[k]].team[f.act];
  if (!m) return null;
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return {
    k,
    uid: m.uid,
    sp: m.sp,
    name: billyName(m),
    lvl: m.lvl,
    hp: m.hp,
    max: maxHp(m),
    st: m.status,
    build: m.build,
    coat: m.coat,
    /* SP-1: a grafted Billie's graft code, only when it has one (the snapshot of an ungrafted one is unchanged) */
    ...(graftLook(m) ? { graft: graftLook(m) } : {}),
    alpha: !!(m.boss || m.alpha),
    boss: !!m.boss,
    ty: actorTypes(k).slice(),
    xp: clamp((m.xp - a) / (b - a), 0, 1),
    stg: { ...f.v.st },
    /* UI-16b: its short effects and the turns each has left (the plate's pips), only when it has any */
    ...(fieldEffects(f.v) ? { fx: fieldEffects(f.v) } : {}),
    /* phase 17: a robot's limbs: which are broken (the stage dims them) and how much HP each has left (0 to 1);
       SP-5: a Billie's Augments the same way */
    bot: limbKeys(m).length
      ? {
          brk: brokenParts(m),
          ph: Object.fromEntries(limbKeys(m).map(q => [q, partHpLeft(m, q) / partMaxHp(m, q)])),
        }
      : null,
  };
}
/** UI-16b: a fighter's short effects for its plate (marks.js MARK_EFFECT_NAMES ids) with the turns left: Protect (this
 * turn), the shield, confusion, Soaked and Fork; null when none. A report: nothing reads it back
 * @param {any} v its field state */
export function fieldEffects(v) {
  const o = /** @type {Record<string, number>} */ ({});
  if (v.protect) o.protect = 1;
  if (v.shield > 0) o.shield = v.shield;
  if (v.hyped > 0) o.confused = v.hyped;
  if (v.ov && v.ovT > 0) o[v.ovBy === 'fork' ? 'fork' : 'soaked'] = v.ovT;
  return Object.keys(o).length ? o : null;
}
export const allSnapshots = () => [0, 1, 2, 3, 4].map(k => (fieldSlot(k) ? actorSnapshot(k) : null));
export function battleSay(t, an) {
  const ev = { t, an: an || null, s: allSnapshots(), mk: battleNow().market ? { ...battleNow().market } : null };
  battleNow().events.push(ev);
  return ev;
}
export function refreshLastSnapshot() {
  const e = battleNow().events[battleNow().events.length - 1];
  if (e) {
    e.s = allSnapshots();
    e.mk = battleNow().market ? { ...battleNow().market } : null;
  }
}
export function movePower(k, tk, M) {
  const fx = M.fx || {},
    d = fighter(tk);
  let P = M.p || 0;
  if (fx.vary === 'dyn') P = Math.round(40 + (60 * d.hp) / maxHp(d));
  if (fx.vary === 'short') P = Math.round(40 + 80 * (1 - d.hp / maxHp(d)));
  if (fx.hold) P = Math.min(BATTLE_RULES.holdCap, 40 * 2 ** Math.max(0, fieldState(k).holdN - 1));
  return P;
}
export function calcDamage(k, tk, mid, src) {
  const M = MOVES[mid],
    fx = M.fx || {};
  const P = src ? M.p || 90 : movePower(k, tk, M);
  const phys = M.c === 'H',
    At = src ? src.A : effectiveStat(k, phys ? 'lev' : 'lob'),
    Dt = effectiveStat(tk, phys ? 'law' : 'pr'),
    L = src ? src.lvl : fighter(k).lvl,
    aty = src ? src.ty : actorTypes(k);
  const base = ((0.4 * L + 2) * P * At) / Dt / 50 + 2;
  const stab = M.t !== 'None' && aty.includes(M.t) ? BATTLE_RULES.stab : 1,
    te = typeEffectiveness(M.t, actorTypes(tk));
  /* PK-3: a run's crit rows add stages for yours hitting; a crit row at the move moment makes this move critical (the
     roll is still made, so the battle's stream is the same) */
  const fxc =
    !src && battleNow().fx && ACTOR_SIDE[k] === 0 ? fxCrit(fxAt(battleNow().fx, fxBattleCtx(k), fxBattleState())) : 0;
  /* PK-4: passive rows of yours (Static Socks, Mood Ring, Union Card, Snorkel: fxPassiveOf) */
  const pas = (/** @type {string} */ id) => (!src && hasPassive(aty, id) ? fxPassiveOf(k, id) : null),
    lw = pas('livewire');
  const cs =
    (fx.crit || 0) +
    (hasPassive(aty, 'livewire') ? Math.round(BATTLE_RULES.liveWireCrit * ((lw && lw.mult) || 1)) : 0) +
    fxc;
  const crit =
    !src &&
    (battleRoll() < BATTLE_RULES.critChances[clamp(cs, 0, BATTLE_RULES.critChances.length - 1)] ||
      battleNow().fxCritK === k);
  const wm = pas('wildmind'),
    wild = () =>
      BATTLE_RULES.wildMindRollMin + battleRoll() * (BATTLE_RULES.wildMindRollMax - BATTLE_RULES.wildMindRollMin);
  let roll = hasPassive(aty, 'wildmind') ? wild() : BATTLE_RULES.rollMin + battleRoll() * (1 - BATTLE_RULES.rollMin);
  /* PK-4: Wild Mind rolled `rolls` times, the best kept */
  if (wm && wm.rolls) for (let i = 1; i < wm.rolls; i++) roll = Math.max(roll, wild());
  const mk = battleNow().market && M.t === BATTLE_RULES.shockType ? BATTLE_RULES.oilShockMult : 1;
  let eco = 1;
  if (!src) {
    const syn = aty.filter(t => PASSIVE[t] === 'alloy');
    if (syn.length) {
      const sd = battleNow().sides[ACTOR_SIDE[k]],
        me = fighter(k),
        /* PK-4: a passive row (Union Card) counts every teammate on its feet */
        al = pas('alloy'),
        all = !!(al && al.all);
      eco =
        1 +
        BATTLE_RULES.alloyBoost *
          sd.team.filter(m => m !== me && m.hp > 0 && (all || billyTypes(m).some(t => syn.includes(t)))).length;
    }
  }
  /* RF-3 Undertow (Water): its moves of a type with Undertow hit harder at a third of its HP or less */
  const ut = pas('undertow'),
    low = !src && fighter(k).hp <= maxHp(fighter(k)) * Math.max(BATTLE_RULES.undertowHp, (ut && ut.hp) || 0),
    tow = low && PASSIVE[M.t] === 'undertow' && aty.includes(M.t) ? BATTLE_RULES.undertowMult : 1;
  /* v28: the weather where you stand; PK-4: with the run's weather rows for one of yours (Umbrella, Snow Globe) */
  const wx = src ? battleHost().weather(M.t) : fxWeatherFor(k, M.t);
  /* phase 17: a robot's move of its gem's type hits harder */
  const me = src ? null : fighter(k),
    gem = isRobot(me) ? robotGemDef(me.gem) : null,
    gx = gem && gem.type === M.t ? robotRules().gemAffinity : 1;
  /* RL-12: a run's Perks (logic/effects.js): what yours deal and take; 1 without any. PK-1: the rows whose conditions
     hold for the one of yours hitting (with this hit's: hit, crit) or hit (hurt) */
  const fm = battleNow().fx ? fxHitMult(k, tk, M, { src, crit, te }) : 1;
  /* RL-12c: the attacker's held item (what it deals) and the target's (what it takes); 1 when neither holds one */
  const hk = src ? null : fxOfBillie(fighter(k), ITEMS),
    ht = fxOfBillie(fighter(tk), ITEMS),
    hm =
      (hk ? fxDamage(hk, { cat: M.c, type: M.t, deal: true, take: false }) : 1) *
      (ht ? fxDamage(ht, { cat: M.c, type: M.t, deal: false, take: true }) : 1);
  /* UI-16b: what fired on this hit, for the page's blips (a report only: the damage above is unchanged). Each: the
     source (a Perk's id, held:id, gene:id, unstable, passive:id), the fighter it belongs to, its multiplier or stat */
  const by = [];
  if (battleNow().fx) {
    /* PK-1: the run's rows that counted for this hit (their conditions, the hit's moments), as fm above */
    const R = fxHitRows(k, tk, M, { src, crit, te });
    if (R.deal)
      for (const b of fxDamageBy(R.deal, { cat: M.c, type: M.t, deal: true, take: false })) by.push({ ...b, si: k });
    if (R.take)
      for (const b of fxDamageBy(R.take, { cat: M.c, type: M.t, deal: false, take: true })) by.push({ ...b, si: tk });
  }
  if (hk) for (const b of fxDamageBy(hk, { cat: M.c, type: M.t, deal: true, take: false })) by.push({ ...b, si: k });
  if (ht) for (const b of fxDamageBy(ht, { cat: M.c, type: M.t, deal: false, take: true })) by.push({ ...b, si: tk });
  if (!src && phys && hasPassive(aty, 'kindling') && fieldState(k).turnsIn > 0)
    by.push({ src: 'passive:kindling', si: k, stat: 'lev' });
  if (tow > 1) by.push({ src: 'passive:undertow', si: k, mult: BATTLE_RULES.undertowMult });
  if (eco > 1) by.push({ src: 'passive:alloy', si: k, mult: Math.round(eco * 100) / 100 });
  if (crit && hasPassive(aty, 'livewire')) by.push({ src: 'passive:livewire', si: k });
  /** @type {{ dmg: number, te: number, crit: boolean, by?: any[], shield?: number }} */
  const out = {
    dmg: Math.max(
      1,
      Math.floor(base * stab * te * roll * (crit ? BATTLE_RULES.critMult : 1) * mk * eco * tow * wx * gx * fm * hm)
    ),
    te,
    crit,
  };
  if (by.length) out.by = by;
  return out;
}
/** RF-3 Bedrock (Ground): once a battle, a hit that would knock a fighter out from full HP leaves it at 1 HP (the
 * side's `held` lists the team places that have used it). Lowers r.dmg; true when it held. @param {number} tk
 * @param {{ dmg: number }} r */
export function bedrockHolds(tk, r) {
  const t = fighter(tk),
    sd = battleNow().sides[ACTOR_SIDE[tk]],
    at = fieldSlot(tk).act,
    mx = maxHp(t);
  if (r.dmg < t.hp || mx < 2 || !hasPassive(actorTypes(tk), 'bedrock')) return false;
  /* PK-4: a passive row (Knee Pads) lets it hold `uses` times a battle, from `hp` of its HP up */
  const bp = fxPassiveOf(tk, 'bedrock');
  if (bp && bp.hp != null ? t.hp < mx * bp.hp : t.hp < mx) return false;
  if ((sd.held || (sd.held = [])).filter(q => q === at).length >= ((bp && bp.uses) || 1)) return false;
  sd.held.push(at);
  r.dmg = t.hp - 1;
  return true;
}
export function applyStatStages(k, obj) {
  const v = fieldState(k),
    m = fighter(k);
  for (const s2 in obj) {
    const d = obj[s2],
      o = v.st[s2] || 0;
    v.st[s2] = clamp(o + d, -BATTLE_RULES.stageMax, BATTLE_RULES.stageMax);
    if (v.st[s2] === o) battleSay(`${billyName(m)}’s ${STAT_NAMES[s2]} won’t go any ${d > 0 ? 'higher' : 'lower'}.`);
    else
      battleSay(`${billyName(m)}’s ${STAT_NAMES[s2]} ${d > 0 ? 'rose' : 'fell'}${Math.abs(d) > 1 ? ' sharply' : ''}.`, {
        k: 'stat',
        si: k,
        up: d > 0,
      });
  }
}
export function inflict(tk, st, loud) {
  const t = fighter(tk);
  if (t.status) {
    if (loud) battleSay(`But ${billyName(t)} is already ${(STATUS_NAMES[t.status] || 'affected').toLowerCase()}.`);
    return;
  }
  /* PK-3: a run's immune rows keep the status off yours (Oven Mitts) */
  if (fxImmuneSay(tk, st)) return;
  if (t.boss && st === 'slp' && battleRoll() < (BATTLE_RULES.alphaSleepResist ?? 0.5)) {
    battleSay(`${billyName(t)} shrugged it off. Alphas don’t nod off easily.`);
    return;
  }
  t.status = st;
  if (st === 'slp')
    t.sTurns =
      BATTLE_RULES.subpoenaMin + Math.floor(battleRoll() * (BATTLE_RULES.subpoenaMax - BATTLE_RULES.subpoenaMin + 1));
  battleSay(
    `${billyName(t)} ${st === 'par' ? 'is paralyzed. It may be unable to move' : st === 'slp' ? 'fell asleep' : st === 'brn' ? 'was burned' : 'is ' + (STATUS_NAMES[st] || st)}.`,
    { k: 'status', si: tk, st }
  );
}
/* a move aimed at a fighter who has gone down turns to another fighter on that side */
export function retarget(k, tk) {
  const fs = foeSide(k);
  if (tk != null && fighter(tk) && fighter(tk).hp > 0 && ACTOR_SIDE[tk] === fs) return tk;
  const L = liveActors(fs);
  if (!L.length) return null;
  return L[Math.floor(battleRoll() * L.length)];
}
/* phase 17: part is the robot part an aimed move goes for (the player picks it, or the AI) */
export function useMove(k, mid, tk0, part) {
  const u = fighter(k),
    v = fieldState(k),
    M = MOVES[mid],
    fx = M.fx || {};
  /* phase 17: the part that gives the move broke earlier this turn (or before): the move fails */
  if (!moveUsable(u, mid)) {
    const src = moveSourceLimbs(u, mid)[0];
    battleSay(`${billyName(u)}’s ${ROBOT_SLOT_NAMES[src] || 'part'} is broken. It can’t use ${M.n}.`, {
      k: 'status',
      si: k,
    });
    return;
  }
  if (u.status === 'slp') {
    u.sTurns--;
    if (u.sTurns > 0) {
      battleSay(`${billyName(u)} is fast asleep.`, { k: 'status', si: k, st: 'slp' });
      return;
    }
    u.status = null;
    battleSay(`${billyName(u)} woke up.`);
  }
  if (u.status === 'par' && battleRoll() < BATTLE_RULES.paralysisSkip) {
    battleSay(`${billyName(u)} is paralyzed and can’t move.`, { k: 'status', si: k, st: 'par' });
    return;
  }
  if (v.hyped > 0) {
    v.hyped--;
    if (battleRoll() < BATTLE_RULES.hypeSelfHit) {
      const dm = Math.max(
        1,
        Math.floor(((0.4 * u.lvl + 2) * 40 * effectiveStat(k, 'lev')) / effectiveStat(k, 'law') / 50 + 2)
      );
      u.hp = Math.max(0, u.hp - dm);
      battleSay(`${billyName(u)} is confused and hurt itself.`, { k: 'hurt', si: k, dmg: dm });
      return;
    }
    if (v.hyped === 0) battleSay(`${billyName(u)} snapped out of its confusion.`);
  }
  const onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe || fx.copyTypes;
  const tk = onFoe ? retarget(k, tk0) : k;
  if (onFoe && tk == null) return;
  const t = fighter(tk),
    td = battleNow().sides[ACTOR_SIDE[tk]];
  /* spread moves hit every fighter on the other side (a little weaker when there's more than one) */
  const spread = onFoe && fx.spread && liveActors(foeSide(k)).length > 1;
  const ev = battleSay(`${billyName(u)} used ${M.n}${isMulti() && onFoe && !spread ? ` on ${billyName(t)}` : ''}.`, {
    k: 'move',
    si: k,
    ti: tk,
    mid,
    spread: spread || undefined,
  });
  /* PK-1: one of yours makes a move: the run's rows of that moment (PK-3: a crit row there makes it critical) */
  if (ACTOR_SIDE[k] === 0 && battleNow().fx) {
    delete battleNow().fxCritK;
    fxMoment('move', k, { cat: M.c });
  }
  v.holdN = fx.hold ? (v.last === mid ? v.holdN + 1 : 1) : 0;
  if (fx.protect) {
    if (v.last === mid) {
      v.last = null;
      ev.an = null;
      battleSay('But it failed. You can’t guard twice in a row.');
      return;
    }
    v.last = mid;
    v.protect = true;
    ev.an.protect = true;
    battleSay(`${billyName(u)} braced itself.`);
    return;
  }
  v.last = mid;
  if (!onFoe) ev.an.self = true;
  const targets = spread ? liveActors(foeSide(k)) : [tk];
  for (const tk2 of targets) {
    const t2 = fighter(tk2),
      fv2 = fieldState(tk2);
    if (!t2 || t2.hp <= 0) continue;
    if (onFoe && fv2.protect) {
      if (tk2 === tk) ev.an.blocked = true;
      battleSay(`${billyName(t2)} protected itself.`, tk2 === tk ? null : { k: 'hurt', si: tk2, dmg: 0, fx: 'block' });
      continue;
    }
    if (onFoe && M.a && battleRoll() * 100 >= M.a) {
      if (tk2 === tk) ev.an.miss = true;
      battleSay(`${billyName(u)} missed${spread ? ' ' + billyName(t2) : ''}.`);
      if (fx.missCost && tk2 === targets[0]) {
        const dm = Math.floor(maxHp(u) * fx.missCost);
        u.hp = Math.max(0, u.hp - dm);
        battleSay(`${billyName(u)} crashed and lost ${Math.round(fx.missCost * 100)}% of its HP.`, {
          k: 'hurt',
          si: k,
          dmg: dm,
        });
      }
      continue;
    }
    if (fx.delay) {
      ev.an.self = true;
      battleNow().sides[ACTOR_SIDE[tk2]].mail.push({
        n: BATTLE_RULES.mailTurns,
        A: effectiveStat(k, 'lev'),
        lvl: u.lvl,
        ty: actorTypes(k).slice(),
        from: billyName(u),
        mid,
        side: ACTOR_SIDE[k],
      });
      battleSay(`${billyName(u)} foresaw an attack. It lands in ${plural(BATTLE_RULES.mailTurns, 'turn')}.`);
      continue;
    }
    if (M.c !== 'X') {
      const r = calcDamage(k, tk2, mid);
      if (spread) r.dmg = Math.max(1, Math.floor(r.dmg * (BATTLE_RULES.spreadMult ?? 0.75)));
      if (fv2.shield > 0) {
        r.dmg = Math.max(1, Math.floor(r.dmg * (BATTLE_RULES.alphaShieldMult ?? 0.5)));
        r.shield = 1;
      }
      const held = bedrockHolds(tk2, r);
      t2.hp = Math.max(0, t2.hp - r.dmg);
      alphaPhase(tk2);
      /* phase 17: a hit on a robot also lands on one of its parts (an aimed move on the one picked); SP-5: and on a
         Billie's Augments */
      const hit = limbKeys(t2).length && t2.hp > 0 ? hitPart(tk2, r.dmg, M, tk2 === tk ? part : null) : null;
      if (tk2 === tk) {
        Object.assign(ev.an, { dmg: r.dmg, te: r.te, crit: r.crit, part: hit || undefined });
        if (r.by) ev.by = r.by;
      } else {
        const e2 = battleSay(`${billyName(t2)} was hit too.`, {
          k: 'hurt',
          si: tk2,
          dmg: r.dmg,
          te: r.te,
          fx: 'spread',
          t: M.t,
        });
        if (r.by) e2.by = r.by;
      }
      refreshLastSnapshot();
      if (hit && hit !== 'torso' && partBroken(t2, hit))
        battleSay(`${billyName(t2)}’s ${ROBOT_SLOT_NAMES[hit]} broke!`, { k: 'break', si: tk2, part: hit });
      if (r.shield) battleSay(`The shield took the edge off.`, { k: 'block', si: tk2 });
      if (r.crit) battleSay('A critical hit!', { k: 'crit', si: tk2 });
      if (r.te > 1) battleSay('It’s super effective!');
      else if (r.te < 1) battleSay('It’s not very effective.');
      if (held)
        battleSay(`${billyName(t2)} held on with ${passiveName(actorTypes(tk2), 'bedrock')}!`, {
          k: 'block',
          si: tk2,
        }).by = [{ src: 'passive:bedrock', si: tk2 }];
      if (fx.drain && u.hp < maxHp(u)) {
        const g = Math.max(1, Math.floor(r.dmg * fx.drain));
        u.hp = Math.min(maxHp(u), u.hp + g);
        battleSay(`${billyName(u)} drained some HP.`, { k: 'heal', si: k, amt: g });
      }
      if (fx.heal && u.hp < maxHp(u)) {
        const g = Math.floor(maxHp(u) * fx.heal);
        u.hp = Math.min(maxHp(u), u.hp + g);
        battleSay(`${billyName(u)} restored some HP.`, { k: 'heal', si: k, amt: g });
      }
      /* PK-1: the hit's moments for the run's rows: hit, crit and ko for yours hitting, hurt for yours hit */
      if (battleNow().fx) fxHitMoments(k, tk2, M, r);
    }
    if (t2.hp > 0 && onFoe) {
      if (fx.status && (M.c === 'X' || battleRoll() * 100 < (fx.chance || 100))) inflict(tk2, fx.status, M.c === 'X');
      if (fx.tgtStage) applyStatStages(tk2, fx.tgtStage);
      if (fx.hype) {
        if (fv2.hyped > 0) battleSay('But it failed.');
        else {
          fv2.hyped = BATTLE_RULES.hypeTurns;
          battleSay(`${billyName(t2)} became confused.`, { k: 'hype', si: tk2 });
        }
      }
      if (fx.spin) {
        fv2.ov = [BATTLE_RULES.spinType];
        fv2.ovT = BATTLE_RULES.spinTurns;
        delete fv2.ovBy;
        battleSay(`${billyName(t2)} was soaked and became ${BATTLE_RULES.spinType} type.`, {
          k: 'stat',
          si: tk2,
          up: false,
        });
      }
      /* RO-3f: Fork (the Satoshi line's move) takes the target's types onto the user for forkTurns turns; it fails
       * when the target has no type to take or the user already has those types */
      if (fx.copyTypes) {
        const mine = actorTypes(k),
          theirs = actorTypes(tk2).filter(ty => ty !== 'None');
        if (!theirs.length || (theirs.length === mine.length && theirs.every(ty => mine.includes(ty))))
          battleSay('But it failed.');
        else {
          v.ov = theirs.slice();
          v.ovT = BATTLE_RULES.forkTurns;
          v.ovBy = 'fork';
          battleSay(`${billyName(u)} forked ${billyName(t2)} and became ${theirs.join('/')} type.`, {
            k: 'stat',
            si: k,
            up: true,
          });
        }
      }
      if (fx.wipe) {
        let any = false;
        for (const s2 in fv2.st)
          if (fv2.st[s2] > 0) {
            fv2.st[s2] = 0;
            any = true;
          }
        battleSay(any ? `${billyName(t2)}’s stat boosts were wiped away.` : `${billyName(t2)} had no boosts to wipe.`);
      }
    }
  }
  if (fx.delay || (!spread && ev.an && (ev.an.miss || ev.an.blocked))) return;
  if (fx.selfStage && (!fx.selfChance || battleRoll() * 100 < fx.selfChance)) applyStatStages(k, fx.selfStage);
  if (
    fx.selfStatus &&
    u.hp > 0 &&
    !u.status &&
    battleRoll() * 100 < (fx.selfChance || 100) &&
    !fxImmuneSay(k, fx.selfStatus)
  ) {
    u.status = fx.selfStatus;
    battleSay(`${billyName(u)} hurt itself and is now ${(STATUS_NAMES[fx.selfStatus] || 'troubled').toLowerCase()}.`, {
      k: 'status',
      si: k,
      st: fx.selfStatus,
    });
  }
  /* phase 17: a robot patches its parts up */
  if (fx.repair && isRobot(u) && repairParts(u, fx.repair))
    battleSay(`${billyName(u)} patched up its parts.`, { k: 'heal', si: k, amt: 0 });
  if (M.c === 'X' && fx.heal) {
    if (u.hp >= maxHp(u)) battleSay('But its HP is already full.');
    else {
      const g = Math.min(maxHp(u) - u.hp, Math.floor(maxHp(u) * fx.heal));
      u.hp += g;
      battleSay(`${billyName(u)} restored its health.`, { k: 'heal', si: k, amt: g });
    }
  }
  if (fx.stones) {
    if (td.stones) {
      if (M.c === 'X') battleSay('Sharp stones are already scattered there.');
    } else {
      td.stones = true;
      battleSay(`Sharp stones are scattered around ${ACTOR_SIDE[k] === 0 ? 'their' : 'your'} side.`);
    }
  }
  if (fx.market) {
    battleNow().market = { k: 'sand', n: BATTLE_RULES.shockTurns };
    battleSay(`A ${shockName().toLowerCase()} kicked up.`, { k: 'market' });
  }
}
export function endTurn() {
  const fr = Math.max(2, BATTLE_RULES.drainFraction);
  for (const k of allActors()) {
    const f = fieldSlot(k),
      m = fighter(k);
    if (!m || m.hp <= 0) continue;
    const ty = actorTypes(k),
      mx = maxHp(m);
    if (f.v && f.v.shield > 0) {
      f.v.shield--;
      if (!f.v.shield) battleSay(`${billyName(m)}’s shield fades.`, { k: 'stat', si: k, up: false });
    }
    if (m.status === 'brn') {
      /* PK-3: a run's chip rows soften a burn on yours (Hazmat Suit) */
      const ch =
          ACTOR_SIDE[k] === 0 && battleNow().fx
            ? fxChip(fxAt(battleNow().fx, fxBattleCtx(k), fxBattleState()), 'burn')
            : 1,
        d = Math.max(1, Math.floor(ch === 1 ? mx / fr : (mx / fr) * ch));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} is hurt by its burn.`, { k: 'hurt', si: k, fx: 'brn', dmg: d });
    }
    if (m.hp > 0 && battleNow().market && !ty.includes(BATTLE_RULES.shockType) && !fxImmuneTo(k, 'sandstorm').length) {
      const d = Math.max(1, Math.floor(mx / fr));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} is buffeted by the ${shockName().toLowerCase()}.`, {
        k: 'hurt',
        si: k,
        fx: 'oil',
        dmg: d,
      });
    }
    if (m.hp > 0 && hasPassive(ty, 'regrowth') && m.hp < mx) {
      /* PK-4: a passive row (Watering Can) heals `mult` times as much */
      const rg = fxPassiveOf(k, 'regrowth'),
        g = Math.min(mx - m.hp, Math.max(1, Math.floor(rg && rg.mult ? (mx * rg.mult) / fr : mx / fr)));
      m.hp += g;
      battleSay(`${billyName(m)}’s ${passiveName(ty, 'regrowth')} restored a little HP.`, {
        k: 'heal',
        si: k,
        amt: g,
      }).by = [{ src: 'passive:regrowth', si: k }];
    }
    /* RL-12c: a held item's heals: a share at each turn's end, and once a battle a share when low */
    const hx = m.hp > 0 && fxOfBillie(m, ITEMS);
    if (hx) {
      const name = (ITEMS[m.held || ''] || { n: 'item' }).n,
        each = fxTurnHeal(hx);
      if (each > 0 && m.hp < mx) {
        const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx * each)));
        m.hp += g;
        battleSay(`${billyName(m)}’s ${name} restored a little HP.`, { k: 'heal', si: k, amt: g }).by = fxSources(
          hx,
          'turnHeal'
        ).map(src => ({ src, si: k }));
      }
      const pinch = fxPinchHeal(hx),
        sd = battleNow().sides[ACTOR_SIDE[k]],
        ate = sd.ate || [];
      if (pinch && m.hp <= mx * pinch.at && !ate.includes(f.act)) {
        const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx * pinch.share)));
        sd.ate = [...ate, f.act];
        m.hp += g;
        battleSay(`${billyName(m)} ate its ${name} and restored HP.`, { k: 'heal', si: k, amt: g }).by = fxSources(
          hx,
          'pinchHeal'
        ).map(src => ({ src, si: k }));
      }
      /* SP-2: an Unstable splice's drawback: a share of its HP at each turn's end (SP-6: on your side, times the run's
         unstable rows, Perks) */
      const hurt =
        fxTurnHurt(hx) *
        (ACTOR_SIDE[k] === 0 && battleNow().fx
          ? fxSplice(fxAt(battleNow().fx, fxBattleCtx(k), fxBattleState()), 'unstable')
          : 1);
      if (hurt > 0 && m.hp > 0) {
        const d = Math.min(m.hp, Math.max(1, Math.floor(mx * hurt)));
        m.hp -= d;
        battleSay(`${billyName(m)}’s unstable cells hurt it.`, { k: 'hurt', si: k, dmg: d }).by = fxSources(
          hx,
          'turnHurt'
        ).map(src => ({ src, si: k }));
      }
    }
    /* PK-1: the run's turnHeal, pinchHeal and turnHurt rows, for each of yours on the field */
    if (m.hp > 0 && ACTOR_SIDE[k] === 0 && battleNow().fx) fxTurnEnd(k);
    f.v.turnsIn++;
    f.v.protect = false;
    if (f.v.ovT > 0 && --f.v.ovT === 0) {
      f.v.ov = null;
      if (f.v.ovBy === 'fork') battleSay(`${billyName(m)}’s fork ran out. It is back to its own type.`);
      else battleSay(`${billyName(m)} dried off and is back to its own type.`);
      delete f.v.ovBy;
    }
  }
  /* PK-1: the turn's end: the run's rows of that moment, for yours on the field */
  fxMoment('turnEnd', null);
  for (const si of [0, 1]) {
    const sd = battleNow().sides[si];
    sd.mail = sd.mail.filter(h => {
      if (--h.n > 0) return true;
      const L = liveActors(si),
        tk = L[0];
      const t = tk != null ? fighter(tk) : null;
      if (t && t.hp > 0) {
        const r = calcDamage(actorIndex(1 - si, 0), tk, h.mid || 'twoday', h),
          held = bedrockHolds(tk, r);
        t.hp = Math.max(0, t.hp - r.dmg);
        const e3 = battleSay(
          `${h.from}’s ${(MOVES[h.mid] || MOVES.twoday || { n: 'attack' }).n} struck ${billyName(t)}.`,
          {
            k: 'hurt',
            si: tk,
            fx: 'mail',
            te: r.te,
            dmg: r.dmg,
          }
        );
        if (r.by) e3.by = r.by;
        if (r.te > 1) battleSay('It’s super effective!');
        else if (r.te < 1) battleSay('It’s not very effective.');
        if (held)
          battleSay(`${billyName(t)} held on with ${passiveName(actorTypes(tk), 'bedrock')}!`, {
            k: 'block',
            si: tk,
          }).by = [{ src: 'passive:bedrock', si: tk }];
      }
      return false;
    });
  }
  if (battleNow().market && --battleNow().market.n <= 0) {
    battleNow().market = null;
    battleSay(`The ${shockName().toLowerCase()} died down.`, { k: 'marketEnd' });
  }
}
export function award(e) {
  const P = RULES.progression,
    amt = Math.floor(
      ((speciesOf(e).yld * e.lvl) / 7) *
        (battleNow().kind === 'trainer' ? P.trainerXpMult : 1) *
        (e.boss ? (BATTLE_RULES.alphaXp ?? 3) : 1)
    );
  const on = liveActors(0).map(k => fighter(k));
  on.forEach(m => {
    const k = allActors().find(q => fighter(q) === m);
    const got = heldXp(m, amt);
    battleSay(`${billyName(m)} gained ${formatNumber(got)} XP.`, { k: 'xp', si: k });
    gainXp(m, got, battleSay);
  });
  /* phase 08: your buddy gets the full amount even when it didn't fight (it got its XP from walking before) */
  const mine = battleNow().sides[0].team,
    buddy = battleBuddy(battleNow());
  const bud = mine.find(m => m.uid === buddy && !on.includes(m) && m.hp > 0);
  if (bud) {
    const got = heldXp(bud, amt);
    battleSay(`${billyName(bud)} gained ${formatNumber(got)} XP.`);
    gainXp(bud, got, battleSay);
  }
  /* PK-4: the run's benchXp rows (Group Chat) add to the share, at most all of it */
  const share = Math.floor(amt * Math.min(1, P.teamXpShare + fxBenchXp(fxBattleRows(battleNow())))),
    rest = mine.filter(m => !on.includes(m) && m !== bud && m.hp > 0);
  if (rest.length && share > 0) {
    rest.forEach(m => gainXp(m, heldXp(m, share), () => {}));
    battleSay(`The rest of the team gained ${formatNumber(share)} XP.`);
  }
}
/** RL-12c: XP with the Billie's held item's xp rows; RL-S2 part B: and the run's (b.fx: a Perk's, a hub person's level)
 * @param {any} m @param {number} n */
export const heldXp = (m, n) => {
  const run = (battleNow() && fxBattleRows(battleNow())) || [];
  return fxXp([...run, ...(fxOfBillie(m, ITEMS) || [])], n);
};
/** RL-12c: a held item's stat stages for a fighter as it takes the field (the battle's start: battle-state.js) */
export function heldStages(k) {
  const up = fxStages(fxOfBillie(fighter(k), ITEMS)),
    v = fieldState(k);
  for (const s2 in up) v.st[s2] = clamp((v.st[s2] || 0) + up[s2], -BATTLE_RULES.stageMax, BATTLE_RULES.stageMax);
}
/** RF-3 Parting Roar (Dragon, id `inherit`): when it faints, the next teammate in gets +1 Attack and +1 Sp. Atk
 * (before RF-3 it passed on its own boosts, if it had any) */
export function inherit(k) {
  const ty = billyTypes(fighter(k));
  if (!hasPassive(ty, 'partingroar')) return;
  /* PK-4: a passive row (Heirloom Locket) adds its stages too */
  const pr = fxPassiveOf(k, 'partingroar');
  battleNow().sides[ACTOR_SIDE[k]].roar = {
    lev: 1,
    lob: 1,
    ...(pr && pr.up ? { up: pr.up } : {}),
    from: billyName(fighter(k)),
    name: passiveName(ty, 'partingroar'),
  };
}
/* who on a side could still come in: alive, not at work, not on the field and not already called in this turn */
export function benchCandidates(si, also = [], b) {
  return withBattle(b, () => {
    const sd = battleNow().sides[si],
      on = sd.f.filter(f => f.on).map(f => f.act);
    return sd.team
      .map((m, i) => i)
      .filter(i => {
        const m = sd.team[i];
        return m.hp > 0 && !on.includes(i) && !also.includes(i);
      });
  });
}
export function doSwitch(k, idx, b) {
  return withBattle(b, () => {
    const sd = battleNow().sides[ACTOR_SIDE[k]],
      f = fieldSlot(k);
    f.act = idx;
    f.on = true;
    f.down = false;
    const roar = sd.roar;
    f.v = newFieldState();
    sd.roar = null;
    const m = fighter(k);
    battleSay(
      ACTOR_SIDE[k] === 0
        ? `Go, ${billyName(m)}!`
        : `${battleNow().foeName || 'The wild side'} sent out ${billyName(m)}.`,
      {
        k: 'enter',
        si: k,
      }
    );
    if (!isRobot(m)) battleSeen()[m.sp] = 1;
    heldStages(k);
    /* PK-1: the run's Perks' stat stages for one of yours coming in, as for those who started (Running Shoes) */
    if (ACTOR_SIDE[k] === 0) {
      for (const [t, an] of fxStageLines(fxFieldStages(k), [k])) battleSay(t, an);
      fxMoment('switchIn', k);
    }
    if (sd.stones && !hasPassive(billyTypes(m), 'bedrock') && !fxImmuneTo(k, 'stones').length) {
      const d = Math.max(1, Math.floor(maxHp(m) / Math.max(2, BATTLE_RULES.stonesFraction)));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} was hurt by the sharp stones.`, { k: 'hurt', si: k, fx: 'stones', dmg: d });
    }
    if (roar) {
      f.v.st.lev += roar.lev;
      f.v.st.lob += roar.lob;
      for (const s2 of Object.keys(roar.up || {}))
        f.v.st[s2] = clamp((f.v.st[s2] || 0) + roar.up[s2], -BATTLE_RULES.stageMax, BATTLE_RULES.stageMax);
      battleSay(`${roar.from}’s ${roar.name} fired up ${billyName(m)}!`, { k: 'stat', si: k, up: true }).by = [
        { src: 'passive:partingroar', si: k, stat: 'lev' },
      ];
    }
  });
}
export function checkFaints() {
  let any = false;
  for (const k of allActors().filter(k => ACTOR_SIDE[k] === 1)) {
    const e = fighter(k),
      f = fieldSlot(k);
    if (!e || e.hp > 0 || f.down) continue;
    f.down = true;
    any = true;
    e.status = null;
    battleSay(`${billyName(e)} fainted.`, { k: 'faint', si: k });
    award(e);
    inherit(k);
    const nx = benchCandidates(1)[0];
    if (nx == null) f.on = false;
    else if (!battleNow().over) doSwitch(k, nx);
  }
  if (!liveActors(1).length && !battleNow().over) battleNow().over = 'win';
  for (const k of allActors().filter(k => ACTOR_SIDE[k] === 0)) {
    const p = fighter(k),
      f = fieldSlot(k);
    if (!p || p.hp > 0 || f.down) continue;
    f.down = true;
    any = true;
    p.status = null;
    p.sTurns = 0;
    /* TW-3: how many of yours fainted in this battle (a mini-boss quest wants none) */
    battleNow().fainted = (battleNow().fainted || 0) + 1;
    battleSay(`${billyName(p)} fainted.`, { k: 'faint', si: k });
    /* PK-1: one of yours fainted: the run's rows of that moment (and growth that resets on it) */
    fxMoment('faint', null);
    inherit(k);
    const pend = (battleNow().needSwitch || []).length;
    if (benchCandidates(0).length > pend) {
      if (!battleNow().over) (battleNow().needSwitch || (battleNow().needSwitch = [])).push(k);
    } else f.on = false;
  }
  /* PK-3: a run's revive row gets a wiped team back up instead (Warranty Card, once a run) */
  if (!battleNow().over && !liveActors(0).length && !(battleNow().needSwitch || []).length && !fxRevive())
    battleNow().over = 'lose';
  if (any && !battleNow().over && liveActors(1).some(k => fighter(k).hp <= 0)) checkFaints();
  return any;
}
/* how much a move is worth against one target, for the computer's choices */
/* v34: an Alpha has two phases. Brought below half its HP it raises a shield (half damage for a couple of turns),
   its eyes go red and it hits harder from then on (RULES.battle.alphaShield*). RL-14b: a boss with phases of its own
   (m.boss.phases, bosses.json) fires each of them once, in order, as its HP falls to their `at`: a shield, stat
   stages, a limb that tears loose and its line */
export function alphaPhase(k) {
  const m = fighter(k);
  if (!m || !m.boss || m.hp <= 0) return;
  const P = m.boss.phases;
  if (P) {
    while ((m.boss.done || 0) < P.length && m.hp <= maxHp(m) * P[m.boss.done || 0].at)
      bossPhase(k, P[(m.boss.done = (m.boss.done || 0) + 1) - 1]);
    return;
  }
  if (m.boss.ph2 || m.hp > maxHp(m) * (BATTLE_RULES.alphaPhaseAt ?? 0.5)) return;
  m.boss.ph2 = true;
  const v = fieldState(k);
  v.shield = BATTLE_RULES.alphaShieldTurns ?? 2;
  battleSay(`${billyName(m)} is furious! A golden shield rises around it.`, { k: 'alphaPhase', si: k });
  applyStatStages(k, { lev: 1, lob: 1 });
}
/** RL-14b: one of a boss's phases (bosses.json): its line, its shield, its stages, then the limb that tears loose
 * (broken outright: its move is gone and the stage drops it) @param {number} k
 * @param {import('../../types/game-data').BossPhase} ph */
export function bossPhase(k, ph) {
  const m = fighter(k),
    bots = (m.boss && m.boss.bots) || {},
    slot = ph.breaks && limbKeys(m).includes(ph.breaks) && !partBroken(m, ph.breaks) ? ph.breaks : null,
    part = ph.breaks ? bots[ph.breaks] || ROBOT_SLOT_NAMES[ph.breaks] : '';
  if (ph.shield) fieldState(k).shield = ph.shield;
  battleSay((ph.say || '{name} is furious!').replace(/\{name\}/g, billyName(m)).replace(/\{part\}/g, part), {
    k: 'alphaPhase',
    si: k,
    shield: !!ph.shield,
  });
  if (ph.stages) applyStatStages(k, ph.stages);
  if (slot) {
    m.partDmg = m.partDmg || {};
    m.partDmg[slot] = partMaxHp(m, slot);
    refreshLastSnapshot();
    battleSay('', { k: 'break', si: k, part: slot });
  }
}
/* a rough damage figure for the AI (no rolls): how much of the target's HP a move would take */
export function aiDamage(k, id, tk) {
  const M = MOVES[id];
  if (!M || M.c === 'X') return 0;
  const phys = M.c === 'H',
    L = fighter(k).lvl,
    P = M.p || 60;
  return (
    (((0.4 * L + 2) * P * effectiveStat(k, phys ? 'lev' : 'lob')) / effectiveStat(tk, phys ? 'law' : 'pr') / 50 + 2) *
    (M.t !== 'None' && actorTypes(k).includes(M.t) ? BATTLE_RULES.stab : 1) *
    typeEffectiveness(M.t, actorTypes(tk))
  );
}
export function aiScore(k, id, tk) {
  const M = MOVES[id],
    fx = M.fx || {},
    m = fighter(k),
    t = fighter(tk);
  let s = 10;
  if (M.c !== 'X') {
    let P = M.p || 60;
    if (fx.vary === 'dyn') P = 40 + (60 * t.hp) / maxHp(t);
    if (fx.vary === 'short') P = 40 + 80 * (1 - t.hp / maxHp(t));
    if (fx.delay) P = 90;
    if (fx.hold) P = 60;
    if (fx.missCost) P *= 0.8;
    const phys = M.c === 'H';
    s =
      (((P *
        (M.t !== 'None' && actorTypes(k).includes(M.t) ? BATTLE_RULES.stab : 1) *
        typeEffectiveness(M.t, actorTypes(tk)) *
        (M.a || 100)) /
        100) *
        effectiveStat(k, phys ? 'lev' : 'lob')) /
      effectiveStat(tk, phys ? 'law' : 'pr');
    if (t.hp <= s * 0.6) s *= 1.4;
    /* finish off a fighter that's nearly down */ if (fx.spread && liveActors(ACTOR_SIDE[tk]).length > 1) s *= 1.5;
  } else if (fx.status) s = t.status ? 0 : 45;
  else if (fx.hype) s = fieldState(tk).hyped ? 0 : 35;
  else if (fx.heal) s = m.hp < maxHp(m) * 0.5 ? 90 : 0;
  else if (fx.protect) s = fieldState(k).last === id ? 0 : 12;
  else if (fx.stones) s = battleNow().sides[ACTOR_SIDE[tk]].stones ? 0 : 30;
  else if (fx.market) s = battleNow().market ? 0 : 40;
  else if (fx.selfStage) s = Object.keys(fx.selfStage).some(q => fieldState(k).st[q] < 2) ? 28 : 0;
  else if (fx.tgtStage) s = 22;
  else if (fx.spin) s = fieldState(tk).ov ? 0 : 20;
  else if (fx.copyTypes) {
    const mine = actorTypes(k),
      theirs = actorTypes(tk).filter(ty => ty !== 'None');
    s = !theirs.length || (theirs.length === mine.length && theirs.every(ty => mine.includes(ty))) ? 0 : 20;
  } else s = 0;
  return s + 5;
}
export function chooseAI(k = 1, b) {
  return withBattle(b, () => {
    const m = fighter(k);
    if (!m || m.hp <= 0) return null;
    const T = liveActors(foeSide(k));
    if (!T.length) return null;
    const opts = [];
    for (const id of movesOf(m).filter(id => MOVES[id] && moveUsable(m, id)))
      for (const tk of T) opts.push([{ mid: id, tk, part: aiAimPart(id, tk) }, aiScore(k, id, tk)]);
    if (!opts.length) return null;
    /* v34: in a double the second foe knows what its partner is about to do: no piling onto a fighter that's already
    going down, a spread move is worth more while both of yours stand, and a status move isn't doubled up */
    const PL = battleNow().aiPlan || (battleNow().aiPlan = {});
    if (battleNow().fmt === 'double') {
      for (const o of opts) {
        const c = o[0],
          M = MOVES[c.mid],
          t = fighter(c.tk),
          pre = PL[c.tk] || 0;
        if (!t) continue;
        if (M.c !== 'X' && pre >= t.hp) o[1] *= 0.3;
        else if (M.c !== 'X' && pre + aiDamage(k, c.mid, c.tk) >= t.hp) o[1] *= 1.35;
        if (M.c === 'X' && (M.fx || {}).status && PL['st' + c.tk]) o[1] *= 0.2;
      }
    }
    let pick;
    if ((battleNow().kind === 'trainer' || m.boss) && battleRoll() < BATTLE_RULES.aiSmart) {
      opts.sort((a, b) => b[1] - a[1]);
      pick = opts[0][0];
    } else pick = pickWeighted(opts, battleRoll);
    if (pick) {
      const M = MOVES[pick.mid];
      if (M.c !== 'X') {
        const tg = (M.fx || {}).spread ? liveActors(foeSide(k)) : [pick.tk];
        for (const t of tg) PL[t] = (PL[t] || 0) + aiDamage(k, pick.mid, t);
      } else if ((M.fx || {}).status) PL['st' + pick.tk] = 1;
    }
    return pick;
  });
}
/* phase 17: which robot part the computer aims an aimed move at: the weakest limb still standing, so it breaks */
export function aiAimPart(mid, tk) {
  const t = fighter(tk),
    M = MOVES[mid];
  if (!t || !limbKeys(t).length || !(M.fx && M.fx.aim)) return undefined;
  const L = limbKeys(t).filter(q => !partBroken(t, q));
  if (!L.length) return undefined;
  return L.reduce((a, b) => (partHpLeft(t, b) < partHpLeft(t, a) ? b : a));
}
/* phase 17: a hit on a robot lands on one part: the one an aimed move picked if it still stands, else by
   RULES.robots.hitWeights (the torso is the body only). The limb loses the damage (x partShare, x the move's breaker).
   Returns the slot hit. */
export function hitPart(tk, dmg, M, aim) {
  const t = fighter(tk),
    R = robotRules(),
    fx = M.fx || {};
  let slot = aim && fx.aim && limbKeys(t).includes(aim) && !partBroken(t, aim) ? aim : null;
  if (!slot) {
    const W = /** @type {[string, number][]} */ ([['torso', R.hitWeights.torso ?? 0.25]]);
    /* SP-5: a Billie's body is its torso, its Augments its limbs */
    for (const q of limbKeys(t)) if (!partBroken(t, q)) W.push([q, R.hitWeights[q] ?? 0.25]);
    slot = pickWeighted(W, battleRoll);
  }
  if (slot === 'torso') return slot;
  const d = Math.max(1, Math.round(dmg * R.partShare * (fx.breaker || 1)));
  t.partDmg = t.partDmg || {};
  t.partDmg[slot] = (t.partDmg[slot] || 0) + d;
  return slot;
}
/* a battle against foe on the save's team, made the current one (makeBattle, battle-state.js); false when all have fainted */
export function newBattle(kind, foe, extra) {
  /* RL-8: on a run the page gives the battle its seed and weather, and holds the save once it has begun (run.js) */
  const R = typeof runBattleStart === 'function' ? runBattleStart(kind, foe, extra) : null,
    b = makeBattle(kind, saveData.team, foe, R ? R.extra : extra);
  if (!b) {
    battleHost(extra || null).toast('Everyone on your team has fainted. Rest first, or use a Revive.');
    return false;
  }
  setActiveBattle(b);
  /* RL-12, PK-1: the run's Perks' stat stages for yours on the field (said by sayBattleFx once the sides are out) */
  fxBattleStart();
  foe.forEach(m => {
    if (!isRobot(m)) saveData.seen[m.sp] = 1;
  });
  if (R) R.begun(b);
  return true;
}
export const joinNames = K => {
  const n = K.map(k => billyName(fighter(k)));
  return n.length < 2 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
};
/* an Alpha: the same billionaire, bigger, tougher and stronger for the fight (RULES.battle.alpha*) */
export function makeAlpha(sp, lvl, o = {}) {
  const m = makeBilly(sp, lvl + (BATTLE_RULES.alphaLevels ?? 3), o);
  m.boss = { hp: BATTLE_RULES.alphaHp ?? 3, st: BATTLE_RULES.alphaStats ?? 1.3 };
  m.hp = maxHp(m);
  return m;
}
/** RL-14b: a boss that is a robot (bosses.json): its fighter built from new parts at lvl + its own levels, fought as
 * an Alpha with its HP and stats multiplied, its phases and its bots' names; hpMult the Expedition's (as bossAlpha)
 * @param {import('../../types/game-data').BossDef} def @param {number} lvl @param {number} [hpMult] */
export function makeBossRobot(def, lvl, hpMult) {
  const F = def.fighter,
    m = makeRobot(F.gem, fitFromIds(F), Math.max(1, Math.min(100, lvl + (def.boss.levels || 0))), { nick: def.name });
  m.boss = {
    hp: def.boss.hp * (hpMult && hpMult > 0 ? hpMult : 1),
    st: def.boss.st,
    phases: JSON.parse(JSON.stringify(def.phases || [])),
    bots: { ...(def.bots || {}) },
  };
  m.hp = maxHp(m);
  return m;
}
/** RL-13: a run boss's Alpha, its HP times hpMult (the Expedition's, run-loop.js runFoes) when given
 * @param {{ sp: string, lvl: number }} e @param {number} [hpMult] */
export function bossAlpha(e, hpMult) {
  const m = makeAlpha(e.sp, e.lvl);
  if (hpMult && hpMult !== 1 && m.boss) {
    m.boss.hp *= hpMult;
    m.hp = maxHp(m);
  }
  return m;
}
/** a wild Billie's battle. Studio plan T3.2: `o.host` and `o.extra` (a run battle's seed, weather and Perks:
 * logic/run-loop.js runBattleExtra) as for startTrainer, so the run's simulation starts it as the page does */
export function startWild(q, o = {}) {
  /* RL-14: a wild bot (its sp names its gem and parts) is built from new parts and goes by its faction's name */
  if (isRobotSp(q.sp)) {
    startWildBot(q, o);
    return;
  }
  const made = { build: encounterBuild(q), coat: q.coat },
    foe = q.alpha ? makeAlpha(q.sp, q.lvl, made) : makeBilly(q.sp, q.lvl, made);
  /* SP-1: a grafted wild Billie stays grafted in battle; SP-2: with its Unstable roll */
  if (graftOf(q)) {
    graftSet(foe, graftOf(q));
    if (q.unstable) foe.unstable = { ...q.unstable };
    unstableTidy(foe);
  }
  /* SP-5: an Escaped specimen wears its Augment (a part of its own from now on: caught, it keeps it) */
  if (q.aug && typeof q.aug === 'object') {
    foe.aug = Object.fromEntries(
      Object.entries(q.aug).map(([slot, p]) => [slot, { uid: newUid(), id: p.id, up: p.up || 0 }])
    );
    if (q.unstable) foe.unstable = { ...q.unstable };
    unstableTidy(foe);
    foe.hp = maxHp(foe);
  }
  if (
    !newBattle('wild', [foe], {
      qid: q.id,
      area: battleStageKey(),
      fmt: q.alpha ? 'alpha' : 'single',
      ...(o.host && { host: o.host }),
      ...o.extra,
    })
  )
    return;
  const nm = SPECIES[q.sp].name;
  if (q.alpha) {
    battleSay(`An Alpha ${coatPrefix(q.coat)}${nm} rose out of the grass!`, { k: 'wild', alpha: 1 });
    battleSay(`“${nm}!!”`, { k: 'cry', si: 1 });
    battleSay(`It’s huge, and it acts twice a turn. Your team steps up together.`);
  } else {
    battleSay(`A wild ${coatPrefix(q.coat)}${nm} appeared.`, { k: 'wild' });
    battleSay(`“${nm}!”`, { k: 'cry', si: 1 });
  }
  /* SP-3: a spliced wild Billie shows what it wears */
  const parts = spliceWords(foe);
  if (parts.length === 1) battleSay(`This ${nm} has ${parts[0]}!`);
  else if (parts.length)
    battleSay(`This ${nm} is a patchwork: ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}!`);
  /* SP-5: an Escaped specimen */
  if (foe.aug) battleSay('It must have escaped from a Bureau lab.');
  if (CATCH_RULES.luxury.includes(SPECIES[q.sp].line))
    battleSay(`It looks too picky for ${PYRAMIDS.pyramid ? 'a ' + PYRAMIDS.pyramid.n : 'cheap pyramids'}.`);
  const K = liveActors(0);
  K.forEach((k, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}
/** RL-14: a wild bot's battle (startWild), single, never an Alpha; it can't be caught (catchable) @param {any} q
 * @param {any} [o] */
export function startWildBot(q, o = {}) {
  const ids = /** @type {any} */ (robotIdsFromSp(q.sp)),
    foe = makeRobot(ids.gem, fitFromIds(ids), q.lvl),
    who = factionBotOf(FACTIONS, q.sp);
  if (who) foe.nick = who.B.name;
  if (
    !newBattle('wild', [foe], {
      qid: q.id,
      area: battleStageKey(),
      fmt: 'single',
      ...(o.host && { host: o.host }),
      ...o.extra,
    })
  )
    return;
  const nm = billyName(foe),
    F = who && FACTIONS[who.faction];
  battleSay(
    `${F && F.short ? F.short[0].toUpperCase() + F.short.slice(1) + '’s ' : 'A '}${nm} rolled out of the grass!`,
    {
      k: 'wild',
    }
  );
  battleSay(`“Bzzt. Item ${q.no || 0} located.”`, { k: 'cry', si: 1 });
  const K = liveActors(0);
  K.forEach((k, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}
export function startTrainer(id, o = {}) {
  const T = TRAINERS[id];
  if (!T) return;
  /* RL-8: a run's boss is its leader's top Billie alone, as an Alpha (logic/run-loop.js runFoes) */
  /* RL-14b: a bosses.json boss (the Voltron) is a robot built as an Alpha (makeBossRobot) */
  const BD = T.boss ? BOSSES[T.boss] : null,
    team = BD
      ? T.team.slice(0, 1).map(e => makeBossRobot(BD, e.lvl, T.hpMult))
      : T.alpha
        ? T.team.slice(0, 1).map(e => bossAlpha(e, T.hpMult))
        : trainerTeam(T);
  if (!team.length) {
    battleHost(o).toast(`${T.name} has no team yet. Add one in Pocket Billies Studio.`);
    return;
  }
  const dbl = (T.double || o.double) && team.length >= 2 && saveData.team.filter(m => m.hp > 0).length >= 1;
  if (
    !newBattle('trainer', team, {
      tid: id,
      foeName: T.name,
      T,
      /* BATTLE_STAGES[undefined] is undefined: a trainer without a stage gets the place's */
      area: BATTLE_STAGES[/** @type {string} */ (T.battleStage)] ? T.battleStage : battleStageKey(),
      fmt: T.alpha ? 'alpha' : dbl ? 'double' : 'single',
      ...(o.host && { host: o.host }),
      /* Studio plan T3.2: a run battle's seed, weather and Perks given with a host (the run's simulation; the
         page's own run battles get them from run.js runBattleStart) */
      ...o.extra,
    })
  )
    return;
  battleSay(
    BD
      ? (BD.call || '{name} closes in! It acts twice a turn. Your team steps up together.').replace(/\{name\}/g, T.name)
      : T.alpha
        ? `${T.name} sends out an Alpha! It acts twice a turn. Your team steps up together.`
        : dbl
          ? /* RT-2: a route pair is two trainers */
            `${T.name} ${T.mate ? 'want' : 'wants'} a double battle!`
          : `${T.name} wants to battle.`,
    { k: 'trainerIn', who: T.who }
  );
  if (T.market) {
    battleNow().market = { k: 'sand', n: T.market.n || BATTLE_RULES.shockTurns };
    battleSay(T.marketText || `The battle opened in a ${shockName().toLowerCase()}.`, { k: 'market' });
  }
  const F = liveActors(1);
  /* RL-14b: a bosses.json boss comes in as its bots joining together (battle-stage.js 'join') */
  if (BD)
    battleSay((BD.join || '{name} assembles!').replace(/\{name\}/g, T.name), { k: 'join', si: F[0], glow: BD.glow });
  else
    F.forEach((k, n) => battleSay(n ? '' : `${T.name} sent out ${joinNames(F)}.`, { k: 'enter', si: k, quiet: n > 0 }));
  const K = liveActors(0);
  K.forEach((k, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}
/** PK-1: what a row's source is called in battle (fxOfRun's src): a Perk's name, an event's boon by its event's
 * title, the fountain's wish, the Expedition, a challenge's name, a hub person's or a resident's name (else the id)
 * @param {string} src */
export function fxSrcName(src) {
  if (PERKS[src]) return PERKS[src].name;
  const [kind, id = ''] = src.includes(':')
      ? [src.slice(0, src.indexOf(':')), src.slice(src.indexOf(':') + 1)]
      : ['', src],
    cap = (/** @type {string} */ w) => w.charAt(0).toUpperCase() + w.slice(1);
  if (kind === 'event') {
    if (id === 'fountain') return 'The fountain’s wish';
    const E = EVENTS && EVENTS.events && EVENTS.events[id];
    return E && E.title ? E.title : cap(id.replace(/_/g, ' '));
  }
  if (kind === 'rel') return cap(id);
  if (kind === 'res') return (RESIDENTS && RESIDENTS[id] && RESIDENTS[id].name) || cap(id);
  if (src === 'expedition') return 'The Expedition';
  const C = MODIFIERS && MODIFIERS.challenges && MODIFIERS.challenges[src];
  return C && C.name ? C.name : src;
}
/** PK-1: the sources of some rows by name ("A and B") @param {any[]} rows */
export const fxNames = rows => [...new Set(rows.map(f => fxSrcName(f.src)))].join(' and ');
/** PK-1: a turn's end for one of yours on the field: the run's turnHeal rows heal it, its pinchHeal rows heal it once
 * when low (once a battle for each Billie unless the row's `once` says otherwise), its turnHurt rows hurt it
 * @param {number} k */
export function fxTurnEnd(k) {
  const b = battleNow(),
    m = fighter(k),
    mx = maxHp(m),
    ctx = fxBattleCtx(k),
    st = fxBattleState(
      b,
      b.fx.some((/** @type {any} */ f) => f.kind === 'pinchHeal')
    ),
    rows = fxAt(b.fx, ctx, st),
    heal = rows.filter(f => f.kind === 'turnHeal'),
    each = fxTurnHeal(heal);
  if (each > 0 && m.hp < mx) {
    const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx * each)));
    m.hp += g;
    battleSay(`${fxNames(heal)}: ${billyName(m)} restored a little HP.`, { k: 'heal', si: k, amt: g });
  }
  const pinch = rows.find(f => f.kind === 'pinchHeal' && (f.once || fxLive({ ...f, once: 'billie' }, ctx, st)));
  if (pinch && m.hp <= mx * pinch.at) {
    fxSpend(pinch.once ? pinch : { ...pinch, once: 'billie' }, ctx, st);
    const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx * pinch.share)));
    m.hp += g;
    battleSay(`${fxNames([pinch])}: ${billyName(m)} restored HP.`, { k: 'heal', si: k, amt: g });
  }
  const hurt = rows.filter(f => f.kind === 'turnHurt'),
    lose = fxTurnHurt(hurt);
  if (lose > 0 && m.hp > 0) {
    const d = Math.min(m.hp, Math.max(1, Math.floor(mx * lose)));
    m.hp -= d;
    battleSay(`${fxNames(hurt)}: ${billyName(m)} lost a little HP.`, { k: 'hurt', si: k, dmg: d });
  }
}
/** PK-3: the acts of yours a run's first rows put ahead this turn (their conditions held for the one acting), with a
 * line naming the Perks; none without Perks @param {any[]} acts @returns {Set<any>} */
export function fxFirstActs(acts) {
  const b = battleNow(),
    out = new Set();
  if (!b || !b.fx) return out;
  /** @type {any[]} */
  const rows = [],
    K = [];
  for (const a of acts) {
    if (ACTOR_SIDE[a.who] !== 0) continue;
    const R = fxAt(b.fx, fxBattleCtx(a.who), fxBattleState(b)).filter(f => f.kind === 'first');
    if (!R.length) continue;
    out.add(a);
    rows.push(...R);
    if (!K.includes(a.who)) K.push(a.who);
  }
  if (K.length) battleSay(`${fxNames(rows)}: ${joinNames(K)} ${K.length > 1 ? 'move' : 'moves'} first.`, null);
  return out;
}
/** PK-3: your whole team has fainted: the first revive row that may act (its once mark not spent) spends it, and every
 * Billie of yours gets back up with its share of HP, no status, back on the field where it stood (as if sent out
 * again). False with none (the battle is lost) @returns {boolean} */
export function fxRevive() {
  const b = battleNow();
  if (!b || !b.fx) return false;
  const ctx = fxBattleCtx(null),
    st = fxBattleState(b, true),
    f = fxAt(b.fx, ctx, st).find(r => r.kind === 'revive');
  if (!f) return false;
  fxSpend(f, ctx, st);
  for (const m of b.sides[0].team) {
    if (m.hp > 0) continue;
    m.hp = Math.max(1, Math.floor(maxHp(m) * f.share));
    m.status = null;
    m.sTurns = 0;
  }
  battleSay(`${fxSrcName(f.src)}: your team got back up!`, null);
  /* each field place of yours that held a Billie sends it out again (a place off the field reads no fighter) */
  const back = new Set();
  for (const k of allActors().filter(q => ACTOR_SIDE[q] === 0)) {
    const at = fieldSlot(k).act;
    if (!b.sides[0].team[at] || back.has(at)) continue;
    back.add(at);
    doSwitch(k, at);
  }
  return true;
}
/** PK-3: the run's immune rows against `what` that hold for one of yours (none for a foe, or without Perks)
 * @param {number} k @param {string} what @returns {any[]} */
export function fxImmuneTo(k, what) {
  const b = battleNow();
  if (!b || !b.fx || ACTOR_SIDE[k] !== 0 || !fighter(k)) return [];
  return fxImmune(fxAt(b.fx, fxBattleCtx(k), fxBattleState(b)), what);
}
/** PK-4: the run's passive rows for type passive `id` that hold for one of yours, merged into their numbers
 * (effects.js fxPassive); null for a foe, without such a row, or with no Perks (the passive as before)
 * @param {number} k @param {string} id */
export function fxPassiveOf(k, id) {
  const b = battleNow();
  if (!b || !b.fx || ACTOR_SIDE[k] !== 0 || !fighter(k) || !b.fx.some(f => f.kind === 'passive' && f.passive === id))
    return null;
  return fxPassive(fxAt(b.fx, fxBattleCtx(k), fxBattleState(b)), id);
}
/** PK-4: the weather's multiplier for fighter k's move of type t: the battle host's, with the run's weather rows that
 * hold for one of yours (effects.js fxWeather); the host's alone for a foe or without such a row
 * @param {number} k @param {string} t */
export function fxWeatherFor(k, t) {
  const b = battleNow(),
    w = battleHost(b).weather(t);
  if (w === 1 || !b || !b.fx || ACTOR_SIDE[k] !== 0 || !fighter(k) || !b.fx.some(f => f.kind === 'weather')) return w;
  return fxWeather(fxAt(b.fx, fxBattleCtx(k), fxBattleState(b)), w);
}
/** PK-3: a status kept off one of yours by the run's immune rows, with its line ("Oven Mitts kept Emberox from being
 * burned."); false when nothing keeps it off @param {number} k @param {string} st */
export function fxImmuneSay(k, st) {
  const rows = fxImmuneTo(k, st);
  if (!rows.length) return false;
  const what = { brn: 'being burned', slp: 'falling asleep', par: 'being paralyzed' }[st] || 'that';
  battleSay(`${fxNames(rows)} kept ${billyName(fighter(k))} from ${what}.`, { k: 'block', si: k });
  return true;
}
/** RL-12: a run's Perks that raised stats as the battle started (fxBattleStart): one line each, after the sides
 * come out */
export function sayBattleFx() {
  const b = battleNow();
  if (!b || !b.fxSay) return;
  /* UI-16b: a line may carry its blips (fxBattleStart: each Perk that raised a stat, by each of yours it raised) */
  for (const [t, an, by] of b.fxSay) {
    const ev = battleSay(t, an);
    if (by) ev.by = by;
  }
  delete b.fxSay;
}
/** the names of the Perks (PK-1: and boons, by fxSrcName) whose stat rows change stat s ("A and B") */
export const perkNamesFor = (fx, s) =>
  [...new Set(fx.filter(f => f.kind === 'stat' && f.stat === s).map(f => fxSrcName(f.src)))].join(' and ');
/** PK-1: the marks a battle's rows keep: the run's (b.perkState, the run's own object: counters, growth, once a run)
 * and the battle's own (b.fxState: once a battle, once for each Billie), made when a row first needs them (`make`:
 * now) @param {any} [b] @param {boolean} [make] @returns {import('./effects.js').FxState} */
export function fxBattleState(b = battleNow(), make = false) {
  return { run: b.perkState || null, battle: b.fxState || (make || fxStateful(b.fx) ? (b.fxState = {}) : null) };
}
/** PK-1: what a foe is, for `if: foe:<k>`: the battle's kind (wild, trainer), a run's leader (a mini-boss), rival or
 * boss, and a bot or a spliced Billie among the foes @param {any} b @returns {string[]} */
export function fxFoeTags(b) {
  const T = b.T,
    out = [b.kind];
  if (T && T.runFoe === 'miniboss') out.push('leader');
  if (T && T.runFoe === 'rival') out.push('rival');
  if (T && T.runFoe === 'boss') out.push('boss');
  for (const e of b.sides[1].team) {
    if (isRobot(e)) out.push('bot');
    else if (e.graft || e.aug) out.push('spliced');
  }
  return [...new Set(out)];
}
/** PK-1: what a moment in battle knows for a row's `if` (logic/effects.js fxCond): about the whole battle, and about
 * the fighter k when one is given (its types, whether it leads, its share of HP); `more` adds the hit's
 * @param {number | null} [k] @param {any} [more] @returns {import('./effects.js').FxCtx} */
export function fxBattleCtx(k, more) {
  const b = battleNow(),
    mine = b.sides[0].team,
    m = k != null ? fighter(k) : null;
  /** @type {import('./effects.js').FxCtx} */
  const ctx = {
    /* a run battle's forecast (run-loop.js runBattleWeather: clear is sunny on a run) */
    weather: b.wx ? b.wx.k : 'clear',
    team: mine.map(q => billyTypes(q)),
    alone: mine.filter(q => q.hp > 0).length === 1,
    foe: fxFoeTags(b),
    turn: b.turn,
    noFaint: !(b.fainted > 0),
    /* no Billie of the foe's species on your team (a run keeps no list of what it caught) */
    newSpecies: b.kind === 'wild' && b.sides[1].team.some(e => !isRobot(e) && !mine.some(q => q.sp === e.sp)),
  };
  if (m) Object.assign(ctx, { type: actorTypes(k), lead: k === actorIndex(0, 0), hp: m.hp / maxHp(m), uid: m.uid });
  return Object.assign(ctx, more);
}
/** PK-1: the run's stat rows without a when for one of yours taking the field (the battle's start, every switch in):
 * those whose conditions hold for it raise its stages; their once marks are spent. Returns the rows given
 * @param {number} k @returns {any[]} */
export function fxFieldStages(k) {
  const b = battleNow();
  if (!b.fx || ACTOR_SIDE[k] !== 0 || !fighter(k)) return [];
  const ctx = fxBattleCtx(k),
    st = fxBattleState(b),
    rows = fxAt(b.fx, ctx, st).filter(f => f.kind === 'stat');
  for (const f of rows) fxSpend(f, ctx, st);
  const up = fxStages(rows),
    v = fieldState(k);
  for (const s2 in up) v.st[s2] = clamp((v.st[s2] || 0) + up[s2], -BATTLE_RULES.stageMax, BATTLE_RULES.stageMax);
  return rows;
}
/** PK-1: the lines for stat rows given to the fighters K, one a stat: "Running Shoes: Emberox’s Speed rose."
 * ("your team’s" for more than one) @param {any[]} rows @param {number[]} K @returns {[string, any][]} */
export function fxStageLines(rows, K) {
  const up = fxStages(rows);
  return Object.keys(up).map(s => [
    `${perkNamesFor(rows, s)}: ${K.length > 1 ? 'your team’s' : `${billyName(fighter(K[0]))}’s`} ${STAT_NAMES[s]} ${up[s] > 0 ? 'rose' : 'fell'}${Math.abs(up[s]) > 1 ? ' sharply' : ''}.`,
    K.length === 1 ? { k: 'stat', si: K[0], up: up[s] > 0 } : null,
  ]);
}
/** RL-12, PK-1: as a battle starts, the run's stat rows for each of yours on the field (fxFieldStages); the lines wait
 * in b.fxSay for sayBattleFx, after the sides come out */
export function fxBattleStart() {
  const b = battleNow();
  if (!b || !b.fx) return;
  /** @type {Record<string, { rows: any[], K: number[] }>} */
  const by = {};
  for (const k of liveActors(0)) {
    const rows = fxFieldStages(k);
    for (const s2 of Object.keys(fxStages(rows)))
      (by[s2] || (by[s2] = { rows: rows.filter(f => f.stat === s2), K: [] })).K.push(k);
  }
  /* one line a stat, for the Billies it was given to (the first one's rows name the Perks) */
  const lines = Object.entries(by).flatMap(([s2, o]) =>
    fxStageLines(o.rows, o.K).map(
      ([t]) =>
        /** @type {[string, any, any]} */ ([
          t,
          null,
          /* UI-16b: a blip by each of yours for each Perk that raised it */
          fxSources(o.rows, 'stat').flatMap(src =>
            o.K.map(si => ({ src, si, stat: s2, stages: fxStages(o.rows)[s2] }))
          ),
        ])
    )
  );
  /* the battleStart moment's lines wait with them */
  b.fxSay = lines;
  fxMoment('battleStart', null);
  if (!b.fxSay.length) delete b.fxSay;
}
/** PK-1: the rows read for the whole battle where its kind always acts (a win's money, a coin's chance, XP, DNA): the
 * run's rows without a when whose conditions hold for the battle (the foe, the weather, the turn, the team...);
 * b.fx itself when it has none @param {any} b @returns {any[] | null | undefined} */
export function fxBattleRows(b) {
  if (!b || !b.fx) return b && b.fx;
  return withBattle(b, () => fxAt(b.fx, fxBattleCtx(null), fxBattleState(b)));
}
/** PK-1: what a hit's damage is multiplied by from the run's rows: those of yours hitting (its own conditions, and
 * the rows of the hit and crit moments that would act now: fxPeek) and of yours hit (the hurt moment's); the moments
 * count after the hit lands (fxHitMoments) @param {number} k @param {number} tk @param {any} M
 * @param {{ src?: any, crit: boolean, te: number }} h */
export function fxHitMult(k, tk, M, h) {
  const R = fxHitRows(k, tk, M, h);
  return (
    (R.deal ? fxDamage(R.deal, { cat: M.c, type: M.t, deal: true, take: false }) : 1) *
    (R.take ? fxDamage(R.take, { cat: M.c, type: M.t, deal: false, take: true }) : 1)
  );
}
/** PK-1 (split out when main's UI-16b blips met PK-1): the run's rows that count for a hit: `deal` for one of yours
 * hitting (its own conditions, and the hit and crit moments' rows that would act now), `take` for one of yours hit
 * (the hurt moment's); null for a side that isn't yours @param {number} k @param {number} tk @param {any} M
 * @param {{ src?: any, crit: boolean, te: number }} h @returns {{ deal: any[] | null, take: any[] | null }} */
export function fxHitRows(k, tk, M, h) {
  const b = battleNow(),
    st = fxBattleState(b),
    more = { cat: M.c, superEffective: h.te > 1 },
    out = { deal: /** @type {any[] | null} */ (null), take: /** @type {any[] | null} */ (null) };
  if (!b || !b.fx) return out;
  if (!h.src && ACTOR_SIDE[k] === 0) {
    const ctx = fxBattleCtx(k, more);
    out.deal = [
      ...fxAt(b.fx, ctx, st),
      ...fxPeek(b.fx, 'hit', ctx, st),
      ...(h.crit ? fxPeek(b.fx, 'crit', ctx, st) : []),
    ];
  }
  if (ACTOR_SIDE[tk] === 0) {
    const ctx = fxBattleCtx(tk, more);
    out.take = [...fxAt(b.fx, ctx, st), ...fxPeek(b.fx, 'hurt', ctx, st)];
  }
  return out;
}
/** PK-1: after a hit lands: hit (and crit, and ko when the foe went down) for one of yours hitting, hurt for one of
 * yours hit @param {number} k @param {number} tk @param {any} M @param {{ crit: boolean, te: number }} r */
export function fxHitMoments(k, tk, M, r) {
  const more = { cat: M.c, superEffective: r.te > 1 };
  if (ACTOR_SIDE[k] === 0) {
    const rows = fxMoment('hit', k, more);
    /* PK-3: an inflict row at the hit: one roll for them all, on the foe hit */
    if (ACTOR_SIDE[tk] === 1 && rows.some(f => f.kind === 'inflict')) fxInflict(tk, rows);
    if (r.crit) fxMoment('crit', k, more);
    if (ACTOR_SIDE[tk] === 1 && fighter(tk).hp <= 0) fxMoment('ko', k, more);
  }
  if (ACTOR_SIDE[tk] === 0) fxMoment('hurt', tk, more);
}
/** PK-3: the inflict rows that acted at a hit: one roll of the battle's stream picks the one that lands (fxInflictPick:
 * their chances laid end to end, at most FX_CHANCE together) on the foe tk, standing and with no status yet; its line
 * names the Perk @param {number} tk @param {any[]} rows */
export function fxInflict(tk, rows) {
  const t = fighter(tk);
  if (!t || t.hp <= 0 || t.status) return;
  const f = fxInflictPick(rows, battleRoll());
  if (!f) return;
  battleSay(`${fxSrcName(f.src)} kicked in!`, null);
  inflict(tk, f.status, false);
}
/**
 * PK-1: a moment in battle: the run's rows of that `when` act (logic/effects.js fxFire counts, grows and spends). A
 * stat row's stages and a heal row's share land on the one of yours it is about (k), or on yours on the field (k
 * null, or a foe); other kinds act where they are read (fxHitMult). Each says a line with its source's name; a Perk
 * with a `say` says that instead, once ({name}: the Billie). At the battle's start the lines wait in b.fxSay.
 * @param {string} when @param {number | null} k @param {any} [more] the moment's own (a hit's category...)
 * @returns {any[]} the rows that acted
 */
export function fxMoment(when, k, more) {
  const b = battleNow();
  if (!b || !b.fx) return [];
  const rows = fxFire(b.fx, when, fxBattleCtx(k, more), fxBattleState(b));
  if (!rows.length) return rows;
  /* PK-3: a crit row at a move: that move of this one of yours is a critical hit (calcDamage) */
  if (k != null && ACTOR_SIDE[k] === 0 && rows.some(f => f.kind === 'crit')) b.fxCritK = k;
  const say = (/** @type {string} */ t, /** @type {any} */ an) => (b.fxSay ? b.fxSay.push([t, an]) : battleSay(t, an)),
    on = k != null && ACTOR_SIDE[k] === 0 ? [k] : liveActors(0),
    done = new Set();
  for (const f of rows) {
    const P = PERKS[f.src],
      line = P && P.say,
      name = fxSrcName(f.src);
    for (const q of on) {
      const m = fighter(q);
      if (!m || m.hp <= 0) continue;
      if (f.kind === 'stat' && f.stages) {
        const v = fieldState(q),
          o = v.st[f.stat] || 0;
        v.st[f.stat] = clamp(o + f.stages, -BATTLE_RULES.stageMax, BATTLE_RULES.stageMax);
        if (!line && v.st[f.stat] !== o)
          say(
            `${name}: ${billyName(m)}’s ${STAT_NAMES[f.stat]} ${f.stages > 0 ? 'rose' : 'fell'}${Math.abs(f.stages) > 1 ? ' sharply' : ''}.`,
            { k: 'stat', si: q, up: f.stages > 0 }
          );
      } else if (f.kind === 'heal' && m.hp < maxHp(m)) {
        const g = Math.min(maxHp(m) - m.hp, Math.max(1, Math.floor(maxHp(m) * f.share)));
        m.hp += g;
        if (!line) say(`${name}: ${billyName(m)} restored HP.`, { k: 'heal', si: q, amt: g });
      }
    }
    if (line && !done.has(f.src)) {
      done.add(f.src);
      say(`${name}: ${line.replace(/\{name\}/g, on.length === 1 ? billyName(fighter(on[0])) : 'your team')}`, null);
    }
  }
  return rows;
}

export function battleStageKey() {
  return hereLocation().battleStage;
}
/* one turn. plan: what each of your fighters does ({who,k:'move',mid,tk} | {who,k:'switch',i} | {who,k:'item',item,uid})
   or a single {k:'run'}. An older single action ({k:'move',mid}) is your first fighter's. */
export function runTurn(plan, b) {
  return withBattle(b, () => {
    battleNow().events = [];
    battleNow().ev = 0;
    /* PK-1: the start's Perk lines, if nobody said them (a battle begun without startWild or startTrainer) */
    sayBattleFx();
    battleNow().needSwitch = [];
    battleNow().turn++;
    battleNow().aiPlan = {};
    if (!Array.isArray(plan)) plan = [Object.assign({ who: 0 }, plan)];
    if (plan.some(p => p.k === 'run')) {
      battleSay('You got away safely.', { k: 'run' });
      battleNow().over = 'ran';
      return battleHost().play();
    }
    for (const p of plan.filter(p => p.k === 'switch')) {
      const out = fighter(p.who);
      if (!out) continue;
      /* PK-4: a passive row (Kite) makes every switch free, not only the first */
      const ss = hasPassive(actorTypes(p.who), 'slipstream') ? fxPassiveOf(p.who, 'slipstream') : null,
        free = hasPassive(actorTypes(p.who), 'slipstream') && (!battleNow().sides[0].slipstream || !!(ss && ss.always));
      if (free) battleNow().sides[0].slipstream = true;
      battleSay(
        free
          ? `${billyName(out)} rode its ${passiveName(actorTypes(p.who), 'slipstream')} back without losing the turn.`
          : `${billyName(out)}, come back.`,
        {
          k: 'recall',
          si: p.who,
        }
      ).by = free ? [{ src: 'passive:slipstream', si: p.who }] : undefined;
      doSwitch(p.who, p.i);
      p.free = free;
    }
    checkFaints();
    if (battleNow().over) return battleHost().play();
    if (plan.length === 1 && plan[0].k === 'switch' && plan[0].free) return battleHost().play();
    for (const p of plan.filter(p => p.k === 'item')) applyItem(p.item, p.uid, true);
    const acts = [];
    for (const p of plan.filter(p => p.k === 'move')) acts.push({ who: p.who, mid: p.mid, tk: p.tk, part: p.part });
    for (const k of liveActors(1)) {
      const n = fighter(k).boss ? (BATTLE_RULES.alphaActs ?? 2) : 1;
      for (let i = 0; i < n; i++) {
        const c = chooseAI(k);
        if (c) acts.push({ who: k, mid: c.mid, tk: c.tk, part: c.part, boss2: i > 0 });
      }
    }
    acts.forEach(a => (a.r = battleRoll()));
    /* PK-3: a run's first rows put yours ahead of the foe's, within a move's priority (Alarm Clock) */
    const early = fxFirstActs(acts);
    acts.sort(
      (a, b) =>
        (MOVES[b.mid].pr || 0) - (MOVES[a.mid].pr || 0) ||
        (early.has(b) ? 1 : 0) - (early.has(a) ? 1 : 0) ||
        (a.boss2 ? 1 : 0) - (b.boss2 ? 1 : 0) ||
        effectiveStat(b.who, 'hus') - effectiveStat(a.who, 'hus') ||
        a.r - b.r
    );
    for (const a of acts) {
      if (battleNow().over) break;
      const u = fighter(a.who);
      if (!u || u.hp <= 0 || fieldSlot(a.who).down) continue;
      if (!liveActors(foeSide(a.who)).length) break;
      useMove(a.who, a.mid, a.tk, a.part);
      checkFaints();
    }
    if (!battleNow().over) {
      endTurn();
      checkFaints();
    }
    turnCapCheck();
    battleHost().play();
  });
}
/* RL-4: a battle still going after RULES.battle.turnCap turns ends as a draw (battle.js endBattle: a wild battle as
   if you walked away, a trainer's as a loss), so no battle (a stall, a ghost replay) runs on for ever */
export function turnCapCheck() {
  const b = battleNow(),
    cap = BATTLE_RULES.turnCap;
  if (b.over || !(cap > 0) || b.turn < cap) return;
  b.needSwitch = [];
  battleSay(`${cap} turns and nobody has given in. The battle is called off: a draw.`, { k: 'draw' });
  b.over = 'draw';
}
export function enemyOnly(b) {
  return withBattle(b, () => {
    battleNow().aiPlan = {};
    for (const k of liveActors(1)) {
      const n = fighter(k).boss ? (BATTLE_RULES.alphaActs ?? 2) : 1;
      for (let i = 0; i < n && !battleNow().over; i++) {
        const c = chooseAI(k);
        if (c) {
          useMove(k, c.mid, c.tk);
          checkFaints();
        }
      }
    }
    if (!battleNow().over) {
      endTurn();
      checkFaints();
    }
  });
}
/** RL-14: whether a foe can be caught: a bot (a robot, the Bureau's) never is, whatever the pyramid @param {any} e */
export const catchable = e => !!e && !isRobot(e);
export function catchOdds(id, T, spin, b) {
  return withBattle(b, () => {
    const e = fighter(1);
    if (!catchable(e)) return 0;
    if (PYRAMIDS[id] && PYRAMIDS[id].m === 0) return 1;
    let C = PYRAMIDS[id].m;
    if (id === 'pyramid' && CATCH_RULES.luxury.includes(speciesOf(e).line)) C *= CATCH_RULES.luxuryPyramid;
    const Sx = e.status === 'slp' ? CATCH_RULES.asleepCatch : e.status ? CATCH_RULES.status : 1;
    return Math.min(
      1,
      speciesOf(e).cr *
        (1 - (CATCH_RULES.hpFactor * e.hp) / maxHp(e)) *
        C *
        Sx *
        T *
        (spin ? CATCH_RULES.spin : 1) *
        (e.boss ? (CATCH_RULES.alpha ?? 0.4) : 1) *
        /* RL-12: a run's Perks (logic/effects.js) */
        (battleNow().fx ? fxCatch(fxBattleRows(battleNow())) : 1)
    );
  });
}
export function catchRoll(id, T, spin, b) {
  return withBattle(b, () => {
    if (!catchable(fighter(1))) return { caught: false, w: 0, edge: false, P: 0 };
    if (battleHost().sureCatch()) return { caught: true, w: 3, edge: false, P: 1 };
    if (PYRAMIDS[id].m === 0) return { caught: true, w: 3, edge: false, P: 1 };
    if (battleRoll() < CATCH_RULES.edge) return { caught: true, w: 1, edge: true, P: 1 };
    const P = catchOdds(id, T, spin);
    const q = Math.cbrt(P);
    let w = 0;
    while (w < 3 && battleRoll() < q) w++;
    /* PK-1: a throw that missed: the run's rows of that moment */
    if (w < 3) fxMoment('throwMiss', null);
    return { caught: w === 3, w, edge: false, P };
  });
}
/* Studio plan T3.2: what follows a throw, the same on the page (battle.js finishThrow, battle-input.js) and in the
   run's simulation (logic/run-sim.js) */
/** a caught foe is kept: an Alpha stays one (its boss state gone, its share of HP kept), never below 1 HP, then
 * addBilly; the battle is over ('caught'). Returns where it went and whether it was an Alpha @param {any} e */
export function catchKeep(e) {
  const alpha = !!e.boss;
  if (e.boss) {
    const f = e.hp / maxHp(e);
    delete e.boss;
    e.alpha = true;
    e.hp = Math.max(1, Math.round(maxHp(e) * f));
  }
  e.hp = Math.max(1, e.hp);
  /* PK-5: a run's catchLevel rows (Name Tags): it joins that many levels higher, learning its moves on the way */
  fxCatchLevelUp(e);
  const where = addBilly(e);
  battleNow().over = 'caught';
  return { where, alpha };
}
/** PK-5: a caught foe joins the levels the run's catchLevel rows give (fxBattleRows: those whose conditions hold
 * here), as a Protein Bar's would (rules.js feedLevels: its moves learned on the way, its HP up by what it gained);
 * one line names the Perks instead of a line a level. The levels gained (0 with none) @param {any} e */
export function fxCatchLevelUp(e) {
  const b = battleNow();
  if (!b || !b.fx) return 0;
  const rows = (fxBattleRows(b) || []).filter(f => f.kind === 'catchLevel'),
    n = fxCatchLevel(rows);
  if (!n) return 0;
  const got = feedLevels(e, n, (t, o) => {
    if (!o || o.k !== 'lvl') battleSay(t, o);
  });
  if (got)
    battleSay(
      `${[...new Set(rows.map(f => fxSrcName(f.src)))].join(' and ')}: ${billyName(e)} joins at level ${e.lvl}.`,
      null
    );
  return got;
}
/* the items: out of battle (b not given) on the save's team and bag; with a battle, on that battle's team and bag */
export const teamNeedsHp = b => (b ? b.sides[0].team : saveData.team).some(m => m.hp > 0 && m.hp < maxHp(m));
export const canUse = (it, m, b) => {
  const I = ITEMS[it];
  if (!I || !battleBag(b)[it] || I.evoItem || I.lvlUp || I.hold) return false;
  if (I.revive) return m.hp <= 0;
  if (m.hp <= 0) return false;
  if (I.hpAll) return teamNeedsHp(b);
  /* phase 17: a repair kit fixes a robot's damaged parts */
  if (I.repair) return partsDamaged(m);
  const hurt = m.hp < maxHp(m);
  if (I.cure) return (I.cure === 'any' ? !!m.status : m.status === I.cure) || (!!I.hp && hurt);
  if (I.hp) return hurt;
  return false;
};
/* inB: used in a battle's turn (the current battle, or b) */
export function applyItem(it, id, inB, b) {
  const X = b || (inB ? battleNow() : null),
    I = ITEMS[it],
    m = X ? X.sides[0].team.find(q => q.uid === id) : findBilly(id);
  if (!m || !canUse(it, m, X)) return false;
  battleBag(X)[it]--;
  const t = [];
  let healed = 0;
  if (I.revive) {
    m.hp = Math.max(1, Math.floor(maxHp(m) * I.revive));
    m.status = null;
    m.sTurns = 0;
    t.push(`${billyName(m)} was revived.`);
    healed = m.hp;
  } else {
    if (I.cure && m.status && (I.cure === 'any' || m.status === I.cure)) {
      const was = m.status;
      m.status = null;
      m.sTurns = 0;
      t.push(`${billyName(m)} is no longer ${(STATUS_NAMES[was] || 'troubled').toLowerCase()}.`);
    }
    if (I.repair && repairParts(m, I.repair)) t.push(`${billyName(m)}’s parts were fixed.`);
    if (I.hp) {
      const g = Math.min(I.hp, maxHp(m) - m.hp);
      if (g > 0) {
        m.hp += g;
        healed = g;
        t.push(`${billyName(m)} recovered ${g} HP.`);
      }
    }
    if (I.hpAll) {
      let n = 0;
      (X ? X.sides[0].team : saveData.team).forEach(x => {
        if (x.hp > 0) {
          /* if (I.hpAll) above; TypeScript doesn't carry that into the callback */
          const g = Math.min(/** @type {number} */ (I.hpAll), maxHp(x) - x.hp);
          if (g > 0) {
            x.hp += g;
            n++;
            if (x === m) healed = g;
          }
        }
      });
      t.push(`${plural(n, 'Billie')} recovered up to ${I.hpAll} HP.`);
    }
  }
  if (inB) {
    battleSay(`You used ${/^[AEIOU]/.test(I.n) ? 'an' : 'a'} ${I.n}.`, { k: 'item', it });
    const kOn = allActors().find(k => ACTOR_SIDE[k] === 0 && fighter(k) === m),
      onField = kOn != null || I.hpAll;
    t.forEach((x, i) =>
      battleSay(x, i === 0 && onField ? { k: 'heal', si: kOn ?? 0, amt: healed || undefined } : null)
    );
  } else battleHost(X).toast(t.join(' '));
  battleHost(X).save();
  return true;
}
