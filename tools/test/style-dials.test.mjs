// Style track SY-8: the style track's dials (uiTheme.json style) and what ran for the debug log (game/js/logic/style-dials.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STYLE_DIALS,
  STYLE_RANGES,
  STYLE_VARS,
  styleCount,
  styleDialsOf,
  styleRan,
  styleReport,
  styleStateOf,
  styleVarsCss,
} from '../../game/js/logic/style-dials.js';
import { POP_MAX, POP_MIN, ROLL_MS } from '../../game/js/logic/hit-numbers.js';
import { FOIL_HALF, FOIL_PERIOD_MS, FOIL_SWEEP_MS } from '../../game/js/logic/coat-foil.js';

const schema = JSON.parse(readFileSync(new URL('../../game/data/schema/uiTheme.schema.json', import.meta.url), 'utf8'));
const theme = JSON.parse(readFileSync(new URL('../../game/data/uiTheme.json', import.meta.url), 'utf8'));

test("the dials' defaults are today's numbers (SY-2, SY-6)", () => {
  assert.equal(STYLE_DIALS.popMin, POP_MIN);
  assert.equal(STYLE_DIALS.popMax, POP_MAX);
  assert.equal(STYLE_DIALS.rollMs, ROLL_MS);
  assert.equal(STYLE_DIALS.foilPeriod, FOIL_PERIOD_MS);
  assert.equal(STYLE_DIALS.foilSweep, FOIL_SWEEP_MS);
  assert.equal(STYLE_DIALS.foilHalf, FOIL_HALF);
  assert.deepEqual(
    styleDialsOf(() => undefined),
    STYLE_DIALS
  );
});

test("the data's style group is the defaults, and the schema's ranges are the logic's", () => {
  const props = schema.$defs.style.properties;
  for (const [k, [lo, hi]] of Object.entries(STYLE_RANGES)) {
    assert.equal(props[k].minimum, lo, k);
    assert.equal(props[k].maximum, hi, k);
    const v = STYLE_DIALS[/** @type {keyof typeof STYLE_DIALS} */ (k)];
    assert.ok(v >= lo && v <= hi, k);
  }
  assert.deepEqual(theme.defaults.style, STYLE_DIALS);
});

test('dials are read from data or CSS, kept in range, and never cross', () => {
  const css = { '--pop-min': ' 30', '--hp-roll': '500ms' };
  const d = styleDialsOf(k => ({ popMin: css['--pop-min'], rollMs: css['--hp-roll'], stampSlant: 99 })[k]);
  assert.equal(d.popMin, 30);
  assert.equal(d.rollMs, 500);
  assert.equal(d.stampSlant, 20, 'clamped');
  assert.equal(
    styleDialsOf(k => ({ popMin: 40, popMax: 20 })[k]).popMax,
    40,
    'the largest is never under the smallest'
  );
  assert.ok(styleDialsOf(k => ({ foilPeriod: 1000, foilSweep: 3000 })[k]).foilSweep < 1000, 'a sweep fits its period');
  assert.equal(styleDialsOf(k => (k === 'foilHalf' ? 'x' : undefined)).foilHalf, STYLE_DIALS.foilHalf);
});

test('the sheet writes only the dials it is given, with their units', () => {
  assert.deepEqual(styleVarsCss(undefined), []);
  assert.deepEqual(styleVarsCss({ rollMs: 400, stampScale: 1.2 }), ['--stamp-scale: 1.2;', '--hp-roll: 400ms;']);
  assert.equal(styleVarsCss(STYLE_DIALS).length, STYLE_VARS.length);
});

test('what ran is counted per Flashes and Animation state, numbers only', () => {
  assert.equal(styleStateOf(false, undefined), 'flashes on, full');
  assert.equal(styleStateOf(true, 'reduced'), 'flashes off, reduced');
  assert.equal(styleStateOf(false, 'odd'), 'flashes on, full');
  const a = styleStateOf(true, 'calm');
  styleCount(a, 'flashHeld');
  styleCount(a, 'flashHeld');
  styleCount(a, 'stamp');
  const r = styleReport(a);
  assert.equal(r.now, a);
  assert.deepEqual(r.ran[a], { flashHeld: 2, stamp: 1 });
  r.ran[a].stamp = 9;
  assert.equal(styleRan.states[a].stamp, 1, 'the report is a copy');
  for (const v of Object.values(r.ran[a])) assert.equal(typeof v, 'number');
});

test("the pop's sizes and the foil take the dials, and are today's without them", async () => {
  const { popSize } = await import('../../game/js/logic/hit-numbers.js');
  const { coatFoil, foilBand } = await import('../../game/js/logic/coat-foil.js');
  assert.equal(popSize(0, false, 20, 60), 20);
  assert.equal(popSize(1, false, 20, 60), 60);
  assert.equal(popSize(0.2, true, 20, 60), 60, 'a KO is the largest');
  assert.equal(popSize(0.5), popSize(0.5, false, POP_MIN, POP_MAX));
  for (let t = 0; t < 8000; t += 37) assert.equal(foilBand(t, 's'), foilBand(t, 's', STYLE_DIALS), `t ${t}`);
  // a longer period: the band shows a smaller share of the time
  const share = (/** @type {any} */ tune) => {
    let on = 0;
    for (let t = 0; t < 40000; t += 10) if (foilBand(t, 's', tune) != null) on++;
    return on / 4000;
  };
  assert.ok(share({ foilPeriod: 7000 }) < share({}) * 0.6);
  const coats = { gold: {} };
  let f = null;
  for (let t = 0; !f && t < 10000; t += 10) f = coatFoil('gold', coats, t, 'x', true, { foilHalf: 0.4 });
  assert.ok(f && f[2] === 0.4, 'the band half width is the dial');
});
