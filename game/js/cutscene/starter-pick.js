'use strict';
/* ================= CUTSCENES: THE STARTER PICK =================
   The opening's three starters drawn with their rigs, and the pick card: arrows either side of the name, dots, the
   blurb, what it beats and what beats it, one gold button; tap a starter in the scene to look at it, tap Hazel for a
   hot take (opening.js). Split from cutscene.js. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { hazelHotTake, typeBadgeHTML } from '../hooks.js';
import { $, clamp } from '../util.js';
import { SPECIES, TYPES, typeEffectiveness } from '../game-data.js';
import { HAZEL } from '../logic/hazel.js';
import { cutscenePoint } from '../logic/cutscene-set.js';
import { escapeHtml } from '../game-state.js';
import { makeCanvas } from '../art.js';
import { drawRig, rigFrame, rigParts, rigTint } from '../skeleton-rig.js';
import { walkView, worldToScreen } from '../walk-view.js';
import { standingHeightAt } from '../walk/heights.js';
import { cutscene, cutsceneNow, cutsceneShot } from './director.js';
import { cutsceneLook } from './stage.js';
/* eslint-disable no-func-assign */
expose({
  chooseStarter: [() => chooseStarter, v => (chooseStarter = v)],
  cutsceneStarterItem: [() => cutsceneStarterItem, v => (cutsceneStarterItem = v)],
  starterPickerFocus: [() => starterPickerFocus, v => (starterPickerFocus = v)],
  starterPickerHTML: [() => starterPickerHTML, v => (starterPickerHTML = v)],
  starterPickerSelect: [() => starterPickerSelect, v => (starterPickerSelect = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/* the starter billionaires, drawn with their rigs every frame */
export function cutsceneStarterItem(s, t) {
  const R = rigParts(s.sp, 1);
  if (!R) return null;
  if (!s.buf) s.buf = makeCanvas(R.BW, R.BH);
  const b = s.buf;
  if (b.width !== R.BW || b.height !== R.BH) {
    b.width = R.BW;
    b.height = R.BH;
  }
  const x = b.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, b.width, b.height);
  const tau = cutsceneNow() - s.actT,
    ak = s.act && tau < 1200 ? s.act : null;
  drawRig(x, R, rigFrame(R, ak, tau, Math.floor(t / 16) * 16, s.seed), 'front');
  if (s.white > 0) rigTint(x, b.width, b.height, '#FFFFFF', s.white);
  b.__v = (b.__v || 0) + 1;
  const G = R.geo,
    pop = s.pop >= 1 ? 1 : s.pop <= 0 ? 0 : 1 + Math.sin(s.pop * Math.PI) * 0.25 - (1 - s.pop) * 0.9,
    mpp = (0.88 / (G.base - G.top)) * Math.max(0.01, pop),
    y = standingHeightAt(s.x, s.z) + (s.hop || 0);
  return {
    k: 'rig',
    im: b,
    x: s.x,
    z: s.z,
    y,
    mpp,
    ox: -G.cx,
    oy: -G.base,
    w: R.BW,
    h: R.BH,
    flip: s.flip,
    shear: 0,
    sh: pop > 0.3 ? Math.max(0.25, G.hw * mpp) : 0,
    aoR: Math.max(0.25, G.hw * mpp * 0.9),
    fade: clamp(s.a, 0, 1),
    person: 1,
  };
}
/* ---------- the starter picker ---------- */
/* phase 06-2: the pick card on the new look: arrows either side of the name, dots for where you are, the blurb in the
   reading font, what it beats and what beats it as type pills, one gold button (css/units.css "starter pick") */
function starterPickerHTML() {
  const pk = cutscene.pickList,
    l = pk[cutscene.sel],
    s = SPECIES[l + '0'],
    t = s.types[0],
    st = TYPES.filter(x => typeEffectiveness(t, [x]) > 1),
    wk = TYPES.filter(x => typeEffectiveness(x, [t]) > 1),
    pills = L => (L.length ? L.map(typeBadgeHTML).join('') : '<span class="pk-none">nothing in particular</span>');
  return `<div class="pk-top"><button class="pk-arrow" data-a="cs-prev" aria-label="Previous starter">‹</button><div class="pk-name"><b>${escapeHtml(s.name)}</b><span class="pk-types">${typeBadgeHTML(t)}</span></div><button class="pk-arrow" data-a="cs-next" aria-label="Next starter">›</button></div>
 <div class="pk-dots" role="img" aria-label="${cutscene.sel + 1} of ${pk.length}">${pk.map((_, i) => `<i class="${i === cutscene.sel ? 'on' : ''}"></i>`).join('')}</div>
 <p class="pk-blurb">${escapeHtml(s.blurb)}</p>
 <div class="pk-match"><div><span class="pk-k">Strong against</span><span class="pk-ts">${pills(st)}</span></div><div><span class="pk-k">Weak to</span><span class="pk-ts">${pills(wk)}</span></div></div>
 <p class="pk-note">${escapeHtml(HAZEL.pickNote)}</p>
 ${cutscene.confirm ? `<div class="pk-acts"><button class="pb quiet" data-a="cs-no">Not yet</button><button class="pb gold" data-a="cs-yes">Yes, ${escapeHtml(s.name)}!</button></div>` : `<button class="pb gold wide pk-go" data-a="cs-choose">Choose ${escapeHtml(s.name)}</button>`}`;
}
function starterPickerFocus() {
  const s = cutscene.stars[cutscene.sel];
  if (!s) return;
  s.act = 'cheer';
  s.actT = cutsceneNow();
  /* framed from in front of the middle one (star2), leaning towards the one you look at */
  const mid = cutscenePoint(cutscene.set.spots.star2, cutscene.off);
  cutsceneShot(
    {
      eye: [s.x * 0.6 + mid[0] * 0.4 + 0.1, standingHeightAt(s.x, s.z) + 0.85, s.z - 3.6],
      tgt: [s.x, standingHeightAt(s.x, s.z) + 0.05, s.z + 0.2],
      fov: 36,
      w: 2.6,
      abs: 1,
    },
    650
  );
  const p = $('#csPick');
  if (p) p.innerHTML = starterPickerHTML();
}
export function chooseStarter() {
  return new Promise(res => {
    cutscene.choosing = true;
    cutscene.confirm = false;
    cutscene.pickRes = res;
    const p = $('#csPick');
    p.hidden = false;
    document.body.classList.add('cs-choosing');
    starterPickerFocus();
    if (cutscene.test)
      setTimeout(() => {
        starterPickerSelect(1);
        setTimeout(() => {
          if (cutscene.pickRes) {
            const r = cutscene.pickRes;
            cutscene.pickRes = null;
            r(cutscene.pickList[cutscene.sel]);
          }
        }, 900);
      }, 900);
  });
}
function starterPickerSelect(d) {
  if (!cutscene.choosing) return;
  cutscene.sel = (cutscene.sel + d + cutscene.pickList.length) % cutscene.pickList.length;
  cutscene.confirm = false;
  starterPickerFocus();
}
document.addEventListener('click', ev => {
  if (!cutscene.on) return;
  const el = ev.target.closest('[data-a]');
  const a = el && el.dataset.a;
  switch (a) {
    case 'cs-prev':
      starterPickerSelect(-1);
      break;
    case 'cs-next':
      starterPickerSelect(1);
      break;
    case 'cs-choose':
      cutscene.confirm = true;
      $('#csPick').innerHTML = starterPickerHTML();
      break;
    case 'cs-no':
      cutscene.confirm = false;
      $('#csPick').innerHTML = starterPickerHTML();
      break;
    case 'cs-yes':
      if (cutscene.pickRes) {
        const r = cutscene.pickRes;
        cutscene.pickRes = null;
        r(cutscene.pickList[cutscene.sel]);
      }
      break;
  }
});
document.addEventListener('keydown', ev => {
  if (!cutscene.on || cutscene.dressing || ev.key === 'Escape') return;
  if (cutscene.choosing) {
    if (ev.key === 'ArrowLeft') starterPickerSelect(-1);
    else if (ev.key === 'ArrowRight') starterPickerSelect(1);
  }
});
/* tapping a billionaire in the scene picks it */
document.addEventListener('pointerup', ev => {
  if (
    !cutscene.on ||
    !cutscene.choosing ||
    !walkView.C ||
    !walkView.cv ||
    (ev.target !== walkView.cv && ev.target.id !== 'dioui' && !ev.target.classList.contains('cs'))
  )
    return;
  const r = walkView.cv.getBoundingClientRect(),
    sx = ((ev.clientX - r.left) / r.width) * walkView.cv.width,
    sy = ((ev.clientY - r.top) / r.height) * walkView.cv.height;
  let best = -1,
    bd = 1e9;
  /* phase 06-2b: Hazel, nearer than any starter, gives a hot take */
  const g = cutscene.actors[cutsceneLook('Chosen')],
    hq = g && worldToScreen(walkView.C, g.x, 1.0 + standingHeightAt(g.x, g.z), g.z),
    hd = hq ? Math.hypot(hq.x - sx, hq.y - sy) : 1e9;
  cutscene.stars.forEach((s, i) => {
    const q = worldToScreen(walkView.C, s.x, 0.45, s.z);
    if (!q) return;
    const d = Math.hypot(q.x - sx, q.y - sy);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  if (hd < bd && hd < walkView.cv.height * 0.16) {
    hazelHotTake();
    return;
  }
  if (best >= 0 && bd < walkView.cv.height * 0.18 && best !== cutscene.sel) {
    cutscene.sel = best;
    cutscene.confirm = false;
    starterPickerFocus();
  }
});
