// Studio plan Phase 5: the PNG writer (tools/bake-kit-billies.mjs writes the kit sheets with it) reads back as written.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { encodePng, readPng } from './png.mjs';

test('an RGBA picture written as PNG reads back byte for byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pb-png-'));
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) & 255;
  for (const [width, height] of [
    [1, 1],
    [5, 3],
    [64, 40],
  ]) {
    const data = new Uint8ClampedArray(width * height * 4);
    /* runs and noise, so every filter gets picked somewhere */
    for (let i = 0; i < data.length; i++) data[i] = i % 7 < 3 ? (i >> 4) & 255 : rnd();
    const file = join(dir, `${width}x${height}.png`);
    writeFileSync(file, encodePng({ width, height, data }));
    const back = readPng(file);
    assert.equal(back.width, width);
    assert.equal(back.height, height);
    assert.deepEqual([...back.data], [...data]);
  }
});
