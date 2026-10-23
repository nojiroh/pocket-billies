'use strict';
/* ================= THE STUDIO'S LOGIC WORKER (Studio plan Phase 2, T2.4) =================
   The game's own logic, run on the Studio's draft data in a module worker, so the logic that needs GAMEDATA (rules.js,
   run-loop.js, the battle engine) never loads beside the Studio's stand-ins (game-stand-ins.js). The page side is
   logic-client.js (logicAsk); one worker per data version.
   Messages (fixed for Phase 3's dashboard, which adds its own functions to LOGIC_WORKER_FNS):
   - page -> worker, first and once: { kind: 'data', v, version, json }: json is the draft (studioState.D, `_` keys
     left out) as JSON text, version the page's PB_VERSION. The worker sets GAMEDATA and PB_VERSION, then loads
     logic-worker-modules.js: the page stand-ins tools/test/load-logic.mjs gives (logic-worker-page.js), game-data.js
     and every logic module in load-logic.mjs's order. It answers { kind: 'ready', v, ms } or { kind: 'failed', v, error }.
   - page -> worker: { kind: 'ask', id, fn, args }: fn is a name in LOGIC_WORKER_FNS, args its arguments (plain data).
     It answers { kind: 'answer', id, ok: true, value, ms } or { kind: 'answer', id, ok: false, error }; an ask sent
     before the data has loaded waits for it.
   Spike (T2.4): game-data.js, rules.js, run-loop.js, battle-engine.js and what they import read nothing from window,
   document or localStorage while loading or running; test-globals.js reads window inside a try (off in a worker),
   util.js's $ and $$ use document only when called. Nothing here reads or sends a save: the worker has none. */

/** the functions the page may ask for: name -> (module namespace) -> function */
export const LOGIC_WORKER_FNS = {
  runPreview: (/** @type {any} */ m) => m.runPreview,
  /* T2.3: the map checks over many seeds (data-checks.js) */
  runMapSweep: (/** @type {any} */ m) => m.runMapSweep,
  /* T3.4: the run simulation's report over a seed list (logic-worker-sim.js), for the Simulate card's Base and Draft */
  runSimReport: (/** @type {any} */ m) => m.runSimReport,
};

/** an ask's answer: the function called on the loaded modules (m), or why not
 * @param {{ id: number, fn: string, args?: any[] }} q @param {any} m */
export function logicWorkerAnswer(q, m) {
  const t0 = performance.now();
  try {
    const get = Object.hasOwn(LOGIC_WORKER_FNS, q.fn) ? LOGIC_WORKER_FNS[q.fn] : null,
      f = get && get(m);
    if (typeof f !== 'function') throw new Error(`the logic worker has no ${q.fn}`);
    const value = f(...(q.args || []));
    return { kind: 'answer', id: q.id, ok: true, value, ms: performance.now() - t0 };
  } catch (e) {
    return { kind: 'answer', id: q.id, ok: false, error: (e && e.message) || String(e) };
  }
}

/** the loaded modules (a promise, from the data message on) */
let logicWorkerLoaded = null;
async function logicWorkerLoad(/** @type {{ v: number, version: string, json: string }} */ d) {
  const t0 = performance.now();
  globalThis.PB_VERSION = d.version;
  globalThis.GAMEDATA = JSON.parse(d.json);
  /* one file in the built site (vite.config.js): the page stand-ins, game-data.js and the logic, in this order */
  const m = await import('./logic-worker-modules.js');
  return { m, ms: performance.now() - t0 };
}
// in a worker only (the unit test imports this file in Node for the functions above)
if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope)
  globalThis.onmessage = async ev => {
    const d = ev.data || {};
    if (d.kind === 'data' && !logicWorkerLoaded) {
      logicWorkerLoaded = logicWorkerLoad(d);
      logicWorkerLoaded.then(
        r => postMessage({ kind: 'ready', v: d.v, ms: r.ms }),
        e => postMessage({ kind: 'failed', v: d.v, error: (e && e.message) || String(e) })
      );
    } else if (d.kind === 'ask') {
      if (!logicWorkerLoaded) return postMessage({ kind: 'answer', id: d.id, ok: false, error: 'no data was sent' });
      let r;
      try {
        r = await logicWorkerLoaded;
      } catch (e) {
        return postMessage({ kind: 'answer', id: d.id, ok: false, error: `the data didn’t load: ${e.message || e}` });
      }
      postMessage(logicWorkerAnswer(d, r.m));
    }
  };
