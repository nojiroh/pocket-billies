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

// fluid track FL-2a: the old drawing paths' switches (Pictures in batches, Sky last) are drawn and handled, and each
// names a Quality dial the engine has
test('every picture path switch the debug menu draws is handled and names a Quality dial', async () => {
  const list = src.slice(
    src.indexOf('const PICTURE_PATH_SWITCHES = ['),
    src.indexOf('];', src.indexOf('const PICTURE_PATH_SWITCHES'))
  );
  const rows = [...list.matchAll(/\[\s*'(fl2[a-z]+)',\s*'(\w+)'/g)].map(m => [m[1], m[2]]);
  assert.equal(rows.length, 2);
  const settings = readFileSync(new URL('../../game/js/engine/settings.js', import.meta.url), 'utf8');
  for (const [id, k] of rows) {
    assert.match(src, new RegExp(`case '${id}':`), `${id} has no case`);
    assert.match(settings, new RegExp(`\\n    ${k}: true,`), `${k} is on by default`);
  }
  assert.match(src, /PICTURE_PATH_SWITCHES\.map\(/, 'drawn in the menu');
});

// fluid track FL-3a: the controller's switch is drawn with the picture paths, handled, and off by default until the
// owner's phone run
test('the frame controller switch is handled and off by default', () => {
  assert.match(src, /\['fl3ctl', 'controller', 'Frame controller'\]/);
  assert.match(src, /case 'fl3ctl':/);
  const settings = readFileSync(new URL('../../game/js/engine/settings.js', import.meta.url), 'utf8');
  assert.match(settings, /\n {4}controller: false,/);
});
