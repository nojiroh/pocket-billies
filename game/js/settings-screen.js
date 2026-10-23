'use strict';
/* Focused additions to the existing UI and save system. */
/* the host page (an artifact viewer, for example) may set its own light/dark attribute; "Match device" leaves it alone */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import {
  BUILDING_SHADERS,
  ENGINE_DEFAULTS,
  ENGINE_PRESETS,
  ENGINE_SPEC,
  FIXTURE_NAMES,
  POST_EFFECT_SHADERS,
  SOLID_PROP_SHADERS,
  WALK_SHADERS,
  WORLD_BOWL_SHADERS,
  account,
  accountSetAsideHTML,
  accountSettingsHTML,
  applyAmbienceVolume,
  applyVolumes,
  attributeClashes,
  closeModal,
  compileProgram,
  engineSetting,
  environment,
  galleryOpen,
  gpuState,
  modal,
  openDressingRoom,
  pixelSky,
  rebuildFromSettings,
  render,
  renderOverlay,
  runBowlMapTest,
  runDiagnostics,
  runGraphicsBench,
  runQuickTest,
  selfTest,
  testVolume,
  toast,
  walkRenderer,
  walkView,
} from './hooks.js';
import { gameData } from './game-data.js';
import { metresToKm, today } from './logic/rules.js';
import { SAVE_NEW_MSG, SAVE_OLD_MSG, migrate, newSaveKeepingPreferences, saveAge, validSave } from './logic/saves.js';
import {
  activeBattle,
  escapeHtml,
  flushSave,
  pauseSaving,
  reducedMotion,
  resumeSaving,
  save,
  saveData,
  setReducedMotion,
  setSave,
  setSaveData,
  uiState,
  writeStoredSave,
} from './game-state.js';
import { I18N_LANGS, i18nSet } from './i18n.js';
import { gpuCountBegin, gpuCountEnd } from './engine/gpu-counters.js';
import { frameScheduler } from './frame-scheduler.js';
import { uiIconHTML } from './art.js';
import { cleanLook, cleanTrainer, lookFromOld, personHTML } from './person-art.js';
/* eslint-disable no-func-assign */
expose({
  GRAPHICS_DIALS: [() => GRAPHICS_DIALS],
  HOST_THEME: [() => HOST_THEME],
  SETTINGS_TABS: [() => SETTINGS_TABS],
  VOLUME_KEYS: [() => VOLUME_KEYS],
  VOLUME_MUTE_LABELS: [() => VOLUME_MUTE_LABELS],
  applyPreferences: [() => applyPreferences, v => (applyPreferences = v)],
  blurSliderHTML: [() => blurSliderHTML, v => (blurSliderHTML = v)],
  blurWord: [() => blurWord, v => (blurWord = v)],
  changePreference: [() => changePreference, v => (changePreference = v)],
  customizeTrainer: [() => customizeTrainer, v => (customizeTrainer = v)],
  exportSave: [() => exportSave, v => (exportSave = v)],
  graphicsDialHTML: [() => graphicsDialHTML, v => (graphicsDialHTML = v)],
  importSave: [() => importSave, v => (importSave = v)],
  muteButtonHTML: [() => muteButtonHTML, v => (muteButtonHTML = v)],
  openSettings: [() => openSettings, v => (openSettings = v)],
  segmentedHTML: [() => segmentedHTML, v => (segmentedHTML = v)],
  setVolumeMuted: [() => setVolumeMuted, v => (setVolumeMuted = v)],
  settingsHTML: [() => settingsHTML, v => (settingsHTML = v)],
  settingsRefresh: [() => settingsRefresh, v => (settingsRefresh = v)],
  settingsRowHTML: [() => settingsRowHTML, v => (settingsRowHTML = v)],
  startGraphicsTest: [() => startGraphicsTest, v => (startGraphicsTest = v)],
  switchHTML: [() => switchHTML, v => (switchHTML = v)],
  themeOwned: [() => themeOwned, v => (themeOwned = v)],
  volumeMuteHTML: [() => volumeMuteHTML, v => (volumeMuteHTML = v)],
  volumeMuteSync: [() => volumeMuteSync, v => (volumeMuteSync = v)],
  volumeMuted: [() => volumeMuted, v => setVolumeMuted(v)],
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
/* phase 13: the graphics test (game/js/graphics-test.js) loads only when it starts, and gets what it needs from here */
async function startGraphicsTest() {
  let mod;
  try {
    mod = await import(/* @vite-ignore */ new URL('js/graphics-test.js', document.baseURI).href);
  } catch (e) {
    toast('The graphics test couldn’t load. Check your connection and try again.');
    return;
  }
  return mod.runGraphicsTest({
    get saveData() {
      return saveData;
    },
    setSaveData,
    get save() {
      return save;
    },
    setSave,
    pauseSaving,
    resumeSaving,
    get activeBattle() {
      return activeBattle;
    },
    uiState,
    render,
    renderOverlay,
    toast,
    modal,
    closeModal,
    escapeHtml,
    gameData,
    walkView,
    walkRenderer,
    environment,
    selfTest,
    debugLog,
    gpuState,
    gpuCountBegin,
    gpuCountEnd,
    compileProgram,
    attributeClashes,
    shaders: { WALK_SHADERS, BUILDING_SHADERS, POST_EFFECT_SHADERS, WORLD_BOWL_SHADERS, SOLID_PROP_SHADERS },
    ENGINE_DEFAULTS,
    ENGINE_SPEC,
    ENGINE_PRESETS,
    FIXTURE_NAMES,
    version: PB_VERSION,
  });
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
      ['air.godRays', 'Sun rays', 'Beams of sunlight through leaves and between roofs', 'high', 0, 2, 0.05],
      ['lights.brightness', 'Lamps', 'How bright lamps and windows shine at night', 'low', 0.3, 2, 0.05],
    ],
  ],
  [
    'Air and weather',
    [
      ['air.mist', 'Low mist', 'Mist lying low over the ground', 'low', 0, 0.6, 0.02],
      ['sun.clouds', 'Clouds', 'How cloudy the sky is (and how much cloud shadow)', 'low', 0, 1, 0.05],
      ['sun.cloudShadows', 'Cloud shadows', 'How dark the drifting cloud shadows are', 'low', 0, 0.6, 0.02],
      ['air.particles', 'Particles', 'How many butterflies, bees, fireflies and falling leaves', 'medium', 0, 1, 0.05],
    ],
  ],
  [
    'Ground and grass',
    [
      ['grass.density', 'Grass', 'How thick the grass grows', 'high', 0, 2, 0.05, 1],
      ['world.farProps', 'Far trees and hills', 'Things beyond the edge of the place', 'medium', 0, 300, 10, 1],
      ['water.reflection', 'Water reflections', 'How much the water mirrors', 'medium', 0, 1.5, 0.05],
    ],
  ],
  [
    'Effects',
    [
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
/* CAM-3: the player's blur slider (preferences.blur: 0 off, 1 the game's own look, 1.5 strong) */
function blurWord(v) {
  return v < 0.05 ? 'Off' : v < 0.75 ? 'Low' : v < 1.25 ? 'Medium' : 'Strong';
}
function blurSliderHTML() {
  const v = Math.round((saveData.preferences.blur ?? 1) * 100);
  return settingsRowHTML(
    'Blur',
    'How soft far and near things go round the sharp strip where you stand (Medium is the game’s own look). Off costs nothing.',
    `<div class="vol"><input type="range" min="0" max="150" step="5" data-preference="blur" value="${v}" aria-label="Blur"><span class="vol-n vol-word">${blurWord(v / 100)}</span></div>`
  );
}
/* UI-7a: each volume row has its own mute where its Test button was (the Volume row's is the master mute, the same
   preference as the button beside the title); letting go of a slider plays its sound once at the new level */
const VOLUME_MUTE_LABELS = {
  master: 'Mute',
  music: 'Mute music',
  sfx: 'Mute sound effects',
  world: 'Mute world sounds',
  amb: 'Mute ambience',
};
function volumeMuted(k, p = saveData.preferences || {}) {
  return k === 'master' ? !!p.mute : !!(p.mutes && p.mutes[k]);
}
function setVolumeMuted(k, on) {
  const p = (saveData.preferences = saveData.preferences || {});
  if (k === 'master') p.mute = on;
  else {
    p.mutes = p.mutes || {};
    if (on) p.mutes[k] = true;
    else delete p.mutes[k];
    if (!Object.keys(p.mutes).length) delete p.mutes;
  }
}
function volumeMuteHTML(k, muted) {
  return `<button type="button" class="pb small quiet vol-mute" data-a="vol-mute" data-k="${k}" aria-pressed="${muted}" aria-label="${VOLUME_MUTE_LABELS[k]}" title="${muted ? 'Sound off' : 'Sound on'}">${uiIconHTML(muted ? 'sound-off' : 'sound', 18)}</button>`;
}
function volumeSliderHTML(k, label, hint, def) {
  const p = saveData.preferences || {},
    v = Math.round((p[k] ?? def) * 100);
  return settingsRowHTML(
    label,
    hint,
    `<div class="vol"><input type="range" min="0" max="100" step="5" data-preference="${k}" value="${v}" aria-label="${escapeHtml(k === 'master' ? label : label + ' volume')}"><span class="vol-n">${v}</span>${volumeMuteHTML(k, volumeMuted(k, p))}</div>`
  );
}
/* the mute buttons drawn again in place (the sheet isn't redrawn while a slider is held) */
function volumeMuteSync() {
  document.querySelectorAll('.vol-mute').forEach(b => {
    const muted = volumeMuted(b.dataset.k);
    if (b.getAttribute('aria-pressed') !== String(muted)) b.outerHTML = volumeMuteHTML(b.dataset.k, muted);
  });
  const head = document.querySelector('.set-mute');
  if (head && head.getAttribute('aria-pressed') !== String(volumeMuted('master')))
    head.outerHTML = muteButtonHTML(saveData.preferences || {});
}
const VOLUME_KEYS = ['master', 'music', 'sfx', 'world', 'amb'];
function settingsHTML() {
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
        'Battle speed',
        'How fast moves play out and lines move on. Tap still skips ahead at any speed.',
        segmentedHTML('battleSpeed', p.battleSpeed || 'normal', [
          ['normal', 'Normal'],
          ['fast', 'Fast'],
          ['faster', 'Faster'],
        ])
      ) +
      settingsRowHTML(
        'Buddy walks with you',
        'Your buddy follows you around the world. Tap it to see how it’s doing.',
        switchHTML('buddyWalk', p.buddyWalk !== 'off', 'on', 'off')
      ) +
      settingsRowHTML(
        'Language',
        'Menus and buttons. Stories and names stay in English.',
        `<select data-preference="lang">${(typeof I18N_LANGS !== 'undefined' ? I18N_LANGS : [['en', 'English']]).map(([v, n]) => `<option value="${v}" ${(p.lang || 'en') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      ) +
      `<h3 class="set-sub">Moving about</h3>` +
      settingsRowHTML(
        'Moving about',
        'Joystick: drag anywhere on the scene and a stick appears under your thumb; push past its rim into the outer ring to run. D-pad: a fixed pad in the corner; hold its centre to run. Either way, tapping the ground walks you there too.',
        segmentedHTML('control', p.control || 'stick', [
          ['stick', 'Joystick'],
          ['dpad', 'D-pad'],
          ['tap', 'Tap only'],
        ])
      ) +
      settingsRowHTML(
        'Always run',
        'A full push of the stick, the D-pad, the keys and tapping the ground all run. A light push still walks.',
        switchHTML('alwaysRun', !!p.alwaysRun, '1', '')
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
      `<details class="help"><summary>Moving around</summary><p>Drag on the scene for the joystick (or use the D-pad), or tap the ground to walk there. Tap people to talk and glowing spots to act. Two fingers turn the camera and pinch to zoom; with a mouse, drag with the right button to turn and Ctrl+scroll to zoom. On a keyboard: arrow keys or WASD walk, hold Shift to run, Q and E turn, Enter talks.</p></details>` +
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
      volumeSliderHTML('master', 'Volume', 'Everything together. Mute keeps your levels for later.', 1) +
      volumeSliderHTML('music', 'Music', 'Tunes for each place and battle.', 0.55) +
      volumeSliderHTML(
        'sfx',
        'Sound effects',
        'Buttons, battles, coins, and the short tunes for a win or a level up.',
        0.8
      ) +
      volumeSliderHTML('world', 'World sounds', 'Water, fountains, fire, rain, wind and animals near you.', 0.5) +
      volumeSliderHTML(
        'amb',
        'Ambience',
        'Birdsong by day, crickets at night, leaves, a town’s murmur, a room’s clock.',
        0.5
      ) +
      settingsRowHTML(
        'Low HP beep',
        'The classic beep while your lead Billie is under a quarter of its HP. The battle music turns tense either way.',
        switchHTML('lowHpBeep', !!p.lowHpBeep, '1', '')
      ) +
      `<p class="note">Sounds fade in when you arrive somewhere.</p>`;
  else if (tab === 'graphics') {
    const gp = p.aim === 'smooth' ? 'balanced' : 'best';
    body =
      `<div class="gfx-presets" role="radiogroup" aria-label="Graphics">${[
        ['balanced', 'Balanced', 'Everything on; softens a little when busy'],
        ['best', 'Beautiful', 'Everything at full detail'],
      ]
        .map(
          ([k, n, h]) =>
            `<button type="button" role="radio" aria-checked="${gp === k}" class="gfx-pre k-card ${gp === k ? 'on' : ''}" data-pref-set="graphics" data-v="${k}"><b>${n}</b><small>${h}</small></button>`
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
      blurSliderHTML() +
      settingsRowHTML(
        'World map clouds',
        'Clouds, rain, snow and lightning over the world map, from each place’s own weather. Auto follows the look above.',
        segmentedHTML('mapClouds', p.mapClouds || 'auto', [
          ['auto', 'Auto'],
          ['off', 'Off'],
          ['low', 'Low'],
          ['high', 'High'],
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
      (typeof accountSetAsideHTML === 'function' ? accountSetAsideHTML() : '') +
      `<p class="note">${typeof account !== 'undefined' && account.user ? 'Your progress is saved to your account, and in this browser.' : 'Your progress is saved in this browser. Sign in to keep it online, or download a backup before changing device or clearing browser data.'}</p><div class="two"><button class="pb small" data-a="export-save">Export save</button><button class="pb small" data-a="import-save">Import save</button></div>`;
  else
    body = `<details class="help" open><summary>How to play</summary><p>Walk through towns and along the roads between them with the joystick, the D-pad or a tap on the ground. Tap a Billie in the grass to battle it; a win pays prize money, and more Billies come out while you play. The ranch breeds Billies into eggs that hatch on real time. Lower its HP, then throw a coin to tax it.</p><p>The map shows where to go next; pick a place and gold arrows guide you there.</p></details><div class="dbg-help"><b>Something look wrong or run slowly?</b><p class="note">The full test takes a few minutes: it walks through every place and room, plays battles, the map and the opening, checks each for errors, then piles on more and more until your device can't keep up. Your save isn't changed. The debug log holds those numbers, errors and details about your device and graphics, plus a small picture of the scene. It has no save data or names. Send it to whoever is helping you. The graphics test tries each graphics setting on its own and saves a short report. The graphics cost test measures what each graphics setting costs on your device. The world map test opens the map and checks every place, the camera and the frame rate on your device.</p><div class="two"><button class="pb small" data-a="quicktest">Run the full test</button><button class="pb small" data-a="diagtest">Run the diagnostics test (2 min)</button><button class="pb small" data-a="gfxtest">Run the graphics test</button><button class="pb small" data-a="gfxbench">Run the graphics cost test (10 min)</button><button class="pb small" data-a="bowltest">Run the world map test (1 min)</button><button class="pb small" data-a="dbglog">Export debug log</button></div></div><button class="pb small quiet wide dbg-open" data-a="debug">${uiIconHTML('bug', 14)} Debug menu</button>`;
  return `<div class="set-top">${muteButtonHTML(p)}</div><div class="set-tabs" role="tablist">${SETTINGS_TABS.map(([k, n]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}" data-a="set-tab" data-k="${k}">${n}</button>`).join('')}</div><div class="set-body">${body}</div>`;
}
/* SND-1: mute from any tab, beside the sheet's title (the title is drawn by ui.js, which the UI track keeps until
   UI-5, so the button comes first in the sheet's body and menus.css lifts it into the title's row); the same
   preference as the Volume row's mute (UI-7a; the Sound tab's on/off switch went, as it did the same) */
function muteButtonHTML(p) {
  const muted = !!p.mute;
  return `<button type="button" class="pb small quiet set-mute" data-pref-set="mute" data-v="${muted ? '' : '1'}" aria-pressed="${muted}" aria-label="Mute" title="${muted ? 'Sound off' : 'Sound on'}">${uiIconHTML(muted ? 'sound-off' : 'sound', 18)}</button>`;
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
  if (k === 'music' || k === 'sfx' || k === 'world' || k === 'amb' || k === 'blur') v = +v / 100;
  if (k === 'master') {
    saveData.preferences.master = v;
    applyPreferences();
    save();
    if (typeof applyVolumes === 'function') applyVolumes();
    return;
  }
  if (k === 'haptics') v = v !== 'off';
  if (k === 'bigTargets' || k === 'alwaysRun' || k === 'lowHpBeep') v = v === '1';
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
    if (n) n.textContent = k === 'blur' ? blurWord(+ev.target.value / 100) : ev.target.value;
  }
  /* UI-7a: moving a muted slider unmutes it, as a phone's volume does */
  if (VOLUME_KEYS.includes(k) && volumeMuted(k)) {
    setVolumeMuted(k, false);
    if (typeof applyVolumes === 'function') applyVolumes();
    if (typeof applyAmbienceVolume === 'function') applyAmbienceVolume();
    volumeMuteSync();
  }
});
document.addEventListener('click', ev => {
  const el = ev.target.closest && ev.target.closest('[data-pref-set],[data-a="set-tab"],[data-a="vol-mute"]');
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
  if (d.a === 'vol-mute') {
    setVolumeMuted(d.k, !volumeMuted(d.k));
    save();
    if (typeof applyVolumes === 'function') applyVolumes();
    if (typeof applyAmbienceVolume === 'function') applyAmbienceVolume();
    settingsRefresh();
    requestAnimationFrame(() => {
      const t = document.querySelector(`.vol-mute[data-k="${d.k}"]`);
      if (t) t.focus({ preventScroll: true });
    });
    return;
  }
  const head = el.classList.contains('set-mute');
  changePreference(d.prefSet, d.v);
  settingsRefresh();
  requestAnimationFrame(() => {
    const t = head
      ? document.querySelector('.set-mute')
      : document.querySelector(`[data-pref-set="${d.prefSet}"].on,[data-pref-set="${d.prefSet}"].sw`);
    if (t) t.focus({ preventScroll: true });
  });
});
document.addEventListener('change', ev => {
  const k = ev.target.dataset.preference;
  if (k) changePreference(k, ev.target.value);
  if (VOLUME_KEYS.includes(k) && typeof testVolume === 'function') testVolume(k);
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
    case 'gfxtest':
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
      startGraphicsTest();
      break;
    case 'bowltest':
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
      runBowlMapTest();
      break;
    case 'gfxbench':
      uiState.modal = null;
      uiState.mq = [];
      renderOverlay();
      runGraphicsBench();
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
export function openSettings(tab) {
  if (tab) uiState.setTab = tab;
  modal({
    title: 'Settings',
    settings: true,
    cls: 'set-sheet',
    html: settingsHTML(),
    btns: [
      { l: 'Done', c: 'dark', f: closeModal },
      {
        l: 'Start over',
        c: 'quiet',
        f: () => {
          uiState.modal = null;
          modal({
            title: 'Start over?',
            html: '<p>This erases your team, Field Guide and money.</p>',
            btns: [
              {
                l: 'Erase and start over',
                c: 'red',
                f: () => {
                  setSaveData(newSaveKeepingPreferences());
                  saveData.savedAt = Date.now();
                  writeStoredSave(saveData);
                  flushSave();
                  uiState.intro = 0;
                  uiState.pg = null;
                  uiState.avatarDraft = null;
                  uiState.trainerDraft = null;
                  uiState.tab = 'walk';
                  applyPreferences();
                  closeModal();
                  render();
                },
              },
              { l: 'Keep my progress', c: 'quiet', f: closeModal },
            ],
          });
        },
      },
    ],
  });
}
