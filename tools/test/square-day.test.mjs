// Hub track HB-10c: the square's day (game/js/logic/square-day.js): its stops by HB-10b's edge props on the built
// Copperleaf map (walkable from the hub, the middle left clear), the slots of the day, who goes, the townsfolk drawn
// at once, and the ranch's Billies' visits.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { SQUARE_FOLK, WALK_R } from '../square-props.mjs';
import { mapgenReach } from '../../game/js/logic/mapgen.js';
import {
  folkCap,
  squareGoers,
  squareMiddle,
  squareSlot,
  squareStopFor,
  squareBuskSong,
  squareBusker,
  squareStops,
  squareVisitAt,
  squareVisits,
} from '../../game/js/logic/square-day.js';

const D = readGameData(),
  M = D.maps.copperleaf,
  S = D.rules.square,
  well = M.plots.find(L => L.k === 'well'),
  stops = squareStops(M.props, M.hub),
  count = k => stops.filter(s => s.k === k).length;

test('Copperleaf has SQUARE_FOLK townsfolk, the most the Engine draws at once by default', () => {
  assert.equal(M.folk, SQUARE_FOLK);
  assert.equal(SQUARE_FOLK, 10);
});

test('the middle is the fountain; a map without a square has no stops', () => {
  assert.deepEqual(squareMiddle(M.props), [well.x, well.z]);
  assert.deepEqual(squareStops(M.props.filter(p => !p.sq)), []);
});

test('the stops: behind and in front of each stall and the cart, by the benches, under the lamps, round the fountain, the busker’s', () => {
  assert.deepEqual(
    ['keep', 'shop', 'sit', 'lamp', 'fountain', 'busk'].map(count),
    [4, 4, 4, 7, 3, 1],
    JSON.stringify(stops.map(s => s.k))
  );
});

test('the middle stays walkable: only the fountain stops are nearer than the edge props, and they clear its basin', () => {
  const basin = D.scenery.props.fountain.solid;
  for (const s of stops) {
    const r = Math.hypot(s.x - well.x, s.z - well.z);
    if (s.k === 'fountain') assert.ok(r >= basin + 0.6 && r <= 3, `fountain stop ${r}`);
    else assert.ok(r >= WALK_R, `${s.k} stop at ${s.x}, ${s.z}: ${r.toFixed(1)} m from the middle`);
  }
});

test('nobody stands in the stick’s run from the hub (HB-10b) or within 2 m of where you arrive', () => {
  const O = M.cam.orbit.c,
    L = Math.hypot(O[0] - M.hub[0], O[1] - M.hub[1]),
    u = [(O[0] - M.hub[0]) / L, (O[1] - M.hub[1]) / L];
  for (const s of stops) {
    assert.ok(Math.hypot(s.x - M.hub[0], s.z - M.hub[1]) >= 2, `${s.k} stop at ${s.x}, ${s.z} by the hub`);
    for (let t = -4; t <= 4; t += 0.25)
      assert.ok(
        Math.hypot(M.hub[0] + t * u[0] - s.x, M.hub[1] + t * u[1] - s.z) >= 1.5,
        `${s.k} stop at ${s.x}, ${s.z} in the run`
      );
  }
  assert.equal(squareStops(M.props).filter(s => s.k === 'fountain').length, 6);
});

test('every stop can be walked to from the hub', () => {
  const R = mapgenReach(M, D.scenery, M.hub, { slope: true }),
    { N, gw } = R;
  for (const s of stops) {
    /* the game stands a person on the walkable point nearest (walkablePointNear): one within half a metre will do */
    let ok = false;
    for (let dj = -1; dj <= 1 && !ok; dj++)
      for (let di = -1; di <= 1 && !ok; di++)
        ok = R.dist[(Math.floor(s.z * N) + dj) * gw + Math.floor(s.x * N) + di] >= 0;
    assert.ok(ok, `${s.k} stop at ${s.x}, ${s.z}`);
  }
});

test('the day: a morning market, a busy midday, a quiet lantern evening; nobody stops there at night', () => {
  assert.equal(squareSlot(S.day, 8).k, 'market');
  assert.equal(squareSlot(S.day, 12.5).k, 'midday');
  assert.equal(squareSlot(S.day, 20).k, 'evening');
  assert.equal(squareSlot(S.day, 3), null);
  assert.equal(squareSlot(S.day, 32).k, 'market');
  const share = k => S.day.find(s => s.k === k).share;
  assert.ok(share('midday') > share('market') && share('market') > share('evening'));
});

test('who goes: the slot’s share of the folk, the same people each day, ranks 0 up', () => {
  const T = squareSlot(S.day, 12.5),
    G = squareGoers(10, T, 123);
  assert.equal(G.size, Math.round(T.share * 10));
  assert.deepEqual(
    [...G.values()].sort((a, b) => a - b),
    [...Array(G.size).keys()]
  );
  assert.deepEqual([...squareGoers(10, T, 123)], [...G]);
  assert.notDeepEqual([...squareGoers(10, squareSlot(S.day, 20), 123).keys()], [...G.keys()].slice(0, 3));
});

test('a goer’s stop: the slot’s kinds in turn; at the market the stalls are kept first', () => {
  const T = squareSlot(S.day, 8);
  assert.equal(squareStopFor(stops, T, 0).k, 'keep');
  assert.equal(squareStopFor(stops, T, 1).k, 'shop');
  assert.notDeepEqual(squareStopFor(stops, T, 0), squareStopFor(stops, T, 2));
  assert.equal(squareStopFor([], T, 0), null);
});

test('the townsfolk drawn at once: the setting, 0.8 of it on Balanced, 0.6 once the frames come late', () => {
  assert.equal(folkCap(10, 0, 'sharp'), 10);
  assert.equal(folkCap(10, 1, 'smooth'), 8);
  assert.equal(folkCap(10, 2, 'sharp'), 6);
  assert.equal(folkCap(0, 0), 0);
});

test('the visits: 1-2 Billies by day, each whole visit inside its block, none at night', () => {
  const V = S.visit,
    uids = ['a', 'b', 'c', 'd'],
    walk = 110;
  assert.deepEqual(squareVisits(5, uids, V, 22, walk), []);
  assert.deepEqual(squareVisits(5, [], V, 12, walk), []);
  for (let b = 0; b < 40; b++) {
    const L = squareVisits(b, uids, V, 12, walk);
    assert.ok(L.length >= 1 && L.length <= V.most);
    assert.equal(new Set(L.map(v => v.uid)).size, L.length);
    for (const v of L) {
      assert.ok(v.at >= 0 && v.at + 2 * walk + v.stay <= V.every, JSON.stringify(v));
      assert.ok(v.stay >= Math.min(V.stay[0], V.every - 2 * walk - 10));
    }
  }
  assert.deepEqual(squareVisits(7, uids, V, 12, walk), squareVisits(7, uids, V, 12, walk));
});

test('where a visit is: there, at the square, back, then home', () => {
  const v = { uid: 'a', at: 100, stay: 60, stop: 0 };
  assert.equal(squareVisitAt(v, 50, 100, 120), null);
  assert.deepEqual(squareVisitAt(v, 150, 100, 120), { leg: 'there', s: 60 });
  assert.deepEqual(squareVisitAt(v, 220, 100, 120), { leg: 'stay', s: 120 });
  assert.deepEqual(squareVisitAt(v, 310, 100, 120), { leg: 'back', s: 60 });
  assert.equal(squareVisitAt(v, 360, 100, 120), null);
});

test('the busker’s slot (HB-10d): no slot of the day sends townsfolk there', () => {
  for (const T of S.day) {
    assert.ok(!T.stops.includes('busk'), T.k);
    for (let rank = 0; rank < 40; rank++) {
      const at = squareStopFor(stops, T, rank);
      assert.ok(!at || at.k !== 'busk', `${T.k} rank ${rank}`);
    }
  }
});

test('the busker: a resident who busks and lives in town; they play your last run’s theme', () => {
  const RES = { dottie: { name: 'Dottie' }, lark: { name: 'Lark', busk: true } };
  assert.equal(squareBusker({ residents: {} }, RES), null, 'nobody yet: the case lies empty');
  assert.equal(squareBusker({ residents: { dottie: 1 } }, RES), null);
  assert.equal(squareBusker({ residents: { dottie: 1, lark: 3 } }, RES), 'lark');
  assert.equal(squareBusker({ residents: { dottie: 1 } }, D.residents), null, 'none of the game’s residents busks yet');
  assert.equal(squareBuskSong([], S.busk.songs), null);
  assert.equal(squareBuskSong([{ theme: 'lakeland' }, { theme: 'harvest' }], S.busk.songs), 'spire');
  assert.equal(squareBuskSong([{ theme: 'nowhere' }], S.busk.songs), null);
  for (const t of Object.keys(D.regions.themes)) assert.ok(D.music.songs[S.busk.songs[t]], `a song for ${t}`);
  /* where you arrive home the town's own song plays: the hub is out of the busker's earshot */
  const c = M.props.find(p => p.k === 'busker_case');
  assert.ok(Math.hypot(c.x - M.hub[0], c.z - M.hub[1]) > S.busk.near + 1);
});
