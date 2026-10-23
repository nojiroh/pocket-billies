'use strict';
/* ================= CUTSCENES: THE OPENING =================
   Starts with New game on the title screen: first the fall (opening-fall.js), then Copperleaf, filmed with the walk-scene
   engine: you wake in the dust outside Professor Chosen's lab and he comes running, his assistant Hazel behind him; you make yourself up in the dressing
   room; Blake barges in and the Chosen fights him himself; three coins pop open into the starters; you pick one, Blake takes
   the one that beats it and battles you on the spot (opening-fall.js battleTutor, story.js storyAfterRival). If it can't
   run or stops, a Try again screen (ui.js renderIntro). What happens and in which order is the cutscene's file,
   game/data/cutscenes/opening.json (docs/CUTSCENES.md); this module mounts the view, clears the set, plays it on the
   cutscene stage (stage.js) with the opening's own commands (the dressing room, the coins, the pick, the staged fight,
   Blake's battle after) and starts the game. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { fallPlay, landing, mapIdAt, provide, render, startGame, updateNav } from '../hooks.js';
import { $, clamp } from '../util.js';
import { CUTSCENES, LOCATIONS, RULES, SPECIES, START_NODE, locationFullName } from '../game-data.js';
import { CHOSEN, FAST_SKIPS, FAST_SKIP_MS, hotTake, speedWatch } from '../logic/chosen.js';
import { cutsceneCleared, cutsceneOffset, cutscenePoint } from '../logic/cutscene-set.js';
import { uiState } from '../game-state.js';
import { userFps } from '../frame-scheduler.js';
import { artLoad } from '../art.js';
import { LOOK_PRESETS, cleanLook } from '../person-art.js';
import { dressingRoom, openDressingRoom, saveDressingLook } from '../dressing-room.js';
import { rigPreload } from '../skeleton-rig.js';
import { buzz } from '../battle-stage.js';
import {
  artImage,
  imageReady,
  mapById,
  prepareMap,
  stopWalkView,
  walkData,
  walkView,
  worldToScreen,
} from '../walk-view.js';
import { gpuState, webgl2Supported } from '../engine/webgl.js';
import { walkRenderer } from '../walk/walk-state.js';
import { standingHeightAt } from '../walk/heights.js';
import { mountWalkView } from '../walk-view-gl.js';
import { seamlessRoamView } from '../seamless-world.js';
import { soundEffect } from '../sound.js';
import {
  cutscene,
  cutsceneAct,
  cutsceneFrame,
  cutsceneHTML,
  cutsceneHideDialogue,
  cutsceneNow,
  cutsceneSparkle,
  cutsceneTeardown,
  cutsceneTrafficEnd,
  cutsceneWait,
} from './director.js';
import { cutsceneLook, cutscenePlayScript } from './stage.js';
import { chooseStarter, cutsceneStarterItem } from './starter-pick.js';
import { hazelFight } from './staged-fight.js';
/* eslint-disable no-func-assign */
expose({
  cutsceneAbort: [() => cutsceneAbort, v => (cutsceneAbort = v)],
  cutsceneEnd: [() => cutsceneEnd, v => (cutsceneEnd = v)],
  cutsceneMapId: [() => cutsceneMapId, v => (cutsceneMapId = v)],
  cutsceneStart: [() => cutsceneStart, v => setCutsceneStart(v)],
  cutsceneStartName: [() => cutsceneStartName],
  cutsceneWanted: [() => cutsceneWanted, v => (cutsceneWanted = v)],
  hazelHotTake: [() => hazelHotTake, v => ((hazelHotTake = v), provide({ hazelHotTake }))],
  openingCity: [() => openingCity, v => (openingCity = v)],
  openingDressingRoom: [() => openingDressingRoom, v => (openingDressingRoom = v)],
  openingLayer: [() => openingLayer, v => (openingLayer = v)],
  openingPickStarter: [() => openingPickStarter, v => (openingPickStarter = v)],
  openingScript: [() => openingScript, v => (openingScript = v)],
  openingThrowCoins: [() => openingThrowCoins, v => (openingThrowCoins = v)],
});
/* eslint-enable no-func-assign */
provide({ hazelHotTake });
export function setCutsceneStart(v) {
  cutsceneStart = v; // eslint-disable-line no-func-assign
  provide({ cutsceneStart });
}
/* to-module: end */
/* v47b: the opening (and the title behind it) is filmed in the same view of Copperleaf the game then walks in: the town
   with the first stretch of each road. So nothing is built again between the title, the opening, Blake's battle
   and your first steps (it was a pause of most of a second as the battle began) */
export function cutsceneMapId() {
  const id = mapIdAt(START_NODE);
  try {
    const v = typeof seamlessRoamView === 'function' ? seamlessRoamView(START_NODE, null) : null;
    if (v && v.id && mapById(v.id)) return v.id;
  } catch (e) {
    console.error(e);
  }
  return id;
}
export function cutsceneWanted() {
  return (
    typeof webgl2Supported === 'function' &&
    !gpuState.fail &&
    webgl2Supported() &&
    typeof mapIdAt === 'function' &&
    !!mapById(mapIdAt(START_NODE))
  );
}
/* alpha 0.4: the start's name, for the opening's caption (Copperleaf Town) */
export const cutsceneStartName = () =>
  typeof locationFullName === 'function' && LOCATIONS[START_NODE]
    ? locationFullName(LOCATIONS[START_NODE])
    : 'the Hollow Earth';

/* ---------- the cutscene ---------- */
/* opts.quick (phase 16 test boot, js/test-boot.js): no fall, and the dressing room keeps a random look on its own,
   so the game opens on the professor's scene and goes on to the coins and the starter pick */
export async function cutsceneStart(opts) {
  if (cutscene.on) return;
  const id = cutsceneMapId();
  cutscene.on = true;
  cutscene.quick = !!(opts && opts.quick);
  cutscene.run++;
  const run = cutscene.run;
  cutscene.skip = false;
  cutscene.actors = {};
  cutscene.stars = [];
  cutscene.coins = [];
  cutscene.fx = [];
  cutscene.flashes = [];
  cutscene.cam = null;
  cutscene.sel = 1;
  cutscene.choosing = false;
  cutscene.hide = null;
  cutscene.rival = false;
  /* phase 06-2b: Blake's first Billie (Hazel's fight), how often each starter's hot take was asked, the "too fast"
     watch for skipped lines and a comment waiting to be said */
  cutscene.foe = null;
  cutscene.takes = {};
  cutscene.skipWatch = speedWatch(FAST_SKIP_MS, FAST_SKIPS, CHOSEN.tooFastSkips);
  cutscene.quip = null;
  if (typeof landing !== 'undefined') landing.bits = [];
  cutscene.pickList = RULES.start.starters.filter(l => SPECIES[l + '0']);
  let el = $('#cs');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cs';
    el.className = 'cs';
    document.body.appendChild(el);
  }
  el.innerHTML = cutsceneHTML();
  el.hidden = false;
  document.body.classList.add('in-cs');
  $('#app').innerHTML = '';
  updateNav(false);
  const pre = Promise.all([
    rigPreload(cutscene.pickList.map(l => [l + '0', 1])),
    artLoad(['coins/penny_32.png']),
    prepareMap(id),
  ]).catch(() => {});
  /* the fall from the crust down to Copperleaf (opening-fall.js); it ends on a white screen. RL-8 (the owner's answer,
     roguelite-track.md 8.20, "fall only"): New game no longer plays the city at night (cutscenes/city.json; openingCity
     stays for later) nor the fall's street leg, its stand-in */
  if (typeof fallPlay === 'function' && !cutscene.test && !cutscene.quick) {
    try {
      await fallPlay(run, { from: 'crust' });
    } catch (e) {
      console.error(e);
      const f = $('#csFade');
      if (f) f.classList.add('on');
    }
  } else {
    const f = $('#csFade');
    if (f) f.classList.add('on');
  }
  if (!cutscene.skip && !cutscene.test)
    document.body.classList.add('cs-dazed'); /* blurred already while the screen is white */
  if (!cutscene.on || cutscene.run !== run) return;
  await pre;
  if (!cutscene.on || cutscene.run !== run) return;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  cv.hidden = false;
  cv.setAttribute('aria-label', 'Opening scene in ' + cutsceneStartName());
  walkView.director = { frame: cutsceneFrame };
  await mountWalkView(cv, id, {
    state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
    keys: () => false,
    active: () => false,
    onPick: () => {},
    cap: () => (document.hidden ? 1 : dressingRoom.on ? 4 : Math.min(60, userFps())),
  });
  if (!cutscene.on || cutscene.run !== run) return;
  if (!walkRenderer.on || !walkView.ready || !walkView.cv) {
    cutsceneAbort();
    return;
  }
  cv = walkView.cv;
  cv.classList.add('in');
  const sc = walkView.sc,
    C0 = walkData().sc,
    C = CUTSCENES.opening,
    off = C && cutsceneOffset(sc, C.map);
  if (!off) {
    if (typeof debugLog !== 'undefined')
      debugLog.add('error', 'cutscene: the opening (cutscenes/opening.json) has no place here');
    cutsceneAbort();
    return;
  }
  /* out of the way while filming: what the cutscene's file clears (logic/cutscene-set.js) */
  cutscene.hide = cutsceneCleared(C, sc.props || [], C0.props, off);
  cutscene.layers.push(openingLayer);
  /* the town's ground is laid and drawn before the white fades */
  const f0 = walkRenderer.frames,
    t0 = performance.now();
  while (
    cutscene.on &&
    cutscene.run === run &&
    !(walkRenderer.gtex && walkRenderer.frames >= f0 + 3) &&
    performance.now() - t0 < 15000
  )
    await new Promise(r => setTimeout(r, 120));
  try {
    await openingScript(run);
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene: ' + (e.message || e));
    if (cutscene.on && cutscene.run === run) cutsceneAbort();
  }
}
/* the city opening: its own map's view on the same canvas, its cutscene played, the view stopped again (the fall
   comes next); false if it couldn't start (no file, no map, no 3D view). RL-8: New game doesn't play it (the owner's
   "fall only"); kept for when the story brings it back */
async function openingCity(run) {
  const C = CUTSCENES.city;
  if (!C || !mapById(C.map) || cutscene.skip) return false;
  const alive = () => cutscene.on && cutscene.run === run;
  const fade = $('#csFade');
  if (fade) fade.classList.add('on');
  let started = false;
  try {
    await prepareMap(C.map);
    if (!alive()) return true;
    let cv = $('#dio');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'dio';
      document.body.prepend(cv);
    }
    cv.hidden = false;
    cv.setAttribute('aria-label', 'A city at night, in the rain');
    walkView.director = { frame: cutsceneFrame };
    await mountWalkView(cv, C.map, {
      state: () => ({ who: null, npcs: [], enc: [], mode: 'line' }),
      keys: () => false,
      active: () => false,
      onPick: () => {},
      cap: () => (document.hidden ? 1 : Math.min(60, userFps())),
    });
    if (!alive() || !walkRenderer.on || !walkView.ready || !walkView.cv) return false;
    walkView.cv.classList.add('in');
    const f0 = walkRenderer.frames,
      t0 = performance.now();
    while (alive() && !(walkRenderer.gtex && walkRenderer.frames >= f0 + 3) && performance.now() - t0 < 15000)
      await new Promise(r => setTimeout(r, 120));
    if (!alive()) return true;
    started = true;
    await cutscenePlayScript('city');
    return true;
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene city: ' + (e.message || e));
    return started;
  } finally {
    /* the set struck: its traffic, people and camera gone, the view stopped; the canvas stays for Copperleaf */
    cutsceneTrafficEnd();
    cutscene.actors = {};
    cutscene.cam = null;
    cutscene.hide = null;
    cutscene.set = null;
    if (walkView.director && walkView.director.frame === cutsceneFrame) walkView.director = null;
    if (walkView.cv) stopWalkView();
  }
}
/* the opening plays game/data/cutscenes/opening.json on the cutscene stage, with its own commands below; Blake's
   battle follows when it says rival-battle, then the game starts with the Billie you picked */
async function openingScript(run) {
  const alive = () => cutscene.on && cutscene.run === run;
  await cutscenePlayScript('opening', {
    extra: {
      'dressing-room': openingDressingRoom,
      'throw-coins': openingThrowCoins,
      'pick-starter': openingPickStarter,
      'staged-fight': () => hazelFight(cutsceneLook('Blake')),
      'rival-battle': () => {
        cutscene.rival = true;
      },
    },
    slots: {
      place: () => cutsceneStartName(),
      starter: () => cutscene.picked.starter,
      counter: () => cutscene.picked.counter,
      foe: () => cutscene.foeName || 'mine',
    },
  });
  if (!alive()) return;
  cutsceneEnd(cutscene.picked.line);
}
/* ---------- the opening's own commands ---------- */
/* dressing-room: you make yourself up; skipping stops here */
async function openingDressingRoom() {
  const body = document.body;
  cutscene.skip = false;
  cutsceneHideDialogue();
  cutscene.dressing = true;
  body.classList.add('cs-dress');
  await new Promise(r => {
    openDressingRoom({
      mode: 'intro',
      noBack: true,
      look: uiState.trainerDraft || LOOK_PRESETS[Math.floor(Math.random() * LOOK_PRESETS.length)],
      done: r,
    });
    if (cutscene.test || cutscene.quick)
      setTimeout(() => {
        if (dressingRoom.on) saveDressingLook();
      }, 1500);
  });
  cutscene.dressing = false;
  body.classList.remove('cs-dress', 'cs-waking');
  uiState.avatarDraft = cleanLook(uiState.trainerDraft || LOOK_PRESETS[0]);
  uiState.trainerDraft = uiState.avatarDraft;
}
/* throw-coins: the Chosen's three coins fly to the starters' spots (star1-3) and pop open into the three Billies */
async function openingThrowCoins() {
  const C = cutscene.set,
    H = cutscene.actors[cutsceneLook('Chosen')];
  if (typeof soundEffect === 'function') soundEffect('throw');
  cutscene.pickList.forEach((l, i) => {
    const p = cutscenePoint(C.spots['star' + (i + 1)], cutscene.off),
      s = {
        sp: l + '0',
        x: p[0],
        z: p[1],
        pop: 0,
        a: 1,
        act: null,
        actT: 0,
        seed: i * 1.7 + 0.4,
        flip: i === 0 ? -1 : 1,
        white: 0,
      };
    cutscene.stars.push(s);
    cutscene.coins.push({
      a: [H.x + 0.2, standingHeightAt(H.x, H.z) + 1.35, H.z - 0.1],
      b: [p[0], standingHeightAt(p[0], p[1]) + 0.1, p[1]],
      t0: cutsceneNow() + i * 140,
      dur: 650,
      onLand() {
        const y = standingHeightAt(p[0], p[1]) + 0.3;
        s.popT = cutsceneNow();
        if (typeof soundEffect === 'function') soundEffect('pop');
        s.act = 'enter';
        s.actT = cutsceneNow();
        cutscene.flashes.push({ p: [p[0], y + 0.2, p[1]], t0: cutsceneNow() });
        if (!cutscene.skip) cutsceneSparkle([p[0], y, p[1]], 12);
        if (typeof buzz === 'function') buzz(8);
      },
    });
  });
  await cutsceneWait(1300);
  cutscene.coins.forEach(c => {
    if (!c.landed) {
      c.landed = 1;
      c.onLand();
    }
  });
  cutscene.coins = [];
}
/* pick-starter: the pick card; skipping stops here. The one you pick cheers, the others go; {starter} and {counter}
   (the one Blake will take) are known from here, and "starter" names the picked one's place */
async function openingPickStarter() {
  cutscene.skip = false;
  const l = await chooseStarter();
  cutscene.choosing = false;
  document.body.classList.remove('cs-choosing');
  $('#csPick').hidden = true;
  const si = cutscene.pickList.indexOf(l),
    star = cutscene.stars[si],
    rv = RULES.start.rival && RULES.start.rival[l];
  star.act = 'cheer';
  star.actT = cutsceneNow();
  cutscene.stars.forEach((s, i) => {
    if (i !== si) s.leave = cutsceneNow() + i * 90;
  });
  cutscene.named.starter = [star.x, star.z];
  cutscene.picked = {
    line: l,
    starter: SPECIES[l + '0'].name,
    counter: (rv && SPECIES[rv] && SPECIES[rv].name) || 'the one that beats yours',
  };
}
/* what the opening draws of its own each frame: the starters (and Blake's first Billie) popping, cheering and going,
   the light on the one you're looking at, the coins in the air */
function openingLayer(items, parts, lights, now, t) {
  const drawn = cutscene.foe ? [...cutscene.stars, cutscene.foe] : cutscene.stars;
  drawn.forEach((s, i) => {
    if (s.popT) {
      s.pop = cutscene.skip ? 1 : clamp((now - s.popT) / 420, 0, 1);
      s.white = Math.max(0, 1 - (now - s.popT) / 300);
    }
    if (s.leave) {
      const k = clamp((now - s.leave) / 500, 0, 1);
      s.a = 1 - k;
      s.hop = Math.sin(k * Math.PI) * 0.4;
    }
    if (s.pop > 0 && s.a > 0) {
      const it = cutsceneStarterItem(s, t);
      if (it) items.push(it);
    }
    if (cutscene.choosing && s !== cutscene.foe && i === cutscene.sel)
      lights.push({ p: [s.x, 0.35 + standingHeightAt(s.x, s.z), s.z - 0.2], r: 1.7, c: [0.55, 0.48, 0.3] });
  });
  const coin = artImage('coins/penny_32.png');
  for (const c of cutscene.coins) {
    const k = cutscene.skip ? 1 : clamp((now - c.t0) / c.dur, 0, 1);
    if (k >= 1) {
      if (!c.landed) {
        c.landed = 1;
        c.onLand();
      }
      continue;
    }
    const x = c.a[0] + (c.b[0] - c.a[0]) * k,
      z = c.a[2] + (c.b[2] - c.a[2]) * k,
      y = c.a[1] + (c.b[1] - c.a[1]) * k + Math.sin(k * Math.PI) * 1.25,
      sp = Math.abs(Math.cos(k * 14));
    if (imageReady(coin)) parts.push({ im: coin, x, y, z, w: 0.24 * Math.max(0.15, sp), h: 0.24, a: 1, glow: false });
    lights.push({ p: [x, y, z], r: 1.1, c: [0.5, 0.4, 0.12] });
  }
}
/* during the pick: tap the Chosen for a hot take about the starter you're looking at, in a bubble over his head */
function hazelHotTake() {
  const g = cutscene.actors[cutsceneLook('Chosen')],
    b = $('#csBubble');
  if (!g || !b || !walkView.C || !walkView.cv) return;
  const line = cutscene.pickList[cutscene.sel],
    n = cutscene.takes[line] || 0;
  cutscene.takes[line] = n + 1;
  b.textContent = hotTake(line, n);
  const q = worldToScreen(walkView.C, g.x, 2.1 + standingHeightAt(g.x, g.z), g.z),
    r = walkView.cv.getBoundingClientRect();
  b.hidden = false;
  if (q) {
    /* over his head, but kept fully on screen */
    const half = b.offsetWidth / 2 + 16;
    b.style.left = clamp(r.left + (q.x / walkView.cv.width) * r.width, half, innerWidth - half) + 'px';
    b.style.top = Math.max(b.offsetHeight + 70, r.top + (q.y / walkView.cv.height) * r.height) + 'px';
  }
  b.classList.remove('m-pop');
  void b.offsetWidth;
  b.classList.add('m-pop');
  cutsceneAct(cutsceneLook('Chosen'), 'react', 700);
  clearTimeout(b._t);
  b._t = setTimeout(() => (b.hidden = true), 3600);
}
function cutsceneEnd(l) {
  if (cutscene.test) {
    cutscene.test = false;
    cutsceneTeardown();
    const d = cutscene.testDone;
    cutscene.testDone = null;
    if (d) d();
    return;
  }
  const rival = cutscene.rival;
  cutsceneTeardown();
  startGame(l, { rival });
}
/* the opening couldn't run (no 3D view) or broke: phase 06-2, a Try again screen (ui.js renderIntro); the old
   step-by-step intro is gone */
function cutsceneAbort() {
  cutsceneTeardown();
  uiState.openingFailed = 'stopped';
  render();
}
