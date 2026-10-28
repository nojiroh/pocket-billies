// Characters track CH-4: a figure's mesh built on the helper thread (game/js/figure-worker.js, figure-meshes.js) is the
// very mesh the page builds, and the page builds it itself where there is no thread
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kitBuild, lookFigure } from '../../game/js/logic/figure-kit.js';
import { figureGpuMesh } from '../../game/js/logic/figure-pose.js';

const W = JSON.parse(readFileSync(new URL('../../game/data/wardrobe.json', import.meta.url), 'utf8'));
const chosen = JSON.parse(readFileSync(new URL('../../game/data/people/chosen.json', import.meta.url), 'utf8'));
const figure = () => lookFigure(chosen.look, W.items, { name: 'chosen', figure: chosen.figure });
const same = (a, b) => {
  assert.deepEqual(a.ext, b.ext);
  assert.equal(a.count, b.count);
  assert.deepEqual(a.slots, b.slots);
  assert.deepEqual(a.colours, b.colours);
  assert.ok(a.data.length === b.data.length && a.data.every((x, i) => x === b.data[i]), 'the same vertices');
};

/* the worker's own handler, run here on a copy of the figure as the page would post it */
const workerSelf = { sent: [], postMessage: (m, transfer) => workerSelf.sent.push({ m, transfer }) };
async function workerBuild(msg) {
  globalThis.self = workerSelf;
  await import('../../game/js/figure-worker.js');
  const sent = (workerSelf.sent = []);
  workerSelf.onmessage({ data: msg });
  return sent;
}

test('figure meshes: the helper thread builds what the page builds, and hands the vertices over', async () => {
  const F = figure(),
    sent = await workerBuild({ kind: 'mesh', id: 7, F: structuredClone(F), detail: 1.5, extent: true });
  assert.equal(sent.length, 1);
  const { m, transfer } = sent[0];
  assert.equal(m.kind, 'mesh');
  assert.equal(m.id, 7);
  assert.deepEqual(transfer, [m.data.buffer], 'the vertices handed over, not copied');
  same(m, kitBuild(F, 1.5));
  /* without its extent: the GPU mesh alone */
  const [{ m: g }] = await workerBuild({ kind: 'mesh', id: 8, F: structuredClone(F), detail: 1, extent: false });
  assert.equal(g.ext, null);
  same(g, { ext: null, ...figureGpuMesh(F, 1) });
});

test('figure meshes: asked for once, kept, built on the page where the thread is gone', async () => {
  /* a stand-in thread: the page's message goes to the worker's own handler, its answer back */
  const posted = [];
  globalThis.document = { baseURI: 'http://localhost/game/' };
  globalThis.Worker = class {
    constructor(url, o) {
      assert.match(String(url), /js\/figure-worker\.js$/);
      assert.equal(o.type, 'module');
      this.onmessage = null;
      this.onerror = null;
      globalThis.Worker.last = this;
    }
    postMessage(m) {
      posted.push(m);
    }
    terminate() {}
  };
  const { figureMeshGet, figureMeshReport } = await import('../../game/js/figure-meshes.js'),
    F = figure();
  assert.equal(figureMeshGet('chosen|1', F, 1, true), null, 'none yet: being built');
  assert.equal(figureMeshGet('chosen|1', F, 1, true), null);
  assert.equal(posted.length, 1, 'asked for once');
  assert.equal(figureMeshReport().waiting, 1);
  const [{ m }] = await workerBuild(posted[0]);
  globalThis.Worker.last.onmessage({ data: m });
  const R = figureMeshGet('chosen|1', F, 1, true);
  same(R, kitBuild(F, 1));
  assert.equal(figureMeshGet('chosen|1', F, 1), R, 'kept: the GPU mesh at the same detail is the same');
  assert.equal(figureMeshReport().builds, 1);
  /* the thread fails: the next mesh is built on the page at once */
  globalThis.Worker.last.onerror();
  const P = figureMeshGet('chosen|2', F, 2);
  assert.ok(P && P.count > R.count, 'a finer mesh, built on the page');
  const rep = figureMeshReport();
  assert.equal(rep.page, 1);
  assert.equal(rep.thread, 'the helper thread failed to load');
  delete globalThis.Worker;
  delete globalThis.document;
});
