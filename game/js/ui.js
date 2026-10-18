'use strict';
/* ================= UI ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { billyUnit, provide, unitBuildHTML, unitHeroHTML, unitOpenRowHTML, unitRowHTML } from './hooks.js';
import { $, $$, clamp, random } from './util.js';
import {
  COINS,
  DEX_ORDER,
  EGGS,
  ITEMS,
  JOBS,
  JOB_STEPS,
  LINE_BY_ID,
  LOCATIONS,
  MOVES,
  PEOPLE,
  POOLS,
  REGIONS,
  ROADS,
  ROADS_BY_NODE,
  RULES,
  SHOPS,
  SPECIES,
  START_NODE,
  STATUS_NAMES,
  STAT_IDS,
  STAT_NAMES,
  TRAINERS,
  TYPES,
  TYPE_COLORS,
  gameData,
  locationSubtitle,
  roadCost,
  trainersAt,
  typeEffectiveness,
} from './game-data.js';
import {
  STEP_BRACKETS,
  addEgg,
  allBillies,
  assignJob,
  billyBuild,
  billyName,
  blockerAt,
  canEnter,
  canEvolve,
  canRide,
  cleanName,
  collectJob,
  eggSlotCount,
  encounterBuild,
  endShift,
  evolutionHint,
  evolutionItemName,
  evolve,
  findBilly,
  formatNumber,
  gateMsg,
  gateText,
  hatchEgg,
  hatchable,
  healAll,
  isPrime,
  makeBilly,
  maxHp,
  maxLevel,
  moveSlotCount,
  nextBracket,
  nextTripNode,
  partSlots,
  plural,
  resumeTrip,
  riderName,
  rollDay,
  setTrip,
  spawn,
  splitPath,
  stat,
  stepRate,
  stepsToKm,
  stopTrip,
  teamSize,
  toBox,
  toTeam,
  tripTo,
  walkMode,
  xpFor,
} from './logic/rules.js';
import { TOAST_MS, toastAdd, toastItem, toastTime } from './logic/messages.js';
import { pbFloat, pbInboxDot, pbInboxPop } from './ui-kit.js';
import { newSaveKeepingPreferences } from './logic/saves.js';
import {
  CATCH_RULES,
  applyItem,
  battleSay,
  canUse,
  checkFaints,
  doSwitch,
  enemyOnly,
  fighter,
  runTurn,
  startWild,
} from './logic/battle-engine.js';
import {
  activeBattle,
  escapeHtml,
  flushSave,
  reducedMotion,
  save,
  saveData,
  setSaveData,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { frameTask, userFps } from './frame-scheduler.js';
import { ART_CACHE, artLoad, artURL, coinHTML, coinURL, eggHTML, makeCanvas, uiIconHTML } from './art.js';
import { LOOK_PRESETS, cleanLook, cleanTrainer, personHTML, personWalkIconURL, portraitHTML } from './person-art.js';
import { applyPreferences, settingsHTML } from './settings-screen.js';
import { bustHTML, rigCanvasHTML } from './skeleton-rig.js';
import { EASE, battleStage, battleStageFocus, battleStageTargets, camHome } from './battle-stage.js';
import {
  closedText,
  findPath,
  isOpenNow,
  mapArtPaths,
  mapById,
  mapHub,
  openingHoursKind,
  startClimb,
  stopWalkView,
  walkData,
  walkTo,
  walkView,
  walkablePointNear,
} from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { environment, environmentHint, environmentIcon, environmentLabel } from './environment.js';
import { mountWalkView, walkRenderer } from './walk-view-gl.js';
import { fishStart } from './fishing.js';
import {
  seamlessDelta,
  seamlessGate,
  seamlessGetReady,
  seamlessOn,
  seamlessPrefetch,
  seamlessRoamView,
  seamlessRoomId,
  seamlessRoomMap,
  seamlessTripView,
  seamlessWorld,
  shiftWalkView,
} from './seamless-world.js';
import { battle3dLayout, battle3dWanted } from './battle-3d.js';
import {
  battleResize,
  battleShell,
  chooseMessage,
  doThrow,
  endBattle,
  itemIcon,
  paintActions,
  pickMove,
  pickTarget,
  planBack,
  planNext,
  playTurnEvents,
  showAim,
  tapMessage,
} from './battle.js';
import {
  worldMapFit,
  worldMapHeight,
  worldMapMount,
  worldMapReset,
  worldMapSelect,
  worldMapWidth,
  worldMapZoom,
} from './world-map.js';
import { worldMapGlAction, worldMapGlWanted } from './world-map-gl.js';
import { openShop } from './shop.js';
import { soundEffect } from './sound.js';
import { talkHazel } from './talk.js';
import { cutscene, cutsceneStart, cutsceneWanted } from './cutscene.js';
import { tutorPicked } from './opening-fall.js';
import { renderTitle, titleMount } from './title.js';
import { loreBook, renderLore } from './lore.js';
import { flyMenu, rideGlassLift } from './airship.js';
import { postcardCheck, renderPostcards } from './postcards.js';
import { renderBag } from './bag.js';
import { friendsHTML } from './friends.js';
import {
  legendCheck,
  personTalk,
  storyCheck,
  storyFlags,
  storyMovedCheck,
  storyRivalBattle,
  trainerTalk,
} from './story.js';
import { challengeCardHTML, homeDecorate, refreshHomeFurniture, requestListHTML, stampTile } from './things-to-do.js';
/* eslint-disable no-func-assign */
expose({
  BOX_SORTS: [() => BOX_SORTS],
  BRACKET_COLORS: [() => BRACKET_COLORS],
  RARITY_NAMES: [() => RARITY_NAMES],
  ROOM_BY_BUILDING: [() => ROOM_BY_BUILDING],
  ROOM_BY_USE: [() => ROOM_BY_USE],
  SCREENS: [() => SCREENS],
  TABS: [() => TABS],
  TRACKS: [() => TRACKS],
  addPick: [() => addPick, v => (addPick = v)],
  badgeSlots: [() => badgeSlots, v => (badgeSlots = v)],
  billyConditionHTML: [() => billyConditionHTML],
  billySheet: [() => billySheet, v => (billySheet = v)],
  boardNote: [() => boardNote, v => (boardNote = v)],
  boxSection: [() => boxSection, v => (boxSection = v)],
  bracketBars: [() => bracketBars, v => (bracketBars = v)],
  bracketLabels: [() => bracketLabels, v => (bracketLabels = v)],
  bracketNote: [() => bracketNote, v => (bracketNote = v)],
  bracketSpans: [() => bracketSpans, v => (bracketSpans = v)],
  buddyCard: [() => buddyCard, v => (buddyCard = v)],
  buildPixelSky: [() => buildPixelSky, v => (buildPixelSky = v)],
  closeModal: [() => closeModal, v => ((closeModal = v), provide({ closeModal }))],
  dexStatus: [() => dexStatus, v => (dexStatus = v)],
  donateItem: [() => donateItem, v => (donateItem = v)],
  eggSlots: [() => eggSlots, v => (eggSlots = v)],
  encounterCardHTML: [() => encounterCardHTML, v => (encounterCardHTML = v)],
  enterRoom: [() => enterRoom, v => (enterRoom = v)],
  environmentLine: [() => environmentLine, v => (environmentLine = v)],
  evolutionMethod: [() => evolutionMethod, v => (evolutionMethod = v)],
  evolutionModal: [() => evolutionModal, v => (evolutionModal = v)],
  exitPrompt: [() => exitPrompt, v => (exitPrompt = v)],
  genderModal: [() => genderModal, v => (genderModal = v)],
  guideTabs: [() => guideTabs, v => (guideTabs = v)],
  hatchModal: [() => hatchModal, v => (hatchModal = v)],
  healPick: [() => healPick, v => (healPick = v)],
  hereCard: [() => hereCard, v => (hereCard = v)],
  hireFlow: [() => hireFlow, v => (hireFlow = v)],
  hirePick: [() => hirePick, v => (hirePick = v)],
  hpBar: [() => hpBar, v => (hpBar = v)],
  initPixelSky: [() => initPixelSky, v => (initPixelSky = v)],
  isDark: [() => isDark],
  jobSlots: [() => jobSlots, v => (jobSlots = v)],
  learnModal: [() => learnModal, v => (learnModal = v)],
  leaveRoom: [() => leaveRoom, v => (leaveRoom = v)],
  locationCardHTML: [() => locationCardHTML, v => (locationCardHTML = v)],
  mapExits: [() => mapExits, v => ((mapExits = v), provide({ mapExits }))],
  mapExitsByBearing: [() => mapExitsByBearing, v => (mapExitsByBearing = v)],
  mapIdAt: [() => mapIdAt, v => ((mapIdAt = v), provide({ mapIdAt }))],
  mapOffsetInView: [() => mapOffsetInView, v => ((mapOffsetInView = v), provide({ mapOffsetInView }))],
  meter: [() => meter],
  modal: [() => modal, v => ((modal = v), provide({ modal }))],
  needsCare: [() => needsCare],
  nextModal: [() => nextModal, v => (nextModal = v)],
  nextToast: [() => nextToast, v => (nextToast = v)],
  nodeActions: [() => nodeActions, v => (nodeActions = v)],
  notice: [() => notice, v => ((notice = v), provide({ notice }))],
  openInbox: [() => openInbox, v => (openInbox = v)],
  openSettings: [() => openSettings, v => ((openSettings = v), provide({ openSettings }))],
  paintWorldMapCard: [() => paintWorldMapCard, v => ((paintWorldMapCard = v), provide({ paintWorldMapCard }))],
  pixelSky: [() => pixelSky],
  pixelSkyTick: [() => pixelSkyTick, v => (pixelSkyTick = v)],
  plateVars: [() => plateVars],
  playerWalkIconHTML: [() => playerWalkIconHTML, v => (playerWalkIconHTML = v)],
  poolStrip: [() => poolStrip, v => (poolStrip = v)],
  progressBarHTML: [() => progressBarHTML, v => ((progressBarHTML = v), provide({ progressBarHTML }))],
  render: [() => render, v => setRender(v)],
  renderDexEntry: [() => renderDexEntry, v => (renderDexEntry = v)],
  renderGuide: [() => renderGuide, v => (renderGuide = v)],
  renderIntro: [() => renderIntro, v => (renderIntro = v)],
  renderOverlay: [() => renderOverlay, v => setRenderOverlay(v)],
  renderProfile: [() => renderProfile, v => (renderProfile = v)],
  renderTeam: [() => renderTeam, v => (renderTeam = v)],
  renderWalk: [() => renderWalk, v => (renderWalk = v)],
  renderWorldMapTab: [() => renderWorldMapTab, v => (renderWorldMapTab = v)],
  resizePixelSky: [() => resizePixelSky, v => (resizePixelSky = v)],
  roomAct: [() => roomAct, v => (roomAct = v)],
  roomAim: [() => roomAim, v => (roomAim = v)],
  roomFor: [() => roomFor, v => (roomFor = v)],
  roomHero: [() => roomHero, v => (roomHero = v)],
  roomLayIn: [() => roomLayIn, v => (roomLayIn = v)],
  roomRefresh: [() => roomRefresh, v => ((roomRefresh = v), provide({ roomRefresh }))],
  roomState: [() => roomState, v => (roomState = v)],
  roomStepIn: [() => roomStepIn, v => (roomStepIn = v)],
  runEvolution: [() => runEvolution, v => ((runEvolution = v), provide({ runEvolution }))],
  showPendingWindows: [() => showPendingWindows, v => ((showPendingWindows = v), provide({ showPendingWindows }))],
  showToast: [() => showToast, v => (showToast = v)],
  startGame: [() => startGame, v => ((startGame = v), provide({ startGame }))],
  statusBadgeHTML: [() => statusBadgeHTML],
  stepsTo: [() => stepsTo, v => (stepsTo = v)],
  swapPick: [() => swapPick, v => (swapPick = v)],
  toast: [() => toast, v => ((toast = v), provide({ toast }))],
  toastTimer: [() => toastTimer, v => (toastTimer = v)],
  topbar: [() => topbar, v => (topbar = v)],
  tripButtons: [() => tripButtons, v => (tripButtons = v)],
  tripDest: [() => tripDest],
  tripLeft: [() => tripLeft, v => (tripLeft = v)],
  tripStatus: [() => tripStatus, v => (tripStatus = v)],
  typeBadgeHTML: [() => typeBadgeHTML],
  updateNav: [() => updateNav, v => ((updateNav = v), provide({ updateNav }))],
  walkCross: [() => walkCross, v => (walkCross = v)],
  walkHero: [() => walkHero, v => (walkHero = v)],
  walkMapSync: [() => walkMapSync, v => (walkMapSync = v)],
  walkPick: [() => walkPick, v => (walkPick = v)],
  walkState: [() => walkState, v => (walkState = v)],
  whenWorldShows: [() => whenWorldShows, v => (whenWorldShows = v)],
  worldMapCardHTML: [() => worldMapCardHTML, v => (worldMapCardHTML = v)],
  xpLeft: [() => xpLeft],
  xpProgress: [() => xpProgress],
});
/* eslint-enable no-func-assign */
provide({
  closeModal,
  mapExits,
  mapIdAt,
  mapOffsetInView,
  modal,
  notice,
  openSettings,
  paintWorldMapCard,
  progressBarHTML,
  render,
  renderOverlay,
  roomRefresh,
  runEvolution,
  showPendingWindows,
  startGame,
  toast,
  updateNav,
});
export function setRender(v) {
  render = v; // eslint-disable-line no-func-assign
  provide({ render });
}
export function setRenderOverlay(v) {
  renderOverlay = v; // eslint-disable-line no-func-assign
  provide({ renderOverlay });
}
/* to-module: end */
export const typeBadgeHTML = t =>
  `<span class="chip" style="--tc:${TYPE_COLORS[t][0]};--tf:${TYPE_COLORS[t][1]}">${t === 'None' ? 'Normal' : t}</span>`;
provide({ typeBadgeHTML }); /* to-module */
const statusBadgeHTML = st => (st ? `<span class="stb st-${st}">${STATUS_NAMES[st]}</span>` : '');
provide({ statusBadgeHTML }); /* to-module */
function progressBarHTML(p, cls = '') {
  return `<div class="pbar ${cls}"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`;
}
function hpBar(hp, max) {
  const p = Math.max(0, hp / max);
  return `<div class="pbar hpb ${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}"><i style="width:${p * 100}%"></i></div>`;
}

/* ---------- toasts & modals ---------- */
/* phase 06: one toast at a time under the top bar (<pb-toast id="toast">, js/ui-kit.js); the same message again joins
   the one showing or waiting ("Saved ×2", js/logic/messages.js); a tap or a swipe up dismisses it */
let toastTimer = 0;
export function toast(t) {
  const where = toastAdd(uiState.toastOn, uiState.toastQ, String(t), Date.now());
  if (where === 'showing') {
    showToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(nextToast, TOAST_MS);
  } else if (!uiState.toastOn) nextToast();
}
function nextToast() {
  clearTimeout(toastTimer);
  const t = uiState.toastQ.shift();
  if (!t) {
    uiState.toastOn = false;
    showToast();
    return;
  }
  uiState.toastOn = toastItem(t, Date.now());
  showToast(true);
  toastTimer = setTimeout(nextToast, toastTime(uiState.toastQ.length));
}
/* the pill follows uiState.toastOn (the checks clear it and call renderOverlay); a new toast gets a new element, so it
   drops in again, while a merge only updates the count */
function showToast(fresh) {
  let el = /** @type {any} */ (document.getElementById('toast'));
  const t = uiState.toastOn;
  if (!t) {
    if (el) el.remove();
    return;
  }
  if (el && fresh) {
    el.remove();
    el = null;
  }
  if (!el) {
    el = document.createElement('pb-toast');
    el.id = 'toast';
    el.addEventListener('pb-dismiss', nextToast);
    document.body.appendChild(el);
  }
  el.style.setProperty('--toast-top', document.querySelector('.topbar') ? '70px' : '12px');
  el.text = t.text;
  el.n = t.count;
}
/* phase 06: a notice that can wait (not a choice) goes behind the dot on the portrait instead of opening by itself;
   the same id is kept once; onRead runs when it has been read */
export function notice(n) {
  if (uiState.inbox.some(x => x.id === n.id)) return;
  uiState.inbox.push(n);
  if (saveData.started && !activeBattle && uiState.intro === 0) render();
}
function openInbox() {
  const L = uiState.inbox.splice(0);
  if (!L.length) return;
  modal({
    title: L.length === 1 ? L[0].title : 'Waiting for you',
    cls: 'inbox-sheet',
    html:
      L.length === 1
        ? `<div class="prose">${L[0].html}</div>`
        : `<ul class="inbox-list">${L.map((n, i) => `<li class="m-enter" style="--i:${i}"><h3>${n.title}</h3><div class="prose">${n.html}</div></li>`).join('')}</ul>`,
    btns: [{ l: 'Got it', c: 'dark', f: closeModal }],
  });
  L.forEach(n => n.onRead && n.onRead());
  render();
}
export function modal(o) {
  uiState.mq.push(o);
  if (!uiState.modal) nextModal();
}
function nextModal() {
  uiState.modal = uiState.mq.shift() || null;
  renderOverlay();
}
export function closeModal() {
  uiState.modal = null;
  nextModal();
  if (!uiState.modal) showPendingWindows();
}
export function renderOverlay() {
  const ov = $('#ov');
  let h = '';
  const M = uiState.modal;
  if (M)
    h += `<div class="scrim" data-a="scrim"><div class="sheet px ${M.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="mt">${M.top || ''}<h2 id="mt">${M.title}</h2><div class="body">${M.html || ''}</div><div class="btns">${(M.btns || []).map((b, i) => `<button class="pb ${b.c || ''} wide" data-a="mb" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.l}</button>`).join('')}</div></div></div>`;
  const keep = ov.querySelector('.scrim');
  ov.innerHTML = h;
  const sc = ov.querySelector('.scrim');
  if (sc && keep && M && M === uiState._lastM) sc.classList.add('still');
  uiState._lastM = M;
  showToast();
  if (M && M.after && !M._afterRan) {
    M._afterRan = true;
    M.after();
  }
  if (M && M !== uiState._focusedModal) {
    uiState._focusedModal = M;
    uiState._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
      const e = $('.sheet button,.sheet input,.sheet select');
      if (e) e.focus({ preventScroll: true });
    });
  } else if (!M && uiState._focusedModal) {
    uiState._focusedModal = null;
    if (uiState._returnFocus && uiState._returnFocus.isConnected) uiState._returnFocus.focus({ preventScroll: true });
  }
}

/* ---------- post-step events ---------- */
/* phase 06: runs fn once the world is on screen and the player has had a moment to see it (no loader, title or
   opening in front of it); gives up quietly after 30 s */
export function whenWorldShows(fn, settle = 1200) {
  const t0 = performance.now();
  const ready = () => {
    const ld = document.getElementById('loader');
    return (
      walkView.ready &&
      !uiState.title &&
      !document.body.classList.contains('in-cs') &&
      !(ld && !ld.hidden && ld.offsetParent !== null)
    );
  };
  const tick = () => {
    if (ready()) setTimeout(fn, settle);
    else if (performance.now() - t0 < 30000) setTimeout(tick, 250);
  };
  tick();
}
export function showPendingWindows() {
  if (activeBattle || uiState.modal || !saveData.started || uiState.title) return;
  const eg = hatchable()[0];
  if (eg) {
    hatchModal(eg);
    return;
  }
  const lq = uiState.learnQ.shift();
  if (lq) {
    const m = findBilly(lq.uid);
    if (m && !m.moves.includes(lq.mv)) {
      learnModal(m, lq.mv);
      return;
    }
    return showPendingWindows();
  }
  const m = allBillies().find(canEvolve);
  if (m) evolutionModal(m);
}
function genderModal() {
  modal({
    title: 'Are you a boy or a girl?',
    html: `<p>Professor Hazel needs it for your trainer card.</p><div class="gpick">${['boy', 'girl'].map(g => `<button class="gcard px" data-a="setgender" data-g="${g}">${personHTML(g, 64)}<b>${g === 'boy' ? 'Boy' : 'Girl'}</b></button>`).join('')}</div>`,
    btns: [],
    lock: 1,
  });
}
function learnModal(m, mv) {
  const M = MOVES[mv];
  modal({
    title: `${escapeHtml(billyName(m))} wants to learn ${M.n}`,
    html: `<p>${typeBadgeHTML(M.t)} ${M.p ? `${M.p} power` : 'Status'}. ${M.d}</p><p class="note">It already knows ${moveSlotCount()} moves. Pick one to forget, or skip this one.</p>`,
    btns: m.moves
      .map(id => ({
        l: `Forget ${MOVES[id].n}`,
        f: () => {
          m.moves[m.moves.indexOf(id)] = mv;
          save();
          toast(`${billyName(m)} learned ${M.n}.`);
          closeModal();
        },
      }))
      .concat([{ l: `Don’t learn ${M.n}`, c: 'quiet', f: closeModal }]),
  });
}
function evolutionModal(m) {
  const s = SPECIES[m.sp],
    e = s.evo;
  const why =
    {
      lvl: `It just reached level ${e.at}.`,
      buddy: `You’ve walked ${stepsToKm(e.steps)} km together.`,
      idle: 'It rested in storage for a whole day.',
      streak: `${e.n} wins in a row made it stronger.`,
      split: `It just reached level ${e.at}. ${splitPath(m) === 'B' ? `It won ${m.wins || 0} battles: the Hype path.` : `It walked ${stepsToKm(m.bsteps || 0)} km with you: the Build path.`}`,
    }[e.k] || '';
  modal({
    title: `${escapeHtml(billyName(m))} is evolving`,
    cls: 'evo-sheet',
    top: `<div class="evo">${rigCanvasHTML(m.sp, 128, { gold: m.gold, build: m.build })}</div>`,
    html: `<p>${why} Something bigger is coming.</p>`,
    lock: 1,
    btns: [
      { l: 'Let it evolve', c: 'dark', f: () => runEvolution(m) },
      {
        l: 'Not yet',
        c: 'quiet',
        f: () => {
          m.evoNo = m.lvl;
          save();
          closeModal();
        },
      },
    ],
  });
}
function runEvolution(m, note) {
  const from = SPECIES[m.sp],
    to = SPECIES[from.evo && from.evo.k === 'split' && from.alt && splitPath(m) === 'B' ? from.alt : from.next],
    fromName = billyName(m);
  uiState.modal = null;
  modal({
    title: `What? ${escapeHtml(fromName)} is evolving!`,
    top: `<div class="evo run" id="evoBox"><span class="ea">${rigCanvasHTML(from.id, 128, { gold: m.gold, still: 1 })}</span><span class="eb">${rigCanvasHTML(to.id, 128, { gold: m.gold, still: 1 })}</span></div>`,
    html: '<p class="note">Don’t look away.</p>',
    btns: [],
    lock: 1,
    after: () => {
      const box = $('#evoBox');
      if (!box) return;
      const seq = reducedMotion ? [] : [420, 380, 330, 280, 240, 200, 170, 140, 110, 90, 70, 60, 50, 40, 40, 30];
      let t = 0,
        flip = false;
      seq.forEach(d => {
        t += d;
        setTimeout(() => {
          flip = !flip;
          box.classList.toggle('b', flip);
        }, t);
      });
      setTimeout(() => {
        box.classList.add('b', 'flash');
        evolve(m);
        save();
        setTimeout(
          () => {
            uiState.modal = null;
            modal({
              title: `${escapeHtml(fromName)} became ${escapeHtml(to.name)}`,
              top: `<div class="evo done">${rigCanvasHTML(m.sp, 128, { gold: m.gold, build: m.build })}</div>`,
              html: `<p>${escapeHtml(to.blurb)}</p><p>${to.types.map(typeBadgeHTML).join('')}</p>${note ? `<p class="note">${note}</p>` : ''}`,
              btns: [{ l: 'Nice', c: 'dark', f: closeModal }],
            });
          },
          reducedMotion ? 60 : 700
        );
      }, t + 300);
    },
  });
}
function hatchModal(e) {
  modal({
    title: `A ${e.tier} km egg is hatching`,
    top: `<div class="hatch" id="hatchBox">${eggHTML(e.tier, 96, 'wob')}</div>`,
    html: '<p>Something is moving inside.</p>',
    lock: 1,
    btns: [
      {
        l: 'Hatch it',
        c: 'dark',
        f: () => {
          const box = $('#hatchBox');
          const res = hatchEgg(e);
          const m = res.m,
            s = SPECIES[m.sp];
          const done = () => {
            uiState.modal = null;
            modal({
              title: `It’s ${/^[AEIOU]/.test(s.name) ? 'an' : 'a'} ${m.gold ? 'Golden ' : ''}${escapeHtml(s.name)}`,
              top: `<div class="hatch done">${rigCanvasHTML(m.sp, 128, { gold: m.gold, build: m.build })}</div>`,
              html: `<p>${s.types.map(typeBadgeHTML).join('')} <b class="tnum">Lv ${m.lvl}</b></p><p>${escapeHtml(s.blurb)}</p>${res.where === 'box' ? '<p class="note">It went to storage because your team is full.</p>' : ''}`,
              btns: [{ l: 'Welcome aboard', c: 'dark', f: closeModal }],
            });
            render();
          };
          if (reducedMotion || !box) {
            done();
            return;
          }
          box.innerHTML = eggHTML(e.tier, 96, 'shake');
          $$('.sheet .btns button').forEach(b => (b.disabled = true));
          setTimeout(() => {
            box.classList.add('flash');
          }, 1500);
          setTimeout(done, 1900);
        },
      },
    ],
  });
}

/* ---------- screens ---------- */
/* alpha 0.5: the bar holds Walk, Map, Team, Guide and Bag; your Trainer card opens from the portrait in the top bar */
const TABS = ['walk', 'map', 'team', 'ledger', 'bag'],
  SCREENS = [...TABS, 'profile'];
function topbar() {
  rollDay();
  const shut = !!(saveData.preferences && saveData.preferences.cardClosed),
    walk = uiState.tab === 'walk';
  return `<div class="topbar glass" role="status">${walk ? `<button class="tb-where ${shut ? 'shut' : ''}" data-a="card-open" aria-expanded="${!shut}" aria-label="${shut ? 'Show' : 'Hide'} the card for ${escapeHtml(LOCATIONS[saveData.trip.node].name)}">${escapeHtml(uiState.inside && !uiState.bench && typeof roomState === 'function' && roomState() ? uiState.inside.name || LOCATIONS[saveData.trip.node].name : LOCATIONS[saveData.trip.node].name)}${uiIconHTML('chev', 12)}</button>` : `<span class="tb-where">${escapeHtml(LOCATIONS[saveData.trip.node].name)}</span>`}<span class="tb-chip tnum" title="Money">${coinHTML('penny', 16)}<small>$</small><b data-count="tse" data-to="${saveData.se}">${formatNumber(saveData.se)}</b></span><button class="tb-btn" data-a="settings" aria-label="Settings and help">${uiIconHTML('gear', 18)}</button><button class="tb-me" data-a="tab" data-t="profile" aria-label="Your trainer card" ${uiState.tab === 'profile' ? 'aria-current="page"' : ''}>${typeof portraitHTML === 'function' ? portraitHTML('me', 84) : ''}</button>${pbInboxDot(uiState.inbox.length)}</div>`;
}
export function render() {
  const app = $('#app');
  if (uiState.title && typeof renderTitle === 'function') {
    app.innerHTML = renderTitle();
    uiState.lastTab = null;
    updateNav(false);
    document.body.classList.remove('on-map');
    titleMount();
    return;
  }
  if (!saveData.started) {
    if (typeof cutscene !== 'undefined' && cutscene.on) {
      app.innerHTML = '';
      updateNav(false);
      return;
    }
    app.innerHTML = renderIntro();
    uiState.lastTab = null;
    updateNav(false);
    document.body.classList.remove('on-map');
    walkMapSync();
    return;
  }
  if (activeBattle) {
    app.innerHTML = battleShell();
    updateNav(false);
    document.body.classList.remove('on-map');
    walkMapSync();
    return;
  }
  if (!SCREENS.includes(uiState.tab)) uiState.tab = 'walk';
  const T = uiState.tab,
    body =
      T === 'team'
        ? renderTeam()
        : T === 'ledger'
          ? renderGuide()
          : T === 'profile'
            ? renderProfile()
            : T === 'bag'
              ? renderBag()
              : T === 'map'
                ? renderWorldMapTab()
                : renderWalk();
  const enter = uiState.lastTab !== T,
    dir = uiState.lastTab && enter ? (SCREENS.indexOf(T) > SCREENS.indexOf(uiState.lastTab) ? ' fromR' : ' fromL') : '';
  uiState.lastTab = T;
  app.innerHTML = `${topbar()}<main class="screen s-${T}${enter ? ' enter' + dir : ''}">${body}</main>`;
  updateNav(true);
  walkMapSync();
  document.body.classList.toggle('on-map', T === 'map');
  if (T === 'map') worldMapMount();
  pbInboxPop(uiState.inbox.length);
  $$('[data-count]').forEach(el => {
    const k = el.dataset.count,
      to = +el.dataset.to,
      from = uiState.disp[k];
    uiState.disp[k] = to;
    /* phase 06: money earned rises from the money chip instead of a toast */
    if (k === 'tse' && from != null && to > from) pbFloat(el.closest('.tb-chip') || el, '+$' + formatNumber(to - from));
    if (from == null || from === to || reducedMotion) {
      el.textContent = formatNumber(to);
      return;
    }
    const t0 = performance.now(),
      dur = 700;
    const st = () => {
      const q = Math.min(1, (performance.now() - t0) / dur),
        v = from + (to - from) * EASE.out(q);
      el.textContent = formatNumber(v);
      if (q < 1 && el.isConnected) requestAnimationFrame(st);
    };
    st();
  });
}
function updateNav(show) {
  let n = $('#nav');
  const t = [
    ['walk', 'Walk'],
    ['map', 'Map'],
    ['team', 'Team'],
    ['ledger', 'Guide'],
    ['bag', 'Bag'],
  ];
  if (!n) {
    n = document.createElement('nav');
    n.id = 'nav';
    n.setAttribute('aria-label', 'Main');
    n.innerHTML = `<div class="in px glass"><span class="ind"></span>${t.map(([k, l]) => `<button data-a="tab" data-t="${k}">${uiIconHTML(k)}<span>${l}</span></button>`).join('')}</div>`;
    document.body.appendChild(n);
  }
  n.hidden = !show;
  n.querySelector('.ind').style.setProperty('--i', TABS.indexOf(uiState.tab));
  n.querySelectorAll('button').forEach(b => {
    if (b.dataset.t === uiState.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}
/* phase 06-2: before a game starts, only the plain title (when the 3D one can't show) or, if the 3D opening couldn't
   start or broke, a screen to try it again. The old step-by-step intro (stills, Hazel's lines, the trainer step and a
   list of starters) is gone: the opening cutscene is the only way in (docs/phases/06-plan.md "The new opening"). */
function renderIntro() {
  if (uiState.openingFailed)
    return `<div class="title opening-failed"><h1 class="logo">Pocket Billies</h1><p class="tag">The opening scene couldn’t start${uiState.openingFailed === 'stopped' ? ' (it stopped partway)' : ''}. Trying again usually works; if it keeps happening, send the debug log.</p><button class="pb gold wide big" data-a="intro">Try again</button><button class="pb quiet wide" data-a="dbglog">Export debug log</button></div>`;
  return `<div class="title"><div class="title-landscape" aria-hidden="true"></div><div class="title-coin">${coinHTML('penny', 176, 32)}</div><h1 class="logo">Pocket Billies</h1><p class="tag">A walking RPG inside the Hollow Earth, where the Billies are the wildlife. Gotta tax 'em all!</p><button class="pb gold wide big" data-a="intro">Start</button></div>`;
}
const BRACKET_COLORS = ['var(--ok)', 'var(--gold)', 'var(--red)', '#9B6BE0', '#4F80E8'];
function bracketSpans() {
  let lo = 0;
  return STEP_BRACKETS.map(([hi, r], i) => {
    const top = hi === Infinity ? Math.max(lo * 1.33, lo + 5000) : hi,
      o = { lo, hi: top, r, col: BRACKET_COLORS[i % BRACKET_COLORS.length] };
    lo = hi;
    return o;
  });
}
function bracketBars(st) {
  const sp = bracketSpans();
  return sp
    .map(
      b =>
        `<i style="flex:${b.hi - b.lo}"><b style="width:${clamp((st - b.lo) / (b.hi - b.lo), 0, 1) * 100}%;background:${b.col}"></b></i>`
    )
    .join('');
}
function bracketLabels() {
  return bracketSpans()
    .map(
      (b, i) =>
        `<span style="flex:${b.hi - b.lo}">${i === 0 ? `$${b.r} per step` : `$${b.r} after ${formatNumber(b.lo)}`}</span>`
    )
    .join('');
}
function bracketNote(st) {
  const r = stepRate(st),
    nb = nextBracket(st),
    i = STEP_BRACKETS.indexOf(nb);
  if (i === 0) return `Full rate for ${formatNumber(nb[0] - st)} more steps today.`;
  if (nb[0] === Infinity) return 'You’ve walked a lot today. Resting is good too.';
  return `Busy day! Steps now earn $${r} each until ${formatNumber(nb[0])}.`;
}
function encounterCardHTML(q) {
  const nu = !uiState.seenEnc.has(q.id);
  uiState.seenEnc.add(q.id);
  return `<button class="enc px hidden-enc${nu ? ' pop' : ''}" data-a="enc" data-id="${q.id}" aria-label="Unknown Billie, level ${q.lvl}"><span class="no tnum">No. ${q.no}</span><span class="denom tnum">Lv ${q.lvl}</span><span class="stage-glow"></span><span class="enc-hide"><img class="pxi" src="${artURL('scene/props/tallgrass.png')}" alt=""><i>?</i></span><b>Unknown</b></button>`;
}
function stepsTo(j) {
  const t = tripTo(j);
  return t ? t.steps : Infinity;
}
function tripLeft() {
  const r = saveData.trip;
  if (!r.plan.length) return 0;
  let n = roadCost(r.node, r.plan[0]) - r.prog;
  for (let k = 0; k < r.plan.length - 1; k++) n += roadCost(r.plan[k], r.plan[k + 1]);
  return Math.max(0, n);
}
const tripDest = () => (saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null);
/* one line about travel: where you're headed, why you're stopped, or that you're staying */
function tripStatus() {
  const r = saveData.trip,
    d = tripDest(),
    gm = gateMsg();
  if (d == null)
    return { k: 'stay', t: walkMode() ? `In ${LOCATIONS[r.node].name}` : `Staying in ${LOCATIONS[r.node].name}` };
  if (walkMode()) return { k: 'guide', t: `Heading for ${LOCATIONS[d].name}: follow the gold arrows` };
  if (gm) return { k: 'blocked', t: gm };
  if (r.hold) return { k: 'hold', t: `Stopped on the way to ${LOCATIONS[d].name}` };
  const via =
    r.plan.length > 1
      ? ` via ${r.plan
          .slice(0, -1)
          .map(i => LOCATIONS[i].name)
          .join(', ')}`
      : '';
  return { k: 'go', t: `Walking to ${LOCATIONS[d].name}${via}`, left: tripLeft() };
}
function tripButtons() {
  const r = saveData.trip,
    st = tripStatus();
  if (st.k === 'guide')
    return `<button class="pb small" data-a="stoptrip">Stop guiding me</button><button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
  if (st.k === 'stay')
    return `<button class="pb small gold" data-a="tab" data-t="map">${uiIconHTML('map', 16)} Choose where to go</button>`;
  if (st.k === 'hold')
    return `<button class="pb small gold" data-a="resumetrip">Keep walking</button>${r.prog > 0 ? '<button class="pb small" data-a="turnback">Turn back</button>' : ''}<button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
  if (st.k === 'blocked')
    return `<button class="pb small" data-a="tab" data-t="map">${uiIconHTML('map', 16)} Choose another way</button>${r.prog === 0 ? '<button class="pb small quiet" data-a="stay">Stay here</button>' : '<button class="pb small" data-a="turnback">Turn back</button>'}`;
  return `<button class="pb small" data-a="stoptrip">${r.prog > 0 ? 'Stop walking' : 'Stay here instead'}</button><button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
}
function nodeActions(i) {
  const n = LOCATIONS[i],
    node = saveData.trip.node;
  let x = '';
  if (i !== node) return '';
  if (n.shop && SHOPS[n.shop])
    x += `<button class="pb small gold" data-a="shop" data-s="${n.shop}">${uiIconHTML('mint', 16)} ${escapeHtml(SHOPS[n.shop].name)}</button>`;
  if (n.boutique && SHOPS[n.boutique])
    x += `<button class="pb small" data-a="shop" data-s="${n.boutique}">${uiIconHTML('profile', 16)} ${escapeHtml(SHOPS[n.boutique].name)}</button>`;
  x += n.town
    ? '<button class="pb small" data-a="clinic">Rest at the clinic, free</button>'
    : `<button class="pb small quiet" data-a="rest">Rest stop, $${formatNumber(RULES.steps.restCost)}</button>`;
  trainersAt(i).forEach(T => {
    const done = saveData.flags[T.id];
    if (T.blocks && done && !T.seat) return;
    x += `<button class="pb small ${done ? 'quiet' : 'red'}" data-a="trainer" data-t="${T.id}">${done ? 'Rematch' : T.seat ? 'Challenge' : 'Battle'} ${escapeHtml(T.name)}</button>`;
  });
  return `<div class="racts">${x}</div>`;
}
function boardNote(i) {
  if (saveData.trip.node !== i) return '';
  return trainersAt(i)
    .filter(T => T.hint && !saveData.flags[T.id])
    .map(T => `<p class="note">${escapeHtml(T.hint)}</p>`)
    .join('');
}
function hereCard() {
  const node = saveData.trip.node,
    here = LOCATIONS[node],
    st = tripStatus(),
    nx = nextTripNode();
  let prog = '';
  if (st.k === 'go' || st.k === 'hold') {
    const c = roadCost(node, nx),
      f = saveData.trip.prog / c;
    prog = `<div class="nextstop"><div class="ns-top"><span>${escapeHtml(st.t)}</span><b>${escapeHtml(LOCATIONS[nx].name)}</b></div><div class="trail">${progressBarHTML(f, 'trailbar live')}<span class="walker" style="left:${clamp(f, 0, 1) * 100}%">${playerWalkIconHTML()}</span></div><span class="note tnum">${formatNumber(tripLeft())} steps to go</span></div>`;
  } else if (st.k === 'blocked') {
    const bl = blockerAt(node);
    prog =
      bl && saveData.trip.prog === 0
        ? `<div class="event"><b>${escapeHtml(bl.blockTitle || bl.name + ' is blocking the way')}</b><p>${escapeHtml(bl.blockText || 'Beat them to keep walking.')}</p></div>`
        : `<p class="note gate">${escapeHtml(st.t)}</p>`;
  } else
    prog = `<p class="note">You’re staying here. Steps still earn money, hatch eggs and bring encounters. Open the map to pick a place to walk to.</p>`;
  return `<section class="here px glass"><div class="route-art"${here.banner ? ` style="background-image:url('${artURL(here.banner)}')"` : ''}><span>${personHTML('me', 64)}</span><button class="route-profile" data-a="customize">${escapeHtml(cleanTrainer(saveData.avatar, saveData.gender).name)} · Edit look</button></div><div class="sec-h"><div><div class="sub">${escapeHtml(locationSubtitle(here))}</div><h2>${here.name}</h2></div><button class="pb small quiet" data-a="tab" data-t="map">Open map</button></div><p class="note">${here.blurb}</p>${boardNote(node)}${prog}<div class="racts">${tripButtons()}</div>${nodeActions(node)}</section>`;
}
function playerWalkIconHTML() {
  const u = personWalkIconURL('me');
  return `<span class="spr fast ow-mini" style="width:22px;height:40px"><img src="${u}" alt=""></span>`;
}
function eggSlots() {
  const slots = Array.from({ length: eggSlotCount() }, (_, i) => i)
    .map(sl => {
      const e = saveData.eggs.find(x => x.slot === sl);
      if (!e)
        return `<div class="slot px empty"><span class="egg-e"></span><b>Empty incubator</b><span class="note">Win battles to find eggs.</span></div>`;
      const T = EGGS[e.tier];
      return `<div class="slot px">${eggHTML(e.tier, 48, 'wob')}<b>${e.tier} km egg</b>${progressBarHTML(e.prog / T.need, 'live')}<span class="note tnum">${stepsToKm(e.prog)} of ${e.tier} km</span></div>`;
    })
    .join('');
  const pipe = saveData.eggs.filter(e => e.slot == null);
  return `<section><div class="sec-h"><h2>Eggs</h2><span class="count tnum">${saveData.eggs.length}/${RULES.eggs.capacity}</span></div><div class="slots">${slots}</div>${pipe.length ? `<div class="pipe"><span class="note">Waiting for an incubator:</span>${pipe.map(e => eggHTML(e.tier, 26)).join('')}</div>` : ''}</section>`;
}
function buddyCard() {
  const m = findBilly(saveData.buddy);
  if (!m) return '';
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1),
    e = SPECIES[m.sp].evo;
  const ev =
    e && e.k === 'buddy'
      ? `<div class="note">Buddy distance: ${stepsToKm(m.bsteps || 0)} of ${stepsToKm(e.steps)} km to evolve.</div>${progressBarHTML((m.bsteps || 0) / e.steps, 'gold')}`
      : '';
  return `<section><div class="sec-h"><h2>Buddy</h2></div><div class="buddy px" data-a="mon" data-u="${m.uid}" role="button" tabindex="0">${rigCanvasHTML(m.sp, 80, { gold: m.gold, build: m.build })}<div class="bd"><div class="bn">${escapeHtml(billyName(m))} <span class="lv tnum">Lv ${m.lvl}</span></div><div class="note">Earns 1 XP for every ${plural(RULES.progression.buddyStepsPerXp, 'step')}. ${formatNumber(Math.ceil((b - m.xp) * RULES.progression.buddyStepsPerXp))} more steps to level ${m.lvl + 1}.</div>${progressBarHTML((m.xp - a) / (b - a), 'xpb')}${ev}</div></div></section>`;
}
function roomHero() {
  const I = uiState.inside,
    sc = mapById(I.id) || {},
    here = LOCATIONS[saveData.trip.node],
    what =
      {
        shop: 'Tap the counter to shop.',
        clinic: 'Tap the desk and your team is patched up, free.',
        lab: 'Tap the professor or the machine to talk.',
        house: 'Tap whoever lives here to chat.',
        home: 'Your room in Granny Juniper’s cottage. Decorate it with what you’ve found.',
      }[I.kind] || '';
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(here.name), escapeHtml(I.name || sc.name || 'Inside'), `<p class="wh-gate">${escapeHtml(what)}</p>`, (I.kind === 'home' ? `<button class="pb small gold" data-a="decorate">Decorate</button>` : '') + `<button class="pb small" data-a="leaveroom">${uiIconHTML('door', 14)} Go outside</button>`)}
 <div class="wh-foot"><div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button><button class="wh-down glass" data-a="walkdown" aria-label="Show actions">${uiIconHTML('chev', 18)}<span>Actions</span></button><span class="wh-steps glass tnum">${uiIconHTML('walk', 14)} ${formatNumber(saveData.day.steps)}</span></div></div></div>`;
}
/* v31: the place card: compact (where, the hour and weather, staying or walking, one main button; the rest folded
   under More), closable with ×, and brought back by tapping the place's name in the top bar. Closed stays closed. */
function locationCardHTML(sub, name, mid, btns) {
  if (saveData.preferences && saveData.preferences.cardClosed) return '';
  const all = String(btns).match(/<button[\s\S]*?<\/button>/g) || [],
    main = all[0] || '',
    more = all.slice(1).join('');
  return `<div class="wh-card glass compact"><div class="wh-top"><div class="sub">${sub}</div><button class="wh-x" data-a="card-close" aria-label="Hide this card"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div><h1 class="where">${name}</h1>${mid}<div class="wh-acts">${main}${more ? `<details class="wh-more"><summary>More</summary><div class="wh-more-b">${more}</div></details>` : ''}</div></div>`;
}
function environmentLine() {
  if (typeof environmentLabel !== 'function' || !environment.on) return '';
  const t = environmentLabel();
  if (!t) return '';
  const h = environmentHint();
  return `<p class="wh-env">${uiIconHTML(environmentIcon(), 12)} ${escapeHtml(t)}${h ? `<span> · ${escapeHtml(h)}</span>` : ''}</p>`;
}
function walkHero() {
  if (uiState.inside && !uiState.bench && roomState()) return roomHero();
  if (uiState.bench && uiState.bench.test && mapById(uiState.bench.id)) {
    /* v20: a test scene from the debug menu */ const sc = mapById(uiState.bench.id);
    return `<div class="walk-hero" id="walkHero"><div class="wh-card glass">${uiState.bench.id === 'gallery' ? `<div class="sub">Settings</div><h1 class="where">Graphics gallery</h1><p class="wh-gate">Walk to a signpost, then move the dial below and watch what changes.</p>` : `<div class="sub">Test scene</div><h1 class="where">${escapeHtml((sc.name || uiState.bench.id).replace(/^Test: /, ''))}</h1><p class="wh-gate">${(sc.checks || []).length} walking checks. Debug menu → Test scenes runs them.</p>`}<div class="wh-acts"><button class="pb small gold" ${uiState.bench.id === 'gallery' ? 'data-a="gal-leave"' : 'data-a="dbg" data-x="untest"'}>${uiState.bench.id === 'gallery' ? 'Back to Settings' : 'Back to the game'}</button></div></div></div>`;
  }
  const node = saveData.trip.node,
    here = LOCATIONS[node],
    q = saveData.queue,
    st = tripStatus(),
    nx = nextTripNode();
  let next = '';
  if (st.k === 'go')
    next = `<div class="wh-next"><span>${escapeHtml(st.t)}</span><span class="tnum">${formatNumber(st.left)} steps</span>${progressBarHTML(saveData.trip.prog / roadCost(node, nx), 'trailbar live')}</div>`;
  else next = `<p class="wh-gate">${escapeHtml(st.t)}</p>`;
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(locationSubtitle(here)), escapeHtml(here.name), environmentLine() + next, tripButtons())}
 <div class="wh-foot">${q.length ? `<p class="wh-hint glass">${uiIconHTML('spark', 12)} ${plural(q.length, 'Billie')} hiding nearby. Tap a <b>?</b> to battle.</p>` : saveData.trip.prog === 0 ? `<p class="wh-hint glass">${uiIconHTML('walk', 12)} Tap the ground to walk around. Tap buildings, people and signs.</p>` : ''}
  <div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button><button class="pb small glass" data-a="photo" aria-label="Photo mode">${uiIconHTML('camera', 14)}</button><button class="wh-down glass" data-a="walkdown" aria-label="Show actions">${uiIconHTML('chev', 18)}<span>Actions</span></button><span class="wh-steps glass tnum">${uiIconHTML('walk', 14)} ${formatNumber(saveData.day.steps)}</span></div></div></div>`;
}
function renderWalk() {
  rollDay();
  const st = saveData.day.steps,
    r = stepRate(st),
    q = saveData.queue;
  return `${walkHero()}<div class="walk-sheet"><span class="ws-grip" aria-hidden="true"></span>
 <div class="cols"><div class="col">
 <div class="today px glass"><div class="today-top"><div><div class="big tnum" data-count="steps" data-to="${st}">${formatNumber(st)}</div><div class="lbl">steps today</div></div><div class="se"><div class="mid tnum">$<span data-count="se" data-to="${saveData.se}">${formatNumber(saveData.se)}</span></div><div class="lbl">Money</div></div></div>
  <div class="brackets" role="img" aria-label="Earning $${r} per step">${bracketBars(st)}</div><div class="brk-l">${bracketLabels()}</div>
  <p class="note">${bracketNote(st)}</p></div>
 ${walkMode() ? `<section class="walkbtns"><p class="note">Walk with the joystick (drag anywhere on the scene) or tap where you want to go. The arrows at the edges lead on to the next place; the steps you take count here.</p></section>` : ''}
 ${typeof challengeCardHTML === 'function' ? challengeCardHTML() : ''}${typeof requestListHTML === 'function' && requestListHTML() ? `<section class="chal px glass"><div class="sec-h"><h2>Requests you’re helping with</h2></div>${requestListHTML()}</section>` : ''}${hereCard()}</div><div class="col">
 <section class="pending"><div class="sec-h"><h2>Encounters</h2><span class="count tnum">${q.length}/${RULES.steps.maxEncounters}</span></div>
  <p class="note">${q.length >= RULES.steps.maxEncounters ? 'Your area is full. Battle or tax a few to make room.' : `Next one in about ${formatNumber(Math.ceil((RULES.steps.encounterEverySE - saveData.meter) / r))} steps.`} You only see their level until the battle starts.</p>
  ${q.length ? `<div class="queue">${q.map(encounterCardHTML).join('')}</div>` : `<div class="empty px">No Billies nearby. Walk about ${formatNumber(RULES.steps.encounterEverySE)} steps and one will wander over.</div>`}</section>
 ${eggSlots()}${buddyCard()}</div></div></div>`;
}
/* ---------- the walk scene behind the Walk tab ---------- */
export function mapIdAt(i) {
  const S0 = gameData.maps || {},
    r = LOCATIONS[i];
  if (r && r.mapId && S0[r.mapId]) return r.mapId;
  return Object.keys(S0)[0] || null;
}
/* which road leaves a stop's scene through which exit: matched by compass direction on the world map */
/* v42: the join table first (a road names the exit at each end, by id); roads without one fall back to the bearing */
function mapExits(node) {
  const sc = mapById(mapIdAt(node)),
    ex = (sc && sc.exits) || [],
    out = {};
  if (!sc || !ex.length) return out;
  const E = sc.edgeExits || [];
  for (const e of ROADS_BY_NODE[node]) {
    const L = ROADS[e.i],
      J = L && L[3];
    if (!J) continue;
    const id = L[0] === node ? J.a : J.b,
      k = id ? E.findIndex(q => q.id === id) : -1;
    if (k >= 0) out[e.to] = k;
  }
  return mapExitsByBearing(node, sc, ex, out);
}
function mapExitsByBearing(node, sc, ex, out) {
  out = out || {};
  const hub = mapHub(sc),
    me = LOCATIONS[node],
    pairs = [];
  for (const e of ROADS_BY_NODE[node]) {
    if (e.to in out) continue;
    const o = LOCATIONS[e.to],
      a = Math.atan2((o.lat || 0) - (me.lat || 0), (o.lon || 0) - (me.lon || 0));
    ex.forEach((p, k) => {
      let d = Math.abs(a - Math.atan2(p[1] - hub[1], p[0] - hub[0])) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      pairs.push([d, e.to, k]);
    });
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const taken = new Set(Object.values(out));
  for (const [, to, k] of pairs) {
    if (to in out || taken.has(k)) continue;
    out[to] = k;
    taken.add(k);
  }
  for (const [, to, k] of pairs) if (!(to in out)) out[to] = k;
  return out;
}
/* what the walk scene shows: the stop you're at (walk around freely), or you walking out toward the next stop
   (first half of a road) and in from the far end (second half) */
/* v26: walking into shops, the clinic, the lab and houses. uiState.inside remembers the room and where you came in */
const ROOM_BY_USE = { shop: 'int_shop', clinic: 'int_clinic', lab: 'int_lab', house: 'int_house', home: 'int_home' };
/* v46: a building's own room: one set on it in the Studio ("room"), else the room made for its kind of building
   (a bakery, an inn, a bank...), else the room for what it does (shop, clinic, lab, house) */
const ROOM_BY_BUILDING = {
  bakery: 'int_bakery',
  inn: 'int_inn',
  bank: 'int_bank',
  library: 'int_library',
  school: 'int_school',
  fire_station: 'int_fire_station',
  mansion: 'int_mansion',
  barn: 'int_barn',
  greenhouse: 'int_greenhouse',
  ski_lodge: 'int_ski_lodge',
  market_hall: 'int_market_hall',
};
provide({ ROOM_BY_BUILDING }); /* to-module */
function roomFor(a, p) {
  if ((saveData.preferences || {}).rooms === 'quick' && a !== 'home') return null;
  if (a !== 'home' && p) {
    if (p.room && mapById(p.room)) return p.room;
    const M = walkData().sc.props[p.k],
      k = ROOM_BY_BUILDING[p.k] || (M && ROOM_BY_BUILDING[M.group]);
    if (k && mapById(k)) return k;
  }
  const id = ROOM_BY_USE[a];
  return id && mapById(id) ? id : null;
}
function enterRoom(a, p) {
  const id = roomFor(a, p);
  if (!id || !walkView.pl) return false;
  const here = LOCATIONS[saveData.trip.node];
  const info = {
    id,
    kind: a,
    node: saveData.trip.node,
    shop: a === 'shop' ? p.shop || here.shop || null : null,
    p,
    name: p.label || (a === 'shop' && SHOPS[p.shop || here.shop] ? SHOPS[p.shop || here.shop].name : null),
    back: (() => {
      const o = (walkView.sc && walkView.sc.baseOff) || [0, 0];
      return {
        id: (walkView.sc && walkView.sc.baseId) || walkView.id,
        x: walkView.pl.x - o[0],
        z: walkView.pl.z - o[1],
      };
    })(),
  };
  if (id === 'int_home' && typeof refreshHomeFurniture === 'function') refreshHomeFurniture();
  /* v46: the room laid into the place where the building stands: step in once it's ready (a moment at most) */
  const lay = roomLayIn(id, p, true);
  if (lay) {
    Object.assign(info, lay);
    uiState.goingIn = info;
    const P = walkView.pl,
      fr = [lay.door[0], lay.door[1] - 0.45];
    if (Math.hypot(P.x - fr[0], P.z - fr[1]) > 1.6) walkTo(walkablePointNear(fr[0], fr[1]), () => roomStepIn(info));
    else roomStepIn(info);
    return true;
  }
  uiState.inside = info;
  uiState.roam = null;
  if (typeof soundEffect === 'function') soundEffect('door');
  if (typeof debugLog !== 'undefined') debugLog.add('scene', 'inside ' + id);
  render();
  return true;
}
/* v46: seamless rooms (seamless-world.js seamlessRoomMap). The room's view is the place's own view with the room laid in at the
   building's door, so going in and out is a shift of nothing. roomLayIn makes (and starts preparing) that view;
   it is also called when you tap a building, so the room is usually ready by the time you reach the door. */
function roomLayIn(id, p, fresh) {
  if (
    typeof seamlessRoomMap !== 'function' ||
    !seamlessOn() ||
    !walkView.ready ||
    !walkView.sc ||
    !walkView.sc.parts ||
    walkView.sc.roomRect ||
    typeof walkRenderer === 'undefined' ||
    !walkRenderer.on ||
    !walkView.pl ||
    !p
  )
    return null;
  if (engineSetting('world', 'seamlessRooms') === false) return null;
  const C = walkData().sc,
    M = C.props[p.k];
  if (!M || !M.box) return null;
  const s = p.s || 1,
    f = p.f ? -1 : 1,
    dx = (((M.door && M.door.x) || 0) / (C.ppu || 34)) * s * f,
    door = [+(p.x + dx).toFixed(1), +(+p.z).toFixed(1), +(+p.x).toFixed(1)]; /* the door, and the building's middle */
  if (fresh)
    seamlessWorld.cache.delete(
      seamlessRoomId(walkView.id, id, door) + '|' + seamlessWorld.gen
    ); /* the room as it is now (your room's decorations) */
  const sc = seamlessRoomMap(walkView.id, id, door);
  if (!sc) return null;
  seamlessGetReady(sc.id, true, door);
  return { view: sc.id, door, base: walkView.id };
}
/* the room's things changed while you're in it (your room's decorations): lay it in again */
function roomRefresh() {
  const I = uiState.inside;
  if (!I || !I.view || walkView.id !== I.view || !walkView.sc) return;
  seamlessWorld.cache.delete(I.view + '|' + seamlessWorld.gen);
  const n = seamlessRoomMap(I.base, I.id, I.door);
  if (!n) return;
  walkView.sc.props = n.props;
  if (typeof walkRenderer !== 'undefined') walkRenderer.itemGen = (walkRenderer.itemGen || 0) + 1;
  walkView.nav = null;
}
function roomAim(h) {
  if (!h || h.k !== 'act' || !ROOM_BY_USE[h.act] || uiState.inside) return;
  if (typeof isOpenNow === 'function' && !isOpenNow(openingHoursKind(h.act, h.p))) return;
  const id = roomFor(h.act, h.p);
  if (id) roomLayIn(id, h.p);
}
function roomStepIn(info, n = 0) {
  if (uiState.goingIn !== info) return;
  const P = walkView.pl,
    fr = [info.door[0], info.door[1] - 0.45];
  if (!P || walkView.id !== info.base || Math.hypot(P.x - fr[0], P.z - fr[1]) > 2.2) {
    uiState.goingIn = null;
    return;
  } /* you walked off, or the view moved on */
  if (!seamlessGetReady(info.view, true, info.door)) {
    if (typeof walkRenderer !== 'undefined') walkRenderer.prepBoost = Math.max(walkRenderer.prepBoost || 1, 3);
    /* you're standing at the door: bigger slices */ if (n < (uiState.roomWait || 90)) {
      setTimeout(() => roomStepIn(info, n + 1), 100);
      return;
    }
    info.view = null;
    if (typeof debugLog !== 'undefined') debugLog.add('scene', `room ${info.id} wasn't ready in 9 s; shown on its own`);
  }
  uiState.goingIn = null;
  uiState.inside = info;
  uiState.roam = null;
  if (typeof walkRenderer !== 'undefined') walkRenderer.prepBoost = 1;
  if (typeof soundEffect === 'function') soundEffect('door');
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', 'inside ' + (info.view || info.id) + (n ? ` (waited ${n * 100} ms)` : ''));
  render();
  if (info.view)
    setTimeout(() => {
      if (uiState.inside === info && walkView.id === info.view && walkView.pl && walkView.sc)
        walkTo(mapHub(walkView.sc));
    }, 80);
}
export function leaveRoom() {
  const I = uiState.inside;
  if (!I) return;
  uiState.inside = null;
  if (I.view) {
    /* out through the door: you stand in front of it, where you came in */ const P = walkView.pl,
      fr = [I.door[0], I.door[1] - 0.6],
      rv = walkView.id === I.view && walkView.sc && walkView.sc.roomCut;
    if (P && rv) {
      P.x = fr[0] - rv[0];
      P.z = fr[1] - rv[1];
      P.route = null;
      P.goal = null;
      P.dir = 'down';
    }
    const B = mapById(I.base),
      o = (B && B.baseOff) || [0, 0];
    uiState.roam = { id: (B && B.baseId) || I.back.id, node: I.node, x: fr[0] - o[0], z: fr[1] - o[1] };
    uiState.backAt = null;
    if (typeof soundEffect === 'function') soundEffect('door');
    render();
    return;
  }
  uiState.roam = uiState.backAt = { id: I.back.id, node: I.node, x: I.back.x, z: I.back.z };
  if (typeof soundEffect === 'function') soundEffect('door');
  render();
}
function roomAct(h) {
  const I = uiState.inside;
  if (!I) return;
  const pa = h && h.k === 'act' && h.p ? h.p.act : null;
  /* v47: a book or a paper to read (lore.books) */
  if (pa === 'read' && typeof loreBook === 'function') {
    loreBook(h.p.book);
    return;
  }
  if (pa === 'fly' && typeof flyMenu === 'function') {
    flyMenu(h.p);
    return;
  }
  if (pa === 'lift' && typeof rideGlassLift === 'function') {
    rideGlassLift(h.p);
    return;
  }
  /* v46: things in a room that do something of their own: a bed or a bar to rest at, a counter that sells */
  if (pa === 'rest') {
    healAll();
    save();
    render();
    toast((h.p && h.p.say) || 'You rest a while. Your whole team is back to full.');
    return;
  }
  if (pa === 'shop' && I.kind !== 'shop') {
    const here = LOCATIONS[saveData.trip.node],
      id = h.p.shop || here.shop;
    if (id && SHOPS[id]) openShop(id);
    else toast(h.p.say || 'Nothing for sale today.');
    return;
  }
  if (I.kind === 'shop') {
    if (I.shop && SHOPS[I.shop]) openShop(I.shop);
    else toast(I.p.say || 'The shop is closed today.');
  } else if (I.kind === 'clinic') {
    healAll();
    save();
    render();
    toast(I.p.say || 'The clinic patched everyone up. No charge.');
  } else if (I.kind === 'lab' && typeof talkHazel === 'function') talkHazel(I.p);
  else if (I.kind === 'home' && typeof homeDecorate === 'function') homeDecorate();
  else {
    const c = (mapById(I.id) || {}).chat || [];
    toast(c.length ? `“${c[Math.floor(Math.random() * c.length)]}”` : 'They wave hello.');
  }
}
function roomState() {
  const I = uiState.inside;
  if (!I) return null;
  if (I.node !== saveData.trip.node) {
    uiState.inside = null;
    return null;
  }
  if (I.view) {
    const sc = mapById(I.view);
    if (!sc) {
      uiState.inside = null;
      return null;
    }
    const dr = sc.roomDoor || I.door,
      pos = walkView.id === I.view && walkView.pl ? [walkView.pl.x, walkView.pl.z] : [dr[0], dr[1] - 0.45];
    return {
      id: I.view,
      node: saveData.trip.node,
      mode: 'roam',
      pos,
      roam: true,
      who: 'me',
      enc: [],
      npcs: sc.keeper ? [{ who: sc.keeper, id: '_keeper:' + I.id, done: true, exit: null, dir: 'down' }] : [],
      exits: [{ i: 0, to: -1, name: 'Outside', out: 1 }],
    };
  }
  const sc = mapById(I.id);
  if (!sc) {
    uiState.inside = null;
    return null;
  }
  const pos = uiState.roam && uiState.roam.id === I.id ? [uiState.roam.x, uiState.roam.z] : mapHub(sc);
  return {
    id: I.id,
    node: saveData.trip.node,
    mode: 'roam',
    pos,
    roam: true,
    who: 'me',
    enc: [],
    npcs: sc.keeper ? [{ who: sc.keeper, id: '_keeper:' + I.id, done: true, exit: null, dir: 'down' }] : [],
    exits: [{ i: 0, to: -1, name: 'Outside', out: 1 }],
  };
}
function walkState() {
  const rs = !uiState.bench && roomState();
  if (rs) return rs;
  if (uiState.bench && uiState.bench.id && mapById(uiState.bench.id)) {
    const sc = mapById(uiState.bench.id);
    return {
      id: uiState.bench.id,
      node: saveData.trip.node,
      mode: 'roam',
      pos: mapHub(sc),
      roam: true,
      who: 'me',
      enc: [],
      npcs: [],
      exits: [],
    };
  }
  const r = saveData.trip,
    node = r.node,
    nx = walkMode() ? null : nextTripNode(),
    c = nx != null ? roadCost(node, nx) : 0,
    f = nx != null && c ? clamp(r.prog / c, 0, 1) : 0;
  let v; /* alpha 0.4.1: walking yourself, the view is always the place you're in */
  /* v43: a trip is a walk along the road's ground (seamless-world.js): the scene with the road leaving, the road, the far scene with the road arriving */
  const tv =
    nx != null && (r.prog > 0 || !r.hold) && typeof seamlessTripView === 'function'
      ? seamlessTripView(node, nx, f)
      : null;
  if (tv) {
    const base = tv.sc.baseId === mapIdAt(nx) ? nx : node;
    v = { id: tv.id, node: base, mode: 'road', pos: tv.pos, roam: true, road: tv.u };
    if (typeof seamlessPrefetch === 'function') seamlessPrefetch(tv.R, tv.u, tv.fwd, tv);
  } else if (nx != null && r.prog > 0 && f >= 0.5) {
    const id = mapIdAt(nx),
      sc = mapById(id) || {},
      hub = sc.w ? mapHub(sc) : [0, 0],
      k = mapExits(nx)[node];
    v = { id, node: nx, mode: 'path', from: sc.exits && k != null ? sc.exits[k] : hub, to: hub, t: (f - 0.5) / 0.5 };
  } else {
    const id = mapIdAt(node),
      sc = mapById(id) || {},
      hub = sc.w ? mapHub(sc) : [0, 0],
      bk = uiState.backAt,
      pos =
        bk && bk.node === node && bk.id === id
          ? [bk.x, bk.z]
          : uiState.roam && uiState.roam.node === node && uiState.roam.id === id
            ? [uiState.roam.x, uiState.roam.z]
            : hub;
    if (nx != null && r.prog > 0) {
      const k = mapExits(node)[nx];
      v = { id, node, mode: 'path', from: pos, to: sc.exits && k != null ? sc.exits[k] : hub, t: f / 0.5 };
    } else {
      /* v43: near an exit the road leaving it is part of the view (positions are kept in the scene's own metres) */ const wo =
          walkView.ready && walkView.pl && !walkView.pl.fresh ? mapOffsetInView(id) : null,
        live = !!wo,
        lo = wo,
        wv =
          typeof seamlessRoamView === 'function'
            ? seamlessRoamView(node, live ? [walkView.pl.x - lo[0], walkView.pl.z - lo[1]] : pos)
            : null;
      if (wv) {
        const o = wv.sc.baseOff;
        v = { id: wv.id, node, mode: 'roam', pos: [pos[0] + o[0], pos[1] + o[1]], roam: true };
      } else v = { id, node, mode: 'roam', pos, roam: true };
      /* v43: arriving: you stand at the exit the road came in by and walk to the hub; if the road left you outside the scene, you start at that exit */
      if (live && sc.w && uiState.arrive === node) {
        const P = walkView.pl,
          lx = P.x - lo[0],
          lz = P.z - lo[1],
          out = lx < 0 || lz < 0 || lx > sc.w || lz > sc.h;
        uiState.arrive = null;
        if (out && !(walkView.sc && walkView.sc.parts)) {
          /* v46: with the road in view you simply walk in from where you are; the snap is only for a scene shown alone */ const ex =
            (sc.exits || [])
              .slice()
              .sort((a, b) => Math.hypot(a[0] - lx, a[1] - lz) - Math.hypot(b[0] - lx, b[1] - lz))[0];
          if (ex) {
            const q = walkablePointNear(ex[0] + lo[0], ex[1] + lo[1]);
            P.x = q[0];
            P.z = q[1];
          }
        }
        const r = findPath(P.x, P.z, hub[0] + lo[0], hub[1] + lo[1]);
        if (r) {
          P.route = r;
          P.ri = 1;
          P.goal = null;
          /* v46: far out on the road: hurry in */ const far = Math.hypot(hub[0] + lo[0] - P.x, hub[1] + lo[1] - P.z);
          P.rush = far > 14 ? Math.min(3, far / 14) : 1;
        }
      }
    }
  }
  /* v46: a new view is shown only once its ground is ready on the card; until then you stay in the one on screen (seamless-world.js seamlessGate) */
  if (typeof seamlessGate === 'function' && v && v.pos && (v.mode === 'road' || v.roam)) v = seamlessGate(v);
  const sc = mapById(v.id) || {},
    ex = mapExits(v.node),
    bl = blockerAt(v.node),
    dest = v.node === node ? (walkMode() ? (saveData.trip.plan[0] ?? null) : nextTripNode()) : null;
  v.exits = ROADS_BY_NODE[v.node]
    .map(e => ({
      i: ex[e.to],
      to: e.to,
      name: LOCATIONS[e.to].name,
      dest: e.to === dest,
      locked: !canEnter(e.to) || (!!bl && !saveData.visited[e.to]),
    }))
    .filter(e => e.i != null);
  v.npcs = trainersAt(v.node)
    .filter(T => !(T.blocks && saveData.flags[T.id] && !T.seat))
    .map(T => {
      let exit = null;
      if (T.blocks && !saveData.flags[T.id]) {
        const e = v.exits.find(e => !saveData.visited[e.to]);
        if (e && sc.exits) exit = sc.exits[e.i];
      }
      return { who: T.who, id: T.id, done: !!saveData.flags[T.id], exit, dir: 'down' };
    });
  /* alpha 0.4: people who only talk (Granny Juniper in her garden): the place's own (scene.people), in the view's metres */
  {
    const bid = sc.baseId || v.id,
      base = mapById(bid),
      o = sc.baseOff || [0, 0];
    if (base && bid === mapIdAt(v.node))
      for (const P of base.people || [])
        if (PEOPLE[P.who])
          v.npcs.push({
            who: P.who,
            id: '_talk:' + P.id,
            talk: P,
            done: true,
            exit: null,
            dir: P.dir || 'down',
            at: [P.x + o[0], P.z + o[1]],
          });
  }
  v.who = 'me';
  v.enc = saveData.queue.map(q => ({
    id: q.id,
    lvl: q.lvl,
    sp: q.sp,
    gold: q.gold,
    alpha: !!q.alpha,
    build: encounterBuild(q),
  }));
  return v;
}
export function walkPick(h) {
  const node = saveData.trip.node,
    here = LOCATIONS[node];
  if (uiState.inside) {
    if (h.k === 'exit') {
      leaveRoom();
      return;
    }
    if ((h.k === 'npc' && h.n && String(h.n.id).startsWith('_keeper')) || h.k === 'act') {
      roomAct(h);
      return;
    }
  }
  if (h.k === 'enc') {
    const q = saveData.queue.find(x => x.id === h.e.id);
    if (q) {
      uiState.encAt = h.look || null;
      startWild(q);
    }
  } else if (h.k === 'npc') {
    if (h.n && h.n.talk && typeof personTalk === 'function') {
      personTalk(h.n.talk);
      return;
    }
    trainerTalk(h.n.id);
  } else if (h.k === 'act') {
    const p = h.p,
      a = h.act;
    if (a === 'climb' && typeof startClimb === 'function') {
      startClimb(p);
      return;
    }
    /* alpha 0.4: an airship mast (or a sky lift, or the terminal's ticket window): fly to a town you've been to */
    if (a === 'fly' && typeof flyMenu === 'function') {
      flyMenu(p);
      return;
    }
    if (a === 'lift' && typeof rideGlassLift === 'function') {
      rideGlassLift(p);
      return;
    }
    /* v47: shops and the like keep opening hours */
    if (typeof isOpenNow === 'function') {
      const kind = openingHoursKind(a, p);
      if (!isOpenNow(kind)) {
        toast(closedText(kind));
        return;
      }
    }
    if (ROOM_BY_USE[a] && enterRoom(a, p)) return;
    if (a === 'shop') {
      const id = p.shop || here.shop;
      if (id && SHOPS[id]) openShop(id);
      else toast(p.say || 'The shop is closed today.');
    } else if (a === 'clinic') {
      healAll();
      save();
      render();
      toast(p.say || 'The clinic patched everyone up. No charge.');
    } else if (a === 'lab' && typeof talkHazel === 'function') talkHazel(p);
    else if (a === 'read' && typeof loreBook === 'function') loreBook(p.book);
    else
      toast(
        p.say ||
          { lab: 'The lab is busy with research.', house: 'Nobody answers the door.', sign: `You’re in ${here.name}.` }[
            a
          ] ||
          'Nothing happens.'
      );
  } else if (h.k === 'exit') exitPrompt(h.e);
  else if (h.k === 'ground') {
    const st = tripStatus();
    if (Date.now() - (uiState.groundTip || 0) > 6000) {
      uiState.groundTip = Date.now();
      toast(
        st.k === 'go'
          ? `You’re on your way to ${LOCATIONS[tripDest()].name}. Tap “Stop walking” to look around.`
          : st.k === 'hold'
            ? 'You’re between stops. Keep walking or turn back.'
            : 'Tap the ground to walk there.'
      );
    }
  }
}
function exitPrompt(e) {
  const to = e.to,
    o = LOCATIONS[to];
  if (!canEnter(to)) {
    toast(gateText(o));
    return;
  }
  if (e.locked) {
    const bl = blockerAt(saveData.trip.node);
    toast(bl ? `${bl.name} is blocking the way. Beat them first.` : 'That road is closed.');
    return;
  }
  /* alpha 0.4.1: walking yourself: tapping the way out walks you out of the place and on into the next */
  if (walkMode()) {
    const sc = walkView.sc,
      pt = sc && sc.exits && sc.exits[e.i];
    if (!pt || !walkView.pl) return;
    const hub = mapHub(sc),
      dx = pt[0] - hub[0],
      dz = pt[1] - hub[1],
      l = Math.hypot(dx, dz) || 1;
    walkTo(walkablePointNear(pt[0] + (dx / l) * 3.5, pt[1] + (dz / l) * 3.5));
    return;
  }
  if (tripDest() === to) {
    toast(`You’re already heading to ${o.name}. Steps will carry you there.`);
    return;
  }
  const t = tripTo(to);
  if (!t) {
    toast('There’s no open road there yet.');
    return;
  }
  modal({
    title: `Walk to ${escapeHtml(o.name)}?`,
    html: `<p class="note">${escapeHtml(o.blurb || '')}</p><p><b class="tnum">${formatNumber(t.steps)} steps</b> · about ${stepsToKm(t.steps)} km${saveData.visited[to] ? '' : ' · somewhere new'}</p>${poolStrip(o.pool)}<p class="note">Your real steps walk you there. You can stop or change plans any time.</p>`,
    btns: [
      {
        l: `${uiIconHTML('walk', 16)} Start walking`,
        c: 'gold',
        f: () => {
          closeModal();
          if (setTrip(to)) {
            const T = tripStatus();
            toast(T.k === 'go' ? `${T.t}. ${formatNumber(T.left)} steps.` : T.t);
            render();
          }
        },
      },
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}
setInterval(() => {
  try {
    if (typeof storyCheck === 'function') storyCheck();
    if (typeof legendCheck === 'function') legendCheck();
    if (typeof storyMovedCheck === 'function') storyMovedCheck();
    if (typeof postcardCheck === 'function') postcardCheck();
  } catch (e) {
    console.error(e);
  }
}, 1500);
/* alpha 0.4.1: walking yourself, from one place into the next. The view holds a place and the edges of its neighbours;
   once you are a metre into a neighbour, that place is where you are (its view takes over without a cut). A closed way
   (a gate you haven't the badge for, a trainer blocking the road) turns you back at the edge. */
/* 0.5: where a place's own ground sits in the view on screen (the view may be a neighbour's, holding this place as a part) */
function mapOffsetInView(id) {
  const sc = walkView.sc;
  if (!sc || !id) return null;
  if ((sc.baseId || walkView.id) === id) return sc.baseOff || [0, 0];
  const q = (sc.parts || []).find(q => q.id === id);
  return q ? [q.ox || 0, q.oz || 0] : null;
}
function walkCross() {
  if (
    !walkMode() ||
    !saveData.started ||
    !walkView.ready ||
    !walkView.sc ||
    !walkView.pl ||
    uiState.inside ||
    uiState.bench ||
    (typeof activeBattle !== 'undefined' && activeBattle) ||
    (typeof cutscene !== 'undefined' && cutscene.on)
  )
    return;
  const sc = walkView.sc,
    P = walkView.pl,
    node = saveData.trip.node,
    parts = sc.parts;
  if (!parts) return;
  for (const q of parts) {
    const s = mapById(q.id);
    if (!s || s.kind === 'room') continue;
    const x = P.x - (q.ox || 0),
      z = P.z - (q.oz || 0);
    if (x < 0 || z < 0 || x > s.w || z > s.h) continue;
    const n = LOCATIONS.findIndex(r => r.mapId === q.id);
    if (n < 0 || n === node) {
      uiState.walkOk = [P.x, P.z, walkView.id];
      return;
    }
    if (Math.min(x, z, s.w - x, s.h - z) < 1 || !ROADS_BY_NODE[node].some(e => e.to === n)) return;
    const bl = blockerAt(node),
      why = !canEnter(n)
        ? gateText(LOCATIONS[n])
        : bl && !saveData.visited[n]
          ? `${bl.name} is blocking the way. Beat them first.`
          : null;
    if (why) {
      const w = uiState.walkOk;
      if (w && w[2] === walkView.id) {
        P.x = w[0];
        P.z = w[1];
      }
      P.route = null;
      P.goal = null;
      if (Date.now() - (uiState.walkBounceT || 0) > 3500) {
        uiState.walkBounceT = Date.now();
        toast(why);
      }
      return;
    }
    const r = saveData.trip,
      plan = r.plan && r.plan[0] === n ? r.plan.slice(1) : [];
    saveData.trip = { node: n, prog: 0, plan, hold: false };
    saveData.visited[n] = 1;
    uiState.roam = { id: q.id, node: n, x, z };
    uiState.arrive = null;
    uiState.backAt = null;
    if (typeof debugLog !== 'undefined') debugLog.add('travel', 'walked into ' + LOCATIONS[n].name);
    save();
    render();
    return;
  }
}
/* alpha 0.4.1: a view that was held until it was ready (seamless-world.js seamlessGate) takes over as soon as it is: walking yourself,
   nothing else would ask for it (a trip did, with each batch of steps) */
setInterval(() => {
  try {
    if (
      !saveData.started ||
      uiState.tab !== 'walk' ||
      (typeof activeBattle !== 'undefined' && activeBattle) ||
      (typeof cutscene !== 'undefined' && cutscene.on) ||
      typeof walkView === 'undefined' ||
      !walkView.ready ||
      !walkView.cv
    )
      return;
    const v = walkState();
    if (v && v.id && v.id !== walkView.id && !v.held) walkMapSync();
  } catch (e) {}
}, 400);
function walkMapSync() {
  if (typeof cutscene !== 'undefined' && cutscene.on) return;
  /* in a battle the scene keeps running inside the battle stage (battle-3d.js) when it can; otherwise it stops */
  if (activeBattle) {
    document.body.classList.remove('on-walk', 'on-scene');
    if (walkView.battle) {
      const cv = walkView.cv,
        host = $('#camWorld');
      if (cv && !cv.isConnected && host) {
        host.insertBefore(cv, host.firstChild);
        if (typeof battle3dLayout === 'function') battle3dLayout();
      }
      return;
    }
    if (typeof battle3dWanted === 'function' && battle3dWanted()) return;
    const cv = $('#dio');
    if (cv) cv.hidden = true;
    if (walkView.cv) stopWalkView();
    return;
  }
  const on = saveData.started && uiState.tab !== 'map' && !!mapIdAt(saveData.trip.node),
    walk = on && uiState.tab === 'walk';
  let cv = $('#dio');
  document.body.classList.toggle('on-walk', walk);
  document.body.classList.toggle('on-scene', on && !walk);
  if (!on) {
    if (walkView.cv) stopWalkView();
    if (uiState.tab === 'map' && saveData.started && typeof worldMapGlWanted === 'function' && worldMapGlWanted()) {
      if (cv) {
        cv.hidden = false;
        cv.classList.add('in');
      }
      return;
    }
    if (cv) cv.hidden = true;
    return;
  }
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    cv.setAttribute(
      'aria-label',
      'Your surroundings. Tap the ground to walk, tap people and buildings to visit, tap a question mark to battle.'
    );
    document.body.prepend(cv);
  }
  cv.hidden = false;
  const ws = walkState(),
    id = ws.id;
  if (walkView.id !== id && walkView.cv && walkView.ready && typeof seamlessDelta === 'function') {
    const d = seamlessDelta(walkView.id, id);
    /* alpha 0.2: neighbouring places share their edges, so most views share a part; a walk carries on into the next view,
     a jump somewhere else (not where you are walking to) opens it fresh */
    const walking =
      !d ||
      ws.mode === 'road' ||
      !ws.pos ||
      !walkView.pl ||
      Math.hypot(walkView.pl.x + d[0] - ws.pos[0], walkView.pl.z + d[1] - ws.pos[1]) < 25;
    if (d && walking && shiftWalkView(id, d[0], d[1])) {
      artLoad(mapArtPaths(walkView.sc)).catch(() => {});
      return;
    }
  }
  if (walkView.id !== id || !walkView.cv) {
    if (walkView.id && walkView.id !== id) {
      cv.classList.remove('in');
      void cv.offsetWidth;
    }
    mountWalkView(cv, id, {
      state: walkState,
      onPick: walkPick,
      onAim: roomAim,
      onMove: (x, z) => {
        if (typeof walkCross === 'function') walkCross();
        /* after leaving a room you stand at its door: nothing in between moves that */ if (
          !uiState.inside &&
          /^int_/.test(walkView.id || '')
        )
          return;
        const sid = mapIdAt(saveData.trip.node),
          po = mapOffsetInView(sid),
          o = po || (walkView.sc && walkView.sc.baseOff) || [0, 0],
          bk = uiState.backAt;
        if (bk) {
          if (
            mapOffsetInView(bk.id) &&
            Math.hypot(x - mapOffsetInView(bk.id)[0] - bk.x, z - mapOffsetInView(bk.id)[1] - bk.z) < 0.6
          )
            uiState.backAt = null;
          else return;
        }
        uiState.roam = {
          id: po ? sid : (walkView.sc && walkView.sc.baseId) || walkView.id,
          node: saveData.trip.node,
          x: x - o[0],
          z: z - o[1],
        };
      },
      keys: () => !uiState.modal && uiState.tab === 'walk' && scrollY < innerHeight * 0.3,
      active: () => uiState.tab === 'walk' && !uiState.modal,
      safe: () => {
        const a = $('.wh-card'),
          b = $('.wh-foot'),
          H = innerHeight;
        return [
          a ? clamp(a.getBoundingClientRect().bottom / H, 0, 0.5) : 0.1,
          b ? clamp(b.getBoundingClientRect().top / H, 0.5, 1) : 0.88,
        ];
      },
      cap: () => {
        const w = document.hidden
          ? 'hidden'
          : walkView.battle
            ? ''
            : uiState.modal
              ? 'window'
              : uiState.tab !== 'walk'
                ? 'screen'
                : scrollY > innerHeight * 0.7
                  ? 'scrolled'
                  : '';
        walkView.held = w;
        return w === 'hidden' ? 1 : w === 'window' ? 10 : w === 'screen' ? 24 : w === 'scrolled' ? 4 : userFps();
      },
    }).then(() => cv.classList.add('in'));
  }
}
function renderWorldMapTab() {
  return `<div class="map-full"><canvas id="mapcv" width="${worldMapWidth}" height="${worldMapHeight}" aria-label="World map. Drag to look around, tap a place."></canvas><div id="maplabels"></div>
 <div class="map-head glass"><div class="sub">The Hollow Earth</div><h1 class="where">World map</h1><p class="map-trip ${tripStatus().k}">${escapeHtml(tripStatus().t)}</p></div>
 <div class="mapctl"><button class="mbtn" data-a="mzoom" data-k="in" aria-label="Zoom in">+</button><button class="mbtn" data-a="mzoom" data-k="out" aria-label="Zoom out">−</button><button class="mbtn" data-a="mreset" aria-label="Back to you">${uiIconHTML('walk', 16)}</button></div>
 <div class="mapcard px glass" id="mapcard">${worldMapCardHTML()}</div></div>`;
}
function poolStrip(pool) {
  const P = POOLS[pool];
  if (!P) return '';
  return `<div class="poolstrip">${P.list.map(([id]) => (saveData.seen[id] ? rigCanvasHTML(id, 36) : rigCanvasHTML(id, 36, { sil: 1, still: 1 }))).join('')}</div>`;
}
function worldMapCardHTML() {
  const sel = uiState.mapSel == null ? saveData.trip.node : uiState.mapSel;
  if (typeof sel === 'string') {
    const f = REGIONS[+sel.slice(1)];
    return `<div class="mc-top"><h2>${escapeHtml(f.name)}</h2><span class="sub">${f.t === 'sun' ? 'Center of the world' : 'Unexplored'}</span></div><p>${escapeHtml(f.blurb || '')}</p><p class="note">${f.t === 'sun' ? 'Visible from everywhere in the Hollow Earth.' : 'No trainer from Marigold Town has walked this far yet. The road opens in a later version.'}</p>`;
  }
  const n = LOCATIONS[sel],
    node = saveData.trip.node,
    dest = tripDest(),
    st = tripStatus(),
    here = sel === node;
  let status = '',
    btns = '';
  if (here) {
    status = st.k === 'stay' ? 'You are here.' : st.t + '.';
    btns = st.k === 'stay' ? '' : tripButtons();
  } else if (sel === dest) {
    status = `${st.t}. ${formatNumber(tripLeft())} steps to go.`;
    btns = tripButtons();
  } else {
    const t = tripTo(sel),
      locked = !canEnter(sel);
    if (locked) status = 'Locked. ' + gateText(n);
    else if (!t) status = 'You can’t get there from here yet.';
    else {
      status = `${formatNumber(t.steps)} steps · about ${stepsToKm(t.steps)} km${
        t.plan.length > 1
          ? ` · via ${t.plan
              .slice(0, -1)
              .map(i => escapeHtml(LOCATIONS[i].name))
              .join(', ')}`
          : ''
      }${saveData.visited[sel] ? '' : ' · new place'}.`;
      btns = `<button class="pb small gold" data-a="travel" data-n="${sel}">${uiIconHTML('walk', 16)} Travel here</button>`;
    }
  }
  const nb = ROADS_BY_NODE[sel].map(e => LOCATIONS[e.to].name);
  return `<div class="mc-top"><h2>${escapeHtml(n.name)}</h2><span class="sub">${escapeHtml(locationSubtitle(n))}</span></div><p class="note">${escapeHtml(n.blurb || '')}</p>${n.ride && canRide() ? `<p class="note ride">${uiIconHTML('drop', 14)} You ride across on ${escapeHtml(riderName())}.</p>` : ''}<p class="status">${status}</p>${btns ? `<div class="racts">${btns}</div>` : ''}${poolStrip(n.pool)}<p class="note mc-nb">Roads to ${nb.map(escapeHtml).join(', ')}.</p>${nodeActions(sel)}`;
}
function paintWorldMapCard() {
  const c = $('#mapcard');
  if (c) c.innerHTML = worldMapCardHTML();
}
/* ---------- team: the lead up top, the party as cards, day jobs, then storage ---------- */
export const plateVars = m => {
  const t = SPECIES[m.sp].types;
  return `--c1:${TYPE_COLORS[t[0]][0]};--c2:${TYPE_COLORS[t[t.length - 1]][0]}`;
};
const billyConditionHTML = m => (m.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : statusBadgeHTML(m.status));
const xpProgress = m => {
  if (m.lvl >= maxLevel()) return 1;
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return clamp((m.xp - a) / (b - a), 0, 1);
};
const xpLeft = m => (m.lvl >= maxLevel() ? 'Max level' : `${formatNumber(xpFor(m.lvl + 1) - m.xp)} to Lv ${m.lvl + 1}`);
export const needsCare = m => m.hp < maxHp(m) || !!m.status;
const meter = (k, inner, v) => `<div class="tm-meter"><span>${k}</span>${inner}<b class="tnum">${v}</b></div>`;
function jobSlots() {
  const open = saveData.jobs.map((j, i) => (j.uid ? -1 : i)).filter(i => i >= 0);
  return `<div class="jobs">${saveData.jobs
    .map((j, i) => {
      if (!j.uid)
        return i !== open[0]
          ? ''
          : `<div class="job empty"><span class="job-ic">${uiIconHTML('bag', 20)}</span><div class="jt"><b>${open.length === 1 ? '1 open job' : `${open.length} open jobs`}</b><span class="note">Each pays out every ${formatNumber(JOB_STEPS)} steps.</span></div><button class="pb small" data-a="hire" data-s="${i}">Hire</button></div>`;
      const m = findBilly(j.uid),
        J = JOBS[j.job];
      if (!m) return '';
      return `<div class="job"><button class="job-spr" data-a="mon" data-u="${m.uid}" style="${plateVars(m)}" aria-label="${escapeHtml(billyName(m))}, details">${rigCanvasHTML(m.sp, 48, { gold: m.gold, build: m.build })}</button><div class="jt"><b>${escapeHtml(billyName(m))}</b><span class="note">${escapeHtml(J.n)}, ${escapeHtml(J.where)}. Earns ${escapeHtml(J.pay)}.</span>${progressBarHTML(j.acc / JOB_STEPS, 'gold live')}<span class="note tnum">${formatNumber(JOB_STEPS - j.acc)} steps to the next pay${j.pend ? `, ${j.pend} ready` : ''}</span>
  <div class="racts"><button class="pb small ${j.pend ? 'gold' : ''}" data-a="collect" data-s="${i}" ${j.pend ? '' : 'disabled'}>Collect pay${j.pend ? ` (${j.pend})` : ''}</button><button class="pb small quiet" data-a="endshift" data-s="${i}">End shift</button></div></div></div>`;
    })
    .join('')}</div>`;
}
const BOX_SORTS = [
  ['new', 'Newest'],
  ['lvl', 'Level'],
  ['name', 'Name'],
];
function boxSection() {
  const all = saveData.box.filter(m => m.job == null),
    so = uiState.boxSort || 'new',
    types = [...new Set(all.flatMap(m => SPECIES[m.sp].types))].sort();
  let f = uiState.boxF || 'all';
  if (f !== 'all' && !types.includes(f)) f = 'all';
  let L = all.filter(m => f === 'all' || SPECIES[m.sp].types.includes(f));
  L =
    so === 'lvl'
      ? L.slice().sort((a, b) => b.lvl - a.lvl)
      : so === 'name'
        ? L.slice().sort((a, b) => billyName(a).localeCompare(billyName(b)))
        : L.slice().reverse();
  const full = saveData.team.length >= teamSize();
  const tools =
    all.length > 3
      ? `<div class="fchips tm-tools" role="group" aria-label="Sort and filter storage">${BOX_SORTS.map(([k, l]) => `<button class="fchip${so === k ? ' on' : ''}" data-a="boxsort" data-k="${k}" aria-pressed="${so === k}">${l}</button>`).join('')}${types.length > 1 ? `<span class="tm-sep" aria-hidden="true"></span><button class="fchip${f === 'all' ? ' on' : ''}" data-a="boxf" data-f="all" aria-pressed="${f === 'all'}">All types</button>${types.map(t => `<button class="fchip tdot${f === t ? ' on' : ''}" data-a="boxf" data-f="${t}" style="--tc:${TYPE_COLORS[t][0]}" aria-pressed="${f === t}"><i></i>${t === 'None' ? 'Normal' : t}</button>`).join('')}` : ''}</div>`
      : '';
  return `<section class="tpanel tm-box"><div class="sec-h"><h2>Storage</h2><span class="count tnum">${all.length}</span></div>${
    all.length
      ? `<p class="note">Billies resting here don’t battle. Tap one for details.</p>${tools}
 <div class="bx-grid">${L.map(m => `<div class="bx"><button class="bx-main" data-a="mon" data-u="${m.uid}"><span class="bx-spr" style="${plateVars(m)}">${rigCanvasHTML(m.sp, 60, { gold: m.gold, build: m.build })}</span><b>${escapeHtml(billyName(m))}</b><span class="bx-sub tnum">Lv ${m.lvl}<span class="bx-dots">${SPECIES[m.sp].types.map(t => `<i style="--tc:${TYPE_COLORS[t][0]}" title="${t}"></i>`).join('')}</span></span></button><button class="qk" data-a="mteam" data-u="${m.uid}">${full ? 'Swap in' : 'To team'}</button></div>`).join('')}</div>`
      : '<div class="empty tm-empty">Storage is empty. When your team is full, new Billies you tax and hatchlings rest here.</div>'
  }</section>`;
}
function renderTeam() {
  const lead = saveData.team[0],
    rest = saveData.team.slice(1),
    free = saveData.box.filter(m => m.job == null).length,
    open = Math.max(0, teamSize() - saveData.team.length),
    work = saveData.jobs.filter(j => j.uid).length;
  /* phase 06-2: the lead big, the rest as roomy rows (js/unit-card.js), the open spots last */
  const slots = open
    ? unitOpenRowHTML(
        open,
        free ? 'Bring someone back from storage.' : 'Tax more in the grass, or hatch an egg.',
        free ? '<button class="pb small" data-a="tmadd">Add</button>' : ''
      )
    : '';
  return `<header class="bar"><div><div class="sub">${saveData.team.length} of ${teamSize()} on your team</div><h1 class="where">Your team</h1></div></header>
 <div class="u-team">${lead ? unitHeroHTML(billyUnit(lead)) : ''}${rest.length || slots ? `<div class="u-list" aria-label="Party">${rest.map((m, i) => unitRowHTML(billyUnit(m), i)).join('')}${slots}</div>` : ''}<p class="u-hint">Your lead goes first in battle. Tap anyone for details.</p></div>
 <section class="tpanel tm-jobs"><div class="sec-h"><h2>Day jobs</h2><span class="count tnum">${work}/${saveData.jobs.length}</span></div><p class="note">Billies at work leave your team and earn pay while you walk.</p>${jobSlots()}</section>
 ${boxSection()}`;
}
const RARITY_NAMES = { starter: 'Starter', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythical: 'Mythical' };
const TRACKS = {
  biped: 'Two neat footprints, evenly spaced',
  quad: 'Four tidy paw prints',
  flyer: 'None. Prefers not to touch the ground',
  fish: 'None. Floats at shoulder height',
  serpent: 'A single elegant S',
  worm: 'Small, many, polite',
  octo: 'Eight wet circles',
  blob: 'A glossy puddle',
  shell: 'A slow, shiny trail',
};
function dexStatus(id) {
  return saveData.caught[id] ? 'got' : saveData.seen[id] ? 'seen' : 'none';
}
function guideTabs() {
  const t = uiState.guideTab || 'dex';
  return `<div class="seg guide-tabs">${[
    ['dex', 'Billies'],
    ['lore', 'Lore'],
    ['cards', 'Postcards'],
  ]
    .map(([k, n]) => `<button class="${k === t ? 'on' : ''}" data-a="guidetab" data-k="${k}">${n}</button>`)
    .join('')}</div>`;
}
function renderGuide() {
  if (uiState.dex && SPECIES[uiState.dex] && saveData.seen[uiState.dex]) return renderDexEntry(uiState.dex);
  if (uiState.guideTab === 'cards' && typeof renderPostcards === 'function')
    return `<header class="bar"><div><div class="sub">Greetings from every town you’ve walked into</div><h1 class="where">Postcards</h1></div></header>${guideTabs()}${renderPostcards()}`;
  if (uiState.guideTab === 'lore' && typeof renderLore === 'function')
    return `<header class="bar"><div><div class="sub">The world, the story, the people</div><h1 class="where">Lore</h1></div></header>${guideTabs()}${renderLore()}`;
  const seen = DEX_ORDER.filter(id => saveData.seen[id]).length,
    got = DEX_ORDER.filter(id => saveData.caught[id]).length,
    f = uiState.dexF || 'all';
  const list = DEX_ORDER.filter(id => {
    const st = dexStatus(id);
    if (f === 'got') return st === 'got';
    if (f === 'miss') return st !== 'got';
    if (TYPES.includes(f)) return saveData.seen[id] && SPECIES[id].types.includes(f);
    return true;
  });
  const chips =
    [
      ['all', 'All'],
      ['got', 'Taxed'],
      ['miss', 'Missing'],
    ]
      .map(([k, l]) => `<button class="fchip${f === k ? ' on' : ''}" data-a="dexf" data-f="${k}">${l}</button>`)
      .join('') +
    TYPES.map(
      t =>
        `<button class="fchip tdot${f === t ? ' on' : ''}" data-a="dexf" data-f="${t}" style="--tc:${TYPE_COLORS[t][0]}" aria-label="${t}"><i></i>${t}</button>`
    ).join('');
  return `<header class="bar"><div><div class="sub">Professor Hazel’s records</div><h1 class="where">Field Guide</h1></div></header>${guideTabs()}
 <section class="ledsum paper px"><div class="ls-row"><div><span class="ls-k">Seen</span><b class="tnum">${seen}</b></div><div><span class="ls-k">Taxed</span><b class="tnum">${got}</b></div><div><span class="ls-k">Total</span><b class="tnum">${DEX_ORDER.length}</b></div></div>${progressBarHTML(got / DEX_ORDER.length, 'gold')}<p class="hand">Keep walking. They are out there.</p></section>
 <div class="fchips">${chips}</div>
 <ol class="ledger paper px">${
   list
     .map(id => {
       const s = SPECIES[id],
         st = dexStatus(id),
         sn = st !== 'none';
       return `<li><button class="lrow ${st}" data-a="dex" data-s="${id}" aria-label="${sn ? s.name : 'Unknown'}, number ${s.no}"><span class="lno tnum">${String(s.no).padStart(3, '0')}</span><span class="lspr">${sn ? bustHTML(id, 46) : bustHTML(id, 46, { sil: 1, still: 1 })}</span><span class="ltx"><b>${sn ? escapeHtml(s.name) : 'Unknown'}</b><small>${sn ? escapeHtml(s.cat) : '—'}</small></span><span class="ltypes">${sn ? s.types.map(t => `<i style="--tc:${TYPE_COLORS[t][0]}" title="${t}"></i>`).join('') : ''}</span><span class="lst">${st === 'got' ? `<img class="pxi" src="${coinURL('penny')}" width="18" height="18" alt="Taxed">` : st === 'seen' ? '<em>seen</em>' : ''}</span></button></li>`;
     })
     .join('') || '<li class="lempty">No entries match.</li>'
 }</ol>`;
}
function evolutionMethod(e) {
  if (!e) return '';
  switch (e.k) {
    case 'lvl':
      return `Lv ${e.at}`;
    case 'split':
      return `Lv ${e.at}, Build or Hype`;
    case 'buddy':
      return `Walk ${stepsToKm(e.steps)} km as buddy`;
    case 'item':
      return `${evolutionItemName(e)} at Lv ${e.min}`;
    case 'donate':
      return `Give away ${e.n} items`;
    case 'merge':
      return 'Combine two';
    case 'rename':
      return `Nickname at Lv ${e.min}`;
    case 'idle':
      return 'One idle day';
    case 'streak':
      return `${e.n}-day walk streak`;
  }
  return '';
}
function renderDexEntry(id) {
  const s = SPECIES[id],
    got = !!saveData.caught[id],
    L = LINE_BY_ID[s.line],
    D = (RIGS[id] && RIGS[id].front) || {},
    idx = DEX_ORDER.indexOf(id);
  const seenList = DEX_ORDER.filter(x => saveData.seen[x]),
    si = seenList.indexOf(id),
    prev = seenList[si - 1],
    next = seenList[si + 1];
  const where = [
    ...new Set(
      Object.keys(POOLS)
        .filter(p => POOLS[p].list.some(([x]) => x === id))
        .map(p => LOCATIONS.find(r => r.pool === p))
        .filter(Boolean)
        .map(r => r.name)
    ),
  ];
  const eggs = Object.keys(EGGS)
    .filter(k => EGGS[k].list.some(([x]) => x === id))
    .map(k => k + ' km egg');
  const strong = TYPES.filter(x => s.types.some(t => typeEffectiveness(t, [x]) > 1)),
    weak = TYPES.filter(x => typeEffectiveness(x, s.types) > 1),
    res = TYPES.filter(x => typeEffectiveness(x, s.types) < 1);
  const tot = s.base.reduce((a, b) => a + b, 0),
    mx = Math.max(...s.base);
  const chain = L.names
    .map((n, st) => {
      const sid = L.id + st,
        sn = saveData.seen[sid],
        prev = L.split && st === 3 ? L.id + '1' : L.id + (st - 1);
      return `${st ? `<span class="evarrow"><i>→</i><small>${escapeHtml(L.split && st >= 2 ? (st === 2 ? 'Build path' : 'Hype path') : evolutionMethod(SPECIES[prev].evo))}</small></span>` : ''}<button class="evnode${sid === id ? ' cur' : ''}" data-a="dex" data-s="${sid}" ${sn ? '' : 'disabled'}>${sn ? rigCanvasHTML(sid, 44) : rigCanvasHTML(sid, 44, { sil: 1, still: 1 })}<small>${sn ? escapeHtml(n) : '???'}</small></button>`;
    })
    .join('');
  const bg = TYPE_COLORS[s.types[0]][0],
    bg2 = TYPE_COLORS[s.types[s.types.length - 1]][0];
  return `<header class="bar dexbar"><button class="pb small quiet" data-a="dexback">‹ Guide</button><div class="dexnav"><button class="pb small quiet" data-a="dex" data-s="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="Previous entry">‹</button><span class="tnum">No. ${String(s.no).padStart(3, '0')}</span><button class="pb small quiet" data-a="dex" data-s="${next || ''}" ${next ? '' : 'disabled'} aria-label="Next entry">›</button></div></header>
 <article class="dexpage">
  <div class="plate px" style="--c1:${bg};--c2:${bg2}"><div class="plate-sky"></div><div class="plate-floor"></div><div class="plate-spr">${rigCanvasHTML(id, 150, { act: 'enter' })}</div><span class="cattag">${escapeHtml(s.cat)}</span><span class="stamp ${got ? 'got' : 'seen'}">${got ? 'Taxed' : 'Seen'}</span><span class="specno tnum">Specimen ${String(s.no).padStart(3, '0')}/${String(DEX_ORDER.length).padStart(3, '0')}</span></div>
  <h2 class="dexname">${escapeHtml(s.name)}</h2><p class="row">${s.types.map(typeBadgeHTML).join('')}<span class="note rar">${RARITY_NAMES[s.rar] || ''}</span></p>
  <div class="vitals">${[
    ['Height', typeof s.ht === 'number' ? s.ht.toFixed(1) + ' m' : s.ht],
    ['Weight', typeof s.wt === 'number' ? (s.wt >= 1000 ? formatNumber(s.wt) : s.wt) + ' kg' : s.wt],
    ['Habitat', s.hab],
    ['Diet', s.diet],
  ]
    .map(([k, v]) => `<div class="vit px"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`)
    .join('')}</div>
  <section class="paper px notes"><h3>Field notes</h3>${got ? `<p>${escapeHtml(s.blurb)}</p><p class="hand red">${escapeHtml(s.note)}</p>` : `<p>${escapeHtml(s.blurb.split('. ')[0])}. <span class="redact">██████ ████ ███████ ██</span></p><p class="hand">Tax one to complete this entry.</p>`}</section>
  <section class="paper px"><h3>Base stats</h3>${got ? `<table class="bsheet"><tbody>${STAT_IDS.map((k, i) => `<tr><td>${STAT_NAMES[k]}</td><td class="tnum">${s.base[i]}</td><td><span class="bbar" style="--w:${((s.base[i] / mx) * 100).toFixed(0)}%"></span></td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="tnum">${tot}</td><td></td></tr></tbody></table>` : `<p class="note">Tax one to see its stats.</p>`}</section>
  <section class="paper px lin"><h3>Evolution</h3><div class="chain">${chain}</div><p class="note">${escapeHtml(evolutionHint({ sp: id, lvl: 0, bsteps: 0 }))}</p></section>
  <section class="paper px"><h3>Type matchups</h3><table class="expo"><tbody><tr><td>Strong against</td><td>${strong.map(typeBadgeHTML).join('') || '—'}</td></tr><tr><td>Weak to</td><td>${weak.map(typeBadgeHTML).join('') || '—'}</td></tr><tr><td>Resists</td><td>${res.map(typeBadgeHTML).join('') || '—'}</td></tr></tbody></table></section>
  <section class="paper px"><h3>Where to look</h3><table class="expo"><tbody><tr><td>Found at</td><td>${where.length ? escapeHtml(where.join(', ')) : 'Not found in the wild'}</td></tr><tr><td>Hatches from</td><td>${eggs.length ? escapeHtml(eggs.join(', ')) : '—'}</td></tr><tr><td>Tracks</td><td>${escapeHtml(TRACKS[D.plan] || 'Unremarkable')}</td></tr></tbody></table></section>
  ${got ? `<div class="sig"><span class="sigline">${escapeHtml(s.name)}</span><small>Recorded by Professor Hazel.</small></div>` : ''}
 </article>`;
}
/* ---------- trainer card ---------- */
function badgeSlots() {
  const own = Object.values(TRAINERS).filter(T => T.seat),
    tot = clamp(
      Math.max(own.length, ...own.map(T => +((/of (\d+)/.exec(T.seat.title || '') || [])[1] || 0))),
      own.length,
      12
    );
  const known = own.map(T => ({
    name: String(T.seat.title || 'Badge').split(' · ')[0],
    leader: T.name,
    coin: COINS[T.seat.coin] ? T.seat.coin : 'penny',
    got: saveData.seats.includes(T.seat.id),
  }));
  return {
    got: known.filter(b => b.got).length,
    tot,
    html:
      known
        .map(b =>
          b.got
            ? `<li class="bdg got"><span class="bdg-m" title="${escapeHtml(b.name)}, from ${escapeHtml(b.leader)}">${coinHTML(b.coin, 30, 32)}</span><small>${escapeHtml(b.name.replace(/ Badge$/, ''))}</small></li>`
            : `<li class="bdg"><span class="bdg-m" title="Beat ${escapeHtml(b.leader)} to earn it">?</span><small>${escapeHtml(b.leader.replace(/^Leader /, ''))}</small></li>`
        )
        .join('') +
      Array.from(
        { length: tot - known.length },
        () => '<li class="bdg none"><span class="bdg-m"></span><small>???</small></li>'
      ).join(''),
  };
}
function renderProfile() {
  const name = cleanTrainer(saveData.avatar, saveData.gender).name,
    seen = DEX_ORDER.filter(id => saveData.seen[id]).length,
    got = DEX_ORDER.filter(id => saveData.caught[id]).length,
    places = LOCATIONS.filter((r, i) => saveData.visited[i]).length,
    bd = badgeSlots(),
    bud = findBilly(saveData.buddy);
  const beat = Object.keys(saveData.flags).filter(k => TRAINERS[k] && saveData.flags[k]).length,
    since = saveData.since
      ? new Date(saveData.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  const tile = (ic, k, v, sub, p) =>
    `<div class="pf-tile"><span class="pf-k">${ic}${k}</span><b class="tnum">${v}</b>${sub ? `<small>${sub}</small>` : ''}${p != null ? progressBarHTML(p, 'gold') : ''}</div>`;
  const items = Object.keys(ITEMS).filter(k => saveData.items[k] > 0);
  return `<header class="bar"><div><div class="sub">Your profile</div><h1 class="where">Trainer</h1></div><button class="pb small quiet" data-a="settings">${uiIconHTML('gear', 16)} Settings</button></header>
 <div class="pf-top"><section class="tcard">
  <div class="tc-band"><span>Trainer card</span><span class="tnum">ID No. ${String(saveData.tid || 0).padStart(5, '0')}</span></div>
  <div class="tc-body"><div class="tc-photo"><div class="tc-portrait">${personHTML('me', 92)}</div><button class="pb small" data-a="customize">Edit look</button></div>
   <div class="tc-info"><h2 class="tc-name">${escapeHtml(name)}</h2><dl class="tc-dl"><div><dt>Money</dt><dd class="tnum">${coinHTML('penny', 16)} $${formatNumber(saveData.se)}</dd></div><div><dt>Now in</dt><dd>${escapeHtml(LOCATIONS[saveData.trip.node].name)}</dd></div>${since ? `<div><dt>Started</dt><dd>${escapeHtml(since)}</dd></div>` : ''}<div><dt>Buddy</dt><dd>${bud ? escapeHtml(billyName(bud)) : 'None yet'}</dd></div></dl></div></div>
  <div class="tc-badges"><div class="tc-bh"><span>Badges</span><b class="tnum">${bd.got} of ${bd.tot}</b></div><ol class="bdgs">${bd.html}</ol></div>
 </section>
 <section class="tpanel pf-stats"><div class="sec-h"><h2>Records</h2></div><div class="pf-grid">
  ${tile(uiIconHTML('walk', 14), 'Steps today', formatNumber(saveData.day.steps))}${tile(uiIconHTML('walk', 14), 'Total steps', formatNumber(saveData.totalSteps))}
  ${tile(uiIconHTML('run', 14), 'Distance walked', `${stepsToKm(saveData.totalSteps)} km`)}${tile(uiIconHTML('map', 14), 'Places visited', `${places}/${LOCATIONS.length}`, null, places / LOCATIONS.length)}
  ${tile(uiIconHTML('ledger', 14), 'Seen', `${seen}/${DEX_ORDER.length}`, null, seen / DEX_ORDER.length)}${tile(coinHTML('penny', 14), 'Taxed', `${got}/${DEX_ORDER.length}`, null, got / DEX_ORDER.length)}
  ${tile(uiIconHTML('fight', 14), 'Trainers beaten', formatNumber(beat))}${tile(eggHTML(2, 12), 'Eggs hatched', formatNumber(saveData.hatched || 0), saveData.eggs.length ? `${plural(saveData.eggs.length, 'egg')} on the way` : 'No eggs right now')}${typeof stampTile === 'function' ? stampTile(tile) : ''}
 </div></section></div>
 <div class="pf-row">${bud ? `<section class="tpanel pf-buddy"><div class="sec-h"><h2>Buddy</h2></div><button class="pf-bud" data-a="mon" data-u="${bud.uid}"><span class="tm-spr" style="${plateVars(bud)}">${rigCanvasHTML(bud.sp, 72, { gold: bud.gold, build: bud.build })}</span><span class="pf-bt"><b>${escapeHtml(billyName(bud))}</b><span class="tnum">Lv ${bud.lvl}</span><small>You’ve walked ${stepsToKm(bud.bsteps || 0)} km together.</small></span></button></section>` : ''}
 <section class="tpanel pf-bag"><div class="sec-h"><h2>Bag</h2></div>
  <div class="pf-coins">${Object.keys(COINS)
    .map(
      k =>
        `<span class="pf-coin${saveData.coins[k] ? '' : ' none'}" title="${escapeHtml(COINS[k].n)}">${coinHTML(k, 22, 32)}<small>${escapeHtml(COINS[k].n.replace(/ Coins?$/, ''))}</small><b class="tnum">${formatNumber(saveData.coins[k] || 0)}</b></span>`
    )
    .join('')}</div>
  ${items.length ? `<ul class="pf-items">${items.map(k => `<li>${itemIcon(k, 24)}<span>${escapeHtml(ITEMS[k].n)}</span><b class="tnum">×${formatNumber(saveData.items[k])}</b></li>`).join('')}</ul>` : '<p class="note">No items yet.</p>'}
  <p class="note">Buy coins and items at a town shop.</p></section></div>${typeof friendsHTML === 'function' ? friendsHTML() : ''}`;
}
function donateItem() {
  const k = Object.keys(ITEMS)
    .filter(k => !ITEMS[k].evoItem && saveData.items[k] > 0)
    .sort((a, b) => saveData.items[b] - saveData.items[a])[0];
  return k || null;
}
function billySheet(m) {
  const s = SPECIES[m.sp],
    inTeam = saveData.team.includes(m),
    e = s.evo,
    mx = maxHp(m),
    lead = saveData.team[0] === m,
    bud = saveData.buddy === m.uid,
    acts = [];
  const nick = {
    f: () => {
      const nn = cleanName($('#nick').value, 16),
        changed = nn && nn !== m.nick;
      m.nick = nn;
      save();
      if (changed && e && e.k === 'rename' && m.lvl >= e.min) {
        runEvolution(m, 'It loves its new name.');
        return;
      }
      closeModal();
      render();
      toast(nn ? `Nickname saved: ${nn}.` : 'Nickname cleared.');
    },
  };
  if (inTeam && !lead)
    acts.push({
      ic: 'spark',
      l: m.hp > 0 ? 'Make lead' : 'Fainted, can’t lead',
      dis: m.hp <= 0,
      f: () => {
        saveData.team.splice(saveData.team.indexOf(m), 1);
        saveData.team.unshift(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} leads the team now.`);
      },
    });
  if (!bud)
    acts.push({
      ic: 'walk',
      l: 'Make buddy',
      f: () => {
        saveData.buddy = m.uid;
        save();
        closeModal();
        render();
        toast(`${billyName(m)} is your buddy now.`);
      },
    });
  if (needsCare(m))
    acts.push({
      ic: 'heart',
      l: 'Heal',
      c: 'green',
      f: () => {
        uiState.modal = null;
        healPick(m, true);
      },
    });
  if (inTeam && saveData.team.length > 1)
    acts.push({
      ic: 'bag',
      l: 'Move to storage',
      f: () => {
        toBox(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} is resting in storage.`);
      },
    });
  if (!inTeam && m.job == null)
    acts.push(
      saveData.team.length < teamSize()
        ? {
            ic: 'team',
            l: 'Move to team',
            f: () => {
              toTeam(m);
              save();
              closeModal();
              render();
              toast(`${billyName(m)} joined your team.`);
            },
          }
        : {
            ic: 'team',
            l: 'Swap into team',
            f: () => {
              uiState.modal = null;
              swapPick(m);
            },
          }
    );
  if (e && e.k === 'item' && m.lvl >= e.min) {
    const ik = e.item || 'bell',
      I = ITEMS[ik] || { n: 'Shining Stone' },
      have = saveData.items[ik] || 0;
    acts.push({
      ic: 'spark',
      l: have ? `Use ${I.n} (${have} left)` : `Use ${I.n} (you have none)`,
      c: have ? 'gold' : '',
      dis: !have,
      f: () => {
        saveData.items[ik]--;
        runEvolution(m, `The ${I.n} began to glow.`);
      },
    });
  }
  if (e && e.k === 'donate') {
    const it = donateItem();
    acts.push({
      c: 'gold',
      ic: 'spark',
      l: it ? `Give away a ${ITEMS[it].n}` : 'Give away an item (you have none)',
      dis: !it,
      f: () => {
        saveData.items[it]--;
        m.donated = (m.donated || 0) + 1;
        save();
        if (m.donated >= e.n && m.lvl >= e.min) {
          runEvolution(m, 'Its kindness paid off.');
          return;
        }
        toast(`${billyName(m)} gave away a ${ITEMS[it].n}. ${m.donated} of ${e.n}.`);
        closeModal();
        render();
      },
    });
  }
  if (e && e.k === 'merge' && m.lvl >= e.min) {
    const other = allBillies()
      .filter(o => o !== m && o.sp === m.sp && o.job == null)
      .sort((x, y) => x.lvl - y.lvl)[0];
    acts.push({
      c: 'gold',
      ic: 'spark',
      l: other ? `Combine with another ${s.name}` : `Combine (needs another ${s.name})`,
      dis: !other,
      f: () => {
        uiState.modal = null;
        modal({
          title: `Combine two ${s.name}s?`,
          html: `<p>${escapeHtml(billyName(other))} (Lv ${other.lvl}) will join with ${escapeHtml(billyName(m))}. This can’t be undone.</p>`,
          btns: [
            {
              l: 'Combine them',
              c: 'dark',
              f: () => {
                saveData.team = saveData.team.filter(x => x !== other);
                saveData.box = saveData.box.filter(x => x !== other);
                if (saveData.buddy === other.uid) saveData.buddy = m.uid;
                runEvolution(m, 'The two became one.');
              },
            },
            { l: 'Cancel', c: 'quiet', f: closeModal },
          ],
        });
      },
    });
  }
  /* alpha 0.5: the details open on a summary (meters, a stat chart, where it joined you, what it's like), with tabs
    for the exact stats, the moves and how it evolves */
  const base = s.base || [],
    st = STAT_IDS.map((k, i) => {
      const v = k === 'hp' ? mx : stat(m, k),
        b = base[i] || 0;
      return `<div class="ms-bar"><span>${STAT_NAMES[k]}</span><i><b style="width:${Math.round(Math.min(1, b / 150) * 100)}%;--c:${['#4E9A4A', '#D9532F', '#E3A12F', '#3478C8', '#7D52C2', '#2BA7A0'][i] || '#888'}"></b></i><em class="tnum">${v}</em></div>`;
    }).join('');
  const metR = m.met
    ? (() => {
        const r = LOCATIONS.find(x => (x.id || '') === m.met.n) || LOCATIONS[m.met.n];
        return `<div class="ms-met">${uiIconHTML('flag', 14)}<span>Joined you in <b>${escapeHtml(r ? r.name : 'a place that’s gone')}</b> · ${new Date(m.met.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`;
      })()
    : '';
  const line = LINE_BY_ID[s.line],
    evo = line
      ? line.names
          .map((n, i) => {
            const id = s.line + i;
            if (!SPECIES[id]) return '';
            const seen = saveData.seen[id] || saveData.caught[id] || id === m.sp;
            return `<div class="ms-evo ${id === m.sp ? 'on' : ''}">${seen ? rigCanvasHTML(id, 64, {}) : '<span class="ms-q">?</span>'}<b>${seen ? escapeHtml(SPECIES[id].name) : '???'}</b></div>`;
          })
          .join('<span class="ms-arr" aria-hidden="true">›</span>')
      : '';
  const tabs = [
    ['sum', 'Summary'],
    ['build', 'Build'],
    ['moves', 'Moves'],
    ['evo', 'Evolves'],
  ];
  modal({
    title: escapeHtml(billyName(m)),
    cls: 'mon-sheet',
    acts,
    top: `<div class="ms-plate" style="${plateVars(m)}">${lead ? '<span class="tm-ribbon">Lead</span>' : ''}${bud ? `<span class="tm-ribbon bud">${uiIconHTML('heart', 11)} Buddy</span>` : ''}${m.gold ? '<span class="tm-ribbon gold">Golden</span>' : ''}${isPrime(billyBuild(m)) ? '<span class="tm-ribbon prime">Prime</span>' : ''}${rigCanvasHTML(m.sp, 128, { gold: m.gold, build: m.build })}</div>`,
    html: `<p class="row ms-chips">${s.types.map(typeBadgeHTML).join('')}${billyConditionHTML(m)}<b class="lv tnum">Lv ${m.lvl}</b>${m.nick ? `<span class="ms-sp">${escapeHtml(s.name)}</span>` : ''}</p>
  <div class="ms-tabs" role="tablist" aria-label="About ${escapeHtml(billyName(m))}" data-on="sum">${tabs.map(([k, l]) => `<button role="tab" data-a="ms-tab" data-k="${k}" aria-selected="${k === 'sum'}">${l}</button>`).join('')}</div>
  <div class="ms-pane" data-k="sum"><div class="ms-meters">${meter('HP', hpBar(m.hp, mx), `${m.hp}/${mx}`)}${meter('XP', progressBarHTML(xpProgress(m), 'xpb'), xpLeft(m))}</div>
   <div class="ms-chart">${st}</div>${metR}
   ${m.job != null ? `<p class="note ms-job">${uiIconHTML('bag', 14)} Working as a ${escapeHtml(JOBS[saveData.jobs[m.job].job].n.toLowerCase())} right now. End the shift from Day jobs to bring it back.</p>` : ''}
   ${acts.length ? `<div class="ms-acts">${acts.map((b, i) => `<button class="pb small ${b.c || ''}" data-a="mact" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.ic ? uiIconHTML(b.ic, 15) : ''}<span>${b.l}</span></button>`).join('')}</div>` : ''}
   <p class="note ms-about">${escapeHtml(s.blurb)}</p>
   <div class="ms-nick"><label class="field-l">Nickname<input id="nick" maxlength="16" value="${escapeHtml(m.nick)}" placeholder="${escapeHtml(s.name)}" autocomplete="off" enterkeyhint="done"></label><button class="pb small" data-a="mnick">Save</button></div></div>
  <div class="ms-pane" data-k="build" hidden>${unitBuildHTML(billyUnit(m), partSlots())}</div>
  <div class="ms-pane" data-k="moves" hidden><div class="mvlist">${m.moves
    .map(id => {
      const M = MOVES[id];
      return `<div class="mvi"><div class="mh"><span>${M.n}</span>${typeBadgeHTML(M.t)}</div><div class="md">${M.p ? `${M.p} power, ${M.a}% accuracy. ` : ''}${M.d}</div></div>`;
    })
    .join('')}</div></div>
  <div class="ms-pane" data-k="evo" hidden>${evo ? `<div class="ms-line">${evo}</div>` : ''}<p class="note">${escapeHtml(evolutionHint(m))}</p></div>`,
    nick,
    btns: [{ l: 'Close', c: 'quiet', f: closeModal }],
  });
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-a="ms-tab"]');
  if (!b) return;
  const box = b.closest('.sheet') || document;
  const k = b.dataset.k;
  box.querySelectorAll('[data-a="ms-tab"]').forEach(x => x.setAttribute('aria-selected', String(x.dataset.k === k)));
  box.querySelectorAll('.ms-pane').forEach(p => (p.hidden = p.dataset.k !== k));
});
/* pick an item to heal one billionaire; back=true returns to its sheet afterwards */
function healPick(m, back) {
  const its = Object.keys(ITEMS).filter(k => canUse(k, m));
  modal({
    title: `Heal ${escapeHtml(billyName(m))}`,
    html: `<div class="ms-meters">${meter('HP', hpBar(m.hp, maxHp(m)), `${m.hp}/${maxHp(m)}`)}</div>${
      its.length
        ? `<div class="list">${its.map(k => `<button class="pickrow" data-a="mhealuse" data-u="${m.uid}" data-it="${k}"${back ? ' data-b="1"' : ''}>${itemIcon(k, 34)}<span class="pr-t"><b>${escapeHtml(ITEMS[k].n)}</b><small>${escapeHtml(ITEMS[k].d)}</small></span><span class="pr-n tnum">×${saveData.items[k]}</span></button>`).join('')}</div>`
        : `<p>None of your items can help right now.</p><p class="note">Rest at a town clinic for free, or buy Potions at a town shop.</p>`
    }`,
    btns: [
      {
        l: 'Cancel',
        c: 'quiet',
        f: () => {
          if (back) {
            uiState.modal = null;
            billySheet(m);
          } else closeModal();
        },
      },
    ],
  });
}
/* the team is full: pick who goes to storage so another can join */
function swapPick(m) {
  modal({
    title: `Swap in ${escapeHtml(billyName(m))}`,
    html: `<p class="note">Your team is full. Pick who rests in storage instead.</p><div class="list">${saveData.team.map((o, i) => `<button class="pickrow" data-a="mswap" data-u="${m.uid}" data-o="${o.uid}">${rigCanvasHTML(o.sp, 40, { gold: o.gold, build: o.build })}<span class="pr-t"><b>${escapeHtml(billyName(o))}</b><small>Lv ${o.lvl}${i === 0 ? ', your lead' : ''}${o.uid === saveData.buddy ? ', buddy' : ''}</small></span></button>`).join('')}</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function addPick() {
  const free = saveData.box.filter(m => m.job == null).sort((a, b) => b.lvl - a.lvl);
  modal({
    title: 'Add to your team',
    html: `<div class="list">${free.map(m => `<button class="pickrow" data-a="tmaddon" data-u="${m.uid}">${rigCanvasHTML(m.sp, 40, { gold: m.gold, build: m.build })}<span class="pr-t"><b>${escapeHtml(billyName(m))}</b><small>Lv ${m.lvl}, ${SPECIES[m.sp].types.map(t => (t === 'None' ? 'Normal' : t)).join(' and ')}</small></span></button>`).join('') || '<p>Storage is empty.</p>'}</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function hireFlow(slot) {
  modal({
    title: 'Pick a job',
    html: `<p class="note">Each job pays out every ${formatNumber(JOB_STEPS)} steps you walk.</p>`,
    btns: Object.keys(JOBS)
      .map(k => ({
        l: `${JOBS[k].n}, ${JOBS[k].where}: ${JOBS[k].pay}`,
        f: () => {
          uiState.modal = null;
          hirePick(slot, k);
        },
      }))
      .concat([{ l: 'Cancel', c: 'quiet', f: closeModal }]),
  });
}
function hirePick(slot, job) {
  const free = allBillies().filter(m => m.job == null),
    canTeam = saveData.team.filter(x => x.job == null).length > 1;
  const list = free.filter(m => !saveData.team.includes(m) || canTeam);
  modal({
    title: `Who becomes the ${JOBS[job].n.toLowerCase()}?`,
    html: list.length
      ? `<div class="list">${list.map(m => `<button class="pickrow px" data-a="hireon" data-s="${slot}" data-j="${job}" data-u="${m.uid}">${rigCanvasHTML(m.sp, 40, { gold: m.gold, build: m.build })}<span class="pr-t"><b>${escapeHtml(billyName(m))}</b><small>${saveData.team.includes(m) ? 'On your team' : 'In storage'}, Lv ${m.lvl}</small></span></button>`).join('')}</div>`
      : '<p>Tax another Billie first. Your last one has to stay on the team.</p>',
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function openSettings(tab) {
  if (tab) uiState.setTab = tab;
  modal({
    title: 'Settings',
    settings: true,
    cls: 'set-sheet',
    html: settingsHTML(),
    btns: [
      { l: 'Done', c: 'dark', f: closeModal },
      {
        l: 'Start over',
        c: 'quiet',
        f: () => {
          uiState.modal = null;
          modal({
            title: 'Start over?',
            html: '<p>This erases your team, Field Guide and money.</p>',
            btns: [
              {
                l: 'Erase and start over',
                c: 'red',
                f: () => {
                  setSaveData(newSaveKeepingPreferences());
                  saveData.savedAt = Date.now();
                  writeStoredSave(saveData);
                  flushSave();
                  uiState.intro = 0;
                  uiState.pg = null;
                  uiState.avatarDraft = null;
                  uiState.trainerDraft = null;
                  uiState.tab = 'walk';
                  applyPreferences();
                  closeModal();
                  render();
                },
              },
              { l: 'Keep my progress', c: 'quiet', f: closeModal },
            ],
          });
        },
      },
    ],
  });
}
/* o.rival (v47, from the opening): Blake's battle comes first; the welcome sheet waits until the talk after it */
export function startGame(l, o = {}) {
  const avatar = cleanLook(uiState.avatarDraft || uiState.trainerDraft || LOOK_PRESETS[0]);
  setSaveData(newSaveKeepingPreferences());
  saveData.avatar = avatar;
  uiState.trainerDraft = null;
  saveData.started = true;
  saveData.gender = 'me';
  saveData.wardrobe = { owned: {}, outfits: [null, null, null] };
  saveData.starter = l;
  const R = RULES.start,
    m = makeBilly(l + '0', R.starterLevel);
  saveData.team = [m];
  saveData.buddy = m.uid;
  saveData.caught[m.sp] = 1;
  saveData.seen[m.sp] = 1;
  saveData.since = Date.now();
  saveData.trip = { node: START_NODE, prog: 0, plan: [], hold: false };
  saveData.visited = { [START_NODE]: 1 };
  saveData.mapSeen = null;
  if (typeof storyFlags === 'function') storyFlags().copperleafNote = 1;
  for (let i = 0; i < R.starterEncounters; i++) spawn(true);
  const egg = R.starterEgg && EGGS[R.starterEgg] ? addEgg(R.starterEgg) : false;
  save();
  flushSave();
  uiState.tab = 'walk';
  render();
  const nE = R.starterEncounters,
    words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const W = {
    title: `${SPECIES[m.sp].name} joined your team`,
    top: `<div class="sheet-art">${rigCanvasHTML(m.sp, 128)}</div>`,
    html: `${nE ? `<p>${words[nE] || nE} Billie${nE === 1 ? ' is' : 's are'} already rustling in the grass. Tap one to battle it, then flick a coin.</p>` : ''}${egg ? `<p>Professor Hazel also gave you a ${R.starterEgg} km egg. It’s warming up in an incubator, and every step you walk helps it hatch.</p>` : ''}`,
    btns: [{ l: 'Let’s go', c: 'dark', f: closeModal }],
  };
  if (o.rival && TRAINERS.blake0 && typeof storyRivalBattle === 'function') {
    uiState.welcome = W;
    storyRivalBattle(o);
    return;
  }
  modal(W);
}

/* ---------- input ---------- */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a,
    d = el.dataset;
  if (a === 'scrim') {
    if (ev.target === el && uiState.modal && !uiState.modal.lock) {
      const c =
        uiState.modal.btns && uiState.modal.btns.find(b => b.l === 'Close' || b.l === 'Done' || b.c === 'quiet');
      if (c) c.f();
    }
    return;
  }
  if (a === 'mb') {
    const b = uiState.modal && uiState.modal.btns[+d.i];
    if (b && !b.dis) b.f();
    return;
  }
  if (typeof worldMapGlAction === 'function' && worldMapGlAction(a, d)) return;
  switch (a) {
    case 'intro':
      /* the opening cutscene is the only way into a new game; if it can't run, the Try again screen */
      uiState.openingFailed = false;
      if (typeof cutsceneWanted === 'function' && cutsceneWanted()) cutsceneStart();
      else {
        uiState.openingFailed = 'cant';
        render();
      }
      break;
    case 'setgender':
      saveData.gender = d.g;
      save();
      closeModal();
      render();
      break;
    case 'tab':
      if (uiState.tab !== d.t) {
        if (d.t === 'map') uiState.mglFrom = uiState.tab;
        uiState.tab = d.t;
        if (d.t !== 'map') uiState.mapSel = null;
        render();
        scrollTo(0, 0);
      } else if (d.t === 'ledger' && uiState.dex) {
        uiState.dex = null;
        render();
        scrollTo(0, 0);
      }
      break;
    case 'fish':
      if (typeof fishStart === 'function') fishStart();
      break;
    case 'leaveroom':
      leaveRoom();
      break;
    case 'walkdown': {
      const w = $('.walk-sheet');
      if (w)
        scrollTo({ top: w.getBoundingClientRect().top + scrollY - 70, behavior: reducedMotion ? 'auto' : 'smooth' });
      break;
    }
    case 'settings':
      openSettings();
      break;
    case 'inbox':
      openInbox();
      break;
    case 'card-close':
      saveData.preferences = saveData.preferences || {};
      saveData.preferences.cardClosed = true;
      save();
      render();
      requestAnimationFrame(() => {
        const t = $('.tb-where');
        if (t) t.focus({ preventScroll: true });
      });
      break;
    case 'card-open':
      saveData.preferences = saveData.preferences || {};
      saveData.preferences.cardClosed = !saveData.preferences.cardClosed;
      save();
      render();
      break;
    case 'enc': {
      const q = saveData.queue.find(x => x.id === d.id);
      if (q) startWild(q);
      break;
    }
    case 'clinic':
      healAll();
      save();
      render();
      toast('The clinic patched everyone up. No charge.');
      break;
    case 'rest': {
      const c = RULES.steps.restCost;
      if (saveData.se < c) {
        toast(`A rest stop costs $${formatNumber(c)}. Walk a bit first.`);
        break;
      }
      saveData.se -= c;
      healAll();
      save();
      render();
      toast(`Everyone rested up for $${formatNumber(c)}.`);
      break;
    }
    case 'trainer':
      trainerTalk(d.t);
      break;
    case 'mon': {
      const m = findBilly(d.u);
      if (m) billySheet(m);
      break;
    }
    case 'mact': {
      const b = uiState.modal && uiState.modal.acts && uiState.modal.acts[+d.i];
      if (b && !b.dis) b.f();
      break;
    }
    case 'mnick':
      if (uiState.modal && uiState.modal.nick) uiState.modal.nick.f();
      break;
    case 'mlead': {
      const m = findBilly(d.u);
      if (m && saveData.team.includes(m) && m.hp > 0) {
        saveData.team.splice(saveData.team.indexOf(m), 1);
        saveData.team.unshift(m);
        save();
        render();
        toast(`${billyName(m)} leads the team now.`);
      }
      break;
    }
    case 'mbuddy': {
      const m = findBilly(d.u);
      if (m) {
        saveData.buddy = m.uid;
        save();
        render();
        toast(`${billyName(m)} is your buddy now.`);
      }
      break;
    }
    case 'mheal': {
      const m = findBilly(d.u);
      if (m) healPick(m, false);
      break;
    }
    case 'mhealuse': {
      const m = findBilly(d.u);
      if (m && applyItem(d.it, d.u, false)) {
        uiState.modal = null;
        render();
        if (d.b) billySheet(m);
        else nextModal();
      }
      break;
    }
    case 'mteam': {
      const m = findBilly(d.u);
      if (!m || m.job != null || saveData.team.includes(m)) break;
      if (saveData.team.length < teamSize()) {
        toTeam(m);
        save();
        render();
        toast(`${billyName(m)} joined your team.`);
      } else swapPick(m);
      break;
    }
    case 'tmadd':
      addPick();
      break;
    case 'tmaddon': {
      const m = findBilly(d.u);
      if (m && m.job == null && !saveData.team.includes(m) && saveData.team.length < teamSize()) {
        toTeam(m);
        save();
        closeModal();
        render();
        toast(`${billyName(m)} joined your team.`);
      }
      break;
    }
    case 'mswap': {
      const m = findBilly(d.u),
        o = findBilly(d.o);
      if (!m || !o || m.job != null || !saveData.team.includes(o) || saveData.team.includes(m)) break;
      const i = saveData.team.indexOf(o);
      toBox(o);
      saveData.box.splice(saveData.box.indexOf(m), 1);
      saveData.team.splice(i, 0, m);
      m.boxedAt = null;
      save();
      closeModal();
      render();
      toast(`${billyName(m)} swapped in for ${billyName(o)}.`);
      break;
    }
    case 'boxsort':
      uiState.boxSort = d.k;
      render();
      break;
    case 'boxf':
      uiState.boxF = d.f;
      render();
      break;
    case 'msel':
      worldMapSelect(d.n.startsWith('f') ? d.n : +d.n);
      break;
    case 'travel': {
      const j = +d.n;
      if (setTrip(j)) {
        const T = tripStatus();
        toast(
          walkMode()
            ? `Follow the gold arrows to ${LOCATIONS[j].name}.`
            : T.k === 'go'
              ? `${T.t}. ${formatNumber(T.left)} steps.`
              : T.t
        );
        render();
      } else toast('There’s no open road there yet.');
      break;
    }
    case 'stoptrip':
      stopTrip();
      toast(
        saveData.trip.prog > 0
          ? 'You stopped walking. Steps won’t move you until you carry on.'
          : `You’re staying in ${LOCATIONS[saveData.trip.node].name}.`
      );
      render();
      break;
    case 'stay':
      saveData.trip.plan = [];
      saveData.trip.prog = 0;
      saveData.trip.hold = false;
      save();
      toast(`You’re staying in ${LOCATIONS[saveData.trip.node].name}.`);
      render();
      break;
    case 'resumetrip':
      resumeTrip();
      render();
      break;
    case 'turnback': {
      const r = saveData.trip,
        nx = nextTripNode();
      if (nx != null && r.prog > 0) {
        const c = roadCost(r.node, nx);
        r.plan = [r.node];
        r.node = nx;
        r.prog = c - r.prog;
        r.hold = false;
        save();
        toast(`Heading back to ${LOCATIONS[r.plan[0]].name}.`);
        render();
      }
      break;
    }
    case 'mzoom':
      worldMapZoom(d.k === 'in' ? 0.8 : 1.25);
      break;
    case 'mreset':
      worldMapReset();
      break;
    case 'hire':
      hireFlow(+d.s);
      break;
    case 'hireon':
      if (assignJob(+d.s, d.j, d.u)) {
        const m = findBilly(d.u);
        closeModal();
        render();
        toast(`${billyName(m)} started work as a ${JOBS[d.j].n.toLowerCase()}.`);
      }
      break;
    case 'collect': {
      const t = collectJob(+d.s);
      if (t) toast(t);
      render();
      break;
    }
    case 'endshift': {
      const t = endShift(+d.s);
      if (t) toast(t);
      render();
      break;
    }
    case 'dex': {
      if (!d.s) break;
      if (!saveData.seen[d.s]) {
        toast('Not seen yet. Keep walking.');
        break;
      }
      uiState.dex = d.s;
      uiState.lastTab = 'ledger';
      render();
      scrollTo(0, 0);
      break;
    }
    case 'dexback':
      uiState.dex = null;
      render();
      scrollTo(0, 0);
      break;
    case 'dexf':
      uiState.dexF = d.f;
      render();
      break;
    case 'guidetab':
      uiState.guideTab = d.k;
      render();
      scrollTo(0, 0);
      break;
    case 'loresec':
      uiState.loreSec = d.k;
      render();
      break;
    case 'lorebook':
      loreBook(d.k);
      break;
    case 'adv':
      tapMessage();
      break;
    case 'bfight':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'fight';
        paintActions();
      }
      break;
    case 'bmove':
      if (activeBattle && activeBattle.phase === 'fight') {
        if (typeof tutorPicked === 'function') tutorPicked();
        pickMove(d.m);
      }
      break;
    case 'btarget':
      if (activeBattle && activeBattle.phase === 'target' && d.t != null) pickTarget(+d.t);
      break;
    case 'bcoins':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'coins';
        paintActions();
      }
      break;
    case 'bitems':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'items';
        paintActions();
      }
      break;
    case 'bteam':
      if (activeBattle && activeBattle.phase === 'choose') {
        activeBattle.phase = 'team';
        paintActions();
      }
      break;
    case 'brun':
      if (activeBattle && activeBattle.phase === 'choose') runTurn([{ k: 'run' }]);
      break;
    case 'bback':
      if (activeBattle) {
        if (activeBattle.phase === 'target' && typeof battleStageTargets === 'function') battleStageTargets(null);
        if (activeBattle.phase === 'choose') {
          planBack();
          break;
        }
        activeBattle.phase = activeBattle.phase === 'target' ? 'fight' : 'choose';
        if (activeBattle.phase === 'choose') chooseMessage();
        paintActions();
      }
      break;
    case 'bcoin':
      if (activeBattle && activeBattle.phase === 'coins' && saveData.coins[d.c] > 0) {
        activeBattle.coin = d.c;
        activeBattle.phase = 'aim';
        paintActions();
        showAim();
      }
      break;
    case 'baimback':
      if (activeBattle && !uiState.throwing) {
        battleStage.ring = null;
        camHome(300);
        battleStageFocus('wide');
        activeBattle.phase = 'choose';
        chooseMessage();
        paintActions();
      }
      break;
    case 'bthrow':
      doThrow(false);
      break;
    case 'bitem':
      if (activeBattle && activeBattle.phase === 'items') {
        if (ITEMS[d.it].hpAll) {
          planNext({ who: activeBattle.cur, k: 'item', item: d.it, uid: fighter(activeBattle.cur).uid });
          break;
        }
        activeBattle.item = d.it;
        activeBattle.phase = 'itemTarget';
        paintActions();
      }
      break;
    case 'bitemon':
      if (activeBattle && activeBattle.phase === 'itemTarget')
        planNext({ who: activeBattle.cur, k: 'item', item: activeBattle.item, uid: d.u });
      break;
    case 'bswitch':
      if (!activeBattle) break;
      if (activeBattle.phase === 'team') planNext({ who: activeBattle.cur, k: 'switch', i: +d.i });
      else if (activeBattle.phase === 'switch') {
        const k = activeBattle.needSwitch.shift();
        activeBattle.events = [];
        doSwitch(k ?? 0, +d.i);
        if (!activeBattle.needSwitch.length) checkFaints();
        playTurnEvents();
      }
      break;
    case 'boffer':
      if (activeBattle && activeBattle.phase === 'offer') {
        const amt = activeBattle.offer;
        activeBattle.offer = null;
        activeBattle.events = [];
        if (d.y === '1') {
          saveData.se += amt;
          battleSay(`You took $${formatNumber(amt)}. ${billyName(fighter(1))} scampered off.`);
          activeBattle.over = 'bribed';
          battleStage.s[1].show = false;
          save();
        } else {
          activeBattle.integrity = Math.min(
            CATCH_RULES.integrityMax,
            activeBattle.integrity * CATCH_RULES.integrityStep
          );
          battleSay(`You refused. Focus Bonus ×${+activeBattle.integrity.toFixed(2)} on your next throw.`);
          enemyOnly();
        }
        playTurnEvents();
      }
      break;
    case 'bend':
      if (activeBattle && activeBattle.phase === 'end') endBattle();
      break;
  }
});
/* keyboard play in battle: F fight, 1–4 moves, X tax (or C), I items, T team, R run, Esc back, Space/Enter advance */
document.addEventListener('keydown', ev => {
  if (
    !activeBattle ||
    uiState.modal ||
    ev.ctrlKey ||
    ev.metaKey ||
    ev.altKey ||
    /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)
  )
    return;
  const k = ev.key.toLowerCase(),
    ph = activeBattle.phase,
    click = s => {
      const e = $(s);
      if (e && !e.disabled) {
        e.click();
        ev.preventDefault();
      }
    };
  if (ph === 'playing' && (k === ' ' || k === 'enter')) {
    tapMessage();
    ev.preventDefault();
    return;
  }
  if (ph === 'choose') {
    if (k === 'f') click('[data-a=bfight]');
    else if (k === 'x' || k === 'c') click('[data-a=bcoins]');
    else if (k === 'i') click('[data-a=bitems]');
    else if (k === 't') click('[data-a=bteam]');
    else if (k === 'r') click('[data-a=brun]');
    else if (k === 'escape' || k === 'backspace') click('#acts [data-a=bback]');
    return;
  }
  if (ph === 'target' && /^[1-9]$/.test(k)) {
    const b = $$('#acts .pick')[+k - 1];
    if (b) {
      b.click();
      ev.preventDefault();
    }
    return;
  }
  if (ph === 'fight' && /^[1-9]$/.test(k)) {
    const b = $$('#acts .mv')[+k - 1];
    if (b) {
      b.click();
      ev.preventDefault();
    }
    return;
  }
  if (ph === 'aim') {
    if (k === ' ' || k === 'enter') click('[data-a=bthrow]');
    else if (k === 'escape') click('[data-a=baimback]');
    return;
  }
  if (ph === 'end' && (k === ' ' || k === 'enter')) click('[data-a=bend]');
  if ((k === 'escape' || k === 'backspace') && ['fight', 'target', 'coins', 'items', 'itemTarget', 'team'].includes(ph))
    click('#acts [data-a=bback]');
});
document.addEventListener('pointerdown', ev => {
  if (activeBattle && activeBattle.phase === 'playing' && ev.target.closest('.bstage')) tapMessage();
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && uiState.modal && !uiState.modal.lock) {
    const c = uiState.modal.btns && uiState.modal.btns.find(b => b.l === 'Close' || b.l === 'Done' || b.l === 'Cancel');
    if (c) c.f();
  }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role=button][data-a]')) {
    ev.preventDefault();
    ev.target.click();
  }
});
window.addEventListener('resize', () => {
  if (activeBattle) battleResize();
  else if (uiState.tab === 'map' && saveData.started) worldMapFit();
});

/* ---------- tilt ---------- */
document.addEventListener(
  'pointermove',
  ev => {
    const el = ev.target.closest && ev.target.closest('.enc,.starter,.gcard');
    if (!el || reducedMotion) return;
    const r = el.getBoundingClientRect(),
      x = (ev.clientX - r.left) / r.width - 0.5,
      y = (ev.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--ry', (x * 16).toFixed(1) + 'deg');
    el.style.setProperty('--rx', (-y * 16).toFixed(1) + 'deg');
    el._tilt = 1;
  },
  { passive: true }
);
document.addEventListener(
  'pointerout',
  ev => {
    const el = ev.target.closest && ev.target.closest('.enc,.starter,.gcard');
    if (el && el._tilt && !el.contains(ev.relatedTarget)) {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    }
  },
  { passive: true }
);
document.addEventListener(
  'pointerup',
  () =>
    $$('.enc,.starter,.gcard').forEach(el => {
      if (el._tilt) {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      }
    }),
  { passive: true }
);

/* ---------- animated pixel sky behind the app ---------- */
const pixelSky = { cv: null, x: null, last: 0, w: 160, h: 300, dark: null, base: null, isl: [], cl: [], sp: [] };
provide({ pixelSky }); /* to-module */
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
function buildPixelSky() {
  const W = pixelSky.w,
    H = pixelSky.h,
    dk = pixelSky.dark,
    m = dk ? 'dark' : 'light',
    sky = ART_CACHE.img[`background/sky_${m}.png`],
    c = makeCanvas(W, H),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(sky, 0, 0, W, H);
  pixelSky.base = c;
  pixelSky.cl = [0, 1, 2, 3].map(i => ({
    img: ART_CACHE.img[`background/cloud_${m}_${i}.png`],
    x: random() * W,
    y: 20 + i * 28 + random() * 10,
    v: 0.003 + i * 0.002,
  }));
  pixelSky.sp = Array.from({ length: dk ? 40 : 14 }, () => ({
    x: random() * W,
    y: random() * H * 0.8,
    p: random() * 6,
  }));
}
export function initPixelSky() {
  const c = document.createElement('canvas');
  c.id = 'bgfx';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  pixelSky.cv = c;
  pixelSky.x = c.getContext('2d');
  resizePixelSky();
  window.addEventListener('resize', resizePixelSky);
  frameTask('bg', pixelSkyTick, () => (activeBattle ? 1 : 15));
}
function resizePixelSky() {
  pixelSky.w = 160;
  pixelSky.h = Math.max(200, Math.round((160 * innerHeight) / Math.max(1, innerWidth)));
  pixelSky.cv.width = pixelSky.w;
  pixelSky.cv.height = pixelSky.h;
  pixelSky.dark = null;
}
function pixelSkyTick(ts) {
  if (activeBattle) return;
  pixelSky.last = ts;
  const dk = isDark();
  if (dk !== pixelSky.dark) {
    pixelSky.dark = dk;
    buildPixelSky();
  }
  if (reducedMotion && pixelSky._still === pixelSky.base) return;
  pixelSky._still = pixelSky.base;
  const x = pixelSky.x,
    W = pixelSky.w,
    H = pixelSky.h,
    t = reducedMotion ? 0 : ts;
  x.imageSmoothingEnabled = false;
  x.drawImage(pixelSky.base, 0, 0);
  const sx = W * 0.78,
    sy = H * 0.16,
    pr = 10 + Math.sin(t / 900) * 1.2;
  x.globalCompositeOperation = 'lighter';
  [
    [pr * 3.2, 0.06],
    [pr * 2, 0.1],
    [pr * 1.3, 0.18],
  ].forEach(([r, a]) => {
    x.fillStyle = `rgba(255,${dk ? 190 : 214},${dk ? 120 : 150},${a})`;
    x.beginPath();
    x.arc(sx, sy, r, 0, 7);
    x.fill();
  });
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = dk ? '#FFE9A8' : '#FFF8E0';
  x.beginPath();
  x.arc(Math.round(sx), Math.round(sy), 6, 0, 7);
  x.fill();
  pixelSky.cl.forEach(c => {
    const w = c.img.width,
      xx = ((c.x + t * c.v) % (W + w)) - w;
    x.drawImage(c.img, Math.round(xx), Math.round(c.y));
  });
  pixelSky.sp.forEach(p => {
    const a = 0.5 + 0.5 * Math.sin(t / 500 + p.p);
    if (a < 0.55) return;
    x.fillStyle = dk ? `rgba(255,240,200,${a})` : `rgba(255,255,255,${a * 0.8})`;
    x.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  });
}

/* ---------- boot: load the menu art, then draw ---------- */

// Keep keyboard navigation inside an open dialog.
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Tab' || !uiState.modal) return;
  const els = $$(
    '.sheet button:not(:disabled),.sheet input,.sheet select,.sheet summary,[tabindex="0"]',
    $('#ov')
  ).filter(e => e.getClientRects().length);
  if (!els.length) return;
  const first = els[0],
    last = els[els.length - 1];
  if (ev.shiftKey && (document.activeElement === first || !els.includes(document.activeElement))) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && (document.activeElement === last || !els.includes(document.activeElement))) {
    ev.preventDefault();
    first.focus();
  }
});
// Enter in the nickname field saves it.
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'nick' && uiState.modal && uiState.modal.nick) {
    ev.preventDefault();
    uiState.modal.nick.f();
  }
});
