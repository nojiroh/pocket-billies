// UI-11: the colour code as data (uiTheme.json defaults.signals; game/js/logic/signals.js and ui-theme.js): every id
// in the data, the sheet's --sig-* lines on both sides, tokens.css's fallback, danger from the red family, the OKLab
// and colour-blind maths, and the checks (shades, dark text on fills, each screen's set apart; a planted clash fails).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  UI_CVD,
  UI_SIGNALS,
  UI_SIGNAL_IDS,
  UI_SIGNAL_MIN,
  UI_SIGNAL_SETS,
  cvdHex,
  nearestPair,
  oklab,
  oklabDistance,
  sigVar,
  signalSetColours,
  signalVars,
} from '../../game/js/logic/signals.js';
import { modeVars, uiSignalProblems, uiThemeContrast, uiThemeCss, uiThemeLook } from '../../game/js/logic/ui-theme.js';
import { dataUiTheme } from '../../game/js/logic/data-checks.js';

const read = f => readFileSync(join(import.meta.dirname, '../..', f), 'utf8');
const THEME = JSON.parse(read('game/data/uiTheme.json'));
const TYPES = JSON.parse(read('game/data/types.json'));
const SIG = THEME.defaults.signals;
const decls = (css, sel) => {
  const at = css.indexOf(sel + ' {');
  assert.ok(at >= 0, `no ${sel} block`);
  return Object.fromEntries(
    [...css.slice(at, css.indexOf('}', at)).matchAll(/(--[\w-]+): ([^;]+);/g)].map(m => [m[1], m[2]])
  );
};

test('the data holds a fill and both text shades for every id, and nothing else', () => {
  assert.equal(UI_SIGNALS.length, 15);
  assert.deepEqual(new Set(UI_SIGNALS.map(s => s[2])), new Set(['family', 'status', 'rarity']));
  for (const part of ['fill', 'light', 'dark']) assert.deepEqual(Object.keys(SIG[part]), UI_SIGNAL_IDS, part);
  assert.deepEqual(Object.keys(SIG), ['fill', 'light', 'dark']);
  // the hexes the owner picked (docs/phases/ui-track.md, "The colour code")
  assert.equal(SIG.fill.good, '#40D9C1');
  assert.equal(SIG.light.bad, '#BD2C42');
  assert.equal(SIG.dark.mythical, '#FF9A6B');
  for (const S of Object.values(UI_SIGNAL_SETS)) for (const id of S.ids) assert.ok(UI_SIGNAL_IDS.includes(id), id);
});

test('the sheet: the fills once on :root, each side its own text shades', () => {
  const css = uiThemeCss(THEME);
  const light = decls(css, ':root'),
    dark = decls(css, ":root[data-theme='dark']"),
    sys = decls(css, ":root:not([data-theme='light'])");
  for (const id of UI_SIGNAL_IDS) {
    assert.equal(light[sigVar(id)], SIG.fill[id].toLowerCase(), id);
    assert.equal(light[sigVar(id, true)], SIG.light[id].toLowerCase(), id);
    assert.equal(dark[sigVar(id, true)], SIG.dark[id].toLowerCase(), id);
    assert.equal(sys[sigVar(id, true)], SIG.dark[id].toLowerCase(), id);
    assert.equal(dark[sigVar(id)], undefined, `${id}'s fill is the same on both sides`);
  }
  assert.deepEqual(signalVars(undefined), { shared: [], light: [], dark: [] });
  // a screen's override declares no colour code of its own
  const t = structuredClone(THEME);
  t.overrides = { team: { color: { light: { text: '#102030' } } } };
  assert.ok(!/\/\* team \*\/[^]*--sig-/.test(uiThemeCss(t)));
});

test("tokens.css holds the data's colour code, for a page without uiTheme.json", () => {
  const tok = read('game/css/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const root = decls(tok, ':root'),
    dark = decls(tok, ":root[data-theme='dark']"),
    sys = decls(tok, ":root:not([data-theme='light'])");
  for (const id of UI_SIGNAL_IDS) {
    assert.equal(root[sigVar(id)], SIG.fill[id].toLowerCase(), id);
    assert.equal(root[sigVar(id, true)], SIG.light[id].toLowerCase(), id);
    assert.equal(dark[sigVar(id, true)], SIG.dark[id].toLowerCase(), id);
    assert.equal(sys[sigVar(id, true)], SIG.dark[id].toLowerCase(), id);
  }
});

test('danger is the red family: a palette without one takes the side’s red shade, and is checked as it', () => {
  const t = structuredClone(THEME);
  // today's defaults keep their own danger: nothing changes on screen
  assert.ok(
    modeVars(t.defaults.color.light, t.defaults, 'light').includes(
      `--c-danger: ${t.defaults.color.light.danger.toLowerCase()};`
    )
  );
  delete t.defaults.color.light.danger;
  delete t.defaults.color.dark.danger;
  const look = uiThemeLook(t);
  assert.ok(modeVars(look.color.light, look, 'light').includes('--c-danger: #bd2c42;'));
  assert.ok(modeVars(look.color.dark, look, 'dark').includes('--red: #ff8a9f;'));
  const css = uiThemeCss(t);
  assert.equal(decls(css, ":root[data-theme='dark']")['--c-danger'], '#ff8a9f');
  // the contrast check reads the same red
  t.defaults.signals.light.bad = '#F4EFE1';
  assert.ok(uiThemeContrast(t).some(f => f.fg === 'danger' && f.side === 'light'));
});

test('OKLab and the colour-blind simulation', () => {
  assert.deepEqual(
    oklab('#ffffff').map(v => Math.round(v)),
    [100, 0, 0]
  );
  assert.equal(Math.round(oklab('#000000')[0]), 0);
  assert.equal(oklabDistance('#40D9C1', '#40d9c1'), 0);
  assert.ok(oklabDistance('#ff0000', '#00ff00') > 40);
  // greys are seen the same by everyone; red and green fall together for protan and deutan
  for (const k of Object.keys(UI_CVD)) assert.ok(oklabDistance(cvdHex('#808080', k), '#808080') < 1, k);
  const rg = oklabDistance('#d03030', '#30a030'),
    seen = (/** @type {string} */ k) => oklabDistance(cvdHex('#d03030', k), cvdHex('#30a030', k));
  assert.ok(seen('protan') < rg);
  assert.ok(seen('deutan') < rg / 2);
  assert.ok(seen('tritan') > rg / 2, 'tritan keeps red and green apart');
  assert.equal(cvdHex('#40D9C1', ''), '#40d9c1');
  const near = nearestPair([
    ['a', '#000000'],
    ['b', '#ffffff'],
    ['c', '#010101'],
  ]);
  assert.deepEqual([near.a, near.b], ['a', 'c']);
});

test("each screen's set: the colour code's fills, and the types where the screen shows them", () => {
  const battle = signalSetColours(SIG, 'battle', TYPES);
  assert.equal(battle.length, UI_SIGNAL_SETS.battle.ids.length + TYPES.length);
  assert.ok(battle.some(([k]) => k === 'type Electric'));
  assert.equal(signalSetColours(SIG, 'map', TYPES).length, UI_SIGNAL_SETS.map.ids.length);
  assert.deepEqual(signalSetColours(SIG, 'nowhere', TYPES), []);
  // today's nearest pair is amber and Electric, as UI-10's script found
  const n = nearestPair(signalSetColours(SIG, 'pickups', TYPES));
  assert.deepEqual([n.a, n.b], ['caution', 'type Electric']);
  assert.ok(n.d >= UI_SIGNAL_MIN.distance && n.d < 6, String(n.d));
});

test('the checks pass on the data, and catch a clash, a shade that fails, dark text on a pale fill, a preset’s own code', () => {
  assert.deepEqual(uiSignalProblems(THEME, TYPES), []);
  assert.deepEqual(dataUiTheme({ uiTheme: THEME, types: TYPES }), []);
  // a planted clash: violet as good as the Perks' and the Dragon type's
  const t = structuredClone(THEME);
  t.defaults.signals.fill.special = '#AE7EE3';
  t.defaults.signals.fill.bio = '#AE7EE2';
  const clash = uiSignalProblems(t, TYPES).filter(f => / apart/.test(f.msg));
  assert.ok(
    clash.some(f => f.msg.startsWith('Pickups: Special (violet) and Bio (magenta)')),
    JSON.stringify(clash)
  );
  assert.ok(clash.every(f => f.rel.startsWith('signals.fill.')));
  assert.ok(
    dataUiTheme({ uiTheme: t, types: TYPES }).some(([f, m]) => f === 'uiTheme.json' && /colour code: Map/.test(m))
  );
  // two types too close is types.json's
  const two = uiSignalProblems(THEME, [
    { id: 'A', color: '#2C78C5' },
    { id: 'B', color: '#2C78C6' },
  ]);
  assert.ok(two.some(f => f.where === 'types' && f.rel === ''));
  // UI-13: a type's white text under 4.5:1, and a type off the others' lightness (alpha 0.5's Flying, #7F9BE0: both)
  const pale = uiSignalProblems(
    THEME,
    TYPES.map(T => (T.id === 'Flying' ? { ...T, color: '#7F9BE0' } : T))
  ).filter(f => f.where === 'types');
  assert.ok(
    pale.some(f => /^Flying's text reads at 2\.7\d:1/.test(f.msg)),
    JSON.stringify(pale)
  );
  assert.ok(
    pale.some(f => /^Flying sits at lightness 0\.70/.test(f.msg)),
    JSON.stringify(pale)
  );
  // Electric's dark ink keeps it out of the lightness rule
  assert.ok(!pale.some(f => f.msg.startsWith('Electric')));
  // a pale shade on the light side, a pale fill under dark text
  const u = structuredClone(THEME);
  u.defaults.signals.light.growth = '#82D7FF';
  u.defaults.signals.fill.bad = '#2A0A10';
  const p = uiSignalProblems(u, TYPES);
  assert.ok(p.some(f => f.rel === 'signals.light.growth' && /surface/.test(f.msg)));
  assert.ok(p.some(f => f.rel === 'signals.light.growth' && /ground/.test(f.msg)));
  assert.ok(p.some(f => f.rel === 'signals.fill.bad' && /dark text/.test(f.msg)));
  // a screen's own ground is checked too
  const v = structuredClone(THEME);
  v.overrides = { bag: { color: { dark: { surface: '#E0E0E0' } } } };
  assert.ok(uiSignalProblems(v, TYPES).some(f => f.where === 'screen:bag'));
  // the colour code is the same in every palette
  const w = structuredClone(THEME);
  w.presets.alpha05.signals = { fill: { good: '#40D9C1' } };
  assert.ok(uiSignalProblems(w, TYPES).some(f => f.where === 'preset:alpha05' && f.rel === 'signals'));
});

test('the schema: only the defaults set the colour code', () => {
  const S = JSON.parse(read('game/data/schema/uiTheme.schema.json'));
  assert.ok(S.properties.defaults.required.includes('signals'));
  assert.deepEqual(Object.keys(S.$defs.signals.properties), ['fill', 'light', 'dark']);
  for (const part of ['fill', 'light', 'dark'])
    assert.deepEqual(Object.keys(S.$defs.signals.properties[part].properties), UI_SIGNAL_IDS, part);
  assert.deepEqual(S.properties.presets.additionalProperties.allOf[1].not, { required: ['signals'] });
  assert.deepEqual(Object.keys(S.properties.overrides.additionalProperties.properties), ['color', 'shape']);
});
