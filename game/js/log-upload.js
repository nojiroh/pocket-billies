'use strict';
/* ================= DEBUG LOG UPLOAD (phase 13) =================
   Sends a debug log to the developer, only when the player presses Send debug log or has turned on Settings → Send
   debug logs automatically (debug-log.js, sendDebugLog). It loads only then, and reaches the game only through what
   sendDebugLog hands it, so the only thing it imports is the graphics test's name list.
   What is sent: the debug log without its picture of the screen, with every name the player gave (their trainer, their
   Billies' nicknames, their account's name) and any e-mail address taken out, gzipped. It goes to the Firestore
   collection debugLogs/<CODE> (firebase/firestore.rules: anyone may add one, nobody may read, change or list them from
   the game) under a Firebase app and anonymous sign-in of its own, so it never touches the player's account or save
   and is never tied to their Google account. The developer reads a log by its code with firebase/fetch-debug-log.mjs. */
import { graphicsNames, graphicsNamesIn } from './graphics-test.js';

/* the same SDK as account.js (a unit test checks they match) */
export const LOG_SDK_URL = 'https://cdn.jsdelivr.net/npm/firebase@10.12.5/';
export const LOG_COLLECTION = 'debugLogs';
export const LOG_MAX_BYTES = 900000;
export const LOG_REASONS = ['test', 'opening', 'crash', 'manual'];
/* the friend code's letters (firestore.rules codes/): no 0, 1, I or O to misread */
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function logCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length) % CODE_LETTERS.length];
  return s;
}
/* the names a sent log must never hold: graphicsNames (the planted fixture names, the trainer, every nickname) and
   the signed-in account's name and e-mail */
export function logNames(save, planted, user) {
  const names = new Set(graphicsNames(save, planted));
  for (const n of [user && user.name, user && user.email])
    if (typeof n === 'string' && n.trim().length >= 3) names.add(n);
  return [...names];
}
/* the log as it is sent: no picture, names and e-mail addresses replaced in every string (error messages and stacks
   included: a console.warn can hold a stringified object) */
export function logScrub(log, names) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = names.length ? new RegExp(names.map(esc).join('|'), 'gi') : null;
  const text = JSON.stringify(Object.assign({}, log, { screenshot: undefined }));
  return JSON.parse(text, (k, v) =>
    typeof v === 'string' ? (re ? v.replace(re, '[name]') : v).replace(EMAIL, '[e-mail]') : v
  );
}
export async function logGzip(text) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
export async function logGunzip(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(s).text();
}
/* the Firestore document, before gz is made a Firestore Blob; the rules check the same fields */
export async function logPayload(log, names, why) {
  const clean = logScrub(log, names),
    text = JSON.stringify(clean);
  const left = graphicsNamesIn(text, names);
  if (left.length) throw new Error('a name was left in the log');
  const gz = await logGzip(text);
  if (gz.length >= LOG_MAX_BYTES) throw new Error(`the log is too big to send (${Math.round(gz.length / 1024)} KB)`);
  return {
    v: 1,
    build: String(log.build || ''),
    t: Date.now(),
    why: LOG_REASONS.includes(why) ? why : 'manual',
    size: text.length,
    gz,
  };
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('could not load ' + src));
    document.head.appendChild(s);
  });
}
let app = null;
async function logApp(cfg) {
  if (app) return app;
  /* account.js may have loaded the SDK already */
  if (typeof firebase === 'undefined') await loadScript(LOG_SDK_URL + 'firebase-app-compat.js');
  if (!firebase.auth) await loadScript(LOG_SDK_URL + 'firebase-auth-compat.js');
  if (!firebase.firestore) await loadScript(LOG_SDK_URL + 'firebase-firestore-compat.js');
  const a = firebase.apps.find(x => x.name === 'logs') || firebase.initializeApp(cfg, 'logs');
  if (!a.auth().currentUser) await a.auth().signInAnonymously();
  app = a;
  return a;
}
/* G: { cfg, log, names, why, stub }. Returns the code. stub (tools only) takes the payload instead of Firestore. */
export async function uploadDebugLog(G) {
  const p = await logPayload(G.log, G.names, G.why);
  if (G.stub) {
    const code = logCode();
    await G.stub(code, p);
    return code;
  }
  const a = await logApp(G.cfg),
    doc = Object.assign({}, p, { gz: firebase.firestore.Blob.fromUint8Array(p.gz) });
  /* a code already taken is an update, which the rules refuse: try another */
  let last = null;
  for (let i = 0; i < 4; i++) {
    const code = logCode();
    try {
      await a.firestore().collection(LOG_COLLECTION).doc(code).set(doc);
      return code;
    } catch (e) {
      last = e;
      if (!e || e.code !== 'permission-denied') break;
    }
  }
  throw last || new Error('the log couldn’t be sent');
}
