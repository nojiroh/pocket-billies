// Studio plan Phase 1 (T1.3): check-data's whole output, on the game data and on two planted copies of it. T1.3 moves
// check-data's run, ranch, robots, biomes, node type, relic, currency, building and unlock checks into
// game/js/logic/data-checks.js; this record must stay the same through the move, so CI neither loosens nor changes its
// words. The plants touch every family that moves (in a temp copy, game/data is never written). The snapshot is in
// check-data-snapshot.test.mjs.snapshot; a change meant to alter check-data's words remakes it, said in the commit:
//   node --test --test-update-snapshots tools/test/check-data-snapshot.test.mjs
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { DATA, PB_DATA, ROOT } from '../data-files.mjs';

const temps = [];
after(() => temps.forEach(d => rmSync(d, { recursive: true, force: true })));

/** check-data's output (stdout and its exit code) on a copy of the data with plants: {file: value => void} */
function checkDataOn(plants) {
  const dir = mkdtempSync(join(tmpdir(), 'pb-check-data-'));
  temps.push(dir);
  cpSync(DATA, join(dir, 'data'), { recursive: true });
  symlinkSync(join(ROOT, 'game', 'art'), join(dir, 'art'));
  for (const [file, plant] of Object.entries(plants)) {
    const path = join(dir, 'data', file),
      v = JSON.parse(readFileSync(path, 'utf8'));
    plant(v);
    writeFileSync(path, PB_DATA.text(v));
  }
  try {
    return execFileSync(process.execPath, [join(ROOT, 'tools', 'check-data.mjs')], {
      env: { ...process.env, PB_DATA_DIR: join(dir, 'data') },
      encoding: 'utf8',
    });
  } catch (e) {
    return `${e.stdout}(exit ${e.status})`;
  }
}

test('check-data: the game data', t => {
  t.assert.snapshot(checkDataOn({}));
});

test('check-data: planted rules (battle, run, ranch)', t => {
  t.assert.snapshot(
    checkDataOn({
      'rules.json': R => {
        const run = R.run;
        R.battle.turnCap = 5;
        Object.assign(run.payout, { money: -1, bogus: 1, winCrests: 1.5, itemShare: 2 });
        Object.assign(R.ranch, { slots: [3, 2], bogus: 1, levelsPerHour: 0 });
        Object.assign(R.ranch.breed, { riskyCost: 50, extra: 1 });
        R.ranch.breed.odds.safe = 0.9;
        Object.assign(run.map, { rows: 4, first: 'nosuch', wide: 2, extra: 1 });
        run.map.biomes.nosuchbiome = 1;
        run.clock.slack = 3; /* RL-R2: the deadline's slack is gone */
        run.reveal.extra = 1;
        run.bogusKey = 1;
        run.scene.land.hills = [0.8, 0.2];
        run.scene.road.shape.zigzag = 1;
        run.scene.size = 3;
        run.wild.lv = [5, 3];
        run.wild.rare.myth = { chance: 0.5, list: ['hastings0'] };
        run.seamIn = 0;
        run.start.pyramids.nosuchcoin = 1;
        run.start.extra = 1;
        run.points.budget = [2, 1];
        run.points.most = 'five';
        run.healCost = -5;
        run.shop.always.push('nosuchware');
        run.shop.pick['coin:nosuch'] = 1;
        run.foes.boss.up = 99;
        run.foes.extra = {};
        run.perks.cap = 0;
        run.perks.rarity.mythic = 1;
        run.perks.price.rare = 1.5;
      },
    })
  );
});

test('check-data: planted robots, biomes, node types, relics, currencies, buildings and unlocks', t => {
  t.assert.snapshot(
    checkDataOn({
      'robots.json': R => {
        R.parts.bulwark.type = 'Plasma';
        R.parts.treads.carry = 0;
        R.parts.piston.art.headTurn = 1;
        R.gems.ember.move = 'nosuchmove';
      },
      'trainers/tinker.json': T => {
        Object.assign(T.team[0].robot, { gem: 'nosuchgem', armL: 'bulwark' });
      },
      'biomes.json': B => {
        Object.assign(B.meadow, { climate: 'none', pool: 'nosuchpool' });
        B.meadow.trees.nosuchtree = 1;
      },
      'nodeTypes.json': N => {
        N.landing.mark = 'bogus';
      },
      'perks.json': R => {
        R.running_shoes.fx[0].stat = 'hp';
        R.power_gloves.fx[0].type = 'Plasma';
      },
      'currencies.json': C => {
        C.research.kept = 'run';
      },
      'buildings.json': B => {
        B.ranch.act = 'nosuchact';
        B.ranch.levels = 9;
        B.lab.currency = 'gold';
      },
      'unlocks.json': U => {
        U.shop_nerve_tonic.at = 'nosuchbuilding';
        U.shop_nerve_tonic.requires = ['caught_15'];
        U.caught_15.requires = ['shop_nerve_tonic'];
        U.caught_15.when = 'unlock:nosuchunlock';
        U.caught_15.grant = { money: 100 };
      },
    })
  );
});

test('check-data: planted field moves and side areas (RL-R2)', t => {
  t.assert.snapshot(
    checkDataOn({
      'fieldMoves.json': F => {
        F.moves.surf.type = 'Plasma';
        F.moves.smash.biome = 'nosuchbiome';
        // RL-R2b: a side area's biome may be one no region draws (the cave), so any biomes.json biome is fine
        F.moves.cut.biome = 'volcano';
      },
      'rules.json': R => {
        Object.assign(R.run.side, { detour: 0.9, alt: 0.2, places: [1, 9], lean: -1, extra: 1 });
        R.run.side.moves = { surf: 0, nosuchmove: 1 };
      },
    })
  );
});

test('check-data: planted set pieces (RT-3)', t => {
  t.assert.snapshot(
    checkDataOn({
      'setPieces.json': S => {
        S.perPlace = [3, 1];
        S.pieces.campsite.props[0].k = 'nosuchprop';
        S.pieces.campsite.props[1].x = 9;
        S.pieces.campsite.biomes.nosuchbiome = 1;
        S.pieces.rest_stop.props[0].water = true;
        S.pieces.ruins.plans = { nosuchplan: 2 };
        S.pieces.bureau_checkpoint.people[0].event = 'nosuchevent';
        S.pieces.bureau_checkpoint.people[0].who = 'nosuchperson';
      },
    })
  );
});

test('check-data: planted arenas (WM-7)', t => {
  t.assert.snapshot(
    checkDataOn({
      'arenas.json': A => {
        A.themes.Nosuchtype = { ...A.themes.plain };
        A.themes.Water.ground = '\u00a7';
        A.themes.Grass.fence = 'lantern';
        A.themes.Fire.dress = ['nosuchprop'];
        delete A.sizes.leader.back;
      },
    })
  );
});

test('check-data: planted Expeditions and challenges (RL-13)', t => {
  t.assert.snapshot(
    checkDataOn({
      'modifiers.json': M => {
        M.challenges.mono.when = 'wins >=';
        M.expeditions[2].fx = [{ kind: 'level', n: 1 }];
      },
    })
  );
});

test('check-data: planted story director lines (RL-S1)', t => {
  t.assert.snapshot(
    checkDataOn({
      'banter.json': B => {
        B.leader_badge.when = 'wins >= 1';
        B.chosen_won.when = 'last:victory';
        B.hazel_file.when = 'lastby:nobody';
        B.chosen_first.cooldown = 2;
        /* RS-3: a line for nobody; a resident left with only lines that may not hold */
        B.mo_won.who = 'nobody';
        B.gus_rattle.when = 'last:won';
      },
    })
  );
});

test('check-data: planted relations, the rival and the hub folk in the story (RL-S2)', t => {
  t.assert.snapshot(
    checkDataOn({
      'relations.json': R => {
        R.people.nobody = { levels: [{ at: 1 }] };
        R.people.hazel.levels[2].at = 1;
        R.people.chosen.levels[1].fx = [{ kind: 'luck', mult: 9 }];
        R.people.juniper.levels[1].pyramids = { gold_brick: 1 };
        R.people.juniper.levels[3].wardrobe = 'no_such_hat';
      },
      'rules.json': R => {
        R.run.rival.on = ['boss'];
        R.run.rival.meet = [3];
      },
      'banter.json': B => {
        B.hazel_file.when = 'rel:blake >= 1 or gifted:nobody';
      },
    })
  );
});

test('check-data: planted quests (TW-3)', t => {
  t.assert.snapshot(
    checkDataOn({
      'quests.json': Q => {
        Q.kinds.trainers.goal = [3, 2];
        Q.texts = Q.texts.filter(x => x.kind !== 'parcel');
        Q.texts[0].ask = 'Catch me {n} of them.';
        Q.texts[1].id = Q.texts[0].id;
        Q.say.done = 'Done: {what}.';
      },
    })
  );
});

test('check-data: planted residents (RS-1)', t => {
  t.assert.snapshot(
    checkDataOn({
      'residents.json': R => {
        R.mo.home = 'nosuchbuilding';
        R.bertha.first = true;
        R.gus.levels = ['nosuchunlock'];
        R.rosa.levels = ['ranch_2'];
        /* RS-3: a resident with no look (people/<id>.json) */
        R.zed = { ...R.seamus, name: 'Zed' };
      },
      'unlocks.json': U => {
        U.caught_15.when = 'resident:nosuchresident';
      },
    })
  );
});

test('check-data: planted favours (RS-2)', t => {
  t.assert.snapshot(
    checkDataOn({
      'quests.json': Q => {
        delete Q.favours.mo;
        delete Q.favours.bertha.kind;
        Q.favours.dottie.kind = 'parcel';
        Q.favours.nobody = { kind: 'parcel', ask: 'Who am I?' };
        Q.favours.hayden.ask = 'Beat {n} of them.';
        Q.invite.moving = '{title} moves in.';
      },
    })
  );
});

test('check-data: planted factions (RL-14)', t => {
  t.assert.snapshot(
    checkDataOn({
      'factions.json': F => {
        const B = F.factions.bureau;
        B.bots.repo.armL = 'treads';
        B.bots.courier.gem = 'opal';
        B.agents.classes.push('auditor');
        B.wild.biomes.push('moon');
        B.agents.bots = [2, 1];
      },
    })
  );
});

test('check-data: planted fossils (RO-3e)', t => {
  t.assert.snapshot(
    checkDataOn({
      'pools.json': P => {
        P.cave.list.push(['carnegie0', 1]);
      },
      'eggs.json': E => {
        E['2'].list.push(['vanderbilt0', 5]);
      },
      'events.json': E => {
        E.events.dig_site.options[0].then[1] = 'revive carnegie9 30';
      },
    })
  );
});
