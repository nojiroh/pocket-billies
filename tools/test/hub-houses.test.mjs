// Buildings track BD-7 (with BD-4b's placing): the house kit on Copperleaf (tools/hub-houses.mjs, used by
// tools/build-copperleaf.mjs). The plots grow only onto clear ground and keep their fronts; every house plot gets a
// kit house that fits it, none twice, neighbours (within 20 m) sharing no body or roof; Granny Juniper's one-off
// cottage, the windmill kit on the farm and the bubble cars by the shop and the station are on the map.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GROW_TO, NEAR, growPlots, inPlot, kitLooks, pickHouses } from '../hub-houses.mjs';

const read = f => JSON.parse(readFileSync(new URL(`../../game/data/${f}`, import.meta.url), 'utf8'));
const S = read('scenery.json'),
  C = S.props,
  M = read('maps/copperleaf.json');

test('a plot grows back and sideways onto clear ground, its front line kept, and no further', () => {
  /* a plot facing +x (a 0) at the origin; a street along x = 1.7 in front of it and a wall of bad ground at z = 2.6 */
  const L = { k: 'house', x: 0, z: 0, w: 3.8, d: 2.8, a: 0 },
    bad = (x, z) => x > 1.7 || z > 2.6,
    [G] = growPlots([L], bad);
  assert.ok(G.w > L.w && G.d > L.d, `grew: ${G.w} x ${G.d}`);
  assert.ok(G.w <= GROW_TO[0] && G.d <= GROW_TO[1]);
  assert.ok(Math.abs(G.x + G.d / 2 - (L.x + L.d / 2)) < 0.011, 'the front line stays');
  for (let x = G.x - G.d / 2 + 0.2; x < G.x + G.d / 2 - 0.2; x += 0.1)
    for (let z = G.z - G.w / 2 + 0.2; z < G.z + G.w / 2 - 0.2; z += 0.1)
      assert.ok(!bad(x, z), `on bad ground at ${x}, ${z}`);
  assert.deepEqual(growPlots([G], bad)[0], G, 'a rerun grows it no more');
  /* other plots are as they were; a plot already bigger than the kit's largest is not touched */
  const F = { k: 'farmhouse', x: 30, z: 0, w: 8, d: 7, a: 0 },
    O = { k: 'lab', x: -30, z: 0, w: 3, d: 3, a: 0 };
  assert.deepEqual(
    growPlots([F, O], () => false),
    [F, O]
  );
});

test('the picker: every plot a house that fits, none twice, neighbours share no body or roof', () => {
  const looks = [
    { k: 'a', box: [3, 2.5], body: 'narrow', roof: 'gable', palette: 'p1', show: false },
    { k: 'b', box: [3, 2.5], body: 'narrow', roof: 'slab', palette: 'p2', show: false },
    { k: 'c', box: [3, 2.5], body: 'wide', roof: 'gable', palette: 'p3', show: true },
    { k: 'd', box: [4.5, 3.4], body: 'tower', roof: 'bulb', palette: 'p1', show: false },
    { k: 'e', box: [3, 2.5], body: 'cob', roof: 'mushroom', palette: 'p2', show: false },
  ];
  const plots = [
    { x: 0, z: 0, w: 3.8, d: 2.8 },
    { x: 6, z: 0, w: 3.8, d: 2.8 },
    { x: 100, z: 0, w: 4.6, d: 3.6 },
  ];
  const pick = pickHouses(plots, looks);
  assert.equal(new Set(pick).size, 3);
  pick.forEach((k, i) => {
    const A = looks.find(L => L.k === k);
    assert.ok(A.box[0] <= plots[i].w && A.box[1] <= plots[i].d, `${k} fits plot ${i}`);
  });
  const [A, B] = pick.slice(0, 2).map(k => looks.find(L => L.k === k));
  assert.ok(A.body !== B.body && A.roof !== B.roof, `${A.k} and ${B.k} are neighbours`);
  assert.equal(pick[0], 'c', 'the showpiece first');
  assert.deepEqual(pickHouses(plots, looks), pick, 'the same plots pick the same houses');
  assert.throws(() => pickHouses([...plots, ...plots, ...plots], looks), /no look for every plot/);
});

const kitOf = p => (/^house_kit_\d\d$/.test(p.k) ? C[p.k] : null);

test('Copperleaf: every house plot holds one kit house that fits it, each a different one, under the neighbour rule', () => {
  const plots = M.plots.filter(L => L.k === 'house' || L.k === 'farmhouse'),
    houses = M.props.filter(kitOf);
  assert.equal(houses.length, plots.length, `${houses.length} kit houses for ${plots.length} plots`);
  assert.equal(new Set(houses.map(p => p.k)).size, houses.length, 'no house twice');
  assert.equal(
    M.props.filter(p => /^cottage_(moss|solar)$/.test(p.k)).length,
    0,
    'the old cottages are left to the run towns'
  );
  for (const L of plots) {
    const H = houses.filter(p => inPlot(L, p.x, p.z, 0.05));
    assert.equal(H.length, 1, `plot at ${L.x}, ${L.z}: ${H.map(p => p.k)}`);
    const [w, d] = C[H[0].k].box;
    assert.ok(w <= L.w + 0.01 && d <= L.d + 0.01, `${H[0].k} (${w} x ${d}) on a ${L.w} x ${L.d} plot`);
    assert.equal(H[0].act, 'house');
  }
  for (const p of houses)
    for (const q of houses) {
      if (p === q || Math.hypot(p.x - q.x, p.z - q.z) >= NEAR) continue;
      const a = kitOf(p).kit,
        b = kitOf(q).kit;
      assert.ok(
        a.body !== b.body && a.roof !== b.roof,
        `${p.k} and ${q.k}: ${a.body}/${a.roof} next to ${b.body}/${b.roof}`
      );
    }
  assert.ok(
    houses.some(p => kitOf(p).kit.show),
    'a showpiece on the hub'
  );
  assert.ok(kitLooks(C).length >= houses.length);
});

test("Copperleaf: Granny Juniper's one-off cottage, the windmill kit on the farm, bubble cars by the shop and the station", () => {
  const J = M.props.find(p => p.k === 'cottage_juniper');
  assert.ok(J && J.act === 'home', "Juniper's cottage");
  assert.equal(C.cottage_juniper.model, 'scene/next/models/cottage_juniper_cob.json');
  assert.equal(C.cottage_juniper.vary.size, 0, 'no random size: its footprint is fixed');
  const rec = JSON.parse(readFileSync(new URL(`../../game/art/${C.cottage_juniper.model}`, import.meta.url), 'utf8'));
  assert.ok(
    rec.layers.some(l => l.name === 'teapot chimney'),
    'the teapot chimney'
  );
  assert.ok(
    C.cottage_juniper.fx.some(e => e.k === 'smoke'),
    'smoke from it'
  );

  const mills = M.props.filter(p => p.k === 'windmill'),
    looks = [C.windmill, ...C.windmill.variants],
    designs = new Set(mills.map(p => looks[p.v | 0].kit.design));
  assert.ok(mills.length >= 3 && mills.length <= 5, `${mills.length} windmills`);
  assert.equal(designs.size, mills.length, 'each a different design');

  const cars = M.props.filter(p => p.k === 'bubble_car');
  for (const k of ['shop', 'train_station']) {
    const B = M.props.find(p => p.k === k);
    assert.ok(
      cars.some(c => Math.hypot(c.x - B.x, c.z - B.z) < 9),
      `a bubble car by the ${k}`
    );
  }
  assert.ok(new Set(cars.map(c => c.v | 0)).size >= 2, 'more than one look');
});
