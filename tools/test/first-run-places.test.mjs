// IN-1: the prepared first run's places, frozen (docs/phases/intro-track.md section 8, "mapgen drift"). Its places are
// made by mapgen from the file's seed like any run's, so a change to mapgen, the scenery or the run's dials moves them,
// and with them the crash site the cold open's cutscene stands on (IN-5). The snapshot holds each place's size, seed
// and a fingerprint of its ground and props, the landing's mast and the crash site's spots, and a picture of the crash
// site in its ground's letters (W the crash props, M the mast, 1-7 the spots, * another prop), so a failure shows what
// moved. After a change meant to move places, look at the landing (the look skill: the debug menu's "Prepared run")
// and remake the snapshot, saying so in the commit:
//   node --test --test-update-snapshots tools/test/first-run-places.test.mjs
import { test } from 'node:test';
import { GAME_DATA, data, fn, hooks, modules } from './setup-real.mjs';

const F = GAME_DATA.firstRun,
  FR = modules['first-run'],
  { runWorldData } = modules['run-world-data'];

/** a short fingerprint of a string (FNV-1a, 32 bits, hex) @param {string} t */
const print = t => {
  let h = 0x811c9dc5;
  for (let k = 0; k < t.length; k++) h = Math.imul(h ^ t.charCodeAt(k), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};

test('the prepared run’s places and its crash site stay where they are', t => {
  const s = fn('newSave')();
  s.started = true;
  s.starter = data.RULES.start.starters[0];
  hooks.provide({ saveData: s, activeBattle: null });
  s.team.push(fn('makeBilly')(s.starter + '0', data.RULES.start.starterLevel));
  const run = modules['run-start'].runStartPrepared(s, {
      ...runWorldData(),
      unlockData: { unlocks: GAME_DATA.unlocks, buildings: GAME_DATA.buildings },
    }),
    scenes = modules['run-scenes'].runScenesMake(run, runWorldData());
  const places = scenes.map((sc, i) => ({
    node: `${i} ${run.map.nodes[i].type}`,
    size: [sc.w, sc.h],
    seed: sc.gen ? sc.gen.seed : null,
    ground: print((sc.tiles || []).join('\n')),
    props: [
      (sc.props || []).length,
      print((sc.props || []).map(p => `${p.k}@${Math.round(p.x * 10)},${Math.round(p.z * 10)}`).join(';')),
    ],
  }));
  const L = scenes[0],
    mast = FR.firstRunMast(L),
    spots = FR.firstRunSpots(L),
    names = Object.keys(spots),
    xs = Object.values(spots).map(p => p.x),
    zs = Object.values(spots).map(p => p.z),
    [x0, x1, z0, z1] = [
      Math.floor(Math.min(...xs)) - 9,
      Math.ceil(Math.max(...xs)) + 9,
      Math.floor(Math.min(...zs)) - 4,
      Math.ceil(Math.max(...zs)) + 4,
    ],
    at = (/** @type {number} */ x, /** @type {number} */ z) => (/** @type {any} */ p) =>
      Math.floor(p.x) === x && Math.floor(p.z) === z,
    picture = [];
  /* north at the top, as the camera sees it from the south */
  for (let z = z1; z >= z0; z--) {
    let line = '';
    for (let x = x0; x <= x1; x++) {
      const spot = names.findIndex(k => at(x, z)(spots[k])),
        p = (L.props || []).find(at(x, z));
      line +=
        spot >= 0
          ? String(spot + 1)
          : p
            ? p.crash
              ? 'W'
              : p === mast
                ? 'M'
                : '*'
            : ((L.tiles || [])[z] || '')[x] || ' ';
    }
    picture.push(`${String(z).padStart(3)} ${line}`);
  }
  t.assert.snapshot({
    seed: F.seed,
    places,
    mast: mast && { x: mast.x, z: mast.z, rot: mast.rot || 0 },
    spots,
    crash: (L.props || []).filter(p => p.crash).map(p => ({ k: p.k, x: p.x, z: p.z, rot: p.rot })),
    key: names.map((k, n) => `${n + 1} ${k}`).join(', '),
    picture,
  });
});
