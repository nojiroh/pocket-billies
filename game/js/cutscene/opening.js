'use strict';
/* ================= CUTSCENES: THE OPENING =================
   Starts with New game on the title screen: first the fall (opening-fall.js), then Copperleaf, filmed with the walk-scene
   engine: you wake in the dust outside Professor Hazel's lab and she comes running; you make yourself up in the dressing
   room; Blake barges in and Hazel fights him herself; three coins pop open into the starters; you pick one, Blake takes
   the one that beats it and battles you on the spot (opening-fall.js battleTutor, story.js storyAfterRival). If it can't
   run or stops, a Try again screen (ui.js renderIntro). Split from cutscene.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { fallPlay, landing, landingBurst, mapIdAt, provide, render, startGame, updateNav } from '../hooks.js';
import { $, clamp } from '../util.js';
import { LOCATIONS, RULES, SPECIES, START_NODE, TRAINERS, locationFullName } from '../game-data.js';
import { FAST_SKIPS, FAST_SKIP_MS, HAZEL, fillLine, hotTake, speedWatch } from '../logic/hazel.js';
import { reducedMotion, uiState } from '../game-state.js';
import { userFps } from '../frame-scheduler.js';
import { artLoad } from '../art.js';
import { LOOK_PRESETS, cleanLook, lookOf } from '../person-art.js';
import { dressingRoom, openDressingRoom, saveDressingLook } from '../dressing-room.js';
import { rigPreload } from '../skeleton-rig.js';
import { buzz } from '../battle-stage.js';
import { mapById, prepareMap, walkData, walkView, worldToScreen } from '../walk-view.js';
import { gpuState, webgl2Supported } from '../engine/webgl.js';
import { walkRenderer } from '../walk/walk-state.js';
import { standingHeightAt } from '../walk/heights.js';
import { mountWalkView } from '../walk-view-gl.js';
import { seamlessRoamView } from '../seamless-world.js';
import { music, soundEffect } from '../sound.js';
import {
  cutscene,
  cutsceneAct,
  cutsceneActor,
  cutsceneBlink,
  cutsceneCaption,
  cutsceneFrame,
  cutsceneHTML,
  cutsceneHideDialogue,
  cutsceneNow,
  cutsceneSay,
  cutsceneShot,
  cutsceneSparkle,
  cutsceneTeardown,
  cutsceneWait,
  cutsceneWalk,
} from './director.js';
import { chooseStarter } from './starter-pick.js';
import { hazelFight } from './staged-fight.js';
/* eslint-disable no-func-assign */
expose({
  CUTSCENE_SPOTS: [() => CUTSCENE_SPOTS],
  blakeArrives: [() => blakeArrives, v => (blakeArrives = v)],
  cutsceneAbort: [() => cutsceneAbort, v => (cutsceneAbort = v)],
  cutsceneEnd: [() => cutsceneEnd, v => (cutsceneEnd = v)],
  cutsceneMapId: [() => cutsceneMapId, v => (cutsceneMapId = v)],
  cutsceneScript: [() => cutsceneScript, v => (cutsceneScript = v)],
  cutsceneStart: [() => cutsceneStart, v => setCutsceneStart(v)],
  cutsceneStartName: [() => cutsceneStartName],
  cutsceneWanted: [() => cutsceneWanted, v => (cutsceneWanted = v)],
  hazelHotTake: [() => hazelHotTake, v => ((hazelHotTake = v), provide({ hazelHotTake }))],
  placeCutsceneSpots: [() => placeCutsceneSpots, v => (placeCutsceneSpots = v)],
});
/* eslint-enable no-func-assign */
provide({ hazelHotTake });
export function setCutsceneStart(v) {
  cutsceneStart = v; // eslint-disable-line no-func-assign
  provide({ cutsceneStart });
}
/* to-module: end */
const CUTSCENE_SPOTS = {
  door: [7.4, 15.4],
  hazel: [9.3, 13.25],
  me: [11.05, 12.95],
  meFrom: [14.6, 12.4],
  stars: [
    [8.8, 11.55],
    [10.15, 11.2],
    [11.5, 11.55],
  ],
  blake: [12.55, 12.7],
  blakeFrom: [16.4, 12.1],
};
/* v46: where the opening scene is filmed: in front of the lab's door, wherever the lab stands in Sundown */
function placeCutsceneSpots(sc) {
  let o = [0, 0];
  cutscene.dy = 0;
  const C0 = walkData().sc,
    L = ((sc && sc.props) || []).find(p => p.act === 'lab');
  if (L) {
    const M = C0.props[L.k] || {},
      dx = (((M.door && M.door.x) || 0) / (C0.ppu || 34)) * (L.s || 1) * (L.f ? -1 : 1);
    o = [L.x + dx - CUTSCENE_SPOTS.door[0], L.z - CUTSCENE_SPOTS.door[1]];
    /* alpha 0.4: the shots were framed for a lab on ground half a metre up (Marigold Town's); they rise and fall with the ground at the door */
    if (typeof standingHeightAt === 'function') cutscene.dy = standingHeightAt(L.x + dx, L.z - 0.6) - 0.5;
  }
  cutscene.o = o;
  const sh = p => [p[0] + o[0], p[1] + o[1]];
  cutscene.A = {
    door: sh(CUTSCENE_SPOTS.door),
    hazel: sh(CUTSCENE_SPOTS.hazel),
    me: sh(CUTSCENE_SPOTS.me),
    meFrom: sh(CUTSCENE_SPOTS.meFrom),
    stars: CUTSCENE_SPOTS.stars.map(sh),
    blake: sh(CUTSCENE_SPOTS.blake),
    blakeFrom: sh(CUTSCENE_SPOTS.blakeFrom),
  };
  cutscene.center = sh([10.1, 12.3]);
  return o;
}
/* v47b: the opening (and the title behind it) is filmed in the same view of Sundown the game then walks in: the town
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

/* ---------- the script ---------- */
/* opts.quick (phase 16 test boot, js/test-boot.js): no fall, and the dressing room keeps a random look on its own,
   so the game opens on Hazel's scene and goes on to the coins and the starter pick */
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
  cutscene.skipWatch = speedWatch(FAST_SKIP_MS, FAST_SKIPS, HAZEL.tooFastSkips);
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
    rigPreload(cutscene.pickList.map(l => [l + '0', false, 1])),
    artLoad(['coins/penny_32.png']),
    prepareMap(id),
  ]).catch(() => {});
  /* v47: the fall, from the surface down to Sundown (opening-fall.js); it ends on a white screen */
  if (typeof fallPlay === 'function' && !cutscene.test && !cutscene.quick) {
    try {
      await fallPlay(run);
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
    o = placeCutsceneSpots(sc);
  const eyes = [
    [12.6, 6.2],
    [10.5, 8.4],
    [10.4, 8.0],
    [10.15, 7.3],
  ].map(e => [e[0] + o[0], e[1] + o[1]]);
  /* out of the way while filming: what stands where it all happens, on Blake's way in, or right in front of a camera */
  const seg = (x, z, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      k = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - a[0] - dx * k, z - a[1] - dz * k);
  };
  cutscene.hide = new Set(
    (sc.props || []).filter(p => {
      const M = C0.props[p.k];
      return (
        M &&
        !M.flat &&
        ((p.x > 7.9 + o[0] && p.x < 12.9 + o[0] && p.z > 9.6 + o[1] && p.z < 13.9 + o[1]) ||
          seg(p.x, p.z, cutscene.A.blakeFrom, cutscene.A.blake) < 1.1 ||
          (!M.box && eyes.some(e => Math.hypot(p.x - e[0], p.z - e[1]) < 2.3)))
      );
    })
  );
  if (typeof debugLog !== 'undefined') debugLog.add('scene', 'opening cutscene');
  if (typeof music === 'function') music('hazel');
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
    await cutsceneScript(run);
  } catch (e) {
    console.error(e);
    if (typeof debugLog !== 'undefined') debugLog.add('error', 'cutscene: ' + (e.message || e));
    if (cutscene.on && cutscene.run === run) cutsceneAbort();
  }
}
async function cutsceneScript(run) {
  const alive = () => cutscene.on && cutscene.run === run,
    A = cutscene.A || CUTSCENE_SPOTS,
    O = cutscene.o || [0, 0],
    M = A.me,
    gy = standingHeightAt(M[0], M[1]),
    body = document.body,
    fade = $('#csFade');
  const pov = (h, tgt, fov, ms) =>
    cutsceneShot({ eye: [M[0] + 0.06, gy + h, M[1] - 0.32], tgt, fov, w: 1.3, abs: 1 }, ms);
  /* 1. you wake in the dust outside the lab, the papers that fell with you still coming down */
  pov(0.4, [M[0] + 2.4, gy + 3.9, M[1] + 5.4], 58);
  if (typeof landingBurst === 'function') landingBurst(M[0], M[1]);
  if (cutscene.skip) body.classList.remove('cs-dazed');
  if (fade) fade.classList.remove('on');
  setTimeout(() => {
    if (alive()) cutsceneCaption('The Hollow Earth', cutsceneStartName(), 3400);
  }, 1400);
  await cutsceneWait(1700);
  await cutsceneBlink();
  await cutsceneWait(420);
  await cutsceneBlink();
  if (!alive()) return;
  body.classList.add('cs-waking');
  body.classList.remove('cs-dazed');
  const dy = standingHeightAt(A.door[0], A.door[1]);
  pov(0.62, [A.door[0], dy + 1.25, A.door[1]], 52, 3200);
  await cutsceneWait(2600);
  if (!alive()) return;
  /* 2. the Professor comes running */
  const hy = standingHeightAt(A.hazel[0], A.hazel[1]);
  cutsceneActor('gini', 'gini', A.door, 'down');
  pov(0.78, [A.hazel[0], hy + 1.08, A.hazel[1]], 58, 1900);
  await cutsceneWalk('gini', A.hazel, 1500);
  cutscene.actors.gini.dir = 'down';
  if (!alive()) return;
  await cutsceneSay('gini', 'Oh! Another one! Are you all right? That was quite a landing.', 'surprised');
  await cutsceneSay(
    'gini',
    'You came down through the crust. Things do, now and then. Mostly furniture. You’re the first this week who can talk.'
  );
  await cutsceneSay('gini', 'Can you tell me your name?');
  if (!alive()) return;
  cutsceneHideDialogue();
  await cutsceneWait(1300);
  await cutsceneSay('gini', 'No? Nothing at all?', 'surprised');
  await cutsceneSay(
    'gini',
    'Classic fall-related amnesia. Very common down here. It usually comes back, a bit at a time.'
  );
  await cutsceneSay('gini', 'Let’s start with what we can see. Sit up, let me get a good look at you.', 'happy');
  if (!alive()) return;
  body.classList.remove('cs-dazed', 'cs-blink');
  /* 3. make yourself up (skipping stops here) */
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
  if (!alive()) return;
  uiState.avatarDraft = cleanLook(uiState.trainerDraft || LOOK_PRESETS[0]);
  uiState.trainerDraft = uiState.avatarDraft;
  /* 4. on your feet */
  cutsceneActor('me', 'me', M, 'side');
  cutscene.actors.gini.dir = 'sideR';
  cutsceneShot({ eye: [10.4, 1.75, 8.0], tgt: [10.2, 1.05, 12.9], fov: 40, w: 3.8 });
  cutsceneAct('me', 'react', 900);
  if (!alive()) return;
  const nm = lookOf('me').name || 'Trainer';
  await cutsceneSay('gini', `${nm}? It suits you. If it isn’t your name, it is now.`, 'happy');
  await cutsceneSay('gini', 'I’m Professor Hazel. I study Billies, the most common wildlife here in the Hollow Earth.');
  await cutsceneSay(
    'gini',
    'Clones of the richest people up top. A lab backed them up and filled the gaps with animals, then shipped the results down here. They went wild.'
  );
  await cutsceneSay(
    'gini',
    'They live in the long grass, in caves and canyons, even in the malls. Walk, and they come to you. Tax them with a coin, train a team, earn badges from the arena leaders.'
  );
  await cutsceneSay(
    'gini',
    'Nobody should walk the Hollow Earth alone. Luckily for you, I have three of them right here.',
    'happy'
  );
  if (!alive()) return;
  cutsceneHideDialogue();
  /* 4b. phase 06-2b: Blake barges in before you have a Billie, and Hazel fights him herself */
  const T0 = TRAINERS.blake0,
    who = (T0 && T0.who) || 'chad';
  if (T0) {
    await blakeArrives(who, A);
    if (!alive()) return;
    await hazelFight(who, A);
    if (!alive()) return;
    for (const [w, t] of HAZEL.afterFight(who)) {
      await cutsceneSay(w, t);
      if (!alive()) return;
    }
    cutsceneHideDialogue();
    cutscene.actors.rival.dir = 'side';
  }
  /* 5. three coins, three billionaires */
  cutscene.actors.gini.dir = 'down';
  cutscene.actors.me.dir = 'down';
  cutsceneShot({ eye: [10.15, 1.5, 7.3], tgt: [10.15, 0.7, 11.9], fov: 40, w: 4.4 }, 900);
  await cutsceneWait(500);
  cutsceneAct('gini', 'throw', 900);
  await cutsceneWait(380);
  if (typeof soundEffect === 'function') soundEffect('throw');
  cutscene.pickList.forEach((l, i) => {
    const p = A.stars[i],
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
      a: [cutscene.actors.gini.x + 0.2, standingHeightAt(A.hazel[0], A.hazel[1]) + 1.35, cutscene.actors.gini.z - 0.1],
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
  if (!alive()) return;
  await cutsceneSay(
    'gini',
    'Three Billies, three types. Each one beats one of the others. Take a good look before you choose!'
  );
  cutsceneHideDialogue();
  cutscene.skip = false;
  /* 6. pick one */
  const l = await chooseStarter();
  if (!alive()) return;
  cutscene.choosing = false;
  document.body.classList.remove('cs-choosing');
  $('#csPick').hidden = true;
  const si = cutscene.pickList.indexOf(l),
    star = cutscene.stars[si],
    sp = SPECIES[l + '0'];
  star.act = 'cheer';
  star.actT = cutsceneNow();
  cutscene.stars.forEach((s, i) => {
    if (i !== si) s.leave = cutsceneNow() + i * 90;
  });
  cutsceneShot(
    {
      eye: [10.4 + O[0], 1.45 + (cutscene.dy || 0), 8.0 + O[1]],
      tgt: [(star.x + A.me[0]) / 2, 0.85 + (cutscene.dy || 0), 12.2 + O[1]],
      fov: 40,
      w: 3.6,
      abs: 1,
    },
    900
  );
  cutsceneAct('me', 'cheer', 1300);
  await cutsceneWait(900);
  await cutsceneSay('gini', `${sp.name}! ${nm} and ${sp.name}. I like the sound of that.`, 'happy');
  if (!alive()) return;
  /* 7. phase 06-2b: Blake (already here since Hazel's fight) takes the one that beats yours and wants a battle */
  if (!T0) {
    await cutsceneSay(
      'gini',
      'Now go and explore! The road teaches more than any book. Come back and see me any time.',
      'happy'
    );
    if (!alive()) return;
    cutsceneHideDialogue();
    if (fade) fade.classList.add('on');
    await new Promise(r => setTimeout(r, reducedMotion ? 50 : 700));
    if (!alive()) return;
    cutsceneEnd(l);
    return;
  }
  const by = standingHeightAt(A.blake[0], A.blake[1]);
  cutsceneShot(
    {
      eye: [(A.hazel[0] + A.blake[0]) / 2, by + 1.9, A.me[1] - 5.2],
      tgt: [(A.hazel[0] + A.blake[0]) / 2, by + 1, A.me[1]],
      fov: 40,
      w: 5.9,
      abs: 1,
    },
    1100
  );
  if (typeof music === 'function') music('rival');
  cutscene.actors.me.dir = 'sideR';
  cutscene.actors.gini.dir = 'sideR';
  const rv = RULES.start.rival && RULES.start.rival[l],
    vars = {
      foe: cutscene.foeName || 'mine',
      counter: (rv && SPECIES[rv] && SPECIES[rv].name) || 'the one that beats yours',
      yours: sp.name,
    };
  for (const [w, t] of HAZEL.blakeTakes(who)) {
    await cutsceneSay(w, fillLine(t, vars));
    if (!alive()) return;
  }
  cutsceneHideDialogue();
  cutscene.rival = true;
  cutsceneAct('rival', 'cheer', 800);
  await cutsceneWait(700);
  if (fade) {
    fade.style.background = '#0B0912';
    fade.classList.add('on');
  }
  await new Promise(r => setTimeout(r, reducedMotion ? 50 : 600));
  if (!alive()) return;
  cutsceneEnd(l);
}
/* ---------- phase 06-2b: Blake arrives early, and Hazel fights him herself ---------- */
/* Blake runs in from the side and stands by Hazel */
async function blakeArrives(who, A) {
  cutsceneActor('rival', who, A.blakeFrom, 'side');
  const by = standingHeightAt(A.blake[0], A.blake[1]);
  cutsceneShot(
    {
      eye: [(A.hazel[0] + A.blake[0]) / 2, by + 1.9, A.me[1] - 5.2],
      tgt: [(A.hazel[0] + A.blake[0]) / 2, by + 1, A.me[1]],
      fov: 40,
      w: 5.9,
      abs: 1,
    },
    1100
  );
  if (typeof music === 'function') music('rival');
  const L = HAZEL.blakeArrives(who),
    walk = cutsceneWalk('rival', A.blake, 1500);
  cutscene.actors.me.dir = 'sideR';
  cutscene.actors.gini.dir = 'sideR';
  await cutsceneSay(L[0][0], L[0][1]);
  await walk;
  if (cutscene.actors.rival) cutscene.actors.rival.dir = 'side';
  for (const [w, t] of L.slice(1)) {
    if (!cutscene.on) return;
    await cutsceneSay(w, t);
  }
  cutsceneHideDialogue();
}
/* during the pick: tap Hazel for a hot take about the starter you're looking at, in a bubble over her head */
function hazelHotTake() {
  const g = cutscene.actors.gini,
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
    /* over her head, but kept fully on screen */
    const half = b.offsetWidth / 2 + 16;
    b.style.left = clamp(r.left + (q.x / walkView.cv.width) * r.width, half, innerWidth - half) + 'px';
    b.style.top = Math.max(b.offsetHeight + 70, r.top + (q.y / walkView.cv.height) * r.height) + 'px';
  }
  b.classList.remove('m-pop');
  void b.offsetWidth;
  b.classList.add('m-pop');
  cutsceneAct('gini', 'react', 700);
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
