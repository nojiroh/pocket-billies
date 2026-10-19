// Studio track ST-0: Golden is gone, so the rig functions take (sp, k, coat) and the Studio's (sp, view, coat). A call
// still passing the old Golden switch (true/false/0/1 before the view) would draw the wrong view without an error, for
// example code written on another branch before the change. This finds such calls in the game and the Studio.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const files = dir =>
  readdirSync(join(ROOT, dir)).flatMap(f => {
    const p = join(dir, f);
    return statSync(join(ROOT, p)).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
  });
const OLD = [
  /\brigParts\(\s*[^,()]+,\s*(?:true|false|!!\w[\w.]*)\s*,/,
  /\brobotRigParts\(\s*[^,()]+,\s*(?:true|false)\s*,/,
  /\brigAtlas\(\s*[^,()]+,\s*(?:true|false|0|1)\s*,/,
  /\brigPreload\([^;]*\[\s*[^,[\]]+,\s*(?:true|false)\s*,/,
  /\brigFor\(\s*[^,()]+,\s*[^,()]+,\s*(?:true|false)\s*\)/,
  /\batlasPath\(\s*[^,()]+,\s*[^,()]+,\s*(?:true|false|!!\w+)\s*\)/,
];

test('no rig call passes the old Golden switch', () => {
  const bad = [];
  for (const f of [...files('game/js'), ...files('studio/js')])
    readFileSync(join(ROOT, f), 'utf8')
      .split('\n')
      .forEach((line, i) => OLD.some(re => re.test(line)) && bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`));
  assert.deepEqual(bad, []);
});
