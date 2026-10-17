'use strict';
/* ================= BATTLE ENGINE =================
   Every number comes from RULES.battle / RULES.catching (data/gamedata.js); type abilities come from each type's passive.
   v33: a side fields one, two or three fighters at once. Each fighter on the field is an actor, numbered so a classic
   one-on-one battle is still 0 (yours) against 1 (theirs): 0 = your first, 1 = their first, 2 = your second, 3 = their
   second, 4 = your third. Doubles (some trainers) are 0+2 against 1+3; an Alpha is fought by 0, 2 and 4 against 1. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import {
  BACKDROPS,
  COINS,
  EGGS,
  EGG_TIERS,
  ITEMS,
  MOVES,
  PASSIVE,
  RULES,
  SP,
  STATK,
  STATN,
  STATUSN,
  TC,
  TRAINERS,
  eff,
  hasPassive,
  trainerTeam,
} from './data.js';
import {
  $,
  $$,
  N,
  RM,
  S,
  U,
  addEgg,
  addMon,
  clamp,
  esc,
  findMon,
  fmt,
  gainXp,
  healAll,
  hereStop,
  makeMon,
  maxHp,
  pickW,
  plural,
  rnd,
  save,
  stat,
  xpFor,
} from './core.js';
import { artURL, coinHTML, eggHTML, iconURL, uiIco } from './art.js';
import { portraitHTML } from './trainer.js';
import { KBACK, bustHTML, rigPreload } from './rig.js';
import {
  AREAS,
  EASE,
  SC,
  camAt,
  scCatch,
  scFocus,
  scPlay,
  scPrepare,
  scResize,
  scRingPhase,
  scSelect,
  scStart,
  scStop,
  scTargets,
  scToCss,
  sideCenter,
  sideTop,
  sideWorld,
} from './scene.js';
import { DIO } from './diorama.js';
import { ENV, ENV_NAMES, envHere, envState } from './env.js';
import { DGL, dglRing, dglWgAt } from './diorama-gl.js';
import { BGL, battleGLWanted } from './battle-gl.js';
/* eslint-disable no-func-assign */
expose({
  A: [() => A],
  AK: [() => AK],
  AKS: [() => AKS],
  ASIDE: [() => ASIDE],
  ASL: [() => ASL],
  FT: [() => FT],
  FV: [() => FV],
  RB: [() => RB],
  RC: [() => RC],
  STG: [() => STG],
  TKL: [() => TKL],
  adv: [() => adv, v => (adv = v)],
  afterEvents: [() => afterEvents, v => (afterEvents = v)],
  aiDmg: [() => aiDmg, v => (aiDmg = v)],
  aiScore: [() => aiScore, v => (aiScore = v)],
  allK: [() => allK],
  alphaPhase: [() => alphaPhase, v => (alphaPhase = v)],
  applyItem: [() => applyItem, v => (applyItem = v)],
  areaKey: [() => areaKey, v => (areaKey = v)],
  award: [() => award, v => (award = v)],
  backBtn: [() => backBtn],
  battleFreeArea: [() => battleFreeArea, v => (battleFreeArea = v)],
  battleLayoutChanged: [() => battleLayoutChanged, v => (battleLayoutChanged = v)],
  battleLeave: [() => battleLeave, v => (battleLeave = v)],
  battleMode: [() => battleMode, v => (battleMode = v)],
  battleResize: [() => battleResize, v => (battleResize = v)],
  battleRise: [() => battleRise, v => (battleRise = v)],
  battleSeamless: [() => battleSeamless, v => (battleSeamless = v)],
  battleShell: [() => battleShell, v => (battleShell = v)],
  battleSwoop: [() => battleSwoop, v => (battleSwoop = v)],
  bench: [() => bench, v => (bench = v)],
  bindAim: [() => bindAim, v => (bindAim = v)],
  boxAnims: [() => boxAnims, v => (boxAnims = v)],
  boxShow: [() => boxShow, v => (boxShow = v)],
  canUse: [() => canUse],
  catchOdds: [() => catchOdds, v => (catchOdds = v)],
  catchRoll: [() => catchRoll, v => (catchRoll = v)],
  checkFaints: [() => checkFaints, v => (checkFaints = v)],
  chooseAI: [() => chooseAI, v => (chooseAI = v)],
  chooseMsg: [() => chooseMsg, v => (chooseMsg = v)],
  countTo: [() => countTo, v => (countTo = v)],
  dmgCalc: [() => dmgCalc, v => (dmgCalc = v)],
  doSwitch: [() => doSwitch, v => (doSwitch = v)],
  doThrow: [() => doThrow, v => (doThrow = v)],
  effLabel: [() => effLabel, v => (effLabel = v)],
  endBattle: [() => endBattle, v => (endBattle = v)],
  endTurn: [() => endTurn, v => (endTurn = v)],
  enemyOnly: [() => enemyOnly, v => (enemyOnly = v)],
  finishThrow: [() => finishThrow, v => (finishThrow = v)],
  foeSide: [() => foeSide],
  freshV: [() => freshV],
  goNames: [() => goNames],
  hcard: [() => hcard, v => (hcard = v)],
  hpMini: [() => hpMini, v => (hpMini = v)],
  hudHit: [() => hudHit, v => (hudHit = v)],
  hudPop: [() => hudPop, v => (hudPop = v)],
  hudScene: [() => hudScene],
  inflict: [() => inflict, v => (inflict = v)],
  inherit: [() => inherit, v => (inherit = v)],
  isMulti: [() => isMulti],
  itemIcon: [() => itemIcon],
  liveK: [() => liveK],
  logLine: [() => logLine, v => (logLine = v)],
  makeAlpha: [() => makeAlpha, v => (makeAlpha = v)],
  monPick: [() => monPick, v => (monPick = v)],
  movePower: [() => movePower, v => (movePower = v)],
  msgFace: [() => msgFace, v => (msgFace = v)],
  needsTarget: [() => needsTarget, v => (needsTarget = v)],
  newBattle: [() => newBattle, v => (newBattle = v)],
  openBattle: [() => openBattle, v => (openBattle = v)],
  paintActions: [() => paintActions, v => (paintActions = v)],
  paintBoxes: [() => paintBoxes, v => (paintBoxes = v)],
  paintParty: [() => paintParty, v => (paintParty = v)],
  paintPlates: [() => paintPlates, v => (paintPlates = v)],
  paintSide: [() => paintSide, v => (paintSide = v)],
  pickMove: [() => pickMove, v => (pickMove = v)],
  pickTarget: [() => pickTarget, v => (pickTarget = v)],
  planBack: [() => planBack, v => (planBack = v)],
  planNext: [() => planNext, v => (planNext = v)],
  plateEl: [() => plateEl, v => (plateEl = v)],
  platesTick: [() => platesTick, v => (platesTick = v)],
  play: [() => play, v => (play = v)],
  retarget: [() => retarget, v => (retarget = v)],
  runTurn: [() => runTurn, v => (runTurn = v)],
  say: [() => say, v => (say = v)],
  scAfter: [() => scAfter, v => (scAfter = v)],
  shockName: [() => shockName],
  showAim: [() => showAim, v => (showAim = v)],
  snapAll: [() => snapAll],
  snapK: [() => snapK, v => (snapK = v)],
  snapSide: [() => snapSide],
  stage: [() => stage, v => (stage = v)],
  stageTap: [() => stageTap, v => (stageTap = v)],
  startTrainer: [() => startTrainer, v => (startTrainer = v)],
  startWild: [() => startWild, v => (startWild = v)],
  statE: [() => statE, v => (statE = v)],
  stepEv: [() => stepEv, v => (stepEv = v)],
  stopTimers: [() => stopTimers, v => (stopTimers = v)],
  tapMsg: [() => tapMsg, v => (tapMsg = v)],
  teamNeedsHp: [() => teamNeedsHp],
  teamPick: [() => teamPick, v => (teamPick = v)],
  tickerUpdate: [() => tickerUpdate, v => (tickerUpdate = v)],
  turnBar: [() => turnBar, v => (turnBar = v)],
  typeText: [() => typeText, v => (typeText = v)],
  types: [() => types],
  upd: [() => upd, v => (upd = v)],
  useMove: [() => useMove, v => (useMove = v)],
  wipe: [() => wipe, v => (wipe = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const RB = RULES.battle,
  RC = RULES.catching;
const freshV = () => ({
  st: Object.fromEntries(STATK.filter(k => k !== 'hp').map(k => [k, 0])),
  turnsIn: 0,
  ov: null,
  ovT: 0,
  protect: false,
  last: null,
  holdN: 0,
  hyped: 0,
  down: false,
});
const ASIDE = [0, 1, 0, 1, 0],
  ASL = [0, 0, 1, 1, 2],
  AKS = [
    [0, 2, 4],
    [1, 3],
  ];
const AK = (si, sl) => AKS[si][sl];
const FT = k => {
  const sd = B && B.sides[ASIDE[k]];
  return sd ? sd.f[ASL[k]] : null;
};
export const A = k => {
  const f = FT(k);
  return f && f.on ? B.sides[ASIDE[k]].team[f.act] : undefined;
};
const FV = k => FT(k).v;
/* every actor on the field, the live ones, and those of one side */
const allK = () => {
  const o = [];
  if (!B) return o;
  B.sides.forEach((sd, si) => sd.f.forEach((f, sl) => o.push(AK(si, sl))));
  return o;
};
export const liveK = si => allK().filter(k => (si == null || ASIDE[k] === si) && A(k) && A(k).hp > 0);
const foeSide = k => 1 - ASIDE[k];
export const types = k => FV(k).ov || SP[A(k).sp].types;
const shockName = () => RB.shockName || `${RB.shockType} storm`;
const isMulti = () => !!B && (B.sides[0].f.length > 1 || B.sides[1].f.length > 1);
function statE(k, s2) {
  const m = A(k),
    v = FV(k);
  let x = stat(m, s2);
  const s = v.st[s2] || 0;
  x *= s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  if (s2 === 'lev') {
    if (m.status === 'scn') x *= 0.5;
    if (hasPassive(types(k), 'ramp')) x *= 1 + RB.financeRamp * Math.min(RB.financeRampTurns, v.turnsIn);
  }
  if (s2 === 'hus' && m.status === 'aud') x *= 0.5;
  return Math.max(1, x);
}
function snapK(k) {
  const f = FT(k);
  if (!f || !f.on) return null;
  const m = B.sides[ASIDE[k]].team[f.act];
  if (!m) return null;
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return {
    k,
    uid: m.uid,
    sp: m.sp,
    name: N(m),
    lvl: m.lvl,
    hp: m.hp,
    max: maxHp(m),
    st: m.status,
    gold: m.gold,
    alpha: !!(m.boss || m.alpha),
    boss: !!m.boss,
    ty: types(k).slice(),
    xp: clamp((m.xp - a) / (b - a), 0, 1),
    stg: { ...f.v.st },
  };
}
export const snapAll = () => [0, 1, 2, 3, 4].map(k => (FT(k) ? snapK(k) : null));
/* kept for older callers: the first fighter of a side */
const snapSide = si => snapK(si);
export function say(t, an) {
  const ev = { t, an: an || null, s: snapAll(), mk: B.market ? { ...B.market } : null };
  B.events.push(ev);
  return ev;
}
function upd() {
  const e = B.events[B.events.length - 1];
  if (e) {
    e.s = snapAll();
    e.mk = B.market ? { ...B.market } : null;
  }
}
function movePower(k, tk, M) {
  const fx = M.fx || {},
    d = A(tk);
  let P = M.p || 0;
  if (fx.vary === 'dyn') P = Math.round(40 + (60 * d.hp) / maxHp(d));
  if (fx.vary === 'short') P = Math.round(40 + 80 * (1 - d.hp / maxHp(d)));
  if (fx.hold) P = Math.min(RB.holdCap, 40 * 2 ** Math.max(0, FV(k).holdN - 1));
  return P;
}
function dmgCalc(k, tk, mid, src) {
  const M = MOVES[mid],
    fx = M.fx || {};
  const P = src ? M.p || 90 : movePower(k, tk, M);
  const phys = M.c === 'H',
    At = src ? src.A : statE(k, phys ? 'lev' : 'lob'),
    Dt = statE(tk, phys ? 'law' : 'pr'),
    L = src ? src.lvl : A(k).lvl,
    aty = src ? src.ty : types(k);
  const base = ((0.4 * L + 2) * P * At) / Dt / 50 + 2;
  const stab = M.t !== 'None' && aty.includes(M.t) ? RB.stab : 1,
    te = eff(M.t, types(tk));
  const cs = (fx.crit || 0) + (hasPassive(aty, 'sharp') ? RB.mediaCrit : 0);
  const crit = !src && rnd() < RB.critChances[clamp(cs, 0, RB.critChances.length - 1)];
  const roll = hasPassive(aty, 'volatile')
    ? RB.cryptoRollMin + rnd() * (RB.cryptoRollMax - RB.cryptoRollMin)
    : RB.rollMin + rnd() * (1 - RB.rollMin);
  const mk = B.market && M.t === RB.shockType ? RB.oilShockMult : 1;
  let eco = 1;
  if (!src) {
    const syn = aty.filter(t => PASSIVE[t] === 'synergy');
    if (syn.length) {
      const sd = B.sides[ASIDE[k]],
        me = A(k);
      eco =
        1 +
        RB.retailSynergy *
          sd.team.filter(m => m !== me && m.hp > 0 && m.job == null && SP[m.sp].types.some(t => syn.includes(t)))
            .length;
    }
  }
  const wx =
    typeof battleWeatherMult === 'function' ? battleWeatherMult(M.t) : 1; /* v28: the weather where you stand */
  return { dmg: Math.max(1, Math.floor(base * stab * te * roll * (crit ? RB.critMult : 1) * mk * eco * wx)), te, crit };
}
function stage(k, obj) {
  const v = FV(k),
    m = A(k);
  for (const s2 in obj) {
    const d = obj[s2],
      o = v.st[s2] || 0;
    v.st[s2] = clamp(o + d, -RB.stageMax, RB.stageMax);
    if (v.st[s2] === o) say(`${N(m)}’s ${STATN[s2]} won’t go any ${d > 0 ? 'higher' : 'lower'}.`);
    else
      say(`${N(m)}’s ${STATN[s2]} ${d > 0 ? 'rose' : 'fell'}${Math.abs(d) > 1 ? ' sharply' : ''}.`, {
        k: 'stat',
        si: k,
        up: d > 0,
      });
  }
}
function inflict(tk, st, loud) {
  const t = A(tk);
  if (t.status) {
    if (loud) say(`But ${N(t)} is already ${(STATUSN[t.status] || 'affected').toLowerCase()}.`);
    return;
  }
  if (t.boss && st === 'sub' && rnd() < (RB.alphaSleepResist ?? 0.5)) {
    say(`${N(t)} shrugged it off. Alphas don’t nod off easily.`);
    return;
  }
  t.status = st;
  if (st === 'sub') t.sTurns = RB.subpoenaMin + Math.floor(rnd() * (RB.subpoenaMax - RB.subpoenaMin + 1));
  say(
    `${N(t)} ${st === 'aud' ? 'is paralyzed. It may be unable to move' : st === 'sub' ? 'fell asleep' : st === 'scn' ? 'was burned' : 'is ' + (STATUSN[st] || st)}.`,
    { k: 'status', si: tk, st }
  );
}
/* a move aimed at a fighter who has gone down turns to another fighter on that side */
function retarget(k, tk) {
  const fs = foeSide(k);
  if (tk != null && A(tk) && A(tk).hp > 0 && ASIDE[tk] === fs) return tk;
  const L = liveK(fs);
  if (!L.length) return null;
  return L[Math.floor(rnd() * L.length)];
}
function useMove(k, mid, tk0) {
  const u = A(k),
    v = FV(k),
    M = MOVES[mid],
    fx = M.fx || {};
  if (u.status === 'sub') {
    u.sTurns--;
    if (u.sTurns > 0) {
      say(`${N(u)} is fast asleep.`, { k: 'status', si: k, st: 'sub' });
      return;
    }
    u.status = null;
    say(`${N(u)} woke up.`);
  }
  if (u.status === 'aud' && rnd() < RB.auditSkip) {
    say(`${N(u)} is paralyzed and can’t move.`, { k: 'status', si: k, st: 'aud' });
    return;
  }
  if (v.hyped > 0) {
    v.hyped--;
    if (rnd() < RB.hypeSelfHit) {
      const dm = Math.max(1, Math.floor(((0.4 * u.lvl + 2) * 40 * statE(k, 'lev')) / statE(k, 'law') / 50 + 2));
      u.hp = Math.max(0, u.hp - dm);
      say(`${N(u)} is confused and hurt itself.`, { k: 'hurt', si: k, dmg: dm });
      return;
    }
    if (v.hyped === 0) say(`${N(u)} snapped out of its confusion.`);
  }
  const onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe;
  const tk = onFoe ? retarget(k, tk0) : k;
  if (onFoe && tk == null) return;
  const t = A(tk),
    td = B.sides[ASIDE[tk]];
  /* spread moves hit every fighter on the other side (a little weaker when there's more than one) */
  const spread = onFoe && fx.spread && liveK(foeSide(k)).length > 1;
  const ev = say(`${N(u)} used ${M.n}${isMulti() && onFoe && !spread ? ` on ${N(t)}` : ''}.`, {
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
      say('But it failed. You can’t guard twice in a row.');
      return;
    }
    v.last = mid;
    v.protect = true;
    ev.an.protect = true;
    say(`${N(u)} braced itself.`);
    return;
  }
  v.last = mid;
  if (!onFoe) ev.an.self = true;
  const targets = spread ? liveK(foeSide(k)) : [tk];
  for (const tk2 of targets) {
    const t2 = A(tk2),
      fv2 = FV(tk2);
    if (!t2 || t2.hp <= 0) continue;
    if (onFoe && fv2.protect) {
      if (tk2 === tk) ev.an.blocked = true;
      say(`${N(t2)} protected itself.`, tk2 === tk ? null : { k: 'hurt', si: tk2, dmg: 0, fx: 'block' });
      continue;
    }
    if (onFoe && M.a && rnd() * 100 >= M.a) {
      if (tk2 === tk) ev.an.miss = true;
      say(`${N(u)} missed${spread ? ' ' + N(t2) : ''}.`);
      if (fx.missCost && tk2 === targets[0]) {
        const dm = Math.floor(maxHp(u) * fx.missCost);
        u.hp = Math.max(0, u.hp - dm);
        say(`${N(u)} crashed and lost ${Math.round(fx.missCost * 100)}% of its HP.`, { k: 'hurt', si: k, dmg: dm });
      }
      continue;
    }
    if (fx.delay) {
      ev.an.self = true;
      B.sides[ASIDE[tk2]].mail.push({
        n: RB.mailTurns,
        A: statE(k, 'lev'),
        lvl: u.lvl,
        ty: types(k).slice(),
        from: N(u),
        mid,
        side: ASIDE[k],
      });
      say(`${N(u)} foresaw an attack. It lands in ${plural(RB.mailTurns, 'turn')}.`);
      continue;
    }
    if (M.c !== 'X') {
      const r = dmgCalc(k, tk2, mid);
      if (spread) r.dmg = Math.max(1, Math.floor(r.dmg * (RB.spreadMult ?? 0.75)));
      if (fv2.shield > 0) {
        r.dmg = Math.max(1, Math.floor(r.dmg * (RB.alphaShieldMult ?? 0.5)));
        r.shield = 1;
      }
      t2.hp = Math.max(0, t2.hp - r.dmg);
      alphaPhase(tk2);
      if (tk2 === tk) Object.assign(ev.an, { dmg: r.dmg, te: r.te, crit: r.crit });
      else say(`${N(t2)} was hit too.`, { k: 'hurt', si: tk2, dmg: r.dmg, te: r.te, fx: 'spread', t: M.t });
      upd();
      if (r.shield) say(`The shield took the edge off.`, { k: 'block', si: tk2 });
      if (r.crit) say('A critical hit!', { k: 'crit', si: tk2 });
      if (r.te > 1) say('It’s super effective!');
      else if (r.te < 1) say('It’s not very effective.');
      if (fx.drain && u.hp < maxHp(u)) {
        const g = Math.max(1, Math.floor(r.dmg * fx.drain));
        u.hp = Math.min(maxHp(u), u.hp + g);
        say(`${N(u)} drained some HP.`, { k: 'heal', si: k, amt: g });
      }
      if (fx.heal && u.hp < maxHp(u)) {
        const g = Math.floor(maxHp(u) * fx.heal);
        u.hp = Math.min(maxHp(u), u.hp + g);
        say(`${N(u)} restored some HP.`, { k: 'heal', si: k, amt: g });
      }
    }
    if (t2.hp > 0 && onFoe) {
      if (fx.status && (M.c === 'X' || rnd() * 100 < (fx.chance || 100))) inflict(tk2, fx.status, M.c === 'X');
      if (fx.tgtStage) stage(tk2, fx.tgtStage);
      if (fx.hype) {
        if (fv2.hyped > 0) say('But it failed.');
        else {
          fv2.hyped = RB.hypeTurns;
          say(`${N(t2)} became confused.`, { k: 'hype', si: tk2 });
        }
      }
      if (fx.spin) {
        fv2.ov = [RB.spinType];
        fv2.ovT = RB.spinTurns;
        say(`${N(t2)} was soaked and became ${RB.spinType} type.`, { k: 'stat', si: tk2, up: false });
      }
      if (fx.wipe) {
        let any = false;
        for (const s2 in fv2.st)
          if (fv2.st[s2] > 0) {
            fv2.st[s2] = 0;
            any = true;
          }
        say(any ? `${N(t2)}’s stat boosts were wiped away.` : `${N(t2)} had no boosts to wipe.`);
      }
    }
  }
  if (fx.delay || (!spread && ev.an && (ev.an.miss || ev.an.blocked))) return;
  if (fx.selfStage && (!fx.selfChance || rnd() * 100 < fx.selfChance)) stage(k, fx.selfStage);
  if (fx.selfStatus && u.hp > 0 && !u.status && rnd() * 100 < (fx.selfChance || 100)) {
    u.status = fx.selfStatus;
    say(`${N(u)} hurt itself and is now ${(STATUSN[fx.selfStatus] || 'troubled').toLowerCase()}.`, {
      k: 'status',
      si: k,
      st: fx.selfStatus,
    });
  }
  if (M.c === 'X' && fx.heal) {
    if (u.hp >= maxHp(u)) say('But its HP is already full.');
    else {
      const g = Math.min(maxHp(u) - u.hp, Math.floor(maxHp(u) * fx.heal));
      u.hp += g;
      say(`${N(u)} restored its health.`, { k: 'heal', si: k, amt: g });
    }
  }
  if (fx.rent) {
    if (td.rent) {
      if (M.c === 'X') say('Sharp stones are already scattered there.');
    } else {
      td.rent = true;
      say(`Sharp stones are scattered around ${ASIDE[k] === 0 ? 'their' : 'your'} side.`);
    }
  }
  if (fx.market) {
    B.market = { k: 'sand', n: RB.shockTurns };
    say(`A ${shockName().toLowerCase()} kicked up.`, { k: 'market' });
  }
}
function endTurn() {
  const fr = Math.max(2, RB.drainFraction);
  for (const k of allK()) {
    const f = FT(k),
      m = A(k);
    if (!m || m.hp <= 0) continue;
    const ty = types(k),
      mx = maxHp(m);
    if (f.v && f.v.shield > 0) {
      f.v.shield--;
      if (!f.v.shield) say(`${N(m)}’s shield fades.`, { k: 'stat', si: k, up: false });
    }
    if (m.status === 'scn') {
      const d = Math.max(1, Math.floor(mx / fr));
      m.hp = Math.max(0, m.hp - d);
      say(`${N(m)} is hurt by its burn.`, { k: 'hurt', si: k, fx: 'scn', dmg: d });
    }
    if (m.hp > 0 && B.market && !ty.includes(RB.shockType)) {
      const d = Math.max(1, Math.floor(mx / fr));
      m.hp = Math.max(0, m.hp - d);
      say(`${N(m)} is buffeted by the ${shockName().toLowerCase()}.`, { k: 'hurt', si: k, fx: 'oil', dmg: d });
    }
    if (m.hp > 0 && hasPassive(ty, 'subsidy') && m.hp < mx) {
      const g = Math.min(mx - m.hp, Math.max(1, Math.floor(mx / fr)));
      m.hp += g;
      say(`${N(m)} regrew a little HP.`, { k: 'heal', si: k, amt: g });
    }
    f.v.turnsIn++;
    f.v.protect = false;
    if (f.v.ovT > 0 && --f.v.ovT === 0) {
      f.v.ov = null;
      say(`${N(m)} dried off and is back to its own type.`);
    }
  }
  for (const si of [0, 1]) {
    const sd = B.sides[si];
    sd.mail = sd.mail.filter(h => {
      if (--h.n > 0) return true;
      const L = liveK(si),
        tk = L[0];
      const t = tk != null ? A(tk) : null;
      if (t && t.hp > 0) {
        const r = dmgCalc(AK(1 - si, 0), tk, h.mid || 'twoday', h);
        t.hp = Math.max(0, t.hp - r.dmg);
        say(`${h.from}’s ${(MOVES[h.mid] || MOVES.twoday || { n: 'attack' }).n} struck ${N(t)}.`, {
          k: 'hurt',
          si: tk,
          fx: 'mail',
          te: r.te,
          dmg: r.dmg,
        });
        if (r.te > 1) say('It’s super effective!');
        else if (r.te < 1) say('It’s not very effective.');
      }
      return false;
    });
  }
  if (B.market && --B.market.n <= 0) {
    B.market = null;
    say(`The ${shockName().toLowerCase()} died down.`, { k: 'marketEnd' });
  }
}
function award(e) {
  const P = RULES.progression,
    amt = Math.floor(
      ((SP[e.sp].yld * e.lvl) / 7) * (B.kind === 'trainer' ? P.trainerXpMult : 1) * (e.boss ? (RB.alphaXp ?? 3) : 1)
    );
  const on = liveK(0).map(k => A(k));
  on.forEach(m => {
    const k = allK().find(q => A(q) === m);
    say(`${N(m)} gained ${fmt(amt)} XP.`, { k: 'xp', si: k });
    gainXp(m, amt, say);
  });
  const share = Math.floor(amt * P.teamXpShare),
    rest = S.team.filter(m => !on.includes(m) && m.hp > 0 && m.job == null);
  if (rest.length && share > 0) {
    rest.forEach(m => gainXp(m, share, () => {}));
    say(`The rest of the team gained ${fmt(share)} XP.`);
  }
}
function inherit(k) {
  const sd = B.sides[ASIDE[k]];
  if (!hasPassive(SP[A(k).sp].types, 'inherit')) return;
  const st = {};
  let any = false;
  for (const s2 in FV(k).st)
    if (FV(k).st[s2] > 0) {
      st[s2] = FV(k).st[s2];
      any = true;
    }
  if (any) sd.inh = st;
}
/* who on a side could still come in: alive, not at work, not on the field and not already called in this turn */
function bench(si, also = []) {
  const sd = B.sides[si],
    on = sd.f.filter(f => f.on).map(f => f.act);
  return sd.team
    .map((m, i) => i)
    .filter(i => {
      const m = sd.team[i];
      return m.hp > 0 && m.job == null && !on.includes(i) && !also.includes(i);
    });
}
export function doSwitch(k, idx) {
  const sd = B.sides[ASIDE[k]],
    f = FT(k);
  f.act = idx;
  f.on = true;
  f.down = false;
  const inh = sd.inh;
  f.v = freshV();
  sd.inh = null;
  const m = A(k);
  say(ASIDE[k] === 0 ? `Go, ${N(m)}!` : `${B.foeName || 'The wild side'} sent out ${N(m)}.`, { k: 'enter', si: k });
  S.seen[m.sp] = 1;
  if (sd.rent && !hasPassive(SP[m.sp].types, 'landlord')) {
    const d = Math.max(1, Math.floor(maxHp(m) / Math.max(2, RB.rentFraction)));
    m.hp = Math.max(0, m.hp - d);
    say(`${N(m)} was hurt by the sharp stones.`, { k: 'hurt', si: k, fx: 'rent', dmg: d });
  }
  if (inh) {
    Object.assign(f.v.st, inh);
    say(`${N(m)} took up its teammate’s boosts.`, { k: 'stat', si: k, up: true });
  }
}
export function checkFaints() {
  let any = false;
  for (const k of allK().filter(k => ASIDE[k] === 1)) {
    const e = A(k),
      f = FT(k);
    if (!e || e.hp > 0 || f.down) continue;
    f.down = true;
    any = true;
    e.status = null;
    say(`${N(e)} fainted.`, { k: 'faint', si: k });
    award(e);
    inherit(k);
    const nx = bench(1)[0];
    if (nx == null) f.on = false;
    else if (!B.over) doSwitch(k, nx);
  }
  if (!liveK(1).length && !B.over) B.over = 'win';
  for (const k of allK().filter(k => ASIDE[k] === 0)) {
    const p = A(k),
      f = FT(k);
    if (!p || p.hp > 0 || f.down) continue;
    f.down = true;
    any = true;
    p.status = null;
    p.sTurns = 0;
    say(`${N(p)} fainted.`, { k: 'faint', si: k });
    inherit(k);
    const pend = (B.needSwitch || []).length;
    if (bench(0).length > pend) {
      if (!B.over) (B.needSwitch || (B.needSwitch = [])).push(k);
    } else f.on = false;
  }
  if (!B.over && !liveK(0).length && !(B.needSwitch || []).length) B.over = 'lose';
  if (any && !B.over && liveK(1).some(k => A(k).hp <= 0)) checkFaints();
  return any;
}
/* how much a move is worth against one target, for the computer's choices */
/* v34: an Alpha has two phases. Brought below half its HP it raises a shield (half damage for a couple of turns),
   its eyes go red and it hits harder from then on (RULES.battle.alphaShield*) */
function alphaPhase(k) {
  const m = A(k);
  if (!m || !m.boss || m.hp <= 0 || m.boss.ph2 || m.hp > maxHp(m) * (RB.alphaPhaseAt ?? 0.5)) return;
  m.boss.ph2 = true;
  const v = FV(k);
  v.shield = RB.alphaShieldTurns ?? 2;
  say(`${N(m)} is furious! A golden shield rises around it.`, { k: 'alphaPhase', si: k });
  stage(k, { lev: 1, lob: 1 });
}
/* a rough damage figure for the AI (no rolls): how much of the target's HP a move would take */
function aiDmg(k, id, tk) {
  const M = MOVES[id];
  if (!M || M.c === 'X') return 0;
  const phys = M.c === 'H',
    L = A(k).lvl,
    P = M.p || 60;
  return (
    (((0.4 * L + 2) * P * statE(k, phys ? 'lev' : 'lob')) / statE(tk, phys ? 'law' : 'pr') / 50 + 2) *
    (M.t !== 'None' && types(k).includes(M.t) ? RB.stab : 1) *
    eff(M.t, types(tk))
  );
}
function aiScore(k, id, tk) {
  const M = MOVES[id],
    fx = M.fx || {},
    m = A(k),
    t = A(tk);
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
      (((P * (M.t !== 'None' && types(k).includes(M.t) ? RB.stab : 1) * eff(M.t, types(tk)) * (M.a || 100)) / 100) *
        statE(k, phys ? 'lev' : 'lob')) /
      statE(tk, phys ? 'law' : 'pr');
    if (t.hp <= s * 0.6) s *= 1.4;
    /* finish off a fighter that's nearly down */ if (fx.spread && liveK(ASIDE[tk]).length > 1) s *= 1.5;
  } else if (fx.status) s = t.status ? 0 : 45;
  else if (fx.hype) s = FV(tk).hyped ? 0 : 35;
  else if (fx.heal) s = m.hp < maxHp(m) * 0.5 ? 90 : 0;
  else if (fx.protect) s = FV(k).last === id ? 0 : 12;
  else if (fx.rent) s = B.sides[ASIDE[tk]].rent ? 0 : 30;
  else if (fx.market) s = B.market ? 0 : 40;
  else if (fx.selfStage) s = Object.keys(fx.selfStage).some(q => FV(k).st[q] < 2) ? 28 : 0;
  else if (fx.tgtStage) s = 22;
  else if (fx.spin) s = FV(tk).ov ? 0 : 20;
  else s = 0;
  return s + 5;
}
function chooseAI(k = 1) {
  const m = A(k);
  if (!m || m.hp <= 0) return null;
  const T = liveK(foeSide(k));
  if (!T.length) return null;
  const opts = [];
  for (const id of m.moves.filter(id => MOVES[id]))
    for (const tk of T) opts.push([{ mid: id, tk }, aiScore(k, id, tk)]);
  if (!opts.length) return null;
  /* v34: in a double the second foe knows what its partner is about to do: no piling onto a fighter that's already
    going down, a spread move is worth more while both of yours stand, and a status move isn't doubled up */
  const PL = B.aiPlan || (B.aiPlan = {});
  if (B.fmt === 'double') {
    for (const o of opts) {
      const c = o[0],
        M = MOVES[c.mid],
        t = A(c.tk),
        pre = PL[c.tk] || 0;
      if (!t) continue;
      if (M.c !== 'X' && pre >= t.hp) o[1] *= 0.3;
      else if (M.c !== 'X' && pre + aiDmg(k, c.mid, c.tk) >= t.hp) o[1] *= 1.35;
      if (M.c === 'X' && (M.fx || {}).status && PL['st' + c.tk]) o[1] *= 0.2;
    }
  }
  let pick;
  if ((B.kind === 'trainer' || m.boss) && rnd() < RB.aiSmart) {
    opts.sort((a, b) => b[1] - a[1]);
    pick = opts[0][0];
  } else pick = pickW(opts);
  if (pick) {
    const M = MOVES[pick.mid];
    if (M.c !== 'X') {
      const tg = (M.fx || {}).spread ? liveK(foeSide(k)) : [pick.tk];
      for (const t of tg) PL[t] = (PL[t] || 0) + aiDmg(k, pick.mid, t);
    } else if ((M.fx || {}).status) PL['st' + pick.tk] = 1;
  }
  return pick;
}
/* fmt: 'single', 'double' (two a side) or 'alpha' (up to three of yours against one Alpha) */
function newBattle(kind, foe, extra) {
  const able = S.team.map((m, i) => i).filter(i => S.team[i].hp > 0 && S.team[i].job == null);
  if (!able.length) {
    toast('Everyone on your team has fainted. Rest first, or use a Revive.');
    return false;
  }
  const fmt = (extra && extra.fmt) || 'single',
    n0 = Math.min(able.length, fmt === 'double' ? 2 : fmt === 'alpha' ? (RB.alphaTeam ?? 3) : 1),
    n1 = fmt === 'double' ? Math.min(2, foe.length) : 1;
  const fighters = (n, list) =>
    Array.from({ length: n }, (_, sl) => ({ act: list[sl], on: list[sl] != null, v: freshV(), down: false }));
  B = Object.assign(
    {
      kind,
      fmt,
      events: [],
      ev: 0,
      phase: 'playing',
      market: null,
      integrity: 1,
      over: null,
      needSwitch: [],
      offer: null,
      foeName: '',
      lead: S.team[able[0]].uid,
      turn: 0,
      plan: [],
      cur: 0,
      sides: [
        { team: S.team, f: fighters(n0, able), rent: false, pivot: false, mail: [], inh: null },
        {
          team: foe,
          f: fighters(
            n1,
            foe.map((m, i) => i)
          ),
          rent: false,
          pivot: false,
          mail: [],
          inh: null,
        },
      ],
    },
    extra,
    { fmt }
  );
  Object.defineProperty(B.sides[0], 'act', {
    get() {
      return this.f[0].act;
    },
    set(v) {
      this.f[0].act = v;
    },
    enumerable: false,
  });
  Object.defineProperty(B.sides[1], 'act', {
    get() {
      return this.f[0].act;
    },
    set(v) {
      this.f[0].act = v;
    },
    enumerable: false,
  });
  foe.forEach(m => (S.seen[m.sp] = 1));
  return true;
}
const goNames = K => {
  const n = K.map(k => N(A(k)));
  return n.length < 2 ? n[0] : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
};
/* an Alpha: the same billionaire, bigger, tougher and stronger for the fight (RULES.battle.alpha*) */
function makeAlpha(sp, lvl, o = {}) {
  const m = makeMon(sp, lvl + (RB.alphaLevels ?? 3), o);
  m.boss = { hp: RB.alphaHp ?? 3, st: RB.alphaStats ?? 1.3 };
  m.hp = maxHp(m);
  return m;
}
export function startWild(q) {
  const foe = q.alpha ? makeAlpha(q.sp, q.lvl, { gold: q.gold }) : makeMon(q.sp, q.lvl, { gold: q.gold });
  if (!newBattle('wild', [foe], { qid: q.id, area: areaKey(), fmt: q.alpha ? 'alpha' : 'single' })) return;
  const nm = SP[q.sp].name;
  if (q.alpha) {
    say(`An Alpha ${q.gold ? 'Golden ' : ''}${nm} rose out of the grass!`, { k: 'wild', alpha: 1 });
    say(`“${nm}!!”`, { k: 'cry', si: 1 });
    say(`It’s huge, and it acts twice a turn. Your team steps up together.`);
  } else {
    say(`A wild ${q.gold ? 'Golden ' : ''}${nm} appeared.`, { k: 'wild' });
    say(`“${nm}!”`, { k: 'cry', si: 1 });
  }
  if (q.gold) say(`It shimmers. Golden Billies turn up once in ${fmt(RULES.steps.goldOdds)}.`);
  if (RC.luxury.includes(SP[q.sp].line))
    say(`It looks too picky for ${COINS.penny ? 'a ' + COINS.penny.n : 'cheap coins'}.`);
  const K = liveK(0);
  K.forEach((k, n) => say(n ? '' : `Go, ${goNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  openBattle();
}
export function startTrainer(id, o = {}) {
  const T = TRAINERS[id];
  if (!T) return;
  const team = trainerTeam(T);
  if (!team.length) {
    toast(`${T.name} has no team yet. Add one in Pocket Billies Studio.`);
    return;
  }
  const dbl = (T.double || o.double) && team.length >= 2 && S.team.filter(m => m.hp > 0 && m.job == null).length >= 1;
  if (
    !newBattle('trainer', team, {
      tid: id,
      foeName: T.name,
      T,
      area: BACKDROPS[T.area] ? T.area : areaKey(),
      fmt: dbl ? 'double' : 'single',
    })
  )
    return;
  say(dbl ? `${T.name} wants a double battle!` : `${T.name} wants to battle.`, { k: 'trainerIn', who: T.who });
  if (!o.talked)
    (T.lines || []).forEach((l, i) => {
      say(l).face = { who: T.who, expr: i ? null : 'happy' };
    });
  if (T.market) {
    B.market = { k: 'sand', n: T.market.n || RB.shockTurns };
    say(T.marketText || `The battle opened in a ${shockName().toLowerCase()}.`, { k: 'market' });
  }
  const F = liveK(1);
  F.forEach((k, n) => say(n ? '' : `${T.name} sent out ${goNames(F)}.`, { k: 'enter', si: k, quiet: n > 0 }));
  const K = liveK(0);
  K.forEach((k, n) => say(n ? '' : `Go, ${goNames(K)}!`, { k: 'enter', si: k, quiet: n > 0 }));
  openBattle();
}
export function areaKey() {
  return hereStop().area;
}
/* one turn. plan: what each of your fighters does ({who,k:'move',mid,tk} | {who,k:'switch',i} | {who,k:'item',item,uid})
   or a single {k:'run'}. An older single action ({k:'move',mid}) is your first fighter's. */
export function runTurn(plan) {
  B.events = [];
  B.ev = 0;
  B.needSwitch = [];
  B.turn++;
  B.aiPlan = {};
  if (!Array.isArray(plan)) plan = [Object.assign({ who: 0 }, plan)];
  if (plan.some(p => p.k === 'run')) {
    say('You got away safely.', { k: 'run' });
    B.over = 'ran';
    return play();
  }
  for (const p of plan.filter(p => p.k === 'switch')) {
    const out = A(p.who);
    if (!out) continue;
    const free = hasPassive(types(p.who), 'pivot') && !B.sides[0].pivot;
    if (free) B.sides[0].pivot = true;
    say(free ? `${N(out)} darted out without losing the turn.` : `${N(out)}, come back.`, { k: 'recall', si: p.who });
    doSwitch(p.who, p.i);
    p.free = free;
  }
  checkFaints();
  if (B.over) return play();
  if (plan.length === 1 && plan[0].k === 'switch' && plan[0].free) return play();
  for (const p of plan.filter(p => p.k === 'item')) applyItem(p.item, p.uid, true);
  const acts = [];
  for (const p of plan.filter(p => p.k === 'move')) acts.push({ who: p.who, mid: p.mid, tk: p.tk });
  for (const k of liveK(1)) {
    const n = A(k).boss ? (RB.alphaActs ?? 2) : 1;
    for (let i = 0; i < n; i++) {
      const c = chooseAI(k);
      if (c) acts.push({ who: k, mid: c.mid, tk: c.tk, boss2: i > 0 });
    }
  }
  acts.forEach(a => (a.r = rnd()));
  acts.sort(
    (a, b) =>
      (MOVES[b.mid].pr || 0) - (MOVES[a.mid].pr || 0) ||
      (a.boss2 ? 1 : 0) - (b.boss2 ? 1 : 0) ||
      statE(b.who, 'hus') - statE(a.who, 'hus') ||
      a.r - b.r
  );
  for (const a of acts) {
    if (B.over) break;
    const u = A(a.who);
    if (!u || u.hp <= 0 || FT(a.who).down) continue;
    if (!liveK(foeSide(a.who)).length) break;
    useMove(a.who, a.mid, a.tk);
    checkFaints();
  }
  if (!B.over) {
    endTurn();
    checkFaints();
  }
  play();
}
export function enemyOnly() {
  B.aiPlan = {};
  for (const k of liveK(1)) {
    const n = A(k).boss ? (RB.alphaActs ?? 2) : 1;
    for (let i = 0; i < n && !B.over; i++) {
      const c = chooseAI(k);
      if (c) {
        useMove(k, c.mid, c.tk);
        checkFaints();
      }
    }
  }
  if (!B.over) {
    endTurn();
    checkFaints();
  }
}
function catchOdds(id, T, spin) {
  const e = A(1);
  if (COINS[id] && COINS[id].m === 0) return 1;
  let C = COINS[id].m;
  if (id === 'penny' && RC.luxury.includes(SP[e.sp].line)) C *= RC.luxuryPenny;
  const Sx = e.status === 'sub' ? RC.subpoena : e.status ? RC.status : 1;
  return Math.min(
    1,
    SP[e.sp].cr *
      (1 - (RC.hpFactor * e.hp) / maxHp(e)) *
      C *
      Sx *
      T *
      (spin ? RC.spin : 1) *
      B.integrity *
      (e.boss ? (RC.alpha ?? 0.4) : 1)
  );
}
function catchRoll(id, T, spin) {
  if (U.dbgCatch) return { caught: true, w: 3, edge: false, P: 1 };
  if (COINS[id].m === 0) return { caught: true, w: 3, edge: false, P: 1 };
  if (rnd() < RC.edge) return { caught: true, w: 1, edge: true, P: 1 };
  const P = catchOdds(id, T, spin);
  const q = Math.cbrt(P);
  let w = 0;
  while (w < 3 && rnd() < q) w++;
  return { caught: w === 3, w, edge: false, P };
}
export const teamNeedsHp = () => S.team.some(m => m.hp > 0 && m.hp < maxHp(m) && m.job == null);
export const canUse = (it, m) => {
  const I = ITEMS[it];
  if (!I || !S.items[it] || I.evoItem) return false;
  if (I.revive) return m.hp <= 0;
  if (m.hp <= 0) return false;
  if (I.hpAll) return teamNeedsHp();
  const hurt = m.hp < maxHp(m);
  if (I.cure) return (I.cure === 'any' ? !!m.status : m.status === I.cure) || (!!I.hp && hurt);
  if (I.hp) return hurt;
  return false;
};
export function applyItem(it, id, inB) {
  const I = ITEMS[it],
    m = findMon(id);
  if (!m || !canUse(it, m)) return false;
  S.items[it]--;
  const t = [];
  let healed = 0;
  if (I.revive) {
    m.hp = Math.max(1, Math.floor(maxHp(m) * I.revive));
    m.status = null;
    m.sTurns = 0;
    t.push(`${N(m)} was revived.`);
    healed = m.hp;
  } else {
    if (I.cure && m.status && (I.cure === 'any' || m.status === I.cure)) {
      const was = m.status;
      m.status = null;
      m.sTurns = 0;
      t.push(`${N(m)} is no longer ${(STATUSN[was] || 'troubled').toLowerCase()}.`);
    }
    if (I.hp) {
      const g = Math.min(I.hp, maxHp(m) - m.hp);
      if (g > 0) {
        m.hp += g;
        healed = g;
        t.push(`${N(m)} recovered ${g} HP.`);
      }
    }
    if (I.hpAll) {
      let n = 0;
      S.team.forEach(x => {
        if (x.hp > 0 && x.job == null) {
          const g = Math.min(I.hpAll, maxHp(x) - x.hp);
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
    say(`You used ${/^[AEIOU]/.test(I.n) ? 'an' : 'a'} ${I.n}.`, { k: 'item', it });
    const kOn = allK().find(k => ASIDE[k] === 0 && A(k) === m),
      onField = kOn != null || I.hpAll;
    t.forEach((x, i) => say(x, i === 0 && onField ? { k: 'heal', si: kOn ?? 0, amt: healed || undefined } : null));
  } else toast(t.join(' '));
  save();
  return true;
}

/* ================= BATTLE UI =================
   The stage fills the screen. Glass cards float over it: the foe card at the top, the dock (your card, the message and
   the commands) at the bottom in portrait or on the right in landscape. The stage frames the billionaires in the space left over. */
function battleMode() {
  const w = innerWidth,
    h = innerHeight;
  return w > h * 1.05 && w >= 600 ? 'landscape' : 'portrait';
}
function hcard(i) {
  return `<div class="hc-row"><b class="hc-n" id="n${i}"></b><span class="hc-gp" id="gp${i}" hidden>${uiIco('spark', 12)}</span><span class="hc-lv tnum" id="l${i}"></span></div>
 <div class="hc-row2"><span class="hc-t" id="t${i}"></span><span class="hc-st" id="st${i}"></span><span class="hc-sg" id="sg${i}"></span></div>
 <div class="hpbar"><span class="hpl">HP</span><div class="hpt"><i class="ghost" id="g${i}"></i><i class="fill" id="h${i}"></i></div></div>
 <div class="hc-row3">${i === 0 ? '<span class="hc-num tnum" id="hn0"></span>' : ''}<span class="hc-pips" id="pips${i}"></span></div>${i === 0 ? '<div class="xpbar"><i id="x0"></i></div>' : ''}`;
}
export function battleShell() {
  return `<div class="battle" id="battle" data-layout="${battleMode()}">
 <div class="bstage" id="stage">
  <div class="cam" id="camWorld"><canvas id="cvWorld"></canvas></div>
  <div class="cam fgcam" id="camFg"><canvas id="cvFg"></canvas></div>
  <div class="bloom" id="bloom"></div><div class="vign"></div><div class="lowhp" id="lowhp"></div><div class="flash" id="flash"></div>
  <div class="pops" id="pops" aria-hidden="true"></div>
  <div class="bplates" id="plates"></div>
 </div>
 <div class="ticker" aria-hidden="true"><div class="tk-in" id="tk"></div></div>
 <section class="hcard glassy foe" id="hb1" aria-label="Opponent">${hcard(1)}</section>
 <div class="mk glassy" id="mk"></div>
 <div class="dock glassy" id="dock">
  <section class="hcard glassy me" id="hb0" aria-label="Your Billie">${hcard(0)}</section>
  <button class="bmsg" id="msg" data-a="adv" aria-live="polite"><span id="msgT"></span><i class="more"></i></button>
  <div class="cmd" id="acts"></div>
 </div>
</div>`;
}
/* the part of the screen the HUD leaves open; the stage frames the action inside it */
function battleFreeArea(vw, vh, lay) {
  const b = $('#battle').getBoundingClientRect(),
    r = s => {
      const e = $(s);
      return e ? e.getBoundingClientRect() : null;
    },
    dock = r('#dock'),
    foe = r('#hb1'),
    tk = r('.ticker');
  if (lay === 'landscape') {
    const y0 = (tk ? tk.bottom - b.top : 0) + 4,
      x1 = (dock ? dock.left - b.left : vw) - 8;
    return { x: 0, y: y0, w: Math.max(160, x1), h: Math.max(120, vh - 8 - y0) };
  }
  const y0 = (foe ? foe.bottom - b.top : 64) + 2,
    y1 = (dock ? dock.top - b.top : vh * 0.62) - 4;
  return { x: 0, y: y0, w: vw, h: Math.max(120, y1 - y0) };
}
function battleLayoutChanged(L) {
  const bl = $('#bloom');
  if (bl) {
    const s = 70 * L.u;
    bl.style.width = bl.style.height = s + 'px';
    bl.style.left = L.fx + 162 * L.u - s / 2 + 'px';
    bl.style.top = L.fy + 34 * L.u - s / 2 + 'px';
    bl.hidden = !!AREAS[SC.area].indoor;
  }
}
export function battleResize() {
  const el = $('#battle');
  if (!el) return;
  const m = battleMode();
  if (el.dataset.layout !== m) el.dataset.layout = m;
  requestAnimationFrame(() => {
    scResize();
    if (B && B.phase !== 'playing') paintActions();
  });
}
function openBattle() {
  const bs = (S.preferences || {}).battleSpeed;
  if (bs && !U.dbgSpeed) SC.speed = bs === 'fast' ? 1.6 : bs === 'faster' ? 2.2 : 1;
  const area = B.area || 'grass',
    list = S.team.map(m => [m.sp, m.gold, KBACK]).concat(B.sides[1].team.map(m => [m.sp, m.gold, 1]));
  const b = B;
  Promise.all([scPrepare(area), rigPreload(list)])
    .then(() => {
      if (B !== b) return;
      const seam = battleSeamless();
      const go = () => {
        if (B !== b) return;
        /* the battle was closed during the wipe */ document.body.classList.add('in-battle');
        render();
        scStart(area);
        play();
        if (seam) battleRise();
      };
      if (seam) battleSwoop(go);
      else wipe(go);
    })
    .catch(e => {
      console.error(e);
      toast(e.message);
    });
}
/* v31: on the 3D stage a battle starts where you are, without a wipe: the camera swoops down toward the spot, the
   billionaire bursts out of the grass in a spray of leaves, then the battle's panels slide up over the same picture.
   When it's over they slide away and the camera pulls back out. The painted stage keeps the wipe. */
function battleSeamless() {
  return !RM && typeof battleGLWanted === 'function' && battleGLWanted() && U.tab === 'walk' && !U.inside && !U.bench;
}
function battleSwoop(go) {
  const P = DIO.pl,
    e = U.encAt;
  U.encAt = null;
  const fx = e ? P.x * 0.6 + e[0] * 0.4 : P.x,
    fz = e ? P.z * 0.6 + e[1] * 0.4 : P.z;
  DGL.swoop = { x: fx, z: fz, z0: DGL.zoomT };
  DGL.zoomT = Math.max(0.42, DGL.zoomT * 0.5);
  P.route = null;
  P.walk = 0;
  if (e) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * 6.283,
        sp = 0.8 + Math.random() * 2.2;
      DIO.parts.push({
        k: i % 4 ? 'leaf' : 'dust',
        fr: i % 3,
        x: e[0] + (Math.random() - 0.5) * 0.3,
        z: e[1] + (Math.random() - 0.5) * 0.2,
        y: 0.15,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp * 0.6,
        vy: 2.2 + Math.random() * 2.6,
        g: 7.5,
        life: 0,
        max: 0.8 + Math.random() * 0.5,
      });
    }
    if (typeof dglRing === 'function' && typeof dglWgAt === 'function' && dglWgAt(e[0], e[1])) dglRing(e[0], e[1], 1);
  }
  setTimeout(() => {
    const S0 = DGL.swoop;
    DGL.swoop = null;
    if (S0) DGL.zoomT = S0.z0;
    go();
  }, 720);
}
function battleRise() {
  const el = $('#battle');
  if (!el) return;
  el.classList.add('bt-rise');
  setTimeout(() => el.classList.remove('bt-rise'), 900);
}
function battleLeave(mid) {
  const el = $('#battle'),
    seam = !RM && typeof BGL !== 'undefined' && BGL.on && el;
  if (!seam) return wipe(mid);
  el.classList.add('bt-leave');
  setTimeout(() => {
    mid();
    if (typeof DGL !== 'undefined') {
      DGL.zoom = Math.max(0.42, (DGL.zoomT || 1) * 0.55);
    }
  }, 360);
}
function wipe(mid) {
  const w = $('#wipe');
  if (RM || !w) {
    mid();
    return;
  }
  w.className = 'wipe in';
  setTimeout(() => {
    mid();
    w.className = 'wipe out';
    setTimeout(() => {
      w.className = 'wipe';
    }, 460);
  }, 520);
}
export function stopTimers() {
  clearTimeout(U.evT);
  clearTimeout(U.hpT);
  clearInterval(U.typeT);
}
function typeText(t) {
  const el = $('#msgT');
  clearInterval(U.typeT);
  if (!el) return 0;
  if (RM) {
    el.textContent = t;
    U.typing = false;
    return 0;
  }
  el.textContent = '';
  let i = 0;
  U.typing = true;
  const sp = Math.max(1, Math.round(2 * SC.speed));
  U.typeT = setInterval(() => {
    i += sp;
    el.textContent = t.slice(0, i);
    if (i >= t.length) {
      clearInterval(U.typeT);
      U.typing = false;
    }
  }, 16);
  U.typeFull = t;
  return Math.ceil(t.length / sp) * 16;
}
export function play() {
  if (!B) return;
  B.phase = 'playing';
  B.ev = 0;
  paintActions();
  stepEv();
}
/* while a turn plays out, the command area shows the turn so far, so nothing is missed */
function logLine(i) {
  const el = $('#acts');
  if (!el || B.phase !== 'playing') return;
  let L = el.querySelector('.blog');
  if (!L) {
    el.innerHTML = '<ol class="blog" aria-hidden="true"></ol>';
    L = el.querySelector('.blog');
  }
  const prev = B.events
    .slice(Math.max(0, i - 4), i)
    .map(e => `<li>${esc(e.t)}</li>`)
    .join('');
  L.innerHTML =
    prev +
    (i < B.events.length - 1
      ? `<li class="next">${plural(B.events.length - 1 - i, 'more line')} this turn · tap to skip ahead</li>`
      : '');
}
function stepEv() {
  stopTimers();
  if (!B || !$('#msg')) return;
  if (B.ev >= B.events.length) return afterEvents();
  const ev = B.events[B.ev];
  logLine(B.ev);
  msgFace(ev.face);
  const tt = ev.t ? typeText(ev.t) : 0,
    r = ev.an ? scPlay(ev.an, ev) : { dur: 0, hit: 0 };
  if (ev.an && typeof sfxBattle === 'function') sfxBattle(ev.an, r);
  boxAnims(ev);
  const k = 1 / SC.speed;
  scAfter('hpT', r.hit >= 999 ? 0 : r.hit, 0, () => paintBoxes(ev.s, ev.mk, true));
  $('#msg').classList.remove('ready');
  U.evReady = false;
  /* the next line waits for the animation on the scene's own clock (a slow device draws fewer frames, so it takes
    longer in real time) as well as for the text to finish typing */
  scAfter('evT', r.dur + 120, tt + 120 * k, () => {
    U.evReady = true;
    $('#msg') && $('#msg').classList.add('ready');
    U.evT = setTimeout(adv, (RM ? 1300 : 820) * k);
  });
}
function scAfter(slot, sceneMs, realMs, fn) {
  const t0 = SC.t,
    r0 = performance.now();
  const tick = () => {
    if (!B) return;
    const el = performance.now() - r0,
      sOk =
        !SC.on || SC.t - t0 >= sceneMs || el > (sceneMs / SC.speed) * 3 + 1500 /* never stuck on a very slow device */,
      rOk = el >= realMs;
    if (sOk && rOk) {
      fn();
      return;
    }
    U[slot] = setTimeout(tick, 30);
  };
  U[slot] = setTimeout(tick, Math.max(0, Math.min(realMs, sceneMs / SC.speed)));
}
function adv() {
  if (!B || B.phase !== 'playing') return;
  B.ev++;
  stepEv();
}
/* who is talking: a portrait at the start of the message box */
function msgFace(f) {
  const m = $('#msg');
  if (!m) return;
  let el = m.querySelector('.msg-face');
  if (!f) {
    if (el) el.remove();
    m.classList.remove('has-face');
    return;
  }
  if (!el) {
    el = document.createElement('span');
    el.className = 'msg-face';
    m.prepend(el);
  }
  el.innerHTML = portraitHTML(f.who, 46, f.expr);
  m.classList.add('has-face');
}
export function tapMsg() {
  if (!B || B.phase !== 'playing' || !$('#msg')) return;
  if (U.typing) {
    clearInterval(U.typeT);
    U.typing = false;
    $('#msgT').textContent = U.typeFull || '';
    return;
  }
  if (U.evReady) adv();
}
function boxShow(i, on) {
  const b = $('#hb' + i);
  if (b) b.classList.toggle('on', on);
}
function boxAnims(ev) {
  const an = ev.an;
  if (!an) return;
  if (an.k === 'trainerIn') {
    boxShow(0, false);
    boxShow(1, false);
  }
  if (an.k === 'wild')
    setTimeout(() => {
      paintBoxes(ev.s, ev.mk, false);
      boxShow(1, true);
    }, 620);
  if (an.k === 'enter')
    setTimeout(() => {
      paintSide(an.si, ev.s[an.si], false);
      boxShow(an.si, true);
    }, 420);
  if (an.k === 'faint') setTimeout(() => boxShow(an.si, false), 520);
  if (an.k === 'recall') setTimeout(() => boxShow(an.si, false), 200);
}
function countTo(el, to, dur = 600) {
  if (!el) return;
  const from = +(el.dataset.v || to);
  el.dataset.v = to;
  const show = v => (el.textContent = el.dataset.fmt ? el.dataset.fmt.replace('#', v) : v);
  if (from === to || RM) {
    show(to);
    return;
  }
  const t0 = performance.now();
  const st = () => {
    const k = Math.min(1, (performance.now() - t0) / dur),
      v = Math.round(from + (to - from) * EASE.out(k));
    show(v);
    if (k < 1) requestAnimationFrame(st);
  };
  st();
}
const STG = k => (STATN[k] || k).slice(0, 3).toUpperCase();
function paintSide(i, s, anim) {
  if (!s) return;
  const n = $('#n' + i);
  if (!n) return;
  n.textContent = s.name;
  $('#l' + i).textContent = `Lv ${s.lvl}`;
  $('#t' + i).innerHTML = s.ty.map(chip).join('');
  $('#gp' + i).hidden = !s.gold;
  $('#st' + i).innerHTML = s.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : stBadge(s.st);
  $('#sg' + i).innerHTML = Object.entries(s.stg || {})
    .filter(([k, v]) => v)
    .map(([k, v]) => `<span class="stg ${v > 0 ? 'up' : 'dn'}">${STG(k)} ${v > 0 ? '+' : ''}${v}</span>`)
    .join('');
  const p = Math.max(0, (s.hp / s.max) * 100),
    h = $('#h' + i),
    g = $('#g' + i);
  if (h.dataset.k !== s.uid) {
    h.dataset.k = s.uid;
    for (const e of [h, g]) {
      e.style.transition = 'none';
      e.style.width = p + '%';
      void e.offsetWidth;
      e.style.transition = '';
    }
    h.dataset.p = p;
  }
  const prev = +(h.dataset.p || p);
  h.dataset.p = p;
  h.style.width = p + '%';
  h.className = 'fill' + (p < 25 ? ' low' : p < 50 ? ' mid' : '');
  g.style.transitionDelay = p < prev ? '.45s' : '0s';
  g.style.width = p + '%';
  if (p < prev && anim) {
    const c = $('#hb' + i);
    c.classList.remove('hit');
    void c.offsetWidth;
    c.classList.add('hit');
  }
  if (SC.s[i] && SC.s[i].sp === s.sp) SC.s[i].st = s.hp > 0 ? s.st : null;
  if (i === 0) {
    const hn = $('#hn0');
    hn.dataset.fmt = `#/${s.max}`;
    if (hn.dataset.k !== s.uid) {
      hn.dataset.k = s.uid;
      hn.dataset.v = s.hp;
    }
    countTo(hn, s.hp);
    $('#x0').style.width = s.xp * 100 + '%';
    const lo = $('#lowhp');
    if (lo) lo.classList.toggle('on', s.hp > 0 && p < 25);
  }
}
function paintParty() {
  if (!B) return;
  const pip = m => `<i class="pip${m.hp <= 0 ? ' out' : ''}${m.status ? ' st' : ''}"></i>`;
  const a = $('#pips0');
  if (a)
    a.innerHTML = S.team
      .filter(m => m.job == null)
      .map(pip)
      .join('');
  const b = $('#pips1');
  if (b) b.innerHTML = B.kind === 'trainer' ? B.sides[1].team.map(pip).join('') : '';
}
export function paintBoxes(s, mk, anim) {
  paintSide(0, s[0], anim);
  paintSide(1, s[1], anim);
  paintPlates(s, anim);
  paintParty();
  tickerUpdate(s, mk);
  const m = $('#mk');
  if (m) {
    m.innerHTML = mk ? `${uiIco('bolt', 14)} ${esc(shockName())} · ${plural(mk.n, 'turn')}` : '';
    m.classList.toggle('on', !!mk);
  }
}
const TKL = {};
function tickerUpdate(s, mk) {
  const el = $('#tk');
  if (!el) return;
  const items = [];
  [1, 3, 0, 2, 4].forEach(i => {
    const x = s[i];
    if (!x) return;
    const p = Math.round((Math.max(0, x.hp) / x.max) * 100),
      k = x.uid,
      prev = TKL[k],
      d = prev == null ? 0 : p - prev;
    TKL[k] = p;
    items.push(
      `<span class="tki"><b>${esc(x.name.toUpperCase())}</b> Lv ${x.lvl} <em class="${d < 0 ? 'dn' : d > 0 ? 'up' : ''}">HP ${p}%</em></span>`
    );
  });
  if (mk)
    items.push(`<span class="tki warn"><b>${esc(shockName().toUpperCase())}</b> ${plural(mk.n, 'turn')} left</span>`);
  const sunTxt = (() => {
    if (typeof envState !== 'function' || !ENV.on) return 'noon, steady';
    const st = envState(envHere());
    return (
      (st.night > 0.5
        ? 'night, dim'
        : st.dusk > 0.35
          ? 'dusk, glowing'
          : st.dawn > 0.35
            ? 'dawn, rising'
            : st.h < 11
              ? 'morning, climbing'
              : st.h < 15
                ? 'noon, steady'
                : 'afternoon, mellow') +
      (st.wx !== 'clear' ? ` · <b>WEATHER</b> ${(ENV_NAMES[st.wx] || st.wx).toLowerCase()}` : '')
    );
  })();
  items.push(
    `<span class="tki"><b>INNER SUN</b> ${sunTxt}</span>`,
    `<span class="tki"><b>MONEY</b> $${fmt(S.se)}</span>`
  );
  const h = items.join('<i>•</i>');
  el.innerHTML = h + '<i>•</i>' + h + '<i>•</i>';
}
/* floating numbers and tags over the billionaires */
function hudPop(si, text, kind) {
  const L = $('#pops');
  if (!L || !SC.L || (RM && kind === 'tag')) return;
  const q = scToCss(sideTop(si));
  if (!q) return;
  const e = document.createElement('div');
  e.className = 'pop ' + kind;
  e.textContent = text;
  e.style.left = clamp(q.x, 40, SC.L.vw - 40) + 'px';
  e.style.top = Math.max(30, q.y) + 'px';
  e.style.setProperty('--dx', ((rnd() - 0.5) * 36).toFixed(0) + 'px');
  L.appendChild(e);
  setTimeout(() => e.remove(), 1500);
}
function hudHit(ti, an) {
  if (!an.dmg) return;
  hudPop(ti, '−' + an.dmg, 'dmg' + (an.te > 1 ? ' se' : '') + (an.crit ? ' crit' : '') + (an.te < 1 ? ' nve' : ''));
  if (an.crit) setTimeout(() => hudPop(ti, 'Critical hit', 'tag crit'), 90);
  else if (an.te > 1) setTimeout(() => hudPop(ti, 'Super effective', 'tag se'), 90);
  else if (an.te < 1) setTimeout(() => hudPop(ti, 'Not very effective', 'tag nve'), 90);
}
function afterEvents() {
  if (!B) return;
  const msg = $('#msg');
  if (msg) msg.classList.remove('ready');
  if (B.over) {
    B.phase = 'end';
    paintActions();
    return;
  }
  if (B.offer) {
    B.phase = 'offer';
    paintActions();
    return;
  }
  if (B.needSwitch && B.needSwitch.length) {
    B.phase = 'switch';
    B.cur = B.needSwitch[0];
    $('#msgT').textContent = isMulti() ? 'Choose who takes the fallen one’s place.' : 'Choose who goes in next.';
    paintActions();
    return;
  }
  B.plan = [];
  B.cur = liveK(0)[0];
  B.phase = 'choose';
  chooseMsg();
  paintBoxes(snapAll(), B.market);
  boxShow(0, true);
  boxShow(1, true);
  paintActions();
  if (B.T && B.T.tutorial && typeof battleTutor === 'function')
    battleTutor(); /* v47: Hazel's tips in Blake's first battle */
}
/* v33: with two or three of yours out, each picks in turn; the one choosing stands in a ring */
export function chooseMsg() {
  const m = A(B.cur);
  if (!m) return;
  const L = liveK(0),
    n = L.indexOf(B.cur);
  $('#msgT').textContent = L.length > 1 ? `What will ${N(m)} do? (${n + 1} of ${L.length})` : `What will ${N(m)} do?`;
  if (typeof scSelect === 'function') scSelect(B.cur);
}
export function planNext(p) {
  B.plan.push(p);
  const L = liveK(0).filter(k => !B.plan.some(q => q.who === k));
  if (L.length && !B.plan.some(q => q.k === 'run')) {
    B.cur = L[0];
    B.phase = 'choose';
    chooseMsg();
    paintActions();
    return;
  }
  if (typeof scSelect === 'function') scSelect(null);
  runTurn(B.plan);
}
export function planBack() {
  const p = B.plan.pop();
  if (!p) return false;
  B.cur = p.who;
  B.phase = 'choose';
  chooseMsg();
  paintActions();
  return true;
}
/* does this move need a target picked? (one aimed at a foe while more than one foe stands) */
function needsTarget(mid) {
  const M = MOVES[mid],
    fx = M.fx || {};
  const onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe;
  return onFoe && !fx.spread && liveK(1).length > 1;
}
export function pickMove(mid) {
  if (needsTarget(mid)) {
    B.mv = mid;
    B.phase = 'target';
    $('#msgT').textContent = `${MOVES[mid].n}: which one? Tap it.`;
    paintActions();
    if (typeof scTargets === 'function') scTargets(liveK(1));
    return;
  }
  planNext({ who: B.cur, k: 'move', mid, tk: liveK(1)[0] });
}
export function pickTarget(tk) {
  if (!B || B.phase !== 'target') return;
  if (typeof scTargets === 'function') scTargets(null);
  planNext({ who: B.cur, k: 'move', mid: B.mv, tk });
}
function effLabel(mid, tk) {
  const M = MOVES[mid];
  if (!M.p && !(M.fx && M.fx.vary)) return '';
  const F = tk != null ? [tk] : liveK(1);
  if (!F.length) return '';
  if (F.length === 1) {
    const e = eff(M.t, types(F[0]));
    return e > 1 ? '<em class="se">Super effective</em>' : e < 1 ? '<em class="nve">Not very effective</em>' : '';
  }
  const se = F.filter(k => eff(M.t, types(k)) > 1).map(k => N(A(k))),
    nv = F.filter(k => eff(M.t, types(k)) < 1).map(k => N(A(k)));
  return se.length
    ? `<em class="se">Super effective on ${esc(se.join(', '))}</em>`
    : nv.length === F.length
      ? '<em class="nve">Not very effective</em>'
      : '';
}
function hpMini(m) {
  const p = Math.max(0, m.hp / maxHp(m));
  return `<span class="hpmini"><i class="${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}" style="width:${p * 100}%"></i></span>`;
}
function monPick(m, act, attrs, dis, note) {
  return `<button class="pick" ${attrs} ${dis ? 'disabled' : ''}>${bustHTML(m.sp, 40, { gold: m.gold })}<span class="pk-t"><b>${esc(N(m))}</b><span class="pk-m">${SP[m.sp].types.map(chip).join('')}<small class="tnum">Lv ${m.lvl}</small></span>${hpMini(m)}<small class="tnum">${Math.max(0, m.hp)}/${maxHp(m)}</small></span><span class="pk-s">${note || ''}</span></button>`;
}
function teamPick(back) {
  const on = B.sides[0].f.filter(f => f.on).map(f => f.act),
    called = (B.plan || []).filter(p => p.k === 'switch').map(p => p.i);
  return `<div class="plist">${S.team
    .map((m, i) => {
      const act = (on.includes(i) && m.hp > 0) || called.includes(i);
      const dis = act || m.hp <= 0 || m.job != null;
      return monPick(
        m,
        act,
        `data-a="bswitch" data-i="${i}"`,
        dis,
        act
          ? called.includes(i)
            ? 'Coming in'
            : 'In battle'
          : m.job != null
            ? 'At work'
            : m.hp <= 0
              ? 'Fainted'
              : stBadge(m.status)
      );
    })
    .join('')}</div>${back ? backBtn() : ''}`;
}
const backBtn = () =>
  `<button class="bt back wide" data-a="bback">${uiIco('back', 16)}<b>Back</b><kbd>Esc</kbd></button>`;
export const itemIcon = (k, size = 30) => {
  const I = ITEMS[k] || {};
  return I.img
    ? `<img class="pxi" src="${artURL(I.img)}" width="${size}" height="${size}" alt="">`
    : `<img class="pxi" src="${iconURL('i_' + (I.icon || k))}" width="${size}" height="${size}" alt="">`;
};
export function paintActions() {
  const el = $('#acts');
  if (!el || !B) return;
  const ph = B.phase,
    wild = B.kind === 'wild';
  let h = '';
  el.dataset.ph = ph;
  if (ph === 'choose') {
    const m = A(B.cur),
      first = !B.plan.length,
      coins = Object.keys(COINS).reduce((a, k) => a + (S.coins[k] || 0), 0),
      items = Object.keys(ITEMS)
        .filter(k => S.items[k] > 0 && !ITEMS[k].evoItem)
        .reduce((a, k) => a + S.items[k], 0),
      crew = S.team.filter(x => x.job == null),
      alive = crew.filter(x => x.hp > 0).length;
    h = `<div class="c-choose"><button class="bt fight" data-a="bfight"><span class="bt-i">${uiIco('fight', 24)}</span><span class="bt-t"><b>Fight</b><small>${plural(m.moves.length, 'move')}</small></span><kbd>F</kbd></button>
  <div class="bt-row"><button class="bt coin" data-a="bcoins" ${wild && first ? '' : 'disabled'}>${uiIco('coin', 18)}<b>Tax it</b><small>${wild ? (first ? coins + ' left' : 'First pick only') : 'Wild only'}</small><kbd>X</kbd></button>
  <button class="bt items" data-a="bitems">${uiIco('bag', 18)}<b>Bag</b><small>${items}</small><kbd>I</kbd></button>
  <button class="bt team" data-a="bteam">${uiIco('team', 18)}<b>Team</b><small>${alive}/${crew.length}</small><kbd>T</kbd></button>
  <button class="bt run" data-a="brun" ${wild ? '' : 'disabled'}>${uiIco('run', 18)}<b>Run</b><small>${wild ? 'Walk away' : 'No exit'}</small><kbd>R</kbd></button></div>${first ? '' : `<button class="bt back wide" data-a="bback">${uiIco('back', 16)}<b>Back to ${esc(N(A(B.plan[B.plan.length - 1].who)))}</b><kbd>Esc</kbd></button>`}</div>`;
  } else if (ph === 'fight') {
    const m = A(B.cur);
    h = `<div class="moves">${m.moves
      .map((id, n) => {
        const M = MOVES[id],
          c = TC[M.t],
          P = M.p ? M.p : M.fx && M.fx.vary ? 'Varies' : 'Status',
          stab = M.t !== 'None' && types(B.cur).includes(M.t);
        return `<button class="mv" style="--tc:${c[0]};--tf:${c[1]}" data-a="bmove" data-m="${id}" data-tip="${esc(M.d)}"><span class="mv-top"><b>${esc(M.n)}</b><kbd>${n + 1}</kbd></span><span class="mv-meta"><span class="mv-ty">${M.t === 'None' ? 'Normal' : M.t}${stab ? ' ★' : ''}</span><span class="tnum">${P}${M.p ? ' pow' : ''}${M.p && typeof battleWeatherMult === 'function' ? (battleWeatherMult(M.t) > 1 ? ' ▲' : battleWeatherMult(M.t) < 1 ? ' ▼' : '') : ''}${M.c !== 'X' || M.a < 100 ? ` · ${M.a || 100}%` : ''}</span></span>${effLabel(id)}</button>`;
      })
      .join('')}</div>${backBtn()}`;
  } else if (ph === 'target') {
    const mid = B.mv;
    h = `<div class="plist">${liveK(1)
      .map(k => {
        const m = A(k);
        return monPick(
          m,
          false,
          `data-a="btarget" data-t="${k}"`,
          false,
          effLabel(mid, k) || (m.boss ? '<em class="alpha">Alpha</em>' : '')
        );
      })
      .join('')}</div>${backBtn()}`;
  } else if (ph === 'coins') {
    h = `<div class="coins">${Object.keys(COINS)
      .map((k, n) => {
        const c = COINS[k],
          have = S.coins[k] || 0,
          odds = Math.round(catchOdds(k, 1 + RC.ring * 0.5, false) * 100);
        return `<button class="ccard" data-a="bcoin" data-c="${k}" ${have ? '' : 'disabled'}>${coinHTML(k, 34)}<span class="cc-t"><b>${esc(c.n)}</b><small class="tnum">${c.m === 0 ? 'Guaranteed' : `~${odds}% tax`} · ${have} left</small></span><span class="cc-bar"><i style="width:${c.m === 0 ? 100 : clamp(odds, 2, 100)}%"></i></span></button>`;
      })
      .join('')}</div>${backBtn()}`;
  } else if (ph === 'items') {
    const its = Object.keys(ITEMS).filter(k => S.items[k] > 0 && !ITEMS[k].evoItem);
    h = `<div class="plist">${
      its.length
        ? its
            .map(k => {
              const I = ITEMS[k],
                ok = I.hpAll ? teamNeedsHp() : S.team.some(m => canUse(k, m));
              return `<button class="pick" data-a="bitem" data-it="${k}" ${ok ? '' : 'disabled'}>${itemIcon(k, 32)}<span class="pk-t"><b>${esc(I.n)}</b><small>${esc(I.d)}</small></span><span class="pk-s tnum">×${S.items[k]}</span></button>`;
            })
            .join('')
        : '<p class="note">No items. Buy some at a town shop.</p>'
    }</div>${backBtn()}`;
  } else if (ph === 'itemTarget') {
    const it = B.item;
    h = `<p class="note">Use ${esc(ITEMS[it].n)} on:</p><div class="plist">${S.team.map(m => monPick(m, false, `data-a="bitemon" data-u="${m.uid}"`, !canUse(it, m), m.hp <= 0 ? 'Fainted' : stBadge(m.status))).join('')}</div>${backBtn()}`;
  } else if (ph === 'team') h = teamPick(true);
  else if (ph === 'switch') h = teamPick(false);
  else if (ph === 'aim') {
    h = `<div class="aim"><div class="aimcoin" id="aimCoin" role="button" tabindex="0" aria-label="Swipe up to throw">${coinHTML(B.coin, 96, 32)}<span class="aim-hint">${uiIco('back', 14)}</span></div><p class="note">Swipe the coin up when the ring is small and green. A sideways swipe adds spin.</p><div class="two"><button class="bt coin" data-a="bthrow"><b>Flick it</b><kbd>Space</kbd></button><button class="bt back" data-a="baimback"><b>Put it away</b><kbd>Esc</kbd></button></div></div>`;
  } else if (ph === 'throwing') h = `<div class="aim"><p class="note">The coin is in the air…</p></div>`;
  else if (ph === 'offer') {
    h = `<div class="offer"><p>${uiIco('coin', 16)} ${esc(N(A(1)))} is offering you <b class="tnum">$${fmt(B.offer)}</b> to let it go. Refusing gives your next throw a Focus Bonus.</p><div class="two"><button class="bt coin" data-a="boffer" data-y="1"><b>Take it</b></button><button class="bt fightish" data-a="boffer" data-y="0"><b>Refuse</b></button></div></div>`;
  } else if (ph === 'end') {
    const t = {
      win: 'You won.',
      lose: 'Your team fainted.',
      caught: 'Taxed.',
      ran: 'You walked away.',
      bribed: 'You took the money.',
    }[B.over];
    h = `<button class="bt end wide" data-a="bend"><b>${t} Continue</b><kbd>Enter</kbd></button>`;
  }
  el.innerHTML = h;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.classList.add('swap');
  if (ph === 'aim') bindAim();
  if (ph === 'fight')
    $$('.mv', el).forEach(b => {
      const tip = () => {
        if (B && B.phase === 'fight') $('#msgT').textContent = b.dataset.tip;
      };
      b.addEventListener('pointerenter', tip);
      b.addEventListener('focus', tip);
    });
}
function bindAim() {
  const c = $('#aimCoin');
  if (!c) return;
  let sx = 0,
    sy = 0,
    on = false;
  c.addEventListener('pointerdown', ev => {
    if (U.throwing) return;
    on = true;
    sx = ev.clientX;
    sy = ev.clientY;
    c.setPointerCapture(ev.pointerId);
    c.classList.add('held');
  });
  c.addEventListener('pointermove', ev => {
    if (!on) return;
    c.style.transform = `translate(${(ev.clientX - sx) * 0.4}px,${Math.min(0, ev.clientY - sy) * 0.5}px) rotate(${(ev.clientX - sx) * 0.2}deg)`;
  });
  c.addEventListener('pointerup', ev => {
    if (!on) return;
    on = false;
    c.classList.remove('held');
    const dy = sy - ev.clientY,
      dx = ev.clientX - sx;
    c.style.transform = '';
    if (dy > 40) doThrow(Math.abs(dx) > 30);
  });
  c.addEventListener('pointercancel', () => {
    on = false;
    c.style.transform = '';
    c.classList.remove('held');
  });
}
export function showAim() {
  SC.ring = { t0: SC.t };
  camAt(1, 0.45, 0.16, 0.015, 320);
  scFocus('foe');
  $('#msgT').textContent =
    B.integrity > 1 ? `Focus Bonus ×${+B.integrity.toFixed(2)} is active.` : 'Line up your throw.';
}
export function doThrow(spin) {
  if (U.throwing || !B || B.phase !== 'aim') return;
  U.throwing = true;
  const ph = scRingPhase(),
    T = 1 + RC.ring * ph,
    id = B.coin;
  S.coins[id]--;
  save();
  SC.ring = null;
  const res = catchRoll(id, T, spin),
    lab = ph >= 0.83 ? 'Excellent throw!' : ph >= 0.5 ? 'Great throw!' : ph >= 0.17 ? 'Nice throw.' : '';
  B.phase = 'throwing';
  paintActions();
  $('#msgT').textContent = [`You flicked a ${COINS[id].n}.`, lab, spin ? 'Spin bonus!' : ''].filter(Boolean).join(' ');
  scCatch(id, res, spin, caught => finishThrow(res, id, lab, spin));
}
function finishThrow(res, id, lab, spin) {
  U.throwing = false;
  if (!B) return;
  const e = A(1);
  B.events = [];
  if (res.edge) say('It landed on its edge. Critical tax!');
  if (res.caught) {
    say(`Gotcha! ${N(e)} was taxed.`, { k: 'caught' });
    if (e.boss) {
      const f = e.hp / maxHp(e);
      delete e.boss;
      e.alpha = true;
      e.hp = Math.max(1, Math.round(maxHp(e) * f));
      say(`${N(e)} is an Alpha: a little bigger and stronger than others of its kind.`);
    }
    e.hp = Math.max(1, e.hp);
    const where = addMon(e);
    if (where === 'box') say(`${N(e)} went to storage. Your team is full.`);
    B.over = 'caught';
    save();
    return play();
  }
  say(['It broke free right away.', 'It almost stayed in.', 'So close. It wobbled twice.'][res.w]);
  if (rnd() < RC.offerChance) {
    B.offer = Math.round((RC.offerMin + rnd() * (RC.offerMax - RC.offerMin)) / 10) * 10;
    say(`${N(e)} is offering you money to let it go.`, { k: 'cry', si: 1 });
    return play();
  }
  enemyOnly();
  play();
}
export function endBattle() {
  stopTimers();
  const o = B.over,
    kind = B.kind,
    T = B.T,
    tid = B.tid,
    lead = findMon(B.lead);
  if (o === 'win' && typeof jingle === 'function') jingle(JINGLES.victory);
  if (o === 'win')
    for (const m of S.team) if (m.hp > 0 && m.job == null) m.wins = (m.wins || 0) + 1; /* v36: the Hype counter */
  if (typeof battleTipHide === 'function') battleTipHide();
  if (kind === 'wild') S.queue = S.queue.filter(q => q.id !== B.qid);
  if (lead) {
    if (o === 'win') lead.streak = (lead.streak || 0) + 1;
    else if (o === 'lose') lead.streak = 0;
  }
  /* v47: Blake's first battle, in the opening: no fee and no sheet, win or lose; the story picks it up (story.js) */
  if (T && T.tutorial) {
    if (o === 'win') S.flags[tid] = 1;
    if (o === 'lose') for (const m of S.team) m.hp = Math.max(1, m.hp);
    save();
    battleLeave(() => {
      B = null;
      scStop();
      document.body.classList.remove('in-battle');
      U.tab = 'walk';
      render();
      if (typeof storyAfterRival === 'function') storyAfterRival(o, T);
      else {
        healAll();
        postProcess();
      }
    });
    return;
  }
  const after = [];
  if (o === 'lose') {
    const fee = Math.floor(S.se * RB.loseFee);
    S.se -= fee;
    healAll();
    after.push({
      title: 'Your team fainted',
      html: `<p>You hurried back to the clinic.</p><p>You paid $${fmt(fee)} for treatment, and the team is back at full HP.</p>${T ? `<p class="note">${esc(T.name)}: ${esc(T.lose || '')}</p>` : ''}`,
      btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
    });
  }
  const E = RULES.eggs;
  if (kind === 'wild' && o === 'win' && rnd() < E.dropChance) {
    const tiers = Object.entries(E.dropTiers)
      .filter(([t]) => EGGS[t])
      .map(([t, w]) => [+t, w]);
    const tier = tiers.length ? pickW(tiers) : EGG_TIERS[0];
    if (addEgg(tier))
      after.push({
        title: 'It dropped an egg',
        top: `<div class="sheet-art">${eggHTML(tier, 72, 'wob')}</div>`,
        html: `<p>A ${tier} km egg rolled out of the grass. Walk ${tier} km with it in an incubator to see what hatches.</p>`,
        btns: [{ l: 'Nice', c: 'dark', f: closeModal }],
      });
  }
  if (kind === 'trainer' && o === 'win') {
    S.se += T.reward || 0;
    const first = !S.flags[tid];
    S.flags[tid] = 1;
    let extra = '';
    if (first && T.egg && addEgg(T.egg)) extra += ` and a ${T.egg} km egg`;
    const st = T.seat;
    if (st) {
      const nu = !S.seats.includes(st.id);
      if (nu) {
        S.seats.push(st.id);
        for (const k in st.coins || {}) S.coins[k] = (S.coins[k] || 0) + st.coins[k];
        for (const k in st.items || {}) S.items[k] = (S.items[k] || 0) + st.items[k];
      }
      after.push({
        title: nu ? esc(st.title || 'Badge') : 'Rematch won',
        top: `<div class="sheet-art">${coinHTML(st.coin || 'penny', 96, 32)}</div>`,
        html: `<p>${esc(T.win || '')}</p><p>You earned $${fmt(T.reward || 0)}${nu && st.rewardText ? `, ${esc(st.rewardText)}` : ''}${extra}.</p>${nu && st.unlockText ? `<p class="note">${esc(st.unlockText)}</p>` : ''}`,
        btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
      });
    } else
      after.push({
        title: `You beat ${esc(T.name)}`,
        top: `<div class="sheet-art">${portraitHTML(T.who, 96, 'sad')}</div>`,
        html: `<p>${esc(T.win || '')}</p><p>You earned $${fmt(T.reward || 0)}${extra}.</p>`,
        btns: [
          {
            l: 'Keep walking',
            c: 'dark',
            f:
              first && (T.clue || T.ending) && typeof storyAfterWin === 'function'
                ? () => {
                    closeModal();
                    storyAfterWin(T);
                  }
                : closeModal,
          },
        ],
      });
  }
  save();
  battleLeave(() => {
    B = null;
    scStop();
    document.body.classList.remove('in-battle');
    U.tab = 'walk';
    render();
    after.forEach(m => modal(m));
    if (!after.length) postProcess();
  });
}

/* ================= v33: NAMEPLATES IN THE SCENE =================
   Each billionaire on the field carries a small plate (name, level, HP, status) that floats above it and follows the
   camera, so the battle reads from the picture itself. With two or three a side they replace the corner cards; in a
   one-on-one they do too, unless Settings → Battle HUD is set to the classic cards. Tap a foe's plate (or the foe) to
   aim at it. */
const hudScene = () => !!B && (isMulti() || ((S.preferences || {}).battleHud || 'scene') !== 'classic');
function plateEl(k) {
  const L = $('#plates');
  if (!L) return null;
  let e = L.querySelector(`.bplate[data-k="${k}"]`);
  if (e) return e;
  e = document.createElement('button');
  e.className = 'bplate ' + (ASIDE[k] ? 'foe' : 'me');
  e.dataset.k = k;
  e.dataset.a = 'btarget';
  e.dataset.t = k;
  e.tabIndex = -1;
  e.innerHTML = `<span class="pl-top"><b class="pl-n"></b><span class="pl-cr" hidden>${uiIco('spark', 11)}</span><span class="pl-lv tnum"></span></span><span class="pl-hp"><i class="ghost"></i><i class="fill"></i></span><span class="pl-bot"><span class="pl-st"></span><span class="pl-num tnum"></span></span>${ASIDE[k] ? '' : '<span class="pl-xp"><i></i></span>'}`;
  L.appendChild(e);
  return e;
}
function paintPlates(s, anim) {
  const L = $('#plates');
  if (!L) return;
  const on = hudScene();
  $('#battle') && $('#battle').classList.toggle('hud-scene', on);
  if (!on) {
    L.innerHTML = '';
    return;
  }
  for (let k = 0; k < 5; k++) {
    const x = s && s[k],
      e = x ? plateEl(k) : L.querySelector(`.bplate[data-k="${k}"]`);
    if (!e) continue;
    if (!x) {
      e.classList.add('gone');
      continue;
    }
    e.classList.remove('gone');
    e.querySelector('.pl-n').textContent = x.name;
    e.querySelector('.pl-lv').textContent = 'Lv ' + x.lvl;
    e.querySelector('.pl-cr').hidden = !x.alpha;
    e.classList.toggle('alpha', !!x.boss);
    e.classList.toggle('gold', !!x.gold);
    e.querySelector('.pl-st').innerHTML = x.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : stBadge(x.st);
    const p = Math.max(0, (x.hp / x.max) * 100),
      f = e.querySelector('.fill'),
      g = e.querySelector('.ghost');
    if (f.dataset.k !== x.uid) {
      f.dataset.k = x.uid;
      for (const q of [f, g]) {
        q.style.transition = 'none';
        q.style.width = p + '%';
        void q.offsetWidth;
        q.style.transition = '';
      }
      f.dataset.p = p;
    }
    const prev = +(f.dataset.p || p);
    f.dataset.p = p;
    f.style.width = p + '%';
    f.className = 'fill' + (p < 25 ? ' low' : p < 50 ? ' mid' : '');
    g.style.transitionDelay = p < prev ? '.45s' : '0s';
    g.style.width = p + '%';
    if (p < prev && anim) {
      e.classList.remove('hit');
      void e.offsetWidth;
      e.classList.add('hit');
    }
    const num = e.querySelector('.pl-num');
    num.textContent = ASIDE[k] ? (x.boss ? Math.round(p) + '%' : '') : `${Math.max(0, x.hp)}/${x.max}`;
    const xp = e.querySelector('.pl-xp i');
    if (xp) xp.style.width = x.xp * 100 + '%';
    if (SC.s[k] && SC.s[k].sp === x.sp) SC.s[k].st = x.hp > 0 ? x.st : null;
  }
  turnBar();
}
/* v34: the turn order bar: who moves first this turn (by speed; a fast move or a switch can still jump the queue).
   Only with more than two fighters on the field, where it's hard to keep in your head. */
function turnBar() {
  const L = $('#plates');
  if (!L || !B) return;
  let e = L.querySelector('.turnbar');
  const K = liveK(0).concat(liveK(1));
  if (K.length < 3 || B.over) {
    if (e) e.remove();
    return;
  }
  if (!e) {
    e = document.createElement('div');
    e.className = 'turnbar';
    e.setAttribute('aria-label', 'Turn order');
    L.appendChild(e);
  }
  const O = K.map(k => [k, statE(k, 'hus') * (A(k).boss ? 1 : 1)]).sort((a, b) => b[1] - a[1]);
  const html = O.map(([k]) => {
    const m = A(k),
      mine = ASIDE[k] === 0,
      n = A(k).boss ? (RB.alphaActs ?? 2) : 1;
    return `<span class="tb ${mine ? 'me' : 'foe'}${A(k).boss ? ' alpha' : ''}" title="${esc(N(m))}">${esc(N(m).split(' ')[0])}${n > 1 ? ' ×' + n : ''}</span>`;
  }).join('<i>›</i>');
  if (e.innerHTML !== html) e.innerHTML = '<b>Order</b>' + html;
}
/* every frame: plates ride above their billionaire; the one choosing and the ones you can aim at are marked */
function platesTick() {
  const L = $('#plates');
  if (!L || !B || !SC.L || !L.firstChild) return;
  const tgt = B.phase === 'target',
    placed = [],
    tk = $('.ticker'),
    top0 = (tk ? tk.getBoundingClientRect().bottom - $('#battle').getBoundingClientRect().top : 24) + 4;
  const list = [...L.children]
    .map(e => ({ e, k: +e.dataset.k }))
    .sort((a, b) => (SC.s[b.k] ? sideWorld(b.k).z : 0) - (SC.s[a.k] ? sideWorld(a.k).z : 0))
    .reverse();
  for (const { e, k } of list) {
    const sd = SC.s[k];
    const vis = sd && sd.show && sd.a > 0.3 && !e.classList.contains('gone');
    e.classList.toggle('off', !vis);
    if (!vis) continue;
    const q = scToCss(sideTop(k));
    if (!q) continue;
    const w = e.offsetWidth || 120,
      h = e.offsetHeight || 44;
    let x = clamp(q.x, w / 2 + 6, SC.L.vw - w / 2 - 6),
      y = clamp(q.y - 8, top0 + h, SC.L.vh - 40);
    /* nearer plates win; a farther one that would cover it moves up (or down if there's no room) */
    for (let it = 0; it < 4; it++) {
      const hit = placed.find(r => Math.abs(r.x - x) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < (r.h + h) / 2 + 3);
      if (!hit) break;
      const up = hit.y - hit.h - 4;
      y = up - h >= top0 ? up : hit.y + h + 4;
    }
    placed.push({ x, y, w, h });
    e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    e.classList.toggle('cur', (B.phase === 'choose' && B.cur === k) || (B.phase === 'fight' && B.cur === k));
    e.classList.toggle('aim', tgt && ASIDE[k] === 1);
    e.disabled = !(tgt && ASIDE[k] === 1);
  }
}
/* tapping the picture while aiming picks the nearest foe */
function stageTap(ev) {
  if (!B || B.phase !== 'target' || !SC.L) return;
  const r = $('#battle').getBoundingClientRect(),
    x = ev.clientX - r.left,
    y = ev.clientY - r.top;
  let best = null,
    bd = 1e9;
  for (const k of liveK(1)) {
    const c = scToCss(sideCenter(k));
    if (!c) continue;
    const d = Math.hypot(c.x - x, (c.y - y) * 0.8);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  if (best != null && bd < 160) pickTarget(best);
}
document.addEventListener('pointerup', e => {
  if (
    B &&
    B.phase === 'target' &&
    e.target &&
    e.target.closest &&
    e.target.closest('#stage') &&
    !e.target.closest('.bplate')
  )
    stageTap(e);
});
