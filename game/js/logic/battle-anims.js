// @ts-check
'use strict';
/* ===== BATTLE ANIMS: A MOVE'S ANIMATION AS DATA (VFX track VFX-8) =====
   battleAnims.json says how the battle plays a move: shared intro steps, then a family's (or a signature scene's)
   steps at stage-ms times. This file turns a move event into its timeline: which family (battleAnimFor), the steps
   whose gates hold, repeats spread out, the Faster variant, the quality, and the cap on extra time; battle-anim-run.js
   plays it on the stage. Also the hit's tier (hitTier) and whether a KO follows (koAhead), which the sound track
   (SND-13) and the UI track (UI-16b) read too, how the hit lands by its tier (hitLook, VFX-13; the tier names stay
   hitTier's, a KO only a flag on top), and the full-screen flash limiter (flashGate).
   The engine's events are only read, never written. Effects draw no random numbers here.
   Logic only: no DOM, runs in Node (tools/test/battle-anims.test.mjs). */
/** @import { BattleAnimsData, BattleAnimStep, BattleAnimKit, BattleAnimFamily, Move } from '../../types/game-data' */
/**
 * @typedef {{ k: string, si?: number, ti?: number, mid?: string, dmg?: number, te?: number, crit?: boolean,
 *   miss?: boolean, blocked?: boolean, protect?: boolean, self?: boolean, spread?: boolean, part?: string }} MoveAn a move event's `an`
 * @typedef {{ gl?: boolean, reduced?: boolean, q?: number, speed?: number, bureau?: boolean, props?: boolean,
 *   seen?: boolean }} AnimCtx the stage: 3D or not, Reduced motion, the battle's quality (0-3), its speed, and whether
 *   the attacker is a Bureau bot (VFX-11); VFX-17: whether a scene's models can be drawn (3D props on, loaded) and
 *   whether the move's scene has played before in this battle
 * @typedef {BattleAnimStep & { at: number, i: number, sync: boolean, skip: 'run' | 'info' | 'drop' }} AnimStep a
 *   timeline's step: when, which repeat, played at once (no `at` in the data) or on the stage clock, and what a skip
 *   does to it
 * @typedef {{ id: string, kind: 'family' | 'scene', variant: 'full' | 'short' | 'miss', dur: number, hit: number,
 *   tier: string, long: boolean, kit: string | null, steps: AnimStep[], repeat?: boolean }} AnimTimeline the kit: the
 *   type kit it plays in (battleAnims.json types; VFX-11); repeat: a scene's short version because it played before
 *   in this battle (VFX-17)
 */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_ANIM_ART_DIR: [() => BATTLE_ANIM_ART_DIR],
  BATTLE_ANIM_OUTCOMES: [() => BATTLE_ANIM_OUTCOMES],
  BATTLE_ANIM_SKIP: [() => BATTLE_ANIM_SKIP],
  BATTLE_KIT_ROLES: [() => BATTLE_KIT_ROLES],
  HIT_TIERS: [() => HIT_TIERS],
  IMPACT_FRAME_MS: [() => IMPACT_FRAME_MS],
  TIER_ROWS: [() => TIER_ROWS],
  // @ts-expect-error -- replaced on purpose
  battleAnimFor: [() => battleAnimFor, v => (battleAnimFor = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimFrame: [() => battleAnimFrame, v => (battleAnimFrame = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimGates: [() => battleAnimGates, v => (battleAnimGates = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimLogLine: [() => battleAnimLogLine, v => (battleAnimLogLine = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimOutcome: [() => battleAnimOutcome, v => (battleAnimOutcome = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimPreviewEvent: [() => battleAnimPreviewEvent, v => (battleAnimPreviewEvent = v)],
  // @ts-expect-error -- replaced on purpose
  battleAnimTimeline: [() => battleAnimTimeline, v => (battleAnimTimeline = v)],
  // @ts-expect-error -- replaced on purpose
  battleIconSprite: [() => battleIconSprite, v => (battleIconSprite = v)],
  // @ts-expect-error -- replaced on purpose
  battleKitFor: [() => battleKitFor, v => (battleKitFor = v)],
  // @ts-expect-error -- replaced on purpose
  battleKitRoles: [() => battleKitRoles, v => (battleKitRoles = v)],
  // @ts-expect-error -- replaced on purpose
  battleKitSteps: [() => battleKitSteps, v => (battleKitSteps = v)],
  // @ts-expect-error -- replaced on purpose
  battlePartOffset: [() => battlePartOffset, v => (battlePartOffset = v)],
  // @ts-expect-error -- replaced on purpose
  battlePathAt: [() => battlePathAt, v => (battlePathAt = v)],
  // @ts-expect-error -- replaced on purpose
  battlePropAt: [() => battlePropAt, v => (battlePropAt = v)],
  // @ts-expect-error -- replaced on purpose
  battleRampColors: [() => battleRampColors, v => (battleRampColors = v)],
  // @ts-expect-error -- replaced on purpose
  battleSceneFallback: [() => battleSceneFallback, v => (battleSceneFallback = v)],
  // @ts-expect-error -- replaced on purpose
  battleSceneProps: [() => battleSceneProps, v => (battleSceneProps = v)],
  // @ts-expect-error -- replaced on purpose
  flashGate: [() => flashGate, v => (flashGate = v)],
  // @ts-expect-error -- replaced on purpose
  hitLook: [() => hitLook, v => (hitLook = v)],
  // @ts-expect-error -- replaced on purpose
  hitTier: [() => hitTier, v => (hitTier = v)],
  // @ts-expect-error -- replaced on purpose
  hurtKoAhead: [() => hurtKoAhead, v => (hurtKoAhead = v)],
  // @ts-expect-error -- replaced on purpose
  koAhead: [() => koAhead, v => (koAhead = v)],
  // @ts-expect-error -- replaced on purpose
  lineAfterMove: [() => lineAfterMove, v => (lineAfterMove = v)],
  // @ts-expect-error -- replaced on purpose
  propPace: [() => propPace, v => (propPace = v)],
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

/** VFX-12: the outcomes the look tool films and the Studio's Battle effects plays: a normal hit, super effective (x2,
 * x4), not very effective, a crit, a super-effective crit, a miss, a move into a Guard */
export const BATTLE_ANIM_OUTCOMES = ['hit', 'se', 'x4', 'nve', 'crit', 'secrit', 'miss', 'blocked'];

/** VFX-12: a move event for one of BATTLE_ANIM_OUTCOMES, by side si against the other, as the look tool films it and
 * the Studio plays it (made up: the engine never runs). Guard is always a protect, a status move that lands on no foe
 * is on itself; only a damaging move gets damage, effectiveness and a crit
 * @param {string} mid @param {Move} M @param {number} si @param {string} res @returns {MoveAn} */
export function battleAnimPreviewEvent(mid, M, si, res) {
  const fx = /** @type {Record<string, any>} */ (M.fx || {}),
    onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe || fx.copyTypes,
    /** @type {MoveAn} */ an = { k: 'move', si, ti: 1 - si, mid };
  if (fx.protect) an.protect = true;
  else if (!onFoe) an.self = true;
  else if (res === 'miss') an.miss = true;
  else if (res === 'blocked') an.blocked = true;
  else if (M.c !== 'X') {
    an.dmg =
      /** @type {Record<string, number>} */ ({ crit: 48, se: 56, x4: 80, nve: 11, hit: 24, secrit: 70 })[res] ?? 24;
    an.te = /** @type {Record<string, number>} */ ({ se: 2, x4: 4, nve: 0.5, secrit: 2 })[res] || 1;
    an.crit = res === 'crit' || res === 'secrit';
  }
  return an;
}

/** a move event's outcome key in battleAnims.json `defaults`: miss, protect, blocked, or the category
 * @param {MoveAn} an @param {Move} M */
export function battleAnimOutcome(an, M) {
  return an.miss ? 'miss' : an.protect ? 'protect' : an.blocked ? 'blocked' : M.c;
}

/** which animation a move event plays: the move's own `anim` (a family or a scene) when it lands, else its outcome's
 * or category's default. null when the data has neither
 * @param {MoveAn} an @param {Move} M @param {BattleAnimsData} A @returns {{ id: string, kind: 'family' | 'scene', miss?: boolean } | null} */
export function battleAnimFor(an, M, A) {
  if (!A || !M) return null;
  const out = battleAnimOutcome(an, M);
  if (out === M.c && M.anim) {
    if (A.scenes[M.anim]) return { id: M.anim, kind: 'scene' };
    if (A.families[M.anim]) return { id: M.anim, kind: 'family' };
  }
  /* VFX-13: a miss plays its family's own whiff when the family has one (a scene's, its family's) */
  if (out === 'miss' && M.anim) {
    /* a scene names its family (VFX-17's `family`) */
    const S = /** @type {any} */ (A.scenes[M.anim]),
      fid = S && S.family ? S.family : M.anim,
      F = A.families[fid];
    if (F && F.miss) return { id: fid, kind: 'family', miss: true };
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

/** VFX-20: koAhead for a hurt line (a burn, the delayed hit, a spread move's second target, recoil, stones...): its
 * Billie faints before the next move (or the next hurt line of its own) and whether that is the battle's last KO, in
 * koAhead's shape. A blocked hit (no damage) never knocks out. koAhead itself reads move lines only (SND-13 reads it)
 * @param {{ an?: any }[]} events @param {number} i @returns {{ ko: boolean, si: number[], last: boolean }} */
export function hurtKoAhead(events, i) {
  const an = events[i] && events[i].an,
    side = (/** @type {number} */ k) => (k === 1 || k === 3 ? 1 : 0),
    /** @type {number[]} */ si = [];
  if (!an || an.k !== 'hurt' || an.si == null || !an.dmg || an.fx === 'block') return { ko: false, si, last: false };
  for (let j = i + 1; j < events.length; j++) {
    const e = events[j].an;
    if (!e) continue;
    if (e.k === 'move' || (e.k === 'hurt' && e.si === an.si)) break;
    if (e.k === 'faint' && e.si === an.si) {
      si.push(an.si);
      break;
    }
  }
  if (!si.length) return { ko: false, si, last: false };
  const foe = side(an.si);
  let last = true;
  for (let k = i + 1; k < events.length && last; k++) {
    const e = events[k].an;
    if (e && (e.k === 'move' || (e.k === 'enter' && side(e.si) === foe))) last = false;
  }
  return { ko: true, si, last };
}

/** VFX-13: the rows of battleAnims.json `tiers` a hit can add on top of its tier: a KO, and the last KO (or a boss's) */
export const TIER_ROWS = ['resisted', 'neutral', 'super', 'super4', 'crit', 'ko', 'last'];

/**
 * @typedef {{ tier: string, ko: null | 'ko' | 'last', stop: number, shake: number, kb: number, burst: number,
 *   spread: number, light: number, lightCol: string, ring: number, punch: number, handheld: number,
 *   flash: { col: string, a: number, ms: number } | null, ca: number, impact: string | null,
 *   sprite: { white: number, dark: number, ms: number, darkMs: number } | null, puff: number, scar: number }} HitLook
 *   what a hit shows: hit-stop ms (real time: the stage holds), shake, knockback px, the burst (particles, speed),
 *   the light's strength (times the kit's) and colour ('kit', or a battleAnims.json colour), the ground ring (m),
 *   the zoom punch and the handheld wobble, the full-screen flash (colour 'type' or a colour key; through flashFor
 *   and the flash gate), the chromatic pulse (ms), the impact frame's kind, the sprite flash (white then dark), a
 *   dull puff (dust particles) and the extra scars
 */
/** VFX-13: how a hit lands, from the tier table (battleAnims.json `tiers`): its tier's row (hitTier) with the hit's
 * weight w (battle-stage.js hitWeight: the share of the target's HP it took), then the KO's row on top when it knocks
 * the target out (koAhead), then the last KO's (no one comes in after and the battle ends, or a boss falls). A super
 * crit takes the crit's row with the super's chromatic pulse, burst and shake. Only hit-stop adds time: a KO one cell,
 * the last KO a freeze of `freeze` ms in all. null for no damage (a miss, a block, a status move)
 * @param {MoveAn} an @param {{ ko?: boolean, last?: boolean } | null | undefined} ka koAhead's
 * @param {number} w @param {BattleAnimsData} A @param {boolean} [boss] the target is a boss's
 * @returns {HitLook | null} */
export function hitLook(an, ka, w, A, boss = false) {
  const T = A && A.tiers,
    tier = hitTier(an);
  if (!T || tier === 'none') return null;
  const R = T[/** @type {'neutral'} */ (tier)],
    ww = Math.max(0, Math.min(1, w || 0)),
    lin = (/** @type {number | undefined} */ a, /** @type {number | undefined} */ k) => (a || 0) + (k || 0) * ww,
    /** @type {HitLook} */ L = {
      tier,
      ko: null,
      stop: lin(R.stop, R.stopW),
      shake: lin(R.shake, R.shakeW),
      kb: lin(R.kb, R.kbW),
      burst: R.burst,
      spread: R.spread,
      light: R.light,
      lightCol: R.lightCol || 'kit',
      ring: lin(R.ring, R.ringW),
      punch: R.punch || (R.punchW && ww > R.punchW ? 0.03 + ww * 0.04 : 0),
      handheld: R.handheld || 0,
      flash: R.flash ? { col: R.flash.color, a: R.flash.a, ms: R.flash.ms } : null,
      ca: R.ca || 0,
      impact: R.impact || null,
      sprite: R.sprite ? { white: R.sprite.white || 0, dark: R.sprite.dark || 0, ms: R.sprite.ms, darkMs: 0 } : null,
      puff: R.puff || 0,
      scar: 0,
    };
  if (tier === 'crit' && (an.te ?? 1) > 1) {
    const S = T.super;
    L.ca = Math.max(L.ca, S.ca || 0);
    L.burst = Math.max(L.burst, S.burst);
    L.shake = Math.max(L.shake, S.shake);
    L.punch += T.superCritPunch || 0;
  }
  if (!ka || !ka.ko) return L;
  /** @param {any} K */
  const add = K => {
    L.stop += K.stop || 0;
    L.shake = K.shakeTo ? Math.max(L.shake + (K.shake || 0), K.shakeTo) : L.shake + (K.shake || 0);
    L.kb += K.kb || 0;
    L.burst += K.burst || 0;
    L.scar += K.scar || 0;
    if (K.sprite) L.sprite = { white: K.sprite.white, dark: K.sprite.dark, ms: K.sprite.ms, darkMs: K.sprite.darkMs };
    if (K.impact && !L.impact) L.impact = K.impact;
  };
  L.ko = 'ko';
  add(T.ko);
  if (ka.last || boss) {
    L.ko = 'last';
    add(T.last);
    L.stop = Math.max(L.stop, T.last.freeze || 0);
  }
  return L;
}

/** VFX-13: what a heal or a hurt line follows: the move line before it in the same move's lines (a drain's heal, a
 * crash's recoil), or null. drain: Billie si healed from the target of a move it used that drains (its fx.drain);
 * recoil: si hurt after a move of its own that missed (fx.missCost: it crashed). Read only
 * @param {{ an?: any }[]} events @param {number} i @param {Record<string, Move>} moves
 * @returns {{ kind: 'drain' | 'recoil', from: number, mid: string } | null} */
export function lineAfterMove(events, i, moves) {
  const an = events[i] && events[i].an;
  if (!an || (an.k !== 'heal' && an.k !== 'hurt')) return null;
  for (let j = i - 1; j >= 0; j--) {
    const e = events[j] && events[j].an;
    if (!e || e.k !== 'move') continue;
    const M = moves[e.mid],
      fx = (M && M.fx) || {};
    if (e.si !== an.si) return null;
    if (an.k === 'heal' && fx.drain && !e.miss && e.dmg) return { kind: 'drain', from: e.ti, mid: e.mid };
    if (an.k === 'hurt' && fx.missCost && e.miss) return { kind: 'recoil', from: e.ti, mid: e.mid };
    return null;
  }
  return null;
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
  /* VFX-11: what the move does beside its damage (moves.json fx), its spread, an aimed part, a Bureau bot's move */
  const fx = /** @type {Record<string, any>} */ (M.fx || {});
  if (fx.drain) G.add('drain');
  if (fx.heal) G.add('heal');
  if (fx.tgtStage && Object.values(fx.tgtStage).some(v => v < 0)) G.add('drop');
  if (an.spread) G.add('spread');
  if (fx.aim && an.part) G.add('aim');
  if (ctx.bureau) G.add('bureau');
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
  const pick = battleSceneFallback(battleAnimFor(an, M, A), ctx, A);
  if (!pick) return null;
  const fam = (pick.kind === 'scene' ? A.scenes : A.families)[pick.id],
    /* VFX-13: a family's miss is a timeline of its own (no Faster variant: its time is today's miss's) */
    src = /** @type {BattleAnimFamily} */ ((pick.miss && fam.miss) || fam),
    /* VFX-17: a scene seen before in this battle plays its short version (the prop and the hit, no wind-up) */
    repeat = pick.kind === 'scene' && !!ctx.seen,
    short = !!src.short && ((ctx.speed || 1) >= A.shortSpeed || repeat),
    V = short && src.short ? src.short : src,
    G = battleAnimGates(an, M, ctx, A),
    q = ctx.q || 0,
    long = pick.kind === 'scene' || (M.p || 0) >= A.longPower,
    cap =
      A.maxMs[/** @type {keyof BattleAnimsData['maxMs']} */ (battleAnimOutcome(an, M))] +
      (long && !ctx.reduced ? A.extraMs : 0),
    dur = Math.min(V.dur, cap),
    kit = battleKitFor(A, M.t, !!ctx.bureau),
    /** @type {AnimStep[]} */ steps = [];
  for (const S0 of battleKitSteps([...A.intro, ...V.steps], kit ? kit.K : undefined, G, M.t, q)) {
    const S = battleKitRoles(S0, kit ? kit.K : undefined);
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
    variant: pick.miss ? 'miss' : short ? 'short' : 'full',
    dur,
    hit: V.hit >= 999 ? V.hit : Math.min(V.hit, dur),
    tier: hitTier(an),
    long,
    kit: kit ? kit.id : null,
    steps,
    ...(repeat && short ? { repeat: true } : {}),
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
  return `${mid} ${T.kind}:${T.id} ${T.tier} ${T.variant}${T.repeat ? ' repeat' : ''} q${q}${T.long ? ' long' : ''}${held.length ? ' held:' + held.join(',') : ''}`;
}
/* ===== VFX-10: the effect art's timing and colour =====
   A strip's frames are stepped on the stage clock: 12 fps (its fps), an impact's first two frames at 24 fps. A strip
   that loops plays round; one that doesn't plays once, ending with its particle's life (so its eroding last frames
   are its fade), or from its start when it is an impact or has no life. */
export const IMPACT_FRAME_MS = 1000 / 24;
/** the effect strips' folder, inside art/ (tools/build-battle-anims.py draws them; a strip is <id>.png) */
export const BATTLE_ANIM_ART_DIR = 'battle/anims/';
provide({ BATTLE_ANIM_ART_DIR }); /* to-module */
/** the frame a strip shows ageMs into a particle's life (stage ms)
 * @param {{ frames: number, fps?: number, impact?: boolean, loop?: boolean }} S @param {number} age
 * @param {number} [life] */
export function battleAnimFrame(S, age, life = 0) {
  const n = S.frames | 0;
  if (n <= 1) return 0;
  const step = 1000 / (S.fps || 12),
    lead = S.impact ? Math.min(2, n) : 0,
    len = lead * IMPACT_FRAME_MS + (n - lead) * step;
  let t = Math.max(0, age);
  if (S.loop) t %= len;
  else if (!S.impact && life > 0) t = Math.max(0, len - Math.max(0, life - age));
  const f =
    t < lead * IMPACT_FRAME_MS
      ? Math.floor(t / IMPACT_FRAME_MS)
      : lead + Math.floor((t - lead * IMPACT_FRAME_MS) / step);
  return Math.min(n - 1, Math.max(0, f));
}
/** a ramp's 8 colours (index 7 the white core) and its light colour
 * @param {{ ramp: string | string[], light: string }} R @param {Record<string, string[] | string>} paletteRamps
 *   NW_PALETTE.ramps @param {string} white the core's colour (battleAnims.json colors.white)
 * @param {string} [glow] the type's glow (types.json), for light 'type' (white without one)
 * @returns {{ steps: string[], light: string } | null} */
export function battleRampColors(R, paletteRamps, white, glow) {
  const S = !R ? null : Array.isArray(R.ramp) ? R.ramp : paletteRamps && paletteRamps[R.ramp];
  if (!Array.isArray(S) || S.length < 7) return null;
  return { steps: [...S.slice(0, 7), white], light: R.light === 'type' ? glow || white : R.light };
}
/** the strip an icons.png particle is drawn with (battleAnims.json iconSprites) and its ramp: its type's when it has
 * one with a ramp, else the icon's own; null when the icon stays an icon
 * @param {BattleAnimsData} A @param {string} key @param {string} [type] */
export function battleIconSprite(A, key, type) {
  const I = A && A.iconSprites && A.iconSprites[key];
  if (!I || !A.sprites[I.sprite]) return null;
  return { sprite: I.sprite, ramp: type && A.ramps[type] ? type : I.ramp };
}
/* ===== VFX-11: the type kits and the paths things fly on =====
   A family's steps say what happens (a projectile, an impact, a spray...); the move's type kit (battleAnims.json
   types: the Bureau's for a Bureau bot's move, else the move's type, else None) says with what: a step's sprite may be
   a role (shot, impact, small, bits) the kit fills, its ramp is the kit's unless the step names one, `path: kit` is
   the kit's path, and a `kit` step plays the kit's own cast or hit steps at its time. */
/** the sprite roles a step's `spr` may name */
export const BATTLE_KIT_ROLES = ['shot', 'impact', 'small', 'bits'];
/** the type kit a move plays in: the Bureau's for a Bureau bot, else its type's, else None's (null: no kits)
 * @param {BattleAnimsData} A @param {string} type @param {boolean} [bureau] @returns {{ id: string, K: BattleAnimKit } | null} */
export function battleKitFor(A, type, bureau = false) {
  const T = A && A.types;
  if (!T) return null;
  const id = bureau && T.Bureau ? 'Bureau' : T[type] ? type : T.None ? 'None' : null;
  return id ? { id, K: T[id] } : null;
}
/** a step list with each `kit` step replaced by its kit's steps for that part (cast or hit), at its time plus theirs,
 * on its Billie unless they name one, behind its gates and theirs. A kit step whose gates fail adds nothing
 * @param {BattleAnimStep[]} L @param {BattleAnimKit | undefined} K @param {Set<string>} G @param {string} type
 * @param {number} q @returns {BattleAnimStep[]} */
export function battleKitSteps(L, K, G, type, q) {
  /** @type {BattleAnimStep[]} */
  const out = [];
  for (const S of L) {
    if (S.do !== 'kit') {
      out.push(S);
      continue;
    }
    if (!K || !stepOn(S, G, type, q)) continue;
    const part = /** @type {BattleAnimStep[] | undefined} */ (K[/** @type {'cast' | 'hit'} */ (S.part)]);
    for (const k of part || []) {
      /** @type {BattleAnimStep} */
      const E = { ...k, on: k.on || S.on };
      if (S.each) E.each = S.each;
      if (S.at !== undefined || k.at !== undefined) E.at = (S.at ?? 0) + (k.at ?? 0);
      const gates = [...(S.if || []), ...(k.if || [])];
      if (gates.length) E.if = gates;
      else delete E.if;
      out.push(E);
    }
  }
  return out;
}
/** a step with its kit's sprite roles, ramp and path filled in (the step's own win; only steps that draw a sprite)
 * @param {BattleAnimStep} S @param {BattleAnimKit | undefined} K @returns {BattleAnimStep} */
export function battleKitRoles(S, K) {
  if (!K || (S.spr === undefined && S.path === undefined)) return S;
  const R = { ...S };
  if (typeof S.spr === 'string' && BATTLE_KIT_ROLES.includes(S.spr)) {
    const v = K[/** @type {'shot' | 'impact' | 'small' | 'bits'} */ (S.spr)];
    R.spr = v === undefined ? K.impact : v;
  }
  if (S.path === 'kit') R.path = K.path;
  if (R.ramp === undefined) R.ramp = K.ramp;
  if (K.ramp2 && R.ramp2 === undefined && S.ramp === undefined) R.ramp2 = K.ramp2;
  return R;
}
/** where a thing on a path is at u (0 at its start, 1 at its end), battle metres [x, y, z] (y up). Paths: straight;
 * arc (h metres up at its middle); zigzag (amp sideways, turns zigs); spiral (amp round the line, turns times); wave
 * (amp up and down, turns times); stamp (straight down onto b from h above it, speeding up); orbit (round b at amp,
 * turns times from phase ph, rising h). Each one starts at a and ends at b (stamp: above b; orbit: round b)
 * @param {{ kind?: string, a: number[], b: number[], h?: number, amp?: number, turns?: number, ph?: number }} P
 * @param {number} u */
export function battlePathAt(P, u) {
  const t = Math.min(1, Math.max(0, u)),
    { a, b } = P,
    h = P.h || 0,
    amp = P.amp || 0,
    turns = P.turns || 1;
  if (P.kind === 'stamp') return [b[0], b[1] + h * (1 - t * t), b[2]];
  if (P.kind === 'orbit') {
    const g = Math.PI * 2 * (turns * t + (P.ph || 0));
    return [b[0] + Math.cos(g) * amp, b[1] + h * t, b[2] + Math.sin(g) * amp];
  }
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    L = Math.hypot(dx, dz) || 1,
    sx = -dz / L,
    sz = dx / L,
    env = Math.sin(Math.PI * t);
  let x = a[0] + dx * t,
    y = a[1] + (b[1] - a[1]) * t,
    z = a[2] + dz * t;
  if (P.kind === 'arc') y += 4 * h * t * (1 - t);
  else if (P.kind === 'zigzag') {
    /* a triangle wave, its corners sharp, held to the ends */
    const f = t * turns * 2,
      tri = Math.floor(f) % 2 === 0 ? (f % 1) * 2 - 1 : 1 - (f % 1) * 2,
      o = amp * tri * env;
    x += sx * o;
    z += sz * o;
    y += o * 0.4;
  } else if (P.kind === 'spiral') {
    const g = Math.PI * 2 * turns * t,
      r = amp * env;
    x += sx * Math.cos(g) * r;
    z += sz * Math.cos(g) * r;
    y += Math.sin(g) * r;
  } else if (P.kind === 'wave') y += amp * Math.sin(Math.PI * 2 * turns * t) * env;
  return [x, y, z];
}
/** an aimed move's hit point on a robot: the part's offset from its middle (the stage's 'break' places a broken part
 * so): [dx metres, y metres over the ground or null for the middle's height]
 * @param {string | undefined} part @returns {[number, number | null]} */
export function battlePartOffset(part) {
  if (part === 'armL') return [-0.3, null];
  if (part === 'armR') return [0.3, null];
  if (part === 'legs') return [0, 0.25];
  return [0, null];
}
/* ===== VFX-17: signature scenes =====
   A scene (battleAnims.json scenes, named by a move's anim) is a family's shape plus the family it falls back to and
   the models it summons. Where its models can't be drawn (3D props off, the 2D stage, not loaded) or under Reduced
   motion (the meaning without the motion, and no extra time) it plays that family instead. A `prop` step summons a
   model that flies on a path (battlePathAt) to its place, holds, then erodes in 12 fps steps. */
/** the animation a move plays once a scene's fallback is applied: a scene whose models can't be drawn, or any scene
 * under Reduced motion, plays its family
 * @param {{ id: string, kind: 'family' | 'scene', miss?: boolean } | null} pick @param {AnimCtx} ctx
 * @param {BattleAnimsData} A @returns {{ id: string, kind: 'family' | 'scene', miss?: boolean } | null} */
export function battleSceneFallback(pick, ctx, A) {
  if (!pick || pick.kind !== 'scene') return pick;
  const S = A.scenes[pick.id];
  if (!S) return null;
  const needsProps = battleSceneProps(A, pick.id).length > 0;
  if (!ctx.reduced && !(needsProps && ctx.props === false)) return pick;
  return A.families[S.family] ? { id: S.family, kind: 'family' } : null;
}
/** the models a scene summons (its full and short steps; each a recipe id in game/art/scene/next/models), or every
 * scene's when id is left out (the battle preloads them at its start)
 * @param {BattleAnimsData} A @param {string} [id] @returns {string[]} */
export function battleSceneProps(A, id) {
  const out = new Set(),
    ids = id === undefined ? Object.keys((A && A.scenes) || {}) : [id];
  for (const k of ids) {
    const S = A && A.scenes && A.scenes[k];
    if (!S) continue;
    for (const st of [...S.steps, ...(S.short ? S.short.steps : [])])
      if (st.do === 'prop' && typeof st.prop === 'string') out.add(st.prop);
  }
  return [...out];
}
/** how fast a summoned model moves at k of its flight, against its mean speed: its ease's slope (a stamp's fall
 * speeds up on its own); its stretch shows over smear.js STRETCH_PACE
 * @param {string | undefined} ease @param {string | undefined} kind @param {number} k */
export function propPace(ease, kind, k) {
  if (kind === 'stamp') return 2 * k;
  return ease === 'in' ? 2 * k : ease === 'out' ? 2 * (1 - k) : 1;
}
/** where a summoned model is at stage time t, and how it shows: P.t0 its start, P.ms its flight on P.path (battlePathAt;
 * eased in, out or not), then P.hold ms still, then P.out ms eroding in 12 fps steps (fade 1 whole .. 0 gone). yaw:
 * P.yaw turned by P.turn turns over the flight; tum: P.tumble turns about its middle over the flight; pace: its speed
 * against its mean (see propPace); gone once eroded
 * @param {{ t0: number, ms: number, hold?: number, out?: number, path: { kind?: string, a: number[], b: number[],
 *   h?: number, amp?: number, turns?: number }, ease?: string, yaw?: number, turn?: number, tumble?: number }} P
 * @param {number} t */
export function battlePropAt(P, t) {
  const age = t - P.t0,
    ms = Math.max(1, P.ms),
    k = Math.min(1, Math.max(0, age / ms)),
    u = P.ease === 'in' ? k * k : P.ease === 'out' ? 1 - (1 - k) * (1 - k) : k,
    [x, y, z] = battlePathAt(P.path, u),
    out = P.out ?? 250,
    after = age - ms - (P.hold || 0),
    step = 1000 / 12,
    steps = Math.max(1, Math.round(out / step)),
    fade = after <= 0 ? 1 : 1 - Math.min(steps, Math.floor(after / step) + 1) / steps;
  return {
    x,
    y,
    z,
    k,
    flying: age < ms,
    pace: age < ms ? propPace(P.ease, P.path.kind, k) : 0,
    yaw: (P.yaw || 0) + Math.PI * 2 * (P.turn || 0) * u,
    tum: Math.PI * 2 * (P.tumble || 0) * u,
    fade: Math.max(0, fade),
    gone: after > 0 && fade <= 0,
  };
}
