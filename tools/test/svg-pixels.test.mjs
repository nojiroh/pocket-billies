// Studio art track SA-2b: the UI icons' pixel SVG (game/js/logic/svg-pixels.js): every icon in game/art/ui turns into
// its pixels and back into the very same text, so the Studio can paint an icon and write it as the builder did.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ROOT, modules } from './setup-real.mjs';

const S = modules['svg-pixels'];
const UI = join(ROOT, 'game/art/ui');
const icons = readdirSync(UI).filter(f => f.endsWith('.svg'));

test('every icon round-trips through its pixels to the same text, byte for byte', () => {
  assert.ok(icons.length >= 51);
  for (const f of icons) {
    const text = readFileSync(join(UI, f), 'utf8'),
      px = S.svgToPixels(text);
    assert.ok(!px.error, `${f}: ${px.error}`);
    assert.equal(px.w, 36, f);
    assert.equal(S.pixelsToSvg(px.data, px.w, px.h), text, f);
  }
});

test('pixels make sorted one-colour paths of runs; see-through pixels are left out', () => {
  const d = new Uint8ClampedArray(3 * 2 * 4);
  const put = (i, r, g, b, a = 255) => d.set([r, g, b, a], i * 4);
  put(0, 255, 0, 0);
  put(1, 255, 0, 0);
  put(2, 0, 0, 255);
  put(3, 9, 9, 9, 100);
  put(4, 0, 0, 255);
  assert.equal(
    S.pixelsToSvg(d, 3, 2),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" shape-rendering="crispEdges"><path d="M2 0h1v1h-1zM1 1h1v1h-1z" fill="#0000FF"/><path d="M0 0h2v1h-2z" fill="#FF0000"/></svg>\n'
  );
  const back = S.svgToPixels(S.pixelsToSvg(d, 3, 2));
  assert.deepEqual([...back.data.slice(12, 16)], [0, 0, 0, 0]);
  assert.deepEqual([...back.data.slice(0, 4)], [255, 0, 0, 255]);
});

test('an SVG drawn another way is refused with a reason', () => {
  const head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4" shape-rendering="crispEdges">';
  for (const bad of [
    '<svg viewBox="0 0 4 4"><circle r="2"/></svg>',
    head + '<circle r="2"/></svg>',
    head + '<path d="M0 0h2v1h-2z M1 1h1v1h-1z" fill="#FF0000"/></svg>',
    head + '<path d="M3 0h2v1h-2z" fill="#FF0000"/></svg>',
    head + '<path d="M0 0h2v1h-3z" fill="#FF0000"/></svg>',
    head + '<path d="M0 0h1v1h-1z" fill="red"/></svg>',
    head + '</svg><script/>',
  ])
    assert.ok(S.svgToPixels(bad).error, bad);
  assert.ok(!S.svgToPixels(head + '</svg>\n').error);
});

test('svgProblem: any drawing in the 36 x 36 box, nothing that runs or loads', () => {
  const ok =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle cx="18" cy="18" r="9" fill="#C8492F"/></svg>\n';
  assert.equal(S.svgProblem(ok), '');
  for (const f of icons) assert.equal(S.svgProblem(readFileSync(join(UI, f), 'utf8')), '', f);
  for (const bad of [
    'hello',
    ok.replace('0 0 36 36', '0 0 24 24'),
    ok.replace('<circle', '<script>alert(1)</script><circle'),
    ok.replace('<circle', '<circle onclick="x()"'),
    ok.replace('<circle', '<a href="https://x"><circle').replace('</svg>', '</a></svg>'),
    ok.replace('fill="#C8492F"', 'fill="url(https://x/y)"'),
    ok.replace('<circle', '<image href="x.png"/><circle'),
  ])
    assert.ok(S.svgProblem(bad), bad);
});

test('PK-2: an icon’s key and path, in art/ui and the Perks’, items’ and boons’ folders', () => {
  assert.equal(S.svgIconKey('art/ui/bag.svg'), 'bag');
  assert.equal(S.svgIconKey('art/ui/sound-off.svg'), 'sound-off');
  assert.equal(S.svgIconKey('art/perks/lucky_charm.svg'), 'perks/lucky_charm');
  assert.equal(S.svgIconKey('art/boons/fired_up.svg'), 'boons/fired_up');
  for (const p of ['art/scene/x.svg', 'art/perks/a/b.svg', 'art/perks/x.png', 'perks/x.svg', ''])
    assert.equal(S.svgIconKey(p), '', p);
  for (const k of ['bag', 'perks/lucky_charm', 'items/potion']) assert.equal(S.svgIconKey(S.svgIconPath(k)), k);
});
