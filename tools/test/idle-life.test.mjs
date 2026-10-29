// UI track UI-17: idle life's budget (game/js/logic/idle-life.js): at most two kinds of idle loop on screen, none under
// Calm or Reduced, the glint and foil through SY-1's flash rule, and every endless loop in the game's CSS counted.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { IDLE_KINDS, IDLE_LOOPS, IDLE_MAX, SIGNAL_LOOPS, idlePick, sheenAlpha } from '../../game/js/logic/idle-life.js';
import { FLASH_SOFT_MAX } from '../../game/js/logic/smear.js';

const read = (/** @type {string} */ f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
const KINDS = IDLE_KINDS.map(K => K.k);

/** every endless animation in a file: the selector of the rule it sits in (the nearest line above that opens a
 * rule, not an @-rule), as written @param {string} f */
export function endlessLoops(f) {
  const lines = read(f).split('\n'),
    out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\binfinite\b/.test(lines[i]) || /^\s*(\/\*|\*|\/\/)/.test(lines[i])) continue;
    let j = i;
    while (j >= 0 && !(/\{\s*$/.test(lines[j]) && !/^\s*@/.test(lines[j]))) j--;
    /* a rule whose selectors run over several lines: from its first line */
    let k = j;
    while (k > 0 && /,\s*$/.test(lines[k - 1])) k--;
    out.push(lines[k].trim().replace(/\s*\{$/, ''));
  }
  return out;
}

const FILES = [
  ...readdirSync(new URL('../../game/css/', import.meta.url))
    .filter(f => f.endsWith('.css') && f !== 'opening-old.css')
    .map(f => 'game/css/' + f),
  'game/js/ui-kit.js',
  'game/js/ui-run-kit.js',
  'game/js/ui-marks-kit.js',
];

test('at most two kinds of idle loop on screen, the most wanted first; none under Calm or Reduced', () => {
  assert.equal(IDLE_MAX, 2);
  assert.deepEqual(idlePick(KINDS, 'full'), KINDS.slice(0, 2));
  assert.deepEqual(idlePick(['glint', 'foil', 'coin'], 'full'), ['foil', 'glint'], 'by IDLE_KINDS’ order');
  assert.deepEqual(idlePick(['coin'], 'full'), ['coin']);
  assert.deepEqual(idlePick([], 'full'), []);
  assert.deepEqual(idlePick(['nope', 'glint'], 'full'), ['glint'], 'an unknown kind never plays');
  assert.deepEqual(idlePick(KINDS, 'calm'), []);
  assert.deepEqual(idlePick(KINDS, 'reduced'), []);
  /* every set of kinds a screen could show stays inside the budget */
  for (let m = 0; m < 1 << KINDS.length; m++) {
    const on = KINDS.filter((_, i) => m & (1 << i));
    assert.ok(idlePick(on, 'full').length <= IDLE_MAX, on.join());
  }
  assert.equal(new Set(KINDS).size, KINDS.length, 'each kind once');
});

test('the glint and the foil follow SY-1’s flash rule: softer with Flashes off, none under Reduced or Calm', () => {
  assert.equal(sheenAlpha('full', false), 1);
  assert.equal(sheenAlpha('full', true), FLASH_SOFT_MAX);
  assert.equal(sheenAlpha('reduced', false), 0);
  assert.equal(sheenAlpha('calm', false), 0);
});

test('every endless loop in the game’s CSS is counted: idle (in the budget) or a signal', () => {
  const listed = new Map([...IDLE_LOOPS, ...SIGNAL_LOOPS].map(L => [`${L.file} ${L.sel}`, L])),
    found = new Set();
  for (const f of FILES)
    for (const sel of endlessLoops(f)) {
      const key = `${f} ${sel}`;
      found.add(key);
      assert.ok(listed.has(key), `${key}: an endless loop not in idle-life.js IDLE_LOOPS or SIGNAL_LOOPS`);
    }
  for (const key of listed.keys()) assert.ok(found.has(key), `${key}: listed but not found (moved or gone?)`);
  for (const L of IDLE_LOOPS) assert.ok(KINDS.includes(L.kind), `${L.sel}: kind ${L.kind}`);
});

test('each idle loop stops when its kind is not picked (motion.css data-idle, or --idle-<kind> in a kit part)', () => {
  const motion = read('game/css/motion.css'),
    /** @type {Record<string, string[]>} kind: the selectors motion.css stops while it isn't picked */
    gates = {};
  for (const m of motion.matchAll(/html:not\(\[data-idle~='([a-z]+)'\]\) ([^,{]+?)\s*[,{]/g))
    (gates[m[1]] ||= []).push(m[2].trim());
  for (const L of IDLE_LOOPS) {
    if (L.file.startsWith('game/js/')) {
      assert.match(read(L.file), new RegExp(`var\\(--idle-${L.kind}, none\\)`), `${L.file}: ${L.sel}`);
      assert.match(motion, new RegExp(`\\[data-idle~='${L.kind}'\\] \\{[^}]*--idle-${L.kind}:`), L.kind);
    } else assert.ok((gates[L.kind] || []).includes(L.sel.replace(/,$/, '')), `motion.css doesn't stop ${L.sel}`);
  }
});
