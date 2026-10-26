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
import { expose } from './test-globals.js';
import { account, accountOn, closeModal, mapIdAt, mapOffsetInView, modal, provide, render, toast } from './hooks.js';
import { COATS, LOCATIONS, SPECIES } from './game-data.js';
import { billyName, cleanName, plural } from './logic/rules.js';
import { REPORT_REASONS, blockListClean, friendListFrom, reportHidden, reportTarget } from './logic/online.js';
import { escapeHtml, saveData, saveHold, uiState } from './game-state.js';
import { personWalkFrames, portraitHTML, warmPerson } from './person-art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { directionOf, walkView } from './walk-view.js';
import { personItem } from './walk/frame-items.js';
import { buddyBilly, worldBillyItem } from './world-billies.js';
import { worldMap, worldMapSelect } from './world-bowl.js';
/* eslint-disable no-func-assign */
expose({
  FRIEND_CODE_ALPHABET: [() => FRIEND_CODE_ALPHABET],
  addFriend: [() => addFriend, v => (addFriend = v)],
  answerFriendRequest: [() => answerFriendRequest, v => (answerFriendRequest = v)],
  blockPlayer: [() => blockPlayer, v => (blockPlayer = v)],
  cleanFriend: [() => cleanFriend, v => (cleanFriend = v)],
  friendBlockNames: [() => friendBlockNames, v => (friendBlockNames = v)],
  friendReportCheck: [() => friendReportCheck, v => (friendReportCheck = v)],
  friendShownName: [() => friendShownName, v => (friendShownName = v)],
  friendWatchError: [() => friendWatchError, v => (friendWatchError = v)],
  friendWorldItems: [() => friendWorldItems, v => ((friendWorldItems = v), provide({ friendWorldItems }))],
  friends: [() => friends],
  friendsDb: [() => friendsDb, v => (friendsDb = v)],
  friendsError: [() => friendsError, v => (friendsError = v)],
  friendsHTML: [() => friendsHTML, v => (friendsHTML = v)],
  friendsOn: [() => friendsOn, v => (friendsOn = v)],
  initFriends: [() => initFriends, v => (initFriends = v)],
  publishToFriends: [() => publishToFriends, v => (publishToFriends = v)],
  refreshFriends: [() => refreshFriends, v => (refreshFriends = v)],
  removeFriend: [() => removeFriend, v => (removeFriend = v)],
  reportPlayer: [() => reportPlayer, v => (reportPlayer = v)],
  reportSheet: [() => reportSheet, v => (reportSheet = v)],
  syncFriends: [() => syncFriends, v => (syncFriends = v)],
  timeAgo: [() => timeAgo, v => (timeAgo = v)],
  unblockPlayer: [() => unblockPlayer, v => (unblockPlayer = v)],
  watchFriends: [() => watchFriends, v => (watchFriends = v)],
});
/* eslint-enable no-func-assign */
provide({ friendWorldItems });
/* to-module: end */
const friends = {
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
  /* ON-1: who I blocked (blocks/<me>: their uids, and what each was called for the Unblock list), and per player
     whether their name is hidden by reports (reports/user_<uid>) */
  blocked: [],
  blockNames: {},
  hidden: {},
};
provide({ friends }); /* to-module */
const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function friendsOn() {
  return typeof account !== 'undefined' && !!account.user && !!account.db;
}
function friendsDb() {
  return account.db;
}
export async function initFriends() {
  if (!friendsOn() || friends.on) return;
  friends.on = true;
  friends.uid = account.user.uid;
  const db = friendsDb(),
    ref = db.collection('users').doc(friends.uid);
  try {
    const s = await ref.get();
    friends.me = s.exists ? s.data() : {};
    friends.list = Array.isArray(friends.me.friends) ? friends.me.friends.slice() : [];
    friends.code = friends.me.code || '';
    if (!friends.code) {
      for (let k = 0; k < 6 && !friends.code; k++) {
        const c = Array.from(
          { length: 6 },
          () => FRIEND_CODE_ALPHABET[Math.floor(Math.random() * FRIEND_CODE_ALPHABET.length)]
        ).join('');
        const cr = db.collection('codes').doc(c);
        const ex = await cr.get();
        if (ex.exists) continue;
        await cr.set({ uid: friends.uid });
        friends.code = c;
      }
      await ref.set({ code: friends.code }, { merge: true });
    }
    /* ON-1: my block list, mine alone (the rules read it to refuse a blocked player's request) */
    const bl = await db
      .collection('blocks')
      .doc(friends.uid)
      .get()
      .catch(() => null);
    const bd = (bl && bl.exists && bl.data()) || {};
    friends.blocked = blockListClean(bd.list);
    friends.blockNames = bd.names && typeof bd.names === 'object' && !Array.isArray(bd.names) ? bd.names : {};
    publishToFriends(true);
    watchFriends();
    friends.unsub.push(
      db
        .collection('requests')
        .where('to', '==', friends.uid)
        .onSnapshot(q => {
          friends.inc = q.docs.map(d =>
            Object.assign({ id: d.id }, d.data(), { fromName: cleanName(d.data().fromName, 40) })
          );
          for (const r of friends.inc) if (r.status === 'pending') friendReportCheck(r.from);
          syncFriends();
        }, friendsError)
    );
    friends.unsub.push(
      db
        .collection('requests')
        .where('from', '==', friends.uid)
        .onSnapshot(q => {
          friends.out = q.docs.map(d => Object.assign({ id: d.id }, d.data()));
          syncFriends();
        }, friendsError)
    );
  } catch (e) {
    friendsError(e);
  }
  refreshFriends();
}
function friendsError(e) {
  console.warn('friends:', (e && e.message) || e);
  friends.err =
    e && e.code === 'permission-denied'
      ? 'Friends need the updated database rules (see README → Friends).'
      : 'Friends are offline right now.';
  refreshFriends();
}
/* the two sides of each request decide who is a friend */
function syncFriends() {
  /* ON-1: each pair's newest request decides (logic/online.js) */
  const nl = friendListFrom(friends.list, friends.uid, friends.inc, friends.out).filter(
    u => !friends.blocked.includes(u)
  );
  if (nl.join() !== friends.list.join()) {
    friends.list = nl;
    friendsDb().collection('users').doc(friends.uid).set({ friends: nl }, { merge: true }).catch(friendsError);
  }
  watchFriends();
  refreshFriends();
}
function watchFriends() {
  const db = friendsDb();
  for (const [u, un] of friends.watch)
    if (!friends.list.includes(u)) {
      un();
      friends.watch.delete(u);
      delete friends.data[u];
    }
  for (const u of friends.list) friendReportCheck(u);
  for (const u of friends.list)
    if (!friends.watch.has(u))
      friends.watch.set(
        u,
        db
          .collection('users')
          .doc(u)
          .onSnapshot(
            s => {
              if (s.exists) friends.data[u] = cleanFriend(s.data());
              refreshFriends();
              if (typeof worldMap !== 'undefined') worldMap.dirty = true;
            },
            e => friendWatchError(u, e)
          )
      );
}
/* a friend's page is written by their game, or by anyone with their sign-in: take only what is drawn, in the shape
   it is drawn in (the look goes through cleanLook when it is drawn) */
function cleanFriend(d) {
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
            coat: typeof p.coat === 'string' && COATS[p.coat] ? p.coat : undefined,
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
function friendWatchError(u, e) {
  friends.watch.delete(u);
  if (!(e && e.code === 'permission-denied')) return friendsError(e);
  clearTimeout(friends.retryT);
  friends.retryT = setTimeout(() => {
    if (friends.on) watchFriends();
  }, 60000);
}
/* what friends see of you: written when it changes, at most every 20 s (where you stand, every 60 s) */
/* ON-1: a name reported by enough players (logic/online.js reportHidden) shows as "Trainer" to everyone; looked up
   once per player a session */
function friendReportCheck(u) {
  if (!u || Object.hasOwn(friends.hidden, u)) return;
  friends.hidden[u] = false;
  friendsDb()
    .collection('reports')
    .doc(reportTarget('user', u))
    .get()
    .then(s => {
      friends.hidden[u] = reportHidden(s.exists ? s.data() : null);
      if (friends.hidden[u]) refreshFriends();
    })
    .catch(() => {});
}
/** the name to show for a player: theirs, unless reports hid it @param {string} u @param {string} [name] @param {string} [or] */
function friendShownName(u, name, or = 'Friend') {
  return friends.hidden[u] ? 'Trainer' : name || or;
}
/* ON-1: block a player: they leave my friends, their requests go, and the rules refuse their new ones */
async function blockPlayer(u, name) {
  if (!u || u === friends.uid) return;
  friends.blocked = blockListClean([...friends.blocked, u]);
  friends.blockNames = Object.assign({}, friends.blockNames, { [u]: cleanName(name || '', 40) || 'Trainer' });
  try {
    await friendsDb().collection('blocks').doc(friends.uid).set({ list: friends.blocked, names: friendBlockNames() });
    for (const r of friends.inc) if (r.from === u && r.status === 'pending') await answerFriendRequest(r.id, false);
    if (friends.list.includes(u)) await removeFriend(u);
    toast(`${friends.blockNames[u]} is blocked. They can’t add you or see you.`);
  } catch (e) {
    friendsError(e);
  }
  refreshFriends();
}
async function unblockPlayer(u) {
  friends.blocked = friends.blocked.filter(x => x !== u);
  delete friends.blockNames[u];
  try {
    await friendsDb().collection('blocks').doc(friends.uid).set({ list: friends.blocked, names: friendBlockNames() });
  } catch (e) {
    friendsError(e);
  }
  refreshFriends();
}
/* the stored names: only the blocked players', short */
function friendBlockNames() {
  return Object.fromEntries(friends.blocked.map(u => [u, cleanName(friends.blockNames[u] || '', 40) || 'Trainer']));
}
/* ON-1: report a player once: the count and my own report in one batch (firestore.rules checks each against the
   other); a reason from REPORT_REASONS */
async function reportPlayer(u, reason) {
  if (!u || u === friends.uid || !REPORT_REASONS.includes(reason)) return;
  const db = friendsDb(),
    ref = db.collection('reports').doc(reportTarget('user', u)),
    mine = ref.collection('by').doc(friends.uid);
  try {
    const cur = await ref.get(),
      b = db.batch();
    b.set(ref, cur.exists ? { n: (cur.data().n || 0) + 1, ok: cur.data().ok || 0 } : { n: 1, ok: 0 });
    b.set(mine, { reason, t: Date.now() });
    await b.commit();
    toast('Thanks. The report went to the game’s moderator.');
  } catch (e) {
    /* a second report from the same account is refused by the rules: it counted the first time */
    toast(
      e && e.code === 'permission-denied'
        ? 'You reported them already.'
        : 'The report didn’t go through. Try again later.'
    );
  }
}
function reportSheet(u, name) {
  const why = { name: 'Their name', picture: 'Their look', cheating: 'Cheating', other: 'Something else' };
  modal({
    title: `Report ${escapeHtml(friendShownName(u, name, 'this player'))}?`,
    html: '<p>What’s wrong? The game’s moderator sees who reported and why. A name three players report is hidden until the moderator looks at it.</p>',
    btns: [
      ...REPORT_REASONS.map(k => ({
        l: why[k] || k,
        c: 'quiet',
        f: () => {
          closeModal();
          reportPlayer(u, k);
        },
      })),
      { l: 'Cancel', c: 'gold', f: closeModal },
    ],
  });
}
function publishToFriends(now) {
  if (!friends.on || !saveData.started || saveHold) return;
  /* RL-7: on a run your friends see that, not where: a run's places and scenes are made from its seed and mean
     nothing in their world (a friend on another run would stand in yours) */
  const t = Date.now(),
    onRun = !!saveData.run,
    node = onRun ? 0 : saveData.trip && saveData.trip.node,
    r = onRun ? { name: 'a run' } : LOCATIONS[node] || {},
    sid = !onRun && typeof mapIdAt === 'function' ? mapIdAt(node) : null;
  let x = null,
    z = null;
  if (!onRun && uiState.roam && uiState.roam.node === node && uiState.roam.id === sid) {
    x = +uiState.roam.x.toFixed(1);
    z = +uiState.roam.z.toFixed(1);
  }
  const m = typeof buddyBilly === 'function' ? buddyBilly() : saveData.team && saveData.team[0],
    pt = m ? { sp: m.sp, ...(m.coat ? { coat: m.coat } : {}), name: billyName(m), lvl: m.lvl } : null;
  const doc = {
    name: (saveData.avatar && saveData.avatar.name) || account.user.name || 'Trainer',
    avatar: saveData.avatar || null,
    partner: pt,
    at: { node, place: r.name || '', sid, x, z, t },
    v: 1,
  };
  const sig = JSON.stringify([doc.name, node, pt && pt.sp, pt && pt.lvl, pt && pt.name]),
    posSig = x == null ? '' : Math.round(x / 4) + ',' + Math.round(z / 4);
  if (!now && sig === friends.pubSig && (posSig === friends.posSig || t - friends.pubT < 60000)) return;
  if (!now && t - friends.pubT < 20000) return;
  friends.pubSig = sig;
  friends.posSig = posSig;
  friends.pubT = t;
  friendsDb().collection('users').doc(friends.uid).set(doc, { merge: true }).catch(friendsError);
}
setInterval(() => {
  try {
    publishToFriends(false);
  } catch (e) {}
}, 5000);
addEventListener('pagehide', () => {
  try {
    friends.pubT = 0;
    publishToFriends(true);
  } catch (e) {}
});
async function addFriend(code) {
  code = String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) {
    toast('A friend code has 6 letters and numbers.');
    return;
  }
  if (code === friends.code) {
    toast('That’s your own code.');
    return;
  }
  try {
    const s = await friendsDb().collection('codes').doc(code).get();
    if (!s.exists) {
      toast('No player has that code.');
      return;
    }
    const to = s.data().uid;
    if (friends.list.includes(to)) {
      toast('You’re friends already.');
      return;
    }
    const back = friends.inc.find(r => r.from === to && r.status === 'pending');
    if (back) {
      await answerFriendRequest(back.id, true);
      return;
    }
    await friendsDb()
      .collection('requests')
      .doc(friends.uid + '_' + to)
      .set({
        from: friends.uid,
        to,
        fromName: (saveData.avatar && saveData.avatar.name) || account.user.name || 'Trainer',
        status: 'pending',
        t: Date.now(),
      });
    toast('Friend request sent.');
  } catch (e) {
    friendsError(e);
  }
}
async function answerFriendRequest(id, yes) {
  try {
    await friendsDb()
      .collection('requests')
      .doc(id)
      .update({ status: yes ? 'accepted' : 'declined', t: Date.now() });
    if (yes) {
      const r = friends.inc.find(r => r.id === id);
      toast(`You and ${(r && r.fromName) || 'your new friend'} are friends now.`);
    }
  } catch (e) {
    friendsError(e);
  }
}
async function removeFriend(u) {
  const db = friendsDb();
  friends.list = friends.list.filter(x => x !== u);
  for (const id of [friends.uid + '_' + u, u + '_' + friends.uid]) {
    try {
      const s = await db.collection('requests').doc(id).get();
      if (s.exists) await db.collection('requests').doc(id).update({ status: 'removed', t: Date.now() });
    } catch (e) {}
  }
  db.collection('users').doc(friends.uid).set({ friends: friends.list }, { merge: true }).catch(friendsError);
  watchFriends();
  refreshFriends();
}
/* ---------- how long ago ---------- */
function timeAgo(t) {
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
  const head = `<div class="sec-h"><h2>Friends</h2>${friends.code ? `<span class="fr-code">Your code <b class="tnum">${escapeHtml(friends.code)}</b></span>` : ''}</div>`;
  if (typeof accountOn !== 'function' || !accountOn())
    return `<section class="tpanel pf-friends">${head}<p class="note">Friends work when you’re signed in, and this copy of the game has no accounts.</p></section>`;
  if (!friendsOn())
    return `<section class="tpanel pf-friends">${head}<p class="note">Sign in with Google to add friends: you’ll see where they are, with their partner Billie, on your map and in the world.</p><button class="pb small" data-a="acc-in">Sign in</button></section>`;
  const inc = friends.inc.filter(r => r.status === 'pending' && !friends.blocked.includes(r.from)),
    wait = friends.out.filter(r => r.status === 'pending');
  const rows = friends.list
    .map(u => {
      const d = friends.data[u] || {},
        a = d.at || {},
        p = d.partner;
      return `<div class="fr-row">
  <span class="fr-face">${typeof portraitHTML === 'function' ? portraitHTML('friend:' + u, 44) : ''}</span>
  <span class="fr-t"><b>${escapeHtml(friendShownName(u, d.name))}</b><small>${a.place ? `In ${escapeHtml(a.place)} · ${timeAgo(a.t)}` : 'Not seen yet'}</small>${p && SPECIES[p.sp] ? `<small class="fr-pt">with ${escapeHtml(p.name || SPECIES[p.sp].n)} · Lv ${p.lvl || 1}</small>` : ''}</span>
  ${p && SPECIES[p.sp] ? `<span class="fr-mon">${rigCanvasHTML(p.sp, 48, { build: p.build, coat: p.coat })}</span>` : ''}
  <span class="fr-acts">${a.node != null && LOCATIONS[a.node] && !saveData.run ? `<button class="pb small" data-a="fr-map" data-n="${a.node}">Map</button>` : ''}<button class="pb small quiet" data-a="fr-rm" data-u="${escapeHtml(u)}" aria-label="Remove, block or report ${escapeHtml(friendShownName(u, d.name, 'friend'))}">✕</button></span></div>`;
    })
    .join('');
  return `<section class="tpanel pf-friends">${head}
  ${inc.map(r => `<div class="fr-row fr-req"><span class="fr-t"><b>${escapeHtml(friendShownName(r.from, r.fromName, 'A player'))}</b><small>wants to be friends</small></span><span class="fr-acts"><button class="pb small gold" data-a="fr-yes" data-id="${escapeHtml(r.id)}">Accept</button><button class="pb small quiet" data-a="fr-no" data-id="${escapeHtml(r.id)}">No</button></span></div>`).join('')}
  ${rows || '<p class="note">No friends yet. Swap codes with someone and add theirs here.</p>'}
  ${wait.length ? `<p class="note">${plural(wait.length, 'request')} waiting for an answer.</p>` : ''}
  ${friends.blocked.length ? `<details class="fr-blocked"><summary>Blocked (${friends.blocked.length})</summary>${friends.blocked.map(u => `<div class="fr-row"><span class="fr-t"><b>${escapeHtml(friends.blockNames[u] || 'Trainer')}</b></span><span class="fr-acts"><button class="pb small quiet" data-a="fr-unblock" data-u="${escapeHtml(u)}">Unblock</button></span></div>`).join('')}</details>` : ''}
  <form class="fr-add" data-a="fr-add"><input name="code" maxlength="7" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Friend code" aria-label="Friend code"><button class="pb small gold" type="submit">Add</button></form>
  ${friends.err ? `<p class="note warn">${escapeHtml(friends.err)}</p>` : ''}</section>`;
}
function refreshFriends() {
  if (
    typeof uiState !== 'undefined' &&
    uiState.tab === 'profile' &&
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
  addFriend(v);
});
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="fr-"]');
  if (!el || el.tagName === 'FORM') return;
  const d = el.dataset;
  if (d.a === 'fr-yes') answerFriendRequest(d.id, true);
  else if (d.a === 'fr-no') {
    /* ON-1: decline, or block or report the one asking */
    const r = friends.inc.find(x => x.id === d.id),
      nm = r ? friendShownName(r.from, r.fromName, 'this player') : 'this player';
    modal({
      title: 'Not now?',
      html: `<p>Decline ${escapeHtml(nm)}’s request? Block them too and they can’t ask again.</p>`,
      btns: [
        {
          l: 'Decline',
          c: 'quiet',
          f: () => {
            closeModal();
            answerFriendRequest(d.id, false);
          },
        },
        ...(r
          ? [
              {
                l: 'Block',
                c: 'quiet',
                f: () => {
                  closeModal();
                  blockPlayer(r.from, r.fromName);
                },
              },
              {
                l: 'Report',
                c: 'quiet',
                f: () => {
                  closeModal();
                  reportSheet(r.from, r.fromName);
                },
              },
            ]
          : []),
        { l: 'Back', c: 'gold', f: closeModal },
      ],
    });
  } else if (d.a === 'fr-rm') {
    const raw = (friends.data[d.u] || {}).name,
      nm = friendShownName(d.u, raw, 'this friend');
    modal({
      title: escapeHtml(nm),
      html: `<p>Remove ${escapeHtml(nm)} and you stop seeing each other on your maps. Block them and they can’t add you again. Report their name or look to the game’s moderator.</p>`,
      btns: [
        {
          l: 'Remove',
          c: 'quiet',
          f: () => {
            closeModal();
            removeFriend(d.u);
          },
        },
        {
          l: 'Block',
          c: 'quiet',
          f: () => {
            closeModal();
            blockPlayer(d.u, raw);
          },
        },
        {
          l: 'Report',
          c: 'quiet',
          f: () => {
            closeModal();
            reportSheet(d.u, raw);
          },
        },
        { l: 'Keep', c: 'gold', f: closeModal },
      ],
    });
  } else if (d.a === 'fr-unblock') unblockPlayer(d.u);
  else if (d.a === 'fr-map') {
    uiState.tab = 'map';
    render();
    setTimeout(() => {
      if (typeof worldMapSelect === 'function') worldMapSelect(+d.n);
    }, 300);
  } else if (d.a === 'fr-pin') {
    const f = friends.data[d.u] || {};
    toast(
      `${friendShownName(d.u, f.name, 'Your friend')} was in ${(f.at && f.at.place) || '?'} ${timeAgo(f.at && f.at.t)}.`
    );
  }
});
/* ---------- in the world: friends standing where they were last, with their partner ---------- */
function friendWorldItems(out, t, C0) {
  if (
    !friends.list.length ||
    !walkView.sc ||
    uiState.inside ||
    uiState.bench ||
    typeof personWalkFrames !== 'function' ||
    typeof mapOffsetInView !== 'function'
  )
    return;
  for (const u of friends.list) {
    const d = friends.data[u];
    if (!d || !d.at || d.at.x == null || !d.at.sid) continue;
    const o = mapOffsetInView(d.at.sid);
    if (!o) continue;
    const x = d.at.x + o[0],
      z = d.at.z + o[1],
      who = 'friend:' + u;
    let fr;
    try {
      fr = personWalkFrames(who);
    } catch (e) {
      fr = null;
    }
    if (!fr) continue;
    if (typeof warmPerson === 'function') warmPerson(who);
    const P = walkView.pl,
      dir = P && Math.hypot(P.x - x, P.z - z) < 5 ? directionOf(P.x - x, P.z - z) : 'down',
      set = fr[dir] || fr.down,
      im = set && set[0];
    if (im) out.push(personItem('friend', im, x, z, C0, { fr: u }));
    const p = d.partner;
    if (p && SPECIES[p.sp] && typeof worldBillyItem === 'function') {
      const seed = u.length * 13 + 7,
        it = worldBillyItem('fpet', p.sp, 'front', null, t + seed * 91, seed, x + 0.9, z + 0.2, {
          build: p.build,
          coat: p.coat,
          flip: P && P.x > x ? -1 : 1,
        });
      if (it) out.push(it);
    }
  }
}
