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
import { formatNumber } from './logic/rules.js';
import { SAVE_NEW_MSG, SAVE_VERSION, loadSave, saveAge } from './logic/saves.js';
import {
  ACCOUNT_ID,
  ACCOUNT_KEY,
  SAVE_KEY,
  SAVE_KEY_BASE,
  activeBattle,
  escapeHtml,
  save,
  saveData,
  saveHold,
  setSaveData,
  setSaveHold,
  writeStoredSave,
} from './game-state.js';
import { cleanTrainer } from './person-art.js';
import { applyPreferences, settingsRefresh } from './settings-screen.js';
import { titleScreen, titleStart } from './title.js';
import { initFriends } from './friends.js';
/* eslint-disable no-func-assign */
expose({
  FIREBASE_SDK_URL: [() => FIREBASE_SDK_URL],
  GOOGLE_ICON_SVG: [() => GOOGLE_ICON_SVG],
  account: [() => account],
  accountAvatarHTML: [() => accountAvatarHTML],
  accountChanged: [() => accountChanged, v => (accountChanged = v)],
  accountChipHTML: [() => accountChipHTML, v => ((accountChipHTML = v), provide({ accountChipHTML }))],
  accountError: [() => accountError, v => (accountError = v)],
  accountOn: [() => accountOn, v => ((accountOn = v), provide({ accountOn }))],
  accountSettingsHTML: [() => accountSettingsHTML, v => ((accountSettingsHTML = v), provide({ accountSettingsHTML }))],
  accountSignIn: [() => accountSignIn, v => (accountSignIn = v)],
  accountSignOut: [() => accountSignOut, v => (accountSignOut = v)],
  flushAccountSave: [() => flushAccountSave, v => ((flushAccountSave = v), provide({ flushAccountSave }))],
  initAccount: [() => initAccount, v => (initAccount = v)],
  loadAccountScript: [() => loadAccountScript, v => (loadAccountScript = v)],
  pullAccountSave: [() => pullAccountSave, v => (pullAccountSave = v)],
  refreshAccount: [() => refreshAccount, v => (refreshAccount = v)],
});
/* eslint-enable no-func-assign */
provide({ accountChipHTML, accountOn, accountSettingsHTML, flushAccountSave });
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
/* the save online against the one here: the newer one wins */
async function pullAccountSave() {
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
      html: `<p>This browser has a game with ${escapeHtml((guest.avatar && guest.avatar.name) || 'your trainer')} (${formatNumber(guest.totalSteps || 0)} steps). Use it as the game on your account, ${escapeHtml(account.user.name)}?</p>`,
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
/* called by save()'s flush: writes to the account (a moment later, so a burst of saves is one write) */
function flushAccountSave(now) {
  if (!account.user || !account.db) return false;
  if (saveHold) return true;
  clearTimeout(account.t);
  const go = () => {
    if (!account.user || saveHold) return;
    account.db
      .collection('saves')
      .doc(account.user.uid)
      .set({
        json: JSON.stringify(saveData),
        savedAt: saveData.savedAt || Date.now(),
        saveVersion: SAVE_VERSION,
        name: (saveData.avatar && saveData.avatar.name) || '',
        game: 'Pocket Billies',
      })
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
        account.db
          .collection('saves')
          .doc(account.user.uid)
          .set({
            json: JSON.stringify(saveData),
            savedAt: saveData.savedAt || Date.now(),
            saveVersion: SAVE_VERSION,
            name: (saveData.avatar && saveData.avatar.name) || '',
            game: 'Pocket Billies',
          })
          .then(r, r);
      });
    await account.auth.signOut();
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
  const c = document.querySelector('.ttl-acc');
  if (c) c.innerHTML = accountChipHTML();
  if (typeof settingsRefresh === 'function') settingsRefresh();
}
document.addEventListener(
  'click',
  ev => {
    const el = ev.target.closest && ev.target.closest('[data-a="acc-in"],[data-a="acc-out"],[data-a="acc-menu"]');
    if (!el) return;
    ev.stopPropagation();
    ev.preventDefault();
    const a = el.dataset.a;
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
