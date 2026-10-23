'use strict';
/* ================= THE LOGIC WORKER, FROM THE PAGE (Studio plan Phase 2, T2.4) =================
   logicAsk(fn, ...args) runs one of the game's logic functions on the Studio's data as it is now (unsaved changes
   included) in logic-worker.js, a module worker, and resolves with its value (or rejects with the logic's error).
   One worker per data version: the version is the draft's JSON text (`_` keys left out, as a save leaves them; about
   20 ms for the whole data). The worker is made on the first ask and kept while the data stays the same; an ask on
   other data ends it (its waiting asks reject with "replaced") and makes a new one. Nothing from a save is sent.
   The message shapes are in logic-worker.js. Phase 3's dashboard asks for its own functions the same way. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { studioState } from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  logicAsk: [() => logicAsk, v => (logicAsk = v)],
  logicDataText: [() => logicDataText],
  logicWorker: [() => logicWorker],
  logicWorkerStart: [() => logicWorkerStart, v => (logicWorkerStart = v)],
  logicWorkerStop: [() => logicWorkerStop, v => (logicWorkerStop = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const logicWorker = {
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
};
/** the data the worker is given: the Studio's, as a save writes it (no `_` keys: the Studio's in-memory caches) */
const logicDataText = () => JSON.stringify(studioState.D, (k, v) => (k[0] === '_' && k.length > 1 ? undefined : v));

function logicWorkerStop(/** @type {string} */ why) {
  if (logicWorker.w) logicWorker.w.terminate();
  logicWorker.w = null;
  for (const a of logicWorker.asks.values()) a.rej(new Error(why));
  logicWorker.asks.clear();
}
function logicWorkerStart(/** @type {string} */ json) {
  logicWorkerStop('replaced');
  const v = ++logicWorker.v;
  logicWorker.json = json;
  logicWorker.state = 'loading';
  logicWorker.error = '';
  let w;
  try {
    w = new Worker(new URL('js/logic-worker.js', document.baseURI), { type: 'module' });
  } catch (e) {
    logicWorker.state = 'failed';
    logicWorker.error = `this browser can’t run the logic worker (${e.message || e})`;
    return null;
  }
  logicWorker.w = w;
  logicWorker.made++;
  w.onmessage = ev => {
    const m = ev.data || {};
    if (v !== logicWorker.v) return;
    if (m.kind === 'ready') Object.assign(logicWorker, { state: 'ready', loadMs: m.ms });
    else if (m.kind === 'failed') Object.assign(logicWorker, { state: 'failed', error: m.error });
    else if (m.kind === 'answer') {
      const a = logicWorker.asks.get(m.id);
      logicWorker.asks.delete(m.id);
      if (a) m.ok ? a.res(m.value) : a.rej(new Error(m.error));
    }
  };
  w.onerror = ev => {
    if (v !== logicWorker.v) return;
    logicWorker.state = 'failed';
    logicWorker.error = (ev && ev.message) || 'the logic worker stopped';
    logicWorkerStop(logicWorker.error);
  };
  w.postMessage({ kind: 'data', v, version: typeof PB_VERSION === 'string' ? PB_VERSION : '', json });
  return w;
}
/** run a logic function (logic-worker.js LOGIC_WORKER_FNS) on the data as it is now
 * @param {string} fn @param {...any} args @returns {Promise<any>} */
export function logicAsk(fn, ...args) {
  const json = logicDataText(),
    w = logicWorker.w && json === logicWorker.json ? logicWorker.w : logicWorkerStart(json);
  if (!w) return Promise.reject(new Error(logicWorker.error));
  return new Promise((res, rej) => {
    const id = ++logicWorker.n;
    logicWorker.asks.set(id, { res, rej });
    w.postMessage({ kind: 'ask', id, fn, args });
  });
}
