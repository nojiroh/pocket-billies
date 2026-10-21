// Map generator MG-2: the hub's buildings (the props dials mast, clinic and shop; RL-8's run towns). Each stands
// beside the main road near the hub facing the camera, on level ground, its door (or the mast's landing spot) a walk
// from the hub, its room fitting behind the door, nothing growing on its lot or its path.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const C = GAME_DATA.scenery,
  ctx = { scenery: C, biomes: GAME_DATA.biomes };
const ACT = { clinic: 'clinic', shop: 'shop', airship_station: 'fly' };

function towns(seed, n) {
  const R = modules.rng.rngFrom(seed, 'lots'),
    pick = o => Object.keys(o)[R.int(0, Object.keys(o).length - 1)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const exits = [
      [
        { side: 'W', t: 0.5 },
        { side: 'E', t: 0.5 },
      ],
      [
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.5 },
      ],
      [
        { side: 'S', t: 0.5 },
        { side: 'N', t: 0.25 },
        { side: 'N', t: 0.75 },
      ],
    ][i % 3];
    const p = {
      biome: pick(GAME_DATA.biomes),
      seed: R.int(0, 1e6),
      w: 112,
      h: 64,
      land: {
        hills: R.next(),
        water: pick(G.MAPGEN_WATER),
        waterAmount: R.next(),
        terraces: R.chance(0.3) ? R.next() : 0,
      },
      road: { exits, shape: pick(G.MAPGEN_SHAPES), wobble: R.next() },
      feature: pick(G.MAPGEN_FEATURES),
      props: { mast: 1, clinic: 1, shop: 1 },
    };
    out.push({ p, ...G.mapgenScene(p, ctx) });
  }
  return out;
}

test('off by default: no building at the hub', () => {
  const sc = G.mapgenScene({ seed: 4242 }, ctx).scene;
  assert.ok(!sc.props.some(p => p.k in ACT));
});

test('the clinic, the shop and the mast stand by the hub, each a walk from it', () => {
  const made = towns(1, 30);
  let placed = 0;
  for (const { p, scene: sc, notes } of made) {
    const where = JSON.stringify(p),
      reach = G.mapgenReach(sc, C),
      W = G.mapgenWalkGrid(sc, C),
      surf = G.MAPGEN_SURFACES[sc.gen.params.road.surface],
      tile = (x, z) => (sc.tiles[sc.h - 1 - Math.floor(z)] || '')[Math.floor(x)];
    const built = sc.props.filter(q => q.k in ACT);
    placed += built.length;
    assert.equal(built.length + notes.filter(t => /^no room for the (clinic|shop|airship)/.test(t)).length, 3, where);
    for (const b of built) {
      const M = C.props[b.k],
        [bw, bd] = M.box,
        dx = ((M.door && M.door.x) || 0) / (C.ppu || 34);
      assert.equal(b.act, ACT[b.k], where);
      assert.equal(b.g, 1, where);
      assert.ok(!b.rot && !b.f, `${where}: ${b.k} faces the camera`);
      if (b.k === 'airship_station') assert.equal(b.label, 'Airship station');
      /* the spot you use it from: the door step, or where the airship sets you down (airship.js flyLand) */
      const spot = b.k === 'airship_station' ? [b.x + bw / 2 + 0.9, b.z - 0.9] : [b.x + dx, b.z - 0.55];
      assert.ok(G.mapgenReached(reach, ...spot), `${where}: ${b.k}'s ${spot} can't be walked to from the hub`);
      if (b.k !== 'airship_station') {
        /* a door: its room fits behind it (seamlessRoomPlacement), and a path to it is painted */
        assert.ok(spot[0] >= 7 && spot[0] <= sc.w - 7 && b.z <= sc.h - 10.4, `${where}: ${b.k}'s room fits`);
        assert.equal(tile(...spot), surf, `${where}: ${b.k}'s door step is on its path`);
        assert.equal(b.z * 2, Math.round(b.z * 2), `${where}: ${b.k} on a half metre`);
      }
      /* level: the corners under it agree, and so does the step raise */
      const hs = [];
      for (let z = Math.ceil(b.z); z <= Math.floor(b.z + bd); z++)
        for (let x = Math.ceil(b.x - bw / 2); x <= Math.floor(b.x + bw / 2); x++)
          hs.push(G.mapgenSceneCorner(sc, x, z));
      assert.ok(
        Math.max(...hs) - Math.min(...hs) <= 0.01,
        `${where}: ${b.k} on level ground (${Math.min(...hs)}..${Math.max(...hs)})`
      );
      if (W.S) {
        const rs = new Set();
        for (let z = b.z; z < b.z + bd; z += 0.5)
          for (let x = b.x - bw / 2; x < b.x + bw / 2; x += 0.5)
            rs.add(W.S[Math.floor(z * 2) * W.gw + Math.floor(x * 2)]);
        assert.equal(rs.size, 1, `${where}: ${b.k}'s floor at one raise`);
      }
      /* on dry ground off the road, and nothing else stands on its lot */
      for (let z = Math.floor(b.z); z < b.z + bd; z++)
        for (let x = Math.floor(b.x - bw / 2); x < b.x + bw / 2; x++)
          assert.ok(!'wd'.includes(tile(x + 0.5, z + 0.5)), `${where}: ${b.k} over water`);
      for (const q of sc.props)
        if (q !== b && q.x > b.x - bw / 2 && q.x < b.x + bw / 2 && q.z > b.z - 0.1 && q.z < b.z + bd)
          assert.fail(`${where}: ${q.k} stands on the ${b.k}'s lot`);
    }
    assert.deepEqual(G.mapgenUnreachable(sc, C), [], where);
  }
  assert.ok(placed >= 87, `${placed} of 90 placed`);
});
