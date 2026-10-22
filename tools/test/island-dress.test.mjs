// Island track IS-9: the hub island's dressing (tools/island-dress.mjs, the last step of build-copperleaf.mjs). The same
// map gives the same props; none lands in the pasture's or the barn's zone (IS-8's), the town's zone, on a plot, a
// street, path or trail, or in water; the forest gets its trees; and the walk from the hub reaches every cell it reached
// without the dressing, bar the props' own footprints. The game's Copperleaf is the tool's own output.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { islandDress } from '../island-dress.mjs';
import { islandPointIn } from '../../game/js/logic/island.js';
import { mapgenReach } from '../../game/js/logic/mapgen.js';

const D = readGameData(),
  hub = D.maps.copperleaf,
  town = { ...hub, props: hub.props.filter(p => !p.dress) },
  tileAt = (x, z) => (hub.tiles[hub.h - 1 - Math.floor(z)] || '')[Math.floor(x)];

test('the same map gives the same dressing, and Copperleaf carries it', () => {
  const a = islandDress(town, D.scenery),
    b = islandDress(town, D.scenery);
  assert.deepEqual(a.props, b.props);
  assert.deepEqual(
    hub.props.filter(p => p.dress),
    a.props,
    'copperleaf.json is not build-copperleaf.mjs output: run node tools/build-copperleaf.mjs'
  );
});

test('nothing in the pasture, the barn, the town, on a street or in water; trees in the forest', () => {
  const { props, counts } = islandDress(town, D.scenery);
  const skip = hub.zones.filter(Z => ['pasture', 'barn', 'town'].includes(Z.k));
  assert.ok(skip.some(Z => Z.k === 'pasture'));
  for (const p of props) {
    for (const Z of skip) assert.ok(!islandPointIn(Z.poly, p.x, p.z), `${p.k} at ${p.x},${p.z} in the ${Z.k} zone`);
    assert.ok(!'wdpvcu'.includes(tileAt(p.x, p.z)), `${p.k} at ${p.x},${p.z} on ${tileAt(p.x, p.z)}`);
    assert.equal(p.dress, 1);
  }
  const trees = Object.keys(counts)
    .filter(k => k.startsWith('tree_'))
    .reduce((a, k) => a + counts[k], 0);
  assert.ok(trees >= 120, `${trees} trees`);
  for (const k of ['beach_grass', 'driftwood', 'shells', 'scree', 'cairn', 'summit_lookout'])
    assert.ok(counts[k] > 0, `no ${k}`);
});

test('the dressing shuts nothing in', () => {
  const { props } = islandDress(town, D.scenery),
    a = mapgenReach(town, D.scenery, hub.hub, { slope: true }),
    b = mapgenReach({ ...town, props: [...town.props, ...props] }, D.scenery, hub.hub, { slope: true });
  let lost = 0;
  for (let q = 0; q < a.dist.length; q++) if (a.dist[q] >= 0 && b.dist[q] < 0 && !b.blk[q]) lost++;
  assert.equal(lost, 0, `${lost} half-metre cells shut in`);
});
