// UI-1: tools/ui-lint.mjs counts raw values per rule on a small fixture, and the whole-game report runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintCss, lintJs, lintGame, report } from '../ui-lint.mjs';

const CSS = `
:root { --r-sm: 12px; --text: #222; }
/* a comment with #fff and 10px that must not count */
.a { border-radius: 10px; padding: 6px 0 var(--s2) 3px; color: #fff; z-index: 5; }
.b { border-radius: var(--r-md); margin: var(--s4); box-shadow: var(--depth-raised); }
.c { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2) !important; transition: transform 0.2s, opacity var(--m-fast); }
.d { -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); font-family: 'Chakra Petch', sans-serif; }
.e { backdrop-filter: none; font-family: var(--font-voice); }
@keyframes spin { to { transform: rotate(1turn); } }
@font-face { font-family: 'Tiny5'; src: url(x.woff2); }
`;

test('UI-9b: 1-2 px are hairlines, not off the space or radius scale', () => {
  const r = lintCss('.h { border-radius: 2px; padding: 1px 2px -2px 3px; margin: 0.5em 2.5px; gap: 1px; }', 'h.css');
  assert.equal(r.radius.raw, 0);
  assert.equal(r.space.raw, 3); // 3px, 0.5em (not px) and 2.5px count; 1px, 2px and -2px don't
});

test('raw values and token uses are counted per rule', () => {
  const r = lintCss(CSS, 'x.css');
  assert.deepEqual(r.radius, { raw: 1, token: 1 }); // --r-sm's definition is neither raw nor a use
  assert.equal(r.space.raw, 2); // 6px and 3px; 0 is free
  assert.equal(r.space.token, 2);
  assert.equal(r.shadow.raw, 1);
  assert.equal(r.shadow.token, 1);
  assert.equal(r.duration.raw, 1);
  assert.equal(r.duration.token, 1);
  assert.equal(r.colour.raw, 2); // #fff and rgba(; the --text definition and the comment don't count
  assert.equal(r.important.raw, 1);
  assert.equal(r.zindex.raw, 1);
  assert.equal(r.blur.raw, 1); // prefixed and plain on one rule are one surface; none is none
  assert.equal(r.font.raw, 1); // an @font-face's family is its definition, not a use
  assert.equal(r.font.token, 1);
  assert.equal(r.keyframes.raw, 1);
  assert.equal(lintCss(CSS, 'game/css/motion.css').keyframes.token, 1);
});

test('JS counts colours, innerHTML writes and style strings, not comments or URLs', () => {
  const r = lintJs(`// #abcdef in a comment
const a = '#ff0000', u = 'https://x.y/#top';
el.innerHTML = '<b style="color:#00f">x</b>';
el.innerHTML += x; if (el.innerHTML == y) {}`);
  assert.equal(r.innerHtml.raw, 2);
  assert.equal(r.styleAttr.raw, 1);
  assert.equal(r.jsColour.raw, 2);
});

test('the game report has a row per rule', () => {
  const total = lintGame();
  assert.ok(total.colour.raw > 0);
  assert.match(report(total), /\| Colours as variables \(CSS rules\) \| \d+ \|/);
});

// UI-3b: every raw value as a finding with its line (the Studio's rule report lists them)
test('each raw value is a finding on its own line, and comments keep the lines', async () => {
  const { uiLintFindings } = await import('../ui-lint.mjs');
  const f = uiLintFindings(CSS, 'x.css');
  const at = rule => f.filter(x => x.rule === rule).map(x => x.line);
  assert.deepEqual(at('radius'), [4]); // the comment on line 3 doesn't shift .a
  assert.deepEqual(at('space'), [4, 4]);
  assert.deepEqual(at('colour'), [4, 6]);
  assert.deepEqual(at('important'), [6]);
  assert.deepEqual(at('blur'), [7]);
  assert.deepEqual(at('keyframes'), [9]);
  assert.equal(f.find(x => x.rule === 'zindex').text, CSS.split('\n')[3].trim());
  const counts = lintCss(CSS, 'x.css');
  for (const [rule, c] of Object.entries(counts)) assert.equal(at(rule).length, c.raw, rule);
  const js = uiLintFindings('/* a\n b */\nconst a = 1;\nel.innerHTML = x; // #fff\nconst c = "#abc";', 'y.js');
  assert.deepEqual(
    js.map(x => [x.rule, x.line]),
    [
      ['innerHtml', 4],
      ['jsColour', 5],
    ]
  );
});

test("the game's findings add up to the report's raw counts", async () => {
  const { lintGameFindings } = await import('../ui-lint.mjs');
  const total = lintGame(),
    found = lintGameFindings();
  for (const [rule, t] of Object.entries(total)) assert.equal(found.filter(x => x.rule === rule).length, t.raw, rule);
  for (const x of found.slice(0, 50)) assert.ok(x.line > 0 && typeof x.text === 'string');
});

// UI-3b: the Studio finds the files by following the pages; it must read the same files as the command line
test('following the pages reaches every file the lint reads, and no other', async () => {
  const { readFile } = await import('node:fs/promises');
  const { lintFiles } = await import('../ui-lint.mjs');
  const { uiLintCrawl } = await import('../../game/js/logic/ui-lint.js');
  const root = new URL('../../', import.meta.url);
  const found = await uiLintCrawl(p => readFile(new URL(p, root), 'utf8'));
  assert.deepEqual(found, [...lintFiles()].sort());
});

test('page tags and imports become paths from the root', async () => {
  const { uiLintPageFiles, uiLintImports } = await import('../../game/js/logic/ui-lint.js');
  assert.deepEqual(
    uiLintPageFiles(
      'studio/gallery.html',
      '<link rel="stylesheet" href="../game/css/a.css"><script type="module" src="gallery.js?v=2"></script><script src="https://x.y/z.js"></script>'
    ),
    ['game/css/a.css', 'studio/gallery.js']
  );
  assert.deepEqual(
    uiLintImports(
      'game/js/logic/a.js',
      "import { x } from '../b.js';\nexport { y } from './c.js';\n// import { z } from './no.js';\nconst m = import('./d.js');"
    ),
    ['game/js/b.js', 'game/js/logic/c.js', 'game/js/logic/d.js']
  );
});

// UI-6: the ratchet
import { UI_LINT_CEILING, uiLintRatchet } from '../../game/js/logic/ui-lint.js';

test('the ratchet: a rise is over, a fall is under, equal is neither', () => {
  const ceiling = { ...UI_LINT_CEILING, space: 10, radius: 5 };
  const raw = { ...ceiling, space: 11, radius: 4 };
  const { over, under } = uiLintRatchet(raw, ceiling);
  assert.deepEqual(over, [{ id: 'space', raw: 11, max: 10 }]);
  assert.deepEqual(under, [{ id: 'radius', raw: 4, max: 5 }]);
});

test('the game is within every ceiling', () => {
  const raw = Object.fromEntries(Object.entries(lintGame()).map(([id, t]) => [id, t.raw]));
  assert.deepEqual(uiLintRatchet(raw).over, []);
});
