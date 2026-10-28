// Style track SY-4: case files, the Bureau's events on paper (game/js/logic/case-file.js; events.json bureau, redact,
// form, an option's stamp)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA } from './setup-real.mjs';
import {
  CASE_TYPE_MS,
  caseFile,
  caseForm,
  caseStampMoment,
  caseTyped,
  redactProblem,
  redactSplit,
} from '../../game/js/logic/case-file.js';

const F = GAME_DATA.factions,
  EV = GAME_DATA.events.events,
  LOOK = F.factions.bureau.look;

test('case file: only a Bureau event is one; its form is its own or one of the look’s, the same every time', () => {
  assert.equal(caseFile('ring_light', EV.ring_light, F), null);
  assert.equal(caseFile('x', { bureau: 1 }, { factions: { bureau: {} } }), null, 'a Bureau with no look');
  const c = caseFile('bureau_checkpoint', EV.bureau_checkpoint, F);
  assert.ok(c && LOOK.forms.includes(c.form));
  assert.equal(c.emblem, LOOK.emblem);
  assert.equal(caseFile('bureau_checkpoint', EV.bureau_checkpoint, F).form, c.form);
  assert.equal(caseFile('form_27b', EV.form_27b, F).form, 'Form 27-B', 'the intro names its form');
  assert.equal(caseForm('anything', []), '');
  const got = new Set(Array.from({ length: 60 }, (_, i) => caseForm('event_' + i, LOOK.forms)));
  assert.ok(got.size > 2, 'the forms are spread over the events');
});

test('case file: the result’s stamp: the option’s own, else the last option is denied and any other filed', () => {
  const ev = { options: [{ text: 'a' }, { text: 'b', stamp: 'pending' }, { text: 'c' }] };
  assert.equal(caseStampMoment(ev, 0), 'filed');
  assert.equal(caseStampMoment(ev, 1), 'pending');
  assert.equal(caseStampMoment(ev, 2), 'denied');
  assert.equal(caseStampMoment(EV.pyramid_cart, 1), 'filed', 'reporting the cart is filed though it is last');
  for (const [id, ev] of Object.entries(EV))
    if (ev.bureau)
      ev.options.forEach((_, k) => assert.ok(LOOK.stamps[caseStampMoment(ev, k)], `${id} ${k} has a stamp word`));
});

test('case file: redaction covers whole words only, every time they stand, and leaves the rest as it was', () => {
  const t = 'A tollbooth and a clipboard; tollbooths, not the tollbooth.';
  const s = redactSplit(t, ['tollbooth', 'clipboard']);
  assert.equal(s.map(x => x.t).join(''), t);
  assert.deepEqual(
    s.filter(x => x.r).map(x => x.t),
    ['tollbooth', 'clipboard', 'tollbooth']
  );
  assert.deepEqual(redactSplit('nothing here', ['tollbooth']), [{ t: 'nothing here', r: false }]);
  assert.deepEqual(redactSplit('', undefined), [{ t: '', r: false }]);
  assert.deepEqual(
    redactSplit('a grey cardigan', ['grey cardigan', 'cardigan']).filter(x => x.r),
    [{ t: 'grey cardigan', r: true }],
    'the longer words win, never two bars over one word'
  );
});

test('case file: what may be covered: an intro word, never an option’s, a number or a guarded word', () => {
  const ev = {
    intro: ['A clerk with a clipboard asks for 250 Moneys.', 'Clerk: Pay or leave.'],
    options: [{ text: 'Pay 250' }, { text: 'Leave' }],
  };
  assert.equal(redactProblem(ev, 'clipboard', ['moneys']), '');
  assert.match(redactProblem(ev, '250'), /letters only/);
  assert.match(redactProblem(ev, 'stapler'), /not a word of the intro/);
  assert.match(redactProblem(ev, 'Moneys', ['moneys']), /never covered/);
  assert.match(redactProblem(ev, 'leave'), /the option "Leave"/, 'an option’s word in any case');
  assert.match(redactProblem(ev, 'Pay'), /the option "Pay 250"/);
  assert.match(redactProblem(ev, 'clipboard', ['clipboard']), /never covered/);
  assert.match(redactProblem({ ...ev, intro: ['two pyramids'] }, 'pyramids', ['pyramid']), /never covered/);
  /* the game's own: every Bureau event's words are covered somewhere in its intro */
  for (const [id, ev] of Object.entries(EV))
    for (const w of ev.redact || [])
      assert.ok(
        ev.intro.some(l => redactSplit(l, [w]).some(x => x.r)),
        `${id}: "${w}" is in the intro`
      );
});

test('case file: the typing: 20 ms a letter, never past the end; a tap (Infinity) shows it all', () => {
  assert.equal(CASE_TYPE_MS, 20);
  assert.equal(caseTyped(100, 0), 0);
  assert.equal(caseTyped(100, -5), 0);
  assert.equal(caseTyped(100, 200), 10);
  assert.equal(caseTyped(100, 5000), 100);
  assert.equal(caseTyped(100, Infinity), 100);
  assert.equal(caseTyped(100, NaN), 0);
});
