'use strict';
/* ================= AIRSHIPS (alpha 0.4) =================
   Every town has an airship mast: the lattice mooring mast and its airship, a wooden ship hung under a balloon with a
   turbine either side of the stern, its propellers turning (a low-poly model painted with the buildings' 32 px
   textures, art/scene/models/airship_mast.json, tools/build-airship.py). Under the
   ground a sky lift goes up to the mooring; in Verdigris City the old station is the airship terminal, its ticket
   window inside. Any prop with act 'fly' does it. Once you have been to a town you can fly back to it from any mast:
   the flight is shown over the world map (the bowl, world-bowl.js), the airship carrying you along an arc above the
   land in 2-3 s (tap to skip), and a ticket costs money. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  buildingRowsHTML,
  closeModal,
  mapIdAt,
  modal,
  provide,
  render,
  runGiveUp,
  runHint,
  runStartSheet,
  runStartable,
  storyFlags,
  toast,
} from './hooks.js';
import { $, clamp } from './util.js';
import { LOCATIONS, LOCATION_BY_ID, isTown, locationFullName } from './game-data.js';
import { canEnter, formatNumber, plural } from './logic/rules.js';
import { turnedPoint } from './logic/prop-turn.js';
import { bowlSurface } from './logic/bowl-camera.js';
import { setStoryFlag } from './logic/script.js';
import { isLiteMap, loadMapFile, loadMapsAhead } from './map-files.js';
import { escapeHtml, reducedMotion, save, saveData, uiState } from './game-state.js';
import { artLoad, moneyHTML, uiIconHTML } from './art.js';
import { artImage, imageReady, mapById, prepareMap, walkData } from './walk-view.js';
import { seamlessHubMap } from './seamless-world.js';
import { worldMap, worldMapSpot } from './world-bowl.js';
import { soundEffect } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  airshipFlight: [() => airshipFlight],
  flyDistance: [() => flyDistance, v => (flyDistance = v)],
  flyDraw: [() => flyDraw, v => ((flyDraw = v), provide({ flyDraw }))],
  flyFare: [() => flyFare, v => (flyFare = v)],
  flyLand: [() => flyLand, v => (flyLand = v)],
  flyMenu: [() => flyMenu, v => (flyMenu = v)],
  flyPoint: [() => flyPoint, v => (flyPoint = v)],
  flySkip: [() => flySkip, v => ((flySkip = v), provide({ flySkip }))],
  flyTick: [() => flyTick, v => ((flyTick = v), provide({ flyTick }))],
  flyTowns: [() => flyTowns, v => (flyTowns = v)],
  glassLift: [() => glassLift],
  rideGlassLift: [() => rideGlassLift, v => (rideGlassLift = v)],
  standByMast: [() => standByMast, v => (standByMast = v)],
  startAirshipFlight: [() => startAirshipFlight, v => (startAirshipFlight = v)],
  stationMenu: [() => stationMenu, v => (stationMenu = v)],
});
/* eslint-enable no-func-assign */
provide({ flyDraw, flySkip, flyTick });
/* to-module: end */
export const airshipFlight = { on: false, a: -1, b: -1, t0: 0, dur: 0, lastX: null, dir: 1 };
provide({ airshipFlight }); /* to-module */
/* where the airships go from here: the towns you've been to (and may enter), nearest first */
function flyTowns() {
  const here = saveData.trip.node;
  return LOCATIONS.map((r, i) => i)
    .filter(
      i =>
        i !== here &&
        isTown(i) &&
        !LOCATIONS[i].noFly &&
        saveData.visited[i] &&
        mapIdAt(i) &&
        (typeof canEnter !== 'function' || canEnter(i))
    )
    .sort((x, y) => flyFare(here, x) - flyFare(here, y));
}
/* how far apart two places lie on the bowl, in bowl radii */
function flyDistance(a, b) {
  const A = worldMapSpot(a),
    B = worldMapSpot(b);
  return Math.hypot(B.x - A.x, B.y - A.y);
}
/* a ticket: by how far apart the two towns lie on the world */
function flyFare(a, b) {
  return Math.max(60, Math.round((60 + flyDistance(a, b) * 540) / 10) * 10);
}
export function flyMenu(p) {
  if (airshipFlight.on || !saveData.started) return;
  /* RL-8: on a run the airship only takes you home, which gives the run up */
  if (saveData.run) {
    modal({
      title: escapeHtml((p && p.label) || 'Airship mast'),
      cls: 'fly-sheet',
      html: '<p>The airship waits here for the end of the run. Flying home now gives the run up.</p>',
      btns: [
        {
          l: 'Fly home',
          c: 'red',
          f: () => {
            uiState.modal = null;
            if (typeof runGiveUp === 'function') runGiveUp();
          },
        },
        { l: 'Not now', c: 'quiet', f: closeModal },
      ],
    });
    return;
  }
  /* RL-11: the mast's sheet comes back after an upgrade bought on it */
  uiState.flyAt = p;
  const L = flyTowns(),
    here = saveData.trip.node;
  const rows = L.map(i => {
    const f = flyFare(here, i),
      ok = saveData.se >= f;
    return `<button class="pickrow fly-row${ok ? '' : ' off'}" data-a="flyto" data-n="${i}"${ok ? '' : ' aria-disabled="true"'}><span class="fly-ico">${uiIconHTML('house', 18)}</span><span class="pr-t"><b>${escapeHtml(locationFullName(LOCATIONS[i]))}</b><small>${escapeHtml(LOCATIONS[i].blurb || '')}</small></span><span class="fly-fare tnum">${moneyHTML(f)}</span></button>`;
  }).join('');
  /* RL-8: a run starts here (run.js) */
  const runRow =
    typeof runStartable === 'function' && runStartable()
      ? `<button class="pickrow fly-row" data-a="runstart"><span class="fly-ico">${uiIconHTML('map', 18)}</span><span class="pr-t"><b>Start a run</b><small>Expedition I · the wild lands past the island</small></span><span class="fly-fare">Free</span></button>`
      : '';
  /* RL-11: the airship's upgrades, for Crests */
  const ups = typeof buildingRowsHTML === 'function' ? buildingRowsHTML('station', 'fly') : '',
    upHTML = ups
      ? `<p class="note">Airship upgrades, paid in Crests. You have ${formatNumber(saveData.meta.crests)}.</p>${ups}`
      : '';
  modal({
    title: escapeHtml((p && p.label) || 'Airship mast'),
    cls: 'fly-sheet',
    html:
      (runRow ? `<div class="list">${runRow}</div>` : '') +
      upHTML +
      (L.length
        ? `<p class="note">The airships fly to the towns you’ve been to. A ticket is paid in Moneys. You have ${moneyHTML(saveData.se)}.</p><div class="list">${rows}</div>`
        : runRow
          ? ''
          : `<p>The airships fly to the towns you’ve already been to. Walk on to another town, and you can fly back here from its mast whenever you like.</p>`),
    btns: [{ l: 'Not now', c: 'quiet', f: closeModal }],
  });
}
/* HB-7: Skyline Station's sheet (a prop with act 'station', the hub's): "Start a run" (run.js runStartSheet) and the
   station's upgrades, paid in Crests; the airship moored beside it is scenery. Before HB-8 the run still sets off on
   the airship's flight over the world map */
export function stationMenu(p) {
  if (airshipFlight.on || !saveData.started) return;
  if (saveData.run) {
    toast('The trains wait here for the end of the run.');
    return;
  }
  /* the sheet comes back after an upgrade bought on it (lab-board.js labAction) */
  uiState.stationAt = p;
  const runRow =
    typeof runStartable === 'function' && runStartable()
      ? `<button class="pickrow fly-row" data-a="runstart"><span class="fly-ico">${uiIconHTML('map', 18)}</span><span class="pr-t"><b>Start a run</b><small>Expedition I · the wild lands past the island</small></span><span class="fly-fare">Free</span></button>`
      : '';
  const ups = typeof buildingRowsHTML === 'function' ? buildingRowsHTML('station', 'station') : '',
    upHTML = ups
      ? `<p class="note">Station upgrades, paid in Crests. You have ${formatNumber(saveData.meta.crests)}.</p>${ups}`
      : '';
  modal({
    title: escapeHtml((p && p.label) || 'Skyline Station'),
    cls: 'fly-sheet station-sheet',
    html: (runRow ? `<div class="list">${runRow}</div>` : '') + upHTML,
    btns: [{ l: 'Not now', c: 'quiet', f: closeModal }],
  });
}
/* buy the ticket and go: you are at the other end at once (a reload mid-flight lands you there), the flight is the
   show on the way */
/* RL-8: o.free: a flight a run pays for itself (run.js, to its landing): from o.from, the trip left as the caller set it
   (runArrive has moved it already), no ticket */
export function startAirshipFlight(i, o = {}) {
  if (airshipFlight.on || !LOCATIONS[i]) return;
  const a = o.free && LOCATIONS[o.from] ? o.from : saveData.trip.node,
    f = o.free ? 0 : flyFare(a, i);
  if (saveData.se < f) {
    toast(`A ticket to ${LOCATIONS[i].name} costs ${plural(f, 'Money')}. You have ${plural(saveData.se, 'Money')}.`);
    return;
  }
  if (!o.free) {
    saveData.se -= f;
    saveData.trip = { node: i, plan: [] };
    saveData.visited[i] = 1;
  }
  uiState.inside = null;
  uiState.goingIn = null;
  uiState.backAt = null;
  uiState.roam = null;
  uiState.mapSel = null;
  if (typeof storyFlags === 'function') {
    const F = storyFlags();
    setStoryFlag('flights', (F.flights || 0) + 1);
  }
  save();
  closeModal();
  if (typeof debugLog !== 'undefined')
    debugLog.add('scene', `airship ${LOCATIONS[a].id} to ${LOCATIONS[i].id} (${f} Moneys)`);
  const d = flyDistance(a, i);
  Object.assign(airshipFlight, {
    on: true,
    a,
    b: i,
    t0: performance.now() + 500,
    /* 2-3 s by how far (owner, phase 10), tap to skip */
    dur: reducedMotion ? 400 : 2000 + Math.min(1, d / 1.2) * 1000,
    span: Math.max(0.8, d * 0.9),
    pos: null,
    lastX: null,
    dir: 1,
  });
  if (typeof artLoad === 'function') artLoad(['map/airship.png']).catch(() => {});
  if (typeof prepareMap === 'function' && typeof seamlessHubMap === 'function') {
    try {
      const h = seamlessHubMap(i);
      if (h && h.id) prepareMap(h.id);
    } catch (e) {}
  }
  document.body.classList.add('flying');
  uiState.mglFrom = null;
  uiState.tab = 'map';
  render();
  worldMap.dirty = true;
  const host = $('.map-full');
  if (host && !$('#flycap')) {
    const c = document.createElement('div');
    c.id = 'flycap';
    c.className = 'fly-cap glass';
    c.innerHTML = `<small>Airship</small><b>${escapeHtml(locationFullName(LOCATIONS[a]))} → ${escapeHtml(locationFullName(LOCATIONS[i]))}</b><span class="note">Tap to skip</span>`;
    host.appendChild(c);
  }
  if (typeof soundEffect === 'function') soundEffect('throw');
}
/* the map asks this each frame while flying: where the airship is (airshipFlight.pos: x, y on the bowl and its
   height), so the camera can keep it in view */
function flyPoint(k) {
  const A = worldMapSpot(airshipFlight.a),
    B = worldMapSpot(airshipFlight.b),
    e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    x = A.x + (B.x - A.x) * e,
    y = A.y + (B.y - A.y) * e;
  return [x, y, bowlSurface(x, y) + 0.02 + 0.12 * Math.sin(Math.PI * Math.min(1, k * 1.15))];
}
function flyTick(ts) {
  if (!airshipFlight.on) return false;
  const k = clamp((ts - airshipFlight.t0) / airshipFlight.dur, 0, 1);
  airshipFlight.k = k;
  airshipFlight.pos = flyPoint(k);
  worldMap.dirty = true;
  if (k >= 1) {
    flyLand();
    return false;
  }
  return true;
}
/* drawn instead of you on the map: the airship on its arc, its shadow on the land, the way behind;
   proj(x, y, h) gives a point of the bowl on the screen */
function flyDraw(c, t, proj) {
  const k = airshipFlight.k || 0,
    p = airshipFlight.pos || flyPoint(k),
    q = proj(p[0], p[1], p[2]),
    qg = proj(p[0], p[1], bowlSurface(p[0], p[1]));
  if (!q) return;
  const trail = [];
  for (let f = 0; f <= k + 1e-6; f += 0.02) {
    const w = flyPoint(f),
      qq = proj(w[0], w[1], w[2]);
    if (qq) trail.push(qq);
  }
  if (trail.length > 1) {
    c.save();
    c.strokeStyle = 'rgba(255,255,255,.75)';
    c.lineWidth = 2;
    c.setLineDash([3, 6]);
    c.lineDashOffset = -t / 50;
    c.beginPath();
    trail.forEach((pt, i) => (i ? c.lineTo(pt.x, pt.y) : c.moveTo(pt.x, pt.y)));
    c.stroke();
    c.restore();
  }
  if (qg) {
    c.fillStyle = 'rgba(20,10,40,.28)';
    c.beginPath();
    c.ellipse(qg.x, qg.y, 14, 4, 0, 0, 7);
    c.fill();
  }
  if (airshipFlight.lastX != null && Math.abs(q.x - airshipFlight.lastX) > 0.3)
    airshipFlight.dir = q.x < airshipFlight.lastX ? -1 : 1;
  airshipFlight.lastX = q.x;
  const im = typeof artImage === 'function' ? artImage('map/airship.png') : null,
    bob = Math.sin(t / 420) * 1.5;
  if (im && imageReady(im)) {
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      s = 1.25;
    c.imageSmoothingEnabled = false;
    c.save();
    c.translate(Math.round(q.x), Math.round(q.y + bob));
    c.scale(airshipFlight.dir < 0 ? -s : s, s);
    c.drawImage(im, -w / 2, -h);
    c.restore();
  } else {
    c.fillStyle = '#F0E4C8';
    c.beginPath();
    c.ellipse(q.x, q.y - 16 + bob, 18, 8, 0, 0, 7);
    c.fill();
    c.fillStyle = '#9A6040';
    c.fillRect(q.x - 9, q.y - 8 + bob, 18, 5);
  }
}
/* RL-8: stand beside a place's airship mast (the first prop with act 'fly' in its own map), where a flight lands you
   and where a run's end leaves you in Copperleaf; at the place's middle when it has none. Returns whether it has one.
   HB-7: Skyline Station first (act 'station', the hub's), where runs start */
export function standByMast(b) {
  const sid = mapIdAt(b),
    sc = typeof mapById === 'function' ? mapById(sid) : null,
    P = (sc && sc.props) || [],
    m = P.find(p => p.act === 'station') || P.find(p => p.act === 'fly');
  if (!m || typeof walkData !== 'function') return false;
  const C = walkData().sc,
    M = C.props[m.k] || {},
    s = m.s || 1,
    f = m.f ? -1 : 1,
    bx = M.box ? M.box[0] * s : 1.2;
  /* IS-5: beside it as it is turned (the island's mast faces its street); the walk puts you on open ground near it */
  const [x, z] = turnedPoint(m, (bx / 2 + 0.9) * f, -0.9);
  uiState.roam = { id: sid, node: b, x, z };
  return true;
}
/* landing: the walk screen in the new town, standing by its mast */
function flyLand() {
  if (!airshipFlight.on || airshipFlight.wait) return;
  /* phase 04b: you land by the mast, which is in the town's own map file */
  if (typeof isLiteMap === 'function' && isLiteMap(mapIdAt(airshipFlight.b))) {
    airshipFlight.wait = loadMapFile(mapIdAt(airshipFlight.b)).then(() => {
      airshipFlight.wait = null;
      flyLand();
    });
    return;
  }
  const b = airshipFlight.b;
  airshipFlight.on = false;
  airshipFlight.pos = null;
  document.body.classList.remove('flying');
  const cap = $('#flycap');
  if (cap) cap.remove();
  standByMast(b);
  uiState.tab = 'walk';
  /* RL-8: a run's flight has landed */
  if (saveData.run && saveData.run.at.phase === 'fly') {
    saveData.run.at.phase = 'walk';
    if (typeof runHint === 'function') runHint('landing');
  }
  save();
  render();
  if (!saveData.run) toast(`Welcome to ${LOCATIONS[b].name}.`);
  if (typeof soundEffect === 'function') soundEffect('pop');
}
function flySkip() {
  if (airshipFlight.on) {
    airshipFlight.t0 = performance.now() - airshipFlight.dur;
    worldMap.dirty = true;
  }
}
document.addEventListener(
  'click',
  ev => {
    if (ev.target.closest && ev.target.closest('[data-a="runstart"]')) {
      ev.stopPropagation();
      ev.preventDefault();
      if (typeof runStartSheet === 'function') runStartSheet();
      return;
    }
    const el = ev.target.closest && ev.target.closest('[data-a="flyto"]');
    if (el) {
      ev.stopPropagation();
      ev.preventDefault();
      if (el.getAttribute('aria-disabled'))
        toast(`You need ${plural(flyFare(saveData.trip.node, +el.dataset.n), 'Money')} for that ticket.`);
      else startAirshipFlight(+el.dataset.n);
      return;
    }
    if (airshipFlight.on && ev.target.closest && ev.target.closest('.map-full,#flycap')) {
      ev.stopPropagation();
      flySkip();
    }
  },
  true
);

/* ================= THE GLASS LIFT (alpha 0.4) =================
   Kelpport's harbour and Pearlantis City, at the bottom of the trench, are joined by a glass lift and nothing else (no
   road, no airship). A prop with act 'lift' and to: '<place id>' takes you there: the screen sinks into blue water (or
   rises into the light), and you step out beside the lift at the other end. Free, as lifts should be. */
export const glassLift = { on: false };
export function rideGlassLift(p) {
  if (glassLift.on || !saveData.started || !p) return;
  const to = LOCATION_BY_ID[p.to];
  if (!to) {
    toast('The lift isn’t working.');
    return;
  }
  const i = to.node,
    a = saveData.trip.node,
    down = !!LOCATIONS[i].noFly;
  glassLift.on = true;
  const cv = document.createElement('div');
  cv.className = 'lift-veil' + (down ? ' down' : ' up');
  cv.innerHTML = `<div class="lift-cap glass"><small>Glass lift</small><b>${down ? 'Down to' : 'Up to'} ${escapeHtml(LOCATIONS[i].name)}</b><span class="note">${down ? 'Kelp, then dark water, then the lights of the dome.' : 'Up past the kelp, into the light.'}</span></div>`;
  document.body.appendChild(cv);
  requestAnimationFrame(() => requestAnimationFrame(() => cv.classList.add('in')));
  if (typeof soundEffect === 'function') soundEffect('throw');
  const ready =
    typeof loadMapsAhead === 'function' ? loadMapsAhead(i) : null; /* phase 04b: the lift is in the map's file */
  setTimeout(
    async () => {
      await ready;
      saveData.trip = { node: i, plan: [] };
      saveData.visited[i] = 1;
      uiState.inside = null;
      uiState.goingIn = null;
      uiState.backAt = null;
      uiState.mapSel = null;
      const sid = mapIdAt(i),
        sc = typeof mapById === 'function' ? mapById(sid) : null,
        m = sc && (sc.props || []).find(q => q.act === 'lift');
      if (m && typeof walkData === 'function') {
        const C = walkData().sc,
          M = C.props[m.k] || {},
          s = m.s || 1,
          f = m.f ? -1 : 1,
          bx = M.box ? M.box[0] * s : 1.2;
        uiState.roam = { id: sid, node: i, x: m.x + (bx / 2 + 0.9) * f, z: m.z - 0.9 };
      } else uiState.roam = null;
      if (typeof debugLog !== 'undefined') debugLog.add('scene', `lift ${LOCATIONS[a].id} to ${LOCATIONS[i].id}`);
      uiState.tab = 'walk';
      save();
      render();
    },
    reducedMotion ? 200 : 1500
  );
  setTimeout(
    () => {
      cv.classList.remove('in');
      setTimeout(() => {
        cv.remove();
        glassLift.on = false;
      }, 700);
      toast(`${LOCATIONS[i].name}.`);
      if (typeof soundEffect === 'function') soundEffect('pop');
    },
    reducedMotion ? 500 : 2600
  );
}
