// PK-1: logic/effects.js's when, if, every, grow, per and once (perks-track.md section 7): each condition word, a
// counter that acts on every Nth moment, a growth with its cap and reset, a number counted per team type, the three
// once scopes, peeking without spending, and a row without these fields read exactly as before.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules } from './setup-real.mjs';

const E = modules.effects;
const row = (f, src = 'x', i = 0) => ({ ...f, src, row: i });

test('effects when: every condition word holds only where it should, and an unknown thing is false', () => {
  const ctx = {
    weather: 'rain',
    type: ['Fire'],
    team: [['Fire'], ['Fire', 'Water']],
    lead: true,
    alone: false,
    hp: 0.2,
    foe: ['trainer', 'leader'],
    turn: 1,
    newSpecies: true,
    place: 'town',
    superEffective: false,
    noFaint: true,
    cat: 'H',
  };
  const yes = [
    'weather:rain',
    'weather:storm|rain',
    'type:Fire',
    'team:Water',
    'mono',
    'lead',
    'hp<0.25',
    'foe:leader',
    'foe:rival|trainer',
    'turn:1',
    'newSpecies',
    'place:town',
    'noFaint',
    'cat:H',
    'cat:H|S',
  ];
  const no = ['weather:storm', 'type:Water', 'team:Grass', 'notLead', 'alone', 'hp<0.2', 'foe:wild', 'turn:2'];
  for (const c of yes) assert.equal(E.fxCond(c, ctx), true, c);
  for (const c of no) assert.equal(E.fxCond(c, ctx), false, c);
  assert.equal(E.fxCond('superEffective', ctx), false);
  assert.equal(E.fxCond('mono', { team: [['Fire'], ['Water']] }), false);
  assert.equal(E.fxCond('notLead', {}), false, 'not known: false');
  for (const c of [...yes, 'notLead', 'alone', 'superEffective', 'nonsense', 'nonsense:1'])
    assert.equal(E.fxCond(c, {}), false, `${c} with nothing known`);
  /* a list: all must hold */
  assert.equal(E.fxLive(row({ kind: 'heal', share: 0.1, if: ['lead', 'turn:1'] }), ctx, {}), true);
  assert.equal(E.fxLive(row({ kind: 'heal', share: 0.1, if: ['lead', 'turn:2'] }), ctx, {}), false);
});

test('effects when: a row of a moment acts only at that moment; rows without when are read at their point', () => {
  const fx = [
    row({ kind: 'stat', stat: 'lev', stages: 1, when: 'ko' }),
    row({ kind: 'stat', stat: 'hus', stages: 1 }, 'y'),
  ];
  assert.deepEqual(
    E.fxAt(fx, {}, {}).map(f => f.stat),
    ['hus']
  );
  assert.deepEqual(E.fxFire(fx, 'hit', {}, { run: {} }), []);
  assert.deepEqual(
    E.fxFire(fx, 'ko', {}, { run: {} }).map(f => f.stat),
    ['lev']
  );
  assert.deepEqual(E.fxFire(fx, 'ko', {}, { run: {} }, 'y'), [], 'only one source');
});

test('effects when: every N acts on the Nth coming and starts again; the count lasts the run', () => {
  const run = {},
    fx = [row({ kind: 'heal', share: 0.1, when: 'arrive', every: 3 })],
    got = [];
  for (let i = 1; i <= 7; i++) got.push(E.fxFire(fx, 'arrive', {}, { run }).length);
  assert.deepEqual(got, [0, 0, 1, 0, 0, 1, 0]);
  assert.deepEqual(run, { 'x/0': { n: 1 } });
  /* a peek says whether the next one acts, and counts nothing */
  assert.equal(E.fxPeek(fx, 'arrive', {}, { run }).length, 0);
  run['x/0'].n = 2;
  assert.equal(E.fxPeek(fx, 'arrive', {}, { run }).length, 1);
  assert.equal(run['x/0'].n, 2);
  /* a condition that fails doesn't count */
  const c = [row({ kind: 'heal', share: 0.1, when: 'arrive', every: 2, if: 'place:town' })],
    r2 = {};
  E.fxFire(c, 'arrive', { place: 'route' }, { run: r2 });
  assert.deepEqual(r2, {});
});

test('effects when: grow builds on its moment up to its max, resets, and is added to the row’s number', () => {
  const run = {},
    f = row({ kind: 'damage', side: 'deal', mult: 1, grow: { on: 'win', by: 0.1, max: 0.25, reset: 'faint' } }),
    now = () => E.fxAt([f], {}, { run })[0].mult;
  assert.equal(now(), 1);
  E.fxFire([f], 'win', {}, { run });
  assert.equal(now(), 1.1);
  for (let i = 0; i < 5; i++) E.fxFire([f], 'win', {}, { run });
  assert.equal(now(), 1.25, 'capped');
  E.fxFire([f], 'faint', {}, { run });
  assert.equal(now(), 1, 'reset');
  /* grow's own condition */
  const g = row({ kind: 'damage', side: 'deal', mult: 1, grow: { on: 'win', by: 0.05, max: 0.25, if: 'noFaint' } });
  E.fxFire([g], 'win', { noFaint: false }, { run });
  assert.equal(E.fxAt([g], {}, { run })[0].mult, 1);
  E.fxFire([g], 'win', { noFaint: true }, { run });
  assert.equal(E.fxAt([g], {}, { run })[0].mult, 1.05);
  /* a negative growth stays between its max and 0; stages grow by whole stages */
  const t = row({ kind: 'damage', side: 'take', mult: 1, grow: { on: 'win', by: -0.2, max: -0.3 } }, 't');
  E.fxFire([t], 'win', {}, { run });
  E.fxFire([t], 'win', {}, { run });
  assert.equal(E.fxAt([t], {}, { run })[0].mult, 0.7);
  const s = row({ kind: 'stat', stat: 'lev', stages: 0, grow: { on: 'ko', by: 0.5, max: 3 } }, 's');
  E.fxFire([s], 'ko', {}, { run });
  assert.equal(E.fxAt([s], {}, { run })[0].stages, 0);
  E.fxFire([s], 'ko', {}, { run });
  assert.equal(E.fxAt([s], {}, { run })[0].stages, 1);
});

test('effects when: per teamTypes counts the number once for each type on the team', () => {
  const ctx = { team: [['Fire'], ['Fire', 'Water'], ['Grass']] };
  const m = E.fxAt([row({ kind: 'damage', side: 'deal', mult: 1.03, per: 'teamTypes' })], ctx, {})[0].mult;
  assert.ok(Math.abs(m - 1.09) < 1e-9, String(m));
  assert.equal(E.fxAt([row({ kind: 'heal', share: 0.05, per: 'teamTypes' })], ctx, {})[0].share, 0.15000000000000002);
  assert.equal(
    E.fxAt([row({ kind: 'damage', side: 'deal', mult: 1.5, per: 'teamTypes' })], {}, {})[0].mult,
    1,
    'no team'
  );
  assert.equal(
    E.fxAt([row({ kind: 'damage', side: 'take', mult: 0.5, per: 'teamTypes' })], ctx, {})[0].mult,
    E.FX_LIMIT.lo,
    'within FX_LIMIT'
  );
});

test('effects when: once a battle, once a run and once for each Billie', () => {
  const st = { run: {}, battle: {} },
    b = row({ kind: 'heal', share: 0.1, when: 'hurt', once: 'battle' }, 'b'),
    r = row({ kind: 'heal', share: 0.1, when: 'hurt', once: 'run' }, 'r'),
    p = row({ kind: 'heal', share: 0.1, when: 'hurt', once: 'billie' }, 'p'),
    fire = (uid, S = st) =>
      E.fxFire([b, r, p], 'hurt', { uid }, S)
        .map(f => f.src)
        .join(',');
  assert.equal(fire('u1'), 'b,r,p');
  assert.equal(fire('u1'), '');
  assert.equal(fire('u2'), 'p');
  /* a new battle: its own marks, the run's kept */
  assert.equal(fire('u1', { run: st.run, battle: {} }), 'b,p');
  assert.deepEqual(st.run, { 'r/0': { used: 1 } });
  /* a passive row with once is live until spent */
  const s = row({ kind: 'stat', stat: 'hus', stages: 1, once: 'billie' }, 's');
  assert.equal(E.fxAt([s], { uid: 'a' }, st).length, 1);
  E.fxSpend(s, { uid: 'a' }, st);
  assert.equal(E.fxAt([s], { uid: 'a' }, st).length, 0);
  assert.equal(E.fxAt([s], { uid: 'b' }, st).length, 1);
});

test('effects when: rows without the new fields read exactly as before; fxOfRun numbers only rows that keep state', () => {
  const plain = { kind: 'damage', side: 'deal', mult: 1.2, src: 'a' };
  assert.equal(E.fxAt([plain], {}, {})[0], plain, 'the same row');
  assert.equal(E.fxStateful([plain]), false);
  assert.equal(E.fxStateful([{ ...plain, once: 'run' }]), true);
  const perks = {
    a: {
      fx: [
        { kind: 'money', mult: 1.1 },
        { kind: 'heal', share: 0.1, when: 'arrive', every: 2 },
      ],
    },
  };
  const fx = E.fxOfRun({ perks: ['a'] }, perks);
  assert.equal(fx[0].row, undefined);
  assert.equal(fx[1].row, 1);
  assert.equal(E.fxKey(fx[1]), 'a/1');
  const run = {};
  assert.equal(E.fxRunMarks(run), run.perkState);
});
