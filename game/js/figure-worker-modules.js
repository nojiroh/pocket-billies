/* ================= THE FIGURES' HELPER THREAD'S MODULES (characters track CH-4) =================
   What figure-worker.js loads: the figure kit and the poses, with what they import. On no page; the built site bundles
   it into one file (vite.config.js), as it drops the logic folder. */
export { kitBuild } from './logic/figure-kit.js';
export { figureGpuMesh } from './logic/figure-pose.js';
