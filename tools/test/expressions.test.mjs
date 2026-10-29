// Phase 13 (task 8, the half that exists before phase 07's portraits): every expression a line of dialogue asks for is
// one the faces can show. A line may start with an expression in brackets ("[happy] Nice to meet you!", talk.js), or
// the code may pass one; the face then wears the wardrobe pieces made for it (person-art.js). A tag no piece is made
// for (a typo, a new mood) shows the plain face without a word, so it is caught here.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { ROOT } from './load-logic.mjs';
import { MARKUP_TAGS, leadingExpr } from '../../game/js/logic/line-markup.js';
import { withoutId } from '../../game/js/logic/script-parse.js';
import { faceToken } from '../../game/js/logic/talk-director.js';

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
    for (const m of src.matchAll(/['"`]\[(\w+)\]\s/g))
      if (!NOT_LINES.has(m[1]) && !(m[1] in MARKUP_TAGS)) add(m[1], where);
    // an expression passed by the code: talkLine(who, text, 'angry'), { expr: 'happy' }
    for (const m of src.matchAll(/talkLine\([^,()]+,[^,]+,\s*'(\w+)'/g)) add(m[1], where);
    for (const m of src.matchAll(/expr:\s*[^,}]*?'(\w+)'/g)) add(m[1], where);
  }
  const walk = (v, where) => {
    if (typeof v === 'string') {
      /* DL-1: the same reading as talk.js and sayLine (logic/line-markup.js), per script line, and mid-line faces */
      for (const l of v.split('\n')) {
        const { expr } = leadingExpr(
          withoutId(l.trim())[0]
            .replace(/^[->]\s*/, '')
            .replace(/^(\[(if\s+[^\]]*|once)\]\s*)+/, '')
        );
        if (expr) add(expr, where);
        for (const m of l.matchAll(/\[face=([\w-]+)\]/g)) add(m[1], where);
      }
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

test('no expression is also a markup tag (DL-1: a leading [b] or [shout] is never read as a face)', () => {
  const have = expressions(JSON.parse(readFileSync(join(ROOT, 'game/data/wardrobe.json'), 'utf8')));
  assert.deepEqual(
    [...have].filter(x => x in MARKUP_TAGS),
    []
  );
});

test('DL-5: a combined expression dresses each face item in its own part (happy eyes, a talking mouth)', () => {
  const W = JSON.parse(readFileSync(join(ROOT, 'game/data/wardrobe.json'), 'utf8')),
    worn = (/** @type {any} */ it, /** @type {string} */ expr) =>
      faceToken(expr, t => it.pieces.some((/** @type {any} */ p) => p.v === 'front' && p.x === t));
  const bySlot = (/** @type {string} */ s) => Object.values(W.items).filter((/** @type {any} */ it) => it.slot === s);
  assert.ok(bySlot('eyes').length && bySlot('mouth').length, 'the wardrobe has eyes and mouths');
  for (const it of bySlot('eyes')) {
    assert.equal(worn(it, 'happy+talk'), 'happy');
    assert.equal(worn(it, 'angry+blink+talk'), 'blink');
  }
  for (const it of bySlot('mouth')) {
    assert.equal(worn(it, 'happy+talk'), 'talk');
    assert.equal(worn(it, 'sad+blink'), 'sad');
  }
  for (const it of bySlot('brows')) assert.equal(worn(it, 'angry+blink+talk'), 'angry');
});
