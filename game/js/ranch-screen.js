'use strict';
/* ================= THE RANCH SCREEN (roguelite track RL-9) =================
   Copperleaf's ranch, the barn by the farm: a tap on its door walks you in (int_barn), a tap on the training board or
   the rancher opens this sheet. It collects what the trainees banked since you were last here (logic/ranch.js
   ranchCollect), then shows the ranch's level and your Scrap, the Billies training (each with the hours it has
   banked, at most rules.json ranch.bankHours, and its level so far) and storage: each Billie resting there can start
   training (for Scrap) or join the team. Opening the sheet collects, so a trainee's card shows its way to the next
   level; time away past bankHours is lost, so the sheet says how long it banks. Every change is saved at once. Storage stays home during a run, so the
   ranch's sheet is the hub's only.
   RL-10: the nursery (eggs with their time to hatch, and Hatch when one is ready) and "Breed a pair": Safe or Risky,
   two Billies from home picked as cards (uiState.breedPick), a safe pair's egg shown before paying (logic/breeding.js
   rolls it the same however often it is asked), a risky pair's odds spelled out instead. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  buildingRowsHTML,
  closeModal,
  hatchModal,
  modal,
  provide,
  render,
  renderOverlay,
  toast,
  xpProgress,
} from './hooks.js';
import { COATS, RULES, SPECIES } from './game-data.js';
import { graftLook } from './logic/graft-art.js';
import { billyName, teamSize, toTeam } from './logic/rules.js';
import { ranchNow } from './logic/ranch-clock.js';
import {
  ranchCanTrain,
  ranchCap,
  ranchCollect,
  ranchLevel,
  ranchSlots,
  ranchStop,
  ranchTrainStart,
} from './logic/ranch.js';
import { incomeCollect, incomePile, incomeStart } from './logic/ranch-income.js';
import {
  breedCan,
  breedCost,
  breedHatch,
  breedLine,
  breedNests,
  breedParent,
  breedReady,
  breedRoll,
  breedStart,
} from './logic/breeding.js';
import { escapeHtml, save, saveData, uiState } from './game-state.js';
import { eggHTML } from './art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
/* eslint-disable no-func-assign */
expose({
  BREED_WHY: [() => BREED_WHY],
  RANCH_WHY: [() => RANCH_WHY],
  breedDo: [() => breedDo, v => (breedDo = v)],
  breedHTML: [() => breedHTML, v => (breedHTML = v)],
  breedLeft: [() => breedLeft],
  breedMark: [() => breedMark],
  breedPct: [() => breedPct],
  breedPickNow: [() => breedPickNow, v => (breedPickNow = v)],
  incomeHTML: [() => incomeHTML, v => (incomeHTML = v)],
  ranchCardHTML: [() => ranchCardHTML, v => (ranchCardHTML = v)],
  ranchDo: [() => ranchDo, v => (ranchDo = v)],
  ranchOpen: [() => ranchOpen, v => ((ranchOpen = v), provide({ ranchOpen }))],
});
/* eslint-enable no-func-assign */
provide({ ranchOpen });
/* to-module: end */
const RANCH_WHY = {
  run: 'Storage stays home on a run',
  stored: 'Only Billies in storage train',
  training: 'Training',
  full: 'Every slot is busy',
  cap: 'Trained as far as the ranch goes',
  scrap: 'Not enough Scrap',
};
const BREED_WHY = {
  run: 'The ranch is closed on a run',
  parent: 'Pick two Billies from home',
  same: 'Pick two different Billies',
  line: 'Safe breeding needs two of one line. Try Risky',
  full: 'Every nest is busy',
  scrap: 'Not enough Scrap',
};
/** the time an egg has left, for people: "25 min", "3 h", "3 h 20 min" */
const breedLeft = ms => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
/** a bred Billie's mark, in words */
const breedMark = m => (m.mut ? (m.mut.k === 'abom' ? 'Abomination' : 'Quirk') : '');
const breedPct = p => `${Math.round(p * 100)}%`;
/** the picks on the breeding part: two uids and the mode, kept while the sheet is open (gone Billies dropped) */
function breedPickNow(s) {
  const P = uiState.breedPick || (uiState.breedPick = { a: '', b: '', mode: 'safe' });
  if (P.a && !breedParent(s, P.a)) P.a = '';
  if (P.b && !breedParent(s, P.b)) P.b = '';
  return P;
}
/** the nursery and "Breed a pair" on the ranch's sheet */
function breedHTML(s, now, BR) {
  const P = breedPickNow(s),
    nests = breedNests(s, BR),
    nursery = s.ranch.nursery.length
      ? `<div class="bx-grid">${s.ranch.nursery
          .map((e, i) => {
            const ready = breedReady(e, now);
            return `<div class="bx k-card ranch-card breed-egg"><div class="bx-main"><span class="bx-spr">${eggHTML(e.mode === 'risky' ? 10 : 2, 40, ready ? 'wob' : '')}</span><b>${e.mode === 'risky' ? 'A risky egg' : `${escapeHtml(SPECIES[e.egg.sp].name)} egg`}</b><span class="bx-sub">${ready ? 'Ready to hatch' : `Hatches in ${breedLeft(e.ready - now)}`}</span></div><button class="qk k-btn" data-r="hatch" data-i="${i}"${ready ? '' : ' disabled'}>Hatch</button></div>`;
          })
          .join('')}</div>`
      : `<p class="note">No eggs. Pick two Billies below to breed a pair.</p>`,
    home = s.team.concat(s.box).filter(m => breedParent(s, m.uid)),
    cards = home
      .map(
        m =>
          `<pb-pick-card data-u="${m.uid}" heading="${escapeHtml(billyName(m))}" sub="Lv ${m.lvl} · ${escapeHtml(SPECIES[m.sp].name)}${s.team.includes(m) ? ' · team' : ''}"${P.a === m.uid || P.b === m.uid ? ' selected' : ''}><span slot="art">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftLook(m) })}</span></pb-pick-card>`
      )
      .join(''),
    why = breedCan(s, P.a, P.b, P.mode, BR),
    A = breedParent(s, P.a),
    B = breedParent(s, P.b),
    cost = breedCost(P.mode, BR),
    O = BR.odds;
  let preview = '';
  if (A && B && why !== 'same' && why !== 'line') {
    if (P.mode === 'safe') {
      const { m } = breedRoll(s, A, B, 'safe', BR);
      preview = `<div class="bx k-card ranch-card breed-preview"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftLook(m) })}</span><b>${escapeHtml(billyName(m))}</b><span class="bx-sub tnum">Lv ${m.lvl} · parts ${Object.values(m.build).join(' ')}</span><span class="bx-sub">${m.coat && COATS[m.coat] ? `${escapeHtml(COATS[m.coat].name)} coat · ` : ''}hatches in ${BR.hours} h</span></div></div>`;
    } else
      preview = `<p class="note breed-preview">Hatches in ${BR.hours} h: ${escapeHtml([...new Set([breedLine(A), breedLine(B)])].map(l => SPECIES[l + '0'].name).join(' or '))}. ${breedPct(O.safe)} plain, ${breedPct(O.quirk)} a quirk (a parent’s move, an odd size or coat), ${breedPct(O.abom)} an abomination (odd parts, its own name, one stat far up and one down).</p>`;
  }
  const mode = (k, l, n) =>
    `<button type="button" role="radio" aria-checked="${P.mode === k}" class="${P.mode === k ? 'on' : ''}" data-r="mode" data-m="${k}">${l} · ${n} Scrap</button>`;
  return `<section class="tpanel"><div class="sec-h"><h2>Nursery</h2><span class="count tnum">${s.ranch.nursery.length} of ${nests}</span></div>${nursery}</section><section class="tpanel breed-pair"><div class="sec-h"><h2>Breed a pair</h2></div><p class="note">Safe: two of one line, and you see the egg first. Risky: any two, for less, and anything can hatch. The parents stay free.</p><div class="seg" role="radiogroup" aria-label="Breeding">${mode('safe', 'Safe', BR.safeCost)}${mode('risky', 'Risky', BR.riskyCost)}</div><div class="list">${cards || '<p class="note">Nobody is home.</p>'}</div>${preview}${A && B && why ? `<p class="note">${BREED_WHY[why]}.</p>` : ''}<button class="qk k-btn" data-r="breed"${why ? ' disabled' : ''}>Breed · ${cost} Scrap</button></section>`;
}
/** one Billie's card on the ranch's sheet: its picture, name and level, a line under it and its buttons */
function ranchCardHTML(m, sub, btns) {
  return `<div class="bx k-card ranch-card"><div class="bx-main"><span class="bx-spr">${rigCanvasHTML(m.sp, 56, { build: m.build, coat: m.coat, graft: graftLook(m) })}</span><b>${escapeHtml(billyName(m))}</b><span class="bx-sub tnum">Lv ${m.lvl}${m.mut ? ` · ${breedMark(m)}` : ''}</span>${sub}</div>${btns}</div>`;
}
/** RL-10b: the ranch's passive income: the pile, how long until it is full, Collect */
function incomeHTML(s, now, R) {
  const P = incomePile(s, now, R),
    rate = `${P.rate} Scrap an hour`;
  return `<section class="tpanel ranch-income"><div class="sec-h"><h2>Income</h2><span class="count tnum">${P.scrap} Scrap</span></div><div class="bx k-card ranch-card"><div class="bx-main"><b>${P.full ? 'Full: collect to start again' : rate}</b><span class="bx-sub">${P.full ? `The ranch banks up to ${R.income.capHours} h at ${rate}.` : `Full in ${breedLeft(P.left)} (up to ${R.income.capHours} h)`}</span></div><button class="qk k-btn" data-r="collect"${P.scrap > 0 ? '' : ' disabled'}>Collect</button></div></section>`;
}
/** the ranch's sheet, opened (or drawn again in place after a button) */
export function ranchOpen() {
  const s = saveData,
    R = RULES.ranch;
  if (!R || s.run) {
    toast('The ranch is closed while you’re away on a run.');
    return;
  }
  /* RL-10b: the ranch clock (logic/ranch-clock.js): turned back, time stands still and the sheet says so */
  const { now, back } = ranchNow(s, Date.now(), R);
  ranchCollect(s, now, R, t => toast(t));
  if (R.income) incomeStart(s, now);
  save();
  const slots = ranchSlots(s, R),
    cap = ranchCap(s, R),
    training = s.ranch.trainees.map(t => ({ t, m: s.box.find(b => b.uid === t.uid) })).filter(x => x.m),
    resting = s.box.filter(m => !s.ranch.trainees.some(t => t.uid === m.uid)),
    full = s.team.length >= teamSize();
  const trainHTML = training.length
    ? `<div class="bx-grid">${training
        .map(({ m }) => {
          const next = (1 - xpProgress(m)) / R.levelsPerHour;
          return ranchCardHTML(
            m,
            `<pb-stat-bar kind="xp" value="${Math.round(xpProgress(m) * 100)}" max="100"></pb-stat-bar><span class="bx-sub">${m.lvl >= cap ? `At Lv ${cap}, the ranch’s most` : `Lv ${m.lvl + 1} in about ${next < 1 ? `${Math.max(1, Math.round(next * 60))} min` : `${next.toFixed(1)} h`}`}</span>`,
            `<button class="qk k-btn" data-r="stop" data-u="${m.uid}">Stop</button>`
          );
        })
        .join('')}</div>`
    : `<p class="note">Nobody is training. Pick a Billie from storage below.</p>`;
  const restHTML = resting.length
    ? `<div class="bx-grid">${resting
        .map(m => {
          const why = ranchCanTrain(s, m.uid, R);
          return ranchCardHTML(
            m,
            why && why !== 'scrap' && why !== 'full' ? `<span class="bx-sub">${RANCH_WHY[why]}</span>` : '',
            `<button class="qk k-btn" data-r="train" data-u="${m.uid}"${why ? ' disabled' : ''}>Train · ${R.trainCost} Scrap</button><button class="qk k-btn" data-r="team" data-u="${m.uid}"${full ? ' disabled' : ''}>${full ? 'Team full' : 'To team'}</button>`
          );
        })
        .join('')}</div>`
    : `<p class="note">Storage is empty. When your team is full, new Billies rest here.</p>`;
  const again = !!(uiState.modal && uiState.modal.cls === 'ranch-sheet'),
    sheet = again && document.querySelector('#ov .sheet'),
    body = again && document.querySelector('#ov .sheet .body'),
    scroll = sheet ? [sheet.scrollTop, body ? body.scrollTop : 0] : null;
  const M = {
    title: `The ranch · Lv ${ranchLevel(s)}`,
    cls: 'ranch-sheet',
    html: `<p class="ranch-head"><pb-coin kind="scrap" value="${s.meta.scrap}" label="Scrap"></pb-coin> <span class="note">Ranch level ${ranchLevel(s)} · trains up to Lv ${cap} · ${R.levelsPerHour < 1 ? `a level every ${+(1 / R.levelsPerHour).toFixed(1)} h` : `${R.levelsPerHour} levels an hour`}, banking up to ${R.bankHours} h between visits</span></p>${back ? `<p class="note ranch-back">Your device’s clock is behind the ranch’s, so its timers wait until it catches up.</p>` : ''}${R.income ? incomeHTML(s, now, R) : ''}<section class="tpanel"><div class="sec-h"><h2>Training</h2><span class="count tnum">${training.length} of ${slots}</span></div>${trainHTML}</section><section class="tpanel"><div class="sec-h"><h2>Storage</h2><span class="count tnum">${resting.length}</span></div>${restHTML}</section>${R.breed ? breedHTML(s, now, R.breed) : ''}${typeof buildingRowsHTML === 'function' && buildingRowsHTML('ranch', 'ranch') ? `<section class="tpanel"><div class="sec-h"><h2>Upgrades</h2></div>${buildingRowsHTML('ranch', 'ranch')}</section>` : ''}<p class="note">Runs bring Scrap home: a little for every place you reach.</p>`,
    btns: [{ l: 'Done', c: 'gold', f: closeModal }],
    after: () => {
      for (const b of document.querySelectorAll('#ov .ranch-sheet [data-r]'))
        b.addEventListener('click', () => {
          const d = /** @type {HTMLElement} */ (b).dataset;
          ranchDo(d.r, d.u, d.i != null ? Number(d.i) : d.m);
        });
      for (const c of document.querySelectorAll('#ov .ranch-sheet pb-pick-card'))
        c.addEventListener('pb-pick', () => ranchDo('pick', /** @type {HTMLElement} */ (c).dataset.u));
      /* drawn again in place: the sheet keeps its scroll (a long storage list) */
      const sh = document.querySelector('#ov .sheet'),
        bd = document.querySelector('#ov .sheet .body');
      if (scroll && sh) sh.scrollTop = scroll[0];
      if (scroll && bd) bd.scrollTop = scroll[1];
    },
  };
  /* drawn again in place (a button pressed); any other sheet waits behind it */
  if (again) {
    uiState.modal = M;
    renderOverlay();
  } else {
    uiState.breedPick = null;
    modal(M);
  }
}
/** a button on the ranch's sheet: start or stop training, bring a Billie onto the team, or (RL-10) pick a parent, the
    mode, breed or hatch; saved, then drawn again */
function ranchDo(what, uid, arg) {
  const s = saveData,
    R = RULES.ranch,
    m = s.box.find(b => b.uid === uid);
  if (!R) return;
  const { now } = ranchNow(s, Date.now(), R);
  if (R.breed && (what === 'pick' || what === 'mode' || what === 'breed' || what === 'hatch')) {
    breedDo(what, uid, arg, now, R.breed);
    return;
  }
  if (what === 'collect' && R.income) {
    const got = incomeCollect(s, now, R);
    if (got) toast(`+${got} Scrap from the ranch.`);
    if (typeof debugLog !== 'undefined') debugLog.add('ranch', `collect: ${got}, ${s.meta.scrap} Scrap`);
    save();
    render();
    ranchOpen();
    return;
  }
  if (!m) return;
  if (what === 'train') {
    const why = ranchTrainStart(s, uid, now, R);
    toast(why ? `${RANCH_WHY[why]}.` : `${billyName(m)} starts training.`);
  } else if (what === 'stop') {
    const got = ranchStop(s, uid, now, R, t => toast(t));
    if (got && !got.up) toast(`${billyName(m)} stops training.`);
  } else if (what === 'team') {
    if (s.team.length >= teamSize() || !toTeam(m)) return;
    toast(`${billyName(m)} joins your team.`);
  }
  if (typeof debugLog !== 'undefined')
    debugLog.add('ranch', `${what}: ${s.ranch.trainees.length} training, ${s.meta.scrap} Scrap`);
  save();
  render();
  ranchOpen();
}
/** RL-10: the breeding part's buttons */
function breedDo(what, uid, arg, now, BR) {
  const s = saveData,
    P = breedPickNow(s);
  if (what === 'pick') {
    if (P.a === uid) P.a = '';
    else if (P.b === uid) P.b = '';
    else if (!P.a) P.a = uid;
    else if (!P.b) P.b = uid;
    else P.b = uid;
  } else if (what === 'mode') P.mode = arg === 'risky' ? 'risky' : 'safe';
  else if (what === 'breed') {
    const why = breedStart(s, P.a, P.b, P.mode, now, BR);
    if (why) toast(`${BREED_WHY[why]}.`);
    else {
      toast(P.mode === 'risky' ? 'A risky egg is in the nursery.' : 'An egg is in the nursery.');
      P.a = P.b = '';
    }
  } else if (what === 'hatch') {
    /* the hatch window (pending-windows.js) in place of the sheet; the sheet opens again after "Welcome aboard" */
    const i = Number(arg),
      e = s.ranch.nursery[i];
    if (e && breedReady(e, now)) {
      uiState.modal = null;
      hatchModal(
        e.mode === 'risky' ? 10 : 2,
        () => {
          const got = breedHatch(s, i, ranchNow(s, Date.now(), RULES.ranch).now);
          if (got && typeof debugLog !== 'undefined')
            debugLog.add('ranch', `hatch: ${s.ranch.nursery.length} eggs, ${got.m.mut ? got.m.mut.k : 'plain'}`);
          save();
          return got;
        },
        ranchOpen
      );
      return;
    }
  }
  if (what === 'breed' && typeof debugLog !== 'undefined')
    debugLog.add('ranch', `breed: ${s.ranch.nursery.length} eggs, ${s.ranch.bred} bred, ${s.meta.scrap} Scrap`);
  if (what === 'breed') {
    save();
    render();
  }
  ranchOpen();
}
