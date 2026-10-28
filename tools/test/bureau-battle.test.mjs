// Style track SY-5: the Bureau in battle (game/js/logic/bureau-battle.js): who fights for it, the plates' serials, the
// stamps a faint gets, the join intro's notice and its times.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_DATA, modules } from './setup-real.mjs';
import {
  battleFactionOf,
  factionSerial,
  koBy,
  koStampMoment,
  noticeOf,
  noticeTimes,
} from '../../game/js/logic/bureau-battle.js';

const FACTIONS = GAME_DATA.factions.factions,
  BOSSES = GAME_DATA.bosses.bosses,
  BUREAU = FACTIONS.bureau,
  botId = Object.keys(BUREAU.bots).sort()[0],
  botSp = modules.factions.factionBotSp(BUREAU.bots[botId]);

test('bureau-battle: a Bureau bot and the Retrieval Unit fight for the Bureau; a Billie and another robot do not', () => {
  assert.deepEqual(battleFactionOf(FACTIONS, BOSSES, { sp: botSp }, null), {
    faction: 'bureau',
    id: botId,
    look: BUREAU.look,
  });
  const boss = battleFactionOf(
    FACTIONS,
    BOSSES,
    { sp: 'bot:volt.intake.seizer.franker.conveyor', boss: 1 },
    {
      boss: 'retrieval',
    }
  );
  assert.equal(boss && boss.faction, 'bureau');
  assert.equal(boss && boss.id, 'retrieval');
  assert.equal(battleFactionOf(FACTIONS, BOSSES, { sp: 'pip' }, null), null);
  assert.equal(battleFactionOf(FACTIONS, BOSSES, { sp: 'bot:volt.a.b.c.d' }, null), null);
  /* an Alpha Billie in a boss battle that is not a bosses.json boss */
  assert.equal(battleFactionOf(FACTIONS, BOSSES, { sp: 'pip', boss: 1 }, {}), null);
  /* a faction with no look shows nothing */
  const bare = { bureau: { ...BUREAU, look: undefined } };
  assert.equal(battleFactionOf(bare, BOSSES, { sp: botSp }, null), null);
});

test('bureau-battle: a serial is the same every time for the same id, and differs between bots', () => {
  const ids = Object.keys(BUREAU.bots);
  for (const id of ids) {
    assert.match(factionSerial(id), /^No\. \d{4}-[A-Z]{2}$/);
    assert.equal(factionSerial(id), factionSerial(id));
  }
  assert.equal(new Set(ids.map(factionSerial)).size, ids.length);
});

const side = (/** @type {number} */ k) => (k >= 1 && k <= 3 ? 1 : 0),
  bureauAt = (/** @type {number} */ k) => k === 1;

test("bureau-battle: a faint is VOID when the Bureau's bot falls, RETRIEVED when its hit knocks out yours", () => {
  const ev = [
    { an: { k: 'move', si: 0, ti: 1, dmg: 30 } },
    { an: { k: 'faint', si: 1 } },
    { an: { k: 'move', si: 1, ti: 0, dmg: 40 } },
    { an: { k: 'faint', si: 0 } },
  ];
  assert.equal(koStampMoment(ev, 1, side, bureauAt), 'void');
  assert.equal(koBy(ev, 3), 1);
  assert.equal(koStampMoment(ev, 3, side, bureauAt), 'retrieved');
  /* a foe that isn't the Bureau's: no stamp either way */
  assert.equal(
    koStampMoment(ev, 1, side, () => false),
    null
  );
  assert.equal(
    koStampMoment(ev, 3, side, () => false),
    null
  );
  /* not a faint */
  assert.equal(koStampMoment(ev, 0, side, bureauAt), null);
});

test("bureau-battle: a faint from a burn, the stones or a delayed hit is no one's knockout; a spread hit is its move's", () => {
  const burn = [
    { an: { k: 'move', si: 1, ti: 0, dmg: 10 } },
    { an: { k: 'hurt', si: 0, fx: 'brn', dmg: 5 } },
    { an: { k: 'faint', si: 0 } },
  ];
  assert.equal(koBy(burn, 2), null);
  assert.equal(koStampMoment(burn, 2, side, bureauAt), null);
  const spread = [
    { an: { k: 'move', si: 1, ti: 4, dmg: 20, spread: true } },
    { an: { k: 'hurt', si: 0, fx: 'spread', dmg: 20 } },
    { an: { k: 'faint', si: 0 } },
  ];
  assert.equal(koBy(spread, 2), 1);
  assert.equal(koStampMoment(spread, 2, side, bureauAt), 'retrieved');
  /* a missed move (no damage) is not the knockout; the earlier hit is */
  const miss = [
    { an: { k: 'move', si: 1, ti: 0, dmg: 50 } },
    { an: { k: 'move', si: 2, ti: 0, miss: true } },
    { an: { k: 'faint', si: 0 } },
  ];
  assert.equal(koBy(miss, 2), 1);
});

test("bureau-battle: the Retrieval Unit's notice lists its four bots, the leader first, with a form number", () => {
  const N = noticeOf(BUREAU.look, BOSSES.retrieval, 'retrieval');
  assert.ok(N);
  assert.equal(N.title, BUREAU.look.notice);
  assert.deepEqual(
    N.lines,
    ['torso', 'armL', 'armR', 'legs'].map(k => BOSSES.retrieval.bots[k])
  );
  assert.ok(BUREAU.look.forms.includes(N.form));
  assert.deepEqual(noticeOf(BUREAU.look, BOSSES.retrieval, 'retrieval'), N);
  assert.equal(noticeOf(null, BOSSES.retrieval, 'retrieval'), null);
  assert.equal(noticeOf(BUREAU.look, { ...BOSSES.retrieval, bots: {} }, 'retrieval'), null);
});

test('bureau-battle: the notice plays inside the join, before the bots lock: up, lines in order, stamp, away, gone', () => {
  for (const lock of [1300, 800, 2000])
    for (const n of [1, 4, 6]) {
      const t = noticeTimes(lock, n);
      assert.equal(t.lines.length, n);
      assert.ok(t.up > 0 && t.up < t.lines[0], `${lock}/${n} up first`);
      for (let i = 1; i < n; i++) assert.ok(t.lines[i] > t.lines[i - 1]);
      assert.ok(t.lines[n - 1] < t.stamp, `${lock}/${n} the lines before the stamp`);
      assert.ok(t.stamp < t.away && t.away < t.gone, `${lock}/${n} the stamp, then away`);
      assert.equal(t.gone, lock, 'gone as they lock: no added time');
    }
});

test("bureau-battle: JOIN_LOCK_MS is the join intro's own lock time (battle-stage.js)", async () => {
  const { readFileSync } = await import('node:fs'),
    src = readFileSync(new URL('../../game/js/battle-stage.js', import.meta.url), 'utf8'),
    m = src.match(/case 'join': \{[\s\S]*?LOCK = (\d+);/);
  assert.ok(m, "battle-stage.js case 'join' names its LOCK");
  assert.equal(Number(m[1]), modules['bureau-battle'].JOIN_LOCK_MS);
});
