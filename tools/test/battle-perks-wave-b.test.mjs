// PK-4: Wave B's effect kinds in battle (perks-track.md 5.3 and section 7): passive (each type passive made stronger
// for yours), weather and benchXp, each with test-only Perks first; then the 15 Wave B Perks of perks.json, each
// working, and a battle holding every Wave A and Wave B Perk at once staying finite.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, modules, reseed, said, startedSave } from './setup-real.mjs';

const { SPECIES } = data;
/** a species of type T (one of that type alone when there is one) */
const ofType = T => {
  const ids = Object.keys(SPECIES).filter(k => (SPECIES[k].types || []).includes(T));
  return ids.find(k => SPECIES[k].types.length === 1) || ids[0];
};
/** a species of none of these types */
const notOf = (...T) => Object.keys(SPECIES).find(k => !(SPECIES[k].types || []).some(t => T.includes(t)));

beforeEach(() => {
  hooks.provide({ activeBattle: null });
  said.length = 0;
});

/** rows of made-up Perks, as fxOfRun gives them (test-only: never in perks.json) */
const perks = (...defs) => {
  const P = Object.fromEntries(defs.map((d, i) => [d.id || 'test' + i, { name: d.name || 'Test ' + i, ...d }]));
  return { P, fx: fn('fxOfRun')({ perks: Object.keys(P) }, P) };
};
/** a seeded wild battle with a team of these species (the first leads), holding these rows; extra laid over */
function battle(fx, team, extra = {}, lvl = 20, foeSp = notOf('Dragon')) {
  reseed(7);
  const s = startedSave(team[0], lvl);
  for (const sp of team.slice(1)) s.team.push(fn('makeBilly')(sp, lvl));
  const foe = fn('makeBilly')(foeSp, lvl);
  assert.ok(fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'perk-test-b', ...(fx ? { fx } : {}), ...extra }));
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
/** a damaging move of a type (any category) that never misses and does nothing else */
const moveOf = (T, cat) =>
  Object.keys(data.MOVES).find(id => {
    const M = data.MOVES[id];
    return (
      M.p > 0 &&
      M.c !== 'X' &&
      M.t === T &&
      (!cat || M.c === cat) &&
      (!M.a || M.a >= 100) &&
      !M.pr &&
      !(M.fx && Object.keys(M.fx).length)
    );
  });
/** the battle's stream, giving these values in turn (the last again when they run out) while `run` runs */
const rolls = (b, vs, run) => {
  const rng = b.rng,
    L = [].concat(vs);
  b.rng = () => (L.length > 1 ? L.shift() : L[0]);
  try {
    return run();
  } finally {
    b.rng = rng;
  }
};
const foe = b => b.sides[1].team[0];
const mine = b => b.sides[0].team[0];
const tough = m => {
  m.hp = 99999;
  return m;
};
/** a hit's damage from k on tk with the stream held */
const dmg = (b, k, tk, mid, vs = [0.99, 0.5]) => rolls(b, vs, () => fn('calcDamage')(k, tk, mid).dmg);

/* ---------- passive ---------- */

test('PK-4 passive kindling: yours build Kindling `rate` times as fast, to the same top; the foe’s as before', () => {
  const { P, fx } = perks({ id: 'test_bellows', fx: [{ kind: 'passive', passive: 'kindling', rate: 2 }] });
  const R = data.RULES.battle,
    fire = ofType('Fire');
  withPerks(P, () => {
    const at = (fxOn, turns) => {
      const b = battle(fxOn ? fx : null, [fire], {}, 20, fire);
      fn('fieldState')(0).turnsIn = turns;
      fn('fieldState')(1).turnsIn = turns;
      fn('fieldState')(0).st = {};
      fn('fieldState')(1).st = {};
      return [fn('effectiveStat')(0, 'lev'), fn('effectiveStat')(1, 'lev'), fn('stat')(mine(b), 'lev')];
    };
    const [a3, f3, base] = at(true, 3),
      [n3, g3] = at(false, 3);
    assert.ok(Math.abs(a3 - base * (1 + R.kindlingBoost * 6)) < 1e-9, `${a3} ${base}`);
    assert.ok(Math.abs(n3 - base * (1 + R.kindlingBoost * 3)) < 1e-9);
    assert.equal(f3, g3, 'the foe’s Kindling is the same with or without');
    const [aTop] = at(true, R.kindlingTurns - 1);
    assert.ok(Math.abs(aTop - base * (1 + R.kindlingBoost * R.kindlingTurns)) < 1e-9, 'the same top');
  });
});

test('PK-4 passive undertow: yours get Undertow from `hp` of their HP; not above it, and not without the row', () => {
  const { P, fx } = perks({ id: 'test_snorkel', fx: [{ kind: 'passive', passive: 'undertow', hp: 0.5 }] });
  const water = ofType('Water'),
    mid = moveOf('Water');
  assert.ok(mid, 'a plain Water move');
  withPerks(P, () => {
    const hit = (fxOn, share) => {
      const b = battle(fxOn ? fx : null, [water]);
      tough(foe(b));
      mine(b).hp = Math.floor(fn('maxHp')(mine(b)) * share);
      return dmg(b, 0, 1, mid);
    };
    const R = data.RULES.battle;
    assert.ok(hit(true, 0.45) > hit(false, 0.45), 'at 45%: with the row');
    assert.ok(Math.abs(hit(true, 0.45) / hit(false, 0.45) - R.undertowMult) < 0.05);
    assert.equal(hit(true, 0.6), hit(false, 0.6), 'at 60%: neither');
    assert.equal(hit(true, 0.2), hit(false, 0.2), 'at 20%: both, the same');
  });
});

test('PK-4 passive regrowth: yours heal `mult` times as much at a turn’s end', () => {
  const { P, fx } = perks({ id: 'test_can', fx: [{ kind: 'passive', passive: 'regrowth', mult: 2 }] });
  const grass = ofType('Grass');
  withPerks(P, () => {
    const gain = fxOn => {
      const b = battle(fxOn ? fx : null, [grass], {}, 40);
      const m = mine(b);
      m.hp = Math.floor(fn('maxHp')(m) / 2);
      const was = m.hp;
      fn('endTurn')();
      return m.hp - was;
    };
    const a = gain(true),
      n = gain(false);
    assert.ok(n > 0);
    assert.ok(a >= 2 * n - 1 && a <= 2 * n + 1, `${a} vs ${n}`);
  });
});

test('PK-4 passive livewire: yours land critical hits at twice Live Wire’s stages', () => {
  const { P, fx } = perks({ id: 'test_socks', fx: [{ kind: 'passive', passive: 'livewire', mult: 2 }] });
  const C = data.RULES.battle.critChances,
    elec = ofType('Electric'),
    mid = moveOf('None') || moveOf('Electric');
  /* a roll that misses Live Wire's stage 1 but lands at stage 2 */
  const at = (C[1] + C[2]) / 2;
  withPerks(P, () => {
    const crit = fxOn => {
      const b = battle(fxOn ? fx : null, [elec], {}, 20, elec);
      return rolls(b, [at, 0.5], () => [fn('calcDamage')(0, 1, mid).crit, fn('calcDamage')(1, 0, mid).crit]);
    };
    assert.deepEqual(crit(true), [true, false], 'yours at stage 2, the foe’s Live Wire at stage 1');
    assert.deepEqual(crit(false), [false, false]);
  });
});

test('PK-4 passive bedrock: yours hold on `uses` times a battle and from `hp` of their HP', () => {
  const { P, fx } = perks({ id: 'test_pads', fx: [{ kind: 'passive', passive: 'bedrock', uses: 2, hp: 0.75 }] });
  const ground = ofType('Ground');
  withPerks(P, () => {
    const b = battle(fx, [ground]),
      m = mine(b),
      mx = fn('maxHp')(m),
      holds = share => {
        m.hp = Math.ceil(mx * share);
        const r = { dmg: 99999 };
        return fn('bedrockHolds')(0, r) && r.dmg === m.hp - 1;
      };
    assert.equal(holds(0.7), false, 'under 75%: no');
    assert.equal(holds(0.8), true, 'from 75%');
    assert.equal(holds(1), true, 'a second time');
    assert.equal(holds(1), false, 'not a third');
    /* without the row: once, from full HP only */
    const n = battle(null, [ground]),
      q = mine(n),
      qx = fn('maxHp')(q);
    q.hp = Math.ceil(qx * 0.8);
    assert.equal(fn('bedrockHolds')(0, { dmg: 99999 }), false);
    q.hp = qx;
    assert.equal(fn('bedrockHolds')(0, { dmg: 99999 }), true);
    q.hp = qx;
    assert.equal(fn('bedrockHolds')(0, { dmg: 99999 }), false);
  });
});

test('PK-4 passive slipstream: with always, every switch of yours is free, not only the first', () => {
  const { P, fx } = perks({ id: 'test_kite', fx: [{ kind: 'passive', passive: 'slipstream', always: true }] });
  const fly = ofType('Flying');
  withPerks(P, () => {
    const frees = fxOn => {
      const b = battle(fxOn ? fx : null, [fly, fly]);
      tough(foe(b));
      tough(mine(b));
      tough(b.sides[0].team[1]);
      const out = [];
      for (const i of [1, 0, 1]) {
        fn('runTurn')([{ who: 0, k: 'switch', i }], b);
        out.push(lines(b).some(t => t.includes('without losing the turn')));
      }
      return out;
    };
    assert.deepEqual(frees(true), [true, true, true]);
    assert.deepEqual(frees(false), [true, false, false]);
  });
});

test('PK-4 passive wildmind: yours roll Wild Mind `rolls` times and keep the best; the foe’s once', () => {
  const { P, fx } = perks({ id: 'test_ring', fx: [{ kind: 'passive', passive: 'wildmind', rolls: 2 }] });
  const psy = ofType('Psychic'),
    mid = moveOf('Psychic');
  assert.ok(mid, 'a plain Psychic move');
  withPerks(P, () => {
    const hit = (fxOn, k, tk) => {
      const b = battle(fxOn ? fx : null, [psy], {}, 20, psy);
      tough(foe(b));
      tough(mine(b));
      /* no crit, a low roll, then a high one */
      return dmg(b, k, tk, mid, [0.99, 0.05, 0.95, 0.5]);
    };
    assert.ok(hit(true, 0, 1) > hit(false, 0, 1), 'yours keep the high roll');
    assert.equal(hit(true, 1, 0), hit(false, 1, 0), 'the foe’s single roll');
  });
});

test('PK-4 passive alloy: with all, yours count every teammate on its feet, not only Steel ones', () => {
  const { P, fx } = perks({ id: 'test_card', fx: [{ kind: 'passive', passive: 'alloy', all: true }] });
  const steel = ofType('Steel'),
    other = notOf('Steel'),
    mid = moveOf('None') || moveOf('Steel');
  withPerks(P, () => {
    const hit = fxOn => {
      const b = battle(fxOn ? fx : null, [steel, other, other]);
      tough(foe(b));
      b.sides[0].team[2].hp = 0;
      return dmg(b, 0, 1, mid);
    };
    const a = hit(true),
      n = hit(false);
    assert.ok(Math.abs(a / n - (1 + data.RULES.battle.alloyBoost)) < 0.05, `${a} ${n}`);
  });
});

test('PK-4 passive partingroar: the teammate who comes in after yours faints also gets the row’s stages', () => {
  const { P, fx } = perks({
    id: 'test_locket',
    fx: [{ kind: 'passive', passive: 'partingroar', stat: 'hus', stages: 1 }],
  });
  const dragon = ofType('Dragon');
  assert.ok(dragon, 'a Dragon species');
  withPerks(P, () => {
    const after = fxOn => {
      const b = battle(fxOn ? fx : null, [dragon, dragon]);
      fn('inherit')(0);
      fn('doSwitch')(0, 1);
      return { ...fn('fieldState')(0).st };
    };
    const a = after(true),
      n = after(false);
    assert.equal(a.lev, n.lev);
    assert.equal(a.lob, n.lob);
    assert.equal((a.hus || 0) - (n.hus || 0), 1);
  });
});

test('PK-4 passive: a row for a passive yours don’t have changes nothing; merged rows keep the strongest', () => {
  const F = modules.effects.fxPassive;
  assert.equal(F(null, 'kindling'), null);
  assert.deepEqual(
    F(
      [
        { kind: 'passive', passive: 'bedrock', uses: 2, src: 'a' },
        { kind: 'passive', passive: 'bedrock', hp: 0.75, uses: 1, src: 'b' },
        { kind: 'passive', passive: 'bedrock', hp: 0.5, src: 'c' },
      ],
      'bedrock'
    ),
    { uses: 2, hp: 0.5 }
  );
  assert.deepEqual(
    F(
      [
        { kind: 'passive', passive: 'partingroar', stat: 'hus', stages: 1, src: 'a' },
        { kind: 'passive', passive: 'partingroar', stat: 'hus', stages: 1, src: 'b' },
      ],
      'partingroar'
    ),
    { up: { hus: 2 } }
  );
  const { P, fx } = perks({ id: 'test_bellows', fx: [{ kind: 'passive', passive: 'kindling', rate: 2 }] });
  withPerks(P, () => {
    const water = ofType('Water'),
      b = battle(fx, [water]);
    fn('fieldState')(0).turnsIn = 3;
    const a = fn('effectiveStat')(0, 'lev');
    battle(null, [water]);
    fn('fieldState')(0).turnsIn = 3;
    assert.equal(a, fn('effectiveStat')(0, 'lev'), 'a Water Billie has no Kindling to build');
    assert.ok(b);
  });
});

/* ---------- weather ---------- */

/** a battle whose weather weakens Fire (x0.5) and boosts Water (x1.3) */
const wet = (fx, team) => {
  const b = battle(fx, team);
  b.host = { ...modules['battle-engine'].SILENT_HOST, weather: t => ({ Fire: 0.5, Water: 1.3 })[t] || 1 };
  return b;
};

test('PK-4 weather noWeaken: the weather never weakens yours’ moves; the foe’s still are; boosts stay', () => {
  const { P, fx } = perks({ id: 'test_brolly', fx: [{ kind: 'weather', what: 'noWeaken' }] });
  const fire = ofType('Fire'),
    mid = moveOf('Fire');
  withPerks(P, () => {
    wet(fx, [fire]);
    assert.equal(fn('fxWeatherFor')(0, 'Fire'), 1);
    assert.equal(fn('fxWeatherFor')(1, 'Fire'), 0.5, 'the foe’s');
    assert.equal(fn('fxWeatherFor')(0, 'Water'), 1.3, 'a boost is kept');
    const b = wet(fx, [fire]);
    tough(foe(b));
    const a = dmg(b, 0, 1, mid);
    const n = wet(null, [fire]);
    tough(foe(n));
    assert.ok(a > dmg(n, 0, 1, mid), 'more than in the rain without it');
    n.host = modules['battle-engine'].SILENT_HOST;
    assert.equal(a, dmg(n, 0, 1, mid), 'as in no weather');
  });
});

test('PK-4 weather boost: the weather’s boosts to yours count `mult` times over; weakening and the foe’s unchanged', () => {
  const { P, fx } = perks({ id: 'test_globe', fx: [{ kind: 'weather', what: 'boost', mult: 2 }] });
  withPerks(P, () => {
    wet(fx, [ofType('Water')]);
    assert.ok(Math.abs(fn('fxWeatherFor')(0, 'Water') - 1.6) < 1e-9);
    assert.equal(fn('fxWeatherFor')(1, 'Water'), 1.3);
    assert.equal(fn('fxWeatherFor')(0, 'Fire'), 0.5);
    assert.equal(fn('fxWeatherFor')(0, 'Grass'), 1);
  });
  /* both rows: no weakening, boosts doubled */
  assert.equal(
    modules.effects.fxWeather(
      [
        { kind: 'weather', what: 'noWeaken', src: 'a' },
        { kind: 'weather', what: 'boost', mult: 2, src: 'b' },
      ],
      0.7
    ),
    1
  );
  assert.equal(modules.effects.fxWeather(null, 0.7), 0.7);
});

/* ---------- benchXp ---------- */

test('PK-4 benchXp: yours who sat out get the row’s share of a foe’s XP more, at most all of it', () => {
  const { P, fx } = perks({ id: 'test_chat', fx: [{ kind: 'benchXp', share: 0.5 }] });
  const sp = ofType('Water'),
    T = data.RULES.progression.teamXpShare;
  withPerks(P, () => {
    const got = fxOn => {
      const b = battle(fxOn ? fx : null, [sp, sp, sp], {}, 10, sp);
      const bench = b.sides[0].team[1],
        out = b.sides[0].team[2],
        lead = mine(b),
        w = [bench.xp, out.xp, lead.xp];
      out.hp = 0;
      foe(b).hp = 0;
      fn('award')(foe(b));
      return [bench.xp - w[0], out.xp - w[1], lead.xp - w[2]];
    };
    const [ab, ao, al] = got(true),
      [nb, , nl] = got(false);
    assert.equal(al, nl, 'the one who fought: the same');
    assert.ok(Math.abs(nb - Math.floor(nl * T)) <= 1, `the bench without the row: ${nb} of ${nl}`);
    assert.ok(Math.abs(ab - Math.floor(nl * Math.min(1, T + 0.5))) <= 1, `with it: ${ab} of ${nl}`);
    assert.equal(ao, 0, 'a fainted one gets none');
  });
  assert.equal(
    modules.effects.fxBenchXp([
      { kind: 'benchXp', share: 0.75, src: 'a' },
      { kind: 'benchXp', share: 0.75, src: 'b' },
    ]),
    1
  );
});
