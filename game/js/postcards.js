'use strict';
/* ================= POSTCARDS (alpha 0.4) =================
   The first time you walk into a town, its postcard slides in: the town at its best hour (art/postcards/<scene>.webp,
   made by tools/build-postcards.py from the game's own renderer), "Greetings from" in a hand and the town's name in
   big letters, a stamp with the town's flag. It goes into the Guide, on its Postcards page, the moment it comes; tap it or wait and it slides away. On later visits
   a small stamp shows in the corner for a moment. saveData.cards keeps them: {town id: the day you got it}. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { mapIdAt, selfTest, storyFlags, storyState, toast } from './hooks.js';
import { LOCATIONS, TRAINERS, isTown, trainersAt } from './game-data.js';
import { activeBattle, escapeHtml, save, saveData, uiState } from './game-state.js';
import { artURL } from './art.js';
import { flagPicturePath, mapById, walkView } from './walk-view.js';
import { soundEffect } from './sound.js';
import { talkBox } from './talk.js';
import { cutscene } from './cutscene/director.js';
import { airshipFlight } from './airship.js';
/* eslint-disable no-func-assign */
expose({
  postcardAllowed: [() => postcardAllowed, v => (postcardAllowed = v)],
  postcardCheck: [() => postcardCheck, v => (postcardCheck = v)],
  postcardFlag: [() => postcardFlag, v => (postcardFlag = v)],
  postcardImage: [() => postcardImage, v => (postcardImage = v)],
  postcardShow: [() => postcardShow, v => (postcardShow = v)],
  postcardStamp: [() => postcardStamp, v => (postcardStamp = v)],
  postcardState: [() => postcardState],
  postcardTownHere: [() => postcardTownHere, v => (postcardTownHere = v)],
  postcardTowns: [() => postcardTowns, v => (postcardTowns = v)],
  postcardsOwned: [() => postcardsOwned, v => (postcardsOwned = v)],
  renderPostcards: [() => renderPostcards, v => (renderPostcards = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const postcardState = { last: null, on: false };
function postcardsOwned() {
  return saveData.cards || (saveData.cards = {});
}
/* RL-7: the hub's towns: a run's have no postcard picture (their scenes are made from the run's seed) */
function postcardTowns() {
  return LOCATIONS.map((r, i) => i).filter(i => isTown(i) && mapIdAt(i) && LOCATIONS[i].runNode == null);
}
function postcardImage(i) {
  return 'postcards/' + mapIdAt(i) + '.webp';
}
function postcardFlag(i) {
  const sc = typeof mapById === 'function' ? mapById(mapIdAt(i)) : null;
  return sc && typeof flagPicturePath === 'function' ? flagPicturePath(sc) : 'scene/flags/default.png';
}
/* the town you are standing in (in the joined world, the place under your feet), or null */
function postcardTownHere() {
  if (typeof walkView === 'undefined' || !walkView.ready || !walkView.sc || !walkView.pl) return null;
  const sc = walkView.sc,
    P = walkView.pl,
    parts = sc.parts || [{ id: walkView.id, ox: 0, oz: 0 }];
  for (const q of parts) {
    const s = mapById(q.id);
    if (!s || s.kind === 'room') continue;
    const x = P.x - (q.ox || 0),
      z = P.z - (q.oz || 0);
    if (x >= 0 && z >= 0 && x < s.w && z < s.h) {
      const n = LOCATIONS.findIndex(r => r.mapId === q.id);
      return n >= 0 ? n : null;
    }
  }
  return null;
}
/* every second and a half (ui.js): a new town under your feet brings its postcard, or its stamp if you have it */
/* 0.5: only once you are free to walk: never while the opening, a story scene or an unmet rival or blocker here is still to come, and only after a calm moment of walking */
function postcardAllowed() {
  const F = typeof storyFlags === 'function' ? storyFlags() : {};
  if (TRAINERS.blake0 && !F.rival0 && !F.met_blake0) return false;
  if (typeof storyState !== 'undefined' && (storyState.pending || storyState.rivalTalk)) return false;
  if (trainersAt(saveData.trip.node).some(T => !saveData.flags[T.id] && T.runsUp && !F['met_' + T.id])) return false;
  if (typeof walkView !== 'undefined' && !walkView.ready) return false;
  return true;
}
export function postcardCheck() {
  if (!postcardAllowed()) {
    postcardState.calm = 0;
    return;
  }
  if (
    !saveData.started ||
    /* RL-7: a run's towns have no postcard */
    saveData.run ||
    (typeof activeBattle !== 'undefined' && activeBattle) ||
    uiState.modal ||
    uiState.title ||
    uiState.tab !== 'walk' ||
    uiState.inside ||
    uiState.bench ||
    postcardState.on ||
    (typeof talkBox !== 'undefined' && talkBox.on) ||
    (typeof cutscene !== 'undefined' && cutscene.on) ||
    (typeof selfTest !== 'undefined' && selfTest.on) ||
    (typeof airshipFlight !== 'undefined' && airshipFlight.on)
  ) {
    postcardState.calm = 0;
    return;
  }
  if (!postcardState.calm) {
    postcardState.calm = performance.now();
    return;
  }
  if (performance.now() - postcardState.calm < 3000) return;
  const n = postcardTownHere();
  if (n == null || n === postcardState.last) return;
  postcardState.last = n;
  if (!isTown(n)) return;
  if (!postcardsOwned()[LOCATIONS[n].id]) postcardShow(n, true);
  else postcardStamp(n);
}
function postcardShow(n, first) {
  const r = LOCATIONS[n];
  if (!r) return;
  if (first) {
    postcardsOwned()[r.id] = Date.now();
    save();
    if (typeof debugLog !== 'undefined') debugLog.add('scene', 'postcard ' + r.id);
  }
  postcardState.on = true;
  const old = document.querySelector('.pcard-wrap');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'pcard-wrap' + (first ? ' first' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Postcard from ' + r.name);
  el.innerHTML = `<div class="pcard"><div class="pc-pic"><img alt="" src="${artURL(postcardImage(n))}"><div class="pc-greet"><small>Greetings from</small><b>${escapeHtml(r.name)}</b></div></div>
  <div class="pc-stamp"><img alt="" src="${artURL(postcardFlag(n))}"><span>${escapeHtml(r.name.replace(/ (Town|City)$/, ''))}</span></div>${first ? '<p class="pc-note">A postcard for your Guide.</p>' : ''}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
    postcardState.on = false;
    if (first && typeof toast === 'function') toast(`Postcard from ${r.name} kept in your Guide.`);
  };
  el.addEventListener('click', close);
  setTimeout(close, first ? 9000 : 5000);
  /* alpha 0.4: the first one too goes by itself (it is kept the moment it comes), so it never rides along on a lift or a flight */ if (
    typeof soundEffect === 'function'
  )
    soundEffect('pop');
}
/* a town you have the postcard of: its stamp in the corner for a moment */
function postcardStamp(n) {
  const r = LOCATIONS[n];
  const old = document.querySelector('.pc-mini');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'pc-mini';
  el.innerHTML = `<div class="pc-stamp sm"><img alt="" src="${artURL(postcardFlag(n))}"></div><span>${escapeHtml(r.name)}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 500);
  }, 2600);
}
/* the Guide's Postcards page */
export function renderPostcards() {
  const T = postcardTowns(),
    C = postcardsOwned(),
    got = T.filter(i => C[LOCATIONS[i].id]).length;
  const cards = T.map(i => {
    const r = LOCATIONS[i];
    return C[r.id]
      ? `<button class="pc-thumb" data-a="pcopen" data-n="${i}"><img alt="" loading="lazy" src="${artURL(postcardImage(i))}"><span>${escapeHtml(r.name)}</span></button>`
      : `<div class="pc-thumb none"><i>?</i><span>Not been yet</span></div>`;
  }).join('');
  return `<p class="note pc-count">${got} of ${T.length} postcards. Every town you walk into sends you one.</p><div class="pc-grid">${cards}</div>`;
}
document.addEventListener(
  'click',
  ev => {
    const el = ev.target.closest && ev.target.closest('[data-a="pcopen"]');
    if (!el) return;
    ev.stopPropagation();
    ev.preventDefault();
    postcardShow(+el.dataset.n, false);
  },
  true
);
