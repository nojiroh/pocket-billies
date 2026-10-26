'use strict';
/* ================= THE WORLD MAP: THE BOWL (phase 10) =================
   The lower half of the Hollow Earth seen from above, like a tabletop (docs/phases/10-world-map-bowl.md). This is the
   Map tab, the airship flight, the picture of the Hollow Earth in the opening fall (opening-fall.js films it) and the
   far wall the walk scenes see at their horizon (walk/sky.js). The old sphere map is gone (session E-map-4).
   The ground is a low-poly mesh over the grid in logic/bowl.js: the bowl's floor and walls, each place's bump or dip
   (gentle, owner 2026-10-19), coloured by region with the roads laid into it. Places are pins (owner: no miniatures
   yet); the camera's arithmetic is logic/bowl-camera.js. The debug menu's "Bowl map test"
   (bowl-map-test.js) checks it on a device.
   Controls: one finger drags the land; two fingers pinch to zoom, twist to turn and slide up or down to tilt; on a
   computer the wheel zooms and the right button (or Shift) turns and tilts; arrows or WASD pan, Q and E turn. Home goes
   back to where you are; tapping a pin opens the place's card (Travel is the card's own button). Coming from a walk
   scene, the walk camera rises and the bowl takes over close above you and pulls back. */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from './test-globals.js';
import { airshipFlight, flyDraw, flySkip, flyTick, paintWorldMapCard, provide, render } from './hooks.js';
import { $ } from './util.js';
import { LOCATIONS, LOCATION_BY_ID, ROADS, gameData, locationSubtitle, worldExtra } from './game-data.js';
import { canEnter, distanceText, tripTo } from './logic/rules.js';
import { runMarkDraw } from './logic/run-marks.js';
import {
  BOWL_GROUND_EXTENT,
  BOWL_ISLAND_BASE,
  BOWL_ISLAND_LIFT,
  bowlBaseHeight,
  bowlCoastAt,
  bowlCompass,
  bowlGridHeight,
  bowlGroundGrid,
  bowlHeight,
  bowlIsles,
  bowlRelief,
  bowlReliefFeatures,
  bowlSeaInput,
  bowlSeedShift,
  bowlSpotOf,
  bowlSun,
  bowlWaterLevel,
  bowlWetAt,
  bowlXY,
} from './logic/bowl.js';
import {
  BOWL_CAMERA,
  FLOAT_CAMERA,
  bowlCamClamp,
  bowlCamEase,
  bowlCamGap,
  bowlCamHome,
  bowlCamHomeFloat,
  bowlCamMatrix,
  bowlCamOverview,
  bowlCamPan,
  bowlCamProject,
  bowlCamTurn,
  bowlCamUseFloat,
  bowlCamUseGround,
  bowlCamView,
  bowlCamZoom,
  bowlPickGround,
  bowlSurface,
  bowlToGpu,
} from './logic/bowl-camera.js';
import {
  BOWL_CLOUD_LEVELS,
  BOWL_SKY_KEYS,
  bowlCloudAt,
  bowlCloudLayout,
  bowlCloudLevel,
  bowlCloudShow,
  bowlSkyGrid,
  bowlSunAt,
} from './logic/bowl-weather.js';
import {
  BOWL_REGION_TREES,
  BOWL_THING_SCALE,
  bowlAverageColour,
  bowlBridgeShape,
  bowlClumps,
  bowlLandmarkPick,
  bowlMapPoint,
  bowlPropClass,
  bowlTreeFromRecipe,
  bowlTreeStyle,
  bowlYouPoint,
} from './logic/bowl-things.js';
import { bowlHasCoast, bowlIslandHeights, bowlIslandMapId, bowlIslandPlotThings } from './logic/bowl-island.js';
import {
  FLOAT_ISLAND,
  FLOAT_LAGOON,
  FLOAT_STRIDE,
  floatFallMesh,
  floatFallSpots,
  floatGroundHeight,
  floatGroundMesh,
  floatInside,
  floatIslandMesh,
  floatLagoonAt,
  floatLagoonDepth,
  floatLagoonRing,
  floatLagoonWater,
  floatMistPuffs,
} from './logic/float-island.js';
import { orbitYawAt } from './logic/camera-orbit.js';
import { isLiteMap, loadMapFile } from './map-files.js';
import { escapeHtml, reducedMotion, saveData, uiState } from './game-state.js';
import { frameCount, frameStop, frameTask } from './frame-scheduler.js';
import { ART_CACHE, artLoad, artPixels, makeCanvas, uiIconHTML } from './art.js';
import { personWalkFrames } from './person-art.js';
import { walkView } from './walk-view.js';
import { engineSetting } from './engine/settings.js';
import {
  bindQuad,
  ensurePrograms,
  gpuLoading,
  gpuState,
  initWebgl,
  renderTarget,
  uploadMesh,
  webgl2Supported,
} from './engine/webgl.js';
import { POST_EFFECT_SHADERS, drawPostEffects, projectToScreenUv } from './engine/post-effects.js';
import { WEATHER_LOOKS, environmentLitFraction, environmentLookAt, environmentState } from './environment.js';
import { walkRenderer } from './walk/walk-state.js';
import { PIXEL_WATER_GLSL } from './walk/walk-shaders.js';
import { setPixelWaterUniform } from './walk/water-data.js';
import { clampZoom } from './walk/camera.js';
import { loadPropModelRecipe, lowPolyFromRecipe } from './prop-models.js';
/* eslint-disable no-func-assign */
expose({
  BOWL_BAYER: [() => BOWL_BAYER],
  BOWL_HAZE: [() => BOWL_HAZE],
  BOWL_INDEX: [() => BOWL_INDEX],
  BOWL_KIND_GROUND: [() => BOWL_KIND_GROUND],
  BOWL_LIGHT: [() => BOWL_LIGHT],
  BOWL_METRES: [() => BOWL_METRES],
  BOWL_MIX: [() => BOWL_MIX],
  BOWL_PIN: [() => BOWL_PIN],
  BOWL_PIXEL_GLSL: [() => BOWL_PIXEL_GLSL],
  BOWL_REGION_GROUND: [() => BOWL_REGION_GROUND],
  BOWL_REGION_SHADE: [() => BOWL_REGION_SHADE],
  BOWL_RIVER_FIELD: [() => BOWL_RIVER_FIELD],
  BOWL_ROUTE_FIELD: [() => BOWL_ROUTE_FIELD],
  BOWL_SEA_FAR: [() => BOWL_SEA_FAR],
  BOWL_SHADOW_GLSL: [() => BOWL_SHADOW_GLSL],
  BOWL_SHADOW_SIZE: [() => BOWL_SHADOW_SIZE],
  BOWL_SKY_GLSL: [() => BOWL_SKY_GLSL],
  BOWL_STRUCTURE: [() => BOWL_STRUCTURE],
  BOWL_SUN: [() => BOWL_SUN],
  BOWL_SUN_NOW: [() => BOWL_SUN_NOW],
  BOWL_TREE_LOOK: [() => BOWL_TREE_LOOK],
  BOWL_WALL_W: [() => BOWL_WALL_W],
  WORLD_BOWL_LEAVES: [() => WORLD_BOWL_LEAVES],
  WORLD_BOWL_SHADERS: [() => WORLD_BOWL_SHADERS],
  bowlHash: [() => bowlHash],
  bowlNoise: [() => bowlNoise, v => (bowlNoise = v)],
  bowlWallTexture: [() => bowlWallTexture, v => ((bowlWallTexture = v), provide({ bowlWallTexture }))],
  runPinColors: [() => runPinColors],
  worldBowl: [() => worldBowl],
  worldBowlAtlas: [() => worldBowlAtlas, v => (worldBowlAtlas = v)],
  worldBowlBridgeShape: [() => worldBowlBridgeShape, v => (worldBowlBridgeShape = v)],
  worldBowlCloudsNow: [() => worldBowlCloudsNow, v => (worldBowlCloudsNow = v)],
  worldBowlClumpsInto: [() => worldBowlClumpsInto, v => (worldBowlClumpsInto = v)],
  worldBowlColorAt: [() => worldBowlColorAt, v => (worldBowlColorAt = v)],
  worldBowlContextRestored: [
    () => worldBowlContextRestored,
    v => ((worldBowlContextRestored = v), provide({ worldBowlContextRestored })),
  ],
  worldBowlDot: [() => worldBowlDot, v => (worldBowlDot = v)],
  worldBowlDrawSky: [() => worldBowlDrawSky, v => (worldBowlDrawSky = v)],
  worldBowlDropGpu: [() => worldBowlDropGpu, v => (worldBowlDropGpu = v)],
  worldBowlFallNow: [() => worldBowlFallNow, v => (worldBowlFallNow = v)],
  worldBowlFallsMesh: [() => worldBowlFallsMesh, v => (worldBowlFallsMesh = v)],
  worldBowlFilm: [() => worldBowlFilm, v => (worldBowlFilm = v)],
  worldBowlFloatCam: [() => worldBowlFloatCam, v => (worldBowlFloatCam = v)],
  worldBowlFloatFrame: [() => worldBowlFloatFrame, v => (worldBowlFloatFrame = v)],
  worldBowlFloatGpu: [() => worldBowlFloatGpu, v => (worldBowlFloatGpu = v)],
  worldBowlFloatHome: [() => worldBowlFloatHome, v => (worldBowlFloatHome = v)],
  worldBowlFloatIsland: [() => worldBowlFloatIsland, v => (worldBowlFloatIsland = v)],
  worldBowlFloatLook: [() => worldBowlFloatLook, v => (worldBowlFloatLook = v)],
  worldBowlFloats: [() => worldBowlFloats, v => (worldBowlFloats = v)],
  worldBowlFlying: [() => worldBowlFlying],
  worldBowlGpu: [() => worldBowlGpu, v => (worldBowlGpu = v)],
  worldBowlHex: [() => worldBowlHex],
  worldBowlInst: [() => worldBowlInst, v => (worldBowlInst = v)],
  worldBowlIslandLift: [() => worldBowlIslandLift, v => (worldBowlIslandLift = v)],
  worldBowlIslandLoad: [() => worldBowlIslandLoad, v => (worldBowlIslandLoad = v)],
  worldBowlIslandPoly: [() => worldBowlIslandPoly, v => (worldBowlIslandPoly = v)],
  worldBowlIsleUniform: [() => worldBowlIsleUniform, v => (worldBowlIsleUniform = v)],
  worldBowlLeafLook: [() => worldBowlLeafLook, v => (worldBowlLeafLook = v)],
  worldBowlLightMatrix: [() => worldBowlLightMatrix, v => (worldBowlLightMatrix = v)],
  worldBowlLine: [() => worldBowlLine, v => (worldBowlLine = v)],
  worldBowlLineMap: [() => worldBowlLineMap, v => (worldBowlLineMap = v)],
  worldBowlLock: [() => worldBowlLock, v => (worldBowlLock = v)],
  worldBowlMapId: [() => worldBowlMapId, v => (worldBowlMapId = v)],
  worldBowlMapOf: [() => worldBowlMapOf, v => (worldBowlMapOf = v)],
  worldBowlMapSettingsKey: [() => worldBowlMapSettingsKey, v => (worldBowlMapSettingsKey = v)],
  worldBowlMesh: [() => worldBowlMesh, v => (worldBowlMesh = v)],
  worldBowlMistDraw: [() => worldBowlMistDraw, v => (worldBowlMistDraw = v)],
  worldBowlMixRgb: [() => worldBowlMixRgb],
  worldBowlModelInto: [() => worldBowlModelInto, v => (worldBowlModelInto = v)],
  worldBowlModelShape: [() => worldBowlModelShape, v => (worldBowlModelShape = v)],
  worldBowlOverlay: [() => worldBowlOverlay, v => (worldBowlOverlay = v)],
  worldBowlPick: [() => worldBowlPick, v => (worldBowlPick = v)],
  worldBowlPin: [() => worldBowlPin, v => (worldBowlPin = v)],
  worldBowlPuffMesh: [() => worldBowlPuffMesh, v => (worldBowlPuffMesh = v)],
  worldBowlReady: [() => worldBowlReady, v => (worldBowlReady = v)],
  worldBowlRender: [() => worldBowlRender, v => setWorldBowlRender(v)],
  worldBowlReset: [() => worldBowlReset, v => (worldBowlReset = v)],
  worldBowlRiversInto: [() => worldBowlRiversInto, v => (worldBowlRiversInto = v)],
  worldBowlRoadsInto: [() => worldBowlRoadsInto, v => (worldBowlRoadsInto = v)],
  worldBowlRunColors: [() => worldBowlRunColors, v => (worldBowlRunColors = v)],
  worldBowlRunMark: [() => worldBowlRunMark, v => (worldBowlRunMark = v)],
  worldBowlRunPin: [() => worldBowlRunPin, v => (worldBowlRunPin = v)],
  worldBowlShadowUniforms: [() => worldBowlShadowUniforms, v => (worldBowlShadowUniforms = v)],
  worldBowlShadows: [() => worldBowlShadows, v => (worldBowlShadows = v)],
  worldBowlSkyAt: [() => worldBowlSkyAt, v => (worldBowlSkyAt = v)],
  worldBowlSkyFloor: [() => worldBowlSkyFloor, v => (worldBowlSkyFloor = v)],
  worldBowlSkyGpu: [() => worldBowlSkyGpu, v => (worldBowlSkyGpu = v)],
  worldBowlSkyTick: [() => worldBowlSkyTick, v => (worldBowlSkyTick = v)],
  worldBowlSkyUniforms: [() => worldBowlSkyUniforms, v => (worldBowlSkyUniforms = v)],
  worldBowlSpots: [() => worldBowlSpots, v => (worldBowlSpots = v)],
  worldBowlStampMap: [() => worldBowlStampMap, v => (worldBowlStampMap = v)],
  worldBowlStampMaps: [() => worldBowlStampMaps, v => (worldBowlStampMaps = v)],
  worldBowlSunNow: [() => worldBowlSunNow, v => (worldBowlSunNow = v)],
  worldBowlTerrainGpu: [() => worldBowlTerrainGpu, v => (worldBowlTerrainGpu = v)],
  worldBowlTerrainKinds: [() => worldBowlTerrainKinds, v => (worldBowlTerrainKinds = v)],
  worldBowlTerrainPictures: [() => worldBowlTerrainPictures, v => (worldBowlTerrainPictures = v)],
  worldBowlTerrainStart: [() => worldBowlTerrainStart, v => (worldBowlTerrainStart = v)],
  worldBowlThingScale: [() => worldBowlThingScale, v => (worldBowlThingScale = v)],
  worldBowlThingsDraw: [() => worldBowlThingsDraw, v => (worldBowlThingsDraw = v)],
  worldBowlThingsOfPlace: [() => worldBowlThingsOfPlace, v => (worldBowlThingsOfPlace = v)],
  worldBowlThingsTick: [() => worldBowlThingsTick, v => (worldBowlThingsTick = v)],
  worldBowlTreeModelShape: [() => worldBowlTreeModelShape, v => (worldBowlTreeModelShape = v)],
  worldBowlTreeShape: [() => worldBowlTreeShape, v => (worldBowlTreeShape = v)],
  worldBowlWalkOnIsland: [() => worldBowlWalkOnIsland, v => (worldBowlWalkOnIsland = v)],
  worldBowlWaterMesh: [() => worldBowlWaterMesh, v => (worldBowlWaterMesh = v)],
  worldMap: [() => worldMap],
  worldMapAction: [() => worldMapAction, v => (worldMapAction = v)],
  worldMapBackToWalk: [() => worldMapBackToWalk, v => (worldMapBackToWalk = v)],
  worldMapBind: [() => worldMapBind, v => (worldMapBind = v)],
  worldMapCanvasGl: [() => worldMapCanvasGl, v => (worldMapCanvasGl = v)],
  worldMapChrome: [() => worldMapChrome, v => (worldMapChrome = v)],
  worldMapFade: [() => worldMapFade, v => (worldMapFade = v)],
  worldMapFallFrame: [() => worldMapFallFrame, v => (worldMapFallFrame = v)],
  worldMapFit: [() => worldMapFit, v => (worldMapFit = v)],
  worldMapHeight: [() => worldMapHeight, v => (worldMapHeight = v)],
  worldMapLocationListHTML: [() => worldMapLocationListHTML, v => (worldMapLocationListHTML = v)],
  worldMapLook: [() => worldMapLook, v => (worldMapLook = v)],
  worldMapLoop: [() => worldMapLoop, v => (worldMapLoop = v)],
  worldMapMount: [() => worldMapMount, v => setWorldMapMount(v)],
  worldMapOpenFromWalk: [() => worldMapOpenFromWalk, v => (worldMapOpenFromWalk = v)],
  worldMapPinState: [() => worldMapPinState, v => (worldMapPinState = v)],
  worldMapPrewarm: [() => worldMapPrewarm, v => ((worldMapPrewarm = v), provide({ worldMapPrewarm }))],
  worldMapReadyNow: [() => worldMapReadyNow, v => (worldMapReadyNow = v)],
  worldMapReset: [() => worldMapReset, v => (worldMapReset = v)],
  worldMapSelect: [() => worldMapSelect, v => (worldMapSelect = v)],
  worldMapSize: [() => worldMapSize, v => (worldMapSize = v)],
  worldMapSpot: [() => worldMapSpot, v => (worldMapSpot = v)],
  worldMapWanted: [() => worldMapWanted, v => (worldMapWanted = v)],
  worldMapWarm: [() => worldMapWarm],
  worldMapWidth: [() => worldMapWidth, v => (worldMapWidth = v)],
  worldMapZoom: [() => worldMapZoom, v => (worldMapZoom = v)],
});
/* eslint-enable no-func-assign */
provide({ bowlWallTexture, worldBowlContextRestored, worldMapPrewarm });
export function setWorldBowlRender(v) {
  worldBowlRender = v; // eslint-disable-line no-func-assign
  provide({ worldBowlRender });
}
export function setWorldMapMount(v) {
  worldMapMount = v; // eslint-disable-line no-func-assign
  provide({ worldMapMount });
}
/* to-module: end */
export let worldMapWidth = 176,
  worldMapHeight = 232;
/** the Map tab's canvas (2D, over the GPU's #dio) and whether it shows */
export const worldMap = { cv: null, ctx: null, dirty: true, gl: false, on: false, dpr: 1, list: false };

export const worldBowl = {
  on: false,
  /** the camera now, where it is easing to (null: nowhere), and a timed move (the zoom-out, Home) */
  cam: null,
  goal: null,
  tween: null,
  view: null,
  /** the place picked last, so a new pick (card, Places list) brings the camera over */
  sel: undefined,
  drag: null,
  pts: new Map(),
  lastT: 0,
  dirty: true,
  /** each place's spot seen from above, in node order (Pearlantis: Kelpport's, with under = 1), and the ground */
  spots: null,
  ground: null,
  /** frames drawn, and the last few draw times in ms and frame times (for the bowl map test) */
  frames: 0,
  /** frames drawn by worldBowlFilm (the opening's fall), counted apart from the map's own (the full test) */
  filmed: 0,
  ms: [],
  ts: [],
  /** the bowl map test: keep drawing every frame and turn by this many radians a second */
  bench: null,
  /* HB-3: the World map settings the floating island was made with (worldBowlMapSettingsKey) */
  mapSettings: null,
  /** where each pin is on screen, last drawn: { i, base, top, z } */
  marks: [],
};

/* the Inner Sun (owner chose A, 2026-10-19): off the centre, the light slanted from where it hangs (logic/bowl.js
   bowlSun); in GPU space its place and the way to it. Session 3 moves it with the time of day. */
const BOWL_SUN_NOW = bowlSun(),
  BOWL_SUN = bowlToGpu(...BOWL_SUN_NOW.at),
  BOWL_LIGHT = bowlToGpu(...BOWL_SUN_NOW.dir);
const BOWL_HAZE = [0.69, 0.73, 0.92];
const BOWL_PIN = 22; /* a pin's height on screen, in pixels */
const BOWL_SEA_FAR = [0.16, 0.42, 0.62]; /* the sea's colour far away (the walk scenes' far wall) */

/* the ground's scale: metres to the bowl's radius, squares across the terrain map, and the far-colours' size */
export const BOWL_METRES = 1000;
export const BOWL_INDEX = 2048;
const BOWL_MIX = 1024;
/* the routes' and rivers' line map: distance to the nearest route (red, up to BOWL_ROUTE_FIELD), whether a place's own
   ground is there (green: up close its own paths show instead), distance to the nearest river (blue) */
const BOWL_ROUTE_FIELD = 0.06;
const BOWL_RIVER_FIELD = 0.03;
const BOWL_SHADOW_SIZE = 2048;
/* the shadow lookup shared by the ground and the water: four taps of the hardware-filtered shadow map */
const BOWL_SHADOW_GLSL = `uniform sampler2DShadow uSh;uniform mat4 uSM;uniform float uShOn;
float bowlShadow(vec3 p,float nl){if(uShOn<.5)return 1.;vec4 s=uSM*vec4(p,1.);vec3 t=s.xyz*.5+.5;
 if(any(lessThan(t.xy,vec2(0.)))||any(greaterThan(t.xy,vec2(1.))))return 1.;float b=.0006+.0012*(1.-nl),k=1./${BOWL_SHADOW_SIZE.toFixed(1)};
 float r=texture(uSh,vec3(t.xy+vec2(-k,-k)*.75,t.z-b))+texture(uSh,vec3(t.xy+vec2(k,-k)*.75,t.z-b))+texture(uSh,vec3(t.xy+vec2(-k,k)*.75,t.z-b))+texture(uSh,vec3(t.xy+vec2(k,k)*.75,t.z-b));
 return r*.25;}`;
/* the sky's part of lighting, shared by the ground and the water (look session 3): the sun's strength and colour
   through the day (red and low at night), the ambient going dusk-blue, the clouds' moving shadows (up to 40 soft
   discs where each cloud's shadow falls along the light) and the weather map (cloud, rain, fog, snow) */
const BOWL_SKY_GLSL = `uniform float uLight,uNight,uFlash,uTodOn;uniform vec3 uSunTint,uAmbTint;uniform vec4 uCs[40];uniform int uCn;uniform sampler2D uSky;
vec3 bowlAmb(float ny){return mix(vec3(.4,.45,.56)+.16*ny,vec3(.1,.13,.27)+.05*ny,uNight*(1.-uTodOn))*uAmbTint+uFlash*.35;}
vec3 bowlSunCol(){return mix(vec3(1.,.94,.82)*.74,vec3(.5,.18,.1)*.5,uNight*(1.-uTodOn))*uLight*uSunTint;}
float bowlCloudShade(vec2 q){float s=1.;for(int i=0;i<40;i++){if(i>=uCn)break;vec4 c=uCs[i];float d=length(q-c.xy)/c.z;s*=1.-c.w*(1.-smoothstep(.55,1.,d));}return s;}
float bowlH(vec2 q){float r=min(1.,length(q));return ${Math.SQRT2.toFixed(6)}-sqrt(2.-r*r);}`;
/* water track WA-7: the walk's pixel water (walk-shaders.js PIXEL_WATER_GLSL: banded tones, an ordered dither fixed to
   the ground, stepped time) on the bowl. Its grid is the ground pictures' 16 texels a metre close up and coarser by
   powers of two further out, so a texel stays at least about two screen pixels (px: metres a screen pixel) and the
   dither never shimmers. bwK: a texel's size in metres; bwAt: the texel's middle; bwFix: a value that varies smoothly
   over the screen (its change along dFdx, dFdy) read at the texel's middle instead, so its edges step with the grid */
const BOWL_PIXEL_GLSL = `${PIXEL_WATER_GLSL}
float bwK(float px){return exp2(max(0.,ceil(log2(px*32.))))/16.;}
vec2 bwCell(vec2 m,float k){return floor(m/k);}
vec2 bwAt(vec2 m,float k){return (floor(m/k)+.5)*k;}
float bwFix(float v,vec2 m,vec2 ma){mat2 J=mat2(dFdx(m),dFdy(m));float dt=determinant(J);if(abs(dt)<1e-12)return v;
 vec2 g=inverse(transpose(J))*vec2(dFdx(v),dFdy(v));return v+dot(g,ma-m);}`;
export const WORLD_BOWL_SHADERS = {
  /* the sky: pale towards the rim line, the Inner Sun overhead (depth at the very back) */
  msky: [
    `#version 300 es
precision highp float;in vec2 aC;void main(){gl_Position=vec4(aC*2.-1.,.99999,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;uniform vec3 uC,uFw,uRt,uUp,uSun;uniform float uFoc,uR,uNight,uGrey;uniform vec2 uWH;
void main(){vec2 px=gl_FragCoord.xy/uR;vec3 d=normalize(uFw+uRt*(px.x-uWH.x*.5)/uFoc+uUp*(px.y-uWH.y*.5)/uFoc);
 float k=smoothstep(-.05,.7,d.y);vec3 c=mix(vec3(.98,.87,.72),vec3(.6,.71,.95),k);
 c=mix(c,mix(vec3(.75,.77,.8),vec3(.55,.6,.68),k),uGrey*.8);c=mix(c,mix(vec3(.16,.13,.25),vec3(.04,.06,.16),k),uNight);
 vec3 sd=normalize(uSun-uC);float a=max(0.,dot(d,sd));
 c+=mix(vec3(1.,.9,.6),vec3(.9,.3,.15),uNight)*(pow(a,900.)*mix(3.,1.4,uNight)+pow(a,40.)*.35*(1.-uGrey*.7));o=vec4(c,1.);}`,
  ],
  /* the ground: one low-poly mesh, lit facet by facet by the Inner Sun, painted with the walk scenes' terrain
     pictures (a square a metre, 16 px each, sharp) close up and their average colours far away */
  /* the ground: one low-poly mesh lit by the slanted sun, with the shadows it casts on itself (a shadow map made once,
     the ground never moves), painted with the walk scenes' terrain pictures (a square a metre, 16 px each, sharp)
     close up and their average colours far away; the routes and rivers drawn over it as lines that keep a few pixels
     wide at any zoom (look session 2: routes always clear) */
  mground: [
    `#version 300 es
precision highp float;in vec3 aPos;uniform mat4 uVP;out vec3 vW;void main(){vW=aPos;gl_Position=uVP*vec4(aPos,1.);}`,
    `#version 300 es
precision highp float;precision highp sampler2DArray;precision highp sampler2DShadow;in vec3 vW;out vec4 o;uniform sampler2D uIdx,uMix,uRoute;uniform sampler2DArray uLay;uniform vec3 uC,uLd,uHaze;uniform float uOn,uT;uniform vec2 uWaterL;uniform vec4 uIsle;
${BOWL_SHADOW_GLSL}
${BOWL_SKY_GLSL}
${BOWL_PIXEL_GLSL}
void main(){vec3 n=normalize(cross(dFdx(vW),dFdy(vW)));if(n.y<0.)n=-n;
 /* the floating island: only its land, nothing under the water's line (HB-3: but its lagoon's bed) or away from it */
 if(uIsle.w>.5){vec2 qi=vec2(vW.x,-vW.z);if((uIsle.w<1.5&&vW.y-bowlH(qi)<0.)||length(qi-uIsle.xy)>uIsle.z)discard;}
 vec2 q=vec2(vW.x,-vW.z),uv=vec2(q.x*.5+.5,.5-q.y*.5);vec3 far=uOn>.5?texture(uMix,uv).rgb:vec3(.5,.63,.38),c=far,near=far;
 vec2 m=q*${BOWL_METRES.toFixed(1)};float px=max(length(dFdx(m)),length(dFdy(m))),pb=px/${BOWL_METRES.toFixed(1)};
 if(uOn>.5&&px<4.){ivec2 ti=ivec2(clamp(uv*${BOWL_INDEX.toFixed(1)},vec2(0.),vec2(${(BOWL_INDEX - 1).toFixed(1)})));float L=floor(texelFetch(uIdx,ti,0).r*255.+.5);
  near=textureGrad(uLay,vec3(fract(m),L),dFdx(m),dFdy(m)).rgb;
  /* a place's own water and the rivers (fix 2026-10-19): drawn as water, not as a tile; foam where it meets land */
  if((abs(L-uWaterL.x)<.5||abs(L-uWaterL.y)<.5)&&uPixW.x>.5){
   /* WA-7, pixel water on: the shimmer in three tones on the bowl's grid, stepped; the foam a hard line one texel wide
      (a dithered second) along each side of the map's square that meets land */
   float kk=bwK(px);vec2 cl=bwCell(m,kk),ma=bwAt(m,kk);float tt=pwStep(uT),sv=.5+.5*sin(ma.x*.7+ma.y*.5+tt*1.3)*sin(ma.y*.9-ma.x*.3-tt*.9);
   near=(abs(L-uWaterL.y)<.5?vec3(.1,.45,.66):vec3(.26,.66,.74))*(.93+.07*(pwQ(sv,3.,cl)*2.-1.));
   vec2 qa=ma/${BOWL_METRES.toFixed(1)},fi=fract(vec2(qa.x*.5+.5,.5-qa.y*.5)*${BOWL_INDEX.toFixed(1)});float e=9.;
   for(int k=0;k<4;k++){ivec2 o=ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0);float Ln=floor(texelFetch(uIdx,clamp(ti+o,ivec2(0),ivec2(${BOWL_INDEX - 1})),0).r*255.+.5);
    if(!(abs(Ln-uWaterL.x)<.5||abs(Ln-uWaterL.y)<.5))e=min(e,k==0?1.-fi.x:k==1?fi.x:k==2?1.-fi.y:fi.y);}
   e*=${((2 * BOWL_METRES) / BOWL_INDEX).toFixed(4)};near=mix(near,vec3(.9,.95,.97),(e<kk?.8:e<2.*kk&&pwBayer(cl)>.5?.5:0.));}
  else if(abs(L-uWaterL.x)<.5||abs(L-uWaterL.y)<.5){near=abs(L-uWaterL.y)<.5?vec3(.1,.45,.66):vec3(.26,.66,.74);
   near*=.93+.07*sin(m.x*.7+m.y*.5+uT*1.3)*sin(m.y*.9-m.x*.3-uT*.9);
   float sh=0.;for(int k=0;k<4;k++){ivec2 o=ivec2(k==0?1:k==1?-1:0,k==2?1:k==3?-1:0);float Ln=floor(texelFetch(uIdx,clamp(ti+o,ivec2(0),ivec2(${BOWL_INDEX - 1})),0).r*255.+.5);sh+=(abs(Ln-uWaterL.x)<.5||abs(Ln-uWaterL.y)<.5)?0.:1.;}
   near=mix(near,vec3(.9,.95,.97),min(1.,sh)*.55);}
  c=mix(near,far,smoothstep(1.4,4.,px));}
 if(uOn>.5){vec3 rq=texture(uRoute,uv).rgb;float aa=pb*.75+1e-5;
  float rv=rq.b*${BOWL_RIVER_FIELD.toFixed(3)},rw=max(.0012,pb*.9);
  /* WA-7, pixel water on: the river's line with a hard edge, a paler middle in dithered tones on the bowl's grid */
  if(uPixW.x>.5){float tn=pwQ(clamp((1.-rv/rw)*1.6,0.,1.),3.,bwCell(m,bwK(px)));
   c=mix(c,mix(mix(vec3(.16,.4,.64),vec3(.3,.6,.8),tn),near,1.-smoothstep(1.,3.,px)),step(rv,rw)*smoothstep(.6,2.,px));}
  else c=mix(c,mix(vec3(.2,.47,.72),near,1.-smoothstep(1.,3.,px)),(1.-smoothstep(rw-aa,rw+aa,rv))*smoothstep(.6,2.,px));
  float rd=rq.r*${BOWL_ROUTE_FIELD.toFixed(3)},hw=max(.0018,pb*1.6),ow=hw+max(.0011,pb*1.1),vis=1.-rq.g*(1.-smoothstep(1.5,4.,px));
  vec3 rc=mix(vec3(.95,.87,.66),near*1.08,1.-smoothstep(1.,3.,px));
  c=mix(c,vec3(.22,.15,.1),(1.-smoothstep(ow-aa,ow+aa,rd))*vis*.85);c=mix(c,rc,(1.-smoothstep(hw-aa,hw+aa,rd))*vis);}
 vec4 wx=texture(uSky,uv);float rh=vW.y-bowlH(q);
 c=mix(c,vec3(.94,.96,1.),wx.a*smoothstep(.55,.9,n.y)*smoothstep(.0,.03,rh)*.6);
 float nl=max(0.,dot(n,uLd)),sh=bowlShadow(vW+n*.0015,nl)*bowlCloudShade(q);
 c*=bowlAmb(n.y)+bowlSunCol()*nl*sh*(1.-.4*max(0.,wx.r-.35)/.65);
 c=mix(c,mix(vec3(.82,.85,.88),vec3(.2,.22,.3),uNight),wx.b*(.22+.5*(1.-smoothstep(.0,.035,rh))));
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.6)),1.);}`,
  ],
  /* the clouds (look session 3): low-poly puffs, one instance each (centre and size, how much it shows and how dark),
     flat-faceted, lit by the sun from the side it faces, see-through as they build and fade, gone when the camera
     comes close */
  mcloud: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=4) in vec4 iC;layout(location=5) in vec4 iK;uniform mat4 uVP;out vec3 vN,vW;out vec2 vK;
void main(){vec3 p=iC.xyz+aPos*vec3(iC.w,iC.w*iK.z,iC.w);vW=p;vN=aNrm;vK=iK.xy;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec3 vN,vW;in vec2 vK;out vec4 o;uniform vec3 uC,uLd,uHaze;uniform float uLight,uNight,uFlash,uNear;
void main(){vec3 n=normalize(vN);float nl=max(0.,dot(n,uLd));
 vec3 c=mix(vec3(1.,.99,.97),vec3(.55,.58,.64),vK.y)*(mix(.72,.3,uNight)+.38*nl*uLight)+uFlash*vK.y*.8;
 c=mix(c,c*vec3(.75,.8,.95),.25*(1.-n.y));float d=length(vW-uC);
 float a=vK.x*smoothstep(uNear,uNear*2.5,d);if(a<.01)discard;float fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.5)),a);}`,
  ],
  /* rain, snow and ash under the clouds: short lines falling (kind: 0 rain, 1 snow, 2 ash) */
  mfall: [
    `#version 300 es
precision highp float;in vec3 aPos;layout(location=6) in float aKind;uniform mat4 uVP;out float vK;void main(){vK=aKind;gl_Position=uVP*vec4(aPos,1.);}`,
    `#version 300 es
precision highp float;in float vK;out vec4 o;uniform float uNight;
void main(){vec3 c=vK<.5?vec3(.72,.8,.92):vK<1.5?vec3(1.):vec3(.35,.32,.3);c*=1.-uNight*.6;o=vec4(c,vK<.5?.55:.85);}`,
  ],
  /* buildings and trees (look session 4): one low-poly shape per kind, drawn once per thing (instanced): where it
     stands (iP: GPU base and scale), the map's east and north on the bowl (iR), its group (0 clumps, always; 1 a
     map's own, close in) and when its windows light at night (iK). uShadowPass draws them into the shadow map. */
  mthing: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=2) in vec3 aCol;layout(location=8) in vec4 iP;layout(location=9) in vec4 iR;layout(location=10) in vec4 iK;
uniform mat4 uVP;uniform float uNear,uFlat;uniform vec3 uC;out vec3 vW,vN,vC,vL;out vec2 vK;
void main(){vec3 E=vec3(iR.x,0.,-iR.y),N=vec3(iR.z,0.,-iR.w);float k=iP.w*(iK.x>.5?mix(.3,1.,uNear):1.);
 vW=iP.xyz;vN=vec3(0.,1.,0.);vC=aCol;vL=aPos;vK=iK.xy;
 /* HB-3: past the World map's Simple trees past a tree's own model (iK.z 1) gives way to its simple shape (2) */
 if(iK.z>.5){bool far=uFlat>0.&&length(iP.xyz-uC)>uFlat;if(iK.z<1.5?far:!far){gl_Position=vec4(2.,2.,2.,1.);return;}}
 vec3 p=iP.xyz+(E*aPos.x+N*aPos.z)*k+vec3(0.,aPos.y*k,0.);vN=E*aNrm.x+N*aNrm.z+vec3(0.,aNrm.y,0.);vW=p;vC=aCol;vL=aPos;vK=iK.xy;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;precision highp sampler2DShadow;in vec3 vW,vN,vC,vL;in vec2 vK;out vec4 o;uniform vec3 uC,uLd,uHaze;uniform float uNear,uLit,uShadowPass;
${BOWL_SHADOW_GLSL}
${BOWL_SKY_GLSL}
float bayer4(vec2 p){ivec2 q=ivec2(mod(p,4.));int i=q.x+q.y*4;int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i])+.5)/16.;}
void main(){if(vK.x>.5&&uNear<bayer4(gl_FragCoord.xy))discard;if(uShadowPass>.5){o=vec4(1.);return;}
 /* each facet lit from the side we see (fix 2026-10-19: some shapes' normals pointed in, so trees came out black) */
 vec3 n=normalize(vN);if(dot(n,uC-vW)<0.)n=-n;float nl=max(0.,dot(n,uLd)),sh=bowlShadow(vW+n*.003,nl)*bowlCloudShade(vec2(vW.x,-vW.z));
 vec3 c=vC*(bowlAmb(n.y)*1.1+bowlSunCol()*nl*sh);
 if(vK.y>0.&&vK.y<uLit&&abs(n.y)<.5){float wy=step(.45,fract(vL.y/1.1)),wx=step(.5,fract((vL.x+vL.z)/1.25));c+=vec3(1.,.72,.38)*wy*wx*uNight*1.3;}
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.6)),1.);}`,
  ],
  /* pixel-art standees (owner: landmarks as their own pictures, upright): far out each place's landmark, kept at least
     a readable size on screen (uPx: world per pixel per unit of distance); close in the buildings and landmarks that
     have no model. They turn to face the camera round the upright. */
  mstandee: [
    `#version 300 es
precision highp float;in vec3 aPos;layout(location=7) in vec4 aQ;layout(location=8) in vec4 aT;layout(location=9) in float aG;
uniform mat4 uVP;uniform vec3 uRt,uC;uniform float uPx,uMinPx;out vec2 vUV;out float vG;out vec3 vW;
void main(){float hh=aQ.w,ww=aQ.z;if(aG<.5){float s=max(1.,uPx*length(aPos-uC)*uMinPx/hh);hh*=s;ww*=s;}
 vec3 r=normalize(vec3(uRt.x,0.,uRt.z));vec3 p=aPos+r*aQ.x*ww+vec3(0.,aQ.y*hh,0.);
 vUV=mix(aT.xy,aT.zw,vec2(aQ.x+.5,1.-aQ.y));vG=aG;vW=p;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;in vec2 vUV;in float vG;in vec3 vW;out vec4 o;uniform sampler2D uAtlas;uniform vec3 uC,uHaze;uniform float uFar,uNear,uLight,uNight;
float bayer4(vec2 p){ivec2 q=ivec2(mod(p,4.));int i=q.x+q.y*4;int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return (float(b[i])+.5)/16.;}
void main(){vec4 t=texture(uAtlas,vUV);if(t.a<.5)discard;float f=vG<.5?uFar:uNear;if(f<bayer4(gl_FragCoord.xy))discard;
 vec3 c=t.rgb*mix(.92,.3,uNight)*mix(.7,1.08,uLight);float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.5)),1.);}`,
  ],
  /* the shadow map: the ground seen from the sun, depth only */
  mshadow: [
    `#version 300 es
precision highp float;in vec3 aPos;uniform mat4 uSM;out vec3 vW;void main(){vW=aPos;gl_Position=uSM*vec4(aPos,1.);}`,
    `#version 300 es
precision highp float;in vec3 vW;uniform vec4 uIsle;out vec4 o;void main(){if(uIsle.w>.5&&length(vec2(vW.x,-vW.z)-uIsle.xy)>uIsle.z)discard;o=vec4(1.);}`,
  ],
  /* the floating island's rock (logic/float-island.js): flat-faced, painted with the walk scenes' rock and dirt
     pictures (a picture every 2 m, from the side each face looks), darker towards its point, the small rocks with a
     grassy top drifting up and down a little */
  mrock: [
    `#version 300 es
precision highp float;in vec3 aPos;in vec3 aNrm;layout(location=3) in vec2 aK;uniform mat4 uVP;uniform float uT;out vec3 vW,vN;out float vB;
void main(){vec3 p=aPos;if(aK.y>0.)p.y+=sin(uT*.45+aK.y*6.283)*.0015;vW=p;vN=aNrm;vB=aK.x;gl_Position=uVP*vec4(p,1.);}`,
    `#version 300 es
precision highp float;precision highp sampler2DArray;precision highp sampler2DShadow;in vec3 vW,vN;in float vB;out vec4 o;uniform sampler2DArray uLay;uniform vec3 uC,uLd,uHaze,uRockL;uniform float uOn;
${BOWL_SHADOW_GLSL}
${BOWL_SKY_GLSL}
void main(){vec3 n=normalize(vN);if(dot(n,uC-vW)<0.)n=-n;vec3 m=vW*${(BOWL_METRES / 2).toFixed(1)},an=abs(n);
 vec2 uv=an.y>max(an.x,an.z)?m.xz:an.x>an.z?m.zy:m.xy;
 float L=vB<-1.5?uRockL.z:vB<.14?uRockL.y:uRockL.x;
 vec3 base=vB<-1.5?vec3(.36,.55,.25):vB<.14?vec3(.5,.38,.26):vec3(.5,.46,.43);
 vec3 t=uOn>.5&&L>=0.?textureGrad(uLay,vec3(fract(uv),L),dFdx(uv),dFdy(uv)).rgb:base;
 t*=mix(1.,.74,clamp(vB,0.,1.))*(.93+.07*step(.5,fract(vW.y*${(BOWL_METRES / 4).toFixed(1)})));
 float nl=max(0.,dot(n,uLd));vec3 c=t*(bowlAmb(n.y)*1.05+bowlSunCol()*nl*.9);
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.6)),1.);}`,
  ],
  /* the floating island's sky (the hub's map): the time of day's colours all round, under the horizon too, a calm
     sea of clouds far below, the stars at night and the sun */
  mskyf: [
    `#version 300 es
precision highp float;in vec2 aC;void main(){gl_Position=vec4(aC*2.-1.,.99999,1.);}`,
    `#version 300 es
precision highp float;out vec4 o;uniform vec3 uC,uFw,uRt,uUp,uSun,uTop,uMid,uLow,uBelow,uCloud,uSunCol;uniform float uFoc,uR,uStars,uT,uY0;uniform vec2 uWH;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){return vn(p)*.55+vn(p*2.1+3.7)*.3+vn(p*4.3-1.3)*.15;}
void main(){vec2 px=gl_FragCoord.xy/uR;vec3 d=normalize(uFw+uRt*(px.x-uWH.x*.5)/uFoc+uUp*(px.y-uWH.y*.5)/uFoc);float y=d.y;
 vec3 c=y>0.?mix(mix(uLow,uMid,smoothstep(0.,.22,y)),uTop,smoothstep(.18,.85,y)):mix(uLow,uBelow,smoothstep(0.,-.3,y));
 if(y<-.005){float t=(uY0-uC.y)/y;vec2 q=(uC+d*t).xz*7.+vec2(uT*.006,uT*.002);float n=fbm(q);
  float cov=smoothstep(.52,.66,n)*exp(-t*.3)*smoothstep(-.005,-.08,y);c=mix(c,uCloud*mix(.86,1.04,smoothstep(.55,.8,n)),cov*.9);}
 if(uStars>.01&&y>0.){vec2 g=vec2(atan(d.z,d.x)*110.,y*150.),f=fract(g)-.5;float s=hs(floor(g));
  c+=vec3(.9,.92,1.)*uStars*step(.986,s)*smoothstep(.3,.05,length(f))*smoothstep(0.,.3,y);}
 vec3 sd=normalize(uSun-uC);float a=max(0.,dot(d,sd));c+=uSunCol*(pow(a,900.)*2.5+pow(a,40.)*.22);o=vec4(c,1.);}`,
  ],
};
provide({ WORLD_BOWL_SHADERS }); /* to-module */
/* HB-3: the falls off the floating island's rim (logic/float-island.js floatFallMesh): a sheet in the lagoon's
   tones, streaks running down it in columns, white water at the lip, thinning into mist as it falls to the clouds */
WORLD_BOWL_SHADERS.mfallw = [
  `#version 300 es
precision highp float;in vec3 aPos;layout(location=2) in vec2 aUV;uniform mat4 uVP;out vec3 vW;out vec2 vUV;
void main(){vW=aPos;vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`,
  `#version 300 es
precision highp float;in vec3 vW;in vec2 vUV;out vec4 o;uniform vec3 uC,uHaze,uRimCol;uniform float uT,uLight,uNight;
float hs(float x){return fract(sin(x*127.1)*43758.5453);}
void main(){float u=vUV.x,v=vUV.y,col=floor(u*14.),sp=.55+hs(col)*.5;
 float st=fract(v*(3.+hs(col+7.)*2.)-uT*sp+hs(col+3.)),streak=smoothstep(.55,.95,st)*(1.-smoothstep(.95,1.,st));
 vec3 c=mix(vec3(.33,.78,.8),vec3(.12,.5,.7),.35+.3*hs(col+11.));
 c=mix(c,vec3(.93,.97,1.),max(streak*.65,1.-smoothstep(0.,.08,v)));
 c=mix(c,uRimCol,smoothstep(.35,1.,v));
 c*=mix(.95,.32,uNight)*mix(.8,1.08,uLight);
 float edge=smoothstep(0.,.18,u)*smoothstep(1.,.82,u),a=edge*(1.-smoothstep(.45,1.,v))*(.78+.2*streak);
 if(a<.01)discard;float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(c,uHaze,clamp(fk,0.,.5)),a);}`,
];
/* the sea (look session 1, owner: water that looks like water): clear and pale in the shallows, deep blue further out,
   small waves moving over it, the sky in it at a glancing angle, the sun's glint, and foam where it meets the land */
WORLD_BOWL_SHADERS.mwater = [
  `#version 300 es
precision highp float;in vec3 aPos;in vec2 aShore;uniform mat4 uVP;out vec3 vW;out vec2 vS;void main(){vW=aPos;vS=aShore;gl_Position=uVP*vec4(aPos,1.);}`,
  `#version 300 es
precision highp float;precision highp sampler2DShadow;in vec3 vW;in vec2 vS;out vec4 o;uniform vec3 uC,uLd,uHaze,uRimCol;uniform float uT,uRim;
${BOWL_SHADOW_GLSL}
${BOWL_SKY_GLSL}
${BOWL_PIXEL_GLSL}
float wv(vec2 p,vec2 d,float f,float s,float t){return sin(dot(p,d)*f+t*s);}
/* WA-7, pixel water on: the same sea in banded tones on the bowl's grid (BOWL_PIXEL_GLSL); its waves, foam and glint
   read at each texel's middle in stepped time; the sky's mirror and its glancing mix stay smooth (the hybrid answer) */
void bowlWaterPixel(){vec2 q0=vec2(vW.x,-vW.z)*${BOWL_METRES.toFixed(1)};float t=pwStep(uT);
 float px=max(length(dFdx(q0)),length(dFdy(q0))),k=bwK(px);vec2 cl=bwCell(q0,k),q=bwAt(q0,k);
 vec3 up=normalize(vec3(0.,${Math.SQRT2.toFixed(6)},0.)-vW);float pk=max(px,k);vec2 g=vec2(0.);
 g+=vec2(.8,.6)*cos(dot(q,vec2(.8,.6))*.09+t*1.1)*.09*(1.-smoothstep(.2,.45,pk*.09/6.283));
 g+=vec2(-.5,.86)*cos(dot(q,vec2(-.5,.86))*.17+t*1.7)*.06*(1.-smoothstep(.2,.45,pk*.17/6.283));
 g+=vec2(.2,-.98)*cos(dot(q,vec2(.2,-.98))*.31+t*2.3)*.035*(1.-smoothstep(.2,.45,pk*.31/6.283));
 g+=vec2(-.94,-.34)*cos(dot(q,vec2(-.94,-.34))*.6+t*3.1)*.02*(1.-smoothstep(.2,.45,pk*.6/6.283));
 vec3 n=normalize(up+vec3(-g.x,0.,g.y)*.35);
 vec3 v=normalize(uC-vW),l=uLd;vec2 qb=vec2(vW.x,-vW.z);vec4 wx=texture(uSky,vec2(qb.x*.5+.5,.5-qb.y*.5));float sh=bowlShadow(vW+vec3(0.,.0015,0.),1.)*bowlCloudShade(qb);
 float dep=max(0.,bwFix(vS.x,q0,q));
 vec3 shallow=vec3(.33,.78,.78),mid=vec3(.1,.48,.68),deep=vec3(.04,.2,.42);
 float b=pwBand(.5*smoothstep(.0,.006,dep)+.5*smoothstep(.007,.024,dep),cl);
 vec3 col=b<.5?mix(shallow,mid,b*2.):mix(mid,deep,b*2.-1.);
 col*=(bowlAmb(1.)*1.4+bowlSunCol()*.4*pwQ(max(0.,dot(n,l)),4.,cl))*(.72+.28*sh);
 vec3 r=reflect(-v,n);float ry=dot(r,up);
 vec3 sky=mix(vec3(.98,.87,.72),vec3(.6,.71,.95),smoothstep(-.05,.7,ry));sky=mix(sky,vec3(.62,.66,.72),wx.r*.5);sky=mix(sky,vec3(.06,.08,.18),uNight);
 float fr=.04+.96*pow(1.-max(0.,dot(n,v)),5.);col=mix(col,sky,clamp(fr,0.,.85));
 float sp=step(.35,pow(max(0.,dot(reflect(-l,n),v)),120.))*(1.-smoothstep(2.,10.,px));col+=mix(vec3(1.,.95,.8),vec3(.9,.35,.2),uNight)*sp*.9*sh*uLight;
 col=mix(col,mix(vec3(.82,.85,.88),vec3(.2,.22,.3),uNight),wx.b*.35);
 /* the foam: stepped bands rolling in over the shallows and a hard line at the land, both in whole texels */
 float fb=1.-smoothstep(.0,.0035,dep),fw=.5+.5*sin(dep*2600.-t*2.2+wv(q,vec2(.6,.8),.4,0.,0.)*1.5);
 fw=mix(fw,.55,smoothstep(.3,1.5,pk));
 float foam=max(step(.5,fb*smoothstep(.35,.75,fw))*.9,step(dep,.0008)*.8);
 foam=max(foam,step(dep,.0016)*step(.5,pwBayer(cl))*.5);col=mix(col,vec3(.95,.98,1.),foam*.85);
 float a=mix(.45,.92,pwQ(smoothstep(.0,.006,dep),3.,cl));a=max(a,foam*.9);
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(col,uHaze,clamp(fk,0.,.6)),a);}
void main(){if(uPixW.x>.5){bowlWaterPixel();return;}
vec2 q=vec2(vW.x,-vW.z)*${BOWL_METRES.toFixed(1)};float t=uT;
 vec3 up=normalize(vec3(0.,${Math.SQRT2.toFixed(6)},0.)-vW);
 /* each wave fades out once it is smaller than about two pixels (fix 2026-10-19: from far away they made stripes) */
 float px=max(length(dFdx(q)),length(dFdy(q)));vec2 g=vec2(0.);
 g+=vec2(.8,.6)*cos(dot(q,vec2(.8,.6))*.09+t*1.1)*.09*(1.-smoothstep(.2,.45,px*.09/6.283));
 g+=vec2(-.5,.86)*cos(dot(q,vec2(-.5,.86))*.17+t*1.7)*.06*(1.-smoothstep(.2,.45,px*.17/6.283));
 g+=vec2(.2,-.98)*cos(dot(q,vec2(.2,-.98))*.31+t*2.3)*.035*(1.-smoothstep(.2,.45,px*.31/6.283));
 g+=vec2(-.94,-.34)*cos(dot(q,vec2(-.94,-.34))*.6+t*3.1)*.02*(1.-smoothstep(.2,.45,px*.6/6.283));
 vec3 n=normalize(up+vec3(-g.x,0.,g.y)*.35);
 vec3 v=normalize(uC-vW),l=uLd;vec2 qb=vec2(vW.x,-vW.z);vec4 wx=texture(uSky,vec2(qb.x*.5+.5,.5-qb.y*.5));float sh=bowlShadow(vW+vec3(0.,.0015,0.),1.)*bowlCloudShade(qb);
 /* HB-3, the floating island's lagoon (uRim): a few metres deep, so pale and clear; its
    foam stays by the beach and on the sill (fd), and vS.y is how far it has faded into the clouds at the rim */
 float dep=vS.x,fd=vS.x*(uRim>.5?3.:1.);
 vec3 shallow=vec3(.33,.78,.78),mid=vec3(.1,.48,.68),deep=vec3(.04,.2,.42);
 vec3 col=mix(shallow,mid,smoothstep(.0,.006,dep));col=mix(col,deep,smoothstep(.008,.032,dep));
 col*=(bowlAmb(1.)*1.4+bowlSunCol()*.4*max(0.,dot(n,l)))*(.72+.28*sh);
 vec3 r=reflect(-v,n);float ry=dot(r,up);
 vec3 sky=mix(vec3(.98,.87,.72),vec3(.6,.71,.95),smoothstep(-.05,.7,ry));sky=mix(sky,vec3(.62,.66,.72),wx.r*.5);sky=mix(sky,vec3(.06,.08,.18),uNight);
 float fr=.04+.96*pow(1.-max(0.,dot(n,v)),5.);col=mix(col,sky,clamp(fr,0.,.85));
 float sp=pow(max(0.,dot(reflect(-l,n),v)),120.)*(1.-smoothstep(2.,10.,px));col+=mix(vec3(1.,.95,.8),vec3(.9,.35,.2),uNight)*sp*.9*sh*uLight;
 col=mix(col,mix(vec3(.82,.85,.88),vec3(.2,.22,.3),uNight),wx.b*.35);
 float fb=1.-smoothstep(.0,.0035,fd),fw=.5+.5*sin(fd*2600.-t*2.2+wv(q,vec2(.6,.8),.4,0.,0.)*1.5);
 fw=mix(fw,.55,smoothstep(.3,1.5,px)); /* far away the foam bands blur into a steady edge */
 float foam=fb*smoothstep(.35,.75,fw)+(1.-smoothstep(0.,.0008,fd))*.8;col=mix(col,vec3(.95,.98,1.),clamp(foam,0.,1.)*.85);
 float a=mix(.45,.92,smoothstep(.0,.006,dep));a=max(a,clamp(foam,0.,1.)*.9);
 if(uRim>.5){float f=smoothstep(0.,1.,vS.y);col=mix(col,uRimCol,f);a=mix(a,.97,f);}
 float d=length(vW-uC),fk=1.-exp(-max(0.,d-.7)*.32);o=vec4(mix(col,uHaze,clamp(fk,0.,.6)),a);}`,
];

/* the Studio changed the look (worldmap.json, a landmark): work the ground, sky and things out again */
export function worldBowlReset() {
  worldBowl.spots = null;
  worldBowl.ground = null;
  if (worldBowl.wall) worldBowl.wall.node = -1;
  worldBowl.dirty = true;
}
/* phase 20 H: a restored GPU context is the same object with nothing on it, so every `x.gl === gl` check below would
   still pass: each part's GPU copy is dropped (the old ones went with the context) and made again on the next frame;
   the work behind them (spots, ground, terrain pictures, clouds) stays */
function worldBowlDropGpu() {
  const g = worldBowl.ground;
  if (g) {
    g.gl = null;
    g.mesh = null;
    g.water = null;
    g.shadow = null;
    g.lines = null;
    if (g.terrain) g.terrain.gl = null;
    const F = g.float;
    if (F) F.gpu = F.fineGpu = F.fallsGpu = F.waterGpu = null;
    const W = g.things;
    if (W) {
      W.gpu = null;
      if (W.atlas) W.atlas.gl = null;
      W.dirty = true;
    }
  }
  worldBowl.wall = null;
  const S = worldBowl.skyState;
  if (S) S.tex = S.gpu = null;
  worldBowl.dirty = true;
}
/* the context came back (engine/webgl.js watchContextLoss): with the map showing, its programs are made again on the
   new context (worldMapCanvasGl) and it draws again; else it is rebuilt when it next opens */
function worldBowlContextRestored() {
  worldBowlDropGpu();
  if (!worldBowl.on) return;
  if (!worldMapCanvasGl()) {
    if (typeof debugLog !== 'undefined') debugLog.add('webgl', 'world map: not back after the context was restored');
    return;
  }
  worldMapSize();
}
/* ---------- the places and the ground ---------- */
/* the world map's look from worldmap.json (the Studio edits it), each part falling back to the values in code */
function worldMapLook() {
  /* RL-8b: a run's own look (logic/run-bowl.js, put in with its world) stands in for worldmap.json's */
  const W = worldExtra.look || (gameData && gameData.worldmap) || {},
    regions = {};
  for (const r of new Set([...Object.keys(BOWL_REGION_GROUND), ...Object.keys(W.regions || {})])) {
    const R = (W.regions || {})[r],
      sh = BOWL_REGION_SHADE[r] || BOWL_REGION_SHADE.starter;
    regions[r] = R || {
      ground: BOWL_REGION_GROUND[r] || BOWL_REGION_GROUND.starter,
      wet: sh[0],
      dry: sh[1],
      high: sh[2],
      trees: BOWL_REGION_TREES[r] || BOWL_REGION_TREES.starter,
    };
  }
  /* RL-8b: seed moves the hills, ground patches, trees and clouds (0 as made; a run's own from its seed) */
  return {
    sea: W.sea || null,
    relief: W.relief || null,
    regions,
    kinds: W.kinds || BOWL_KIND_GROUND,
    seed: W.seed || 0,
  };
}
/* IS-7: the walk map the bowl draws for place i: its own, or for the hub the map holding its island
   (logic/bowl-island.js bowlIslandMapId, by its fields); its id, and the map itself */
function worldBowlMapId(i) {
  return bowlIslandMapId(LOCATIONS, i, (gameData && gameData.maps) || {});
}
function worldBowlMapOf(i) {
  const id = worldBowlMapId(i);
  return (id && gameData.maps && gameData.maps[id]) || null;
}
/* IS-7: an island map still lite (its outline only) is fetched once; when it is in, the ground is worked out again
   with its heights */
function worldBowlIslandLoad(i) {
  const id = worldBowlMapId(i),
    M = id && gameData.maps && gameData.maps[id];
  if (!M || !bowlHasCoast(M) || bowlIslandHeights(M) || worldBowl.islandLoading === id) return;
  if (typeof isLiteMap !== 'function' || !isLiteMap(id)) return;
  worldBowl.islandLoading = id;
  loadMapFile(id)
    .catch(() => {})
    .then(() => {
      if (bowlIslandHeights(gameData.maps[id])) worldBowlReset();
    });
}
/* the owner, 2026-10-23: the hub's world map is Copperleaf's island floating in open sky (no bowl, no sea round it);
   a run's world keeps the bowl */
export function worldBowlFloats() {
  const g = worldBowl.ground;
  return !!(g && g.islandMap && !worldExtra.look);
}
/* the floating island's coast on the bowl (flat x, y pairs), from the sea's input (its map's own coast) */
function worldBowlIslandPoly() {
  const g = worldBowl.ground,
    P = g && g.sea && g.sea.places.find(q => q && q.poly);
  return P ? P.poly : null;
}
/* the floating island: its rock and small rocks (logic/float-island.js), its middle, radius and the camera's pivot */
function worldBowlFloatIsland() {
  const g = worldBowl.ground;
  if (!worldBowlFloats()) return null;
  if (g.float) return g.float;
  const i = LOCATIONS.findIndex((l, k) => worldBowlMapId(k) === g.islandMap),
    s = worldBowl.spots[i],
    M = gameData.maps[g.islandMap];
  if (!s || !M || !M.island || !M.island.coast) return null;
  const coast = M.island.coast.map(([x, z]) => bowlMapPoint(s, M, x, z, BOWL_METRES)),
    poly = Float64Array.from(coast.flat()),
    /* HB-3: a shallow lagoon round it (the owner: about 1.3 times its radius), the rock under the lagoon's ring */
    lag = engineSetting('worldMap', 'lagoon') ? floatLagoonRing(poly) : null,
    rim = lag ? Array.from({ length: lag.ring.length / 2 }, (_, k) => [lag.ring[k * 2], lag.ring[k * 2 + 1]]) : null,
    F = floatIslandMesh(rim || coast, 0, {
      lift: bowlWaterLevel,
      seed: 1,
      capDrop: lag ? (FLOAT_LAGOON.depth * 1.6) / BOWL_METRES : undefined,
    }),
    top = bowlWaterLevel(F.c[0], F.c[1]),
    /* the camera keeps to the island itself, not its lagoon */
    r = lag ? lag.r : F.r;
  /* the pivot a little under the land, so the island sits in the screen's upper part, over the place's card */
  /* its ground, finer than the bowl's grid (the owner: "less low poly"), once its own heights are in; with the
     lagoon the land meets the water at the beach (no step up) and the bed runs out under the water to the ring */
  const P = g.sea && g.sea.places.find(q => q && q.poly && q.hAt),
    bedAt = lag
      ? (x, y) => bowlWaterLevel(x, y) - floatLagoonDepth(floatLagoonAt(poly, lag.ring, x, y).t) / BOWL_METRES
      : undefined,
    fine = P
      ? floatGroundMesh(
          P.poly,
          lag
            ? (x, y) => bowlBaseHeight(x, y) + Math.max(0.1 / BOWL_METRES, P.hAt(x, y))
            : (x, y) => bowlBaseHeight(x, y) + BOWL_ISLAND_BASE + Math.max(0, P.hAt(x, y)),
          bowlWaterLevel,
          FLOAT_ISLAND.cell / BOWL_METRES,
          lag ? { ring: lag.ring, bedAt } : {}
        )
      : null,
    water =
      fine && lag
        ? floatLagoonWater(fine, lag.ring, bowlWaterLevel, lag.r * FLOAT_LAGOON.out * FLOAT_LAGOON.fade)
        : null;
  g.float = {
    ...F,
    r,
    lr: F.r,
    i,
    top,
    th: top - r * 0.7,
    y0: top - F.depth * 2.2,
    gpu: null,
    fine,
    fineGpu: null,
    lagoon: lag,
    water,
    waterGpu: null,
    /* the falls off its rim, where the rim comes nearest the coast (the owner: three, silent) */
    falls: lag ? worldBowlFallsMesh(lag, poly, F.depth) : null,
    fallsGpu: null,
    /* the mist along its rim: the lagoon fading into the clouds (drawn with the clouds' puffs) */
    mist: lag
      ? floatMistPuffs(lag.ring, lag.c, lag.r, { seed: 1 }).map(q => ({
          g: bowlToGpu(q.x, q.y, bowlWaterLevel(q.x, q.y) + q.h),
          s: q.s,
        }))
      : null,
  };
  return g.float;
}
/* the ground's and the shadows' cut (uIsle): the floating island's middle and how far out its ground is drawn; mode 1
   its land alone (nothing under the water's line), 2 with its lagoon (the bed under the water drawn too) */
function worldBowlIsleUniform(U, F) {
  if (!F) gpuState.gl.uniform4f(U.uIsle, 0, 0, 0, 0);
  else gpuState.gl.uniform4f(U.uIsle, F.c[0], F.c[1], F.lagoon ? F.lr * 1.15 : F.r * 1.25, F.lagoon ? 2 : 1);
}
/* the World map settings the floating island is built with (the simple trees' distance only says whether they exist) */
function worldBowlMapSettingsKey() {
  const e = k => engineSetting('worldMap', k);
  return [e('lagoon'), e('falls'), e('treeModels'), (e('treeFar') || 0) > 0, e('fences'), e('bridges')].join();
}
/* HB-3: the falls off the lagoon's rim as one mesh: per corner its place (GPU) and (across, down) */
function worldBowlFallsMesh(lag, coast, depth) {
  const n = Math.max(0, Math.round(engineSetting('worldMap', 'falls') ?? FLOAT_LAGOON.falls)),
    spots = n ? floatFallSpots(lag.ring, coast, n) : [];
  if (!spots.length) return null;
  const parts = spots.map(f => floatFallMesh(f, bowlWaterLevel(f.x, f.y), lag.r * 0.09, depth * 0.85)),
    V = new Float32Array(parts.reduce((a, m) => a + m.V.length, 0)),
    I = new Uint32Array(parts.reduce((a, m) => a + m.I.length, 0));
  let v = 0,
    i = 0;
  for (const m of parts) {
    V.set(m.V, v);
    for (let k = 0; k < m.I.length; k++) I[i + k] = m.I[k] + v / 5;
    v += m.V.length;
    i += m.I.length;
  }
  return { V, I, n: spots.length, spots };
}
/* the camera's limits: the floating island's orbit, or the bowl's */
function worldBowlFloatCam() {
  const F = worldBowlFloatIsland();
  bowlCamUseFloat(F ? worldBowlFloatFrame(F) : null);
  return F;
}
/* you on the floating island's map, in its own metres, or null when the walk is elsewhere. HB-1: the hub's walk view
   is 'w:<map>*' (seamless-world.js seamlessHubMap), never the bare map id, so this was never found; a view joined
   to other scenes may be offset from the map's own metres: not read */
function worldBowlWalkOnIsland() {
  const id = worldBowl.ground && worldBowl.ground.islandMap,
    v = walkView;
  if (!id || !v || !v.pl || !v.sc) return null;
  if (v.id === id) return v.pl;
  return v.id === 'w:' + id + '*' && !(v.sc.scenes && v.sc.scenes.length) ? v.pl : null;
}
/* the floating island's opening view: from where you stand on it, looking across to its middle (the walk's orbit
   camera, logic/camera-orbit.js), else from the south */
function worldBowlFloatHome(F, yaw) {
  const M = gameData.maps[worldBowl.ground.islandMap],
    s = worldBowl.spots[F.i],
    pl = worldBowlWalkOnIsland();
  if (pl && M && s) {
    const [x, y] = bowlMapPoint(s, M, pl.x, pl.z, BOWL_METRES);
    if (Math.hypot(x - F.c[0], y - F.c[1]) > F.r * 0.1) yaw = orbitYawAt(F.c, x, y);
  }
  return bowlCamHomeFloat(worldBowlFloatFrame(F), yaw ?? 0);
}
/* the orbit's frame round the floating island: its middle, radius and pivot height. HB-3: with its lagoon round it the
   orbit stands a little further back, so the ring fits a phone's width */
export function worldBowlFloatFrame(F) {
  return { c: F.c, r: F.lagoon ? F.r * 1.25 : F.r, th: F.th };
}
/* the floating island's rock on the GPU: position, normal, band and drift per corner */
function worldBowlFloatGpu(F) {
  const gl = gpuState.gl;
  if (F.gpu && F.gpu.gl === gl) return F.gpu;
  const vao = gl.createVertexArray(),
    vb = gl.createBuffer(),
    B = FLOAT_STRIDE * 4;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, F.data, gl.STATIC_DRAW);
  for (const [loc, size, off] of [
    [0, 3, 0],
    [1, 3, 12],
    [3, 2, 24],
  ]) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, B, off);
  }
  gl.bindVertexArray(null);
  F.gpu = { gl, vao, n: F.data.length / FLOAT_STRIDE };
  return F.gpu;
}
/* the floating island's light and sky from the time of day (logic/time-of-day.js, the five looks the walk scenes use)
   over the island map's own sky and haze, greyed by the weather; worked out again once a second */
const worldBowlHex = h => {
  if (!h) return [0.5, 0.5, 0.5];
  const n = parseInt(String(h).slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const worldBowlMixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function worldBowlFloatLook(S) {
  const now = performance.now();
  if (S.flook && now - S.flook.at < 1000) return S.flook;
  const M = gameData.maps[worldBowl.ground.islandMap] || {},
    { L, night } = environmentLookAt(M),
    /* the island map's own sky (else a clear day's: blue above, pale at the horizon) */
    base =
      Array.isArray(M.sky) && M.sky.length === 3
        ? M.sky.map(worldBowlHex)
        : [
            [0.56, 0.77, 0.91],
            [0.78, 0.89, 0.93],
            [0.96, 0.9, 0.78],
          ],
    grey = (S.greyHere || 0) * 0.7,
    dim = 0.3 + 0.7 * Math.min(1, L.sun),
    sky = [L.skyTop, L.skyMid, L.skyLow].map((c, i) => {
      const v = c ? worldBowlMixRgb(base[i], c, L.skyMix) : base[i];
      return worldBowlMixRgb(
        v,
        [0.62, 0.66, 0.72].map(x => x * dim),
        grey
      );
    }),
    hz = M.haze ? worldBowlHex(M.haze) : [0.93, 0.87, 0.77],
    sunTint = (L.sunColor || [1, 1, 1]).map(v => v * L.sun * (1 - 0.4 * night) * (1 - grey * 0.45)),
    ambTint = (L.ambientColor || [1, 1, 1]).map(v => v * L.ambient * (1 - 0.3 * night)),
    lum = Math.min(1, (sunTint[0] + sunTint[1] + sunTint[2]) / 3);
  S.flook = {
    at: now,
    sky,
    haze: L.haze ? worldBowlMixRgb(hz, L.haze, L.hazeMix) : hz,
    below: worldBowlMixRgb(sky[1], sky[0], 0.85).map(v => v * 0.94),
    cloud: worldBowlMixRgb([1, 1, 1], sky[2], 0.2).map(v => v * (0.3 + 0.7 * lum)),
    sunTint,
    ambTint,
    stars: L.stars || 0,
    night,
  };
  return S.flook;
}
/* where a place is on the bowl: x, y seen from above and the ground's height there */
export function worldMapSpot(i) {
  return worldBowlSpots()[i] || { x: 0, y: 0, h: 0, under: 0 };
}
/* ---------- the ground's terrain (owner, 2026-10-19: high resolution, real terrain) ----------
   The ground is painted with the walk scenes' own terrain pictures (scenery.json terrains, 16 px a square), on a map of
   which terrain lies where: one square of it about a metre (BOWL_METRES to the bowl's radius). Each place's own walk
   map is laid on it square by square, turned the way it sits on the bowl (its north to the centre), as soon as its map
   file is in; between places each region's own grounds in patches with a pixel-art dither, water in the dips, snow on
   the highest tops, and paths along the roads. From far away, where a square is smaller than a pixel, each terrain's
   average colour stands in (BOWL_MIX texture) so the ground doesn't shimmer. */
/* each region's grounds between places (from what its walk maps are made of), and some kinds' own around them */
const BOWL_REGION_GROUND = {
  starter: 'gGlCtg',
  meadowlands: 'gEERCg',
  goldenhills: 'BAB4gB',
  sporeforest: 'JyLMJy',
  crystalcaverns: 'krXvkr',
  coraltrench: 'N3N2gN',
  cloudspire: 'UgUvtU',
  innersun: 'YWYBYW',
};
/* the land between places by height and wetness (look session 2): each region's wet lowland, dry slopes and high
   ground; cliffs and steep slopes are rock, the highest tops snow */
const BOWL_REGION_SHADE = {
  starter: ['RlG', 'BH', 'rv'],
  meadowlands: ['RGE', 'HB', 'rv'],
  goldenhills: ['gGl', 'AB', 'Wr'],
  sporeforest: ['DMR', 'Ly', 'rM'],
  crystalcaverns: ['kM', 'rv', 'Xr'],
  coraltrench: ['SR', 'sP', 'r'],
  cloudspire: ['UV', 'Vv', 'Vn'],
  innersun: ['Y', 'AZ', 'jz'],
};
const BOWL_KIND_GROUND = {
  sea: 'dwdS',
  pond: 'wwgR',
  lake: 'wdwl',
  island: 'sSws',
  volcano: 'zjzZ',
  canyon: 'srsP',
  summit: 'nnIr',
  pass: 'rnrv',
  ridge: 'rgHr',
  trench: 'dd3N',
  thicket: 'yLyM',
  farm: 'oGol',
  golf: 'lGlg',
  bins: 'xvxu',
  grotto: 'krkM',
};
/* HB-3: how much higher than they are an island map's heights are drawn: real height on the hub's floating island
   (its buildings and trees are life size), BOWL_ISLAND_LIFT on a run's bowl (worldExtra.look, as worldBowlFloats) */
export function worldBowlIslandLift() {
  return worldExtra.look ? BOWL_ISLAND_LIFT : 1;
}
function worldBowlSpots() {
  if (worldBowl.spots) return worldBowl.spots;
  /* the sea (look session 1): every place's walk map and every road on land, the rest of the line drawn so about 40%
     of the bowl is water */
  const look = worldMapLook(),
    t0 = performance.now(),
    sea = bowlSeaInput(
      LOCATIONS,
      ROADS.map(r => [r[0], r[1]]),
      l => worldBowlMapOf(LOCATIONS.indexOf(l)),
      BOWL_METRES,
      look.sea,
      /* IS-7: an island map's own heights, once its file is in */
      l => {
        const M = worldBowlMapOf(LOCATIONS.indexOf(l));
        return bowlHasCoast(M) ? bowlIslandHeights(M) : null;
      },
      worldBowlIslandLift()
    ),
    F = bowlReliefFeatures(LOCATIONS, look.relief, look.seed),
    G = bowlGroundGrid(F, undefined, sea);
  bowlCamUseGround(G);
  const byId = id => LOCATION_BY_ID[id];
  /* not for a place off this world's map (the hub during a run) */
  LOCATIONS.forEach((l, i) => {
    const s = bowlSpotOf(l, byId);
    if (!s.off && !s.under) worldBowlIslandLoad(i);
  });
  worldBowl.spots = LOCATIONS.map(l => {
    const s = bowlSpotOf(l, byId),
      [x, y] = bowlXY(s.a, s.r);
    /* RL-8b: off, not on this world's map (Copperleaf during a run): no ground, pin, things or weather of its own */
    return { x, y, under: s.under, up: s.up, off: !!s.off, h: bowlGridHeight(G, x, y) };
  });
  worldBowl.ground = {
    F,
    G,
    mesh: null,
    water: null,
    terrain: null,
    seaMs: Math.round(performance.now() - t0),
    /* the sea's input: the floating island's coast and its own heights (worldBowlFloatIsland) */
    sea,
    /* RL-8b: an island world (the hub's island, a run's own land): sea to the rim, few rivers */
    isle: !!bowlIsles(sea),
    /* IS-7: the island map drawn from its own coast and ground (its streams are its own: no rivers made on it) */
    islandMap:
      (sea.places.some(p => p.poly) &&
        LOCATIONS.map((l, i) => worldBowlMapId(i)).find(id => bowlHasCoast(gameData.maps[id]))) ||
      null,
  };
  return worldBowl.spots;
}
/* the terrain kinds: their keys in a fixed order (a layer each), their pictures' pixels and average colours */
function worldBowlTerrainKinds() {
  const T = (gameData.scenery && gameData.scenery.terrains) || {},
    keys = Object.keys(T);
  return { T, keys, layer: Object.fromEntries(keys.map((k, n) => [k, n])) };
}
/* a hash in 0-1 for a square, and a smooth value noise (patches of ground) */
const bowlHash = (i, j) => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function bowlNoise(x, y) {
  const i = Math.floor(x),
    j = Math.floor(y),
    u = x - i,
    v = y - j,
    a = bowlHash(i, j),
    b = bowlHash(i + 1, j),
    c = bowlHash(i, j + 1),
    d = bowlHash(i + 1, j + 1),
    su = u * u * (3 - 2 * u),
    sv = v * v * (3 - 2 * v);
  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}
const BOWL_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
/* the terrain between places, worked out in rows a frame at a time (the map shows its colours meanwhile) */
function worldBowlTerrainStart() {
  const g = worldBowl.ground;
  if (g.terrain) return g.terrain;
  const K = worldBowlTerrainKinds(),
    N = BOWL_INDEX,
    idx = new Uint8Array(N * N),
    S = worldBowl.spots,
    /* the nearest place on a coarse grid, for each region's and kind's ground */
    C = 256,
    near = new Uint8Array(C * C),
    own = [];
  S.forEach((s, i) => !s.under && !s.off && own.push(i));
  for (let j = 0; j < C; j++)
    for (let i = 0; i < C; i++) {
      const x = -1 + ((i + 0.5) / C) * 2,
        y = 1 - ((j + 0.5) / C) * 2;
      let best = 0,
        bd = 9;
      for (const k of own) {
        const d = (x - S[k].x) ** 2 + (y - S[k].y) ** 2;
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      near[j * C + i] = best;
    }
  const look = worldMapLook(),
    lists = LOCATIONS.map(l => {
      const R = look.regions[l.region] || look.regions.starter,
        r = R.ground.split(''),
        k = (look.kinds[l.t] || '').split('');
      const sh = [R.wet, R.dry, R.high],
        keys = (/** @type {string} */ str) =>
          str
            .split('')
            .filter(c => c in K.layer)
            .map(c => K.layer[c]);
      return { r: keys(r.join('')), k: keys(k.join('')), wet: keys(sh[0]), dry: keys(sh[1]), high: keys(sh[2]) };
    });
  /* how steep the ground is at each of the grid's corners (rise over run, above the water's curve) */
  const G = g.G,
    gw = G.n + 1,
    step = (2 * G.e) / G.n,
    relAt = (/** @type {number} */ k) => {
      const x = -G.e + (k % gw) * step,
        y = -G.e + Math.floor(k / gw) * step;
      return G.h[k] - bowlHeight(Math.min(1, Math.hypot(x, y)));
    },
    slope = new Float32Array(gw * gw);
  for (let k = gw + 1; k < gw * gw - gw - 1; k++)
    slope[k] = Math.hypot(relAt(k + 1) - relAt(k - 1), relAt(k + gw) - relAt(k - gw)) / (2 * step);
  const slopeG = { n: G.n, e: G.e, h: slope };
  const L = K.layer;
  /* RL-8b: a world's seed moves the ground's patches (bowlSeedShift, in squares of 9 m) */
  const [ox, oy] = bowlSeedShift(g.F.seed || 0);
  g.terrain = {
    K,
    idx,
    near,
    lists,
    row: 0,
    ready: false,
    stamped: new Set(),
    dirty: true,
    gl: null,
    ox: ox * 37,
    oy: oy * 37,
  };
  /* the floating island: only the squares round it are ever seen, so only they are worked out */
  const FI = worldBowlFloatIsland(),
    far = FI ? Math.max(FI.r * 1.4, FI.lr * 1.25) : 0,
    band = FI
      ? [FI.c[0] - far, FI.c[0] + far, FI.c[1] - far, FI.c[1] + far].map((v, k) =>
          Math.max(0, Math.min(N, Math.floor(((k < 2 ? v + 1 : 1 - v) / 2) * N) + (k % 2 ? 1 : 0)))
        )
      : null;
  if (band) {
    g.terrain.row = Math.min(band[2], band[3]);
    g.terrain.rowEnd = Math.max(band[2], band[3]) + 1;
    g.terrain.row0 = g.terrain.row;
    g.terrain.i0 = band[0];
    g.terrain.i1 = band[1];
  }
  g.terrain.fill = rows => {
    const T = g.terrain,
      last = Math.min(N, T.rowEnd ?? N),
      end = Math.min(last, T.row + rows);
    for (let j = T.row; j < end; j++)
      for (let i = T.i0 ?? 0; i < Math.min(N, T.i1 ?? N); i++) {
        const x = -1 + ((i + 0.5) / N) * 2,
          y = 1 - ((j + 0.5) / N) * 2,
          r = Math.hypot(x, y);
        if (r > 1.01) continue;
        /* the place this square belongs to: borders wander (a slow warp) and are dithered, so regions blend over a few
           squares in a pixel-art way, never along a straight line */
        const wx = (bowlNoise(x * 6 + 3.1, y * 6) - 0.5) * 7,
          wy = (bowlNoise(x * 6, y * 6 - 5.7) - 0.5) * 7,
          ci = Math.min(C - 1, Math.max(0, Math.floor(((x + 1) / 2) * C + wx + (bowlHash(i, j) - 0.5) * 3))),
          cj = Math.min(C - 1, Math.max(0, Math.floor(((1 - y) / 2) * C + wy + (bowlHash(j, i) - 0.5) * 3))),
          p = T.near[cj * C + ci],
          s = S[p],
          ls = T.lists[p],
          d = Math.hypot(x - s.x, y - s.y),
          rel = bowlGridHeight(g.G, x, y) - bowlHeight(Math.min(1, r)) /* the relief, read from the grid: cheap */,
          m = (x * BOWL_METRES) / 9 + T.ox,
          n = (y * BOWL_METRES) / 9 + T.oy,
          th = BOWL_BAYER[(j & 3) * 4 + (i & 3)],
          /* calm ground (fix 2026-10-19: it read as camouflage): mostly a list's first ground, the others in broad
             patches some 40 m across, their edges dithered over a few squares; no outline rings */
          patch = bowlNoise(m * 0.22 + p * 1.7, n * 0.22) * 0.75 + bowlNoise(m * 0.6, n * 0.6 + 9.1) * 0.25,
          pick = list =>
            list.length < 2 || patch < 0.58 + (th - 0.5) * 0.05
              ? list[0]
              : list[
                  1 + Math.min(list.length - 2, Math.floor(bowlNoise(m * 0.1 + 4.4, n * 0.1 + p) * (list.length - 1)))
                ];
        let t = ls.k.length && d < 0.09 + bowlNoise(m * 0.3, n * 0.3) * 0.04 ? pick(ls.k) : pick(ls.r);
        /* away from the places' own ground: wet lowland, dry slopes, high ground, rock on the steep, snow on top */
        /* read smoothly between the grid's corners (not the nearest corner: that made blocks), changes dithered */
        const wet = G.wet ? bowlWetAt(G, x, y) : 0,
          steep = bowlGridHeight(slopeG, x, y),
          inPlace = d < 0.07,
          dz = (th - 0.5) * 0.12;
        if (!inPlace) {
          if (wet > 0.55 + dz && rel < 0.03 && ls.wet.length) t = pick(ls.wet);
          else if (wet < 0.08 + dz * 0.3 && rel > 0.014 && ls.dry.length) t = pick(ls.dry);
          if (rel > 0.048 + dz * 0.05 && ls.high.length) t = pick(ls.high);
        }
        if (steep > 1.6 + dz * 3) t = L.r ?? t;
        if (rel > 0.088 + dz * 0.05 && 'n' in L) t = L.n;
        /* the coast: a beach of dry then wet sand down to the water, and under it the sea floor (sand in the shallows,
           pebbles and rock further out, coral sand in the coral regions) */
        const cv = bowlCoastAt(g.G, x, y);
        if (cv > -0.012 + th * 0.004) {
          const coral = ls.r.includes(L.N);
          if (cv <= 0 && rel > 0.01) t = L.r ?? t; /* a cliff, no beach */
          else if (cv <= -0.004) t = L.s ?? t;
          else if (cv <= 0.006 + th * 0.004) t = L.S ?? t;
          else if (cv <= 0.03 + th * 0.01) t = (coral ? L.N : L.s) ?? t;
          else t = (bowlNoise(m * 0.2, n * 0.2) > 0.55 ? L.r : L.P) ?? t;
        }
        if (r > 0.985 && cv <= 0) t = L.r ?? t;
        T.idx[j * N + i] = t;
      }
    T.row = end;
    T.dirty = true;
    if (T.row >= last) {
      worldBowlRiversInto(T);
      worldBowlRoadsInto(T);
      T.ready = true;
    }
  };
  return g.terrain;
}
/* the rivers: water a few squares wide (wider and deeper as rivers join), muddy or sandy banks; the roads go over them
   afterwards, as fords and bridges */
function worldBowlRiversInto(T) {
  const G = worldBowl.ground.G,
    N = BOWL_INDEX,
    L = T.K.layer;
  if (!G.rivers || L.w == null) return;
  const gw = G.n + 1,
    flowAt = (x, y) =>
      G.flow[Math.round(((x + G.e) / (2 * G.e)) * G.n) + Math.round(((y + G.e) / (2 * G.e)) * G.n) * gw] || 1,
    paint = (cx, cy, rad, t) => {
      for (let dy = -Math.ceil(rad); dy <= Math.ceil(rad); dy++)
        for (let dx = -Math.ceil(rad); dx <= Math.ceil(rad); dx++) {
          if (dx * dx + dy * dy > rad * rad) continue;
          const i = Math.floor(cx + dx),
            j = Math.floor(cy + dy);
          if (i >= 0 && j >= 0 && i < N && j < N) T.idx[j * N + i] = t;
        }
    };
  for (const pass of [0, 1])
    for (const course of G.rivers)
      for (let k = 0; k + 1 < course.length; k++) {
        const [ax, ay] = course[k],
          [bx, by] = course[k + 1],
          f = Math.min(4, flowAt(ax, ay)),
          steps = Math.ceil(Math.hypot(bx - ax, by - ay) * (N / 2) * 2);
        for (let q = 0; q <= steps; q++) {
          const x = ax + ((bx - ax) * q) / steps,
            y = ay + ((by - ay) * q) / steps,
            cx = ((x + 1) / 2) * N,
            cy = ((1 - y) / 2) * N,
            rad = 1.6 + f * 0.9;
          if (pass === 0) paint(cx, cy, rad + 1.5, (q + k) % 3 ? (L.D ?? L.S ?? L.w) : (L.S ?? L.w));
          else paint(cx, cy, rad, f >= 3 && L.d != null ? L.d : L.w);
        }
      }
}
/* the routes' and rivers' line map (see BOWL_ROUTE_FIELD): distances worked out once, near each line only */
function worldBowlLineMap() {
  const M = BOWL_MIX,
    S = worldBowl.spots,
    G = worldBowl.ground.G,
    rd = new Float32Array(M * M).fill(BOWL_ROUTE_FIELD),
    vd = new Float32Array(M * M).fill(BOWL_RIVER_FIELD),
    inPlace = new Uint8Array(M * M),
    texel = 2 / M,
    seg = (D, cap, ax, ay, bx, by, extra) => {
      const i0 = Math.max(0, Math.floor(((Math.min(ax, bx) - cap + 1) / 2) * M)),
        i1 = Math.min(M - 1, Math.ceil(((Math.max(ax, bx) + cap + 1) / 2) * M)),
        j0 = Math.max(0, Math.floor(((1 - Math.max(ay, by) - cap) / 2) * M)),
        j1 = Math.min(M - 1, Math.ceil(((1 - Math.min(ay, by) + cap) / 2) * M)),
        vx = bx - ax,
        vy = by - ay,
        vv = vx * vx + vy * vy || 1;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const x = -1 + (i + 0.5) * texel - ax,
            y = 1 - (j + 0.5) * texel - ay,
            t = Math.max(0, Math.min(1, (x * vx + y * vy) / vv)),
            dd = Math.hypot(x - vx * t, y - vy * t) - extra;
          if (dd < D[j * M + i]) D[j * M + i] = Math.max(0, dd);
        }
    };
  for (const [a, b] of ROADS) {
    const A = S[a],
      B = S[b];
    if (A && B && !A.under && !B.under && !A.off && !B.off) seg(rd, BOWL_ROUTE_FIELD, A.x, A.y, B.x, B.y, 0);
  }
  if (G.rivers) {
    const gw = G.n + 1;
    for (const course of G.rivers)
      for (let k = 0; k + 1 < course.length; k++) {
        const [ax, ay] = course[k],
          [bx, by] = course[k + 1],
          f = G.flow[Math.round(((ax + 1) / 2) * G.n) + Math.round(((ay + 1) / 2) * G.n) * gw] || 1;
        seg(vd, BOWL_RIVER_FIELD, ax, ay, bx, by, 0.0006 * Math.min(4, f));
      }
  }
  /* each place's own ground (its walk map, turned), where its own paths take over up close */
  LOCATIONS.forEach((l, i) => {
    const s = S[i],
      m = worldBowlMapOf(i);
    if (!s || s.under || s.off || !m) return;
    const half = Math.min(m.w, m.h) / 2 / BOWL_METRES,
      i0 = Math.max(0, Math.floor(((s.x - half + 1) / 2) * M)),
      i1 = Math.min(M - 1, Math.ceil(((s.x + half + 1) / 2) * M)),
      j0 = Math.max(0, Math.floor(((1 - s.y - half) / 2) * M)),
      j1 = Math.min(M - 1, Math.ceil(((1 - s.y + half) / 2) * M));
    for (let j = j0; j <= j1; j++)
      for (let ii = i0; ii <= i1; ii++)
        if (Math.hypot(-1 + (ii + 0.5) * texel - s.x, 1 - (j + 0.5) * texel - s.y) < half) inPlace[j * M + ii] = 1;
  });
  const px = new Uint8Array(M * M * 4);
  for (let k = 0; k < M * M; k++) {
    px[k * 4] = Math.round((rd[k] / BOWL_ROUTE_FIELD) * 255);
    px[k * 4 + 1] = inPlace[k] * 255;
    px[k * 4 + 2] = Math.round((vd[k] / BOWL_RIVER_FIELD) * 255);
    px[k * 4 + 3] = 255;
  }
  return px;
}
/* the light's view of the bowl for the shadow map: straight along the light, everything inside the rim in the square.
   Column-major, as WebGL reads it */
function worldBowlLightMatrix(c = [0, 0.3, 0], E = 1.25) {
  const f = worldBowlSunNow().ld.map(v => -v),
    hint = Math.abs(f[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1],
    cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm = a => {
      const l = Math.hypot(...a);
      return a.map(v => v / l);
    },
    r = norm(cross(f, hint)),
    u = cross(r, f),
    Z = 2,
    m = new Float32Array(16),
    row = (k, a, s) => {
      m[k] = a[0] * s;
      m[4 + k] = a[1] * s;
      m[8 + k] = a[2] * s;
      m[12 + k] = -(a[0] * c[0] + a[1] * c[1] + a[2] * c[2]) * s;
    };
  row(0, r, 1 / E);
  row(1, u, 1 / E);
  row(2, f, 1 / Z);
  m[15] = 1;
  return m;
}
/* the shadow map: drawn once for the ground (it never moves) and again only if the GPU starts over */
function worldBowlShadows(g) {
  const gl = gpuState.gl;
  const sun = worldBowlSunNow();
  /* the sun moves with the clock: draw the shadows again once it has gone round a little (about 6 minutes) */
  const ver = g.things ? g.things.ver : 0;
  if (
    g.shadow &&
    g.shadow.gl === gl &&
    Math.abs(g.shadow.az - sun.az) < 1.5 &&
    g.shadow.float === !!g.float &&
    (g.shadow.ver === ver || performance.now() - g.shadow.at < 2000)
  )
    return g.shadow;
  if (g.shadow && g.shadow.gl === gl && g.shadow.t) gl.deleteTexture(g.shadow.t);
  const t0 = performance.now(),
    Z = BOWL_SHADOW_SIZE,
    tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, Z, Z, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  /* nothing being drawn may read the map being drawn into (or another texture where a shadow sampler looks) */
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  /* the floating island: the shadows over it alone, so they come out sharp */
  const F = g.float,
    ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE,
    SM = F ? worldBowlLightMatrix(bowlToGpu(F.c[0], F.c[1], F.top), F.r * 1.6) : worldBowlLightMatrix();
  if (ok) {
    gl.viewport(0, 0, Z, Z);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(1.5, 2);
    const p = gpuState.P.mshadow;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uSM, false, SM);
    worldBowlIsleUniform(p.U, F);
    const land = F && F.fineGpu ? F.fineGpu : g.mesh;
    gl.bindVertexArray(land.vao);
    gl.drawElements(gl.TRIANGLES, land.n, gl.UNSIGNED_INT, 0);
    /* the buildings and trees cast shadows too */
    if (g.things && g.things.gpu) worldBowlThingsDraw(g.things, SM, null, true);
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  if (!ok) gl.deleteTexture(tex);
  g.shadow = {
    gl,
    t: ok ? tex : null,
    SM,
    az: sun.az,
    float: !!F,
    ver,
    at: performance.now(),
    ms: Math.round(performance.now() - t0),
  };
  return g.shadow;
}
/* ---------- landmarks, buildings, trees (look session 4) ----------
   Owner: far out one landmark per place as its own picture standing upright (logic/bowl-things.js picks it); close in
   each map's own buildings (their low-poly models, else their pictures) and trees, about three times their size; trees
   in clumps between places. Built a place at a time as its map comes in, drawn instanced (one shape per kind). */
/* a tree of each style, in metres (true size), as flat-faced triangles: [x, y up, z, nx, ny, nz, r, g, b] */
const BOWL_TREE_LOOK = {
  round: { crown: [0.3, 0.52, 0.24], trunk: [0.44, 0.31, 0.2], h: 6 },
  tall: { crown: [0.35, 0.55, 0.27], trunk: [0.46, 0.33, 0.22], h: 8 },
  cone: { crown: [0.18, 0.4, 0.27], trunk: [0.42, 0.29, 0.18], h: 8 },
  bush: { crown: [0.32, 0.5, 0.23], trunk: [0.38, 0.27, 0.17], h: 2 },
  mushroom: { crown: [0.78, 0.33, 0.3], trunk: [0.92, 0.88, 0.8], h: 5 },
  palm: { crown: [0.3, 0.55, 0.22], trunk: [0.55, 0.42, 0.28], h: 7 },
  crystal: { crown: [0.55, 0.75, 0.95], trunk: [0.45, 0.6, 0.85], h: 4 },
  dry: { crown: [0.55, 0.52, 0.28], trunk: [0.45, 0.35, 0.24], h: 3 },
};
function worldBowlTreeShape(style) {
  const L = BOWL_TREE_LOOK[style] || BOWL_TREE_LOOK.round,
    out = [],
    tri = (a, b, c, col) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
        v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
        l = Math.hypot(...n) || 1;
      for (const p of [a, b, c]) out.push(...p, n[0] / l, n[1] / l, n[2] / l, ...col);
    },
    /* a ring of n points at height y, radius r */
    ring = (n, r, y, rot = 0) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos(rot + (i / n) * Math.PI * 2) * r,
        y,
        Math.sin(rot + (i / n) * Math.PI * 2) * r,
      ]),
    prism = (n, r0, r1, y0, y1, col) => {
      const A = ring(n, r0, y0),
        B = ring(n, r1, y1);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        tri(A[i], B[j], B[i], col);
        tri(A[i], A[j], B[j], col);
        if (r1 < 1e-3) continue;
      }
      if (r1 > 1e-3) for (let i = 1; i < n - 1; i++) tri(B[0], B[i + 1], B[i], col);
    },
    shade = (c, k) => c.map(v => Math.min(1, v * k)),
    blob = (cy, rx, ry, col) => {
      /* an octahedron squashed and turned: eight faces, lit facet by facet */
      const top = [0, cy + ry, 0],
        bot = [0, cy - ry * 0.7, 0],
        M = ring(4, rx, cy, Math.PI / 4);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        tri(top, M[j], M[i], col);
        tri(bot, M[i], M[j], shade(col, 0.85));
      }
    },
    h = L.h;
  if (style === 'cone') {
    prism(4, 0.18, 0.12, 0, h * 0.25, L.trunk);
    prism(6, h * 0.22, 0, h * 0.2, h * 0.7, L.crown);
    prism(6, h * 0.16, 0, h * 0.5, h, shade(L.crown, 1.12));
  } else if (style === 'mushroom') {
    prism(5, 0.35, 0.28, 0, h * 0.62, L.trunk);
    prism(7, h * 0.4, 0.2, h * 0.55, h, L.crown);
  } else if (style === 'palm') {
    prism(4, 0.18, 0.12, 0, h * 0.9, L.trunk);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2,
        tip = [Math.cos(a) * h * 0.38, h * 0.72, Math.sin(a) * h * 0.38],
        s1 = [Math.cos(a + 0.5) * 0.5, h * 0.92, Math.sin(a + 0.5) * 0.5],
        s2 = [Math.cos(a - 0.5) * 0.5, h * 0.92, Math.sin(a - 0.5) * 0.5];
      tri(s1, tip, s2, L.crown);
      tri(s2, tip, s1, L.crown);
    }
  } else if (style === 'crystal') {
    const spike = (x, z, r, hh, col) => {
      const top = [x, hh, z],
        M = ring(4, r, hh * 0.25).map(p => [p[0] + x, p[1], p[2] + z]),
        bot = [x, 0, z];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        tri(top, M[j], M[i], col);
        tri(bot, M[i], M[j], shade(col, 0.8));
      }
    };
    spike(0, 0, 0.6, h, L.crown);
    spike(0.7, 0.3, 0.35, h * 0.6, L.trunk);
    spike(-0.5, -0.4, 0.3, h * 0.5, L.crown);
  } else if (style === 'bush' || style === 'dry') {
    blob(h * 0.45, h * 0.6, h * 0.45, L.crown);
  } else {
    prism(4, 0.22, 0.15, 0, h * 0.45, L.trunk);
    blob(
      h * (style === 'tall' ? 0.62 : 0.6),
      h * (style === 'tall' ? 0.22 : 0.36),
      h * (style === 'tall' ? 0.42 : 0.34),
      L.crown
    );
  }
  return new Float32Array(out);
}
/* HB-3: a bridge's shape from its key ('b:length:width:pier'), its deck a little over the bank it starts from */
function worldBowlBridgeShape(key) {
  const [, len, w, pier] = key.split(':').map(Number),
    T = bowlBridgeShape(len, w, { pier: !!pier, drop: 1.5 });
  if (!pier) for (let i = 1; i < T.length; i += 9) T[i] += 0.3;
  return T;
}
/* HB-3: a tree's own model for the map, from its recipe (logic/bowl-things.js bowlTreeFromRecipe), its leaf pictures
   (a prop's swap, an autumn tree's) read for their colour and size first; null while any is still coming */
const WORLD_BOWL_LEAVES = new Map();
function worldBowlLeafLook(path) {
  if (WORLD_BOWL_LEAVES.has(path)) return WORLD_BOWL_LEAVES.get(path);
  WORLD_BOWL_LEAVES.set(path, null);
  artPixels(path)
    .then(px => {
      const im = ART_CACHE.img[path];
      WORLD_BOWL_LEAVES.set(path, { col: bowlAverageColour(px), w: im.naturalWidth, h: im.naturalHeight });
    })
    .catch(() => WORLD_BOWL_LEAVES.set(path, { col: [0.3, 0.5, 0.25], w: 64, h: 64 }))
    .finally(() => (worldBowl.dirty = true));
  return null;
}
function worldBowlTreeModelShape(pk) {
  const art = ((gameData.scenery && gameData.scenery.props) || {})[pk],
    rec = art && loadPropModelRecipe(art.model);
  if (!rec) return null;
  const swap = art.swap || {},
    T = bowlTreeFromRecipe(rec, img => worldBowlLeafLook(swap[img] || img));
  /* one with no limbs or leaves (a mushroom: domes and spheres) is drawn as any model is */
  return T && !T.length ? worldBowlModelShape(art.model) : T;
}
/* a building's low-poly model from its recipe (prop-models.js lowPolyFromRecipe), kept simple for the map: small
   parts left out, round parts with few sides; unpacked to floats [x, y up, z, normal, colour] */
function worldBowlModelShape(path) {
  const rec = loadPropModelRecipe(path);
  if (!rec) return null;
  const layers = (rec.layers || [])
    .filter(l => l.k !== 'img' && l.k !== 'limb' && !l.hide)
    .filter(l => Math.max(l.w || 0, l.d || 0, l.h || 0, (l.r || 0) * 2) >= 0.35)
    .map(l => ({ ...l, sides: Math.min(l.sides || 8, 8), rings: Math.min(l.rings || 4, 4), lump: 0 }));
  const M = layers.length ? lowPolyFromRecipe({ ...rec, layers }) : null;
  if (!M) return new Float32Array(0);
  const i16 = new Int16Array(M.vb),
    i8 = new Int8Array(M.vb),
    u8 = new Uint8Array(M.vb),
    I = M.ib,
    out = new Float32Array(I.length * 9);
  for (let k = 0; k < I.length; k++) {
    const o = I[k] * 24;
    out.set(
      [
        i16[o / 2] / 256,
        i16[o / 2 + 1] / 256,
        i16[o / 2 + 2] / 256,
        i8[o + 8] / 127,
        i8[o + 9] / 127,
        i8[o + 10] / 127,
        u8[o + 20] / 255,
        u8[o + 21] / 255,
        u8[o + 22] / 255,
      ],
      k * 9
    );
  }
  return out;
}
/* how much bigger than life things stand: three times on the bowl, life size on the floating island (the owner: the
   island is big, its town in scale with it) */
function worldBowlThingScale() {
  return worldBowlFloats() ? 1 : BOWL_THING_SCALE;
}
/* the town's smaller structures the bowl draws as their models though they are no buildings (no door, small) */
const BOWL_STRUCTURE = /^(airship_station|airship_mast|well|fountain|clock_tower|greenhouse)$/;
/* one model standing at (x, y) on the bowl: its scale and the map's east and north there (group 1, a map's own) */
/* HB-3: turned by the placement's rot (degrees, logic/prop-turn.js turnedPoint: its across toward its back), as the
   walk scene turns it */
function worldBowlModelInto(W, model, x, y, k, east, north, rot = 0, lod = 0) {
  W.models.add(model);
  worldBowlInst(W, 'm:' + model, x, y, k, east, north, rot, lod);
}
/* one instance of a shape (key: a tree style, 'm:' a model, 't:' a tree's own model by its prop): lod 0 a building
   (its windows light at night), 1 a tree's own model (not drawn past the World map's Simple trees past), 2 that tree's
   simple shape (drawn only past it), 3 any other thing (a fence, a bridge) */
function worldBowlInst(W, key, x, y, k, east, north, rot = 0, lod = 0) {
  const a = (rot * Math.PI) / 180,
    ca = Math.cos(a),
    sa = Math.sin(a);
  (W.inst[key] = W.inst[key] || []).push([
    ...bowlToGpu(x, y, worldBowlSkyFloor(x, y)),
    k,
    ca * east[0] + sa * north[0],
    ca * east[1] + sa * north[1],
    ca * north[0] - sa * east[0],
    ca * north[1] - sa * east[1],
    1,
    lod ? 0 : 0.05 + ((0.9 * (((Math.sin(x * 9137.1 + y * 5711.3) * 43758.5) % 1) + 1)) % 1),
    lod === 1 || lod === 2 ? lod : 0,
    0,
  ]);
}
/* the things of one place, from its map: its landmark (far), its buildings and trees (close) */
function worldBowlThingsOfPlace(W, i) {
  const l = LOCATIONS[i],
    s = worldBowl.spots[i],
    M = l && worldBowlMapOf(i),
    own = (l && gameData.maps && gameData.maps[l.mapId]) || M,
    A = (gameData.scenery && gameData.scenery.props) || {};
  if (!M || !M.props || s.under || s.off) return false;
  const k = worldBowlThingScale() / BOWL_METRES,
    { north, east } = bowlCompass(s.x, s.y, s.up),
    base = (x, y) => bowlToGpu(x, y, worldBowlSkyFloor(x, y)),
    /* the landmark from the place's own map (Copperleaf's oak until IS-5 moves the town onto its island) */
    lm = bowlLandmarkPick(l, own && own.props ? own : M, A);
  /* a landmark with a model of its own is drawn as that model (where the map puts it), never as a flat picture */
  const modelOf = (/** @type {any} */ a) => !!(a && a.model && /\.json$/.test(a.model)),
    treeModels = worldBowlFloats() && !!engineSetting('worldMap', 'treeModels'),
    treeFar = (engineSetting('worldMap', 'treeFar') || 0) > 0,
    fences = worldBowlFloats() && !!engineSetting('worldMap', 'fences');
  /* HB-3: the floating island draws its own things where they stand; a landmark that is not one of them would stand
     at the map's middle (its spot), so none is added there */
  if (lm && A[lm.k] && !worldBowlFloats()) {
    if (modelOf(A[lm.k])) {
      if (!M.props.some(p => p.k === lm.k))
        worldBowlModelInto(W, A[lm.k].model, s.x, s.y, k * (lm.s || 1), east, north);
    } else if (A[lm.k].img) W.stand.push({ i, k: lm.k, x: s.x, y: s.y, g: 0, s: lm.s || 1 });
  }
  let n = 0;
  for (const p of M.props) {
    const art = A[p.k],
      cls = bowlPropClass(p.k, art);
    /* HB-3: the floating island's fences as their models (World map settings: Fences) */
    if (fences && /fence/.test(p.k) && modelOf(art)) {
      const [x, y] = bowlMapPoint(s, M, p.x, p.z, BOWL_METRES);
      worldBowlModelInto(W, art.model, x, y, k * (p.s || 1), east, north, +(p.rot || 0), 3);
      n++;
      continue;
    }
    const structure = !!(art && BOWL_STRUCTURE.test(art.group || p.k) && modelOf(art));
    if (!cls && !(art && art.landmark) && !structure) continue;
    const [x, y] = bowlMapPoint(s, M, p.x, p.z, BOWL_METRES);
    if (Math.hypot(x, y) > 0.99) continue;
    n++;
    if (cls === 'tree' && treeModels && modelOf(art)) {
      /* HB-3: the floating island's trees as their own models (the World map settings: off, the simple shapes), and
         with Simple trees past set, a simple shape of each drawn instead when it is that far */
      worldBowlInst(W, 't:' + p.k, x, y, k * (p.s || 1), east, north, +(p.rot || 0), 1);
      W.models.add(art.model);
      if (treeFar) worldBowlInst(W, bowlTreeStyle(p.k), x, y, k * (p.s || 1), east, north, +(p.rot || 0), 2);
    } else if (cls === 'tree') {
      const style = bowlTreeStyle(p.k);
      (W.inst[style] = W.inst[style] || []).push([
        ...base(x, y),
        k * (p.s || 1),
        east[0],
        east[1],
        north[0],
        north[1],
        1,
        0,
        0,
        0,
      ]);
    } else if ((cls === 'building' || art.landmark || structure) && modelOf(art)) {
      worldBowlModelInto(W, art.model, x, y, k * (p.s || 1), east, north, +(p.rot || 0));
    } else if (art && art.img) W.stand.push({ i, k: p.k, x, y, g: 1, s: p.s || 1 });
  }
  /* HB-3: its bridges and pier (the map's own `bridges`, not props), each from its higher end (World map settings) */
  if (worldBowlFloats() && engineSetting('worldMap', 'bridges'))
    for (const b of M.bridges || []) {
      if (!Array.isArray(b.a) || !Array.isArray(b.b)) continue;
      const A = bowlMapPoint(s, M, b.a[0], b.a[1], BOWL_METRES),
        B = bowlMapPoint(s, M, b.b[0], b.b[1], BOWL_METRES),
        up = worldBowlSkyFloor(B[0], B[1]) > worldBowlSkyFloor(A[0], A[1]),
        [from, to] = up ? [b.b, b.a] : [b.a, b.b],
        len = Math.hypot(to[0] - from[0], to[1] - from[1]),
        rot = (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI,
        at = up ? B : A;
      if (len < 0.5) continue;
      worldBowlInst(
        W,
        `b:${len.toFixed(1)}:${(+b.w || 2).toFixed(1)}:${b.pier ? 1 : 0}`,
        at[0],
        at[1],
        k,
        east,
        north,
        rot,
        3
      );
      n++;
    }
  /* IS-7: an island map's plots no building stands on yet get one of their kind, turned to face where the plot does */
  for (const t of bowlIslandPlotThings(M, p => bowlPropClass(p.k, A[p.k]) === 'building')) {
    const art = A[t.k];
    if (!art || !art.model || !/\.json$/.test(art.model)) continue;
    const [x, y] = bowlMapPoint(s, M, t.x, t.z, BOWL_METRES);
    if (Math.hypot(x, y) > 0.99) continue;
    n++;
    worldBowlModelInto(W, art.model, x, y, k, east, north, t.turn);
  }
  W.counts[i] = n;
  return true;
}
/* the clumps between places (once, when the ground is ready) */
function worldBowlClumpsInto(W) {
  const S = worldBowl.spots,
    G = worldBowl.ground.G,
    places = [],
    roads = [];
  LOCATIONS.forEach((l, i) => {
    const s = S[i],
      m = worldBowlMapOf(i);
    if (s && !s.under && !s.off)
      places.push({
        x: s.x,
        y: s.y,
        reach: m ? Math.hypot(m.w, m.h) / 2 / BOWL_METRES : 0.06,
        region: l.region || 'starter',
      });
  });
  for (const [a, b] of ROADS)
    if (S[a] && S[b] && !S[a].under && !S[b].under && !S[a].off && !S[b].off)
      roads.push([S[a].x, S[a].y, S[b].x, S[b].y]);
  const look = worldMapLook(),
    trees = Object.fromEntries(Object.entries(look.regions).map(([k, R]) => [k, R.trees])),
    T = bowlClumps(
      G,
      places,
      roads,
      (x, y) => bowlGridHeight(G, x, y) - bowlWaterLevel(x, y),
      undefined,
      trees,
      look.seed
    ),
    k = worldBowlThingScale() / BOWL_METRES;
  for (const t of T) {
    const a = Math.sin(t.x * 733.1 + t.y * 197.7) * Math.PI;
    (W.inst[t.style] = W.inst[t.style] || []).push([
      ...bowlToGpu(t.x, t.y, worldBowlSkyFloor(t.x, t.y)),
      k * t.s,
      Math.cos(a),
      Math.sin(a),
      -Math.sin(a),
      Math.cos(a),
      0,
      0,
      0,
      0,
    ]);
  }
  W.clumps = T.length;
}
/* the standees' pictures in one atlas (each scaled down by whole steps to at most 192 px high, kept sharp) */
function worldBowlAtlas(W) {
  const A = (gameData.scenery && gameData.scenery.props) || {},
    keys = [...new Set(W.stand.map(q => q.k))].filter(k => A[k] && A[k].img),
    paths = keys.map(k => A[k].img);
  if (W.atlasKeys === keys.join()) return W.atlas;
  if (!paths.every(p => ART_CACHE.img[p] && ART_CACHE.img[p].naturalWidth)) {
    if (!W.atlasLoading) {
      W.atlasLoading = true;
      Promise.resolve(artLoad(paths))
        .catch(() => {})
        .finally(() => {
          W.atlasLoading = false;
          W.dirty = true;
          worldBowl.dirty = true;
        });
    }
    return W.atlas;
  }
  const S = 2048,
    c = makeCanvas(S, S),
    x = c.getContext('2d'),
    uv = {};
  x.imageSmoothingEnabled = false;
  let px = 0,
    py = 0,
    row = 0;
  for (const k of keys) {
    const im = ART_CACHE.img[A[k].img],
      f = Math.max(1, Math.ceil(im.naturalHeight / 192), Math.ceil(im.naturalWidth / 256)),
      w = Math.ceil(im.naturalWidth / f),
      h = Math.ceil(im.naturalHeight / f);
    if (px + w + 2 > S) {
      px = 0;
      py += row + 2;
      row = 0;
    }
    if (py + h > S) break;
    x.drawImage(im, px, py, w, h);
    uv[k] = {
      u0: px / S,
      v0: py / S,
      u1: (px + w) / S,
      v1: (py + h) / S,
      w: im.naturalWidth / 32,
      h: im.naturalHeight / 32,
    };
    px += w + 2;
    row = Math.max(row, h);
  }
  W.atlasKeys = keys.join();
  W.atlas = { c, uv, gl: null, t: null };
  return W.atlas;
}
/* each frame: take in the places whose maps have come, and (now and then) send the changes to the GPU */
function worldBowlThingsTick(g) {
  const gl = gpuState.gl;
  let W = g.things;
  if (!W) {
    W = g.things = { inst: {}, stand: [], models: new Set(), done: new Set(), counts: {}, ver: 0, dirty: true, at: 0 };
    /* HB-3: the floating island has its own trees, never the bowl's clumps between places */
    if (worldBowlFloats()) W.clumps = 0;
    else worldBowlClumpsInto(W);
  }
  for (let i = 0; i < LOCATIONS.length; i++)
    if (
      !W.done.has(i) &&
      worldBowl.spots[i] &&
      !worldBowl.spots[i].under &&
      !worldBowl.spots[i].off &&
      worldBowlThingsOfPlace(W, i)
    ) {
      W.done.add(i);
      W.dirty = true;
    }
  const now = performance.now();
  if (W.gpu && W.gpu.gl !== gl) W.gpu = null;
  if (!(W.dirty || !W.gpu) || (W.gpu && now - W.at < 1000)) return;
  const t0 = now;
  /* the shapes: one per tree style and building model (a model whose recipe is still loading waits) */
  const G = W.gpu && W.gpu.gl === gl ? W.gpu : { gl, kinds: {} };
  let waiting = false;
  for (const key of Object.keys(W.inst)) {
    if (G.kinds[key] && G.kinds[key].shape) continue;
    const shape = key.startsWith('m:')
      ? worldBowlModelShape(key.slice(2))
      : key.startsWith('t:')
        ? worldBowlTreeModelShape(key.slice(2))
        : key.startsWith('b:')
          ? worldBowlBridgeShape(key)
          : worldBowlTreeShape(key);
    if (!shape) {
      waiting = true;
      continue;
    }
    const vao = gl.createVertexArray(),
      vb = gl.createBuffer(),
      ib = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, shape, gl.STATIC_DRAW);
    for (const [loc, size, off] of [
      [0, 3, 0],
      [1, 3, 12],
      [2, 3, 24],
    ]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 36, off);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    for (const [loc, off] of [
      [8, 0],
      [9, 16],
      [10, 32],
    ]) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 48, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    G.kinds[key] = { shape, vao, ib, nv: shape.length / 9, n: 0 };
  }
  for (const [key, list] of Object.entries(W.inst)) {
    const K = G.kinds[key];
    if (!K || K.n === list.length) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, K.ib);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list.flat()), gl.STATIC_DRAW);
    K.n = list.length;
  }
  /* the standees: six corners each, from the atlas */
  const at = worldBowlAtlas(W);
  if (at) {
    if (at.gl !== gl) {
      at.gl = gl;
      at.t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, at.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, at.c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    const V = [];
    for (const q of W.stand) {
      const u = at.uv[q.k];
      if (!u) continue;
      const b = bowlToGpu(q.x, q.y, worldBowlSkyFloor(q.x, q.y)),
        w = (u.w * q.s * worldBowlThingScale()) / BOWL_METRES,
        h = (u.h * q.s * worldBowlThingScale()) / BOWL_METRES;
      for (const [cx, cy] of [
        [-0.5, 0],
        [0.5, 0],
        [0.5, 1],
        [-0.5, 0],
        [0.5, 1],
        [-0.5, 1],
      ])
        V.push(...b, cx, cy, w, h, u.u0, u.v0, u.u1, u.v1, q.g);
    }
    if (!G.svao) {
      G.svao = gl.createVertexArray();
      G.sb = gl.createBuffer();
      gl.bindVertexArray(G.svao);
      gl.bindBuffer(gl.ARRAY_BUFFER, G.sb);
      for (const [loc, size, off] of [
        [0, 3, 0],
        [7, 4, 12],
        [8, 4, 28],
        [9, 1, 44],
      ]) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 48, off);
      }
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, G.sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW);
    G.ns = V.length / 12;
  }
  W.gpu = G;
  W.at = now;
  W.dirty = waiting || !at;
  W.ver++;
  W.ms = Math.round(performance.now() - t0);
  worldBowl.dirty = true;
}
/* draws the things: into the shadow map (SM is the light's matrix, only the shapes) or into the view */
function worldBowlThingsDraw(W, VP, F, shadowPass) {
  const gl = gpuState.gl,
    G = W.gpu,
    dist = worldBowl.cam ? worldBowl.cam.dist : 2,
    /* the floating island is always seen close: its own things always show (the opening fall films it with no map
       camera) */
    fl = worldBowlFloats(),
    near = shadowPass || fl ? 1 : 1 - Math.max(0, Math.min(1, (dist - 0.7) / 0.25)),
    far = fl ? 0 : Math.max(0, Math.min(1, (dist - 0.62) / 0.23));
  let p = gpuState.P.mthing,
    U = p.U;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform1f(U.uNear, near);
  gl.uniform1f(U.uShadowPass, shadowPass ? 1 : 0);
  /* HB-3: trees as simple shapes past this far (World map settings, metres; 0 never; the shadows keep the models) */
  gl.uniform1f(U.uFlat, shadowPass || !fl ? 0 : (engineSetting('worldMap', 'treeFar') || 0) / BOWL_METRES);
  if (shadowPass) {
    gl.uniform1i(U.uSh, 3);
    gl.uniform1i(U.uSky, 7);
  } else {
    gl.uniform3fv(U.uC, F.v.C);
    gl.uniform3fv(U.uLd, F.sun.ld);
    gl.uniform3fv(U.uHaze, F.haze);
    gl.uniform1f(U.uLit, typeof environmentLitFraction === 'function' ? environmentLitFraction(F.sky.hour ?? 13) : 0);
    worldBowlShadowUniforms(U, worldBowl.ground);
    worldBowlSkyUniforms(U, F.sky, F.sun);
  }
  let tris = 0;
  for (const [key, K] of Object.entries(G.kinds)) {
    if (!K.n || !K.nv) continue;
    /* close in only: the maps' own things (clumps are group 0 and share the tree shapes, so trees always draw) */
    if (near <= 0 && key.startsWith('m:')) continue;
    gl.bindVertexArray(K.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, K.nv, K.n);
    tris += (K.nv / 3) * K.n;
  }
  W.tris = tris;
  if (shadowPass || !G.ns || !W.atlas || !W.atlas.t) return;
  p = gpuState.P.mstandee;
  U = p.U;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uRt, F.v.rt);
  gl.uniform3fv(U.uC, F.v.C);
  gl.uniform3fv(U.uHaze, F.haze);
  gl.uniform1f(U.uPx, (2 * Math.tan((BOWL_CAMERA.fov * Math.PI) / 360)) / Math.max(1, worldMapHeight));
  gl.uniform1f(U.uMinPx, 46);
  gl.uniform1f(U.uFar, far);
  gl.uniform1f(U.uNear, near);
  gl.uniform1f(U.uLight, F.sun.light);
  gl.uniform1f(U.uNight, F.sun.night);
  gl.activeTexture(gl.TEXTURE6);
  gl.bindTexture(gl.TEXTURE_2D, W.atlas.t);
  gl.uniform1i(U.uAtlas, 6);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(G.svao);
  gl.drawArrays(gl.TRIANGLES, 0, G.ns);
  gl.bindVertexArray(null);
}
/* paths along the roads, a few squares wide (the places' own maps lie over their ends) */
function worldBowlRoadsInto(T) {
  const N = BOWL_INDEX,
    S = worldBowl.spots,
    path = T.K.layer.p ?? T.K.layer.u;
  if (path == null) return;
  for (const [a, b] of ROADS) {
    const A = S[a],
      B = S[b];
    if (!A || !B || A.under || B.under || A.off || B.off) continue;
    const len = Math.hypot(B.x - A.x, B.y - A.y) * (N / 2),
      steps = Math.ceil(len * 2);
    for (let k = 0; k <= steps; k++) {
      const f = k / steps,
        cx = ((A.x + (B.x - A.x) * f + 1) / 2) * N,
        cy = ((1 - (A.y + (B.y - A.y) * f)) / 2) * N;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = Math.floor(cx + dx),
            j = Math.floor(cy + dy);
          if (i >= 0 && j >= 0 && i < N && j < N) T.idx[j * N + i] = path;
        }
    }
  }
}
/* a place's own walk map laid on the ground: each square of the bowl in its turned footprint takes the map's square */
function worldBowlStampMap(T, i) {
  const l = LOCATIONS[i],
    s = worldBowl.spots[i],
    M = l && worldBowlMapOf(i);
  if (!M || !M.tiles || !M.tiles.length || s.under || s.off || T.stamped.has(i)) return false;
  T.stamped.add(i);
  const N = BOWL_INDEX,
    { north, east } = bowlCompass(s.x, s.y, s.up),
    w = M.w,
    h = M.h,
    half = Math.hypot(w, h) / 2 / BOWL_METRES,
    i0 = Math.max(0, Math.floor(((s.x - half + 1) / 2) * N)),
    i1 = Math.min(N - 1, Math.ceil(((s.x + half + 1) / 2) * N)),
    j0 = Math.max(0, Math.floor(((1 - (s.y + half)) / 2) * N)),
    j1 = Math.min(N - 1, Math.ceil(((1 - (s.y - half)) / 2) * N)),
    L = T.K.layer,
    /* IS-7: an island map only where the bowl has its land: its own sea squares would show through the water as a
       box round it */
    G = bowlHasCoast(M) && worldBowl.ground ? worldBowl.ground.G : null,
    /* HB-3: the floating island clipped by its own coast (the map's 240 points), not the bowl's 6 m grid: a smooth
       coast, no blocks */
    P = G && worldBowlFloats() ? worldBowlIslandPoly() : null;
  for (let j = j0; j <= j1; j++)
    for (let ii = i0; ii <= i1; ii++) {
      const x = -1 + ((ii + 0.5) / N) * 2 - s.x,
        y = 1 - ((j + 0.5) / N) * 2 - s.y,
        mx = (x * east[0] + y * east[1]) * BOWL_METRES + w / 2,
        mz = (x * north[0] + y * north[1]) * BOWL_METRES + h / 2;
      if (mx < 0 || mz < 0 || mx >= w || mz >= h) continue;
      if (P ? !floatInside(P, x + s.x, y + s.y) : G && bowlCoastAt(G, x + s.x, y + s.y) > 0) continue;
      const ch = (M.tiles[h - 1 - Math.floor(mz)] || '')[Math.floor(mx)],
        t = L[ch];
      if (t != null) T.idx[j * N + ii] = t;
    }
  T.dirty = true;
  return true;
}
/* the places' maps, loaded a few at a time while the map is open (the walk scenes load the near ones anyway) */
function worldBowlStampMaps(T) {
  if (T.loading) return;
  for (let i = 0; i < LOCATIONS.length; i++) {
    if (T.stamped.has(i) || worldBowl.spots[i].under || worldBowl.spots[i].off) continue;
    const id = worldBowlMapId(i);
    if (!id || !gameData.maps[id]) {
      T.stamped.add(i);
      continue;
    }
    if (typeof isLiteMap === 'function' && isLiteMap(id)) {
      T.loading = true;
      loadMapFile(id)
        .catch(() => {})
        .finally(() => {
          T.loading = false;
          worldBowlStampMap(T, i);
          worldBowl.dirty = true;
        });
      return;
    }
    worldBowlStampMap(T, i);
  }
}
/* the terrain pictures as one stack of layers, and each one's average colour */
async function worldBowlTerrainPictures(T) {
  if (T.pix) return T.pix;
  const n = T.K.keys.length,
    data = new Uint8Array(16 * 16 * 4 * n),
    avg = new Float32Array(n * 3);
  await Promise.all(
    T.K.keys.map(async (k, layer) => {
      const tile = T.K.T[k].tile;
      let px = null;
      try {
        px = tile ? new Uint8Array((await artPixels(tile)).buffer) : null;
      } catch (e) {
        px = null;
      }
      let r = 0,
        g = 0,
        b = 0;
      for (let p = 0; p < 256; p++) {
        /* tiles are 16 x 16; anything else is sampled to fit */
        const q = px ? p * 4 : -1,
          col = q >= 0 && q + 3 < px.length ? [px[q], px[q + 1], px[q + 2]] : [128, 128, 128];
        data.set([col[0], col[1], col[2], 255], (layer * 256 + p) * 4);
        r += col[0];
        g += col[1];
        b += col[2];
      }
      avg.set([r / 256 / 255, g / 256 / 255, b / 256 / 255], layer * 3);
    })
  );
  T.pix = { data, avg };
  return T.pix;
}
/* the GPU's copies: the terrain map (one byte a square), the layers, and the far-away colours */
function worldBowlTerrainGpu(T) {
  const gl = gpuState.gl;
  if (!T.pix) return false;
  if (T.gl !== gl) {
    T.gl = gl;
    T.tIdx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, T.tIdx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, BOWL_INDEX, BOWL_INDEX, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ])
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    T.tLay = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, T.tLay);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 16, 16, T.K.keys.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.pix.data);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    T.tMix = gl.createTexture();
    T.dirty = true;
  }
  /* new squares go up at most twice a second (the terrain fills and the maps come in a bit at a time) */
  const now = performance.now();
  if (T.dirty && now - (T.upAt || 0) > 500) {
    T.dirty = false;
    T.upAt = now;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.bindTexture(gl.TEXTURE_2D, T.tIdx);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BOWL_INDEX, BOWL_INDEX, gl.RED, gl.UNSIGNED_BYTE, T.idx);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    const M = BOWL_MIX,
      k = BOWL_INDEX / M,
      mix = new Uint8Array(M * M * 4),
      A = T.pix.avg.slice();
    /* far away a place's water reads as the water the near view draws */
    if (T.K.layer.w != null) A.set([0.26, 0.66, 0.74], T.K.layer.w * 3);
    if (T.K.layer.d != null) A.set([0.1, 0.45, 0.66], T.K.layer.d * 3);
    for (let j = 0; j < M; j++)
      for (let i = 0; i < M; i++) {
        let r = 0,
          g = 0,
          b = 0;
        for (let dj = 0; dj < k; dj++)
          for (let di = 0; di < k; di++) {
            const t = T.idx[(j * k + dj) * BOWL_INDEX + i * k + di] * 3;
            r += A[t];
            g += A[t + 1];
            b += A[t + 2];
          }
        const q = (j * M + i) * 4;
        mix[q] = (r / (k * k)) * 255;
        mix[q + 1] = (g / (k * k)) * 255;
        mix[q + 2] = (b / (k * k)) * 255;
        mix[q + 3] = 255;
      }
    T.mix = mix;
    gl.bindTexture(gl.TEXTURE_2D, T.tMix);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, M, M, 0, gl.RGBA, gl.UNSIGNED_BYTE, mix);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (worldBowl.wall) worldBowl.wall.node = -1; /* the walk scenes' far wall takes the new colours */
  }
  return true;
}
/* the ground's colour at a point, from the far-away colours (or a region's, before they are made) */
function worldBowlColorAt(x, y) {
  const T = worldBowl.ground && worldBowl.ground.terrain;
  if (T && T.mix) {
    const M = BOWL_MIX,
      i = Math.max(0, Math.min(M - 1, Math.floor(((x + 1) / 2) * M))),
      j = Math.max(0, Math.min(M - 1, Math.floor(((1 - y) / 2) * M))),
      q = (j * M + i) * 4;
    return [T.mix[q] / 255, T.mix[q + 1] / 255, T.mix[q + 2] / 255];
  }
  return [0.5, 0.62, 0.38];
}
/* the mesh: the grid's cells over the bowl; corners beyond the rim are pulled onto it, so the edge is a clean circle */
function worldBowlMesh() {
  const { n, e, h } = worldBowl.ground.G,
    w = n + 1,
    V = new Float32Array(w * w * 3),
    I = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      let x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      const r = Math.hypot(x, y);
      if (r > 1) {
        x /= r;
        y /= r;
      }
      V.set(
        bowlToGpu(x, y, r > 1 ? bowlHeight(1) + bowlRelief(worldBowl.ground.F, x, y) : h[j * w + i]),
        (j * w + i) * 3
      );
    }
  const cell = (2 * e) / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -e + cell * (i + 0.5),
        y = -e + cell * (j + 0.5);
      if (Math.hypot(x, y) > 1 + cell) continue;
      const a = j * w + i,
        b = a + 1,
        c = a + w,
        d = c + 1;
      /* split from (i, j) to (i + 1, j + 1), as bowlGridHeight reads it */
      I.push(a, b, d, a, d, c);
    }
  return uploadMesh(V, new Uint32Array(I), [['aPos', 3, 0]], 12);
}
/* the water: a sheet on the bowl's curve over every cell that touches the sea, each corner with how deep the water is
   there and how far out to sea (the shader's colours, foam and shallows come from them) */
function worldBowlWaterMesh() {
  const { n, e, h, c } = worldBowl.ground.G;
  if (!c) return null;
  const w = n + 1,
    V = new Float32Array(w * w * 5),
    I = [];
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      let x = -e + (2 * e * i) / n,
        y = -e + (2 * e * j) / n;
      const r = Math.hypot(x, y);
      if (r > 1) {
        x /= r;
        y /= r;
      }
      const top = bowlWaterLevel(x, y) - 0.0004;
      V.set([...bowlToGpu(x, y, top), Math.max(0, top - h[j * w + i]), c[j * w + i]], (j * w + i) * 5);
    }
  const cell = (2 * e) / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const a = j * w + i,
        b = a + 1,
        q = a + w,
        d = q + 1;
      if (Math.max(c[a], c[b], c[q], c[d]) <= 0) continue;
      if (Math.hypot(-e + cell * (i + 0.5), -e + cell * (j + 0.5)) > 1 + cell) continue;
      I.push(a, b, d, a, d, q);
    }
  if (!I.length) return null;
  return uploadMesh(
    V,
    new Uint32Array(I),
    [
      ['aPos', 3, 0],
      ['aShore', 2, 12],
    ],
    20
  );
}
function worldBowlGpu() {
  const g = worldBowl.ground;
  worldBowlFloatCam();
  const FI = g.float;
  if (FI && FI.fine && (!FI.fineGpu || FI.fineGpu.gl !== gpuState.gl)) {
    FI.fineGpu = uploadMesh(FI.fine.V, FI.fine.I, [['aPos', 3, 0]], 12);
    FI.fineGpu.gl = gpuState.gl;
  }
  if (FI && FI.falls && (!FI.fallsGpu || FI.fallsGpu.gl !== gpuState.gl)) {
    FI.fallsGpu = uploadMesh(
      FI.falls.V,
      FI.falls.I,
      [
        ['aPos', 3, 0],
        ['aUV', 2, 12],
      ],
      20
    );
    FI.fallsGpu.gl = gpuState.gl;
  }
  /* HB-3: the lagoon's water, as the bowl's sea carries it (depth, and here how far it has faded into the clouds) */
  if (FI && FI.water && FI.water.I.length && (!FI.waterGpu || FI.waterGpu.gl !== gpuState.gl)) {
    FI.waterGpu = uploadMesh(
      FI.water.V,
      FI.water.I,
      [
        ['aPos', 3, 0],
        ['aShore', 2, 12],
      ],
      20
    );
    FI.waterGpu.gl = gpuState.gl;
  }
  if (!g.mesh || g.gl !== gpuState.gl) {
    g.gl = gpuState.gl;
    g.mesh = worldBowlMesh();
    /* the floating island has no sea round it */
    g.water = worldBowlFloats() ? null : worldBowlWaterMesh();
    g.shadow = null;
    g.lines = null;
  }
  const T = worldBowlTerrainStart();
  if (!T.ready) {
    T.fill(96);
    worldBowl.dirty = true;
  } else worldBowlStampMaps(T);
  if (!T.pix && !T.pixLoading) {
    T.pixLoading = true;
    worldBowlTerrainPictures(T).then(() => (worldBowl.dirty = true));
  }
  g.ok = T.ready && worldBowlTerrainGpu(T);
  if (g.ok && (!g.lines || g.lines.gl !== gpuState.gl)) {
    const gl = gpuState.gl,
      t = gl.createTexture(),
      t0 = performance.now();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, BOWL_MIX, BOWL_MIX, 0, gl.RGBA, gl.UNSIGNED_BYTE, worldBowlLineMap());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    g.lines = { gl, t, ms: Math.round(performance.now() - t0) };
  }
  if (g.ok) worldBowlThingsTick(g);
  worldBowlShadows(g);
  if (T.dirty) worldBowl.dirty = true;
  return g;
}

/* ---------- the walk scenes' horizon: the bowl's far wall ----------
   A strip round the horizon, worked out from where you stand: for each direction (east is the walk scene's +x, north
   its +z), how high the land rises against the sky and its colour there. walk/sky.js draws it under the clouds. */
const BOWL_WALL_W = 512;
function bowlWallTexture() {
  if (typeof gpuState === 'undefined' || !gpuState.gl) return null;
  const node = saveData && saveData.trip ? saveData.trip.node : 0,
    gl = gpuState.gl;
  if (worldBowl.wall && worldBowl.wall.node === node && worldBowl.wall.gl === gl) return worldBowl.wall.t;
  worldBowlSpots();
  const P = worldBowl.spots[node] || { x: 0, y: 0 },
    { north, east } = bowlCompass(P.x, P.y, P.up),
    eye = bowlSurface(P.x, P.y) + 0.004,
    px = new Uint8Array(BOWL_WALL_W * 4 * 4);
  for (let k = 0; k < BOWL_WALL_W; k++) {
    /* the shader's longitude: atan(d.z, d.x), u = lon / 2pi + .5 */
    const lon = (k / BOWL_WALL_W - 0.5) * 2 * Math.PI,
      ce = Math.cos(lon),
      cn = Math.sin(lon),
      dx = east[0] * ce + north[0] * cn,
      dy = east[1] * ce + north[1] * cn;
    let best = -1,
      bx = P.x,
      by = P.y;
    for (let s = 0.06; s < 2.6; s += 0.015) {
      const x = P.x + dx * s,
        y = P.y + dy * s;
      if (Math.hypot(x, y) > BOWL_GROUND_EXTENT) break;
      const el = (Math.max(bowlSurface(x, y), bowlWaterLevel(x, y)) - eye) / s;
      if (el > best) {
        best = el;
        bx = x;
        by = y;
      }
    }
    const top = best > 0 ? Math.sin(Math.atan(best)) : 0,
      c = worldBowl.ground.G.c && bowlCoastAt(worldBowl.ground.G, bx, by) > 0 ? BOWL_SEA_FAR : worldBowlColorAt(bx, by);
    for (let row = 0; row < 4; row++) {
      const o = (row * BOWL_WALL_W + k) * 4;
      px[o] = Math.round(Math.min(1, c[0]) * 255);
      px[o + 1] = Math.round(Math.min(1, c[1]) * 255);
      px[o + 2] = Math.round(Math.min(1, c[2]) * 255);
      px[o + 3] = Math.round(Math.min(1, top / 0.6) * 255);
    }
  }
  if (worldBowl.wall && worldBowl.wall.gl === gl) gl.deleteTexture(worldBowl.wall.t);
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, BOWL_WALL_W, 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  worldBowl.wall = { node, gl, t };
  return t;
}

/* ---------- ready before it shows (the owner: "every time the world map opens it hasn't fully loaded yet") ----------
   Everything the map shows is in: the island's own heights (their arrival works the ground out again), the terrain map
   and its pictures, each place's map stamped, the things' shapes and pictures on the GPU and their shadows. */
export function worldBowlReady() {
  const g = worldBowl.ground,
    T = g && g.terrain,
    W = g && g.things,
    id = worldBowl.islandLoading,
    M = id && gameData.maps && gameData.maps[id];
  if (M && bowlHasCoast(M) && !bowlIslandHeights(M)) return false;
  if (!g || !g.ok || !T || !T.ready || T.loading || !T.pix || !W || !W.gpu || W.dirty) return false;
  for (let i = 0; i < LOCATIONS.length; i++) {
    const sp = worldBowl.spots[i];
    if (sp && !sp.under && !sp.off && !T.stamped.has(i)) return false;
  }
  return !!(g.shadow && g.shadow.ver === W.ver);
}
/* the map's slow parts done ahead, in idle time and without the GPU: the places, the island's own heights, the terrain
   map and its pictures, each place's map, the models' recipes and the pictures of things without one. The walk scene
   starts it in the hub, the opening fall as it begins. HB-2: done(ok) when it has finished (a run's loading screen
   waits on it, eager: on a timer, not in idle time, which a page drawing every frame seldom has); a second call while
   it works waits for the same end. */
const worldMapWarm = { on: false, eager: false, done: /** @type {((ok: boolean) => void)[]} */ ([]) };
export function worldMapPrewarm(done, eager) {
  if (done) worldMapWarm.done.push(done);
  if (eager) worldMapWarm.eager = true;
  if (worldMapWarm.on) return;
  const end = ok => {
    worldMapWarm.on = worldMapWarm.eager = false;
    for (const f of worldMapWarm.done.splice(0)) f(ok);
  };
  if (!worldMapWanted()) return end(false);
  worldMapWarm.on = true;
  const later = f =>
    worldMapWarm.eager || typeof requestIdleCallback !== 'function'
      ? setTimeout(f, worldMapWarm.eager ? 0 : 16)
      : requestIdleCallback(f, { timeout: 200 });
  let tries = 0;
  const step = () => {
    try {
      if (++tries > 4000) return end(false);
      worldBowlSpots();
      const g = worldBowl.ground,
        id = worldBowl.islandLoading,
        M = id && gameData.maps[id];
      /* the island's heights first: when they come the ground is worked out again */
      if (M && bowlHasCoast(M) && !bowlIslandHeights(M)) return later(step);
      const T = worldBowlTerrainStart();
      if (!T.ready) {
        const t0 = performance.now();
        if (!worldMapWarm.eager) T.fill(48);
        else
          do T.fill(16);
          while (!T.ready && performance.now() - t0 < 12);
        return later(step);
      }
      worldBowlStampMaps(T);
      if (!T.pix && !T.pixLoading) {
        T.pixLoading = true;
        worldBowlTerrainPictures(T).then(() => (worldBowl.dirty = true));
      }
      if (!g.warmThings) {
        const W = { inst: {}, stand: [], models: new Set(), counts: {} };
        LOCATIONS.forEach((l, i) => {
          const sp = worldBowl.spots[i];
          if (sp && !sp.under && !sp.off) worldBowlThingsOfPlace(W, i);
        });
        for (const m of W.models) loadPropModelRecipe(m);
        const A = (gameData.scenery && gameData.scenery.props) || {},
          imgs = [...new Set(W.stand.map(q => A[q.k] && A[q.k].img).filter(Boolean))];
        if (imgs.length) Promise.resolve(artLoad(imgs)).catch(() => {});
        g.warmThings = true;
      }
      end(true);
    } catch (e) {
      console.error(e);
      end(false);
    }
  };
  later(step);
}
/* the opening fall's frame (opening-fall.js): the floating island's middle, radius and height, and where you land
   (outside Professor Chosen's lab); null without the floating island */
export function worldMapFallFrame() {
  worldBowlSpots();
  const F = worldBowlFloatIsland();
  if (!F) return null;
  const M = gameData.maps[worldBowl.ground.islandMap],
    s = worldBowl.spots[F.i],
    lab = (M.props || []).find(p => p.k === 'lab'),
    [x, y] = lab ? bowlMapPoint(s, M, lab.x, lab.z, BOWL_METRES) : F.c;
  return { c: F.c, r: F.r, top: F.top, land: [x, y, Math.max(F.top, bowlSurface(x, y))] };
}
/* everything the map shows is in (for the opening fall, which films it) */
export function worldMapReadyNow() {
  return worldBowlReady();
}
/* ---------- mount, size, loop ---------- */
/* the bowl needs WebGL 2; without it the Map tab shows the Places list */
export function worldMapWanted() {
  return typeof gpuState !== 'undefined' && !gpuState.fail && !gpuState.lost && webgl2Supported();
}
function worldMapCanvasGl() {
  if (!worldMapWanted()) return false;
  let cv = $('#dio');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'dio';
    document.body.prepend(cv);
  }
  if (gpuState.cv !== cv) {
    if (walkView.cv && walkView.cv !== cv) return false;
    if (!initWebgl(cv)) {
      gpuState.fail = 1;
      return false;
    }
    if (typeof walkRenderer !== 'undefined') {
      walkRenderer.gkey = '';
      walkRenderer.farKey = '';
    }
  }
  if (!gpuState.P.msky) gpuLoading();
  try {
    ensurePrograms(WORLD_BOWL_SHADERS);
    ensurePrograms(POST_EFFECT_SHADERS);
  } catch (e) {
    console.error(e);
    gpuState.fail = 1;
    return false;
  }
  cv.hidden = false;
  cv.classList.add('gl', 'in');
  return true;
}
export function worldMapMount() {
  const cv = $('#mapcv');
  worldBowl.on = false;
  if (!cv) return;
  worldMap.cv = cv;
  worldMap.ctx = cv.getContext('2d');
  if (!worldMapCanvasGl()) {
    /* no WebGL here: the Places list is the map */
    worldMap.gl = false;
    document.body.classList.remove('map-gl', 'map-bowl');
    worldMap.list = true;
    worldMapChrome();
    worldMapFade(false);
    return;
  }
  worldBowl.on = true;
  worldMap.gl = true;
  document.body.classList.add('map-gl', 'map-bowl');
  worldMapSize();
  worldBowlSpots();
  const me = worldBowl.spots[saveData.trip.node] || { x: 0, y: 0, h: 0 },
    FI = worldBowlFloatCam(),
    yaw = worldBowl.cam ? worldBowl.cam.yaw : Math.hypot(me.x, me.y) > 0.05 ? Math.atan2(me.x, me.y) : 0,
    home = FI ? worldBowlFloatHome(FI, yaw) : bowlCamHome(me.x, me.y, yaw);
  if (worldBowl.cam) worldBowl.cam = bowlCamClamp(worldBowl.cam);
  worldBowl.idle = 0;
  if (FI && !(typeof airshipFlight !== 'undefined' && airshipFlight.on)) {
    /* the floating island: from close over where you stand, swing out round to the orbit's view */
    if (uiState.mglFrom === 'walk' && !reducedMotion) {
      worldBowl.cam = { ...home, tilt: FLOAT_CAMERA.tiltMax, dist: FI.r * FLOAT_CAMERA.distMin, yaw: home.yaw - 0.5 };
      worldBowl.goal = null;
      worldBowl.tween = { from: worldBowl.cam, to: home, t0: null, dur: 1500 };
    } else {
      worldBowl.cam = reducedMotion || !worldBowl.cam ? home : worldBowl.cam;
      worldBowl.goal = null;
      worldBowl.tween = null;
    }
  } else if (typeof airshipFlight !== 'undefined' && airshipFlight.on) {
    /* the flight: from above where it takes off, far enough out to see the way */
    const A = worldBowl.spots[airshipFlight.a] || me;
    worldBowl.cam = bowlCamClamp({ ...bowlCamHome(A.x, A.y, yaw), dist: Math.max(1, airshipFlight.span || 1) });
    worldBowl.goal = null;
    worldBowl.tween = null;
  } else if (uiState.mglFrom === 'walk' && !reducedMotion) {
    /* from the walk scene: start right above you, looking down, and pull back to the usual view */
    worldBowl.cam = { tx: me.x, ty: me.y, yaw: home.yaw, tilt: 1.35, dist: 0.035 };
    worldBowl.goal = null;
    worldBowl.tween = { from: worldBowl.cam, to: home, t0: null, dur: 1300 };
  } else if (!worldBowl.cam) {
    worldBowl.cam = reducedMotion ? home : bowlCamOverview(home.yaw);
    worldBowl.goal = reducedMotion ? null : home;
  }
  uiState.mglFrom = null;
  worldBowl.sel = uiState.mapSel;
  worldMapBind(cv);
  worldMapChrome();
  worldBowl.dirty = true;
  worldBowl.fadeOut = true;
  worldBowl.fadeAt = null;
  /* covered until everything it shows is in (worldBowlReady) */
  if (!worldBowlReady()) worldMapFade(true, true);
  frameTask('map', worldMapLoop);
}
function worldMapSize() {
  const cv = worldMap.cv,
    r = cv && cv.isConnected ? cv.getBoundingClientRect() : null,
    w = Math.round(r && r.width > 20 ? r.width : innerWidth),
    h = Math.round(r && r.height > 20 ? r.height : innerHeight);
  if (w !== worldMapWidth || h !== worldMapHeight) {
    worldMapWidth = w;
    worldMapHeight = h;
    worldBowl.dirty = true;
  }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  if (cv && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  worldMap.dpr = dpr;
}
export function worldMapFit() {
  worldMapSize();
  worldBowl.dirty = true;
}
export function worldMapZoom(k) {
  if (!worldBowl.on) return;
  worldBowl.tween = null;
  worldBowl.goal = bowlCamZoom(worldBowl.goal || worldBowl.cam, k);
  worldBowl.dirty = true;
}
/* Home: back over where you are */
export function worldMapReset() {
  if (!worldBowl.on) return;
  const me = worldBowlSpots()[saveData.trip.node],
    FI = worldBowlFloatCam();
  worldBowl.tween = null;
  worldBowl.goal = FI ? worldBowlFloatHome(FI, worldBowl.cam.yaw) : bowlCamHome(me.x, me.y, worldBowl.cam.yaw);
  worldBowl.dirty = true;
}
/* pick a place: its card, and the camera comes over it */
export function worldMapSelect(n) {
  uiState.mapSel = n;
  if (typeof paintWorldMapCard === 'function') paintWorldMapCard();
  if (worldMap.list) worldMapChrome();
  worldBowl.dirty = true;
}
const worldBowlFlying = () => typeof airshipFlight !== 'undefined' && airshipFlight.on;
function worldMapLoop(ts) {
  if (!worldBowl.on || !worldMap.cv || !worldMap.cv.isConnected) {
    worldBowl.on = false;
    document.body.classList.remove('map-bowl');
    frameStop('map');
    worldMapBackToWalk();
    return;
  }
  if (gpuState.lost) return;
  const dt = Math.min(100, ts - (worldBowl.lastT || ts));
  worldBowl.lastT = ts;
  let moving = !!(worldBowl.drag || worldBowl.bench);
  /* the airship: its place on the way, and the camera keeping it in view */
  if (typeof airshipFlight !== 'undefined' && airshipFlight.on && typeof flyTick === 'function') {
    if (flyTick(ts) && airshipFlight.pos) {
      const p = airshipFlight.pos,
        c = worldBowl.cam;
      worldBowl.goal = bowlCamClamp({ ...c, tx: p[0], ty: p[1], dist: Math.max(c.dist, airshipFlight.span || 1) });
    }
    moving = true;
  }
  /* a new pick (the card, the Places list): bring the camera over it, keeping the turn and not zooming out */
  if (uiState.mapSel !== worldBowl.sel) {
    worldBowl.sel = uiState.mapSel;
    const s = typeof worldBowl.sel === 'number' ? worldBowl.spots[worldBowl.sel] : null;
    if (s && !worldBowl.drag) {
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.tween = null;
      worldBowl.goal = bowlCamClamp({ ...c, tx: s.x, ty: s.y, dist: Math.min(c.dist, 1.3) });
    }
    worldBowl.dirty = true;
  }
  if (worldBowl.bench && worldBowl.bench.turn)
    worldBowl.cam = bowlCamTurn(worldBowl.cam, (worldBowl.bench.turn * dt) / 1000, 0);
  /* the floating island turns slowly while nobody touches the map (after 4 s; none with reduced motion) */
  if (worldBowl.drag || worldBowl.tween || worldBowl.goal || worldBowlFlying()) worldBowl.idle = 0;
  else worldBowl.idle = (worldBowl.idle || 0) + dt;
  if (worldBowlFloats() && !reducedMotion && worldBowl.idle > 4000 && !worldBowl.bench) {
    worldBowl.cam = bowlCamTurn(worldBowl.cam, (FLOAT_CAMERA.drift * dt) / 1000, 0);
    moving = true;
  }
  if (worldBowl.fadeOut) {
    if (worldBowl.fadeAt == null) worldBowl.fadeAt = ts;
    moving = true;
  }
  if (worldBowl.tween) {
    const T = worldBowl.tween;
    /* the move starts once the map shows */
    if (T.t0 == null && !worldBowl.fadeOut) T.t0 = ts;
    const k = T.t0 == null ? 0 : Math.min(1, (ts - T.t0) / T.dur),
      e = 1 - Math.pow(1 - k, 3);
    worldBowl.cam = bowlCamEase(T.from, T.to, e);
    if (k >= 1) worldBowl.tween = null;
    moving = true;
  } else if (worldBowl.goal) {
    worldBowl.cam = bowlCamEase(worldBowl.cam, worldBowl.goal, reducedMotion ? 1 : 1 - Math.exp(-dt / 110));
    if (bowlCamGap(worldBowl.cam, worldBowl.goal) < 1e-3) {
      worldBowl.cam = worldBowl.goal;
      worldBowl.goal = null;
    }
    moving = true;
  }
  /* the sea moves: about 30 frames a second while it shows (still with reduced motion) */
  const beat = worldBowl.ground && worldBowl.ground.water && !reducedMotion ? 33 : 600,
    breathe = Math.floor(ts / beat) !== Math.floor((ts - dt) / beat);
  if (!moving && !worldBowl.dirty && !breathe) return;
  worldBowl.dirty = false;
  const w0 = performance.now();
  worldMapSize();
  worldBowl.view = bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight);
  worldBowlRender(ts);
  worldBowlOverlay(ts);
  const ms = performance.now() - w0;
  worldBowl.frames++;
  worldBowl.ms.push(ms);
  worldBowl.ts.push(ts);
  if (worldBowl.ms.length > 240) (worldBowl.ms.shift(), worldBowl.ts.shift());
  frameCount(ms);
  if (worldBowl.fadeOut && (worldBowlReady() || ts - (worldBowl.fadeAt || ts) > 5000)) {
    worldBowl.fadeOut = false;
    worldMapFade(false);
  }
}

/* ---------- drawing ---------- */
export function worldBowlRender(t) {
  const gl = gpuState.gl,
    cv = gpuState.cv,
    v = worldBowl.view,
    px = worldMapWidth * worldMapHeight,
    dp = Math.min(devicePixelRatio || 1, 1.75),
    R = dp * Math.min(1, Math.sqrt(1.4e6 / (px * dp * dp))),
    rw = Math.max(64, Math.round(worldMapWidth * R)),
    rh = Math.max(64, Math.round(worldMapHeight * R));
  if (cv.width !== rw || cv.height !== rh) {
    cv.width = rw;
    cv.height = rh;
  }
  /* HB-3: the World map settings are built into the floating island's meshes: when they change it is made again */
  const ms = worldBowlMapSettingsKey();
  if (worldBowl.mapSettings !== ms) {
    if (worldBowl.mapSettings != null && worldBowlFloats()) worldBowlReset();
    worldBowl.mapSettings = ms;
  }
  worldBowlSpots();
  const g = worldBowlGpu();
  const S = renderTarget('scene', rw, rh, { depth: true, hdr: true });
  gl.bindFramebuffer(gl.FRAMEBUFFER, S.f);
  gl.viewport(0, 0, rw, rh);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.disable(gl.BLEND);
  gl.disable(gl.CULL_FACE);
  /* the sky, at the very back */
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.ALWAYS);
  gl.depthMask(false);
  const FI = worldBowlFloatIsland();
  let p = FI ? gpuState.P.mskyf : gpuState.P.msky,
    U = p.U;
  gl.useProgram(p.p);
  bindQuad();
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uFw, v.fw);
  gl.uniform3fv(U.uRt, v.rt);
  gl.uniform3fv(U.uUp, v.up);
  const sky = worldBowlSkyTick(),
    sun = worldBowlSunNow(),
    FL = FI ? worldBowlFloatLook(sky) : null,
    haze = FL ? FL.haze : BOWL_HAZE.map((c, k) => c + ([0.12, 0.14, 0.26][k] - c) * sun.night);
  gl.uniform3fv(U.uSun, sun.pos);
  if (FL) {
    gl.uniform3fv(U.uTop, FL.sky[0]);
    gl.uniform3fv(U.uMid, FL.sky[1]);
    gl.uniform3fv(U.uLow, FL.sky[2]);
    gl.uniform3fv(U.uBelow, FL.below);
    gl.uniform3fv(U.uCloud, FL.cloud);
    gl.uniform3fv(
      U.uSunCol,
      FL.sunTint.map(c => c * 0.8)
    );
    gl.uniform1f(U.uStars, FL.stars);
    gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
    gl.uniform1f(U.uY0, FI.y0);
  } else {
    gl.uniform1f(U.uNight, sun.night);
    gl.uniform1f(U.uGrey, sky.greyHere || 0);
  }
  gl.uniform1f(U.uFoc, v.foc);
  gl.uniform1f(U.uR, rw / worldMapWidth);
  gl.uniform2f(U.uWH, worldMapWidth, worldMapHeight);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  /* the ground */
  gl.depthMask(true);
  gl.depthFunc(gl.LEQUAL);
  const VP = bowlCamMatrix(v);
  p = gpuState.P.mground;
  U = p.U;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uC, v.C);
  gl.uniform3fv(U.uLd, sun.ld);
  worldBowlShadowUniforms(U, g);
  worldBowlSkyUniforms(U, sky, sun);
  setPixelWaterUniform(U);
  gl.uniform3fv(U.uHaze, haze);
  const T = g.terrain || worldBowl.ground.terrain;
  gl.uniform1f(U.uOn, g.ok ? 1 : 0);
  gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
  gl.uniform2f(U.uWaterL, T && T.K.layer.w != null ? T.K.layer.w : -9, T && T.K.layer.d != null ? T.K.layer.d : -9);
  worldBowlIsleUniform(U, FI);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, g.ok ? T.tIdx : gpuState.white);
  gl.uniform1i(U.uIdx, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, g.ok ? T.tMix : gpuState.white);
  gl.uniform1i(U.uMix, 1);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.ok ? T.tLay : null);
  gl.uniform1i(U.uLay, 2);
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, g.lines ? g.lines.t : gpuState.white);
  gl.uniform1i(U.uRoute, 4);
  gl.activeTexture(gl.TEXTURE0);
  const land = FI && FI.fineGpu ? FI.fineGpu : g.mesh;
  gl.bindVertexArray(land.vao);
  gl.drawElements(gl.TRIANGLES, land.n, gl.UNSIGNED_INT, 0);
  /* the floating island's rock, under its land */
  if (FI) {
    const R = worldBowlFloatGpu(FI),
      K = T && T.K && T.K.layer,
      lay = k => (K && K[k] != null ? K[k] : -1);
    p = gpuState.P.mrock;
    U = p.U;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uC, v.C);
    gl.uniform3fv(U.uLd, sun.ld);
    gl.uniform3fv(U.uHaze, haze);
    gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
    gl.uniform1f(U.uOn, g.ok ? 1 : 0);
    gl.uniform3f(U.uRockL, lay('r'), lay('u'), lay('g'));
    worldBowlShadowUniforms(U, g);
    worldBowlSkyUniforms(U, sky, sun);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, g.ok ? T.tLay : null);
    gl.uniform1i(U.uLay, 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(R.vao);
    gl.drawArrays(gl.TRIANGLES, 0, R.n);
  }
  /* the sea over it, see-through in the shallows */
  if (g.water) {
    p = gpuState.P.mwater;
    U = p.U;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uC, v.C);
    gl.uniform3fv(U.uLd, sun.ld);
    worldBowlShadowUniforms(U, g);
    worldBowlSkyUniforms(U, sky, sun);
    setPixelWaterUniform(U);
    gl.uniform3fv(U.uHaze, haze);
    gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
    gl.uniform1f(U.uRim, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(g.water.vao);
    gl.drawElements(gl.TRIANGLES, g.water.n, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  /* HB-3: its falls, see-through, under the lagoon's mist */
  if (FI && FI.fallsGpu) {
    p = gpuState.P.mfallw;
    U = p.U;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uC, v.C);
    gl.uniform3fv(U.uHaze, haze);
    gl.uniform3fv(U.uRimCol, FL ? FL.cloud : haze);
    gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
    gl.uniform1f(U.uLight, sun.light);
    gl.uniform1f(U.uNight, sun.night);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(FI.fallsGpu.vao);
    gl.drawElements(gl.TRIANGLES, FI.fallsGpu.n, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  /* HB-3: the floating island's lagoon, fading at its rim into the sea of clouds' colour */
  if (FI && FI.waterGpu) {
    p = gpuState.P.mwater;
    U = p.U;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uC, v.C);
    gl.uniform3fv(U.uLd, sun.ld);
    worldBowlShadowUniforms(U, g);
    worldBowlSkyUniforms(U, sky, sun);
    gl.uniform3fv(U.uHaze, haze);
    gl.uniform1f(U.uT, reducedMotion ? 0 : (t % 600000) / 1000);
    gl.uniform1f(U.uRim, 1);
    gl.uniform3fv(U.uRimCol, FL ? FL.cloud : haze);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.bindVertexArray(FI.waterGpu.vao);
    gl.drawElements(gl.TRIANGLES, FI.waterGpu.n, gl.UNSIGNED_INT, 0);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  if (FI && FI.mist) worldBowlMistDraw(FI, sky, VP, v, sun, haze);
  /* the landmarks, buildings and trees */
  if (g.things && g.things.gpu) worldBowlThingsDraw(g.things, VP, { v, sun, sky, haze }, false);
  /* rain, snow and ash, then the clouds over everything (the floating island: its calm sky alone) */
  if (FI) {
    sky.shadowN = 0;
    sky.shown = 0;
  } else worldBowlDrawSky(sky, sun, VP, v, haze);
  gl.bindVertexArray(null);
  const fd = Math.max(0.05, worldBowl.cam ? worldBowl.cam.dist : 1);
  drawPostEffects(
    S,
    { near: BOWL_CAMERA.near, far: BOWL_CAMERA.far, df: fd * 1.6, F: (v.foc * rw) / worldMapWidth },
    fd,
    rw,
    rh,
    {
      blur: 0,
      fast: rw * rh > 1.2e6,
      noAO: true,
      sun: projectToScreenUv(VP, sun.pos),
      sunCol: FL
        ? FL.sunTint.map(c => c * 0.7)
        : [1, 0.9 - 0.5 * sun.night, 0.7 - 0.5 * sun.night].map(c => c * sun.light),
    }
  );
}
/* ---------- the sky: the game's weather, clouds, rain and snow, the Inner Sun's day (look session 3) ---------- */
/* the sun now: where it hangs and the way to it in GPU space, how strong its light is, how far into the night */
export function worldBowlSunNow() {
  const s = worldBowl.skyState,
    b = s && s.sun ? s.sun : bowlSunAt(13, 0),
    night = s ? s.night || 0 : 0;
  return { pos: bowlToGpu(...b.at), ld: bowlToGpu(...b.dir), dir: b.dir, light: b.light, night, az: b.az };
}
/* the weather per place (each place's own, from its kind of place) every few seconds, eased so fronts build and
   clear; the clouds for the setting; the sun from the clock. Returns the frame's sky. */
function worldBowlSkyTick() {
  const S =
    worldBowl.skyState ||
    (worldBowl.skyState = { level: null, clouds: [], grid: null, target: null, at: -1e9, last: 0, flash: 0 });
  const pref = (saveData && saveData.preferences) || {},
    level = bowlCloudLevel(pref.mapClouds, pref.aim),
    now = performance.now(),
    dt = Math.min(0.1, (now - (S.last || now)) / 1000);
  S.last = now;
  /* RL-8b: another world's seed lays the clouds out again (7 as made) */
  const cseed = 7 + ((worldBowl.ground && worldBowl.ground.F && worldBowl.ground.F.seed) || 0);
  if (level !== S.level || cseed !== S.seed) {
    S.level = level;
    S.seed = cseed;
    S.clouds = bowlCloudLayout(level, cseed);
    S.parts = null;
  }
  if (now - S.at > 5000) {
    S.at = now;
    const spots = worldBowlSpots(),
      P = [];
    LOCATIONS.forEach((l, i) => {
      const s = spots[i];
      if (!s || s.under || s.off) return;
      const st = environmentState((gameData.maps && gameData.maps[l.mapId]) || null);
      P.push({ x: s.x, y: s.y, look: WEATHER_LOOKS[st.wx] || WEATHER_LOOKS.clear, wx: st.wx });
    });
    S.places = P;
    S.target = bowlSkyGrid(P, 32);
    if (!S.grid) S.grid = { n: 32, v: S.target.v.slice() };
    const me = LOCATIONS[saveData && saveData.trip ? saveData.trip.node : 0],
      st = environmentState((me && gameData.maps && gameData.maps[me.mapId]) || null);
    S.hour = st.h;
    S.night = st.night;
    S.sun = bowlSunAt(st.h, st.night);
  }
  /* fronts: the sky eases towards the weather over about half a minute (at once the first time) */
  const k = 1 - Math.exp(-dt / 8);
  for (let q = 0; q < S.grid.v.length; q++) S.grid.v[q] += (S.target.v[q] - S.grid.v[q]) * k;
  S.dt = dt;
  S.flash *= Math.exp(-dt * 14);
  const at = worldBowl.cam ? worldBowlSkyAt(worldBowl.cam.tx, worldBowl.cam.ty) : null;
  S.greyHere = at ? at.grey : 0;
  return S;
}
/* the eased weather at a point (the nearest cell of the sky's grid) */
function worldBowlSkyAt(x, y) {
  const S = worldBowl.skyState,
    G = S && S.grid;
  if (!G) return { cloud: 0.35, grey: 0, rain: 0, storm: 0, snow: 0, fog: 0, ash: 0 };
  const n = G.n,
    i = Math.max(0, Math.min(n - 1, Math.floor(((x + 1) / 2) * n))),
    j = Math.max(0, Math.min(n - 1, Math.floor(((1 - y) / 2) * n))),
    o = (j * n + i) * BOWL_SKY_KEYS.length,
    out = {};
  BOWL_SKY_KEYS.forEach((key, q) => (out[key] = G.v[o + q]));
  return out;
}
/* the sky's uniforms for the ground and the water: light, night, lightning, cloud shadows, the weather map */
function worldBowlSkyUniforms(U, S, sun) {
  const gl = gpuState.gl,
    FL = worldBowlFloats() ? worldBowlFloatLook(S) : null;
  gl.uniform1f(U.uLight, FL ? 1 : sun.light);
  gl.uniform1f(U.uNight, FL ? FL.night : sun.night);
  if (U.uTodOn) gl.uniform1f(U.uTodOn, FL ? 1 : 0);
  if (U.uSunTint) gl.uniform3fv(U.uSunTint, FL ? FL.sunTint : [1, 1, 1]);
  if (U.uAmbTint) gl.uniform3fv(U.uAmbTint, FL ? FL.ambTint : [1, 1, 1]);
  gl.uniform1f(U.uFlash, S.flash || 0);
  gl.uniform4fv(U.uCs, S.shadows || new Float32Array(160));
  gl.uniform1i(U.uCn, S.shadowN || 0);
  if (!S.tex || S.tex.gl !== gl) {
    S.tex = { gl, t: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D, S.tex.t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    S.texAt = -1;
  }
  gl.activeTexture(gl.TEXTURE5);
  gl.bindTexture(gl.TEXTURE_2D, S.tex.t);
  if (S.texAt !== S.last) {
    /* the weather map: cloud, rain, fog (and ash haze), snow */
    S.texAt = S.last;
    const n = S.grid.n,
      K = BOWL_SKY_KEYS.length,
      px = new Uint8Array(n * n * 4);
    for (let q = 0; q < n * n; q++) {
      const v = S.grid.v,
        o = q * K;
      px[q * 4] = Math.min(255, v[o] * 255);
      px[q * 4 + 1] = Math.min(255, (v[o + 2] / 1.6) * 255);
      px[q * 4 + 2] = Math.min(255, (v[o + 5] + v[o + 6] * 0.5) * 255);
      px[q * 4 + 3] = Math.min(255, v[o + 4] * 255);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
  gl.uniform1i(U.uSky, 5);
  gl.activeTexture(gl.TEXTURE0);
}
/* a low-poly puff: an icosahedron, each face flat (its own normal) */
function worldBowlPuffMesh() {
  const t = (1 + Math.sqrt(5)) / 2,
    V = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ].map(v => v.map(c => c / Math.hypot(...v))),
    F = [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
    out = [];
  for (const [a, b, c] of F) {
    const n = [0, 1, 2].map(k => V[a][k] + V[b][k] + V[c][k]),
      l = Math.hypot(...n);
    for (const q of [a, b, c]) out.push(...V[q], ...n.map(x => x / l));
  }
  return new Float32Array(out);
}
/* the sky's GPU parts: the puff, the clouds' instances, the falling weather's lines */
function worldBowlSkyGpu(S) {
  const gl = gpuState.gl;
  if (S.gpu && S.gpu.gl === gl) return S.gpu;
  const G = {
    gl,
    vao: gl.createVertexArray(),
    inst: gl.createBuffer(),
    fvao: gl.createVertexArray(),
    fall: gl.createBuffer(),
  };
  const puff = worldBowlPuffMesh(),
    vb = gl.createBuffer();
  gl.bindVertexArray(G.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, puff, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
  gl.bindBuffer(gl.ARRAY_BUFFER, G.inst);
  for (const [loc, off] of [
    [4, 0],
    [5, 16],
  ]) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, off);
    gl.vertexAttribDivisor(loc, 1);
  }
  G.nPuff = puff.length / 6;
  gl.bindVertexArray(G.fvao);
  gl.bindBuffer(gl.ARRAY_BUFFER, G.fall);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(6);
  gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 16, 12);
  gl.bindVertexArray(null);
  S.gpu = G;
  return G;
}
/* where the ground or the water is under a point (clouds float above whichever is higher) */
function worldBowlSkyFloor(x, y) {
  const F = worldBowl.ground && worldBowl.ground.float,
    h = F && F.fine ? floatGroundHeight(F.fine, x, y) : null;
  if (h != null) return Math.max(h, bowlWaterLevel(x, y));
  return Math.max(bowlSurface(x, y), bowlWaterLevel(x, y));
}
/* the clouds this frame: which show, their puffs as instances (back to front), their shadows on the ground */
function worldBowlCloudsNow(S, sun, eye, t) {
  const L = BOWL_CLOUD_LEVELS[S.level],
    cam = worldBowl.cam,
    /* zoomed right in, the clouds clear away so they never hide a town */
    near = cam ? Math.max(0, Math.min(1, (cam.dist - 0.12) / 0.3)) : 1,
    inst = [],
    shadows = new Float32Array(160);
  let ns = 0;
  S.shown = 0;
  S.showing = [];
  for (const c of S.clouds) {
    const [x, y] = bowlCloudAt(c, t),
      w = worldBowlSkyAt(x, y),
      show = bowlCloudShow(c, w) * near;
    if (show < 0.02) continue;
    S.shown++;
    const lift = L.layers[c.layer] || 0.07,
      floor = worldBowlSkyFloor(x, y),
      dark = Math.min(1, w.grey * 0.55 + w.storm * 0.45),
      flat = c.layer > 0 ? 0.32 : 0.55,
      ang = Math.atan2(y, x) + Math.PI / 2;
    S.showing.push({ c, x, y, w, lift, show });
    for (const p of c.puffs) {
      const px = x + p.dx * Math.cos(ang) - p.dy * Math.sin(ang),
        py = y + p.dx * Math.sin(ang) + p.dy * Math.cos(ang),
        G = bowlToGpu(px, py, floor + lift + p.dh);
      inst.push({
        d: Math.hypot(G[0] - eye[0], G[1] - eye[1], G[2] - eye[2]),
        v: [G[0], G[1], G[2], p.s, show * (c.layer > 0 ? 0.7 : 0.93), dark, flat, 0],
      });
    }
    /* its shadow: where the light through it meets the ground */
    if (ns < 40 && sun.dir[2] > 0.1) {
      const k = lift / sun.dir[2];
      shadows.set(
        [x - sun.dir[0] * k, y - sun.dir[1] * k, c.size * 1.25, show * (0.3 + 0.3 * dark) * sun.light],
        ns * 4
      );
      ns++;
    }
  }
  inst.sort((a, b) => b.d - a.d);
  S.shadows = shadows;
  S.shadowN = ns;
  S.inst = new Float32Array(inst.length * 8);
  inst.forEach((q, i) => S.inst.set(q.v, i * 8));
  S.nInst = inst.length;
}
/* rain, snow and ash: each drop belongs to a cloud that is raining (or snowing, or dropping ash) and falls from it to
   the ground, then starts again under a raining cloud */
function worldBowlFallNow(S, dt) {
  const L = BOWL_CLOUD_LEVELS[S.level],
    n = reducedMotion ? 0 : L.particles;
  if (!n) {
    S.nFall = 0;
    return;
  }
  if (!S.parts || S.parts.n !== n)
    S.parts = {
      n,
      x: new Float32Array(n),
      y: new Float32Array(n),
      h: new Float32Array(n),
      kind: new Int8Array(n).fill(-1),
      top: new Float32Array(n),
    };
  const P = S.parts,
    wet = S.showing.filter(q => q.w.rain + q.w.snow + q.w.ash > 0.15),
    total = wet.reduce((a, q) => a + q.show * (q.w.rain + q.w.snow + q.w.ash), 0),
    out = new Float32Array(n * 8);
  for (let i = 0; i < n; i++) {
    const speed = P.kind[i] === 0 ? 0.09 : 0.012;
    P.h[i] -= speed * dt;
    if (P.kind[i] < 0 || P.h[i] <= 0) {
      P.kind[i] = -1;
      if (total > 0 && Math.random() < 0.5) {
        let r = Math.random() * total,
          q = wet[0];
        for (const o of wet) {
          r -= o.show * (o.w.rain + o.w.snow + o.w.ash);
          if (r <= 0) {
            q = o;
            break;
          }
        }
        const a = Math.random() * Math.PI * 2,
          d = Math.sqrt(Math.random()) * q.c.size * 1.1,
          sw = q.w.rain + q.w.snow + q.w.ash,
          pick = Math.random() * sw;
        P.x[i] = q.x + Math.cos(a) * d;
        P.y[i] = q.y + Math.sin(a) * d;
        P.kind[i] = pick < q.w.rain ? 0 : pick < q.w.rain + q.w.snow ? 1 : 2;
        P.top[i] = q.lift * 0.85;
        P.h[i] = P.top[i] * (0.3 + Math.random() * 0.7);
      }
    }
    if (P.kind[i] < 0) continue;
    const floor = worldBowlSkyFloor(P.x[i], P.y[i]),
      len = P.kind[i] === 0 ? 0.012 : 0.0018,
      sway = P.kind[i] === 0 ? 0 : Math.sin(P.h[i] * 900 + i) * 0.0012,
      A = bowlToGpu(P.x[i] + sway, P.y[i], floor + P.h[i] + len),
      B = bowlToGpu(P.x[i] + sway, P.y[i], floor + P.h[i]);
    out.set([...A, P.kind[i], ...B, P.kind[i]], i * 8);
  }
  S.fall = out;
  S.nFall = n * 2;
}
/* draws the falling weather and the clouds (blended, after the ground and the water) */
function worldBowlDrawSky(S, sun, VP, v, haze) {
  if (!S.clouds.length) {
    S.shadowN = 0;
    S.shown = 0;
    return;
  }
  const gl = gpuState.gl,
    G = worldBowlSkyGpu(S),
    t = (performance.now() - (S.t0 || (S.t0 = performance.now()))) / 1000 + 1e5;
  worldBowlCloudsNow(S, sun, v.C, reducedMotion ? 1e5 : t);
  worldBowlFallNow(S, S.dt || 0);
  /* lightning, now and then, under a storm (High only) */
  if (BOWL_CLOUD_LEVELS[S.level].lightning && !reducedMotion)
    for (const q of S.showing) if (q.w.storm > 0.5 && Math.random() < (S.dt || 0) * 0.08 * q.show) S.flash = 1;
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  if (S.nFall) {
    const p = gpuState.P.mfall;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.U.uVP, false, VP);
    gl.uniform1f(p.U.uNight, sun.night);
    gl.bindVertexArray(G.fvao);
    gl.bindBuffer(gl.ARRAY_BUFFER, G.fall);
    gl.bufferData(gl.ARRAY_BUFFER, S.fall, gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.LINES, 0, S.nFall);
  }
  if (S.nInst) {
    const p = gpuState.P.mcloud,
      U = p.U;
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uC, v.C);
    gl.uniform3fv(U.uLd, sun.ld);
    gl.uniform3fv(U.uHaze, haze);
    gl.uniform1f(U.uLight, sun.light);
    gl.uniform1f(U.uNight, sun.night);
    gl.uniform1f(U.uFlash, S.flash || 0);
    gl.uniform1f(U.uNear, 0.03);
    gl.bindVertexArray(G.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, G.inst);
    gl.bufferData(gl.ARRAY_BUFFER, S.inst, gl.DYNAMIC_DRAW);
    gl.enable(gl.CULL_FACE);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, G.nPuff, S.nInst);
    gl.disable(gl.CULL_FACE);
  }
  gl.bindVertexArray(null);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
/* HB-3: the mist along the floating island's lagoon rim, as low flat cloud puffs (the clouds' own shape and shader;
   the floating island has no weather clouds, so their instance buffer is free), back to front */
function worldBowlMistDraw(F, S, VP, v, sun, haze) {
  const gl = gpuState.gl,
    G = worldBowlSkyGpu(S),
    eye = v.C,
    order = F.mist
      .map(q => ({ q, d: Math.hypot(q.g[0] - eye[0], q.g[1] - eye[1], q.g[2] - eye[2]) }))
      .sort((a, b) => b.d - a.d),
    inst = new Float32Array(order.length * 8);
  /* the puff's corners reach about 1.9 from its middle */
  order.forEach(({ q }, k) => inst.set([q.g[0], q.g[1], q.g[2], q.s / 1.9, 0.42, 0, 0.2, 0], k * 8));
  const p = gpuState.P.mcloud,
    U = p.U;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(U.uVP, false, VP);
  gl.uniform3fv(U.uC, eye);
  gl.uniform3fv(U.uLd, sun.ld);
  gl.uniform3fv(U.uHaze, haze);
  gl.uniform1f(U.uLight, sun.light);
  gl.uniform1f(U.uNight, sun.night);
  gl.uniform1f(U.uFlash, 0);
  gl.uniform1f(U.uNear, 0.01);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.bindVertexArray(G.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, G.inst);
  gl.bufferData(gl.ARRAY_BUFFER, inst, gl.DYNAMIC_DRAW);
  gl.enable(gl.CULL_FACE);
  gl.drawArraysInstanced(gl.TRIANGLES, 0, G.nPuff, order.length);
  gl.disable(gl.CULL_FACE);
  gl.bindVertexArray(null);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}
/* the shadow map for a program that reads it (texture unit 3) */
function worldBowlShadowUniforms(U, g) {
  const gl = gpuState.gl,
    sh = g.shadow && g.shadow.t ? g.shadow : null;
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, sh ? sh.t : null);
  gl.uniform1i(U.uSh, 3);
  gl.uniform1f(U.uShOn, sh ? 1 : 0);
  if (sh) gl.uniformMatrix4fv(U.uSM, false, sh.SM);
  gl.activeTexture(gl.TEXTURE0);
}
/* the bowl seen from any eye, for the opening fall: the ground and the sky, no pins */
export function worldBowlFilm(view, t) {
  worldMapWidth = view.W;
  worldMapHeight = view.H;
  worldBowl.view = view;
  worldBowlRender(t);
  worldBowl.filmed++;
}
/* roads you're taking, pins, labels and you */
function worldBowlOverlay(t) {
  const c = worldMap.ctx,
    cv = worldMap.cv,
    d = worldMap.dpr,
    v = worldBowl.view;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.setTransform(d, 0, 0, d, 0, 0);
  c.lineJoin = c.lineCap = 'round';
  const at = s => bowlCamProject(v, bowlToGpu(s.x, s.y, s.h + 0.003));
  /* HB-1: on the floating island the place's pin stands at its hub (the town) and you where you stand, on its own
     ground (its spot is the map's middle, on the bowl's coarse grid) */
  const FI = worldBowlFloatIsland(),
    floatAt = pl => {
      const M = gameData.maps[worldBowl.ground.islandMap],
        s = FI && worldBowl.spots[FI.i];
      if (!M || !s) return null;
      const [x, y] = bowlYouPoint(s, M, pl, BOWL_METRES);
      return { x, y, h: worldBowlSkyFloor(x, y) };
    },
    floatPin = FI ? floatAt(null) : null,
    floatMe = FI ? floatAt(worldBowlWalkOnIsland()) : null;
  /* your trip, gold */
  const trip = [saveData.trip.node, ...saveData.trip.plan],
    flying = typeof airshipFlight !== 'undefined' && airshipFlight.on;
  if (trip.length > 1 && !flying) worldBowlLine(c, trip, '#FFE27A', 3.5, [10, 8], -t / 40);
  /* the way to the place picked */
  const sel = uiState.mapSel;
  if (typeof sel === 'number' && sel !== saveData.trip.node && !flying) {
    const tr = tripTo(sel);
    if (tr && tr.plan.length)
      worldBowlLine(c, [saveData.trip.node, ...tr.plan], 'rgba(255,255,255,.9)', 2.5, [4, 7], -t / 60);
  }
  /* each place: its pin, its name for towns (all when close, or picked), its state */
  const close = worldBowl.cam.dist < 0.8,
    tags = worldBowl.cam.dist < 0.62,
    dest = saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null;
  worldBowl.marks = [];
  LOCATIONS.forEach((l, i) => {
    const s = worldBowl.spots[i],
      base = at(floatPin && i === FI.i ? floatPin : s),
      rm = worldBowlRunMark(i);
    /* RL-7: a run's place the map doesn't show yet has no pin at all */
    if (!base || s.off || (rm && !rm.seen)) return;
    let top = { x: base.x, y: base.y - BOWL_PIN, z: base.z };
    if (rm) worldBowlRunPin(c, base.x, base.y, rm, i === sel);
    else if (s.under) {
      /* reached by lift: a small marker just under its parent, a dashed line up to it */
      const y = base.y + 26;
      c.setLineDash([3, 4]);
      c.strokeStyle = 'rgba(159,211,255,.9)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(base.x, base.y + 4);
      c.lineTo(base.x, y - 6);
      c.stroke();
      c.setLineDash([]);
      top = { x: base.x, y, z: base.z };
      worldBowlDot(c, top.x, top.y, 6, '#9fd3ff');
    } else if (tags && i !== sel && i !== saveData.trip.node) {
      /* close in, the ground speaks for itself: a small tag instead of a pin (the picked place and yours keep theirs) */
      top = { x: base.x, y: base.y - 6, z: base.z };
      worldBowlDot(c, base.x, base.y - 3, 3, canEnter(i) ? (l.town ? '#ffb46b' : '#8fd18a') : '#9a93a6');
    } else worldBowlPin(c, base.x, base.y, l, i);
    worldBowl.marks.push({ i, base, top, z: base.z });
    const here = i === saveData.trip.node,
      locked = !rm && !canEnter(i),
      fresh = !rm && !saveData.visited[i] && !locked;
    const ring = here && floatMe && i === FI.i ? at(floatMe) : here ? base : null;
    if (ring) {
      const k = 1 + 0.15 * Math.sin(t / 300);
      c.strokeStyle = 'rgba(255,226,122,.95)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.ellipse(ring.x, ring.y, 16 * k, 6 * k, 0, 0, 7);
      c.stroke();
    }
    if (i === sel) {
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(base.x, base.y, 20, 7.5, 0, 0, 7);
      c.stroke();
    }
    if (locked) worldBowlLock(c, top.x, top.y - 12);
    else if (fresh) worldBowlDot(c, top.x + 9, top.y - 6, 4, '#ff9ec4');
    if (i === dest && !here) worldBowlDot(c, top.x, top.y - 12, 5, '#FFE27A');
    /* a run's '?' place keeps its name to itself */
    if ((!rm || rm.seen > 1) && (l.town || i === sel || here || close)) {
      const y = (s.under ? top.y + 10 : top.y - 12) + (locked ? -12 : 0);
      c.font = `${l.town ? '700 ' : ''}${l.town ? 12 : 11}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(20,14,30,.75)';
      c.strokeText(l.name, top.x, y);
      c.fillStyle = locked ? '#cfc8d8' : '#fff8e8';
      c.fillText(l.name, top.x, y);
    }
  });
  /* the airship on its way, or you standing at your place */
  if (flying && typeof flyDraw === 'function') flyDraw(c, t, (x, y, h) => bowlCamProject(v, bowlToGpu(x, y, h)));
  else {
    const onIsle = floatMe && FI.i === saveData.trip.node,
      me = onIsle ? floatMe : worldBowl.spots[saveData.trip.node],
      pq = me && at(me),
      /* beside the place's pin on the bowl; on the floating island on your own spot */
      dx = onIsle ? 0 : 18;
    worldBowl.me = me ? { x: me.x, y: me.y, isle: !!onIsle } : null;
    if (pq) {
      const fr = personWalkFrames('me'),
        f = (fr.down || fr[Object.keys(fr)[0]])[0],
        k = 0.42,
        bob = Math.floor(t / 600) % 2;
      c.imageSmoothingEnabled = false;
      c.fillStyle = 'rgba(20,10,40,.35)';
      c.beginPath();
      c.ellipse(pq.x + dx, pq.y, 9, 3, 0, 0, 7);
      c.fill();
      c.drawImage(
        f,
        Math.round(pq.x + dx - (f.ax || f.width / 2) * k),
        Math.round(pq.y - (f.ay || f.height) * k + bob),
        Math.round(f.width * k),
        Math.round(f.height * k)
      );
    }
  }
}
/* a line along the roads between places, following the ground */
function worldBowlLine(c, nodes, col, w, dash, off) {
  const v = worldBowl.view;
  c.beginPath();
  let on = false;
  for (let k = 1; k < nodes.length; k++) {
    const A = worldBowl.spots[nodes[k - 1]],
      B = worldBowl.spots[nodes[k]];
    for (let s = 0; s <= 12; s++) {
      const x = A.x + ((B.x - A.x) * s) / 12,
        y = A.y + ((B.y - A.y) * s) / 12,
        q = bowlCamProject(v, bowlToGpu(x, y, bowlSurface(x, y) + 0.004));
      if (!q) {
        on = false;
        continue;
      }
      if (on) c.lineTo(q.x, q.y);
      else c.moveTo(q.x, q.y);
      on = true;
    }
  }
  c.setLineDash(dash);
  c.lineDashOffset = off;
  c.strokeStyle = col;
  c.lineWidth = w;
  c.stroke();
  c.setLineDash([]);
}
/* RL-7: a run's place on the bowl: its node's type and how much of it the map shows (run.map node seen: 0 nothing,
   1 a '?', 2 its type), and its state for the marker (logic/run-marks.js): where you stand, walked, shown, or '?';
   null for a hub place or outside a run */
export function worldBowlRunMark(i) {
  const run = saveData.run,
    l = LOCATIONS[i];
  if (!run || !run.map || !l || l.runNode == null || !run.map.nodes[l.runNode]) return null;
  const node = run.map.nodes[l.runNode],
    seen = i === saveData.trip.node ? 2 : node.seen || 0,
    state =
      i === saveData.trip.node ? 'current' : seen < 2 ? 'hidden' : run.path.includes(l.runNode) ? 'visited' : 'seen';
  return { seen, type: node.type, state };
}
/* the marker's colours from the UI's look (uiTheme.json through the page's custom properties), as the run parts' own
   markers take them (ui-run-kit.js pb-node): a fill per role and a darker edge. Read again when the look changes */
const runPinColors = { key: '', colors: /** @type {Record<string, {fill: string, edge: string}>} */ ({}) };
function worldBowlRunColors() {
  const cs = getComputedStyle(document.documentElement),
    v = (/** @type {string} */ k) => cs.getPropertyValue(k).trim(),
    P = v('--c-primary'),
    D = v('--c-danger'),
    G = v('--gold-b'),
    S = v('--c-surface'),
    T = v('--c-text'),
    key = [P, D, G, S, T].join('|');
  if (runPinColors.key !== key) {
    const rgb = (/** @type {string} */ col) => {
        const x = worldMap.ctx || document.createElement('canvas').getContext('2d');
        x.fillStyle = '#000';
        x.fillStyle = col;
        const h = String(x.fillStyle),
          m = h.match(/^#([0-9a-f]{6})$/i);
        return m
          ? [0, 2, 4].map(k => parseInt(m[1].slice(k, k + 2), 16))
          : (h.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
      },
      mix = (/** @type {string} */ a, /** @type {string} */ b, /** @type {number} */ k) => {
        const A = rgb(a),
          B = rgb(b);
        return `rgb(${A.map((c, n) => Math.round(c * k + B[n] * (1 - k))).join(',')})`;
      };
    runPinColors.key = key;
    runPinColors.colors = {
      primary: { fill: P, edge: mix(P, '#000', 0.55) },
      danger: { fill: D, edge: mix(D, '#000', 0.55) },
      gold: { fill: G, edge: mix(G, '#000', 0.5) },
      surface: { fill: S, edge: T },
      muted: { fill: mix(T, S, 0.22), edge: mix(T, S, 0.45) },
    };
  }
  return runPinColors.colors;
}
/* RL-7: a run's place's pin: the stalk, and its node's marker for a head (a '?' while the map shows only its row) */
function worldBowlRunPin(c, x, y, rm, picked) {
  const head = y - BOWL_PIN;
  c.fillStyle = 'rgba(20,10,40,.3)';
  c.beginPath();
  c.ellipse(x, y, 5, 2, 0, 0, 7);
  c.fill();
  c.strokeStyle = picked ? '#fff' : 'rgba(20,14,30,.75)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, head + 6);
  c.stroke();
  const look = runMarkDraw(c, x, head, rm.state === 'current' ? 22 : 18, rm.type, rm.state, worldBowlRunColors());
  if (look.glyph === '?') {
    c.font = '700 10px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = worldBowlRunColors().surface.fill;
    c.fillText('?', x, head + 0.5);
  }
}
/* a place's pin: a stalk standing on its spot and a round head, a house for a town; locked grey, here gold, picked
   white */
function worldBowlPin(c, x, y, l, i) {
  const locked = !canEnter(i),
    here = i === saveData.trip.node,
    head = y - BOWL_PIN,
    col = locked ? '#9a93a6' : here ? '#FFE27A' : l.town ? '#ffb46b' : '#8fd18a';
  c.fillStyle = 'rgba(20,10,40,.3)';
  c.beginPath();
  c.ellipse(x, y, 5, 2, 0, 0, 7);
  c.fill();
  c.strokeStyle = 'rgba(20,14,30,.75)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, head);
  c.stroke();
  worldBowlDot(c, x, head, l.town ? 8 : 6, uiState.mapSel === i ? '#ffffff' : col);
  if (l.town) {
    c.fillStyle = 'rgba(20,14,30,.85)';
    c.beginPath();
    c.moveTo(x - 4, head + 0.5);
    c.lineTo(x, head - 4);
    c.lineTo(x + 4, head + 0.5);
    c.closePath();
    c.fill();
    c.fillRect(x - 3, head, 6, 3.5);
  }
}
function worldBowlDot(c, x, y, r, col) {
  c.fillStyle = 'rgba(20,14,30,.6)';
  c.beginPath();
  c.arc(x, y, r + 1.5, 0, 7);
  c.fill();
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, r, 0, 7);
  c.fill();
}
function worldBowlLock(c, x, y) {
  c.fillStyle = 'rgba(20,14,30,.7)';
  c.fillRect(x - 6, y - 4, 12, 10);
  c.strokeStyle = 'rgba(20,14,30,.7)';
  c.lineWidth = 4;
  c.beginPath();
  c.arc(x, y - 4, 4, Math.PI, 0);
  c.stroke();
  c.fillStyle = '#d8d0e4';
  c.fillRect(x - 5, y - 3, 10, 8);
  c.strokeStyle = '#d8d0e4';
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y - 4, 4, Math.PI, 0);
  c.stroke();
}

/* ---------- touch, mouse and keys ---------- */
function worldMapBind(cv) {
  if (cv._bowlBound) return;
  cv._bowlBound = 1;
  cv.tabIndex = 0;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  const P = worldBowl.pts,
    flying = () => typeof airshipFlight !== 'undefined' && airshipFlight.on,
    two = () => {
      const [a, b] = [...P.values()];
      return {
        d: Math.hypot(a[0] - b[0], a[1] - b[1]),
        ang: Math.atan2(b[1] - a[1], b[0] - a[0]),
        my: (a[1] + b[1]) / 2,
      };
    };
  cv.addEventListener('pointerdown', e => {
    if (!worldBowl.on) return;
    if (flying()) {
      if (typeof flySkip === 'function') flySkip();
      return;
    }
    P.set(e.pointerId, [e.clientX, e.clientY]);
    worldBowl.goal = null;
    worldBowl.tween = null;
    worldBowl.drag = {
      x: e.clientX,
      y: e.clientY,
      cam: worldBowl.cam,
      view: worldBowl.view || bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight),
      turn: e.button === 2 || e.shiftKey || e.ctrlKey,
      moved: 0,
      g: null,
    };
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    const D = worldBowl.drag;
    if (!worldBowl.on || !D) return;
    if (P.has(e.pointerId)) P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size > 1) {
      const g = two();
      if (!D.g) {
        D.g = g;
        D.cam = worldBowl.cam;
      }
      let da = g.ang - D.g.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      worldBowl.cam = bowlCamTurn(bowlCamZoom(D.cam, D.g.d / Math.max(1, g.d)), -da, (g.my - D.g.my) * 0.004);
      D.moved = 1;
      worldBowl.dirty = true;
      return;
    }
    const dx = e.clientX - D.x,
      dy = e.clientY - D.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) D.moved = 1;
    if (!D.moved) return;
    /* the floating island: one finger orbits round it (across turns, up and down tilts), as the walk's orbit camera */
    worldBowl.cam =
      D.turn || worldBowlFloats() ? bowlCamTurn(D.cam, -dx * 0.006, dy * 0.004) : bowlCamPan(D.cam, D.view, dx, dy);
    worldBowl.dirty = true;
  });
  const up = e => {
    P.delete(e.pointerId);
    const D = worldBowl.drag;
    if (P.size) {
      /* one finger left of two: carry on dragging from here */
      if (D) {
        const [p] = [...P.values()];
        Object.assign(D, { g: null, x: p[0], y: p[1], cam: worldBowl.cam, view: worldBowl.view, turn: false });
      }
      return;
    }
    worldBowl.drag = null;
    worldBowl.dirty = true;
    if (D && !D.moved && e.type === 'pointerup' && worldBowl.on) worldBowlPick(e);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener(
    'wheel',
    e => {
      if (!worldBowl.on) return;
      e.preventDefault();
      if (e.shiftKey) worldBowl.cam = bowlCamTurn(worldBowl.cam, (e.deltaY || e.deltaX) * 0.003, 0);
      else worldBowl.cam = bowlCamZoom(worldBowl.cam, e.deltaY > 0 ? 1.12 : 0.89);
      worldBowl.goal = null;
      worldBowl.tween = null;
      worldBowl.dirty = true;
    },
    { passive: false }
  );
  cv.addEventListener('keydown', e => {
    if (!worldBowl.on) return;
    const k = e.key,
      v = worldBowl.view || bowlCamView(worldBowl.cam, worldMapWidth, worldMapHeight),
      c = worldBowl.cam;
    const fl = worldBowlFloats();
    if (fl && /^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|a|d|w|s)$/.test(k)) {
      e.preventDefault();
      worldBowl.tween = null;
      worldBowl.goal = bowlCamTurn(
        c,
        k === 'ArrowLeft' || k === 'a' ? -0.2 : k === 'ArrowRight' || k === 'd' ? 0.2 : 0,
        k === 'ArrowUp' || k === 'w' ? -0.1 : k === 'ArrowDown' || k === 's' ? 0.1 : 0
      );
      worldBowl.dirty = true;
      return;
    }
    const next =
      k === 'ArrowLeft' || k === 'a'
        ? bowlCamPan(c, v, 60, 0)
        : k === 'ArrowRight' || k === 'd'
          ? bowlCamPan(c, v, -60, 0)
          : k === 'ArrowUp' || k === 'w'
            ? bowlCamPan(c, v, 0, 60)
            : k === 'ArrowDown' || k === 's'
              ? bowlCamPan(c, v, 0, -60)
              : k === 'q'
                ? bowlCamTurn(c, -0.2, 0)
                : k === 'e'
                  ? bowlCamTurn(c, 0.2, 0)
                  : k === '+' || k === '='
                    ? bowlCamZoom(c, 0.8)
                    : k === '-'
                      ? bowlCamZoom(c, 1.25)
                      : null;
    if (!next) return;
    e.preventDefault();
    worldBowl.tween = null;
    worldBowl.goal = next;
    worldBowl.dirty = true;
  });
}
/* a tap: the nearest pin under the finger (its whole height counts), else the place nearest the ground tapped */
export function worldBowlPick(e) {
  const r = worldMap.cv.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top;
  let best = null,
    bd = 30;
  for (const m of worldBowl.marks || []) {
    const ax = m.base.x,
      ay = m.base.y,
      bx = m.top.x,
      by = m.top.y,
      L = (bx - ax) ** 2 + (by - ay) ** 2,
      k = L ? Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L)) : 0,
      dd = Math.hypot(x - (ax + (bx - ax) * k), y - (ay + (by - ay) * k)) + m.z * 2;
    if (dd < bd) {
      bd = dd;
      best = m.i;
    }
  }
  if (best === null) {
    const g = worldBowl.view && bowlPickGround(worldBowl.view, x, y);
    if (g) {
      let gd = 0.07;
      worldBowl.spots.forEach((s, i) => {
        const rm = worldBowlRunMark(i);
        if (s.under || s.off || (rm && !rm.seen)) return;
        const dd = Math.hypot(s.x - g[0], s.y - g[1]);
        if (dd < gd) {
          gd = dd;
          best = i;
        }
      });
    }
  }
  if (best !== null) worldMapSelect(best);
}

/* ---------- coming from a walk scene: the walk camera rises, then the bowl pulls back from right above you ---------- */
/* returns true when it takes the switch over (the Map tab opens a moment later) */
export function worldMapOpenFromWalk() {
  if (
    uiState.tab !== 'walk' ||
    reducedMotion ||
    worldBowl.opening ||
    !worldMapWanted() ||
    typeof walkRenderer === 'undefined' ||
    !walkRenderer.on
  )
    return false;
  worldBowl.opening = true;
  /* the walk camera's zoom, put back when you come back to the walk scene */
  worldBowl.walkZoom = walkRenderer.zoomT;
  walkRenderer.zoomT = clampZoom(walkRenderer.zoom * 3);
  worldMapFade(true);
  setTimeout(() => {
    worldBowl.opening = false;
    if (uiState.tab !== 'walk') return worldMapFade(false);
    uiState.mglFrom = 'walk';
    uiState.tab = 'map';
    uiState.mapSel = null;
    render();
    scrollTo(0, 0);
  }, 380);
  return true;
}
/* back in the walk scene: the walk camera's zoom as it was before the map, eased in from far out (the zoom out in
   reverse); without the zoom out it is just put back */
function worldMapBackToWalk() {
  const z = worldBowl.walkZoom;
  if (z == null || typeof walkRenderer === 'undefined' || uiState.tab !== 'walk') return;
  worldBowl.walkZoom = null;
  if (!reducedMotion) walkRenderer.zoom = clampZoom(z * 3);
  walkRenderer.zoomT = z;
}
/* a veil in the haze's colour over the switch, so the walk scene's last frame never cuts to the map */
/* full: covering the map while it loads (opaque), else the short veil of the zoom out from the walk scene */
function worldMapFade(on, full) {
  let f = $('#mapfade');
  if (on) {
    if (!f) {
      f = document.createElement('div');
      f.id = 'mapfade';
      f.style.cssText =
        'position:fixed;inset:0;z-index:5;pointer-events:none;background:rgb(176,186,236);opacity:0;transition:opacity .32s ease-in';
      document.body.appendChild(f);
    }
    requestAnimationFrame(() => (f.style.opacity = full ? '1' : '.85'));
  } else if (f) {
    f.style.transition = 'opacity .35s ease-out';
    f.style.opacity = '0';
    setTimeout(() => f.remove(), 400);
  }
}

/* ---------- the map's buttons and the Places list ---------- */
function worldMapChrome() {
  const box = $('.map-full');
  if (!box) return;
  const ctl = box.querySelector('.mapctl');
  if (ctl && !ctl.querySelector('[data-a=mlist]'))
    ctl.insertAdjacentHTML(
      'beforeend',
      `<button class="mbtn" data-a="mlist" aria-label="Places" title="Places">${uiIconHTML('list', 16)}</button>`
    );
  if (worldMap.gl && !box.querySelector('.mapbowl')) {
    box.insertAdjacentHTML(
      'beforeend',
      `<div class="mapview mapbowl glass" role="group" aria-label="Look around"><button class="mbtn sm" data-k="left" aria-label="Turn left" title="Turn left">⟲</button><button class="mbtn sm" data-k="all" aria-label="See the whole bowl" title="The whole bowl">◎</button><button class="mbtn sm" data-k="right" aria-label="Turn right" title="Turn right">⟳</button></div>`
    );
    box.querySelector('.mapbowl').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || !worldBowl.on) return;
      const c = worldBowl.goal || worldBowl.cam;
      worldBowl.tween = null;
      worldBowl.goal =
        b.dataset.k === 'all'
          ? worldBowlFloats()
            ? bowlCamClamp({ ...c, dist: worldBowlFloatIsland().r * FLOAT_CAMERA.distMax * 0.7, tilt: 0.75 })
            : bowlCamOverview(c.yaw)
          : bowlCamTurn(c, b.dataset.k === 'left' ? -0.6 : 0.6, 0);
      worldBowl.dirty = true;
    });
  }
  let pl = box.querySelector('.mplaces');
  if (worldMap.list) {
    if (!pl) {
      box.insertAdjacentHTML('beforeend', '<div class="mplaces glass" role="dialog" aria-label="Places"></div>');
      pl = box.querySelector('.mplaces');
    }
    pl.innerHTML = worldMapLocationListHTML();
  } else if (pl) pl.remove();
}
function worldMapPinState(i) {
  const n = LOCATIONS[i],
    dest = saveData.trip.plan.length ? saveData.trip.plan[saveData.trip.plan.length - 1] : null,
    locked = !canEnter(i);
  return {
    ico: i === saveData.trip.node ? 'walk' : locked ? 'lock' : i === dest ? 'flag' : n.town ? 'house' : 'leaf',
    cls:
      (i === saveData.trip.node ? ' here' : '') +
      (uiState.mapSel === i ? ' sel' : '') +
      (i === dest ? ' dest' : '') +
      (!saveData.visited[i] && !locked ? ' new' : '') +
      (locked ? ' locked' : '') +
      (n.town ? ' town' : ''),
  };
}
function worldMapLocationListHTML() {
  /* RL-7: a run's places only once the map shows what they are */
  const shown = (/** @type {number} */ i) => {
    if (worldBowl.spots && worldBowl.spots[i] && worldBowl.spots[i].off) return false;
    const rm = worldBowlRunMark(i);
    return !rm || rm.seen > 1;
  };
  const rows = LOCATIONS.map((n, i) => {
    const st = worldMapPinState(i),
      t = i === saveData.trip.node ? null : tripTo(i),
      locked = st.cls.includes('locked');
    const sub =
      i === saveData.trip.node
        ? 'You are here'
        : locked
          ? 'Locked'
          : t
            ? `${distanceText(t.metres)}${saveData.visited[i] ? '' : ' · new'}`
            : 'No road yet';
    return {
      i,
      n,
      st,
      sub,
      g: i === saveData.trip.node ? 0 : locked ? 3 : saveData.visited[i] ? 1 : 2,
      metres: t ? t.metres : 1e9,
    };
  }).filter(r => shown(r.i));
  rows.sort((a, b) => a.g - b.g || a.metres - b.metres);
  const G = ['Here', 'Visited', 'Not visited yet', 'Locked'];
  let h = `<div class="mpl-head"><b>Places</b>${worldMap.gl ? '<button class="mbtn sm" data-a="mlist" aria-label="Close">×</button>' : ''}</div><div class="mpl-body">`,
    g = -1;
  for (const r of rows) {
    if (r.g !== g) {
      g = r.g;
      h += `<div class="mpl-g">${G[g]}</div>`;
    }
    h += `<button class="mpl-row${r.st.cls}" data-a="msel" data-n="${r.i}"><span class="mp-i">${uiIconHTML(r.st.ico, 14)}</span><span class="mpl-n">${escapeHtml(r.n.name)}<small>${escapeHtml(locationSubtitle(r.n))}</small></span><span class="mpl-s">${escapeHtml(r.sub)}</span></button>`;
  }
  return h + '</div>';
}
/* the map's own buttons (ui.js asks before its own actions) */
export function worldMapAction(a) {
  if (a === 'mlist') {
    worldMap.list = !worldMap.list || !worldMap.gl;
    worldMapChrome();
    return true;
  }
  if (a === 'msel' && worldMap.list && worldMap.gl && innerWidth < 850) {
    worldMap.list = false;
    setTimeout(worldMapChrome, 0);
  }
  return false;
}
