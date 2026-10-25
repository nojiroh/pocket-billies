// SP-1: logic/graft-art.js, a grafted Billie's recipe: its species' kit recipe with a slot's part from a donor's
// recipe (kind for kind, the donor's colour and size), ready for kitBakeWhole. Also a bake per species and slot with
// its first donor: it bakes, fits the stage box and wears the donor's part; ungrafted recipes are untouched.
// tools/test/graft-art-sweep.test.mjs (slow tier) bakes every donor.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readPng } from './png.mjs';
import { modules, ROOT } from './setup-real.mjs';

const G = modules['graft-art'];
const { kitBakeWhole } = modules['kit-assemble'];
const read = (/** @type {string} */ f) => JSON.parse(readFileSync(join(ROOT, 'game/data', f), 'utf8'));
const K = read('partKits.json'),
  B = read('kitBuilds.json'),
  D = { partKits: K, kitBuilds: B, rules: read('rules.json') };
const cache = new Map();
export const pics = (/** @type {string} */ id, /** @type {string} */ view) => {
  const key = id + '|' + view;
  if (!cache.has(key)) cache.set(key, readPng(join(ROOT, 'game/art', K.parts[id].views[view].file)));
  return cache.get(key);
};

test('graft-art: graftKey is stable whatever the order, empty for none', () => {
  assert.equal(G.graftKey({ sig: 'zuck2', front: 'swift1' }), 'front=swift1,sig=zuck2');
  assert.equal(G.graftKey({ front: 'swift1', sig: 'zuck2' }), 'front=swift1,sig=zuck2');
  assert.equal(G.graftKey(null), '');
  assert.equal(G.graftKey({}), '');
});

test('graft-art: graftParse reads a graftKey back, null for nothing', () => {
  assert.deepEqual(G.graftParse('front=swift1,sig=zuck2'), { front: 'swift1', sig: 'zuck2' });
  assert.equal(G.graftKey(G.graftParse('sig=zuck2,front=swift1')), 'front=swift1,sig=zuck2');
  assert.equal(G.graftParse(''), null);
  assert.equal(G.graftParse('front'), null);
});

test('graft-art: graftSet and graftOf keep a graft on the Billie (SP-2: Billy.graft, saved with it)', () => {
  const m = { uid: 'a', sp: 'musk0' };
  assert.equal(G.graftOf(m), '');
  G.graftSet(m, 'sig=zuck2,front=swift1');
  assert.deepEqual(m.graft, { sig: 'zuck2', front: 'swift1' });
  assert.equal(G.graftOf(m), 'front=swift1,sig=zuck2');
  assert.equal(G.graftOf(structuredClone(m)), 'front=swift1,sig=zuck2', 'a copy (a reloaded save) keeps it');
  G.graftSet(m, '');
  assert.equal('graft' in m, false);
  assert.equal(G.graftOf(m), '');
  assert.equal(G.graftOf(null), '');
});

test('graft-art: graftKind reads partKits slots, and a form\'s "slots" first (the slug\'s tail is its back)', () => {
  const ox = G.graftRecipe(B, 'musk0'),
    slug = B.forms.find((/** @type {any} */ f) => f.slots?.tail === 'back');
  assert.equal(G.graftKind(K, ox, 'front'), 'arm');
  assert.equal(G.graftKind(K, ox, 'back'), 'leg');
  assert.equal(G.graftKind(K, ox, 'sig'), 'tail');
  assert.equal(G.graftKind(K, slug, 'back'), 'tail');
  assert.equal(G.graftKind(K, slug, 'sig'), null);
});

test("graft-art: graftForm swaps the slot's part for the donor's, its colour and its size on the donor", () => {
  const ox = G.graftRecipe(B, 'musk0'),
    swift = G.graftRecipe(B, 'swift1'),
    f = G.graftForm(B, K, 'musk0', { front: 'swift1' });
  assert.equal(f.parts.arm[0], swift.parts.arm[0]);
  assert.equal(f.parts.arm[2], swift.parts.arm[2]);
  assert.ok(Math.abs(f.parts.arm[1] * ox.scale - swift.parts.arm[1] * swift.scale) < 1e-3);
  assert.deepEqual(f.parts.leg, ox.parts.leg);
  assert.equal(f.name, `${ox.name}~front=swift1`);
  assert.equal(ox.parts.arm[0], 'bear_arm', 'the recipe itself is untouched');
});

test('graft-art: graftForm is null for an unknown species or donor, or a donor without that kind', () => {
  const slug = B.forms.find((/** @type {any} */ f) => f.slots?.tail === 'back');
  assert.equal(G.graftForm(B, K, 'nobody', { front: 'swift1' }), null);
  assert.equal(G.graftForm(B, K, 'musk0', { front: 'nobody' }), null);
  assert.equal(G.graftForm(B, K, 'musk0', { back: slug.rig }), null, 'a slug tail never stands in for legs');
});

test('graft-art: graftDonors are other lines with the same bone kind and another part', () => {
  const ox = G.graftRecipe(B, 'musk0');
  for (const slot of G.GRAFT_SLOTS) {
    const kind = G.graftKind(K, ox, slot),
      list = G.graftDonors(B, K, 'musk0', slot);
    assert.ok(list.length > 0, slot);
    for (const sp of list) {
      const f = G.graftRecipe(B, sp);
      assert.notEqual(f.line, 'musk');
      assert.equal(G.graftKind(K, f, slot), kind);
      assert.notEqual(f.parts[kind][0], ox.parts[kind][0]);
    }
  }
});

test('graft-art: every recipe with its first donor per slot bakes, fits and wears the donor part', () => {
  let n = 0;
  for (const base of B.forms)
    for (const slot of G.GRAFT_SLOTS) {
      const [donor] = G.graftDonors(B, K, base.rig, slot);
      if (!donor) continue;
      const f = G.graftForm(B, K, base.rig, { [slot]: donor }),
        made = kitBakeWhole(D, f, pics);
      assert.equal(made.parts[slot], G.graftRecipe(B, donor).parts[G.graftKind(K, base, slot)][0], `${f.name}`);
      assert.ok(made.sheet.width > 0 && made.rig.front.bones.length > 0, f.name);
      n++;
    }
  assert.ok(n > 100, `${n} grafts baked`);
});
