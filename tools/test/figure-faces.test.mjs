// Characters track CH-6: the figures' faces (game/data/figureKit.json faces; logic/figure-kit.js kitFaceMarks,
// kitFaceStyles; logic/kit-shapes.js kitFaceProblems)
import './figure-kit-data.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { figureKitData, kitFaceStyles, lookFigure } from '../../game/js/logic/figure-kit.js';
import {
  cardSize,
  figureFaceMarks,
  figureFaceState,
  figurePose,
  jointMatrices,
} from '../../game/js/logic/figure-pose.js';
import { kitFaceProblems } from '../../game/js/logic/kit-shapes.js';

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

test('faces: every wardrobe eyes, brows and mouth id draws a style of the kit', () => {
  const FC = figureKitData().faces;
  for (const id of ids('eyes')) assert.ok(FC.eyes[FC.wardrobe[id]], id);
  for (const id of ids('brows')) assert.ok(FC.brows[FC.wardrobe[id]], id);
  for (const id of ids('mouth')) assert.ok(FC.mouths[FC.wardrobe[id]], id);
  assert.deepEqual(kitFaceProblems(figureKitData(), W.items), []);
});

test('faces: a look picks its styles and resting mood; a person picks any kit style; unknown ids take the defaults', () => {
  const FC = figureKitData().faces;
  assert.deepEqual(kitFaceStyles({ eyes: 'eyes_sleepy', brows: 'brows_stern', mouth: 'mouth_grin' }, FC), {
    eyes: 'hooded',
    brows: 'angled',
    mouth: 'grin',
    mood: 'glad',
  });
  assert.equal(kitFaceStyles({ brows: 'brows_arched' }, FC).mood, 'calm');
  assert.deepEqual(kitFaceStyles({ eyes: 'eyes_round', brows: 'brows_soft' }, FC, { eyes: 'weary', brows: 'knit' }), {
    eyes: 'weary',
    brows: 'knit',
    mouth: FC.defaults.mouth,
    mood: 'calm',
  });
  assert.equal(kitFaceStyles({ eyes: 'eyes_round' }, FC, { eyes: 'nope' }).eyes, 'round');
  const none = kitFaceStyles({ eyes: 'eyes_nope' }, FC);
  assert.equal(none.eyes, FC.defaults.eyes);
  assert.equal(none.brows, null, 'no brows worn, none drawn');
  assert.equal(none.mouth, FC.defaults.mouth);
  assert.equal(none.mood, 'calm');
});

test('faces: the portrait kit has 13 eye and 12 brow styles; every one paints at walking size and in a close-up', () => {
  const FC = figureKitData().faces,
    PK = JSON.parse(readFileSync(new URL('../../game/data/portraits.json', import.meta.url), 'utf8')),
    kitBrows = Object.keys(PK.items)
      .filter(k => PK.items[k].slot === 'brows')
      .map(k => k.replace(/^brows_/, ''));
  assert.deepEqual(Object.keys(FC.eyes).sort(), Object.keys(PK.eyes).sort());
  assert.deepEqual(Object.keys(FC.brows).sort(), kitBrows.sort());
  const look = { ...PEOPLE.chosen.look, wear: { ...PEOPLE.chosen.look.wear, brows: 'brows_soft' } };
  const paint = (figure, ppm) => {
    const F = lookFigure(look, W.items, { name: 'chosen', figure }),
      S = cardSize(ppm, 0.45, 1.9),
      P = figurePose(F, 'idle', 0);
    return figureFaceMarks(F, jointMatrices(F, P, ppm), P, { rel: Math.PI, tilt: 0.45 }, ppm, S);
  };
  const seen = new Set();
  for (const eyes of Object.keys(FC.eyes))
    for (const ppm of [32, 48, 96]) {
      const m = paint({ eyes }, ppm);
      assert.equal(m.filter(x => x.kind === 'eye').length, 2, `${eyes} at ${ppm}`);
      assert.equal(m.filter(x => x.kind === 'iris').length, 2, `${eyes} at ${ppm}`);
      if (ppm === 96) seen.add(JSON.stringify(m.filter(x => x.kind !== 'brow' && x.kind !== 'mouth')));
    }
  assert.equal(seen.size, Object.keys(FC.eyes).length, 'each eye style looks its own in a close-up');
  seen.clear();
  for (const brows of Object.keys(FC.brows))
    for (const ppm of [32, 48, 96]) {
      const m = paint({ brows }, ppm).filter(x => x.kind === 'brow');
      assert.ok(m.length >= 2, `${brows} at ${ppm}`);
      if (ppm === 96) seen.add(JSON.stringify(m));
    }
  assert.equal(seen.size, Object.keys(FC.brows).length, 'each brow style looks its own in a close-up');
});

test('faces: a broken faces section has problems', () => {
  const bad = structuredClone(figureKitData());
  bad.faces.wardrobe.eyes_round = 'nope';
  bad.faces.wardrobe.hat_cap = 'round';
  bad.faces.defaults.mouth = 'yawn';
  bad.faces.rest.push({ brows: ['brows_none'], mood: 'giddy' });
  const P = kitFaceProblems(bad, W.items).join('\n');
  for (const s of ['eyes_round draws nope', 'hat_cap is no eyes', 'no mouth yawn', 'no mood giddy', 'brows_none'])
    assert.ok(P.includes(s), `${s} in:\n${P}`);
});

test('faces: a face state shows its expression, talking frames and a blink; the rest has no key', () => {
  const F = lookFigure(PEOPLE.broker.look, W.items, { name: 'broker' }),
    FC = figureKitData().faces;
  const rest = figureFaceState(F);
  assert.equal(rest.key, '');
  assert.ok(rest.when.has('eyes:open') && rest.when.has('brows:idle') && rest.when.has('mouth:' + F.faceSet.mouth));
  const happy = figureFaceState(F, { expr: 'happy' });
  assert.ok(happy.when.has('eyes:happy') && happy.when.has('mouth:smile') && happy.when.has('blush'));
  /* talking runs through the expression's own frames, else the kit's */
  assert.deepEqual(
    [0, 1, 2, 3].map(i => [...figureFaceState(F, { expr: 'happy', talk: i }).when].find(w => w.startsWith('mouth:'))),
    ['mouth:smile', 'mouth:talk_b', 'mouth:talk_c', 'mouth:smile']
  );
  assert.ok(figureFaceState(F, { talk: 1 }).when.has('mouth:' + FC.talk[1]));
  /* a blink half shuts then shuts open eyes; happy eyes don't blink */
  assert.ok(figureFaceState(F, { blink: 1 }).when.has('eyes:half'));
  assert.ok(figureFaceState(F, { blink: 2 }).when.has('eyes:closed'));
  assert.ok(figureFaceState(F, { expr: 'happy', blink: 2 }).when.has('eyes:happy'));
  /* an unknown tag is the rest */
  assert.equal(figureFaceState(F, { expr: 'giddy' }).key, '');
});

test('faces: every expression and mouth frame paints its own marks; only the state’s show', () => {
  const F = lookFigure(PEOPLE.broker.look, W.items, { name: 'broker' }),
    FC = figureKitData().faces,
    ppm = 96,
    S = cardSize(ppm, 0.45, 1.9),
    P = figurePose(F, 'idle', 0),
    J = jointMatrices(F, P, ppm),
    paint = o => JSON.stringify(figureFaceMarks(F, J, P, { rel: Math.PI, tilt: 0.45 }, ppm, S, figureFaceState(F, o)));
  const seen = new Set(Object.keys(FC.expressions).map(expr => paint({ expr })));
  assert.equal(seen.size, Object.keys(FC.expressions).length, 'each expression looks its own');
  const mouths = new Set(Object.keys(FC.mouths).map((_, i) => paint({ talk: i, expr: 'x' })));
  assert.ok(mouths.size >= FC.talk.length);
  /* the rest is a pose's own blink-free face; one eye frame at a time */
  const m = figureFaceMarks(F, J, P, { rel: Math.PI, tilt: 0.45 }, ppm, S);
  assert.equal(m.filter(x => x.kind === 'eye').length, 2);
  assert.equal(m.filter(x => x.kind === 'mouth').length, 1);
});

test('faces: every expression tag a line uses in the game data is one of the kit', () => {
  const FC = figureKitData().faces,
    used = new Set(),
    walk = d => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        const p = `${d}/${f.name}`;
        if (f.isDirectory()) {
          if (f.name !== 'legacy' && f.name !== 'schema') walk(p);
        } else if (f.name.endsWith('.json'))
          for (const m of readFileSync(p, 'utf8').matchAll(/"\[(\w+)\]\s/g)) used.add(m[1]);
      }
    };
  walk(new URL('../../game/data', import.meta.url).pathname);
  assert.ok(used.size > 0);
  for (const tag of used) assert.ok(FC.expressions[tag], `[${tag}] has no expression in figureKit.json faces`);
});
