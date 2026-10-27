// ON-2: ghosts/<uid> on the emulator (js/boards.js, js/logic/run-record.js): the owner writes, friends on the owner's
// own list read, nobody lists; the key whitelist and caps; a daily's or weekly's entry only for the server's day or
// week (or the one before) and never changed once in. The cheat suite: a score over the caps, a second daily, a
// board entry for another day, a record over 8 KB, writing someone else's. Its own emulator project: node --test runs
// the files at once, and each clears its project between tests.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

let env;
const db = uid => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const seed = async (path, data) => env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), path), data));
/* the server's day and week, as the rules count them (the test runs within the same day, barring midnight) */
const DAY = Math.floor(Date.now() / 86400000), WEEK = Math.floor((DAY + 3) / 7);
const entry = (o = {}) => ({ won: 1, cleared: 9, leaders: 2, days: 8, exp: 1, lead: 'bezos0', t: 1, ...o });
const ghost = (o = {}) => ({ name: 'Ann', last: '{"v":1}', day: { n: DAY, e: entry() }, week: { n: WEEK, e: entry() }, x: { 1: entry() }, fast: entry(), ...o });

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-pocket-billies-ghosts',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('a player writes their own ghost; friends on their list read it; nobody else reads, writes or lists', async () => {
  await seed('users/ann', { name: 'Ann', friends: ['bob'] });
  await assertSucceeds(setDoc(doc(db('ann'), 'ghosts/ann'), ghost()));
  await assertSucceeds(getDoc(doc(db('ann'), 'ghosts/ann')));
  await assertSucceeds(getDoc(doc(db('bob'), 'ghosts/ann')));
  await assertFails(getDoc(doc(db('eve'), 'ghosts/ann')));
  await assertFails(getDoc(doc(guest(), 'ghosts/ann')));
  await assertFails(getDocs(collection(db('bob'), 'ghosts')));
  await assertFails(setDoc(doc(db('bob'), 'ghosts/ann'), ghost()));
  await assertFails(deleteDoc(doc(db('bob'), 'ghosts/ann')));
  await assertSucceeds(deleteDoc(doc(db('ann'), 'ghosts/ann')));
});
test('a friend who was removed (or blocked, which removes) no longer reads it', async () => {
  await seed('users/ann', { name: 'Ann', friends: [] });
  await seed('ghosts/ann', ghost());
  await assertFails(getDoc(doc(db('bob'), 'ghosts/ann')));
});
test('a ghost with only the last run, and one with no board entries, is fine', async () => {
  await assertSucceeds(setDoc(doc(db('ann'), 'ghosts/ann'), { name: 'Ann', last: '{}' }));
  await assertSucceeds(setDoc(doc(db('ann'), 'ghosts/ann'), { name: 'Ann', last: '{}', x: {} }));
});
test('cheats: keys, sizes and caps', async () => {
  const w = d => setDoc(doc(db('ann'), 'ghosts/ann'), d);
  await assertFails(w(ghost({ extra: 1 })));
  await assertFails(w(ghost({ last: 'x'.repeat(8193) })));
  await assertFails(w(ghost({ name: 'x'.repeat(41) })));
  await assertFails(w(ghost({ fast: entry({ days: 0 }) })));
  await assertFails(w(ghost({ fast: entry({ cleared: 41 }) })));
  await assertFails(w(ghost({ fast: entry({ leaders: 17 }) })));
  await assertFails(w(ghost({ fast: entry({ won: 2 }) })));
  await assertFails(w(ghost({ fast: entry({ score: 1e9 }) })));
  await assertFails(w(ghost({ x: { 1: entry({ exp: 10 }) } })));
  await assertFails(w(ghost({ x: { 10: entry() } })));
  await assertFails(w(ghost({ x: { 3: entry({ days: 1.5 }) } })));
  await assertFails(w(ghost({ day: { n: DAY, e: entry(), more: 1 } })));
});
test("a daily's entry: only today's or yesterday's, and never changed once in (one attempt)", async () => {
  const w = d => setDoc(doc(db('ann'), 'ghosts/ann'), d);
  await assertFails(w(ghost({ day: { n: DAY + 1, e: entry() } })), 'tomorrow');
  await assertFails(w(ghost({ day: { n: DAY - 2, e: entry() } })), 'the day before yesterday');
  await assertSucceeds(w(ghost({ day: { n: DAY - 1, e: entry({ won: 0 }) } })), 'a run that ended after midnight');
  await assertSucceeds(w(ghost({ day: { n: DAY, e: entry({ won: 0 }) } })));
  await assertFails(w(ghost({ day: { n: DAY, e: entry({ won: 1 }) } })), 'a second try');
  await assertSucceeds(w(ghost({ day: { n: DAY, e: entry({ won: 0 }) }, last: '{"v":1,"t":2}' })), 'the same entry kept');
});
test("an old day's entry may stand while the rest changes", async () => {
  await seed('ghosts/ann', ghost({ day: { n: DAY - 5, e: entry() } }));
  await assertSucceeds(setDoc(doc(db('ann'), 'ghosts/ann'), ghost({ day: { n: DAY - 5, e: entry() }, last: '{"t":3}' })));
  await assertFails(setDoc(doc(db('ann'), 'ghosts/ann'), ghost({ day: { n: DAY - 5, e: entry({ days: 1 }) } })));
});
test("a weekly's entry: this week's or last week's, never changed once in", async () => {
  const w = d => setDoc(doc(db('ann'), 'ghosts/ann'), d);
  await assertFails(w(ghost({ week: { n: WEEK + 1, e: entry() } })));
  await assertFails(w(ghost({ week: { n: WEEK - 2, e: entry() } })));
  await assertSucceeds(w(ghost({ week: { n: WEEK, e: entry({ won: 0 }) } })));
  await assertFails(w(ghost({ week: { n: WEEK, e: entry() } })));
});
