'use strict';
/* ================= RUN LAB (Studio plan Phase 2, T2.2) =================
   A run's map from its seed, made by the game's own start (game/js/logic/run-start.js runStartPlan, the one runTakeOff
   calls), on the Studio's data as it is now, unsaved changes included. Read-only: nothing here changes the data.
   - The seed is typed, rolled (🎲) or read from a pasted debug log (its run's seed and the save's unlocks). Seeds are
     cleaned as the game's debug menu cleans them, so the same text makes the same run there.
   - Unlocks: none (a fresh save's), all, or the pasted log's. Only what opens biomes changes the map.
   - "Short map" is the debug menu's (5 rows, 1 mini-boss).
   - The map is SVG: rows from the landing (left) to the boss (right), lane 0 below; a node's fill is its biome's haze
     colour, its letter its type; a dashed ring is what the landing shows as '?', a faint one what it doesn't show.
   - Clicking a node shows its type, role, biome, links, the day the shortest walk reaches it, the deadline, its seed
     and its forecast.
   - "Beside the loaded data" draws the same seed on the data as the Studio loaded it (studioState.loaded), so a
     change to rules.run, nodeTypes or biomes shows as a second map.
   An edit made in the other pane redraws the map (the game's map code takes well under a millisecond).
   T2.4: what the game's logic says about the run (logic/run-preview.js runPreview, in the Studio's logic worker on the
   data as it is now): the clicked place's wild table, its leader and team (a mini-boss or the boss), a town's stock and
   Perk on each day it can be open; and the run's Perk picks after each mini-boss row, with nothing held.
   T2.5: the run rules card beside the map edits rules.run (map, clock, reveal, wild, foes, shop, healCost, payout) and
   nodeTypes with the standard fields; each change redraws the map and the logic panel. The rules that live in code
   (logic/run-rules-code.js) are listed read-only with their file and line, found by searching the file as served.
   T2.6: "Play this seed" opens the game on this seed in a test run (?debug&run=, logic/run-test.js) with the Lab's
   unlocks and short map, after the Studio's unsaved data (the live channel: game data, never a save).
   T2.3: the map checks over 1,000 seeds (data-checks.js runMapSweep, in the logic worker) under the map: problems with
   a seed that shows each, the figures (places, types, towns on a walk, biomes, towns made against routes) and outlying
   seeds to open.
   T3.4: the Simulate card (run-lab-sim.js): the run simulation on the same seeds, Base (as loaded) against Draft. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { runRegionData } from '../../game/js/logic/run-region.js';
import { runBack, runMapRows, runNodeSeed, runWorldNode } from '../../game/js/logic/run-map.js';
import { runUnlocks } from '../../game/js/logic/unlocks.js';
import { runStartPlan } from '../../game/js/logic/run-start.js';
import { escapeHtml } from './game-stand-ins.js';
import { RUN_RULES_IN_CODE, runRulesCodeLine } from '../../game/js/logic/run-rules-code.js';
import {
  ACTIONS,
  SECTIONS,
  card,
  changed,
  dialog,
  grid,
  numberField,
  render,
  sectionShown,
  selectField,
  speciesName,
  studioState,
  textField,
  toast,
} from './studio-app.js';
import { githubMode } from './github.js';
import { logicAsk } from './logic-client.js';
import { runLabSimHTML } from './run-lab-sim.js';
/* eslint-disable no-func-assign */
expose({
  RUN_LAB_PAYOUT: [() => RUN_LAB_PAYOUT],
  RUN_LAB_ROLE: [() => RUN_LAB_ROLE],
  RUN_LAB_SHORT: [() => RUN_LAB_SHORT],
  RUN_LAB_TYPE_COLOUR: [() => RUN_LAB_TYPE_COLOUR],
  runLab: [() => runLab],
  runLabBiomeColour: [() => runLabBiomeColour],
  runLabCodeLines: [() => runLabCodeLines, v => (runLabCodeLines = v)],
  runLabFigures: [() => runLabFigures, v => (runLabFigures = v)],
  runLabLogicFill: [() => runLabLogicFill, v => (runLabLogicFill = v)],
  runLabLogicHTML: [() => runLabLogicHTML, v => (runLabLogicHTML = v)],
  runLabLogicSoon: [() => runLabLogicSoon],
  runLabName: [() => runLabName],
  runLabNodeHTML: [() => runLabNodeHTML, v => (runLabNodeHTML = v)],
  runLabOutHTML: [() => runLabOutHTML, v => (runLabOutHTML = v)],
  runLabPlan: [() => runLabPlan, v => (runLabPlan = v)],
  runLabPlayUrl: [() => runLabPlayUrl, v => (runLabPlayUrl = v)],
  runLabReadLog: [() => runLabReadLog, v => (runLabReadLog = v)],
  runLabRedraw: [() => runLabRedraw, v => (runLabRedraw = v)],
  runLabRulesHTML: [() => runLabRulesHTML, v => (runLabRulesHTML = v)],
  runLabSeedClean: [() => runLabSeedClean],
  runLabSoon: [() => runLabSoon],
  runLabSvg: [() => runLabSvg, v => (runLabSvg = v)],
  runLabSweepFill: [() => runLabSweepFill, v => (runLabSweepFill = v)],
  runLabSweepHTML: [() => runLabSweepHTML, v => (runLabSweepHTML = v)],
  runLabUnlocks: [() => runLabUnlocks, v => (runLabUnlocks = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const runLab = {
  seed: 'LAB1',
  /** @type {'none' | 'all' | 'log'} */
  unlocks: 'none',
  /** the unlock ids of a pasted debug log's save, and what else it said @type {string[]} */
  logUnlocks: [],
  logNote: '',
  short: false,
  beside: false,
  pick: -1,
  redrawT: 0,
  /** the latest ask to the logic worker (an older answer is dropped) */
  logicN: 0,
  logicT: 0,
  sweepN: 0,
  /** the last sweep and the rules it was for @type {{ key: string, S: any } | null} */
  sweep: null,
  /** the source files the rules in code are in, as served (path -> its text, '' when it couldn't be read) */
  /** @type {Record<string, Promise<string>>} */
  code: {},
};
const RUN_LAB_PAYOUT = {
  money: 'Research per Money brought home',
  itemShare: 'Share of an item’s price',
  released: 'Research per Billie released',
  node: 'Research per place cleared',
  win: 'Research for a win',
  winSeals: 'Crests for a win',
  scrapNode: 'Scrap per place cleared',
  scrapWin: 'Scrap for a win',
};
/** the debug menu's short run (debug-menu.js runstart) */
const RUN_LAB_SHORT = { rows: 5, minibosses: 1 };
const RUN_LAB_ROLE = {
  first: 'the landing',
  rest: 'a rest stop (the row before a mini-boss)',
  guard: 'a mini-boss',
  last: 'the boss',
  '': 'a filler row (drawn by nodeTypes weight)',
};
/** a seed as the game's debug menu takes it @param {string} v */
const runLabSeedClean = v =>
  String(v || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 20);

/** the unlock ids a run carries (unlocks.js runUnlocks: only those that open a shop or a biome) @param {any} D */
function runLabUnlocks(D) {
  const ids =
    runLab.unlocks === 'all' ? Object.keys(D.unlocks || {}) : runLab.unlocks === 'log' ? runLab.logUnlocks : [];
  return runUnlocks(/** @type {any} */ ({ meta: { unlocks: Object.fromEntries(ids.map(id => [id, 1])) } }), {
    unlocks: D.unlocks || {},
    buildings: D.buildings || {},
  });
}
/** the plan for a data set (D, or the loaded copy): { plan } or { error } @param {any} D */
function runLabPlan(D) {
  try {
    const data = {
      nodeTypes: D.nodeTypes,
      biomes: D.biomes,
      rules: D.rules.run,
      unlockData: { unlocks: D.unlocks || {}, buildings: D.buildings || {} },
      /* RL-R1: the run's region (its zones decide the map's rows) */
      region: D.regions && D.regions.themes ? runRegionData(D, D.trainers || {}) : undefined,
    };
    const plan = runStartPlan(runLab.seed, data, {
      unlocks: runLabUnlocks(D),
      map: runLab.short ? RUN_LAB_SHORT : undefined,
    });
    return { plan, roles: runMapRows(plan.data.rules.map) };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}

/** a biome's colour on the map: its look's haze @param {any} D @param {string} b */
const runLabBiomeColour = (D, b) => ((D.biomes[b] || {}).look || {}).haze || '#ccc';
const RUN_LAB_TYPE_COLOUR = { landing: '#2a7', route: '#557', town: '#c80', miniboss: '#c33', boss: '#909' };

/** the map as SVG @param {any} D @param {any} plan @param {boolean} pickable */
function runLabSvg(D, plan, pickable) {
  const nodes = plan.map.nodes,
    rows = Math.max(...nodes.map(n => n.row)) + 1,
    X = r => 30 + r * 64,
    Y = n => (nodes.filter(m => m.row === n.row).length === 1 ? 60 : n.lane === 0 ? 92 : 28),
    w = X(rows - 1) + 30;
  const links = nodes
    .flatMap((n, i) =>
      n.to.map(j => `<line x1="${X(n.row)}" y1="${Y(n)}" x2="${X(nodes[j].row)}" y2="${Y(nodes[j])}" class="rl-link"/>`)
    )
    .join('');
  const dots = nodes
    .map((n, i) => {
      const T = D.nodeTypes[n.type] || {},
        letter = escapeHtml((T.name || n.type || '?').slice(0, 1).toUpperCase()),
        ring = n.seen >= 2 ? '' : n.seen === 1 ? ' stroke-dasharray="3 3"' : ' stroke-opacity=".35"';
      return `<g class="rl-node${pickable && runLab.pick === i ? ' on' : ''}"${pickable ? ` data-act="runLabPick" data-i="${i}"` : ''} data-type="${escapeHtml(n.type)}" data-biome="${escapeHtml(n.biome || '')}"><title>${i}: ${escapeHtml(T.name || n.type)}, ${escapeHtml((D.biomes[n.biome] || {}).name || n.biome || '')}</title><circle cx="${X(n.row)}" cy="${Y(n)}" r="17" fill="${runLabBiomeColour(D, n.biome)}" stroke="${RUN_LAB_TYPE_COLOUR[n.type] || '#333'}" stroke-width="4"${ring}/><text x="${X(n.row)}" y="${Y(n) + 5}" text-anchor="middle">${letter}</text></g>`;
    })
    .join('');
  return `<svg class="rl-map" viewBox="0 0 ${w} 120" width="${w}" height="120" role="img" aria-label="The run's map">${links}${dots}</svg>`;
}

/** a map's figures in a line @param {any} D @param {any} plan */
function runLabFigures(D, plan) {
  const count = (/** @type {(n: any) => string} */ f) => {
    /** @type {Record<string, number>} */ const c = {};
    for (const n of plan.map.nodes) c[f(n)] = (c[f(n)] || 0) + 1;
    return Object.entries(c)
      .map(([k, v]) => `${v} ${escapeHtml(k)}`)
      .join(', ');
  };
  return `${plan.map.nodes.length} places: ${count(n => (D.nodeTypes[n.type] || {}).name || n.type)}. Biomes: ${count(n => (D.biomes[n.biome] || {}).name || n.biome)}. Deadline: day ${plan.deadline}.`;
}

/** what a clicked node is @param {any} D @param {any} plan @param {string[]} roles @param {number} i */
function runLabNodeHTML(D, plan, roles, i) {
  const map = plan.map,
    n = map.nodes[i];
  if (!n) return '<p class="help">Click a place on the map to see it.</p>';
  const T = D.nodeTypes[n.type] || {},
    B = D.biomes[n.biome] || {},
    name = (/** @type {number} */ j) =>
      `${j} (${escapeHtml((D.nodeTypes[map.nodes[j].type] || {}).name || map.nodes[j].type)})`,
    back = runBack(map, i),
    days = (plan.forecast[runWorldNode(i)] || []).map((w, d) => `day ${d + 1}: ${escapeHtml(w)}`).join(', '),
    shown = ['not shown', 'shown as ?', 'shown with its type'][n.seen || 0];
  const row = (/** @type {string} */ k, /** @type {string} */ v) => `<tr><th>${k}</th><td>${v}</td></tr>`;
  return `<table class="tbl rl-node-info" data-node="${i}">${[
    row('Place', `${i} of ${map.nodes.length} (world node ${runWorldNode(i)})`),
    row('Type', `${escapeHtml(T.name || n.type)} <small class="mono">${escapeHtml(n.type)}</small>`),
    row(
      'Row',
      `${n.row + 1} of ${roles.length}, lane ${n.lane}: ${RUN_LAB_ROLE[roles[n.row]] || escapeHtml(roles[n.row])}`
    ),
    row(
      'Biome',
      `${escapeHtml(B.name || n.biome || '')} <small class="mono">${escapeHtml(n.biome || '')}</small>, ${escapeHtml(B.climate || 'mild')}`
    ),
    row('Leads to', n.to.map(name).join(', ') || 'nothing (the end)'),
    row('Reached from', back.map(name).join(', ') || 'Copperleaf (the airship)'),
    row(
      'Day',
      `day ${n.row + 1} on the shortest walk; the deadline is day ${plan.deadline} (rules.run.clock.slack ${escapeHtml(String(D.rules.run.clock.slack))} past the shortest walk to the boss)`
    ),
    row('At the landing', shown),
    row(
      'Node seed',
      `<span class="mono">${escapeHtml(runNodeSeed(runLab.seed, i))}</span> (its scene, wild Billies, shop, weather)`
    ),
    row('Forecast', days || 'none rolled yet'),
  ].join('')}</table>`;
}

/** a name from the data, its id beside it @param {any} table @param {string} id @param {string} [k] */
const runLabName = (table, id, k = 'n') =>
  `${escapeHtml(((table || {})[id] || {})[k] || id)} <small class="mono">${escapeHtml(id)}</small>`;
/** what the game's logic says about the run (runPreview's answer): node i's part, then the run's Perk picks
 * @param {any} D @param {any} p @param {number} i */
function runLabLogicHTML(D, p, i) {
  const n = p.nodes[i],
    row = (/** @type {string} */ k, /** @type {string} */ v, a = '') => `<tr${a}><th>${k}</th><td>${v}</td></tr>`,
    rows = [];
  if (n) {
    const W = n.wild,
      sum = W.list.reduce((a, e) => a + e[1], 0) || 1;
    rows.push(
      row(
        'Wild',
        `Lv ${W.lv[0]}–${W.lv[1]}: ${W.list
          .slice()
          .sort((a, b) => b[1] - a[1])
          .map(([sp, w]) => `${escapeHtml(speciesName(sp))} ${Math.round((w / sum) * 100)}%`)
          .join(', ')}`,
        ` data-wild="${escapeHtml(W.list.map(e => e.join(':')).join(','))}"`
      )
    );
    if (n.foe) {
      const F = n.foe;
      rows.push(
        row(
          F.runFoe === 'boss' ? 'Boss' : 'Mini-boss',
          `${escapeHtml(F.name || F.from)} <small class="mono">${escapeHtml(F.from)}</small>: ${F.team
            .map(e => `${escapeHtml(speciesName(e.sp))} Lv ${e.lvl}`)
            .join(', ')}; ${F.double ? 'a double battle' : 'alone, as an Alpha'}; reward ${F.reward} Moneys`,
          ` data-foe="${escapeHtml(F.from)}" data-team="${escapeHtml(F.team.map(e => e.sp + '@' + e.lvl).join(','))}"`
        )
      );
    }
    for (const S of n.shop || [])
      rows.push(
        row(
          `Shop, day ${S.day}`,
          `${S.stock.map(w => (w.coin ? runLabName(D.coins, w.coin) : runLabName(D.items, w.item))).join(', ')}${S.relic ? `; Perk: ${runLabName(D.relics, S.relic, 'name')}` : ''}`,
          ` data-day="${S.day}" data-stock="${escapeHtml(S.stock.map(w => w.item || 'coin:' + w.coin).join(','))}" data-relic="${escapeHtml(S.relic)}"`
        )
      );
  }
  const picks = p.relicOffers
    .map(
      (/** @type {string[]} */ ids, /** @type {number} */ k) =>
        `<li data-offer="${escapeHtml(ids.join(','))}">after mini-boss ${k + 1}: ${ids.map(id => runLabName(D.relics, id, 'name')).join(', ') || 'nothing left'}</li>`
    )
    .join('');
  return `<h4>From the game’s logic</h4>${rows.length ? `<table class="tbl rl-logic-node" data-node="${i}">${rows.join('')}</table>` : ''}<p class="help">Perk picks, in order, with none held (a held one changes the later picks and the shelves):</p><ol class="rl-offers">${picks}</ol>`;
}
/** the seed sweep's answer (data-checks.js runMapSweep) @param {any} D @param {any} S */
function runLabSweepHTML(D, S) {
  const pct = (/** @type {number} */ v, /** @type {number} */ all) => `${Math.round((v / (all || 1)) * 100)}%`,
    all = Object.values(S.types).reduce((/** @type {number} */ a, /** @type {any} */ b) => a + b, 0),
    open = (/** @type {string} */ seed, /** @type {string} */ l) =>
      `<button class="btn small" data-act="runLabOpenSeed" data-seed="${escapeHtml(seed)}">${l}</button>`,
    problems = S.problems.length
      ? `<ul class="rl-sweep-problems">${S.problems.map((/** @type {any} */ p) => `<li class="err" data-seed="${escapeHtml(p.seed)}">${escapeHtml(p.text)} (${p.count} of ${S.maps || 1000} maps) ${open(p.seed, `Open ${escapeHtml(p.seed)}`)}</li>`).join('')}</ul>`
      : '<p class="ok rl-sweep-ok">No problems: every map reaches the boss, every place can be reached, each role row holds its type.</p>';
  if (!S.maps) return `<h4>Over 1,000 seeds</h4>${problems}`;
  const types = Object.entries(S.types)
      .map(([k, v]) => `${escapeHtml((D.nodeTypes[k] || {}).name || k)} ${pct(/** @type {number} */ (v), all)}`)
      .join(', '),
    bAll = Object.values(S.biomes).reduce((/** @type {number} */ a, /** @type {any} */ b) => a + b, 0),
    biomes = Object.entries(S.biomes)
      .sort((a, b) => /** @type {number} */ (b[1]) - /** @type {number} */ (a[1]))
      .map(([k, v]) => `${escapeHtml((D.biomes[k] || {}).name || k)} ${pct(/** @type {number} */ (v), bAll)}`)
      .join(', '),
    R = S.ratio;
  return `<h4>Over ${S.maps.toLocaleString()} seeds</h4>${problems}<table class="tbl rl-sweep-figures">
<tr><th>Places</th><td>${S.nodes.min}–${S.nodes.max}, ${S.nodes.avg.toFixed(1)} on average</td></tr>
<tr><th>By type</th><td>${types}</td></tr>
<tr><th>Towns on a walk</th><td>${S.townsPerPath.min}–${S.townsPerPath.max} (the walk with fewest: ${S.townsPerPath.avg.toFixed(1)} on average)</td></tr>
<tr><th>Towns : routes</th><td data-ratio="${R.towns}:${R.routes}">${R.towns.toLocaleString()} : ${R.routes.toLocaleString()} made, against weights ${R.weights.town} : ${R.weights.route} (rest rows are always towns)</td></tr>
<tr><th>Biomes</th><td>${biomes}</td></tr>
<tr><th>Seeds to look at</th><td>${S.outliers.map((/** @type {any} */ o) => open(o.seed, `${escapeHtml(o.seed)}: ${escapeHtml(o.why)}`)).join(' ')}</td></tr></table>`;
}
/** ask the logic worker for the sweep on the rules the Lab's map uses (the unlocks' biomes, the short map) */
function runLabSweepFill() {
  const els = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('[data-runlab-sweep]')]);
  if (!els.length) return;
  const D = studioState.D,
    now = runLabPlan(D),
    k = ++runLab.sweepN;
  if (now.error || !now.plan) return;
  const args = [D.nodeTypes, now.plan.data.rules.map, D.rules.run.clock, { n: 1000 }],
    key = JSON.stringify(args),
    show = (/** @type {any} */ S) => {
      for (const el of els) {
        el.innerHTML = runLabSweepHTML(D, S);
        el.dataset.problems = String(S.problems.length);
        el.dataset.ready = '1';
      }
    };
  /* it doesn't change with the seed or the place clicked: the last answer stands while its rules do */
  if (runLab.sweep && runLab.sweep.key === key) return show(runLab.sweep.S);
  logicAsk('runMapSweep', ...args).then(
    S => {
      if (k !== runLab.sweepN) return;
      runLab.sweep = { key, S };
      show(S);
    },
    e => {
      if (k !== runLab.sweepN || e.message === 'replaced') return;
      for (const el of els) el.innerHTML = `<p class="err">The seed sweep couldn’t run: ${escapeHtml(e.message)}</p>`;
    }
  );
}
/** ask the logic worker about the run on the data as it is now, and fill the panel when it answers */
function runLabLogicFill() {
  runLabSweepFill();
  const els = [...document.querySelectorAll('[data-runlab-logic]')];
  if (!els.length) return;
  const D = studioState.D,
    k = ++runLab.logicN,
    t0 = performance.now(),
    seed = runLab.seed,
    pick = runLab.pick;
  logicAsk('runPreview', seed, { unlocks: runLabUnlocks(D), map: runLab.short ? RUN_LAB_SHORT : undefined }).then(
    p => {
      if (k !== runLab.logicN) return;
      for (const el of els) {
        el.innerHTML = runLabLogicHTML(D, p, pick);
        el.dataset.ms = String(Math.round(performance.now() - t0));
        el.dataset.ready = seed;
      }
    },
    e => {
      if (k !== runLab.logicN || e.message === 'replaced') return;
      for (const el of els)
        el.innerHTML = `<p class="err rl-logic-error">The game’s logic couldn’t work it out: ${escapeHtml(e.message)}</p>`;
    }
  );
}

/** the part of the Lab that changes with the seed and the data */
function runLabOutHTML() {
  const D = studioState.D,
    now = runLabPlan(D);
  if (now.error)
    return `<p class="err rl-error">This data can’t make a run: ${escapeHtml(now.error)}</p><p class="help">The game would refuse to take off with it.</p>`;
  const base = runLab.beside && studioState.loaded ? runLabPlan(studioState.loaded) : null,
    same = base && base.plan ? JSON.stringify(base.plan.map) === JSON.stringify(now.plan.map) : false,
    baseHTML = !base
      ? ''
      : base.error
        ? `<p class="err">The loaded data couldn’t make it: ${escapeHtml(base.error)}</p>`
        : `<h4>As loaded${same ? ' (the same map)' : ''}</h4><div class="rl-scroll">${runLabSvg(studioState.loaded, base.plan, false)}</div><p class="help rl-figures-base">${runLabFigures(studioState.loaded, base.plan)}</p>`;
  return `<h4>${runLab.beside ? 'With your changes' : 'The map'}</h4><div class="rl-scroll">${runLabSvg(D, now.plan, true)}</div><p class="help rl-figures">${runLabFigures(D, now.plan)}</p>${baseHTML}<div class="rl-legend">${Object.entries(
    RUN_LAB_TYPE_COLOUR
  )
    .map(([k, c]) => `<span><i style="border-color:${c}"></i>${escapeHtml((D.nodeTypes[k] || {}).name || k)}</span>`)
    .join(
      ''
    )}</div><div class="rl-sweep" data-runlab-sweep><p class="help">Checking 1,000 seeds…</p></div>${runLabNodeHTML(D, now.plan, now.roles, runLab.pick)}<div class="rl-logic" data-runlab-logic><p class="help">The game’s logic is working it out…</p></div>`;
}
/** the run rules card: rules.run and nodeTypes with the standard fields, then the rules that live in code */
function runLabRulesHTML() {
  const D = studioState.D,
    R = D.rules.run,
    n = (/** @type {string} */ l, /** @type {string} */ p, o = {}) => numberField(l, `rules.run.${p}`, o),
    int = { min: 0, step: 1 },
    types = Object.keys(D.nodeTypes || {}).map(k => [k, (D.nodeTypes[k] || {}).name || k]),
    part = (/** @type {string} */ h, /** @type {string[]} */ f, more = '') => `<h4>${h}</h4>${grid(...f)}${more}`,
    always = Object.keys(D.items)
      .map(k => ['', k])
      .concat(Object.keys(D.coins).map(k => ['coin:', k]))
      .map(([pre, k]) => {
        const id = pre + k,
          name = pre ? (D.coins[k] || {}).n : (D.items[k] || {}).n;
        return `<label class="chk-chip"><input type="checkbox" data-rl-always="${escapeHtml(id)}"${R.shop.always.includes(id) ? ' checked' : ''}> ${escapeHtml(name || id)}</label>`;
      })
      .join('');
  return [
    `<p class="help">Each change redraws the map and the game’s logic beside it. These are rules.json <code>run</code> and nodeTypes.json, saved and proposed like any other field.</p>`,
    part('Map', [
      n('Rows', 'map.rows', { min: 2, max: 30, step: 1 }),
      n('Mini-bosses', 'map.minibosses', { min: 0, max: 10, step: 1 }),
      n('Two lanes (chance a row)', 'map.wide', { min: 0, max: 1, step: 0.05 }),
      n('Cross-link (chance a row)', 'map.cross', { min: 0, max: 1, step: 0.05 }),
      selectField('The landing’s row', 'rules.run.map.first', types),
      selectField('A rest row (before a mini-boss)', 'rules.run.map.rest', types),
      selectField('A mini-boss row', 'rules.run.map.guard', types),
      selectField('The last row', 'rules.run.map.last', types),
    ]),
    part(
      'Biomes on the map (weight; an unlock may close one)',
      Object.keys(D.biomes || {}).map(b => n((D.biomes[b] || {}).name || b, `map.biomes.${b}`, { ...int, opt: 1 }))
    ),
    part(
      'Place types (filler rows draw by weight)',
      Object.keys(D.nodeTypes || {}).flatMap(k => [
        textField(`<span class="mono">${escapeHtml(k)}</span> name`, `nodeTypes.${k}.name`),
        numberField(`<span class="mono">${escapeHtml(k)}</span> weight`, `nodeTypes.${k}.weight`, { ...int, opt: 1 }),
      ])
    ),
    part('Clock and what the map shows', [
      n('Days of slack past the shortest walk', 'clock.slack', int),
      n('Forecast days ahead', 'clock.ahead', int),
      n('Rows ahead shown with their type', 'reveal.icons', int),
      n('Rows ahead shown as ?', 'reveal.unknown', int),
    ]),
    part('Wild Billies', [
      n('Lowest level (landing row)', 'wild.lv.0', { min: 1, max: 100, step: 1 }),
      n('Highest level (landing row)', 'wild.lv.1', { min: 1, max: 100, step: 1 }),
      n('Levels more each row', 'wild.perRow', int),
      n('Encounters left on a place walked back to', 'wild.back', int),
    ]),
    part(
      'Foes',
      ['miniboss', 'boss'].flatMap(k => {
        const name = escapeHtml((D.nodeTypes[k] || {}).name || k);
        return [
          n(`${name}: levels over the row’s top wild level`, `foes.${k}.up`, int),
          n(`${name}: reward (Moneys)`, `foes.${k}.reward`, int),
        ];
      })
    ),
    part(
      'Town shop and clinic',
      [
        n('Wares drawn each day', 'shop.more', int),
        n('Clinic: $ per hurt Billie', 'healCost', int),
        ...Object.keys(D.items).map(k =>
          n(`Weight: ${escapeHtml(D.items[k].n || k)}`, `shop.pick.${k}`, { ...int, opt: 1 })
        ),
      ],
      `<p class="help">Always on the shelves:</p><div class="chips rl-always">${always}</div>`
    ),
    part(
      'Payout',
      Object.keys(R.payout || {}).map(k => n(RUN_LAB_PAYOUT[k] || k, `payout.${k}`, { min: 0, step: 'any' }))
    ),
    `<h4>In the code (read-only)</h4><p class="help">These follow the code, not the data; changing one is a game change.</p><table class="tbl rl-code">${RUN_RULES_IN_CODE.map(
      (C, k) =>
        `<tr><th>${escapeHtml(C.what)}</th><td>${escapeHtml(C.value)}</td><td class="mono" data-rl-code="${k}">${escapeHtml(C.file.split('/').pop())}</td></tr>`
    ).join('')}</table>`,
  ].join('');
}
/** put each rule in code's line beside its file, from the file as the page is served */
function runLabCodeLines() {
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-rl-code]'))) {
    const C = RUN_RULES_IN_CODE[+(el.dataset.rlCode || 0)];
    if (!runLab.code[C.file])
      runLab.code[C.file] = fetch(new URL('../' + C.file, document.baseURI)).then(
        r => (r.ok ? r.text() : ''),
        () => ''
      );
    runLab.code[C.file].then(text => {
      const line = runRulesCodeLine(text, C.code);
      el.textContent = `${C.file.split('/').pop()}:${line || '?'}`;
      el.title = line ? `${C.file}, line ${line}: ${C.code}` : `${C.file}: the code has moved (${C.code})`;
      el.dataset.line = String(line);
    });
  }
}

/** redraw the map and the node, not the inputs (the seed field keeps its caret) */
function runLabRedraw() {
  for (const el of document.querySelectorAll('[data-runlab-out]')) el.innerHTML = runLabOutHTML();
  runLabLogicSoon();
}
/** the logic worker's part a little after the map (it copies the whole data: not on every key typed) */
const runLabLogicSoon = () => {
  clearTimeout(runLab.logicT);
  runLab.logicT = setTimeout(runLabLogicFill, 150);
};
const runLabSoon = () => {
  clearTimeout(runLab.redrawT);
  runLab.redrawT = setTimeout(runLabRedraw, 30);
};

SECTIONS.runlab = () => {
  /* the logic worker's part fills in once the section is on the page */
  setTimeout(() => {
    runLabLogicFill();
    runLabCodeLines();
  });
  const opt = (/** @type {string} */ v, /** @type {string} */ l) =>
    `<option value="${v}"${runLab.unlocks === v ? ' selected' : ''}>${l}</option>`;
  return (
    card(
      'Run Lab',
      `<p class="help">A run’s map from its seed, made by the game’s own start (<code>runStartPlan</code>, the one taking off from the mast uses) on the data as it is now, unsaved changes included. Read-only.</p>
<div class="rl-inputs">
<label class="fld"><span>Seed</span><input id="rlSeed" data-rl="seed" value="${escapeHtml(runLab.seed)}" maxlength="20" spellcheck="false"></label>
<button class="btn" data-act="runLabRoll" title="A new seed">🎲</button>
<label class="fld"><span>Unlocks</span><select id="rlUnlocks" data-rl="unlocks">${opt('none', 'None (a fresh save)')}${opt('all', 'All')}${runLab.logUnlocks.length || runLab.unlocks === 'log' ? opt('log', `The debug log’s (${runLab.logUnlocks.length})`) : ''}</select></label>
<label class="chk"><input type="checkbox" id="rlShort" data-rl="short"${runLab.short ? ' checked' : ''}> Short map (the debug menu’s)</label>
<label class="chk"><input type="checkbox" id="rlBeside" data-rl="beside"${runLab.beside ? ' checked' : ''}> Beside the loaded data</label>
<button class="btn" data-act="runLabPaste">Paste a debug log…</button>
<button class="btn" data-act="runLabCopy">Copy seed + data version</button>
<button class="btn primary" data-act="runLabPlay" title="Opens the game in a test run on this seed, with your unsaved changes; nothing there is saved">▶ Play this seed</button>
</div>${runLab.logNote ? `<p class="help rl-log-note">${escapeHtml(runLab.logNote)}</p>` : ''}`
    ) +
    `<div class="rl-side">${card('Map', `<div data-runlab-out>${runLabOutHTML()}</div>`, { cls: 'rl-map-card' })}${card('Run rules', runLabRulesHTML(), { cls: 'rl-rules' })}</div>` +
    /* Studio plan T3.4: the run simulation, Base against Draft (run-lab-sim.js) */
    card('Simulate', runLabSimHTML(), { cls: 'rl-sim' })
  );
};

document.addEventListener('input', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el || !el.dataset) return;
  if (el.dataset.rl) {
    const k = el.dataset.rl;
    if (k === 'seed') {
      const v = runLabSeedClean(el.value);
      if (!v) return;
      runLab.seed = v;
    } else if (k === 'unlocks') runLab.unlocks = /** @type {any} */ (el.value);
    else if (k === 'short') runLab.short = el.checked;
    else if (k === 'beside') runLab.beside = el.checked;
    runLab.pick = -1;
    runLabSoon();
  } else if (el.dataset.p && sectionShown('runlab')) runLabSoon();
});
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  /* the shop's always-stocked wares: a list, so a box of its own */
  if (el && el.dataset && el.dataset.rlAlways) {
    const A = studioState.D.rules.run.shop.always,
      id = el.dataset.rlAlways;
    if (el.checked && !A.includes(id)) A.push(id);
    else if (!el.checked && A.includes(id)) A.splice(A.indexOf(id), 1);
    changed();
    runLabSoon();
    return;
  }
  if (el && el.dataset && el.dataset.p && sectionShown('runlab')) runLabSoon();
});

ACTIONS.runLabPick = (/** @type {{ i: string }} */ d) => {
  runLab.pick = +d.i;
  runLabRedraw();
};
ACTIONS.runLabRoll = () => {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let s = '';
  for (let k = 0; k < 10; k++) s += A[Math.floor(Math.random() * A.length)];
  runLab.seed = s;
  runLab.pick = -1;
  render();
};
/** a debug log's run seed and unlocks: the run's own (debug-log.js state.run.unlocks, T2.6), else the save's
 * (state.meta.unlocks, which a log taken after buying one mid-run has more of) @param {string} text */
function runLabReadLog(text) {
  let log = null;
  try {
    log = JSON.parse(text);
  } catch (e) {}
  const st = (log && log.state) || {},
    seed = (st.run && st.run.seed) || ((/"seed"\s*:\s*"([^"]+)"/.exec(text) || [])[1] ?? ''),
    own = st.run && Array.isArray(st.run.unlocks),
    unlocks = own
      ? st.run.unlocks
      : (st.meta && st.meta.unlocks) || JSON.parse(`[${(/"unlocks"\s*:\s*\[([^\]]*)\]/.exec(text) || [])[1] || ''}]`),
    nodes = st.run && st.run.nodes;
  return { seed: runLabSeedClean(seed), unlocks: Array.isArray(unlocks) ? unlocks.map(String) : [], nodes, own };
}
ACTIONS.runLabPaste = async () => {
  const text = await dialog(
    'Paste a debug log',
    '<label class="fld"><span>The debug log (its text, or just the part with the run)</span><textarea id="rlLog" rows="8" spellcheck="false"></textarea></label><p class="help">Its run’s seed and the save’s unlocks are read; nothing else is kept.</p>',
    [
      { l: 'Cancel', v: null },
      { l: 'Read', c: 'primary', f: () => /** @type {HTMLTextAreaElement} */ ($('#rlLog')).value },
    ]
  );
  if (!text) return;
  let got;
  try {
    got = runLabReadLog(text);
  } catch (e) {
    got = null;
  }
  if (!got || !got.seed) return toast('No run seed in that text (a debug log taken on a run has one).', 'bad');
  runLab.seed = got.seed;
  runLab.logUnlocks = got.unlocks;
  runLab.unlocks = 'log';
  runLab.pick = -1;
  runLab.logNote = got.own
    ? `From a debug log: seed ${got.seed}, the run’s ${got.unlocks.length} unlock(s)${got.nodes ? `, ${got.nodes} places` : ''}. A short map isn’t logged: tick it if the run had ${RUN_LAB_SHORT.rows} rows.`
    : `From a debug log: seed ${got.seed}, ${got.unlocks.length} unlock(s) on the save${got.nodes ? `, its run had ${got.nodes} places` : ''}. This log is older than the run’s own unlocks: it has the save’s now, not the run’s at take-off; a short map isn’t logged.`;
  render();
};
/** T2.6: the game's address for this seed (logic/run-test.js): the Lab's unlocks and short map, the Studio's unsaved
 * data first (&draft=1, sent on the live channel: game data only) */
function runLabPlayUrl() {
  const u = runLab.unlocks === 'log' ? runLab.logUnlocks.map(encodeURIComponent).join(',') || 'none' : runLab.unlocks;
  return `../game/index.html?debug&run=${encodeURIComponent(runLab.seed)}&unlocks=${u}${runLab.short ? '&short=1' : ''}&draft=1`;
}
ACTIONS.runLabOpenSeed = (/** @type {{ seed: string }} */ d) => {
  runLab.seed = runLabSeedClean(d.seed);
  runLab.pick = -1;
  render();
};
ACTIONS.runLabPlay = () => {
  window.open(runLabPlayUrl(), 'networth-game');
};
ACTIONS.runLabCopy = () => {
  const D = studioState.D,
    text = `run seed ${runLab.seed}; unlocks ${runLab.unlocks === 'log' ? runLab.logUnlocks.join(',') || 'none' : runLab.unlocks}${runLab.short ? '; short map' : ''}; data v${(D.meta && D.meta.version) || '?'}${githubMode.base ? ' at ' + githubMode.base.slice(0, 7) : ''}${studioState.dirty ? ' with unsaved changes' : ''}`;
  try {
    navigator.clipboard.writeText(text).then(
      () => toast('Copied: ' + text),
      () => toast(text)
    );
  } catch (e) {
    toast(text);
  }
};
