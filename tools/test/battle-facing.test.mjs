// Water track WA-7: a battle turns so the scene's water lies behind it (game/js/logic/battle-facing.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battleTurnPoint, battleWaterFacing } from '../../game/js/logic/battle-facing.js';

/* battle-stage.js's single format: you, them, the camera at the origin; the middle of the action between you two */
const c = { x: 0.42, z: 4.15 },
  spots = [
    { x: -0.88, z: 2.6 },
    { x: 1.72, z: 5.7 },
    { x: 0, z: 0 },
  ],
  off = [30 - c.x, 30 - c.z]; /* the middle of the action at (30, 30) in a 60 m square scene */
/* a lake: every tile middle in the box [x0, x1) x [z0, z1) */
const lake = (x0, x1, z0, z1) => {
  const out = [];
  for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) out.push([x + 0.5, z + 0.5]);
  return out;
};
const facing = water => battleWaterFacing({ water, w: 60, h: 60, c, off, spots });

test('a battle turns its forward to the scene: north stays north, east is a quarter turn', () => {
  const n = battleTurnPoint(c.x, c.z + 10, 0, c, off),
    e = battleTurnPoint(c.x, c.z + 10, Math.PI / 2, c, off);
  assert.deepEqual(
    n.map(v => +v.toFixed(6)),
    [30, 40]
  );
  assert.deepEqual(
    e.map(v => +v.toFixed(6)),
    [40, 30]
  );
});

test('no water, water already in front, or water too far: the battle faces north', () => {
  assert.equal(facing([]), 0);
  assert.equal(facing(lake(24, 36, 42, 54)), 0);
  assert.equal(facing(lake(0, 4, 0, 4)), 0);
});

test('a lake to the east turns the battle a quarter turn; one to the south-west turns it that way (within a sixteenth)', () => {
  assert.equal(facing(lake(38, 52, 22, 38)), Math.PI / 2);
  /* the camera stands 4 m behind the middle and nearer water counts more, so the best view of a lake off the axes is
     not quite its bearing from the middle (-3/8 of a turn) */
  const sw = facing(lake(12, 24, 12, 24));
  assert.ok(Math.abs(sw + (3 * Math.PI) / 4) <= Math.PI / 8 + 1e-9, `turned ${sw}`);
});

test('never a turn that puts a fighter or the camera in the water', () => {
  /* a lake to the east that starts 2 m from the middle: facing it puts the other side in it */
  const yaw = facing(lake(32, 50, 20, 40));
  for (const q of spots) {
    const [x, z] = battleTurnPoint(q.x, q.z, yaw, c, off);
    assert.ok(!(x >= 32 && x < 50 && z >= 20 && z < 40), `someone stands in the water at ${x}, ${z} (yaw ${yaw})`);
  }
});

test('never a turn that puts someone off the map', () => {
  /* the middle 3 m from the east edge, water beyond it along the edge north and south: an east facing would put the
     camera or the other side outside */
  const o = { water: lake(55, 58, 0, 60), w: 58, h: 60, c, off: [55 - c.x, 30 - c.z], spots };
  const yaw = battleWaterFacing(o);
  for (const q of spots) {
    const [x, z] = battleTurnPoint(q.x, q.z, yaw, c, o.off);
    assert.ok(x > 0.5 && x < 57.5 && z > 0.5 && z < 59.5, `off the map at ${x}, ${z} (yaw ${yaw})`);
  }
});

test('water behind a row of trees does not turn the battle', () => {
  const water = lake(38, 52, 22, 38),
    trees = [];
  for (let z = 18; z < 42; z += 1.5) trees.push([35, z, 0.8]);
  assert.equal(battleWaterFacing({ water, w: 60, h: 60, c, off, spots, blockers: trees }), 0);
  /* trees right beside the fighters are hidden in a battle: they don't count */
  assert.equal(battleWaterFacing({ water, w: 60, h: 60, c, off, spots, blockers: [[31.5, 30, 0.8]] }), Math.PI / 2);
});
