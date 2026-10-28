'use strict';
/* ================= BATTLE LOOKS: STATUSES, STATS AND SHORT EFFECTS ON THE STAGE (VFX track VFX-14) =================
   The stage side of UI-16b's tags, blips and pips: both read the same lines (the snapshots' status, stat stages and
   short effects, the battle's `by` report), and the stage takes each line's state when the plates repaint
   (battleLooksLine, from battle.js). It draws, in VFX-9's pool with VFX-10's strips and ramps:
   - lasting looks while they last: a burn's embers and warm flicker, paralysis's sparks, sleep's Z's (and a slower,
     lower idle with its head down), confusion's three orbiting stars, Soaked's drips, Fork's flickering copy,
     Protect's hex bubble, the shield's dome of hex cells (a cell cracks for each turn it wears down), sharp stones
     on a side, a delayed hit's mark in the sky; redrawn every 12 fps cell as short-lived particles (battleLooksTick);
   - what a line does: a status beginning, a turn of it (a lick of flame, a lost turn's held frame and gold edge, a
     snore), its end (waking pops), chevrons for a stat change (twice as many when it moved sharply: two stages or
     more, from the snapshots before and after), a bonk star when a confused Billie hits itself, a bubble or dome
     flashing on a block, a dome shattering, a glint for each Perk, held item, Gene or type passive that fires.
   Motion (rule 9): under Calm a lasting loop pulses once a turn (what a line does still plays); under Reduced motion
   nothing loops: the sprite takes its look's tint, and what stands still (the dome, the bubble, the stones, the mark)
   stays. The numbers are battleAnims.json `events` (logic/battle-looks.js reads them). The engine and its events are
   only read. No names or save data go anywhere. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { BATTLE_ANIMS, MOVES, PASSIVE, activeBattle, battle3dRgb, provide, reducedMotion, saveData } from './hooks.js';
import { random } from './util.js';
import {
  LOOK_CELL_MS,
  lookCell,
  lookChevrons,
  lookCracks,
  lookDiff,
  lookDomeCells,
  lookFlicker,
  lookForkOn,
  lookGlints,
  lookLoopOn,
  lookMotion,
  lookMoveLeaves,
  lookOrbit,
  lookSelfHit,
  lookSet,
  lookStageChange,
  lookStatusLine,
  lookStonePlaces,
  lookTint,
} from './logic/battle-looks.js';
import { actorCenter, actorTop, actorWorldPoint, battleStage, battleStageKit } from './battle-stage.js';
import { battleStageAt } from './battle-anim-run.js';
/* eslint-disable no-func-assign */
expose({
  battleLookBlock: [() => battleLookBlock, v => ((battleLookBlock = v), provide({ battleLookBlock }))],
  battleLookGhost: [() => battleLookGhost, v => (battleLookGhost = v)],
  battleLookHurt: [() => battleLookHurt, v => ((battleLookHurt = v), provide({ battleLookHurt }))],
  battleLookPose: [() => battleLookPose, v => ((battleLookPose = v), provide({ battleLookPose }))],
  battleLookSleepPose: [() => battleLookSleepPose, v => ((battleLookSleepPose = v), provide({ battleLookSleepPose }))],
  battleLookStat: [() => battleLookStat, v => ((battleLookStat = v), provide({ battleLookStat }))],
  battleLookStatus: [() => battleLookStatus, v => ((battleLookStatus = v), provide({ battleLookStatus }))],
  battleLooks: [() => battleLooks],
  battleLooksLine: [() => battleLooksLine, v => (battleLooksLine = v)],
  battleLooksReset: [() => battleLooksReset, v => ((battleLooksReset = v), provide({ battleLooksReset }))],
  battleLooksTick: [() => battleLooksTick, v => ((battleLooksTick = v), provide({ battleLooksTick }))],
  lookAnchor: [() => lookAnchor, v => (lookAnchor = v)],
  lookBurst: [() => lookBurst, v => (lookBurst = v)],
  lookCalm: [() => lookCalm],
  lookFlash: [() => lookFlash, v => (lookFlash = v)],
  lookFlashesOff: [() => lookFlashesOff],
  lookFrameNow: [() => lookFrameNow],
  lookMotionNow: [() => lookMotionNow],
  lookParticle: [() => lookParticle, v => (lookParticle = v)],
  lookPrev: [() => lookPrev, v => (lookPrev = v)],
  lookShieldShatter: [() => lookShieldShatter, v => (lookShieldShatter = v)],
  lookSlot: [() => lookSlot],
});
/* eslint-enable no-func-assign */
provide({
  battleLookBlock,
  battleLookHurt,
  battleLookPose,
  battleLookSleepPose,
  battleLookStat,
  battleLookStatus,
  battleLooksReset,
  battleLooksTick,
});
/* to-module: end */
/** the stage's looks: the snapshots the stage last took (a line's, when its plates repaint), per Billie its extra
 * state (the shield's turns when it rose, a flash, a held frame, an edge), the stones and delayed hits on each side,
 * the Calm pulse, the 12 fps cell last drawn */
const battleLooks = {
  /** @type {any[] | null} */
  seen: null,
  /** @type {any} */
  lastEv: null,
  /** @type {{ shieldMax: number, flashUntil: number, holdT: number, holdUntil: number, edgeUntil: number }[]} */
  s: [],
  stones: [false, false],
  /** @type {({ type: string } | null)[]} */
  delayed: [null, null],
  pulse: 0,
  wasChoosing: false,
  cell: -1,
};
/** a new battle: nothing on the stage yet */
function battleLooksReset() {
  battleLooks.seen = null;
  battleLooks.lastEv = null;
  battleLooks.s = [];
  battleLooks.stones = [false, false];
  battleLooks.delayed = [null, null];
  battleLooks.pulse = 0;
  battleLooks.wasChoosing = false;
  battleLooks.cell = -1;
}
const lookSlot = i =>
  battleLooks.s[i] || (battleLooks.s[i] = { shieldMax: 0, flashUntil: 0, holdT: 0, holdUntil: 0, edgeUntil: 0 });
/* UI-16a/b: the Animation level is Calm (settings-screen.js writes it on <html data-motion>) */
const lookCalm = () => typeof document !== 'undefined' && document.documentElement.dataset.motion === 'calm';
const lookMotionNow = () => lookMotion(!!reducedMotion, lookCalm());
/* Flashes off (rule 9, SY-1): a sprite flash at most half strength, no flicker, no glowing flash */
const lookFlashesOff = () =>
  typeof saveData !== 'undefined' && !!saveData && (saveData.preferences || {}).flashes === 'off';
/** the snapshots before a line: the line before it in the battle (the engine's own record), else what the stage
 * last took (the Studio's preview and the film tool play lines outside a battle) */
function lookPrev(ev) {
  const B = typeof activeBattle !== 'undefined' ? activeBattle : null,
    i = B && B.events ? B.events.indexOf(ev) : -1;
  if (i > 0) return { s: B.events[i - 1].s, an: B.events[i - 1].an };
  return { s: (ev && ev.prev) || battleLooks.seen, an: null };
}
/** where on Billie i a burst starts: its feet, its middle or the top of its head */
function lookAnchor(i, y) {
  if (y === 'top') return actorTop(i);
  if (y === 'mid') return actorCenter(i);
  const w = actorWorldPoint(i);
  return { x: w.x, y: w.y + 0.15, z: w.z };
}
/** one strip particle (battle-3d.js draws `anim`, a strip in sprites, in its ramp) */
function lookParticle(B, P, o) {
  battleStageKit.addParticle({
    x: P.x,
    y: P.y,
    z: P.z,
    vy: B.vy || 0,
    life: B.life || 500,
    anim: B.sprite,
    ramp: B.ramp || 'None',
    k: B.k || 1,
    frame: B.frame,
    flipY: !!B.flip,
    glow: B.glow ? 1 : 0,
    ...o,
  });
}
/** a burst on Billie i: n strips every ms apart, spread across; ramp overrides the data's (a move's type) */
function lookBurst(i, B, n, ramp) {
  if (!B || !battleStage.s[i]) return;
  const R = battleStageKit.fxRandom,
    count = n ?? B.n ?? 1;
  for (let j = 0; j < count; j++) {
    const go = () => {
      const P = lookAnchor(i, B.y || 'mid'),
        sp = B.spread || 0;
      lookParticle(
        B,
        { x: P.x + (R() - 0.5) * sp, y: P.y + (R() - 0.5) * sp * 0.4, z: P.z + (R() - 0.5) * sp * 0.4 },
        {
          vx: (R() - 0.5) * sp * 0.6,
          ...(ramp ? { ramp } : {}),
        }
      );
    };
    if (j && B.every) battleStageAt(j * B.every, go);
    else go();
  }
}
/* ---------- what a line does ---------- */
/** VFX-14: a status line (battle-stage.js case 'status'): a status beginning, a turn of one it had (a lost turn, a turn
 * asleep), or a broken part keeping a move from it (sparks: it showed flames before). The same time as before */
function battleLookStatus(an, ev) {
  const E = BATTLE_ANIMS.events,
    i = an.si,
    s = battleStage.s[i];
  if (!s) return { dur: 700, hit: 0 };
  const prev = lookPrev(ev).s,
    L = lookStatusLine(an, prev && prev[i] ? prev[i].st : null),
    look = E[L.key] || E.broken,
    reduced = !!reducedMotion;
  if (L.kind === 'start') {
    battleStageKit.setActorAction(i, 'dizzy', 800);
    if (!reduced || L.key === 'broken') lookBurst(i, look.start, reduced ? 2 : undefined);
    battleStageKit.blinkActor(i, 300);
  } else {
    lookBurst(i, look.tick, reduced ? 1 : undefined);
    /* a lost turn: a held frame and a gold edge (Reduced motion: the edge alone, still) */
    const S = lookSlot(i);
    if (look.hold && !reduced) {
      S.holdT = battleStage.t;
      S.holdUntil = battleStage.t + look.hold;
    }
    if (look.edge) S.edgeUntil = battleStage.t + look.edge.cells * LOOK_CELL_MS;
  }
  if (an.st) s.st = an.st;
  return { dur: 700, hit: 0 };
}
/** VFX-14: a stat line (case 'stat'): chevrons rising (teal) or falling (red), twice as many when it moved sharply;
 * Soaked, Fork and a shield fading send a stat line too, with no stage moved: their own look starts or ends instead.
 * The same time as before */
function battleLookStat(an, ev) {
  const E = BATTLE_ANIMS.events,
    i = an.si,
    s = battleStage.s[i];
  if (!s) return { dur: 680, hit: 0 };
  const prev = lookPrev(ev).s,
    ch = lookStageChange(prev, ev && ev.s, i),
    D = ch ? null : lookDiff(prev, ev && ev.s, i),
    reduced = !!reducedMotion;
  if (D && D.start.includes('soaked')) {
    battleStageKit.setActorAction(i, 'dizzy', 700);
    if (!reduced) lookBurst(i, E.soaked.start);
    return { dur: 680, hit: 0 };
  }
  if (D && D.start.includes('fork')) {
    battleStageKit.setActorAction(i, 'buff', 700);
    if (!reduced) lookBurst(i, E.fork.start);
    return { dur: 680, hit: 0 };
  }
  if (D && D.end.includes('shield')) {
    lookShieldShatter(i);
    return { dur: 680, hit: 0 };
  }
  const up = ch ? ch.d > 0 : an.up !== false,
    C = lookChevrons(E, up, ch ? ch.d : 1);
  battleStageKit.setActorAction(i, up ? 'buff' : 'dizzy', 700);
  lookBurst(i, C.B, reduced ? Math.min(2, C.n) : C.n);
  if (up) battleStageKit.groundRing(i, BATTLE_ANIMS.colors.guard, C.sharp ? 2 : 1.6, 520);
  battleStageKit.tween(s, 'white', 0.3, 120);
  battleStageKit.tween(s, 'white', 0, 240, 'lin', 140);
  return { dur: 680, hit: 0 };
}
/** a shield fading: its dome breaks up in shards */
function lookShieldShatter(i) {
  const D = BATTLE_ANIMS.events.shield;
  lookSlot(i).shieldMax = 0;
  if (!reducedMotion) lookBurst(i, D.end);
}
/** VFX-14: a hurt line's extra (case 'hurt'): a burn's turn licks flame; a confused Billie hitting itself gets a bonk
 * star; a spread move Protect blocked flashes the bubble. True when it drew the burn (the old flames are skipped) */
function battleLookHurt(an, ev) {
  const E = BATTLE_ANIMS.events,
    i = an.si;
  if (!battleStage.s[i]) return false;
  if (an.fx === 'brn') {
    lookBurst(i, E.brn.tick, reducedMotion ? 1 : undefined);
    return true;
  }
  if (an.fx === 'block') lookFlash(i);
  const P = lookPrev(ev);
  if (lookSelfHit(an, ev && ev.by, P.s, P.an)) lookBurst(i, E.confused.bonk);
  return false;
}
/** VFX-14: a block line (case 'block'): a shield that took the edge off a hit flashes its dome. True when it did */
function battleLookBlock(an, ev) {
  const x = ev && ev.s && ev.s[an.si];
  if (!x || !x.fx || !x.fx.shield) return false;
  lookFlash(an.si);
  return true;
}
/** a bubble or a dome flashing on a block */
function lookFlash(i) {
  const S = lookSlot(i),
    E = BATTLE_ANIMS.events;
  S.flashUntil = battleStage.t + Math.max(E.protect.flashMs, E.shield.flashMs);
}
/* ---------- a line's state, when its plates repaint ---------- */
/** VFX-14: takes a line's state (battle.js, beside the plates' repaint, and on a tap): looks that ended play their end
 * (waking pops, a burn's smoke), a shield that wore down cracks a cell, a block flashes the bubble, a landed move
 * leaves stones or a delayed hit, a delayed hit that lands goes, the report's glints pop one after another */
export function battleLooksLine(ev) {
  if (!ev || !ev.s || battleLooks.lastEv === ev) return;
  battleLooks.lastEv = ev;
  const E = BATTLE_ANIMS && BATTLE_ANIMS.events;
  if (!E) return;
  const was = battleLooks.seen,
    an = ev.an,
    reduced = !!reducedMotion,
    side = i => battleStageKit.actorTeam(i);
  for (let i = 0; i < ev.s.length; i++) {
    const x = ev.s[i];
    if (!x || !battleStage.s[i]) continue;
    const D = lookDiff(was, ev.s, i),
      S = lookSlot(i);
    if (D.swap) S.shieldMax = 0;
    if (x.fx && x.fx.shield && (!S.shieldMax || D.start.includes('shield'))) S.shieldMax = x.fx.shield;
    if (D.start.length && lookMotionNow() === 'calm') battleLooks.pulse = battleStage.t + E.pulseMs;
    if (D.swap || x.hp <= 0) continue;
    for (const k of D.end) {
      if (k === 'shield') continue;
      const L = E[k];
      if (!L || !L.end || reduced) continue;
      lookBurst(i, L.end);
      /* waking up pops: a hop */
      if (L.hop) {
        const st = battleStage.s[i];
        battleStageKit.tween(st, 'oy', -L.hop, 90, 'out');
        battleStageKit.tween(st, 'oy', 0, 140, 'in', 90);
      }
    }
    /* a shield that wore down a turn: its dome flashes (a cell cracks: battleLooksTick) */
    if (D.shield && D.shield.to > 0 && D.shield.to < D.shield.from) lookFlash(i);
  }
  if (an && an.k === 'move') {
    if (an.blocked && an.ti != null) lookFlash(an.ti);
    const M = MOVES[an.mid],
      left = lookMoveLeaves(an, M, side);
    if (left.stones != null) battleLooks.stones[left.stones] = true;
    if (left.delayed) battleLooks.delayed[left.delayed.side] = { type: left.delayed.type };
  }
  if (an && an.k === 'hurt' && an.fx === 'mail' && an.si != null) battleLooks.delayed[side(an.si)] = null;
  if (an && an.k === 'hurt' && an.fx === 'stones' && an.si != null) battleLooks.stones[side(an.si)] = true;
  /* the report's glints, one after another (Balatro's reveal): the start's boosts pop one by one */
  for (const g of lookGlints(ev.by, E.glint, p => Object.keys(PASSIVE).find(t => PASSIVE[t] === p))) {
    const B = { sprite: E.glint.sprite, ramp: g.ramp, life: E.glint.life, k: E.glint.k, y: 'mid', glow: true, vy: 0.4 };
    if (g.at) battleStageAt(g.at, () => lookBurst(g.si, B, 1));
    else lookBurst(g.si, B, 1);
  }
  battleLooks.seen = ev.s;
}
/* ---------- lasting looks, every 12 fps cell ---------- */
/** the strip frame a lasting loop shows now (it steps with the cell, round its frames) */
const lookFrameNow = (sprite, cell) => {
  const S = BATTLE_ANIMS.sprites[sprite];
  return S ? cell % S.frames : 0;
};
/** VFX-14: draws the lasting looks (battle-stage.js's frame, where the old status fizz was): on each new 12 fps cell,
 * the still parts (dome, bubble, stones, the mark) as particles that live one cell, and the loops (embers, sparks,
 * Z's, drips, the orbit) as they come due; the sprites' tints. Calm: the loops pulse once a turn */
function battleLooksTick() {
  const E = BATTLE_ANIMS && BATTLE_ANIMS.events,
    t = battleStage.t;
  if (!E) return;
  const choosing = !!battleStage.calm;
  if (battleLooks.wasChoosing && !choosing) battleLooks.pulse = t + E.pulseMs;
  battleLooks.wasChoosing = choosing;
  const motion = lookMotionNow(),
    loops = lookLoopOn(motion, t, battleLooks.pulse),
    seen = battleLooks.seen,
    calmFlash = lookFlashesOff();
  /* the tints: Reduced motion's still tint, a burn's flicker, a lost turn's gold edge */
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i],
      x = seen && seen[i],
      S = lookSlot(i),
      set = x && x.sp === s.sp ? lookSet(x) : new Set();
    let tint = null;
    if (S.edgeUntil > t) {
      const ed = E.par.edge;
      tint = [ed.color, ed.a * (calmFlash ? 0.5 : 1)];
    } else if (motion === 'reduced') {
      const R = lookTint(E, set);
      if (R) tint = [R.col, R.a];
    } else if (set.has('brn') && loops) {
      /* with Flashes off no flicker: a still warm tint at half the Reduced one */
      const f = calmFlash ? (E.brn.tintA || 0.2) / 2 : lookFlicker(E.brn.flicker, t);
      if (f > 0) tint = [E.brn.tint, f];
    }
    s.tint = tint ? [...battle3dRgb(tint[0]), tint[1]] : null;
  }
  const cell = lookCell(t);
  if (cell === battleLooks.cell) return;
  const dtCells = battleLooks.cell < 0 ? 1 : cell - battleLooks.cell;
  battleLooks.cell = cell;
  const q = battleStage.q.lvl | 0,
    life = LOOK_CELL_MS + 24,
    cap = { n: E.cells[Math.max(0, Math.min(3, q))] },
    put = (B, P, o) => {
      if (cap.n <= 0) return;
      cap.n--;
      lookParticle(B, P, { life, fade: false, amb: 1, ...o });
    },
    /* a loop due this cell: one every `every` ms */
    due = (every, k) =>
      every > 0 &&
      Math.floor((cell * LOOK_CELL_MS + k * 97) / every) !==
        Math.floor(((cell - dtCells) * LOOK_CELL_MS + k * 97) / every);
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i],
      x = seen && seen[i];
    if (!s || !s.show || s.a < 0.5 || !x || x.sp !== s.sp) continue;
    const set = lookSet(x),
      S = lookSlot(i);
    /* still: the shield's dome and Protect's bubble */
    for (const k of ['shield', 'protect']) {
      if (!set.has(k)) continue;
      const D = E[k],
        n = D.cells[Math.max(0, Math.min(3, q))],
        c = actorCenter(i),
        w = actorWorldPoint(i),
        hh = Math.max(0.2, c.y - w.y),
        out = battleStageKit.actorTeam(i) === 0 ? 1 : -1,
        cells = lookDomeCells(n, D.r, D.h, k === 'shield' ? Math.PI * 2 : (Math.PI * 2) / 3),
        cracked = k === 'shield' ? lookCracks(n, x.fx.shield, S.shieldMax || x.fx.shield) : 0,
        flash = S.flashUntil > t,
        bright = flash && !calmFlash;
      cells.forEach((C, j) =>
        put(
          { sprite: D.sprite, ramp: D.ramp, glow: bright },
          {
            x: w.x + C.out * hh * out * 0.6 + C.across * hh * 0.6,
            y: w.y + C.up * hh,
            z: w.z - C.out * hh * 0.4 + C.across * hh * 0.3,
          },
          { frame: flash ? D.flashFrame : j >= n - cracked ? D.crackFrame : D.frame, alpha: flash ? 1 : (D.a ?? 1) }
        )
      );
    }
    if (!loops) continue;
    /* moving: a status's loop and the effects' */
    for (const k of ['brn', 'par', 'slp', 'soaked']) {
      const L = E[k];
      if (!set.has(k) || !L.loop || !due(L.loop.every || 0, i)) continue;
      const P = lookAnchor(i, L.loop.y || 'mid'),
        sp = L.loop.spread || 0,
        R = random;
      if (cap.n <= 0) break;
      cap.n--;
      lookParticle(
        L.loop,
        { x: P.x + (R() - 0.5) * sp, y: P.y + (R() - 0.5) * sp * 0.3, z: P.z + (R() - 0.5) * sp * 0.3 },
        { amb: 1 }
      );
    }
    if (set.has('confused')) {
      const O = E.confused.orbit,
        T = actorTop(i),
        w = actorWorldPoint(i),
        r = O.r * Math.max(0.2, T.y - w.y);
      for (const p of lookOrbit(O.n, O.turnMs, t))
        put(
          E.confused.loop,
          { x: T.x + p.x * r, y: T.y + 0.05 + p.z * r * 0.25, z: T.z + p.z * r * 0.6 },
          {
            frame: lookFrameNow(E.confused.loop.sprite, cell),
          }
        );
    }
  }
  /* the sides: sharp stones round each Billie's feet, a delayed hit's mark in the sky */
  for (let i = 0; i < battleStage.s.length; i++) {
    const s = battleStage.s[i];
    if (!s || !s.show) continue;
    const sd = battleStageKit.actorTeam(i),
      w = actorWorldPoint(i);
    if (battleLooks.stones[sd]) {
      const St = E.stones;
      lookStonePlaces(St.n, St.r, i + 1).forEach(p =>
        put(St, { x: w.x + p.x, y: 0.03, z: w.z + p.z }, { frame: St.frame ?? 0 })
      );
      if (loops && St.glint && due(St.glint.every || 0, i + 5)) {
        const p = lookStonePlaces(St.n, St.r, i + 1)[cell % St.n];
        put(St.glint, { x: w.x + p.x, y: 0.12, z: w.z + p.z }, { life: St.glint.life || 250 });
      }
    }
  }
  for (let sd = 0; sd < 2; sd++) {
    const M = battleLooks.delayed[sd];
    if (!M) continue;
    const i = battleStage.s.findIndex((s, j) => s && s.show && battleStageKit.actorTeam(j) === sd);
    if (i < 0) continue;
    const c = actorCenter(i),
      Dl = E.delayed;
    put(
      { sprite: Dl.sprite, ramp: Dl.ramp === 'type' ? M.type : Dl.ramp, glow: true },
      { x: c.x, y: c.y + Dl.y, z: c.z },
      {
        frame: loops ? lookFrameNow(Dl.sprite, cell) : 0,
      }
    );
  }
}
/* ---------- the rig: sleep's idle, a lost turn's held frame, Fork's copy ---------- */
/** VFX-14: how Billie i's rig is posed now (battle-stage.js actorBuffer): `now`, the stage time it is posed at (held
 * on a lost turn), and `sleep` while asleep: a slower clock, lower, its head down. null: as usual */
function battleLookPose(i) {
  const E = BATTLE_ANIMS && BATTLE_ANIMS.events,
    s = battleStage.s[i],
    x = battleLooks.seen && battleLooks.seen[i];
  if (!E || !s) return null;
  const S = battleLooks.s[i],
    t = battleStage.t,
    held = S && S.holdUntil > t,
    asleep = !!(x && x.sp === s.sp && x.st === 'slp' && x.hp > 0);
  if (!held && !asleep) return null;
  const I = E.slp.idle || {};
  return {
    now: held ? S.holdT : t,
    sleep: asleep ? { t: (held ? S.holdT : t) * (I.slow || 1), sink: I.sink || 0, droop: I.droop || 0 } : null,
  };
}
/** VFX-14: lays sleep's pose on a rig's pose channels (skeleton-rig.js rigPose): lower, the head down, eyes shut */
function battleLookSleepPose(P, sl) {
  P.y += sl.sink;
  P.hdy += 1;
  P.head += sl.droop;
  P.face = 'blink';
  return P;
}
/** VFX-14: Fork's flickering copy of Billie i (battle-3d.js draws it as an afterimage): how far aside and how strong;
 * null when it shows none (Calm outside its pulse, Reduced motion: a tint instead) */
export function battleLookGhost(i) {
  const E = BATTLE_ANIMS && BATTLE_ANIMS.events,
    s = battleStage.s[i],
    x = battleLooks.seen && battleLooks.seen[i];
  if (!E || !s || !x || x.sp !== s.sp || !x.fx || !x.fx.fork || x.hp <= 0) return null;
  const t = battleStage.t;
  if (!lookLoopOn(lookMotionNow(), t, battleLooks.pulse) || !lookForkOn(t)) return null;
  return { dx: (battleStageKit.actorTeam(i) === 0 ? -1 : 1) * (E.fork.dx || 0), fade: E.fork.fade ?? 0.5 };
}
