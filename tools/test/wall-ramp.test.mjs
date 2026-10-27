// Studio art track SA-2b: the walls' and buildings' colour ramp (game/js/logic/wall-ramp.js), as the shaders colour the
// greyscale sheets, the cell and room names against the sheets' sizes, and a flag's ripple.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, modules } from './setup-real.mjs';

const R = modules['wall-ramp'];
const size = f => {
  const b = readFileSync(join(ROOT, 'game/art/scene/build', f));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('the ramp is the shaders’ own: rampW in walk-shaders.js and rampC in buildings.js', () => {
  const ramp = /vec3 ramp[WC]\(vec3 b,float t\)\{(.*?)\}/;
  const walk = readFileSync(join(ROOT, 'game/js/walk/walk-shaders.js'), 'utf8').match(ramp)[1],
    build = readFileSync(join(ROOT, 'game/js/buildings.js'), 'utf8').match(ramp)[1];
  assert.equal(walk, build);
  assert.match(
    walk,
    /d0=mix\(b\*\.55,vec3\(\.235,\.165,\.439\),\.30\),d1=mix\(b\*\.79,vec3\(\.376,\.29,\.596\),\.17\)/
  );
  assert.match(walk, /l3=mix\(b,vec3\(1\.,\.957,\.769\),\.30\),l4=mix\(b,vec3\(1\.,\.988,\.918\),\.60\)/);
  const b = [0.5, 0.4, 0.3];
  assert.deepEqual(R.wallRamp(b, 2), b);
  assert.ok(Math.abs(R.wallRamp(b, 0)[0] - (0.5 * 0.55 * 0.7 + 0.235 * 0.3)) < 1e-9);
  assert.ok(Math.abs(R.wallRamp(b, 4)[2] - (0.3 * 0.4 + 0.918 * 0.6)) < 1e-9);
  assert.deepEqual([0, 64, 128, 191, 255].map(R.wallLevel), [0, 1, 2, 3, 4]);
});

test('the names cover the sheets: 12 wall cells, 24 building cells, 8 rooms of 4 faces', () => {
  const [ww, wh] = size('walls.png'),
    [bw, bh] = size('detail-a04b.png'),
    [rw, rh] = size('rooms.png');
  assert.equal((ww / 64) * (wh / 64), R.WALL_CELL_NAMES.length);
  assert.equal((bw / 64) * (bh / 64), R.BUILD_CELL_NAMES.length);
  assert.equal(rw / 32, R.ROOM_FACES.length);
  assert.equal(rh / 32, R.ROOM_NAMES.length);
});

test('a cell coloured; pixels between levels counted', () => {
  const sheet = new Uint8ClampedArray([0, 0, 0, 255, 128, 0, 0, 255, 255, 0, 0, 255, 100, 0, 0, 255]);
  const out = R.wallCellColoured(sheet, 2, [0, 0, 2, 2], [0.5, 0.5, 0.5]);
  assert.deepEqual([...out.slice(4, 8)], [128, 128, 128, 255]);
  assert.equal(R.wallOffLevels(sheet, 2, [0, 0, 2, 2]), 1);
});

test('a flag ripples more toward its free end and in more wind', () => {
  const at = (u, lean) => Math.max(...[0, 50, 100, 150, 200].map(t => Math.abs(R.flagRipple(u, t, lean).up)));
  assert.equal(R.flagRipple(0, 123, 0.4).up, 0);
  assert.ok(at(1, 0.4) > at(0.5, 0.4));
  assert.ok(at(1, 0.8) > at(1, 0.1));
});
