// Studio art track SA-5: the unused-art report, counted as the Studio's Art browser counts it (logic/art-refs.js, with
// the same inputs: the game data, the parked legacy data, studio/art-code-refs.json, studio/art-keep.json and the
// Billie sheets). Pictures nothing names are orphans; those the keep list names are kept on purpose; art/legacy/ and
// what only legacy data names are legacy; "missing" is a data text or a keep entry naming a picture that isn't there.
//   node tools/art-unused.mjs           # the report
//   node tools/art-unused.mjs --json    # the same as JSON (tools/check-quick.py's Unused step reads it)
//   node tools/art-unused.mjs --check   # fail when there is an orphan or a missing picture
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readGameData, readLegacyData } from './data-files.mjs';
import { artRefIndex, artRefInputs, artReport } from '../game/js/logic/art-refs.js';
import { isArtPicture } from '../game/js/logic/art-search.js';

const ROOT = join(import.meta.dirname, '..');
const readJson = (/** @type {string} */ p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

/** the art folder's pictures as the Studio's file list names them ('art/...') */
export function artPicturesOnDisk() {
  const art = join(ROOT, 'game/art');
  const walk = (/** @type {string} */ d) =>
    readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
  return walk(art)
    .map(f => 'art/' + relative(art, f).split('\\').join('/'))
    .filter(isArtPicture)
    .sort();
}

/** the parked legacy data as the Studio's Legacy section reads it (legacy-view.js: map ids, not the maps) */
function legacyAsStudio() {
  const L = readLegacyData();
  if (!L) return {};
  const out = { ...L, mapIds: Object.keys(L.maps || {}) };
  delete out.maps;
  return out;
}

/** a Billie's sheet: its rig's, else the old atlas name (studio/js/sprites.js atlasPath) */
function sheetOf() {
  const t = readFileSync(join(ROOT, 'game/art/next/rigs-next.js'), 'utf8');
  const R = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  return (/** @type {string} */ sp, /** @type {string} */ view) => {
    const m = R[sp] && R[sp][view];
    return m && m.sheet ? 'art/' + m.sheet : `art/billionaires/${sp}${view === 'back' ? '_back' : ''}.png`;
  };
}

export function artUnusedReport() {
  const paths = artPicturesOnDisk(),
    kept = readJson('studio/art-keep.json').kept,
    o = artRefInputs({
      D: readGameData(),
      legacy: legacyAsStudio(),
      code: readJson('studio/art-code-refs.json'),
      kept,
      sheet: sheetOf(),
    });
  return { count: paths.length, ...artReport(paths, artRefIndex(paths, o), o) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = artUnusedReport(),
    arg = process.argv[2] || '';
  if (arg === '--json') console.log(JSON.stringify(r));
  else {
    console.log(
      `${r.count} pictures: ${r.unused.length} unused, ${r.legacy.length} legacy, ${r.kept.length} kept, ${r.missing.length} missing`
    );
    for (const p of r.unused) console.log('  unused  ' + p);
    for (const m of r.missing) console.log(`  missing ${m.path} (${m.from}: ${m.at})`);
    if (arg === '--check' && (r.unused.length || r.missing.length)) process.exit(1);
  }
}
