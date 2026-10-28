// Characters track CH-6: the figures' faces (game/data/figureKit.json faces; logic/figure-kit.js kitFaceMarks,
// kitFaceStyles; logic/kit-shapes.js kitFaceProblems)
import './figure-kit-data.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { figureKitData, kitFaceStyles } from '../../game/js/logic/figure-kit.js';
import { kitFaceProblems } from '../../game/js/logic/kit-shapes.js';

const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));
const ids = slot => Object.keys(W.items).filter(k => W.items[k].slot === slot);

test('faces: every wardrobe eyes, brows and mouth id draws a style of the kit', () => {
  const FC = figureKitData().faces;
  for (const id of ids('eyes')) assert.ok(FC.eyes[FC.wardrobe[id]], id);
  for (const id of ids('brows')) assert.ok(FC.brows[FC.wardrobe[id]], id);
  for (const id of ids('mouth')) assert.ok(FC.mouths[FC.wardrobe[id]], id);
  assert.deepEqual(kitFaceProblems(figureKitData(), W.items), []);
});

test('faces: a look picks its styles and resting mood; unknown ids take the defaults', () => {
  const FC = figureKitData().faces;
  assert.deepEqual(kitFaceStyles({ eyes: 'eyes_sleepy', brows: 'brows_stern', mouth: 'mouth_grin' }, FC), {
    eyes: 'hooded',
    brows: 'angled',
    mouth: 'grin',
    mood: 'cross',
  });
  assert.deepEqual(kitFaceStyles({ mouth: 'mouth_open', brows: 'brows_arched' }, FC).mood, 'glad');
  assert.deepEqual(kitFaceStyles({ brows: 'brows_arched' }, FC).mood, 'worried');
  const none = kitFaceStyles({ eyes: 'eyes_nope' }, FC);
  assert.equal(none.eyes, FC.defaults.eyes);
  assert.equal(none.brows, null, 'no brows worn, none drawn');
  assert.equal(none.mouth, FC.defaults.mouth);
  assert.equal(none.mood, 'calm');
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
