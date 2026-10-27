// ON-3: the Showcase on the emulator (js/showcase.js, js/logic/showcase.js): showcase/<uid>_<slot> entries (a
// Billie's look), votes/<entry>_<k>_<uid> and reports on an entry. The cheat suite: a fourth entry, someone else's
// entry, extra keys, a head start on votes, a second vote, a vote on your own entry, +2 in one go, a vote without its
// document (or the other way round), voting after the week, editing an entry, a non-moderator hiding one, a big page.
// Its own emulator project: node --test runs the files at once, and each clears its project between tests.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore';

let env;
const MOD = 'PASTE-YOUR-UID-HERE';
const db = uid => env.authenticatedContext(uid).firestore();
const seed = async (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
/* the server's week, as the rules count it (the test runs within one week, barring Monday 00:00 UTC) */
const WEEK = Math.floor((Math.floor(Date.now() / 86400000) + 3) / 7);
const K = 1700000000000;
const show = (o = {}) => ({
  u: 'ann',
  name: 'Ann',
  sp: 'bezos0',
  coat: 'gold',
  build: { head: 'M', body: 'M', front: 'M', back: 'M', sig: 'M' },
  graft: { sig: 'shark_tailfin@zuck2' },
  aug: { front: 'hydrant' },
  abom: false,
  lvl: 20,
  nick: 'Jeff',
  ot: 'Ann',
  th: 'splice',
  w: WEEK,
  k: K,
  v: 0,
  wv: WEEK * 1e6,
  r: 0,
  ok: 0,
  ...o,
});
/* a vote (or taking it back) as the game sends it: the vote document and the entry's count in one batch */
function vote(uid, id, e, k = 1) {
  const d = db(uid),
    b = writeBatch(d),
    vid = `${id}_${e.k}_${uid}`;
  if (k > 0) b.set(doc(d, 'votes/' + vid), { e: id, k: e.k, by: uid, t: 1 });
  else b.delete(doc(d, 'votes/' + vid));
  b.update(doc(d, 'showcase/' + id), { v: e.v + k, wv: e.wv > 0 ? e.wv + k : e.wv });
  return b.commit();
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pocket-billies-showcase',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('a player shares into their three slots, and only those; anyone signed in reads and lists 20 at a time', async () => {
  for (const s of [0, 1, 2]) await assertSucceeds(setDoc(doc(db('ann'), `showcase/ann_${s}`), show()));
  await assertFails(setDoc(doc(db('ann'), 'showcase/ann_3'), show()));
  await assertFails(setDoc(doc(db('ann'), 'showcase/ann'), show()));
  await assertFails(setDoc(doc(db('bob'), 'showcase/ann_0'), show()));
  await assertFails(setDoc(doc(db('bob'), 'showcase/bob_0'), show()));
  await assertSucceeds(getDoc(doc(db('bob'), 'showcase/ann_0')));
  await assertSucceeds(getDocs(query(collection(db('bob'), 'showcase'), orderBy('k', 'desc'), limit(20))));
  await assertSucceeds(
    getDocs(
      query(
        collection(db('bob'), 'showcase'),
        where('wv', '>=', WEEK * 1e6),
        where('wv', '<', (WEEK + 1) * 1e6),
        orderBy('wv', 'desc'),
        limit(20)
      )
    )
  );
  await assertSucceeds(getDocs(query(collection(db('bob'), 'showcase'), where('u', 'in', ['ann', 'eve']), limit(20))));
  await assertFails(getDocs(query(collection(db('bob'), 'showcase'), limit(21))));
  await assertFails(getDocs(collection(db('bob'), 'showcase')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'showcase/ann_0')));
  /* the owner deletes (to replace it), nobody else */
  await assertFails(deleteDoc(doc(db('bob'), 'showcase/ann_0')));
  await assertSucceeds(deleteDoc(doc(db('ann'), 'showcase/ann_0')));
});

test('cheats on making an entry: keys, sizes, a head start, another week, a sort key off its theme', async () => {
  const w = d => setDoc(doc(db('ann'), 'showcase/ann_0'), d);
  await assertFails(w(show({ extra: 1 })));
  await assertFails(w(show({ hid: false })));
  await assertFails(w(show({ v: 5, wv: WEEK * 1e6 + 5 })));
  await assertFails(w(show({ r: 0, ok: 3 })));
  await assertFails(w(show({ w: WEEK - 1, wv: (WEEK - 1) * 1e6 })));
  await assertFails(w(show({ wv: (WEEK + 1) * 1e6 })));
  await assertFails(w(show({ th: '', wv: WEEK * 1e6 })));
  await assertFails(w(show({ nick: 'x'.repeat(17) })));
  await assertFails(w(show({ name: 'x'.repeat(41) })));
  await assertFails(w(show({ lvl: 101 })));
  await assertFails(w(show({ lvl: 2.5 })));
  await assertFails(w(show({ abom: 'yes' })));
  await assertFails(w(show({ aug: { a: 'x', b: 'y', c: 'z' } })));
  await assertFails(w(show({ u: 'bob' })));
  await assertSucceeds(w(show({ th: '', wv: 0 })));
  /* once in, its owner can't edit it (votes, reports or anything else) */
  await assertFails(updateDoc(doc(db('ann'), 'showcase/ann_0'), { nick: 'Other' }));
  await assertFails(updateDoc(doc(db('ann'), 'showcase/ann_0'), { v: 9 }));
});

test('a vote: once per account, never your own, the count by exactly one, taken back by exactly one', async () => {
  await seed('showcase/ann_0', show());
  const e = show();
  await assertSucceeds(vote('bob', 'ann_0', e));
  const e1 = { ...e, v: 1, wv: e.wv + 1 };
  /* a second vote: its document exists already */
  await assertFails(vote('bob', 'ann_0', e1));
  /* your own entry */
  await assertFails(vote('ann', 'ann_0', e1));
  /* another account counts */
  await assertSucceeds(vote('eve', 'ann_0', e1));
  const e2 = { ...e, v: 2, wv: e.wv + 2 };
  /* taken back, then given again */
  await assertSucceeds(vote('bob', 'ann_0', e2, -1));
  const e3 = { ...e, v: 1, wv: e.wv + 1 };
  await assertSucceeds(vote('bob', 'ann_0', e3));
  /* taking back a vote you never gave */
  await assertFails(vote('cat', 'ann_0', { ...e, v: 2, wv: e.wv + 2 }, -1));
});

test('cheats on votes: +2, the count without the vote, the vote without the count, a wrong stamp, a stale week', async () => {
  await seed('showcase/ann_0', show());
  const d = db('bob');
  await assertFails(updateDoc(doc(d, 'showcase/ann_0'), { v: 2, wv: WEEK * 1e6 + 2 }));
  await assertFails(updateDoc(doc(d, 'showcase/ann_0'), { v: 1, wv: WEEK * 1e6 + 1 }));
  await assertFails(setDoc(doc(d, `votes/ann_0_${K}_bob`), { e: 'ann_0', k: K, by: 'bob', t: 1 }));
  /* the count and the sort key apart */
  {
    const b = writeBatch(d);
    b.set(doc(d, `votes/ann_0_${K}_bob`), { e: 'ann_0', k: K, by: 'bob', t: 1 });
    b.update(doc(d, 'showcase/ann_0'), { v: 1, wv: WEEK * 1e6 + 5 });
    await assertFails(b.commit());
  }
  /* a vote stamped for an older entry in the slot */
  {
    const b = writeBatch(d);
    b.set(doc(d, `votes/ann_0_${K - 1}_bob`), { e: 'ann_0', k: K - 1, by: 'bob', t: 1 });
    b.update(doc(d, 'showcase/ann_0'), { v: 1, wv: WEEK * 1e6 + 1 });
    await assertFails(b.commit());
  }
  /* a vote in someone else's name */
  {
    const b = writeBatch(d);
    b.set(doc(d, `votes/ann_0_${K}_eve`), { e: 'ann_0', k: K, by: 'eve', t: 1 });
    b.update(doc(d, 'showcase/ann_0'), { v: 1, wv: WEEK * 1e6 + 1 });
    await assertFails(b.commit());
  }
  /* last week's entry is closed */
  await seed('showcase/ann_1', show({ w: WEEK - 1, wv: (WEEK - 1) * 1e6 }));
  await assertFails(vote('bob', 'ann_1', show({ w: WEEK - 1, wv: (WEEK - 1) * 1e6 })));
  /* a hidden entry takes no votes */
  await seed('showcase/ann_2', show({ hid: true }));
  await assertFails(vote('bob', 'ann_2', show()));
  /* an entry off the theme counts votes but keeps its sort key at 0 */
  await seed('showcase/eve_0', show({ u: 'eve', th: '', wv: 0 }));
  await assertSucceeds(vote('bob', 'eve_0', show({ th: '', wv: 0 })));
  /* nobody reads someone else's vote */
  await assertFails(getDoc(doc(db('eve'), `votes/eve_0_${K}_bob`)));
  await assertSucceeds(getDoc(doc(db('bob'), `votes/eve_0_${K}_bob`)));
  await assertFails(getDocs(collection(db('bob'), 'votes')));
});

test('a vote on an entry that is gone or replaced can be cleared without touching any count', async () => {
  await seed(`votes/ann_0_${K}_bob`, { e: 'ann_0', k: K, by: 'bob', t: 1 });
  await assertFails(deleteDoc(doc(db('eve'), `votes/ann_0_${K}_bob`)));
  await assertSucceeds(deleteDoc(doc(db('bob'), `votes/ann_0_${K}_bob`)));
  await seed(`votes/ann_0_${K}_bob`, { e: 'ann_0', k: K, by: 'bob', t: 1 });
  await seed('showcase/ann_0', show({ k: K + 1 }));
  await assertSucceeds(deleteDoc(doc(db('bob'), `votes/ann_0_${K}_bob`)));
});

test('reports on an entry: each account once, raising its r; never your own; the moderator clears or hides', async () => {
  await seed('showcase/ann_0', show());
  const target = `show_ann_0_${K}`;
  const report = async (uid, r) => {
    const d = db(uid),
      b = writeBatch(d);
    let cur;
    await env.withSecurityRulesDisabled(async c => {
      cur = await getDoc(doc(c.firestore(), 'reports/' + target));
    });
    b.set(doc(d, 'reports/' + target), cur.exists() ? { n: cur.data().n + 1, ok: cur.data().ok } : { n: 1, ok: 0 });
    b.set(doc(d, `reports/${target}/by/${uid}`), { reason: 'name', t: 1 });
    b.update(doc(d, 'showcase/ann_0'), { r });
    return b.commit();
  };
  await assertSucceeds(report('bob', 1));
  await assertFails(report('bob', 2));
  await assertFails(report('ann', 2));
  await assertSucceeds(report('eve', 2));
  /* r without a report of one's own */
  await assertFails(updateDoc(doc(db('cat'), 'showcase/ann_0'), { r: 3 }));
  /* a report on someone's own entry is refused at the count too */
  await assertFails(setDoc(doc(db('ann'), 'reports/show_ann_1_5'), { n: 1, ok: 0 }));
  /* hiding: the moderator only */
  await assertFails(updateDoc(doc(db('bob'), 'showcase/ann_0'), { hid: true }));
  await assertFails(updateDoc(doc(db('ann'), 'showcase/ann_0'), { hid: true }));
  await assertSucceeds(updateDoc(doc(db(MOD), 'showcase/ann_0'), { hid: true }));
  await assertSucceeds(updateDoc(doc(db(MOD), 'showcase/ann_0'), { hid: false, ok: 2 }));
  await assertFails(updateDoc(doc(db(MOD), 'showcase/ann_0'), { ok: 3 }));
  await assertFails(updateDoc(doc(db(MOD), 'showcase/ann_0'), { v: 50 }));
  /* the moderator reads who reported */
  await assertSucceeds(getDocs(collection(db(MOD), `reports/${target}/by`)));
  await assertFails(getDocs(collection(db('bob'), `reports/${target}/by`)));
});
