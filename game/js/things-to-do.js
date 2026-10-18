'use strict';
/* ================= THINGS TO DO (v28) =================
   Daily challenges, townsfolk with requests, two gold stamps hidden in every place, your own room (in Copperleaf since alpha 0.4) to
   decorate, photo mode, and battles that feel the weather. Everything lives in saveData.x, which an older save gets the
   first time it's needed. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { closeModal, modal, progressBarHTML, provide, render, roomRefresh, toast } from './hooks.js';
import { clamp } from './util.js';
import { COINS, ITEMS, LOCATIONS, RULES, SPECIES, gameData } from './game-data.js';
import { activeBattle, billyName, escapeHtml, formatNumber, save, saveData, today, uiState } from './game-state.js';
import { makeCanvas, uiIconHTML } from './art.js';
import {
  baseMapId,
  findPath,
  mapById,
  mapHub,
  terrainAt,
  turnToPlayer,
  walkView,
  walkablePointNear,
} from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import { currentLocationMap, environment, environmentState } from './environment.js';
import { standingHeightAt, walkRenderer } from './walk-view-gl.js';
import { battleSay, endBattle, openBattle, setEndBattle, setOpenBattle } from './battle.js';
import { soundEffect } from './sound.js';
import { setTalkFolk, talk, talkBox, talkFolk } from './talk.js';
/* eslint-disable no-func-assign */
expose({
  CHALLENGE_KINDS: [() => CHALLENGE_KINDS],
  FURNITURE: [() => FURNITURE],
  HOME_SLOTS: [() => HOME_SLOTS],
  PHOTO_FILTERS: [() => PHOTO_FILTERS],
  REQUEST_KINDS: [() => REQUEST_KINDS],
  STAMP_SPOTS: [() => STAMP_SPOTS],
  WEATHER_BATTLE_NOTES: [() => WEATHER_BATTLE_NOTES],
  WEATHER_TYPE_BOOSTS: [() => WEATHER_TYPE_BOOSTS],
  battleWeather: [() => battleWeather, v => (battleWeather = v)],
  battleWeatherMultiplier: [
    () => battleWeatherMultiplier,
    v => ((battleWeatherMultiplier = v), provide({ battleWeatherMultiplier })),
  ],
  challengeCardHTML: [() => challengeCardHTML, v => (challengeCardHTML = v)],
  challengeProgress: [() => challengeProgress],
  challengeText: [() => challengeText],
  challengesToday: [() => challengesToday, v => (challengesToday = v)],
  claimChallenge: [() => claimChallenge, v => (claimChallenge = v)],
  furnitureFits: [() => furnitureFits],
  homeDecorate: [() => homeDecorate, v => (homeDecorate = v)],
  photoEnd: [() => photoEnd, v => (photoEnd = v)],
  photoFilter: [() => photoFilter, v => (photoFilter = v)],
  photoShot: [() => photoShot, v => (photoShot = v)],
  photoStart: [() => photoStart, v => (photoStart = v)],
  placeHomeFurniture: [() => placeHomeFurniture, v => (placeHomeFurniture = v)],
  refreshHomeFurniture: [() => refreshHomeFurniture, v => (refreshHomeFurniture = v)],
  requestAsker: [() => requestAsker, v => ((requestAsker = v), provide({ requestAsker }))],
  requestHere: [() => requestHere, v => (requestHere = v)],
  requestListHTML: [() => requestListHTML, v => (requestListHTML = v)],
  requestTalk: [() => requestTalk, v => (requestTalk = v)],
  seededRandom: [() => seededRandom, v => (seededRandom = v)],
  stampCount: [() => stampCount],
  stampDraw: [() => stampDraw, v => ((stampDraw = v), provide({ stampDraw }))],
  stampMaps: [() => stampMaps, v => (stampMaps = v)],
  stampSpots: [() => stampSpots, v => (stampSpots = v)],
  stampTile: [() => stampTile, v => (stampTile = v)],
  stampTotal: [() => stampTotal],
  teamBillyOfType: [() => teamBillyOfType],
  thingsToDo: [() => thingsToDo, v => (thingsToDo = v)],
  thingsToDoEvent: [() => thingsToDoEvent, v => ((thingsToDoEvent = v), provide({ thingsToDoEvent }))],
  thingsToDoReward: [() => thingsToDoReward, v => (thingsToDoReward = v)],
  typeIds: [() => typeIds],
});
/* eslint-enable no-func-assign */
provide({ battleWeatherMultiplier, requestAsker, stampDraw, thingsToDoEvent });
/* to-module: end */
function thingsToDo() {
  const X = saveData.x || (saveData.x = {});
  X.stamps = X.stamps || {};
  X.reqs = X.reqs || {};
  X.home = X.home || { slots: {}, own: ['rug_round', 'plant_tall', 'chair_wood', 'table_round'] };
  return X;
}
/* a seeded random sequence, so today's challenges and requests are the same however often you look */
function seededRandom(seed) {
  let h = 2166136261;
  for (const c of String(seed)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const typeIds = () => (gameData.types || []).map(t => t.id);
/* money, and an item or some coins */
function thingsToDoReward(k = 1) {
  const R = [],
    m = Math.round(((150 + Math.random() * 350) * k) / 10) * 10;
  saveData.se += m;
  R.push('$' + formatNumber(m));
  if (Math.random() < 0.6) {
    const it = Object.keys(ITEMS).filter(i => !['bell', 'parachute'].includes(i));
    const i = it[Math.floor(Math.random() * it.length)];
    if (i) {
      saveData.items[i] = (saveData.items[i] || 0) + 1;
      R.push(ITEMS[i].n);
    }
  } else {
    const c = Math.random() < 0.75 ? 'silver' : 'gold';
    if (COINS[c]) {
      saveData.coins[c] = (saveData.coins[c] || 0) + (c === 'silver' ? 3 : 1);
      R.push((c === 'silver' ? '3 × ' : '') + COINS[c].n);
    }
  }
  if (typeof soundEffect === 'function') soundEffect('buy');
  return R.join(', ');
}

/* ---------- daily challenges ---------- */
const CHALLENGE_KINDS = [
  {
    k: 'steps',
    make: r => ({ need: [3000, 5000, 8000][Math.floor(r() * 3)] }),
    text: c => `Walk ${formatNumber(c.need)} steps today`,
  },
  { k: 'catch', make: r => ({ need: 2 + Math.floor(r() * 2) }), text: c => `Tax ${c.need} Billies` },
  {
    k: 'catchT',
    make: r => {
      const T = typeIds();
      return { need: 1, t: T[Math.floor(r() * T.length)] };
    },
    text: c => `Tax a ${c.t} Billie`,
  },
  { k: 'win', make: r => ({ need: 2 + Math.floor(r() * 2) }), text: c => `Win ${c.need} battles` },
  { k: 'fish', make: () => ({ need: 1 }), text: () => 'Land something with your fishing rod' },
  { k: 'stamp', make: () => ({ need: 1 }), text: () => 'Find a gold stamp' },
];
export function challengesToday() {
  const X = thingsToDo(),
    d = today();
  if (!X.chal || X.chal.date !== d) {
    const r = seededRandom('chal' + d),
      pool = CHALLENGE_KINDS.slice(),
      list = [];
    while (list.length < 3 && pool.length) {
      const T = pool.splice(Math.floor(r() * pool.length), 1)[0];
      list.push(Object.assign({ k: T.k, have: 0, claimed: false }, T.make(r)));
    }
    X.chal = { date: d, list };
  }
  return X.chal;
}
const challengeProgress = c => (c.k === 'steps' ? saveData.day.steps : c.have);
const challengeText = c => (CHALLENGE_KINDS.find(t => t.k === c.k) || { text: () => c.k }).text(c);
/* something happened: a catch (with its types), a win, a fish landed, a stamp found */
function thingsToDoEvent(k, o = {}) {
  if (!saveData || !saveData.started) return;
  const C = challengesToday();
  let ch = false;
  for (const c of C.list) {
    if (c.claimed) continue;
    const hit = c.k === k || (k === 'catch' && c.k === 'catchT');
    if (!hit) continue;
    if (c.k === 'catchT' && !(o.types || []).includes(c.t)) continue;
    c.have++;
    ch = true;
    if (challengeProgress(c) >= c.need && !c.told) {
      c.told = 1;
      toast(`Challenge done: ${challengeText(c)}. Claim it on the Walk tab.`);
    }
  }
  if (k === 'catch')
    for (const q of Object.values(thingsToDo().reqs))
      if (q.state === 'accepted' && q.k === 'catch' && (o.types || []).includes(q.t)) {
        q.have = (q.have || 0) + 1;
        ch = true;
      }
  if (ch) save();
}
export function challengeCardHTML() {
  if (!saveData.started) return '';
  const C = challengesToday();
  return `<section class="chal px glass"><div class="sec-h"><h2>Today’s challenges</h2><span class="count tnum">${C.list.filter(c => c.claimed).length}/${C.list.length}</span></div>${C.list
    .map((c, i) => {
      const h = Math.min(challengeProgress(c), c.need),
        done = h >= c.need;
      return `<div class="ch-row ${c.claimed ? 'claimed' : ''}"><div class="ch-t"><b>${escapeHtml(challengeText(c))}</b><span class="note tnum">${formatNumber(h)} / ${formatNumber(c.need)}</span>${progressBarHTML(h / c.need, done ? 'gold' : 'live')}</div>${c.claimed ? `<span class="ch-ok">Claimed</span>` : done ? `<button class="pb small gold" data-a="chal" data-i="${i}">Claim</button>` : ''}</div>`;
    })
    .join('')}<p class="note">New challenges every day.</p></section>`;
}
function claimChallenge(i) {
  const c = challengesToday().list[+i];
  if (!c || c.claimed || challengeProgress(c) < c.need) return;
  c.claimed = true;
  const got = thingsToDoReward(1.4);
  save();
  render();
  toast(`Reward: ${got}.`);
}

/* ---------- townsfolk with requests ---------- */
const REQUEST_KINDS = {
  show: q => `Do you have a ${q.t} Billie with you? I’ve always wanted to see one up close.`,
  steps: q =>
    `Could you take my letter for a walk? It needs ${formatNumber(q.n)} steps of fresh air. Bring it back to me after.`,
  catch: q => `I’d love to see a ${q.t} Billie. Tax one and come back to show me?`,
};
function requestHere(node = saveData.route.node) {
  const R = LOCATIONS[node];
  if (!R || !R.town || !saveData.started) return null;
  const X = thingsToDo(),
    d = today();
  let q = X.reqs[node];
  if (!q || (q.date !== d && q.state !== 'accepted')) {
    const r = seededRandom('req' + node + d),
      T = typeIds(),
      ks = Object.keys(REQUEST_KINDS);
    q = X.reqs[node] = {
      date: d,
      k: ks[Math.floor(r() * ks.length)],
      t: T[Math.floor(r() * T.length)],
      n: [800, 1500, 2500][Math.floor(r() * 3)],
      state: 'open',
    };
  }
  return q;
}
/* the first townsperson in a town has the request; a gold ! floats over them until it's done */
function requestAsker() {
  if (typeof walkView === 'undefined' || !walkView.folk || !walkView.folk.length || uiState.inside || uiState.bench)
    return null;
  const q = requestHere();
  if (!q || q.state === 'done') return null;
  return walkView.folk[0];
}
const teamBillyOfType = t =>
  saveData.team.find(m => m.hp > 0 && SPECIES[m.sp].types.includes(t)) ||
  saveData.team.find(m => SPECIES[m.sp].types.includes(t));
async function requestTalk(f) {
  if (talkBox.on) return;
  const q = requestHere(),
    who = 'folk:' + f.seed;
  f.wait = 99;
  f.route = null;
  f.walk = 0;
  turnToPlayer(f);
  if (!q) return;
  const finish = async line => {
    q.state = 'done';
    const got = thingsToDoReward(1.2);
    save();
    await talk([
      [who, `[happy] ${line}`],
      [who, `Here, take this: ${got}.`],
    ]);
    f.wait = 2;
    render();
  };
  if (q.state === 'open') {
    await talk([[who, REQUEST_KINDS[q.k](q)]]);
    f.wait = 2;
    if (q.k === 'show') {
      const m = teamBillyOfType(q.t);
      modal({
        title: m ? `Show ${escapeHtml(billyName(m))}?` : `No ${escapeHtml(q.t)} Billie with you`,
        html: m
          ? `<p>${escapeHtml(billyName(m))} is a ${escapeHtml(SPECIES[m.sp].types.join('/'))} Billie.</p>`
          : `<p class="note">Come back with one in your team.</p>`,
        btns: m
          ? [
              {
                l: `Show ${escapeHtml(billyName(m))}`,
                c: 'gold',
                f: () => {
                  closeModal();
                  finish(`Wow, a real ${q.t} Billie! Look at that ${['shine', 'posture', 'portfolio'][f.seed % 3]}.`);
                },
              },
              { l: 'Not now', c: 'quiet', f: closeModal },
            ]
          : [{ l: 'OK', c: 'quiet', f: closeModal }],
      });
    } else
      modal({
        title: 'Help out?',
        html: `<p>${escapeHtml(q.k === 'steps' ? `Walk ${formatNumber(q.n)} steps, then come back and talk to them.` : `Tax a ${q.t} Billie, then come back and talk to them.`)}</p>`,
        btns: [
          {
            l: 'I’ll do it',
            c: 'gold',
            f: () => {
              q.state = 'accepted';
              q.base = saveData.totalSteps;
              q.have = 0;
              save();
              closeModal();
              toast('Request accepted. It’s on your Walk tab.');
              render();
            },
          },
          { l: 'Not now', c: 'quiet', f: closeModal },
        ],
      });
    return;
  }
  if (q.state === 'accepted') {
    if (q.k === 'steps') {
      const left = q.n - (saveData.totalSteps - (q.base || 0));
      if (left <= 0) return finish('The letter looks so refreshed! Thank you.');
      await talk([[who, `Only ${formatNumber(left)} more steps for my letter. It’s enjoying the walk.`]]);
    } else if (q.k === 'catch') {
      if ((q.have || 0) >= 1) return finish(`You taxed one! A real ${q.t} Billie. I’ll tell everyone.`);
      await talk([[who, `Still hoping you’ll tax a ${q.t} Billie for me.`]]);
    } else if (q.k === 'show') {
      const m = teamBillyOfType(q.t);
      if (m) return finish(`Wow, ${billyName(m)}! Thank you for showing me.`);
      await talk([[who, `I’d still love to see a ${q.t} Billie.`]]);
    }
  }
  f.wait = 2;
}
/* requests you've taken on, wherever you are */
export function requestListHTML() {
  const X = thingsToDo();
  return Object.entries(X.reqs)
    .filter(([, q]) => q.state === 'accepted')
    .map(([n, q]) => {
      const where = LOCATIONS[+n] ? LOCATIONS[+n].name : '';
      const txt =
        q.k === 'steps'
          ? `Walk ${formatNumber(Math.max(0, q.n - (saveData.totalSteps - (q.base || 0))))} more steps for a letter`
          : q.k === 'catch'
            ? q.have
              ? `Show your ${q.t} Billie`
              : `Tax a ${q.t} Billie`
            : `Show a ${q.t} Billie`;
      return `<div class="ch-row"><div class="ch-t"><b>${escapeHtml(txt)}</b><span class="note">For someone in ${escapeHtml(where)}</span></div></div>`;
    })
    .join('');
}

/* ---------- gold stamps: two in every place ---------- */
const STAMP_SPOTS = {};
function stampMaps() {
  return [...new Set(LOCATIONS.map(r => r.scene).filter(id => id && gameData.scenes[id]))];
}
const stampTotal = () => stampMaps().length * 2;
export const stampCount = () => Object.keys(thingsToDo().stamps).length;
/* where they lie: worked out once per place, on open ground you can walk to, away from where you arrive */
function stampSpots() {
  if (typeof uiState !== 'undefined' && uiState.inside) return [];
  const id = baseMapId(),
    sc0 = walkView.sc,
    sc = sc0 && sc0.baseId ? mapById(sc0.baseId) : sc0,
    o = (sc0 && sc0.baseOff) || [0, 0];
  if (!sc || !id || sc.test || /^int_/.test(id) || !stampMaps().includes(id)) return [];
  if (STAMP_SPOTS[id])
    return o[0] || o[1] ? STAMP_SPOTS[id].map(p => [p[0] + o[0], p[1] + o[1], ...p.slice(2)]) : STAMP_SPOTS[id];
  const r = seededRandom('stamp' + id),
    hub = mapHub(sc),
    out = [];
  for (let k = 0; k < 80 && out.length < 2; k++) {
    const p = walkablePointNear(o[0] + 1 + r() * (sc.w - 2), o[1] + 1 + r() * (sc.h - 2));
    if (!p) continue;
    if (
      Math.hypot(p[0] - o[0] - hub[0], p[1] - o[1] - hub[1]) < 5 ||
      out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 7)
    )
      continue;
    const q = findPath(hub[0] + o[0], hub[1] + o[1], p[0], p[1]),
      e = q && q[q.length - 1];
    if (!e || Math.hypot(e[0] - p[0], e[1] - p[1]) > 0.6) continue;
    if (/[wd]/.test(terrainAt(p[0], p[1]))) continue;
    out.push(p);
  }
  STAMP_SPOTS[id] = out.map(p => [p[0] - o[0], p[1] - o[1]]);
  return out;
}
/* drawn by the walk scene's effects pass: a gold glint you pick up by walking over it */
function stampDraw(quad, glows, t) {
  if (!saveData || !saveData.started || walkRenderer.bt || uiState.bench) return;
  const X = thingsToDo(),
    P = walkView.pl,
    sp = stampSpots();
  sp.forEach((p, i) => {
    const key = baseMapId() + ':' + i;
    if (X.stamps[key]) return;
    const y = standingHeightAt(p[0], p[1]),
      b = 0.12 + Math.sin(t / 300 + i) * 0.04;
    quad('sparkle', Math.floor(t / 120 + i) % 4, p[0], y + 0.25 + b, p[1], 0.42, 0.42, 1, [1, 0.9, 0.5]);
    glows.push([p[0], y + 0.2 + b, p[1], 0.22, [1, 0.8, 0.3], 1.3]);
    if (Math.hypot(P.x - p[0], P.z - p[1]) < 0.7) {
      X.stamps[key] = today();
      const n = stampCount();
      if (typeof soundEffect === 'function') soundEffect('coin');
      thingsToDoEvent('stamp');
      let msg = `Gold stamp found! ${n} of ${stampTotal()}.`;
      if (n % 3 === 0) {
        const nu = FURNITURE.find(f => !X.home.own.includes(f[0]));
        if (nu) {
          X.home.own.push(nu[0]);
          msg += ` New for your room: ${nu[1]}.`;
        }
      }
      save();
      toast(msg);
    }
  });
}
export function stampTile(tile) {
  return tile(
    uiIconHTML('spark', 14),
    'Gold stamps',
    `${stampCount()}/${stampTotal()}`,
    'Two hidden in every place',
    stampCount() / Math.max(1, stampTotal())
  );
}

/* ---------- your room (alpha 0.4: in Granny Juniper's cottage in Copperleaf) ---------- */
const FURNITURE = [
  ['rug_round', 'Round rug'],
  ['plant_tall', 'Potted plant'],
  ['chair_wood', 'Wooden chair'],
  ['table_round', 'Round table'],
  ['sofa', 'Sofa'],
  ['bookshelf', 'Bookcase'],
  ['wall_painting', 'Painting'],
  ['wall_clock', 'Clock'],
  ['fireplace', 'Fireplace'],
  ['wall_window', 'Window'],
  ['rug_long', 'Runner rug'],
  ['fridge_drinks', 'Drinks fridge'],
  ['crate_goods', 'Crate of goods'],
  ['shop_shelf', 'Shelves'],
  ['privacy_screen', 'Screen'],
  ['lab_machine', 'Coin tube'],
];
/* where things can go: floor spots, two on the back wall, one for a rug */
const HOME_SLOTS = [
  { x: 2.6, z: 8.6, n: 'Back left' },
  { x: 7, z: 9.0, n: 'Back wall, middle' },
  { x: 11.4, z: 8.6, n: 'Back right' },
  { x: 2.4, z: 5.4, n: 'Left' },
  { x: 11.6, z: 5.4, n: 'Right' },
  { x: 7, z: 6.2, n: 'Middle' },
  { x: 2.2, z: 2.6, n: 'Front left' },
  { x: 11.8, z: 2.6, n: 'Front right' },
  { x: 4.2, z: 9.45, n: 'On the wall, left', wall: 1 },
  { x: 9.8, z: 9.45, n: 'On the wall, right', wall: 1 },
  { x: 7, z: 3.9, n: 'Floor (rug)', rug: 1 },
];
const furnitureFits = (k, s) => (s.wall ? /^wall_/.test(k) : s.rug ? /^rug_/.test(k) : !/^wall_|^rug_/.test(k));
export function refreshHomeFurniture() {
  placeHomeFurniture();
  if (typeof roomRefresh === 'function') roomRefresh();
}
function placeHomeFurniture() {
  const sc = gameData.scenes.int_home;
  if (!sc) return;
  if (!sc.props0) sc.props0 = (sc.props || []).slice();
  const X = thingsToDo();
  sc.props = sc.props0.concat(
    HOME_SLOTS.map((s, i) => {
      const k = X.home.slots[i];
      return k && furnitureFits(k, s) ? { k, x: s.x, z: s.z } : null;
    }).filter(Boolean)
  );
}
export function homeDecorate() {
  const X = thingsToDo(),
    own = X.home.own;
  const row = (s, i) => {
    const opts = own.filter(k => furnitureFits(k, s));
    return `<label class="fld"><span>${escapeHtml(s.n)}</span><select data-home="${i}"><option value="">Nothing</option>${opts.map(k => `<option value="${k}" ${X.home.slots[i] === k ? 'selected' : ''}>${escapeHtml((FURNITURE.find(f => f[0] === k) || [k, k])[1])}</option>`).join('')}</select></label>`;
  };
  modal({
    title: 'Decorate your room',
    html: `<p class="note">You have ${own.length} of ${FURNITURE.length} pieces. Every third gold stamp you find brings a new one.</p><div class="home-grid">${HOME_SLOTS.map(row).join('')}</div>`,
    btns: [
      {
        l: 'Done',
        c: 'gold',
        f: () => {
          closeModal();
          render();
        },
      },
    ],
  });
}
document.addEventListener('change', ev => {
  const i = ev.target && ev.target.dataset && ev.target.dataset.home;
  if (i == null) return;
  const X = thingsToDo();
  if (ev.target.value) X.home.slots[i] = ev.target.value;
  else delete X.home.slots[i];
  refreshHomeFurniture();
  save();
});

/* ---------- photo mode ---------- */
const PHOTO_FILTERS = [
  ['none', 'Natural', ''],
  ['warm', 'Warm', 'sepia(.25) saturate(1.25) brightness(1.04)'],
  ['mono', 'Black and white', 'grayscale(1) contrast(1.15)'],
  ['sepia', 'Old photo', 'sepia(.85) contrast(.95) brightness(1.02)'],
  ['vivid', 'Vivid', 'saturate(1.6) contrast(1.08)'],
  ['dream', 'Dreamy', 'saturate(1.2) brightness(1.08) blur(.6px)'],
];
function photoStart() {
  if (typeof walkRenderer === 'undefined' || !walkRenderer.on) {
    toast('Photo mode needs the 3D scene (Settings → Visual effects → Full).');
    return;
  }
  if (uiState.photo) return;
  uiState.photo = { f: 'none' };
  document.body.classList.add('photo');
  if (walkRenderer.ui) walkRenderer.ui.style.visibility = 'hidden';
  const el = document.createElement('div');
  el.className = 'photo-ui glass';
  el.id = 'photoUI';
  el.innerHTML = `<div class="ph-row">${PHOTO_FILTERS.map(([k, n]) => `<button class="pb small ${k === 'none' ? 'on' : ''}" data-a="photoF" data-k="${k}">${n}</button>`).join('')}</div>
  <div class="ph-row"><button class="pb small" data-a="photoTurn" data-d="-1" aria-label="Turn left">⟲</button><button class="pb small" data-a="photoZoom" data-d="-1" aria-label="Closer">+</button><button class="pb small" data-a="photoZoom" data-d="1" aria-label="Farther">−</button><button class="pb small" data-a="photoTurn" data-d="1" aria-label="Turn right">⟳</button><button class="pb small" data-a="photoLabels">Labels</button></div>
  <div class="ph-row"><button class="pb gold" data-a="photoShot">${uiIconHTML('camera', 16)} Take photo</button><button class="pb quiet" data-a="photoEnd">Done</button></div>`;
  document.body.appendChild(el);
  photoFilter('none');
}
function photoFilter(k) {
  if (!uiState.photo) return;
  uiState.photo.f = k;
  const F = PHOTO_FILTERS.find(f => f[0] === k);
  if (walkView.cv) walkView.cv.style.filter = F ? F[2] : '';
  document.querySelectorAll('[data-a=photoF]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
}
function photoEnd() {
  uiState.photo = null;
  document.body.classList.remove('photo');
  const el = document.getElementById('photoUI');
  if (el) el.remove();
  if (walkView.cv) walkView.cv.style.filter = '';
  if (walkRenderer.ui) walkRenderer.ui.style.visibility = '';
  if (typeof walkRenderer !== 'undefined') {
    walkRenderer.zoomT = 1;
    walkRenderer.yawT = 0;
  }
}
function photoShot() {
  if (!uiState.photo || typeof walkRenderer === 'undefined') return;
  if (typeof soundEffect === 'function') soundEffect('pop');
  walkRenderer.photoReq = c => {
    if (!c) {
      toast('The picture couldn’t be taken on this device.');
      return;
    }
    const F = PHOTO_FILTERS.find(f => f[0] === uiState.photo.f),
      o = makeCanvas(c.width, c.height),
      x = o.getContext('2d');
    if (F && F[2]) x.filter = F[2];
    x.drawImage(c, 0, 0);
    x.filter = 'none';
    /* a little caption in the corner */ x.font = `600 ${Math.max(12, Math.round(o.width / 60))}px Chakra Petch, system-ui, sans-serif`;
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.textAlign = 'right';
    x.fillText(`${(walkView.sc && walkView.sc.name) || ''} · Pocket Billies`, o.width - 12, o.height - 12);
    const url = o.toDataURL('image/png'),
      nm = `pocket-billies-${baseMapId() || 'photo'}-${Date.now()}.png`;
    modal({
      title: 'Your photo',
      html: `<img class="photo-prev" src="${url}" alt="Your photo of ${escapeHtml((walkView.sc && walkView.sc.name) || 'the scene')}"><p class="note">Save it, or long-press the picture to share it.</p>`,
      btns: [
        {
          l: 'Save picture',
          c: 'gold',
          f: () => {
            const a = document.createElement('a');
            a.href = url;
            a.download = nm;
            document.body.appendChild(a);
            a.click();
            a.remove();
          },
        },
        { l: 'Keep shooting', c: 'quiet', f: closeModal },
      ],
    });
  };
}
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'photoF') photoFilter(el.dataset.k);
  else if (a === 'photoZoom') {
    walkRenderer.zoomT = clamp(
      walkRenderer.zoomT + +el.dataset.d * 0.15,
      engineSetting('camera', 'zoomMin'),
      engineSetting('camera', 'zoomMax')
    );
  } else if (a === 'photoTurn') {
    const lim = (engineSetting('camera', 'turn') * Math.PI) / 180;
    walkRenderer.yawT = clamp(walkRenderer.yawT + +el.dataset.d * 0.2, -lim, lim);
  } else if (a === 'photoLabels') {
    if (walkRenderer.ui)
      walkRenderer.ui.style.visibility = walkRenderer.ui.style.visibility === 'hidden' ? '' : 'hidden';
  } else if (a === 'photoShot') photoShot();
  else if (a === 'photoEnd') photoEnd();
  else if (a === 'chal') claimChallenge(el.dataset.i);
  else if (a === 'photo') photoStart();
  else if (a === 'decorate') homeDecorate();
});

/* ---------- battles feel the weather ---------- */
const WEATHER_TYPE_BOOSTS = {
  rain: { Water: 1.2, Fire: 0.8 },
  storm: { Electric: 1.25, Water: 1.15, Fire: 0.8 },
  snow: { Steel: 1.1, Grass: 0.9 },
  fog: { Psychic: 1.1 },
  ash: { Fire: 1.15, Ground: 1.15, Water: 0.9 },
  sunny: { Fire: 1.15, Grass: 1.1, Water: 0.95 },
  night: { Psychic: 1.15, Dragon: 1.1 },
};
const WEATHER_BATTLE_NOTES = {
  rain: 'It’s raining: Water moves hit harder and Fire moves fizzle.',
  storm: 'A storm is raging: Electric and Water moves are stronger, Fire weaker.',
  snow: 'Snow is falling: Steel moves are a little stronger, Grass a little weaker.',
  fog: 'In the fog, Psychic moves are a little stronger.',
  ash: 'Ash is falling: Fire and Ground moves hit harder, Water a little weaker.',
  sunny: 'The sun is out: Fire and Grass moves are a little stronger.',
  night: 'It’s night: Psychic and Dragon moves are a little stronger.',
};
function battleWeather() {
  if (typeof activeBattle === 'undefined' || !activeBattle) return null;
  if (activeBattle.wx !== undefined) return activeBattle.wx;
  if (typeof environmentState !== 'function' || !environment.on || (RULES.env && RULES.env.battleOff))
    return (activeBattle.wx = null);
  const sc = currentLocationMap();
  if (!sc || sc.indoor) return (activeBattle.wx = null);
  const st = environmentState(sc),
    k = st.night > 0.5 ? (st.wx === 'clear' ? 'night' : st.wx) : st.wx === 'clear' ? 'sunny' : st.wx,
    m = Object.assign({}, WEATHER_TYPE_BOOSTS[k] || {}, ((RULES.env || {}).battle || {})[k] || {});
  return (activeBattle.wx = Object.keys(m).length ? { k, m } : null);
}
function battleWeatherMultiplier(t) {
  const w = battleWeather();
  return (w && w.m[t]) || 1;
}
/* hooks into the rest of the game: a weather line when a battle opens, wins and catches for the challenges, fish landed */
(function () {
  if (typeof openBattle === 'function') {
    const ob = openBattle;
    setOpenBattle(function () {
      try {
        const w = battleWeather();
        if (w && WEATHER_BATTLE_NOTES[w.k]) battleSay(WEATHER_BATTLE_NOTES[w.k]);
      } catch (e) {}
      return ob.apply(this, arguments);
    });
  }
  if (typeof endBattle === 'function') {
    const eb = endBattle;
    setEndBattle(function () {
      let o = null,
        types = null;
      try {
        o = activeBattle && activeBattle.over;
        const f = activeBattle && activeBattle.sides && activeBattle.sides[1] && activeBattle.sides[1].team[0];
        types = f ? SPECIES[f.sp].types : null;
        if (activeBattle && activeBattle.fished && o === 'caught') thingsToDoEvent('fish');
      } catch (e) {}
      const r = eb.apply(this, arguments);
      try {
        if (o === 'win') thingsToDoEvent('win');
        if (o === 'caught') thingsToDoEvent('catch', { types: types || [] });
      } catch (e) {}
      return r;
    });
  }
  if (typeof talkFolk === 'function') {
    const tf = talkFolk;
    setTalkFolk(function (f) {
      if (f && f === requestAsker()) return requestTalk(f);
      return tf.apply(this, arguments);
    });
  }
})();
/* the painted battle stage gets rain, snow, ash or the night drawn over it (the 3D stage has the real thing) */
setInterval(() => {
  const el = document.getElementById('camWorld');
  if (!el) return;
  const w =
      typeof activeBattle !== 'undefined' && activeBattle && !(typeof walkView !== 'undefined' && walkView.battle)
        ? battleWeather()
        : null,
    k = w ? w.k : '';
  if (el.dataset.wx !== k) el.dataset.wx = k;
}, 500);
