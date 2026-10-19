// Tests for ../firestore.rules on the Firestore emulator. Each test is either a call the game makes
// (js/account.js, js/friends.js) that must keep working, or something the old rules allowed that must now fail.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';

let env;
const db = uid => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();
/* puts documents in place without the rules */
const seed = async (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
const req = (from, to, status = 'pending') => ({ from, to, fromName: from + ' name', status, t: 1 });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-pocket-billies',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

/* ---------- saves ---------- */
test('a player reads and writes their own save', async () => {
  await assertSucceeds(setDoc(doc(db('ann'), 'saves/ann'), { json: '{}', savedAt: 1, name: 'Ann', game: 'Pocket Billies', saveVersion: 1 }));
  await assertSucceeds(getDoc(doc(db('ann'), 'saves/ann')));
});
test('nobody else reads or writes a save', async () => {
  await seed('saves/ann', { json: '{}' });
  await assertFails(getDoc(doc(db('bob'), 'saves/ann')));
  await assertFails(setDoc(doc(db('bob'), 'saves/ann'), { json: '{}' }));
  await assertFails(getDoc(doc(guest(), 'saves/ann')));
  await assertFails(getDocs(collection(db('bob'), 'saves')));
});
test('a save must be a JSON string under 1 MB', async () => {
  await assertFails(setDoc(doc(db('ann'), 'saves/ann'), { json: 5 }));
  await assertFails(setDoc(doc(db('ann'), 'saves/ann'), { json: 'x'.repeat(1000001) }));
});

/* ---------- friend codes ---------- */
test('a player claims a free code and anyone signed in can look a code up', async () => {
  await assertSucceeds(getDoc(doc(db('ann'), 'codes/ABC234')));                 // is it free?
  await assertSucceeds(setDoc(doc(db('ann'), 'codes/ABC234'), { uid: 'ann' }));
  await assertSucceeds(getDoc(doc(db('bob'), 'codes/ABC234')));
  await assertFails(getDoc(doc(guest(), 'codes/ABC234')));
});
test('codes cannot be listed, taken over, or point at someone else', async () => {
  await seed('codes/ABC234', { uid: 'ann' });
  await assertFails(getDocs(collection(db('bob'), 'codes')));
  await assertFails(setDoc(doc(db('bob'), 'codes/ABC234'), { uid: 'bob' }));
  await assertFails(setDoc(doc(db('bob'), 'codes/XYZ234'), { uid: 'ann' }));
  await assertFails(setDoc(doc(db('bob'), 'codes/not-a-code'), { uid: 'bob' }));
  await assertFails(setDoc(doc(db('bob'), 'codes/XYZ234'), { uid: 'bob', extra: 1 }));
});

/* ---------- users (what friends see) ---------- */
const me = { name: 'Ann', avatar: { name: 'Ann' }, partner: { sp: 'hood0', name: 'Hood', lvl: 5 },
  at: { node: 3, place: 'Marigold Town', sid: 'w:marigold', x: 1, z: 2, t: 1 }, v: 1 };
test('a player writes their own page, merges into it, and reads it back', async () => {
  await assertSucceeds(getDoc(doc(db('ann'), 'users/ann')));                    // not there yet
  await assertSucceeds(setDoc(doc(db('ann'), 'users/ann'), { code: 'ABC234' }, { merge: true }));
  await assertSucceeds(setDoc(doc(db('ann'), 'users/ann'), me, { merge: true }));
  await assertSucceeds(setDoc(doc(db('ann'), 'users/ann'), { friends: ['bob'] }, { merge: true }));
  await assertSucceeds(getDoc(doc(db('ann'), 'users/ann')));
});
test('only the friends on a player’s own list read their page', async () => {
  await seed('users/ann', { ...me, friends: ['bob'] });
  await assertSucceeds(getDoc(doc(db('bob'), 'users/ann')));
  await assertFails(getDoc(doc(db('eve'), 'users/ann')));
  await assertFails(getDoc(doc(guest(), 'users/ann')));
});
test('nobody can list users (the old rules let anyone signed in read everyone’s place)', async () => {
  await seed('users/ann', { ...me, friends: ['bob'] });
  await assertFails(getDocs(collection(db('bob'), 'users')));
});
test('a player cannot write someone else’s page, or junk into their own', async () => {
  await seed('users/ann', me);
  await assertFails(setDoc(doc(db('eve'), 'users/ann'), { friends: ['eve'] }, { merge: true }));
  await assertFails(setDoc(doc(db('ann'), 'users/ann'), { name: 'x'.repeat(41) }, { merge: true }));
  await assertFails(setDoc(doc(db('ann'), 'users/ann'), { friends: Array.from({ length: 51 }, (_, i) => 'u' + i) }, { merge: true }));
  await assertFails(setDoc(doc(db('ann'), 'users/ann'), { isAdmin: true }, { merge: true }));
});

/* ---------- friend requests ---------- */
test('the whole friendship: ask, see it, accept, both lists, both pages', async () => {
  await seed('codes/BOB234', { uid: 'bob' });
  const ann = db('ann'), bob = db('bob');
  const code = await getDoc(doc(ann, 'codes/BOB234'));
  await assertSucceeds(setDoc(doc(ann, 'requests/ann_bob'), req('ann', code.data().uid)));
  await assertSucceeds(getDocs(query(collection(bob, 'requests'), where('to', '==', 'bob'))));
  await assertSucceeds(getDocs(query(collection(ann, 'requests'), where('from', '==', 'ann'))));
  await assertSucceeds(updateDoc(doc(bob, 'requests/ann_bob'), { status: 'accepted', t: 2 }));
  await assertSucceeds(setDoc(doc(bob, 'users/bob'), { friends: ['ann'] }, { merge: true }));
  await assertSucceeds(setDoc(doc(ann, 'users/ann'), { friends: ['bob'] }, { merge: true }));
  await assertSucceeds(getDoc(doc(ann, 'users/bob')));
  await assertSucceeds(getDoc(doc(bob, 'users/ann')));
});
test('removing a friend, and asking again later', async () => {
  await seed('requests/ann_bob', req('ann', 'bob', 'accepted'));
  await assertSucceeds(getDoc(doc(db('bob'), 'requests/bob_ann')));               // removeFriend looks at both ids
  await assertSucceeds(updateDoc(doc(db('bob'), 'requests/ann_bob'), { status: 'removed', t: 3 }));
  await assertSucceeds(setDoc(doc(db('ann'), 'requests/ann_bob'), req('ann', 'bob')));
  await assertSucceeds(updateDoc(doc(db('ann'), 'requests/ann_bob'), { status: 'removed', t: 4 }));
  await assertSucceeds(deleteDoc(doc(db('bob'), 'requests/ann_bob')));
});
test('a sender cannot make themselves a friend (the old rules allowed it)', async () => {
  await assertFails(setDoc(doc(db('eve'), 'requests/eve_ann'), req('eve', 'ann', 'accepted')));
  await seed('requests/eve_ann', req('eve', 'ann'));
  await assertFails(updateDoc(doc(db('eve'), 'requests/eve_ann'), { status: 'accepted' }));
});
test('requests cannot be forged, rerouted, read by others or listed', async () => {
  await assertFails(setDoc(doc(db('eve'), 'requests/ann_bob'), req('ann', 'bob')));
  await assertFails(setDoc(doc(db('eve'), 'requests/eve_bob'), req('eve', 'ann')));
  await assertFails(setDoc(doc(db('eve'), 'requests/eve_eve'), req('eve', 'eve')));
  await assertFails(setDoc(doc(db('eve'), 'requests/eve_bob'), { ...req('eve', 'bob'), fromName: 'x'.repeat(41) }));
  await seed('requests/ann_bob', req('ann', 'bob'));
  await assertFails(updateDoc(doc(db('ann'), 'requests/ann_bob'), { to: 'eve' }));
  await assertFails(getDoc(doc(db('eve'), 'requests/ann_bob')));
  await assertFails(updateDoc(doc(db('eve'), 'requests/ann_bob'), { status: 'declined' }));
  await assertFails(deleteDoc(doc(db('eve'), 'requests/ann_bob')));
  await assertFails(getDocs(collection(db('eve'), 'requests')));
});
