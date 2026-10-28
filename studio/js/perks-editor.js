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
import { FX_CHANCE, FX_CRIT, FX_EVERY, FX_LIMIT, FX_STAGES, FX_WHEN } from '../../game/js/logic/effects.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelsToSvg, svgIconKey } from '../../game/js/logic/svg-pixels.js';
import { FX_PLAIN, FX_WHEN_KINDS, dataPerks } from '../../game/js/logic/data-checks.js';
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
import { textStep } from './pixel-canvas.js';
import { artPictures } from './art-browser.js';
import { iconEditOpen, iconSrc } from './icon-editor.js';
import { logicAsk } from './logic-client.js';
/* eslint-disable no-func-assign */
expose({
  PERK_KINDS: [() => PERK_KINDS],
  PERK_RARITIES: [() => PERK_RARITIES],
  PERK_ROW_NEW: [() => PERK_ROW_NEW],
  PERK_WHEN: [() => PERK_WHEN],
  perkArtHTML: [() => perkArtHTML, v => (perkArtHTML = v)],
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
  perkTimingHTML: [() => perkTimingHTML, v => (perkTimingHTML = v)],
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
  turnHeal: 'Heal a share of HP at each turn’s end (PK-1)',
  pinchHeal: 'Heal once a battle when low on HP (PK-1)',
  turnHurt: 'Lose a share of HP at each turn’s end (PK-1)',
  level: 'Foes’ levels on the run (PK-1)',
  bossHp: 'The run’s boss’s HP (PK-1)',
  crit: 'Critical hits: more often, or a move that is one (PK-3)',
  immune: 'A status, the Sandstorm or sharp stones can’t touch your Billies (PK-3)',
  inflict: 'A chance to give the foe a status when one of yours hits it (PK-3)',
  chip: 'What a burn takes from your Billies at each turn’s end (PK-3)',
  first: 'Your Billies move before the foe’s (PK-3; If turn:1 for the first turn)',
};
/** PK-1: what each moment means, for the When select */
const PERK_WHEN = {
  battleStart: 'as a battle starts',
  switchIn: 'one of yours comes in',
  move: 'one of yours makes a move',
  hit: 'one of yours lands a hit',
  hurt: 'one of yours is hit',
  crit: 'one of yours lands a critical hit',
  ko: 'one of yours knocks a foe out',
  faint: 'one of yours faints',
  turnEnd: 'a turn ends',
  throwMiss: 'a throw misses',
  catch: 'a Billie is caught',
  win: 'a battle is won',
  arrive: 'you walk into a place',
  buy: 'you buy in a run shop',
  take: 'the Perk is taken',
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
  turnHeal: () => ({ kind: 'turnHeal', share: 0.05 }),
  pinchHeal: () => ({ kind: 'pinchHeal', at: 0.25, share: 0.25 }),
  turnHurt: () => ({ kind: 'turnHurt', share: 0.05 }),
  level: () => ({ kind: 'level', n: 1 }),
  bossHp: () => ({ kind: 'bossHp', mult: 1.1 }),
  crit: () => ({ kind: 'crit', stages: 1 }),
  immune: () => ({ kind: 'immune', what: 'brn' }),
  inflict: () => ({ kind: 'inflict', status: 'par', chance: 0.1, when: 'hit' }),
  chip: () => ({ kind: 'chip', what: 'burn', mult: 0.9 }),
  first: () => ({ kind: 'first', if: 'turn:1' }),
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
    share = (/** @type {string} */ l, key = 'share') =>
      numberField(l, `${p}.${key}`, { min: 0.01, max: 1, step: 0.01, help: 'Above 0, at most 1.' }),
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
      turnHeal: () => [share('Share of HP healed at each turn’s end')],
      pinchHeal: () => [share('Low: at this share of HP or below', 'at'), share('Share of HP healed')],
      turnHurt: () => [share('Share of HP lost at each turn’s end (at most 0.5)')],
      level: () => [numberField('Foes’ levels +', `${p}.n`, { min: -20, max: 20, step: 1 })],
      bossHp: () => [mult('Boss HP ×')],
      /* PK-3: stages without a when; at a move (When) the move itself is a critical hit */
      crit: () =>
        f.when
          ? [`<p class="note">At its moment the move is a critical hit (no stages).</p>`]
          : [
              numberField('Critical-hit stages +', `${p}.stages`, {
                min: 1,
                max: FX_CRIT,
                step: 1,
                help: `1 to ${FX_CRIT} (effects.js FX_CRIT; the chance steps of rules.json battle.critChances).`,
              }),
            ],
      immune: () => [
        selectField('Keeps off', `${p}.what`, [
          ['brn', 'Burns'],
          ['slp', 'Sleep'],
          ['par', 'Paralysis'],
          ['sandstorm', 'The Sandstorm’s buffeting'],
          ['stones', 'Sharp stones on switching in'],
        ]),
      ],
      inflict: () => [
        selectField(
          'Status',
          `${p}.status`,
          (D.statuses || []).map((/** @type {any} */ q) => [q.id, q.name])
        ),
        numberField('Chance', `${p}.chance`, {
          min: 0.01,
          max: FX_CHANCE,
          step: 0.01,
          help: `Above 0, at most ${FX_CHANCE}; the chances of rows acting at one hit count at most ${FX_CHANCE} together (effects.js FX_CHANCE). If cat:H for physical hits only.`,
        }),
      ],
      chip: () => [selectField('Which hurt', `${p}.what`, [['burn', 'A burn’s, at each turn’s end']]), mult('Hurt ×')],
      first: () => [`<p class="note">Within a move’s priority, yours act before the foe’s wherever its If holds.</p>`],
    }[f.kind];
  return `<div class="relic-row" data-relic-row="${n}"><div class="relic-row-head"><select data-relic-kind="${escapeHtml(k)}" data-n="${n}" aria-label="Kind of effect">${Object.entries(
    PERK_KINDS
  )
    .map(([v, l]) => `<option value="${v}"${v === f.kind ? ' selected' : ''}>${v}: ${escapeHtml(l)}</option>`)
    .join(
      ''
    )}</select>${D.perks[k].fx.length > 1 ? `<button class="x" data-act="relicRowDel" data-k="${escapeHtml(k)}" data-n="${n}" title="Remove this effect">✕</button>` : ''}</div>${perkTimingHTML(k, f, n)}${fields ? grid(...fields()) : `<p class="err">No such kind: ${escapeHtml(String(f.kind))}</p>`}${perkProblemHTML(P, `${k}.fx[${n}]`)}</div>`;
}

/** PK-1: a row's When, If, Every, Grows, Per and Once (logic/effects.js), the ones its kind can have
 * (data-checks.js FX_WHEN_KINDS, FX_PLAIN) */
function perkTimingHTML(/** @type {string} */ k, /** @type {any} */ f, /** @type {number} */ n) {
  const p = `perks.${k}.fx.${n}`,
    whens = /** @type {readonly string[]} */ (FX_WHEN_KINDS[f.kind] || []),
    plain = FX_PLAIN[f.kind] || [],
    can = (/** @type {string} */ key) => !plain.includes(key),
    numbered = ['mult', 'stages', 'share', 'n'].some(q => q in f),
    moments = (/** @type {readonly string[]} */ L) => L.map(w => [w, `${w}: ${PERK_WHEN[w] || w}`]),
    ifs = f.if == null ? '' : Array.isArray(f.if) ? f.if.join(', ') : f.if,
    g = f.grow,
    out = [];
  if (whens.length)
    out.push(selectField('When', `${p}.when`, moments(whens), { none: 'Where its kind always acts', opt: 1, rr: 1 }));
  if (can('if'))
    out.push(
      `<label class="fld"><span>If (all must hold)</span><input type="text" data-relic-if="${escapeHtml(k)}" data-n="${n}" value="${escapeHtml(ifs)}" placeholder="lead, hp<0.5, foe:leader|rival"></label>`
    );
  if (f.when)
    out.push(
      numberField('Every Nth time', `${p}.every`, {
        min: 2,
        max: FX_EVERY,
        step: 1,
        opt: 1,
        help: 'Counted over the run.',
      })
    );
  if (numbered && can('grow'))
    out.push(
      `<label class="fld"><span>Grows on</span><select data-relic-grow="${escapeHtml(k)}" data-n="${n}"><option value="">Doesn’t grow</option>${FX_WHEN.map(
        w => `<option value="${w}"${g && g.on === w ? ' selected' : ''}>${w}: ${escapeHtml(PERK_WHEN[w] || w)}</option>`
      ).join('')}</select></label>`
    );
  if (g)
    out.push(
      numberField('Grows by', `${p}.grow.by`, { step: 0.01, help: 'Added to its number each time.' }),
      numberField('Up to', `${p}.grow.max`, { step: 0.01 }),
      selectField('Back to 0 when', `${p}.grow.reset`, moments(FX_WHEN), { none: 'Never', opt: 1 })
    );
  if (numbered && can('per'))
    out.push(
      selectField('Per', `${p}.per`, [['teamTypes', 'Each different type on your team']], { none: 'Once', opt: 1 })
    );
  if (f.when || ['stat', 'pinchHeal'].includes(f.kind))
    out.push(
      selectField(
        'Once',
        `${p}.once`,
        [
          ['battle', 'Once a battle'],
          ['billie', 'Once a battle for each Billie'],
          ['run', 'Once a run'],
        ],
        { none: 'Every time', opt: 1 }
      )
    );
  return out.length ? `<div class="relic-when">${grid(...out)}</div>` : '';
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

/** PK-2: a Perk's picture (its img, drawn as the UI icons are) at the game's 72 and 36 px, and Edit art; without one, a
 * way to draw one (or to name the file already in art/perks) */
function perkArtHTML(k, R) {
  const own = `art/perks/${k}.svg`,
    key = R.img ? svgIconKey('art/' + R.img) : '',
    there = (/** @type {string} */ p) => artPictures().includes(p) || studioState.textDirty.has(p);
  if (key && there('art/' + R.img)) {
    const src = escapeHtml(iconSrc(key));
    return `<div class="seg-row perk-art"><img class="pix" src="${src}" alt="" width="72" height="72"><img class="pix" src="${src}" alt="" width="36" height="36"><span class="help mono">${escapeHtml(R.img)}</span><button class="btn sm" data-act="icOpen" data-n="${escapeHtml(key)}">Edit art</button></div>`;
  }
  return `<div class="seg-row perk-art"><p class="help">${R.img ? `Its picture, art/${escapeHtml(R.img)}, isn’t there.` : 'No picture yet:'} the game shows the relic icon.</p><button class="btn sm" data-act="relicArt">${there(own) ? `Use ${escapeHtml(own)}` : 'Draw one'}</button></div>`;
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
  /* WM-2: a run's fewest mini-bosses (rules.json run.map.towns: a town after each) */
  if (!perkEd.picks) perkEd.picks = Math.max(1, (D.rules.run.map.towns || [])[0] || 1);
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
     textField('Its line in battle (PK-1: when a row acts at a moment; {name} is the Billie)', `${p}.say`, {
       max: 40,
       opt: 1,
       ph: 'Approved, {name}!',
     }) +
     perkArtHTML(k, R) +
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
/* PK-1: a row's If: words split at commas (one is kept as a word, more as a list, none removes it) */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset || (!el.dataset.relicIf && !el.dataset.relicGrow)) return;
  const R = studioState.D.perks[el.dataset.relicIf || el.dataset.relicGrow || ''],
    f = R && R.fx[+(el.dataset.n || 0)];
  if (!f) return;
  /* a second change for the same value (the box blurs as the page redraws): nothing to do */
  const was = JSON.stringify(f);
  if (el.dataset.relicIf) {
    const L = el.value
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);
    if (!L.length) delete f.if;
    else f.if = L.length === 1 ? L[0] : L;
  } else if (!el.value) delete f.grow;
  else f.grow = { ...(f.grow || { by: 0.05, max: 0.25 }), on: el.value };
  if (JSON.stringify(f) === was) return;
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
/* PK-2: the Perk's own picture, art/perks/<id>.svg: named in its img, made blank first when it isn't there, then open
   in the icon editor (the new file and the img are two steps of the undo; Propose sends both) */
ACTIONS.relicArt = () => {
  const k = studioState.sel.relic,
    R = studioState.D.perks[k],
    path = `art/perks/${k}.svg`;
  if (!R) return;
  if (!artPictures().includes(path) && !studioState.textDirty.has(path))
    textStep(path, null, pixelsToSvg(new Uint8ClampedArray(36 * 36 * 4), 36, 36));
  R.img = `perks/${k}.svg`;
  changed();
  iconEditOpen(`perks/${k}`);
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
