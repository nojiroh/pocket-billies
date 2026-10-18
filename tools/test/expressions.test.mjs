// Phase 13 (task 8, the half that exists before phase 07's portraits): every expression a line of dialogue asks for is
// one the faces can show. A line may start with an expression in brackets ("[happy] Nice to meet you!", talk.js), or
// the code may pass one; the face then wears the wardrobe pieces made for it (person-art.js). A tag no piece is made
// for (a typo, a new mood) shows the plain face without a word, so it is caught here.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';

// every value of "x" (the expression a piece is for) anywhere in the wardrobe
function expressions(o, out = new Set()) {
  if (Array.isArray(o)) for (const v of o) expressions(v, out);
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) k === 'x' && typeof v === 'string' ? out.add(v) : expressions(v, out);
  return out;
}
const files = (dir, ext) =>
  readdirSync(join(ROOT, dir), { recursive: true })
    .filter(f => f.endsWith(ext))
    .map(f => join(ROOT, dir, f));
// log lines that start with a bracketed word too (console.warn('[gamedata] ...'))
const NOT_LINES = new Set(['gamedata']);

function tagsInUse() {
  const used = new Map(),
    add = (tag, where) => used.set(tag, [...(used.get(tag) || []), where]);
  for (const f of files('game/js', '.js')) {
    const src = readFileSync(f, 'utf8'),
      where = relative(ROOT, f);
    for (const m of src.matchAll(/['"`]\[(\w+)\]\s/g)) if (!NOT_LINES.has(m[1])) add(m[1], where);
    // an expression passed by the code: talkLine(who, text, 'angry'), { expr: 'happy' }
    for (const m of src.matchAll(/talkLine\([^,()]+,[^,]+,\s*'(\w+)'/g)) add(m[1], where);
    for (const m of src.matchAll(/expr:\s*[^,}]*?'(\w+)'/g)) add(m[1], where);
  }
  const walk = (v, where) => {
    if (typeof v === 'string') {
      const m = /^\[(\w+)\]\s/.exec(v);
      if (m) add(m[1], where);
    } else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x, where);
  };
  for (const f of files('game/data', '.json')) walk(JSON.parse(readFileSync(f, 'utf8')), relative(ROOT, f));
  return used;
}

test('every expression asked for in dialogue (code and data) has its face pieces in the wardrobe', () => {
  const have = expressions(JSON.parse(readFileSync(join(ROOT, 'game/data/wardrobe.json'), 'utf8'))),
    used = tagsInUse();
  assert.ok(used.size >= 3, `only ${used.size} expressions found in use: the search is broken`);
  const missing = [...used]
    .filter(([tag]) => !have.has(tag))
    .map(([tag, w]) => `${tag} (${[...new Set(w)].join(', ')})`);
  assert.deepEqual(missing, [], `the faces have ${[...have].join(', ')}`);
});
