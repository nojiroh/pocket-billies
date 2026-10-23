// Phase 04b: the game data's files for Node tools. The layout itself is in game/js/data-files.js (shared with the
// game and the Studio); this runs that script in a sandbox and adds reading and writing on disk.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

export const ROOT = join(import.meta.dirname, '..');
// Studio plan T1.3: PB_DATA_DIR points the tools at another copy of the data (the check-data snapshot test plants bad
// data in a temp copy); its pictures are read from ../art beside it, as in game/
export const DATA = process.env.PB_DATA_DIR || join(ROOT, 'game', 'data');

const box = { self: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'game', 'js', 'data-files.js'), 'utf8'), box, { filename: 'data-files.js' });
export const PB_DATA = box.self.PB_DATA;

export const readJson = path => JSON.parse(readFileSync(join(DATA, path), 'utf8'));
export const readIndex = () => readJson('index.json');

// every section and entry, put back together in the index's order
export const readGameData = () => PB_DATA.assemble(readIndex(), readJson);

// RL-5: the parked world in game/data/legacy (its own legacy/index.json, the same layout), or null when there is none
export const readLegacyData = () =>
  existsSync(join(DATA, 'legacy', 'index.json'))
    ? PB_DATA.assemble(readJson('legacy/index.json'), p => readJson('legacy/' + p))
    : null;

export function writeFile(path, text) {
  mkdirSync(dirname(join(DATA, path)), { recursive: true });
  writeFileSync(join(DATA, path), text);
}
