'use strict';
/* ================= WALK TAB ================= */
/* UI-5: the Walk tab (the place card over the scene and its sheet: encounters, the clinic, eggs, your buddy), moved from ui.js as it was; its buttons in walkTabAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, roomState } from './hooks.js';
import { $ } from './util.js';
import { EGGS, LOCATIONS, RULES, SHOPS, locationSubtitle, trainersAt } from './game-data.js';
import {
  billyName,
  eggKm,
  eggSlotCount,
  encounterStock,
  encountersHere,
  findBilly,
  formatNumber,
  healAll,
  metresToKm,
  plural,
  xpFor,
} from './logic/rules.js';
import { runHealCost } from './logic/run-loop.js';
import { startWild } from './logic/battle-engine.js';
import { escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { artURL, eggHTML, uiIconHTML } from './art.js';
import { cleanTrainer, personHTML } from './person-art.js';
import { rigCanvasHTML } from './skeleton-rig.js';
import { mapById } from './walk-view.js';
import { environment, environmentHint, environmentIcon, environmentLabel } from './environment.js';
import { runClinicEach, runGiveUp } from './run.js';
import { trainerTalk } from './story.js';
import { challengeCardHTML, requestListHTML } from './things-to-do.js';
import { progressBarHTML } from './ui-bits.js';
import { closeModal, modal, toast } from './overlay.js';
/* eslint-disable no-func-assign */
expose({
  boardNote: [() => boardNote, v => (boardNote = v)],
  buddyCard: [() => buddyCard, v => (buddyCard = v)],
  clinicHeal: [() => clinicHeal, v => (clinicHeal = v)],
  eggSlots: [() => eggSlots, v => (eggSlots = v)],
  encounterCardHTML: [() => encounterCardHTML, v => (encounterCardHTML = v)],
  environmentLine: [() => environmentLine, v => (environmentLine = v)],
  hereCard: [() => hereCard, v => (hereCard = v)],
  locationCardHTML: [() => locationCardHTML, v => (locationCardHTML = v)],
  nodeActions: [() => nodeActions, v => ((nodeActions = v), provide({ nodeActions }))],
  renderWalk: [() => renderWalk, v => (renderWalk = v)],
  roomHero: [() => roomHero, v => (roomHero = v)],
  tripButtons: [() => tripButtons, v => ((tripButtons = v), provide({ tripButtons }))],
  tripDest: [() => tripDest],
  tripStatus: [() => tripStatus, v => ((tripStatus = v), provide({ tripStatus }))],
  walkHero: [() => walkHero, v => (walkHero = v)],
  walkTabAction: [() => walkTabAction, v => (walkTabAction = v)],
});
/* eslint-enable no-func-assign */
provide({ nodeActions, tripButtons, tripStatus });
/* to-module: end */
function encounterCardHTML(q) {
  const nu = !uiState.seenEnc.has(q.id);
  uiState.seenEnc.add(q.id);
  return `<button class="enc px k-card hidden-enc${nu ? ' pop' : ''}" data-a="enc" data-id="${q.id}" aria-label="Unknown Billie, level ${q.lvl}"><span class="no tnum">No. ${q.no}</span><span class="denom tnum">Lv ${q.lvl}</span><span class="stage-glow"></span><span class="enc-hide"><img class="pxi" src="${artURL('scene/props/tallgrass.png')}" alt=""><i>?</i></span><b>Unknown</b></button>`;
}
const tripDest = () => (saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null);
provide({ tripDest }); /* to-module */
/* one line about travel: where you're headed (the gold arrows guide you), or where you are */
function tripStatus() {
  const d = tripDest();
  if (d == null) return { k: 'stay', t: `In ${LOCATIONS[saveData.trip.node].name}` };
  return { k: 'guide', t: `Heading for ${LOCATIONS[d].name}: follow the gold arrows` };
}
function tripButtons() {
  if (tripStatus().k === 'guide')
    return `<button class="pb small" data-a="stoptrip">Stop guiding me</button><button class="pb small quiet" data-a="tab" data-t="map">Change plans</button>`;
  return `<button class="pb small gold" data-a="tab" data-t="map">${uiIconHTML('map', 16)} Choose where to go</button>`;
}
/** RL-8: a clinic heals the team: free in the hub (as before); on a run for rules.json run.healCost per hurt Billie (RL-12: with the Loopholes' price rows),
    after a yes, a purchase saved at once (logic/run-loop.js runHealCost). `say`: the clinic prop's own line */
export function clinicHeal(say) {
  if (!saveData.run) {
    healAll();
    save();
    render();
    toast(say || 'The clinic patched everyone up. No charge.');
    return;
  }
  const { hurt, cost } = runHealCost(saveData.team, runClinicEach()),
    each = formatNumber(runClinicEach());
  if (!hurt) {
    toast('Everyone is in good shape. Nothing to pay.');
    return;
  }
  if (saveData.se < cost) {
    toast(
      `Healing ${plural(hurt, 'Billie')} costs $${formatNumber(cost)} ($${each} each). You have $${formatNumber(saveData.se)}.`
    );
    return;
  }
  modal({
    title: 'The clinic',
    html: `<p>Out here healing isn’t free: $${each} a Billie. Heal ${plural(hurt, 'hurt Billie')} for $${formatNumber(cost)}? You have $${formatNumber(saveData.se)}.</p>`,
    btns: [
      {
        l: `Heal for $${formatNumber(cost)}`,
        c: 'gold',
        f: () => {
          closeModal();
          const now = runHealCost(saveData.team, runClinicEach());
          if (!now.hurt || saveData.se < now.cost) return;
          saveData.se -= now.cost;
          healAll();
          saveNow();
          render();
          toast(say || `The clinic patched everyone up for $${formatNumber(now.cost)}.`);
        },
      },
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}
function nodeActions(i) {
  const n = LOCATIONS[i],
    node = saveData.trip.node;
  let x = '';
  if (i !== node) return '';
  if (n.shop && SHOPS[n.shop])
    x += `<button class="pb small gold" data-a="shop" data-s="${n.shop}">${uiIconHTML('mint', 16)} ${escapeHtml(SHOPS[n.shop].name)}</button>`;
  if (n.boutique && SHOPS[n.boutique])
    x += `<button class="pb small" data-a="shop" data-s="${n.boutique}">${uiIconHTML('profile', 16)} ${escapeHtml(SHOPS[n.boutique].name)}</button>`;
  /* RL-8: on a run the clinic charges for each hurt Billie and there is no rest stop on the road */
  if (saveData.run) {
    if (n.town) {
      const { hurt, cost } = runHealCost(saveData.team, runClinicEach());
      x += hurt
        ? `<button class="pb small" data-a="clinic">Clinic: heal ${plural(hurt, 'Billie')} for $${formatNumber(cost)}</button>`
        : '<button class="pb small quiet" data-a="clinic">Clinic: everyone is fine</button>';
    }
  } else
    x += n.town
      ? '<button class="pb small" data-a="clinic">Rest at the clinic, free</button>'
      : `<button class="pb small quiet" data-a="rest">Rest stop, $${formatNumber(RULES.battle.restCost)}</button>`;
  trainersAt(i).forEach(T => {
    const done = saveData.flags[T.id];
    if (T.blocks && done && !T.seat) return;
    x += `<button class="pb small ${done ? 'quiet' : 'red'}" data-a="trainer" data-t="${T.id}">${done ? 'Rematch' : T.seat ? 'Challenge' : 'Battle'} ${escapeHtml(T.name)}</button>`;
  });
  return `<div class="racts">${x}</div>`;
}
function boardNote(i) {
  if (saveData.trip.node !== i) return '';
  return trainersAt(i)
    .filter(T => T.hint && !saveData.flags[T.id])
    .map(T => `<p class="note">${escapeHtml(T.hint)}</p>`)
    .join('');
}
function hereCard() {
  const node = saveData.trip.node,
    here = LOCATIONS[node],
    prog = `<p class="note">Open the map to pick a place to walk to; gold arrows show you the way.</p>`;
  return `<section class="here px glass k-card"><div class="route-art"${here.banner ? ` style="background-image:url('${artURL(here.banner)}')"` : ''}><span>${personHTML('me', 64)}</span><button class="route-profile" data-a="customize">${escapeHtml(cleanTrainer(saveData.avatar, saveData.gender).name)} · Edit look</button></div><div class="sec-h"><div><div class="sub">${escapeHtml(locationSubtitle(here))}</div><h2>${here.name}</h2></div><button class="pb small quiet" data-a="tab" data-t="map">Open map</button></div><p class="note">${here.blurb}</p>${boardNote(node)}${prog}<div class="racts">${tripButtons()}</div>${nodeActions(node)}</section>`;
}
function eggSlots() {
  const slots = Array.from({ length: eggSlotCount() }, (_, i) => i)
    .map(sl => {
      const e = saveData.eggs.find(x => x.slot === sl);
      if (!e)
        return `<div class="slot px k-card empty"><span class="egg-e"></span><b>Empty incubator</b><span class="note">Win battles to find eggs.</span></div>`;
      const T = EGGS[e.tier];
      return `<div class="slot px k-card">${eggHTML(e.tier, 48, 'wob')}<b>${eggKm(e.tier)} km egg</b>${progressBarHTML(e.prog / T.need, 'live')}<span class="note tnum">${metresToKm(e.prog)} of ${metresToKm(T.need)} km</span></div>`;
    })
    .join('');
  const pipe = saveData.eggs.filter(e => e.slot == null);
  return `<section><div class="sec-h"><h2>Eggs</h2><span class="count tnum">${saveData.eggs.length}/${RULES.eggs.capacity}</span></div><div class="slots">${slots}</div>${pipe.length ? `<div class="pipe"><span class="note">Waiting for an incubator:</span>${pipe.map(e => eggHTML(e.tier, 26)).join('')}</div>` : ''}</section>`;
}
function buddyCard() {
  const m = findBilly(saveData.buddy);
  if (!m) return '';
  const a = xpFor(m.lvl),
    b = xpFor(m.lvl + 1);
  return `<section><div class="sec-h"><h2>Buddy</h2></div><div class="buddy px k-card" data-a="mon" data-u="${m.uid}" role="button" tabindex="0">${rigCanvasHTML(m.sp, 80, { build: m.build, coat: m.coat })}<div class="bd"><div class="bn">${escapeHtml(billyName(m))} <span class="lv tnum">Lv ${m.lvl}</span></div><div class="note">Gets the full XP of every battle you win, even when it sits one out. ${formatNumber(b - m.xp)} XP to level ${m.lvl + 1}.</div>${progressBarHTML((m.xp - a) / (b - a), 'xpb')}</div></div></section>`;
}
function roomHero() {
  const I = uiState.inside,
    sc = mapById(I.id) || {},
    here = LOCATIONS[saveData.trip.node],
    what =
      {
        shop: 'Tap the counter to shop.',
        clinic: 'Tap the desk and your team is patched up, free.',
        lab: 'Tap the professor to talk, or the unlock board to spend Capital.',
        house: 'Tap whoever lives here to chat.',
        home: 'Your room in Granny Juniper’s cottage. Decorate it with what you’ve found.',
        ranch: 'Tap the training board or the rancher to train your Billies.',
      }[I.kind] || '';
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(here.name), escapeHtml(I.name || sc.name || 'Inside'), `<p class="wh-gate">${escapeHtml(what)}</p>`, (I.kind === 'home' ? `<button class="pb small gold" data-a="decorate">Decorate</button>` : '') + `<button class="pb small" data-a="leaveroom">${uiIconHTML('door', 14)} Go outside</button>`)}
 <div class="wh-foot"><div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button><button class="wh-down glass k-btn" data-a="walkdown" aria-label="Show actions">${uiIconHTML('chev', 18)}<span>Actions</span></button></div></div></div>`;
}
/* v31: the place card: compact (where, the hour and weather, staying or walking, one main button; the rest folded
   under More), closable with ×, and brought back by tapping the place's name in the top bar. Closed stays closed. */
function locationCardHTML(sub, name, mid, btns) {
  if (saveData.preferences && saveData.preferences.cardClosed) return '';
  const all = String(btns).match(/<button[\s\S]*?<\/button>/g) || [],
    main = all[0] || '',
    more = all.slice(1).join('');
  return `<div class="wh-card glass compact k-panel"><div class="wh-top"><div class="sub">${sub}</div><button class="wh-x" data-a="card-close" aria-label="Hide this card"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div><h1 class="where">${name}</h1>${mid}<div class="wh-acts">${main}${more ? `<details class="wh-more"><summary>More</summary><div class="wh-more-b">${more}</div></details>` : ''}</div></div>`;
}
function environmentLine() {
  if (typeof environmentLabel !== 'function' || !environment.on) return '';
  const t = environmentLabel();
  if (!t) return '';
  const h = environmentHint();
  return `<p class="wh-env">${uiIconHTML(environmentIcon(), 12)} ${escapeHtml(t)}${h ? `<span> · ${escapeHtml(h)}</span>` : ''}</p>`;
}
function walkHero() {
  if (uiState.inside && !uiState.bench && roomState()) return roomHero();
  if (uiState.bench && uiState.bench.test && mapById(uiState.bench.id)) {
    /* v20: a test scene from the debug menu */ const sc = mapById(uiState.bench.id);
    return `<div class="walk-hero" id="walkHero"><div class="wh-card glass k-panel">${uiState.bench.id === 'gallery' ? `<div class="sub">Settings</div><h1 class="where">Graphics gallery</h1><p class="wh-gate">Walk to a signpost, then move the dial below and watch what changes.</p>` : `<div class="sub">Test scene</div><h1 class="where">${escapeHtml((sc.name || uiState.bench.id).replace(/^Test: /, ''))}</h1><p class="wh-gate">${(sc.checks || []).length} walking checks. Debug menu → Test scenes runs them.</p>`}<div class="wh-acts"><button class="pb small gold" ${uiState.bench.id === 'gallery' ? 'data-a="gal-leave"' : 'data-a="dbg" data-x="untest"'}>${uiState.bench.id === 'gallery' ? 'Back to Settings' : 'Back to the game'}</button></div></div></div>`;
  }
  const node = saveData.trip.node,
    here = LOCATIONS[node],
    q = encountersHere(),
    next = `<p class="wh-gate">${escapeHtml(tripStatus().t)}</p>`;
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(locationSubtitle(here)), escapeHtml(here.name), environmentLine() + next, tripButtons())}
 <div class="wh-foot">${q.length ? `<p class="wh-hint glass">${uiIconHTML('spark', 12)} ${plural(q.length, 'Billie')} hiding nearby. Tap a <b>?</b> to battle.</p>` : `<p class="wh-hint glass">${uiIconHTML('walk', 12)} Tap the ground to walk around. Tap buildings, people and signs.</p>`}
  <div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button><button class="pb small glass" data-a="photo" aria-label="Photo mode">${uiIconHTML('camera', 14)}</button><button class="wh-down glass k-btn" data-a="walkdown" aria-label="Show actions">${uiIconHTML('chev', 18)}<span>Actions</span></button></div></div></div>`;
}
export function renderWalk() {
  const q = encountersHere(),
    cap = encounterStock(saveData.trip.node);
  return `${walkHero()}<div class="walk-sheet k-panel"><span class="ws-grip" aria-hidden="true"></span>
 <div class="cols"><div class="col">
 <div class="today px glass k-card"><div class="today-top"><div class="se"><div class="mid tnum">$<span data-count="se" data-to="${saveData.se}">${formatNumber(saveData.se)}</span></div><div class="lbl">Money</div></div></div>
  <p class="note">Beat wild Billies and trainers to earn more.</p></div>
 <section class="walkbtns"><p class="note">Walk with the joystick (drag anywhere on the scene) or tap where you want to go. The arrows at the edges lead on to the next place.</p></section>
 ${typeof challengeCardHTML === 'function' ? challengeCardHTML() : ''}${typeof requestListHTML === 'function' && requestListHTML() ? `<section class="chal px glass k-card"><div class="sec-h"><h2>Requests you’re helping with</h2></div>${requestListHTML()}</section>` : ''}${hereCard()}</div><div class="col">
 <section class="pending"><div class="sec-h"><h2>Encounters here</h2><span class="count tnum">${q.length}/${cap}</span></div>
  <p class="note">${!cap ? 'No wild Billies live here. Try a route or a town with tall grass.' : q.length >= cap ? 'This place is full. Battle or tax a few to make room.' : 'Another one wanders over about every minute.'} You only see their level until the battle starts.</p>
  ${q.length ? `<div class="queue">${q.map(encounterCardHTML).join('')}</div>` : `<div class="empty px">No Billies nearby.${cap ? ' Give it a minute and one will wander over.' : ''}</div>`}</section>
 ${eggSlots()}${buddyCard()}</div></div></div>`;
}
/* the Walk tab's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function walkTabAction(a, d) {
  switch (a) {
    case 'card-close':
      saveData.preferences = saveData.preferences || {};
      saveData.preferences.cardClosed = true;
      save();
      render();
      requestAnimationFrame(() => {
        const t = $('.tb-where');
        if (t) t.focus({ preventScroll: true });
      });
      break;
    case 'card-open':
      saveData.preferences = saveData.preferences || {};
      saveData.preferences.cardClosed = !saveData.preferences.cardClosed;
      save();
      render();
      break;
    case 'enc': {
      const q = encountersHere().find(x => x.id === d.id);
      if (q) startWild(q);
      break;
    }
    case 'clinic':
      clinicHeal();
      break;
    case 'rest': {
      const c = RULES.battle.restCost;
      if (saveData.se < c) {
        toast(`A rest stop costs $${formatNumber(c)}. Win a battle first.`);
        break;
      }
      saveData.se -= c;
      healAll();
      save();
      render();
      toast(`Everyone rested up for $${formatNumber(c)}.`);
      break;
    }
    case 'trainer':
      trainerTalk(d.t);
      break;
    case 'rungiveup':
      runGiveUp();
      break;
  }
}
