// Sound track SND-2: which song plays where (game/js/logic/music-where.js songFor, on game/data/music.json's where
// table). The musicFor test SND-1 left for here: every choice the old musicFor made, from the same state, picks the
// same song; then how the rules match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { musicWhereMatches, songFor } from '../../game/js/logic/music-where.js';

const MUSIC = JSON.parse(readFileSync(new URL('../../game/data/music.json', import.meta.url), 'utf8'));
const pick = state => songFor(state, MUSIC.where, MUSIC.songs);
// a started game on a plain route, outdoors, nothing special: the state musicFor builds
const out = o => ({
  started: true,
  battle: null,
  tab: 'walk',
  indoor: false,
  map: 'route_x',
  placeKind: null,
  placeMusic: null,
  ...o,
});

test('before the game starts: hazel, whatever else is true', () => {
  assert.equal(pick({ started: false }), 'hazel');
  assert.equal(pick({ ...out({ battle: 'wild' }), started: false }), 'hazel');
});

test('battles: rival (Chad), trainer, wild; a battle wins over the map tab and a room', () => {
  assert.equal(pick(out({ battle: 'rival' })), 'rival');
  assert.equal(pick(out({ battle: 'trainer' })), 'trainer');
  assert.equal(pick(out({ battle: 'wild' })), 'wild');
  assert.equal(pick(out({ battle: 'wild', tab: 'map', indoor: true })), 'wild');
});

test('the map tab: map, over a room and a place of its own', () => {
  assert.equal(pick(out({ tab: 'map' })), 'map');
  assert.equal(pick(out({ tab: 'map', indoor: true, placeMusic: 'copperleaf' })), 'map');
});

test("rooms: the two malls play mall, any other room cave (over the place's own song)", () => {
  assert.equal(pick(out({ indoor: true, map: 'lanternhall' })), 'mall');
  assert.equal(pick(out({ indoor: true, map: 'pepperpot' })), 'mall');
  assert.equal(pick(out({ indoor: true, map: 'int_bakery', placeMusic: 'copperleaf' })), 'cave');
});

test("a place's own song when it is a song; else the place is a city, a town or a route", () => {
  assert.equal(pick(out({ placeMusic: 'copperleaf', placeKind: 'town' })), 'copperleaf');
  assert.equal(pick(out({ placeMusic: 'no_such_song', placeKind: 'town' })), 'town');
  assert.equal(pick(out({ map: 'pepperpot' })), 'mall');
  assert.equal(pick(out({ map: 'verdigris' })), 'city');
  assert.equal(pick(out({ placeKind: 'city' })), 'city');
  assert.equal(pick(out({ placeKind: 'town' })), 'town');
  assert.equal(pick(out({})), 'route');
});

// the owner's mapping (2026-10-22): today's eleven biomes onto the seven biome songs
const BIOME_SONGS = {
  meadow: 'meadow',
  thicket: 'spore',
  jungle: 'spore',
  lake: 'trench',
  sea: 'trench',
  canyon: 'hills',
  badlands: 'hills',
  volcano: 'innersun',
  tundra: 'crystal',
  ridge: 'crystal',
  autumn: 'spire',
};
const BIOMES = JSON.parse(readFileSync(new URL('../../game/data/biomes.json', import.meta.url), 'utf8'));

test("a run: a route, mini-boss or boss node plays its biome's song; a town node town; the landing route", () => {
  assert.deepEqual(Object.keys(BIOME_SONGS).sort(), Object.keys(BIOMES).sort());
  for (const [biome, song] of Object.entries(BIOME_SONGS))
    for (const nodeType of ['route', 'miniboss', 'boss'])
      assert.equal(pick(out({ nodeType, biome, row: 3 })), song, `${nodeType} in ${biome}`);
  // a run's town is a town place too (locations' town flag); the node type alone already picks town
  assert.equal(pick(out({ nodeType: 'town', biome: 'lake', placeKind: 'town' })), 'town');
  assert.equal(pick(out({ nodeType: 'town', biome: 'lake' })), 'town');
  assert.equal(pick(out({ nodeType: 'landing', biome: 'meadow' })), 'route');
  // a battle, the map tab and a room still win over the biome
  assert.equal(pick(out({ nodeType: 'route', biome: 'lake', battle: 'wild' })), 'wild');
  assert.equal(pick(out({ nodeType: 'route', biome: 'lake', tab: 'map' })), 'map');
  assert.equal(pick(out({ nodeType: 'route', biome: 'lake', indoor: true })), 'cave');
});

test('every song a rule names is a song, and the last rule always matches', () => {
  for (const W of MUSIC.where) if (W.song !== '$place') assert.ok(MUSIC.songs[W.song], W.song);
  const last = MUSIC.where[MUSIC.where.length - 1];
  assert.deepEqual(Object.keys(last), ['song']);
});

test('matching: the first rule wins; map is any of a list, row a range, started and indoor yes or no', () => {
  const where = [{ biome: 'lake', row: [4, 6], song: 'b' }, { biome: 'lake', song: 'a' }, { song: 'z' }];
  const songs = { a: {}, b: {}, z: {} };
  assert.equal(songFor({ biome: 'lake', row: 5 }, where, songs), 'b');
  assert.equal(songFor({ biome: 'lake', row: 7 }, where, songs), 'a');
  assert.equal(songFor({ biome: 'lake' }, where, songs), 'a');
  assert.equal(songFor({ biome: 'sea', row: 5 }, where, songs), 'z');
  assert.ok(musicWhereMatches({ map: ['a', 'b'] }, { map: 'b' }));
  assert.ok(!musicWhereMatches({ map: ['a', 'b'] }, { map: 'c' }));
  assert.ok(musicWhereMatches({ indoor: false }, {}));
  assert.ok(!musicWhereMatches({ started: true }, {}));
  assert.equal(songFor({}, [{ song: '$place' }], songs), null);
  assert.equal(songFor({ placeMusic: 'a' }, [{ song: '$place' }], songs), 'a');
  assert.equal(songFor({}, [], songs), null);
});
