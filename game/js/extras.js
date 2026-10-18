'use strict';
/* ================= THINGS TO DO (v28) =================
   Daily challenges, townsfolk with requests, two gold stamps hidden in every place, your own room (in Copperleaf since alpha 0.4) to
   decorate, photo mode, and battles that feel the weather. Everything lives in S.x, which an older save gets the
   first time it's needed. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './bridge.js';
import { bar, closeModal, modal, provide, render, roomRefresh, toast } from './hooks.js';
import { clamp } from './util.js';
import { COINS, GD, ITEMS, ROUTE, RULES, SP } from './data.js';
import { B, N, S, U, esc, fmt, save, today } from './core.js';
import { cnv, uiIco } from './art.js';
import { DIO, dioBaseId, dioFace, dioFind, dioFreePt, dioHubOf, dioScene, dioTer } from './diorama.js';
import { eng } from './engine/settings.js';
import { ENV, envHere, envState } from './env.js';
import { DGL, dioH } from './diorama-gl.js';
import { endBattle, openBattle, say, setEndBattle, setOpenBattle } from './battle.js';
import { sfx } from './sound.js';
import { TALK, setTalkFolk, talk, talkFolk } from './talk.js';
/* eslint-disable no-func-assign */
expose({
  FURN: [() => FURN],
  HOME_SLOTS: [() => HOME_SLOTS],
  PHOTO_FILTERS: [() => PHOTO_FILTERS],
  STAMP_SPOTS: [() => STAMP_SPOTS],
  X28_BWX: [() => X28_BWX],
  X28_BWX_TEXT: [() => X28_BWX_TEXT],
  X28_CH: [() => X28_CH],
  X28_REQ: [() => X28_REQ],
  _homeApply: [() => _homeApply, v => (_homeApply = v)],
  battleWeatherMult: [() => battleWeatherMult, v => (battleWeatherMult = v)],
  battleWx: [() => battleWx, v => (battleWx = v)],
  chalCard: [() => chalCard, v => (chalCard = v)],
  chalClaim: [() => chalClaim, v => (chalClaim = v)],
  chalHave: [() => chalHave],
  chalText: [() => chalText],
  chalToday: [() => chalToday, v => (chalToday = v)],
  furnFits: [() => furnFits],
  homeApply: [() => homeApply, v => (homeApply = v)],
  homeDecorate: [() => homeDecorate, v => (homeDecorate = v)],
  photoEnd: [() => photoEnd, v => (photoEnd = v)],
  photoFilter: [() => photoFilter, v => (photoFilter = v)],
  photoShot: [() => photoShot, v => (photoShot = v)],
  photoStart: [() => photoStart, v => (photoStart = v)],
  reqAsker: [() => reqAsker, v => (reqAsker = v)],
  reqHere: [() => reqHere, v => (reqHere = v)],
  reqList: [() => reqList, v => (reqList = v)],
  reqTalk: [() => reqTalk, v => (reqTalk = v)],
  stampCount: [() => stampCount],
  stampDraw: [() => stampDraw, v => (stampDraw = v)],
  stampScenes: [() => stampScenes, v => (stampScenes = v)],
  stampSpots: [() => stampSpots, v => (stampSpots = v)],
  stampTile: [() => stampTile, v => (stampTile = v)],
  stampTotal: [() => stampTotal],
  x28: [() => x28, v => (x28 = v)],
  x28Event: [() => x28Event, v => (x28Event = v)],
  x28Reward: [() => x28Reward, v => (x28Reward = v)],
  x28Rnd: [() => x28Rnd, v => (x28Rnd = v)],
  x28TeamOf: [() => x28TeamOf],
  x28Types: [() => x28Types],
});
/* eslint-enable no-func-assign */
provide({ battleWeatherMult, reqAsker, stampDraw, x28Event });
/* to-module: end */
function x28() {
  const X = S.x || (S.x = {});
  X.stamps = X.stamps || {};
  X.reqs = X.reqs || {};
  X.home = X.home || { slots: {}, own: ['rug_round', 'plant_tall', 'chair_wood', 'table_round'] };
  return X;
}
/* a seeded random sequence, so today's challenges and requests are the same however often you look */
function x28Rnd(seed) {
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
const x28Types = () => (GD.types || []).map(t => t.id);
/* money, and an item or some coins */
function x28Reward(k = 1) {
  const R = [],
    m = Math.round(((150 + Math.random() * 350) * k) / 10) * 10;
  S.se += m;
  R.push('$' + fmt(m));
  if (Math.random() < 0.6) {
    const it = Object.keys(ITEMS).filter(i => !['bell', 'parachute'].includes(i));
    const i = it[Math.floor(Math.random() * it.length)];
    if (i) {
      S.items[i] = (S.items[i] || 0) + 1;
      R.push(ITEMS[i].n);
    }
  } else {
    const c = Math.random() < 0.75 ? 'silver' : 'gold';
    if (COINS[c]) {
      S.coins[c] = (S.coins[c] || 0) + (c === 'silver' ? 3 : 1);
      R.push((c === 'silver' ? '3 × ' : '') + COINS[c].n);
    }
  }
  if (typeof sfx === 'function') sfx('buy');
  return R.join(', ');
}

/* ---------- daily challenges ---------- */
const X28_CH = [
  {
    k: 'steps',
    make: r => ({ need: [3000, 5000, 8000][Math.floor(r() * 3)] }),
    text: c => `Walk ${fmt(c.need)} steps today`,
  },
  { k: 'catch', make: r => ({ need: 2 + Math.floor(r() * 2) }), text: c => `Tax ${c.need} Billies` },
  {
    k: 'catchT',
    make: r => {
      const T = x28Types();
      return { need: 1, t: T[Math.floor(r() * T.length)] };
    },
    text: c => `Tax a ${c.t} Billie`,
  },
  { k: 'win', make: r => ({ need: 2 + Math.floor(r() * 2) }), text: c => `Win ${c.need} battles` },
  { k: 'fish', make: () => ({ need: 1 }), text: () => 'Land something with your fishing rod' },
  { k: 'stamp', make: () => ({ need: 1 }), text: () => 'Find a gold stamp' },
];
export function chalToday() {
  const X = x28(),
    d = today();
  if (!X.chal || X.chal.date !== d) {
    const r = x28Rnd('chal' + d),
      pool = X28_CH.slice(),
      list = [];
    while (list.length < 3 && pool.length) {
      const T = pool.splice(Math.floor(r() * pool.length), 1)[0];
      list.push(Object.assign({ k: T.k, have: 0, claimed: false }, T.make(r)));
    }
    X.chal = { date: d, list };
  }
  return X.chal;
}
const chalHave = c => (c.k === 'steps' ? S.day.steps : c.have);
const chalText = c => (X28_CH.find(t => t.k === c.k) || { text: () => c.k }).text(c);
/* something happened: a catch (with its types), a win, a fish landed, a stamp found */
function x28Event(k, o = {}) {
  if (!S || !S.started) return;
  const C = chalToday();
  let ch = false;
  for (const c of C.list) {
    if (c.claimed) continue;
    const hit = c.k === k || (k === 'catch' && c.k === 'catchT');
    if (!hit) continue;
    if (c.k === 'catchT' && !(o.types || []).includes(c.t)) continue;
    c.have++;
    ch = true;
    if (chalHave(c) >= c.need && !c.told) {
      c.told = 1;
      toast(`Challenge done: ${chalText(c)}. Claim it on the Walk tab.`);
    }
  }
  if (k === 'catch')
    for (const q of Object.values(x28().reqs))
      if (q.state === 'accepted' && q.k === 'catch' && (o.types || []).includes(q.t)) {
        q.have = (q.have || 0) + 1;
        ch = true;
      }
  if (ch) save();
}
export function chalCard() {
  if (!S.started) return '';
  const C = chalToday();
  return `<section class="chal px glass"><div class="sec-h"><h2>Today’s challenges</h2><span class="count tnum">${C.list.filter(c => c.claimed).length}/${C.list.length}</span></div>${C.list
    .map((c, i) => {
      const h = Math.min(chalHave(c), c.need),
        done = h >= c.need;
      return `<div class="ch-row ${c.claimed ? 'claimed' : ''}"><div class="ch-t"><b>${esc(chalText(c))}</b><span class="note tnum">${fmt(h)} / ${fmt(c.need)}</span>${bar(h / c.need, done ? 'gold' : 'live')}</div>${c.claimed ? `<span class="ch-ok">Claimed</span>` : done ? `<button class="pb small gold" data-a="chal" data-i="${i}">Claim</button>` : ''}</div>`;
    })
    .join('')}<p class="note">New challenges every day.</p></section>`;
}
function chalClaim(i) {
  const c = chalToday().list[+i];
  if (!c || c.claimed || chalHave(c) < c.need) return;
  c.claimed = true;
  const got = x28Reward(1.4);
  save();
  render();
  toast(`Reward: ${got}.`);
}

/* ---------- townsfolk with requests ---------- */
const X28_REQ = {
  show: q => `Do you have a ${q.t} Billie with you? I’ve always wanted to see one up close.`,
  steps: q =>
    `Could you take my letter for a walk? It needs ${fmt(q.n)} steps of fresh air. Bring it back to me after.`,
  catch: q => `I’d love to see a ${q.t} Billie. Tax one and come back to show me?`,
};
function reqHere(node = S.route.node) {
  const R = ROUTE[node];
  if (!R || !R.town || !S.started) return null;
  const X = x28(),
    d = today();
  let q = X.reqs[node];
  if (!q || (q.date !== d && q.state !== 'accepted')) {
    const r = x28Rnd('req' + node + d),
      T = x28Types(),
      ks = Object.keys(X28_REQ);
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
function reqAsker() {
  if (typeof DIO === 'undefined' || !DIO.folk || !DIO.folk.length || U.inside || U.bench) return null;
  const q = reqHere();
  if (!q || q.state === 'done') return null;
  return DIO.folk[0];
}
const x28TeamOf = t =>
  S.team.find(m => m.hp > 0 && SP[m.sp].types.includes(t)) || S.team.find(m => SP[m.sp].types.includes(t));
async function reqTalk(f) {
  if (TALK.on) return;
  const q = reqHere(),
    who = 'folk:' + f.seed;
  f.wait = 99;
  f.route = null;
  f.walk = 0;
  dioFace(f);
  if (!q) return;
  const finish = async line => {
    q.state = 'done';
    const got = x28Reward(1.2);
    save();
    await talk([
      [who, `[happy] ${line}`],
      [who, `Here, take this: ${got}.`],
    ]);
    f.wait = 2;
    render();
  };
  if (q.state === 'open') {
    await talk([[who, X28_REQ[q.k](q)]]);
    f.wait = 2;
    if (q.k === 'show') {
      const m = x28TeamOf(q.t);
      modal({
        title: m ? `Show ${esc(N(m))}?` : `No ${esc(q.t)} Billie with you`,
        html: m
          ? `<p>${esc(N(m))} is a ${esc(SP[m.sp].types.join('/'))} Billie.</p>`
          : `<p class="note">Come back with one in your team.</p>`,
        btns: m
          ? [
              {
                l: `Show ${esc(N(m))}`,
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
        html: `<p>${esc(q.k === 'steps' ? `Walk ${fmt(q.n)} steps, then come back and talk to them.` : `Tax a ${q.t} Billie, then come back and talk to them.`)}</p>`,
        btns: [
          {
            l: 'I’ll do it',
            c: 'gold',
            f: () => {
              q.state = 'accepted';
              q.base = S.totalSteps;
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
      const left = q.n - (S.totalSteps - (q.base || 0));
      if (left <= 0) return finish('The letter looks so refreshed! Thank you.');
      await talk([[who, `Only ${fmt(left)} more steps for my letter. It’s enjoying the walk.`]]);
    } else if (q.k === 'catch') {
      if ((q.have || 0) >= 1) return finish(`You taxed one! A real ${q.t} Billie. I’ll tell everyone.`);
      await talk([[who, `Still hoping you’ll tax a ${q.t} Billie for me.`]]);
    } else if (q.k === 'show') {
      const m = x28TeamOf(q.t);
      if (m) return finish(`Wow, ${N(m)}! Thank you for showing me.`);
      await talk([[who, `I’d still love to see a ${q.t} Billie.`]]);
    }
  }
  f.wait = 2;
}
/* requests you've taken on, wherever you are */
export function reqList() {
  const X = x28();
  return Object.entries(X.reqs)
    .filter(([, q]) => q.state === 'accepted')
    .map(([n, q]) => {
      const where = ROUTE[+n] ? ROUTE[+n].name : '';
      const txt =
        q.k === 'steps'
          ? `Walk ${fmt(Math.max(0, q.n - (S.totalSteps - (q.base || 0))))} more steps for a letter`
          : q.k === 'catch'
            ? q.have
              ? `Show your ${q.t} Billie`
              : `Tax a ${q.t} Billie`
            : `Show a ${q.t} Billie`;
      return `<div class="ch-row"><div class="ch-t"><b>${esc(txt)}</b><span class="note">For someone in ${esc(where)}</span></div></div>`;
    })
    .join('');
}

/* ---------- gold stamps: two in every place ---------- */
const STAMP_SPOTS = {};
function stampScenes() {
  return [...new Set(ROUTE.map(r => r.scene).filter(id => id && GD.scenes[id]))];
}
const stampTotal = () => stampScenes().length * 2;
export const stampCount = () => Object.keys(x28().stamps).length;
/* where they lie: worked out once per place, on open ground you can walk to, away from where you arrive */
function stampSpots() {
  if (typeof U !== 'undefined' && U.inside) return [];
  const id = dioBaseId(),
    sc0 = DIO.sc,
    sc = sc0 && sc0.baseId ? dioScene(sc0.baseId) : sc0,
    o = (sc0 && sc0.baseOff) || [0, 0];
  if (!sc || !id || sc.test || /^int_/.test(id) || !stampScenes().includes(id)) return [];
  if (STAMP_SPOTS[id])
    return o[0] || o[1] ? STAMP_SPOTS[id].map(p => [p[0] + o[0], p[1] + o[1], ...p.slice(2)]) : STAMP_SPOTS[id];
  const r = x28Rnd('stamp' + id),
    hub = dioHubOf(sc),
    out = [];
  for (let k = 0; k < 80 && out.length < 2; k++) {
    const p = dioFreePt(o[0] + 1 + r() * (sc.w - 2), o[1] + 1 + r() * (sc.h - 2));
    if (!p) continue;
    if (
      Math.hypot(p[0] - o[0] - hub[0], p[1] - o[1] - hub[1]) < 5 ||
      out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 7)
    )
      continue;
    const q = dioFind(hub[0] + o[0], hub[1] + o[1], p[0], p[1]),
      e = q && q[q.length - 1];
    if (!e || Math.hypot(e[0] - p[0], e[1] - p[1]) > 0.6) continue;
    if (/[wd]/.test(dioTer(p[0], p[1]))) continue;
    out.push(p);
  }
  STAMP_SPOTS[id] = out.map(p => [p[0] - o[0], p[1] - o[1]]);
  return out;
}
/* drawn by the walk scene's effects pass: a gold glint you pick up by walking over it */
function stampDraw(quad, glows, t) {
  if (!S || !S.started || DGL.bt || U.bench) return;
  const X = x28(),
    P = DIO.pl,
    sp = stampSpots();
  sp.forEach((p, i) => {
    const key = dioBaseId() + ':' + i;
    if (X.stamps[key]) return;
    const y = dioH(p[0], p[1]),
      b = 0.12 + Math.sin(t / 300 + i) * 0.04;
    quad('sparkle', Math.floor(t / 120 + i) % 4, p[0], y + 0.25 + b, p[1], 0.42, 0.42, 1, [1, 0.9, 0.5]);
    glows.push([p[0], y + 0.2 + b, p[1], 0.22, [1, 0.8, 0.3], 1.3]);
    if (Math.hypot(P.x - p[0], P.z - p[1]) < 0.7) {
      X.stamps[key] = today();
      const n = stampCount();
      if (typeof sfx === 'function') sfx('coin');
      x28Event('stamp');
      let msg = `Gold stamp found! ${n} of ${stampTotal()}.`;
      if (n % 3 === 0) {
        const nu = FURN.find(f => !X.home.own.includes(f[0]));
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
    uiIco('spark', 14),
    'Gold stamps',
    `${stampCount()}/${stampTotal()}`,
    'Two hidden in every place',
    stampCount() / Math.max(1, stampTotal())
  );
}

/* ---------- your room (alpha 0.4: in Granny Juniper's cottage in Copperleaf) ---------- */
const FURN = [
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
const furnFits = (k, s) => (s.wall ? /^wall_/.test(k) : s.rug ? /^rug_/.test(k) : !/^wall_|^rug_/.test(k));
export function homeApply() {
  _homeApply();
  if (typeof roomRefresh === 'function') roomRefresh();
}
function _homeApply() {
  const sc = GD.scenes.int_home;
  if (!sc) return;
  if (!sc.props0) sc.props0 = (sc.props || []).slice();
  const X = x28();
  sc.props = sc.props0.concat(
    HOME_SLOTS.map((s, i) => {
      const k = X.home.slots[i];
      return k && furnFits(k, s) ? { k, x: s.x, z: s.z } : null;
    }).filter(Boolean)
  );
}
export function homeDecorate() {
  const X = x28(),
    own = X.home.own;
  const row = (s, i) => {
    const opts = own.filter(k => furnFits(k, s));
    return `<label class="fld"><span>${esc(s.n)}</span><select data-home="${i}"><option value="">Nothing</option>${opts.map(k => `<option value="${k}" ${X.home.slots[i] === k ? 'selected' : ''}>${esc((FURN.find(f => f[0] === k) || [k, k])[1])}</option>`).join('')}</select></label>`;
  };
  modal({
    title: 'Decorate your room',
    html: `<p class="note">You have ${own.length} of ${FURN.length} pieces. Every third gold stamp you find brings a new one.</p><div class="home-grid">${HOME_SLOTS.map(row).join('')}</div>`,
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
  const X = x28();
  if (ev.target.value) X.home.slots[i] = ev.target.value;
  else delete X.home.slots[i];
  homeApply();
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
  if (typeof DGL === 'undefined' || !DGL.on) {
    toast('Photo mode needs the 3D scene (Settings → Visual effects → Full).');
    return;
  }
  if (U.photo) return;
  U.photo = { f: 'none' };
  document.body.classList.add('photo');
  if (DGL.ui) DGL.ui.style.visibility = 'hidden';
  const el = document.createElement('div');
  el.className = 'photo-ui glass';
  el.id = 'photoUI';
  el.innerHTML = `<div class="ph-row">${PHOTO_FILTERS.map(([k, n]) => `<button class="pb small ${k === 'none' ? 'on' : ''}" data-a="photoF" data-k="${k}">${n}</button>`).join('')}</div>
  <div class="ph-row"><button class="pb small" data-a="photoTurn" data-d="-1" aria-label="Turn left">⟲</button><button class="pb small" data-a="photoZoom" data-d="-1" aria-label="Closer">+</button><button class="pb small" data-a="photoZoom" data-d="1" aria-label="Farther">−</button><button class="pb small" data-a="photoTurn" data-d="1" aria-label="Turn right">⟳</button><button class="pb small" data-a="photoLabels">Labels</button></div>
  <div class="ph-row"><button class="pb gold" data-a="photoShot">${uiIco('camera', 16)} Take photo</button><button class="pb quiet" data-a="photoEnd">Done</button></div>`;
  document.body.appendChild(el);
  photoFilter('none');
}
function photoFilter(k) {
  if (!U.photo) return;
  U.photo.f = k;
  const F = PHOTO_FILTERS.find(f => f[0] === k);
  if (DIO.cv) DIO.cv.style.filter = F ? F[2] : '';
  document.querySelectorAll('[data-a=photoF]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
}
function photoEnd() {
  U.photo = null;
  document.body.classList.remove('photo');
  const el = document.getElementById('photoUI');
  if (el) el.remove();
  if (DIO.cv) DIO.cv.style.filter = '';
  if (DGL.ui) DGL.ui.style.visibility = '';
  if (typeof DGL !== 'undefined') {
    DGL.zoomT = 1;
    DGL.yawT = 0;
  }
}
function photoShot() {
  if (!U.photo || typeof DGL === 'undefined') return;
  if (typeof sfx === 'function') sfx('pop');
  DGL.photoReq = c => {
    if (!c) {
      toast('The picture couldn’t be taken on this device.');
      return;
    }
    const F = PHOTO_FILTERS.find(f => f[0] === U.photo.f),
      o = cnv(c.width, c.height),
      x = o.getContext('2d');
    if (F && F[2]) x.filter = F[2];
    x.drawImage(c, 0, 0);
    x.filter = 'none';
    /* a little caption in the corner */ x.font = `600 ${Math.max(12, Math.round(o.width / 60))}px Chakra Petch, system-ui, sans-serif`;
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.textAlign = 'right';
    x.fillText(`${(DIO.sc && DIO.sc.name) || ''} · Pocket Billies`, o.width - 12, o.height - 12);
    const url = o.toDataURL('image/png'),
      nm = `pocket-billies-${dioBaseId() || 'photo'}-${Date.now()}.png`;
    modal({
      title: 'Your photo',
      html: `<img class="photo-prev" src="${url}" alt="Your photo of ${esc((DIO.sc && DIO.sc.name) || 'the scene')}"><p class="note">Save it, or long-press the picture to share it.</p>`,
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
    DGL.zoomT = clamp(DGL.zoomT + +el.dataset.d * 0.15, eng('camera', 'zoomMin'), eng('camera', 'zoomMax'));
  } else if (a === 'photoTurn') {
    const lim = (eng('camera', 'turn') * Math.PI) / 180;
    DGL.yawT = clamp(DGL.yawT + +el.dataset.d * 0.2, -lim, lim);
  } else if (a === 'photoLabels') {
    if (DGL.ui) DGL.ui.style.visibility = DGL.ui.style.visibility === 'hidden' ? '' : 'hidden';
  } else if (a === 'photoShot') photoShot();
  else if (a === 'photoEnd') photoEnd();
  else if (a === 'chal') chalClaim(el.dataset.i);
  else if (a === 'photo') photoStart();
  else if (a === 'decorate') homeDecorate();
});

/* ---------- battles feel the weather ---------- */
const X28_BWX = {
  rain: { Water: 1.2, Fire: 0.8 },
  storm: { Electric: 1.25, Water: 1.15, Fire: 0.8 },
  snow: { Steel: 1.1, Grass: 0.9 },
  fog: { Psychic: 1.1 },
  ash: { Fire: 1.15, Ground: 1.15, Water: 0.9 },
  sunny: { Fire: 1.15, Grass: 1.1, Water: 0.95 },
  night: { Psychic: 1.15, Dragon: 1.1 },
};
const X28_BWX_TEXT = {
  rain: 'It’s raining: Water moves hit harder and Fire moves fizzle.',
  storm: 'A storm is raging: Electric and Water moves are stronger, Fire weaker.',
  snow: 'Snow is falling: Steel moves are a little stronger, Grass a little weaker.',
  fog: 'In the fog, Psychic moves are a little stronger.',
  ash: 'Ash is falling: Fire and Ground moves hit harder, Water a little weaker.',
  sunny: 'The sun is out: Fire and Grass moves are a little stronger.',
  night: 'It’s night: Psychic and Dragon moves are a little stronger.',
};
function battleWx() {
  if (typeof B === 'undefined' || !B) return null;
  if (B.wx !== undefined) return B.wx;
  if (typeof envState !== 'function' || !ENV.on || (RULES.env && RULES.env.battleOff)) return (B.wx = null);
  const sc = envHere();
  if (!sc || sc.indoor) return (B.wx = null);
  const st = envState(sc),
    k = st.night > 0.5 ? (st.wx === 'clear' ? 'night' : st.wx) : st.wx === 'clear' ? 'sunny' : st.wx,
    m = Object.assign({}, X28_BWX[k] || {}, ((RULES.env || {}).battle || {})[k] || {});
  return (B.wx = Object.keys(m).length ? { k, m } : null);
}
function battleWeatherMult(t) {
  const w = battleWx();
  return (w && w.m[t]) || 1;
}
/* hooks into the rest of the game: a weather line when a battle opens, wins and catches for the challenges, fish landed */
(function () {
  if (typeof openBattle === 'function') {
    const ob = openBattle;
    setOpenBattle(function () {
      try {
        const w = battleWx();
        if (w && X28_BWX_TEXT[w.k]) say(X28_BWX_TEXT[w.k]);
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
        o = B && B.over;
        const f = B && B.sides && B.sides[1] && B.sides[1].team[0];
        types = f ? SP[f.sp].types : null;
        if (B && B.fished && o === 'caught') x28Event('fish');
      } catch (e) {}
      const r = eb.apply(this, arguments);
      try {
        if (o === 'win') x28Event('win');
        if (o === 'caught') x28Event('catch', { types: types || [] });
      } catch (e) {}
      return r;
    });
  }
  if (typeof talkFolk === 'function') {
    const tf = talkFolk;
    setTalkFolk(function (f) {
      if (f && f === reqAsker()) return reqTalk(f);
      return tf.apply(this, arguments);
    });
  }
})();
/* the painted battle stage gets rain, snow, ash or the night drawn over it (the 3D stage has the real thing) */
setInterval(() => {
  const el = document.getElementById('camWorld');
  if (!el) return;
  const w = typeof B !== 'undefined' && B && !(typeof DIO !== 'undefined' && DIO.battle) ? battleWx() : null,
    k = w ? w.k : '';
  if (el.dataset.wx !== k) el.dataset.wx = k;
}, 500);
