'use strict';
/* ================= AIRSHIPS (alpha 0.4) =================
   Every town has an airship mast: the lattice mooring mast and its airship, a wooden ship hung under a balloon with a
   turbine either side of the stern, its propellers turning (a low-poly model painted with the buildings' 32 px
   textures, art/scene/models/airship_mast.json, tools/build-airship.py). Under the
   ground a sky lift goes up to the mooring; in Verdigris City the old station is the airship terminal, its ticket
   window inside. Any prop with act 'fly' does it. Once you have been to a town you can fly back to it from any mast:
   the flight is shown over the world map, the airship carrying you along an arc above the land, and a ticket costs
   money, so your steps stay for walking new ground. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, provide, render, sceneIdAt, storyFlags, toast } from './hooks.js';
import { $, clamp } from './util.js';
import { PLACE, ROUTE, isTown, placeFull } from './game-data.js';
import { isLiteMap, loadMapFile, loadMapsAhead } from './map-files.js';
import { RM, canEnter, esc, fmt, save, saveData, uiState } from './game-state.js';
import { artLoad, uiIconHTML } from './art.js';
import { artImage, imageReady, mapById, prepareMap, walkData } from './walk-view.js';
import { seamlessHubMap } from './seamless-world.js';
import { LOCATION_VECTORS, RADIANS_PER_DEGREE, slerp, vector3, worldMap } from './world-map.js';
import { worldMapGl } from './world-map-gl.js';
import { sfx } from './sound.js';
/* eslint-disable no-func-assign */
expose({
  airshipFlight: [() => airshipFlight],
  flyDraw: [() => flyDraw, v => ((flyDraw = v), provide({ flyDraw }))],
  flyFare: [() => flyFare, v => (flyFare = v)],
  flyLand: [() => flyLand, v => (flyLand = v)],
  flyMenu: [() => flyMenu, v => (flyMenu = v)],
  flySkip: [() => flySkip, v => (flySkip = v)],
  flyTick: [() => flyTick, v => ((flyTick = v), provide({ flyTick }))],
  flyTowns: [() => flyTowns, v => (flyTowns = v)],
  glassLift: [() => glassLift],
  rideGlassLift: [() => rideGlassLift, v => (rideGlassLift = v)],
  startAirshipFlight: [() => startAirshipFlight, v => (startAirshipFlight = v)],
});
/* eslint-enable no-func-assign */
provide({ flyDraw, flyTick });
/* to-module: end */
export const airshipFlight = { on: false, a: -1, b: -1, t0: 0, dur: 0, lastX: null, dir: 1 };
/* where the airships go from here: the towns you've been to (and may enter), nearest first */
function flyTowns() {
  const here = saveData.route.node;
  return ROUTE.map((r, i) => i)
    .filter(
      i =>
        i !== here &&
        isTown(i) &&
        !ROUTE[i].noFly &&
        saveData.visited[i] &&
        sceneIdAt(i) &&
        (typeof canEnter !== 'function' || canEnter(i))
    )
    .sort((x, y) => flyFare(here, x) - flyFare(here, y));
}
/* a ticket: by how far apart the two towns lie on the world */
function flyFare(a, b) {
  const d = Math.acos(clamp(vector3.dot(LOCATION_VECTORS[a], LOCATION_VECTORS[b]), -1, 1)) / RADIANS_PER_DEGREE;
  return Math.max(60, Math.round((60 + d * 6) / 10) * 10);
}
export function flyMenu(p) {
  if (airshipFlight.on || !saveData.started) return;
  const L = flyTowns(),
    here = saveData.route.node;
  const rows = L.map(i => {
    const f = flyFare(here, i),
      ok = saveData.se >= f;
    return `<button class="pickrow fly-row${ok ? '' : ' off'}" data-a="flyto" data-n="${i}"${ok ? '' : ' aria-disabled="true"'}><span class="fly-ico">${uiIconHTML('house', 18)}</span><span class="pr-t"><b>${esc(placeFull(ROUTE[i]))}</b><small>${esc(ROUTE[i].blurb || '')}</small></span><span class="fly-fare tnum">$${fmt(f)}</span></button>`;
  }).join('');
  modal({
    title: esc((p && p.label) || 'Airship mast'),
    cls: 'fly-sheet',
    html: L.length
      ? `<p class="note">The airships fly to the towns you’ve been to. A ticket is paid in money, so your steps stay for walking new ground. You have $${fmt(saveData.se)}.</p><div class="list">${rows}</div>`
      : `<p>The airships fly to the towns you’ve already been to. Walk on to another town, and you can fly back here from its mast whenever you like.</p>`,
    btns: [{ l: 'Not now', c: 'quiet', f: closeModal }],
  });
}
/* buy the ticket and go: you are at the other end at once (a reload mid-flight lands you there), the flight is the
   show on the way */
function startAirshipFlight(i) {
  if (airshipFlight.on || !ROUTE[i]) return;
  const a = saveData.route.node,
    f = flyFare(a, i);
  if (saveData.se < f) {
    toast(`A ticket to ${ROUTE[i].name} costs $${fmt(f)}. You have $${fmt(saveData.se)}.`);
    return;
  }
  saveData.se -= f;
  saveData.route = { node: i, prog: 0, plan: [], hold: false };
  saveData.visited[i] = 1;
  uiState.inside = null;
  uiState.goingIn = null;
  uiState.backAt = null;
  uiState.arrive = null;
  uiState.roam = null;
  uiState.mapSel = null;
  if (typeof storyFlags === 'function') {
    const F = storyFlags();
    F.flights = (F.flights || 0) + 1;
  }
  save();
  closeModal();
  if (typeof NWLOG !== 'undefined') NWLOG.add('scene', `airship ${ROUTE[a].id} to ${ROUTE[i].id} ($${f})`);
  const d = Math.acos(clamp(vector3.dot(LOCATION_VECTORS[a], LOCATION_VECTORS[i]), -1, 1)) / RADIANS_PER_DEGREE;
  Object.assign(airshipFlight, {
    on: true,
    a,
    b: i,
    t0: performance.now() + 500,
    dur: RM ? 400 : 2600 + Math.min(1, d / 120) * 2600,
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
  worldMap.anim = null;
  worldMap.fT = null;
  worldMap.free = false;
  worldMap.me = LOCATION_VECTORS[a];
  worldMap.focus = LOCATION_VECTORS[a];
  worldMap.fly = { a: LOCATION_VECTORS[a], b: LOCATION_VECTORS[i] };
  worldMap.dirty = true;
  if (typeof worldMapGl !== 'undefined' && !worldMapGl.flat) worldMapGl.altT = 0.42;
  const host = $('.map-full');
  if (host && !$('#flycap')) {
    const c = document.createElement('div');
    c.id = 'flycap';
    c.className = 'fly-cap glass';
    c.innerHTML = `<small>Airship</small><b>${esc(placeFull(ROUTE[a]))} → ${esc(placeFull(ROUTE[i]))}</b><span class="note">Tap to skip</span>`;
    host.appendChild(c);
  }
  if (typeof sfx === 'function') sfx('throw');
}
/* the map loops ask this each frame while flying: where the airship is (worldMap.me follows it, so the camera does) */
function flyTick(ts) {
  if (!airshipFlight.on || !worldMap.fly) return false;
  const k = clamp((ts - airshipFlight.t0) / airshipFlight.dur, 0, 1),
    e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  worldMap.me = vector3.norm(slerp(worldMap.fly.a, worldMap.fly.b, e));
  worldMap.face = 'up';
  worldMap.dirty = true;
  airshipFlight.k = k;
  if (k >= 1) {
    flyLand();
    return false;
  }
  return true;
}
/* drawn instead of you on the map: the airship, lifted above the ground on an arc, its shadow on the land, the way behind */
function flyDraw(c, t, proj) {
  const k = airshipFlight.k || 0,
    g = worldMap.me,
    H = 0.05 * Math.sin(Math.PI * Math.min(1, k * 1.15)),
    lift = vector3.mul(g, 1 - H),
    q = proj(lift),
    qg = proj(g);
  if (!q) return;
  const trail = [];
  for (let f = 0; f <= k + 1e-6; f += 0.02) {
    const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2,
      p = vector3.norm(slerp(worldMap.fly.a, worldMap.fly.b, e)),
      h = 0.05 * Math.sin(Math.PI * Math.min(1, f * 1.15)),
      qq = proj(vector3.mul(p, 1 - h));
    if (qq) trail.push(qq);
  }
  if (trail.length > 1) {
    c.save();
    c.strokeStyle = 'rgba(255,255,255,.75)';
    c.lineWidth = 2;
    c.setLineDash([3, 6]);
    c.lineDashOffset = -t / 50;
    c.beginPath();
    trail.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
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
/* landing: the walk screen in the new town, standing by its mast */
function flyLand() {
  if (!airshipFlight.on || airshipFlight.wait) return;
  /* phase 04b: you land by the mast, which is in the town's own map file */
  if (typeof isLiteMap === 'function' && isLiteMap(sceneIdAt(airshipFlight.b))) {
    airshipFlight.wait = loadMapFile(sceneIdAt(airshipFlight.b)).then(() => {
      airshipFlight.wait = null;
      flyLand();
    });
    return;
  }
  const b = airshipFlight.b;
  airshipFlight.on = false;
  worldMap.fly = null;
  worldMap.me = LOCATION_VECTORS[b];
  worldMap.anim = null;
  document.body.classList.remove('flying');
  const cap = $('#flycap');
  if (cap) cap.remove();
  const sid = sceneIdAt(b),
    sc = typeof mapById === 'function' ? mapById(sid) : null,
    m = sc && (sc.props || []).find(p => p.act === 'fly');
  if (m && typeof walkData === 'function') {
    const C = walkData().sc,
      M = C.props[m.k] || {},
      ppu = C.ppu || 34,
      s = m.s || 1,
      f = m.f ? -1 : 1,
      bx = M.box ? M.box[0] * s : 1.2;
    uiState.roam = { id: sid, node: b, x: m.x + (bx / 2 + 0.9) * f, z: m.z - 0.9 };
  }
  uiState.tab = 'walk';
  if (typeof worldMapGl !== 'undefined') worldMapGl.altT = null;
  save();
  render();
  toast(`Welcome to ${ROUTE[b].name}.`);
  if (typeof sfx === 'function') sfx('pop');
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
    const el = ev.target.closest && ev.target.closest('[data-a="flyto"]');
    if (el) {
      ev.stopPropagation();
      ev.preventDefault();
      if (el.getAttribute('aria-disabled'))
        toast(`You need $${fmt(flyFare(saveData.route.node, +el.dataset.n))} for that ticket.`);
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
  const to = PLACE[p.to];
  if (!to) {
    toast('The lift isn’t working.');
    return;
  }
  const i = to.node,
    a = saveData.route.node,
    down = !!ROUTE[i].noFly;
  glassLift.on = true;
  const cv = document.createElement('div');
  cv.className = 'lift-veil' + (down ? ' down' : ' up');
  cv.innerHTML = `<div class="lift-cap glass"><small>Glass lift</small><b>${down ? 'Down to' : 'Up to'} ${esc(ROUTE[i].name)}</b><span class="note">${down ? 'Kelp, then dark water, then the lights of the dome.' : 'Up past the kelp, into the light.'}</span></div>`;
  document.body.appendChild(cv);
  requestAnimationFrame(() => requestAnimationFrame(() => cv.classList.add('in')));
  if (typeof sfx === 'function') sfx('throw');
  const ready =
    typeof loadMapsAhead === 'function' ? loadMapsAhead(i) : null; /* phase 04b: the lift is in the map's file */
  setTimeout(
    async () => {
      await ready;
      saveData.route = { node: i, prog: 0, plan: [], hold: false };
      saveData.visited[i] = 1;
      uiState.inside = null;
      uiState.goingIn = null;
      uiState.backAt = null;
      uiState.arrive = null;
      uiState.mapSel = null;
      const sid = sceneIdAt(i),
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
      if (typeof NWLOG !== 'undefined') NWLOG.add('scene', `lift ${ROUTE[a].id} to ${ROUTE[i].id}`);
      uiState.tab = 'walk';
      save();
      render();
    },
    RM ? 200 : 1500
  );
  setTimeout(
    () => {
      cv.classList.remove('in');
      setTimeout(() => {
        cv.remove();
        glassLift.on = false;
      }, 700);
      toast(`${ROUTE[i].name}.`);
      if (typeof sfx === 'function') sfx('pop');
    },
    RM ? 500 : 2600
  );
}
