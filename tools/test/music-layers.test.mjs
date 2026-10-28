// Sound track SND-13: layers in play (game/js/logic/music-layers.js): which part plays how loud for the layer levels the
// game gives, on which beat or bar it moves, walking, the weather, the busker by distance, a battle's intensity, the
// run's arc. The sound itself is held by the fingerprints (tools/check-sound.py `layer:<name>` parts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  MUSIC_LAYER_NAMES,
  MUSIC_LAYER_TESTS,
  musicLayerArc,
  musicLayerBattle,
  musicLayerBusker,
  musicLayerFight,
  musicLayerFightStart,
  musicLayerGain,
  musicLayerHas,
  musicLayerLevel,
  musicLayerListen,
  musicLayerMove,
  musicLayerPan,
  musicLayerTests,
  musicLayerWalk,
  musicLayerWeather,
} from '../../game/js/logic/music-layers.js';
import { hitTier, koAhead } from '../../game/js/logic/battle-anims.js';

const read = { hitTier, koAhead };

test('no layer levels (every render before SND-13): layer parts silent, nothing dimmed', () => {
  assert.equal(musicLayerGain({}, null), 1);
  assert.equal(musicLayerGain({ layer: 'walk' }, null), 0);
  assert.equal(musicLayerGain({ dim: { night: 0.3, still: 0.5, calm: 0 } }, null), 1);
  assert.equal(musicLayerGain({ dim: { still: 0.5, calm: 0 } }, {}), 1);
});

test('a layer part follows its level; dims reach their value at a full layer', () => {
  assert.equal(musicLayerGain({ layer: 'rain' }, { rain: 1 }), 1);
  assert.equal(musicLayerGain({ layer: 'rain' }, { rain: 0.5 }), 0.5);
  assert.equal(musicLayerGain({ layer: 'rain' }, { rain: 3 }), 1);
  assert.equal(musicLayerGain({ dim: { night: 0.3 } }, { night: 1 }), 0.3);
  assert.equal(musicLayerGain({ dim: { night: 0.3 } }, { night: 0.5 }), 0.66);
  assert.equal(musicLayerGain({ layer: 'walk', dim: { night: 0.5 } }, { walk: 1, night: 1 }), 0.5);
});

test('still and calm read walk and build the other way round, once the game gives them', () => {
  assert.equal(musicLayerLevel({ walk: 0 }, 'still'), 1);
  assert.equal(musicLayerLevel({ walk: 1 }, 'still'), 0);
  assert.equal(musicLayerLevel({}, 'still'), 0);
  assert.equal(musicLayerGain({ dim: { still: 0.5 } }, { walk: 0 }), 0.5);
  assert.equal(musicLayerGain({ dim: { calm: 0 } }, { build: 0 }), 0);
  assert.equal(musicLayerGain({ dim: { calm: 0 } }, { build: 0.5 }), 0.5);
  assert.equal(musicLayerGain({ layer: 'calm' }, { build: 0.25 }), 0.76);
});

test('musicLayerHas: only parts with a layer or a dim move', () => {
  assert.equal(musicLayerHas({}), false);
  assert.equal(musicLayerHas({ dim: {} }), false);
  assert.equal(musicLayerHas({ layer: 'walk' }), true);
  assert.equal(musicLayerHas({ dim: { night: 0.5 } }), true);
});

test('moves: the walking beat in on a beat, out from a bar line; the busker on beats; the rest on bars', () => {
  const walk = { layer: 'walk' };
  assert.deepEqual(musicLayerMove(walk, 4, 0, 1), { beats: 1 });
  assert.equal(musicLayerMove(walk, 5, 0, 1), null);
  assert.equal(musicLayerMove(walk, 4, 1, 0), null);
  assert.deepEqual(musicLayerMove(walk, 32, 1, 0), { beats: 2 });
  /* a standing thin-out (dim still) comes in as you stop: from a bar line */
  const stand = { dim: { still: 0.5 } };
  assert.equal(musicLayerMove(stand, 4, 1, 0.5), null);
  assert.deepEqual(musicLayerMove(stand, 16, 1, 0.5), { beats: 2 });
  assert.deepEqual(musicLayerMove(stand, 4, 0.5, 1), { beats: 1 });
  assert.deepEqual(musicLayerMove({ layer: 'busker' }, 8, 0.2, 0.4), { beats: 1 });
  assert.equal(musicLayerMove({ layer: 'busker' }, 9, 0.2, 0.4), null);
  assert.equal(musicLayerMove({ layer: 'rain' }, 8, 0, 1), null);
  assert.deepEqual(musicLayerMove({ layer: 'rain' }, 16, 0, 1), { beats: 4 });
  assert.equal(musicLayerMove({ layer: 'rain' }, 16, 1, 1), null);
  assert.equal(musicLayerMove({ layer: 'rain' }, -16, 0, 1), null);
});

test('walking: the beat holds a moment after you stop', () => {
  assert.equal(musicLayerWalk(true, 0), 1);
  assert.equal(musicLayerWalk(false, 0.2), 1);
  assert.equal(musicLayerWalk(false, 1), 0);
});

test('the weather: from light rain up, none indoors', () => {
  assert.deepEqual(musicLayerWeather({ rain: 1, snow: 0, storm: 0.5 }, false), { rain: 1, snow: 0, storm: 0.5 });
  assert.deepEqual(musicLayerWeather({ rain: 0.2 }, false), { rain: 0, snow: 0, storm: 0 });
  assert.deepEqual(musicLayerWeather({ rain: 1, snow: 1 }, true), { rain: 0, snow: 0, storm: 0 });
  assert.deepEqual(musicLayerWeather(null, false), { rain: 0, snow: 0, storm: 0 });
});

test('the busker: in earshot under 8 m, out past 9 (hysteresis), full within 2 m', () => {
  assert.deepEqual(musicLayerBusker(8.5, false), { on: false, level: 0 });
  assert.equal(musicLayerBusker(8.5, true).on, true);
  assert.ok(musicLayerBusker(8.5, true).level > 0);
  assert.deepEqual(musicLayerBusker(9.5, true), { on: false, level: 0 });
  assert.equal(musicLayerBusker(1, false).level, 1);
  assert.ok(musicLayerBusker(3, false).level > musicLayerBusker(6, false).level);
});

test('listening to the busker: still within 5 m for 3 s, until 7 m off', () => {
  assert.equal(musicLayerListen(4, 1, false), false);
  assert.equal(musicLayerListen(4, 3, false), true);
  assert.equal(musicLayerListen(6, 9, false), false);
  assert.equal(musicLayerListen(6, 0, true), true);
  assert.equal(musicLayerListen(7.5, 0, true), false);
  assert.equal(musicLayerPan(0.33), 0.35);
  assert.equal(musicLayerPan(-3), -1);
});

test('a battle builds as turns pass, KOs land and a boss changes phase; peaks in the red zone and on a KO', () => {
  const F = musicLayerFightStart();
  assert.deepEqual(musicLayerBattle(F, false, false), { build: 0, peak: 0 });
  /* turn 1: a neutral hit; turn 2: a crit that knocks out its target */
  const t1 = [{ an: { k: 'move', ti: 1, dmg: 5, te: 1 } }];
  musicLayerFight(F, t1, 0, read);
  assert.equal(F.turns, 0);
  assert.equal(F.hits, 0);
  const t2 = [{ an: { k: 'move', ti: 1, dmg: 20, crit: true } }, { an: { k: 'faint', si: 1 } }];
  musicLayerFight(F, t2, 0, read);
  assert.equal(F.turns, 1);
  assert.equal(F.hits, 1);
  assert.equal(F.koNext, true);
  assert.deepEqual(musicLayerBattle(F, false, false), { build: 0.4, peak: 1 });
  musicLayerFight(F, t2, 1, read);
  assert.equal(F.kos, 1);
  assert.equal(F.koNext, false);
  assert.deepEqual(musicLayerBattle(F, false, false), { build: 0.7, peak: 0 });
  assert.equal(musicLayerBattle(F, true, false).peak, 1);
  /* the same line read again counts nothing twice */
  musicLayerFight(F, t2, 1, read);
  assert.equal(F.kos, 1);
  /* a boss's phase: full, and its peak stays */
  musicLayerFight(F, [{ an: { k: 'alphaPhase', si: 1 } }], 0, read);
  assert.deepEqual(musicLayerBattle(F, false, true), { build: 1, peak: 1 });
  assert.equal(musicLayerBattle(F, false, false).peak, 0);
});

test("the run's arc as layers: its band's peak", () => {
  assert.equal(musicLayerArc(null), 0);
  assert.equal(musicLayerArc('mid'), 0.6);
  assert.equal(musicLayerArc('late'), 1);
});

test('musicLayerTests: the renders an ensemble gets, from the layers it names', () => {
  assert.deepEqual(musicLayerTests(null), []);
  assert.deepEqual(
    musicLayerTests({
      parts: [{ layer: 'walk', dim: { night: 0.5 } }, { layer: 'rain' }, { dim: { calm: 0 } }, { layer: 'peak' }, {}],
    }),
    ['walk', 'rain', 'night', 'intensity1', 'intensity3']
  );
  for (const k of [
    'walk',
    'still',
    'rain',
    'snow',
    'storm',
    'night',
    'busker',
    'intensity1',
    'intensity2',
    'intensity3',
  ])
    assert.ok(MUSIC_LAYER_TESTS[k], k);
  assert.deepEqual(MUSIC_LAYER_NAMES, [
    'walk',
    'rain',
    'snow',
    'storm',
    'night',
    'busker',
    'build',
    'peak',
    'still',
    'calm',
  ]);
});

test("the schema's layer names are the logic's", () => {
  const S = JSON.parse(readFileSync(new URL('../../game/data/schema/music.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(S.$defs.layer.enum, MUSIC_LAYER_NAMES);
  assert.equal(S.$defs.ensemblePart.properties.layer.$ref, '#/$defs/layer');
});
