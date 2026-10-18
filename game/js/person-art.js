'use strict';
/* ================= TRAINERS =================
   People are built like the billionaires: a skeleton (art/rigs.js style bones, here in game data: wardrobe.skeleton,
   one per view: front, back, side) with pictures on the bones, drawn and animated by skeleton-rig.js. The pictures are the
   body plus every item worn (hair, face, clothes, hat, glasses, neckwear, bag), each recoloured from its colour-area
   mask, and stretched by the body sliders (height, legs, arms, body, shoulders, hips, chest, head).
   A look: {name, body:{…sliders}, skin, hair, eyes, wear:{slot:itemId|null}, colors:{itemId:[hex,…]}}. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  PEOPLE,
  artCacheVersion,
  artImage,
  cleanName,
  drawRig,
  frameBudgetLeft,
  friends,
  gameData,
  provide,
  saveData,
  studioState,
  uiState,
} from './hooks.js';
import { clamp } from './util.js';
import { frameStop, frameTask } from './frame-scheduler.js';
import { ART_CACHE, artImg, hexToRgb, makeCanvas } from './art.js';
/* eslint-disable no-func-assign */
expose({
  TRW: [() => TRW],
  TR_CACHE: [() => TR_CACHE],
  TR_CACHE_MAX: [() => TR_CACHE_MAX],
  TR_DEFAULT_WEAR: [() => TR_DEFAULT_WEAR],
  TR_HEX: [() => TR_HEX],
  TR_PRESETS: [() => TR_PRESETS],
  TR_SLOTS: [() => TR_SLOTS],
  WD: [() => WD],
  cleanLook: [() => cleanLook, v => (cleanLook = v)],
  cleanTrainer: [() => cleanTrainer, v => (cleanTrainer = v)],
  folkFrames: [() => folkFrames],
  folkLook: [() => folkLook, v => (folkLook = v)],
  hsl2rgb: [() => hsl2rgb, v => (hsl2rgb = v)],
  humanFrames: [() => humanFrames, v => setHumanFrames(v)],
  humanHTML: [() => humanHTML, v => (humanHTML = v)],
  humanPose: [() => humanPose, v => (humanPose = v)],
  humanSheet: [() => humanSheet, v => (humanSheet = v)],
  lookFromOld: [() => lookFromOld, v => (lookFromOld = v)],
  owFrames: [() => owFrames, v => (owFrames = v)],
  owHTMLsheet: [() => owHTMLsheet, v => (owHTMLsheet = v)],
  portraitHTML: [() => portraitHTML, v => (portraitHTML = v)],
  portraitURL: [() => portraitURL, v => (portraitURL = v)],
  rgb2hsl: [() => rgb2hsl, v => (rgb2hsl = v)],
  trAnim: [() => trAnim, v => (trAnim = v)],
  trBoneScale: [() => trBoneScale, v => (trBoneScale = v)],
  trBox: [() => trBox, v => (trBox = v)],
  trColorsOf: [() => trColorsOf, v => (trColorsOf = v)],
  trFrame: [() => trFrame, v => (trFrame = v)],
  trHeadAt: [() => trHeadAt, v => (trHeadAt = v)],
  trImg: [() => trImg, v => (trImg = v)],
  trKind: [() => trKind],
  trLookKey: [() => trLookKey, v => (trLookKey = v)],
  trOk: [() => trOk],
  trPick: [() => trPick, v => (trPick = v)],
  trPiece: [() => trPiece, v => (trPiece = v)],
  trPix: [() => trPix, v => (trPix = v)],
  trPortrait: [() => trPortrait, v => (trPortrait = v)],
  trPortraitRect: [() => trPortraitRect, v => (trPortraitRect = v)],
  trReady: [() => trReady, v => (trReady = v)],
  trRig: [() => trRig, v => (trRig = v)],
  trScale: [() => trScale, v => (trScale = v)],
  trSliders: [() => trSliders, v => (trSliders = v)],
  trVer: [() => trVer],
  trWarm: [() => trWarm, v => (trWarm = v)],
  trWarmStep: [() => trWarmStep, v => (trWarmStep = v)],
  trainerArtPaths: [() => trainerArtPaths, v => (trainerArtPaths = v)],
  trainerCache: [() => trainerCache, v => (trainerCache = v)],
  trainerDesign: [() => trainerDesign],
  trainerLook: [() => trainerLook, v => (trainerLook = v)],
});
/* eslint-enable no-func-assign */
export function setHumanFrames(v) {
  humanFrames = v; // eslint-disable-line no-func-assign
  provide({ humanFrames });
}
/* to-module: end */
export const WD = () =>
  (typeof gameData !== 'undefined' && gameData.wardrobe) ||
  (typeof studioState !== 'undefined' && studioState.D && studioState.D.wardrobe) ||
  null;
const TR_SLOTS = () => (WD() || {}).slots || [];
const TR_HEX = /^#[0-9a-f]{6}$/i;
const TR_DEFAULT_WEAR = {
  hair: 'hair_short',
  eyes: 'eyes_round',
  brows: 'brows_soft',
  mouth: 'mouth_smile',
  facial: null,
  top: 'tee',
  outer: null,
  bottom: 'jeans',
  shoes: 'sneakers',
  hat: null,
  glasses: null,
  neck: null,
  bag: 'backpack',
};
/* ready-made looks for a new game and for townsfolk */
export const TR_PRESETS = [
  {
    name: 'Trainer',
    body: { chest: 0.05, shoulders: 1.06 },
    skin: '#E6B08A',
    hair: '#3B2A22',
    eyes: '#4A7BBB',
    wear: { hair: 'hair_short', top: 'tee', bottom: 'jeans', shoes: 'sneakers', bag: 'backpack', hat: 'hat_cap' },
    colors: { tee: ['#3E8FB0'], hat_cap: ['#D9434B', '#A8323A'] },
  },
  {
    name: 'Trainer',
    body: { chest: 0.55, hips: 1.08, shoulders: 0.94 },
    skin: '#F0C3A0',
    hair: '#6A3A24',
    eyes: '#3F8A63',
    wear: { hair: 'hair_pony', top: 'tee', bottom: 'skirt', shoes: 'sneakers', bag: 'backpack', eyes: 'eyes_lashes' },
    colors: { tee: ['#8B4F9E'], skirt: ['#2E3A6A'] },
  },
  {
    name: 'Trainer',
    body: { chest: 0.1, body: 1.12 },
    skin: '#9A6446',
    hair: '#1E1A22',
    eyes: '#5A3A24',
    wear: { hair: 'hair_curly', top: 'hoodie', bottom: 'jeans', shoes: 'hightops', bag: 'backpack' },
    colors: { hoodie: ['#E0703A', '#F2EEE4'] },
  },
  {
    name: 'Trainer',
    body: { chest: 0.45, height: 0.96 },
    skin: '#D49A6E',
    hair: '#1E1A22',
    eyes: '#5A3A24',
    wear: {
      hair: 'hair_bob',
      top: 'longsleeve',
      bottom: 'shorts',
      shoes: 'boots',
      bag: 'backpack',
      glasses: 'glasses_round',
    },
    colors: { longsleeve: ['#3F8A63'] },
  },
  {
    name: 'Trainer',
    body: { chest: 0, height: 1.05, shoulders: 1.1 },
    skin: '#F7D9C4',
    hair: '#E2B84A',
    eyes: '#4A7BBB',
    wear: {
      hair: 'hair_spiky',
      top: 'tee',
      bottom: 'shorts',
      shoes: 'sneakers',
      bag: 'backpack',
      brows: 'brows_thick',
    },
    colors: { tee: ['#E8C34A'] },
  },
  {
    name: 'Trainer',
    body: { chest: 0.35 },
    skin: '#7A4A34',
    hair: '#5A3A2A',
    eyes: '#3F8A63',
    wear: { hair: 'hair_long', top: 'sweater', bottom: 'chinos', shoes: 'boots', bag: 'backpack' },
    colors: { sweater: ['#C8323C'] },
  },
];
export function trSliders() {
  return (WD() || {}).sliders || [];
}
export function cleanLook(L, fallback) {
  const W = WD(),
    I = W ? W.items : {},
    given = !!(L && typeof L === 'object'),
    base = given ? { wear: {}, colors: {}, body: {} } : fallback || TR_PRESETS[0],
    fb = fallback || TR_PRESETS[0],
    out = { name: 'Trainer', body: {}, skin: fb.skin, hair: fb.hair, eyes: fb.eyes, wear: {}, colors: {} };
  if (!given) L = fb;
  out.name =
    typeof L.name === 'string' && L.name.trim()
      ? (typeof cleanName === 'function' ? cleanName(L.name, 18) : L.name.trim().slice(0, 18)) || 'Trainer'
      : 'Trainer';
  for (const s of trSliders()) {
    const v = +(L.body || {})[s.k];
    out.body[s.k] = Number.isFinite(v)
      ? clamp(v, s.min, s.max)
      : base.body && base.body[s.k] != null
        ? base.body[s.k]
        : s.def;
  }
  for (const k of ['skin', 'hair', 'eyes']) if (TR_HEX.test(L[k] || '')) out[k] = L[k];
  for (const s of TR_SLOTS()) {
    let id =
      L.wear && s.id in L.wear
        ? L.wear[s.id]
        : base.wear && s.id in base.wear
          ? base.wear[s.id]
          : TR_DEFAULT_WEAR[s.id];
    if (id && (!I[id] || I[id].slot !== s.id)) id = TR_DEFAULT_WEAR[s.id];
    if (!id && !s.empty) id = TR_DEFAULT_WEAR[s.id] || Object.keys(I).find(k => I[k].slot === s.id) || null;
    out.wear[s.id] = id || null;
  }
  const cs = Object.assign({}, base.colors || {}, L.colors || {});
  for (const [id, arr] of Object.entries(cs))
    if (I[id] && Array.isArray(arr))
      out.colors[id] = arr
        .map((c, i) => (TR_HEX.test(c || '') ? c : I[id].colors[i] ? I[id].colors[i][1] : '#888888'))
        .slice(0, I[id].colors.length);
  return out;
}
/* older saves and people: hairstyle names, a jacket colour, cap or glasses */
export function lookFromOld(o, gender) {
  if (o && o.wear) return cleanLook(o);
  o = o || {};
  const girl = gender === 'girl' || o.style === 'pony' || (o.style === 'bob' && !o.stache);
  const hairMap = {
      swept: 'hair_short',
      spiky: 'hair_spiky',
      bob: 'hair_bob',
      pony: 'hair_pony',
      bun: 'hair_bun',
      beanie: 'hair_short',
      cowboy: 'hair_short',
    },
    w = { hair: hairMap[o.style] || 'hair_short' },
    c = {};
  if (o.coat) {
    w.outer = 'labcoat';
  }
  if (o.apron) {
    w.outer = 'apron';
    c.apron = [o.top2 || '#3E8A6E', '#2A6450'];
  }
  w.top = o.tank
    ? 'tank'
    : o.coat || o.apron
      ? 'longsleeve'
      : o.who === 'concierge' || (o.style === 'swept' && o.top === '#2E3A6A')
        ? 'dress_shirt'
        : 'tee';
  c[w.top] = [o.top || '#3E8FB0'];
  w.bottom = o.shorts ? 'shorts' : 'jeans';
  c[w.bottom] = [o.bottom || '#3F5F94'];
  if (o.shoe) {
    w.shoes = 'sneakers';
    c.sneakers = [o.shoe, '#F2F0EA'];
  }
  if (o.style === 'beanie') {
    w.hat = 'hat_beanie';
    c.hat_beanie = [o.hat || '#2A9D8F', o.hat2 || '#1D6F66'];
  } else if (o.style === 'cowboy') {
    w.hat = 'hat_cowboy';
    c.hat_cowboy = [o.hat || '#8A5A30', o.hat2 || '#3E2414'];
  } else if (o.hat) {
    w.hat = 'hat_hardhat';
    c.hat_hardhat = [o.hat];
  } else if (o.accessory === 'cap') {
    w.hat = 'hat_cap';
    c.hat_cap = [o.top || '#2F6FB8', '#24518A'];
  }
  if (o.glasses || o.accessory === 'glasses') w.glasses = 'glasses_round';
  if (o.headset) w.glasses = 'headset';
  if (o.stache) w.facial = 'facial_stache';
  if (o.tie) {
    w.neck = 'tie';
    c.tie = [o.tie];
  }
  if (o.tag) w.neck = 'nametag';
  if (o.pack) {
    w.bag = 'backpack';
    c.backpack = [o.pack, '#8A5A2A'];
  } else w.bag = null;
  return cleanLook({
    name: o.name,
    body: girl ? { chest: 0.5, hips: 1.06, shoulders: 0.95 } : { chest: 0.03, shoulders: 1.05 },
    skin: o.skin,
    hair: o.hair,
    eyes: o.eyes,
    wear: w,
    colors: c,
  });
}
/* who → look: 'boy'/'girl'/'me' is the player, 'folk:<seed>' a townsperson, anything else a person in game data */
export function trainerLook(who) {
  if (typeof who === 'string' && who.startsWith('friend:')) {
    const f = typeof friends !== 'undefined' && friends.data[who.slice(7)];
    return cleanLook(f && f.avatar, TR_PRESETS[1] || TR_PRESETS[0]);
  }
  if (who === 'boy' || who === 'girl' || who === 'me')
    return cleanLook(uiState.trainerDraft || saveData.avatar, TR_PRESETS[0]);
  if (typeof who === 'string' && who.startsWith('folk:')) return folkLook(+who.slice(5));
  const p = (typeof PEOPLE !== 'undefined' && (PEOPLE[who] || PEOPLE.gini)) || {};
  return p.look ? cleanLook(p.look) : lookFromOld(p);
}
const trainerDesign = trainerLook;
function folkLook(seed) {
  const r = i => {
      const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return x - Math.floor(x);
    },
    W = WD();
  if (!W) return cleanLook(null);
  const pick = (slot, empty) => {
    const ids = Object.keys(W.items).filter(k => W.items[k].slot === slot);
    if (empty && r(slot.length * 3) < empty) return null;
    return ids[Math.floor(r(slot.length + 7) * ids.length) % ids.length];
  };
  const P = W.palettes || {},
    pc = (a, i) => a[Math.floor(r(i) * a.length) % a.length],
    fem = r(1) < 0.5;
  const wear = {
    hair: pick('hair', 0.06),
    eyes: pick('eyes'),
    brows: pick('brows'),
    mouth: pick('mouth'),
    facial: fem ? null : pick('facial', 0.75),
    top: pick('top'),
    outer: pick('outer', 0.75),
    bottom: pick('bottom'),
    shoes: pick('shoes'),
    hat: pick('hat', 0.7),
    glasses: pick('glasses', 0.75),
    neck: pick('neck', 0.85),
    bag: pick('bag', 0.6),
  };
  if (wear.hat === 'hat_crown' || wear.hat === 'hat_tophat') wear.hat = null;
  if (wear.neck === 'chain') wear.neck = null;
  const colors = {};
  for (const k of ['top', 'outer', 'bottom', 'shoes', 'hat', 'bag'])
    if (wear[k])
      colors[wear[k]] = W.items[wear[k]].colors.map((c, i) => (i ? c[1] : pc(P.cloth || [c[1]], 10 + k.length + i)));
  return cleanLook({
    name: 'Local',
    body: {
      height: 0.92 + r(2) * 0.18,
      body: 0.86 + r(3) * 0.4,
      legs: 0.92 + r(4) * 0.16,
      chest: fem ? 0.3 + r(5) * 0.6 : r(5) * 0.08,
      hips: fem ? 1 + r(6) * 0.15 : 0.95 + r(6) * 0.08,
      shoulders: fem ? 0.92 + r(7) * 0.08 : 1 + r(7) * 0.12,
      head: 0.95 + r(8) * 0.1,
    },
    skin: pc(P.skin || ['#E6B08A'], 20),
    hair: pc(P.hair || ['#3B2A22'], 21),
    eyes: pc(P.eyes || ['#4A7BBB'], 22),
    wear,
    colors,
  });
}
/* ---------- recolouring ---------- */
export const TR_CACHE = new Map();
/* least recently used goes first, one at a time (v25: clearing everything at 400 made a crowd of 40 redraw every person every frame) */
const TR_CACHE_MAX = /Android|iPhone|iPad/.test(navigator.userAgent)
  ? 2000
  : 6000; /* v41: a people picture is ~20 KB; phones keep 2000 (~40 MB) */
function trainerCache(key, build) {
  if (TR_CACHE.has(key)) {
    const v = TR_CACHE.get(key);
    TR_CACHE.delete(key);
    TR_CACHE.set(key, v);
    return v;
  }
  const v = build();
  TR_CACHE.set(key, v);
  if (TR_CACHE.size > TR_CACHE_MAX) {
    const it = TR_CACHE.keys();
    for (let n = TR_CACHE.size - TR_CACHE_MAX + 200; n > 0; n--) TR_CACHE.delete(it.next().value);
  }
  return v;
}
const trVer = () => (typeof artCacheVersion === 'function' ? artCacheVersion() : 0);
function trImg(path) {
  const im = typeof artImage === 'function' ? artImage(path) : ART_CACHE.img[path];
  if (!im && typeof artImg === 'function') return artImg(path);
  return im;
}
const trOk = im => !!(im && (im.naturalWidth || im.width));
function trPix(path) {
  return trainerCache('px|' + path + '|' + trVer(), () => {
    const im = trImg(path);
    if (!trOk(im)) return null;
    const w = im.naturalWidth || im.width,
      h = im.naturalHeight || im.height,
      c = makeCanvas(w, h),
      x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0);
    return x.getImageData(0, 0, w, h);
  });
}
function rgb2hsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  let h = 0,
    s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q,
    f = t => {
      t = (t + 1) % 1;
      return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
/* one piece of a sheet, its colour areas moved from the default colours to the wanted ones (shading kept) */
function trPiece(src, p, defs, want) {
  const key = 'pc|' + src.img + '|' + p.r.join(',') + '|' + want.join(',') + '|' + trVer();
  return trainerCache(key, () => {
    const P = trPix(src.img),
      M = trPix(src.mask);
    if (!P) return null;
    const [x0, y0, w, h] = p.r,
      c = makeCanvas(w, h),
      x = c.getContext('2d'),
      out = x.createImageData(w, h),
      o = out.data,
      D = defs.map(d => {
        const a = hexToRgb(d);
        return rgb2hsl(a[0], a[1], a[2]);
      }),
      T = want.map(d => {
        const a = hexToRgb(d);
        return rgb2hsl(a[0], a[1], a[2]);
      });
    for (let y = 0; y < h; y++)
      for (let X = 0; X < w; X++) {
        const si = ((y0 + y) * P.width + x0 + X) * 4,
          di = (y * w + X) * 4;
        const a = P.data[si + 3];
        if (!a) continue;
        let r = P.data[si],
          g = P.data[si + 1],
          b = P.data[si + 2];
        if (M) {
          const mr = M.data[si],
            mg = M.data[si + 1],
            mb = M.data[si + 2],
            ma = M.data[si + 3],
            k = ma < 128 ? -1 : mr > 127 ? 0 : mg > 127 ? 1 : mb > 127 ? 2 : -1;
          if (k >= 0 && D[k] && T[k] && (D[k][0] !== T[k][0] || D[k][1] !== T[k][1] || D[k][2] !== T[k][2])) {
            const px = rgb2hsl(r, g, b),
              d = D[k],
              t = T[k];
            const dl = px[2] - d[2],
              s = d[1] > 0.04 ? clamp(t[1] * (px[1] / d[1]), 0, 1) : t[1],
              hh = t[1] < 0.04 ? px[0] : (t[0] + (d[1] > 0.04 ? px[0] - d[0] : 0) + 1) % 1;
            const l = clamp(t[2] + dl * (t[2] < 0.18 || t[2] > 0.85 ? 0.75 : 1), 0, 1);
            [r, g, b] = hsl2rgb(hh, s, l);
          }
        }
        o[di] = r;
        o[di + 1] = g;
        o[di + 2] = b;
        o[di + 3] = a;
      }
    x.putImageData(out, 0, 0);
    return c;
  });
}
function trScale(c, sx, sy) {
  if (!c) return null;
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return c;
  const w = Math.max(1, Math.round(c.width * sx)),
    h = Math.max(1, Math.round(c.height * sy));
  const n = makeCanvas(w, h),
    x = n.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(c, 0, 0, w, h);
  return n;
}
/* the colours an item is worn in */
export function trColorsOf(L, id) {
  const it = WD().items[id];
  if (!it) return [];
  const o = L.colors[id] || [];
  return it.colors.map((c, i) => {
    const ln = it.link && it.link[String(i + 1)];
    if ((it.slot === 'hair' && i === 0) || ln === 'hair') return L.hair;
    if ((it.slot === 'eyes' && i === 0) || ln === 'eyes') return L.eyes;
    if (ln === 'skin') return L.skin;
    return o[i] || c[1];
  });
}
/* ---------- the rig: per-bone stretch from the sliders ---------- */
function trBoneScale(L, k) {
  const B = L.body,
    Wd = B.body,
    Sh = B.shoulders,
    Hp = B.hips,
    Lg = B.legs,
    A = B.arms,
    Hd = B.head,
    C = B.chest;
  switch (k) {
    case 'pelvis':
      return [Wd * Hp, 1];
    case 'torso':
      return [Wd * (0.62 + 0.38 * Sh), 1];
    case 'chest': {
      const s = 0.36 + 0.64 * C;
      return [s * Math.sqrt(Wd), s];
    }
    case 'neck':
      return [Math.sqrt(Wd), 1];
    case 'head':
      return [Hd, Hd];
    case 'armU':
      return [Math.pow(Wd, 0.55), A];
    case 'armL':
      return [Math.pow(Wd, 0.4), A];
    case 'hand':
      return [1, 1];
    case 'thigh':
      return [Math.pow(Wd, 0.6) * Math.pow(Hp, 0.35), Lg];
    case 'shin':
      return [Math.pow(Wd, 0.45), Lg];
    default:
      return [1, 1];
  }
}
const trKind = n => (['pelvis', 'torso', 'chest', 'neck', 'head'].includes(n) ? n : n.slice(0, -1));
function trLookKey(L) {
  return JSON.stringify(L);
}
export function trRig(L, view, expr) {
  const W = WD();
  return trainerCache('rig|' + view + '|' + (expr || '') + '|' + trLookKey(L) + '|' + trVer(), () => {
    const h = L.body.height,
      sk = W.skeleton[view],
      bones = [],
      slot = {};
    for (const s of W.slots) slot[s.id] = s;
    const scale = {};
    for (const b of sk) scale[b.n] = trBoneScale(L, trKind(b.n));
    const B = L.body;
    for (const b of sk) {
      const k = trKind(b.n),
        ps = b.par ? scale[b.par] : [1, 1];
      let [ax, ay] = b.at;
      if (k === 'pelvis') {
        const G = W.legs || { hip: 2, thigh: 16, shin: 14.5, sole: 2.6 };
        ay = -(G.hip + (G.thigh + G.shin) * B.legs + G.sole);
      } else if (k === 'thigh') ax *= B.body * B.hips;
      else if (k === 'armU') ax *= Math.pow(B.body, 0.8) * B.shoulders;
      else if (['shin', 'foot', 'armL', 'hand'].includes(k)) ay *= ps[1];
      else if (k === 'head') ay *= 1;
      bones.push({ n: b.n, par: b.par || 'root', at: [ax * h, ay * h], z: b.z, role: b.n });
    }
    /* pictures: the body, then every item, each piece a child bone at the joint */
    const add = (src, p, z, defs, want) => {
      const bn = p.b,
        s = scale[bn];
      if (!s) return;
      if (trKind(bn) === 'chest' && L.body.chest < 0.04) return;
      const c = trPiece(src, p, defs, want);
      if (!c) return;
      const sx = s[0] * h,
        sy = s[1] * h,
        img = { c: trScale(c, sx, sy), ox: Math.round(p.o[0] * sx), oy: Math.round(p.o[1] * sy) };
      bones.push({ n: bn + '#' + bones.length, par: bn, at: [0, 0], z, img });
    };
    const bz = {};
    for (const b of sk) bz[b.n] = b.z;
    for (const p of W.body.pieces) if (p.v === view) add(W.body, p, bz[p.b], [W.body.colors[0][1]], [L.skin]);
    for (const s of W.slots) {
      const id = L.wear[s.id],
        it = id && W.items[id];
      if (!it) continue;
      const defs = it.colors.map(c => c[1]),
        want = trColorsOf(L, id);
      /* an expression (blink, happy, talk…) swaps in that item's pieces for it when it has them */
      const hasX = !!expr && it.pieces.some(p => p.v === view && p.x === expr);
      for (const p of it.pieces)
        if (p.v === view && (hasX ? p.x === expr : !p.x)) add(it, p, p.z != null ? p.z : bz[p.b] + s.layer, defs, want);
    }
    const F = W.figure || 74,
      BW = Math.round(F * 0.78 * h * Math.max(1, B.head)),
      BH = Math.round(F * 1.3 * h * Math.max(1, B.head * 0.9 + 0.1));
    return { k: 1, BW, BH, cx: Math.round(BW / 2), base: BH - 6, tipX: 0, bones, view, anim: P => trAnim(P, view) };
  });
}
/* ---------- poses ---------- */
function trAnim(P, view) {
  const K = ((WD() || {}).figure || 74) / 74,
    A = {},
    t = P.t || 0,
    ph = P.ph || 0,
    s = Math.sin(ph * Math.PI * 2),
    c = Math.cos(ph * Math.PI * 2),
    side = view === 'side',
    set = (n, o) => {
      A[n] = Object.assign(A[n] || {}, o);
    };
  const br = Math.sin(t / 650);
  set('torso', { dy: -0.35 * br });
  set('head', { dy: -0.2 * br });
  if (P.act === 'walk') {
    if (side) {
      set('thighN', { r: -0.48 * s });
      set('thighF', { r: 0.48 * s });
      set('shinN', { r: s > 0 ? 0.05 : -s * 0.7 });
      set('shinF', { r: s < 0 ? 0.05 : s * 0.7 });
      set('footN', { r: s < 0 ? 0.2 * s : 0 });
      set('footF', { r: s > 0 ? -0.2 * s : 0 });
      set('armUN', { r: 0.42 * s });
      set('armUF', { r: -0.42 * s });
      set('armLN', { r: -0.25 - 0.15 * Math.max(0, -s) });
      set('armLF', { r: -0.25 - 0.15 * Math.max(0, s) });
      set('torso', { r: 0.03, dy: 0 });
      A.root = { dy: -Math.abs(c) * 1.1 };
    } else {
      const lA = Math.max(0, s),
        lB = Math.max(0, -s);
      set('thighL', { sy: 1 - 0.13 * lA, dy: -0.6 * lA });
      set('thighR', { sy: 1 - 0.13 * lB, dy: -0.6 * lB });
      set('shinL', { sy: 1 - 0.06 * lA });
      set('shinR', { sy: 1 - 0.06 * lB });
      set('armUL', { r: 0.1 * s, dy: -0.5 * Math.max(0, s) });
      set('armUR', { r: 0.1 * s, dy: -0.5 * Math.max(0, -s) });
      set('torso', { r: 0.025 * s, dy: 0 });
      A.root = { dy: -Math.abs(c) * 0.9 };
    }
  } else if (P.act === 'throw') {
    const k = clamp(ph, 0, 1),
      up = k < 0.45 ? k / 0.45 : 1 - ((k - 0.45) / 0.55) * 1.4,
      a = view === 'back' ? 'R' : side ? 'N' : 'R';
    set('armU' + a, { r: (view === 'back' ? -1 : side ? -1 : 1) * -2.7 * clamp(up, -0.3, 1) });
    set('armL' + a, { r: (side ? -1 : 1) * -0.5 * clamp(up, 0, 1) });
    set('torso', { r: (view === 'back' ? 0.06 : -0.06) * up });
  } else if (P.act === 'cheer') {
    const j = Math.abs(Math.sin(t / 180));
    if (side) {
      set('armUN', { r: -2.6 });
      set('armUF', { r: -2.4 });
    } else {
      set('armUL', { r: 2.5 });
      set('armUR', { r: -2.5 });
      set('armLL', { r: 0.3 });
      set('armLR', { r: -0.3 });
    }
    A.root = { dy: -3 * j };
  } else if (P.act === 'react') {
    if (side) {
      set('armUN', { r: -2.4 });
      set('armLN', { r: -1.5 });
    } else {
      set('armUL', { r: 2.3 });
      set('armUR', { r: -2.3 });
      set('armLL', { r: 1.6 });
      set('armLR', { r: -1.6 });
    }
    set('head', { dy: 1 });
    set('torso', { r: 0, dy: 0.5 });
  } else {
    set('armUL', { r: 0.04 * br });
    set('armUR', { r: -0.04 * br });
  }
  for (const k in A) {
    if (A[k].dy) A[k].dy *= K;
    if (A[k].dx) A[k].dx *= K;
  }
  return A;
}
/* ---------- drawing ---------- */
export function trFrame(L, view, act, ph, t, mirror, expr) {
  const R = trRig(L, view, expr),
    c = makeCanvas(R.BW, R.BH),
    x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const P = { x: 0, y: 0, r: 0, sx: 1, sy: 1, face: null, act, ph, t };
  /* v31: drawRig sets its own transform for every part, so a mirror has to be applied to the finished picture
    (before, people walking left were drawn facing right) */
  if (mirror) {
    const tmp = makeCanvas(R.BW, R.BH),
      tx = tmp.getContext('2d');
    tx.imageSmoothingEnabled = false;
    drawRig(tx, R, P, 'front');
    x.translate(R.BW, 0);
    x.scale(-1, 1);
    x.drawImage(tmp, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
  } else drawRig(x, R, P, 'front');
  c.ax = mirror ? R.BW - R.cx : R.cx;
  c.ay = R.base;
  c.ppm = (WD() || {}).ppm || 42;
  c.noNormal = true;
  return c;
}
/* walk frames for the scene and map: {down,up,side(left),sideR}, each [stand, step A, step B] (+ cyc: 6 frames) */
export function owFrames(who) {
  const L = trainerLook(who);
  return trainerCache('walk|' + trLookKey(L) + '|' + trVer(), () => {
    const out = {};
    /* every single frame is drawn the first time it's needed (and ahead of time by trWarm), so a crowd appearing
    never has to draw hundreds of pictures in one frame */
    for (const [dir, view, mir] of [
      ['down', 'front', 0],
      ['up', 'back', 0],
      ['side', 'side', 1],
      ['sideR', 'side', 0],
    ]) {
      const v = [],
        cyc = [];
      const lazy = (arr, i, make) => {
        let f = null;
        Object.defineProperty(arr, i, {
          enumerable: true,
          get() {
            if (!f) {
              f = make();
              (arr._b || (arr._b = {}))[i] = 1;
            }
            return f;
          },
        });
      };
      for (let i = 0; i < 6; i++) lazy(cyc, i, () => trFrame(L, view, 'walk', i / 6, 0, mir));
      lazy(v, 0, () => trFrame(L, view, 'idle', 0, 0, mir));
      lazy(v, 1, () => cyc[1]);
      lazy(v, 2, () => cyc[4]);
      Object.defineProperty(cyc, 'length', { value: 6 });
      Object.defineProperty(v, 'length', { value: 3 });
      v.cyc = cyc;
      Object.defineProperty(out, dir, { enumerable: true, value: v });
    }
    return out;
  });
}
/* v32: a walk frame that hasn't been drawn yet waits for a frame with time to spare: until then the person shows a
   frame that is ready (or isn't shown for a moment), instead of the scene stalling while a crowd is drawn */
function trReady(arr, i) {
  return !!(arr && arr._b && arr._b[i]);
}
export function trPick(set, walk, k) {
  const want = walk ? (set.cyc ? [set.cyc, k] : [set, 1]) : [set, 0];
  if (trReady(want[0], want[1]) || typeof frameBudgetLeft !== 'function' || frameBudgetLeft()) return want[0][want[1]];
  for (const [a, n] of [
    [set, 3],
    [set.cyc, 6],
  ]) {
    if (!a) continue;
    for (let i = 0; i < n; i++) if (trReady(a, i)) return a[i];
  }
  return null;
}
/* drawing walk frames in the background, a few milliseconds per frame, before anyone needs them */
const TRW = { q: [], seen: new Set() };
export function trWarm(who) {
  if (TRW.seen.has(who)) return;
  TRW.seen.add(who);
  if (TRW.seen.size > 600) TRW.seen.clear();
  TRW.q.push(who);
  if (typeof frameTask === 'function' && !TRW.on) {
    TRW.on = true;
    frameTask('trwarm', trWarmStep, () => 30);
  }
}
function trWarmStep() {
  const t0 = performance.now();
  while (TRW.q.length && performance.now() - t0 < 3) {
    const who = TRW.q[0];
    let F;
    try {
      F = owFrames(who);
    } catch (e) {
      TRW.q.shift();
      continue;
    }
    TRW.i = TRW.i || 0;
    const dirs = ['down', 'sideR', 'side', 'up'],
      d = dirs[Math.floor(TRW.i / 7)],
      k = TRW.i % 7;
    try {
      const v = F[d];
      if (k === 0) v[0];
      else v.cyc[k - 1];
    } catch (e) {}
    TRW.i++;
    if (TRW.i >= 28) {
      TRW.i = 0;
      TRW.q.shift();
    }
  }
  if (!TRW.q.length) {
    TRW.on = false;
    frameStop('trwarm');
  }
}
export const folkFrames = seed => owFrames('folk:' + seed);
/* battle: 2 breathing frames ('back' for you, 'front' for rivals), plus poses */
export function humanFrames(who, view) {
  const L = trainerLook(who);
  return trainerCache('bat|' + view + '|' + trLookKey(L) + '|' + trVer(), () => [
    trFrame(L, view, 'idle', 0, 650 * Math.PI * 1.5),
    trFrame(L, view, 'idle', 0, 650 * Math.PI * 0.5),
  ]);
}
export function humanPose(who, view, act, ph, t) {
  const L = trainerLook(who);
  if (act === 'throw') {
    const k = Math.round(clamp(ph, 0, 1) * 6) / 6;
    return trainerCache('pose|' + view + '|throw|' + k + '|' + trLookKey(L) + '|' + trVer(), () =>
      trFrame(L, view, 'throw', k, 0)
    );
  }
  const k = Math.floor((t || 0) / 90) % 4;
  return trainerCache('pose|' + view + '|' + act + '|' + k + '|' + trLookKey(L) + '|' + trVer(), () =>
    trFrame(L, view, act, 0, k * 90)
  );
}
/* a crisp portrait for the interface: the standing figure cropped tight, two breathing frames side by side */
export function trBox(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width,
    y0 = c.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < x0 ? [0, 0, c.width, c.height] : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}
export function humanSheet(who, view = 'front') {
  const L = trainerLook(who);
  return trainerCache('sheet|' + view + '|' + trLookKey(L) + '|' + trVer(), () => {
    const f = [trFrame(L, view, 'idle', 0, 650 * Math.PI * 1.5), trFrame(L, view, 'idle', 0, 650 * Math.PI * 0.5)];
    const a = trBox(f[0]),
      b = trBox(f[1]),
      x0 = Math.min(a[0], b[0]) - 1,
      y0 = Math.min(a[1], b[1]) - 1,
      x1 = Math.max(a[0] + a[2], b[0] + b[2]) + 1,
      y1 = Math.max(a[1] + a[3], b[1] + b[3]) + 1,
      w = x1 - x0,
      h = y1 - y0;
    const c = makeCanvas(w * 2, h),
      x = c.getContext('2d');
    f.forEach((fr, i) => x.drawImage(fr, x0, y0, w, h, i * w, 0, w, h));
    return { url: c.toDataURL(), w, h };
  });
}
export function humanHTML(who, size, view = 'front') {
  const s = humanSheet(who, view),
    hgt = Math.round(size * 1.375),
    wid = Math.round((hgt * s.w) / s.h);
  return `<span class="spr slow tr-por" style="width:${wid}px;height:${hgt}px"><img src="${s.url}" alt=""></span>`;
}
export function owHTMLsheet(who) {
  return trainerCache('walkurl|' + trLookKey(trainerLook(who)) + '|' + trVer(), () => {
    const f = owFrames(who).sideR,
      a = trBox(f[1]),
      w = a[2] + 2,
      h = a[3] + 2,
      c = makeCanvas(w * 2, h),
      x = c.getContext('2d');
    x.drawImage(f[1], a[0] - 1, a[1] - 1, w, h, 0, 0, w, h);
    x.drawImage(f[2], a[0] - 1, a[1] - 1, w, h, w, 0, w, h);
    return c.toDataURL();
  });
}
/* the art files every look needs (loaded at start) */
/* older code paths */
/* a talking-head portrait for dialogue and cutscenes: head and shoulders, 1:1 pixels, any expression */
function trHeadAt(bones) {
  const by = {};
  for (const b of bones) by[b.n] = b;
  let x = 0,
    y = 0,
    b = by.head;
  while (b && b.n !== 'root') {
    x += b.at[0];
    y += b.at[1];
    b = by[b.par];
  }
  return [x, y];
}
function trPortraitRect() {
  const W = WD(),
    b = (W.crops || {}).bust || [-31, -150, 31, -74],
    sk = W.skeleton.front,
    by = {};
  for (const s of sk) by[s.n] = s;
  let y = 0,
    s = by.head;
  while (s) {
    y += s.at[1];
    s = s.par ? by[s.par] : null;
  }
  return [Math.round(b[0]), Math.round(b[1] - y), Math.round(b[2] - b[0]), Math.round(b[3] - b[1])];
}
export function trPortrait(cv, who, expr, t) {
  const W = WD();
  if (!W || !cv) return;
  const L = typeof who === 'object' ? cleanLook(who) : trainerLook(who),
    R = trRig(L, 'front', expr),
    f = trFrame(L, 'front', 'idle', 0, t || 0, 0, expr),
    [hx, hy] = trHeadAt(R.bones),
    [rx, ry, w, h] = trPortraitRect();
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const x = cv.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, w, h);
  x.drawImage(f, Math.round(R.cx + hx + rx), Math.round(R.base + hy + ry), w, h, 0, 0, w, h);
}
function portraitURL(who, expr) {
  const L = trainerLook(who);
  return trainerCache('porurl|' + (expr || '') + '|' + trLookKey(L) + '|' + trVer(), () => {
    const c = makeCanvas(1, 1);
    trPortrait(c, L, expr, 0);
    return c.toDataURL();
  });
}
export function portraitHTML(who, size, expr) {
  const r = trPortraitRect();
  return `<img class="pxi tr-face" src="${portraitURL(who, expr)}" width="${size}" height="${Math.round((size * r[3]) / r[2])}" alt="">`;
}
export function cleanTrainer(a, g) {
  return lookFromOld(a, g);
}
export function trainerArtPaths() {
  const W = WD();
  if (!W) return [];
  const L = [W.body.img, W.body.mask];
  for (const it of Object.values(W.items)) L.push(it.img, it.mask);
  return L;
}
