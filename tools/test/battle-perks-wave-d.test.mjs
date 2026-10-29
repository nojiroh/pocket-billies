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
    plain = p => !p.more && !p.perk;
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

/* ---------- a growth on the card ---------- */

test('PK-6 perkCount: a growing row shows its growth now (+0% at its start, never hidden)', () => {
  const PK = modules.perks,
    { P } = perks(
      { id: 'test_like', fx: [{ kind: 'damage', side: 'deal', mult: 1, grow: { on: 'win', by: 0.01, max: 0.25 } }] },
      { id: 'test_lvl', fx: [{ kind: 'stat', stat: 'lev', stages: 0, grow: { on: 'win', by: 1, max: 3 } }] }
    );
  assert.equal(PK.perkCount({ perks: ['test_like'], perkState: {} }, 'test_like', P), '+0%');
  assert.equal(
    PK.perkCount({ perks: ['test_like'], perkState: { 'test_like/0': { v: 0.12 } } }, 'test_like', P),
    '+12%'
  );
  assert.equal(PK.perkCount({ perks: ['test_lvl'], perkState: { 'test_lvl/0': { v: 2 } } }, 'test_lvl', P), '+2');
});

/* ---------- the 11 Wave D Perks of perks.json ---------- */

const WAVE_D = [
  'accordion_file',
  'photocopier',
  'like_button',
  'streak_tracker',
  'selfie_stick',
  'coil_of_rope',
  'ten_foot_pole',
  'rusty_key',
  'time_card',
  'boarding_pass',
  'travel_pillow',
];
/** the rows of real Perks, as a run holding them gives them */
const real = ids => fn('fxOfRun')({ perks: ids }, data.PERKS);
/** a save on a run of this seed (its map made), holding these Perks */
function runSave(perkIds, sp = ofType('Water')) {
  reseed(3);
  const s = startedSave(sp, 30),
    G = GAME_DATA;
  s.run = modules['run-state'].newRun('WAVEDSEED1', 1, 1, { team: [] });
  s.run.perks = perkIds;
  modules['run-map'].runMapStart(s.run, { nodeTypes: G.nodeTypes, biomes: G.biomes, rules: G.rules.run });
  return s;
}
/** the team's HP as shares (the one Billie of a started save, and any added) */
const hurt = (s, share) => {
  for (const m of s.team) m.hp = Math.max(1, Math.floor(fn('maxHp')(m) * share));
};
const full = s => s.team.every(m => m.hp === fn('maxHp')(m));
/** a growing damage row's factor now, as the battle reads it (fxAt with the run's marks) */
const dealNow = (s, id) =>
  modules.effects
    .fxAt(real(s.run.perks), {}, { run: s.run.perkState || {} })
    .filter(f => f.src === id && f.kind === 'damage')
    .reduce((a, f) => a * f.mult, 1);

test('PK-6 Wave D: all 11 are in perks.json after Wave C, each with a picture', () => {
  assert.deepEqual(Object.keys(data.PERKS).slice(55, 66), WAVE_D);
  for (const id of WAVE_D) assert.equal(data.PERKS[id].img, `perks/${id}.svg`);
  assert.equal(data.PERKS.coil_of_rope.needs, 'side');
  assert.equal(data.PERKS.rusty_key.needs, 'side');
  assert.deepEqual(WAVE_D.map(id => data.PERKS[id].rarity).sort(), [
    'common',
    'common',
    'common',
    'common',
    'common',
    'rare',
    'rare',
    'rare',
    'uncommon',
    'uncommon',
    'uncommon',
  ]);
});

test('PK-6 Accordion File: hold 7 Perks; a Photocopier just below it makes 8', () => {
  const PK = modules.perks;
  assert.equal(PK.perkCap(runOf(), RULE, data.PERKS), 6);
  assert.equal(PK.perkCap(runOf('accordion_file'), RULE, data.PERKS), 7);
  assert.equal(PK.perkCap(runOf('accordion_file', 'photocopier'), RULE, data.PERKS), 8);
  assert.equal(PK.perkCap(runOf('photocopier', 'accordion_file'), RULE, data.PERKS), 7);
});

test('PK-6 Like Button and Streak Tracker over a simulated run: growth by wins, the streak reset by a faint', () => {
  const L = modules['run-loop'],
    s = runSave(['like_button', 'streak_tracker', 'photocopier']);
  const win = noFaint => L.runFxMoment(s, data.PERKS, 'win', { foe: ['wild'], noFaint });
  for (let k = 0; k < 3; k++) win(true);
  assert.equal(dealNow(s, 'like_button').toFixed(2), '1.03');
  assert.equal(dealNow(s, 'streak_tracker').toFixed(2), '1.15');
  /* the copier copies the Streak Tracker just above it, growing from when it came: here, from the start */
  assert.equal(dealNow(s, 'photocopier').toFixed(2), '1.15');
  assert.equal(modules.perks.perkCount(s.run, 'streak_tracker', data.PERKS), '+15%');
  assert.equal(modules.perks.perkCount(s.run, 'photocopier', data.PERKS), 'copies Streak Tracker · +15%');
  /* a win with a faint: Like Button grows, the streak doesn't */
  win(false);
  assert.equal(dealNow(s, 'like_button').toFixed(2), '1.04');
  assert.equal(dealNow(s, 'streak_tracker').toFixed(2), '1.15');
  /* a faint (the battle's faint moment, on the run's marks) starts the streak over */
  L.runFxMoment(s, data.PERKS, 'faint');
  assert.equal(dealNow(s, 'streak_tracker'), 1);
  assert.equal(dealNow(s, 'like_button').toFixed(2), '1.04');
  /* the tops: 25% each */
  for (let k = 0; k < 40; k++) win(true);
  assert.equal(dealNow(s, 'like_button').toFixed(2), '1.25');
  assert.equal(dealNow(s, 'streak_tracker').toFixed(2), '1.25');
  assert.equal(modules.perks.perkCount(s.run, 'like_button', data.PERKS), '+25%');
});

test('PK-6 Like Button and Streak Tracker in real battles: a won battle grows them, a Billie fainting resets the streak', () => {
  const s = runSave(['like_button', 'streak_tracker']),
    team = [ofType('Fire'), ofType('Water')];
  for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, 30));
  /* a whole battle with the run's marks, ended as battleSettle ends it (its win moment and noFaint) */
  const fight = (seed, lvl) => {
    reseed(5);
    const foe = fn('makeBilly')(ofType('Grass'), lvl);
    hooks.provide({ saveData: s });
    assert.ok(
      fn('newBattle')('wild', [foe], { fmt: 'single', seed, fx: real(s.run.perks), perkState: s.run.perkState })
    );
    const b = hooks.activeBattle;
    for (let t = 0; t < 200 && !b.over; t++) {
      if ((b.needSwitch || []).length) {
        const i = fn('benchCandidates')(0)[0];
        if (i == null) break;
        fn('doSwitch')(b.needSwitch.shift(), i);
        continue;
      }
      const m = fn('fighter')(0),
        mid = m.moves.find(id => data.MOVES[id] && data.MOVES[id].p > 0) || m.moves[0];
      fn('runTurn')([{ who: 0, k: 'move', mid, tk: 1 }], b);
    }
    if (b.over === 'win')
      modules['run-loop'].runFxMoment(s, data.PERKS, 'win', { foe: ['wild'], noFaint: !((b.fainted || 0) > 0) });
    return b;
  };
  s.run.perkState = {};
  const b1 = fight('wave-d-1', 5);
  assert.equal(b1.over, 'win');
  assert.equal(b1.fainted || 0, 0);
  assert.equal(dealNow(s, 'like_button').toFixed(2), '1.01');
  assert.equal(dealNow(s, 'streak_tracker').toFixed(2), '1.05');
  /* a hard foe: one of yours faints; the streak starts over whatever the end */
  for (const m of s.team) m.hp = 1;
  const b2 = fight('wave-d-2', 60);
  assert.ok((b2.fainted || 0) > 0, 'one of yours fainted');
  assert.equal(dealNow(s, 'streak_tracker'), 1);
});

test('PK-6 Selfie Stick: catching a Billie heals the team 10%', () => {
  const s = runSave(['selfie_stick']);
  hurt(s, 0.5);
  const hp = s.team[0].hp,
    m = modules['run-loop'].runFxMoment(s, data.PERKS, 'catch', { foe: ['wild'] });
  assert.ok(m.hp > 0 && s.team[0].hp > hp, `${hp} -> ${s.team[0].hp}`);
  assert.equal(s.team[0].hp - hp, Math.ceil(fn('maxHp')(s.team[0]) * 0.1));
  /* a win heals nothing */
  const h2 = s.team[0].hp;
  modules['run-loop'].runFxMoment(s, data.PERKS, 'win', { foe: ['wild'] });
  assert.equal(s.team[0].hp, h2);
});

test('PK-6 Coil of Rope, Ten-Foot Pole and Rusty Key: the rope, the safe event and the find more', () => {
  const s = runSave(['coil_of_rope', 'ten_foot_pole', 'rusty_key']);
  assert.equal(modules['run-side'].fieldRope(s.run), true);
  assert.equal(modules['run-loop'].runEventSafe(s, data.PERKS), 'ten_foot_pole');
  assert.equal(modules['route-finds'].routeFindsMore(s.run), 1);
  const t = runSave([]);
  assert.equal(modules['run-side'].fieldRope(t.run), false);
  assert.equal(modules['run-loop'].runEventSafe(t, data.PERKS), '');
  assert.equal(modules['route-finds'].routeFindsMore(t.run), 0);
});

test('PK-6 Time Card: every 5th place walked into heals the team fully; the card counts', () => {
  const L = modules['run-loop'],
    s = runSave(['time_card']);
  const healed = [];
  for (let k = 0; k < 10; k++) {
    hurt(s, 0.5);
    L.runArriveFx(s, data.PERKS, {});
    healed.push(full(s));
  }
  assert.deepEqual(healed, [false, false, false, false, true, false, false, false, false, true]);
  L.runArriveFx(s, data.PERKS, {});
  assert.equal(modules.perks.perkCount(s.run, 'time_card', data.PERKS), '1/5');
});

test('PK-6 Boarding Pass: taking it gives 150 Moneys and 2 Potions, once', () => {
  const s = runSave([]),
    PK = modules.perks;
  s.se = 10;
  s.items.potion = 0;
  assert.equal(PK.perkTake(s.run, 'boarding_pass', data.PERKS, RULE, undefined, s), '');
  assert.equal(s.se, 160);
  assert.equal(s.items.potion, 2);
  modules['run-loop'].runArriveFx(s, data.PERKS, {});
  assert.equal(s.se, 160);
});

test('PK-6 Travel Pillow: walking into a town heals the team 25%; another place, nothing', () => {
  const L = modules['run-loop'],
    s = runSave(['travel_pillow']),
    nodes = s.run.map.nodes,
    town = nodes.findIndex(n => n.type === 'town'),
    route = nodes.findIndex(n => n.type === 'route');
  assert.ok(town >= 0 && route >= 0);
  const RM = modules['run-map'];
  s.trip = { node: RM.runWorldNode(route), plan: [] };
  hurt(s, 0.5);
  let hp = s.team[0].hp;
  L.runArriveFx(s, data.PERKS, {});
  assert.equal(s.team[0].hp, hp);
  s.trip = { node: RM.runWorldNode(town), plan: [] };
  L.runArriveFx(s, data.PERKS, {});
  assert.equal(s.team[0].hp - hp, Math.ceil(fn('maxHp')(s.team[0]) * 0.25));
});

test('PK-6 all Wave A, B, C and D Perks at once: whole battles end, every number finite, the stream replayable', () => {
  const ids = Object.keys(data.PERKS).slice(13, 66);
  assert.equal(ids.length, 53);
  const team = [ofType('Fire'), ofType('Water'), ofType('Grass')];
  const play = seed => {
    reseed(7);
    const s = startedSave(team[0], 20);
    for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, 20));
    const foe = fn('makeBilly')(ofType('Grass'), 20);
    assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed, fx: real(ids), perkState: {} }));
    const b = hooks.activeBattle,
      out = [];
    for (let t = 0; t < 200 && !b.over; t++) {
      if ((b.needSwitch || []).length) {
        const i = fn('benchCandidates')(0)[0];
        if (i == null) break;
        fn('doSwitch')(b.needSwitch.shift(), i);
        continue;
      }
      const m = fn('fighter')(0),
        mid = m.moves.find(id => data.MOVES[id] && data.MOVES[id].p > 0) || m.moves[0];
      fn('runTurn')([{ who: 0, k: 'move', mid, tk: 1 }], b);
      for (const side of b.sides)
        for (const q of side.team) assert.ok(Number.isInteger(q.hp) && q.hp >= 0, `hp ${q.hp}`);
      out.push(b.events.length);
    }
    assert.ok(b.over, `${seed}: over within 200 turns`);
    return [b.over, ...out].join();
  };
  for (const seed of ['all-abcd-a', 'all-abcd-b', 'all-abcd-c']) assert.equal(play(seed), play(seed), seed);
  /* the run's moments and rules, many times over: finite */
  const s = runSave(ids),
    L = modules['run-loop'];
  s.se = 500;
  for (let i = 0; i < 12; i++) {
    L.runArriveFx(s, data.PERKS, {});
    L.runBuyFx(s, data.PERKS, 50);
    L.runFxMoment(s, data.PERKS, 'win', { foe: ['wild'], noFaint: true });
    L.runFxMoment(s, data.PERKS, 'catch', { foe: ['wild'] });
  }
  assert.ok(Number.isInteger(s.se) && s.se > 0, String(s.se));
  for (const r of modules.effects.FX_RULES) assert.ok(Number.isInteger(modules.effects.fxRunRule(s.run, r)), r);
  for (const f of modules.effects.fxAt(real(ids), {}, { run: s.run.perkState }))
    for (const k of ['mult', 'share', 'n', 'stages']) if (k in f) assert.ok(Number.isFinite(f[k]), `${f.src} ${k}`);
});
