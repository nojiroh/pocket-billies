// @ts-check
'use strict';
/* ===== BATTLE FLOW: THE STAGE'S FLOW MOMENTS (VFX track VFX-16) =====
   What the stage needs to know for a battle's flow moments, from battleAnims.json `events`: who gets the VS splash
   (vsSplashFor), the Billie a level-up line is about (lvlSlot: the engine names it by uid), the share of a Billie
   shown while it dithers in or out (riseShare, stepped on 12 fps cells), a pyramid kind's ramp (pyramidRamp) and the
   portraits' whole-number scale (vsPortraitScale). battle-stage.js plays them; nothing here adds time to a line.
   Logic only: no DOM, runs in Node (tools/test/battle-flow.test.mjs). */
/** @import { BattleAnimEvents } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  FLOW_CELL_MS: [() => FLOW_CELL_MS],
  // @ts-expect-error -- replaced on purpose
  lvlSlot: [() => lvlSlot, v => (lvlSlot = v)],
  // @ts-expect-error -- replaced on purpose
  pyramidRamp: [() => pyramidRamp, v => (pyramidRamp = v)],
  // @ts-expect-error -- replaced on purpose
  riseShare: [() => riseShare, v => (riseShare = v)],
  // @ts-expect-error -- replaced on purpose
  vsPortraitScale: [() => vsPortraitScale, v => (vsPortraitScale = v)],
  // @ts-expect-error -- replaced on purpose
  vsSplashFor: [() => vsSplashFor, v => (vsSplashFor = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a cell of the stage's 12 fps clock (rule 3: loops and holds at 12 fps) */
export const FLOW_CELL_MS = 1000 / 12;

/** VFX-16: the fighter slot a level-up line is about. rules.js gainXp says it with the Billie's uid, not a slot, so the
 * slot is the one whose snapshot has that uid; an `si` is taken as given; -1 when it isn't on the field (the stage
 * then shows nothing; it read `an.si ?? 0` and so always played on slot 0)
 * @param {{ si?: number, uid?: any }} an @param {{ s?: ({ uid?: any } | null)[] } | null | undefined} ev */
export function lvlSlot(an, ev) {
  if (!an) return -1;
  if (typeof an.si === 'number') return an.si;
  if (an.uid == null || !ev || !Array.isArray(ev.s)) return -1;
  return ev.s.findIndex(s => !!s && s.uid === an.uid);
}

/** VFX-16: the VS splash a trainer battle opens with, or null: leaders, the rival (Blake) and bosses. role: the run
 * role (`runFoe`), else a hub trainer's (a boss or an Alpha: boss; a badge leader: miniboss; a rival id: rival);
 * type: the leader's type (its colour), else null
 * @param {any} T the trainer (gameData.trainers or a run's foe) @param {BattleAnimEvents['vs']} [E]
 * @returns {{ role: 'miniboss' | 'boss' | 'rival', type: string | null } | null} */
export function vsSplashFor(T, E) {
  if (!T || !E) return null;
  const role =
    T.runFoe === 'miniboss' || T.runFoe === 'boss' || T.runFoe === 'rival'
      ? T.runFoe
      : T.boss || T.alpha
        ? 'boss'
        : T.miniboss
          ? 'miniboss'
          : E.rivals.includes(T.id) || E.rivals.includes(T.from)
            ? 'rival'
            : null;
  if (!role || !E.foes.includes(role)) return null;
  return { role, type: typeof T.type === 'string' ? T.type : null };
}

/** VFX-16: the share of a Billie shown from its feet up (0 none, 1 all), t ms into a dither of ms, stepped on the 12 fps
 * clock: whole cells, so its edge climbs in held steps. out: the reverse (from all to none)
 * @param {number} t @param {number} ms @param {boolean} [out] */
export function riseShare(t, ms, out = false) {
  const n = Math.max(1, Math.round(ms / FLOW_CELL_MS)),
    k = t <= 0 ? 0 : t >= ms ? n : Math.min(n, Math.floor(t / FLOW_CELL_MS) + 1),
    v = k / n;
  return out ? 1 - v : v;
}

/** VFX-16: the ramp a pyramid kind's effects take (its own colours), the everyday pyramid's for an unknown kind
 * @param {BattleAnimEvents['sendOut']} E @param {string} [kind] */
export function pyramidRamp(E, kind) {
  if (!E) return 'None';
  return (kind && E.kinds[kind]) || E.kinds.pyramid || 'None';
}

/** VFX-16: the VS splash portraits' scale: a whole number (rule 2), at most `most`, so two portraits of `cropW` x
 * `cropH` art px take at most 44% of a stage `boxW` CSS px wide (the name between them) and 45% of its `boxH` high;
 * never under 1
 * @param {number} boxW @param {number} cropW @param {number} most @param {number} [boxH] @param {number} [cropH] */
export function vsPortraitScale(boxW, cropW, most, boxH = Infinity, cropH = 0) {
  if (!(cropW > 0)) return 1;
  const tall = cropH > 0 ? Math.floor((boxH * 0.45) / cropH) : Infinity;
  return Math.max(1, Math.min(Math.floor(most), Math.floor((boxW * 0.22) / cropW), tall));
}
