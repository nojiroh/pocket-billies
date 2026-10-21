// Phase 10, the look, session 4: landmarks, buildings and trees on the world map (game/js/logic/bowl-things.js).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PB_DATA } from '../data-files.mjs';
import './setup-real.mjs';
import { oldWorld } from './old-world.mjs';
import {
  BOWL_REGION_TREES,
  bowlClumps,
  bowlLandmarkPick,
  bowlMapPoint,
  bowlMapTurn,
  bowlPropClass,
  bowlTreeStyle,
} from '../../game/js/logic/bowl-things.js';
import {
  bowlCoastAt,
  bowlGridHeight,
  bowlGroundGrid,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSpotOf,
  bowlWaterLevel,
  bowlXY,
} from '../../game/js/logic/bowl.js';

/* RL-5: the old world (the game's places and the ones parked in game/data/legacy), with whole maps */
const OLD = oldWorld();
const { locations, maps } = OLD;
const ART = OLD.scenery.props;
const byId = id => locations.find(l => l.id === id);
const spotOf = l => {
  const s = bowlSpotOf(l, byId),
    [x, y] = bowlXY(s.a, s.r);
  return { x, y, under: s.under };
};
/* the full walk maps (props), from either data folder (the page's game data may hold only their outlines) */
const fullMap = id => maps[id];

test('a walk map lies on the bowl as the terrain stamps it: its middle on the place, its north to the centre', () => {
  const l = byId('marigold'),
    s = spotOf(l),
    M = { w: 120, h: 84 },
    mid = bowlMapPoint(s, M, 60, 42),
    up = bowlMapPoint(s, M, 60, 84);
  assert.ok(Math.hypot(mid[0] - s.x, mid[1] - s.y) < 1e-12);
  assert.ok(Math.hypot(up[0], up[1]) < Math.hypot(s.x, s.y), 'the map’s north edge is nearer the centre');
  /* the turn agrees with the points: east of the middle lies along the turn */
  const east = bowlMapPoint(s, M, 70, 42),
    t = bowlMapTurn(s);
  assert.ok(Math.abs(Math.atan2(east[1] - mid[1], east[0] - mid[0]) - t) < 1e-9);
});

test('what props are on the map: trees, buildings, nothing', () => {
  assert.equal(bowlPropClass('tree_oak', ART.tree_oak), 'tree');
  assert.equal(bowlPropClass('house_red', ART.house_red), 'building');
  assert.equal(bowlPropClass('clinic', ART.clinic), 'building');
  assert.equal(bowlPropClass('tallgrass', ART.tallgrass), null);
  assert.equal(bowlPropClass('tree_fallen', ART.tree_fallen), null);
  assert.equal(bowlTreeStyle('tree_larch'), 'cone');
  assert.equal(bowlTreeStyle('mushroom_blue'), 'mushroom');
  assert.equal(bowlTreeStyle('tree_oak'), 'round');
});

test('each place gets its own landmark when its map has one', () => {
  const want = {
    clovercrest: 'windmill',
    palmhaven: 'lighthouse',
    capshade: 'mushroom_colossal',
    marigold: 'clock_tower',
  };
  for (const [id, k] of Object.entries(want)) {
    const l = byId(id),
      lm = bowlLandmarkPick(l, fullMap(l.mapId), ART);
    assert.equal(lm && lm.k, k, id);
  }
  /* a place's own choice wins */
  const l = byId('clovercrest');
  assert.equal(bowlLandmarkPick({ ...l, landmark: 'tree_giant' }, fullMap(l.mapId), ART).k, 'tree_giant');
  /* most places have one */
  const have = locations.filter(l => bowlLandmarkPick(l, fullMap(l.mapId), ART)).length;
  assert.ok(have >= 40, `${have} of ${locations.length} places have a landmark`);
});

test('clumps grow on dry land between places, off the routes, in their region’s kinds', () => {
  const roads = OLD.roads
      .map(r => PB_DATA.road(OLD, r))
      .filter(r => r.kind === 'seam')
      .map(r => [r.a, r.b]),
    S = bowlSeaInput(locations, roads, l => maps[l.mapId] || null),
    G = bowlGroundGrid(bowlReliefFeatures(locations), 320, S),
    places = locations
      .map(l => ({ l, s: spotOf(l) }))
      .filter(q => !q.s.under)
      .map(({ l, s }) => {
        const m = maps[l.mapId];
        return { x: s.x, y: s.y, reach: m ? Math.hypot(m.w, m.h) / 2000 : 0.06, region: l.region || 'starter' };
      }),
    segs = S.roads,
    rel = (x, y) => bowlGridHeight(G, x, y) - bowlWaterLevel(x, y),
    T = bowlClumps(G, places, segs, rel);
  assert.ok(T.length > 300 && T.length < 5000, `${T.length} trees`);
  assert.deepEqual(T.slice(0, 20), bowlClumps(G, places, segs, rel).slice(0, 20), 'not the same twice');
  for (const t of T) {
    assert.ok(bowlCoastAt(G, t.x, t.y) < 0, `a tree in the sea at ${t.x},${t.y}`);
    for (const p of places) assert.ok(Math.hypot(t.x - p.x, t.y - p.y) > p.reach, 'a tree on a place’s own ground');
    for (const [ax, ay, bx, by] of segs) {
      const vx = bx - ax,
        vy = by - ay,
        k = Math.max(0, Math.min(1, ((t.x - ax) * vx + (t.y - ay) * vy) / (vx * vx + vy * vy)));
      assert.ok(Math.hypot(t.x - ax - vx * k, t.y - ay - vy * k) > 0.012, 'a tree on a route');
    }
    assert.ok((BOWL_REGION_TREES[t.region] || BOWL_REGION_TREES.starter).includes(t.style));
  }
});
