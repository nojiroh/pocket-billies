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
  COINS,
  ITEMS,
  MOVES,
  PASSIVE,
  RELICS,
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
import { ROBOT_LIMBS, ROBOT_SLOT_NAMES, isRobot, moveSources, robotGemDef, robotRules, speciesOf } from './fighters.js';
import {
  addBilly,
  billyName,
  brokenParts,
  coatPrefix,
  encounterBuild,
  findBilly,
  formatNumber,
  gainXp,
  hereLocation,
  makeBilly,
  maxHp,
  moveUsable,
  partBroken,
  partHpLeft,
  partMaxHp,
  partsDamaged,
  pickWeighted,
  plural,
  repairParts,
  stat,
  xpFor,
} from './rules.js';
import { fxCatch, fxDamage, fxStages } from './effects.js';
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
  calcDamage: [() => calcDamage, v => (calcDamage = v)],
  canUse: [() => canUse],
  // @ts-expect-error -- replaced on purpose
  catchKeep: [() => catchKeep, v => (catchKeep = v)],
  // @ts-expect-error -- replaced on purpose
  catchOdds: [() => catchOdds, v => (catchOdds = v)],
  // @ts-expect-error -- replaced on purpose
  catchRoll: [() => catchRoll, v => (catchRoll = v)],
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
  fieldSlot: [() => fieldSlot],
  fieldState: [() => fieldState],
  fighter: [() => fighter],
  foeSide: [() => foeSide],
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
export const actorTypes = k => fieldState(k).ov || speciesOf(fighter(k)).types;
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
    if (m.status === 'scn') x *= 0.5;
    if (hasPassive(actorTypes(k), 'ramp'))
      x *= 1 + BATTLE_RULES.financeRamp * Math.min(BATTLE_RULES.financeRampTurns, v.turnsIn);
  }
  if (s2 === 'hus' && m.status === 'aud') x *= 0.5;
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
    alpha: !!(m.boss || m.alpha),
    boss: !!m.boss,
    ty: actorTypes(k).slice(),
    xp: clamp((m.xp - a) / (b - a), 0, 1),
    stg: { ...f.v.st },
    /* phase 17: a robot's limbs: which are broken (the stage dims them) and how much HP each has left (0 to 1) */
    bot: isRobot(m)
      ? {
          brk: brokenParts(m),
          ph: Object.fromEntries(ROBOT_LIMBS.map(q => [q, partHpLeft(m, q) / partMaxHp(m, q)])),
        }
      : null,
  };
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
  const cs = (fx.crit || 0) + (hasPassive(aty, 'sharp') ? BATTLE_RULES.mediaCrit : 0);
  const crit = !src && battleRoll() < BATTLE_RULES.critChances[clamp(cs, 0, BATTLE_RULES.critChances.length - 1)];
  const roll = hasPassive(aty, 'volatile')
    ? BATTLE_RULES.cryptoRollMin + battleRoll() * (BATTLE_RULES.cryptoRollMax - BATTLE_RULES.cryptoRollMin)
    : BATTLE_RULES.rollMin + battleRoll() * (1 - BATTLE_RULES.rollMin);
  const mk = battleNow().market && M.t === BATTLE_RULES.shockType ? BATTLE_RULES.oilShockMult : 1;
  let eco = 1;
  if (!src) {
    const syn = aty.filter(t => PASSIVE[t] === 'synergy');
    if (syn.length) {
      const sd = battleNow().sides[ACTOR_SIDE[k]],
        me = fighter(k);
      eco =
        1 +
        BATTLE_RULES.retailSynergy *
          sd.team.filter(m => m !== me && m.hp > 0 && speciesOf(m).types.some(t => syn.includes(t))).length;
    }
  }
  /* RF-3 Undertow (Water): its moves of a type with Undertow hit harder at a third of its HP or less */
  const low = !src && fighter(k).hp <= maxHp(fighter(k)) * BATTLE_RULES.undertowHp,
    tow = low && PASSIVE[M.t] === 'undertow' && aty.includes(M.t) ? BATTLE_RULES.undertowMult : 1;
  const wx = battleHost().weather(M.t); /* v28: the weather where you stand */
  /* phase 17: a robot's move of its gem's type hits harder */
  const me = src ? null : fighter(k),
    gem = isRobot(me) ? robotGemDef(me.gem) : null,
    gx = gem && gem.type === M.t ? robotRules().gemAffinity : 1;
  /* RL-12: a run's Perks (logic/effects.js): what yours deal and take; 1 without any */
  const fm = battleNow().fx
    ? fxDamage(battleNow().fx, { cat: M.c, type: M.t, deal: !src && ACTOR_SIDE[k] === 0, take: ACTOR_SIDE[tk] === 0 })
    : 1;
  return {
    dmg: Math.max(
      1,
      Math.floor(base * stab * te * roll * (crit ? BATTLE_RULES.critMult : 1) * mk * eco * tow * wx * gx * fm)
    ),
    te,
    crit,
  };
}
/** RF-3 Bedrock (Ground): once a battle, a hit that would knock a fighter out from full HP leaves it at 1 HP (the
 * side's `held` lists the team places that have used it). Lowers r.dmg; true when it held. @param {number} tk
 * @param {{ dmg: number }} r */
export function bedrockHolds(tk, r) {
  const t = fighter(tk),
    sd = battleNow().sides[ACTOR_SIDE[tk]],
    at = fieldSlot(tk).act,
    mx = maxHp(t);
  if (r.dmg < t.hp || t.hp < mx || mx < 2 || !hasPassive(actorTypes(tk), 'landlord')) return false;
  if ((sd.held || (sd.held = [])).includes(at)) return false;
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
  if (t.boss && st === 'sub' && battleRoll() < (BATTLE_RULES.alphaSleepResist ?? 0.5)) {
    battleSay(`${billyName(t)} shrugged it off. Alphas don’t nod off easily.`);
    return;
  }
  t.status = st;
  if (st === 'sub')
    t.sTurns =
      BATTLE_RULES.subpoenaMin + Math.floor(battleRoll() * (BATTLE_RULES.subpoenaMax - BATTLE_RULES.subpoenaMin + 1));
  battleSay(
    `${billyName(t)} ${st === 'aud' ? 'is paralyzed. It may be unable to move' : st === 'sub' ? 'fell asleep' : st === 'scn' ? 'was burned' : 'is ' + (STATUS_NAMES[st] || st)}.`,
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
    const src = moveSources(u.gem, u.fit, mid)[0];
    battleSay(`${billyName(u)}’s ${ROBOT_SLOT_NAMES[src] || 'part'} is broken. It can’t use ${M.n}.`, {
      k: 'status',
      si: k,
    });
    return;
  }
  if (u.status === 'sub') {
    u.sTurns--;
    if (u.sTurns > 0) {
      battleSay(`${billyName(u)} is fast asleep.`, { k: 'status', si: k, st: 'sub' });
      return;
    }
    u.status = null;
    battleSay(`${billyName(u)} woke up.`);
  }
  if (u.status === 'aud' && battleRoll() < BATTLE_RULES.auditSkip) {
    battleSay(`${billyName(u)} is paralyzed and can’t move.`, { k: 'status', si: k, st: 'aud' });
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
  const onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe;
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
      /* phase 17: a hit on a robot also lands on one of its parts (an aimed move on the one picked) */
      const hit = isRobot(t2) && t2.hp > 0 ? hitPart(tk2, r.dmg, M, tk2 === tk ? part : null) : null;
      if (tk2 === tk) Object.assign(ev.an, { dmg: r.dmg, te: r.te, crit: r.crit, part: hit || undefined });
      else
        battleSay(`${billyName(t2)} was hit too.`, { k: 'hurt', si: tk2, dmg: r.dmg, te: r.te, fx: 'spread', t: M.t });
      refreshLastSnapshot();
      if (hit && hit !== 'torso' && partBroken(t2, hit))
        battleSay(`${billyName(t2)}’s ${ROBOT_SLOT_NAMES[hit]} broke!`, { k: 'break', si: tk2, part: hit });
      if (r.shield) battleSay(`The shield took the edge off.`, { k: 'block', si: tk2 });
      if (r.crit) battleSay('A critical hit!', { k: 'crit', si: tk2 });
      if (r.te > 1) battleSay('It’s super effective!');
      else if (r.te < 1) battleSay('It’s not very effective.');
      if (held)
        battleSay(`${billyName(t2)} held on with ${passiveName(actorTypes(tk2), 'landlord')}!`, {
          k: 'block',
          si: tk2,
        });
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
        battleSay(`${billyName(t2)} was soaked and became ${BATTLE_RULES.spinType} type.`, {
          k: 'stat',
          si: tk2,
          up: false,
        });
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
  if (fx.selfStatus && u.hp > 0 && !u.status && battleRoll() * 100 < (fx.selfChance || 100)) {
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
  if (fx.rent) {
    if (td.rent) {
      if (M.c === 'X') battleSay('Sharp stones are already scattered there.');
    } else {
      td.rent = true;
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
    if (m.status === 'scn') {
      const d = Math.max(1, Math.floor(mx / fr));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} is hurt by its burn.`, { k: 'hurt', si: k, fx: 'scn', dmg: d });
    }
    if (m.hp > 0 && battleNow().market && !ty.includes(BATTLE_RULES.shockType)) {
      const d = Math.max(1, Math.floor(mx / fr));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} is buffeted by the ${shockName().toLowerCase()}.`, {
        k: 'hurt',
        si: k,
        fx: 'oil',
        dmg: d,
      });
    }
    if (m.hp > 0 && hasPassive(ty, 'subsidy') && m.hp < mx) {
      const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx / fr)));
      m.hp += g;
      battleSay(`${billyName(m)}’s ${passiveName(ty, 'subsidy')} restored a little HP.`, { k: 'heal', si: k, amt: g });
    }
    f.v.turnsIn++;
    f.v.protect = false;
    if (f.v.ovT > 0 && --f.v.ovT === 0) {
      f.v.ov = null;
      battleSay(`${billyName(m)} dried off and is back to its own type.`);
    }
  }
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
        battleSay(`${h.from}’s ${(MOVES[h.mid] || MOVES.twoday || { n: 'attack' }).n} struck ${billyName(t)}.`, {
          k: 'hurt',
          si: tk,
          fx: 'mail',
          te: r.te,
          dmg: r.dmg,
        });
        if (r.te > 1) battleSay('It’s super effective!');
        else if (r.te < 1) battleSay('It’s not very effective.');
        if (held)
          battleSay(`${billyName(t)} held on with ${passiveName(actorTypes(tk), 'landlord')}!`, { k: 'block', si: tk });
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
    battleSay(`${billyName(m)} gained ${formatNumber(amt)} XP.`, { k: 'xp', si: k });
    gainXp(m, amt, battleSay);
  });
  /* phase 08: your buddy gets the full amount even when it didn't fight (it got its XP from walking before) */
  const mine = battleNow().sides[0].team,
    buddy = battleBuddy(battleNow());
  const bud = mine.find(m => m.uid === buddy && !on.includes(m) && m.hp > 0);
  if (bud) {
    battleSay(`${billyName(bud)} gained ${formatNumber(amt)} XP.`);
    gainXp(bud, amt, battleSay);
  }
  const share = Math.floor(amt * P.teamXpShare),
    rest = mine.filter(m => !on.includes(m) && m !== bud && m.hp > 0);
  if (rest.length && share > 0) {
    rest.forEach(m => gainXp(m, share, () => {}));
    battleSay(`The rest of the team gained ${formatNumber(share)} XP.`);
  }
}
/** RF-3 Parting Roar (Dragon, id `inherit`): when it faints, the next teammate in gets +1 Attack and +1 Sp. Atk
 * (before RF-3 it passed on its own boosts, if it had any) */
export function inherit(k) {
  const ty = speciesOf(fighter(k)).types;
  if (!hasPassive(ty, 'inherit')) return;
  battleNow().sides[ACTOR_SIDE[k]].inh = {
    lev: 1,
    lob: 1,
    from: billyName(fighter(k)),
    name: passiveName(ty, 'inherit'),
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
    const inh = sd.inh;
    f.v = newFieldState();
    sd.inh = null;
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
    if (sd.rent && !hasPassive(speciesOf(m).types, 'landlord')) {
      const d = Math.max(1, Math.floor(maxHp(m) / Math.max(2, BATTLE_RULES.rentFraction)));
      m.hp = Math.max(0, m.hp - d);
      battleSay(`${billyName(m)} was hurt by the sharp stones.`, { k: 'hurt', si: k, fx: 'rent', dmg: d });
    }
    if (inh) {
      f.v.st.lev += inh.lev;
      f.v.st.lob += inh.lob;
      battleSay(`${inh.from}’s ${inh.name} fired up ${billyName(m)}!`, { k: 'stat', si: k, up: true });
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
    battleSay(`${billyName(p)} fainted.`, { k: 'faint', si: k });
    inherit(k);
    const pend = (battleNow().needSwitch || []).length;
    if (benchCandidates(0).length > pend) {
      if (!battleNow().over) (battleNow().needSwitch || (battleNow().needSwitch = [])).push(k);
    } else f.on = false;
  }
  if (!battleNow().over && !liveActors(0).length && !(battleNow().needSwitch || []).length) battleNow().over = 'lose';
  if (any && !battleNow().over && liveActors(1).some(k => fighter(k).hp <= 0)) checkFaints();
  return any;
}
/* how much a move is worth against one target, for the computer's choices */
/* v34: an Alpha has two phases. Brought below half its HP it raises a shield (half damage for a couple of turns),
   its eyes go red and it hits harder from then on (RULES.battle.alphaShield*) */
export function alphaPhase(k) {
  const m = fighter(k);
  if (!m || !m.boss || m.hp <= 0 || m.boss.ph2 || m.hp > maxHp(m) * (BATTLE_RULES.alphaPhaseAt ?? 0.5)) return;
  m.boss.ph2 = true;
  const v = fieldState(k);
  v.shield = BATTLE_RULES.alphaShieldTurns ?? 2;
  battleSay(`${billyName(m)} is furious! A golden shield rises around it.`, { k: 'alphaPhase', si: k });
  applyStatStages(k, { lev: 1, lob: 1 });
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
  else if (fx.rent) s = battleNow().sides[ACTOR_SIDE[tk]].rent ? 0 : 30;
  else if (fx.market) s = battleNow().market ? 0 : 40;
  else if (fx.selfStage) s = Object.keys(fx.selfStage).some(q => fieldState(k).st[q] < 2) ? 28 : 0;
  else if (fx.tgtStage) s = 22;
  else if (fx.spin) s = fieldState(tk).ov ? 0 : 20;
  else s = 0;
  return s + 5;
}
export function chooseAI(k = 1, b) {
  return withBattle(b, () => {
    const m = fighter(k);
    if (!m || m.hp <= 0) return null;
    const T = liveActors(foeSide(k));
    if (!T.length) return null;
    const opts = [];
    for (const id of m.moves.filter(id => MOVES[id] && moveUsable(m, id)))
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
  if (!t || !isRobot(t) || !(M.fx && M.fx.aim)) return undefined;
  const L = ROBOT_LIMBS.filter(q => !partBroken(t, q));
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
  let slot = aim && fx.aim && ROBOT_LIMBS.includes(aim) && !partBroken(t, aim) ? aim : null;
  if (!slot) {
    const W = /** @type {[string, number][]} */ ([['torso', R.hitWeights.torso ?? 0.25]]);
    for (const q of ROBOT_LIMBS) if (!partBroken(t, q)) W.push([q, R.hitWeights[q] ?? 0.25]);
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
/** a wild Billie's battle. Studio plan T3.2: `o.host` and `o.extra` (a run battle's seed, weather and Perks:
 * logic/run-loop.js runBattleExtra) as for startTrainer, so the run's simulation starts it as the page does */
export function startWild(q, o = {}) {
  const made = { build: encounterBuild(q), coat: q.coat },
    foe = q.alpha ? makeAlpha(q.sp, q.lvl, made) : makeBilly(q.sp, q.lvl, made);
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
  if (CATCH_RULES.luxury.includes(SPECIES[q.sp].line))
    battleSay(`It looks too picky for ${COINS.penny ? 'a ' + COINS.penny.n : 'cheap coins'}.`);
  const K = liveActors(0);
  K.forEach((k, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}
export function startTrainer(id, o = {}) {
  const T = TRAINERS[id];
  if (!T) return;
  /* RL-8: a run's boss is its leader's top Billie alone, as an Alpha (logic/run-loop.js runFoes) */
  const team = T.alpha ? T.team.slice(0, 1).map(e => makeAlpha(e.sp, e.lvl)) : trainerTeam(T);
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
    T.alpha
      ? `${T.name} sends out an Alpha! It acts twice a turn. Your team steps up together.`
      : dbl
        ? `${T.name} wants a double battle!`
        : `${T.name} wants to battle.`,
    { k: 'trainerIn', who: T.who }
  );
  if (T.market) {
    battleNow().market = { k: 'sand', n: T.market.n || BATTLE_RULES.shockTurns };
    battleSay(T.marketText || `The battle opened in a ${shockName().toLowerCase()}.`, { k: 'market' });
  }
  const F = liveActors(1);
  F.forEach((k, n) => battleSay(n ? '' : `${T.name} sent out ${joinNames(F)}.`, { k: 'enter', si: k, quiet: n > 0 }));
  const K = liveActors(0);
  K.forEach((k, n) => battleSay(n ? '' : `Go, ${joinNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  sayBattleFx();
  battleHost().open();
}
/** RL-12: a run's Perks that raised stats as the battle started (makeBattle): one line each, after the sides
 * come out */
export function sayBattleFx() {
  const b = battleNow();
  if (!b || !b.fx) return;
  const up = fxStages(b.fx),
    K = liveActors(0);
  for (const s in up)
    battleSay(
      `${perkNamesFor(b.fx, s)}: ${K.length > 1 ? 'your team’s' : `${billyName(fighter(K[0]))}’s`} ${STAT_NAMES[s]} ${up[s] > 0 ? 'rose' : 'fell'}${Math.abs(up[s]) > 1 ? ' sharply' : ''}.`
    );
}
/** the names of the Perks whose stat rows change stat s ("A and B") */
export const perkNamesFor = (fx, s) =>
  [
    ...new Set(fx.filter(f => f.kind === 'stat' && f.stat === s).map(f => (RELICS[f.src] || { name: f.src }).name)),
  ].join(' and ');
export function battleStageKey() {
  return hereLocation().battleStage;
}
/* one turn. plan: what each of your fighters does ({who,k:'move',mid,tk} | {who,k:'switch',i} | {who,k:'item',item,uid})
   or a single {k:'run'}. An older single action ({k:'move',mid}) is your first fighter's. */
export function runTurn(plan, b) {
  return withBattle(b, () => {
    battleNow().events = [];
    battleNow().ev = 0;
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
      const free = hasPassive(actorTypes(p.who), 'pivot') && !battleNow().sides[0].pivot;
      if (free) battleNow().sides[0].pivot = true;
      battleSay(
        free
          ? `${billyName(out)} rode its ${passiveName(actorTypes(p.who), 'pivot')} back without losing the turn.`
          : `${billyName(out)}, come back.`,
        {
          k: 'recall',
          si: p.who,
        }
      );
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
    acts.sort(
      (a, b) =>
        (MOVES[b.mid].pr || 0) - (MOVES[a.mid].pr || 0) ||
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
export function catchOdds(id, T, spin, b) {
  return withBattle(b, () => {
    const e = fighter(1);
    if (COINS[id] && COINS[id].m === 0) return 1;
    let C = COINS[id].m;
    if (id === 'penny' && CATCH_RULES.luxury.includes(speciesOf(e).line)) C *= CATCH_RULES.luxuryPenny;
    const Sx = e.status === 'sub' ? CATCH_RULES.subpoena : e.status ? CATCH_RULES.status : 1;
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
        (battleNow().fx ? fxCatch(battleNow().fx) : 1)
    );
  });
}
export function catchRoll(id, T, spin, b) {
  return withBattle(b, () => {
    if (battleHost().sureCatch()) return { caught: true, w: 3, edge: false, P: 1 };
    if (COINS[id].m === 0) return { caught: true, w: 3, edge: false, P: 1 };
    if (battleRoll() < CATCH_RULES.edge) return { caught: true, w: 1, edge: true, P: 1 };
    const P = catchOdds(id, T, spin);
    const q = Math.cbrt(P);
    let w = 0;
    while (w < 3 && battleRoll() < q) w++;
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
  const where = addBilly(e);
  battleNow().over = 'caught';
  return { where, alpha };
}
/* the items: out of battle (b not given) on the save's team and bag; with a battle, on that battle's team and bag */
export const teamNeedsHp = b => (b ? b.sides[0].team : saveData.team).some(m => m.hp > 0 && m.hp < maxHp(m));
export const canUse = (it, m, b) => {
  const I = ITEMS[it];
  if (!I || !battleBag(b)[it] || I.evoItem) return false;
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
