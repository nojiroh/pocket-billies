// Phase 13: loads the logic in plain Node with a data set (setup-fixture.mjs: a small one of its own; setup-real.mjs:
// the game's), the way the page does (see setup-fixture.mjs for how the logic gets what it needs). Call it once per
// process, before anything imports a game module: the data tables are read when game-data.js loads.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export const ROOT = join(import.meta.dirname, '..', '..');
export const LOGIC_DIR = 'game/js/logic';

// before anything imports util.js: a seeded Math.random (Park-Miller); reseed() starts the same numbers again
let seed = 12345;
Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const reseed = (n = 12345) => {
  seed = n;
};

export async function loadLogic(gameData) {
  // game/version.js is a classic script (self.PB_VERSION = ...): run it on its own
  const version = { self: {} };
  vm.runInNewContext(readFileSync(join(ROOT, 'game/version.js'), 'utf8'), version);
  globalThis.PB_VERSION = version.self.PB_VERSION;
  globalThis.GAMEDATA = gameData;

  const hooks = await import('../../game/js/hooks.js');
  const said = [];
  const page = {
    uiState: { learnQ: [], mq: [] },
    activeBattle: null,
    setActiveBattle: v => hooks.provide({ activeBattle: v }),
    save: () => said.push('save'),
    toast: t => said.push('toast: ' + t),
    render: () => {},
    showPendingWindows: () => {},
    openBattle: () => said.push('openBattle'),
    playTurnEvents: () => said.push('playTurnEvents'),
  };
  hooks.provide(page);

  const files = readdirSync(join(ROOT, LOGIC_DIR))
    .filter(f => f.endsWith('.js'))
    .map(f => `${LOGIC_DIR}/${f}`);
  const data = await import('../../game/js/game-data.js');
  const modules = {};
  for (const f of files) modules[f.slice(LOGIC_DIR.length + 1, -3)] = await import(join(ROOT, f));
  const logic = Object.assign({}, data, ...Object.values(modules));
  const fn = name => {
    if (typeof logic[name] !== 'function') throw new Error(`no logic module exports ${name}`);
    return logic[name];
  };
  // a fresh started save with one Billie, handed to the logic as the page would (setSaveData)
  function startedSave(sp, lvl = 10) {
    const s = fn('newSave')();
    s.started = true;
    s.starter = sp.replace(/\d+$/, '');
    hooks.provide({ saveData: s });
    s.team.push(fn('makeBilly')(sp, lvl));
    return s;
  }
  return { hooks, said, files, data, modules, logic, fn, startedSave };
}
