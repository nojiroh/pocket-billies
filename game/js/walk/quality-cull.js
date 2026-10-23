'use strict';
/* ================= WALK QUALITY AND CULLING =================
   Phase 20 (stage B): what the camera sees (the frustum, culling), the frame's budget, a place's mood and heat haze,
   and the automatic quality, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { gameData, provide, saveData } from '../hooks.js';
import { qualityStep } from '../logic/quality-step.js';
import { frameScheduler } from '../frame-scheduler.js';
import { mapMoodName, walkView } from '../walk-view.js';
import { engineContext, engineSetting } from '../engine/settings.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { worldCurveDrop } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  FRUSTUM_PLANES: [() => FRUSTUM_PLANES],
  NEUTRAL_MOOD: [() => NEUTRAL_MOOD],
  adaptQuality: [() => adaptQuality, v => setAdaptQuality(v)],
  computeFrustum: [() => computeFrustum, v => (computeFrustum = v)],
  cullItems: [() => cullItems, v => (cullItems = v)],
  easedMood: [() => easedMood, v => (easedMood = v)],
  frameBudgetLeft: [() => frameBudgetLeft, v => ((frameBudgetLeft = v), provide({ frameBudgetLeft }))],
  heatHaze: [() => heatHaze, v => (heatHaze = v)],
  heatSources: [() => heatSources, v => (heatSources = v)],
  inFrustum: [() => inFrustum, v => (inFrustum = v)],
  setAdaptQuality: [() => setAdaptQuality, v => (setAdaptQuality = v)],
});
/* eslint-enable no-func-assign */
provide({ frameBudgetLeft });
/* to-module: end */
/* v32: only what the camera can see is drawn. The six sides of the view are taken from the camera matrix once a
   frame; each thing is a ball round its middle (lifted by the horizon curve the shaders apply) tested against them.
   Things just outside still cast shadows in (the shadow pass keeps everything near the shadow map's square). */
const FRUSTUM_PLANES = new Float32Array(24);
export function computeFrustum(m) {
  const F = FRUSTUM_PLANES;
  for (let i = 0; i < 6; i++) {
    const r = i >> 1,
      sg = i & 1 ? -1 : 1,
      a = m[3] + sg * m[r],
      b = m[7] + sg * m[4 + r],
      c = m[11] + sg * m[8 + r],
      d = m[15] + sg * m[12 + r],
      l = Math.hypot(a, b, c) || 1;
    F[i * 4] = a / l;
    F[i * 4 + 1] = b / l;
    F[i * 4 + 2] = c / l;
    F[i * 4 + 3] = d / l;
  }
  return F;
}
export function inFrustum(F, x, y, z, r) {
  for (let i = 0; i < 6; i++) {
    if (i === 5) continue;
    /* no far side: the haze hides the far end anyway */ if (
      F[i * 4] * x + F[i * 4 + 1] * y + F[i * 4 + 2] * z + F[i * 4 + 3] <
      -r
    )
      return false;
  }
  return true;
}
export function cullItems(items, C) {
  const F = computeFrustum(C.vp);
  let n = 0,
    k = 0;
  const on = engineSetting('quality', 'cull') ?? true;
  for (const it of items) {
    if (!on || it.person || it.k === 'enc' || it.k === 'enc2') {
      it.vis = true;
      continue;
    }
    const s = it.mpp || 0.03,
      w = (it.w || 32) * s,
      h = (it.h || 32) * s,
      b = it.M && it.M.box,
      ext = b ? Math.max(b[0], b[1]) * ((it.p && it.p.s) || 1) : 0;
    const r = Math.max(w, h, ext) * 0.6 + 0.4,
      cy = (it.y || 0) + h * 0.5 + worldCurveDrop(it.x, it.z);
    it.vis = inFrustum(F, it.x, cy, it.z, r);
    k++;
    if (!it.vis) n++;
  }
  walkRenderer.culled = n;
  walkRenderer.cullOf = k;
}
/* v32: a per-frame time budget for one-off work (solid bodies, outlines of buildings): past it, things stay pictures
   for a frame or two instead of freezing the scene while they are worked out */
export function frameBudgetLeft() {
  return performance.now() - (walkRenderer.budT || 0) < (walkRenderer.budMs ?? 7);
}
/* v32: how much heat shimmer: over lava always, over desert sand and canyons in the heat of the day */
/* v47: a mood per place (warm late afternoon in Sundown, cool and misty in the Thicket, hazy heat in the canyon...):
   saturation, contrast, warmth and tints for the darks and the lights, from the data's presets (moods). It eases over
   about two seconds when you walk from one place into the next, and is off with the setting off */
const NEUTRAL_MOOD = { sat: 1, con: 1, warm: 0, lift: [0, 0, 0], gain: [0, 0, 0], sh: [0, 0, 0], hi: [0, 0, 0] };
export function easedMood(sc) {
  const on = (engineSetting('world', 'moods') ?? 1) > 0,
    Mo = (typeof gameData !== 'undefined' && gameData.moods) || {},
    T0 = on && sc ? Mo[sc.mood || mapMoodName(sc)] : null,
    k = engineSetting('world', 'moods') ?? 1;
  const T = Object.assign({}, NEUTRAL_MOOD);
  if (T0)
    for (const f of ['sat', 'con', 'warm']) if (T0[f] != null) T[f] = f === 'warm' ? T0[f] * k : 1 + (T0[f] - 1) * k;
  if (T0) for (const f of ['lift', 'gain', 'sh', 'hi']) if (T0[f]) T[f] = T0[f].map(v => v * k);
  const M = walkRenderer.mood || (walkRenderer.mood = JSON.parse(JSON.stringify(T))),
    now = performance.now(),
    dt = Math.min(0.1, (now - (walkRenderer.moodT || now)) / 1000);
  walkRenderer.moodT = now;
  const e = 1 - Math.exp(-dt * 1.6);
  for (const f of ['sat', 'con', 'warm']) M[f] += (T[f] - M[f]) * e;
  for (const f of ['lift', 'gain', 'sh', 'hi']) for (let i = 0; i < 3; i++) M[f][i] += (T[f][i] - M[f][i]) * e;
  return M;
}
/* alpha 0.4: where the fires are on screen, for the small shimmer above each (up to six, nearest first in the list) */
export function heatSources(C) {
  const F = walkRenderer.fires || [];
  if (!F.length || !C || !C.vp) return null;
  const m = C.vp,
    out = [];
  for (const [x, y, z, s] of F) {
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12],
      cy = m[1] * x + m[5] * y + m[9] * z + m[13],
      w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w <= 0.1) continue;
    const u = (cx / w) * 0.5 + 0.5,
      v = (cy / w) * 0.5 + 0.5;
    if (u < -0.1 || u > 1.1 || v < -0.1 || v > 1.1) continue;
    const r = Math.min(0.14, (1.5 * s) / w);
    out.push(u, v, r * 0.55, r);
    if (out.length >= 24) break;
  }
  return out.length ? out : null;
}
export function heatHaze(sc) {
  if (sc.indoor) return 0;
  if (sc.waterKind === 'lava' || sc.far === 'volcano') return 0.9;
  const hot =
    sc.climate === 'dry' ||
    /canyon|desert|mesa/.test((sc.far || '') + ' ' + (sc.name || '').toLowerCase()) ||
    (sc.edge === 's' && !sc.flatFar);
  if (!hot) return 0;
  const E = typeof environment !== 'undefined' && engineContext.env ? environment : null;
  return E ? 0.55 * (1 - E.night) * (1 - E.grey) * (1 - Math.min(1, E.rain)) : 0.4;
}
/* lower the resolution when frames come late (whatever the cause), raise it again when there's room */
/* v32: a ladder. When frames come late the costliest extras go first, one step at a time (1: quicker depth of field,
   no ambient occlusion; 2: smaller shadow map, shadows and reflections every other frame; 3: fewer bloom levels, no
   light shafts, no grass far away; 4: no depth of field); only then the resolution drops. With room to spare it climbs
   back: resolution first, then the extras. Frames held back on purpose (a window open, another screen) don't count. */
export function adaptQuality(dtm, work) {
  if (!engineSetting('quality', 'auto')) {
    walkView.R = 1;
    walkRenderer.q = 0;
    return;
  }
  const cap = walkView.opt.cap ? walkView.opt.cap() : 60;
  if (cap < 30 || walkView.warm) {
    walkRenderer.int = 0;
    return;
  }
  /* alpha 0.1: the picture stays sharp at 60 frames a second; only Smoothest (preferences.aim) trades sharpness for more */
  const smooth =
      typeof saveData !== 'undefined' && saveData && saveData.preferences && saveData.preferences.aim === 'smooth',
    target = 1000 / Math.min(cap, frameScheduler.hz || 60, smooth ? 999 : 60);
  walkRenderer.int = walkRenderer.int ? walkRenderer.int * 0.92 + dtm * 0.08 : dtm;
  /* the step itself: logic/quality-step.js */
  const st = qualityStep(
    {
      q: walkRenderer.q,
      R: walkView.R,
      adaptT: walkRenderer.adaptT,
      swapT: walkRenderer.swapT,
      raiseT: walkRenderer.raiseT,
      holdT: walkRenderer.holdT,
      roomN: walkRenderer.roomN,
    },
    {
      int: walkRenderer.int,
      slow: walkView.slow,
      target,
      now: performance.now(),
      phone: typeof navigator !== 'undefined' && /Android|iPhone/.test(navigator.userAgent),
    }
  );
  walkRenderer.q = st.q;
  walkView.R = st.R;
  walkRenderer.adaptT = st.adaptT;
  walkRenderer.raiseT = st.raiseT;
  walkRenderer.holdT = st.holdT;
  walkRenderer.roomN = st.roomN;
}
/* phase 04d: the Studio swaps in its own (studio/js/engine-editor.js and viewport.js) */
export function setAdaptQuality(v) {
  adaptQuality = v; // eslint-disable-line no-func-assign
  provide({ adaptQuality });
}
