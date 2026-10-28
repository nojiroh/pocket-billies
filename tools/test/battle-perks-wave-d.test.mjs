// PK-6: Wave D's effect kinds (perks-track.md 5.5 and section 7): the run rules cap, sideOpen, eventHurt and
// sideFind, copy and give, each with test-only Perks first; then the 11 Wave D Perks of perks.json, each working,
// growth and copy over a simulated run, and every Perk of Waves A-D held at once staying finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { SPECIES } = data;
/** a species of type T (one of that type alone when there is one) */
const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** made-up Perks (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};
const RULE = GAME_DATA.rules.run.perks;
/** a run holding these Perks (its other Perks fillers of perks.json's first ones) */
const runOf = (...ids) => {
  const r = modules['run-state'].newRun('WAVEDRUN01', 1, 1, { team: [] });
  r.perks = ids;
  return r;
};

/* ---------- rule cap ---------- */

test('PK-6 rule cap: n more Perks held; letting the cap Perk go never leaves more than the cap', () => {
  const PK = modules.perks,
    { P } = perks({ id: 'test_file', fx: [{ kind: 'rule', rule: 'cap', n: 1 }] });
  withPerks(P, () => {
    const fill = Object.keys(data.PERKS).filter(k => !k.startsWith('test')),
      r = runOf();
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap);
    for (const id of fill.slice(0, RULE.cap)) assert.equal(PK.perkTake(r, id, data.PERKS, RULE), '');
    assert.equal(PK.perkTake(r, 'test_file', data.PERKS, RULE), 'full');
    assert.equal(PK.perkTake(r, 'test_file', data.PERKS, RULE, fill[0]), '');
    assert.equal(PK.perkCap(r, RULE, data.PERKS), RULE.cap + 1);
    /* one more fits now */
    assert.equal(PK.perkTake(r, fill[RULE.cap], data.PERKS, RULE), '');
    assert.equal(r.perks.length, RULE.cap + 1);
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE), 'full');
    /* the file can't be let go at the cap it raises; another can */
    assert.equal(PK.perkDropOk(r, 'test_file', fill[RULE.cap + 1], data.PERKS, RULE), false);
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE, 'test_file'), 'cap');
    assert.ok(r.perks.includes('test_file'));
    assert.equal(PK.perkTake(r, fill[RULE.cap + 1], data.PERKS, RULE, fill[1]), '');
    /* a pick's preview order takes up to the raised cap too */
    assert.equal(PK.perkCap(null, RULE, data.PERKS), RULE.cap);
  });
});

/* ---------- copy ---------- */

test('PK-6 copy: a copier gives the rows of the Perk just above it, as its own; never itself or another copier', () => {
  const E = modules.effects,
    PK = modules.perks,
    { P } = perks(
      { id: 'test_stamp', name: 'Test Stamp', fx: [{ kind: 'damage', side: 'deal', mult: 1.5 }] },
      { id: 'test_count', name: 'Test Count', fx: [{ kind: 'heal', share: 0.5, when: 'arrive', every: 3 }] },
      { id: 'test_copier', name: 'Test Copier', fx: [{ kind: 'copy' }] },
      { id: 'test_copier2', name: 'Test Copier 2', fx: [{ kind: 'copy' }] }
    );
  const rows = ids => E.fxOfRun({ perks: ids }, P);
  assert.deepEqual(
    rows(['test_stamp', 'test_copier']).map(f => [f.src, f.kind, f.mult]),
    [
      ['test_stamp', 'damage', 1.5],
      ['test_copier', 'damage', 1.5],
    ]
  );
  assert.equal(
    E.fxDamage(rows(['test_stamp', 'test_copier']), { cat: 'H', type: 'Fire', deal: true, take: false }),
    2.25
  );
  /* first in the list, or under another copier: nothing */
  assert.equal(rows(['test_copier', 'test_stamp']).length, 1);
  assert.deepEqual(
    rows(['test_stamp', 'test_copier', 'test_copier2']).map(f => f.src),
    ['test_stamp', 'test_copier']
  );
  /* a counting row copied counts on its own mark (the copier's), numbered as the copier's row */
  const c = rows(['test_count', 'test_copier']);
  assert.deepEqual(
    c.map(f => E.fxKey(f)),
    ['test_count/0', 'test_copier/0']
  );
  /* the card says what it copies, and the copied counter */
  const run = { perks: ['test_count', 'test_copier'], perkState: { 'test_copier/0': { n: 2 } } };
  assert.equal(PK.perkCount(run, 'test_copier', P), 'copies Test Count · 2/3');
  assert.equal(PK.perkCount({ perks: ['test_copier'], perkState: {} }, 'test_copier', P), 'copies nothing');
  assert.equal(PK.perkCount({ perks: [], perkState: {} }, 'test_copier', P), '', 'not held: nothing');
});

/* ---------- give ---------- */

test('PK-6 give: taking the Perk pays its Moneys and puts its items in the Bag, once; a copier gives again', () => {
  const PK = modules.perks,
    { P } = perks(
      { id: 'test_pass', name: 'Test Pass', fx: [{ kind: 'give', money: 150, items: { potion: 2 }, when: 'take' }] },
      { id: 'test_copier', name: 'Test Copier', fx: [{ kind: 'copy' }] }
    );
  withPerks(P, () => {
    reseed(3);
    const s = startedSave(ofType('Water'), 30);
    s.se = 100;
    s.items.potion = 1;
    s.run = runOf();
    const toasts = [];
    hooks.provide({ toast: t => toasts.push(t) });
    try {
      assert.equal(PK.perkTake(s.run, 'test_pass', data.PERKS, RULE, undefined, s), '');
      assert.equal(s.se, 250);
      assert.equal(s.items.potion, 3);
      assert.deepEqual(toasts, ['Test Pass: 150 Moneys and 2 Potions.']);
      /* nothing more on later moments */
      modules['run-loop'].runArriveFx(s, data.PERKS, {});
      assert.equal(s.se, 250);
      /* a copier taken just below it gives the same, once */
      assert.equal(PK.perkTake(s.run, 'test_copier', data.PERKS, RULE, undefined, s), '');
      assert.equal(s.se, 400);
      assert.equal(s.items.potion, 5);
    } finally {
      hooks.provide({ toast: undefined });
    }
    /* without the save (a preview), nothing is given */
    const r = runOf();
    assert.equal(PK.perkTake(r, 'test_pass', data.PERKS, RULE), '');
  });
  assert.equal(modules['run-loop'].runGaveText({ money: 0, items: {} }), '');
  assert.equal(modules['run-loop'].runGaveText({ money: 1, items: {} }), '1 Money');
});

/* ---------- rule sideOpen ---------- */

test('PK-6 rule sideOpen: a side area’s obstacle opens with the badge alone; never without the badge', () => {
  const S = modules['run-side'],
    M = { type: 'Grass', name: 'Cut' },
    team = [
      { name: 'Wave', types: ['Water'] },
      { name: 'Leafy', types: ['Grass'] },
    ],
    noGrass = [team[0]],
    badges = { grass: 1 },
    { P } = perks({ id: 'test_rope', fx: [{ kind: 'rule', rule: 'sideOpen', n: 1 }] });
  /* as before without it */
  assert.deepEqual(S.fieldMoveState(M, badges, noGrass), { state: 'needType', billie: '' });
  assert.deepEqual(S.fieldMoveState(M, badges, team), { state: 'ask', billie: 'Leafy' });
  /* with it: anyone uses it (the type's first still first) */
  assert.deepEqual(S.fieldMoveState(M, badges, noGrass, true), { state: 'ask', billie: 'Wave' });
  assert.deepEqual(S.fieldMoveState(M, badges, team, true), { state: 'ask', billie: 'Leafy' });
  assert.deepEqual(S.fieldMoveState(M, {}, noGrass, true), { state: 'needBadge', billie: '' });
  withPerks(P, () => {
    assert.equal(S.fieldRope(runOf('test_rope')), true);
    assert.equal(S.fieldRope(runOf()), false);
    assert.equal(S.fieldRope(null), false);
  });
});

/* ---------- rule sideFind ---------- */

test('PK-6 rule sideFind: a side place holds finds more that show only with the rule; the rest stays the same', () => {
  const F = modules['route-finds'],
    D = { rules: GAME_DATA.rules.run.finds, cards: GAME_DATA.rewards },
    spots = [20, 40, 60, 80, 100, 120].map((x, k) => ({ kind: k % 2 ? 'pocket' : 'deadend', x, z: x })),
    make = side => {
      const run = { seed: 'SIDEFINDS1', map: { nodes: [{}, side ? { side: 1 } : {}] } },
        scenes = [null, { props: [], spots: structuredClone(spots), pieces: [] }],
        got = F.routeFindsPlace(run, { T: { runNode: 1, route: { at: [0, 0] } } }, scenes, {}, D);
      return { got, props: scenes[1].props };
    };
  const main = make(false),
    side = make(true),
    plain = p => !p.more;
  /* the place's own finds are the same either way; the side's more come after them, marked */
  assert.deepEqual(side.props.filter(plain), main.props);
  assert.deepEqual(side.got[1].finds, main.got[1].finds);
  assert.equal(main.got[1].more, undefined);
  const more = side.props.filter(p => p.more);
  assert.equal(more.length, F.ROUTE_FIND_MORE);
  assert.deepEqual(
    more.map(p => p.more),
    [1, 2]
  );
  assert.deepEqual(
    side.got[1].more,
    more.map(p => p.card)
  );
  /* picked up only while the rule counts that many */
  const p = more[0];
  assert.equal(F.routeFindAt({ props: [p] }, p.x, p.z, {}), null);
  assert.deepEqual(F.routeFindAt({ props: [p] }, p.x, p.z, {}, 1), { card: p.card, flag: p.find });
  assert.equal(F.routeFindAt({ props: [more[1]] }, more[1].x, more[1].z, {}, 1), null);
  const { P } = perks({ id: 'test_key', fx: [{ kind: 'rule', rule: 'sideFind', n: 1 }] });
  withPerks(P, () => {
    assert.equal(F.routeFindsMore(runOf('test_key')), 1);
    assert.equal(F.routeFindsMore(runOf()), 0);
  });
});

/* ---------- rule eventHurt ---------- */

test('PK-6 rule eventHurt: an event’s hurt is kept off by the Perk that holds it; it lands without', () => {
  const L = modules['run-loop'],
    { P } = perks({ id: 'test_pole', name: 'Test Pole', fx: [{ kind: 'rule', rule: 'eventHurt', n: 1 }] });
  reseed(3);
  const s = startedSave(ofType('Water'), 30);
  s.run = { perks: ['test_pole'], perkState: {} };
  assert.equal(L.runEventSafe(s, P), 'test_pole');
  s.run.perks = [];
  assert.equal(L.runEventSafe(s, P), '');
  s.run = null;
  assert.equal(L.runEventSafe(s, P), '');
});

/* ---------- needs side ---------- */

test('PK-6 needs side: offered only while a side area is ahead (not open and reachable, or open and not walked)', () => {
  const PK = modules.perks,
    r = runOf();
  r.map = {
    nodes: [{ row: 0 }, { row: 1 }, { row: 2 }, { row: 2, side: 1 }, { row: 3 }],
    side: { from: 1, nodes: [3], to: 4 },
  };
  r.path = [];
  assert.equal(PK.perkRunSide(r), true, 'at the start');
  r.path = [0];
  assert.equal(PK.perkRunSide(r), true, 'the obstacle a row ahead');
  r.path = [0, 1];
  assert.equal(PK.perkRunSide(r), true, 'at the obstacle');
  r.path = [0, 1, 2];
  assert.equal(PK.perkRunSide(r), false, 'walked past it');
  r.map.side.open = 1;
  r.path = [0, 1];
  assert.equal(PK.perkRunSide(r), true, 'open, its places ahead');
  r.path = [0, 1, 3];
  assert.equal(PK.perkRunSide(r), false, 'open and walked');
  r.map.side = undefined;
  assert.equal(PK.perkRunSide(r), false, 'no side area on this run');
  assert.equal(PK.perkRunSide(null), true, 'a preview: not asked');
  const P = { name: 'X', d: 'x', rarity: 'common', fx: [], needs: 'side' };
  assert.equal(PK.perkFits(P, [['Fire']], r), false);
  assert.equal(PK.perkFits(P, undefined, r), true, 'no team: needs not asked');
});
