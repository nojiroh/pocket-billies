// WM-4b: a run's region on the world map meets at its seams, on the game's own data. Every place lies on its cells of
// the region grid (logic/run-map.js runSpotCells), side areas' places too (runSideLay); no two overlap; every link's
// two exits (run-scenes.js runSceneExits, the ones the walk joins) face each other and meet at one point when each
// place lies on its cells, so the world map's stamps and roads (world-bowl.js worldBowlExitAt) meet as the walk does.
// An L's outline leaves its cut cell out (runSpotOutline, the fog's).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGameData } from '../data-files.mjs';
import { GAME_DATA, modules } from './setup-real.mjs';

const { runStartPlan } = modules['run-start'],
  { runRegionData } = modules['run-region'],
  { RUN_GRID, runGridSide, runSideLay, runSpotBoxes, runSpotCells, runSpotOutline } = modules['run-map'],
  { runPlaceSize, runSceneExitTo, runSideDoor } = modules['run-scenes'];
const RAW = readGameData(),
  MOVES = GAME_DATA.fieldMoves.moves,
  DATA = {
    nodeTypes: GAME_DATA.nodeTypes,
    biomes: GAME_DATA.biomes,
    rules: GAME_DATA.rules.run,
    unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    region: runRegionData(RAW, RAW.trainers),
    fieldMoves: MOVES,
  },
  C = RUN_GRID.cell,
  FACING = { N: 'S', S: 'N', E: 'W', W: 'E' };
/** an exit's point on its place's edge, metres from its south-west corner */
const exitPoint = (w, h, e) =>
  e.side === 'N' ? [e.t * w, h] : e.side === 'S' ? [e.t * w, 0] : e.side === 'E' ? [w, e.t * h] : [0, e.t * h];
/** the runs: the mast's own (side areas as the rules roll them) and every kind and move forced */
function* plans() {
  for (let k = 0; k < 120; k++) yield [`WM4B${k}`, runStartPlan(`WM4B${k}`, DATA, {})];
  const moves = Object.keys(MOVES);
  for (const kind of ['detour', 'alt'])
    for (let k = 0; k < 90; k++)
      yield [`WM4BS${k}`, runStartPlan(`WM4BS${k}`, DATA, { mods: [`dbg_side_${kind}_${moves[k % moves.length]}`] })];
}

test("the region's places meet at their seams: no overlap, each link's exits face each other at one point", () => {
  let links = 0,
    sides = 0,
    apart = 0;
  for (const [seed, plan] of plans()) {
    const map = plan.map,
      cells = runSpotCells(map);
    assert.ok(cells, `${seed}: cells for every place`);
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) {
        const [a, b] = [cells[i], cells[j]];
        assert.ok(
          !(
            a.at[0] < b.at[0] + b.size[0] &&
            b.at[0] < a.at[0] + a.size[0] &&
            a.at[1] < b.at[1] + b.size[1] &&
            b.at[1] < a.at[1] + a.size[1]
          ),
          `${seed}: ${i} and ${j} overlap`
        );
      }
    /** @type {[number, number][]} */
    const pairs = map.nodes.flatMap((n, i) => n.to.map(j => [i, j]));
    const S = map.side;
    if (S) {
      sides++;
      [S.from, ...S.nodes].forEach((i, k, all) => k && pairs.push([all[k - 1], i]));
    }
    for (const [i, j] of pairs) {
      const a = runSceneExitTo(map, i, j),
        b = runSceneExitTo(map, j, i),
        where = `${seed} ${i}->${j}`;
      assert.ok(a && b, `${where}: exits both ways`);
      assert.equal(b.side, FACING[a.side], `${where}: the exits face each other`);
      const A = runPlaceSize(map, i),
        B = runPlaceSize(map, j),
        [ax, ay] = exitPoint(A.w, A.h, a),
        [bx, by] = exitPoint(B.w, B.h, b),
        pa = [cells[i].at[0] * C + ax, cells[i].at[1] * C + ay],
        pb = [cells[j].at[0] * C + bx, cells[j].at[1] * C + by];
      assert.deepEqual([A.w, A.h], [cells[i].size[0] * C, cells[i].size[1] * C], `${where}: ${i} fills its cells`);
      const touch = !!runGridSide(cells[i], cells[j]);
      /* a side area's place with no free cells by the one before is laid apart (runSideLay); the walk joins it by its
         exits all the same, the world map by a short road */
      if (!touch && map.nodes[j].side) {
        apart++;
        continue;
      }
      assert.ok(touch, `${where}: the places touch`);
      assert.ok(Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 1e-6, `${where}: the exits meet (${pa} vs ${pb})`);
      links++;
    }
    if (S) {
      const lay = runSideLay(map),
        F = map.nodes[S.from],
        door = runSideDoor(map),
        first = cells[S.nodes[0]];
      assert.deepEqual(door, lay.door, `${seed}: the door is the layout's`);
      if (runGridSide({ at: F.at, size: F.size }, first))
        assert.equal(runGridSide({ at: F.at, size: F.size }, first), door.side, `${seed}: the first by its door`);
    }
  }
  assert.ok(links > 2000 && sides > 200, `${links} links, ${sides} side areas`);
  assert.ok(apart <= sides * 0.03, `side places laid apart: ${apart} of ${sides} side areas`);
});

test("an L's outline leaves its cut cell out; a box's is its four corners, anticlockwise", () => {
  const c = C / 1000,
    area = pts =>
      pts.reduce((s, [x, y], k) => s + x * pts[(k + 1) % pts.length][1] - pts[(k + 1) % pts.length][0] * y, 0) / 2;
  const box = runSpotOutline({ x: 0.1, y: -0.2, w: 2 * c, h: c, cut: null });
  assert.equal(box.length, 4);
  assert.ok(Math.abs(area(box) - 2 * c * c) < 1e-12, 'a 2 x 1 box');
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const L = runSpotOutline({ x: 0, y: 0, w: 2 * c, h: 2 * c, cut: [sx, sy] });
      assert.equal(L.length, 6, `cut ${sx} ${sy}`);
      assert.ok(Math.abs(area(L) - 3 * c * c) < 1e-12, `cut ${sx} ${sy}: three cells, anticlockwise`);
      assert.ok(
        !L.some(([x, y]) => Math.abs(x - sx * c) < 1e-12 && Math.abs(y - sy * c) < 1e-12),
        `cut ${sx} ${sy}: the cut corner left out`
      );
    }
  /* the game's Ls: the cut is the node's own cell */
  let Ls = 0;
  for (const [seed, plan] of plans()) {
    const map = plan.map,
      B = runSpotBoxes(map),
      cells = runSpotCells(map);
    map.nodes.forEach((n, i) => {
      if (!n.cut) return assert.equal(B[i].cut, null, `${seed} ${i}`);
      Ls++;
      const [sx, sy] = B[i].cut;
      assert.deepEqual(
        [cells[i].at[0] + (sx > 0 ? 1 : 0), cells[i].at[1] + (sy > 0 ? 1 : 0)],
        n.cut,
        `${seed} ${i}: the cut's corner`
      );
    });
    if (Ls > 40) break;
  }
  assert.ok(Ls > 20, `${Ls} Ls`);
});
