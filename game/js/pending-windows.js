'use strict';
/* ================= PENDING WINDOWS ================= */
/* UI-5: the windows that wait for the world to show (a move to learn, an evolution), moved from ui.js as they were;
   RL-10: the hatch window is the ranch's now (eggs hatch there, not by walking), opened by its Hatch button */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render } from './hooks.js';
import { $, $$ } from './util.js';
import { MOVES, SPECIES } from './game-data.js';
import { graftLook } from './logic/graft-art.js';
import { speciesOf } from './logic/fighters.js';
import { allBillies, billyName, canEvolve, coatPrefix, evolve, findBilly, moveSlotCount } from './logic/rules.js';
import { activeBattle, escapeHtml, reducedMotion, save, saveData, uiState } from './game-state.js';
import { eggHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { walkView } from './walk-view.js';
import { encounterResume } from './encounter-screen.js';
import { typeBadgeHTML } from './ui-bits.js';
import { closeModal, modal, toast } from './overlay.js';
/* eslint-disable no-func-assign */
expose({
  evolutionModal: [() => evolutionModal, v => (evolutionModal = v)],
  hatchModal: [() => hatchModal, v => ((hatchModal = v), provide({ hatchModal }))],
  learnModal: [() => learnModal, v => (learnModal = v)],
  runEvolution: [() => runEvolution, v => ((runEvolution = v), provide({ runEvolution }))],
  showPendingWindows: [() => showPendingWindows, v => ((showPendingWindows = v), provide({ showPendingWindows }))],
  whenWorldShows: [() => whenWorldShows, v => (whenWorldShows = v)],
});
/* eslint-enable no-func-assign */
provide({ hatchModal, runEvolution, showPendingWindows });
/* to-module: end */
/* ---------- post-step events ---------- */
/* phase 06: runs fn once the world is on screen and the player has had a moment to see it (no loader, title or
   opening in front of it); gives up quietly after 30 s */
export function whenWorldShows(fn, settle = 1200) {
  const t0 = performance.now();
  const ready = () => {
    const ld = document.getElementById('loader');
    return (
      walkView.ready &&
      !uiState.title &&
      !document.body.classList.contains('in-cs') &&
      !(ld && !ld.hidden && ld.offsetParent !== null)
    );
  };
  const tick = () => {
    if (ready()) setTimeout(fn, settle);
    else if (performance.now() - t0 < 30000) setTimeout(tick, 250);
  };
  tick();
}
export function showPendingWindows() {
  if (activeBattle || uiState.modal || !saveData.started || uiState.title) return;
  const lq = uiState.learnQ.shift();
  if (lq) {
    const m = findBilly(lq.uid);
    if (m && !m.moves.includes(lq.mv)) {
      learnModal(m, lq.mv);
      return;
    }
    return showPendingWindows();
  }
  const m = allBillies().find(canEvolve);
  if (m) evolutionModal(m);
  /* RL-12b: an event a reload stopped in the middle opens again where it was */
  else if (typeof encounterResume === 'function') encounterResume();
}
function learnModal(m, mv) {
  const M = MOVES[mv];
  modal({
    title: `${escapeHtml(billyName(m))} wants to learn ${M.n}`,
    html: `<p>${typeBadgeHTML(M.t)} ${M.p ? `${M.p} power` : 'Status'}. ${M.d}</p><p class="note">It already knows ${moveSlotCount()} moves. Pick one to forget, or skip this one.</p>`,
    btns: m.moves
      .map(id => ({
        l: `Forget ${MOVES[id].n}`,
        f: () => {
          m.moves[m.moves.indexOf(id)] = mv;
          save();
          toast(`${billyName(m)} learned ${M.n}.`);
          closeModal();
        },
      }))
      .concat([{ l: `Don’t learn ${M.n}`, c: 'quiet', f: closeModal }]),
  });
}
function evolutionModal(m) {
  const s = speciesOf(m),
    e = s.evo;
  const why =
    {
      lvl: `It just reached level ${e.at}.`,
      idle: 'It rested in storage for a whole day.',
      streak: `${e.n} wins in a row made it stronger.`,
      split: `It just reached level ${e.at}. It can take the Build path or the Hype path: you choose.`,
    }[e.k] || '';
  modal({
    title: `${escapeHtml(billyName(m))} is evolving`,
    cls: 'evo-sheet',
    top: `<div class="evo">${rigCanvasHTML(m.sp, 128, { build: m.build, coat: m.coat, graft: graftLook(m) })}</div>`,
    html: `<p>${why} Something bigger is coming.</p>`,
    lock: 1,
    btns: [
      /* phase 08: a split line's middle stage evolves the way you pick */
      ...(e.k === 'split' && s.alt
        ? [
            {
              l: `Build: ${escapeHtml(SPECIES[/** @type {string} */ (s.next)].name)}`,
              c: 'dark',
              f: () => runEvolution(m, '', 'A'),
            },
            { l: `Hype: ${escapeHtml(SPECIES[s.alt].name)}`, c: 'dark', f: () => runEvolution(m, '', 'B') },
          ]
        : [{ l: 'Let it evolve', c: 'dark', f: () => runEvolution(m) }]),
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
export function runEvolution(m, note, path = 'A') {
  const from = speciesOf(m),
    to = SPECIES[from.evo && from.evo.k === 'split' && from.alt && path === 'B' ? from.alt : from.next],
    fromName = billyName(m);
  uiState.modal = null;
  modal({
    title: `What? ${escapeHtml(fromName)} is evolving!`,
    top: `<div class="evo run" id="evoBox"><span class="ea">${rigCanvasHTML(from.id, 128, { still: 1, coat: m.coat })}</span><span class="eb">${rigCanvasHTML(to.id, 128, { still: 1, coat: m.coat })}</span></div>`,
    html: '<p class="note">Don’t look away.</p>',
    btns: [],
    lock: 1,
    after: () => {
      const box = $('#evoBox');
      if (!box) return;
      const seq = reducedMotion ? [] : [420, 380, 330, 280, 240, 200, 170, 140, 110, 90, 70, 60, 50, 40, 40, 30];
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
        evolve(m, path);
        save();
        setTimeout(
          () => {
            uiState.modal = null;
            modal({
              title: `${escapeHtml(fromName)} became ${escapeHtml(to.name)}`,
              top: `<div class="evo done">${rigCanvasHTML(m.sp, 128, { build: m.build, coat: m.coat, graft: graftLook(m) })}</div>`,
              html: `<p>${escapeHtml(to.blurb)}</p><p>${to.types.map(typeBadgeHTML).join('')}</p>${note ? `<p class="note">${note}</p>` : ''}`,
              btns: [{ l: 'Nice', c: 'dark', f: closeModal }],
            });
          },
          reducedMotion ? 60 : 700
        );
      }, t + 300);
    },
  });
}
/** RL-10: an egg hatching at the ranch: the egg (drawn as eggs/egg_<tier>), "Hatch it" calls `hatch` (the ranch's
    breedHatch: the Billie and where it went, or null), then the Billie it was; `then` after "Welcome aboard" */
function hatchModal(tier, hatch, then) {
  modal({
    title: 'An egg is hatching',
    top: `<div class="hatch" id="hatchBox">${eggHTML(tier, 96, 'wob')}</div>`,
    html: '<p>Something is moving inside.</p>',
    lock: 1,
    btns: [
      {
        l: 'Hatch it',
        c: 'dark',
        f: () => {
          const box = $('#hatchBox');
          const res = hatch();
          if (!res) {
            closeModal();
            if (then) then();
            return;
          }
          const m = res.m,
            s = speciesOf(m),
            name = m.mut && m.mut.k === 'abom' ? billyName(m) : coatPrefix(m.coat) + s.name,
            mark = !m.mut
              ? ''
              : m.mut.k === 'abom'
                ? '<p><b>Something is very wrong with it.</b> An abomination: odd parts, its own name, one stat far up and another down.</p>'
                : '<p>It has a quirk: a parent’s move, and something odd about its size or coat.</p>';
          const done = () => {
            uiState.modal = null;
            modal({
              title: `It’s ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${escapeHtml(name)}`,
              top: `<div class="hatch done">${rigCanvasHTML(m.sp, 128, { build: m.build, coat: m.coat, graft: graftLook(m) })}</div>`,
              html: `<p>${s.types.map(typeBadgeHTML).join('')} <b class="tnum">Lv ${m.lvl}</b></p>${mark}<p>${escapeHtml(s.blurb)}</p>${res.where === 'box' ? '<p class="note">It went to storage because your team is full.</p>' : ''}`,
              btns: [
                {
                  l: 'Welcome aboard',
                  c: 'dark',
                  f: () => {
                    closeModal();
                    if (then) then();
                  },
                },
              ],
            });
            render();
          };
          if (reducedMotion || !box) {
            done();
            return;
          }
          box.innerHTML = eggHTML(tier, 96, 'shake');
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
