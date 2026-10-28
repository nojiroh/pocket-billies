// Characters track CH-3b: the figure kit (game/js/logic/figure-kit.js): every person in the game data and townsfolk
// built as figures from their looks
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  FIGURE_BUILDS,
  FIGURE_HEADS,
  figureSeed,
  figureShapeFor,
  kappiFigure,
  kitHex,
  lookFigure,
} from '../../game/js/logic/figure-kit.js';
import {
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
    S = cardSize(32, 0.45, 1.9),
    marks = (frame, rel) => {
      const P = figurePose(F, 'idle', frame);
      return figureFaceMarks(F, jointMatrices(F, P, 32), P, { rel, tilt: 0.45 }, 32, S);
    };
  const front = marks(0, Math.PI),
    eyes = front.filter(m => m.kind === 'eye');
  assert.equal(eyes.length, 2);
  assert.ok(
    eyes.every(e => e.w >= 2 && e.h >= 2),
    JSON.stringify(eyes)
  );
  assert.equal(front.filter(m => m.kind === 'glasses' && m.hollow).length, 2);
  assert.ok(front.some(m => m.kind === 'iris'));
  /* the back of the head shows no face */
  assert.equal(marks(0, 0).length, 0);
  /* a blink: the eyes are lines, no iris */
  const blink = marks(14, Math.PI);
  assert.ok(blink.filter(m => m.kind === 'eye').every(e => e.h === 1));
  assert.ok(!blink.some(m => m.kind === 'iris'));
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
  assert.deepEqual([...heads].sort(), Object.keys(FIGURE_HEADS).sort());
  /* a tall build stands taller than a small one, a round one is wider */
  const by = build => lookFigure(look, W.items, { name: 'x', figure: { build, head: 'round' } }),
    width = F => {
      const t = F.parts.find(p => p.id === 'torso').shape;
      return Math.max(...t.rx);
    };
  assert.ok(by('tall').height > by('small').height + 0.2, `${by('tall').height} ${by('small').height}`);
  assert.ok(width(by('round')) > width(by('slim')) * 1.4);
  assert.deepEqual(Object.keys(FIGURE_BUILDS), ['average', 'slim', 'stocky', 'round', 'tall', 'small']);
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
