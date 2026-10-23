'use strict';
/* ================= BATTLE UI =================
   The stage fills the screen. Glass cards float over it: the foe card at the top, the dock (your card, the message and
   the commands) at the bottom in portrait or on the right in landscape. The stage frames the billionaires in the space left over. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  JINGLES,
  battleSoundEffect,
  battleTipHide,
  battleTutor,
  battleWeatherMultiplier,
  closeModal,
  jingle,
  limbPipsHTML,
  modal,
  perkPickOpen,
  provide,
  render,
  runCatch,
  runOver,
  runReleaseSheet,
  showPendingWindows,
  statusBadgeHTML,
  storyAfterRival,
  storyAfterWin,
  toast,
  typeBadgeHTML,
} from './hooks.js';
import { $, $$, clamp, random } from './util.js';
import { COINS, ITEMS, MOVES, STAT_NAMES, TYPE_COLORS, typeEffectiveness } from './game-data.js';
import { ROBOT_LIMBS, ROBOT_SLOT_NAMES, isRobot, robotPartDef, speciesOf } from './logic/fighters.js';
import { billyName, healAll, maxHp, moveUsable, partBroken, partHpLeft, partMaxHp, plural } from './logic/rules.js';
import {
  ACTOR_SIDE,
  BATTLE_RULES,
  CATCH_RULES,
  actorTypes,
  allSnapshots,
  battleSay,
  canUse,
  catchKeep,
  catchOdds,
  catchRoll,
  effectiveStat,
  enemyOnly,
  fighter,
  isMulti,
  liveActors,
  runTurn,
  shockName,
  teamNeedsHp,
} from './logic/battle-engine.js';
import { battleSettle, battleSettleWin } from './logic/battle-rewards.js';
import { activeBattle, escapeHtml, reducedMotion, save, saveData, setActiveBattle, uiState } from './game-state.js';
import { artURL, coinHTML, iconURL, moneyHTML, uiIconHTML } from './art.js';
import { portraitHTML } from './person-art.js';
import { RIG_BACK_VIEW, bustHTML, rigPreload } from './skeleton-rig.js';
import {
  AREAS,
  actorCenter,
  actorTop,
  actorWorldPoint,
  battleStage,
  battleStageCatch,
  battleStageFocus,
  battleStagePlay,
  battleStagePrepare,
  battleStageResize,
  battleStageRingPhase,
  battleStageSelect,
  battleStageStart,
  battleStageStop,
  battleStageTargets,
  battleStageToCss,
  camAt,
} from './battle-stage.js';
import { walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { WEATHER_NAMES, currentLocationMap, environment, environmentState } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { addRipple, waterAt } from './walk/water.js';
import { battle3d, battle3dWanted } from './battle-3d.js';
/* eslint-disable no-func-assign */
expose({
  TICKER_LAST: [() => TICKER_LAST],
  afterEvents: [() => afterEvents, v => (afterEvents = v)],
  afterStageTime: [() => afterStageTime, v => (afterStageTime = v)],
  backButtonHTML: [() => backButtonHTML],
  battleFreeArea: [() => battleFreeArea, v => ((battleFreeArea = v), provide({ battleFreeArea }))],
  battleLayoutChanged: [() => battleLayoutChanged, v => ((battleLayoutChanged = v), provide({ battleLayoutChanged }))],
  battleLeave: [() => battleLeave, v => (battleLeave = v)],
  battleMode: [() => battleMode, v => (battleMode = v)],
  battleResize: [() => battleResize, v => (battleResize = v)],
  battleRise: [() => battleRise, v => (battleRise = v)],
  battleSeamless: [() => battleSeamless, v => (battleSeamless = v)],
  battleShell: [() => battleShell, v => (battleShell = v)],
  battleSwoop: [() => battleSwoop, v => (battleSwoop = v)],
  billyPickHTML: [() => billyPickHTML, v => (billyPickHTML = v)],
  bindAim: [() => bindAim, v => (bindAim = v)],
  boxAnims: [() => boxAnims, v => (boxAnims = v)],
  chooseMessage: [() => chooseMessage, v => (chooseMessage = v)],
  doThrow: [() => doThrow, v => (doThrow = v)],
  effectivenessLabel: [() => effectivenessLabel, v => (effectivenessLabel = v)],
  endBattle: [() => endBattle, v => setEndBattle(v)],
  finishThrow: [() => finishThrow, v => (finishThrow = v)],
  floatPos: [() => floatPos],
  floatTick: [() => floatTick, v => (floatTick = v)],
  hpMini: [() => hpMini, v => (hpMini = v)],
  hudHit: [() => hudHit, v => ((hudHit = v), provide({ hudHit }))],
  hudPop: [() => hudPop, v => ((hudPop = v), provide({ hudPop }))],
  itemIcon: [() => itemIcon],
  logLine: [() => logLine, v => (logLine = v)],
  moveTilesHTML: [() => moveTilesHTML, v => (moveTilesHTML = v)],
  needsPart: [() => needsPart, v => (needsPart = v)],
  needsTarget: [() => needsTarget, v => (needsTarget = v)],
  nextEvent: [() => nextEvent, v => (nextEvent = v)],
  openBattle: [() => openBattle, v => setOpenBattle(v)],
  paintActions: [() => paintActions, v => setPaintActions(v)],
  paintBoxes: [() => paintBoxes, v => (paintBoxes = v)],
  paintPlates: [() => paintPlates, v => (paintPlates = v)],
  pickMove: [() => pickMove, v => (pickMove = v)],
  pickPart: [() => pickPart, v => (pickPart = v)],
  pickTarget: [() => pickTarget, v => (pickTarget = v)],
  pickTargetOrPart: [() => pickTargetOrPart, v => (pickTargetOrPart = v)],
  planBack: [() => planBack, v => (planBack = v)],
  planNext: [() => planNext, v => (planNext = v)],
  plateElement: [() => plateElement, v => (plateElement = v)],
  platesTick: [() => platesTick, v => ((platesTick = v), provide({ platesTick }))],
  playTurnEvents: [() => playTurnEvents, v => ((playTurnEvents = v), provide({ playTurnEvents }))],
  screenWipe: [() => screenWipe, v => (screenWipe = v)],
  setEndBattle: [() => setEndBattle, v => (setEndBattle = v)],
  setOpenBattle: [() => setOpenBattle, v => (setOpenBattle = v)],
  showAim: [() => showAim, v => (showAim = v)],
  showEvent: [() => showEvent, v => (showEvent = v)],
  showSpeakerFace: [() => showSpeakerFace, v => (showSpeakerFace = v)],
  stagePlatesOn: [() => stagePlatesOn],
  stageTap: [() => stageTap, v => (stageTap = v)],
  statShortName: [() => statShortName],
  stopTimers: [() => stopTimers, v => ((stopTimers = v), provide({ stopTimers }))],
  tapMessage: [() => tapMessage, v => (tapMessage = v)],
  teamPick: [() => teamPick, v => (teamPick = v)],
  tickerUpdate: [() => tickerUpdate, v => (tickerUpdate = v)],
  turnBar: [() => turnBar, v => (turnBar = v)],
  typeText: [() => typeText, v => (typeText = v)],
});
/* eslint-enable no-func-assign */
provide({ battleFreeArea, battleLayoutChanged, hudHit, hudPop, openBattle, platesTick, playTurnEvents, stopTimers });
export function setPaintActions(v) {
  paintActions = v; // eslint-disable-line no-func-assign
  provide({ paintActions });
}
/* to-module: end */
function battleMode() {
  const w = innerWidth,
    h = innerHeight;
  return w > h * 1.05 && w >= 600 ? 'landscape' : 'portrait';
}
export function battleShell() {
  return `<div class="battle" id="battle" data-layout="${battleMode()}">
 <div class="bstage" id="stage">
  <div class="cam" id="camWorld"><canvas id="cvWorld"></canvas></div>
  <div class="cam fgcam" id="camFg"><canvas id="cvFg"></canvas></div>
  <div class="bloom" id="bloom"></div><div class="vign"></div><div class="lowhp" id="lowhp"></div><div class="flash" id="flash"></div>
  <div class="pops" id="pops" aria-hidden="true"></div>
  <div class="bplates" id="plates"></div>
 </div>
 <div class="ticker" aria-hidden="true"><div class="tk-in" id="tk"></div></div>
 <div class="mk glassy" id="mk"></div>
 <div class="dock glassy" id="dock">
  <button class="bmsg" id="msg" data-a="adv" aria-live="polite"><span id="msgT"></span><i class="more"></i></button>
  <div class="cmd" id="acts"></div>
 </div>
</div>`;
}
/* the part of the screen the HUD leaves open; the stage frames the action inside it */
function battleFreeArea(vw, vh, lay) {
  const b = $('#battle').getBoundingClientRect(),
    r = s => {
      const e = $(s);
      return e ? e.getBoundingClientRect() : null;
    },
    dock = r('#dock'),
    foe = r('#hb1'),
    tk = r('.ticker');
  /* phase 06-3: with the cards floating in the scene the dock has no fixed place, so the action is framed in a fixed
     share of the screen (above the cards in portrait, left of them in landscape) */
  const floating = $('#battle').classList.contains('ui3d');
  if (lay === 'landscape') {
    const y0 = (tk ? tk.bottom - b.top : 0) + 4,
      x1 = (floating ? vw * 0.62 : dock ? dock.left - b.left : vw) - 8;
    return { x: 0, y: y0, w: Math.max(160, x1), h: Math.max(120, vh - 8 - y0) };
  }
  const y0 = (foe ? foe.bottom - b.top : 64) + 2,
    y1 = (floating ? vh * 0.6 : dock ? dock.top - b.top : vh * 0.62) - 4;
  return { x: 0, y: y0, w: vw, h: Math.max(120, y1 - y0) };
}
function battleLayoutChanged(L) {
  const bl = $('#bloom');
  if (bl) {
    const s = 70 * L.u;
    bl.style.width = bl.style.height = s + 'px';
    bl.style.left = L.fx + 162 * L.u - s / 2 + 'px';
    bl.style.top = L.fy + 34 * L.u - s / 2 + 'px';
    bl.hidden = !!AREAS[battleStage.area].indoor;
  }
}
export function battleResize() {
  const el = $('#battle');
  if (!el) return;
  const m = battleMode();
  if (el.dataset.layout !== m) el.dataset.layout = m;
  requestAnimationFrame(() => {
    battleStageResize();
    if (activeBattle && activeBattle.phase !== 'playing') paintActions();
  });
}
export function openBattle() {
  const bs = (saveData.preferences || {}).battleSpeed;
  if (bs && !uiState.dbgSpeed) battleStage.speed = bs === 'fast' ? 1.6 : bs === 'faster' ? 2.2 : 1;
  const area = activeBattle.area || 'grass',
    list = saveData.team
      .map(m => [m.sp, RIG_BACK_VIEW, m.coat])
      .concat(activeBattle.sides[1].team.map(m => [m.sp, 1, m.coat]));
  const b = activeBattle;
  Promise.all([battleStagePrepare(area), rigPreload(list)])
    .then(() => {
      if (activeBattle !== b) return;
      const seam = battleSeamless();
      const go = () => {
        if (activeBattle !== b) return;
        /* the battle was closed during the wipe */ document.body.classList.add('in-battle');
        render();
        battleStageStart(area);
        playTurnEvents();
        if (seam) battleRise();
      };
      if (seam) battleSwoop(go);
      else screenWipe(go);
    })
    .catch(e => {
      console.error(e);
      toast(e.message);
    });
}
/* phase 04d: battle-weather.js adds the weather around it */
export function setOpenBattle(v) {
  openBattle = v; // eslint-disable-line no-func-assign
  provide({ openBattle });
}
/* v31: on the 3D stage a battle starts where you are, without a wipe: the camera swoops down toward the spot, the
   billionaire bursts out of the grass in a spray of leaves, then the battle's panels slide up over the same picture.
   When it's over they slide away and the camera pulls back out. */
function battleSeamless() {
  return (
    !reducedMotion &&
    typeof battle3dWanted === 'function' &&
    battle3dWanted() &&
    uiState.tab === 'walk' &&
    !uiState.inside &&
    !uiState.bench
  );
}
function battleSwoop(go) {
  const P = walkView.pl,
    e = uiState.encAt;
  uiState.encAt = null;
  const fx = e ? P.x * 0.6 + e[0] * 0.4 : P.x,
    fz = e ? P.z * 0.6 + e[1] * 0.4 : P.z;
  /* CAM-2: the swoop is a camera goal (walk/camera.js) that frames you and the spot and zooms in; your own zoom
     (zoomT) stays as it is */
  walkRenderer.swoop = {
    x: fx,
    z: fz,
    px: P.x,
    pz: P.z,
    ex: e ? e[0] : P.x,
    ez: e ? e[1] : P.z,
    zoom: engineSetting('camera', 'encZoom'),
    arrived: false,
  };
  P.route = null;
  P.walk = 0;
  if (e) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * 6.283,
        sp = 0.8 + Math.random() * 2.2;
      walkView.parts.push({
        k: i % 4 ? 'leaf' : 'dust',
        fr: i % 3,
        x: e[0] + (Math.random() - 0.5) * 0.3,
        z: e[1] + (Math.random() - 0.5) * 0.2,
        y: 0.15,
        vx: Math.cos(a) * sp,
        vz: Math.sin(a) * sp * 0.6,
        vy: 2.2 + Math.random() * 2.6,
        g: 7.5,
        life: 0,
        max: 0.8 + Math.random() * 0.5,
      });
    }
    if (typeof addRipple === 'function' && typeof waterAt === 'function' && waterAt(e[0], e[1]))
      addRipple(e[0], e[1], 1);
  }
  /* CAM-2: the battle comes up once the camera has arrived (walk/camera.js sets `arrived`), not before Engine >
     Camera > Encounter shot: shortest, and no later than its longest */
  const t0 = performance.now(),
    S = walkRenderer.swoop,
    cam = k => engineSetting('camera', k),
    wait = () => {
      const t = performance.now() - t0;
      if (walkRenderer.swoop === S && !((S.arrived && t >= cam('encMin')) || t >= cam('encMax')))
        return void setTimeout(wait, 30);
      if (walkRenderer.swoop === S) walkRenderer.swoop = null;
      go();
    };
  setTimeout(wait, 30);
}
function battleRise() {
  const el = $('#battle');
  if (!el) return;
  el.classList.add('bt-rise');
  setTimeout(() => el.classList.remove('bt-rise'), 900);
}
function battleLeave(mid) {
  const el = $('#battle'),
    seam = !reducedMotion && typeof battle3d !== 'undefined' && battle3d.on && el;
  if (!seam) return screenWipe(mid);
  el.classList.add('bt-leave');
  setTimeout(() => {
    mid();
    /* CAM-2: the camera pulls back out as a goal (walk/camera.js `leave`), not by changing the zoom */
    if (typeof walkRenderer !== 'undefined') walkRenderer.leaveAt = walkView.t;
  }, 360);
}
function screenWipe(mid) {
  const w = $('#wipe');
  if (reducedMotion || !w) {
    mid();
    return;
  }
  w.className = 'wipe in';
  setTimeout(() => {
    mid();
    w.className = 'wipe out';
    setTimeout(() => {
      w.className = 'wipe';
    }, 460);
  }, 520);
}
export function stopTimers() {
  clearTimeout(uiState.evT);
  clearTimeout(uiState.hpT);
  clearInterval(uiState.typeT);
}
function typeText(t) {
  const el = $('#msgT');
  clearInterval(uiState.typeT);
  if (!el) return 0;
  if (reducedMotion) {
    el.textContent = t;
    uiState.typing = false;
    return 0;
  }
  el.textContent = '';
  let i = 0;
  uiState.typing = true;
  const sp = Math.max(1, Math.round(2 * battleStage.speed));
  uiState.typeT = setInterval(() => {
    i += sp;
    el.textContent = t.slice(0, i);
    if (i >= t.length) {
      clearInterval(uiState.typeT);
      uiState.typing = false;
    }
  }, 16);
  uiState.typeFull = t;
  return Math.ceil(t.length / sp) * 16;
}
export function playTurnEvents() {
  if (!activeBattle) return;
  activeBattle.phase = 'playing';
  activeBattle.ev = 0;
  paintActions();
  showEvent();
}
/* while a turn plays out, the command area shows the turn so far, so nothing is missed */
function logLine(i) {
  const el = $('#acts');
  if (!el || activeBattle.phase !== 'playing') return;
  let L = el.querySelector('.blog');
  if (!L) {
    el.innerHTML = '<ol class="blog" aria-hidden="true"></ol>';
    L = el.querySelector('.blog');
  }
  const prev = activeBattle.events
    .slice(Math.max(0, i - 4), i)
    .map(e => `<li>${escapeHtml(e.t)}</li>`)
    .join('');
  L.innerHTML =
    prev +
    (i < activeBattle.events.length - 1
      ? `<li class="next">${plural(activeBattle.events.length - 1 - i, 'more line')} this turn · tap to skip ahead</li>`
      : '');
}
function showEvent() {
  stopTimers();
  if (!activeBattle || !$('#msg')) return;
  if (activeBattle.ev >= activeBattle.events.length) return afterEvents();
  const ev = activeBattle.events[activeBattle.ev];
  logLine(activeBattle.ev);
  showSpeakerFace(ev.face);
  const tt = ev.t ? typeText(ev.t) : 0,
    r = ev.an ? battleStagePlay(ev.an, ev) : { dur: 0, hit: 0 };
  if (ev.an && typeof battleSoundEffect === 'function') battleSoundEffect(ev.an, r, ev);
  boxAnims(ev);
  const k = 1 / battleStage.speed;
  afterStageTime('hpT', r.hit >= 999 ? 0 : r.hit, 0, () => paintBoxes(ev.s, ev.mk, true));
  $('#msg').classList.remove('ready');
  uiState.evReady = false;
  /* the next line waits for the animation on the scene's own clock (a slow device draws fewer frames, so it takes
    longer in real time) as well as for the text to finish typing */
  afterStageTime('evT', r.dur + 120, tt + 120 * k, () => {
    uiState.evReady = true;
    $('#msg') && $('#msg').classList.add('ready');
    uiState.evT = setTimeout(nextEvent, (reducedMotion ? 1300 : 820) * k);
  });
}
function afterStageTime(slot, sceneMs, realMs, fn) {
  const t0 = battleStage.t,
    r0 = performance.now();
  const tick = () => {
    if (!activeBattle) return;
    const el = performance.now() - r0,
      sOk =
        !battleStage.on ||
        battleStage.t - t0 >= sceneMs ||
        el > (sceneMs / battleStage.speed) * 3 + 1500 /* never stuck on a very slow device */,
      rOk = el >= realMs;
    if (sOk && rOk) {
      fn();
      return;
    }
    uiState[slot] = setTimeout(tick, 30);
  };
  uiState[slot] = setTimeout(tick, Math.max(0, Math.min(realMs, sceneMs / battleStage.speed)));
}
function nextEvent() {
  if (!activeBattle || activeBattle.phase !== 'playing') return;
  activeBattle.ev++;
  showEvent();
}
/* who is talking: a portrait at the start of the message box */
function showSpeakerFace(f) {
  const m = $('#msg');
  if (!m) return;
  let el = m.querySelector('.msg-face');
  if (!f) {
    if (el) el.remove();
    m.classList.remove('has-face');
    return;
  }
  if (!el) {
    el = document.createElement('span');
    el.className = 'msg-face';
    m.prepend(el);
  }
  el.innerHTML = portraitHTML(f.who, 46, f.expr);
  m.classList.add('has-face');
}
export function tapMessage() {
  if (!activeBattle || activeBattle.phase !== 'playing' || !$('#msg')) return;
  if (uiState.typing) {
    clearInterval(uiState.typeT);
    uiState.typing = false;
    $('#msgT').textContent = uiState.typeFull || '';
    return;
  }
  if (uiState.evReady) nextEvent();
}
/* phase 06-4: the corner cards are gone (the plates in the scene show everything); a Billie coming in repaints them */
function boxAnims(ev) {
  const an = ev.an;
  if (!an) return;
  if (an.k === 'wild' || an.k === 'enter')
    setTimeout(() => paintBoxes(ev.s, ev.mk, false), an.k === 'wild' ? 620 : 420);
}
const statShortName = k => (STAT_NAMES[k] || k).slice(0, 3).toUpperCase();
export function paintBoxes(s, mk, anim) {
  paintPlates(s, anim);
  tickerUpdate(s, mk);
  const m = $('#mk');
  if (m) {
    m.innerHTML = mk ? `${uiIconHTML('bolt', 14)} ${escapeHtml(shockName())} · ${plural(mk.n, 'turn')}` : '';
    m.classList.toggle('on', !!mk);
  }
}
const TICKER_LAST = {};
function tickerUpdate(s, mk) {
  const el = $('#tk');
  if (!el) return;
  const items = [];
  [1, 3, 0, 2, 4].forEach(i => {
    const x = s[i];
    if (!x) return;
    const p = Math.round((Math.max(0, x.hp) / x.max) * 100),
      k = x.uid,
      prev = TICKER_LAST[k],
      d = prev == null ? 0 : p - prev;
    TICKER_LAST[k] = p;
    items.push(
      `<span class="tki"><b>${escapeHtml(x.name.toUpperCase())}</b> Lv ${x.lvl} <em class="${d < 0 ? 'dn' : d > 0 ? 'up' : ''}">HP ${p}%</em></span>`
    );
  });
  if (mk)
    items.push(
      `<span class="tki warn"><b>${escapeHtml(shockName().toUpperCase())}</b> ${plural(mk.n, 'turn')} left</span>`
    );
  const sunTxt = (() => {
    if (typeof environmentState !== 'function' || !environment.on) return 'noon, steady';
    const st = environmentState(currentLocationMap());
    return (
      (st.night > 0.5
        ? 'night, dim'
        : st.dusk > 0.35
          ? 'dusk, glowing'
          : st.dawn > 0.35
            ? 'dawn, rising'
            : st.h < 11
              ? 'morning, climbing'
              : st.h < 15
                ? 'noon, steady'
                : 'afternoon, mellow') +
      (st.wx !== 'clear' ? ` · <b>WEATHER</b> ${(WEATHER_NAMES[st.wx] || st.wx).toLowerCase()}` : '')
    );
  })();
  items.push(
    `<span class="tki"><b>INNER SUN</b> ${sunTxt}</span>`,
    `<span class="tki"><b>MONEYS</b> ${moneyHTML(saveData.se, 12)}</span>`
  );
  const h = items.join('<i>•</i>');
  el.innerHTML = h + '<i>•</i>' + h + '<i>•</i>';
}
/* floating numbers and tags over the billionaires */
function hudPop(si, text, kind) {
  const L = $('#pops');
  if (!L || !battleStage.L || (reducedMotion && kind === 'tag')) return;
  const q = battleStageToCss(actorTop(si));
  if (!q) return;
  const e = document.createElement('div');
  e.className = 'pop ' + kind;
  e.textContent = text;
  e.style.left = clamp(q.x, 40, battleStage.L.vw - 40) + 'px';
  e.style.top = Math.max(30, q.y) + 'px';
  e.style.setProperty('--dx', ((random() - 0.5) * 36).toFixed(0) + 'px');
  L.appendChild(e);
  setTimeout(() => e.remove(), 1500);
}
function hudHit(ti, an) {
  if (!an.dmg) return;
  hudPop(ti, '−' + an.dmg, 'dmg' + (an.te > 1 ? ' se' : '') + (an.crit ? ' crit' : '') + (an.te < 1 ? ' nve' : ''));
  if (an.crit) setTimeout(() => hudPop(ti, 'Critical hit', 'tag crit'), 90);
  else if (an.te > 1) setTimeout(() => hudPop(ti, 'Super effective', 'tag se'), 90);
  else if (an.te < 1) setTimeout(() => hudPop(ti, 'Not very effective', 'tag nve'), 90);
}
function afterEvents() {
  if (!activeBattle) return;
  const msg = $('#msg');
  if (msg) msg.classList.remove('ready');
  if (activeBattle.over) {
    activeBattle.phase = 'end';
    paintActions();
    return;
  }
  if (activeBattle.needSwitch && activeBattle.needSwitch.length) {
    activeBattle.phase = 'switch';
    activeBattle.cur = activeBattle.needSwitch[0];
    $('#msgT').textContent = isMulti() ? 'Choose who takes the fallen one’s place.' : 'Choose who goes in next.';
    paintActions();
    return;
  }
  activeBattle.plan = [];
  activeBattle.cur = liveActors(0)[0];
  activeBattle.phase = 'choose';
  activeBattle.menuT = performance.now(); /* phase 06-2b: for the "instant picks" comment (opening-fall.js) */
  chooseMessage();
  paintBoxes(allSnapshots(), activeBattle.market);
  paintActions();
  if (activeBattle.T && activeBattle.T.tutorial && typeof battleTutor === 'function')
    battleTutor(); /* v47: the professor's tips in Blake's first battle */
}
/* v33: with two or three of yours out, each picks in turn; the one choosing stands in a ring */
export function chooseMessage() {
  const m = fighter(activeBattle.cur);
  if (!m) return;
  const L = liveActors(0),
    n = L.indexOf(activeBattle.cur);
  $('#msgT').textContent =
    L.length > 1 ? `What will ${billyName(m)} do? (${n + 1} of ${L.length})` : `What will ${billyName(m)} do?`;
  if (typeof battleStageSelect === 'function') battleStageSelect(activeBattle.cur);
}
export function planNext(p) {
  activeBattle.plan.push(p);
  const L = liveActors(0).filter(k => !activeBattle.plan.some(q => q.who === k));
  if (L.length && !activeBattle.plan.some(q => q.k === 'run')) {
    activeBattle.cur = L[0];
    activeBattle.phase = 'choose';
    chooseMessage();
    paintActions();
    return;
  }
  if (typeof battleStageSelect === 'function') battleStageSelect(null);
  runTurn(activeBattle.plan);
}
export function planBack() {
  const p = activeBattle.plan.pop();
  if (!p) return false;
  activeBattle.cur = p.who;
  activeBattle.phase = 'choose';
  chooseMessage();
  paintActions();
  return true;
}
/* does this move need a target picked? (one aimed at a foe while more than one foe stands) */
function needsTarget(mid) {
  const M = MOVES[mid],
    fx = M.fx || {};
  const onFoe = M.c !== 'X' || fx.status || fx.tgtStage || fx.hype || fx.spin || fx.wipe;
  return onFoe && !fx.spread && liveActors(1).length > 1;
}
export function pickMove(mid) {
  if (!moveUsable(fighter(activeBattle.cur), mid)) return;
  if (needsTarget(mid)) {
    activeBattle.mv = mid;
    activeBattle.phase = 'target';
    $('#msgT').textContent = `${MOVES[mid].n}: which one? Tap it.`;
    paintActions();
    if (typeof battleStageTargets === 'function') battleStageTargets(liveActors(1));
    return;
  }
  pickTargetOrPart(mid, liveActors(1)[0]);
}
export function pickTarget(tk) {
  if (!activeBattle || activeBattle.phase !== 'target') return;
  if (typeof battleStageTargets === 'function') battleStageTargets(null);
  pickTargetOrPart(activeBattle.mv, tk);
}
/* phase 17: an aimed move at a robot asks which part next; anything else is planned now */
function pickTargetOrPart(mid, tk) {
  if (needsPart(mid, tk)) {
    activeBattle.mv = mid;
    activeBattle.tk = tk;
    activeBattle.phase = 'part';
    $('#msgT').textContent = `${MOVES[mid].n}: aim at which part of ${billyName(fighter(tk))}?`;
    paintActions();
    return;
  }
  planNext({ who: activeBattle.cur, k: 'move', mid, tk });
}
export function pickPart(part) {
  if (!activeBattle || activeBattle.phase !== 'part') return;
  planNext({ who: activeBattle.cur, k: 'move', mid: activeBattle.mv, tk: activeBattle.tk, part });
}
function effectivenessLabel(mid, tk) {
  const M = MOVES[mid];
  if (!M.p && !(M.fx && M.fx.vary)) return '';
  const F = tk != null ? [tk] : liveActors(1);
  if (!F.length) return '';
  if (F.length === 1) {
    const e = typeEffectiveness(M.t, actorTypes(F[0]));
    return e > 1 ? '<em class="se">Super effective</em>' : e < 1 ? '<em class="nve">Not very effective</em>' : '';
  }
  const se = F.filter(k => typeEffectiveness(M.t, actorTypes(k)) > 1).map(k => billyName(fighter(k))),
    nv = F.filter(k => typeEffectiveness(M.t, actorTypes(k)) < 1).map(k => billyName(fighter(k)));
  return se.length
    ? `<em class="se">Super effective on ${escapeHtml(se.join(', '))}</em>`
    : nv.length === F.length
      ? '<em class="nve">Not very effective</em>'
      : '';
}
/* phase 17: does this move ask which robot part to go for? (an aimed move at a robot with a limb still standing) */
function needsPart(mid, tk) {
  const M = MOVES[mid],
    t = fighter(tk);
  return !!(M.fx && M.fx.aim && t && isRobot(t) && ROBOT_LIMBS.some(q => !partBroken(t, q)));
}
function hpMini(m) {
  const p = Math.max(0, m.hp / maxHp(m));
  return `<span class="hpmini"><i class="${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}" style="width:${p * 100}%"></i></span>`;
}
function billyPickHTML(m, act, attrs, dis, note) {
  return `<button class="pick" ${attrs} ${dis ? 'disabled' : ''}>${bustHTML(m.sp, 40, { coat: m.coat })}<span class="pk-t"><b>${escapeHtml(billyName(m))}</b><span class="pk-m">${speciesOf(m).types.map(typeBadgeHTML).join('')}<small class="tnum">Lv ${m.lvl}</small></span>${hpMini(m)}<small class="tnum">${Math.max(0, m.hp)}/${maxHp(m)}</small></span><span class="pk-s">${note || ''}</span></button>`;
}
function teamPick(back) {
  const on = activeBattle.sides[0].f.filter(f => f.on).map(f => f.act),
    called = (activeBattle.plan || []).filter(p => p.k === 'switch').map(p => p.i);
  return `<div class="plist">${saveData.team
    .map((m, i) => {
      const act = (on.includes(i) && m.hp > 0) || called.includes(i);
      const dis = act || m.hp <= 0;
      return billyPickHTML(
        m,
        act,
        `data-a="bswitch" data-i="${i}"`,
        dis,
        act ? (called.includes(i) ? 'Coming in' : 'In battle') : m.hp <= 0 ? 'Fainted' : statusBadgeHTML(m.status)
      );
    })
    .join('')}</div>${back ? backButtonHTML() : ''}`;
}
const backButtonHTML = () =>
  `<button class="bt back wide" data-a="bback">${uiIconHTML('back', 16)}<b>Back</b><kbd>Esc</kbd></button>`;
export const itemIcon = (k, size = 30) => {
  const I = ITEMS[k] || {};
  return I.img
    ? `<img class="pxi" src="${artURL(I.img)}" width="${size}" height="${size}" alt="">`
    : `<img class="pxi" src="${iconURL('i_' + (I.icon || k))}" width="${size}" height="${size}" alt="">`;
};
/* phase 06-3: the move tiles, shown on the first menu (no Fight button first) and after Back from aiming */
function moveTilesHTML(m) {
  return `<div class="moves">${m.moves
    .map((id, n) => {
      const M = MOVES[id],
        c = TYPE_COLORS[M.t],
        P = M.p ? M.p : M.fx && M.fx.vary ? 'Varies' : 'Status',
        stab = M.t !== 'None' && actorTypes(activeBattle.cur).includes(M.t),
        /* phase 17: a robot can't use the move of a broken part */
        off = !moveUsable(m, id);
      if (off)
        return `<button class="mv off" style="--tc:${c[0]};--tf:${c[1]}" disabled data-tip="${escapeHtml(M.d)}"><span class="mv-top"><b>${escapeHtml(M.n)}</b><kbd>${n + 1}</kbd></span><span class="mv-meta"><span class="mv-ty">Part broken</span></span></button>`;
      return `<button class="mv" style="--tc:${c[0]};--tf:${c[1]}" data-a="bmove" data-m="${id}" data-tip="${escapeHtml(M.d)}"><span class="mv-top"><b>${escapeHtml(M.n)}</b><kbd>${n + 1}</kbd></span><span class="mv-meta"><span class="mv-ty">${M.t === 'None' ? 'Normal' : M.t}${stab ? ' ★' : ''}</span><span class="tnum">${P}${M.p ? ' pow' : ''}${M.p && typeof battleWeatherMultiplier === 'function' ? (battleWeatherMultiplier(M.t) > 1 ? ' ▲' : battleWeatherMultiplier(M.t) < 1 ? ' ▼' : '') : ''}${M.c !== 'X' || M.a < 100 ? ` · ${M.a || 100}%` : ''}</span></span>${effectivenessLabel(id)}</button>`;
    })
    .join('')}</div>`;
}
export function paintActions() {
  const el = $('#acts');
  if (!el || !activeBattle) return;
  const ph = activeBattle.phase,
    wild = activeBattle.kind === 'wild';
  let h = '';
  el.dataset.ph = ph;
  if (ph === 'choose') {
    const m = fighter(activeBattle.cur),
      first = !activeBattle.plan.length,
      coins = Object.keys(COINS).reduce((a, k) => a + (saveData.coins[k] || 0), 0),
      items = Object.keys(ITEMS)
        .filter(k => saveData.items[k] > 0 && !ITEMS[k].evoItem)
        .reduce((a, k) => a + saveData.items[k], 0),
      crew = saveData.team,
      alive = crew.filter(x => x.hp > 0).length;
    h = `<div class="c-choose">${moveTilesHTML(m)}
  <div class="bt-row"><button class="bt coin" data-a="bcoins" ${wild && first ? '' : 'disabled'}>${uiIconHTML('pyramid', 18)}<b>Catch it</b><small>${wild ? (first ? coins + ' left' : 'First pick only') : 'Wild only'}</small><kbd>X</kbd></button>
  <button class="bt items" data-a="bitems">${uiIconHTML('bag', 18)}<b>Bag</b><small>${items}</small><kbd>I</kbd></button>
  <button class="bt team" data-a="bteam">${uiIconHTML('team', 18)}<b>Team</b><small>${alive}/${crew.length}</small><kbd>T</kbd></button>
  <button class="bt run" data-a="brun" ${wild ? '' : 'disabled'}>${uiIconHTML('run', 18)}<b>Run</b><small>${wild ? 'Walk away' : 'No exit'}</small><kbd>R</kbd></button></div>${first ? '' : `<button class="bt back wide" data-a="bback">${uiIconHTML('back', 16)}<b>Back to ${escapeHtml(billyName(fighter(activeBattle.plan[activeBattle.plan.length - 1].who)))}</b><kbd>Esc</kbd></button>`}</div>`;
  } else if (ph === 'part') {
    const t = fighter(activeBattle.tk);
    h = `<div class="plist">${ROBOT_LIMBS.map(q => {
      const left = partHpLeft(t, q),
        mx = partMaxHp(t, q),
        P = t.fit && robotPartDef(t.fit[q].id);
      return `<button class="pick part-pick" data-a="bpart" data-p="${q}" ${left <= 0 ? 'disabled' : ''}><span class="pk-t"><b>${escapeHtml(ROBOT_SLOT_NAMES[q][0].toUpperCase() + ROBOT_SLOT_NAMES[q].slice(1))}</b><small>${escapeHtml(P ? P.name : '')}${P && P.move && MOVES[P.move] ? ` · gives ${escapeHtml(MOVES[P.move].n)}` : ''}</small><span class="hpmini"><i class="${left / mx < 0.34 ? 'low' : ''}" style="width:${(left / mx) * 100}%"></i></span></span><span class="pk-s tnum">${left <= 0 ? 'Broken' : `${left}/${mx}`}</span></button>`;
    }).join('')}</div>${backButtonHTML()}`;
  } else if (ph === 'fight') {
    h = `${moveTilesHTML(fighter(activeBattle.cur))}${backButtonHTML()}`;
  } else if (ph === 'target') {
    const mid = activeBattle.mv;
    h = `<div class="plist">${liveActors(1)
      .map(k => {
        const m = fighter(k);
        return billyPickHTML(
          m,
          false,
          `data-a="btarget" data-t="${k}"`,
          false,
          effectivenessLabel(mid, k) || (m.boss ? '<em class="alpha">Alpha</em>' : '')
        );
      })
      .join('')}</div>${backButtonHTML()}`;
  } else if (ph === 'coins') {
    h = `<div class="coins">${Object.keys(COINS)
      .map((k, n) => {
        const c = COINS[k],
          have = saveData.coins[k] || 0,
          odds = Math.round(catchOdds(k, 1 + CATCH_RULES.ring * 0.5, false) * 100);
        return `<button class="ccard" data-a="bcoin" data-c="${k}" ${have ? '' : 'disabled'}>${coinHTML(k, 34)}<span class="cc-t"><b>${escapeHtml(c.n)}</b><small class="tnum">${c.m === 0 ? 'Guaranteed' : `~${odds}% catch`} · ${have} left</small></span><span class="cc-bar"><i style="width:${c.m === 0 ? 100 : clamp(odds, 2, 100)}%"></i></span></button>`;
      })
      .join('')}</div>${backButtonHTML()}`;
  } else if (ph === 'items') {
    const its = Object.keys(ITEMS).filter(k => saveData.items[k] > 0 && !ITEMS[k].evoItem);
    h = `<div class="plist">${
      its.length
        ? its
            .map(k => {
              const I = ITEMS[k],
                ok = I.hpAll ? teamNeedsHp() : saveData.team.some(m => canUse(k, m));
              return `<button class="pick" data-a="bitem" data-it="${k}" ${ok ? '' : 'disabled'}>${itemIcon(k, 32)}<span class="pk-t"><b>${escapeHtml(I.n)}</b><small>${escapeHtml(I.d)}</small></span><span class="pk-s tnum">×${saveData.items[k]}</span></button>`;
            })
            .join('')
        : '<p class="note">No items. Buy some at a town shop.</p>'
    }</div>${backButtonHTML()}`;
  } else if (ph === 'itemTarget') {
    const it = activeBattle.item;
    h = `<p class="note">Use ${escapeHtml(ITEMS[it].n)} on:</p><div class="plist">${saveData.team.map(m => billyPickHTML(m, false, `data-a="bitemon" data-u="${m.uid}"`, !canUse(it, m), m.hp <= 0 ? 'Fainted' : statusBadgeHTML(m.status))).join('')}</div>${backButtonHTML()}`;
  } else if (ph === 'team') h = teamPick(true);
  else if (ph === 'switch') h = teamPick(false);
  else if (ph === 'aim') {
    h = `<div class="aim"><div class="aimcoin" id="aimCoin" role="button" tabindex="0" aria-label="Swipe up to throw">${coinHTML(activeBattle.coin, 96, 32)}<span class="aim-hint">${uiIconHTML('back', 14)}</span></div><p class="note">Swipe the pyramid up when the ring is small and green. A sideways swipe adds spin.</p><div class="two"><button class="bt coin" data-a="bthrow"><b>Throw it</b><kbd>Space</kbd></button><button class="bt back" data-a="baimback"><b>Put it away</b><kbd>Esc</kbd></button></div></div>`;
  } else if (ph === 'throwing') h = `<div class="aim"><p class="note">The pyramid is in the air…</p></div>`;
  else if (ph === 'end') {
    const t = {
      win: 'You won.',
      lose: 'Your team fainted.',
      caught: 'Caught!',
      ran: 'You walked away.',
      draw: 'A draw.',
    }[activeBattle.over];
    h = `<button class="bt end wide" data-a="bend"><b>${t} Continue</b><kbd>Enter</kbd></button>`;
  }
  el.innerHTML = h;
  el.classList.remove('swap');
  void el.offsetWidth;
  el.classList.add('swap');
  if (ph === 'aim') bindAim();
  if (ph === 'fight')
    $$('.mv', el).forEach(b => {
      const tip = () => {
        if (activeBattle && activeBattle.phase === 'fight') $('#msgT').textContent = b.dataset.tip;
      };
      b.addEventListener('pointerenter', tip);
      b.addEventListener('focus', tip);
    });
}
function bindAim() {
  const c = $('#aimCoin');
  if (!c) return;
  let sx = 0,
    sy = 0,
    on = false;
  c.addEventListener('pointerdown', ev => {
    if (uiState.throwing) return;
    on = true;
    sx = ev.clientX;
    sy = ev.clientY;
    c.setPointerCapture(ev.pointerId);
    c.classList.add('held');
  });
  c.addEventListener('pointermove', ev => {
    if (!on) return;
    c.style.transform = `translate(${(ev.clientX - sx) * 0.4}px,${Math.min(0, ev.clientY - sy) * 0.5}px) rotate(${(ev.clientX - sx) * 0.2}deg)`;
  });
  c.addEventListener('pointerup', ev => {
    if (!on) return;
    on = false;
    c.classList.remove('held');
    const dy = sy - ev.clientY,
      dx = ev.clientX - sx;
    c.style.transform = '';
    if (dy > 40) doThrow(Math.abs(dx) > 30);
  });
  c.addEventListener('pointercancel', () => {
    on = false;
    c.style.transform = '';
    c.classList.remove('held');
  });
}
export function showAim() {
  battleStage.ring = { t0: battleStage.t };
  camAt(1, 0.45, 0.16, 0.015, 320);
  battleStageFocus('foe');
  $('#msgT').textContent = 'Line up your throw.';
}
export function doThrow(spin) {
  if (uiState.throwing || !activeBattle || activeBattle.phase !== 'aim') return;
  uiState.throwing = true;
  const ph = battleStageRingPhase(),
    T = 1 + CATCH_RULES.ring * ph,
    id = activeBattle.coin;
  saveData.coins[id]--;
  save();
  battleStage.ring = null;
  const res = catchRoll(id, T, spin),
    lab = ph >= 0.83 ? 'Excellent throw!' : ph >= 0.5 ? 'Great throw!' : ph >= 0.17 ? 'Nice throw.' : '';
  activeBattle.phase = 'throwing';
  paintActions();
  $('#msgT').textContent = [`You threw a ${COINS[id].n}.`, lab, spin ? 'Spin bonus!' : ''].filter(Boolean).join(' ');
  battleStageCatch(id, res, spin, caught => finishThrow(res, id, lab, spin));
}
function finishThrow(res, id, lab, spin) {
  uiState.throwing = false;
  if (!activeBattle) return;
  const e = fighter(1);
  activeBattle.events = [];
  if (res.edge) battleSay('It landed on its point. Critical catch!');
  if (res.caught) {
    battleSay(`Gotcha! ${billyName(e)} was caught.`, { k: 'caught' });
    /* logic/battle-engine.js catchKeep: an Alpha stays one, at least 1 HP, addBilly; the battle is over */
    const { where, alpha } = catchKeep(e);
    if (alpha) battleSay(`${billyName(e)} is an Alpha: a little bigger and stronger than others of its kind.`);
    if (where === 'box') battleSay(`${billyName(e)} went to storage. Your team is full.`);
    /* RL-8: a run's party is full: after the battle, one of the seven leaves the party (run.js) */
    if (where === 'full') {
      runCatch.m = e;
      battleSay(`Your party is full. After the battle, pick who leaves it.`);
    }
    save();
    return playTurnEvents();
  }
  battleSay(['It broke free right away.', 'It almost stayed in.', 'So close. It wobbled twice.'][res.w]);
  enemyOnly();
  playTurnEvents();
}
export function endBattle() {
  stopTimers();
  const kind = activeBattle.kind,
    T = activeBattle.T,
    tid = activeBattle.tid,
    /* RL-8: what it pays and costs (logic/battle-rewards.js); RL-4: a battle called off at the turn cap ends as if you
       walked away (wild) or lost (a trainer). Studio plan T3.2: battleSettle also does what it does to the save (a
       run battle's checkpoint, the Hype counter, the encounter, the lead's streak), as the run's simulation does */
    { pay, run } = battleSettle(activeBattle, saveData),
    o = pay.o;
  if (o === 'win' && typeof jingle === 'function') jingle(JINGLES.victory);
  if (typeof battleTipHide === 'function') battleTipHide();
  /* v47: Blake's first battle, in the opening: no fee and no sheet, win or lose; the story picks it up (story.js) */
  if (T && T.tutorial) {
    if (o === 'win') saveData.flags[tid] = 1;
    if (o === 'lose') for (const m of saveData.team) m.hp = Math.max(1, m.hp);
    save();
    battleLeave(() => {
      setActiveBattle(null);
      battleStageStop();
      document.body.classList.remove('in-battle');
      uiState.tab = 'walk';
      render();
      if (typeof storyAfterRival === 'function') storyAfterRival(o, T);
      else {
        healAll();
        showPendingWindows();
      }
    });
    return;
  }
  const after = [];
  /* RL-8: on a run, a loss ends the run (its payout, after the battle) */
  if (o === 'lose' && !run) {
    const fee = pay.fee;
    saveData.se -= fee;
    healAll();
    after.push({
      title: 'Your team fainted',
      html: `<p>You hurried back to the clinic.</p><p>You paid ${moneyHTML(fee)} for treatment, and the team is back at full HP.</p>${T ? `<p class="note">${escapeHtml(T.name)}: ${escapeHtml(T.lose || '')}</p>` : ''}`,
      btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
    });
  }
  /* phase 08: beating a wild Billie pays prize money (steps paid before); a trainer its reward and its flag, and RL-12:
     a run's mini-boss a pick of Perks, saved on the run before it shows (logic/battle-rewards.js battleSettleWin) */
  battleSettleWin(activeBattle, saveData, pay, run);
  if (kind === 'wild' && o === 'win' && pay.prize > 0) toast(`You earned ${plural(pay.prize, 'Money')}.`);
  if (kind === 'trainer' && o === 'win') {
    const first = pay.first;
    let extra = '';
    const st = T.seat;
    if (st && pay.seat) {
      const nu = pay.seat.nu;
      if (nu) {
        saveData.seats.push(pay.seat.id);
        for (const k in pay.seat.coins) saveData.coins[k] = (saveData.coins[k] || 0) + pay.seat.coins[k];
        for (const k in pay.seat.items) saveData.items[k] = (saveData.items[k] || 0) + pay.seat.items[k];
      }
      after.push({
        title: nu ? escapeHtml(st.title || 'Badge') : 'Rematch won',
        top: `<div class="sheet-art">${coinHTML(st.coin || 'penny', 96, 32)}</div>`,
        html: `<p>${escapeHtml(T.win || '')}</p><p>You earned ${moneyHTML(pay.reward)}${nu && st.rewardText ? `, ${escapeHtml(st.rewardText)}` : ''}${extra}.</p>${nu && st.unlockText ? `<p class="note">${escapeHtml(st.unlockText)}</p>` : ''}`,
        btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
      });
    } else
      after.push({
        title: `You beat ${escapeHtml(T.name)}`,
        top: `<div class="sheet-art">${portraitHTML(T.who, 96, 'sad')}</div>`,
        html: `<p>${escapeHtml(T.win || '')}</p><p>You earned ${moneyHTML(pay.reward)}${extra}.</p>`,
        btns: [
          {
            c: 'dark',
            l: run && T.runFoe === 'boss' ? 'On to the payout' : run && run.offer ? 'Pick a Perk' : 'Keep walking',
            f:
              /* RL-8: the run's boss beaten: the run is won */
              run && T.runFoe === 'boss'
                ? () => {
                    uiState.modal = null;
                    runOver(true);
                  }
                : run && run.offer
                  ? () => {
                      uiState.modal = null;
                      perkPickOpen();
                    }
                  : first && (T.clue || T.ending) && typeof storyAfterWin === 'function'
                    ? () => {
                        closeModal();
                        storyAfterWin(T);
                      }
                    : closeModal,
          },
        ],
      });
  }
  save();
  battleLeave(() => {
    setActiveBattle(null);
    battleStageStop();
    document.body.classList.remove('in-battle');
    uiState.tab = 'walk';
    render();
    /* RL-8: a Billie caught with a full party: the release sheet comes first */
    const rel = runReleaseSheet();
    if (rel) after.unshift(rel);
    after.forEach(m => modal(m));
    /* RL-8: the run's party fainted: the run is over */
    if (run && o === 'lose') runOver(false);
    else if (!after.length) showPendingWindows();
  });
}
/* phase 04d: the debug log wraps it */
export function setEndBattle(v) {
  endBattle = v; // eslint-disable-line no-func-assign
  provide({ endBattle });
}

/* ================= v33: NAMEPLATES IN THE SCENE =================
   Each billionaire on the field carries a small plate (name, level, HP, status) that floats above it and follows the
   camera, so the battle reads from the picture itself. With two or three a side they replace the corner cards; in a
   one-on-one they do too, unless Settings → Battle HUD is set to the classic cards. Tap a foe's plate (or the foe) to
   aim at it. */
/* phase 06-3: always the plates in the scene (the classic corner cards and their setting are gone) */
const stagePlatesOn = () => !!activeBattle;
function plateElement(k) {
  const L = $('#plates');
  if (!L) return null;
  let e = L.querySelector(`.bplate[data-k="${k}"]`);
  if (e) return e;
  e = document.createElement('button');
  e.className = 'bplate ' + (ACTOR_SIDE[k] ? 'foe' : 'me');
  e.dataset.k = k;
  e.dataset.a = 'btarget';
  e.dataset.t = k;
  e.tabIndex = -1;
  e.innerHTML = `<span class="pl-top"><b class="pl-n"></b><span class="pl-cr" hidden>${uiIconHTML('spark', 11)}</span><span class="pl-lv tnum"></span></span><span class="pl-hp"><i class="ghost"></i><i class="fill"></i></span><span class="pl-bot"><span class="pl-st"></span><span class="pl-sg"></span><span class="pl-num tnum"></span></span><span class="pl-parts" hidden></span><span class="pl-pips" hidden></span>${ACTOR_SIDE[k] ? '' : '<span class="pl-xp"><i></i></span>'}`;
  L.appendChild(e);
  return e;
}
function paintPlates(s, anim) {
  const L = $('#plates');
  if (!L) return;
  const on = stagePlatesOn();
  $('#battle') && $('#battle').classList.toggle('hud-scene', on);
  if (!on) {
    L.innerHTML = '';
    return;
  }
  for (let k = 0; k < 5; k++) {
    const x = s && s[k],
      e = x ? plateElement(k) : L.querySelector(`.bplate[data-k="${k}"]`);
    if (!e) continue;
    if (!x) {
      e.classList.add('gone');
      continue;
    }
    e.classList.remove('gone');
    e.querySelector('.pl-n').textContent = x.name;
    e.querySelector('.pl-lv').textContent = 'Lv ' + x.lvl;
    e.querySelector('.pl-cr').hidden = !x.alpha;
    e.classList.toggle('alpha', !!x.boss);
    e.querySelector('.pl-st').innerHTML =
      x.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : statusBadgeHTML(x.st);
    const p = Math.max(0, (x.hp / x.max) * 100),
      f = e.querySelector('.fill'),
      g = e.querySelector('.ghost');
    if (f.dataset.k !== x.uid) {
      f.dataset.k = x.uid;
      for (const q of [f, g]) {
        q.style.transition = 'none';
        q.style.width = p + '%';
        void q.offsetWidth;
        q.style.transition = '';
      }
      f.dataset.p = p;
    }
    const prev = +(f.dataset.p || p);
    f.dataset.p = p;
    f.style.width = p + '%';
    f.className = 'fill' + (p < 25 ? ' low' : p < 50 ? ' mid' : '');
    g.style.transitionDelay = p < prev ? '.45s' : '0s';
    g.style.width = p + '%';
    if (p < prev && anim) {
      e.classList.remove('hit');
      void e.offsetWidth;
      e.classList.add('hit');
    }
    /* phase 06-4: what the corner cards used to show: stat changes, a robot's limbs, the party's dots (on the first
       plate of each side) */
    e.querySelector('.pl-sg').innerHTML = Object.entries(x.stg || {})
      .filter(([q, v]) => v)
      .map(([q, v]) => `<span class="stg ${v > 0 ? 'up' : 'dn'}">${statShortName(q)} ${v > 0 ? '+' : ''}${v}</span>`)
      .join('');
    const pr = e.querySelector('.pl-parts');
    pr.hidden = !x.bot;
    /* UI-2: the shared bot plate: the limb pips, and the plate itself in steel with the panel's cuts */
    pr.innerHTML = x.bot ? limbPipsHTML(x.bot.ph) : '';
    e.classList.toggle('bot', !!x.bot);
    const pips = e.querySelector('.pl-pips'),
      party = k === 0 ? saveData.team : k === 1 && activeBattle.kind === 'trainer' ? activeBattle.sides[1].team : null;
    pips.hidden = !party || party.length < 2;
    if (party)
      pips.innerHTML = party.map(m => `<i class="pip${m.hp <= 0 ? ' out' : ''}${m.status ? ' st' : ''}"></i>`).join('');
    const num = e.querySelector('.pl-num');
    num.textContent = ACTOR_SIDE[k] ? (x.boss ? Math.round(p) + '%' : '') : `${Math.max(0, x.hp)}/${x.max}`;
    const xp = e.querySelector('.pl-xp i');
    if (xp) xp.style.width = x.xp * 100 + '%';
    if (battleStage.s[k] && battleStage.s[k].sp === x.sp) battleStage.s[k].st = x.hp > 0 ? x.st : null;
    if (k === 0) {
      const lo = $('#lowhp');
      if (lo) lo.classList.toggle('on', x.hp > 0 && p < 25);
    }
  }
  turnBar();
}
/* v34: the turn order bar: who moves first this turn (by speed; a fast move or a switch can still jump the queue).
   Only with more than two fighters on the field, where it's hard to keep in your head. */
function turnBar() {
  const L = $('#plates');
  if (!L || !activeBattle) return;
  let e = L.querySelector('.turnbar');
  const K = liveActors(0).concat(liveActors(1));
  if (K.length < 3 || activeBattle.over) {
    if (e) e.remove();
    return;
  }
  if (!e) {
    e = document.createElement('div');
    e.className = 'turnbar';
    e.setAttribute('aria-label', 'Turn order');
    L.appendChild(e);
  }
  const O = K.map(k => [k, effectiveStat(k, 'hus') * (fighter(k).boss ? 1 : 1)]).sort((a, b) => b[1] - a[1]);
  const html = O.map(([k]) => {
    const m = fighter(k),
      mine = ACTOR_SIDE[k] === 0,
      n = fighter(k).boss ? (BATTLE_RULES.alphaActs ?? 2) : 1;
    return `<span class="tb ${mine ? 'me' : 'foe'}${fighter(k).boss ? ' alpha' : ''}" title="${escapeHtml(billyName(m))}">${escapeHtml(billyName(m).split(' ')[0])}${n > 1 ? ' ×' + n : ''}</span>`;
  }).join('<i>›</i>');
  if (e.innerHTML !== html) e.innerHTML = '<b>Order</b>' + html;
}
/* every frame: plates ride above their billionaire; the one choosing and the ones you can aim at are marked */
/* phase 06-3: the battle cards live in the scene. The text floats over the ground between the fighters, the menu beside
   the one choosing; both follow the camera (which holds still while you choose, battle-stage.js camUpdate), keep a
   readable size, stay in the lower part of the screen within thumb reach, and are page elements, so the scene's
   lighting never touches them (css/battle-ui.css) */
const floatPos = { acts: null, msg: null };
function floatTick() {
  const B = $('#battle'),
    acts = $('#acts'),
    msg = $('#msg');
  if (!B || !acts || !msg || !activeBattle || !battleStage.L || !battleStage.gl) {
    if (B && B.classList.contains('ui3d')) {
      B.classList.remove('ui3d');
      battleStageResize();
    }
    floatPos.acts = floatPos.msg = null;
    return;
  }
  if (!B.classList.contains('ui3d')) {
    B.classList.add('ui3d');
    battleStageResize();
  }
  const ph = activeBattle.phase;
  battleStage.calm = ph !== 'playing' && ph !== 'end';
  const L = battleStage.L,
    vw = L.vw,
    vh = L.vh,
    pad = 16,
    land = L.lay === 'landscape',
    tk = $('.ticker'),
    top0 = (tk ? tk.getBoundingClientRect().bottom - B.getBoundingClientRect().top : 24) + 8,
    who = activeBattle.cur != null && battleStage.s[activeBattle.cur] ? activeBattle.cur : 0,
    w0 = actorWorldPoint(who),
    a = battleStageToCss({ x: w0.x, y: 0, z: w0.z }),
    p0 = actorWorldPoint(0),
    p1 = actorWorldPoint(1),
    mid = battleStageToCss({ x: (p0.x + p1.x) / 2, y: 0, z: (p0.z + p1.z) / 2 }),
    hasActs = !!acts.firstChild && ph !== 'playing';
  /* a column under the one choosing: its feet, then the text, then the menu, in the lower part of the screen (the
     right third in landscape), so neither card covers a fighter and both stay within thumb reach */
  /* big screens zoom the dock (style.css, 1.18 or 1.35) so the cards grow with the screen: sizes below are in screen
     pixels, and the translate is divided back into the dock's own units */
  const z = parseFloat(getComputedStyle(acts.parentElement).zoom) || 1,
    cwd = Math.min((vw - 2 * pad) / z, land ? 360 : 400);
  acts.style.width = msg.style.width = cwd + 'px';
  const cw = cwd * z,
    ah = hasActs ? acts.offsetHeight * z : 0,
    mh = msg.offsetHeight * z,
    gap = 8 * z,
    colH = mh + (hasActs ? gap + ah : 0);
  /* wide screens (owner, 2026-10-19): a column on the right, clear of the edge, centred top to bottom */
  const edge = land ? Math.max(24, Math.round(vw * 0.03)) : pad;
  let x = land ? vw - cw - edge : a ? a.x - cw * 0.3 : (vw - cw) / 2,
    y = land ? (vh - colH) / 2 : a ? a.y + 12 : vh - colH - pad;
  x = clamp(x, edge, vw - cw - edge);
  y = clamp(y, land ? top0 : vh * 0.42, vh - colH - edge - 8);
  const mx = x / z,
    my = y / z,
    ax = x / z,
    ay = (y + mh + gap) / z;
  const ease = (o, x, y) => (o ? { x: o.x + (x - o.x) * 0.3, y: o.y + (y - o.y) * 0.3 } : { x, y });
  floatPos.acts = ease(floatPos.acts, ax, ay);
  floatPos.msg = ease(floatPos.msg, mx, my);
  acts.style.transform = `translate(${floatPos.acts.x.toFixed(1)}px, ${floatPos.acts.y.toFixed(1)}px)`;
  msg.style.transform = `translate(${floatPos.msg.x.toFixed(1)}px, ${floatPos.msg.y.toFixed(1)}px)`;
  acts.classList.toggle('empty', !hasActs);
}
function platesTick() {
  floatTick();
  const L = $('#plates');
  if (!L || !activeBattle || !battleStage.L || !L.firstChild) return;
  const tgt = activeBattle.phase === 'target',
    placed = [],
    tk = $('.ticker'),
    top0 = (tk ? tk.getBoundingClientRect().bottom - $('#battle').getBoundingClientRect().top : 24) + 4;
  const list = [...L.children]
    .map(e => ({ e, k: +e.dataset.k }))
    .sort(
      (a, b) => (battleStage.s[b.k] ? actorWorldPoint(b.k).z : 0) - (battleStage.s[a.k] ? actorWorldPoint(a.k).z : 0)
    )
    .reverse();
  for (const { e, k } of list) {
    const sd = battleStage.s[k];
    const vis = sd && sd.show && sd.a > 0.3 && !e.classList.contains('gone');
    e.classList.toggle('off', !vis);
    if (!vis) continue;
    const q = battleStageToCss(actorTop(k));
    if (!q) continue;
    const w = e.offsetWidth || 120,
      h = e.offsetHeight || 44;
    let x = clamp(q.x, w / 2 + 6, battleStage.L.vw - w / 2 - 6),
      y = clamp(q.y - 8, top0 + h, battleStage.L.vh - 40);
    /* nearer plates win; a farther one that would cover it moves up (or down if there's no room) */
    for (let it = 0; it < 4; it++) {
      const hit = placed.find(r => Math.abs(r.x - x) < (r.w + w) / 2 + 4 && Math.abs(r.y - y) < (r.h + h) / 2 + 3);
      if (!hit) break;
      const up = hit.y - hit.h - 4;
      y = up - h >= top0 ? up : hit.y + h + 4;
    }
    placed.push({ x, y, w, h });
    e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    e.classList.toggle(
      'cur',
      (activeBattle.phase === 'choose' && activeBattle.cur === k) ||
        (activeBattle.phase === 'fight' && activeBattle.cur === k)
    );
    e.classList.toggle('aim', tgt && ACTOR_SIDE[k] === 1);
    e.disabled = !(tgt && ACTOR_SIDE[k] === 1);
  }
}
/* tapping the picture while aiming picks the nearest foe */
function stageTap(ev) {
  if (!activeBattle || activeBattle.phase !== 'target' || !battleStage.L) return;
  const r = $('#battle').getBoundingClientRect(),
    x = ev.clientX - r.left,
    y = ev.clientY - r.top;
  let best = null,
    bd = 1e9;
  for (const k of liveActors(1)) {
    const c = battleStageToCss(actorCenter(k));
    if (!c) continue;
    const d = Math.hypot(c.x - x, (c.y - y) * 0.8);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  if (best != null && bd < 160) pickTarget(best);
}
document.addEventListener('pointerup', e => {
  if (
    activeBattle &&
    activeBattle.phase === 'target' &&
    e.target &&
    e.target.closest &&
    e.target.closest('#stage') &&
    !e.target.closest('.bplate')
  )
    stageTap(e);
});
