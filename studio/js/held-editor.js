'use strict';
/* ================= HELD ITEMS (perks track PK-10) =================
   The items editor's part for a held item (items.json `hold`, logic/effects.js fxOfBillie): its tier on the loot ladder
   (data-checks.js RARITY_TIERS) and its 1-4 effect rows, each by its kind (data-checks.js HOLD_KINDS), with
   data-checks.js dataHeldItems's messages on the row they are about. A plain item can be made a held one (one row, a
   money row that changes little) and back. Edits are ordinary fields (saved, undone and proposed like any other); a
   row's kind is changed by its own select, which puts that kind's fields in with neutral values. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { FX_CHANCE, FX_LIMIT, FX_STAGES, HELD_IFS } from '../../game/js/logic/effects.js';
import { escapeHtml } from './game-stand-ins.js';
import { HELD_WHEN_KINDS, HOLD_KINDS, RARITY_TIERS, dataHeldItems } from '../../game/js/logic/data-checks.js';
import { ACTIONS, changed, grid, numberField, render, selectField, studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  HELD_KIND_NAMES: [() => HELD_KIND_NAMES],
  HELD_ROW_NEW: [() => HELD_ROW_NEW],
  HELD_WHEN_NAMES: [() => HELD_WHEN_NAMES],
  heldItemHTML: [() => heldItemHTML, v => ((heldItemHTML = v), provide({ heldItemHTML }))],
  heldProblems: [() => heldProblems],
  heldRowHTML: [() => heldRowHTML, v => (heldRowHTML = v)],
  heldTimingHTML: [() => heldTimingHTML, v => (heldTimingHTML = v)],
});
/* eslint-enable no-func-assign */
provide({ heldItemHTML });
/* to-module: end */
/** what each kind does for its holder, for the kind select */
const HELD_KIND_NAMES = {
  money: 'A win pays more while its holder stands',
  stat: 'Stat stages as its holder comes in (or at a hit, its When)',
  damage: 'What its holder deals or takes',
  xp: 'Its holder’s XP',
  turnHeal: 'A share of HP at each turn’s end',
  pinchHeal: 'Once a battle, a share of HP when low',
  survive: 'Once a battle, from full HP, lives through a knockout hit with 1 HP (PK-10)',
  reflect: 'Billies that hit its holder lose a share of their HP (PK-10)',
  drain: 'Its holder heals a share of the damage it deals (PK-10)',
  immune: 'Moves of a type miss its holder (until it is hit) (PK-10)',
  first: 'A chance its holder moves first (PK-10)',
  last: 'Its holder moves last (PK-10)',
};
/** a new row of a kind: its fields with values that change little */
const HELD_ROW_NEW = {
  money: () => ({ kind: 'money', mult: 1.1 }),
  stat: () => ({ kind: 'stat', stat: 'hus', stages: 1 }),
  damage: () => ({ kind: 'damage', side: 'deal', mult: 1.1 }),
  xp: () => ({ kind: 'xp', mult: 1.1 }),
  turnHeal: () => ({ kind: 'turnHeal', share: 0.0625 }),
  pinchHeal: () => ({ kind: 'pinchHeal', at: 0.5, share: 0.25 }),
  survive: () => ({ kind: 'survive' }),
  reflect: () => ({ kind: 'reflect', share: 0.125, cat: 'H' }),
  drain: () => ({ kind: 'drain', share: 0.125 }),
  immune: () => ({ kind: 'immune', type: 'Ground', until: 'hurt' }),
  first: () => ({ kind: 'first', chance: 0.2 }),
  last: () => ({ kind: 'last' }),
};
/** the data checks' messages about one item's rows (dataHeldItems, as CI runs it) */
const heldProblems = (/** @type {string} */ k) => {
  try {
    return dataHeldItems(studioState.D)
      .map(p => p[1])
      .filter(m => m.startsWith(k + '.'));
  } catch (e) {
    return [`the check stopped: ${e.message || e}`];
  }
};

/** PK-10: what each moment means, for a hold row's When */
const HELD_WHEN_NAMES = { hit: 'its holder lands a hit', hurt: 'its holder is hit' };
/** PK-10: a hold row's When, and with one its If and Once (data-checks.js HELD_WHEN_KINDS, effects.js HELD_IFS)
 * @param {string} k @param {any} f @param {number} n */
function heldTimingHTML(k, f, n) {
  const p = `items.${k}.hold.${n}`,
    whens = HELD_WHEN_KINDS[f.kind] || [],
    out = [];
  if (!whens.length) return '';
  out.push(
    selectField(
      'When',
      `${p}.when`,
      whens.map(w => [w, `${w}: ${/** @type {any} */ (HELD_WHEN_NAMES)[w] || w}`]),
      { none: 'Where its kind always acts', opt: 1, rr: 1 }
    )
  );
  if (f.when) {
    const ifs = f.if == null ? '' : Array.isArray(f.if) ? f.if.join(', ') : f.if;
    out.push(
      `<label class="fld"><span>If (all must hold)</span><input type="text" data-held-if="${escapeHtml(k)}" data-n="${n}" value="${escapeHtml(ifs)}" placeholder="${HELD_IFS.join(', ')}"></label>`,
      selectField('Once', `${p}.once`, [['battle', 'Once a battle']], { none: 'Every time', opt: 1 })
    );
  }
  return `<div class="relic-when">${grid(...out)}</div>`;
}

/** one hold row's fields, by its kind @param {string} k @param {any} f @param {number} n @param {string[]} P */
function heldRowHTML(k, f, n, P) {
  const D = studioState.D,
    p = `items.${k}.hold.${n}`,
    lim = `×${FX_LIMIT.lo} to ×${FX_LIMIT.hi} (effects.js FX_LIMIT)`,
    mult = (/** @type {string} */ l) =>
      numberField(l, `${p}.mult`, { min: FX_LIMIT.lo, max: FX_LIMIT.hi, step: 0.05, help: lim }),
    share = (/** @type {string} */ l, key = 'share') =>
      numberField(l, `${p}.${key}`, { min: 0.01, max: 1, step: 0.01, help: 'Above 0, at most 1.' }),
    stats = (D.stats || [])
      .filter((/** @type {any} */ s) => s.id !== 'hp')
      .map((/** @type {any} */ s) => [s.id, s.name]),
    fields = /** @type {Record<string, () => string[]>} */ ({
      money: () => [mult('Moneys ×')],
      stat: () => [
        selectField('Stat', `${p}.stat`, stats),
        numberField('Stages', `${p}.stages`, {
          min: -FX_STAGES,
          max: FX_STAGES,
          step: 1,
          help: `−${FX_STAGES} to +${FX_STAGES} (effects.js FX_STAGES).`,
        }),
      ],
      damage: () => [
        selectField('Side', `${p}.side`, [
          ['deal', 'What its holder deals'],
          ['take', 'What its holder takes'],
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
      xp: () => [mult('XP ×')],
      turnHeal: () => [share('Share of HP healed at each turn’s end')],
      pinchHeal: () => [share('Low: at this share of HP or below', 'at'), share('Share of HP healed')],
      survive: () => ['<p class="note">No number: once a battle, from full HP only (as Bedrock).</p>'],
      reflect: () => [
        numberField('Share of the hitter’s HP it loses', `${p}.share`, {
          min: 0.01,
          max: 0.5,
          step: 0.005,
          help: 'Above 0, at most 0.5 (0.125 is an eighth).',
        }),
        selectField(
          'For moves of the category',
          `${p}.cat`,
          [
            ['H', 'Physical (H)'],
            ['S', 'Special (S)'],
          ],
          { none: 'Any', opt: 1 }
        ),
      ],
      drain: () => [share('Share of the damage dealt it heals')],
      immune: () => [
        selectField(
          'Moves of the type miss it',
          `${p}.type`,
          D.types.map((/** @type {any} */ t) => [t.id, t.id])
        ),
        selectField('Until', `${p}.until`, [['hurt', 'It is hit (then it is spent)']], { none: 'Always', opt: 1 }),
      ],
      first: () => [
        numberField('Chance each turn', `${p}.chance`, {
          min: 0.01,
          max: FX_CHANCE,
          step: 0.01,
          help: `Above 0, at most ${FX_CHANCE} (effects.js FX_CHANCE). Within a move’s priority.`,
        }),
      ],
      last: () => ['<p class="note">No number: after the others, within a move’s priority.</p>'],
    })[f.kind],
    rows = D.items[k].hold;
  const err = P.filter(m => m.startsWith(`${k}.hold[${n}]`))
    .map(m => `<p class="err relic-err">${escapeHtml(m)}</p>`)
    .join('');
  return `<div class="relic-row" data-held-row="${n}"><div class="relic-row-head"><select data-held-kind="${escapeHtml(k)}" data-n="${n}" aria-label="Kind of effect">${HOLD_KINDS.map(
    v =>
      `<option value="${v}"${v === f.kind ? ' selected' : ''}>${v}: ${escapeHtml(/** @type {any} */ (HELD_KIND_NAMES)[v] || v)}</option>`
  ).join(
    ''
  )}</select>${rows.length > 1 ? `<button class="x" data-act="heldRowDel" data-k="${escapeHtml(k)}" data-n="${n}" title="Remove this effect">✕</button>` : ''}</div>${heldTimingHTML(k, f, n)}${fields ? grid(...fields()) : `<p class="err">No such kind: ${escapeHtml(String(f.kind))}</p>`}${err}</div>`;
}

/** a held item's tier and rows, or the button that makes a plain item a held one @param {string} k @param {any} I */
function heldItemHTML(k, I) {
  if (!Array.isArray(I.hold))
    return `<div class="seg-row"><button class="btn subtle" data-act="heldMake" data-k="${escapeHtml(k)}">Make it a held item</button></div>`;
  const P = heldProblems(k),
    own = P.filter(m => !m.startsWith(`${k}.hold[`))
      .map(m => `<p class="err relic-err">${escapeHtml(m)}</p>`)
      .join('');
  return `<div class="held-ed"><h4>Held item</h4>${grid(
    selectField(
      'Tier',
      `items.${k}.rarity`,
      RARITY_TIERS.map(r => [r, r]),
      { help: 'Its frame, pill and name colour on the loot ladder (UI-14b).' }
    )
  )}${I.hold.map((/** @type {any} */ f, /** @type {number} */ n) => heldRowHTML(k, f, n, P)).join('')}${own}<div class="seg-row">${I.hold.length < 4 ? `<button class="btn" data-act="heldRowAdd" data-k="${escapeHtml(k)}">+ Add an effect</button>` : ''}<span class="grow"></span><button class="btn subtle" data-act="heldUnmake" data-k="${escapeHtml(k)}">Not a held item</button></div></div>`;
}

/* a row's kind: the row becomes that kind's, with its fields at neutral values */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLSelectElement} */ (ev.target);
  if (!el.dataset || !el.dataset.heldKind) return;
  const I = studioState.D.items[el.dataset.heldKind],
    make = /** @type {any} */ (HELD_ROW_NEW)[el.value];
  if (!I || !I.hold || !make) return;
  I.hold[+(el.dataset.n || 0)] = make();
  changed();
  render();
});
/* PK-10: a hold row's If: words split at commas (one is kept as a word, more as a list, none removes it) */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset || !el.dataset.heldIf) return;
  const I = studioState.D.items[el.dataset.heldIf],
    f = I && I.hold && I.hold[+(el.dataset.n || 0)];
  if (!f) return;
  const was = JSON.stringify(f),
    L = el.value
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);
  if (!L.length) delete f.if;
  else f.if = L.length === 1 ? L[0] : L;
  if (JSON.stringify(f) === was) return;
  changed();
  render();
});
ACTIONS.heldMake = (/** @type {any} */ d) => {
  const I = studioState.D.items[d.k];
  if (!I || I.hold) return;
  I.hold = [HELD_ROW_NEW.money()];
  I.rarity = 'common';
  changed();
  render();
};
ACTIONS.heldUnmake = (/** @type {any} */ d) => {
  const I = studioState.D.items[d.k];
  if (!I || !I.hold) return;
  delete I.hold;
  delete I.rarity;
  changed();
  render();
};
ACTIONS.heldRowAdd = (/** @type {any} */ d) => {
  const I = studioState.D.items[d.k];
  if (!I || !I.hold || I.hold.length >= 4) return;
  I.hold.push(HELD_ROW_NEW.money());
  changed();
  render();
};
ACTIONS.heldRowDel = (/** @type {any} */ d) => {
  const I = studioState.D.items[d.k];
  if (!I || !I.hold || I.hold.length < 2) return;
  I.hold.splice(+d.n, 1);
  changed();
  render();
};
