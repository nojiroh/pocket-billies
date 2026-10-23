// Studio plan Phase 6 (F20): a Studio field whose path starts with a claimed prefix (pathPrefix in
// studio/js/studio-app.js) reads and writes its own way. No two editors may claim one prefix, or one that starts
// another: the later claim would take the other's fields (a shop's thank-you lines once read lore's).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';

const dir = join(ROOT, 'studio', 'js');
const claims = readdirSync(dir)
  .filter(f => f.endsWith('.js'))
  .flatMap(f =>
    [...readFileSync(join(dir, f), 'utf8').matchAll(/(?<![\w.])pathPrefix\(\s*'([^']*)'/g)].map(m => [m[1], f])
  );

test('the Studio claims each path prefix once, and none starts another', () => {
  assert.ok(claims.length >= 3, `found ${claims.length} claims`);
  const all = [['@rigs.', 'studio-app.js (built in)'], ...claims];
  for (const [i, [a, fa]] of all.entries())
    for (const [b, fb] of all.slice(i + 1))
      assert.ok(!a.startsWith(b) && !b.startsWith(a), `${a} (${fa}) and ${b} (${fb})`);
  for (const [p] of claims) assert.match(p, /^@[a-z]+\.$/);
});
