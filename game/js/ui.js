'use strict';
/* ================= UI ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { $, $$, clamp, rnd } from './util.js';
import {
  ADJ,
  COINS,
  DEX,
  EGGS,
  FUTURE,
  GD,
  ITEMS,
  JOBS,
  JOB_STEPS,
  LINKS,
  LN,
  MOVES,
  PEOPLE,
  POOLS,
  ROUTE,
  RULES,
  SHOPS,
  SP,
  START_NODE,
  STATK,
  STATN,
  STATUSN,
  TC,
  TRAINERS,
  TYPES,
  eff,
  linkCost,
  placeSub,
  trainersAt,
} from './game-data.js';
import {
  B,
  BR,
  EGG_SLOTS,
  MAXLV,
  N,
  RM,
  S,
  SLOTS,
  TEAM_MAX,
  U,
  addEgg,
  allMons,
  assignJob,
  blockerAt,
  canEnter,
  canRide,
  cleanName,
  collectJob,
  endShift,
  esc,
  evoHint,
  evoItemName,
  evoReady,
  evolve,
  findMon,
  flush,
  fmt,
  freshKeep,
  gateMsg,
  gateText,
  hatchEgg,
  hatchable,
  healAll,
  km,
  lsSet,
  makeMon,
  maxHp,
  nextBracket,
  nextStop,
  plural,
  rate,
  resumeTrip,
  riderName,
  rollDay,
  save,
  setS,
  setTrip,
  spawn,
  splitPath,
  stat,
  stopTrip,
  toBox,
  toTeam,
  tripTo,
  walkMode,
  xpFor,
} from './game-state.js';
import { frameTask, userFps } from './frame-scheduler.js';
import { ART, artLoad, artURL, cnv, coinHTML, coinURL, eggHTML, uiIco } from './art.js';
import {
  TR_PRESETS,
  cleanLook,
  cleanTrainer,
  humanHTML,
  owHTMLsheet,
  portraitHTML,
  trainerLook,
} from './person-art.js';
import { applyPreferences, settingsHTML } from './settings-screen.js';
import { drPortrait, openDressing } from './dressing-room.js';
import { bustHTML, sprHTML } from './skeleton-rig.js';
import { EASE, SC, camHome, scFocus, scTargets } from './battle-stage.js';
import {
  dioClimb,
  dioData,
  dioFind,
  dioFreePt,
  dioHubOf,
  dioPaths,
  dioScene,
  dioStop,
  dioWalkTo,
  openKind,
  placeClosedText,
  placeOpen,
  walkView,
} from './walk-view.js';
import { eng } from './engine/settings.js';
import { ENV, envHint, envIcon, envLabel } from './environment.js';
import { DGL, dioMount } from './walk-view-gl.js';
import { fishStart } from './fishing.js';
import {
  WORLD,
  dioShift,
  wrDelta,
  wrGate,
  wrGetReady,
  wrOn,
  wrPrefetch,
  wrRoamView,
  wrRoomId,
  wrRoomScene,
  wrTripView,
} from './seamless-world.js';
import { battleGLLayout, battleGLWanted } from './battle-3d.js';
import {
  A,
  RC,
  applyItem,
  battleResize,
  battleShell,
  canUse,
  checkFaints,
  chooseMsg,
  doSwitch,
  doThrow,
  endBattle,
  enemyOnly,
  itemIcon,
  paintActions,
  pickMove,
  pickTarget,
  planBack,
  planNext,
  play,
  runTurn,
  say,
  showAim,
  startWild,
  tapMsg,
} from './battle.js';
import { MH, MW, mapFit, mapMount, mapReset, mapSelect, mapZoom } from './world-map.js';
import { mapGLAction, mapGLWanted } from './world-map-gl.js';
import { openShop } from './shop.js';
import { sfx } from './sound.js';
import { talkHazel } from './talk.js';
import { CS, csStart, csWanted } from './cutscene.js';
import { fallStill } from './opening-fall.js';
import { renderTitle, titleMount } from './title.js';
import { loreBook, renderLore } from './lore.js';
import { flyMenu, liftGo } from './airship.js';
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
import { chalCard, homeApply, homeDecorate, reqList, stampTile } from './things-to-do.js';
/* eslint-disable no-func-assign */
expose({
  BG: [() => BG],
  BOXSORT: [() => BOXSORT],
  BRCOL: [() => BRCOL],
  GINI: [() => GINI],
  INTRO_STILLS: [() => INTRO_STILLS],
  RARN: [() => RARN],
  ROOM_KIND: [() => ROOM_KIND],
  ROOM_OF: [() => ROOM_OF],
  SCREENS: [() => SCREENS],
  TABS: [() => TABS],
  TRACKS: [() => TRACKS],
  addPick: [() => addPick, v => (addPick = v)],
  badgeSlots: [() => badgeSlots, v => (badgeSlots = v)],
  bar: [() => bar, v => ((bar = v), provide({ bar }))],
  bgBuild: [() => bgBuild, v => (bgBuild = v)],
  bgInit: [() => bgInit, v => (bgInit = v)],
  bgResize: [() => bgResize, v => (bgResize = v)],
  bgTick: [() => bgTick, v => (bgTick = v)],
  boardNote: [() => boardNote, v => (boardNote = v)],
  boxSection: [() => boxSection, v => (boxSection = v)],
  bracketBars: [() => bracketBars, v => (bracketBars = v)],
  bracketLabels: [() => bracketLabels, v => (bracketLabels = v)],
  bracketNote: [() => bracketNote, v => (bracketNote = v)],
  bracketSpans: [() => bracketSpans, v => (bracketSpans = v)],
  buddyCard: [() => buddyCard, v => (buddyCard = v)],
  chip: [() => chip],
  closeModal: [() => closeModal, v => ((closeModal = v), provide({ closeModal }))],
  dexStatus: [() => dexStatus, v => (dexStatus = v)],
  donateItem: [() => donateItem, v => (donateItem = v)],
  eggSlots: [() => eggSlots, v => (eggSlots = v)],
  encCard: [() => encCard, v => (encCard = v)],
  enterRoom: [() => enterRoom, v => (enterRoom = v)],
  envLine: [() => envLine, v => (envLine = v)],
  evoMethod: [() => evoMethod, v => (evoMethod = v)],
  evoModal: [() => evoModal, v => (evoModal = v)],
  evoRun: [() => evoRun, v => ((evoRun = v), provide({ evoRun }))],
  exitPrompt: [() => exitPrompt, v => (exitPrompt = v)],
  genderModal: [() => genderModal, v => (genderModal = v)],
  guideTabs: [() => guideTabs, v => (guideTabs = v)],
  hatchModal: [() => hatchModal, v => (hatchModal = v)],
  healPick: [() => healPick, v => (healPick = v)],
  hereCard: [() => hereCard, v => (hereCard = v)],
  hireFlow: [() => hireFlow, v => (hireFlow = v)],
  hirePick: [() => hirePick, v => (hirePick = v)],
  hpBar: [() => hpBar, v => (hpBar = v)],
  introSteps: [() => introSteps, v => (introSteps = v)],
  isDark: [() => isDark],
  jobSlots: [() => jobSlots, v => (jobSlots = v)],
  learnModal: [() => learnModal, v => (learnModal = v)],
  leaveRoom: [() => leaveRoom, v => (leaveRoom = v)],
  mapCardHTML: [() => mapCardHTML, v => (mapCardHTML = v)],
  meter: [() => meter],
  modal: [() => modal, v => ((modal = v), provide({ modal }))],
  monSheet: [() => monSheet, v => (monSheet = v)],
  monState: [() => monState],
  needsCare: [() => needsCare],
  nextModal: [() => nextModal, v => (nextModal = v)],
  nextToast: [() => nextToast, v => (nextToast = v)],
  nodeActions: [() => nodeActions, v => (nodeActions = v)],
  owHTML: [() => owHTML, v => (owHTML = v)],
  paintMapCard: [() => paintMapCard, v => ((paintMapCard = v), provide({ paintMapCard }))],
  plateVars: [() => plateVars],
  poolStrip: [() => poolStrip, v => (poolStrip = v)],
  postProcess: [() => postProcess, v => ((postProcess = v), provide({ postProcess }))],
  render: [() => render, v => setRender(v)],
  renderDexEntry: [() => renderDexEntry, v => (renderDexEntry = v)],
  renderIntro: [() => renderIntro, v => (renderIntro = v)],
  renderLedger: [() => renderLedger, v => (renderLedger = v)],
  renderMap: [() => renderMap, v => (renderMap = v)],
  renderOv: [() => renderOv, v => setRenderOv(v)],
  renderProfile: [() => renderProfile, v => (renderProfile = v)],
  renderTeam: [() => renderTeam, v => (renderTeam = v)],
  renderWalk: [() => renderWalk, v => (renderWalk = v)],
  roomAct: [() => roomAct, v => (roomAct = v)],
  roomAim: [() => roomAim, v => (roomAim = v)],
  roomFor: [() => roomFor, v => (roomFor = v)],
  roomHero: [() => roomHero, v => (roomHero = v)],
  roomLayIn: [() => roomLayIn, v => (roomLayIn = v)],
  roomRefresh: [() => roomRefresh, v => ((roomRefresh = v), provide({ roomRefresh }))],
  roomState: [() => roomState, v => (roomState = v)],
  roomStepIn: [() => roomStepIn, v => (roomStepIn = v)],
  sceneExits: [() => sceneExits, v => ((sceneExits = v), provide({ sceneExits }))],
  sceneExitsByBearing: [() => sceneExitsByBearing, v => (sceneExitsByBearing = v)],
  sceneIdAt: [() => sceneIdAt, v => ((sceneIdAt = v), provide({ sceneIdAt }))],
  settings: [() => settings, v => ((settings = v), provide({ settings }))],
  stBadge: [() => stBadge],
  startGame: [() => startGame, v => ((startGame = v), provide({ startGame }))],
  stepsTo: [() => stepsTo, v => (stepsTo = v)],
  swapPick: [() => swapPick, v => (swapPick = v)],
  teamCard: [() => teamCard, v => (teamCard = v)],
  teamHero: [() => teamHero, v => (teamHero = v)],
  toast: [() => toast, v => ((toast = v), provide({ toast }))],
  topbar: [() => topbar, v => (topbar = v)],
  tripButtons: [() => tripButtons, v => (tripButtons = v)],
  tripDest: [() => tripDest],
  tripLeft: [() => tripLeft, v => (tripLeft = v)],
  tripStatus: [() => tripStatus, v => (tripStatus = v)],
  updateNav: [() => updateNav, v => ((updateNav = v), provide({ updateNav }))],
  walkCross: [() => walkCross, v => (walkCross = v)],
  walkHero: [() => walkHero, v => (walkHero = v)],
  walkOff: [() => walkOff, v => ((walkOff = v), provide({ walkOff }))],
  walkPick: [() => walkPick, v => (walkPick = v)],
  walkSceneSync: [() => walkSceneSync, v => (walkSceneSync = v)],
  walkState: [() => walkState, v => (walkState = v)],
  whCard: [() => whCard, v => (whCard = v)],
  xpLeft: [() => xpLeft],
  xpPart: [() => xpPart],
});
/* eslint-enable no-func-assign */
provide({
  bar,
  closeModal,
  evoRun,
  modal,
  paintMapCard,
  postProcess,
  render,
  renderOv,
  roomRefresh,
  sceneExits,
  sceneIdAt,
  settings,
  startGame,
  toast,
  updateNav,
  walkOff,
});
export function setRender(v) {
  render = v; // eslint-disable-line no-func-assign
  provide({ render });
}
export function setRenderOv(v) {
  renderOv = v; // eslint-disable-line no-func-assign
  provide({ renderOv });
}
/* to-module: end */
const chip = t => `<span class="chip" style="--tc:${TC[t][0]};--tf:${TC[t][1]}">${t === 'None' ? 'Normal' : t}</span>`;
provide({ chip }); /* to-module */
const stBadge = st => (st ? `<span class="stb st-${st}">${STATUSN[st]}</span>` : '');
provide({ stBadge }); /* to-module */
function bar(p, cls = '') {
  return `<div class="pbar ${cls}"><i style="width:${clamp(p, 0, 1) * 100}%"></i></div>`;
}
function hpBar(hp, max) {
  const p = Math.max(0, hp / max);
  return `<div class="pbar hpb ${p < 0.25 ? 'low' : p < 0.5 ? 'mid' : ''}"><i style="width:${p * 100}%"></i></div>`;
}

/* ---------- toasts & modals ---------- */
export function toast(t) {
  U.toastQ.push(t);
  if (!U.toastOn) nextToast();
}
function nextToast() {
  const t = U.toastQ.shift();
  if (!t) {
    U.toastOn = false;
    renderOv();
    return;
  }
  U.toastOn = t;
  renderOv();
  setTimeout(nextToast, U.toastQ.length > 2 ? 1300 : 2300);
}
export function modal(o) {
  U.mq.push(o);
  if (!U.modal) nextModal();
}
function nextModal() {
  U.modal = U.mq.shift() || null;
  renderOv();
}
export function closeModal() {
  U.modal = null;
  nextModal();
  if (!U.modal) postProcess();
}
export function renderOv() {
  const ov = $('#ov');
  let h = '';
  const M = U.modal;
  if (M)
    h += `<div class="scrim" data-a="scrim"><div class="sheet px ${M.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="mt">${M.top || ''}<h2 id="mt">${M.title}</h2><div class="body">${M.html || ''}</div><div class="btns">${(M.btns || []).map((b, i) => `<button class="pb ${b.c || ''} wide" data-a="mb" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.l}</button>`).join('')}</div></div></div>`;
  if (U.toastOn) h += `<div class="toast px glass" role="status">${esc(U.toastOn)}</div>`;
  const keep = ov.querySelector('.scrim');
  ov.innerHTML = h;
  const sc = ov.querySelector('.scrim');
  if (sc && keep && M && M === U._lastM) sc.classList.add('still');
  U._lastM = M;
  if (M && M.after && !M._afterRan) {
    M._afterRan = true;
    M.after();
  }
  if (M && M !== U._focusedModal) {
    U._focusedModal = M;
    U._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
      const e = $('.sheet button,.sheet input,.sheet select');
      if (e) e.focus({ preventScroll: true });
    });
  } else if (!M && U._focusedModal) {
    U._focusedModal = null;
    if (U._returnFocus && U._returnFocus.isConnected) U._returnFocus.focus({ preventScroll: true });
  }
}

/* ---------- post-step events ---------- */
export function postProcess() {
  if (B || U.modal || !S.started || U.title) return;
  const eg = hatchable()[0];
  if (eg) {
    hatchModal(eg);
    return;
  }
  const lq = U.learnQ.shift();
  if (lq) {
    const m = findMon(lq.uid);
    if (m && !m.moves.includes(lq.mv)) {
      learnModal(m, lq.mv);
      return;
    }
    return postProcess();
  }
  const m = allMons().find(evoReady);
  if (m) evoModal(m);
}
function genderModal() {
  modal({
    title: 'Are you a boy or a girl?',
    html: `<p>Professor Hazel needs it for your trainer card.</p><div class="gpick">${['boy', 'girl'].map(g => `<button class="gcard px" data-a="setgender" data-g="${g}">${humanHTML(g, 64)}<b>${g === 'boy' ? 'Boy' : 'Girl'}</b></button>`).join('')}</div>`,
    btns: [],
    lock: 1,
  });
}
function learnModal(m, mv) {
  const M = MOVES[mv];
  modal({
    title: `${esc(N(m))} wants to learn ${M.n}`,
    html: `<p>${chip(M.t)} ${M.p ? `${M.p} power` : 'Status'}. ${M.d}</p><p class="note">It already knows ${SLOTS()} moves. Pick one to forget, or skip this one.</p>`,
    btns: m.moves
      .map(id => ({
        l: `Forget ${MOVES[id].n}`,
        f: () => {
          m.moves[m.moves.indexOf(id)] = mv;
          save();
          toast(`${N(m)} learned ${M.n}.`);
          closeModal();
        },
      }))
      .concat([{ l: `Don’t learn ${M.n}`, c: 'quiet', f: closeModal }]),
  });
}
function evoModal(m) {
  const s = SP[m.sp],
    e = s.evo;
  const why =
    {
      lvl: `It just reached level ${e.at}.`,
      buddy: `You’ve walked ${km(e.steps)} km together.`,
      idle: 'It rested in storage for a whole day.',
      streak: `${e.n} wins in a row made it stronger.`,
      split: `It just reached level ${e.at}. ${splitPath(m) === 'B' ? `It won ${m.wins || 0} battles: the Hype path.` : `It walked ${km(m.bsteps || 0)} km with you: the Build path.`}`,
    }[e.k] || '';
  modal({
    title: `${esc(N(m))} is evolving`,
    top: `<div class="evo">${sprHTML(m.sp, 128, { gold: m.gold })}</div>`,
    html: `<p>${why} Something bigger is coming.</p>`,
    lock: 1,
    btns: [
      { l: 'Let it evolve', c: 'dark', f: () => evoRun(m) },
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
function evoRun(m, note) {
  const from = SP[m.sp],
    to = SP[from.evo && from.evo.k === 'split' && from.alt && splitPath(m) === 'B' ? from.alt : from.next],
    fromName = N(m);
  U.modal = null;
  modal({
    title: `What? ${esc(fromName)} is evolving!`,
    top: `<div class="evo run" id="evoBox"><span class="ea">${sprHTML(from.id, 128, { gold: m.gold, still: 1 })}</span><span class="eb">${sprHTML(to.id, 128, { gold: m.gold, still: 1 })}</span></div>`,
    html: '<p class="note">Don’t look away.</p>',
    btns: [],
    lock: 1,
    after: () => {
      const box = $('#evoBox');
      if (!box) return;
      const seq = RM ? [] : [420, 380, 330, 280, 240, 200, 170, 140, 110, 90, 70, 60, 50, 40, 40, 30];
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
            U.modal = null;
            modal({
              title: `${esc(fromName)} became ${esc(to.name)}`,
              top: `<div class="evo done">${sprHTML(m.sp, 128, { gold: m.gold })}</div>`,
              html: `<p>${esc(to.blurb)}</p><p>${to.types.map(chip).join('')}</p>${note ? `<p class="note">${note}</p>` : ''}`,
              btns: [{ l: 'Nice', c: 'dark', f: closeModal }],
            });
          },
          RM ? 60 : 700
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
            s = SP[m.sp];
          const done = () => {
            U.modal = null;
            modal({
              title: `It’s ${/^[AEIOU]/.test(s.name) ? 'an' : 'a'} ${m.gold ? 'Golden ' : ''}${esc(s.name)}`,
              top: `<div class="hatch done">${sprHTML(m.sp, 128, { gold: m.gold })}</div>`,
              html: `<p>${s.types.map(chip).join('')} <b class="tnum">Lv ${m.lvl}</b></p><p>${esc(s.blurb)}</p>${res.where === 'box' ? '<p class="note">It went to storage because your team is full.</p>' : ''}`,
              btns: [{ l: 'Welcome aboard', c: 'dark', f: closeModal }],
            });
            render();
          };
          if (RM || !box) {
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
  const shut = !!(S.preferences && S.preferences.cardClosed),
    walk = U.tab === 'walk';
  return `<div class="topbar glass" role="status">${walk ? `<button class="tb-where ${shut ? 'shut' : ''}" data-a="card-open" aria-expanded="${!shut}" aria-label="${shut ? 'Show' : 'Hide'} the card for ${esc(ROUTE[S.route.node].name)}">${esc(U.inside && !U.bench && typeof roomState === 'function' && roomState() ? U.inside.name || ROUTE[S.route.node].name : ROUTE[S.route.node].name)}${uiIco('chev', 12)}</button>` : `<span class="tb-where">${esc(ROUTE[S.route.node].name)}</span>`}<span class="tb-chip tnum" title="Money">${coinHTML('penny', 16)}<small>$</small><b data-count="tse" data-to="${S.se}">${fmt(S.se)}</b></span><button class="tb-btn" data-a="settings" aria-label="Settings and help">${uiIco('gear', 18)}</button><button class="tb-me" data-a="tab" data-t="profile" aria-label="Your trainer card" ${U.tab === 'profile' ? 'aria-current="page"' : ''}>${typeof portraitHTML === 'function' ? portraitHTML('me', 84) : ''}</button></div>`;
}
export function render() {
  const app = $('#app');
  if (U.title && typeof renderTitle === 'function') {
    app.innerHTML = renderTitle();
    U.lastTab = null;
    updateNav(false);
    document.body.classList.remove('on-map');
    titleMount();
    return;
  }
  if (!S.started) {
    if (typeof CS !== 'undefined' && CS.on) {
      app.innerHTML = '';
      updateNav(false);
      return;
    }
    app.innerHTML = renderIntro();
    U.lastTab = null;
    updateNav(false);
    document.body.classList.remove('on-map');
    walkSceneSync();
    return;
  }
  if (B) {
    app.innerHTML = battleShell();
    updateNav(false);
    document.body.classList.remove('on-map');
    walkSceneSync();
    return;
  }
  if (!SCREENS.includes(U.tab)) U.tab = 'walk';
  const T = U.tab,
    body =
      T === 'team'
        ? renderTeam()
        : T === 'ledger'
          ? renderLedger()
          : T === 'profile'
            ? renderProfile()
            : T === 'bag'
              ? renderBag()
              : T === 'map'
                ? renderMap()
                : renderWalk();
  const enter = U.lastTab !== T,
    dir = U.lastTab && enter ? (SCREENS.indexOf(T) > SCREENS.indexOf(U.lastTab) ? ' fromR' : ' fromL') : '';
  U.lastTab = T;
  app.innerHTML = `${topbar()}<main class="screen s-${T}${enter ? ' enter' + dir : ''}">${body}</main>`;
  updateNav(true);
  walkSceneSync();
  document.body.classList.toggle('on-map', T === 'map');
  if (T === 'map') mapMount();
  $$('[data-count]').forEach(el => {
    const k = el.dataset.count,
      to = +el.dataset.to,
      from = U.disp[k];
    U.disp[k] = to;
    if (from == null || from === to || RM) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now(),
      dur = 700;
    const st = () => {
      const q = Math.min(1, (performance.now() - t0) / dur),
        v = from + (to - from) * EASE.out(q);
      el.textContent = fmt(v);
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
    n.innerHTML = `<div class="in px glass"><span class="ind"></span>${t.map(([k, l]) => `<button data-a="tab" data-t="${k}">${uiIco(k)}<span>${l}</span></button>`).join('')}</div>`;
    document.body.appendChild(n);
  }
  n.hidden = !show;
  n.querySelector('.ind').style.setProperty('--i', TABS.indexOf(U.tab));
  n.querySelectorAll('button').forEach(b => {
    if (b.dataset.t === U.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}
/* v47: the opening in pictures, when the cutscene can't run or stops (opening-fall.js draws them): the fall, Hazel, your trainer, your starter, then Blake */
const INTRO_STILLS = [
  [
    'street',
    3.2,
    'The surface, late, after the show. You were walking home, a lanyard round your neck, your phone in your hand.',
  ],
  ['street', 6.35, 'Then the pavement opened.'],
  ['crust', 1.05, 'Down through the crust: soil, rock, old pipes, a crate stamped LEGACY. Then light.'],
  [
    'sky',
    0.4,
    'Inside the planet there is another world, with the Inner Sun at its centre. You fell right across it, and landed in Copperleaf.',
  ],
];
const GINI = [
  '[surprised] Oh! Another one! Are you all right? That was quite a landing.',
  'You came down through the crust. Things do, now and then. Mostly furniture. You’re the first this week who can talk.',
  'Can you tell me your name? No? Classic fall-related amnesia. Very common down here. It usually comes back, a bit at a time.',
  '[happy] Let’s start with what we can see. Let me get a good look at you.',
];
function introSteps() {
  return [
    ...INTRO_STILLS.map(s => ({ k: 'still', s })),
    ...GINI.map(t => ({ k: 'gini', t })),
    { k: 'trainer' },
    { k: 'named' },
    { k: 'pick' },
  ];
}
function renderIntro() {
  const i = U.intro,
    L = introSteps(),
    st = i > 0 ? L[Math.min(i, L.length) - 1] : null;
  if (st && st.k === 'still') {
    const [kind, t, text] = st.s,
      src = typeof fallStill === 'function' ? fallStill(kind, t) : '';
    return `<div class="talk intro-still">${src ? `<img class="still" src="${src}" alt="">` : ''}<div class="dlg px"><p class="line">${esc(text)}</p><button class="pb dark wide" data-a="intro">Next</button></div></div>`;
  }
  if (st && st.k === 'gini') {
    const m = /^\[(\w+)\]\s*/.exec(st.t),
      tx = m ? st.t.slice(m[0].length) : st.t;
    return `<div class="talk"><div class="talk-art">${humanHTML('gini', 96)}</div><div class="dlg px"><p class="speaker">Professor Hazel</p><p class="line" id="dlgLine">${esc(tx)}</p><button class="pb dark wide" data-a="intro">Next</button></div></div>`;
  }
  if (i === 0)
    return `<div class="title"><div class="title-landscape" aria-hidden="true"></div><div class="title-coin">${coinHTML('penny', 176, 32)}</div><h1 class="logo">Pocket Billies</h1><p class="tag">A walking RPG inside the Hollow Earth, where the Billies are the wildlife. Gotta tax 'em all!</p><button class="pb gold wide big" data-a="intro">Start</button></div>`;
  if (i <= GINI.length)
    return `<div class="talk"><div class="talk-art">${humanHTML('gini', 96)}</div><div class="dlg px"><p class="speaker">Professor Hazel</p><p class="line" id="dlgLine">${GINI[i - 1]}</p><button class="pb dark wide" data-a="intro">Next</button></div></div>`;
  if (st && st.k === 'trainer') {
    const cur = JSON.stringify(cleanLook(U.trainerDraft || TR_PRESETS[0]));
    return `<header class="bar"><div><div class="sub">Your adventure, your style</div><h1 class="where">Create your trainer</h1></div></header>
  <p class="note">Pick a starting look, then make it yours: body, face, hair and clothes. You can change it any time from your Trainer card.</p>
  <div class="tr-presets">${TR_PRESETS.map((p, j) => `<button class="tr-pre px" data-a="tr-preset" data-i="${j}" aria-pressed="${JSON.stringify(cleanLook(p)) === cur}"><img src="${drPortrait(p)}" alt="Look ${j + 1}"></button>`).join('')}</div>
  <div class="tr-me px"><div class="tr-big">${humanHTML('me', 120)}</div><div class="racts"><button class="pb dark wide" data-a="tr-custom">${uiIco('profile', 16)} Customize</button><button class="pb gold wide big" data-a="tr-next">Next</button></div></div>`;
  }
  if (st && st.k === 'named') {
    const nm = trainerLook('me').name || 'Trainer';
    return `<div class="talk"><div class="talk-art">${humanHTML('me', 96)}</div><div class="dlg px"><p class="speaker">Professor Hazel</p><p class="line">${esc(nm)}? It suits you. If it isn’t your name, it is now. Nobody should walk the Hollow Earth alone, so here: choose your very first Billie.</p><button class="pb dark wide" data-a="intro">Choose a starter</button></div></div>`;
  }
  const pk = RULES.start.starters.filter(l => SP[l + '0']);
  return `<header class="bar"><div><div class="sub">Professor Hazel’s lab</div><h1 class="where">Pick your starter</h1></div></header><p class="note">Each one beats one of the others. Your rival will pick whichever beats yours.</p>
 <div class="starters">${pk
   .map((l, j) => {
     const s = SP[l + '0'],
       t = s.types[0];
     const st = TYPES.filter(x => eff(t, [x]) > 1),
       wk = TYPES.filter(x => eff(x, [t]) > 1);
     return `<button class="starter px" data-a="pick" data-l="${l}" style="--d:${j * 80}ms">${sprHTML(l + '0', 104, { act: 'cheer' })}<span><span class="sn">${s.name}</span><span class="row">${chip(t)}</span><span class="sd">${s.blurb}</span><span class="sd">Strong against ${st.join(' and ')}. Weak to ${wk.join(' and ')}.</span></span></button>`;
   })
   .join('')}</div>`;
}
const BRCOL = ['var(--ok)', 'var(--gold)', 'var(--red)', '#9B6BE0', '#4F80E8'];
function bracketSpans() {
  let lo = 0;
  return BR.map(([hi, r], i) => {
    const top = hi === Infinity ? Math.max(lo * 1.33, lo + 5000) : hi,
      o = { lo, hi: top, r, col: BRCOL[i % BRCOL.length] };
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
        `<span style="flex:${b.hi - b.lo}">${i === 0 ? `$${b.r} per step` : `$${b.r} after ${fmt(b.lo)}`}</span>`
    )
    .join('');
}
function bracketNote(st) {
  const r = rate(st),
    nb = nextBracket(st),
    i = BR.indexOf(nb);
  if (i === 0) return `Full rate for ${fmt(nb[0] - st)} more steps today.`;
  if (nb[0] === Infinity) return 'You’ve walked a lot today. Resting is good too.';
  return `Busy day! Steps now earn $${r} each until ${fmt(nb[0])}.`;
}
function encCard(q) {
  const nu = !U.seenEnc.has(q.id);
  U.seenEnc.add(q.id);
  return `<button class="enc px hidden-enc${nu ? ' pop' : ''}" data-a="enc" data-id="${q.id}" aria-label="Unknown Billie, level ${q.lvl}"><span class="no tnum">No. ${q.no}</span><span class="denom tnum">Lv ${q.lvl}</span><span class="stage-glow"></span><span class="enc-hide"><img class="pxi" src="${artURL('scene/props/tallgrass.png')}" alt=""><i>?</i></span><b>Unknown</b></button>`;
}
function stepsTo(j) {
  const t = tripTo(j);
  return t ? t.steps : Infinity;
}
function tripLeft() {
  const r = S.route;
  if (!r.plan.length) return 0;
  let n = linkCost(r.node, r.plan[0]) - r.prog;
  for (let k = 0; k < r.plan.length - 1; k++) n += linkCost(r.plan[k], r.plan[k + 1]);
  return Math.max(0, n);
}
const tripDest = () => (S.route.plan.length ? S.route.plan[S.route.plan.length - 1] : null);
/* one line about travel: where you're headed, why you're stopped, or that you're staying */
function tripStatus() {
  const r = S.route,
    d = tripDest(),
    gm = gateMsg();
  if (d == null) return { k: 'stay', t: walkMode() ? `In ${ROUTE[r.node].name}` : `Staying in ${ROUTE[r.node].name}` };
  if (walkMode()) return { k: 'guide', t: `Heading for ${ROUTE[d].name}: follow the gold arrows` };
  if (gm) return { k: 'blocked', t: gm };
  if (r.hold) return { k: 'hold', t: `Stopped on the way to ${ROUTE[d].name}` };
  const via =
    r.plan.length > 1
      ? ` via ${r.plan
          .slice(0, -1)
          .map(i => ROUTE[i].name)
          .join(', ')}`
      : '';
  return { k: 'go', t: `Walking to ${ROUTE[d].name}${via}`, left: tripLeft() };
}
function tripButtons() {
  const r = S.route,
    st = tripStatus();
  if (st.k === 'guide')
    return `<button class="pb small" data-a="stoptrip">Stop guiding me</button><button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
  if (st.k === 'stay')
    return `<button class="pb small gold" data-a="tab" data-t="map">${uiIco('map', 16)} Choose where to go</button>`;
  if (st.k === 'hold')
    return `<button class="pb small gold" data-a="resumetrip">Keep walking</button>${r.prog > 0 ? '<button class="pb small" data-a="turnback">Turn back</button>' : ''}<button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
  if (st.k === 'blocked')
    return `<button class="pb small" data-a="tab" data-t="map">${uiIco('map', 16)} Choose another way</button>${r.prog === 0 ? '<button class="pb small quiet" data-a="stay">Stay here</button>' : '<button class="pb small" data-a="turnback">Turn back</button>'}`;
  return `<button class="pb small" data-a="stoptrip">${r.prog > 0 ? 'Stop walking' : 'Stay here instead'}</button><button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
}
function nodeActions(i) {
  const n = ROUTE[i],
    node = S.route.node;
  let x = '';
  if (i !== node) return '';
  if (n.shop && SHOPS[n.shop])
    x += `<button class="pb small gold" data-a="shop" data-s="${n.shop}">${uiIco('mint', 16)} ${esc(SHOPS[n.shop].name)}</button>`;
  if (n.boutique && SHOPS[n.boutique])
    x += `<button class="pb small" data-a="shop" data-s="${n.boutique}">${uiIco('profile', 16)} ${esc(SHOPS[n.boutique].name)}</button>`;
  x += n.town
    ? '<button class="pb small" data-a="clinic">Rest at the clinic, free</button>'
    : `<button class="pb small quiet" data-a="rest">Rest stop, $${fmt(RULES.steps.restCost)}</button>`;
  trainersAt(i).forEach(T => {
    const done = S.flags[T.id];
    if (T.blocks && done && !T.seat) return;
    x += `<button class="pb small ${done ? 'quiet' : 'red'}" data-a="trainer" data-t="${T.id}">${done ? 'Rematch' : T.seat ? 'Challenge' : 'Battle'} ${esc(T.name)}</button>`;
  });
  return `<div class="racts">${x}</div>`;
}
function boardNote(i) {
  if (S.route.node !== i) return '';
  return trainersAt(i)
    .filter(T => T.hint && !S.flags[T.id])
    .map(T => `<p class="note">${esc(T.hint)}</p>`)
    .join('');
}
function hereCard() {
  const node = S.route.node,
    here = ROUTE[node],
    st = tripStatus(),
    nx = nextStop();
  let prog = '';
  if (st.k === 'go' || st.k === 'hold') {
    const c = linkCost(node, nx),
      f = S.route.prog / c;
    prog = `<div class="nextstop"><div class="ns-top"><span>${esc(st.t)}</span><b>${esc(ROUTE[nx].name)}</b></div><div class="trail">${bar(f, 'trailbar live')}<span class="walker" style="left:${clamp(f, 0, 1) * 100}%">${owHTML()}</span></div><span class="note tnum">${fmt(tripLeft())} steps to go</span></div>`;
  } else if (st.k === 'blocked') {
    const bl = blockerAt(node);
    prog =
      bl && S.route.prog === 0
        ? `<div class="event"><b>${esc(bl.blockTitle || bl.name + ' is blocking the way')}</b><p>${esc(bl.blockText || 'Beat them to keep walking.')}</p></div>`
        : `<p class="note gate">${esc(st.t)}</p>`;
  } else
    prog = `<p class="note">You’re staying here. Steps still earn money, hatch eggs and bring encounters. Open the map to pick a place to walk to.</p>`;
  return `<section class="here px glass"><div class="route-art"${here.banner ? ` style="background-image:url('${artURL(here.banner)}')"` : ''}><span>${humanHTML('me', 64)}</span><button class="route-profile" data-a="customize">${esc(cleanTrainer(S.avatar, S.gender).name)} · Edit look</button></div><div class="sec-h"><div><div class="sub">${esc(placeSub(here))}</div><h2>${here.name}</h2></div><button class="pb small quiet" data-a="tab" data-t="map">Open map</button></div><p class="note">${here.blurb}</p>${boardNote(node)}${prog}<div class="racts">${tripButtons()}</div>${nodeActions(node)}</section>`;
}
function owHTML() {
  const u = owHTMLsheet('me');
  return `<span class="spr fast ow-mini" style="width:22px;height:40px"><img src="${u}" alt=""></span>`;
}
function eggSlots() {
  const slots = Array.from({ length: EGG_SLOTS() }, (_, i) => i)
    .map(sl => {
      const e = S.eggs.find(x => x.slot === sl);
      if (!e)
        return `<div class="slot px empty"><span class="egg-e"></span><b>Empty incubator</b><span class="note">Win battles to find eggs.</span></div>`;
      const T = EGGS[e.tier];
      return `<div class="slot px">${eggHTML(e.tier, 48, 'wob')}<b>${e.tier} km egg</b>${bar(e.prog / T.need, 'live')}<span class="note tnum">${km(e.prog)} of ${e.tier} km</span></div>`;
    })
    .join('');
  const pipe = S.eggs.filter(e => e.slot == null);
  return `<section><div class="sec-h"><h2>Eggs</h2><span class="count tnum">${S.eggs.length}/${RULES.eggs.capacity}</span></div><div class="slots">${slots}</div>${pipe.length ? `<div class="pipe"><span class="note">Waiting for an incubator:</span>${pipe.map(e => eggHTML(e.tier, 26)).join('')}</div>` : ''}</section>`;
}
function buddyCard() {
  const m = findMon(S.buddy);
  if (!m) return '';
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1),
    e = SP[m.sp].evo;
  const ev =
    e && e.k === 'buddy'
      ? `<div class="note">Buddy distance: ${km(m.bsteps || 0)} of ${km(e.steps)} km to evolve.</div>${bar((m.bsteps || 0) / e.steps, 'gold')}`
      : '';
  return `<section><div class="sec-h"><h2>Buddy</h2></div><div class="buddy px" data-a="mon" data-u="${m.uid}" role="button" tabindex="0">${sprHTML(m.sp, 80, { gold: m.gold })}<div class="bd"><div class="bn">${esc(N(m))} <span class="lv tnum">Lv ${m.lvl}</span></div><div class="note">Earns 1 XP for every ${plural(RULES.progression.buddyStepsPerXp, 'step')}. ${fmt(Math.ceil((b - m.xp) * RULES.progression.buddyStepsPerXp))} more steps to level ${m.lvl + 1}.</div>${bar((m.xp - a) / (b - a), 'xpb')}${ev}</div></div></section>`;
}
function roomHero() {
  const I = U.inside,
    sc = dioScene(I.id) || {},
    here = ROUTE[S.route.node],
    what =
      {
        shop: 'Tap the counter to shop.',
        clinic: 'Tap the desk and your team is patched up, free.',
        lab: 'Tap the professor or the machine to talk.',
        house: 'Tap whoever lives here to chat.',
        home: 'Your room in Granny Juniper’s cottage. Decorate it with what you’ve found.',
      }[I.kind] || '';
  return `<div class="walk-hero" id="walkHero">${whCard(esc(here.name), esc(I.name || sc.name || 'Inside'), `<p class="wh-gate">${esc(what)}</p>`, (I.kind === 'home' ? `<button class="pb small gold" data-a="decorate">Decorate</button>` : '') + `<button class="pb small" data-a="leaveroom">${uiIco('door', 14)} Go outside</button>`)}
 <div class="wh-foot"><div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIco('fish', 14)} Fish</button><button class="wh-down glass" data-a="walkdown" aria-label="Show actions">${uiIco('chev', 18)}<span>Actions</span></button><span class="wh-steps glass tnum">${uiIco('walk', 14)} ${fmt(S.day.steps)}</span></div></div></div>`;
}
/* v31: the place card: compact (where, the hour and weather, staying or walking, one main button; the rest folded
   under More), closable with ×, and brought back by tapping the place's name in the top bar. Closed stays closed. */
function whCard(sub, name, mid, btns) {
  if (S.preferences && S.preferences.cardClosed) return '';
  const all = String(btns).match(/<button[\s\S]*?<\/button>/g) || [],
    main = all[0] || '',
    more = all.slice(1).join('');
  return `<div class="wh-card glass compact"><div class="wh-top"><div class="sub">${sub}</div><button class="wh-x" data-a="card-close" aria-label="Hide this card"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div><h1 class="where">${name}</h1>${mid}<div class="wh-acts">${main}${more ? `<details class="wh-more"><summary>More</summary><div class="wh-more-b">${more}</div></details>` : ''}</div></div>`;
}
function envLine() {
  if (typeof envLabel !== 'function' || !ENV.on) return '';
  const t = envLabel();
  if (!t) return '';
  const h = envHint();
  return `<p class="wh-env">${uiIco(envIcon(), 12)} ${esc(t)}${h ? `<span> · ${esc(h)}</span>` : ''}</p>`;
}
function walkHero() {
  if (U.inside && !U.bench && roomState()) return roomHero();
  if (U.bench && U.bench.test && dioScene(U.bench.id)) {
    /* v20: a test scene from the debug menu */ const sc = dioScene(U.bench.id);
    return `<div class="walk-hero" id="walkHero"><div class="wh-card glass">${U.bench.id === 'gallery' ? `<div class="sub">Settings</div><h1 class="where">Graphics gallery</h1><p class="wh-gate">Walk to a signpost, then move the dial below and watch what changes.</p>` : `<div class="sub">Test scene</div><h1 class="where">${esc((sc.name || U.bench.id).replace(/^Test: /, ''))}</h1><p class="wh-gate">${(sc.checks || []).length} walking checks. Debug menu → Test scenes runs them.</p>`}<div class="wh-acts"><button class="pb small gold" ${U.bench.id === 'gallery' ? 'data-a="gal-leave"' : 'data-a="dbg" data-x="untest"'}>${U.bench.id === 'gallery' ? 'Back to Settings' : 'Back to the game'}</button></div></div></div>`;
  }
  const node = S.route.node,
    here = ROUTE[node],
    q = S.queue,
    st = tripStatus(),
    nx = nextStop();
  let next = '';
  if (st.k === 'go')
    next = `<div class="wh-next"><span>${esc(st.t)}</span><span class="tnum">${fmt(st.left)} steps</span>${bar(S.route.prog / linkCost(node, nx), 'trailbar live')}</div>`;
  else next = `<p class="wh-gate">${esc(st.t)}</p>`;
  return `<div class="walk-hero" id="walkHero">${whCard(esc(placeSub(here)), esc(here.name), envLine() + next, tripButtons())}
 <div class="wh-foot">${q.length ? `<p class="wh-hint glass">${uiIco('spark', 12)} ${plural(q.length, 'Billie')} hiding nearby. Tap a <b>?</b> to battle.</p>` : S.route.prog === 0 ? `<p class="wh-hint glass">${uiIco('walk', 12)} Tap the ground to walk around. Tap buildings, people and signs.</p>` : ''}
  <div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIco('fish', 14)} Fish</button><button class="pb small glass" data-a="photo" aria-label="Photo mode">${uiIco('camera', 14)}</button><button class="wh-down glass" data-a="walkdown" aria-label="Show actions">${uiIco('chev', 18)}<span>Actions</span></button><span class="wh-steps glass tnum">${uiIco('walk', 14)} ${fmt(S.day.steps)}</span></div></div></div>`;
}
function renderWalk() {
  rollDay();
  const st = S.day.steps,
    r = rate(st),
    q = S.queue;
  return `${walkHero()}<div class="walk-sheet"><span class="ws-grip" aria-hidden="true"></span>
 <div class="cols"><div class="col">
 <div class="today px glass"><div class="today-top"><div><div class="big tnum" data-count="steps" data-to="${st}">${fmt(st)}</div><div class="lbl">steps today</div></div><div class="se"><div class="mid tnum">$<span data-count="se" data-to="${S.se}">${fmt(S.se)}</span></div><div class="lbl">Money</div></div></div>
  <div class="brackets" role="img" aria-label="Earning $${r} per step">${bracketBars(st)}</div><div class="brk-l">${bracketLabels()}</div>
  <p class="note">${bracketNote(st)}</p></div>
 ${walkMode() ? `<section class="walkbtns"><p class="note">Walk with the joystick (drag anywhere on the scene) or tap where you want to go. The arrows at the edges lead on to the next place; the steps you take count here.</p></section>` : ''}
 ${typeof chalCard === 'function' ? chalCard() : ''}${typeof reqList === 'function' && reqList() ? `<section class="chal px glass"><div class="sec-h"><h2>Requests you’re helping with</h2></div>${reqList()}</section>` : ''}${hereCard()}</div><div class="col">
 <section class="pending"><div class="sec-h"><h2>Encounters</h2><span class="count tnum">${q.length}/${RULES.steps.maxEncounters}</span></div>
  <p class="note">${q.length >= RULES.steps.maxEncounters ? 'Your area is full. Battle or tax a few to make room.' : `Next one in about ${fmt(Math.ceil((RULES.steps.encounterEverySE - S.meter) / r))} steps.`} You only see their level until the battle starts.</p>
  ${q.length ? `<div class="queue">${q.map(encCard).join('')}</div>` : `<div class="empty px">No Billies nearby. Walk about ${fmt(RULES.steps.encounterEverySE)} steps and one will wander over.</div>`}</section>
 ${eggSlots()}${buddyCard()}</div></div></div>`;
}
/* ---------- the walk scene behind the Walk tab ---------- */
export function sceneIdAt(i) {
  const S0 = GD.scenes || {},
    r = ROUTE[i];
  if (r && r.scene && S0[r.scene]) return r.scene;
  return Object.keys(S0)[0] || null;
}
/* which road leaves a stop's scene through which exit: matched by compass direction on the world map */
/* v42: the join table first (a road names the exit at each end, by id); roads without one fall back to the bearing */
function sceneExits(node) {
  const sc = dioScene(sceneIdAt(node)),
    ex = (sc && sc.exits) || [],
    out = {};
  if (!sc || !ex.length) return out;
  const E = sc.edgeExits || [];
  for (const e of ADJ[node]) {
    const L = LINKS[e.i],
      J = L && L[3];
    if (!J) continue;
    const id = L[0] === node ? J.a : J.b,
      k = id ? E.findIndex(q => q.id === id) : -1;
    if (k >= 0) out[e.to] = k;
  }
  return sceneExitsByBearing(node, sc, ex, out);
}
function sceneExitsByBearing(node, sc, ex, out) {
  out = out || {};
  const hub = dioHubOf(sc),
    me = ROUTE[node],
    pairs = [];
  for (const e of ADJ[node]) {
    if (e.to in out) continue;
    const o = ROUTE[e.to],
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
/* v26: walking into shops, the clinic, the lab and houses. U.inside remembers the room and where you came in */
const ROOM_OF = { shop: 'int_shop', clinic: 'int_clinic', lab: 'int_lab', house: 'int_house', home: 'int_home' };
/* v46: a building's own room: one set on it in the Studio ("room"), else the room made for its kind of building
   (a bakery, an inn, a bank...), else the room for what it does (shop, clinic, lab, house) */
const ROOM_KIND = {
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
provide({ ROOM_KIND }); /* to-module */
function roomFor(a, p) {
  if ((S.preferences || {}).rooms === 'quick' && a !== 'home') return null;
  if (a !== 'home' && p) {
    if (p.room && dioScene(p.room)) return p.room;
    const M = dioData().sc.props[p.k],
      k = ROOM_KIND[p.k] || (M && ROOM_KIND[M.group]);
    if (k && dioScene(k)) return k;
  }
  const id = ROOM_OF[a];
  return id && dioScene(id) ? id : null;
}
function enterRoom(a, p) {
  const id = roomFor(a, p);
  if (!id || !walkView.pl) return false;
  const here = ROUTE[S.route.node];
  const info = {
    id,
    kind: a,
    node: S.route.node,
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
  if (id === 'int_home' && typeof homeApply === 'function') homeApply();
  /* v46: the room laid into the place where the building stands: step in once it's ready (a moment at most) */
  const lay = roomLayIn(id, p, true);
  if (lay) {
    Object.assign(info, lay);
    U.goingIn = info;
    const P = walkView.pl,
      fr = [lay.door[0], lay.door[1] - 0.45];
    if (Math.hypot(P.x - fr[0], P.z - fr[1]) > 1.6) dioWalkTo(dioFreePt(fr[0], fr[1]), () => roomStepIn(info));
    else roomStepIn(info);
    return true;
  }
  U.inside = info;
  U.roam = null;
  if (typeof sfx === 'function') sfx('door');
  if (typeof NWLOG !== 'undefined') NWLOG.add('scene', 'inside ' + id);
  render();
  return true;
}
/* v46: seamless rooms (seamless-world.js wrRoomScene). The room's view is the place's own view with the room laid in at the
   building's door, so going in and out is a shift of nothing. roomLayIn makes (and starts preparing) that view;
   it is also called when you tap a building, so the room is usually ready by the time you reach the door. */
function roomLayIn(id, p, fresh) {
  if (
    typeof wrRoomScene !== 'function' ||
    !wrOn() ||
    !walkView.ready ||
    !walkView.sc ||
    !walkView.sc.parts ||
    walkView.sc.roomRect ||
    typeof DGL === 'undefined' ||
    !DGL.on ||
    !walkView.pl ||
    !p
  )
    return null;
  if (eng('world', 'seamlessRooms') === false) return null;
  const C = dioData().sc,
    M = C.props[p.k];
  if (!M || !M.box) return null;
  const s = p.s || 1,
    f = p.f ? -1 : 1,
    dx = (((M.door && M.door.x) || 0) / (C.ppu || 34)) * s * f,
    door = [+(p.x + dx).toFixed(1), +(+p.z).toFixed(1), +(+p.x).toFixed(1)]; /* the door, and the building's middle */
  if (fresh)
    WORLD.cache.delete(
      wrRoomId(walkView.id, id, door) + '|' + WORLD.gen
    ); /* the room as it is now (your room's decorations) */
  const sc = wrRoomScene(walkView.id, id, door);
  if (!sc) return null;
  wrGetReady(sc.id, true, door);
  return { view: sc.id, door, base: walkView.id };
}
/* the room's things changed while you're in it (your room's decorations): lay it in again */
function roomRefresh() {
  const I = U.inside;
  if (!I || !I.view || walkView.id !== I.view || !walkView.sc) return;
  WORLD.cache.delete(I.view + '|' + WORLD.gen);
  const n = wrRoomScene(I.base, I.id, I.door);
  if (!n) return;
  walkView.sc.props = n.props;
  if (typeof DGL !== 'undefined') DGL.itemGen = (DGL.itemGen || 0) + 1;
  walkView.nav = null;
}
function roomAim(h) {
  if (!h || h.k !== 'act' || !ROOM_OF[h.act] || U.inside) return;
  if (typeof placeOpen === 'function' && !placeOpen(openKind(h.act, h.p))) return;
  const id = roomFor(h.act, h.p);
  if (id) roomLayIn(id, h.p);
}
function roomStepIn(info, n = 0) {
  if (U.goingIn !== info) return;
  const P = walkView.pl,
    fr = [info.door[0], info.door[1] - 0.45];
  if (!P || walkView.id !== info.base || Math.hypot(P.x - fr[0], P.z - fr[1]) > 2.2) {
    U.goingIn = null;
    return;
  } /* you walked off, or the view moved on */
  if (!wrGetReady(info.view, true, info.door)) {
    if (typeof DGL !== 'undefined') DGL.prepBoost = Math.max(DGL.prepBoost || 1, 3);
    /* you're standing at the door: bigger slices */ if (n < (U.roomWait || 90)) {
      setTimeout(() => roomStepIn(info, n + 1), 100);
      return;
    }
    info.view = null;
    if (typeof NWLOG !== 'undefined') NWLOG.add('scene', `room ${info.id} wasn't ready in 9 s; shown on its own`);
  }
  U.goingIn = null;
  U.inside = info;
  U.roam = null;
  if (typeof DGL !== 'undefined') DGL.prepBoost = 1;
  if (typeof sfx === 'function') sfx('door');
  if (typeof NWLOG !== 'undefined')
    NWLOG.add('scene', 'inside ' + (info.view || info.id) + (n ? ` (waited ${n * 100} ms)` : ''));
  render();
  if (info.view)
    setTimeout(() => {
      if (U.inside === info && walkView.id === info.view && walkView.pl && walkView.sc)
        dioWalkTo(dioHubOf(walkView.sc));
    }, 80);
}
export function leaveRoom() {
  const I = U.inside;
  if (!I) return;
  U.inside = null;
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
    const B = dioScene(I.base),
      o = (B && B.baseOff) || [0, 0];
    U.roam = { id: (B && B.baseId) || I.back.id, node: I.node, x: fr[0] - o[0], z: fr[1] - o[1] };
    U.backAt = null;
    if (typeof sfx === 'function') sfx('door');
    render();
    return;
  }
  U.roam = U.backAt = { id: I.back.id, node: I.node, x: I.back.x, z: I.back.z };
  if (typeof sfx === 'function') sfx('door');
  render();
}
function roomAct(h) {
  const I = U.inside;
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
  if (pa === 'lift' && typeof liftGo === 'function') {
    liftGo(h.p);
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
    const here = ROUTE[S.route.node],
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
    const c = (dioScene(I.id) || {}).chat || [];
    toast(c.length ? `“${c[Math.floor(Math.random() * c.length)]}”` : 'They wave hello.');
  }
}
function roomState() {
  const I = U.inside;
  if (!I) return null;
  if (I.node !== S.route.node) {
    U.inside = null;
    return null;
  }
  if (I.view) {
    const sc = dioScene(I.view);
    if (!sc) {
      U.inside = null;
      return null;
    }
    const dr = sc.roomDoor || I.door,
      pos = walkView.id === I.view && walkView.pl ? [walkView.pl.x, walkView.pl.z] : [dr[0], dr[1] - 0.45];
    return {
      id: I.view,
      node: S.route.node,
      mode: 'roam',
      pos,
      roam: true,
      who: 'me',
      enc: [],
      npcs: sc.keeper ? [{ who: sc.keeper, id: '_keeper:' + I.id, done: true, exit: null, dir: 'down' }] : [],
      exits: [{ i: 0, to: -1, name: 'Outside', out: 1 }],
    };
  }
  const sc = dioScene(I.id);
  if (!sc) {
    U.inside = null;
    return null;
  }
  const pos = U.roam && U.roam.id === I.id ? [U.roam.x, U.roam.z] : dioHubOf(sc);
  return {
    id: I.id,
    node: S.route.node,
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
  const rs = !U.bench && roomState();
  if (rs) return rs;
  if (U.bench && U.bench.id && dioScene(U.bench.id)) {
    const sc = dioScene(U.bench.id);
    return {
      id: U.bench.id,
      node: S.route.node,
      mode: 'roam',
      pos: dioHubOf(sc),
      roam: true,
      who: 'me',
      enc: [],
      npcs: [],
      exits: [],
    };
  }
  const r = S.route,
    node = r.node,
    nx = walkMode() ? null : nextStop(),
    c = nx != null ? linkCost(node, nx) : 0,
    f = nx != null && c ? clamp(r.prog / c, 0, 1) : 0;
  let v; /* alpha 0.4.1: walking yourself, the view is always the place you're in */
  /* v43: a trip is a walk along the road's ground (seamless-world.js): the scene with the road leaving, the road, the far scene with the road arriving */
  const tv = nx != null && (r.prog > 0 || !r.hold) && typeof wrTripView === 'function' ? wrTripView(node, nx, f) : null;
  if (tv) {
    const base = tv.sc.baseId === sceneIdAt(nx) ? nx : node;
    v = { id: tv.id, node: base, mode: 'road', pos: tv.pos, roam: true, road: tv.u };
    if (typeof wrPrefetch === 'function') wrPrefetch(tv.R, tv.u, tv.fwd, tv);
  } else if (nx != null && r.prog > 0 && f >= 0.5) {
    const id = sceneIdAt(nx),
      sc = dioScene(id) || {},
      hub = sc.w ? dioHubOf(sc) : [0, 0],
      k = sceneExits(nx)[node];
    v = { id, node: nx, mode: 'path', from: sc.exits && k != null ? sc.exits[k] : hub, to: hub, t: (f - 0.5) / 0.5 };
  } else {
    const id = sceneIdAt(node),
      sc = dioScene(id) || {},
      hub = sc.w ? dioHubOf(sc) : [0, 0],
      bk = U.backAt,
      pos =
        bk && bk.node === node && bk.id === id
          ? [bk.x, bk.z]
          : U.roam && U.roam.node === node && U.roam.id === id
            ? [U.roam.x, U.roam.z]
            : hub;
    if (nx != null && r.prog > 0) {
      const k = sceneExits(node)[nx];
      v = { id, node, mode: 'path', from: pos, to: sc.exits && k != null ? sc.exits[k] : hub, t: f / 0.5 };
    } else {
      /* v43: near an exit the road leaving it is part of the view (positions are kept in the scene's own metres) */ const wo =
          walkView.ready && walkView.pl && !walkView.pl.fresh ? walkOff(id) : null,
        live = !!wo,
        lo = wo,
        wv =
          typeof wrRoamView === 'function'
            ? wrRoamView(node, live ? [walkView.pl.x - lo[0], walkView.pl.z - lo[1]] : pos)
            : null;
      if (wv) {
        const o = wv.sc.baseOff;
        v = { id: wv.id, node, mode: 'roam', pos: [pos[0] + o[0], pos[1] + o[1]], roam: true };
      } else v = { id, node, mode: 'roam', pos, roam: true };
      /* v43: arriving: you stand at the exit the road came in by and walk to the hub; if the road left you outside the scene, you start at that exit */
      if (live && sc.w && U.arrive === node) {
        const P = walkView.pl,
          lx = P.x - lo[0],
          lz = P.z - lo[1],
          out = lx < 0 || lz < 0 || lx > sc.w || lz > sc.h;
        U.arrive = null;
        if (out && !(walkView.sc && walkView.sc.parts)) {
          /* v46: with the road in view you simply walk in from where you are; the snap is only for a scene shown alone */ const ex =
            (sc.exits || [])
              .slice()
              .sort((a, b) => Math.hypot(a[0] - lx, a[1] - lz) - Math.hypot(b[0] - lx, b[1] - lz))[0];
          if (ex) {
            const q = dioFreePt(ex[0] + lo[0], ex[1] + lo[1]);
            P.x = q[0];
            P.z = q[1];
          }
        }
        const r = dioFind(P.x, P.z, hub[0] + lo[0], hub[1] + lo[1]);
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
  /* v46: a new view is shown only once its ground is ready on the card; until then you stay in the one on screen (seamless-world.js wrGate) */
  if (typeof wrGate === 'function' && v && v.pos && (v.mode === 'road' || v.roam)) v = wrGate(v);
  const sc = dioScene(v.id) || {},
    ex = sceneExits(v.node),
    bl = blockerAt(v.node),
    dest = v.node === node ? (walkMode() ? (S.route.plan[0] ?? null) : nextStop()) : null;
  v.exits = ADJ[v.node]
    .map(e => ({
      i: ex[e.to],
      to: e.to,
      name: ROUTE[e.to].name,
      dest: e.to === dest,
      locked: !canEnter(e.to) || (!!bl && !S.visited[e.to]),
    }))
    .filter(e => e.i != null);
  v.npcs = trainersAt(v.node)
    .filter(T => !(T.blocks && S.flags[T.id] && !T.seat))
    .map(T => {
      let exit = null;
      if (T.blocks && !S.flags[T.id]) {
        const e = v.exits.find(e => !S.visited[e.to]);
        if (e && sc.exits) exit = sc.exits[e.i];
      }
      return { who: T.who, id: T.id, done: !!S.flags[T.id], exit, dir: 'down' };
    });
  /* alpha 0.4: people who only talk (Granny Juniper in her garden): the place's own (scene.people), in the view's metres */
  {
    const bid = sc.baseId || v.id,
      base = dioScene(bid),
      o = sc.baseOff || [0, 0];
    if (base && bid === sceneIdAt(v.node))
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
  v.enc = S.queue.map(q => ({ id: q.id, lvl: q.lvl, sp: q.sp, gold: q.gold, alpha: !!q.alpha }));
  return v;
}
export function walkPick(h) {
  const node = S.route.node,
    here = ROUTE[node];
  if (U.inside) {
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
    const q = S.queue.find(x => x.id === h.e.id);
    if (q) {
      U.encAt = h.look || null;
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
    if (a === 'climb' && typeof dioClimb === 'function') {
      dioClimb(p);
      return;
    }
    /* alpha 0.4: an airship mast (or a sky lift, or the terminal's ticket window): fly to a town you've been to */
    if (a === 'fly' && typeof flyMenu === 'function') {
      flyMenu(p);
      return;
    }
    if (a === 'lift' && typeof liftGo === 'function') {
      liftGo(p);
      return;
    }
    /* v47: shops and the like keep opening hours */
    if (typeof placeOpen === 'function') {
      const kind = openKind(a, p);
      if (!placeOpen(kind)) {
        toast(placeClosedText(kind));
        return;
      }
    }
    if (ROOM_OF[a] && enterRoom(a, p)) return;
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
    if (Date.now() - (U.groundTip || 0) > 6000) {
      U.groundTip = Date.now();
      toast(
        st.k === 'go'
          ? `You’re on your way to ${ROUTE[tripDest()].name}. Tap “Stop walking” to look around.`
          : st.k === 'hold'
            ? 'You’re between stops. Keep walking or turn back.'
            : 'Tap the ground to walk there.'
      );
    }
  }
}
function exitPrompt(e) {
  const to = e.to,
    o = ROUTE[to];
  if (!canEnter(to)) {
    toast(gateText(o));
    return;
  }
  if (e.locked) {
    const bl = blockerAt(S.route.node);
    toast(bl ? `${bl.name} is blocking the way. Beat them first.` : 'That road is closed.');
    return;
  }
  /* alpha 0.4.1: walking yourself: tapping the way out walks you out of the place and on into the next */
  if (walkMode()) {
    const sc = walkView.sc,
      pt = sc && sc.exits && sc.exits[e.i];
    if (!pt || !walkView.pl) return;
    const hub = dioHubOf(sc),
      dx = pt[0] - hub[0],
      dz = pt[1] - hub[1],
      l = Math.hypot(dx, dz) || 1;
    dioWalkTo(dioFreePt(pt[0] + (dx / l) * 3.5, pt[1] + (dz / l) * 3.5));
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
    title: `Walk to ${esc(o.name)}?`,
    html: `<p class="note">${esc(o.blurb || '')}</p><p><b class="tnum">${fmt(t.steps)} steps</b> · about ${km(t.steps)} km${S.visited[to] ? '' : ' · somewhere new'}</p>${poolStrip(o.pool)}<p class="note">Your real steps walk you there. You can stop or change plans any time.</p>`,
    btns: [
      {
        l: `${uiIco('walk', 16)} Start walking`,
        c: 'gold',
        f: () => {
          closeModal();
          if (setTrip(to)) {
            const T = tripStatus();
            toast(T.k === 'go' ? `${T.t}. ${fmt(T.left)} steps.` : T.t);
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
function walkOff(id) {
  const sc = walkView.sc;
  if (!sc || !id) return null;
  if ((sc.baseId || walkView.id) === id) return sc.baseOff || [0, 0];
  const q = (sc.parts || []).find(q => q.id === id);
  return q ? [q.ox || 0, q.oz || 0] : null;
}
function walkCross() {
  if (
    !walkMode() ||
    !S.started ||
    !walkView.ready ||
    !walkView.sc ||
    !walkView.pl ||
    U.inside ||
    U.bench ||
    (typeof B !== 'undefined' && B) ||
    (typeof CS !== 'undefined' && CS.on)
  )
    return;
  const sc = walkView.sc,
    P = walkView.pl,
    node = S.route.node,
    parts = sc.parts;
  if (!parts) return;
  for (const q of parts) {
    const s = dioScene(q.id);
    if (!s || s.kind === 'room') continue;
    const x = P.x - (q.ox || 0),
      z = P.z - (q.oz || 0);
    if (x < 0 || z < 0 || x > s.w || z > s.h) continue;
    const n = ROUTE.findIndex(r => r.scene === q.id);
    if (n < 0 || n === node) {
      U.walkOk = [P.x, P.z, walkView.id];
      return;
    }
    if (Math.min(x, z, s.w - x, s.h - z) < 1 || !ADJ[node].some(e => e.to === n)) return;
    const bl = blockerAt(node),
      why = !canEnter(n)
        ? gateText(ROUTE[n])
        : bl && !S.visited[n]
          ? `${bl.name} is blocking the way. Beat them first.`
          : null;
    if (why) {
      const w = U.walkOk;
      if (w && w[2] === walkView.id) {
        P.x = w[0];
        P.z = w[1];
      }
      P.route = null;
      P.goal = null;
      if (Date.now() - (U.walkBounceT || 0) > 3500) {
        U.walkBounceT = Date.now();
        toast(why);
      }
      return;
    }
    const r = S.route,
      plan = r.plan && r.plan[0] === n ? r.plan.slice(1) : [];
    S.route = { node: n, prog: 0, plan, hold: false };
    S.visited[n] = 1;
    U.roam = { id: q.id, node: n, x, z };
    U.arrive = null;
    U.backAt = null;
    if (typeof NWLOG !== 'undefined') NWLOG.add('travel', 'walked into ' + ROUTE[n].name);
    save();
    render();
    return;
  }
}
/* alpha 0.4.1: a view that was held until it was ready (seamless-world.js wrGate) takes over as soon as it is: walking yourself,
   nothing else would ask for it (a trip did, with each batch of steps) */
setInterval(() => {
  try {
    if (
      !S.started ||
      U.tab !== 'walk' ||
      (typeof B !== 'undefined' && B) ||
      (typeof CS !== 'undefined' && CS.on) ||
      typeof walkView === 'undefined' ||
      !walkView.ready ||
      !walkView.cv
    )
      return;
    const v = walkState();
    if (v && v.id && v.id !== walkView.id && !v.held) walkSceneSync();
  } catch (e) {}
}, 400);
function walkSceneSync() {
  if (typeof CS !== 'undefined' && CS.on) return;
  /* in a battle the scene keeps running inside the battle stage (battle-3d.js) when it can; otherwise it stops */
  if (B) {
    document.body.classList.remove('on-walk', 'on-scene');
    if (walkView.battle) {
      const cv = walkView.cv,
        host = $('#camWorld');
      if (cv && !cv.isConnected && host) {
        host.insertBefore(cv, host.firstChild);
        if (typeof battleGLLayout === 'function') battleGLLayout();
      }
      return;
    }
    if (typeof battleGLWanted === 'function' && battleGLWanted()) return;
    const cv = $('#dio');
    if (cv) cv.hidden = true;
    if (walkView.cv) dioStop();
    return;
  }
  const on = S.started && U.tab !== 'map' && !!sceneIdAt(S.route.node),
    walk = on && U.tab === 'walk';
  let cv = $('#dio');
  document.body.classList.toggle('on-walk', walk);
  document.body.classList.toggle('on-scene', on && !walk);
  if (!on) {
    if (walkView.cv) dioStop();
    if (U.tab === 'map' && S.started && typeof mapGLWanted === 'function' && mapGLWanted()) {
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
  if (walkView.id !== id && walkView.cv && walkView.ready && typeof wrDelta === 'function') {
    const d = wrDelta(walkView.id, id);
    /* alpha 0.2: neighbouring places share their edges, so most views share a part; a walk carries on into the next view,
     a jump somewhere else (not where you are walking to) opens it fresh */
    const walking =
      !d ||
      ws.mode === 'road' ||
      !ws.pos ||
      !walkView.pl ||
      Math.hypot(walkView.pl.x + d[0] - ws.pos[0], walkView.pl.z + d[1] - ws.pos[1]) < 25;
    if (d && walking && dioShift(id, d[0], d[1])) {
      artLoad(dioPaths(walkView.sc)).catch(() => {});
      return;
    }
  }
  if (walkView.id !== id || !walkView.cv) {
    if (walkView.id && walkView.id !== id) {
      cv.classList.remove('in');
      void cv.offsetWidth;
    }
    dioMount(cv, id, {
      state: walkState,
      onPick: walkPick,
      onAim: roomAim,
      onMove: (x, z) => {
        if (typeof walkCross === 'function') walkCross();
        /* after leaving a room you stand at its door: nothing in between moves that */ if (
          !U.inside &&
          /^int_/.test(walkView.id || '')
        )
          return;
        const sid = sceneIdAt(S.route.node),
          po = walkOff(sid),
          o = po || (walkView.sc && walkView.sc.baseOff) || [0, 0],
          bk = U.backAt;
        if (bk) {
          if (walkOff(bk.id) && Math.hypot(x - walkOff(bk.id)[0] - bk.x, z - walkOff(bk.id)[1] - bk.z) < 0.6)
            U.backAt = null;
          else return;
        }
        U.roam = {
          id: po ? sid : (walkView.sc && walkView.sc.baseId) || walkView.id,
          node: S.route.node,
          x: x - o[0],
          z: z - o[1],
        };
      },
      keys: () => !U.modal && U.tab === 'walk' && scrollY < innerHeight * 0.3,
      active: () => U.tab === 'walk' && !U.modal,
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
            : U.modal
              ? 'window'
              : U.tab !== 'walk'
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
function renderMap() {
  return `<div class="map-full"><canvas id="mapcv" width="${MW}" height="${MH}" aria-label="World map. Drag to look around, tap a place."></canvas><div id="maplabels"></div>
 <div class="map-head glass"><div class="sub">The Hollow Earth</div><h1 class="where">World map</h1><p class="map-trip ${tripStatus().k}">${esc(tripStatus().t)}</p></div>
 <div class="mapctl"><button class="mbtn" data-a="mzoom" data-k="in" aria-label="Zoom in">+</button><button class="mbtn" data-a="mzoom" data-k="out" aria-label="Zoom out">−</button><button class="mbtn" data-a="mreset" aria-label="Back to you">${uiIco('walk', 16)}</button></div>
 <div class="mapcard px glass" id="mapcard">${mapCardHTML()}</div></div>`;
}
function poolStrip(pool) {
  const P = POOLS[pool];
  if (!P) return '';
  return `<div class="poolstrip">${P.list.map(([id]) => (S.seen[id] ? sprHTML(id, 36) : sprHTML(id, 36, { sil: 1, still: 1 }))).join('')}</div>`;
}
function mapCardHTML() {
  const sel = U.mapSel == null ? S.route.node : U.mapSel;
  if (typeof sel === 'string') {
    const f = FUTURE[+sel.slice(1)];
    return `<div class="mc-top"><h2>${esc(f.name)}</h2><span class="sub">${f.t === 'sun' ? 'Center of the world' : 'Unexplored'}</span></div><p>${esc(f.blurb || '')}</p><p class="note">${f.t === 'sun' ? 'Visible from everywhere in the Hollow Earth.' : 'No trainer from Marigold Town has walked this far yet. The road opens in a later version.'}</p>`;
  }
  const n = ROUTE[sel],
    node = S.route.node,
    dest = tripDest(),
    st = tripStatus(),
    here = sel === node;
  let status = '',
    btns = '';
  if (here) {
    status = st.k === 'stay' ? 'You are here.' : st.t + '.';
    btns = st.k === 'stay' ? '' : tripButtons();
  } else if (sel === dest) {
    status = `${st.t}. ${fmt(tripLeft())} steps to go.`;
    btns = tripButtons();
  } else {
    const t = tripTo(sel),
      locked = !canEnter(sel);
    if (locked) status = 'Locked. ' + gateText(n);
    else if (!t) status = 'You can’t get there from here yet.';
    else {
      status = `${fmt(t.steps)} steps · about ${km(t.steps)} km${
        t.plan.length > 1
          ? ` · via ${t.plan
              .slice(0, -1)
              .map(i => esc(ROUTE[i].name))
              .join(', ')}`
          : ''
      }${S.visited[sel] ? '' : ' · new place'}.`;
      btns = `<button class="pb small gold" data-a="travel" data-n="${sel}">${uiIco('walk', 16)} Travel here</button>`;
    }
  }
  const nb = ADJ[sel].map(e => ROUTE[e.to].name);
  return `<div class="mc-top"><h2>${esc(n.name)}</h2><span class="sub">${esc(placeSub(n))}</span></div><p class="note">${esc(n.blurb || '')}</p>${n.ride && canRide() ? `<p class="note ride">${uiIco('drop', 14)} You ride across on ${esc(riderName())}.</p>` : ''}<p class="status">${status}</p>${btns ? `<div class="racts">${btns}</div>` : ''}${poolStrip(n.pool)}<p class="note mc-nb">Roads to ${nb.map(esc).join(', ')}.</p>${nodeActions(sel)}`;
}
function paintMapCard() {
  const c = $('#mapcard');
  if (c) c.innerHTML = mapCardHTML();
}
/* ---------- team: the lead up top, the party as cards, day jobs, then storage ---------- */
const plateVars = m => {
  const t = SP[m.sp].types;
  return `--c1:${TC[t[0]][0]};--c2:${TC[t[t.length - 1]][0]}`;
};
const monState = m => (m.hp <= 0 ? '<span class="stb st-down">Fainted</span>' : stBadge(m.status));
const xpPart = m => {
  if (m.lvl >= MAXLV()) return 1;
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return clamp((m.xp - a) / (b - a), 0, 1);
};
const xpLeft = m => (m.lvl >= MAXLV() ? 'Max level' : `${fmt(xpFor(m.lvl + 1) - m.xp)} to Lv ${m.lvl + 1}`);
const needsCare = m => m.hp < maxHp(m) || !!m.status;
const meter = (k, inner, v) => `<div class="tm-meter"><span>${k}</span>${inner}<b class="tnum">${v}</b></div>`;
function teamHero(m) {
  const s = SP[m.sp],
    mx = maxHp(m),
    bud = m.uid === S.buddy;
  return `<section class="tm-hero tpanel"><button class="tm-stage" data-a="mon" data-u="${m.uid}" style="${plateVars(m)}" aria-label="${esc(N(m))}, details"><span class="tm-ribbon">Lead</span>${m.gold ? '<span class="tm-ribbon gold">Golden</span>' : ''}${sprHTML(m.sp, 120, { gold: m.gold })}</button>
 <div class="tm-info"><div class="tm-name"><h2>${esc(N(m))}</h2><span class="lv tnum">Lv ${m.lvl}</span></div>${m.nick ? `<div class="tm-sp">${esc(s.name)}</div>` : ''}
  <div class="row">${s.types.map(chip).join('')}${monState(m)}${bud ? `<span class="badge bud">${uiIco('heart', 11)} Buddy</span>` : ''}</div>
  ${meter('HP', hpBar(m.hp, mx), `${m.hp}/${mx}`)}${meter('XP', bar(xpPart(m), 'xpb'), xpLeft(m))}
  <div class="tm-acts">${needsCare(m) ? `<button class="pb small green" data-a="mheal" data-u="${m.uid}">${uiIco('heart', 14)} Heal</button>` : ''}${bud ? '' : `<button class="pb small" data-a="mbuddy" data-u="${m.uid}">${uiIco('walk', 14)} Make buddy</button>`}<button class="pb small quiet" data-a="mon" data-u="${m.uid}">Details</button></div></div></section>`;
}
function teamCard(m, i) {
  const mx = maxHp(m),
    bud = m.uid === S.buddy;
  return `<div class="tm-card${m.hp <= 0 ? ' down' : ''}" style="--d:${i * 40}ms"><button class="tm-main" data-a="mon" data-u="${m.uid}"><span class="tm-spr" style="${plateVars(m)}">${sprHTML(m.sp, 72, { gold: m.gold })}${bud ? `<i class="tm-heart" title="Buddy">${uiIco('heart', 12)}</i>` : ''}</span>
  <span class="tm-t"><b>${esc(N(m))}</b><span class="tm-lv tnum">Lv ${m.lvl}</span></span><span class="row">${SP[m.sp].types.map(chip).join('')}${monState(m)}</span>${hpBar(m.hp, mx)}<span class="hpn tnum">${m.hp}/${mx} HP</span></button>
  <div class="tm-quick"><button class="qk" data-a="mlead" data-u="${m.uid}" ${m.hp <= 0 ? 'disabled' : ''}>Make lead</button>${needsCare(m) ? `<button class="qk heal" data-a="mheal" data-u="${m.uid}">Heal</button>` : ''}</div></div>`;
}
function jobSlots() {
  const open = S.jobs.map((j, i) => (j.uid ? -1 : i)).filter(i => i >= 0);
  return `<div class="jobs">${S.jobs
    .map((j, i) => {
      if (!j.uid)
        return i !== open[0]
          ? ''
          : `<div class="job empty"><span class="job-ic">${uiIco('bag', 20)}</span><div class="jt"><b>${open.length === 1 ? '1 open job' : `${open.length} open jobs`}</b><span class="note">Each pays out every ${fmt(JOB_STEPS)} steps.</span></div><button class="pb small" data-a="hire" data-s="${i}">Hire</button></div>`;
      const m = findMon(j.uid),
        J = JOBS[j.job];
      if (!m) return '';
      return `<div class="job"><button class="job-spr" data-a="mon" data-u="${m.uid}" style="${plateVars(m)}" aria-label="${esc(N(m))}, details">${sprHTML(m.sp, 48, { gold: m.gold })}</button><div class="jt"><b>${esc(N(m))}</b><span class="note">${esc(J.n)}, ${esc(J.where)}. Earns ${esc(J.pay)}.</span>${bar(j.acc / JOB_STEPS, 'gold live')}<span class="note tnum">${fmt(JOB_STEPS - j.acc)} steps to the next pay${j.pend ? `, ${j.pend} ready` : ''}</span>
  <div class="racts"><button class="pb small ${j.pend ? 'gold' : ''}" data-a="collect" data-s="${i}" ${j.pend ? '' : 'disabled'}>Collect pay${j.pend ? ` (${j.pend})` : ''}</button><button class="pb small quiet" data-a="endshift" data-s="${i}">End shift</button></div></div></div>`;
    })
    .join('')}</div>`;
}
const BOXSORT = [
  ['new', 'Newest'],
  ['lvl', 'Level'],
  ['name', 'Name'],
];
function boxSection() {
  const all = S.box.filter(m => m.job == null),
    so = U.boxSort || 'new',
    types = [...new Set(all.flatMap(m => SP[m.sp].types))].sort();
  let f = U.boxF || 'all';
  if (f !== 'all' && !types.includes(f)) f = 'all';
  let L = all.filter(m => f === 'all' || SP[m.sp].types.includes(f));
  L =
    so === 'lvl'
      ? L.slice().sort((a, b) => b.lvl - a.lvl)
      : so === 'name'
        ? L.slice().sort((a, b) => N(a).localeCompare(N(b)))
        : L.slice().reverse();
  const full = S.team.length >= TEAM_MAX();
  const tools =
    all.length > 3
      ? `<div class="fchips tm-tools" role="group" aria-label="Sort and filter storage">${BOXSORT.map(([k, l]) => `<button class="fchip${so === k ? ' on' : ''}" data-a="boxsort" data-k="${k}" aria-pressed="${so === k}">${l}</button>`).join('')}${types.length > 1 ? `<span class="tm-sep" aria-hidden="true"></span><button class="fchip${f === 'all' ? ' on' : ''}" data-a="boxf" data-f="all" aria-pressed="${f === 'all'}">All types</button>${types.map(t => `<button class="fchip tdot${f === t ? ' on' : ''}" data-a="boxf" data-f="${t}" style="--tc:${TC[t][0]}" aria-pressed="${f === t}"><i></i>${t === 'None' ? 'Normal' : t}</button>`).join('')}` : ''}</div>`
      : '';
  return `<section class="tpanel tm-box"><div class="sec-h"><h2>Storage</h2><span class="count tnum">${all.length}</span></div>${
    all.length
      ? `<p class="note">Billies resting here don’t battle. Tap one for details.</p>${tools}
 <div class="bx-grid">${L.map(m => `<div class="bx"><button class="bx-main" data-a="mon" data-u="${m.uid}"><span class="bx-spr" style="${plateVars(m)}">${sprHTML(m.sp, 60, { gold: m.gold })}</span><b>${esc(N(m))}</b><span class="bx-sub tnum">Lv ${m.lvl}<span class="bx-dots">${SP[m.sp].types.map(t => `<i style="--tc:${TC[t][0]}" title="${t}"></i>`).join('')}</span></span></button><button class="qk" data-a="mteam" data-u="${m.uid}">${full ? 'Swap in' : 'To team'}</button></div>`).join('')}</div>`
      : '<div class="empty tm-empty">Storage is empty. When your team is full, new Billies you tax and hatchlings rest here.</div>'
  }</section>`;
}
function renderTeam() {
  const lead = S.team[0],
    rest = S.team.slice(1),
    free = S.box.filter(m => m.job == null).length,
    open = Math.max(0, TEAM_MAX() - S.team.length),
    work = S.jobs.filter(j => j.uid).length;
  const slots = open
    ? `<div class="tm-card empty tm-open"><span class="tm-plus" aria-hidden="true">+</span><span class="tm-ot"><b>${open === 1 ? '1 open spot' : `${open} open spots`}</b><span class="note">${free ? 'Bring someone back from storage.' : 'Tax more in the grass, or hatch an egg.'}</span></span>${free ? '<button class="qk" data-a="tmadd">Add from storage</button>' : ''}</div>`
    : '';
  return `<header class="bar"><div><div class="sub">${S.team.length} of ${TEAM_MAX()} on your team</div><h1 class="where">Your team</h1></div></header>
 <div class="tm-top">${lead ? teamHero(lead) : ''}<section class="tpanel tm-party"><div class="sec-h"><h2>Party</h2><span class="count tnum">${S.team.length}/${TEAM_MAX()}</span></div><p class="note">Your lead goes first in battle. Tap a card for details.</p><div class="tm-grid">${rest.map(teamCard).join('')}${slots}</div></section></div>
 <section class="tpanel tm-jobs"><div class="sec-h"><h2>Day jobs</h2><span class="count tnum">${work}/${S.jobs.length}</span></div><p class="note">Billies at work leave your team and earn pay while you walk.</p>${jobSlots()}</section>
 ${boxSection()}`;
}
const RARN = { starter: 'Starter', common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythical: 'Mythical' };
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
  return S.caught[id] ? 'got' : S.seen[id] ? 'seen' : 'none';
}
function guideTabs() {
  const t = U.guideTab || 'dex';
  return `<div class="seg guide-tabs">${[
    ['dex', 'Billies'],
    ['lore', 'Lore'],
    ['cards', 'Postcards'],
  ]
    .map(([k, n]) => `<button class="${k === t ? 'on' : ''}" data-a="guidetab" data-k="${k}">${n}</button>`)
    .join('')}</div>`;
}
function renderLedger() {
  if (U.dex && SP[U.dex] && S.seen[U.dex]) return renderDexEntry(U.dex);
  if (U.guideTab === 'cards' && typeof renderPostcards === 'function')
    return `<header class="bar"><div><div class="sub">Greetings from every town you’ve walked into</div><h1 class="where">Postcards</h1></div></header>${guideTabs()}${renderPostcards()}`;
  if (U.guideTab === 'lore' && typeof renderLore === 'function')
    return `<header class="bar"><div><div class="sub">The world, the story, the people</div><h1 class="where">Lore</h1></div></header>${guideTabs()}${renderLore()}`;
  const seen = DEX.filter(id => S.seen[id]).length,
    got = DEX.filter(id => S.caught[id]).length,
    f = U.dexF || 'all';
  const list = DEX.filter(id => {
    const st = dexStatus(id);
    if (f === 'got') return st === 'got';
    if (f === 'miss') return st !== 'got';
    if (TYPES.includes(f)) return S.seen[id] && SP[id].types.includes(f);
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
        `<button class="fchip tdot${f === t ? ' on' : ''}" data-a="dexf" data-f="${t}" style="--tc:${TC[t][0]}" aria-label="${t}"><i></i>${t}</button>`
    ).join('');
  return `<header class="bar"><div><div class="sub">Professor Hazel’s records</div><h1 class="where">Field Guide</h1></div></header>${guideTabs()}
 <section class="ledsum paper px"><div class="ls-row"><div><span class="ls-k">Seen</span><b class="tnum">${seen}</b></div><div><span class="ls-k">Taxed</span><b class="tnum">${got}</b></div><div><span class="ls-k">Total</span><b class="tnum">${DEX.length}</b></div></div>${bar(got / DEX.length, 'gold')}<p class="hand">Keep walking. They are out there.</p></section>
 <div class="fchips">${chips}</div>
 <ol class="ledger paper px">${
   list
     .map(id => {
       const s = SP[id],
         st = dexStatus(id),
         sn = st !== 'none';
       return `<li><button class="lrow ${st}" data-a="dex" data-s="${id}" aria-label="${sn ? s.name : 'Unknown'}, number ${s.no}"><span class="lno tnum">${String(s.no).padStart(3, '0')}</span><span class="lspr">${sn ? bustHTML(id, 46) : bustHTML(id, 46, { sil: 1, still: 1 })}</span><span class="ltx"><b>${sn ? esc(s.name) : 'Unknown'}</b><small>${sn ? esc(s.cat) : '—'}</small></span><span class="ltypes">${sn ? s.types.map(t => `<i style="--tc:${TC[t][0]}" title="${t}"></i>`).join('') : ''}</span><span class="lst">${st === 'got' ? `<img class="pxi" src="${coinURL('penny')}" width="18" height="18" alt="Taxed">` : st === 'seen' ? '<em>seen</em>' : ''}</span></button></li>`;
     })
     .join('') || '<li class="lempty">No entries match.</li>'
 }</ol>`;
}
function evoMethod(e) {
  if (!e) return '';
  switch (e.k) {
    case 'lvl':
      return `Lv ${e.at}`;
    case 'split':
      return `Lv ${e.at}, Build or Hype`;
    case 'buddy':
      return `Walk ${km(e.steps)} km as buddy`;
    case 'item':
      return `${evoItemName(e)} at Lv ${e.min}`;
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
  const s = SP[id],
    got = !!S.caught[id],
    L = LN[s.line],
    D = (RIGS[id] && RIGS[id].front) || {},
    idx = DEX.indexOf(id);
  const seenList = DEX.filter(x => S.seen[x]),
    si = seenList.indexOf(id),
    prev = seenList[si - 1],
    next = seenList[si + 1];
  const where = [
    ...new Set(
      Object.keys(POOLS)
        .filter(p => POOLS[p].list.some(([x]) => x === id))
        .map(p => ROUTE.find(r => r.pool === p))
        .filter(Boolean)
        .map(r => r.name)
    ),
  ];
  const eggs = Object.keys(EGGS)
    .filter(k => EGGS[k].list.some(([x]) => x === id))
    .map(k => k + ' km egg');
  const strong = TYPES.filter(x => s.types.some(t => eff(t, [x]) > 1)),
    weak = TYPES.filter(x => eff(x, s.types) > 1),
    res = TYPES.filter(x => eff(x, s.types) < 1);
  const tot = s.base.reduce((a, b) => a + b, 0),
    mx = Math.max(...s.base);
  const chain = L.names
    .map((n, st) => {
      const sid = L.id + st,
        sn = S.seen[sid],
        prev = L.split && st === 3 ? L.id + '1' : L.id + (st - 1);
      return `${st ? `<span class="evarrow"><i>→</i><small>${esc(L.split && st >= 2 ? (st === 2 ? 'Build path' : 'Hype path') : evoMethod(SP[prev].evo))}</small></span>` : ''}<button class="evnode${sid === id ? ' cur' : ''}" data-a="dex" data-s="${sid}" ${sn ? '' : 'disabled'}>${sn ? sprHTML(sid, 44) : sprHTML(sid, 44, { sil: 1, still: 1 })}<small>${sn ? esc(n) : '???'}</small></button>`;
    })
    .join('');
  const bg = TC[s.types[0]][0],
    bg2 = TC[s.types[s.types.length - 1]][0];
  return `<header class="bar dexbar"><button class="pb small quiet" data-a="dexback">‹ Guide</button><div class="dexnav"><button class="pb small quiet" data-a="dex" data-s="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="Previous entry">‹</button><span class="tnum">No. ${String(s.no).padStart(3, '0')}</span><button class="pb small quiet" data-a="dex" data-s="${next || ''}" ${next ? '' : 'disabled'} aria-label="Next entry">›</button></div></header>
 <article class="dexpage">
  <div class="plate px" style="--c1:${bg};--c2:${bg2}"><div class="plate-sky"></div><div class="plate-floor"></div><div class="plate-spr">${sprHTML(id, 150, { act: 'enter' })}</div><span class="cattag">${esc(s.cat)}</span><span class="stamp ${got ? 'got' : 'seen'}">${got ? 'Taxed' : 'Seen'}</span><span class="specno tnum">Specimen ${String(s.no).padStart(3, '0')}/${String(DEX.length).padStart(3, '0')}</span></div>
  <h2 class="dexname">${esc(s.name)}</h2><p class="row">${s.types.map(chip).join('')}<span class="note rar">${RARN[s.rar] || ''}</span></p>
  <div class="vitals">${[
    ['Height', typeof s.ht === 'number' ? s.ht.toFixed(1) + ' m' : s.ht],
    ['Weight', typeof s.wt === 'number' ? (s.wt >= 1000 ? fmt(s.wt) : s.wt) + ' kg' : s.wt],
    ['Habitat', s.hab],
    ['Diet', s.diet],
  ]
    .map(([k, v]) => `<div class="vit px"><span>${k}</span><b>${esc(String(v))}</b></div>`)
    .join('')}</div>
  <section class="paper px notes"><h3>Field notes</h3>${got ? `<p>${esc(s.blurb)}</p><p class="hand red">${esc(s.note)}</p>` : `<p>${esc(s.blurb.split('. ')[0])}. <span class="redact">██████ ████ ███████ ██</span></p><p class="hand">Tax one to complete this entry.</p>`}</section>
  <section class="paper px"><h3>Base stats</h3>${got ? `<table class="bsheet"><tbody>${STATK.map((k, i) => `<tr><td>${STATN[k]}</td><td class="tnum">${s.base[i]}</td><td><span class="bbar" style="--w:${((s.base[i] / mx) * 100).toFixed(0)}%"></span></td></tr>`).join('')}<tr class="tot"><td>Total</td><td class="tnum">${tot}</td><td></td></tr></tbody></table>` : `<p class="note">Tax one to see its stats.</p>`}</section>
  <section class="paper px lin"><h3>Evolution</h3><div class="chain">${chain}</div><p class="note">${esc(evoHint({ sp: id, lvl: 0, bsteps: 0 }))}</p></section>
  <section class="paper px"><h3>Type matchups</h3><table class="expo"><tbody><tr><td>Strong against</td><td>${strong.map(chip).join('') || '—'}</td></tr><tr><td>Weak to</td><td>${weak.map(chip).join('') || '—'}</td></tr><tr><td>Resists</td><td>${res.map(chip).join('') || '—'}</td></tr></tbody></table></section>
  <section class="paper px"><h3>Where to look</h3><table class="expo"><tbody><tr><td>Found at</td><td>${where.length ? esc(where.join(', ')) : 'Not found in the wild'}</td></tr><tr><td>Hatches from</td><td>${eggs.length ? esc(eggs.join(', ')) : '—'}</td></tr><tr><td>Tracks</td><td>${esc(TRACKS[D.plan] || 'Unremarkable')}</td></tr></tbody></table></section>
  ${got ? `<div class="sig"><span class="sigline">${esc(s.name)}</span><small>Recorded by Professor Hazel.</small></div>` : ''}
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
    got: S.seats.includes(T.seat.id),
  }));
  return {
    got: known.filter(b => b.got).length,
    tot,
    html:
      known
        .map(b =>
          b.got
            ? `<li class="bdg got"><span class="bdg-m" title="${esc(b.name)}, from ${esc(b.leader)}">${coinHTML(b.coin, 30, 32)}</span><small>${esc(b.name.replace(/ Badge$/, ''))}</small></li>`
            : `<li class="bdg"><span class="bdg-m" title="Beat ${esc(b.leader)} to earn it">?</span><small>${esc(b.leader.replace(/^Leader /, ''))}</small></li>`
        )
        .join('') +
      Array.from(
        { length: tot - known.length },
        () => '<li class="bdg none"><span class="bdg-m"></span><small>???</small></li>'
      ).join(''),
  };
}
function renderProfile() {
  const name = cleanTrainer(S.avatar, S.gender).name,
    seen = DEX.filter(id => S.seen[id]).length,
    got = DEX.filter(id => S.caught[id]).length,
    places = ROUTE.filter((r, i) => S.visited[i]).length,
    bd = badgeSlots(),
    bud = findMon(S.buddy);
  const beat = Object.keys(S.flags).filter(k => TRAINERS[k] && S.flags[k]).length,
    since = S.since
      ? new Date(S.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
  const tile = (ic, k, v, sub, p) =>
    `<div class="pf-tile"><span class="pf-k">${ic}${k}</span><b class="tnum">${v}</b>${sub ? `<small>${sub}</small>` : ''}${p != null ? bar(p, 'gold') : ''}</div>`;
  const items = Object.keys(ITEMS).filter(k => S.items[k] > 0);
  return `<header class="bar"><div><div class="sub">Your profile</div><h1 class="where">Trainer</h1></div><button class="pb small quiet" data-a="settings">${uiIco('gear', 16)} Settings</button></header>
 <div class="pf-top"><section class="tcard">
  <div class="tc-band"><span>Trainer card</span><span class="tnum">ID No. ${String(S.tid || 0).padStart(5, '0')}</span></div>
  <div class="tc-body"><div class="tc-photo"><div class="tc-portrait">${humanHTML('me', 92)}</div><button class="pb small" data-a="customize">Edit look</button></div>
   <div class="tc-info"><h2 class="tc-name">${esc(name)}</h2><dl class="tc-dl"><div><dt>Money</dt><dd class="tnum">${coinHTML('penny', 16)} $${fmt(S.se)}</dd></div><div><dt>Now in</dt><dd>${esc(ROUTE[S.route.node].name)}</dd></div>${since ? `<div><dt>Started</dt><dd>${esc(since)}</dd></div>` : ''}<div><dt>Buddy</dt><dd>${bud ? esc(N(bud)) : 'None yet'}</dd></div></dl></div></div>
  <div class="tc-badges"><div class="tc-bh"><span>Badges</span><b class="tnum">${bd.got} of ${bd.tot}</b></div><ol class="bdgs">${bd.html}</ol></div>
 </section>
 <section class="tpanel pf-stats"><div class="sec-h"><h2>Records</h2></div><div class="pf-grid">
  ${tile(uiIco('walk', 14), 'Steps today', fmt(S.day.steps))}${tile(uiIco('walk', 14), 'Total steps', fmt(S.totalSteps))}
  ${tile(uiIco('run', 14), 'Distance walked', `${km(S.totalSteps)} km`)}${tile(uiIco('map', 14), 'Places visited', `${places}/${ROUTE.length}`, null, places / ROUTE.length)}
  ${tile(uiIco('ledger', 14), 'Seen', `${seen}/${DEX.length}`, null, seen / DEX.length)}${tile(coinHTML('penny', 14), 'Taxed', `${got}/${DEX.length}`, null, got / DEX.length)}
  ${tile(uiIco('fight', 14), 'Trainers beaten', fmt(beat))}${tile(eggHTML(2, 12), 'Eggs hatched', fmt(S.hatched || 0), S.eggs.length ? `${plural(S.eggs.length, 'egg')} on the way` : 'No eggs right now')}${typeof stampTile === 'function' ? stampTile(tile) : ''}
 </div></section></div>
 <div class="pf-row">${bud ? `<section class="tpanel pf-buddy"><div class="sec-h"><h2>Buddy</h2></div><button class="pf-bud" data-a="mon" data-u="${bud.uid}"><span class="tm-spr" style="${plateVars(bud)}">${sprHTML(bud.sp, 72, { gold: bud.gold })}</span><span class="pf-bt"><b>${esc(N(bud))}</b><span class="tnum">Lv ${bud.lvl}</span><small>You’ve walked ${km(bud.bsteps || 0)} km together.</small></span></button></section>` : ''}
 <section class="tpanel pf-bag"><div class="sec-h"><h2>Bag</h2></div>
  <div class="pf-coins">${Object.keys(COINS)
    .map(
      k =>
        `<span class="pf-coin${S.coins[k] ? '' : ' none'}" title="${esc(COINS[k].n)}">${coinHTML(k, 22, 32)}<small>${esc(COINS[k].n.replace(/ Coins?$/, ''))}</small><b class="tnum">${fmt(S.coins[k] || 0)}</b></span>`
    )
    .join('')}</div>
  ${items.length ? `<ul class="pf-items">${items.map(k => `<li>${itemIcon(k, 24)}<span>${esc(ITEMS[k].n)}</span><b class="tnum">×${fmt(S.items[k])}</b></li>`).join('')}</ul>` : '<p class="note">No items yet.</p>'}
  <p class="note">Buy coins and items at a town shop.</p></section></div>${typeof friendsHTML === 'function' ? friendsHTML() : ''}`;
}
function donateItem() {
  const k = Object.keys(ITEMS)
    .filter(k => !ITEMS[k].evoItem && S.items[k] > 0)
    .sort((a, b) => S.items[b] - S.items[a])[0];
  return k || null;
}
function monSheet(m) {
  const s = SP[m.sp],
    inTeam = S.team.includes(m),
    e = s.evo,
    mx = maxHp(m),
    lead = S.team[0] === m,
    bud = S.buddy === m.uid,
    acts = [];
  const nick = {
    f: () => {
      const nn = cleanName($('#nick').value, 16),
        changed = nn && nn !== m.nick;
      m.nick = nn;
      save();
      if (changed && e && e.k === 'rename' && m.lvl >= e.min) {
        evoRun(m, 'It loves its new name.');
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
        S.team.splice(S.team.indexOf(m), 1);
        S.team.unshift(m);
        save();
        closeModal();
        render();
        toast(`${N(m)} leads the team now.`);
      },
    });
  if (!bud)
    acts.push({
      ic: 'walk',
      l: 'Make buddy',
      f: () => {
        S.buddy = m.uid;
        save();
        closeModal();
        render();
        toast(`${N(m)} is your buddy now.`);
      },
    });
  if (needsCare(m))
    acts.push({
      ic: 'heart',
      l: 'Heal',
      c: 'green',
      f: () => {
        U.modal = null;
        healPick(m, true);
      },
    });
  if (inTeam && S.team.length > 1)
    acts.push({
      ic: 'bag',
      l: 'Move to storage',
      f: () => {
        toBox(m);
        save();
        closeModal();
        render();
        toast(`${N(m)} is resting in storage.`);
      },
    });
  if (!inTeam && m.job == null)
    acts.push(
      S.team.length < TEAM_MAX()
        ? {
            ic: 'team',
            l: 'Move to team',
            f: () => {
              toTeam(m);
              save();
              closeModal();
              render();
              toast(`${N(m)} joined your team.`);
            },
          }
        : {
            ic: 'team',
            l: 'Swap into team',
            f: () => {
              U.modal = null;
              swapPick(m);
            },
          }
    );
  if (e && e.k === 'item' && m.lvl >= e.min) {
    const ik = e.item || 'bell',
      I = ITEMS[ik] || { n: 'Shining Stone' },
      have = S.items[ik] || 0;
    acts.push({
      ic: 'spark',
      l: have ? `Use ${I.n} (${have} left)` : `Use ${I.n} (you have none)`,
      c: have ? 'gold' : '',
      dis: !have,
      f: () => {
        S.items[ik]--;
        evoRun(m, `The ${I.n} began to glow.`);
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
        S.items[it]--;
        m.donated = (m.donated || 0) + 1;
        save();
        if (m.donated >= e.n && m.lvl >= e.min) {
          evoRun(m, 'Its kindness paid off.');
          return;
        }
        toast(`${N(m)} gave away a ${ITEMS[it].n}. ${m.donated} of ${e.n}.`);
        closeModal();
        render();
      },
    });
  }
  if (e && e.k === 'merge' && m.lvl >= e.min) {
    const other = allMons()
      .filter(o => o !== m && o.sp === m.sp && o.job == null)
      .sort((x, y) => x.lvl - y.lvl)[0];
    acts.push({
      c: 'gold',
      ic: 'spark',
      l: other ? `Combine with another ${s.name}` : `Combine (needs another ${s.name})`,
      dis: !other,
      f: () => {
        U.modal = null;
        modal({
          title: `Combine two ${s.name}s?`,
          html: `<p>${esc(N(other))} (Lv ${other.lvl}) will join with ${esc(N(m))}. This can’t be undone.</p>`,
          btns: [
            {
              l: 'Combine them',
              c: 'dark',
              f: () => {
                S.team = S.team.filter(x => x !== other);
                S.box = S.box.filter(x => x !== other);
                if (S.buddy === other.uid) S.buddy = m.uid;
                evoRun(m, 'The two became one.');
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
    st = STATK.map((k, i) => {
      const v = k === 'hp' ? mx : stat(m, k),
        b = base[i] || 0;
      return `<div class="ms-bar"><span>${STATN[k]}</span><i><b style="width:${Math.round(Math.min(1, b / 150) * 100)}%;--c:${['#4E9A4A', '#D9532F', '#E3A12F', '#3478C8', '#7D52C2', '#2BA7A0'][i] || '#888'}"></b></i><em class="tnum">${v}</em></div>`;
    }).join('');
  const nums = STATK.map(
    (k, i) =>
      `<div class="ms-st"><span>${STATN[k]}</span><b class="tnum">${k === 'hp' ? mx : stat(m, k)}</b><small class="tnum">base ${base[i] ?? '?'}</small></div>`
  ).join('');
  const metR = m.met
    ? (() => {
        const r = ROUTE.find(x => (x.id || '') === m.met.n) || ROUTE[m.met.n];
        return `<div class="ms-met">${uiIco('flag', 14)}<span>Joined you in <b>${esc(r ? r.name : 'a place that’s gone')}</b> · ${new Date(m.met.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>`;
      })()
    : '';
  const line = LN[s.line],
    evo = line
      ? line.names
          .map((n, i) => {
            const id = s.line + i;
            if (!SP[id]) return '';
            const seen = S.seen[id] || S.caught[id] || id === m.sp;
            return `<div class="ms-evo ${id === m.sp ? 'on' : ''}">${seen ? sprHTML(id, 64, {}) : '<span class="ms-q">?</span>'}<b>${seen ? esc(SP[id].name) : '???'}</b></div>`;
          })
          .join('<span class="ms-arr" aria-hidden="true">›</span>')
      : '';
  const tabs = [
    ['sum', 'Summary'],
    ['stats', 'Stats'],
    ['moves', 'Moves'],
    ['evo', 'Evolves'],
  ];
  modal({
    title: esc(N(m)),
    cls: 'mon-sheet',
    acts,
    top: `<div class="ms-plate" style="${plateVars(m)}">${lead ? '<span class="tm-ribbon">Lead</span>' : ''}${bud ? `<span class="tm-ribbon bud">${uiIco('heart', 11)} Buddy</span>` : ''}${m.gold ? '<span class="tm-ribbon gold">Golden</span>' : ''}${sprHTML(m.sp, 128, { gold: m.gold })}</div>`,
    html: `<p class="row ms-chips">${s.types.map(chip).join('')}${monState(m)}<b class="lv tnum">Lv ${m.lvl}</b>${m.nick ? `<span class="ms-sp">${esc(s.name)}</span>` : ''}</p>
  <div class="ms-tabs" role="tablist" aria-label="About ${esc(N(m))}" data-on="sum">${tabs.map(([k, l]) => `<button role="tab" data-a="ms-tab" data-k="${k}" aria-selected="${k === 'sum'}">${l}</button>`).join('')}</div>
  <div class="ms-pane" data-k="sum"><div class="ms-meters">${meter('HP', hpBar(m.hp, mx), `${m.hp}/${mx}`)}${meter('XP', bar(xpPart(m), 'xpb'), xpLeft(m))}</div>
   <div class="ms-chart">${st}</div>${metR}
   ${m.job != null ? `<p class="note ms-job">${uiIco('bag', 14)} Working as a ${esc(JOBS[S.jobs[m.job].job].n.toLowerCase())} right now. End the shift from Day jobs to bring it back.</p>` : ''}
   ${acts.length ? `<div class="ms-acts">${acts.map((b, i) => `<button class="pb small ${b.c || ''}" data-a="mact" data-i="${i}" ${b.dis ? 'disabled' : ''}>${b.ic ? uiIco(b.ic, 15) : ''}<span>${b.l}</span></button>`).join('')}</div>` : ''}
   <p class="note ms-about">${esc(s.blurb)}</p>
   <div class="ms-nick"><label class="field-l">Nickname<input id="nick" maxlength="16" value="${esc(m.nick)}" placeholder="${esc(s.name)}" autocomplete="off" enterkeyhint="done"></label><button class="pb small" data-a="mnick">Save</button></div></div>
  <div class="ms-pane" data-k="stats" hidden><div class="ms-stats">${nums}</div><p class="note">The bars on the summary show what its kind is good at; the numbers grow as it levels up.</p></div>
  <div class="ms-pane" data-k="moves" hidden><div class="mvlist">${m.moves
    .map(id => {
      const M = MOVES[id];
      return `<div class="mvi"><div class="mh"><span>${M.n}</span>${chip(M.t)}</div><div class="md">${M.p ? `${M.p} power, ${M.a}% accuracy. ` : ''}${M.d}</div></div>`;
    })
    .join('')}</div></div>
  <div class="ms-pane" data-k="evo" hidden>${evo ? `<div class="ms-line">${evo}</div>` : ''}<p class="note">${esc(evoHint(m))}</p></div>`,
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
    title: `Heal ${esc(N(m))}`,
    html: `<div class="ms-meters">${meter('HP', hpBar(m.hp, maxHp(m)), `${m.hp}/${maxHp(m)}`)}</div>${
      its.length
        ? `<div class="list">${its.map(k => `<button class="pickrow" data-a="mhealuse" data-u="${m.uid}" data-it="${k}"${back ? ' data-b="1"' : ''}>${itemIcon(k, 34)}<span class="pr-t"><b>${esc(ITEMS[k].n)}</b><small>${esc(ITEMS[k].d)}</small></span><span class="pr-n tnum">×${S.items[k]}</span></button>`).join('')}</div>`
        : `<p>None of your items can help right now.</p><p class="note">Rest at a town clinic for free, or buy Potions at a town shop.</p>`
    }`,
    btns: [
      {
        l: 'Cancel',
        c: 'quiet',
        f: () => {
          if (back) {
            U.modal = null;
            monSheet(m);
          } else closeModal();
        },
      },
    ],
  });
}
/* the team is full: pick who goes to storage so another can join */
function swapPick(m) {
  modal({
    title: `Swap in ${esc(N(m))}`,
    html: `<p class="note">Your team is full. Pick who rests in storage instead.</p><div class="list">${S.team.map((o, i) => `<button class="pickrow" data-a="mswap" data-u="${m.uid}" data-o="${o.uid}">${sprHTML(o.sp, 40, { gold: o.gold })}<span class="pr-t"><b>${esc(N(o))}</b><small>Lv ${o.lvl}${i === 0 ? ', your lead' : ''}${o.uid === S.buddy ? ', buddy' : ''}</small></span></button>`).join('')}</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function addPick() {
  const free = S.box.filter(m => m.job == null).sort((a, b) => b.lvl - a.lvl);
  modal({
    title: 'Add to your team',
    html: `<div class="list">${free.map(m => `<button class="pickrow" data-a="tmaddon" data-u="${m.uid}">${sprHTML(m.sp, 40, { gold: m.gold })}<span class="pr-t"><b>${esc(N(m))}</b><small>Lv ${m.lvl}, ${SP[m.sp].types.map(t => (t === 'None' ? 'Normal' : t)).join(' and ')}</small></span></button>`).join('') || '<p>Storage is empty.</p>'}</div>`,
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function hireFlow(slot) {
  modal({
    title: 'Pick a job',
    html: `<p class="note">Each job pays out every ${fmt(JOB_STEPS)} steps you walk.</p>`,
    btns: Object.keys(JOBS)
      .map(k => ({
        l: `${JOBS[k].n}, ${JOBS[k].where}: ${JOBS[k].pay}`,
        f: () => {
          U.modal = null;
          hirePick(slot, k);
        },
      }))
      .concat([{ l: 'Cancel', c: 'quiet', f: closeModal }]),
  });
}
function hirePick(slot, job) {
  const free = allMons().filter(m => m.job == null),
    canTeam = S.team.filter(x => x.job == null).length > 1;
  const list = free.filter(m => !S.team.includes(m) || canTeam);
  modal({
    title: `Who becomes the ${JOBS[job].n.toLowerCase()}?`,
    html: list.length
      ? `<div class="list">${list.map(m => `<button class="pickrow px" data-a="hireon" data-s="${slot}" data-j="${job}" data-u="${m.uid}">${sprHTML(m.sp, 40, { gold: m.gold })}<span class="pr-t"><b>${esc(N(m))}</b><small>${S.team.includes(m) ? 'On your team' : 'In storage'}, Lv ${m.lvl}</small></span></button>`).join('')}</div>`
      : '<p>Tax another Billie first. Your last one has to stay on the team.</p>',
    btns: [{ l: 'Cancel', c: 'quiet', f: closeModal }],
  });
}
function settings(tab) {
  if (tab) U.setTab = tab;
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
          U.modal = null;
          modal({
            title: 'Start over?',
            html: '<p>This erases your team, Field Guide and money.</p>',
            btns: [
              {
                l: 'Erase and start over',
                c: 'red',
                f: () => {
                  setS(freshKeep());
                  S.savedAt = Date.now();
                  lsSet(S);
                  flush();
                  U.intro = 0;
                  U.pg = null;
                  U.avatarDraft = null;
                  U.trainerDraft = null;
                  U.tab = 'walk';
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
  const avatar = cleanLook(U.avatarDraft || U.trainerDraft || TR_PRESETS[0]);
  setS(freshKeep());
  S.avatar = avatar;
  U.trainerDraft = null;
  S.started = true;
  S.gender = 'me';
  S.wardrobe = { owned: {}, outfits: [null, null, null] };
  S.starter = l;
  const R = RULES.start,
    m = makeMon(l + '0', R.starterLevel);
  S.team = [m];
  S.buddy = m.uid;
  S.caught[m.sp] = 1;
  S.seen[m.sp] = 1;
  S.since = Date.now();
  S.route = { node: START_NODE, prog: 0, plan: [], hold: false };
  S.visited = { [START_NODE]: 1 };
  S.mapSeen = null;
  if (typeof storyFlags === 'function') storyFlags().copperleafNote = 1;
  for (let i = 0; i < R.starterEncounters; i++) spawn(true);
  const egg = R.starterEgg && EGGS[R.starterEgg] ? addEgg(R.starterEgg) : false;
  save();
  flush();
  U.tab = 'walk';
  render();
  const nE = R.starterEncounters,
    words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const W = {
    title: `${SP[m.sp].name} joined your team`,
    top: `<div class="sheet-art">${sprHTML(m.sp, 128)}</div>`,
    html: `${nE ? `<p>${words[nE] || nE} Billie${nE === 1 ? ' is' : 's are'} already rustling in the grass. Tap one to battle it, then flick a coin.</p>` : ''}${egg ? `<p>Professor Hazel also gave you a ${R.starterEgg} km egg. It’s warming up in an incubator, and every step you walk helps it hatch.</p>` : ''}`,
    btns: [{ l: 'Let’s go', c: 'dark', f: closeModal }],
  };
  if (o.rival && TRAINERS.blake0 && typeof storyRivalBattle === 'function') {
    U.welcome = W;
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
    if (ev.target === el && U.modal && !U.modal.lock) {
      const c = U.modal.btns && U.modal.btns.find(b => b.l === 'Close' || b.l === 'Done' || b.c === 'quiet');
      if (c) c.f();
    }
    return;
  }
  if (a === 'mb') {
    const b = U.modal && U.modal.btns[+d.i];
    if (b && !b.dis) b.f();
    return;
  }
  if (typeof mapGLAction === 'function' && mapGLAction(a, d)) return;
  switch (a) {
    case 'intro':
      if (U.intro === 0 && typeof csWanted === 'function' && csWanted()) {
        csStart();
        break;
      }
      U.intro++;
      render();
      break;
    case 'pickgender':
      U.pg = d.g;
      U.intro++;
      render();
      break;
    case 'tr-preset':
      U.trainerDraft = cleanLook(TR_PRESETS[+d.i]);
      render();
      break;
    case 'tr-custom':
      openDressing({ mode: 'intro', done: () => render() });
      break;
    case 'tr-next':
      U.avatarDraft = cleanLook(U.trainerDraft || TR_PRESETS[0]);
      U.trainerDraft = U.avatarDraft;
      U.intro++;
      render();
      scrollTo(0, 0);
      break;
    case 'setgender':
      S.gender = d.g;
      save();
      closeModal();
      render();
      break;
    case 'pick':
      startGame(d.l, { rival: true, talkFirst: true });
      break;
    case 'tab':
      if (U.tab !== d.t) {
        if (d.t === 'map') U.mglFrom = U.tab;
        U.tab = d.t;
        if (d.t !== 'map') U.mapSel = null;
        render();
        scrollTo(0, 0);
      } else if (d.t === 'ledger' && U.dex) {
        U.dex = null;
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
      if (w) scrollTo({ top: w.getBoundingClientRect().top + scrollY - 70, behavior: RM ? 'auto' : 'smooth' });
      break;
    }
    case 'settings':
      settings();
      break;
    case 'card-close':
      S.preferences = S.preferences || {};
      S.preferences.cardClosed = true;
      save();
      render();
      requestAnimationFrame(() => {
        const t = $('.tb-where');
        if (t) t.focus({ preventScroll: true });
      });
      break;
    case 'card-open':
      S.preferences = S.preferences || {};
      S.preferences.cardClosed = !S.preferences.cardClosed;
      save();
      render();
      break;
    case 'enc': {
      const q = S.queue.find(x => x.id === d.id);
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
      if (S.se < c) {
        toast(`A rest stop costs $${fmt(c)}. Walk a bit first.`);
        break;
      }
      S.se -= c;
      healAll();
      save();
      render();
      toast(`Everyone rested up for $${fmt(c)}.`);
      break;
    }
    case 'trainer':
      trainerTalk(d.t);
      break;
    case 'mon': {
      const m = findMon(d.u);
      if (m) monSheet(m);
      break;
    }
    case 'mact': {
      const b = U.modal && U.modal.acts && U.modal.acts[+d.i];
      if (b && !b.dis) b.f();
      break;
    }
    case 'mnick':
      if (U.modal && U.modal.nick) U.modal.nick.f();
      break;
    case 'mlead': {
      const m = findMon(d.u);
      if (m && S.team.includes(m) && m.hp > 0) {
        S.team.splice(S.team.indexOf(m), 1);
        S.team.unshift(m);
        save();
        render();
        toast(`${N(m)} leads the team now.`);
      }
      break;
    }
    case 'mbuddy': {
      const m = findMon(d.u);
      if (m) {
        S.buddy = m.uid;
        save();
        render();
        toast(`${N(m)} is your buddy now.`);
      }
      break;
    }
    case 'mheal': {
      const m = findMon(d.u);
      if (m) healPick(m, false);
      break;
    }
    case 'mhealuse': {
      const m = findMon(d.u);
      if (m && applyItem(d.it, d.u, false)) {
        U.modal = null;
        render();
        if (d.b) monSheet(m);
        else nextModal();
      }
      break;
    }
    case 'mteam': {
      const m = findMon(d.u);
      if (!m || m.job != null || S.team.includes(m)) break;
      if (S.team.length < TEAM_MAX()) {
        toTeam(m);
        save();
        render();
        toast(`${N(m)} joined your team.`);
      } else swapPick(m);
      break;
    }
    case 'tmadd':
      addPick();
      break;
    case 'tmaddon': {
      const m = findMon(d.u);
      if (m && m.job == null && !S.team.includes(m) && S.team.length < TEAM_MAX()) {
        toTeam(m);
        save();
        closeModal();
        render();
        toast(`${N(m)} joined your team.`);
      }
      break;
    }
    case 'mswap': {
      const m = findMon(d.u),
        o = findMon(d.o);
      if (!m || !o || m.job != null || !S.team.includes(o) || S.team.includes(m)) break;
      const i = S.team.indexOf(o);
      toBox(o);
      S.box.splice(S.box.indexOf(m), 1);
      S.team.splice(i, 0, m);
      m.boxedAt = null;
      save();
      closeModal();
      render();
      toast(`${N(m)} swapped in for ${N(o)}.`);
      break;
    }
    case 'boxsort':
      U.boxSort = d.k;
      render();
      break;
    case 'boxf':
      U.boxF = d.f;
      render();
      break;
    case 'msel':
      mapSelect(d.n.startsWith('f') ? d.n : +d.n);
      break;
    case 'travel': {
      const j = +d.n;
      if (setTrip(j)) {
        const T = tripStatus();
        toast(
          walkMode()
            ? `Follow the gold arrows to ${ROUTE[j].name}.`
            : T.k === 'go'
              ? `${T.t}. ${fmt(T.left)} steps.`
              : T.t
        );
        render();
      } else toast('There’s no open road there yet.');
      break;
    }
    case 'stoptrip':
      stopTrip();
      toast(
        S.route.prog > 0
          ? 'You stopped walking. Steps won’t move you until you carry on.'
          : `You’re staying in ${ROUTE[S.route.node].name}.`
      );
      render();
      break;
    case 'stay':
      S.route.plan = [];
      S.route.prog = 0;
      S.route.hold = false;
      save();
      toast(`You’re staying in ${ROUTE[S.route.node].name}.`);
      render();
      break;
    case 'resumetrip':
      resumeTrip();
      render();
      break;
    case 'turnback': {
      const r = S.route,
        nx = nextStop();
      if (nx != null && r.prog > 0) {
        const c = linkCost(r.node, nx);
        r.plan = [r.node];
        r.node = nx;
        r.prog = c - r.prog;
        r.hold = false;
        save();
        toast(`Heading back to ${ROUTE[r.plan[0]].name}.`);
        render();
      }
      break;
    }
    case 'mzoom':
      mapZoom(d.k === 'in' ? 0.8 : 1.25);
      break;
    case 'mreset':
      mapReset();
      break;
    case 'hire':
      hireFlow(+d.s);
      break;
    case 'hireon':
      if (assignJob(+d.s, d.j, d.u)) {
        const m = findMon(d.u);
        closeModal();
        render();
        toast(`${N(m)} started work as a ${JOBS[d.j].n.toLowerCase()}.`);
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
      if (!S.seen[d.s]) {
        toast('Not seen yet. Keep walking.');
        break;
      }
      U.dex = d.s;
      U.lastTab = 'ledger';
      render();
      scrollTo(0, 0);
      break;
    }
    case 'dexback':
      U.dex = null;
      render();
      scrollTo(0, 0);
      break;
    case 'dexf':
      U.dexF = d.f;
      render();
      break;
    case 'guidetab':
      U.guideTab = d.k;
      render();
      scrollTo(0, 0);
      break;
    case 'loresec':
      U.loreSec = d.k;
      render();
      break;
    case 'lorebook':
      loreBook(d.k);
      break;
    case 'adv':
      tapMsg();
      break;
    case 'bfight':
      if (B && B.phase === 'choose') {
        B.phase = 'fight';
        paintActions();
      }
      break;
    case 'bmove':
      if (B && B.phase === 'fight') pickMove(d.m);
      break;
    case 'btarget':
      if (B && B.phase === 'target' && d.t != null) pickTarget(+d.t);
      break;
    case 'bcoins':
      if (B && B.phase === 'choose') {
        B.phase = 'coins';
        paintActions();
      }
      break;
    case 'bitems':
      if (B && B.phase === 'choose') {
        B.phase = 'items';
        paintActions();
      }
      break;
    case 'bteam':
      if (B && B.phase === 'choose') {
        B.phase = 'team';
        paintActions();
      }
      break;
    case 'brun':
      if (B && B.phase === 'choose') runTurn([{ k: 'run' }]);
      break;
    case 'bback':
      if (B) {
        if (B.phase === 'target' && typeof scTargets === 'function') scTargets(null);
        if (B.phase === 'choose') {
          planBack();
          break;
        }
        B.phase = B.phase === 'target' ? 'fight' : 'choose';
        if (B.phase === 'choose') chooseMsg();
        paintActions();
      }
      break;
    case 'bcoin':
      if (B && B.phase === 'coins' && S.coins[d.c] > 0) {
        B.coin = d.c;
        B.phase = 'aim';
        paintActions();
        showAim();
      }
      break;
    case 'baimback':
      if (B && !U.throwing) {
        SC.ring = null;
        camHome(300);
        scFocus('wide');
        B.phase = 'choose';
        chooseMsg();
        paintActions();
      }
      break;
    case 'bthrow':
      doThrow(false);
      break;
    case 'bitem':
      if (B && B.phase === 'items') {
        if (ITEMS[d.it].hpAll) {
          planNext({ who: B.cur, k: 'item', item: d.it, uid: A(B.cur).uid });
          break;
        }
        B.item = d.it;
        B.phase = 'itemTarget';
        paintActions();
      }
      break;
    case 'bitemon':
      if (B && B.phase === 'itemTarget') planNext({ who: B.cur, k: 'item', item: B.item, uid: d.u });
      break;
    case 'bswitch':
      if (!B) break;
      if (B.phase === 'team') planNext({ who: B.cur, k: 'switch', i: +d.i });
      else if (B.phase === 'switch') {
        const k = B.needSwitch.shift();
        B.events = [];
        doSwitch(k ?? 0, +d.i);
        if (!B.needSwitch.length) checkFaints();
        play();
      }
      break;
    case 'boffer':
      if (B && B.phase === 'offer') {
        const amt = B.offer;
        B.offer = null;
        B.events = [];
        if (d.y === '1') {
          S.se += amt;
          say(`You took $${fmt(amt)}. ${N(A(1))} scampered off.`);
          B.over = 'bribed';
          SC.s[1].show = false;
          save();
        } else {
          B.integrity = Math.min(RC.integrityMax, B.integrity * RC.integrityStep);
          say(`You refused. Focus Bonus ×${+B.integrity.toFixed(2)} on your next throw.`);
          enemyOnly();
        }
        play();
      }
      break;
    case 'bend':
      if (B && B.phase === 'end') endBattle();
      break;
  }
});
/* keyboard play in battle: F fight, 1–4 moves, X tax (or C), I items, T team, R run, Esc back, Space/Enter advance */
document.addEventListener('keydown', ev => {
  if (!B || U.modal || ev.ctrlKey || ev.metaKey || ev.altKey || /INPUT|SELECT|TEXTAREA/.test(ev.target.tagName)) return;
  const k = ev.key.toLowerCase(),
    ph = B.phase,
    click = s => {
      const e = $(s);
      if (e && !e.disabled) {
        e.click();
        ev.preventDefault();
      }
    };
  if (ph === 'playing' && (k === ' ' || k === 'enter')) {
    tapMsg();
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
  if (B && B.phase === 'playing' && ev.target.closest('.bstage')) tapMsg();
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && U.modal && !U.modal.lock) {
    const c = U.modal.btns && U.modal.btns.find(b => b.l === 'Close' || b.l === 'Done' || b.l === 'Cancel');
    if (c) c.f();
  }
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role=button][data-a]')) {
    ev.preventDefault();
    ev.target.click();
  }
});
window.addEventListener('resize', () => {
  if (B) battleResize();
  else if (U.tab === 'map' && S.started) mapFit();
});

/* ---------- tilt ---------- */
document.addEventListener(
  'pointermove',
  ev => {
    const el = ev.target.closest && ev.target.closest('.enc,.starter,.gcard');
    if (!el || RM) return;
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
const BG = { cv: null, x: null, last: 0, w: 160, h: 300, dark: null, base: null, isl: [], cl: [], sp: [] };
provide({ BG }); /* to-module */
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
};
function bgBuild() {
  const W = BG.w,
    H = BG.h,
    dk = BG.dark,
    m = dk ? 'dark' : 'light',
    sky = ART.img[`background/sky_${m}.png`],
    c = cnv(W, H),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(sky, 0, 0, W, H);
  BG.base = c;
  BG.cl = [0, 1, 2, 3].map(i => ({
    img: ART.img[`background/cloud_${m}_${i}.png`],
    x: rnd() * W,
    y: 20 + i * 28 + rnd() * 10,
    v: 0.003 + i * 0.002,
  }));
  BG.sp = Array.from({ length: dk ? 40 : 14 }, () => ({ x: rnd() * W, y: rnd() * H * 0.8, p: rnd() * 6 }));
}
export function bgInit() {
  const c = document.createElement('canvas');
  c.id = 'bgfx';
  c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  BG.cv = c;
  BG.x = c.getContext('2d');
  bgResize();
  window.addEventListener('resize', bgResize);
  frameTask('bg', bgTick, () => (B ? 1 : 15));
}
function bgResize() {
  BG.w = 160;
  BG.h = Math.max(200, Math.round((160 * innerHeight) / Math.max(1, innerWidth)));
  BG.cv.width = BG.w;
  BG.cv.height = BG.h;
  BG.dark = null;
}
function bgTick(ts) {
  if (B) return;
  BG.last = ts;
  const dk = isDark();
  if (dk !== BG.dark) {
    BG.dark = dk;
    bgBuild();
  }
  if (RM && BG._still === BG.base) return;
  BG._still = BG.base;
  const x = BG.x,
    W = BG.w,
    H = BG.h,
    t = RM ? 0 : ts;
  x.imageSmoothingEnabled = false;
  x.drawImage(BG.base, 0, 0);
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
  BG.cl.forEach(c => {
    const w = c.img.width,
      xx = ((c.x + t * c.v) % (W + w)) - w;
    x.drawImage(c.img, Math.round(xx), Math.round(c.y));
  });
  BG.sp.forEach(p => {
    const a = 0.5 + 0.5 * Math.sin(t / 500 + p.p);
    if (a < 0.55) return;
    x.fillStyle = dk ? `rgba(255,240,200,${a})` : `rgba(255,255,255,${a * 0.8})`;
    x.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  });
}

/* ---------- boot: load the menu art, then draw ---------- */

// Keep keyboard navigation inside an open dialog.
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Tab' || !U.modal) return;
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
  if (ev.key === 'Enter' && ev.target.id === 'nick' && U.modal && U.modal.nick) {
    ev.preventDefault();
    U.modal.nick.f();
  }
});
