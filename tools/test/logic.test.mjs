// Phase 04e: the logic runs in plain Node, with no window, document, storage or WebGL, and reaches the page only
// through hooks.js. The setup (the data, the hooks, the seeded random numbers) is in setup-fixture.mjs; the other
// *.test.mjs files test what each module does (phase 13). `npm run check:logic` runs them all (node --test).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { files, LOGIC_DIR, logic, ROOT } from './setup-fixture.mjs';

// what the logic may ask the page for through hooks.js (the state, and telling the interface what happened); a logic
// module that reads anything else from there reaches into the browser side, which this file can't stand in for
const SEAMS = new Set([
  'provide',
  'saveData',
  'activeBattle',
  'setActiveBattle',
  'uiState',
  'save',
  'toast',
  'render',
  'showPendingWindows',
  'openBattle',
  'playTurnEvents',
  /* SND-17: a jingle by its name (the evolution's), so it can play on its ensemble */
  'jinglePlay',
  'soundEffect',
  'environmentOdds',
  'battleWeatherMultiplier',
  /* RL-8: a run's battle: its seed, weather and checkpoint from the page (run.js), optional like the two above */
  'runBattleStart',
  /* HB-10e: the festival on in Copperleaf (town-square.js: it needs the ranch clock and the phone's calendar), for the
     story's festival: condition; optional (none in Node) */
  'festivalToday',
]);

test('every logic module loads in plain Node, with no browser globals made up for it', () => {
  assert.ok(files.length > 0, `${LOGIC_DIR} has no modules`);
  for (const g of [
    'window',
    'document',
    'localStorage',
    'matchMedia',
    'requestAnimationFrame',
    'WebGL2RenderingContext',
  ])
    assert.equal(typeof globalThis[g], 'undefined', `${g} exists in this Node`);
});

test('the logic reaches the page only through the seams in hooks.js', () => {
  for (const f of [...files, 'game/js/game-data.js']) {
    const m = readFileSync(join(ROOT, f), 'utf8').match(/import \{([^}]*)\} from '\.\.?\/hooks\.js';/);
    const used = m
      ? m[1]
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      : [];
    const other = used.filter(n => !SEAMS.has(n) && !Object.hasOwn(logic, n));
    assert.deepEqual(other, [], `${f} reads ${other.join(', ')} from hooks.js`);
  }
});
