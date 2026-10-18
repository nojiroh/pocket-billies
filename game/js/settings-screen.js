'use strict';
/* Focused additions to the existing UI and save system. */
/* the host page (an artifact viewer, for example) may set its own light/dark attribute; "Match device" leaves it alone */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  ACC,
  BG,
  accSettingsHTML,
  ambApply,
  audApply,
  audTest,
  closeModal,
  eng,
  galleryOpen,
  modal,
  openDressing,
  rebuildFromSettings,
  render,
  renderOv,
  runDiagTest,
  runQuickTest,
  toast,
  walkRenderer,
} from './hooks.js';
import { JOBS, MOVES, ROUTE, RULES, SP, STATUSN } from './game-data.js';
import {
  RM,
  S,
  SAVE_NEW_MSG,
  SAVE_OLD_MSG,
  TEAM_MAX,
  U,
  esc,
  fmt,
  migrate,
  save,
  saveAge,
  setRM,
  setS,
  today,
} from './game-state.js';
import { I18N_LANGS, i18nSet } from './i18n.js';
import { FRAME } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { cleanLook, cleanTrainer, humanHTML, lookFromOld } from './person-art.js';
/* eslint-disable no-func-assign */
expose({
  GFX_DIALS: [() => GFX_DIALS],
  HOST_THEME: [() => HOST_THEME],
  SET_TABS: [() => SET_TABS],
  applyPreferences: [() => applyPreferences, v => (applyPreferences = v)],
  customizeTrainer: [() => customizeTrainer, v => (customizeTrainer = v)],
  exportSave: [() => exportSave, v => (exportSave = v)],
  gfxDial: [() => gfxDial, v => (gfxDial = v)],
  importSave: [() => importSave, v => (importSave = v)],
  setPref: [() => setPref, v => (setPref = v)],
  setRow: [() => setRow, v => (setRow = v)],
  setSeg: [() => setSeg, v => (setSeg = v)],
  setSw: [() => setSw, v => (setSw = v)],
  setVol: [() => setVol, v => (setVol = v)],
  settingsHTML: [() => settingsHTML, v => (settingsHTML = v)],
  settingsRefresh: [() => settingsRefresh, v => (settingsRefresh = v)],
  themeOwned: [() => themeOwned, v => (themeOwned = v)],
  validSave: [() => validSave, v => (validSave = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const HOST_THEME = document.documentElement.dataset.theme;
let themeOwned = false;
export function applyPreferences() {
  const p = S.preferences || {},
    root = document.documentElement;
  if (['light', 'dark'].includes(p.theme)) {
    root.dataset.theme = p.theme;
    themeOwned = true;
  } else if (themeOwned || root.dataset.theme === 'system') {
    if (HOST_THEME === 'light' || HOST_THEME === 'dark') root.dataset.theme = HOST_THEME;
    else delete root.dataset.theme;
    themeOwned = false;
  }
  setRM(p.motion === 'reduced' || (p.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches));
  document.documentElement.dataset.motion = RM ? 'reduced' : 'full';
  /* v30: accessibility: text size, high contrast, no flashing, bigger buttons */ root.dataset.text =
    p.textSize || 'normal';
  root.dataset.contrast = p.contrast === 'high' ? 'high' : 'normal';
  root.dataset.flash = p.flashes === 'off' ? 'off' : 'on';
  root.dataset.targets = p.bigTargets ? 'big' : 'normal';
  if (typeof i18nSet === 'function') i18nSet(p.lang || 'en');
}
function customizeTrainer() {
  openDressing();
}
export async function exportSave() {
  const json = JSON.stringify({ game: 'Pocket Billies', format: 1, save: S }, null, 2),
    name = 'pocket-billies-save-' + today() + '.json';
  const blob = new Blob([json], { type: 'application/json' }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Save backup downloaded.');
}
function validSave(o) {
  if (!o || typeof o !== 'object' || !o.started || typeof o.starter !== 'string') return false;
  const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
  if (
    !Array.isArray(o.team) ||
    !Array.isArray(o.box) ||
    !o.team.length ||
    o.team.length > Math.max(6, TEAM_MAX()) ||
    o.box.length > 5000
  )
    return false;
  const ids = new Set();
  for (const m of o.team.concat(o.box)) {
    if (
      !m ||
      !SP[m.sp] ||
      typeof m.uid !== 'string' ||
      ids.has(m.uid) ||
      !num(m.lvl, 1, 100) ||
      !Number.isInteger(m.lvl) ||
      !num(m.hp, 0, 9999) ||
      !num(m.xp, 0, 1e12) ||
      !Array.isArray(m.moves) ||
      !m.moves.length ||
      m.moves.length > 4 ||
      m.moves.some(k => !MOVES[k])
    )
      return false;
    ids.add(m.uid);
  }
  if (
    !o.route ||
    !Number.isInteger(o.route.node) ||
    !num(o.route.node, 0, ROUTE.length - 1) ||
    !num(o.route.prog, 0, 1e9) ||
    !o.day ||
    !num(o.day.steps, 0, 1e9) ||
    !num(o.se, 0, 1e12) ||
    !num(o.totalSteps, 0, 1e12)
  )
    return false;
  if (
    !Array.isArray(o.queue) ||
    o.queue.length > Math.max(10, RULES.steps.maxEncounters) ||
    o.queue.some(q => !q || !SP[q.sp] || !num(q.lvl, 1, 100))
  )
    return false;
  if (!Array.isArray(o.eggs) || o.eggs.some(e => !e || !num(e.prog, 0, 1e12))) return false;
  if (
    !Array.isArray(o.jobs) ||
    o.jobs.length > 12 ||
    o.jobs.some(
      j => !j || (j.uid && (!ids.has(j.uid) || !JOBS[j.job])) || !num(j.acc, 0, 1e12) || !num(j.pend, 0, 1e12)
    )
  )
    return false;
  for (const k of ['coins', 'items'])
    if (!o[k] || typeof o[k] !== 'object' || Object.values(o[k]).some(n => !num(n, 0, 1e12))) return false;
  const record = v => v && typeof v === 'object' && !Array.isArray(v) && !Object.hasOwn(v, '__proto__');
  if (
    !record(o.seen) ||
    !record(o.caught) ||
    !record(o.flags) ||
    !Array.isArray(o.seats) ||
    o.seats.some(v => typeof v !== 'string') ||
    Object.hasOwn(o, '__proto__')
  )
    return false;
  if (!num(o.meter, 0, 1e9) || !num(o.serial, 0, 1e12) || !num(o.seFrac, 0, 1) || !num(o.buddyRem, 0, 1e12))
    return false;
  for (const m of o.team.concat(o.box))
    if (
      typeof (m.nick || '') !== 'string' ||
      (m.status != null && !STATUSN[m.status]) ||
      (m.job != null &&
        (!Number.isInteger(m.job) || m.job < 0 || m.job >= o.jobs.length || o.jobs[m.job].uid !== m.uid))
    )
      return false;
  return true;
}
function importSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      if (file.size > 5e6) throw new Error();
      const data = JSON.parse(await file.text()),
        candidate = data.game === 'Pocket Billies' ? data.save : data,
        age = saveAge(candidate);
      if (age === 'old' || age === 'new') {
        toast((age === 'old' ? SAVE_OLD_MSG : SAVE_NEW_MSG.split('.')[0] + '.') + ' Your progress is unchanged.');
        return;
      }
      if (!validSave(candidate)) throw new Error();
      const next = migrate(candidate);
      U.modal = null;
      modal({
        title: 'Restore this backup?',
        html: `<p>Restore ${next.team.length} team members, ${next.box.length} in storage and ${fmt(next.totalSteps)} steps. This replaces your current progress.</p>`,
        btns: [
          {
            l: 'Restore backup',
            c: 'dark',
            f: () => {
              setS(next);
              S.avatar = cleanTrainer(S.avatar, S.gender);
              U.trainerDraft = null;
              U.tab = 'walk';
              U.dex = null;
              U.mq = [];
              U.learnQ = [];
              save();
              applyPreferences();
              closeModal();
              render();
              toast('Backup restored.');
            },
          },
          { l: 'Keep current progress', c: 'quiet', f: closeModal },
        ],
      });
    } catch (e) {
      toast('That file is not a valid Pocket Billies save. Your progress is unchanged.');
    }
  };
  input.click();
}
/* v31: settings in tabs (Game, Look, Sound, Controls, Save, Help), each choice a row with a one-line explanation and
   segmented buttons or a switch, so every option shows what it does and what it's set to without opening a menu */
/* alpha 0.5: settings in five groups: Sound, Graphics, Game, Save, Help */
const SET_TABS = [
  ['sound', 'Sound'],
  ['graphics', 'Graphics'],
  ['game', 'Game'],
  ['save', 'Save'],
  ['help', 'Help'],
];
/* the expert graphics dials: [group.key, label, what it does, cost, min, max, step, rebuild]. Each overrides the game's own value for this player */
export const GFX_DIALS = [
  [
    'Light and shadow',
    [
      ['shadows.strength', 'Shadows', 'How dark the shade under trees and houses is', 'medium', 0, 1, 0.05],
      [
        'shadows.selfShade',
        'Trees shade themselves',
        'Trunks and lower leaves in the crown’s shade',
        'low',
        0,
        1,
        0.05,
      ],
      ['sun.shafts', 'Light shafts', 'Rays from bright places toward the sun', 'medium', 0, 2, 0.05],
      ['air.godRays', 'God rays', 'Beams of light through leaves and between roofs', 'high', 0, 2, 0.05],
      ['lights.brightness', 'Lamps', 'How bright lamps and windows shine at night', 'low', 0.3, 2, 0.05],
    ],
  ],
  [
    'Air and weather',
    [
      ['air.mist', 'Low mist', 'Mist lying low over the ground', 'low', 0, 0.6, 0.02],
      ['sun.clouds', 'Clouds', 'How cloudy the sky is (and how much cloud shadow)', 'low', 0, 1, 0.05],
      ['sun.cloudShadows', 'Cloud shadows', 'How dark the drifting cloud shadows are', 'low', 0, 0.6, 0.02],
      ['air.particles', 'Particles', 'Pollen, leaves, snow and rain drops in the air', 'medium', 0, 1, 0.05],
    ],
  ],
  [
    'Ground and grass',
    [
      ['grass.density', 'Grass', 'How thick the grass grows', 'high', 0, 2, 0.05, 1],
      ['world.farProps', 'Far trees and hills', 'Things beyond the edge of the place', 'medium', 0, 600, 10, 1],
      ['water.reflection', 'Water reflections', 'How much the water mirrors', 'medium', 0, 1, 0.05],
    ],
  ],
  [
    'Effects',
    [
      ['lens.blur', 'Depth of field', 'Far and near things go soft', 'medium', 0, 3, 0.05],
      ['color.bloom', 'Glow', 'Bright lights glow', 'low', 0, 2, 0.05],
      ['lens.vignette', 'Dark corners', 'The edges of the picture darken a little', 'low', 0, 1, 0.05],
      ['lens.grain', 'Film grain', 'A fine grain over the picture', 'low', 0, 0.15, 0.005],
    ],
  ],
  ['Performance', [['quality.resolution', 'Sharpness', 'Fewer pixels draw faster', 'high', 0.4, 1, 0.05]]],
];
export function gfxDial([gk, label, help, cost, min, max, step]) {
  const [g, k] = gk.split('.'),
    own = ((S.preferences.eng || {})[g] || {})[k],
    v = own != null ? own : eng(g, k);
  return `<div class="gfx-dial"><div class="gfx-h"><b>${label}</b><span class="gfx-cost c-${cost}">${cost === 'high' ? 'Costs a lot' : cost === 'medium' ? 'Costs some' : 'Costs little'}</span>${own != null ? `<button type="button" class="gfx-reset" data-a="gfx-reset" data-k="${gk}" aria-label="Back to the game’s value">↺</button>` : ''}<button type="button" class="gfx-see" data-a="gfx-see" data-k="${gk}">See it</button></div>
 <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-eng="${gk}" aria-label="${esc(label)}"><small>${help}</small></div>`;
}
function setRow(title, hint, ctl) {
  return `<div class="set-row"><div class="set-t"><b>${title}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="set-c">${ctl}</div></div>`;
}
function setSeg(k, cur, opts) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(k)}">${opts.map(([v, n]) => `<button type="button" role="radio" aria-checked="${String(cur) === String(v)}" class="${String(cur) === String(v) ? 'on' : ''}" data-pref-set="${k}" data-v="${esc(String(v))}">${n}</button>`).join('')}</div>`;
}
function setSw(k, on, onV, offV) {
  return `<button type="button" class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${esc(k)}" data-pref-set="${k}" data-v="${esc(String(on ? offV : onV))}"><i></i></button>`;
}
function setVol(k, label, hint, def) {
  const p = S.preferences || {},
    v = Math.round((p[k] ?? def) * 100);
  return setRow(
    label,
    hint,
    `<div class="vol"><input type="range" min="0" max="100" step="5" data-preference="${k}" value="${v}" aria-label="${esc(label)} volume"><span class="vol-n">${v}</span><button type="button" class="pb small quiet" data-a="aud-test" data-k="${k}">Test</button></div>`
  );
}
export function settingsHTML() {
  const p = S.preferences || {},
    tab = SET_TABS.some(t => t[0] === U.setTab) ? U.setTab : 'game',
    hz = FRAME.hz || 60;
  let body = '';
  if (tab === 'game')
    body =
      `<h3 class="set-sub">Playing</h3>` +
      setRow(
        'Time of day',
        'Evenings glow, lamps come on at night, and some Billies only come out after dark.',
        setSeg('time', p.time || 'real', [
          ['real', 'My clock'],
          ['morning', 'Morning'],
          ['day', 'Midday'],
          ['evening', 'Evening'],
          ['night', 'Night'],
        ])
      ) +
      setRow(
        'Weather',
        'Rain brings out Water types; storms bring Electric ones.',
        setSeg('weather', p.weather || 'auto', [
          ['auto', 'Changes'],
          ['clear', 'Fair'],
          ['rain', 'Rain'],
          ['snow', 'Snow'],
          ['fog', 'Fog'],
        ])
      ) +
      setRow(
        'Season',
        'Trees turn and snow falls with the calendar, or pick one.',
        setSeg('season', p.season || 'auto', [
          ['auto', 'Calendar'],
          ['spring', 'Spring'],
          ['summer', 'Summer'],
          ['autumn', 'Autumn'],
          ['winter', 'Winter'],
        ])
      ) +
      setRow(
        'Battles happen',
        'In the 3D place you are standing, or on the classic painted stage.',
        setSeg('battleStage', p.battleStage === 'classic' ? 'classic' : 'scene', [
          ['scene', 'Where I stand'],
          ['classic', 'Painted stage'],
        ])
      ) +
      setRow(
        'Battle speed',
        'How fast moves play out and lines move on. Tap still skips ahead at any speed.',
        setSeg('battleSpeed', p.battleSpeed || 'normal', [
          ['normal', 'Normal'],
          ['fast', 'Fast'],
          ['faster', 'Faster'],
        ])
      ) +
      setRow(
        'Battle panels',
        'Name, level and HP float above each Billie in the scene, or sit in the classic corner cards. Double and Alpha battles always use the scene.',
        setSeg('battleHud', p.battleHud === 'classic' ? 'classic' : 'scene', [
          ['scene', 'In the scene'],
          ['classic', 'Corner cards'],
        ])
      ) +
      setRow(
        'Buddy walks with you',
        'Your buddy follows you around the world. Tap it to see how it’s doing.',
        setSw('buddyWalk', p.buddyWalk !== 'off', 'on', 'off')
      ) +
      setRow(
        'Shops and houses',
        'Walk inside, or go straight to the counter.',
        setSeg('rooms', p.rooms || 'walk', [
          ['walk', 'Walk inside'],
          ['quick', 'Counter'],
        ])
      ) +
      setRow(
        'Language',
        'Menus and buttons. Stories and names stay in English.',
        `<select data-preference="lang">${(typeof I18N_LANGS !== 'undefined' ? I18N_LANGS : [['en', 'English']]).map(([v, n]) => `<option value="${v}" ${(p.lang || 'en') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      ) +
      `<h3 class="set-sub">Moving about</h3>` +
      setRow(
        'Moving about',
        'Joystick: drag anywhere on the scene and a stick appears under your thumb. D-pad: a fixed pad in the corner. Either way, tapping the ground walks you there too.',
        setSeg('control', p.control || 'stick', [
          ['stick', 'Joystick'],
          ['dpad', 'D-pad'],
          ['tap', 'Tap only'],
        ])
      ) +
      setRow(
        'Scene tilt',
        'Tilt your phone to look a little around the scene.',
        setSw('tilt', p.tilt !== false, 'on', 'off')
      ) +
      setRow('Bigger buttons', 'Easier to tap.', setSw('bigTargets', !!p.bigTargets, '1', '')) +
      ('vibrate' in navigator
        ? setRow(
            'Vibration',
            'A small buzz on hits, taxes and level-ups.',
            setSw('haptics', p.haptics !== false, 'on', 'off')
          )
        : '') +
      `<details class="help"><summary>Moving around</summary><p>Drag on the scene for the joystick (or use the D-pad), or tap the ground to walk there. Tap people to talk and glowing spots to act. Two fingers turn the camera and pinch to zoom; with a mouse, drag with the right button to turn and Ctrl+scroll to zoom. On a keyboard: arrow keys or WASD walk, Q and E turn, Enter talks.</p></details>` +
      `<h3 class="set-sub">Screen and comfort</h3>` +
      setRow(
        'Theme',
        'Menus in light or dark colours.',
        setSeg('theme', p.theme || 'system', [
          ['system', 'Device'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ])
      ) +
      setRow(
        'Animation',
        'Reduced keeps things still: no camera sway, fewer moving effects.',
        setSeg('motion', p.motion || 'system', [
          ['system', 'Device'],
          ['full', 'Full'],
          ['reduced', 'Reduced'],
        ])
      ) +
      setRow(
        'Text size',
        'Bigger words in menus and talk.',
        setSeg('textSize', p.textSize || 'normal', [
          ['normal', 'Normal'],
          ['large', 'Large'],
          ['xlarge', 'Larger'],
        ])
      ) +
      setRow(
        'High contrast',
        'Stronger outlines and plainer backgrounds behind text.',
        setSw('contrast', p.contrast === 'high', 'high', 'normal')
      ) +
      setRow(
        'Flashes',
        'Lightning and bright battle flashes. Turn off if flashing bothers you.',
        setSw('flashes', (p.flashes || 'on') === 'on', 'on', 'off')
      );
  else if (tab === 'sound')
    body =
      setRow('Sound', 'All of it at once. Mute keeps your levels for later.', setSw('mute', !p.mute, '', '1')) +
      setVol('master', 'Volume', 'Everything together.', 1) +
      setVol('music', 'Music', 'Tunes for each place and battle.', 0.55) +
      setVol('sfx', 'Sound effects', 'Buttons, battles, coins.', 0.8) +
      setVol('world', 'World sounds', 'Water, fountains, fire, rain, wind and animals near you.', 0.5) +
      setVol('amb', 'Ambience', 'Birdsong by day, crickets at night, leaves, a town’s murmur, a room’s clock.', 0.5) +
      `<p class="note">Sounds fade in when you arrive somewhere. Turn a slider to 0 to mute it.</p>`;
  else if (tab === 'graphics') {
    const gp = p.aim === 'smooth' ? 'balanced' : 'best';
    body =
      `<div class="gfx-presets" role="radiogroup" aria-label="Graphics">${[
        ['balanced', 'Balanced', 'Everything on; softens a little when busy'],
        ['best', 'Beautiful', 'Everything at full detail'],
      ]
        .map(
          ([k, n, h]) =>
            `<button type="button" role="radio" aria-checked="${gp === k}" class="gfx-pre ${gp === k ? 'on' : ''}" data-pref-set="graphics" data-v="${k}"><b>${n}</b><small>${h}</small></button>`
        )
        .join('')}</div>` +
      setRow(
        'Frame rate',
        `60 is smooth and saves battery; 120 is smoother on screens that can show it (yours shows about ${hz} a second).`,
        setSeg('fps', +p.fps || 60, [
          [30, '30'],
          [60, '60'],
          [120, '120'],
        ])
      ) +
      setRow(
        'Expert',
        'Every dial, with what it does and what it costs. “See it” shows the dial in the Graphics gallery.',
        setSw('expert', !!p.expert, '1', '')
      ) +
      (p.expert
        ? GFX_DIALS.map(
            ([t, L]) => `<h3 class="set-sub">${t}</h3><div class="gfx-group">${L.map(gfxDial).join('')}</div>`
          ).join('') +
          `<button type="button" class="pb small quiet wide" data-a="gfx-resetall">Back to the game’s own look</button>`
        : '');
  } else if (tab === 'save')
    body =
      `<div class="settings-profile">${humanHTML('me', 52)}<div><b>${esc(cleanTrainer(S.avatar, S.gender).name)}</b><p class="note">${fmt(S.totalSteps)} steps · ${Object.keys(S.caught).length} taxed</p></div></div><button class="pb dark wide" data-a="open-customize">Customize trainer</button>` +
      (typeof accSettingsHTML === 'function' ? accSettingsHTML() : '') +
      `<p class="note">${typeof ACC !== 'undefined' && ACC.user ? 'Your progress is saved to your account, and in this browser.' : 'Your progress is saved in this browser. Sign in to keep it online, or download a backup before changing device or clearing browser data.'}</p><div class="two"><button class="pb small" data-a="export-save">Export save</button><button class="pb small" data-a="import-save">Import save</button></div>`;
  else
    body = `<details class="help" open><summary>How to play</summary><p>Walk through towns and along the roads between them with the joystick, the D-pad or a tap on the ground. Every few metres you walk count as steps: they earn money, hatch eggs and train your buddy. Tap a Billy in the grass to battle it. Lower its HP, then throw a coin to tax it.</p><p>The map shows where to go next; pick a place and gold arrows guide you there.</p></details><div class="dbg-help"><b>Something look wrong or run slowly?</b><p class="note">The full test takes about two minutes: it plays through every place, a battle, the map, the opening, the dressing room and the shops, checks each for errors, then piles on more and more until your device can't keep up. Your save isn't changed. The debug log holds those numbers, errors and details about your device and graphics, plus a small picture of the scene. It has no save data or names. Send it to whoever is helping you.</p><div class="two"><button class="pb small" data-a="quicktest">Run the full test</button><button class="pb small" data-a="diagtest">Run the diagnostics test (2 min)</button><button class="pb small" data-a="dbglog">Export debug log</button></div></div><button class="pb small quiet wide dbg-open" data-a="debug">${uiIconHTML('bug', 14)} Debug menu</button>`;
  return `<div class="set-tabs" role="tablist">${SET_TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-a="set-tab" data-k="${k}">${n}</button>`).join('')}</div><div class="set-body">${body}</div>`;
}
/* one preference changed, from a switch, a segment, a slider or a menu */
function setPref(k, v) {
  S.preferences = S.preferences || {};
  if (k === 'master') v = +v / 100;
  if (k === 'mute') {
    v = v === '1';
    S.preferences.mute = v;
    save();
    if (typeof audApply === 'function') audApply();
    return;
  }
  if (k === 'expert') {
    S.preferences.expert = v === '1';
    save();
    return;
  }
  if (k === 'graphics') {
    S.preferences.aim = v === 'best' ? 'sharp' : 'smooth';
    return setPref('effects', 'full');
  }
  if (k === 'fps') v = +v;
  if (k === 'music' || k === 'sfx' || k === 'world' || k === 'amb') v = +v / 100;
  if (k === 'master') {
    S.preferences.master = v;
    applyPreferences();
    save();
    if (typeof audApply === 'function') audApply();
    return;
  }
  if (k === 'haptics') v = v !== 'off';
  if (k === 'bigTargets') v = v === '1';
  if (k === 'tilt') {
    v = v === 'on';
    if (v)
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission)
          DeviceOrientationEvent.requestPermission().catch(() => {});
      } catch (e) {}
    if (!v && typeof walkRenderer !== 'undefined') {
      walkRenderer.tiltX = walkRenderer.tiltY = 0;
    }
  }
  S.preferences[k] = v;
  applyPreferences();
  save();
  if (typeof BG !== 'undefined') BG.dark = null;
  if (k === 'haptics' && v)
    try {
      navigator.vibrate(12);
    } catch (e) {}
  if ((k === 'world' || k === 'amb') && typeof ambApply === 'function') ambApply();
}
export function settingsRefresh() {
  if (!U.modal || !U.modal.settings) return;
  const b = document.querySelector('.sheet .body'),
    y = b ? b.scrollTop : 0;
  U.modal.html = settingsHTML();
  renderOv();
  const b2 = document.querySelector('.sheet .body');
  if (b2) b2.scrollTop = y;
}
document.addEventListener('input', ev => {
  const k = ev.target.dataset && ev.target.dataset.preference;
  if (k && ev.target.type === 'range') {
    const n = ev.target.parentNode.querySelector('.vol-n');
    if (n) n.textContent = ev.target.value;
  }
});
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-pref-set],[data-a="set-tab"],[data-a="aud-test"]');
  if (!el) return;
  const d = el.dataset;
  if (d.a === 'set-tab') {
    U.setTab = d.k;
    settingsRefresh();
    requestAnimationFrame(() => {
      const t = document.querySelector('.set-tabs .on');
      if (t) t.focus({ preventScroll: true });
    });
    return;
  }
  if (d.a === 'aud-test') {
    if (typeof audTest === 'function') audTest(d.k);
    return;
  }
  setPref(d.prefSet, d.v);
  settingsRefresh();
  requestAnimationFrame(() => {
    const t = document.querySelector(`[data-pref-set="${d.prefSet}"].on,[data-pref-set="${d.prefSet}"].sw`);
    if (t) t.focus({ preventScroll: true });
  });
});
document.addEventListener('change', ev => {
  const k = ev.target.dataset.preference;
  if (k) setPref(k, ev.target.value);
});
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const d = el.dataset;
  switch (d.a) {
    case 'customize':
      customizeTrainer();
      break;
    case 'open-customize':
      closeModal();
      customizeTrainer();
      break;
    case 'export-save':
      exportSave();
      break;
    case 'dbglog':
      exportDebugLog();
      break;
    case 'quicktest':
      U.modal = null;
      U.mq = [];
      renderOv();
      runQuickTest();
      break;
    case 'diagtest':
      U.modal = null;
      U.mq = [];
      renderOv();
      runDiagTest();
      break;
    case 'import-save':
      importSave();
      break;
  }
});
S.avatar = cleanLook(lookFromOld(S.avatar, S.gender));
if (!S.gender || S.gender === 'boy' || S.gender === 'girl') S.gender = 'me';
applyPreferences();

/* alpha 0.5: the expert graphics dials: a change shows at once (the ground, grass and far things are rebuilt when they need it) */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.eng) return;
  const [g, k] = el.dataset.eng.split('.');
  S.preferences.eng = S.preferences.eng || {};
  (S.preferences.eng[g] = S.preferences.eng[g] || {})[k] = +el.value;
  const D = GFX_DIALS.flatMap(x => x[1]).find(d => d[0] === el.dataset.eng);
  if (D && D[7] && typeof rebuildFromSettings === 'function') {
    clearTimeout(setPref.rb);
    setPref.rb = setTimeout(() => rebuildFromSettings(), 300);
  }
});
document.addEventListener('change', ev => {
  if (ev.target.dataset && ev.target.dataset.eng) {
    save();
    settingsRefresh();
  }
});
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-a^="gfx-"]');
  if (!el) return;
  const a = el.dataset.a;
  if (a === 'gfx-reset') {
    const [g, k] = el.dataset.k.split('.');
    if (S.preferences.eng && S.preferences.eng[g]) {
      delete S.preferences.eng[g][k];
      if (!Object.keys(S.preferences.eng[g]).length) delete S.preferences.eng[g];
    }
    save();
    if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    settingsRefresh();
  } else if (a === 'gfx-resetall') {
    delete S.preferences.eng;
    save();
    if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    settingsRefresh();
  } else if (a === 'gfx-see') {
    if (typeof galleryOpen === 'function') galleryOpen(el.dataset.k);
    else toast('The Graphics gallery is on its way.');
  }
});
