// Characters track CH-5: the figure kit's shape lists (game/js/logic/kit-shapes.js) and its data
// (game/data/figureKit.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KIT_FRAME_SAMPLE,
  figureKitProblems,
  kitAccessory,
  kitClothesProblems,
  kitExpr,
  kitShapeOf,
  kitValue,
} from '../../game/js/logic/kit-shapes.js';

const KIT = JSON.parse(readFileSync(new URL('../../game/data/figureKit.json', import.meta.url), 'utf8'));
const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));

test('kit shapes: a sum works out exactly as JavaScript would', () => {
  const V = { bx: 0.3417, yb: 0.3561, top: 0.6219, k: 1.0731, girth: 1.17, hipK: 0.94, bz: 0.3311, R: 0.19, a: 2.1 };
  const same = (src, js, vars = V) => assert.equal(kitExpr(src, vars), js, src);
  same('bx * 0.98', V.bx * 0.98);
  same('top - yb + 0.02', V.top - V.yb + 0.02);
  same('(yb + top) / 2', (V.yb + V.top) / 2);
  same('-0.17 * girth * hipK - 0.02', -0.17 * V.girth * V.hipK - 0.02);
  same('0.105 * sqrt(girth)', 0.105 * Math.sqrt(V.girth));
  same('sin(a) * R * 1.08', Math.sin(V.a) * V.R * 1.08);
  same('(i / 6) * pi * 2', (3 / 6) * Math.PI * 2, { ...V, i: 3 });
  same('2 - 3 - 4', -5);
  same('8 / 2 / 2', 2);
  same('--1', 1);
  same('1e-3 * 2', 0.002);
});

test('kit shapes: a sum with anything but arithmetic is refused', () => {
  for (const src of ['alert(1)', 'bx.constructor', 'bx[0]', 'nope * 2', '(1 + 2', '1 +', 'sqrt 2', '1 2', 'bx; top'])
    assert.throws(() => kitExpr(src, { bx: 1, top: 1 }), /figure kit/, src);
});

test('kit shapes: values, lists and objects keep their order; a shape keeps its kind', () => {
  assert.deepEqual(kitValue({ kind: 'torus', c: [0, 'k * 2', 1], r: 'k' }, { k: 3 }), {
    kind: 'torus',
    c: [0, 6, 1],
    r: 3,
  });
  assert.deepEqual(Object.keys(kitValue({ b: 1, a: '2' }, {})), ['b', 'a']);
});

test('kit shapes: the shapes round the head lay out round its frame', () => {
  const V = { ...KIT_FRAME_SAMPLE, zc: 0.02 };
  const dome = kitShapeOf({ kind: 'dome', y: 'yb', h: 0.2, sx: 'bx', sz: 'bz' }, V);
  assert.deepEqual(dome.c, [0, V.yb, 0.02]);
  assert.deepEqual(dome.cut, { front: -0.04, side: -0.04, back: -0.04 });
  const band = kitShapeOf({ kind: 'band', y: 0.3, R: 'bx', th: 0.01 }, V);
  assert.equal(band.kind, 'torus');
  assert.deepEqual(band.R, [V.bx, (V.bx * V.bz) / V.bx]);
  const lathe = kitShapeOf({ kind: 'lathe', y: [0, 0.1], rx: [0, 'bx'] }, V);
  assert.deepEqual(lathe.rz, [0, (V.bx * V.bz) / V.bx]);
  assert.deepEqual(kitShapeOf({ kind: 'disc', y: 0.1, rx: 0.2, rz: 0.3, th: 0.01 }, V).r, [0.2, 0.01, 0.3]);
});

test('kit shapes: sides mirror, repeat counts, vars work out in order, curls make two tubes', () => {
  const got = [];
  kitAccessory(
    (id, parent, at, sh, col) => got.push({ id, parent, at, sh, col }),
    {
      vars: { w: 'k * 2' },
      rows: [
        { id: 'cup', sides: true, shape: { kind: 'ellipsoid', c: ['s * w', 0, 0], r: [1, 1, 1] }, col: 'gear' },
        { id: 'pt', repeat: 3, vars: { a: 'i * 10', b: 'a + 1' }, shape: { kind: 'cone', a: ['b', 0, 0] }, col: 'hat' },
        {
          id: 'curl',
          parent: 'torso',
          at: [0, 'w', 0],
          shape: { kind: 'curls', y: 0, wx: 1, wz: 1, lift: 0, th: 0.1 },
          col: 'hat',
        },
      ],
    },
    { ...KIT_FRAME_SAMPLE, k: 1.5 },
    'head'
  );
  assert.deepEqual(
    got.map(g => g.id),
    ['cupA', 'cupB', 'pt0', 'pt1', 'pt2', 'curlA', 'curlB']
  );
  assert.deepEqual([got[0].sh.c[0], got[1].sh.c[0]], [3, -3]);
  assert.deepEqual(
    got.slice(2, 5).map(g => g.sh.a[0]),
    [1, 11, 21]
  );
  assert.equal(got[5].parent, 'torso');
  assert.deepEqual(got[5].at, [0, 3, 0]);
  assert.notEqual(got[5].at, got[6].at, 'each part its own place');
  assert.equal(got[5].sh.kind, 'tube');
  assert.equal(got[0].parent, 'head');
});

test('kit shapes: the game data has no problems; a broken kit has', () => {
  assert.deepEqual(figureKitProblems(KIT, W.items), []);
  const bad = structuredClone(KIT);
  bad.folk.push('giant');
  bad.hair.hair_mohawk = { steps: [] };
  bad.accessories.hat_cap.rows[0].shape.y = 'yb - nope';
  for (const H of Object.values(bad.heads)) H.random = false;
  const P = figureKitProblems(bad, W.items).join('\n');
  for (const s of ['no build giant', 'hair_mohawk', 'hat_cap', 'none can be picked'])
    assert.ok(P.includes(s), `${s} in:\n${P}`);
  /* people's head shapes and builds are the kit's (person.schema.json no longer lists them) */
  const who = figureKitProblems(KIT, W.items, {
    a: { figure: { head: 'diamond', build: 'lanky' } },
    b: { figure: { head: 'cube', build: 'giant' } },
  });
  assert.deepEqual(who, [
    'people/b.json: figure.head cube is no head shape',
    'people/b.json: figure.build giant is no build',
  ]);
});

test('kit shapes (CH-5b): stages, when, chance, side groups, a side’s part and marks', () => {
  const made = [],
    marks = [],
    add = (id, parent, at) => made.push([id, parent, at[0]]),
    shape = { kind: 'ellipsoid', c: [0, 0, 0], r: [0.1, 0.1, 0.1] },
    G = {
      vars: { w: 'girth * 2' },
      rows: [
        { id: 'early', stage: 'torso', shape, col: 'top' },
        { id: 'bare', when: 'bare', shape, col: 'top' },
        { id: 'covered', when: '!bare', shape, col: 'top' },
        { sides: true, id: 'pouch', parent: 'hips', at: ['s', 0, 0], chance: 0.5, salt: '200 + s', shape, col: 'x' },
        {
          sides: true,
          id: 'track',
          rows: [
            { id: 't', parent: 'thigh$', at: ['s * w', 0, 0], shape, col: 'p' },
            { id: 'u', parent: 'shin$', shape, col: 'p' },
          ],
        },
      ],
      marks: [{ id: 'b', repeat: 2, kind: 'button', part: 'torso', at: [0, 'i', 0], w: 0.02, h: 'w', col: 'button' }],
    };
  const o = {
    stage: 'details',
    rnd: salt => (salt === 201 ? 0.2 : 0.9),
    mark: (kind, part, at, w, h, col) => marks.push([kind, part, at[1], w, h, col]),
  };
  kitAccessory(add, G, { girth: 1, bare: 1 }, 'torso', o);
  assert.deepEqual(made, [
    ['bare', 'torso', 0],
    ['pouchA', 'hips', 1],
    ['tA', 'thighA', 2],
    ['uA', 'shinA', 0],
    ['tB', 'thighB', -2],
    ['uB', 'shinB', 0],
  ]);
  assert.deepEqual(marks, [
    ['button', 'torso', 0, 0.02, 2, 'button'],
    ['button', 'torso', 1, 0.02, 2, 'button'],
  ]);
  made.length = 0;
  kitAccessory(add, G, { girth: 1, bare: 0 }, 'torso', { stage: 'torso' });
  assert.deepEqual(made, [['early', 'torso', 0]], 'only the stage asked for');
  made.length = 0;
  kitAccessory(add, G, { girth: 1, bare: 0 }, 'torso', { stage: 'details' });
  assert.deepEqual(
    made.map(m => m[0]),
    ['covered', 'pouchA', 'pouchB', 'tA', 'uA', 'tB', 'uB'],
    'no dice: every chance row in'
  );
});

test('kit shapes (CH-5b): the clothes’ problems', () => {
  assert.deepEqual(kitClothesProblems(KIT, W.items), []);
  const shape = { kind: 'ellipsoid', c: [0, 'nope', 0], r: [0.1, 0.1, 0.1] };
  const bad = {
    clothes: {
      hat_cap: {},
      ghost: {},
      tee: { use: ['zip'], rows: [{ id: 'x', when: 'sunny', shape: { ...shape, c: [0, 0, 0] }, col: 'top' }] },
      jeans: { rows: [{ id: 'y', shape, col: 'pants' }] },
    },
  };
  const P = kitClothesProblems(bad, W.items).join('\n');
  for (const want of [
    'hat_cap is a hat',
    'ghost is not in the wardrobe',
    'uses no piece zip',
    'when sunny',
    'no value named nope',
  ])
    assert.ok(P.includes(want), want + ' in ' + P);
});
