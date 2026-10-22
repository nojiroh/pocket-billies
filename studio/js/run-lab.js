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
   An edit made in the other pane redraws the map (the game's map code takes well under a millisecond). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $ } from '../../game/js/util.js';
import { runBack, runMapRows, runNodeSeed, runWorldNode } from '../../game/js/logic/run-map.js';
import { runUnlocks } from '../../game/js/logic/unlocks.js';
import { runStartPlan } from '../../game/js/logic/run-start.js';
import { escapeHtml } from './game-stand-ins.js';
import { ACTIONS, SECTIONS, card, dialog, render, sectionShown, studioState, toast } from './studio-app.js';
import { githubMode } from './github.js';
/* eslint-disable no-func-assign */
expose({
  RUN_LAB_ROLE: [() => RUN_LAB_ROLE],
  RUN_LAB_SHORT: [() => RUN_LAB_SHORT],
  RUN_LAB_TYPE_COLOUR: [() => RUN_LAB_TYPE_COLOUR],
  runLab: [() => runLab],
  runLabBiomeColour: [() => runLabBiomeColour],
  runLabFigures: [() => runLabFigures, v => (runLabFigures = v)],
  runLabNodeHTML: [() => runLabNodeHTML, v => (runLabNodeHTML = v)],
  runLabOutHTML: [() => runLabOutHTML, v => (runLabOutHTML = v)],
  runLabPlan: [() => runLabPlan, v => (runLabPlan = v)],
  runLabReadLog: [() => runLabReadLog, v => (runLabReadLog = v)],
  runLabRedraw: [() => runLabRedraw, v => (runLabRedraw = v)],
  runLabSeedClean: [() => runLabSeedClean],
  runLabSoon: [() => runLabSoon],
  runLabSvg: [() => runLabSvg, v => (runLabSvg = v)],
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
    };
    return {
      plan: runStartPlan(runLab.seed, data, {
        unlocks: runLabUnlocks(D),
        map: runLab.short ? RUN_LAB_SHORT : undefined,
      }),
      roles: runMapRows({ ...D.rules.run.map, ...(runLab.short ? RUN_LAB_SHORT : {}) }),
    };
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
    .join('')}</div>${runLabNodeHTML(D, now.plan, now.roles, runLab.pick)}`;
}
/** redraw the map and the node, not the inputs (the seed field keeps its caret) */
function runLabRedraw() {
  for (const el of document.querySelectorAll('[data-runlab-out]')) el.innerHTML = runLabOutHTML();
}
const runLabSoon = () => {
  clearTimeout(runLab.redrawT);
  runLab.redrawT = setTimeout(runLabRedraw, 30);
};

SECTIONS.runlab = () => {
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
</div>${runLab.logNote ? `<p class="help rl-log-note">${escapeHtml(runLab.logNote)}</p>` : ''}`
    ) + card('Map', `<div data-runlab-out>${runLabOutHTML()}</div>`)
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
/** a debug log's run seed and the save's unlocks (debug-log.js: state.run.seed, state.meta.unlocks) @param {string} text */
function runLabReadLog(text) {
  let log = null;
  try {
    log = JSON.parse(text);
  } catch (e) {}
  const st = (log && log.state) || {},
    seed = (st.run && st.run.seed) || ((/"seed"\s*:\s*"([^"]+)"/.exec(text) || [])[1] ?? ''),
    unlocks =
      (st.meta && st.meta.unlocks) || JSON.parse(`[${(/"unlocks"\s*:\s*\[([^\]]*)\]/.exec(text) || [])[1] || ''}]`),
    nodes = st.run && st.run.nodes;
  return { seed: runLabSeedClean(seed), unlocks: Array.isArray(unlocks) ? unlocks.map(String) : [], nodes };
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
  runLab.logNote = `From a debug log: seed ${got.seed}, ${got.unlocks.length} unlock(s) on the save${got.nodes ? `, its run had ${got.nodes} places` : ''}. The log has the save’s unlocks now, not the run’s at take-off; a short map isn't logged.`;
  render();
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
