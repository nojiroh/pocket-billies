'use strict';
/* ================= POCKET BILLIES STUDIO · drafts (Studio plan Phase 1, T1.1) =================
   What you haven't proposed yet is kept in this browser (IndexedDB), 2 s after the last change and when the tab is
   hidden, so closing the tab, a crash or a phone killing the page loses nothing. Only what is pending is kept (the
   data files that differ from the commit the Studio loaded, the skeletons if they changed, each unsaved picture),
   with that commit: opening the Studio again offers the changes back, and a restore reads everything at that commit
   again, so nothing main changed since is put back (Propose then says which files main changed too).
   The draft goes when a proposal took everything, or on Discard. It stays in this browser: it is never sent anywhere
   and holds no token. GitHub mode only (local mode isn't in this repository). Logic: game/js/logic/draft-record.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { $ } from '../../game/js/util.js';
import { makeCanvas } from '../../game/js/art.js';
import { escapeHtml } from './game-stand-ins.js';
import { draftEmpty, draftFileText, draftParse, draftRecord, draftSummary } from '../../game/js/logic/draft-record.js';
import {
  SAVE_REPLACER,
  ask,
  dialog,
  render,
  snapshot,
  studioProbe,
  studioState,
  toast,
  updateTopBar,
} from './studio-app.js';
import { markArt, spriteCacheClear } from './sprites.js';
import { scheduleCheck } from './check.js';
import { GITHUB_CONFIG, changedDataFiles, gameFilePath, githubFetch, githubMode, repoApiPath } from './github.js';
/* eslint-disable no-func-assign */
expose({
  DRAFT_DB: [() => DRAFT_DB],
  DRAFT_STORE: [() => DRAFT_STORE],
  DRAFT_WAIT: [() => DRAFT_WAIT],
  blobCanvas: [() => blobCanvas],
  draftCapture: [() => draftCapture, v => (draftCapture = v)],
  draftDb: [() => draftDb, v => (draftDb = v)],
  draftDelete: [() => draftDelete],
  draftIdb: [() => draftIdb, v => (draftIdb = v)],
  draftKey: [() => draftKey],
  draftNow: [() => draftNow, v => ((draftNow = v), provide({ draftNow }))],
  draftOff: [() => draftOff, v => (draftOff = v)],
  draftOffer: [() => draftOffer, v => ((draftOffer = v), provide({ draftOffer }))],
  draftRead: [() => draftRead],
  draftSoon: [() => draftSoon, v => ((draftSoon = v), provide({ draftSoon }))],
  draftStart: [() => draftStart, v => ((draftStart = v), provide({ draftStart }))],
  draftState: [() => draftState],
});
/* eslint-enable no-func-assign */
provide({ draftNow, draftOffer, draftSoon, draftStart });
/* to-module: end */
const DRAFT_DB = 'pb-studio-drafts',
  DRAFT_STORE = 'drafts',
  DRAFT_WAIT = 2000;
/* on: drafts are written; off: this browser can't keep them (private mode, blocked storage), or an earlier draft is
   kept for later; baseRigs: the skeletons' text as loaded; art: each picture's Blob by its version, so an unchanged
   picture isn't encoded again */
const draftState = { on: false, off: '', baseRigs: null, art: new Map(), t: 0, chain: Promise.resolve() };
const draftKey = () => `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}@${GITHUB_CONFIG.branch}`;
function draftDb() {
  if (!draftState.db)
    draftState.db = new Promise((res, rej) => {
      const r = indexedDB.open(DRAFT_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(DRAFT_STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('IndexedDB would not open.'));
      r.onblocked = () => rej(new Error('IndexedDB is blocked by another tab.'));
    });
  return draftState.db;
}
/* one request in its own transaction; resolves with its result once the transaction is done */
async function draftIdb(mode, f) {
  const db = await draftDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(DRAFT_STORE, mode),
      q = f(tx.objectStore(DRAFT_STORE));
    tx.oncomplete = () => res(q.result);
    tx.onerror = tx.onabort = () => rej(tx.error || new Error('IndexedDB refused the draft.'));
  });
}
const draftRead = () => draftIdb('readonly', s => s.get(draftKey()));
const draftDelete = () => draftIdb('readwrite', s => s.delete(draftKey()));
/* what is pending now, as a draft record (draft-record.js) */
async function draftCapture() {
  const S = studioState,
    pre = gameFilePath('data/').length,
    files = {};
  if (S.dirty)
    for (const f of changedDataFiles(JSON.parse(JSON.stringify(S.D, SAVE_REPLACER))))
      if (!f.gone) files[f.path.slice(pre)] = f.text;
  const rigs = JSON.stringify(S.rigs),
    art = [];
  for (const [path, c] of S.artDirty) {
    const ver = c._ver || 0,
      had = draftState.art.get(path);
    let blob = had && had.c === c && had.ver === ver ? had.blob : null;
    if (!blob) {
      blob = await new Promise(r => c.toBlob(r, path.endsWith('.webp') ? 'image/webp' : 'image/png', 0.85));
      if (!blob) throw new Error(`${path} could not be turned into a picture.`);
      draftState.art.set(path, { c, ver, blob });
    }
    art.push({ path, blob });
  }
  for (const p of [...draftState.art.keys()]) if (!S.artDirty.has(p)) draftState.art.delete(p);
  return draftRecord({
    key: draftKey(),
    base: githubMode.base,
    login: githubMode.login,
    time: Date.now(),
    files,
    rigsText: S.rigsDirty && rigs !== draftState.baseRigs ? rigs : null,
    art,
  });
}
/* writes what is pending now (or removes the draft when nothing is); one write at a time */
function draftNow() {
  if (!draftState.on) return draftState.chain;
  clearTimeout(draftState.t);
  draftState.chain = draftState.chain
    .then(async () => {
      if (!draftState.on) return;
      const P = studioProbe.on,
        a = P ? performance.now() : 0,
        d = await draftCapture();
      if (draftEmpty(d)) await draftDelete();
      else await draftIdb('readwrite', s => s.put(d, d.key));
      if (P) P('draft', { ms: performance.now() - a, files: Object.keys(d.files).length, art: d.art.length });
    })
    .catch(e => draftOff('Unsent changes can’t be kept in this browser (' + e.message + ').'));
  return draftState.chain;
}
/* after each change (updateTopBar calls this): a write 2 s after the last one */
function draftSoon() {
  if (!draftState.on) return;
  clearTimeout(draftState.t);
  draftState.t = setTimeout(draftNow, DRAFT_WAIT);
}
function draftOff(why) {
  draftState.on = false;
  draftState.off = why;
  clearTimeout(draftState.t);
  const a = $('.top-acts');
  if (a && !$('#draftOff'))
    a.insertAdjacentHTML(
      'afterbegin',
      `<span class="tb warn" id="draftOff" title="${escapeHtml(why)}">⚠ Not kept if the tab closes</span>`
    );
  else if ($('#draftOff')) $('#draftOff').title = why;
}
/* before the data loads: a draft from an earlier visit is offered. Restore pins the Studio to the draft's commit
   (owner's decision, Phase 1): everything is read at it, and Propose says which files main changed since. Returns the
   draft to put back after the data loads, or null */
async function draftOffer() {
  let d;
  try {
    d = draftParse(await draftRead());
  } catch (e) {
    draftOff('Unsent changes can’t be kept in this browser (' + e.message + ').');
    return null;
  }
  if (!d || draftEmpty(d)) return null;
  let head = '';
  try {
    head = (await githubFetch(repoApiPath(`git/ref/heads/${GITHUB_CONFIG.branch}`))).object.sha;
  } catch (e) {}
  const when = new Date(d.time).toLocaleString(),
    moved = d.base && head && head !== d.base;
  const v = await dialog(
    'Unsent changes',
    `<p>This browser kept changes that weren’t proposed: <b>${escapeHtml(draftSummary(d))}</b>, from ${escapeHtml(when)}${d.login ? ' by ' + escapeHtml(d.login) : ''}.</p>` +
      (moved
        ? `<p>Main has new commits since. Restore opens the Studio at the commit these changes were made on, so nothing newer is put back; Propose then names any file main changed too.</p>`
        : '') +
      `<p><b>Later</b> opens the Studio without them and keeps them for next time (nothing new is kept meanwhile).</p>`,
    [
      { l: 'Discard', v: 'discard' },
      { l: 'Later', v: 'later' },
      { l: 'Restore', c: 'primary', v: 'restore' },
    ]
  );
  if (v === 'discard' && (await ask('Delete these unsent changes for good?', 'Delete', 'Keep', 'Discard changes'))) {
    try {
      await draftDelete();
    } catch (e) {}
    return null;
  }
  if (v !== 'restore') {
    draftState.later = true;
    return null;
  }
  if (d.base) {
    githubMode.base = d.base;
    githubMode.baseP = Promise.resolve(d.base);
  }
  return d;
}
const blobCanvas = async blob => {
  const im = await createImageBitmap(blob),
    c = makeCanvas(im.width, im.height);
  c.getContext('2d').drawImage(im, 0, 0);
  if (im.close) im.close();
  return c;
};
/* after the data loaded: puts a restored draft back (pending again, undo empty) and starts keeping drafts */
async function draftStart(d) {
  const S = studioState;
  if (!S.D) return;
  draftState.baseRigs = JSON.stringify(S.rigs);
  if (d)
    try {
      /* everything is read first and put in only when all of it worked: nothing is half restored */
      const files = d.files,
        base = githubMode.data,
        D = Object.keys(files).length
          ? PB_DATA.assemble(JSON.parse(draftFileText(files, base, 'index.json')), p =>
              JSON.parse(draftFileText(files, base, p))
            )
          : null,
        rigs = d.rigsText != null ? JSON.parse(d.rigsText) : null,
        art = [];
      for (const a of d.art) art.push([a.path, await blobCanvas(a.blob)]);
      if (D) {
        S.D = D;
        S.dirty = true;
      }
      if (rigs) {
        S.rigs = rigs;
        window.RIGS = rigs;
        S.rigsDirty = true;
      }
      for (const [path, c] of art) markArt(path, c);
      S.undo = [];
      S.redo = [];
      S.last = snapshot();
      spriteCacheClear();
      render();
      updateTopBar();
      scheduleCheck(true);
      toast('Your unsent changes are back: ' + draftSummary(d) + '.', 'ok');
    } catch (e) {
      /* the draft stays for another try, and none is written over it */
      draftState.later = true;
      toast('The unsent changes could not be restored: ' + e.message + ' They are still kept.', 'err');
    }
  if (draftState.off) return draftOff(draftState.off);
  if (draftState.later) return draftOff('An earlier draft is kept for later; reopen the Studio to restore it.');
  draftState.on = true;
}
if (githubMode.on) {
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') draftNow();
  });
  addEventListener('pagehide', () => draftNow());
}
