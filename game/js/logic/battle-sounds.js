// @ts-check
'use strict';
/* ================= BATTLE SOUNDS (VFX track VFX-19) =================
   The battle's own sounds as data (music.json `battle`, the shape agreed with the sound track): a sound per move
   family, a layer per type, the hurt sounds (a burn, recoil, a spread move's second target, the delayed hit), the
   recall, and the throw and catch. Each sound is a few voices in the cries' shape (logic/cries.js: at, note over the
   sound's pitch, len, wave, vol, slide, vib; `inst` a baked instrument, the wave until the bank has it) or a noise
   voice (synthNoise's options: noise {lp | hp | bp, q}, dur, vol). A move's sound has two parts: `cast` from the
   move's start and `hit` from its hit. Here: a sound as a play list, its length, the names, which family and which
   hurt sound an event plays, and the problems worth a warning. audio/battle-voices.js plays a list; the game plays
   them from sound.js battleSoundEffect (audio/battle-sounds.js), the Studio from its Sounds tab. Logic only: no
   sound; runs in Node (tools/test/battle-sounds.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BATTLE_SOUND_CATCH: [() => BATTLE_SOUND_CATCH],
  BATTLE_SOUND_HURT: [() => BATTLE_SOUND_HURT],
  BATTLE_SOUND_PITCH: [() => BATTLE_SOUND_PITCH],
  BATTLE_SOUND_VOL: [() => BATTLE_SOUND_VOL],
  // @ts-expect-error -- replaced on purpose
  battleHurtKind: [() => battleHurtKind, v => (battleHurtKind = v)],
  // @ts-expect-error -- replaced on purpose
  battleMoveFamilies: [() => battleMoveFamilies, v => (battleMoveFamilies = v)],
  // @ts-expect-error -- replaced on purpose
  battleMoveSound: [() => battleMoveSound, v => (battleMoveSound = v)],
  // @ts-expect-error -- replaced on purpose
  battleSoundFamily: [() => battleSoundFamily, v => (battleSoundFamily = v)],
  // @ts-expect-error -- replaced on purpose
  battleSoundFindings: [() => battleSoundFindings, v => (battleSoundFindings = v)],
  // @ts-expect-error -- replaced on purpose
  battleSoundGet: [() => battleSoundGet, v => (battleSoundGet = v)],
  battleSoundLength: [() => battleSoundLength],
  // @ts-expect-error -- replaced on purpose
  battleSoundNames: [() => battleSoundNames, v => (battleSoundNames = v)],
  // @ts-expect-error -- replaced on purpose
  battleSoundPlays: [() => battleSoundPlays, v => (battleSoundPlays = v)],
  // @ts-expect-error -- replaced on purpose
  battleSoundPreview: [() => battleSoundPreview, v => (battleSoundPreview = v)],
  isNoise: [() => isNoise],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** @typedef {{at: number, note: number, len: number, wave?: string, inst?: string, vol?: number, slide?: number, vib?: number}} BattleToneVoice */
/** @typedef {{at: number, noise: {lp?: number, hp?: number, bp?: number, q?: number}, dur: number, vol?: number}} BattleNoiseVoice */
/** @typedef {BattleToneVoice | BattleNoiseVoice} BattleVoice */
/** @typedef {{name?: string, pitch?: number, wave?: string, echo?: number, voices?: BattleVoice[], cast?: BattleVoice[], hit?: BattleVoice[]}} BattleSound */
/** @typedef {{about?: string, families?: Record<string, BattleSound>, types?: Record<string, BattleSound>, hurt?: Record<string, BattleSound>, recall?: BattleSound, catch?: Record<string, BattleSound>}} BattleSoundsData */
/** one thing to play: a tone (midi, its wave or instrument) or a filtered noise, `at` seconds from the list's start
 * @typedef {{kind: 'tone', at: number, midi: number, type: string, inst?: string, dur: number, vol: number, slide: number, vib: number, echo: number}
 *   | {kind: 'noise', at: number, dur: number, vol: number, lp: number, hp: number, bp: number, q: number, echo: number}} BattlePlay */

/** the hurt sounds, by what hurt (an engine `hurt` event's fx: battleHurtKind) */
export const BATTLE_SOUND_HURT = ['burn', 'recoil', 'spread', 'delayed'];
/** the throw and catch sounds: a pyramid thrown (a send-out or a catch), its pop open (a send-out), its landing, a
 * wobble, the seal */
export const BATTLE_SOUND_CATCH = ['throw', 'pop', 'land', 'wobble', 'seal'];
/** the pitch a sound's notes sit over when it sets none (middle C) */
export const BATTLE_SOUND_PITCH = 60;
/** a tone voice's volume when it sets none (a cry's), and a noise voice's */
export const BATTLE_SOUND_VOL = { tone: 0.06, noise: 0.12 };

/** @param {BattleVoice} v @returns {v is BattleNoiseVoice} */
export const isNoise = v => !!v && typeof v === 'object' && 'noise' in v && !!v.noise;

/**
 * a sound's voices (one part: `voices`, or a move sound's `cast` or `hit`) as a play list, from `at0` seconds on
 * @param {BattleSound | null | undefined} S
 * @param {'voices' | 'cast' | 'hit'} [part]
 * @param {number} [at0]
 * @returns {BattlePlay[]}
 */
export function battleSoundPlays(S, part = 'voices', at0 = 0) {
  if (!S) return [];
  const V = S[part] || [],
    pitch = typeof S.pitch === 'number' ? S.pitch : BATTLE_SOUND_PITCH,
    echo = S.echo || 0;
  return V.map(v =>
    isNoise(v)
      ? {
          kind: /** @type {'noise'} */ ('noise'),
          at: at0 + v.at,
          dur: v.dur,
          vol: v.vol ?? BATTLE_SOUND_VOL.noise,
          lp: v.noise.lp || 0,
          hp: v.noise.hp || 0,
          bp: v.noise.bp || 0,
          q: v.noise.q ?? 1,
          echo,
        }
      : {
          kind: /** @type {'tone'} */ ('tone'),
          at: at0 + v.at,
          midi: pitch + v.note,
          type: v.wave || S.wave || 'p25',
          ...(v.inst ? { inst: v.inst } : {}),
          dur: v.len,
          vol: v.vol ?? BATTLE_SOUND_VOL.tone,
          slide: v.slide ?? 1,
          vib: v.vib ?? 0,
          echo,
        }
  );
}

/** how long a play list lasts (s): its last voice's end @param {BattlePlay[]} P */
export const battleSoundLength = P => Math.max(0, ...P.map(p => p.at + p.dur));

/**
 * every sound's name in the section: families.<id>, types.<id>, hurt.<id>, recall, catch.<id>
 * @param {BattleSoundsData | null | undefined} B
 * @returns {string[]}
 */
export function battleSoundNames(B) {
  if (!B) return [];
  const out = [];
  for (const g of ['families', 'types', 'hurt'])
    for (const k of Object.keys(/** @type {Record<string, any>} */ (B)[g] || {})) out.push(`${g}.${k}`);
  if (B.recall) out.push('recall');
  for (const k of Object.keys(B.catch || {})) out.push(`catch.${k}`);
  return out;
}

/** a sound by its name (battleSoundNames) @param {BattleSoundsData | null | undefined} B @param {string} name
 * @returns {BattleSound | null} */
export function battleSoundGet(B, name) {
  if (!B) return null;
  const [g, k] = String(name).split('.');
  const G = /** @type {Record<string, any>} */ (B)[g];
  if (!G) return null;
  return (k == null ? G : G[k]) || null;
}

/**
 * a sound as it is heard alone (the Studio's ▶, check-sound.py's fingerprint): its voices, or a move sound's cast
 * then its hit `hitAt` seconds later (its family's hit, from battleAnims.json)
 * @param {BattleSound | null | undefined} S
 * @param {number} [hitAt]
 */
export function battleSoundPreview(S, hitAt = 0.3) {
  if (!S) return [];
  return S.voices ? battleSoundPlays(S) : [...battleSoundPlays(S, 'cast'), ...battleSoundPlays(S, 'hit', hitAt)];
}

/**
 * the family a move's sound comes from: its own `anim` when that is a family, else its category's default (a scene,
 * VFX-17's, plays its `family` when it names one). The outcome doesn't change it: a missed move is still cast
 * @param {{c: string, anim?: string} | null | undefined} M a move (moves.json)
 * @param {{families: Record<string, any>, scenes?: Record<string, any>, defaults: Record<string, string>} | null | undefined} A battleAnims.json
 * @returns {string | null}
 */
export function battleSoundFamily(M, A) {
  if (!M || !A) return null;
  if (M.anim && A.families[M.anim]) return M.anim;
  const sc = M.anim && A.scenes && A.scenes[M.anim];
  if (sc && typeof sc.family === 'string' && A.families[sc.family]) return sc.family;
  const d = A.defaults[M.c];
  return d && A.families[d] ? d : null;
}

/**
 * the families a move sounds as: every family but the legacy ones and the ones only an outcome plays (a miss, a
 * block: battleAnims.json defaults.miss and defaults.blocked; the tier's own sounds play there)
 * @param {{families: Record<string, any>, defaults?: Record<string, string>}} A battleAnims.json
 * @returns {string[]}
 */
export function battleMoveFamilies(A) {
  const D = A.defaults || {},
    outcome = new Set([D.miss, D.blocked]);
  return Object.keys(A.families).filter(k => !k.startsWith('legacy_') && !outcome.has(k));
}

/**
 * a move's sound: its family's and its type layer's cast (from the move's start) and hit (from its hit)
 * @param {BattleSoundsData | null | undefined} B
 * @param {string | null} family
 * @param {string | null} type the type kit it plays in (battle-anims.js battleKitFor: Bureau for a Bureau bot)
 * @returns {{cast: BattlePlay[], hit: BattlePlay[], any: boolean}}
 */
export function battleMoveSound(B, family, type) {
  const F = (B && B.families && family && B.families[family]) || null,
    T = (B && B.types && type && B.types[type]) || null;
  const cast = [...battleSoundPlays(F, 'cast'), ...battleSoundPlays(T, 'cast')],
    hit = [...battleSoundPlays(F, 'hit'), ...battleSoundPlays(T, 'hit')];
  return { cast, hit, any: !!F };
}

/**
 * which hurt sound an engine `hurt` event plays: its burn, a spread move's second target, the delayed hit landing,
 * any other damage (a crash, confusion, unstable cells, stones, the storm) recoil; null when nothing was lost (a
 * block)
 * @param {{k?: string, fx?: string, dmg?: number} | null | undefined} an
 * @returns {string | null}
 */
export function battleHurtKind(an) {
  if (!an || an.k !== 'hurt' || an.fx === 'block') return null;
  if (an.fx === 'brn') return 'burn';
  if (an.fx === 'spread') return 'spread';
  if (an.fx === 'mail') return 'delayed';
  return an.dmg ? 'recoil' : null;
}

/**
 * the battle section's problems (musicFindings shows them): a family or type that isn't one (error), one without a
 * sound (warn), sounds still named as placeholders (info)
 * @param {BattleSoundsData | null | undefined} B
 * @param {{families?: string[], types?: string[]}} known the move families (battleAnims.json, not the legacy ones) and the type kits
 * @returns {{lvl: 'error' | 'warn' | 'info', msg: string, battle?: string}[]}
 */
export function battleSoundFindings(B, known = {}) {
  /** @type {{lvl: 'error' | 'warn' | 'info', msg: string, battle?: string}[]} */
  const out = [];
  if (!B) return out;
  for (const [g, list, what] of /** @type {[string, string[] | undefined, string][]} */ ([
    ['families', known.families, 'move family'],
    ['types', known.types, 'type kit'],
  ])) {
    if (!list) continue;
    const have = /** @type {Record<string, BattleSound>} */ (/** @type {any} */ (B)[g] || {});
    for (const k of Object.keys(have))
      if (!list.includes(k))
        out.push({ lvl: 'error', msg: `battle.${g}.${k}: not a ${what} (battleAnims.json)`, battle: `${g}.${k}` });
    const none = list.filter(k => !have[k]);
    if (none.length) out.push({ lvl: 'warn', msg: `battle.${g}: no sound for ${none.join(', ')}`, battle: g });
  }
  const left = battleSoundNames(B).filter(n => {
    const S = battleSoundGet(B, n);
    return !!S && typeof S.name === 'string' && /^\s*placeholder\b/i.test(S.name);
  });
  if (left.length)
    out.push({
      lvl: 'info',
      msg: `placeholder battle sounds (${left.length}): ${left.join(', ')}. Keep, change or rename each`,
      battle: left[0],
    });
  return out;
}
