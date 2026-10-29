'use strict';
/* ================= POCKET BILLIES STUDIO · figures (characters track CH-5) =================
   The figure kit's shapes (game/data/figureKit.json) with a turntable: everyone's 3D figure is built from their look
   by the kit (game/js/logic/figure-kit.js), and this section edits what it builds with: the head shapes, how far
   people vary from theirs, the builds and their gaits, the proportions, each hair style's recipe and each
   accessory's shapes (hats, the headset, neckwear, bags). The preview is the game's own figure baker
   (figures.js figurePreview) on the unsaved data: pick a person, try another head shape or build on them, turn them
   round, look at the head close up, and see an edit as soon as it is typed. An accessory's values are numbers or
   sums of the head's or body's frame ('bx * 0.98'), so one hat fits every head. CH-5b: the clothes (each garment's
   knobs, rows and marks, the pieces garments share) and the directions' flair, tried on the turntable. */
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
  colorField,
  numberField,
  rangeField,
  readPath,
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
  FIGURE_FACE_PARTS: [() => FIGURE_FACE_PARTS],
  FIGURE_GARMENT_KNOBS: [() => FIGURE_GARMENT_KNOBS],
  FIGURE_MARK_ITEMS: [() => FIGURE_MARK_ITEMS],
  FIGURE_ROW_KINDS: [() => FIGURE_ROW_KINDS],
  FIGURE_STYLE_NAMES: [() => FIGURE_STYLE_NAMES],
  FIGURE_WHOLE: [() => FIGURE_WHOLE],
  figureClothesTab: [() => figureClothesTab, v => (figureClothesTab = v)],
  figureEditor: [() => figureEditor],
  figureEditorDraw: [() => figureEditorDraw, v => (figureEditorDraw = v)],
  figureEditorFace: [() => figureEditorFace, v => (figureEditorFace = v)],
  figureEditorRun: [() => figureEditorRun, v => (figureEditorRun = v)],
  figureEditorStart: [() => figureEditorStart, v => (figureEditorStart = v)],
  figureEditorTab: [() => figureEditorTab, v => (figureEditorTab = v)],
  figureEditorTick: [() => figureEditorTick, v => (figureEditorTick = v)],
  figureFacesTab: [() => figureFacesTab, v => (figureFacesTab = v)],
  figureFieldHTML: [() => figureFieldHTML, v => (figureFieldHTML = v)],
  figureFieldsHTML: [() => figureFieldsHTML, v => (figureFieldsHTML = v)],
  figureKeys: [() => figureKeys],
  figureKitOf: [() => figureKitOf],
  figureMarksHTML: [() => figureMarksHTML, v => (figureMarksHTML = v)],
  figureRowsHTML: [() => figureRowsHTML, v => (figureRowsHTML = v)],
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
  pick: {
    heads: 'round',
    builds: 'average',
    hair: 'hair_short',
    accessories: 'hat_cap',
    clothes: 'tee',
    pieces: 'collar',
    flair: 'scarf',
  },
  /* CH-6: the face tried on the turntable (eye and brow styles, '' their own; an expression; talking; a blink) and
     the Faces tab's part and picks */
  eyes: '',
  brows: '',
  expr: 'idle',
  talk: false,
  blinkT: 0,
  facePart: 'eyes',
  facePick: { eyes: 'round', eyeFrames: 'open', brows: 'soft', mouths: 'smile', expressions: 'idle' },
  timer: 0,
  error: '',
};
/** the kit's parts this section edits: its key in figureKit.json, the tab's name */
const FIGURE_EDIT_TABS = [
  ['heads', 'Head shapes'],
  ['builds', 'Builds'],
  ['hair', 'Hair'],
  ['accessories', 'Hats & things'],
  ['clothes', 'Clothes'],
  ['flair', 'Flair'],
  ['faces', 'Faces'],
  ['body', 'Variety & proportions'],
];
/** CH-6: the Faces tab's parts (figureKit.json faces), the name of each */
const FIGURE_FACE_PARTS = [
  ['eyes', 'Eye styles'],
  ['eyeFrames', 'Eye frames'],
  ['brows', 'Brows'],
  ['mouths', 'Mouths'],
  ['expressions', 'Expressions'],
  ['skin', 'Skin'],
  ['wardrobe', 'Wardrobe'],
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
/** a part of the kit's names, without its note @param {Record<string, any> | undefined} o */
const figureKeys = o => Object.keys(o || {}).filter(k => k !== 'note');
/** CH-5b: the clothes' knobs the Clothes tab offers, by the item's slot: [key, label, kind, choices or help] */
const FIGURE_GARMENT_KNOBS = {
  top: [['sleeves', 'Sleeves', ['none', 'short', 'long']]],
  outer: [
    ['covers', 'Covers the arms and collar', 'on'],
    ['puff', 'Sleeves’ bulk', 'num', '1.08'],
    ['open', 'Open front (lapels)', 'bool'],
    ['long', 'To the knees (no belt; tails)', 'bool'],
  ],
  bottom: [
    ['legs', 'Legs', ['full', 'shorts', 'skirt']],
    ['fit', 'Legs’ width', 'num', '1.06'],
    ['belt', 'A belt', 'on'],
  ],
  shoes: [
    ['length', 'Foot’s length', 'num', '1'],
    [
      'sole',
      'Sole',
      [
        ['', 'Dark'],
        ['1', 'Its second colour'],
      ],
    ],
    ['boot', 'Up the shin', 'bool'],
    ['flat', 'A sandal (bare foot)', 'bool'],
  ],
};

SECTIONS.figures = () => {
  const D = studioState.D,
    K = figureKitOf();
  if (!K)
    return `<div class="ed-col solo"><h2>Figures</h2><p class="help">This game data has no figure kit (game/data/figureKit.json).</p></div>`;
  const E = figureEditor;
  if (!D.people[E.who]) E.who = 'chosen' in D.people ? 'chosen' : Object.keys(D.people)[0];
  for (const t of [...FIGURE_EDIT_TABS.map(x => x[0]), 'pieces'])
    if (t !== 'body' && t !== 'faces' && !(K[t] || {})[E.pick[t]]) E.pick[t] = figureKeys(K[t])[0] || '';
  for (const [t] of FIGURE_FACE_PARTS)
    if (t !== 'wardrobe' && t !== 'skin' && K.faces && !K.faces[t][E.facePick[t]])
      E.facePick[t] = Object.keys(K.faces[t])[0] || '';
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
   <div class="seg-row"><button class="btn" data-act="figSaveChoice" ${E.head || E.build ? '' : 'disabled'} title="Write the head shape and build tried here into this person's figure (people/${escapeHtml(E.who)}.json)">Give ${escapeHtml(E.who)} this head and build</button></div>
   ${
     K.faces
       ? `<div class="grid">${sel(
           'figEyes',
           'Eyes',
           opt('', 'Their own', E.eyes) +
             Object.keys(K.faces.eyes)
               .map(k => opt(k, k, E.eyes))
               .join('')
         )}${sel(
           'figBrows',
           'Brows',
           opt('', 'Their own', E.brows) +
             Object.keys(K.faces.brows)
               .map(k => opt(k, k, E.brows))
               .join('')
         )}${sel(
           'figExpr',
           'Face',
           Object.keys(K.faces.expressions)
             .map(k => opt(k, k, E.expr))
             .join('')
         )}</div>
   <div class="seg-row"><button class="seg sm ${E.talk ? 'on' : ''}" data-act="figTalk" aria-pressed="${E.talk}">Talk</button><button class="btn sm" data-act="figBlink">Blink</button>
   <button class="btn" data-act="figSaveFace" ${E.eyes || E.brows ? '' : 'disabled'} title="Write the eye and brow styles tried here into this person's figure (people/${escapeHtml(E.who)}.json)">Give ${escapeHtml(E.who)} these eyes and brows</button></div>`
       : ''
   }`;
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
      `<div class="seg-row"><label class="fld"><span>${what}</span><select data-fig-pick="${t}">${figureKeys(K[t])
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
          figureRowsHTML(`${q}.rows`, A.rows, k.startsWith('hat') || k === 'headset' ? 'head' : 'torso'),
        {
          sub: `Rows of shapes. A value is a number or a sum of the frame’s values: round a hat k, rx, yb (its band), zc, bx, bz, top; the head k, hx, hy, c1; the body tk, girth, hipK, torsoZ; with sqrt, sin, cos and pi.`,
        }
      );
    }
    case 'clothes':
      return figureClothesTab();
    case 'flair': {
      const k = E.pick.flair,
        q = `${p}.flair.${k}`,
        A = (K.flair || {})[k];
      if (!A) return card('Flair', '<p class="help">This kit has no flair.</p>');
      return card(
        'Flair',
        pickRow('flair', 'Flair') +
          (A.vars ? `<h4>Named values</h4>${figureFieldsHTML(`${q}.vars`, A.vars, true)}` : '') +
          figureRowsHTML(`${q}.rows`, A.rows, k === 'goggles' || k === 'earrings' ? 'head' : 'torso'),
        {
          sub: `A direction’s extras (figures.js FIGURE_LOOKS says who wears which), on the turntable now. Sums may use the body’s frame (as Clothes) and the head’s: hx, hy, hz, c1, c2. Their colours are the kit’s own.`,
        }
      );
    }
    case 'faces':
      return figureFacesTab();
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

/** CH-6: the Faces tab: eye styles and frames, brows, mouth frames (rows of marks), expressions and which style each
 * wardrobe id draws (figureKit.json faces); the turntable shows the part being edited */
function figureFacesTab() {
  const E = figureEditor,
    F = figureKitOf().faces,
    q = 'figureKit.faces',
    part = E.facePart,
    k = /** @type {Record<string, string>} */ (E.facePick)[part],
    parts = `<div class="seg-row" role="tablist">${FIGURE_FACE_PARTS.map(
      ([t, n]) =>
        `<button class="seg sm ${part === t ? 'on' : ''}" role="tab" aria-selected="${part === t}" data-act="figFacePart" data-v="${t}">${n}</button>`
    ).join('')}</div>`,
    pickRow = (/** @type {string} */ what, /** @type {string} */ extra = '') =>
      `<div class="seg-row"><label class="fld"><span>${what}</span><select data-fig-face="${part}">${Object.keys(
        F[part]
      )
        .map(x => `<option value="${escapeHtml(x)}" ${x === k ? 'selected' : ''}>${escapeHtml(x)}</option>`)
        .join('')}</select></label>${extra}</div>`,
    num = (/** @type {string} */ label, /** @type {string} */ key, /** @type {any} */ o = {}) =>
      numberField(label, `${q}.${part}.${k}.${key}`, { opt: true, step: 0.001, ...o }),
    chk = (/** @type {string} */ label, /** @type {string} */ key) => checkboxField(label, `${q}.${part}.${k}.${key}`),
    copy = `<button class="btn" data-act="figFaceCopy">+ Copy as new</button>`,
    frames = Object.keys(F.mouths).map(x => [x, x]);
  let body = '';
  switch (part) {
    case 'eyes': {
      const ES = F.eyes[k];
      body =
        pickRow('Eye style', copy) +
        `<div class="grid">${num('Width', 'w')}${num('Height', 'h')}${num('Apart', 'gap', { ph: '1', step: 0.01 })}${num('Iris', 'iris', { ph: '1', step: 0.01 })}${num('Lash flicks', 'flicks', { ph: '1', step: 1 })}${num('Outer lash (wing)', 'wing', { ph: '1', step: 0.05 })}
        ${chk('Shaded lid', 'shade')}${chk('Bags under', 'bags')}${chk('Lines (close-ups)', 'lines')}${chk('Always blushes', 'blush')}</div>` +
        (ES.lid
          ? `<h4>Heavy lid (y, width, height as parts of the eye)</h4>${figureFieldsHTML(`${q}.eyes.${k}.lid`, ES.lid, false)}`
          : '');
      break;
    }
    case 'eyeFrames':
      body =
        pickRow('Eye frame') +
        `<div class="grid">${num('Open', 'open', { ph: '1', step: 0.05 })}${num('Scale', 'scale', { ph: '1', step: 0.01 })}${num('Iris', 'iris', { ph: '1', step: 0.01 })}${num('Angry slant', 'slant', { step: 1 })}${num('Glance', 'look', { step: 1 })}
        ${chk('Shut', 'shut')}${chk('Happy (shut, curved up)', 'happy')}${chk('Flat lid', 'flat')}</div>`;
      break;
    case 'brows':
      body =
        pickRow('Brow style', copy) +
        `<div class="grid">${num('Width', 'w')}${num('Thickness', 't')}${num('Arch', 'arch', { ph: '0' })}${num('Tilt', 'tilt', { ph: '0', step: 0.5, help: 'Above 0 down to the nose' })}${num('One side up', 'uneven', { ph: '0' })}
        ${chk('Flat', 'flat')}${chk('Peaked', 'peak')}${chk('Knit (a crease between)', 'knit')}${chk('Bushy', 'bushy')}</div>`;
      break;
    case 'mouths': {
      const rows = F.mouths[k];
      body =
        pickRow('Mouth frame') +
        rows
          .map(
            (/** @type {any} */ m, /** @type {number} */ i) =>
              `<fieldset class="fig-row"><legend>${escapeHtml(m.kind)}</legend><div class="grid">${textField('Kind', `${q}.mouths.${k}.${i}.kind`)}${[
                'x',
                'y',
                'w',
                'h',
                't',
                'min',
              ]
                .map(x => numberField(x, `${q}.mouths.${k}.${i}.${x}`, { opt: x !== 'w' && x !== 'h', step: 0.001 }))
                .join('')}${selectField(
                'Shape',
                `${q}.mouths.${k}.${i}.shape`,
                ['oval', 'arc', 'cap', 'slant'].map(x => [x, x]),
                { none: 'A block', opt: true }
              )}${selectField(
                'Slant',
                `${q}.mouths.${k}.${i}.dir`,
                [
                  ['1', 'Down to the right'],
                  ['-1', 'Down to the left'],
                ],
                { none: '-', opt: true, num: true }
              )}${textField('Colour slot', `${q}.mouths.${k}.${i}.col`, { opt: true, ph: m.kind })}${checkboxField('Close-ups only', `${q}.mouths.${k}.${i}.close`)}</div>
              <div class="seg-row"><button class="btn sm" data-act="figMarkDup" data-i="${i}">Duplicate</button><button class="btn sm" data-act="figMarkDel" data-i="${i}" ${rows.length > 1 ? '' : 'disabled'}>Delete</button></div></fieldset>`
          )
          .join('');
      break;
    }
    case 'expressions': {
      const X = F.expressions[k];
      body =
        pickRow('Expression') +
        `<div class="grid">${selectField(
          'Eyes',
          `${q}.expressions.${k}.eyes`,
          Object.keys(F.eyeFrames).map(x => [x, x])
        )}${selectField('Mouth', `${q}.expressions.${k}.mouth`, frames, { none: 'The look’s own', opt: true })}${num('Brow tilt', 'tilt', { ph: '0', step: 0.5 })}${num('Brow lift', 'lift', { ph: '0' })}${chk('Blush', 'blush')}</div>
        <h4>Talking frames</h4><div class="grid">${(X.talk || F.talk)
          .map((/** @type {string} */ _, /** @type {number} */ i) =>
            selectField(String(i + 1), X.talk ? `${q}.expressions.${k}.talk.${i}` : `${q}.talk.${i}`, frames)
          )
          .join(
            ''
          )}</div><p class="help">${X.talk ? 'This expression’s own.' : 'The kit’s, shared by every expression without its own.'} A line’s [${escapeHtml(k)}] shows this face.</p>`;
      break;
    }
    case 'skin':
      body = (F.skin || [])
        .map(
          (/** @type {any} */ R, /** @type {number} */ i) =>
            `<fieldset class="fig-row"><legend>${escapeHtml(R.base)}</legend><div class="grid">${[
              'Deep',
              'Shadow',
              'Base',
              'Light',
              'Shine',
            ]
              .map((n, j) => colorField(n, `${q}.skin.${i}.ramp.${j}`))
              .join('')}</div></fieldset>`
        )
        .join('');
      break;
    default:
      body = `<div class="grid">${Object.keys(F.wardrobe)
        .map(id => {
          const slot = /** @type {any} */ (studioState.D.wardrobe.items[id] || {}).slot,
            of = slot === 'eyes' ? F.eyes : slot === 'brows' ? F.brows : F.mouths;
          return selectField(
            id,
            `${q}.wardrobe.${id}`,
            Object.keys(of).map(x => [x, x])
          );
        })
        .join('')}</div>`;
  }
  return card('Faces', parts + body, {
    sub: 'The face is painted on as marks (sizes in metres on the usual head). The turntable shows what you edit; try Talk, Blink and a Face on it.',
  });
}

/**
 * CH-5b: rows of shapes (an accessory's, a garment's, a piece's, a flair's), each a fieldset with its fields, and
 * duplicate and delete by the rows' path; a group's rows inside it
 * @param {string} q the rows' path @param {any[]} rows @param {string} ph the part a row hangs from when it names none
 * @returns {string}
 */
function figureRowsHTML(q, rows, ph) {
  return rows
    .map((/** @type {any} */ r, /** @type {number} */ i) => {
      const at = `${q}.${i}`,
        tags = [r.sides ? 'A and B' : r.repeat ? `×${r.repeat}` : '', r.stage || '', r.when ? `when ${r.when}` : '']
          .filter(Boolean)
          .join(', ');
      return `<fieldset class="fig-row"><legend>${escapeHtml(r.id)}${tags ? ` (${escapeHtml(tags)})` : ''}</legend>
        <div class="grid">${textField('Id', `${at}.id`)}${
          r.rows
            ? ''
            : `${textField('On part', `${at}.parent`, { opt: true, ph })}${textField('Colour slot', `${at}.col`)}${selectField(
                'Shape',
                `${at}.shape.kind`,
                FIGURE_ROW_KINDS.map(x => [x, x])
              )}`
        }${checkboxField('Mirrored A and B', `${at}.sides`)}${textField('Only when', `${at}.when`, { opt: true, ph: 'always' })}</div>
        ${r.vars ? `<h5>Named values</h5>${figureFieldsHTML(`${at}.vars`, r.vars, true)}` : ''}
        ${r.at ? `<h5>At</h5>${figureFieldsHTML(`${at}.at`, r.at, true)}` : ''}
        ${r.shape ? figureFieldsHTML(`${at}.shape`, r.shape, true, ['kind']) : ''}
        ${r.rows ? `<h5>For each side, in order</h5>${figureRowsHTML(`${at}.rows`, r.rows, ph)}` : ''}
        <div class="seg-row"><button class="btn sm" data-act="figRowDup" data-q="${q}" data-i="${i}">Duplicate</button><button class="btn sm" data-act="figRowDel" data-q="${q}" data-i="${i}" ${rows.length > 1 ? '' : 'disabled'}>Delete</button></div></fieldset>`;
    })
    .join('');
}
/** CH-5b: marks painted on a part (buttons, pockets, a zip), each its fields @param {string} q @param {any[]} marks */
function figureMarksHTML(q, marks) {
  return marks
    .map(
      (/** @type {any} */ m, /** @type {number} */ i) =>
        `<fieldset class="fig-row"><legend>${escapeHtml(m.id)} (${escapeHtml(m.kind)}${m.sides ? ', A and B' : m.repeat ? `, ×${m.repeat}` : ''})</legend>
        <div class="grid">${textField('Id', `${q}.${i}.id`)}${textField('Kind', `${q}.${i}.kind`)}${textField('On part', `${q}.${i}.part`)}${textField('Colour slot', `${q}.${i}.col`)}${checkboxField('Mirrored A and B', `${q}.${i}.sides`)}${textField('Only when', `${q}.${i}.when`, { opt: true, ph: 'always' })}</div>
        ${figureFieldsHTML(`${q}.${i}`, { at: m.at, w: m.w, h: m.h, ...(m.repeat ? { repeat: m.repeat } : {}), ...(m.vars ? { vars: m.vars } : {}) }, true)}
        <div class="seg-row"><button class="btn sm" data-act="figRowDup" data-q="${q}" data-i="${i}">Duplicate</button><button class="btn sm" data-act="figRowDel" data-q="${q}" data-i="${i}">Delete</button></div></fieldset>`
    )
    .join('');
}
/** CH-5b: the Clothes tab: a garment's knobs, rows and marks (on the turntable's person), then the shared pieces */
function figureClothesTab() {
  const E = figureEditor,
    K = figureKitOf(),
    W = studioState.D.wardrobe,
    p = 'figureKit',
    C = K.clothes || {},
    k = E.pick.clothes,
    G = C[k],
    q = `${p}.clothes.${k}`,
    slot = (W.items[k] || {}).slot || '',
    free = Object.keys(W.items).filter(id => FIGURE_GARMENT_KNOBS[W.items[id].slot] && !C[id]),
    pick = `<div class="seg-row"><label class="fld"><span>Garment</span><select data-fig-pick="clothes">${figureKeys(C)
      .map(
        id =>
          `<option value="${escapeHtml(id)}" ${id === k ? 'selected' : ''}>${escapeHtml(((W.items[id] || {}).name || id) + ' · ' + ((W.items[id] || {}).slot || '?'))}</option>`
      )
      .join('')}</select></label>${
      free.length
        ? `<label class="fld"><span>Clothes for</span><select id="figClothNew">${free.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(W.items[id].name || id)}</option>`).join('')}</select></label><button class="btn" data-act="figClothNew">+ Give it clothes</button>`
        : ''
    }</div>`;
  if (!G) return card('Clothes', pick + '<p class="help">This kit has no clothes.</p>');
  const knob = (/** @type {string} */ base, /** @type {any[]} */ [key, label, kind, extra]) => {
    const at = `${base}.${key}`;
    if (Array.isArray(kind))
      return selectField(
        label,
        at,
        kind.map(x => (Array.isArray(x) ? x : [x, x])),
        { opt: true, num: key === 'sole' }
      );
    if (kind === 'on') {
      const v = readPath(at);
      return `<label class="fld chk"><input type="checkbox" data-p="${at}" data-k="bool" ${v !== false ? 'checked' : ''}><span>${label}</span></label>`;
    }
    if (kind === 'num') return numberField(label, at, { opt: true, step: 0.01, ph: extra });
    return checkboxField(label, at);
  };
  const outerOf = G.outer ? `${q}.outer` : '';
  const garmentHTML = (/** @type {string} */ at, /** @type {any} */ g, /** @type {string} */ sl) =>
    `<div class="grid">${(FIGURE_GARMENT_KNOBS[sl] || []).map(x => knob(at, x)).join('')}</div>` +
    (g.use && g.use.length
      ? `<p class="help">Uses ${g.use.map((/** @type {string} */ u) => escapeHtml(u)).join(', ')} (below), then its own rows.</p>`
      : '') +
    (g.stripe ? `<h4>Stripes</h4>${figureFieldsHTML(`${at}.stripe`, g.stripe, false)}` : '') +
    (g.rows && g.rows.length ? `<h4>Shapes</h4>${figureRowsHTML(`${at}.rows`, g.rows, 'torso')}` : '') +
    (g.marks && g.marks.length ? `<h4>Marks</h4>${figureMarksHTML(`${at}.marks`, g.marks)}` : '') +
    `<div class="seg-row"><button class="btn sm" data-act="figClothRow" data-q="${at}">+ A shape</button><button class="btn sm" data-act="figClothMark" data-q="${at}">+ A mark</button></div>`;
  const pk = E.pick.pieces,
    P = (K.pieces || {})[pk];
  return (
    card(
      'Clothes',
      pick +
        garmentHTML(q, G, slot) +
        (outerOf
          ? `<fieldset class="fig-row"><legend>Worn as an outer</legend>${garmentHTML(outerOf, G.outer, 'outer')}</fieldset>`
          : ''),
      {
        sub: `What each wardrobe item is on the figure: its knobs dress the body’s own parts (the arms, legs and feet), its shapes and marks are added. A shape’s stage is when it is added (torso; shell, after the legs; details). Sums may use the body’s frame: tk, girth, hipK, shK, legK, armK, thighL, shinL, legR, armR, hipW, waist, belly, chest, chestOut, neckL, torsoZ, the torso’s profile trx0..trx6 and trz0..trz6 (bottom to top), s and i; “only when” names bare, open, long, belted, belt, boot, neck or hat (! for not). The turntable’s person wears it.`,
      }
    ) +
    (P
      ? card(
          'Shared pieces',
          `<div class="seg-row"><label class="fld"><span>Piece</span><select data-fig-pick="pieces">${figureKeys(
            K.pieces
          )
            .map(id => `<option value="${escapeHtml(id)}" ${id === pk ? 'selected' : ''}>${escapeHtml(id)}</option>`)
            .join('')}</select></label></div>` +
            (P.rows ? figureRowsHTML(`${p}.pieces.${pk}.rows`, P.rows, 'torso') : '') +
            (P.marks ? figureMarksHTML(`${p}.pieces.${pk}.marks`, P.marks) : ''),
          { sub: 'Rows and marks many garments use (a collar, a belt): edit them once here.' }
        )
      : '')
  );
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
    try1 = {
      ...(E.head ? { head: E.head } : {}),
      ...(E.build ? { build: E.build } : {}),
      ...(E.eyes ? { eyes: E.eyes } : {}),
      ...(E.brows ? { brows: E.brows } : {}),
    },
    figure = Object.keys(try1).length ? { ...(own || {}), ...try1 } : own || undefined,
    look0 = P.creature ? P : cleanLook(P.look || null),
    /* CH-5b: the Clothes tab's garment worn (in its own slot) */
    cloth = E.tab === 'clothes' ? E.pick.clothes : '',
    clothSlot = cloth && D.wardrobe.items[cloth] ? D.wardrobe.items[cloth].slot : '',
    look =
      clothSlot && look0 && !P.creature ? { ...look0, wear: { ...(look0.wear || {}), [clothSlot]: cloth } } : look0,
    flairOn = E.tab === 'flair' ? E.pick.flair : '',
    /* built again when the kit (but its faces), the look or the head and build change (a hash of them); CH-6: the face
       painted again, on the same mesh, when the faces or the eyes and brows change */
    { faces, ...body } = K,
    { eyes, brows, ...shape } = figure || {},
    rev = figureSeed(JSON.stringify([body, look, shape, flairOn])),
    faceRev = figureSeed(JSON.stringify([faces, eyes || null, brows || null])),
    face = figureEditorFace();
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
      faceRev,
      face,
      flair: flairOn || undefined,
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
  if (E.spin || E.clip !== 'idle' || E.talk || E.blinkT > performance.now())
    E.timer = window.setTimeout(figureEditorTick, 1000 / 12);
}
/** CH-6: the face on the turntable: the expression picked, or the Faces tab's eye frame or mouth frame being edited;
 * talking runs through its frames, a blink shuts the eyes */
function figureEditorFace() {
  const E = figureEditor,
    ft = E.tab === 'faces' ? E.facePart : '',
    expr = ft === 'expressions' ? E.facePick.expressions : E.expr,
    left = E.blinkT - performance.now();
  return {
    expr,
    ...(ft === 'eyeFrames' ? { eyes: E.facePick.eyeFrames } : {}),
    ...(ft === 'mouths' && !E.talk ? { mouth: E.facePick.mouths } : {}),
    ...(E.talk ? { talk: Math.floor(E.frame / 1.5) } : {}),
    ...(left > 0 ? { blink: left > 150 || left < 50 ? 1 : 2 } : {}),
  };
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
  on('figEyes', v => {
    E.eyes = v;
    render();
  });
  on('figBrows', v => {
    E.brows = v;
    render();
  });
  on('figExpr', v => {
    E.expr = v;
    figureEditorDraw();
  });
  for (const el of $$('[data-fig-face]'))
    /** @type {HTMLSelectElement} */ (el).onchange = () => {
      const t = /** @type {keyof typeof E.facePick} */ (/** @type {HTMLElement} */ (el).dataset.figFace);
      E.facePick[t] = /** @type {HTMLSelectElement} */ (el).value;
      render();
    };
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
  const rows = readPath(d.q || ''),
    i = +(d.i || 0);
  if (!Array.isArray(rows)) return;
  const r = clone(rows[i]);
  r.id = uniqueKey(r.id, (/** @type {string} */ x) => rows.some((/** @type {any} */ q) => q.id === x));
  rows.splice(i + 1, 0, r);
  changed();
  render();
};
ACTIONS.figRowDel = (/** @type {DOMStringMap} */ d) => {
  const rows = readPath(d.q || '');
  if (!Array.isArray(rows) || (rows.length < 2 && !/\.marks$/.test(d.q || ''))) return;
  rows.splice(+(d.i || 0), 1);
  changed();
  render();
};
/** CH-5b: a wardrobe item given clothes: a top, bottom or shoes dressed as the kit's tee, trousers or sneakers, an
 * outer as a plain jacket (copies, edited apart) */
ACTIONS.figClothNew = () => {
  const sel = /** @type {HTMLSelectElement | null} */ ($('#figClothNew')),
    id = sel && sel.value,
    K = figureKitOf(),
    W = studioState.D.wardrobe;
  if (!id || !K.clothes || K.clothes[id]) return;
  const slot = W.items[id].slot,
    like = { top: 'tee', bottom: 'trousers', shoes: 'sneakers', outer: 'denim_jacket' }[slot];
  K.clothes[id] = like && K.clothes[like] ? clone(K.clothes[like]) : {};
  figureEditor.pick.clothes = id;
  changed();
  render();
};
/** CH-5b: a shape or a mark added to a garment */
ACTIONS.figClothRow = (/** @type {DOMStringMap} */ d) => {
  const G = readPath(d.q || '');
  if (!G) return;
  (G.rows = G.rows || []).push({
    id: uniqueKey('patch', (/** @type {string} */ x) => G.rows.some((/** @type {any} */ q) => q.id === x)),
    parent: 'torso',
    at: [0, '0.2 * tk', 'trz3'],
    shape: { kind: 'ellipsoid', c: [0, 0, 0], r: [0.04, 0.04, 0.02], seg: 8, rings: 5 },
    col: 'top2',
  });
  changed();
  render();
};
ACTIONS.figClothMark = (/** @type {DOMStringMap} */ d) => {
  const G = readPath(d.q || '');
  if (!G) return;
  (G.marks = G.marks || []).push({
    id: uniqueKey('mark', (/** @type {string} */ x) => G.marks.some((/** @type {any} */ q) => q.id === x)),
    kind: 'button',
    part: 'torso',
    at: [0, '0.2 * tk', 'trz3 + 0.01'],
    w: 0.02,
    h: 0.02,
    col: 'button',
  });
  changed();
  render();
};
/* CH-6: the face */
ACTIONS.figFacePart = (/** @type {DOMStringMap} */ d) => {
  figureEditor.facePart = d.v || 'eyes';
  render();
};
ACTIONS.figTalk = () => {
  figureEditor.talk = !figureEditor.talk;
  render();
};
ACTIONS.figBlink = () => {
  figureEditor.blinkT = performance.now() + 200;
  figureEditorRun();
};
/** the eye and brow styles tried on this person written into their `figure` */
ACTIONS.figSaveFace = () => {
  const E = figureEditor,
    P = studioState.D.people[E.who];
  if (!P || (!E.eyes && !E.brows)) return;
  P.figure = { ...(P.figure || {}), ...(E.eyes ? { eyes: E.eyes } : {}), ...(E.brows ? { brows: E.brows } : {}) };
  E.eyes = '';
  E.brows = '';
  changed();
  render();
  toast(`${E.who} has these eyes and brows now`);
};
/** an eye or brow style copied under a new name */
ACTIONS.figFaceCopy = () => {
  const E = figureEditor,
    t = /** @type {'eyes' | 'brows'} */ (E.facePart),
    F = figureKitOf().faces,
    k = E.facePick[t],
    n = uniqueKey(k, (/** @type {string} */ x) => !!F[t][x]);
  F[t][n] = clone(F[t][k]);
  E.facePick[t] = n;
  changed();
  render();
};
ACTIONS.figMarkDup = (/** @type {DOMStringMap} */ d) => {
  const rows = figureKitOf().faces.mouths[figureEditor.facePick.mouths],
    i = +(d.i || 0);
  rows.splice(i + 1, 0, clone(rows[i]));
  changed();
  render();
};
ACTIONS.figMarkDel = (/** @type {DOMStringMap} */ d) => {
  const rows = figureKitOf().faces.mouths[figureEditor.facePick.mouths];
  if (rows.length < 2) return;
  rows.splice(+(d.i || 0), 1);
  changed();
  render();
};
