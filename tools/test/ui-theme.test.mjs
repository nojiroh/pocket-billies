// UI-1: game/data/uiTheme.json as a style sheet (game/js/logic/ui-theme.js): the three selectors the CSS uses for
// light and dark, the older variables each colour role also sets, presets over the defaults, and the fonts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  cssColour,
  mergeLook,
  roleVar,
  shapeDecls,
  shapePoints,
  shapeVars,
  uiThemeCss,
  uiThemeLook,
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
  assert.equal(light['--c-ground'], '#f4efe0');
  assert.equal(dark['--c-ground'], '#17261e');
  assert.equal(light['--c-hp-ok'], '#2a9d8f');
  // the system-dark block and the Settings-dark block say the same
  const sys = css.slice(css.indexOf(":root:not([data-theme='light'])"));
  assert.deepEqual(blockOf(sys, ":root:not([data-theme='light'])"), dark);
});

test('each role also sets the older variables the screens read', () => {
  const light = blockOf(uiThemeCss(THEME), ':root');
  for (const [role, olds] of Object.entries(UI_ROLES))
    for (const v of olds) assert.equal(light[v], light[roleVar(role)], `${v} follows ${role}`);
  assert.equal(light['--text'], '#22301f');
  assert.equal(light['--gold'], light['--c-gold-b']);
  assert.equal(light['--g-bg'], 'rgba(255, 251, 240, 0.7)');
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
  assert.equal(uiThemeLook(THEME, 'no-such').color.light.text, '#22301F');
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
  assert.equal(css['--text'], '#22301f');
  // alpha05 is rounded: the look before UI-2
  assert.match(blockOf(uiThemeCss(THEME, { preset: 'alpha05' }), ':root')['--clip-card'], /^polygon\(0 16px, 0\.55px /);
});

test('the edge line and the drop shadows follow the text tint on the light side and black on the dark', () => {
  const css = uiThemeCss(THEME);
  assert.equal(blockOf(css, ':root')['--c-shadow'], '#22301f');
  assert.equal(blockOf(css, ':root')['--edge-lo'], 'rgba(34, 48, 31, 0.3)');
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
