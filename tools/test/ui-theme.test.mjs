// UI-1: game/data/uiTheme.json as a style sheet (game/js/logic/ui-theme.js): the three selectors the CSS uses for
// light and dark, the older variables each colour role also sets, presets over the defaults, and the fonts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { cssColour, roleVar, uiThemeCss, uiThemeLook, UI_ROLES } from '../../game/js/logic/ui-theme.js';

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
