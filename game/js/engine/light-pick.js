'use strict';
/* ================= ENGINE LIGHT PICKING =================
   Phase 20 (stage C5): which of a frame's point lights (lamps, windows, fires, your lantern) are lit, kept from frame to
   frame. Each light has a stable key (the thing it comes from and its kind), so a lit light stays lit: the set is
   chosen again only every LIGHT_RANK_MS (the nearest few, by a partial top-k with no sort), a lit light counts
   LIGHT_HOLD_M nearer (two equal lamps don't trade places), lights whose reach is out of view are skipped, and a light
   fades in and out over LIGHT_FADE_MS instead of being dimmed by its distance near the cut-off. Each light's values go
   into objects made once per light and refilled every frame. Used when quality.stableLights is on (light.js
   pickPointLights otherwise). Nothing here touches WebGL. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
/* eslint-disable no-func-assign */
expose({
  LIGHT_FADE_MS: [() => LIGHT_FADE_MS],
  LIGHT_HOLD_M: [() => LIGHT_HOLD_M],
  LIGHT_JUMP_M: [() => LIGHT_JUMP_M],
  LIGHT_KIND: [() => LIGHT_KIND],
  LIGHT_RANK_MS: [() => LIGHT_RANK_MS],
  lightEntry: [() => lightEntry, v => (lightEntry = v)],
  lightPicker: [() => lightPicker, v => (lightPicker = v)],
  pickStableLights: [() => pickStableLights, v => (pickStableLights = v)],
  rankLights: [() => rankLights, v => (rankLights = v)],
  resetLightPicker: [() => resetLightPicker, v => (resetLightPicker = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* how long a light takes to fade in or out, how often the lit set is chosen again, how much nearer a lit light counts */
export const LIGHT_FADE_MS = 250,
  LIGHT_RANK_MS = 200,
  LIGHT_HOLD_M = 1.5;
/* a jump farther than this in one frame (a door, a warp) starts again with no fades */
const LIGHT_JUMP_M = 20;
/* a light's kind within the thing it comes from (its src): a prop's glow and the pool under it, its windows' light,
   its lamp (scenery glow) and that pool, and its fires (one per fx entry, from 8 on) */
export const LIGHT_KIND = { glow: 0, glowPool: 1, window: 2, lamp: 3, lampPool: 4, fire: 8 };
export function lightPicker() {
  return {
    owners: new Map(),
    seen: [],
    best: [],
    lit: [],
    out: [],
    frame: 0,
    at: 0,
    rankAt: 0,
    cx: 0,
    cz: 0,
    on: false,
  };
}
function resetLightPicker(S) {
  S.owners.clear();
  S.seen.length = 0;
  S.best.length = 0;
  S.lit.length = 0;
  S.out.length = 0;
  S.on = false;
}
/* the entry of the light with this key, made the first time it is seen */
function lightEntry(S, src, kind) {
  let A = S.owners.get(src);
  if (!A) S.owners.set(src, (A = []));
  return (
    A[kind] ||
    (A[kind] = {
      src,
      kind,
      light: null,
      frame: -1,
      d: 0,
      score: 0,
      view: true,
      want: false,
      fade: 0,
      base: [0, 0, 0],
      out: { p: [0, 0, 0], r: 0, c: [0, 0, 0], front: false, fn: null, pool: 0, own: null },
    })
  );
}
/* the max lights in view nearest to the player (a lit one LIGHT_HOLD_M nearer), nearest first, into S.best; each
   kept in place in a list at most max long, so nothing is sorted whole and nothing is made */
function rankLights(S, max) {
  const B = S.best;
  B.length = 0;
  for (const e of S.lit) e.want = false;
  for (const e of S.seen) {
    e.want = false;
    if (!e.view) continue;
    const s = e.fade > 0 ? e.d - LIGHT_HOLD_M : e.d;
    if (B.length >= max && s >= B[max - 1].score) continue;
    e.score = s;
    let j = B.length < max ? B.length : max - 1;
    while (j > 0 && B[j - 1].score > s) {
      B[j] = B[j - 1];
      j--;
    }
    B[j] = e;
  }
  for (const e of B) e.want = true;
  /* lights gone for a while and dark: forgotten */
  for (const [src, A] of S.owners) {
    let any = false;
    for (let k = 0; k < A.length; k++) {
      const e = A[k];
      if (!e) continue;
      if (e.fade <= 0 && e.frame !== S.frame) A[k] = undefined;
      else any = true;
    }
    if (!any) S.owners.delete(src);
  }
}
/* L: the frame's lights ({p, r, c, front, pool, own} as walk/lighting.js makes them, each with src and kind; one with
   no src is keyed by its place in L); (cx, cz): the player; now: ms; inView(l): whether a light's reach is in view
   (null: all are). Returns the lit lights, nearest first, colours scaled by their fades (S.out, refilled each frame). */
export function pickStableLights(S, L, cx, cz, now, max = 16, inView = null) {
  const jump = !S.on || Math.hypot(cx - S.cx, cz - S.cz) > LIGHT_JUMP_M;
  if (jump) resetLightPicker(S);
  const k = jump ? 1 : Math.min(100, Math.max(0, now - S.at)) / LIGHT_FADE_MS,
    f = ++S.frame,
    seen = S.seen,
    lit = S.lit;
  S.on = true;
  S.at = now;
  S.cx = cx;
  S.cz = cz;
  seen.length = 0;
  for (let i = 0; i < L.length; i++) {
    const l = L[i],
      e = l.src == null ? lightEntry(S, 'other', i) : lightEntry(S, l.src, l.kind || 0);
    if (e.frame === f) continue; /* a second light with the same key: the first one keeps it */
    e.light = l;
    e.frame = f;
    e.d = Math.hypot(l.p[0] - cx, l.p[2] - cz) * (l.front ? 1.5 : 1);
    e.view = !inView || inView(l);
    seen.push(e);
  }
  if (jump || now - S.rankAt >= LIGHT_RANK_MS || now < S.rankAt) {
    rankLights(S, max);
    S.rankAt = now;
  }
  /* the lit ones fade toward their choice; a light no longer there fades out where it was */
  let n = 0;
  for (const e of lit) {
    if (e.frame !== f) e.want = false;
    e.fade = e.want ? Math.min(1, e.fade + k) : e.fade - k;
    if (e.fade > 0) lit[n++] = e;
    else e.fade = 0;
  }
  lit.length = n;
  /* the chosen ones not lit yet take a free slot, nearest first; a light still fading out keeps its slot till it's dark */
  for (const e of S.best)
    if (e.fade === 0 && e.want && e.frame === f && lit.length < max) {
      e.fade = Math.min(1, k);
      lit.push(e);
    }
  const out = S.out;
  out.length = 0;
  for (const e of lit) {
    const o = e.out,
      l = e.frame === f ? e.light : null;
    if (l) {
      o.p[0] = l.p[0];
      o.p[1] = l.p[1];
      o.p[2] = l.p[2];
      o.r = l.r;
      o.front = !!l.front;
      o.fn = l.fn || null;
      o.pool = l.pool || 0;
      o.own = l.own || null;
      e.base[0] = l.c[0];
      e.base[1] = l.c[1];
      e.base[2] = l.c[2];
    }
    o.c[0] = e.base[0] * e.fade;
    o.c[1] = e.base[1] * e.fade;
    o.c[2] = e.base[2] * e.fade;
    o.d = e.d;
    let j = out.length;
    out.push(o);
    while (j > 0 && out[j - 1].d > o.d) {
      out[j] = out[j - 1];
      j--;
    }
    out[j] = o;
  }
  return out;
}
