'use strict';
/* ================= ACCOUNTS (alpha 0.4.1) =================
   "Sign in with Google": each player gets their own save, kept online (Firebase Firestore, saves/<their id>) and
   copied in this browser, so it follows them to any device. Without an account the game keeps one save in this browser.
   Signing in or out switches whose save is loaded (the page reloads once; js/game-state.js picks the save by account).
   The first time someone signs in on a browser that already has a game, they are asked whether to bring it along.
   The Firebase project is set in js/account-config.js; without it there is no sign-in button. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { TEST_RUN, closeModal, modal, provide, render, toast } from './hooks.js';
import { TEST_BOOT } from './test-boot.js';
import { LOCATIONS, RULES } from './game-data.js';
import { metresToKm } from './logic/rules.js';
import { clockSkew, ranchFloor, setRanchFloor, setRanchSkew } from './logic/ranch-clock.js';
import { SAVE_NEW_MSG, SAVE_OLD_MSG, SAVE_VERSION, loadSave, saveAge } from './logic/saves.js';
import {
  ACCOUNT_ID,
  ACCOUNT_KEY,
  SAVE_KEY,
  SAVE_KEY_BASE,
  accountSetAside,
  accountSetAsideRead,
  activeBattle,
  escapeHtml,
  save,
  saveData,
  saveHeld,
  saveHold,
  setSaveData,
  setSaveHold,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { cleanTrainer } from './person-art.js';
import { applyPreferences, settingsRefresh } from './settings-screen.js';
import { titleAutoCheck, titleScreen, titleStart } from './title.js';
import { initFriends } from './friends.js';
/* eslint-disable no-func-assign */
expose({
  FIREBASE_SDK_URL: [() => FIREBASE_SDK_URL],
  GOOGLE_ICON_SVG: [() => GOOGLE_ICON_SVG],
  SAVES_APART_MS: [() => SAVES_APART_MS],
  account: [() => account],
  accountAvatarHTML: [() => accountAvatarHTML],
  accountChanged: [() => accountChanged, v => (accountChanged = v)],
  accountChipHTML: [() => accountChipHTML, v => ((accountChipHTML = v), provide({ accountChipHTML }))],
  accountError: [() => accountError, v => (accountError = v)],
  accountMeasureClock: [() => accountMeasureClock, v => (accountMeasureClock = v)],
  accountOn: [() => accountOn, v => ((accountOn = v), provide({ accountOn }))],
  accountPickSave: [() => accountPickSave, v => (accountPickSave = v)],
  accountSaveCardHTML: [() => accountSaveCardHTML, v => (accountSaveCardHTML = v)],
  accountSaveDoc: [() => accountSaveDoc, v => (accountSaveDoc = v)],
  accountServerMs: [() => accountServerMs],
  accountSetAsideHTML: [() => accountSetAsideHTML, v => ((accountSetAsideHTML = v), provide({ accountSetAsideHTML }))],
  accountSettingsHTML: [() => accountSettingsHTML, v => ((accountSettingsHTML = v), provide({ accountSettingsHTML }))],
  accountSignIn: [() => accountSignIn, v => (accountSignIn = v)],
  accountSignOut: [() => accountSignOut, v => ((accountSignOut = v), provide({ accountSignOut }))],
  flushAccountSave: [() => flushAccountSave, v => ((flushAccountSave = v), provide({ flushAccountSave }))],
  initAccount: [() => initAccount, v => (initAccount = v)],
  loadAccountScript: [() => loadAccountScript, v => (loadAccountScript = v)],
  pullAccountSave: [() => pullAccountSave, v => (pullAccountSave = v)],
  pullAccountSaveNow: [() => pullAccountSaveNow, v => (pullAccountSaveNow = v)],
  refreshAccount: [() => refreshAccount, v => (refreshAccount = v)],
});
/* eslint-enable no-func-assign */
provide({ accountChipHTML, accountOn, accountSetAsideHTML, accountSettingsHTML, accountSignOut, flushAccountSave });
/* to-module: end */
export const account = {
  cfg: window.PB_FIREBASE || null,
  ready: false,
  user: null,
  auth: null,
  db: null,
  t: null,
  busy: false,
  err: '',
  /* the save online has been looked at (and any question about it answered): the title may continue by itself */
  pulled: false,
  /* RL-10b: the phone clock against the server's, this session: '' not yet, 'measuring', 'known' */
  clock: '',
};
provide({ account }); /* to-module */
const FIREBASE_SDK_URL = 'https://cdn.jsdelivr.net/npm/firebase@10.12.5/';
function accountOn() {
  return (
    !!(account.cfg && account.cfg.apiKey && account.cfg.projectId) &&
    !(typeof TEST_RUN !== 'undefined' && TEST_RUN) &&
    !TEST_BOOT &&
    location.protocol !== 'file:'
  );
}
function loadAccountScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('could not load ' + src));
    document.head.appendChild(s);
  });
}
export async function initAccount() {
  if (!accountOn()) return;
  try {
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'])
      await loadAccountScript(FIREBASE_SDK_URL + f);
    firebase.initializeApp(account.cfg);
    account.auth = firebase.auth();
    account.db = firebase.firestore();
    try {
      await account.auth.getRedirectResult();
    } catch (e) {
      accountError(e);
    }
    account.auth.onAuthStateChanged(u => accountChanged(u));
  } catch (e) {
    console.warn(e);
    account.err = 'Sign-in isn’t reachable right now.';
    account.ready = true;
    refreshAccount();
  }
}
function accountChanged(u) {
  account.ready = true;
  account.user = u
    ? { uid: u.uid, name: u.displayName || u.email || 'Player', email: u.email || '', photo: u.photoURL || '' }
    : null;
  const want = u ? u.uid : '';
  if (want !== ACCOUNT_ID) {
    /* a different player: keep what's here, then load theirs */
    try {
      writeStoredSave(saveData);
    } catch (e) {}
    try {
      if (want) {
        localStorage.setItem(ACCOUNT_KEY, want);
        if (!ACCOUNT_ID && saveData.started) localStorage.setItem('pb-offer-guest', '1');
      } else localStorage.removeItem(ACCOUNT_KEY);
    } catch (e) {}
    location.reload();
    return;
  }
  if (u) {
    pullAccountSave();
    if (typeof initFriends === 'function') initFriends();
  }
  refreshAccount();
}
/* the save online against the one here. 2026-10-19 (the owner): when both are games and they were saved more than a
   minute apart (someone played on another device), you choose which to keep and the other is set aside in this
   browser (Settings > Save can restore or download it); otherwise the newer one wins, as before */
const SAVES_APART_MS = 60000;
async function pullAccountSave() {
  await pullAccountSaveNow();
  account.pulled = true;
  refreshAccount();
}
async function pullAccountSaveNow() {
  if (!account.user || !account.db) return;
  let snap = null;
  try {
    snap = await account.db.collection('saves').doc(account.user.uid).get();
  } catch (e) {
    accountError(e);
    return;
  }
  const offer = (() => {
    try {
      const v = localStorage.getItem('pb-offer-guest');
      localStorage.removeItem('pb-offer-guest');
      return v === '1';
    } catch (e) {
      return false;
    }
  })();
  if (snap && snap.exists) {
    /* RL-10b: the server's time of the last write is the ranch clock's floor for whichever save plays on */
    setRanchFloor(Math.max(ranchFloor, accountServerMs(snap.data())));
    let remote = null,
      age = null;
    try {
      remote = JSON.parse(snap.data().json);
      age = saveAge(remote);
      remote = loadSave(remote);
    } catch (e) {}
    if (age === 'new') {
      setSaveHold(true);
      modal({
        title: 'Your account’s save is newer',
        html: `<p>${SAVE_NEW_MSG}</p>`,
        btns: [{ l: 'OK', c: 'gold', f: closeModal }],
      });
      return;
    }
    if (age === 'old') {
      try {
        const k = SAVE_KEY + '-cloud-set-aside';
        if (localStorage.getItem(k) == null) localStorage.setItem(k, snap.data().json);
      } catch (e) {}
      toast('Your account’s save is from an older version of the game, so this is a new game. Playing on replaces it.');
    }
    if (
      remote &&
      remote.started &&
      saveData.started &&
      Math.abs((remote.savedAt || 0) - (saveData.savedAt || 0)) > SAVES_APART_MS &&
      !activeBattle
    ) {
      await accountPickSave(remote, snap.data().json);
      return;
    }
    if (
      remote &&
      remote.started &&
      (!saveData.started || (remote.savedAt || 0) > (saveData.savedAt || 0)) &&
      !activeBattle
    ) {
      setSaveData(remote);
      saveData.avatar = cleanTrainer(saveData.avatar, saveData.gender);
      applyPreferences();
      writeStoredSave(saveData);
      render();
      toast('Your game is loaded from your account.');
      return;
    }
    if (saveData.started) flushAccountSave(true);
    return;
  }
  /* nothing online yet: a game from this browser can come along */
  let guest = null;
  try {
    guest = loadSave(JSON.parse(localStorage.getItem(SAVE_KEY_BASE) || 'null'));
  } catch (e) {}
  if (offer && guest && guest.started && !saveData.started) {
    modal({
      title: 'Bring your game along?',
      html: `<p>This browser has a game with ${escapeHtml((guest.avatar && guest.avatar.name) || 'your trainer')} (${metresToKm((guest.stats && guest.stats.walked) || 0)} km walked). Use it as the game on your account, ${escapeHtml(account.user.name)}?</p>`,
      btns: [
        {
          l: 'Yes, use it',
          c: 'gold',
          f: () => {
            setSaveData(guest);
            saveData.savedAt = Date.now();
            writeStoredSave(saveData);
            closeModal();
            flushAccountSave(true);
            if (typeof titleScreen !== 'undefined' && titleScreen.on) {
              titleScreen.on = false;
              titleStart();
            }
            render();
            toast('Your game is on your account now.');
          },
        },
        { l: 'No, start fresh', c: 'quiet', f: closeModal },
      ],
    });
  } else if (saveData.started) flushAccountSave(true);
}
/* the two saves side by side: keep the one online or the one in this browser; the other is set aside here first */
function accountSaveCardHTML(S, where) {
  const nm = (S.avatar && S.avatar.name) || 'Trainer',
    place = S.trip && LOCATIONS[S.trip.node] ? LOCATIONS[S.trip.node].name : '',
    m = Math.floor((S.playMs || 0) / 60000),
    played = m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`,
    when = S.savedAt ? new Date(S.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
  return `<div class="acc-pick-card"><small>${escapeHtml(where)}</small><b>${escapeHtml(nm)}</b><span>${escapeHtml(place)}</span><span>${played} played</span><span class="note">Last played ${escapeHtml(when)}</span></div>`;
}
function accountPickSave(remote, remoteJson) {
  if (typeof titleScreen !== 'undefined') titleScreen.autoOff = true;
  setSaveHold(true);
  return new Promise(res => {
    const done = () => {
      setSaveHold(false);
      closeModal();
      res();
    };
    modal({
      title: 'Which game do you want to keep?',
      html: `<p>Your account and this browser have different games: one was played on another device since.</p><div class="acc-pick">${accountSaveCardHTML(remote, 'On your account')}${accountSaveCardHTML(saveData, 'In this browser')}</div><p class="note">The one you don’t keep is set aside in this browser: Settings → Save can bring it back or download it.</p>`,
      btns: [
        {
          l: 'Keep the one on my account',
          c: 'gold',
          f: () => {
            accountSetAside(JSON.stringify(saveData), 'this browser');
            setSaveData(remote);
            saveData.avatar = cleanTrainer(saveData.avatar, saveData.gender);
            applyPreferences();
            writeStoredSave(saveData);
            done();
            render();
            toast('Your game is loaded from your account.');
          },
        },
        {
          l: 'Keep the one in this browser',
          c: 'quiet',
          f: () => {
            accountSetAside(remoteJson, 'your account');
            done();
            flushAccountSave(true);
            render();
            toast('This browser’s game is on your account now.');
          },
        },
      ],
    });
  });
}
function accountSetAsideHTML() {
  const A = accountSetAsideRead();
  if (!A) return '';
  let O = null;
  try {
    O = JSON.parse(A.json);
  } catch (e) {}
  if (!O || typeof O !== 'object') return '';
  /* a save this version can't load (older or newer) can still be downloaded, not brought back */
  const S = loadSave(O),
    name = escapeHtml(String((O.avatar && O.avatar.name) || 'Trainer')),
    when = escapeHtml(new Date(A.at).toLocaleDateString());
  if (!S)
    return `<div class="acc-box acc-aside"><div class="acc-t"><b>Set aside: ${name}</b><span class="note">The game from ${escapeHtml(A.from)}, set aside ${when}. ${escapeHtml(saveAge(O) === 'new' ? SAVE_NEW_MSG : SAVE_OLD_MSG)}</span></div><div class="two"><button class="pb small quiet" data-a="acc-aside-save">Download it</button></div></div>`;
  return `<div class="acc-box acc-aside"><div class="acc-t"><b>Set aside: ${name}</b><span class="note">The game from ${escapeHtml(A.from)}, set aside ${when}. Bringing it back sets this one aside instead.</span></div><div class="two"><button class="pb small" data-a="acc-aside-back">Bring it back</button><button class="pb small quiet" data-a="acc-aside-save">Download it</button></div></div>`;
}
/* the save's document online (firestore.rules saves/{uid} takes these keys only). RL-10b: t is the server's time of
   the write, the ranch clock's anchor (logic/ranch-clock.js) */
function accountSaveDoc() {
  return {
    json: JSON.stringify(saveData),
    savedAt: saveData.savedAt || Date.now(),
    saveVersion: SAVE_VERSION,
    name: (saveData.avatar && saveData.avatar.name) || '',
    game: 'Pocket Billies',
    t: firebase.firestore.FieldValue.serverTimestamp(),
  };
}
/* RL-10b: the server's time on the save (a Firestore Timestamp) in ms, or 0 */
const accountServerMs = d => (d && d.t && typeof d.t.toMillis === 'function' ? d.t.toMillis() : 0);
/* RL-10b: after this session's first write, the save read back once: its server time against the phone's clock
   around the write is the clock's skew (ranchSkew, memory only), and the server time is the ranch clock's floor */
function accountMeasureClock(before) {
  if (account.clock) return;
  account.clock = 'measuring';
  const after = Date.now(),
    R = RULES.ranch || { guardMs: 60000 };
  account.db
    .collection('saves')
    .doc(account.user.uid)
    .get({ source: 'server' })
    .then(snap => {
      const ms = accountServerMs(snap.exists ? snap.data() : null);
      if (!ms) {
        account.clock = '';
        return;
      }
      setRanchSkew(clockSkew(before, after, ms, R));
      setRanchFloor(Math.max(ranchFloor, ms));
      account.clock = 'known';
    })
    .catch(() => {
      account.clock = '';
    });
}
/* called by save()'s flush: writes to the account (a moment later, so a burst of saves is one write) */
function flushAccountSave(now) {
  if (!account.user || !account.db) return false;
  if (saveHold) return true;
  clearTimeout(account.t);
  const go = () => {
    /* RL-8: not mid-way through a run's battle (game-state.js saveHeld): the account keeps its start */
    if (!account.user || saveHold || saveHeld()) return;
    const before = Date.now();
    account.db
      .collection('saves')
      .doc(account.user.uid)
      .set(accountSaveDoc())
      .then(() => accountMeasureClock(before))
      .catch(accountError);
  };
  if (now) go();
  else account.t = setTimeout(go, 1500);
  return true;
}
async function accountSignIn() {
  if (!account.auth) {
    toast(
      accountOn()
        ? 'Sign-in is still starting. Try again in a moment.'
        : 'Accounts aren’t set up in this copy of the game.'
    );
    return;
  }
  if (account.busy) return;
  account.busy = true;
  const p = new firebase.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try {
    await account.auth.signInWithPopup(p);
  } catch (e) {
    if (e && /popup-blocked|operation-not-supported|popup-closed-by-browser/.test(e.code || ''))
      try {
        await account.auth.signInWithRedirect(p);
      } catch (e2) {
        accountError(e2);
      }
    else if (!(e && /popup-closed-by-user|cancelled-popup/.test(e.code || ''))) accountError(e);
  } finally {
    account.busy = false;
  }
}
async function accountSignOut() {
  if (!account.auth) return;
  try {
    save();
    if (!saveHold)
      await new Promise(r => {
        account.db.collection('saves').doc(account.user.uid).set(accountSaveDoc()).then(r, r);
      });
    await account.auth.signOut();
    /* RL-10b: this browser's own game counts on its own clock again */
    setRanchSkew(0);
    setRanchFloor(0);
    account.clock = '';
  } catch (e) {
    accountError(e);
  }
}
function accountError(e) {
  console.error(e);
  const c = (e && e.code) || '';
  account.err =
    c === 'auth/unauthorized-domain'
      ? 'This web address isn’t allowed to sign in yet (Firebase → Authentication → Settings → Authorized domains).'
      : c === 'permission-denied'
        ? 'Your save couldn’t be stored (the database rules don’t allow it).'
        : /network/.test(c)
          ? 'No connection: your game is kept in this browser and goes online later.'
          : 'Sign-in didn’t work: ' + ((e && e.message) || c);
  toast(account.err);
  refreshAccount();
}
/* ---------- what shows ---------- */
const accountAvatarHTML = u =>
  u.photo
    ? `<img class="acc-ph" src="${escapeHtml(u.photo)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="acc-ph acc-ini">${escapeHtml((u.name || '?')[0].toUpperCase())}</span>`;
const GOOGLE_ICON_SVG =
  '<svg class="acc-g" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"/><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8.1l3-2.3z"/><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/></svg>';
provide({ GOOGLE_ICON_SVG }); /* to-module */
/* the corner of the title: who's playing, or a sign-in button */
function accountChipHTML() {
  if (!accountOn()) return '';
  if (!account.ready) return '<span class="acc-chip quiet">Signing in…</span>';
  if (account.user)
    return `<button class="acc-chip" data-a="acc-menu" title="Signed in as ${escapeHtml(account.user.email || account.user.name)}">${accountAvatarHTML(account.user)}<span>${escapeHtml(account.user.name.split(' ')[0])}</span></button>`;
  return `<button class="acc-chip google" data-a="acc-in">${GOOGLE_ICON_SVG}<span>Sign in with Google</span></button>`;
}
/* Settings → Save */
function accountSettingsHTML() {
  if (!accountOn())
    return `<div class="acc-box"><b>Your account</b><p class="note">Accounts aren’t set up in this copy of the game, so your game is kept in this browser.</p></div>`;
  if (account.user)
    return `<div class="acc-box">${accountAvatarHTML(account.user)}<div class="acc-t"><b>${escapeHtml(account.user.name)}</b><span class="note">${escapeHtml(account.user.email)} · your game is saved to this account</span></div><button class="pb small quiet" data-a="acc-out">Sign out</button></div>${account.err ? `<p class="note warn">${escapeHtml(account.err)}</p>` : ''}`;
  return `<div class="acc-box"><div class="acc-t"><b>Play on your own save</b><span class="note">Sign in with Google and your game is kept online, so you can carry on from any device. Everyone who signs in gets their own save.</span></div><button class="pb small acc-gbtn" data-a="acc-in">${GOOGLE_ICON_SVG} Sign in with Google</button></div>${account.err ? `<p class="note warn">${escapeHtml(account.err)}</p>` : ''}`;
}
function refreshAccount() {
  /* the title shows the account in several places (the corner, the sign-in card): draw it again, then it may continue */
  if (typeof titleScreen !== 'undefined' && titleScreen.on && !uiState.modal) {
    render();
    if (typeof titleAutoCheck === 'function') titleAutoCheck();
  }
  if (typeof settingsRefresh === 'function') settingsRefresh();
}
document.addEventListener(
  'click',
  ev => {
    const el =
      ev.target.closest &&
      ev.target.closest(
        '[data-a="acc-in"],[data-a="acc-out"],[data-a="acc-menu"],[data-a="acc-aside-back"],[data-a="acc-aside-save"]'
      );
    if (!el) return;
    ev.stopPropagation();
    ev.preventDefault();
    const a = el.dataset.a;
    if (a === 'acc-aside-back' || a === 'acc-aside-save') {
      const A = accountSetAsideRead();
      if (!A) return;
      if (a === 'acc-aside-save') {
        const u = URL.createObjectURL(new Blob([A.json], { type: 'application/json' })),
          l = document.createElement('a');
        l.href = u;
        l.download = 'pocket-billies-set-aside.json';
        l.click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
        return;
      }
      let S = null;
      try {
        S = loadSave(JSON.parse(A.json));
      } catch (e) {}
      if (!S) return;
      accountSetAside(JSON.stringify(saveData), 'before you brought the other back');
      setSaveData(S);
      saveData.avatar = cleanTrainer(saveData.avatar, saveData.gender);
      saveData.savedAt = Date.now();
      applyPreferences();
      writeStoredSave(saveData);
      flushAccountSave(true);
      render();
      if (typeof settingsRefresh === 'function') settingsRefresh();
      toast('The set-aside game is back.');
      return;
    }
    if (a === 'acc-in') accountSignIn();
    else if (a === 'acc-out') accountSignOut();
    else
      modal({
        title: account.user ? account.user.name : 'Account',
        html: `<p>${escapeHtml(account.user ? account.user.email : '')}</p><p class="note">Your game is saved to this account. Signing out loads this browser’s own game instead; sign in again any time to carry on.</p>`,
        btns: [
          {
            l: 'Sign out',
            c: 'quiet',
            f: () => {
              closeModal();
              accountSignOut();
            },
          },
          { l: 'Keep playing', c: 'gold', f: closeModal },
        ],
      });
  },
  true
);
