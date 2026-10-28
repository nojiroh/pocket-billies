// PK-1: a run's Perks in battle with the effects core (perks-track.md section 7): stat rows for every Billie of yours
// that takes the field (the switch-in fix), the moments rows act at, their conditions, counters and once marks,
// the run's turnHeal, pinchHeal and turnHurt rows, and a Perk's line. Test-only Perks: perks.json is not changed.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, said, startedSave } from './setup-real.mjs';

const { RULES, SPECIES } = data;
const starter = () => Object.keys(SPECIES).find(k => SPECIES[k].line === RULES.start.starters[0]);
const wild = () =>
  Object.keys(SPECIES).find(k => SPECIES[k].stage === 0 && !RULES.start.starters.includes(SPECIES[k].line));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of `n`, holding these rows; extra laid over */
function battle(fx, extra = {}, n = 2, lvl = 12) {
  reseed(7);
  const s = startedSave(starter(), lvl);
  while (s.team.length < n) s.team.push(fn('makeBilly')(starter(), lvl));
  const foe = fn('makeBilly')(wild(), lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test', ...(fx ? { fx } : {}), ...extra }));
  return hooks.activeBattle;
}
const lines = b => b.events.map(e => e.t || '').filter(Boolean);
const withPerks = (P, run) => {
  const old = { ...data.PERKS };
  Object.assign(data.PERKS, P);
  try {
    return run();
  } finally {
    for (const k of Object.keys(P)) if (!(k in old)) delete data.PERKS[k];
  }
};

test('PK-1 switch in: a Perk’s stat rows reach a Billie that comes in, with a line; the foe’s don’t', () => {
  const { P, fx } = perks({ id: 'test_shoes', name: 'Test Shoes', fx: [{ kind: 'stat', stat: 'hus', stages: 1 }] });
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(b.sides[0].f[0].v.st.hus, 1, 'the lead, at the start');
    fn('sayBattleFx')();
    assert.ok(
      lines(b).some(t => /^Test Shoes: .*Speed rose\.$/.test(t)),
      lines(b).join('\n')
    );
    b.events.length = 0;
    fn('doSwitch')(0, 1);
    assert.equal(b.sides[0].f[0].act, 1);
    assert.equal(b.sides[0].f[0].v.st.hus, 1, 'the one that came in');
    assert.ok(
      lines(b).some(t => /^Test Shoes: .*Speed rose\.$/.test(t)),
      lines(b).join('\n')
    );
    /* the foe coming in gets none */
    b.sides[1].team.push(fn('makeBilly')(wild(), 12));
    fn('doSwitch')(1, 1);
    assert.equal(b.sides[1].f[0].v.st.hus, 0);
  });
  /* without Perks: nothing on a switch */
  const none = battle(null);
  fn('doSwitch')(0, 1);
  assert.equal(none.sides[0].f[0].v.st.hus, 0);
  assert.equal(none.fxState, undefined, 'no marks made');
});

test('PK-1 switch in: a stat row’s condition is the Billie’s own, and once: billie gives each one once', () => {
  const { P, fx } = perks(
    { id: 'test_crown', fx: [{ kind: 'stat', stat: 'lev', stages: 2, if: 'lead' }] },
    { id: 'test_once', fx: [{ kind: 'stat', stat: 'law', stages: 1, once: 'billie' }] }
  );
  withPerks(P, () => {
    const b = battle(fx);
    assert.equal(b.sides[0].f[0].v.st.lev, 2, 'the lead');
    assert.equal(b.sides[0].f[0].v.st.law, 1);
    fn('doSwitch')(0, 1);
    /* still in the lead's place: actor 0 leads whoever stands there */
    assert.equal(b.sides[0].f[0].v.st.lev, 2);
    assert.equal(b.sides[0].f[0].v.st.law, 1, 'its first time in');
    fn('doSwitch')(0, 0);
    assert.equal(b.sides[0].f[0].v.st.law, 0, 'the first one again: spent');
  });
});

test('PK-1 turn end: the run’s turnHeal, pinchHeal and turnHurt rows act on yours on the field, not the foe', () => {
  const { P, fx } = perks(
    { id: 'test_tea', name: 'Test Tea', fx: [{ kind: 'turnHeal', share: 0.1 }] },
    { id: 'test_bank', name: 'Test Bank', fx: [{ kind: 'pinchHeal', at: 0.25, share: 0.5 }] },
    { id: 'test_thorn', name: 'Test Thorn', fx: [{ kind: 'turnHurt', share: 0.05, if: 'turn:3' }] }
  );
  withPerks(P, () => {
    const b = battle(fx),
      m = b.sides[0].team[0],
      e = b.sides[1].team[0],
      mx = fn('maxHp')(m);
    m.hp = Math.floor(mx / 2);
    e.hp = Math.floor(fn('maxHp')(e) / 2);
    const foeHp = e.hp;
    b.turn = 1;
    fn('endTurn')();
    assert.equal(m.hp, Math.floor(mx / 2) + Math.max(1, Math.floor(mx * 0.1)), 'turnHeal');
    assert.equal(e.hp, foeHp, 'not the foe');
    assert.ok(lines(b).some(t => /^Test Tea: .* restored a little HP\.$/.test(t)));
    /* low: the pinch heal, once for this Billie in this battle */
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp > Math.floor(mx * 0.5), `pinch: ${m.hp}`);
    assert.ok(lines(b).some(t => /^Test Bank: .* restored HP\.$/.test(t)));
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp < mx * 0.25, 'spent for this Billie');
    /* turnHurt on turn 3 only */
    m.hp = mx;
    b.turn = 3;
    fn('endTurn')();
    assert.equal(m.hp, mx - Math.max(1, Math.floor(mx * 0.05)));
    assert.ok(lines(b).some(t => /^Test Thorn: .* lost a little HP\.$/.test(t)));
  });
});

test('PK-1 turn end: pinchHeal with once: battle heals one of yours once in the battle', () => {
  const { P, fx } = perks({ id: 'test_bank', fx: [{ kind: 'pinchHeal', at: 0.25, share: 0.25, once: 'battle' }] });
  withPerks(P, () => {
    const b = battle(fx),
      m = b.sides[0].team[0];
    m.hp = 1;
    fn('endTurn')();
    assert.ok(m.hp > 1);
    fn('doSwitch')(0, 1);
    const n = b.sides[0].team[1];
    n.hp = 1;
    fn('endTurn')();
    assert.equal(n.hp, 1, 'spent for the battle');
  });
});
