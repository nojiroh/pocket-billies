// The cutscene tools, session 1: the opening plays from game/data/cutscenes/opening.json. It says what the code said
// before the move (opening-before-scripts.json, made from cutscene.js at c7c5ad3), the cutscene commands read as the
// stage plays them, the set's maths, and the story checks catch a cutscene's mistakes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';

const { parseScript } = modules['script-parse'];
const { runScript } = modules.script;
const { cutsceneStep, cutsceneNames, cutsceneOffset, cutsceneShotAt, cutsceneCleared } = modules['cutscene-set'];
const { storyFindings } = modules['story-checks'];
const BEFORE = JSON.parse(readFileSync(new URL('./opening-before-scripts.json', import.meta.url), 'utf8')).said;
const OPENING = GAME_DATA.cutscenes.opening;
/* RL-8 (the owner's "fall only", roguelite-track.md 8.20): Blake left the opening: his lines, Hazel's fight with him
   and her lines to him are gone, everything else said as before, in the same order */
const BLAKE_SCENE = new Set([
  'They don’t have a Billie yet, Blake.',
  'Oh, I’d love to.',
  'I have tenure.',
  'Everyone has a type, Blake. Mine is “tenured”.',
  'Now. Where was I? Ah, yes. Three of them, right here.',
]);
const OPENING_NOW = BEFORE.filter(l => l.who !== 'chad' && l.cmd !== 'staged-fight' && !BLAKE_SCENE.has(l.text));
const SPEAKERS = GAME_DATA.story.speakers;
const OWN = ['dressing-room', 'staged-fight', 'pick-starter'];

/** plays a cutscene's script on a stage that writes down the lines and the opening's own commands */
async function play(lines, slots) {
  const said = [];
  const stage = new Proxy(
    {
      say: l => said.push({ who: SPEAKERS[l.who] || l.who, expr: l.expr, text: l.text }),
      choose: () => 0,
    },
    { get: (t, k) => t[k] || (args => OWN.includes(k) && said.push({ cmd: k })) }
  );
  await runScript(parseScript(lines), stage, {
    save: { story: {} },
    id: 'cutscene:opening',
    slots: Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, () => v])),
  });
  return said;
}

test('the opening says what it said before, in the same order, with the same commands between (Blake left it, RL-8)', async () => {
  const said = await play(OPENING.script, {
    name: 'Pat',
    starter: 'Starterbill',
    counter: 'Counterbill',
    foe: 'Gildlet',
    place: 'Copperleaf Town',
  });
  assert.deepEqual(said, OPENING_NOW);
});

test('the opening is filmed on Copperleaf and names only its own spots and shots', () => {
  assert.equal(OPENING.map, 'copperleaf');
  const N = cutsceneNames(parseScript(OPENING.script));
  for (const n of N.filter(x => x.kind === 'shot')) assert.ok(OPENING.shots[n.name], `shot ${n.name}`);
  for (const n of N.filter(x => x.kind === 'spot'))
    assert.ok(OPENING.spots[n.name] || n.name === 'starter' || n.name in SPEAKERS || n.name === 'you', n.name);
});

test('cutscene commands read the same way everywhere', () => {
  const step = s => {
    const [name, ...args] = s.split(' ');
    return cutsceneStep({ k: 'cmd', line: 0, name, args });
  };
  assert.deepEqual(step('camera trio 1.1 on Blake you'), {
    name: 'camera',
    shot: 'trio',
    s: 1.1,
    on: ['Blake', 'you'],
  });
  assert.deepEqual(step('walk Blake blake 1.5 nowait'), {
    name: 'walk',
    who: 'Blake',
    spot: 'blake',
    s: 1.5,
    nowait: true,
  });
  assert.deepEqual(step('actor Hazel at door down'), { name: 'actor', who: 'Hazel', spot: 'door', dir: 'down' });
  assert.deepEqual(step('wait Blake'), { name: 'wait', who: 'Blake' });
  assert.deepEqual(step('caption 3.4 The Hollow Earth | Copperleaf'), {
    name: 'caption',
    s: 3.4,
    text: ['The Hollow Earth', 'Copperleaf'],
  });
  assert.match(step('actor Hazel door').problem, /who at spot/);
  assert.match(step('act Hazel dance').problem, /pose dance/);
  assert.match(step('camera trio slowly').problem, /seconds or "on"/);
  assert.match(step('fade out red').problem, /colour/);
  /* the parser stops on a cutscene command that doesn't read, with the same words */
  assert.throws(() => parseScript(['screen sleepy']), /screen sleepy/);
  assert.throws(() => parseScript(['caption 3 {plcae} | x']), /unknown slot/);
});

test('a set in the view: the map corner, heights above the ground, aimed between two places, what is cleared', () => {
  assert.deepEqual(cutsceneOffset({ id: 'copperleaf' }, 'copperleaf'), [0, 0]);
  assert.deepEqual(
    cutsceneOffset({ id: 'w:x*', parts: [{ id: 'copperleaf', ox: 30, oz: 12 }] }, 'copperleaf'),
    [30, 12]
  );
  assert.equal(cutsceneOffset({ id: 'w:x*', parts: [{ id: 'marigold', ox: 0, oz: 0 }] }, 'copperleaf'), null);
  const K = cutsceneShotAt({ eye: [1, 2, 3], tgt: [4, 1, 5], fov: 50 }, [10, 20], (x, z) => (x === 11 ? 0.5 : 0.2));
  assert.deepEqual(K, { eye: [11, 2.5, 23], tgt: [14, 1.2, 25], fov: 50, w: 0, abs: 1 });
  assert.deepEqual(cutsceneShotAt({ eye: [0, 1, 0], tgt: [0, 1, 0] }, [0, 0], () => 0, [7, 8]).tgt, [7, 1, 8]);
  const C = {
    spots: { a: [0, 0], b: [10, 0] },
    clear: { areas: [[0, 5, 2, 7]], paths: [['a', 'b']], eyes: [[50, 50]] },
  };
  const props = [
    { k: 'tree', x: 5, z: 0.5 },
    { k: 'tree', x: 1, z: 6 },
    { k: 'tree', x: 50, z: 51 },
    { k: 'house', x: 50, z: 51 },
    { k: 'flower', x: 5, z: 0 },
    { k: 'tree', x: 30, z: 30 },
  ];
  const cat = { tree: {}, house: { box: [3, 3] }, flower: { flat: 1 } };
  const H = cutsceneCleared(C, props, cat, [0, 0]);
  assert.deepEqual(
    props.map(p => H.has(p)),
    [true, true, true, false, false, false]
  );
});

test('the story checks catch a cutscene’s mistakes, and cutscene commands outside a cutscene', () => {
  const G = structuredClone(GAME_DATA);
  G.cutscenes.opening.script = [
    ...G.cutscenes.opening.script,
    'camera nowhere',
    'walk Hazel attic',
    'actor Nobody at door',
  ];
  G.trainers.crude.script = ['actor Blake at door', ...G.trainers.crude.script];
  const F = storyFindings(G).filter(f => f.level === 'problem');
  const has = (script, re) =>
    assert.ok(
      F.some(f => f.script === script && re.test(f.message)),
      `${script} ${re}`
    );
  has('cutscene:opening', /shot nowhere/);
  has('cutscene:opening', /spot attic/);
  has('cutscene:opening', /Nobody: not a speaker/);
  has('trainer:crude', /actor plays only in a cutscene/);
  /* and the data as it is has none */
  assert.deepEqual(
    storyFindings(GAME_DATA)
      .filter(f => f.level === 'problem')
      .map(f => f.text),
    []
  );
});

test('the city opening: its commands read, its names are its own, it runs through, under 30 seconds of waits', async () => {
  const C = GAME_DATA.cutscenes.city,
    step = s => {
      const [name, ...args] = s.split(' ');
      return cutsceneStep({ k: 'cmd', line: 0, name, args });
    };
  assert.equal(C.map, 'city_opening');
  assert.deepEqual(step('actor you at walkFrom up silhouette'), {
    name: 'actor',
    who: 'you',
    spot: 'walkFrom',
    dir: 'up',
    dark: true,
  });
  assert.deepEqual(step('traffic high city_flying_car 9 3'), {
    name: 'traffic',
    lane: 'high',
    prop: 'city_flying_car',
    s: 9,
    count: 3,
  });
  assert.deepEqual(step('hide prop rift'), { name: 'hide', at: 'rift' });
  assert.deepEqual(step('show you'), { name: 'show', who: 'you' });
  assert.match(step('show box').problem, /shows itself/);
  assert.match(step('traffic high car').problem, /lane prop seconds/);
  const tree = parseScript(C.script);
  for (const n of cutsceneNames(tree)) {
    const ok = { shot: C.shots, lane: C.lanes, prop: GAME_DATA.scenery.props }[n.kind];
    if (ok) assert.ok(ok[n.name], `${n.kind} ${n.name}`);
    else if (n.kind === 'spot') assert.ok(C.spots[n.name] || n.name === 'you', n.name);
  }
  /* what the script waits for adds up to the beat sheet's length (docs/city-opening-beats.md: about 21 s) */
  let t = 0;
  for (const n of tree)
    if (n.k === 'cmd' && (n.name === 'wait' || n.name === 'walk')) {
      const S = cutsceneStep(n);
      if (S.s != null && !S.nowait) t += S.s;
    }
  assert.ok(t > 15 && t < 30, `${t} s`);
  const said = await play(C.script, {});
  assert.deepEqual(said, []);
});
