// Phase 06-4: type pills read at 4.5:1 (game/js/logic/colors.js), on the game's own type colours.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fn, data } from './setup-real.mjs';

test('contrast is the WCAG ratio', () => {
  assert.equal(fn('contrastRatio')('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(fn('contrastRatio')('#777', '#777'), 1);
});

test('every type pill reads at 4.5:1, and a pill that already did keeps its colour', () => {
  for (const [t, [bg, fg]] of Object.entries(data.TYPE_COLORS)) {
    const pill = fn('readableBg')(bg, fg);
    assert.ok(fn('contrastRatio')(pill, fg) >= 4.5, `${t}: ${pill} on ${fg} is ${fn('contrastRatio')(pill, fg)}`);
    if (fn('contrastRatio')(bg, fg) >= 4.5) assert.equal(pill.toLowerCase(), bg.toLowerCase(), `${t} changed`);
  }
});
