'use strict';
/* ================= MAP TAB ================= */
/* UI-5: the Map tab (the bowl's header, a place's card, a run's day chip and forecast), moved from ui.js as it was; its buttons in mapTabAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { nodeActions, provide, render, tripButtons, tripDest, tripStatus } from './hooks.js';
import { $ } from './util.js';
import {
  LOCATIONS,
  NODE_TYPES,
  POOLS,
  RESIDENTS,
  ROADS_BY_NODE,
  SHOPS,
  gameData,
  locationSubtitle,
  trainersAt,
} from './game-data.js';
import { canEnter, canRide, distanceText, gateText, riderName, setTrip, stopTrip, tripTo } from './logic/rules.js';
import { RUN_WEATHER_ICONS } from './ui-run-kit.js';
import { kindChipHTML } from './ui-marks-kit.js';
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
  placeHasHTML: [() => placeHasHTML, v => (placeHasHTML = v)],
  poolStrip: [() => poolStrip, v => (poolStrip = v)],
  renderWorldMapTab: [() => renderWorldMapTab, v => (renderWorldMapTab = v)],
  runForecastHTML: [() => runForecastHTML, v => (runForecastHTML = v)],
  runRumourHTML: [() => runRumourHTML, v => (runRumourHTML = v)],
  runTodayHTML: [() => runTodayHTML, v => (runTodayHTML = v)],
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
    /* RL-8: on a run, the way to give it up (UI-18: in the header's ⋯ menu, a red button only once it is opened); in
       the hub, once a run has ended, what the runs brought home */
    day = run
      ? `<div class="map-hrow"><pb-day-chip class="map-day" day="${run.clock}"></pb-day-chip><details class="map-more"><summary class="mbtn k-btn" aria-label="More" title="More">${uiIconHTML('more', 24)}</summary><div class="map-more-menu"><button class="pb small red" data-a="rungiveup">Give up the run</button></div></details></div>`
      : M && M.runs
        ? `<p class="map-meta"><pb-chip kind="research" value="${M.research}" label="Research"></pb-chip>${M.scrap ? ` <pb-chip kind="scrap" value="${M.scrap}" label="Scrap"></pb-chip>` : ''}${M.crests ? ` <pb-chip kind="crests" value="${M.crests}" label="Crests"></pb-chip>` : ''}${M.dna ? ` <pb-chip kind="dna" value="${M.dna}" label="DNA"></pb-chip>` : ''}</p>`
        : '';
  return `<div class="map-full"><canvas id="mapcv" width="${worldMapWidth}" height="${worldMapHeight}" aria-label="World map. Drag to look around, tap a place."></canvas><div id="maplabels"></div>
 <div class="map-head k-panel">${run && run.region ? `<div class="sub">World map</div><h1 class="where">${escapeHtml(run.region.name)}</h1>` : '<div class="sub">The Hollow Earth</div><h1 class="where">World map</h1>'}${day}<p class="map-trip ${tripStatus().k}">${escapeHtml(tripStatus().t)}</p>${run ? questListHTML() : ''}</div>
 <div class="mapctl"><button class="mbtn k-btn" data-a="mzoom" data-k="in" aria-label="Zoom in" title="Zoom in">${uiIconHTML('plus', 24)}</button><button class="mbtn k-btn" data-a="mzoom" data-k="out" aria-label="Zoom out" title="Zoom out">${uiIconHTML('minus', 24)}</button><button class="mbtn k-btn" data-a="mreset" aria-label="Back to you" title="Back to you">${uiIconHTML('walk', 24)}</button></div>
 <div class="mapcard k-panel" id="mapcard">${worldMapCardHTML()}</div></div>`;
}
function poolStrip(pool) {
  const P = POOLS[pool];
  if (!P) return '';
  return `<div class="poolstrip">${P.list.map(([id]) => (saveData.seen[id] ? rigCanvasHTML(id, 36) : rigCanvasHTML(id, 36, { sil: 1, still: 1 }))).join('')}</div>`;
}
/* RL-7: a run's place's weather for a week from today (its forecast; ui-run-kit.js pb-forecast), today marked */
function runForecastHTML(node) {
  const run = saveData.run,
    days = ((run && run.forecast[node]) || []).slice(run.clock - 1, run.clock + 6);
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
  /* UI-14b: a run place's kind as its chip: UI-8c's place icon in its family's tint (logic/marks.js chipLook) */
  const kindChip =
    rm && NODE_TYPES[rm.type] ? kindChipHTML(rm.type, NODE_TYPES[rm.type].name || locationSubtitle(n)) : '';
  /* UI-18: the card opens folded: the name, today's weather and what's there, the status and the main action; More
     unfolds the rest (the place's words, its zone and rumour, the week's forecast, its Billies, roads and services) */
  const open = uiState.mapCardOpen === sel,
    more = `${runZoneHTML(n)}${runRumourHTML(n)}<p class="note">${escapeHtml(n.blurb || '')}</p>${n.ride && canRide() ? `<p class="note ride">${uiIconHTML('drop', 14)} You ride across on ${escapeHtml(riderName())}.</p>` : ''}${rm ? runForecastHTML(sel) : ''}${poolStrip(n.pool)}${nb.length ? `<p class="note mc-nb">Roads to ${nb.map(escapeHtml).join(', ')}.</p>` : ''}${nodeActions(sel)}`;
  return `<div class="mc-top"><h2>${escapeHtml(n.name)}</h2>${rm ? runTodayHTML(sel) : ''}${kindChip || `<span class="sub">${escapeHtml(locationSubtitle(n))}</span>`}</div>${placeHasHTML(sel)}<p class="status">${status}</p>${btns ? `<div class="racts">${btns}</div>` : ''}${open ? `<div class="mc-more">${more}</div>` : ''}<button class="mc-fold" data-a="mcfold" aria-expanded="${open}">${open ? 'Less' : 'More'}</button>`;
}
/** UI-18: a run place's weather today (its forecast's first day), glyph and word, for the folded card */
function runTodayHTML(node) {
  const run = saveData.run,
    w = run && run.forecast && (run.forecast[node] || [])[run.clock - 1];
  return w
    ? `<span class="mc-wx"><span class="wx-now">${uiIconHTML(/** @type {any} */ (RUN_WEATHER_ICONS)[w] || 'cloud', 14)}</span>${escapeHtml(WEATHER_NAMES[w] || w)}</span>`
    : '';
}
/** UI-18: what's at a place, one line for the folded card: its shops, a clinic in a town, its trainers and how many
 * kinds of Billie live there; nothing when it has none */
function placeHasHTML(i) {
  const n = LOCATIONS[i],
    has = [n.shop, n.boutique].filter(k => k && SHOPS[k]).map(k => SHOPS[k].name);
  if (n.town) has.push('a clinic');
  const T = trainersAt(i).length,
    P = POOLS[n.pool];
  if (T) has.push(T === 1 ? 'a trainer' : `${T} trainers`);
  if (P && P.list.length) has.push(P.list.length === 1 ? 'one kind of Billie' : `${P.list.length} kinds of Billie`);
  return has.length ? `<p class="note mc-has">${escapeHtml(has.join(' · '))}</p>` : '';
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
    case 'mcfold': {
      const sel = uiState.mapSel == null ? saveData.trip.node : uiState.mapSel;
      uiState.mapCardOpen = uiState.mapCardOpen === sel ? null : sel;
      paintWorldMapCard();
      break;
    }
    case 'mzoom':
      worldMapZoom(d.k === 'in' ? 0.8 : 1.25);
      break;
    case 'mreset':
      worldMapReset();
      break;
  }
}
