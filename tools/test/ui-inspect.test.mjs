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
