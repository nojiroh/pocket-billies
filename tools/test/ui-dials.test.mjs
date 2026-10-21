// UI-3: the Studio's UI dials (game/js/logic/ui-dials.js): every dial is a place in uiTheme.json's schema with the
// schema's range, every value the schema allows has a dial, the defaults sit inside the ranges, and the helpers the
// UI section uses.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  UI_DIALS,
  UI_FAMILY_LABELS,
  UI_LAYERS,
  UI_ROLE_LABELS,
  uiCount,
  uiDialList,
  uiDiffCount,
  uiGet,
  uiGrade,
  uiPresetId,
  uiPresetValues,
  uiPrune,
  uiScopeGroups,
  uiScopePath,
} from '../../game/js/logic/ui-dials.js';
import { UI_ROLES, UI_SHAPE_FAMILIES } from '../../game/js/logic/ui-theme.js';

const read = f => readFileSync(join(import.meta.dirname, '../..', f), 'utf8');
const SCHEMA = JSON.parse(read('game/data/schema/uiTheme.schema.json'));
const THEME = JSON.parse(read('game/data/uiTheme.json'));

/** the schema node at a dotted path inside a look, $refs followed */
function schemaAt(path) {
  const deref = n => {
    while (n && n.$ref) n = SCHEMA.$defs[n.$ref.replace('#/$defs/', '')];
    return n;
  };
  let n = deref(SCHEMA.$defs.look);
  for (const k of path.split('.')) {
    n = deref(n && n.properties && n.properties[k]);
    if (!n) return null;
  }
  return n;
}

test('every dial is a place in the schema, with its range', () => {
  for (const { path, dial } of uiDialList()) {
    const n = schemaAt(path);
    assert.ok(n, `${path} is in the schema`);
    if (dial.kind === 'range') {
      assert.equal(dial.min, n.minimum, `${path} min`);
      assert.equal(dial.max, n.maximum, `${path} max`);
    }
    if (dial.kind === 'sel')
      assert.deepEqual(
        dial.options.map(o => o[0]),
        n.enum,
        `${path} options`
      );
  }
});

test('every value the schema allows in a look has a dial (a long hexagon has no corners to pick)', () => {
  const have = new Set(uiDialList().map(d => d.path)),
    hex = new Set(UI_FAMILY_LABELS.filter(f => f[2]).map(f => `shape.families.${f[0]}.corners`));
  const walk = (n, p) => {
    while (n && n.$ref) n = SCHEMA.$defs[n.$ref.replace('#/$defs/', '')];
    if (n && n.type === 'object' && n.properties)
      for (const [k, c] of Object.entries(n.properties)) walk(c, p ? `${p}.${k}` : k);
    else if (p !== 'name') assert.equal(have.has(p), !hex.has(p), `${p} has a dial`);
  };
  walk(SCHEMA.$defs.look, '');
  for (const [f, , isHex] of UI_FAMILY_LABELS) assert.equal(UI_SHAPE_FAMILIES[f].hex === true, isHex, f);
});

test("the game's look sits inside every dial's range", () => {
  for (const { path, dial } of uiDialList()) {
    const v = uiGet(THEME.defaults, path);
    assert.notEqual(v, undefined, `${path} is set in the defaults`);
    if (dial.kind === 'range') assert.ok(v >= dial.min && v <= dial.max, `${path} = ${v}`);
  }
});

test('the labels name every colour role and shape family; the layers are tokens.css’s', () => {
  assert.deepEqual(UI_ROLE_LABELS.map(r => r[0]).sort(), Object.keys(UI_ROLES).sort());
  assert.deepEqual(
    UI_FAMILY_LABELS.map(r => r[0]),
    Object.keys(UI_SHAPE_FAMILIES)
  );
  const tok = read('game/css/tokens.css');
  const z = [...tok.matchAll(/(--z-[\w-]+): (-?\d+);/g)].map(m => [m[1], +m[2]]);
  assert.deepEqual(
    UI_LAYERS.map(([n, v]) => [n, v]),
    z
  );
});

test('a screen shows colours, shape and layers; levels keep their values in their own place', () => {
  assert.deepEqual(
    uiScopeGroups('team').map(g => g.id),
    ['color', 'shape', 'layers']
  );
  assert.equal(uiScopeGroups('game').length, UI_DIALS.length);
  assert.equal(uiScopePath('game'), 'uiTheme.defaults');
  assert.equal(uiScopePath('battle'), 'uiTheme.overrides.battle');
});

test('prune, count and compare', () => {
  assert.deepEqual(uiPrune({ a: { b: undefined, c: {} }, d: [1], e: 0 }), { d: [1], e: 0 });
  assert.equal(uiCount({ a: { b: 1, c: [1, 2] }, d: 'x' }), 3);
  assert.equal(uiDiffCount(THEME.defaults, structuredClone(THEME.defaults)), 0);
  const t = structuredClone(THEME.defaults);
  t.color.dark.text = '#FFFFFF';
  t.motion.spring = [0, 0, 1, 1];
  delete t.space.s7;
  assert.equal(uiDiffCount(THEME.defaults, t), 3);
});

test('grades, presets and their ids', () => {
  assert.deepEqual([7.1, 5, 3.2, 2].map(uiGrade), ['AAA', 'AA', 'AA large', 'fail']);
  const P = THEME.presets.alpha05;
  const game = uiPresetValues(P, 'game');
  assert.equal(game.name, undefined);
  assert.ok(game.type && game.surface && game.color);
  assert.deepEqual(Object.keys(uiPresetValues(P, 'team')).sort(), ['color', 'shape']);
  game.color.light.text = '#000000';
  assert.equal(P.color.light.text, '#2E2140', 'a copy');
  assert.equal(uiPresetId('Misty morning!', {}), 'misty_morning');
  assert.equal(uiPresetId('Alpha 0.5', { alpha_0_5: 1 }), 'alpha_0_5_2');
  assert.equal(uiPresetId('12', {}), 'look');
});
