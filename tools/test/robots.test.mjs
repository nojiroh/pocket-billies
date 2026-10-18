// Phase 17: robots (game/js/logic/fighters.js, rules.js, battle-engine.js) on the game's own data (robots.json,
// rules.json robots): stats and moves from parts, refitting, part HP and breaking, aimed moves, repair, mixed battles
// with Billies, and the save.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { data, fn, hooks, reseed, startedSave } from './setup-real.mjs';

const { ROBOTS, RULES, STAT_IDS, MOVES } = data;
const R = RULES.robots;
const ids = { gem: 'volt', torso: 'vane', armL: 'tesla', armR: 'auger', legs: 'striders' };
const fitOf = o => fn('fitFromIds')(o);
const robot = (o = ids, lvl = 20) => fn('makeRobot')(o.gem, fitOf(o), lvl);
const lead = () => hooks.saveData.team[0];

beforeEach(() => reseed());

test('robots.json: every part fits a slot, and the prototype family has 3 torsos, 6 arms, 3 legs and 3 gems', () => {
  const by = k => Object.values(ROBOTS.parts).filter(p => p.slot === k).length;
  assert.equal(by('torso'), 3);
  assert.equal(by('arm'), 6);
  assert.equal(by('legs'), 3);
  assert.equal(Object.keys(ROBOTS.gems).length, 3);
  for (const [id, p] of Object.entries(ROBOTS.parts)) if (p.slot !== 'torso') assert.ok(MOVES[p.move], `${id} move`);
});

test('a robot: base stats are the floor plus its parts and gem, types are torso + legs, moves come from its parts', () => {
  const m = robot();
  const sp = fn('speciesOf')(m);
  assert.equal(m.sp, 'bot:volt.vane.tesla.auger.striders');
  assert.deepEqual(sp.types, ['Flying', 'Electric']);
  assert.deepEqual(m.moves, ['arcwhip', 'augerbore', 'dashkick', 'overclock']);
  assert.equal(sp.name, 'Volt Vane');
  // the sum by hand, then weight: 30 + 11 + 16 + 20 = 77 kg on legs that carry 100
  const w = 77,
    speed = 1 + R.lightBonus * (1 - w / 100),
    atk = Math.min(1 + R.cap, Math.max(1 - R.cap, Math.pow(w / R.refWeight, R.attackExp)));
  const parts = ['vane', 'tesla', 'auger', 'striders'].map(k => ROBOTS.parts[k].stats).concat([ROBOTS.gems.volt.stats]);
  STAT_IDS.forEach((k, i) => {
    let v = R.baseStat + parts.reduce((a, s) => a + (s[k] || 0), 0);
    if (k === 'hus') v *= speed;
    if (k === 'lev' || k === 'lob') v *= atk;
    assert.equal(sp.base[i], Math.max(1, Math.round(v)), `stat ${k}`);
  });
  assert.equal(fn('maxHp')(m), m.hp);
  assert.equal(fn('speciesById')(m.sp).name, 'Volt Vane');
});

test('weight: too heavy for the legs is slower, heavier hits harder', () => {
  const heavy = fitOf({ ...ids, torso: 'bulwark', armL: 'clamp', armR: 'auger', legs: 'hover' }),
    light = fitOf({ ...ids, torso: 'vane', armL: 'tesla', armR: 'tesla', legs: 'hover' });
  assert.ok(fn('robotAttackFactor')(heavy) > fn('robotAttackFactor')(light));
  assert.ok(
    fn('robotSpeedFactor')(fitOf({ ...ids, torso: 'bulwark', armL: 'clamp', armR: 'auger', legs: 'hover' })) < 1
  );
  assert.ok(fn('robotSpeedFactor')(fitOf({ ...ids, legs: 'treads' })) > 1);
});

test('refitting: the part goes on, the old one back to your parts; a new gem keeps the level; upgrades raise stats', () => {
  const s = startedSave('musk0', 10);
  const m = robot();
  s.team.push(m);
  const p = fn('addPart')('cinder');
  const before = fn('speciesOf')(m).base.slice();
  assert.equal(fn('fitPart')(m, 'armL', p.uid), true);
  assert.equal(m.fit.armL.id, 'cinder');
  assert.ok(
    s.parts.some(x => x.id === 'tesla'),
    'the tesla coil came back'
  );
  assert.ok(m.moves.includes('cindershot') && !m.moves.includes('arcwhip'));
  assert.equal(m.sp, 'bot:volt.vane.cinder.auger.striders');
  assert.equal(fn('fitPart')(m, 'legs', s.parts.find(x => x.id === 'tesla').uid), false, 'an arm is not legs');
  const g = fn('addPart')('ember'),
    lvl = m.lvl;
  assert.equal(fn('fitPart')(m, 'gem', g.uid), true);
  assert.equal(m.gem, 'ember');
  assert.equal(m.lvl, lvl);
  assert.ok(
    s.parts.some(x => x.id === 'volt'),
    'the old gem is a spare now'
  );
  assert.ok(m.moves.includes('flarecore'));
  assert.ok(fn('upgradePart')(m.fit.torso));
  assert.notDeepEqual(fn('speciesOf')(m).base, before);
});

test('building a robot from spares joins the team', () => {
  const s = startedSave('musk0', 12);
  const u = k => fn('addPart')(k).uid;
  const m = fn('buildRobot')(u('tide'), {
    torso: u('kiln'),
    armL: u('hydrant'),
    armR: u('piston'),
    legs: u('treads'),
  });
  assert.ok(m && m.kind === 'robot');
  assert.equal(s.team[1], m);
  assert.equal(m.lvl, 12);
  assert.equal(s.parts.length, 0);
  assert.equal(fn('buildRobot')('nope', {}), null);
});

test('battle: a hit on a robot hurts a part; an aimed move breaks the part picked; a broken arm loses its move', () => {
  startedSave('musk0', 30);
  const foe = robot(ids, 30);
  fn('newBattle')('trainer', [foe]);
  const mx = fn('partMaxHp')(foe, 'armL');
  // Auger Bore, aimed at the left arm, from a robot of ours, until the arm breaks
  const me = robot({ gem: 'ember', torso: 'bulwark', armL: 'auger', armR: 'clamp', legs: 'treads' }, 40);
  hooks.saveData.team[0] = me;
  fn('newBattle')('trainer', [foe]);
  let n = 0;
  while (!fn('partBroken')(foe, 'armL') && foe.hp > 0 && n++ < 20) {
    fn('useMove')(0, 'gripcrush', 1, 'armL');
    foe.hp = fn('maxHp')(foe);
  }
  assert.ok(fn('partBroken')(foe, 'armL'), `arm not broken after ${n} hits (part HP ${mx})`);
  assert.ok(hooks.activeBattle.events.some(e => /left arm broke!/.test(e.t)));
  assert.equal(fn('moveUsable')(foe, 'arcwhip'), false);
  assert.equal(fn('moveUsable')(foe, 'overclock'), true, 'the gem move always works');
  hooks.activeBattle.events = [];
  fn('useMove')(1, 'arcwhip', 0);
  assert.ok(hooks.activeBattle.events.some(e => /left arm is broken. It can’t use Arc Whip/.test(e.t)));
  for (let i = 0; i < 50; i++) {
    const c = fn('chooseAI')(1);
    assert.notEqual(c.mid, 'arcwhip', 'the computer still picked a broken arm’s move');
  }
  const snap = fn('actorSnapshot')(1);
  assert.deepEqual(snap.bot.brk, ['armL']);
  assert.equal(snap.bot.ph.armL, 0);
});

test('battle: broken legs halve Speed; self-repair and healing fix parts; a repair kit fixes them', () => {
  const s = startedSave('musk0', 30);
  const m = robot({ gem: 'tide', torso: 'kiln', armL: 'piston', armR: 'hydrant', legs: 'striders' }, 30);
  s.team[0] = m;
  fn('newBattle')('trainer', [fn('makeBilly')('musk0', 30)]);
  const fast = fn('effectiveStat')(0, 'hus');
  m.partDmg.legs = fn('partMaxHp')(m, 'legs');
  assert.equal(fn('effectiveStat')(0, 'hus'), Math.max(1, fast * R.legBreakSpeed));
  fn('useMove')(0, 'selfrepair', 1);
  assert.equal(fn('partBroken')(m, 'legs'), false, 'Self-Repair fixed half, so the legs work again');
  m.partDmg.armL = 5;
  s.items.repairkit = 1;
  assert.equal(fn('canUse')('repairkit', m), true);
  assert.equal(fn('applyItem')('repairkit', m.uid, false), true);
  assert.equal(fn('partsDamaged')(m), false);
  m.partDmg.armR = 3;
  fn('healAll')();
  assert.equal(fn('partsDamaged')(m), false);
});

test('battle: the gem’s type hits harder', () => {
  startedSave('musk0', 30);
  const a = robot({ gem: 'ember', torso: 'kiln', armL: 'cinder', armR: 'cinder', legs: 'treads' }, 30),
    b = robot({ gem: 'tide', torso: 'kiln', armL: 'cinder', armR: 'cinder', legs: 'treads' }, 30);
  const foe = fn('makeBilly')('gates0', 30);
  const avg = m => {
    hooks.saveData.team[0] = m;
    fn('newBattle')('trainer', [foe]);
    reseed();
    let t = 0;
    for (let i = 0; i < 200; i++) t += fn('calcDamage')(0, 1, 'cindershot').dmg;
    return t / 200;
  };
  const ratio = avg(a) / avg(b);
  // the Ember gem also adds Sp. Atk (and the Tide gem none), so the ratio is above the affinity alone
  assert.ok(ratio > R.gemAffinity, `ratio ${ratio}`);
});

test('a mixed trainer team (Tinker Rho) battles a mixed team of yours to the end', () => {
  const s = startedSave('musk0', 15);
  s.team.push(robot({ gem: 'ember', torso: 'bulwark', armL: 'clamp', armR: 'cinder', legs: 'treads' }, 15));
  const T = data.TRAINERS.tinker;
  assert.ok(T, 'tinker trainer');
  const team = data.trainerTeam(T);
  assert.equal(team.length, 3);
  assert.equal(team[0].kind, 'robot');
  assert.equal(team[1].kind, undefined);
  fn('startTrainer')('tinker', { talked: true });
  let turns = 0;
  while (!hooks.activeBattle.over && turns++ < 200) {
    const k = 0,
      me = fn('fighter')(k);
    if (!me || me.hp <= 0) {
      const nx = fn('benchCandidates')(0)[0];
      if (nx == null) break;
      fn('doSwitch')(k, nx);
      continue;
    }
    const mid =
      me.moves.find(id => fn('moveUsable')(me, id) && MOVES[id].c !== 'X') ||
      me.moves.find(id => fn('moveUsable')(me, id));
    fn('runTurn')([{ who: 0, k: 'move', mid, tk: fn('liveActors')(1)[0], part: 'armL' }]);
    for (const k2 of hooks.activeBattle.needSwitch || []) {
      const nx = fn('benchCandidates')(0)[0];
      if (nx != null) fn('doSwitch')(k2, nx);
    }
  }
  assert.ok(hooks.activeBattle.over, `no winner after ${turns} turns`);
  assert.ok(!Object.keys(s.seen).some(k => k.startsWith('bot:')), 'robots went into the Guide');
});

test('XP: a robot levels up without learning moves', () => {
  const s = startedSave('musk0', 10);
  const m = robot(ids, 10);
  s.team.push(m);
  const moves = m.moves.slice();
  fn('gainXp')(m, 50000, () => {});
  assert.ok(m.lvl > 10);
  assert.deepEqual(m.moves, moves);
});

test('save: robots and parts survive a save and load; a part the data lost is dropped; a robot without parts goes', () => {
  const s = startedSave('musk0', 10);
  s.team.push(robot());
  fn('addPart')('hover');
  assert.equal(fn('validSave')(JSON.parse(JSON.stringify(s))), true);
  // as for a Billie whose species the data lost: validSave refuses it, migrate drops it
  s.parts.push({ uid: 'x1', id: 'nosuchpart', up: 0 });
  s.box.push({ ...robot(), gem: 'nosuchgem' });
  const o = JSON.parse(JSON.stringify(s));
  assert.equal(fn('validSave')(o), false);
  const back = fn('migrate')(o);
  assert.equal(back.team[1].kind, 'robot');
  assert.equal(back.team[1].sp, 'bot:volt.vane.tesla.auger.striders');
  assert.deepEqual(
    back.parts.map(p => p.id),
    ['hover']
  );
  assert.equal(back.box.length, 0);
  // a save from before robots (no parts) still loads
  const old = JSON.parse(JSON.stringify(back));
  delete old.parts;
  assert.equal(fn('validSave')(old), true);
  assert.deepEqual(fn('migrate')(old).parts, []);
});
