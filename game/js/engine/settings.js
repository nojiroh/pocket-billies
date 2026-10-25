'use strict';
/* ================= ENGINE SETTINGS =================
   Every dial the renderer reads. Defaults live here; game data can override them for the whole game
   (gameData.engine.defaults), per walk scene (scenes[id].look; battles use the scene they happen in) and for the map
   (gameData.engine.map). Pocket Billies Studio edits all three in its Engine section.
   A value of null means "use the scene's own field" (its haze, sky, camera…). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ENVIRONMENT_ENGINE_MODIFIERS, gameData, provide, saveData } from '../hooks.js';
import { TIME_OF_DAY_DEFAULTS, TIME_OF_DAY_GROUPS, TIME_OF_DAY_KEYS } from '../logic/time-of-day.js';
import { hexToRgb } from '../art.js';
/* eslint-disable no-func-assign */
expose({
  ENGINE_DEFAULTS: [() => ENGINE_DEFAULTS],
  ENGINE_PRESETS: [() => ENGINE_PRESETS],
  ENGINE_SPEC: [() => ENGINE_SPEC],
  FRAME_SETTINGS: [() => FRAME_SETTINGS],
  PLAIN_LOOK: [() => PLAIN_LOOK],
  TOD_NAMES: [() => TOD_NAMES],
  beginFrameSettings: [() => beginFrameSettings, v => (beginFrameSettings = v)],
  endFrameSettings: [() => endFrameSettings, v => (endFrameSettings = v)],
  engineColor: [() => engineColor, v => (engineColor = v)],
  engineContext: [() => engineContext, v => (engineContext = v)],
  engineDataSource: [() => engineDataSource, v => setEngineDataSource(v)],
  engineSetting: [() => engineSetting, v => ((engineSetting = v), provide({ engineSetting }))],
  frameSettingsState: [() => frameSettingsState],
  gameDataDials: [() => gameDataDials, v => (gameDataDials = v)],
  lookDials: [() => lookDials, v => (lookDials = v)],
  playerBlur: [() => playerBlur, v => (playerBlur = v)],
  playerDials: [() => playerDials, v => (playerDials = v)],
  setEngineDataSource: [() => setEngineDataSource, v => (setEngineDataSource = v)],
  todFields: [() => todFields, v => (todFields = v)],
});
/* eslint-enable no-func-assign */
provide({ engineSetting });
/* to-module: end */
export const ENGINE_DEFAULTS = {
  lens: {
    focusBand: 0.3,
    focusTilt: 0,
    edgeBlur: 0,
    miniature: 0,
    focusEase: 0.35,
    blurFar: 1.5,
    blurNear: 0.9,
    blur: 0.5,
    bokeh: 1,
    aberration: 0.5,
    vignette: 0.3,
    grain: 0.045,
    sharpen: 0.15,
  },
  color: {
    exposure: 1,
    shoulder: 0.82,
    contrast: 1.04,
    saturation: 1.08,
    warmth: 0,
    bloom: 0.55,
    bloomThreshold: 0.9,
    bloomSize: 1,
    grade: 'film',
    gradeAmount: 0.6,
    tone: 'soft',
    ink: 0.35,
    outlines: 1,
  },
  sun: {
    angle: 35,
    height: 52,
    color: '#FFF0D8',
    strength: 1,
    clock: false,
    ambientSky: null,
    ambientGround: null,
    ambient: 0.27,
    innerSun: 1,
    clouds: 0.45,
    cloudSpeed: 1,
    cloudShadows: 0.22,
    shafts: 0.35,
    shaftLength: 0.85,
    glare: 0.6,
    shAmbient: 1,
  },
  shadows: {
    selfShade: 0.7,
    strength: 0.78,
    softness: 1,
    tint: '#40507E',
    contact: 0.5,
    buildings: 1,
    ao: 0.55,
    aoRadius: 0.5,
    pixel: true,
    pixelSize: 32,
    pixelSteps: 2,
    hue: 0.6,
    fit: true,
    groundAO: 1,
    cascades: true,
    nearRadius: 13,
    lampShadows: 2,
    aoKind: 'horizon',
  },
  lights: { brightness: 1, glow: 1, flicker: 0.5, windowsDay: 0.15, roomLight: true, windowLight: 1, pools: 1 },
  air: {
    haze: null,
    hazeStart: 0.95,
    hazeDistance: null,
    mist: 0.12,
    mistHeight: 0.25,
    valleyMist: 0.8,
    particles: 1,
    caveDark: 0.75,
    weather: 1,
    heat: 1,
    wetGround: 1,
    sunFog: 0.4,
    godRays: 0.5,
    lightsInAir: 0.7,
  },
  world: {
    hugSlopes: true,
    curve: 0.0012,
    farProps: 150,
    farHills: 1,
    relief: 1,
    reliefShade: 1,
    groundBumps: 1,
    groundShine: 1,
    buildings3d: true,
    interiors: true,
    solidProps: true,
    voxelProps: true,
    voxelChunky: false,
    voxelLowPoly: true,
    solidTrees: true,
    treeDetail: 20,
    treeCount: 40,
    mini3d: true,
    variety: 1,
    wear: 1,
    propTurn: 1,
    texDetail: 1,
    moods: 1,
    /* phase 20 C1: read in the code with no default here; the values are its own fallbacks (room light dims to 0.68
       inside, rooms open in place unless false) */
    roomDim: 0.68,
    seamlessRooms: true,
  },
  grass: { density: 1, height: 1, low: '#2E6A33', high: '#7FC456', wind: 1, gusts: 1, bend: 0.85 },
  water: {
    shallow: '#4FA6C0',
    deep: '#1D4F78',
    reflection: 1,
    ripples: 1,
    foam: 0.4,
    glints: 1,
    kinds: true,
    caustics: 0.8,
    clarity: 1,
    fish: true,
    rings: true,
    leaves: true,
    steam: true,
    shore: true,
    bed: '#74654A',
    fountains: true,
    wallLight: 1,
  },
  camera: {
    pitch: null,
    pitchAdd: -3,
    height: null,
    distance: 2.1,
    fov: 1,
    lead: 1.3,
    /* CAM-1: the follow (logic/camera-follow.js) */
    smooth: 0.3,
    deadW: 0.1,
    deadH: 0.08,
    softW: 0.5,
    softH: 0.5,
    leadSmooth: 0.6,
    leadSide: 1.5,
    band: 0.5,
    blend: 0.4,
    sway: 1,
    tilt: 1,
    turn: 35,
    zoomMin: 0.55,
    zoomMax: 1.7,
    /* CAM-2: the zoom curve's ends (logic/camera-zoom.js); these match zoom before CAM-2 */
    zoomNearPitch: -6.3,
    zoomNearDist: 0.55,
    zoomNearFov: 1,
    zoomFarPitch: 9.8,
    zoomFarDist: 1.7,
    zoomFarFov: 1,
    zoomCurve: 1,
    /* CAM-2: the encounter shot and the pull back out after a battle */
    encZoom: 0.5,
    encMin: 400,
    encMax: 900,
    leaveZoom: 0.55,
    /* CAM-2: points of interest (logic/camera-interest.js) */
    intOn: true,
    intPull: 1.5,
    /* CAM-2: the moments (logic/camera-moments.js MOMENT_DIALS) */
    talkOn: true,
    talkZoom: 0.75,
    talkBlend: 0.5,
    bossOn: true,
    bossNear: 9,
    bossTime: 2.2,
    bossZoom: 0.85,
    bossLean: 3,
    idleOn: true,
    idleDelay: 4,
    idleZoom: 0.9,
    idleBlend: 2,
    runOn: true,
    runZoom: 1.06,
    runBlend: 0.8,
    turnHold: 0.5,
    turnAngle: 60,
    pixelGrid: false,
    rise: 18,
    rockFade: true,
    silhouette: true,
    outline: 1,
    outlineFill: 0.25,
    /* island track IS-1: an island map's camera turns round its middle (cam.orbit); the sun turns with the camera
       (off: the sun stays put in the world, the owner's pick) */
    orbit: true,
    sunTurns: false,
  },
  quality: {
    resolution: 1,
    shadowMap: 2048,
    auto: true,
    cull: true,
    shadowCache: true,
    gpuTimer: true,
    battleLite: true,
    /* 0.1.0 alpha: skip props under this many pixels tall; on a phone, small props fade out before this distance (m,
       0: no limit) */
    minPropPx: 0,
    phonePropDistance: 0,
    sharpTex: true,
    edgeBleed: true,
    /* phase 20 C1: the same, as the code's fallbacks (walk scenes kept ready; the ground painted in a worker unless
       false) */
    keepScenes: 3,
    paintWorker: true,
    /* phase 20 C3: the frame's light values in one uniform block (off: each lit program is sent them, as before) */
    frameBlock: false,
  },
};
provide({ ENGINE_DEFAULTS }); /* to-module */
/* 0.1.0 alpha: the five looks of the time of day, one group each (todDawn ... todNight; logic/time-of-day.js) */
for (const k of TIME_OF_DAY_KEYS) ENGINE_DEFAULTS[TIME_OF_DAY_GROUPS[k]] = { ...TIME_OF_DAY_DEFAULTS[k] };
/* 0.1.0 alpha: the dials of one time-of-day look, for the Studio */
const TOD_NAMES = { dawn: 'dawn', day: 'day', golden: 'golden hour', dusk: 'dusk', night: 'night' };
function todFields(k) {
  const from = k === 'dawn' || k === 'day' ? 'sunrise' : 'sunset';
  return [
    [
      'at',
      `Hour (from ${from})`,
      -4,
      4,
      0.1,
      `Hours after ${from} (before it when negative) when this look is full. Sunrise and sunset move with the season.`,
    ],
    [
      'blend',
      'Blends in over',
      0.1,
      6,
      0.1,
      'Hours it takes to blend in from the look before it; until then that one holds.',
    ],
    ['skyTop', 'Sky, top', 'color?'],
    ['skyMid', 'Sky, middle', 'color?'],
    ['skyLow', 'Sky, horizon', 'color?'],
    ['skyMix', 'Sky colour amount', 0, 1, 0.01, 'How far the sky turns to these colours (0: the scene’s own sky).'],
    ['sunColor', 'Light colour', 'color?'],
    ['sun', 'Light strength', 0, 2, 0.01, 'The sun’s (or the moon’s) strength, times the Sun group’s.'],
    ['ambient', 'Fill light', 0, 2, 0.01, 'The light from the sky that fills the shadows.'],
    ['ambientColor', 'Fill colour', 'color?'],
    ['haze', 'Haze colour', 'color?'],
    ['hazeMix', 'Haze colour amount', 0, 1, 0.01, 'How far the haze turns to this colour (0: the scene’s own).'],
    ['hazeDistance', 'Haze distance', 0.3, 2, 0.01, 'Times the scene’s haze distance: lower is hazier.'],
    ['mist', 'Low mist', 0, 1, 0.01, 'Mist lying in the valleys (mild and coastal places, not in rain or snow).'],
    ['exposure', 'Exposure', 0.5, 2, 0.01],
    ['saturation', 'Saturation', 0.3, 1.6, 0.01],
    ['contrast', 'Contrast', 0.7, 1.4, 0.01],
    ['warmth', 'Warmth', -1, 1, 0.01],
    ['shadow', 'Shadow strength', 0, 1.5, 0.01],
    ['shadowTint', 'Shadow tint', 'color?'],
    ['lightTint', 'Highlight tint', 'color?'],
    ['tintStrength', 'Tint amount', 0, 1, 0.01, 'How strongly the shadow and highlight tints colour the picture.'],
    ['bloom', 'Glow', 0, 2, 0.01, 'Times the Color group’s bloom.'],
    ['lamps', 'Lamps lit', 0, 1, 0.01, 'How lit the street lamps and windows are (weather can light them more).'],
    ['stars', 'Stars', 0, 1, 0.01],
  ];
}
/* labels, ranges and help for the Studio, in display order */
export const ENGINE_SPEC = [
  [
    'lens',
    'Lens',
    [
      [
        'focusBand',
        'Sharp band around you',
        0,
        1,
        0.01,
        'How deep the in-focus zone is, as a share of the camera distance (in the walk view, of 16 m at any zoom).',
      ],
      [
        'focusTilt',
        'Tilt of the sharp zone',
        0,
        1,
        0.01,
        'CAM-3, the diorama look: 0, the sharp zone faces the camera (a slab of distance); 1, it stands upright through you, so whatever stands in the strip is sharp head to toe and the ground ahead and behind melts away.',
      ],
      [
        'edgeBlur',
        'Edge blur',
        0,
        1,
        0.01,
        "CAM-3: blur toward the screen's edges and corners whatever the distance (none in the middle 60%). Off by default: players turned it off in other games.",
      ],
      [
        'miniature',
        'Miniature look',
        0,
        1,
        0.01,
        "CAM-3: a little more saturation, contrast and vignette, as a tilt-shift photo of a model town; it follows the blur actually in use (the player's blur slider tones it down too, and it goes with the blur).",
      ],
      [
        'focusEase',
        'Focus moves in',
        0,
        2,
        0.05,
        'CAM-3: seconds the sharp zone takes to move to what a moment is about (the middle of you and who you talk to, an encounter, a boss) and back to you.',
      ],
      ['blurFar', 'Blur growth behind', 0.1, 3, 0.05],
      ['blurNear', 'Blur growth in front', 0.1, 3, 0.05],
      ['blur', 'Maximum blur', 0, 2.5, 0.05],
      ['bokeh', 'Round highlights', 0, 3, 0.05, 'How much bright spots bloom into discs when out of focus.'],
      ['aberration', 'Chromatic aberration', 0, 3, 0.05, 'Color fringes toward the corners.'],
      ['vignette', 'Vignette', 0, 1, 0.01],
      ['grain', 'Film grain', 0, 0.15, 0.005],
      ['sharpen', 'Sharpen', 0, 1, 0.05],
    ],
  ],
  [
    'color',
    'Color',
    [
      ['exposure', 'Exposure', 0.4, 2, 0.02],
      [
        'shoulder',
        'Highlight roll-off',
        0.5,
        1,
        0.01,
        'Where bright colors start to soften instead of clipping to white.',
      ],
      ['contrast', 'Contrast', 0.7, 1.4, 0.01],
      ['saturation', 'Saturation', 0, 2, 0.01],
      ['warmth', 'Warmth', -1, 1, 0.02],
      [
        'outlines',
        'Coloured outlines',
        0,
        1,
        0.05,
        'v47: black outlines in older pictures take a deep shade of the colour beside them, as the newer art draws them. 0: as painted.',
      ],
      ['bloom', 'Bloom', 0, 2, 0.02, 'Glow around bright lights.'],
      ['bloomThreshold', 'Bloom threshold', 0.5, 2, 0.02],
      ['bloomSize', 'Bloom size', 0.3, 2, 0.05],
      [
        'grade',
        'Colour grade',
        'sel',
        [
          ['none', 'None'],
          ['film', 'Warm film'],
          ['teal', 'Teal and orange'],
          ['vivid', 'Storybook'],
          ['faded', 'Faded photo'],
          ['dusk', 'Dusk'],
          ['cold', 'Cold morning'],
          ['pastel', 'Pastel'],
          ['crisp', 'Crisp morning'],
          ['moonlit', 'Moonlit'],
        ],
      ],
      ['gradeAmount', 'Grade strength', 0, 1.5, 0.05],
      [
        'tone',
        'Tone curve',
        'sel',
        [
          ['soft', 'Soft (as before)'],
          ['film', 'Film: deeper darks, gentler highlights'],
          ['punchy', 'Punchy film'],
        ],
      ],
      [
        'ink',
        'Ink outlines',
        0,
        1,
        0.05,
        'A thin dark line where one thing stands in front of another, for a drawn look. 0 turns it off.',
      ],
    ],
  ],
  [
    'sun',
    'Sun and sky',
    [
      [
        'angle',
        'Sun direction',
        0,
        360,
        1,
        '0 = from the left, 90 = from the front, 180 = from the right, 270 = from behind.',
      ],
      ['height', 'Sun height', 15, 85, 1],
      ['color', 'Sun color', 'color'],
      ['strength', 'Sun strength', 0, 2, 0.02],
      ['clock', 'Follow the real clock', 'bool', 'The sun leans and warms through the day.'],
      ['ambientSky', 'Sky light', 'color?'],
      ['ambientGround', 'Ground bounce', 'color?'],
      ['ambient', 'Ambient strength', 0, 2, 0.02],
      ['innerSun', 'Inner Sun glow', 0, 2, 0.05],
      ['clouds', 'Clouds', 0, 1, 0.01],
      ['cloudSpeed', 'Cloud speed', 0, 4, 0.1],
      ['cloudShadows', 'Cloud shadows', 0, 0.6, 0.01],
      ['shafts', 'Light shafts', 0, 2, 0.05, 'Rays of light from the sun through the sky and bright gaps.'],
      [
        'shAmbient',
        'Sky-shaped ambient',
        0,
        1,
        0.05,
        'How much the ambient light follows the sky: blue from above, the ground’s bounce from below, warmer toward the sun (v43).',
      ],
      [
        'glare',
        'Sun glare',
        0,
        1.5,
        0.05,
        'A soft halo and lens ghosts when the sun is in view and nothing blocks it.',
      ],
      ['shaftLength', 'Shaft length', 0.2, 1.5, 0.05],
    ],
  ],
  [
    'shadows',
    'Shadows',
    [
      ['strength', 'Strength', 0, 1, 0.01],
      [
        'selfShade',
        'Trees shade themselves',
        0,
        1,
        0.05,
        'alpha 0.4.1: the crown of a tree puts its trunk and its lower leaves in shade, from the side the sun shines.',
      ],
      ['softness', 'Softness', 0, 3, 0.05],
      ['tint', 'Shadow color', 'color'],
      [
        'hue',
        'Colour in the shadows',
        0,
        1,
        0.02,
        'How strongly shade takes the shadow colour instead of just getting darker.',
      ],
      [
        'pixel',
        'Pixel-art shadow edges',
        'bool',
        'Edges step in whole pixels and soften in dithered tones, like the art.',
      ],
      ['pixelSize', 'Shadow pixel size', 8, 32, 8, 'With pixel-art edges: shadow pixels per metre (the art has 32).'],
      [
        'pixelSteps',
        'Shadow edge tones',
        0,
        4,
        1,
        'With pixel-art edges: the dithered tones between light and shade (0 keeps the soft edge smooth).',
      ],
      [
        'fit',
        'Sharper shadows around the camera',
        'bool',
        'The shadow map covers what you can see instead of the whole scene.',
      ],
      [
        'cascades',
        'Near shadow map',
        'bool',
        'A second, finer shadow map round you; the fitted one covers the rest (v43).',
      ],
      ['nearRadius', 'Near map radius (m)', 6, 24, 1],
      [
        'lampShadows',
        'Lamps that cast shadows',
        'sel',
        [
          [0, 'None'],
          [1, 'The nearest'],
          [2, 'The two nearest'],
        ],
        'At night the nearest lamps get a shadow map of their own, so people and trees throw shadows away from them (v43).',
      ],
      [
        'aoKind',
        'Ambient occlusion',
        'sel',
        [
          ['crease', 'Creases (v30)'],
          ['horizon', 'Horizons (v43)'],
        ],
        'Horizons: each pixel looks along four directions for what rises above it, the way light from the sky is blocked.',
      ],
      ['contact', 'Contact shadows', 0, 1, 0.01, 'Soft darkening where things touch the ground.'],
      ['buildings', 'Buildings cast solid shadows', 'bool'],
      [
        'ao',
        'Ambient occlusion',
        0,
        1.5,
        0.05,
        'Soft darkening in creases and where things meet, from the depth of the picture.',
      ],
      ['aoRadius', 'Occlusion size (m)', 0.1, 2, 0.05],
      [
        'groundAO',
        'Shade at the feet of things',
        0,
        1.5,
        0.05,
        'Soft darkening on the ground round buildings, trees, rocks and the foot of walls, worked out once per scene.',
      ],
    ],
  ],
  [
    'lights',
    'Lights',
    [
      ['brightness', 'Brightness', 0, 3, 0.05],
      [
        'windowLight',
        'Daylight through windows',
        0,
        3,
        0.05,
        'How strongly a room is lit by the day outside its windows.',
      ],
      [
        'pools',
        'Lamp light on the ground',
        0,
        2,
        0.05,
        'After dark, street lamps lay a pool of light on the ground under them.',
      ],
      ['glow', 'Glow size', 0, 3, 0.05],
      ['flicker', 'Flicker', 0, 1, 0.05],
      ['windowsDay', 'Window light in daytime', 0, 1, 0.01],
      [
        'roomLight',
        'Light through room windows',
        'bool',
        'Inside, the hour and weather outside fall through the windows; lamps come on in the evening.',
      ],
    ],
  ],
  [
    'air',
    'Air',
    [
      ['haze', 'Haze color', 'color?'],
      ['hazeStart', 'Haze starts at', 0.2, 2, 0.01, 'As a share of the camera distance.'],
      ['hazeDistance', 'Haze distance (m)', 'num?'],
      ['mist', 'Low mist', 0, 0.6, 0.01],
      ['sunFog', 'Sunlit haze', 0, 1.5, 0.05, 'The haze takes the sun’s colour where you look toward the sun (v43).'],
      [
        'godRays',
        'God rays',
        0,
        2,
        0.05,
        'Sunlight in the air, shadowed by what stands in it: beams between trees and buildings (v43). A march through the air at half resolution.',
      ],
      ['lightsInAir', 'Lamps in the air', 0, 2, 0.05, 'A glow in the air round lamps and fires at night (v43).'],
      ['mistHeight', 'Mist height (m)', 0, 2, 0.05],
      [
        'valleyMist',
        'Mist in low ground',
        0,
        1.5,
        0.05,
        'Mist lying in gorges and valley floors well below where you walk.',
      ],
      ['particles', 'Floating particles', 0, 2, 0.05],
      ['caveDark', 'Dark caves', 0, 1, 0.05, 'How dark caves are away from your lantern and the glowing crystals.'],
      [
        'weather',
        'Rain and snow',
        0,
        2,
        0.05,
        'How many drops and flakes fall in bad weather (the weather itself follows the time and the place).',
      ],
      ['heat', 'Heat shimmer', 0, 2, 0.05, 'The air wobbles over lava, and over desert sand and canyons at midday.'],
      [
        'wetGround',
        'Wet ground after rain',
        0,
        1.5,
        0.05,
        'Darker, shinier ground and puddles that mirror the sky after rain.',
      ],
    ],
  ],
  [
    'world',
    'World',
    [
      [
        'moods',
        'Place moods',
        0,
        1.5,
        0.05,
        'v47: each place has its own colour mood (warm late afternoon in Marigold Town, cool and misty in Thornberry Wood, hazy heat in Stepstone Canyon). 0: one look everywhere.',
      ],
      [
        'voxelProps',
        'Voxel props',
        'bool',
        'Props with a voxel recipe (benches, planters, lamps, crates...) draw as real solids, cel-shaded in the scene’s light (v43). Off: their pictures.',
      ],
      [
        'voxelChunky',
        'Chunky voxels',
        'bool',
        'alpha 0.4: voxel props are built at the art’s own scale, one voxel to a pixel (32 to the metre). On: eight to the metre, as before (fewer polygons, for slow phones).',
      ],
      [
        'voxelLowPoly',
        'Props as low-poly',
        'bool',
        'alpha 0.4: the props made of shapes (benches, crates, barrels, planters…) are low-poly models painted with the buildings’ 32 px textures, like the houses and the airship (on). Off: voxels, one to a pixel of the art. Imported .vox models are always voxels.',
      ],
      ['curve', 'Horizon curve', 0, 0.012, 0.0002, 'How fast the Hollow Earth bends up in the distance.'],
      ['farProps', 'Distant trees and rocks', 0, 300, 5],
      ['farHills', 'Distant hilliness', 0, 3, 0.05],
      ['groundBumps', 'Ground bumpiness', 0, 3, 0.05, 'Cobbles, rock and paths catch the light from their own pixels.'],
      ['groundShine', 'Ground shine', 0, 3, 0.05, 'How much smooth floors and plazas gleam in the sun.'],
      [
        'buildings3d',
        '3D buildings',
        'bool',
        'Houses and shops as models with real roofs, walls and see-through windows. Off: their pictures stand in.',
      ],
      [
        'hugSlopes',
        'Props follow slopes',
        'bool',
        'Fences, benches, logs, rocks and hedges lean with the ground they stand on, so both ends touch it. Trees, lamps and people stay upright.',
      ],
      [
        'solidProps',
        'Solid props',
        'bool',
        'Signs, fences, benches, crates, rocks and lamps get real depth: thin slabs, solid blocks or rounded shapes behind their pictures. Off: flat pictures.',
      ],
      [
        'solidTrees',
        'Solid trees',
        'bool',
        'Trees and bushes with round trunks and crowns of separate leaf clumps that sway on their own. Off: their layered pictures.',
      ],
      ['treeDetail', 'Solid trees within (m)', 8, 40, 1, 'Farther trees are drawn as pictures.'],
      ['treeCount', 'Most solid trees at once', 5, 120, 1],
      ['interiors', 'Rooms behind windows', 'bool', 'Simple rooms you can see through the glass, lit at night.'],
      ['relief', 'World map mountains', 0, 3, 0.05, 'How tall the land stands on the 3D world map.'],
      ['reliefShade', 'World map hill shading', 0, 3, 0.05],
      [
        'mini3d',
        '3D miniatures on the map',
        'bool',
        'Every stop on the world map is a little 3D model of its walk scene: ground, buildings and trees.',
      ],
      [
        'variety',
        'Prop variety',
        0,
        2,
        0.05,
        'How much each placed prop varies from its neighbours in size and colour.',
      ],
      ['wear', 'Wear and tear', 0, 2, 0.05, 'Dirt streaks, moss, faded paint and cracks on buildings and props.'],
      [
        'propTurn',
        'Prop turning',
        0,
        2,
        0.05,
        'How far props are turned and leaned at random, so rows of things don’t look stamped out.',
      ],
      [
        'texDetail',
        'Prop surface detail',
        0,
        2,
        0.05,
        'Wood grain, stone grit, rings on cut logs and a fine sheen on metal, on the sides and tops solid props grow. 0 shows plain colour.',
      ],
    ],
  ],
  [
    'grass',
    'Grass and wind',
    [
      ['density', 'Grass density', 0, 3, 0.05],
      ['height', 'Grass height', 0.3, 2, 0.05],
      ['low', 'Grass color, roots', 'color'],
      ['high', 'Grass color, tips', 'color'],
      ['wind', 'Wind', 0, 3, 0.05],
      ['gusts', 'Gusts', 0, 3, 0.05],
      ['bend', 'Bends around you', 0, 1.5, 0.05],
    ],
  ],
  [
    'water',
    'Water',
    [
      ['shallow', 'Shallow color', 'color'],
      ['deep', 'Deep color', 'color'],
      ['reflection', 'Reflections', 0, 1.5, 0.05],
      ['ripples', 'Ripples', 0, 3, 0.05],
      ['foam', 'Foam', 0, 1, 0.02],
      ['glints', 'Glints', 0, 3, 0.05],
      [
        'kinds',
        'Kinds of water',
        'bool',
        'Ponds, streams, canals, springs, swamps and lakes each get their own colour, clarity and movement.',
      ],
      ['caustics', 'Light on the bed', 0, 2, 0.05, 'Wavy sunlight patterns on the bottom of shallow water.'],
      ['clarity', 'See-through shallows', 0, 1.5, 0.05, 'How much of the bed shows through shallow water.'],
      ['fish', 'Fish in ponds', 'bool', 'Shadows of fish circling in deep ponds, lakes and canals.'],
      ['rings', 'Ripple rings', 'bool', 'Rings spread from ducks, fish and insects landing.'],
      ['leaves', 'Leaves on streams', 'bool', 'Leaves float down running water.'],
      ['steam', 'Steam over springs', 'bool', 'Warm springs breathe a little steam.'],
      [
        'shore',
        'Natural shorelines',
        'bool',
        'Water edges curve and wander instead of following the tiles, with a wet rim on the bank.',
      ],
      ['bed', 'Bed color', 'color'],
      [
        'fountains',
        'Fountain water',
        'bool',
        'Fountains and wells hold moving water, with jets, falling curtains, splashes and rings.',
      ],
      [
        'wallLight',
        'Light from water on walls',
        0,
        2,
        0.05,
        'Sunlight thrown up off the water dances on walls beside it.',
      ],
    ],
  ],
  [
    'camera',
    'Camera',
    [
      [
        'pixelGrid',
        'Pixel grid',
        'bool',
        'v35: standing still, the camera settles onto the art grid so pictures sit on whole pixels. Meant for the new 32 px/m art; off for now.',
      ],
      ['pitch', 'Tilt (degrees)', 'num?'],
      ['pitchAdd', 'Tilt adjustment (degrees)', -15, 15, 0.5, "Added to every scene's own tilt."],
      ['height', 'Height (m)', 'num?'],
      [
        'distance',
        'Distance',
        1,
        3.5,
        0.05,
        'How far back the camera stands. Farther looks flatter and less distorted; the view stays the same width. Indoor scenes keep the camera close, inside their walls.',
      ],
      ['fov', 'Zoom', 0.5, 2, 0.02],
      [
        'lead',
        'Look-ahead (m)',
        0,
        4,
        0.1,
        'CAM-1: how far ahead of you the camera aims at full push, the way the joystick points (or the way you walk).',
      ],
      [
        'leadSmooth',
        'Look-ahead smoothing (s)',
        0,
        2,
        0.05,
        'How slowly the look-ahead turns and grows; letting go, it dies away as slowly.',
      ],
      [
        'leadSide',
        'Look-ahead sideways on a tall screen',
        1,
        3,
        0.05,
        'Portrait screens reach this much further left and right.',
      ],
      [
        'smooth',
        'Follow smoothing (s)',
        0,
        1.5,
        0.01,
        'How long the camera trails behind you at a steady walk. 0: locked to you.',
      ],
      [
        'deadW',
        'Dead zone width (share of the screen)',
        0,
        0.6,
        0.01,
        'You move inside it while walking and the camera holds still. Standing, it closes and the camera settles on you.',
      ],
      ['deadH', 'Dead zone height (share of the screen)', 0, 0.6, 0.01],
      [
        'softW',
        'Soft zone width (share of the screen)',
        0.1,
        1,
        0.01,
        'Past the dead zone the camera catches up; you never leave the soft zone.',
      ],
      ['softH', 'Soft zone height (share of the screen)', 0.1, 1, 0.01],
      [
        'band',
        'Ignore ground changes under (m)',
        0,
        2,
        0.05,
        'While you walk, small rises and dips don’t move the camera.',
      ],
      [
        'blend',
        'Camera goals blend (s)',
        0,
        2,
        0.05,
        'How long a camera goal (looking up at a landmark, the tilt indoors, rising ground ahead) takes to come in or go.',
      ],
      ['sway', 'Walk bob', 0, 2, 0.05],
      ['tilt', 'Phone tilt', 0, 3, 0.05],
      ['turn', 'Turn limit (degrees)', 0, 80, 1],
      ['zoomMin', 'Closest zoom', 0.3, 1, 0.05],
      ['zoomMax', 'Farthest zoom', 1, 3, 0.05],
      [
        'zoomNearPitch',
        'Zoom curve: tilt up close (degrees)',
        -20,
        10,
        0.1,
        'CAM-2: one zoom drives tilt, distance and field of view. At the closest zoom (pinching in, or a moment like talking) the tilt changes by this much.',
      ],
      ['zoomNearDist', 'Zoom curve: distance up close', 0.2, 1, 0.01, 'The distance’s factor at the closest zoom.'],
      [
        'zoomNearFov',
        'Zoom curve: field of view up close',
        0.5,
        1.5,
        0.01,
        'The field of view’s factor at the closest zoom (above 1: wider).',
      ],
      ['zoomFarPitch', 'Zoom curve: tilt far out (degrees)', -10, 25, 0.1, 'The tilt change at the farthest zoom.'],
      ['zoomFarDist', 'Zoom curve: distance far out', 1, 3, 0.01],
      ['zoomFarFov', 'Zoom curve: field of view far out', 0.5, 1.5, 0.01],
      [
        'zoomCurve',
        'Zoom curve: shape',
        0.3,
        3,
        0.05,
        '1: straight. Above 1 the tilt, distance and field of view change little near the scene’s framing and more toward the ends; below 1 the other way.',
      ],
      [
        'encZoom',
        'Encounter shot: zoom',
        0.3,
        1,
        0.01,
        'CAM-2: the swoop into a battle zooms to this share of your zoom, aiming between you and the spot, never so close that both don’t fit.',
      ],
      [
        'encMin',
        'Encounter shot: shortest (ms)',
        0,
        1500,
        10,
        'The battle comes up once the camera has arrived, but not before this.',
      ],
      ['encMax', 'Encounter shot: longest (ms)', 200, 3000, 10, 'Nor later than this, arrived or not.'],
      [
        'leaveZoom',
        'After a battle: start zoom',
        0.3,
        1,
        0.01,
        'Leaving a battle the camera starts this close and pulls back out.',
      ],
      [
        'intOn',
        'Points of interest',
        'bool',
        'CAM-2: landmarks and shop and clinic doors near you lean the camera toward them and zoom it a little (the catalogue’s `interest`: weight, radius, zoom, pull).',
      ],
      [
        'intPull',
        'Interest: most lean (m)',
        0,
        4,
        0.05,
        'However strong the point, the aim leans no further than this.',
      ],
      [
        'talkOn',
        'Moment: talking',
        'bool',
        'CAM-2: while someone talks to you the camera frames you both (a two-shot) and zooms in. With reduced motion every moment counts half; standing still and running are off.',
      ],
      ['talkZoom', 'Talking: zoom', 0.4, 1, 0.01],
      ['talkBlend', 'Talking: blend (s)', 0, 2, 0.05],
      [
        'bossOn',
        'Moment: a run’s boss',
        'bool',
        'The first time you come near a run’s boss in a place, the camera leans toward them for a moment.',
      ],
      ['bossNear', 'Boss: how near (m)', 2, 20, 0.5],
      ['bossTime', 'Boss: how long (s)', 0.5, 5, 0.1],
      ['bossZoom', 'Boss: zoom', 0.5, 1.2, 0.01],
      ['bossLean', 'Boss: most lean (m)', 0, 6, 0.1],
      ['idleOn', 'Moment: standing still', 'bool', 'Standing still a while, the camera drifts in slowly.'],
      ['idleDelay', 'Standing still: after (s)', 1, 15, 0.5],
      ['idleZoom', 'Standing still: zoom', 0.6, 1, 0.01],
      ['idleBlend', 'Standing still: drift (s)', 0.2, 6, 0.1, 'How slowly it drifts in. Moving, it goes at once.'],
      ['runOn', 'Moment: running', 'bool', 'Running, the camera eases out a little.'],
      ['runZoom', 'Running: zoom', 1, 1.3, 0.01],
      ['runBlend', 'Running: blend (s)', 0, 3, 0.05],
      [
        'turnHold',
        'No moment after a turn (s)',
        0,
        2,
        0.05,
        'For this long after a sharp turn no moment starts (one already on carries on).',
      ],
      ['turnAngle', 'A sharp turn (degrees)', 15, 180, 1],
      [
        'rise',
        'Rise on tall ground (degrees)',
        0,
        30,
        1,
        'Terrain TR-3: the most the camera tilts down further so rock between it and you does not hide you. 0: off.',
      ],
      [
        'rockFade',
        'Rock fades in front of you',
        'bool',
        'Terrain TR-3: ground and cliffs between the camera and you thin out.',
      ],
      [
        'silhouette',
        'Your silhouette through rock',
        'bool',
        'Terrain TR-3: where rock still hides you, your shape shows through it as a tint.',
      ],
      [
        'outline',
        'Silhouette outline (art pixels)',
        0,
        3,
        1,
        "Player visibility: where something hides you, your outline shows in the colour of your top (lifted if dark); this wide in the picture's own pixels. 0: the plain dark blue tint instead.",
      ],
      [
        'outlineFill',
        'Silhouette fill inside the outline',
        0,
        1,
        0.05,
        "Player visibility: how much of the inside of your hidden shape is dotted in, in the outline's colour.",
      ],
      [
        'orbit',
        'Orbit round an island',
        'bool',
        'Island track IS-1: on a map with an orbit (the hub island) the camera stands out over the sea and turns round the middle as you walk the coast. Off: the fixed north view.',
      ],
      [
        'sunTurns',
        'Sun turns with the camera',
        'bool',
        'Island track IS-1, to compare: the sun keeps the same slant on screen as the camera turns, so shadows always fall the same way but swim as you walk round. Off (chosen): the sun stays put in the world.',
      ],
    ],
  ],
  [
    'quality',
    'Quality',
    [
      ['resolution', 'Resolution', 0.4, 1.5, 0.05],
      [
        'shadowMap',
        'Shadow detail',
        'sel',
        [
          [1024, 'Low'],
          [2048, 'Medium'],
          [4096, 'High'],
        ],
      ],
      [
        'auto',
        'Ease off when slow',
        'bool',
        'When frames come late, drop the costliest extras one at a time (depth of field detail, ambient occlusion, shadow and reflection refresh, bloom, far grass), and only then the resolution.',
      ],
      ['cull', 'Skip what’s off screen', 'bool', 'Props, grass and buildings outside the view aren’t drawn.'],
      [
        'minPropPx',
        'Skip tiny props',
        0,
        12,
        1,
        'Props smaller than this many pixels on screen aren’t drawn (0: all are drawn).',
      ],
      [
        'phonePropDistance',
        'Small props’ distance on phones',
        0,
        120,
        2,
        'On a phone, small props (flowers, tufts, pebbles, crates) fade out before this many metres; buildings, trees and anything big stay. 0: no limit.',
      ],
      [
        'battleLite',
        'Lighter battles',
        'bool',
        'Battles on the 3D stage refresh shadows and reflections every other frame and skip ambient occlusion.',
      ],
      [
        'sharpTex',
        'Sharp at a slant',
        'bool',
        'Pictures seen at a slant (paths, signs side-on, far roofs) stay sharp. Applies to pictures loaded after the change.',
      ],
      [
        'shadowCache',
        'Keep still shadows',
        'bool',
        'Shadows of things that never move are drawn once and kept; only moving things are drawn each frame.',
      ],
      [
        'frameBlock',
        'One light block per frame',
        'bool',
        'Everything lit reads the frame’s light (sun, sky, fog, shadow maps, lamps) from one block sent once a frame, instead of being sent it again for each kind of thing drawn. A test switch (phase 20): it should look the same.',
      ],
      [
        'gpuTimer',
        'Measure the graphics card',
        'bool',
        'Where the browser allows it, the debug overlay and log show how long the graphics card takes per frame.',
      ],
      [
        'edgeBleed',
        'Clean edges far off',
        'bool',
        'Far-off props keep their colour at the edges instead of a dark fringe.',
      ],
    ],
  ],
  ...TIME_OF_DAY_KEYS.map(k => [TIME_OF_DAY_GROUPS[k], 'Time of day: ' + TOD_NAMES[k], todFields(k)]),
];
provide({ ENGINE_SPEC }); /* to-module */
/* ready-made looks; a preset only lists what it changes */
/* phase 09 batch 1: the plain look, for judging props (a scene with plain: 1, the props test map and the Studio's
   prop turntable): no depth of field, bloom, colour grade, film grain, vignette, haze, mist, clouds, sun shafts or
   weather, and the time of day and season left out, so a prop shows as it is drawn and modelled under a steady sun */
export const PLAIN_LOOK = {
  lens: { blur: 0, bokeh: 0, aberration: 0, vignette: 0, grain: 0, sharpen: 0 },
  color: { exposure: 1, contrast: 1, saturation: 1, warmth: 0, bloom: 0, grade: 'none', gradeAmount: 0 },
  sun: { clouds: 0, cloudShadows: 0, shafts: 0, glare: 0 },
  air: {
    mist: 0,
    valleyMist: 0,
    particles: 0,
    weather: 0,
    heat: 0,
    wetGround: 0,
    sunFog: 0,
    godRays: 0,
    lightsInAir: 0,
    hazeDistance: 900,
  },
};
export const ENGINE_PRESETS = {
  sunny: {
    name: 'Sunny',
    v: {
      sun: { strength: 1.05, color: '#FFF0D8', height: 52, clouds: 0.4, cloudShadows: 0.22 },
      color: { exposure: 1, saturation: 1.1, warmth: 0.05, grade: 'film' },
      air: { mist: 0.1 },
    },
  },
  overcast: {
    name: 'Overcast',
    v: {
      sun: { strength: 0.45, color: '#E8ECF2', height: 70, clouds: 0.9, cloudShadows: 0.05, ambient: 1.3 },
      shadows: { strength: 0.35, softness: 2.5 },
      color: { saturation: 0.9, contrast: 0.98, warmth: -0.1, grade: 'cold', gradeAmount: 0.7 },
      air: { mist: 0.22 },
    },
  },
  golden: {
    name: 'Golden hour',
    v: {
      shadows: { strength: 0.85, tint: '#4A3E7A' },
      color: { warmth: 0.35, saturation: 1.15, bloom: 0.8, grade: 'dusk', gradeAmount: 0.8 },
      sun: { strength: 1.15, color: '#FFC88A', height: 24, angle: 20, clouds: 0.35, shafts: 0.8 },
      lights: { windowsDay: 0.45 },
    },
  },
  cave: {
    name: 'Cave',
    v: {
      sun: { strength: 0.25, color: '#B8B0E0', height: 75, ambient: 0.8, clouds: 0, cloudShadows: 0 },
      shadows: { strength: 0.5, tint: '#2A2448' },
      lights: { brightness: 1.4, glow: 1.3 },
      color: { bloom: 1, exposure: 1.05, grade: 'cold', gradeAmount: 0.5 },
      air: { mist: 0.18 },
    },
  },
  /* CAM-3: the diorama look: an upright, narrow sharp strip, a quick melt away, and the Miniature colour */
  miniature: {
    name: 'Miniature',
    v: {
      lens: { focusTilt: 1, focusBand: 0.35, blurFar: 1.8, blurNear: 0.7, blur: 2.2, miniature: 0.8 },
    },
  },
  mall: {
    name: 'Mall',
    v: {
      sun: { strength: 0.35, color: '#F4F0FF', height: 80, clouds: 0, cloudShadows: 0, ambient: 1.2 },
      shadows: { strength: 0.4, softness: 2 },
      lights: { brightness: 1.2, glow: 1 },
      color: { bloom: 0.9, saturation: 1.15, grade: 'vivid', gradeAmount: 0.8 },
    },
  },
};
provide({ ENGINE_PRESETS }); /* to-module */
/* the value for one dial: scene look → game-wide defaults → built-in default */
function lookDials() {
  if (typeof engineContext !== 'undefined' && engineContext.look) return engineContext.look;
  return null;
}
export let engineContext = { look: null, bypass: false, env: false };
let engineDataSource = () => (typeof gameData !== 'undefined' ? gameData.engine : null);
/* phase 04d: the Studio points it at its unsaved data (studio/js/engine-editor.js) */
export function setEngineDataSource(v) {
  engineDataSource = v;
  provide({ engineDataSource });
} /* the Studio points this at its unsaved data */
function gameDataDials() {
  const d = engineDataSource();
  return (d && d.defaults) || null;
}
/* CAM-3: the player's blur slider (Settings → Graphics → Blur): a factor on the game's blur, 1 by default (Medium) */
export function playerBlur() {
  const p = typeof saveData !== 'undefined' && saveData && saveData.preferences,
    v = p ? p.blur : null;
  return typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(1.5, v)) : 1;
}
/* alpha 0.5: a player's own expert dials (Settings → Graphics → Expert) come first */
function playerDials() {
  const p = typeof saveData !== 'undefined' && saveData && saveData.preferences;
  return p && p.expert && p.eng ? p.eng : null;
}
/* phase 20 C1: while a walk frame draws, each dial is looked up once (beginFrameSettings, after the environment update)
   and engineSetting answers from this table, one pre-made object per group, refilled in place. It answers only while
   the look and the environment flag are the ones it was filled with; anything else (no frame open, the Studio's
   defaults switch, a key not in ENGINE_DEFAULTS) takes the full lookup. */
const FRAME_SETTINGS = {};
for (const g in ENGINE_DEFAULTS) {
  FRAME_SETTINGS[g] = Object.create(null);
  for (const k in ENGINE_DEFAULTS[g]) FRAME_SETTINGS[g][k] = undefined;
}
const frameSettingsState = { open: false, look: null, env: false };
export function beginFrameSettings() {
  frameSettingsState.open = false;
  for (const g in FRAME_SETTINGS) {
    const F = FRAME_SETTINGS[g];
    for (const k in F) F[k] = engineSetting(g, k);
  }
  frameSettingsState.look = engineContext.look;
  frameSettingsState.env = engineContext.env;
  frameSettingsState.open = !engineContext.bypass;
}
export function endFrameSettings() {
  frameSettingsState.open = false;
  frameSettingsState.look = null;
}
export function engineSetting(group, key) {
  if (
    frameSettingsState.open &&
    engineContext.look === frameSettingsState.look &&
    engineContext.env === frameSettingsState.env &&
    !engineContext.bypass
  ) {
    const F = FRAME_SETTINGS[group];
    if (F && key in F) return F[key];
  }
  if (engineContext.bypass) return ENGINE_DEFAULTS[group][key];
  const L = lookDials(),
    G = gameDataDials(),
    P = playerDials();
  let v = P && P[group] ? P[group][key] : undefined;
  if (v === undefined && L && L[group]) v = L[group][key];
  if (v === undefined && G && G[group]) v = G[group][key];
  if (v === undefined) v = ENGINE_DEFAULTS[group][key];
  /* v26: the time of day and the weather lean on some dials while a walk scene draws (environment.js) */
  if (engineContext.env && typeof ENVIRONMENT_ENGINE_MODIFIERS !== 'undefined') {
    const m = ENVIRONMENT_ENGINE_MODIFIERS[group];
    if (m && m[key] && typeof v === 'number') v = m[key](v);
  }
  return v;
}
export function engineColor(group, key, fb) {
  const v = engineSetting(group, key) || fb;
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return hexToRgb(v).map(x => x / 255);
  if (Array.isArray(fb)) return fb;
  /* v43: a fallback given as 0..1 numbers is used as it is (it was divided by 255, which left the ambient light at nothing) */ return hexToRgb(
    fb || '#ffffff'
  ).map(x => x / 255);
}
