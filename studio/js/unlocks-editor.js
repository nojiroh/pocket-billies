'use strict';
/* ================= UNLOCKS & HUB (Studio plan Phase 4, T4.2) =================
   unlocks.json, buildings.json and currencies.json (and the ranch's costs in rules.json ranch), the hub's side of a
   roguelite. What the JSON can't show:
   - the graph (logic/unlock-graph.js unlockGraph), drawn in SVG: a column per building with the rows sold there, their
     cost in its currency's colour, the earned rows apart, an arrow from each row a row needs to it; click one to edit;
   - a `requires` edit that would close a circle is refused, and the message names the path (unlockCycle);
   - what a new save has after some runs, wins and catches (unlockSaveAfter: the game's unlockAuto, unlockReady,
     runUnlocks and unlockOpen): the rows it has earned, its currencies and building levels, what it can buy, and the
     biomes and wares a run can draw; the graph shades what it owns;
   - data-checks.js dataUnlocks, dataBuildings and dataCurrencies's messages beside what they are about.
   Edits are ordinary fields; a row's door (sold or earned) and grant are changed by their own selects, which put
   that kind's fields in. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { escapeHtml } from './game-stand-ins.js';
import { unlockCycle, unlockGraph, unlockSaveAfter } from '../../game/js/logic/unlock-graph.js';
import { dataBuildings, dataCurrencies, dataUnlocks } from '../../game/js/logic/data-checks.js';
import {
  ACTIONS,
  SECTIONS,
  ask,
  card,
  changed,
  checkboxField,
  grid,
  numberField,
  render,
  selectField,
  studioState,
  textField,
  toast,
  uniqueKey,
} from './studio-app.js';
import { conditionField } from './story-editor.js';
/* eslint-disable no-func-assign */
expose({
  UG_GAP_X: [() => UG_GAP_X],
  UG_GAP_Y: [() => UG_GAP_Y],
  UG_H: [() => UG_H],
  UG_TOP: [() => UG_TOP],
  UG_W: [() => UG_W],
  UNLOCK_GRANTS: [() => UNLOCK_GRANTS],
  unlockCurName: [() => unlockCurName],
  unlockEd: [() => unlockEd],
  unlockErrHTML: [() => unlockErrHTML],
  unlockGrantKind: [() => unlockGrantKind],
  unlockGrantNew: [() => unlockGrantNew, v => (unlockGrantNew = v)],
  unlockGraphSvg: [() => unlockGraphSvg, v => (unlockGraphSvg = v)],
  unlockProblems: [() => unlockProblems, v => (unlockProblems = v)],
  unlockRowHTML: [() => unlockRowHTML, v => (unlockRowHTML = v)],
  unlockSaveHTML: [() => unlockSaveHTML, v => (unlockSaveHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const unlockEd = { runs: 0, wins: 0, caught: 0, refused: '' };
const UG_W = 206,
  UG_H = 46,
  UG_GAP_X = 26,
  UG_GAP_Y = 14,
  UG_TOP = 30;
/** the grant kinds, and a new grant of each */
const UNLOCK_GRANTS = {
  building: 'A building’s level',
  shop: 'An item in run shops',
  biome: 'A biome on run maps',
  capital: 'Capital',
  scrap: 'Scrap',
  seals: 'Audit Seals',
};
const unlockGrantKind = (/** @type {any} */ G) => Object.keys(UNLOCK_GRANTS).find(k => G && k in G) || 'capital';
function unlockGrantNew(/** @type {string} */ kind) {
  const D = studioState.D;
  if (kind === 'building') {
    const b = Object.keys(D.buildings).find(k => D.buildings[k].levels > 1) || Object.keys(D.buildings)[0];
    return { building: b, level: 2 };
  }
  if (kind === 'shop') return { shop: Object.keys(D.rules.run.shop.pick)[0] };
  if (kind === 'biome') return { biome: Object.keys(D.rules.run.map.biomes)[0] };
  return { [kind]: 10 };
}
/** the three families' messages, as CI runs them */
function unlockProblems() {
  const D = studioState.D,
    out = [];
  for (const f of [dataUnlocks, dataBuildings, dataCurrencies])
    try {
      out.push(...f(D).map(([file, m]) => ({ f: file, m })));
    } catch (e) {
      out.push({ f: 'unlocks.json', m: `the check stopped: ${e.message || e}` });
    }
  return out;
}
const unlockErrHTML = (/** @type {{ f: string, m: string }[]} */ P) =>
  P.map(p => `<p class="err run-err">${escapeHtml(p.f)}: ${escapeHtml(p.m)}</p>`).join('');
const unlockCurName = (/** @type {string | null} */ c) =>
  c ? (studioState.D.currencies[c] || {}).name || c : 'earned';

/** the graph as SVG; the selected row ringed, the owned ones shaded, one with a problem outlined red */
function unlockGraphSvg(
  /** @type {any} */ g,
  /** @type {string} */ sel,
  /** @type {Set<string>} */ owned,
  /** @type {Set<string>} */ bad
) {
  const cols = g.cols.filter(
      (/** @type {any} */ c) => g.nodes.some((/** @type {any} */ n) => n.col === c.id) || c.id !== 'earned'
    ),
    colX = Object.fromEntries(cols.map((/** @type {any} */ c, i) => [c.id, 10 + i * (UG_W + UG_GAP_X)])),
    /** @type {Record<string, { x: number, y: number }>} */
    at = {},
    per = /** @type {Record<string, number>} */ ({});
  for (const n of [...g.nodes].sort((a, b) => a.depth - b.depth || a.at - b.at)) {
    const i = (per[n.col] = (per[n.col] ?? -1) + 1);
    at[n.id] = { x: colX[n.col], y: UG_TOP + i * (UG_H + UG_GAP_Y) };
  }
  const W = 20 + cols.length * (UG_W + UG_GAP_X),
    H = UG_TOP + Math.max(1, ...Object.values(per).map(v => v + 1)) * (UG_H + UG_GAP_Y) + 10,
    edges = g.edges
      .map((/** @type {any} */ e) => {
        const a = at[e.from],
          b = at[e.to];
        if (!a || !b) return '';
        const same = a.x === b.x,
          x1 = same ? a.x + UG_W - 14 : a.x + UG_W,
          y1 = same ? a.y + UG_H : a.y + UG_H / 2,
          x2 = same ? b.x + UG_W - 14 : b.x,
          y2 = same ? b.y : b.y + UG_H / 2,
          d = same
            ? `M${x1},${y1} C${x1 + 24},${y1 + 10} ${x2 + 24},${y2 - 10} ${x2},${y2}`
            : `M${x1},${y1} C${x1 + 20},${y1} ${x2 - 20},${y2} ${x2},${y2}`;
        return `<path class="ug-edge" d="${d}" marker-end="url(#ugArrow)" data-edge="${escapeHtml(e.from)}>${escapeHtml(e.to)}"/>`;
      })
      .join(''),
    heads = cols
      .map(
        (/** @type {any} */ c) =>
          `<text class="ug-col" x="${colX[c.id]}" y="18">${escapeHtml(c.name)}${c.id === 'earned' ? '' : ` · ${escapeHtml(unlockCurName(c.currency))}`}${c.soon ? ' (later)' : ''}</text>`
      )
      .join(''),
    nodes = g.nodes
      .map((/** @type {any} */ n) => {
        const p = at[n.id],
          G = n.grant,
          gives = G.building
            ? `→ ${G.building} Lv ${G.level}`
            : G.shop
              ? `→ shop: ${G.shop}`
              : G.biome
                ? `→ biome: ${G.biome}`
                : Object.entries(G)
                    .map(([k, v]) => `+${v} ${k}`)
                    .join(' '),
          cost =
            n.door === 'earned'
              ? (studioState.D.unlocks[n.id] || {}).when || ''
              : `${n.cost} ${unlockCurName(n.currency)}`;
        return `<g class="ug-node${n.id === sel ? ' on' : ''}${owned.has(n.id) ? ' owned' : ''}${bad.has(n.id) || n.lost ? ' bad' : ''}" data-act="pickUnlock" data-id="${escapeHtml(n.id)}" data-col="${escapeHtml(n.col)}" data-depth="${n.depth}" transform="translate(${p.x},${p.y})"><rect width="${UG_W}" height="${UG_H}" rx="7"/><circle class="ug-cur-${n.currency || 'none'}" cx="10" cy="12" r="5"/><text x="20" y="16">${escapeHtml(String(n.name).slice(0, 24))}</text><text x="8" y="36" class="ug-sub">${escapeHtml(String(cost).slice(0, 14))} ${escapeHtml(gives.slice(0, 18))}</text></g>`;
      })
      .join('');
  return `<svg class="ug-map" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="The unlock graph"><defs><marker id="ugArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>${heads}${edges}${nodes}</svg>`;
}

/** what a save has after the runs, wins and catches asked */
function unlockSaveHTML(/** @type {any} */ S) {
  const D = studioState.D,
    U = D.unlocks,
    name = (/** @type {string} */ id) => escapeHtml((U[id] || {}).name || id),
    buy = Object.entries(S.why)
      .filter(([, w]) => w === null)
      .map(([id]) => name(id)),
    soon = Object.entries(S.why)
      .filter(([, w]) => w === 'cost')
      .map(([id]) => `${name(id)} (${U[id].cost} ${escapeHtml(unlockCurName(D.buildings[U[id].at].currency))})`);
  return `<table class="tbl ug-save" data-owned="${escapeHtml(S.owned.join(','))}">${[
    ['Earned', S.earned.map(name).join(', ') || 'nothing'],
    [
      'Currencies',
      Object.entries(S.currencies)
        .map(([c, v]) => `${v} ${escapeHtml(unlockCurName(c))}`)
        .join(', '),
    ],
    [
      'Buildings',
      Object.entries(S.buildings)
        .map(([b, l]) => `${escapeHtml((D.buildings[b] || {}).name || b)} Lv ${l}`)
        .join(', '),
    ],
    ['Can buy now', buy.join(', ') || 'nothing'],
    ['Needs more of its currency', soon.join(', ') || 'nothing'],
    [
      'Run maps draw',
      S.biomes.map((/** @type {string} */ b) => escapeHtml((D.biomes[b] || {}).name || b)).join(', ') ||
        '<span class="err">no biome</span>',
    ],
    ['Run shops draw', S.shop.map((/** @type {string} */ k) => escapeHtml((D.items[k] || {}).n || k)).join(', ')],
  ]
    .map(([h, v]) => `<tr><th>${h}</th><td>${v}</td></tr>`)
    .join('')}</table>`;
}

/** the selected row's fields */
function unlockRowHTML(/** @type {string} */ id, /** @type {{ f: string, m: string }[]} */ P) {
  const D = studioState.D,
    R = D.unlocks[id],
    p = `unlocks.${id}`,
    door = R.when ? 'earned' : 'sold',
    gk = unlockGrantKind(R.grant),
    gp = `${p}.grant`,
    grant =
      {
        building: () => [
          selectField(
            'Building',
            `${gp}.building`,
            Object.entries(D.buildings).map(([k, b]) => [k, b.name || k])
          ),
          numberField('To level', `${gp}.level`, { min: 2, max: 20, step: 1 }),
        ],
        shop: () => [
          selectField(
            'Item',
            `${gp}.shop`,
            Object.keys(D.rules.run.shop.pick).map(k => [k, (D.items[k] || {}).n || k])
          ),
        ],
        biome: () => [
          selectField(
            'Biome',
            `${gp}.biome`,
            Object.keys(D.rules.run.map.biomes).map(k => [k, (D.biomes[k] || {}).name || k])
          ),
        ],
      }[gk] || (() => [numberField(`${UNLOCK_GRANTS[gk]} given`, `${gp}.${gk}`, { min: 1, step: 1 })]),
    others = Object.keys(D.unlocks).filter(k => k !== id),
    mine = P.filter(x => x.f === 'unlocks.json' && (x.m.startsWith(id + '.') || x.m.startsWith(id + ':')));
  return card(
    `<span class="mono">${escapeHtml(id)}</span> ${escapeHtml(R.name || id)}`,
    grid(
      textField('Name', `${p}.name`),
      `<label class="fld"><span>Got by</span><select data-ug-door="${escapeHtml(id)}">${[
        ['sold', 'Bought at a building'],
        ['earned', 'Earned when a condition holds'],
      ]
        .map(([v, l]) => `<option value="${v}"${v === door ? ' selected' : ''}>${l}</option>`)
        .join('')}</select></label>`,
      ...(door === 'sold'
        ? [
            selectField(
              'Sold at',
              `${p}.at`,
              Object.entries(D.buildings).map(([k, b]) => [k, `${b.name || k} (${unlockCurName(b.currency)})`]),
              { rr: 1 }
            ),
            numberField(
              `Cost (${escapeHtml(unlockCurName((D.buildings[R.at] || {}).currency || null))})`,
              `${p}.cost`,
              {
                min: 0,
                step: 1,
              }
            ),
          ]
        : [
            conditionField('Earned when', `${p}.when`, 'unlock:' + id, 'when', {
              ph: 'runs >= 1',
              help: 'A condition (docs/SCRIPTS.md): runs, wins, caught, unlock:<id>…; checked in the hub after a run and on load.',
            }),
          ]),
      `<label class="fld"><span>Gives</span><select data-ug-grant="${escapeHtml(id)}">${Object.entries(UNLOCK_GRANTS)
        .map(([v, l]) => `<option value="${v}"${v === gk ? ' selected' : ''}>${l}</option>`)
        .join('')}</select></label>`,
      ...grant()
    ) +
      textField('About (what the board says)', `${p}.about`, { area: 1, rows: 2 }) +
      `<p class="help">Needs first (an arrow from each into this one):</p><div class="chips ug-req">${others
        .map(
          k =>
            `<label class="chk-chip"><input type="checkbox" data-ug-req="${escapeHtml(id)}" value="${escapeHtml(k)}"${(R.requires || []).includes(k) ? ' checked' : ''}> ${escapeHtml(D.unlocks[k].name || k)}</label>`
        )
        .join(
          ''
        )}</div>${unlockEd.refused ? `<p class="err ug-refused">${escapeHtml(unlockEd.refused)}</p>` : ''}${unlockErrHTML(mine)}`,
    { acts: `<button class="btn danger subtle" data-act="unlockDel" data-k="${escapeHtml(id)}">Delete</button>` }
  );
}

SECTIONS.unlocks = () => {
  const D = studioState.D,
    U = (D.unlocks = D.unlocks || {}),
    ks = Object.keys(U);
  if (!U[studioState.sel.unlock]) studioState.sel.unlock = ks[0];
  const id = studioState.sel.unlock,
    P = unlockProblems(),
    g = unlockGraph(D),
    S = unlockSaveAfter(D, unlockEd),
    bad = new Set(
      ks.filter(k => P.some(x => x.f === 'unlocks.json' && (x.m.startsWith(k + '.') || x.m.startsWith(k + ':'))))
    ),
    general = P.filter(
      x => x.f === 'unlocks.json' && !ks.some(k => x.m.startsWith(k + '.') || x.m.startsWith(k + ':'))
    ),
    num = (/** @type {string} */ k, /** @type {string} */ l, max = 1000) =>
      `<label class="fld"><span>${l}</span><input type="number" min="0" max="${max}" step="1" data-ug-ed="${k}" value="${unlockEd[k]}"></label>`;
  const buildings = Object.keys(D.buildings || {})
    .map(b => {
      const p = `buildings.${b}`;
      return `<h4><span class="mono">${escapeHtml(b)}</span> ${escapeHtml(D.buildings[b].name || b)}</h4>${grid(
        textField('Name', `${p}.name`),
        selectField(
          'Paid in',
          `${p}.currency`,
          Object.keys(D.currencies)
            .filter(c => D.currencies[c].kept === 'meta')
            .map(c => [c, unlockCurName(c)]),
          { rr: 1 }
        ),
        numberField('Levels', `${p}.levels`, { min: 1, max: 20, step: 1 }),
        textField('Hub prop act', `${p}.act`, { opt: 1, help: 'The act of the Copperleaf prop that opens it.' }),
        checkboxField('Coming later (sells nothing yet)', `${p}.soon`, { rr: 1 })
      )}${textField('About', `${p}.about`, { area: 1, rows: 2 })}`;
    })
    .join('');
  const ranch = D.rules.ranch
    ? `<h4>The ranch’s costs (rules.json ranch, in Scrap)</h4>${grid(
        numberField('A Billie put in training', 'rules.ranch.trainCost', { min: 0, step: 1 }),
        numberField('A safe breeding', 'rules.ranch.breed.safeCost', { min: 0, step: 1 }),
        numberField('A risky breeding', 'rules.ranch.breed.riskyCost', { min: 0, step: 1 })
      )}`
    : '';
  const currencies = Object.keys(D.currencies || {})
    .map(c => {
      const p = `currencies.${c}`;
      return `<h4><span class="mono">${escapeHtml(c)}</span> <span class="run-tag">${D.currencies[c].kept === 'run' ? 'the run’s: turned into Capital at the payout' : 'kept between runs'}</span></h4>${grid(
        textField('Name', `${p}.name`),
        textField('One of it', `${p}.one`),
        textField('Icon', `${p}.icon`)
      )}${textField('About', `${p}.about`, { area: 1, rows: 2 })}`;
    })
    .join('');
  return `<div class="ed-col solo"><div class="ed-head"><div><h2>Unlocks & hub</h2><p class="sub">unlocks.json, buildings.json and currencies.json: what the hub sells and what runs earn.</p></div><button class="btn primary" data-act="unlockNew">+ New unlock</button></div>
 ${card(
   'The unlock graph',
   `<div class="ug-scroll">${unlockGraphSvg(g, id, new Set(S.owned), bad)}</div><p class="help">A column per building, its rows in that building’s currency (the dot: gold Capital, grey Scrap, teal Seals, green earned); an arrow from each row a row needs. Shaded: what the save below owns. Click a row to edit it.</p>${unlockErrHTML(general)}`
 )}
 ${U[id] ? unlockRowHTML(id, P) : ''}
 ${card(
   'What a new save has',
   `${grid(num('runs', 'After runs'), num('wins', 'Of them won'), num('caught', 'Billies caught', 2000))}${unlockSaveHTML(S)}`,
   {
     sub: 'In the hub, nothing bought: the game’s own unlock code (unlockAuto, unlockReady, runUnlocks, unlockOpen) on your unsaved data.',
   }
 )}
 ${card('Buildings', buildings + ranch + unlockErrHTML(P.filter(x => x.f === 'buildings.json')), {
   sub: 'The hub’s buildings: each sells its unlock rows in its own currency; a level above 1 is a row of its own.',
 })}
 ${card('Currencies', currencies + unlockErrHTML(P.filter(x => x.f === 'currencies.json')), {
   sub: 'Money is the run’s; the others are kept between runs (the game reads each by its id).',
 })}</div>`;
};

/* "what a save has": not data, so it redraws only the page */
document.addEventListener('input', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset || !el.dataset.ugEd) return;
  unlockEd[el.dataset.ugEd] = Math.max(0, Math.round(+el.value) || 0);
});
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset) return;
  const D = studioState.D;
  /* later: a redraw while the number field still has focus would blur it mid-redraw */
  if (el.dataset.ugEd) return void setTimeout(render);
  if (el.dataset.ugReq) {
    /* a need: refused (and named) when it would close a circle */
    const id = el.dataset.ugReq,
      R = D.unlocks[id],
      now = (R.requires || []).filter(k => k !== el.value),
      want = el.checked ? [...now, el.value] : now,
      loop = el.checked ? unlockCycle(D.unlocks, id, want) : null;
    if (loop) {
      el.checked = false;
      unlockEd.refused = `Not added: ${id} would need itself, round the circle ${loop.join(' -> ')}.`;
      toast(unlockEd.refused);
      return render();
    }
    unlockEd.refused = '';
    if (want.length) R.requires = want;
    else delete R.requires;
    changed();
    return render();
  }
  if (el.dataset.ugDoor) {
    const R = D.unlocks[el.dataset.ugDoor];
    if (el.value === 'earned') {
      delete R.at;
      delete R.cost;
      R.when = R.when || 'runs >= 1';
    } else {
      delete R.when;
      R.at = R.at || Object.keys(D.buildings).find(b => !D.buildings[b].soon) || Object.keys(D.buildings)[0];
      R.cost = R.cost || 10;
    }
    changed();
    return render();
  }
  if (el.dataset.ugGrant) {
    D.unlocks[el.dataset.ugGrant].grant = unlockGrantNew(el.value);
    changed();
    return render();
  }
});
ACTIONS.pickUnlock = d => {
  studioState.sel.unlock = d.id;
  unlockEd.refused = '';
  render();
};
ACTIONS.unlockNew = () => {
  const D = studioState.D,
    k = uniqueKey('unlock', x => !!D.unlocks[x]),
    at = Object.keys(D.buildings).find(b => !D.buildings[b].soon) || 'lab';
  D.unlocks[k] = { name: 'New unlock', about: 'What it opens.', at, cost: 10, grant: { capital: 10 } };
  studioState.sel.unlock = k;
  changed();
  render();
};
ACTIONS.unlockDel = async d => {
  const D = studioState.D,
    k = d.k,
    by = Object.keys(D.unlocks).filter(x => (D.unlocks[x].requires || []).includes(k));
  if (
    !(await ask(
      `Delete ${escapeHtml(D.unlocks[k].name || k)}?${by.length ? ` It is no longer needed by ${escapeHtml(by.join(', '))}.` : ''} A save that owns it forgets it on load.`,
      'Delete'
    ))
  )
    return;
  delete D.unlocks[k];
  for (const x of by) {
    D.unlocks[x].requires = D.unlocks[x].requires.filter((/** @type {string} */ r) => r !== k);
    if (!D.unlocks[x].requires.length) delete D.unlocks[x].requires;
  }
  changed();
  render();
};
