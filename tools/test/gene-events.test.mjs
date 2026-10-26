// SP-6: a run's splice events (logic/gene-events.js): the back-alley splicer's Gene, the Bureau field lab's offers,
// a splice during a run (DNA, the library, Unstable at your limit), the auction's Gene and the recall.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { modules, startedSave } from './setup-real.mjs';

const G = modules['gene-events'],
  R = modules.rules,
  /** a stream of numbers, for draws: the same every time */
  seq = (/** @type {number[]} */ ...v) => {
    let i = 0;
    return () => v[i++ % v.length];
  };

test('gene events: the back alley draws a fitting Gene of the region’s lines, never one worn or refused', () => {
  const D = R.geneData(),
    s = startedSave('swift0', 20),
    m = s.team[0],
    pool = ['zuck0', 'zuck1'],
    L = G.geneEventWildList(D, m, pool, 3);
  assert.ok(L.length > 0);
  for (const o of L) {
    assert.ok(G.geneEventSlots(D, m).includes(o.slot), o.slot);
    assert.equal(D.species[modules.genes.geneOf(D, o.slot, o.id).sp].line, 'zuck', o.id);
  }
  const a = G.geneEventWild(D, m, pool, 3, seq(0.3, 0.6)),
    b = G.geneEventWild(D, m, pool, 3, seq(0.3, 0.6));
  assert.deepEqual(a, b, 'the same draws, the same Gene');
  /* no line of the region fits: every donor's Genes */
  assert.ok(G.geneEventWildList(D, m, ['nosuch0'], 3).length > L.length);
  /* worn: not offered again on that slot */
  m.graft = { [a.slot]: a.id };
  assert.ok(!G.geneEventWildList(D, m, pool, 3).some(o => o.slot === a.slot && o.id === a.id));
});

test('gene events: a splice during a run pays its DNA, adds the Gene to the library and settles Unstable', () => {
  const D = R.geneData(),
    s = startedSave('swift0', 20),
    m = s.team[0],
    tail = 'shark_tailfin@zuck2';
  s.meta.dna = 5;
  s.meta.genes = [];
  s.run = { id: 'x' };
  assert.equal(G.geneEventSplice(D, s, m, 'sig', tail, seq(0.5), 8), true);
  assert.equal(s.meta.dna, 0, 'never below 0');
  assert.deepEqual(m.graft, { sig: tail });
  assert.deepEqual(s.meta.genes, [tail]);
  assert.equal(G.geneEventLearn(s, tail), false, 'once');
  /* far Genes on every slot past the limit: Unstable, from the stream */
  const far = G.geneEventWildList(D, m, [], 3).filter(o => o.slot !== 'sig');
  for (const slot of ['front', 'back']) {
    const o = far.find(x => x.slot === slot);
    if (o) G.geneEventSplice(D, s, m, o.slot, o.id, seq(0.1, 0.9));
  }
  const st = modules.genes.graftStability(D, m.sp, m.graft, R.geneLimit(s));
  assert.equal(!!m.unstable, st.unstable);
  /* the recall takes one off; the Gene stays in the library */
  assert.equal(G.geneEventRecall(D, s, m, 'sig', seq(0.5)), true);
  assert.equal(m.graft && m.graft.sig, undefined);
  assert.ok(s.meta.genes.includes(tail));
  assert.equal(G.geneEventRecall(D, s, m, 'sig', seq(0.5)), false, 'nothing left there');
});

test('gene events: the field lab offers library Genes on the Bank’s open slots, priced as at the Bank', () => {
  const D = R.geneData(),
    B = modules['gene-bank'],
    s = startedSave('swift0', 20),
    m = s.team[0],
    tail = 'shark_tailfin@zuck2',
    wing = 'eagle_wing@hughes2';
  s.meta.genes = [tail, wing];
  s.meta.dna = 0;
  s.run = { id: 'x' };
  const L = G.geneEventLab(D, s, m);
  assert.deepEqual(
    L.map(o => [o.slot, o.id, o.why]),
    [['sig', tail, 'dna']],
    'Lv 1: the sig slot only; short of DNA, still listed'
  );
  assert.equal(L[0].price, B.bankPrice(D, 'swift0', 'sig', tail));
  s.meta.dna = 100;
  s.meta.buildings.genebank = 2;
  assert.deepEqual(
    G.geneEventLab(D, s, m).map(o => [o.slot, o.id, o.why]),
    [
      ['front', wing, ''],
      ['sig', tail, ''],
    ]
  );
  assert.equal(B.bankWhy(D, s, m, 'sig', tail), 'run', 'the Bank itself still waits for the hub');
});

test('gene events: the auction’s Gene is one not in the library, of the region’s lines first', () => {
  const D = R.geneData(),
    s = startedSave('swift0', 20);
  s.meta.genes = [];
  const a = G.geneEventDraw(D, s, ['zuck0'], seq(0.4));
  assert.ok(a && modules.genes.geneOf(D, a.slot, a.id));
  assert.equal(D.species[modules.genes.geneOf(D, a.slot, a.id).sp].line, 'zuck');
  assert.deepEqual(G.geneEventDraw(D, s, ['zuck0'], seq(0.4)), a);
  s.meta.genes.push(a.id);
  assert.notEqual(G.geneEventDraw(D, s, ['zuck0'], seq(0.4)).id, a.id);
});

test('gene events: the splice kinds (Perks) multiply a Sample’s DNA, the wild splice odds, the Unstable hurt', () => {
  const E = modules.effects,
    Gn = modules.genes,
    D = R.geneData(),
    fx = [
      { kind: 'dna', mult: 1.5, src: 'a' },
      { kind: 'splice', mult: 2, src: 'b' },
    ];
  assert.equal(E.fxSplice(null, 'dna'), 1);
  assert.equal(E.fxSplice(fx, 'dna'), 1.5);
  assert.equal(E.fxSplice(fx, 'unstable'), 1);
  /* the odds: the same draws, the same answer at 1; twice the odds turns some plain Billies spliced, never back */
  const pool = ['zuck0', 'hughes0', 'bezos0'];
  let one = 0,
    two = 0;
  for (let i = 0; i < 400; i++) {
    const x = (i + 0.5) / 400,
      a = Gn.wildSplice(D, 'swift0', pool, seq(x, 0.3, 0.6, 0.2)),
      b = Gn.wildSplice(D, 'swift0', pool, seq(x, 0.3, 0.6, 0.2), 1),
      c = Gn.wildSplice(D, 'swift0', pool, seq(x, 0.3, 0.6, 0.2), 2);
    assert.deepEqual(a, b);
    if (a) assert.ok(c, 'spliced at 1, spliced at 2');
    one += a ? 1 : 0;
    two += c ? 1 : 0;
  }
  assert.ok(two > one * 1.8, `${one} -> ${two}`);
  /* a Sample's DNA */
  const s = startedSave('swift0', 20),
    foe = { sp: 'swift0', graft: { sig: 'shark_tailfin@zuck2' } },
    BR = modules['battle-rewards'];
  s.meta.dna = 0;
  assert.equal(BR.spliceSample([foe], s).dna, D.genes.wild.dna.graft);
  assert.equal(BR.spliceSample([foe], s, fx).dna, Math.round(D.genes.wild.dna.graft * 1.5));
});
