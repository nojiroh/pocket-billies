// @ts-check
'use strict';
/* ================= MAP GENERATOR (map generator track MG-1) =================
   A whole walk scene from dials and a seed, in the game's own scene format (tiles, heights, steps, props, hub,
   edgeExits with path and len, streams, bridges, waters, the look keys), so a generated place is drawn and walked
   like a hand-built one. Logic only: no DOM, no Math.random, runs in Node (tools/test/mapgen.test.mjs). The Studio's
   Generate card (studio/js/map-generate.js) shows it as a draft.
   - The same params and seed give the same scene. Each stage draws from its own random stream (rngFrom(seed,
     stage)), so a stage can be rerolled alone (params.seeds[stage]).
   - What it makes is marked: every prop carries g: 1 (its wild plants also w: 42, as tools/grow-wild.py marks them),
     the scene carries gen: {v, params, seed}.
   - The stages, in order: heights, ground, road (carves, flattens and paves), exits and hub, plants (the grow-wild
     rules, fixed: nothing on any path, door, water or bridge), feature, props.
   Coordinates are the game's: metres, x east, z from the near (south) edge; one tile is a metre. Internally every grid
   is near row first; the scene's tiles and heights are far row first, its steps near row first (walk-view.js). */
/** @import { Biome } from '../../types/game-data' */
/* to-module: start (phase 04c: imports, exports and the window bridge, made by tools/to-module.mjs) */
import { expose } from '../test-globals.js';
import {
  WATERGEN_SHALLOW_PROP,
  waterGenCarve,
  waterGenClimbs,
  waterGenFalls,
  waterGenKinds,
  waterGenReeds,
  waterGenRiver,
  waterGenShallows,
} from '../hooks.js';
import { hashString, rngFrom } from './rng.js';
import { normalTurn, pointInProp, turnedBounds, turnedPoint } from './prop-turn.js';
/* eslint-disable no-func-assign */
expose({
  MAPGEN_BAND: [() => MAPGEN_BAND],
  MAPGEN_BASE64: [() => MAPGEN_BASE64],
  MAPGEN_BRIDGE_SQUARE: [() => MAPGEN_BRIDGE_SQUARE],
  MAPGEN_DEEP: [() => MAPGEN_DEEP],
  MAPGEN_DEFAULTS: [() => MAPGEN_DEFAULTS],
  MAPGEN_EIGHT: [() => MAPGEN_EIGHT],
  MAPGEN_EXIT_IN: [() => MAPGEN_EXIT_IN],
  MAPGEN_FAMILY_SHARE: [() => MAPGEN_FAMILY_SHARE],
  MAPGEN_FEATURES: [() => MAPGEN_FEATURES],
  MAPGEN_FOREST: [() => MAPGEN_FOREST],
  MAPGEN_FOUR: [() => MAPGEN_FOUR],
  MAPGEN_GRASS_PATCH: [() => MAPGEN_GRASS_PATCH],
  MAPGEN_HABITAT: [() => MAPGEN_HABITAT],
  MAPGEN_HABITAT_ROUND: [() => MAPGEN_HABITAT_ROUND],
  MAPGEN_HUB_BUILDINGS: [() => MAPGEN_HUB_BUILDINGS],
  MAPGEN_INWARD: [() => MAPGEN_INWARD],
  MAPGEN_LAYOUTS: [() => MAPGEN_LAYOUTS],
  MAPGEN_LAYOUT_DIALS: [() => MAPGEN_LAYOUT_DIALS],
  MAPGEN_LEDGE_PIECE: [() => MAPGEN_LEDGE_PIECE],
  MAPGEN_LM: [() => MAPGEN_LM],
  MAPGEN_MASSIF: [() => MAPGEN_MASSIF],
  MAPGEN_MOUNTAIN_DIALS: [() => MAPGEN_MOUNTAIN_DIALS],
  MAPGEN_MOUNTAIN_SMOOTH: [() => MAPGEN_MOUNTAIN_SMOOTH],
  MAPGEN_MOUTH: [() => MAPGEN_MOUTH],
  MAPGEN_OPPOSITE: [() => MAPGEN_OPPOSITE],
  MAPGEN_OUTCROP: [() => MAPGEN_OUTCROP],
  MAPGEN_OUTWARD: [() => MAPGEN_OUTWARD],
  MAPGEN_PATH_GROUND: [() => MAPGEN_PATH_GROUND],
  MAPGEN_PEAK: [() => MAPGEN_PEAK],
  MAPGEN_PIECES_DIALS: [() => MAPGEN_PIECES_DIALS],
  MAPGEN_PIECES_MOST: [() => MAPGEN_PIECES_MOST],
  MAPGEN_PIECE_LEAVE: [() => MAPGEN_PIECE_LEAVE],
  MAPGEN_PIECE_SIGHT: [() => MAPGEN_PIECE_SIGHT],
  MAPGEN_PLANT_SHARE: [() => MAPGEN_PLANT_SHARE],
  MAPGEN_SHAPES: [() => MAPGEN_SHAPES],
  MAPGEN_SIDE_NAME: [() => MAPGEN_SIDE_NAME],
  MAPGEN_SIZES: [() => MAPGEN_SIZES],
  MAPGEN_STAGES: [() => MAPGEN_STAGES],
  MAPGEN_STRAIGHT_IN: [() => MAPGEN_STRAIGHT_IN],
  MAPGEN_SURFACES: [() => MAPGEN_SURFACES],
  MAPGEN_TOWN: [() => MAPGEN_TOWN],
  MAPGEN_TOWN_SET: [() => MAPGEN_TOWN_SET],
  MAPGEN_TRAIL_GRADE: [() => MAPGEN_TRAIL_GRADE],
  MAPGEN_TRAIL_WIDTH: [() => MAPGEN_TRAIL_WIDTH],
  MAPGEN_VERSION: [() => MAPGEN_VERSION],
  MAPGEN_WALKABLE: [() => MAPGEN_WALKABLE],
  MAPGEN_WALK_AIM: [() => MAPGEN_WALK_AIM],
  MAPGEN_WATER: [() => MAPGEN_WATER],
  MAPGEN_WET: [() => MAPGEN_WET],
  MAPGEN_WILD_MARK: [() => MAPGEN_WILD_MARK],
  mapgenAhead: [() => mapgenAhead],
  mapgenAlong: [() => mapgenAlong],
  mapgenBetween: [() => mapgenBetween],
  // @ts-expect-error -- replaced on purpose
  mapgenBezier: [() => mapgenBezier, v => (mapgenBezier = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenBridgesOverWater: [() => mapgenBridgesOverWater, v => (mapgenBridgesOverWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenBuild: [() => mapgenBuild, v => (mapgenBuild = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenCarveTrail: [() => mapgenCarveTrail, v => (mapgenCarveTrail = v)],
  mapgenCellAt: [() => mapgenCellAt],
  // @ts-expect-error -- replaced on purpose
  mapgenChooseHub: [() => mapgenChooseHub, v => (mapgenChooseHub = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenClearRound: [() => mapgenClearRound, v => (mapgenClearRound = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenCopyable: [() => mapgenCopyable, v => (mapgenCopyable = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenCornerHeight: [() => mapgenCornerHeight, v => (mapgenCornerHeight = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenDecodeBase64: [() => mapgenDecodeBase64, v => (mapgenDecodeBase64 = v)],
  mapgenDepth: [() => mapgenDepth],
  // @ts-expect-error -- replaced on purpose
  mapgenEdgeCorrection: [() => mapgenEdgeCorrection, v => (mapgenEdgeCorrection = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenEdgeStrip: [() => mapgenEdgeStrip, v => (mapgenEdgeStrip = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenEncodeBase64: [() => mapgenEncodeBase64, v => (mapgenEncodeBase64 = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenExitOf: [() => mapgenExitOf, v => (mapgenExitOf = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenExitPoint: [() => mapgenExitPoint, v => (mapgenExitPoint = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFbm: [() => mapgenFbm, v => (mapgenFbm = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFenceRun: [() => mapgenFenceRun, v => (mapgenFenceRun = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFillMask: [() => mapgenFillMask, v => (mapgenFillMask = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenFlattenRoads: [() => mapgenFlattenRoads, v => (mapgenFlattenRoads = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenForestClearings: [() => mapgenForestClearings, v => (mapgenForestClearings = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenForestFill: [() => mapgenForestFill, v => (mapgenForestFill = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenForestTidy: [() => mapgenForestTidy, v => (mapgenForestTidy = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenGrassPatches: [() => mapgenGrassPatches, v => (mapgenGrassPatches = v)],
  mapgenGround: [() => mapgenGround],
  // @ts-expect-error -- replaced on purpose
  mapgenGroundSampler: [() => mapgenGroundSampler, v => (mapgenGroundSampler = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenGrowWild: [() => mapgenGrowWild, v => (mapgenGrowWild = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenHabitats: [() => mapgenHabitats, v => (mapgenHabitats = v)],
  mapgenInLot: [() => mapgenInLot],
  // @ts-expect-error -- replaced on purpose
  mapgenJetty: [() => mapgenJetty, v => (mapgenJetty = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenJoinOffset: [() => mapgenJoinOffset, v => (mapgenJoinOffset = v)],
  mapgenLaidOut: [() => mapgenLaidOut],
  // @ts-expect-error -- replaced on purpose
  mapgenLattice: [() => mapgenLattice, v => (mapgenLattice = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLayoutFree: [() => mapgenLayoutFree, v => (mapgenLayoutFree = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLayoutRect: [() => mapgenLayoutRect, v => (mapgenLayoutRect = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLayoutSpots: [() => mapgenLayoutSpots, v => (mapgenLayoutSpots = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLedges: [() => mapgenLedges, v => (mapgenLedges = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLevelLot: [() => mapgenLevelLot, v => (mapgenLevelLot = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLotFree: [() => mapgenLotFree, v => (mapgenLotFree = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenLowerWater: [() => mapgenLowerWater, v => (mapgenLowerWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMaskDepth: [() => mapgenMaskDepth, v => (mapgenMaskDepth = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMergeDefaults: [() => mapgenMergeDefaults, v => (mapgenMergeDefaults = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMountainField: [() => mapgenMountainField, v => (mapgenMountainField = v)],
  mapgenMountainLevel: [() => mapgenMountainLevel],
  // @ts-expect-error -- replaced on purpose
  mapgenMountains: [() => mapgenMountains, v => (mapgenMountains = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenMouths: [() => mapgenMouths, v => (mapgenMouths = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearJoined: [() => mapgenNearJoined, v => (mapgenNearJoined = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearPinned: [() => mapgenNearPinned, v => (mapgenNearPinned = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearRoadWidth: [() => mapgenNearRoadWidth, v => (mapgenNearRoadWidth = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNearSpan: [() => mapgenNearSpan, v => (mapgenNearSpan = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNewWork: [() => mapgenNewWork, v => (mapgenNewWork = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenNoise: [() => mapgenNoise, v => (mapgenNoise = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOccAdd: [() => mapgenOccAdd, v => (mapgenOccAdd = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOccFree: [() => mapgenOccFree, v => (mapgenOccFree = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOnCliff: [() => mapgenOnCliff, v => (mapgenOnCliff = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenOutcrop: [() => mapgenOutcrop, v => (mapgenOutcrop = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintCoast: [() => mapgenPaintCoast, v => (mapgenPaintCoast = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintDisc: [() => mapgenPaintDisc, v => (mapgenPaintDisc = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintIslet: [() => mapgenPaintIslet, v => (mapgenPaintIslet = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintPond: [() => mapgenPaintPond, v => (mapgenPaintPond = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPaintStream: [() => mapgenPaintStream, v => (mapgenPaintStream = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPairScene: [() => mapgenPairScene, v => (mapgenPairScene = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenParams: [() => mapgenParams, v => (mapgenParams = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPickVariant: [() => mapgenPickVariant, v => (mapgenPickVariant = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPieceWeight: [() => mapgenPieceWeight, v => (mapgenPieceWeight = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPiecesWant: [() => mapgenPiecesWant, v => (mapgenPiecesWant = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPinEdges: [() => mapgenPinEdges, v => (mapgenPinEdges = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPinSides: [() => mapgenPinSides, v => (mapgenPinSides = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPockets: [() => mapgenPockets, v => (mapgenPockets = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPolyLength: [() => mapgenPolyLength, v => (mapgenPolyLength = v)],
  mapgenPoolPick: [() => mapgenPoolPick],
  // @ts-expect-error -- replaced on purpose
  mapgenPropCells: [() => mapgenPropCells, v => (mapgenPropCells = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenPutProp: [() => mapgenPutProp, v => (mapgenPutProp = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRadius: [() => mapgenRadius, v => (mapgenRadius = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRaise: [() => mapgenRaise, v => (mapgenRaise = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenReach: [() => mapgenReach, v => (mapgenReach = v)],
  mapgenReached: [() => mapgenReached],
  // @ts-expect-error -- replaced on purpose
  mapgenResample: [() => mapgenResample, v => (mapgenResample = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRidged: [() => mapgenRidged, v => (mapgenRidged = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadCurve: [() => mapgenRoadCurve, v => (mapgenRoadCurve = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadDist: [() => mapgenRoadDist, v => (mapgenRoadDist = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRoadOverWater: [() => mapgenRoadOverWater, v => (mapgenRoadOverWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenRockEdges: [() => mapgenRockEdges, v => (mapgenRockEdges = v)],
  mapgenRound2: [() => mapgenRound2],
  // @ts-expect-error -- replaced on purpose
  mapgenScene: [() => mapgenScene, v => (mapgenScene = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneCorner: [() => mapgenSceneCorner, v => (mapgenSceneCorner = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneGround: [() => mapgenSceneGround, v => (mapgenSceneGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneGroundOf: [() => mapgenSceneGroundOf, v => (mapgenSceneGroundOf = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSceneLife: [() => mapgenSceneLife, v => (mapgenSceneLife = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSeamAgreement: [() => mapgenSeamAgreement, v => (mapgenSeamAgreement = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSegCross: [() => mapgenSegCross, v => (mapgenSegCross = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenShareMask: [() => mapgenShareMask, v => (mapgenShareMask = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSimplify: [() => mapgenSimplify, v => (mapgenSimplify = v)],
  mapgenSmooth: [() => mapgenSmooth],
  // @ts-expect-error -- replaced on purpose
  mapgenSpur: [() => mapgenSpur, v => (mapgenSpur = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageEdgeGround: [() => mapgenStageEdgeGround, v => (mapgenStageEdgeGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageExits: [() => mapgenStageExits, v => (mapgenStageExits = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageFeature: [() => mapgenStageFeature, v => (mapgenStageFeature = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageGround: [() => mapgenStageGround, v => (mapgenStageGround = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageHeights: [() => mapgenStageHeights, v => (mapgenStageHeights = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLand: [() => mapgenStageLand, v => (mapgenStageLand = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLayout: [() => mapgenStageLayout, v => (mapgenStageLayout = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageLots: [() => mapgenStageLots, v => (mapgenStageLots = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStagePieces: [() => mapgenStagePieces, v => (mapgenStagePieces = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStagePlants: [() => mapgenStagePlants, v => (mapgenStagePlants = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageProps: [() => mapgenStageProps, v => (mapgenStageProps = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageRoad: [() => mapgenStageRoad, v => (mapgenStageRoad = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageTown: [() => mapgenStageTown, v => (mapgenStageTown = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStageWater: [() => mapgenStageWater, v => (mapgenStageWater = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenSteepAt: [() => mapgenSteepAt, v => (mapgenSteepAt = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenStreamLine: [() => mapgenStreamLine, v => (mapgenStreamLine = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTerraces: [() => mapgenTerraces, v => (mapgenTerraces = v)],
  mapgenToward: [() => mapgenToward],
  // @ts-expect-error -- replaced on purpose
  mapgenTownFolk: [() => mapgenTownFolk, v => (mapgenTownFolk = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTrailSearch: [() => mapgenTrailSearch, v => (mapgenTrailSearch = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTrails: [() => mapgenTrails, v => (mapgenTrails = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenTraps: [() => mapgenTraps, v => (mapgenTraps = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenUnreachable: [() => mapgenUnreachable, v => (mapgenUnreachable = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenUntrap: [() => mapgenUntrap, v => (mapgenUntrap = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenWalkGrid: [() => mapgenWalkGrid, v => (mapgenWalkGrid = v)],
  // @ts-expect-error -- replaced on purpose
  mapgenWalkShare: [() => mapgenWalkShare, v => (mapgenWalkShare = v)],
});
/* eslint-enable no-func-assign */
/* to-module: end */
export const MAPGEN_VERSION = 22; /* 2: MG-2's terraces at ground level by exits; 3: pictures are never scaled, plants get a drawn variant (v) instead; 4: a bridge only where the road crosses a stream (RL-8); 5: a run's scenes go east to west (logic/run-scenes.js); 6: tall grass in patches, one across the way west (TR-2c); 7: a town kind, a street, a square and houses (TW-1); 8: run routes laid out by a plan (RT-1, the routes track); 9: a town's townsfolk, animals, chat and named locals' spots (TW-2); 10: a town's notice board and its quest giver's spot (TW-3); 11: no room kept for the straight-line route trainers (RT-2); 12: an exit's signpost reads the place's name, set pieces (RT-3); 13: habitat points for wild Billies (RT-4a); 14: kept for RT-4b; 15: rivers run downhill (WA-3a, logic/water-gen.js); 16: waterfalls, a river steps with the land (WA-2b); 17: the new water kinds placed (rapids, hot springs, the bog, oases, cave water) and reeds' finds (WA-5a); 18: more props in the set pieces and two new pieces, a wayside shrine and a solar garden (route props track); 19: a run's scenes go west to east, the way on a dial of its own (`ahead`, WM-1); 20, 21: kept for the region map track (WM-3, WM-7); 22: a pocket's or dead end's mouth for Cut brambles (`mouth`, RT-4b) */
export const MAPGEN_STAGES = [
  'heights',
  'relief',
  'ground',
  'road',
  'exits',
  'lots',
  'layout',
  'plants',
  'feature',
  'props',
  'pieces',
];
export const MAPGEN_SHAPES = {
  straight: 'Straight',
  winding: 'Gentle winding',
  scurve: 'S-curve',
  switchback: 'Switchback',
};
export const MAPGEN_SURFACES = { dirt: 'p', gravel: 'v', cobbles: 'K', pavers: 'q' };
export const MAPGEN_WATER = { none: 'None', stream: 'Stream', pond: 'Pond', coast: 'Coast', islet: 'Islet' };
export const MAPGEN_FEATURES = {
  none: 'None',
  bridge: 'Stream and bridge',
  lookout: 'Lookout',
  jetty: 'Jetty',
  glade: 'Glade',
  lava: 'Lava flow',
  terraces: 'Terraces',
};
/* TR-2: the sides mountains rise on (land.massif): a side or two, the back and sides, or all round */
export const MAPGEN_MASSIF = {
  EW: 'East and west',
  NS: 'North and south',
  W: 'West',
  E: 'East',
  N: 'Back (north)',
  NEW: 'Back and sides',
  NSEW: 'All round',
};
/* TR-2: the mountains dials when not given (they are not in MAPGEN_DEFAULTS, so scenes made without them keep the
   dials they stored): mountains 0-1 (none up to MAPGEN_PEAK), massif the sides they rise on */
export const MAPGEN_MOUNTAIN_DIALS = { mountains: 0, massif: 'EW', ledges: 0 };
/* TR-2: the tallest a mountain gets at the mountains dial's top (metres) */
export const MAPGEN_PEAK = 20;
/* TR-2: how much of a mountain's height is smooth land (the rest is step-grid shelves and cliffs) */
export const MAPGEN_MOUNTAIN_SMOOTH = 0.25;
export const MAPGEN_SIZES = {
  route: { name: 'Route', w: 112, h: 64 },
  small_town: { name: 'Small town', w: 80, h: 60 },
  big_town: { name: 'Big town', w: 128, h: 96 },
};
/* grow-wild.py's share of each plant family */
export const MAPGEN_FAMILY_SHARE = {
  flowers: 0.36,
  ground: 0.34,
  water: 0.1,
  shrubs: 0.09,
  rocks: 0.06,
  seasons: 0.03,
  trees: 0.02,
};
export const MAPGEN_WILD_MARK = 42;
export const MAPGEN_PATH_GROUND =
  'pcmbaqhevuKTiPsS'; /* ground a plant never takes when it is part of a road (plus every paved terrain) */
export const MAPGEN_WET = 'wd';
export const MAPGEN_EXIT_IN = 1.1;
export const MAPGEN_STRAIGHT_IN = 7; /* metres of road that run straight in from an exit, so a seam is crossed head on */

/** the dials, as the Studio's Generate card shows them (a group per card section) */
export const MAPGEN_DEFAULTS = {
  kind: 'route',
  biome: 'meadow',
  w: 112,
  h: 64,
  seed: 1,
  seeds: {},
  land: { hills: 0.4, terraces: 0, cliffs: 0.3, water: 'none', waterAmount: 0.5 },
  road: {
    exits: [
      { side: 'W', t: 0.5, width: 2 },
      { side: 'E', t: 0.5, width: 2 },
    ],
    shape: 'winding',
    wobble: 0.5,
    width: 2.4,
    surface: 'dirt',
    verge: 0.5,
  },
  nature: { growth: 0.8, tall: 0.5, clearings: 0.3, trees: 0.5 },
  feature: 'none',
  props: { lamps: 0, benches: 0.3, signs: 1, bins: 0, folk: 0.3, mast: 0, clinic: 0, shop: 0, stand: 0, stall: 0 },
};

export const mapgenBetween = (v, a, b) => (v < a ? a : v > b ? b : v);
export const mapgenRound2 = v => Math.round(v * 100) / 100;
export const mapgenSmooth = t => t * t * (3 - 2 * t);

export function mapgenLattice(i, j, s) {
  let h = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** smooth value noise in [0,1] at (x, z) for a salt s */
export function mapgenNoise(x, z, s) {
  const i = Math.floor(x),
    j = Math.floor(z),
    fx = mapgenSmooth(x - i),
    fz = mapgenSmooth(z - j);
  const a = mapgenLattice(i, j, s),
    b = mapgenLattice(i + 1, j, s),
    c = mapgenLattice(i, j + 1, s),
    d = mapgenLattice(i + 1, j + 1, s);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
export function mapgenFbm(x, z, s) {
  return (
    0.6 * mapgenNoise(x, z, s) +
    0.3 * mapgenNoise(x * 2.03, z * 2.03, s + 17) +
    0.1 * mapgenNoise(x * 4.1, z * 4.1, s + 31)
  );
}

/* ---------- params ---------- */
export function mapgenMergeDefaults(def, v) {
  if (Array.isArray(def))
    return Array.isArray(v) ? v.map(e => (e && typeof e === 'object' ? { ...e } : e)) : def.map(e => ({ ...e }));
  if (def && typeof def === 'object') {
    const out = {};
    for (const k of Object.keys(def))
      out[k] = mapgenMergeDefaults(def[k], v && typeof v === 'object' ? v[k] : undefined);
    if (v && typeof v === 'object') for (const k of Object.keys(v)) if (!(k in def)) out[k] = v[k];
    return out;
  }
  return v === undefined || v === null || (typeof def === 'number' && typeof v !== 'number') ? def : v;
}
/** the dials filled in from the defaults and kept in range (a copy; the given params are not changed) */
export function mapgenParams(p) {
  const P = mapgenMergeDefaults(MAPGEN_DEFAULTS, p || {});
  P.w = mapgenBetween(Math.round(P.w), 24, 200);
  P.h = mapgenBetween(Math.round(P.h), 24, 200);
  P.seed = Math.floor(Math.abs(Number(P.seed) || 0)) % 2147483647;
  for (const g of ['land', 'nature', 'props'])
    for (const k of Object.keys(P[g])) if (typeof P[g][k] === 'number') P[g][k] = mapgenBetween(P[g][k], 0, 1);
  const R = P.road;
  R.wobble = mapgenBetween(R.wobble, 0, 1);
  R.verge = mapgenBetween(R.verge, 0, 1);
  R.width = mapgenBetween(R.width, 1.2, 6);
  if (!MAPGEN_SHAPES[R.shape]) R.shape = 'winding';
  if (!MAPGEN_SURFACES[R.surface]) R.surface = 'dirt';
  if (!MAPGEN_WATER[P.land.water]) P.land.water = 'none';
  if (!MAPGEN_FEATURES[P.feature]) P.feature = 'none';
  /* TW-1: a route, or a town (mapgenStageTown) */
  if (P.kind !== 'town') P.kind = 'route';
  /* TR-2: the mountains dials are kept only when given, so a scene made without them stores the dials it always did */
  if (P.land.mountains !== undefined && typeof P.land.mountains !== 'number') delete P.land.mountains;
  if (P.land.ledges !== undefined && typeof P.land.ledges !== 'number') delete P.land.ledges;
  if (P.land.massif !== undefined && !MAPGEN_MASSIF[P.land.massif]) P.land.massif = MAPGEN_MOUNTAIN_DIALS.massif;
  /* RT-1: the layout plan, kept only when given; a plan sets its own dials (a lake, terraces with ledge fronts) */
  if (P.layout !== undefined && (typeof P.layout !== 'string' || !MAPGEN_LAYOUTS[P.layout]))
    P.layout = MAPGEN_LAYOUT_DIALS.layout;
  /* RT-3: how many set pieces, kept only when given (whole, 0-6) */
  if (P.pieces !== undefined) P.pieces = mapgenBetween(Math.round(+P.pieces || 0), 0, MAPGEN_PIECES_MOST);
  /* RL-14: the kind of place (a run's scrapyard) set pieces may favour, kept only when given */
  if (P.site !== undefined && (typeof P.site !== 'string' || !/^[a-z][a-z0-9_]{0,23}$/.test(P.site))) delete P.site;
  if (mapgenLaidOut(P)) {
    const d = MAPGEN_LAYOUTS[P.layout].dials || {};
    if (d.water && P.land.water !== 'coast') P.land.water = d.water;
    if (d.waterAmount != null) P.land.waterAmount = Math.max(P.land.waterAmount, d.waterAmount);
    if (d.terraces != null) P.land.terraces = Math.max(P.land.terraces, d.terraces);
    if (d.ledges != null) P.land.ledges = d.ledges;
  }
  /* the sides whose edge is pinned to height 0 (a run's: every scene meets any neighbour there), kept only when given */
  if (P.pin !== undefined)
    P.pin = typeof P.pin === 'string' ? [...new Set(P.pin.split(''))].filter(c => 'NSEW'.includes(c)).join('') : '';
  /* WM-1: the side the way on leaves by (a run's: east), kept only when given; west when not */
  if (P.ahead !== undefined) P.ahead = typeof P.ahead === 'string' && /^[NSEW]$/.test(P.ahead) ? P.ahead : 'W';
  R.exits = (R.exits || [])
    .filter(e => e && 'NSEW'.includes(e.side))
    .slice(0, 4)
    .map(e => ({ side: e.side, t: mapgenBetween(+e.t || 0.5, 0.08, 0.92), width: mapgenBetween(+e.width || 2, 1, 6) }));
  if (!R.exits.length) R.exits = [{ side: 'S', t: 0.5, width: 2 }];
  /* MG-2: the edges joined to a neighbour (mapgenEdgeStrip), copied (mapgenMergeDefaults keeps unknown keys by
     reference); each one's exit is the nearest on its side within 44 m, moved onto it, or a new one */
  const edges = (Array.isArray(P.edges) ? P.edges : [])
    .filter(s => s && MAPGEN_OPPOSITE[s.side] && Array.isArray(s.heights) && s.t > 0 && s.t < 1)
    .map(s => JSON.parse(JSON.stringify(s)));
  delete P.edges;
  if (edges.length) P.edges = edges;
  for (const s of edges) {
    const L = s.side === 'N' || s.side === 'S' ? P.w : P.h;
    let best = /** @type {any} */ (null);
    for (const e of R.exits)
      if (
        e.side === s.side &&
        !e.joined &&
        Math.abs(e.t - s.t) * L < 44 &&
        (!best || Math.abs(e.t - s.t) < Math.abs(best.t - s.t))
      )
        best = e;
    if (!best && R.exits.length < 4) R.exits.push((best = { side: s.side, t: s.t, width: s.width }));
    if (best) Object.assign(best, { t: s.t, width: s.width, joined: 1 });
  }
  for (const e of R.exits) delete e.joined;
  return P;
}

/* ---------- MG-2: an edge joined to a neighbour ---------- */
export const MAPGEN_OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
/**
 * what a neighbour shows where a new scene joins its exit, in the new scene's metres: the strip of its edge the new
 * scene must agree with (MAPGEN_BAND either side of the exit and 4 m more to fade out, clipped to the edge both
 * share). The new scene's exit goes on the opposite side, `t` along it (kept as near as it can be to the t asked
 * for) so the two exits are a whole number of metres apart, as wide as the neighbour's. size: the new scene's
 * {w, h}. The strip is plain data, so params.edges keeps the generator a function of its dials alone.
 * { side, t, width, from: {exit}, at (the exit, metres along the side), lo, hi, u0 (the first corner),
 *   heights (the neighbour's edge corners from u0, a metre apart), c0 (the first cell), ground (the neighbour's
 *   cells along its edge from c0), raise (its step raise along the edge, a half metre apart from c0, or null),
 *   props ([k, x, z, s] near the edge, outside the new scene) } or null
 * @param {any} nb @param {string} exitId @param {{ w: number, h: number }} size @param {number} [t]
 */
export function mapgenEdgeStrip(nb, exitId, size, t) {
  const xn = mapgenExitOf(nb, exitId);
  if (!xn) return null;
  const ns = xn.e.side,
    side = MAPGEN_OPPOSITE[ns],
    v = ns === 'E' || ns === 'W',
    L = v ? size.h : size.w,
    Lnb = v ? nb.h : nb.w,
    an = v ? xn.p[1] : xn.p[0],
    want = (t == null ? xn.e.t : t) * L;
  /* the offset of the new scene along the edge, a whole number of metres: its exit at an - o */
  let o = Math.round(an - want);
  while (an - o > 0.92 * L && o < an) o++;
  while (an - o < 0.08 * L && o > an - L) o--;
  const at = mapgenRound2(an - o),
    lo = Math.max(0, -o, at - MAPGEN_BAND - 4),
    hi = Math.min(L, Lnb - o, at + MAPGEN_BAND + 4);
  if (hi <= lo) return null;
  /* the neighbour's edge, by u in the new scene's metres along it */
  const corner = u =>
    v ? mapgenSceneCorner(nb, ns === 'E' ? nb.w : 0, u + o) : mapgenSceneCorner(nb, u + o, ns === 'N' ? nb.h : 0);
  const cellAt = (x, z) =>
    (nb.tiles[nb.h - 1 - mapgenBetween(Math.floor(z), 0, nb.h - 1)] || '')[mapgenBetween(Math.floor(x), 0, nb.w - 1)] ||
    nb.edge ||
    'g';
  const cell = c =>
    v ? cellAt(ns === 'E' ? nb.w - 0.5 : 0.5, c + o + 0.5) : cellAt(c + o + 0.5, ns === 'N' ? nb.h - 0.5 : 0.5);
  const u0 = Math.ceil(lo),
    c0 = Math.floor(lo),
    heights = [],
    ground = [];
  for (let u = u0; u <= hi; u++) heights.push(mapgenRound2(corner(u)));
  for (let c = c0; c < hi; c++) ground.push(cell(c));
  let raise = /** @type {number[] | null} */ (null);
  if (nb.steps) {
    const u8 = mapgenDecodeBase64(nb.steps),
      S = new Int16Array(u8.buffer, 0, u8.length >> 1),
      W2 = nb.w * 2;
    if (S.length === nb.w * nb.h * 4) {
      const R = [];
      for (let u = c0 + 0.25; u < hi; u += 0.5) {
        const x = v ? (ns === 'E' ? nb.w - 0.25 : 0.25) : u + o,
          z = v ? u + o : ns === 'N' ? nb.h - 0.25 : 0.25;
        R.push(
          S[mapgenBetween(Math.floor(z * 2), 0, nb.h * 2 - 1) * W2 + mapgenBetween(Math.floor(x * 2), 0, W2 - 1)] / 20
        );
      }
      if (R.some(r => r)) raise = R;
    }
  }
  /* the neighbour's things within 3 m of the edge, where they stand from the new scene */
  const props = [];
  for (const p of nb.props || []) {
    const d = ns === 'N' ? nb.h - p.z : ns === 'S' ? p.z : ns === 'E' ? nb.w - p.x : p.x,
      u = (v ? p.z : p.x) - o;
    if (d > 3 || u < lo - 3 || u > hi + 3) continue;
    const x = side === 'S' ? p.x - o : side === 'N' ? p.x - o : side === 'W' ? p.x - nb.w : size.w + p.x,
      z = side === 'S' ? p.z - nb.h : side === 'N' ? size.h + p.z : p.z - o;
    props.push([p.k, mapgenRound2(x), mapgenRound2(z), p.s || 1]);
  }
  return {
    side,
    t: at / L,
    width: xn.e.width || 2,
    from: { exit: exitId },
    at,
    lo: mapgenRound2(lo),
    hi: mapgenRound2(hi),
    u0,
    heights,
    c0,
    ground: ground.join(''),
    raise,
    props,
  };
}

/** where an edge exit is, as walk-view.js exitPoint works it out */
export function mapgenExitPoint(w, h, e) {
  const n = e.in == null ? MAPGEN_EXIT_IN : e.in;
  return e.side === 'N'
    ? [mapgenRound2(e.t * w), mapgenRound2(h - n)]
    : e.side === 'S'
      ? [mapgenRound2(e.t * w), mapgenRound2(n)]
      : e.side === 'E'
        ? [mapgenRound2(w - n), mapgenRound2(e.t * h)]
        : [mapgenRound2(n), mapgenRound2(e.t * h)];
}
export const MAPGEN_INWARD = { N: [0, -1], S: [0, 1], E: [-1, 0], W: [1, 0] }; /* pointing into the map */
export const MAPGEN_SIDE_NAME = { N: 'north', S: 'south', E: 'east', W: 'west' };

/** the radius a prop takes up (tools/grow-wild.py radius) */
export function mapgenRadius(M, s = 1) {
  if (!M) return 0.5;
  if (M.box) return Math.max(...M.box) * 0.5 * s + 0.6;
  if (M.solid) return M.solid * s + 0.15;
  if (M.flat) return 0.35 * s;
  return Math.max(0.3, (M.shadow || 0) * 0.42 * s + 0.2);
}

/* ---------- the generator's working state ---------- */
export function mapgenNewWork(P, ctx) {
  const w = P.w,
    h = P.h,
    biomes = ctx.biomes || {},
    /** @type {Biome} */
    B = biomes[P.biome] || biomes[Object.keys(biomes)[0]];
  if (!B) throw new Error('mapgen: no biomes (game/data/biomes.json)');
  const seedOf = st => (P.seeds && P.seeds[st] != null ? P.seeds[st] : P.seed);
  return {
    P,
    B,
    w,
    h,
    cat: (ctx.scenery && ctx.scenery.props) || {},
    terr: (ctx.scenery && ctx.scenery.terrains) || {},
    /* a stage's random stream and noise salt; sub separates the parts of a stage (they all follow its seed) */
    rng: (st, sub = '') => rngFrom(seedOf(st), st + sub),
    salt: (st, sub = '') => hashString(`${seedOf(st)}|${st}${sub}|noise`) % 100000,
    /* ground per cell, near row first */
    T: new Array(w * h).fill(B.ground.base),
    /* corner heights, (w+1) x (h+1), near row first */
    H: new Float32Array((w + 1) * (h + 1)),
    /* step raise per half-metre cell (2w x 2h) */
    S: new Float32Array(4 * w * h),
    /* TR-1: the step flags per half-metre cell, as scene.stepm (32: a ramp, leaning between its neighbours) */
    M: new Uint8Array(4 * w * h),
    /* per cell: 1 road, 2 verge, 4 water, 8 bridge, 16 clear (no trees), 32 tall grass, 64 bank, 128 jetty */
    F: new Uint8Array(w * h),
    road: /** @type {{ pts: number[][], width: number, main: boolean }[]} */ ([]),
    dist: new Float32Array(w * h).fill(1e9) /* to the nearest road's centre line, at cell centres */,
    near: new Int32Array(w * h).fill(-1) /* which road sample is nearest (index into roadPts) */,
    roadPts: /** @type {{ x: number, z: number, r: number, s: number, k: number }[]} */ ([]),
    props: /** @type {any[]} */ ([]),
    occ: new Map() /* 2 m buckets of [x, z, r] */,
    keep: /** @type {number[][]} */ ([]),
    hub: [w / 2, h / 2],
    exits: [],
    edgeExits: [],
    streams: [],
    bridges: [],
    /* RL-8: where the bridges go (mapgenRoadOverWater) */
    spans: /** @type {any[]} */ ([]),
    waters: [],
    npcSpots: [],
    notes: /** @type {string[]} */ ([]),
    stepsUsed: false,
    /* TR-2: mountains made shelves and cliffs (mapgenMountains) */
    relief: false,
    /* TR-2c: the ledges' cells and their flights of stairs (mapgenLedges) */
    ledgeCells: 0,
    ledgeStairs: 0,
    /* TR-2c: the tall grass patches (mapgenGrassPatches), [{ x, z, r, n: cells, across: on the way on }] */
    grassPatches: /** @type {{ x: number, z: number, r: number, n: number, across: boolean }[]} */ ([]),
    /* TR-2b: marked spots (a trail's summit: { kind, x, z, y }) */
    spots: /** @type {{ kind: string, x: number, z: number, y: number }[]} */ ([]),
    /* TR-2: the mountains' height per corner (mapgenMountainField), once made */
    mtnE: /** @type {Float32Array | null} */ (null),
    /* TR-2b: the step raise before the mountains' shelves (the terraces'), once the mountains are made */
    S0: /** @type {Float32Array | null} */ (null),
    /* MG-2: the buildings' lots, [x0, z0, x1, z1] (mapgenStageLots) */
    lots: /** @type {number[][]} */ ([]),
    /* MG-2: the edges joined to a neighbour that got their exit (mapgenParams) */
    joined: (P.edges || []).filter(s => P.road.exits.some(e => e.side === s.side && e.t === s.t)),
  };
}
export const mapgenCellAt = (G, x, z) =>
  mapgenBetween(Math.floor(z), 0, G.h - 1) * G.w + mapgenBetween(Math.floor(x), 0, G.w - 1);
export const mapgenGround = (G, x, z) => G.T[mapgenCellAt(G, x, z)];
export function mapgenOccAdd(G, x, z, r) {
  const k = `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  let L = G.occ.get(k);
  if (!L) G.occ.set(k, (L = []));
  L.push([x, z, r]);
}
export function mapgenOccFree(G, x, z, r) {
  const n = Math.ceil((r + 3) / 2);
  const bi = Math.floor(x / 2),
    bj = Math.floor(z / 2);
  for (let j = bj - n; j <= bj + n; j++)
    for (let i = bi - n; i <= bi + n; i++) {
      const L = G.occ.get(`${i},${j}`);
      if (L) for (const o of L) if (Math.hypot(x - o[0], z - o[1]) < o[2] + r) return false;
    }
  for (const o of G.keep) if (Math.hypot(x - o[0], z - o[1]) < o[2] + r) return false;
  return true;
}
/* the road nearest a point: distance to the centre line and the half width there */
export function mapgenRoadDist(G, x, z) {
  const q = mapgenCellAt(G, x, z);
  return G.dist[q];
}
export function mapgenNearRoadWidth(G, x, z) {
  const q = mapgenCellAt(G, x, z),
    k = G.near[q];
  return k >= 0 ? G.roadPts[k].r : 0;
}
/** put a prop (marked g: 1) if its spot is free; o: { avoid: ground letters, road: extra clearance, water: allowed } */
/** a drawn variant of a prop (its v, 1 is the first; 0 is the prop as drawn), picked by the variants' weights with
 * the prop as drawn counting 1, from a stream of its own (so picking one changes nothing else in the scene) */
export function mapgenPickVariant(G, M) {
  const L = M && M.variants;
  if (!L || !L.some(r => r.weight > 0)) return 0;
  const rnd = G.vrnd || (G.vrnd = G.rng('plants', '|variants'));
  let t = rnd.next() * L.reduce((a, r) => a + (r.weight > 0 ? r.weight : 0), 1) - 1;
  if (t < 0) return 0;
  for (let i = 0; i < L.length; i++) if (L[i].weight > 0 && (t -= L[i].weight) < 0) return i + 1;
  return 0;
}
export function mapgenPutProp(G, k, x0, z0, o = {}) {
  const M = G.cat[k];
  if (!M) return null;
  /* checked where it is stored: rounding can move a prop into the next cell */
  const x = mapgenRound2(x0),
    z = mapgenRound2(z0);
  /* phase 09: a picture is never scaled (it would leave the 32 px/m grid of the ground and the models): its variety
     is a drawn variant, and its footprint that variant's width (span). Models keep their size range. */
  const v = o.v != null ? o.v : mapgenPickVariant(G, M),
    s = M.model ? o.s || 1 : 1,
    span = v ? M.variants[v - 1].span || 1 : 1,
    r = mapgenRadius(M, s) * span * (o.squeeze || 1);
  if (x < 0.5 || z < 0.5 || x > G.w - 0.5 || z > G.h - 0.5) return null;
  const q = mapgenCellAt(G, x, z),
    ch = G.T[q];
  /* never in water (unless it grows there), on a bridge or a jetty, even when placed by hand (force); WA-5a: rocks may
     stand in shallows you wade (logic/water-gen.js waterGenShallows) */
  if (G.F[q] & (4 | 8 | 128) && !o.water && !(WATERGEN_SHALLOW_PROP.test(k) && waterGenShallows(G, q))) return null;
  if (!o.force) {
    if (G.F[q] & 1) return null;
    if (o.avoid && o.avoid.includes(ch)) return null;
    const d = G.dist[q] - G.roadPts[Math.max(0, G.near[q])]?.r;
    if (G.near[q] >= 0 && d < (o.road ?? 0.6) + r * 0.6) return null;
    if (!mapgenOccFree(G, x, z, r + (o.gap || 0))) return null;
    if (G.relief && mapgenOnCliff(G, x, z, r)) return null;
  }
  const p = { k, x: mapgenRound2(x), z: mapgenRound2(z), g: 1 };
  if (Math.abs(s - 1) > 0.02) p.s = mapgenRound2(s);
  if (v) p.v = v;
  if (o.f) p.f = 1;
  if (o.w) p.w = o.w;
  if (o.extra) Object.assign(p, o.extra);
  G.props.push(p);
  mapgenOccAdd(G, x, z, r);
  return p;
}

/* ---------- 1. heights ---------- */
export function mapgenStageHeights(G) {
  const { P, w, h } = G,
    s = G.salt('heights'),
    amp = P.land.hills * 2.6;
  let sum = 0;
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const v = amp * (mapgenFbm(i / 26, j / 26, s) - 0.5) * 2 + amp * 0.35 * (mapgenFbm(i / 8, j / 8, s + 5) - 0.5);
      G.H[j * (w + 1) + i] = v;
      sum += v;
    }
  const mean = sum / ((w + 1) * (h + 1));
  for (let q = 0; q < G.H.length; q++) G.H[q] -= mean;
}

/* ---------- MG-2: two scenes as one, for the Studio's "Preview the pair" ---------- */
/**
 * two scenes joined at A's exit idA and B's exit idB, laid into one scene as the game lays them side by side
 * (seamlessJoin's offset) with nothing eased and no countryside, so the Studio's preview shows how they really meet.
 * B is the scene shown (its look, hub, animals and townsfolk spots); the rest of the box is B's edge ground, walled
 * off (sc.inside: where you may walk). Exits are points only (sc.exits and sc.exitNames), the two that meet left
 * out. null when an exit is missing.
 */
export function mapgenPairScene(A, idA, B, idB) {
  const xa = mapgenExitOf(A, idA),
    xb = mapgenExitOf(B, idB);
  if (!xa || !xb) return null;
  const off = mapgenJoinOffset(A, xa, B, xb),
    x0 = Math.min(0, off[0]),
    z0 = Math.min(0, off[1]),
    w = Math.max(A.w, off[0] + B.w) - x0,
    h = Math.max(A.h, off[1] + B.h) - z0,
    parts = [
      { S: B, o: [off[0] - x0, off[1] - z0], skip: idB },
      { S: A, o: [-x0, -z0], skip: idA },
    ];
  const cellOf = (i, j) => parts.find(P => i >= P.o[0] && j >= P.o[1] && i < P.o[0] + P.S.w && j < P.o[1] + P.S.h);
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) {
    let row = '';
    for (let i = 0; i < w; i++) {
      const P = cellOf(i, j);
      row += P ? (P.S.tiles[P.S.h - 1 - (j - P.o[1])] || '')[i - P.o[0]] || P.S.edge || 'g' : B.edge || 'g';
    }
    tiles.push(row);
  }
  /* corners: a part's own (the joined edge agrees, B's taken); outside both, the nearest part's nearest corner */
  const heights = [];
  for (let j = h; j >= 0; j--) {
    const row = [];
    for (let i = 0; i <= w; i++) {
      let best = /** @type {any[]} */ ([]),
        bd = 1e9;
      for (const P of parts) {
        const cx = mapgenBetween(i, P.o[0], P.o[0] + P.S.w),
          cz = mapgenBetween(j, P.o[1], P.o[1] + P.S.h),
          d = Math.hypot(cx - i, cz - j);
        if (d < bd) ((bd = d), (best = [P, cx, cz]));
      }
      const [P, cx, cz] = best;
      row.push(mapgenSceneCorner(P.S, cx - P.o[0], cz - P.o[1]));
    }
    heights.push(row);
  }
  /** @type {any} */
  const sc = {};
  for (const [k, v] of Object.entries(B))
    if (
      ![
        'tiles',
        'heights',
        'steps',
        'stepm',
        'props',
        'exits',
        'edgeExits',
        'hub',
        'streams',
        'bridges',
        'waters',
        'npcSpots',
        'gen',
        'stepsV',
      ].includes(k)
    )
      sc[k] = v;
  Object.assign(sc, {
    name: `${B.name || 'draft'} + ${A.name || 'neighbour'}`,
    w,
    h,
    edge: B.edge || 'g',
    tiles,
    heights,
  });
  if (A.steps || B.steps) {
    const W2 = w * 2,
      S = new Int16Array(W2 * h * 2),
      M = new Uint8Array(W2 * h * 2);
    for (const P of parts) {
      if (!P.S.steps) continue;
      const u = mapgenDecodeBase64(P.S.steps),
        R = new Int16Array(u.buffer, 0, u.length >> 1),
        F = P.S.stepm ? mapgenDecodeBase64(P.S.stepm) : null,
        w2 = P.S.w * 2;
      for (let j = 0; j < P.S.h * 2; j++)
        for (let i = 0; i < w2; i++) {
          const q = (j + P.o[1] * 2) * W2 + i + P.o[0] * 2;
          S[q] = R[j * w2 + i] || 0;
          M[q] = F ? F[j * w2 + i] || 0 : 0;
        }
    }
    sc.steps = mapgenEncodeBase64(new Uint8Array(S.buffer));
    sc.stepm = mapgenEncodeBase64(M);
  }
  const tr = (P, x, z) => [mapgenRound2(x + P.o[0]), mapgenRound2(z + P.o[1])];
  sc.props = [];
  sc.exits = [];
  sc.exitNames = [];
  for (const P of parts) {
    const S = P.S;
    for (const q of S.props || []) {
      const [x, z] = tr(P, q.x, q.z);
      sc.props.push({ ...q, x, z });
    }
    for (const k of ['streams'])
      if (S[k]) sc[k] = (sc[k] || []).concat(S[k].map(o => ({ ...o, pts: o.pts.map(p => tr(P, p[0], p[1])) })));
    if (S.bridges)
      sc.bridges = (sc.bridges || []).concat(S.bridges.map(o => ({ ...o, a: tr(P, ...o.a), b: tr(P, ...o.b) })));
    if (S.waters) sc.waters = (sc.waters || []).concat(S.waters.map(o => ({ ...o, x: o.x + P.o[0], z: o.z + P.o[1] })));
    (S.edgeExits || []).forEach((e, k) => {
      if (e.id === P.skip) return;
      const p = (S.exits || [])[k] || mapgenExitPoint(S.w, S.h, e);
      sc.exits.push(tr(P, p[0], p[1]));
      sc.exitNames.push(`${P.S === B ? '' : (A.name || 'neighbour') + ' '}${e.id}`);
    });
  }
  sc.props.sort((a, b) => b.z - a.z || a.x - b.x);
  sc.hub = tr(parts[0], ...(B.hub || [B.w / 2, B.h / 2]));
  sc.npcSpots = (B.npcSpots || []).map(p => tr(parts[0], p[0], p[1]));
  sc.inside = parts.map(P => [P.o[0], P.o[1], P.o[0] + P.S.w, P.o[1] + P.S.h]);
  sc.pair = { a: idA, b: idB, off, of: [parts[1].o, parts[0].o] };
  return sc;
}

/* ---------- MG-2: the land meets the neighbour along a joined edge ---------- */
/** the depth of point (x, z) from a side of the map, and how far along that side it is */
/** WM-1: the side the way on leaves by (params.ahead; west when not given, as before runs went west to east)
 * @param {any} P */
export const mapgenAhead = P => P.ahead || 'W';
/** WM-1: how far a point lies toward a side (larger is further) @param {string} side @param {number[]} p [x, z] */
export const mapgenToward = (side, p) => (side === 'E' ? p[0] : side === 'W' ? -p[0] : side === 'N' ? p[1] : -p[1]);
export const mapgenDepth = (G, side, x, z) => (side === 'S' ? z : side === 'N' ? G.h - z : side === 'W' ? x : G.w - x);
export const mapgenAlong = (side, x, z) => (side === 'N' || side === 'S' ? x : z);
/** a side's corner heights corrected toward each joined strip: corr[u] for every corner u along the side. Full
 * correction where a strip is, a 4 m fade past its ends, and where two strips share a side (a node with two
 * parents) each holds to the midpoint between their exits less 2 m, blended across the 4 m between (as
 * seamless-world.js seamlessSeamOf shares a side) */
export function mapgenEdgeCorrection(G, side, strips) {
  const L = side === 'N' || side === 'S' ? G.w : G.h,
    edge = u =>
      mapgenCornerHeight(
        G,
        ...(side === 'N' || side === 'S' ? [u, side === 'N' ? G.h : 0] : [side === 'E' ? G.w : 0, u])
      ),
    list = strips.slice().sort((a, b) => a.at - b.at),
    corr = new Float32Array(L + 1),
    weight = new Float32Array(L + 1);
  list.forEach((s, k) => {
    const n = s.heights.length,
      a = Math.max(s.u0, k ? Math.ceil((list[k - 1].at + s.at) / 2 + 2) : -1e9),
      b = Math.min(s.u0 + n - 1, k < list.length - 1 ? Math.floor((s.at + list[k + 1].at) / 2 - 2) : 1e9);
    if (b < a) return;
    const diff = u => s.heights[mapgenBetween(u, a, b) - s.u0] - edge(mapgenBetween(u, a, b));
    for (let u = Math.max(0, a - 4); u <= Math.min(L, b + 4); u++) {
      const f = u < a ? mapgenSmooth(1 - (a - u) / 4) : u > b ? mapgenSmooth(1 - (u - b) / 4) : 1;
      if (f <= 0) continue;
      corr[u] += diff(u) * f;
      weight[u] += f;
    }
  });
  for (let u = 0; u <= L; u++) if (weight[u] > 1) corr[u] /= weight[u];
  return corr;
}
/** the land pinned to the joined strips: each corner moves by its side's correction, less and less further in
 * (gone at `fade` metres). Run on the raw land (fade 16) and again once nothing else moves the land (fade 6), so the
 * joined edge ends exactly at the neighbour's heights */
export function mapgenPinEdges(G, fade) {
  const sides = {};
  for (const s of G.joined) (sides[s.side] = sides[s.side] || []).push(s);
  for (const [side, strips] of Object.entries(sides)) {
    const corr = mapgenEdgeCorrection(G, side, strips);
    for (let j = 0; j <= G.h; j++)
      for (let i = 0; i <= G.w; i++) {
        const d = mapgenDepth(G, side, i, j);
        if (d >= fade) continue;
        const c = corr[mapgenAlong(side, i, j)];
        if (c) G.H[j * (G.w + 1) + i] += c * (1 - mapgenSmooth(d / fade));
      }
  }
}
/** the sides in params.pin brought to height 0 at their edge, less and less further in (gone at `fade` metres): a
 * run's scenes pin their east and west edges, so two scenes meet with no step wherever they join, even where a
 * scene's two neighbours' strips overlap on its 64 m edge. Run with the joined edges (fade 16, then 6) */
export function mapgenPinSides(G, fade) {
  for (const side of G.P.pin || '')
    for (let j = 0; j <= G.h; j++)
      for (let i = 0; i <= G.w; i++) {
        const d = mapgenDepth(G, side, i, j);
        /* WA-3a: a river's crossing keeps its bed (the neighbour takes it from the edge strip) */
        if (d < fade && !(G.riverKeep && G.riverKeep[j * (G.w + 1) + i]))
          G.H[j * (G.w + 1) + i] *= mapgenSmooth(d / fade);
      }
}
/** is (x, z) within `depth` metres of a joined edge's strip (with its 4 m fade) */
export function mapgenNearJoined(G, x, z, depth) {
  for (const s of G.joined) {
    const u = mapgenAlong(s.side, x, z);
    if (mapgenDepth(G, s.side, x, z) < depth && u > s.u0 - 4 && u < s.u0 + s.heights.length + 3) return true;
  }
  return false;
}

/* ---------- 3. road: a curve between the exits through the hub, sampled every half metre ---------- */
export function mapgenBezier(a, b, c, d, t) {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}
export function mapgenResample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = step - carry;
    while (t <= L) {
      out.push([a[0] + ((b[0] - a[0]) * t) / L, a[1] + ((b[1] - a[1]) * t) / L]);
      t += step;
    }
    carry = L - (t - step);
  }
  const last = pts[pts.length - 1],
    tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  else out[out.length - 1] = last;
  return out;
}
export function mapgenPolyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
/** a road from exit a to exit b (or to a point inside when b has no side), in the given shape */
export function mapgenRoadCurve(G, A, B, shape, rnd, ns) {
  const { w, h, P } = G,
    wob = P.road.wobble,
    m = 4;
  const nA = MAPGEN_INWARD[A.side],
    a0 = A.pt,
    a1 = [a0[0] + nA[0] * MAPGEN_STRAIGHT_IN, a0[1] + nA[1] * MAPGEN_STRAIGHT_IN];
  const nB = B.side ? MAPGEN_INWARD[B.side] : null,
    b0 = B.pt,
    b1 = nB ? [b0[0] + nB[0] * MAPGEN_STRAIGHT_IN, b0[1] + nB[1] * MAPGEN_STRAIGHT_IN] : b0;
  const L = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1;
  const c1 = [a1[0] + nA[0] * L * 0.35, a1[1] + nA[1] * L * 0.35],
    c2 = nB ? [b1[0] + nB[0] * L * 0.35, b1[1] + nB[1] * L * 0.35] : [(a1[0] + b1[0]) / 2, (a1[1] + b1[1]) / 2];
  const n = Math.max(24, Math.ceil(L / 0.5));
  const base = [];
  for (let i = 0; i <= n; i++) base.push(mapgenBezier(a1, c1, c2, b1, i / n));
  /* the shape: an offset across the base curve that fades in and out at both ends */
  const across = Math.min(w, h),
    waves = rnd.range(1.3, 2.2),
    ph = rnd.range(0, Math.PI * 2),
    ph2 = rnd.range(0, Math.PI * 2),
    legs = mapgenBetween(Math.round(L / 28), 3, 5);
  const amp = { straight: 0, winding: 0.16, scurve: 0.26, switchback: 0.28 }[shape] * across * (0.6 + 0.8 * wob);
  const out = [a0];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      p = base[i],
      q = base[Math.min(n, i + 1)],
      o = base[Math.max(0, i - 1)];
    let tx = q[0] - o[0],
      tz = q[1] - o[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const env = Math.pow(Math.sin(Math.PI * t), 0.8);
    let off = 0;
    if (shape === 'winding')
      off = Math.sin(t * waves * 2 * Math.PI + ph) + 0.25 * Math.sin(t * 5.1 * 2 * Math.PI + ph2);
    else if (shape === 'scurve') off = Math.sin(t * 2 * Math.PI);
    else if (shape === 'switchback') {
      const u = t * legs;
      off = 1 - 2 * Math.abs(((u + 0.25) % 1) * 2 - 1);
      off = Math.sign(off) * Math.pow(Math.abs(off), 0.6);
    }
    off = off * amp * env + (mapgenNoise(t * L * 0.08, 3.7, ns) - 0.5) * 2 * wob * 3 * env;
    out.push([mapgenBetween(p[0] - tz * off, m, w - m), mapgenBetween(p[1] + tx * off, m, h - m)]);
  }
  if (nB) out.push(b0);
  /* smooth the corners the between and the switchback make, keeping the straight ends */
  let pts = mapgenResample(out, 0.5);
  for (let pass = 0; pass < (shape === 'switchback' ? 8 : 4); pass++) {
    const nx = pts.map(p => p.slice());
    for (let i = 2; i < pts.length - 2; i++) {
      const fromA = i * 0.5,
        fromB = (pts.length - 1 - i) * 0.5;
      if (fromA < MAPGEN_STRAIGHT_IN - 0.5 || (nB && fromB < MAPGEN_STRAIGHT_IN - 0.5)) continue;
      nx[i] = [
        (pts[i - 2][0] + pts[i - 1][0] * 2 + pts[i][0] * 2 + pts[i + 1][0] * 2 + pts[i + 2][0]) / 8,
        (pts[i - 2][1] + pts[i - 1][1] * 2 + pts[i][1] * 2 + pts[i + 1][1] * 2 + pts[i + 2][1]) / 8,
      ];
    }
    pts = nx;
  }
  return mapgenResample(pts, 0.5);
}
export function mapgenStageRoad(G) {
  const { P, w, h } = G,
    rnd = G.rng('road'),
    ns = G.salt('road');
  const E = P.road.exits.map(e => ({ ...e, pt: mapgenExitPoint(w, h, e) }));
  G.exits = E;
  const half = P.road.width / 2;
  if (E.length === 1) {
    /* a dead end: the road runs from the exit to a hub inside */
    const e = E[0],
      nA = MAPGEN_INWARD[e.side],
      deep = (e.side === 'N' || e.side === 'S' ? h : w) * 0.55;
    const end = [mapgenBetween(e.pt[0] + nA[0] * deep, 8, w - 8), mapgenBetween(e.pt[1] + nA[1] * deep, 8, h - 8)];
    G.road.push({ pts: mapgenRoadCurve(G, e, { pt: end }, P.road.shape, rnd, ns), width: P.road.width, main: true });
  } else {
    G.road.push({ pts: mapgenRoadCurve(G, E[0], E[1], P.road.shape, rnd, ns), width: P.road.width, main: true });
  }
  /* the hub, a first guess (chooseHub settles it once the water is in): half way along the main road, or at its end */
  const M = G.road[0].pts,
    hk = E.length === 1 ? M.length - 1 : Math.floor(M.length / 2);
  G.hubK = hk;
  G.hub = [mapgenRound2(M[hk][0]), mapgenRound2(M[hk][1])];
  /* more exits branch off the main road where it passes nearest the end of their straight run in (a gentle
     curve: a shaped branch doubles back on itself) */
  for (let x = 2; x < E.length; x++) {
    const e = E[x],
      n = MAPGEN_INWARD[e.side],
      in7 = [e.pt[0] + n[0] * MAPGEN_STRAIGHT_IN, e.pt[1] + n[1] * MAPGEN_STRAIGHT_IN];
    let best = hk,
      bd = 1e9;
    for (let i = 2 * MAPGEN_STRAIGHT_IN; i < M.length - 2 * MAPGEN_STRAIGHT_IN; i++) {
      const d = Math.hypot(M[i][0] - in7[0], M[i][1] - in7[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    const pts = mapgenRoadCurve(G, e, { pt: M[best] }, 'straight', rnd, ns + x);
    G.road.push({ pts, width: Math.max(1.6, P.road.width * 0.85), main: false });
  }
  /* the distance field: every road sample stamps the cells round it */
  let s = 0;
  for (let k = 0; k < G.road.length; k++) {
    const R = G.road[k];
    for (let i = 0; i < R.pts.length; i++) {
      if (i) s += Math.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]);
      G.roadPts.push({ x: R.pts[i][0], z: R.pts[i][1], r: R.width / 2, s, k });
    }
  }
  const reach = 14;
  G.roadPts.forEach((p, n) => {
    for (let j = Math.max(0, Math.floor(p.z - reach)); j < Math.min(h, Math.ceil(p.z + reach)); j++)
      for (let i = Math.max(0, Math.floor(p.x - reach)); i < Math.min(w, Math.ceil(p.x + reach)); i++) {
        const d = Math.hypot(i + 0.5 - p.x, j + 0.5 - p.z),
          q = j * w + i;
        if (d - p.r < G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0)) {
          G.dist[q] = d;
          G.near[q] = n;
        }
      }
  });
  /* paint: the surface, then a verge whose edge the softness dial roughens */
  const surf = MAPGEN_SURFACES[P.road.surface],
    verge = G.B.ground.verge,
    vw = 0.4 + 1.4 * P.road.verge,
    vs = G.salt('road', 'verge');
  for (let q = 0; q < w * h; q++) {
    if (G.near[q] < 0) continue;
    const r = G.roadPts[G.near[q]].r,
      d = G.dist[q] - r,
      x = q % w,
      z = Math.floor(q / w);
    if (d <= 0) {
      G.T[q] = surf;
      G.F[q] |= 1;
    } else if (d < vw * (0.35 + 0.9 * mapgenNoise(x / 2.3, z / 2.3, vs)) && P.road.verge > 0.02) {
      G.T[q] = verge;
      G.F[q] |= 2;
    }
  }
  /* flatten: a smoothed height along each road, its slope limited, blended out to the sides */
  mapgenFlattenRoads(G, half);
}
export function mapgenCornerHeight(G, x, z) {
  const i = mapgenBetween(Math.round(x), 0, G.w),
    j = mapgenBetween(Math.round(z), 0, G.h);
  return G.H[j * (G.w + 1) + i];
}
export function mapgenFlattenRoads(G, half) {
  const { w, h } = G,
    prof = new Float32Array(G.roadPts.length);
  for (const R of G.road) {
    const n = R.pts.length,
      raw = R.pts.map(p => mapgenCornerHeight(G, p[0], p[1])),
      win = 14;
    const sm = raw.map((_, i) => {
      let s = 0,
        c = 0;
      for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) {
        s += raw[k];
        c++;
      }
      return s / c;
    });
    const lim = 0.09; /* per half metre: 18% at most */
    for (let i = 1; i < n; i++) sm[i] = mapgenBetween(sm[i], sm[i - 1] - lim, sm[i - 1] + lim);
    for (let i = n - 2; i >= 0; i--) sm[i] = mapgenBetween(sm[i], sm[i + 1] - lim, sm[i + 1] + lim);
    R.prof = sm;
  }
  let o = 0;
  for (const R of G.road) {
    for (let i = 0; i < R.pts.length; i++) prof[o + i] = R.prof[i];
    o += R.pts.length;
  }
  /* corners: nearest road sample by brute force within reach (the cell field is at centres) */
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const q = mapgenBetween(j, 0, h - 1) * w + mapgenBetween(i, 0, w - 1),
        k = G.near[q];
      if (k < 0) continue;
      const p = G.roadPts[k],
        d = Math.hypot(i - p.x, j - p.z) - p.r,
        inner = 1.2,
        blend = 5;
      if (d > inner + blend) continue;
      const t = d <= inner ? 1 : 1 - mapgenSmooth((d - inner) / blend),
        c = j * (w + 1) + i;
      G.H[c] = G.H[c] * (1 - t) + prof[k] * t;
    }
  void half;
}

/* ---------- 4. exits and hub ---------- */
export function mapgenSimplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = /** @type {number[]} */ (st.pop());
    let md = 0,
      mi = -1;
    const A = pts[a],
      B = pts[b],
      vx = B[0] - A[0],
      vz = B[1] - A[1],
      l2 = vx * vx + vz * vz || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const t = mapgenBetween(((pts[i][0] - A[0]) * vx + (pts[i][1] - A[1]) * vz) / l2, 0, 1),
        d = Math.hypot(A[0] + vx * t - pts[i][0], A[1] + vz * t - pts[i][1]);
      if (d > md) {
        md = d;
        mi = i;
      }
    }
    if (md > tol && mi > 0) {
      keep[mi] = 1;
      st.push([a, mi], [mi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}
/* the hub: the main road's sample nearest its middle (or its end) with dry ground all round, away from the exits */
export function mapgenChooseHub(G) {
  const M = G.road[0].pts,
    want = G.exits.length === 1 ? M.length - 1 : Math.floor(M.length / 2),
    lo = 2 * MAPGEN_STRAIGHT_IN + 6;
  const ok = (k, r, away) => {
    let dry = true;
    mapgenPaintDisc(G, M[k][0], M[k][1], r, q => {
      if (G.F[q] & (4 | 8)) dry = false;
    });
    return (
      dry &&
      G.exits.every(e => Math.hypot(M[k][0] - e.pt[0], M[k][1] - e.pt[1]) > away) &&
      !mapgenNearJoined(G, M[k][0], M[k][1], away)
    );
  };
  /* first with room round it; on a crowded map (water along a short road) a dry spot of the road will do */
  for (const [r, away, from] of [
    [4, 10, Math.min(lo, want)],
    [1.5, 4, 4],
  ])
    for (let d = 0; d < M.length; d++)
      for (const k of [want - d, want + d])
        if (k >= from && k < M.length && ok(k, r, away)) {
          G.hubK = k;
          G.hub = [mapgenRound2(M[k][0]), mapgenRound2(M[k][1])];
          return;
        }
  G.notes.push('no dry spot on the road for the hub');
}
export function mapgenStageExits(G) {
  const { w, h } = G,
    used = {};
  const M = G.road[0].pts,
    hk = G.hubK;
  G.edgeExits = G.exits.map((e, x) => {
    used[e.side] = (used[e.side] || 0) + 1;
    const id = MAPGEN_SIDE_NAME[e.side] + (used[e.side] > 1 ? used[e.side] : '');
    /* the walk from the hub: along the main road, or along it to the branch and then out */
    let path;
    if (x === 0) path = M.slice(0, hk + 1).reverse();
    else if (x === 1) path = M.slice(hk);
    else {
      const R = G.road[x - 1].pts,
        end = R[R.length - 1];
      let bi = 0,
        bd = 1e9;
      for (let i = 0; i < M.length; i++) {
        const d = Math.hypot(M[i][0] - end[0], M[i][1] - end[1]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const toBranch = bi >= hk ? M.slice(hk, bi + 1) : M.slice(bi, hk + 1).reverse();
      path = toBranch.concat(R.slice().reverse());
    }
    path = path.slice();
    path[0] = G.hub;
    path[path.length - 1] = e.pt;
    const len = Math.round(mapgenPolyLength(path) * 2) / 2;
    G.keep.push([e.pt[0], e.pt[1], 2.2]);
    return {
      id,
      side: e.side,
      t: +e.t.toFixed(4),
      in: MAPGEN_EXIT_IN,
      width: e.width,
      len,
      path: mapgenSimplify(path, 0.4).map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
    };
  });
  /* the hub: flat, clear of trees */
  const [hx, hz] = G.hub,
    hh = mapgenCornerHeight(G, hx, hz);
  for (let j = Math.max(0, Math.floor(hz - 4)); j <= Math.min(h, Math.ceil(hz + 4)); j++)
    for (let i = Math.max(0, Math.floor(hx - 4)); i <= Math.min(w, Math.ceil(hx + 4)); i++) {
      const d = Math.hypot(i - hx, j - hz);
      if (d > 4) continue;
      const t = d < 2.5 ? 1 : 1 - mapgenSmooth((d - 2.5) / 1.5),
        c = j * (w + 1) + i;
      G.H[c] = G.H[c] * (1 - t) + hh * t;
    }
  G.keep.push([hx, hz, 2.2]);
}

/* ---------- land: water and terraces (part of the ground stage, after the road is known) ---------- */
export function mapgenPaintDisc(G, cx, cz, r, fn) {
  for (let j = Math.max(0, Math.floor(cz - r - 1)); j < Math.min(G.h, Math.ceil(cz + r + 1)); j++)
    for (let i = Math.max(0, Math.floor(cx - r - 1)); i < Math.min(G.w, Math.ceil(cx + r + 1)); i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cz);
      if (d <= r) fn(j * G.w + i, d);
    }
}
export function mapgenLowerWater(G) {
  /* water corners sit a little under their bank, each body levelled to its lowest corner. A corner is shared by up to
     four water cells: it is lowered once, from its height before (each visit lowering it again sank a stream's and a
     coast's water up to 1.8 m under its banks) */
  const { w, h } = G,
    H0 = Float32Array.from(G.H),
    isW = (i, j) => i >= 0 && j >= 0 && i < w && j < h && G.F[j * w + i] & 4;
  const seen = new Uint8Array(w * h);
  for (let q0 = 0; q0 < w * h; q0++) {
    if (!(G.F[q0] & 4) || seen[q0]) continue;
    const body = [q0];
    seen[q0] = 1;
    for (let n = 0; n < body.length; n++) {
      const q = body[n],
        i = q % w,
        j = Math.floor(q / w);
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (isW(i + di, j + dj) && !seen[(j + dj) * w + i + di]) {
          seen[(j + dj) * w + i + di] = 1;
          body.push((j + dj) * w + i + di);
        }
    }
    const flow = body.length > 40 && G.streams.length; /* a stream follows the land; a pond lies level */
    let lo = 1e9;
    for (const q of body) lo = Math.min(lo, mapgenCornerHeight(G, q % w, Math.floor(q / w)));
    for (const q of body) {
      const i = q % w,
        j = Math.floor(q / w);
      for (const [ci, cj] of [
        [i, j],
        [i + 1, j],
        [i, j + 1],
        [i + 1, j + 1],
      ]) {
        const c = cj * (w + 1) + ci,
          inside = isW(ci, cj) && isW(ci - 1, cj) && isW(ci, cj - 1) && isW(ci - 1, cj - 1);
        const target = flow ? H0[c] - (inside ? 0.45 : 0.15) : lo - (inside ? 0.45 : 0.15);
        G.H[c] = Math.min(G.H[c], target);
      }
    }
  }
}
export function mapgenStreamLine(G, rnd, kind) {
  /* across the map between two sides with no exit if there are such, crossing the main road */
  const { w, h } = G,
    sides = 'NSEW'.split('').filter(s => !G.exits.some(e => e.side === s));
  const pairs = [
    ['N', 'S'],
    ['E', 'W'],
  ];
  let pair = pairs.find(p => sides.includes(p[0]) && sides.includes(p[1])) || pairs[rnd.int(0, 1)];
  if (rnd.chance(0.5)) pair = [pair[1], pair[0]];
  const M = G.road[0].pts,
    mid =
      M[Math.floor(M.length * (rnd.chance(0.5) ? rnd.range(0.22, 0.38) : rnd.range(0.62, 0.78)))]; /* not at the hub */
  const edge = (s, t) =>
    s === 'N' ? [t * w, h + 1] : s === 'S' ? [t * w, -1] : s === 'E' ? [w + 1, t * h] : [-1, t * h];
  const along = pair[0] === 'N' || pair[0] === 'S' ? mid[0] / w : mid[1] / h;
  const A = edge(pair[0], mapgenBetween(along + rnd.range(-0.2, 0.2), 0.15, 0.85)),
    Z = edge(pair[1], mapgenBetween(along + rnd.range(-0.2, 0.2), 0.15, 0.85));
  const pts = [];
  const n = 40,
    ns = G.salt('heights', 'stream' + kind);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      bx = i < n / 2 ? A[0] + (mid[0] - A[0]) * (t * 2) : mid[0] + (Z[0] - mid[0]) * (t * 2 - 1),
      bz = i < n / 2 ? A[1] + (mid[1] - A[1]) * (t * 2) : mid[1] + (Z[1] - mid[1]) * (t * 2 - 1);
    const off = (mapgenNoise(t * 4, 1.3, ns) - 0.5) * 9 * Math.sin(Math.PI * t);
    const nx = pair[0] === 'N' || pair[0] === 'S' ? 1 : 0;
    pts.push([bx + off * nx, bz + off * (1 - nx)]);
  }
  return mapgenResample(pts, 0.5);
}
export function mapgenPaintStream(G, pts, width, kind) {
  const bank = G.B.ground.bank;
  for (const p of pts)
    mapgenPaintDisc(G, p[0], p[1], width / 2 + 0.9, (q, d) => {
      if (d <= width / 2) {
        G.T[q] = d < width / 2 - 1.1 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (!(G.F[q] & (1 | 4))) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    });
  const inside = pts.filter(p => p[0] >= 0 && p[1] >= 0 && p[0] <= G.w && p[1] <= G.h);
  const st = {
    pts: mapgenSimplify(inside, 0.3).map(p => [mapgenRound2(p[0]), mapgenRound2(p[1])]),
    speed: kind === 'lava' ? 0.15 : 0.6,
  };
  G.streams.push(st);
  for (let i = 0; i < inside.length; i += 3) mapgenOccAdd(G, inside[i][0], inside[i][1], 0.8);
  if (kind === 'lava') {
    /* lava is a water kind by area: a rectangle round each stretch of the flow */
    for (let i = 0; i < inside.length; i += 16) {
      const seg = inside.slice(i, i + 17);
      let x0 = 1e9,
        z0 = 1e9,
        x1 = -1e9,
        z1 = -1e9;
      for (const p of seg) {
        x0 = Math.min(x0, p[0]);
        z0 = Math.min(z0, p[1]);
        x1 = Math.max(x1, p[0]);
        z1 = Math.max(z1, p[1]);
      }
      const m = width / 2 + 0.6;
      G.waters.push({
        x: mapgenRound2(x0 - m),
        z: mapgenRound2(z0 - m),
        w: mapgenRound2(x1 - x0 + 2 * m),
        h: mapgenRound2(z1 - z0 + 2 * m),
        k: 'lava',
      });
    }
  }
}
export function mapgenPaintPond(G, rnd, size) {
  /* a pond away from the road, as big as the amount dial says */
  const { w, h } = G,
    R = 4 + size * 9;
  /** @type {number[] | null} */
  let best = null,
    bs = -1e9;
  for (let t = 0; t < 60; t++) {
    const x = rnd.range(R + 4, w - R - 4),
      z = rnd.range(R + 4, h - R - 4),
      d = mapgenRoadDist(G, x, z) - mapgenNearRoadWidth(G, x, z) - R - 2,
      hub = Math.hypot(x - G.hub[0], z - G.hub[1]) - R;
    const score = Math.min(d, 6) + Math.min(hub, 10) * 0.3 + rnd.next();
    if (d > 0 && score > bs) {
      bs = score;
      best = [x, z];
    }
  }
  if (!best) {
    G.notes.push('no room for a pond away from the road');
    return null;
  }
  const [cx, cz] = best,
    ns = G.salt('heights', 'pond'),
    ex = rnd.range(0.75, 1.3);
  const bank = G.B.ground.bank;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const dx = (i + 0.5 - cx) / ex,
        dz = (j + 0.5 - cz) * ex,
        a = Math.atan2(dz, dx),
        rr = R * (0.8 + 0.4 * mapgenNoise(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, ns)),
        d = Math.hypot(dx, dz),
        q = j * w + i;
      if (G.F[q] & 1) continue;
      if (d <= rr) {
        G.T[q] = d < rr - 2.2 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (d <= rr + 1.4 && !(G.F[q] & 4)) {
        G.T[q] = bank;
        G.F[q] |= 64;
      }
    }
  mapgenOccAdd(G, cx, cz, R * 0.8);
  return { x: cx, z: cz, r: R };
}
export function mapgenPaintCoast(G, rnd, size) {
  /* the sea along a side with no exit */
  const free = 'NSEW'.split('').filter(s => !G.exits.some(e => e.side === s));
  if (!free.length) {
    G.notes.push('every side has an exit: no coast');
    return;
  }
  const side = free.includes('N') ? 'N' : free[rnd.int(0, free.length - 1)],
    { w, h } = G,
    ns = G.salt('heights', 'coast');
  const deep = (side === 'N' || side === 'S' ? h : w) * (0.12 + 0.25 * size);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i,
        along = side === 'N' || side === 'S' ? i : j,
        from = side === 'N' ? h - j : side === 'S' ? j + 1 : side === 'E' ? w - i : i + 1,
        line = deep + (mapgenNoise(along / 9, 0.5, ns) - 0.5) * 8;
      if (G.F[q] & 1) continue; /* a road along the shore stays a road */
      if (from < line) {
        G.T[q] = from < line - 3 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (from < line + 1.6) {
        G.T[q] = 'S';
        G.F[q] |= 64;
      } else if (from < line + 4.5 && !(G.F[q] & 1)) G.T[q] = 's';
    }
  G.waterKind = 'sea';
}
/* RL-R2b: an islet (Surf's side-area town): the sea all round a round of land in the middle, its size 0-1 the
   land's share. The roads stay dry, so each exit's road crosses the water as a causeway (and the straight run in
   from an exit and a joined edge's strip stay land: mapgenStageWater), where the seam meets the neighbour's land */
export function mapgenPaintIslet(G, size) {
  const { w, h } = G,
    ns = G.salt('heights', 'islet'),
    rx = w * (0.2 + 0.14 * size),
    rz = h * (0.3 + 0.12 * size),
    /* round the hub's first guess (mapgenStageRoad), the sea at least 3 m wide all round where it fits */
    mid = (/** @type {number} */ v, /** @type {number} */ r, /** @type {number} */ n) =>
      r + 3 < n - r - 3 ? mapgenBetween(v, r + 3, n - r - 3) : n / 2,
    cx = mid(G.hub ? G.hub[0] : w / 2, rx * 1.14, w),
    cz = mid(G.hub ? G.hub[1] : h / 2, rz * 1.14, h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (G.F[q] & 1) continue; /* a road stays a road: the causeways */
      const dx = (i + 0.5 - cx) / rx,
        dz = (j + 0.5 - cz) / rz,
        a = Math.atan2(dz, dx),
        r = Math.hypot(dx, dz) * rz,
        line = rz * (0.86 + 0.28 * mapgenNoise(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 3, ns)),
        from = r - line;
      if (from > 0) {
        G.T[q] = from > 3 ? 'd' : 'w';
        G.F[q] = (G.F[q] & ~(2 | 32 | 64)) | 4;
      } else if (from > -1.6) {
        G.T[q] = 'S';
        G.F[q] |= 64;
      } else if (from > -4.5) G.T[q] = 's';
    }
  /* the causeways: a sandbar a metre and a half each side of a road over the water */
  const near = [];
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++)
      if (G.F[j * w + i] & 1)
        for (let dj = -2; dj <= 2; dj++)
          for (let di = -2; di <= 2; di++) {
            const ii = i + di,
              jj = j + dj;
            if (ii >= 0 && jj >= 0 && ii < w && jj < h && G.F[jj * w + ii] & 4) near.push(jj * w + ii);
          }
  for (const q of near) {
    G.F[q] = (G.F[q] & ~4) | 64;
    G.T[q] = 'S';
  }
  G.waterKind = 'sea';
}
export function mapgenTerraces(G, levels) {
  /* bands across the depth that rise toward the back, each a step up; the road ramps through them */
  const { w, h, P } = G,
    W2 = w * 2,
    H2 = h * 2,
    rise = Math.round((0.4 + P.land.cliffs * 1.2) * 20) / 20,
    ns = G.salt('heights', 'terrace');
  /* MG-2: at ground level by every exit's edge, over the stretch a neighbour shows there (MAPGEN_BAND and 4 m), so a
     joined neighbour's land meets this one with no wall: within 8 m of that stretch no raise, then a level more
     every 6 m (never a wall of more than one rise) */
  const zones = G.exits.map(e => {
      const a = e.side === 'N' || e.side === 'S' ? e.pt[0] : e.pt[1];
      return { side: e.side, lo: a - MAPGEN_BAND - 4, hi: a + MAPGEN_BAND + 4 };
    }),
    zoneDist = (x, z) => {
      let best = 1e9;
      for (const Z of zones) {
        const u = mapgenAlong(Z.side, x, z),
          du = u < Z.lo ? Z.lo - u : u > Z.hi ? u - Z.hi : 0;
        best = Math.min(best, Math.hypot(du, mapgenDepth(G, Z.side, x, z)));
      }
      return best;
    };
  const lvl = (x, z) => {
    const t = (z - 8) / (h - 16) + (mapgenFbm(x / 14, z / 14, ns) - 0.5) * 0.35;
    return Math.min(
      mapgenBetween(Math.floor(t * (levels + 1)), 0, levels),
      Math.floor(Math.max(0, zoneDist(x, z) - 8) / 6)
    );
  };
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) G.S[j * W2 + i] = lvl((i + 0.5) / 2, (j + 0.5) / 2) * rise;
  /* along each road: the raise ramps no faster than 0.1 m a half metre */
  const lim = 0.1;
  let o = 0;
  const prof = new Float32Array(G.roadPts.length);
  for (const R of G.road) {
    const n = R.pts.length,
      raw = R.pts.map(p => lvl(p[0], p[1]) * rise);
    const win = Math.ceil((rise / lim) * 0.6),
      sm = raw.map((_, i) => {
        let s = 0,
          c = 0;
        for (let k = Math.max(0, i - win); k <= Math.min(n - 1, i + win); k++) {
          s += raw[k];
          c++;
        }
        return s / c;
      });
    /* MG-2: no higher than a ramp from the nearest stretch of road at ground level by an exit's edge, so the exit
       stays at 0 (a guard: with the levels stepping down every 6 m the ramp limit already keeps it there in every
       scene tried, but a road running along an edge could be lifted by the smoothing) */
    const away = R.pts.map(p => (zoneDist(p[0], p[1]) <= 8 ? 0 : 1e9));
    for (let i = 1; i < n; i++) away[i] = Math.min(away[i], away[i - 1] + 1);
    for (let i = n - 2; i >= 0; i--) away[i] = Math.min(away[i], away[i + 1] + 1);
    for (let i = 0; i < n; i++) sm[i] = Math.min(sm[i], lim * away[i]);
    for (let i = 1; i < n; i++) sm[i] = mapgenBetween(sm[i], sm[i - 1] - 0.1, sm[i - 1] + 0.1);
    for (let i = n - 2; i >= 0; i--) sm[i] = mapgenBetween(sm[i], sm[i + 1] - 0.1, sm[i + 1] + 0.1);
    for (let i = 0; i < n; i++) prof[o + i] = Math.round(sm[i] * 20) / 20;
    o += n;
  }
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        q = mapgenCellAt(G, x, z),
        k = G.near[q];
      if (k < 0) continue;
      const p = G.roadPts[k];
      if (Math.hypot(x - p.x, z - p.z) <= p.r + 0.75) {
        G.S[j * W2 + i] = prof[k];
        G.M[j * W2 + i] |= 32; /* TR-1: a ramp, so the road climbs as a slope, not 5 cm stairs */
      }
    }
  /* the hub's and the exits' surroundings sit at their road's raise */
  for (const [cx, cz, rr] of [[G.hub[0], G.hub[1], 3.5], ...G.exits.map(e => [e.pt[0], e.pt[1], 3])]) {
    const k = G.near[mapgenCellAt(G, cx, cz)],
      v = k >= 0 ? prof[k] : 0;
    for (let j = 0; j < H2; j++)
      for (let i = 0; i < W2; i++)
        if (Math.hypot((i + 0.5) / 2 - cx, (j + 0.5) / 2 - cz) <= rr) {
          G.S[j * W2 + i] = v;
          G.M[j * W2 + i] |= 32;
        }
  }
  /* water lies at the bottom: no raise under it (under a bridge the road's ramp goes on, so the deck meets its ends) */
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++)
      if ((G.F[mapgenCellAt(G, (i + 0.5) / 2, (j + 0.5) / 2)] & (4 | 8)) === 4) G.S[j * W2 + i] = 0;
  /* where ramps meet (a branch on the main road, the hub's and the exits' rounds) a walkable cell is lowered until it
     is no more than 0.25 m above any walkable neighbour (a step is walkable up to 0.34 m) */
  const walk = new Uint8Array(W2 * H2);
  for (let j = 0; j < H2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        k = G.near[mapgenCellAt(G, x, z)];
      if (k >= 0 && Math.hypot(x - G.roadPts[k].x, z - G.roadPts[k].z) <= G.roadPts[k].r + 0.75) walk[j * W2 + i] = 1;
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) <= 3.5 || G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) <= 3))
        walk[j * W2 + i] = 1;
    }
  for (let pass = 0, moved = 1; moved && pass < 400; pass++) {
    moved = 0;
    for (let q0 = 0; q0 < W2 * H2; q0++) {
      const q = pass % 2 ? W2 * H2 - 1 - q0 : q0;
      if (!walk[q]) continue;
      const i = q % W2,
        j = Math.floor(q / W2);
      let lo = G.S[q];
      if (i > 0 && walk[q - 1]) lo = Math.min(lo, G.S[q - 1] + 0.25);
      if (i < W2 - 1 && walk[q + 1]) lo = Math.min(lo, G.S[q + 1] + 0.25);
      if (j > 0 && walk[q - W2]) lo = Math.min(lo, G.S[q - W2] + 0.25);
      if (j < H2 - 1 && walk[q + W2]) lo = Math.min(lo, G.S[q + W2] + 0.25);
      if (lo < G.S[q] - 1e-6) {
        G.S[q] = lo;
        moved = 1;
      }
    }
  }
  mapgenRockEdges(G);
  G.stepsUsed = true;
}
/** the cells at a wall's top edge get the rock ground */
export function mapgenRockEdges(G) {
  const { w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    rock = G.B.ground.rock;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const q = j * w + i;
      if (G.F[q] & (1 | 4)) continue;
      const me = G.S[j * 2 * W2 + i * 2];
      let wall = false;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ii = mapgenBetween(i * 2 + di * 2, 0, W2 - 1),
          jj = mapgenBetween(j * 2 + dj * 2, 0, H2 - 1);
        if (me - G.S[jj * W2 + ii] > 0.3) wall = true;
      }
      if (wall) G.T[q] = rock;
    }
}

/* ---------- TR-2: mountains ---------- */
/** ridged noise in [0, 1]: sharp crests where smooth noise crosses its middle, each octave weighted by the one
 * before so the crests carry the detail (a ridged multifractal, three octaves) */
export function mapgenRidged(x, z, s) {
  let sum = 0,
    wgt = 1,
    amp = 0.55,
    f = 1;
  for (let o = 0; o < 3; o++) {
    let n = 1 - Math.abs(2 * mapgenNoise(x * f, z * f, s + o * 23) - 1);
    n *= n * wgt;
    sum += n * amp;
    wgt = mapgenBetween(n * 1.6, 0, 1);
    amp *= 0.5;
    f *= 2.1;
  }
  return mapgenBetween(sum / 0.9, 0, 1);
}
/** a mountain's height at each corner, (w+1) x (h+1), near row first: ridged noise on warped ground under a massif
 * mask (rising toward the sides in land.massif, its foot ragged), at nothing within 4 m of a road's edge (full
 * 18 m out), round the hub and its buildings (16-34 m), by every exit's stretch of edge (as the terraces keep it: 8-24
 * m) and by water (1-4 m). Its own noise ('relief'), so the rest of the scene doesn't move when it changes */
export function mapgenMountainField(G) {
  const { P, w, h } = G,
    s = G.salt('relief'),
    peak = P.land.mountains * MAPGEN_PEAK,
    sides = [...(P.land.massif || MAPGEN_MOUNTAIN_DIALS.massif)],
    E = new Float32Array((w + 1) * (h + 1));
  const zones = G.exits.map(e => {
      const a = e.side === 'N' || e.side === 'S' ? e.pt[0] : e.pt[1];
      return { side: e.side, lo: a - MAPGEN_BAND - 4, hi: a + MAPGEN_BAND + 4 };
    }),
    zoneDist = (x, z) => {
      let best = 1e9;
      for (const Z of zones) {
        const u = mapgenAlong(Z.side, x, z),
          du = u < Z.lo ? Z.lo - u : u > Z.hi ? u - Z.hi : 0;
        best = Math.min(best, Math.hypot(du, mapgenDepth(G, Z.side, x, z)));
      }
      return best;
    };
  /* water: the distance to the nearest water cell, up to 4 m */
  const wet = new Float32Array((w + 1) * (h + 1)).fill(9);
  for (let q = 0; q < w * h; q++) {
    if (!(G.F[q] & 4)) continue;
    const cx = (q % w) + 0.5,
      cz = Math.floor(q / w) + 0.5;
    for (let j = Math.max(0, Math.floor(cz - 4)); j <= Math.min(h, Math.ceil(cz + 4)); j++)
      for (let i = Math.max(0, Math.floor(cx - 4)); i <= Math.min(w, Math.ceil(cx + 4)); i++) {
        const c = j * (w + 1) + i;
        wet[c] = Math.min(wet[c], Math.hypot(i - cx, j - cz));
      }
  }
  const fade = (v, a, b) => mapgenSmooth(mapgenBetween((v - a) / (b - a), 0, 1));
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      /* the massif: highest at its sides, its foot pushed in and out by noise */
      const rag = (mapgenFbm(i / 18, j / 18, s + 3) - 0.5) * 18;
      let mask = 0;
      for (const sd of sides) {
        const reach = (sd === 'N' || sd === 'S' ? h : w) * 0.42;
        mask = Math.max(mask, 1 - mapgenBetween((mapgenDepth(G, sd, i, j) + rag) / reach, 0, 1));
      }
      if (mask <= 0) continue;
      const q = mapgenCellAt(G, i, j),
        rd = G.near[q] >= 0 ? G.dist[q] - G.roadPts[G.near[q]].r : 1e9,
        keep =
          fade(rd, 4, 18) *
          fade(Math.hypot(i - G.hub[0], j - G.hub[1]), 16, 34) *
          fade(zoneDist(i, j), 8, 24) *
          fade(wet[j * (w + 1) + i], 1, 4);
      if (keep <= 0) continue;
      /* the ridges, on ground warped by noise so they bend */
      const wx = i + (mapgenFbm(i / 30, j / 30, s + 11) - 0.5) * 24,
        wz = j + (mapgenFbm(i / 30, j / 30, s + 13) - 0.5) * 24,
        r = mapgenRidged(wx / 22, wz / 22, s + 41);
      E[j * (w + 1) + i] = peak * Math.pow(mask, 1.5) * (0.45 + 0.55 * r) * keep;
    }
  return E;
}
/** mountains (TR-2, the land.mountains dial): a quarter of the height is smooth land, which stays walkable; the rest
 * is step-grid shelves a terrace's height apart (0.8-2 m, the cliffs dial), so ground too steep to walk becomes cliffs
 * (stacked shelves: the step grid draws a rock face, a shoulder on top and scree below for drops of 0.7 m or more).
 * The cells at a cliff's top get the rock ground, and nothing is planted across a cliff (mapgenPutProp) */
export function mapgenMountains(G) {
  const { P, w, h } = G,
    W2 = w * 2,
    E = mapgenMountainField(G),
    band = Math.round((0.8 + P.land.cliffs * 1.2) * 20) / 20,
    a = MAPGEN_MOUNTAIN_SMOOTH,
    at = (i, j) => E[j * (w + 1) + i];
  let any = false;
  /* the terraces' raise before the shelves go on (a trail follows the ground as the terraces left it) */
  G.S0 = Float32Array.from(G.S);
  for (let q = 0; q < E.length; q++) G.H[q] += E[q] * a;
  for (let j = 0; j < h * 2; j++)
    for (let i = 0; i < W2; i++) {
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2,
        i0 = Math.floor(x),
        j0 = Math.floor(z),
        fx = x - i0,
        fz = z - j0,
        e =
          at(i0, j0) * (1 - fx) * (1 - fz) +
          at(i0 + 1, j0) * fx * (1 - fz) +
          at(i0, j0 + 1) * (1 - fx) * fz +
          at(i0 + 1, j0 + 1) * fx * fz,
        n = Math.floor((e * (1 - a)) / band);
      if (n > 0) {
        G.S[j * W2 + i] += n * band;
        any = true;
      }
    }
  if (!any) return;
  G.relief = true;
  G.stepsUsed = true;
  G.mtnE = E;
  mapgenTrails(G);
  mapgenRockEdges(G);
}
/* ---------- TR-2c: ledges ---------- */
/** a ledge's pieces, in half-metre cells: 3-10 m (Gen 3's are 3-10 tiles) */
export const MAPGEN_LEDGE_PIECE = [6, 20];
/** ledges (TR-2c, the land.ledges dial 0-1; inspired by Gen 3, where short ledges cut a route into bands you cross
 * one way): the fronts of the terraces that face south (toward the camera; the terraces rise toward the back) and drop
 * 0.35-1.8 m become, piece by piece, ledges you hop down from (stepm flag 16 on the upper cells: walk-view.js
 * canStepBetween), never climb. A piece is 3-10 m, a ledge by the dial's share, else it stays a cliff; between pieces a
 * 2 m flight of stairs (stone steps, at most 0.28 m a step) runs down the front onto the lower ground, the way back up,
 * so the shelf above is a lane beside the road you can drop off anywhere and climb at the stairs. Not on roads, water,
 * ramps or mountains. Its own stream ('ground', 'ledges'). Counts in G.ledgeCells and G.ledgeStairs */
export function mapgenLedges(G) {
  const { P, w, h } = G,
    W2 = w * 2,
    H2 = h * 2,
    rnd = G.rng('ground', 'ledges'),
    E = G.mtnE;
  const busy = (i, j) =>
    G.F[mapgenCellAt(G, (i + 0.5) / 2, (j + 0.5) / 2)] & (1 | 4 | 8 | 128) ||
    G.M[j * W2 + i] & (32 | 16) ||
    (E &&
      E[mapgenBetween(Math.round((j + 0.5) / 2), 0, h) * (w + 1) + mapgenBetween(Math.round((i + 0.5) / 2), 0, w)] > 0);
  const drop = (i, j) => G.S[j * W2 + i] - G.S[(j - 1) * W2 + i];
  const front = (i, j) => j > 0 && !busy(i, j) && !busy(i, j - 1) && drop(i, j) >= 0.35 && drop(i, j) <= 1.8;
  let ledges = 0,
    stairs = 0;
  /** a flight of stairs down the front at columns cols (each from its own front row: a front zigzags), 2 m wide: only
   * where every column's lower ground is free and nearly level */
  const flight = cols => {
    const plan = [];
    for (const [i, j] of cols) {
      const n = Math.ceil(drop(i, j) / 0.28);
      if (j - n - 1 < 0) return false;
      const lo = G.S[(j - 1) * W2 + i];
      for (let m = 1; m <= n + 1; m++) if (busy(i, j - m) || Math.abs(G.S[(j - m) * W2 + i] - lo) > 0.12) return false;
      plan.push([i, j, n]);
    }
    for (const [i, j, n] of plan) {
      const up = G.S[j * W2 + i],
        lo = G.S[(j - n - 1) * W2 + i];
      for (let m = 1; m <= n; m++) {
        const q = (j - m) * W2 + i;
        G.S[q] = Math.round((up - ((up - lo) * m) / (n + 1)) * 20) / 20;
        G.M[q] = (G.M[q] & ~(15 | 16)) | 8;
      }
    }
    return true;
  };
  /* the front cells, gathered into fronts (cells touching, corners too), each walked west to east a column at a time */
  const isFront = new Uint8Array(W2 * H2);
  for (let j = 1; j < H2; j++) for (let i = 0; i < W2; i++) if (front(i, j)) isFront[j * W2 + i] = 1;
  const seen = new Uint8Array(W2 * H2);
  for (let q0 = 0; q0 < W2 * H2; q0++) {
    if (!isFront[q0] || seen[q0]) continue;
    const cells = [],
      st = [q0];
    seen[q0] = 1;
    while (st.length) {
      const q = /** @type {number} */ (st.pop()),
        i = q % W2,
        j = Math.floor(q / W2);
      cells.push(q);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = i + di,
            jj = j + dj,
            r = jj * W2 + ii;
          if (ii >= 0 && jj >= 0 && ii < W2 && jj < H2 && isFront[r] && !seen[r]) {
            seen[r] = 1;
            st.push(r);
          }
        }
    }
    /** column -> its front cells (rows), west to east */
    const byCol = new Map();
    for (const q of cells) {
      const i = q % W2;
      if (!byCol.has(i)) byCol.set(i, []);
      byCol.get(i).push(Math.floor(q / W2));
    }
    const cols = [...byCol.keys()].sort((a, b) => a - b);
    let k = 0,
      since = 0; /* columns since the last flight on this front */
    while (k < cols.length) {
      /* a piece of 3-10 m of columns (a gap in the columns ends it) */
      const len = rnd.int(MAPGEN_LEDGE_PIECE[0], MAPGEN_LEDGE_PIECE[1]),
        led = rnd.next() < P.land.ledges;
      let m = k;
      while (m < cols.length && m - k < len && (m === k || cols[m] === cols[m - 1] + 1)) {
        if (led)
          for (const j of byCol.get(cols[m])) {
            G.M[j * W2 + cols[m]] |= 16;
            ledges++;
          }
        m++;
      }
      since += m - k;
      k = m;
      /* then, now and then (a third of the time, and at least every 24 m of front), the way back up: a flight over the
         next four columns, if they run on and the ground below takes it */
      if (
        (rnd.next() < 0.33 || since >= 48) &&
        k + 4 <= cols.length &&
        cols[k + 3] === cols[k] + 3 &&
        cols[k] === cols[k - 1] + 1
      ) {
        const fl = [0, 1, 2, 3].map(t => [cols[k + t], Math.max(...byCol.get(cols[k + t]))]);
        if (flight(fl)) {
          stairs++;
          k += 4;
          since = 0;
        }
      }
    }
  }
  G.ledgeCells = ledges;
  G.ledgeStairs = stairs;
}

/** a ledge that drops you into a trap (mapgenTraps: cells you reach but can't get back from) stays a cliff: its flag
 * comes off wherever its hop lands in a trapped cell. Walking is both ways, so only a hop leads into a trap, and
 * taking those hops away leaves none (the trap is no longer reached) */
export function mapgenUntrap(sc, scenery, G) {
  const T = mapgenTraps(sc, scenery);
  if (!T.n) return;
  const { gw, gh, seen } = T.R,
    back = T.back,
    M = mapgenDecodeBase64(sc.stepm);
  let cleared = 0;
  for (let q = 0; q < gw * gh; q++) {
    if (!(M[q] & 16)) continue;
    const i = q % gw,
      j = Math.floor(q / gw);
    for (const [di, dj] of MAPGEN_FOUR) {
      const ii = i + di,
        jj = j + dj,
        r = jj * gw + ii;
      if (ii >= 0 && jj >= 0 && ii < gw && jj < gh && seen[r] && !back[r]) {
        M[q] &= ~16;
        cleared++;
        break;
      }
    }
  }
  sc.stepm = mapgenEncodeBase64(M);
  if (G) G.ledgeCells -= cleared;
}

/** pockets (TR-2c; in Gen 3 the far corners reward the walk there, an item at a dead end or up a ledge): up to two
 * marked spots (G.spots, kind 'pocket') where the walk from the hub is longest (a raised shelf counting 50 m more), 6
 * m off the road, 3 m from the scene's edge, 8 m from the exits and from a summit, 20 m apart. Items and the like come
 * later */
export function mapgenPockets(sc, scenery, G) {
  const R = mapgenReach(sc, scenery, sc.hub, { slope: true }),
    { gw, gh, dist, N } = R,
    roadCh = Object.values(MAPGEN_SURFACES),
    exits = (sc.edgeExits || []).map(e => mapgenExitPoint(sc.w, sc.h, e)),
    cands = [];
  for (let q = 0; q < gw * gh; q++) {
    if (dist[q] < 0) continue;
    const x = ((q % gw) + 0.5) / N,
      z = (Math.floor(q / gw) + 0.5) / N;
    if (x < 3 || z < 3 || x > sc.w - 3 || z > sc.h - 3) continue;
    if (exits.some(p => Math.hypot(p[0] - x, p[1] - z) < 8)) continue;
    if (G.spots.some(p => Math.hypot(p.x - x, p.z - z) < 8)) continue;
    if (
      G.near[mapgenCellAt(G, x, z)] >= 0 &&
      G.dist[mapgenCellAt(G, x, z)] - G.roadPts[G.near[mapgenCellAt(G, x, z)]].r < 6
    )
      continue;
    if (roadCh.includes(mapgenGround(G, x, z))) continue;
    cands.push(q);
  }
  /* the longest walk first, a raised shelf counting 50 m more (Gen 3's items sit up ledges and at dead ends) */
  const hubLv = mapgenSceneGround(sc, sc.hub[0], sc.hub[1]),
    score = q => {
      const x = ((q % gw) + 0.5) / N,
        z = (Math.floor(q / gw) + 0.5) / N,
        up = mapgenSceneGround(sc, x, z) + (R.S ? R.S[q] / 20 : 0) - hubLv;
      return dist[q] + (up > 0.3 ? 100 : 0);
    },
    sc0 = new Map(cands.map(q => [q, score(q)]));
  cands.sort((a, b) => (sc0.get(b) || 0) - (sc0.get(a) || 0) || a - b);
  const picked = [];
  for (const q of cands) {
    if (picked.length >= 2) break;
    const x = ((q % gw) + 0.5) / N,
      z = (Math.floor(q / gw) + 0.5) / N;
    if (picked.some(p => Math.hypot(p.x - x, p.z - z) < 20)) continue;
    const y = mapgenSceneGround(sc, x, z) + (R.S ? R.S[q] / 20 : 0);
    picked.push({ kind: 'pocket', x: mapgenRound2(x), z: mapgenRound2(z), y: mapgenRound2(y) });
  }
  G.spots.push(...picked);
}

/* ---------- TR-2b: mountain trails ---------- */
/* the steepest a trail climbs (rise per metre run) */
export const MAPGEN_TRAIL_GRADE = 0.56; /* stairs of 0.28 m a half metre, 0.33 m at most once rounded to 5 cm */
export const MAPGEN_TRAIL_WIDTH = 1.8;
/** a mountain's full height at a corner: its smooth land and the shelves it stands for (before they are cut to steps) */
export const mapgenMountainLevel = (G, c) => {
  const i = c % (G.w + 1),
    j = Math.floor(c / (G.w + 1)),
    q = mapgenBetween(j * 2, 0, G.h * 2 - 1) * G.w * 2 + mapgenBetween(i * 2, 0, G.w * 2 - 1);
  return G.H[c] + G.S0[q] + G.mtnE[c] * (1 - MAPGEN_MOUNTAIN_SMOOTH);
};
/** is corner (i, j) where the last pinning still moves the land (within 7 m of a pinned side or a joined strip): a trail
 * carved there would be moved off its own steps */
export function mapgenNearPinned(G, i, j) {
  for (const side of G.P.pin || '') if (mapgenDepth(G, side, i, j) < 7) return true;
  return mapgenNearJoined(G, i, j, 7);
}
/** is the smooth land at corner c steeper than you may walk (walk/heights.js navGrid blocks a slope over 1.05, whatever
 * steps are cut into it; a margin kept) */
export function mapgenSteepAt(G, c) {
  const W1 = G.w + 1,
    i = c % W1,
    j = Math.floor(c / W1),
    H = G.H,
    gx = (H[j * W1 + Math.min(G.w, i + 1)] - H[j * W1 + Math.max(0, i - 1)]) / 2,
    gz = (H[Math.min(G.h, j + 1) * W1 + i] - H[Math.max(0, j - 1) * W1 + i]) / 2;
  return Math.hypot(gx, gz) > 0.8;
}
/** the way up to a summit (the owner: mountains walkable to 15 m and more): from the corner `goal` outward, the
 * cheapest way to a road corner whose every metre climbs no more than MAPGEN_TRAIL_GRADE, so on steep ground it winds
 * in switchbacks. Corners, the summit first, or null. Steps cost their length, more the steeper they are, and a little
 * noise of the 'relief' seed so two trails don't look drawn with a ruler */
export function mapgenTrailSearch(G, goal, isRoad, s) {
  const { w, h } = G,
    W1 = w + 1,
    n = W1 * (h + 1);
  /* on every second corner (2 m apart), so two legs of a switchback are never closer than a trail is wide; a state is
     a corner and the heading it was reached by, and each turn costs (a hairpin most), so legs run long */
  const steps = [
    [2, 0, 2],
    [2, 2, 2 * Math.SQRT2],
    [0, 2, 2],
    [-2, 2, 2 * Math.SQRT2],
    [-2, 0, 2],
    [-2, -2, 2 * Math.SQRT2],
    [0, -2, 2],
    [2, -2, 2 * Math.SQRT2],
  ];
  const TURN = [0, 0.8, 3, 8, 12] /* by eighths of a turn: none, 45, 90, 135, 180 degrees */,
    dist = new Float32Array(n * 9).fill(Infinity),
    from = new Int32Array(n * 9).fill(-1),
    done = new Uint8Array(n * 9),
    heap = /** @type {number[][]} */ ([[0, goal * 9 + 8]]);
  dist[goal * 9 + 8] = 0;
  const push = it => {
      heap.push(it);
      let k = heap.length - 1;
      while (k) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    },
    pop = () => {
      const top = heap[0],
        last = /** @type {number[]} */ (heap.pop());
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const a = 2 * k + 1,
            b = a + 1;
          let m = k;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
  while (heap.length) {
    const [d, st] = pop();
    if (done[st]) continue;
    done[st] = 1;
    const c = Math.floor(st / 9),
      dir = st % 9;
    if (isRoad(c) || isRoad(c + 1) || isRoad(c + W1) || isRoad(c + W1 + 1)) {
      const out = [];
      for (let k = st; k >= 0; k = from[k]) out.push(Math.floor(k / 9));
      return out.reverse();
    }
    const i = c % W1,
      j = Math.floor(c / W1);
    for (let nd8 = 0; nd8 < 8; nd8++) {
      const [di, dj, len] = steps[nd8],
        ii = i + di,
        jj = j + dj;
      if (ii < 2 || jj < 2 || ii > w - 3 || jj > h - 3) continue;
      const c2 = jj * W1 + ii,
        st2 = c2 * 9 + nd8;
      if (
        done[st2] ||
        G.F[mapgenCellAt(G, ii, jj)] & 4 ||
        G.F[mapgenCellAt(G, i + di / 2, j + dj / 2)] & 4 /* WA-3a: a 2 m step never hops a narrow stream */ ||
        mapgenSteepAt(G, c2) ||
        mapgenSteepAt(G, (c + c2) >> 1) ||
        mapgenNearPinned(G, ii, jj)
      )
        continue;
      const dh = Math.abs(mapgenMountainLevel(G, c2) - mapgenMountainLevel(G, c));
      if (dh > MAPGEN_TRAIL_GRADE * len) continue;
      const turn = dir === 8 ? 0 : TURN[Math.min((nd8 - dir + 8) % 8, (dir - nd8 + 8) % 8)],
        nd = d + len * (1 + (2.5 * dh) / len) + turn + 0.35 * len * mapgenNoise(ii / 3, jj / 3, s);
      if (nd < dist[st2]) {
        dist[st2] = nd;
        from[st2] = st;
        push([nd, st2]);
      }
    }
  }
  return null;
}
/** a footpath from the road up each massif side to its summit (TR-2b): the summit is the highest corner whose nearest
 * side is that side, 3 m in from the edges (lower ones tried when no way up is found), the way found by
 * mapgenTrailSearch, smoothed, its height along it the land's own within the grade, carved MAPGEN_TRAIL_WIDTH wide
 * into the shelves as stairs where it climbs (stone steps) and a ramp where it's gentle, on the road's surface, ending
 * in a flat summit pocket 2.5 m round. Each summit is a marked spot (G.spots: { kind: 'summit', x, z, y }) */
export function mapgenTrails(G) {
  const { P, w, h } = G,
    W1 = w + 1,
    s = G.salt('relief', 'trail'),
    E = G.mtnE,
    surf = MAPGEN_SURFACES[P.road.surface];
  const road = new Uint8Array(W1 * (h + 1));
  for (let j = 0; j <= h; j++)
    for (let i = 0; i <= w; i++) {
      const q = mapgenCellAt(G, i, j);
      if (G.F[q] & 1 && !(G.F[q] & 8) && Math.hypot(i - G.hub[0], j - G.hub[1]) > 20 && !E[j * W1 + i])
        road[j * W1 + i] = 1;
    }
  for (const side of P.land.massif || MAPGEN_MOUNTAIN_DIALS.massif) {
    const cands = [];
    for (let j = 4; j <= h - 4; j += 2)
      for (let i = 4; i <= w - 4; i += 2) {
        const c = j * W1 + i;
        if (E[c] < 4 || mapgenNearPinned(G, i, j)) continue;
        /* the pocket's ground must be gentle enough to stand on */
        let steep = false;
        for (let dj = -2; dj <= 2 && !steep; dj++)
          for (let di = -2; di <= 2 && !steep; di++) steep = mapgenSteepAt(G, (j + dj) * W1 + i + di);
        if (steep) continue;
        let near = side,
          nd = mapgenDepth(G, side, i, j);
        for (const o of 'NSEW')
          if (mapgenDepth(G, o, i, j) < nd) {
            nd = mapgenDepth(G, o, i, j);
            near = o;
          }
        if (near === side) cands.push(c);
      }
    cands.sort((a, b) => E[b] - E[a] || a - b);
    let path = /** @type {number[] | null} */ (null);
    /* the highest first; then lower ones, each at least 6 m from those tried */
    const tried = [];
    for (const c of cands) {
      if (tried.length >= 6) break;
      const i = c % W1,
        j = Math.floor(c / W1);
      if (tried.some(t => Math.hypot(t[0] - i, t[1] - j) < 6)) continue;
      tried.push([i, j]);
      path = mapgenTrailSearch(G, c, k => !!road[k], s + tried.length);
      if (path) break;
    }
    if (!path || path.length < 4) continue;
    mapgenCarveTrail(G, path, surf);
  }
}
/** carve a trail along corners `path` (the summit first) into the step grid: see mapgenTrails */
export function mapgenCarveTrail(G, path, surf) {
  const { w, h } = G,
    W1 = w + 1,
    W2 = w * 2;
  /* the road end first, rounded off (two passes of corner cutting), every half metre */
  /* the search's 2 m grid zigzags: straightened (within 0.8 m) before its corners are rounded */
  let pts = mapgenSimplify(
    path
      .slice()
      .reverse()
      .map(c => [c % W1, Math.floor(c / W1)]),
    0.8
  );
  for (let pass = 0; pass < 2; pass++) {
    const nx = [pts[0]];
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k],
        b = pts[k + 1];
      nx.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]
      );
    }
    nx.push(pts[pts.length - 1]);
    pts = nx;
  }
  /* it starts on the road itself: the nearest road half-metre cell within 2 m of its first corner */
  {
    const [x0, z0] = pts[0];
    let bd = 1e9,
      at = /** @type {number[] | null} */ (null);
    for (let j = Math.floor((z0 - 2) * 2); j <= Math.floor((z0 + 2) * 2); j++)
      for (let i = Math.floor((x0 - 2) * 2); i <= Math.floor((x0 + 2) * 2); i++) {
        if (i < 0 || j < 0 || i >= W2 || j >= h * 2) continue;
        const x = (i + 0.5) / 2,
          z = (j + 0.5) / 2,
          d = Math.hypot(x - x0, z - z0);
        if (d < bd && G.F[mapgenCellAt(G, x, z)] & 1 && !(G.F[mapgenCellAt(G, x, z)] & 8)) {
          bd = d;
          at = [x, z];
        }
      }
    if (at) pts.unshift(at);
  }
  pts = mapgenResample(pts, 0.5);
  const level = (x, z) => {
    const i = mapgenBetween(Math.floor(x), 0, w - 1),
      j = mapgenBetween(Math.floor(z), 0, h - 1),
      fx = x - i,
      fz = z - j,
      L = c => mapgenMountainLevel(G, c);
    return (
      L(j * W1 + i) * (1 - fx) * (1 - fz) +
      L(j * W1 + i + 1) * fx * (1 - fz) +
      L((j + 1) * W1 + i) * (1 - fx) * fz +
      L((j + 1) * W1 + i + 1) * fx * fz
    );
  };
  const n = pts.length,
    cellOf = (x, z) =>
      mapgenBetween(Math.floor(z * 2), 0, h * 2 - 1) * W2 + mapgenBetween(Math.floor(x * 2), 0, W2 - 1),
    smoothAt = (x, z) => mapgenSceneGroundOf(G, x, z);
  /* the height along it: the land's, smoothed, starting where the road stands, within the grade both ways */
  const raw = pts.map(p => level(p[0], p[1]));
  raw[0] = smoothAt(pts[0][0], pts[0][1]) + G.S[cellOf(pts[0][0], pts[0][1])];
  const prof = raw.map((_, k) => {
    let a = 0,
      c = 0;
    for (let m = Math.max(1, k - 3); m <= Math.min(n - 1, k + 3); m++) {
      a += raw[m];
      c++;
    }
    return k ? a / c : raw[0];
  });
  const lim = MAPGEN_TRAIL_GRADE * 0.5;
  /* level with the road for its first 1.5 m, so the cells beside the road don't start a step up */
  for (let k = 1; k < Math.min(n, 4); k++) prof[k] = prof[0];
  /* a landing at each hairpin (over 100 degrees within a metre either way): level for 1.5 m either side, so the cells on
     its two sides, side by side, stand at one height; a sharp turn (over 60) climbs at half the grade */
  const flat = new Float32Array(n).fill(1);
  for (let k = 2; k < n - 2; k++) {
    const a1 = Math.atan2(pts[k][1] - pts[k - 2][1], pts[k][0] - pts[k - 2][0]),
      a2 = Math.atan2(pts[k + 2][1] - pts[k][1], pts[k + 2][0] - pts[k][0]),
      turn = Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const f = turn > (Math.PI * 5) / 9 ? 0 : turn > Math.PI / 3 ? 0.5 : 1;
    if (f < 1) for (let m = Math.max(1, k - 3); m <= Math.min(n - 1, k + 3); m++) flat[m] = Math.min(flat[m], f);
  }
  for (let k = 1; k < n; k++) {
    const l = lim * flat[k];
    prof[k] = mapgenBetween(prof[k], prof[k - 1] - l, prof[k - 1] + l);
  }
  /* the last 2.5 m are the summit pocket's: level with where the trail comes into it */
  const inPocket = Math.max(1, n - 6);
  for (let k = inPocket; k < n; k++) prof[k] = prof[inPocket];
  /* carve: each half-metre cell within half the width of the line takes its nearest sample's height */
  const half = MAPGEN_TRAIL_WIDTH / 2,
    best = new Map();
  pts.forEach((p, k) => {
    for (let j = Math.floor((p[1] - half) * 2); j <= Math.floor((p[1] + half) * 2); j++)
      for (let i = Math.floor((p[0] - half) * 2); i <= Math.floor((p[0] + half) * 2); i++) {
        if (i < 0 || j < 0 || i >= W2 || j >= h * 2) continue;
        const d = Math.hypot((i + 0.5) / 2 - p[0], (j + 0.5) / 2 - p[1]);
        if (d > half) continue;
        const q = j * W2 + i,
          o = best.get(q);
        if (!o || d < o[0]) best.set(q, [d, k]);
      }
  });
  /* the road it leaves keeps its own height (read before this trail marks its own cells as path) */
  const onRoad = new Set();
  for (const q of best.keys()) {
    const x = ((q % W2) + 0.5) / 2,
      z = (Math.floor(q / W2) + 0.5) / 2;
    if (
      G.F[mapgenCellAt(G, x, z)] & 1 &&
      !G.mtnE[mapgenBetween(Math.round(z), 0, h) * W1 + mapgenBetween(Math.round(x), 0, w)]
    )
      onRoad.add(q);
  }
  /* the height along the line where a cell's centre falls on it (between its nearest sample and the next or last), so
     two cells side by side on one leg differ by no more than the grade over half a metre */
  const along = (x, z, k) => {
    let bt = 0,
      bd = 1e9;
    for (const m of [k - 1, k]) {
      if (m < 0 || m + 1 >= n) continue;
      const [ax, az] = pts[m],
        [bx, bz] = pts[m + 1],
        dx = bx - ax,
        dz = bz - az,
        L2 = dx * dx + dz * dz || 1,
        t = mapgenBetween(((x - ax) * dx + (z - az) * dz) / L2, 0, 1),
        d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < bd) {
        bd = d;
        bt = m + t;
      }
    }
    const m = Math.floor(bt),
      f = bt - m;
    return m + 1 < n ? prof[m] * (1 - f) + prof[m + 1] * f : prof[n - 1];
  };
  for (const [q, [, k]] of best) {
    const i = q % W2,
      j = Math.floor(q / W2),
      x = (i + 0.5) / 2,
      z = (j + 0.5) / 2,
      c = mapgenCellAt(G, x, z);
    if (onRoad.has(q)) continue;
    /* a cut below the smooth land where the trail runs lower (a negative raise, as hand-made maps have) */
    G.S[q] = Math.round((along(x, z, k) - smoothAt(x, z)) * 20) / 20;
    const grade = Math.abs(prof[Math.min(n - 1, k + 1)] - prof[Math.max(0, k - 1)]) / 1;
    G.M[q] = grade > 0.12 ? (G.M[q] & ~(32 | 15)) | 8 : (G.M[q] & ~15) | 32;
    if (!(G.F[c] & 4)) {
      G.T[c] = surf;
      G.F[c] = (G.F[c] & ~(32 | 64)) | 1 | 16;
    }
  }
  /* the summit pocket: flat, clear, a marked spot */
  const [sx, sz] = pts[n - 1],
    top = prof[n - 1];
  for (let j = Math.floor((sz - 2.5) * 2); j <= Math.floor((sz + 2.5) * 2); j++)
    for (let i = Math.floor((sx - 2.5) * 2); i <= Math.floor((sx + 2.5) * 2); i++) {
      if (i < 0 || j < 0 || i >= W2 || j >= h * 2) continue;
      const x = (i + 0.5) / 2,
        z = (j + 0.5) / 2;
      if (Math.hypot(x - sx, z - sz) > 2.5) continue;
      /* a leg of the trail passing by lower down keeps its own height */
      const own = best.get(j * W2 + i);
      if (own && own[1] < inPocket) continue;
      G.S[j * W2 + i] = Math.round((top - smoothAt(x, z)) * 20) / 20;
      G.M[j * W2 + i] = (G.M[j * W2 + i] & ~15) | 32;
      G.F[mapgenCellAt(G, x, z)] |= 16;
    }
  G.keep.push([sx, sz, 2.5]);
  G.spots.push({ kind: 'summit', x: mapgenRound2(sx), z: mapgenRound2(sz), y: mapgenRound2(top) });
}
/** the smooth land's height at (x, z) in the working state (bilinear between corners) */
export function mapgenSceneGroundOf(G, x, z) {
  const W1 = G.w + 1,
    i = mapgenBetween(Math.floor(x), 0, G.w - 1),
    j = mapgenBetween(Math.floor(z), 0, G.h - 1),
    fx = mapgenBetween(x - i, 0, 1),
    fz = mapgenBetween(z - j, 0, 1),
    H = G.H;
  return (
    H[j * W1 + i] * (1 - fx) * (1 - fz) +
    H[j * W1 + i + 1] * fx * (1 - fz) +
    H[(j + 1) * W1 + i] * (1 - fx) * fz +
    H[(j + 1) * W1 + i + 1] * fx * fz
  );
}
/** TR-2: does a prop of radius r at (x, z) stand across a step of more than 0.3 m (a cliff or a shelf's edge) */
export function mapgenOnCliff(G, x, z, r) {
  const W2 = G.w * 2,
    H2 = G.h * 2,
    rr = Math.min(1.5, Math.max(0.5, r));
  let lo = 1e9,
    hi = -1e9;
  for (let j = Math.max(0, Math.floor((z - rr) * 2)); j <= Math.min(H2 - 1, Math.floor((z + rr) * 2)); j++)
    for (let i = Math.max(0, Math.floor((x - rr) * 2)); i <= Math.min(W2 - 1, Math.floor((x + rr) * 2)); i++) {
      const v = G.S[j * W2 + i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  return hi - lo > 0.3;
}

/* ---------- 2. ground: the base, patches by noise, water, terraces, tall grass, clearings ---------- */
export function mapgenShareMask(G, eligible, share, s, scale) {
  /* the cells (of those eligible) whose noise is in the top share: exactly that share, in blobs */
  const vals = [];
  for (let q = 0; q < G.w * G.h; q++)
    if (eligible(q)) vals.push([mapgenFbm((q % G.w) / scale, Math.floor(q / G.w) / scale, s), q]);
  vals.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return vals.slice(0, Math.round(vals.length * share)).map(v => v[1]);
}
export function mapgenStageGround(G) {
  const { B } = G,
    s = G.salt('ground');
  let n = 0;
  for (const [ch, share] of Object.entries(B.ground.patches || {}))
    for (const q of mapgenShareMask(G, q => !(G.F[q] & 3), share, s + 101 * ++n, 7 + n * 2)) G.T[q] = ch;
}
/* water and the feature's water (land: it follows the heights stage's seed), then the
   bridges where a road crosses it. The road's straight run in from each exit stays dry, so a seam is never a bridge */
export function mapgenStageWater(G) {
  const { P, B } = G,
    rnd = G.rng('heights', 'water');
  const wk = P.land.water,
    amt = P.land.waterAmount;
  if (P.feature === 'lava') mapgenPaintStream(G, mapgenStreamLine(G, rnd, 'lava'), 2 + amt * 2, 'lava');
  if (wk === 'pond' || P.feature === 'jetty')
    G.pond = mapgenPaintPond(G, rnd, wk === 'pond' ? amt : Math.max(0.5, amt));
  if (wk === 'coast') mapgenPaintCoast(G, rnd, amt);
  if (wk === 'islet') mapgenPaintIslet(G, amt);
  /* WA-3a: the river runs downhill (logic/water-gen.js), into the pond or the sea when there is one; a joined
     neighbour's river always goes on */
  waterGenRiver(G, rnd, 1.6 + amt * 2.6, wk === 'stream' || P.feature === 'bridge');
  if (G.F.some(f => f & 4)) {
    G.waterKind = G.waterKind || (P.feature === 'lava' && wk === 'none' ? 'lava' : B.water);
    for (const e of G.exits) {
      const n = MAPGEN_INWARD[e.side];
      for (let t = 0; t <= MAPGEN_STRAIGHT_IN + 1.5; t += 0.5)
        mapgenPaintDisc(G, e.pt[0] + n[0] * t, e.pt[1] + n[1] * t, e.width / 2 + G.P.road.width / 2 + 1, q => {
          if (G.F[q] & 4) {
            G.F[q] &= ~4;
            G.T[q] = G.F[q] & 1 ? MAPGEN_SURFACES[P.road.surface] : B.ground.bank;
          }
        });
    }
    /* MG-2: and out of a joined edge's strip, so the edge meets the neighbour's land */
    for (let q = 0; q < G.w * G.h; q++)
      if (G.F[q] & 4 && mapgenNearJoined(G, (q % G.w) + 0.5, Math.floor(q / G.w) + 0.5, 6)) {
        G.F[q] &= ~4;
        G.T[q] = G.F[q] & 1 ? MAPGEN_SURFACES[P.road.surface] : B.ground.bank;
      }
    mapgenRoadOverWater(G);
    mapgenLowerWater(G);
    waterGenCarve(G);
  }
  mapgenBridgesOverWater(G);
}
export function mapgenStageLand(G) {
  const { P, B } = G,
    rnd = G.rng('ground', 'land'),
    s = G.salt('ground');
  const lv = P.feature === 'terraces' ? Math.max(2, Math.round(P.land.terraces * 3)) : Math.round(P.land.terraces * 3);
  if (lv > 0) mapgenTerraces(G, lv);
  if (P.land.mountains > 0) mapgenMountains(G);
  if (P.land.ledges > 0 && G.stepsUsed) mapgenLedges(G);
  /* TR-2c: tall grass in patches (where the wild billionaires wait), one of them across the way west */
  if (P.nature.tall > 0) mapgenGrassPatches(G);
  /* clearings: open ground where no tree grows, a ragged blob whose floor thins out toward its edge */
  const nc = Math.round(P.nature.clearings * 4);
  for (let c = 0; c < nc; c++) {
    const x = rnd.range(8, G.w - 8),
      z = rnd.range(8, G.h - 8),
      r = rnd.range(3.5, 7),
      cs = s + 300 + c;
    mapgenPaintDisc(G, x, z, r * 1.4, q => {
      const i = q % G.w,
        j = Math.floor(q / G.w),
        a = Math.atan2(j + 0.5 - z, i + 0.5 - x),
        edge = r * (0.75 + 0.5 * mapgenNoise(Math.cos(a) * 1.6 + 9, Math.sin(a) * 1.6 + 9, cs)),
        d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
      if (d > edge) return;
      G.F[q] |= 16;
      if (!(G.F[q] & (1 | 2 | 4 | 32 | 64)) && mapgenNoise(i / 2.2, j / 2.2, cs) > 0.25 + 0.6 * (d / edge))
        G.T[q] = B.ground.floor;
    });
  }
}
/* ---------- TR-2c: tall grass in patches ---------- */
/** a patch's size in cells (m²): Gen 3's routes have 3-6 patches of 15-70 tiles */
export const MAPGEN_GRASS_PATCH = [15, 70];
/** tall grass in patches (Gen 3: a few patches a route, one across the path you take), in place of the old drifts
 * beside the road: 3-6 (by the nature.tall dial) ragged ovals of 15-70 m². The first lies across the road on the way
 * on (from the hub to the furthest exit on the `ahead` side, west when not given; else the longest way out), the road under it too, so walking on means
 * walking through it; the rest lie off the road, 2-14 m from it. None within 7 m of the hub or an exit, on water, a
 * bank, a bridge, a jetty or a mountain. Sets G.grassPatches: [{ x, z, r: the reach from its middle, n: cells, across }] */
export function mapgenGrassPatches(G) {
  const { P, B, w, h } = G,
    rnd = G.rng('ground', 'grass'),
    s = G.salt('ground', 'grass'),
    E = G.mtnE,
    want = 3 + Math.min(3, Math.floor(P.nature.tall * 4)),
    [AMIN, AMAX] = MAPGEN_GRASS_PATCH;
  /** can cell q take tall grass (road: a road or verge cell may) */
  const free = (q, road) => {
    if (G.F[q] & (4 | 8 | 32 | 64 | 128)) return false;
    if (!road && G.F[q] & (1 | 2)) return false;
    const i = q % w,
      j = Math.floor(q / w),
      x = i + 0.5,
      z = j + 0.5;
    if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 7) return false;
    for (const e of G.exits) if (Math.hypot(x - e.pt[0], z - e.pt[1]) < 7) return false;
    if (E)
      for (const c of [j * (w + 1) + i, j * (w + 1) + i + 1, (j + 1) * (w + 1) + i, (j + 1) * (w + 1) + i + 1])
        if (E[c] > 0) return false;
    return true;
  };
  /** the free cells of a ragged oval round (cx, cz): half axis a along (ux, uz), b square to it; at most AMAX, the
   * nearest the middle kept */
  const oval = (cx, cz, ux, uz, a, b, road, k) => {
    const out = [],
      r = Math.max(a, b) * 1.1 + 1;
    for (let j = Math.max(0, Math.floor(cz - r)); j <= Math.min(h - 1, Math.ceil(cz + r)); j++)
      for (let i = Math.max(0, Math.floor(cx - r)); i <= Math.min(w - 1, Math.ceil(cx + r)); i++) {
        const dx = i + 0.5 - cx,
          dz = j + 0.5 - cz,
          p = (dx * ux + dz * uz) / a,
          o = (-dx * uz + dz * ux) / b,
          ang = Math.atan2(o, p),
          edge = 0.75 + 0.3 * mapgenNoise(Math.cos(ang) * 1.5 + k * 7, Math.sin(ang) * 1.5 + 3, s),
          rr = Math.hypot(p, o) / edge;
        if (rr <= 1 && free(j * w + i, road)) out.push([j * w + i, rr]);
      }
    out.sort((m, n) => m[1] - n[1] || m[0] - n[0]);
    return out.slice(0, AMAX).map(c => c[0]);
  };
  /** the oval's half axes for an area of A m² (the ragged edge takes about a fifth off) */
  const axes = (A, aspect) => {
    const ab = A / (Math.PI * 0.8);
    return [Math.sqrt(ab * aspect), Math.sqrt(ab / aspect)];
  };
  const patches = /** @type {{ x: number, z: number, n: number, across: boolean, r: number }[]} */ ([]);
  const put = (cells, x, z, across, r) => {
    for (const q of cells) {
      G.T[q] = B.ground.tall;
      G.F[q] |= 32;
    }
    patches.push({ x: mapgenRound2(x), z: mapgenRound2(z), r: mapgenRound2(r * 1.05 + 0.75), n: cells.length, across });
  };
  /* the first: across the road on the way on (WM-1: the `ahead` side's) */
  const ways = G.edgeExits.filter(e => e.path && e.path.length > 1),
    A = mapgenAhead(P),
    end = (/** @type {any} */ e) => mapgenToward(A, e.path[e.path.length - 1]);
  const on = ways.filter(e => e.side === A),
    way = (on.length ? on : ways).reduce(
      (m, e) => (!m || (on.length ? end(e) > end(m) : e.len > m.len) ? e : m),
      /** @type {any} */ (null)
    );
  if (way) {
    const pts = mapgenResample(way.path, 0.5),
      half = P.road.width / 2;
    for (let tries = 0; tries < 24; tries++) {
      const k = Math.floor(pts.length * rnd.range(0.3, 0.75)),
        c = pts[Math.min(pts.length - 2, Math.max(1, k))],
        n = pts[Math.min(pts.length - 1, Math.max(2, k + 1))],
        len = Math.hypot(n[0] - c[0], n[1] - c[1]) || 1,
        vx = (n[0] - c[0]) / len,
        vz = (n[1] - c[1]) / len,
        a = half + rnd.range(2.5, 5) /* across the road */,
        b = mapgenBetween(rnd.range(30, AMAX) / (Math.PI * 0.8 * a), 1.6, 4.5) /* along it */,
        end = way.path[way.path.length - 1];
      if (Math.hypot(c[0] - G.hub[0], c[1] - G.hub[1]) < 8 + b) continue;
      if (Math.hypot(c[0] - end[0], c[1] - end[1]) < 8 + b) continue;
      /* across: a half axis square to the road */
      const cells = oval(c[0], c[1], -vz, vx, a, b, true, 0),
        on = q => cells.includes(q);
      /* it must cover the road where it crosses and reach past both sides of it */
      const at = (d, t) => mapgenCellAt(G, c[0] - vz * d + vx * t, c[1] + vx * d + vz * t);
      if (cells.length < AMIN || ![-half - 1, -half / 2, 0, half / 2, half + 1].every(d => on(at(d, 0)))) continue;
      if (![0.6, -0.6].every(t => on(at(0, t)))) continue;
      put(cells, c[0], c[1], true, Math.max(a, b));
      break;
    }
    if (!patches.length) G.notes.push('no room for tall grass across the road');
  }
  /* the rest: off the road, 2-14 m from it */
  for (let tries = 0; patches.length < want && tries < 80 * want; tries++) {
    const x = rnd.range(2, w - 2),
      z = rnd.range(2, h - 2),
      q = mapgenCellAt(G, x, z),
      d = G.near[q] >= 0 ? G.dist[q] - G.roadPts[G.near[q]].r : 1e9;
    if (d < 2 || d > 14 || !free(q, false)) continue;
    const ang = rnd.range(0, Math.PI),
      [a, b] = axes(rnd.range(AMIN + 5, AMAX), rnd.range(1, 2.2)),
      r = Math.max(a, b);
    if (patches.some(p => Math.hypot(p.x - x, p.z - z) < p.r + r + 2)) continue;
    const cells = oval(x, z, Math.cos(ang), Math.sin(ang), a, b, false, patches.length);
    if (cells.length >= AMIN) put(cells, x, z, false, r);
  }
  G.grassPatches = patches;
}
/* RL-8: where a road meets water. A bridge goes only where the road's line crosses a stream's centre line (on water
   still: the exits' straight runs and joined edges were dried), square to the water (or along the road when it comes
   within 25 degrees of square), from dry bank to dry bank across the deck's width. Anywhere else the road only dips
   into the water beside it (a road running along a stream, a pond's edge), and that stretch is dried and paved, so the
   road keeps to the bank; a crossing with no bank within reach is a causeway the same way. Before, a bridge ran from a
   road's first wet point to its last: along the stream where the road ran beside it, and often ending in the water */
export const MAPGEN_BRIDGE_SQUARE = (25 * Math.PI) / 180;
export function mapgenSegCross(p, q, r, s) {
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  if (Math.abs(d) < 1e-9) return null;
  const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d,
    v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
  return u >= 0 && u < 1 && v >= 0 && v < 1 ? [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u] : null;
}
/** the road's crossings of the streams and its dry stretches; runs before the water is lowered */
export function mapgenRoadOverWater(G) {
  const wet = (x, z) => !!(G.F[mapgenCellAt(G, x, z)] & 4);
  /* how far out from p along (ux, uz) the deck's end is on dry ground across its width; null: none within 8 m */
  const dry = (p, ux, uz, w) => {
    const sx = -uz * Math.max(0, w / 2 - 0.3),
      sz = ux * Math.max(0, w / 2 - 0.3);
    for (let t = 0; t < 8; t += 0.25) {
      const x = p[0] + ux * t,
        z = p[1] + uz * t;
      if (!wet(x, z) && !wet(x + sx, z + sz) && !wet(x - sx, z - sz)) return t;
    }
    return null;
  };
  /** @type {{ a: number[], b: number[], w: number, R: any }[]} */
  const spans = [];
  for (const R of G.road) {
    const w = Math.max(1.4, R.width + 0.5);
    for (let i = 0; i + 1 < R.pts.length; i++) {
      const p = R.pts[i],
        q = R.pts[i + 1];
      for (const st of G.streams)
        for (let k = 0; k + 1 < st.pts.length; k++) {
          const C = mapgenSegCross(p, q, st.pts[k], st.pts[k + 1]);
          if (!C || !wet(C[0], C[1])) continue;
          if (spans.some(S => mapgenNearSpan(S, C[0], C[1], 0.5))) continue;
          const rl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1,
            rx = (q[0] - p[0]) / rl,
            rz = (q[1] - p[1]) / rl,
            sx = st.pts[k + 1][0] - st.pts[k][0],
            sz = st.pts[k + 1][1] - st.pts[k][1],
            sl = Math.hypot(sx, sz) || 1;
          let nx = -sz / sl,
            nz = sx / sl;
          if (nx * rx + nz * rz < 0) {
            nx = -nx;
            nz = -nz;
          }
          /* square to the water, turned toward the road by at most 25 degrees */
          const off = Math.atan2(nx * rz - nz * rx, nx * rx + nz * rz),
            turn = Math.max(-MAPGEN_BRIDGE_SQUARE, Math.min(MAPGEN_BRIDGE_SQUARE, off)),
            ux = nx * Math.cos(turn) - nz * Math.sin(turn),
            uz = nx * Math.sin(turn) + nz * Math.cos(turn),
            ta = dry(C, -ux, -uz, w),
            tb = dry(C, ux, uz, w);
          if (ta == null || tb == null) continue; /* no bank in reach: the road there is dried below */
          spans.push({
            a: [C[0] - ux * (ta + 0.8), C[1] - uz * (ta + 0.8)],
            b: [C[0] + ux * (tb + 0.8), C[1] + uz * (tb + 0.8)],
            w,
            R,
          });
        }
    }
  }
  /* the road's wet stretches away from the bridges: dried and paved (its cells; the bank beside it) */
  const surf = MAPGEN_SURFACES[G.P.road.surface];
  for (const R of G.road)
    for (const p of R.pts)
      if (wet(p[0], p[1]) && !spans.some(S => mapgenNearSpan(S, p[0], p[1], 1.2)))
        mapgenPaintDisc(G, p[0], p[1], R.width / 2 + 0.5, q => {
          if (!(G.F[q] & 4)) return;
          const x = (q % G.w) + 0.5,
            z = Math.floor(q / G.w) + 0.5;
          if (spans.some(S => mapgenNearSpan(S, x, z, 0.3))) return;
          G.F[q] &= ~4;
          G.T[q] = G.F[q] & 1 ? surf : G.B.ground.bank;
        });
  G.spans = spans;
}
/** whether (x, z) is on a span's deck, widened by m */
export function mapgenNearSpan(S, x, z, m) {
  const dx = S.b[0] - S.a[0],
    dz = S.b[1] - S.a[1],
    L = Math.hypot(dx, dz) || 1,
    t = ((x - S.a[0]) * dx + (z - S.a[1]) * dz) / L,
    s = Math.abs(-(x - S.a[0]) * dz + (z - S.a[1]) * dx) / L;
  return t >= -m && t <= L + m && s <= S.w / 2 + m;
}
export function mapgenBridgesOverWater(G) {
  for (const S of G.spans || []) {
    G.bridges.push({
      a: [mapgenRound2(S.a[0]), mapgenRound2(S.a[1])],
      b: [mapgenRound2(S.b[0]), mapgenRound2(S.b[1])],
      w: mapgenRound2(S.w),
      kind: G.P.feature === 'lava' ? 'stone' : 'wood',
    });
    const L = Math.hypot(S.b[0] - S.a[0], S.b[1] - S.a[1]);
    for (let t = 0; t <= L; t += 0.5)
      mapgenPaintDisc(
        G,
        S.a[0] + ((S.b[0] - S.a[0]) * t) / L,
        S.a[1] + ((S.b[1] - S.a[1]) * t) / L,
        S.w / 2 + 0.25,
        q => (G.F[q] |= 8)
      );
  }
}

/* ---------- MG-2: the neighbour's ground runs on across a joined edge ---------- */
/** ground a joined edge takes from its neighbour: natural ground, as the composer mingles it across a seam
 * (seamless-world.js: walkable, not paved, not water), less the road surfaces, boards and tall grass, whose places
 * are the scene's own */
export function mapgenCopyable(G, ch) {
  const T = G.terr[ch];
  return (
    !!T &&
    !T.paved &&
    T.walk !== false &&
    !MAPGEN_WET.includes(ch) &&
    !Object.values(MAPGEN_SURFACES).includes(ch) &&
    ch !== 'b' &&
    ch !== 't'
  );
}
/** after the feature: along each joined strip, the neighbour's natural ground is laid on the cells next to the
 * edge to a ragged depth of 1-4 m, on free cells only (no road, verge, water, bridge, tall grass, bank or jetty), and
 * the neighbour's things near the edge take their room, so nothing of this scene stands against them */
export function mapgenStageEdgeGround(G) {
  const sl = G.salt('ground', 'edge');
  for (const s of G.joined) {
    for (const [k, x, z, sz] of s.props || []) mapgenOccAdd(G, x, z, mapgenRadius(G.cat[k], sz || 1));
    for (let n = 0; n < s.ground.length; n++) {
      const ch = s.ground[n],
        c = s.c0 + n;
      if (!mapgenCopyable(G, ch)) continue;
      const deep = 1 + 3 * mapgenNoise(c / 3.1, s.side.charCodeAt(0), sl);
      for (let d = 0; d < deep; d++) {
        const i = s.side === 'W' ? d : s.side === 'E' ? G.w - 1 - d : c,
          j = s.side === 'S' ? d : s.side === 'N' ? G.h - 1 - d : c;
        if (i < 0 || j < 0 || i >= G.w || j >= G.h) continue;
        const q = j * G.w + i;
        if (G.F[q] & (1 | 2 | 4 | 8 | 32 | 64 | 128) || !mapgenCopyable(G, G.T[q])) continue;
        G.T[q] = ch;
      }
    }
  }
}

/* ---------- MG-2: the hub's buildings (a first take on MG-3's lots) ---------- */
/* what the props dials put at the hub: [dial, prop, what it does, label] (the act opens the clinic's or the shop's
   room, data-files.js ROOM_BY_USE; 'fly' is the airship's mast, airship.js; RL-12b: a waystation's stand opens its
   event and a stall its shop where you stand, walk-control.js walkPick) */
/** @type {[string, string, string, string | null][]} */
export const MAPGEN_HUB_BUILDINGS = [
  ['clinic', 'clinic', 'clinic', null],
  ['shop', 'shop', 'shop', null],
  ['mast', 'airship_station', 'fly', 'Airship station'],
  ['stand', 'tent', 'event', 'Waystation'],
  ['stall', 'stall', 'stall', 'Stall'],
];
/** is (x, z) on a building's lot, or within m metres of one */
export const mapgenInLot = (G, x, z, m = 0) =>
  G.lots.some(L => x > L[0] - m && x < L[2] + m && z > L[1] - m && z < L[3] + m);
/** is the rectangle [x0, z0]-[x1, z1] free for a lot: inside the scene by a metre, on no road, path, water, bridge,
 * stream or jetty cell, 12 m clear of the exits and joined edges, a metre clear of the other lots, clear of anything
 * placed or kept, and (unless hub is false) clear of the hub */
export function mapgenLotFree(G, x0, z0, x1, z1, hub = true) {
  const { w, h } = G;
  if (x0 < 1 || z0 < 1 || x1 > w - 1 || z1 > h - 1) return false;
  for (let z = Math.floor(z0); z < Math.ceil(z1); z++)
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (G.F[z * w + x] & (1 | 2 | 4 | 8 | 64 | 128)) return false;
  const cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    r = Math.hypot(x1 - x0, z1 - z0) / 2;
  if (hub && Math.hypot(cx - G.hub[0], cz - G.hub[1]) < r + 3) return false;
  if (G.exits.some(e => Math.hypot(cx - e.pt[0], cz - e.pt[1]) < r + 12)) return false;
  if (mapgenNearJoined(G, cx, cz, 12 + r)) return false;
  if (G.lots.some(L => x0 < L[2] + 1 && x1 > L[0] - 1 && z0 < L[3] + 1 && z1 > L[1] - 1)) return false;
  for (const o of [...[...G.occ.values()].flat(), ...G.keep]) {
    const dx = Math.max(x0 - o[0], 0, o[0] - x1),
      dz = Math.max(z0 - o[1], 0, o[1] - z1);
    if (Math.hypot(dx, dz) < o[2]) return false;
  }
  return true;
}
/** the props dials' clinic, shop and airship mast beside the main road near the hub, facing the camera (south) like
 * every town building: north of the road, the front 2.5-5 m from its edge, on a level pad, with a path from the door
 * to the road. A lot keeps 12 m from the exits and joined edges, clear of the road, water, banks, bridges and
 * anything placed, its z on a half metre (so the door step isn't inside the building's walk block), and its door 7 m
 * from the sides and 10.4 m from the back, where the room laid behind a door fits (seamless-world.js
 * seamlessRoomPlacement). Its own random stream ('lots'). */
export function mapgenStageLots(G) {
  const { P, w, h } = G,
    /* TW-1: what a town's square already holds is not placed again */
    want = MAPGEN_HUB_BUILDINGS.filter(b => P.props[b[0]] > 0 && !(G.townBuilt || []).includes(b[0]));
  if (!want.length) return;
  const rnd = G.rng('lots'),
    M = G.road[0].pts,
    hk = G.hubK,
    ppu = 34,
    half = P.road.width / 2,
    cand = [];
  for (let k = Math.max(0, hk - 60); k <= Math.min(M.length - 1, hk + 60); k += 2) cand.push(k);
  for (let i = cand.length - 1; i > 0; i--) {
    const j = rnd.int(0, i);
    [cand[i], cand[j]] = [cand[j], cand[i]];
  }
  cand.sort((a, b) => Math.abs(a - hk) - Math.abs(b - hk) || 0); /* nearest the hub first; ties in the random order */
  const free = (x0, z0, x1, z1) => mapgenLotFree(G, x0, z0, x1, z1);
  for (const [dial, k, act, label] of want) {
    const C = G.cat[k];
    if (!C || !C.box) continue;
    const bw = C.box[0],
      bd = C.box[1],
      dx = ((C.door && C.door.x) || 0) / ppu;
    let done = /** @type {any} */ (null);
    for (const s of cand) {
      const R = M[s];
      /* north of the road (it runs across), or beside it (it runs north), always facing the camera */
      const spots = [];
      for (const gap of [2.5, 3.5, 4.5]) for (const ox of [0, 2, -2, 4, -4]) spots.push([ox - dx, half + gap]);
      for (const gap of [1.5, 2.5]) for (const sg of [1, -1]) spots.push([sg * (half + gap + bw / 2), -1]);
      for (const [ox, oz] of spots) {
        const z = Math.round((R[1] + oz) * 2) / 2,
          x = mapgenRound2(R[0] + ox),
          door = [x + dx, z],
          step = [door[0], z - 0.55];
        if (door[0] < 7 || door[0] > w - 7 || z > h - 10.4) continue;
        /* the road it fronts: the nearest sample to the door step, close and south of it */
        const q = mapgenCellAt(G, step[0], step[1]),
          nk = G.near[q];
        if (nk < 0) continue;
        const p = G.roadPts[nk];
        if (p.k !== 0 || step[1] < p.z - 1.5 || Math.hypot(step[0] - p.x, step[1] - p.z) > p.r + 5.5) continue;
        if (!free(x - bw / 2 - 0.5, z - 1, x + bw / 2 + 0.5, z + bd + 0.5)) continue;
        /* a spot for the mast's landing (airship.js flyLand: beside it, a step in front) */
        if (act === 'fly' && !free(x + bw / 2 + 0.4, z - 1.4, x + bw / 2 + 1.4, z - 0.4)) continue;
        done = { x, z, step, road: p, bw, bd };
        break;
      }
      if (done) break;
    }
    if (!done) {
      G.notes.push(`no room for the ${dial === 'mast' ? "airship's mast" : dial} beside the road near the hub`);
      continue;
    }
    mapgenLevelLot(G, done);
    const extra = label ? { act, label } : { act };
    mapgenPutProp(G, k, done.x, done.z, { force: true, extra });
    G.lots.push([done.x - bw / 2, done.z - 0.1, done.x + bw / 2, done.z + bd]);
    mapgenOccAdd(G, done.x, done.z + bd / 2, Math.hypot(bw, bd) / 2 + 0.4);
    if (act === 'fly') G.keep.push([done.x + bw / 2 + 0.9, done.z - 0.9, 1]);
  }
}
/** a lot made ready: its ground (the building, a metre round it and the door's path) level at the road's height
 * where the path meets it, the same step raise, the path painted to the door and kept clear */
export function mapgenLevelLot(G, L) {
  const { w, h } = G,
    W2 = w * 2,
    p = L.road,
    h0 = mapgenCornerHeight(G, p.x, p.z),
    raise = G.S[mapgenBetween(Math.floor(p.z * 2), 0, h * 2 - 1) * W2 + mapgenBetween(Math.floor(p.x * 2), 0, W2 - 1)],
    x0 = L.x - L.bw / 2 - 1,
    x1 = L.x + L.bw / 2 + 1,
    z0 = L.z - 1.5,
    z1 = L.z + L.bd + 1;
  /* the path: from the door step to the road's centre line */
  const path = [],
    n = Math.ceil(Math.hypot(L.step[0] - p.x, L.step[1] - p.z) / 0.25);
  for (let i = 0; i <= n; i++)
    path.push([L.step[0] + ((p.x - L.step[0]) * i) / n, L.step[1] + ((p.z - L.step[1]) * i) / n]);
  const onPath = (x, z, r) => path.some(q => Math.hypot(x - q[0], z - q[1]) <= r),
    /* the lots already made keep their ground */
    other = (x, z) => G.lots.some(Q => x >= Q[0] - 1 && x <= Q[2] + 1 && z >= Q[1] - 1.5 && z <= Q[3] + 1);
  /* corners: level on the lot and the path, blended out over 3 m, never moving the road itself */
  for (let j = Math.max(0, Math.floor(z0 - 3)); j <= Math.min(h, Math.ceil(z1 + 3)); j++)
    for (let i = Math.max(0, Math.floor(x0 - 3)); i <= Math.min(w, Math.ceil(x1 + 3)); i++) {
      const q = mapgenCellAt(G, i, j);
      if ((G.near[q] >= 0 && G.dist[q] < G.roadPts[G.near[q]].r + 0.5) || other(i, j)) continue;
      const dx = Math.max(x0 - i, 0, i - x1),
        dz = Math.max(z0 - j, 0, j - z1),
        d = Math.min(Math.hypot(dx, dz), onPath(i, j, 0.9) ? 0 : 1e9),
        t = d <= 0 ? 1 : 1 - mapgenSmooth(Math.min(1, d / 3));
      if (t > 0) G.H[j * (w + 1) + i] = G.H[j * (w + 1) + i] * (1 - t) + h0 * t;
    }
  /* half-metre cells: the lot's and the path's raise is the road's there */
  for (let j = Math.max(0, Math.floor(z0 * 2)); j < Math.min(h * 2, Math.ceil(z1 * 2)); j++)
    for (let i = Math.max(0, Math.floor(x0 * 2)); i < Math.min(W2, Math.ceil(x1 * 2)); i++) {
      if (other((i + 0.5) / 2, (j + 0.5) / 2)) continue;
      G.S[j * W2 + i] = raise;
      G.M[j * W2 + i] |= 32;
    }
  const surf = MAPGEN_SURFACES[G.P.road.surface];
  for (const [x, z] of path) {
    mapgenPaintDisc(G, x, z, 0.75, q => {
      if (G.F[q] & (1 | 4)) return;
      G.T[q] = surf;
      G.F[q] = (G.F[q] & ~(32 | 64)) | 2;
    });
    for (let j = Math.max(0, Math.floor((z - 0.75) * 2)); j < Math.min(h * 2, Math.ceil((z + 0.75) * 2)); j++)
      for (let i = Math.max(0, Math.floor((x - 0.75) * 2)); i < Math.min(W2, Math.ceil((x + 0.75) * 2)); i++) {
        G.S[j * W2 + i] = raise;
        G.M[j * W2 + i] |= 32;
      }
  }
  for (let i = 0; i < path.length; i += 4) G.keep.push([path[i][0], path[i][1], 0.9]);
  /* no tree on the lot */
  for (let z = Math.floor(z0); z < Math.ceil(z1); z++)
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) if (x >= 0 && z >= 0 && x < w && z < h) G.F[z * w + x] |= 16;
  if (raise) G.stepsUsed = true;
}

/* ---------- TW-1: a run town (kind 'town'): a street, a square, houses ---------- */
/** a town's set when its biome has none (biomes.json town) */
export const MAPGEN_TOWN_SET = {
  houses: { house_cottage: 1 },
  centre: 'well',
  fence: 'picket_fence',
  square: 'c',
  lamp: 'streetlamp',
  bench: 'bench_wood',
  /* TW-3: the notice board on the square's east side (act 'notice': the run's quests are handed in there) */
  board: 'notice_board',
};
/** a town's sizes (metres): the main street's length and width, the square's width and depth, how many houses, the
 * garden beside a house, how far a house's fence stands in front of it */
export const MAPGEN_TOWN = {
  street: [3, 5.5],
  streetW: 2.4,
  /* the square's width and depth: the first that fits */
  squares: [
    [16, 8],
    [14, 7],
    [12, 6],
  ],
  houses: [4, 7],
  garden: 2.6,
  fence: 1.1,
  /* TW-2: its townsfolk: `base`, one more for every `houses` houses, at most `most` (the owner, TW-2) */
  folk: { base: 2, houses: 2, most: 6 },
};
/** a town (kind 'town'), laid before the hub's buildings (mapgenStageLots, which then only adds what the town did
 * not place): a short main street north off the main road near the hub, to a small level square (the biome's well
 * or fountain in its middle, lamps at its front corners, benches on its west side, a spot kept on its east side for
 * a notice board: G.spots kind 'board', TW-3: the board on it and its quest giver's spot, kind 'giver'), the clinic and the shop on its north side facing the camera (the props dials
 * clinic and shop), then 4-7 houses north of the main road on both sides of the street, each facing the camera (the
 * owner, TW-1) with a garden beside it, a fence along its front with a gap at its path and a lamp at every other
 * one. The houses are shut (no act: only the clinic and the shop have rooms). South of the road: 1-2 fenced
 * vegetable plots, the rest open land and tall grass (the owner, TW-1). Nothing goes on tall grass, so the patches stay whole. Its own random stream ('lots', '|town').
 * Sets G.town, or leaves it null when no spot fits (the lot stage then places the buildings as on a route). */
export function mapgenStageTown(G) {
  const { P, B, w, h } = G;
  G.town = null;
  G.townBuilt = [];
  if (P.kind !== 'town') return;
  const S = { ...MAPGEN_TOWN_SET, ...(B.town || {}) },
    Z = MAPGEN_TOWN,
    rnd = G.rng('lots', '|town'),
    M = G.road[0].pts,
    hk = G.hubK,
    ppu = 34,
    half = P.road.width / 2,
    want = MAPGEN_HUB_BUILDINGS.filter(b => (b[0] === 'clinic' || b[0] === 'shop') && P.props[b[0]] > 0),
    blds = want.map(b => ({ dial: b[0], k: b[1], act: b[2], C: G.cat[b[1]] })).filter(b => b.C && b.C.box),
    backD = Math.max(0, ...blds.map(b => b.C.box[1])),
    streetLen = mapgenRound2(rnd.range(Z.street[0], Z.street[1])),
    nHouses = rnd.int(Z.houses[0], Z.houses[1]);
  let SW = 0,
    SD = 0;
  /* is cell q clear for the town: no water, bridge, stream, jetty or tall grass; a road only the main road */
  const clear = (x0, z0, x1, z1) => {
    for (let z = Math.floor(z0); z < Math.ceil(z1); z++)
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        if (x < 0 || z < 0 || x >= w || z >= h) return false;
        const q = z * w + x;
        if (G.F[q] & (4 | 8 | 32 | 64 | 128)) return false;
        if (G.F[q] & 1 && (G.near[q] < 0 || G.roadPts[G.near[q]].k !== 0)) return false;
      }
    return true;
  };
  const corners = (x0, z0, x1, z1) => {
    let lo = Infinity,
      hi = -Infinity;
    for (let z = Math.ceil(z0); z <= Math.floor(z1); z++)
      for (let x = Math.ceil(x0); x <= Math.floor(x1); x++) {
        const v = mapgenCornerHeight(G, x, z);
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    return hi - lo;
  };
  /* ---- the square: the main road's samples nearest the hub first, where the road runs across ---- */
  const cand = [];
  for (let k = 8; k <= M.length - 9; k += 2) cand.push(k);
  cand.sort((a, b) => Math.abs(a - hk) - Math.abs(b - hk) || a - b);
  let sq = /** @type {any} */ (null);
  for (const [sw, sd] of Z.squares) {
    SW = sw;
    SD = sd;
    for (const k of cand) {
      const a = M[k - 6],
        b = M[k + 6],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (Math.abs(b[1] - a[1]) / L > 0.5) continue;
      const jx = mapgenRound2(M[k][0]),
        edge = M[k][1] + half,
        z0 = Math.round((edge + streetLen) * 2) / 2,
        z1 = z0 + SD,
        x0 = jx - SW / 2,
        x1 = jx + SW / 2;
      if (x0 < 7 || x1 > w - 7 || z1 > h - 10.4 || z1 + backD + 1.5 > h - 1) continue;
      if (!mapgenLotFree(G, x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + backD + 0.5, false)) continue;
      if (!clear(x0 - 1, z0 - 1, x1 + 1, z1 + backD + 1) || !clear(jx - 2, edge, jx + 2, z0)) continue;
      if (corners(x0, edge, x1, z1 + backD) > 3.5) continue;
      sq = { k, jx, edge, z0, z1, x0, x1 };
      break;
    }
    if (sq) break;
  }
  if (!sq) return;
  /* the road sample the street meets (main road samples come first in G.roadPts) */
  const p = G.roadPts[sq.k];
  /* level the square, the buildings behind it and the street at the road's height there; the street is the lot's
     path from its front to the road */
  mapgenLevelLot(G, {
    x: sq.jx,
    z: sq.z0,
    bw: SW,
    bd: SD + backD + 0.5,
    step: [sq.jx, sq.z0 - 0.25],
    road: p,
  });
  G.lots.push([sq.x0, sq.z0 - 0.1, sq.x1, sq.z1 + backD + 0.5]);
  /* paint: the square and the street in the square's ground, walked like a road, no plants */
  const paint = q => {
    G.T[q] = S.square;
    G.F[q] = (G.F[q] & ~(32 | 64)) | 1 | 16;
  };
  for (let z = Math.floor(sq.z0); z < Math.ceil(sq.z1); z++)
    for (let x = Math.floor(sq.x0); x < Math.ceil(sq.x1); x++) paint(z * w + x);
  for (let z = sq.edge - 0.5; z <= sq.z0; z += 0.5)
    mapgenPaintDisc(G, sq.jx, z, Z.streetW / 2, q => {
      if (!(G.F[q] & 4) && !(G.F[q] & 1 && G.T[q] !== S.square)) paint(q);
    });
  /* the clinic and the shop on its north side, their doors on its edge, in a random order */
  if (blds.length === 2 && rnd.chance(0.5)) blds.reverse();
  blds.forEach((b, i) => {
    const [bw, bd] = b.C.box,
      dx = ((b.C.door && b.C.door.x) || 0) / ppu,
      doorX = sq.jx + (blds.length === 1 ? 0 : (i ? 1 : -1) * SW * 0.27),
      x = mapgenRound2(doorX - dx),
      z = sq.z1;
    mapgenPutProp(G, b.k, x, z, { force: true, extra: { act: b.act } });
    G.lots.push([x - bw / 2, z - 0.1, x + bw / 2, z + bd]);
    mapgenOccAdd(G, x, z + bd / 2, Math.hypot(bw, bd) / 2 + 0.4);
    G.keep.push([doorX, z - 0.8, 0.9]);
    G.townBuilt.push(b.dial);
  });
  /* its middle: the well or the fountain; the notice board's spot on its east side; benches on its west side;
     lamps at its front corners and at the street's mouth */
  const mx = sq.jx,
    mz = (sq.z0 + sq.z1) / 2,
    y = mapgenCornerHeight(G, mx, mz);
  mapgenPutProp(G, S.centre, mx, mz, { force: true });
  const board = [mapgenRound2(sq.x1 - 1.4), mapgenRound2(mz)];
  G.spots.push({ kind: 'square', x: mapgenRound2(mx), z: mapgenRound2(mz), y: mapgenRound2(y) });
  G.spots.push({ kind: 'board', x: board[0], z: board[1], y: mapgenRound2(y) });
  G.keep.push([board[0], board[1], 1.2]);
  /* TW-3: the notice board on its spot, and where the town's quest giver stands: in front of it, to its west */
  if (G.cat[S.board])
    mapgenPutProp(G, S.board, board[0], board[1], { force: true, extra: { act: 'notice', label: 'Notice board' } });
  const giver = [mapgenRound2(board[0] - 1.6), mapgenRound2(mz - 1)];
  G.spots.push({ kind: 'giver', x: giver[0], z: giver[1], y: mapgenRound2(mapgenCornerHeight(G, giver[0], giver[1])) });
  G.keep.push([giver[0], giver[1], 0.6]);
  for (const dz of [-1.3, 1.3]) mapgenPutProp(G, S.bench, sq.x0 + 1.4, mz + dz, { force: true });
  for (const x of [sq.x0 + 0.5, sq.x1 - 0.5]) mapgenPutProp(G, S.lamp, x, sq.z0 + 0.5, { force: true });
  for (const sg of [-1, 1]) {
    const x = sq.jx + sg * (Z.streetW / 2 + 0.6),
      z = sq.edge + 1;
    if (clear(x - 0.3, z - 0.3, x + 0.3, z + 0.3) && !(G.F[mapgenCellAt(G, x, z)] & 1))
      mapgenPutProp(G, S.lamp, x, z, { force: true });
  }
  /* ---- the houses: north of the main road, out from the street on both sides by turns ---- */
  const kinds = Object.keys(S.houses).filter(k => G.cat[k] && G.cat[k].box);
  const smallest = kinds.reduce((m, k) => (!m || G.cat[k].box[0] < G.cat[m].box[0] ? k : m), '');
  let built = 0,
    lamp = 0,
    tx0 = sq.x0,
    tx1 = sq.x1;
  const tried = new Set(),
    /* TW-2: where a named local may stand: on the square (first), then by a house's gate */
    locals = [[sq.x0 + 3.4, sq.z0 + 1.4]];
  for (let d = 8; d < M.length && built < nHouses && kinds.length; d += 2)
    for (const k of [sq.k - d, sq.k + d]) {
      if (built >= nHouses || k < 6 || k > M.length - 7 || tried.has(k)) continue;
      tried.add(k);
      const a = M[k - 4],
        b = M[k + 4],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      if (Math.abs(b[1] - a[1]) / L > 0.6) continue;
      const pick = rnd.pick(Object.fromEntries(kinds.map(q => [q, S.houses[q]]))),
        gs = rnd.chance(0.5) ? 1 : -1,
        gap0 = +rnd.pick({ 3: 2, 4: 2, 5.5: 1 }),
        R = M[k];
      /* the house drawn at the gap drawn, else at the other gaps, else the smallest house */
      const tries = [];
      for (const kk of [pick, smallest]) for (const gap of [gap0, 3, 4, 5.5]) tries.push([kk, gap]);
      let lot = /** @type {any} */ (null);
      for (const [kk, gap] of tries) {
        const C = G.cat[kk],
          [bw, bd] = C.box,
          dx = ((C.door && C.door.x) || 0) / ppu,
          x = mapgenRound2(R[0] - dx),
          z = Math.round((R[1] + half + gap) * 2) / 2,
          door = [x + dx, z],
          step = [door[0], z - 0.55],
          gx0 = gs > 0 ? x + bw / 2 + 0.3 : x - bw / 2 - 0.3 - Z.garden,
          gx1 = gx0 + Z.garden,
          px0 = Math.min(x - bw / 2, gx0),
          px1 = Math.max(x + bw / 2, gx1),
          fz = z - Z.fence;
        if (door[0] < 4 || door[0] > w - 4 || z + bd > h - 1.5) continue;
        if (!mapgenLotFree(G, px0 - 0.4, z - 0.6, px1 + 0.4, z + bd + 0.4)) continue;
        if (!clear(px0 - 0.4, fz - 0.4, px1 + 0.4, z + bd + 0.4)) continue;
        const nk = G.near[mapgenCellAt(G, step[0], step[1])];
        if (nk < 0) continue;
        const rp = G.roadPts[nk];
        if (rp.k !== 0 || step[1] < rp.z || Math.hypot(step[0] - rp.x, step[1] - rp.z) > rp.r + 6) continue;
        if (corners(px0, fz, px1, z + bd) > 2.4) continue;
        lot = { kk, bw, bd, x, z, door, step, gx0, gx1, px0, px1, fz, rp };
        break;
      }
      if (!lot) continue;
      const { kk, bw, bd, x, z, door, step, gx0, gx1, px0, px1, fz, rp } = lot;
      mapgenLevelLot(G, { x: (px0 + px1) / 2, z, bw: px1 - px0, bd, step, road: rp });
      mapgenPutProp(G, kk, x, z, { force: true });
      G.lots.push([px0, z - 0.1, px1, z + bd]);
      mapgenOccAdd(G, x, z + bd / 2, Math.hypot(bw, bd) / 2 + 0.4);
      /* the garden: lawn, a planter at its front, a shrub at its back, now and then a gnome */
      for (let j = Math.floor(z); j < Math.ceil(z + bd); j++)
        for (let i = Math.floor(gx0); i < Math.ceil(gx1); i++)
          if (!(G.F[j * w + i] & (1 | 2 | 4))) {
            G.T[j * w + i] = 'l';
            G.F[j * w + i] |= 16;
          }
      const gx = (gx0 + gx1) / 2;
      mapgenPutProp(G, 'planter_box', gx, z + 0.4, { force: true });
      const shrubs = B.shrubs && Object.keys(B.shrubs).filter(s => G.cat[s]);
      if (shrubs && shrubs.length)
        mapgenPutProp(G, rnd.pick(Object.fromEntries(shrubs.map(s => [s, B.shrubs[s]]))), gx, z + bd - 0.5, {
          force: true,
        });
      if (rnd.chance(0.2)) mapgenPutProp(G, 'garden_gnome', gx + 0.7, z + bd / 2, { force: true });
      /* the fence along the front, in 2.2 m lengths, with a gap at the path */
      const F = G.cat[S.fence],
        fw = (F && F.box && F.box[0]) || 2.2;
      for (let fx = px0 + fw / 2; fx <= px1 - fw / 2 + 0.01; fx += fw) {
        if (Math.abs(fx - door[0]) < fw / 2 + 0.7) continue;
        if (!clear(fx - fw / 2, fz - 0.2, fx + fw / 2, fz + 0.2)) continue;
        let onRoad = false;
        for (let s = -fw / 2; s <= fw / 2; s += 0.5) if (G.F[mapgenCellAt(G, fx + s, fz)] & 1) onRoad = true;
        if (!onRoad) mapgenPutProp(G, S.fence, fx, fz, { force: true });
      }
      if (lamp++ % 2 === 0) {
        const lx = gs > 0 ? px0 - 0.5 : px1 + 0.5;
        if (!(G.F[mapgenCellAt(G, lx, fz)] & (1 | 4))) mapgenPutProp(G, S.lamp, lx, fz, { force: true });
      }
      locals.push([door[0] - gs * 0.9, fz - 0.6]);
      tx0 = Math.min(tx0, px0);
      tx1 = Math.max(tx1, px1);
      built++;
    }
  /* ---- south of the road (the camera's side): 1-2 vegetable plots in farm soil, planters in two rows, a fence along
     their front; the rest stays open land and tall grass ---- */
  const nPlots = rnd.int(1, 2);
  let plots = 0;
  for (let d = 10; d < M.length && plots < nPlots; d += 6)
    for (const k of [sq.k + d, sq.k - d]) {
      if (plots >= nPlots || k < 6 || k > M.length - 7) continue;
      const pw = 5,
        pd = 3,
        cx = M[k][0],
        z1 = Math.round((M[k][1] - half - 2.5) * 2) / 2,
        z0 = z1 - pd,
        x0 = cx - pw / 2,
        x1 = cx + pw / 2;
      if (!mapgenLotFree(G, x0 - 0.5, z0 - 1.5, x1 + 0.5, z1 + 0.3) || !clear(x0 - 0.5, z0 - 1.5, x1 + 0.5, z1 + 0.3))
        continue;
      if (corners(x0, z0 - 1, x1, z1) > 1.2) continue;
      for (let j = Math.floor(z0); j < Math.ceil(z1); j++)
        for (let i = Math.floor(x0); i < Math.ceil(x1); i++) {
          G.T[j * w + i] = 'o';
          G.F[j * w + i] |= 16;
        }
      for (const dz of [0.8, 2.1])
        for (const dx of [-1.5, 0, 1.5]) mapgenPutProp(G, 'planter_box', cx + dx, z0 + dz, { force: true });
      const F = G.cat[S.fence],
        fw = (F && F.box && F.box[0]) || 2.2;
      for (let fx = x0 + fw / 2; fx <= x1 - fw / 2 + 0.01; fx += fw)
        mapgenPutProp(G, S.fence, fx, z0 - 0.6, { force: true });
      G.lots.push([x0, z0 - 0.8, x1, z1]);
      plots++;
    }
  /* TW-2: the named locals' places, and the town's ground (its animals keep to it): the houses' and the square's
     width, from the vegetable plots south of the road to the square's back */
  for (const [x, z] of locals) {
    G.spots.push({
      kind: 'local',
      x: mapgenRound2(x),
      z: mapgenRound2(z),
      y: mapgenRound2(mapgenCornerHeight(G, x, z)),
    });
    G.keep.push([x, z, 0.6]);
  }
  let rz = Infinity;
  for (const R of M) if (R[0] >= tx0 && R[0] <= tx1) rz = Math.min(rz, R[1]);
  const area = [tx0 - 1, (isFinite(rz) ? rz : sq.edge) - half - 7, tx1 + 1, sq.z1].map(mapgenRound2);
  G.town = {
    square: [sq.x0, sq.z0, sq.x1, sq.z1],
    street: [sq.jx, sq.edge, sq.z0],
    houses: built,
    plots,
    area: [Math.max(1, area[0]), Math.max(1, area[1]), Math.min(w - 1, area[2]), Math.min(h - 1, area[3])],
  };
}
/** TW-2: a scene's townsfolk: a town's by its houses (MAPGEN_TOWN.folk; a town whose square didn't fit, the base),
 * none elsewhere */
export function mapgenTownFolk(G) {
  const F = MAPGEN_TOWN.folk;
  if (G.P.kind !== 'town') return 0;
  return G.town ? Math.min(F.most, F.base + Math.floor(G.town.houses / F.houses)) : F.base;
}
/** TW-2: a scene's animals: its biome's wild ones, and in a town its biome's town ones (biomes.json town.life) kept to
 * the town's ground or its square, those that want more houses than it has left out */
export function mapgenSceneLife(G) {
  const wild = (G.B.life || []).map(l => ({ ...l })),
    T = G.P.kind === 'town' && G.town;
  if (!T) return wild;
  const own = [];
  for (const L of (G.B.town && G.B.town.life) || []) {
    if (L.houses && T.houses < L.houses) continue;
    own.push({ k: L.k, n: L.n, area: (L.square ? T.square : T.area).map(mapgenRound2) });
  }
  return wild.concat(own);
}
/* ---------- 6. plants: groves and an edge belt of trees, shrubs, rocks, tall grass, then the wild growth ---------- */
/* ---------- RT-1: route layouts (the routes track) ---------- */
/** the plans a run route is laid out by (the layout dial; 'none' leaves the open field). Each says what it builds
 * before forest masses fill the rest of the blocking budget: fenced fields (shut or with a gap: a pocket inside),
 * hedgerows along the road, a hedge lane beside the road, rock outcrops, clearings carved into the forest; and the
 * dials it sets (a lake for the lakeside, terraces with ledge fronts for the ledge drop) */
export const MAPGEN_LAYOUTS = {
  none: { name: 'None (open field)' },
  forest: { name: 'Forest trail', hug: 1, outcrops: [0, 1], clearings: [1, 2] },
  farmland: { name: 'Farmland', fields: [2, 4], hedgerows: [1, 2], outcrops: [0, 0], clearings: [0, 1] },
  lakeside: { name: 'Lakeside', dials: { water: 'pond', waterAmount: 0.85 }, outcrops: [0, 1], clearings: [1, 1] },
  ledges: { name: 'Ledge drop', dials: { terraces: 0.6, ledges: 1 }, outcrops: [2, 3], clearings: [0, 1] },
  lanes: { name: 'Two lanes', lane: 1, hedgerows: [0, 1], outcrops: [0, 1], clearings: [0, 1] },
};
/** the layout dial when not given (not in MAPGEN_DEFAULTS, so scenes made without it keep the dials they stored) */
export const MAPGEN_LAYOUT_DIALS = { layout: 'none' };
/** a forest mass's props (measured on the phone-sized headless page, tools/route-perf.py): canopy pieces `step`
 * metres apart at a scale in `size`, the biome's trees along its edge `wall` metres apart (a model tree is a draw
 * per leaf clump, the wall is most of a forest's cost) */
export const MAPGEN_FOREST = { step: 5.2, size: [1.0, 1.35], wall: 5 };
/** the ground under a forest mass: deep forest, walked by no one (scenery.json, tools/build-forest-canopy.py) */
export const MAPGEN_DEEP = '&';
/** the share of a laid-out route you can walk to from the hub (the owner, 2026-10-24: 55-65%) and the aim */
export const MAPGEN_WALKABLE = [0.55, 0.65];
export const MAPGEN_WALK_AIM = 0.6;
/** what the plants stage still blocks on a laid-out route (shrubs, rocks and wild trees), counted in the budget */
export const MAPGEN_PLANT_SHARE = 0.03;
/** the mask a layout keeps per cell (G.Lm): what stands there */
export const MAPGEN_LM = { forest: 1, field: 2, fence: 3, rock: 4, keep: 5 };
/** the boulders of a rock outcrop by biome (models scale; the rest are pictures) */
export const MAPGEN_OUTCROP = {
  tundra: { boulder_snow: 1 },
  volcano: { boulder_basalt: 1 },
  default: { boulder_granite: 2, boulder_lichen: 2 },
};
/** is this scene laid out (params.layout set and not 'none') */
export const mapgenLaidOut = P => !!P.layout && P.layout !== 'none' && !!MAPGEN_LAYOUTS[P.layout];

/** the cells a layout may block: off the road and its verge (2.2 m from its edge; 7 m on its south, the camera's
 * side, where a forest would hide you), water, banks, bridges and jettys, tall grass (1 m round it), 9 m round the
 * hub, each exit's straight run-in, a joined edge's strip, the east and west 5 m (the seams), lots and kept spots,
 * and mountains */
export function mapgenLayoutFree(G) {
  const { w, h } = G,
    free = new Uint8Array(w * h);
  for (let q = 0; q < w * h; q++) {
    const i = q % w,
      j = Math.floor(q / w),
      x = i + 0.5,
      z = j + 0.5;
    if (G.F[q] & (1 | 2 | 4 | 8 | 32 | 64 | 128)) continue;
    if (x < 5 || x > w - 5) continue;
    const k = G.near[q];
    if (k >= 0) {
      const R = G.roadPts[k],
        d = G.dist[q] - R.r;
      if (d < 2.2 || (z < R.z && d < 7)) continue;
    }
    let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++)
      for (let di = -1; di <= 1 && !near; di++) {
        const ii = i + di,
          jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < w && jj < h && G.F[jj * w + ii] & 32) near = true;
      }
    if (near) continue;
    if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 9) continue;
    if (
      G.exits.some(e => {
        const n = MAPGEN_INWARD[e.side],
          dx = x - e.pt[0],
          dz = z - e.pt[1],
          along = dx * n[0] + dz * n[1],
          across = Math.abs(dx * n[1] - dz * n[0]);
        return along > -2 && along < MAPGEN_STRAIGHT_IN + 4 && across < 5;
      })
    )
      continue;
    if (mapgenNearJoined(G, x, z, 8) || mapgenInLot(G, x, z, 2)) continue;
    if (G.keep.some(o => Math.hypot(x - o[0], z - o[1]) < o[2] + 1.5)) continue;
    if (G.mtnE && G.mtnE[mapgenBetween(Math.round(z), 0, h) * (w + 1) + mapgenBetween(Math.round(x), 0, w)] > 0.2)
      continue;
    free[q] = 1;
  }
  return free;
}

/** a run of box props (fences, walls, hedges) from a to b, turned along it, each segment fitted to the run's length;
 * gaps: segment indices left out. Marks the mask under it. Returns the segments placed */
export function mapgenFenceRun(G, k, a, b, gaps = []) {
  const M = G.cat[k];
  if (!M || !M.box) return 0;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1) return 0;
  const n = Math.max(1, Math.round(L / M.box[0])),
    s = mapgenBetween(L / n / M.box[0], 0.8, 1.25),
    tx = (b[0] - a[0]) / L,
    tz = (b[1] - a[1]) / L,
    rot = mapgenRound2((Math.atan2(tz, tx) * 180) / Math.PI),
    d = M.box[1] * s;
  let placed = 0;
  for (let i = 0; i < n; i++) {
    const cx = a[0] + tx * (L / n) * (i + 0.5),
      cz = a[1] + tz * (L / n) * (i + 0.5);
    mapgenPaintDisc(G, cx, cz, (L / n) * 0.55, q => {
      if (!G.Lm[q]) G.Lm[q] = MAPGEN_LM.fence;
    });
    if (gaps.includes(i)) continue;
    /* the base point is the middle of its front: half its depth before the run's line */
    const bx = cx + tz * (d / 2),
      bz = cz - tx * (d / 2);
    if (mapgenPutProp(G, k, bx, bz, { force: true, s, extra: rot ? { rot } : undefined })) placed++;
  }
  return placed;
}
/** a place for a w x d rectangle (axis-aligned, metres) whose cells and a 1 m margin are all free and unmasked */
export function mapgenLayoutRect(G, free, rnd, w, d, tries = 60) {
  for (let t = 0; t < tries; t++) {
    const x0 = Math.round(rnd.range(5, G.w - 5 - w)),
      z0 = Math.round(rnd.range(1, G.h - 1 - d));
    let ok = true;
    for (let z = z0 - 1; z < z0 + d + 1 && ok; z++)
      for (let x = x0 - 1; x < x0 + w + 1 && ok; x++) {
        if (x < 0 || z < 0 || x >= G.w || z >= G.h) {
          ok = false;
          break;
        }
        const q = z * G.w + x;
        if (!free[q] || G.Lm[q]) ok = false;
      }
    if (ok) return [x0, z0];
  }
  return null;
}
/** the biome's pick from a pool (a record of weights) or a fallback */
export const mapgenPoolPick = (rnd, pool, fb) => (pool && Object.keys(pool).length ? rnd.pick(pool) : fb);

/**
 * RT-1: lay a route out by its plan (P.layout): blockers to bring the walkable share near `aim`, after the lots and
 * before the plants. Fields, hedgerows, a lane and outcrops by the plan; then forest masses (a wall of the biome's
 * trees round their edge, canopy pieces inside; boulders where the biome has no canopy) fill what is left of the
 * budget, ranked by a smooth field so they come out as masses, hugging the road on the forest trail. Clearings are
 * carved into the masses with a way in (pockets). Sets G.Lm (the mask), G.layoutSpots (pockets made on purpose)
 * @param {any} G @param {number} aim the walkable share wanted (MAPGEN_WALK_AIM, moved by mapgenScene's retries)
 */
export function mapgenStageLayout(G, aim) {
  const { P, B, w, h } = G,
    plan = MAPGEN_LAYOUTS[P.layout],
    rnd = G.rng('layout'),
    s = G.salt('layout');
  G.Lm = new Uint8Array(w * h);
  G.layoutSpots = [];
  const free = mapgenLayoutFree(G),
    N = w * h,
    span = r => (Array.isArray(r) ? rnd.int(r[0], r[1]) : r || 0);
  let water = 0;
  for (let q = 0; q < N; q++) if (G.F[q] & 4 && !(G.F[q] & 8)) water++;
  const budget = Math.max(0, Math.round(N * (1 - aim - MAPGEN_PLANT_SHARE) - water));
  const blocked = () => {
    let n = 0;
    for (let q = 0; q < N; q++) if (G.Lm[q] && G.Lm[q] !== MAPGEN_LM.keep) n++;
    return n;
  };
  const fences = B.fences || { fence_wood: 1 },
    fieldFence = fences.fence_wood ? 'fence_wood' : mapgenPoolPick(rnd, fences, 'fence_wood');
  /* farmland: fenced fields, the side nearest the road open by a segment (a pocket inside) or shut (crops seen over
     the fence), farm soil inside */
  const nf = span(plan.fields);
  for (let f = 0; f < nf; f++) {
    const fw = rnd.int(10, 16),
      fd = rnd.int(8, 12),
      at = mapgenLayoutRect(G, free, rnd, fw, fd);
    if (!at) continue;
    const [x0, z0] = at,
      x1 = x0 + fw,
      z1 = z0 + fd,
      shut = f % 2 === 1;
    for (let z = z0; z < z1; z++)
      for (let x = x0; x < x1; x++) {
        const q = z * w + x;
        G.Lm[q] = shut ? MAPGEN_LM.field : MAPGEN_LM.keep;
        if (G.terr.o) G.T[q] = 'o';
        G.F[q] |= 16;
      }
    /* the side facing the road gets the gap (the road's nearest sample to the field's middle) */
    const k = G.near[mapgenCellAt(G, (x0 + x1) / 2, (z0 + z1) / 2)],
      R = k >= 0 ? G.roadPts[k] : { x: w / 2, z: h / 2 },
      dx = R.x - (x0 + x1) / 2,
      dz = R.z - (z0 + z1) / 2,
      open = Math.abs(dx) * fd > Math.abs(dz) * fw ? (dx > 0 ? 'E' : 'W') : dz > 0 ? 'N' : 'S';
    const sides = {
      S: [
        [x0, z0],
        [x1, z0],
      ],
      N: [
        [x1, z1],
        [x0, z1],
      ],
      W: [
        [x0, z1],
        [x0, z0],
      ],
      E: [
        [x1, z0],
        [x1, z1],
      ],
    };
    for (const [side, [a, b]] of Object.entries(sides)) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.max(1, Math.round(len / (G.cat[fieldFence]?.box?.[0] || 2.2))),
        gap = !shut && side === open ? [Math.floor(n / 2)] : [];
      mapgenFenceRun(G, fieldFence, a, b, gap);
    }
    if (shut) {
      for (let r = z0 + 1.5; r < z1 - 1; r += 2.2)
        for (let x = x0 + 1.5; x < x1 - 1; x += 2.4)
          if (G.cat.crops && rnd.chance(0.35)) mapgenPutProp(G, 'crops', x + rnd.range(-0.3, 0.3), r, { force: true });
    } else
      G.layoutSpots.push({
        kind: 'pocket',
        x: mapgenRound2((x0 + x1) / 2),
        z: mapgenRound2((z0 + z1) / 2),
        r: mapgenRound2(Math.min(fw, fd) / 2 - 1),
        in: 'field',
      });
  }
  /* hedgerows (and the lane): a run beside the road, off it by `off` metres past its edge, on one side, along a
     stretch of it; gaps where the ground is not free, and a gap or two on purpose */
  const roadRun = (off, len, sg) => {
    const Rp = G.road[0].pts,
      L = Rp.length,
      n = Math.round(len * 2),
      k0 = rnd.int(Math.min(L - 1, 30), Math.max(30, L - 30 - n));
    const pts = [];
    for (let k = k0; k < Math.min(L - 2, k0 + n); k += 4) {
      const a = Rp[Math.max(0, k - 1)],
        b = Rp[Math.min(L - 1, k + 1)],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        nx = -(b[1] - a[1]) / l,
        nz = (b[0] - a[0]) / l,
        r = P.road.width / 2 + off;
      pts.push([Rp[k][0] + nx * r * sg, Rp[k][1] + nz * r * sg]);
    }
    let placed = 0;
    const kind = mapgenPoolPick(rnd, fences, 'hedge'),
      gapAt = rnd.int(1, Math.max(1, pts.length - 2));
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a, b] = [pts[i], pts[i + 1]],
        mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        q = mapgenCellAt(G, ...mid),
        qa = mapgenCellAt(G, ...a),
        qb = mapgenCellAt(G, ...b);
      if (!free[q] || !free[qa] || !free[qb] || G.Lm[q] || i === gapAt) continue;
      placed += mapgenFenceRun(G, kind, a, b);
    }
    return placed;
  };
  const nh = span(plan.hedgerows);
  for (let i = 0; i < nh; i++) roadRun(rnd.range(3, 6), rnd.range(16, 30), rnd.chance(0.5) ? 1 : -1);
  /* the lane: a hedge 7-9 m off one side of the road over a long stretch, so a second way runs beside the road */
  if (plan.lane) roadRun(rnd.range(7, 9), rnd.range(34, 48), 1);
  /* rock outcrops: a ragged cluster of boulders on rock */
  const rocks = MAPGEN_OUTCROP[P.biome] || MAPGEN_OUTCROP.default,
    no = span(plan.outcrops);
  for (let o = 0; o < no; o++) {
    const r = rnd.range(2.5, 4.2),
      at = mapgenLayoutRect(G, free, rnd, Math.ceil(r * 2), Math.ceil(r * 2));
    if (!at) continue;
    mapgenOutcrop(G, rnd, at[0] + r, at[1] + r, r, rocks, free);
  }
  /* forest masses fill what is left: the free cells with the highest field, the field a few soft cores (along the
     road on the forest trail, else toward the back and the front edges) with noise */
  const left = budget - blocked();
  if (left > 0) {
    const cores = [];
    if (plan.hug) {
      const Rp = G.road[0].pts;
      for (let k = 10, sg = 1; k < Rp.length - 10; k += rnd.int(18, 30), sg = -sg) {
        const a = Rp[k - 1],
          b = Rp[k + 1],
          l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
          off = P.road.width / 2 + rnd.range(sg > 0 ? 6 : 11, sg > 0 ? 12 : 18);
        cores.push([
          Rp[k][0] - ((b[1] - a[1]) / l) * off * sg,
          Rp[k][1] + ((b[0] - a[0]) / l) * off * sg,
          rnd.range(9, 15),
        ]);
      }
    }
    const nc = rnd.int(3, 6);
    for (let c = 0; c < nc; c++)
      cores.push([
        rnd.range(6, w - 6),
        rnd.chance(0.5) ? rnd.range(-4, h * 0.25) : rnd.range(h * 0.75, h + 4),
        rnd.range(10, 18),
      ]);
    const val = new Float32Array(N),
      cand = [];
    for (let q = 0; q < N; q++) {
      if (!free[q] || G.Lm[q]) continue;
      const x = (q % w) + 0.5,
        z = Math.floor(q / w) + 0.5;
      let v = 0;
      for (const [cx, cz, cr] of cores) v = Math.max(v, 1 - Math.hypot(x - cx, z - cz) / cr);
      v += 0.45 * (mapgenFbm(x / 7, z / 7, s) - 0.5) + 0.25 * Math.max(0, 1 - Math.min(z, h - z) / 10);
      val[q] = v;
      cand.push(q);
    }
    cand.sort((a, b) => val[b] - val[a] || a - b);
    for (let i = 0; i < Math.min(left, cand.length); i++) G.Lm[cand[i]] = MAPGEN_LM.forest;
    mapgenForestTidy(G);
    mapgenForestClearings(G, rnd, span(plan.clearings));
    mapgenForestFill(G, rnd);
  }
}
/** a ragged cluster of boulders round (x, z), on the biome's rock ground; marks the mask */
export function mapgenOutcrop(G, rnd, x, z, r, rocks, free) {
  const sc = G.salt('layout', 'rock');
  mapgenPaintDisc(G, x, z, r, q => {
    const i = q % G.w,
      j = Math.floor(q / G.w),
      a = Math.atan2(j + 0.5 - z, i + 0.5 - x),
      edge = r * (0.75 + 0.45 * mapgenNoise(Math.cos(a) * 1.5 + 4, Math.sin(a) * 1.5 + 4, sc));
    if (!free[q] || G.Lm[q] || Math.hypot(i + 0.5 - x, j + 0.5 - z) > edge) return;
    G.Lm[q] = MAPGEN_LM.rock;
    G.T[q] = G.B.ground.rock || 'r';
  });
  mapgenFillMask(G, rnd, MAPGEN_LM.rock, () => rnd.pick(rocks), 1.1, [1.1, 1.6]);
}
/** forest masses tidied: bits under 24 cells dropped, holes under 12 cells filled */
export function mapgenForestTidy(G) {
  const { w, h } = G,
    F = MAPGEN_LM.forest;
  for (const want of [1, 0]) {
    const seen = new Uint8Array(w * h);
    for (let q0 = 0; q0 < w * h; q0++) {
      if (seen[q0] || (G.Lm[q0] === F) !== !!want) continue;
      const comp = [q0];
      seen[q0] = 1;
      for (let n = 0; n < comp.length; n++) {
        const q = comp[n],
          i = q % w,
          j = Math.floor(q / w);
        for (const [di, dj] of MAPGEN_FOUR) {
          const ii = i + di,
            jj = j + dj,
            r = jj * w + ii;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h || seen[r] || (G.Lm[r] === F) !== !!want) continue;
          seen[r] = 1;
          comp.push(r);
        }
      }
      if (want && comp.length < 24) for (const q of comp) G.Lm[q] = 0;
      /* a hole: a few cells shut in by forest, filled (never one touching the edge, or holding anything else) */
      if (!want && comp.length < 12 && comp.every(q => !G.Lm[q])) {
        const inside = comp.every(q => {
          const i = q % w,
            j = Math.floor(q / w);
          return i > 0 && j > 0 && i < w - 1 && j < h - 1;
        });
        if (inside) for (const q of comp) G.Lm[q] = F;
      }
    }
  }
}
/** how far each cell is from a cell not of mask value v (cells, 4-way), 0 outside */
export function mapgenMaskDepth(G, v) {
  const { w, h } = G,
    D = new Int16Array(w * h).fill(-1),
    Q = [];
  for (let q = 0; q < w * h; q++)
    if (G.Lm[q] !== v) {
      D[q] = 0;
      Q.push(q);
    }
  for (let n = 0; n < Q.length; n++) {
    const q = Q[n],
      i = q % w,
      j = Math.floor(q / w);
    for (const [di, dj] of MAPGEN_FOUR) {
      const ii = i + di,
        jj = j + dj,
        r = jj * w + ii;
      if (ii < 0 || jj < 0 || ii >= w || jj >= h || D[r] >= 0) continue;
      D[r] = D[q] + 1;
      Q.push(r);
    }
  }
  /* the scene's own edges don't count as an edge of a mass (a forest runs off the map) */
  return D;
}
/** clearings carved into the forest, each with a way in 2.5 m wide to the nearest open ground (pockets) */
export function mapgenForestClearings(G, rnd, n) {
  const { w } = G,
    D = mapgenMaskDepth(G, MAPGEN_LM.forest),
    cands = [];
  for (let q = 0; q < D.length; q++) if (D[q] >= 6) cands.push(q);
  for (let c = 0; c < n && cands.length; c++) {
    const q = cands[rnd.int(0, cands.length - 1)],
      x = (q % w) + 0.5,
      z = Math.floor(q / w) + 0.5;
    if (G.layoutSpots.some(p => Math.hypot(p.x - x, p.z - z) < 14)) continue;
    const r = rnd.range(3.2, 4.4);
    /* the nearest open ground that isn't the scene's edge */
    let best = /** @type {number[] | null} */ (null),
      bd = 1e9;
    for (let p = 0; p < D.length; p++) {
      if (G.Lm[p] || G.F[p] & 4) continue;
      const px = (p % w) + 0.5,
        pz = Math.floor(p / w) + 0.5;
      if (px < 6 || px > w - 6 || pz < 2 || pz > G.h - 2) continue;
      const d = Math.hypot(px - x, pz - z);
      if (d < bd) {
        bd = d;
        best = [px, pz];
      }
    }
    if (!best) continue;
    mapgenPaintDisc(G, x, z, r, p => {
      if (G.Lm[p] === MAPGEN_LM.forest) {
        G.Lm[p] = MAPGEN_LM.keep;
        G.F[p] |= 16;
        G.T[p] = G.B.ground.floor;
      }
    });
    for (let t = 0, L = Math.hypot(best[0] - x, best[1] - z); t <= L; t += 0.5)
      mapgenPaintDisc(G, x + ((best[0] - x) * t) / L, z + ((best[1] - z) * t) / L, 1.6, p => {
        if (G.Lm[p] === MAPGEN_LM.forest) G.Lm[p] = MAPGEN_LM.keep;
      });
    G.layoutSpots.push({
      kind: 'pocket',
      x: mapgenRound2(x),
      z: mapgenRound2(z),
      r: mapgenRound2(r - 1),
      in: 'forest',
    });
  }
}
/** the mask cells of value v filled with props: a wall along their edge (props from `edgeKind`, if given, `wall`
 * metres apart) and pieces inside (`kind`) on a jittered grid `step` apart; with `cover`, then a small piece wherever
 * a cell is still open, so the props alone make the mass solid (a mass whose ground blocks needs no cover) */
/** @param {any} G @param {any} rnd @param {number} v @param {() => string} kind @param {number} step
 * @param {number[]} sz @param {(() => string) | null} [edgeKind] @param {boolean} [cover] @param {number} [wall] */
export function mapgenFillMask(G, rnd, v, kind, step, sz, edgeKind = null, cover = true, wall = 2.6) {
  const { w, h } = G,
    D = mapgenMaskDepth(G, v),
    discs = /** @type {number[][]} */ ([]),
    put = (k, x, z, o) => {
      const p = mapgenPutProp(G, k, x, z, { force: true, ...o });
      if (!p) return;
      const M = G.cat[k],
        r = (M.solid != null ? M.solid : (M.shadow || 0) * 0.42) * (p.s || 1),
        [cx, cz] = turnedPoint(p, 0, r * 0.2);
      if (r > 0.05) discs.push([cx, cz, r]);
    },
    covered = (x, z) => discs.some(o => Math.hypot(x - o[0], z - o[1]) <= o[2]);
  if (edgeKind) {
    const edge = [],
      walls = /** @type {number[][]} */ ([]);
    for (let q = 0; q < w * h; q++) if (D[q] === 1) edge.push(q);
    for (const q of edge) {
      const x = (q % w) + rnd.range(0.2, 0.8),
        z = Math.floor(q / w) + rnd.range(0.2, 0.8);
      if (walls.some(o => Math.hypot(x - o[0], z - o[1]) < wall)) continue;
      walls.push([x, z]);
      put(edgeKind(), x, z, { s: rnd.range(0.9, 1.2), f: rnd.chance(0.45) });
    }
  }
  /* the inside on a jittered grid, the pieces' middles a cell in from the edge */
  for (let z = 0.5 + rnd.next() * step; z < h; z += step)
    for (let x = 0.5 + rnd.next() * step; x < w; x += step) {
      const px = x + rnd.range(-0.3, 0.3) * step,
        pz = z + rnd.range(-0.3, 0.3) * step,
        q = mapgenCellAt(G, px, pz);
      if (G.Lm[q] !== v || D[q] < (edgeKind ? 2 : 1)) continue;
      put(kind(), px, pz, { s: rnd.range(sz[0], sz[1]), extra: { rot: Math.round(rnd.range(-180, 180)) } });
    }
  /* then every cell still open gets a small piece */
  for (let q = 0; q < w * h && cover; q++) {
    if (G.Lm[q] !== v) continue;
    const x = (q % w) + 0.5,
      z = Math.floor(q / w) + 0.5;
    if (!covered(x, z)) put(kind(), x, z - 0.3, { s: sz[0] * 0.75 });
  }
}
/** a forest mass's props: the biome's trees along its edge and its canopy pieces inside, on deep forest ground that
 * no one walks on (so the pieces stand for the look alone); with no canopy, boulders on rock, packed to be solid */
export function mapgenForestFill(G, rnd) {
  const { B } = G,
    F = MAPGEN_LM.forest,
    canopy = !!(B.canopy && Object.keys(B.canopy).length),
    deep = canopy && !!G.terr[MAPGEN_DEEP];
  for (let q = 0; q < G.w * G.h; q++)
    if (G.Lm[q] === F) {
      G.T[q] = deep ? MAPGEN_DEEP : canopy ? B.ground.floor : B.ground.rock || 'r';
      G.F[q] |= 16;
    }
  if (canopy)
    mapgenFillMask(
      G,
      rnd,
      F,
      () => rnd.pick(B.canopy),
      MAPGEN_FOREST.step,
      MAPGEN_FOREST.size,
      () => rnd.pick(B.trees),
      !deep,
      MAPGEN_FOREST.wall
    );
  else mapgenFillMask(G, rnd, F, () => rnd.pick(MAPGEN_OUTCROP[G.P.biome] || MAPGEN_OUTCROP.default), 2, [1.2, 1.6]);
}

/**
 * RT-1: the spots a laid-out route marks for what comes later (RT-2 trainers, RT-3 set pieces, RT-4 finds), found on
 * the finished scene from the walk (props and all): `pocket` (made on purpose: a field with a gap, a clearing with a
 * way in; kept when reached), `clearing` (open ground 3.5 m round, off the road), `deadend` (where a walk from the
 * hub ends: a local peak of its length, hemmed in), `pinch` (the way on at its narrowest: dir its heading in
 * degrees, r half its width). { kind, x, z, y, r?, dir? }
 */
export function mapgenLayoutSpots(sc, scenery, G) {
  const R = mapgenReach(sc, scenery, sc.hub, { slope: true }),
    { N, gw, gh, seen, dist } = R,
    out = [],
    at = q => [((q % gw) + 0.5) / N, (Math.floor(q / gw) + 0.5) / N],
    yOf = (q, x, z) => mapgenRound2(mapgenSceneGround(sc, x, z) + (R.S ? R.S[q] / 20 : 0)),
    exits = (sc.edgeExits || []).map(e => mapgenExitPoint(sc.w, sc.h, e)),
    awayFromEnds = (x, z, m) =>
      Math.hypot(x - sc.hub[0], z - sc.hub[1]) > m && exits.every(p => Math.hypot(p[0] - x, p[1] - z) > m),
    offRoad = (x, z, m) => {
      const q = mapgenCellAt(G, x, z);
      return G.near[q] < 0 || G.dist[q] - G.roadPts[G.near[q]].r > m;
    },
    spaced = (x, z, m) =>
      out.every(p => Math.hypot(p.x - x, p.z - z) > m) && G.spots.every(p => Math.hypot(p.x - x, p.z - z) > 4);
  /* pockets made on purpose, where the walk reaches them */
  for (const p of G.layoutSpots || []) {
    const q = mapgenBetween(Math.floor(p.z * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(p.x * N), 0, gw - 1);
    if (seen[q]) out.push({ kind: 'pocket', x: p.x, z: p.z, y: yOf(q, p.x, p.z), r: p.r });
  }
  /* clearance: half-metre steps to the nearest cell you can't stand in */
  const C = new Int16Array(gw * gh).fill(-1),
    Q = [];
  for (let q = 0; q < gw * gh; q++)
    if (!seen[q]) {
      C[q] = 0;
      Q.push(q);
    }
  for (let n = 0; n < Q.length; n++) {
    const q = Q[n],
      i = q % gw,
      j = Math.floor(q / gw);
    for (const [di, dj] of MAPGEN_FOUR) {
      const ii = i + di,
        jj = j + dj,
        r = jj * gw + ii;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh || C[r] >= 0) continue;
      C[r] = C[q] + 1;
      Q.push(r);
    }
  }
  /* clearings: the widest open ground off the road (3.5 m clear at least), up to three, 15 m apart */
  const open = [];
  for (let q = 0; q < gw * gh; q++) {
    if (!seen[q] || C[q] < 7) continue;
    const [x, z] = at(q);
    if (x < 6 || x > sc.w - 6 || z < 3 || z > sc.h - 3 || !offRoad(x, z, 4) || !awayFromEnds(x, z, 8)) continue;
    open.push(q);
  }
  open.sort((a, b) => C[b] - C[a] || a - b);
  let nc = 0;
  for (const q of open) {
    if (nc >= 3) break;
    const [x, z] = at(q);
    if (!spaced(x, z, 15)) continue;
    out.push({ kind: 'clearing', x: mapgenRound2(x), z: mapgenRound2(z), y: yOf(q, x, z), r: mapgenRound2(C[q] / N) });
    nc++;
  }
  /* dead ends: the walk's local peaks (nothing within 3 m is further), hemmed in (under 2.5 m clear), off the road;
     the furthest first, each tested only until three are found */
  const ends = [];
  for (let q = 0; q < gw * gh; q++) if (seen[q] && C[q] <= 5 && dist[q] >= 40) ends.push(q);
  ends.sort((a, b) => dist[b] - dist[a] || a - b);
  const peakAt = q => {
    const i = q % gw,
      j = Math.floor(q / gw);
    for (let dj = -6; dj <= 6; dj++)
      for (let di = -6; di <= 6; di++) {
        const ii = i + di,
          jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < gw && jj < gh && dist[jj * gw + ii] > dist[q]) return false;
      }
    return true;
  };
  let nd = 0;
  for (const q of ends) {
    if (nd >= 3) break;
    const [x, z] = at(q);
    if (x < 6 || x > sc.w - 6 || z < 3 || z > sc.h - 3 || !offRoad(x, z, 4) || !awayFromEnds(x, z, 8)) continue;
    if (!spaced(x, z, 12) || !peakAt(q)) continue;
    out.push({ kind: 'deadend', x: mapgenRound2(x), z: mapgenRound2(z), y: yOf(q, x, z) });
    nd++;
  }
  /* pinches: along the way on (the `ahead` side's first exit's walk from the hub; WM-1), the open width across it,
     its narrowest */
  const A = mapgenAhead(G.P),
    way = (sc.edgeExits || []).filter(e => e.side === A).sort((a, b) => a.t - b.t)[0] || (sc.edgeExits || [])[0];
  if (way && way.path && way.path.length > 1) {
    const pts = mapgenResample(way.path, 1),
      wid = [];
    const openAt = (x, z) => {
      if (x < 0 || z < 0 || x >= sc.w || z >= sc.h) return false;
      return !!seen[Math.floor(z * N) * gw + Math.floor(x * N)];
    };
    for (let k = 1; k < pts.length - 1; k++) {
      const [x, z] = pts[k],
        a = pts[k - 1],
        b = pts[k + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        nx = -(b[1] - a[1]) / L,
        nz = (b[0] - a[0]) / L;
      if (!awayFromEnds(x, z, 10)) {
        wid.push(99);
        continue;
      }
      let left = 0,
        right = 0;
      while (left < 12 && openAt(x + nx * left, z + nz * left)) left += 0.25;
      while (right < 12 && openAt(x - nx * right, z - nz * right)) right += 0.25;
      wid.push(left >= 12 || right >= 12 ? 99 : left + right);
    }
    const order = wid.map((v, i) => i).filter(i => wid[i] <= 9);
    order.sort((a, b) => wid[a] - wid[b] || a - b);
    let np = 0;
    for (const i of order) {
      if (np >= 2) break;
      const [x, z] = pts[i + 1],
        a = pts[i],
        b = pts[i + 2];
      if (!spaced(x, z, 15)) continue;
      const q = Math.floor(z * N) * gw + Math.floor(x * N);
      out.push({
        kind: 'pinch',
        x: mapgenRound2(x),
        z: mapgenRound2(z),
        y: yOf(q, x, z),
        r: mapgenRound2(wid[i] / 2),
        dir: Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI),
      });
      np++;
    }
  }
  /* RT-2: where a route trainer stands. `face` (degrees, as pinch's dir: 0 east, 90 south) is the way it looks.
     Pockets, clearings and dead ends face the way in (down the walk from the hub, 2 m on), so a trainer there sees
     you come in (TR-2c's pockets too); a pinch gets a place to stand at its side (`stand`), facing across the road */
  const qOf = (x, z) => mapgenBetween(Math.floor(z * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(x * N), 0, gw - 1),
    deg = (dx, dz) => Math.round((Math.atan2(dz, dx) * 180) / Math.PI),
    standOK = (x, z) => x > 1 && z > 1 && x < sc.w - 1 && z < sc.h - 1 && seen[qOf(x, z)] && C[qOf(x, z)] >= 2;
  for (const p of [...G.spots.filter(p => p.kind === 'pocket'), ...out]) {
    if (p.kind === 'pinch') {
      const a = ((p.dir + 90) * Math.PI) / 180;
      for (const side of [1, -1]) {
        const off = Math.min(Math.max(p.r - 0.8, 1.2), 3),
          x = p.x + Math.cos(a) * off * side,
          z = p.z + Math.sin(a) * off * side;
        if (!standOK(x, z)) continue;
        p.stand = [mapgenRound2(x), mapgenRound2(z)];
        p.face = deg(p.x - x, p.z - z);
        break;
      }
      continue;
    }
    let q = qOf(p.x, p.z);
    const q0 = q;
    for (let n = 0; n < 4 && dist[q] > 0; n++) {
      const i = q % gw,
        j = Math.floor(q / gw);
      let best = q;
      for (const [di, dj] of MAPGEN_FOUR) {
        const ii = i + di,
          jj = j + dj,
          r = jj * gw + ii;
        if (ii >= 0 && jj >= 0 && ii < gw && jj < gh && seen[r] && dist[r] < dist[best]) best = r;
      }
      if (best === q) break;
      q = best;
    }
    const [x0, z0] = at(q0),
      [x1, z1] = q === q0 ? sc.hub : at(q);
    p.face = deg(x1 - x0, z1 - z0);
  }
  /* RT-2: by the road: along each way from the hub to an exit, about every 12 m (not by the hub or an exit), 2-3.5 m
     off its edge on one side and then the other, where you can stand and reach, facing the road */
  const side0 = out.length,
    roadsideOK = (x, z) =>
      out.slice(side0).every(p => Math.hypot(p.x - x, p.z - z) > 8) &&
      G.spots.every(p => Math.hypot(p.x - x, p.z - z) > 4);
  let flip = 1;
  for (const e of sc.edgeExits || []) {
    if (!e.path || e.path.length < 2) continue;
    const pts = mapgenResample(e.path, 1);
    for (let k = 6; k < pts.length - 1; k += 12) {
      const [px, pz] = pts[k],
        a = pts[k - 1],
        b = pts[k + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        nx = -(b[1] - a[1]) / L,
        nz = (b[0] - a[0]) / L;
      if (!awayFromEnds(px, pz, 8)) continue;
      const r = mapgenNearRoadWidth(G, px, pz);
      flip = -flip;
      found: for (const side of [flip, -flip])
        for (const d of [2.5, 2, 3, 3.5]) {
          const x = px + nx * (r + d) * side,
            z = pz + nz * (r + d) * side;
          if (!standOK(x, z) || !roadsideOK(x, z)) continue;
          out.push({
            kind: 'roadside',
            x: mapgenRound2(x),
            z: mapgenRound2(z),
            y: yOf(qOf(x, z), x, z),
            face: deg(px - x, pz - z),
          });
          break found;
        }
    }
  }
  /* RT-2: at a bridge's ends, a step back from the deck and to one side, facing the deck's middle (WA-3a: a river
     that runs downhill can leave the road beyond the bridge out of a sight that runs along it) */
  for (const S of sc.bridges || []) {
    const dx = S.b[0] - S.a[0],
      dz = S.b[1] - S.a[1],
      L = Math.hypot(dx, dz) || 1,
      ux = dx / L,
      uz = dz / L;
    for (const [end, u] of /** @type {[number[], number][]} */ ([
      [S.a, -1],
      [S.b, 1],
    ]))
      found: for (const side of [1, -1]) {
        const x = end[0] + ux * u * 1.5 - uz * side * (S.w / 2 + 0.6),
          z = end[1] + uz * u * 1.5 + ux * side * (S.w / 2 + 0.6);
        if (!standOK(x, z) || !roadsideOK(x, z)) continue;
        out.push({
          kind: 'bridge',
          x: mapgenRound2(x),
          z: mapgenRound2(z),
          y: yOf(qOf(x, z), x, z),
          face: deg((S.a[0] + S.b[0]) / 2 - x, (S.a[1] + S.b[1]) / 2 - z),
        });
        break found;
      }
  }
  /* RT-3: a jetty's land end, facing the land (a set piece's fishing jetty stands there) */
  if (G.jetty && seen[qOf(G.jetty.x, G.jetty.z)])
    out.push({
      kind: 'jetty',
      x: mapgenRound2(G.jetty.x),
      z: mapgenRound2(G.jetty.z),
      y: yOf(qOf(G.jetty.x, G.jetty.z), G.jetty.x, G.jetty.z),
      face: deg(-G.jetty.dir[0], -G.jetty.dir[1]),
    });
  return { spots: out, walk: R };
}
/** the share of a scene's half-metre cells you can walk to from the hub (R: from mapgenReach) */
export function mapgenWalkShare(R) {
  let n = 0;
  for (let q = 0; q < R.seen.length; q++) if (R.seen[q]) n++;
  return n / R.seen.length;
}

export function mapgenStagePlants(G) {
  const { P, B, w, h } = G,
    rnd = G.rng('plants');
  const nearExit = (x, z, r) => G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) < r);
  const treeOk = (x, z) =>
    !(G.F[mapgenCellAt(G, x, z)] & 16) && Math.hypot(x - G.hub[0], z - G.hub[1]) > 7 && !nearExit(x, z, 6);
  const treeAvoid = MAPGEN_PATH_GROUND + MAPGEN_WET;
  const T = P.nature.trees,
    gw = P.nature.growth;
  /* groves (RT-1: none on a laid-out route, whose forest masses stand for them) */
  const ng = mapgenLaidOut(P) ? 0 : Math.round(1 + T * 5);
  for (let g = 0; g < ng; g++) {
    const cx = rnd.range(6, w - 6),
      cz = rnd.range(6, h - 6),
      rx = rnd.range(4, 9),
      rz = rnd.range(3, 7);
    if (mapgenRoadDist(G, cx, cz) < 5) continue;
    const n = Math.round(((rx * rz) / 5) * (0.4 + T));
    for (let i = 0; i < n * 3 && n > 0; i++) {
      const a = rnd.range(0, Math.PI * 2),
        d = Math.sqrt(rnd.next()),
        x = cx + Math.cos(a) * rx * d,
        z = cz + Math.sin(a) * rz * d;
      if (treeOk(x, z))
        mapgenPutProp(G, rnd.pick(B.trees), x, z, {
          s: rnd.range(0.85, 1.15),
          f: rnd.chance(0.45),
          avoid: treeAvoid,
          road: 1.2,
        });
    }
  }
  /* a belt of trees along the edges, open at the exits */
  const belt = mapgenLaidOut(P) ? 0 : Math.round((w + h) * 2 * 0.14 * T);
  for (let i = 0; i < belt * 3; i++) {
    const side = rnd.int(0, 3),
      u = rnd.next(),
      inset = Math.abs(rnd.gauss()) * 2.5 + 1;
    const x = side === 0 ? u * w : side === 1 ? u * w : side === 2 ? inset : w - inset,
      z = side === 0 ? inset : side === 1 ? h - inset : u * h;
    if (treeOk(x, z) && !nearExit(x, z, 8))
      mapgenPutProp(G, rnd.pick(B.trees), x, z, {
        s: rnd.range(0.85, 1.2),
        f: rnd.chance(0.45),
        avoid: treeAvoid,
        road: 1.2,
      });
  }
  /* shrubs and rocks, scattered */
  const area = w * h;
  for (const [pool, per] of [
    [B.shrubs, 220],
    [B.rocks, 300],
  ]) {
    if (!pool) continue;
    const n = Math.round((area / per) * (0.4 + gw));
    for (let i = 0; i < n * 4 && n; i++) {
      const x = rnd.range(1, w - 1),
        z = rnd.range(1, h - 1);
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 5) continue;
      mapgenPutProp(G, rnd.pick(pool), x, z, {
        s: rnd.range(0.85, 1.15),
        f: rnd.chance(0.45),
        /* WA-5a: rocks may stand in shallows (mapgenPutProp) */
        avoid: pool === B.rocks ? MAPGEN_PATH_GROUND : treeAvoid,
        road: 0.9,
      });
    }
  }
  /* tall grass props in the tall grass */
  for (let q = 0; q < w * h; q++)
    if (G.F[q] & 32 && rnd.chance(0.35 * (0.5 + gw)))
      mapgenPutProp(G, rnd.pick(B.tall), (q % w) + rnd.range(0.1, 0.9), Math.floor(q / w) + rnd.range(0.1, 0.9), {
        s: rnd.range(0.85, 1.15),
        f: rnd.chance(0.45),
        squeeze: 0.5,
      });
  /* water plants on the banks and in shallow water */
  if (B.waterPlants && G.waterKind !== 'sea' && G.waterKind !== 'lava' && G.waterKind !== 'ice')
    for (let q = 0; q < w * h; q++)
      if (G.F[q] & 64 && !(G.F[q] & 8) && rnd.chance(0.12 * (0.4 + gw)))
        mapgenPutProp(G, rnd.pick(B.waterPlants), (q % w) + rnd.next(), Math.floor(q / w) + rnd.next(), {
          s: rnd.range(0.85, 1.15),
          f: rnd.chance(0.45),
        });
  mapgenGrowWild(G, rnd, gw);
}
/* the grow-wild rules (tools/grow-wild.py grow_scene), with its path test fixed: paved terrains, the path letters
   and the road itself are kept clear; never on a bridge or a jetty */
export function mapgenGrowWild(G, rnd, density) {
  const { w, h, cat, terr, B } = G,
    letters = new Set(G.T);
  const noWater = G.waterKind === 'sea' || G.waterKind === 'lava' || G.waterKind === 'ice';
  if (noWater) for (const c of MAPGEN_WET) letters.delete(c);
  const pool = {};
  for (const [k, M] of Object.entries(cat))
    if (M.family && M.grow && M.weight && [...M.grow].some(c => letters.has(c)))
      (pool[M.family] = pool[M.family] || []).push(k);
  const fams = Object.keys(MAPGEN_FAMILY_SHARE).filter(f => pool[f]);
  if (!fams.length) return;
  const share = Object.fromEntries(fams.map(f => [f, MAPGEN_FAMILY_SHARE[f]]));
  const want = Math.floor(((w * h) / 30) * density),
    count = {},
    cap = Math.max(6, Math.floor(want / 5)),
    favour = B.plants || {};
  const paved = c => (terr[c] && terr[c].paved) || MAPGEN_PATH_GROUND.includes(c);
  let added = 0;
  for (let tries = 0; added < want && tries < want * 40; tries++) {
    const fam = rnd.pick(share),
      x = rnd.range(0.5, w - 0.5),
      z = rnd.range(0.5, h - 0.5),
      q = mapgenCellAt(G, x, z),
      c = G.T[q];
    if (G.F[q] & (1 | 2 | 8 | 128)) continue;
    let near = false;
    for (const dx of [-0.5, 0, 0.5])
      for (const dz of [-0.5, 0, 0.5]) if (paved(mapgenGround(G, x + dx, z + dz))) near = true;
    if (near || paved(c)) continue;
    if (MAPGEN_WET.includes(c) && noWater) continue;
    const ks = pool[fam].filter(k => cat[k].grow.includes(c) && (count[k] || 0) < cap);
    if (!ks.length) continue;
    const k = rnd.pick(Object.fromEntries(ks.map(k => [k, cat[k].weight * (favour[k] ? 3 : 1)])));
    const M = cat[k];
    if (MAPGEN_WET.includes(c) && !M.grow.includes('w') && !M.grow.includes('d')) continue;
    const s = rnd.range(0.85, 1.15);
    if ((fam === 'trees' || fam === 'shrubs') && Math.hypot(x - G.hub[0], z - G.hub[1]) < 6) continue;
    const p = mapgenPutProp(G, k, x, z, {
      s,
      f: rnd.chance(0.45),
      w: MAPGEN_WILD_MARK,
      water: MAPGEN_WET.includes(c),
      gap: 0.25,
      road: 0.8,
    });
    if (p) {
      added++;
      count[k] = (count[k] || 0) + 1;
    }
  }
}

/* ---------- 7. feature ---------- */
export function mapgenStageFeature(G) {
  const { P, B } = G,
    rnd = G.rng('feature'),
    f = P.feature;
  const spotBeside = (minD, maxD, tries = 80) => {
    /* a spot this far from the road, away from the hub, the exits and water */
    for (let t = 0; t < tries; t++) {
      const x = rnd.range(8, G.w - 8),
        z = rnd.range(8, G.h - 8),
        q = mapgenCellAt(G, x, z),
        d = G.dist[q] - (G.near[q] >= 0 ? G.roadPts[G.near[q]].r : 0);
      if (d < minD || d > maxD || G.F[q] & 4) continue;
      if (Math.hypot(x - G.hub[0], z - G.hub[1]) < 12 || G.exits.some(e => Math.hypot(x - e.pt[0], z - e.pt[1]) < 12))
        continue;
      return [x, z];
    }
    return null;
  };
  if (f === 'lookout') {
    const at = spotBeside(4, 9);
    if (!at) return G.notes.push('no room for the lookout');
    const [x, z] = at;
    mapgenClearRound(G, x, z, 4.5);
    mapgenRaise(G, x, z, 5, 1.4);
    mapgenPutProp(G, 'lookout_tower', x, z + 1, { force: true });
    mapgenPutProp(G, 'bench_wood', x + 2.2, z - 1.6, { force: true });
    mapgenSpur(G, x, z);
  } else if (f === 'glade') {
    const at = spotBeside(5, 14);
    if (!at) return G.notes.push('no room for the glade');
    const [x, z] = at;
    mapgenClearRound(G, x, z, 7);
    mapgenPaintDisc(G, x, z, 6.5, q => {
      if (!(G.F[q] & (1 | 4))) G.T[q] = G.terr.E ? 'E' : B.ground.floor;
      G.F[q] = (G.F[q] & ~32) | 16;
    });
    mapgenPutProp(G, 'campfire', x, z, { force: true });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rnd.range(-0.3, 0.3);
      mapgenPutProp(G, i ? 'log' : 'stump', x + Math.cos(a) * 2.2, z + Math.sin(a) * 2.2, { force: true });
    }
    mapgenSpur(G, x, z);
  } else if (f === 'jetty' && G.pond) mapgenJetty(G);
}
/** boards from the bank toward the pond's middle, over the water, from the main road's nearest point (a path of the
 * road's surface to the bank, mooring posts on both sides); RT-3: G.jetty, where it starts on land and its way out */
export function mapgenJetty(G, full = false) {
  const { P } = G;
  const { x: px, z: pz, r } = G.pond;
  const M = G.road[0].pts;
  let best = M[0],
    bd = 1e9;
  for (const p of M) {
    const d = Math.hypot(p[0] - px, p[1] - pz);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  const dx = (px - best[0]) / (bd || 1),
    dz = (pz - best[1]) / (bd || 1);
  const start = bd - r - 2,
    end = bd - r * 0.25,
    /* RT-3 (full): a set piece's jetty has its path all the way from the road's edge, kept clear of the layout */
    from = full ? P.road.width / 2 : start - 3;
  if (full) for (let t = from; t < start; t += 1.5) G.keep.push([best[0] + dx * t, best[1] + dz * t, 1.2]);
  G.jetty = { x: best[0] + dx * (start - 0.8), z: best[1] + dz * (start - 0.8), dir: [dx, dz] };
  for (let t = Math.max(0, from); t < end; t += 0.25)
    for (let o = -0.9; o <= 0.9; o += 0.3) {
      const x = best[0] + dx * t - dz * o,
        z = best[1] + dz * t + dx * o,
        q = mapgenCellAt(G, x, z);
      if (t < start && !(G.F[q] & (1 | 4))) {
        G.T[q] = MAPGEN_SURFACES[P.road.surface];
        G.F[q] |= 2;
      } else if (t >= start) {
        G.T[q] = 'b';
        G.F[q] = (G.F[q] & ~4) | 128;
      }
    }
  for (const o of [-1.1, 1.1])
    for (let t = start + 1; t < end; t += 2.4)
      mapgenPutProp(G, 'dock_post', best[0] + dx * t - dz * o, best[1] + dz * t + dx * o, {
        force: true,
        water: true,
      });
}
export function mapgenClearRound(G, x, z, r) {
  G.props = G.props.filter(p => Math.hypot(p.x - x, p.z - z) > r);
  for (const [k, L] of G.occ)
    G.occ.set(
      k,
      L.filter(o => Math.hypot(o[0] - x, o[1] - z) > r)
    );
  G.keep.push([x, z, r * 0.6]);
}
export function mapgenRaise(G, x, z, r, by) {
  for (let j = 0; j <= G.h; j++)
    for (let i = 0; i <= G.w; i++) {
      const d = Math.hypot(i - x, j - z);
      if (d < r + 4) G.H[j * (G.w + 1) + i] += by * (d < r ? 1 : 1 - mapgenSmooth((d - r) / 4));
    }
}
export function mapgenSpur(G, x, z) {
  /* a short path from the road to a feature */
  const k = G.near[mapgenCellAt(G, x, z)];
  if (k < 0) return;
  const p = G.roadPts[k],
    L = Math.hypot(x - p.x, z - p.z),
    surf = MAPGEN_SURFACES[G.P.road.surface];
  for (let t = 0; t < L - 1.5; t += 0.3)
    mapgenPaintDisc(G, p.x + ((x - p.x) * t) / L, p.z + ((z - p.z) * t) / L, 0.7, q => {
      if (!(G.F[q] & (1 | 4))) {
        G.T[q] = surf;
        G.F[q] = (G.F[q] & ~32) | 2;
      }
    });
}

/* ---------- 8. props: signposts at the exits, lamps along the road, benches and bins, townsfolk spots ---------- */
export function mapgenStageProps(G) {
  const { P } = G,
    rnd = G.rng('props'),
    D = P.props;
  const side = (k, off) => {
    /* a point beside main-road sample k, off metres from its edge (sign = side) */
    const R = G.road[0].pts,
      a = R[Math.max(0, k - 1)],
      b = R[Math.min(R.length - 1, k + 1)],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
      p = R[k],
      r = P.road.width / 2 + Math.abs(off);
    const sg = Math.sign(off) || 1;
    return [p[0] - ((b[1] - a[1]) / L) * r * sg, p[1] + ((b[0] - a[0]) / L) * r * sg];
  };
  const R = G.road[0].pts;
  if (D.signs > 0)
    G.exits.forEach((e, x) => {
      const pts = x === 0 ? R : x === 1 ? R.slice().reverse() : G.road[x - 1].pts;
      const r = (x < 2 ? P.road.width : G.road[x - 1].width) / 2 + 1;
      for (let k = Math.min(pts.length - 2, 12); k < Math.min(pts.length - 1, 60); k += 2) {
        const a = pts[k - 1],
          b = pts[k + 1],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
          nx = -(b[1] - a[1]) / L,
          nz = (b[0] - a[0]) / L;
        for (const sg of [1, -1]) {
          const x = pts[k][0] + nx * r * sg,
            z = pts[k][1] + nz * r * sg;
          /* RT-3: tapped, it reads the place's name (walk-control.js: a sign with no words of its own) */
          if (!mapgenInLot(G, x, z, 0.6) && mapgenPutProp(G, 'signpost', x, z, { force: true, extra: { act: 'sign' } }))
            return;
        }
      }
    });
  if (D.lamps > 0) {
    const every = Math.round(40 - 30 * D.lamps) * 2; /* samples: 80 m down to 20 m */
    let sg = 1;
    for (let k = 20; k < R.length - 20; k += every) {
      const [x, z] = side(k, 0.9 * sg);
      if (mapgenPutProp(G, 'streetlamp', x, z, { road: 0.3 })) sg = -sg;
    }
  }
  const nb = Math.round(D.benches * 4);
  for (let i = 0; i < nb; i++) {
    const k = Math.floor(R.length * (0.15 + 0.7 * ((i + rnd.range(0.2, 0.8)) / Math.max(1, nb)))),
      sg = rnd.chance(0.5) ? 1 : -1,
      [x, z] = side(k, 1.3 * sg);
    if (mapgenPutProp(G, 'bench_wood', x, z, { road: 0.3 }) && rnd.chance(D.bins)) {
      const [bx, bz] = side(Math.min(R.length - 1, k + 3), 1.1 * sg);
      mapgenPutProp(G, 'trash', bx, bz, { road: 0.3 });
    }
  }
  const nf = Math.round(D.folk * 4);
  for (let i = 0; i < nf; i++) {
    const k = Math.floor(R.length * rnd.range(0.15, 0.85)),
      [x, z] = side(k, (rnd.chance(0.5) ? 1 : -1) * 1.1),
      q = mapgenCellAt(G, x, z);
    if ((!(G.F[q] & 4) || waterGenShallows(G, q)) && mapgenOccFree(G, x, z, 0.6)) {
      G.npcSpots.push([mapgenRound2(x), mapgenRound2(z)]);
      G.keep.push([x, z, 1]);
    }
  }
}

/* ---------- the scene ---------- */
export const MAPGEN_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/* base64 by hand: the logic has no atob or btoa (it runs with no DOM lib) */
export function mapgenDecodeBase64(s) {
  const n = s.replace(/=+$/, '').length,
    out = new Uint8Array(Math.floor((n * 3) / 4));
  let o = 0;
  for (let i = 0; i < n; i += 4) {
    const v =
      (MAPGEN_BASE64.indexOf(s[i]) << 18) |
      (MAPGEN_BASE64.indexOf(s[i + 1]) << 12) |
      (Math.max(0, MAPGEN_BASE64.indexOf(s[i + 2] || 'A')) << 6) |
      Math.max(0, MAPGEN_BASE64.indexOf(s[i + 3] || 'A'));
    out[o++] = (v >> 16) & 255;
    if (o < out.length) out[o++] = (v >> 8) & 255;
    if (o < out.length) out[o++] = v & 255;
  }
  return out;
}
export function mapgenEncodeBase64(bytes) {
  const A = MAPGEN_BASE64;
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    s +=
      A[(n >> 18) & 63] +
      A[(n >> 12) & 63] +
      (i + 1 < bytes.length ? A[(n >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? A[n & 63] : '=');
  }
  return s;
}
/**
 * the scene for these dials: { scene, notes }. ctx: { scenery (terrains, props), biomes, setPieces (RT-3: what the
 * pieces dial draws from; none without it) }.
 * @param {any} params
 * @param {{ scenery: any, biomes: Record<string, Biome>, setPieces?: import('../../types/game-data').SetPiecesData | null }} ctx
 */
export function mapgenScene(params, ctx) {
  const P0 = mapgenParams(params);
  if (!mapgenLaidOut(P0)) return mapgenBuild(P0, ctx, 0);
  /* RT-1: a laid-out route is made again, its blocking budget moved by how far the walkable share missed, until it
     lands within MAPGEN_WALKABLE (four tries; the nearest kept) */
  let best = /** @type {any} */ (null),
    aim = MAPGEN_WALK_AIM;
  for (let t = 0; t < 4; t++) {
    const r = mapgenBuild(t ? mapgenParams(params) : P0, ctx, aim),
      share = r.scene.layout.walk;
    if (!best || Math.abs(share - MAPGEN_WALK_AIM) < Math.abs(best.scene.layout.walk - MAPGEN_WALK_AIM)) best = r;
    if (share >= MAPGEN_WALKABLE[0] + 0.005 && share <= MAPGEN_WALKABLE[1] - 0.005) break;
    aim = mapgenBetween(aim + (MAPGEN_WALK_AIM - share), 0.3, 0.9);
  }
  return best;
}
/** one go at a scene (mapgenScene); aim: a laid-out route's walkable share wanted (0 when not laid out) */
export function mapgenBuild(P, ctx, aim) {
  const G = mapgenNewWork(P, ctx);
  for (const s of P.edges || [])
    if (!G.joined.includes(s))
      G.notes.push(`no room for the exit joined on the ${MAPGEN_SIDE_NAME[s.side]} side (four exits at most)`);
  mapgenStageHeights(G);
  mapgenPinSides(G, 16);
  mapgenPinEdges(G, 16);
  mapgenStageRoad(G);
  mapgenStageGround(G);
  mapgenStageWater(G);
  mapgenChooseHub(G);
  mapgenStageExits(G);
  mapgenStageLand(G);
  waterGenFalls(G); /* WA-2b: the river steps with the land, its waterfalls and a set piece (logic/water-gen.js) */
  waterGenKinds(G); /* WA-5a: rapids, a hot spring, the bog, an oasis, cave water (logic/water-gen.js) */
  mapgenStageFeature(G);
  mapgenStageEdgeGround(G);
  mapgenStageTown(G);
  mapgenStageLots(G);
  /* RT-3: a laid-out place with a pond gets a jetty when a set piece wants one (the fishing jetty) */
  if (mapgenLaidOut(P) && P.pieces > 0 && G.pond && !G.jetty && mapgenPiecesWant(P, ctx.setPieces, 'jetty'))
    mapgenJetty(G, true);
  if (mapgenLaidOut(P)) mapgenStageLayout(G, aim);
  mapgenStagePlants(G);
  mapgenStageProps(G);
  mapgenPinSides(G, 6);
  mapgenPinEdges(G, 6);
  const { w, h, B } = G;
  const tiles = [];
  for (let j = h - 1; j >= 0; j--) tiles.push(G.T.slice(j * w, (j + 1) * w).join(''));
  const heights = [];
  for (let j = h; j >= 0; j--)
    heights.push(Array.from(G.H.subarray(j * (w + 1), (j + 1) * (w + 1)), v => mapgenRound2(v) || 0));
  G.props.sort((a, b) => b.z - a.z || a.x - b.x);
  /** @type {any} */
  const sc = {
    name: (B.name || P.biome) + ' route',
    kind: P.kind,
    biome: P.biome,
    w,
    h,
    edge: B.ground.base,
    cam: { pitch: 34, h: 9, fov: 1 },
    blur: 1,
    folk: mapgenTownFolk(G),
    ...(B.look || {}),
    hub: G.hub,
    exits: G.edgeExits.map(e => mapgenExitPoint(w, h, e)),
    edgeExits: G.edgeExits,
    tiles,
    heights,
    props: G.props,
    life: mapgenSceneLife(G),
    npcSpots: G.npcSpots,
    wild: MAPGEN_WILD_MARK,
  };
  if (G.streams.length) sc.streams = G.streams;
  if (G.falls && G.falls.length) sc.falls = G.falls;
  if (G.bridges.length) sc.bridges = G.bridges;
  if (G.waters.length) sc.waters = G.waters;
  if (G.waterKind) sc.waterKind = G.waterKind;
  if (G.spots.length) sc.spots = G.spots;
  if (G.grassPatches.length) sc.grassPatches = G.grassPatches;
  /* TW-2: what a town's folk say (run-scenes.js adds the region's) */
  if (P.kind === 'town' && B.town && B.town.chat) sc.chat = B.town.chat.slice();
  if (G.stepsUsed) {
    const raw = new Int16Array(G.S.length);
    let any = false;
    for (let i = 0; i < raw.length; i++) if ((raw[i] = Math.round(G.S[i] * 20))) any = true;
    if (any) {
      sc.steps = mapgenEncodeBase64(new Uint8Array(raw.buffer));
      sc.stepm = mapgenEncodeBase64(G.M);
    }
  }
  /* TR-2c: no ledge drops you where you can't get back from (judged on the finished scene, plants and all) */
  if (G.ledgeCells && sc.stepm) {
    mapgenUntrap(sc, ctx.scenery, G);
    mapgenPockets(sc, ctx.scenery, G);
    if (G.spots.length) sc.spots = G.spots;
  }
  /* RT-1: a laid-out route's spots and its walkable share */
  if (mapgenLaidOut(P)) {
    const L = mapgenLayoutSpots(sc, ctx.scenery, G);
    G.spots.push(...L.spots);
    if (G.spots.length) sc.spots = G.spots;
    /* RT-3: set pieces on spare spots (they change what you can walk, so the share is measured after them) */
    const walk =
      P.pieces > 0 && ctx.setPieces ? mapgenStagePieces(G, sc, ctx.scenery, ctx.setPieces) || L.walk : L.walk;
    sc.layout = { plan: P.layout, walk: Math.round(mapgenWalkShare(walk) * 1000) / 1000 };
    /* RT-4: where wild Billies of each habitat wait (after the pieces, on what they leave) */
    const hab = mapgenHabitats(G, sc, walk);
    if (hab) sc.habitats = hab;
    /* RT-4b: where Cut brambles could plug a pocket or a dead end (put up by the run, logic/route-finds.js) */
    mapgenMouths(sc, ctx.scenery, walk, G);
  }
  waterGenClimbs(sc, ctx.scenery); /* WA-2b: which falls the Waterfall field move climbs (logic/water-gen.js) */
  waterGenReeds(G, sc); /* WA-5a: a reed or two in a marsh hides an item (logic/water-gen.js) */
  sc.gen = { v: MAPGEN_VERSION, params: P, seed: P.seed };
  return { scene: sc, notes: G.notes };
}

/* ---------- RT-3: set pieces ---------- */
/** the most set pieces a place may ask for (the pieces dial) */
export const MAPGEN_PIECES_MOST = 6;
/** the pieces dial, kept only when given (a scene made without it is the one it always was) */
export const MAPGEN_PIECES_DIALS = { pieces: 0 };
/** a route trainer's sight a piece keeps out of (logic/route-trainers.js routeInSight: rules.json run.trainers.sight
 * 6 m, 0.9 m to each side), with a little room */
export const MAPGEN_PIECE_SIGHT = { range: 6.5, half: 1.1 };
/** the spots a piece leaves for the route trainers (logic/route-trainers.js ROUTE_SPOTS: by the road, aside; RT-2's
 * 4-6 a place, half of them by the road) */
export const MAPGEN_PIECE_LEAVE = {
  road: ['roadside', 'pinch', 'bridge', 4],
  aside: ['pocket', 'clearing', 'deadend', 4],
};
/** a set piece's draw weight on this place: its biome's (default for one not listed) times its plan's
 * @param {any} P @param {import('../../types/game-data').SetPiece} S */
export function mapgenPieceWeight(P, S) {
  /* RL-14: a place of a kind (the site dial: a run's scrapyard) draws only the pieces made for it, by their own weights */
  const w = P.site ? ((S.sites && S.sites[P.site]) ?? 0) : (S.biomes[P.biome] ?? S.biomes.default ?? 0);
  return w * ((S.plans && P.layout && S.plans[P.layout]) ?? 1);
}
/** does a piece that takes this spot kind have a weight here? @param {any} P @param {any} D setPieces.json @param {string} kind */
export function mapgenPiecesWant(P, D, kind) {
  return !!D && Object.values(D.pieces || {}).some(S => S.on.includes(kind) && mapgenPieceWeight(P, S) > 0);
}
/** the half-metre cells a placed prop covers, as walk-view.js navGrid blocks them (a box its turned rectangle, posts
 * their discs, else a disc; at least 0.3 m round, so a prop that blocks nothing still keeps its place) */
export function mapgenPropCells(p, M, N = 2, ppu = 34) {
  const out = [],
    s = p.s || 1,
    disc = (cx, cz, r) => {
      for (let j = Math.floor((cz - r) * N); j < Math.ceil((cz + r) * N); j++)
        for (let i = Math.floor((cx - r) * N); i < Math.ceil((cx + r) * N); i++)
          if (Math.hypot((i + 0.5) / N - cx, (j + 0.5) / N - cz) <= r) out.push([i, j]);
    };
  if (M && M.box) {
    const w = M.box[0] * s,
      d = M.box[1] * s,
      B = turnedBounds(p, -w / 2, -0.1, w / 2, d);
    for (let j = Math.floor(B[1] * N); j < Math.ceil(B[3] * N); j++)
      for (let i = Math.floor(B[0] * N); i < Math.ceil(B[2] * N); i++) {
        const [lx, lz] = pointInProp(p, (i + 0.5) / N, (j + 0.5) / N);
        if (lx >= -w / 2 && lx <= w / 2 && lz >= -0.1 && lz <= d) out.push([i, j]);
      }
    return out;
  }
  if (M && M.posts)
    for (const o of M.posts) {
      const [px, pz] = turnedPoint(p, (o.x / ppu) * s * (p.f ? -1 : 1), 0.15);
      disc(px, pz, Math.max(0.3, (o.r || 0.4) * s));
    }
  const r = Math.max(0.3, M && M.solid != null ? M.solid * s : M && M.flat ? 0 : ((M && M.shadow) || 0) * 0.42 * s),
    [cx, cz] = turnedPoint(p, 0, r * 0.2);
  disc(cx, cz, r);
  return out;
}
/**
 * RT-3: set pieces (setPieces.json) on a laid-out place's spare spots, P.pieces of them at most, each placed as a
 * whole or not at all, turned so its front faces the road (a clearing's way in, a jetty's land): roadside spots and
 * clearings (never pockets, dead ends, pinches or bridges), leaving MAPGEN_PIECE_LEAVE for the route trainers, a jetty
 * spot for a piece that takes one. A piece clears the small plants under it and needs every cell it covers on ground
 * you can walk to (past the trees, rocks, fences and forest), off the road, its verge and the tall grass, out of every
 * other spot's sight and 1.5 m from where its trainer would stand. Once placed, a piece that cuts the walk to an exit,
 * a spot or its person, or leaves you below a ledge with no way back, is taken out again (the last first). The taken spot leaves scene.spots; scene.pieces lists them
 * ({ id, x, z, rot, spot, f: mirrored, people }).
 * Returns the walk (mapgenReach) with the pieces in, or null when none was placed.
 * @param {any} G @param {any} sc @param {any} scenery @param {import('../../types/game-data').SetPiecesData} D
 */
export function mapgenStagePieces(G, sc, scenery, D) {
  const { P, B } = G,
    rnd = G.rng('pieces'),
    N = 2,
    soft = new Set([
      ...Object.keys(B.plants || {}),
      ...Object.keys(B.shrubs || {}),
      ...Object.keys(B.tall || {}),
      ...Object.keys(B.waterPlants || {}),
      ...Object.keys(B.rocks || {}).filter(k => mapgenRadius(G.cat[k]) < 0.6),
    ]),
    isSoft = p => p.w === MAPGEN_WILD_MARK || soft.has(p.k),
    /* the walk past everything but the small plants: where a piece may stand */
    R0 = mapgenReach({ ...sc, props: sc.props.filter(p => !isSoft(p)) }, scenery, sc.hub, { slope: true }),
    seen0 = (i, j) => i >= 0 && j >= 0 && i < R0.gw && j < R0.gh && !!R0.seen[j * R0.gw + i],
    exits = (sc.edgeExits || []).map(e => mapgenExitPoint(sc.w, sc.h, e)),
    rad = a => (a * Math.PI) / 180,
    spots = /** @type {any[]} */ (sc.spots || []),
    ids = Object.keys(D.pieces)
      .sort()
      .filter(k => mapgenPieceWeight(P, D.pieces[k]) > 0),
    placed = [];
  if (!ids.length) return null;
  const kindOf = k =>
    MAPGEN_PIECE_LEAVE.road.includes(k) ? 'road' : MAPGEN_PIECE_LEAVE.aside.includes(k) ? 'aside' : '';
  /* may this spot be taken, leaving enough of its kind for the trainers? */
  const spare = sp => {
    const g = kindOf(sp.kind);
    if (!g) return true;
    const L = MAPGEN_PIECE_LEAVE[g],
      n = /** @type {any[]} */ (sc.spots || []).filter(o => L.includes(o.kind)).length;
    return n - 1 >= /** @type {number} */ (L[L.length - 1]);
  };
  /* is a cell clear of every other spot: its stand's room and its sight */
  const clearOf = (sp, x, z) =>
    spots.every(o => {
      if (o === sp) return true;
      const at = o.stand || [o.x, o.z];
      if (Math.hypot(x - at[0], z - at[1]) < 1.5 || Math.hypot(x - o.x, z - o.z) < 1.5) return false;
      if (!Number.isFinite(o.face)) return true;
      const ux = Math.cos(rad(o.face)),
        uz = Math.sin(rad(o.face)),
        along = (x - at[0]) * ux + (z - at[1]) * uz,
        side = Math.abs(-(x - at[0]) * uz + (z - at[1]) * ux);
      return !(along > 0 && along <= MAPGEN_PIECE_SIGHT.range && side <= MAPGEN_PIECE_SIGHT.half);
    });
  /* where a piece goes on a spot: its origin (the middle of its front) and its turn */
  const anchor = (S, sp) => {
    const f = sp.face,
      ux = Math.cos(rad(f)),
      uz = Math.sin(rad(f)),
      back = sp.kind === 'clearing' ? S.r / 2 : 0;
    return { x: sp.x + ux * back, z: sp.z + uz * back, rot: normalTurn(f + 90) };
  };
  /* try piece S on spot sp: { add, gone, people } or null */
  const fit = (S, sp, flip) => {
    if (!Number.isFinite(sp.face) || !spare(sp)) return null;
    const O = anchor(S, sp),
      add = [],
      cover = [];
    if (
      Math.hypot(O.x - sc.hub[0], O.z - sc.hub[1]) < 6 + S.r / 2 ||
      exits.some(e => Math.hypot(O.x - e[0], O.z - e[1]) < 6 + S.r / 2)
    )
      return null;
    const cellOK = (i, j, wet) => {
      const x = (i + 0.5) / N,
        z = (j + 0.5) / N;
      if (x < 1 || z < 1 || x > sc.w - 1 || z > sc.h - 1) return false;
      const q = mapgenCellAt(G, x, z),
        F = G.F[q];
      if (wet) return !(F & (8 | 128));
      if (F & (1 | 2 | 4 | 8 | 32 | 128) || !seen0(i, j)) return false;
      if (G.near[q] >= 0 && G.dist[q] - G.roadPts[G.near[q]].r < 0.8) return false;
      if (mapgenInLot(G, x, z, 0.3)) return false;
      return clearOf(sp, x, z);
    };
    for (const q of S.props) {
      const M = G.cat[q.k];
      if (!M) return null;
      const [x, z] = turnedPoint(O, q.x * flip, q.z),
        p = { k: q.k, x: mapgenRound2(x), z: mapgenRound2(z), g: 1 };
      if (M.model) {
        const r = normalTurn(O.rot + (q.rot || 0) * flip);
        if (r) p.rot = r;
      }
      if (q.say) Object.assign(p, { act: 'sign', say: q.say });
      if (q.water && !(G.F[mapgenCellAt(G, p.x, p.z)] & 4)) return null;
      const cells = mapgenPropCells(p, M, N, scenery.ppu || 34);
      if (!cells.every(([i, j]) => cellOK(i, j, !!q.water))) return null;
      add.push(p);
      cover.push(...cells);
    }
    const people = [];
    for (const q of S.people || []) {
      const [x, z] = turnedPoint(O, q.x * flip, q.z),
        i = Math.floor(x * N),
        j = Math.floor(z * N);
      if (!cellOK(i, j, false)) return null;
      people.push({
        who: q.who,
        x: mapgenRound2(x),
        z: mapgenRound2(z),
        face: sp.face,
        ...(q.event ? { event: q.event } : {}),
        ...(q.say ? { say: q.say } : {}),
      });
    }
    /* the small plants under it go */
    const hit = new Set(cover.map(([i, j]) => j * R0.gw + i)),
      gone = sc.props.filter(o => {
        if (!isSoft(o)) return false;
        const i = Math.floor(o.x * N),
          j = Math.floor(o.z * N);
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) if (hit.has((j + dj) * R0.gw + i + di)) return true;
        return false;
      });
    return { O, flip, add, gone, people };
  };
  const put = (id, sp, F) => {
    const gone = new Set(F.gone);
    sc.props = G.props = sc.props.filter(o => !gone.has(o)).concat(F.add);
    sc.spots = G.spots = sc.spots.filter(o => o !== sp);
    placed.push({ id, sp, F });
  };
  const undo = () => {
    const L = placed.pop(),
      add = new Set(L.F.add);
    sc.props = G.props = sc.props.filter(o => !add.has(o)).concat(L.F.gone);
    sc.spots = G.spots = [...sc.spots, L.sp];
  };
  /* the draw: a jetty's piece first when there is a jetty, then by weight, each piece once */
  const left = new Set(ids),
    order = [];
  const draw = only => {
    const W = Object.fromEntries([...left].filter(only).map(k => [k, mapgenPieceWeight(P, D.pieces[k])]));
    if (!Object.keys(W).length) return null;
    const k = rnd.pick(W);
    left.delete(k);
    return k;
  };
  if (spots.some(o => o.kind === 'jetty')) {
    const k = draw(k => D.pieces[k].on.includes('jetty'));
    if (k) order.push(k);
  }
  for (let k; (k = draw(() => true));) order.push(k);
  for (const id of order) {
    if (placed.length >= P.pieces) break;
    const S = D.pieces[id],
      cands = (sc.spots || [])
        .filter(o => S.on.includes(o.kind))
        .map(o => [rnd.next(), o])
        .sort((a, b) => a[0] - b[0])
        .map(a => a[1]);
    /* each spot as drawn, then mirrored (left for right); a piece with people first the way that has them nearer the
       camera (its south side, low z) than its props, so a booth's picture doesn't hide them */
    const lead = (/** @type {any} */ sp, /** @type {number} */ flip) => {
      if (!S.people || !S.people.length) return 0;
      const O = anchor(S, sp),
        z = (/** @type {any} */ q) => turnedPoint(O, q.x * flip, q.z)[1],
        mean = (/** @type {any[]} */ L) => L.reduce((a, q) => a + z(q), 0) / L.length;
      return mean(S.people) - mean(S.props);
    };
    found: for (const sp of cands)
      for (const flip of Number.isFinite(sp.face) && lead(sp, -1) < lead(sp, 1) ? [-1, 1] : [1, -1]) {
        const F = fit(S, sp, flip);
        if (!F) continue;
        put(id, sp, F);
        break found;
      }
  }
  if (!placed.length) return null;
  /* nothing cut off: every exit, every spot left and each piece's person still walked to, and no ledge you can't walk
     back up from (the last piece out first) */
  let R = /** @type {any} */ (null);
  for (;;) {
    const T = mapgenTraps(sc, scenery);
    R = T.R;
    const ok =
      !T.n &&
      exits.every(e => mapgenReached(R, e[0], e[1])) &&
      sc.spots.every(o => mapgenReached(R, o.x, o.z) && (!o.stand || mapgenReached(R, o.stand[0], o.stand[1]))) &&
      placed.every(L =>
        L.F.people.every(q => {
          const u = rad(q.face);
          return mapgenReached(R, q.x + Math.cos(u) * 0.8, q.z + Math.sin(u) * 0.8);
        })
      );
    if (ok || !placed.length) break;
    undo();
  }
  if (!placed.length) return null;
  sc.props.sort((a, b) => b.z - a.z || a.x - b.x);
  if (!sc.spots.length) delete sc.spots;
  sc.pieces = placed.map(L => ({
    id: L.id,
    x: mapgenRound2(L.F.O.x),
    z: mapgenRound2(L.F.O.z),
    rot: L.F.O.rot,
    spot: L.sp.kind,
    ...(L.F.flip < 0 ? { f: 1 } : {}),
    ...(L.F.people.length ? { people: L.F.people } : {}),
  }));
  return R;
}

/* ---------- RT-4: habitats ---------- */
/** a habitat's most points a place, and how far apart they stand (m) */
export const MAPGEN_HABITAT = { most: 12, apart: 3 };
/** the eight ways a metre round a point mapgenHabitats looks for water or a forest */
export const MAPGEN_HABITAT_ROUND = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
];
/**
 * RT-4: the points where a laid-out place's wild Billies of a habitat wait (rules.json run.wild.habitats; tall grass
 * is the grass habitat's own, sc.grassPatches): `water`, dry ground you walk to within a metre of water; `woods`,
 * the same beside a forest mass (boulders where a biome has no canopy). Each off the road, the hub, the exits, the
 * spots and the set pieces, clear of every prop but tall grass, up to MAPGEN_HABITAT.most of them spaced apart, drawn
 * on the `habitats` stream. { water: [[x, z], ...], woods: [...] }, a habitat with none left out; null with neither
 * @param {any} G @param {any} sc @param {any} R the walk on the finished scene (props and pieces in)
 */
export function mapgenHabitats(G, sc, R) {
  const { w, h } = G,
    { N, gw, gh, seen } = R,
    rnd = G.rng('habitats'),
    exits = (sc.edgeExits || []).map(e => mapgenExitPoint(sc.w, sc.h, e)),
    stands = (sc.spots || []).map(p => (p.stand ? p.stand : [p.x, p.z])),
    pieces = (sc.pieces || []).map(p => [p.x, p.z]),
    /* cells a prop covers (tall grass aside), on the walk grid */
    held = new Uint8Array(gw * gh),
    tile = (x, z) => (x >= 0 && z >= 0 && x < w && z < h ? Math.floor(z) * w + Math.floor(x) : -1);
  for (const p of sc.props || []) {
    if (/tallgrass/.test(p.k)) continue;
    const r = 0.7;
    for (let j = Math.max(0, Math.floor((p.z - r) * N)); j < Math.min(gh, Math.ceil((p.z + r) * N)); j++)
      for (let i = Math.max(0, Math.floor((p.x - r) * N)); i < Math.min(gw, Math.ceil((p.x + r) * N)); i++)
        held[j * gw + i] = 1;
  }
  const beside = (x, z, test) => {
    for (const [dx, dz] of MAPGEN_HABITAT_ROUND) {
      const q = tile(x + dx, z + dz);
      if (q >= 0 && test(q)) return true;
    }
    return false;
  };
  const kinds = {
      water: q => MAPGEN_WET.includes(G.T[q]),
      woods: q => G.Lm[q] === MAPGEN_LM.forest,
    },
    found = /** @type {Record<string, number[]>} */ ({ water: [], woods: [] });
  for (let q = 0; q < gw * gh; q++) {
    if (!seen[q] || held[q]) continue;
    const x = ((q % gw) + 0.5) / N,
      z = (Math.floor(q / gw) + 0.5) / N,
      t = tile(x, z);
    if (t < 0 || G.T[t] === 't' || G.T[t] === 'b' || x < 2 || x > w - 2) continue;
    /* the cheap tests first: most cells are beside neither */
    const by = Object.keys(kinds).filter(k => beside(x, z, kinds[k]));
    if (!by.length) continue;
    if (G.near[t] >= 0 && G.dist[t] - G.roadPts[G.near[t]].r < 1.5) continue;
    if (Math.hypot(x - sc.hub[0], z - sc.hub[1]) < 6 || exits.some(e => Math.hypot(e[0] - x, e[1] - z) < 5)) continue;
    if (stands.some(s => Math.hypot(s[0] - x, s[1] - z) < 2.5) || pieces.some(s => Math.hypot(s[0] - x, s[1] - z) < 4))
      continue;
    for (const k of by) found[k].push(q);
  }
  /** @type {Record<string, [number, number][]>} */
  const out = {};
  for (const k in found) {
    const C = found[k],
      took = /** @type {[number, number][]} */ ([]);
    for (let n = C.length - 1; n > 0; n--) {
      const m = rnd.int(0, n);
      [C[n], C[m]] = [C[m], C[n]];
    }
    for (const q of C) {
      if (took.length >= MAPGEN_HABITAT.most) break;
      const x = ((q % gw) + 0.5) / N,
        z = (Math.floor(q / gw) + 0.5) / N;
      if (took.every(p => Math.hypot(p[0] - x, p[1] - z) >= MAPGEN_HABITAT.apart))
        took.push([mapgenRound2(x), mapgenRound2(z)]);
    }
    if (took.length) out[k] = took;
  }
  return Object.keys(out).length ? out : null;
}

/* ---------- RT-4b: the mouths Cut brambles can plug ---------- */
/** a mouth's measures: brambles across a crossing at most `wide` metres, `step` apart, `from`-`to` metres back from
 * the spot along the walk; what a plug shuts off at most `most` of the walked cells, and nothing within `keep`
 * metres of an exit, the hub, another spot or a set piece */
export const MAPGEN_MOUTH = { wide: 3.6, step: 0.8, from: 2.5, to: 14, most: 0.15, keep: 1.5 };
/** the eight ways from a cell, for the plug's check (a diagonal squeeze counts as a way through) */
export const MAPGEN_EIGHT = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
/**
 * RT-4b: on a laid-out place, each pocket's and dead end's mouth: where brambles (bush_bramble, solid as the walk
 * grid reads it) across the narrowest crossing of the walk to it, 2.5-14 m back, shut it off from the hub and shut
 * off nothing that must stay open (an exit, the hub, another spot or its stand, a set piece; at most 15% of what is
 * walked). The spot keeps them as `mouth` ([[x, z], ...]); the run puts them up in front of a find or the rarer one
 * (logic/route-finds.js). No random draw: it moves nothing else. @param {any} sc @param {any} scenery
 * @param {any} R the walk on the finished scene (mapgenReach with slope, props and pieces in)
 */
export function mapgenMouths(sc, scenery, R, G) {
  const M = scenery && scenery.props && scenery.props.bush_bramble;
  if (!M || !R || !R.dist || !sc.spots) return;
  const { N, gw, gh, seen, dist, step } = R,
    br = M.solid != null ? M.solid : 0.5,
    cellOf = (x, z) => mapgenBetween(Math.floor(z * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(x * N), 0, gw - 1),
    xy = q => [((q % gw) + 0.5) / N, (Math.floor(q / gw) + 0.5) / N],
    walked = seen.reduce((a, v) => a + v, 0),
    exits = (sc.edgeExits || []).map(e => mapgenExitPoint(sc.w, sc.h, e)),
    offRoad = (x, z) => {
      if (!G) return true;
      const q = mapgenCellAt(G, x, z);
      return G.near[q] < 0 || G.dist[q] - G.roadPts[G.near[q]].r > 0.6;
    };
  for (const sp of sc.spots) {
    if (sp.kind !== 'pocket' && sp.kind !== 'deadend') continue;
    const s = cellOf(sp.x, sp.z);
    if (!seen[s] || dist[s] < 0) continue;
    /* the walk back from the spot toward the hub: each step to a neighbour one nearer */
    const path = [s];
    for (let q = s; dist[q] > 0 && path.length < (MAPGEN_MOUTH.to + 2) * N;) {
      const i = q % gw,
        j = Math.floor(q / gw);
      let next = -1;
      for (const [di, dj] of MAPGEN_FOUR) {
        const ii = i + di,
          jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
        const r = jj * gw + ii;
        if (seen[r] && dist[r] === dist[q] - 1) {
          next = r;
          break;
        }
      }
      if (next < 0) break;
      path.push(next);
      q = next;
    }
    /* the crossings: the open width across the walk's heading at each cell, the narrowest first, the nearer on a tie */
    const open = (x, z) => x >= 0 && z >= 0 && x < sc.w && z < sc.h && !!seen[cellOf(x, z)];
    const tries = [];
    for (let k = MAPGEN_MOUTH.from * N; k < path.length - 2 && k <= MAPGEN_MOUTH.to * N; k++) {
      const [x, z] = xy(path[k]),
        a = xy(path[k - 2]),
        b = xy(path[k + 2]),
        L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
        nx = -(b[1] - a[1]) / L,
        nz = (b[0] - a[0]) / L;
      let l = 0,
        r = 0;
      while (l < MAPGEN_MOUTH.wide && open(x + nx * (l + 0.25), z + nz * (l + 0.25))) l += 0.25;
      while (r < MAPGEN_MOUTH.wide && open(x - nx * (r + 0.25), z - nz * (r + 0.25))) r += 0.25;
      if (l + r + 0.5 > MAPGEN_MOUTH.wide) continue;
      tries.push({ k, x, z, nx, nz, l, r });
    }
    tries.sort((a, b) => a.l + a.r - (b.l + b.r) || a.k - b.k);
    for (const T of tries.slice(0, 4)) {
      /* brambles across, from one side's last open cell to the other's, `step` apart, the ends included */
      const W = T.l + T.r,
        n = Math.max(1, Math.ceil(W / MAPGEN_MOUTH.step) + 1),
        at = [];
      for (let m = 0; m < n; m++) {
        const u = n === 1 ? 0 : T.l - (W * m) / (n - 1);
        at.push([mapgenRound2(T.x + T.nx * u), mapgenRound2(T.z + T.nz * u)]);
      }
      if (!at.every(([x, z]) => offRoad(x, z))) continue;
      /* the cells they block, as the walk grid reads a solid prop (a disc of `solid`, a fifth of it nearer the back) */
      const blk = new Uint8Array(gw * gh);
      for (const [px, pz] of at) {
        const cz = pz + br * 0.2;
        for (let j = Math.max(0, Math.floor((cz - br) * N)); j < Math.min(gh, Math.ceil((cz + br) * N)); j++)
          for (let i = Math.max(0, Math.floor((px - br) * N)); i < Math.min(gw, Math.ceil((px + br) * N)); i++)
            if (Math.hypot((i + 0.5) / N - px, (j + 0.5) / N - cz) <= br) blk[j * gw + i] = 1;
      }
      if (blk[R.start] || blk[s]) continue;
      /* the cells that can still walk to the spot with them up (eight ways, a diagonal squeeze counts): shut off when
         the hub is not among them, and too much shut off past `most` of the walk */
      const got = new Uint8Array(gw * gh),
        cap = walked * MAPGEN_MOUTH.most,
        Q = [s];
      got[s] = 1;
      let through = false;
      for (let h = 0; h < Q.length && !through && Q.length <= cap; h++) {
        const q = Q[h],
          i = q % gw,
          j = Math.floor(q / gw);
        for (const [di, dj] of MAPGEN_EIGHT) {
          const ii = i + di,
            jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) continue;
          const r = jj * gw + ii;
          if (got[r] || !seen[r] || blk[r] || !step(r, q)) continue;
          got[r] = 1;
          Q.push(r);
          if (r === R.start) through = true;
        }
      }
      if (through || Q.length > cap) continue;
      const kept = (x, z) => {
        const K = MAPGEN_MOUTH.keep;
        for (let dz = -K; dz <= K; dz += 0.5)
          for (let dx = -K; dx <= K; dx += 0.5) {
            const q = cellOf(x + dx, z + dz);
            if (got[q]) return false;
          }
        return true;
      };
      const need = [
        sc.hub,
        ...exits,
        ...sc.spots.filter(o => o !== sp).flatMap(o => [[o.x, o.z], ...(o.stand ? [o.stand] : [])]),
        ...(sc.pieces || []).flatMap(o => [[o.x, o.z], ...(o.people || []).map(q => [q.x, q.z])]),
      ];
      if (!need.every(([x, z]) => kept(x, z))) continue;
      sp.mouth = at;
      break;
    }
  }
}

/* ---------- checking a scene: can you walk from the hub to every exit? ---------- */
/** a scene's walk grid on half-metre cells (walk-view.js navGrid, simplified): blk, water blocked unless a bridge
 * crosses it and solid props; S, the step raise of each cell in 5 cm units (null with no steps) */
export function mapgenWalkGrid(sc, scenery, o = {}) {
  const N = 2,
    gw = sc.w * N,
    gh = sc.h * N,
    blk = new Uint8Array(gw * gh),
    br = new Uint8Array(gw * gh) /* cells a bridge's deck crosses */,
    C = scenery || { terrains: {}, props: {} };
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      const ch = (sc.tiles[sc.h - 1 - Math.floor(j / N)] || '')[Math.floor(i / N)] || sc.edge,
        T = C.terrains[ch];
      if (!(T && T.walk != null ? T.walk : !MAPGEN_WET.includes(ch) || sc.ride)) blk[j * gw + i] = 1;
    }
  const each = (x0, z0, x1, z1, fn) => {
    for (let j = Math.max(0, Math.floor(z0 * N)); j < Math.min(gh, Math.ceil(z1 * N)); j++)
      for (let i = Math.max(0, Math.floor(x0 * N)); i < Math.min(gw, Math.ceil(x1 * N)); i++)
        fn(j * gw + i, (i + 0.5) / N, (j + 0.5) / N);
  };
  /* TR-2, with o.slope: smooth land too steep to walk (walk/heights.js navGrid: a slope over 1.05); a bridge's deck is
     walked whatever lies under it */
  const ground = o.slope && sc.heights && sc.heights.length ? mapgenGroundSampler(sc) : null;
  if (ground)
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) {
        const x = (i + 0.5) / N,
          z = (j + 0.5) / N,
          e = 0.3,
          gx = (ground(x + e, z) - ground(x - e, z)) / (2 * e),
          gz = (ground(x, z + e) - ground(x, z - e)) / (2 * e);
        if (Math.hypot(gx, gz) > 1.05) blk[j * gw + i] = 1;
      }
  for (const b of sc.bridges || []) {
    const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]) || 1;
    for (let t = 0; t <= L; t += 0.25) {
      const x = b.a[0] + ((b.b[0] - b.a[0]) * t) / L,
        z = b.a[1] + ((b.b[1] - b.a[1]) * t) / L;
      each(x - b.w / 2, z - b.w / 2, x + b.w / 2, z + b.w / 2, (q, cx, cz) => {
        if (Math.hypot(cx - x, cz - z) <= b.w / 2) {
          blk[q] = 0;
          br[q] = 1;
        }
      });
    }
  }
  /* as walk-view.js navGrid: a turned prop (rot) blocks its turned footprint, a prop with posts (an arch) its posts */
  const disc = (cx, cz, r) =>
    each(cx - r, cz - r, cx + r, cz + r, (q, x, z) => Math.hypot(x - cx, z - cz) <= r && (blk[q] = 1));
  const ppu = C.ppu || 34;
  for (const p of sc.props || []) {
    const M = C.props[p.k];
    if (!M || M.walk) continue;
    const s = p.s || 1;
    if (M.box) {
      const w = M.box[0] * s,
        d = M.box[1] * s;
      if (p.rot) {
        const B = turnedBounds(p, -w / 2, -0.1, w / 2, d);
        each(B[0], B[1], B[2], B[3], (q, x, z) => {
          const [lx, lz] = pointInProp(p, x, z);
          if (lx >= -w / 2 && lx <= w / 2 && lz >= -0.1 && lz <= d) blk[q] = 1;
        });
      } else each(p.x - w / 2, p.z - 0.1, p.x + w / 2, p.z + d, q => (blk[q] = 1));
    } else if (M.posts)
      for (const o of M.posts) {
        const [px, pz] = turnedPoint(p, (o.x / ppu) * s * (p.f ? -1 : 1), 0.15);
        disc(px, pz, (o.r || 0.4) * s);
      }
    else {
      const r = M.solid != null ? M.solid * s : M.flat ? 0 : (M.shadow || 0) * 0.42 * s;
      if (r > 0.05) {
        const [cx, cz] = turnedPoint(p, 0, r * 0.2);
        disc(cx, cz, r);
      }
    }
  }
  /* steps: the raise of each cell (decoded from base64 Int16) */
  /** @type {Int16Array | null} */
  let S = null;
  if (sc.steps) {
    const u = mapgenDecodeBase64(sc.steps);
    S = new Int16Array(u.buffer, 0, u.length >> 1);
  }
  return { N, gw, gh, blk, br, S: S && S.length === gw * gh ? S : null };
}
/** the half-metre cells you can walk to from a point (the hub unless given): water, solid props and a step taller
 * than 0.34 m stop you (with o.slope, also smooth land steeper than 1.05, steps measured on the whole height, and a
 * ledge (stepm flag 16) lets you hop down from it up to 1.8 m, never up: walk-view.js canStepBetween).
 * { N, gw, gh, blk, S, seen, step } (step(a, b): may you step from cell a to its neighbour b) */
export function mapgenReach(sc, scenery, from = sc.hub, o = {}) {
  const W = mapgenWalkGrid(sc, scenery, o),
    { N, gw, gh, blk, br, S } = W,
    start = mapgenBetween(Math.floor(from[1] * N), 0, gh - 1) * gw + mapgenBetween(Math.floor(from[0] * N), 0, gw - 1),
    seen = new Uint8Array(gw * gh),
    dist = new Int32Array(gw * gh).fill(-1) /* half-metre steps from the start (TR-2c) */,
    Q = [start];
  /* TR-2, with o.slope: the height you stand at in each cell (the smooth land and its raise), as the game compares
     cells (walk-view.js lv), so a step cut into a slope (a trail) is judged by what you climb, not by its raise */
  let lv = /** @type {Float32Array | null} */ (null),
    hop = /** @type {Uint8Array | null} */ (null);
  if (o.slope) {
    lv = new Float32Array(gw * gh);
    const ground = mapgenGroundSampler(sc);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) lv[j * gw + i] = ground((i + 0.5) / N, (j + 0.5) / N) + (S ? S[j * gw + i] / 20 : 0);
    if (sc.stepm) {
      const M = mapgenDecodeBase64(sc.stepm);
      if (M.length === gw * gh) hop = M.map(f => (f & 16 ? 1 : 0));
    }
  }
  /* on a bridge the deck is walked, not the bed under it: its raise alone, as without o.slope */
  const step = (a, b) => {
    if (blk[b]) return false;
    if (!lv || br[a] || br[b]) return !S || Math.abs(S[b] - S[a]) / 20 <= 0.34;
    const d = lv[b] - lv[a];
    if (d > 0.34) return false;
    if (d < -0.34) return !!hop && !!hop[a] && d > -1.8;
    return true;
  };
  seen[start] = 1;
  dist[start] = 0;
  for (let n = 0; n < Q.length; n++) {
    const q = Q[n],
      i = q % gw,
      j = Math.floor(q / gw);
    for (const [di, dj] of MAPGEN_FOUR) {
      const ii = i + di,
        jj = j + dj,
        r = jj * gw + ii;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh || seen[r] || !step(q, r)) continue;
      seen[r] = 1;
      dist[r] = dist[q] + 1;
      Q.push(r);
    }
  }
  return { ...W, seen, dist, step, start };
}
export const MAPGEN_FOUR = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
/** TR-2c: the cells you can walk to but never back from (a pocket below a ledge with no way up, say): reached from
 * the hub, yet the hub can't be reached from them, ledges counted one way. Their count and the first few (x, z) */
export function mapgenTraps(sc, scenery) {
  const R = mapgenReach(sc, scenery, sc.hub, { slope: true }),
    { gw, gh, seen, step, start, N } = R,
    back = new Uint8Array(gw * gh),
    Q = [start];
  back[start] = 1;
  for (let n = 0; n < Q.length; n++) {
    const q = Q[n],
      i = q % gw,
      j = Math.floor(q / gw);
    for (const [di, dj] of MAPGEN_FOUR) {
      const ii = i + di,
        jj = j + dj,
        r = jj * gw + ii;
      if (ii < 0 || jj < 0 || ii >= gw || jj >= gh || back[r] || !seen[r] || !step(r, q)) continue;
      back[r] = 1;
      Q.push(r);
    }
  }
  const at = [];
  let n = 0;
  for (let q = 0; q < gw * gh; q++)
    if (seen[q] && !back[q]) {
      n++;
      if (at.length < 5) at.push([((q % gw) + 0.5) / N, (Math.floor(q / gw) + 0.5) / N]);
    }
  return { n, at, R, back };
}
/** was the cell at (x, z) reached (R: from mapgenReach) */
export const mapgenReached = (R, x, z) =>
  !!R.seen[mapgenBetween(Math.floor(z * R.N), 0, R.gh - 1) * R.gw + mapgenBetween(Math.floor(x * R.N), 0, R.gw - 1)];
/** the exits the hub can't walk to (by edgeExits id) */
export function mapgenUnreachable(sc, scenery, o = {}) {
  const R = mapgenReach(sc, scenery, sc.hub, o);
  return (sc.edgeExits || []).filter(e => !mapgenReached(R, ...mapgenExitPoint(sc.w, sc.h, e))).map(e => e.id);
}

/* ---------- MG-2: how two scenes meet where they join ---------- */
/* how far either side of an exit a neighbour shows in a place's view (seamless-world.js NEIGHBOR_BAND_HALF_WIDTH):
   the stretch of a joined edge that must agree */
export const MAPGEN_BAND = 26;
export const MAPGEN_OUTWARD = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }; /* pointing out of the map */
/** a scene's corner height at whole metres (x east, z from the near edge), as stored */
export function mapgenSceneCorner(sc, x, z) {
  const r = (sc.heights || [])[sc.h - mapgenBetween(Math.round(z), 0, sc.h)];
  return r ? +r[mapgenBetween(Math.round(x), 0, sc.w)] || 0 : 0;
}
/** a scene's ground height at (x, z) between its corners (bilinear; walk/heights.js keeps within the same corners) */
export function mapgenSceneGround(sc, x, z) {
  const i = mapgenBetween(Math.floor(x), 0, sc.w - 1),
    j = mapgenBetween(Math.floor(z), 0, sc.h - 1),
    fx = mapgenBetween(x - i, 0, 1),
    fz = mapgenBetween(z - j, 0, 1),
    c = (a, b) => mapgenSceneCorner(sc, a, b);
  return (
    c(i, j) * (1 - fx) * (1 - fz) +
    c(i + 1, j) * fx * (1 - fz) +
    c(i, j + 1) * (1 - fx) * fz +
    c(i + 1, j + 1) * fx * fz
  );
}
/** mapgenSceneGround for many points of one scene: its corners read once into a table (the same sums, so the same
 * heights), for the walk checks that sample every half-metre cell @returns {(x: number, z: number) => number} */
export function mapgenGroundSampler(sc) {
  const W1 = sc.w + 1,
    C = new Float64Array(W1 * (sc.h + 1));
  for (let j = 0; j <= sc.h; j++) for (let i = 0; i <= sc.w; i++) C[j * W1 + i] = mapgenSceneCorner(sc, i, j);
  return (x, z) => {
    const i = mapgenBetween(Math.floor(x), 0, sc.w - 1),
      j = mapgenBetween(Math.floor(z), 0, sc.h - 1),
      fx = mapgenBetween(x - i, 0, 1),
      fz = mapgenBetween(z - j, 0, 1),
      q = j * W1 + i;
    return C[q] * (1 - fx) * (1 - fz) + C[q + 1] * fx * (1 - fz) + C[q + W1] * (1 - fx) * fz + C[q + W1 + 1] * fx * fz;
  };
}
/** a scene's exit and the point it stands on (sc.exits, as the game reads it; worked out when missing) */
export function mapgenExitOf(sc, id) {
  const k = (sc.edgeExits || []).findIndex(e => e.id === id);
  if (k < 0) return null;
  const e = sc.edgeExits[k];
  return { k, e, p: (sc.exits || [])[k] || mapgenExitPoint(sc.w, sc.h, e) };
}
/** where B's corner lies in A's metres when A's exit meets B's (seamless-world.js seamlessJoin) */
export function mapgenJoinOffset(A, xa, B, xb) {
  const s = xa.e.side;
  return s === 'E'
    ? [A.w, Math.round(xa.p[1] - xb.p[1])]
    : s === 'W'
      ? [-B.w, Math.round(xa.p[1] - xb.p[1])]
      : s === 'N'
        ? [Math.round(xa.p[0] - xb.p[0]), A.h]
        : [Math.round(xa.p[0] - xb.p[0]), -B.h];
}
/**
 * how well two scenes meet where A's exit idA joins B's exit idB, B laid as the game lays it: the largest height gap
 * between their corners along the shared edge within 6 m of the exit (dhNear, the a02_joins distance) and within the
 * neighbour band (dhBand); the step raise across the seam at the exit (raiseExit, B's minus A's) and its largest gap
 * along the band (raiseBand); and walk: null when a straight walk across, from 4 m inside A's exit to 5.2 m out (as
 * a02_joins walks it), crosses only walkable half-metre cells with no rise over 0.34 m between them (ground plus
 * raise, as the nav grid levels them), else what stops it. null when an exit is missing.
 * @returns {{ off: number[], dhNear: number, dhBand: number, raiseExit: number, raiseBand: number, walk: string | null } | null}
 */
export function mapgenSeamAgreement(A, idA, B, idB, scenery) {
  const xa = mapgenExitOf(A, idA),
    xb = mapgenExitOf(B, idB);
  if (!xa || !xb) return null;
  const s = xa.e.side,
    v = s === 'E' || s === 'W',
    off = mapgenJoinOffset(A, xa, B, xb),
    oa = v ? off[1] : off[0],
    e = v ? xa.p[1] : xa.p[0],
    lo = Math.max(0, oa, e - MAPGEN_BAND),
    hi = Math.min(v ? A.h : A.w, oa + (v ? B.h : B.w), e + MAPGEN_BAND);
  /* the shared edge, by u (metres along it, in A's): A's corner and B's, A's half-metre cell touching it and B's */
  const edge = u => {
    const ax = v ? (s === 'E' ? A.w : 0) : u,
      az = v ? u : s === 'N' ? A.h : 0;
    return [ax, az, ax - off[0], az - off[1]];
  };
  const inA = u => (v ? [s === 'E' ? A.w - 0.25 : 0.25, u] : [u, s === 'N' ? A.h - 0.25 : 0.25]),
    inB = u => {
      const [x, z] = inA(u);
      return [x + (v ? (s === 'E' ? 0.5 : -0.5) : 0) - off[0], z + (v ? 0 : s === 'N' ? 0.5 : -0.5) - off[1]];
    };
  let dhNear = 0,
    dhBand = 0;
  for (let u = Math.ceil(lo); u <= Math.floor(hi); u++) {
    const [ax, az, bx, bz] = edge(u),
      d = Math.abs(mapgenSceneCorner(B, bx, bz) - mapgenSceneCorner(A, ax, az));
    dhBand = Math.max(dhBand, d);
    if (Math.abs(u - e) <= 6) dhNear = Math.max(dhNear, d);
  }
  const WA = mapgenWalkGrid(A, scenery),
    WB = mapgenWalkGrid(B, scenery),
    cell = (W, x, z) =>
      mapgenBetween(Math.floor(z * W.N), 0, W.gh - 1) * W.gw + mapgenBetween(Math.floor(x * W.N), 0, W.gw - 1),
    raise = (W, x, z) => (W.S ? W.S[cell(W, x, z)] / 20 : 0);
  const raiseExit = mapgenRound2(raise(WB, ...inB(e)) - raise(WA, ...inA(e)));
  let raiseBand = 0;
  for (let u = Math.floor(lo) + 0.25; u < hi; u += 0.5)
    raiseBand = Math.max(raiseBand, Math.abs(raise(WB, ...inB(u)) - raise(WA, ...inA(u))));
  /* the walk across, every tenth of a metre, cell by cell */
  const d = MAPGEN_OUTWARD[s],
    a = [xa.p[0] - d[0] * 4, xa.p[1] - d[1] * 4];
  let walk = /** @type {string | null} */ (null),
    last = '',
    lv0 = NaN;
  for (let t = 0; t <= 9.2 + 1e-6 && !walk; t += 0.1) {
    let x = a[0] + d[0] * t,
      z = a[1] + d[1] * t,
      S = A,
      W = WA;
    if (x < 0 || z < 0 || x > A.w || z > A.h) {
      x -= off[0];
      z -= off[1];
      S = B;
      W = WB;
    }
    const q = cell(W, x, z),
      key = (S === A ? 'a' : 'b') + q;
    if (key === last) continue;
    last = key;
    const where = `${t.toFixed(1)} m along, in ${S === A ? 'the first' : 'the second'} scene`;
    if (W.blk[q]) walk = `blocked ${where}`;
    const lv = mapgenSceneGround(S, x, z) + (W.S ? W.S[q] / 20 : 0);
    if (lv0 === lv0 && Math.abs(lv - lv0) > 0.34) walk = `a step of ${Math.abs(lv - lv0).toFixed(2)} m ${where}`;
    lv0 = lv;
  }
  return {
    off,
    dhNear: mapgenRound2(dhNear),
    dhBand: mapgenRound2(dhBand),
    raiseExit,
    raiseBand: mapgenRound2(raiseBand),
    walk,
  };
}
