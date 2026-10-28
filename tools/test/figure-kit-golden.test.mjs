// Characters track CH-5: the figure kit's golden figures. CH-5 moves the kit's shapes from code into data
// (game/data/figureKit.json); every move must leave the figures it builds exactly as they were. This hashes the whole
// figure (its parts, shapes, colours and face marks) for every person, every wardrobe item, every hat with every hair
// style, every head with every build, and the directions' extras (flair, proportions). Update the snapshot only for a
// change meant to alter how figures look:
//   node --test --test-update-snapshots tools/test/figure-kit-golden.test.mjs
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { FIGURE_BUILDS, FIGURE_HEADS, kappiFigure, lookFigure } from '../../game/js/logic/figure-kit.js';

const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));
const PEOPLE = Object.fromEntries(
  readdirSync(new URL('../../game/data/people/', import.meta.url))
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => [
      f.slice(0, -5),
      JSON.parse(readFileSync(new URL(`../../game/data/people/${f}`, import.meta.url), 'utf8')),
    ])
);
const ids = slot =>
  Object.keys(W.items)
    .filter(k => W.items[k].slot === slot)
    .sort();
const hash = F => createHash('sha1').update(JSON.stringify(F)).digest('hex').slice(0, 16);
/* every extra a direction can turn on (figures.js FIGURE_LOOKS's flair), and a direction's proportions */
const FLAIR = {
  detail: true,
  hair: 1.15,
  scarf: true,
  cape: true,
  col: [95, 183, 192],
  gloves: true,
  gloveCol: [40, 30, 60],
  goggles: true,
  fur: true,
  earrings: true,
  ahoge: true,
  glossy: true,
};
const CHIBI = { head: 1.3, legs: 0.74, torso: 0.86, arms: 0.84, neck: 0.4 };

test('figure kit golden: every person', t => {
  const out = {};
  for (const [who, p] of Object.entries(PEOPLE)) {
    if (p.creature) {
      out[who] = hash(kappiFigure({ name: who }));
      continue;
    }
    if (!p.look) continue;
    out[who] = hash(lookFigure(p.look, W.items, { name: who, figure: p.figure }));
    out[who + '+flair'] = hash(lookFigure(p.look, W.items, { name: who, figure: p.figure, flair: FLAIR }));
    out[who + '+chibi'] = hash(lookFigure(p.look, W.items, { name: who, figure: p.figure, chibi: CHIBI }));
  }
  out['folk'] = hash(lookFigure(PEOPLE.chosen.look, W.items, { name: 'folk:7', figure: { variety: true } }));
  t.assert.snapshot(out);
});

test('figure kit golden: every wardrobe item', t => {
  const base = PEOPLE.chosen.look,
    out = {};
  for (const slot of ['hair', 'eyes', 'brows', 'mouth', 'facial', 'top', 'outer', 'bottom', 'shoes', 'hat'].concat([
    'glasses',
    'neck',
    'bag',
  ]))
    for (const id of ids(slot)) {
      const look = { ...base, wear: { ...base.wear, [slot]: id } };
      out[id] = hash(lookFigure(look, W.items, { name: id }));
      out[id + '+flair'] = hash(lookFigure(look, W.items, { name: id, flair: FLAIR }));
    }
  t.assert.snapshot(out);
});

test('figure kit golden: every hat with every hair style', t => {
  const base = PEOPLE.chosen.look,
    out = {};
  for (const hat of [null, ...ids('hat')])
    for (const hair of [null, ...ids('hair')]) {
      const look = { ...base, wear: { ...base.wear, hat, hair } };
      out[hat + '/' + hair] = hash(lookFigure(look, W.items, { name: 'h' + hat + hair }));
    }
  t.assert.snapshot(out);
});

test('figure kit golden: every head with every build', t => {
  const base = PEOPLE.chosen.look,
    out = {};
  for (const head of Object.keys(FIGURE_HEADS))
    for (const build of Object.keys(FIGURE_BUILDS))
      out[head + '/' + build] = hash(lookFigure(base, W.items, { name: head + build, figure: { head, build } }));
  t.assert.snapshot(out);
});
