// Phase 20 C1: the per-frame settings table (game/js/engine/settings.js). While a frame is open, engineSetting answers
// from FRAME_SETTINGS; for every key and every source of a dial (player, scene look, game data, defaults, the
// environment's modifiers, the Studio's defaults switch) the answer must be the one the full lookup gives. No graphics.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= globalThis;
globalThis.document ??= {};
globalThis.PB_TEST_GLOBALS = true; // FRAME_SETTINGS through the test globals (only what other modules import is exported)
const hooks = await import('../../game/js/hooks.js');
const S = await import('../../game/js/engine/settings.js');
const { FRAME_SETTINGS } = globalThis;
const { ENGINE_DEFAULTS, beginFrameSettings, endFrameSettings, engineContext, engineSetting } = S;

const keys = Object.entries(ENGINE_DEFAULTS).flatMap(([g, o]) => Object.keys(o).map(k => [g, k]));
const slow = () => keys.map(([g, k]) => engineSetting(g, k)); // no frame open: the full lookup
const fast = () => keys.map(([g, k]) => engineSetting(g, k));

/* a stand-in environment and its modifiers: one multiplier per numeric default, so every key with a number is leaned on */
const env = { k: 1.5 };
const MODS = {};
for (const [g, k] of keys)
  if (typeof ENGINE_DEFAULTS[g][k] === 'number') (MODS[g] = MODS[g] || {})[k] = v => v * env.k + 0.25;

/* a value unlike the default for each key: numbers moved, booleans flipped, strings replaced */
const other = (v, n) => (typeof v === 'number' ? v + n : typeof v === 'boolean' ? !v : v === null ? n : '#12345' + n);
const dials = (n, every) => {
  const o = {};
  keys.forEach(([g, k], i) => {
    if (i % every === 0) (o[g] = o[g] || {})[k] = other(ENGINE_DEFAULTS[g][k], n);
  });
  return o;
};

function setup({ player, look, game, envOn, bypass }) {
  hooks.provide({
    saveData: { preferences: player ? { expert: true, eng: player } : {} },
    gameData: { engine: game ? { defaults: game } : {} },
    ENVIRONMENT_ENGINE_MODIFIERS: MODS,
  });
  engineContext.look = look || null;
  engineContext.env = !!envOn;
  engineContext.bypass = !!bypass;
}

const CASES = {
  'defaults only': {},
  'player dials': { player: dials(1, 2) },
  'scene look': { look: dials(2, 3) },
  'game data': { game: dials(3, 2) },
  'all three, overlapping': { player: dials(1, 5), look: dials(2, 3), game: dials(3, 2) },
  'environment on': { look: dials(2, 3), envOn: true },
  'Studio defaults switch': { player: dials(1, 2), look: dials(2, 3), bypass: true },
};

for (const [name, c] of Object.entries(CASES))
  test(`frame table equals the full lookup for every key: ${name}`, () => {
    setup(c);
    const want = slow();
    beginFrameSettings();
    try {
      assert.deepEqual(fast(), want);
    } finally {
      endFrameSettings();
    }
  });

test('the table holds every key of ENGINE_DEFAULTS', () => {
  assert.deepEqual(
    Object.entries(FRAME_SETTINGS).flatMap(([g, o]) => Object.keys(o).map(k => [g, k])),
    keys
  );
});

test('the table answers only while its look and environment flag hold; closed, it is the full lookup again', () => {
  const look = dials(2, 1);
  setup({ look, envOn: true });
  beginFrameSettings();
  const filled = fast();
  env.k = 3; // the environment moves on: an open frame keeps what it was filled with
  assert.deepEqual(fast(), filled);
  endFrameSettings();
  const now = slow(); // closed: the full lookup, which sees the change
  assert.notDeepEqual(now, filled);

  beginFrameSettings();
  engineContext.look = dials(7, 1); // another look mid-frame: the full lookup
  assert.deepEqual(fast(), (endFrameSettings(), slow()));
  engineContext.look = look;
  beginFrameSettings();
  engineContext.env = false; // the environment switched off mid-frame: the full lookup
  assert.deepEqual(fast(), (endFrameSettings(), slow()));
  env.k = 1.5;
  setup({});
  assert.equal(engineSetting('quality', 'notADial'), undefined); // unknown keys: the full lookup, as before
});
