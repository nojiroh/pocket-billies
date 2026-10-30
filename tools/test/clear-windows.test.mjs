// Buildings track BD-F: tools/clear-windows.py judges a turned building (its `rot`) in its own frame, as the game turns
// it (game/js/logic/prop-turn.js): its windows are on its turned front, the camera looks straight at that front, and its
// footprint and doorway turn with it. A made-up scene (no game data): a hut with one window and two solid "trees".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOL = fileURLToPath(new URL('../clear-windows.py', import.meta.url));
const python = spawnSync('python3', ['-c', 'import PIL']).status === 0;

/* The hut stands at (20, 20). Its window is 0.35-0.82 m right of its door and 1.5-2 m up. At rot 90 its front faces +x
   (the game's door `out` is [sin, -cos]), so the window is at x 20, z 20.35-20.82. Tree `east` stands 2 m out of that
   front; tree `south` stands 2 m out of where an unturned front would be. */
const SCRIPT = String.raw`
import importlib.util, json, os, sys
sys.path.insert(0, os.path.dirname(sys.argv[1]))
s = importlib.util.spec_from_file_location('cw', sys.argv[1]); CW = importlib.util.module_from_spec(s); s.loader.exec_module(CW)
P = 34
CW._A['tree.png'] = (64, 128, bytes([255]) * (64 * 128))
C = {'hut': dict(box=[4, 3], door=dict(x=0), img='hut.png', ox=-68, oy=-120, fx=[dict(k='window', x=20, y=-60)]),
     'tree': dict(img='tree.png', ox=-32, oy=-128)}
def scene(rot):
    hut = dict(k='hut', x=20, z=20); hut.update(rot=rot) if rot else None
    return dict(w=40, h=40, props=[hut, dict(k='tree', x=22, z=20.6), dict(k='tree', x=20.6, z=18)])
out = {}
for rot in (0, 90):
    sc = scene(rot)
    W = CW.windows_of(sc, C, P)
    out[rot] = dict(
        wins=[dict(k=w['k'], rot=w['rot'], x0=round(w['x0'], 2), x1=round(w['x1'], 2)) for w in W],
        hid={['', 'east', 'south'][n]: round(c, 2) for (_, n, c) in CW.occluders(sc, C, P, W)},
        blocked={name: CW.blocked(sc, C, P, 1, x, z) for name, (x, z) in dict(
            inside=(17.5, 18.5), door=(22.2, 19), unturned_inside=(20.5, 23), clear=(25, 25)).items()})
sc = scene(90); log = []
moved = CW.clear_scene(sc, C, P, fix=True, log=log)
out['fix'] = dict(moved=moved, left=len(CW.occluders(sc, C, P)), east=[sc['props'][1]['x'], sc['props'][1]['z']])
print(json.dumps(out))
`;
const run = () => {
  const r = spawnSync('python3', ['-c', SCRIPT, TOOL], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

test("a turned building's window is found on its turned front and judged from it", { skip: !python }, () => {
  const r = run();
  assert.deepEqual(r[90].wins, [{ k: 'hut', rot: 90, x0: 20.35, x1: 20.82 }]);
  assert.ok(r[90].hid.east > 0.22, `the tree out of the turned front hides the window (${JSON.stringify(r[90].hid)})`);
  assert.equal(r[90].hid.south, undefined, 'the tree where an unturned front would be hides nothing');
});

test('an unturned building is judged as before', { skip: !python }, () => {
  const r = run();
  assert.deepEqual(r[0].wins, [{ k: 'hut', rot: 0, x0: 20.35, x1: 20.82 }]);
  assert.ok(r[0].hid.south > 0.22, JSON.stringify(r[0].hid));
  assert.equal(r[0].hid.east, undefined);
});

test("a turned building's footprint and doorway turn with it", { skip: !python }, () => {
  const r = run();
  assert.deepEqual(r[90].blocked, { inside: true, door: true, unturned_inside: false, clear: false });
  assert.deepEqual(r[0].blocked, { inside: false, door: false, unturned_inside: true, clear: false });
});

test('--fix moves the tree off the turned front, along it, clear of the hut', { skip: !python }, () => {
  const { fix } = run();
  assert.equal(fix.left, 0);
  assert.equal(fix.moved[0], 1);
  const [x, z] = fix.east;
  assert.ok(x > 20.3, `still out in front of the hut, not in it (${x}, ${z})`);
  assert.ok(Math.abs(z - 20.6) > 0.5, `slid sideways along the east front (${x}, ${z})`);
});
