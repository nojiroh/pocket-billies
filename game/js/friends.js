'use strict';
/* ================= FRIENDS (alpha 0.5) =================
   Works with the account system (js/account.js, Firebase): signed-in players get a friend code; you add a friend by
   their code, they accept, and from then on you see each other: where they were last (the place, and the spot in it),
   with their partner Billie beside them, on the overworld (when you are in the same place) and as a pin on the map.
   Firestore:
     users/<uid>      what friends see of you: name, trainer look, partner, last place, friend list, your code
     codes/<CODE>     { uid } so a code finds the player
     requests/<from>_<to>  { from, to, fromName, toName, status: pending | accepted | declined | removed, t }
   Each player only ever writes their own users/ document; a friendship is made from the two sides of a request. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { ROUTE, SP } from './data.js';
import { N, S, U, cleanName, esc, plural } from './core.js';
import { owFrames, portraitHTML, trWarm } from './trainer.js';
import { sprHTML } from './rig.js';
import { DIO, dioDirOf } from './diorama.js';
import { dglPerson } from './diorama-gl.js';
import { owBuddyMon, owItem } from './owmon.js';
import { MAP, mapSelect } from './map.js';
/* eslint-disable no-func-assign */
expose({
  FR: [() => FR],
  FR_ABC: [() => FR_ABC],
  frAdd: [() => frAdd, v => (frAdd = v)],
  frAgo: [() => frAgo, v => (frAgo = v)],
  frAnswer: [() => frAnswer, v => (frAnswer = v)],
  frClean: [() => frClean, v => (frClean = v)],
  frDb: [() => frDb, v => (frDb = v)],
  frErr: [() => frErr, v => (frErr = v)],
  frInit: [() => frInit, v => (frInit = v)],
  frOn: [() => frOn, v => (frOn = v)],
  frPublish: [() => frPublish, v => (frPublish = v)],
  frRefresh: [() => frRefresh, v => (frRefresh = v)],
  frRemove: [() => frRemove, v => (frRemove = v)],
  frSync: [() => frSync, v => (frSync = v)],
  frWatchAll: [() => frWatchAll, v => (frWatchAll = v)],
  frWatchErr: [() => frWatchErr, v => (frWatchErr = v)],
  frWorldItems: [() => frWorldItems, v => (frWorldItems = v)],
  friendsHTML: [() => friendsHTML, v => (friendsHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const FR = {
  on: false,
  uid: null,
  me: null,
  code: '',
  list: [],
  data: {},
  inc: [],
  out: [],
  unsub: [],
  watch: new Map(),
  pubT: 0,
  pubSig: '',
  err: '',
};
const FR_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function frOn() {
  return typeof ACC !== 'undefined' && !!ACC.user && !!ACC.db;
}
function frDb() {
  return ACC.db;
}
export async function frInit() {
  if (!frOn() || FR.on) return;
  FR.on = true;
  FR.uid = ACC.user.uid;
  const db = frDb(),
    ref = db.collection('users').doc(FR.uid);
  try {
    const s = await ref.get();
    FR.me = s.exists ? s.data() : {};
    FR.list = Array.isArray(FR.me.friends) ? FR.me.friends.slice() : [];
    FR.code = FR.me.code || '';
    if (!FR.code) {
      for (let k = 0; k < 6 && !FR.code; k++) {
        const c = Array.from({ length: 6 }, () => FR_ABC[Math.floor(Math.random() * FR_ABC.length)]).join('');
        const cr = db.collection('codes').doc(c);
        const ex = await cr.get();
        if (ex.exists) continue;
        await cr.set({ uid: FR.uid });
        FR.code = c;
      }
      await ref.set({ code: FR.code }, { merge: true });
    }
    frPublish(true);
    frWatchAll();
    FR.unsub.push(
      db
        .collection('requests')
        .where('to', '==', FR.uid)
        .onSnapshot(q => {
          FR.inc = q.docs.map(d =>
            Object.assign({ id: d.id }, d.data(), { fromName: cleanName(d.data().fromName, 40) })
          );
          frSync();
        }, frErr)
    );
    FR.unsub.push(
      db
        .collection('requests')
        .where('from', '==', FR.uid)
        .onSnapshot(q => {
          FR.out = q.docs.map(d => Object.assign({ id: d.id }, d.data()));
          frSync();
        }, frErr)
    );
  } catch (e) {
    frErr(e);
  }
  frRefresh();
}
function frErr(e) {
  console.warn('friends:', (e && e.message) || e);
  FR.err =
    e && e.code === 'permission-denied'
      ? 'Friends need the updated database rules (see README → Friends).'
      : 'Friends are offline right now.';
  frRefresh();
}
/* the two sides of each request decide who is a friend */
function frSync() {
  let L = new Set(FR.list);
  for (const r of FR.inc) {
    if (r.status === 'accepted') L.add(r.from);
    else if (r.status === 'removed') L.delete(r.from);
  }
  for (const r of FR.out) {
    if (r.status === 'accepted') L.add(r.to);
    else if (r.status === 'removed' || r.status === 'declined') L.delete(r.to);
  }
  const nl = [...L].filter(u => u && u !== FR.uid).slice(0, 50);
  if (nl.join() !== FR.list.join()) {
    FR.list = nl;
    frDb().collection('users').doc(FR.uid).set({ friends: nl }, { merge: true }).catch(frErr);
  }
  frWatchAll();
  frRefresh();
}
function frWatchAll() {
  const db = frDb();
  for (const [u, un] of FR.watch)
    if (!FR.list.includes(u)) {
      un();
      FR.watch.delete(u);
      delete FR.data[u];
    }
  for (const u of FR.list)
    if (!FR.watch.has(u))
      FR.watch.set(
        u,
        db
          .collection('users')
          .doc(u)
          .onSnapshot(
            s => {
              if (s.exists) FR.data[u] = frClean(s.data());
              frRefresh();
              if (typeof MAP !== 'undefined') MAP.dirty = true;
            },
            e => frWatchErr(u, e)
          )
      );
}
/* a friend's page is written by their game, or by anyone with their sign-in: take only what is drawn, in the shape
   it is drawn in (the look goes through cleanLook when it is drawn) */
function frClean(d) {
  d = d && typeof d === 'object' ? d : {};
  const a = d.at && typeof d.at === 'object' ? d.at : null,
    p = d.partner && typeof d.partner === 'object' ? d.partner : null,
    num = v => (v != null && Number.isFinite(+v) ? +v : null);
  return {
    name: cleanName(d.name, 40) || 'Friend',
    avatar: d.avatar && typeof d.avatar === 'object' ? d.avatar : null,
    partner:
      p && typeof p.sp === 'string'
        ? {
            sp: p.sp,
            gold: !!p.gold,
            name: cleanName(p.name, 16),
            lvl: Math.max(1, Math.min(100, Math.round(num(p.lvl) || 1))),
          }
        : null,
    at: a
      ? {
          node: Number.isInteger(a.node) ? a.node : null,
          place: cleanName(a.place, 60),
          sid: typeof a.sid === 'string' ? cleanName(a.sid, 60) : null,
          x: num(a.x),
          z: num(a.z),
          t: num(a.t) || 0,
        }
      : null,
  };
}
/* a friend's page opens to you once their game has put you on their list too (firebase/firestore.rules): until then,
   look again every minute instead of showing an error */
function frWatchErr(u, e) {
  FR.watch.delete(u);
  if (!(e && e.code === 'permission-denied')) return frErr(e);
  clearTimeout(FR.retryT);
  FR.retryT = setTimeout(() => {
    if (FR.on) frWatchAll();
  }, 60000);
}
/* what friends see of you: written when it changes, at most every 20 s (where you stand, every 60 s) */
function frPublish(now) {
  if (!FR.on || !S.started) return;
  const t = Date.now(),
    node = S.route && S.route.node,
    r = ROUTE[node] || {},
    sid = typeof sceneIdAt === 'function' ? sceneIdAt(node) : null;
  let x = null,
    z = null;
  if (U.roam && U.roam.node === node && U.roam.id === sid) {
    x = +U.roam.x.toFixed(1);
    z = +U.roam.z.toFixed(1);
  }
  const m = typeof owBuddyMon === 'function' ? owBuddyMon() : S.team && S.team[0],
    pt = m ? { sp: m.sp, gold: !!m.gold, name: N(m), lvl: m.lvl } : null;
  const doc = {
    name: (S.avatar && S.avatar.name) || ACC.user.name || 'Trainer',
    avatar: S.avatar || null,
    partner: pt,
    at: { node, place: r.name || '', sid, x, z, t },
    v: 1,
  };
  const sig = JSON.stringify([doc.name, node, pt && pt.sp, pt && pt.lvl, pt && pt.name]),
    posSig = x == null ? '' : Math.round(x / 4) + ',' + Math.round(z / 4);
  if (!now && sig === FR.pubSig && (posSig === FR.posSig || t - FR.pubT < 60000)) return;
  if (!now && t - FR.pubT < 20000) return;
  FR.pubSig = sig;
  FR.posSig = posSig;
  FR.pubT = t;
  frDb().collection('users').doc(FR.uid).set(doc, { merge: true }).catch(frErr);
}
setInterval(() => {
  try {
    frPublish(false);
  } catch (e) {}
}, 5000);
addEventListener('pagehide', () => {
  try {
    FR.pubT = 0;
    frPublish(true);
  } catch (e) {}
});
async function frAdd(code) {
  code = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) {
    toast('A friend code has 6 letters and numbers.');
    return;
  }
  if (code === FR.code) {
    toast('That’s your own code.');
    return;
  }
  try {
    const s = await frDb().collection('codes').doc(code).get();
    if (!s.exists) {
      toast('No player has that code.');
      return;
    }
    const to = s.data().uid;
    if (FR.list.includes(to)) {
      toast('You’re friends already.');
      return;
    }
    const back = FR.inc.find(r => r.from === to && r.status === 'pending');
    if (back) {
      await frAnswer(back.id, true);
      return;
    }
    await frDb()
      .collection('requests')
      .doc(FR.uid + '_' + to)
      .set({
        from: FR.uid,
        to,
        fromName: (S.avatar && S.avatar.name) || ACC.user.name || 'Trainer',
        status: 'pending',
        t: Date.now(),
      });
    toast('Friend request sent.');
  } catch (e) {
    frErr(e);
  }
}
async function frAnswer(id, yes) {
  try {
    await frDb()
      .collection('requests')
      .doc(id)
      .update({ status: yes ? 'accepted' : 'declined', t: Date.now() });
    if (yes) {
      const r = FR.inc.find(r => r.id === id);
      toast(`You and ${(r && r.fromName) || 'your new friend'} are friends now.`);
    }
  } catch (e) {
    frErr(e);
  }
}
async function frRemove(u) {
  const db = frDb();
  FR.list = FR.list.filter(x => x !== u);
  for (const id of [FR.uid + '_' + u, u + '_' + FR.uid]) {
    try {
      const s = await db.collection('requests').doc(id).get();
      if (s.exists) await db.collection('requests').doc(id).update({ status: 'removed', t: Date.now() });
    } catch (e) {}
  }
  db.collection('users').doc(FR.uid).set({ friends: FR.list }, { merge: true }).catch(frErr);
  frWatchAll();
  frRefresh();
}
/* ---------- how long ago ---------- */
function frAgo(t) {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  return s < 90
    ? 'just now'
    : s < 3600
      ? Math.round(s / 60) + ' min ago'
      : s < 86400
        ? Math.round(s / 3600) + ' h ago'
        : Math.round(s / 86400) + ' days ago';
}
/* ---------- the Trainer screen ---------- */
export function friendsHTML() {
  const head = `<div class="sec-h"><h2>Friends</h2>${FR.code ? `<span class="fr-code">Your code <b class="tnum">${FR.code}</b></span>` : ''}</div>`;
  if (typeof accOn !== 'function' || !accOn())
    return `<section class="tpanel pf-friends">${head}<p class="note">Friends work when you’re signed in, and this copy of the game has no accounts.</p></section>`;
  if (!frOn())
    return `<section class="tpanel pf-friends">${head}<p class="note">Sign in with Google to add friends: you’ll see where they are, with their partner Billie, on your map and in the world.</p><button class="pb small" data-a="acc-in">Sign in</button></section>`;
  const inc = FR.inc.filter(r => r.status === 'pending'),
    wait = FR.out.filter(r => r.status === 'pending');
  const rows = FR.list
    .map(u => {
      const d = FR.data[u] || {},
        a = d.at || {},
        p = d.partner;
      return `<div class="fr-row">
  <span class="fr-face">${typeof portraitHTML === 'function' ? portraitHTML('friend:' + u, 44) : ''}</span>
  <span class="fr-t"><b>${esc(d.name || 'Friend')}</b><small>${a.place ? `In ${esc(a.place)} · ${frAgo(a.t)}` : 'Not seen yet'}</small>${p && SP[p.sp] ? `<small class="fr-pt">with ${esc(p.name || SP[p.sp].n)} · Lv ${p.lvl || 1}</small>` : ''}</span>
  ${p && SP[p.sp] ? `<span class="fr-mon">${sprHTML(p.sp, 48, { gold: p.gold })}</span>` : ''}
  <span class="fr-acts">${a.node != null && ROUTE[a.node] ? `<button class="pb small" data-a="fr-map" data-n="${a.node}">Map</button>` : ''}<button class="pb small quiet" data-a="fr-rm" data-u="${esc(u)}" aria-label="Remove ${esc(d.name || 'friend')}">✕</button></span></div>`;
    })
    .join('');
  return `<section class="tpanel pf-friends">${head}
  ${inc.map(r => `<div class="fr-row fr-req"><span class="fr-t"><b>${esc(r.fromName || 'A player')}</b><small>wants to be friends</small></span><span class="fr-acts"><button class="pb small gold" data-a="fr-yes" data-id="${esc(r.id)}">Accept</button><button class="pb small quiet" data-a="fr-no" data-id="${esc(r.id)}">No</button></span></div>`).join('')}
  ${rows || '<p class="note">No friends yet. Swap codes with someone and add theirs here.</p>'}
  ${wait.length ? `<p class="note">${plural(wait.length, 'request')} waiting for an answer.</p>` : ''}
  <form class="fr-add" data-a="fr-add"><input name="code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Friend code" aria-label="Friend code"><button class="pb small gold" type="submit">Add</button></form>
  ${FR.err ? `<p class="note warn">${esc(FR.err)}</p>` : ''}</section>`;
}
function frRefresh() {
  if (
    typeof U !== 'undefined' &&
    U.tab === 'profile' &&
    !document.activeElement?.closest?.('.fr-add') &&
    typeof render === 'function'
  )
    render();
}
document.addEventListener('submit', ev => {
  const f = ev.target.closest && ev.target.closest('form[data-a="fr-add"]');
  if (!f) return;
  ev.preventDefault();
  const v = f.elements.code.value;
  f.elements.code.value = '';
  f.elements.code.blur();
  frAdd(v);
});
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="fr-"]');
  if (!el || el.tagName === 'FORM') return;
  const d = el.dataset;
  if (d.a === 'fr-yes') frAnswer(d.id, true);
  else if (d.a === 'fr-no') frAnswer(d.id, false);
  else if (d.a === 'fr-rm') {
    const nm = (FR.data[d.u] || {}).name || 'this friend';
    modal({
      title: 'Remove friend?',
      html: `<p>Stop seeing ${esc(nm)} on your map? They won’t see you either.</p>`,
      btns: [
        {
          l: 'Remove',
          c: 'quiet',
          f: () => {
            closeModal();
            frRemove(d.u);
          },
        },
        { l: 'Keep', c: 'gold', f: closeModal },
      ],
    });
  } else if (d.a === 'fr-map') {
    U.tab = 'map';
    render();
    setTimeout(() => {
      if (typeof mapSelect === 'function') mapSelect(+d.n);
    }, 300);
  } else if (d.a === 'fr-pin') {
    const f = FR.data[d.u] || {};
    toast(`${f.name || 'Your friend'} was in ${(f.at && f.at.place) || '?'} ${frAgo(f.at && f.at.t)}.`);
  }
});
/* ---------- in the world: friends standing where they were last, with their partner ---------- */
function frWorldItems(out, t, C0) {
  if (
    !FR.list.length ||
    !DIO.sc ||
    U.inside ||
    U.bench ||
    typeof owFrames !== 'function' ||
    typeof walkOff !== 'function'
  )
    return;
  for (const u of FR.list) {
    const d = FR.data[u];
    if (!d || !d.at || d.at.x == null || !d.at.sid) continue;
    const o = walkOff(d.at.sid);
    if (!o) continue;
    const x = d.at.x + o[0],
      z = d.at.z + o[1],
      who = 'friend:' + u;
    let fr;
    try {
      fr = owFrames(who);
    } catch (e) {
      fr = null;
    }
    if (!fr) continue;
    if (typeof trWarm === 'function') trWarm(who);
    const P = DIO.pl,
      dir = P && Math.hypot(P.x - x, P.z - z) < 5 ? dioDirOf(P.x - x, P.z - z) : 'down',
      set = fr[dir] || fr.down,
      im = set && set[0];
    if (im) out.push(dglPerson('friend', im, x, z, C0, { fr: u }));
    const p = d.partner;
    if (p && SP[p.sp] && typeof owItem === 'function') {
      const seed = u.length * 13 + 7,
        it = owItem('fpet', p.sp, !!p.gold, 'front', null, t + seed * 91, seed, x + 0.9, z + 0.2, {
          flip: P && P.x > x ? -1 : 1,
        });
      if (it) out.push(it);
    }
  }
}
