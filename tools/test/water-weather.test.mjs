// Water track WA-5a: weather on water (game/js/logic/water-weather.js): a storm floods beside the water and keeps every
// exit reached (the main path open); snow freezes still water into ice you walk on; the next day starts again from the
// scene as made; the same scene and weather give the same water
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen,
  WX = modules['water-weather'],
  W = modules.wading,
  ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
/* run-like routes (pinned east and west, two exits), with streams and ponds */
const CASES = Array.from({ length: 30 }, (_, i) => ({
  seed: 7300 + i,
  biome: ['meadow', 'lake', 'thicket', 'autumn', 'ridge'][i % 5],
  kind: 'route',
  pin: 'EW',
  w: 96,
  h: 64,
  road: {
    exits: [
      { side: 'E', t: 0.5, width: 2 },
      { side: 'W', t: 0.5, width: 2 },
    ],
  },
  land: { water: ['stream', 'pond', 'stream'][i % 3], waterAmount: 0.3 + (i % 5) / 8, hills: (i % 4) / 4 },
}));
const MADE = CASES.map(c => ({ c, sc: G.mapgenScene(c, ctx).scene }));
const tileAt = (sc, i, j) => sc.tiles[sc.h - 1 - j][i];
const count = (sc, ch) => sc.tiles.join('').split(ch).length - 1;

test('a storm floods beside the water and every exit stays reached; never a road', () => {
  let flooded = 0;
  for (const { c, sc } of MADE) {
    const where = `seed ${c.seed} ${c.biome}`,
      made = { tiles: sc.tiles.slice(), waters: sc.waters },
      got = WX.waterWeatherApply(sc, 'storm', GAME_DATA.scenery);
    assert.deepEqual(G.mapgenUnreachable(sc, GAME_DATA.scenery), [], `${where}: the main path open in the flood`);
    if (got !== 'flood') {
      assert.deepEqual(sc.tiles, made.tiles, `${where}: no flood, as made`);
      continue;
    }
    flooded++;
    assert.equal(sc.wx, 'flood');
    assert.ok(
      count(sc, 'w') + count(sc, 'd') > made.tiles.join('').replace(/[^wd]/g, '').length,
      `${where}: more water`
    );
    for (let j = 0; j < sc.h; j++)
      for (let i = 0; i < sc.w; i++) {
        const was = made.tiles[sc.h - 1 - j][i],
          now = tileAt(sc, i, j);
        if (was === now) continue;
        assert.ok(!WX.WATERWX_ROAD.includes(was), `${where}: a road at ${i},${j} flooded`);
        assert.ok(now === 'w' || (was === 'w' && now === 'd'), `${where}: ${was} became ${now} at ${i},${j}`);
      }
    for (const p of [sc.hub, ...sc.exits]) assert.ok(!'wd'.includes(tileAt(sc, Math.floor(p[0]), Math.floor(p[1]))));
  }
  assert.ok(flooded >= 10, `${flooded} of ${MADE.length} places flood`);
});

test('the next day starts from the scene as made; the same weather gives the same water', () => {
  for (const { c, sc } of MADE.slice(0, 10)) {
    const dry = WX.waterWeatherDry(sc);
    WX.waterWeatherApply(sc, 'storm', GAME_DATA.scenery);
    const once = JSON.stringify([sc.tiles, sc.waters]);
    WX.waterWeatherApply(sc, 'clear', GAME_DATA.scenery);
    assert.deepEqual(sc.tiles, dry.tiles, `seed ${c.seed}: clear again`);
    assert.deepEqual(sc.waters, dry.waters, `seed ${c.seed}`);
    assert.equal(sc.wx, undefined);
    WX.waterWeatherApply(sc, 'storm', GAME_DATA.scenery);
    assert.equal(JSON.stringify([sc.tiles, sc.waters]), once, `seed ${c.seed}: the same flood`);
    WX.waterWeatherApply(sc, 'snow', GAME_DATA.scenery);
    assert.deepEqual(sc.tiles, dry.tiles, `seed ${c.seed}: snow floods nothing`);
    WX.waterWeatherApply(sc, 'rain');
  }
});

test('snow freezes still water into ice you walk on, deep middle and all; a river keeps flowing', () => {
  let ponds = 0;
  for (const { c, sc } of MADE) {
    const where = `seed ${c.seed} ${c.biome}`,
      run = WX.waterRunningMask(sc);
    if (WX.waterWeatherApply(sc, 'snow') !== 'ice') continue;
    ponds++;
    const ice = sc.waters.filter(r => r.k === 'ice');
    assert.ok(ice.length, where);
    for (const r of ice)
      for (let j = r.z; j < r.z + r.h; j++)
        for (let i = r.x; i < r.x + r.w; i++) {
          const ch = tileAt(sc, i, j);
          assert.ok('wd'.includes(ch) && !run[j * sc.w + i], `${where}: ice at ${i},${j} on still water`);
          assert.equal(W.wadeWalkable(sc, ch, null, i + 0.5, j + 0.5), true, `${where}: walk on the ice at ${i},${j}`);
          assert.equal(W.wadeHere(sc, i + 0.5, j + 0.5), false, `${where}: on top, not wading`);
        }
    for (let q = 0; q < sc.w * sc.h; q++) {
      const i = q % sc.w,
        j = Math.floor(q / sc.w);
      if (run[q] && 'wd'.includes(tileAt(sc, i, j)))
        assert.notEqual(W.wadeKindAt(sc, i + 0.5, j + 0.5), 'ice', `${where}: running water at ${i},${j} frozen`);
    }
    WX.waterWeatherApply(sc, 'clear');
  }
  assert.ok(ponds >= 5, `${ponds} places freeze`);
});

test('a flood never rises from lava, rapids, ice or a hot spring; a scene with no water is left as it is', () => {
  assert.ok(!['lava', 'rapids', 'ice', 'hotspring'].some(WX.waterWeatherFloods));
  assert.ok(['pond', 'stream', 'swamp', 'bog', 'lake'].every(WX.waterWeatherFloods));
  const sc = { w: 4, h: 3, tiles: ['gggg', 'gwwg', 'gggg'], waters: [{ x: 1, z: 1, w: 2, h: 1, k: 'lava' }] };
  assert.equal(WX.waterWeatherApply(sc, 'storm'), '', 'lava does not flood');
  assert.equal(WX.waterWeatherApply(sc, 'snow'), '', 'lava does not freeze');
  const pond = { w: 5, h: 3, tiles: ['ggggg', 'gwwwg', 'ggggg'], waterKind: 'pond' };
  assert.equal(WX.waterWeatherApply(pond, 'storm'), 'flood');
  assert.deepEqual(pond.tiles, ['gwwwg', 'wwwww', 'gwwwg'], 'one ring of flood round the pond');
  assert.equal(WX.waterWeatherApply(pond, 'snow'), 'ice');
  assert.deepEqual(pond.waters, [{ x: 1, z: 1, w: 3, h: 1, k: 'ice' }]);
  const dry = { w: 2, h: 1, tiles: ['gg'] };
  assert.equal(WX.waterWeatherApply(dry, 'storm'), '');
  assert.equal(WX.waterWeatherState('rain'), '');
});
