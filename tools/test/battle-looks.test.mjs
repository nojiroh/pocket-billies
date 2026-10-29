// VFX track VFX-14: statuses, stat changes and short effects on the stage (game/data/battleAnims.json `events`,
// game/js/logic/battle-looks.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readGameData } from '../data-files.mjs';

const D = readGameData(),
  A = D.battleAnims,
  E = A.events;

test('events: every status and short effect the engine reports has a look', () => {
  for (const s of D.statuses) assert.ok(E[s.id], `no look for the status ${s.id}`);
  for (const k of ['confused', 'broken', 'soaked', 'fork', 'protect', 'shield', 'delayed', 'stones', 'glint'])
    assert.ok(E[k], k);
  assert.ok(E.stat.sharply >= 1);
});
test('the data check flags a look with no strip, a frame past its strip, a missing ramp and cells that grow', async () => {
  const { dataBattleAnims } = await import('../../game/js/logic/data-checks.js');
  const B = structuredClone(A);
  B.events.brn.loop.sprite = 'nope';
  B.events.shield.crackFrame = 99;
  B.events.stat.down.ramp = 'nope';
  B.events.protect.cells = [1, 2, 2, 1];
  B.events.stones.ramp = 'type';
  const out = dataBattleAnims({ ...D, battleAnims: B }).map(p => p[1]);
  assert.ok(out.includes('events.brn.loop.sprite: no sprite "nope"'));
  assert.ok(out.some(w => w.startsWith('events.shield.crackFrame: frame 99')));
  assert.ok(out.includes('events.stat.down.ramp: no ramp "nope"'));
  assert.ok(out.some(w => w.startsWith('events.protect.cells: [1,2,2,1] grows')));
  assert.ok(out.includes('events.stones.ramp: no ramp "type"'));
  assert.deepEqual(dataBattleAnims(D), []);
});

const L = await import('../../game/js/logic/battle-looks.js');
const snap = (o = {}) => ({ uid: 1, hp: 10, st: null, stg: {}, ...o });

test('the motion levels: Full loops, Calm only in its turn pulse, Reduced never', () => {
  assert.equal(L.lookMotion(true, true), 'reduced');
  assert.equal(L.lookMotion(false, true), 'calm');
  assert.equal(L.lookMotion(false, false), 'full');
  assert.ok(L.lookLoopOn('full', 5000, 0));
  assert.ok(L.lookLoopOn('calm', 100, 900));
  assert.ok(!L.lookLoopOn('calm', 1000, 900));
  assert.ok(!L.lookLoopOn('reduced', 100, 900));
});
test('sharply is read from the snapshots before and after (the engine sends only up)', () => {
  const a = [snap({ stg: { lev: 1 } })],
    b = [snap({ stg: { lev: 3 } })];
  assert.deepEqual(L.lookStageChange(a, b, 0), { stat: 'lev', d: 2 });
  assert.deepEqual(L.lookStageChange(b, a, 0), { stat: 'lev', d: -2 });
  assert.equal(L.lookStageChange(a, a, 0), null, 'Soaked, Fork and a shield fading move no stage');
  assert.equal(L.lookStageChange(a, [snap({ uid: 2, stg: { lev: 3 } })], 0), null, 'another Billie');
  assert.equal(L.lookStageChange(null, b, 0), null);
  const one = L.lookChevrons(E, true, 1),
    two = L.lookChevrons(E, false, -2);
  assert.equal(one.n, E.stat.up.n);
  assert.equal(one.B, E.stat.up);
  assert.equal(two.n, E.stat.down.n * E.stat.sharply);
  assert.ok(two.sharp && !one.sharp);
  assert.ok(E.stat.down.flip, 'falling chevrons point down');
  assert.equal(E.stat.up.ramp, 'up');
  assert.equal(E.stat.down.ramp, 'down');
});
test('a status line: a new status starts, one it had ticks, none at all is a broken part (no flames)', () => {
  assert.deepEqual(L.lookStatusLine({ st: 'brn' }, null), { key: 'brn', kind: 'start' });
  assert.deepEqual(L.lookStatusLine({ st: 'slp' }, 'slp'), { key: 'slp', kind: 'tick' });
  assert.deepEqual(L.lookStatusLine({ st: 'par' }, 'par'), { key: 'par', kind: 'tick' });
  assert.deepEqual(L.lookStatusLine({}, null), { key: 'broken', kind: 'start' });
  assert.notEqual(E.broken.start.sprite, 'flame_tongue');
  assert.notEqual(E.broken.start.sprite, 'ember');
});
test('looks begin and end with the snapshots: a status, the short effects, waking, a switch, a faint', () => {
  const a = [snap({ st: 'slp', fx: { confused: 2 } })],
    b = [snap({ st: null, fx: { confused: 1, soaked: 3 } })];
  assert.deepEqual(L.lookDiff(a, b, 0), { start: ['soaked'], end: ['slp'], swap: false, shield: null });
  const sw = L.lookDiff(a, [snap({ uid: 2, st: 'brn' })], 0);
  assert.ok(sw.swap);
  assert.deepEqual(sw.start, ['brn']);
  assert.deepEqual(L.lookDiff(a, [snap({ st: 'slp', hp: 0 })], 0).end.sort(), ['confused', 'slp']);
  assert.deepEqual(L.lookDiff([snap({ fx: { shield: 2 } })], [snap({ fx: { shield: 1 } })], 0).shield, {
    from: 2,
    to: 1,
  });
  assert.deepEqual(L.lookDiff([snap({ fx: { shield: 1 } })], [snap()], 0).end, ['shield']);
});
test('a confused Billie hitting itself, and not a crash after a miss, a burn or a spread hit', () => {
  const prev = [snap({ fx: { confused: 2 } })];
  assert.ok(L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5 }, undefined, prev, { k: 'status', si: 1 }));
  assert.ok(!L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5 }, undefined, prev, { k: 'move', si: 0, miss: true }));
  assert.ok(!L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5, fx: 'brn' }, undefined, prev, null));
  assert.ok(!L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5, te: 1, t: 'Fire', fx: 'spread' }, undefined, prev, null));
  assert.ok(!L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5 }, [{ src: 'unstable', si: 0 }], prev, null));
  assert.ok(!L.lookSelfHit({ k: 'hurt', si: 0, dmg: 5 }, undefined, [snap()], null));
});
test('a landed move leaves stones or a delayed hit on its target side, a missed or blocked one nothing', () => {
  const side = i => (i === 1 || i === 3 ? 1 : 0),
    stones = Object.entries(D.moves).find(([, M]) => M.fx && M.fx.stones && M.c !== 'X'),
    delay = Object.entries(D.moves).find(([, M]) => M.fx && M.fx.delay);
  assert.ok(stones && delay);
  assert.equal(L.lookMoveLeaves({ k: 'move', si: 0, ti: 1, mid: stones[0] }, stones[1], side).stones, 1);
  assert.equal(L.lookMoveLeaves({ k: 'move', si: 0, ti: 1, miss: true }, stones[1], side).stones, null);
  assert.equal(L.lookMoveLeaves({ k: 'move', si: 1, ti: 0, blocked: true }, stones[1], side).stones, null);
  assert.deepEqual(L.lookMoveLeaves({ k: 'move', si: 1, ti: 0, self: true }, delay[1], side).delayed, {
    side: 0,
    type: delay[1].t,
  });
  assert.deepEqual(L.lookMoveLeaves({ k: 'status', si: 0 }, stones[1], side), { stones: null, delayed: null });
});
test('glints follow the report one after another, a passive in its type colour', () => {
  const G = E.glint,
    out = L.lookGlints(
      [
        { src: 'perk:x', si: 0 },
        { src: 'held:y', si: 0 },
        { src: 'passive:kindling', si: 1 },
        { src: 'unstable', si: 0 },
        { src: 'gene:z' },
      ],
      G,
      p => (p === 'kindling' ? 'Fire' : undefined)
    );
  assert.deepEqual(
    out.map(g => [g.si, g.at, g.ramp]),
    [
      [0, 0, G.ramps.perk],
      [0, G.gapMs, G.ramps.held],
      [1, 2 * G.gapMs, 'Fire'],
      [0, 3 * G.gapMs, G.ramps.unstable],
    ]
  );
  for (const r of Object.values(G.ramps)) assert.ok(A.ramps[r], r);
});
test('the shield dome cracks a share a turn; its cells and the bubble have places', () => {
  assert.equal(L.lookCracks(8, 2, 2), 0);
  assert.equal(L.lookCracks(8, 1, 2), 4);
  assert.equal(L.lookCracks(8, 0, 2), 8);
  assert.equal(L.lookCracks(8, 1, 0), 0);
  const dome = L.lookDomeCells(7, 1, 1.2, Math.PI * 2);
  assert.equal(dome.length, 7);
  assert.equal(dome[0].up, 1.2);
  const bubble = L.lookDomeCells(3, 0.9, 1, (Math.PI * 2) / 3);
  assert.equal(bubble.length, 3);
  assert.ok(
    bubble.every(c => c.out > 0),
    'in front'
  );
  assert.deepEqual(L.lookDomeCells(1, 0.9, 1, 2), [{ out: 0.9, across: 0, up: 0.5 }]);
  for (const k of ['protect', 'shield']) for (let q = 1; q < 4; q++) assert.ok(E[k].cells[q] <= E[k].cells[q - 1]);
});
test('the loops step at 12 fps: the orbit, the flicker, Fork copy, the stones', () => {
  const a = L.lookOrbit(3, 1400, 10),
    b = L.lookOrbit(3, 1400, 80),
    c = L.lookOrbit(3, 1400, 90);
  assert.deepEqual(a, b, 'held within a cell');
  assert.notDeepEqual(b, c);
  assert.equal(a.length, 3);
  assert.equal(L.lookFlicker([0, 0.2], 10), 0);
  assert.equal(L.lookFlicker([0, 0.2], 90), 0.2);
  assert.equal(L.lookFlicker(undefined, 90), 0);
  assert.ok(L.lookForkOn(0) && L.lookForkOn(100) && !L.lookForkOn(200) && !L.lookForkOn(300));
  assert.deepEqual(L.lookStonePlaces(5, 0.7, 1), L.lookStonePlaces(5, 0.7, 1));
  assert.ok(L.lookStonePlaces(5, 0.7, 1).every(p => Math.hypot(p.x, p.z / 0.6) <= 0.7 + 1e-9));
});
test('the Reduced motion tint: the status first, then the effects; none without a look', () => {
  assert.deepEqual(L.lookTint(E, new Set(['soaked', 'brn'])), { col: E.brn.tint, a: E.brn.tintA });
  assert.deepEqual(L.lookTint(E, new Set(['fork'])), { col: E.fork.tint, a: E.fork.tintA });
  assert.equal(L.lookTint(E, new Set(['shield'])), null);
  assert.equal(L.lookTint(E, new Set()), null);
});
test('VFX-20: lookSnaps changes a copy; BATTLE_LOOK_FILMS: labelled, lines in time order, events the stage plays', async () => {
  const { lookSnaps, BATTLE_LOOK_FILMS } = await import('../../game/js/logic/battle-looks.js');
  const base = [{ st: null }, { st: null, fx: { protect: 1 } }],
    s = lookSnaps(base, [
      { i: 1, st: 'brn', fx: null, stg: { lev: 2 }, hp: 0 },
      { i: 5, st: 'x' },
    ]);
  assert.deepEqual(s[1], { st: 'brn', stg: { lev: 2 }, hp: 0 });
  assert.deepEqual(base[1], { st: null, fx: { protect: 1 } }, 'the snapshots before stay');
  const kinds = new Set(['move', 'hurt', 'heal', 'status', 'stat', 'hype', 'alphaPhase', 'block']);
  for (const [k, F] of Object.entries(BATTLE_LOOK_FILMS)) {
    assert.ok(F.label, k);
    let t = 0;
    for (const x of F.lines) {
      assert.ok((x.at || 0) >= t, `${k}: lines in time order`);
      t = x.at || 0;
      if (x.an) assert.ok(kinds.has(x.an.k), `${k}: ${x.an.k}`);
    }
  }
  for (const k of ['brn_ko', 'spread_ko', 'delayed_ko'])
    assert.ok(
      BATTLE_LOOK_FILMS[k].lines.some(x => x.ka && x.ka.ko),
      k
    );
});
