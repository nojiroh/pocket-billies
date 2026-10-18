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
  modal,
  provide,
  render,
  showPendingWindows,
  statusBadgeHTML,
  storyAfterRival,
  storyAfterWin,
  toast,
  typeBadgeHTML,
} from './hooks.js';
import { $, $$, clamp, random } from './util.js';
import {
  COINS,
  EGGS,
  EGG_TIERS,
  ITEMS,
  MOVES,
  RULES,
  SPECIES,
  STAT_NAMES,
  TYPE_COLORS,
  typeEffectiveness,
} from './game-data.js';
import {
  addBilly,
  addEgg,
  billyName,
  dropEncounter,
  findBilly,
  formatNumber,
  healAll,
  maxHp,
  pickWeighted,
  plural,
} from './logic/rules.js';
import {
  ACTOR_SIDE,
  BATTLE_RULES,
  CATCH_RULES,
  actorTypes,
  allSnapshots,
  battleSay,
  canUse,
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
import { activeBattle, escapeHtml, reducedMotion, save, saveData, setActiveBattle, uiState } from './game-state.js';
import { artURL, coinHTML, eggHTML, iconURL, uiIconHTML } from './art.js';
import { portraitHTML } from './person-art.js';
import { RIG_BACK_VIEW, bustHTML, rigPreload } from './skeleton-rig.js';
import {
  AREAS,
  EASE,
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
import { WEATHER_NAMES, currentLocationMap, environment, environmentState } from './environment.js';
import { addRipple, walkRenderer, waterAt } from './walk-view-gl.js';
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
  boxShow: [() => boxShow, v => (boxShow = v)],
  chooseMessage: [() => chooseMessage, v => (chooseMessage = v)],
  countTo: [() => countTo, v => (countTo = v)],
  doThrow: [() => doThrow, v => (doThrow = v)],
  effectivenessLabel: [() => effectivenessLabel, v => (effectivenessLabel = v)],
  endBattle: [() => endBattle, v => setEndBattle(v)],
  finishThrow: [() => finishThrow, v => (finishThrow = v)],
  hpMini: [() => hpMini, v => (hpMini = v)],
  hudCardHTML: [() => hudCardHTML, v => (hudCardHTML = v)],
  hudHit: [() => hudHit, v => ((hudHit = v), provide({ hudHit }))],
  hudPop: [() => hudPop, v => ((hudPop = v), provide({ hudPop }))],
  itemIcon: [() => itemIcon],
  logLine: [() => logLine, v => (logLine = v)],
  needsTarget: [() => needsTarget, v => (needsTarget = v)],
  nextEvent: [() => nextEvent, v => (nextEvent = v)],
  openBattle: [() => openBattle, v => setOpenBattle(v)],
  paintActions: [() => paintActions, v => setPaintActions(v)],
  paintBoxes: [() => paintBoxes, v => (paintBoxes = v)],
  paintParty: [() => paintParty, v => (paintParty = v)],
  paintPlates: [() => paintPlates, v => (paintPlates = v)],
  paintSide: [() => paintSide, v => (paintSide = v)],
  pickMove: [() => pickMove, v => (pickMove = v)],
  pickTarget: [() => pickTarget, v => (pickTarget = v)],
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
  stopTimers: [() => stopTimers, v => (stopTimers = v)],
  tapMessage: [() => tapMessage, v => (tapMessage = v)],
  teamPick: [() => teamPick, v => (teamPick = v)],
  tickerUpdate: [() => tickerUpdate, v => (tickerUpdate = v)],
  turnBar: [() => turnBar, v => (turnBar = v)],
  typeText: [() => typeText, v => (typeText = v)],
});
/* eslint-enable no-func-assign */
provide({ battleFreeArea, battleLayoutChanged, hudHit, hudPop, openBattle, platesTick, playTurnEvents });
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
function hudCardHTML(i) {
  return `<div class="hc-row"><b class="hc-n" id="n${i}"></b><span class="hc-gp" id="gp${i}" hidden>${uiIconHTML('spark', 12)}</span><span class="hc-lv tnum" id="l${i}"></span></div>
 <div class="hc-row2"><span class="hc-t" id="t${i}"></span><span class="hc-st" id="st${i}"></span><span class="hc-sg" id="sg${i}"></span></div>
 <div class="hpbar"><span class="hpl">HP</span><div class="hpt"><i class="ghost" id="g${i}"></i><i class="fill" id="h${i}"></i></div></div>
 <div class="hc-row3">${i === 0 ? '<span class="hc-num tnum" id="hn0"></span>' : ''}<span class="hc-pips" id="pips${i}"></span></div>${i === 0 ? '<div class="xpbar"><i id="x0"></i></div>' : ''}`;
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
 <section class="hcard glassy foe" id="hb1" aria-label="Opponent">${hudCardHTML(1)}</section>
 <div class="mk glassy" id="mk"></div>
 <div class="dock glassy" id="dock">
  <section class="hcard glassy me" id="hb0" aria-label="Your Billie">${hudCardHTML(0)}</section>
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
  if (lay === 'landscape') {
    const y0 = (tk ? tk.bottom - b.top : 0) + 4,
      x1 = (dock ? dock.left - b.left : vw) - 8;
    return { x: 0, y: y0, w: Math.max(160, x1), h: Math.max(120, vh - 8 - y0) };
  }
  const y0 = (foe ? foe.bottom - b.top : 64) + 2,
    y1 = (dock ? dock.top - b.top : vh * 0.62) - 4;
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
      .map(m => [m.sp, m.gold, RIG_BACK_VIEW])
      .concat(activeBattle.sides[1].team.map(m => [m.sp, m.gold, 1]));
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
/* phase 04d: things-to-do.js adds the weather and its events around it */
export function setOpenBattle(v) {
  openBattle = v; // eslint-disable-line no-func-assign
  provide({ openBattle });
}
/* v31: on the 3D stage a battle starts where you are, without a wipe: the camera swoops down toward the spot, the
   billionaire bursts out of the grass in a spray of leaves, then the battle's panels slide up over the same picture.
   When it's over they slide away and the camera pulls back out. The painted stage keeps the wipe. */
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
  walkRenderer.swoop = { x: fx, z: fz, z0: walkRenderer.zoomT };
  walkRenderer.zoomT = Math.max(0.42, walkRenderer.zoomT * 0.5);
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
  setTimeout(() => {
    const S0 = walkRenderer.swoop;
    walkRenderer.swoop = null;
    if (S0) walkRenderer.zoomT = S0.z0;
    go();
  }, 720);
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
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.zoom = Math.max(0.42, (walkRenderer.zoomT || 1) * 0.55);
    }
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
  if (ev.an && typeof battleSoundEffect === 'function') battleSoundEffect(ev.an, r);
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
function boxShow(i, on) {
  const b = $('#hb' + i);
  if (b) b.classList.toggle('on', on);
}
function boxAnims(ev) {
  const an = ev.an;
  if (!an) return;
  if (an.k === 'trainerIn') {
    boxShow(0, false);
    boxShow(1, false);
  }
  if (an.k === 'wild')
    setTimeout(() => {
      paintBoxes(ev.s, ev.mk, false);
      boxShow(1, true);
    }, 620);
  if (an.k === 'enter')
    setTimeout(() => {
      paintSide(an.si, ev.s[an.si], false);
      boxShow(an.si, true);
    }, 420);
  if (an.k === 'faint') setTimeout(() => boxShow(an.si, false), 520);
  if (an.k === 'recall') setTimeout(() => boxShow(an.si, false), 200);
}
function countTo(el, to, dur = 600) {
  if (!el) return;
  const from = +(el.dataset.v || to);
  el.dataset.v = to;
  const show = v => (el.textContent = el.dataset.fmt ? el.dataset.fmt.replace('#', v) : v);
  if (from === to || reducedMotion) {
    show(to);
    return;
  }
  const t0 = performance.now();
  const st = () => {
    const k = Math.min(1, (performance.now() - t0) / dur),
      v = Math.round(from + (to - from) * EASE.out(k));
    show(v);
    if (k < 1) requestAnimationFrame(st);
  };
  st();
}
const statShortName = k => (STAT_NAMES[k] || k).slice(0, 3).toUpperCase();
function paintSide(i, s, anim) {
  if (!s) return;
  const n = $('#n' + i);
  if (!n) return;
  n.textContent = s.name;
  $('#l' + i).textContent = `Lv ${s.lvl}`;
  $('#t' + i).innerHTML = s.ty.map(typeBadgeHTML).join('');
  $('#gp' + i).hidden = !s.gold;
  $('#st' + i).innerHTML = s.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : statusBadgeHTML(s.st);
  $('#sg' + i).innerHTML = Object.entries(s.stg || {})
    .filter(([k, v]) => v)
    .map(([k, v]) => `<span class="stg ${v > 0 ? 'up' : 'dn'}">${statShortName(k)} ${v > 0 ? '+' : ''}${v}</span>`)
    .join('');
  const p = Math.max(0, (s.hp / s.max) * 100),
    h = $('#h' + i),
    g = $('#g' + i);
  if (h.dataset.k !== s.uid) {
    h.dataset.k = s.uid;
    for (const e of [h, g]) {
      e.style.transition = 'none';
      e.style.width = p + '%';
      void e.offsetWidth;
      e.style.transition = '';
    }
    h.dataset.p = p;
  }
  const prev = +(h.dataset.p || p);
  h.dataset.p = p;
  h.style.width = p + '%';
  h.className = 'fill' + (p < 25 ? ' low' : p < 50 ? ' mid' : '');
  g.style.transitionDelay = p < prev ? '.45s' : '0s';
  g.style.width = p + '%';
  if (p < prev && anim) {
    const c = $('#hb' + i);
    c.classList.remove('hit');
    void c.offsetWidth;
    c.classList.add('hit');
  }
  if (battleStage.s[i] && battleStage.s[i].sp === s.sp) battleStage.s[i].st = s.hp > 0 ? s.st : null;
  if (i === 0) {
    const hn = $('#hn0');
    hn.dataset.fmt = `#/${s.max}`;
    if (hn.dataset.k !== s.uid) {
      hn.dataset.k = s.uid;
      hn.dataset.v = s.hp;
    }
    countTo(hn, s.hp);
    $('#x0').style.width = s.xp * 100 + '%';
    const lo = $('#lowhp');
    if (lo) lo.classList.toggle('on', s.hp > 0 && p < 25);
  }
}
function paintParty() {
  if (!activeBattle) return;
  const pip = m => `<i class="pip${m.hp <= 0 ? ' out' : ''}${m.status ? ' st' : ''}"></i>`;
  const a = $('#pips0');
  if (a)
    a.innerHTML = saveData.team
      .filter(m => m.job == null)
      .map(pip)
      .join('');
  const b = $('#pips1');
  if (b) b.innerHTML = activeBattle.kind === 'trainer' ? activeBattle.sides[1].team.map(pip).join('') : '';
}
export function paintBoxes(s, mk, anim) {
  paintSide(0, s[0], anim);
  paintSide(1, s[1], anim);
  paintPlates(s, anim);
  paintParty();
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
    `<span class="tki"><b>MONEY</b> $${formatNumber(saveData.se)}</span>`
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
  if (activeBattle.offer) {
    activeBattle.phase = 'offer';
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
  chooseMessage();
  paintBoxes(allSnapshots(), activeBattle.market);
  boxShow(0, true);
  boxShow(1, true);
  paintActions();
  if (activeBattle.T && activeBattle.T.tutorial && typeof battleTutor === 'function')
    battleTutor(); /* v47: Hazel's tips in Blake's first battle */
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
  if (needsTarget(mid)) {
    activeBattle.mv = mid;
    activeBattle.phase = 'target';
    $('#msgT').textContent = `${MOVES[mid].n}: which one? Tap it.`;
    paintActions();
    if (typeof battleStageTargets === 'function') battleStageTargets(liveActors(1));
    return;
  }
  planNext({ who: activeBattle.cur, k: 'move', mid, tk: liveActors(1)[0] });
}
export function pickTarget(tk) {
  if (!activeBattle || activeBattle.phase !== 'target') return;
  if (typeof battleStageTargets === 'function') battleStageTargets(null);
  planNext({ who: activeBattle.cur, k: 'move', mid: activeBattle.mv, tk });
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
function hpMini(m) {
  const p = Math.max(0, m.hp / maxHp(m));
  return `<span class="hpmini"><i class="${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}" style="width:${p * 100}%"></i></span>`;
}
function billyPickHTML(m, act, attrs, dis, note) {
  return `<button class="pick" ${attrs} ${dis ? 'disabled' : ''}>${bustHTML(m.sp, 40, { gold: m.gold })}<span class="pk-t"><b>${escapeHtml(billyName(m))}</b><span class="pk-m">${SPECIES[m.sp].types.map(typeBadgeHTML).join('')}<small class="tnum">Lv ${m.lvl}</small></span>${hpMini(m)}<small class="tnum">${Math.max(0, m.hp)}/${maxHp(m)}</small></span><span class="pk-s">${note || ''}</span></button>`;
}
function teamPick(back) {
  const on = activeBattle.sides[0].f.filter(f => f.on).map(f => f.act),
    called = (activeBattle.plan || []).filter(p => p.k === 'switch').map(p => p.i);
  return `<div class="plist">${saveData.team
    .map((m, i) => {
      const act = (on.includes(i) && m.hp > 0) || called.includes(i);
      const dis = act || m.hp <= 0 || m.job != null;
      return billyPickHTML(
        m,
        act,
        `data-a="bswitch" data-i="${i}"`,
        dis,
        act
          ? called.includes(i)
            ? 'Coming in'
            : 'In battle'
          : m.job != null
            ? 'At work'
            : m.hp <= 0
              ? 'Fainted'
              : statusBadgeHTML(m.status)
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
      crew = saveData.team.filter(x => x.job == null),
      alive = crew.filter(x => x.hp > 0).length;
    h = `<div class="c-choose"><button class="bt fight" data-a="bfight"><span class="bt-i">${uiIconHTML('fight', 24)}</span><span class="bt-t"><b>Fight</b><small>${plural(m.moves.length, 'move')}</small></span><kbd>F</kbd></button>
  <div class="bt-row"><button class="bt coin" data-a="bcoins" ${wild && first ? '' : 'disabled'}>${uiIconHTML('coin', 18)}<b>Tax it</b><small>${wild ? (first ? coins + ' left' : 'First pick only') : 'Wild only'}</small><kbd>X</kbd></button>
  <button class="bt items" data-a="bitems">${uiIconHTML('bag', 18)}<b>Bag</b><small>${items}</small><kbd>I</kbd></button>
  <button class="bt team" data-a="bteam">${uiIconHTML('team', 18)}<b>Team</b><small>${alive}/${crew.length}</small><kbd>T</kbd></button>
  <button class="bt run" data-a="brun" ${wild ? '' : 'disabled'}>${uiIconHTML('run', 18)}<b>Run</b><small>${wild ? 'Walk away' : 'No exit'}</small><kbd>R</kbd></button></div>${first ? '' : `<button class="bt back wide" data-a="bback">${uiIconHTML('back', 16)}<b>Back to ${escapeHtml(billyName(fighter(activeBattle.plan[activeBattle.plan.length - 1].who)))}</b><kbd>Esc</kbd></button>`}</div>`;
  } else if (ph === 'fight') {
    const m = fighter(activeBattle.cur);
    h = `<div class="moves">${m.moves
      .map((id, n) => {
        const M = MOVES[id],
          c = TYPE_COLORS[M.t],
          P = M.p ? M.p : M.fx && M.fx.vary ? 'Varies' : 'Status',
          stab = M.t !== 'None' && actorTypes(activeBattle.cur).includes(M.t);
        return `<button class="mv" style="--tc:${c[0]};--tf:${c[1]}" data-a="bmove" data-m="${id}" data-tip="${escapeHtml(M.d)}"><span class="mv-top"><b>${escapeHtml(M.n)}</b><kbd>${n + 1}</kbd></span><span class="mv-meta"><span class="mv-ty">${M.t === 'None' ? 'Normal' : M.t}${stab ? ' ★' : ''}</span><span class="tnum">${P}${M.p ? ' pow' : ''}${M.p && typeof battleWeatherMultiplier === 'function' ? (battleWeatherMultiplier(M.t) > 1 ? ' ▲' : battleWeatherMultiplier(M.t) < 1 ? ' ▼' : '') : ''}${M.c !== 'X' || M.a < 100 ? ` · ${M.a || 100}%` : ''}</span></span>${effectivenessLabel(id)}</button>`;
      })
      .join('')}</div>${backButtonHTML()}`;
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
        return `<button class="ccard" data-a="bcoin" data-c="${k}" ${have ? '' : 'disabled'}>${coinHTML(k, 34)}<span class="cc-t"><b>${escapeHtml(c.n)}</b><small class="tnum">${c.m === 0 ? 'Guaranteed' : `~${odds}% tax`} · ${have} left</small></span><span class="cc-bar"><i style="width:${c.m === 0 ? 100 : clamp(odds, 2, 100)}%"></i></span></button>`;
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
    h = `<div class="aim"><div class="aimcoin" id="aimCoin" role="button" tabindex="0" aria-label="Swipe up to throw">${coinHTML(activeBattle.coin, 96, 32)}<span class="aim-hint">${uiIconHTML('back', 14)}</span></div><p class="note">Swipe the coin up when the ring is small and green. A sideways swipe adds spin.</p><div class="two"><button class="bt coin" data-a="bthrow"><b>Flick it</b><kbd>Space</kbd></button><button class="bt back" data-a="baimback"><b>Put it away</b><kbd>Esc</kbd></button></div></div>`;
  } else if (ph === 'throwing') h = `<div class="aim"><p class="note">The coin is in the air…</p></div>`;
  else if (ph === 'offer') {
    h = `<div class="offer"><p>${uiIconHTML('coin', 16)} ${escapeHtml(billyName(fighter(1)))} is offering you <b class="tnum">$${formatNumber(activeBattle.offer)}</b> to let it go. Refusing gives your next throw a Focus Bonus.</p><div class="two"><button class="bt coin" data-a="boffer" data-y="1"><b>Take it</b></button><button class="bt fightish" data-a="boffer" data-y="0"><b>Refuse</b></button></div></div>`;
  } else if (ph === 'end') {
    const t = {
      win: 'You won.',
      lose: 'Your team fainted.',
      caught: 'Taxed.',
      ran: 'You walked away.',
      bribed: 'You took the money.',
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
  $('#msgT').textContent =
    activeBattle.integrity > 1
      ? `Focus Bonus ×${+activeBattle.integrity.toFixed(2)} is active.`
      : 'Line up your throw.';
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
  $('#msgT').textContent = [`You flicked a ${COINS[id].n}.`, lab, spin ? 'Spin bonus!' : ''].filter(Boolean).join(' ');
  battleStageCatch(id, res, spin, caught => finishThrow(res, id, lab, spin));
}
function finishThrow(res, id, lab, spin) {
  uiState.throwing = false;
  if (!activeBattle) return;
  const e = fighter(1);
  activeBattle.events = [];
  if (res.edge) battleSay('It landed on its edge. Critical tax!');
  if (res.caught) {
    battleSay(`Gotcha! ${billyName(e)} was taxed.`, { k: 'caught' });
    if (e.boss) {
      const f = e.hp / maxHp(e);
      delete e.boss;
      e.alpha = true;
      e.hp = Math.max(1, Math.round(maxHp(e) * f));
      battleSay(`${billyName(e)} is an Alpha: a little bigger and stronger than others of its kind.`);
    }
    e.hp = Math.max(1, e.hp);
    const where = addBilly(e);
    if (where === 'box') battleSay(`${billyName(e)} went to storage. Your team is full.`);
    activeBattle.over = 'caught';
    save();
    return playTurnEvents();
  }
  battleSay(['It broke free right away.', 'It almost stayed in.', 'So close. It wobbled twice.'][res.w]);
  if (random() < CATCH_RULES.offerChance) {
    activeBattle.offer =
      Math.round((CATCH_RULES.offerMin + random() * (CATCH_RULES.offerMax - CATCH_RULES.offerMin)) / 10) * 10;
    battleSay(`${billyName(e)} is offering you money to let it go.`, { k: 'cry', si: 1 });
    return playTurnEvents();
  }
  enemyOnly();
  playTurnEvents();
}
export function endBattle() {
  stopTimers();
  const o = activeBattle.over,
    kind = activeBattle.kind,
    T = activeBattle.T,
    tid = activeBattle.tid,
    lead = findBilly(activeBattle.lead);
  if (o === 'win' && typeof jingle === 'function') jingle(JINGLES.victory);
  if (o === 'win')
    for (const m of saveData.team)
      if (m.hp > 0 && m.job == null) m.wins = (m.wins || 0) + 1; /* v36: the Hype counter */
  if (typeof battleTipHide === 'function') battleTipHide();
  if (kind === 'wild') dropEncounter(activeBattle.qid);
  if (lead) {
    if (o === 'win') lead.streak = (lead.streak || 0) + 1;
    else if (o === 'lose') lead.streak = 0;
  }
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
  if (o === 'lose') {
    const fee = Math.floor(saveData.se * BATTLE_RULES.loseFee);
    saveData.se -= fee;
    healAll();
    after.push({
      title: 'Your team fainted',
      html: `<p>You hurried back to the clinic.</p><p>You paid $${formatNumber(fee)} for treatment, and the team is back at full HP.</p>${T ? `<p class="note">${escapeHtml(T.name)}: ${escapeHtml(T.lose || '')}</p>` : ''}`,
      btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
    });
  }
  const E = RULES.eggs;
  if (kind === 'wild' && o === 'win' && random() < E.dropChance) {
    const tiers = Object.entries(E.dropTiers)
      .filter(([t]) => EGGS[t])
      .map(([t, w]) => [+t, w]);
    const tier = tiers.length ? pickWeighted(tiers) : EGG_TIERS[0];
    if (addEgg(tier))
      after.push({
        title: 'It dropped an egg',
        top: `<div class="sheet-art">${eggHTML(tier, 72, 'wob')}</div>`,
        html: `<p>A ${tier} km egg rolled out of the grass. Walk ${tier} km with it in an incubator to see what hatches.</p>`,
        btns: [{ l: 'Nice', c: 'dark', f: closeModal }],
      });
  }
  if (kind === 'trainer' && o === 'win') {
    saveData.se += T.reward || 0;
    const first = !saveData.flags[tid];
    saveData.flags[tid] = 1;
    let extra = '';
    if (first && T.egg && addEgg(T.egg)) extra += ` and a ${T.egg} km egg`;
    const st = T.seat;
    if (st) {
      const nu = !saveData.seats.includes(st.id);
      if (nu) {
        saveData.seats.push(st.id);
        for (const k in st.coins || {}) saveData.coins[k] = (saveData.coins[k] || 0) + st.coins[k];
        for (const k in st.items || {}) saveData.items[k] = (saveData.items[k] || 0) + st.items[k];
      }
      after.push({
        title: nu ? escapeHtml(st.title || 'Badge') : 'Rematch won',
        top: `<div class="sheet-art">${coinHTML(st.coin || 'penny', 96, 32)}</div>`,
        html: `<p>${escapeHtml(T.win || '')}</p><p>You earned $${formatNumber(T.reward || 0)}${nu && st.rewardText ? `, ${escapeHtml(st.rewardText)}` : ''}${extra}.</p>${nu && st.unlockText ? `<p class="note">${escapeHtml(st.unlockText)}</p>` : ''}`,
        btns: [{ l: 'Back to walking', c: 'dark', f: closeModal }],
      });
    } else
      after.push({
        title: `You beat ${escapeHtml(T.name)}`,
        top: `<div class="sheet-art">${portraitHTML(T.who, 96, 'sad')}</div>`,
        html: `<p>${escapeHtml(T.win || '')}</p><p>You earned $${formatNumber(T.reward || 0)}${extra}.</p>`,
        btns: [
          {
            l: 'Keep walking',
            c: 'dark',
            f:
              first && (T.clue || T.ending) && typeof storyAfterWin === 'function'
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
    after.forEach(m => modal(m));
    if (!after.length) showPendingWindows();
  });
}
/* phase 04d: things-to-do.js adds the weather and its events around it */
export function setEndBattle(v) {
  endBattle = v; // eslint-disable-line no-func-assign
  provide({ endBattle });
}

/* ================= v33: NAMEPLATES IN THE SCENE =================
   Each billionaire on the field carries a small plate (name, level, HP, status) that floats above it and follows the
   camera, so the battle reads from the picture itself. With two or three a side they replace the corner cards; in a
   one-on-one they do too, unless Settings → Battle HUD is set to the classic cards. Tap a foe's plate (or the foe) to
   aim at it. */
const stagePlatesOn = () =>
  !!activeBattle && (isMulti() || ((saveData.preferences || {}).battleHud || 'scene') !== 'classic');
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
  e.innerHTML = `<span class="pl-top"><b class="pl-n"></b><span class="pl-cr" hidden>${uiIconHTML('spark', 11)}</span><span class="pl-lv tnum"></span></span><span class="pl-hp"><i class="ghost"></i><i class="fill"></i></span><span class="pl-bot"><span class="pl-st"></span><span class="pl-num tnum"></span></span>${ACTOR_SIDE[k] ? '' : '<span class="pl-xp"><i></i></span>'}`;
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
    e.classList.toggle('gold', !!x.gold);
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
    const num = e.querySelector('.pl-num');
    num.textContent = ACTOR_SIDE[k] ? (x.boss ? Math.round(p) + '%' : '') : `${Math.max(0, x.hp)}/${x.max}`;
    const xp = e.querySelector('.pl-xp i');
    if (xp) xp.style.width = x.xp * 100 + '%';
    if (battleStage.s[k] && battleStage.s[k].sp === x.sp) battleStage.s[k].st = x.hp > 0 ? x.st : null;
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
function platesTick() {
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
