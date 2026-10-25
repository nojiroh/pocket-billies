'use strict';
/* ================= WALK CONTROL ================= */
/* UI-5: the walk scene behind the Walk tab (rooms and their doors, what a tap on the scene does, crossing a seam, the map's look-ahead), moved from ui.js as it was; not a screen, so it keeps its shape */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render } from './hooks.js';
import { $, clamp } from './util.js';
import { LOCATIONS, PEOPLE, ROADS, ROADS_BY_NODE, RULES, SHOPS, gameData, trainersAt } from './game-data.js';
import { blockerAt, canEnter, encounterBuild, encountersHere, gateText, healAll } from './logic/rules.js';
import { roomTurnOf } from './logic/room-turn.js';
import { runArrive, runMapNode } from './logic/run-map.js';
import { routeTrainerSpot } from './logic/route-trainers.js';
import { startWild } from './logic/battle-engine.js';
import { storyAllows } from './logic/script.js';
import { activeBattle, save, saveData, saveNow, uiState } from './game-state.js';
import { userFps } from './frame-scheduler.js';
import { artLoad } from './art.js';
import {
  ROOM_BY_USE,
  closedText,
  directionOf,
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
import { worldMapWanted } from './world-bowl.js';
import { openShop } from './shop.js';
import { runArriveSound, soundEffect } from './sound.js';
import { talkChosen } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { loreBook } from './lore.js';
import { flyMenu, rideGlassLift } from './airship.js';
import { runWorldData } from './run-world.js';
import { runArrivedFx, runArrivedHint } from './run.js';
import { fieldMoveOpen, fieldWayOut } from './field-moves.js';
import { encounterOpen } from './encounter-screen.js';
import { ranchOpen } from './ranch-screen.js';
import { labBoardOpen } from './lab-board.js';
import { postcardCheck } from './postcards.js';
import { legendCheck, personTalk, storyCheck, trainerTalk } from './story.js';
import { routeSight } from './route-sight.js';
import { storyResumeCheck } from './story-stage.js';
import { toast } from './overlay.js';
import { clinicHeal } from './walk-tab.js';
/* eslint-disable no-func-assign */
expose({
  doorBuildingOf: [() => doorBuildingOf, v => (doorBuildingOf = v)],
  enterRoom: [() => enterRoom, v => (enterRoom = v)],
  exitPrompt: [() => exitPrompt, v => (exitPrompt = v)],
  leaveRoom: [() => leaveRoom, v => ((leaveRoom = v), provide({ leaveRoom }))],
  mapExits: [() => mapExits, v => (mapExits = v)],
  mapIdAt: [() => mapIdAt, v => ((mapIdAt = v), provide({ mapIdAt }))],
  mapOffsetInView: [() => mapOffsetInView, v => ((mapOffsetInView = v), provide({ mapOffsetInView }))],
  roomAct: [() => roomAct, v => (roomAct = v)],
  roomAim: [() => roomAim, v => (roomAim = v)],
  roomFor: [() => roomFor, v => (roomFor = v)],
  roomFrontOf: [() => roomFrontOf, v => (roomFrontOf = v)],
  roomLayIn: [() => roomLayIn, v => (roomLayIn = v)],
  roomPeople: [() => roomPeople, v => (roomPeople = v)],
  roomRefresh: [() => roomRefresh, v => (roomRefresh = v)],
  roomState: [() => roomState, v => ((roomState = v), provide({ roomState }))],
  roomStepIn: [() => roomStepIn, v => (roomStepIn = v)],
  runSeenSum: [() => runSeenSum, v => (runSeenSum = v)],
  walkCross: [() => walkCross, v => (walkCross = v)],
  walkMapSync: [() => walkMapSync, v => (walkMapSync = v)],
  walkPick: [() => walkPick, v => (walkPick = v)],
  walkState: [() => walkState, v => (walkState = v)],
});
/* eslint-enable no-func-assign */
provide({ leaveRoom, mapIdAt, mapOffsetInView, roomState });
/* to-module: end */
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
  /* v46: the room laid into the place where the building stands: step in once it's ready (a moment at most) */
  const lay = roomLayIn(id, p, true);
  if (lay) {
    Object.assign(info, lay);
    uiState.goingIn = info;
    const P = walkView.pl,
      fr = roomFrontOf(lay);
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
  /* IS-5: a building turned to face east, north or west has its room turned with it: the quarter and the middle's z */
  const q = roomTurnOf(p.rot);
  if (q) door.push(q, +E.mid[1].toFixed(1));
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
/* where you stand to go in: just out of the door (IS-5: the way the building faces) */
function roomFrontOf(I) {
  const at = I.at || I.door,
    out = I.out || [0, -1];
  return I.door[3] ? [at[0] + out[0] * 0.45, at[1] + out[1] * 0.45] : [I.door[0], I.door[1] - 0.45];
}
function roomStepIn(info, n = 0) {
  if (uiState.goingIn !== info) return;
  const P = walkView.pl,
    fr = roomFrontOf(info);
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
      /* CAM-1: the follow's state (its speeds, look-ahead and goals) */
      fol: walkRenderer.fol ? JSON.parse(JSON.stringify(walkRenderer.fol)) : null,
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
    if (I.cam.fol) walkRenderer.fol = JSON.parse(JSON.stringify(I.cam.fol));
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
  /* RL-11: the unlock board in the Chosen's lab opens the Lab tab */
  if (pa === 'board' && typeof labBoardOpen === 'function') {
    labBoardOpen();
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
  else if (I.kind === 'lab' && typeof talkChosen === 'function') talkChosen(I.p);
  else if (I.kind === 'ranch' && typeof ranchOpen === 'function') ranchOpen();
  else {
    const c = (mapById(I.id) || {}).chat || [];
    toast(c.length ? `“${c[Math.floor(Math.random() * c.length)]}”` : 'They wave hello.');
  }
}
/** the room's own people who only talk (its map's people, as a place's are), whose story conditions hold
 * @param {any} sc the room's scene */
function roomPeople(sc) {
  const R = sc.roomOf ? mapById(sc.roomOf) : null;
  return ((R && R.people) || []).filter(
    (/** @type {any} */ P) => PEOPLE[P.who] && ((!P.when && !P.unless) || storyAllows(P))
  );
}
export function roomState() {
  const I = uiState.inside;
  if (!I) return null;
  const sc = I.node === saveData.trip.node && I.view ? mapById(I.view) : null;
  if (!sc) {
    uiState.inside = null;
    return null;
  }
  const dr = sc.roomDoor || I.door,
    pos =
      walkView.id === I.view && walkView.pl
        ? [walkView.pl.x, walkView.pl.z]
        : I.door && I.door[3]
          ? roomFrontOf(I)
          : [dr[0], dr[1] - 0.45];
  return {
    id: I.view,
    node: saveData.trip.node,
    mode: 'roam',
    pos,
    roam: true,
    who: 'me',
    enc: [],
    npcs: [
      ...(sc.keeper ? [{ who: sc.keeper, id: '_keeper:' + I.id, done: true, exit: null, dir: 'down' }] : []),
      /* people who only talk in the room's own data (Hazel in the lab): they stand on the room's next npcSpots */
      ...roomPeople(sc).map(P => ({
        who: P.who,
        id: '_talk:' + P.id,
        talk: P,
        done: true,
        exit: null,
        dir: P.dir || 'down',
      })),
    ],
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
      /* RL-12b: a route trainer stands by the road, facing it (logic/route-trainers.js); it sees you from there */
      if (T.route) {
        const bid = sc.baseId || v.id,
          base = mapById(bid) || sc,
          o = sc.baseOff || [0, 0],
          S = routeTrainerSpot(mapHub(base), base.exits || [], T.route.k, T.route.n);
        if (S) {
          const at = /** @type {[number, number]} */ ([S.at[0] + o[0], S.at[1] + o[1]]),
            look = /** @type {[number, number]} */ ([S.road[0] + o[0], S.road[1] + o[1]]);
          walkView.npcLook[T.id] = look;
          return {
            who: T.who,
            id: T.id,
            done: !!saveData.flags[T.id],
            exit: null,
            dir: directionOf(look[0] - at[0], look[1] - at[1]),
            route: true,
            at,
          };
        }
      }
      return { who: T.who, id: T.id, done: !!saveData.flags[T.id], exit, dir: 'down', boss: T.runFoe === 'boss' };
    });
  /* alpha 0.4: people who only talk (Granny Juniper in her garden): the place's own (scene.people), in the view's metres */
  {
    const bid = sc.baseId || v.id,
      base = mapById(bid),
      o = sc.baseOff || [0, 0];
    if (base && bid === mapIdAt(v.node))
      for (const P of base.people || [])
        /* TW-2: a run town's named local has a townsfolk look ('folk:<seed>') and lines of their own */
        if ((PEOPLE[P.who] || (P.lines && /^folk:/.test(P.who))) && ((!P.when && !P.unless) || storyAllows(P)))
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
    /* CAM-2: who you talk to, for the camera's two-shot (walk/camera.js) */
    const at = h.n && walkView.npcAt[h.n.id];
    if (at) walkRenderer.talkAt = { x: at[0], z: at[1], t: walkView.t };
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
    /* RL-R2: a field move's obstacle (Cut, Rock Smash, Surf) and a side area's way out (field-moves.js) */
    if (a === 'field' && typeof fieldMoveOpen === 'function') {
      fieldMoveOpen(p);
      return;
    }
    if (a === 'fieldout' && typeof fieldWayOut === 'function') {
      fieldWayOut();
      return;
    }
    /* RL-12b: a waystation's stand opens its event (encounter-screen.js); a stall opens its shop where you stand */
    if (a === 'event' && typeof encounterOpen === 'function') {
      encounterOpen(runMapNode(node));
      return;
    }
    if (a === 'stall') {
      const id = p.shop || here.shop;
      if (id && SHOPS[id]) openShop(id);
      else toast(p.say || 'The stall is packed up today.');
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
    /* IS-8: the pasture's gate opens the ranch's sheet where you stand (the barn's door walks you in) */
    if (a === 'pasture' && typeof ranchOpen === 'function') {
      ranchOpen();
      return;
    }
    if (ROOM_BY_USE[a] && enterRoom(a, p)) return;
    if (a === 'shop') {
      const id = p.shop || here.shop;
      if (id && SHOPS[id]) openShop(id);
      else toast(p.say || 'The shop is closed today.');
    } else if (a === 'clinic') clinicHeal(p.say);
    else if (a === 'lab' && typeof talkChosen === 'function') talkChosen(p);
    else if (a === 'read' && typeof loreBook === 'function') loreBook(p.book);
    else if (a === 'ranch' && typeof ranchOpen === 'function') ranchOpen();
    else if (a === 'board' && typeof labBoardOpen === 'function') labBoardOpen();
    else
      toast(
        p.say ||
          {
            lab: 'The lab is busy with research.',
            house: 'Nobody answers the door.',
            home: 'Nobody answers the door.',
            sign: `You’re in ${here.name}.`,
          }[a] ||
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
    const seen0 = runSeenSum();
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
    uiState.roam = { id: q.id, node: n, x, z };
    uiState.backAt = null;
    if (typeof debugLog !== 'undefined')
      debugLog.add(
        'travel',
        'walked into ' + LOCATIONS[n].name + (saveData.run ? ` (the run's day ${saveData.run.clock})` : '')
      );
    /* RL-8: a run's arrival is a checkpoint: the account too, at once */
    if (saveData.run) {
      runArrivedFx();
      saveNow();
      runArrivedHint();
      /* SND-6: the day's tick and tock, and the reveal's pings when the map shows more */
      if (typeof runArriveSound === 'function') runArriveSound(runSeenSum() > seen0);
    } else save();
    render();
    return;
  }
}
/* SND-6: how much of the run's map shows (each node: 0 hidden, 1 a ?, 2 its icon), to hear when an arrival shows more */
function runSeenSum() {
  const map = saveData.run && saveData.run.map;
  return map ? map.nodes.reduce((a, N) => a + (N.seen || 0), 0) : 0;
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
export function walkMapSync() {
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
      keys: () => !uiState.modal && uiState.tab === 'walk' && !uiState.walkSheet,
      active: () => uiState.tab === 'walk' && !uiState.modal && !routeSight.busy,
      safe: () => {
        const a = $('.wh-card'),
          b = $('.wh-foot'),
          H = innerHeight;
        return [
          a ? clamp(a.getBoundingClientRect().bottom / H, 0, 0.5) : 0.1,
          b ? clamp(b.getBoundingClientRect().top / H, 0.5, 1) : 0.88,
        ];
      },
      /* behind a menu the world runs at 20 a second: a frame stays under the 60 ms a frame may count
         (walk-view-gl.js drawWalkFrame), so it keeps its speed (at 10 it ran at 60% of it) */
      cap: () => {
        const w = document.hidden
          ? 'hidden'
          : walkView.battle
            ? ''
            : uiState.modal
              ? 'window'
              : uiState.tab !== 'walk'
                ? 'screen'
                : '';
        /* 0.1.0 alpha: behind a full screen (Team, Guide, Bag...) the world settles for 0.8 s, then nearly stops (1 a
           second): a still canvas lets the browser keep its blurred backdrop instead of blurring it again every frame,
           which made a phone's menus crawl */
        if (w !== walkView.held) walkView.heldT = performance.now();
        walkView.held = w;
        if (w === 'screen') return performance.now() - (walkView.heldT || 0) > 800 ? 1 : 24;
        return w === 'hidden' ? 1 : w === 'window' ? 20 : userFps();
      },
    }).then(() => cv.classList.add('in'));
  }
}
