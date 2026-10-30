'use strict';
/* ================= WALK QUALITY AND CULLING =================
   Phase 20 (stage B): what the camera sees (the frustum, culling), the frame's budget, a place's mood and heat haze,
   and the automatic quality, moved from walk-view-gl.js as they were. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { gameData, provide, saveData } from '../hooks.js';
import { coverTarget, fadeEase, pictureCovers } from '../logic/occlude.js';
import { propDrawFade, qualityStep } from '../logic/quality-step.js';
import { ladderFeed, ladderTake, phoneAgent } from '../logic/frame-pace.js';
import { controlFrame, controlRestore, controlSaved } from '../logic/frame-control.js';
import { frameHalf, frameScheduler } from '../frame-scheduler.js';
import { battleStage } from '../battle-stage.js';
import { mapMoodName, walkView, worldToScreen } from '../walk-view.js';
import { engineContext, engineSetting } from '../engine/settings.js';
import { gpuState } from '../engine/webgl.js';
import { environment } from '../environment.js';
import { walkRenderer } from './walk-state.js';
import { worldCurveDrop } from './draw-common.js';
/* eslint-disable no-func-assign */
expose({
  CONTROL_STORE: [() => CONTROL_STORE],
  COVER_FADES: [() => COVER_FADES],
  CPU_LEVERS: [() => CPU_LEVERS],
  FRAME_WORK_MS: [() => FRAME_WORK_MS],
  FRUSTUM_PLANES: [() => FRUSTUM_PLANES],
  NEUTRAL_MOOD: [() => NEUTRAL_MOOD],
  PHONE_AGENT: [() => PHONE_AGENT],
  adaptQuality: [() => adaptQuality, v => setAdaptQuality(v)],
  computeFrustum: [() => computeFrustum, v => (computeFrustum = v)],
  controlHalf: [() => controlHalf, v => (controlHalf = v)],
  controlKind: [() => controlKind, v => (controlKind = v)],
  controlLeave: [() => controlLeave, v => (controlLeave = v)],
  controlQuality: [() => controlQuality, v => (controlQuality = v)],
  controlStoreRead: [() => controlStoreRead, v => (controlStoreRead = v)],
  controlStoreWrite: [() => controlStoreWrite, v => (controlStoreWrite = v)],
  coverFrame: [() => coverFrame, v => (coverFrame = v)],
  coverItems: [() => coverItems, v => (coverItems = v)],
  cpuLevers: [() => cpuLevers, v => (cpuLevers = v)],
  cullItems: [() => cullItems, v => (cullItems = v)],
  easedMood: [() => easedMood, v => (easedMood = v)],
  fenceLag: [() => fenceLag, v => (fenceLag = v)],
  frameBudgetLeft: [() => frameBudgetLeft, v => ((frameBudgetLeft = v), provide({ frameBudgetLeft }))],
  frameBudgetRemaining: [() => frameBudgetRemaining, v => (frameBudgetRemaining = v)],
  heatHaze: [() => heatHaze, v => (heatHaze = v)],
  heatSources: [() => heatSources, v => (heatSources = v)],
  inFrustum: [() => inFrustum, v => (inFrustum = v)],
  setAdaptQuality: [() => setAdaptQuality, v => (setAdaptQuality = v)],
});
/* eslint-enable no-func-assign */
provide({ frameBudgetLeft });
/* to-module: end */
/* FL-1a: one phone test (logic/frame-pace.js phoneAgent: an iPad that says it is a Mac counts) */
const PHONE_AGENT = typeof navigator !== 'undefined' && phoneAgent(navigator.userAgent, navigator.maxTouchPoints);
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
  walkRenderer.frustum = F;
  let n = 0,
    k = 0;
  const on = engineSetting('quality', 'cull') ?? true;
  /* 0.1.0 alpha: things too small to see, and on a phone small things past the draw distance (logic/quality-step.js) */
  const m = C.vp,
    H = (walkView.cv && walkView.cv.height) || 800,
    cpu = cpuLevers(PHONE_AGENT ? walkRenderer.qc || 0 : 0),
    fo = {
      minPx: Math.max(engineSetting('quality', 'minPropPx') ?? 0, cpu.minPx),
      phoneDistance: cpu.distance(engineSetting('quality', 'phonePropDistance') ?? 0),
      phone: PHONE_AGENT,
    };
  for (const it of items) {
    /* FL-3a: on a phone held back by its main thread, townsfolk (not residents) past the CPU level's distance */
    if (on && cpu.folk && it.k === 'folk' && !(it.f && it.f.res)) {
      const W = m[3] * it.x + m[7] * (it.y || 0) + m[11] * it.z + m[15];
      if (W > cpu.folk) {
        it.vis = false;
        k++;
        n++;
        continue;
      }
    }
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
    if (it.vis && !it.fx && (fo.minPx > 0 || fo.phoneDistance > 0) && !(it.M && (it.M.build || it.M.door))) {
      const W = m[3] * it.x + m[7] * cy + m[11] * it.z + m[15];
      if (W > 0.1) {
        const px = ((r * Math.hypot(m[1], m[5], m[9])) / W) * H,
          f = propDrawFade({ r, depth: W, px }, fo);
        if (f <= 0) it.vis = false;
        else if (f < 1) it.fade = (it.fade ?? 1) * f;
      }
    }
    k++;
    if (!it.vis) n++;
  }
  walkRenderer.culled = n;
  walkRenderer.cullOf = k;
}
/* FL-3a: the controller's CPU level (walkRenderer.qc, 0-3) as look trades the owner allowed on phones (2026-10-29): small
   props fade out nearer and tiny ones go, then far townsfolk go. Nothing off a phone (the controller doesn't take
   the CPU level there but in a battle, where it is the battle stage's detail level: battle-stage.js) */
const CPU_LEVERS = [
  { k: 1, minPx: 0, folk: 0 },
  { k: 0.8, minPx: 3, folk: 0 },
  { k: 0.65, minPx: 5, folk: 45 },
  { k: 0.5, minPx: 8, folk: 30 },
];
function cpuLevers(qc) {
  const L = CPU_LEVERS[Math.max(0, Math.min(3, qc | 0))];
  return {
    minPx: L.minPx,
    folk: L.folk,
    /* the set distance (0: none) brought in; with none set, from 90 m */
    distance: d => (L.k >= 1 ? d : (d > 0 ? d : 90) * L.k),
  };
}
/* player visibility: a tall picture standing nearer the camera that covers your feet, middle or head thins out
   (logic/occlude.js: to Engine > Camera > coverFade, milder while the see-through circle is on), eased in and out per
   placement so walking past doesn't pop it. All of a placement's pictures (its layers, its model) fade together.
   Sprites, solid props, models, voxel props and buildings all read the result from it.fade. None in battle. */
const COVER_FADES = new Map();
let coverFrame = 0;
export function coverItems(items, C, dt) {
  coverFrame++;
  const P = walkView.pl;
  if (walkRenderer.bt || !P || !C) {
    COVER_FADES.clear();
    return;
  }
  const pts = [0.1, 0.9, 1.6].map(h => worldToScreen(C, P.x, h, P.z)).filter(Boolean),
    target = coverTarget(+(engineSetting('camera', 'coverFade') ?? 0.4), walkRenderer.hidK || 0),
    want = new Map();
  if (pts.length)
    for (const it of items) {
      if (it.person || it.k !== 'prop' || it.vis === false || !it.mpp) continue;
      const s = it.mpp,
        hM = -it.oy * s;
      if (!(hM > 1.6)) continue;
      const key = it.p || it;
      if (want.get(key) === target) continue;
      const q = worldToScreen(C, it.x, 0, it.z);
      if (q && pts.some(me => pictureCovers(me, q, it.w * s * 0.5, hM))) want.set(key, target);
      else if (!want.has(key)) want.set(key, 1);
    }
  for (const [key, w] of want) {
    const e = COVER_FADES.get(key);
    if (!e && w === 1) continue;
    const v = fadeEase(e ? e.v : 1, w, dt);
    if (v === 1 && w === 1) COVER_FADES.delete(key);
    else COVER_FADES.set(key, { v, f: coverFrame });
  }
  for (const [key, e] of COVER_FADES) if (e.f !== coverFrame) COVER_FADES.delete(key);
  if (COVER_FADES.size)
    for (const it of items) {
      const e = COVER_FADES.get(it.p || it);
      if (e && e.v < 1) it.fade = (it.fade ?? 1) * e.v;
    }
}
/* v32: a per-frame time budget for one-off work (solid bodies, outlines of buildings): past it, things stay pictures
   for a frame or two instead of freezing the scene while they are worked out. LD-5: one budget for all of it, from the
   frame's start (walk-view-gl.js): the ground's preparing, the near ring, solid props, model meshes and buildings,
   FRAME_WORK_MS between them (they added up to about 35 ms); each still makes its first of a frame */
const FRAME_WORK_MS = PHONE_AGENT ? 8 : 10;
export function frameBudgetLeft() {
  return frameBudgetRemaining() > 0;
}
/** LD-5: the frame's one-off work budget left, ms */
export function frameBudgetRemaining() {
  return (walkRenderer.budMs ?? FRAME_WORK_MS) - (performance.now() - (walkRenderer.budT || 0));
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
export function adaptQuality(dtm, work, oneOff = 0) {
  if (!engineSetting('quality', 'auto')) {
    walkView.R = 1;
    walkRenderer.q = 0;
    walkRenderer.qc = 0;
    controlHalf(false);
    return;
  }
  const cap = walkView.opt.cap ? walkView.opt.cap() : 60;
  if (walkView.warm) {
    walkRenderer.int = 0;
    return;
  }
  /* alpha 0.1: the picture stays sharp at 60 frames a second; only Smoothest (preferences.aim) trades sharpness for more */
  const smooth =
    typeof saveData !== 'undefined' && saveData && saveData.preferences && saveData.preferences.aim === 'smooth';
  /* FL-1a: what the step is fed (logic/frame-pace.js ladderTake): nothing below 30 a second or for a moment after the
     rate changes (a window or a screen closing took a step down), nothing from the tick whose graphics calls were
     counted, and the target is the frame's own slot of refreshes (60 on a 90 Hz screen is every second refresh) */
  const feed = walkRenderer.feed || (walkRenderer.feed = ladderFeed()),
    now = performance.now(),
    ctlOn = !!engineSetting('quality', 'controller'),
    took = ladderTake(feed, {
      cap,
      aim: smooth ? 999 : 60,
      V: frameScheduler.period || 1000 / 60,
      half: frameScheduler.half,
      now,
      dtm,
      work,
      counted: frameScheduler.counted,
    });
  walkRenderer.int = feed.int;
  /* FL-3a: the controller (logic/frame-control.js), behind quality.controller until the owner's phone run */
  if (ctlOn) return controlQuality(dtm, work, oneOff, took, now);
  if (walkRenderer.ctl) controlLeave();
  if (!took) return;
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
    { int: took.int, slow: took.slow, target: took.target, now, phone: PHONE_AGENT }
  );
  walkRenderer.q = st.q;
  walkView.R = st.R;
  walkRenderer.adaptT = st.adaptT;
  walkRenderer.raiseT = st.raiseT;
  walkRenderer.holdT = st.holdT;
  walkRenderer.roomN = st.roomN;
}
/* FL-3a: the levels kept per place kind on this device (never the save) */
const CONTROL_STORE = 'pb-frame-levels';
function controlStoreRead() {
  try {
    return JSON.parse(localStorage.getItem(CONTROL_STORE) || '{}') || {};
  } catch {
    return {};
  }
}
function controlStoreWrite(kind, s) {
  try {
    const all = controlStoreRead();
    all[kind] = controlSaved(s);
    localStorage.setItem(CONTROL_STORE, JSON.stringify(all));
  } catch {
    /* storage blocked: it starts from the top next time */
  }
}
/** the place kind the levels are kept for: a battle, a room, a town, else a route */
function controlKind() {
  const sc = walkView.sc || {};
  return walkRenderer.bt ? 'battle' : sc.indoor ? 'room' : sc.kind === 'town' ? 'town' : 'route';
}
/* the half rate is the controller's to set and to take back (frame-scheduler.js frameHalf) */
function controlHalf(on) {
  if (frameScheduler.half === !!on) return;
  frameHalf(on, 'dio');
}
function controlLeave() {
  if (walkRenderer.ctl && walkRenderer.ctlKind) controlStoreWrite(walkRenderer.ctlKind, walkRenderer.ctl);
  walkRenderer.ctl = null;
  walkRenderer.ctlKind = '';
  walkRenderer.qc = 0;
  controlHalf(false);
}
/* how many frames the graphics chip is behind: a fence after each frame, read on the frames after (never waits);
   -1 when fences aren't there */
function fenceLag() {
  const gl = gpuState.gl;
  if (!gl || gpuState.lost || !gl.fenceSync) return -1;
  const F = walkRenderer.fences || (walkRenderer.fences = []),
    frame = walkRenderer.frames || 0;
  let lag = walkRenderer.fenceLag ?? -1;
  try {
    while (F.length && gl.getSyncParameter(F[0][0], gl.SYNC_STATUS) === gl.SIGNALED) {
      const [f, at] = F.shift();
      lag = frame - at;
      gl.deleteSync(f);
    }
    /* a backlog counts as far behind as it is */
    if (F.length) lag = Math.max(lag, frame - F[0][1]);
    if (F.length < 6) F.push([gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), frame]);
  } catch {
    return -1;
  }
  walkRenderer.fenceLag = lag;
  return lag;
}
function controlQuality(dtm, work, oneOff, took, now) {
  const kind = controlKind();
  if (!walkRenderer.ctl || walkRenderer.ctlKind !== kind) {
    if (walkRenderer.ctl) controlLeave();
    const kept = controlStoreRead()[kind];
    walkRenderer.ctl = kept
      ? controlRestore(kept)
      : controlRestore({ q: walkRenderer.q || 0, R: walkView.R || 1, taken: walkView.R < 1 ? ['R'] : [] });
    walkRenderer.ctlKind = kind;
  }
  const s = walkRenderer.ctl,
    lag = fenceLag();
  if (!took) {
    /* not measured (behind a window, just after one, a counted tick): nor is the next frame's gap. Behind a window
       or a screen the half rate is let go (it would hold the screen's own tasks back) */
    s.skipNext = true;
    if ((walkRenderer.feed && walkRenderer.feed.cap) < 30) {
      controlHalf(false);
      return;
    }
  } else {
    const V = frameScheduler.period || 1000 / 60,
      r = controlFrame(s, {
        now,
        dt: dtm,
        /* a battle: the stage's own frame work (its plates' page work left out) beside the 3D frame's */
        work: kind === 'battle' && typeof battleStage !== 'undefined' ? work + (battleStage.workOwn || 0) : work,
        lag,
        slot: took.target,
        V,
        skip: oneOff > took.target * 0.25,
        phone: PHONE_AGENT,
        floorR: PHONE_AGENT ? 0.6 : 0.5,
        cpu: PHONE_AGENT || kind === 'battle',
      });
    if (r) {
      walkRenderer.ctlLast = { t: Math.round(now), act: r.act, lever: r.lever, why: r.why };
      if (r.act !== 'floor') controlStoreWrite(kind, s);
    }
  }
  walkRenderer.q = s.lv.q;
  walkRenderer.qc = s.lv.c;
  walkView.R = s.lv.R;
  controlHalf(s.lv.half);
}
/* phase 04d: the Studio swaps in its own (studio/js/engine-editor.js and viewport.js) */
export function setAdaptQuality(v) {
  adaptQuality = v; // eslint-disable-line no-func-assign
  provide({ adaptQuality });
}
