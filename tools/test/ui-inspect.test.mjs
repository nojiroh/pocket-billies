// UI-3b: the string work behind the Studio's inspect (game/js/logic/ui-inspect.js)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cssVarNames, hostSelector, matchableSelector, splitSelectors } from '../../game/js/logic/ui-inspect.js';

test('the variables a rule reads, fallbacks included, each once', () => {
  assert.deepEqual(cssVarNames('color: var(--text); background: var(--g-bg, var(--panel)); border: var(--text)'), [
    '--text',
    '--g-bg',
    '--panel',
  ]);
  assert.deepEqual(cssVarNames('padding: 4px'), []);
});

test('selectors split at their top-level commas and made matchable', () => {
  assert.deepEqual(splitSelectors('.a, .b:is(.c, .d) > e, [x="1,2"]'), ['.a', '.b:is(.c, .d) > e', '[x="1,2"]']);
  assert.deepEqual(matchableSelector('.pb-card::before'), { sel: '.pb-card', pseudo: '::before' });
  assert.deepEqual(matchableSelector('.u-row:after'), { sel: '.u-row', pseudo: '::after' });
  assert.deepEqual(matchableSelector('.u-row:hover'), { sel: '.u-row:hover', pseudo: '' });
  assert.deepEqual(matchableSelector('::before'), { sel: '*', pseudo: '::before' });
});

test(':host becomes a selector for the host; inner parts are not the host', () => {
  assert.equal(hostSelector(':host'), '*');
  assert.equal(hostSelector(':host([selected])'), '[selected]');
  assert.equal(hostSelector(':host([kind="gold"])::before'), '[kind="gold"]');
  assert.equal(hostSelector('.cut'), null);
  assert.equal(hostSelector(':host .cut'), null);
});

test('the overlays: tap targets, colours read from CSS, contrast through layers, glass depth', async () => {
  const L = await import('../../game/js/logic/ui-inspect.js');
  assert.equal(L.uiTapTooSmall({ width: 40, height: 40 }), false);
  assert.equal(L.uiTapTooSmall({ width: 39, height: 44 }), true);
  assert.equal(L.uiTapTooSmall({ width: 120, height: 30 }), true);
  assert.equal(L.uiTapTooSmall({ width: 0, height: 0 }), false);
  assert.deepEqual(L.parseCssColour('rgba(255, 0, 16, 0.5)'), { hex: '#ff0010', a: 0.5 });
  assert.deepEqual(L.parseCssColour('rgb(255 255 255 / 50%)'), { hex: '#ffffff', a: 0.5 });
  assert.deepEqual(L.parseCssColour('#22301F2E'), { hex: '#22301f', a: 0x2e / 255 });
  assert.equal(L.parseCssColour('transparent'), null);
  assert.equal(L.parseCssColours('linear-gradient(rgb(246, 208, 108), rgb(217, 158, 51))').length, 2);
  const black = { hex: '#000000', a: 1 },
    white = { hex: '#ffffff', a: 1 };
  assert.equal(L.uiLayeredContrast(black, [[white]]), 21);
  // half-see-through white over black reads as mid grey
  assert.ok(Math.abs(L.uiLayeredContrast(black, [[{ hex: '#ffffff', a: 0.5 }], [black]]) - 5.28) < 0.05);
  // a gradient: the worst stop counts
  assert.equal(L.uiLayeredContrast(black, [[white, black]]), 1);
  // nothing opaque behind: can't tell
  assert.equal(L.uiLayeredContrast(black, [[{ hex: '#ffffff', a: 0.4 }]]), null);
  assert.equal(L.uiTextMin(16, 400), 4.5);
  assert.equal(L.uiTextMin(19, 700), 3);
  assert.equal(L.uiTextMin(24, 400), 3);
  assert.equal(L.uiGlassTooDeep(2), false);
  assert.equal(L.uiGlassTooDeep(3), true);
});

test('gradients: the colour where the text is, stripes included; images can not be told', async () => {
  const L = await import('../../game/js/logic/ui-inspect.js');
  assert.deepEqual(L.parseCssColour('color(srgb 1 0.5 0 / 0.5)'), { hex: '#ff8000', a: 0.5 });
  const box = { w: 200, h: 40 };
  // a 4 px notch on the left, then the fill: text in the middle sees the fill only
  const stripe = 'linear-gradient(90deg, rgb(90, 169, 214) 0px, rgb(90, 169, 214) 4px, rgb(255, 251, 240) 4px)';
  assert.deepEqual(
    L.backgroundLayerColours(stripe, box, { x0: 40, y0: 10, x1: 120, y1: 30 }).map(c => c.hex),
    ['#fffbf0', '#fffbf0']
  );
  // top to bottom, text over the whole height: both ends
  const g = L.backgroundLayerColours('linear-gradient(rgb(74, 59, 110), rgb(46, 33, 64))', box, {
    x0: 10,
    y0: 0,
    x1: 60,
    y1: 40,
  });
  assert.deepEqual(
    g.map(c => c.hex),
    ['#4a3b6e', '#2e2140']
  );
  assert.equal(L.backgroundLayerColours('url(a.png)', box, { x0: 0, y0: 0, x1: 1, y1: 1 }), null);
  assert.deepEqual(L.backgroundLayerColours('none', box, { x0: 0, y0: 0, x1: 1, y1: 1 }), []);
});
