// ON-4: friend trades on the emulator (js/trade.js, js/logic/trade.js): offers/<a>_<b>. The happy path with each side's
// save in the same batch as its mark, then the cheat suite: a stranger or a blocked player opening an offer, a fourth
// thing, writing the other side's give or ok, an ok on an old version, a give change that keeps the oks, giving
// before both oks or without the save, receiving before the other side gave, cancelling after a give, refusing after
// the other side received, taking back without a close, deleting midway, a third party reading.
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
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

let env;
const ID = 'ann_bob';
const db = uid => env.authenticatedContext(uid).firestore();
const seed = async (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
const thing = (k = 'b', n = 1) => ({ k, d: JSON.stringify({ uid: 'u' + n, sp: 'zuck0', lvl: 20 }) });
/* an offer as the game opens it: its maker's side filled, the other side empty */
const fresh = (o = {}) => ({
  a: 'ann',
  b: 'bob',
  na: 'Ann',
  nb: '',
  ga: [thing('b', 1)],
  gb: [],
  oa: 0,
  ob: 0,
  da: false,
  db: false,
  ta: 0,
  tb: 0,
  ra: false,
  rb: false,
  ka: false,
  kb: false,
  x: '',
  by: '',
  t: serverTimestamp(),
  v: 1,
  ...o,
});
const save = () => ({ json: '{}', savedAt: 1, saveVersion: 4, name: 'X', game: 'pb', t: serverTimestamp() });
/* a mark (gave, received, took back) with the player's save in the same batch, as the game sends it */
function marked(uid, fields, withSave = true) {
  const d = db(uid),
    b = writeBatch(d);
  if (withSave) b.set(doc(d, 'saves/' + uid), save());
  b.update(doc(d, 'offers/' + ID), { ...fields, t: serverTimestamp() });
  return b.commit();
}
const upd = (uid, fields) => updateDoc(doc(db(uid), 'offers/' + ID), { ...fields, t: serverTimestamp() });
async function friends() {
  await seed('users/ann', { name: 'Ann', friends: ['bob'] });
  await seed('users/bob', { name: 'Bob', friends: ['ann'] });
  await seed('users/cat', { name: 'Cat', friends: [] });
}
/* both sides filled and both oks on version 2 */
async function lockedOffer() {
  await friends();
  await assertSucceeds(setDoc(doc(db('ann'), 'offers/' + ID), fresh()));
  await assertSucceeds(upd('bob', { gb: [thing('e', 2)], nb: 'Bob', v: 2 }));
  await assertSucceeds(upd('ann', { oa: 2 }));
  await assertSucceeds(upd('bob', { ob: 2 }));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pocket-billies-offers',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('a whole trade: open, both give, both ok, each gives with its save, each receives, then it goes', async () => {
  await lockedOffer();
  await assertSucceeds(marked('ann', { da: true, ta: serverTimestamp() }));
  /* Bob can't receive before he gave himself */
  await assertFails(marked('bob', { rb: true }));
  await assertSucceeds(marked('bob', { db: true, tb: serverTimestamp() }));
  await assertSucceeds(marked('bob', { rb: true }));
  /* not deleted while Ann hasn't received */
  await assertFails(deleteDoc(doc(db('bob'), 'offers/' + ID)));
  await assertSucceeds(marked('ann', { ra: true }));
  await assertSucceeds(deleteDoc(doc(db('ann'), 'offers/' + ID)));
});

test('only the two players read it, and a list must ask for their own', async () => {
  await lockedOffer();
  await assertSucceeds(getDoc(doc(db('ann'), 'offers/' + ID)));
  await assertSucceeds(getDoc(doc(db('bob'), 'offers/' + ID)));
  await assertFails(getDoc(doc(db('cat'), 'offers/' + ID)));
  await assertSucceeds(getDocs(query(collection(db('ann'), 'offers'), where('a', '==', 'ann'))));
  await assertSucceeds(getDocs(query(collection(db('bob'), 'offers'), where('b', '==', 'bob'))));
  await assertFails(getDocs(query(collection(db('cat'), 'offers'), where('a', '==', 'ann'))));
  await assertFails(getDocs(collection(db('ann'), 'offers')));
  /* a missing offer can be looked for (the game checks before it opens one) */
  await assertSucceeds(getDoc(doc(db('cat'), 'offers/cat_dan')));
});

test('opening: only between friends both ways, not when blocked, in the sorted id, with a fair start', async () => {
  await friends();
  await assertFails(
    setDoc(doc(db('cat'), 'offers/ann_cat'), fresh({ a: 'ann', b: 'cat', na: '', nb: 'Cat', ga: [], gb: [thing()] }))
  );
  await seed('users/dan', { name: 'Dan', friends: ['ann'] });
  /* Dan has Ann on his list but she doesn't have him */
  await assertFails(
    setDoc(doc(db('dan'), 'offers/ann_dan'), fresh({ a: 'ann', b: 'dan', na: '', nb: 'Dan', ga: [], gb: [thing()] }))
  );
  await assertFails(setDoc(doc(db('ann'), 'offers/bob_ann'), fresh({ a: 'bob', b: 'ann' })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ gb: [thing()] })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ oa: 1 })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ da: true })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ v: 5 })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ extra: 1 })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ ga: [thing(), thing(), thing(), thing()] })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ ga: [{ k: 'robot', d: '{}' }] })));
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ ga: [{ k: 'b', d: 'x'.repeat(16001) }] })));
  await seed('blocks/bob', { list: ['ann'], names: {} });
  await assertFails(setDoc(doc(db('ann'), 'offers/ann_bob'), fresh()));
  await env.withSecurityRulesDisabled(c => deleteDoc(doc(c.firestore(), 'blocks/bob')));
  await assertSucceeds(
    setDoc(doc(db('ann'), 'offers/ann_bob'), fresh({ ga: [thing(), thing('p', 2), thing('e', 3)] }))
  );
  /* the other side opens too: it's taken */
  await assertFails(setDoc(doc(db('bob'), 'offers/ann_bob'), fresh({ na: '', nb: 'Bob', ga: [], gb: [thing()] })));
});

test('each side writes only its own give and ok; a give change moves the version, so no old ok stands', async () => {
  await friends();
  await assertSucceeds(setDoc(doc(db('ann'), 'offers/' + ID), fresh()));
  await assertFails(upd('bob', { ga: [], v: 2 }));
  await assertFails(upd('bob', { oa: 1 }));
  await assertFails(upd('cat', { gb: [thing()], v: 2 }));
  /* a give change must move the version by exactly one */
  await assertFails(upd('bob', { gb: [thing()] }));
  await assertFails(upd('bob', { gb: [thing()], v: 3 }));
  await assertSucceeds(upd('bob', { gb: [thing()], nb: 'Bob', v: 2 }));
  /* an ok on an old version, or on one to come */
  await assertFails(upd('ann', { oa: 1 }));
  await assertFails(upd('ann', { oa: 3 }));
  await assertSucceeds(upd('ann', { oa: 2 }));
  /* Bob changes his give after Ann's ok: the version moves, Ann's ok is on the old one */
  await assertSucceeds(upd('bob', { gb: [thing('p', 4)], v: 3 }));
  /* Bob can't sneak a give change into his ok, nor give on a version Ann didn't agree to */
  await assertFails(upd('bob', { ob: 3, gb: [thing('p', 5)] }));
  await assertSucceeds(upd('bob', { ob: 3 }));
  await assertFails(marked('bob', { db: true, tb: serverTimestamp() }));
  /* taking an ok back is fine */
  await assertSucceeds(upd('bob', { ob: 0 }));
});

test('giving: both oks on this version, both sides filled, my own mark, my save in the batch, once', async () => {
  await friends();
  await assertSucceeds(setDoc(doc(db('ann'), 'offers/' + ID), fresh()));
  await assertSucceeds(upd('ann', { oa: 1 }));
  await assertSucceeds(upd('bob', { ob: 1 }));
  /* Bob's side is empty: no gifts */
  await assertFails(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertSucceeds(upd('bob', { gb: [thing()], nb: 'Bob', v: 2 }));
  await assertFails(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertSucceeds(upd('ann', { oa: 2 }));
  await assertSucceeds(upd('bob', { ob: 2 }));
  await assertFails(marked('ann', { da: true, ta: serverTimestamp() }, false));
  await assertFails(marked('ann', { db: true, tb: serverTimestamp() }));
  await assertFails(marked('ann', { da: true, ta: Timestamp.fromMillis(1) }));
  await assertSucceeds(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertFails(marked('ann', { da: true, ta: serverTimestamp() }));
  /* after a give nobody changes a give or an ok, or cancels */
  await assertFails(upd('bob', { gb: [], v: 3 }));
  await assertFails(upd('bob', { ob: 0 }));
  await assertFails(upd('bob', { x: 'cancel', by: 'bob' }));
  /* receiving needs my save in the batch too */
  await assertSucceeds(marked('bob', { db: true, tb: serverTimestamp() }));
  await assertFails(marked('bob', { rb: true }, false));
  await assertFails(marked('bob', { ra: true }));
  await assertSucceeds(marked('bob', { rb: true }));
});

test('closing: cancel only before a give; refused only before the other received; then each giver takes back', async () => {
  await lockedOffer();
  await assertFails(upd('cat', { x: 'cancel', by: 'cat' }));
  await assertFails(upd('ann', { x: 'cancel', by: 'bob' }));
  await assertSucceeds(upd('ann', { x: 'cancel', by: 'ann' }));
  await assertFails(upd('ann', { x: '', by: '' }));
  await assertSucceeds(deleteDoc(doc(db('bob'), 'offers/' + ID)));

  await lockedOffer();
  /* nothing to refuse yet */
  await assertFails(upd('bob', { x: 'refused', by: 'bob' }));
  await assertSucceeds(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertSucceeds(marked('bob', { db: true, tb: serverTimestamp() }));
  /* a take back before a close */
  await assertFails(marked('ann', { ka: true }));
  await assertSucceeds(upd('bob', { x: 'refused', by: 'bob' }));
  /* closed: nobody receives now */
  await assertFails(marked('ann', { ra: true }));
  await assertFails(deleteDoc(doc(db('ann'), 'offers/' + ID)));
  await assertFails(marked('ann', { ka: true }, false));
  await assertSucceeds(marked('ann', { ka: true }));
  await assertFails(marked('ann', { ka: true }));
  await assertFails(deleteDoc(doc(db('ann'), 'offers/' + ID)));
  await assertSucceeds(marked('bob', { kb: true }));
  await assertSucceeds(deleteDoc(doc(db('ann'), 'offers/' + ID)));

  await lockedOffer();
  await assertSucceeds(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertSucceeds(marked('bob', { db: true, tb: serverTimestamp() }));
  await assertSucceeds(marked('bob', { rb: true }));
  /* Bob has Ann's things: Ann can't refuse his now (she'd keep hers and his) */
  await assertFails(upd('ann', { x: 'refused', by: 'ann' }));
  await assertFails(upd('bob', { x: 'refused', by: 'bob' }));
});

test('stale: the giver closes only 7 days after giving, and only when the other side never gave', async () => {
  await lockedOffer();
  await assertSucceeds(marked('ann', { da: true, ta: serverTimestamp() }));
  await assertFails(upd('ann', { x: 'stale', by: 'ann' }));
  await assertFails(upd('bob', { x: 'stale', by: 'bob' }));
  /* wind Ann's give back 8 days */
  await env.withSecurityRulesDisabled(c =>
    updateDoc(doc(c.firestore(), 'offers/' + ID), { ta: Timestamp.fromMillis(Date.now() - 8 * 86400e3) })
  );
  await assertFails(upd('bob', { x: 'stale', by: 'bob' }));
  await assertSucceeds(upd('ann', { x: 'stale', by: 'ann' }));
  await assertFails(marked('bob', { db: true, tb: serverTimestamp() }));
  await assertSucceeds(marked('ann', { ka: true }));
  await assertSucceeds(deleteDoc(doc(db('bob'), 'offers/' + ID)));
});
