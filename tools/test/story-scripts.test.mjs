// Project Story S1: the scripts in the data, a person's script played as the game plays it (Juniper), start presets
// and safe runs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { data, fn, startedSave } from './setup-real.mjs';

const { parseScript, runScript, saveDuringRun, runBase, applyStoryPreset } = Object.fromEntries(
  ['parseScript', 'runScript', 'saveDuringRun', 'runBase', 'applyStoryPreset'].map(n => [n, fn(n)])
);
const G = data.gameData;
const person = id =>
  Object.values(G.maps)
    .flatMap(sc => sc.people || [])
    .find(p => p.id === id);
const scripts = () => [
  ...Object.values(G.maps).flatMap(sc =>
    (sc.people || []).filter(p => p.script).map(p => ['person:' + p.id, p.script])
  ),
  ...Object.entries(data.TRAINERS)
    .filter(([, T]) => T.script)
    .map(([id, T]) => ['trainer:' + id, T.script]),
];
/** plays a script on a stub: what is said (the text as the data has it, [expression] first), and the commands */
async function play(lines, save, o = {}) {
  const said = [];
  const stage = {
    say: l => said.push((l.expr ? `[${l.expr}] ` : '') + l.text),
    choose: ops => (said.push('? ' + ops.map(x => x.text).join(' | ')), o.pick ?? 0),
  };
  for (const c of ['battle', 'walk', 'face', 'camera']) stage[c] = a => said.push(`<${c} ${a.join(' ')}>`);
  await runScript(parseScript(lines), stage, { save, id: o.id || 'test' });
  return said;
}

test('every script in the data reads', () => {
  const all = scripts();
  assert.ok(all.length >= 3);
  for (const [id, lines] of all) assert.doesNotThrow(() => parseScript(lines), id);
});

test('Juniper in Copperleaf: the first meeting once, then her lines in turn, round again', async () => {
  const P = person('juniper'),
    save = { story: {}, items: {}, coins: {} },
    first = await play(P.script, save, { id: 'person:juniper' });
  assert.equal(first.length, 3, 'the first meeting');
  assert.equal(save.story.met_juniper, 1);
  const cycle = P.script.filter(l => /^ {4}- /.test(l)).map(l => l.replace(/^ {4}- /, '').replace(/ #l:\w+$/, ''));
  assert.ok(cycle.length >= 2, 'the test needs her cycle');
  const heard = [];
  for (let i = 0; i <= cycle.length; i++) heard.push(...(await play(P.script, save, { id: 'person:juniper' })));
  assert.deepEqual(heard, [...cycle, cycle[0]]);
});

test('start presets: place, flags, trainers beaten with their badges, coins and team; an unknown one is null', () => {
  for (const [name, P] of Object.entries(G.story.presets)) {
    const s = startedSave('musk0');
    assert.equal(applyStoryPreset(s, name), P);
    assert.equal(data.LOCATIONS[s.trip.node].id, P.place, name);
    for (const [k, v] of Object.entries(P.flags || {})) assert.equal(s.story[k], v, `${name}: ${k}`);
    for (const t of P.beaten || []) assert.equal(s.flags[t], 1, `${name}: ${t}`);
    assert.deepEqual(
      s.team.map(m => [m.sp, m.lvl]),
      P.team.map(m => [m.sp, m.lvl])
    );
  }
  /* RL-5: a preset that beats every leader gives every badge (planted: before-cass, the ending's, is parked) */
  const leaders = Object.keys(data.TRAINERS).filter(k => data.TRAINERS[k].seat);
  G.story.presets.rl5_badges = { place: G.rules.start.locationId, beaten: leaders, team: [{ sp: 'musk0', lvl: 50 }] };
  try {
    const s = startedSave('musk0');
    applyStoryPreset(s, 'rl5_badges');
    assert.deepEqual([leaders.length, s.seats.length], [8, 8], 'every leader beaten, every badge');
  } finally {
    delete G.story.presets.rl5_badges;
  }
  assert.equal(applyStoryPreset(startedSave('musk0'), 'nope'), null);
});

test('a save taken while a script runs writes the state from before it, and where to carry on', () => {
  const s = { story: { met_chosen: 1 }, items: { honey: 1 }, coins: { gold: 0 }, flags: {}, team: [1] };
  const base = runBase(s);
  s.story.met_juniper = 1;
  s.items.honey = 5;
  s.flags.chad = 1;
  Object.defineProperty(s, 'toJSON', {
    value: () => saveDuringRun(s, base, { script: 'person:juniper', path: [2, 0, 1] }),
  });
  const written = JSON.parse(JSON.stringify(s));
  assert.deepEqual(written.story, { met_chosen: 1, resume: { script: 'person:juniper', path: [2, 0, 1] } });
  assert.deepEqual(written.items, { honey: 1 });
  assert.deepEqual(written.flags, {});
  assert.deepEqual(written.team, [1]);
  assert.equal(s.story.met_juniper, 1, 'the game itself keeps the new state');
});
