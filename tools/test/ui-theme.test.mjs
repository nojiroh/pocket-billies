// UI-1: game/data/uiTheme.json as a style sheet (game/js/logic/ui-theme.js): the three selectors the CSS uses for
// light and dark, the older variables each colour role also sets, presets over the defaults, and the fonts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  cssColour,
  mergeLook,
  screenSel,
  solidOver,
  uiRatio,
  uiThemeContrast,
  UI_DERIVED,
  UI_SCREENS,
  roleVar,
  shapeDecls,
  shapePoints,
  shapeVars,
  uiThemeCss,
  uiThemeLook,
  uiPalettes,
  UI_FROM_SIGNALS,
  UI_ROLES,
  UI_SHAPE_DEFAULTS,
} from '../../game/js/logic/ui-theme.js';

const THEME = JSON.parse(readFileSync(join(import.meta.dirname, '../../game/data/uiTheme.json'), 'utf8'));

/** the declarations of the first block whose selector is `sel` */
const blockOf = (css, sel) => {
  const at = css.indexOf(sel + ' {');
  assert.ok(at >= 0, `no ${sel} block`);
  return Object.fromEntries(
    [...css.slice(at, css.indexOf('}', at)).matchAll(/(--[\w-]+): ([^;]+);/g)].map(m => [m[1], m[2]])
  );
};

test('names and colours', () => {
  assert.equal(roleVar('goldA'), '--c-gold-a');
  assert.equal(roleVar('hpOk'), '--c-hp-ok');
  assert.equal(cssColour('#22301F'), '#22301f');
  assert.equal(cssColour('#22301F2E'), 'rgba(34, 48, 31, 0.18)');
});

test('light on :root, dark under the system setting unless Settings says light, and under Settings dark', () => {
  const css = uiThemeCss(THEME);
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme='light'\]\) \{/);
  const light = blockOf(css, ':root'),
    dark = blockOf(css, ":root[data-theme='dark']");
  assert.equal(light['--c-ground'], '#f0e5cf');
  assert.equal(dark['--c-ground'], '#1a1611');
  assert.equal(light['--c-hp-ok'], '#007e6e', 'UI-12: the colour code’s teal, the light shade');
  // the system-dark block and the Settings-dark block say the same
  const sys = css.slice(css.indexOf(":root:not([data-theme='light'])"));
  assert.deepEqual(blockOf(sys, ":root:not([data-theme='light'])"), dark);
});

test('each role also sets the older variables the screens read', () => {
  const light = blockOf(uiThemeCss(THEME), ':root');
  for (const [role, olds] of Object.entries(UI_ROLES))
    for (const v of olds) assert.equal(light[v], light[roleVar(role)], `${v} follows ${role}`);
  assert.equal(light['--text'], '#2e1f14');
  assert.equal(light['--gold'], light['--c-gold-b']);
  assert.equal(light['--g-bg'], 'rgba(250, 243, 227, 0.7)');
  assert.equal(light['--g-blur'], 'blur(12px) saturate(1.4)');
  assert.equal(light['--cut-lg'], '12px');
  assert.equal(light['--slant'], '10deg');
});

test('a preset lays its groups over the defaults; alpha05 is the look before UI-1', () => {
  const look = uiThemeLook(THEME, 'alpha05');
  assert.equal(look.color.light.text, '#2E2140');
  assert.equal(look.shape.cutLg, 12, 'a group the preset leaves out keeps the defaults');
  const light = blockOf(uiThemeCss(THEME, { preset: 'alpha05' }), ':root');
  assert.equal(light['--text'], '#2e2140');
  assert.equal(light['--g-blur'], 'blur(16px) saturate(1.5)');
  assert.equal(light['--font-voice'], "'Pixelify Sans', ui-monospace, monospace");
  assert.equal(light['--g-in'], 'inset 0 1px 0 rgba(255, 255, 255, 0.9)');
  assert.equal(uiThemeLook(THEME, 'no-such').color.light.text, '#2E1F14');
});

test("UI-3: looks merge at every depth; lists are replaced; a preset's name stays out of the look", () => {
  const m = mergeLook({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3] }, e: 2 });
  assert.deepEqual(m, { a: { b: 1, c: [3] }, d: 1, e: 2 });
  const look = uiThemeLook(THEME, 'alpha05');
  assert.equal(look.name, undefined);
  assert.equal(look.shape.families.panel.kind, 'rounded');
  assert.deepEqual(look.shape.families.panel.corners, ['tl', 'br'], "the corners stay the defaults'");
  assert.equal(look.surface.dark.edgeHi, 0.2, 'a side the preset leaves out keeps the defaults');
  assert.equal(THEME.presets.alpha05.name, 'Alpha 0.5');
});

test("UI-3: a family's cut size and corners are data", () => {
  const all = shapePoints('panel', {
    ...UI_SHAPE_DEFAULTS,
    families: { panel: { corners: ['tl', 'tr', 'br', 'bl'] } },
  });
  assert.equal(all.length, 8, 'four cuts');
  const sm = shapeVars('panel', { ...UI_SHAPE_DEFAULTS, families: { panel: { size: 'cutSm' } } });
  assert.match(sm['--clip-panel'], /^polygon\(0 4px, 4px 0, /);
  const css = blockOf(
    uiThemeCss({ ...THEME, defaults: mergeLook(THEME.defaults, { shape: { families: { tab: { corners: [] } } } }) }),
    ':root'
  );
  assert.equal(css['--clip-tab'], 'polygon(0 0, 100% 0, 100% 100%, 0 100%)');
});

test('UI-3: space, text sizes, motion, depth and drop shadows are written from the data', () => {
  const css = uiThemeCss(THEME),
    light = blockOf(css, ':root'),
    dark = blockOf(css, ":root[data-theme='dark']");
  assert.equal(light['--s5'], '24px');
  assert.equal(light['--fs-title'], 'clamp(20px, 1rem + 1.2vw, 24px)', 'the same text as tokens.css at scale 1');
  assert.equal(light['--m-base'], '240ms');
  assert.equal(light['--spring'], 'cubic-bezier(0.3, 1.6, 0.5, 1)');
  assert.equal(
    light['--g-sh'],
    'rgba(46, 31, 20, 0.42)'.replace(/^/, '0 10px 28px -10px ') + ', 0 2px 6px rgba(46, 31, 20, 0.14)'
  );
  assert.equal(
    dark['--g-sh2'],
    '0 18px 38px -10px rgba(0, 0, 0, 0.75), 0 3px 8px rgba(0, 0, 0, 0.4)',
    'the old dark glass (base.css, was v05.css)'
  );
  assert.equal(dark['--g-in'], 'inset 0 1px 0 rgba(255, 255, 255, 0.12)');
  assert.match(
    light['--drop-raised'],
    /^drop-shadow\(0 6px 7px color-mix\(in srgb, var\(--c-shadow\) 24%, transparent\)\)/
  );
  const big = blockOf(
    uiThemeCss({ ...THEME, defaults: mergeLook(THEME.defaults, { type: { scale: 1.2 }, motion: { fast: 0 } }) }),
    ':root'
  );
  assert.equal(big['--fs-caption'], 'clamp(14.4px, 0.84rem + 0.36vw, 15.6px)');
  assert.equal(big['--m-fast'], '0ms');
});

test("tokens.css's scales are the data's defaults (a page without uiTheme.json looks the same)", () => {
  const tok = readFileSync(join(import.meta.dirname, '../../game/css/tokens.css'), 'utf8');
  const root = blockOf(tok.replace(/\/\*[\s\S]*?\*\//g, ''), ':root');
  const light = blockOf(uiThemeCss(THEME), ':root');
  for (const k of [
    '--s1',
    '--s4',
    '--s7',
    '--gutter',
    '--fs-caption',
    '--fs-body',
    '--fs-title',
    '--fs-screen',
    '--lh-prose',
    '--m-fast',
    '--m-base',
    '--m-slow',
    '--stagger',
    '--ease-out',
    '--ease-in',
  ])
    assert.equal(light[k], root[k], k);
  const norm = (/** @type {string} */ v) => v.replace(/\s+/g, ' ');
  assert.equal(norm(light['--drop-raised']), norm(root['--drop-raised']));
  assert.equal(norm(light['--drop-float']), norm(root['--drop-float']));
});

test('fonts: the voice font is scaled and never fake-bolded; @font-face only with a fonts folder', () => {
  const css = uiThemeCss(THEME, { fonts: 'https://x/game/fonts/' });
  assert.match(
    css,
    /font-family: 'Jersey 15';\n {2}font-weight: 400;\n {2}font-display: swap;\n {2}size-adjust: 118%;\n {2}src: url\(https:\/\/x\/game\/fonts\/jersey-15-400\.woff2\)/
  );
  assert.match(css, /font-family: 'Oxanium';\n {2}font-weight: 600;\n {2}font-display: swap;\n {2}src:/);
  assert.match(css, /font-synthesis-weight: none/);
  assert.doesNotMatch(uiThemeCss(THEME), /@font-face/);
  // Pixelify has its weights: no synthesis rule, no size-adjust
  const old = uiThemeCss(THEME, { preset: 'alpha05', fonts: 'f/' });
  assert.doesNotMatch(old, /font-synthesis-weight|size-adjust/);
});

test('no theme, no sheet', () => {
  assert.equal(uiThemeCss(null), '');
  assert.equal(uiThemeCss({ version: 1 }), '');
});

test('every font the schema allows has files in game/fonts', () => {
  const schema = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../game/data/schema/uiTheme.schema.json'), 'utf8')
  );
  const fams = [...schema.$defs.type.properties.voice.enum, ...schema.$defs.type.properties.prose.enum];
  for (const fam of fams) {
    const t = uiThemeCss({ version: 1, defaults: { type: { voice: fam, prose: fam } } }, { fonts: 'F/' });
    for (const m of t.matchAll(/url\(([^)]+)\)/g))
      assert.doesNotThrow(
        () => readFileSync(join(import.meta.dirname, '../../game/fonts', m[1].slice(2))),
        `${fam}: ${m[1]}`
      );
    assert.match(t, /@font-face/, `${fam} has files`);
  }
});

// UI-2: the angular shapes as clip-path polygons
test('the default shapes: two cuts on a panel, four on a card, a long hexagon for the main action', () => {
  const light = blockOf(uiThemeCss(THEME), ':root');
  assert.equal(
    light['--clip-panel'],
    'polygon(0 12px, 12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)'
  );
  assert.equal(shapePoints('card', UI_SHAPE_DEFAULTS).length, 8);
  assert.equal(
    light['--clip-action'],
    'polygon(0 50%, 12px 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 12px 100%)'
  );
  assert.equal(light['--clip-tab'], 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)');
  // the edge ring is the outline and the outline 1 px in, as one evenodd polygon; the diagonal moves in by 1 px
  assert.match(light['--edge-card'], /^polygon\(evenodd, 0 8px, .*, 0 8px, 1px 9\.41px, 9\.41px 1px, /);
  // the shadow ring: a box 48 px out, then the outline (cut out of it)
  assert.match(
    light['--ring-panel'],
    /^polygon\(evenodd, -48px -48px, calc\(100% \+ 48px\) -48px, .*, 0 12px, 12px 0, /
  );
});

test('a family can be rounded or square, and cuts can be stepped like pixel art', () => {
  const round = shapePoints('panel', { ...UI_SHAPE_DEFAULTS, families: { panel: { kind: 'rounded' } } });
  assert.equal(round.length, 4 * 7, 'seven points an arc');
  assert.deepEqual(round[0], [0, 0, 0, 22]);
  const sq = shapeVars('card', { ...UI_SHAPE_DEFAULTS, families: { card: { kind: 'square' } } });
  assert.equal(sq['--clip-card'], 'polygon(0 0, 100% 0, 100% 100%, 0 100%)');
  // a 12 px cut in 4 px steps: three stairs from the left edge to the top edge
  const st = shapePoints('panel', { ...UI_SHAPE_DEFAULTS, stepped: true });
  assert.deepEqual(
    st.slice(0, 7).map(([, x, , y]) => [x, y]),
    [
      [0, 12],
      [4, 12],
      [4, 8],
      [8, 8],
      [8, 4],
      [12, 4],
      [12, 0],
    ]
  );
  // the stepped preset changes the shapes only
  const css = blockOf(uiThemeCss(THEME, { preset: 'stepped' }), ':root');
  assert.match(css['--clip-panel'], /^polygon\(0 12px, 4px 12px, 4px 8px, /);
  assert.equal(css['--text'], '#2e1f14');
  // alpha05 is rounded: the look before UI-2
  assert.match(blockOf(uiThemeCss(THEME, { preset: 'alpha05' }), ':root')['--clip-card'], /^polygon\(0 16px, 0\.55px /);
});

test('the edge line and the drop shadows follow the text tint on the light side and black on the dark', () => {
  const css = uiThemeCss(THEME);
  assert.equal(blockOf(css, ':root')['--c-shadow'], '#2e1f14');
  assert.equal(blockOf(css, ':root')['--edge-lo'], 'rgba(46, 31, 20, 0.3)');
  assert.equal(blockOf(css, ":root[data-theme='dark']")['--c-shadow'], '#000000');
});

test("tokens.css holds the generator's default shapes, for a page without uiTheme.json", () => {
  const tok = readFileSync(join(import.meta.dirname, '../../game/css/tokens.css'), 'utf8');
  const part = tok.slice(tok.indexOf('/* shapes: start */') + 19, tok.indexOf('/* shapes: end */'));
  const norm = s =>
    s
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')')
      .replace(/,\s*\)/g, ')')
      .trim();
  assert.equal(norm(part), norm(shapeDecls({}).join(' ')));
});

test('the dialogue bubble: a panel with a speech tail on its top edge, its layers reaching the tail height above', () => {
  const light = blockOf(uiThemeCss(THEME), ':root');
  // the top edge sits 18 px down (the tail: 1.5 x the 12 px cut); the tail stands at 52 px: up 18, then back at 45°
  assert.equal(
    light['--clip-bubble'],
    'polygon(0 30px, 12px 18px, 52px 18px, 52px 0, 70px 18px, 100% 18px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)'
  );
  assert.equal(light['--bubble-tail'], '18px');
  // inset by 1 px, the tail's tip sits 1 + √2 down and its 45° side meets the top edge √2 − 1 short
  assert.match(light['--edge-bubble'], /, 53px 19px, 53px 2\.41px, 69\.59px 19px, /);
  // rounded (alpha05) keeps the tail
  assert.match(
    blockOf(uiThemeCss(THEME, { preset: 'alpha05' }), ':root')['--clip-bubble'],
    /, 52px 18px, 52px 0, 70px 18px, /
  );
});

test("UI-3: a screen's override: its colours and shapes on its root (and on data-ui-screen), both sides", () => {
  const T = {
    ...THEME,
    overrides: {
      team: { color: { light: { text: '#102010' }, dark: { text: '#F0FFF0' } } },
      battle: { shape: { cutLg: 20 } },
    },
  };
  const css = uiThemeCss(T);
  assert.equal(screenSel('team'), ".screen.s-team, [data-ui-screen='team']");
  const team = blockOf(css, ":is(.screen.s-team, [data-ui-screen='team'])");
  assert.equal(team['--c-text'], '#102010');
  assert.equal(team['--text'], '#102010');
  assert.equal(team['--c-ground'], '#f0e5cf', 'the rest of the palette comes along, so derived values follow');
  assert.equal(team['--depth-raised'], 'var(--g-in), var(--g-sh)');
  assert.equal(team['--clip-panel'], undefined, 'no shapes without a shape override');
  const dark = blockOf(css, ":root[data-theme='dark'] :is(.screen.s-team, [data-ui-screen='team'])");
  assert.equal(dark['--c-text'], '#f0fff0');
  assert.match(
    css,
    /@media \(prefers-color-scheme: dark\) \{\n {2}:root:not\(\[data-theme='light'\]\) :is\(\.screen\.s-team/
  );
  const battle = blockOf(css, ":is(#battle, [data-ui-screen='battle'])");
  assert.equal(battle['--cut-lg'], '20px');
  assert.match(battle['--clip-panel'], /^polygon\(0 20px, 20px 0, /);
  assert.equal(battle['--c-text'], undefined, 'no colours without a colour override');
  assert.ok(!css.includes(":root[data-theme='dark'] :is(#battle"));
  // the whole game's sheet is unchanged by an empty override
  assert.equal(uiThemeCss({ ...THEME, overrides: { map: {} } }), uiThemeCss(THEME));
  const schema = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../game/data/schema/uiTheme.schema.json'), 'utf8')
  );
  assert.deepEqual(
    schema.properties.overrides.propertyNames.enum,
    Object.keys(UI_SCREENS),
    'the schema names the same screens'
  );
});

test("UI-3: the variables a screen declares again are the style sheets' own", () => {
  const css = ['tokens.css', 'base.css']
    .map(f => readFileSync(join(import.meta.dirname, '../../game/css/' + f), 'utf8'))
    .join('\n');
  const norm = (/** @type {string} */ v) => v.replace(/\s+/g, ' ').trim();
  for (const line of UI_DERIVED) {
    const [, name, value] = /** @type {RegExpMatchArray} */ (line.match(/^(--[\w-]+): (.*);$/));
    const m = css.match(new RegExp(`\\n\\s*${name}:([^;]+);`));
    assert.ok(m, name);
    assert.equal(norm(m[1]), norm(value), name);
  }
});

test('UI-3: contrast: text at 4.5:1, danger and primary at 3:1, overrides too; alpha over the ground', () => {
  assert.equal(solidOver('#00000080', '#FFFFFF'), '#7f7f7f');
  assert.equal(solidOver('#123456', '#FFFFFF'), '#123456');
  assert.ok(Math.abs(uiRatio('#000000', '#FFFFFF') - 21) < 0.01);
  assert.deepEqual(uiThemeContrast(THEME), [], "the game's look passes");
  const bad = uiThemeContrast({ ...THEME, overrides: { team: { color: { dark: { text2: '#2A3A30' } } } } });
  assert.deepEqual(
    bad.map(f => [f.where, f.side, f.fg, f.bg, f.min]),
    [
      ['screen:team', 'dark', 'text2', 'ground', 4.5],
      ['screen:team', 'dark', 'text2', 'surface', 4.5],
    ]
  );
  const red = uiThemeContrast({
    ...THEME,
    defaults: mergeLook(THEME.defaults, { color: { light: { danger: '#F0A090' } } }),
  });
  assert.deepEqual(
    red.map(f => [f.where, f.fg, f.min]),
    [
      ['', 'danger', 3],
      ['', 'danger', 3],
      // UI-12: the players' palettes leave danger to the defaults and are checked in full; the Studio's presets aren't
      ['preset:copper_grove', 'danger', 3],
      ['preset:copper_grove', 'danger', 3],
      ['preset:bureau_night', 'danger', 3],
      ['preset:bureau_night', 'danger', 3],
    ]
  );
});

test('UI-12: Field Guide is the defaults; danger and HP come from the colour code; the palettes players pick', () => {
  const light = blockOf(uiThemeCss(THEME), ':root'),
    dark = blockOf(uiThemeCss(THEME), ":root[data-theme='dark']");
  assert.equal(THEME.defaults.name, 'Field Guide');
  for (const side of ['light', 'dark'])
    for (const role of Object.keys(UI_FROM_SIGNALS))
      assert.equal(THEME.defaults.color[side][role], undefined, `${side} ${role} is the colour code's`);
  assert.equal(light['--c-danger'], '#bd2c42');
  assert.equal(light['--c-hp-ok'], '#007e6e');
  assert.equal(light['--c-hp-mid'], '#9a5505');
  assert.equal(light['--c-hp-low'], '#bd2c42');
  assert.equal(dark['--c-hp-ok'], '#57d6c0');
  assert.equal(light['--c-ink'], '#1a1611', 'dark text: the dark side’s ground');
  assert.equal(light['--c-map-grass'], '#5e721f');
  assert.deepEqual(uiPalettes(THEME), [
    ['', 'Field Guide'],
    ['copper_grove', 'Copper Grove+'],
    ['bureau_night', 'Bureau Night'],
  ]);
  assert.deepEqual(uiPalettes(undefined), []);
  // a preset players pick names every colour role but those the colour code fills in
  const roles = Object.keys(UI_ROLES).filter(r => !(r in UI_FROM_SIGNALS));
  for (const id of ['copper_grove', 'bureau_night', 'brass_plum', 'sunpunk_day'])
    for (const side of ['light', 'dark'])
      assert.deepEqual(Object.keys(THEME.presets[id].color[side]).sort(), [...roles].sort(), `${id} ${side}`);
  assert.equal(uiThemeLook(THEME, 'bureau_night').player, undefined, 'player stays out of the look');
  const bn = blockOf(uiThemeCss(THEME, { preset: 'bureau_night' }), ':root');
  assert.equal(bn['--c-ground'], '#e6eaef');
  assert.equal(bn['--c-danger'], '#bd2c42', 'the colour code is the same in every palette');
  assert.equal(bn['--c-ink'], '#0b111f');
  // a Studio-only preset is held to text only; marked player, to everything
  const pale = mergeLook(THEME, { presets: { sunpunk_day: { color: { light: { primary: '#C0E0F0' } } } } });
  assert.deepEqual(uiThemeContrast(pale), []);
  pale.presets.sunpunk_day.player = true;
  assert.ok(uiThemeContrast(pale).some(f => f.where === 'preset:sunpunk_day' && f.fg === 'primary'));
});

test('UI-12: reduced transparency makes the glass solid on both sides, after the palettes', () => {
  const css = uiThemeCss(THEME),
    at = css.indexOf('@media (prefers-reduced-transparency: reduce)');
  assert.ok(at > css.lastIndexOf(":root[data-theme='dark']"), 'after the dark blocks');
  const rule = css.slice(at, css.indexOf('}\n}', at));
  assert.match(rule, /:root:not\(\[data-theme='light'\]\),\n {2}:root\[data-theme='light'\] \{/);
  assert.match(rule, /--g-blur: none;/);
  assert.match(rule, /--g-bg: var\(--g-solid\);/);
});
