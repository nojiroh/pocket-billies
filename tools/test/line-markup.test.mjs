// Dialogue track DL-1: the bracket tags in a spoken line (game/js/logic/line-markup.js): what each tag reads as, the
// leading expression and styles, the plain text the box types, and the errors the Studio's script box shows.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MARKUP_PAUSE,
  MARKUP_PAUSE_MAX,
  MARKUP_TAGS,
  OPTION_TAGS,
  leadingExpr,
  markupProblem,
  parseLine,
  plainOf,
} from '../../game/js/logic/line-markup.js';
import { parseScript, scriptReference } from '../../game/js/logic/script-parse.js';

test('a plain line is itself, with nothing on it', () => {
  const P = parseLine('Hello there.');
  assert.deepEqual(P, { plain: 'Hello there.', expr: null, style: [], runs: [], events: [], errors: [] });
  assert.equal(plainOf('Hello there.'), 'Hello there.');
  assert.equal(plainOf(''), '');
});

test('the leading expression and styles, in either order; a second word stays in the text', () => {
  assert.deepEqual(leadingExpr('[happy] Chosen: hi'), { expr: 'happy', style: [], rest: 'Chosen: hi' });
  assert.deepEqual(leadingExpr('[happy][shout] Hi'), { expr: 'happy', style: ['shout'], rest: 'Hi' });
  assert.deepEqual(leadingExpr('[shout] [happy] Hi'), { expr: 'happy', style: ['shout'], rest: 'Hi' });
  assert.deepEqual(leadingExpr('[wait][whisper] Psst'), { expr: null, style: ['wait', 'whisper'], rest: 'Psst' });
  assert.deepEqual(leadingExpr('[b]Bold[/b] start'), { expr: null, style: [], rest: '[b]Bold[/b] start' });
  assert.equal(leadingExpr('[happy][sad] x').rest, '[sad] x');
  assert.equal(leadingExpr('[very-happy] x').expr, 'very-happy', 'a dash in an expression, as scripts allowed');
  assert.equal(leadingExpr('No tag').expr, null);
});

test('no wrap or point tag is read as an expression, and no style tag is a wrap or point tag', () => {
  for (const [t, d] of Object.entries(MARKUP_TAGS)) {
    if (d.kind === 'style') assert.deepEqual(leadingExpr(`[${t}] x`).style, [t]);
    else assert.equal(leadingExpr(`[${t}] x`).expr, null, t);
    assert.ok(d.use && d.about, `${t} is documented`);
  }
});

test('wrap tags make runs over the plain text; nested ones merge their effects', () => {
  const P = parseLine('Ah, my [b]finest[/b] hour.');
  assert.equal(P.plain, 'Ah, my finest hour.');
  assert.deepEqual(P.runs, [{ from: 7, to: 13, fx: { b: true } }]);
  const Q = parseLine('[c=gold][b]Gold[/b] leaf[/c]');
  assert.equal(Q.plain, 'Gold leaf');
  assert.deepEqual(Q.runs, [
    { from: 0, to: 4, fx: { b: true, c: 'gold' } },
    { from: 4, to: 9, fx: { c: 'gold' } },
  ]);
  for (const t of ['i', 'big', 'small', 'wave', 'shake', 'slow', 'fast'])
    assert.deepEqual(parseLine(`x [${t}]y[/${t}]`).runs, [{ from: 2, to: 3, fx: { [t]: true } }], t);
});

test('point tags are events at a place in the plain text; a point tag between spaces leaves one space', () => {
  const P = parseLine('[smug]Ninety percent confidence[p] and [face=angry]ten [emote=sweat] percent [stamp=denied]');
  assert.equal(P.plain, 'Ninety percent confidence and ten percent');
  assert.equal(P.expr, 'smug');
  assert.deepEqual(P.events, [
    { at: 25, kind: 'p', v: MARKUP_PAUSE },
    { at: 30, kind: 'face', v: 'angry' },
    { at: 34, kind: 'emote', v: 'sweat' },
    { at: 41, kind: 'stamp', v: 'denied' },
  ]);
  assert.equal(P.plain.slice(30, 33), 'ten');
  assert.deepEqual(parseLine('Wait[p=0.8] what').events, [{ at: 4, kind: 'p', v: 0.8 }]);
  assert.deepEqual(parseLine('Long[p=9]').events, [{ at: 4, kind: 'p', v: MARKUP_PAUSE_MAX }]);
  assert.deepEqual(parseLine('Hm [emote=!]').events, [{ at: 2, kind: 'emote', v: '!' }]);
});

test('a cut: the tag, or a line ending in a dash (not both)', () => {
  assert.deepEqual(parseLine('They diversify their—').events, [{ at: 21, kind: 'cut' }]);
  assert.deepEqual(parseLine('I was[cut] going to').events, [{ at: 5, kind: 'cut' }]);
  assert.equal(parseLine('Stop—[cut]').events.length, 1);
});

test('the errors: unknown tags (with a did-you-mean), bad values, closing, crossing, styles mid-line', () => {
  const err = t => parseLine(t).errors;
  assert.deepEqual(err('A [wav]wave[/wave]'), [
    'unknown tag "[wav]", did you mean "[wave]"?',
    '"[/wave]" closes nothing',
  ]);
  assert.deepEqual(err('A [blorp] x'), ['unknown tag "[blorp]"']);
  assert.match(err('[c=gld]x[/c]')[0], /did you mean "\[c=gold\]"\? the choices are gold, red, teal, grey/);
  assert.match(err('[c]x[/c]')[0], /needs a value/);
  assert.match(err('x [emote=smile]')[0], /the choices are/);
  assert.match(err('x [stamp=apprved]')[0], /did you mean "\[stamp=approved\]"/);
  assert.match(err('x [p=soon]')[0], /a pause is a number/);
  assert.match(err('x [b=2]y[/b]')[0], /takes no value/);
  assert.match(err('x [/p]')[0], /has no closing tag/);
  assert.match(err('x [face]')[0], /needs a value/);
  assert.deepEqual(err('[b][i]x[/b][/i]'), ['"[/b]" crosses "[i]": close "[/i]" first']);
  assert.deepEqual(err('[b]open'), ['not closed: "[b]"']);
  assert.deepEqual(err('[b]x[b]y[/b]'), ['"[b]" is already open']);
  assert.deepEqual(err('Hey [shout] you'), ['"[shout]" goes at the start of the line']);
  assert.deepEqual(err('[shout][shout] x'), ['a style given twice']);
  // an unknown tag stays in the text as typed, so the mistake shows
  assert.equal(parseLine('Got [sic] it').plain, 'Got [sic] it');
  // brackets that aren't tag-shaped are plain text
  assert.deepEqual(err('[if beans >= 1] x'), []);
  assert.deepEqual(err('Room [B2]'), []);
});

test('a choice option allows only its own tags', () => {
  assert.deepEqual(OPTION_TAGS, ['b']);
  assert.equal(markupProblem('[b]Battle[/b] him', { only: OPTION_TAGS }), '');
  assert.match(markupProblem('[wave]Walk[/wave] away', { only: OPTION_TAGS }), /can't go here/);
  assert.match(markupProblem('[shout] Run', { only: OPTION_TAGS }), /can't go here/);
});

test("the mockup's scene lines parse with no errors", () => {
  for (const t of [
    '[happy]Ah, my [b]finest[/b] experiment returns! [emote=sparkle]',
    '[surprised]Dropped? I [i]delegated[/i] gravity.',
    '[smug]Science is ninety percent confidence[p] and ten percent [shake]liability waivers[/shake].',
    '[wait]He lost the waivers.[p=0.6] [small]In the yuzu bath.[/small]',
    '[angry][shout]KAPPI! [emote=anger]',
    '[happy]Then fill in Form 12 to request one.[p] Form 12 is [wave]out of stock[/wave]. [stamp=denied]',
    '[think]Has anyone ever actually got through here?',
    'Still catching Billies with [c=gold]pyramids[/c]? [face=happy]Cute.',
    "[angry]Mine don't unionize, they [wave]diversify[/wave] their—",
    '[wait][slow]Breathe in.[p=0.9] Breathe out.[/slow]',
    '[surprised][shout]THE LAB IS ON FIRE! [emote=!]',
  ])
    assert.deepEqual(parseLine(t).errors, [], t);
});

test('a script: bad markup is an error on its line; styles stay in the text after the speaker', () => {
  assert.throws(
    () => parseScript(['Hello.', 'A [wav]wave[/wav].']),
    e => {
      assert.equal(e.name, 'ScriptError');
      assert.equal(e.line, 1);
      assert.match(e.message, /unknown tag "\[wav\]", did you mean "\[wave\]"\?/);
      return true;
    }
  );
  assert.throws(() => parseScript(['choice', '  > [wave]Go[/wave]']), /can't go here/);
  const [n] = parseScript(['[happy][shout] Chosen: [b]Out[/b]!']);
  assert.deepEqual([n.expr, n.who, n.text], ['happy', 'Chosen', '[shout][b]Out[/b]!']);
  const [o] = parseScript(['[sad] Plain words.']);
  assert.deepEqual([o.expr, o.who, o.text], ['sad', null, 'Plain words.']);
  const [c] = parseScript(['choice', '  > [once] [b]Battle[/b] him']);
  assert.equal(c.options[0].text, '[b]Battle[/b] him');
});

test("the Studio's reference lists every tag", () => {
  const M = scriptReference().find(s => s.title === 'Markup');
  assert.ok(M, 'a Markup section');
  assert.deepEqual(
    M.rows.map(r => r.use),
    Object.values(MARKUP_TAGS).map(t => t.use)
  );
});
