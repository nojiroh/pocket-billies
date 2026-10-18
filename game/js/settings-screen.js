'use strict';
/* Focused additions to the existing UI and save system. */
/* the host page (an artifact viewer, for example) may set its own light/dark attribute; "Match device" leaves it alone */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  account,
  accountSettingsHTML,
  applyAmbienceVolume,
  applyVolumes,
  closeModal,
  engineSetting,
  galleryOpen,
  modal,
  openDressingRoom,
  pixelSky,
  rebuildFromSettings,
  render,
  renderOverlay,
  runDiagnostics,
  runQuickTest,
  testVolume,
  toast,
  walkRenderer,
} from './hooks.js';
import { metresToKm, today } from './logic/rules.js';
import { SAVE_NEW_MSG, SAVE_OLD_MSG, migrate, saveAge, validSave } from './logic/saves.js';
import { escapeHtml, reducedMotion, save, saveData, setReducedMotion, setSaveData, uiState } from './game-state.js';
import { I18N_LANGS, i18nSet } from './i18n.js';
import { frameScheduler } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { cleanLook, cleanTrainer, lookFromOld, personHTML } from './person-art.js';
/* eslint-disable no-func-assign */
expose({
  GRAPHICS_DIALS: [() => GRAPHICS_DIALS],
  HOST_THEME: [() => HOST_THEME],
  SETTINGS_TABS: [() => SETTINGS_TABS],
  applyPreferences: [() => applyPreferences, v => (applyPreferences = v)],
  changePreference: [() => changePreference, v => (changePreference = v)],
  customizeTrainer: [() => customizeTrainer, v => (customizeTrainer = v)],
  exportSave: [() => exportSave, v => (exportSave = v)],
  graphicsDialHTML: [() => graphicsDialHTML, v => (graphicsDialHTML = v)],
  importSave: [() => importSave, v => (importSave = v)],
  segmentedHTML: [() => segmentedHTML, v => (segmentedHTML = v)],
  settingsHTML: [() => settingsHTML, v => (settingsHTML = v)],
  settingsRefresh: [() => settingsRefresh, v => (settingsRefresh = v)],
  settingsRowHTML: [() => settingsRowHTML, v => (settingsRowHTML = v)],
  switchHTML: [() => switchHTML, v => (switchHTML = v)],
  themeOwned: [() => themeOwned, v => (themeOwned = v)],
  volumeSliderHTML: [() => volumeSliderHTML, v => (volumeSliderHTML = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
const HOST_THEME = document.documentElement.dataset.theme;
let themeOwned = false;
export function applyPreferences() {
  const p = saveData.preferences || {},
    root = document.documentElement;
  if (['light', 'dark'].includes(p.theme)) {
    root.dataset.theme = p.theme;
    themeOwned = true;
  } else if (themeOwned || root.dataset.theme === 'system') {
    if (HOST_THEME === 'light' || HOST_THEME === 'dark') root.dataset.theme = HOST_THEME;
    else delete root.dataset.theme;
    themeOwned = false;
  }
  setReducedMotion(
    p.motion === 'reduced' || (p.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
  document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  /* v30: accessibility: text size, high contrast, no flashing, bigger buttons */ root.dataset.text =
    p.textSize || 'normal';
  root.dataset.contrast = p.contrast === 'high' ? 'high' : 'normal';
  root.dataset.flash = p.flashes === 'off' ? 'off' : 'on';
  root.dataset.targets = p.bigTargets ? 'big' : 'normal';
  if (typeof i18nSet === 'function') i18nSet(p.lang || 'en');
}
function customizeTrainer() {
  openDressingRoom();
}
export async function exportSave() {
  const json = JSON.stringify({ game: 'Pocket Billies', format: 1, save: saveData }, null, 2),
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
      uiState.modal = null;
      modal({
        title: 'Restore this backup?',
        html: `<p>Restore ${next.team.length} team members, ${next.box.length} in storage and ${metresToKm((next.stats && next.stats.walked) || 0)} km walked. This replaces your current progress.</p>`,
        btns: [
          {
            l: 'Restore backup',
            c: 'dark',
            f: () => {
              setSaveData(next);
              saveData.avatar = cleanTrainer(saveData.avatar, saveData.gender);
              uiState.trainerDraft = null;
              uiState.tab = 'walk';
              uiState.dex = null;
              uiState.mq = [];
              uiState.learnQ = [];
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
const SETTINGS_TABS = [
  ['sound', 'Sound'],
  ['graphics', 'Graphics'],
  ['game', 'Game'],
  ['save', 'Save'],
  ['help', 'Help'],
];
/* the expert graphics dials: [group.key, label, what it does, cost, min, max, step, rebuild]. Each overrides the game's own value for this player */
export const GRAPHICS_DIALS = [
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
export function graphicsDialHTML([gk, label, help, cost, min, max, step]) {
  const [g, k] = gk.split('.'),
    own = ((saveData.preferences.eng || {})[g] || {})[k],
    v = own != null ? own : engineSetting(g, k);
  return `<div class="gfx-dial"><div class="gfx-h"><b>${label}</b><span class="gfx-cost c-${cost}">${cost === 'high' ? 'Costs a lot' : cost === 'medium' ? 'Costs some' : 'Costs little'}</span>${own != null ? `<button type="button" class="gfx-reset" data-a="gfx-reset" data-k="${gk}" aria-label="Back to the game’s value">↺</button>` : ''}<button type="button" class="gfx-see" data-a="gfx-see" data-k="${gk}">See it</button></div>
 <input type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-eng="${gk}" aria-label="${escapeHtml(label)}"><small>${help}</small></div>`;
}
function settingsRowHTML(title, hint, ctl) {
  return `<div class="set-row"><div class="set-t"><b>${title}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="set-c">${ctl}</div></div>`;
}
function segmentedHTML(k, cur, opts) {
  return `<div class="seg" role="radiogroup" aria-label="${escapeHtml(k)}">${opts.map(([v, n]) => `<button type="button" role="radio" aria-checked="${String(cur) === String(v)}" class="${String(cur) === String(v) ? 'on' : ''}" data-pref-set="${k}" data-v="${escapeHtml(String(v))}">${n}</button>`).join('')}</div>`;
}
function switchHTML(k, on, onV, offV) {
  return `<button type="button" class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" aria-label="${escapeHtml(k)}" data-pref-set="${k}" data-v="${escapeHtml(String(on ? offV : onV))}"><i></i></button>`;
}
function volumeSliderHTML(k, label, hint, def) {
  const p = saveData.preferences || {},
    v = Math.round((p[k] ?? def) * 100);
  return settingsRowHTML(
    label,
    hint,
    `<div class="vol"><input type="range" min="0" max="100" step="5" data-preference="${k}" value="${v}" aria-label="${escapeHtml(label)} volume"><span class="vol-n">${v}</span><button type="button" class="pb small quiet" data-a="aud-test" data-k="${k}">Test</button></div>`
  );
}
export function settingsHTML() {
  const p = saveData.preferences || {},
    tab = SETTINGS_TABS.some(t => t[0] === uiState.setTab) ? uiState.setTab : 'game',
    hz = frameScheduler.hz || 60;
  let body = '';
  if (tab === 'game')
    body =
      `<h3 class="set-sub">Playing</h3>` +
      settingsRowHTML(
        'Time of day',
        'Evenings glow, lamps come on at night, and some Billies only come out after dark.',
        segmentedHTML('time', p.time || 'real', [
          ['real', 'My clock'],
          ['morning', 'Morning'],
          ['day', 'Midday'],
          ['evening', 'Evening'],
          ['night', 'Night'],
        ])
      ) +
      settingsRowHTML(
        'Weather',
        'Rain brings out Water types; storms bring Electric ones.',
        segmentedHTML('weather', p.weather || 'auto', [
          ['auto', 'Changes'],
          ['clear', 'Fair'],
          ['rain', 'Rain'],
          ['snow', 'Snow'],
          ['fog', 'Fog'],
        ])
      ) +
      settingsRowHTML(
        'Season',
        'Trees turn and snow falls with the calendar, or pick one.',
        segmentedHTML('season', p.season || 'auto', [
          ['auto', 'Calendar'],
          ['spring', 'Spring'],
          ['summer', 'Summer'],
          ['autumn', 'Autumn'],
          ['winter', 'Winter'],
        ])
      ) +
      settingsRowHTML(
        'Battles happen',
        'In the 3D place you are standing, or on the classic painted stage.',
        segmentedHTML('battleStage', p.battleStage === 'classic' ? 'classic' : 'scene', [
          ['scene', 'Where I stand'],
          ['classic', 'Painted stage'],
        ])
      ) +
      settingsRowHTML(
        'Battle speed',
        'How fast moves play out and lines move on. Tap still skips ahead at any speed.',
        segmentedHTML('battleSpeed', p.battleSpeed || 'normal', [
          ['normal', 'Normal'],
          ['fast', 'Fast'],
          ['faster', 'Faster'],
        ])
      ) +
      settingsRowHTML(
        'Battle panels',
        'Name, level and HP float above each Billie in the scene, or sit in the classic corner cards. Double and Alpha battles always use the scene.',
        segmentedHTML('battleHud', p.battleHud === 'classic' ? 'classic' : 'scene', [
          ['scene', 'In the scene'],
          ['classic', 'Corner cards'],
        ])
      ) +
      settingsRowHTML(
        'Buddy walks with you',
        'Your buddy follows you around the world. Tap it to see how it’s doing.',
        switchHTML('buddyWalk', p.buddyWalk !== 'off', 'on', 'off')
      ) +
      settingsRowHTML(
        'Shops and houses',
        'Walk inside, or go straight to the counter.',
        segmentedHTML('rooms', p.rooms || 'walk', [
          ['walk', 'Walk inside'],
          ['quick', 'Counter'],
        ])
      ) +
      settingsRowHTML(
        'Language',
        'Menus and buttons. Stories and names stay in English.',
        `<select data-preference="lang">${(typeof I18N_LANGS !== 'undefined' ? I18N_LANGS : [['en', 'English']]).map(([v, n]) => `<option value="${v}" ${(p.lang || 'en') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      ) +
      `<h3 class="set-sub">Moving about</h3>` +
      settingsRowHTML(
        'Moving about',
        'Joystick: drag anywhere on the scene and a stick appears under your thumb. D-pad: a fixed pad in the corner. Either way, tapping the ground walks you there too.',
        segmentedHTML('control', p.control || 'stick', [
          ['stick', 'Joystick'],
          ['dpad', 'D-pad'],
          ['tap', 'Tap only'],
        ])
      ) +
      settingsRowHTML(
        'Scene tilt',
        'Tilt your phone to look a little around the scene.',
        switchHTML('tilt', p.tilt !== false, 'on', 'off')
      ) +
      settingsRowHTML('Bigger buttons', 'Easier to tap.', switchHTML('bigTargets', !!p.bigTargets, '1', '')) +
      ('vibrate' in navigator
        ? settingsRowHTML(
            'Vibration',
            'A small buzz on hits, taxes and level-ups.',
            switchHTML('haptics', p.haptics !== false, 'on', 'off')
          )
        : '') +
      `<details class="help"><summary>Moving around</summary><p>Drag on the scene for the joystick (or use the D-pad), or tap the ground to walk there. Tap people to talk and glowing spots to act. Two fingers turn the camera and pinch to zoom; with a mouse, drag with the right button to turn and Ctrl+scroll to zoom. On a keyboard: arrow keys or WASD walk, Q and E turn, Enter talks.</p></details>` +
      `<h3 class="set-sub">Screen and comfort</h3>` +
      settingsRowHTML(
        'Theme',
        'Menus in light or dark colours.',
        segmentedHTML('theme', p.theme || 'system', [
          ['system', 'Device'],
          ['light', 'Light'],
          ['dark', 'Dark'],
        ])
      ) +
      settingsRowHTML(
        'Animation',
        'Reduced keeps things still: no camera sway, fewer moving effects.',
        segmentedHTML('motion', p.motion || 'system', [
          ['system', 'Device'],
          ['full', 'Full'],
          ['reduced', 'Reduced'],
        ])
      ) +
      settingsRowHTML(
        'Text size',
        'Bigger words in menus and talk.',
        segmentedHTML('textSize', p.textSize || 'normal', [
          ['normal', 'Normal'],
          ['large', 'Large'],
          ['xlarge', 'Larger'],
        ])
      ) +
      settingsRowHTML(
        'High contrast',
        'Stronger outlines and plainer backgrounds behind text.',
        switchHTML('contrast', p.contrast === 'high', 'high', 'normal')
      ) +
      settingsRowHTML(
        'Flashes',
        'Lightning and bright battle flashes. Turn off if flashing bothers you.',
        switchHTML('flashes', (p.flashes || 'on') === 'on', 'on', 'off')
      );
  else if (tab === 'sound')
    body =
      settingsRowHTML(
        'Sound',
        'All of it at once. Mute keeps your levels for later.',
        switchHTML('mute', !p.mute, '', '1')
      ) +
      volumeSliderHTML('master', 'Volume', 'Everything together.', 1) +
      volumeSliderHTML('music', 'Music', 'Tunes for each place and battle.', 0.55) +
      volumeSliderHTML('sfx', 'Sound effects', 'Buttons, battles, coins.', 0.8) +
      volumeSliderHTML('world', 'World sounds', 'Water, fountains, fire, rain, wind and animals near you.', 0.5) +
      volumeSliderHTML(
        'amb',
        'Ambience',
        'Birdsong by day, crickets at night, leaves, a town’s murmur, a room’s clock.',
        0.5
      ) +
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
      settingsRowHTML(
        'Frame rate',
        `60 is smooth and saves battery; 120 is smoother on screens that can show it (yours shows about ${hz} a second).`,
        segmentedHTML('fps', +p.fps || 60, [
          [30, '30'],
          [60, '60'],
          [120, '120'],
        ])
      ) +
      settingsRowHTML(
        'Expert',
        'Every dial, with what it does and what it costs. “See it” shows the dial in the Graphics gallery.',
        switchHTML('expert', !!p.expert, '1', '')
      ) +
      (p.expert
        ? GRAPHICS_DIALS.map(
            ([t, L]) => `<h3 class="set-sub">${t}</h3><div class="gfx-group">${L.map(graphicsDialHTML).join('')}</div>`
          ).join('') +
          `<button type="button" class="pb small quiet wide" data-a="gfx-resetall">Back to the game’s own look</button>`
        : '');
  } else if (tab === 'save')
    body =
      `<div class="settings-profile">${personHTML('me', 52)}<div><b>${escapeHtml(cleanTrainer(saveData.avatar, saveData.gender).name)}</b><p class="note">${metresToKm((saveData.stats && saveData.stats.walked) || 0)} km walked · ${Object.keys(saveData.caught).length} taxed</p></div></div><button class="pb dark wide" data-a="open-customize">Customize trainer</button>` +
      (typeof accountSettingsHTML === 'function' ? accountSettingsHTML() : '') +
      `<p class="note">${typeof account !== 'undefined' && account.user ? 'Your progress is saved to your account, and in this browser.' : 'Your progress is saved in this browser. Sign in to keep it online, or download a backup before changing device or clearing browser data.'}</p><div class="two"><button class="pb small" data-a="export-save">Export save</button><button class="pb small" data-a="import-save">Import save</button></div>`;
  else
    body = `<details class="help" open><summary>How to play</summary><p>Walk through towns and along the roads between them with the joystick, the D-pad or a tap on the ground. Every few metres you walk count as steps: they earn money, hatch eggs and train your buddy. Tap a Billy in the grass to battle it. Lower its HP, then throw a coin to tax it.</p><p>The map shows where to go next; pick a place and gold arrows guide you there.</p></details><div class="dbg-help"><b>Something look wrong or run slowly?</b><p class="note">The full test takes a few minutes: it walks through every place and room, plays battles, the map and the opening, checks each for errors, then piles on more and more until your device can't keep up. Your save isn't changed. The debug log holds those numbers, errors and details about your device and graphics, plus a small picture of the scene. It has no save data or names. Send it to whoever is helping you.</p><div class="two"><button class="pb small" data-a="quicktest">Run the full test</button><button class="pb small" data-a="diagtest">Run the diagnostics test (2 min)</button><button class="pb small" data-a="dbglog">Export debug log</button></div></div><button class="pb small quiet wide dbg-open" data-a="debug">${uiIconHTML('bug', 14)} Debug menu</button>`;
  return `<div class="set-tabs" role="tablist">${SETTINGS_TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-a="set-tab" data-k="${k}">${n}</button>`).join('')}</div><div class="set-body">${body}</div>`;
}
/* one preference changed, from a switch, a segment, a slider or a menu */
function changePreference(k, v) {
  saveData.preferences = saveData.preferences || {};
  if (k === 'master') v = +v / 100;
  if (k === 'mute') {
    v = v === '1';
    saveData.preferences.mute = v;
    save();
    if (typeof applyVolumes === 'function') applyVolumes();
    return;
  }
  if (k === 'expert') {
    saveData.preferences.expert = v === '1';
    save();
    return;
  }
  if (k === 'graphics') {
    saveData.preferences.aim = v === 'best' ? 'sharp' : 'smooth';
    return changePreference('effects', 'full');
  }
  if (k === 'fps') v = +v;
  if (k === 'music' || k === 'sfx' || k === 'world' || k === 'amb') v = +v / 100;
  if (k === 'master') {
    saveData.preferences.master = v;
    applyPreferences();
    save();
    if (typeof applyVolumes === 'function') applyVolumes();
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
  saveData.preferences[k] = v;
  applyPreferences();
  save();
  if (typeof pixelSky !== 'undefined') pixelSky.dark = null;
  if (k === 'haptics' && v)
    try {
      navigator.vibrate(12);
    } catch (e) {}
  if ((k === 'world' || k === 'amb') && typeof applyAmbienceVolume === 'function') applyAmbienceVolume();
}
export function settingsRefresh() {
  if (!uiState.modal || !uiState.modal.settings) return;
  const b = document.querySelector('.sheet .body'),
    y = b ? b.scrollTop : 0;
  uiState.modal.html = settingsHTML();
  renderOverlay();
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
    uiState.setTab = d.k;
    settingsRefresh();
    requestAnimationFrame(() => {
      const t = document.querySelector('.set-tabs .on');
      if (t) t.focus({ preventScroll: true });
    });
    return;
  }
  if (d.a === 'aud-test') {
    if (typeof testVolume === 'function') testVolume(d.k);
    return;
  }
  changePreference(d.prefSet, d.v);
  settingsRefresh();
  requestAnimationFrame(() => {
    const t = document.querySelector(`[data-pref-set="${d.prefSet}"].on,[data-pref-set="${d.prefSet}"].sw`);
    if (t) t.focus({ preventScroll: true });
  });
});
document.addEventListener('change', ev => {
  const k = ev.target.dataset.preference;
  if (k) changePreference(k, ev.target.value);
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
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
      runQuickTest();
      break;
    case 'diagtest':
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
      runDiagnostics();
      break;
    case 'import-save':
      importSave();
      break;
  }
});
saveData.avatar = cleanLook(lookFromOld(saveData.avatar, saveData.gender));
if (!saveData.gender || saveData.gender === 'boy' || saveData.gender === 'girl') saveData.gender = 'me';
applyPreferences();

/* alpha 0.5: the expert graphics dials: a change shows at once (the ground, grass and far things are rebuilt when they need it) */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (!el.dataset || !el.dataset.eng) return;
  const [g, k] = el.dataset.eng.split('.');
  saveData.preferences.eng = saveData.preferences.eng || {};
  (saveData.preferences.eng[g] = saveData.preferences.eng[g] || {})[k] = +el.value;
  const D = GRAPHICS_DIALS.flatMap(x => x[1]).find(d => d[0] === el.dataset.eng);
  if (D && D[7] && typeof rebuildFromSettings === 'function') {
    clearTimeout(changePreference.rb);
    changePreference.rb = setTimeout(() => rebuildFromSettings(), 300);
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
    if (saveData.preferences.eng && saveData.preferences.eng[g]) {
      delete saveData.preferences.eng[g][k];
      if (!Object.keys(saveData.preferences.eng[g]).length) delete saveData.preferences.eng[g];
    }
    save();
    if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    settingsRefresh();
  } else if (a === 'gfx-resetall') {
    delete saveData.preferences.eng;
    save();
    if (typeof rebuildFromSettings === 'function') rebuildFromSettings();
    settingsRefresh();
  } else if (a === 'gfx-see') {
    if (typeof galleryOpen === 'function') galleryOpen(el.dataset.k);
    else toast('The Graphics gallery is on its way.');
  }
});
