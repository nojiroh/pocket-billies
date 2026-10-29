// @ts-check
'use strict';
/* ================= THE TALK DIRECTOR (dialogue track DL-5) =================
   What a talking face does from moment to moment (docs/phases/dialogue-track.md, "Portraits that perform"): blinks,
   the mouth on the letters, the face the line asks for (and a mid-line [face=x]), emotes popping ([emote=x]), the
   frame's bounce and the head's hits. It knows nothing about how a face is drawn: talk.js shows today's portrait from
   `combo` (eyes and mouth as expression tokens, person-art.js) and DL-6's figure close-ups read `head`. Seeded, so the
   same line blinks the same way; logic only: no DOM, runs in Node (tools/test/talk-director.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  BLINK_MS: [() => BLINK_MS],
  EMOTE_MS: [() => EMOTE_MS],
  FACE_HITS: [() => FACE_HITS],
  MOUTH_HOLD: [() => MOUTH_HOLD],
  MOUTH_REST: [() => MOUTH_REST],
  VOWEL: [() => VOWEL],
  // @ts-expect-error -- replaced on purpose
  bounceAt: [() => bounceAt, v => (bounceAt = v)],
  // @ts-expect-error -- replaced on purpose
  creatureFace: [() => creatureFace, v => (creatureFace = v)],
  // @ts-expect-error -- replaced on purpose
  emoteAt: [() => emoteAt, v => (emoteAt = v)],
  // @ts-expect-error -- replaced on purpose
  faceToken: [() => faceToken, v => (faceToken = v)],
  // @ts-expect-error -- replaced on purpose
  headAt: [() => headAt, v => (headAt = v)],
  // @ts-expect-error -- replaced on purpose
  rand: [() => rand, v => (rand = v)],
  // @ts-expect-error -- replaced on purpose
  talkDirector: [() => talkDirector, v => (talkDirector = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a blink lasts this long (ms); the next comes 2-6 s later; one in six is a double blink */
export const BLINK_MS = 130;
/** the mouth holds open or shut at least this long (ms), so fast typing still reads as a mouth */
export const MOUTH_HOLD = 60;
/** the mouth shuts when no letter has come for this long (a pause, a beat) */
export const MOUTH_REST = 150;
/** an emote pops (0 → 1.2 → 1 over 200 ms), stays, and fades out by EMOTE_MS */
export const EMOTE_MS = 1300;
/** each face's head hit (DL-6 turns the head joint by it; today's portrait has none) */
export const FACE_HITS = /** @type {Record<string, string>} */ ({
  happy: 'nod',
  surprised: 'jolt',
  angry: 'shake',
  sad: 'droop',
  smug: 'tilt',
});

/** a small seeded random source (mulberry32) @param {number} seed */
export function rand(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** which of an expression's tokens a wardrobe item wears: the last one it has pieces for ('happy+talk': the eyes have
 * happy, the mouth has talk), or null for its plain pieces. A single expression is a combination of one.
 * @param {string | null | undefined} expr @param {(token: string) => boolean} has @returns {string | null} */
export function faceToken(expr, has) {
  if (!expr) return null;
  const T = String(expr).split('+');
  for (let i = T.length - 1; i >= 0; i--) if (T[i] && has(T[i])) return T[i];
  return null;
}

/** the face's own frame for a creature rig (blink, talk, happy or idle) from a combination
 * @param {string | null | undefined} expr @returns {'blink' | 'talk' | 'happy' | 'idle'} */
export function creatureFace(expr) {
  const T = String(expr || '').split('+');
  return T.includes('blink') ? 'blink' : T.includes('talk') ? 'talk' : T.includes('happy') ? 'happy' : 'idle';
}

/** a letter that opens the mouth */
export const VOWEL = /[aeiouyàáâäãåèéêëìíîïòóôöõùúûüýæœ]/i;

/**
 * @typedef {{ kind: string, at: number, v?: any }} LineEvent a parsed line's event (logic/line-markup.js parseLine)
 * @typedef {{ kind: 'bounce' | 'emote' | 'face', v?: string }} DirectorPop something that starts now (talk.js plays it)
 * @typedef {{ expr: string | null, combo: string | null, eyes: 'open' | 'shut', mouth: 'open' | 'shut',
 *   head: { yaw: number, pitch: number, roll: number }, bounce: number, emotes: { v: string, s: number, a: number }[] }}
 *   DirectorState the face at a moment
 */

/** a director for one line.
 * @param {{ seed?: number, expr?: string | null, events?: LineEvent[], reduced?: boolean,
 *   auto?: Record<string, string>, t0?: number }} o
 *   seed: the line's own (talk-skins.js talkSeed); expr: the face it starts with; events: its parsed events (face and
 *   emote act here); reduced: Reduced motion (blinks and the mouth stay, no bounce, no head, emotes without the pop);
 *   auto: a face's own emote (emotes.json "auto"), popped when the line has no [emote] of its own; t0: when it starts */
export function talkDirector(o = {}) {
  const R = rand((o.seed || 0) * 2654435761 + 7),
    reduced = !!o.reduced,
    auto = o.auto || {},
    events = (o.events || []).filter(e => e.kind === 'face' || e.kind === 'emote').sort((a, b) => a.at - b.at),
    tagged = events.some(e => e.kind === 'emote'),
    t0 = o.t0 || 0;
  let expr = o.expr || null,
    next = 0,
    reached = -1,
    blinkAt = t0 + 2000 + R() * 4000,
    blinkTwice = false,
    mouth = false,
    want = false,
    mouthAt = -1e9,
    letterAt = -1e9,
    typing = false,
    started = false;
  /** @type {{ kind: string, t: number }[]} */
  const hits = [];
  /** @type {{ v: string, t: number }[]} */
  const emotes = [];
  /** @type {number[]} */
  const bounces = [];
  /** @type {DirectorPop[]} */
  let pops = [];
  let faceAt = t0;

  const pop = (/** @type {DirectorPop} */ p) => pops.push(p);
  const emote = (/** @type {string} */ v, /** @type {number} */ t) => {
    emotes.length = 0;
    emotes.push({ v, t });
    pop({ kind: 'emote', v });
    react(t);
  };
  const react = (/** @type {number} */ t) => {
    if (reduced) return;
    bounces.push(t);
    if (bounces.length > 3) bounces.shift();
    pop({ kind: 'bounce' });
  };
  /** a new face: its head hit, the frame's bounce, and its own emote when the line has none */
  const face = (/** @type {string | null} */ v, /** @type {number} */ t, /** @type {boolean} */ first) => {
    expr = v;
    faceAt = t;
    if (!first) pop({ kind: 'face', v: v || '' });
    const hit = v && FACE_HITS[v];
    if (hit && !reduced) hits.push({ kind: hit, t });
    if (v && auto[v] && !tagged) emote(auto[v], t);
    else if (!first && v) react(t);
  };

  const D = {
    /** the line starts (the letters begin): a small settle of the head, the starting face's reactions */
    start(t = t0) {
      if (started) return;
      started = true;
      typing = true;
      letterAt = t;
      if (!reduced) hits.push({ kind: 'settle', t });
      if (expr) face(expr, t, true);
      D.reach(0, t);
    },
    /** the letters shown so far reach n: the events at or before n act
     * @param {number} n @param {number} t */
    reach(n, t) {
      if (n <= reached) return;
      reached = n;
      while (next < events.length && events[next].at <= n) {
        const e = events[next++];
        if (e.kind === 'face') face(String(e.v || '') || null, t, false);
        else if (e.kind === 'emote' && e.v) emote(String(e.v), t);
      }
    },
    /** a letter is typed: a vowel opens the mouth, anything else shuts it (both held at least MOUTH_HOLD)
     * @param {string} ch @param {number} t */
    type(ch, t) {
      if (!started) D.start(t);
      letterAt = t;
      want = VOWEL.test(ch);
    },
    /** the letters are all out (or the line was skipped to its end) */
    done() {
      typing = false;
      want = false;
    },
    /** what started since the last call (talk.js plays them as animations) @returns {DirectorPop[]} */
    drain() {
      const p = pops;
      pops = [];
      return p;
    },
    /** the face now @param {number} t @returns {DirectorState} */
    at(t) {
      /* the mouth: what the letters want, held MOUTH_HOLD; shut after a pause or once the line is out */
      const w = typing && want && t - letterAt < MOUTH_REST;
      if (w !== mouth && t - mouthAt >= MOUTH_HOLD) {
        mouth = w;
        mouthAt = t;
      }
      /* blinks: none while happy (the eyes are already shut in a smile) */
      const happy = String(expr || '')
        .split('+')
        .includes('happy');
      let blink = false;
      if (t >= blinkAt) {
        if (t < blinkAt + BLINK_MS) blink = !happy;
        else if (blinkTwice && t < blinkAt + BLINK_MS * 2 + 90 && t >= blinkAt + BLINK_MS + 90) blink = !happy;
        else if (t >= blinkAt + BLINK_MS * 2 + 90 || !blinkTwice) {
          blinkAt = t + 2000 + R() * 4000;
          blinkTwice = R() < 1 / 6;
        }
      }
      const T = [];
      if (expr) T.push(expr);
      if (blink) T.push('blink');
      if (mouth) T.push('talk');
      while (emotes.length && t - emotes[0].t >= EMOTE_MS) emotes.shift();
      return {
        expr,
        combo: T.length ? T.join('+') : null,
        eyes: blink ? 'shut' : 'open',
        mouth: mouth ? 'open' : 'shut',
        head: reduced ? { yaw: 0, pitch: 0, roll: 0 } : headAt(hits, expr, faceAt, t),
        bounce: reduced ? 0 : bounceAt(bounces, t),
        emotes: emotes.map(e => emoteAt(e, t, reduced)),
      };
    },
  };
  return D;
}

/** the head's angles (degrees; pitch down is positive) from its hits and the held pose of the face
 * @param {{ kind: string, t: number }[]} hits @param {string | null} expr @param {number} faceAt @param {number} t */
export function headAt(hits, expr, faceAt, t) {
  let yaw = 0,
    pitch = 0,
    roll = 0;
  for (const h of hits) {
    const d = t - h.t;
    if (d < 0) continue;
    if (h.kind === 'settle' && d < 250) pitch += 3 * Math.sin((Math.PI * d) / 250);
    else if (h.kind === 'nod' && d < 600) pitch += 8 * Math.abs(Math.sin((Math.PI * d) / 300)) * (1 - d / 600);
    else if (h.kind === 'jolt' && d < 700) pitch -= 10 * (d < 60 ? d / 60 : Math.exp(-(d - 60) / 150));
    else if (h.kind === 'shake' && d < 540) yaw += 12 * Math.sin((2 * Math.PI * d) / 180) * (1 - d / 540);
  }
  /* held poses: a sad face droops, a smug one tilts, eased in from when the face came */
  const k = 1 - Math.exp(-Math.max(0, t - faceAt) / 150),
    T = String(expr || '').split('+');
  if (T.includes('sad')) pitch += 8 * k;
  if (T.includes('smug')) roll += 8 * k;
  const r = (/** @type {number} */ v) => Math.round(v * 10) / 10 || 0;
  return { yaw: r(yaw), pitch: r(pitch), roll: r(roll) };
}

/** the frame's squash: a damped spring after each reaction, about ±0.12 (0 at rest)
 * @param {number[]} bounces @param {number} t */
export function bounceAt(bounces, t) {
  let b = 0;
  for (const t0 of bounces) {
    const d = t - t0;
    if (d >= 0 && d < 700) b += 0.12 * Math.exp(-d / 160) * Math.cos((2 * Math.PI * d) / 220);
  }
  return Math.round(b * 1000) / 1000 || 0;
}

/** an emote's scale and opacity at a moment: 0 → 1.2 by 120 ms, 1 by 200 ms, faded from 1000 ms to EMOTE_MS
 * @param {{ v: string, t: number }} e @param {number} t @param {boolean} reduced */
export function emoteAt(e, t, reduced) {
  const d = t - e.t,
    s = reduced ? 1 : d < 120 ? (1.2 * d) / 120 : d < 200 ? 1.2 - (0.2 * (d - 120)) / 80 : 1,
    a = d < 1000 ? 1 : Math.max(0, 1 - (d - 1000) / (EMOTE_MS - 1000));
  return { v: e.v, s: Math.round(s * 100) / 100, a: Math.round(a * 100) / 100 };
}
