// @ts-check
'use strict';
/* ===== BATTLE ANIMS: A MOVE'S ANIMATION AS DATA (VFX track VFX-8) =====
   battleAnims.json says how the battle plays a move: shared intro steps, then a family's (or a signature scene's)
   steps at stage-ms times. This file turns a move event into its timeline: which family (battleAnimFor), the steps
   whose gates hold, repeats spread out, the Faster variant, the quality, and the cap on extra time; battle-anim-run.js
   plays it on the stage. Also the hit's tier (hitTier) and whether a KO follows (koAhead), which the sound track
   (SND-13) and the UI track (UI-16b) read too, and the full-screen flash limiter (flashGate).
   The engine's events are only read, never written. Effects draw no random numbers here.
   Logic only: no DOM, runs in Node (tools/test/battle-anims.test.mjs). */
/** @import { BattleAnimsData, BattleAnimStep, Move } from '../../types/game-data' */
/**
 * @typedef {{ k: string, si?: number, ti?: number, mid?: string, dmg?: number, te?: number, crit?: boolean,
 *   miss?: boolean, blocked?: boolean, protect?: boolean, self?: boolean, spread?: boolean }} MoveAn a move event's `an`
 * @typedef {{ gl?: boolean, reduced?: boolean, q?: number, speed?: number }} AnimCtx the stage: 3D or not, Reduced
 *   motion, the battle's quality (0-3), its speed
 * @typedef {BattleAnimStep & { at: number, i: number, sync: boolean, skip: 'run' | 'info' | 'drop' }} AnimStep a
 *   timeline's step: when, which repeat, played at once (no `at` in the data) or on the stage clock, and what a skip
 *   does to it
 * @typedef {{ id: string, kind: 'family' | 'scene', variant: 'full' | 'short', dur: number, hit: number,
 *   tier: string, long: boolean, steps: AnimStep[] }} AnimTimeline
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_ANIM_SKIP: [() => BATTLE_ANIM_SKIP],
  HIT_TIERS: [() => HIT_TIERS],
  // @ts-expect-error -- replaced on purpose
  battleAnimFor: [() => battleAnimFor, v => (battleAnimFor = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimGates: [() => battleAnimGates, v => (battleAnimGates = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimLogLine: [() => battleAnimLogLine, v => (battleAnimLogLine = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimOutcome: [() => battleAnimOutcome, v => (battleAnimOutcome = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimTimeline: [() => battleAnimTimeline, v => (battleAnimTimeline = v)],
  // @ts-expect-error -- replaced on purpose
  flashGate: [() => flashGate, v => (flashGate = v)],
  // @ts-expect-error -- replaced on purpose
  hitTier: [() => hitTier, v => (hitTier = v)],
  // @ts-expect-error -- replaced on purpose
  koAhead: [() => koAhead, v => (koAhead = v)],
  // @ts-expect-error -- replaced on purpose
  redShare: [() => redShare, v => (redShare = v)],
  // @ts-expect-error -- replaced on purpose
  stepOn: [() => stepOn, v => (stepOn = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** what a skip (a tap, or the next line) does to a step: `run` it (the end framing), `info` (only what it tells: the
 * hit's numbers), anything else is dropped (pictures, sounds, camera moves, poses; tweens already running jump to their
 * end in battleStageFlush) */
export const BATTLE_ANIM_SKIP = /** @type {Record<string, 'run' | 'info'>} */ ({
  focus: 'run',
  pop: 'run',
  hit: 'info',
});
/** the hit tiers, weakest first (vfx-track.md "Hit tiers"; `none`: no damage shown) */
export const HIT_TIERS = ['none', 'resisted', 'neutral', 'super', 'super4', 'crit'];

/** a move event's outcome key in battleAnims.json `defaults`: miss, protect, blocked, or the category
 * @param {MoveAn} an @param {Move} M */
export function battleAnimOutcome(an, M) {
  return an.miss ? 'miss' : an.protect ? 'protect' : an.blocked ? 'blocked' : M.c;
}

/** which animation a move event plays: the move's own `anim` (a family or a scene) when it lands, else its outcome's
 * or category's default. null when the data has neither
 * @param {MoveAn} an @param {Move} M @param {BattleAnimsData} A @returns {{ id: string, kind: 'family' | 'scene' } | null} */
export function battleAnimFor(an, M, A) {
  if (!A || !M) return null;
  const out = battleAnimOutcome(an, M);
  if (out === M.c && M.anim) {
    if (A.scenes[M.anim]) return { id: M.anim, kind: 'scene' };
    if (A.families[M.anim]) return { id: M.anim, kind: 'family' };
  }
  const id = A.defaults[/** @type {keyof BattleAnimsData['defaults']} */ (out)];
  return id && A.families[id] ? { id, kind: 'family' } : null;
}

/** how hard a hit lands, by what it did: none (no damage), resisted, neutral, super (x2), super4 (x4 or more), crit
 * @param {MoveAn} an */
export function hitTier(an) {
  if (!an || !an.dmg || an.miss || an.blocked || an.protect) return 'none';
  if (an.crit) return 'crit';
  const te = an.te ?? 1;
  return te >= 4 ? 'super4' : te > 1 ? 'super' : te < 1 ? 'resisted' : 'neutral';
}

/** whether the move event at i knocks out what it hits: a `faint` of its target (any foe, for a spread move) before the
 * next move. Read ahead, not from the event's snapshot: refreshLastSnapshot refreshes only the last event, and an
 * alphaPhase or a spread move's second line may sit between. last: no later `enter` on that side and no later move,
 * so the battle ends with it
 * @param {{ an?: any }[]} events @param {number} i @returns {{ ko: boolean, si: number[], last: boolean }} */
export function koAhead(events, i) {
  const an = events[i] && events[i].an,
    side = (/** @type {number} */ k) => (k === 1 || k === 3 ? 1 : 0),
    /** @type {number[]} */ si = [];
  if (!an || an.k !== 'move' || an.ti == null) return { ko: false, si, last: false };
  const foe = side(an.ti);
  let j = i + 1;
  for (; j < events.length; j++) {
    const e = events[j].an;
    if (!e) continue;
    if (e.k === 'move') break;
    if (e.k === 'faint' && (e.si === an.ti || (an.spread && side(e.si) === foe))) si.push(e.si);
  }
  if (!si.length) return { ko: false, si, last: false };
  let last = true;
  for (let k = i + 1; k < events.length && last; k++) {
    const e = events[k].an;
    if (e && (e.k === 'move' || (e.k === 'enter' && side(e.si) === foe))) last = false;
  }
  return { ko: true, si, last };
}

/** the gates that hold for a move event (battleAnims.json's `if` words)
 * @param {MoveAn} an @param {Move} M @param {AnimCtx} ctx @param {BattleAnimsData} A @returns {Set<string>} */
export function battleAnimGates(an, M, ctx, A) {
  const G = /** @type {Set<string>} */ (new Set([M.c]));
  if (an.self) G.add('self');
  if (an.protect) G.add('protect');
  if (an.dmg) G.add('dmg');
  if (!an.miss && !an.blocked && !an.protect) G.add('landed');
  if ((M.p || 0) >= A.bigPower) G.add('power80');
  if (ctx.gl) G.add('gl');
  if (!ctx.reduced) G.add('motion');
  return G;
}

/** whether a step plays: its gates hold, its types include the move's, the quality allows it
 * @param {BattleAnimStep} S @param {Set<string>} G @param {string} type @param {number} q */
export function stepOn(S, G, type, q) {
  for (const g of S.if || []) if (g[0] === '!' ? G.has(g.slice(1)) : !G.has(g)) return false;
  if (S.types && !S.types.includes(type)) return false;
  return !(typeof S.maxQ === 'number' && q > S.maxQ);
}

/** a move event's timeline: the intro and its family's (or scene's) steps that play, each repeat its own step, in the
 * data's order (the order they are started in, which keeps ties in order on the stage clock). Its time is the family's,
 * capped at its outcome's `maxMs` (the time moves took before VFX-8) plus extraMs for a long move (a scene, or power longPower+; none under Reduced
 * motion), so nothing plays longer than allowed; the Faster speed plays the family's short variant if it has one.
 * null when the data has no animation for it
 * @param {MoveAn} an @param {Move} M @param {AnimCtx} ctx @param {BattleAnimsData} A @returns {AnimTimeline | null} */
export function battleAnimTimeline(an, M, ctx, A) {
  const pick = battleAnimFor(an, M, A);
  if (!pick) return null;
  const src = (pick.kind === 'scene' ? A.scenes : A.families)[pick.id],
    short = !!src.short && (ctx.speed || 1) >= A.shortSpeed,
    V = short && src.short ? src.short : src,
    G = battleAnimGates(an, M, ctx, A),
    q = ctx.q || 0,
    long = pick.kind === 'scene' || (M.p || 0) >= A.longPower,
    cap =
      A.maxMs[/** @type {keyof BattleAnimsData['maxMs']} */ (battleAnimOutcome(an, M))] +
      (long && !ctx.reduced ? A.extraMs : 0),
    dur = Math.min(V.dur, cap),
    /** @type {AnimStep[]} */ steps = [];
  for (const S of [...A.intro, ...V.steps]) {
    if (!stepOn(S, G, M.t, q)) continue;
    const { if: _if, types: _t, ...rest } = S,
      { n, every } = S,
      at0 = S.at ?? 0;
    for (let i = 0; i < (n || 1); i++)
      steps.push({
        ...rest,
        at: at0 + i * (every || 0),
        i,
        sync: S.at === undefined && !n,
        skip: BATTLE_ANIM_SKIP[S.do] || 'drop',
      });
  }
  return {
    id: pick.id,
    kind: pick.kind,
    variant: short ? 'short' : 'full',
    dur,
    hit: V.hit >= 999 ? V.hit : Math.min(V.hit, dur),
    tier: hitTier(an),
    long,
    steps,
  };
}

/** a colour's share of red, R / (R + G + B), from '#rrggbb' (0 for anything else): WCAG 2.3.1's saturated red is 0.8+
 * @param {string} col */
export function redShare(col) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(col || '');
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16));
  return r + g + b ? r / (r + g + b) : 0;
}

/** the full-screen flash limiter (WCAG 2.3.1; battleAnims.json `flashes`): may a full-screen flash in col start at now
 * (ms, real time)? 'full' (and it is counted in L), or why not: 'red' (saturated red), 'gap' (too soon after the last),
 * 'rate' (as many as allowed in the last second). One held back becomes a sprite flash, never a late one
 * @param {{ times: number[] }} L the flashes shown so far @param {number} now @param {string} col
 * @param {{ perSecond: number, gapMs: number, redShare: number }} rule @returns {'full' | 'red' | 'gap' | 'rate'} */
export function flashGate(L, now, col, rule) {
  if (redShare(col) >= rule.redShare) return 'red';
  L.times = L.times.filter(t => now - t < 1000 && t <= now);
  const last = L.times[L.times.length - 1];
  if (last !== undefined && now - last < rule.gapMs) return 'gap';
  if (L.times.length >= rule.perSecond) return 'rate';
  L.times.push(now);
  return 'full';
}

/** the debug log's `anim` line for a move: its id, family or scene, tier, variant, the quality, and the flashes the
 * limiter held back (why, each). No names, no save data
 * @param {string} mid @param {AnimTimeline | null} T @param {number} q @param {string[]} held */
export function battleAnimLogLine(mid, T, q, held) {
  if (!T) return `${mid} none`;
  return `${mid} ${T.kind}:${T.id} ${T.tier} ${T.variant} q${q}${T.long ? ' long' : ''}${held.length ? ' held:' + held.join(',') : ''}`;
}
