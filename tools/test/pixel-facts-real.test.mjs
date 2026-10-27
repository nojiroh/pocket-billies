// Load track LD-1: the baked pixel facts (game/data/pixelFacts.json, game/art/scene/next/cuts/) are the art's own:
// after painting a tree's crown, moving a clump or painting a moss or clover picture, run npm run bake:pixels
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelFactsDiff } from '../bake-pixel-facts.mjs';

test('the baked pixel facts and leaf cuts are up to date with the art (npm run bake:pixels)', () => {
  assert.deepEqual(pixelFactsDiff(false), []);
});
