'use strict';
/* ================= POSTCARDS (alpha 0.4) =================
   The first time you walk into a town, its postcard slides in: the town at its best hour (art/postcards/<scene>.webp,
   made by tools/build-postcards.py from the game's own renderer), "Greetings from" in a hand and the town's name in
   big letters, a stamp with the town's flag. It goes into the Guide, on its Postcards page, the moment it comes; tap it or wait and it slides away. On later visits
   a small stamp shows in the corner for a moment. S.cards keeps them: {town id: the day you got it}. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { STEST, STORY, sceneIdAt, storyFlags, toast } from './hooks.js';
import { ROUTE, TRAINERS, isTown, trainersAt } from './data.js';
import { B, S, U, esc, save } from './game-state.js';
import { artURL } from './art.js';
import { DIO, dioFlagPath, dioScene } from './walk-view.js';
import { sfx } from './sound.js';
import { TALK } from './talk.js';
import { CS } from './cutscene.js';
import { FLY } from './airship.js';
/* eslint-disable no-func-assign */
expose({
  PC: [() => PC],
  pcCards: [() => pcCards, v => (pcCards = v)],
  pcFlag: [() => pcFlag, v => (pcFlag = v)],
  pcFree: [() => pcFree, v => (pcFree = v)],
  pcHere: [() => pcHere, v => (pcHere = v)],
  pcImg: [() => pcImg, v => (pcImg = v)],
  pcTowns: [() => pcTowns, v => (pcTowns = v)],
  postcardCheck: [() => postcardCheck, v => (postcardCheck = v)],
  postcardShow: [() => postcardShow, v => (postcardShow = v)],
  postcardStamp: [() => postcardStamp, v => (postcardStamp = v)],
  renderPostcards: [() => renderPostcards, v => (renderPostcards = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const PC = { last: null, on: false };
function pcCards() {
  return S.cards || (S.cards = {});
}
function pcTowns() {
  return ROUTE.map((r, i) => i).filter(i => isTown(i) && sceneIdAt(i));
}
function pcImg(i) {
  return 'postcards/' + sceneIdAt(i) + '.webp';
}
function pcFlag(i) {
  const sc = typeof dioScene === 'function' ? dioScene(sceneIdAt(i)) : null;
  return sc && typeof dioFlagPath === 'function' ? dioFlagPath(sc) : 'scene/flags/default.png';
}
/* the town you are standing in (in the joined world, the place under your feet), or null */
function pcHere() {
  if (typeof DIO === 'undefined' || !DIO.ready || !DIO.sc || !DIO.pl) return null;
  const sc = DIO.sc,
    P = DIO.pl,
    parts = sc.parts || [{ id: DIO.id, ox: 0, oz: 0 }];
  for (const q of parts) {
    const s = dioScene(q.id);
    if (!s || s.kind === 'room') continue;
    const x = P.x - (q.ox || 0),
      z = P.z - (q.oz || 0);
    if (x >= 0 && z >= 0 && x < s.w && z < s.h) {
      const n = ROUTE.findIndex(r => r.scene === q.id);
      return n >= 0 ? n : null;
    }
  }
  return null;
}
/* every second and a half (ui.js): a new town under your feet brings its postcard, or its stamp if you have it */
/* 0.5: only once you are free to walk: never while the opening, a story scene or an unmet rival or blocker here is still to come, and only after a calm moment of walking */
function pcFree() {
  const F = typeof storyFlags === 'function' ? storyFlags() : {};
  if (TRAINERS.blake0 && !F.rival0 && !F.met_blake0) return false;
  if (typeof STORY !== 'undefined' && (STORY.pending || STORY.rivalTalk)) return false;
  if (trainersAt(S.route.node).some(T => !S.flags[T.id] && T.intro && T.intro.length && !F['met_' + T.id]))
    return false;
  if (typeof DIO !== 'undefined' && !DIO.ready) return false;
  return true;
}
export function postcardCheck() {
  if (!pcFree()) {
    PC.calm = 0;
    return;
  }
  if (
    !S.started ||
    (typeof B !== 'undefined' && B) ||
    U.modal ||
    U.title ||
    U.tab !== 'walk' ||
    U.inside ||
    U.bench ||
    PC.on ||
    (typeof TALK !== 'undefined' && TALK.on) ||
    (typeof CS !== 'undefined' && CS.on) ||
    (typeof STEST !== 'undefined' && STEST.on) ||
    (typeof FLY !== 'undefined' && FLY.on)
  ) {
    PC.calm = 0;
    return;
  }
  if (!PC.calm) {
    PC.calm = performance.now();
    return;
  }
  if (performance.now() - PC.calm < 3000) return;
  const n = pcHere();
  if (n == null || n === PC.last) return;
  PC.last = n;
  if (!isTown(n)) return;
  if (!pcCards()[ROUTE[n].id]) postcardShow(n, true);
  else postcardStamp(n);
}
function postcardShow(n, first) {
  const r = ROUTE[n];
  if (!r) return;
  if (first) {
    pcCards()[r.id] = S.day || Date.now();
    save();
    if (typeof NWLOG !== 'undefined') NWLOG.add('scene', 'postcard ' + r.id);
  }
  PC.on = true;
  const old = document.querySelector('.pcard-wrap');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'pcard-wrap' + (first ? ' first' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Postcard from ' + r.name);
  el.innerHTML = `<div class="pcard"><div class="pc-pic"><img alt="" src="${artURL(pcImg(n))}"><div class="pc-greet"><small>Greetings from</small><b>${esc(r.name)}</b></div></div>
  <div class="pc-stamp"><img alt="" src="${artURL(pcFlag(n))}"><span>${esc(r.name.replace(/ (Town|City)$/, ''))}</span></div>${first ? '<p class="pc-note">A postcard for your Guide.</p>' : ''}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
    PC.on = false;
    if (first && typeof toast === 'function') toast(`Postcard from ${r.name} kept in your Guide.`);
  };
  el.addEventListener('click', close);
  setTimeout(close, first ? 9000 : 5000);
  /* alpha 0.4: the first one too goes by itself (it is kept the moment it comes), so it never rides along on a lift or a flight */ if (
    typeof sfx === 'function'
  )
    sfx('pop');
}
/* a town you have the postcard of: its stamp in the corner for a moment */
function postcardStamp(n) {
  const r = ROUTE[n];
  const old = document.querySelector('.pc-mini');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'pc-mini';
  el.innerHTML = `<div class="pc-stamp sm"><img alt="" src="${artURL(pcFlag(n))}"></div><span>${esc(r.name)}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 500);
  }, 2600);
}
/* the Guide's Postcards page */
export function renderPostcards() {
  const T = pcTowns(),
    C = pcCards(),
    got = T.filter(i => C[ROUTE[i].id]).length;
  const cards = T.map(i => {
    const r = ROUTE[i];
    return C[r.id]
      ? `<button class="pc-thumb" data-a="pcopen" data-n="${i}"><img alt="" loading="lazy" src="${artURL(pcImg(i))}"><span>${esc(r.name)}</span></button>`
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
