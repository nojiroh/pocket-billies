// Sound track SND-2: which song plays where (game/js/logic/music-where.js songFor, on game/data/music.json's where
// table). The musicFor test SND-1 left for here: every choice the old musicFor made, from the same state, picks the
// same song; then how the rules match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  musicArcBand,
  musicWeatherCut,
  musicBattleKind,
  musicRedZone,
  musicWhereMatches,
  songFor,
  songVariant,
} from '../../game/js/logic/music-where.js';

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

// SND-5: a run's mini-boss is a leader, its boss the boss
test('the kind of battle: wild, trainer, rival (Chad), leader (a mini-boss), boss', () => {
  assert.equal(musicBattleKind(null), null);
  assert.equal(musicBattleKind({ kind: 'wild' }), 'wild');
  assert.equal(musicBattleKind({ kind: 'trainer', T: { who: 'chosen' } }), 'trainer');
  assert.equal(musicBattleKind({ kind: 'trainer' }), 'trainer');
  assert.equal(musicBattleKind({ kind: 'trainer', T: { who: 'chad' } }), 'rival');
  assert.equal(musicBattleKind({ kind: 'trainer', T: { who: 'chad', runFoe: 'miniboss' } }), 'leader');
  assert.equal(musicBattleKind({ kind: 'trainer', T: { runFoe: 'boss' } }), 'boss');
  for (const k of ['leader', 'boss']) assert.ok(MUSIC.songs[pick(out({ battle: k }))], k + ' plays a song');
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

// SND-4: night versions
test('night outdoors plays the night version; day, indoors, in battle or with night: false, the song itself', () => {
  const S = { town: {}, cave: {}, wild: { night: false } },
    v = (name, o, playing) => songVariant(name, { ...out(o) }, S, playing);
  assert.equal(v('town', { night: 1 }), 'town@night');
  assert.equal(v('town', { night: 0 }), 'town');
  assert.equal(v('town', { night: 1, indoor: true }), 'town');
  assert.equal(v('town', { night: 1, battle: 'wild' }), 'town');
  assert.equal(v('wild', { night: 1 }), 'wild');
  assert.equal(v(null, { night: 1 }), null);
  assert.equal(v('nosuch', { night: 1 }), 'nosuch');
});

test('dusk and dawn: night from 0.6, day again below 0.4, in between what plays stays', () => {
  const S = { town: {} },
    v = (n, playing) => songVariant('town', { night: n }, S, playing);
  assert.equal(v(0.5, 'town'), 'town');
  assert.equal(v(0.61, 'town'), 'town@night');
  assert.equal(v(0.5, 'town@night'), 'town@night');
  assert.equal(v(0.39, 'town@night'), 'town');
});

// SND-5: the red zone
test('the red zone: alive and under a quarter of its HP', () => {
  assert.ok(musicRedZone(24, 100));
  assert.ok(!musicRedZone(25, 100));
  assert.ok(!musicRedZone(0, 100), 'a fainted Billie is not in it');
  assert.ok(!musicRedZone(1, 0));
});

test('in battle the red zone plays the tense version; out of it, or with tense: false, the song itself', () => {
  const S = { wild: { night: false }, calm: { tense: false }, town: {} },
    v = (name, o) => songVariant(name, { ...out(o) }, S, null);
  assert.equal(v('wild', { battle: 'wild', redZone: true }), 'wild@tense');
  assert.equal(v('wild', { battle: 'wild', redZone: false }), 'wild');
  assert.equal(v('calm', { battle: 'wild', redZone: true }), 'calm');
  assert.equal(v('town', { redZone: true }), 'town', 'only in battle');
  assert.equal(v('wild', { battle: 'wild', redZone: true, night: 1 }), 'wild@tense', 'no night in battle');
});

// SND-5: the run's arc
test("the run arc: a run's walkable node in a band's rows plays its band; towns, the map tab and rows no band names don't", () => {
  const run = MUSIC.run,
    band = o => musicArcBand(out({ nodeType: 'route', row: 0, ...o }), run);
  assert.equal(band({ row: 0 }), null);
  assert.equal(band({ row: 2 }), null);
  assert.equal(band({ row: 3 }), 'mid');
  assert.equal(band({ row: 5, nodeType: 'miniboss' }), 'mid');
  assert.equal(band({ row: 6 }), 'late');
  assert.equal(band({ row: 8, nodeType: 'boss' }), 'late');
  assert.equal(band({ row: 7, nodeType: 'town' }), null);
  assert.equal(band({ row: 7, tab: 'map' }), null);
  assert.equal(band({ row: 7, nodeType: null }), null, 'not in a run');
});

test('songVariant in a run: the band first, then night; arc: false keeps the song; battle and rooms as before', () => {
  const S = { meadow: {}, still: { arc: false }, cave: { night: false } },
    v = (name, o, playing) => songVariant(name, out({ nodeType: 'route', ...o }), S, playing, MUSIC.run);
  assert.equal(v('meadow', { row: 1 }), 'meadow');
  assert.equal(v('meadow', { row: 4 }), 'meadow@mid');
  assert.equal(v('meadow', { row: 7, night: 1 }), 'meadow@late@night');
  assert.equal(v('meadow', { row: 7, night: 0.5 }, 'meadow@late@night'), 'meadow@late@night', 'dusk holds');
  assert.equal(v('still', { row: 7 }), 'still');
  assert.equal(v('cave', { row: 7, night: 1 }), 'cave@late', 'no night version, the band still');
  assert.equal(v('meadow', { row: 7, indoor: true }), 'meadow');
  assert.equal(v('meadow', { row: 7, battle: 'wild' }), 'meadow');
});

test('the deadline: the last day (run.deadlineDays 1) and every day past it play the deadline version, over band and night', () => {
  const S = { meadow: {}, town: {}, off: { deadline: false } },
    v = (name, o) => songVariant(name, out({ nodeType: 'route', row: 7, ...o }), S, null, MUSIC.run);
  assert.equal(MUSIC.run.deadlineDays, 1);
  assert.equal(v('meadow', { daysLeft: 2 }), 'meadow@late');
  assert.equal(v('meadow', { daysLeft: 1 }), 'meadow@deadline');
  assert.equal(v('meadow', { daysLeft: -2, night: 1 }), 'meadow@deadline');
  assert.equal(v('town', { nodeType: 'town', daysLeft: 1 }), 'town@deadline', 'a town node too');
  assert.equal(v('off', { daysLeft: 1 }), 'off@late');
  assert.equal(v('meadow', { daysLeft: 1, tab: 'map' }), 'meadow', 'not on the map tab');
  assert.equal(v('meadow', { daysLeft: 1, nodeType: null }), 'meadow', 'not out of a run');
  assert.equal(v('meadow', { daysLeft: 1, battle: 'wild' }), 'meadow', 'battles keep their own');
  assert.equal(
    songVariant('meadow', out({ nodeType: 'route', row: 1, daysLeft: 2 }), S, null, { deadlineDays: 2 }),
    'meadow@deadline'
  );
});

test("the map song hears the forecast: rain, storm, snow, fog and ash close the low-pass; clear and cloudy don't", () => {
  for (const w of ['rain', 'storm', 'snow', 'fog', 'ash']) assert.ok(musicWeatherCut(w, MUSIC.run) < 5000, w);
  for (const w of ['clear', 'cloudy', '', 'nosuch']) assert.equal(musicWeatherCut(w, MUSIC.run), 20000, w || 'none');
  assert.ok(musicWeatherCut('storm', MUSIC.run) < musicWeatherCut('rain', MUSIC.run), 'a storm muffles more');
  assert.equal(musicWeatherCut('rain', undefined), 20000);
});
