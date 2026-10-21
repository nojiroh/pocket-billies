// Map generator MG-2: scenes that meet. mapgenSeamAgreement measures how two scenes meet where they join (heights
// along the shared edge, the step raise across it, a straight walk across), and a scene generated against its
// neighbour's edge agrees with it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const G = modules.mapgen;
const ctx = { scenery: GAME_DATA.scenery, biomes: GAME_DATA.biomes };
const C = GAME_DATA.scenery;

/* two flat meadows 40 × 30 meeting east to west, half way along */
function flatPair() {
  const flat = (side, id) => {
    const sc = {
      w: 40,
      h: 30,
      edge: 'g',
      tiles: Array.from({ length: 30 }, () => 'g'.repeat(40)),
      heights: Array.from({ length: 31 }, () => new Array(41).fill(0)),
      props: [],
      edgeExits: [{ id, side, t: 0.5, width: 2 }],
    };
    sc.exits = sc.edgeExits.map(e => G.mapgenExitPoint(sc.w, sc.h, e));
    return sc;
  };
  return [flat('E', 'east'), flat('W', 'west')];
}
const steps = (sc, fn) => {
  const S = new Int16Array(sc.w * sc.h * 4);
  for (let j = 0; j < sc.h * 2; j++) for (let i = 0; i < sc.w * 2; i++) S[j * sc.w * 2 + i] = fn(i / 2, j / 2) * 20;
  sc.steps = G.mapgenEncodeBase64(new Uint8Array(S.buffer));
};

test('two flat scenes meet: no gap, the same raise, a straight walk across', () => {
  const [A, B] = flatPair();
  assert.deepEqual(G.mapgenSeamAgreement(A, 'east', B, 'west', C), {
    off: [40, 0],
    dhNear: 0,
    dhBand: 0,
    raiseExit: 0,
    raiseBand: 0,
    walk: null,
  });
});

test('the measure sees each fault: a height gap, a raise, water or a step on the way across', () => {
  let [A, B] = flatPair();
  B.heights[30 - 17][0] = 0.2; /* B's west edge (x 0), 2 m from the exit (z 15) */
  let r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.equal(r.dhNear, 0.2);
  [A, B] = flatPair();
  B.heights[30 - 5][0] = 0.4; /* 10 m from the exit: in the band, not near it */
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.deepEqual([r.dhNear, r.dhBand], [0, 0.4]);
  [A, B] = flatPair();
  steps(B, x => (x < 6 ? 0.5 : 0));
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.equal(r.raiseExit, 0.5);
  assert.match(r.walk, /^a step of 0\.50 m/);
  [A, B] = flatPair();
  B.tiles = B.tiles.map(row => 'ww' + row.slice(2));
  r = G.mapgenSeamAgreement(A, 'east', B, 'west', C);
  assert.match(r.walk, /^blocked .* in the second scene/);
});

test('two routes generated on their own do not meet (so the measure can tell)', () => {
  const mk = (seed, exits) => G.mapgenScene({ seed, w: 112, h: 64, land: { hills: 0.5 }, road: { exits } }, ctx).scene;
  const P = mk(3, [
      { side: 'S', t: 0.5 },
      { side: 'N', t: 0.25 },
    ]),
    K = mk(9, [
      { side: 'S', t: 0.75 },
      { side: 'N', t: 0.5 },
    ]);
  const r = G.mapgenSeamAgreement(P, 'north', K, 'south', C);
  assert.deepEqual(r.off, [-56, 64]);
  assert.ok(r.dhBand > 0.05, `the band differs by ${r.dhBand} m`);
});
