'use strict';
/* ================= POCKET BILLIES STUDIO · figures (characters track CH-5) =================
   The figure kit's shapes (game/data/figureKit.json) with a turntable: everyone's 3D figure is built from their look
   by the kit (game/js/logic/figure-kit.js), and this section edits what it builds with: the head shapes, how far
   people vary from theirs, the builds and their gaits, the proportions, each hair style's recipe and each
   accessory's shapes (hats, the headset, neckwear, bags). The preview is the game's own figure baker
   (figures.js figurePreview) on the unsaved data: pick a person, try another head shape or build on them, turn them
   round, look at the head close up, and see an edit as soon as it is typed. An accessory's values are numbers or
   sums of the head's or body's frame ('bx * 0.98'), so one hat fits every head. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../../game/js/test-globals.js';
import { $, $$ } from '../../game/js/util.js';
import { figureSeed } from '../../game/js/logic/figure-kit.js';
import { cleanLook } from '../../game/js/person-art.js';
import { FIGURE_LOOKS, figurePreview } from '../../game/js/figures.js';
import { escapeHtml } from './game-stand-ins.js';
import {
  ACTIONS,
  SECTIONS,
  afterRender,
  card,
  changed,
  checkboxField,
  clone,
  numberField,
  rangeField,
  render,
  selectField,
  studioState,
  textField,
  toast,
  uniqueKey,
} from './studio-app.js';
/* eslint-disable no-func-assign */
expose({
  FIGURE_EDIT_TABS: [() => FIGURE_EDIT_TABS],
  FIGURE_MARK_ITEMS: [() => FIGURE_MARK_ITEMS],
  FIGURE_ROW_KINDS: [() => FIGURE_ROW_KINDS],
  FIGURE_STYLE_NAMES: [() => FIGURE_STYLE_NAMES],
  FIGURE_WHOLE: [() => FIGURE_WHOLE],
  figureEditor: [() => figureEditor],
  figureEditorDraw: [() => figureEditorDraw, v => (figureEditorDraw = v)],
  figureEditorRun: [() => figureEditorRun, v => (figureEditorRun = v)],
  figureEditorStart: [() => figureEditorStart, v => (figureEditorStart = v)],
  figureEditorTab: [() => figureEditorTab, v => (figureEditorTab = v)],
  figureEditorTick: [() => figureEditorTick, v => (figureEditorTick = v)],
  figureFieldHTML: [() => figureFieldHTML, v => (figureFieldHTML = v)],
  figureFieldsHTML: [() => figureFieldsHTML, v => (figureFieldsHTML = v)],
  figureKitOf: [() => figureKitOf],
});
/* eslint-enable no-func-assign */
/* to-module: end */
/** the section's state: who is shown, the head shape and build tried on them ('' their own), the style, the clip,
 * whole or the head close up, the turn and whether it spins, which part of the kit is edited and the pick in each */
const figureEditor = {
  who: 'chosen',
  head: '',
  build: '',
  style: 'gnight',
  clip: 'idle',
  view: 'whole',
  turn: 0.9,
  spin: true,
  frame: 0,
  tab: 'heads',
  pick: { heads: 'round', builds: 'average', hair: 'hair_short', accessories: 'hat_cap' },
  timer: 0,
  error: '',
};
/** the kit's parts this section edits: its key in figureKit.json, the tab's name */
const FIGURE_EDIT_TABS = [
  ['heads', 'Head shapes'],
  ['builds', 'Builds'],
  ['hair', 'Hair'],
  ['accessories', 'Hats & things'],
  ['body', 'Variety & proportions'],
];
/** the shapes a row can be (logic/figure-pose.js's own, and kit-shapes.js's round the head) */
const FIGURE_ROW_KINDS = ['ellipsoid', 'lathe', 'torus', 'cone', 'capsule', 'tube', 'dome', 'disc', 'band', 'curls'];
/** the styles' names (figures.js FIGURE_LOOKS) */
const FIGURE_STYLE_NAMES = { gnight: 'Gouache night', pixel: 'Pixel puppet', smooth: 'Plain 3D' };
/** wardrobe items the kit paints on as marks, not shapes (logic/figure-kit.js kitFaceMarks: glasses; a name tag):
 * not offered shapes */
const FIGURE_MARK_ITEMS = /^(glasses_|nametag$)/;
/** the values a row's shape counts in whole numbers (its mesh's segments) */
const FIGURE_WHOLE = new Set(['seg', 'rings', 'steps', 'repeat', 'every', 'n', 'coil']);

const figureKitOf = () => studioState.D.figureKit;

SECTIONS.figures = () => {
  const D = studioState.D,
    K = figureKitOf();
  if (!K)
    return `<div class="ed-col solo"><h2>Figures</h2><p class="help">This game data has no figure kit (game/data/figureKit.json).</p></div>`;
  const E = figureEditor;
  if (!D.people[E.who]) E.who = 'chosen' in D.people ? 'chosen' : Object.keys(D.people)[0];
  for (const [t] of FIGURE_EDIT_TABS) if (t !== 'body' && !K[t][E.pick[t]]) E.pick[t] = Object.keys(K[t])[0] || '';
  afterRender(figureEditorStart);
  const opt = (/** @type {string} */ v, /** @type {string} */ n, /** @type {string} */ cur) =>
      `<option value="${escapeHtml(v)}" ${v === cur ? 'selected' : ''}>${escapeHtml(n)}</option>`,
    sel = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ inner) =>
      `<label class="fld"><span>${label}</span><select id="${id}">${inner}</select></label>`,
    styles = ['gnight', ...Object.keys(FIGURE_LOOKS).filter(k => k !== 'gnight'), 'smooth'];
  const preview = `<div class="fig-prev"><canvas id="figCv" width="360" height="420"></canvas><p class="help" id="figInfo"></p></div>
   <div class="grid">${sel(
     'figWho',
     'Person',
     Object.keys(D.people)
       .map(k => opt(k, k === 'boy' || k === 'girl' ? `${k} (you)` : k, E.who))
       .join('')
   )}${sel(
     'figHead',
     'Head shape',
     opt('', 'Their own', E.head) +
       Object.keys(K.heads)
         .map(k => opt(k, k, E.head))
         .join('')
   )}${sel(
     'figBuild',
     'Build',
     opt('', 'Their own', E.build) +
       Object.keys(K.builds)
         .map(k => opt(k, k, E.build))
         .join('')
   )}${sel('figStyle', 'Style', styles.map(k => opt(k, FIGURE_STYLE_NAMES[k] || k, E.style)).join(''))}${sel(
     'figClip',
     'Moving',
     [
       ['idle', 'Standing'],
       ['walk', 'Walking'],
       ['cheer', 'Cheering'],
     ]
       .map(([k, n]) => opt(k, n, E.clip))
       .join('')
   )}</div>
   <div class="seg-row"><button class="seg sm ${E.view === 'whole' ? 'on' : ''}" data-act="figView" data-v="whole" aria-pressed="${E.view === 'whole'}">Whole</button><button class="seg sm ${E.view === 'head' ? 'on' : ''}" data-act="figView" data-v="head" aria-pressed="${E.view === 'head'}">Head</button>
   <button class="seg sm ${E.spin ? 'on' : ''}" data-act="figSpin" aria-pressed="${E.spin}">Turntable</button>
   <label class="fld range"><span>Turn</span><input type="range" id="figTurn" min="0" max="2" step="0.0625" value="${E.turn}"></label></div>
   <div class="seg-row"><button class="btn" data-act="figSaveChoice" ${E.head || E.build ? '' : 'disabled'} title="Write the head shape and build tried here into this person's figure (people/${escapeHtml(E.who)}.json)">Give ${escapeHtml(E.who)} this head and build</button></div>`;
  const tabs = `<div class="seg-row" role="tablist">${FIGURE_EDIT_TABS.map(
    ([k, n]) =>
      `<button class="seg sm ${E.tab === k ? 'on' : ''}" role="tab" aria-selected="${E.tab === k}" data-act="figTab" data-v="${k}">${n}</button>`
  ).join('')}</div>`;
  return `<div class="split"><aside class="list-col fig-side">${card('Turntable', preview, { sub: 'The game’s own figure baker on your unsaved data.' })}</aside>
 <div class="ed-col"><div class="ed-head"><div><h2>Figures</h2><small>The figure kit: what everyone’s 3D figure is built from (figureKit.json)</small></div></div>
 ${tabs}${figureEditorTab()}</div></div>`;
};

/** the tab being edited */
function figureEditorTab() {
  const E = figureEditor,
    K = figureKitOf(),
    p = 'figureKit',
    pickRow = (/** @type {string} */ t, /** @type {string} */ what, /** @type {string} */ extra = '') =>
      `<div class="seg-row"><label class="fld"><span>${what}</span><select data-fig-pick="${t}">${Object.keys(K[t])
        .map(k => `<option value="${escapeHtml(k)}" ${k === E.pick[t] ? 'selected' : ''}>${escapeHtml(k)}</option>`)
        .join('')}</select></label>${extra}</div>`;
  switch (E.tab) {
    case 'heads': {
      const k = E.pick.heads,
        q = `${p}.heads.${k}`,
        H = K.heads[k];
      return card(
        'Head shape',
        pickRow('heads', 'Head shape', `<button class="btn" data-act="figCopy" data-t="heads">+ Copy as new</button>`) +
          `<div class="grid">${['x', 'y', 'z'].map((a, i) => rangeField('Radius ' + a, `${q}.r.${i}`, { min: 0.6, max: 1.5, step: 0.01 })).join('')}
          ${rangeField('Jaw (V)', `${q}.jaw`, { min: -1, max: 1.5, step: 0.01, help: 'Below 0 wider at the jaw than the cheeks' })}
          ${rangeField('Chin', `${q}.chin`, { min: 0, max: 2, step: 0.01 })}
          ${rangeField('Cheekbones', `${q}.cheek`, { min: 0, max: 2.5, step: 0.01 })}
          ${rangeField('Back of the skull', `${q}.crown`, { min: 0.6, max: 1.5, step: 0.01 })}
          ${rangeField('Flat face', `${q}.face`, { min: 0, max: 1.5, step: 0.01 })}
          ${selectField(
            'Nose',
            `${q}.nose`,
            [
              ['0', 'A button'],
              ['1', 'Straight'],
              ['2', 'Long'],
              ['3', 'Broad'],
            ],
            { none: 'Each person’s own', opt: true, num: true }
          )}
          ${checkboxField('Never picked at random (the main character’s)', `${q}.random`, { help: H.random === false ? 'Only someone who names it has it' : '' })}</div>`,
        {
          sub: 'Each head is one sculpted surface; these are its knobs. Everyone varies a little from theirs (Variety).',
        }
      );
    }
    case 'builds': {
      const k = E.pick.builds,
        q = `${p}.builds.${k}`,
        B = K.builds[k];
      const K0 = ['height', 'legs', 'arms', 'body', 'shoulders', 'hips', 'head', 'neck', 'belly', 'waist', 'chestOut'],
        G0 = ['swing', 'arms', 'bounce', 'lean', 'head', 'hang'];
      return card(
        'Build',
        pickRow('builds', 'Build', `<button class="btn" data-act="figCopy" data-t="builds">+ Copy as new</button>`) +
          `<h4>Body (times the look’s sliders; empty is 1)</h4><div class="grid">${K0.map(x => numberField(x, `${q}.k.${x}`, { opt: true, step: 0.01, ph: '1' })).join('')}</div>
          <h4>Walk</h4><div class="grid">${G0.map(x => numberField(x, `${q}.gait.${x}`, { opt: true, step: 0.01 })).join('')}</div>
          <div class="grid">${numberField('Jaw', `${q}.jaw`, { opt: true, step: 0.01, help: 'Added to the head’s jaw (below 0 squarer)' })}</div>
          <p class="help">Townsfolk are picked from: ${escapeHtml(K.folk.join(', '))}. ${B && K.folk.includes(k) ? '' : 'Not this one.'}</p>`,
        { sub: 'A build’s numbers multiply the look’s (exaggerated) body sliders, and it walks its own way.' }
      );
    }
    case 'hair': {
      const k = E.pick.hair,
        q = `${p}.hair.${k}`,
        R = K.hair[k];
      return card(
        'Hair style',
        pickRow('hair', 'Style') +
          (R.cut ? `<h4>Hairline</h4>${figureFieldsHTML(`${q}.cut`, R.cut, false)}` : '') +
          (R.under ? `<h4>Under a hat</h4>${figureFieldsHTML(`${q}.under`, R.under, false)}` : '') +
          R.steps
            .map(
              (/** @type {any} */ st, /** @type {number} */ i) =>
                `<fieldset class="fig-row"><legend>Step ${i + 1}: ${escapeHtml(st.op)}</legend>${figureFieldsHTML(`${q}.steps.${i}`, st, false, ['op'])}</fieldset>`
            )
            .join(''),
        {
          sub: 'A style is grown strand by strand: these are its steps’ numbers (lengths are metres at the usual head; strands fall by grav, keep their way by stiff, wave, curl and hug the head).',
        }
      );
    }
    case 'accessories': {
      const k = E.pick.accessories,
        q = `${p}.accessories.${k}`,
        A = K.accessories[k],
        W = studioState.D.wardrobe,
        free = Object.keys(W.items).filter(
          id =>
            ['hat', 'neck', 'bag', 'glasses'].includes(W.items[id].slot) &&
            !K.accessories[id] &&
            !FIGURE_MARK_ITEMS.test(id)
        );
      const add = free.length
        ? `<label class="fld"><span>Shapes for</span><select id="figAccNew">${free.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(W.items[id].name || id)}</option>`).join('')}</select></label><button class="btn" data-act="figAccNew">+ Give it shapes</button>`
        : '';
      return card(
        'Hats & things',
        pickRow('accessories', 'Item', add) +
          `<div class="grid">${checkboxField('A fringe shows under it', `${q}.fringe`)}</div>` +
          (A.vars ? `<h4>Named values</h4>${figureFieldsHTML(`${q}.vars`, A.vars, true)}` : '') +
          A.rows
            .map(
              (/** @type {any} */ r, /** @type {number} */ i) =>
                `<fieldset class="fig-row"><legend>${escapeHtml(r.id)}${r.sides ? ' (A and B)' : r.repeat ? ` (×${r.repeat})` : ''}</legend>
                <div class="grid">${textField('Id', `${q}.rows.${i}.id`)}${textField('On part', `${q}.rows.${i}.parent`, { opt: true, ph: k.startsWith('hat') || k === 'headset' ? 'head' : 'torso' })}${textField('Colour slot', `${q}.rows.${i}.col`)}${selectField(
                  'Shape',
                  `${q}.rows.${i}.shape.kind`,
                  FIGURE_ROW_KINDS.map(x => [x, x])
                )}${checkboxField('Mirrored A and B', `${q}.rows.${i}.sides`)}</div>
                ${r.at ? `<h5>At</h5>${figureFieldsHTML(`${q}.rows.${i}.at`, r.at, true)}` : ''}
                ${figureFieldsHTML(`${q}.rows.${i}.shape`, r.shape, true, ['kind'])}
                <div class="seg-row"><button class="btn sm" data-act="figRowDup" data-i="${i}">Duplicate</button><button class="btn sm" data-act="figRowDel" data-i="${i}" ${A.rows.length > 1 ? '' : 'disabled'}>Delete</button></div></fieldset>`
            )
            .join(''),
        {
          sub: `Rows of shapes. A value is a number or a sum of the frame’s values: round a hat k, rx, yb (its band), zc, bx, bz, top; the head k, hx, hy, c1; the body tk, girth, hipK, torsoZ; with sqrt, sin, cos and pi.`,
        }
      );
    }
    default:
      return (
        card(
          'Variety',
          figureFieldsHTML(`${p}.vary`, K.vary, false) +
            `<p class="help">[base, spread]: each person gets base plus spread times a number from their seed; jaw and face: plus or minus half.</p>`,
          { sub: 'How far each person strays from their head shape.' }
        ) +
        card('Proportions', figureFieldsHTML(`${p}.proportions`, K.proportions, false), {
          sub: 'The head, legs, torso, arms and neck against a real body’s, and how much more a look’s slider counts on a figure.',
        })
      );
  }
}

/**
 * fields for a part of the kit's data, by what each value is: a number a number field (a sum's text field when `sums`),
 * a string a text field, a yes/no a checkbox, a list its items in a row, an object its keys
 * @param {string} path @param {any} v @param {boolean} sums values may be sums @param {string[]} [skip] keys left out
 * @returns {string}
 */
function figureFieldsHTML(path, v, sums, skip = []) {
  if (Array.isArray(v))
    return `<div class="grid">${v.map((x, i) => figureFieldHTML(`${path}.${i}`, x, v.length === 3 ? 'xyz'[i] : String(i + 1), sums)).join('')}</div>`;
  const flat = Object.entries(v).filter(([k, x]) => !skip.includes(k) && (x === null || typeof x !== 'object')),
    deep = Object.entries(v).filter(([k, x]) => !skip.includes(k) && x !== null && typeof x === 'object');
  return (
    (flat.length
      ? `<div class="grid">${flat.map(([k, x]) => figureFieldHTML(`${path}.${k}`, x, k, sums)).join('')}</div>`
      : '') +
    deep
      .map(([k, x]) =>
        Array.isArray(x) && x.every(y => y === null || typeof y !== 'object')
          ? `<div class="fig-vrow"><span>${escapeHtml(k)}</span>${figureFieldsHTML(`${path}.${k}`, x, sums)}</div>`
          : `<fieldset class="fig-row"><legend>${escapeHtml(k)}</legend>${figureFieldsHTML(`${path}.${k}`, x, sums)}</fieldset>`
      )
      .join('')
  );
}
/** one value's field (figureFieldsHTML) @param {string} path @param {any} x @param {string} label @param {boolean} sums */
function figureFieldHTML(path, x, label, sums) {
  const k = path.split('.').pop() || '';
  if (typeof x === 'boolean') return checkboxField(label, path);
  if (typeof x === 'number' && (!sums || FIGURE_WHOLE.has(k)))
    return numberField(label, path, { step: FIGURE_WHOLE.has(k) ? 1 : 0.001 });
  return textField(label, path, { cls: 'fig-sum' });
}

/* ---------- the turntable ---------- */
/** the preview drawn now: the person's figure with the head shape and build tried on them, at the turn */
function figureEditorDraw() {
  const cv = /** @type {HTMLCanvasElement | null} */ ($('#figCv'));
  if (!cv) return false;
  const D = studioState.D,
    E = figureEditor,
    K = figureKitOf(),
    P = D.people[E.who] || {},
    me = E.who === 'boy' || E.who === 'girl',
    who = me ? 'me' : E.who,
    own = P.figure || (me ? { head: 'hero' } : null),
    figure =
      E.head || E.build
        ? { ...(own || {}), ...(E.head ? { head: E.head } : {}), ...(E.build ? { build: E.build } : {}) }
        : own || undefined,
    look = P.creature ? P : cleanLook(P.look || null),
    /* built again when the kit, the look or the choice changes (a hash of them) */
    rev = figureSeed(JSON.stringify([K, look, figure || null]));
  const x = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  let im = null;
  try {
    im = figurePreview({
      look,
      items: D.wardrobe.items,
      kit: K,
      who,
      figure,
      rev,
      style: E.style,
      clip: E.clip,
      frame: E.frame,
      turn: E.turn,
      ppm: E.view === 'head' ? 128 : 64,
      crop: E.view === 'head' ? 'bust' : 'whole',
    });
    E.error = '';
  } catch (e) {
    E.error = String((e && /** @type {Error} */ (e).message) || e);
  }
  x.clearRect(0, 0, cv.width, cv.height);
  const info = $('#figInfo');
  if (!im) {
    if (info) info.textContent = E.error ? 'Can’t build: ' + E.error : 'The figure baker can’t draw here (WebGL2).';
    return true;
  }
  /* whole pixels, as big as fits, standing on the bottom */
  const s = Math.max(1, Math.floor(Math.min(cv.width / im.width, cv.height / im.height)));
  x.imageSmoothingEnabled = false;
  x.drawImage(im, Math.round((cv.width - im.width * s) / 2), cv.height - im.height * s, im.width * s, im.height * s);
  if (info)
    info.textContent = `${im.kit ? `${im.kit.head} head, ${im.kit.build} build. ` : ''}Built in ${im.ms} ms; ${im.width} × ${im.height} px at ${E.view === 'head' ? 128 : 64} px a metre.`;
  return true;
}
/** the turntable's clock: 12 pictures a second while it spins or the figure moves; stops when the section closes */
function figureEditorTick() {
  const E = figureEditor;
  E.timer = 0;
  if (E.spin) E.turn = (E.turn + 1 / 48) % 2;
  E.frame++;
  if (!figureEditorDraw()) return;
  const t = /** @type {HTMLInputElement | null} */ ($('#figTurn'));
  if (t && E.spin) t.value = String(E.turn);
  if (E.spin || E.clip !== 'idle') E.timer = window.setTimeout(figureEditorTick, 1000 / 12);
}
/** after the section is drawn: its pickers, and the turntable going */
function figureEditorStart() {
  const E = figureEditor,
    on = (/** @type {string} */ id, /** @type {(v: string) => void} */ f) => {
      const el = /** @type {HTMLInputElement | null} */ ($('#' + id));
      if (el) el.oninput = () => f(el.value);
    };
  on('figWho', v => {
    E.who = v;
    figureEditorDraw();
  });
  on('figHead', v => {
    E.head = v;
    render();
  });
  on('figBuild', v => {
    E.build = v;
    render();
  });
  on('figStyle', v => {
    E.style = v;
    figureEditorDraw();
  });
  on('figClip', v => {
    E.clip = v;
    figureEditorRun();
  });
  on('figTurn', v => {
    E.turn = +v;
    E.spin = false;
    figureEditorDraw();
  });
  for (const el of $$('[data-fig-pick]'))
    /** @type {HTMLSelectElement} */ (el).onchange = () => {
      const t = /** @type {keyof typeof E.pick} */ (/** @type {HTMLElement} */ (el).dataset.figPick);
      E.pick[t] = /** @type {HTMLSelectElement} */ (el).value;
      render();
    };
  figureEditorRun();
}
/** the turntable started again (or drawn once when nothing moves) */
function figureEditorRun() {
  const E = figureEditor;
  if (E.timer) clearTimeout(E.timer);
  E.timer = 0;
  figureEditorTick();
}
/* an edit to the kit, a look or the wardrobe draws it again at once (figurePreview builds it again) */
studioState.hooks.figures = (/** @type {string} */ path) => {
  if (/^(figureKit|people|wardrobe)\./.test(path)) figureEditorDraw();
};

/* ---------- actions ---------- */
ACTIONS.figTab = (/** @type {DOMStringMap} */ d) => {
  figureEditor.tab = d.v || 'heads';
  render();
};
ACTIONS.figView = (/** @type {DOMStringMap} */ d) => {
  figureEditor.view = d.v === 'head' ? 'head' : 'whole';
  render();
};
ACTIONS.figSpin = () => {
  figureEditor.spin = !figureEditor.spin;
  render();
};
/** the head shape and build tried on this person written into their `figure` */
ACTIONS.figSaveChoice = () => {
  const E = figureEditor,
    P = studioState.D.people[E.who];
  if (!P || (!E.head && !E.build)) return;
  P.figure = { ...(P.figure || {}), ...(E.head ? { head: E.head } : {}), ...(E.build ? { build: E.build } : {}) };
  E.head = '';
  E.build = '';
  changed();
  render();
  toast(`${E.who} has this head and build now`);
};
/** a head shape or build copied under a new name */
ACTIONS.figCopy = (/** @type {DOMStringMap} */ d) => {
  const t = /** @type {'heads' | 'builds'} */ (d.t),
    K = figureKitOf(),
    k = figureEditor.pick[t],
    n = uniqueKey(k, (/** @type {string} */ x) => !!K[t][x]),
    v = clone(K[t][k]);
  if (t === 'heads') delete v.random;
  K[t][n] = v;
  figureEditor.pick[t] = n;
  changed();
  render();
};
/** a wardrobe item without shapes given a plain dome on the head (a hat) or a ball on the chest */
ACTIONS.figAccNew = () => {
  const sel = /** @type {HTMLSelectElement | null} */ ($('#figAccNew')),
    id = sel && sel.value,
    K = figureKitOf(),
    W = studioState.D.wardrobe;
  if (!id || K.accessories[id]) return;
  const head = W.items[id].slot === 'hat' || W.items[id].slot === 'glasses';
  K.accessories[id] = head
    ? {
        rows: [
          {
            id: 'hat',
            shape: { kind: 'dome', y: 'yb - 0.01', h: 'top - yb + 0.02', sx: 'bx * 0.98', sz: 'bz * 0.98', cut: -0.05 },
            col: W.items[id].slot === 'hat' ? 'hat' : 'gear',
          },
        ],
      }
    : {
        rows: [
          {
            id: id,
            parent: 'torso',
            at: [0, '0.3 * tk', 'torsoZ + 0.02'],
            shape: { kind: 'ellipsoid', c: [0, 0, 0], r: [0.04, 0.04, 0.03], seg: 8, rings: 5 },
            col: W.items[id].slot === 'bag' ? 'bag' : 'neck',
          },
        ],
      };
  figureEditor.pick.accessories = id;
  changed();
  render();
};
ACTIONS.figRowDup = (/** @type {DOMStringMap} */ d) => {
  const A = figureKitOf().accessories[figureEditor.pick.accessories],
    i = +(d.i || 0),
    r = clone(A.rows[i]);
  r.id = uniqueKey(r.id, (/** @type {string} */ x) => A.rows.some((/** @type {any} */ q) => q.id === x));
  A.rows.splice(i + 1, 0, r);
  changed();
  render();
};
ACTIONS.figRowDel = (/** @type {DOMStringMap} */ d) => {
  const A = figureKitOf().accessories[figureEditor.pick.accessories];
  if (A.rows.length < 2) return;
  A.rows.splice(+(d.i || 0), 1);
  changed();
  render();
};
