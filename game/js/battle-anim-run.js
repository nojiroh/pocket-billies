'use strict';
/* ================= BATTLE ANIM RUNNER (VFX track VFX-8) =================
   Plays a move's timeline (logic/battle-anims.js, from game/data/battleAnims.json) on the battle stage and returns
   {dur, hit}, which battle.js waits on, as battle-stage.js's case 'move' did. Each step is started at once (no `at` in
   the data) or put on the stage clock, in the data's order, so the steps keep the order they always had. A step on
   the clock carries what a skip does to it (a tap, or the next line's flush, battleStageFlush): the end framing and
   the hit's numbers still happen, pictures, sounds, poses and camera moves still to come are dropped.
   Also: the stage clock for battle sounds (battleStageAt), the full-screen flash limiter in front of battleStageFlash
   (battleFlashGate) and the debug log's `anim` line per move (no names, no save data). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { BATTLE_ANIMS, MOVES, TYPE_COLORS, hudHit, hudPop, provide, reducedMotion } from './hooks.js';
import { random } from './util.js';
import { battleAnimLogLine, battleAnimTimeline, flashGate } from './logic/battle-anims.js';
import { actorCenter, battleStage, battleStageFocus, battleStageKit, camAt, camHome } from './battle-stage.js';
/* eslint-disable no-func-assign */
expose({
  animAt: [() => animAt, v => (animAt = v)],
  animColor: [() => animColor],
  animLog: [() => animLog, v => (animLog = v)],
  animStep: [() => animStep, v => (animStep = v)],
  animStepInfo: [() => animStepInfo, v => (animStepInfo = v)],
  battleAnim: [() => battleAnim],
  battleAnimPlay: [() => battleAnimPlay, v => ((battleAnimPlay = v), provide({ battleAnimPlay }))],
  battleAnimSkip: [() => battleAnimSkip, v => (battleAnimSkip = v)],
  battleFlashGate: [() => battleFlashGate, v => (battleFlashGate = v)],
  battleStageAt: [() => battleStageAt, v => (battleStageAt = v)],
  brightColor: [() => brightColor],
  sideFocus: [() => sideFocus],
});
/* eslint-enable no-func-assign */
provide({ battleAnimPlay });
/* to-module: end */
/** the runner's state: the full-screen flashes shown in the last second (flashGate), the move playing (its id, its
 * timeline, the quality, the flashes held back) */
const battleAnim = {
  flashes: { times: /** @type {number[]} */ ([]) },
  /** @type {{ mid: string, T: any, q: number, held: string[], logged: boolean } | null} */
  cur: null,
};

/** a step on the stage clock, ms from now; onSkip: what a skip runs instead (null: nothing) */
function animAt(ms, fn, onSkip) {
  battleStage.evs.push({ t: battleStage.t + ms, fn, onSkip });
}
/** VFX-8: battle sounds on the stage clock (they keep step with hit-stop and the battle speed, and a skip drops the
 * ones still to come); real time, as before, when the stage isn't running */
function battleStageAt(ms, fn) {
  if (!battleStage.on) return void setTimeout(fn, Math.max(0, ms / (battleStage.speed || 1)));
  animAt(Math.max(0, ms), fn, null);
}
/** VFX-8: skips what is playing: the stage's flush, where the runner's steps do what their skip says */
export function battleAnimSkip() {
  battleStageKit.flush();
}

const animColor = (c, col) => (col === 'type' ? TYPE_COLORS[c.type][0] : BATTLE_ANIMS.colors[col]);
const sideFocus = i => (battleStageKit.actorTeam(i) === 0 ? 'me' : 'foe');
/** one step, on the stage now. c: the move's (its event, sides, type, the places it started from) */
function animStep(S, c) {
  const K = battleStageKit,
    i = S.on ? c.idx[S.on] : c.si;
  switch (S.do) {
    case 'focus':
      battleStageFocus(S.on === 'wide' ? 'wide' : sideFocus(i));
      return;
    case 'camAt':
      camAt(i, S.amt, S.z, S.roll * (K.actorTeam(i) === 0 ? -1 : 1), S.d);
      return;
    case 'toTarget': {
      const ti = c.ti;
      battleStageFocus(sideFocus(ti));
      camAt(ti, S.amt ?? 0.45, S.z ?? 0.15, (S.roll ?? 0.022) * (K.actorTeam(ti) === 1 ? 1 : -1), S.d, 'out3');
      return;
    }
    case 'camTo': {
      const m = c.ss === 0 ? 1 : -1,
        C = { ...S.cam };
      if ('x' in C) C.x *= m;
      if ('yaw' in C) C.yaw *= m;
      K.camTo(C, S.d, S.ease, S.delay || 0);
      return;
    }
    case 'camHome':
      camHome(S.d, S.delay || 0);
      return;
    case 'handheld':
      K.handheld(S.ms, S.amt);
      return;
    case 'action':
      K.setActorAction(i, S.pose, S.ms);
      return;
    case 'lunge':
      K.battleLunge(c.si, {
        dx: c.dir * S.dx,
        dy: S.dy,
        dur: S.dur,
        ease: S.ease,
        delay: S.delay,
        backDur: S.backDur,
        backAt: S.backAt,
        ...K.lungeKind(c.an.mid, c.type),
      });
      return;
    case 'dust': {
      const A = c.P.attacker;
      K.addParticle({
        x: A.x,
        y: 0.15,
        z: A.z,
        vx: (random() - 0.5) * 1.2,
        vy: 0.6 + random() * 0.6,
        vz: (random() - 0.5) * 1.2,
        life: S.life,
        col: animColor(c, S.color),
        size: 2,
        floor: 1,
      });
      return;
    }
    case 'ring':
      K.ringFx(c.P[S.on], animColor(c, S.color), S.r0, S.r1, S.life);
      return;
    case 'groundRing':
      K.groundRing(i, animColor(c, S.color), S.r1, S.life);
      return;
    case 'beam': {
      const A = c.P.attacker,
        T = c.P.target;
      K.addParticle({
        x: A.x,
        y: A.y,
        z: A.z,
        x2: T.x,
        y2: T.y,
        z2: T.z,
        beam: 1,
        col: TYPE_COLORS[c.type][0],
        w: S.w,
        life: S.life,
        glow: 1,
      });
      return;
    }
    case 'lob': {
      const A = c.P.attacker,
        T = c.P.target,
        v = 1 / S.time,
        key = K.typeSprite(c.type, S.i);
      K.addParticle({
        x: A.x + (random() - 0.5) * S.jitter,
        y: A.y + (random() - 0.5) * S.jitter,
        z: A.z,
        vx: (T.x - A.x) * v,
        vy: (T.y - A.y) * v + S.up,
        vz: (T.z - A.z) * v,
        ay: S.ay,
        life: S.life,
        spr: key,
        k: S.k,
        fade: false,
        glow: K.GLOWING_PARTICLES[key],
      });
      return;
    }
    case 'fling': {
      const A = c.P.attacker,
        T = c.P.target;
      K.addParticle({
        x: A.x,
        y: A.y,
        z: A.z,
        vx: (T.x - A.x) * S.speed + (random() - 0.5),
        vy: (T.y - A.y) * S.speed + S.up,
        vz: (T.z - A.z) * S.speed + S.side,
        life: S.life,
        spr: K.typeSprite(c.type, S.i),
        k: 1,
      });
      return;
    }
    case 'converge': {
      const Pp = c.P[S.on],
        a = (S.i / (S.n || 1)) * Math.PI * 2,
        key = K.typeSprite(c.type, S.i);
      K.addParticle({
        x: Pp.x + Math.cos(a) * S.r,
        y: Pp.y + Math.sin(a * 2) * 0.3,
        z: Pp.z + Math.sin(a) * S.r,
        vx: -Math.cos(a) * 1.2,
        vy: 0.8,
        vz: -Math.sin(a) * 1.2,
        life: S.life,
        spr: key,
        k: 1,
        glow: K.GLOWING_PARTICLES[key],
      });
      return;
    }
    case 'blink':
      K.blinkActor(i, S.ms);
      return;
    case 'dodge': {
      const s = battleStage.s[c.ti];
      K.tween(s, 'ox', s.ox - c.dir * S.dx, S.dur);
      K.tween(s, 'ox', 0, S.backDur, 'out', S.backAt);
      return;
    }
    case 'pop':
      if (typeof hudPop === 'function') hudPop(i, S.pop === 'hedged' ? 'Hedged' : 'Miss', 'miss');
      return;
    case 'hit':
      K.hitFx(c.ti, c.hitAn);
      return;
  }
}
/** what a skipped step still does: the hit's numbers */
function animStepInfo(S, c) {
  if (S.do === 'hit' && typeof hudHit === 'function') hudHit(c.ti, c.hitAn);
}
/** the move's `anim` line in the debug log, once (when its time is up, or a skip ends it) */
function animLog(C) {
  if (C.logged) return;
  C.logged = true;
  if (typeof debugLog !== 'undefined') debugLog.add('anim', battleAnimLogLine(C.mid, C.T, C.q, C.held));
}

/** VFX-8: plays a move event (the engine's `an`, only read) on the stage; {dur, hit} for battle.js */
function battleAnimPlay(an, ev) {
  const M = MOVES[an.mid],
    si = an.si,
    ti = an.ti ?? 1 - si,
    q = battleStage.q.lvl,
    T = M
      ? battleAnimTimeline(
          an,
          M,
          { gl: !!battleStage.gl, reduced: !!reducedMotion, q, speed: battleStage.speed },
          BATTLE_ANIMS
        )
      : null;
  if (!T) return { dur: 0, hit: 999 };
  const ss = battleStageKit.actorTeam(si),
    A = actorCenter(si),
    Tg = actorCenter(ti),
    c = {
      an,
      si,
      ti,
      ss,
      dir: ss === 0 ? 1 : -1,
      type: M.t,
      /* the move's type rides on a copy: the engine's event isn't written */
      hitAn: { ...an, t: M.t },
      P: { attacker: A, target: Tg, subject: an.self ? A : Tg },
      idx: { attacker: si, target: ti, subject: an.self ? si : ti },
    },
    C = (battleAnim.cur = { mid: an.mid, T, q, held: [], logged: false });
  for (const S of T.steps) {
    const run = () => animStep(S, c);
    if (S.sync) run();
    else animAt(S.at, run, S.skip === 'run' ? run : S.skip === 'info' ? () => animStepInfo(S, c) : null);
  }
  animAt(
    T.dur,
    () => animLog(C),
    () => animLog(C)
  );
  return { dur: T.dur, hit: T.hit };
}

const brightColor = col => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col || '');
  return !!m && 0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16) > 128;
};
/** VFX-8: may a full-screen flash in col start now? (logic/battle-anims.js flashGate: at most 3 in any second, 333 ms
 * apart, no saturated red.) One held back becomes a sprite flash on Billie who (a bright one: its white, a for dur
 * ms), never a late one, and is noted in the move's `anim` line */
function battleFlashGate(col, a, dur, who) {
  const why = flashGate(battleAnim.flashes, performance.now(), col, BATTLE_ANIMS.flashes);
  if (why === 'full') return true;
  if (battleAnim.cur && !battleAnim.cur.logged) battleAnim.cur.held.push(why);
  const s = who != null ? battleStage.s[who] : null;
  if (s && brightColor(col)) {
    s.white = Math.max(s.white || 0, a);
    battleStageKit.tween(s, 'white', 0, dur);
  }
  return false;
}
