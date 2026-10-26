'use strict';
/* ================= RUN LAB: SIMULATE (Studio plan T3.4) =================
   The run simulation (game/js/logic/run-sim.js, balance mode) over a fixed seed list, on the data as the Studio
   loaded it (Base) and as it is now (Draft), in two logic workers (logic-client.js logicAskBase, logicAsk). Both play
   the same seeds with the same bot policy and options, so every difference is paired, seed by seed
   (logic/sim-compare.js simCompareReports, the same JSON as the CLI's --compare).
   - Seeds: SIM0..SIM(n-1), at most 200 here (SIM_BROWSER_CAP; the CLI runs more).
   - Policy: the simulator's named policies (SIM_POLICIES): greedy-forward, never-pick (the "never pick" baseline).
   - Party: who waits at home and what is packed; unlocks: none (a fresh save) or every one.
   Every table carries the policy's banner ("Bot policy X: a lower bound on a careful player, not a prediction"), and
   the rows the policy mostly decides are marked policy-driven. Each side shows its data's hash; a re-run on the same
   data gives the same numbers. "Export JSON" saves the compare. Read-only: nothing here changes the data. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { escapeHtml } from './game-stand-ins.js';
import { SIM_POLICIES } from '../../game/js/logic/run-sim.js';
import { SIM_BROWSER_CAP, simBanner, simCompareReports, simSeeds } from '../../game/js/logic/sim-compare.js';
import { ACTIONS } from './studio-app.js';
import { logicAsk, logicAskBase } from './logic-client.js';
/* eslint-disable no-func-assign */
expose({
  RUN_LAB_SIM_PARTY: [() => RUN_LAB_SIM_PARTY],
  RUN_LAB_SIM_ROWS: [() => RUN_LAB_SIM_ROWS],
  runLabSim: [() => runLabSim],
  runLabSimCount: [() => runLabSimCount],
  runLabSimCounts: [() => runLabSimCounts, v => (runLabSimCounts = v)],
  runLabSimDiff: [() => runLabSimDiff, v => (runLabSimDiff = v)],
  runLabSimHTML: [() => runLabSimHTML, v => (runLabSimHTML = v)],
  runLabSimNum: [() => runLabSimNum],
  runLabSimOptions: [() => runLabSimOptions],
  runLabSimRedraw: [() => runLabSimRedraw, v => (runLabSimRedraw = v)],
  runLabSimResultHTML: [() => runLabSimResultHTML, v => (runLabSimResultHTML = v)],
  runLabSimTable: [() => runLabSimTable],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const runLabSim = {
  n: 200,
  policy: 'greedy-forward',
  /** @type {'one' | 'three' | 'packed'} */
  party: 'one',
  /** @type {'none' | 'all'} */
  unlocks: 'none',
  busy: false,
  /** the latest ask (an older answer is dropped) */
  k: 0,
  /** the last compare and how long it took @type {any} */
  result: null,
  ms: 0,
  error: '',
};
/** the party presets: who waits at home (team) and the Potions packed (pack) */
const RUN_LAB_SIM_PARTY = {
  one: { label: 'One starter at home', o: { team: 1 } },
  three: { label: 'Three at home', o: { team: 3 } },
  packed: { label: 'Three at home, 5 Potions packed', o: { team: 3, pack: 5 } },
};
/** the rows of the main table: a metric, its label, and whether the policy mostly decides it */
const RUN_LAB_SIM_ROWS = [
  ['won', 'Won (share of runs)'],
  ['days', 'Days'],
  ['places', 'Places walked into'],
  ['battles', 'Battles'],
  ['caught', 'Caught'],
  ['healed', 'Paid at clinics (Moneys)'],
  ['spent', 'Spent in shops (Moneys)'],
  ['moneyLeft', 'Moneys at the end'],
  ['research', 'Research paid out'],
  ['perks', 'Perks held at the end'],
  ['topLevel', 'Top level'],
  ['metResident', 'Walked into their resident’s town (share of runs)'],
];

/** the options every run is played with (the card's choices; balance mode) */
const runLabSimOptions = () => ({
  ...RUN_LAB_SIM_PARTY[runLabSim.party].o,
  unlocks: runLabSim.unlocks,
  policy: runLabSim.policy,
  scenes: 'skip',
});
/** the seed count, kept between 5 and the browser's cap @param {number} n */
const runLabSimCount = n => Math.max(5, Math.min(SIM_BROWSER_CAP, Math.round(n) || 0));

/** a number as the tables show it @param {number} x @param {boolean} [share] */
const runLabSimNum = (x, share) => (share ? `${Math.round(x * 1000) / 10}%` : String(Math.round(x * 100) / 100));
/** a paired difference with its interval, or "same" @param {any} d @param {boolean} [share] */
function runLabSimDiff(d, share) {
  if (!d.changed) return '<span class="rl-sim-same">same</span>';
  const f = (/** @type {number} */ x) => (x > 0 ? '+' : '') + runLabSimNum(x, share);
  return `<b>${f(d.mean)}</b> <small>[${f(d.lo)}, ${f(d.hi)}]</small> <small>(${d.changed} run${d.changed === 1 ? '' : 's'} changed)</small>`;
}
/** a table with the banner on top @param {string} title @param {string} head @param {string[]} rows */
const runLabSimTable = (title, head, rows) =>
  `<h4>${title}</h4><p class="rl-sim-banner">${escapeHtml(simBanner(runLabSim.result.policy))}</p><table class="tbl rl-sim-table"><tr>${head}</tr>${rows.join('') || '<tr><td colspan="9" class="help">None.</td></tr>'}</table>`;
/** a count per key on both sides @param {Record<string, number>} a @param {Record<string, number>} b
 * @param {(k: string) => string} [name] */
function runLabSimCounts(a, b, name = k => k) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .map(
      k =>
        `<tr data-key="${escapeHtml(k)}"><th>${escapeHtml(name(k))}</th><td>${a[k] || 0}</td><td>${b[k] || 0}</td></tr>`
    );
}

/** the compare as tables @param {any} C simCompareReports' result */
function runLabSimResultHTML(C) {
  const driven = new Set(C.policyDriven),
    w = (/** @type {any} */ x) =>
      `${runLabSimNum(x.p, true)} <small>[${runLabSimNum(x.lo, true)}, ${runLabSimNum(x.hi, true)}]</small>`,
    rows = RUN_LAB_SIM_ROWS.map(([k, label]) => {
      const tag = driven.has(k)
          ? ' <span class="rl-sim-driven" title="Mostly the bot policy’s choice">policy-driven</span>'
          : '',
        share = k === 'won';
      return `<tr data-metric="${k}" data-changed="${C.diff[k].changed}" data-mean="${C.diff[k].mean}"><th>${label}${tag}</th><td>${share ? w(C.base.won) : runLabSimNum(C.base.avg[k])}</td><td>${share ? w(C.draft.won) : runLabSimNum(C.draft.avg[k])}</td><td>${runLabSimDiff(C.diff[k], share)}</td></tr>`;
    }),
    money = (/** @type {'moneyIn' | 'moneyOut'} */ side) =>
      Object.keys({ ...C.base[side], ...C.draft[side] }).map(
        k =>
          `<tr><th>${side === 'moneyIn' ? 'In' : 'Out'}: ${escapeHtml(k)}</th><td>${runLabSimNum(C.base[side][k] || 0)}</td><td>${runLabSimNum(C.draft[side][k] || 0)}</td></tr>`
      ),
    leaders = [...new Set([...Object.keys(C.base.leaders), ...Object.keys(C.draft.leaders)])].sort().map(id => {
      const b = C.base.leaders[id] || { fought: 0, beaten: 0 },
        d = C.draft.leaders[id] || { fought: 0, beaten: 0 };
      return `<tr><th>${escapeHtml(id)}</th><td>${b.beaten} of ${b.fought}</td><td>${d.beaten} of ${d.fought}</td></tr>`;
    }),
    flips = C.flips.won.length + C.flips.lost.length,
    hb = C.hash.base,
    hd = C.hash.draft;
  return `<p class="help rl-sim-hash" data-base="${hb}" data-draft="${hd}" data-same="${C.same ? 1 : 0}">${C.seeds} seeds (SIM0 to SIM${C.seeds - 1}), the same on both sides; Base data <code>${hb}</code>, Draft data <code>${hd}</code>${hb === hd ? ' (the same data)' : ''}. ${C.same ? '<b>Every run is the same on both sides.</b>' : `${flips} run(s) won on one side only.`} ${runLabSim.ms} ms.</p>
${runLabSimTable('Per run', '<th></th><th>Base</th><th>Draft</th><th>Draft − Base, paired [95%]</th>', rows)}
${runLabSimTable('Where runs were lost: by place', '<th></th><th>Base</th><th>Draft</th>', runLabSimCounts(C.base.lostAt, C.draft.lostAt))}
${runLabSimTable(
  'Where runs were lost: by row',
  '<th></th><th>Base</th><th>Draft</th>',
  runLabSimCounts(C.base.lostRow, C.draft.lostRow, k => `Row ${k}`)
)}
${runLabSimTable('Moneys per run (what goes out is policy-driven: what the bot buys)', '<th></th><th>Base</th><th>Draft</th>', money('moneyIn').concat(money('moneyOut')))}
${runLabSimTable('Perks held at the end (policy-driven), runs', '<th></th><th>Base</th><th>Draft</th>', runLabSimCounts(C.base.perks, C.draft.perks))}
${runLabSimTable('Leaders beaten', '<th></th><th>Base</th><th>Draft</th>', leaders)}
${flips ? `<p class="help">Won on Draft only: ${C.flips.won.join(', ') || 'none'}. Lost on Draft only: ${C.flips.lost.join(', ') || 'none'}.</p>` : ''}`;
}

/** the card's body: the choices, Simulate, and the last compare */
export function runLabSimHTML() {
  const opt = (/** @type {string} */ v, /** @type {string} */ l, /** @type {string} */ now) =>
      `<option value="${v}"${now === v ? ' selected' : ''}>${escapeHtml(l)}</option>`,
    R = runLabSim.result;
  return `<p class="help">Plays the same seeds on the data as loaded (Base) and with your changes (Draft), each in its own logic worker, with the game’s own rules and a bot in the player’s place (balance mode: no scenes are made, the same outcomes). Differences are paired, seed by seed. The numbers measure the bot: a lower bound on a careful player, not a prediction.</p>
<div class="rl-inputs rl-sim-inputs">
<label class="fld"><span>Seeds</span><input id="rlSimN" data-rlsim="n" type="number" min="5" max="${SIM_BROWSER_CAP}" step="1" value="${runLabSim.n}"></label>
<label class="fld"><span>Bot policy</span><select id="rlSimPolicy" data-rlsim="policy">${Object.keys(SIM_POLICIES)
    .map(k => opt(k, k, runLabSim.policy))
    .join('')}</select></label>
<label class="fld"><span>Party</span><select id="rlSimParty" data-rlsim="party">${Object.entries(RUN_LAB_SIM_PARTY)
    .map(([k, p]) => opt(k, p.label, runLabSim.party))
    .join('')}</select></label>
<label class="fld"><span>Unlocks</span><select id="rlSimUnlocks" data-rlsim="unlocks">${opt('none', 'None (a fresh save)', runLabSim.unlocks)}${opt('all', 'All', runLabSim.unlocks)}</select></label>
<button class="btn primary" data-act="runLabSimulate"${runLabSim.busy ? ' disabled' : ''}>${runLabSim.busy ? 'Simulating…' : 'Simulate'}</button>
<button class="btn" data-act="runLabSimExport"${R ? '' : ' disabled'}>Export JSON</button>
</div><div class="rl-sim-out" data-runlab-sim${R ? ' data-ready="1"' : ''}>${runLabSim.error ? `<p class="err">The simulation couldn’t run: ${escapeHtml(runLabSim.error)}</p>` : R ? runLabSimResultHTML(R) : '<p class="help">Not run yet.</p>'}</div>`;
}
/** redraw the card in place */
function runLabSimRedraw() {
  for (const el of document.querySelectorAll('#main .rl-sim .card-b')) el.innerHTML = runLabSimHTML();
}

/** Simulate: the same seeds and options on Base and on Draft, then their compare */
ACTIONS.runLabSimulate = () => {
  const k = ++runLabSim.k,
    seeds = simSeeds(runLabSimCount(runLabSim.n)),
    o = runLabSimOptions(),
    t0 = performance.now();
  Object.assign(runLabSim, { busy: true, error: '', result: null });
  runLabSimRedraw();
  Promise.all([logicAskBase('runSimReport', seeds, o), logicAsk('runSimReport', seeds, o)]).then(
    ([base, draft]) => {
      if (k !== runLabSim.k) return;
      Object.assign(runLabSim, {
        busy: false,
        result: simCompareReports(base, draft),
        ms: Math.round(performance.now() - t0),
      });
      runLabSimRedraw();
    },
    e => {
      if (k !== runLabSim.k) return;
      Object.assign(runLabSim, { busy: false, result: null, error: e.message || String(e) });
      runLabSimRedraw();
    }
  );
};
/** Export JSON: the compare as the CLI's --compare writes it */
ACTIONS.runLabSimExport = () => {
  if (!runLabSim.result) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(runLabSim.result, null, 1)], { type: 'application/json' }));
  a.download = `run-sim-compare-${runLabSim.result.hash.base}-${runLabSim.result.hash.draft}.json`;
  a.click();
};
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el || !el.dataset || !el.dataset.rlsim) return;
  const k = el.dataset.rlsim;
  if (k === 'n') {
    runLabSim.n = runLabSimCount(+el.value);
    el.value = String(runLabSim.n);
  } else /** @type {any} */ (runLabSim)[k] = el.value;
});
