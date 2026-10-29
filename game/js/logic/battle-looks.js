// @ts-check
'use strict';
/* ===== BATTLE LOOKS: STATUSES, STAT CHANGES AND SHORT EFFECTS ON THE STAGE (VFX track VFX-14) =====
   What the stage shows for a Billie's lasting state, read from the same events and snapshots the plates read
   (UI-16b: the status, the stat stages `stg`, the short effects `fx`, the battle's `by` report): which looks begin and
   end on a line, how far a stat moved ("sharply" is two stages or more, from the snapshots before and after), a
   confused Billie hitting itself, what a landed move leaves on a side (sharp stones, a delayed hit), the glints a
   line fires, and the stepped clocks the loops run on (12 fps). battle-looks.js plays it; battleAnims.json `events`
   holds the numbers. The engine and its events are only read, never written.
   Logic only: no DOM, runs in Node (tools/test/battle-looks.test.mjs). */
/** @import { BattleAnimEvents, BattleLook, BattleLookBurst } from '../../types/game-data' */
/**
 * @typedef {{ uid?: any, hp?: number, st?: string | null, stg?: Record<string, number>, fx?: Record<string, number> }
 *   | null} LookSnap a fighter's snapshot (logic/battle-engine.js actorSnapshot), the parts read here
 * @typedef {'full' | 'calm' | 'reduced'} LookMotion
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_LOOK_KEYS: [() => BATTLE_LOOK_KEYS],
  LOOK_CELL_MS: [() => LOOK_CELL_MS],
  // @ts-expect-error -- replaced on purpose
  lookCell: [() => lookCell, v => (lookCell = v)],
  // @ts-expect-error -- replaced on purpose
  lookChevrons: [() => lookChevrons, v => (lookChevrons = v)],
  // @ts-expect-error -- replaced on purpose
  lookCracks: [() => lookCracks, v => (lookCracks = v)],
  // @ts-expect-error -- replaced on purpose
  lookDiff: [() => lookDiff, v => (lookDiff = v)],
  // @ts-expect-error -- replaced on purpose
  lookDomeCells: [() => lookDomeCells, v => (lookDomeCells = v)],
  // @ts-expect-error -- replaced on purpose
  lookFlicker: [() => lookFlicker, v => (lookFlicker = v)],
  // @ts-expect-error -- replaced on purpose
  lookForkOn: [() => lookForkOn, v => (lookForkOn = v)],
  // @ts-expect-error -- replaced on purpose
  lookGlints: [() => lookGlints, v => (lookGlints = v)],
  // @ts-expect-error -- replaced on purpose
  lookLoopOn: [() => lookLoopOn, v => (lookLoopOn = v)],
  // @ts-expect-error -- replaced on purpose
  lookMotion: [() => lookMotion, v => (lookMotion = v)],
  // @ts-expect-error -- replaced on purpose
  lookMoveLeaves: [() => lookMoveLeaves, v => (lookMoveLeaves = v)],
  // @ts-expect-error -- replaced on purpose
  lookOrbit: [() => lookOrbit, v => (lookOrbit = v)],
  // @ts-expect-error -- replaced on purpose
  lookSelfHit: [() => lookSelfHit, v => (lookSelfHit = v)],
  // @ts-expect-error -- replaced on purpose
  lookSet: [() => lookSet, v => (lookSet = v)],
  // @ts-expect-error -- replaced on purpose
  lookStageChange: [() => lookStageChange, v => (lookStageChange = v)],
  // @ts-expect-error -- replaced on purpose
  lookStatusLine: [() => lookStatusLine, v => (lookStatusLine = v)],
  // @ts-expect-error -- replaced on purpose
  lookStonePlaces: [() => lookStonePlaces, v => (lookStonePlaces = v)],
  // @ts-expect-error -- replaced on purpose
  lookTint: [() => lookTint, v => (lookTint = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a 12 fps cell, ms: lasting loops and holds step on it (vfx-track.md "How Part 2 fits the art", rule 3) */
export const LOOK_CELL_MS = 1000 / 12;
/** the lasting looks a Billie can have, in the order a Reduced motion tint picks one: its status, then its short
 * effects (the plate's tags, logic/battle-engine.js fieldEffects) */
export const BATTLE_LOOK_KEYS = ['brn', 'par', 'slp', 'confused', 'soaked', 'fork', 'protect', 'shield'];

/** the 12 fps cell a stage time falls in @param {number} t */
export function lookCell(t) {
  return Math.floor(t / LOOK_CELL_MS);
}
/** the motion level the looks follow: Reduced motion first, then Calm (UI-16a's level), else Full
 * @param {boolean} reduced @param {boolean} calm @returns {LookMotion} */
export function lookMotion(reduced, calm) {
  return reduced ? 'reduced' : calm ? 'calm' : 'full';
}
/** whether a lasting loop moves now: always under Full, under Calm only in its turn's pulse (rule 9: idle loops pulse
 * once a turn), never under Reduced motion (a tint says it instead)
 * @param {LookMotion} motion @param {number} t @param {number} pulseUntil */
export function lookLoopOn(motion, t, pulseUntil) {
  return motion === 'full' || (motion === 'calm' && t < pulseUntil);
}
/** the lasting looks a fighter's snapshot shows: its status and its short effects; none once it has fainted
 * @param {LookSnap} x @returns {Set<string>} */
export function lookSet(x) {
  const S = /** @type {Set<string>} */ (new Set());
  if (!x || (x.hp ?? 1) <= 0) return S;
  if (x.st) S.add(x.st);
  for (const [k, n] of Object.entries(x.fx || {})) if (n) S.add(k);
  return S;
}
/** what changed on Billie i between two lines' snapshots: looks begun, looks ended (`swap`: another Billie stands
 * there now, so the old looks just go), and the shield's turns when they changed
 * @param {LookSnap[] | null | undefined} prev @param {LookSnap[] | null | undefined} next @param {number} i */
export function lookDiff(prev, next, i) {
  const p = (prev && prev[i]) || null,
    n = (next && next[i]) || null,
    swap = !!(p && n && p.uid !== n.uid),
    A = swap ? new Set() : lookSet(p),
    B = lookSet(n),
    ps = (p && p.fx && p.fx.shield) || 0,
    ns = (n && n.fx && n.fx.shield) || 0;
  return {
    start: [...B].filter(k => !A.has(k)),
    end: [...A].filter(k => !B.has(k)),
    swap,
    shield: !swap && ps !== ns ? { from: ps, to: ns } : null,
  };
}
/** the stat that moved most for Billie i between two snapshots and by how many stages (+ up); null when none moved
 * (Soaked, Fork and a shield fading send a stat line with no stage change)
 * @param {LookSnap[] | null | undefined} prev @param {LookSnap[] | null | undefined} next @param {number} i
 * @returns {{ stat: string, d: number } | null} */
export function lookStageChange(prev, next, i) {
  const p = prev && prev[i],
    n = next && next[i];
  if (!p || !n || p.uid !== n.uid) return null;
  const a = p.stg || {},
    b = n.stg || {};
  /** @type {{ stat: string, d: number } | null} */
  let best = null;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (d && (!best || Math.abs(d) > Math.abs(best.d))) best = { stat: k, d };
  }
  return best;
}
/** a stat change's chevrons: up or down, and how many (sharply: two stages or more, times `sharply`)
 * @param {BattleAnimEvents} E @param {boolean} up @param {number} d stages (0 or missing: one) */
export function lookChevrons(E, up, d) {
  const B = up ? E.stat.up : E.stat.down,
    sharp = Math.abs(d || 1) >= 2;
  return { B, n: Math.round((B.n || 1) * (sharp ? E.stat.sharply : 1)), sharp };
}
/** what a status line is: a status beginning (`start`), one it already had acting on its turn (`tick`: a turn
 * asleep, a lost turn), or no status at all: a broken part keeping a move from it (`broken`, which showed flames)
 * @param {{ st?: string | null }} an @param {string | null | undefined} prevSt its status on the line before
 * @returns {{ key: string, kind: 'start' | 'tick' }} */
export function lookStatusLine(an, prevSt) {
  if (!an.st) return { key: 'broken', kind: 'start' };
  return { key: an.st, kind: prevSt === an.st ? 'tick' : 'start' };
}
/** whether a hurt line is a confused Billie hitting itself (the engine says so only in words): a plain hurt (no
 * effect, no type, no report) on a Billie confused on the line before, not straight after its own move (a miss's
 * crash) @param {any} an @param {any[] | undefined} by @param {LookSnap[] | null | undefined} prev @param {any} prevAn */
export function lookSelfHit(an, by, prev, prevAn) {
  if (!an || an.k !== 'hurt' || an.fx || an.te || an.t || (by && by.length)) return false;
  const p = prev && prev[an.si];
  if (!p || !p.fx || !p.fx.confused) return false;
  return !(prevAn && prevAn.k === 'move' && prevAn.si === an.si);
}
/** what a landed move leaves on a side: sharp stones, or a delayed hit in the move's type. The side is its target's,
 * as the engine has it (a Scatter Stones aimed at itself lays them on its own side)
 * @param {any} an the move event @param {{ t?: string, fx?: any } | null | undefined} M its move
 * @param {(i: number) => number} sideOf a fighter's side (0 yours) */
export function lookMoveLeaves(an, M, sideOf) {
  const out = {
    stones: /** @type {number | null} */ (null),
    delayed: /** @type {{ side: number, type: string } | null} */ (null),
  };
  if (!an || an.k !== 'move' || !M || an.miss || an.blocked || an.protect || an.ti == null) return out;
  const fx = M.fx || {},
    side = sideOf(an.ti);
  if (fx.stones) out.stones = side;
  if (fx.delay) out.delayed = { side, type: M.t || 'None' };
  return out;
}
/** the glints a line's report (`by`) fires, one after another: who, when (ms after the line's plates repaint) and in
 * which ramp (a type passive in its type's; a Perk, held item or Gene in glint.ramps), as UI-16b's blips read it
 * @param {any[] | undefined} by @param {BattleAnimEvents['glint']} G
 * @param {(passive: string) => string | undefined} passiveType the type whose passive it is */
export function lookGlints(by, G, passiveType) {
  /** @type {{ si: number, at: number, ramp: string }[]} */
  const out = [];
  for (const b of by || []) {
    if (!b || b.si == null) continue;
    const src = String(b.src || ''),
      cut = src.indexOf(':'),
      kind = cut < 0 ? (src === 'unstable' ? 'unstable' : 'perk') : src.slice(0, cut),
      id = cut < 0 ? src : src.slice(cut + 1),
      ramp = kind === 'passive' ? passiveType(id) || 'None' : G.ramps[kind] || G.ramps.perk || 'None';
    out.push({ si: b.si, at: out.length * G.gapMs, ramp });
  }
  return out;
}
/** how many of a dome's n cells are cracked: one share for each turn of its shield used up
 * @param {number} n @param {number} left turns left @param {number} max turns it rose with */
export function lookCracks(n, left, max) {
  if (!(max > 0)) return 0;
  return Math.max(0, Math.min(n, Math.round(n * (1 - left / max))));
}
/** the places of a dome's n cells round a Billie, in its half-heights: `out` toward the other side, `across`, `up`.
 * A full dome (arc 2π): one cell on top, the rest in a ring; a bubble (a smaller arc): a row in front
 * @param {number} n @param {number} r @param {number} h @param {number} arc radians */
export function lookDomeCells(n, r, h, arc) {
  /** @type {{ out: number, across: number, up: number }[]} */
  const out = [];
  if (n <= 0) return out;
  const full = arc >= Math.PI * 2 - 1e-6;
  if (full) out.push({ out: 0, across: 0, up: h });
  const m = full ? n - 1 : n;
  for (let i = 0; i < m; i++) {
    const a = full ? (i / m) * Math.PI * 2 : m === 1 ? 0 : -arc / 2 + (i / (m - 1)) * arc;
    out.push({ out: Math.cos(a) * r, across: Math.sin(a) * r, up: full ? h * 0.45 : h * 0.5 });
  }
  return out;
}
/** the orbit's n stars at stage time t (a turn in turnMs), stepped at 12 fps: unit-circle places
 * @param {number} n @param {number} turnMs @param {number} t */
export function lookOrbit(n, turnMs, t) {
  const a0 = ((lookCell(t) * LOOK_CELL_MS) / turnMs) * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    return { x: Math.cos(a), z: Math.sin(a) };
  });
}
/** a burn's warm flicker now: the pattern's amount for this 12 fps cell @param {number[] | undefined} L @param {number} t */
export function lookFlicker(L, t) {
  return L && L.length ? L[lookCell(t) % L.length] : 0;
}
/** Fork's copy shows on two 12 fps cells of every four @param {number} t */
export function lookForkOn(t) {
  return lookCell(t) % 4 < 2;
}
/** the stones' places round a Billie's feet: n pebbles at about r m, the same each time for the same seed
 * @param {number} n @param {number} r @param {number} seed */
export function lookStonePlaces(n, r, seed) {
  const g = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const a = seed * 1.7 + i * g,
      d = r * (0.55 + 0.45 * (((i * 7 + seed * 3) % 5) / 4));
    return { x: Math.cos(a) * d, z: Math.sin(a) * d * 0.6 };
  });
}
/** the tint a Billie's lasting looks give its sprite under Reduced motion (the meaning without the motion): the first of
 * its looks with one; null when none @param {BattleAnimEvents} E @param {Set<string>} S
 * @returns {{ col: string, a: number } | null} */
export function lookTint(E, S) {
  for (const k of BATTLE_LOOK_KEYS) {
    const L = /** @type {BattleLook | undefined} */ (/** @type {any} */ (E)[k]);
    if (S.has(k) && L && L.tint) return { col: L.tint, a: L.tintA ?? 0.2 };
  }
  return null;
}
