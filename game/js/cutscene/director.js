'use strict';
/* ================= CUTSCENES: THE DIRECTOR =================
   What every cutscene stands on, filmed with the walk-scene engine (walkView.director hook): the state, timing that
   resolves at once while skipping, the camera (eye, target, field of view, a width that stays in frame on phones), the
   people in the scene, what the engine draws each frame, the overlay (letterbox, caption, skip, fade) and the dialogue
   in the shared box (talk.js), skipping and the teardown. Split from cutscene.js (Project Story, the cutscene tools). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { landing, landingFrame, openingFall, provide } from '../hooks.js';
import { $, clamp } from '../util.js';
import { reducedMotion } from '../game-state.js';
import { makeCanvas } from '../art.js';
import { personBattlePose, personWalkFrames } from '../person-art.js';
import { particleSprite } from '../battle-stage.js';
import { directionOf, stopWalkView, walkData, walkView } from '../walk-view.js';
import { walkRenderer } from '../walk/walk-state.js';
import { personItem } from '../walk/frame-items.js';
import { talkBox, talkHide, talkLine } from '../talk.js';
/* eslint-disable no-func-assign */
expose({
  DARK_ART: [() => DARK_ART],
  MIRROR_ART: [() => MIRROR_ART],
  cutscene: [() => cutscene],
  cutsceneAct: [() => cutsceneAct, v => (cutsceneAct = v)],
  cutsceneActor: [() => cutsceneActor, v => (cutsceneActor = v)],
  cutsceneBlink: [() => cutsceneBlink, v => (cutsceneBlink = v)],
  cutsceneCameraNow: [() => cutsceneCameraNow, v => (cutsceneCameraNow = v)],
  cutsceneCaption: [() => cutsceneCaption, v => (cutsceneCaption = v)],
  cutsceneDark: [() => cutsceneDark, v => (cutsceneDark = v)],
  cutsceneEase: [() => cutsceneEase],
  cutsceneFlush: [() => cutsceneFlush, v => (cutsceneFlush = v)],
  cutsceneFrame: [() => cutsceneFrame, v => (cutsceneFrame = v)],
  cutsceneHTML: [() => cutsceneHTML, v => (cutsceneHTML = v)],
  cutsceneHideDialogue: [() => cutsceneHideDialogue, v => (cutsceneHideDialogue = v)],
  cutsceneMirrored: [() => cutsceneMirrored, v => (cutsceneMirrored = v)],
  cutsceneNow: [() => cutsceneNow],
  cutscenePersonItem: [() => cutscenePersonItem, v => (cutscenePersonItem = v)],
  cutscenePortraitTick: [() => cutscenePortraitTick, v => (cutscenePortraitTick = v)],
  cutsceneSay: [() => cutsceneSay, v => (cutsceneSay = v)],
  cutsceneShot: [() => cutsceneShot, v => (cutsceneShot = v)],
  cutsceneSparkle: [() => cutsceneSparkle, v => (cutsceneSparkle = v)],
  cutsceneTap: [() => cutsceneTap, v => (cutsceneTap = v)],
  cutsceneTeardown: [() => cutsceneTeardown, v => (cutsceneTeardown = v)],
  cutsceneTraffic: [() => cutsceneTraffic, v => (cutsceneTraffic = v)],
  cutsceneTrafficEnd: [() => cutsceneTrafficEnd, v => (cutsceneTrafficEnd = v)],
  cutsceneTrafficTick: [() => cutsceneTrafficTick, v => (cutsceneTrafficTick = v)],
  cutsceneWait: [() => cutsceneWait, v => (cutsceneWait = v)],
  cutsceneWalk: [() => cutsceneWalk, v => (cutsceneWalk = v)],
  skipCutscene: [() => skipCutscene, v => (skipCutscene = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const cutscene = {
  on: false,
  run: 0,
  skip: false,
  waits: [],
  cam: null,
  actors: {},
  stars: [],
  coins: [],
  fx: [],
  lights: [],
  items: [],
  parts: [],
  hide: null,
  sel: 0,
  choosing: false,
  say: null,
  por: { who: null, expr: null, t: 0 },
  flashes: [],
  ui: null,
  /* the cutscene playing (game/data/cutscenes), where its map's corner is in the view, its places by name beyond its
     spots (the starter you picked), and what it draws of its own each frame */
  set: null,
  off: [0, 0],
  named: {},
  layers: [],
  traffic: [],
};
provide({ cutscene }); /* to-module */
export const cutsceneNow = () => performance.now();
const cutsceneEase = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/* ---------- timing helpers: everything resolves at once while skipping ---------- */
export function cutsceneWait(ms) {
  if (cutscene.skip || !cutscene.on) return Promise.resolve();
  return new Promise(r => {
    const id = setTimeout(done, ms);
    function done() {
      clearTimeout(id);
      cutscene.waits = cutscene.waits.filter(f => f !== done);
      r();
    }
    cutscene.waits.push(done);
  });
}
export function cutsceneFlush() {
  const w = cutscene.waits.slice();
  cutscene.waits = [];
  w.forEach(f => f());
  if (talkBox.cur && cutscene.on) talkBox.cur.done();
}
function skipCutscene() {
  if (!cutscene.on || cutscene.choosing || cutscene.dressing) return;
  cutscene.skip = true;
  cutsceneFlush();
}
/* ---------- the camera: eye, target, field of view and a width that must stay in frame (phones) ---------- */
function cutsceneCameraNow() {
  const c = cutscene.cam;
  if (!c) return null;
  const k = c.dur && !cutscene.skip && !reducedMotion ? cutsceneEase(clamp((cutsceneNow() - c.t0) / c.dur, 0, 1)) : 1,
    L = (a, b) => a.map((v, i) => v + (b[i] - v) * k);
  return {
    eye: L(c.a.eye, c.b.eye),
    tgt: L(c.a.tgt, c.b.tgt),
    fov: c.a.fov + (c.b.fov - c.a.fov) * k,
    w: (c.a.w || 0) + ((c.b.w || 0) - (c.a.w || 0)) * k,
  };
}
export function cutsceneShot(K, ms = 0) {
  K = Object.assign({ fov: 40, w: 0 }, K);
  const a = cutsceneCameraNow() || K;
  cutscene.cam = { a, b: K, t0: cutsceneNow(), dur: ms };
  return cutsceneWait(ms);
}
/* ---------- actors ---------- */
/* dark: drawn as a silhouette, so who it is stays hidden (the city opening's figure) */
export function cutsceneActor(id, who, at, dir, dark = false) {
  cutscene.actors[id] = { id, who, x: at[0], z: at[1], dir: dir || 'down', walk: null, act: null, actT: 0, dark };
  return cutscene.actors[id];
}
export function cutsceneWalk(id, to, ms) {
  const a = cutscene.actors[id];
  a.walk = { x0: a.x, z0: a.z, x1: to[0], z1: to[1], t0: cutsceneNow(), dur: ms };
  a.dir = directionOf(to[0] - a.x, to[1] - a.z);
  return cutsceneWait(ms);
}
export function cutsceneAct(id, act, ms) {
  const a = cutscene.actors[id];
  a.act = act;
  a.actT = cutsceneNow();
  return cutsceneWait(ms || 0).then(() => {
    if (ms) a.act = null;
  });
}
function cutscenePersonItem(a, t, C0) {
  let im;
  const now = cutsceneNow();
  if (a.walk) {
    const k = cutscene.skip || reducedMotion ? 1 : clamp((now - a.walk.t0) / a.walk.dur, 0, 1);
    a.x = a.walk.x0 + (a.walk.x1 - a.walk.x0) * k;
    a.z = a.walk.z0 + (a.walk.z1 - a.walk.z0) * k;
    if (k >= 1) a.walk = null;
  }
  if (a.walk) {
    const set = personWalkFrames(a.who)[a.dir] || personWalkFrames(a.who).down;
    im = set.cyc ? set.cyc[Math.floor(t / 110) % 6] : set[1 + (Math.floor(t / 150) % 2)];
  } else if (a.act === 'throw') im = personBattlePose(a.who, 'front', 'throw', clamp((now - a.actT) / 700, 0, 1));
  else if (a.act === 'cheer' || a.act === 'react') im = personBattlePose(a.who, 'front', a.act, 0, now - a.actT);
  else if (a.act === 'reach') {
    /* an arm held out the way they face: the throw's wind-up, held */
    const view = a.dir === 'up' ? 'back' : a.dir === 'down' ? 'front' : 'side';
    im = personBattlePose(a.who, view, 'throw', 0.35);
    if (a.dir === 'sideR') im = cutsceneMirrored(im);
  } else im = (personWalkFrames(a.who)[a.dir] || personWalkFrames(a.who).down)[0];
  return personItem('actor', a.dark ? cutsceneDark(im) : im, a.x, a.z, C0, {});
}
/* a picture of a person, flat dark (a silhouette) or mirrored, made once per picture */
const DARK_ART = new WeakMap(),
  MIRROR_ART = new WeakMap();
function cutsceneDark(im) {
  if (!im || !(im.width || im.naturalWidth)) return im;
  let d = DARK_ART.get(im);
  if (!d) {
    d = makeCanvas(im.width || im.naturalWidth, im.height || im.naturalHeight);
    const x = d.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#0D0A16';
    x.fillRect(0, 0, d.width, d.height);
    if (im.__mat) d.__mat = im.__mat;
    DARK_ART.set(im, d);
  }
  return d;
}
function cutsceneMirrored(im) {
  if (!im || !(im.width || im.naturalWidth)) return im;
  let d = MIRROR_ART.get(im);
  if (!d) {
    d = makeCanvas(im.width || im.naturalWidth, im.height || im.naturalHeight);
    const x = d.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.setTransform(-1, 0, 0, 1, d.width, 0);
    x.drawImage(im, 0, 0);
    MIRROR_ART.set(im, d);
  }
  return d;
}
/* ---------- traffic: props (flying cars) along a cutscene's lanes, again and again ---------- */
/* lane: [x, height, z] points in the view; each prop is a placement in the scene for as long as the cutscene lasts */
export function cutsceneTraffic(lane, key, s, count) {
  const sc = walkView.sc;
  if (!sc || lane.length < 2) return;
  const seg = [];
  let len = 0;
  for (let i = 1; i < lane.length; i++) {
    const a = lane[i - 1],
      b = lane[i],
      l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    seg.push({ a, b, l, at: len });
    len += l;
  }
  for (let i = 0; i < count; i++) {
    const p = { k: key, x: lane[0][0], z: lane[0][2], lift: lane[0][1], moving: 1 };
    (sc.props || (sc.props = [])).push(p);
    cutscene.traffic.push({ p, seg, len, dur: s * 1000, ph: i / count, t0: cutsceneNow() });
  }
  if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
}
function cutsceneTrafficTick(now) {
  for (const T of cutscene.traffic) {
    const d = (((now - T.t0) / T.dur + T.ph) % 1) * T.len,
      S = T.seg.find(q => d <= q.at + q.l) || T.seg[T.seg.length - 1],
      k = S.l ? (d - S.at) / S.l : 0;
    T.p.x = S.a[0] + (S.b[0] - S.a[0]) * k;
    T.p.z = S.a[2] + (S.b[2] - S.a[2]) * k;
    T.p.lift = S.a[1] + (S.b[1] - S.a[1]) * k;
    /* facing along the lane: a car flies nose first (its model's front is +x, so flip when going -x) */
    T.p.f = S.b[0] < S.a[0] ? 1 : 0;
  }
}
export function cutsceneTrafficEnd() {
  const sc = walkView.sc,
    gone = new Set(cutscene.traffic.map(T => T.p));
  if (sc && sc.props && gone.size) sc.props = sc.props.filter(p => !gone.has(p));
  cutscene.traffic = [];
}
/* ---------- what the engine draws: walkView.director.frame ---------- */
export function cutsceneFrame() {
  if (!cutscene.on) return null;
  const t = walkView.t,
    C0 = walkData().sc,
    items = cutscene.items,
    parts = cutscene.parts,
    lights = cutscene.lights,
    now = cutsceneNow();
  items.length = 0;
  parts.length = 0;
  lights.length = 0;
  for (const a of Object.values(cutscene.actors)) if (!a.hidden) items.push(cutscenePersonItem(a, t, C0));
  /* what a cutscene adds of its own (the opening's starters and coins: opening.js), and its traffic */
  for (const f of cutscene.layers) f(items, parts, lights, now, t);
  if (cutscene.traffic.length) cutsceneTrafficTick(now);
  const spark = typeof particleSprite === 'function' ? particleSprite('sparkle') : null;
  cutscene.fx = cutscene.fx.filter(f => now - f.t0 < f.life);
  for (const f of cutscene.fx) {
    const k = (now - f.t0) / f.life;
    if (spark && spark.width > 1)
      parts.push({
        im: spark,
        x: f.x + f.vx * k,
        y: f.y + f.vy * k - 0.5 * k * k,
        z: f.z + f.vz * k,
        w: 0.18 * (1 - k * 0.5),
        h: 0.18 * (1 - k * 0.5),
        a: 1 - k,
        glow: true,
      });
  }
  cutscene.flashes = cutscene.flashes.filter(f => now - f.t0 < 500);
  for (const f of cutscene.flashes) {
    const k = 1 - (now - f.t0) / 500;
    lights.push({ p: f.p, r: 2.6, c: [1.4 * k, 1.2 * k, 0.7 * k] });
  }
  if (typeof landingFrame === 'function') landingFrame(now, parts);
  const K = cutsceneCameraNow() || { eye: [17, 14, -6], tgt: [17, 0, 12], fov: 42, w: 0 },
    sway = reducedMotion ? 0 : 1,
    look = {
      eye: [K.eye[0] + Math.sin(now / 2300) * 0.04 * sway, K.eye[1] + Math.sin(now / 1700) * 0.025 * sway, K.eye[2]],
      tgt: K.tgt,
      fov: K.fov,
      w: K.w,
    };
  const fd = Math.hypot(K.tgt[0] - K.eye[0], K.tgt[1] - K.eye[1], K.tgt[2] - K.eye[2]);
  cutscenePortraitTick(now);
  return {
    look,
    items,
    lights,
    parts,
    hide: cutscene.hide,
    focus: fd,
    blur: fd < 6 ? 0.45 : 0.2,
    center: [K.tgt[0], K.tgt[2]],
    cut: 2.6,
  };
}
export function cutsceneSparkle(p, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random();
    cutscene.fx.push({
      x: p[0],
      y: p[1],
      z: p[2],
      vx: Math.cos(a) * 0.7,
      vy: 0.6 + Math.random() * 0.6,
      vz: Math.sin(a) * 0.4,
      t0: cutsceneNow(),
      life: 500 + Math.random() * 300,
    });
  }
}

/* ---------- the overlay: letterbox, caption, dialogue, starter picker ---------- */
export function cutsceneHTML() {
  return `<div class="cs-bars" aria-hidden="true"><i></i><i></i></div>
 <div class="cs-cap" id="csCap" aria-live="polite"><small></small><b></b></div>
 <button class="cs-skip pb small quiet" data-a="cs-skip">Skip ›</button>
 <div class="cs-pick px" id="csPick" hidden></div>
 <div class="cs-fight" id="csFight" hidden></div>
 <div class="cs-bubble" id="csBubble" role="status" hidden></div>
 <div class="cs-fade" id="csFade"></div>`;
}
export function cutsceneCaption(sub, title, ms = 3200) {
  const c = $('#csCap');
  if (!c || cutscene.skip) return;
  c.querySelector('small').textContent = sub;
  c.querySelector('b').textContent = title;
  c.classList.add('on');
  setTimeout(() => c.classList.remove('on'), ms);
}
/* one line of dialogue in the shared dialogue box (talk.js) */
export function cutsceneSay(who, text, expr) {
  if (cutscene.skip || !cutscene.on) return Promise.resolve();
  const pr = talkLine(who, text, expr, { cs: true });
  cutscene.say = talkBox.cur;
  cutscene.sayT = performance.now();
  return pr.then(() => {
    if (cutscene.say && !cutscene.say.typing) cutscene.say = null;
    /* phase 06-2b: skipped several lines fast? Hazel says something about it, once */
    const q = cutscene.quip;
    cutscene.quip = null;
    if (q && !cutscene.skip && cutscene.on) return cutsceneSay('gini', q, 'surprised');
  });
}
export function cutsceneHideDialogue() {
  talkHide();
  cutscene.say = null;
}
/* v47: waking up: the picture starts blurred and bright and sharpens; the letterbox closes like eyelids to blink */
export function cutsceneBlink() {
  if (cutscene.skip || reducedMotion || !cutscene.on) return Promise.resolve();
  document.body.classList.add('cs-blink');
  return cutsceneWait(170).then(() => {
    document.body.classList.remove('cs-blink');
    return cutsceneWait(240);
  });
}
function cutscenePortraitTick() {}
function cutsceneTap(ev) {
  if (!cutscene.on) return;
  if (ev && ev.target.closest && ev.target.closest('button,input,.cs-pick,.cs-fight')) return;
  if (talkBox.cur) {
    /* phase 06-2b: a tap that cuts a line short counts towards Hazel's "too fast" comment */
    if (talkBox.cur.typing && cutscene.skipWatch && !cutscene.quip)
      cutscene.quip = cutscene.skipWatch.record(performance.now() - (cutscene.sayT || 0));
    talkBox.cur.tap();
  }
}
export function cutsceneTeardown() {
  talkHide();
  cutscene.on = false;
  cutscene.run++;
  cutscene.skip = false;
  cutsceneFlush();
  cutscene.choosing = false;
  cutscene.dressing = false;
  walkView.director = null;
  walkRenderer.bt = null;
  walkRenderer.camT = null;
  walkRenderer.focus = null;
  const el = $('#cs');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  if (typeof openingFall !== 'undefined') {
    cancelAnimationFrame(openingFall.raf);
    if (openingFall.cv) {
      openingFall.cv.remove();
      openingFall.cv = null;
    }
  }
  if (typeof landing !== 'undefined') landing.bits = [];
  cutscene.foe = null;
  cutscene.layers = [];
  cutsceneTrafficEnd();
  cutscene.set = null;
  cutscene.named = {};
  document.body.classList.remove(
    'in-cs',
    'cs-choosing',
    'cs-dress',
    'cs-falling',
    'cs-dazed',
    'cs-waking',
    'cs-blink',
    'cs-fighting'
  );
  if (walkView.cv) stopWalkView();
}
document.addEventListener('click', ev => {
  if (!cutscene.on) return;
  const el = ev.target.closest('[data-a]');
  const a = el && el.dataset.a;
  if (!a) {
    if (ev.target.closest('#cs')) cutsceneTap(ev);
    return;
  }
  if (a === 'cs-skip') skipCutscene();
});
document.addEventListener('keydown', ev => {
  if (!cutscene.on || cutscene.dressing) return;
  if (ev.key === 'Escape') skipCutscene();
});
