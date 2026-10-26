// Roster track RO-3c: placeholder Billies grafted by slot across body plans (game/js/logic/graft-art.js,
// graftPlaceholder). Tested on sample Billies (tools/bake-placeholders.mjs samplePlaceholder), one per plan, until the
// roster's own are placeholders. A slot's groups per plan; every plan gives every other plan its front, back and sig,
// inside the stage box, the same twice; the grafted bones wear the donor's colour and the rest keep their pixels; a
// mirrored twin is its bone flipped; a chain as long as the donor's is taken bone for bone; a slot one side lacks is
// refused; the donors are other lines with the slot.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson } from '../data-files.mjs';
import { POSES_BY_PLAN } from '../../game/js/body-plan-animation.js';
import * as G from '../../game/js/logic/graft-art.js';
import { kitFlipX } from '../../game/js/logic/kit-pixels.js';
import * as PA from '../../game/js/logic/placeholder-art.js';
import { samplePlaceholder } from '../bake-placeholders.mjs';

const P = readJson('bodyPlans.json');
const D = readJson('kitBuilds.json').bake;
const PLANS = Object.keys(POSES_BY_PLAN);
/** a sample Billie baked: the receivers in the sample colours, the donors blue */
const baked = new Map();
const bake = (plan, donor = false) => {
  const key = plan + (donor ? '+' : '');
  if (!baked.has(key)) {
    const form = donor
      ? { ...samplePlaceholder(plan), name: `donor-${plan}`, rig: `donor-${plan}`, colours: { main: '#4a79c8' } }
      : samplePlaceholder(plan);
    baked.set(key, { form, ...PA.placeholderBake(P, form, D) });
  }
  return baked.get(key);
};
/** a picture with the donors' blue in it (shaded from behind; the samples are orange and yellow) */
const blue = pic => {
  for (let i = 0; i < pic.data.length; i += 4) if (pic.data[i + 3] && pic.data[i + 2] > pic.data[i] + 30) return true;
  return false;
};
const same = (a, b) =>
  a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;
const bonesOf = plan => PA.placeholderBones(P, samplePlaceholder(plan));

test('graftGroups: a slot as chains of its own bones, mirrors left out', () => {
  const g = (plan, slot) => G.graftGroups(bonesOf(plan), slot);
  assert.deepEqual(g('biped', 'front'), [['armL']]);
  assert.deepEqual(g('quad', 'front'), [['legFF'], ['legFN']]);
  assert.deepEqual(g('octo', 'front'), [['t10', 't11', 't12']]);
  assert.deepEqual(g('serpent', 'front'), [['n1', 'n2']]);
  assert.deepEqual(g('hopper', 'back'), [['thighL', 'footL']]);
  assert.deepEqual(g('insect', 'back'), [['legL1'], ['legL2']]);
  assert.deepEqual(g('fish', 'front'), [['wingL'], ['wingR']]);
  assert.deepEqual(g('worm', 'body'), [['s2'], ['s1']]);
  /* the shared bone (bodyPlans.json `also`) is body only: nothing to graft as a head */
  assert.deepEqual(g('octo', 'head'), []);
  assert.deepEqual(g('blob', 'head'), []);
  for (const plan of PLANS)
    for (const slot of G.GRAFT_SLOTS) assert.ok(g(plan, slot).length, `${plan} has no ${slot} group`);
});

test('every plan grafts every other plan front, back and sig: inside the box, donor colours on, the rest kept', () => {
  for (const to of PLANS)
    for (const from of PLANS)
      for (const slot of G.GRAFT_SLOTS) {
        const recv = bake(to),
          donor = bake(from, true),
          at = `${from} ${slot} -> ${to}`,
          made = G.graftPlaceholder(P, D, recv, { [slot]: donor }),
          inSlot = new Set(
            PA.placeholderBones(P, recv.form)
              .filter(b => b.slot === slot)
              .map(b => b.n)
          );
        assert.equal(made.rig.front.graft, `${slot}=donor-${from}`, at);
        for (const view of PA.PLACEHOLDER_VIEWS) {
          const R = made.rig[view],
            B = { form: recv.form, rig: made.rig, sheet: made.sheet };
          assert.deepEqual(
            R.bones.map(b => b.n),
            recv.rig[view].bones.map(b => b.n),
            `${at}: the same bones`
          );
          let any = false;
          for (const b of R.bones) {
            const now = G.graftPic(B, view, b.n),
              was = G.graftPic(recv, view, b.n);
            if (inSlot.has(b.n)) any ||= !!now && blue(now.pic);
            else {
              assert.equal(!!now, !!was, `${at}: ${view} ${b.n} drawn as before`);
              if (now) assert.ok(same(now.pic, was.pic), `${at}: ${view} ${b.n} keeps its pixels`);
            }
          }
          assert.ok(any, `${at}: ${view}: no donor picture`);
        }
      }
});

test('a graft is the same twice, and several slots at once', () => {
  const g = { front: bake('octo', true), sig: bake('crab', true), back: bake('hopper', true) },
    a = G.graftPlaceholder(P, D, bake('quad'), g),
    b = G.graftPlaceholder(P, D, bake('quad'), g);
  assert.ok(same(a.sheet, b.sheet));
  assert.deepEqual(a.rig, b.rig);
  assert.equal(a.rig.back.graft, 'back=donor-hopper,front=donor-octo,sig=donor-crab');
});

test("a mirrored twin wears its bone's new picture flipped", () => {
  const recv = bake('biped'),
    made = G.graftPlaceholder(P, D, recv, { front: bake('octo', true) }),
    B = { form: recv.form, rig: made.rig, sheet: made.sheet };
  for (const view of PA.PLACEHOLDER_VIEWS) {
    const l = G.graftPic(B, view, 'armL'),
      r = G.graftPic(B, view, 'armR');
    assert.ok(blue(l.pic) && same(r.pic, { ...l.pic, data: kitFlipX(l.pic).data }), view);
  }
});

test("a chain as long as the donor's takes it bone for bone; a shorter one takes it whole on its first bone", () => {
  const octo = bake('octo'),
    donor = bake('octo', true),
    made = G.graftPlaceholder(P, D, octo, { front: donor }),
    B = { form: octo.form, rig: made.rig, sheet: made.sheet };
  for (const n of ['t10', 't11', 't12'])
    assert.ok(same(G.graftPic(B, 'front', n).pic, G.graftPic(donor, 'front', n).pic), `${n} as the donor's`);
  /* a biped's one arm: the whole tentacle on it */
  const biped = G.graftPlaceholder(P, D, bake('biped'), { front: donor }),
    arm = G.graftPic({ form: bake('biped').form, rig: biped.rig, sheet: biped.sheet }, 'front', 'armL').pic,
    seg = G.graftPic(donor, 'front', 't10').pic;
  assert.ok(arm.height > seg.height * 1.5, 'longer than one tentacle segment');
  /* an octopus given an arm: the arm on the first segment, the others draw nothing but keep their joints */
  const given = G.graftPlaceholder(P, D, octo, { front: bake('biped', true) });
  assert.deepEqual(
    ['t10', 't11', 't12', 't40', 't41', 't42'].map(n => given.rig.front.bones.find(b => b.n === n).i >= 0),
    [true, false, false, true, false, false]
  );
});

test('a slot one side lacks is refused; donors are other lines with the slot', () => {
  assert.throws(() => G.graftPlaceholder(P, D, bake('octo'), { head: bake('biped', true) }), /octo.*has no head/);
  assert.throws(() => G.graftPlaceholder(P, D, bake('biped'), { head: bake('blob', true) }), /blob.*no head to give/);
  const forms = [
    { ...samplePlaceholder('biped'), line: 'a' },
    { ...samplePlaceholder('quad'), line: 'b' },
    { ...samplePlaceholder('blob'), line: 'c' },
    { ...samplePlaceholder('octo'), line: 'a', rig: 'octo-a' },
  ];
  assert.deepEqual(G.graftPlaceholderDonors(P, forms, 'sample-biped', 'front'), ['sample-quad', 'sample-blob']);
  assert.deepEqual(G.graftPlaceholderDonors(P, forms, 'sample-biped', 'head'), ['sample-quad']);
  assert.deepEqual(G.graftPlaceholderDonors(P, forms, 'sample-blob', 'head'), []);
  assert.deepEqual(G.graftPlaceholderDonors(P, forms, 'nobody', 'front'), []);
});

test('graftFit: turned to point the way of the bone it lands on and as long as it; a round one inside its box', () => {
  const pic = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(255) });
  /* a part hanging down from its top (an arm) onto one sticking out left from its right edge (a leaf) */
  const f = G.graftFit({ pic: pic(4, 16), pv: [2, 0] }, { pic: pic(12, 6), pv: [12, 3] });
  assert.deepEqual([f.pic.width, f.pic.height], [12, 3], 'lies down, as long as the leaf');
  assert.ok(f.pv[0] >= f.pic.width - 1 && Math.abs(f.pv[1] - f.pic.height / 2) <= 1, 'held at its right end');
  /* onto a bone held at its middle (a round foot): along it, inside its box, held where it holds its own */
  const r = G.graftFit({ pic: pic(4, 16), pv: [2, 0] }, { pic: pic(20, 6), pv: [10, 3] });
  assert.deepEqual([r.pic.width, r.pic.height, ...r.pv], [20, 5, 10, 2.5]);
  /* scaled by k, never past 1.5 times the bone's longest side */
  assert.equal(G.graftFit({ pic: pic(4, 16), pv: [2, 0] }, { pic: pic(4, 16), pv: [2, 0] }, 0.5).pic.height, 8);
  /* a wide part on a short bone: as long as it would be 12 wide, held to 9 (1.5 times the bone's 6) */
  assert.equal(G.graftFit({ pic: pic(8, 4), pv: [4, 0] }, { pic: pic(4, 6), pv: [2, 0] }).pic.width, 9);
});
