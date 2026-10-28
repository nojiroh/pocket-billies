'use strict';
/* ================= MAP TAB ================= */
/* UI-5: the Map tab (the bowl's header, a place's card, a run's day chip and forecast), moved from ui.js as it was; its buttons in mapTabAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { nodeActions, provide, render, tripButtons, tripDest, tripStatus } from './hooks.js';
import { $ } from './util.js';
import { LOCATIONS, POOLS, RESIDENTS, ROADS_BY_NODE, RULES, gameData, locationSubtitle } from './game-data.js';
import { canEnter, canRide, distanceText, gateText, riderName, setTrip, stopTrip, tripTo } from './logic/rules.js';
import { runForecastDays } from './logic/run-map.js';
import { escapeHtml, saveData, uiState } from './game-state.js';
import { uiIconHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { WEATHER_NAMES } from './environment.js';
import {
  worldBowlRunMark,
  worldMapHeight,
  worldMapReset,
  worldMapSelect,
  worldMapWidth,
  worldMapZoom,
} from './world-bowl.js';
import { runHint } from './run.js';
import { questListHTML } from './quest-board.js';
import { toast } from './overlay.js';
/* eslint-disable no-func-assign */
expose({
  mapTabAction: [() => mapTabAction, v => (mapTabAction = v)],
  paintWorldMapCard: [() => paintWorldMapCard, v => ((paintWorldMapCard = v), provide({ paintWorldMapCard }))],
  poolStrip: [() => poolStrip, v => (poolStrip = v)],
  renderWorldMapTab: [() => renderWorldMapTab, v => (renderWorldMapTab = v)],
  runForecastHTML: [() => runForecastHTML, v => (runForecastHTML = v)],
  runRumourHTML: [() => runRumourHTML, v => (runRumourHTML = v)],
  runZoneHTML: [() => runZoneHTML, v => (runZoneHTML = v)],
  worldMapCardHTML: [() => worldMapCardHTML, v => (worldMapCardHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ paintWorldMapCard });
/* to-module: end */
export function renderWorldMapTab() {
  if (saveData.run) runHint('map');
  /* RL-7: on a run, its day (ui-run-kit.js pb-day-chip; RL-R2: no deadline) */
  const run = saveData.run && saveData.run.map ? saveData.run : null,
    M = saveData.meta,
    /* RL-8: on a run, the way to give it up; in the hub, once a run has ended, what the runs brought home */
    day = run
      ? `<pb-day-chip class="map-day" day="${run.clock}"></pb-day-chip><button class="pb small quiet" data-a="rungiveup">Give up the run</button>`
      : M && M.runs
        ? `<p class="map-meta"><pb-coin kind="research" value="${M.research}" label="Research"></pb-coin>${M.scrap ? ` <pb-coin kind="scrap" value="${M.scrap}" label="Scrap"></pb-coin>` : ''}${M.crests ? ` <pb-coin kind="crests" value="${M.crests}" label="Crests"></pb-coin>` : ''}${M.dna ? ` <pb-coin kind="dna" value="${M.dna}" label="DNA"></pb-coin>` : ''}</p>`
        : '';
  return `<div class="map-full"><canvas id="mapcv" width="${worldMapWidth}" height="${worldMapHeight}" aria-label="World map. Drag to look around, tap a place."></canvas><div id="maplabels"></div>
 <div class="map-head glass k-panel">${run && run.region ? `<div class="sub">World map</div><h1 class="where">${escapeHtml(run.region.name)}</h1>` : '<div class="sub">The Hollow Earth</div><h1 class="where">World map</h1>'}${day}<p class="map-trip ${tripStatus().k}">${escapeHtml(tripStatus().t)}</p>${run ? questListHTML() : ''}</div>
 <div class="mapctl"><button class="mbtn" data-a="mzoom" data-k="in" aria-label="Zoom in">+</button><button class="mbtn" data-a="mzoom" data-k="out" aria-label="Zoom out">−</button><button class="mbtn" data-a="mreset" aria-label="Back to you">${uiIconHTML('walk', 16)}</button></div>
 <div class="mapcard px glass k-panel" id="mapcard">${worldMapCardHTML()}</div></div>`;
}
function poolStrip(pool) {
  const P = POOLS[pool];
  if (!P) return '';
  return `<div class="poolstrip">${P.list.map(([id]) => (saveData.seen[id] ? rigCanvasHTML(id, 36) : rigCanvasHTML(id, 36, { sil: 1, still: 1 }))).join('')}</div>`;
}
/* RL-7: a run's place's weather for a week from today (its forecast; ui-run-kit.js pb-forecast), today marked; PK-4:
   for as many days as the run shows (rules.json run.clock.ahead and Barometer's days: run-map.js runForecastDays) */
function runForecastHTML(node) {
  const run = saveData.run,
    n = run ? runForecastDays(run, gameData.biomes, RULES.run.clock.ahead) : 0,
    days = ((run && run.forecast[node]) || []).slice(run.clock - 1, run.clock - 1 + n);
  return days.length
    ? `<pb-forecast class="mc-fc" label="Forecast" items="${escapeHtml(days.map(w => `${w}:${WEATHER_NAMES[w] || w}`).join(','))}" from="${run.clock}" value="${run.clock}"></pb-forecast>`
    : '';
}
/** RL-R1: a run place's zone in its region ("Zone 2 of 3 · Lakeside"), or nothing */
function runZoneHTML(n) {
  const run = saveData.run,
    node = run && run.region && run.map && n && n.runNode !== undefined ? run.map.nodes[n.runNode] : null;
  if (!node || node.zone === undefined) return '';
  const Z = run.region.zones[node.zone],
    B = (gameData.biomes || {})[Z ? Z.biome : ''];
  return `<p class="note">Zone ${node.zone + 1} of ${run.region.zones.length}${B ? ` · ${escapeHtml(B.name)}` : ''}</p>`;
}
/** RS-4: what a resident's rumour says about a run place (Bertha's service: logic/residents.js resRumour) */
function runRumourHTML(n) {
  const run = saveData.run,
    R = run && run.rumour,
    i = n && n.runNode;
  if (!R || i === undefined || (R.node !== i && R.side !== i)) return '';
  const who = (RESIDENTS[R.who] || { name: 'Someone' }).name.split(' ')[0];
  return `<p class="note">${uiIconHTML('spark', 12)} ${escapeHtml(R.side === i ? `${who} heard a side path starts here.` : `${who} heard about this place.`)}</p>`;
}
function worldMapCardHTML() {
  const sel = uiState.mapSel == null ? saveData.trip.node : uiState.mapSel;
  /* RL-7: a run's place the map shows only as a '?' */
  const rm = typeof sel === 'number' ? worldBowlRunMark(sel) : null;
  if (rm && rm.seen < 2)
    return `<div class="mc-top"><h2>Further on</h2><span class="sub">On the run</span></div><p class="note">Come closer to see what waits here.</p>`;
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
    status = `${st.t}. ${distanceText((tripTo(sel) || { metres: 0 }).metres)} to go.`;
    btns = tripButtons();
  } else {
    const t = tripTo(sel),
      locked = !canEnter(sel);
    if (locked) status = 'Locked. ' + gateText(n);
    else if (!t) status = 'You can’t get there from here yet.';
    else {
      status = `${distanceText(t.metres)} on foot${
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
  /* RL-7: a road to a run's '?' place doesn't name it */
  const nb = ROADS_BY_NODE[sel].map(e => {
    const to = worldBowlRunMark(e.to);
    return to && to.seen < 2 ? 'somewhere further on' : LOCATIONS[e.to].name;
  });
  return `<div class="mc-top"><h2>${escapeHtml(n.name)}</h2><span class="sub">${escapeHtml(locationSubtitle(n))}</span></div>${runZoneHTML(n)}${runRumourHTML(n)}<p class="note">${escapeHtml(n.blurb || '')}</p>${n.ride && canRide() ? `<p class="note ride">${uiIconHTML('drop', 14)} You ride across on ${escapeHtml(riderName())}.</p>` : ''}<p class="status">${status}</p>${btns ? `<div class="racts">${btns}</div>` : ''}${rm ? runForecastHTML(sel) : ''}${poolStrip(n.pool)}${nb.length ? `<p class="note mc-nb">Roads to ${nb.map(escapeHtml).join(', ')}.</p>` : ''}${nodeActions(sel)}`;
}
function paintWorldMapCard() {
  const c = $('#mapcard');
  if (c) c.innerHTML = worldMapCardHTML();
}
/* the Map tab's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function mapTabAction(a, d) {
  switch (a) {
    case 'msel':
      worldMapSelect(+d.n);
      break;
    case 'travel': {
      const j = +d.n;
      if (setTrip(j)) {
        toast(`Follow the gold arrows to ${LOCATIONS[j].name}.`);
        render();
      } else toast('There’s no open road there yet.');
      break;
    }
    case 'stoptrip':
      stopTrip();
      toast(`You’re staying in ${LOCATIONS[saveData.trip.node].name}.`);
      render();
      break;
    case 'mzoom':
      worldMapZoom(d.k === 'in' ? 0.8 : 1.25);
      break;
    case 'mreset':
      worldMapReset();
      break;
  }
}
