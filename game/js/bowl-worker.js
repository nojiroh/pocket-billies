/* ================= THE WORLD MAP'S HELPER THREAD (load track LD-5, cutscenes session) =================
   A module worker that works out the world map's ground squares (logic/bowl-terrain.js bowlTerrainRows) off the page:
   the take-off's longest stage, and the first frames of the opening's fall and the Map tab, were the page doing it
   in slices. It gets what the squares read as plain numbers (world-bowl.js worldBowlTerrainStart's P: no save, no
   data file), works out its rows and sends them back as one transferred buffer.
   Messages: page -> worker { kind: 'rows', id, P, j0, j1 }; worker -> page { kind: 'rows', id, j0, j1, band, ms }, or
   { kind: 'failed', id, error }. The page works them out itself where this can't run. */
let bowlWorkerMods = null;
self.onmessage = async ev => {
  const d = ev.data || {};
  if (d.kind !== 'rows') return;
  try {
    const m = await (bowlWorkerMods || (bowlWorkerMods = import('./bowl-worker-modules.js'))),
      t0 = performance.now(),
      N = d.P.N,
      band = new Uint8Array(Math.max(0, d.j1 - d.j0) * N);
    m.bowlTerrainRows(d.P, d.j0, d.j1, band, d.j0);
    self.postMessage(
      { kind: 'rows', id: d.id, j0: d.j0, j1: d.j1, band: band.buffer, ms: Math.round(performance.now() - t0) },
      [band.buffer]
    );
  } catch (e) {
    self.postMessage({ kind: 'failed', id: d.id, error: String((e && e.message) || e) });
  }
};
