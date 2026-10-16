// Phase 04b: the game data's files for Node tools. The layout itself is in game/js/data-files.js (shared with the
// game and the Studio); this runs that script in a sandbox and adds reading and writing on disk.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

export const ROOT = join(import.meta.dirname, '..');
export const DATA = join(ROOT, 'game', 'data');

const box = { self: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'game', 'js', 'data-files.js'), 'utf8'), box, { filename: 'data-files.js' });
export const PB_DATA = box.self.PB_DATA;

export const readJson = path => JSON.parse(readFileSync(join(DATA, path), 'utf8'));
export const readIndex = () => readJson('index.json');

// every section and entry, put back together in the index's order
export const readGameData = () => PB_DATA.assemble(readIndex(), readJson);

export function writeFile(path, text) {
  mkdirSync(dirname(join(DATA, path)), { recursive: true });
  writeFileSync(join(DATA, path), text);
}
