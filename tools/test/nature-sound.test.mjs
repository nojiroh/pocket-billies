// Sound track SND-14: the weather, the wild and the town as numbers (game/js/logic/nature-sound.js): rain by how
// hard it falls, thunder from a bolt by its distance, wind and gusts, birds by the hour, insects and frogs, a fire by
// its size, footsteps by the ground, the town's life, a room's tone; seeded, never Math.random.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  natureBetween,
  natureBirdWait,
  natureBirds,
  natureBouts,
  natureCurve,
  natureEvery,
  natureFindings,
  natureFire,
  natureFrogs,
  natureGust,
  natureInsects,
  naturePatter,
  natureRain,
  natureRoof,
  natureRoom,
  natureStep,
  natureStepSurface,
  natureThunder,
  natureTown,
  natureWind,
} from '../../game/js/logic/nature-sound.js';
import { ambienceRandom } from '../../game/js/logic/ambience-sound.js';

const S = JSON.parse(readFileSync(new URL('../../game/data/soundscape.json', import.meta.url), 'utf8'));
const N = S.nature;

test('a curve is straight between its points and flat past its ends', () => {
  const C = [
    [0, 0],
    [1, 10],
    [3, 30],
  ];
  assert.equal(natureCurve(C, -1), 0);
  assert.equal(natureCurve(C, 0.5), 5);
  assert.equal(natureCurve(C, 2), 20);
  assert.equal(natureCurve(C, 9), 30);
  assert.equal(natureCurve([], 1), 0);
  const r = ambienceRandom(1);
  for (let i = 0; i < 50; i++) {
    const v = natureBetween([2, 5], r);
    assert.ok(v >= 2 && v <= 5);
  }
});

test('rain thickens with how hard it falls: the wash, the heavy roar past 0.6, more patter', () => {
  const none = natureRain(N.rain, 0),
    light = natureRain(N.rain, 0.3),
    rain = natureRain(N.rain, 1),
    storm = natureRain(N.rain, 1.6);
  assert.deepEqual(none, { wash: 0, heavy: 0, patter: 0 });
  assert.ok(light.wash > 0 && light.wash < rain.wash && rain.wash <= storm.wash);
  assert.equal(light.heavy, 0);
  assert.ok(rain.heavy > 0 && storm.heavy > rain.heavy);
  assert.ok(light.patter < rain.patter && rain.patter < storm.patter);
});

test('the rain on roofs: full under the eaves, fading out by its range, indoors its own level, nothing dry', () => {
  const R = N.rain.roof;
  assert.equal(natureRoof(R, 1, false, 0), 0);
  assert.equal(natureRoof(R, null, false, 1), 0);
  assert.equal(natureRoof(R, R.range + 1, false, 1), 0);
  const under = natureRoof(R, 0.5, false, 1.6),
    mid = natureRoof(R, (R.near + R.range) / 2, false, 1.6);
  assert.equal(under, R.level);
  assert.ok(mid > 0 && mid < under);
  assert.equal(natureRoof(R, null, true, 1.6), R.indoor);
  assert.ok(natureRoof(R, null, true, 0.3) < R.indoor);
});

test('patter: drops at its rate, each within its ranges, more and higher on leaves; none at rate 0', () => {
  const P = N.rain.patter,
    r = ambienceRandom(7),
    st = {};
  let all = [];
  for (let t = 0; t < 60; t += 0.2) all = all.concat(naturePatter(P, st, t, t + 0.3, r, 10, 0));
  assert.ok(all.length > 450 && all.length < 750, `about 600 drops in a minute at 10 a second (${all.length})`);
  for (const e of all) {
    assert.ok(e.f >= P.f[0] && e.f <= P.f[1]);
    assert.ok(e.d >= P.d[0] && e.d <= P.d[1]);
    assert.ok(e.gain > 0 && e.gain <= P.gain);
    assert.ok(Math.abs(e.pan) <= 0.8);
  }
  for (let i = 1; i < all.length; i++) assert.ok(all[i].t >= all[i - 1].t, 'in time order across updates');
  const leafy = naturePatter(P, {}, 0, 30, ambienceRandom(7), 10, 1);
  assert.ok(
    leafy.some(e => e.f > P.f[1]),
    'drops on leaves ring higher'
  );
  assert.deepEqual(naturePatter(P, {}, 0, 5, r, 0), []);
});

test('thunder comes after the bolt by its distance; near is a soft-edged crack and brighter rolls, far a low rumble', () => {
  const T = N.thunder,
    near = natureThunder(T, ambienceRandom(3), 0.5),
    far = natureThunder(T, ambienceRandom(3), 4.4);
  assert.ok(Math.abs(near.delay - 0.5 / T.speed) < 1e-9);
  assert.ok(Math.abs(far.delay - 4.4 / T.speed) < 1e-9);
  const peak = L => Math.max(...L.parts.map(p => p.gain)),
    bright = L => Math.max(...L.parts.map(p => p.lp));
  assert.ok(peak(near) > peak(far) * 2, 'near is louder');
  assert.ok(bright(near) > bright(far) * 2, 'near is brighter');
  assert.ok(
    near.parts.every(p => p.a >= T.attack[0]),
    'never sudden: every part rises over a few hundredths'
  );
  assert.ok(
    far.parts.every(p => p.lp <= T.lp[0] * 1.5),
    'far: only the lows'
  );
  const r = ambienceRandom(11),
    ds = Array.from({ length: 400 }, () => natureThunder(T, r).km).sort((a, b) => a - b);
  assert.ok(ds[0] >= T.km[0] && ds[ds.length - 1] <= T.km[1]);
  assert.ok(ds[200] > (T.km[0] + T.km[1]) / 2, 'more far bolts than near ones');
});

test('wind: none indoors, a breeze outside, more in a storm; the gusts lift it and the leaves', () => {
  const W = N.wind,
    calm = { storm: 0, snow: 0, alpine: false, open: 1, gust: 0 };
  assert.equal(natureWind(W, { ...calm, open: 0, storm: 1 }), 0);
  const breeze = natureWind(W, calm);
  assert.ok(breeze > 0);
  assert.ok(natureWind(W, { ...calm, storm: 1 }) > breeze * 3);
  assert.ok(natureWind(W, { ...calm, gust: 1.5 }) > breeze * 1.5);
  assert.equal(natureGust(W, 99), natureGust(W, 1.6), 'a gust is capped');
  assert.equal(natureGust({ gust: N.wind.leaves }, 0), N.wind.leaves[0]);
});

test('birds by the hour: a dawn chorus with short gaps, quiet at noon, the owl alone at night', () => {
  const B = N.birds,
    wait = h => {
      const r = ambienceRandom(5);
      let s = 0;
      for (let i = 0; i < 200; i++) s += natureBirdWait(B, r, h, false);
      return s / 200;
    };
  assert.ok(wait(6) * 3 < wait(9), 'the dawn chorus calls far more often');
  assert.ok(wait(13) > wait(9) * 2, 'noon is quiet');
  const L = ['lark', 'song'];
  assert.deepEqual(natureBirds(B, L, 23, 1, false), ['owl']);
  assert.deepEqual(natureBirds(B, L, 23, 1, true), [], 'no owl in a town');
  assert.deepEqual(natureBirds(B, [], 23, 1, false), [], 'no owl where no bird lives (a cave)');
  assert.deepEqual(natureBirds(B, L, 10, 0, false), L);
  const dawn = natureBirds(B, L, 6, 0.2, false);
  assert.ok(dawn.length > L.length && B.chorusAdd.every(b => dawn.includes(b)));
});

test('insects: crickets by night (fewer in town, few in winter, none in the rain); grasshoppers and cicadas by day', () => {
  const I = N.insects,
    here = { biome: 'meadow', hour: 13, night: 0, season: 'summer', rain: 0, town: false };
  assert.deepEqual(natureInsects(I, here), { crickets: 0, day: 'grasshopper' });
  assert.equal(natureInsects(I, { ...here, biome: 'desert' }).day, 'cicada');
  assert.equal(natureInsects(I, { ...here, biome: 'desert', season: 'spring' }).day, null);
  assert.equal(natureInsects(I, { ...here, hour: 7 }).day, null, 'not before the day warms');
  assert.equal(natureInsects(I, { ...here, rain: 1 }).day, null);
  assert.equal(natureInsects(I, { ...here, biome: 'cavern' }).day, null);
  const night = { ...here, hour: 23, night: 1 };
  assert.equal(natureInsects(I, night).crickets, I.crickets.gain);
  assert.equal(natureInsects(I, night).day, null);
  assert.ok(natureInsects(I, { ...night, town: true }).crickets < I.crickets.gain);
  assert.ok(natureInsects(I, { ...night, season: 'winter' }).crickets < I.crickets.gain / 2);
  assert.equal(natureInsects(I, { ...night, rain: 1 }).crickets, 0);
});

test('bouts with pauses: each caller calls in bouts of count, step apart, with gaps; never before t0', () => {
  const B = N.frogs,
    r = ambienceRandom(9),
    who = [{}, {}];
  let all = [];
  for (let t = 10; t < 130; t += 0.2) {
    const ev = natureBouts(who, t, t + 0.3, r, B);
    assert.ok(ev.every(e => e.t >= t && e.t < t + 0.3));
    all = all.concat(ev);
  }
  for (const i of [0, 1]) {
    const T = all.filter(e => e.who === i).map(e => e.t);
    assert.ok(T.length > 20);
    const gaps = T.slice(1).map((t, k) => t - T[k]);
    assert.ok(
      gaps.every(g => g >= B.step[0] - 1e-9),
      'never closer than a step'
    );
    assert.ok(
      gaps.some(g => g >= B.gap[0]),
      'pauses between bouts'
    );
  }
});

test('one at a time with a lockout: every next is every[0]-every[1] after the last', () => {
  const r = ambienceRandom(4),
    st = {};
  let T = [];
  for (let t = 0; t < 300; t += 0.2) T = T.concat(natureEvery(st, t, t + 0.3, r, [5, 9]));
  const gaps = T.slice(1).map((t, k) => t - T[k]);
  assert.ok(gaps.length > 25);
  assert.ok(gaps.every(g => g >= 5 - 1e-9 && g <= 9 + 1e-9));
});

test('frogs by still water at night in the warm seasons, fewer in the rain', () => {
  const F = N.frogs;
  assert.equal(natureFrogs(F, 0, 'summer', 0), 0);
  assert.equal(natureFrogs(F, 1, 'winter', 0), 0);
  const n = natureFrogs(F, 1, 'summer', 0);
  assert.ok(n > 0.9 && n <= 1);
  assert.ok(natureFrogs(F, 1, 'summer', 1) < n);
});

test('a fire by its size: a campfire heard further and louder than a fireplace, a big one more so', () => {
  const F = N.fire,
    camp = natureFire(F, 'campfire'),
    hearth = natureFire(F, 'fireplace'),
    big = natureFire(F, 'campfire', 2);
  assert.equal(camp.range, F.range);
  assert.equal(camp.gain, F.gain);
  assert.ok(hearth.range < camp.range && hearth.gain < camp.gain && hearth.crackle < camp.crackle);
  assert.ok(big.range > camp.range && big.gain > camp.gain && big.crackle > camp.crackle);
  assert.equal(natureFire(F, 'unknown').size, 1);
});

test('footsteps by the ground: every terrain has a surface, boards are wood, each step a little different', () => {
  const St = N.steps,
    scenery = JSON.parse(readFileSync(new URL('../../game/data/scenery.json', import.meta.url), 'utf8'));
  for (const code of Object.keys(scenery.terrains)) {
    const s = natureStepSurface(St, code);
    assert.ok(St.surfaces[s], `${code} has a surface (${s})`);
  }
  assert.equal(natureStepSurface(St, 'b'), 'wood');
  assert.equal(natureStepSurface(St, 'g'), 'grass');
  assert.equal(natureStepSurface(St, 's'), 'sand');
  assert.equal(natureStepSurface(St, 'u'), 'dirt');
  assert.equal(natureStepSurface(St, 'K'), 'stone');
  assert.equal(natureStepSurface(St, 'n'), 'snow');
  assert.equal(natureStepSurface(St, 'D'), 'mud');
  assert.equal(natureStepSurface(St, 'wet'), 'wet');
  const r = ambienceRandom(2),
    a = natureStep(St, 'gravel', r, 0),
    b = natureStep(St, 'gravel', r, 1);
  assert.equal(a.hits.length, St.surfaces.gravel.length);
  assert.notEqual(a.hits[0].f, b.hits[0].f);
  assert.equal(a.pan, -b.pan);
  for (const h of a.hits) assert.ok(['lp', 'bp', 'hp'].includes(h.type) && h.f > 0 && h.vol > 0 && h.dur > 0);
  assert.equal(natureStep(St, 'nowhere', r, 0).hits.length, St.surfaces.stone.length, 'an unknown surface is stone');
});

test("the town's life: one event at a time, rarer by night, the same kind seldom twice running", () => {
  const T = N.town,
    count = night => {
      const r = ambienceRandom(8),
        st = {};
      let L = [];
      for (let t = 0; t < 600; t += 0.2) L = L.concat(natureTown(T, st, t, t + 0.3, r, night));
      return L;
    },
    day = count(0),
    night = count(1);
  assert.ok(day.length > 30 && night.length < day.length / 1.8);
  const gaps = day.slice(1).map((e, k) => e.t - day[k].t);
  assert.ok(gaps.every(g => g >= T.every[0] - 1e-9));
  const kinds = new Set(day.map(e => e.kind));
  assert.deepEqual([...kinds].sort(), Object.keys(T.kinds).sort());
  const repeats = day.slice(1).filter((e, k) => e.kind === day[k].kind).length;
  assert.ok(repeats < day.length / 6);
  assert.ok(night.filter(e => e.kind === 'cart').length < night.length / 8, 'few carts at night');
});

test("a room's tone by its kind; a room not listed is the default", () => {
  const R = N.rooms;
  assert.equal(natureRoom(R, 'int_inn').kind, 'inn');
  assert.equal(natureRoom(R, 'int_inn').bed, 'town');
  assert.equal(natureRoom(R, 'int_gene_bank').kind, 'gene_bank');
  assert.equal(natureRoom(R, 'int_lab').bed, 'roomHum');
  assert.equal(natureRoom(R, 'int_house_2').kind, 'house');
  assert.equal(natureRoom(R, 'int_castle').kind, '_');
  assert.equal(natureRoom(R, null).bed, R._.bed);
});

test('the game data has no findings; a broken nature section has', () => {
  assert.deepEqual(natureFindings(S), []);
  const B = structuredClone(S);
  B.nature.rooms.inn.bed = 'nope';
  delete B.nature.rooms._;
  B.nature.steps.ground.mud += 'g';
  B.nature.steps.ground.lava = 'Q';
  B.nature.birds.hours = [
    [5, 1],
    [2, 1],
  ];
  const F = natureFindings(B).join('\n');
  for (const want of ['rooms.inn', 'default room', '"g" is both', 'ground.lava', 'birds.hours'])
    assert.match(F, new RegExp(want));
});

test('never Math.random: everything here runs on the seeded random it is given', () => {
  const real = Math.random;
  Math.random = () => {
    throw new Error('Math.random called');
  };
  try {
    const r = ambienceRandom(12);
    naturePatter(N.rain.patter, {}, 0, 10, r, 12, 0.5);
    natureThunder(N.thunder, r);
    natureBirdWait(N.birds, r, 6, false);
    natureBouts([{}, {}], 0, 30, r, N.frogs);
    natureEvery({}, 0, 30, r, [3, 6]);
    natureStep(N.steps, 'snow', r, 1);
    natureTown(N.town, {}, 0, 60, r, 0.5);
  } finally {
    Math.random = real;
  }
});
