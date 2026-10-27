/* ================= THE RUN'S HELPER THREAD'S MODULES (load track LD-4) =================
   What run-worker.js loads once GAMEDATA is set: game-data.js, the water generator (mapgen.js reads it through
   hooks.js) and the two functions a run's places are made from, with everything they import. On no page; the built
   site bundles it into one file (vite.config.js). check-fast's "The run's places from the helper thread" keeps the
   places it makes equal to the page's. */
import './game-data.js';
import './logic/water-gen.js';
import './logic/arena-gen.js';
export { runScenesSlices } from './logic/run-scenes.js';
export { runWorldData } from './logic/run-world-data.js';
