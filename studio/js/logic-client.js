'use strict';
/* ================= THE LOGIC WORKER, FROM THE PAGE (Studio plan Phase 2, T2.4) =================
   logicAsk(fn, ...args) runs one of the game's logic functions on the Studio's data as it is now (unsaved changes
   included) in logic-worker.js, a module worker, and resolves with its value (or rejects with the logic's error).
   One worker per data version: the version is the draft's JSON text (`_` keys left out, as a save leaves them; about
   20 ms for the whole data). The worker is made on the first ask and kept while the data stays the same; an ask on
   other data ends it (its waiting asks reject with "replaced") and makes a new one. Nothing from a save is sent.
   The message shapes are in logic-worker.js. Phase 3's dashboard asks for its own functions the same way.
   Studio plan T3.4: a second worker, Base, holds the data as the Studio loaded it (studioState.loadedText, the loaded
   commit's), so the Run Lab's Simulate card runs the same seeds on both: logicAskBase(fn, ...args). Each worker keeps
   its own state (logicWorker for the draft, logicWorkerBase), made and replaced the same way. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { provide } from '../../game/js/hooks.js';
import { studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  logicAsk: [() => logicAsk, v => (logicAsk = v)],
  logicAskBase: [() => logicAskBase, v => (logicAskBase = v)],
  logicAskOn: [() => logicAskOn, v => (logicAskOn = v)],
  logicDataText: [() => logicDataText],
  logicSlot: [() => logicSlot],
  logicWorker: [() => logicWorker],
  logicWorkerBase: [() => logicWorkerBase],
  logicWorkerStart: [() => logicWorkerStart, v => (logicWorkerStart = v)],
  logicWorkerStop: [() => logicWorkerStop, v => (logicWorkerStop = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** a worker slot's state: its worker, the data text it holds, and its asks */
const logicSlot = () => ({
  /** @type {Worker | null} */
  w: null,
  json: '',
  v: 0,
  n: 0,
  /** @type {Map<number, { res: (v: any) => void, rej: (e: Error) => void }>} */
  asks: new Map(),
  /** 'off' (none yet), 'loading', 'ready' or 'failed', and how long the data took to load in it */
  state: 'off',
  loadMs: 0,
  error: '',
  made: 0,
});
const logicWorker = logicSlot(),
  logicWorkerBase = logicSlot();
/** the data the worker is given: the Studio's, as a save writes it (no `_` keys: the Studio's in-memory caches) */
const logicDataText = (D = studioState.D) =>
  JSON.stringify(D, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v));
provide({ logicDataText }); /* to-module */

function logicWorkerStop(/** @type {string} */ why, W = logicWorker) {
  if (W.w) W.w.terminate();
  W.w = null;
  for (const a of W.asks.values()) a.rej(new Error(why));
  W.asks.clear();
}
function logicWorkerStart(/** @type {string} */ json, W = logicWorker) {
  logicWorkerStop('replaced', W);
  const v = ++W.v;
  W.json = json;
  W.state = 'loading';
  W.error = '';
  let w;
  try {
    w = new Worker(new URL('js/logic-worker.js', document.baseURI), { type: 'module' });
  } catch (e) {
    W.state = 'failed';
    W.error = `this browser can’t run the logic worker (${e.message || e})`;
    return null;
  }
  W.w = w;
  W.made++;
  w.onmessage = ev => {
    const m = ev.data || {};
    if (v !== W.v) return;
    if (m.kind === 'ready') Object.assign(W, { state: 'ready', loadMs: m.ms });
    else if (m.kind === 'failed') Object.assign(W, { state: 'failed', error: m.error });
    else if (m.kind === 'answer') {
      const a = W.asks.get(m.id);
      W.asks.delete(m.id);
      if (a) m.ok ? a.res(m.value) : a.rej(new Error(m.error));
    }
  };
  w.onerror = ev => {
    if (v !== W.v) return;
    W.state = 'failed';
    W.error = (ev && ev.message) || 'the logic worker stopped';
    logicWorkerStop(W.error, W);
  };
  w.postMessage({ kind: 'data', v, version: typeof PB_VERSION === 'string' ? PB_VERSION : '', json });
  return w;
}
/** run a logic function (logic-worker.js LOGIC_WORKER_FNS) on the data as it is now
 * @param {string} fn @param {...any} args @returns {Promise<any>} */
export function logicAsk(fn, ...args) {
  return logicAskOn(logicWorker, logicDataText(), fn, args);
}
/** Studio plan T3.4: the same on the data as the Studio loaded it (the Base worker)
 * @param {string} fn @param {...any} args @returns {Promise<any>} */
export function logicAskBase(fn, ...args) {
  if (!studioState.loadedText) return Promise.reject(new Error('the data as loaded is not kept'));
  return logicAskOn(logicWorkerBase, studioState.loadedText, fn, args);
}
/** an ask on a worker slot holding this data text (made or replaced when it holds other data)
 * @param {any} W @param {string} json @param {string} fn @param {any[]} args @returns {Promise<any>} */
function logicAskOn(W, json, fn, args) {
  const w = W.w && json === W.json ? W.w : logicWorkerStart(json, W);
  if (!w) return Promise.reject(new Error(W.error));
  return new Promise((res, rej) => {
    const id = ++W.n;
    W.asks.set(id, { res, rej });
    w.postMessage({ kind: 'ask', id, fn, args });
  });
}
