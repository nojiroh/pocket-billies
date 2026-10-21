'use strict';
/* ================= UI ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { $, $$, clamp } from './util.js';
import {
  EGGS,
  ITEMS,
  LOCATIONS,
  PEOPLE,
  ROADS,
  ROADS_BY_NODE,
  RULES,
  SHOPS,
  START_NODE,
  TRAINERS,
  gameData,
  trainersAt,
} from './game-data.js';
import { speciesOf } from './logic/fighters.js';
import {
  addEgg,
  billyName,
  blockerAt,
  canEnter,
  eggKm,
  encounterBuild,
  encountersHere,
  formatNumber,
  gateText,
  healAll,
  makeBilly,
  spawn,
} from './logic/rules.js';
import { runArrive, runMapNode } from './logic/run-map.js';
import { pbFloat, pbInboxDot, pbInboxPop } from './ui-kit.js';
import { newSaveKeepingPreferences } from './logic/saves.js';
import {
  CATCH_RULES,
  battleSay,
  checkFaints,
  doSwitch,
  enemyOnly,
  fighter,
  runTurn,
  startWild,
} from './logic/battle-engine.js';
import { storyAllows } from './logic/script.js';
import {
  activeBattle,
  escapeHtml,
  flushSave,
  reducedMotion,
  save,
  saveData,
  saveNow,
  setSaveData,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { userFps } from './frame-scheduler.js';
import { artLoad, coinHTML, uiIconHTML } from './art.js';
import { LOOK_PRESETS, cleanLook, portraitHTML } from './person-art.js';
import { applyPreferences, settingsHTML } from './settings-screen.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { EASE, battleStage, battleStageFocus, battleStageTargets, camHome } from './battle-stage.js';
import {
  ROOM_BY_USE,
  closedText,
  doorLinkOf,
  doorOf,
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
import { walkRenderer } from './walk/walk-state.js';
import { roomFloorReady } from './walk/ground-draw.js';
import { mountWalkView } from './walk-view-gl.js';
import { fishStart } from './fishing.js';
import {
  seamlessDelta,
  seamlessGate,
  seamlessGetReady,
  seamlessRoamView,
  seamlessRoomId,
  seamlessRoomMap,
  seamlessWorld,
  shiftWalkView,
} from './seamless-world.js';
import { battle3dLayout } from './battle-3d.js';
import {
  battleResize,
  battleShell,
  chooseMessage,
  doThrow,
  endBattle,
  paintActions,
  pickMove,
  pickPart,
  pickTarget,
  planBack,
  planNext,
  playTurnEvents,
  showAim,
  tapMessage,
} from './battle.js';
import { worldMapAction, worldMapFit, worldMapMount, worldMapOpenFromWalk, worldMapWanted } from './world-bowl.js';
import { openShop } from './shop.js';
import { soundEffect } from './sound.js';
import { talkHazel } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { cutsceneStart, cutsceneWanted } from './cutscene/opening.js';
import { tutorPicked } from './opening-fall.js';
import { renderTitle, titleMount } from './title.js';
import { loreBook } from './lore.js';
import { flyMenu, rideGlassLift } from './airship.js';
import { runWorldData } from './run-world.js';
import { runArrivedHint } from './run.js';
import { postcardCheck } from './postcards.js';
import { renderBag } from './bag.js';
import { legendCheck, personTalk, storyCheck, storyRivalBattle, trainerTalk } from './story.js';
import { storyResumeCheck } from './story-stage.js';
import { arrivedAt, homeDecorate, refreshHomeFurniture } from './things-to-do.js';
import { workshopAction } from './workshop.js';
import { closeModal, modal, openInbox, toast } from './overlay.js';
import { renderProfile } from './profile.js';
import { guideAction, renderGuide } from './guide.js';
import { renderTeam, teamAction } from './team.js';
import { billieSheetAction } from './billie-sheet.js';
import { mapTabAction, renderWorldMapTab } from './map-tab.js';
import { clinicHeal, renderWalk, walkTabAction } from './walk-tab.js';
/* eslint-disable no-func-assign */
expose({
  SCREENS: [() => SCREENS],
  TABS: [() => TABS],
  doorBuildingOf: [() => doorBuildingOf, v => (doorBuildingOf = v)],
  enterRoom: [() => enterRoom, v => (enterRoom = v)],
  exitPrompt: [() => exitPrompt, v => (exitPrompt = v)],
  leaveRoom: [() => leaveRoom, v => (leaveRoom = v)],
  mapExits: [() => mapExits, v => (mapExits = v)],
  mapIdAt: [() => mapIdAt, v => ((mapIdAt = v), provide({ mapIdAt }))],
  mapOffsetInView: [() => mapOffsetInView, v => ((mapOffsetInView = v), provide({ mapOffsetInView }))],
  openSettings: [() => openSettings, v => ((openSettings = v), provide({ openSettings }))],
  render: [() => render, v => setRender(v)],
  renderIntro: [() => renderIntro, v => (renderIntro = v)],
  roomAct: [() => roomAct, v => (roomAct = v)],
  roomAim: [() => roomAim, v => (roomAim = v)],
  roomFor: [() => roomFor, v => (roomFor = v)],
  roomLayIn: [() => roomLayIn, v => (roomLayIn = v)],
  roomRefresh: [() => roomRefresh, v => ((roomRefresh = v), provide({ roomRefresh }))],
  roomState: [() => roomState, v => ((roomState = v), provide({ roomState }))],
  roomStepIn: [() => roomStepIn, v => (roomStepIn = v)],
  startGame: [() => startGame, v => ((startGame = v), provide({ startGame }))],
  topbar: [() => topbar, v => (topbar = v)],
  updateNav: [() => updateNav, v => ((updateNav = v), provide({ updateNav }))],
  walkCross: [() => walkCross, v => (walkCross = v)],
  walkMapSync: [() => walkMapSync, v => (walkMapSync = v)],
  walkPick: [() => walkPick, v => (walkPick = v)],
  walkState: [() => walkState, v => (walkState = v)],
});
/* eslint-enable no-func-assign */
provide({ mapIdAt, mapOffsetInView, openSettings, render, roomRefresh, roomState, startGame, updateNav });
export function setRender(v) {
  render = v; // eslint-disable-line no-func-assign
  provide({ render });
}
/* to-module: end */
/* ---------- screens ---------- */
/* alpha 0.5: the bar holds Walk, Map, Team, Guide and Bag; your Trainer card opens from the portrait in the top bar */
const TABS = ['walk', 'map', 'team', 'ledger', 'bag'],
  SCREENS = [...TABS, 'profile'];
function topbar() {
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
  return `<div class="title"><div class="title-landscape" aria-hidden="true"></div><div class="title-coin">${coinHTML('penny', 176, 32)}</div><h1 class="logo">Pocket Billies</h1><p class="tag">A classic RPG inside the Hollow Earth, where the Billies are the wildlife. Gotta tax 'em all!</p><button class="pb gold wide big" data-a="intro">Start</button></div>`;
}
/* ---------- the walk scene behind the Walk tab ---------- */
export function mapIdAt(i) {
  const S0 = gameData.maps || {},
    r = LOCATIONS[i];
  if (r && r.mapId && S0[r.mapId]) return r.mapId;
  return Object.keys(S0)[0] || null;
}
/* which road leaves a stop's scene through which exit: each link names the exit at each end, by id (phase 08b: a link
   without both is a data error, check-data.mjs) */
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
  return out;
}
/* what the walk scene shows: the stop you're at (walk around freely), or you walking out toward the next stop
   (first half of a road) and in from the far end (second half) */
/* v26: walking into shops, the clinic, the lab and houses. uiState.inside remembers the room and where you came in */
function roomFor(a, p) {
  const L = doorLinkOf(p, a, walkView.id);
  return L ? L.b.map : null;
}
/* phase 08b: a sign with no building of its own (Marigold's shop and clinic signs) leads into the building it stands by:
   the nearest one within 6 m that does the same */
function doorBuildingOf(a, p) {
  const C = walkData().sc,
    M = p && C.props[p.k];
  if (!p || p.x == null || (M && M.box) || !walkView.sc) return p;
  let best = null,
    bd = 6;
  for (const q of walkView.sc.props || []) {
    const Q = C.props[q.k],
      d = Math.hypot(q.x - p.x, q.z - p.z);
    if (q.act === a && Q && Q.box && d < bd) {
      best = q;
      bd = d;
    }
  }
  return best || p;
}
export function enterRoom(a, p) {
  p = doorBuildingOf(a, p);
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
  return false;
}
/* v46: seamless rooms (seamless-world.js seamlessRoomMap). The room's view is the place's own view with the room laid in at the
   building's door, so going in and out is a shift of nothing. roomLayIn makes (and starts preparing) that view;
   it is also called when you tap a building, so the room is usually ready by the time you reach the door. */
function roomLayIn(id, p, fresh) {
  if (
    typeof seamlessRoomMap !== 'function' ||
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
  const M = walkData().sc.props[p.k],
    E = doorOf(p);
  if (!M || !M.box || !E) return null;
  const door = [
    +E.at[0].toFixed(1),
    +E.at[1].toFixed(1),
    +E.mid[0].toFixed(1),
  ]; /* the door, and the building's middle */
  if (fresh)
    seamlessWorld.cache.delete(
      seamlessRoomId(walkView.id, id, door) + '|' + seamlessWorld.gen
    ); /* the room as it is now (your room's decorations) */
  const sc = seamlessRoomMap(walkView.id, id, door);
  if (!sc) return null;
  seamlessGetReady(sc.id, true, door);
  return { view: sc.id, door, base: walkView.id, at: E.at, out: E.out };
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
  const q = doorBuildingOf(h.act, h.p),
    id = roomFor(h.act, q);
  if (id) roomLayIn(id, q);
}
function roomStepIn(info, n = 0) {
  if (uiState.goingIn !== info) return;
  const P = walkView.pl,
    fr = [info.door[0], info.door[1] - 0.45];
  if (!P || walkView.id !== info.base || Math.hypot(P.x - fr[0], P.z - fr[1]) > 2.2) {
    uiState.goingIn = null;
    return;
  } /* you walked off, or the view moved on */
  /* phase 08b: the room's floor is painted in a moment; after 2 s at the door it is painted at once */
  if (!seamlessGetReady(info.view, true, info.door)) {
    if (n < 20) {
      setTimeout(() => roomStepIn(info, n + 1), 100);
      return;
    }
    const sc = mapById(info.view);
    if (!sc || !roomFloorReady(sc.roomScene, -5, true)) {
      uiState.goingIn = null;
      if (typeof debugLog !== 'undefined') debugLog.add('scene', `room ${info.id}: its floor couldn't be made`);
      return;
    }
  }
  uiState.goingIn = null;
  uiState.inside = info;
  uiState.roam = null;
  /* phase 08b: the camera as it was at the door, for coming out */
  if (typeof walkRenderer !== 'undefined' && walkRenderer.camT)
    info.cam = {
      T: walkRenderer.camT.slice(),
      cpe: walkRenderer.cpe ? walkRenderer.cpe.slice() : null,
      yaw: walkRenderer.yawT,
      zoom: walkRenderer.zoomT,
    };
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
  /* out through the door: you stand just in front of it, facing out (phase 08b: the way the building faces), and the
     camera is as it was when you went in */
  const P = walkView.pl,
    at = I.at || I.door,
    out = I.out || [0, -1],
    fr = [at[0] + out[0] * 0.6, at[1] + out[1] * 0.6];
  if (P && walkView.id === I.view) {
    P.x = fr[0];
    P.z = fr[1];
    P.route = null;
    P.goal = null;
    P.dir = Math.abs(out[0]) > Math.abs(out[1]) ? (out[0] > 0 ? 'right' : 'left') : out[1] < 0 ? 'down' : 'up';
  }
  const B = mapById(I.base),
    o = (B && B.baseOff) || [0, 0];
  uiState.roam = { id: (B && B.baseId) || I.back.id, node: I.node, x: fr[0] - o[0], z: fr[1] - o[1] };
  uiState.backAt = null;
  if (typeof soundEffect === 'function') soundEffect('door');
  render();
  if (I.cam && typeof walkRenderer !== 'undefined') {
    walkRenderer.camT = I.cam.T.slice();
    if (I.cam.cpe) walkRenderer.cpe = I.cam.cpe.slice();
    walkRenderer.yawT = walkRenderer.yaw = I.cam.yaw;
    walkRenderer.zoomT = walkRenderer.zoom = I.cam.zoom;
  }
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
  } else if (I.kind === 'clinic') clinicHeal(I.p.say);
  else if (I.kind === 'lab' && typeof talkHazel === 'function') talkHazel(I.p);
  else if (I.kind === 'home' && typeof homeDecorate === 'function') homeDecorate();
  else {
    const c = (mapById(I.id) || {}).chat || [];
    toast(c.length ? `“${c[Math.floor(Math.random() * c.length)]}”` : 'They wave hello.');
  }
}
function roomState() {
  const I = uiState.inside;
  if (!I) return null;
  const sc = I.node === saveData.trip.node && I.view ? mapById(I.view) : null;
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
export function walkState() {
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
  const node = saveData.trip.node;
  let v; /* alpha 0.4.1: walking yourself, the view is always the place you're in */
  {
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
  }
  /* v46: a new view is shown only once its ground is ready on the card; until then you stay in the one on screen (seamless-world.js seamlessGate) */
  if (typeof seamlessGate === 'function' && v && v.pos && v.roam) v = seamlessGate(v);
  const sc = mapById(v.id) || {},
    ex = mapExits(v.node),
    bl = blockerAt(v.node),
    dest = v.node === node ? (saveData.trip.plan[0] ?? null) : null;
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
        if (PEOPLE[P.who] && ((!P.when && !P.unless) || storyAllows(P)))
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
  v.enc = encountersHere().map(q => ({
    id: q.id,
    lvl: q.lvl,
    sp: q.sp,
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
    const q = encountersHere().find(x => x.id === h.e.id);
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
    } else if (a === 'clinic') clinicHeal(p.say);
    else if (a === 'lab' && typeof talkHazel === 'function') talkHazel(p);
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
    if (Date.now() - (uiState.groundTip || 0) > 6000) {
      uiState.groundTip = Date.now();
      toast('Tap the ground to walk there.');
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
  const sc = walkView.sc,
    pt = sc && sc.exits && sc.exits[e.i];
  if (!pt || !walkView.pl) return;
  const hub = mapHub(sc),
    dx = pt[0] - hub[0],
    dz = pt[1] - hub[1],
    l = Math.hypot(dx, dz) || 1;
  walkTo(walkablePointNear(pt[0] + (dx / l) * 3.5, pt[1] + (dz / l) * 3.5));
}
setInterval(() => {
  try {
    if (typeof storyResumeCheck === 'function') storyResumeCheck();
    if (typeof storyCheck === 'function') storyCheck();
    if (typeof legendCheck === 'function') legendCheck();
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
export function walkCross() {
  if (
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
    /* RL-7: in a run a crossing counts a few metres in (rules.json run.seamIn), so a step over a seam and back costs
       no day */
    const inside = saveData.run ? RULES.run.seamIn : 1;
    if (Math.min(x, z, s.w - x, s.h - z) < inside || !ROADS_BY_NODE[node].some(e => e.to === n)) return;
    const bl = blockerAt(node);
    let why = !canEnter(n)
      ? gateText(LOCATIONS[n])
      : bl && !saveData.visited[n]
        ? `${bl.name} is blocking the way. Beat them first.`
        : null;
    /* RL-7: in a run a crossing is an arrival (logic/run-map.js runArrive: a day, the path, what the map shows) */
    if (!why && saveData.run && !runArrive(saveData, runMapNode(n), runWorldData()))
      why = 'That way isn’t on the run’s map.';
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
    saveData.trip = { node: n, plan };
    saveData.visited[n] = 1;
    if (typeof arrivedAt === 'function') arrivedAt(n);
    uiState.roam = { id: q.id, node: n, x, z };
    uiState.backAt = null;
    if (typeof debugLog !== 'undefined')
      debugLog.add(
        'travel',
        'walked into ' + LOCATIONS[n].name + (saveData.run ? ` (the run's day ${saveData.run.clock})` : '')
      );
    /* RL-8: a run's arrival is a checkpoint: the account too, at once */
    if (saveData.run) {
      saveNow();
      runArrivedHint();
    } else save();
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
    /* phase 06-3: the battle needs the 3D scene (there is no painted stage): keep it running, or open the one where you
       are below; the battle joins it as soon as it is ready (battle-stage.js battleStageJoin3d) */
    if (walkView.cv) return;
  }
  const on = saveData.started && (!!activeBattle || uiState.tab !== 'map') && !!mapIdAt(saveData.trip.node),
    walk = on && !activeBattle && uiState.tab === 'walk';
  let cv = $('#dio');
  document.body.classList.toggle('on-walk', walk);
  document.body.classList.toggle('on-scene', on && !walk && !activeBattle);
  if (!on) {
    if (walkView.cv) stopWalkView();
    if (uiState.tab === 'map' && saveData.started && typeof worldMapWanted === 'function' && worldMapWanted()) {
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
  saveData.trip = { node: START_NODE, plan: [] };
  saveData.visited = { [START_NODE]: 1 };
  saveData.mapSeen = null;
  for (let i = 0; i < R.starterEncounters; i++) spawn(true);
  const egg = R.starterEgg && EGGS[R.starterEgg] ? addEgg(R.starterEgg) : false;
  save();
  flushSave();
  uiState.tab = 'walk';
  render();
  const nE = R.starterEncounters,
    words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const W = {
    title: `${speciesOf(m).name} joined your team`,
    top: `<div class="sheet-art">${rigCanvasHTML(m.sp, 128)}</div>`,
    html: `${nE ? `<p>${words[nE] || nE} Billie${nE === 1 ? ' is' : 's are'} already rustling in the grass. Tap one to battle it, then flick a coin.</p>` : ''}<p>When you’re ready, the airship at the mast flies you out on a run.</p>${egg ? `<p>Professor Hazel also gave you a ${eggKm(R.starterEgg)} km egg. It’s warming up in an incubator and hatches after ${eggKm(R.starterEgg)} km of walking outdoors.</p>` : ''}`,
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
  if (typeof worldMapAction === 'function' && worldMapAction(a, d)) return;
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
    case 'tab':
      /* phase 10: from a walk scene the walk camera rises first, then the bowl pulls back (world-bowl.js) */
      if (
        d.t === 'map' &&
        uiState.tab === 'walk' &&
        typeof worldMapOpenFromWalk === 'function' &&
        worldMapOpenFromWalk()
      )
        break;
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
    case 'card-open':
    case 'enc':
    case 'clinic':
    case 'rest':
    case 'trainer':
    case 'rungiveup':
      walkTabAction(a, d);
      break;
    case 'mon':
    case 'mact':
    case 'mnick':
    case 'mlead':
    case 'mbuddy':
    case 'mheal':
    case 'mhealuse':
    case 'mteam':
    case 'tmadd':
    case 'tmaddon':
    case 'mswap':
      billieSheetAction(a, d);
      break;
    case 'boxsort':
    case 'boxf':
      teamAction(a, d);
      break;
    case 'msel':
    case 'travel':
    case 'stoptrip':
    case 'mzoom':
    case 'mreset':
      mapTabAction(a, d);
      break;
    case 'dex':
    case 'dexback':
    case 'dexf':
    case 'guidetab':
    case 'loresec':
    case 'lorebook':
      guideAction(a, d);
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
      /* phase 06-3: the moves are on the first menu too */
      if (activeBattle && (activeBattle.phase === 'fight' || activeBattle.phase === 'choose')) {
        activeBattle.phase = 'fight';
        if (typeof tutorPicked === 'function') tutorPicked();
        pickMove(d.m);
      }
      break;
    case 'btarget':
      if (activeBattle && activeBattle.phase === 'target' && d.t != null) pickTarget(+d.t);
      break;
    case 'wsopen':
    case 'wsslot':
    case 'wsfit':
    case 'wsup':
    case 'wsbuild':
      workshopAction(a, d);
      break;
    case 'bpart':
      if (activeBattle && activeBattle.phase === 'part' && d.p) pickPart(d.p);
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
        /* phase 06-3: the first menu has the moves, so Back always goes there */
        activeBattle.phase = 'choose';
        chooseMessage();
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
    /* phase 06-3: 1-4 pick a move straight from the first menu */
    if (/^[1-9]$/.test(k)) {
      const b = $$('#acts [data-a=bmove]')[+k - 1];
      if (b) b.click();
    } else if (k === 'x' || k === 'c') click('[data-a=bcoins]');
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
