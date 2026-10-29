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
import {
  FX_CATCH_LEVEL,
  FX_CHANCE,
  FX_CRIT,
  FX_EVERY,
  FX_LIMIT,
  FX_STAGES,
  FX_WHEN,
} from '../../game/js/logic/effects.js';
import { escapeHtml } from './game-stand-ins.js';
import { pixelsToSvg, svgIconKey } from '../../game/js/logic/svg-pixels.js';
import {
  FX_ONCE_KINDS,
  FX_PLAIN,
  FX_RULE_N,
  FX_WHEN_KINDS,
  dataPerkSets,
  dataPerks,
} from '../../game/js/logic/data-checks.js';
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
  PERK_PASSIVE_FIELDS: [() => PERK_PASSIVE_FIELDS],
  PERK_RARITIES: [() => PERK_RARITIES],
  PERK_ROW_NEW: [() => PERK_ROW_NEW],
  PERK_RULES: [() => PERK_RULES],
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
  perkSetPickHTML: [() => perkSetPickHTML, v => (perkSetPickHTML = v)],
  perkSetsHTML: [() => perkSetsHTML, v => (perkSetsHTML = v)],
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
  xp: 'The XP your Billies get from a battle (PK-7)',
  splice: 'How often wild Billies are spliced (SP-6)',
  unstable: 'The HP Unstable splices lose at each turn’s end (SP-6)',
  turnHeal: 'Heal a share of HP at each turn’s end (PK-1)',
  pinchHeal: 'Heal once a battle when low on HP (PK-1)',
  turnHurt: 'Lose a share of HP at each turn’s end (PK-1)',
  level: 'Foes’ levels on the run (PK-1)',
  bossHp: 'The run’s boss’s HP (PK-1)',
  crit: 'Critical hits: more often, or a move that is one (PK-3)',
  immune: 'A status, the Sandstorm or sharp stones can’t touch your Billies (PK-3)',
  inflict: 'A chance to give the foe a status when one of yours hits it, or as a battle starts (PK-3, PK-5)',
  chip: 'What a burn takes from your Billies at each turn’s end (PK-3)',
  first: 'Your Billies move before the foe’s (PK-3; If turn:1 for the first turn)',
  last: 'Your Billies move after the foe’s (PK-9; If turn:1 for the first turn)',
  revive: 'A wiped team gets back up, once (PK-3)',
  passive: 'A type passive works better for your Billies that have it (PK-4)',
  weather: 'The weather never weakens your Billies’ moves, or boosts them more (PK-4)',
  benchXp: 'Billies who sat out get more of a foe’s XP (PK-4)',
  rule: 'A run rule: the forecast, reward picks, rerolls, the map shown, Perks held (PK-4..PK-6)',
  catchLevel: 'A Billie you catch joins levels higher (PK-5)',
  refund: 'A pyramid that missed comes back (PK-5)',
  free: 'What you just bought is free (PK-5)',
  salvage: 'Beaten bots leave more salvage (PK-5)',
  copy: 'Copies the Perk just above it in the list held (PK-6)',
  give: 'Moneys and Bag items at once, when it is taken (PK-6)',
  recoil: 'An attack of yours that deals damage costs its user HP (PK-7)',
  loot: 'A random item from an events.json loot table, at its moment (PK-7)',
  heldBoost: 'Your Billies’ held items work better (PK-8)',
};
/** PK-4, PK-5: each run rule's name and what its By counts (data-checks.js FX_RULE_N has its range) */
const PERK_RULES = /** @type {Record<string, [string, () => string]>} */ ({
  forecastDays: [
    'The forecast shows more days',
    () => `Days more than rules.json’s ${studioState.D.rules.run.clock.ahead}.`,
  ],
  rewardPick: [
    'Reward picks show more cards (or fewer)',
    () =>
      `Cards more than rules.json’s ${studioState.D.rules.run.rewards.pick}; -1 shows one fewer (a curse; never under one).`,
  ],
  rerollFree: [
    'The first rerolls of a reward pick are free',
    () =>
      `Rerolls free at each reward pick; then rules.json’s ${studioState.D.rules.run.rewards.reroll} Moneys, growing.`,
  ],
  mapReveal: ['The run map shows what every place is', () => 'On (1): every place of the main map shows its type.'],
  cap: [
    'Hold more Perks',
    () => `Perks more than rules.json’s ${studioState.D.rules.run.perks.cap} (the online run record still keeps 6).`,
  ],
  sideOpen: [
    'A side area opens with its badge alone',
    () => 'On (1): no Billie of the field move’s type needed at a side area’s obstacle (not brambles, not Surf).',
  ],
  sideFind: [
    'Side areas hold more finds',
    () => 'Finds more on each side area’s route or arena (at most 2; they show at once when taken).',
  ],
  eventHurt: ['Events never cost your team HP', () => 'On (1): an event’s hurt command does nothing.'],
  /* PK-7: Non-Refundable Ticket */
  /* PK-7: Influencer Contract */
  faintPaysNothing: [
    'A win in which one of yours fainted pays nothing',
    () => 'On (1): a won battle in which one of yours fainted pays no Moneys (a wild prize or a trainer’s reward).',
  ],
  /* PK-8: the Lab Kit set */
  unstableSafe: [
    'Unstable splices lose no HP',
    () => 'On (1): an Unstable splice of yours loses nothing at a turn’s end (its cells never hurt it).',
  ],
  sidePerk: [
    'Side areas hold a Perk',
    () => 'On (1): each side area’s place has a Perk lying on the ground (a pick of one when you walk onto it).',
  ],
  muteNewest: [
    'The newest Perk does nothing',
    () => 'On (1): the last Perk taken gives nothing and counts toward no set (a curse’s only; boons.json).',
  ],
  shopClosed: [
    'Run towns’ shops are shut',
    () => 'On (1): a run town’s shop is shut while it holds (a curse); the market stall stays open.',
  ],
  noDrop: [
    'No Perk held can be let go',
    () => 'On (1): at the cap no new Perk can be taken (the “Let one go” sheet offers none).',
  ],
});
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
  xp: () => ({ kind: 'xp', mult: 1.1 }),
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
  last: () => ({ kind: 'last', if: 'turn:1' }),
  revive: () => ({ kind: 'revive', share: 0.5, once: 'run' }),
  passive: () => ({ kind: 'passive', passive: 'kindling', rate: 2 }),
  weather: () => ({ kind: 'weather', what: 'noWeaken' }),
  benchXp: () => ({ kind: 'benchXp', share: 0.25 }),
  rule: () => ({ kind: 'rule', rule: 'forecastDays', n: 3 }),
  catchLevel: () => ({ kind: 'catchLevel', n: 2 }),
  refund: () => ({ kind: 'refund', what: 'pyramid', when: 'throwMiss', once: 'battle' }),
  free: () => ({ kind: 'free', when: 'buy', every: 4 }),
  salvage: () => ({ kind: 'salvage', mult: 2 }),
  copy: () => ({ kind: 'copy' }),
  give: () => ({ kind: 'give', money: 150, when: 'take' }),
  recoil: () => ({ kind: 'recoil', share: 0.08 }),
  loot: () => ({ kind: 'loot', table: 'common', when: 'arrive' }),
  heldBoost: () => ({ kind: 'heldBoost', mult: 1.5 }),
};
/** PK-4: what each passive row's numbers mean (effects.js FX_PASSIVE_KEYS), for its inputs */
const PERK_PASSIVE_FIELDS = {
  kindling: [['rate', 'Its turns count × (1 to 4)', { min: 1, max: 4, step: 0.5 }]],
  undertow: [['hp', 'Kicks in at this share of HP or below', { min: 0.01, max: 1, step: 0.01 }]],
  regrowth: [['mult', 'Heals ×', { min: 1, max: 4, step: 0.25 }]],
  livewire: [['mult', 'Its critical-hit stages ×', { min: 1, max: 3, step: 1 }]],
  bedrock: [
    ['uses', 'Holds on this many times a battle', { min: 1, max: 9, step: 1, opt: 1 }],
    ['hp', 'From this share of HP up (else full HP)', { min: 0.01, max: 1, step: 0.01, opt: 1 }],
  ],
  wildmind: [['rolls', 'Rolls its damage this many times, the best kept', { min: 2, max: 3, step: 1 }]],
  partingroar: [['stages', 'The next one in also gets stages of', { min: 1, max: 6, step: 1 }]],
};
const PERK_RARITIES = ['common', 'uncommon', 'rare'];

/** the data checks' messages about perks.json and rules.json run.perks (dataPerks, as CI runs it) */
const perkProblems = () => {
  try {
    /* PK-8: and the Perk sets' (perkSets.json; a Perk in two sets is a perks.json message) */
    return [...dataPerks(studioState.D), ...dataPerkSets(studioState.D)].map(([f, m]) => ({ f, m }));
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
      /* PK-5: a money share (Tip Jar) is paid on arrival: a share of what you carry, up to its most */
      money: () =>
        'share' in f
          ? [
              share('Share of the Moneys carried'),
              numberField('At most', `${p}.max`, { min: 1, max: 9999, step: 1, unit: '$' }),
              `<p class="note">Paid at arrive (its When), from what you carry as you walk in.</p>`,
            ]
          : 'add' in f
            ? [
                /* PK-7: Moneys paid, or charged below 0 (Subscription Box) */
                numberField('Moneys (below 0 charges)', `${p}.add`, { min: -9999, max: 9999, step: 1, unit: '$' }),
                `<p class="note">At arrive (its When): paid, or charged when below 0 (never below none carried).</p>`,
              ]
            : [mult('Moneys ×')],
      price: () => [
        selectField('Which price', `${p}.what`, [
          ['shop', 'A run shop’s wares'],
          ['heal', 'A run town’s clinic'],
          /* PK-8: a run shop's Perk (after the shop's rows) */
          ['perk', 'A run shop’s Perk'],
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
      /* PK-7: Hustle Planner's quarter */
      xp: () => [mult('XP from a battle ×')],
      splice: () => [mult('Wild splice odds × (Graft and Chimera together never past 100%)')],
      unstable: () => [mult('Unstable turn-end hurt ×')],
      turnHeal: () => [share('Share of HP healed at each turn’s end')],
      pinchHeal: () => [share('Low: at this share of HP or below', 'at'), share('Share of HP healed')],
      turnHurt: () => [share('Share of HP lost at each turn’s end (at most 0.5)')],
      /* PK-7: Overclock Chip's cost */
      recoil: () => [share('Share of its HP an attack that dealt damage costs its user (at most 0.5)')],
      /* PK-7: Subscription Box's item */
      loot: () => [
        selectField(
          'Loot table (events.json loot)',
          `${p}.table`,
          Object.keys((D.events && D.events.loot) || {}).map(t => [t, t])
        ),
        numberField('Items', `${p}.n`, { min: 1, max: 3, step: 1, opt: 1 }),
        `<p class="note">At its When (arrive): drawn from the run’s own stream for each place, so a reload brings the same.</p>`,
      ],
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
          help: `Above 0, at most ${FX_CHANCE}; the chances of rows acting at one hit count at most ${FX_CHANCE} together (effects.js FX_CHANCE). If cat:H for physical hits only. At battleStart (its When) a roll for each foe on the field.`,
        }),
      ],
      chip: () => [selectField('Which hurt', `${p}.what`, [['burn', 'A burn’s, at each turn’s end']]), mult('Hurt ×')],
      first: () => [`<p class="note">Within a move’s priority, yours act before the foe’s wherever its If holds.</p>`],
      last: () => [`<p class="note">Within a move’s priority, yours act after the foe’s wherever its If holds.</p>`],
      revive: () => [share('Share of HP each gets back up with')],
      /* PK-4: the passive, then the numbers it takes; slipstream and alloy take a flag */
      passive: () => [
        selectField(
          'Passive',
          `${p}.passive`,
          (D.types || [])
            .filter((/** @type {any} */ t) => t.passive)
            .map((/** @type {any} */ t) => [t.passive, `${t.passiveName || t.passive} (${t.id})`]),
          { rr: 1 }
        ),
        .../** @type {any} */ (PERK_PASSIVE_FIELDS[f.passive] || []).map(
          (/** @type {[string, string, any]} */ [key, l, o]) => numberField(l, `${p}.${key}`, o)
        ),
        ...(f.passive === 'partingroar' ? [selectField('Stat', `${p}.stat`, stats)] : []),
        ...(f.passive === 'slipstream'
          ? ['<p class="note">Every switch of its is free (always: true), not only the first.</p>']
          : f.passive === 'alloy'
            ? ['<p class="note">It counts every teammate on its feet (all: true), not only those of its type.</p>']
            : []),
      ],
      /* PK-4: noWeaken has no number; boost a mult over 1 */
      weather: () => [
        selectField(
          'What',
          `${p}.what`,
          [
            ['noWeaken', 'Never weakens their moves (no ×under 1)'],
            ['boost', 'Its boosts count more times over'],
          ],
          { rr: 1 }
        ),
        ...(f.what === 'boost' ? [mult('Boosts counted × (×1.3 with 2 is ×1.6)')] : []),
      ],
      benchXp: () => [
        share(
          `Share of a foe’s XP more for those who sat out (rules.json gives them ${studioState.D.rules.progression.teamXpShare}; at most all of it)`
        ),
      ],
      /* PK-5: each rule's own range (data-checks.js FX_RULE_N) and words */
      rule: () => [
        selectField(
          'Rule',
          `${p}.rule`,
          Object.keys(FX_RULE_N).map(r => [r, PERK_RULES[r] ? PERK_RULES[r][0] : r]),
          { rr: 1 }
        ),
        numberField('By', `${p}.n`, {
          min: (FX_RULE_N[f.rule] || [1])[0],
          max: (FX_RULE_N[f.rule] || [1, 1])[1],
          step: 1,
          help: PERK_RULES[f.rule] ? PERK_RULES[f.rule][1]() : '',
        }),
      ],
      salvage: () => [mult('Parts offered and Scrap ×')],
      /* PK-8: a held item's factors move this many times as far from 1; its stages, shares and chances this many times */
      heldBoost: () => [mult('Held items work ×')],
      /* PK-6: Moneys, and the items as id:n pairs */
      give: () => [
        numberField('Moneys', `${p}.money`, { min: 1, max: 9999, step: 1, opt: 1 }),
        `<label class="fld"><span>Bag items (id:n, comma between)</span><input type="text" data-relic-give="${escapeHtml(k)}" data-n="${n}" value="${escapeHtml(
          Object.entries(f.items || {})
            .map(([i, c]) => `${i}:${c}`)
            .join(', ')
        )}" placeholder="potion:2"></label>`,
        `<p class="note">At take (its When): given once, as the Perk is taken.</p>`,
      ],
      /* PK-6: no numbers: the rows of the Perk above it, downsides too */
      copy: () => [
        `<p class="note">The rows of the Perk just above it in the list held count as this one’s (downsides too; never itself or another copier). Nothing when it is first.</p>`,
      ],
      free: () => [
        `<p class="note">At buy (its When), with Every for every Nth thing bought in a run shop: one of it comes free (several of one ware at once are one buy).</p>`,
      ],
      refund: () => [
        selectField('What comes back', `${p}.what`, [['pyramid', 'The pyramid thrown']], { rr: 1 }),
        `<p class="note">At throwMiss (its When); Once battle for the first miss a battle only.</p>`,
      ],
      catchLevel: () => [
        numberField('Levels', `${p}.n`, {
          min: 1,
          max: FX_CATCH_LEVEL,
          step: 1,
          help: `Levels higher it joins at, learning its moves on the way (at most ${FX_CATCH_LEVEL} together).`,
        }),
      ],
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
  if (f.when || FX_ONCE_KINDS.includes(f.kind))
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
      numberField('Offered at each pick', 'rules.run.perks.pick', { min: 1, max: 5, step: 1 }),
      numberField('Lean toward a tag match ×', 'rules.run.perks.bias', {
        min: 1,
        max: 10,
        step: 0.5,
        opt: 1,
        help: 'PK-4: a Perk whose tags match a type on the team or a tag of a Perk held is drawn this many times as often.',
      })
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
        `<button class="lcard slim ${x === k ? 'on' : ''}" data-act="pickRelic" data-id="${escapeHtml(x)}"><span class="lt"><b>${escapeHtml(L[x].name || x)}${P.some(p => p.f === 'perks.json' && p.m.startsWith(x + '.')) ? ' <span class="warn">⚠</span>' : ''}</b><small>${L[x].rarity === 'fine' ? 'fine · a leader’s win only' : `${escapeHtml(L[x].rarity)} · weight ${D.rules.run.perks.rarity[L[x].rarity] || 0} · ${perkPct(cov.chance[x])} first`}</small></span></button>`
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
       /* PK-7: fine, Fine Print: offered only at a leader's win (rules.json run.perks.leader) */
       [...PERK_RARITIES.map(r => [r, r]), ['fine', 'fine (Fine Print: a leader’s win only)']],
       { rr: 1 }
     )
   ) +
     textField('What it does (one sentence)', `${p}.d`, { area: 1, rows: 2, max: 160 }) +
     textField('Its line in battle (PK-1: when a row acts at a moment; {name} is the Billie)', `${p}.say`, {
       max: 40,
       opt: 1,
       ph: 'Approved, {name}!',
     }) +
     `<label class="fld"><span>Needs, to be offered (PK-4: team:Fire for a Billie of that type, mono; PK-5: bots, a scrapyard still ahead; PK-6: side, a side area still ahead)</span><input type="text" data-relic-needs="${escapeHtml(k)}" value="${escapeHtml(R.needs == null ? '' : [].concat(R.needs).join(', '))}" placeholder="team:Fire"></label>` +
     `<label class="fld"><span>Tags (PK-4: types and themes; offers lean ×${D.rules.run.perks.bias || 1} toward a match with the team’s types or a Perk held)</span><input type="text" data-relic-tags="${escapeHtml(k)}" value="${escapeHtml((R.tags || []).join(', '))}" placeholder="Fire, weather"></label>` +
     perkSetPickHTML(D, k, R) +
     perkArtHTML(k, R) +
     perkProblemHTML(P, `${k}.`, `${k}.fx[`),
   {
     sub:
       R.rarity === 'fine'
         ? /* PK-7: Fine Print: a leader's win's pick only, every one of its rarity as likely */
           `fine (Fine Print): offered only at a leader’s win, one of ${Object.values(L).filter(q => q.rarity === 'fine').length} there; never in a shop, an event or a reward pick.`
         : `${escapeHtml(R.rarity)}: ${perkPct(cov.chance[k])} to be drawn first at a pick; a shop asks ${D.rules.run.perks.price[R.rarity] || 0} Moneys.`,
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
 ${perkSetsHTML(D, P)}
 ${perkRarityHTML(D, cov, P)}</div></div>`;
};

/** PK-8: a Perk's set: its tag that is a set's id (perkSets.json), picked here; the tag is written in its Tags */
function perkSetPickHTML(/** @type {any} */ D, /** @type {string} */ k, /** @type {any} */ R) {
  const S = D.perkSets || {},
    on = (R.tags || []).find((/** @type {string} */ t) => Object.hasOwn(S, t)) || '';
  return `<label class="fld"><span>Set (PK-8: holding ${on ? S[on].need : 'its need'} of a set’s Perks gives its bonus; the set’s id goes in the Tags)</span><select data-relic-set="${escapeHtml(k)}"><option value="">No set</option>${Object.keys(
    S
  )
    .map(
      id =>
        `<option value="${escapeHtml(id)}"${id === on ? ' selected' : ''}>${escapeHtml(S[id].name)} (${escapeHtml(S[id].title)})</option>`
    )
    .join('')}</select></label>`;
}
/** PK-8: the Perk sets (perkSets.json): each set's name, its bonus's title and text, how many are needed, its Perks
 * and its rows (as words: edit the rows in perkSets.json), with perkSets.json's messages */
function perkSetsHTML(/** @type {any} */ D, /** @type {{ f: string, m: string }[]} */ P) {
  const S = D.perkSets || {},
    L = D.perks || {};
  if (!Object.keys(S).length) return '';
  const rowWords = (/** @type {any} */ f) =>
    [
      f.kind,
      f.what || f.rule || f.side || '',
      'mult' in f ? `×${f.mult}` : '',
      f.when ? `at ${f.when}` : '',
      f.if ? `if ${[].concat(f.if).join(', ')}` : '',
      f.once ? `once a ${f.once}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  return card(
    'Perk sets',
    Object.keys(S)
      .map(id => {
        const p = `perkSets.${id}`,
          members = Object.keys(L).filter(x => (L[x].tags || []).includes(id));
        return `<div data-perk-set="${escapeHtml(id)}"><h4 class="mono">${escapeHtml(id)}</h4>${grid(
          textField('Name', `${p}.name`, { max: 40 }),
          textField('Bonus title', `${p}.title`, { max: 40 }),
          numberField('Perks needed', `${p}.need`, { min: 2, max: 6, step: 1 })
        )}${textField('What the bonus does (one sentence)', `${p}.d`, { area: 1, rows: 2, max: 160 })}<p class="help">Its Perks (${members.length}): ${escapeHtml(members.map(x => L[x].name || x).join(', ') || 'none tagged yet')}</p><p class="help mono">${S[id].fx.map((/** @type {any} */ f) => escapeHtml(rowWords(f))).join(' · ')}</p>${P.filter(
          q => q.f === 'perkSets.json' && q.m.startsWith(id + '.')
        )
          .map(q => `<p class="err relic-err">${escapeHtml(q.m)}</p>`)
          .join('')}</div>`;
      })
      .join(''),
    {
      sub: 'PK-8: holding a set’s Perks (those tagged with its id) up to its need adds its bonus’s rows to the run. A Photocopier counts as itself, never as the Perk it copies. The rows are edited in perkSets.json.',
    }
  );
}
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
/* PK-4: a Perk's Needs and Tags, as a row's If: words split at commas (Tags always a list) */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset || (!el.dataset.relicNeeds && !el.dataset.relicTags)) return;
  const R = /** @type {any} */ (studioState.D.perks[el.dataset.relicNeeds || el.dataset.relicTags || '']);
  if (!R) return;
  const key = el.dataset.relicNeeds ? 'needs' : 'tags',
    was = JSON.stringify(R[key]),
    L = el.value
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);
  if (!L.length) delete R[key];
  else R[key] = key === 'tags' || L.length > 1 ? L : L[0];
  if (JSON.stringify(R[key]) === was) return;
  changed();
  render();
});
/* PK-8: a Perk's set: the set ids leave its tags, the one picked goes in (none removes them; no tags left, none) */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLSelectElement} */ (ev.target);
  if (!el.dataset || !el.dataset.relicSet) return;
  const R = /** @type {any} */ (studioState.D.perks[el.dataset.relicSet]),
    S = studioState.D.perkSets || {};
  if (!R) return;
  const was = JSON.stringify(R.tags),
    L = (R.tags || []).filter((/** @type {string} */ t) => !Object.hasOwn(S, t));
  if (el.value) L.push(el.value);
  if (L.length) R.tags = L;
  else delete R.tags;
  if (JSON.stringify(R.tags) === was) return;
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
/* PK-6: a give row's Bag items: id:n pairs split at commas (none removes them) */
document.addEventListener('change', ev => {
  const el = /** @type {HTMLInputElement} */ (ev.target);
  if (!el.dataset || !el.dataset.relicGive) return;
  const R = studioState.D.perks[el.dataset.relicGive],
    f = R && R.fx[+(el.dataset.n || 0)];
  if (!f) return;
  const was = JSON.stringify(f),
    /** @type {Record<string, number>} */
    items = {};
  for (const w of el.value.split(',')) {
    const [id, c] = w.split(':').map(q => q.trim());
    if (id) items[id] = c ? Math.round(Number(c)) || 1 : 1;
  }
  if (Object.keys(items).length) f.items = items;
  else delete f.items;
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
