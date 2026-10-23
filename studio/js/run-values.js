'use strict';
/* ================= WHAT A RUN MAKES OF IT (Studio plan Phase 4, T4.3; plan finding A5) =================
   Data a run reads differently from the old world, shown where it is edited so a designer doesn't change a number
   believing it changes runs:
   - Trainers: for a mini-boss leader (`miniboss`, its box is in "Who and where"; a run's mini-bosses and boss are
     drawn from these) what a run gives it instead of its own reward and levels: run-loop.js runFoes on each mini-boss row and
     the boss's row (logic/content-preview.js leaderRunValues, in the logic worker), labelled "overridden in runs";
   - World & encounters: a pool a run reads (a biome names it, biomes.json pool) and one only the old world reads; a
     legacy species id (its line is in game/data/legacy) with the species the game stands in for it
     (content-preview.js speciesStandIns: game-data.js standInSpecies). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { lineSpeciesIds } from '../../game/js/logic/forms.js';
import { escapeHtml } from './game-stand-ins.js';
import { afterRender, card, speciesName, studioState } from './studio-app.js';
import { logicAsk } from './logic-client.js';
/* eslint-disable no-func-assign */
expose({
  poolRunTag: [() => poolRunTag, v => ((poolRunTag = v), provide({ poolRunTag }))],
  runLeaderHTML: [() => runLeaderHTML, v => (runLeaderHTML = v)],
  runValues: [() => runValues],
  runValuesFill: [() => runValuesFill, v => ((runValuesFill = v), provide({ runValuesFill }))],
  standInMark: [() => standInMark],
  trainerRunHTML: [() => trainerRunHTML, v => ((trainerRunHTML = v), provide({ trainerRunHTML }))],
});
/* eslint-enable no-func-assign */
provide({ poolRunTag, runValuesFill, trainerRunHTML });
/* to-module: end */
const runValues = { n: 0 };

/** the Trainers section's run part for a mini-boss leader: its run values ('' for any other trainer) */
function trainerRunHTML(/** @type {string} */ k, /** @type {any} */ T) {
  if (!T.miniboss) return '';
  afterRender(runValuesFill);
  return card(
    'In runs <span class="run-tag legacy">overridden in runs</span>',
    `<div class="run-over"><p class="help">A run doesn’t use this leader’s reward or team levels: it pays the run’s reward for the place (rules.json <code>run.foes</code>, in the Run Lab’s rules) and sets the team’s levels from the place’s row, keeping the gaps between them. The boss brings only its strongest Billie. Edit those in the <button class="linkish" data-act="go" data-s="runlab">Run Lab</button>; the Mini-boss box under “Who and where” puts a leader in or out of the runs’ pool.</p><div data-run-leader="${escapeHtml(k)}"><p class="help">The game’s logic is working it out…</p></div></div>`
  );
}
/** a pool's tag: the biomes whose run places read it, or legacy */
function poolRunTag(/** @type {string} */ k) {
  const B = studioState.D.biomes || {},
    by = Object.keys(B).filter(b => B[b].pool === k);
  return by.length
    ? `<span class="run-tag" data-pool-run="${escapeHtml(by.join(','))}">a run reads this: ${escapeHtml(by.map(b => B[b].name || b).join(', '))}</span>`
    : '<span class="run-tag legacy" data-pool-run="">legacy: no biome names it</span>';
}
/** the mark beside a species id the data lists but the game doesn't have (filled with its stand-in); RO-1: a regional
 * form's id is the game's (logic/forms.js) */
const standInMark = (/** @type {string} */ id) =>
  studioState.D.lines.some((/** @type {any} */ L) => lineSpeciesIds(L).includes(id))
    ? ''
    : `<small class="warn" data-standin="${escapeHtml(id)}">legacy ${escapeHtml(id)}</small>`;
provide({ standInMark }); /* to-module */

/** fill the leader tables and the stand-ins on the page from the logic worker */
function runValuesFill() {
  const n = ++runValues.n,
    leaders = [...document.querySelectorAll('[data-run-leader]')],
    marks = [...document.querySelectorAll('[data-standin]')];
  if (leaders.length)
    logicAsk(
      'leaderRunValues',
      leaders.map(el => /** @type {HTMLElement} */ (el).dataset.runLeader)
    ).then(
      V => {
        if (n !== runValues.n) return;
        for (const el of leaders) {
          const E = /** @type {HTMLElement} */ (el),
            rows = V[E.dataset.runLeader || ''];
          E.innerHTML = rows
            ? runLeaderHTML(rows)
            : '<p class="help">Not a mini-boss leader in the data the game reads.</p>';
          E.dataset.ready = '1';
        }
      },
      e =>
        leaders.forEach(el => (el.innerHTML = `<p class="err">The game’s logic stopped: ${escapeHtml(e.message)}</p>`))
    );
  if (marks.length)
    logicAsk(
      'speciesStandIns',
      marks.map(el => /** @type {HTMLElement} */ (el).dataset.standin)
    ).then(S => {
      if (n !== runValues.n) return;
      for (const el of marks) {
        const E = /** @type {HTMLElement} */ (el),
          s = S[E.dataset.standin || ''];
        E.textContent = s
          ? `legacy ${E.dataset.standin}: the game uses ${s.name}`
          : `legacy ${E.dataset.standin}: no stand-in`;
        E.dataset.to = s ? s.to : '';
      }
    });
}
/** a leader's run values as a table */
function runLeaderHTML(/** @type {any[]} */ rows) {
  const D = studioState.D,
    kind = (/** @type {string} */ k) => escapeHtml((D.nodeTypes[k] || {}).name || k);
  return `<table class="tbl run-leader"><thead><tr><th>Place</th><th>Row</th><th>Reward</th><th>Levels</th><th>Team</th></tr></thead><tbody>${rows
    .map(
      r =>
        `<tr data-kind="${r.kind}" data-row="${r.row}" data-reward="${r.reward}" data-levels="${r.levels.join('-')}"><td>${kind(r.kind)}</td><td>${r.row + 1}</td><td>${r.reward} Moneys</td><td>${r.levels[0] === r.levels[1] ? r.levels[0] : r.levels.join('–')}</td><td>${r.team
          .map((/** @type {any} */ e) => `${escapeHtml(speciesName(e.sp))} ${e.lvl}`)
          .join(', ')}</td></tr>`
    )
    .join('')}</tbody></table>`;
}
