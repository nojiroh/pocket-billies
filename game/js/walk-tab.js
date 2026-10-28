'use strict';
/* ================= WALK TAB ================= */
/* UI-5: the Walk tab (the place card over the scene and its sheet: encounters, the clinic, eggs, your buddy), moved from ui.js as it was; its buttons in walkTabAction, called from ui.js's click switch at the same place */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { provide, render, roomState, walkPick } from './hooks.js';
import { $, $$ } from './util.js';
import { LOCATIONS, NODE_TYPES, RULES, SHOPS, locationSubtitle, trainersAt } from './game-data.js';
import { encountersHere, formatNumber, healAll, plural } from './logic/rules.js';
import { faceToward } from './logic/person-view.js';
import { modHas } from './logic/modifiers.js';
import { runClinic, runHealCost, runSheetStatus, weatherEffectText } from './logic/run-loop.js';
import { startWild } from './logic/battle-engine.js';
import { activeBattle, escapeHtml, save, saveData, saveNow, uiState } from './game-state.js';
import { moneyHTML, uiIconHTML } from './art.js';
import { approachPoint, mapById, walkTo, walkView } from './walk-view.js';
import { WEATHER_NAMES, environment, environmentHint, environmentIcon, environmentLabel } from './environment.js';
import { runClinicEach, runGiveUp, runStartSheet } from './run.js';
import { residentCardHTML } from './lab-board.js';
import { trainerTalk } from './story.js';
import { closeModal, modal, toast } from './overlay.js';
/* eslint-disable no-func-assign */
expose({
  HUB_MARKS: [() => HUB_MARKS],
  PLACE_TITLE_MS: [() => PLACE_TITLE_MS],
  WALK_HINT_MS: [() => WALK_HINT_MS],
  WEATHER_ICONS: [() => WEATHER_ICONS],
  clinicHeal: [() => clinicHeal, v => (clinicHeal = v)],
  dataAttrs: [() => dataAttrs],
  encountersNearest: [() => encountersNearest, v => (encountersNearest = v)],
  environmentLine: [() => environmentLine, v => (environmentLine = v)],
  locationCardHTML: [() => locationCardHTML, v => (locationCardHTML = v)],
  nodeActionItems: [() => nodeActionItems, v => (nodeActionItems = v)],
  nodeActions: [() => nodeActions, v => ((nodeActions = v), provide({ nodeActions }))],
  nowMs: [() => nowMs],
  placeCardState: [() => placeCardState, v => (placeCardState = v)],
  placeKey: [() => placeKey],
  placeTitleEnd: [() => placeTitleEnd, v => (placeTitleEnd = v)],
  placeTitleFold: [() => placeTitleFold, v => (placeTitleFold = v)],
  renderWalk: [() => renderWalk, v => (renderWalk = v)],
  roomHero: [() => roomHero, v => (roomHero = v)],
  tripButtons: [() => tripButtons, v => ((tripButtons = v), provide({ tripButtons }))],
  tripDest: [() => tripDest],
  tripStatus: [() => tripStatus, v => ((tripStatus = v), provide({ tripStatus }))],
  walkAfterRender: [() => walkAfterRender, v => (walkAfterRender = v)],
  walkDayToast: [() => walkDayToast, v => (walkDayToast = v)],
  walkHero: [() => walkHero, v => (walkHero = v)],
  walkHintHTML: [() => walkHintHTML, v => (walkHintHTML = v)],
  walkMarkTo: [() => walkMarkTo, v => (walkMarkTo = v)],
  walkNewKey: [() => walkNewKey],
  walkRunStatus: [() => walkRunStatus, v => (walkRunStatus = v)],
  walkSheetClose: [() => walkSheetClose, v => (walkSheetClose = v)],
  walkSheetHTML: [() => walkSheetHTML, v => (walkSheetHTML = v)],
  walkSheetOpen: [() => walkSheetOpen, v => (walkSheetOpen = v)],
  walkSheetSync: [() => walkSheetSync, v => (walkSheetSync = v)],
  walkSheetToggle: [() => walkSheetToggle, v => (walkSheetToggle = v)],
  walkSheetWanted: [() => walkSheetWanted],
  walkTabAction: [() => walkTabAction, v => (walkTabAction = v)],
  walkTipOnce: [() => walkTipOnce, v => (walkTipOnce = v)],
  walkToEncounter: [() => walkToEncounter, v => (walkToEncounter = v)],
  walkTrayItems: [() => walkTrayItems, v => (walkTrayItems = v)],
});
/* eslint-enable no-func-assign */
provide({ nodeActions, tripButtons, tripStatus });
/* to-module: end */
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
/** RL-8: a clinic heals the team: free in the hub (as before); on a run for rules.json run.healCost per hurt Billie (RL-12: with the Perks' price rows),
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
  /* RL-13: the "No healing" challenge (logic/modifiers.js): the clinic is shut for the whole run */
  if (modHas(saveData.run, 'noheal')) {
    toast('The clinic is shut. No healing on this run.');
    return;
  }
  if (!hurt) {
    toast('Everyone is in good shape. Nothing to pay.');
    return;
  }
  if (saveData.se < cost) {
    toast(
      `Healing ${plural(hurt, 'Billie')} costs ${plural(cost, 'Money')} (${plural(each, 'Money')} each). You have ${plural(saveData.se, 'Money')}.`
    );
    return;
  }
  modal({
    title: 'The clinic',
    html: `<p>Out here healing isn’t free: ${moneyHTML(each)} a Billie. Heal ${plural(hurt, 'hurt Billie')} for ${moneyHTML(cost)}? You have ${moneyHTML(saveData.se)}.</p>`,
    btns: [
      {
        l: `Heal for ${plural(cost, 'Money')}`,
        c: 'gold',
        f: () => {
          closeModal();
          /* logic/run-loop.js runClinic: nothing when no one is hurt now, or the money isn't there */
          const now = runClinic(saveData, runClinicEach());
          if (!now.paid) return;
          saveNow();
          render();
          toast(say || `The clinic patched everyone up for ${plural(now.cost, 'Money')}.`);
        },
      },
      { l: 'Not now', c: 'quiet', f: closeModal },
    ],
  });
}
/** what a place offers, one item a button (the map's card: nodeActions; the Actions bar: walkTrayItems): a shop, the
    clinic, its trainers or a run's mini-boss. `long` is the map card's words, `label` the bar's short ones */
function nodeActionItems(i) {
  const n = LOCATIONS[i],
    node = saveData.trip.node,
    it = [];
  if (i !== node) return it;
  if (n.shop && SHOPS[n.shop])
    it.push({
      a: 'shop',
      d: { s: n.shop },
      icon: 'shop',
      tone: 'gold',
      label: 'Shop',
      long: `${uiIconHTML('mint', 16)} ${escapeHtml(SHOPS[n.shop].name)}`,
    });
  if (n.boutique && SHOPS[n.boutique])
    it.push({
      a: 'shop',
      d: { s: n.boutique },
      icon: 'profile',
      tone: '',
      label: 'Clothes',
      long: `${uiIconHTML('profile', 16)} ${escapeHtml(SHOPS[n.boutique].name)}`,
    });
  /* RL-8: on a run the clinic charges for each hurt Billie and there is no rest stop on the road */
  if (saveData.run) {
    if (n.town) {
      const { hurt, cost } = runHealCost(saveData.team, runClinicEach());
      it.push(
        hurt
          ? {
              a: 'clinic',
              d: {},
              icon: 'heart',
              tone: '',
              label: `Heal ×${hurt}`,
              long: `Clinic: heal ${plural(hurt, 'Billie')} for ${moneyHTML(cost)}`,
            }
          : { a: 'clinic', d: {}, icon: 'heart', tone: 'quiet', label: 'Clinic', long: 'Clinic: everyone is fine' }
      );
    }
  } else if (n.town)
    it.push({ a: 'clinic', d: {}, icon: 'heart', tone: '', label: 'Clinic', long: 'Rest at the clinic, free' });
  trainersAt(i).forEach(T => {
    const done = saveData.flags[T.id];
    if (T.blocks && done && !T.seat) return;
    const verb = done ? 'Rematch' : T.seat ? 'Challenge' : 'Battle';
    it.push({
      a: 'trainer',
      d: { t: T.id },
      icon: 'fight',
      tone: done ? 'quiet' : 'red',
      label: escapeHtml(T.name),
      aria: `${verb} ${T.name}`,
      long: `${verb} ${escapeHtml(T.name)}`,
    });
  });
  return it;
}
const dataAttrs = d =>
  Object.entries(d || {})
    .map(([k, v]) => ` data-${k}="${escapeHtml(String(v))}"`)
    .join('');
function nodeActions(i) {
  const x = nodeActionItems(i)
    .map(
      o => `<button class="pb small${o.tone ? ' ' + o.tone : ''}" data-a="${o.a}"${dataAttrs(o.d)}>${o.long}</button>`
    )
    .join('');
  return `<div class="racts">${x}</div>`;
}
function roomHero() {
  const I = uiState.inside,
    sc = mapById(I.id) || {},
    here = LOCATIONS[saveData.trip.node],
    what =
      {
        shop: 'Tap the counter to shop.',
        clinic: 'Tap the desk and your team is patched up, free.',
        lab: 'Tap Professor Chosen or Kappi to talk, or the unlock board to spend Research.',
        house: 'Tap whoever lives here to chat.',
        ranch: 'Tap the training board or the rancher to train your Billies.',
      }[I.kind] || '',
    /* RS-3: a resident's home: who they are, Talk, and their upgrades */
    res = I.res && typeof residentCardHTML === 'function' ? residentCardHTML(I.res) : '',
    /* towns track TW-0: with the card closed its "Go outside" goes too, so the way out stays on screen (UI-15: folded) */
    shut = !placeCardState().show;
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(here.name), escapeHtml(I.name || sc.name || 'Inside'), res || `<p class="wh-gate">${escapeHtml(what)}</p>`, `<button class="pb small" data-a="leaveroom">${uiIconHTML('door', 14)} Go outside</button>${res ? `<button class="pb small" data-a="restalk" data-r="${escapeHtml(I.res)}">Talk</button>` : ''}`)}
 <div class="wh-foot"><div class="wh-row">${shut ? `<button class="pb small glass" data-a="leaveroom">${uiIconHTML('door', 14)} Go outside</button>` : ''}<button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button></div></div></div>`;
}
/* UI-15: walking shows less. The place card plays as a title when you arrive, then folds into the top bar (its name
   and today's weather glyph); the hint shows when it says something new, then fades; the Actions button bobs only
   while its sheet has something you haven't opened it for. tokens.css --m-title and --m-linger hold the same times */
const PLACE_TITLE_MS = 4500,
  WALK_HINT_MS = 6000;
const nowMs = () => performance.now();
/** the place card's key: the room you are in, or the place */
const placeKey = () =>
  uiState.inside && !uiState.bench && roomState() ? 'in:' + uiState.inside.id : 'at:' + saveData.trip.node;
/** is the place card on screen, and is it the arrival title (how far in, ms; -1 when it isn't). The top bar's name
 * unfolds it and it stays (preferences.cardClosed false) until × or the name again folds it (true) */
export function placeCardState() {
  const key = placeKey(),
    now = nowMs();
  let T = uiState.placeTitle;
  if (!T || T.key !== key) {
    if (T) clearTimeout(T.t);
    T = uiState.placeTitle = { key, at: now };
  }
  const age = now - T.at;
  /* folds itself: the page is drawn again once the title is over */
  if (age < PLACE_TITLE_MS && !T.t) T.t = setTimeout(placeTitleFold, PLACE_TITLE_MS - age + 40);
  if (saveData.preferences && saveData.preferences.cardClosed === false) return { show: true, title: -1 };
  return age < PLACE_TITLE_MS ? { show: true, title: age } : { show: false, title: -1 };
}
function placeTitleFold() {
  if (uiState.placeTitle) uiState.placeTitle.t = 0;
  if (uiState.tab === 'walk' && saveData.started && !activeBattle && !uiState.title) render();
}
/** the arrival title ends now (× or the top bar's name folded the card) */
function placeTitleEnd() {
  const T = uiState.placeTitle;
  if (!T) return;
  clearTimeout(T.t);
  T.t = 0;
  T.at = -Infinity;
}
/** after each render: the title and the hint carry on from where they were (the page is made again often) */
export function walkAfterRender() {
  const go = (el, at) => {
    if (el && at != null && isFinite(at)) for (const a of el.getAnimations()) a.currentTime = nowMs() - at;
  };
  go($('.wh-card.m-title'), uiState.placeTitle && uiState.placeTitle.at);
  go($('.wh-hint.m-linger'), uiState.walkHint && uiState.walkHint.at);
}
/** the hint under the world: the Billies hiding here when there are more than before, or how to walk when you arrive */
function walkHintHTML(n) {
  const key = saveData.trip.node + (n ? ':hiding' : ':walk');
  let H = uiState.walkHint;
  if (!H || H.key !== key || n > (H.n || 0)) H = uiState.walkHint = { key, at: nowMs(), n };
  H.n = n;
  if (nowMs() - H.at >= WALK_HINT_MS) return '';
  return n
    ? `<p class="wh-hint glass m-linger">${uiIconHTML('spark', 12)} ${plural(n, 'Billie')} hiding nearby. Tap a <b>?</b> to battle.</p>`
    : `<p class="wh-hint glass m-linger">${uiIconHTML('walk', 12)} Tap the ground to walk around. Tap buildings, people and signs.</p>`;
}
/** what the Actions sheet would show that matters: where you are and the Billies hiding there */
const walkNewKey = () =>
  saveData.trip.node +
  ':' +
  encountersHere()
    .map(q => q.id)
    .sort()
    .join(',');
/* v31: the place card: compact (where, the hour and weather, staying or walking, one main button; the rest folded
   under More), closable with ×, and brought back by tapping the place's name in the top bar. UI-15: it plays as a
   title on arrival, then folds (placeCardState) */
function locationCardHTML(sub, name, mid, btns) {
  const C = placeCardState();
  if (!C.show) return '';
  const all = String(btns).match(/<button[\s\S]*?<\/button>/g) || [],
    main = all[0] || '',
    more = all.slice(1).join('');
  return `<div class="wh-card glass compact k-panel${C.title >= 0 ? ' m-title' : ''}"><div class="wh-top"><div class="sub">${sub}</div><button class="wh-x" data-a="card-close" aria-label="Hide this card"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div><h1 class="where">${name}</h1>${mid}${main ? `<div class="wh-acts">${main}${more ? `<details class="wh-more"><summary>More</summary><div class="wh-more-b">${more}</div></details>` : ''}</div>` : ''}</div>`;
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
    q = encountersHere();
  return `<div class="walk-hero" id="walkHero">${locationCardHTML(escapeHtml(locationSubtitle(here)), escapeHtml(here.name), environmentLine(), '')}
 <div class="wh-foot">${walkHintHTML(q.length)}
  <div class="wh-row"><button class="pb small glass fish-btn" data-a="fish" hidden>${uiIconHTML('fish', 14)} Fish</button><button class="wh-down glass k-btn${uiState.walkSheet ? ' open' : walkNewKey() !== uiState.walkSeen ? ' new' : ''}" data-a="walkdown" aria-expanded="${!!uiState.walkSheet}" aria-label="${uiState.walkSheet ? 'Hide actions' : 'Show actions'}">${uiIconHTML('chev', 18)}<span>Actions</span></button></div></div></div>`;
}
export function renderWalk() {
  return walkHero();
}
/* the Actions bar (the owner, 2026-10-28: "a bar on top of the navbar with some quick little icons with text"): one row
   of small buttons right over the bottom bar, opened by the Actions button. It used to be a sheet over half the
   screen. Its element stays on the page (so it slides in and out once); its buttons are made again on every render
   while it is open; leaving the world (another tab, a battle) closes it */
/* the hub's buildings the bar can point you to (a marker in the world: walkMarkTo), by their act */
const HUB_MARKS = [
  ['ranch', 'Ranch', 'leaf'],
  ['lab', 'Lab', 'spark'],
  ['genebank', 'Gene Bank', 'drop'],
  ['workshop', 'Workshop', 'gear'],
];
/** mark a hub building in the world (walk-view.js drawWalkMark); the bar closes so you can walk there */
function walkMarkTo(act) {
  const H = HUB_MARKS.find(([a]) => a === act),
    p = H && walkView.sc && (walkView.sc.props || []).find(q => q.act === act);
  if (!p) return;
  walkView.mark = { act, label: H[1] };
}
/* the forecast's word to a UI icon (environment.js environmentIcon's, by day) */
const WEATHER_ICONS = { rain: 'rain', storm: 'rain', snow: 'snow', fog: 'fog', ash: 'ash', cloudy: 'cloud' };
/** on a run: the day, the place's type, its weather today and tomorrow (logic/run-loop.js runSheetStatus), or null */
function walkRunStatus() {
  const run = saveData.run,
    L = LOCATIONS[saveData.trip.node];
  return run && run.map && L && L.runNode != null ? runSheetStatus(run, L.runNode, RULES.env) : null;
}
/** the run's day chip, tapped: the place's type and what today's and tomorrow's weather do to moves */
function walkDayToast() {
  const st = walkRunStatus();
  if (!st) return;
  const T = NODE_TYPES[st.type],
    days = st.days.map(d => {
      const fx = weatherEffectText(d.wx);
      return `${d.day === st.day ? 'Today' : 'Tomorrow'}: ${WEATHER_NAMES[d.w] || d.w}, ${fx || 'no effect on moves'}.`;
    });
  toast(`Day ${st.day} · ${T ? T.name : st.type}. ${days.join(' ')}`);
}
/** the wild Billies hiding here, nearest first (where each waits in the world: walkView.enc; unplaced ones last) */
function encountersNearest() {
  const P = walkView.pl,
    far = q => {
      const e = walkView.enc && walkView.enc[q.id];
      return e && P ? Math.hypot(e.x - P.x, e.z - P.z) : Infinity;
    };
  return encountersHere()
    .map((q, i) => ({ q, i, d: far(q) }))
    .sort((A, B) => A.d - B.d || A.i - B.i)
    .map(o => o.q);
}
/** a wild Billie's chip, tapped: walk up to it and the battle starts when you get there, as a tap on its "?" in the
    world does (walk-view.js handleWalkClick); where it isn't placed (or you can't walk here), at once */
function walkToEncounter(id) {
  const q = encountersHere().find(x => x.id === id);
  if (!q) return;
  const e = walkView.enc && walkView.enc[id],
    P = walkView.pl;
  if (!e || !P || !(walkView.st && walkView.st.roam)) {
    startWild(q);
    return;
  }
  walkTo(approachPoint(e.x, e.z), () => {
    const at = walkView.enc[id] || e;
    faceToward(P, at.x - P.x, at.z - P.z);
    walkPick({ k: 'enc', e: { id }, look: [at.x, at.z] });
  });
}
/** the bar's buttons, in order: the run's day and the map, or the hub's run and buildings; what this place offers;
    the wild Billies, nearest first. Each {a, d, icon, label, tone, aria, keep (the bar stays open), off} */
function walkTrayItems() {
  const it = [],
    st = walkRunStatus();
  if (st) {
    const today = st.days.find(d => d.day === st.day) || st.days[0];
    it.push({
      a: 'wtday',
      d: {},
      icon: WEATHER_ICONS[today ? today.w : ''] || 'sun',
      wx: true,
      label: `Day ${st.day}`,
      aria: `Day ${st.day}: the weather`,
      keep: true,
    });
  }
  if (saveData.run)
    it.push({ a: 'tab', d: { t: 'map' }, icon: 'map', tone: 'gold', label: 'Map', aria: 'Open the map to move on' });
  else {
    const can = saveData.team.length + saveData.box.length > 0,
      props = (walkView.sc && walkView.sc.props) || [];
    it.push({ a: 'walkrun', d: {}, icon: 'flag', tone: 'gold', label: 'Start a run', off: !can });
    HUB_MARKS.filter(([act]) => props.some(p => p.act === act)).forEach(([act, name, icon]) =>
      it.push({ a: 'walkmark', d: { k: act }, icon, label: name, aria: `${name}: show me the way` })
    );
  }
  it.push(...nodeActionItems(saveData.trip.node));
  encountersNearest().forEach(q => {
    const nu = !uiState.seenEnc.has(q.id);
    uiState.seenEnc.add(q.id);
    it.push({
      a: 'encgo',
      d: { id: q.id },
      q: true,
      nu,
      label: `Lv ${q.lvl}`,
      aria: `Wild Billie, level ${q.lvl}: walk to it`,
    });
  });
  return it;
}
function walkSheetHTML() {
  return walkTrayItems()
    .map(o => {
      const ic = o.q
        ? '<i class="wt-q" aria-hidden="true">?</i>'
        : o.wx
          ? `<span class="wx-now">${uiIconHTML(o.icon, 20)}</span>`
          : uiIconHTML(o.icon, 20);
      return `<button class="wt-act${o.tone ? ' ' + o.tone : ''}${o.nu ? ' new' : ''}" data-a="${o.a}"${dataAttrs(o.d)}${o.keep ? ' data-keep="1"' : ''}${o.off ? ' aria-disabled="true"' : ''}${o.aria ? ` aria-label="${escapeHtml(o.aria)}"` : ''}>${ic}<span>${o.label}</span></button>`;
    })
    .join('');
}
const walkSheetWanted = () =>
  uiState.walkSheet && uiState.tab === 'walk' && !!saveData.started && !activeBattle && !uiState.title;
export function walkSheetSync() {
  let el = /** @type {HTMLElement | null} */ ($('#walkSheet'));
  if (!el && !walkSheetWanted()) return;
  if (!el) {
    el = document.createElement('div');
    el.id = 'walkSheet';
    el.className = 'walk-tray';
    el.setAttribute('role', 'toolbar');
    el.setAttribute('aria-label', 'Actions');
    document.body.appendChild(el);
  }
  const on = walkSheetWanted(),
    btn = $('.wh-down');
  document.documentElement.classList.toggle('tray-open', on);
  if (btn) {
    btn.classList.toggle('open', on);
    if (on) btn.classList.remove('new');
    btn.setAttribute('aria-expanded', String(on));
    btn.setAttribute('aria-label', on ? 'Hide actions' : 'Show actions');
  }
  if (!on) {
    uiState.walkSheet = false;
    el.classList.remove('open');
    el.inert = true;
    return;
  }
  /* made again on every render: the keyboard's place is kept (the same button, by its place in the bar) */
  const keys = () => $$('button', el),
    had = keys().indexOf(/** @type {any} */ (document.activeElement)),
    sx = el.scrollLeft;
  el.innerHTML = walkSheetHTML();
  el.scrollLeft = sx;
  el.inert = false;
  if (!el.classList.contains('open')) {
    /* in from where it rests (closed), so the slide plays */
    void el.offsetWidth;
    el.classList.add('open');
  }
  if (had >= 0) {
    const b = keys()[had];
    if (b) /** @type {HTMLElement} */ (b).focus({ preventScroll: true });
  }
}
/* how to walk, said once (it used to be a note in the sheet every time): the first time the world shows, kept in the
   save's preferences like the closed place card */
export function walkTipOnce() {
  const P = (saveData.preferences = saveData.preferences || {});
  if (P.walkTip || uiState.modal) return;
  P.walkTip = 1;
  save();
  toast('Drag anywhere on the scene to walk, or tap where you want to go. The arrows at the edges lead on.');
}
export function walkSheetOpen() {
  walkView.mark = null;
  uiState.walkSeen = walkNewKey();
  uiState.walkSheet = true;
  walkSheetSync();
}
/** the Actions button: opens the bar, or closes it when open */
export function walkSheetToggle() {
  if (uiState.walkSheet) walkSheetClose();
  else walkSheetOpen();
}
export function walkSheetClose() {
  if (!uiState.walkSheet) return;
  uiState.walkSheet = false;
  walkSheetSync();
}
/* the Walk tab's buttons (UI-5: the cases of ui.js's click switch, as they were) */
export function walkTabAction(a, d) {
  switch (a) {
    case 'card-close':
      saveData.preferences = saveData.preferences || {};
      saveData.preferences.cardClosed = true;
      placeTitleEnd();
      save();
      render();
      requestAnimationFrame(() => {
        const t = $('.tb-where');
        if (t) t.focus({ preventScroll: true });
      });
      break;
    case 'card-open': {
      saveData.preferences = saveData.preferences || {};
      /* UI-15: shown (the title, or unfolded) folds; folded unfolds and stays */
      const open = placeCardState().show;
      saveData.preferences.cardClosed = open;
      if (open) placeTitleEnd();
      save();
      render();
      break;
    }
    case 'enc': {
      const q = encountersHere().find(x => x.id === d.id);
      if (q) startWild(q);
      break;
    }
    case 'clinic':
      clinicHeal();
      break;
    case 'trainer':
      trainerTalk(d.t);
      break;
    case 'rungiveup':
      runGiveUp();
      break;
    case 'walkrun':
      if (saveData.team.length + saveData.box.length > 0) runStartSheet();
      else toast('Someone has to come along: a Billie in your team or in storage.');
      break;
    case 'wtday':
      walkDayToast();
      break;
    case 'encgo':
      walkToEncounter(d.id);
      break;
    case 'walkmark':
      walkMarkTo(d.k);
      break;
  }
}
