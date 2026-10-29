// UI track UI-16a: the Animation setting's levels and the feedback motions' numbers (game/js/logic/motion.js).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  MOTION_CHOICES,
  MOTION_LEVELS,
  MOTION_TIMES,
  motionCountAt,
  motionCountMs,
  motionLevelOf,
  motionStaggerCap,
  springAt,
  springEase,
  springMs,
} from '../../game/js/logic/motion.js';

test('Device plays Full unless the phone asks for reduced motion; a choice wins over the phone', () => {
  assert.equal(motionLevelOf('system', false), 'full');
  assert.equal(motionLevelOf('system', true), 'reduced');
  assert.equal(motionLevelOf(undefined, false), 'full', 'no choice yet is Device');
  assert.equal(motionLevelOf(undefined, true), 'reduced');
  for (const phone of [false, true]) {
    assert.equal(motionLevelOf('full', phone), 'full');
    assert.equal(motionLevelOf('calm', phone), 'calm');
    assert.equal(motionLevelOf('reduced', phone), 'reduced');
  }
  assert.equal(motionLevelOf('bogus', false), 'full', 'an unknown value is Device');
  assert.deepEqual(MOTION_CHOICES, ['system', 'full', 'calm', 'reduced']);
  for (const c of MOTION_CHOICES) assert.ok(MOTION_LEVELS.includes(motionLevelOf(c, false)), c);
});

test('a count ticks for 400-700 ms, longer for bigger changes, and lands on its value', () => {
  assert.equal(motionCountMs(5, 5), 0, 'nothing to count');
  const [lo, hi] = MOTION_TIMES.tick;
  let last = 0;
  for (const d of [1, 9, 40, 300, 5000, 1e6, 1e9]) {
    const ms = motionCountMs(0, d);
    assert.ok(ms >= lo && ms <= hi, `${d}: ${ms} ms`);
    assert.ok(ms >= last, 'never shorter for a bigger change');
    last = ms;
  }
  assert.equal(motionCountMs(500, 120), motionCountMs(120, 500), 'down as long as up');
  assert.equal(motionCountAt(10, 110, 0), 10);
  assert.equal(motionCountAt(10, 110, 1), 110);
  assert.equal(motionCountAt(10, 110, 2), 110, 'clamped');
  assert.ok(motionCountAt(10, 110, 0.5) > 60, 'eases out: past halfway at half time');
});

test('rows stop staggering where the last one would land after 400 ms', () => {
  assert.equal(motionStaggerCap(240, 35), 4);
  assert.ok(240 + motionStaggerCap(240, 35) * 35 <= MOTION_TIMES.enterMax);
  assert.equal(motionStaggerCap(240, 0), 0);
  assert.equal(motionStaggerCap(500, 35), 0, 'an enter longer than the limit never staggers');
});

test('the page’s motion tokens (uiTheme.json and tokens.css) sit inside the doc’s timings', () => {
  const read = (/** @type {string} */ f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8'),
    mo = JSON.parse(read('game/data/uiTheme.json')).defaults.motion,
    css = read('game/css/tokens.css'),
    tok = (/** @type {string} */ k) => +(css.match(new RegExp(`--${k}: (\\d+)ms;`)) || [])[1],
    T = MOTION_TIMES,
    within = (/** @type {number} */ v, /** @type {number[]} */ [lo, hi], /** @type {string} */ k) =>
      assert.ok(v >= lo && v <= hi, `${k} ${v} ms outside ${lo}-${hi}`);
  for (const [k, css] of [
    ['fast', 'm-fast'],
    ['base', 'm-base'],
    ['slow', 'm-slow'],
    ['stagger', 'stagger'],
    ['press', 'm-press'],
    ['exit', 'm-exit'],
    ['pop', 'm-pop'],
    ['float', 'm-float'],
  ])
    assert.equal(tok(css), mo[k], `tokens.css --${css} is uiTheme.json's ${k}`);
  within(mo.press, T.press, 'press');
  within(mo.base, T.enter, 'enter');
  within(mo.stagger, T.stagger, 'stagger');
  within(mo.exit, T.exit, 'exit');
  assert.equal(mo.pop, T.pop, 'pop');
  within(mo.float, T.float, 'float');
  assert.ok(mo.slow <= T.enterMax, `a sheet or a flip (slow, ${mo.slow} ms) is done by ${T.enterMax} ms`);
  const cap = motionStaggerCap(mo.base, mo.stagger);
  assert.match(
    read('game/css/motion.css'),
    new RegExp(`min\\(var\\(--i, 0\\), ${cap}\\) \\* var\\(--stagger\\)`),
    'the enter’s cap'
  );
});

test('no :host-context anywhere in the game (Safari ignores it): the levels reach shadow roots as --m-k and --m-loop', () => {
  const dir = new URL('../../game/js/', import.meta.url),
    files = readdirSync(dir, { recursive: true }).filter(f => /\.js$/.test(String(f)) && !String(f).includes('vendor'));
  for (const f of files)
    assert.ok(!readFileSync(new URL(String(f), dir), 'utf8').includes(':host-context('), `${f} uses :host-context`);
  const css = readFileSync(new URL('../../game/css/motion.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-motion='reduced'\] \{\s*--m-k: 0;\s*--m-loop: paused;/);
  assert.match(css, /\[data-motion='calm'\] \{\s*--m-loop: paused;/);
});

// DL-3: the dialogue bubble's spring as a CSS linear() easing
test('springEase starts at 0, ends exactly at 1 and overshoots only when damping is under 1', () => {
  const pts = (/** @type {string} */ s) => {
    const m = /^linear\((.*)\)$/.exec(s);
    assert.ok(m, `a linear() easing: ${s}`);
    return m[1].split(', ').map(Number);
  };
  const bouncy = pts(springEase(0.35, 0.7));
  assert.equal(bouncy[0], 0);
  assert.equal(bouncy.at(-1), 1);
  assert.equal(bouncy.length, 25);
  assert.ok(bouncy.every(Number.isFinite));
  assert.ok(Math.max(...bouncy) > 1.02, 'damping 0.7 overshoots');
  const firm = pts(springEase(0.35, 1));
  assert.ok(Math.max(...firm) <= 1, 'damping 1 never overshoots');
  for (let i = 1; i < firm.length; i++) assert.ok(firm[i] >= firm[i - 1], 'damping 1 only rises');
  assert.equal(pts(springEase(0.35, 0.7, 8)).length, 9);
});
test('the spring settles: springMs grows with the response and shrinks with damping; bad input is clamped', () => {
  assert.ok(springMs(0.5, 0.7) > springMs(0.35, 0.7));
  assert.ok(springMs(0.35, 0.9) < springMs(0.35, 0.5));
  const ms = springMs(0.35, 0.7);
  assert.ok(ms > 150 && ms < 1500, `a bubble's spring settles in a sensible time: ${ms}`);
  assert.ok(Math.abs(springAt(0.35, 0.7, ms / 1000) - 1) < 0.006, 'within 0.5% at springMs');
  assert.equal(springAt(0.35, 0.7, 0), 0);
  for (const [r, d] of [
    [NaN, NaN],
    [-1, 5],
    [0, 0],
    [99, 0.01],
  ]) {
    assert.ok(Number.isFinite(springMs(r, d)), `springMs(${r}, ${d})`);
    assert.match(springEase(r, d), /^linear\(0, .*, 1\)$/);
  }
});
