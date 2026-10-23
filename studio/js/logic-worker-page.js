/* ================= THE LOGIC WORKER'S PAGE STAND-INS (Studio plan Phase 2, T2.4) =================
   What the logic asks the page for through hooks.js, as tools/test/load-logic.mjs stands in for it in Node: the first
   import of logic-worker-modules.js, so it is in hooks.js before game-data.js and the logic load (and, in the built
   site, in the same bundle as the hooks.js the logic reads). */
import { provide } from '../../game/js/hooks.js';

/** the page stand-ins @param {(o: object) => void} give hooks.js provide */
export function logicWorkerPage(give) {
  return {
    uiState: { learnQ: [], mq: [] },
    activeBattle: null,
    setActiveBattle: (/** @type {any} */ v) => give({ activeBattle: v }),
    save: () => {},
    toast: () => {},
    render: () => {},
    showPendingWindows: () => {},
    openBattle: () => {},
    playTurnEvents: () => {},
  };
}
// in a worker only (the unit test imports this file in Node beside load-logic.mjs's own stand-ins)
if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope)
  provide(logicWorkerPage(provide));
