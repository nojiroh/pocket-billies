// UI-14a: the marks kit as data (game/js/logic/marks.js) and its parts (game/js/ui-marks-kit.js): every status, stat,
// short effect, currency, node type and rarity tier the game's data names has a mark; each mark has a colour code id,
// a glyph or arrow and a word (never colour alone); the tag row folds into "+N"; the kit's styles stay within the
// track's rules (no :host-context, no new animation, tokens only).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  MARK_CHIP_FAMILIES,
  MARK_EFFECT_NAMES,
  MARK_PATTERNS,
  MARK_RARITY,
  MARK_ROW_MAX,
  MARK_STAT_SHORT,
  MARK_STATUS_CODES,
  chipLook,
  fxTags,
  markRow,
  rarityHighest,
  rarityTier,
  tagLook,
} from '../../game/js/logic/marks.js';
import { RUN_MARK_TYPES, runMarkLook } from '../../game/js/logic/run-marks.js';
import { UI_GLYPHS, UI_SIGNAL_IDS } from '../../game/js/logic/signals.js';

const ROOT = join(import.meta.dirname, '../..');
const read = f => readFileSync(join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
const iconExists = k => {
  try {
    read(`game/art/ui/${k}.svg`);
    return true;
  } catch {
    return false;
  }
};

test('every status has its code, glyph, colour and word', () => {
  for (const s of json('game/data/statuses.json')) {
    const L = tagLook({ kind: 'status', mark: s.id, word: s.name });
    assert.equal(L.code, MARK_STATUS_CODES[s.id], s.id);
    assert.match(L.code, /^[A-Z]{3}$/);
    assert.equal(L.sig, s.id, `${s.id}: its own colour (--sig-${s.id})`);
    assert.ok(iconExists(L.glyph), `${s.id}: glyph ${L.glyph}`);
    assert.equal(L.word, s.name);
  }
  assert.equal(tagLook({ kind: 'status', mark: 'brn' }).word, 'Burned');
});

test('boosts and drops: the arrow first, teal up and red down, the short name, pips up to 6', () => {
  const stats = json('game/data/stats.json').filter(s => s.id !== 'hp');
  assert.deepEqual(Object.keys(MARK_STAT_SHORT).sort(), stats.map(s => s.id).sort(), 'a short name for every stat');
  assert.deepEqual(
    Object.values(MARK_STAT_SHORT).map(s => s[0]),
    ['Atk', 'Def', 'SpA', 'SpD', 'Spe']
  );
  for (const s of stats) assert.equal(MARK_STAT_SHORT[s.id][1], s.name, `${s.id}: the word is stats.json's`);
  const up = tagLook({ kind: 'stat', stat: 'hus', stages: 2 });
  assert.deepEqual([up.arrow, up.sig, up.code, up.pips], ['▲', 'good', 'Spe', 2]);
  assert.equal(up.word, 'Speed up 2 stages');
  const down = tagLook({ kind: 'stat', stat: 'lev', stages: -1 });
  assert.deepEqual([down.arrow, down.sig, down.code, down.pips], ['▼', 'bad', 'Atk', 1]);
  assert.equal(down.word, 'Attack down 1 stage');
  assert.equal(tagLook({ kind: 'stat', stat: 'law', stages: 9 }).pips, 6, 'pips stop at stageMax');
  assert.equal(json('game/data/rules.json').battle.stageMax, 6);
});

test('short effects: every effect glyph has a word; turns left are counted and spoken', () => {
  assert.deepEqual(Object.keys(MARK_EFFECT_NAMES).sort(), Object.keys(UI_GLYPHS.effect).sort());
  for (const id of Object.keys(UI_GLYPHS.effect)) {
    const L = tagLook({ kind: 'effect', mark: id, turns: 3 });
    assert.ok(L.glyph && iconExists(L.glyph), id);
    assert.ok(UI_SIGNAL_IDS.includes(L.sig), `${id}: ${L.sig}`);
    assert.equal(L.turns, 3);
    assert.match(L.word, /3 turns left$/);
  }
  assert.equal(tagLook({ kind: 'effect', mark: 'protect', turns: 1 }).word, 'Protect, 1 turn left');
  assert.equal(tagLook({ kind: 'effect', mark: 'stones' }).word, 'Stones');
});

test('no mark is colour alone: each has a glyph, an arrow or a code, and a word', () => {
  const all = [
    ...Object.keys(MARK_STATUS_CODES).map(mark => ({ kind: 'status', mark })),
    ...Object.keys(MARK_STAT_SHORT).flatMap(stat => [1, -2].map(stages => ({ kind: 'stat', stat, stages }))),
    ...Object.keys(UI_GLYPHS.effect).map(mark => ({ kind: 'effect', mark, turns: 2 })),
    { kind: 'more', n: 2 },
    { kind: 'status', mark: 'nope' },
  ];
  for (const t of all) {
    const L = tagLook(t);
    assert.ok(L.glyph || L.arrow || L.code, JSON.stringify(t));
    assert.ok(L.word, JSON.stringify(t));
  }
});

test('the tag row: the status first, then boosts and drops, then effects; past 3 the last spot is "+N"', () => {
  const tags = [
    { kind: 'effect', mark: 'protect', turns: 1 },
    { kind: 'stat', stat: 'lev', stages: 1 },
    { kind: 'status', mark: 'brn' },
    { kind: 'stat', stat: 'hus', stages: -1 },
    { kind: 'effect', mark: 'soaked', turns: 2 },
  ];
  const row = markRow(tags);
  assert.equal(row.length, MARK_ROW_MAX);
  assert.deepEqual(
    row.map(t => t.kind),
    ['status', 'stat', 'more']
  );
  assert.equal(row[2].n, 3);
  assert.equal(tagLook(row[2]).code, '+3');
  assert.equal(markRow(tags.slice(0, 3)).length, 3, 'three fit without a "+N"');
  assert.deepEqual(markRow([]), []);
});

test('rarity: the four tiers of the ladder; starter shows as common', () => {
  assert.deepEqual(Object.keys(MARK_RARITY), ['common', 'uncommon', 'rare', 'mythical']);
  for (const r of Object.keys(json('game/data/rarities.json')))
    assert.ok(MARK_RARITY[rarityTier(r)], `${r} has a tier on the ladder`);
  assert.equal(rarityTier('starter'), 'common');
  assert.equal(rarityTier('Rare'), 'rare');
  assert.equal(rarityTier('legendary'), '');
  const sig = json('game/data/uiTheme.json').defaults.signals;
  for (const r of Object.keys(MARK_RARITY))
    for (const k of ['fill', 'light', 'dark']) assert.ok(sig[k][r], `${r}: a ${k} in the colour code`);
});

test('UI-14b: held items, Augments and Genes each name a tier; the rarer of two shows', () => {
  const tiers = Object.keys(MARK_RARITY);
  for (const [k, I] of Object.entries(json('game/data/items.json')))
    if (I.hold) assert.ok(tiers.includes(I.rarity), `items.json ${k}: ${I.rarity}`);
    else assert.equal(I.rarity, undefined, `items.json ${k}: only held items have a tier`);
  for (const [k, P] of Object.entries(json('game/data/robots.json').parts))
    assert.ok(P.rar === 'boss' || tiers.includes(P.rar), `robots.json ${k}: ${P.rar}`);
  for (const [k, T] of Object.entries(json('game/data/genes.json').traits))
    assert.ok(tiers.includes(T.rarity), `genes.json ${k}: ${T.rarity}`);
  assert.equal(rarityHighest(['common', 'rare', 'uncommon']), 'rare');
  assert.equal(rarityHighest(['starter']), 'common');
  assert.equal(rarityHighest(['boss', undefined]), '');
  assert.equal(rarityHighest([]), '');
});

test('UI-14b: effect rows as tags: stat rows become boosts and drops with Atk..Spe, the rest none', () => {
  assert.deepEqual(
    fxTags([
      { kind: 'stat', stat: 'hus', stages: 1 },
      { kind: 'xp', mult: 1.5 },
    ]),
    [{ kind: 'stat', stat: 'hus', stages: 1 }]
  );
  assert.deepEqual(fxTags(undefined), []);
  assert.equal(tagLook(fxTags([{ kind: 'stat', stat: 'lob', stages: -2 }])[0]).code, 'SpA');
  /* every stat row in the game's data names a stat with a short name */
  const rows = [
    ...Object.values(json('game/data/items.json')).flatMap(I => I.hold || []),
    ...Object.values(json('game/data/genes.json').traits).flatMap(T => T.fx),
    ...Object.values(json('game/data/perks.json')).flatMap(P => P.fx || []),
  ];
  for (const t of fxTags(rows)) assert.ok(MARK_STAT_SHORT[t.stat], `${t.stat} has a short name`);
});

test('chips: every currency, node type and family has its family and an icon that exists', () => {
  const kinds = [
    ...Object.keys(json('game/data/currencies.json')),
    ...Object.keys(json('game/data/nodeTypes.json')),
    ...UI_SIGNAL_IDS.slice(0, 8),
  ];
  for (const k of kinds) {
    assert.ok(MARK_CHIP_FAMILIES[k], `${k} has a family`);
    const L = chipLook(k);
    assert.ok(L.sig === '' || UI_SIGNAL_IDS.includes(L.sig), `${k}: ${L.sig}`);
    if (L.icon) assert.ok(iconExists(L.icon), `${k}: icon ${L.icon}`);
    assert.ok(L.icon || L.sig === '', `${k}: a coloured chip has an icon`);
  }
  for (const [k, c] of Object.entries(json('game/data/currencies.json')))
    assert.equal(chipLook(k).icon, c.icon, `${k}: currencies.json's icon`);
  /* UI-14b: a node's chip shows UI-8c's place icon, the bowl's; a stall and a ghost keep their family's glyph */
  for (const k of RUN_MARK_TYPES)
    if (MARK_CHIP_FAMILIES[k]) assert.equal(chipLook(k).icon, runMarkLook(k).icon, `${k}: the bowl's icon`);
  assert.deepEqual(chipLook('town'), { sig: 'good', icon: 'node-town', glyph: false });
  assert.deepEqual(chipLook('stall'), { sig: 'value', icon: 'g-value', glyph: true });
  assert.deepEqual(chipLook('town', { icon: 'house' }), { sig: 'good', icon: 'house', glyph: false });
  assert.deepEqual(chipLook('info', { family: 'special' }), { sig: 'special', icon: 'g-special', glyph: true });
});

test('patterns for the Colour shapes switch name real colour code ids, and the look ids are covered', () => {
  for (const id of Object.keys(MARK_PATTERNS)) assert.ok(UI_SIGNAL_IDS.includes(id), id);
  const kit = read('game/js/ui-kit.js');
  for (const p of new Set(Object.values(MARK_PATTERNS))) assert.ok(kit.includes(`--pat-${p}:`), `pattern ${p}`);
  assert.match(read('game/css/tokens.css'), /:root\[data-shapes='on'\] \{\s*--pat-ink: var\(--pat-ink-on\);/);
  assert.match(read('game/css/tokens.css'), /--pat-ink: transparent;/, 'off by default');
});

test('the kit stays within the track: no :host-context, no new keyframes or loops, no hex colours', () => {
  const src = read('game/js/ui-marks-kit.js');
  assert.ok(!src.includes(':host-context'), 'Safari ignores :host-context (UI-16a removes the old ones)');
  assert.ok(!/@keyframes/.test(src), 'motion is UI-16a/b’s: no keyframes here');
  assert.ok(!/infinite/.test(src), 'no loops');
  assert.ok(!/requestAnimationFrame/.test(src), 'pb-chip counts with pb-coin’s own code');
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(src.replace(/&#\d+;/g, '')), 'colours come from tokens');
  for (const tag of ['pb-tag', 'pb-chip', 'pb-proc', 'pb-info', 'pb-rarity']) assert.ok(src.includes(`'${tag}'`), tag);
});
