// @ts-check
'use strict';
/* ===== BATTLE STAGE LOOK: MOODS AND SCARS (VFX track VFX-15) =====
   battleAnims.json's `moods` and `scars` turned into what the stage shows: the battle mood a move brings (a darken and
   a tint to its type on a big move or a super-effective hit, the row wave for Psychic and the Bureau's bots, heat for
   Fire's big moves), the scar a hit leaves, the cap on scars by the battle's quality and the oldest one replaced, and
   the dithered steps they fade in when the battle ends. battle-stage-look.js plays them on the stage and
   walk/battle-scars.js draws the scars. Logic only: no DOM, runs in Node (tools/test/battle-stage-look.test.mjs). */
/** @import { BattleAnimsData, BattleScars, Move } from '../../types/game-data' */
/**
 * @typedef {{ dark: number, tint: number, col: string, wave: number, heat: number, inMs: number, outMs: number,
 *   stepped: boolean }} BattleMood a move's mood: how much darker (0-0.2), how much of the tint and its colour
 *   ('type': the move type's glow; else a hex), the row wave's swing in whole pixels, heat shimmer, its times, and
 *   whether it steps on and off (Reduced motion) instead of easing
 * @typedef {{ kind: string, x: number, z: number, m: number, turn: number, flip: boolean }} BattleScar a scar: its
 *   kind, place (walk-scene metres), size, quarter turns and mirror
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  // @ts-expect-error -- replaced on purpose
  battleMoodFor: [() => battleMoodFor, v => (battleMoodFor = v)],
  // @ts-expect-error -- replaced on purpose
  scarAdd: [() => scarAdd, v => (scarAdd = v)],
  // @ts-expect-error -- replaced on purpose
  scarCap: [() => scarCap, v => (scarCap = v)],
  // @ts-expect-error -- replaced on purpose
  scarFadeShare: [() => scarFadeShare, v => (scarFadeShare = v)],
  // @ts-expect-error -- replaced on purpose
  scarKindFor: [() => scarKindFor, v => (scarKindFor = v)],
  // @ts-expect-error -- replaced on purpose
  scarSize: [() => scarSize, v => (scarSize = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the mood a move event brings, or null: only a landed move. big: power bigPower or more; a super-effective hit
 * counts too (moods.superEffective). bureau: the attacker is a Bureau bot (its colour and the wave whatever its type).
 * Reduced motion keeps the meaning (the darken and the tint) without the motion (no wave, no heat, stepped)
 * @param {{ miss?: boolean, blocked?: boolean, protect?: boolean, dmg?: number, te?: number }} an the move event
 * @param {Move} M @param {{ reduced?: boolean, bureau?: boolean }} ctx @param {BattleAnimsData} A
 * @returns {BattleMood | null} */
export function battleMoodFor(an, M, ctx, A) {
  const O = A.moods;
  if (!O || !an || !M || an.miss || an.blocked || an.protect) return null;
  const big = (M.p || 0) >= A.bigPower || (O.superEffective && !!an.dmg && (an.te ?? 1) > 1),
    bureau = !!ctx.bureau,
    reduced = !!ctx.reduced,
    waveOn = O.wave.types.includes(M.t) || (O.wave.bureau && bureau),
    wave = reduced || !waveOn ? 0 : big ? O.wave.bigPx : O.wave.px,
    heat = !reduced && big && O.heat.types.includes(M.t) ? O.heat.amount : 0,
    dark = big ? Math.min(0.2, O.dark) : 0,
    tint = big ? O.tint : 0;
  if (!dark && !tint && !wave && !heat) return null;
  return {
    dark,
    tint,
    col: bureau ? O.bureau : 'type',
    wave,
    heat,
    inMs: reduced ? 0 : O.inMs,
    outMs: reduced ? 0 : O.outMs,
    stepped: reduced,
  };
}

/** the scar a hit leaves, or null: a Sandstorm's hurt its sandstorm kind; else the kind its type names; else, on a
 * heavy hit (hitWeight w at least scars.heavy) or a KO, the heavy kind
 * @param {BattleScars | undefined} S @param {{ type?: string, w?: number, sandstorm?: boolean, ko?: boolean }} hit
 * @returns {string | null} */
export function scarKindFor(S, hit) {
  if (!S) return null;
  const K = Object.entries(S.kinds);
  if (hit.sandstorm) {
    const k = K.find(([, v]) => v.sandstorm);
    return k ? k[0] : null;
  }
  const t = K.find(([, v]) => !!hit.type && (v.types || []).includes(hit.type));
  if (t) return t[0];
  if (hit.ko || (hit.w || 0) >= S.heavy) {
    const h = K.find(([, v]) => v.heavy);
    return h ? h[0] : null;
  }
  return null;
}

/** how many scars the battle keeps at quality q (0-3) @param {BattleScars | undefined} S @param {number} q */
export function scarCap(S, q) {
  if (!S) return 0;
  return S.cap[Math.max(0, Math.min(3, q | 0))] | 0;
}

/** adds a scar, the oldest ones replaced past the cap (a cap of 0 keeps none); returns how many went
 * @template T @param {T[]} list @param {T} scar @param {number} cap */
export function scarAdd(list, scar, cap) {
  if (cap <= 0) {
    const n = list.length;
    list.length = 0;
    return n;
  }
  list.push(scar);
  const gone = Math.max(0, list.length - cap);
  if (gone) list.splice(0, gone);
  return gone;
}

/** the share of a scar still shown ms after the battle ended: whole until then, then down in `steps` equal steps over
 * fadeMs (1, .75, .5, .25 for four), 0 from fadeMs on @param {number} ms @param {number} fadeMs @param {number} steps */
export function scarFadeShare(ms, fadeMs, steps) {
  if (ms < 0) return 1;
  if (ms >= fadeMs || fadeMs <= 0) return 0;
  return 1 - Math.floor((ms * steps) / fadeMs) / steps;
}

/** a scar's size: its kind's, never over maxM @param {BattleScars} S @param {string} kind */
export function scarSize(S, kind) {
  const K = S.kinds[kind];
  return K ? Math.min(S.maxM, K.m) : 0;
}
