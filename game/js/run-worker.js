/* ================= THE RUN'S HELPER THREAD (load track LD-4) =================
   A module worker that makes a run's places (logic/run-scenes.js runScenesMake) off the page, so the page keeps
   drawing while they are made (18-600 ms a place in Node, a run 1-1.5 s, several times that on a phone). It runs the
   game's own logic on the game's own data: game-data.js reads GAMEDATA as it loads, so the data file is read first
   (data/gamedata.js, the one the page loaded: the browser has it), then the logic (run-worker-modules.js).
   Messages: page -> worker { kind: 'make', id, run, version }; worker -> page { kind: 'step', id, made, of } as the
   places are made, then one { kind: 'scene', id, i, n, scene } per place (each one is copied to the page in a task of
   its own) and { kind: 'done', id, n, ms, places } (WM-3b: each place's node, type, size, shape and ms), or
   { kind: 'failed', id, error }. Nothing here reads or sends a save: it gets the run (its seed and map) and nothing
   else. The page makes the places itself where this can't run (run-world.js runWorldMake). */
let runWorkerMods = null;
async function runWorkerLoad() {
  const t = await (await fetch(new URL('../data/gamedata.js', import.meta.url))).text(),
    i = t.indexOf('window.GAMEDATA=');
  if (i < 0) throw new Error('no game data in data/gamedata.js');
  globalThis.GAMEDATA = JSON.parse(t.slice(i + 'window.GAMEDATA='.length, t.lastIndexOf(';')));
  return import('./run-worker-modules.js');
}
self.onmessage = async ev => {
  const d = ev.data || {};
  if (d.kind !== 'make') return;
  try {
    globalThis.PB_VERSION = d.version;
    const m = await (runWorkerMods || (runWorkerMods = runWorkerLoad())),
      t0 = performance.now(),
      places = [],
      it = m.runScenesSlices(d.run, m.runWorldData(), places);
    let r = it.next();
    for (; !r.done; r = it.next()) self.postMessage({ kind: 'step', id: d.id, made: r.value[0], of: r.value[1] });
    const scenes = r.value,
      ms = Math.round(performance.now() - t0);
    for (let i = 0; i < scenes.length; i++)
      self.postMessage({ kind: 'scene', id: d.id, i, n: scenes.length, scene: scenes[i] });
    self.postMessage({ kind: 'done', id: d.id, n: scenes.length, ms, places });
  } catch (e) {
    self.postMessage({ kind: 'failed', id: d.id, error: String((e && e.message) || e) });
  }
};
