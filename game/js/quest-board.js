'use strict';
/* ================= A RUN TOWN'S QUESTS ON SCREEN (towns track TW-3) =================
   The quest giver on a run town's square (scene.people id 'quest', logic/run-scenes.js runTownQuest) offers the
   town's quest (logic/run-quests.js questOffer) with a gold "!" over their head while it is open; Yes takes it (at most
   quests.json held). The notice board beside them (act 'notice') hands in what is done, a reward pick each
   (logic/rewards.js), each quest gone before its pick shows so a reload never pays it twice. Progress shows as toasts
   (questToasts) and the Map tab lists what is held (questListHTML). Every change is saved at once (saveNow).
   RS-2 (residents track): the run's resident (scene.people id 'resident', logic/run-scenes.js runTownResident) has the
   same "!" while they can be met: the free first one asks to come to Copperleaf (Yes invites them, logic/residents.js
   residentInvite); anyone else offers their favour (quests.json favours), held over the cap, and the board hands it in
   for their invite in place of the reward pick. They move in when the run ends, won or lost. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, toast } from './hooks.js';
import { LOCATIONS, QUESTS, RESIDENTS, SPECIES, TRAINERS, gameData } from './game-data.js';
import { residentInvite } from './logic/residents.js';
import { runMapNode, runWorldNode } from './logic/run-map.js';
import { rewardDataGame, rewardOfferMake } from './logic/rewards.js';
import {
  favourHeld,
  favourOffer,
  favourTake,
  questArrive,
  questFill,
  questKey,
  questOffer,
  questPay,
  questPayable,
  questTake,
  questsHeld,
} from './logic/run-quests.js';
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
  questSlot: [() => questSlot],
  questTitle: [() => questTitle],
  questToasts: [() => questToasts, v => ((questToasts = v), provide({ questToasts }))],
  residentFill: [() => residentFill],
  residentTalk: [() => residentTalk, v => (residentTalk = v)],
});
/* eslint-enable no-func-assign */
provide({ questArrived, questMarked, questToasts });
/* to-module: end */
/** the run's quest data on the page: the towns whose scene has a notice board, the world's route trainers by node
 * @returns {import('./logic/run-quests.js').QuestData} */
export function questData() {
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
/** this town's open offer (null: none, or taken); WM-5: `slot` 1, a town's second giver's @param {number} [slot] */
function questOfferHere(slot = 0) {
  const run = saveData.run,
    i = questHere();
  return run && i >= 0 ? questOffer(run, i, questData(), slot) : null;
}
/** WM-5: which giver a person is (scene.people `quest`: 1 the first, 2 a town's second) @param {any} P */
const questSlot = P => Math.max(0, ((P && P.quest) || 1) - 1);
/** whether the giver shows a "!" (their offer is open); RS-2: the resident, while they can be met (not invited, their
 * favour not held, and offered here) @param {any} P the person */
export function questMarked(P) {
  const run = saveData.run;
  if (P && P.resident && run) {
    const F = QUESTS.favours[P.resident];
    return !run.invited && !!F && (!F.kind || !!favourOffer(run, questHere(), P.resident, F, questData()));
  }
  return !!(P && P.quest && run && questOfferHere(questSlot(P)));
}
/** RS-2: a resident's line with their name filled in @param {string} line @param {string} id */
const residentFill = (line, id) => line.replace(/\{name\}/g, (RESIDENTS[id] && RESIDENTS[id].name) || id);
/** a held quest's line on the list and in toasts (RS-2: a favour's names the resident) @param {any} q */
const questTitle = q => {
  const t = questFill(QUESTS.kinds[q.kind].title, q, QUESTS);
  return q.res ? residentFill(QUESTS.invite.title, q.res).replace(/\{title\}/g, t) : t;
};
/** RS-2: talk to the run's resident: the free first one's "Come to Copperleaf?", anyone else's favour (Yes takes it,
 * over the cap), or a word when it's held, done with, or can't be done from this town @param {any} P */
export async function residentTalk(P) {
  const run = saveData.run,
    id = P.resident,
    F = QUESTS.favours[id],
    I = QUESTS.invite,
    o = { name: P.name },
    say = async (/** @type {string} */ l) => talkLine(P.who, l, null, o);
  if (!run || !F) return;
  if (run.invited) await say(I.thanks);
  else if (!F.kind) {
    await say(F.ask);
    await say(I.come);
    const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
    if (yes && residentInvite(saveData, id, RESIDENTS)) {
      saveNow();
      if (typeof debugLog !== 'undefined') debugLog.add('run', `resident invited: ${id}`);
      await say(I.yes);
      toast(residentFill(I.moving, id));
    } else await say(I.no);
  } else if (favourHeld(run)) await say(I.held);
  else {
    const i = questHere(),
      offer = favourOffer(run, i, id, F, questData());
    if (!offer) await say(I.none);
    else {
      await say(questFill(F.ask, offer, QUESTS));
      await say(I.take);
      const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
      if (yes && favourTake(run, i, offer)) {
        saveNow();
        if (typeof debugLog !== 'undefined') debugLog.add('run', `favour taken: ${id} (${offer.kind})`);
        await say(I.taking);
      } else await say(I.no);
    }
  }
  talkHide();
}
/** talk to the quest giver: their offer and Yes / No, or a line when there is none @param {any} P */
export async function questGiverTalk(P) {
  const run = saveData.run,
    i = questHere(),
    o = { name: P.name },
    say = QUESTS.say,
    slot = questSlot(P),
    offer = questOfferHere(slot);
  if (!run || !offer) {
    const done = run && run.quests && run.quests.took.includes(questKey(i, slot));
    await talkLine(P.who, done ? say.taken : say.none, null, o);
    talkHide();
    return;
  }
  const T = QUESTS.texts.find(t => t.id === offer.text);
  await talkLine(P.who, questFill(T ? T.ask : '', offer, QUESTS), null, o);
  if (questsHeld(run) >= QUESTS.held) {
    await talkLine(P.who, say.full, null, o);
    talkHide();
    return;
  }
  await talkLine(P.who, say.take, null, o);
  const yes = (await talkChoose([{ text: 'Yes' }, { text: 'No' }])) === 0;
  if (yes && questTake(run, i, offer, QUESTS, slot)) {
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
    const held = questsHeld(run);
    toast(held ? `${QUESTS.say.empty} (${held} of ${QUESTS.held} quests held)` : QUESTS.say.empty);
    return;
  }
  for (const q of due) {
    if (!questPay(run, q)) continue;
    /* RS-2: a favour invites its resident in place of the reward pick */
    if (q.res) {
      residentInvite(saveData, q.res, RESIDENTS);
      saveNow();
      if (typeof debugLog !== 'undefined') debugLog.add('run', `favour handed in, resident invited: ${q.res}`);
      toast(residentFill(questFill(QUESTS.invite.done, q, QUESTS), q.res));
      continue;
    }
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
  for (const q of (r && r.done) || []) toast(`Quest done: ${questTitle(q)}. Hand it in at a notice board.`);
  for (const q of (r && r.failed) || []) toast(QUESTS.say.fail.replace(/\{title\}/g, questTitle(q)));
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
    return `<li class="${q.done ? 'done' : ''}">${escapeHtml(questTitle(q))}${what ? ` <small class="tnum">${escapeHtml(what)}</small>` : ''}</li>`;
  };
  return `<div class="map-quests"><div class="sub">Quests ${questsHeld(run)} of ${QUESTS.held}</div><ul>${held.map(row).join('')}</ul></div>`;
}
