'use strict';
/* ================= A RUN TOWN'S QUESTS ON SCREEN (towns track TW-3) =================
   The quest giver on a run town's square (scene.people id 'quest', logic/run-scenes.js runTownQuest) offers the
   town's quest (logic/run-quests.js questOffer) with a gold "!" over their head while it is open; Yes takes it (at most
   quests.json held). The notice board beside them (act 'notice') hands in what is done, a reward pick each
   (logic/rewards.js), each quest gone before its pick shows so a reload never pays it twice. Progress shows as toasts
   (questToasts) and the Map tab lists what is held (questListHTML). Every change is saved at once (saveNow). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, toast } from './hooks.js';
import { LOCATIONS, QUESTS, SPECIES, TRAINERS, gameData } from './game-data.js';
import { runMapNode, runWorldNode } from './logic/run-map.js';
import { rewardDataGame, rewardOfferMake } from './logic/rewards.js';
import { questArrive, questFill, questOffer, questPay, questPayable, questTake, questsOf } from './logic/run-quests.js';
import { escapeHtml, saveData, saveNow } from './game-state.js';
import { talkChoose, talkHide, talkLine } from './talk.js';
import { rewardPickOpen } from './reward-screen.js';
/* eslint-disable no-func-assign */
expose({
  questArrived: [() => questArrived, v => ((questArrived = v), provide({ questArrived }))],
  questBoardOpen: [() => questBoardOpen, v => (questBoardOpen = v)],
  questData: [() => questData, v => (questData = v)],
  questGiverTalk: [() => questGiverTalk, v => (questGiverTalk = v)],
  questHere: [() => questHere],
  questListHTML: [() => questListHTML, v => (questListHTML = v)],
  questMarked: [() => questMarked, v => ((questMarked = v), provide({ questMarked }))],
  questOfferHere: [() => questOfferHere, v => (questOfferHere = v)],
  questToasts: [() => questToasts, v => ((questToasts = v), provide({ questToasts }))],
});
/* eslint-enable no-func-assign */
provide({ questArrived, questMarked, questToasts });
/* to-module: end */
/** the run's quest data on the page: the towns whose scene has a notice board, the world's route trainers by node
 * @returns {import('./logic/run-quests.js').QuestData} */
function questData() {
  const run = saveData.run,
    nodes = (run && run.map && run.map.nodes) || [],
    at = /** @type {Record<number, number>} */ ({});
  for (const T of Object.values(TRAINERS))
    if (T && /** @type {any} */ (T).runFoe === 'route') {
      const i = /** @type {any} */ (T).runNode;
      at[i] = (at[i] || 0) + 1;
    }
  const boards = nodes.flatMap((n, i) => {
    if (n.type !== 'town') return [];
    const L = LOCATIONS[runWorldNode(i)],
      sc = L && gameData.maps[L.mapId];
    return sc && (sc.spots || []).some((/** @type {any} */ s) => s.kind === 'board') ? [i] : [];
  });
  return { quests: QUESTS, species: SPECIES, boards, trainersAt: i => at[i] || 0 };
}
/** the map node the player stands in (-1: none) */
const questHere = () => (saveData.run && saveData.trip ? runMapNode(saveData.trip.node) : -1);
/** this town's open offer (null: none, or taken) */
function questOfferHere() {
  const run = saveData.run,
    i = questHere();
  return run && i >= 0 ? questOffer(run, i, questData()) : null;
}
/** whether the giver shows a "!" (their offer is open) @param {any} P the person */
function questMarked(P) {
  return !!(P && P.quest && saveData.run && questOfferHere());
}
/** talk to the quest giver: their offer and Yes / No, or a line when there is none @param {any} P */
export async function questGiverTalk(P) {
  const run = saveData.run,
    i = questHere(),
    o = { name: P.name },
    say = QUESTS.say,
    offer = questOfferHere();
  if (!run || !offer) {
    const done = run && run.quests && run.quests.took.includes(i);
    await talkLine(P.who, done ? say.taken : say.none, null, o);
    talkHide();
    return;
  }
  const R = questsOf(run),
    T = QUESTS.texts.find(t => t.id === offer.text);
  await talkLine(P.who, questFill(T ? T.ask : '', offer, QUESTS), null, o);
  if (R.held.length >= QUESTS.held) {
    await talkLine(P.who, say.full, null, o);
    talkHide();
    return;
  }
  await talkLine(P.who, say.take, null, o);
  const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
  if (yes && questTake(run, i, offer, QUESTS)) {
    saveNow();
    if (typeof debugLog !== 'undefined') debugLog.add('run', `quest taken: ${offer.kind} (${offer.text})`);
    await talkLine(P.who, say.yes, null, o);
  } else await talkLine(P.who, say.no, null, o);
  talkHide();
}
/** tap the notice board: each done quest from another town handed in for a reward pick, one after another */
export async function questBoardOpen() {
  const run = saveData.run,
    i = questHere();
  if (!run) return;
  const due = questPayable(run, i);
  if (!due.length) {
    const held = run.quests ? run.quests.held.length : 0;
    toast(held ? `${QUESTS.say.empty} (${held} of ${QUESTS.held} quests held)` : QUESTS.say.empty);
    return;
  }
  for (const q of due) {
    if (!questPay(run, q)) continue;
    const made = rewardOfferMake(run, 'quest:' + q.id, rewardDataGame(saveData.team));
    saveNow();
    if (typeof debugLog !== 'undefined') debugLog.add('run', `quest handed in: ${q.kind} (${q.text})`);
    toast(questFill(QUESTS.say.done, q, QUESTS));
    if (made) await new Promise(res => rewardPickOpen(res));
  }
  render();
}
/** what a battle or an arrival finished or failed, as toasts @param {{ done?: any[], failed?: any[] }} r */
function questToasts(r) {
  for (const q of (r && r.done) || [])
    toast(`Quest done: ${questFill(QUESTS.kinds[q.kind].title, q, QUESTS)}. Hand it in at a notice board.`);
  for (const q of (r && r.failed) || []) toast(questFill(QUESTS.say.fail, q, QUESTS));
}
/** walking into a place: a parcel delivered */
function questArrived() {
  questToasts({ done: questArrive(saveData.run, questHere()) });
}
/** the Map tab's quest list, in its header (empty when nothing is held) */
export function questListHTML() {
  const run = saveData.run,
    held = (run && run.quests && run.quests.held) || [];
  if (!held.length) return '';
  const row = (/** @type {any} */ q) => {
    const what = q.done ? 'done: hand it in at another town’s notice board' : q.goal > 1 ? `${q.n} of ${q.goal}` : '';
    return `<li class="${q.done ? 'done' : ''}">${escapeHtml(questFill(QUESTS.kinds[q.kind].title, q, QUESTS))}${what ? ` <small class="tnum">${escapeHtml(what)}</small>` : ''}</li>`;
  };
  return `<div class="map-quests"><div class="sub">Quests ${held.length} of ${QUESTS.held}</div><ul>${held.map(row).join('')}</ul></div>`;
}
