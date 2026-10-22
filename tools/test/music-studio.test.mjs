// Sound track SND-3: what the Studio's Music & sound section and its Check know about music.json
// (game/js/logic/music-studio.js): chord numerals, note names, rules in words, where songs play, the findings.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import {
  MUSIC_CODE_SONGS,
  MUSIC_SCALES,
  chordNumeral,
  musicFindings,
  musicNoteName,
  musicRuleText,
  musicSongUses,
} from '../../game/js/logic/music-studio.js';

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
const json = f => JSON.parse(readFileSync(new URL('../../game/data/' + f, import.meta.url), 'utf8'));

test('the scales are the ones the tracker plays', () => {
  const src = readFileSync(new URL('../../game/js/audio/tracker.js', import.meta.url), 'utf8');
  for (const [k, v] of Object.entries(MUSIC_SCALES)) assert.ok(src.includes(`${k}: [${v.join(', ')}]`), k);
});

test('the songs the code starts by name are the ones the list says', () => {
  const root = new URL('../../game/js/', import.meta.url),
    found = new Set();
  for (const f of readdirSync(root, { recursive: true }))
    if (String(f).endsWith('.js'))
      for (const m of readFileSync(new URL(String(f), root), 'utf8').matchAll(/\bmusic\(\s*'([a-z0-9_]+)'/g))
        found.add(m[1]);
  assert.deepEqual([...found].sort(), [...MUSIC_CODE_SONGS].sort());
});

test('numerals: major, minor, mixolydian (bVII), dorian, lydian', () => {
  const all = s => [0, 1, 2, 3, 4, 5, 6].map(d => chordNumeral(s, d)).join(' ');
  assert.equal(all('major'), 'I ii iii IV V vi viiº');
  assert.equal(all('minor'), 'i iiº bIII iv v bVI bVII');
  assert.equal(all('mixo'), 'I ii iiiº IV v vi bVII');
  assert.equal(all('dorian'), 'i ii bIII IV v viº bVII');
  assert.equal(all('lydian'), 'I II iii #ivº V vi vii');
  assert.equal(chordNumeral('nonsense', 4), 'V');
});

test('note names', () => {
  assert.equal(musicNoteName(60), 'C4');
  assert.equal(musicNoteName(69), 'A4');
  assert.equal(musicNoteName(61), 'C#4');
  assert.equal(musicNoteName(47), 'B2');
});

test('rules in words', () => {
  assert.equal(musicRuleText({ song: 'route' }), 'everywhere else');
  assert.equal(musicRuleText({ started: false, song: 'hazel' }), 'before the game starts');
  assert.equal(musicRuleText({ biome: 'lake', row: [2, 4], song: 'trench' }), 'biome lake · rows 2-4');
  assert.equal(musicRuleText({ indoor: true, map: ['a', 'b'], song: 'cave' }), 'indoors · map a, b');
});

test('every song in the game data is played by something, and the rules say where', () => {
  const locations = json('locations.json'),
    legacy = json('legacy/locations.json');
  const uses = musicSongUses(MUSIC, { locations: [...locations, ...legacy] });
  assert.ok(uses.hazel.includes('rule 1: before the game starts'), uses.hazel.join('; '));
  assert.ok(
    uses.copperleaf.some(u => u.startsWith('place ')),
    'copperleaf is a place’s own song'
  );
  assert.ok(uses.variants.length, 'variants: parked places name it');
  assert.deepEqual(
    musicFindings(MUSIC, {
      nodeTypes: json('nodeTypes.json'),
      biomes: json('biomes.json'),
      locations: [...locations, ...legacy],
    }),
    []
  );
});

test('scripts count when they ask for a song', () => {
  const M = { songs: { a: {}, b: {} }, where: [{ song: 'a' }] };
  assert.deepEqual(musicSongUses(M, { scriptText: 'say hi\nmusic b\n' }).b, ['a story script']);
  assert.deepEqual(musicSongUses(M, { scriptText: 'nomusic b' }).b, []);
});

test('findings: a rule with no song, an unknown biome and node type, a last rule that does not always match, a song nothing plays', () => {
  const M = {
    songs: { a: {}, lonely: {} },
    where: [{ song: 'gone' }, { biome: 'mars', nodeType: 'void', song: 'a' }, { tab: 'map', song: 'a' }],
  };
  const F = musicFindings(M, {
    nodeTypes: { route: {} },
    biomes: { lake: {} },
    locations: [{ id: 'p', music: 'nope' }],
  });
  assert.deepEqual(
    F.map(f => [f.lvl, f.rule ?? f.song ?? f.place]),
    [
      ['error', 0],
      ['error', 1],
      ['error', 1],
      ['error', 2],
      ['error', 'p'],
      ['warn', 'lonely'],
    ]
  );
});
