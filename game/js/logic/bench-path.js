// @ts-check
'use strict';
/* ================= BENCH PATH (test data track TD-2) =================
   The benchmark path the Graphics test walks (game/js/graphics-test.js; TD-3's headless check walks the same one):
   named segments in test_graphics (tools/build-test-scenes.py t_graphics) and one room (test_light_room), each a route
   of points with its own hour, weather and season and the things it has to show (water, something to hide behind,
   grass, lamps, fog...). Every engine dial (ENGINE_SPEC, engine/settings.js) needs one of those things, or is named
   as not measurable on a walk with the reason. Pure data and rules; runs in Node (tools/test/bench-path.test.mjs). */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import { provide } from '../hooks.js';
/* eslint-disable no-func-assign */
expose({
  ALT_UNSET: [() => ALT_UNSET],
  BENCH_BUDGET_MB: [() => BENCH_BUDGET_MB],
  BENCH_BUILD: [() => BENCH_BUILD],
  BENCH_DIAL_NEEDS: [() => BENCH_DIAL_NEEDS],
  BENCH_NOT_HERE: [() => BENCH_NOT_HERE],
  BENCH_SEGMENTS: [() => BENCH_SEGMENTS],
  NEEDS: [() => NEEDS],
  STATE_FORMAT: [() => STATE_FORMAT],
  SUMMER: [() => SUMMER],
  // @ts-expect-error -- replaced on purpose
  benchAltValue: [() => benchAltValue, v => (benchAltValue = v)],
  // @ts-expect-error -- replaced on purpose
  benchFrameStats: [() => benchFrameStats, v => (benchFrameStats = v)],
  // @ts-expect-error -- replaced on purpose
  benchLookHour: [() => benchLookHour, v => (benchLookHour = v)],
  // @ts-expect-error -- replaced on purpose
  benchMemoryGuess: [() => benchMemoryGuess, v => ((benchMemoryGuess = v), provide({ benchMemoryGuess }))],
  // @ts-expect-error -- replaced on purpose
  benchMinutes: [() => benchMinutes, v => ((benchMinutes = v), provide({ benchMinutes }))],
  // @ts-expect-error -- replaced on purpose
  benchNeedOf: [() => benchNeedOf, v => (benchNeedOf = v)],
  // @ts-expect-error -- replaced on purpose
  benchPlan: [() => benchPlan, v => ((benchPlan = v), provide({ benchPlan }))],
  // @ts-expect-error -- replaced on purpose
  benchRouteLength: [() => benchRouteLength, v => (benchRouteLength = v)],
  // @ts-expect-error -- replaced on purpose
  benchSegmentFor: [() => benchSegmentFor, v => (benchSegmentFor = v)],
  // @ts-expect-error -- replaced on purpose
  benchStateLoad: [() => benchStateLoad, v => ((benchStateLoad = v), provide({ benchStateLoad }))],
  // @ts-expect-error -- replaced on purpose
  benchStatePack: [() => benchStatePack, v => (benchStatePack = v)],
});
/* eslint-enable no-func-assign */
provide({ benchMemoryGuess, benchMinutes, benchPlan, benchStateLoad });
/* to-module: end */
/* the owner's answer (test-data-track.md section 1): the game's own estimate of graphics memory on a phone may not pass
   this; a step that would is skipped ("over budget"), never run into a reload */
export const BENCH_BUDGET_MB = 300;
provide({ BENCH_BUDGET_MB }); /* to-module */

/**
 * The segments, in the order they are walked. `route`: points in the scene's metres, walked one after another (the
 * first is where the player is put); `hold`: seconds to stand at the last point (for the standing-still camera);
 * `time`: the hour (or `look`: one of the five time-of-day looks, at its own hour); `weather` and `season` forced;
 * `folk`: townsfolk switched on for the segment only; `eng`: engine values held for the segment (the sun's place, the
 * figures); `turn`: the camera turns as it goes; `run`: at a run; `has`: what it shows, matched against a dial's need.
 * @type {{id: string, name: string, scene: string, route: number[][], time?: number, look?: string,
 *   weather?: string, season?: string, zoom?: number, hold?: number, folk?: number, run?: boolean, turn?: boolean,
 *   eng?: Record<string, Record<string, any>>, has: string[]}[]}
 */
export const BENCH_SEGMENTS = [
  /* open paving and the shadow court's casters: the full-screen passes, the colour, the framing */
  {
    id: 'open',
    name: 'Open ground',
    scene: 'test_graphics',
    route: [
      [5, 6],
      [16, 6],
      [16, 12.5],
      [5, 12.5],
    ],
    has: ['any'],
  },
  { id: 'stand', name: 'Standing still', scene: 'test_graphics', route: [[10, 9]], hold: 7, has: ['idle'] },
  {
    id: 'shade',
    name: 'Shadow court',
    scene: 'test_graphics',
    route: [
      [22, 8.8],
      [38, 8.8],
      [38, 6.4],
      [22, 6.4],
    ],
    has: ['shadows', 'houses'],
  },
  /* the camera behind the shadow court's houses: the player hidden (silhouette, outline, see-through circle, fades) */
  {
    id: 'behind',
    name: 'Behind the houses',
    scene: 'test_graphics',
    route: [
      [21.5, 16.6],
      [39, 16.6],
    ],
    has: ['behind'],
  },
  {
    id: 'pond',
    name: 'The pond',
    scene: 'test_graphics',
    route: [
      [43.5, 5.6],
      [56.5, 5.6],
    ],
    has: ['water'],
  },
  /* TD-2's strip at the north edge: the stream's shore with lamps, a spring and a fountain across it, a deep pond */
  {
    id: 'shore',
    name: 'Stream, spring and fountain',
    scene: 'test_graphics',
    route: [
      [5, 49.4],
      [35, 49.4],
    ],
    has: ['stream', 'deep'],
  },
  {
    id: 'shoreNight',
    name: 'Lamps by the stream at night',
    scene: 'test_graphics',
    route: [
      [5, 49.4],
      [35, 49.4],
    ],
    time: 22,
    has: ['lampWater'],
  },
  {
    id: 'meadow',
    name: 'Through tall grass',
    scene: 'test_graphics',
    route: [
      [42.5, 25],
      [57.5, 25],
      [57.5, 27.5],
      [42.5, 27.5],
    ],
    has: ['grass'],
  },
  {
    id: 'plaza',
    name: 'Townsfolk round the arrival',
    scene: 'test_graphics',
    route: [
      [26, 2.6],
      [34, 2.6],
      [30, 4.4],
    ],
    folk: 8,
    has: ['folk'],
  },
  {
    id: 'figures',
    name: 'Townsfolk as figures',
    scene: 'test_graphics',
    route: [
      [26, 2.6],
      [34, 2.6],
      [30, 4.4],
    ],
    folk: 8,
    eng: { people: { figures: true } },
    has: ['figures'],
  },
  {
    id: 'slope',
    name: 'Up the slope, by the cliff',
    scene: 'test_graphics',
    route: [
      [45.5, 48.4],
      [47.5, 50],
      [47.5, 56.5],
      [50.5, 56.5],
    ],
    has: ['slope'],
  },
  {
    id: 'lamps',
    name: 'The lamp square at night',
    scene: 'test_graphics',
    route: [
      [22, 20.6],
      [38, 20.6],
    ],
    time: 22,
    has: ['night'],
  },
  {
    id: 'fog',
    name: 'Dawn fog',
    scene: 'test_graphics',
    route: [
      [30, 35],
      [30, 44],
    ],
    look: 'dawn',
    weather: 'fog',
    has: ['fog'],
  },
  {
    id: 'rain',
    name: 'The meadow in the rain',
    scene: 'test_graphics',
    route: [
      [42.5, 22],
      [57.5, 22],
    ],
    weather: 'rain',
    has: ['rain'],
  },
  /* the depth corridor: an avenue of trees to the far hills (far things, haze, depth of field, solid trees) */
  {
    id: 'depth',
    name: 'Down the avenue',
    scene: 'test_graphics',
    route: [
      [30, 34.5],
      [30, 44.5],
    ],
    zoom: 1.3,
    has: ['far', 'props'],
  },
  /* the sun gap with a low sun straight ahead (the cost test's light): shafts, glare, god rays */
  {
    id: 'sun',
    name: 'Into the low sun',
    scene: 'test_graphics',
    route: [
      [10.5, 19.5],
      [10.5, 24.5],
    ],
    zoom: 1.1,
    eng: { sun: { angle: -90, height: 18 } },
    has: ['sun'],
  },
  {
    id: 'sky',
    name: 'Under open sky',
    scene: 'test_graphics',
    route: [
      [43, 34],
      [57, 43],
    ],
    zoom: 1.7,
    has: ['sky'],
  },
  /* a zigzag at a run with the camera turning: the camera's feel, the figures' turns */
  {
    id: 'turn',
    name: 'A run with turns',
    scene: 'test_graphics',
    route: [
      [43, 35],
      [50, 41],
      [57, 35],
      [50, 43.5],
    ],
    run: true,
    turn: true,
    has: ['motion'],
  },
  {
    id: 'room',
    name: 'Inside a room',
    scene: 'test_light_room',
    route: [
      [3.5, 2.5],
      [10.5, 2.5],
      [7, 4.6],
    ],
    has: ['room'],
  },
  /* the five time-of-day looks, each at its own hour, on the open plain (sky, haze and light all in view) */
  ...['dawn', 'day', 'golden', 'dusk', 'night'].map(k => ({
    id: 'look-' + k,
    name: 'Open sky at ' + (k === 'golden' ? 'golden hour' : k),
    scene: 'test_graphics',
    route: [
      [43, 34],
      [57, 43],
    ],
    zoom: 1.4,
    look: k,
    has: ['look-' + k],
  })),
];
provide({ BENCH_SEGMENTS }); /* to-module */

/* why a dial can't be measured on a walk (a need starting with '-') */
export const BENCH_NOT_HERE = {
  '-worldMap': 'drawn only on the world map',
  '-island': 'only on the hub’s floating island',
  '-battle': 'only in a battle',
  '-moment': 'only in a talk, at a boss, in a leader’s arena or by a landmark',
  '-touch': 'needs a finger on the screen or a mouse wheel',
  '-tilt': 'needs the phone’s tilt sensor',
  '-place': 'only in places the bench doesn’t have (caves, lava, desert, snowy heights, the sea)',
  '-clock': 'follows the real clock; the test sets the hour',
  '-pinned':
    'the test holds it to measure (automatic quality, its controller and resolution steps, warm-up, the graphics card’s timers, pixel budget)',
};

/* each dial's need: 'group.key ...' lists by need; a `group.*` stands for a whole time-of-day look. Every ENGINE_SPEC
   row is in exactly one list (tools/test/bench-path.test.mjs fails on a new row with none) */
export const NEEDS = {
  any: `lens.aberration lens.vignette lens.grain lens.sharpen
    color.exposure color.shoulder color.contrast color.saturation color.warmth color.outlines color.inkFollow
    color.grade color.gradeAmount color.tone color.ink
    air.mist air.mistHeight air.particles
    world.moods world.groundBumps world.groundShine
    camera.pixelGrid camera.pitch camera.pitchAdd camera.height camera.distance camera.fov
    quality.resolution quality.cull quality.sharpTex quality.hdrHalf quality.mediump quality.freeTicks quality.drawOrder quality.groundSlice quality.groundTiles
    quality.postMerge quality.farTrees
    quality.slotBudget quality.texAge quality.uploadQueue quality.meshWorker quality.placeWarm`,
  idle: 'camera.idleOn camera.idleDelay camera.idleZoom camera.idleBlend',
  shadows: `sun.angle sun.height sun.color sun.strength sun.ambientSky sun.ambientGround sun.ambient sun.shAmbient
    shadows.strength shadows.selfShade shadows.softness shadows.tint shadows.hue shadows.pixel shadows.pixelSize
    shadows.pixelSteps shadows.fit shadows.cascades shadows.nearRadius shadows.steadyEdges shadows.aoKind
    shadows.contact shadows.buildings shadows.ao shadows.aoRadius shadows.groundAO shadows.groundAOSky shadows.aoPlane
    air.hazeShade quality.shadowMap quality.shadowCache quality.shadowCells quality.shadowHold
    quality.phoneShadow`,
  houses: `lights.windowsDay lights.windowFacing world.buildingBumps world.frontMaterial world.buildings3d`,
  behind: `camera.silhouette camera.outline camera.outlineFill camera.hideFade camera.hideSize camera.hideAmount
    camera.coverFade`,
  water: `water.shallow water.deep water.reflection water.ripples water.foam water.glints water.kinds water.caustics
    water.clarity water.shore water.bed water.pixel water.bands water.frames`,
  stream: 'water.rings water.leaves water.steam water.fountains water.wallLight',
  deep: 'water.fish',
  lampWater: 'lights.onWater',
  grass: 'grass.density grass.height grass.low grass.high grass.wind grass.gusts grass.bend quality.grassAhead',
  folk: 'quality.townFolk',
  figures: `people.figures people.figure people.style people.density people.yawSteps people.outline people.folk
    people.atlas`,
  slope: `world.cliffFaces world.cliffEdges world.hugSlopes camera.rise camera.rockFade camera.band air.valleyMist`,
  night: `color.bloom color.bloomThreshold color.bloomSize color.bloomEven
    lights.brightness lights.pools lights.glow lights.flicker
    shadows.lampShadows shadows.lampFix air.lightsInAir air.fogLamps world.interiors
    quality.stableLights quality.lights`,
  fog: 'air.fogVolume',
  rain: 'air.weather air.wetGround',
  far: `lens.focusBand lens.focusTilt lens.edgeBlur lens.miniature lens.focusEase lens.blurFar lens.blurNear
    lens.nearSpread lens.blur lens.bokeh
    air.haze air.hazeStart air.hazeDistance air.sunFog air.skyGlow air.hazeSky air.hazeTint air.hazeFalloff air.mistRay
    world.curve world.farProps world.farHills quality.edgeBleed quality.normalMips`,
  props: `world.voxelProps world.voxelChunky world.voxelLowPoly world.solidProps world.solidTrees world.treeCoreShade
    world.treeDetail world.treeCount world.variety world.wear world.propTurn world.texDetail
    quality.minPropPx quality.phonePropDistance quality.spriteInstances`,
  sun: `sun.shafts sun.glare sun.shaftLength sun.followLight air.godRays air.cheapShafts air.shaftPick`,
  sky: 'sun.innerSun sun.clouds sun.cloudSpeed sun.cloudShadows quality.skyLast',
  motion: `camera.lead camera.leadSmooth camera.leadSide camera.smooth camera.deadW camera.deadH camera.softW
    camera.softH camera.blend camera.sway camera.turn camera.turnHold camera.turnAngle camera.runOn camera.runZoom
    camera.runBlend`,
  room: 'lights.windowLight lights.roomLight',
  'look-dawn': 'todDawn.*',
  'look-day': 'todDay.*',
  'look-golden': 'todGolden.*',
  'look-dusk': 'todDusk.*',
  'look-night': 'todNight.*',
  '-worldMap': `world.relief world.reliefShade world.mini3d
    worldMap.lagoon worldMap.falls worldMap.treeModels worldMap.treeFar worldMap.fences worldMap.bridges`,
  '-island': 'camera.orbit camera.sunTurns',
  '-battle': 'quality.battleLite camera.encZoom camera.encMin camera.encMax camera.leaveZoom',
  '-moment': `camera.intOn camera.intPull camera.talkOn camera.talkZoom camera.talkBlend camera.bossOn camera.bossNear
    camera.bossTime camera.bossZoom camera.bossLean camera.arenaOn camera.arenaZoom camera.arenaBlend`,
  '-touch': `camera.zoomSmooth camera.pinchSpeed camera.wheelSpeed camera.zoomBand camera.zoomToPoint
    camera.zoomPointMax camera.stopPull camera.stopTapTime camera.stopTapMove`,
  '-tilt': 'camera.tilt',
  '-place': 'air.caveDark air.heat world.snowLine water.tide',
  '-clock': 'sun.clock',
  '-pinned': 'quality.auto quality.warmUp quality.gpuTimer quality.phonePixels quality.controller quality.resSteps',
};
/** dial ('group.key' or 'group.*') → its need */
export const BENCH_DIAL_NEEDS = /** @type {Record<string, string>} */ ({});
for (const [need, list] of Object.entries(NEEDS))
  for (const k of list.split(/\s+/).filter(Boolean)) BENCH_DIAL_NEEDS[k] = need;

/* the dials read only when a place is built: the ground, grass, props and figures are made again before the step and
   after it (map-cache.js rebuildFromSettings frees the old ones first) */
export const BENCH_BUILD = new Set(
  `world.voxelProps world.voxelChunky world.voxelLowPoly world.farProps world.farHills world.groundBumps
  world.buildings3d world.cliffFaces world.cliffEdges world.hugSlopes world.solidProps world.solidTrees
  world.treeCoreShade world.treeCount world.interiors world.variety world.wear world.propTurn world.texDetail
  grass.density grass.height grass.low grass.high water.kinds water.bed water.shore
  people.figures people.figure people.style people.density people.yawSteps people.outline people.folk people.atlas
  quality.shadowMap quality.hdrHalf`
    .split(/\s+/)
    .filter(Boolean)
);

/** a dial's need, or undefined when it has none (a new row nobody tagged)
 * @param {string} group @param {string} key */
export function benchNeedOf(group, key) {
  return BENCH_DIAL_NEEDS[group + '.' + key] ?? BENCH_DIAL_NEEDS[group + '.*'];
}
/** where a dial is measured: { segment } or { notHere: reason }
 * @param {string} group @param {string} key */
export function benchSegmentFor(group, key, segments = BENCH_SEGMENTS) {
  const need = benchNeedOf(group, key);
  if (!need) return { notHere: 'no need tag (bench-path.js)' };
  if (need.startsWith('-')) return { notHere: /** @type {any} */ (BENCH_NOT_HERE)[need] || need };
  const s = segments.find(x => x.has.includes(need));
  return s ? { segment: s.id } : { notHere: 'no segment has ' + need };
}

/* a colour other than the shipped one, and a haze or camera number that is unset by default */
export const ALT_UNSET = /** @type {Record<string, number>} */ ({ hazeDistance: 40, pitch: 40, height: 11 });
/**
 * The one other value a dial is measured at: not an extreme, but a quarter of its range away from the shipped value
 * (toward the middle), the other choice of a switch or list, another colour.
 * @param {any[]} row an ENGINE_SPEC row [key, label, a, b, step?] @param {any} def the shipped value
 */
export function benchAltValue(row, def) {
  const [key, , a, b, step] = row;
  if (typeof a === 'number') {
    const span = b - a,
      st = typeof step === 'number' && step > 0 ? step : span / 100,
      d = typeof def === 'number' ? def : a,
      up = d + span * 0.25 <= b && (d - a <= b - d || d - span * 0.25 < a),
      v = up ? d + span * 0.25 : d - span * 0.25,
      r = Math.round((Math.round((v - a) / st) * st + a) * 1e4) / 1e4;
    return Math.min(b, Math.max(a, r === d ? (up ? d + st : d - st) : r));
  }
  if (a === 'bool') return typeof def === 'number' ? (def ? 0 : 1) : !def;
  if (a === 'sel') {
    const opts = (b || []).map((/** @type {any[]} */ o) => o[0]),
      i = opts.findIndex((/** @type {any} */ v) => String(v) === String(def));
    return opts.length > 1 ? opts[(i + 1) % opts.length] : def;
  }
  if (a === 'color' || a === 'color?') return String(def).toUpperCase() === '#FF4080' ? '#40C0FF' : '#FF4080';
  if (a === 'num?') return def == null ? (ALT_UNSET[key] ?? 10) : null;
  return def;
}

/** the summer sunrise and sunset (environment.js environmentState, season forced to summer) */
export const SUMMER = { rise: 6 - 0.6 * 1.1, set: 20.2 + 0.6 * 1.8 };
/**
 * The hour a time-of-day look shows by itself: its own hour (the season's sunrise or sunset plus `at`) once its blend
 * is over, before the next look starts (logic/time-of-day.js: dawn and day from sunrise, the rest from sunset).
 * @param {string} k dawn, day, golden, dusk or night @param {Record<string, any>} defaults ENGINE_DEFAULTS
 */
export function benchLookHour(k, defaults) {
  const keys = ['dawn', 'day', 'golden', 'dusk', 'night'],
    grp = { dawn: 'todDawn', day: 'todDay', golden: 'todGolden', dusk: 'todDusk', night: 'todNight' },
    anchor = { dawn: SUMMER.rise, day: SUMMER.rise, golden: SUMMER.set, dusk: SUMMER.set, night: SUMMER.set },
    at = (/** @type {string} */ x) =>
      /** @type {any} */ (anchor)[x] + (+(defaults[/** @type {any} */ (grp)[x]] || {}).at || 0),
    i = keys.indexOf(k);
  if (i < 0) return 15;
  const start = at(k) + Math.max(0.05, +(defaults[/** @type {any} */ (grp)[k]] || {}).blend || 0),
    next = i < keys.length - 1 ? at(keys[i + 1]) : at('dawn') + 24,
    h = Math.min(start + 0.25, (start + next) / 2);
  return Math.round((((h % 24) + 24) % 24) * 100) / 100;
}

/** a route's length in metres @param {number[][]} route */
export function benchRouteLength(route) {
  let m = 0;
  for (let i = 1; i < route.length; i++) m += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return m;
}

/**
 * The run as a list of steps. For each segment, in order: its look as shipped, each of its dials at the other value,
 * and its look as shipped again (first and last show how much the segment wanders); the open ground's look again
 * every `every` steps (the device warming up); the presets at the end on the shadow court. A dial no segment has is
 * one `notHere` step with its reason (measured nothing, said so).
 * @param {any[]} spec ENGINE_SPEC @param {Record<string, any>} defaults ENGINE_DEFAULTS
 * @param {{groups?: string[], every?: number, presets?: [string, string][], segments?: typeof BENCH_SEGMENTS}} [o]
 */
export function benchPlan(spec, defaults, o = {}) {
  const segments = o.segments || BENCH_SEGMENTS,
    every = o.every || 20,
    groups = o.groups ? new Set(o.groups) : null,
    bySeg = /** @type {Record<string, any[]>} */ ({}),
    notHere = [];
  for (const [group, , rows] of spec) {
    if (groups && !groups.has(group)) continue;
    for (const row of rows) {
      const key = row[0],
        dial = group + '.' + key,
        shipped = defaults[group] ? defaults[group][key] : undefined,
        w = benchSegmentFor(group, key, segments);
      if (w.notHere) {
        notHere.push({ kind: 'notHere', dial, label: row[1], why: w.notHere });
        continue;
      }
      (bySeg[/** @type {string} */ (w.segment)] = bySeg[/** @type {string} */ (w.segment)] || []).push({
        kind: 'dial',
        seg: w.segment,
        dial,
        label: row[1],
        shipped,
        value: benchAltValue(row, shipped),
        build: BENCH_BUILD.has(dial),
      });
    }
  }
  const out = [],
    base = (/** @type {string} */ seg, /** @type {string} */ why) => ({ kind: 'base', seg, label: why });
  let since = 0;
  for (const s of segments) {
    const L = bySeg[s.id];
    if (!L || !L.length) continue;
    out.push(base(s.id, 'as shipped'));
    for (const d of L) {
      if (since >= every) {
        out.push(Object.assign(base('open', 'as shipped (drift check)'), { drift: true }));
        since = 0;
      }
      out.push(d);
      since++;
    }
    out.push(base(s.id, 'as shipped, again'));
  }
  for (const [k, name] of o.presets || [])
    out.push({ kind: 'preset', seg: 'shade', preset: k, label: name, build: true });
  if (out.length) out.push(Object.assign(base('open', 'as shipped (drift check)'), { drift: true }));
  return out.concat(notHere);
}

/** minutes the run should take: each walked step's route at walking pace, plus settling (and a rebuild's wait)
 * @param {any[]} plan */
export function benchMinutes(plan, segments = BENCH_SEGMENTS, speed = 3.4) {
  const by = Object.fromEntries(segments.map(s => [s.id, s]));
  let sec = 0;
  for (const p of plan) {
    const s = by[p.seg];
    if (!s) continue;
    sec += benchRouteLength(s.route) / (s.run ? speed * 1.6 : speed) + (s.hold || 0) + 1.5 + (p.build ? 4 : 0);
  }
  return Math.ceil(sec / 60);
}

/**
 * Frame-time numbers from the gaps between frames (ms): frames a second, the median, the 90th and 99th percentile and
 * the worst; `jank`, how many frames took more than twice the median.
 * @param {number[]} gaps
 */
export function benchFrameStats(gaps) {
  const g = gaps.filter(x => x > 0 && isFinite(x)).sort((a, b) => a - b);
  if (!g.length) return { frames: 0, fps: null, p50: null, p90: null, p99: null, worst: null, jank: 0 };
  const q = (/** @type {number} */ f) => g[Math.min(g.length - 1, Math.floor(f * g.length))],
    sum = g.reduce((a, b) => a + b, 0),
    r1 = (/** @type {number} */ v) => Math.round(v * 10) / 10,
    p50 = q(0.5);
  return {
    frames: g.length,
    fps: r1((g.length * 1000) / sum),
    p50: r1(p50),
    p90: r1(q(0.9)),
    p99: r1(q(0.99)),
    worst: r1(g[g.length - 1]),
    jank: g.filter(x => x > p50 * 2).length,
  };
}

/**
 * What graphics memory (MB, the game's own estimate) a step should come to, from the place as it is now (`kinds`:
 * MB by kind, engine/webgl.js gpuMemory) and the dial's move from `from` to `to`. Only the dials that size the
 * render targets are guessed (resolution, shadow detail, half-float HDR); any other step is guessed at what the place
 * holds now, plus the most a place has grown on a rebuild so far (`grow`).
 * @param {Record<string, number>} kinds @param {string} dial @param {any} from @param {any} to @param {number} [grow]
 */
export function benchMemoryGuess(kinds, dial, from, to, grow = 0) {
  const total = Object.values(kinds).reduce((a, b) => a + (+b || 0), 0),
    T = +kinds.targets || 0;
  let add = 0;
  if (dial === 'quality.resolution' && +from > 0) add = T * 0.8 * ((+to / +from) ** 2 - 1);
  else if (dial === 'quality.shadowMap' && +from > 0) add = (((+to) ** 2 - (+from) ** 2) * 4 * 2) / 1048576;
  else if (dial === 'quality.hdrHalf') add = to ? -T * 0.3 : T * 0.3;
  return Math.round((total + add + Math.max(0, grow)) * 10) / 10;
}

/* the run's progress kept in localStorage after every step (TD-2: it resumes after a reload): numbers, dial names and
   segment ids only */
export const STATE_FORMAT = 1;
/** @param {{build?: any, created: string, groups?: string[]|null, res: number, at: number, running?: number|null, steps: any[]}} st */
export function benchStatePack(st) {
  return JSON.stringify({ f: STATE_FORMAT, ...st });
}
/** the saved progress, or null when there is none or it is from another build or format
 * @param {string|null} text @param {any} [build] */
export function benchStateLoad(text, build) {
  try {
    const o = JSON.parse(text || 'null');
    if (!o || o.f !== STATE_FORMAT || !Array.isArray(o.steps) || typeof o.at !== 'number') return null;
    if (build != null && o.build != null && o.build !== build) return null;
    return o;
  } catch (e) {
    return null;
  }
}
