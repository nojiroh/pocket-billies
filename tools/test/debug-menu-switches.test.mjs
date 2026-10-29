// Characters track CH-3c: every figure switch the debug menu draws has a case that steps it (the Atlas switch was drawn
// but not handled, so a tap did nothing). Read from the source: the menu needs a page to run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const src = readFileSync(new URL('../../game/js/debug-menu.js', import.meta.url), 'utf8');

test('every figure switch the debug menu draws is handled', () => {
  const list = src.slice(
    src.indexOf('const FIGURE_SWITCHES = ['),
    src.indexOf('];', src.indexOf('const FIGURE_SWITCHES'))
  );
  const ids = [...list.matchAll(/\[\s*'(fig[a-z]+)',/g)].map(m => m[1]);
  assert.ok(ids.length >= 8, `found ${ids.length} switches`);
  for (const id of ids) assert.match(src, new RegExp(`case '${id}':`), `${id} has no case`);
});
