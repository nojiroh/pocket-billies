'use strict';
/* ================= EVENTS ON SCREEN (roguelite track RL-12b) =================
   A run's event (events.json; the rules are logic/encounters.js) as the player meets it, in one sheet:
   - the intro and the options; an option whose need doesn't hold, or whose Moneys aren't there, is greyed out and
     says why ("Needs a Psychic Billie"); the sheet can't be closed any other way than by an option;
   - the option's script (docs/SCRIPTS.md) played on this file's stage: its lines one at a time ("Go on"), a choice as
     buttons, the event commands through logic/encounters.js; a battle closes the sheet and the script goes on after
     it (a lost one ends the run, and the event with it); a Perk or a reward pick opens its own sheet;
   - at the end, what changed (Moneys, items, pyramids) and "Keep walking".
   The event is spent when an option is picked (its cost paid then). While it plays, run.enc.play holds where it is
   (the event, the option, the script's last checkpoint, an event foe's class), saved at once: a reload in the middle
   opens it again from there (encounterResume, through showPendingWindows), after the battle if one was on. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, provide, render, renderOverlay, rewardPickOpen, toast } from './hooks.js';
import { EVENTS, ITEMS, PERKS, PYRAMIDS, QUESTS, RESIDENTS, RULES, SPECIES, worldAddTrainers } from './game-data.js';
import { rngFrom } from './logic/rng.js';
import { geneWords } from './logic/genes.js';
import { bankTry } from './logic/gene-bank.js';
import {
  geneEventDraw,
  geneEventLab,
  geneEventLearn,
  geneEventRecall,
  geneEventSlots,
  geneEventSplice,
  geneEventWild,
} from './logic/gene-events.js';
import {
  addBilly,
  billyGraft,
  billyName,
  billyUnstable,
  feedLevels,
  geneData,
  geneLimit,
  healAll,
  makeBilly,
  maxHp,
  teamSize,
  xpFor,
} from './logic/rules.js';
import { META_MAX } from './logic/meta-state.js';
import { residentCandidate, residentInvite } from './logic/residents.js';
import { runHome } from './logic/run-state.js';
import { runMapNode } from './logic/run-map.js';
import { runImmune } from './logic/run-loop.js';
import { encBoon, encOf, fxRowOf } from './logic/run-enc.js';
import {
  encChanges,
  encEventFoe,
  encHeal,
  encHurt,
  encLoot,
  encMoney,
  encPerk,
  encPickBilly,
  encPlaceLevel,
  encRng,
  encStatus,
  encWildFoe,
  eventAt,
  eventOptionState,
  eventPlayed,
} from './logic/encounters.js';
import { rewardDataGame, rewardOfferMake } from './logic/rewards.js';
import { startTrainer, startWild } from './logic/battle-engine.js';
import { parseScript } from './logic/script-parse.js';
import { runScript, storyHolds } from './logic/script.js';
import { activeBattle, escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { moneyHTML } from './art.js';
import { perkPickOpen } from './perk-screen.js';
/* eslint-disable no-func-assign */
expose({
  ENC_STOP: [() => ENC_STOP],
  encChoose: [() => encChoose, v => (encChoose = v)],
  encDna: [() => encDna],
  encFight: [() => encFight, v => (encFight = v)],
  encGeneLog: [() => encGeneLog],
  encGeneRng: [() => encGeneRng],
  encHere: [() => encHere],
  encHolds: [() => encHolds],
  encLineHTML: [() => encLineHTML],
  encLines: [() => encLines, v => (encLines = v)],
  encNote: [() => encNote],
  encPlaying: [() => encPlaying, v => (encPlaying = v)],
  encRegion: [() => encRegion],
  encSheet: [() => encSheet, v => (encSheet = v)],
  encSheetClose: [() => encSheetClose, v => (encSheetClose = v)],
  encStep: [() => encStep, v => (encStep = v)],
  encWait: [() => encWait],
  encounterEnd: [() => encounterEnd, v => (encounterEnd = v)],
  encounterOpen: [() => encounterOpen, v => ((encounterOpen = v), provide({ encounterOpen }))],
  encounterPick: [() => encounterPick, v => (encounterPick = v)],
  encounterPlay: [() => encounterPlay, v => (encounterPlay = v)],
  encounterResume: [() => encounterResume, v => (encounterResume = v)],
  encounterStage: [() => encounterStage, v => (encounterStage = v)],
});
/* eslint-enable no-func-assign */
provide({ encounterOpen });
/* to-module: end */
/** the script is playing in this page now (a reload clears it: then run.enc.play says what to resume) */
export let encPlaying = false;
/** the sheet's lines so far, and the button that moves it on */
let encLines = /** @type {string[]} */ ([]);
/** an event foe's battle ended in a loss, or the run ended: the script stops */
const ENC_STOP = Object.assign(new Error('the event stopped'), { name: 'EncounterStop' });

/** wait while a condition holds (a battle, a sheet) */
const encWait = async (/** @type {() => boolean} */ f) => {
  while (f()) await new Promise(r => setTimeout(r, 150));
};
/** a line as the sheet shows it: the speaker in bold */
const encLineHTML = (/** @type {{ who: string | null, text: string }} */ l) =>
  `<p class="ev-line">${l.who ? `<b>${escapeHtml(l.who)}</b> ` : ''}${escapeHtml(l.text)}</p>`;
/** show the event's sheet (in place when it is up; ahead of any other) */
function encSheet(M) {
  if (uiState.modal && uiState.modal.cls !== M.cls) uiState.mq.unshift(uiState.modal);
  uiState.mq = uiState.mq.filter(q => q.cls !== M.cls);
  uiState.modal = M;
  renderOverlay();
}
/** the sheet closed, for a battle or another sheet */
function encSheetClose() {
  if (uiState.modal && uiState.modal.cls === 'event-sheet') {
    uiState.modal = null;
    renderOverlay();
  }
}
/** the place the player is at, as a map node (-1 off the map) */
const encHere = () => {
  const run = saveData.run;
  return run && run.map ? runMapNode(saveData.trip.node) : -1;
};
/** the story state for an option's need, read now */
const encHolds = (/** @type {string} */ cond) => storyHolds(cond);
/** SP-6: DNA on hand (meta.dna), for an option's DNA price and the summary */
const encDna = () => (saveData.meta && saveData.meta.dna) || 0;

/* ---------- the intro and the options ---------- */
/** open an event: the one at map node i (drawn and kept the first time), or the one given (the debug menu)
 * @param {number | null} i @param {string} [id] */
export function encounterOpen(i, id) {
  const run = saveData.run;
  if (!run || encPlaying || activeBattle) return;
  /* RS-2: a resident event only while the run's resident can be met at one */
  const meet = !!residentCandidate(saveData, RESIDENTS, 'event'),
    ev = id || (i != null && i >= 0 ? eventAt(run, i, EVENTS, encHolds, meet) : '');
  if (!ev || !EVENTS.events[ev]) {
    toast('Nothing happens here. Not today.');
    return;
  }
  saveNow();
  const E = EVENTS.events[ev],
    intro = parseScript(E.intro).filter(n => n.k === 'say');
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `event ${ev}`);
  encSheet({
    title: escapeHtml(E.title),
    cls: 'event-sheet',
    lock: true,
    html: `<div class="ev-lines">${intro.map(encLineHTML).join('')}</div>`,
    btns: E.options.map((o, k) => {
      const st = eventOptionState(o, encHolds, saveData.se, ITEMS, encDna());
      return {
        l: `${escapeHtml(o.text)}${o.cost ? ` <small>${moneyHTML(o.cost, 12)}</small>` : ''}${o.dna ? ` <small><pb-coin kind="dna" value="${o.dna}" label="DNA"></pb-coin></small>` : ''}${st.ok ? '' : ` <small class="ev-why">${escapeHtml(st.why)}</small>`}`,
        c: k === E.options.length - 1 ? 'quiet' : 'dark',
        dis: !st.ok,
        f: () => encounterPick(ev, i, k),
      };
    }),
  });
}
/** an option picked: its cost paid, the event spent, the script played @param {string} id @param {number | null} i
 * @param {number} k */
function encounterPick(id, i, k) {
  const run = saveData.run,
    E = EVENTS.events[id],
    o = E && E.options[k];
  if (!run || !o || encPlaying) return;
  const st = eventOptionState(o, encHolds, saveData.se, ITEMS, encDna());
  if (!st.ok) return;
  if (o.cost) encMoney(saveData, -o.cost);
  if (o.dna) saveData.meta.dna = Math.max(0, encDna() - o.dna);
  eventPlayed(run, id, i != null && i >= 0 ? i : null);
  encOf(run).play = { id, i: i != null && i >= 0 ? i : -1, opt: k, at: [] };
  saveNow();
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `event ${id}: option ${k + 1}`);
  encounterPlay(null, {
    se: saveData.se + (o.cost || 0),
    dna: encDna() + (o.dna || 0),
    items: { ...saveData.items },
    pyramids: { ...saveData.pyramids },
  });
}

/* ---------- the option's script ---------- */
/** play the option run.enc.play names, from the start or from its last checkpoint
 * @param {number[] | null} resume
 * @param {{ se: number, dna?: number, items: Record<string, number>, pyramids: Record<string, number> }} before */
async function encounterPlay(resume, before) {
  const run = saveData.run,
    P = run && run.enc && run.enc.play;
  if (!run || !P || encPlaying) return;
  const E = EVENTS.events[P.id],
    o = E && E.options[P.opt];
  if (!o) {
    encOf(run).play = null;
    saveNow();
    return;
  }
  encPlaying = true;
  encLines = [];
  let stopped = false;
  try {
    await runScript(parseScript(o.then), encounterStage(P.id, P.i), {
      save: saveData,
      id: 'event:' + P.id,
      resume,
      beforeCheckpoint: path => {
        if (saveData.run && saveData.run.enc && saveData.run.enc.play) saveData.run.enc.play.at = path;
        saveNow();
      },
    });
  } catch (e) {
    if (e !== ENC_STOP) {
      console.error(e);
      if (typeof debugLog !== 'undefined') debugLog.add('error', `event ${P.id}: ${e && e.message}`);
    }
    stopped = true;
  }
  encPlaying = false;
  if (saveData.story) delete saveData.story.wager;
  if (saveData.run && saveData.run.enc) saveData.run.enc.play = null;
  saveNow();
  render();
  if (stopped || !saveData.run || saveData.run.at.phase === 'payout') {
    encSheetClose();
    return;
  }
  encounterEnd(E.title, before);
}
/** the end: what changed, and back to walking */
function encounterEnd(title, before) {
  const ch = encChanges(before, { se: saveData.se, dna: encDna(), items: saveData.items, pyramids: saveData.pyramids }),
    name = (/** @type {string} */ k) =>
      k === 'money'
        ? 'Moneys'
        : k === 'dna'
          ? 'DNA'
          : k.startsWith('coin:')
            ? (PYRAMIDS[k.slice(5)] || { n: k }).n
            : (ITEMS[k] || { n: k }).n;
  encSheet({
    title: escapeHtml(title),
    cls: 'event-sheet',
    lock: true,
    html: `<div class="ev-lines">${encLines.join('')}</div>${
      ch.length
        ? `<p class="ev-sum">${ch.map(([k, n]) => (k === 'money' ? `${n > 0 ? '+' : '−'}${moneyHTML(Math.abs(n), 12)}` : `${n > 0 ? '+' : '−'}${Math.abs(n)} ${escapeHtml(name(k))}`)).join(' · ')}</p>`
        : ''
    }`,
    btns: [{ l: 'Keep walking', c: 'dark', f: closeModal }],
  });
}
/** the sheet with the lines so far and one button; resolves when it is tapped */
function encStep(title, label) {
  return new Promise(res =>
    encSheet({
      title: escapeHtml(title),
      cls: 'event-sheet',
      lock: true,
      html: `<div class="ev-lines">${encLines.join('')}</div>`,
      btns: [{ l: label, c: 'dark', f: () => res(undefined) }],
    })
  );
}
/** a line of narration the stage adds itself (a loot draw, a level) */
const encNote = (/** @type {string} */ text) => encLines.push(encLineHTML({ who: null, text }));

/** a fight in the middle of an event: the sheet closes, the battle runs, the script goes on after a win (and after
 * the win's sheets); a loss stops it @param {() => boolean} start */
async function encFight(start) {
  encSheetClose();
  await new Promise(r => setTimeout(r, 60));
  if (!start()) return;
  await encWait(() => !!activeBattle);
  await encWait(() => !!uiState.modal || uiState.mq.length > 0);
  const run = saveData.run;
  if (!run || run.at.phase === 'payout' || !saveData.team.some(m => m.hp > 0)) throw ENC_STOP;
  encLines = [];
}

/** the stage an event's script plays on: lines, choices and the event commands @param {string} id
 * @param {number} i the map node (-1: from the debug menu, the place you are at counts) */
function encounterStage(id, i) {
  const title = EVENTS.events[id].title,
    at = () => (i >= 0 ? i : Math.max(0, encHere())),
    team = () => saveData.team;
  return {
    say: async l => {
      encLines.push(encLineHTML(l));
      await encStep(title, 'Go on');
    },
    choose: options =>
      new Promise(res =>
        encSheet({
          title: escapeHtml(title),
          cls: 'event-sheet',
          lock: true,
          html: `<div class="ev-lines">${encLines.join('')}</div>`,
          btns: options.map((op, k) => ({ l: escapeHtml(op.text), c: 'dark', f: () => res(k) })),
        })
      ),
    heal: ([s]) => {
      if (s == null) healAll();
      else encHeal(team(), +s, maxHp);
      save();
    },
    money: ([n]) => {
      encMoney(saveData, +n);
    },
    hurt: ([s]) => {
      encHurt(team(), +s, maxHp);
    },
    status: ([sid]) => {
      /* PK-3: a Perk that keeps the status off (Oven Mitts) keeps it off the whole team */
      if (!runImmune(saveData, PERKS, sid)) encStatus(team(), sid);
    },
    fx: ([n, ...row]) => {
      encBoon(saveData.run, [fxRowOf(row)], +n, id);
    },
    invite: () => {
      /* RS-2: the run's resident, met at this event; a favour of theirs held from a town goes (it's done with) */
      const run = saveData.run,
        rid = residentCandidate(saveData, RESIDENTS, 'event'),
        r = rid ? RESIDENTS[rid] : null;
      if (!run || !r || !residentInvite(saveData, rid, RESIDENTS)) return;
      if (run.quests) run.quests.held = run.quests.held.filter(q => !q.res);
      saveNow();
      if (typeof debugLog !== 'undefined') debugLog.add('run', `resident invited at an event: ${rid}`);
      encNote(`The traveller is ${r.name}, ${/^[aeiou]/i.test(r.role) ? 'an' : 'a'} ${r.role.toLowerCase()}.`);
      encNote(QUESTS.invite.moving.replace(/\{name\}/g, r.name));
    },
    wager: ([n]) => {
      (saveData.story || (saveData.story = {})).wager = encRng(saveData.run).chance(+n / 100) ? 'win' : 'lose';
    },
    loot: async ([table, n]) => {
      const got = encLoot(saveData.run, EVENTS, table, n == null ? 1 : +n);
      for (const [k, c] of Object.entries(got)) {
        saveData.items[k] = (saveData.items[k] || 0) + c;
        encNote(`You got ${c > 1 ? c + ' ' : ''}${ITEMS[k].n}${c > 1 ? 's' : ''}.`);
      }
      saveNow();
      await encStep(title, 'Go on');
    },
    level: async ([n]) => {
      const m = encPickBilly(saveData.run, team());
      if (!m) return;
      const d = +n;
      if (d > 0) feedLevels(m, d, () => {});
      else {
        const old = maxHp(m);
        m.lvl = Math.max(1, m.lvl + d);
        m.xp = xpFor(m.lvl);
        if (m.hp > 0) m.hp = Math.max(1, Math.min(maxHp(m), m.hp + maxHp(m) - old));
      }
      encNote(`${billyName(m)} is level ${m.lvl} now.`);
      saveNow();
      await encStep(title, 'Go on');
    },
    perk: async ([arg]) => {
      const run = saveData.run,
        pid = encPerk(run, arg, PERKS, RULES.run.perks);
      if (!pid) {
        encNote('There was nothing left to give you.');
        await encStep(title, 'Go on');
        return;
      }
      run.offer = [pid];
      saveNow();
      encSheetClose();
      await new Promise(res => perkPickOpen({ text: `${title} left you a Perk.`, then: res }));
    },
    recall: async ([up]) => {
      const run = saveData.run,
        home = new Set(runHome(run)),
        L = team().filter(m => m.kind !== 'robot' && !home.has(m.uid));
      if (!L.length || team().length < 2) {
        encNote('None of your Billies can go back: the ones from home aren’t the billboard’s to take.');
        await encStep(title, 'Go on');
        return;
      }
      const uid = await new Promise(res =>
        encSheet({
          title: escapeHtml(title),
          cls: 'event-sheet',
          lock: true,
          html: `<div class="ev-lines">${encLines.join('')}</div><p class="note">Who goes back? It won’t come home.</p>`,
          btns: [
            ...L.map(m => ({
              l: `${escapeHtml(billyName(m))} <small>Lv ${m.lvl}</small>`,
              c: 'dark',
              f: () => res(m.uid),
            })),
            { l: 'Keep them all', c: 'quiet', f: () => res(null) },
          ],
        })
      );
      if (!uid) return;
      const at_ = team().findIndex(m => m.uid === uid),
        gone = team()[at_],
        q = encWildFoe(
          run,
          at(),
          SPECIES,
          RULES.run,
          gone.lvl - encPlaceLevel(run, at(), RULES.run) + (up == null ? 0 : +up)
        );
      if (!q) return;
      const nb = makeBilly(q.sp, q.lvl, { wild: true });
      nb.hp = maxHp(nb);
      saveData.team[at_] = nb;
      saveData.caught[nb.sp] = 1;
      saveData.seen[nb.sp] = 1;
      if (saveData.buddy === uid) saveData.buddy = saveData.team[0].uid;
      encNote(`${billyName(gone)} went back. ${billyName(nb)} (Lv ${nb.lvl}) joined you.`);
      saveNow();
    },
    /* RO-3e: a revived fossil joins you at the place's level (plus n); a full party picks who stays behind (not one
       from home, as recall), or leaves the fossil where it is */
    revive: async ([sp, up]) => {
      const run = saveData.run,
        lvl = Math.max(1, Math.min(100, encPlaceLevel(run, at(), RULES.run) + (up == null ? 0 : +up))),
        nb = makeBilly(sp, lvl, { wild: true });
      nb.hp = maxHp(nb);
      if (team().length >= teamSize()) {
        const home = new Set(runHome(run)),
          L = team().filter(m => m.kind !== 'robot' && !home.has(m.uid)),
          uid = await new Promise(res =>
            encSheet({
              title: escapeHtml(title),
              cls: 'event-sheet',
              lock: true,
              html: `<div class="ev-lines">${encLines.join('')}</div><p class="note">Your party is full. Who stays behind? It won’t come home.</p>`,
              btns: [
                ...L.map(m => ({
                  l: `${escapeHtml(billyName(m))} <small>Lv ${m.lvl}</small>`,
                  c: 'dark',
                  f: () => res(m.uid),
                })),
                { l: `Leave ${escapeHtml(SPECIES[sp].name)}`, c: 'quiet', f: () => res(null) },
              ],
            })
          );
        if (!uid) {
          encNote(`${SPECIES[sp].name} stays at the dig.`);
          await encStep(title, 'Go on');
          return;
        }
        const i = team().findIndex(m => m.uid === uid),
          gone = team()[i];
        saveData.team.splice(i, 1);
        if (saveData.buddy === uid) saveData.buddy = saveData.team[0].uid;
        encNote(`${billyName(gone)} stays behind.`);
      }
      addBilly(nb);
      encNote(`${billyName(nb)} (Lv ${nb.lvl}) joined you.`);
      saveNow();
      await encStep(title, 'Go on');
    },
    foe: async ([cls, up]) => {
      const run = saveData.run,
        n = at(),
        u = up == null ? 0 : +up,
        T = encEventFoe(run, n, id, cls, u, { classes: EVENTS.classes, species: SPECIES, rules: RULES.run }),
        tid = T.id,
        P = encOf(run).play;
      worldAddTrainers({ [tid]: T });
      if (P) P.foe = { cls, up: u, n };
      saveNow();
      await encFight(() => {
        startTrainer(tid, { talked: true });
        return !!activeBattle;
      });
    },
    wild: async ([up]) => {
      const q = encWildFoe(saveData.run, at(), SPECIES, RULES.run, up == null ? 0 : +up);
      if (!q) return;
      await encFight(() => {
        startWild({ id: 'event', sp: q.sp, lvl: q.lvl });
        return !!activeBattle;
      });
    },
    reward: async ([kind, n]) => {
      const run = saveData.run;
      if (
        !rewardOfferMake(run, 'event:' + id, rewardDataGame(saveData.team), { kind, n: n == null ? undefined : +n })
      ) {
        encNote('There was nothing here for your team.');
        await encStep(title, 'Go on');
        return;
      }
      saveNow();
      encSheetClose();
      await new Promise(res => rewardPickOpen(res));
    },
    /* SP-6: the splice events' (logic/gene-events.js). Their draws come from a stream of the event and the place, so a
       reload in the middle draws the same Gene again */
    dna: ([n]) => {
      saveData.meta.dna = Math.max(0, Math.min(META_MAX, encDna() + +n));
    },
    gene: async ([n]) => {
      const D = geneData(),
        g = encGeneRng(id, at());
      let got = 0;
      for (let k = 0; k < (n == null ? 1 : +n); k++) {
        const o = geneEventDraw(D, saveData, encRegion(), g.next);
        if (!o || !geneEventLearn(saveData, o.id)) break;
        got++;
        encNote(`A Gene Sample for the Gene Bank’s library: ${geneWords(D, o.slot, o.id)}.`);
        encGeneLog(`gene ${o.id}`);
      }
      if (!got) encNote('There was no Gene here you don’t have.');
      saveNow();
      await encStep(title, 'Go on');
    },
    splice: async ([how]) => {
      const D = geneData(),
        g = encGeneRng(id, at()),
        limit = geneLimit(),
        L = team().filter(m => m.kind !== 'robot' && geneEventSlots(D, m).length);
      if (!L.length) {
        encNote('None of your Billies can take a Gene.');
        await encStep(title, 'Go on');
        return;
      }
      /* the back alley is paid for when picked, so it splices someone; the lab charges at the splice, so you can go */
      const lab = how === 'lib',
        uid = await encChoose(
          lab ? 'Who gets a Gene?' : 'Who goes in the chair?',
          L.map(m => ({ l: `${escapeHtml(billyName(m))} <small>Lv ${m.lvl}</small>`, v: m.uid })),
          lab
        );
      const m = uid && team().find(x => x.uid === uid);
      if (!m) return;
      const name = billyName(m);
      let o = /** @type {{ slot: string, id: string, price?: number } | null} */ (null);
      if (lab) {
        const offers = geneEventLab(D, saveData, m);
        if (!offers.length) {
          encNote(`No Gene in your library fits ${name} at the lab’s bench.`);
          await encStep(title, 'Go on');
          return;
        }
        o = await encChoose(
          `Which Gene for ${escapeHtml(name)}?`,
          offers.map(x => {
            const st = bankTry(D, m, x.slot, x.id, limit).st;
            return {
              l: `${escapeHtml(geneWords(D, x.slot, x.id))} <small>${x.price} DNA · Stability ${st.cost} of ${limit}${st.unstable ? ' · Unstable' : ''}</small>`,
              v: x,
              dis: x.why === 'dna',
            };
          }),
          true
        );
        if (!o) return;
      } else o = geneEventWild(D, m, encRegion(), limit, g.next);
      if (!o) {
        encNote(`Nothing in the splicer’s cooler fits ${name}.`);
        await encStep(title, 'Go on');
        return;
      }
      geneEventSplice(D, saveData, m, o.slot, o.id, g.next, o.price || 0);
      encNote(
        `${name} has ${geneWords(D, o.slot, o.id)} now.${billyUnstable(m) ? ` Its cells don’t agree: it is Unstable, and goes by ${billyName(m)}.` : ''}`
      );
      encGeneLog(
        `splice ${m.sp} ${o.slot}=${o.id}${o.price ? `, ${o.price} DNA` : ''}${m.unstable ? ', unstable' : ''}`
      );
      await encStep(title, 'Go on');
    },
    unsplice: async ([n]) => {
      const D = geneData(),
        L = team().flatMap(m =>
          Object.entries(billyGraft(m) || {}).map(([slot, gene]) => ({
            l: `${escapeHtml(billyName(m))}: ${escapeHtml(geneWords(D, slot, gene))}`,
            v: { uid: m.uid, slot },
          }))
        );
      if (!L.length) {
        encNote('None of your Billies wears a Gene to hand in.');
        await encStep(title, 'Go on');
        return;
      }
      const o = await encChoose('Which Gene goes back?', L, true),
        m = o && team().find(x => x.uid === o.uid);
      if (!o || !m) return;
      const name = billyName(m),
        words = geneWords(D, o.slot, (billyGraft(m) || {})[o.slot]);
      geneEventRecall(D, saveData, m, o.slot, encGeneRng(id, at()).next);
      if (n != null && +n > 0) saveData.meta.dna = Math.min(META_MAX, encDna() + +n);
      encNote(`${name} gave back ${words}. The Gene Bank keeps the sequence on file.`);
      encGeneLog(`unsplice ${m.sp} ${o.slot}`);
      await encStep(title, 'Go on');
    },
  };
}
/** SP-6: the stream a splice event draws from at a place (the same after a reload) @param {string} id
 * @param {number} i */
const encGeneRng = (id, i) => rngFrom(saveData.run.seed, `event|gene|${id}|${i}`);
/** SP-6: the region's dex, for the Genes an event draws */
const encRegion = () => (saveData.run && saveData.run.region && saveData.run.region.dex) || [];
/** SP-6: a splice event's line in the debug log (data ids only) @param {string} text */
const encGeneLog = text => {
  if (typeof debugLog !== 'undefined') debugLog.add('event', text);
};
/** SP-6: a pick on the event's sheet: the lines so far, a question, one button an option (greyed out with dis), and
 * "Not now" when one may go; resolves to the option's value (null for Not now)
 * @template T @param {string} ask @param {{ l: string, v: T, dis?: boolean }[]} options @param {boolean} leave
 * @returns {Promise<T | null>} */
function encChoose(ask, options, leave) {
  const title =
    saveData.run && saveData.run.enc && saveData.run.enc.play ? EVENTS.events[saveData.run.enc.play.id].title : '';
  return new Promise(res =>
    encSheet({
      title: escapeHtml(title),
      cls: 'event-sheet',
      lock: true,
      html: `<div class="ev-lines">${encLines.join('')}</div><p class="note">${ask}</p>`,
      btns: [
        ...options.map(o => ({ l: o.l, c: 'dark', dis: !!o.dis, f: () => res(o.v) })),
        ...(leave ? [{ l: 'Not now', c: 'quiet', f: () => res(null) }] : []),
      ],
    })
  );
}

/** a reload in the middle of an event: it opens again where it was (after the battle, if one was on); the debug
 * log's and showPendingWindows's entry. Returns whether it did */
export function encounterResume() {
  const run = saveData.run,
    P = run && run.enc && run.enc.play;
  if (!P || encPlaying || activeBattle || uiState.modal || run.at.phase !== 'walk') return false;
  if (typeof debugLog !== 'undefined') debugLog.add('scene', `event ${P.id} resumed`);
  encounterPlay(P.at && P.at.length ? P.at : null, {
    se: saveData.se,
    dna: encDna(),
    items: { ...saveData.items },
    pyramids: { ...saveData.pyramids },
  });
  return true;
}
