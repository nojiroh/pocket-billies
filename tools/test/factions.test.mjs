// RL-14: the runs' enemy factions (logic/factions.js, factions.json): the Bureau's bots as robots, drawn by weight,
// its agents' classes, where wild bots are met.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_DATA, ROOT, modules } from './setup-real.mjs';

const F = modules.factions,
  FT = modules.fighters,
  rng = modules.rng,
  BUREAU = GAME_DATA.factions.factions.bureau;

test('factions: every Bureau bot is a robot the data can build, with a name of its own', () => {
  for (const [id, B] of Object.entries(BUREAU.bots)) {
    const sp = F.factionBotSp(B),
      S = FT.speciesById(sp);
    assert.ok(S, `${id}: ${sp} builds`);
    assert.equal(S.rar, 'robot');
    const e = F.factionBotEntry(B, 12);
    assert.equal(e.sp, 'robot');
    assert.equal(e.nick, B.name);
    assert.deepEqual(F.factionBotOf(GAME_DATA.factions.factions, sp), { faction: 'bureau', bot: id, B });
  }
  assert.equal(F.factionBotOf(GAME_DATA.factions.factions, 'bot:volt.vane.tesla.tesla.hover'), null);
});

test('factions: a bot is drawn by weight from its stream, the same for the same seed', () => {
  const n = {};
  for (let k = 0; k < 2000; k++) {
    const id = F.factionBotPick(rng.rngFrom('seed' + k, 'bot'), BUREAU);
    n[id] = (n[id] || 0) + 1;
  }
  assert.deepEqual(Object.keys(n).sort(), Object.keys(BUREAU.bots).sort());
  assert.ok(n.repo > n.audit, 'a heavier bot more often');
  assert.equal(F.factionBotPick(rng.rngFrom('x', 'bot'), BUREAU), F.factionBotPick(rng.rngFrom('x', 'bot'), BUREAU));
});

test("factions: the Bureau's agents are its classes, and a class of none is nobody's", () => {
  const all = GAME_DATA.factions.factions;
  assert.equal(F.factionOfClass(all, 'bureau_clerk').id, 'bureau');
  assert.equal(F.factionOfClass(all, 'bureau_reclaimer').id, 'bureau');
  assert.equal(F.factionOfClass(all, 'vlogger'), null);
  for (const c of BUREAU.agents.classes) assert.equal(GAME_DATA.events.classes[c].bureau, 1, `${c} is the Bureau's`);
});

test('factions: wild bots wait on routes from their row on in their biomes, and every wild one in a scrapyard', () => {
  const W = BUREAU.wild,
    biome = W.biomes[0],
    other = Object.keys(GAME_DATA.biomes).find(b => !W.biomes.includes(b));
  assert.equal(F.factionWildChance(BUREAU, { type: 'route', row: W.fromRow, biome }), W.chance);
  assert.equal(F.factionWildChance(BUREAU, { type: 'route', row: W.fromRow - 1, biome }), 0);
  assert.equal(F.factionWildChance(BUREAU, { type: 'route', row: W.fromRow, biome: other }), 0);
  assert.equal(F.factionWildChance(BUREAU, { type: 'town', row: 8, biome }), 0);
  assert.equal(F.factionWildChance(BUREAU, { type: 'scrapyard', row: 0, biome: other }), 1);
});

// SY-3: the Bureau's look (factions.json `look`): the emblem is a UI icon, a word for each stamp moment, form numbers
test("factions: the Bureau's look names an emblem that exists, a word for each stamp moment and its form numbers", () => {
  const L = BUREAU.look;
  assert.ok(existsSync(join(ROOT, 'game/art/ui', `${L.emblem}.svg`)), `art/ui/${L.emblem}.svg`);
  assert.deepEqual(Object.keys(L.stamps).sort(), ['denied', 'filed', 'pending', 'retrieved', 'void']);
  assert.ok(L.forms.length >= 1);
  assert.deepEqual(modules['data-checks'].dataFactions(GAME_DATA), []);
});

test('factions: two stamp moments with the same word are a data problem', () => {
  const D = { ...GAME_DATA, factions: structuredClone(GAME_DATA.factions) };
  D.factions.factions.bureau.look.stamps.void = 'denied ';
  const out = modules['data-checks'].dataFactions(D);
  assert.equal(out.length, 1);
  assert.match(out[0][1], /bureau\.look\.stamps\.(void|denied): .* also (denied|void)'s word/);
});

// SY-5: the Bureau in battle: the Retrieval Unit fights for the Bureau; the look names the notice and the plate's line
test("factions: the Retrieval Unit is the Bureau's, and the look names its notice and its plates' line", () => {
  assert.equal(GAME_DATA.bosses.bosses.retrieval.faction, 'bureau');
  assert.ok(BUREAU.look.notice && BUREAU.look.property);
  assert.deepEqual(modules['data-checks'].dataBosses(GAME_DATA), []);
  const D = { ...GAME_DATA, bosses: structuredClone(GAME_DATA.bosses) };
  D.bosses.bosses.retrieval.faction = 'nobody';
  const out = modules['data-checks'].dataBosses(D);
  assert.equal(out.length, 1);
  assert.match(out[0][1], /retrieval\.faction: no faction "nobody"/);
});
