// Characters track CH-5: the figure kit reads its shapes from the game data (game/data/figureKit.json) through
// globalThis.GAMEDATA, as on the page; a test of the kit imports this first to put them there
import { readFileSync } from 'node:fs';

const G = /** @type {any} */ (globalThis);
G.GAMEDATA ??= {};
G.GAMEDATA.figureKit ??= JSON.parse(readFileSync(new URL('../../game/data/figureKit.json', import.meta.url), 'utf8'));
