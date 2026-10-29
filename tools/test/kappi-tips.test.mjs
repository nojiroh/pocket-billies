// Intro track IN-2: Kappi's tips (game/js/logic/kappi-tips.js): the triggers fire on struggle or stall only, a cue
// comes before the line, and the caps hold (never in the first battle, one per place, a few per run, once ever).
// The game's own kappiTips.json is read too: it passes its checks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  hintPlan,
  newTipRun,
  tipBattle,
  tipBattleEnd,
  tipBeaten,
  tipCatch,
  tipDataProblems,
  tipFaint,
  tipFirstRun,
  tipHold,
  tipMoved,
  tipNext,
  tipNoPyramids,
  tipPlace,
  tipSheet,
} from '../../game/js/logic/kappi-tips.js';

const line = (/** @type {string} */ t) => `${t} #l:0000`;
/** a small tips file: every trigger, the stall clocks short */
const D = /** @type {any} */ ({
  caps: { run: 5, place: 1 },
  near: 2,
  keepS: 30,
  tips: {
    catch: { when: 'catchFails', n: 2, cue: 'catchButton', line: line('Tire it first.') },
    faint: { when: 'faint', line: line('Fainted, not gone.') },
    potion: { when: 'potionUnused', hp: 0.34, cue: 'itemsButton', line: line('In the Bag.') },
    pyramids: { when: 'noPyramids', near: 10, line: line('Shops sell more.') },
    sheet: { when: 'sheetStall', cue: 'sheetPulse', cueS: 12, s: 20, line: line('Only a slow one.') },
    stall: { when: 'placeStall', cue: 'roadMarker', cueS: 40, s: 60, line: line('The arrows point on.') },
    counter: { when: 'foeBeatsLead', line: line('Switching is brave too.') },
  },
});
/** the moment: on, nothing seen, nothing moving, in the world */
const at = (/** @type {number} */ t, o = {}) => ({ t, on: true, seen: {}, busy: false, battle: false, ...o });
/** a run already past its first battle, in a place */
const pastFirst = () => {
  const st = newTipRun();
  tipPlace(st, '1', 0);
  tipBattle(st, D, {}, 0);
  tipBattleEnd(st, D, {}, 0);
  return st;
};

test('two failed catches in a row raise the catch tip, said in the battle; a catch between them resets the count', () => {
  const st = pastFirst();
  tipBattle(st, D, {}, 1000);
  tipCatch(st, D, false, 1000);
  assert.equal(tipNext(st, D, at(1100, { battle: true })), null, 'one miss is not enough');
  tipCatch(st, D, true, 1200);
  tipCatch(st, D, false, 1300);
  assert.equal(tipNext(st, D, at(1400, { battle: true })), null, 'a catch in between resets it');
  tipCatch(st, D, false, 1500);
  const s = tipNext(st, D, at(1600, { battle: true }));
  assert.equal(s && s.kind, 'say');
  assert.equal(s && s.id, 'catch');
  assert.equal(tipNext(st, D, at(1700, { battle: true })), null, 'said once');
});

test('one miss lets the catch cue show (the Catch button pulses) when it can, never Kappi', () => {
  const st = pastFirst();
  tipBattle(st, D, {}, 1000);
  tipCatch(st, D, false, 1000);
  assert.equal(tipNext(st, D, at(1100, { battle: true, cues: { catchButton: false } })), null);
  assert.deepEqual(tipNext(st, D, at(1200, { battle: true, cues: { catchButton: true } })), {
    kind: 'cue',
    id: 'catch',
    cue: 'catchButton',
  });
  assert.equal(tipNext(st, D, at(1300, { battle: true, cues: { catchButton: true } })), null, 'a cue once a run');
});

test('nothing in the first battle of a run: not said, not cued, not kept for later', () => {
  const st = newTipRun();
  tipPlace(st, '1', 0);
  tipBattle(st, D, {}, 0);
  tipBeaten(st, D, 0);
  tipCatch(st, D, false, 10);
  tipCatch(st, D, false, 20);
  tipFaint(st, D, 30);
  assert.equal(tipNext(st, D, at(40, { battle: true, cues: { catchButton: true, itemsButton: true } })), null);
  tipBattleEnd(st, D, { potion: true }, 50);
  assert.equal(st.due.length, 0, 'nothing waits from the first battle');
  assert.equal(tipNext(st, D, at(60)), null);
});

test('the first faint of the run tips, later ones do not', () => {
  const st = pastFirst();
  tipPlace(st, '2', 0);
  tipBattle(st, D, {}, 0);
  tipFaint(st, D, 100);
  assert.equal(tipNext(st, D, at(200, { battle: true }))?.id, 'faint');
  tipPlace(st, '3', 300);
  tipFaint(st, D, 400);
  assert.equal(tipNext(st, D, at(500, { battle: true })), null);
});

test('a potion unused through a battle with a Billie low is said after it, in the world', () => {
  const st = pastFirst();
  tipBattle(st, D, {}, 0);
  assert.equal(tipNext(st, D, at(10, { battle: true, cues: { itemsButton: true } }))?.cue, 'itemsButton');
  tipBattleEnd(st, D, { potion: true }, 100);
  assert.equal(tipNext(st, D, at(150, { sheet: true })), null, 'not over a sheet');
  assert.equal(tipNext(st, D, at(200))?.id, 'potion');
});

test('a foe whose type beats your lead: said in that battle', () => {
  const st = pastFirst();
  tipBattle(st, D, { beaten: true }, 0);
  assert.equal(tipNext(st, D, at(10))?.id ?? null, null, 'a battle tip, not in the world');
  assert.equal(tipNext(st, D, at(20, { battle: true }))?.id, 'counter');
});

test('no pyramids with a wild one near: said in the world', () => {
  const st = pastFirst();
  tipNoPyramids(st, D, 0);
  assert.equal(tipNext(st, D, at(10, { battle: true })), null);
  assert.equal(tipNext(st, D, at(20))?.id, 'pyramids');
});

test('a choice sheet: its cue at 12 s, Kappi at 20 s; only a real choice starts the clock again', () => {
  const st = pastFirst();
  tipSheet(st, 'reward-pick|100', 0);
  const c = (/** @type {number} */ s) => at(s * 1000, { sheet: true, cues: { sheetPulse: true } });
  assert.equal(tipNext(st, D, c(11)), null);
  assert.equal(tipNext(st, D, c(12))?.cue, 'sheetPulse');
  tipSheet(st, 'reward-pick|100', 15000);
  assert.equal(tipNext(st, D, c(19.9)), null, 'the same sheet: the clock runs on');
  tipSheet(st, 'reward-pick|80', 19950);
  assert.equal(tipNext(st, D, c(25)), null, 'a purchase: the clock starts again');
  assert.equal(tipNext(st, D, c(31.95))?.cue, 'sheetPulse', 'its cue again after a real choice');
  assert.equal(tipNext(st, D, c(39.95))?.id, 'sheet');
});

test('a place stood in: the road cue at 40 s, Kappi at 60 s; walking nearer a road out starts the clock again', () => {
  const st = newTipRun();
  tipPlace(st, '5', 0);
  const c = (/** @type {number} */ s) => at(s * 1000, { cues: { roadMarker: true } });
  assert.equal(tipNext(st, D, c(90)), null, 'no distance known yet: no clock');
  tipMoved(st, D, 30, 0);
  tipMoved(st, D, 29, 30000);
  assert.equal(tipNext(st, D, c(39)), null);
  assert.equal(tipNext(st, D, c(40))?.cue, 'roadMarker');
  tipMoved(st, D, 27, 50000);
  assert.equal(tipNext(st, D, c(60)), null, 'two metres nearer: progress');
  tipMoved(st, D, 40, 70000);
  tipMoved(st, D, 26, 80000);
  assert.equal(tipNext(st, D, c(100))?.cue, 'roadMarker', 'wandering is not progress; the cue again');
  assert.equal(tipNext(st, D, c(110))?.id, 'stall');
});

test('the stall clock counts only free walking: a scene or a battle in between holds it (the owner’s phone log)', () => {
  const st = newTipRun(),
    c = (/** @type {number} */ s) => at(s * 1000, { cues: { roadMarker: true } });
  /* the run starts under the crash scene: 30 s of it, then you walk */
  tipPlace(st, '0', 0);
  tipMoved(st, D, 30, 0);
  tipHold(st, false, 0);
  tipHold(st, true, 30000);
  assert.equal(tipNext(st, D, c(45)), null, 'only 15 s of walking: no cue (the log’s cue came 3.6 s after the scene)');
  assert.equal(tipNext(st, D, c(70))?.cue, 'roadMarker', '40 s of walking: the cue');
  /* a new place, 10 s walked, a 33 s battle, then 5 s: 15 s free, not 48 */
  const S = newTipRun();
  tipPlace(S, '1', 0);
  tipMoved(S, D, 30, 0);
  tipHold(S, true, 10000);
  tipHold(S, false, 10000);
  tipHold(S, false, 25000);
  tipHold(S, true, 43000);
  assert.equal(tipNext(S, D, c(48)), null, 'the battle’s 33 s don’t count');
  assert.equal(tipNext(S, D, c(73))?.cue, 'roadMarker', 'after 40 s free');
  /* a new place while held: its clock starts when you are free again */
  const H = newTipRun();
  tipHold(H, false, 0);
  tipPlace(H, '2', 5000);
  tipMoved(H, D, 30, 5000);
  tipHold(H, true, 20000);
  assert.equal(tipNext(H, D, c(55)), null, 'held from arrival: 35 s free at 55 s');
  assert.equal(tipNext(H, D, c(60))?.cue, 'roadMarker');
});

test('caps: one tip per place, five a run, each once ever, none while busy or switched off', () => {
  const st = pastFirst();
  tipNoPyramids(st, D, 0);
  tipFaint(st, D, 0);
  assert.equal(tipNext(st, D, at(10, { busy: true })), null, 'busy: it waits');
  assert.equal(tipNext(st, D, at(20, { on: false })), null, 'switched off');
  const first = tipNext(st, D, at(30));
  assert.ok(first);
  assert.equal(tipNext(st, D, at(40)), null, 'one per place');
  tipPlace(st, '2', 50);
  assert.ok(tipNext(st, D, at(60)), 'the next place');
  /* once ever */
  const st2 = pastFirst();
  tipNoPyramids(st2, D, 0);
  assert.equal(tipNext(st2, D, at(10, { seen: { pyramids: 1 } })), null);
  /* five a run */
  const st3 = pastFirst();
  st3.said = 5;
  tipPlace(st3, '9', 0);
  tipNoPyramids(st3, D, 0);
  assert.equal(tipNext(st3, D, at(10)), null);
});

test('a tip that waits too long for a quiet moment is dropped', () => {
  const st = pastFirst();
  tipNoPyramids(st, D, 0);
  assert.equal(tipNext(st, D, at(29000, { busy: true })), null);
  assert.equal(tipNext(st, D, at(31000)), null);
  assert.equal(st.due.length, 0);
});

test('the first run: run.first when the run says, else the first run played', () => {
  assert.equal(tipFirstRun({ first: true }, { runs: 3 }), true);
  assert.equal(tipFirstRun({ first: false }, { runs: 0 }), false);
  assert.equal(tipFirstRun({}, { runs: 0 }), true);
  assert.equal(tipFirstRun({}, { runs: 1 }), false);
  assert.equal(tipFirstRun(null, { runs: 0 }), false);
});

test('the run hints: dropped on the first run, a toast later while not met', () => {
  assert.equal(hintPlan(true, {}, 'town'), 'drop');
  assert.equal(hintPlan(false, {}, 'town'), 'toast');
  assert.equal(hintPlan(false, { 'hint:town': 1 }, 'town'), 'skip');
});

test('the data checks: a trigger each, known cues, a cue before its line, line ids', () => {
  assert.deepEqual(tipDataProblems(D), []);
  const bad = structuredClone(D);
  bad.tips.extra = { when: 'faint', cue: 'confetti', line: 'No id.' };
  bad.tips.sheet.cueS = 30;
  const P = tipDataProblems(bad).join('\n');
  assert.match(P, /a second tip for "faint"/);
  assert.match(P, /no cue "confetti"/);
  assert.match(P, /its line has no line id/);
  assert.match(P, /sheet: its cue comes after its line/);
});

test("the game's kappiTips.json passes its checks and has a tip for every trigger", () => {
  const G = JSON.parse(readFileSync(new URL('../../game/data/kappiTips.json', import.meta.url), 'utf8'));
  assert.deepEqual(tipDataProblems(G), []);
  assert.deepEqual(
    Object.values(G.tips)
      .map((/** @type {any} */ t) => t.when)
      .sort(),
    ['catchFails', 'faint', 'foeBeatsLead', 'noPyramids', 'placeStall', 'potionUnused', 'sheetStall']
  );
});
