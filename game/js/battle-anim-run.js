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
import {
  BATTLE_ANIMS,
  BOSSES,
  FACTIONS,
  MOVES,
  TYPE_GLOW,
  activeBattle,
  battleMoodPlay,
  battlePropsReady,
  battleScarAt,
  hudHit,
  hudPop,
  provide,
  reducedMotion,
} from './hooks.js';
import { smearDialsSet, smearHistory } from './logic/smear.js';
import {
  battleAnimFor,
  battleAnimLogLine,
  battleAnimTimeline,
  battleEventProps,
  battlePartOffset,
  battleSceneProps,
  flashGate,
  hitLook,
  koAhead,
} from './logic/battle-anims.js';
import { battleFactionOf } from './logic/bureau-battle.js';
import { actorCenter, battleStage, battleStageFocus, battleStageKit, camAt, camHome } from './battle-stage.js';
/* eslint-disable no-func-assign */
expose({
  GLOWING_MOTIONS: [() => GLOWING_MOTIONS],
  animAt: [() => animAt, v => (animAt = v)],
  animBureau: [() => animBureau, v => (animBureau = v)],
  animColor: [() => animColor],
  animFamilyStep: [() => animFamilyStep, v => (animFamilyStep = v)],
  animKo: [() => animKo, v => (animKo = v)],
  animKoAhead: [() => animKoAhead, v => (animKoAhead = v)],
  animLinePoint: [() => animLinePoint, v => (animLinePoint = v)],
  animLog: [() => animLog, v => (animLog = v)],
  animPast: [() => animPast, v => (animPast = v)],
  animPoint: [() => animPoint, v => (animPoint = v)],
  animScar: [() => animScar, v => (animScar = v)],
  animSceneStep: [() => animSceneStep, v => (animSceneStep = v)],
  animStep: [() => animStep, v => (animStep = v)],
  animStepInfo: [() => animStepInfo, v => (animStepInfo = v)],
  animStrip: [() => animStrip, v => (animStrip = v)],
  battleAnim: [() => battleAnim],
  battleAnimPlay: [() => battleAnimPlay, v => ((battleAnimPlay = v), provide({ battleAnimPlay }))],
  battleAnimSkip: [() => battleAnimSkip, v => (battleAnimSkip = v)],
  battleBossPhaseScene: [
    () => battleBossPhaseScene,
    v => ((battleBossPhaseScene = v), provide({ battleBossPhaseScene })),
  ],
  battleFlashGate: [() => battleFlashGate, v => ((battleFlashGate = v), provide({ battleFlashGate }))],
  battleStageAt: [() => battleStageAt, v => (battleStageAt = v)],
  brightColor: [() => brightColor],
  foeContext: [() => foeContext, v => (foeContext = v)],
  kitLight: [() => kitLight, v => (kitLight = v)],
  sideFocus: [() => sideFocus],
});
/* eslint-enable no-func-assign */
provide({ battleAnimPlay, battleBossPhaseScene, battleFlashGate });
/* to-module: end */
/** the runner's state: the full-screen flashes shown in the last second (flashGate), the move playing (its id, its
 * timeline, the quality, the flashes held back) */
export const battleAnim = {
  flashes: { times: /** @type {number[]} */ ([]) },
  /** @type {{ mid: string, T: any, q: number, held: string[], logged: boolean } | null} */
  cur: null,
};

/* VFX-12: Part 1's dials (the afterimages, the ribbon, the stretch, a lunge's lean) are battleAnims.json `smears`
   (logic/smear.js): set once from the game's data as the page loads; the Studio sets them from its own as they're tuned */
if (BATTLE_ANIMS && BATTLE_ANIMS.smears) smearDialsSet(BATTLE_ANIMS.smears);

/** a step on the stage clock, ms from now; onSkip: what a skip runs instead (null: nothing) */
function animAt(ms, fn, onSkip) {
  battleStage.evs.push({ t: battleStage.t + ms, fn, onSkip });
}
/** VFX-8: battle sounds on the stage clock (they keep step with hit-stop and the battle speed, and a skip drops the
 * ones still to come); real time, as before, when the stage isn't running */
export function battleStageAt(ms, fn) {
  if (!battleStage.on) return void setTimeout(fn, Math.max(0, ms / (battleStage.speed || 1)));
  animAt(Math.max(0, ms), fn, null);
}
/** VFX-8: skips what is playing: the stage's flush, where the runner's steps do what their skip says */
export function battleAnimSkip() {
  battleStageKit.flush();
}

const animColor = (c, col) =>
  col === 'type' ? TYPE_GLOW[c.type] : col === 'kit' ? kitLight(c) : BATTLE_ANIMS.colors[col];
/* VFX-11: the colour a kit (or a named ramp) lights the stage with: its ramp's light, the move type's glow for 'type' */
function kitLight(c, ramp) {
  const R = BATTLE_ANIMS.ramps && BATTLE_ANIMS.ramps[ramp || (c.kit && c.kit.ramp) || c.type],
    L = R && R.light;
  return !L || L === 'type' ? TYPE_GLOW[c.type] || BATTLE_ANIMS.colors.white : L;
}
const sideFocus = i => (battleStageKit.actorTeam(i) === 0 ? 'me' : 'foe');
/** one step, on the stage now. c: the move's (its event, sides, type, the places it started from) */
function animStep(S, c) {
  /* VFX-11: a spread move's step marked `each` plays on every foe it hits */
  if (S.each && c.foes.length > 1 && !c.one) {
    for (const f of c.foes) animStep(S, foeContext(c, f));
    return;
  }
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
      const ti = S.on ? c.idx[S.on] : c.ti;
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
        ...K.lungeKind(!!S.dash, c.type),
      });
      return;
    case 'dust': {
      const A = c.P.attacker;
      K.addParticle({
        x: A.x,
        y: 0.15,
        z: A.z,
        vx: (K.fxRandom() - 0.5) * 1.2,
        vy: 0.6 + K.fxRandom() * 0.6,
        vz: (K.fxRandom() - 0.5) * 1.2,
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
        col: TYPE_GLOW[c.type],
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
        x: A.x + (K.fxRandom() - 0.5) * S.jitter,
        y: A.y + (K.fxRandom() - 0.5) * S.jitter,
        z: A.z,
        vx: (T.x - A.x) * v,
        vy: (T.y - A.y) * v + S.up,
        vz: (T.z - A.z) * v,
        ay: S.ay,
        life: S.life,
        spr: key,
        ramp: c.type,
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
        vx: (T.x - A.x) * S.speed + (K.fxRandom() - 0.5),
        vy: (T.y - A.y) * S.speed + S.up,
        vz: (T.z - A.z) * S.speed + S.side,
        life: S.life,
        spr: K.typeSprite(c.type, S.i),
        ramp: c.type,
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
        ramp: c.type,
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
    case 'beat': {
      /* VFX-13: a flurry's hit before the last, on the beat: a knock, a shake and a one-cell flash, each a little
         harder than the one before (the last, the hit step, the strongest); no hit-stop, so no time is added */
      const s = battleStage.s[c.ti],
        k = (S.i + 1) / ((S.n || 1) + 1);
      if (!s || !c.an.dmg) return;
      K.setActorAction(c.ti, 'hurt', 200);
      K.tween(s, 'ox', s.ox + c.dir * (2 + 4 * k), 30);
      K.tween(s, 'ox', 0, 90, 'out', 30);
      if (!reducedMotion) battleStage.shk = Math.max(battleStage.shk, 1 + 2 * k);
      s.white = Math.max(s.white || 0, 0.25 + 0.25 * k);
      K.tween(s, 'white', 0, BATTLE_ANIMS.tiers ? BATTLE_ANIMS.tiers.cell : 42, 'in');
      return;
    }
    case 'hit': {
      /* VFX-13: the tier's look; a KO's extra scar */
      const Lk = K.hitFx(c.ti, c.hitAn, null, animKo(c, c.ti));
      animScar(c, Lk);
      return;
    }
    default:
      animFamilyStep(S, c, i);
  }
}
/* ===== VFX-11: the families' steps (battleAnims.json families, in the move's type kit, `types`) =====
   Strips (VFX-10's art) in the kit's ramp, all in VFX-9's pool, its random numbers the event's own stream (fxRandom).
   A particle carries its strip (anim) and an icon for the 2D stage (spr). */
const GLOWING_MOTIONS = { flicker: 1, zigzag: 1, wave: 1, twotone: 1 };
/** a spread move's context for one of the foes it hits */
function foeContext(c, f) {
  const P = actorCenter(f);
  return {
    ...c,
    one: true,
    ti: f,
    P: { ...c.P, target: P, foe: P, subject: c.an.self ? c.P.subject : P },
    idx: { ...c.idx, target: f, foe: f, subject: c.an.self ? c.idx.subject : f },
  };
}
/** where a step happens: a Billie's middle, or (feet) the ground under it */
function animPoint(c, on, S) {
  const P = c.P[on || 'target'] || c.P.target,
    j = S && S.jitter ? S.jitter : 0,
    R = battleStageKit.fxRandom;
  return {
    x: P.x + (j ? (R() - 0.5) * j : 0),
    y: S && S.feet ? 0.05 : P.y + (S && S.dy ? S.dy : 0) + (j ? (R() - 0.5) * j : 0),
    z: P.z,
  };
}
/** the strip a step's i-th particle shows, its ramp (Dragon's two-tone: every other one the kit's second) and the icon
 * the 2D stage draws instead */
function animStrip(S, c, i) {
  /* VFX-17: an icons.png prop (a scene's mic, rocket, burger...) instead of a strip */
  if (S.icon && S.spr === undefined) {
    const I = [S.icon].flat();
    return { anim: null, ramp: S.ramp || c.type, spr: I[i % I.length] };
  }
  const L = [S.spr].flat().filter(Boolean),
    id = L.length ? L[i % L.length] : null,
    icons = BATTLE_ANIMS.iconSprites || {},
    icon = id && Object.keys(icons).find(k => icons[k].sprite === id);
  return {
    anim: id,
    ramp: S.ramp2 && i % 2 ? S.ramp2 : S.ramp || c.type,
    spr: icon || battleStageKit.typeSprite(c.type, i),
  };
}
function animFamilyStep(S, c, i) {
  const K = battleStageKit,
    R = K.fxRandom,
    kit = c.kit,
    glow = S.glow ?? (kit && GLOWING_MOTIONS[kit.motion] ? 1 : 0),
    stutter = kit && kit.motion === 'zigzag' ? 1 : 0;
  switch (S.do) {
    case 'impact': {
      const P = animPoint(c, S.on, S),
        St = animStrip(S, c, S.i);
      K.addParticle({ ...P, ...St, life: S.life || 400, k: S.k || 1, flip: (S.flip || 1) * c.dir, glow: 1 });
      return;
    }
    case 'spray': {
      if (S.i >= K.burstMax()) return;
      const P = animPoint(c, S.on, S),
        To = S.toward ? animPoint(c, S.toward) : null;
      for (let j = 0; j < (S.n2 || 1); j++) {
        const St = S.icon ? { spr: S.icon } : animStrip(S, c, S.i * (S.n2 || 1) + j),
          sp = S.speed ?? 2;
        let vx, vy, vz;
        if (To) {
          const dx = To.x - P.x,
            dy = To.y - P.y,
            dz = To.z - P.z,
            L = Math.hypot(dx, dy, dz) || 1,
            cn = S.cone || 0.3;
          vx = (dx / L) * sp + (R() - 0.5) * cn * sp;
          vy = (dy / L) * sp + (R() - 0.5) * cn * sp;
          vz = (dz / L) * sp + (R() - 0.5) * cn * sp;
        } else {
          const a = R() * Math.PI * 2,
            v = sp * (0.5 + R());
          vx = Math.cos(a) * v + (S.sweep ? c.dir * sp : 0);
          vy = (S.up ?? 1) * (0.6 + R() * 0.8);
          vz = Math.sin(a) * v * 0.6;
        }
        K.addParticle({
          ...P,
          ...St,
          vx,
          vy,
          vz,
          ay: To ? 0 : kit && kit.motion === 'flicker' ? 1.5 : -5,
          life: (S.life || 400) * (0.8 + R() * 0.4),
          k: S.k || 1,
          floor: S.floor ? 1 : 0,
          glow,
          stutter,
        });
      }
      return;
    }
    case 'rain': {
      const P = animPoint(c, S.on),
        r = S.r ?? 0.8,
        h = S.h ?? 2,
        life = S.life || 320;
      K.addParticle({
        x: P.x + (R() - 0.5) * 2 * r,
        y: P.y + h,
        z: P.z + (R() - 0.5) * r,
        vy: -(h + P.y * 0.5) / (life / 1000),
        ...animStrip(S, c, S.i),
        life,
        k: S.k || 1,
        glow,
        stutter,
      });
      return;
    }
    case 'orbit': {
      const P = animPoint(c, S.on),
        n = Math.max(1, S.n || 1);
      K.addParticle({
        ...P,
        ...animStrip(S, c, S.i),
        path: {
          kind: 'orbit',
          a: [P.x, P.y, P.z],
          b: [P.x, P.y - 0.3, P.z],
          amp: S.r ?? 0.6,
          h: S.h ?? 0.6,
          turns: S.turns ?? 1,
          ph: S.i / n,
        },
        life: S.life || 500,
        k: S.k || 1,
        glow,
        stutter,
      });
      return;
    }
    case 'rise': {
      const P = animPoint(c, S.on);
      K.addParticle({
        x: P.x + (R() - 0.5) * 0.8,
        y: S.down ? P.y + 0.6 : P.y - 0.3,
        z: P.z + (R() - 0.5) * 0.4,
        vy: S.down ? -1 : 1.1,
        ...animStrip(S, c, S.i),
        life: S.life || 500,
        k: S.k || 1,
        glow: S.glow ?? 1,
      });
      return;
    }
    case 'projectile': {
      const A = animPoint(c, S.from || 'attacker'),
        B = animPoint(c, S.to || 'target'),
        light = S.lit ? kitLight(c, S.ramp) : null;
      K.addParticle({
        ...A,
        ...animStrip(S, c, S.i),
        path: {
          kind: S.path || 'straight',
          a: [A.x, A.y, A.z],
          b: [B.x, B.y, B.z],
          h: S.h,
          amp: S.amp,
          turns: S.turns,
        },
        life: S.ms || 300,
        k: S.k || 1,
        trail: S.trail || 0,
        fade: false,
        glow: glow || (light ? 1 : 0),
        col: light || undefined,
        lightK: kit ? kit.light.k : 1,
        flick: kit && kit.light.flicker ? 1 : 0,
        stutter,
      });
      return;
    }
    case 'ray': {
      const A = c.P.attacker,
        T = c.P[S.to || 'target'] || c.P.target,
        life = S.life || 360,
        St = { anim: 'beam_strip', ramp: S.ramp || c.type, spr: K.typeSprite(c.type, 0) };
      K.addParticle({
        x: A.x,
        y: A.y,
        z: A.z,
        x2: T.x,
        y2: T.y,
        z2: T.z,
        beam: 1,
        col: TYPE_GLOW[c.type],
        w: 3,
        /* no icon: the 2D stage draws it as VFX-9's flat beam */
        anim: St.anim,
        ramp: St.ramp,
        k: S.k || 1,
        life,
        glow: 1,
      });
      for (const P of [A, T])
        K.addParticle({
          x: P.x,
          y: P.y,
          z: P.z,
          anim: 'beam_cap',
          ramp: St.ramp,
          spr: St.spr,
          k: S.k || 1,
          life,
          glow: 1,
        });
      return;
    }
    case 'light': {
      const P = animPoint(c, S.on),
        L = kit ? kit.light : { k: 1, ms: 200 },
        /* VFX-13: a light on the target follows the hit's tier: dim when resisted, brighter for a super or a crit
           (a crit's warm), never more lights */
        Tl = (S.on || 'target') === 'target' && c.look ? c.look : null;
      K.addParticle({
        ...P,
        y: P.y + 0.4,
        hide: 1,
        glow: 1,
        col: S.color
          ? animColor(c, S.color)
          : Tl && Tl.lightCol !== 'kit'
            ? animColor(c, Tl.lightCol)
            : kitLight(c, S.ramp),
        life: Math.min(300, S.ms || L.ms || 200),
        lightK: Math.min(2, (L.k ?? 1) * (Tl ? Tl.light : 1)),
        flick: L.flicker ? 1 : 0,
      });
      return;
    }
    case 'shake':
      if (!reducedMotion) battleStage.shk = Math.max(battleStage.shk, S.amt || 3);
      return;
    case 'jump': {
      const s = battleStage.s[i];
      if (!s) return;
      K.tween(s, 'oy', -(S.dy || 20), S.up || 120, 'out');
      K.tween(s, 'oy', 0, S.down || 120, 'in', (S.up || 120) + (S.hold || 0));
      return;
    }
    case 'pulse': {
      const A = c.P.attacker,
        B = animPoint(c, S.to || 'target'),
        t = (S.ms || 300) / 1000;
      K.addParticle({
        x: A.x,
        y: A.y,
        z: A.z,
        vx: (B.x - A.x) / t,
        vy: (B.y - A.y) / t,
        vz: (B.z - A.z) / t,
        ring: 1,
        r0: (S.r0 ?? 0.2) * 30,
        r1: (S.r1 ?? 0.8) * 30,
        col: animColor(c, S.color || 'kit'),
        life: S.ms || 300,
      });
      return;
    }
    default:
      animSceneStep(S, c);
  }
}
/* ===== VFX-17: a signature scene's own steps (battleAnims.json scenes) =====
   prop: a low-poly model summoned on a path (battle-3d.js draws battleStage.props, with smears); stamp: a drawn sound
   word stepped in; cut: the camera cuts to a Billie, with the impact frame when Flashes and the limiter allow it */
/** a point on the line from the attacker to the target: [x, z] moved `along` metres toward the target and `side`
 * metres across it */
function animLinePoint(c, P, along, side) {
  const A = c.P.attacker,
    T = c.P.target,
    dx = T.x - A.x,
    dz = T.z - A.z,
    L = Math.hypot(dx, dz) || 1;
  return [P.x + (dx / L) * along - (dz / L) * side, P.z + (dz / L) * along + (dx / L) * side];
}
function animSceneStep(S, c) {
  const K = battleStageKit;
  switch (S.do) {
    case 'prop': {
      if (!battleStage.props) battleStage.props = [];
      const to = c.P[S.to || 'target'] || c.P.target,
        A = c.P.attacker,
        T = c.P.target,
        [bx, bz] = animLinePoint(c, to, (S.dx || 0) + (S.through || 0), S.dz || 0),
        by = (S.y || 0) + (S.stack || 0) * (S.i || 0),
        b = [bx, by, bz],
        h = S.h ?? 3,
        from = S.from || 'above';
      let a = [bx, by + h, bz],
        kind = S.path || 'stamp';
      if (from === 'below') {
        a = [bx, by - h, bz];
        kind = S.path || 'straight';
      } else if (from === 'side' || from === 'behind') {
        const [x, z] = animLinePoint(c, A, -(S.off ?? (from === 'side' ? 4 : 1.2)), S.dz || 0);
        a = [x, by, z];
        kind = S.path || 'straight';
      } else if (from !== 'above') {
        const F = c.P[from] || A,
          [x, z] = animLinePoint(c, F, 0, S.dz || 0);
        a = [x, S.fromY ?? F.y, z];
        kind = S.path || 'arc';
      }
      battleStage.props.push({
        prop: S.prop,
        t0: battleStage.t,
        ms: S.ms || 300,
        /* until: the stage ms (from the move's start) it holds to, whichever repeat it is */
        hold: S.until !== undefined ? Math.max(0, S.until - (S.at || 0) - (S.ms || 300)) : S.hold || 0,
        out: S.out ?? 250,
        ease: S.ease,
        path: { kind, a, b, h: kind === 'stamp' ? h : S.arc, amp: S.amp, turns: S.turns },
        /* its heading along the attack (the model's +x toward the target), turned by yaw */
        yaw: Math.atan2(T.z - A.z, T.x - A.x) + (S.yaw || 0),
        turn: S.turn || 0,
        tumble: S.tumble || 0,
        ax: S.ax === 1 ? [1, 0, 0] : [0, 0, 1],
        mid: S.mid ?? 0.5,
        s: S.s || 1,
        trail: smearHistory(),
      });
      return;
    }
    case 'stamp': {
      /* not against a Bureau bot: the style track's SY-5 stamps its knockout (and a win against the Bureau), and two
         stamps must not land at once */
      if (c.foes.some(f => animBureau(f))) return;
      const P = c.P[S.on || 'attacker'] || c.P.attacker;
      K.addParticle({
        x: P.x,
        y: P.y + (S.dy ?? 0.9),
        z: P.z,
        anim: [S.spr].flat()[0],
        ramp: S.ramp || c.type,
        /* the 2D stage's stand-in */
        spr: 'excl',
        k: S.k || 2,
        life: S.life || 800,
        stampIn: 1,
        fade: false,
        glow: 1,
      });
      return;
    }
    case 'cut': {
      const ti = S.on ? c.idx[S.on] : c.ti;
      battleStageFocus(sideFocus(ti), true);
      camAt(ti, S.amt ?? 0.5, S.z ?? 0.18, (S.roll ?? 0.03) * (K.actorTeam(ti) === 1 ? 1 : -1), 1);
      K.impactCut(c.P[S.on || 'target'] || c.P.target, ti, BATTLE_ANIMS.colors.white);
      return;
    }
  }
}
/** what a skipped step still does: the hit's numbers */
function animStepInfo(S, c) {
  if (S.do === 'hit' && typeof hudHit === 'function') hudHit(c.ti, c.hitAn);
  /* VFX-15: a scar stays for the battle, so a skipped hit leaves its scar too (VFX-13: and a KO's) */
  if (S.do === 'hit') animScar(c, c.look);
}
/** VFX-15: the scar a landed hit leaves at the target's feet (battle-stage-look.js); VFX-13: a KO leaves one more (its
 * tier row's `scar`: the heavy kind) */
function animScar(c, L) {
  if (typeof battleScarAt !== 'function' || !c.an.dmg) return;
  const w = battleStageKit.hitWeight(c.ti, c.an);
  battleScarAt(c.ti, { type: c.type, w });
  for (let k = 0; k < ((L && L.scar) || 0); k++) battleScarAt(c.ti, { w, ko: true });
}
/** VFX-13: koAhead's for Billie i: whether this move knocks it out, and whether that is the battle's last KO */
function animKo(c, i) {
  const K = c.ka;
  return K && K.ko && K.si.includes(i) ? { ko: true, last: K.last } : null;
}
/** the move's `anim` line in the debug log, once (when its time is up, or a skip ends it) */
function animLog(C) {
  if (C.logged) return;
  C.logged = true;
  if (typeof debugLog !== 'undefined') debugLog.add('anim', battleAnimLogLine(C.mid, C.T, C.q, C.held));
}

/** VFX-11: whether Billie i is a Bureau bot (its moves play in the Bureau's kit; as battle-stage-look.js's mood) */
function animBureau(i) {
  const s = battleStage.s[i];
  return !!(s && typeof s.sp === 'string' && s.sp.startsWith('bot:'));
}
/** VFX-18b: a Bureau boss's phase with a shield (battle-stage.js alphaPhase; bosses.json phases): events.bossPhase's
 * prop steps on the boss (the "attacker" of VFX-17's prop step; the target the side it faces), inside the phase's own
 * time. None under Reduced motion, on the 2D stage, with 3D props off or before its models have loaded, for a phase
 * without a shield, or for a boss of another faction (an Alpha Billie's phase keeps its own look) */
function battleBossPhaseScene(an) {
  const E = BATTLE_ANIMS && BATTLE_ANIMS.events && BATTLE_ANIMS.events.bossPhase,
    si = an.si,
    s = battleStage.s[si],
    /* the boss's faction (bosses.json faction, as SY-5 reads it), not its bot look: another faction's boss gets none */
    f = s ? battleFactionOf(FACTIONS, BOSSES, { sp: s.sp, boss: true }, activeBattle && activeBattle.T) : null;
  if (!E || reducedMotion || !battleStage.gl || an.shield === false || !f || f.faction !== E.faction) return;
  if (!battlePropsReady(battleEventProps(BATTLE_ANIMS))) return;
  const K = battleStageKit,
    ti = battleStage.s.findIndex((s, k) => s && s.show && K.actorTeam(k) !== K.actorTeam(si)),
    A = actorCenter(si),
    T = ti >= 0 ? actorCenter(ti) : { ...A, x: A.x + (K.actorTeam(si) === 0 ? 4 : -4) },
    c = { si, ti, P: { attacker: A, target: T }, idx: { attacker: si, target: ti }, foes: [ti] };
  for (const S of E.steps) animAt(S.at || 0, () => animSceneStep(S, c), null);
}
/** VFX-8: plays a move event (the engine's `an`, only read) on the stage; {dur, hit} for battle.js */
function battleAnimPlay(an, ev) {
  const M = MOVES[an.mid],
    si = an.si,
    ti = an.ti ?? 1 - si,
    q = battleStage.q.lvl,
    /* VFX-17: a scene's models drawn now (else it plays its family), and whether it played before in this battle */
    pick = M ? battleAnimFor(an, M, BATTLE_ANIMS) : null,
    scene = pick && pick.kind === 'scene' ? pick.id : null,
    seen = battleStage.scenesSeen || (battleStage.scenesSeen = new Set()),
    T = M
      ? battleAnimTimeline(
          an,
          M,
          {
            gl: !!battleStage.gl,
            reduced: !!reducedMotion,
            q,
            speed: battleStage.speed,
            bureau: animBureau(si),
            props: !!scene && !!battleStage.gl && battlePropsReady(battleSceneProps(BATTLE_ANIMS, scene)),
            seen: !!scene && seen.has(scene),
          },
          BATTLE_ANIMS
        )
      : null;
  if (!T) return { dur: 0, hit: 999 };
  if (T.kind === 'scene') seen.add(T.id);
  /* VFX-17: the last move's summoned models go; this one's go when its time is up or a skip ends it */
  battleStage.props = [];
  const dropProps = () => {
    battleStage.props = [];
  };
  const ss = battleStageKit.actorTeam(si),
    A = actorCenter(si),
    Tg = actorCenter(ti),
    /* VFX-11: the foe a move on itself still points at (a hazard, a foreseen hit), every foe a spread move hits, an
       aimed move's part */
    foe = an.self && battleStage.s[si ^ 1] ? si ^ 1 : ti,
    foes = an.spread
      ? battleStage.s
          .map((s, k) => k)
          .filter(k => battleStage.s[k].show && battleStageKit.actorTeam(k) === battleStageKit.actorTeam(ti))
      : [ti],
    off = M.fx && M.fx.aim && an.part ? battlePartOffset(an.part) : null,
    Ta = off ? { x: Tg.x + off[0], y: off[1] ?? Tg.y, z: Tg.z } : Tg,
    c = {
      an,
      si,
      ti,
      ss,
      dir: ss === 0 ? 1 : -1,
      type: M.t,
      /* the move's type rides on a copy: the engine's event isn't written */
      hitAn: { ...an, t: M.t },
      P: {
        attacker: A,
        target: Ta,
        subject: an.self ? A : Ta,
        foe: foe === ti ? Ta : actorCenter(foe),
        /* VFX-13: where a miss goes: beside the target across the line of the attack, a little past it and up */
        past: animPast(A, Ta),
      },
      idx: { attacker: si, target: ti, subject: an.self ? si : ti, foe, past: ti },
      foes: foes.length ? foes : [ti],
      one: false,
      kit: (T.kit && BATTLE_ANIMS.types && BATTLE_ANIMS.types[T.kit]) || null,
      /* VFX-13: whether it knocks out what it hits (koAhead, read ahead in the turn's lines), and its tier's row */
      ka: animKoAhead(ev),
      look: null,
    },
    C = (battleAnim.cur = { mid: an.mid, T, q, held: [], logged: false });
  c.look = hitLook(c.hitAn, animKo(c, ti), battleStageKit.hitWeight(ti, an), BATTLE_ANIMS);
  /* VFX-9: the effects' random numbers for this event: the move, its sides and the event's place in the battle */
  battleStageKit.fxSeed(
    `${an.mid}|${si}|${ti}|${typeof activeBattle !== 'undefined' && activeBattle ? activeBattle.events.length : 0}`
  );
  /* VFX-15: the stage's mood for this move (battle-stage-look.js), on the stage clock, within its time */
  if (typeof battleMoodPlay === 'function') battleMoodPlay(an, M, c, T);
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
  animAt(T.dur, dropProps, dropProps);
  return { dur: T.dur, hit: T.hit };
}

/** VFX-13: a spot a miss goes to: 0.8 m beside the target across the line from the attacker, 0.4 m past it, 0.4 up */
function animPast(A, T) {
  const dx = T.x - A.x,
    dz = T.z - A.z,
    L = Math.hypot(dx, dz) || 1;
  return { x: T.x + (dz / L) * 0.8 + (dx / L) * 0.4, y: T.y + 0.4, z: T.z - (dx / L) * 0.8 + (dz / L) * 0.4 };
}
/** VFX-13: koAhead for the line playing, read from the battle's lines; a preview's line (the Studio's Battle effects,
 * tools/look-battle-anims.py) may carry its own (`ka`) */
function animKoAhead(ev) {
  if (ev && ev.ka) return ev.ka;
  const B = typeof activeBattle !== 'undefined' ? activeBattle : null;
  if (!B || !B.events) return null;
  const i = B.events.indexOf(ev);
  return i < 0 ? null : koAhead(B.events, i);
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
