// Characters track CH-3b: the figure kit (game/js/logic/figure-kit.js): every person in the game data and townsfolk
// built as figures from their looks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  FIGURE_BUILDS,
  FIGURE_HEADS,
  KIT_RANDOM_HEADS,
  figureSeed,
  figureShapeFor,
  kappiFigure,
  kitHex,
  lookFigure,
} from '../../game/js/logic/figure-kit.js';
import {
  figureGpuMesh,
  shapeSurface,
  FIGURE_PAL_MAX,
  figureFaceMarks,
  figureMesh,
  figurePose,
  jointMatrices,
  cardSize,
} from '../../game/js/logic/figure-pose.js';

const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));
const PEOPLE = Object.fromEntries(
  readdirSync(new URL('../../game/data/people/', import.meta.url))
    .filter(f => f.endsWith('.json'))
    .map(f => [
      f.slice(0, -5),
      JSON.parse(readFileSync(new URL(`../../game/data/people/${f}`, import.meta.url), 'utf8')),
    ])
);
const ids = slot => Object.keys(W.items).filter(k => W.items[k].slot === slot);

test('figure kit: every person in the game data makes a figure that bakes', () => {
  for (const [who, p] of Object.entries(PEOPLE)) {
    const F = p.creature ? kappiFigure({ name: who }) : lookFigure(p.look, W.items, { name: who, figure: p.figure }),
      M = figureMesh(F);
    assert.ok(M.count > 1000, `${who}: ${M.count} vertices`);
    assert.ok(M.colours.length <= FIGURE_PAL_MAX, `${who}: ${M.colours.length} colours`);
    for (const k of M.colours) assert.ok(Array.isArray(F.colours[k]), `${who}: colour ${k}`);
    for (const m of F.face) assert.ok(F.colours[m.col || m.kind], `${who}: the ${m.kind} mark's colour`);
    assert.ok(F.height > 0.6 && F.height < 2.4, `${who}: ${F.height} m`);
    /* every clip poses and every part's matrix is finite */
    for (const clip of ['idle', 'walk', 'cheer', 'throw', 'sit'])
      for (const v of jointMatrices(F, figurePose(F, clip, 3), 32)) assert.ok(Number.isFinite(v), `${who} ${clip}`);
  }
});

test('figure kit: every wardrobe item in every slot builds', () => {
  const base = PEOPLE.chosen.look;
  for (const slot of [
    'hair',
    'eyes',
    'brows',
    'mouth',
    'facial',
    'top',
    'outer',
    'bottom',
    'shoes',
    'hat',
    'glasses',
    'neck',
    'bag',
  ])
    for (const id of ids(slot)) {
      const F = lookFigure({ ...base, wear: { ...base.wear, [slot]: id } }, W.items, { name: id }),
        M = figureMesh(F);
      assert.ok(M.colours.length <= FIGURE_PAL_MAX, `${id}: ${M.colours.length} colours`);
    }
});

test('figure kit: the face faces the camera and blinks; glasses frame the eyes', () => {
  const look = { ...PEOPLE.chosen.look, wear: { ...PEOPLE.chosen.look.wear, glasses: 'glasses_round' } },
    F = lookFigure(look, W.items, { name: 'chosen' }),
    S = cardSize(48, 0.45, 1.9),
    marks = (frame, rel) => {
      const P = figurePose(F, 'idle', frame);
      return figureFaceMarks(F, jointMatrices(F, P, 48), P, { rel, tilt: 0.45 }, 48, S);
    };
  const front = marks(0, Math.PI),
    eyes = front.filter(m => m.kind === 'eye');
  /* at 48 px a metre: each eye's lid (a line: almond eyes under a heavy lid, not big chibi ones), white, iris, pupil
     and a shine; glasses' frames and a shine on each lens */
  assert.equal(eyes.length, 2);
  assert.ok(
    eyes.every(e => e.w >= 3 && e.w <= 6 && e.h >= 1),
    JSON.stringify(eyes)
  );
  for (const k of ['white', 'iris', 'pupil']) assert.equal(front.filter(m => m.kind === k).length, 2, k);
  assert.ok(front.filter(m => m.kind === 'iris').every(m => m.w >= 2));
  assert.equal(front.filter(m => m.kind === 'shine').length, 4);
  /* a close-up's own marks (the lid's crease, the lower lid) stay off at walking size */
  assert.equal(front.filter(m => m.kind === 'crease' || m.kind === 'under').length, 0);
  assert.equal(front.filter(m => m.kind === 'glasses' && m.hollow).length, 2);
  /* the back of the head shows no face */
  assert.equal(marks(0, 0).filter(m => m.part !== 'torso').length, 0);
  /* a blink: the lids are lines; no white, iris, pupil or eye shine */
  const blink = marks(14, Math.PI);
  assert.ok(blink.filter(m => m.kind === 'eye').every(e => e.h === 1 && !e.shape));
  assert.ok(!blink.some(m => ['white', 'iris', 'pupil'].includes(m.kind)));
  assert.equal(blink.filter(m => m.kind === 'shine').length, 2, 'only the lenses shine');
});

test('figure kit: shapes, builds and heights vary; a person’s choice wins', () => {
  const look = PEOPLE.chosen.look;
  assert.deepEqual(figureShapeFor(look, 1, { head: 'square', build: 'round' }), { head: 'square', build: 'round' });
  /* the sliders lean the build */
  assert.equal(figureShapeFor({ body: { body: 1.25 } }, 1).build, 'round');
  assert.equal(figureShapeFor({ body: { height: 1.08 } }, 1).build, 'tall');
  /* over many townsfolk seeds every head shape turns up */
  const heads = new Set();
  for (let s = 0; s < 200; s++) heads.add(figureShapeFor(look, figureSeed('folk:' + s)).head);
  /* townsfolk (variety) take every build; anyone else their sliders' (an average look stays average) */
  const builds = new Set();
  for (let s = 0; s < 200; s++) builds.add(figureShapeFor({}, figureSeed('folk:' + s), { variety: true }).build);
  assert.equal(builds.size, 8, [...builds].join());
  assert.equal(figureShapeFor({}, 12345).build, 'average');
  assert.deepEqual([...heads].sort(), [...KIT_RANDOM_HEADS].sort());
  assert.ok(!heads.has('hero'), 'the main character’s head is never picked at random');
  assert.ok(FIGURE_HEADS.hero);
  /* a tall build stands taller than a small one, a round one is wider */
  const by = build => lookFigure(look, W.items, { name: 'x', figure: { build, head: 'round' } }),
    width = F => {
      const t = F.parts.find(p => p.id === 'torso').shape;
      return Math.max(...t.rx);
    };
  assert.ok(by('tall').height > by('small').height + 0.25, `${by('tall').height} ${by('small').height}`);
  assert.ok(width(by('round')) > width(by('slim')) * 1.4);
  assert.deepEqual(Object.keys(FIGURE_BUILDS), [
    'average',
    'slim',
    'stocky',
    'round',
    'tall',
    'small',
    'athletic',
    'pear',
    'lanky',
    'elder',
  ]);
  /* each build moves its own way */
  assert.ok(by('round').gait.swing < by('tall').gait.swing);
});

test('figure kit: Kappi stands on four legs in glasses', () => {
  const F = kappiFigure();
  for (const id of ['legFL', 'legFR', 'legBL', 'legBR']) assert.ok(F.parts.some(p => p.id === id));
  assert.ok(F.face.some(m => m.kind === 'glasses' && m.hollow));
  const P = figurePose(F, 'walk', 2);
  assert.ok(Math.abs(P.rot[F.parts.findIndex(p => p.id === 'legFL')][0]) > 0.3);
});

test('figure kit: colours from hex', () => {
  assert.deepEqual(kitHex('#C05A15', [0, 0, 0]), [192, 90, 21]);
  assert.deepEqual(kitHex('#abc', [0, 0, 0]), [170, 187, 204]);
  assert.deepEqual(kitHex('nope', [1, 2, 3]), [1, 2, 3]);
});

test('figure kit: the GPU mesh: a matrix only for moving parts (at most 32), every vertex where the full mesh has it', () => {
  const apply = (M, p) => [0, 1, 2].map(r => M[r] * p[0] + M[4 + r] * p[1] + M[8 + r] * p[2] + M[12 + r]);
  for (const who of ['chosen', 'vault', 'kappi']) {
    const p = PEOPLE[who],
      F = p.creature
        ? kappiFigure({ name: who })
        : lookFigure(p.look, W.items, {
            name: who,
            figure: p.figure,
            flair: { hair: 1.3, detail: true, goggles: true, scarf: true },
          }),
      P = figurePose(F, 'walk', 3),
      J = jointMatrices(F, P, 0),
      A = figureMesh(F),
      B = figureGpuMesh(F);
    assert.ok(F.parts.length > 32 || who === 'kappi', `${who}: ${F.parts.length} parts`);
    assert.ok(B.slots.length <= 32, `${who}: ${B.slots.length} matrices`);
    for (let v = 0; v < A.count; v += 37) {
      const a = apply(J.subarray(A.data[v * 8 + 6] * 16), [A.data[v * 8], A.data[v * 8 + 1], A.data[v * 8 + 2]]),
        s = B.slots[B.data[v * 8 + 6]],
        b = apply(J.subarray(s * 16), [B.data[v * 8], B.data[v * 8 + 1], B.data[v * 8 + 2]]);
      assert.ok(
        a.every((x, i) => Math.abs(x - b[i]) < 1e-5),
        `${who} vertex ${v}`
      );
    }
  }
});

test('figure kit: under a hat no lock of hair comes out through its crown (every hat, every hair style)', () => {
  const base = PEOPLE.chosen.look;
  for (const hat of ids('hat'))
    for (const hair of ids('hair')) {
      const F = lookFigure({ ...base, wear: { ...base.wear, hat, hair } }, W.items, { name: hat + hair }),
        H = F.parts.find(p => p.id === 'head').shape,
        band = H.c[1] + H.r[1] * 0.18,
        zc = H.c[2] - H.r[2] * 0.06;
      for (const p of F.parts.filter(q => /^(lock|curl)\d/.test(q.id)))
        for (const v of shapeSurface(p.shape).pts) {
          if (v[1] <= band + 0.005) continue;
          const e = (v[0] / (H.r[0] * 1.1)) ** 2 + ((v[2] - zc) / (H.r[2] * 1.14)) ** 2;
          assert.ok(e < 1.02, `${hat} ${hair} ${p.id}: ${v.map(x => x.toFixed(3))} (${e.toFixed(2)})`);
        }
    }
});
