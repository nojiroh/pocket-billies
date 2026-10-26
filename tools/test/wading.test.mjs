// Water track WA-6a: wading in shallow water (game/js/logic/wading.js), the walk grid's water rule
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WADE_DEPTH,
  WADE_SLOW,
  wadeDepthAt,
  wadeHere,
  wadeKindAt,
  wadeSpeed,
  wadeWalkable,
} from '../../game/js/logic/wading.js';

/* 8 x 5 m, rows from the far edge: grass round a pond of shallows with a deep middle, and a lava pool at the east */
const pond = () => ({
  w: 8,
  h: 5,
  edge: 'g',
  tiles: ['gggggggg', 'gwwwwgww', 'gwdddgww', 'gwwwwgww', 'gggggggg'],
  waters: [{ x: 6, z: 1, w: 2, h: 3, k: 'lava' }],
});
const tile = (sc, x, z) => sc.tiles[sc.h - 1 - Math.floor(z)][Math.floor(x)];
const walk = (sc, x, z, T = null) => wadeWalkable(sc, tile(sc, x, z), T, x, z);

test('wading: shallows open, deep water and lava shut, ice walked on, land as before', () => {
  const sc = pond();
  assert.equal(walk(sc, 0.5, 0.5), true, 'grass');
  assert.equal(walk(sc, 1.5, 1.5), true, 'shallows');
  assert.equal(walk(sc, 2.5, 2.5), false, 'deep water');
  assert.equal(walk(sc, 6.5, 2.5), false, 'lava shallows');
  assert.equal(wadeKindAt(sc, 6.5, 2.5), 'lava');
  assert.equal(wadeKindAt(sc, 1.5, 1.5), 'pond', 'no rectangle: the scene kind, pond by default');
  const ice = Object.assign(pond(), { waterKind: 'ice', waters: [] });
  assert.equal(walk(ice, 1.5, 1.5), true, 'WA-5a: a scene of ice: walked on top');
  assert.equal(walk(ice, 2.5, 2.5), true, 'WA-5a: its deep middle too (a frozen pond)');
  assert.equal(wadeHere(ice, 1.5, 1.5), false, 'on the ice, not wading');
  assert.equal(wadeDepthAt(ice, 1.5, 1.5), 0, 'standing on top');
  const lake = Object.assign(pond(), { waterKind: 'lake' });
  assert.equal(walk(lake, 1.5, 1.5), true, 'a lake scene: waded');
  assert.equal(wadeHere(sc, 1.5, 1.5), true);
  assert.equal(wadeHere(sc, 2.5, 2.5), false, 'deep is not wading');
  assert.equal(wadeHere(sc, 0.5, 0.5), false);
});

test('wading: a riding scene and a terrain walk flag decide as before', () => {
  const ride = Object.assign(pond(), { ride: 1 });
  assert.equal(walk(ride, 2.5, 2.5), true, 'ride: deep water crossed on the mount');
  assert.equal(walk(ride, 6.5, 2.5), true, 'ride: every water, as v24');
  assert.equal(wadeHere(ride, 1.5, 1.5), false, 'ride: on the mount, not wading');
  assert.equal(wadeDepthAt(ride, 1.5, 1.5), 0);
  const sc = pond();
  assert.equal(walk(sc, 1.5, 1.5, { walk: false }), false, 'a terrain that says no');
  assert.equal(walk(sc, 2.5, 2.5, { walk: true }), true, 'a terrain that says yes');
  assert.equal(walk(sc, 0.5, 0.5, { walk: false }), false);
});

test('wading: depth 0 on land, eased in from the bank, full in open shallows', () => {
  const sc = { w: 9, h: 9, edge: 'g', tiles: ['ggggggggg', ...Array(7).fill('gwwwwwwwg'), 'ggggggggg'] };
  assert.equal(wadeDepthAt(sc, 0.5, 4.5), 0, 'grass');
  assert.equal(wadeDepthAt(sc, 4.5, 4.5), WADE_DEPTH, 'open water');
  /* stepping in from the west bank (x 1): never a jump, always deeper further in */
  let last = 0;
  for (let x = 1.001; x < 2.2; x += 0.05) {
    const d = wadeDepthAt(sc, x, 4.5);
    assert.ok(d >= last - 1e-12 && d - last < 0.05, `x ${x.toFixed(2)}: ${d} after ${last}`);
    last = d;
  }
  assert.ok(wadeDepthAt(sc, 1.01, 4.5) < 0.01, 'at the bank, all but dry');
  assert.equal(wadeDepthAt(sc, 1.7, 4.5), WADE_DEPTH, 'past the ease, full depth');
  /* a corner counts its diagonal tile */
  assert.ok(wadeDepthAt(sc, 1.1, 1.1) < wadeDepthAt(sc, 1.1, 4.5) + 1e-9);
});

test('wading: slower the deeper, never stopped', () => {
  assert.equal(wadeSpeed(0), 1);
  assert.equal(wadeSpeed(WADE_DEPTH), WADE_SLOW);
  assert.equal(wadeSpeed(WADE_DEPTH * 3), WADE_SLOW);
  assert.ok(wadeSpeed(WADE_DEPTH / 2) < 1 && wadeSpeed(WADE_DEPTH / 2) > WADE_SLOW);
  assert.ok(WADE_SLOW > 0.3);
});

test('wading: from the bank into the shallows and back out, never stuck (a walk grid at 4 cells a metre)', () => {
  const sc = pond(),
    N = 4,
    gw = sc.w * N,
    gh = sc.h * N,
    blk = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) blk[j * gw + i] = walk(sc, (i + 0.5) / N, (j + 0.5) / N) ? 0 : 1;
  /* every open cell reaches the bank (a flood from grass at the near edge, 4 directions) */
  const seen = new Uint8Array(gw * gh),
    Q = [0];
  seen[0] = 1;
  while (Q.length) {
    const q = Q.pop(),
      i = q % gw,
      j = (q - i) / gw;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di,
        b = j + dj,
        r = b * gw + a;
      if (a < 0 || b < 0 || a >= gw || b >= gh || blk[r] || seen[r]) continue;
      seen[r] = 1;
      Q.push(r);
    }
  }
  let open = 0,
    wet = 0;
  for (let q = 0; q < gw * gh; q++)
    if (!blk[q]) {
      open++;
      assert.ok(seen[q], `cell ${q} open but cut off`);
      if (wadeHere(sc, ((q % gw) + 0.5) / N, (Math.floor(q / gw) + 0.5) / N)) wet++;
    }
  assert.ok(wet === 9 * N * N, `${wet} wading cells`);
  assert.ok(open < gw * gh, 'deep and lava cells stay shut');
});

test('wading (WA-5a): rapids shut, the marsh and the bog slower, a hot spring waded', () => {
  const kind = k => Object.assign(pond(), { waters: [{ x: 1, z: 1, w: 4, h: 3, k }] });
  assert.equal(walk(kind('rapids'), 1.5, 1.5), false, 'rapids: not waded');
  assert.equal(wadeHere(kind('rapids'), 1.5, 1.5), false);
  assert.equal(walk(kind('hotspring'), 1.5, 1.5), true, 'a hot spring is waded');
  assert.equal(walk(kind('bog'), 1.5, 1.5), true, 'the bog is waded');
  assert.equal(walk(kind('bog'), 2.5, 2.5), false, 'its deep middle is not');
  const pondSpeed = wadeSpeed(WADE_DEPTH, 'pond'),
    marsh = wadeSpeed(WADE_DEPTH, 'swamp'),
    bog = wadeSpeed(WADE_DEPTH, 'bog');
  assert.equal(pondSpeed, WADE_SLOW, 'a pond as before');
  assert.ok(marsh < pondSpeed && bog < marsh && bog > 0.2, `pond ${pondSpeed}, marsh ${marsh}, bog ${bog}`);
  assert.equal(wadeSpeed(0, 'bog'), 1, 'out of the water, no slow');
});
