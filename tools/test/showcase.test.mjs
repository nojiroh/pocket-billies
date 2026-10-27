// ON-3 (docs/phases/online-track.md): the Showcase's pure parts (game/js/logic/showcase.js) on the game's own data:
// an entry is a Billie's look only and passes its own check; hand-made looks the game can't draw are refused; the
// weekly theme and who fits it; the ribbon winners (votes, then the earlier entry; never a hidden one); ribbons given
// once, to the right Billie; the save's own parts (meta.show, Billy.ribbons).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, GAME_DATA, modules, reseed } from './setup-real.mjs';

const S = modules.showcase,
  M = modules['meta-state'],
  makeBilly = fn('makeBilly'),
  { SPECIES } = data,
  SC = GAME_DATA.showcase,
  me = { u: 'ann', name: 'Ann' },
  WEEK = 2913,
  K = 1700000000000;
const theme = need => SC.themes.find(t => t.need === need) || { id: need, name: need, d: '', need };

test('showcase.json: the owner’s three themes and three ribbons, one theme a week, round again', () => {
  assert.deepEqual(
    SC.themes.map(t => t.id),
    ['abom', 'bureau', 'splice']
  );
  assert.equal(SC.ribbons.length, 3);
  assert.equal(S.showTheme(0, SC).id, 'abom');
  assert.equal(S.showTheme(4, SC).id, 'bureau');
  assert.equal(S.showTheme(WEEK, SC).id, SC.themes[WEEK % 3].id);
  assert.deepEqual(modules['data-checks'].dataShowcase(GAME_DATA), []);
  const bad = structuredClone(GAME_DATA);
  bad.showcase.themes.push({ ...bad.showcase.themes[0] }, { id: 't', name: 'T', d: '', need: 'type', type: 'Nope' });
  assert.deepEqual(
    modules['data-checks'].dataShowcase(bad).map(([, w]) => w),
    ['themes: "abom" twice', 'themes.t.type: no type "Nope" (types.json)']
  );
});

test('every species shares as a look that passes its own check; only the look and names go', () => {
  reseed();
  const bad = [];
  for (const sp of Object.keys(SPECIES)) {
    const m = makeBilly(sp, 30, { wild: true });
    m.nick = 'Pal';
    const { e, why } = S.showEntry(m, me, WEEK, K, theme('any'));
    if (!e) bad.push(`${sp}: ${why}`);
    else if (S.showValid(e)) bad.push(`${sp}: entry ${S.showValid(e)}`);
  }
  assert.deepEqual(bad, []);
  const m = makeBilly(Object.keys(SPECIES)[0], 12);
  m.held = 'potion';
  const { e } = S.showEntry(m, me, WEEK, K, theme('any'));
  assert.deepEqual(
    Object.keys(e)
      .filter(k => !S.SHOW_KEYS.includes(k))
      .sort(),
    []
  );
  assert.equal(e.moves, undefined);
  assert.equal(e.uid, undefined);
  assert.equal(e.held, undefined);
  assert.equal(e.ot, 'Ann', 'its original trainer is stamped on the way out');
  assert.deepEqual([e.v, e.r, e.ok, e.w, e.k], [0, 0, 0, WEEK, K]);
  /* a robot can't be shared; neither can a Billie the legality check refuses */
  assert.equal(S.showEntry({ ...m, kind: 'robot' }, me, WEEK, K, theme('any')).why, 'robot');
  assert.equal(S.showEntry({ ...m, lvl: 999 }, me, WEEK, K, theme('any')).why, 'level');
});

test('the week’s theme: an entry that fits gets the theme and the week’s sort key; one that doesn’t gets neither', () => {
  const plain = makeBilly('swift0', 20),
    spliced = { ...makeBilly('swift0', 20), graft: { front: 'eagle_wing@hughes2' } };
  const off = S.showEntry(plain, me, WEEK, K, theme('graft')).e,
    on = S.showEntry(spliced, me, WEEK, K, theme('graft')).e;
  assert.deepEqual([off.th, off.wv], ['', 0]);
  assert.deepEqual([on.th, on.wv], ['splice', WEEK * M.SHOW_WEEK_KEY]);
  assert.deepEqual(on.graft, { front: 'eagle_wing@hughes2' });
  assert.equal(S.showValid(on), '');
  assert.equal(S.showThemeFits(theme('abom'), { mut: { k: 'abom' } }), true);
  assert.equal(S.showThemeFits(theme('abom'), { unstable: { up: 'a', down: 'b', name: 'X' } }), true);
  assert.equal(S.showThemeFits(theme('abom'), { mut: { k: 'quirk' } }), false);
  assert.equal(S.showThemeFits(theme('aug'), { aug: { front: { uid: 'p', id: 'x', up: 0 } } }), true);
  assert.equal(S.showThemeFits(theme('aug'), {}), false);
  const fire = { id: 'f', name: 'Fire', d: '', need: 'type', type: 'Fire' };
  assert.equal(
    S.showThemeFits(fire, {}, () => ['Fire']),
    true
  );
  assert.equal(
    S.showThemeFits(fire, {}, () => ['Water']),
    false
  );
});

test('Augments go as part ids and come back drawable; a look the game can’t draw is refused', () => {
  const A = modules.augments,
    D = fn('geneData')();
  let found = null;
  for (const sp of Object.keys(SPECIES)) {
    for (const id of Object.keys(GAME_DATA.robots.parts))
      if (A.augFits(D, sp, 'front', id)) {
        found = { sp, id };
        break;
      }
    if (found) break;
  }
  assert.ok(found, 'some species takes some Augment');
  const m = makeBilly(found.sp, 30);
  m.aug = { front: { uid: 'p1', id: found.id, up: 0 } };
  m.hp = fn('maxHp')(m);
  const { e, why } = S.showEntry(m, me, WEEK, K, theme('aug'));
  assert.equal(why, '');
  assert.deepEqual(e.aug, { front: found.id });
  assert.equal(e.th, 'bureau');
  assert.equal(S.showValid(e), '');
  assert.deepEqual(S.showLook(e).aug, { front: { uid: 'show', id: found.id, up: 0 } });
  const ok = S.showEntry(makeBilly('swift0', 20), me, WEEK, K, theme('any')).e;
  const cases = [
    [{ ...ok, sp: 'nobody' }, 'species'],
    [{ ...ok, sp: '__proto__' }, 'species'],
    [{ ...ok, coat: 'nope' }, 'coat'],
    [{ ...ok, graft: { front: 'laser@nobody' } }, 'splice'],
    [{ ...ok, aug: { front: 'nope' } }, 'augment'],
    [{ ...ok, nick: '<b>x</b>' }, 'name'],
    [{ ...ok, name: 'x'.repeat(41) }, 'name'],
    [{ ...ok, lvl: 0 }, 'level'],
    [{ ...ok, extra: 1 }, 'shape'],
    [{ ...ok, v: -1 }, 'shape'],
    [{ ...ok, hid: 'yes' }, 'shape'],
    [{ ...ok, build: { head: 'XL' } }, 'build'],
    [null, 'shape'],
  ];
  for (const [x, want] of cases) assert.equal(S.showValid(x), want, JSON.stringify(x && Object.keys(x)));
});

test('hidden: the moderator’s hid, or three reports past what the moderator cleared', () => {
  assert.equal(S.showHidden({ r: 0, ok: 0 }), false);
  assert.equal(S.showHidden({ r: 3, ok: 0 }), true);
  assert.equal(S.showHidden({ r: 3, ok: 1 }), false);
  assert.equal(S.showHidden({ r: 0, ok: 0, hid: true }), true);
  assert.equal(S.showReportTarget('ann_0', K), `show_ann_0_${K}`);
  assert.equal(S.showVoteId('ann_0', K, 'bob'), `ann_0_${K}_bob`);
});

test('the week’s winners: its theme, by votes, then the earlier; never hidden, never without a vote', () => {
  const T = S.showTheme(WEEK, SC),
    e = (id, v, k, o = {}) => ({
      id,
      u: id.split('_')[0],
      v,
      k,
      w: WEEK,
      th: T.id,
      wv: WEEK * 1e6 + v,
      r: 0,
      ok: 0,
      ...o,
    });
  const list = [
    e('a_0', 5, 3),
    e('b_0', 9, 2),
    e('c_0', 5, 1),
    e('d_0', 20, 1, { hid: true }),
    e('e_0', 30, 1, { r: 3 }),
    e('f_0', 0, 1),
    e('g_0', 40, 1, { th: 'other', wv: 0 }),
    e('h_0', 50, 1, { w: WEEK - 1, wv: (WEEK - 1) * 1e6 + 50 }),
    e('i_0', 1, 9),
  ];
  assert.deepEqual(
    S.showWinners(list, WEEK, SC).map(w => [w.id, w.p]),
    [
      ['b_0', 0],
      ['c_0', 1],
      ['a_0', 2],
    ]
  );
  assert.deepEqual(S.showWinners([e('f_0', 0, 1)], WEEK, SC), []);
});

test('ribbons: given once, to the Billie still in its slot; a released one keeps its line on the card', () => {
  const show = M.newShowMeta(),
    b1 = makeBilly('swift0', 20),
    b2 = makeBilly('swift0', 20);
  show.s = [
    { i: 0, k: K, w: WEEK, th: 'splice', b: b1.uid },
    { i: 1, k: K + 5, w: WEEK, th: 'splice', b: 'gone' },
    { i: 2, k: K + 9, w: WEEK, th: 'splice', b: b2.uid },
  ];
  const winners = [
    { id: 'ann_0', u: 'ann', k: K, th: 'splice', p: 0 },
    { id: 'bob_0', u: 'bob', k: K, th: 'splice', p: 1 },
    { id: 'ann_1', u: 'ann', k: K + 5, th: 'splice', p: 2 },
    /* a slot replaced since: another stamp */
    { id: 'ann_2', u: 'ann', k: K, th: 'splice', p: 2 },
  ];
  const got = S.showAward(show, [b1, b2], winners, 'ann', WEEK);
  assert.deepEqual(
    got.map(r => [r.p, r.sp]),
    [
      [0, 'swift0'],
      [2, 'unknown'],
    ]
  );
  assert.deepEqual(b1.ribbons, [{ w: WEEK, th: 'splice', p: 0 }]);
  assert.equal(b2.ribbons, undefined);
  assert.equal(show.rw, WEEK);
  assert.equal(M.validShowMeta(show), true);
  assert.equal(M.ribbonsShapeOk(b1.ribbons), true);
  /* the same week again gives nothing */
  assert.deepEqual(S.showAward(show, [b1, b2], winners, 'ann', WEEK), []);
  assert.equal(b1.ribbons.length, 1);
  assert.equal(S.ribbonName(b1.ribbons[0], SC), 'Gold · Best splice');
  /* the save's check takes ribbons and refuses odd ones */
  const billiesOk = fn('billiesOk');
  assert.equal(billiesOk([b1]), true);
  assert.equal(billiesOk([{ ...b1, ribbons: [{ w: 1, th: 'x', p: 99 }] }]), false);
  assert.equal(billiesOk([{ ...b1, ribbons: 'gold' }]), false);
});

test('slots and votes in the save', () => {
  const show = M.newShowMeta();
  assert.equal(S.showSlotFree(show), 0);
  show.s = [{ i: 0 }, { i: 2 }];
  assert.equal(S.showSlotFree(show), 1);
  show.s.push({ i: 1 });
  assert.equal(S.showSlotFree(show), -1);
  S.showVoteSet(show, 'a', true);
  S.showVoteSet(show, 'a', true);
  assert.deepEqual(show.v, ['a']);
  S.showVoteSet(show, 'a', false);
  assert.deepEqual(show.v, []);
  for (let n = 0; n < M.SHOW_VOTES_MOST + 5; n++) S.showVoteSet(show, 'v' + n, true);
  assert.equal(show.v.length, M.SHOW_VOTES_MOST);
  assert.equal(show.v[0], 'v5');
});
