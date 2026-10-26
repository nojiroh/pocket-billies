// SP-5: Augments (genes.json augment, logic/augments.js): robots.json arms and legs fitted on a Billie: the data and
// data-checks' rules for it.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, hooks, modules, startedSave } from './setup-real.mjs';

const C = modules['data-checks'];

test('augments: the game data passes dataGenes; planted Augment mistakes are named', () => {
  assert.deepEqual(C.dataGenes(GAME_DATA), []);
  const G = structuredClone(GAME_DATA.genes);
  G.augment.field.nope = 'surf';
  G.augment.field.hydrant = 'fly';
  G.augment.levels[1].maxUp = 0;
  G.augment.price.up = [1];
  const got = C.dataGenes({ ...GAME_DATA, genes: G }).map(p => p[1].split(':')[0]);
  assert.ok(got.includes('augment.field.nope'), got.join(' | '));
  assert.ok(got.includes('augment.field.hydrant'));
  assert.ok(got.includes('augment.levels[1]'));
  assert.ok(got.includes('augment.price.up'));
});

const A = modules.augments,
  N = modules.genes,
  R = GAME_DATA.robots,
  D = {
    kitBuilds: GAME_DATA.kitBuilds,
    partKits: GAME_DATA.partKits,
    genes: GAME_DATA.genes,
    species: data.SPECIES,
    parts: GAME_DATA.rules.parts,
    robots: R,
    robotRules: GAME_DATA.rules.robots,
  },
  part = (id, up = 0, uid = 'p-' + id) => ({ uid, id, up }),
  STATS = GAME_DATA.stats.map(s => s.id);

test('augments: an arm goes on the front, legs on the back; anything else is dropped', () => {
  assert.equal(A.augFits(D, 'swift0', 'front', 'hydrant'), true);
  assert.equal(A.augFits(D, 'swift0', 'back', 'treads'), true);
  assert.equal(A.augFits(D, 'swift0', 'front', 'treads'), false, 'legs are not an arm');
  assert.equal(A.augFits(D, 'swift0', 'sig', 'hydrant'), false, 'no Augment on a tail');
  assert.equal(A.augFits(D, 'swift0', 'front', 'bulwark'), false, 'a torso is no Augment');
  assert.deepEqual(A.augFit(D, 'swift0', { front: part('hydrant'), back: part('piston'), sig: part('treads') }), {
    front: part('hydrant'),
  });
  assert.equal(A.augFit(D, 'swift0', { front: { id: 'hydrant' } }), null, 'a part instance has a uid');
  assert.equal(A.augLimb(D, 'front'), 'armR', 'one arm, the right (the owner, 2026-10-26)');
  assert.equal(A.augLimb(D, 'back'), 'legs');
});

test('augments: Stability 3 each; weight, type, field move and stats from the part', () => {
  const S = D.genes.stability,
    a = { front: part('hydrant') };
  assert.equal(N.graftStability(D, 'swift0', null, undefined, a).cost, S.augment);
  assert.equal(
    N.graftStability(D, 'swift0', { sig: 'shark_tailfin@zuck2' }, undefined, a).cost,
    S.augment + S.other,
    'with a Gene'
  );
  /* the right arm's half of the front slot is the part's kg */
  const own = data.SPECIES.swift0.wt * GAME_DATA.rules.parts.share.front;
  assert.deepEqual(N.graftRel(D, 'swift0', null, a), { front: 0.5 + R.parts.hydrant.wt / own });
  assert.deepEqual(N.graftTypes(D, 'swift0', null, undefined, a), [data.SPECIES.swift0.types[0], 'Water']);
  assert.deepEqual(N.graftFields(D, 'swift0', null, a), ['surf']);
  assert.deepEqual(N.graftFields(D, 'swift0', null, { front: part('auger') }), ['smash']);
  assert.deepEqual(A.augMoves(D, 'swift0', a), [R.parts.hydrant.move]);
  const base = A.augBase(D, 'swift0', { front: part('hydrant', 2) }),
    f = D.genes.augment.statShare * (1 + D.robotRules.upgradeStat * 2);
  for (const [k, v] of Object.entries(R.parts.hydrant.stats)) assert.ok(Math.abs(base[k] - v * f) < 1e-9, k);
  assert.equal(A.augWords(D, 'hydrant'), 'a Hydrant Arm');
  assert.equal(A.augWords(D, 'auger'), 'an Auger Arm');
  assert.equal(A.augWords(D, 'treads'), 'Crawler Treads');
});

test('augments: on a Billie: its stats, types, field types and Stability; never Prime; Unstable past the limit', () => {
  const m = startedSave('swift0', 30).team[0],
    before = Object.fromEntries(STATS.map(k => [k, fn('stat')(m, k)]));
  m.aug = { front: part('hydrant') };
  assert.ok(fn('billyAug')(m));
  assert.equal(fn('billySpliceCost')(m), D.genes.stability.augment);
  assert.ok(fn('billyTypes')(m).includes('Water'));
  assert.ok(fn('billyFieldTypes')(m).includes('Water'));
  assert.equal(fn('billyPrime')(m), false);
  assert.ok(fn('stat')(m, 'lob') > before.lob, 'the arm adds its SpA');
  /* an Augment and a Gene past the limit: Unstable, named with the part's short name when it is the heaviest */
  fn('spliceSet')(m, { sig: 'shark_tailfin@zuck2' }, D.genes.stability.limit);
  assert.ok(m.unstable, 'Augment 3 + another kit 2 is past 3');
  assert.ok(m.unstable.name);
  /* a Gene on a slot the Augment holds doesn't count */
  m.graft = { front: 'bear_arm@musk3', sig: 'shark_tailfin@zuck2' };
  assert.deepEqual(fn('billyGraft')(m), { sig: 'shark_tailfin@zuck2' });
});

test('augments: kept through a save and load; saveFill trims and dedupes; billiesOk refuses a bad shape', () => {
  const { billiesOk } = modules.saves,
    fill = s => fn('saveFill')(JSON.parse(JSON.stringify(s))),
    s = startedSave('swift0', 10);
  s.parts = [part('hydrant', 0, 'u1'), part('treads', 0, 'u2')];
  s.team[0].aug = { front: part('hydrant', 9, 'u1'), back: part('nope', 0, 'u3') };
  const t = fill(s);
  assert.deepEqual(t.team[0].aug, { front: part('hydrant', GAME_DATA.rules.robots.maxUpgrade, 'u1') });
  assert.deepEqual(
    t.parts.map(p => p.uid),
    ['u2'],
    'a worn part is not a spare too'
  );
  s.team[0].aug = { front: part('treads', 0, 'u2') };
  assert.equal('aug' in fill(s).team[0], false, 'legs on the front: none left');
  assert.equal(billiesOk([{ ...s.team[0], aug: { front: 'hydrant' } }]), false);
  assert.equal(billiesOk([{ ...s.team[0], aug: { sig: part('hydrant') } }]), false);
  assert.equal(billiesOk([{ ...s.team[0], aug: { front: part('hydrant') } }]), true);
});

test('augments: in battle an Augment is a limb: its move beside the learned ones, lost when it breaks; repairs fix it', () => {
  const s = startedSave('swift0', 30),
    m = s.team[0];
  assert.equal(fn('limbsOf')(m), null, 'no Augment, no limbs');
  assert.deepEqual(fn('movesOf')(m), m.moves);
  m.aug = { front: part('hydrant'), back: part('treads') };
  assert.deepEqual(Object.keys(fn('limbsOf')(m)), ['armR', 'legs']);
  assert.deepEqual(fn('limbKeys')(m), ['armR', 'legs']);
  const moves = fn('movesOf')(m);
  assert.deepEqual(moves.slice(0, m.moves.length), m.moves);
  assert.ok(moves.includes(R.parts.hydrant.move) && moves.includes(R.parts.treads.move));
  assert.equal(fn('moveUsable')(m, R.parts.hydrant.move), true);
  m.partDmg = { armR: fn('partMaxHp')(m, 'armR') };
  assert.equal(fn('partBroken')(m, 'armR'), true);
  assert.deepEqual(fn('brokenParts')(m), ['armR']);
  assert.equal(fn('moveUsable')(m, R.parts.hydrant.move), false, 'the arm is broken');
  assert.equal(fn('moveUsable')(m, m.moves[0]), true, 'its own moves stay');
  assert.equal(fn('partsDamaged')(m), true);
  /* the town clinic's heal (healAll) and a repair kit fix it, as a robot's parts */
  fn('healAll')();
  assert.equal(fn('partBroken')(m, 'armR'), false);
  assert.equal(fn('partsDamaged')(m), false);
  m.partDmg = { legs: 5 };
  assert.equal(fn('repairParts')(m, 1), true);
  assert.equal(m.partDmg.legs, 0);
  /* broken legs slow it as a robot's do */
  delete m.aug;
  m.partDmg = { armR: 999 };
  assert.equal(fn('partBroken')(m, 'armR'), false, 'a part taken off is never broken');
});

test('augments: a hit on a Billie with an Augment lands on its body or the Augment, never on a robot slot it lacks', () => {
  const s = startedSave('swift0', 30),
    m = s.team[0];
  m.aug = { front: part('hydrant') };
  const foe = fn('makeBilly')('swift0', 30);
  fn('newBattle')('wild', [foe], { fmt: 'single', seed: 'aug-hit' });
  const hits = new Set();
  for (let i = 0; i < 60; i++) hits.add(fn('hitPart')(0, 1, { fx: {} }));
  assert.deepEqual([...hits].sort(), ['armR', 'torso']);
  /* an aimed move picks the Augment (whole again) */
  m.partDmg = {};
  assert.equal(fn('hitPart')(0, 1, { fx: { aim: 1 } }, 'armR'), 'armR');
  assert.equal(fn('hitPart')(0, 1, { fx: { aim: 1 } }, 'legs') !== 'legs', true);
  assert.ok(fn('actorSnapshot')(0).bot.ph.armR < 1, 'the snapshot shows the arm');
  hooks.provide({ activeBattle: null });
});

test('augments: the Workshop fits a spare for Scrap, takes it off for free, upgrades within its level', () => {
  const s = startedSave('swift0', 30),
    m = s.team[0],
    GD = fn('geneData')(),
    A = modules.augments,
    P = GAME_DATA.genes.augment.price;
  s.meta.scrap = 100;
  s.parts = [part('hydrant', 0, 'h1'), part('treads', 0, 't1'), part('auger', 0, 'a1')];
  assert.equal(A.workLevel(s), 1);
  assert.equal(A.workWhy(GD, s, m, 'back', 't1'), 'slot', 'legs from Lv 2');
  assert.equal(A.workWhy(GD, s, m, 'front', 't1'), 'fit');
  assert.equal(A.workWhy(GD, s, m, 'front', 'nope'), 'unknown');
  s.run = { seed: 'X' };
  assert.equal(A.workWhy(GD, s, m, 'front', 'h1'), 'run');
  s.run = null;
  /* a Gene on the slot comes off and stays in the library */
  m.graft = { front: 'bear_arm@musk3' };
  s.meta.genes = [];
  assert.equal(A.workFit(GD, s, m, 'front', 'h1'), '');
  assert.equal(s.meta.scrap, 100 - P.fit);
  assert.deepEqual(m.aug, { front: part('hydrant', 0, 'h1') });
  assert.equal(m.graft, undefined);
  assert.deepEqual(s.meta.genes, ['bear_arm@musk3']);
  assert.deepEqual(
    s.parts.map(p => p.uid),
    ['t1', 'a1']
  );
  /* a swap puts the old part back */
  m.partDmg = { armR: 5 };
  assert.equal(A.workFit(GD, s, m, 'front', 'a1'), '');
  assert.equal(m.aug.front.id, 'auger');
  assert.equal(m.partDmg, undefined, 'the new arm is whole');
  assert.deepEqual(s.parts.map(p => p.uid).sort(), ['h1', 't1']);
  /* upgrades: Lv 1 goes to its maxUp, then 'max'; Scrap paid */
  const max1 = GAME_DATA.genes.augment.levels[0].maxUp;
  for (let i = 0; i < max1; i++) assert.equal(A.workUpgrade(GD, s, m, 'front'), '');
  assert.equal(m.aug.front.up, max1);
  assert.equal(A.workUpWhy(GD, s, m, 'front'), 'max');
  s.meta.buildings = { ...(s.meta.buildings || {}), workshop: 2 };
  assert.equal(A.workUpWhy(GD, s, m, 'front'), '');
  s.meta.scrap = 0;
  assert.equal(A.workUpWhy(GD, s, m, 'front'), 'scrap');
  /* take off: free, back to the spares */
  assert.equal(A.workOff(GD, s, m, 'front'), '');
  assert.equal(m.aug, undefined);
  assert.ok(s.parts.some(p => p.uid === 'a1' && p.up === max1));
  assert.equal(A.workOff(GD, s, m, 'front'), 'none');
});

test('augments: the look code carries the Augments after the graft; split back; a Billie without one looks as before', () => {
  const G = modules['graft-art'];
  assert.equal(G.graftLook({ graft: { sig: 'shark_tailfin@zuck2' } }), 'sig=shark_tailfin@zuck2');
  assert.equal(G.graftLook({}), '');
  const code = G.graftLook({
    graft: { sig: 'shark_tailfin@zuck2' },
    aug: { front: part('hydrant'), back: part('treads') },
  });
  assert.equal(code, 'sig=shark_tailfin@zuck2,+back=treads,+front=hydrant');
  assert.deepEqual(G.graftLookSplit(code), {
    graft: 'sig=shark_tailfin@zuck2',
    aug: { back: 'treads', front: 'hydrant' },
  });
  assert.deepEqual(G.graftLookSplit('+front=auger'), { graft: '', aug: { front: 'auger' } });
  assert.deepEqual(G.graftLookSplit('front=bear_arm@musk3'), { graft: 'front=bear_arm@musk3', aug: null });
  assert.equal(
    G.graftOf({ graft: { sig: 'shark_tailfin@zuck2' }, aug: { front: part('hydrant') } }),
    'sig=shark_tailfin@zuck2',
    'the splice code stays'
  );
});

test('augments: Escaped specimens: a band after the Grafts and Chimeras (their draws unchanged), likelier near a yard', () => {
  const pool = Object.keys(data.SPECIES),
    seq = xs => {
      let i = 0;
      return () => xs[i++ % xs.length];
    },
    W = D.genes.wild;
  /* a first draw in the Graft band: the same Graft wildSplice gives */
  const g1 = N.wildSplice(D, 'swift0', pool, seq([0.01, 0.3, 0.6])),
    r1 = N.wildRoll(D, 'swift0', pool, seq([0.01, 0.3, 0.6]));
  assert.deepEqual(r1, { graft: g1 });
  /* just past the Chimeras: an Escaped specimen, one Augment that fits */
  const x = W.graft + W.chimera + W.escaped / 2,
    r2 = N.wildRoll(D, 'swift0', pool, seq([x, 0]));
  assert.ok(r2 && r2.aug && !r2.graft, JSON.stringify(r2));
  const [[slot, p]] = Object.entries(r2.aug);
  assert.equal(A.augFits(D, 'swift0', slot, p.id), true);
  /* past the band: plain, unless next to a scrapyard (escapedNear) */
  const y = W.graft + W.chimera + W.escaped * 1.5;
  assert.equal(N.wildRoll(D, 'swift0', pool, seq([y, 0])), null);
  assert.ok(N.wildRoll(D, 'swift0', pool, seq([y, 0]), 1, D.genes.augment.escapedNear).aug);
  /* next to a scrapyard: a road either way */
  const run = {
    map: {
      nodes: [
        { type: 'route', to: [1] },
        { type: 'scrapyard', to: [2] },
        { type: 'town', to: [] },
        { type: 'town', to: [] },
      ],
    },
  };
  assert.equal(fn('runNearYard')(run, 0), true);
  assert.equal(fn('runNearYard')(run, 2), true);
  assert.equal(fn('runNearYard')(run, 3), false);
});

test('augments: an Escaped specimen in battle says so; knocked out it leaves DNA and its part', () => {
  const s = startedSave('swift0', 30),
    q = { id: 'esc-1', sp: 'swift0', lvl: 5, no: 1, aug: { front: { uid: '', id: 'hydrant', up: 0 } } };
  fn('encountersHere')().push(q);
  fn('startWild')(q);
  const B = hooks.activeBattle,
    foe = B.sides[1].team[0],
    said = B.events.map(e => e.t || '').join('\n');
  assert.match(said, /has a Hydrant Arm!/);
  assert.match(said, /escaped/);
  assert.ok(foe.aug.front.uid, 'a part of its own');
  hooks.provide({ activeBattle: null });
  const parts = s.parts.length,
    dna = s.meta.dna || 0,
    out = modules['battle-rewards'].spliceSample([foe], s, null);
  assert.equal(out.dna, GAME_DATA.genes.wild.dna.escaped);
  assert.equal(s.meta.dna, dna + out.dna);
  assert.equal(s.parts.length, parts + 1);
  assert.equal(s.parts[s.parts.length - 1].id, 'hydrant');
  assert.deepEqual(out.parts, [{ id: 'hydrant', words: 'a Hydrant Arm' }]);
});
