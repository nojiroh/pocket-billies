'use strict';
/* ================= ENGINE SETTINGS =================
   Every dial the renderer reads. Defaults live here; game data can override them for the whole game
   (gameData.engine.defaults), per walk scene (scenes[id].look; battles use the scene they happen in) and for the map
   (gameData.engine.map). Pocket Billies Studio edits all three in its Engine section.
   A value of null means "use the scene's own field" (its haze, sky, camera…). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { ENVIRONMENT_ENGINE_MODIFIERS, gameData, provide, saveData } from '../hooks.js';
import { hexToRgb } from '../art.js';
/* eslint-disable no-func-assign */
expose({
  ENGINE_DEFAULTS: [() => ENGINE_DEFAULTS],
  ENGINE_PRESETS: [() => ENGINE_PRESETS],
  ENGINE_SPEC: [() => ENGINE_SPEC],
  PLAIN_LOOK: [() => PLAIN_LOOK],
  engineColor: [() => engineColor, v => (engineColor = v)],
  engineContext: [() => engineContext, v => (engineContext = v)],
  engineDataSource: [() => engineDataSource, v => setEngineDataSource(v)],
  engineSetting: [() => engineSetting, v => ((engineSetting = v), provide({ engineSetting }))],
  gameDataDials: [() => gameDataDials, v => (gameDataDials = v)],
  lookDials: [() => lookDials, v => (lookDials = v)],
  playerDials: [() => playerDials, v => (playerDials = v)],
  setEngineDataSource: [() => setEngineDataSource, v => (setEngineDataSource = v)],
});
/* eslint-enable no-func-assign */
provide({ engineSetting });
/* to-module: end */
export const ENGINE_DEFAULTS = {
  lens: {
    focusBand: 0.3,
    blurFar: 1.5,
    blurNear: 0.9,
    blur: 0.5,
    bokeh: 1,
    aberration: 0.5,
    vignette: 0.3,
    grain: 0.025,
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
    seamless: true,
    solidTrees: true,
    treeDetail: 20,
    treeCount: 40,
    mini3d: true,
    variety: 1,
    wear: 1,
    propTurn: 1,
    texDetail: 1,
    moods: 1,
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
    sway: 1,
    tilt: 1,
    turn: 35,
    zoomMin: 0.55,
    zoomMax: 1.7,
    pixelGrid: false,
  },
  quality: {
    resolution: 1,
    shadowMap: 2048,
    auto: true,
    cull: true,
    shadowCache: true,
    gpuTimer: true,
    battleLite: true,
    sharpTex: true,
    edgeBleed: true,
  },
};
provide({ ENGINE_DEFAULTS }); /* to-module */
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
        'How deep the in-focus zone is, as a share of the camera distance.',
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
      [
        'seamless',
        'Seamless world',
        'bool',
        'Roads are ground you walk on and the next scene is in view past an exit (v43). Off: the walk-out line of before.',
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
      ['lead', 'Leads your walk (m)', 0, 4, 0.1],
      ['sway', 'Walk bob', 0, 2, 0.05],
      ['tilt', 'Phone tilt', 0, 3, 0.05],
      ['turn', 'Turn limit (degrees)', 0, 80, 1],
      ['zoomMin', 'Closest zoom', 0.3, 1, 0.05],
      ['zoomMax', 'Farthest zoom', 1, 3, 0.05],
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
export let engineDataSource = () => (typeof gameData !== 'undefined' ? gameData.engine : null);
/* phase 04d: the Studio points it at its unsaved data (studio/js/engine-editor.js) */
export function setEngineDataSource(v) {
  engineDataSource = v;
  provide({ engineDataSource });
} /* the Studio points this at its unsaved data */
function gameDataDials() {
  const d = engineDataSource();
  return (d && d.defaults) || null;
}
/* alpha 0.5: a player's own expert dials (Settings → Graphics → Expert) come first */
function playerDials() {
  const p = typeof saveData !== 'undefined' && saveData && saveData.preferences;
  return p && p.expert && p.eng ? p.eng : null;
}
export function engineSetting(group, key) {
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
