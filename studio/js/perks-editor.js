'use strict';
/* ================= PERKS (Studio plan Phase 4, T4.1) =================
   perks.json, a run's Perks ("relic" is the data's word; the player and this page say Perk), and the rules
   that offer them (rules.json run.perks). What the JSON can't show:
   - each effect row by its kind (logic/effects.js FX_KINDS), with the limits that live in the code (FX_LIMIT for a
     factor, FX_STAGES for stages) beside the field, and data-checks.js dataPerks's messages on the row they are about;
   - the rarity table's coverage: each rarity's weight and price, how many Perks have it, and a Perk's chance to
     be drawn first (its weight over the pool's);
   - the effect on a sample build: the game's fx functions on a Billie made by rules.js (logic/content-preview.js
     perkPreview, in the Studio's logic worker on the data as it is now), with stats before and after;
   - the offer order for a seed: the picks after each mini-boss, as the game makes them (perks.js perkOfferOrder in
     the worker), taking nothing, the first offered, or this Perk when offered.
   Edits are ordinary fields (saved, undone and proposed like any other); a row's kind is changed by its own select,
   which puts that kind's fields in with neutral values. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { FX_LIMIT, FX_STAGES } from '../../game/js/logic/effects.js';
import { escapeHtml } from './game-stand-ins.js';
import { dataPerks } from '../../game/js/logic/data-checks.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  ask,
  card,
  changed,
  grid,
  numberField,
  render,
  selectField,
  speciesOptions,
  studioState,
  textField,
  uniqueKey,
} from './studio-app.js';
import { logicAsk } from './logic-client.js';
/* eslint-disable no-func-assign */
expose({
  PERK_KINDS: [() => PERK_KINDS],
  PERK_RARITIES: [() => PERK_RARITIES],
  PERK_ROW_NEW: [() => PERK_ROW_NEW],
  perkCoverage: [() => perkCoverage, v => (perkCoverage = v)],
  perkEd: [() => perkEd],
  perkFill: [() => perkFill, v => (perkFill = v)],
  perkFillSoon: [() => perkFillSoon, v => (perkFillSoon = v)],
  perkOffersHTML: [() => perkOffersHTML, v => (perkOffersHTML = v)],
  perkPair: [() => perkPair],
  perkPct: [() => perkPct],
  perkPreviewHTML: [() => perkPreviewHTML, v => (perkPreviewHTML = v)],
  perkProblemHTML: [() => perkProblemHTML],
  perkProblems: [() => perkProblems],
  perkRarityHTML: [() => perkRarityHTML, v => (perkRarityHTML = v)],
  perkRowHTML: [() => perkRowHTML, v => (perkRowHTML = v)],
  perkX: [() => perkX],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const perkEd = {
  sp: '',
  lvl: 30,
  /** the other Perks held with the one being edited, for the preview */
  also: /** @type {string[]} */ ([]),
  seed: 'LAB1',
  take: 'none',
  picks: 0,
  n: 0,
  t: 0,
};
/** what each kind of row means, and the fields it has */
const PERK_KINDS = {
  money: 'A won battle pays more (or less) Moneys',
  price: 'A run shop’s prices, or a run town’s clinic',
  catch: 'A coin’s chance to catch',
  stat: 'Stat stages as a battle starts',
  damage: 'Damage your Billies deal or take',
  heal: 'Heal a share of HP on walking into a place',
  payout: 'The payout’s Research, or the share items count at',
  dna: 'A Gene Sample’s DNA (SP-6)',
  splice: 'How often wild Billies are spliced (SP-6)',
  unstable: 'The HP Unstable splices lose at each turn’s end (SP-6)',
};
/** a new row of a kind: its fields with values that change little */
const PERK_ROW_NEW = {
  money: () => ({ kind: 'money', mult: 1.1 }),
  price: () => ({ kind: 'price', what: 'shop', mult: 0.9 }),
  catch: () => ({ kind: 'catch', mult: 1.1 }),
  stat: () => ({ kind: 'stat', stat: 'lev', stages: 1 }),
  damage: () => ({ kind: 'damage', side: 'deal', mult: 1.1 }),
  heal: () => ({ kind: 'heal', share: 0.1 }),
  payout: () => ({ kind: 'payout', what: 'research', mult: 1.1 }),
  dna: () => ({ kind: 'dna', mult: 1.1 }),
  splice: () => ({ kind: 'splice', mult: 1.1 }),
  unstable: () => ({ kind: 'unstable', mult: 0.9 }),
};
const PERK_RARITIES = ['common', 'uncommon', 'rare'];

/** the data checks' messages about perks.json and rules.json run.perks (dataPerks, as CI runs it) */
const perkProblems = () => {
  try {
    return dataPerks(studioState.D).map(([f, m]) => ({ f, m }));
  } catch (e) {
    return [{ f: 'perks.json', m: `the check stopped: ${e.message || e}` }];
  }
};
/** the messages that start with `pre` (a Perk's or a row's), as error lines */
const perkProblemHTML = (/** @type {{ f: string, m: string }[]} */ P, /** @type {string} */ pre, skip = '') =>
  P.filter(p => p.f === 'perks.json' && p.m.startsWith(pre) && !(skip && p.m.startsWith(skip)))
    .map(p => `<p class="err relic-err">${escapeHtml(p.m)}</p>`)
    .join('');
/** each rarity's weight and how many Perks have it, and each Perk's chance to be drawn first */
function perkCoverage(/** @type {any} */ D) {
  const RR = D.rules.run.perks,
    ids = Object.keys(D.perks || {}),
    w = id => RR.rarity[D.perks[id].rarity] || 0,
    total = ids.reduce((a, id) => a + w(id), 0);
  return {
    total,
    chance: Object.fromEntries(ids.map(id => [id, total ? w(id) / total : 0])),
    count: Object.fromEntries(PERK_RARITIES.map(r => [r, ids.filter(id => D.perks[id].rarity === r).length])),
  };
}
const perkPct = (/** @type {number} */ v) => `${Math.round(v * 1000) / 10}%`;

/** one effect row's fields, by its kind */
function perkRowHTML(/** @type {string} */ k, /** @type {any} */ f, /** @type {number} */ n, /** @type {any} */ P) {
  const D = studioState.D,
    p = `perks.${k}.fx.${n}`,
    lim = `×${FX_LIMIT.lo} to ×${FX_LIMIT.hi} (effects.js FX_LIMIT; a kind’s rows multiply, and the product stays within it too)`,
    mult = (/** @type {string} */ l) =>
      numberField(l, `${p}.mult`, { min: FX_LIMIT.lo, max: FX_LIMIT.hi, step: 0.05, help: lim }),
    stats = (D.stats || [])
      .filter((/** @type {any} */ s) => s.id !== 'hp')
      .map((/** @type {any} */ s) => [s.id, s.name]),
    fields = {
      money: () => [mult('Moneys ×')],
      price: () => [
        selectField('Which price', `${p}.what`, [
          ['shop', 'A run shop’s wares'],
          ['heal', 'A run town’s clinic'],
        ]),
        mult('Price ×'),
      ],
      catch: () => [mult('Catch chance × (never past 100%)')],
      stat: () => [
        selectField('Stat', `${p}.stat`, stats),
        numberField('Stages', `${p}.stages`, {
          min: -FX_STAGES,
          max: FX_STAGES,
          step: 1,
          help: `−${FX_STAGES} to +${FX_STAGES} (effects.js FX_STAGES; the battle clamps again to its own stage limit). +1 is ×1.5, −1 is ×⅔.`,
        }),
      ],
      damage: () => [
        selectField('Side', `${p}.side`, [
          ['deal', 'What your Billies deal'],
          ['take', 'What your Billies take'],
        ]),
        selectField(
          'Moves of the category',
          `${p}.cat`,
          [
            ['H', 'Physical (H)'],
            ['S', 'Special (S)'],
          ],
          { none: 'Any', opt: 1 }
        ),
        selectField(
          'Moves of the type',
          `${p}.type`,
          D.types.map((/** @type {any} */ t) => [t.id, t.id]),
          { none: 'Any', opt: 1 }
        ),
        mult('Damage ×'),
      ],
      heal: () => [
        numberField('Share of HP healed', `${p}.share`, {
          min: 0.01,
          max: 1,
          step: 0.01,
          help: 'Above 0, at most 1. Rows add up; the total stays at most 1.',
        }),
      ],
      payout: () => [
        selectField('Which', `${p}.what`, [
          ['research', 'The payout’s Research'],
          ['itemShare', 'The share of their price items count at (never above 1)'],
        ]),
        mult('×'),
      ],
      dna: () => [mult('Gene Sample DNA ×')],
      splice: () => [mult('Wild splice odds × (Graft and Chimera together never past 100%)')],
      unstable: () => [mult('Unstable turn-end hurt ×')],
    }[f.kind];
  return `<div class="relic-row" data-relic-row="${n}"><div class="relic-row-head"><select data-relic-kind="${escapeHtml(k)}" data-n="${n}" aria-label="Kind of effect">${Object.entries(
    PERK_KINDS
  )
    .map(([v, l]) => `<option value="${v}"${v === f.kind ? ' selected' : ''}>${v}: ${escapeHtml(l)}</option>`)
    .join(
      ''
    )}</select>${D.perks[k].fx.length > 1 ? `<button class="x" data-act="relicRowDel" data-k="${escapeHtml(k)}" data-n="${n}" title="Remove this effect">✕</button>` : ''}</div>${fields ? grid(...fields()) : `<p class="err">No such kind: ${escapeHtml(String(f.kind))}</p>`}${perkProblemHTML(P, `${k}.fx[${n}]`)}</div>`;
}

/** the rarity table: weights, prices, coverage, and the pick rules */
function perkRarityHTML(/** @type {any} */ D, /** @type {any} */ cov, /** @type {any} */ P) {
  const RR = D.rules.run.perks,
    rows = PERK_RARITIES.map(r => {
      const w = RR.rarity[r] || 0,
        c = cov.count[r],
        note =
          w > 0 && !c
            ? '<span class="warn">no Perk has it: its weight draws nothing</span>'
            : !w && c
              ? `<span class="warn">weight 0: its ${c} never offered</span>`
              : cov.total
                ? `each one ${perkPct(w / cov.total)} to be drawn first`
                : '';
      return `<tr data-rarity="${r}" data-count="${c}"><th>${r}</th><td>${numberField('', `rules.run.perks.rarity.${r}`, { min: 0, step: 1 })}</td><td>${numberField('', `rules.run.perks.price.${r}`, { min: 0, step: 10, unit: '$' })}</td><td>${c}</td><td>${note}</td></tr>`;
    }).join('');
  const rules = P.filter((/** @type {any} */ p) => p.f === 'rules.json')
    .map((/** @type {any} */ p) => `<p class="err">${escapeHtml(p.m)}</p>`)
    .join('');
  return card(
    'Rarity and the picks',
    `<table class="tbl relic-rarity"><thead><tr><th>Rarity</th><th>Weight</th><th>Shop price</th><th>Perks</th><th></th></tr></thead><tbody>${rows}</tbody></table>${grid(
      numberField('Held at most', 'rules.run.perks.cap', { min: 1, max: 12, step: 1 }),
      numberField('Offered at each pick', 'rules.run.perks.pick', { min: 1, max: 5, step: 1 })
    )}${rules}`,
    {
      sub: 'rules.json run.perks. A pick after each mini-boss draws this many by weight, none held; each run town’s shop has one a day at its rarity’s price.',
    }
  );
}

SECTIONS.relics = () => {
  const D = studioState.D,
    L = (D.perks = D.perks || {}),
    ks = Object.keys(L);
  if (!L[studioState.sel.relic]) studioState.sel.relic = ks[0];
  const k = studioState.sel.relic,
    R = L[k],
    P = perkProblems(),
    cov = perkCoverage(D);
  const list = ks
    .map(
      x =>
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="pickRelic" data-id="${escapeHtml(x)}"><span class="lt"><b>${escapeHtml(L[x].name || x)}${P.some(p => p.f === 'perks.json' && p.m.startsWith(x + '.')) ? ' <span class="warn">⚠</span>' : ''}</b><small>${escapeHtml(L[x].rarity)} · weight ${D.rules.run.perks.rarity[L[x].rarity] || 0} · ${perkPct(cov.chance[x])} first</small></span></button>`
    )
    .join('');
  const head = `<div class="list-head"><button class="btn primary" data-act="relicNew">+ New Perk</button></div>`;
  if (!R)
    return `<div class="split"><aside class="list-col">${head}</aside><div class="ed-col">${perkRarityHTML(D, cov, P)}</div></div>`;
  if (!perkEd.sp || !D.lines.some((/** @type {any} */ l) => perkEd.sp.startsWith(l.id)))
    perkEd.sp = D.lines[0].id + '1';
  perkEd.also = perkEd.also.filter(id => L[id] && id !== k);
  if (!perkEd.picks) perkEd.picks = Math.max(1, D.rules.run.map.minibosses || 1);
  const p = `perks.${k}`;
  afterRender(perkFillSoon);
  return `<div class="split"><aside class="list-col">${head}<div class="llist">${list}</div></aside>
 <div class="ed-col"><div class="ed-head"><div><small class="mono">${escapeHtml(k)}</small><h2>${escapeHtml(R.name || k)}</h2></div><button class="btn danger" data-act="relicDel">Delete</button></div>
 ${card(
   'The Perk',
   grid(
     textField('Name', `${p}.name`, { max: 40 }),
     selectField(
       'Rarity',
       `${p}.rarity`,
       PERK_RARITIES.map(r => [r, r]),
       { rr: 1 }
     )
   ) +
     textField('What it does (one sentence)', `${p}.d`, { area: 1, rows: 2, max: 160 }) +
     perkProblemHTML(P, `${k}.`, `${k}.fx[`),
   {
     sub: `${escapeHtml(R.rarity)}: ${perkPct(cov.chance[k])} to be drawn first at a pick; a shop asks ${D.rules.run.perks.price[R.rarity] || 0} Moneys.`,
   }
 )}
 ${card(
   'Effects',
   R.fx.map((f, n) => perkRowHTML(k, f, n, P)).join('') +
     (R.fx.length < 4 ? `<button class="btn" data-act="relicRowAdd">+ Add an effect</button>` : ''),
   {
     sub: 'One to four rows. Rows of one kind add up (stages, shares) or multiply (factors), in any order they were picked.',
   }
 )}
 ${card(
   'On a sample build',
   `${grid(
     `<label class="fld"><span>Billie</span><select data-relic-ed="sp">${speciesOptions()
       .map(
         ([v, n]) => `<option value="${escapeHtml(v)}"${v === perkEd.sp ? ' selected' : ''}>${escapeHtml(n)}</option>`
       )
       .join('')}</select></label>`,
     `<label class="fld"><span>Level</span><input type="number" min="1" max="100" step="1" data-relic-ed="lvl" value="${perkEd.lvl}"></label>`
   )}<p class="help">Held with it:</p><div class="chips">${ks
     .filter(x => x !== k)
     .map(
       x =>
         `<label class="chk-chip"><input type="checkbox" data-relic-also="${escapeHtml(x)}"${perkEd.also.includes(x) ? ' checked' : ''}> ${escapeHtml(L[x].name || x)}</label>`
     )
     .join('')}</div><div data-relic-preview><p class="help">The game’s logic is working it out…</p></div>`,
   { sub: 'The game’s own effect code (logic/effects.js) on your unsaved data, in the logic worker.' }
 )}
 ${card(
   'Offer order for a seed',
   `${grid(
     `<label class="fld"><span>Seed</span><input type="text" data-relic-ed="seed" value="${escapeHtml(perkEd.seed)}" maxlength="20"></label>`,
     `<label class="fld"><span>Picks</span><input type="number" min="1" max="12" step="1" data-relic-ed="picks" value="${perkEd.picks}"></label>`,
     `<label class="fld"><span>At each pick, take</span><select data-relic-ed="take">${[
       ['none', 'Nothing'],
       ['first', 'The first offered'],
       ['this', 'This Perk when offered'],
     ]
       .map(([v, l]) => `<option value="${v}"${perkEd.take === v ? ' selected' : ''}>${l}</option>`)
       .join('')}</select></label>`
   )}<div data-relic-offers><p class="help">The game’s logic is working it out…</p></div>`,
   {
     sub: 'The picks after each mini-boss on a run of this seed (perks.js), as the Run Lab shows them for the same seed with nothing taken. Shops are left out.',
   }
 )}
 ${perkRarityHTML(D, cov, P)}</div></div>`;
};

/** the preview and the offers, from the logic worker, a little after the last edit */
function perkFillSoon() {
  clearTimeout(perkEd.t);
  perkEd.t = setTimeout(perkFill, 120);
}
function perkFill() {
  const D = studioState.D,
    k = studioState.sel.relic;
  if (!D.perks || !D.perks[k]) return;
  const n = ++perkEd.n,
    pv = document.querySelector('[data-relic-preview]'),
    of = document.querySelector('[data-relic-offers]');
  if (pv)
    logicAsk('perkPreview', [k, ...perkEd.also], { sp: perkEd.sp, lvl: perkEd.lvl }).then(
      v => n === perkEd.n && pv.isConnected && ((pv.innerHTML = perkPreviewHTML(v)), (pv.dataset.ready = k)),
      e =>
        n === perkEd.n &&
        pv.isConnected &&
        (pv.innerHTML = `<p class="err">The game’s logic stopped: ${escapeHtml(e.message)}</p>`)
    );
  if (of)
    logicAsk(
      'perkOfferOrder',
      perkEd.seed,
      D.perks,
      D.rules.run.perks,
      perkEd.picks,
      perkEd.take === 'this' ? k : perkEd.take
    ).then(
      v =>
        n === perkEd.n && of.isConnected && ((of.innerHTML = perkOffersHTML(v, k)), (of.dataset.ready = perkEd.seed)),
      e =>
        n === perkEd.n &&
        of.isConnected &&
        (of.innerHTML = `<p class="err">The game’s logic stopped: ${escapeHtml(e.message)}</p>`)
    );
}
const perkX = (/** @type {number} */ v) => `×${Math.round(v * 1000) / 1000}`;
const perkPair = (/** @type {[number, number]} */ [a, b], pre = '$') =>
  a === b ? `${pre}${a}` : `${pre}${a} → <b>${pre}${b}</b>`;
/** perkPreview's answer as tables */
function perkPreviewHTML(/** @type {any} */ v) {
  const D = studioState.D,
    names = Object.fromEntries((D.stats || []).map((/** @type {any} */ s) => [s.id, s.name])),
    stats = v.stats
      .map(
        (/** @type {any} */ s) =>
          `<tr data-stat="${s.id}" data-after="${s.after}"><th>${escapeHtml(names[s.id] || s.id)}</th><td>${s.before}</td><td>${s.stage ? (s.stage > 0 ? '+' : '') + s.stage : ''}</td><td>${s.after === s.before ? s.after : `<b>${s.after}</b>`}</td></tr>`
      )
      .join(''),
    one = (/** @type {string} */ l, /** @type {string} */ x) => `<tr><th>${l}</th><td>${x}</td></tr>`,
    m = v.money,
    dm = v.damage;
  return `<div class="relic-prev"><table class="tbl"><thead><tr><th>${escapeHtml(v.sample.name)} Lv ${v.sample.lvl}</th><th>Before</th><th>Stages</th><th>As a battle starts</th></tr></thead><tbody>${stats}</tbody></table><table class="tbl relic-run">${[
    one('Wild prize at this level', perkPair(m.prize)),
    one('Mini-boss reward', perkPair(m.reward)),
    one(`Run shop: ${escapeHtml((D.items[v.price.ware] || {}).n || 'a ware')}`, perkPair(v.price.shop)),
    one('Clinic, a hurt Billie', perkPair(v.price.heal)),
    one('Catch chance', perkX(v.catch)),
    one('Damage dealt (physical / special)', `${perkX(dm.dealH)} / ${perkX(dm.dealS)}`),
    one('Damage taken', perkX(dm.take)),
    ...dm.types.map((/** @type {any} */ t) =>
      one(`${escapeHtml(t.type)} moves: dealt / taken`, `${perkX(t.deal)} / ${perkX(t.take)}`)
    ),
    one(
      'Healed walking into a place',
      v.heal.share ? `${perkPct(v.heal.share)} (${v.heal.hp} of ${v.sample.hp} HP)` : 'nothing'
    ),
    one('Payout: Research', perkX(v.payout.research)),
    one('Gene Sample DNA', perkX(v.splice.dna)),
    one('Wild splice odds', perkX(v.splice.odds)),
    one('Unstable turn-end hurt', perkX(v.splice.unstable)),
    one(
      'Payout: items count at',
      `${perkPct(v.payout.itemShare[0])}${v.payout.itemShare[1] !== v.payout.itemShare[0] ? ` → <b>${perkPct(v.payout.itemShare[1])}</b>` : ''} of their price`
    ),
  ].join('')}</table>${v.limited
    .map(
      (/** @type {any} */ l) =>
        `<p class="warn" data-limited="${escapeHtml(l.kind)}">${escapeHtml(l.kind)}${l.what ? ' ' + escapeHtml(l.what) : ''}: the rows multiply to ${perkX(l.raw)}, the code uses ${perkX(l.used)} (FX_LIMIT).</p>`
    )
    .join('')}</div>`;
}
/** perkOfferOrder's answer: each pick, this Perk marked */
function perkOffersHTML(/** @type {{ offer: string[], took: string | null }[]} */ v, /** @type {string} */ k) {
  const L = studioState.D.perks,
    at = v.findIndex(p => p.offer.includes(k));
  return `<ol class="relic-offers">${v
    .map(
      p =>
        `<li data-offer="${escapeHtml(p.offer.join(','))}">${p.offer.length ? p.offer.map(id => `<span class="${id === k ? 'relic-this' : ''}">${escapeHtml((L[id] || {}).name || id)}${id === p.took ? ' ✓' : ''}</span>`).join(', ') : '<i>nothing left to offer</i>'}</li>`
    )
    .join(
      ''
    )}</ol><p class="help">${at < 0 ? 'This Perk isn’t offered at these picks.' : `This Perk is first offered at pick ${at + 1}.`}</p>`;
}

/* the preview's own inputs: not data, so they redraw only the preview */
document.addEventListener('input', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset) return;
  if (el.dataset.relicEd) {
    const f = el.dataset.relicEd;
    if (f === 'lvl' || f === 'picks')
      perkEd[f] = Math.max(1, Math.min(f === 'lvl' ? 100 : 12, Math.round(+el.value) || 1));
    else perkEd[f] = el.value;
    perkFillSoon();
  } else if (el.dataset.relicAlso) {
    const id = el.dataset.relicAlso;
    perkEd.also = el.checked ? [...perkEd.also, id] : perkEd.also.filter(x => x !== id);
    perkFillSoon();
  }
});
/* a row's kind: the row becomes that kind's, with its fields at neutral values */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLSelectElement} */ (ev.target);
  if (!el.dataset || !el.dataset.relicKind) return;
  const R = studioState.D.perks[el.dataset.relicKind],
    make = PERK_ROW_NEW[el.value];
  if (!R || !make) return;
  R.fx[+(el.dataset.n || 0)] = make();
  changed();
  render();
});
/* any data edit while the section shows (a field here, or in the other pane) redraws the preview */
studioState.hooks.relics = () => perkFillSoon();
ACTIONS.pickRelic = d => {
  studioState.sel.relic = d.id;
  render();
};
ACTIONS.relicNew = () => {
  const D = studioState.D,
    k = uniqueKey('perk', x => !!(D.perks || {})[x]);
  D.perks[k] = { name: 'New Perk', d: 'Wins pay 10% more Moneys.', rarity: 'common', fx: [PERK_ROW_NEW.money()] };
  studioState.sel.relic = k;
  changed();
  render();
};
ACTIONS.relicDel = async () => {
  const k = studioState.sel.relic;
  if (
    !(await ask(
      `Delete the Perk ${escapeHtml(studioState.D.perks[k].name || k)}? A run holding it loses it.`,
      'Delete'
    ))
  )
    return;
  delete studioState.D.perks[k];
  changed();
  render();
};
ACTIONS.relicRowAdd = () => {
  const R = studioState.D.perks[studioState.sel.relic];
  if (R.fx.length >= 4) return;
  R.fx.push(PERK_ROW_NEW.money());
  changed();
  render();
};
ACTIONS.relicRowDel = d => {
  const R = studioState.D.perks[d.k];
  if (!R || R.fx.length < 2) return;
  R.fx.splice(+d.n, 1);
  changed();
  render();
};
