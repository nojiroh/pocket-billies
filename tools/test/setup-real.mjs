// Phase 13: the logic on the game's own data (game/data, put together as tools/data-files.mjs does), for the tests of
// the data itself and of what needs real trainers and rules: the world-map graph, the expressions in dialogue, the
// battle formats, the balance simulation. Loads the logic as setup-fixture.mjs does (load-logic.mjs), once per process.
import { readGameData } from '../data-files.mjs';
import { loadLogic } from './load-logic.mjs';

export { LOGIC_DIR, reseed, ROOT } from './load-logic.mjs';

export const GAME_DATA = readGameData();
export const { hooks, said, files, data, modules, logic, fn, startedSave } = await loadLogic(GAME_DATA);
