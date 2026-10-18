'use strict';
/* ================= DRESSING ROOM =================
   Change your look: body, face, hair and every piece of clothing, with a live preview you can turn around, walk or
   pose. Items you own can be worn; the rest show their price and the boutique that sells them. Inside a boutique
   the same room has a till: try things on and buy what you're wearing. Also the "Create your trainer" step. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { buzz, provide, render, sfx, toast } from './hooks.js';
import { $, $$, rnd } from './util.js';
import { SHOPS } from './game-data.js';
import { U, esc, fmt, save, saveData } from './game-state.js';
import { frameStop, frameTask } from './frame-scheduler.js';
import { makeCanvas, uiIconHTML } from './art.js';
import { TR_PRESETS, WD, cleanLook, portraitHTML, trBox, trColorsOf, trFrame, trSliders } from './person-art.js';
/* eslint-disable no-func-assign */
expose({
  BODY_BUILD_PRESETS: [() => BODY_BUILD_PRESETS],
  DRESSING_TABS: [() => DRESSING_TABS],
  DRESSING_VIEWS: [() => DRESSING_VIEWS],
  FACE_PRESETS: [() => FACE_PRESETS],
  OUTFIT_PRESETS: [() => OUTFIT_PRESETS],
  THUMB_CROPS: [() => THUMB_CROPS],
  bindDressingRoom: [() => bindDressingRoom, v => (bindDressingRoom = v)],
  boutiqueSells: [() => boutiqueSells],
  buyDressingItems: [() => buyDressingItems, v => (buyDressingItems = v)],
  changeLook: [() => changeLook, v => (changeLook = v)],
  closeDressingRoom: [() => closeDressingRoom, v => (closeDressingRoom = v)],
  colorSwatchesHTML: [() => colorSwatchesHTML, v => (colorSwatchesHTML = v)],
  dressingFootHTML: [() => dressingFootHTML, v => (dressingFootHTML = v)],
  dressingMoreHTML: [() => dressingMoreHTML, v => (dressingMoreHTML = v)],
  dressingPreviewLoop: [() => dressingPreviewLoop, v => (dressingPreviewLoop = v)],
  dressingRoom: [() => dressingRoom],
  dressingRoomHTML: [() => dressingRoomHTML, v => (dressingRoomHTML = v)],
  dressingSectionHTML: [() => dressingSectionHTML, v => (dressingSectionHTML = v)],
  dressingTabHTML: [() => dressingTabHTML, v => (dressingTabHTML = v)],
  lookPortrait: [() => lookPortrait, v => (lookPortrait = v)],
  lookThumbnail: [() => lookThumbnail, v => (lookThumbnail = v)],
  lookWithOutfit: [() => lookWithOutfit, v => (lookWithOutfit = v)],
  openDressingRoom: [() => openDressingRoom, v => setOpenDressingRoom(v)],
  owns: [() => owns, v => (owns = v)],
  pushDressingUndo: [() => pushDressingUndo, v => (pushDressingUndo = v)],
  randomizeLook: [() => randomizeLook, v => (randomizeLook = v)],
  refreshDressingRoom: [() => refreshDressingRoom, v => (refreshDressingRoom = v)],
  saveDressingLook: [() => saveDressingLook, v => (saveDressingLook = v)],
  setLookColor: [() => setLookColor, v => (setLookColor = v)],
  shopName: [() => shopName],
  unownedPieces: [() => unownedPieces, v => (unownedPieces = v)],
  wardrobeColorsHTML: [() => wardrobeColorsHTML, v => (wardrobeColorsHTML = v)],
  wardrobeGridHTML: [() => wardrobeGridHTML, v => (wardrobeGridHTML = v)],
  wardrobeItemsInSlot: [() => wardrobeItemsInSlot],
  wardrobeState: [() => wardrobeState],
  wardrobeThumbnail: [() => wardrobeThumbnail, v => (wardrobeThumbnail = v)],
  wearsBuild: [() => wearsBuild, v => (wearsBuild = v)],
  wearsFace: [() => wearsFace, v => (wearsFace = v)],
  wearsOutfit: [() => wearsOutfit, v => (wearsOutfit = v)],
});
/* eslint-enable no-func-assign */
provide({ openDressingRoom });
export function setOpenDressingRoom(v) {
  openDressingRoom = v; // eslint-disable-line no-func-assign
  provide({ openDressingRoom });
}
/* to-module: end */
export const dressingRoom = {
  on: false,
  mode: 'edit',
  shop: null,
  look: null,
  orig: null,
  tab: 'body',
  view: 0,
  walk: false,
  pose: null,
  poseT: 0,
  undo: [],
  redo: [],
  drag: null,
  thumbs: new Map(),
  done: null,
  flash: null,
};
const DRESSING_VIEWS = [
  ['front', 0],
  ['side', 0],
  ['back', 0],
  ['side', 1],
];
/* v40: six choices (body, face, hair, outfit, hat, accessory). Each tab leads with ready-made picks; "More" under it opens
   every piece and colour the wardrobe has, so nothing is lost for the ones who like to fiddle. */
const DRESSING_TABS = [
  ['body', 'Body'],
  ['face', 'Face'],
  ['hair', 'Hair'],
  ['outfit', 'Outfit'],
  ['hat', 'Hat'],
  ['extras', 'Accessory'],
];
const FACE_PRESETS = [
  ['Friendly', { eyes: 'eyes_round', brows: 'brows_soft', mouth: 'mouth_smile', facial: null }],
  ['Bright', { eyes: 'eyes_wide', brows: 'brows_arched', mouth: 'mouth_grin', facial: null }],
  ['Easygoing', { eyes: 'eyes_sleepy', brows: 'brows_soft', mouth: 'mouth_neutral', facial: null }],
  ['Sharp', { eyes: 'eyes_sharp', brows: 'brows_straight', mouth: 'mouth_smirk', facial: null }],
  ['Freckled', { eyes: 'eyes_round', brows: 'brows_soft', mouth: 'mouth_grin', facial: 'facial_freckles' }],
  ['Lashes', { eyes: 'eyes_lashes', brows: 'brows_arched', mouth: 'mouth_smile', facial: null }],
  ['Stubbled', { eyes: 'eyes_sharp', brows: 'brows_thick', mouth: 'mouth_neutral', facial: 'facial_stubble' }],
  ['Bearded', { eyes: 'eyes_sleepy', brows: 'brows_thick', mouth: 'mouth_smile', facial: 'facial_beard' }],
  ['Stern', { eyes: 'eyes_sharp', brows: 'brows_stern', mouth: 'mouth_neutral', facial: null }],
  ['Surprised', { eyes: 'eyes_wide', brows: 'brows_arched', mouth: 'mouth_open', facial: null }],
  ['Moustache', { eyes: 'eyes_round', brows: 'brows_straight', mouth: 'mouth_smirk', facial: 'facial_stache' }],
  ['Goatee', { eyes: 'eyes_sharp', brows: 'brows_thick', mouth: 'mouth_grin', facial: 'facial_goatee' }],
];
/* an outfit is a top, a bottom and shoes (a jacket when it wants one), in three colourways (top colour, bottom colour) */
const OUTFIT_PRESETS = [
  [
    'Everyday',
    { top: 'tee', bottom: 'jeans', shoes: 'sneakers', outer: null },
    [
      ['#3E8FB0', '#2E3A6A'],
      ['#C8323C', '#1E1A22'],
      ['#D9A441', '#7C7058'],
    ],
  ],
  [
    'Summer',
    { top: 'tank', bottom: 'shorts', shoes: 'sandals', outer: null },
    [
      ['#F2EEE4', '#3E8FB0'],
      ['#E07AA4', '#F2EEE4'],
      ['#3F8A63', '#C2A574'],
    ],
  ],
  [
    'Layered',
    { top: 'longsleeve', bottom: 'chinos', shoes: 'boots', outer: null },
    [
      ['#3F8A63', '#C2A574'],
      ['#2E3A6A', '#7C7058'],
      ['#8B4F9E', '#1E1A22'],
    ],
  ],
  [
    'Hoodie',
    { top: 'hoodie', bottom: 'jeans', shoes: 'hightops', outer: null },
    [
      ['#1E1A22', '#2E3A6A'],
      ['#C8323C', '#1E1A22'],
      ['#3E8FB0', '#7C7058'],
    ],
  ],
  [
    'Sporty',
    { top: 'jersey', bottom: 'track_pants', shoes: 'runners', outer: null },
    [
      ['#C8323C', '#1E1A22'],
      ['#3E8FB0', '#F2EEE4'],
      ['#D9A441', '#2E3A6A'],
    ],
  ],
  [
    'Track',
    { top: 'track_top', bottom: 'track_pants', shoes: 'runners', outer: null },
    [
      ['#2E3A6A', '#2E3A6A'],
      ['#E07AA4', '#1E1A22'],
      ['#3F8A63', '#F2EEE4'],
    ],
  ],
  [
    'Smart',
    { top: 'dress_shirt', bottom: 'trousers', shoes: 'oxfords', outer: null },
    [
      ['#F2EEE4', '#1E1A22'],
      ['#3E8FB0', '#2E3A6A'],
      ['#E07AA4', '#7C7058'],
    ],
  ],
  [
    'Suit',
    { top: 'dress_shirt', bottom: 'trousers', shoes: 'oxfords', outer: 'blazer' },
    [
      ['#F2EEE4', '#1E1A22'],
      ['#C2A574', '#7C7058'],
      ['#3E8FB0', '#2E3A6A'],
    ],
  ],
  [
    'Cosy',
    { top: 'sweater', bottom: 'skirt', shoes: 'boots', outer: null },
    [
      ['#C2A574', '#8B4F9E'],
      ['#C8323C', '#1E1A22'],
      ['#3F8A63', '#7C7058'],
    ],
  ],
  [
    'Polo',
    { top: 'polo', bottom: 'chinos', shoes: 'sneakers', outer: null },
    [
      ['#3F8A63', '#C2A574'],
      ['#E07AA4', '#F2EEE4'],
      ['#2E3A6A', '#7C7058'],
    ],
  ],
  [
    'Work',
    { top: 'longsleeve', bottom: 'work_pants', shoes: 'boots', outer: 'apron' },
    [
      ['#7C7058', '#2E3A6A'],
      ['#3E8FB0', '#1E1A22'],
      ['#D9A441', '#7C7058'],
    ],
  ],
  [
    'Tunic',
    { top: 'tunic', bottom: 'leggings', shoes: 'sandals', outer: null },
    [
      ['#8B4F9E', '#1E1A22'],
      ['#3F8A63', '#7C7058'],
      ['#E07AA4', '#2E3A6A'],
    ],
  ],
  [
    'Lab',
    { top: 'tee', bottom: 'trousers', shoes: 'oxfords', outer: 'labcoat' },
    [
      ['#3E8FB0', '#1E1A22'],
      ['#C8323C', '#2E3A6A'],
      ['#D9A441', '#7C7058'],
    ],
  ],
  [
    'Weather',
    { top: 'sweater', bottom: 'jeans', shoes: 'boots', outer: 'puffer' },
    [
      ['#C8323C', '#2E3A6A'],
      ['#D9A441', '#1E1A22'],
      ['#3E8FB0', '#7C7058'],
    ],
  ],
  [
    'Denim',
    { top: 'tee_stripe', bottom: 'jeans', shoes: 'hightops', outer: 'denim_jacket' },
    [
      ['#F2EEE4', '#2E3A6A'],
      ['#C8323C', '#1E1A22'],
      ['#3F8A63', '#7C7058'],
    ],
  ],
  [
    'Trench',
    { top: 'dress_shirt', bottom: 'trousers', shoes: 'oxfords', outer: 'trench' },
    [
      ['#F2EEE4', '#1E1A22'],
      ['#3E8FB0', '#2E3A6A'],
      ['#E07AA4', '#7C7058'],
    ],
  ],
];
dressingRoom.more = {};
const BODY_BUILD_PRESETS = [
  ['Average', {}],
  ['Slim', { body: 0.86, shoulders: 0.94, hips: 0.95 }],
  ['Sturdy', { body: 1.28, shoulders: 1.1, hips: 1.08 }],
  ['Athletic', { body: 1.05, shoulders: 1.16, legs: 1.04 }],
  ['Curvy', { body: 1.08, hips: 1.18, chest: 0.75, shoulders: 0.94 }],
  ['Tall', { height: 1.1, legs: 1.1 }],
  ['Petite', { height: 0.9, legs: 0.94, head: 1.05 }],
];
const wardrobeState = () => saveData.wardrobe || (saveData.wardrobe = { owned: {}, outfits: [null, null, null] });
function owns(id) {
  const it = WD().items[id];
  return !!it && (!!it.starter || !!wardrobeState().owned[id]);
}
const wardrobeItemsInSlot = slot => Object.entries(WD().items).filter(([k, it]) => it.slot === slot);
const shopName = id => (SHOPS[id] && SHOPS[id].name) || 'a boutique';
/* does the open boutique sell this item? its own stock, or (an outlet) the stock of the shops it lists in "sells" */
const boutiqueSells = it =>
  !!(
    dressingRoom.shop &&
    it &&
    (it.shop === dressingRoom.shop || ((SHOPS[dressingRoom.shop] || {}).sells || []).includes(it.shop))
  );
export function openDressingRoom(o = {}) {
  dressingRoom.on = true;
  dressingRoom.mode = o.mode || 'edit';
  dressingRoom.shop = o.shop || null;
  dressingRoom.done = o.done || null;
  dressingRoom.noBack = !!o.noBack;
  const base = o.look || (dressingRoom.mode === 'intro' ? U.trainerDraft || TR_PRESETS[0] : saveData.avatar);
  dressingRoom.look = cleanLook(JSON.parse(JSON.stringify(base)));
  dressingRoom.orig = JSON.stringify(dressingRoom.look);
  dressingRoom.undo = [];
  dressingRoom.redo = [];
  dressingRoom.tab = o.tab || (dressingRoom.shop ? 'outfit' : 'body');
  dressingRoom.more = {};
  dressingRoom.view = 0;
  dressingRoom.walk = false;
  dressingRoom.pose = null;
  dressingRoom.thumbs.clear();
  let el = $('#dressing');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dressing';
    document.body.appendChild(el);
  }
  el.className = 'dr' + (dressingRoom.shop ? ' in-shop' : '') + (dressingRoom.mode === 'intro' ? ' intro' : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', dressingRoom.shop ? shopName(dressingRoom.shop) : 'Dressing room');
  el.innerHTML = dressingRoomHTML();
  el.hidden = false;
  document.body.classList.add('dressing');
  bindDressingRoom();
  frameTask('dress', dressingPreviewLoop);
}
export function closeDressingRoom() {
  dressingRoom.on = false;
  frameStop('dress');
  const el = $('#dressing');
  if (el) {
    el.hidden = true;
    el.innerHTML = '';
  }
  document.body.classList.remove('dressing');
  U.trainerDraft = null;
}
/* ---------- markup ---------- */
function dressingRoomHTML() {
  const sh = dressingRoom.shop && SHOPS[dressingRoom.shop];
  return `<div class="dr-stage"><canvas id="drCv" aria-label="Your trainer. Drag to turn around."></canvas>
  ${sh ? `<div class="dr-keeper glass">${portraitHTML(sh.who || 'clerk', 46, 'happy')}<div><b>${esc(sh.keeper || 'Shopkeeper')}</b><p id="drLine">${esc(sh.greeting || 'Try anything on.')}</p></div></div>` : ''}
  <div class="dr-viewbar glass"><button class="mbtn" data-a="dr-turn" data-d="-1" aria-label="Turn left">‹</button><button class="mbtn" data-a="dr-turn" data-d="1" aria-label="Turn right">›</button>
   <button class="dr-tog" data-a="dr-walk" aria-pressed="false">${uiIconHTML('walk', 14)} Walk</button><button class="dr-tog" data-a="dr-pose" data-p="throw">Throw</button><button class="dr-tog" data-a="dr-pose" data-p="cheer">Cheer</button></div></div>
 <div class="dr-panel px"><div class="dr-top"><label class="dr-name"><span>Name</span><input id="drName" maxlength="18" autocomplete="nickname" value="${esc(dressingRoom.look.name)}"></label>
   <button class="pb small quiet" data-a="dr-rand" title="A random look from what you own">Surprise me</button><button class="mbtn sm" data-a="dr-undo" aria-label="Undo" title="Undo">↶</button><button class="mbtn sm" data-a="dr-redo" aria-label="Redo" title="Redo">↷</button></div>
  <div class="dr-tabs" role="tablist">${DRESSING_TABS.filter(
    ([k]) => !(dressingRoom.mode === 'intro' && k === 'outfits')
  )
    .map(
      ([k, n]) =>
        `<button role="tab" data-a="dr-tab" data-t="${k}" aria-selected="${dressingRoom.tab === k}">${n}</button>`
    )
    .join('')}</div>
  <div class="dr-body" id="drBody">${dressingTabHTML()}</div>
  <div class="dr-foot" id="drFoot">${dressingFootHTML()}</div></div>`;
}
function colorSwatchesHTML(key, list, cur, ch) {
  return `<div class="swatches">${list.map(c => `<button class="swatch" style="--sw:${c}" data-a="dr-col" data-k="${key}" data-c="${c}" ${ch != null ? `data-ch="${ch}"` : ''} aria-pressed="${String(cur).toLowerCase() === c.toLowerCase()}" aria-label="${c}"><span>✓</span></button>`).join('')}<label class="custom-color" title="Any colour">+<input type="color" data-dr-col="${key}" ${ch != null ? `data-ch="${ch}"` : ''} value="${cur}"></label></div>`;
}
function wardrobeGridHTML(slot, crop) {
  const S0 = WD().slots.find(s => s.id === slot),
    cur = dressingRoom.look.wear[slot];
  let list = wardrobeItemsInSlot(slot);
  if (dressingRoom.mode === 'intro') list = list.filter(([k]) => owns(k));
  if (dressingRoom.shop) list.sort((a, b) => boutiqueSells(b[1]) - boutiqueSells(a[1]) || owns(b[0]) - owns(a[0]));
  else list.sort((a, b) => owns(b[0]) - owns(a[0]));
  const none =
    S0 && S0.empty
      ? `<button class="dr-it none" data-a="dr-wear" data-s="${slot}" data-id="" aria-pressed="${!cur}"><span class="dr-th">—</span><b>None</b></button>`
      : '';
  return `<div class="dr-grid">${none}${list
    .map(([k, it]) => {
      const own = owns(k),
        here = boutiqueSells(it);
      return `<button class="dr-it${own ? '' : ' locked'}${here && !own ? ' here' : ''}" data-a="dr-wear" data-s="${slot}" data-id="${k}" aria-pressed="${cur === k}" title="${esc(it.name)}${own ? '' : ` · $${fmt(it.price || 0)} at ${esc(shopName(it.shop))}`}">
  <img class="dr-th" src="${wardrobeThumbnail(slot, k, crop)}" alt=""><b>${esc(it.name)}</b>${own ? '' : `<small>${here ? '' : uiIconHTML('lock', 10)} $${fmt(it.price || 0)}${here ? '' : ` · ${esc(shopName(it.shop))}`}</small>`}</button>`;
    })
    .join('')}</div>`;
}
function wardrobeColorsHTML(slot) {
  const id = dressingRoom.look.wear[slot],
    it = id && WD().items[id];
  if (!it) return '';
  const cur = trColorsOf(dressingRoom.look, id),
    P = WD().palettes || {};
  return it.colors
    .map((c, i) => {
      const ln = it.link && it.link[String(i + 1)];
      if (it.slot === 'hair' || it.slot === 'eyes' || ln) return '';
      return `<div class="dr-row"><span class="dr-l">${esc(c[0])}</span>${colorSwatchesHTML('item:' + id, [c[1]].concat((P.cloth || []).filter(x => x.toLowerCase() !== c[1].toLowerCase())).slice(0, 12), cur[i], i)}</div>`;
    })
    .join('');
}
function dressingSectionHTML(title, html) {
  return `<section class="dr-sec"><h3>${title}</h3>${html}</section>`;
}
function dressingTabHTML() {
  const L = dressingRoom.look,
    P = WD().palettes || {};
  switch (dressingRoom.tab) {
    case 'body':
      return (
        (dressingRoom.mode === 'intro'
          ? dressingSectionHTML(
              'Ready-made looks',
              `<div class="dr-presets">${TR_PRESETS.map((p, j) => `<button class="dr-pre px" data-a="dr-preset" data-i="${j}" aria-label="Look ${j + 1}"><img src="${lookPortrait(Object.assign({}, p, { name: dressingRoom.look.name }))}" alt=""></button>`).join('')}</div><p class="note">Start from one of these, then change anything you like.</p>`
            )
          : '') +
        dressingSectionHTML(
          'Build',
          `<div class="dr-builds">${BODY_BUILD_PRESETS.map(([n, b]) => `<button class="pb small ${wearsBuild(b) ? 'gold' : 'quiet'}" data-a="dr-build" data-b="${n}">${n}</button>`).join('')}</div>`
        ) +
        dressingSectionHTML('Skin', colorSwatchesHTML('skin', P.skin || [], L.skin)) +
        dressingMoreHTML('body', 'Fine-tune the shape', () =>
          trSliders()
            .map(
              s =>
                `<label class="dr-sl"><span>${esc(s.name)}</span><input type="range" min="${s.min}" max="${s.max}" step="0.01" value="${L.body[s.k]}" data-dr-sl="${s.k}"><button class="dr-rs" data-a="dr-slreset" data-k="${s.k}" aria-label="Reset ${esc(s.name)}" title="Reset">↺</button></label>`
            )
            .join('')
        )
      );
    case 'face':
      return (
        dressingSectionHTML(
          'Face',
          `<div class="dr-grid">${FACE_PRESETS.map(([n, f], j) => `<button class="dr-it" data-a="dr-face" data-i="${j}" aria-pressed="${wearsFace(f)}" title="${n}"><img class="dr-th" src="${lookThumbnail(Object.assign(JSON.parse(JSON.stringify(L)), { wear: Object.assign({}, L.wear, f) }), 'face')}" alt=""><b>${n}</b></button>`).join('')}</div>` +
            `<div class="dr-row"><span class="dr-l">Eye colour</span>${colorSwatchesHTML('eyes', P.eyes || [], L.eyes)}</div>`
        ) +
        dressingMoreHTML(
          'face',
          'Every eye, brow and mouth',
          () =>
            dressingSectionHTML('Eyes', wardrobeGridHTML('eyes', 'face')) +
            dressingSectionHTML('Brows', wardrobeGridHTML('brows', 'face')) +
            dressingSectionHTML('Mouth', wardrobeGridHTML('mouth', 'face')) +
            dressingSectionHTML(
              'Facial hair & freckles',
              wardrobeGridHTML('facial', 'face') + wardrobeColorsHTML('facial')
            )
        )
      );
    case 'hair':
      return (
        dressingSectionHTML('Hairstyle', wardrobeGridHTML('hair', 'head')) +
        dressingSectionHTML(
          'Hair colour',
          colorSwatchesHTML('hair', P.hair || [], L.hair) +
            '<p class="note">Brows and facial hair follow your hair colour.</p>'
        )
      );
    case 'outfit': {
      const W = WD().items,
        O = wardrobeState().outfits;
      let list = OUTFIT_PRESETS.filter(([n, o]) => Object.values(o).every(id => !id || W[id]));
      if (dressingRoom.mode === 'intro') list = list.filter(([n, o]) => Object.values(o).every(id => !id || owns(id)));
      return (
        dressingSectionHTML(
          'Outfit',
          `<div class="dr-grid dr-outgrid">${list
            .map(([n, o, ways]) => {
              const own = Object.values(o).every(id => !id || owns(id)),
                cost = Object.values(o)
                  .filter(id => id && !owns(id))
                  .reduce((a, id) => a + (W[id].price || 0), 0);
              return `<div class="dr-it dr-outfit${own ? '' : ' locked'}" aria-pressed="${wearsOutfit(o)}"><button class="dr-outmain" data-a="dr-outfit" data-n="${esc(n)}" data-w="0" title="${n}"><img class="dr-th" src="${lookThumbnail(lookWithOutfit(L, o, ways[0]), 'body')}" alt=""><b>${n}</b>${own ? '' : `<small>${uiIconHTML('lock', 10)} $${fmt(cost)}</small>`}</button>
     <span class="dr-ways">${ways.map((w, k) => `<button class="swatch" style="--sw:${w[0]}" data-a="dr-outfit" data-n="${esc(n)}" data-w="${k}" aria-label="${n}, colourway ${k + 1}"><span>✓</span></button>`).join('')}</span></div>`;
            })
            .join('')}</div>`
        ) +
        (dressingRoom.mode === 'intro'
          ? ''
          : dressingSectionHTML(
              'Saved outfits',
              `<div class="dr-outfits">${[0, 1, 2]
                .map(i => {
                  const o = O[i];
                  return `<div class="dr-out px">${o ? `<img src="${lookPortrait(o)}" alt="">` : '<span class="dr-empty">Empty</span>'}<b>${o ? esc(o.name || 'Outfit ' + (i + 1)) : 'Outfit ' + (i + 1)}</b><div class="racts"><button class="pb small" data-a="dr-osave" data-i="${i}">Save current here</button>${o ? `<button class="pb small gold" data-a="dr-owear" data-i="${i}">Wear</button>` : ''}</div></div>`;
                })
                .join('')}</div>`
            )) +
        dressingMoreHTML(
          'outfit',
          'Every top, bottom, jacket and shoe',
          () =>
            dressingSectionHTML('Top', wardrobeGridHTML('top', 'body') + wardrobeColorsHTML('top')) +
            dressingSectionHTML('Jacket & coat', wardrobeGridHTML('outer', 'body') + wardrobeColorsHTML('outer')) +
            dressingSectionHTML('Bottoms', wardrobeGridHTML('bottom', 'legs') + wardrobeColorsHTML('bottom')) +
            dressingSectionHTML('Shoes', wardrobeGridHTML('shoes', 'feet') + wardrobeColorsHTML('shoes'))
        )
      );
    }
    case 'hat':
      return dressingSectionHTML('Hat', wardrobeGridHTML('hat', 'head') + wardrobeColorsHTML('hat'));
    case 'extras':
      return (
        dressingSectionHTML('Glasses', wardrobeGridHTML('glasses', 'face') + wardrobeColorsHTML('glasses')) +
        dressingSectionHTML('Neck', wardrobeGridHTML('neck', 'body') + wardrobeColorsHTML('neck')) +
        dressingSectionHTML('Bag', wardrobeGridHTML('bag', 'body') + wardrobeColorsHTML('bag'))
      );
  }
  return '';
}
function dressingMoreHTML(tab, label, fn) {
  const open = !!dressingRoom.more[tab];
  return `<section class="dr-sec dr-more"><button class="pb small ${open ? '' : 'quiet'} dr-moreb" data-a="dr-more" data-t="${tab}" aria-expanded="${open}">${open ? 'Less' : 'More'} · ${label}</button>${open ? fn() : ''}</section>`;
}
function wearsBuild(b) {
  const L = dressingRoom.look.body;
  return trSliders().every(s => s.k === 'chest' || Math.abs((L[s.k] ?? s.def) - (b[s.k] ?? s.def)) < 0.005);
}
function wearsFace(f) {
  return ['eyes', 'brows', 'mouth', 'facial'].every(k => (dressingRoom.look.wear[k] || null) === (f[k] || null));
}
function wearsOutfit(o) {
  return ['top', 'bottom', 'shoes', 'outer'].every(k => (dressingRoom.look.wear[k] || null) === (o[k] || null));
}
function lookWithOutfit(L, o, way) {
  const L2 = JSON.parse(JSON.stringify(L));
  Object.assign(L2.wear, o);
  const W = WD().items;
  for (const [k, ci] of [
    ['top', 0],
    ['bottom', 1],
    ['outer', 0],
  ]) {
    const id = o[k];
    if (!id || !W[id]) continue;
    const cols = W[id].colors.map(c => c[1]);
    cols[0] = way[ci];
    L2.colors[id] = cols;
  }
  return cleanLook(L2);
}
function lookThumbnail(L2, crop) {
  const key =
    'look|' + crop + '|' + JSON.stringify([L2.wear, L2.colors, L2.skin, L2.hair, L2.eyes, L2.body.body, L2.body.chest]);
  if (dressingRoom.thumbs.has(key)) return dressingRoom.thumbs.get(key);
  L2.body.height = 1;
  if (crop !== 'body') L2.wear.hat = null;
  const f = trFrame(L2, 'front', 'idle', 0, 0),
    [x0, y0, x1, y1] = THUMB_CROPS[crop] || THUMB_CROPS.body,
    w = x1 - x0,
    h = y1 - y0,
    c = makeCanvas(w, h),
    x = c.getContext('2d');
  x.drawImage(f, f.ax + x0, f.ay + y0, w, h, 0, 0, w, h);
  const u = c.toDataURL();
  dressingRoom.thumbs.set(key, u);
  return u;
}
function unownedPieces() {
  return Object.values(dressingRoom.look.wear).filter(id => id && !owns(id));
}
function dressingFootHTML() {
  const un = unownedPieces(),
    W = WD().items,
    cost = un.filter(id => boutiqueSells(W[id])).reduce((a, id) => a + (W[id].price || 0), 0),
    elsewhere = un.filter(id => !boutiqueSells(W[id]));
  let msg = '',
    btn = '';
  if (dressingRoom.mode === 'intro') {
    msg = 'More clothes and hairstyles are sold in the town boutiques.';
    btn = `<button class="pb gold" data-a="dr-save">This is me</button>`;
  } else if (dressingRoom.shop) {
    msg = elsewhere.length
      ? `${esc(W[elsewhere[0]].name)} is sold at ${esc(shopName(W[elsewhere[0]].shop))}.`
      : cost
        ? `You have $${fmt(saveData.se)}.`
        : 'Pick anything to try it on.';
    btn = cost
      ? `<button class="pb gold" data-a="dr-buy" ${saveData.se >= cost && !elsewhere.length ? '' : 'disabled'}>Buy and wear · $${fmt(cost)}</button>`
      : `<button class="pb gold" data-a="dr-save" ${elsewhere.length ? 'disabled' : ''}>Wear this</button>`;
  } else {
    msg = un.length
      ? `Trying on ${esc(W[un[0]].name)}${un.length > 1 ? ` and ${un.length - 1} more` : ''}. Buy ${un.length > 1 ? 'them' : 'it'} at ${esc(shopName(W[un[0]].shop))}.`
      : '';
    btn = `<button class="pb gold" data-a="dr-save" ${un.length ? 'disabled' : ''}>Save look</button>`;
  }
  return `<span class="dr-msg">${msg}</span>${dressingRoom.noBack ? '' : `<button class="pb quiet" data-a="dr-cancel">${dressingRoom.mode === 'intro' ? 'Back' : dressingRoom.shop ? 'Leave' : 'Cancel'}</button>`}${btn}`;
}
/* ---------- thumbnails and portraits ---------- */
const THUMB_CROPS = new Proxy({}, { get: (t, k) => (WD().crops || {})[k] });
function wardrobeThumbnail(slot, id, crop) {
  const L = JSON.parse(JSON.stringify(dressingRoom.look));
  L.wear[slot] = id;
  L.body.height = 1;
  if (slot !== 'hat' && crop === 'head') L.wear.hat = null;
  const key =
    slot +
    '|' +
    id +
    '|' +
    crop +
    '|' +
    JSON.stringify([
      L.skin,
      L.hair,
      L.eyes,
      L.colors[id] || 0,
      L.wear.top,
      L.wear.bottom,
      L.body.chest,
      L.body.body,
      L.wear.hair,
      L.wear.eyes,
    ]);
  if (dressingRoom.thumbs.has(key)) return dressingRoom.thumbs.get(key);
  const f = trFrame(L, 'front', 'idle', 0, 0),
    [x0, y0, x1, y1] = THUMB_CROPS[crop] || THUMB_CROPS.body,
    w = x1 - x0,
    h = y1 - y0,
    c = makeCanvas(w, h),
    x = c.getContext('2d');
  x.drawImage(f, f.ax + x0, f.ay + y0, w, h, 0, 0, w, h);
  const u = c.toDataURL();
  dressingRoom.thumbs.set(key, u);
  return u;
}
export function lookPortrait(look) {
  const L = cleanLook(look),
    f = trFrame(L, 'front', 'idle', 0, 0),
    b = trBox(f),
    c = makeCanvas(b[2] + 2, b[3] + 2);
  c.getContext('2d').drawImage(f, b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2, 0, 0, b[2] + 2, b[3] + 2);
  return c.toDataURL();
}
/* ---------- the preview ---------- */
function dressingPreviewLoop(ts) {
  const cv = $('#drCv');
  if (!dressingRoom.on || !cv || !cv.isConnected) {
    frameStop('dress');
    return;
  }
  const r = cv.getBoundingClientRect();
  if (r.width < 10) return;
  const dpr = Math.min(2, devicePixelRatio || 1),
    W = Math.round(r.width * dpr),
    H = Math.round(r.height * dpr);
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, W, H);
  const [view, mir] = DRESSING_VIEWS[dressingRoom.view],
    t = ts;
  let act = 'idle',
    ph = 0;
  if (dressingRoom.pose) {
    const k = (t - dressingRoom.poseT) / (dressingRoom.pose === 'throw' ? 700 : 1400);
    if (k >= 1) dressingRoom.pose = null;
    else {
      act = dressingRoom.pose;
      ph = k;
    }
  } else if (dressingRoom.walk) {
    act = 'walk';
    ph = (t / 760) % 1;
  }
  const f = trFrame(dressingRoom.look, view, act, ph, t, mir),
    s = Math.max(
      1,
      Math.floor(
        Math.min(
          (H * 0.8) / ((WD().figure || 74) * 1.18 * dressingRoom.look.body.height),
          (W * 0.8) / ((WD().figure || 74) * 0.6)
        ) * 2
      ) / 2
    );
  x.imageSmoothingEnabled = false;
  const fx = Math.round(W / 2 - f.ax * s),
    fy = Math.round(H * 0.93 - f.ay * s);
  x.fillStyle = 'rgba(20,14,40,.18)';
  x.beginPath();
  x.ellipse(W / 2, H * 0.93, 22 * s * 0.5, 5 * s * 0.5, 0, 0, 7);
  x.fill();
  x.drawImage(f, fx, fy, f.width * s, f.height * s);
}
/* ---------- changes ---------- */
function pushDressingUndo() {
  dressingRoom.undo.push(JSON.stringify(dressingRoom.look));
  if (dressingRoom.undo.length > 60) dressingRoom.undo.shift();
  dressingRoom.redo = [];
}
function refreshDressingRoom(full) {
  const b = $('#drBody');
  if (b && full !== false) {
    const y = b.scrollTop;
    b.innerHTML = dressingTabHTML();
    b.scrollTop = y;
  }
  const f = $('#drFoot');
  if (f) f.innerHTML = dressingFootHTML();
}
function changeLook(fn, full) {
  pushDressingUndo();
  fn(dressingRoom.look);
  dressingRoom.look = cleanLook(dressingRoom.look);
  refreshDressingRoom(full);
}
function randomizeLook() {
  const P = WD().palettes || {},
    pk = a => a[Math.floor(rnd() * a.length)];
  changeLook(L => {
    for (const s of WD().slots) {
      const ids = wardrobeItemsInSlot(s.id)
        .map(e => e[0])
        .filter(owns);
      if (
        s.empty &&
        rnd() <
          (['hair', 'eyes', 'mouth'].includes(s.id)
            ? 0.05
            : ['facial', 'glasses', 'neck', 'hat', 'outer'].includes(s.id)
              ? 0.65
              : 0.2)
      )
        L.wear[s.id] = null;
      else if (ids.length) L.wear[s.id] = pk(ids);
    }
    L.hair = pk(P.hair || [L.hair]);
    L.eyes = pk(P.eyes || [L.eyes]);
    for (const k of ['top', 'outer', 'bottom', 'shoes', 'hat', 'bag']) {
      const id = L.wear[k];
      if (id) L.colors[id] = WD().items[id].colors.map((c, i) => (i ? c[1] : pk(P.cloth || [c[1]])));
    }
  });
}
export function saveDressingLook() {
  const un = unownedPieces();
  if (un.length && dressingRoom.mode !== 'intro') {
    toast('Buy the pieces you’re trying on first.');
    return;
  }
  if (dressingRoom.mode === 'intro') {
    U.trainerDraft = cleanLook(dressingRoom.look);
    U.avatarDraft = U.trainerDraft;
    const done = dressingRoom.done;
    dressingRoom.on = false;
    frameStop('dress');
    const el = $('#dressing');
    if (el) {
      el.hidden = true;
      el.innerHTML = '';
    }
    document.body.classList.remove('dressing');
    if (done) done();
    return;
  }
  saveData.avatar = cleanLook(dressingRoom.look);
  save();
  const shop = dressingRoom.shop;
  closeDressingRoom();
  render();
  toast(shop ? 'Looking sharp.' : 'Your new look is saved.');
}
function buyDressingItems() {
  const W = WD().items,
    un = unownedPieces(),
    mine = un.filter(id => boutiqueSells(W[id])),
    cost = mine.reduce((a, id) => a + (W[id].price || 0), 0);
  if (un.length > mine.length) return;
  if (saveData.se < cost) {
    toast('Not enough money. Walk a little first.');
    return;
  }
  saveData.se -= cost;
  if (typeof sfx === 'function') sfx('buy');
  const st = wardrobeState();
  for (const id of mine) st.owned[id] = 1;
  save();
  buzz && buzz(12);
  const sh = SHOPS[dressingRoom.shop],
    lines =
      sh && sh.thanks && sh.thanks.length
        ? sh.thanks
        : ['Wear it well.', 'That suits you.', 'A classic. Well, a classic now.'];
  const l = $('#drLine');
  if (l) l.textContent = lines[Math.floor(rnd() * lines.length)];
  toast(`Bought ${mine.map(id => W[id].name).join(', ')}.`);
  saveData.avatar = cleanLook(dressingRoom.look);
  save();
  dressingRoom.orig = JSON.stringify(dressingRoom.look);
  refreshDressingRoom();
}
function bindDressingRoom() {
  const el = $('#dressing'),
    cv = $('#drCv');
  cv.addEventListener('pointerdown', e => {
    dressingRoom.drag = { x: e.clientX, v: dressingRoom.view };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!dressingRoom.drag) return;
    const d = Math.round((e.clientX - dressingRoom.drag.x) / 60);
    dressingRoom.view = (((dressingRoom.drag.v - d) % 4) + 4) % 4;
  });
  cv.addEventListener('pointerup', () => {
    dressingRoom.drag = null;
  });
  cv.addEventListener('pointercancel', () => {
    dressingRoom.drag = null;
  });
  el.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'drName') {
      dressingRoom.look.name = t.value.slice(0, 18);
      return;
    }
    if (t.dataset.drSl) {
      const k = t.dataset.drSl;
      if (!dressingRoom.slT) {
        pushDressingUndo();
        dressingRoom.slT = 1;
      }
      dressingRoom.look.body[k] = +t.value;
      dressingRoom.look = cleanLook(dressingRoom.look);
    }
    if (t.dataset.drCol) setLookColor(t.dataset.drCol, t.value, t.dataset.ch, false);
  });
  el.addEventListener('change', e => {
    if (e.target.dataset.drSl) {
      dressingRoom.slT = 0;
      dressingRoom.thumbs.clear();
      refreshDressingRoom();
    }
    if (e.target.dataset.drCol) refreshDressingRoom();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape' && dressingRoom.mode !== 'intro' && !dressingRoom.noBack) {
      e.stopPropagation();
      closeDressingRoom();
    }
  });
}
function setLookColor(key, c, ch, refresh = true) {
  pushDressingUndo();
  const L = dressingRoom.look;
  if (key === 'skin' || key === 'hair' || key === 'eyes') L[key] = c;
  else if (key.startsWith('item:')) {
    const id = key.slice(5),
      cur = trColorsOf(L, id);
    cur[+ch] = c;
    L.colors[id] = cur;
  }
  dressingRoom.look = cleanLook(L);
  if (refresh) refreshDressingRoom();
}
document.addEventListener('click', ev => {
  if (!dressingRoom.on) return;
  const el = ev.target.closest('[data-a]');
  if (!el || !el.closest('#dressing')) return;
  const d = el.dataset;
  switch (d.a) {
    case 'dr-tab':
      dressingRoom.tab = d.t;
      $$('#dressing [data-a=dr-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === d.t)));
      refreshDressingRoom();
      $('#drBody').scrollTop = 0;
      break;
    case 'dr-wear':
      changeLook(L => {
        L.wear[d.s] = d.id || null;
      });
      if (d.id && !owns(d.id) && boutiqueSells(WD().items[d.id])) {
        const l = $('#drLine');
        if (l) l.textContent = `${WD().items[d.id].name}? Good eye. $${fmt(WD().items[d.id].price || 0)}.`;
      }
      break;
    case 'dr-col':
      setLookColor(d.k, d.c, d.ch);
      break;
    case 'dr-more':
      dressingRoom.more[d.t] = !dressingRoom.more[d.t];
      refreshDressingRoom();
      break;
    case 'dr-face':
      {
        const f = FACE_PRESETS[+d.i];
        if (f)
          changeLook(L => {
            Object.assign(L.wear, f[1]);
          });
      }
      break;
    case 'dr-outfit':
      {
        const o = OUTFIT_PRESETS.find(x => x[0] === d.n);
        if (o) {
          const way = o[2][+d.w] || o[2][0];
          changeLook(L => {
            const L2 = lookWithOutfit(L, o[1], way);
            L.wear = L2.wear;
            L.colors = L2.colors;
          });
          const un = Object.values(o[1]).filter(id => id && !owns(id) && boutiqueSells(WD().items[id]));
          if (un.length) {
            const l = $('#drLine');
            if (l)
              l.textContent = `${o[0]}? Good eye. $${fmt(un.reduce((a, id) => a + (WD().items[id].price || 0), 0))}.`;
          }
        }
      }
      break;
    case 'dr-build':
      {
        const b = BODY_BUILD_PRESETS.find(x => x[0] === d.b);
        if (b)
          changeLook(L => {
            for (const s of trSliders()) if (s.k !== 'chest') L.body[s.k] = s.def;
            Object.assign(L.body, b[1]);
          });
      }
      break;
    case 'dr-slreset':
      {
        const s = trSliders().find(x => x.k === d.k);
        if (s)
          changeLook(L => {
            L.body[s.k] = s.def;
          });
      }
      break;
    case 'dr-turn':
      dressingRoom.view = (((dressingRoom.view + +d.d) % 4) + 4) % 4;
      break;
    case 'dr-walk':
      dressingRoom.walk = !dressingRoom.walk;
      el.setAttribute('aria-pressed', String(dressingRoom.walk));
      break;
    case 'dr-pose':
      dressingRoom.pose = d.p;
      dressingRoom.poseT = performance.now();
      break;
    case 'dr-rand':
      randomizeLook();
      break;
    case 'dr-preset':
      {
        const p = TR_PRESETS[+d.i];
        if (p)
          changeLook(L => {
            const n = L.name;
            Object.assign(L, JSON.parse(JSON.stringify(cleanLook(p))));
            L.name = n;
          });
      }
      break;
    case 'dr-undo':
      if (dressingRoom.undo.length) {
        dressingRoom.redo.push(JSON.stringify(dressingRoom.look));
        dressingRoom.look = JSON.parse(dressingRoom.undo.pop());
        refreshDressingRoom();
      }
      break;
    case 'dr-redo':
      if (dressingRoom.redo.length) {
        dressingRoom.undo.push(JSON.stringify(dressingRoom.look));
        dressingRoom.look = JSON.parse(dressingRoom.redo.pop());
        refreshDressingRoom();
      }
      break;
    case 'dr-osave':
      {
        const st = wardrobeState();
        st.outfits[+d.i] = JSON.parse(JSON.stringify(dressingRoom.look));
        save();
        refreshDressingRoom();
        toast('Outfit saved.');
      }
      break;
    case 'dr-owear':
      {
        const o = wardrobeState().outfits[+d.i];
        if (o)
          changeLook(L => {
            const n = L.name;
            Object.assign(L, JSON.parse(JSON.stringify(o)));
            L.name = n;
          });
      }
      break;
    case 'dr-save':
      saveDressingLook();
      break;
    case 'dr-buy':
      buyDressingItems();
      break;
    case 'dr-cancel':
      if (dressingRoom.mode === 'intro') {
        U.trainerDraft = cleanLook(dressingRoom.look);
        dressingRoom.on = false;
        frameStop('dress');
        const e2 = $('#dressing');
        if (e2) {
          e2.hidden = true;
          e2.innerHTML = '';
        }
        document.body.classList.remove('dressing');
        render();
        break;
      }
      closeDressingRoom();
      break;
  }
});
