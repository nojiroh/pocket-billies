'use strict';
/* ================= UI ================= */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide } from './hooks.js';
import { $, $$ } from './util.js';
import { EGGS, LOCATIONS, RULES, START_NODE, TRAINERS } from './game-data.js';
import { speciesOf } from './logic/fighters.js';
import { addEgg, eggKm, formatNumber, makeBilly, spawn } from './logic/rules.js';
import { pbFloat, pbInboxDot, pbInboxPop } from './ui-kit.js';
import { newSaveKeepingPreferences } from './logic/saves.js';
import {
  activeBattle,
  escapeHtml,
  flushSave,
  reducedMotion,
  save,
  saveData,
  setSaveData,
  uiState,
} from './game-state.js';
import { coinHTML, uiIconHTML } from './art.js';
import { LOOK_PRESETS, cleanLook, portraitHTML } from './person-art.js';
import { openSettings } from './settings-screen.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { EASE } from './battle-stage.js';
import { fishStart } from './fishing.js';
import { battleResize, battleShell, tapMessage } from './battle.js';
import { worldMapAction, worldMapFit, worldMapMount, worldMapOpenFromWalk } from './world-bowl.js';
import { cutscene } from './cutscene/director.js';
import { cutsceneStart, cutsceneWanted } from './cutscene/opening.js';
import { renderTitle, titleMount } from './title.js';
import { renderBag } from './bag.js';
import { storyRivalBattle } from './story.js';
import { workshopAction } from './workshop.js';
import { closeModal, modal, openInbox } from './overlay.js';
import { renderProfile } from './profile.js';
import { guideAction, renderGuide } from './guide.js';
import { renderTeam, teamAction } from './team.js';
import { billieSheetAction } from './billie-sheet.js';
import { mapTabAction, renderWorldMapTab } from './map-tab.js';
import { renderWalk, walkTabAction } from './walk-tab.js';
import { leaveRoom, roomState, walkMapSync } from './walk-control.js';
import { battleAction } from './battle-input.js';
/* eslint-disable no-func-assign */
expose({
  SCREENS: [() => SCREENS],
  TABS: [() => TABS],
  openTab: [() => openTab, v => (openTab = v)],
  render: [() => render, v => setRender(v)],
  renderIntro: [() => renderIntro, v => (renderIntro = v)],
  startGame: [() => startGame, v => ((startGame = v), provide({ startGame }))],
  topbar: [() => topbar, v => (topbar = v)],
  updateNav: [() => updateNav, v => ((updateNav = v), provide({ updateNav }))],
});
/* eslint-enable no-func-assign */
provide({ render, startGame, updateNav });
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
/* a tab of the bottom bar, or a button that leads to one (data-a="tab") */
function openTab(t) {
  /* phase 10: from a walk scene the walk camera rises first, then the bowl pulls back (world-bowl.js) */
  if (t === 'map' && uiState.tab === 'walk' && typeof worldMapOpenFromWalk === 'function' && worldMapOpenFromWalk())
    return;
  if (uiState.tab !== t) {
    if (t === 'map') uiState.mglFrom = uiState.tab;
    uiState.tab = t;
    if (t !== 'map') uiState.mapSel = null;
    render();
    scrollTo(0, 0);
  } else if (t === 'ledger' && uiState.dex) {
    uiState.dex = null;
    render();
    scrollTo(0, 0);
  }
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
      openTab(d.t);
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
    case 'bfight':
    case 'bmove':
    case 'btarget':
    case 'bpart':
    case 'bcoins':
    case 'bitems':
    case 'bteam':
    case 'brun':
    case 'bback':
    case 'bcoin':
    case 'baimback':
    case 'bthrow':
    case 'bitem':
    case 'bitemon':
    case 'bswitch':
    case 'boffer':
    case 'bend':
      battleAction(a, d);
      break;
    case 'wsopen':
    case 'wsslot':
    case 'wsfit':
    case 'wsup':
    case 'wsbuild':
      workshopAction(a, d);
      break;
  }
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
